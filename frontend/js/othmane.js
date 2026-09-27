window.logout = function() {
    localStorage.clear();
    window.location.href = '/';
};

window.switchView = function(view, element) {
    document.getElementById('view-importation').classList.add('hidden');
    document.getElementById('view-stock').classList.add('hidden');
    
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.remove('bg-surface-container-low', 'text-primary', 'font-semibold', 'border-l-4', 'border-primary');
        el.classList.add('text-on-surface-variant', 'border-transparent');
        // swap icons
        const icon = el.querySelector('span');
        if (icon) icon.classList.remove('text-primary');
        if (icon) icon.classList.add('text-outline');
    });
    
    document.getElementById('view-' + view).classList.remove('hidden');
    if (element) {
        element.classList.remove('text-on-surface-variant', 'border-transparent');
        element.classList.add('bg-surface-container-low', 'text-primary', 'font-semibold', 'border-l-4', 'border-primary');
        const icon = element.querySelector('span');
        if (icon) icon.classList.remove('text-outline');
        if (icon) icon.classList.add('text-primary');
    }
    
    if (view === 'stock') loadStock();
};

async function loadStock() {
    const res = await apiCall('/finance/valuation');
    if(res && res.status === 200) {
        const data = await res.json();
        const valKpi = document.getElementById('kpi-val');
        if (valKpi) valKpi.innerText = data.kpis.total_valuation_mad.toLocaleString(undefined, {minimumFractionDigits: 2});
        
        const stockKpi = document.getElementById('kpi-stock');
        if (stockKpi) stockKpi.innerText = data.kpis.total_global_stock.toLocaleString();
        
        const tbody = document.getElementById('inventory-tbody');
        tbody.innerHTML = '';
        data.inventory.forEach(p => {
            const total = p.landed_cost * p.global_stock;
            const pctKarime = p.global_stock > 0 ? ((p.global_stock / (p.global_stock + p.packer_stock)) * 100).toFixed(1) : '0.0';
            const pctPacker = p.global_stock > 0 ? ((p.packer_stock / (p.global_stock + p.packer_stock)) * 100).toFixed(1) : '0.0';
            
            const tr = document.createElement('tr');
            tr.className = "h-14 hover:bg-primary/5 transition-colors group";
            tr.innerHTML = `
                <td class="py-space-sm px-space-md whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-1 rounded bg-inverse-surface text-inverse-on-surface font-tabular-data text-tabular-data font-bold">${p.sku}</span>
                </td>
                <td class="py-space-sm px-space-md">
                    <div class="flex flex-col">
                        <span class="font-body-md text-body-md font-semibold text-on-surface group-hover:text-primary transition-colors">${p.name}</span>
                    </div>
                </td>
                <td class="py-space-sm px-space-md whitespace-nowrap">
                    <span class="inline-flex items-center px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-md text-label-md font-medium">STOCK-INITIAL</span>
                </td>
                <td class="py-space-sm px-space-md text-right whitespace-nowrap">
                    <span class="font-tabular-data text-tabular-data font-semibold text-on-surface">${p.global_stock}</span>
                </td>
                <td class="py-space-sm px-space-md text-right whitespace-nowrap">
                    <span class="font-tabular-data text-tabular-data font-semibold text-on-surface">${p.packer_stock}</span>
                </td>
                <td class="py-space-sm px-space-md text-right whitespace-nowrap">
                    <span class="font-tabular-data text-tabular-data text-on-surface-variant font-medium">${p.landed_cost.toFixed(2)} MAD</span>
                </td>
                <td class="py-space-sm px-space-md text-right whitespace-nowrap">
                    <span class="font-tabular-data text-tabular-data font-bold text-primary">${total.toFixed(2)} MAD</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    const dRes = await apiCall('/finance/discrepancies');
    if(dRes && dRes.status === 200) {
        const dData = await dRes.json();
        const dtbody = document.getElementById('disc-body');
        dtbody.innerHTML = '';
        dData.filter(d => d.status === 'PENDING_APPROVAL').forEach(d => {
            const tr = document.createElement('tr');
            tr.className = "h-14 hover:bg-primary/5 transition-colors group";
            tr.innerHTML = `
                <td class="py-space-sm px-space-md whitespace-nowrap"><span class="font-tabular-data text-tabular-data font-semibold text-on-surface">${d.id.substring(0,8)}</span></td>
                <td class="py-space-sm px-space-md"><span class="inline-flex items-center px-2 py-1 rounded bg-inverse-surface text-inverse-on-surface font-tabular-data text-tabular-data font-bold">${d.product_sku}</span></td>
                <td class="py-space-sm px-space-md"><span class="font-tabular-data text-tabular-data font-semibold text-on-surface">${d.quantity_missing}</span></td>
                <td class="py-space-sm px-space-md"><span class="font-body-md text-body-md font-semibold text-on-surface">${d.reason}</span></td>
                <td class="py-space-sm px-space-md text-right whitespace-nowrap">
                    <button class="h-8 px-space-sm rounded bg-surface-container-low hover:bg-primary hover:text-on-primary text-on-surface font-label-md text-label-md font-semibold transition-all inline-flex items-center gap-1" onclick="window.resolveDisc('${d.id}', 'APPROVE', this)">APPROVE</button>
                    <button class="h-8 px-space-sm rounded bg-error hover:bg-error-container hover:text-on-error-container text-on-error font-label-md text-label-md font-semibold transition-all inline-flex items-center gap-1 ml-2" onclick="window.resolveDisc('${d.id}', 'REJECT', this)">REJECT</button>
                </td>
            `;
            dtbody.appendChild(tr);
        });
    }
}

window.resolveDisc = async function(id, action, btn) {
    if (btn) btn.disabled = true;
    const res = await apiCall(`/finance/discrepancies/${id}/resolve?action=${action}`, {method: 'PUT'});
    if(res && res.status === 200) loadStock();
    else if (btn) btn.disabled = false;
};

document.getElementById('import-btn')?.addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    
    const formData = new FormData();
    const file = document.getElementById('file')?.files[0];
    if(file) formData.append('file', file);
    else formData.append('lines_json', document.getElementById('lines_json').value || '[]');
    
    formData.append('exchange_rate', document.getElementById('taux-change').value);
    formData.append('customs_duty_pct', document.getElementById('douane').value);
    formData.append('transport_int', document.getElementById('transport-inter').value);
    formData.append('transport_local', document.getElementById('transport-local').value);
    formData.append('assurance', document.getElementById('assurance').value);
    formData.append('dedouanement', document.getElementById('frais-dedouanement').value);
    formData.append('portnet', document.getElementById('portnet').value);
    formData.append('autre', document.getElementById('autres-frais').value);
    formData.append('allocation_key', document.getElementById('cle-repartition').value);
    
    const res = await apiCall('/finance/import', { method: 'POST', body: formData });
    if(res && res.status === 200) {
        alert("Import successful!");
        window.switchView('stock', document.querySelector('[data-path="stock"]'));
    }
    btn.disabled = false;
});

window.updatePreview = function() {
    const jsonStr = document.getElementById('lines_json')?.value;
    if(!jsonStr) return;
    let lines = [];
    try { lines = JSON.parse(jsonStr); } catch(e) { return; }
    
    const exRate = parseFloat(document.getElementById('taux-change').value) || 0;
    const dutyPct = parseFloat(document.getElementById('douane').value) || 0;
    const transport = (parseFloat(document.getElementById('transport-inter').value)||0) + (parseFloat(document.getElementById('transport-local').value)||0);
    const totalAncillary = transport + (parseFloat(document.getElementById('assurance').value)||0) + (parseFloat(document.getElementById('frais-dedouanement').value)||0) + (parseFloat(document.getElementById('portnet').value)||0) + (parseFloat(document.getElementById('autres-frais').value)||0);
    
    const tbody = document.getElementById('recap-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    let totalValue = 0; let totalWeight = 0; let totalQty = 0;
    lines.forEach(l => {
        l.fob = l.quantity * (l.unit_price_usd||0) * exRate;
        l.duty = l.fob * (dutyPct/100);
        totalValue += l.fob; totalWeight += (l.quantity * (l.weight_kg||0)); totalQty += l.quantity;
    });
    const alloc = document.getElementById('cle-repartition')?.value;
    
    lines.forEach(l => {
        let ratio = 0;
        if(alloc==='VALUE'&&totalValue>0) ratio = l.fob/totalValue;
        else if(alloc==='WEIGHT'&&totalWeight>0) ratio = (l.quantity*(l.weight_kg||0))/totalWeight;
        else if(alloc==='QUANTITY'&&totalQty>0) ratio = l.quantity/totalQty;
        
        const lc = l.quantity > 0 ? (l.fob + l.duty + (totalAncillary*ratio))/l.quantity : 0;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/60 transition-colors";
        tr.innerHTML = `
            <td class="py-3 px-4 font-medium text-slate-900">${l.sku}</td>
            <td class="py-3 px-4 text-right font-semibold text-slate-900 num-tabular">${l.fob.toFixed(2)} MAD</td>
            <td class="py-3 px-4 text-right font-semibold text-slate-900 num-tabular">${l.duty.toFixed(2)} MAD</td>
            <td class="py-3 px-4 text-right font-bold text-brand-700 num-tabular">${lc.toFixed(2)} MAD</td>
        `;
        tbody.appendChild(tr);
    });
};

const inputs = ['lines_json', 'taux-change', 'cle-repartition', 'douane', 'transport-inter', 'transport-local', 'assurance', 'frais-dedouanement', 'portnet', 'autres-frais'];
inputs.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('keyup', window.updatePreview);
        el.addEventListener('change', window.updatePreview);
    }
});

// Dynamic Filter & Global Window Scope search
const searchInput = document.getElementById('stock-search-input');
window.applyFilters = function() {
    const query = searchInput.value.toLowerCase().trim();
    const tableRows = document.querySelectorAll('#inventory-tbody tr');
    tableRows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (text.includes(query)) row.classList.remove('hidden');
        else row.classList.add('hidden');
    });
};
if (searchInput) searchInput.addEventListener('input', window.applyFilters);

// Check if we start on stock view
if (!document.getElementById('view-stock').classList.contains('hidden')) {
    loadStock();
}
