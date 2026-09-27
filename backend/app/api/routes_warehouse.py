from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from backend.app.core.database import get_db
from backend.app.core.dependencies import require_role, get_current_user
from backend.app.models.models import (
    User, Product, InboundShipment, Transfer, StockLedger, Discrepancy, Order, CODCashBook,
    ShipmentStatusEnum, TransferStatusEnum, StockActionEnum, DiscrepancyStatusEnum, OrderStatusEnum
)
from backend.app.schemas.schemas import (
    ProductOperationalOut, OrderLogisticsOut, TransferOut, CODCashBookOut, StockLedgerOut
)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"], dependencies=[Depends(require_role(["WAREHOUSE"]))])

class TransferReq(BaseModel):
    product_sku: str
    quantity: int
    to_user_id: str = None

class DiscrepancyReq(BaseModel):
    product_sku: str
    quantity_missing: int
    reason: str

class ReturnReq(BaseModel):
    product_sku: str
    quantity: int
    is_shelf_damage: bool = False
    is_damaged: bool = False

class CODReq(BaseModel):
    driver_ref: str
    amount_mad: float

@router.get("/inbound")
def get_inbound(db: Session = Depends(get_db)):
    shipments = db.query(InboundShipment).filter(InboundShipment.status == ShipmentStatusEnum.EN_ATTENTE_RECEPTION).all()
    return shipments

@router.put("/inbound/{id}/verify")
def verify_inbound(id: str, db: Session = Depends(get_db)):
    shipment = db.query(InboundShipment).filter(InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404)
    shipment.status = ShipmentStatusEnum.RECEPTIONNE
    db.commit()
    return {"status": "success"}

@router.post("/inbound/accept")
def accept_inbound_latest(db: Session = Depends(get_db)):
    shipments = db.query(InboundShipment).filter(InboundShipment.status == ShipmentStatusEnum.EN_ATTENTE_RECEPTION).all()
    for s in shipments:
        s.status = ShipmentStatusEnum.RECEPTIONNE
    db.commit()
    return {"status": "success", "count": len(shipments)}

@router.get("/inventory", response_model=List[ProductOperationalOut])
def get_inventory(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return products

@router.post("/transfers", response_model=TransferOut)
def create_transfer(req: TransferReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.sku == req.product_sku).first()
    if not product or product.global_stock < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    to_user = req.to_user_id
    if not to_user:
        packer = db.query(User).filter(User.role == "PACKER").first()
        if packer:
            to_user = str(packer.id)
        else:
            raise HTTPException(status_code=400, detail="No packer found in system")

    t = Transfer(
        from_user_id=str(current_user.id),
        to_user_id=to_user,
        product_sku=req.product_sku,
        quantity=req.quantity,
        status=TransferStatusEnum.PENDING_ACCEPT
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

@router.post("/discrepancies")
def report_discrepancy(req: DiscrepancyReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    d = Discrepancy(
        product_sku=req.product_sku,
        quantity_missing=req.quantity_missing,
        reason=req.reason,
        status=DiscrepancyStatusEnum.PENDING_APPROVAL,
        reported_by=str(current_user.id)
    )
    db.add(d)
    db.commit()
    return {"status": "pending_approval"}

@router.post("/returns")
def process_return(req: ReturnReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.sku == req.product_sku).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if not req.is_damaged:
        # Healthy return: reintegrate to global_stock
        product.global_stock += req.quantity
        action = StockActionEnum.RETURN_RESTORED
        ledger_qty = req.quantity
    else:
        # Damaged
        action = StockActionEnum.QUARANTINE
        if req.is_shelf_damage:
            # Shelf damage from existing floor stock: deduct from global_stock
            if product.global_stock < req.quantity:
                raise HTTPException(status_code=400, detail="Insufficient global stock to quarantine")
            product.global_stock -= req.quantity
            ledger_qty = -req.quantity
        else:
            # Outbound order return: isolate without adding to global_stock
            ledger_qty = req.quantity

    ledger = StockLedger(
        product_sku=req.product_sku,
        user_id=str(current_user.id),
        action=action,
        quantity=ledger_qty
    )
    db.add(ledger)
    db.commit()
    return {"status": "success", "action": action}

@router.get("/orders", response_model=List[OrderLogisticsOut])
def get_orders(db: Session = Depends(get_db)):
    return db.query(Order).all()

@router.post("/cod", response_model=CODCashBookOut)
def log_cod(req: CODReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = CODCashBook(driver_ref=req.driver_ref, amount_mad=req.amount_mad, logged_by=str(current_user.id))
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@router.get("/cod", response_model=List[CODCashBookOut])
def list_cod(db: Session = Depends(get_db)):
    return db.query(CODCashBook).all()

@router.get("/ledger", response_model=List[StockLedgerOut])
def view_ledger(db: Session = Depends(get_db), sku: str = None):
    q = db.query(StockLedger)
    if sku:
        q = q.filter(StockLedger.product_sku == sku)
    return q.all()

from backend.app.services.matchmaker import sync_b2c_orders

@router.post("/sync")
def trigger_matchmaker_sync(db: Session = Depends(get_db)):
    result = sync_b2c_orders(db, simulate=True)
    return result
