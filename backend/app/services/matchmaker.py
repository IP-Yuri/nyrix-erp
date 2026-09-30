import uuid
import re
from sqlalchemy.orm import Session
from backend.app.models.models import (
    Order, OrderItem, Product, OrderTypeEnum, OrderStatusEnum, 
    PaymentMethodEnum, PaymentStatusEnum
)
from backend.app.services.digylog_client import digylog_client
from backend.app.services.sheets_reader import fetch_confirmed_orders

CANONICAL_SKU_MAP = {
    "air wallet": "AW-01",
    "air wallet 299-1": "AW-01",
    "air wallet 349": "AW-01",
    "air wallet 399": "AW-01",
    "air-wallet-mag": "AW-01",
    "nyrix bifold": "WL-CUIR-001",
    "portefeuille slim cuir": "WL-CUIR-001",
    "porte-cartes rfid": "WL-RFID-089",
    "nyrix air keychain": "WL-RFID-089"
}

def resolve_product_sku(db: Session, raw_product_name: str) -> str:
    """Maps free-text product names from Google Sheet to a database SKU."""
    raw_lower = (raw_product_name or "").lower().strip()
    
    # Try exact / substring match in mapping
    matched_sku = None
    for pattern, sku in CANONICAL_SKU_MAP.items():
        if pattern in raw_lower:
            matched_sku = sku
            break
            
    if not matched_sku:
        # Generate a slug SKU for unseen items
        slug = re.sub(r'[^a-zA-Z0-9]+', '-', raw_lower).strip('-').upper()[:30]
        matched_sku = slug or "AW-01"

    # Ensure product exists in database to prevent FK violation
    product = db.query(Product).filter(Product.sku == matched_sku).first()
    if not product:
        product = Product(
            sku=matched_sku,
            name=raw_product_name[:255] or matched_sku,
            landed_cost=0.0,
            global_stock=0,
            packer_stock=0
        )
        db.add(product)
        db.flush()
        
    return matched_sku

def sync_b2c_orders(db: Session, simulate: bool = False, limit: int = 250):
    """
    The Matchmaker Engine:
    Reads B2C orders from Fatima Zahra's Google Sheet (rows flagged 'Envoyer au SL')
    and reconciles them with Digylog logistics tracking.
    """
    if simulate:
        # Standard fast test simulator for CI/E2E test suite
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

    try:
        sheet_orders = fetch_confirmed_orders()
    except Exception as e:
        print(f"Error reading Google Sheets: {e}")
        return {"status": "error", "message": f"Could not fetch Google Sheet: {e}"}

    synced_count = 0
    updated_count = 0
    skipped_count = 0

    from datetime import datetime

    for item in sheet_orders[:limit]:
        sheet_id = item["sheet_order_id"]
        raw_tracking = item["tracking"]
        
        # Determine tracking number
        if raw_tracking:
            tracking_number = raw_tracking
            existing_order = db.query(Order).filter(Order.tracking_number == tracking_number).first()
        else:
            tracking_number = f"B2C-{sheet_id}-{uuid.uuid4().hex[:4].upper()}" if sheet_id else f"B2C-{uuid.uuid4().hex[:6].upper()}"
            existing_order = None

        status_str = item.get("status_livraison", "")
        if "Livr" in status_str:
            order_status = OrderStatusEnum.DELIVERED
            payment_status = PaymentStatusEnum.PAID
        elif "Retourn" in status_str:
            order_status = OrderStatusEnum.RETURNED
            payment_status = PaymentStatusEnum.UNPAID
        else:
            order_status = OrderStatusEnum.PENDING_PACKING
            payment_status = PaymentStatusEnum.UNPAID

        sku = resolve_product_sku(db, item["product_raw"])

        # Parse date if available
        created_dt = datetime.utcnow()
        date_str = item.get("date")
        if date_str:
            try:
                created_dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            except Exception:
                pass

        if not existing_order:
            order = Order(
                tracking_number=tracking_number,
                sheet_order_id=sheet_id,
                type=OrderTypeEnum.B2C,
                client_name=item["client_name"],
                city=item["city"],
                status=order_status,
                payment_method=PaymentMethodEnum.COD,
                payment_status=payment_status,
                cod_amount=item["total_price"],
                created_at=created_dt
            )
            db.add(order)
            db.flush()

            order_item = OrderItem(
                tracking_number=tracking_number,
                product_sku=sku,
                quantity=item["quantity"],
                unit_price=item["total_price"]
            )
            db.add(order_item)
            synced_count += 1
        else:
            # Update tracking or status or date if changed
            if raw_tracking and existing_order.tracking_number != raw_tracking:
                existing_order.tracking_number = raw_tracking
            existing_order.status = order_status
            existing_order.payment_status = payment_status
            if date_str:
                existing_order.created_at = created_dt
            updated_count += 1

    db.commit()

    return {
        "status": "success",
        "total_sheet_confirmed": len(sheet_orders),
        "synced_new": synced_count,
        "updated": updated_count,
        "processed_limit": limit
    }
