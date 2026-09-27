const form = document.getElementById('login-form');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        const err = document.getElementById('error-banner');
        
        btn.disabled = true;
        err.classList.add('hidden');
        
        const res = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({username: u, password: p})
        });
        
        if (res && res.status === 200) {
            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('username', data.username);
            
            if (data.role === 'ADMIN') window.location.href = 'othmane_dashboard.html';
            else if (data.role === 'WAREHOUSE') window.location.href = 'karime_warehouse.html';
            else if (data.role === 'PACKER') window.location.href = 'packer_tablet.html';
            else if (data.role === 'B2B') window.location.href = 'mehdi_b2b.html';
        } else {
            err.classList.remove('hidden');
            btn.disabled = false;
        }
    });
}
