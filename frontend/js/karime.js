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
    } else if (tab === 'prepares') {
        if (preparesView) preparesView.classList.remove('hidden');
        setActive(btnPrepares);
        if (breadcrumb) breadcrumb.innerText = "Colis Préparés & Manifeste d'Enlèvement";
        window.renderPreparedOrdersTable();
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
    // Start live clock
    updateClock();
    setInterval(updateClock, 1000);

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
    const dateStartInput = document.getElementById('dateStartInput');
    const dateEndInput = document.getElementById('dateEndInput');
    if (dateStartInput) dateStartInput.addEventListener('input', () => {
        window.currentLogisticsPage = 1;
        window.renderLogisticsTable();
    });
    if (dateEndInput) dateEndInput.addEventListener('input', () => {
        window.currentLogisticsPage = 1;
        window.renderLogisticsTable();
    });

    // Initialize default dates
    const today = new Date().toISOString().split('T')[0];
    const dateDebutCaisse = document.getElementById('dateDebutCaisse');
    const dateFinCaisse = document.getElementById('dateFinCaisse');
    if (dateDebutCaisse && !dateDebutCaisse.value) dateDebutCaisse.value = today;
    if (dateFinCaisse && !dateFinCaisse.value) dateFinCaisse.value = today;
    if (dateStartInput && !dateStartInput.value) dateStartInput.value = today;
    if (dateEndInput && !dateEndInput.value) dateEndInput.value = today;
    const datePreparesInput = document.getElementById('datePreparesInput');
    if (datePreparesInput && !datePreparesInput.value) datePreparesInput.value = today;

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
async function checkInboundShipments() {
    try {
        const res = await apiCall('/warehouse/inbound');
        if (res && res.status === 200) {
            const shipments = await res.json();
            const badgeCount = document.getElementById('inbound-pending-count');

            if (shipments && shipments.length > 0) {
                // Pending shipment found
                if (badgeCount) {
                    badgeCount.innerText = shipments.length;
                    badgeCount.classList.remove('hidden');
                }

                const latest = shipments[0];
                const invoiceRefEl = document.getElementById('inbound-invoice-ref');
                if (invoiceRefEl) invoiceRefEl.innerText = latest.invoice_ref || 'INB-ARRIVAGE';

                const arrivalBadge = document.getElementById('inbound-arrival-badge');
                if (arrivalBadge) {
                    arrivalBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">local_shipping</span> Arrivage ${latest.invoice_ref} • Quai Tit Mellil Quai A-04`;
                }

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
                        `;
                        tbody.appendChild(tr);
                    });

                    const totalQtyEl = document.getElementById('inbound-total-qty');
                    if (totalQtyEl) totalQtyEl.innerText = `${totalPieces.toLocaleString()} unités`;
                }

                // Open inbound view by default if pending shipment
                window.switchTab('inbound');
            } else {
                if (badgeCount) badgeCount.classList.add('hidden');
                // Open usual operations view
                window.switchTab('operations');
            }
        }
    } catch (e) {
        console.error("Error checking inbound shipments:", e);
    }
}

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
            updateLogisticsMetrics();
            window.renderLogisticsTable();
        }
    } catch (e) {
        console.error("Error loading orders:", e);
    }
}

function updateLogisticsMetrics() {
    const orders = window.allOrders || [];
    const totalOrdersEl = document.getElementById('metric-total-orders');
    if (totalOrdersEl) totalOrdersEl.innerText = `${orders.length} colis`;

    const inTransit = orders.filter(o => ['PENDING_PACKING', 'READY', 'SHIPPED'].includes(o.status));
    const transitEl = document.getElementById('metric-transit-orders');
    if (transitEl) transitEl.innerText = `${inTransit.length} colis`;

    // Update filter counts
    const b2bCount = orders.filter(o => o.type === 'B2B').length;
    const b2cCount = orders.filter(o => o.type === 'B2C').length;
    const encoursCount = inTransit.length;

    const pills = document.querySelectorAll('.filter-pill');
    pills.forEach(p => {
        const filter = p.getAttribute('data-filter');
        if (filter === 'all') p.innerText = `Tous (${orders.length})`;
        else if (filter === 'B2B') p.innerText = `B2B (${b2bCount})`;
        else if (filter === 'B2C') p.innerText = `B2C (${b2cCount})`;
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

    const orders = window.allOrders || [];
    const filtered = orders.filter(o => {
        // Query match
        const matchesQuery = !query ||
            (o.tracking_number && o.tracking_number.toLowerCase().includes(query)) ||
            (o.client_name && o.client_name.toLowerCase().includes(query)) ||
            (o.city && o.city.toLowerCase().includes(query));

        // Filter match
        let matchesFilter = true;
        if (filter === 'B2B') matchesFilter = (o.type === 'B2B');
        else if (filter === 'B2C') matchesFilter = (o.type === 'B2C');
        else if (filter === 'encours') matchesFilter = ['PENDING_PACKING', 'READY', 'SHIPPED'].includes(o.status);

        return matchesQuery && matchesFilter;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400 italic">Aucune expédition ne correspond à votre filtre.</td></tr>`;
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

        const carrierName = o.type === 'B2B' ? 'Digylog Fret' : 'Digylog Express';
        const iconName = o.type === 'B2B' ? 'domain' : 'inventory_2';

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
                <div class="inline-flex items-center gap-1.5 text-slate-700">
                    <span class="material-symbols-outlined text-[16px] text-brand-600">local_shipping</span>
                    <span class="font-medium">${carrierName}</span>
                </div>
            </td>
            <td class="py-2.5 px-4 whitespace-nowrap">${statusBadge}</td>
            <td class="py-2.5 px-4 text-right text-slate-500 font-mono text-[11px] whitespace-nowrap">
                Pointage Quai A4
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
        if (carrierFilter === 'Digylog Express') matchesCarrier = (o.type !== 'B2B');
        else if (carrierFilter === 'Digylog Fret') matchesCarrier = (o.type === 'B2B');

        let matchesDate = true;
        if (dateFilter) {
            const orderDate = o.packed_at ? o.packed_at.split('T')[0] : (o.created_at ? o.created_at.split('T')[0] : '');
            matchesDate = (orderDate === dateFilter);
        }

        return matchesQuery && matchesCarrier && matchesDate;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400 italic">Aucun colis préparé ne correspond à votre filtre.</td></tr>`;
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
        const carrierName = isB2B ? 'Digylog Fret' : 'Digylog Express';
        const typeBadge = isB2B 
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-white">B2B Palettes</span>`
            : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">B2C</span>`;

        const timeStr = o.packed_at ? new Date(o.packed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (o.created_at ? new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Aujourd\'hui');
        const itemsStr = (o.items && o.items.length > 0) ? o.items.map(it => `${it.quantity}x ${it.product_sku}`).join(', ') : 'Contenu standard';

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
                <div class="inline-flex items-center gap-1.5 text-slate-700">
                    <span class="material-symbols-outlined text-[16px] text-brand-600">local_shipping</span>
                    <span class="font-medium">${carrierName}</span>
                </div>
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
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">refresh</span><span>Synchronisation...</span>`;

    try {
        const res = await apiCall('/warehouse/sync', { method: 'POST' });
        if (res && res.status === 200) {
            await loadOrders();
            btn.innerHTML = `<span class="material-symbols-outlined text-[16px] text-emerald-600">check</span><span class="text-emerald-700">À jour (100%)</span>`;
            setTimeout(() => {
                btn.innerHTML = original;
                btn.disabled = false;
            }, 2000);
        } else {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    } catch (e) {
        console.error("Sync error:", e);
        btn.innerHTML = original;
        btn.disabled = false;
    }
};

// ----------------------------------------------------
// STATE 2: Livre de Caisse (Digylog COD)
// ----------------------------------------------------
async function loadCOD() {
    try {
        const res = await apiCall('/warehouse/cod');
        if (res && res.status === 200) {
            const list = await res.json();
            const total = list.reduce((sum, item) => sum + (item.amount_mad || 0), 0);

            const display = document.getElementById('totalCashDisplay');
            if (display) display.innerText = `${total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD`;

            const recentList = document.getElementById('recentCashList');
            if (recentList) {
                if (list.length === 0) {
                    recentList.innerHTML = `<span class="text-slate-400 italic text-center py-2">Aucun encaissement pour le moment.</span>`;
                } else {
                    recentList.innerHTML = '';
                    list.slice(-4).reverse().forEach(c => {
                        const row = document.createElement('div');
                        row.className = "flex items-center justify-between text-slate-700 py-0.5";
                        row.innerHTML = `
                            <span class="truncate font-medium">✓ ${c.driver_ref}</span>
                            <span class="font-mono font-bold text-emerald-700 shrink-0">+ ${(c.amount_mad || 0).toLocaleString(undefined, {minimumFractionDigits: 2})} MAD</span>
                        `;
                        recentList.appendChild(row);
                    });
                }
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
                alert(`✅ Recette de ${amount.toFixed(2)} MAD (${modeLabel}) enregistrée pour ${driverName} !`);
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
