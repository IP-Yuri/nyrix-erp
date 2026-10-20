from sqlalchemy.orm import Session
from backend.app.models.models import Order, OrderStatusEnum, Product, StockLedger, StockActionEnum, User

def deduct_order_stock_if_needed(db: Session, order: Order, user_id: str = "system") -> bool:
    """
    Ensures stock is deducted once an order reaches Digylog warehouse or is marked SHIPPED.
    Strictly idempotent: skips if order.stock_deducted is True.
    """
    if getattr(order, "stock_deducted", False):
        return False
    
    if order.status not in [OrderStatusEnum.SHIPPED, OrderStatusEnum.DELIVERED]:
        return False

    # Resolve a valid user ID to satisfy the StockLedger ForeignKey('users.id') constraint
    valid_user_id = None
    if user_id:
        u = db.query(User).filter(User.id == str(user_id)).first()
        if u:
            valid_user_id = str(u.id)

    if not valid_user_id and order.owner_id:
        u = db.query(User).filter(User.id == str(order.owner_id)).first()
        if u:
            valid_user_id = str(u.id)

    if not valid_user_id:
        fallback_user = db.query(User).filter(User.username.in_(["othmane", "karime", "admin"])).first() or db.query(User).first()
        if fallback_user:
            valid_user_id = str(fallback_user.id)

    for item in (order.items or []):
        prod = item.product or db.query(Product).filter(Product.sku == item.product_sku).first()
        if prod:
            qty = int(item.quantity or 1)
            # Deduct from packer_stock if available, else from global_stock
            if prod.packer_stock >= qty:
                prod.packer_stock -= qty
            else:
                remaining = qty - prod.packer_stock
                prod.packer_stock = 0
                prod.global_stock = max(0, prod.global_stock - remaining)
            
            if valid_user_id:
                ledger = StockLedger(
                    product_sku=item.product_sku,
                    user_id=valid_user_id,
                    action=StockActionEnum.PACKED_OUT,
                    quantity=-qty
                )
                db.add(ledger)
            
    order.stock_deducted = True
    return True

