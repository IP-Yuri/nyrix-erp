import uuid
import re
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from backend.app.models.models import (
    Order, OrderItem, Product, OrderTypeEnum, OrderStatusEnum, 
    PaymentMethodEnum, PaymentStatusEnum
)
from backend.app.services.sheets_reader import fetch_confirmed_orders
from backend.app.services.inventory_service import deduct_order_stock_if_needed

CANONICAL_SKU_MAP = {
    "air-wallet-mag/marron": "AW-MAG-BRN",
    "air-wallet-mag marron": "AW-MAG-BRN",
    "air-wallet-mag/noir": "AW-MAG-BLK",
    "air-wallet-mag noir": "AW-MAG-BLK",
    "air-wallet-mag": "AW-MAG-BLK",
    "air wallet 299-1": "AW-01",
    "air wallet 349": "AW-01",
    "air wallet 399": "AW-01",
    "air wallet": "AW-01",
    "nyrix-fit-pro": "NYRIX-FIT-PRO",
    "nyrix fit pro": "NYRIX-FIT-PRO",
    "nyrix fit band": "NYRIX-FIT-BAND",
    "nyrix-grip": "NYRIX-GRIP",
    "nyrix grip": "NYRIX-GRIP",
    "nyrix air keychain": "NYRIX-KEYCHAIN",
    "keychain": "NYRIX-KEYCHAIN",
    "nyrix bifold": "WL-CUIR-001",
    "portefeuille slim cuir": "WL-CUIR-001",
    "porte-cartes rfid": "WL-RFID-089",
    "nyrix edge": "NYRIX-EDGE",
}

def resolve_sku_fast(raw_product_name: str) -> str:
    raw_lower = (raw_product_name or "").lower().strip()
    for pattern, sku in CANONICAL_SKU_MAP.items():
        if pattern in raw_lower:
            return sku
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', raw_lower).strip('-').upper()[:30]
    return slug or "AW-01"

def map_sheet_status(status_str: str) -> tuple:
    if not status_str:
        return OrderStatusEnum.PENDING_PACKING, PaymentStatusEnum.UNPAID
    
    s = status_str.strip().lower()
    if "livr" in s:
        return OrderStatusEnum.DELIVERED, PaymentStatusEnum.PAID
    if any(k in s for k in ["retour", "refus", "annul", "supprim", "ramassage"]):
        return OrderStatusEnum.RETURNED, PaymentStatusEnum.UNPAID
    if any(k in s for k in ["expéd", "exped", "cours", "transit", "hub", "reçu", "recu", "network", "transfert"]):
        return OrderStatusEnum.SHIPPED, PaymentStatusEnum.UNPAID
    return OrderStatusEnum.PENDING_PACKING, PaymentStatusEnum.UNPAID

def resolve_carrier_for_order(item: Dict[str, Any], tracking: str, order_type: OrderTypeEnum = OrderTypeEnum.B2C) -> str:
    if order_type == OrderTypeEnum.B2B:
        return "Digylog Fret"
    note = str(item.get("note") or "").lower()
    city = str(item.get("city") or "").lower()
    trk = str(tracking or "").upper()
    carrier_field = str(item.get("carrier") or item.get("transporteur") or "").strip()
    if carrier_field:
        if "au" in carrier_field.lower() or "ah" in carrier_field.lower() or "hub" in carrier_field.lower():
            return "Au Hub Network"
        return carrier_field
    if "au" in note or "ah" in note or "hub network" in note or "au-hub" in trk.lower() or "ah-hub" in trk.lower() or trk.startswith("AU") or trk.startswith("AH") or "au hub" in city or "ah hub" in city:
        return "Au Hub Network"
    return "Digylog Express"


def sync_b2c_orders(db: Session, simulate: bool = False, limit: Optional[int] = None):
    """
    High-Performance Matchmaker Engine:
    Reads B2C orders from Fatima Zahra's Google Sheet and synchronizes in bulk with zero round-trip overhead.
    """
    if simulate:
        # Alternate between Digylog Express and Au Hub Network for realistic testing
        sim_carrier = "Au Hub Network" if db.query(Order).count() % 2 == 1 else "Digylog Express"
        tracking_prefix = "AU" if sim_carrier == "Au Hub Network" else "DL"
        tracking_number = f"{tracking_prefix}-{uuid.uuid4().hex[:6].upper()}"
        existing = db.query(Order).filter(Order.tracking_number == tracking_number).first()
        if not existing:
            order = Order(
                tracking_number=tracking_number,
                type=OrderTypeEnum.B2C,
                client_name="Client Casablanca (Simulé)",
                city="Casablanca",
                status=OrderStatusEnum.PENDING_PACKING,
                payment_method=PaymentMethodEnum.COD,
                payment_status=PaymentStatusEnum.UNPAID,
                cod_amount=350.0,
                carrier=sim_carrier
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

    orders_to_process = sheet_orders[:limit] if limit else sheet_orders

    # 1. Bulk prefetch existing products to eliminate DB roundtrips
    existing_products = {p.sku: p for p in db.query(Product).all()}

    # 2. Bulk prefetch existing orders
    existing_orders = db.query(Order).options(joinedload(Order.items)).all()
    orders_by_trk: Dict[str, Order] = {o.tracking_number: o for o in existing_orders}
    orders_by_sheet_id: Dict[str, Order] = {o.sheet_order_id: o for o in existing_orders if o.sheet_order_id}

    synced_count = 0
    updated_count = 0

    for item in orders_to_process:
        sheet_id = str(item["sheet_order_id"]).strip() if item.get("sheet_order_id") else None
        raw_tracking = str(item.get("tracking") or "").strip()
        
        # Check by tracking number or by sheet_order_id in memory
        existing_order = None
        if raw_tracking and raw_tracking in orders_by_trk:
            existing_order = orders_by_trk[raw_tracking]
        elif sheet_id and sheet_id in orders_by_sheet_id:
            existing_order = orders_by_sheet_id[sheet_id]

        order_status, payment_status = map_sheet_status(item.get("status_livraison", ""))
        
        # Resolve SKU
        sku = resolve_sku_fast(item["product_raw"])
        if sku not in existing_products:
            new_prod = Product(
                sku=sku,
                name=(item["product_raw"] or sku)[:255],
                landed_cost=0.0,
                global_stock=0,
                packer_stock=0
            )
            db.add(new_prod)
            existing_products[sku] = new_prod

        # Parse date if available
        created_dt = None
        date_str = item.get("date")
        if date_str:
            try:
                created_dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            except Exception:
                pass
        if not created_dt:
            created_dt = existing_order.created_at if existing_order and existing_order.created_at else datetime.utcnow()

        if not existing_order:
            final_tracking = raw_tracking or (f"B2C-{sheet_id}" if sheet_id else f"B2C-{uuid.uuid4().hex[:6].upper()}")
            
            # Avoid collision in memory
            if final_tracking in orders_by_trk:
                final_tracking = f"{final_tracking}-{uuid.uuid4().hex[:3].upper()}"

            carrier_val = resolve_carrier_for_order(item, final_tracking, OrderTypeEnum.B2C)
            order = Order(
                tracking_number=final_tracking,
                sheet_order_id=sheet_id,
                type=OrderTypeEnum.B2C,
                client_name=item["client_name"],
                city=item["city"],
                status=order_status,
                payment_method=PaymentMethodEnum.COD,
                payment_status=payment_status,
                cod_amount=item["total_price"],
                created_at=created_dt,
                carrier=carrier_val
            )
            db.add(order)

            order_item = OrderItem(
                tracking_number=final_tracking,
                product_sku=sku,
                quantity=item["quantity"],
                unit_price=item["total_price"]
            )
            db.add(order_item)

            orders_by_trk[final_tracking] = order
            if sheet_id:
                orders_by_sheet_id[sheet_id] = order

            if order.status in [OrderStatusEnum.SHIPPED, OrderStatusEnum.DELIVERED]:
                deduct_order_stock_if_needed(db, order, "system-sync")

            synced_count += 1
        else:
            # Update order in memory
            if raw_tracking and existing_order.tracking_number != raw_tracking:
                old_trk = existing_order.tracking_number
                for itm in existing_order.items:
                    itm.tracking_number = raw_tracking
                existing_order.tracking_number = raw_tracking
                orders_by_trk[raw_tracking] = existing_order
                if old_trk in orders_by_trk:
                    del orders_by_trk[old_trk]

            existing_order.status = order_status
            existing_order.payment_status = payment_status
            existing_order.client_name = item["client_name"]
            existing_order.city = item["city"]
            existing_order.cod_amount = item["total_price"]
            existing_order.carrier = resolve_carrier_for_order(item, existing_order.tracking_number, existing_order.type)
            if date_str and created_dt:
                existing_order.created_at = created_dt

            if existing_order.status in [OrderStatusEnum.SHIPPED, OrderStatusEnum.DELIVERED]:
                deduct_order_stock_if_needed(db, existing_order, "system-sync")

            updated_count += 1

    # Single atomic commit for entire batch
    db.commit()

    return {
        "status": "success",
        "total_sheet_confirmed": len(sheet_orders),
        "synced_new": synced_count,
        "updated": updated_count,
        "total_processed": len(orders_to_process)
    }
