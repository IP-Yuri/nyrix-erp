import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.app.main import app

def test_login_features():
    client = TestClient(app)

    # 1. Test index.html has eye icon button and forgot password modal
    res_index = client.get('/index.html')
    assert res_index.status_code == 200, f"index.html failed: {res_index.status_code}"
    html = res_index.text
    assert 'id="toggle-password-btn"' in html, "Missing toggle-password-btn in index.html"
    assert 'id="forgot-password-btn"' in html, "Missing forgot-password-btn in index.html"
    assert 'id="forgot-password-modal"' in html, "Missing forgot-password-modal in index.html"
    assert 'id="eye-open-icon"' in html, "Missing eye-open-icon in index.html"
    assert 'id="eye-closed-icon"' in html, "Missing eye-closed-icon in index.html"
    assert 'id="reset-otp-code"' in html, "Missing reset-otp-code for Option C in index.html"
    assert 'onclick="window.quickFill(' not in html, "Quick chips should not be present in index.html"
    assert "Laisser vide pour 'nyrix2026'" not in html, "Default password hint must not be in index.html"
    print("[OK] index.html verified: contains OTP and reset elements without quick chips or password hints.")

    # 2. Test auth.js has Option B monitoring and Option C OTP request
    res_js = client.get('/js/auth.js')
    assert res_js.status_code == 200, f"auth.js failed: {res_js.status_code}"
    js = res_js.text
    assert 'onResetUsernameInput' in js, "Missing onResetUsernameInput in auth.js"
    assert 'requestAdminOtp' in js, "Missing requestAdminOtp in auth.js"
    assert '/auth/request-admin-otp' in js, "Missing request-admin-otp call in auth.js"
    assert "'nyrix2026'" not in js, "Cleartext default password must not be present in auth.js"
    print("[OK] js/auth.js verified: contains Option B guardrails and Option C OTP functions.")

    # 3. Test othmane_dashboard.html has nav-users and view-users (Option B Management)
    res_dash = client.get('/othmane_dashboard.html')
    assert res_dash.status_code == 200
    dash_html = res_dash.text
    assert 'id="nav-users"' in dash_html, "Missing nav-users in othmane_dashboard.html"
    assert 'id="view-users"' in dash_html, "Missing view-users in othmane_dashboard.html"
    assert 'id="admin-reset-modal"' in dash_html, "Missing admin-reset-modal in othmane_dashboard.html"
    print("[OK] othmane_dashboard.html verified: contains dedicated Option B User Management section.")

    # 4. OPTION B Security Guardrail: Non-admin users CANNOT self-reset or request OTP
    res_mehdi_blocked = client.post('/api/auth/reset-password', json={'username': 'mehdi', 'new_password': 'SafePassword2026!'})
    assert res_mehdi_blocked.status_code == 403, f"Expected 403, got {res_mehdi_blocked.status_code}"
    assert "Option B" in res_mehdi_blocked.text, "Expected Option B explanation in detail"

    res_mehdi_otp_blocked = client.post('/api/auth/request-admin-otp', json={'username': 'mehdi'})
    assert res_mehdi_otp_blocked.status_code == 403, f"Expected 403, got {res_mehdi_otp_blocked.status_code}"
    print("[OK] Option B Guardrail verified: Operational accounts cannot perform self-service reset or request OTP.")

    # 5. OPTION C for ADMIN: Request OTP (with email place left empty)
    res_otp_admin = client.post('/api/auth/request-admin-otp', json={'username': 'othmane'})
    assert res_otp_admin.status_code == 200, f"OTP request failed: {res_otp_admin.text}"
    otp_data = res_otp_admin.json()
    assert otp_data['email_configured'] is False, "Email should be unconfigured/empty by default as requested"
    otp_code = otp_data['otp_test_hint']
    assert len(otp_code) == 6, f"Invalid OTP length: {otp_code}"
    print(f"[OK] Option C OTP request verified: Admin OTP generated successfully ({otp_code}) with empty email placeholder.")

    # 6. OPTION C: Reset with invalid OTP MUST FAIL with 403
    res_bad_otp = client.post('/api/auth/reset-password', json={
        'username': 'othmane',
        'otp_code': '000000',
        'new_password': 'NewAdminSecurePass2026!'
    })
    assert res_bad_otp.status_code == 403, f"Expected 403 for bad OTP, got {res_bad_otp.status_code}"
    print("[OK] Option C Security verified: Invalid OTP code is strictly rejected (403 Forbidden).")

    # 7. OPTION C: Reset with valid OTP succeeds and updates password
    res_good_otp = client.post('/api/auth/reset-password', json={
        'username': 'othmane',
        'otp_code': otp_code,
        'new_password': 'NewAdminSecurePass2026!'
    })
    assert res_good_otp.status_code == 200, f"Reset with valid OTP failed: {res_good_otp.text}"
    data = res_good_otp.json()
    assert data['status'] == 'success'
    assert 'new_password' not in data, "Must not return cleartext password"
    print("[OK] Option C OTP Verification verified: Admin password reset successfully via valid OTP.")

    # 8. Verify Admin can log in with the new password
    res_admin_login = client.post('/api/auth/login', json={'username': 'othmane', 'password': 'NewAdminSecurePass2026!'})
    assert res_admin_login.status_code == 200, "Admin login with new password failed"
    admin_token = res_admin_login.json()['access_token']
    print("[OK] Admin login with OTP-reset password verified (200 OK).")

    # 9. OPTION B: Admin lists all users via GET /api/auth/users
    res_users = client.get('/api/auth/users', headers={'Authorization': f'Bearer {admin_token}'})
    assert res_users.status_code == 200, f"List users failed: {res_users.text}"
    users_list = res_users.json()
    user_names = [u['username'] for u in users_list]
    for expected in ['othmane', 'karime', 'packer', 'mehdi']:
        assert expected in user_names, f"Expected user {expected} not in users list"
    print(f"[OK] Option B Admin Users API verified: Retrieved {len(users_list)} registered users.")

    # 10. OPTION B: Admin resets Mehdi's password directly from dashboard
    res_admin_reset = client.post(
        '/api/auth/admin/reset-user-password',
        headers={'Authorization': f'Bearer {admin_token}'},
        json={'target_username': 'mehdi', 'new_password': 'NewMehdiPassByAdmin2026!'}
    )
    assert res_admin_reset.status_code == 200, f"Admin reset failed: {res_admin_reset.text}"
    
    # Mehdi logs in with the admin-assigned password
    res_mehdi_login = client.post('/api/auth/login', json={'username': 'mehdi', 'password': 'NewMehdiPassByAdmin2026!'})
    assert res_mehdi_login.status_code == 200, "Mehdi login failed with admin-reset password"
    print("[OK] Option B Delegated Reset verified: Othmane successfully assigned new password to Mehdi.")

    # 11. Restore baseline passwords for test accounts
    client.post(
        '/api/auth/admin/reset-user-password',
        headers={'Authorization': f'Bearer {admin_token}'},
        json={'target_username': 'mehdi', 'new_password': 'nyrix2026'}
    )
    # Admin resets own password back using DSI emergency key
    client.post('/api/auth/reset-password', json={
        'username': 'othmane',
        'recovery_key': '4022',
        'new_password': 'nyrix2026'
    })
    print("[OK] Restored baseline test credentials.")
    print("\nALL OPTION B & OPTION C SECURITY TESTS PASSED 100%!")

if __name__ == "__main__":
    test_login_features()
