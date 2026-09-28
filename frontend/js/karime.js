// NYRIX ERP - Karime Warehouse Controller (Inbound & Logistics Operations)

window.inventoryOptionsHtml = '';
window.allOrders = [];
window.activeFilter = 'all';

// Logout
window.logout = function() {
    localStorage.clear();
    window.location.href = '/';
};

// Tab Switcher between Inbound and Operations
window.switchTab = function(tab) {
    const inboundView = document.getElementById('view-inbound');
    const opsView = document.getElementById('view-operations');
    const btnOps = document.getElementById('nav-btn-ops');
    const btnInbound = document.getElementById('nav-btn-inbound');

    if (tab === 'inbound') {
        inboundView.classList.remove('hidden');
        opsView.classList.add('hidden');

        if (btnInbound) {
            btnInbound.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-brand-50 text-brand-700 border border-brand-200 flex items-center gap-1.5 relative";
        }
        if (btnOps) {
            btnOps.className = "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5";
        }
    } else {
        inboundView.classList.add('hidden');
        opsView.classList.remove('hidden');

        if (btnOps) {
            btnOps.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-brand-50 text-brand-700 border border-brand-200 flex items-center gap-1.5";
        }
        if (btnInbound) {
            btnInbound.className = "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 relative";
        }
    }
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
            window.renderLogisticsTable();
        });
    });

    // Setup search input
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', window.renderLogisticsTable);
    }

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
        return;
    }

    filtered.forEach(o => {
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
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-slate-400">${iconName}</span>
                    <span>#${o.tracking_number}</span>
                </div>
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

    const footerCount = document.getElementById('logistics-footer-count');
    if (footerCount) footerCount.innerText = `Affichage de ${filtered.length} sur ${orders.length} enregistrements`;
};

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
        const amount = parseFloat(document.getElementById('montantInput')?.value) || 0;

        if (!driverName || amount <= 0) {
            alert("Veuillez renseigner un nom de livreur et un montant valide.");
            return;
        }

        const driverRef = `${driverName} (${slipId || 'BORDEREAU-DIRECT'})`;
        const btn = document.getElementById('btnSubmitCash');
        if (btn) btn.disabled = true;

        try {
            const res = await apiCall('/warehouse/cod', {
                method: 'POST',
                body: JSON.stringify({ driver_ref: driverRef, amount_mad: amount })
            });

            if (res && res.status === 200) {
                alert(`✅ Recette de ${amount.toFixed(2)} MAD enregistrée pour ${driverName} !`);
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
}
