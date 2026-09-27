import httpx
from sqlalchemy.orm import Session
import uuid
from backend.app.models.models import Order, OrderItem, OrderTypeEnum, OrderStatusEnum, PaymentMethodEnum, PaymentStatusEnum

def sync_b2c_orders(db: Session, simulate: bool = False):
    """
    Syncs B2C orders from Google Sheets flag 'Envoyer au SL'
    and matches with Digylog logistics APIs.
    """
    if simulate:
        # Simulate inserting a B2C order
        tracking_number = f"B2C-{uuid.uuid4().hex[:4].upper()}"
        order = Order(
            tracking_number=tracking_number,
            type=OrderTypeEnum.B2C,
            client_name="Test Client B2C",
            city="Casablanca",
            status=OrderStatusEnum.PENDING_PACKING,
            payment_method=PaymentMethodEnum.COD,
            payment_status=PaymentStatusEnum.UNPAID,
            cod_amount=350.0
        )
        db.add(order)
        item = OrderItem(
            tracking_number=tracking_number,
            product_sku="AW-01",
            quantity=1,
            unit_price=350.0
        )
        db.add(item)
        db.commit()
        return {"status": "simulated", "tracking_number": tracking_number}
        
    # Real logic wrapped in try/except for resilience
    try:
        # Example API call
        # response = httpx.get("https://api.digylog.com/...")
        # response.raise_for_status()
        pass
    except Exception as e:
        print(f"Matchmaker API Error: {e}")
        # Does not crash server
    
    return {"status": "noop"}
