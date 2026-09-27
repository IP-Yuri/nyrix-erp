from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Optional
import json
import uuid

from backend.app.core.database import get_db
from backend.app.core.dependencies import require_role, get_current_user
from backend.app.models.models import User, Product, StockLedger, InboundShipment, Discrepancy
from backend.app.models.models import StockActionEnum, ShipmentStatusEnum, DiscrepancyStatusEnum
from backend.app.schemas.schemas import ProductAdminOut, DiscrepancyOut
from backend.app.services.landed_cost import calculate_landed_costs
import pandas as pd
import io

router = APIRouter(prefix="/api/finance", tags=["finance"], dependencies=[Depends(require_role(["ADMIN"]))])

@router.post("/import")
async def import_stock(
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
    if lines_json:
        lines = json.loads(lines_json)
    elif file and file.filename.endswith('.xlsx'):
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        lines = df.to_dict('records')
    else:
        raise HTTPException(status_code=400, detail="Must provide lines_json or valid xlsx file")

    ancillaries = {
        "transport_int": transport_int, "transport_local": transport_local, 
        "assurance": assurance, "dedouanement": dedouanement, 
        "portnet": portnet, "autre": autre
    }
    
    calculated = calculate_landed_costs(lines, exchange_rate, customs_duty_pct, ancillaries, allocation_key)
    
    import_items = []
    
    for item in calculated:
        sku = item["sku"]
        qty = item["quantity"]
        new_lc = item["landed_cost_mad"]
        
        product = db.query(Product).filter(Product.sku == sku).first()
        if not product:
            product = Product(sku=sku, name=item.get("name", sku), landed_cost=new_lc, global_stock=qty, packer_stock=0)
            db.add(product)
        else:
            total_value = (product.global_stock * product.landed_cost) + (qty * new_lc)
            new_total_stock = product.global_stock + qty
            product.landed_cost = total_value / new_total_stock if new_total_stock > 0 else 0
            product.global_stock = new_total_stock
            
        import_items.append({"sku": sku, "quantity": qty, "landed_cost": new_lc})
        
        ledger_entry = StockLedger(
            product_sku=sku,
            user_id=str(current_user.id),
            action=StockActionEnum.IMPORT,
            quantity=qty
        )
        db.add(ledger_entry)
        
    invoice_ref = f"INV-{uuid.uuid4().hex[:8].upper()}"
    shipment = InboundShipment(
        invoice_ref=invoice_ref,
        status=ShipmentStatusEnum.EN_ATTENTE_RECEPTION,
        items_json=import_items
    )
    db.add(shipment)
    db.commit()
    
    return {"status": "success", "invoice_ref": invoice_ref, "items": import_items}

@router.get("/valuation")
def get_valuation(db: Session = Depends(get_db)):
    products = db.query(Product).all()
    total_val = sum((p.global_stock * p.landed_cost) for p in products)
    total_stock = sum(p.global_stock for p in products)
    
    return {
        "kpis": {
            "total_valuation_mad": total_val,
            "total_global_stock": total_stock,
            "orders_today_count": 0
        },
        "inventory": [ProductAdminOut.model_validate(p) for p in products]
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
