import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def run_tests():
    print("Running Phase B Verification Tests...\n")
    
    # 1. Test successful logins
    users = ["othmane", "karime", "packer", "mehdi"]
    tokens = {}
    for user in users:
        response = client.post("/api/auth/login", json={"username": user, "password": "nyrix2026"})
        assert response.status_code == 200, f"Expected 200 for {user}, got {response.status_code}. Response: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["username"] == user
        assert data["role"] in ["ADMIN", "WAREHOUSE", "PACKER", "B2B"]
        tokens[user] = data["access_token"]
        print(f"[OK] Success login for {user} (Role: {data['role']})")

    # 2. Test failed login
    response = client.post("/api/auth/login", json={"username": "othmane", "password": "wrongpassword"})
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    print("[OK] Success: 401 Unauthorized for wrong password")

    # 3. Test RBAC dummy route
    # Using PACKER token to access ADMIN route
    packer_token = tokens["packer"]
    headers = {"Authorization": f"Bearer {packer_token}"}
    response = client.get("/api/test-admin-only", headers=headers)
    assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    print("[OK] Success: 403 Forbidden when PACKER accesses ADMIN route")
    
    # Using OTHMANE (ADMIN) token to access ADMIN route
    othmane_token = tokens["othmane"]
    headers = {"Authorization": f"Bearer {othmane_token}"}
    response = client.get("/api/test-admin-only", headers=headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print("[OK] Success: 200 OK when ADMIN accesses ADMIN route")
    
    print("\nPhase B Verification Passed Successfully!")

if __name__ == "__main__":
    run_tests()
