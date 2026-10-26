// NYRIX ERP - Authentication & Password Management Core v2.2

// 1. Quick Fill Helper - Disabled in Production
window.quickFill = function() {
    console.warn("L'auto-remplissage rapide est désactivé pour des raisons de sécurité.");
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
    const rotp = document.getElementById('reset-otp-code');
    if (rotp) rotp.value = '';
    const rk = document.getElementById('reset-recovery-key');
    if (rk) rk.value = '';
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

// 3.b Security Policy & Legal Notice Modals
window.openSecurityPolicyModal = function() {
    const modal = document.getElementById('security-policy-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeSecurityPolicyModal = function() {
    const modal = document.getElementById('security-policy-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

window.openLegalModal = function() {
    const modal = document.getElementById('legal-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

window.closeLegalModal = function() {
    const modal = document.getElementById('legal-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// Monitor username for Option B (operational accounts) vs Option C (Admin OTP)
window.onResetUsernameInput = function(val) {
    const u = (val || '').trim().toLowerCase();
    const msg = document.getElementById('reset-msg');
    const otpContainer = document.getElementById('otp-container');
    const btnRequestOtp = document.getElementById('btn-request-otp');

    if (u === 'karime' || u === 'packer' || u === 'mehdi') {
        if (msg) {
            msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-amber-50 text-amber-800 border border-amber-200 block';
            msg.innerHTML = `
                <div class="font-semibold mb-0.5">ℹ️ Compte Opérationnel (Option B)</div>
                <div>Pour des raisons de sécurité, la réinitialisation en ligne est désactivée pour les collaborateurs. Veuillez contacter directement <strong>Othmane (DSI)</strong> au Poste 4022 pour renouveler votre accès depuis son tableau de bord interne.</div>
            `;
        }
        if (otpContainer) otpContainer.classList.add('hidden');
        if (btnRequestOtp) btnRequestOtp.classList.add('hidden');
    } else {
        if (msg && msg.classList.contains('bg-amber-50')) {
            msg.className = 'hidden mb-4 p-3 rounded-lg text-xs leading-relaxed';
            msg.innerHTML = '';
        }
        if (otpContainer) otpContainer.classList.remove('hidden');
        if (btnRequestOtp) btnRequestOtp.classList.remove('hidden');
    }
};

// Request 6-digit OTP code by email for Admin (Option C)
window.requestAdminOtp = async function() {
    const uname = document.getElementById('reset-username')?.value.trim();
    const msg = document.getElementById('reset-msg');
    const btnOtp = document.getElementById('btn-request-otp');

    if (!uname) {
        if (msg) {
            msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
            msg.textContent = "Veuillez d'abord saisir votre nom d'utilisateur (ex: othmane).";
        }
        return;
    }

    if (btnOtp) {
        btnOtp.disabled = true;
        btnOtp.innerText = "Envoi OTP...";
    }

    try {
        const res = await apiCall('/auth/request-admin-otp', {
            method: 'POST',
            body: JSON.stringify({ username: uname })
        });
        const data = await res.json();
        if (res && res.status === 200) {
            if (msg) {
                msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-blue-50 text-blue-800 border border-blue-200 block';
                msg.innerHTML = `<div class="font-semibold mb-1">✓ ${data.message}</div>`;
                if (data.otp_test_hint) {
                    msg.innerHTML += `<div class="text-[11px] text-blue-600 mt-1 font-mono">Code OTP DSI : <strong>${data.otp_test_hint}</strong> (adresse e-mail en attente)</div>`;
                    const otpInput = document.getElementById('reset-otp-code');
                    if (otpInput) otpInput.value = data.otp_test_hint;
                }
            }
        } else {
            if (msg) {
                msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
                msg.textContent = data.detail || "Erreur lors de la demande du code OTP.";
            }
        }
    } catch (err) {
        console.error("Erreur OTP:", err);
        if (msg) {
            msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
            msg.textContent = "Erreur de communication avec le serveur pour l'envoi de l'OTP.";
        }
    } finally {
        if (btnOtp) {
            btnOtp.disabled = false;
            btnOtp.innerText = "Demander code OTP e-mail";
        }
    }
};

// 4. Handle Password Reset Request
window.handleResetPassword = async function(e) {
    if (e) e.preventDefault();
    const uname = document.getElementById('reset-username')?.value.trim();
    const newPwd = document.getElementById('reset-new-password')?.value.trim();
    const otpCode = document.getElementById('reset-otp-code')?.value.trim();
    const recoveryKey = document.getElementById('reset-recovery-key')?.value.trim();
    const msg = document.getElementById('reset-msg');
    const btn = document.getElementById('submit-reset-btn');

    if (!uname) {
        if (msg) {
            msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
            msg.textContent = "Veuillez saisir votre nom d'utilisateur.";
        }
        return;
    }

    const lowerU = uname.toLowerCase();
    if (lowerU === 'karime' || lowerU === 'packer' || lowerU === 'mehdi') {
        if (msg) {
            msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-amber-50 text-amber-800 border border-amber-200 block';
            msg.innerHTML = `
                <div class="font-semibold mb-0.5">ℹ️ Accès Opérationnel (Option B)</div>
                <div>La réinitialisation en ligne est désactivée pour les collaborateurs. Veuillez contacter <strong>Othmane (DSI)</strong> au Poste 4022 pour renouveler votre accès depuis son tableau de bord interne.</div>
            `;
        }
        return;
    }

    if (!newPwd || newPwd.length < 6) {
        if (msg) {
            msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
            msg.textContent = "Le nouveau mot de passe est obligatoire (minimum 6 caractères).";
        }
        return;
    }

    if (!otpCode && !recoveryKey) {
        if (msg) {
            msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
            msg.textContent = "Veuillez saisir le code OTP envoyé par e-mail (ou le code d'urgence DSI).";
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="animate-spin inline-block mr-1">⟳</span><span>Validation...</span>';
    }

    try {
        const res = await apiCall('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({
                username: uname,
                new_password: newPwd,
                otp_code: otpCode || null,
                recovery_key: recoveryKey || null
            })
        });

        if (res && res.status === 200) {
            const data = await res.json();
            if (msg) {
                msg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-emerald-50 text-emerald-800 border border-emerald-200 block';
                msg.innerHTML = `
                    <div class="font-semibold mb-1">✓ ${data.message}</div>
                    <div class="text-[11px] text-emerald-700">Votre mot de passe a été mis à jour avec succès. Veuillez vous connecter.</div>
                `;
            }

            // Fill username and reset password input on login form
            const loginU = document.getElementById('username');
            const loginP = document.getElementById('password');
            if (loginU) loginU.value = data.username;
            if (loginP) {
                loginP.value = '';
                loginP.type = 'password';
                loginP.classList.add('tracking-widest');
            }

            setTimeout(() => {
                window.closeForgotModal();
                if (loginP) loginP.focus();
            }, 1800);
        } else {
            let errorText = "Échec de la réinitialisation.";
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
            btn.innerHTML = '<span>Valider &amp; Réinitialiser</span>';
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
    ['forgot-password-modal', 'security-policy-modal', 'legal-modal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) {
            m.addEventListener('click', (e) => {
                if (e.target === m) {
                    if (id === 'forgot-password-modal') window.closeForgotModal();
                    else if (id === 'security-policy-modal') window.closeSecurityPolicyModal();
                    else if (id === 'legal-modal') window.closeLegalModal();
                }
            });
        }
    });
}

// Ensure execution whether DOM is ready or loading
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLoginForm);
} else {
    setupLoginForm();
}
