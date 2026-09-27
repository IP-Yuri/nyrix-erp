window.logout = function() {
    localStorage.clear();
    window.location.href = '/';
};

let currentOrderLines = [];

window.onload = async () => {
    // Load inventory for select
    const invRes = await apiCall('/b2b/inventory');
    if (invRes && invRes.status === 200) {
        const inventoryData = await invRes.json();
        const sel = document.getElementById('sku-select');
        if (sel) {
            sel.innerHTML = '';
            inventoryData.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.sku;
                opt.dataset.name = p.name || p.sku;
                opt.dataset.stock = p.global_stock;
                opt.dataset.cost = p.landed_cost;
                opt.text = `${p.sku} — ${p.name} (Stock: ${p.global_stock} U, Prix: ${parseFloat(p.landed_cost||0).toFixed(2)})`;
                sel.appendChild(opt);
            });
            // trigger change to auto-fill price
            sel.dispatchEvent(new Event('change'));
        }
    }
};

document.getElementById('sku-select')?.addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if(opt) {
        const cost = parseFloat(opt.dataset.cost || 0);
        // markup 20% by default for B2B
        document.getElementById('sku-price').value = (cost * 1.2).toFixed(2);
    }
});

document.getElementById('add-item-btn')?.addEventListener('click', () => {
    const sel = document.getElementById('sku-select');
    if (!sel.value) return;
    const opt = sel.selectedOptions[0];
    const qty = parseInt(document.getElementById('sku-qty').value, 10);
    const price = parseFloat(document.getElementById('sku-price').value);
    
    currentOrderLines.push({
        sku: sel.value,
        name: opt.dataset.name,
        quantity: qty,
        unit_price_mad: price
    });
    
    renderLines();
});

window.removeLine = function(index) {
    currentOrderLines.splice(index, 1);
    renderLines();
};

function renderLines() {
    const container = document.getElementById('order-lines-container');
    const totalEl = document.getElementById('order-total');
    if (!container) return;
    
    container.innerHTML = '';
    let total = 0;
    
    currentOrderLines.forEach((line, idx) => {
        const subtotal = line.quantity * line.unit_price_mad;
        total += subtotal;
        
        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 gap-space-sm items-center py-4 px-4 rounded-lg bg-surface-container-lowest hover:bg-surface-container transition-colors mb-3 border border-outline-variant/60';
        row.innerHTML = `
            <div class="col-span-5 flex items-center gap-space-md">
                <div class="flex flex-col min-w-0">
                    <span class="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">${line.name}</span>
                    <span class="font-tabular-data text-body-sm text-on-surface-variant">SKU: ${line.sku}</span>
                </div>
            </div>
            <div class="col-span-2 text-right">
                <span class="font-tabular-data text-headline-sm font-semibold text-on-surface">${line.quantity}</span>
            </div>
            <div class="col-span-2 text-right">
                <span class="font-tabular-data text-body-md font-semibold text-on-surface">${line.unit_price_mad.toFixed(2)}</span>
            </div>
            <div class="col-span-2 text-right">
                <span class="font-tabular-data text-headline-sm font-semibold text-primary">${subtotal.toFixed(2)}</span>
            </div>
            <div class="col-span-1 flex justify-center">
                <button class="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container transition-colors" onclick="window.removeLine(${idx})">
                    <span class="material-symbols-outlined text-lg">delete</span>
                </button>
            </div>
        `;
        container.appendChild(row);
    });
    
    // Add VAT 20%
    if (totalEl) totalEl.textContent = (total * 1.2).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const generateBtn = document.getElementById('btnGenerateOrder');
if (generateBtn) {
    generateBtn.addEventListener('click', async function() {
        if (currentOrderLines.length === 0) {
            alert('Ajoutez au moins un article');
            return;
        }
        
        const originalHtml = this.innerHTML;
        this.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">refresh</span><span>Émission Sécurisée...</span>';
        this.classList.add('opacity-80', 'pointer-events-none');
        
        const payload = {
            client_name: document.getElementById('client-name').value,
            items: currentOrderLines.map(l => ({ sku: l.sku, quantity: l.quantity, unit_price_mad: l.unit_price_mad }))
        };
        
        const res = await apiCall('/b2b/orders', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        if (res && res.status === 200) {
            this.innerHTML = '<span class="material-symbols-outlined text-lg">check</span><span>Commande B2B Transmise !</span>';
            this.classList.remove('bg-primary-container', 'hover:bg-primary');
            this.classList.add('bg-secondary');
            
            // Prepend to tracking table
            const tbody = document.getElementById('tracking-body');
            const data = await res.json();
            const totalTtc = data.total_value_mad * 1.2;
            
            const tr = document.createElement('tr');
            tr.className = "hover:bg-surface-container-low transition-colors bg-secondary/10";
            tr.innerHTML = `
                <td class="py-3.5 px-4 font-tabular-data font-semibold text-primary">Nouveau</td>
                <td class="py-3.5 px-4 font-medium text-on-surface">${payload.client_name}</td>
                <td class="py-3.5 px-4 text-right font-tabular-data font-semibold">${totalTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</td>
                <td class="py-3.5 px-4"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-tertiary-container font-label-sm text-label-sm font-semibold">En Préparation</span></td>
                <td class="py-3.5 px-4"><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-error font-label-sm text-label-sm font-semibold">En Attente</span></td>
            `;
            if (tbody) tbody.prepend(tr);
            
            // clear form
            currentOrderLines = [];
            renderLines();
            
            setTimeout(() => {
                this.innerHTML = originalHtml;
                this.classList.remove('opacity-80', 'pointer-events-none', 'bg-secondary');
                this.classList.add('bg-primary-container', 'hover:bg-primary');
            }, 2200);
        } else {
            this.innerHTML = 'Erreur serveur';
            this.classList.remove('opacity-80', 'pointer-events-none');
            setTimeout(() => { this.innerHTML = originalHtml; }, 2000);
        }
    });
}
