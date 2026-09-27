import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.database import SessionLocal
from backend.app.services.matchmaker import sync_b2c_orders

client = TestClient(app)

def run_e2e_tests():
    print("Running Phase C E2E Verification Tests...\n")
    
    # Login users
    tokens = {}
    for user in ["othmane", "karime", "packer", "mehdi"]:
        resp = client.post("/api/auth/login", json={"username": user, "password": "nyrix2026"})
        tokens[user] = resp.json()["access_token"]
        
    h_admin = {"Authorization": f"Bearer {tokens['othmane']}"}
    h_wh = {"Authorization": f"Bearer {tokens['karime']}"}
    h_packer = {"Authorization": f"Bearer {tokens['packer']}"}
    h_b2b = {"Authorization": f"Bearer {tokens['mehdi']}"}

    # 1. Admin imports stock
    lines = [
        {"sku": "AW-01", "quantity": 100, "unit_price_usd": 10.0, "weight_kg": 0.5},
        {"sku": "WL-CUIR-001", "quantity": 50, "unit_price_usd": 15.0, "weight_kg": 0.3}
    ]
    data = {
        "lines_json": json.dumps(lines),
        "exchange_rate": "10.0",
        "customs_duty_pct": "5.0",
        "transport_int": "100.0",
        "transport_local": "50.0",
        "assurance": "20.0",
        "dedouanement": "30.0",
        "portnet": "0.0",
        "autre": "0.0",
        "allocation_key": "QUANTITY"
    }
    r = client.post("/api/finance/import", data=data, headers=h_admin)
    assert r.status_code == 200, f"Import failed: {r.text}"
    res = r.json()
    invoice_ref = res["invoice_ref"]
    print(f"1. Success: Admin imported stock. Invoice: {invoice_ref}")

    # 2. Warehouse verifies inbound
    r = client.get("/api/warehouse/inbound", headers=h_wh)
    shipments = r.json()
    assert len(shipments) > 0
    shipment_id = shipments[0]["id"]
    
    r = client.put(f"/api/warehouse/inbound/{shipment_id}/verify", headers=h_wh)
    assert r.status_code == 200
    print("2. Success: Warehouse verified inbound shipment.")

    # 3. Warehouse creates transfer to Packer
    db = SessionLocal()
    packer_user = db.execute(text("SELECT id FROM users WHERE username='packer'")).scalar()
    db.close()
    
    r = client.post("/api/warehouse/transfers", json={
        "product_sku": "AW-01",
        "quantity": 20,
        "to_user_id": str(packer_user)
    }, headers=h_wh)
    assert r.status_code == 200, f"Transfer creation failed: {r.text}"
    transfer_id = r.json()["id"]
    print(f"3. Success: Warehouse created transfer {transfer_id} (PENDING_ACCEPT).")

    # 4. Packer accepts transfer
    r = client.put(f"/api/packer/transfers/{transfer_id}/accept", headers=h_packer)
    assert r.status_code == 200, f"Accept transfer failed: {r.text}"
    
    # Verify double tap prevention
    r_double = client.put(f"/api/packer/transfers/{transfer_id}/accept", headers=h_packer)
    assert r_double.status_code == 400
    print("4. Success: Packer accepted transfer (atomic swap) and double-tap blocked.")

    # 5. Mehdi B2B creates wholesale order & Matchmaker simulates B2C
    r = client.post("/api/b2b/orders", json={
        "client_name": "B2B Client X",
        "city": "Rabat",
        "items": [
            {"product_sku": "AW-01", "quantity": 10, "unit_price": 250.0}
        ]
    }, headers=h_b2b)
    assert r.status_code == 200, f"B2B Order failed: {r.text}"
    b2b_tracking = r.json()["tracking_number"]
    
    db = SessionLocal()
    b2c_sim = sync_b2c_orders(db, simulate=True)
    b2c_tracking = b2c_sim["tracking_number"]
    db.close()
    print(f"5. Success: B2B Order {b2b_tracking} & B2C Order {b2c_tracking} created.")

    # 6. Packer packs orders
    for t in [b2b_tracking, b2c_tracking]:
        r = client.put(f"/api/packer/orders/{t}/pack", headers=h_packer)
        assert r.status_code == 200, f"Pack failed for {t}: {r.text}"
        
        # Verify double tap
        r_d = client.put(f"/api/packer/orders/{t}/pack", headers=h_packer)
        assert r_d.status_code == 400
    print("6. Success: Packer packed both orders and double-tap blocked.")

    # 7. Warehouse logs COD & Discrepancy
    client.post("/api/warehouse/cod", json={"driver_ref": "DRV-1", "amount_mad": 500}, headers=h_wh)
    client.post("/api/warehouse/discrepancies", json={"product_sku": "AW-01", "quantity_missing": 2, "reason": "TESTS"}, headers=h_wh)
    print("7. Success: Warehouse logged COD cash & discrepancy.")

    # 8. Admin approves discrepancy
    r = client.get("/api/finance/discrepancies", headers=h_admin)
    discrepancies = r.json()
    disc_id = discrepancies[-1]["id"]
    r = client.put(f"/api/finance/discrepancies/{disc_id}/resolve?action=APPROVE", headers=h_admin)
    assert r.status_code == 200
    print("8. Success: Admin approved discrepancy.")

    print("\nPhase C E2E Verification Passed Successfully!")

if __name__ == "__main__":
    run_e2e_tests()
