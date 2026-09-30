from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from backend.app.core.database import get_db
from backend.app.models.models import (
    Order, OrderStatusEnum, PaymentStatusEnum, CODCashBook, User
)
from backend.app.services.digylog_client import digylog_client
from backend.app.core.dependencies import get_current_user, require_role

logger = logging.getLogger("digylog")
router = APIRouter(prefix="/api/digylog", tags=["digylog"])

def normalize_digylog_status(status_raw: str) -> Optional[OrderStatusEnum]:
    """
    Maps Digylog status strings to NYRIX ERP OrderStatusEnum.
    Digylog statuses include:
    - 'Livrée', 'Livré', 'Livrée au client' -> DELIVERED
    - 'Retournée', 'Retourné', 'Refusé', 'Annulé', 'Retour' -> RETURNED
    - 'En cours de livraison', 'En cours de dispatch', 'Au hub', 'Reçu', 'En cours d\'expédition' -> SHIPPED
    - 'Non envoyée', 'Prêt' -> READY
    """
    if not status_raw:
        return None
    s = status_raw.strip().lower()
    if any(k in s for k in ["livr", "delivered"]):
        return OrderStatusEnum.DELIVERED
    if any(k in s for k in ["retour", "refus", "annul"]):
        return OrderStatusEnum.RETURNED
    if any(k in s for k in ["expéd", "exped", "transit", "cours", "dispatch", "hub", "reçu", "recu"]):
        return OrderStatusEnum.SHIPPED
    if any(k in s for k in ["prêt", "pret", "pack"]):
        return OrderStatusEnum.READY
    return None

@router.post("/webhook")
async def digylog_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Real-Time Webhook Endpoint for Digylog Courier & Warehouse events.
    Called automatically by Digylog servers whenever:
    1. A courier marks a parcel as 'Livré' / 'Retourné' / 'En cours' on the road.
    2. A hub scans or transfers an order.
    3. Cash collection status changes ('Versés').
    """
    try:
        body = await request.json()
    except Exception as e:
        logger.error(f"Invalid JSON received on Digylog webhook: {e}")
        return {"status": "error", "message": "Invalid JSON"}

    # Handle single order dictionary or list of updates
    items = body if isinstance(body, list) else [body]
    updated_orders = []

    for item in items:
        # Digylog payloads may nest data under 'data' or provide tracking as 'traking' / 'tracking'
        data = item.get("data", item) if isinstance(item, dict) else {}
        tracking = data.get("traking") or data.get("tracking") or data.get("tracking_number") or data.get("num")
        if not tracking:
            continue

        raw_status = str(data.get("status") or data.get("livreur_status") or "")
        cash_status = str(data.get("cash_status") or "")
        price = float(data.get("price") or 0.0)

        order = db.query(Order).filter(Order.tracking_number == str(tracking).strip()).first()
        if not order:
            logger.warning(f"Digylog webhook received for unknown tracking #{tracking}")
            continue

        new_status = normalize_digylog_status(raw_status)
        status_changed = False

        if new_status and order.status != new_status:
            order.status = new_status
            status_changed = True

        # If delivered or cash marked as 'Versés', update payment status
        if new_status == OrderStatusEnum.DELIVERED or "vers" in cash_status.lower():
            if order.payment_status != PaymentStatusEnum.PAID:
                order.payment_status = PaymentStatusEnum.PAID
                status_changed = True

        if status_changed:
            db.commit()
            db.refresh(order)
            logger.info(f"Order #{tracking} updated via Digylog Webhook -> status: {order.status.value}, payment: {order.payment_status.value}")

        updated_orders.append({
            "tracking_number": tracking,
            "status": order.status.value,
            "payment_status": order.payment_status.value,
            "updated": status_changed
        })

    return {
        "status": "success",
        "processed_count": len(updated_orders),
        "results": updated_orders
    }

@router.get("/track/{tracking_number}")
def get_live_tracking(
    tracking_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Queries live tracking details and chronological scan history directly from Digylog API.
    Reconciles with local order status in NYRIX ERP.
    """
    try:
        info = digylog_client.get_order_info(tracking_number)
    except Exception as e:
        logger.warning(f"Could not fetch Digylog order info for {tracking_number}: {e}")
        info = {"error": str(e)}

    try:
        history = digylog_client.get_orders_history([tracking_number])
    except Exception as e:
        logger.warning(f"Could not fetch Digylog history for {tracking_number}: {e}")
        history = {}

    order = db.query(Order).filter(Order.tracking_number == tracking_number).first()
    
    # Auto-reconcile local DB if Digylog has updated status
    if order and isinstance(info, dict) and "status" in info:
        new_status = normalize_digylog_status(info.get("status"))
        if new_status and order.status != new_status:
            order.status = new_status
            if new_status == OrderStatusEnum.DELIVERED:
                order.payment_status = PaymentStatusEnum.PAID
            db.commit()
            db.refresh(order)

    return {
        "tracking_number": tracking_number,
        "local_order": {
            "client_name": order.client_name if order else None,
            "city": order.city if order else None,
            "status": order.status.value if order else None,
            "payment_status": order.payment_status.value if order else None,
            "cod_amount": order.cod_amount if order else 0.0,
            "type": order.type.value if order else None
        } if order else None,
        "digylog_live": info,
        "history": history.get(tracking_number, []) if isinstance(history, dict) else []
    }

@router.get("/stores")
def get_digylog_stores(current_user: User = Depends(get_current_user)):
    """Fetches the registered stores for this Digylog account."""
    return digylog_client.get_stores()

@router.get("/cities")
def get_digylog_cities(current_user: User = Depends(get_current_user)):
    """Fetches covered delivery cities and hubs from Digylog."""
    return digylog_client.get_cities()
