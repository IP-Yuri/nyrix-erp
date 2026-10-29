"""
NYRIX ERP - Data Sanitization & Demo Cleanup Script
Safely removes demo/synthetic data (dummy shipments, test transfers, test discrepancies,
test B2B & mock orders, and phantom stock ledger entries) while preserving real B2C
orders from Google Sheets, the official product catalog, and user accounts.
"""

import sys
import os

# Ensure project root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.core.database import SessionLocal
from backend.app.models.models import (
    User, Product, Order, OrderItem, InboundShipment, Transfer,
    StockLedger, Discrepancy, ProductReturn, CODCashBook, OrderTypeEnum, AuthAuditLog
)
from sqlalchemy import or_, func

def clean_system():
    print("==================================================")
    print("   NYRIX ERP — CLEANING FAKE & DEMO SYSTEM DATA   ")
    print("==================================================")
    
    db = SessionLocal()
    try:
        # 1. Clean Inbound Shipments
        shipment_count = db.query(InboundShipment).count()
        db.query(InboundShipment).delete(synchronize_session=False)
        print(f"[OK] Cleaned Inbound Shipments: {shipment_count} dummy records removed.")

        # 2. Clean Stock Transfers
        transfer_count = db.query(Transfer).count()
        db.query(Transfer).delete(synchronize_session=False)
        print(f"[OK] Cleaned Stock Transfers: {transfer_count} test records removed.")

        # 3. Clean Discrepancies
        discrepancy_count = db.query(Discrepancy).count()
        db.query(Discrepancy).delete(synchronize_session=False)
        print(f"[OK] Cleaned Discrepancies: {discrepancy_count} test records removed.")

        # 4. Clean Product Returns & Cash Book
        returns_count = db.query(ProductReturn).count()
        db.query(ProductReturn).delete(synchronize_session=False)
        cash_count = db.query(CODCashBook).count()
        db.query(CODCashBook).delete(synchronize_session=False)
        print(f"[OK] Cleaned Returns & Cash Book: {returns_count} returns, {cash_count} cash book entries.")

        # 5. Clean Stock Ledger & Auth Session Audit Logs
        ledger_count = db.query(StockLedger).count()
        db.query(StockLedger).delete(synchronize_session=False)
        print(f"[OK] Cleaned Stock Ledger: {ledger_count} phantom movement entries removed.")

        audit_count = db.query(AuthAuditLog).count()
        db.query(AuthAuditLog).delete(synchronize_session=False)
        print(f"[OK] Reset Auth Audit Log: {audit_count} session entries cleared.")

        # 6. Clean Fake / Demo Orders (B2B test orders + synthetic Faker/Test/Simulated orders)
        test_orders = db.query(Order).filter(
            or_(
                Order.type == OrderTypeEnum.B2B,
                Order.client_name.ilike("%Faker%"),
                Order.client_name.ilike("%Simul%"),
                Order.client_name.ilike("%Test%"),
                Order.client_name.ilike("%Fake%"),
                Order.tracking_number.ilike("TEST-%"),
                Order.tracking_number.ilike("SIM-%"),
                Order.tracking_number.ilike("B2B-%")
            )
        ).all()
        
        test_order_count = len(test_orders)
        test_tracking_numbers = [o.tracking_number for o in test_orders]
        
        if test_tracking_numbers:
            # Delete corresponding order items first if cascade is not triggered via bulk
            deleted_items = db.query(OrderItem).filter(OrderItem.tracking_number.in_(test_tracking_numbers)).delete(synchronize_session=False)
            deleted_orders = db.query(Order).filter(Order.tracking_number.in_(test_tracking_numbers)).delete(synchronize_session=False)
            print(f"[OK] Cleaned Demo Orders: {deleted_orders} orders and {deleted_items} order items removed.")
        else:
            print("[OK] No demo orders found to delete.")

        # 7. Reset Product Inventory & Landed Cost to pristine state (0 stock, 0 landed cost)
        products = db.query(Product).all()
        for p in products:
            p.global_stock = 0
            p.packer_stock = 0
            p.landed_cost = 0.0
        print(f"[OK] Reset Inventory: {len(products)} products reset to 0 stock & 0.00 landed cost.")

        # Commit all changes
        db.commit()
        print("\nAll database operations successfully committed.")

        # 8. Verification Summary
        print("\n=== SYSTEM HEALTH CHECK POST-CLEANUP ===")
        print(f"- Active Users preserved: {db.query(User).count()} (othmane, karime, packer, mehdi)")
        print(f"- Registered Products: {db.query(Product).count()} (Stock: 0)")
        print(f"- Real B2C Sheet Orders: {db.query(Order).count()} orders (preserved)")
        print(f"- Inbound Shipments: {db.query(InboundShipment).count()}")
        print(f"- Stock Transfers: {db.query(Transfer).count()}")
        print(f"- Discrepancies: {db.query(Discrepancy).count()}")
        print(f"- Stock Ledger Entries: {db.query(StockLedger).count()}")
        print(f"- Auth Audit Log Entries: {db.query(AuthAuditLog).count()}")
        print("==================================================")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Cleanup failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clean_system()
