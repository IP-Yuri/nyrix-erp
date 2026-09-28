// NYRIX ERP - Othmane Dashboard Controller (Landed Cost & Stock Valuation)

// Global state
window.currentInvoiceLines = [];
window.currentInventory = [];
window.currentInvoicesList = [];
window.currentReturnsList = [];
window.currentLedgerList = [];
window.selectedInvoiceToDelete = null;

// Helper: Format ISO date to readable string with exact date and time
function formatDateTime(isoStr) {
    if (!isoStr) return '--:--:--';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const timePart = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return `${datePart} à ${timePart}`;
}

// Logout
window.logout = function() {
    localStorage.clear();
    window.location.href = '/';
};

// View Switcher (Importation vs Factures vs Stock vs Ledger)
window.switchView = function(view, element) {
    const importView = document.getElementById('view-importation');
    const facturesView = document.getElementById('view-factures');
    const stockView = document.getElementById('view-stock');
    const ledgerView = document.getElementById('view-ledger');
    const breadcrumb = document.getElementById('breadcrumb-active');
    
    if (importView) importView.classList.add('hidden');
    if (facturesView) facturesView.classList.add('hidden');
    if (stockView) stockView.classList.add('hidden');
    if (ledgerView) ledgerView.classList.add('hidden');

    if (view === 'importation') {
        if (importView) importView.classList.remove('hidden');
        if (breadcrumb) breadcrumb.innerText = 'Arrivage & Landed Cost';
    } else if (view === 'factures') {
        if (facturesView) facturesView.classList.remove('hidden');
        if (breadcrumb) breadcrumb.innerText = 'Factures Fournisseurs & Réceptions';
        window.loadInvoices();
    } else if (view === 'stock') {
        if (stockView) stockView.classList.remove('hidden');
        if (breadcrumb) breadcrumb.innerText = 'Stock Global & Valorisation';
        window.loadStock();
    } else if (view === 'ledger') {
        if (ledgerView) ledgerView.classList.remove('hidden');
        if (breadcrumb) breadcrumb.innerText = 'Grand Livre de Stock (Ledger)';
        window.loadLedger();
    }
    
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.remove('bg-brand-50', 'text-brand-700', 'font-semibold', 'border-brand-600');
        el.classList.add('text-slate-600', 'border-transparent', 'font-medium');
        const icon = el.querySelector('span');
        if (icon) {
            icon.classList.remove('text-brand-600');
            icon.classList.add('text-slate-400');
        }
    });
    
    if (element) {
        element.classList.remove('text-slate-600', 'border-transparent', 'font-medium');
        element.classList.add('bg-brand-50', 'text-brand-700', 'font-semibold', 'border-brand-600');
        const icon = element.querySelector('span');
        if (icon) {
            icon.classList.remove('text-slate-400');
            icon.classList.add('text-brand-600');
        }
    }
};

// Currency badge updater
window.updateCurrencyBadge = function() {
    const cur = document.getElementById('devise-origine')?.value || 'USD';
    const rate = parseFloat(document.getElementById('taux-change')?.value) || 10.0;
    const badge = document.getElementById('header-bam-rate');
    if (badge) {
        badge.innerText = `BAM: ${rate.toFixed(4)} MAD / ${cur}`;
    }
    window.updatePreview();
};

window.refreshExchangeRate = function() {
    const cur = document.getElementById('devise-origine')?.value || 'USD';
    const rateInput = document.getElementById('taux-change');
    if (rateInput) {
        // Standard BAM benchmark rates
        if (cur === 'USD') rateInput.value = "10.0520";
        else if (cur === 'EUR') rateInput.value = "10.8250";
        else if (cur === 'GBP') rateInput.value = "12.8500";
        else if (cur === 'CNY') rateInput.value = "1.3850";
        else rateInput.value = "1.0000";
        
        window.updateCurrencyBadge();
        alert(`Taux de change actualisé pour ${cur} : ${rateInput.value} MAD`);
    }
};

// Client-side Excel File Parser (using SheetJS)
document.addEventListener('DOMContentLoaded', () => {
    // Set default invoice date to today
    const dateInput = document.getElementById('date-facture');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    const fileInput = document.getElementById('file');
    if (fileInput) {
        fileInput.addEventListener('change', handleExcelUpload);
    }
    
    // Attach change/keyup listeners to all cost inputs
    const costInputIds = [
        'lines_json', 'taux-change', 'cle-repartition', 'douane',
        'transport-inter', 'transport-local', 'assurance',
        'frais-dedouanement', 'portnet', 'autres-frais'
    ];
    costInputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', window.updatePreview);
            el.addEventListener('change', window.updatePreview);
        }
    });

    // Search and invoice filters
    const searchInput = document.getElementById('stock-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', window.renderInventoryTable);
    }
    const invFilter = document.getElementById('invoice-filter');
    if (invFilter) {
        invFilter.addEventListener('change', window.renderInventoryTable);
    }

    // Factures search and status filters
    const facturesSearch = document.getElementById('factures-search-input');
    if (facturesSearch) {
        facturesSearch.addEventListener('input', window.renderInvoicesTable);
    }
    const facturesFilter = document.getElementById('factures-status-filter');
    if (facturesFilter) {
        facturesFilter.addEventListener('change', window.renderInvoicesTable);
    }

    // Ledger search and action filters
    const ledgerSearch = document.getElementById('ledger-search-input');
    if (ledgerSearch) {
        ledgerSearch.addEventListener('input', window.renderLedgerTable);
    }
    const ledgerFilter = document.getElementById('ledger-action-filter');
    if (ledgerFilter) {
        ledgerFilter.addEventListener('change', window.renderLedgerTable);
    }

    // Initial load
    window.loadStock();
});

function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawRows = XLSX.utils.sheet_to_json(worksheet);

            if (!rawRows || rawRows.length === 0) {
                alert("Le fichier Excel est vide ou illisible.");
                return;
            }

            // Normalize fields
            const normalized = rawRows.map(r => {
                const sku = String(r.sku || r.SKU || r.ref || r.Reference || r.article || '').trim();
                const name = String(r.name || r.nom || r.designation || r.description || sku).trim();
                const quantity = parseInt(r.quantity || r.quantite || r.qty || r.qte || 0, 10);
                const unit_price_usd = parseFloat(r.unit_price_usd || r.unit_price || r.fob || r.prix_unitaire || r.price || 0.0);
                const weight_kg = parseFloat(r.weight_kg || r.poids || r.weight || 0.0);

                return { sku, name, quantity, unit_price_usd, weight_kg };
            }).filter(r => r.sku && r.quantity > 0);

            if (normalized.length === 0) {
                alert("Aucune ligne d'article valide trouvée dans le fichier (colonnes attendues: sku, quantity, unit_price_usd, weight_kg).");
                return;
            }

            window.currentInvoiceLines = normalized;
            
            // Populate lines_json textarea for payload sync
            const jsonInput = document.getElementById('lines_json');
            if (jsonInput) jsonInput.value = JSON.stringify(normalized);

            // Update banner
            const banner = document.getElementById('file-info-banner');
            const bannerName = document.getElementById('banner-filename');
            const bannerDetails = document.getElementById('banner-details');
            const labelText = document.getElementById('file-label-text');
            
            const totalPcs = normalized.reduce((sum, r) => sum + r.quantity, 0);

            if (banner && bannerName && bannerDetails) {
                bannerName.innerText = file.name;
                bannerDetails.innerText = `${normalized.length} articles détectés • ${totalPcs.toLocaleString()} pièces au total`;
                banner.classList.remove('hidden');
            }
            if (labelText) labelText.innerText = "Changer le fichier";

            // If reference invoice is generic, suggest one based on filename
            const refInput = document.getElementById('ref-facture');
            if (refInput && (!refInput.value || refInput.value === 'FAC-2025-0984')) {
                const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").toUpperCase();
                refInput.value = baseName.substring(0, 20);
            }

            // Recalculate preview
            window.updatePreview();

        } catch (err) {
            console.error("Error parsing Excel:", err);
            alert("Erreur lors de la lecture du fichier Excel: " + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

window.clearLoadedFile = function() {
    const fileInput = document.getElementById('file');
    if (fileInput) fileInput.value = '';
    
    window.currentInvoiceLines = [];
    const jsonInput = document.getElementById('lines_json');
    if (jsonInput) jsonInput.value = '';

    const banner = document.getElementById('file-info-banner');
    if (banner) banner.classList.add('hidden');

    const labelText = document.getElementById('file-label-text');
    if (labelText) labelText.innerText = "Importer facture / bordereau (XLSX, CSV)";

    window.updatePreview();
};

// Calculate and render live financial preview
window.updatePreview = function() {
    let lines = window.currentInvoiceLines;
    if (!lines || lines.length === 0) {
        const rawJson = document.getElementById('lines_json')?.value;
        if (rawJson) {
            try { lines = JSON.parse(rawJson); } catch (e) { lines = []; }
        }
    }

    const tbody = document.getElementById('recap-body');
    const countBadge = document.getElementById('recap-count-badge');
    
    if (!lines || lines.length === 0) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 italic">Chargez un fichier Excel (.xlsx) pour prévisualiser les calculs</td></tr>`;
        }
        if (countBadge) countBadge.innerText = '0 articles';
        resetAnalyticalTable();
        return;
    }

    if (countBadge) countBadge.innerText = `${lines.length} articles`;

    const exRate = parseFloat(document.getElementById('taux-change')?.value) || 10.0;
    const dutyPct = parseFloat(document.getElementById('douane')?.value) || 5.0;
    const transportInt = parseFloat(document.getElementById('transport-inter')?.value) || 0.0;
    const transportLocal = parseFloat(document.getElementById('transport-local')?.value) || 0.0;
    const assurance = parseFloat(document.getElementById('assurance')?.value) || 0.0;
    const dedouanement = parseFloat(document.getElementById('frais-dedouanement')?.value) || 0.0;
    const portnet = parseFloat(document.getElementById('portnet')?.value) || 0.0;
    const autresFrais = parseFloat(document.getElementById('autres-frais')?.value) || 0.0;

    const totalTransport = transportInt + transportLocal;
    const totalAncillary = totalTransport + assurance + dedouanement + portnet + autresFrais;
    const allocKey = document.getElementById('cle-repartition')?.value || 'VALUE';

    // First pass
    let totalFobMad = 0;
    let totalWeight = 0;
    let totalQty = 0;

    lines.forEach(l => {
        const qty = l.quantity || 0;
        const price = l.unit_price_usd || 0;
        const weight = l.weight_kg || 0;
        const fob = qty * price * exRate;
        const duty = fob * (dutyPct / 100);

        l.calc_fob = fob;
        l.calc_duty = duty;

        totalFobMad += fob;
        totalWeight += (qty * weight);
        totalQty += qty;
    });

    // Second pass: distribute and render items
    if (tbody) tbody.innerHTML = '';
    let totalDutyMad = 0;
    let grandTotalLanded = 0;

    lines.forEach(l => {
        let ratio = 0;
        if (allocKey === 'VALUE' && totalFobMad > 0) ratio = l.calc_fob / totalFobMad;
        else if (allocKey === 'WEIGHT' && totalWeight > 0) ratio = (l.quantity * (l.weight_kg || 0)) / totalWeight;
        else if (allocKey === 'QUANTITY' && totalQty > 0) ratio = l.quantity / totalQty;

        const allocatedAncillary = totalAncillary * ratio;
        const lineTotalLanded = l.calc_fob + l.calc_duty + allocatedAncillary;
        const unitLandedCost = l.quantity > 0 ? (lineTotalLanded / l.quantity) : 0;

        totalDutyMad += l.calc_duty;
        grandTotalLanded += lineTotalLanded;

        if (tbody) {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition-colors";
            tr.innerHTML = `
                <td class="py-2.5 px-3 whitespace-nowrap">
                    <div class="flex flex-col">
                        <span class="font-mono font-bold text-slate-900">${l.sku}</span>
                        <span class="text-[11px] text-slate-500 truncate max-w-[140px]">${l.name || l.sku}</span>
                    </div>
                </td>
                <td class="py-2.5 px-2 text-right num-tabular font-semibold text-slate-800">${l.quantity.toLocaleString()}</td>
                <td class="py-2.5 px-3 text-right num-tabular text-slate-700">${l.calc_fob.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="py-2.5 px-3 text-right num-tabular text-slate-700">${l.calc_duty.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td class="py-2.5 px-3 text-right num-tabular font-bold text-brand-700 bg-brand-50/50">${unitLandedCost.toFixed(2)} MAD</td>
            `;
            tbody.appendChild(tr);
        }
    });

    // Update Analytical Table
    updateAnalyticalTable(totalFobMad, totalTransport, totalDutyMad, (assurance + dedouanement + portnet + autresFrais), grandTotalLanded);
};

function updateAnalyticalTable(fob, transport, duty, otherAncillary, totalLanded) {
    const total = totalLanded > 0 ? totalLanded : (fob + transport + duty + otherAncillary);
    const tva = (fob + duty) * 0.20; // 20% TVA import

    const setRow = (partId, valId, val) => {
        const pctEl = document.getElementById(partId);
        const valEl = document.getElementById(valId);
        if (pctEl) pctEl.innerText = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0.0%';
        if (valEl) valEl.innerText = val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' MAD';
    };

    setRow('ana-part-fob', 'ana-val-fob', fob);
    setRow('ana-part-transport', 'ana-val-transport', transport);
    setRow('ana-part-duty', 'ana-val-duty', duty);
    setRow('ana-part-ancillary', 'ana-val-ancillary', otherAncillary);

    const tvaValEl = document.getElementById('ana-val-tva');
    const tvaPctEl = document.getElementById('ana-part-tva');
    if (tvaValEl) tvaValEl.innerText = tva.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' MAD';
    if (tvaPctEl) tvaPctEl.innerText = total > 0 ? ((tva / total) * 100).toFixed(1) + '%' : '20.0%';

    const totalValEl = document.getElementById('ana-val-total');
    if (totalValEl) totalValEl.innerText = total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' MAD';
}

function resetAnalyticalTable() {
    updateAnalyticalTable(0, 0, 0, 0, 0);
}

window.saveDraft = function() {
    const draft = {
        supplier: document.getElementById('nom-fournisseur')?.value,
        invoiceRef: document.getElementById('ref-facture')?.value,
        date: document.getElementById('date-facture')?.value,
        currency: document.getElementById('devise-origine')?.value,
        rate: document.getElementById('taux-change')?.value,
        lines: window.currentInvoiceLines
    };
    localStorage.setItem('nyrix_othmane_draft', JSON.stringify(draft));
    alert("Brouillon de la facture d'arrivage sauvegardé dans votre navigateur.");
};

// Import Execution ("Ajouter au stock")
const importBtn = document.getElementById('import-btn');
if (importBtn) {
    importBtn.addEventListener('click', async () => {
        const refFacture = document.getElementById('ref-facture')?.value?.trim();
        const file = document.getElementById('file')?.files[0];
        const linesJson = document.getElementById('lines_json')?.value?.trim();

        if (!file && (!linesJson || linesJson === '[]' || linesJson === '')) {
            alert("Veuillez sélectionner un fichier Excel (.xlsx) ou renseigner les lignes d'articles avant de valider l'arrivage.");
            return;
        }

        const btnText = document.getElementById('import-btn-text');
        importBtn.disabled = true;
        if (btnText) btnText.innerText = "Intégration en cours...";

        const formData = new FormData();
        const nomFournisseur = document.getElementById('nom-fournisseur')?.value?.trim();
        if (nomFournisseur) formData.append('nom_fournisseur', nomFournisseur);
        if (refFacture) formData.append('ref_facture', refFacture);
        if (file) formData.append('file', file);
        else formData.append('lines_json', linesJson);

        formData.append('exchange_rate', document.getElementById('taux-change')?.value || '10.0');
        formData.append('customs_duty_pct', document.getElementById('douane')?.value || '5.0');
        formData.append('transport_int', document.getElementById('transport-inter')?.value || '0.0');
        formData.append('transport_local', document.getElementById('transport-local')?.value || '0.0');
        formData.append('assurance', document.getElementById('assurance')?.value || '0.0');
        formData.append('dedouanement', document.getElementById('frais-dedouanement')?.value || '0.0');
        formData.append('portnet', document.getElementById('portnet')?.value || '0.0');
        formData.append('autre', document.getElementById('autres-frais')?.value || '0.0');
        formData.append('allocation_key', document.getElementById('cle-repartition')?.value || 'VALUE');

        try {
            const res = await apiCall('/finance/import', { method: 'POST', body: formData });
            if (res && res.status === 200) {
                const data = await res.json();
                alert(`✅ Facture ${data.invoice_ref} réceptionnée avec succès !\nLe stock global et les coûts de revient ont été mis à jour.`);
                
                // Clear imported file state
                window.clearLoadedFile();

                // Switch to stock view and refresh
                const stockNavLink = document.getElementById('nav-stock');
                window.switchView('stock', stockNavLink);
            } else {
                const err = res ? await res.json() : { detail: "Erreur réseau inconnue" };
                alert("Erreur lors de l'importation: " + (err.detail || JSON.stringify(err)));
            }
        } catch (e) {
            console.error("Import error:", e);
            alert("Erreur lors de la communication avec le serveur: " + e.message);
        } finally {
            importBtn.disabled = false;
            if (btnText) btnText.innerText = "Ajouter au stock";
        }
    });
}

// Load Stock and KPIs
window.loadStock = async function() {
    try {
        const res = await apiCall('/finance/valuation');
        if (res && res.status === 200) {
            const data = await res.json();
            window.currentInventory = data.inventory || [];

            // Top KPIs
            const kpiVal = document.getElementById('kpi-val');
            if (kpiVal) kpiVal.innerText = (data.kpis.total_valuation_mad || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

            const kpiStock = document.getElementById('kpi-stock');
            if (kpiStock) kpiStock.innerText = (data.kpis.total_global_stock || 0).toLocaleString();

            const kpiOrders = document.getElementById('kpi-orders');
            if (kpiOrders) kpiOrders.innerText = (data.kpis.orders_today_count || 0).toLocaleString();

            // Progress bar and details in top KPI 2
            const karimeStock = data.kpis.karime_stock ?? data.kpis.total_global_stock;
            const packerStock = data.kpis.packer_stock ?? 0;
            const totalStock = karimeStock + packerStock;
            const karimePct = totalStock > 0 ? ((karimeStock / totalStock) * 100).toFixed(1) : '100.0';
            const packerPct = totalStock > 0 ? ((packerStock / totalStock) * 100).toFixed(1) : '0.0';

            const stockDisp = document.getElementById('kpi-stock-disp');
            if (stockDisp) stockDisp.innerText = `${karimeStock.toLocaleString()} U (${karimePct}%)`;

            const stockBar = document.getElementById('kpi-stock-bar');
            if (stockBar) stockBar.style.width = `${karimePct}%`;

            // Operational Distribution Ribbon
            const rKarimeStock = document.getElementById('ribbon-karime-stock');
            const rKarimePct = document.getElementById('ribbon-karime-pct');
            if (rKarimeStock) rKarimeStock.innerText = karimeStock.toLocaleString();
            if (rKarimePct) rKarimePct.innerText = `${karimePct}%`;

            const rPackerStock = document.getElementById('ribbon-packer-stock');
            const rPackerPct = document.getElementById('ribbon-packer-pct');
            if (rPackerStock) rPackerStock.innerText = packerStock.toLocaleString();
            if (rPackerPct) rPackerPct.innerText = `${packerPct}%`;

            const rAvgCost = document.getElementById('ribbon-avg-cost');
            if (rAvgCost) rAvgCost.innerText = (data.kpis.avg_unit_cost || 0).toFixed(2);

            const rLastSync = document.getElementById('ribbon-last-sync');
            if (rLastSync) rLastSync.innerText = data.kpis.last_sync || new Date().toLocaleTimeString('fr-FR');

            // Populate Invoice Filter Dropdown
            const invoiceFilter = document.getElementById('invoice-filter');
            if (invoiceFilter && data.invoices) {
                const currentVal = invoiceFilter.value;
                invoiceFilter.innerHTML = '<option value="ALL">Toutes les factures</option>';
                data.invoices.forEach(inv => {
                    const opt = document.createElement('option');
                    opt.value = inv;
                    opt.innerText = inv;
                    if (inv === currentVal) opt.selected = true;
                    invoiceFilter.appendChild(opt);
                });
            }

            // Render Table Rows and Totals
            window.renderInventoryTable();
        }
    } catch (e) {
        console.error("Error loading stock:", e);
    }

    // Load Discrepancies
    try {
        const dRes = await apiCall('/finance/discrepancies');
        if (dRes && dRes.status === 200) {
            const dData = await dRes.json();
            const dtbody = document.getElementById('disc-body');
            if (dtbody) {
                const pending = dData.filter(d => d.status === 'PENDING_APPROVAL');
                if (pending.length === 0) {
                    dtbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 italic">Aucun écart en attente d'approbation.</td></tr>`;
                } else {
                    dtbody.innerHTML = '';
                    pending.forEach(d => {
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-slate-50 transition-colors";
                        tr.innerHTML = `
                            <td class="py-2.5 px-4 font-mono font-bold text-slate-800">${d.id.substring(0, 8)}</td>
                            <td class="py-2.5 px-4 font-bold text-slate-900">${d.product_sku}</td>
                            <td class="py-2.5 px-4 num-tabular font-bold text-rose-600">${d.quantity_missing} pcs</td>
                            <td class="py-2.5 px-4 font-medium text-slate-700">${d.reason}</td>
                            <td class="py-2.5 px-4 text-right whitespace-nowrap">
                                <button class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors mr-1.5" onclick="window.resolveDisc('${d.id}', 'APPROVE', this)">APPROVE</button>
                                <button class="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors" onclick="window.resolveDisc('${d.id}', 'REJECT', this)">REJECT</button>
                            </td>
                        `;
                        dtbody.appendChild(tr);
                    });
                }
            }
        }
    } catch (e) {
        console.error("Error loading discrepancies:", e);
    }

    // Load Retours (Signalés par Karime)
    try {
        const rRes = await apiCall('/finance/returns');
        if (rRes && rRes.status === 200) {
            const rData = await rRes.json();
            window.currentReturnsList = rData || [];
            
            const badgeTotal = document.getElementById('returns-badge-total');
            const badgeRestored = document.getElementById('returns-badge-restored');
            const badgeQuarantine = document.getElementById('returns-badge-quarantine');
            
            const restoredCount = rData.filter(r => r.action === 'RETURN_RESTORED' || r.condition === 'INTACT').reduce((s, r) => s + r.quantity, 0);
            const quarantineCount = rData.filter(r => r.action === 'QUARANTINE' || r.condition === 'DAMAGED').reduce((s, r) => s + r.quantity, 0);

            if (badgeTotal) badgeTotal.innerText = `${rData.length} retours enregistrés`;
            if (badgeRestored) badgeRestored.innerText = `${restoredCount} sains réintégrés`;
            if (badgeQuarantine) badgeQuarantine.innerText = `${quarantineCount} en quarantaine`;

            const rtbody = document.getElementById('returns-tbody');
            if (rtbody) {
                if (rData.length === 0) {
                    rtbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 italic">Aucun retour de colis enregistré pour le moment.</td></tr>`;
                } else {
                    rtbody.innerHTML = '';
                    rData.forEach(r => {
                        const isIntact = (r.condition === 'INTACT' || r.action === 'RETURN_RESTORED');
                        const statusBadge = isIntact 
                            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Colis Intact (Sain)</span>`
                            : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Marchandise Avariée</span>`;
                        
                        const actionImpact = isIntact
                            ? `<span class="font-bold text-emerald-700">+${r.quantity} Réintégré au Stock Disponible</span>`
                            : `<span class="font-bold text-rose-700">Isolé en Zone Quarantaine (Hors Stock)</span>`;

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-slate-50 transition-colors";
                        tr.innerHTML = `
                            <td class="py-2.5 px-4 whitespace-nowrap">
                                <div class="flex items-center gap-1.5 text-slate-700">
                                    <span class="material-symbols-outlined text-[15px] text-slate-400">schedule</span>
                                    <span class="font-bold text-xs num-tabular">${formatDateTime(r.created_at)}</span>
                                </div>
                            </td>
                            <td class="py-2.5 px-4">
                                <div class="flex flex-col">
                                    <span class="font-mono font-bold text-slate-900">${r.product_sku}</span>
                                    <span class="text-[11px] text-slate-500 truncate max-w-[200px]">${r.product_name || r.product_sku}</span>
                                </div>
                            </td>
                            <td class="py-2.5 px-4 text-right num-tabular font-bold text-sm text-slate-900">${r.quantity.toLocaleString()} pcs</td>
                            <td class="py-2.5 px-4 text-center whitespace-nowrap">${statusBadge}</td>
                            <td class="py-2.5 px-4 text-xs whitespace-nowrap">${actionImpact}</td>
                            <td class="py-2.5 px-4 whitespace-nowrap">
                                <div class="flex items-center gap-1.5">
                                    <div class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">K</div>
                                    <span class="font-semibold text-slate-800 text-xs">${r.reported_by_username || 'karime'} (Entrepôt)</span>
                                </div>
                            </td>
                            <td class="py-2.5 px-4 text-slate-600 text-xs">
                                <span class="font-medium">${r.tracking_number ? `<strong class="text-slate-800">[${r.tracking_number}]</strong> ` : ''}${r.reason || 'Retour quai standard'}</span>
                            </td>
                        `;
                        rtbody.appendChild(tr);
                    });
                }
            }
        }
    } catch (e) {
        console.error("Error loading returns:", e);
    }
};

// Render Inventory Table with active search and invoice filter
window.renderInventoryTable = function() {
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;

    const query = (document.getElementById('stock-search-input')?.value || '').toLowerCase().trim();
    const invoiceFilter = document.getElementById('invoice-filter')?.value || 'ALL';

    const items = window.currentInventory || [];
    const filtered = items.filter(p => {
        const matchesQuery = !query || 
            (p.sku && p.sku.toLowerCase().includes(query)) ||
            (p.name && p.name.toLowerCase().includes(query)) ||
            (p.last_invoice_ref && p.last_invoice_ref.toLowerCase().includes(query));

        const matchesInvoice = (invoiceFilter === 'ALL') || (p.last_invoice_ref === invoiceFilter);

        return matchesQuery && matchesInvoice;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400 italic">Aucun article ne correspond à votre recherche.</td></tr>`;
    } else {
        filtered.forEach(p => {
            const totalStock = p.global_stock + p.packer_stock;
            const pctKarime = totalStock > 0 ? ((p.global_stock / totalStock) * 100).toFixed(1) : '0.0';
            const pctPacker = totalStock > 0 ? ((p.packer_stock / totalStock) * 100).toFixed(1) : '0.0';
            const immobilizedVal = (p.landed_cost || 0) * totalStock;

            const tr = document.createElement('tr');
            tr.className = "h-14 hover:bg-brand-50/40 transition-colors group";
            tr.setAttribute('data-sku', p.sku);
            tr.setAttribute('data-invoice', p.last_invoice_ref || 'STOCK-INITIAL');

            tr.innerHTML = `
                <td class="py-2.5 px-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold">${p.sku}</span>
                </td>
                <td class="py-2.5 px-4">
                    <div class="flex flex-col">
                        <span class="text-xs font-bold text-slate-900 group-hover:text-brand-700 transition-colors">${p.name || p.sku}</span>
                        <span class="text-[11px] text-slate-400">Réf. catalogue interne</span>
                    </div>
                </td>
                <td class="py-2.5 px-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200">
                        ${p.last_invoice_ref || 'STOCK-INITIAL'}
                    </span>
                </td>
                <td class="py-2.5 px-4 text-right whitespace-nowrap">
                    <span class="num-tabular font-bold text-slate-900">${p.global_stock.toLocaleString()}</span>
                    <span class="text-[11px] text-slate-400 block">${pctKarime}%</span>
                </td>
                <td class="py-2.5 px-4 text-right whitespace-nowrap">
                    <span class="num-tabular font-bold text-slate-900">${p.packer_stock.toLocaleString()}</span>
                    <span class="text-[11px] text-slate-400 block">${pctPacker}%</span>
                </td>
                <td class="py-2.5 px-4 text-right whitespace-nowrap">
                    <span class="num-tabular font-semibold text-slate-700">${(p.landed_cost || 0).toFixed(2)} MAD</span>
                </td>
                <td class="py-2.5 px-4 text-right whitespace-nowrap">
                    <span class="num-tabular font-bold text-brand-700">${immobilizedVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD</span>
                </td>
                <td class="py-2.5 px-4 text-center whitespace-nowrap">
                    <button class="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-brand-600 hover:text-white text-slate-700 text-xs font-semibold transition-all inline-flex items-center gap-1 shadow-2xs" onclick="window.openDetailDrawer('${p.sku}')">
                        <span class="material-symbols-outlined text-[15px]">visibility</span>
                        <span>Détail Coûts</span>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Update Footer Totals based on filtered rows
    const totalKarime = filtered.reduce((s, p) => s + p.global_stock, 0);
    const totalPacker = filtered.reduce((s, p) => s + p.packer_stock, 0);
    const totalGlobal = totalKarime + totalPacker;
    const totalVal = filtered.reduce((s, p) => s + ((p.landed_cost || 0) * (p.global_stock + p.packer_stock)), 0);

    const tfootKarime = document.getElementById('tfoot-karime');
    if (tfootKarime) tfootKarime.innerText = totalKarime.toLocaleString();

    const tfootPacker = document.getElementById('tfoot-packer');
    if (tfootPacker) tfootPacker.innerText = totalPacker.toLocaleString();

    const tfootGlobal = document.getElementById('tfoot-global-label');
    if (tfootGlobal) tfootGlobal.innerText = `Global: ${totalGlobal.toLocaleString()} pcs`;

    const tfootVal = document.getElementById('tfoot-total-val');
    if (tfootVal) tfootVal.innerText = `${totalVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD`;

    const paginationStatus = document.getElementById('pagination-status');
    if (paginationStatus) paginationStatus.innerText = `Affichage de ${filtered.length} sur ${items.length} références enregistrées`;
};

// Flyout Cost Breakdown Drawer
window.openDetailDrawer = function(sku) {
    const product = (window.currentInventory || []).find(p => p.sku === sku);
    if (!product) return;

    const totalQty = product.global_stock + product.packer_stock;
    const landedCost = product.landed_cost || 0;
    const totalVal = landedCost * totalQty;

    document.getElementById('drawer-sku').innerText = product.sku;
    document.getElementById('drawer-invoice').innerText = product.last_invoice_ref || 'STOCK-INITIAL';
    document.getElementById('drawer-title').innerText = product.name || product.sku;
    document.getElementById('drawer-landed-cost').innerText = `${landedCost.toFixed(2)} MAD`;
    document.getElementById('drawer-qty').innerText = `${totalQty.toLocaleString()} pcs`;
    document.getElementById('drawer-total-val').innerText = `${totalVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD`;

    document.getElementById('drawer-loc-karime').innerText = `${product.global_stock.toLocaleString()} pcs`;
    document.getElementById('drawer-loc-packer').innerText = `${product.packer_stock.toLocaleString()} pcs`;

    const backdrop = document.getElementById('cost-drawer-backdrop');
    const drawer = document.getElementById('cost-drawer');

    if (backdrop && drawer) {
        backdrop.classList.remove('hidden');
        setTimeout(() => {
            drawer.classList.remove('translate-x-full');
        }, 10);
    }
};

window.closeDetailDrawer = function() {
    const backdrop = document.getElementById('cost-drawer-backdrop');
    const drawer = document.getElementById('cost-drawer');

    if (drawer) drawer.classList.add('translate-x-full');
    if (backdrop) {
        setTimeout(() => {
            backdrop.classList.add('hidden');
        }, 250);
    }
};

window.printArticleCard = function() {
    alert("Exportation de la fiche de valorisation SKU générée au format PDF.");
};

// Synchronize WMS button animation
window.syncWMS = async function(btn) {
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">refresh</span><span>Synchronisation...</span>`;

    await window.loadStock();

    btn.innerHTML = `<span class="material-symbols-outlined text-[16px] text-emerald-600">check</span><span class="text-emerald-700">À jour (100%)</span>`;
    setTimeout(() => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }, 2000);
};

// Export to Excel using SheetJS
window.exportToExcel = function() {
    try {
        const table = document.getElementById('inventory-table');
        if (!table) return;

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, "Valorisation_Stock");
        XLSX.writeFile(wb, `NYRIX_Stock_Valorisation_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
        console.error("Export error:", e);
        alert("Erreur lors de l'exportation: " + e.message);
    }
};

// Discrepancy resolver
window.resolveDisc = async function(id, action, btn) {
    if (btn) btn.disabled = true;
    try {
        const res = await apiCall(`/finance/discrepancies/${id}/resolve?action=${action}`, { method: 'PUT' });
        if (res && res.status === 200) {
            await window.loadStock();
        } else {
            if (btn) btn.disabled = false;
        }
    } catch (e) {
        console.error("Error resolving discrepancy:", e);
        if (btn) btn.disabled = false;
    }
};

// ==========================================
// FACTURES (INVOICES) MANAGEMENT CONTROLLERS
// ==========================================

window.loadInvoices = async function() {
    try {
        const res = await apiCall('/finance/invoices');
        if (res && res.status === 200) {
            const invoices = await res.json();
            window.currentInvoicesList = invoices || [];

            // Update KPI blocks
            const kpiCount = document.getElementById('kpi-factures-count');
            const kpiQty = document.getElementById('kpi-factures-qty');
            const kpiVal = document.getElementById('kpi-factures-val');
            const kpiLatest = document.getElementById('kpi-factures-latest');

            const totalInvoices = invoices.length;
            const totalQty = invoices.reduce((s, i) => s + (i.total_quantity || 0), 0);
            const totalVal = invoices.reduce((s, i) => s + (i.total_amount_mad || 0), 0);

            if (kpiCount) kpiCount.innerText = totalInvoices.toLocaleString();
            if (kpiQty) kpiQty.innerText = totalQty.toLocaleString();
            if (kpiVal) kpiVal.innerText = totalVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
            if (kpiLatest) {
                if (invoices.length > 0 && invoices[0].created_at) {
                    kpiLatest.innerText = formatDateTime(invoices[0].created_at);
                } else {
                    kpiLatest.innerText = "Aucun enregistrement";
                }
            }

            window.renderInvoicesTable();
        }
    } catch (e) {
        console.error("Error loading invoices:", e);
    }
};

window.renderInvoicesTable = function() {
    const tbody = document.getElementById('factures-tbody');
    if (!tbody) return;

    const query = (document.getElementById('factures-search-input')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('factures-status-filter')?.value || 'ALL';

    const invoices = window.currentInvoicesList || [];
    const filtered = invoices.filter(inv => {
        const matchesQuery = !query ||
            (inv.invoice_ref && inv.invoice_ref.toLowerCase().includes(query)) ||
            (inv.supplier_name && inv.supplier_name.toLowerCase().includes(query)) ||
            (inv.items && inv.items.some(it => (it.sku && it.sku.toLowerCase().includes(query)) || (it.name && it.name.toLowerCase().includes(query))));

        const matchesStatus = (statusFilter === 'ALL') || (inv.status === statusFilter);

        return matchesQuery && matchesStatus;
    });

    tbody.innerHTML = '';
    const label = document.getElementById('factures-count-label');
    if (label) label.innerText = `${filtered.length} sur ${invoices.length} facture(s) affichée(s)`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 italic">Aucune facture ne correspond à votre recherche.</td></tr>`;
        return;
    }

    filtered.forEach(inv => {
        const statusBadge = (inv.status === 'RECEPTIONNE')
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Réceptionné</span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>En attente de réception</span>`;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors group";
        tr.innerHTML = `
            <td class="py-3 px-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-mono text-xs font-bold border border-brand-200">
                        ${inv.invoice_ref}
                    </span>
                </div>
            </td>
            <td class="py-3 px-4">
                <div class="flex flex-col">
                    <span class="font-bold text-slate-900 group-hover:text-brand-700 transition-colors">${inv.supplier_name || 'Fournisseur non spécifié'}</span>
                    <span class="text-[11px] text-slate-400">Import dématérialisé</span>
                </div>
            </td>
            <td class="py-3 px-4 whitespace-nowrap">
                <div class="flex items-center gap-1.5 text-slate-700">
                    <span class="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                    <span class="font-bold text-xs num-tabular text-slate-900">${formatDateTime(inv.created_at)}</span>
                </div>
            </td>
            <td class="py-3 px-4 text-right whitespace-nowrap">
                <span class="font-bold text-slate-900 num-tabular">${(inv.total_quantity || 0).toLocaleString()} pcs</span>
                <span class="text-[11px] text-slate-400 block">${inv.total_skus || 0} référence(s)</span>
            </td>
            <td class="py-3 px-4 text-right whitespace-nowrap">
                <span class="font-bold text-brand-700 text-sm num-tabular">${(inv.total_amount_mad || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD</span>
            </td>
            <td class="py-3 px-4 text-center whitespace-nowrap">
                ${statusBadge}
            </td>
            <td class="py-3 px-4 text-center whitespace-nowrap">
                <div class="flex items-center justify-center gap-1.5">
                    <button type="button" class="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-brand-600 hover:text-white text-slate-700 text-xs font-semibold transition-all inline-flex items-center gap-1 shadow-2xs" onclick="window.openInvoiceDetailModal('${inv.id}')" title="Voir les articles de cette facture">
                        <span class="material-symbols-outlined text-[15px]">visibility</span>
                        <span>Articles</span>
                    </button>
                    <button type="button" class="h-8 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 hover:border-rose-600 text-xs font-semibold transition-all inline-flex items-center gap-1 shadow-2xs" onclick="window.openDeleteInvoiceModal('${inv.id}')" title="Supprimer et déduire automatiquement du stock">
                        <span class="material-symbols-outlined text-[15px]">delete</span>
                        <span>Supprimer</span>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.openInvoiceDetailModal = function(id) {
    const inv = (window.currentInvoicesList || []).find(i => i.id === id);
    if (!inv) return;

    document.getElementById('modal-inv-title').innerText = `Facture ${inv.invoice_ref}`;
    document.getElementById('modal-inv-subtitle').innerText = `Enregistrée le ${formatDateTime(inv.created_at)} • Statut: ${inv.status}`;
    document.getElementById('modal-inv-supplier').innerText = inv.supplier_name || 'Non spécifié';
    document.getElementById('modal-inv-datetime').innerText = formatDateTime(inv.created_at);
    document.getElementById('modal-inv-total-qty').innerText = `${(inv.total_quantity || 0).toLocaleString()} pcs (${inv.total_skus || 0} SKUs)`;
    document.getElementById('modal-inv-total-val').innerText = `${(inv.total_amount_mad || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD`;

    const tbody = document.getElementById('modal-inv-items-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        (inv.items || []).forEach(it => {
            const qty = it.quantity || 0;
            const lc = it.landed_cost || 0;
            const lineTotal = qty * lc;
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50";
            tr.innerHTML = `
                <td class="py-2 px-3 font-mono font-bold text-slate-900">${it.sku}</td>
                <td class="py-2 px-3 font-medium text-slate-800">${it.name || it.sku}</td>
                <td class="py-2 px-3 text-right num-tabular font-bold text-slate-900">${qty.toLocaleString()} pcs</td>
                <td class="py-2 px-3 text-right num-tabular text-slate-700">${lc.toFixed(2)} MAD</td>
                <td class="py-2 px-3 text-right num-tabular font-bold text-brand-700">${lineTotal.toFixed(2)} MAD</td>
            `;
            tbody.appendChild(tr);
        });
    }

    const modal = document.getElementById('modal-invoice-detail');
    if (modal) modal.classList.remove('hidden');
};

window.closeInvoiceDetailModal = function() {
    const modal = document.getElementById('modal-invoice-detail');
    if (modal) modal.classList.add('hidden');
};

window.openDeleteInvoiceModal = function(id) {
    const inv = (window.currentInvoicesList || []).find(i => i.id === id);
    if (!inv) return;

    window.selectedInvoiceToDelete = inv;
    document.getElementById('delete-inv-ref').innerText = inv.invoice_ref;
    document.getElementById('delete-inv-datetime').innerText = formatDateTime(inv.created_at);
    document.getElementById('delete-inv-qty').innerText = (inv.total_quantity || 0).toLocaleString();

    const modal = document.getElementById('modal-delete-invoice');
    if (modal) modal.classList.remove('hidden');
};

window.closeDeleteInvoiceModal = function() {
    const modal = document.getElementById('modal-delete-invoice');
    if (modal) modal.classList.add('hidden');
    window.selectedInvoiceToDelete = null;
};

window.confirmDeleteInvoice = async function() {
    const inv = window.selectedInvoiceToDelete;
    if (!inv) return;

    const btn = document.getElementById('btn-confirm-delete-invoice');
    const btnText = document.getElementById('btn-confirm-delete-text');
    if (btn) btn.disabled = true;
    if (btnText) btnText.innerText = "Suppression et déduction du stock...";

    try {
        const res = await apiCall(`/finance/invoices/${inv.id}`, { method: 'DELETE' });
        if (res && res.status === 200) {
            const data = await res.json();
            alert(`✅ Facture ${inv.invoice_ref} supprimée avec succès !\n\n${data.total_deducted} unités de marchandises ont été automatiquement retirées du stock global.`);
            window.closeDeleteInvoiceModal();
            // Refresh both invoices and stock
            await window.loadInvoices();
            await window.loadStock();
        } else {
            const err = res ? await res.json() : { detail: "Erreur inconnue" };
            alert("Erreur lors de la suppression de la facture: " + (err.detail || JSON.stringify(err)));
        }
    } catch (e) {
        console.error("Delete invoice error:", e);
        alert("Erreur réseau lors de la suppression: " + e.message);
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.innerText = "Confirmer la Suppression";
    }
};

// ==========================================
// STOCK LEDGER (GRAND LIVRE) AUDIT CONTROLLERS
// ==========================================

window.loadLedger = async function() {
    try {
        const tbody = document.getElementById('ledger-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-slate-400 italic">Chargement des écritures du ledger en cours...</td>
                </tr>
            `;
        }

        const res = await apiCall('/finance/ledger');
        if (res && res.status === 200) {
            const data = await res.json();
            window.currentLedgerList = data || [];

            // Calculate KPI values
            const totalEntries = window.currentLedgerList.length;
            let totalIn = 0;
            let totalOut = 0;
            let totalAdj = 0;

            window.currentLedgerList.forEach(entry => {
                const qty = Math.abs(entry.quantity || 0);
                const act = (entry.action || '').toUpperCase();
                if (['IMPORT', 'RETURN_RESTORED'].includes(act)) {
                    totalIn += qty;
                } else if (['PACKED_OUT'].includes(act)) {
                    totalOut += qty;
                } else {
                    totalAdj += qty;
                }
            });

            const kpiTotal = document.getElementById('kpi-ledger-total');
            const kpiIn = document.getElementById('kpi-ledger-in');
            const kpiOut = document.getElementById('kpi-ledger-out');
            const kpiAdj = document.getElementById('kpi-ledger-adj');

            if (kpiTotal) kpiTotal.innerText = totalEntries.toLocaleString();
            if (kpiIn) kpiIn.innerText = totalIn.toLocaleString();
            if (kpiOut) kpiOut.innerText = totalOut.toLocaleString();
            if (kpiAdj) kpiAdj.innerText = totalAdj.toLocaleString();

            window.renderLedgerTable();
        } else {
            console.error("Failed to load stock ledger", res);
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-8 text-center text-rose-500 font-medium">Erreur lors de la récupération des écritures comptables.</td>
                    </tr>
                `;
            }
        }
    } catch (e) {
        console.error("Error loading stock ledger:", e);
        const tbody = document.getElementById('ledger-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-rose-500 font-medium">Erreur réseau lors de la récupération du ledger.</td>
                </tr>
            `;
        }
    }
};

window.renderLedgerTable = function() {
    const tbody = document.getElementById('ledger-tbody');
    if (!tbody) return;

    const query = (document.getElementById('ledger-search-input')?.value || '').toLowerCase().trim();
    const actionFilter = document.getElementById('ledger-action-filter')?.value || 'ALL';

    const entries = window.currentLedgerList || [];

    const filtered = entries.filter(item => {
        // Filter by action
        if (actionFilter !== 'ALL' && item.action !== actionFilter) {
            return false;
        }

        // Filter by search query
        if (query) {
            const sku = (item.sku || '').toLowerCase();
            const name = (item.product_name || '').toLowerCase();
            const action = (item.action || '').toLowerCase();
            const user = (item.username || '').toLowerCase();
            const id = (item.id || '').toLowerCase();
            if (!sku.includes(query) && !name.includes(query) && !action.includes(query) && !user.includes(query) && !id.includes(query)) {
                return false;
            }
        }

        return true;
    });

    const countLabel = document.getElementById('ledger-count-label');
    if (countLabel) {
        countLabel.innerText = `${filtered.length} écriture(s) affichée(s) sur ${entries.length}`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-slate-400">
                    <span class="material-symbols-outlined text-[36px] text-slate-300 block mb-2">menu_book</span>
                    Aucune écriture ne correspond à vos filtres.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach(entry => {
        const action = (entry.action || '').toUpperCase();
        let actionBadge = '';
        let qtyDisplay = '';

        if (action === 'IMPORT') {
            actionBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>ENTRÉE (IMPORT)</span>`;
            qtyDisplay = `<span class="font-bold text-emerald-700 text-xs num-tabular">+${Math.abs(entry.quantity).toLocaleString()} pcs</span>`;
        } else if (action === 'TRANSFER_ACCEPTED') {
            actionBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>TRANSFERT QUAI->TABLETTE</span>`;
            qtyDisplay = `<span class="font-bold text-blue-700 text-xs num-tabular">${entry.quantity > 0 ? '+' : ''}${entry.quantity.toLocaleString()} pcs</span>`;
        } else if (action === 'PACKED_OUT') {
            actionBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"><span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>EXPÉDITION COMMANDE</span>`;
            qtyDisplay = `<span class="font-bold text-indigo-700 text-xs num-tabular">-${Math.abs(entry.quantity).toLocaleString()} pcs</span>`;
        } else if (action === 'RETURN_RESTORED') {
            actionBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200"><span class="w-1.5 h-1.5 rounded-full bg-teal-500"></span>RETOUR RÉINTÉGRÉ</span>`;
            qtyDisplay = `<span class="font-bold text-teal-700 text-xs num-tabular">+${Math.abs(entry.quantity).toLocaleString()} pcs</span>`;
        } else if (action === 'QUARANTINE') {
            actionBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>QUARANTAINE AVARIE</span>`;
            qtyDisplay = `<span class="font-bold text-rose-700 text-xs num-tabular">-${Math.abs(entry.quantity).toLocaleString()} pcs</span>`;
        } else if (action === 'DISCREPANCY_APPROVED') {
            actionBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>ÉCART VALIDÉ</span>`;
            qtyDisplay = `<span class="font-bold text-amber-700 text-xs num-tabular">${entry.quantity > 0 ? '+' : ''}${entry.quantity.toLocaleString()} pcs</span>`;
        } else {
            actionBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">${action}</span>`;
            qtyDisplay = `<span class="font-bold text-slate-800 text-xs num-tabular">${entry.quantity > 0 ? '+' : ''}${entry.quantity.toLocaleString()} pcs</span>`;
        }

        const initials = ((entry.username || 'SY').substring(0, 2)).toUpperCase();

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors";
        tr.innerHTML = `
            <td class="py-3 px-4 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 text-slate-700 font-mono text-[11px]">
                    <span class="material-symbols-outlined text-[14px] text-slate-400">schedule</span>
                    ${formatDateTime(entry.created_at)}
                </span>
            </td>
            <td class="py-3 px-4">
                <span class="font-mono font-bold text-slate-900 block">${entry.sku}</span>
                <span class="text-[11px] text-slate-500 truncate max-w-[220px] block" title="${entry.product_name}">${entry.product_name}</span>
            </td>
            <td class="py-3 px-4 text-center whitespace-nowrap">
                ${actionBadge}
            </td>
            <td class="py-3 px-4 text-right whitespace-nowrap">
                ${qtyDisplay}
            </td>
            <td class="py-3 px-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        ${initials}
                    </div>
                    <span class="font-medium text-slate-900">${entry.username || 'Système'}</span>
                </div>
            </td>
            <td class="py-3 px-4 text-center whitespace-nowrap">
                <span class="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="${entry.id}">#${(entry.id || '').substring(0, 8)}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.exportLedgerToExcel = function() {
    try {
        const table = document.getElementById('ledger-table');
        if (!table) return;

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, "Grand_Livre_Stock");
        XLSX.writeFile(wb, `NYRIX_Grand_Livre_Stock_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
        console.error("Export ledger error:", e);
        alert("Erreur lors de l'exportation du Grand Livre: " + e.message);
    }
};
