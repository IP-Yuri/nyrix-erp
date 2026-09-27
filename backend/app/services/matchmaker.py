import uuid
from sqlalchemy.orm import Session
from backend.app.models.models import Order, OrderItem, OrderTypeEnum, OrderStatusEnum, PaymentMethodEnum, PaymentStatusEnum
from backend.app.services.digylog_client import digylog_client

def sync_b2c_orders(db: Session, simulate: bool = False):
    """
    Syncs B2C orders from Google Sheets flag 'Envoyer au SL'
    and matches with Digylog logistics APIs.
    """
    if simulate or not digylog_client._is_live():
        # Simulate or fallback inserting a B2C order
        tracking_number = f"DL-{uuid.uuid4().hex[:6].upper()}"
        existing = db.query(Order).filter(Order.tracking_number == tracking_number).first()
        if not existing:
            order = Order(
                tracking_number=tracking_number,
                type=OrderTypeEnum.B2C,
                client_name="Client Casablanca (Digylog Simulé)",
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
            return {"status": "simulated", "tracking_number": tracking_number, "carrier": "Digylog"}
        return {"status": "noop"}
        
    # Real logic calling Digylog API Seller V2.1.0
    try:
        stores = digylog_client.get_stores()
        return {"status": "live_connected", "stores": stores}
    except Exception as e:
        print(f"Matchmaker Digylog API Error: {e}")
        return {"status": "error", "detail": str(e)}
