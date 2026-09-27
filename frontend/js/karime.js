window.logout = function() {
    localStorage.clear();
    window.location.href = '/';
};

window.onload = async () => {
    const inboundRes = await apiCall('/warehouse/inbound');
    if (inboundRes && inboundRes.status === 200) {
        const inboundData = await inboundRes.json();
        if (inboundData.length > 0) {
            document.getElementById('view-inbound').classList.remove('hidden');
            const tbody = document.getElementById('inbound-table');
            if (tbody) tbody.innerHTML = '';
            
            inboundData.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-surface-container transition-colors";
                tr.innerHTML = `
                    <td class="py-3 px-space-md">
                        <span class="font-tabular-data text-tabular-data font-bold text-primary bg-primary-fixed/30 px-2 py-0.5 rounded">${item.sku}</span>
                    </td>
                    <td class="py-3 px-space-md">
                        <div class="font-semibold text-on-surface">${item.name || item.sku}</div>
                    </td>
                    <td class="py-3 px-space-md text-right">
                        <span class="font-tabular-data text-metric-md font-bold text-on-surface">${item.quantity}</span>
                        <span class="text-on-surface-variant font-label-sm ml-1">Unités</span>
                    </td>
                `;
                if(tbody) tbody.appendChild(tr);
            });
        } else {
            document.getElementById('view-operations').classList.remove('hidden');
            loadOperations();
        }
    }
};

const btnValidateReceipt = document.getElementById('btnValidateReceipt');
if (btnValidateReceipt) {
    btnValidateReceipt.addEventListener('click', async () => {
        btnValidateReceipt.disabled = true;
        btnValidateReceipt.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">refresh</span><span>Validation en cours...</span>';
        
        const res = await apiCall('/warehouse/inbound/accept', { method: 'POST' });
        if (res && res.status === 200) {
            btnValidateReceipt.innerHTML = '<span class="material-symbols-outlined text-[20px]">check</span><span>Réception Confirmée</span>';
            btnValidateReceipt.classList.remove('bg-secondary');
            btnValidateReceipt.classList.add('bg-primary');
            setTimeout(() => {
                document.getElementById('view-inbound').classList.add('hidden');
                document.getElementById('view-operations').classList.remove('hidden');
                loadOperations();
            }, 1000);
        } else {
            btnValidateReceipt.innerHTML = 'Erreur';
            btnValidateReceipt.disabled = false;
        }
    });
}

window.inventoryOptionsHtml = '';
async function loadOperations() {
    const invRes = await apiCall('/warehouse/inventory');
    if (invRes && invRes.status === 200) {
        const inventoryData = await invRes.json();
        let optionsHtml = '';
        inventoryData.forEach(p => {
            optionsHtml += `<option value="${p.sku}">${p.sku} — ${p.name} (Dispo: ${p.global_stock} U)</option>`;
        });
        window.inventoryOptionsHtml = optionsHtml;
        const selects = document.querySelectorAll('.transfer-sku');
        selects.forEach(sel => {
            sel.innerHTML = optionsHtml;
        });
    }
    
    const opsBody = document.getElementById('ops-logistics-body');
    if (opsBody) opsBody.innerHTML = '';
    
    // Simulate logistics lines for now
    const dummyLogistics = [
        { id: "ORD-2026-001", type: "B2C", status: "Livré", class: "bg-secondary-container text-on-secondary-container" },
        { id: "B2B-88301", type: "B2B Palettes", status: "Expédié", class: "bg-primary-fixed text-on-primary-fixed" },
        { id: "ORD-2026-002", type: "B2C", status: "En Préparation", class: "bg-on-tertiary-container text-tertiary" }
    ];
    
    dummyLogistics.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = "table-row-item hover:bg-surface-container-low transition-colors duration-150";
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-tabular-data text-tabular-data font-semibold text-on-surface">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[16px] text-outline">inventory_2</span>
                    <span class="">#${log.id}</span>
                </div>
            </td>
            <td class="py-2.5 px-4">
                <span class="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface-variant text-on-surface-variant font-label-sm text-label-sm font-semibold tracking-wide">${log.type}</span>
            </td>
            <td class="py-2.5 px-4">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${log.class}">
                    ${log.status}
                </span>
            </td>
        `;
        if (opsBody) opsBody.appendChild(tr);
    });
}

const formTransfer = document.getElementById('transferForm');
if (formTransfer) {
    const container = document.getElementById('transferLinesContainer');
    const btnAdd = document.getElementById('btnAddTransferLine');
    
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            const line = document.createElement('div');
            line.className = "transfer-line p-2.5 rounded-lg bg-surface-container-low flex flex-col sm:flex-row items-stretch sm:items-center gap-2 border border-outline-variant/60";
            line.innerHTML = `
                <div class="relative flex-1">
                    <select class="transfer-sku w-full h-10 px-3 pr-8 rounded-lg bg-surface-container-lowest text-on-surface text-body-sm font-body-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer border border-outline-variant/60">
                        ${window.inventoryOptionsHtml}
                    </select>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <input class="transfer-qty w-16 h-10 px-2 text-center text-metric-md font-tabular-data bg-surface-container-lowest border border-outline-variant/60 text-on-surface rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" min="1" type="number" value="1">
                    <button class="btnRemoveLine w-9 h-10 rounded-lg bg-transparent text-outline hover:text-error flex items-center justify-center transition-colors cursor-pointer" type="button" title="Supprimer la ligne">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            `;
            container.appendChild(line);
        });
    }
    
    if (container) {
        container.addEventListener('click', (e) => {
            const btnRemove = e.target.closest('.btnRemoveLine');
            if (btnRemove) {
                const lines = document.querySelectorAll('.transfer-line');
                if (lines.length > 1) {
                    btnRemove.closest('.transfer-line').remove();
                } else {
                    alert('Il doit y avoir au moins une ligne');
                }
            }
        });
    }

    formTransfer.addEventListener('submit', async (e) => {
        e.preventDefault();
        const lines = document.querySelectorAll('.transfer-line');
        const payload = [];
        lines.forEach(line => {
            const sku = line.querySelector('.transfer-sku').value;
            const qty = parseInt(line.querySelector('.transfer-qty').value, 10);
            if (sku && qty > 0) {
                payload.push({ product_sku: sku, quantity: qty });
            }
        });
        
        if (payload.length === 0) return;
        
        const btn = e.target.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        
        try {
            const promises = payload.map(item => apiCall('/warehouse/transfers', {
                method: 'POST',
                body: JSON.stringify(item)
            }));
            
            const results = await Promise.all(promises);
            const allSuccess = results.every(res => res && res.status === 200);
            
            if (allSuccess) {
                alert('Transfert créé avec succès');
                loadOperations();
                // Reset to 1 line
                const remainingLines = document.querySelectorAll('.transfer-line');
                for (let i = 1; i < remainingLines.length; i++) {
                    remainingLines[i].remove();
                }
                if (remainingLines[0]) {
                    remainingLines[0].querySelector('.transfer-qty').value = 1;
                }
            } else {
                alert('Erreur lors du transfert de certaines lignes');
            }
        } catch(err) {
            alert('Erreur réseau');
        }
        
        if (btn) btn.disabled = false;
    });
}
