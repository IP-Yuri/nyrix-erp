import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def run_test():
    print("=== 1. Login as Othmane ===")
    r_admin = client.post("/api/auth/login", json={"username": "othmane", "password": "nyrix2026"}).json()
    h_admin = {"Authorization": f"Bearer {r_admin['access_token']}"}

    print("=== 2. Check initial stock of AW-01 ===")
    init_val = client.get("/api/finance/valuation", headers=h_admin).json()
    aw01_init = next(p for p in init_val["inventory"] if p["sku"] == "AW-01")["global_stock"]
    print(f"Initial AW-01 stock: {aw01_init}")

    print("=== 3. Othmane imports a new Facture ===")
    inv_data = {
        "ref_facture": "FAC-ATLAS-99",
        "nom_fournisseur": "Atlas Global SARL",
        "lines_json": json.dumps([{"sku": "AW-01", "quantity": 15, "unit_price_usd": 12.0, "weight_kg": 0.4}]),
        "exchange_rate": "10.0",
        "customs_duty_pct": "5.0",
        "allocation_key": "QUANTITY"
    }
    r_imp = client.post("/api/finance/import", data=inv_data, headers=h_admin)
    assert r_imp.status_code == 200, f"Import failed: {r_imp.text}"
    print("Import response:", r_imp.json()["invoice_ref"], r_imp.json()["supplier_name"])

    print("=== 4. Verify stock increased by 15 ===")
    after_imp_val = client.get("/api/finance/valuation", headers=h_admin).json()
    aw01_after_imp = next(p for p in after_imp_val["inventory"] if p["sku"] == "AW-01")["global_stock"]
    print(f"Stock after import: {aw01_after_imp}")
    assert aw01_after_imp == aw01_init + 15, "Stock did not increase by 15!"

    print("=== 5. Verify Facture in GET /api/finance/invoices ===")
    invoices = client.get("/api/finance/invoices", headers=h_admin).json()
    found_inv = next((i for i in invoices if i["invoice_ref"] == "FAC-ATLAS-99"), None)
    assert found_inv is not None, "Invoice not found in list!"
    print(f"Found Invoice: Ref={found_inv['invoice_ref']}, Supplier={found_inv['supplier_name']}, CreatedAt={found_inv['created_at']}, Qty={found_inv['total_quantity']}, MAD={found_inv['total_amount_mad']}")
    assert found_inv["supplier_name"] == "Atlas Global SARL"
    assert found_inv["created_at"] is not None

    print("=== 6. Login as Karime & Log Retours ===")
    r_wh = client.post("/api/auth/login", json={"username": "karime", "password": "nyrix2026"}).json()
    h_wh = {"Authorization": f"Bearer {r_wh['access_token']}"}

    ret1 = client.post("/api/warehouse/returns", json={
        "product_sku": "WL-RFID-089",
        "quantity": 8,
        "is_damaged": False,
        "tracking_number": "TRK-RET-101",
        "reason": "Client absent - Colis intact"
    }, headers=h_wh)
    assert ret1.status_code == 200, f"Return 1 failed: {ret1.text}"

    ret2 = client.post("/api/warehouse/returns", json={
        "product_sku": "WL-CUIR-001",
        "quantity": 3,
        "is_damaged": True,
        "tracking_number": "TRK-RET-102",
        "reason": "Emballage écrase au transport"
    }, headers=h_wh)
    assert ret2.status_code == 200, f"Return 2 failed: {ret2.text}"
    print("Karime logged 2 returns successfully.")

    print("=== 7. Othmane inspects Retours in GET /api/finance/returns ===")
    returns = client.get("/api/finance/returns", headers=h_admin).json()
    print(f"Total returns returned for admin: {len(returns)}")
    r1 = next(r for r in returns if r["tracking_number"] == "TRK-RET-101")
    r2 = next(r for r in returns if r["tracking_number"] == "TRK-RET-102")
    print(f"Return 1: SKU={r1['product_sku']}, Name={r1['product_name']}, Qty={r1['quantity']}, Cond={r1['condition']}, Action={r1['action']}, By={r1['reported_by_username']}, Date={r1['created_at']}")
    print(f"Return 2: SKU={r2['product_sku']}, Name={r2['product_name']}, Qty={r2['quantity']}, Cond={r2['condition']}, Action={r2['action']}, By={r2['reported_by_username']}, Date={r2['created_at']}")
    assert r1["condition"] == "INTACT" and r1["action"] == "RETURN_RESTORED"
    assert r2["condition"] == "DAMAGED" and r2["action"] == "QUARANTINE"

    print("=== 8. Othmane deletes the Facture by mistake ===")
    inv_id = found_inv["id"]
    r_del = client.delete(f"/api/finance/invoices/{inv_id}", headers=h_admin)
    assert r_del.status_code == 200, f"Delete failed: {r_del.text}"
    print("Delete response:", r_del.json())

    print("=== 9. Verify Stock is automatically deducted back ===")
    after_del_val = client.get("/api/finance/valuation", headers=h_admin).json()
    aw01_after_del = next(p for p in after_del_val["inventory"] if p["sku"] == "AW-01")["global_stock"]
    print(f"Stock after deletion: {aw01_after_del} (matches {aw01_init})")
    assert aw01_after_del == aw01_init, "Stock was not reverted to initial count!"

    print("=== 10. Verify Facture is removed from list ===")
    invoices_after = client.get("/api/finance/invoices", headers=h_admin).json()
    assert not any(i["id"] == inv_id for i in invoices_after), "Invoice still exists in invoices list!"

    print("\nALL 10 VERIFICATION STEPS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_test()
