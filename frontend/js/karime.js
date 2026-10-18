// NYRIX ERP - Karime Warehouse Controller (Inbound & Logistics Operations)

window.inventoryOptionsHtml = '';
window.allOrders = [];
window.activeFilter = 'all';
window.currentLogisticsPage = 1;
window.logisticsPageSize = 15;
window.totalLogisticsPages = 1;

// Colis Préparés state
window.currentPreparesPage = 1;
window.preparesPageSize = 15;
window.totalPreparesPages = 1;

// Logout
window.logout = function() {
    localStorage.clear();
    window.location.href = '/';
};

// Tab Switcher between Inbound, Operations, and Colis Préparés
window.switchTab = function(tab) {
    const inboundView = document.getElementById('view-inbound');
    const opsView = document.getElementById('view-operations');
    const preparesView = document.getElementById('view-prepares');

    const btnOps = document.getElementById('nav-btn-ops');
    const btnInbound = document.getElementById('nav-btn-inbound');
    const btnPrepares = document.getElementById('nav-btn-prepares');
    const breadcrumb = document.getElementById('breadcrumb-active');

    if (inboundView) inboundView.classList.add('hidden');
    if (opsView) opsView.classList.add('hidden');
    if (preparesView) preparesView.classList.add('hidden');

    const setInactive = (btn) => {
        if (!btn) return;
        btn.className = "group flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors nav-link border-l-4 border-transparent rounded-r-lg cursor-pointer";
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) { icon.classList.remove('text-brand-600'); icon.classList.add('text-slate-400'); }
    };

    const setActive = (btn) => {
        if (!btn) return;
        btn.className = "group flex items-center justify-between px-3 py-2 text-sm font-semibold transition-colors bg-brand-50 text-brand-700 border-l-4 border-brand-600 rounded-r-lg nav-link cursor-pointer";
        const icon = btn.querySelector('.material-symbols-outlined');
        if (icon) { icon.classList.remove('text-slate-400'); icon.classList.add('text-brand-600'); }
    };

    setInactive(btnOps);
    setInactive(btnInbound);
    setInactive(btnPrepares);

    if (tab === 'inbound') {
        if (inboundView) inboundView.classList.remove('hidden');
        setActive(btnInbound);
        if (breadcrumb) breadcrumb.innerText = "Réception Inbound (Arrivages Fournisseurs)";
        if (typeof window.loadInboundHistory === 'function') {
            window.loadInboundHistory();
        }
    } else if (tab === 'prepares') {
        if (preparesView) preparesView.classList.remove('hidden');
        setActive(btnPrepares);
        if (breadcrumb) breadcrumb.innerText = "Colis Préparés & Manifeste d'Enlèvement";
        window.renderPreparedOrdersTable();
        // Quietly fetch fresh orders from server to reflect latest pack operations immediately
        loadOrders().then(() => {
            if (typeof window.renderPreparedOrdersTable === 'function') {
                window.renderPreparedOrdersTable();
            }
        });
    } else {
        if (opsView) opsView.classList.remove('hidden');
        setActive(btnOps);
        if (breadcrumb) breadcrumb.innerText = "Opérations Quai & Expéditions";
        window.renderLogisticsTable();
    }
};

// Discrepancy & Damaged package helpers for Inbound reception view
window.openReportDamagedModal = function() {
    window.openModal('modal-returns');
    const damagedRadio = document.querySelector('input[name="return-condition"][value="damaged"]');
    if (damagedRadio) damagedRadio.checked = true;
};

window.openReportMissingModal = function() {
    window.openModal('modal-discrepancy');
};

// Modal Control
window.openModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        if (id === 'modal-ledger') {
            loadLedgerHistory();
        }
    }
};

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
};

// Initial Load
document.addEventListener('DOMContentLoaded', async () => {
    // Start live clock & 10-minute auto-sync engine
    updateClock();
    setInterval(updateClock, 1000);
    initAutoSyncEngine();

    // Initialize default dates to today FIRST so initial view strictly filters by today
    const today = new Date().toISOString().split('T')[0];
    const dateDebutCaisse = document.getElementById('dateDebutCaisse');
    const dateFinCaisse = document.getElementById('dateFinCaisse');
    if (dateDebutCaisse && !dateDebutCaisse.value) dateDebutCaisse.value = today;
    if (dateFinCaisse && !dateFinCaisse.value) dateFinCaisse.value = today;
    const dateStartInput = document.getElementById('dateStartInput');
    const dateEndInput = document.getElementById('dateEndInput');
    if (dateStartInput && !dateStartInput.value) dateStartInput.value = today;
    if (dateEndInput && !dateEndInput.value) dateEndInput.value = today;
    const datePreparesInput = document.getElementById('datePreparesInput');
    if (datePreparesInput) {
        datePreparesInput.addEventListener('change', () => {
            window._userChangedDatePrepares = true;
        });
    }

    // Initial data loading
    await checkInboundShipments();
    await loadInventory();
    await loadOrders();
    await loadCOD();

    // Setup filter pills
    document.querySelectorAll('.filter-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-pill').forEach(b => {
                b.classList.remove('active', 'bg-white', 'text-slate-900', 'font-bold', 'border', 'border-slate-200', 'shadow-2xs');
                b.classList.add('text-slate-600', 'font-medium');
            });
            const target = e.currentTarget;
            target.classList.add('active', 'bg-white', 'text-slate-900', 'font-bold', 'border', 'border-slate-200', 'shadow-2xs');
            target.classList.remove('text-slate-600', 'font-medium');
            window.activeFilter = target.getAttribute('data-filter') || 'all';
            window.currentLogisticsPage = 1;
            window.renderLogisticsTable();
        });
    });

    // Setup search input and date range filters
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            window.currentLogisticsPage = 1;
            window.renderLogisticsTable();
        });
    }
    if (dateStartInput) dateStartInput.addEventListener('input', () => {
        window.currentLogisticsPage = 1;
        updateLogisticsMetrics();
        window.renderLogisticsTable();
    });
    if (dateEndInput) dateEndInput.addEventListener('input', () => {
        window.currentLogisticsPage = 1;
        updateLogisticsMetrics();
        window.renderLogisticsTable();
    });

    // Setup steppers in transfer container
    setupTransferContainerListeners();
});

function updateClock() {
    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
        clockEl.innerText = new Date().toLocaleTimeString('fr-FR') + ' UTC+1';
    }
}

// ----------------------------------------------------
// STATE 1: Inbound Reception
// ----------------------------------------------------
// STATE 1: Inbound Reception
// ----------------------------------------------------
async function checkInboundShipments() {
    try {
        const res = await apiCall('/warehouse/inbound');
        if (res && res.status === 200) {
            const shipments = await res.json();
            const badgeCount = document.getElementById('inbound-pending-count');

            // 1. Process and show Priority Cancellation Requests (Option 1)
            const cancellationShipments = (shipments || []).filter(s => s.status === 'DEMANDE_ANNULATION');
            const alertContainer = document.getElementById('inbound-cancellation-alert-container');
            if (alertContainer) {
                if (cancellationShipments.length > 0) {
                    alertContainer.classList.remove('hidden');
                    alertContainer.innerHTML = '';
                    cancellationShipments.forEach(s => {
                        const items = Array.isArray(s.items_json) ? s.items_json : [];
                        const itemsSummary = items.map(it => `${it.sku} (${it.quantity} U)`).join(', ');
                        const alertCard = document.createElement('div');
                        alertCard.className = "bg-amber-50 border-2 border-amber-300 rounded-xl p-5 shadow-sm";
                        alertCard.innerHTML = `
                            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div class="flex items-start gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                                        <span class="material-symbols-outlined text-[24px]">assignment_late</span>
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <span class="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-xs">DEMANDE D'ANNULATION CONJOINTE</span>
                                            <span class="font-mono font-bold text-slate-900">${s.invoice_ref}</span>
                                            <span class="text-xs text-slate-500">• ${s.supplier_name || 'Fournisseur non spécifié'}</span>
                                        </div>
                                        <div class="mt-1 text-xs text-slate-700">
                                            <strong>Demandé par :</strong> ${s.cancellation_requested_by || 'Othmane'} • 
                                            <strong>Motif :</strong> <span class="italic text-amber-950 font-semibold">${s.cancellation_reason || 'Erreur de saisie'}</span>
                                        </div>
                                        <div class="mt-1 text-[11px] text-slate-500">
                                            Articles concernés : <span class="font-medium text-slate-700">${itemsSummary}</span>
                                        </div>
                                        <div class="mt-2 text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                                            <span class="material-symbols-outlined text-[14px]">shield</span>
                                            <span>Contrôle Stock Guard automatique : Le stock ne sera déduit que si les cartons sont encore physiquement au quai.</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button type="button" onclick="window.processCancellation('${s.id}', 'APPROVE')" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer">
                                        <span class="material-symbols-outlined text-[16px]">check_circle</span>
                                        <span>Approuver l'Annulation (Déduire Stock)</span>
                                    </button>
                                    <button type="button" onclick="window.processCancellation('${s.id}', 'REJECT')" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 hover:border-rose-300 text-xs font-semibold transition-colors cursor-pointer">
                                        <span class="material-symbols-outlined text-[16px]">close</span>
                                        <span>Refuser</span>
                                    </button>
                                </div>
                            </div>
                        `;
                        alertContainer.appendChild(alertCard);
                    });
                } else {
                    alertContainer.classList.add('hidden');
                    alertContainer.innerHTML = '';
                }
            }

            // 2. Process Pending Receipts (EN_ATTENTE_RECEPTION)
            const pendingArrivals = (shipments || []).filter(s => s.status === 'EN_ATTENTE_RECEPTION');
            const totalActionItems = (cancellationShipments.length) + (pendingArrivals.length);

            if (badgeCount) {
                if (totalActionItems > 0) {
                    badgeCount.innerText = totalActionItems;
                    badgeCount.classList.remove('hidden');
                } else {
                    badgeCount.classList.add('hidden');
                }
            }

            if (pendingArrivals.length > 0) {
                const latest = pendingArrivals[0];
                const invoiceRefEl = document.getElementById('inbound-invoice-ref');
                if (invoiceRefEl) invoiceRefEl.innerText = latest.invoice_ref || 'INB-ARRIVAGE';

                const arrivalBadge = document.getElementById('inbound-arrival-badge');
                if (arrivalBadge) {
                    arrivalBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">local_shipping</span> Arrivage ${latest.invoice_ref} • Quai Tit Mellil Quai A-04`;
                }

                const supplierEl = document.getElementById('inbound-supplier');
                if (supplierEl) supplierEl.innerText = latest.supplier_name || 'Fournisseur non spécifié';

                // Render manifest table
                const tbody = document.getElementById('inbound-table-body');
                if (tbody) {
                    tbody.innerHTML = '';
                    let totalPieces = 0;
                    const items = Array.isArray(latest.items_json) ? latest.items_json : [];

                    const itemsCountEl = document.getElementById('inbound-items-count');
                    if (itemsCountEl) itemsCountEl.innerText = `${items.length} lignes`;

                    items.forEach(itm => {
                        const qty = itm.quantity || 0;
                        totalPieces += qty;
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-slate-50 transition-colors";
                        tr.innerHTML = `
                            <td class="py-3 px-4 font-mono font-bold text-brand-700 whitespace-nowrap">${itm.sku}</td>
                            <td class="py-3 px-4">
                                <div class="font-bold text-slate-900">${itm.name || itm.sku}</div>
                                <div class="text-[11px] text-slate-400">Contrôle conformité arrivage fournisseur</div>
                            </td>
                            <td class="py-3 px-4 text-right font-extrabold text-slate-900 num-tabular">${qty.toLocaleString()} <span class="font-normal text-slate-400 text-[11px]">U</span></td>
                            <td class="py-3 px-4 text-slate-600 whitespace-nowrap">
                                <div class="flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-[16px] text-slate-400">pallet</span>
                                    <span>Colis cerclés / Palette</span>
                                </div>
                            </td>
                            <td class="py-3 px-4 text-center whitespace-nowrap">
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <span class="material-symbols-outlined text-[13px]">check_circle</span>
                                    Palettisé conforme
                                </span>
                            </td>
                            <td class="py-3 px-4 text-center whitespace-nowrap">
                                <button type="button" onclick="window.openReportMissingForSku('${itm.sku}', ${qty})" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold transition-colors cursor-pointer" title="Signaler un écart / manquant sur ce produit (Suggestion 2)">
                                    <span class="material-symbols-outlined text-[14px] text-amber-600">report</span>
                                    <span>Écart</span>
                                </button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });

                    const totalQtyEl = document.getElementById('inbound-total-qty');
                    if (totalQtyEl) totalQtyEl.innerText = `${totalPieces.toLocaleString()} unités`;
                }

                // If arriving from fresh page, show inbound
                window.switchTab('inbound');
            } else {
                const tbody = document.getElementById('inbound-table-body');
                if (tbody) {
                    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400 italic">Aucun arrivage en attente de vérification physique.</td></tr>`;
                }
                const totalQtyEl = document.getElementById('inbound-total-qty');
                if (totalQtyEl) totalQtyEl.innerText = `0 unités`;
                const itemsCountEl = document.getElementById('inbound-items-count');
                if (itemsCountEl) itemsCountEl.innerText = `0 lignes`;

                if (cancellationShipments.length > 0) {
                    window.switchTab('inbound');
                } else {
                    window.switchTab('operations');
                }
            }

            // Always refresh recent dock history
            await window.loadInboundHistory();
        }
    } catch (e) {
        console.error("Error checking inbound shipments:", e);
    }
}

// ----------------------------------------------------
// DOCK HISTORY & ROLLBACK (GARDE-FOU B & C)
// ----------------------------------------------------
window.loadInboundHistory = async function() {
    const tbody = document.getElementById('inbound-history-table-body');
    if (!tbody) return;

    try {
        const res = await apiCall('/warehouse/inbound/history');
        if (res && res.status === 200) {
            const list = await res.json();
            if (!list || list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400 italic">Aucune réception récente enregistrée au quai.</td></tr>`;
                return;
            }

            tbody.innerHTML = '';
            list.forEach(s => {
                const items = Array.isArray(s.items_json) ? s.items_json : [];
                const totalQty = items.reduce((acc, it) => acc + (parseInt(it.quantity) || 0), 0);
                const isReceptionne = s.status === 'RECEPTIONNE';

                let statusBadge = '';
                let actionBtn = '';

                if (isReceptionne) {
                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Réceptionné au quai</span>`;
                    actionBtn = `
                        <button type="button" onclick="window.rollbackReception('${s.id}', '${s.invoice_ref}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 hover:border-rose-600 text-xs font-semibold transition-all cursor-pointer shadow-2xs" title="Annuler ma validation si erreur de validation quai (Garde-fou B avec Stock Guard)">
                            <span class="material-symbols-outlined text-[14px]">undo</span>
                            <span>Annuler validation (Erreur clic)</span>
                        </button>
                    `;
                } else if (s.status === 'ANNULEE') {
                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Annulée (Stock déduit)</span>`;
                    actionBtn = `<span class="text-slate-400 italic text-[11px]">Déduction actée</span>`;
                } else {
                    statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">${s.status}</span>`;
                    actionBtn = `<span class="text-slate-400 italic text-[11px]">—</span>`;
                }

                const dateStr = s.received_at ? new Date(s.received_at).toLocaleString('fr-FR') : (s.created_at ? new Date(s.created_at).toLocaleString('fr-FR') : 'Aujourd\'hui');

                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 transition-colors";
                tr.innerHTML = `
                    <td class="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">${s.invoice_ref}</td>
                    <td class="py-3 px-4 font-medium text-slate-800">${s.supplier_name || 'Fournisseur non spécifié'}</td>
                    <td class="py-3 px-4 text-slate-600 whitespace-nowrap">${dateStr}</td>
                    <td class="py-3 px-4 text-right font-extrabold text-slate-900 num-tabular whitespace-nowrap">${totalQty.toLocaleString()} <span class="font-normal text-slate-400 text-[11px]">U</span></td>
                    <td class="py-3 px-4 text-center whitespace-nowrap">${statusBadge}</td>
                    <td class="py-3 px-4 text-center whitespace-nowrap">${actionBtn}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("Inbound history error:", e);
    }
};

window.rollbackReception = async function(id, invoiceRef) {
    const ok = confirm(`⚠️ Confirmation d'annulation de validation quai (Garde-fou B) :\n\nVoulez-vous remettre l'arrivage ${invoiceRef} en attente de vérification physique ?\n\nLe système vérifiera automatiquement (Stock Guard) qu'aucun colis n'a été transféré aux préparateurs avant de dé-valider.`);
    if (!ok) return;

    try {
        const res = await apiCall(`/warehouse/inbound/${id}/rollback-reception`, { method: 'POST' });
        if (res && res.status === 200) {
            const data = await res.json();
            alert(`✅ ${data.message || 'Validation quai annulée avec succès !'}`);
            await checkInboundShipments();
            await loadInventory();
            await window.loadInboundHistory();
        } else {
            const err = res ? await res.json() : { detail: 'Erreur inconnue' };
            alert("❌ Échec du rollback :\n" + (err.detail || JSON.stringify(err)));
        }
    } catch (e) {
        console.error("Rollback reception error:", e);
        alert("Erreur réseau: " + e.message);
    }
};

window.processCancellation = async function(id, action) {
    let rejectionReason = null;
    if (action === 'REJECT') {
        rejectionReason = prompt("Veuillez indiquer le motif du refus (ex: Marchandise déjà en cours de packaging) :", "Marchandise déjà ventilée");
        if (rejectionReason === null) return; // User cancelled
    } else {
        const ok = confirm("⚠️ Confirmez-vous que les cartons sont bien physiquement présents au quai et n'ont pas été consommés ?\n\nLe système va exécuter le contrôle Stock Guard et déduire les quantités du stock.");
        if (!ok) return;
    }

    try {
        const res = await apiCall(`/warehouse/inbound/${id}/process-cancellation`, {
            method: 'POST',
            body: JSON.stringify({ action: action, rejection_reason: rejectionReason })
        });

        if (res && res.status === 200) {
            const data = await res.json();
            alert(`✅ ${data.message}`);
            await checkInboundShipments();
            await loadInventory();
            await window.loadInboundHistory();
        } else {
            const err = res ? await res.json() : { detail: 'Erreur inconnue' };
            alert("❌ " + (err.detail || JSON.stringify(err)));
        }
    } catch (e) {
        console.error("Process cancellation error:", e);
        alert("Erreur réseau: " + e.message);
    }
};

window.openReportMissingForSku = function(sku, qty) {
    window.openReportMissingModal();
    const select = document.getElementById('disc-sku');
    if (select) {
        select.value = sku;
    }
    const qtyInput = document.getElementById('disc-qty');
    if (qtyInput) {
        qtyInput.value = '';
        qtyInput.placeholder = `Max ${qty}`;
        qtyInput.focus();
    }
};

// Inbound Verification Button
const btnValidateReceipt = document.getElementById('btnValidateReceipt');
if (btnValidateReceipt) {
    btnValidateReceipt.addEventListener('click', async () => {
        btnValidateReceipt.disabled = true;
        btnValidateReceipt.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span><span>Validation en cours...</span>';

        try {
            const res = await apiCall('/warehouse/inbound/accept', { method: 'POST' });
            if (res && res.status === 200) {
                btnValidateReceipt.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span><span>Réception Physique Validée</span>';
                btnValidateReceipt.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
                btnValidateReceipt.classList.add('bg-brand-600');

                alert("✅ Réception validée avec succès !\nLe stock physique a été intégré à l'entrepôt et est prêt pour les transferts vers les postes de picking.");

                setTimeout(() => {
                    checkInboundShipments();
                    loadInventory();
                    window.loadInboundHistory();
                    window.switchTab('operations');
                }, 1000);
            } else {
                alert("Erreur lors de la validation de la réception.");
                btnValidateReceipt.disabled = false;
                btnValidateReceipt.innerHTML = '<span class="material-symbols-outlined text-[18px]">check_circle</span><span>Valider la Réception Physique</span>';
            }
        } catch (e) {
            console.error("Error validating inbound:", e);
            alert("Erreur de connexion au serveur.");
            btnValidateReceipt.disabled = false;
        }
    });
}

// ----------------------------------------------------
// STATE 2: Inventory & Stock Transfer
// ----------------------------------------------------
async function loadInventory() {
    try {
        const res = await apiCall('/warehouse/inventory');
        if (res && res.status === 200) {
            const products = await res.json();
            let options = '';
            products.forEach(p => {
                options += `<option value="${p.sku}">${p.sku} — ${p.name || p.sku} (Dispo: ${p.global_stock} U)</option>`;
            });

            window.inventoryOptionsHtml = options;

            // Populate all transfer selects
            document.querySelectorAll('.transfer-sku').forEach(sel => {
                const currentVal = sel.value;
                sel.innerHTML = options;
                if (currentVal) sel.value = currentVal;
            });

            // Populate modal selects
            const discSku = document.getElementById('disc-sku');
            if (discSku) discSku.innerHTML = options;
            const returnSku = document.getElementById('return-sku');
            if (returnSku) returnSku.innerHTML = options;
        }
    } catch (e) {
        console.error("Error loading inventory:", e);
    }
}

function setupTransferContainerListeners() {
    const container = document.getElementById('transferLinesContainer');
    const btnAdd = document.getElementById('btnAddTransferLine');

    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            const line = document.createElement('div');
            line.className = "transfer-line p-2.5 rounded-lg bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border border-slate-200";
            line.innerHTML = `
                <div class="relative flex-1">
                    <select class="transfer-sku w-full h-9 px-3 pr-8 rounded-lg bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 border border-slate-300 cursor-pointer">
                        ${window.inventoryOptionsHtml}
                    </select>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" class="btnQtyMinus w-8 h-9 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-bold">
                        <span class="material-symbols-outlined text-[15px]">remove</span>
                    </button>
                    <input class="transfer-qty w-14 h-9 text-center text-xs font-bold num-tabular bg-white border border-slate-300 text-slate-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500" min="1" type="number" value="10">
                    <button type="button" class="btnQtyPlus w-8 h-9 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-bold">
                        <span class="material-symbols-outlined text-[15px]">add</span>
                    </button>
                    <button type="button" class="btnRemoveLine w-8 h-9 rounded-lg text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors" title="Supprimer la ligne">
                        <span class="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                </div>
            `;
            container.appendChild(line);
        });
    }

    if (container) {
        container.addEventListener('click', (e) => {
            // Stepper minus
            const btnMinus = e.target.closest('.btnQtyMinus');
            if (btnMinus) {
                const input = btnMinus.parentElement.querySelector('.transfer-qty');
                if (input && parseInt(input.value, 10) > 1) {
                    input.value = parseInt(input.value, 10) - 1;
                }
            }

            // Stepper plus
            const btnPlus = e.target.closest('.btnQtyPlus');
            if (btnPlus) {
                const input = btnPlus.parentElement.querySelector('.transfer-qty');
                if (input) {
                    input.value = parseInt(input.value, 10) + 1;
                }
            }

            // Remove line
            const btnRemove = e.target.closest('.btnRemoveLine');
            if (btnRemove) {
                const lines = document.querySelectorAll('.transfer-line');
                if (lines.length > 1) {
                    btnRemove.closest('.transfer-line').remove();
                } else {
                    alert('Le bordereau de transfert doit comporter au moins un article.');
                }
            }
        });
    }
}

// Submit Transfer
const formTransfer = document.getElementById('transferForm');
if (formTransfer) {
    formTransfer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const lines = document.querySelectorAll('.transfer-line');
        const payload = [];

        lines.forEach(line => {
            const sku = line.querySelector('.transfer-sku')?.value;
            const qty = parseInt(line.querySelector('.transfer-qty')?.value, 10);
            if (sku && qty > 0) {
                payload.push({ product_sku: sku, quantity: qty });
            }
        });

        if (payload.length === 0) return;

        const btnSubmit = document.getElementById('btnSubmitTransfer');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Transfert en cours...";
        }

        try {
            const promises = payload.map(item => apiCall('/warehouse/transfers', {
                method: 'POST',
                body: JSON.stringify(item)
            }));

            const results = await Promise.all(promises);
            const allSuccess = results.every(res => res && res.status === 200);

            if (allSuccess) {
                const summary = payload.map(p => `${p.quantity}x ${p.product_sku}`).join(', ');
                alert(`✅ Transfert validé avec succès !\n${summary} assigné(s) au poste Packer.`);

                // Update recent transfer strip
                const recentText = document.getElementById('recentTransferText');
                if (recentText) {
                    recentText.innerHTML = `<strong>Dernier transfert :</strong> ${summary} vers Table 01 (Packer) à ${new Date().toLocaleTimeString('fr-FR')}`;
                }

                // Refresh inventory stock
                await loadInventory();

                // Reset transfer form to single line
                const allLines = document.querySelectorAll('.transfer-line');
                for (let i = 1; i < allLines.length; i++) allLines[i].remove();
                if (allLines[0]) allLines[0].querySelector('.transfer-qty').value = 10;
            } else {
                alert("Une erreur est survenue lors de la création de certains transferts.");
            }
        } catch (err) {
            console.error("Transfer error:", err);
            alert("Erreur de connexion lors du transfert.");
        } finally {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = `<span class="material-symbols-outlined text-[18px]">move_up</span><span>Transférer au Packer</span>`;
            }
        }
    });
}

// ----------------------------------------------------
// STATE 2: Orders & Outbound Logistics Table
// ----------------------------------------------------
async function loadOrders() {
    try {
        const res = await apiCall('/warehouse/orders');
        if (res && res.status === 200) {
            const orders = await res.json();
            window.allOrders = orders || [];

            // Smart Date Handling on load:
            // If today has confirmed orders, keep [Today, Today].
            // If today has no orders yet (e.g. morning shift before Fatima Zahra inputs today's batch),
            // reset the date inputs so Karime sees the current latest batch of orders immediately!
            const today = new Date().toISOString().split('T')[0];
            const hasTodayOrders = window.allOrders.some(o => window.getOrderDateStr(o) === today);
            const dateStartInput = document.getElementById('dateStartInput');
            const dateEndInput = document.getElementById('dateEndInput');

            if (!hasTodayOrders && dateStartInput && dateEndInput && dateStartInput.value === today && dateEndInput.value === today) {
                dateStartInput.value = '';
                dateEndInput.value = '';
            }

            // Smart Date Handling for Prepared Orders Tab:
            // If user hasn't manually selected a specific date, default to today IF today has prepared orders;
            // Otherwise, leave empty so Karime supervisor immediately sees the finished orders ready on dock!
            const datePreparesInput = document.getElementById('datePreparesInput');
            if (!window._userChangedDatePrepares && datePreparesInput) {
                const hasTodayPrepared = window.allOrders.some(o => 
                    ['READY', 'SHIPPED'].includes(o.status) && window.getPreparedOrderDateStr(o) === today
                );
                datePreparesInput.value = hasTodayPrepared ? today : '';
            }

            updateLogisticsMetrics();
            window.renderLogisticsTable();
        }

    } catch (e) {
        console.error("Error loading orders:", e);
    }
}

// ----------------------------------------------------
// 10-MINUTE RECURRING AUTO-SYNC ENGINE (Karime Dock Oversight)
// ----------------------------------------------------
const AUTO_SYNC_INTERVAL_SEC = 10 * 60; // 600s = 10 minutes
let autoSyncRemaining = AUTO_SYNC_INTERVAL_SEC;
let autoSyncIntervalHandle = null;

window.resetAutoSyncTimer = function() {
    autoSyncRemaining = AUTO_SYNC_INTERVAL_SEC;
    updateAutoSyncDisplay();
};

function updateAutoSyncDisplay() {
    const el = document.getElementById('auto-sync-countdown');
    if (!el) return;
    const mins = Math.floor(autoSyncRemaining / 60);
    const secs = autoSyncRemaining % 60;
    el.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

window.triggerAutoSyncTick = async function() {
    if (autoSyncRemaining > 0) {
        autoSyncRemaining--;
        updateAutoSyncDisplay();
    }
    if (autoSyncRemaining <= 0) {
        autoSyncRemaining = AUTO_SYNC_INTERVAL_SEC;
        updateAutoSyncDisplay();
        await window.runSilentAutoSync();
    }
};

window.runSilentAutoSync = async function() {
    const badge = document.getElementById('auto-sync-status-badge');
    const dot = badge ? badge.querySelector('span.rounded-full') : null;
    if (badge) badge.classList.add('ring-1', 'ring-brand-400');
    if (dot) dot.classList.add('animate-spin');

    try {
        const syncRes = await apiCall('/warehouse/sync', { method: 'POST' });
        if (syncRes && syncRes.status === 200) {
            const syncData = await syncRes.json();
            if (syncData.synced_new > 0 || syncData.updated > 0) {
                const res2 = await apiCall('/warehouse/orders');
                if (res2 && res2.status === 200) {
                    window.allOrders = await res2.json();
                    updateLogisticsMetrics();
                    window.renderLogisticsTable();
                    if (typeof window.renderPreparedOrdersTable === 'function') {
                        window.renderPreparedOrdersTable();
                    }
                }
                if (syncData.synced_new > 0) {
                    window.showToast("Synchro 10 min", `${syncData.synced_new} nouvelle(s) commande(s) intégrée(s) au quai.`, "success");
                } else if (syncData.updated > 0) {
                    window.showToast("Synchro 10 min", `${syncData.updated} statut(s) mis à jour.`, "info");
                }
            }
        }
    } catch (err) {
        console.warn("Silent 10-min auto-sync note:", err);
    } finally {
        if (badge) badge.classList.remove('ring-1', 'ring-brand-400');
        if (dot) dot.classList.remove('animate-spin');
    }
};

function initAutoSyncEngine() {
    updateAutoSyncDisplay();
    if (!autoSyncIntervalHandle) {
        autoSyncIntervalHandle = setInterval(window.triggerAutoSyncTick, 1000);
    }
    // Initial gentle sync once on load
    if (!window._initialAutoSyncTriggered) {
        window._initialAutoSyncTriggered = true;
        setTimeout(window.runSilentAutoSync, 1200);
    }
}

// Toast Feedback Notification for Karime Interface
window.showToast = function(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    const bgClass = isSuccess 
        ? 'bg-slate-900 text-white border border-emerald-500/30' 
        : (type === 'info' ? 'bg-slate-900 text-white border border-brand-500/30' : 'bg-rose-900 text-white border border-rose-700');
    const iconName = isSuccess ? 'check_circle' : (type === 'info' ? 'sync' : 'error');
    const iconColor = isSuccess ? 'text-emerald-400' : (type === 'info' ? 'text-brand-400' : 'text-rose-400');

    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl ${bgClass} transform transition-all duration-300 opacity-0 translate-y-2 pointer-events-auto text-xs`;
    toast.innerHTML = `
        <span class="material-symbols-outlined text-[20px] ${iconColor}">${iconName}</span>
        <div class="flex flex-col">
            <span class="font-bold text-[11px] uppercase tracking-wider">${title}</span>
            <span class="opacity-90 text-[11px]">${message}</span>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

window.getOrderCarrier = function(o) {
    if (!o) return 'Digylog Express';
    if (o.carrier && o.carrier.trim()) {
        const c = o.carrier.trim();
        const clow = c.toLowerCase();
        if (clow.includes('hub') || clow.includes('au hub') || clow.includes('ah hub')) return 'Au Hub Network';
        if (clow.includes('fret')) return 'Digylog Fret';
        return c;
    }
    if (o.type === 'B2B') return 'Digylog Fret';
    const trk = (o.tracking_number || '').toUpperCase();
    const city = (o.city || '').toLowerCase();
    const client = (o.client_name || '').toLowerCase();
    if (trk.startsWith('AU') || trk.includes('AU-') || trk.startsWith('AH') || trk.includes('AH-') || trk.includes('HUB') || 
        city.includes('au hub') || client.includes('au hub') || city.includes('ah hub') || client.includes('ah hub')) {
        return 'Au Hub Network';
    }
    return 'Digylog Express';
};

window.getOrderDateStr = function(o) {
    if (!o) return '';
    const raw = o.created_at || o.packed_at;
    if (!raw) return '';
    try {
        if (typeof raw === 'string') {
            if (raw.length >= 10 && raw[4] === '-' && raw[7] === '-') {
                return raw.substring(0, 10);
            }
        }
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    } catch (e) {
        // fallback
    }
    return String(raw).substring(0, 10);
};

window.getPreparedOrderDateStr = function(o) {
    if (!o) return '';
    // For prepared/packed orders, prioritize the actual preparation date (packed_at) over order creation date
    const raw = o.packed_at || o.created_at;
    if (!raw) return '';
    try {
        if (typeof raw === 'string') {
            if (raw.length >= 10 && raw[4] === '-' && raw[7] === '-') {
                return raw.substring(0, 10);
            }
        }
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    } catch (e) {
        // fallback
    }
    return String(raw).substring(0, 10);
};

window.getLatestOrdersDate = function() {
    const orders = window.allOrders || [];
    for (const o of orders) {
        const d = window.getOrderDateStr(o);
        if (d) return d;
    }
    return new Date().toISOString().split('T')[0];
};

window.setDateFilterToday = function() {
    const today = new Date().toISOString().split('T')[0];
    const s = document.getElementById('dateStartInput');
    const e = document.getElementById('dateEndInput');
    if (s) s.value = today;
    if (e) e.value = today;
    window.currentLogisticsPage = 1;
    updateLogisticsMetrics();
    window.renderLogisticsTable();
};

window.setDateFilterLatest = function() {
    const latestDate = window.getLatestOrdersDate();
    const s = document.getElementById('dateStartInput');
    const e = document.getElementById('dateEndInput');
    if (s) s.value = latestDate;
    if (e) e.value = latestDate;
    window.currentLogisticsPage = 1;
    updateLogisticsMetrics();
    window.renderLogisticsTable();
};

window.clearDateFilter = function() {
    const s = document.getElementById('dateStartInput');
    const e = document.getElementById('dateEndInput');
    if (s) s.value = '';
    if (e) e.value = '';
    window.currentLogisticsPage = 1;
    updateLogisticsMetrics();
    window.renderLogisticsTable();
};

function updateLogisticsMetrics() {
    const orders = window.allOrders || [];
    const today = new Date().toISOString().split('T')[0];
    const startDate = document.getElementById('dateStartInput')?.value;
    const endDate = document.getElementById('dateEndInput')?.value;

    // Filter by date for the "Total Jour" counter
    const dateFiltered = orders.filter(o => {
        const orderDate = window.getOrderDateStr(o);
        if (startDate || endDate) {
            if (!orderDate) return false;
            if (startDate && orderDate < startDate) return false;
            if (endDate && orderDate > endDate) return false;
        }
        return true;
    });

    const totalOrdersEl = document.getElementById('metric-total-orders');
    if (totalOrdersEl) {
        if (startDate && endDate && startDate === endDate) {
            totalOrdersEl.innerText = `${dateFiltered.length} colis (${startDate === today ? "aujourd'hui" : startDate})`;
        } else if (startDate || endDate) {
            totalOrdersEl.innerText = `${dateFiltered.length} colis (filtrés)`;
        } else {
            const todayCount = orders.filter(o => window.getOrderDateStr(o) === today).length;
            totalOrdersEl.innerText = `${todayCount} colis (aujourd'hui)`;
        }
    }

    const inTransit = orders.filter(o => ['PENDING_PACKING', 'READY', 'SHIPPED'].includes(o.status));
    const transitEl = document.getElementById('metric-transit-orders');
    if (transitEl) {
        if (startDate || endDate) {
            const inTransitFiltered = dateFiltered.filter(o => ['PENDING_PACKING', 'READY', 'SHIPPED'].includes(o.status));
            transitEl.innerText = `${inTransitFiltered.length} colis`;
        } else {
            transitEl.innerText = `${inTransit.length} colis`;
        }
    }

    // Determine target pool for filter pills: if date range is applied, use dateFiltered; otherwise use all orders
    const targetPool = (startDate || endDate) ? dateFiltered : orders;

    // Update filter counts
    const b2bCount = targetPool.filter(o => o.type === 'B2B').length;
    const b2cCount = targetPool.filter(o => o.type === 'B2C').length;
    const encoursCount = targetPool.filter(o => ['PENDING_PACKING', 'READY', 'SHIPPED'].includes(o.status)).length;
    const auHubCount = targetPool.filter(o => window.getOrderCarrier(o) === 'Au Hub Network').length;

    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(p => {
        const filter = p.getAttribute('data-filter');
        if (filter === 'all') p.innerText = `Tous (${targetPool.length})`;
        else if (filter === 'B2B') p.innerText = `B2B (${b2bCount})`;
        else if (filter === 'B2C') p.innerText = `B2C (${b2cCount})`;
        else if (filter === 'au_hub_network' || filter === 'au_hub' || filter === 'ah_hub_network' || filter === 'ah_hub') p.innerText = `Au Hub Network (${auHubCount})`;
        else if (filter === 'encours') p.innerText = `En cours (${encoursCount})`;
    });

    // Update prepares badge in sidebar
    const preparedOrders = orders.filter(o => ['READY', 'SHIPPED'].includes(o.status));
    const badgePrepares = document.getElementById('badge-nav-prepares');
    if (badgePrepares) badgePrepares.innerText = `${preparedOrders.length}`;
}

window.changeLogisticsPage = function(delta) {
    window.currentLogisticsPage += delta;
    window.renderLogisticsTable();
};

window.goToLogisticsPage = function(page) {
    window.currentLogisticsPage = page;
    window.renderLogisticsTable();
};

window.goToLastLogisticsPage = function() {
    window.currentLogisticsPage = window.totalLogisticsPages || 1;
    window.renderLogisticsTable();
};

window.changeLogisticsPageSize = function(val) {
    window.logisticsPageSize = val === 'all' ? 'all' : parseInt(val, 10);
    window.currentLogisticsPage = 1;
    window.renderLogisticsTable();
};

function updatePaginationUI(totalFiltered, pageSize, totalPages, startIndex, endIndex) {
    const footerCount = document.getElementById('logistics-footer-count');
    const indicator = document.getElementById('logistics-page-indicator');
    const btnFirst = document.getElementById('btn-first-page');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    const btnLast = document.getElementById('btn-last-page');

    window.totalLogisticsPages = totalPages;

    if (footerCount) {
        if (totalFiltered === 0) {
            footerCount.innerText = "0 colis trouvé";
        } else {
            const totalOrders = window.allOrders?.length || 0;
            const filterNote = totalFiltered < totalOrders ? ` (sur ${totalOrders} au total)` : '';
            footerCount.innerText = `Colis ${startIndex + 1}–${endIndex} sur ${totalFiltered}${filterNote}`;
        }
    }

    if (indicator) {
        indicator.innerText = `${totalFiltered === 0 ? 0 : window.currentLogisticsPage} / ${totalPages}`;
    }

    const isFirst = window.currentLogisticsPage <= 1 || totalFiltered === 0;
    const isLast = window.currentLogisticsPage >= totalPages || totalFiltered === 0;

    if (btnFirst) btnFirst.disabled = isFirst;
    if (btnPrev) btnPrev.disabled = isFirst;
    if (btnNext) btnNext.disabled = isLast;
    if (btnLast) btnLast.disabled = isLast;
}

window.renderLogisticsTable = function() {
    const tbody = document.getElementById('ops-logistics-body');
    if (!tbody) return;

    const query = (document.getElementById('orderSearchInput')?.value || '').toLowerCase().trim();
    const filter = window.activeFilter || 'all';
    const startDate = document.getElementById('dateStartInput')?.value;
    const endDate = document.getElementById('dateEndInput')?.value;

    const orders = window.allOrders || [];
    const filtered = orders.filter(o => {
        // 1. Date range match
        let matchesDate = true;
        const orderDate = window.getOrderDateStr(o);
        if (startDate || endDate) {
            if (!orderDate) {
                matchesDate = false;
            } else {
                if (startDate && orderDate < startDate) matchesDate = false;
                if (endDate && orderDate > endDate) matchesDate = false;
            }
        }

        // 2. Search query match (tracking number, client, city, or carrier)
        const carrier = window.getOrderCarrier(o);
        const matchesQuery = !query ||
            (o.tracking_number && o.tracking_number.toLowerCase().includes(query)) ||
            (o.client_name && o.client_name.toLowerCase().includes(query)) ||
            (o.city && o.city.toLowerCase().includes(query)) ||
            (carrier && carrier.toLowerCase().includes(query));

        // 3. Filter category match
        let matchesFilter = true;
        if (filter === 'B2B') matchesFilter = (o.type === 'B2B');
        else if (filter === 'B2C') matchesFilter = (o.type === 'B2C');
        else if (filter === 'au_hub_network' || filter === 'au_hub' || filter === 'ah_hub_network' || filter === 'ah_hub') {
            matchesFilter = (carrier === 'Au Hub Network' || carrier === 'AH Hub Network' || carrier.toLowerCase().includes('hub'));
        }
        else if (filter === 'encours') matchesFilter = ['PENDING_PACKING', 'READY', 'SHIPPED'].includes(o.status);

        return matchesDate && matchesQuery && matchesFilter;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        const isTodayOnly = (startDate === today && endDate === today);
        const latestDate = window.getLatestOrdersDate();
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-10 text-center text-slate-500">
                    <div class="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                        <span class="material-symbols-outlined text-slate-400 text-[32px]">inventory_2</span>
                        <div class="font-bold text-slate-800 text-sm">
                            ${isTodayOnly ? `Aucune commande saisie pour aujourd'hui (${today})` : 'Aucune expédition ne correspond à votre filtre'}
                        </div>
                        <div class="text-xs text-slate-500">
                            ${isTodayOnly 
                                ? `Fatima Zahra n'a pas encore saisi de nouvelles commandes aujourd'hui. Les dernières commandes confirmées datent du <strong>${latestDate}</strong>.` 
                                : 'Vérifiez la période sélectionnée ou réinitialisez le filtre pour afficher les commandes.'}
                        </div>
                        <div class="flex items-center gap-2 mt-2">
                            ${latestDate ? `
                                <button type="button" onclick="window.setDateFilterLatest()" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[15px]">history</span>
                                    <span>Voir le dernier arrivage (${latestDate})</span>
                                </button>
                            ` : ''}
                            <button type="button" onclick="window.clearDateFilter()" class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer flex items-center gap-1">
                                <span class="material-symbols-outlined text-[15px]">restart_alt</span>
                                <span>Toutes les dates</span>
                            </button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
        updatePaginationUI(0, 15, 1, 0, 0);
        return;
    }

    const totalFiltered = filtered.length;
    const pageSize = window.logisticsPageSize === 'all' ? totalFiltered : (parseInt(window.logisticsPageSize, 10) || 15);
    const totalPages = Math.max(1, Math.ceil(totalFiltered / (pageSize || 1)));

    if (window.currentLogisticsPage > totalPages) {
        window.currentLogisticsPage = totalPages;
    }
    if (window.currentLogisticsPage < 1) {
        window.currentLogisticsPage = 1;
    }

    const startIndex = (window.currentLogisticsPage - 1) * pageSize;
    const endIndex = window.logisticsPageSize === 'all' ? totalFiltered : Math.min(startIndex + pageSize, totalFiltered);
    const pageItems = filtered.slice(startIndex, endIndex);

    pageItems.forEach(o => {
        let typeBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">B2C</span>`;
        if (o.type === 'B2B') {
            typeBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-white">B2B Palettes</span>`;
        }

        let statusBadge = '';
        if (o.status === 'DELIVERED') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"><span class="material-symbols-outlined text-[13px]">check_circle</span>Livré</span>`;
        } else if (o.status === 'SHIPPED') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-brand-700 border border-brand-200"><span class="material-symbols-outlined text-[13px]">flight_takeoff</span>Expédié</span>`;
        } else if (o.status === 'READY') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200"><span class="material-symbols-outlined text-[13px]">done_all</span>Prêt Expédition</span>`;
        } else if (o.status === 'RETURNED') {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200"><span class="material-symbols-outlined text-[13px]">keyboard_return</span>Retourné</span>`;
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200"><span class="material-symbols-outlined text-[13px]">pending</span>En Préparation</span>`;
        }

        const carrierName = window.getOrderCarrier(o);
        const iconName = o.type === 'B2B' ? 'domain' : 'inventory_2';

        // Distinct carrier pill style
        let carrierPill = `
            <div class="inline-flex items-center gap-1.5 text-slate-700">
                <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                <span class="font-medium">${carrierName}</span>
            </div>
        `;
        if (carrierName === 'Digylog Fret') {
            carrierPill = `
                <div class="inline-flex items-center gap-1.5 text-indigo-900">
                    <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
                    <span class="font-bold">Digylog Fret</span>
                </div>
            `;
        } else if (carrierName === 'Au Hub Network' || carrierName === 'AH Hub Network') {
            carrierPill = `
                <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900">
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span class="font-bold">Au Hub Network</span>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/70 transition-colors";
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                <button type="button" onclick="window.openDigylogModal('${o.tracking_number}')" title="Cliquer pour voir le suivi Digylog en direct" class="flex items-center gap-1.5 group text-left hover:text-brand-600 transition-colors">
                    <span class="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-brand-600">${iconName}</span>
                    <span class="group-hover:underline">#${o.tracking_number}</span>
                    <span class="material-symbols-outlined text-[13px] text-brand-500 opacity-60 group-hover:opacity-100">travel_explore</span>
                </button>
            </td>
            <td class="py-2.5 px-4 whitespace-nowrap">${typeBadge}</td>
            <td class="py-2.5 px-4">
                <div class="font-bold text-slate-800 truncate max-w-[180px]">${o.client_name || 'Client Direct'}</div>
                <div class="text-[11px] text-slate-500">${o.city || 'Maroc'}</div>
            </td>
            <td class="py-2.5 px-4 whitespace-nowrap">
                ${carrierPill}
            </td>
            <td class="py-2.5 px-4 whitespace-nowrap">${statusBadge}</td>
            <td class="py-2.5 px-4 text-right text-slate-500 font-mono text-[11px] whitespace-nowrap">
                ${window.getOrderDateStr(o) || 'Aujourd\'hui'}
            </td>
        `;
        tbody.appendChild(tr);
    });

    updatePaginationUI(totalFiltered, pageSize, totalPages, startIndex, endIndex);
};

// ----------------------------------------------------
// STATE 3: MANIFESTE DES COLIS PRÉPARÉS & ENLÈVEMENT
// ----------------------------------------------------
window.changePreparesPage = function(delta) {
    window.currentPreparesPage += delta;
    window.renderPreparedOrdersTable();
};

window.renderPreparedOrdersTable = function() {
    const tbody = document.getElementById('prepares-logistics-body');
    if (!tbody) return;

    const query = (document.getElementById('searchPreparesInput')?.value || '').toLowerCase().trim();
    const carrierFilter = document.getElementById('carrierPreparesFilter')?.value || 'all';
    const dateFilter = document.getElementById('datePreparesInput')?.value || '';

    const orders = window.allOrders || [];
    // Filter for prepared packages (READY or SHIPPED)
    const prepared = orders.filter(o => ['READY', 'SHIPPED'].includes(o.status));

    // Update KPI counters
    const kpiTotal = document.getElementById('kpi-prepares-total');
    const kpiB2C = document.getElementById('kpi-prepares-b2c');
    const kpiB2B = document.getElementById('kpi-prepares-b2b');
    const totalCountBadge = document.getElementById('badge-prepares-total-count');

    const totalB2C = prepared.filter(o => o.type !== 'B2B').length;
    const totalB2B = prepared.filter(o => o.type === 'B2B').length;

    if (kpiTotal) kpiTotal.innerText = `${prepared.length}`;
    if (kpiB2C) kpiB2C.innerText = `${totalB2C}`;
    if (kpiB2B) kpiB2B.innerText = `${totalB2B}`;
    if (totalCountBadge) totalCountBadge.innerText = `${prepared.length} enregistrements`;

    // Filter by query, carrier, date
    const filtered = prepared.filter(o => {
        const matchesQuery = !query ||
            (o.tracking_number && o.tracking_number.toLowerCase().includes(query)) ||
            (o.client_name && o.client_name.toLowerCase().includes(query)) ||
            (o.city && o.city.toLowerCase().includes(query));

        let matchesCarrier = true;
        const oCarrier = window.getOrderCarrier(o);
        if (carrierFilter === 'Digylog Express') matchesCarrier = (oCarrier === 'Digylog Express');
        else if (carrierFilter === 'Digylog Fret') matchesCarrier = (oCarrier === 'Digylog Fret');
        else if (carrierFilter === 'Au Hub Network' || carrierFilter === 'AH Hub Network') matchesCarrier = (oCarrier === 'Au Hub Network' || oCarrier === 'AH Hub Network');

        let matchesDate = true;
        if (dateFilter) {
            const orderDate = window.getPreparedOrderDateStr(o);
            matchesDate = (orderDate === dateFilter);
        }

        return matchesQuery && matchesCarrier && matchesDate;
    });

    const kpiSub = document.getElementById('kpi-prepares-sub');
    if (kpiSub) {
        if (dateFilter) {
            kpiSub.innerText = `${filtered.length} affiché(s) pour le ${dateFilter}`;
        } else {
            kpiSub.innerText = `Tous les colis disponibles`;
        }
    }

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="py-10 text-center text-slate-500">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <span class="material-symbols-outlined text-3xl text-slate-300">inventory_2</span>
                        <p class="font-medium text-slate-600">Aucun colis préparé ne correspond à votre filtre${dateFilter ? ` pour la date du ${dateFilter}` : ''}.</p>
                        ${dateFilter ? `
                            <button type="button" onclick="window.clearDatePreparesFilter()" class="mt-1 px-3 py-1.5 text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 rounded-lg transition-colors border border-teal-200 flex items-center gap-1 cursor-pointer">
                                <span class="material-symbols-outlined text-[15px]">event_busy</span>
                                <span>Afficher tous les colis prêts (${prepared.length} au total)</span>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
        updatePreparesPaginationUI(0, 15, 1, 0, 0);
        return;
    }

    const totalFiltered = filtered.length;
    const pageSize = window.preparesPageSize || 15;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

    if (window.currentPreparesPage > totalPages) window.currentPreparesPage = totalPages;
    if (window.currentPreparesPage < 1) window.currentPreparesPage = 1;

    const startIndex = (window.currentPreparesPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalFiltered);
    const pageItems = filtered.slice(startIndex, endIndex);

    pageItems.forEach(o => {
        const isB2B = (o.type === 'B2B');
        const carrierName = window.getOrderCarrier(o);
        const typeBadge = isB2B 
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-white">B2B Palettes</span>`
            : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">B2C</span>`;

        const timeStr = o.packed_at ? new Date(o.packed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (o.created_at ? new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Aujourd\'hui');
        const itemsStr = (o.items && o.items.length > 0) ? o.items.map(it => `${it.quantity}x ${it.product_sku}`).join(', ') : 'Contenu standard';

        let carrierPill = `
            <div class="inline-flex items-center gap-1.5 text-slate-700">
                <span class="material-symbols-outlined text-[16px] text-brand-600">local_shipping</span>
                <span class="font-medium">${carrierName}</span>
            </div>
        `;
        if (carrierName === 'Au Hub Network' || carrierName === 'AH Hub Network') {
            carrierPill = `
                <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span>Au Hub Network</span>
                </div>
            `;
        } else if (carrierName === 'Digylog Fret') {
            carrierPill = `
                <div class="inline-flex items-center gap-1.5 text-indigo-900 font-bold">
                    <span class="material-symbols-outlined text-[16px] text-indigo-600">local_shipping</span>
                    <span>Digylog Fret</span>
                </div>
            `;
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[15px] text-teal-600">schedule</span>
                    <span>${timeStr}</span>
                </div>
            </td>
            <td class="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-slate-400">${isB2B ? 'domain' : 'inventory_2'}</span>
                    <span>#${o.tracking_number}</span>
                </div>
            </td>
            <td class="py-2.5 px-4 whitespace-nowrap">${typeBadge}</td>
            <td class="py-2.5 px-4">
                <div class="font-bold text-slate-800 truncate max-w-[170px]">${o.client_name || 'Client Direct'}</div>
                <div class="text-[11px] text-slate-500">${o.city || 'Maroc'}</div>
            </td>
            <td class="py-2.5 px-4 whitespace-nowrap">
                ${carrierPill}
            </td>
            <td class="py-2.5 px-4 font-mono text-[11px] text-slate-700 truncate max-w-[190px]" title="${itemsStr}">
                ${itemsStr}
            </td>
            <td class="py-2.5 px-4 whitespace-nowrap">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                    <span class="material-symbols-outlined text-[13px]">done_all</span>
                    ${o.status === 'READY' ? 'Prêt Expédition' : o.status}
                </span>
            </td>
            <td class="py-2.5 px-4 text-right text-slate-500 font-mono text-[11px] whitespace-nowrap">
                ${o.packed_by ? `Packer: ${o.packed_by}` : 'Poste Packer 01'}
            </td>
        `;
        tbody.appendChild(tr);
    });

    updatePreparesPaginationUI(totalFiltered, pageSize, totalPages, startIndex, endIndex);
};

function updatePreparesPaginationUI(totalFiltered, pageSize, totalPages, startIndex, endIndex) {
    const footerCount = document.getElementById('prepares-footer-count');
    const indicator = document.getElementById('prepares-page-indicator');
    const btnPrev = document.getElementById('btn-prepares-prev');
    const btnNext = document.getElementById('btn-prepares-next');

    window.totalPreparesPages = totalPages;

    if (footerCount) {
        if (totalFiltered === 0) {
            footerCount.innerText = "0 colis trouvé";
        } else {
            footerCount.innerText = `Colis ${startIndex + 1}–${endIndex} sur ${totalFiltered}`;
        }
    }

    if (indicator) {
        indicator.innerText = `${totalFiltered === 0 ? 0 : window.currentPreparesPage} / ${totalPages}`;
    }

    const isFirst = window.currentPreparesPage <= 1 || totalFiltered === 0;
    const isLast = window.currentPreparesPage >= totalPages || totalFiltered === 0;

    if (btnPrev) btnPrev.disabled = isFirst;
    if (btnNext) btnNext.disabled = isLast;
}

// Effacer le filtre de date pour afficher tous les colis prêts
window.clearDatePreparesFilter = function() {
    const dateInput = document.getElementById('datePreparesInput');
    if (dateInput) dateInput.value = '';
    window._userChangedDatePrepares = true;
    window.currentPreparesPage = 1;
    window.renderPreparedOrdersTable();
};

// Bouton dédié de supervision : actualise les commandes emballées/préparées par le packer
window.refreshPreparedOrders = async function() {
    const btn = document.getElementById('btn-refresh-prepares');
    const icon = document.getElementById('icon-refresh-prepares');
    if (icon) icon.classList.add('animate-spin');
    if (btn) btn.disabled = true;

    try {
        const res = await apiCall('/warehouse/orders');
        if (res && res.status === 200) {
            const orders = await res.json();
            window.allOrders = orders || [];
            window.renderPreparedOrdersTable();

            if (typeof window.showToast === 'function') {
                window.showToast("Colis Préparés", "Données actualisées depuis le poste emballage", "success");
            }
        }
    } catch (err) {
        console.error("Erreur actualisation colis préparés:", err);
        if (typeof window.showToast === 'function') {
            window.showToast("Erreur", "Impossible d'actualiser les colis", "error");
        }
    } finally {
        setTimeout(() => {
            if (icon) icon.classList.remove('animate-spin');
            if (btn) btn.disabled = false;
        }, 400);
    }
};

// Export Excel for Karime Prepared Orders Manifest
window.exportPreparedOrdersToExcel = function() {
    try {
        const table = document.getElementById('table-prepared-orders');
        if (!table) return;

        if (!window.XLSX) {
            alert("Module Excel (SheetJS) indisponible.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, "Bordereau_Colis_Prepares");
        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `NYRIX_Bordereau_Colis_Prepares_${today}.xlsx`);
    } catch (e) {
        console.error("Export error:", e);
        alert("Erreur lors de l'exportation du bordereau Excel: " + e.message);
    }
};

// Print Function for Karime Manifest
window.printPreparedOrders = function() {
    const prevPageSize = window.preparesPageSize;
    const prevPage = window.currentPreparesPage;

    // Set A4 landscape page orientation
    let printStyle = document.getElementById('dynamic-print-page-style');
    if (!printStyle) {
        printStyle = document.createElement('style');
        printStyle.id = 'dynamic-print-page-style';
        document.head.appendChild(printStyle);
    }
    printStyle.textContent = `@page { size: A4 landscape; margin: 8mm 10mm; }`;

    // Expand table to display all filtered rows on the printed document
    window.preparesPageSize = 999999;
    window.currentPreparesPage = 1;
    window.renderPreparedOrdersTable();

    // Populate manifest print header info
    const printDate = document.getElementById('print-manifest-date');
    if (printDate) {
        const now = new Date();
        printDate.innerText = now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    const carrierFilterVal = document.getElementById('carrierPreparesFilter')?.value || 'all';
    const printCarrier = document.getElementById('print-manifest-carrier');
    if (printCarrier) {
        printCarrier.innerText = carrierFilterVal === 'all' ? 'Transporteurs : Tous (Digylog)' : `Transporteur : ${carrierFilterVal}`;
    }

    const printTotal = document.getElementById('print-manifest-total');
    const totalCountBadge = document.getElementById('badge-prepares-total-count');
    if (printTotal && totalCountBadge) {
        printTotal.innerText = `Total : ${totalCountBadge.innerText}`;
    }

    // Trigger standard print
    setTimeout(() => {
        window.print();

        // Restore pagination view after print dialog closes
        window.preparesPageSize = prevPageSize || 15;
        window.currentPreparesPage = prevPage || 1;
        window.renderPreparedOrdersTable();
    }, 150);
};

// Also listen for Ctrl+P shortcut as fallback
window.addEventListener('beforeprint', () => {
    const preparesView = document.getElementById('view-prepares');
    if (preparesView && !preparesView.classList.contains('hidden')) {
        window._preparesSavedPageSize = window.preparesPageSize;
        window._preparesSavedPage = window.currentPreparesPage;
        window.preparesPageSize = 999999;
        window.currentPreparesPage = 1;
        window.renderPreparedOrdersTable();

        const printDate = document.getElementById('print-manifest-date');
        if (printDate) {
            const now = new Date();
            printDate.innerText = now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }
    }
});

window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-receipt');
    if (window._preparesSavedPageSize !== undefined) {
        window.preparesPageSize = window._preparesSavedPageSize;
        window.currentPreparesPage = window._preparesSavedPage || 1;
        delete window._preparesSavedPageSize;
        delete window._preparesSavedPage;
        window.renderPreparedOrdersTable();
    }
});

// Carrier Sync Action
window.syncCarrier = async function(btn) {
    const original = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">sync</span><span>Synchronisation en cours...</span>`;
    }

    try {
        const res = await apiCall('/warehouse/sync', { method: 'POST' });
        if (res && res.status === 200) {
            const data = await res.json();
            await loadOrders();
            if (typeof window.resetAutoSyncTimer === 'function') {
                window.resetAutoSyncTimer();
            }
            if (typeof loadInventory === 'function') {
                await loadInventory();
            }
            if (btn) {
                btn.innerHTML = `<span class="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span><span class="text-emerald-700">À jour (${data.synced_new || 0} nouv.)</span>`;
                setTimeout(() => {
                    btn.innerHTML = original;
                    btn.disabled = false;
                }, 3500);
            }
            alert(`✅ Synchronisation Réussie !\n\n• Commandes confirmées Google Sheet : ${data.total_sheet_confirmed || 0}\n• Nouvelles commandes importées : ${data.synced_new || 0}\n• Commandes mises à jour : ${data.updated || 0}\n• Total traité : ${data.total_processed || 0}`);
        } else {
            if (btn) {
                btn.innerHTML = original;
                btn.disabled = false;
            }
            alert("Erreur lors de la synchronisation des données.");
        }
    } catch (e) {
        console.error("Sync error:", e);
        if (btn) {
            btn.innerHTML = original;
            btn.disabled = false;
        }
        alert("Erreur de connexion lors de la synchronisation : " + (e.message || e));
    }
};

// ----------------------------------------------------
// STATE 2: Livre de Caisse (Digylog COD) & Factures
// ----------------------------------------------------
window.allCashInvoices = [];
window.activeCashInvoice = null;

function parseDriverRef(driverRef) {
    if (!driverRef) return { driver: '--', slip: '--', mode: 'Espèces', range: '' };
    const match = driverRef.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
        const driver = match[1].trim();
        const details = match[2].split('•').map(s => s.trim());
        const slip = details[0] || '--';
        const mode = details[1] || (driverRef.toLowerCase().includes('virement') ? 'Virement' : 'Espèces');
        const range = details[2] || '';
        return { driver, slip, mode, range };
    }
    const mode = driverRef.toLowerCase().includes('virement') ? 'Virement' : 'Espèces';
    return { driver: driverRef, slip: '--', mode, range: '' };
}

async function loadCOD() {
    try {
        const res = await apiCall('/warehouse/cod');
        if (res && res.status === 200) {
            const list = await res.json();
            window.allCashInvoices = list || [];
            const total = (list || []).reduce((sum, item) => sum + (item.amount_mad || 0), 0);

            const display = document.getElementById('totalCashDisplay');
            if (display) display.innerText = `${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD`;

            const recentList = document.getElementById('recentCashList');
            if (recentList) {
                if (!list || list.length === 0) {
                    recentList.innerHTML = `<span class="text-slate-400 italic text-center py-2">Aucun encaissement pour le moment.</span>`;
                } else {
                    recentList.innerHTML = '';
                    list.slice(0, 4).forEach(c => {
                        const parsed = parseDriverRef(c.driver_ref);
                        const row = document.createElement('div');
                        row.className = "flex items-center justify-between text-slate-700 py-1 hover:bg-slate-100/70 px-1.5 rounded transition-colors";
                        row.innerHTML = `
                            <div class="truncate pr-2">
                                <span class="font-medium text-slate-800">✓ ${parsed.driver}</span>
                                <span class="text-[10px] text-slate-400 block">${parsed.slip} • ${parsed.mode}</span>
                            </div>
                            <span class="font-mono font-bold text-emerald-700 shrink-0">+ ${(c.amount_mad || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} MAD</span>
                        `;
                        recentList.appendChild(row);
                    });
                }
            }

            // Also refresh cash modal table if currently open
            const cashModal = document.getElementById('modal-cash-invoices');
            if (cashModal && !cashModal.classList.contains('hidden')) {
                window.renderCashInvoicesTable();
            }
        }
    } catch (e) {
        console.error("Error loading COD:", e);
    }
}

const formCash = document.getElementById('cashForm');
if (formCash) {
    formCash.addEventListener('submit', async (e) => {
        e.preventDefault();
        const driverName = document.getElementById('livreurInput')?.value?.trim();
        const slipId = document.getElementById('bordereauInput')?.value?.trim();
        const dateDebut = document.getElementById('dateDebutCaisse')?.value;
        const dateFin = document.getElementById('dateFinCaisse')?.value;
        const modeReglement = document.getElementById('modeReglementSelect')?.value || 'especes';
        const amount = parseFloat(document.getElementById('montantInput')?.value) || 0;

        if (!driverName || amount <= 0) {
            alert("Veuillez renseigner un nom de livreur et un montant valide.");
            return;
        }

        const modeLabel = modeReglement === 'virement' ? 'Virement' : 'Espèces';
        const dateRangeInfo = (dateDebut && dateFin) ? ` • Du ${dateDebut} au ${dateFin}` : '';
        const driverRef = `${driverName} (${slipId || 'BORDEREAU-DIRECT'} • ${modeLabel}${dateRangeInfo})`;
        const btn = document.getElementById('btnSubmitCash');
        if (btn) btn.disabled = true;

        try {
            const res = await apiCall('/warehouse/cod', {
                method: 'POST',
                body: JSON.stringify({ driver_ref: driverRef, amount_mad: amount })
            });

            if (res && res.status === 200) {
                alert(`✅ Facture de caisse validée : ${amount.toFixed(2)} MAD (${modeLabel}) pour ${driverName} !`);
                await loadCOD();
                document.getElementById('montantInput').value = '';
            } else {
                alert("Erreur lors de l'enregistrement de la recette.");
            }
        } catch (err) {
            console.error("Cash error:", err);
            alert("Erreur réseau lors de l'enregistrement.");
        } finally {
            if (btn) btn.disabled = false;
        }
    });
}

// ----------------------------------------------------
// FACTURES DU LIVRE DE CAISSE (MODAL & VOUCHER VIEWER)
// ----------------------------------------------------
let cashModalListenersBound = false;
function setupCashModalListeners() {
    if (cashModalListenersBound) return;
    cashModalListenersBound = true;

    const s = document.getElementById('cash-modal-search');
    const ds = document.getElementById('cash-modal-date-start');
    const de = document.getElementById('cash-modal-date-end');
    const mf = document.getElementById('cash-modal-mode-filter');

    if (s) s.addEventListener('input', () => window.renderCashInvoicesTable());
    if (ds) ds.addEventListener('change', () => window.renderCashInvoicesTable());
    if (de) de.addEventListener('change', () => window.renderCashInvoicesTable());
    if (mf) mf.addEventListener('change', () => window.renderCashInvoicesTable());
}

window.openCashInvoicesModal = async function() {
    window.openModal('modal-cash-invoices');
    setupCashModalListeners();
    if (!window.allCashInvoices || window.allCashInvoices.length === 0) {
        await loadCOD();
    } else {
        window.renderCashInvoicesTable();
    }
};

window.renderCashInvoicesTable = function() {
    const tbody = document.getElementById('cash-modal-tbody');
    if (!tbody) return;

    const list = window.allCashInvoices || [];
    const query = (document.getElementById('cash-modal-search')?.value || '').toLowerCase().trim();
    const dateStart = document.getElementById('cash-modal-date-start')?.value;
    const dateEnd = document.getElementById('cash-modal-date-end')?.value;
    const modeFilter = document.getElementById('cash-modal-mode-filter')?.value || 'ALL';

    const filtered = list.filter(item => {
        const parsed = parseDriverRef(item.driver_ref);
        const itemDate = item.created_at ? item.created_at.split('T')[0] : '';

        // Date match
        if (dateStart && itemDate && itemDate < dateStart) return false;
        if (dateEnd && itemDate && itemDate > dateEnd) return false;

        // Mode match
        if (modeFilter === 'ESPECES' && parsed.mode.toLowerCase().includes('virement')) return false;
        if (modeFilter === 'VIREMENT' && !parsed.mode.toLowerCase().includes('virement')) return false;

        // Query match
        if (query) {
            const matchesQuery = item.driver_ref.toLowerCase().includes(query) ||
                (item.id && item.id.toLowerCase().includes(query)) ||
                parsed.driver.toLowerCase().includes(query) ||
                parsed.slip.toLowerCase().includes(query);
            if (!matchesQuery) return false;
        }

        return true;
    });

    // Update KPI badges in modal
    const total = filtered.reduce((s, i) => s + (i.amount_mad || 0), 0);
    const especesTotal = filtered
        .filter(i => !parseDriverRef(i.driver_ref).mode.toLowerCase().includes('virement'))
        .reduce((s, i) => s + (i.amount_mad || 0), 0);
    const virementTotal = filtered
        .filter(i => parseDriverRef(i.driver_ref).mode.toLowerCase().includes('virement'))
        .reduce((s, i) => s + (i.amount_mad || 0), 0);

    const kpiTotal = document.getElementById('cash-modal-kpi-total');
    const kpiCount = document.getElementById('cash-modal-kpi-count');
    const kpiEsp = document.getElementById('cash-modal-kpi-especes');
    const kpiVir = document.getElementById('cash-modal-kpi-virement');
    const footerCount = document.getElementById('cash-modal-footer-count');

    if (kpiTotal) kpiTotal.innerText = `${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD`;
    if (kpiCount) kpiCount.innerText = `${filtered.length} quittance${filtered.length > 1 ? 's' : ''}`;
    if (kpiEsp) kpiEsp.innerText = `${especesTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD`;
    if (kpiVir) kpiVir.innerText = `${virementTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD`;
    if (footerCount) footerCount.innerText = `${filtered.length} quittance(s) affichée(s) (sur ${list.length} au total)`;

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 italic">Aucune facture de caisse ne correspond à vos critères.</td></tr>`;
        return;
    }

    filtered.forEach((item, index) => {
        const parsed = parseDriverRef(item.driver_ref);
        const refNo = `FAC-CAISSE-${(item.id || '').substring(0, 8).toUpperCase() || (index + 1)}`;
        const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Aujourd\'hui';

        const isVirement = parsed.mode.toLowerCase().includes('virement');
        const modeBadge = isVirement 
            ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">Virement</span>`
            : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Espèces</span>`;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="py-2.5 px-3 font-mono font-bold text-brand-700 whitespace-nowrap">
                #${refNo}
            </td>
            <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                ${dateStr}
            </td>
            <td class="py-2.5 px-3">
                <div class="font-bold text-slate-800">${parsed.driver}</div>
                ${parsed.range ? `<div class="text-[10px] text-slate-400 font-mono">${parsed.range}</div>` : ''}
            </td>
            <td class="py-2.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                ${parsed.slip}
            </td>
            <td class="py-2.5 px-3 whitespace-nowrap">
                ${modeBadge}
            </td>
            <td class="py-2.5 px-3 text-right font-extrabold text-emerald-700 font-mono whitespace-nowrap">
                + ${(item.amount_mad || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD
            </td>
            <td class="py-2.5 px-3 text-center whitespace-nowrap">
                <button type="button" onclick="window.showCashReceiptDoc('${item.id}')" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-xs shadow-2xs transition-colors cursor-pointer" title="Voir et imprimer la quittance">
                    <span class="material-symbols-outlined text-[15px] text-emerald-600">print</span>
                    <span>Reçu</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.showCashReceiptDoc = function(id) {
    const item = (window.allCashInvoices || []).find(c => String(c.id) === String(id));
    if (!item) return;

    window.activeCashInvoice = item;
    const parsed = parseDriverRef(item.driver_ref);
    const refNo = `FAC-CAISSE-${(item.id || '').substring(0, 8).toUpperCase()}`;
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : new Date().toLocaleString('fr-FR');

    const elRef = document.getElementById('receipt-doc-ref');
    const elDate = document.getElementById('receipt-doc-date');
    const elDriver = document.getElementById('receipt-doc-driver');
    const elSlip = document.getElementById('receipt-doc-slip');
    const elMode = document.getElementById('receipt-doc-mode');
    const elAmount = document.getElementById('receipt-doc-amount');

    if (elRef) elRef.innerText = refNo;
    if (elDate) elDate.innerText = dateStr;
    if (elDriver) elDriver.innerText = parsed.driver;
    if (elSlip) elSlip.innerText = `${parsed.slip} ${parsed.range ? '• ' + parsed.range : ''}`;
    if (elMode) {
        elMode.innerText = parsed.mode;
        elMode.className = parsed.mode.toLowerCase().includes('virement')
            ? "font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[10px]"
            : "font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]";
    }
    if (elAmount) elAmount.innerText = `${(item.amount_mad || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD`;

    window.openModal('modal-print-cash-receipt');
};

window.printCashReceipt = function() {
    let printStyle = document.getElementById('dynamic-print-page-style');
    if (!printStyle) {
        printStyle = document.createElement('style');
        printStyle.id = 'dynamic-print-page-style';
        document.head.appendChild(printStyle);
    }
    printStyle.textContent = `@page { size: A4 portrait; margin: 12mm 15mm; }`;

    document.body.classList.add('printing-receipt');

    const cleanup = () => {
        document.body.classList.remove('printing-receipt');
        if (printStyle) printStyle.textContent = '';
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();
    setTimeout(cleanup, 2000);
};

window.exportCashInvoicesToExcel = function() {
    if (typeof XLSX === 'undefined') {
        alert("La bibliothèque SheetJS n'est pas encore prête.");
        return;
    }
    const list = window.allCashInvoices || [];
    if (list.length === 0) {
        alert("Aucune quittance à exporter.");
        return;
    }
    const rows = list.map((item, index) => {
        const parsed = parseDriverRef(item.driver_ref);
        return {
            "N° Quittance": `FAC-CAISSE-${(item.id || '').substring(0, 8).toUpperCase() || (index + 1)}`,
            "Date Heure": item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : '',
            "Nom Livreur": parsed.driver,
            "N° Bordereau / Tournée": parsed.slip,
            "Période": parsed.range,
            "Mode Règlement": parsed.mode,
            "Montant (MAD)": item.amount_mad || 0,
            "Superviseur": "Karime (Quai)"
        };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Livre_de_Caisse");
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `NYRIX_Livre_de_Caisse_${dateStr}.xlsx`);
};

// ----------------------------------------------------
// MODALS LOGIC
// ----------------------------------------------------

// Form Discrepancy
const formDiscrepancy = document.getElementById('form-discrepancy');
if (formDiscrepancy) {
    formDiscrepancy.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sku = document.getElementById('disc-sku')?.value;
        const qty = parseInt(document.getElementById('disc-qty')?.value, 10);
        const reason = document.getElementById('disc-reason')?.value;

        if (!sku || qty <= 0) {
            alert("Données d'écart invalides.");
            return;
        }

        try {
            const res = await apiCall('/warehouse/discrepancies', {
                method: 'POST',
                body: JSON.stringify({ product_sku: sku, quantity_missing: qty, reason: reason })
            });

            if (res && res.status === 200) {
                alert(`⚠️ Écart de ${qty}x ${sku} déclaré avec succès !\nEn attente d'approbation sur le tableau de bord d'Othmane (Admin).`);
                window.closeModal('modal-discrepancy');
            } else {
                alert("Erreur lors de la déclaration de l'écart.");
            }
        } catch (err) {
            console.error("Disc error:", err);
            alert("Erreur réseau.");
        }
    });
}

// Form Returns
const formReturns = document.getElementById('form-returns');
if (formReturns) {
    formReturns.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sku = document.getElementById('return-sku')?.value;
        const qty = parseInt(document.getElementById('return-qty')?.value, 10);
        const condition = document.querySelector('input[name="return-condition"]:checked')?.value;
        const isDamaged = (condition === 'damaged');
        const tracking = document.getElementById('return-tracking')?.value?.trim() || null;
        const reason = document.getElementById('return-reason')?.value?.trim() || null;

        if (!sku || qty <= 0) {
            alert("Données de retour invalides.");
            return;
        }

        try {
            const res = await apiCall('/warehouse/returns', {
                method: 'POST',
                body: JSON.stringify({ 
                    product_sku: sku, 
                    quantity: qty, 
                    is_damaged: isDamaged, 
                    is_shelf_damage: false,
                    tracking_number: tracking,
                    reason: reason
                })
            });

            if (res && res.status === 200) {
                const actionMsg = isDamaged ? "Isolé en zone Quarantaine (hors stock vendable)." : "Réintégré immédiatement au stock disponible.";
                alert(`✅ Retour de ${qty}x ${sku} enregistré !\n${actionMsg}`);
                window.closeModal('modal-returns');
                await loadInventory();
            } else {
                alert("Erreur lors du traitement du retour.");
            }
        } catch (err) {
            console.error("Return error:", err);
            alert("Erreur réseau.");
        }
    });
}

// Load Stock Ledger Audit History
async function loadLedgerHistory() {
    const tbody = document.getElementById('ledger-table-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400 italic">Chargement du journal d'audit...</td></tr>`;

    try {
        const res = await apiCall('/warehouse/ledger');
        if (res && res.status === 200) {
            const list = await res.json();
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400 italic">Aucun mouvement enregistré dans le ledger.</td></tr>`;
                return;
            }

            tbody.innerHTML = '';
            list.slice(-15).reverse().forEach(entry => {
                const tr = document.createElement('tr');
                const isPositive = entry.quantity > 0;
                const sign = isPositive ? '+' : '';
                const color = isPositive ? 'text-emerald-700' : 'text-rose-700';
                const dateStr = entry.created_at ? new Date(entry.created_at).toLocaleString('fr-FR') : 'Aujourd\'hui';

                tr.className = "hover:bg-slate-50 transition-colors";
                tr.innerHTML = `
                    <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap">${dateStr}</td>
                    <td class="py-2.5 px-3 font-mono font-bold text-slate-900">${entry.product_sku}</td>
                    <td class="py-2.5 px-3">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">${entry.action}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono font-bold ${color}">${sign}${entry.quantity}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("Ledger error:", e);
    }
};

// ----------------------------------------------------
// STATE 4: SUIVI EN DIRECT DIGYLOG API & SCAN TIMELINE
// ----------------------------------------------------
window.openDigylogModal = async function(trackingNumber) {
    const modal = document.getElementById('modal-digylog-track');
    if (!modal) return;

    document.getElementById('digylog-modal-tracking').innerText = `Colis #${trackingNumber}`;
    const badge = document.getElementById('digylog-modal-status-badge');
    badge.className = "px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 animate-pulse";
    badge.innerText = "Interrogation Digylog API...";

    document.getElementById('digylog-modal-client').innerText = "Chargement...";
    document.getElementById('digylog-modal-city').innerText = "--";
    document.getElementById('digylog-modal-phone').innerText = "--";
    document.getElementById('digylog-modal-price').innerText = "-- MAD";
    document.getElementById('digylog-modal-cash').innerText = "--";
    document.getElementById('digylog-modal-hub').innerText = "--";
    document.getElementById('digylog-modal-events-count').innerText = "0 étapes";
    document.getElementById('digylog-modal-timeline').innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs italic flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[18px] animate-spin text-brand-600">progress_activity</span>
            <span>Interrogation en direct de l'API Digylog Seller...</span>
        </div>
    `;

    modal.classList.remove('hidden');

    try {
        const resp = await apiCall(`/digylog/track/${encodeURIComponent(trackingNumber)}`);
        if (!resp || !resp.ok) {
            throw new Error(`Erreur HTTP ${resp ? resp.status : 'Connexion'}`);
        }
        const data = await resp.json();
        const local = data.local_order || {};
        const live = data.digylog_live || {};
        const history = data.history || [];

        const clientName = live.name || local.client_name || "Client Direct";
        const city = live.city || local.city || "Maroc";
        const phone = live.phone || "Non renseigné";
        const price = live.price !== undefined ? live.price : (local.cod_amount || 0);
        const cashStatus = live.cash_status || (local.payment_status === "PAID" ? "Versés" : "Non versés");
        const status = live.status || local.status || "En cours";
        const hub = live.location || live.hub || "Hub Régional";

        document.getElementById('digylog-modal-client').innerText = clientName;
        document.getElementById('digylog-modal-city').innerText = city;
        document.getElementById('digylog-modal-phone').innerText = phone;
        document.getElementById('digylog-modal-price').innerText = `${price} MAD`;
        document.getElementById('digylog-modal-cash').innerText = cashStatus;
        document.getElementById('digylog-modal-hub').innerText = hub;

        const isDelivered = String(status).toLowerCase().includes("livr") || local.status === "DELIVERED";
        const isReturned = String(status).toLowerCase().includes("retour") || local.status === "RETURNED";

        let badgeColor = "bg-blue-50 text-brand-700 border-brand-200";
        if (isDelivered) badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-200";
        else if (isReturned) badgeColor = "bg-rose-50 text-rose-800 border-rose-200";

        badge.className = `px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`;
        badge.innerText = status;

        document.getElementById('digylog-modal-events-count').innerText = `${history.length} scans enregistrés`;

        const timelineContainer = document.getElementById('digylog-modal-timeline');
        if (!history || history.length === 0) {
            timelineContainer.innerHTML = `
                <div class="p-4 rounded-xl bg-white border border-slate-200 text-center">
                    <span class="material-symbols-outlined text-[28px] text-slate-300">history_toggle_off</span>
                    <p class="text-xs text-slate-600 font-medium mt-1">Colis enregistré dans le système NYRIX</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">En attente de la transmission ou du premier scan physique au quai d'enlèvement.</p>
                </div>
            `;
        } else {
            timelineContainer.innerHTML = history.map((ev, idx) => {
                const rawDate = ev.date || ev.operationDate;
                const dateStr = rawDate ? new Date(rawDate).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '--';
                const isFinal = idx === 0;
                const scanTitle = ev.newValue || ev.newvalue || ev.type || 'Scan étape';
                return `
                    <div class="flex items-start gap-3 relative pb-2 ${idx !== history.length - 1 ? 'border-b border-slate-100' : ''}">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isFinal ? 'bg-brand-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'} text-[12px] font-bold">
                            <span class="material-symbols-outlined text-[14px]">${isFinal ? 'check' : 'radio_button_checked'}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-xs font-bold text-slate-900 truncate">${scanTitle}</span>
                                <span class="text-[10px] font-mono text-slate-400 whitespace-nowrap">${dateStr}</span>
                            </div>
                            <div class="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span class="material-symbols-outlined text-[13px] text-slate-400">pin_drop</span>
                                <span>${ev.location || 'Réseau National'}</span>
                                ${ev.oldValue ? `<span class="text-[10px] text-slate-400">(Avant: ${ev.oldValue})</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error("Error fetching Digylog live data:", err);
        document.getElementById('digylog-modal-timeline').innerHTML = `
            <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
                Impossible d'interroger l'API Digylog en direct : ${err.message || 'Erreur réseau'}
            </div>
        `;
    }
};
