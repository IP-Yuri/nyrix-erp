from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from backend.app.core.database import get_db
from backend.app.core.dependencies import require_role, get_current_user
from backend.app.models.models import User, Product, Transfer, Order, StockLedger, Discrepancy
from backend.app.models.models import TransferStatusEnum, OrderStatusEnum, StockActionEnum, DiscrepancyStatusEnum
from backend.app.schemas.schemas import TransferOut, OrderLogisticsOut

router = APIRouter(prefix="/api/packer", tags=["packer"], dependencies=[Depends(require_role(["PACKER"]))])

class TransferClaimReq(BaseModel):
    quantity_missing: int = 0
    reason: str = "Écart constaté par le préparateur"

@router.get("/transfers", response_model=List[TransferOut])
def get_pending_transfers(db: Session = Depends(get_db)):
    return db.query(Transfer).filter(Transfer.status == TransferStatusEnum.PENDING_ACCEPT).all()

@router.put("/transfers/{id}/accept")
def accept_transfer(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    transfer = db.query(Transfer).filter(Transfer.id == id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
        
    if transfer.status == TransferStatusEnum.ACCEPTED:
        raise HTTPException(status_code=400, detail="Already ACCEPTED")
        
    product = db.query(Product).filter(Product.sku == transfer.product_sku).first()
    if product.global_stock < transfer.quantity:
        raise HTTPException(status_code=400, detail="Insufficient global stock")
        
    transfer.status = TransferStatusEnum.ACCEPTED
    product.global_stock -= transfer.quantity
    product.packer_stock += transfer.quantity
    
    ledger = StockLedger(
        product_sku=transfer.product_sku,
        user_id=str(current_user.id),
        action=StockActionEnum.TRANSFER_ACCEPTED,
        quantity=transfer.quantity
    )
    db.add(ledger)
    db.commit()
    return {"status": "success"}

@router.post("/transfers/{id}/claim")
def claim_transfer(id: str, req: TransferClaimReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    transfer = db.query(Transfer).filter(Transfer.id == id).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    discrepancy = Discrepancy(
        product_sku=transfer.product_sku,
        quantity_missing=req.quantity_missing if req.quantity_missing > 0 else transfer.quantity,
        reason=f"[Lot Transfert {id}] {req.reason}",
        reported_by=str(current_user.id),
        status=DiscrepancyStatusEnum.PENDING
    )
    db.add(discrepancy)
    transfer.status = TransferStatusEnum.REJECTED
    db.commit()
    return {"status": "claimed", "discrepancy_id": discrepancy.id}

@router.get("/orders", response_model=List[OrderLogisticsOut])
def get_orders(db: Session = Depends(get_db)):
    return db.query(Order).filter(Order.status == OrderStatusEnum.PENDING_PACKING).all()

@router.get("/history", response_model=List[OrderLogisticsOut])
def get_packing_history(db: Session = Depends(get_db)):
    return db.query(Order).filter(
        Order.status.in_([OrderStatusEnum.READY, OrderStatusEnum.SHIPPED, OrderStatusEnum.DELIVERED])
    ).order_by(Order.packed_at.desc().nullslast(), Order.created_at.desc()).all()

@router.put("/orders/{tracking_number}/pack")
def pack_order(tracking_number: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = db.query(Order).filter(Order.tracking_number == tracking_number).first()
    if not order:
        raise HTTPException(status_code=404)
        
    if order.status == OrderStatusEnum.READY:
        raise HTTPException(status_code=400, detail="Already READY")
        
    # Verify stock
    for item in order.items:
        if item.product.packer_stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient packer stock for {item.product_sku}")
            
    # Deduct stock and log
    for item in order.items:
        item.product.packer_stock -= item.quantity
        ledger = StockLedger(
            product_sku=item.product_sku,
            user_id=str(current_user.id),
            action=StockActionEnum.PACKED_OUT,
            quantity=-item.quantity
        )
        db.add(ledger)
        
    order.status = OrderStatusEnum.READY
    order.packed_at = datetime.utcnow()
    order.packed_by = current_user.username
    db.commit()
    return {
        "status": "success", 
        "tracking_number": tracking_number,
        "packed_at": order.packed_at.isoformat() if order.packed_at else None,
        "packed_by": order.packed_by
    }
