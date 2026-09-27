window.logout = function() {
    localStorage.clear();
    window.location.href = '/';
};

window.switchTab = function(tab) {
    if (tab === 'receptionner') {
        document.getElementById('view-receptionner').classList.remove('hidden');
        document.getElementById('view-preparer').classList.add('hidden');
        document.getElementById('btn-tab-receptionner').className = 'h-[58px] rounded-xl bg-primary-container text-on-primary flex items-center justify-center gap-3 px-5 transition-transform shadow-md';
        document.getElementById('btn-tab-preparer').className = 'h-[58px] rounded-xl bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-bright flex items-center justify-center gap-3 px-5 transition-all shadow-sm';
    } else {
        document.getElementById('view-receptionner').classList.add('hidden');
        document.getElementById('view-preparer').classList.remove('hidden');
        document.getElementById('btn-tab-preparer').className = 'h-[58px] rounded-xl bg-primary-container text-on-primary flex items-center justify-center gap-3 px-5 transition-transform shadow-md';
        document.getElementById('btn-tab-receptionner').className = 'h-[58px] rounded-xl bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-bright flex items-center justify-center gap-3 px-5 transition-all shadow-sm';
    }
};

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

async function loadTransfers() {
    const res = await apiCall('/packer/transfers?status=PENDING');
    if (res && res.status === 200) {
        const transfers = await res.json();
        const list = document.getElementById('reception-items-list');
        const badge = document.getElementById('badge-receptionner');
        
        if (list) list.innerHTML = '';
        if (badge) badge.innerText = `${transfers.length} lots`;
        
        if (transfers.length === 0) {
            if (list) list.innerHTML = '<div class="p-6 text-center text-on-surface-variant">Aucun transfert en attente.</div>';
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
                            Envoyé par: WAREHOUSE
                        </span>
                    </div>
                </div>
                <div class="flex-shrink-0 flex items-center gap-2">
                    <button class="h-[56px] px-5 rounded-xl bg-secondary text-on-secondary font-headline-sm text-headline-sm font-bold shadow-md hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-2 select-none" onclick="window.confirmTransfer('${t.id}', this)">
                        <span class="material-symbols-outlined text-[24px]">check_circle</span>
                        <span class="">Confirmer</span>
                    </button>
                </div>
            `;
            if (list) list.appendChild(div);
        });
    }
}

window.confirmTransfer = async function(id, btnElement) {
    if (btnElement.dataset.confirmed) return;
    btnElement.disabled = true;
    btnElement.innerHTML = '<span class="material-symbols-outlined text-[24px] animate-spin">refresh</span><span>Validation...</span>';
    
    const res = await apiCall(`/packer/transfers/${id}/accept`, { method: 'PUT' });
    if (res && res.status === 200) {
        btnElement.dataset.confirmed = "true";
        btnElement.classList.remove('bg-secondary', 'hover:opacity-95');
        btnElement.classList.add('bg-surface-container-high', 'text-secondary', 'cursor-default');
        btnElement.innerHTML = '<span class="material-symbols-outlined text-[24px]">done_all</span><span>Réceptionné</span>';
        
        const row = document.getElementById(`transfer-row-${id}`);
        if(row) {
            row.style.opacity = '0.55';
            row.classList.add('transition-all', 'duration-300');
        }
        
        // Refresh list after 1s
        setTimeout(loadTransfers, 1000);
    } else {
        btnElement.disabled = false;
        btnElement.innerHTML = 'Erreur';
    }
};

window.onload = loadTransfers;
