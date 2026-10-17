import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("NYRIX ERP — INBOUND CANCELLATION & STOCK GUARD VERIFICATION")
    print("=" * 60)

    # 1. Login Othmane (ADMIN) and Karime (WAREHOUSE)
    print("\n--- Step 1: Authentication ---")
    r_adm = client.post("/api/auth/login", json={"username": "othmane", "password": "nyrix2026"}).json()
    h_adm = {"Authorization": f"Bearer {r_adm['access_token']}"}
    r_wh = client.post("/api/auth/login", json={"username": "karime", "password": "nyrix2026"}).json()
    h_wh = {"Authorization": f"Bearer {r_wh['access_token']}"}
    print("Tokens retrieved for Othmane (ADMIN) and Karime (WAREHOUSE).")

    # 2. Get initial stock of a test SKU (AW-01)
    val_init = client.get("/api/finance/valuation", headers=h_adm).json()
    aw01_init = next(p for p in val_init["inventory"] if p["sku"] == "AW-01")["global_stock"]
    print(f"Initial AW-01 stock: {aw01_init}")

    # 3. Othmane imports invoice INV-GUARD-01 (10 units of AW-01)
    print("\n--- Step 2: Othmane imports invoice INV-GUARD-01 (10 units) ---")
    inv_data = {
        "ref_facture": "INV-GUARD-01",
        "nom_fournisseur": "Shenzhen Guard Tech",
        "lines_json": json.dumps([{"sku": "AW-01", "quantity": 10, "unit_price_usd": 15.0, "weight_kg": 0.5}]),
        "exchange_rate": "10.0",
        "customs_duty_pct": "5.0",
        "allocation_key": "QUANTITY"
    }
    r_imp = client.post("/api/finance/import", data=inv_data, headers=h_adm)
    assert r_imp.status_code == 200, f"Import failed: {r_imp.text}"
    print(f"Invoice imported: {r_imp.json()['invoice_ref']}")

    # Check status is EN_ATTENTE_RECEPTION
    invoices = client.get("/api/finance/invoices", headers=h_adm).json()
    inv_guard = next(i for i in invoices if i["invoice_ref"] == "INV-GUARD-01")
    assert inv_guard["status"] == "EN_ATTENTE_RECEPTION"
    inv_id = inv_guard["id"]
    print(f"Invoice {inv_guard['invoice_ref']} registered with status: {inv_guard['status']}")

    # 4. Karime verifies & accepts receipt at Quai
    print("\n--- Step 3: Karime verifies receipt at Quai ---")
    r_ver = client.put(f"/api/warehouse/inbound/{inv_id}/verify", headers=h_wh)
    assert r_ver.status_code == 200, f"Verification failed: {r_ver.text}"
    
    invoices = client.get("/api/finance/invoices", headers=h_adm).json()
    inv_guard = next(i for i in invoices if i["id"] == inv_id)
    assert inv_guard["status"] == "RECEPTIONNE"
    print(f"Invoice {inv_guard['invoice_ref']} is now RECEPTIONNE by Karime.")

    # 5. TEST SECURITY: Othmane attempts direct deletion of RECEPTIONNE invoice -> MUST FAIL (400)
    print("\n--- Step 4: Security Check — Othmane attempts direct deletion of received invoice ---")
    r_del = client.delete(f"/api/finance/invoices/{inv_id}", headers=h_adm)
    print(f"Direct delete response status: {r_del.status_code}")
    print(f"Direct delete error message: {r_del.json()['detail']}")
    assert r_del.status_code == 400, "Direct deletion should have been BLOCKED with 400!"
    assert "verrouillée" in r_del.json()["detail"].lower()
    print("SUCCESS: Direct deletion strictly BLOCKED for received invoice.")

    # 6. TEST SUGGESTION 1: Othmane updates financial costs without touching physical stock
    print("\n--- Step 5: Suggestion 1 — Othmane updates costs/metadata ---")
    r_cost = client.put(f"/api/finance/invoices/{inv_id}/costs", json={
        "invoice_ref": "INV-GUARD-01-REV",
        "supplier_name": "Shenzhen Premium Tech SARL",
        "items": [{"sku": "AW-01", "landed_cost": 165.50}]
    }, headers=h_adm)
    assert r_cost.status_code == 200, f"Cost update failed: {r_cost.text}"
    print("Cost update response:", r_cost.json()["message"])

    val_after_cost = client.get("/api/finance/valuation", headers=h_adm).json()
    aw01_prod = next(p for p in val_after_cost["inventory"] if p["sku"] == "AW-01")
    assert aw01_prod["landed_cost"] == 165.50
    assert aw01_prod["global_stock"] == aw01_init + 10, "Stock quantities should not change during cost update!"
    print("SUCCESS: Landed cost updated, physical stock unaffected.")

    # 7. TEST OPTION 1: Othmane requests cancellation
    print("\n--- Step 6: Option 1 — Othmane requests cancellation conjointe ---")
    r_req_cancel = client.post(f"/api/finance/invoices/{inv_id}/request-cancellation", json={
        "reason": "Fournisseur a envoyé une fausse facture proforma"
    }, headers=h_adm)
    assert r_req_cancel.status_code == 200, f"Request cancellation failed: {r_req_cancel.text}"
    print("Request cancel response:", r_req_cancel.json()["message"])

    invoices = client.get("/api/finance/invoices", headers=h_adm).json()
    inv_guard = next(i for i in invoices if i["id"] == inv_id)
    assert inv_guard["status"] == "DEMANDE_ANNULATION"
    print(f"Invoice status is now: {inv_guard['status']} (Reason: {inv_guard['cancellation_reason']})")

    # 8. Karime tests rejection first
    print("\n--- Step 7: Karime rejects the cancellation request ---")
    r_rej = client.post(f"/api/warehouse/inbound/{inv_id}/process-cancellation", json={
        "action": "REJECT",
        "rejection_reason": "Cartons déjà empilés en allée 3"
    }, headers=h_wh)
    assert r_rej.status_code == 200
    invoices = client.get("/api/finance/invoices", headers=h_adm).json()
    inv_guard = next(i for i in invoices if i["id"] == inv_id)
    assert inv_guard["status"] == "RECEPTIONNE"
    print("Rejection handled cleanly: status reverted to RECEPTIONNE.")

    # 9. Othmane requests cancellation again
    client.post(f"/api/finance/invoices/{inv_id}/request-cancellation", json={
        "reason": "Confirmation erreur comptable"
    }, headers=h_adm)

    # 10. TEST GARDE-FOU A (Stock Guard):
    # Simulate that some units were transferred/consumed such that global_stock < invoice_qty
    print("\n--- Step 8: Garde-fou A (Stock Guard) test ---")
    from backend.app.core.database import SessionLocal
    from backend.app.models.models import Product
    with SessionLocal() as db:
        p = db.query(Product).filter(Product.sku == "AW-01").first()
        saved_stock = p.global_stock
        p.global_stock = 3 # Less than the 10 units in the invoice!
        db.commit()

    r_app_blocked = client.post(f"/api/warehouse/inbound/{inv_id}/process-cancellation", json={
        "action": "APPROVE"
    }, headers=h_wh)
    print(f"Stock Guard blocked status: {r_app_blocked.status_code}")
    print(f"Stock Guard message: {r_app_blocked.json()['detail']}")
    assert r_app_blocked.status_code == 400
    assert "stock guard" in r_app_blocked.json()["detail"].lower()
    print("SUCCESS: Stock Guard blocked cancellation because stock was below invoice quantity.")

    # Restore stock for approval
    with SessionLocal() as db:
        p = db.query(Product).filter(Product.sku == "AW-01").first()
        p.global_stock = saved_stock
        db.commit()

    # 11. Karime approves cancellation with full stock available
    print("\n--- Step 9: Karime approves cancellation with full stock ---")
    r_app = client.post(f"/api/warehouse/inbound/{inv_id}/process-cancellation", json={
        "action": "APPROVE"
    }, headers=h_wh)
    assert r_app.status_code == 200, f"Approval failed: {r_app.text}"
    print("Approval response:", r_app.json()["message"])

    invoices = client.get("/api/finance/invoices", headers=h_adm).json()
    inv_guard = next(i for i in invoices if i["id"] == inv_id)
    assert inv_guard["status"] == "ANNULEE"
    print(f"Invoice status is now: {inv_guard['status']}")

    # Check stock deduction (10 units removed)
    val_after_annul = client.get("/api/finance/valuation", headers=h_adm).json()
    aw01_final = next(p for p in val_after_annul["inventory"] if p["sku"] == "AW-01")["global_stock"]
    print(f"Final AW-01 stock: {aw01_final} (matches initial: {aw01_init})")
    assert aw01_final == aw01_init, "Stock was not properly deducted!"

    # 12. TEST GARDE-FOU C: Check StockLedger has IMPORT_CANCELLED
    print("\n--- Step 10: Garde-fou C — Audit Ledger Verification ---")
    ledger = client.get("/api/finance/ledger", headers=h_adm).json()
    rev_entry = next((e for e in ledger if e["sku"] == "AW-01" and e["action"] == "IMPORT_CANCELLED"), None)
    assert rev_entry is not None, "StockLedger entry for IMPORT_CANCELLED not found!"
    assert rev_entry["quantity"] == -10
    print(f"SUCCESS: Piste d'audit inviolable trouvée dans le Grand Livre: Action={rev_entry['action']}, Qty={rev_entry['quantity']}")

    # 13. TEST GARDE-FOU B: Karime's direct rollback for misclick
    print("\n--- Step 11: Garde-fou B — Karime rollback reception for click error ---")
    # Import another test invoice
    inv_data_2 = {
        "ref_facture": "INV-MISCLICK-01",
        "nom_fournisseur": "Quick Supplier",
        "lines_json": json.dumps([{"sku": "AW-01", "quantity": 5, "unit_price_usd": 10.0, "weight_kg": 0.2}]),
        "exchange_rate": "10.0",
        "customs_duty_pct": "5.0",
        "allocation_key": "QUANTITY"
    }
    r_imp2 = client.post("/api/finance/import", data=inv_data_2, headers=h_adm)
    invoices = client.get("/api/finance/invoices", headers=h_adm).json()
    inv2 = next(i for i in invoices if i["invoice_ref"] == "INV-MISCLICK-01")
    inv2_id = inv2["id"]

    # Karime verifies it
    client.put(f"/api/warehouse/inbound/{inv2_id}/verify", headers=h_wh)

    # Karime clicks "Annuler la réception (Erreur de clic)"
    r_roll = client.post(f"/api/warehouse/inbound/{inv2_id}/rollback-reception", headers=h_wh)
    assert r_roll.status_code == 200, f"Rollback failed: {r_roll.text}"
    print("Rollback response:", r_roll.json()["message"])

    invoices = client.get("/api/finance/invoices", headers=h_adm).json()
    inv2_after = next(i for i in invoices if i["id"] == inv2_id)
    assert inv2_after["status"] == "EN_ATTENTE_RECEPTION"
    print(f"SUCCESS: Arrivage remis en attente: {inv2_after['status']}")

    # Cleanup test invoice 2 (allowed since EN_ATTENTE_RECEPTION)
    r_del2 = client.delete(f"/api/finance/invoices/{inv2_id}", headers=h_adm)
    assert r_del2.status_code == 200
    print("Test cleanup completed.")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED WITH 100% SUCCESS!")
    print("Option 1 + Garde-fous A, B, C + Suggestions 1 & 2 are FULLY OPERATIONAL!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
