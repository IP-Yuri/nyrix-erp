// NYRIX ERP - Packer Tablet Controller (Station de Préparation)

window.allPendingTransfers = [];
window.allOrdersToPack = [];
window.allPackedHistory = [];
window.currentPackerTab = 'receptionner';

// Sound effect for successful packing (Web Audio API)
function playSuccessBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
        // AudioContext not allowed or unsupported
    }
}

// Toast Feedback Notification
window.showToast = function(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    const bgClass = isSuccess ? 'bg-emerald-800 text-white' : 'bg-red-800 text-white';
    const iconName = isSuccess ? 'check_circle' : 'error';

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg ${bgClass} transform transition-all duration-300 opacity-0 translate-y-2 pointer-events-auto`;
    toast.innerHTML = `
        <span class="material-symbols-outlined text-[24px]">${iconName}</span>
        <div class="flex flex-col">
            <span class="font-bold text-xs uppercase tracking-wider">${title}</span>
            <span class="text-xs opacity-90">${message}</span>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
};

// Logout
window.logout = function() {
    localStorage.clear();
    window.location.href = '/';
};

// 3-Tab Switcher (Réceptionner / À Préparer / Historique)
window.switchTab = function(tab) {
    window.currentPackerTab = tab;

    const viewRec = document.getElementById('view-receptionner');
    const viewPrep = document.getElementById('view-preparer');
    const viewHist = document.getElementById('view-historique');

    const btnRec = document.getElementById('btn-tab-receptionner');
    const btnPrep = document.getElementById('btn-tab-preparer');
    const btnHist = document.getElementById('btn-tab-historique');

    const activeClasses = 'h-[56px] rounded-xl bg-primary-container text-on-primary flex items-center justify-center gap-2.5 px-4 transition-transform shadow-md cursor-pointer select-none';
    const inactiveClasses = 'h-[56px] rounded-xl bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-bright flex items-center justify-center gap-2.5 px-4 transition-all shadow-sm cursor-pointer select-none';

    if (viewRec) viewRec.classList.add('hidden');
    if (viewPrep) viewPrep.classList.add('hidden');
    if (viewHist) viewHist.classList.add('hidden');

    if (btnRec) btnRec.className = inactiveClasses;
    if (btnPrep) btnPrep.className = inactiveClasses;
    if (btnHist) btnHist.className = inactiveClasses;

    if (tab === 'receptionner') {
        if (viewRec) viewRec.classList.remove('hidden');
        if (btnRec) btnRec.className = activeClasses;
        loadTransfers();
    } else if (tab === 'preparer') {
        if (viewPrep) viewPrep.classList.remove('hidden');
        if (btnPrep) btnPrep.className = activeClasses;
        loadOrdersToPack();
    } else if (tab === 'historique') {
        if (viewHist) viewHist.classList.remove('hidden');
        if (btnHist) btnHist.className = activeClasses;
        loadPackingHistory();
    }
};

// Toggle item checkmark on packing card
window.togglePackCheck = function(element) {
    const iconContainer = element.querySelector('.material-symbols-outlined');
    const badgeWrapper = element.querySelector('.w-8');
    if (!iconContainer || !badgeWrapper) return;
    
    if (badgeWrapper.classList.contains('bg-secondary')) {
        badgeWrapper.classList.remove('bg-secondary', 'text-on-secondary');
        badgeWrapper.classList.add('bg-outline-variant', 'text-on-surface-variant');
        iconContainer.innerText = 'remove';
    } else {
        badgeWrapper.classList.add('bg-secondary', 'text-on-secondary');
        badgeWrapper.classList.remove('bg-outline-variant', 'text-on-surface-variant');
        iconContainer.innerText = 'check';
    }
};

// ----------------------------------------------------
// TAB 1: RECEPTIONNER (Lots entrants)
// ----------------------------------------------------
async function loadTransfers() {
    try {
        const res = await apiCall('/packer/transfers?status=PENDING');
        if (res && res.status === 200) {
            const transfers = await res.json();
            window.allPendingTransfers = transfers || [];
            const list = document.getElementById('reception-items-list');
            const badge = document.getElementById('badge-receptionner');
            
            if (badge) badge.innerText = `${transfers.length}`;
            if (!list) return;

            list.innerHTML = '';
            if (transfers.length === 0) {
                list.innerHTML = '<div class="p-8 text-center text-on-surface-variant italic">Aucun transfert de stock en attente de réception.</div>';
                return;
            }
            
            transfers.forEach((t, i) => {
                const rowClass = i % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low';
                const pillClass = i % 2 === 0 ? 'bg-surface-container text-on-surface' : 'bg-surface-container-highest text-on-surface';
                
                const div = document.createElement('div');
                div.className = `w-full min-h-[96px] ${rowClass} px-6 py-5 flex items-center justify-between transition-colors hover:bg-surface-bright group`;
                div.id = `transfer-row-${t.id}`;
                div.innerHTML = `
                    <div class="w-28 flex-shrink-0">
                        <div class="w-24 h-16 rounded-xl ${pillClass} flex items-center justify-center font-metric-lg text-metric-lg font-bold tracking-tight shadow-sm group-hover:bg-primary-fixed transition-colors">
                          ${t.quantity}×
                        </div>
                    </div>
                    <div class="flex-1 px-6 min-w-0 flex flex-col justify-center gap-1">
                        <div class="flex items-center gap-2">
                            <span class="font-headline-lg text-headline-lg text-on-surface font-semibold truncate">${t.product_sku}</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-y-1 gap-x-2 text-on-surface-variant font-body-sm text-body-sm">
                            <span class="font-tabular-data text-on-surface font-semibold bg-surface-container px-2 py-0.5 rounded">ID: ${t.id}</span>
                            <span class="text-outline-variant">•</span>
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-[15px] text-secondary">person</span>
                                Envoyé par: <strong class="text-on-surface">WAREHOUSE (Karime)</strong>
                            </span>
                        </div>
                    </div>
                    <!-- Two Action Buttons: Réclamer + Confirmer (As seen in assets) -->
                    <div class="flex-shrink-0 flex items-center gap-2">
                        <button type="button" class="h-[56px] px-3.5 rounded-xl bg-surface-container-high hover:bg-error-container text-on-surface-variant hover:text-on-error-container font-label-md text-label-md font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 select-none shadow-sm cursor-pointer" title="Signaler un écart ou un litige sur ce lot" onclick="window.openClaimModal('${t.id}', '${t.product_sku}', ${t.quantity})">
                            <span class="material-symbols-outlined text-[20px] text-error">report_problem</span>
                            <span>Réclamer</span>
                        </button>
                        <button type="button" class="h-[56px] px-5 rounded-xl bg-secondary text-on-secondary font-headline-sm text-headline-sm font-bold shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 select-none cursor-pointer" onclick="window.confirmTransfer('${t.id}', this)">
                            <span class="material-symbols-outlined text-[24px]">check_circle</span>
                            <span>Confirmer</span>
                        </button>
                    </div>
                `;
                list.appendChild(div);
            });
        }
    } catch (e) {
        console.error("Transfers error:", e);
    }
}

window.confirmTransfer = async function(id, btnElement) {
    if (btnElement.dataset.confirmed) return;
    btnElement.disabled = true;
    btnElement.innerHTML = '<span class="material-symbols-outlined text-[24px] animate-spin">refresh</span><span>Validation...</span>';
    
    try {
        const res = await apiCall(`/packer/transfers/${id}/accept`, { method: 'PUT' });
        if (res && res.status === 200) {
            btnElement.dataset.confirmed = "true";
            btnElement.classList.remove('bg-secondary', 'hover:opacity-95');
            btnElement.classList.add('bg-surface-container-high', 'text-secondary', 'cursor-default');
            btnElement.innerHTML = '<span class="material-symbols-outlined text-[24px]">done_all</span><span>Réceptionné</span>';
            
            const row = document.getElementById(`transfer-row-${id}`);
            if (row) {
                row.style.opacity = '0.55';
                row.classList.add('transition-all', 'duration-300');
            }
            
            window.showToast("Lot Réceptionné", "Stock ajouté à la table de préparation.", "success");
            playSuccessBeep();
            setTimeout(loadTransfers, 900);
        } else {
            btnElement.disabled = false;
            btnElement.innerHTML = 'Erreur';
        }
    } catch (err) {
        console.error("Confirm error:", err);
        btnElement.disabled = false;
        btnElement.innerHTML = 'Erreur';
    }
};

// ----------------------------------------------------
// CLAIM / RÉCLAMATION MODAL
// ----------------------------------------------------
window.openClaimModal = function(id, sku, qty) {
    const modal = document.getElementById('modal-claim');
    if (!modal) return;
    document.getElementById('claim-transfer-id').value = id;
    document.getElementById('claim-sku-display').value = `${sku} (Total du lot : ${qty} pièces)`;
    const qtyInput = document.getElementById('claim-qty');
    qtyInput.value = 1;
    qtyInput.max = qty;
    modal.classList.remove('hidden');
};

window.closeClaimModal = function() {
    const modal = document.getElementById('modal-claim');
    if (modal) modal.classList.add('hidden');
};

window.submitClaim = async function(e) {
    e.preventDefault();
    const id = document.getElementById('claim-transfer-id').value;
    const qty = parseInt(document.getElementById('claim-qty').value, 10);
    const reason = document.getElementById('claim-reason').value;
    const btn = document.getElementById('btn-submit-claim');

    if (!id || qty <= 0) return;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span><span>Transmission...</span>`;

    try {
        const res = await apiCall(`/packer/transfers/${id}/claim`, {
            method: 'POST',
            body: JSON.stringify({ quantity_missing: qty, reason: reason })
        });

        if (res && res.status === 200) {
            window.closeClaimModal();
            window.showToast("Litige Transmis", `Écart de ${qty} pièce(s) signalé au superviseur Karime.`, "error");
            await loadTransfers();
        } else {
            alert("Erreur lors de la déclaration du litige.");
        }
    } catch (err) {
        console.error("Claim error:", err);
        alert("Erreur réseau lors de la réclamation.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-[18px]">send</span><span>Transmettre la Réclamation</span>`;
    }
};

// ----------------------------------------------------
// TAB 2: À PRÉPARER (Clean order cards matching assets)
// ----------------------------------------------------
async function loadOrdersToPack() {
    const container = document.getElementById('view-preparer');
    if (!container) return;

    try {
        const res = await apiCall('/packer/orders');
        if (res && res.status === 200) {
            const orders = await res.json();
            window.allOrdersToPack = orders || [];
            
            const badge = document.getElementById('badge-preparer');
            if (badge) badge.innerText = `${orders.length}`;

            container.innerHTML = '';
            if (orders.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full py-16 text-center text-on-surface-variant flex flex-col items-center justify-center gap-3">
                        <span class="material-symbols-outlined text-[48px] text-emerald-600">task_alt</span>
                        <span class="font-headline-sm text-headline-sm font-bold text-on-surface">Toutes les commandes sont emballées !</span>
                        <span class="text-body-sm text-on-surface-variant">Aucune commande en attente de préparation pour le moment.</span>
                    </div>
                `;
                return;
            }

            orders.forEach(o => {
                const isB2B = (o.type === 'B2B');
                const totalItemsCount = (o.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);

                let gabaritText = "Carton Format Standard (Moyen)";
                if (isB2B) {
                    gabaritText = "Palette Cerclée + Film Protecteur";
                } else if (totalItemsCount <= 1) {
                    gabaritText = "Pochette Kraft Renforcée A4";
                } else if (totalItemsCount >= 4) {
                    gabaritText = "Carton Grand Format XL";
                }

                let itemsHtml = '';
                if (o.items && o.items.length > 0) {
                    o.items.forEach(it => {
                        itemsHtml += `
                            <div class="p-3 bg-surface-container-low rounded-lg flex items-start gap-3 select-none active:bg-surface-container transition-colors cursor-pointer" onclick="window.togglePackCheck(this)">
                                <div class="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-on-secondary shrink-0 mt-0.5 shadow-sm">
                                    <span class="material-symbols-outlined text-[20px] font-bold">check</span>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-baseline justify-between gap-1">
                                        <span class="font-headline-sm text-body-md text-on-surface font-bold truncate">${it.product_sku}</span>
                                        <span class="font-tabular-data text-body-md text-on-surface font-extrabold px-2 py-0.5 bg-surface-container-lowest rounded">${it.quantity}×</span>
                                    </div>
                                    <p class="font-label-md text-[11px] text-on-surface-variant font-medium mt-0.5">Vérifié prêt à emballer</p>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    itemsHtml = `
                        <div class="p-3 bg-surface-container-low rounded-lg text-body-sm text-on-surface-variant italic">
                            Articles généraux • Pointage bordereau
                        </div>
                    `;
                }

                const card = document.createElement('div');
                card.id = `order-card-${o.tracking_number}`;
                card.className = `flex flex-col justify-between bg-surface-container-lowest rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative ${isB2B ? 'border-2 border-slate-900 shadow-md' : ''}`;
                
                card.innerHTML = `
                    <div class="space-y-4">
                        <!-- Card Header: Tracking + Destination City -->
                        <div class="flex items-start justify-between gap-2 pb-3 bg-surface-container-low p-3.5 rounded-lg">
                            <div class="flex flex-col">
                                <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Bordereau Logistique</span>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="material-symbols-outlined text-primary text-[24px]">barcode_scanner</span>
                                    <span class="font-tabular-data text-headline-sm font-bold text-on-surface tracking-tight">#${o.tracking_number}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-1.5 bg-primary-fixed text-on-primary-fixed px-3 py-1.5 rounded-lg shadow-2xs">
                                <span class="material-symbols-outlined text-[18px]">location_on</span>
                                <span class="font-headline-sm text-label-md font-bold">${o.city || 'Maroc'}</span>
                            </div>
                        </div>

                        <!-- Priority / Type Pill -->
                        <div class="flex items-center justify-between">
                            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${isB2B ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-surface-container text-on-surface'} font-label-md text-label-md font-bold">
                                <span class="material-symbols-outlined text-[18px] text-secondary">check_circle</span>
                                ${isB2B ? 'Expédition B2B Palettes' : 'Standard B2C • Prêt'}
                            </span>
                            <span class="font-label-sm font-bold text-on-surface-variant truncate max-w-[130px]" title="${o.client_name || ''}">
                                ${o.client_name || 'Client Direct'}
                            </span>
                        </div>

                        <!-- Checklist Items -->
                        <div class="space-y-2.5 pt-1">
                            ${itemsHtml}
                        </div>

                        <!-- Packaging Recommendation Guideline Box -->
                        <div class="flex items-center gap-3 px-4 py-3 bg-primary-fixed text-on-primary-fixed rounded-lg">
                            <span class="material-symbols-outlined text-[24px]">inventory</span>
                            <div class="flex flex-col">
                                <span class="font-label-sm text-[10px] font-semibold uppercase opacity-80">Gabarit Préconisé</span>
                                <span class="font-headline-sm text-label-md font-bold tracking-tight">${gabaritText}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Action Button: Huge Touch Ergonomics (Min 56px height) -->
                    <div class="pt-5">
                        <button type="button" class="w-full h-14 bg-primary-container hover:bg-primary active:scale-[0.98] text-on-primary rounded-xl font-headline-sm text-headline-sm font-bold flex items-center justify-center gap-3 shadow-md transition-all cursor-pointer" onclick="window.completePacking('${o.tracking_number}', this)">
                            <span class="material-symbols-outlined text-[24px]">print</span>
                            <span>✓ Colis Terminé (Bordereau)</span>
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (e) {
        console.error("Orders to pack error:", e);
    }
}

// Complete Order Packing
window.completePacking = async function(trackingNumber, btnElement) {
    if (btnElement.disabled) return;
    btnElement.disabled = true;
    const originalContent = btnElement.innerHTML;
    btnElement.innerHTML = `<span class="material-symbols-outlined text-[24px] animate-spin">refresh</span><span>Validation en cours...</span>`;

    try {
        const res = await apiCall(`/packer/orders/${trackingNumber}/pack`, { method: 'PUT' });
        if (res && res.status === 200) {
            // Visual & Audio Feedback
            playSuccessBeep();
            window.showToast("Colis validé & enregistré", `Commande #${trackingNumber} enregistrée avec succès. Prête pour le quai d'expédition !`, "success");

            // Animate card removal
            const card = document.getElementById(`order-card-${trackingNumber}`);
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.95)';
                card.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    card.remove();
                    // Update count
                    const remaining = document.querySelectorAll('#view-preparer > div[id^="order-card-"]').length;
                    const badge = document.getElementById('badge-preparer');
                    if (badge) badge.innerText = `${remaining}`;
                    if (remaining === 0) loadOrdersToPack();
                }, 300);
            }

            // Also reload history count
            loadPackingHistory();
        } else {
            const errData = await res?.json().catch(() => ({}));
            alert(`Erreur lors de la validation: ${errData.detail || 'Stock insuffisant ou commande non trouvée'}`);
            btnElement.disabled = false;
            btnElement.innerHTML = originalContent;
        }
    } catch (err) {
        console.error("Packing error:", err);
        alert("Erreur réseau lors de la validation du colis.");
        btnElement.disabled = false;
        btnElement.innerHTML = originalContent;
    }
};

// ----------------------------------------------------
// TAB 3: HISTORIQUE DES COLIS PRÉPARÉS
// ----------------------------------------------------
async function loadPackingHistory() {
    try {
        const res = await apiCall('/packer/history');
        if (res && res.status === 200) {
            const history = await res.json();
            window.allPackedHistory = history || [];

            const badge = document.getElementById('badge-historique');
            if (badge) badge.innerText = `${history.length}`;

            renderHistoryTable(history);
        }
    } catch (e) {
        console.error("History error:", e);
    }
}

function renderHistoryTable(items) {
    const tbody = document.getElementById('packer-history-tbody');
    const counter = document.getElementById('packer-history-count');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-on-surface-variant italic">Aucun colis préparé enregistré pour le moment.</td></tr>`;
        if (counter) counter.innerText = '0 colis préparé enregistré';
        return;
    }

    if (counter) counter.innerText = `${items.length} colis préparé(s) enregistré(s)`;

    items.forEach(o => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-surface-container-low transition-colors";
        
        const dateStr = o.packed_at ? new Date(o.packed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (o.created_at ? new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Aujourd\'hui');
        const itemsSummary = (o.items && o.items.length > 0) ? o.items.map(it => `${it.quantity}x ${it.product_sku}`).join(', ') : 'Contenu standard';

        tr.innerHTML = `
            <td class="py-3 px-4 font-mono font-bold text-on-surface whitespace-nowrap">
                <div class="flex items-center gap-1.5 text-slate-700">
                    <span class="material-symbols-outlined text-[16px] text-emerald-600">schedule</span>
                    <span>${dateStr}</span>
                </div>
            </td>
            <td class="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                #${o.tracking_number}
            </td>
            <td class="py-3 px-4 whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold ${o.type === 'B2B' ? 'bg-slate-900 text-white' : 'bg-surface-container text-on-surface'}">
                    ${o.type || 'B2C'}
                </span>
            </td>
            <td class="py-3 px-4">
                <div class="font-bold text-on-surface truncate max-w-[180px]">${o.client_name || 'Client Direct'}</div>
                <div class="text-[11px] text-on-surface-variant">${o.city || 'Maroc'}</div>
            </td>
            <td class="py-3 px-4 font-mono text-xs text-on-surface truncate max-w-[200px]" title="${itemsSummary}">
                ${itemsSummary}
            </td>
            <td class="py-3 px-4 whitespace-nowrap">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    <span class="material-symbols-outlined text-[13px]">done_all</span>
                    ${o.status === 'READY' ? 'Prêt Quai' : o.status}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.filterHistoryTable = function() {
    const q = (document.getElementById('history-search')?.value || '').toLowerCase().trim();
    const items = window.allPackedHistory || [];
    if (!q) {
        renderHistoryTable(items);
        return;
    }
    const filtered = items.filter(o => {
        return (o.tracking_number && o.tracking_number.toLowerCase().includes(q)) ||
               (o.client_name && o.client_name.toLowerCase().includes(q)) ||
               (o.city && o.city.toLowerCase().includes(q));
    });
    renderHistoryTable(filtered);
};

// Excel Export for Packer Production History
window.exportPackingHistoryToExcel = function() {
    try {
        const table = document.getElementById('packer-history-table');
        if (!table) return;

        if (!window.XLSX) {
            alert("Module Excel (SheetJS) indisponible.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, "Colis_Prepares");
        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `NYRIX_Packer_Production_${today}.xlsx`);
    } catch (e) {
        console.error("Export error:", e);
        alert("Erreur lors de l'exportation Excel: " + e.message);
    }
};

// Print Function for Packer Manifest
window.printPackingHistory = function() {
    window.print();
};

// Initial Execution on Load
window.onload = async function() {
    await loadTransfers();
    await loadOrdersToPack();
    await loadPackingHistory();
};
