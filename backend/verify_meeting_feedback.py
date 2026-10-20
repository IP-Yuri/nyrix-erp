import os
import sys

# Ensure root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import SessionLocal
from backend.app.models.models import (
    User, Product, Order, OrderItem, InboundShipment, Discrepancy, StockLedger,
    RoleEnum, OrderTypeEnum, OrderStatusEnum, PaymentMethodEnum, PaymentStatusEnum,
    StockActionEnum, ShipmentStatusEnum, DiscrepancyReasonEnum, DiscrepancyStatusEnum
)
from backend.app.services.inventory_service import deduct_order_stock_if_needed
from backend.app.api.routes_finance import get_valuation, resolve_discrepancy
from backend.app.api.routes_warehouse import get_warehouse_stock, process_cancellation, ProcessCancellationReq
from backend.app.api.routes_digylog import get_live_tracking

def test_meeting_feedback_fixes():
    db = SessionLocal()
    print("==================================================")
    print("[TEST] RUNNING E2E VERIFICATION OF MEETING FEEDBACK FIXES")
    print("==================================================")

    try:
        # 1. Test Karime stock-summary (Item 5)
        print("\n[TEST 1] Testing Karime read-only stock-summary endpoint...")
        stock_summary = get_warehouse_stock(db)
        assert len(stock_summary) > 0, "Stock summary should return products"
        first_prod = stock_summary[0]
        assert "sku" in first_prod and "name" in first_prod, "Should have sku and name"
        assert "global_stock" in first_prod and "packer_stock" in first_prod, "Should have physical quantities"
        assert "landed_cost" not in first_prod, "CONFIDENTIALITY: landed_cost must NOT be in stock-summary!"
        print(f"  [OK] Karime Stock Summary OK: {len(stock_summary)} SKUs returned, costs safely hidden.")

        # 2. Test Valuation Today Orders (Item 1)
        print("\n[TEST 2] Testing Othmane valuation orders of today...")
        val = get_valuation(db)
        kpis = val["kpis"]
        assert "orders_today_count" in kpis, "orders_today_count must exist"
        assert "orders_pending_count" in kpis, "orders_pending_count must exist"
        assert "orders_shipped_count" in kpis, "orders_shipped_count must exist"
        assert "total_orders_count" in kpis, "total_orders_count must exist"
        print(f"  [OK] Valuation KPIs OK: today={kpis['orders_today_count']}, pending={kpis['orders_pending_count']}, shipped={kpis['orders_shipped_count']}, total={kpis['total_orders_count']}")

        # 3. Test Discrepancy Rejection saved in Ledger (Item 2)
        print("\n[TEST 3] Testing Discrepancy Rejection saved in StockLedger...")
        othmane = db.query(User).filter(User.username == "othmane").first()
        prod = db.query(Product).first()
        
        test_disc = Discrepancy(
            product_sku=prod.sku,
            quantity_missing=3,
            reason=DiscrepancyReasonEnum.TESTS,
            status=DiscrepancyStatusEnum.PENDING_APPROVAL,
            reported_by=str(othmane.id)
        )
        db.add(test_disc)
        db.commit()
        db.refresh(test_disc)

        resolve_res = resolve_discrepancy(id=test_disc.id, action="REJECT", db=db, current_user=othmane)
        assert resolve_res["discrepancy_status"] == DiscrepancyStatusEnum.REJECTED
        
        # Check ledger
        disc_ledger = db.query(StockLedger).filter(
            StockLedger.product_sku == prod.sku,
            StockLedger.action == StockActionEnum.DISCREPANCY_REJECTED
        ).first()
        assert disc_ledger is not None, "DISCREPANCY_REJECTED entry must be saved in StockLedger!"
        assert disc_ledger.quantity == 0, "Audit rejection entry has quantity 0"
        print(f"  [OK] Discrepancy Rejection successfully logged in StockLedger: ID={disc_ledger.id}, Action={disc_ledger.action.value}")

        # 4. Test Inbound Cancellation Rejection saved in Ledger (Item 2)
        print("\n[TEST 4] Testing Inbound Cancellation Rejection saved in StockLedger...")
        karime = db.query(User).filter(User.username == "karime").first()
        test_shipment = InboundShipment(
            invoice_ref="TEST-REJECT-INV",
            supplier_name="Test Supplier",
            status=ShipmentStatusEnum.DEMANDE_ANNULATION,
            items_json=[{"sku": prod.sku, "quantity": 10}]
        )
        db.add(test_shipment)
        db.commit()
        db.refresh(test_shipment)

        cancel_req = ProcessCancellationReq(action="REJECT", rejection_reason="Marchandise déjà rangée en rayon")
        cancel_res = process_cancellation(id=test_shipment.id, req=cancel_req, db=db, current_user=karime)
        assert cancel_res["action"] == "REJECTED"

        cancel_ledger = db.query(StockLedger).filter(
            StockLedger.product_sku == prod.sku,
            StockLedger.action == StockActionEnum.CANCELLATION_REJECTED
        ).first()
        assert cancel_ledger is not None, "CANCELLATION_REJECTED entry must be saved in StockLedger!"
        print(f"  [OK] Cancellation Rejection successfully logged in StockLedger: ID={cancel_ledger.id}, Action={cancel_ledger.action.value}")

        # 5. Test Stock Deduction on Shipped Orders & Idempotency (Items 4 & 6)
        print("\n[TEST 5] Testing Stock Deduction on SHIPPED orders & Idempotency...")
        # Give prod some stock
        initial_stock = prod.global_stock
        prod.global_stock += 20
        db.commit()

        test_order_trk = "TEST-SHIP-DEDUCT-01"
        db.query(OrderItem).filter(OrderItem.tracking_number == test_order_trk).delete()
        existing_test = db.query(Order).filter(Order.tracking_number == test_order_trk).first()
        if existing_test:
            db.delete(existing_test)
        db.commit()

        test_order = Order(
            tracking_number=test_order_trk,
            type=OrderTypeEnum.B2C,
            client_name="Test Client",
            city="Rabat",
            status=OrderStatusEnum.SHIPPED,
            payment_method=PaymentMethodEnum.COD,
            payment_status=PaymentStatusEnum.UNPAID,
            stock_deducted=False
        )
        db.add(test_order)
        test_item = OrderItem(
            tracking_number=test_order_trk,
            product_sku=prod.sku,
            quantity=5,
            unit_price=200.0
        )
        db.add(test_item)
        db.commit()
        db.refresh(test_order)

        stock_before = prod.global_stock + prod.packer_stock
        # First deduction call
        deducted = deduct_order_stock_if_needed(db, test_order, "test-runner")
        db.commit()
        db.refresh(prod)
        db.refresh(test_order)

        assert deducted == True, "Should deduct stock for undeducted SHIPPED order"
        assert test_order.stock_deducted == True, "order.stock_deducted should now be True"
        stock_after = prod.global_stock + prod.packer_stock
        assert stock_after == stock_before - 5, f"Stock should decrease by 5. Before: {stock_before}, After: {stock_after}"

        # Second deduction call (test idempotency - NO double deduction!)
        second_deducted = deduct_order_stock_if_needed(db, test_order, "test-runner")
        db.commit()
        db.refresh(prod)
        assert second_deducted == False, "Second call must return False (NO double deduction)!"
        assert prod.global_stock + prod.packer_stock == stock_after, "Stock must remain unchanged on duplicate trigger!"
        print(f"  [OK] Shipped Stock Deduction & Idempotency verified cleanly: Initial={stock_before}, After={stock_after}, Double-deduction prevented.")

        # 6. Test Product Name on Order Tracking Click (Item 7)
        print("\n[TEST 6] Testing Product Name in Tracking endpoint (Item 7)...")
        track_res = get_live_tracking(tracking_number=test_order_trk, db=db, current_user=othmane)
        assert "items" in track_res, "Tracking result must include items list"
        assert len(track_res["items"]) > 0, "Items list should not be empty"
        first_item = track_res["items"][0]
        assert "name" in first_item and first_item["name"] == prod.name, f"Expected item name '{prod.name}', got '{first_item.get('name')}'"
        assert "quantity" in first_item and first_item["quantity"] == 5
        print(f"  [OK] Live Tracking Items OK: SKU={first_item['sku']}, Name='{first_item['name']}', Qty={first_item['quantity']}")

        # Cleanup test records
        db.delete(test_item)
        db.delete(test_order)
        db.delete(test_disc)
        db.delete(test_shipment)
        prod.global_stock = initial_stock
        db.commit()

        print("\n==================================================")
        print("[SUCCESS] ALL 6 VERIFICATION SUITES PASSED FLAWLESSLY!")
        print("==================================================")

    except Exception as e:
        db.rollback()
        print(f"\n[FAIL] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    test_meeting_feedback_fixes()
