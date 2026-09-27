from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.app.core.database import get_db
from backend.app.core.dependencies import require_role, get_current_user
from backend.app.models.models import User, Product, Transfer, Order, StockLedger
from backend.app.models.models import TransferStatusEnum, OrderStatusEnum, StockActionEnum
from backend.app.schemas.schemas import TransferOut, OrderLogisticsOut

router = APIRouter(prefix="/api/packer", tags=["packer"], dependencies=[Depends(require_role(["PACKER"]))])

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

@router.get("/orders", response_model=List[OrderLogisticsOut])
def get_orders(db: Session = Depends(get_db)):
    return db.query(Order).filter(Order.status == OrderStatusEnum.PENDING_PACKING).all()

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
    db.commit()
    return {"status": "success"}
