"""
Verification script for NYRIX ERP Auth Audit Logging (Logins, Logoffs, Failed attempts)
"""
import requests

BASE_URL = "http://127.0.0.1:8000"

def run_test():
    print("=== Testing Auth Audit Ledger ===")

    # 1. Successful Admin Login
    print("\n[Step 1] Logging in as Othmane (ADMIN)...")
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "othmane", "password": "nyrix2026"})
    assert res.status_code == 200, f"Othmane login failed: {res.text}"
    admin_token = res.json()["access_token"]
    print(" -> Success (Token acquired)")

    # 2. Successful Warehouse Login
    print("\n[Step 2] Logging in as Karime (WAREHOUSE)...")
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "karime", "password": "nyrix2026"})
    assert res.status_code == 200, f"Karime login failed: {res.text}"
    karime_token = res.json()["access_token"]
    print(" -> Success (Token acquired)")

    # 3. Warehouse Logout
    print("\n[Step 3] Logging out Karime...")
    res = requests.post(f"{BASE_URL}/api/auth/logout", headers={"Authorization": f"Bearer {karime_token}"})
    assert res.status_code == 200, f"Karime logout failed: {res.text}"
    print(f" -> Success: {res.json()['message']}")

    # 4. Failed Login Attempt
    print("\n[Step 4] Simulating failed login attempt for 'intruder'...")
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "intruder", "password": "wrongpassword"})
    assert res.status_code == 401, f"Expected 401 for bad login, got: {res.status_code}"
    print(" -> Successfully rejected (HTTP 401)")

    # 5. Non-Admin tries to view audit logs (should be blocked)
    print("\n[Step 5] Karime attempting to access /api/auth/audit-logs...")
    # Re-login Karime for token
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"username": "karime", "password": "nyrix2026"})
    k_token = res.json()["access_token"]
    res = requests.get(f"{BASE_URL}/api/auth/audit-logs", headers={"Authorization": f"Bearer {k_token}"})
    assert res.status_code == 403, f"Expected 403 Forbidden for Karime, got {res.status_code}"
    print(" -> Properly blocked with HTTP 403 Forbidden (RBAC Guardrail verified)")

    # 6. Admin accesses audit logs
    print("\n[Step 6] Admin accessing /api/auth/audit-logs...")
    res = requests.get(f"{BASE_URL}/api/auth/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200, f"Admin fetch audit logs failed: {res.text}"
    logs = res.json()
    assert len(logs) >= 4, f"Expected at least 4 logs, found {len(logs)}"
    print(f" -> Successfully retrieved {len(logs)} audit entries.")
    
    print("\nRecent Audit Entries:")
    for l in logs[:5]:
        print(f"   [{l['created_at']}] User='{l['username']}' Role='{l.get('role')}' Action='{l['action']}' IP='{l.get('ip_address')}'")

    print("\n=== ALL AUTH AUDIT TESTS PASSED! ===")

if __name__ == "__main__":
    run_test()

