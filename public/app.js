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
    if (p.stock <= 0) { abrirStockModal(p); return; }
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

let cobroVentaPendiente = null;

function abrirCobroModal(total, items) {
  cobroVentaPendiente = { total, items };
  document.getElementById('cobroTotalDisplay').textContent = fmt(total);
  document.getElementById('cobroRecibido').value = '';
  document.getElementById('cobroCambioDisplay').textContent = '$0.00';
  document.getElementById('cobroError').style.display = 'none';
  document.getElementById('cobroModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('cobroRecibido').focus(), 100);
}

function cerrarCobroModal() {
  document.getElementById('cobroModal').classList.add('hidden');
  cobroVentaPendiente = null;
}

function calcularCambio() {
  if (!cobroVentaPendiente) return;
  const recibido = parseFloat(document.getElementById('cobroRecibido').value) || 0;
  const total = cobroVentaPendiente.total;
  const cambio = recibido - total;
  document.getElementById('cobroCambioDisplay').textContent = fmt(Math.max(0, cambio));
  document.getElementById('cobroError').style.display = recibido < total && recibido > 0 ? 'block' : 'none';
  document.getElementById('btnCobroConfirmar').disabled = recibido < total;
}

document.getElementById('cobroRecibido').addEventListener('input', calcularCambio);
document.getElementById('cobroRecibido').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!document.getElementById('btnCobroConfirmar').disabled) confirmarCobro();
  }
  if (e.key === 'Escape') cerrarCobroModal();
});
document.getElementById('btnCobroConfirmar').addEventListener('click', confirmarCobro);
document.getElementById('btnCobroCancelar').addEventListener('click', cerrarCobroModal);

async function confirmarCobro() {
  if (!cobroVentaPendiente) return;
  const recibido = parseFloat(document.getElementById('cobroRecibido').value) || 0;
  if (recibido < cobroVentaPendiente.total) return;

  const config = JSON.parse(localStorage.getItem('printerConfig') || 'null');
  const cambio = recibido - cobroVentaPendiente.total;
  const items = cobroVentaPendiente.items;
  const total = cobroVentaPendiente.total;

  cerrarCobroModal();

  try {
    const res = await fetch(API + '/api/ventas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Error al registrar venta'); return; }

    if (config && config.nombre) {
      try {
        const printRes = await fetch(API + '/api/imprimir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            printerName: config.nombre,
            printerConnection: config.conexion,
            printerIP: config.ip,
            folio: data.folio,
            fecha: data.created_at,
            items: data.items,
            total: data.total,
            recibido,
            cambio
          })
        });
        if (!printRes.ok) {
          const err = await printRes.json();
          alert('Venta registrada. Error al imprimir: ' + (err.error || 'Error desconocido'));
        }
      } catch (e) {
        alert('Venta registrada. Error de impresion: ' + e.message);
      }
    } else {
      alert('Venta registrada. No hay impresora configurada.');
    }

    ticket = [];
    actualizarTicket();
    await cargarProductos();
    document.getElementById('folioDisplay').textContent = String(data.folio + 1).padStart(3, '0');
  } catch (e) {
    alert('Error de conexion: ' + e.message);
  }
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

  const total = items.reduce((sum, i) => sum + i.cantidad * i.precio_unitario, 0);
  abrirCobroModal(total, items);
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
  cargarConfigPrinter();
}

init();

function cargarConfigPrinter() {
  const config = JSON.parse(localStorage.getItem('printerConfig') || 'null');
  const dot = document.getElementById('printerDot');
  const nameEl = document.getElementById('printerName');
  if (config && config.nombre) {
    nameEl.textContent = config.nombre;
    dot.className = 'printer-dot active';
  } else {
    nameEl.textContent = 'Sin impresora';
    dot.className = 'printer-dot inactive';
  }
}

function abrirConfigPrinter() {
  const config = JSON.parse(localStorage.getItem('printerConfig') || 'null');
  if (config) {
    document.getElementById('printerNameInput').value = config.nombre || '';
    document.getElementById('printerConnection').value = config.conexion || 'usb';
    document.getElementById('printerPaper').value = config.papel || '80';
    document.getElementById('printerIp').value = config.ip || '';
  }
  toggleIpField();
  actualizarEstadoPrinter();
  document.getElementById('printerModal').classList.remove('hidden');
}

function cerrarConfigPrinter() {
  document.getElementById('printerModal').classList.add('hidden');
}

function toggleIpField() {
  const conn = document.getElementById('printerConnection').value;
  document.getElementById('printerIpField').style.display = conn === 'red' ? 'block' : 'none';
}

document.getElementById('printerConnection').addEventListener('change', toggleIpField);

function guardarConfigPrinter() {
  const nombre = document.getElementById('printerNameInput').value.trim();
  const conexion = document.getElementById('printerConnection').value;
  const papel = document.getElementById('printerPaper').value;
  const ip = document.getElementById('printerIp').value.trim();
  if (!nombre) { alert('Ingresa el nombre de la impresora'); return; }
  if (conexion === 'red' && !ip) { alert('Ingresa la dirección IP de la impresora'); return; }
  const config = { nombre, conexion, papel, ip };
  localStorage.setItem('printerConfig', JSON.stringify(config));
  cargarConfigPrinter();
  cerrarConfigPrinter();
}

function actualizarEstadoPrinter() {
  const config = JSON.parse(localStorage.getItem('printerConfig') || 'null');
  const statusText = document.getElementById('printerStatusText');
  const statusDetail = document.getElementById('printerStatusDetail');
  if (config && config.nombre) {
    statusText.textContent = 'Configurada';
    statusText.style.color = '#4caf50';
    statusDetail.textContent = config.nombre + ' · ' + config.conexion.toUpperCase() + ' · ' + config.papel + 'mm';
  } else {
    statusText.textContent = 'No configurada';
    statusText.style.color = 'var(--danger)';
    statusDetail.textContent = 'Haz clic en el indicador de impresora para configurar';
  }
}

async function probarImpresora() {
  const config = JSON.parse(localStorage.getItem('printerConfig') || 'null');
  if (!config || !config.nombre) { alert('Primero configura una impresora'); return; }
  try {
    const res = await fetch(API + '/api/imprimir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printerName: config.nombre,
        printerConnection: config.conexion,
        printerIP: config.ip,
        folio: 0,
        fecha: new Date().toLocaleString('es-MX'),
        items: [{ producto_nombre: 'Prueba de conexion', cantidad: 1, peso: null, precio_unitario: 0, subtotal: 0 }],
        total: 0,
        recibido: 0,
        cambio: 0
      })
    });
    if (res.ok) {
      mostrarBarcodeToast('Impresion enviada correctamente');
    } else {
      const err = await res.json();
      alert('Error: ' + (err.error || 'No se pudo imprimir'));
    }
  } catch (e) {
    alert('Error de conexion: ' + e.message);
  }
}

let stockProductoActual = null;

function abrirStockModal(producto) {
  stockProductoActual = producto;
  document.getElementById('stockProductoNombre').textContent = producto.nombre;
  document.getElementById('stockActual').textContent = producto.stock.toFixed(producto.requiere_peso ? 3 : 0);
  document.getElementById('stockAgregar').value = '';
  document.getElementById('stockModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('stockAgregar').focus(), 100);
}

function cerrarStockModal() {
  document.getElementById('stockModal').classList.add('hidden');
  stockProductoActual = null;
}

async function confirmarAgregarStock() {
  if (!stockProductoActual) return;
  const cantidad = parseFloat(document.getElementById('stockAgregar').value);
  if (isNaN(cantidad) || cantidad <= 0) { alert('Ingresa una cantidad válida'); return; }

  const nuevoStock = stockProductoActual.stock + cantidad;
  try {
    const res = await fetch(API + '/api/productos/' + stockProductoActual.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: stockProductoActual.nombre,
        categoria: stockProductoActual.categoria,
        precio: stockProductoActual.precio,
        requiere_peso: stockProductoActual.requiere_peso,
        stock: nuevoStock,
        codigo: stockProductoActual.codigo
      })
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Error al actualizar stock'); return; }

    const pid = stockProductoActual.id;
    cerrarStockModal();
    await cargarProductos();
    agregarTicket(pid);
    mostrarBarcodeToast('Stock actualizado');
  } catch (e) {
    alert('Error de conexión: ' + e.message);
  }
}

document.getElementById('stockAgregar').addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmarAgregarStock();
  if (e.key === 'Escape') cerrarStockModal();
});

document.getElementById('stockModal').addEventListener('click', e => {
  if (e.target === document.getElementById('stockModal')) cerrarStockModal();
});

let productosSinBarcodeCache = [];

function abrirAsignarBarcode() {
  productosSinBarcodeCache = productos.filter(p => !p.codigo || p.codigo.trim() === '');
  document.getElementById('asignarBarcodeCodigo').textContent = barcodeScannedCode;
  document.getElementById('buscarSinBarcode').value = '';
  renderProductosSinBarcode(productosSinBarcodeCache);
  document.getElementById('barcodeNotFound').classList.add('hidden');
  document.getElementById('asignarBarcodeModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('buscarSinBarcode').focus(), 100);
}

function renderProductosSinBarcode(lista) {
  const contenedor = document.getElementById('productosSinBarcode');
  if (!lista.length) {
    contenedor.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:20px">No se encontraron productos</p>';
    return;
  }
  contenedor.innerHTML = lista.map(p => `
    <div class="producto-sin-bc">
      <div>
        <div class="psb-nombre">${p.nombre}</div>
        <div class="psb-info">${fmt(p.precio)}${p.categoria ? ' · ' + p.categoria : ''}</div>
      </div>
      <button class="psb-btn" onclick="asignarCodigoABarcode(${p.id})">Asignar</button>
    </div>
  `).join('');
}

document.getElementById('buscarSinBarcode').addEventListener('input', () => {
  const q = document.getElementById('buscarSinBarcode').value.trim().toLowerCase();
  if (!q) { renderProductosSinBarcode(productosSinBarcodeCache); return; }
  const filtrados = productosSinBarcodeCache.filter(p => p.nombre.toLowerCase().includes(q) || (p.categoria && p.categoria.toLowerCase().includes(q)));
  renderProductosSinBarcode(filtrados);
});

function cerrarAsignarBarcodeModal() {
  document.getElementById('asignarBarcodeModal').classList.add('hidden');
  document.getElementById('barcodeNotFound').classList.remove('hidden');
}

async function asignarCodigoABarcode(productoId) {
  const p = productos.find(x => x.id === productoId);
  if (!p) return;

  try {
    const res = await fetch(API + '/api/productos/' + productoId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: p.nombre,
        categoria: p.categoria,
        precio: p.precio,
        requiere_peso: p.requiere_peso,
        stock: p.stock,
        codigo: barcodeScannedCode
      })
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Error al asignar código'); return; }

    await cargarProductos();
    agregarTicket(productoId);
    mostrarBarcodeToast('Código asignado a ' + p.nombre);
    cerrarBarcodeModal();
    document.getElementById('asignarBarcodeModal').classList.add('hidden');
  } catch (e) {
    alert('Error de conexión: ' + e.message);
  }
}

document.getElementById('buscarSinBarcode').addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarAsignarBarcodeModal();
});

document.getElementById('asignarBarcodeModal').addEventListener('click', e => {
  if (e.target === document.getElementById('asignarBarcodeModal')) {
    cerrarAsignarBarcodeModal();
  }
});
