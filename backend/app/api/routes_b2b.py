from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import uuid

from backend.app.core.database import get_db
from backend.app.core.dependencies import require_role, get_current_user
from backend.app.models.models import User, Order, OrderItem, Product, OrderTypeEnum, OrderStatusEnum, PaymentMethodEnum, PaymentStatusEnum
from backend.app.schemas.schemas import OrderFullOut

router = APIRouter(prefix="/api/b2b", tags=["b2b"], dependencies=[Depends(require_role(["B2B"]))])

class B2BItemReq(BaseModel):
    product_sku: str
    quantity: int
    unit_price: float

class B2BOrderReq(BaseModel):
    client_name: str
    city: str
    items: List[B2BItemReq]

@router.post("/orders", response_model=OrderFullOut)
def create_b2b_order(req: B2BOrderReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tracking_number = f"B2B-{uuid.uuid4().hex[:4].upper()}"
    
    order = Order(
        tracking_number=tracking_number,
        type=OrderTypeEnum.B2B,
        owner_id=str(current_user.id),
        client_name=req.client_name,
        city=req.city,
        status=OrderStatusEnum.PENDING_PACKING,
        payment_method=PaymentMethodEnum.VIREMENT,
        payment_status=PaymentStatusEnum.UNPAID
    )
    db.add(order)
    
    for req_item in req.items:
        p = db.query(Product).filter(Product.sku == req_item.product_sku).first()
        if not p:
            raise HTTPException(status_code=400, detail=f"Product {req_item.product_sku} not found")
        item = OrderItem(
            tracking_number=tracking_number,
            product_sku=req_item.product_sku,
            quantity=req_item.quantity,
            unit_price=req_item.unit_price
        )
        db.add(item)
        
    db.commit()
    db.refresh(order)
    return order

@router.get("/orders", response_model=List[OrderFullOut])
def list_b2b_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Order).filter(Order.owner_id == str(current_user.id)).all()

@router.put("/orders/{tracking_number}/payment")
def mark_paid(tracking_number: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.tracking_number == tracking_number).first()
    if not order:
        raise HTTPException(status_code=404)
    order.payment_status = PaymentStatusEnum.PAID
    db.commit()
    return {"status": "success"}

from backend.app.schemas.schemas import ProductOperationalOut

@router.get("/inventory", response_model=List[ProductOperationalOut])
def get_b2b_inventory(db: Session = Depends(get_db)):
    return db.query(Product).all()
