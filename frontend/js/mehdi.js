function logout() { localStorage.clear(); window.location.href = '/'; }

let inventoryOptions = "";

async function init() {
    // Uses ProductOperationalOut to populate dynamic dropdown
    const res = await apiCall('/b2b/inventory');
    if (res && res.status === 200) {
        const data = await res.json();
        inventoryOptions = data.map(p => `<option value="${p.sku}">${p.name} (${p.sku}) - Stock dispo: ${p.global_stock}</option>`).join('');
        addB2BRow();
        loadOrders();
    }
}

function addB2BRow() {
    const div = document.createElement('div');
    div.className = 'b2b-row';
    div.style.display = 'grid';
    div.style.gridTemplateColumns = '2fr 1fr 1fr';
    div.style.gap = '16px';
    div.style.marginBottom = '12px';
    div.innerHTML = `
        <select class="b2b-sku">${inventoryOptions}</select>
        <input type="number" class="b2b-qty" value="1" min="1" onkeyup="calcTotal()" onchange="calcTotal()">
        <input type="number" class="b2b-price" placeholder="0.00" onkeyup="calcTotal()" onchange="calcTotal()">
    `;
    document.getElementById('b2b-items').appendChild(div);
}

function calcTotal() {
    let ht = 0;
    document.querySelectorAll('.b2b-row').forEach(row => {
        const qty = parseInt(row.querySelector('.b2b-qty').value) || 0;
        const price = parseFloat(row.querySelector('.b2b-price').value) || 0;
        ht += qty * price;
    });
    const tva = ht * 0.20;
    const ttc = ht + tva;
    document.getElementById('total-ht').innerText = ht.toFixed(2);
    document.getElementById('total-tva').innerText = tva.toFixed(2);
    document.getElementById('total-ttc').innerText = ttc.toFixed(2);
}

document.getElementById('submit-b2b').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    
    const items = [];
    document.querySelectorAll('.b2b-row').forEach(row => {
        const sku = row.querySelector('.b2b-sku').value;
        const qty = parseInt(row.querySelector('.b2b-qty').value) || 0;
        const price = parseFloat(row.querySelector('.b2b-price').value) || 0;
        if(qty > 0 && price > 0) items.push({product_sku: sku, quantity: qty, unit_price: price});
    });
    
    if (items.length === 0) { alert("Veuillez ajouter des articles valides"); btn.disabled = false; return; }
    
    const clientName = document.getElementById('b2b-client').value;
    const city = document.getElementById('b2b-city').value;
    if (!clientName || !city) { alert("Le client et la ville sont requis"); btn.disabled = false; return; }

    const res = await apiCall('/b2b/orders', {
        method: 'POST',
        body: JSON.stringify({
            client_name: clientName,
            city: city,
            items: items
        })
    });
    
    if (res && res.status === 200) {
        document.getElementById('b2b-items').innerHTML = '';
        addB2BRow();
        calcTotal();
        loadOrders();
        alert("Commande B2B générée !");
    }
    btn.disabled = false;
});

async function loadOrders() {
    const res = await apiCall('/b2b/orders');
    if (res && res.status === 200) {
        const data = await res.json();
        const tbody = document.getElementById('b2b-orders-body');
        tbody.innerHTML = '';
        let virement = 0;
        data.forEach(o => {
            let total = 0;
            o.items.forEach(i => total += (i.quantity * i.unit_price) * 1.20);
            if (o.payment_status === 'UNPAID') virement += total;
            
            const actionHtml = o.payment_status === 'UNPAID' ? 
                `<button class="btn-success" onclick="markPaid('${o.tracking_number}', this)">✓ Valider Paiement</button>` : '';
                
            tbody.innerHTML += `
                <tr>
                    <td><strong>${o.tracking_number}</strong></td>
                    <td>${o.client_name}</td>
                    <td class="text-right">${total.toFixed(2)}</td>
                    <td><span class="badge" style="background:#E5E7EB">${o.status}</span></td>
                    <td><span class="badge" style="background:${o.payment_status === 'PAID' ? 'var(--confirm-green)' : '#F59E0B'}; color:white">${o.payment_status}</span></td>
                    <td class="text-right">${actionHtml}</td>
                </tr>
            `;
        });
        document.getElementById('kpi-virement').innerText = virement.toFixed(2) + " MAD";
    }
}

async function markPaid(id, btn) {
    btn.disabled = true;
    const res = await apiCall(`/b2b/orders/${id}/payment`, { method: 'PUT' });
    if (res && res.status === 200) loadOrders();
    else btn.disabled = false;
}

init();
