const API = '';

function fmt(n) { return '$' + Number(n).toFixed(2); }

let productos = [];
let ticket = [];

async function cargarProductos() {
  const res = await fetch(API + '/api/productos');
  productos = await res.json();
  renderProductos(productos);
}

function renderProductos(lista) {
  const c = document.getElementById('productList');
  document.getElementById('productCount').textContent = lista.length;
  c.innerHTML = lista.map(p => `
    <div class="product-card" onclick="agregarTicket(${p.id})" title="${p.nombre}">
      <div class="nombre">${p.nombre}</div>
      ${p.categoria ? `<div class="categoria">${p.categoria}</div>` : ''}
      <div class="precio">${fmt(p.precio)}</div>
      ${p.requiere_peso ? '<div class="peso-badge">Por peso</div>' : ''}
    </div>
  `).join('');
}

function obtenerStockTicket(item) {
  const prod = productos.find(p => p.id === item.id);
  return prod ? prod.stock : 0;
}

function actualizarTicket() {
  const c = document.getElementById('ticketItems');
  const totalEl = document.getElementById('totalDisplay');
  document.getElementById('btnCobrar').disabled = ticket.length === 0;
  document.getElementById('btnLimpiar').disabled = ticket.length === 0;
  let total = 0;

  c.innerHTML = ticket.map((item, i) => {
    const subtotal = item.cantidad * item.precio;
    total += subtotal;
    const stock = obtenerStockTicket(item);
    const excede = item.cantidad > 0 && item.cantidad > stock;
    return `
      <div class="ticket-item ${excede ? 'ticket-excede' : ''}">
        <div>
          <div class="item-nombre">${item.nombre}</div>
          <div class="item-detalle">
            ${item.peso
              ? `<input class="cant-input ${excede ? 'cant-excede' : ''}" type="number" step="0.001" min="0" value="${item.cantidad}" onchange="cambiarCantidadTicket(${i}, this.value)" onfocus="this.select()"> kg x ${fmt(item.precio)}/kg`
              : `<input class="cant-input ${excede ? 'cant-excede' : ''}" type="number" step="1" min="0" value="${item.cantidad}" onchange="cambiarCantidadTicket(${i}, this.value)" onfocus="this.select()"> x ${fmt(item.precio)}`}
            ${excede ? `<div class="stock-aviso">Stock disp: ${stock.toFixed(item.peso ? 3 : 0)}</div>` : ''}
          </div>
        </div>
        <div class="item-subtotal">${fmt(subtotal)}</div>
        <button class="item-remove" onclick="removerTicket(${i})">&times;</button>
      </div>
    `;
  }).join('');

  if (!ticket.length) c.innerHTML = '<div class="ticket-empty">Agrega productos al ticket</div>';
  totalEl.textContent = fmt(total);
}

function cambiarCantidadTicket(i, val) {
  const n = parseFloat(val);
  if (isNaN(n) || n < 0) return;
  const item = ticket[i];
  item.cantidad = n;
  if (item.peso) item.peso = n;
  actualizarTicket();
}

function agregarTicket(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;

  if (p.requiere_peso) {
    if (ticket.some(x => x.id === p.id && !x.peso)) return;
    ticket.push({ id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 0, peso: null });
    abrirPesoModal(ticket.length - 1);
  } else {
    if (p.stock <= 0) { alert('Sin stock disponible'); return; }
    const exist = ticket.findIndex(x => x.id === p.id);
    if (exist >= 0) {
      const enTicket = ticket[exist].cantidad;
      if (enTicket >= p.stock) { alert('Stock insuficiente'); return; }
      ticket[exist].cantidad += 1;
    } else {
      ticket.push({ id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1, peso: null });
    }
    actualizarTicket();
  }
}

function removerTicket(i) { ticket.splice(i, 1); actualizarTicket(); }

let pesoEditIndex = -1;

function abrirPesoModal(i) {
  pesoEditIndex = i;
  const item = ticket[i];
  document.getElementById('pesoProductoNombre').textContent = item.nombre;
  document.getElementById('pesoPrecioKg').textContent = fmt(item.precio);
  document.getElementById('pesoInput').value = '';
  document.getElementById('pesoModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('pesoInput').focus(), 100);
}

function cerrarPesoModal() {
  document.getElementById('pesoModal').classList.add('hidden');
  if (pesoEditIndex >= 0 && ticket[pesoEditIndex] && !ticket[pesoEditIndex].peso) {
    ticket.splice(pesoEditIndex, 1);
    actualizarTicket();
  }
  pesoEditIndex = -1;
  searchInput.value = '';
  searchResults.classList.remove('visible');
  renderProductos(productos);
}

document.getElementById('btnPesoConfirmar').addEventListener('click', () => {
  const peso = parseFloat(document.getElementById('pesoInput').value);
  if (!peso || peso <= 0) { alert('Ingresa un peso v\u00e1lido'); return; }
  if (pesoEditIndex >= 0 && ticket[pesoEditIndex]) {
    const item = ticket[pesoEditIndex];
    const prod = productos.find(p => p.id === item.id);
    if (prod && peso > prod.stock) { alert('Stock insuficiente. Disponible: ' + prod.stock.toFixed(3) + ' kg'); return; }
    item.peso = peso;
    item.cantidad = peso;
    document.getElementById('pesoModal').classList.add('hidden');
    pesoEditIndex = -1;
    actualizarTicket();
  }
});

document.getElementById('btnPesoCancelar').addEventListener('click', cerrarPesoModal);
document.querySelector('.modal-close').addEventListener('click', cerrarPesoModal);
document.getElementById('pesoInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnPesoConfirmar').click();
  if (e.key === 'Escape') cerrarPesoModal();
});

let barcodeScanBuffer = '';
let barcodeScanTimer = null;

function buscarCodigoExacto(codigo) {
  const c = codigo.trim().toLowerCase();
  return productos.find(p => p.codigo && p.codigo.trim().toLowerCase() === c) || null;
}

function mostrarBarcodeToast(mensaje) {
  const toast = document.getElementById('barcodeToast');
  toast.textContent = mensaje;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2500);
}

let barcodeScannedCode = '';

function abrirBarcodeModal(codigo) {
  barcodeScannedCode = codigo;
  document.getElementById('barcodeScanned').textContent = codigo;
  document.getElementById('barcodeFormCodigo').textContent = codigo;
  document.getElementById('barcodeNotFound').classList.remove('hidden');
  document.getElementById('barcodeFormRapido').classList.add('hidden');
  document.getElementById('bcNombre').value = '';
  document.getElementById('bcCategoria').value = '';
  document.getElementById('bcPrecio').value = '';
  document.getElementById('bcStock').value = '';
  document.getElementById('bcPeso').checked = false;
  document.getElementById('barcodeModal').classList.remove('hidden');
}

function cerrarBarcodeModal() {
  document.getElementById('barcodeModal').classList.add('hidden');
  barcodeScannedCode = '';
  searchInput.value = '';
  searchResults.classList.remove('visible');
  renderProductos(productos);
}

function mostrarFormRapido() {
  document.getElementById('barcodeNotFound').classList.add('hidden');
  document.getElementById('barcodeFormRapido').classList.remove('hidden');
  document.getElementById('bcNombre').focus();
}

async function agregarProductoRapido() {
  const nombre = document.getElementById('bcNombre').value.trim();
  const categoria = document.getElementById('bcCategoria').value.trim() || null;
  const precio = parseFloat(document.getElementById('bcPrecio').value);
  const stock = parseFloat(document.getElementById('bcStock').value);
  const requiere_peso = document.getElementById('bcPeso').checked ? 1 : 0;

  if (!nombre) { alert('Ingresa el nombre del producto'); return; }
  if (isNaN(precio) || precio < 0) { alert('Ingresa un precio válido'); return; }
  if (isNaN(stock) || stock < 0) { alert('Ingresa el stock válido'); return; }

  try {
    const res = await fetch(API + '/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: barcodeScannedCode, nombre, categoria, precio, stock, requiere_peso })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Error al crear producto'); return; }

    await cargarProductos();
    agregarTicket(data.id);
    mostrarBarcodeToast('Agregado: ' + nombre);
    cerrarBarcodeModal();
  } catch (e) {
    alert('Error de conexión: ' + e.message);
  }
}

document.getElementById('barcodeModal').addEventListener('click', e => {
  if (e.target === document.getElementById('barcodeModal')) cerrarBarcodeModal();
});

function imprimirTicket(venta) {
  const itemsHtml = (venta.items || []).map(d => {
    const detalle = d.peso
      ? `${d.cantidad.toFixed(3)} kg x $${d.precio_unitario.toFixed(2)}`
      : `${d.cantidad.toFixed(0)} x $${d.precio_unitario.toFixed(2)}`;
    return `<tr><td>${d.producto_nombre}</td><td style="text-align:right">${detalle}</td><td style="text-align:right">$${d.subtotal.toFixed(2)}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket #${String(venta.folio).padStart(4,'0')}</title>
<style>body{font-family:'Courier New',monospace;font-size:12px;width:80mm;margin:0;padding:5mm;}table{width:100%;border-collapse:collapse;}td,th{padding:2px 0;}.header{text-align:center;font-weight:bold;margin-bottom:10px;font-size:14px;}.linea{border-top:1px dashed #000;margin:6px 0;}.total{font-weight:bold;font-size:16px;text-align:right;}.footer{text-align:center;margin-top:10px;font-size:10px;}</style></head>
<body><div class="header">RECAUDO<br>${venta.created_at}<br>FOLIO: #${String(venta.folio).padStart(4,'0')}</div>
<div class="linea"></div><table><tr><th style="text-align:left">Producto</th><th style="text-align:right">Cant</th><th style="text-align:right">Subtotal</th></tr>${itemsHtml}</table>
<div class="linea"></div><div class="total">TOTAL: $${venta.total.toFixed(2)}</div>
<div class="footer">Gracias por su compra</div>
<script>window.print();window.close();<\/script></body></html>`;
  const win = window.open('', '_blank', 'width=300,height=600');
  win.document.write(html);
  win.document.close();
}

async function cobrar() {
  const items = ticket.map(item => ({
    producto_id: item.id,
    producto_nombre: item.nombre,
    cantidad: item.cantidad,
    peso: item.peso || null,
    precio_unitario: item.precio
  }));

  const sinPeso = items.filter(x => {
    const p = productos.find(pr => pr.id === x.producto_id);
    return p && p.requiere_peso && !x.peso;
  });
  if (sinPeso.length) { alert('Hay productos por peso sin asignar'); return; }

  for (const item of items) {
    const prod = productos.find(p => p.id === item.producto_id);
    if (prod && item.cantidad > prod.stock) {
      alert('Stock insuficiente para ' + prod.nombre + '. Disponible: ' + prod.stock.toFixed(3));
      return;
    }
  }

  try {
    const res = await fetch(API + '/api/ventas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Error al registrar venta'); return; }

    imprimirTicket(data);

    ticket = [];
    actualizarTicket();
    await cargarProductos();
    document.getElementById('folioDisplay').textContent = String(data.folio + 1).padStart(3, '0');
  } catch (e) {
    alert('Error de conexión: ' + e.message);
  }
}

document.getElementById('btnCobrar').addEventListener('click', cobrar);
document.getElementById('btnLimpiar').addEventListener('click', () => { ticket = []; actualizarTicket(); });

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { searchResults.classList.remove('visible'); renderProductos(productos); return; }
  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q))
  );
  searchResults.innerHTML = filtrados.map(p => `
    <div class="search-result-item" onclick="agregarTicket(${p.id}); searchInput.value=''; searchResults.classList.remove('visible');">
      <div><div class="nombre">${p.nombre}</div>${p.codigo ? '<div class="codigo">'+p.codigo+'</div>' : ''}</div>
      <div class="precio">${fmt(p.precio)}</div>
    </div>
  `).join('');
  searchResults.classList.add('visible');
  renderProductos(filtrados);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const valor = searchInput.value.trim();
    if (!valor) return;
    const encontrado = buscarCodigoExacto(valor);
    if (encontrado) {
      agregarTicket(encontrado.id);
      mostrarBarcodeToast('Agregado: ' + encontrado.nombre);
      searchInput.value = '';
      searchResults.classList.remove('visible');
      renderProductos(productos);
    } else {
      abrirBarcodeModal(valor);
    }
  }
  if (e.key === 'Escape') searchResults.classList.remove('visible');
});

document.addEventListener('click', e => { if (!e.target.closest('.search-box')) searchResults.classList.remove('visible'); });
document.addEventListener('keydown', e => {
  if (e.key === 'F8') { e.preventDefault(); cobrar(); }
  if (e.key === 'F9') { e.preventDefault(); ticket = []; actualizarTicket(); }
});

async function init() {
  const res = await fetch(API + '/api/ventas/folio');
  const data = await res.json();
  document.getElementById('folioDisplay').textContent = String(data.folio).padStart(3, '0');
  await cargarProductos();
}

init();
