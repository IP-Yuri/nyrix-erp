from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel

from backend.app.core.database import get_db
from backend.app.core.dependencies import require_role, get_current_user
from backend.app.models.models import (
    User, Product, InboundShipment, Transfer, StockLedger, Discrepancy, Order, CODCashBook, ProductReturn,
    ShipmentStatusEnum, TransferStatusEnum, StockActionEnum, DiscrepancyStatusEnum, OrderStatusEnum
)
from backend.app.schemas.schemas import (
    ProductOperationalOut, OrderLogisticsOut, TransferOut, CODCashBookOut, StockLedgerOut
)

router = APIRouter(prefix="/api/warehouse", tags=["warehouse"], dependencies=[Depends(require_role(["WAREHOUSE", "ADMIN"]))])

class TransferReq(BaseModel):
    product_sku: str
    quantity: int
    to_user_id: str = None

class DiscrepancyReq(BaseModel):
    product_sku: str
    quantity_missing: int
    reason: str

class ReturnReq(BaseModel):
    product_sku: str
    quantity: int
    is_shelf_damage: bool = False
    is_damaged: bool = False
    tracking_number: Optional[str] = None
    reason: Optional[str] = None

from datetime import datetime

class CODReq(BaseModel):
    driver_ref: str
    amount_mad: float

class ProcessCancellationReq(BaseModel):
    action: str  # "APPROVE" or "REJECT"
    rejection_reason: Optional[str] = None

@router.get("/inbound")
def get_inbound(db: Session = Depends(get_db)):
    # Returns active pending receipts and cancellation requests for Karime's dock
    shipments = db.query(InboundShipment).filter(
        InboundShipment.status.in_([ShipmentStatusEnum.EN_ATTENTE_RECEPTION, ShipmentStatusEnum.DEMANDE_ANNULATION])
    ).order_by(InboundShipment.created_at.desc()).all()
    result = []
    for s in shipments:
        result.append({
            "id": str(s.id),
            "invoice_ref": s.invoice_ref,
            "supplier_name": s.supplier_name or "Fournisseur non spécifié",
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "received_at": s.received_at.isoformat() if s.received_at else None,
            "received_by": s.received_by,
            "cancellation_reason": s.cancellation_reason,
            "cancellation_requested_by": s.cancellation_requested_by,
            "cancellation_requested_at": s.cancellation_requested_at.isoformat() if s.cancellation_requested_at else None,
            "items_json": s.items_json if isinstance(s.items_json, list) else []
        })
    return result

@router.get("/inbound/history")
def get_inbound_history(db: Session = Depends(get_db)):
    # Returns recent dock receipts and completed cancellations
    shipments = db.query(InboundShipment).filter(
        InboundShipment.status.in_([ShipmentStatusEnum.RECEPTIONNE, ShipmentStatusEnum.ANNULEE])
    ).order_by(InboundShipment.created_at.desc()).limit(25).all()
    result = []
    for s in shipments:
        result.append({
            "id": str(s.id),
            "invoice_ref": s.invoice_ref,
            "supplier_name": s.supplier_name or "Fournisseur non spécifié",
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "received_at": s.received_at.isoformat() if s.received_at else None,
            "received_by": s.received_by,
            "cancellation_reason": s.cancellation_reason,
            "cancellation_requested_by": s.cancellation_requested_by,
            "cancellation_requested_at": s.cancellation_requested_at.isoformat() if s.cancellation_requested_at else None,
            "items_json": s.items_json if isinstance(s.items_json, list) else []
        })
    return result

@router.put("/inbound/{id}/verify")
def verify_inbound(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shipment = db.query(InboundShipment).filter(InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Arrivage introuvable")
    shipment.status = ShipmentStatusEnum.RECEPTIONNE
    shipment.received_at = datetime.utcnow()
    shipment.received_by = current_user.username
    db.commit()
    return {"status": "success", "received_at": shipment.received_at.isoformat()}

@router.post("/inbound/accept")
def accept_inbound_latest(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shipments = db.query(InboundShipment).filter(InboundShipment.status == ShipmentStatusEnum.EN_ATTENTE_RECEPTION).all()
    now = datetime.utcnow()
    for s in shipments:
        s.status = ShipmentStatusEnum.RECEPTIONNE
        s.received_at = now
        s.received_by = current_user.username
    db.commit()
    return {"status": "success", "count": len(shipments)}

@router.post("/inbound/{id}/process-cancellation")
def process_cancellation(id: str, req: ProcessCancellationReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Option 1: Karime approuve ou refuse la demande d'annulation soumise par Othmane avec Stock Guard"""
    shipment = db.query(InboundShipment).filter(InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Arrivage introuvable")

    if shipment.status != ShipmentStatusEnum.DEMANDE_ANNULATION:
        raise HTTPException(status_code=400, detail="Cette facture n'est pas en attente d'annulation conjointe.")

    if req.action.upper() == "REJECT":
        shipment.status = ShipmentStatusEnum.RECEPTIONNE
        reason_text = req.rejection_reason.strip() if (req.rejection_reason and req.rejection_reason.strip()) else "Marchandise déjà ventilée ou transférée"
        shipment.cancellation_reason = f"Refusée par {current_user.username}: {reason_text}"

        # Audit ledger logging for refused cancellation
        items = shipment.items_json if isinstance(shipment.items_json, list) else []
        for itm in items:
            sku = itm.get("sku")
            if sku:
                ledger = StockLedger(
                    product_sku=sku,
                    user_id=str(current_user.id),
                    action=StockActionEnum.CANCELLATION_REJECTED,
                    quantity=0
                )
                db.add(ledger)

        db.commit()
        return {
            "status": "success",
            "action": "REJECTED",
            "message": f"Demande d'annulation rejetée pour {shipment.invoice_ref}. Le stock physique est maintenu au quai."
        }

    elif req.action.upper() == "APPROVE":
        items = shipment.items_json if isinstance(shipment.items_json, list) else []
        
        # GARDE-FOU A : Contrôle d'intégrité du stock (Stock Guard)
        insufficient_stock_errors = []
        for itm in items:
            sku = itm.get("sku")
            qty = int(itm.get("quantity", 0))
            if not sku or qty <= 0:
                continue
            prod = db.query(Product).filter(Product.sku == sku).with_for_update().first()
            if not prod:
                insufficient_stock_errors.append(f"Le produit SKU '{sku}' n'existe plus dans le catalogue.")
            elif prod.global_stock < qty:
                deficit = qty - prod.global_stock
                insufficient_stock_errors.append(
                    f"Produit '{prod.name}' (SKU: {sku}) : Stock quai disponible ({prod.global_stock} U) < Quantité facture ({qty} U). "
                    f"Il manque {deficit} U (déjà transférées au conditionnement ou sorties). "
                    f"Veuillez d'abord réintégrer ces {deficit} U au quai."
                )

        if insufficient_stock_errors:
            raise HTTPException(
                status_code=400,
                detail="Échec du Contrôle d'Intégrité Stock Guard :\n\n" + "\n".join(insufficient_stock_errors)
            )

        # Application de la déduction de stock et écriture dans le Grand Livre (Garde-fou C)
        deducted_details = []
        for itm in items:
            sku = itm.get("sku")
            qty = int(itm.get("quantity", 0))
            if not sku or qty <= 0:
                continue
            prod = db.query(Product).filter(Product.sku == sku).with_for_update().first()
            prod.global_stock -= qty

            # Piste d'audit inviolable : Écriture de contre-passation
            ledger = StockLedger(
                product_sku=sku,
                user_id=str(current_user.id),
                action=StockActionEnum.IMPORT_CANCELLED,
                quantity=-qty
            )
            db.add(ledger)
            deducted_details.append({"sku": sku, "deducted": qty, "new_stock": prod.global_stock})

        shipment.status = ShipmentStatusEnum.ANNULEE
        shipment.cancellation_reason = f"Annulée et validée par {current_user.username} au quai"
        db.commit()

        return {
            "status": "success",
            "action": "APPROVED",
            "message": f"Annulation de la facture {shipment.invoice_ref} validée par Karime. Les stocks ont été déduits proprement et tracés dans le Grand Livre.",
            "deducted_details": deducted_details
        }
    else:
        raise HTTPException(status_code=400, detail="Action inconnue. Utilisez 'APPROVE' ou 'REJECT'.")

@router.post("/inbound/{id}/rollback-reception")
def rollback_reception(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Garde-fou B : Bouton direct pour Karime 'Annuler la réception (Erreur de validation quai)'"""
    shipment = db.query(InboundShipment).filter(InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Arrivage introuvable")

    if shipment.status != ShipmentStatusEnum.RECEPTIONNE:
        raise HTTPException(status_code=400, detail="Seule une facture actuellement au statut 'RECEPTIONNE' peut être remise en attente.")

    items = shipment.items_json if isinstance(shipment.items_json, list) else []
    
    # GARDE-FOU A : Stock Guard
    insufficient_stock_errors = []
    for itm in items:
        sku = itm.get("sku")
        qty = int(itm.get("quantity", 0))
        if not sku or qty <= 0:
            continue
        prod = db.query(Product).filter(Product.sku == sku).with_for_update().first()
        if not prod:
            insufficient_stock_errors.append(f"SKU '{sku}' introuvable.")
        elif prod.global_stock < qty:
            deficit = qty - prod.global_stock
            insufficient_stock_errors.append(
                f"SKU '{sku}' ({prod.name}) : Stock quai ({prod.global_stock} U) < Arrivage ({qty} U). {deficit} U ont déjà bougé vers le packaging."
            )

    if insufficient_stock_errors:
        raise HTTPException(
            status_code=400,
            detail="Annulation impossible (Stock Guard) :\n" + "\n".join(insufficient_stock_errors)
        )

    # Remise en attente de pointage au quai
    shipment.status = ShipmentStatusEnum.EN_ATTENTE_RECEPTION
    shipment.received_at = None
    shipment.received_by = None
    db.commit()

    return {
        "status": "success",
        "message": f"Réception {shipment.invoice_ref} remise en attente de pointage quai. Karime peut repointer les cartons ou Othmane peut ajuster la facture."
    }

@router.get("/inventory", response_model=List[ProductOperationalOut])
def get_inventory(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    return products

@router.post("/transfers", response_model=TransferOut)
def create_transfer(req: TransferReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.sku == req.product_sku).with_for_update().first()
    if not product or product.global_stock < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    to_user = req.to_user_id
    if not to_user:
        packer = db.query(User).filter(User.role == "PACKER").first()
        if packer:
            to_user = str(packer.id)
        else:
            raise HTTPException(status_code=400, detail="No packer found in system")

    t = Transfer(
        from_user_id=str(current_user.id),
        to_user_id=to_user,
        product_sku=req.product_sku,
        quantity=req.quantity,
        status=TransferStatusEnum.PENDING_ACCEPT
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

@router.post("/discrepancies")
def report_discrepancy(req: DiscrepancyReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    d = Discrepancy(
        product_sku=req.product_sku,
        quantity_missing=req.quantity_missing,
        reason=req.reason,
        status=DiscrepancyStatusEnum.PENDING_APPROVAL,
        reported_by=str(current_user.id)
    )
    db.add(d)
    db.commit()
    return {"status": "pending_approval"}

@router.post("/returns")
def process_return(req: ReturnReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.sku == req.product_sku).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if not req.is_damaged:
        # Healthy return: reintegrate to global_stock
        product.global_stock += req.quantity
        action = StockActionEnum.RETURN_RESTORED
        ledger_qty = req.quantity
    else:
        # Damaged
        action = StockActionEnum.QUARANTINE
        if req.is_shelf_damage:
            # Shelf damage from existing floor stock: deduct from global_stock
            if product.global_stock < req.quantity:
                raise HTTPException(status_code=400, detail="Insufficient global stock to quarantine")
            product.global_stock -= req.quantity
            ledger_qty = -req.quantity
        else:
            # Outbound order return: isolate without adding to global_stock
            ledger_qty = req.quantity

    ledger = StockLedger(
        product_sku=req.product_sku,
        user_id=str(current_user.id),
        action=action,
        quantity=ledger_qty
    )
    db.add(ledger)

    product_return = ProductReturn(
        product_sku=req.product_sku,
        quantity=req.quantity,
        condition="DAMAGED" if req.is_damaged else "INTACT",
        action=action.value,
        tracking_number=req.tracking_number,
        reason=req.reason or ("Marchandise endommagée / avariée" if req.is_damaged else "Colis intact réintégré"),
        reported_by=str(current_user.id)
    )
    db.add(product_return)

    db.commit()
    return {"status": "success", "action": action}

@router.get("/orders", response_model=List[OrderLogisticsOut])
def get_orders(db: Session = Depends(get_db)):
    return db.query(Order).options(joinedload(Order.items)).order_by(Order.created_at.desc()).all()

@router.post("/cod", response_model=CODCashBookOut)
def log_cod(req: CODReq, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = CODCashBook(driver_ref=req.driver_ref, amount_mad=req.amount_mad, logged_by=str(current_user.id))
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@router.get("/cod", response_model=List[CODCashBookOut])
def list_cod(db: Session = Depends(get_db)):
    return db.query(CODCashBook).order_by(CODCashBook.created_at.desc()).all()

@router.get("/ledger", response_model=List[StockLedgerOut])
def view_ledger(db: Session = Depends(get_db), sku: str = None):
    q = db.query(StockLedger)
    if sku:
        q = q.filter(StockLedger.product_sku == sku)
    return q.all()

from backend.app.services.matchmaker import sync_b2c_orders

@router.post("/sync")
def trigger_matchmaker_sync(db: Session = Depends(get_db)):
    result = sync_b2c_orders(db, simulate=False)
    return result

@router.get("/stock-summary")
def get_warehouse_stock(db: Session = Depends(get_db)):
    """
    Operational stock view for Karime (Warehouse Lead).
    Returns real physical quantities without any landed cost, margin, or financial valuation.
    """
    products = db.query(Product).order_by(Product.sku).all()
    results = []
    for p in products:
        g_stock = p.global_stock or 0
        p_stock = p.packer_stock or 0
        tot = g_stock + p_stock
        st = "IN_STOCK" if tot > 15 else ("LOW_STOCK" if tot > 0 else "OUT_OF_STOCK")
        results.append({
            "sku": p.sku,
            "name": p.name,
            "global_stock": g_stock,
            "packer_stock": p_stock,
            "total_stock": tot,
            "status": st
        })
    return results
