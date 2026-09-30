// NYRIX ERP - Authentication & Password Management Core v2.2

// 1. Quick Fill Helper for Dev/Test
window.quickFill = function(role) {
    const u = document.getElementById('username');
    const p = document.getElementById('password');
    if (u) u.value = role;
    if (p) p.value = 'nyrix2026';
    const err = document.getElementById('error-banner');
    if (err) err.classList.add('hidden');
};

// 2. Toggle Password Visibility (Eye Icon)
window.togglePasswordVisibility = function() {
    const passwordInput = document.getElementById('password');
    const eyeOpen = document.getElementById('eye-open-icon');
    const eyeClosed = document.getElementById('eye-closed-icon');
    const toggleBtn = document.getElementById('toggle-password-btn');
    if (!passwordInput) return;

    const isPassword = passwordInput.type === 'password';

    if (isPassword) {
        passwordInput.type = 'text';
        passwordInput.classList.remove('tracking-widest');
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClosed) eyeClosed.classList.remove('hidden');
        if (toggleBtn) toggleBtn.title = "Masquer le mot de passe";
    } else {
        passwordInput.type = 'password';
        passwordInput.classList.add('tracking-widest');
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClosed) eyeClosed.classList.add('hidden');
        if (toggleBtn) toggleBtn.title = "Afficher le mot de passe";
    }
};

// 3. Forgot Password Modal Open/Close
window.openForgotModal = function() {
    const modal = document.getElementById('forgot-password-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const u = document.getElementById('username')?.value.trim();
    const ru = document.getElementById('reset-username');
    if (ru) {
        ru.value = u || '';
        ru.focus();
    }
    const rp = document.getElementById('reset-new-password');
    if (rp) rp.value = '';
    const msg = document.getElementById('reset-msg');
    if (msg) {
        msg.className = 'hidden mb-4 p-3 rounded-lg text-xs leading-relaxed';
        msg.innerHTML = '';
    }
};

window.closeForgotModal = function() {
    const modal = document.getElementById('forgot-password-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// 4. Handle Password Reset Request
window.handleResetPassword = async function(e) {
    if (e) e.preventDefault();
    const uname = document.getElementById('reset-username')?.value.trim();
    const newPwd = document.getElementById('reset-new-password')?.value.trim();
    const msg = document.getElementById('reset-msg');
    const btn = document.getElementById('submit-reset-btn');

    if (!uname) {
        if (msg) {
            msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
            msg.textContent = "Veuillez saisir votre nom d'utilisateur.";
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-spin inline-block mr-1">⟳</span><span>Réinitialisation...</span>';
    }

    try {
        const res = await apiCall('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ username: uname, new_password: newPwd || null })
        });

        if (res && res.status === 200) {
            const data = await res.json();
            if (msg) {
                msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-emerald-50 text-emerald-800 border border-emerald-200 block';
                msg.innerHTML = `
                    <div class="font-semibold mb-1">✓ ${data.message}</div>
                    <div>Mot de passe d'accès : <code class="font-mono bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900 font-bold">${data.new_password}</code></div>
                    <div class="text-[11px] text-emerald-700 mt-1">Formulaire pré-rempli. Fermeture de la fenêtre...</div>
                `;
            }

            // Fill login form
            const loginU = document.getElementById('username');
            const loginP = document.getElementById('password');
            if (loginU) loginU.value = data.username;
            if (loginP) {
                loginP.value = data.new_password;
                // Leave it in clear text so user sees the newly configured password
                loginP.type = 'text';
                loginP.classList.remove('tracking-widest');
                const eyeOpen = document.getElementById('eye-open-icon');
                const eyeClosed = document.getElementById('eye-closed-icon');
                if (eyeOpen) eyeOpen.classList.add('hidden');
                if (eyeClosed) eyeClosed.classList.remove('hidden');
            }

            setTimeout(() => {
                window.closeForgotModal();
                const btnLogin = document.getElementById('login-btn');
                if (btnLogin) btnLogin.focus();
            }, 1800);
        } else {
            let errorText = "Utilisateur non trouvé dans le système.";
            if (res) {
                try {
                    const errJson = await res.json();
                    if (errJson && errJson.detail) errorText = errJson.detail;
                } catch(err) {}
            }
            if (msg) {
                msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
                msg.textContent = errorText;
            }
        }
    } catch (err) {
        console.error("Erreur reset:", err);
        if (msg) {
            msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
            msg.textContent = "Erreur de communication avec le serveur.";
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>Réinitialiser</span>';
        }
    }
};

// 5. Login Form Submission Handler
function setupLoginForm() {
    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            const u = document.getElementById('username').value.trim();
            const p = document.getElementById('password').value;
            const err = document.getElementById('error-banner');
            
            btn.disabled = true;
            if (err) err.classList.add('hidden');
            
            try {
                const res = await apiCall('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ username: u, password: p })
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
                    if (err) err.classList.remove('hidden');
                    btn.disabled = false;
                }
            } catch (error) {
                console.error("Erreur de connexion:", error);
                if (err) err.classList.remove('hidden');
                btn.disabled = false;
            }
        });
    }

    // Modal background click dismiss
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                window.closeForgotModal();
            }
        });
    }
}

// Ensure execution whether DOM is ready or loading
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLoginForm);
} else {
    setupLoginForm();
}
