from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Optional
import json
import uuid

from datetime import datetime
from backend.app.core.database import get_db
from backend.app.core.dependencies import require_role, get_current_user
from backend.app.models.models import User, Product, StockLedger, InboundShipment, Discrepancy, Order, ProductReturn
from backend.app.models.models import StockActionEnum, ShipmentStatusEnum, DiscrepancyStatusEnum
from backend.app.schemas.schemas import ProductAdminOut, DiscrepancyOut, InboundInvoiceOut, ProductReturnOut
from backend.app.services.landed_cost import calculate_landed_costs
import pandas as pd
import io

router = APIRouter(prefix="/api/finance", tags=["finance"], dependencies=[Depends(require_role(["ADMIN"]))])

@router.post("/import")
async def import_stock(
    ref_facture: Optional[str] = Form(None),
    nom_fournisseur: Optional[str] = Form(None),
    supplier_name: Optional[str] = Form(None),
    lines_json: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    exchange_rate: float = Form(...),
    customs_duty_pct: float = Form(...),
    transport_int: float = Form(0.0),
    transport_local: float = Form(0.0),
    assurance: float = Form(0.0),
    dedouanement: float = Form(0.0),
    portnet: float = Form(0.0),
    autre: float = Form(0.0),
    allocation_key: str = Form("VALUE"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lines = []
    if file and file.filename and (file.filename.lower().endswith('.xlsx') or file.filename.lower().endswith('.xls')):
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df = df.fillna('')
        lines = df.to_dict('records')
    elif lines_json:
        lines = json.loads(lines_json)
    else:
        raise HTTPException(status_code=400, detail="Must provide lines_json or valid xlsx file")

    ancillaries = {
        "transport_int": transport_int, "transport_local": transport_local, 
        "assurance": assurance, "dedouanement": dedouanement, 
        "portnet": portnet, "autre": autre
    }
    
    calculated = calculate_landed_costs(lines, exchange_rate, customs_duty_pct, ancillaries, allocation_key)
    
    import_items = []
    invoice_ref = ref_facture.strip().upper() if (ref_facture and ref_facture.strip()) else f"INV-{uuid.uuid4().hex[:8].upper()}"
    final_supplier = (supplier_name or nom_fournisseur or "").strip() or None

    for item in calculated:
        sku = str(item["sku"]).strip()
        qty = int(item["quantity"])
        new_lc = float(item["landed_cost_mad"])
        item_name = item.get("name") or item.get("designation") or sku
        
        product = db.query(Product).filter(Product.sku == sku).first()
        if not product:
            product = Product(sku=sku, name=item_name, landed_cost=new_lc, global_stock=qty, packer_stock=0)
            db.add(product)
        else:
            if item_name and (not product.name or product.name == sku):
                product.name = item_name
            total_value = (product.global_stock * product.landed_cost) + (qty * new_lc)
            new_total_stock = product.global_stock + qty
            product.landed_cost = total_value / new_total_stock if new_total_stock > 0 else 0
            product.global_stock = new_total_stock
            
        import_items.append({"sku": sku, "name": item_name, "quantity": qty, "landed_cost": new_lc})
        
        ledger_entry = StockLedger(
            product_sku=sku,
            user_id=str(current_user.id),
            action=StockActionEnum.IMPORT,
            quantity=qty
        )
        db.add(ledger_entry)
        
    shipment = InboundShipment(
        invoice_ref=invoice_ref,
        supplier_name=final_supplier,
        status=ShipmentStatusEnum.EN_ATTENTE_RECEPTION,
        items_json=import_items,
        created_at=datetime.utcnow()
    )
    db.add(shipment)
    db.commit()
    
    return {"status": "success", "invoice_ref": invoice_ref, "supplier_name": final_supplier, "items": import_items}

@router.get("/valuation")
def get_valuation(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.sku).all()
    
    shipments = db.query(InboundShipment).order_by(InboundShipment.created_at.desc()).all()
    sku_to_invoice = {}
    invoices = []
    for s in shipments:
        if s.invoice_ref and s.invoice_ref not in invoices:
            invoices.append(s.invoice_ref)
        if isinstance(s.items_json, list):
            for itm in s.items_json:
                sku = itm.get("sku")
                if sku and sku not in sku_to_invoice:
                    sku_to_invoice[sku] = s.invoice_ref
                    
    total_karime = sum(p.global_stock for p in products)
    total_packer = sum(p.packer_stock for p in products)
    total_stock = total_karime + total_packer
    total_val = sum((p.landed_cost * (p.global_stock + p.packer_stock)) for p in products)
    avg_cost = (total_val / total_stock) if total_stock > 0 else 0.0
    orders_count = db.query(Order).count()
    
    inventory_data = []
    for p in products:
        p_dict = {
            "sku": p.sku,
            "name": p.name,
            "global_stock": p.global_stock,
            "packer_stock": p.packer_stock,
            "landed_cost": round(p.landed_cost, 2),
            "last_invoice_ref": sku_to_invoice.get(p.sku, "STOCK-INITIAL")
        }
        inventory_data.append(p_dict)
        
    return {
        "kpis": {
            "total_valuation_mad": round(total_val, 2),
            "total_global_stock": total_stock,
            "karime_stock": total_karime,
            "packer_stock": total_packer,
            "avg_unit_cost": round(avg_cost, 2),
            "orders_today_count": orders_count,
            "last_sync": datetime.utcnow().strftime("%H:%M:%S")
        },
        "invoices": invoices,
        "inventory": inventory_data
    }

@router.get("/discrepancies", response_model=List[DiscrepancyOut])
def list_discrepancies(db: Session = Depends(get_db)):
    return db.query(Discrepancy).all()

@router.put("/discrepancies/{id}/resolve")
def resolve_discrepancy(id: str, action: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    disc = db.query(Discrepancy).filter(Discrepancy.id == id).first()
    if not disc:
        raise HTTPException(status_code=404)
        
    if disc.status != DiscrepancyStatusEnum.PENDING_APPROVAL:
        raise HTTPException(status_code=400, detail="Already resolved")
        
    if action == "APPROVE":
        product = db.query(Product).filter(Product.sku == disc.product_sku).first()
        if product:
            product.global_stock -= disc.quantity_missing
            ledger = StockLedger(
                product_sku=disc.product_sku,
                user_id=str(current_user.id),
                action=StockActionEnum.DISCREPANCY_APPROVED,
                quantity=-disc.quantity_missing
            )
            db.add(ledger)
        disc.status = DiscrepancyStatusEnum.APPROVED
    else:
        disc.status = DiscrepancyStatusEnum.REJECTED
        
    db.commit()
    return {"status": "success", "discrepancy_status": disc.status}

@router.get("/invoices")
def list_invoices(db: Session = Depends(get_db)):
    shipments = db.query(InboundShipment).order_by(InboundShipment.created_at.desc()).all()
    result = []
    for s in shipments:
        items = s.items_json if isinstance(s.items_json, list) else []
        total_qty = sum(int(i.get("quantity", 0)) for i in items)
        total_mad = sum(int(i.get("quantity", 0)) * float(i.get("landed_cost", 0.0)) for i in items)
        status_str = s.status.value if hasattr(s.status, "value") else str(s.status)
        result.append({
            "id": str(s.id),
            "invoice_ref": s.invoice_ref,
            "supplier_name": s.supplier_name or "Fournisseur non spécifié",
            "status": status_str,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "total_skus": len(items),
            "total_quantity": total_qty,
            "total_amount_mad": round(total_mad, 2),
            "items": items
        })
    return result

@router.delete("/invoices/{id}")
def delete_invoice(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    shipment = db.query(InboundShipment).filter(InboundShipment.id == id).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Facture introuvable")

    items = shipment.items_json if isinstance(shipment.items_json, list) else []
    reverted_items = []
    total_deducted = 0

    for item in items:
        sku = item.get("sku")
        qty = int(item.get("quantity", 0))
        if not sku or qty <= 0:
            continue

        product = db.query(Product).filter(Product.sku == sku).first()
        if product:
            # Automatically remove added quantity from stock
            product.global_stock = max(0, product.global_stock - qty)
            
            # Log reversal in StockLedger
            ledger_entry = StockLedger(
                product_sku=sku,
                user_id=str(current_user.id),
                action=StockActionEnum.IMPORT,
                quantity=-qty
            )
            db.add(ledger_entry)
            reverted_items.append({"sku": sku, "deducted_qty": qty, "remaining_stock": product.global_stock})
            total_deducted += qty

    invoice_ref = shipment.invoice_ref
    db.delete(shipment)
    db.commit()

    return {
        "status": "success",
        "message": f"Facture {invoice_ref} supprimée avec succès. {total_deducted} unités ont été retirées du stock.",
        "deleted_invoice_ref": invoice_ref,
        "total_deducted": total_deducted,
        "reverted_items": reverted_items
    }

@router.get("/returns")
def list_returns(db: Session = Depends(get_db)):
    returns = db.query(ProductReturn).order_by(ProductReturn.created_at.desc()).all()
    result = []
    for r in returns:
        prod = db.query(Product).filter(Product.sku == r.product_sku).first()
        user = db.query(User).filter(User.id == r.reported_by).first()
        result.append({
            "id": str(r.id),
            "product_sku": r.product_sku,
            "product_name": prod.name if prod else r.product_sku,
            "quantity": r.quantity,
            "condition": r.condition,
            "action": r.action,
            "tracking_number": r.tracking_number,
            "reason": r.reason,
            "reported_by": str(r.reported_by),
            "reported_by_username": user.username if user else "karime",
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return result

@router.get("/ledger")
def get_stock_ledger(db: Session = Depends(get_db), sku: Optional[str] = None, action: Optional[str] = None):
    q = db.query(StockLedger).order_by(StockLedger.created_at.desc())
    if sku:
        q = q.filter(StockLedger.product_sku == sku)
    if action and action != "ALL":
        q = q.filter(StockLedger.action == action)
    entries = q.all()

    products = {p.sku: p.name for p in db.query(Product).all()}
    users = {str(u.id): u.username for u in db.query(User).all()}

    result = []
    for e in entries:
        prod_name = products.get(e.product_sku, e.product_sku)
        username = users.get(str(e.user_id), "Système")
        action_val = e.action.value if hasattr(e.action, "value") else str(e.action)
        result.append({
            "id": str(e.id),
            "sku": e.product_sku,
            "product_sku": e.product_sku,
            "product_name": prod_name,
            "user_id": str(e.user_id),
            "username": username,
            "action": action_val,
            "quantity": e.quantity,
            "created_at": e.created_at.isoformat() if e.created_at else None
        })
    return result

