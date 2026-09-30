// NYRIX ERP - Authentication & Password Management Core

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Login Form Submission ---
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

    // --- 2. Toggle Password Visibility (Eye Icon) ---
    const togglePasswordBtn = document.getElementById('toggle-password-btn');
    const passwordInput = document.getElementById('password');
    const eyeOpen = document.getElementById('eye-open-icon');
    const eyeClosed = document.getElementById('eye-closed-icon');

    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = passwordInput.type === 'password';
            
            if (isPassword) {
                passwordInput.type = 'text';
                passwordInput.classList.remove('tracking-widest');
                if (eyeOpen) eyeOpen.classList.add('hidden');
                if (eyeClosed) eyeClosed.classList.remove('hidden');
                togglePasswordBtn.title = "Masquer le mot de passe";
            } else {
                passwordInput.type = 'password';
                passwordInput.classList.add('tracking-widest');
                if (eyeOpen) eyeOpen.classList.remove('hidden');
                if (eyeClosed) eyeClosed.classList.add('hidden');
                togglePasswordBtn.title = "Afficher le mot de passe";
            }
        });
    }

    // --- 3. Forgot Password Modal Logic ---
    const forgotBtn = document.getElementById('forgot-password-btn');
    const resetModal = document.getElementById('forgot-password-modal');
    const closeResetBtn = document.getElementById('close-reset-modal');
    const cancelResetBtn = document.getElementById('cancel-reset-btn');
    const resetForm = document.getElementById('reset-password-form');
    const resetUsernameInput = document.getElementById('reset-username');
    const resetPasswordInput = document.getElementById('reset-new-password');
    const resetMsg = document.getElementById('reset-msg');
    const submitResetBtn = document.getElementById('submit-reset-btn');

    function openResetModal() {
        if (!resetModal) return;
        resetModal.classList.remove('hidden');
        resetModal.classList.add('flex');
        
        // Pre-fill username if already typed in login field
        const currentUsername = document.getElementById('username')?.value.trim();
        if (resetUsernameInput) {
            resetUsernameInput.value = currentUsername || '';
            resetUsernameInput.focus();
        }
        if (resetPasswordInput) resetPasswordInput.value = '';
        if (resetMsg) {
            resetMsg.className = 'hidden mb-4 p-3 rounded-lg text-xs leading-relaxed';
            resetMsg.innerHTML = '';
        }
    }

    function closeResetModal() {
        if (!resetModal) return;
        resetModal.classList.add('hidden');
        resetModal.classList.remove('flex');
    }

    if (forgotBtn) forgotBtn.addEventListener('click', openResetModal);
    if (closeResetBtn) closeResetBtn.addEventListener('click', closeResetModal);
    if (cancelResetBtn) cancelResetBtn.addEventListener('click', closeResetModal);

    // Close when clicking background outside modal card
    if (resetModal) {
        resetModal.addEventListener('click', (e) => {
            if (e.target === resetModal) {
                closeResetModal();
            }
        });
    }

    // Submit Password Reset Request
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uname = resetUsernameInput?.value.trim();
            const newPwd = resetPasswordInput?.value.trim();

            if (!uname) {
                if (resetMsg) {
                    resetMsg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
                    resetMsg.textContent = "Veuillez saisir votre nom d'utilisateur.";
                }
                return;
            }

            if (submitResetBtn) {
                submitResetBtn.disabled = true;
                submitResetBtn.innerHTML = '<svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Réinitialisation...</span>';
            }

            try {
                const res = await apiCall('/auth/reset-password', {
                    method: 'POST',
                    body: JSON.stringify({ username: uname, new_password: newPwd || null })
                });

                if (res && res.status === 200) {
                    const data = await res.json();
                    if (resetMsg) {
                        resetMsg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-emerald-50 text-emerald-800 border border-emerald-200 block';
                        resetMsg.innerHTML = `
                            <strong class="font-semibold block mb-0.5">✓ ${data.message}</strong>
                            Nouveau mot de passe opérationnel : <code class="font-mono bg-emerald-100 px-1 py-0.5 rounded text-emerald-900 font-bold">${data.new_password}</code>
                        `;
                    }

                    // Auto-fill login form
                    const loginUsername = document.getElementById('username');
                    const loginPassword = document.getElementById('password');
                    if (loginUsername) loginUsername.value = data.username;
                    if (loginPassword) loginPassword.value = data.new_password;

                    // Automatically close modal after 2 seconds
                    setTimeout(() => {
                        closeResetModal();
                        if (loginPassword) loginPassword.focus();
                    }, 2200);
                } else {
                    let errMsg = "Erreur lors de la réinitialisation";
                    if (res) {
                        try {
                            const errData = await res.json();
                            if (errData && errData.detail) errMsg = errData.detail;
                        } catch (err) {}
                    }
                    if (resetMsg) {
                        resetMsg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
                        resetMsg.textContent = errMsg;
                    }
                }
            } catch (err) {
                console.error("Erreur reset password:", err);
                if (resetMsg) {
                    resetMsg.className = 'mb-4 p-3 rounded-lg text-xs leading-relaxed bg-red-50 text-red-700 border border-red-200 block';
                    resetMsg.textContent = "Erreur de connexion au serveur.";
                }
            } finally {
                if (submitResetBtn) {
                    submitResetBtn.disabled = false;
                    submitResetBtn.innerHTML = '<span>Réinitialiser</span>';
                }
            }
        });
    }
});
