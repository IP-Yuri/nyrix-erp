// NYRIX ERP - B2B Commercial Manager JavaScript Core

window.logout = function() {
    localStorage.clear();
    window.location.href = '/';
};

let inventoryList = [];
let allOrders = [];
let currentOrderLines = [];
let currentFilter = 'all';
let searchQuery = '';

// Helper to format currency
function formatMAD(amount) {
    return (parseFloat(amount) || 0).toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' MAD';
}

// Toast notification system
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-secondary text-white' :
                    type === 'error' ? 'bg-error text-white' :
                    type === 'warning' ? 'bg-amber-600 text-white' :
                    'bg-slate-900 text-white';

    const icon = type === 'success' ? 'check_circle' :
                 type === 'error' ? 'error' :
                 type === 'warning' ? 'warning' : 'info';

    toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold pointer-events-auto transition-all transform duration-300 opacity-0 translate-y-2 ${bgClass}`;
    toast.innerHTML = `
        <span class="material-symbols-outlined text-lg">${icon}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Generate dynamic devis reference
function generateQuoteRef() {
    const now = new Date();
    const year = now.getFullYear();
    const rand = Math.floor(100 + Math.random() * 900);
    const badge = document.getElementById('quote-ref-badge');
    if (badge) {
        badge.textContent = `DEVIS #BC-${year}-${rand}`;
    }
}

// Initialize on page load
window.onload = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    generateQuoteRef();
    await loadInventory();
    restoreDraft();
    await loadOrders();
    setupEventListeners();
};

// 1. Load Inventory from /api/b2b/inventory
async function loadInventory() {
    try {
        const res = await apiCall('/b2b/inventory');
        if (res && res.status === 200) {
            inventoryList = await res.json();
            const sel = document.getElementById('sku-select');
            if (sel) {
                sel.innerHTML = '';
                if (inventoryList.length === 0) {
                    const opt = document.createElement('option');
                    opt.text = "Aucun produit en stock";
                    sel.appendChild(opt);
                    return;
                }

                inventoryList.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.sku;
                    opt.dataset.name = p.name || p.sku;
                    opt.dataset.stock = p.global_stock || 0;
                    opt.dataset.price = p.suggested_price || 150.0;
                    opt.text = `${p.sku} — ${p.name} (Stock: ${p.global_stock} u.)`;
                    sel.appendChild(opt);
                });

                // Trigger update
                updateStockAndPrice();
            }
        } else {
            showToast("Impossible de charger le catalogue de stock", "error");
        }
    } catch (err) {
        console.error("Erreur chargement inventaire:", err);
        showToast("Erreur de connexion au serveur", "error");
    }
}

function updateStockAndPrice() {
    const sel = document.getElementById('sku-select');
    const stockIndicator = document.getElementById('stock-indicator');
    const priceInput = document.getElementById('sku-price');
    const qtyInput = document.getElementById('sku-qty');
    if (!sel || !sel.selectedOptions[0]) return;

    const opt = sel.selectedOptions[0];
    const stock = parseInt(opt.dataset.stock || 0, 10);
    const price = parseFloat(opt.dataset.price || 150.0);

    if (stockIndicator) {
        if (stock > 0) {
            stockIndicator.textContent = `Stock dispo: ${stock} u.`;
            stockIndicator.className = "text-xs font-semibold px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/30";
        } else {
            stockIndicator.textContent = `Rupture de stock (0 u.)`;
            stockIndicator.className = "text-xs font-semibold px-2 py-0.5 rounded bg-error-container text-error border border-error/30";
        }
    }

    if (priceInput) {
        priceInput.value = price.toFixed(2);
    }

    if (qtyInput) {
        validateQuantity();
    }
}

function validateQuantity() {
    const sel = document.getElementById('sku-select');
    const qtyInput = document.getElementById('sku-qty');
    if (!sel || !sel.selectedOptions[0] || !qtyInput) return;

    const stock = parseInt(sel.selectedOptions[0].dataset.stock || 0, 10);
    const qty = parseInt(qtyInput.value, 10) || 0;

    if (qty > stock) {
        qtyInput.classList.add('border-amber-500', 'text-amber-700', 'bg-amber-50');
        qtyInput.title = `Attention: Quantité supérieure au stock entrepôt (${stock} u.)`;
    } else {
        qtyInput.classList.remove('border-amber-500', 'text-amber-700', 'bg-amber-50');
        qtyInput.title = "";
    }
}

// Add Item Line
function addItemLine() {
    const sel = document.getElementById('sku-select');
    if (!sel || !sel.value) return;

    const opt = sel.selectedOptions[0];
    const qty = parseInt(document.getElementById('sku-qty').value, 10);
    const price = parseFloat(document.getElementById('sku-price').value);

    if (!qty || qty <= 0) {
        showToast("La quantité doit être supérieure à 0", "warning");
        return;
    }
    if (isNaN(price) || price < 0) {
        showToast("Veuillez saisir un prix valide", "warning");
        return;
    }

    // Check if line with same SKU already exists
    const existing = currentOrderLines.find(l => l.sku === sel.value);
    if (existing) {
        existing.quantity += qty;
        existing.unit_price_mad = price;
    } else {
        currentOrderLines.push({
            sku: sel.value,
            name: opt.dataset.name,
            quantity: qty,
            unit_price_mad: price,
            stock: parseInt(opt.dataset.stock || 0, 10)
        });
    }

    renderLines();
    showToast(`Article ${sel.value} ajouté au bordereau`, "success");
}

window.removeLine = function(index) {
    if (index >= 0 && index < currentOrderLines.length) {
        const removed = currentOrderLines[index];
        currentOrderLines.splice(index, 1);
        renderLines();
        showToast(`Article ${removed.sku} supprimé`, "info");
    }
};

// Render Item Lines & Recalculate
function renderLines() {
    const container = document.getElementById('order-lines-container');
    const badgeCount = document.getElementById('items-count-badge');
    const summaryQty = document.getElementById('summary-total-qty');
    const summaryWeight = document.getElementById('summary-total-weight');
    if (!container) return;

    container.innerHTML = '';

    if (currentOrderLines.length === 0) {
        container.innerHTML = `
            <div class="py-8 text-center text-on-surface-variant bg-surface-container-low rounded-lg border border-dashed border-outline-variant/50">
                <span class="material-symbols-outlined text-3xl text-on-surface-variant/70">receipt</span>
                <p class="mt-1 text-sm font-medium">Aucun article dans ce bordereau commercial.</p>
                <p class="text-xs text-on-surface-variant/80">Sélectionnez un article et une quantité ci-dessus pour commencer.</p>
            </div>
        `;
        if (badgeCount) badgeCount.textContent = "0 article répertorié";
        if (summaryQty) summaryQty.textContent = "0 pièce";
        if (summaryWeight) summaryWeight.textContent = "0.0 kg";
        recalculateTotals(0);
        return;
    }

    let totalQty = 0;
    let totalBrut = 0;

    currentOrderLines.forEach((line, idx) => {
        const subtotal = line.quantity * line.unit_price_mad;
        totalBrut += subtotal;
        totalQty += line.quantity;

        const skuPrefix = line.sku.slice(0, 3).toUpperCase();

        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 gap-space-sm items-center py-3.5 px-4 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low transition-colors border border-outline-variant/40 shadow-sm';
        row.innerHTML = `
            <div class="col-span-12 sm:col-span-5 flex items-center gap-space-md">
                <div class="w-9 h-9 rounded bg-surface-container flex items-center justify-center text-primary font-bold text-xs shrink-0 shadow-sm">
                    ${skuPrefix}
                </div>
                <div class="flex flex-col min-w-0">
                    <span class="font-headline-sm text-headline-sm text-on-surface font-semibold truncate" title="${line.name}">${line.name}</span>
                    <span class="font-tabular text-body-sm text-on-surface-variant">
                        SKU: <strong class="text-on-surface">${line.sku}</strong> • Stock: ${line.stock} u.
                    </span>
                </div>
            </div>
            <div class="col-span-4 sm:col-span-2 text-right">
                <span class="font-tabular text-headline-sm font-semibold text-on-surface">${line.quantity}</span>
                <span class="font-label-sm text-on-surface-variant ml-1">unités</span>
            </div>
            <div class="col-span-4 sm:col-span-2 text-right">
                <span class="font-tabular text-body-md font-semibold text-on-surface">${line.unit_price_mad.toFixed(2)}</span>
                <span class="font-label-sm text-on-surface-variant ml-1">MAD</span>
            </div>
            <div class="col-span-3 sm:col-span-2 text-right">
                <span class="font-tabular text-headline-sm font-bold text-primary">${subtotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span class="font-label-sm text-primary ml-1">MAD</span>
            </div>
            <div class="col-span-1 flex justify-center">
                <button type="button" class="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container transition-colors cursor-pointer" onclick="window.removeLine(${idx})" title="Supprimer la ligne">
                    <span class="material-symbols-outlined text-lg">delete</span>
                </button>
            </div>
        `;
        container.appendChild(row);
    });

    if (badgeCount) {
        badgeCount.textContent = `${currentOrderLines.length} article${currentOrderLines.length > 1 ? 's' : ''} répertorié${currentOrderLines.length > 1 ? 's' : ''}`;
    }
    if (summaryQty) {
        summaryQty.textContent = `${totalQty} pièces`;
    }
    if (summaryWeight) {
        summaryWeight.textContent = `${(totalQty * 0.85).toFixed(1)} kg`;
    }

    recalculateTotals(totalBrut);
}

// Financial Recalculation
function recalculateTotals(brutHT = null) {
    if (brutHT === null) {
        brutHT = currentOrderLines.reduce((acc, l) => acc + (l.quantity * l.unit_price_mad), 0);
    }

    const discountSelect = document.getElementById('discount-select');
    const discountPct = parseFloat(discountSelect ? discountSelect.value : 5) || 0;
    const discountAmt = brutHT * (discountPct / 100);
    const baseHT = Math.max(0, brutHT - discountAmt);
    const tva = baseHT * 0.20;
    const totalTTC = baseHT + tva;

    const brutEl = document.getElementById('calc-brut-ht');
    const discBadge = document.getElementById('discount-pct-badge');
    const discAmtEl = document.getElementById('calc-discount-amt');
    const baseEl = document.getElementById('calc-base-ht');
    const tvaEl = document.getElementById('calc-tva');
    const totalEl = document.getElementById('order-total');

    if (brutEl) brutEl.textContent = formatMAD(brutHT);
    if (discBadge) discBadge.textContent = discountPct.toFixed(1) + '%';
    if (discAmtEl) discAmtEl.textContent = '-' + formatMAD(discountAmt);
    if (baseEl) baseEl.textContent = formatMAD(baseHT);
    if (tvaEl) tvaEl.textContent = formatMAD(tva);
    if (totalEl) totalEl.textContent = totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Draft Management
function saveDraft() {
    if (currentOrderLines.length === 0) {
        showToast("Rien à sauvegarder : bordereau vide", "warning");
        return;
    }

    const draft = {
        client_name: document.getElementById('client-name').value,
        city: document.getElementById('client-city').value,
        payment_method: document.getElementById('payment-method-select').value,
        discount: document.getElementById('discount-select').value,
        lines: currentOrderLines,
        timestamp: new Date().toISOString()
    };

    localStorage.setItem('nyrix_b2b_draft', JSON.stringify(draft));
    showToast("Brouillon sauvegardé localement", "success");
}

function restoreDraft() {
    const raw = localStorage.getItem('nyrix_b2b_draft');
    if (!raw) return;

    try {
        const draft = JSON.parse(raw);
        if (draft && draft.lines && draft.lines.length > 0) {
            if (draft.client_name) document.getElementById('client-name').value = draft.client_name;
            if (draft.city) document.getElementById('client-city').value = draft.city;
            if (draft.payment_method) document.getElementById('payment-method-select').value = draft.payment_method;
            if (draft.discount) document.getElementById('discount-select').value = draft.discount;

            currentOrderLines = draft.lines;
            renderLines();
            showToast("Brouillon précédent restauré", "info");
        }
    } catch (e) {
        console.error("Erreur restauration brouillon:", e);
    }
}

function clearOrder() {
    if (currentOrderLines.length === 0) return;
    if (confirm("Voulez-vous réinitialiser le bordereau en cours ?")) {
        currentOrderLines = [];
        localStorage.removeItem('nyrix_b2b_draft');
        renderLines();
        generateQuoteRef();
        showToast("Bordereau réinitialisé", "info");
    }
}

// 2. Generate B2B Order via API
async function generateB2BOrder() {
    const btn = document.getElementById('btnGenerateOrder');
    if (currentOrderLines.length === 0) {
        showToast("Veuillez ajouter au moins un article au bordereau", "warning");
        return;
    }

    const clientNameInput = document.getElementById('client-name');
    const clientCitySelect = document.getElementById('client-city');
    const paymentMethodSelect = document.getElementById('payment-method-select');
    const discountSelect = document.getElementById('discount-select');

    const clientName = clientNameInput ? clientNameInput.value.trim() : "";
    const clientCity = clientCitySelect ? clientCitySelect.value : "Casablanca Port";
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : "VIREMENT";
    const discountPct = parseFloat(discountSelect ? discountSelect.value : 0);

    if (!clientName) {
        showToast("Le nom ou la raison sociale du client est requis", "warning");
        clientNameInput?.focus();
        return;
    }

    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">refresh</span><span>Émission Sécurisée...</span>';
    btn.classList.add('opacity-80', 'pointer-events-none');

    // Build API payload compatible with both legacy and new schema
    const payload = {
        client_name: clientName,
        city: clientCity,
        payment_method: paymentMethod,
        discount_pct: discountPct,
        items: currentOrderLines.map(l => ({
            product_sku: l.sku,
            sku: l.sku,
            quantity: parseInt(l.quantity, 10),
            unit_price: parseFloat(l.unit_price_mad),
            unit_price_mad: parseFloat(l.unit_price_mad)
        }))
    };

    try {
        const res = await apiCall('/b2b/orders', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (res && res.status === 200) {
            const newOrder = await res.json();

            btn.innerHTML = '<span class="material-symbols-outlined text-lg">check_circle</span><span>Commande B2B Transmise !</span>';
            btn.classList.remove('bg-primary-container', 'hover:bg-primary');
            btn.classList.add('bg-secondary');

            showToast(`Commande ${newOrder.tracking_number} émise avec succès !`, "success");

            // Clear draft and lines
            currentOrderLines = [];
            localStorage.removeItem('nyrix_b2b_draft');
            renderLines();
            generateQuoteRef();

            // Refresh live tracking table
            await loadOrders();

            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('opacity-80', 'pointer-events-none', 'bg-secondary');
                btn.classList.add('bg-primary-container', 'hover:bg-primary');
            }, 2500);
        } else {
            let errorMsg = "Erreur lors de la création de la commande";
            if (res) {
                try {
                    const errData = await res.json();
                    if (errData && errData.detail) {
                        errorMsg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
                    }
                } catch (e) {}
            }

            btn.innerHTML = '<span class="material-symbols-outlined text-lg">error</span><span>Échec Transmission</span>';
            btn.classList.add('bg-error');
            showToast(errorMsg, "error");

            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('opacity-80', 'pointer-events-none', 'bg-error');
            }, 2500);
        }
    } catch (err) {
        console.error("Erreur émission B2B:", err);
        btn.innerHTML = originalHtml;
        btn.classList.remove('opacity-80', 'pointer-events-none');
        showToast("Erreur de connexion serveur", "error");
    }
}

// 3. Load Orders Table from GET /api/b2b/orders
async function loadOrders() {
    const tbody = document.getElementById('tracking-body');
    if (!tbody) return;

    try {
        const res = await apiCall('/b2b/orders');
        if (res && res.status === 200) {
            allOrders = await res.json();
            renderOrdersTable();
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-6 text-center text-error text-sm">
                        Impossible de charger les commandes B2B.
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error("Erreur chargement commandes B2B:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-6 text-center text-error text-sm">
                    Erreur de connexion au serveur.
                </td>
            </tr>
        `;
    }
}

function renderOrdersTable() {
    const tbody = document.getElementById('tracking-body');
    const countAll = document.getElementById('count-all');
    const countUnpaid = document.getElementById('count-unpaid');
    const countPaid = document.getElementById('count-paid');
    const paginationInfo = document.getElementById('orders-pagination-info');
    if (!tbody) return;

    // Filter by tab
    let filtered = allOrders;
    if (currentFilter === 'unpaid') {
        filtered = allOrders.filter(o => o.payment_status === 'UNPAID');
    } else if (currentFilter === 'paid') {
        filtered = allOrders.filter(o => o.payment_status === 'PAID');
    }

    // Filter by search query
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(o =>
            (o.tracking_number && o.tracking_number.toLowerCase().includes(q)) ||
            (o.client_name && o.client_name.toLowerCase().includes(q)) ||
            (o.city && o.city.toLowerCase().includes(q))
        );
    }

    // Update counts
    const unpaidCount = allOrders.filter(o => o.payment_status === 'UNPAID').length;
    const paidCount = allOrders.filter(o => o.payment_status === 'PAID').length;
    if (countAll) countAll.textContent = allOrders.length;
    if (countUnpaid) countUnpaid.textContent = unpaidCount;
    if (countPaid) countPaid.textContent = paidCount;
    if (paginationInfo) paginationInfo.textContent = `Affichage de ${filtered.length} sur ${allOrders.length} commandes`;

    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-on-surface-variant text-sm">
                    <span class="material-symbols-outlined text-3xl text-outline-variant mb-1">search_off</span>
                    <p>Aucune commande B2B trouvée correspondant à ces critères.</p>
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(o => {
        // Calculate total if not directly provided
        let totalTTC = o.total_amount_ttc || 0;
        if (!totalTTC && o.items) {
            const ht = o.items.reduce((acc, it) => acc + (it.quantity * (it.unit_price || 0)), 0);
            totalTTC = ht * 1.20;
        }

        // Logistics status badge
        let logisticBadge = '';
        if (o.status === 'READY') {
            logisticBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/15 text-secondary font-label-sm font-semibold"><span class="material-symbols-outlined text-sm">done_all</span>Prêt / Emballé</span>`;
        } else if (o.status === 'SHIPPED') {
            logisticBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary font-label-sm font-semibold"><span class="material-symbols-outlined text-sm">local_shipping</span>Expédié</span>`;
        } else {
            logisticBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 font-label-sm font-semibold"><span class="material-symbols-outlined text-sm">package_2</span>En Préparation</span>`;
        }

        // Payment status badge
        let paymentBadge = '';
        let paymentAction = '';
        if (o.payment_status === 'PAID') {
            paymentBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/15 text-secondary font-label-sm font-semibold"><span class="material-symbols-outlined text-sm">check_circle</span>Payé</span>`;
        } else {
            paymentBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error-container text-error font-label-sm font-semibold"><span class="material-symbols-outlined text-sm">schedule</span>En Attente</span>`;
            paymentAction = `
                <button type="button" class="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-secondary text-white hover:bg-secondary/90 font-label-md text-xs font-semibold transition-colors shadow-sm cursor-pointer" onclick="window.markPaid('${o.tracking_number}', this)">
                    <span class="material-symbols-outlined text-sm">task_alt</span>
                    <span>Valider Paiement</span>
                </button>
            `;
        }

        // Format created date
        let dateStr = "Aujourd'hui";
        if (o.created_at) {
            try {
                const d = new Date(o.created_at);
                dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-surface-container-low transition-colors border-b border-surface-container/60";
        tr.innerHTML = `
            <td class="py-3.5 px-4 font-tabular font-bold text-primary">${o.tracking_number}</td>
            <td class="py-3.5 px-4">
                <div class="font-semibold text-on-surface">${o.client_name}</div>
                <div class="text-xs text-on-surface-variant">${o.city || 'Casablanca'} • Réf: ${o.tracking_number.slice(-4)}</div>
            </td>
            <td class="py-3.5 px-4 font-tabular text-xs text-on-surface-variant">${dateStr}</td>
            <td class="py-3.5 px-4 text-right font-tabular font-bold text-on-surface">${formatMAD(totalTTC)}</td>
            <td class="py-3.5 px-4">${logisticBadge}</td>
            <td class="py-3.5 px-4">${paymentBadge}</td>
            <td class="py-3.5 px-4 text-right">
                <div class="flex items-center justify-end gap-1.5">
                    ${paymentAction}
                    <button type="button" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-xs font-semibold transition-colors cursor-pointer" onclick="window.viewInvoice('${o.tracking_number}')" title="Voir Facture">
                        <span class="material-symbols-outlined text-sm">receipt_long</span>
                        <span>Facture</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 4. Mark Payment Paid Action
window.markPaid = async function(trackingNumber, btn) {
    if (!confirm(`Confirmer la réception du virement bancaire pour la commande ${trackingNumber} ?`)) {
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-xs animate-spin">refresh</span><span>Validation...</span>';
    }

    try {
        const res = await apiCall(`/b2b/orders/${trackingNumber}/payment`, {
            method: 'PUT'
        });

        if (res && res.status === 200) {
            showToast(`Virement EBICS validé pour ${trackingNumber}`, "success");
            await loadOrders();
        } else {
            showToast("Erreur lors de la validation du paiement", "error");
            if (btn) btn.disabled = false;
        }
    } catch (err) {
        console.error("Erreur markPaid:", err);
        showToast("Erreur de connexion", "error");
        if (btn) btn.disabled = false;
    }
};

// 5. Invoice Modal Presentation
window.viewInvoice = function(trackingNumber) {
    const order = allOrders.find(o => o.tracking_number === trackingNumber);
    if (!order) {
        showToast("Commande introuvable", "error");
        return;
    }

    document.getElementById('inv-tracking-number').textContent = `#${order.tracking_number}`;

    let dateStr = "Date: 30/09/2026";
    if (order.created_at) {
        try {
            const d = new Date(order.created_at);
            dateStr = `Date: ${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        } catch (e) {}
    }
    document.getElementById('inv-date').textContent = dateStr;

    // Status stamp
    const stamp = document.getElementById('inv-status-stamp');
    if (order.payment_status === 'PAID') {
        stamp.textContent = 'PAYÉ (VIREMENT CONFIRMÉ)';
        stamp.className = 'inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 bg-emerald-100 text-emerald-800 border border-emerald-300';
    } else {
        stamp.textContent = 'EN ATTENTE DE VIREMENT';
        stamp.className = 'inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 bg-amber-100 text-amber-800 border border-amber-300';
    }

    document.getElementById('inv-client-name').textContent = order.client_name || 'Client B2B';
    document.getElementById('inv-client-city').textContent = `${order.city || 'Casablanca Port'} — Maroc`;
    document.getElementById('inv-payment-method').textContent = order.payment_method === 'VIREMENT_45J' ? 'Virement à 45 jours FdM' :
                                                                order.payment_method === 'LETTRE_CREDIT' ? 'Lettre de Crédit Irrévocable' :
                                                                order.payment_method === 'COMPTANT' ? 'Paiement Comptant' :
                                                                'Virement Bancaire (30 jours)';

    // Items table in invoice
    const invItemsBody = document.getElementById('inv-items-body');
    invItemsBody.innerHTML = '';

    let totalHT = 0;
    (order.items || []).forEach(item => {
        const itemSubtotal = item.quantity * (item.unit_price || 0);
        totalHT += itemSubtotal;

        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100";
        tr.innerHTML = `
            <td class="py-2.5 px-1 font-mono font-bold text-slate-800">${item.product_sku}</td>
            <td class="py-2.5 px-3 text-slate-700">${item.product_name || item.product_sku}</td>
            <td class="py-2.5 px-2 text-right font-semibold text-slate-900">${item.quantity}</td>
            <td class="py-2.5 px-3 text-right text-slate-700">${(item.unit_price || 0).toFixed(2)} MAD</td>
            <td class="py-2.5 px-2 text-right font-bold text-slate-900">${itemSubtotal.toFixed(2)} MAD</td>
        `;
        invItemsBody.appendChild(tr);
    });

    const remiseAmt = totalHT * 0.05; // Standard 5%
    const baseHT = totalHT - remiseAmt;
    const tva = baseHT * 0.20;
    const totalTTC = baseHT + tva;

    document.getElementById('inv-total-ht').textContent = formatMAD(totalHT);
    document.getElementById('inv-remise').textContent = '-' + formatMAD(remiseAmt);
    document.getElementById('inv-tva').textContent = formatMAD(tva);
    document.getElementById('inv-total-ttc').textContent = formatMAD(totalTTC);

    const modal = document.getElementById('invoice-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeInvoiceModal = function() {
    const modal = document.getElementById('invoice-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

// Close modal on click outside
window.addEventListener('click', (e) => {
    const modal = document.getElementById('invoice-modal');
    if (modal && e.target === modal) {
        closeInvoiceModal();
    }
});

// Setup Form and Filter Listeners
function setupEventListeners() {
    // Sku select change
    const skuSelect = document.getElementById('sku-select');
    if (skuSelect) {
        skuSelect.addEventListener('change', updateStockAndPrice);
    }

    // Qty input change
    const skuQty = document.getElementById('sku-qty');
    if (skuQty) {
        skuQty.addEventListener('input', validateQuantity);
    }

    // Discount change
    const discountSelect = document.getElementById('discount-select');
    if (discountSelect) {
        discountSelect.addEventListener('change', () => recalculateTotals());
    }

    // Add item button
    const addBtn = document.getElementById('add-item-btn');
    if (addBtn) {
        addBtn.addEventListener('click', addItemLine);
    }

    // Generate order button
    const generateBtn = document.getElementById('btnGenerateOrder');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateB2BOrder);
    }

    // Save draft button
    const saveDraftBtn = document.getElementById('btnSaveDraft');
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', saveDraft);
    }

    // Clear order button
    const clearBtn = document.getElementById('btnClearOrder');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearOrder);
    }

    // Refresh orders button
    const refreshBtn = document.getElementById('btn-refresh-orders');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.classList.add('animate-spin');
            await loadOrders();
            setTimeout(() => refreshBtn.classList.remove('animate-spin'), 600);
            showToast("Liste des commandes actualisée", "info");
        });
    }

    // Filter tabs
    const filterAll = document.getElementById('filter-all');
    const filterUnpaid = document.getElementById('filter-unpaid');
    const filterPaid = document.getElementById('filter-paid');

    const updateFilterTabStyles = () => {
        const activeClass = "bg-surface-container-lowest text-primary shadow-sm font-semibold";
        const inactiveClass = "text-on-surface-variant hover:text-on-surface";

        [filterAll, filterUnpaid, filterPaid].forEach(b => {
            if (b) {
                b.className = `px-space-md py-1 rounded font-label-md transition-all ${inactiveClass}`;
            }
        });

        if (currentFilter === 'all' && filterAll) filterAll.className = `px-space-md py-1 rounded font-label-md ${activeClass}`;
        if (currentFilter === 'unpaid' && filterUnpaid) filterUnpaid.className = `px-space-md py-1 rounded font-label-md ${activeClass}`;
        if (currentFilter === 'paid' && filterPaid) filterPaid.className = `px-space-md py-1 rounded font-label-md ${activeClass}`;
    };

    if (filterAll) {
        filterAll.addEventListener('click', () => {
            currentFilter = 'all';
            updateFilterTabStyles();
            renderOrdersTable();
        });
    }

    if (filterUnpaid) {
        filterUnpaid.addEventListener('click', () => {
            currentFilter = 'unpaid';
            updateFilterTabStyles();
            renderOrdersTable();
        });
    }

    if (filterPaid) {
        filterPaid.addEventListener('click', () => {
            currentFilter = 'paid';
            updateFilterTabStyles();
            renderOrdersTable();
        });
    }

    // Search input
    const searchInput = document.getElementById('search-orders');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderOrdersTable();
        });
    }

    // Payment method selector change - update due date description
    const pmSelect = document.getElementById('payment-method-select');
    const dueLabel = document.getElementById('due-date-label');
    if (pmSelect && dueLabel) {
        pmSelect.addEventListener('change', () => {
            const v = pmSelect.value;
            if (v === 'VIREMENT_45J') dueLabel.textContent = "Échéance nette 45 jours fin de mois (Virement bancaire)";
            else if (v === 'LETTRE_CREDIT') dueLabel.textContent = "Échéance à vue sur présentation LC conforme";
            else if (v === 'COMPTANT') dueLabel.textContent = "Paiement immédiat comptant (Escompte déduit)";
            else dueLabel.textContent = "Échéance nette 30 jours (Virement accrédité)";
        });
    }
}
