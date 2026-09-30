import requests

def test_login_features():
    # 1. Test index.html has eye icon button and forgot password modal
    res_index = requests.get('http://127.0.0.1:8000/index.html')
    assert res_index.status_code == 200, f"index.html failed: {res_index.status_code}"
    html = res_index.text
    assert 'id="toggle-password-btn"' in html, "Missing toggle-password-btn in index.html"
    assert 'id="forgot-password-btn"' in html, "Missing forgot-password-btn in index.html"
    assert 'id="forgot-password-modal"' in html, "Missing forgot-password-modal in index.html"
    assert 'id="eye-open-icon"' in html, "Missing eye-open-icon in index.html"
    assert 'id="eye-closed-icon"' in html, "Missing eye-closed-icon in index.html"
    print("[OK] index.html contains eye icon toggle and forgot password modal elements.")

    # 2. Test auth.js has eye toggle and forgot modal handlers
    res_js = requests.get('http://127.0.0.1:8000/js/auth.js')
    assert res_js.status_code == 200, f"auth.js failed: {res_js.status_code}"
    js = res_js.text
    assert 'toggle-password-btn' in js, "Missing toggle-password-btn in auth.js"
    assert 'forgot-password-modal' in js, "Missing forgot-password-modal in auth.js"
    assert '/auth/reset-password' in js, "Missing reset-password API call in auth.js"
    print("[OK] js/auth.js contains working eye toggle and forgot password handler.")

    # 3. Test reset password endpoint with default
    res_reset = requests.post('http://127.0.0.1:8000/api/auth/reset-password', json={'username': 'mehdi'})
    assert res_reset.status_code == 200, f"reset-password failed: {res_reset.text}"
    data = res_reset.json()
    assert data['status'] == 'success'
    assert data['new_password'] == 'nyrix2026'
    print(f"[OK] /api/auth/reset-password succeeded: {data['message']}")

    # 4. Test login with the reset password
    res_login = requests.post('http://127.0.0.1:8000/api/auth/login', json={'username': 'mehdi', 'password': 'nyrix2026'})
    assert res_login.status_code == 200, f"login failed: {res_login.text}"
    token = res_login.json()['access_token']
    assert token, "Token missing in login response"
    print("[OK] Login after password reset succeeded with 200 OK.")

    # 5. Test reset with custom password
    res_custom = requests.post('http://127.0.0.1:8000/api/auth/reset-password', json={'username': 'mehdi', 'new_password': 'MyCustomPass2026!'})
    assert res_custom.status_code == 200
    res_login_custom = requests.post('http://127.0.0.1:8000/api/auth/login', json={'username': 'mehdi', 'password': 'MyCustomPass2026!'})
    assert res_login_custom.status_code == 200
    print("[OK] Login with custom new password verified.")

    # 6. Restore back to nyrix2026
    requests.post('http://127.0.0.1:8000/api/auth/reset-password', json={'username': 'mehdi', 'new_password': 'nyrix2026'})
    res_restore = requests.post('http://127.0.0.1:8000/api/auth/login', json={'username': 'mehdi', 'password': 'nyrix2026'})
    assert res_restore.status_code == 200
    print("[OK] Restored default password and verified login.")
    print("\nALL LOGIN & AUTH INTEGRATION TESTS PASSED 100%!")

if __name__ == "__main__":
    test_login_features()
