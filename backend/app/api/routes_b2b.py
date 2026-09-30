from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import uuid

from backend.app.core.database import get_db
from backend.app.core.dependencies import require_role, get_current_user
from backend.app.models.models import (
    User, Order, OrderItem, Product,
    OrderTypeEnum, OrderStatusEnum, PaymentMethodEnum, PaymentStatusEnum
)
from backend.app.schemas.schemas import OrderFullOut, ProductB2BOut

router = APIRouter(prefix="/api/b2b", tags=["b2b"], dependencies=[Depends(require_role(["B2B", "ADMIN"]))])

class B2BItemReq(BaseModel):
    product_sku: Optional[str] = None
    sku: Optional[str] = None
    quantity: int
    unit_price: Optional[float] = None
    unit_price_mad: Optional[float] = None

class B2BOrderReq(BaseModel):
    client_name: str
    city: Optional[str] = "Casablanca"
    payment_method: Optional[str] = "VIREMENT"
    discount_pct: Optional[float] = 0.0
    items: List[B2BItemReq]

@router.post("/orders", response_model=OrderFullOut)
def create_b2b_order(req: B2BOrderReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not req.items or len(req.items) == 0:
        raise HTTPException(status_code=400, detail="Veuillez ajouter au moins un article.")

    tracking_number = f"B2B-{uuid.uuid4().hex[:4].upper()}"
    
    # Resolve payment method enum safely
    pm = PaymentMethodEnum.VIREMENT
    if req.payment_method:
        try:
            pm = PaymentMethodEnum(req.payment_method)
        except ValueError:
            pm = PaymentMethodEnum.VIREMENT

    order = Order(
        tracking_number=tracking_number,
        type=OrderTypeEnum.B2B,
        owner_id=str(current_user.id),
        client_name=req.client_name.strip(),
        city=(req.city or "Casablanca").strip(),
        status=OrderStatusEnum.PENDING_PACKING,
        payment_method=pm,
        payment_status=PaymentStatusEnum.UNPAID
    )
    db.add(order)
    
    for req_item in req.items:
        sku = (req_item.product_sku or req_item.sku or "").strip()
        if not sku:
            raise HTTPException(status_code=400, detail="SKU manquant sur un article.")
            
        p = db.query(Product).filter(Product.sku == sku).first()
        if not p:
            raise HTTPException(status_code=400, detail=f"Produit SKU '{sku}' non trouvé en base.")
            
        if req_item.quantity <= 0:
            raise HTTPException(status_code=400, detail=f"La quantité pour '{sku}' doit être supérieure à zéro.")
            
        price = (
            req_item.unit_price if req_item.unit_price is not None
            else (req_item.unit_price_mad if req_item.unit_price_mad is not None else 0.0)
        )
        if price < 0:
            raise HTTPException(status_code=400, detail=f"Le prix unitaire pour '{sku}' ne peut pas être négatif.")

        item = OrderItem(
            tracking_number=tracking_number,
            product_sku=sku,
            quantity=req_item.quantity,
            unit_price=float(price)
        )
        db.add(item)
        
    db.commit()
    db.refresh(order)
    return order

@router.get("/orders", response_model=List[OrderFullOut])
def list_b2b_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Order).filter(Order.type == OrderTypeEnum.B2B).order_by(Order.created_at.desc()).all()

@router.get("/orders/{tracking_number}", response_model=OrderFullOut)
def get_b2b_order(tracking_number: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.tracking_number == tracking_number, Order.type == OrderTypeEnum.B2B).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande B2B introuvable")
    return order

@router.put("/orders/{tracking_number}/payment")
def mark_paid(tracking_number: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.tracking_number == tracking_number).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    order.payment_status = PaymentStatusEnum.PAID
    db.commit()
    db.refresh(order)
    return {"status": "success", "tracking_number": tracking_number, "payment_status": "PAID"}

@router.get("/inventory", response_model=List[ProductB2BOut])
def get_b2b_inventory(db: Session = Depends(get_db)):
    return db.query(Product).all()
