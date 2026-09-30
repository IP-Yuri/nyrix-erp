from fastapi.testclient import TestClient
from backend.app.main import app

def test_b2b_full_lifecycle():
    client = TestClient(app)

    # 1. Login Mehdi
    r = client.post('/api/auth/login', json={'username': 'mehdi', 'password': 'nyrix2026'})
    assert r.status_code == 200, f'Login failed: {r.text}'
    token = r.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    print("1. Mehdi authenticated successfully.")

    # 2. Get Inventory
    r = client.get('/api/b2b/inventory', headers=headers)
    assert r.status_code == 200, f'Inventory failed: {r.text}'
    inv = r.json()
    print(f"2. B2B Inventory retrieved: {len(inv)} items. First item: {inv[0]['sku']} (Stock: {inv[0]['global_stock']})")
    assert len(inv) > 0

    # 3. Create B2B Order using frontend payload format (sku & unit_price_mad)
    payload = {
        'client_name': 'Atlas Distribution Maroc S.A.R.L.',
        'city': 'Tanger Free Zone',
        'payment_method': 'VIREMENT',
        'discount_pct': 5.0,
        'items': [
            {'sku': inv[0]['sku'], 'quantity': 15, 'unit_price_mad': 180.0}
        ]
    }
    r = client.post('/api/b2b/orders', json=payload, headers=headers)
    assert r.status_code == 200, f'Create order failed: {r.text}'
    order = r.json()
    tn = order['tracking_number']
    print(f"3. B2B Order created: {tn} | Client: {order['client_name']} | City: {order['city']} | Total HT: {order.get('total_amount_ht')} | Total TTC: {order.get('total_amount_ttc')}")
    assert order['payment_status'] == 'UNPAID'
    assert order['status'] == 'PENDING_PACKING'

    # 4. List orders
    r = client.get('/api/b2b/orders', headers=headers)
    assert r.status_code == 200
    orders = r.json()
    print(f"4. Listed {len(orders)} B2B orders.")
    found = next((o for o in orders if o['tracking_number'] == tn), None)
    assert found is not None
    assert found['payment_status'] == 'UNPAID'

    # 5. Mark Paid
    r = client.put(f'/api/b2b/orders/{tn}/payment', headers=headers)
    assert r.status_code == 200, f'Mark paid failed: {r.text}'
    print(f"5. Payment confirmed for order {tn}.")

    # 6. Verify single order endpoint & status
    r = client.get(f'/api/b2b/orders/{tn}', headers=headers)
    assert r.status_code == 200
    updated = r.json()
    assert updated['payment_status'] == 'PAID'
    print(f"6. Order {tn} status successfully updated to PAID.")
    print("\nALL B2B INTEGRATION TESTS PASSED PERFECTLY!\n")

if __name__ == "__main__":
    test_b2b_full_lifecycle()
