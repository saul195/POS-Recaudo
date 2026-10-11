const API = '';

function fmt(n) { return '$' + Number(n).toFixed(2); }

let productos = [];
let ticket = [];
let platformInfo = { platform: 'unknown', isWindows: false, isLinux: false };

function productosSinCodigo() {
  return productos.filter(p => !p.codigo);
}

async function cargarProductos() {
  const res = await fetch(API + '/api/productos');
  productos = await res.json();
  renderProductos(productosSinCodigo());
}

function renderProductos(lista) {
  const c = document.getElementById('productList');
  document.getElementById('productCount').textContent = lista.length;
  c.innerHTML = lista.map(p => {
    const stock = p.stock || 0;
    const agotado = stock <= 0;
    const unidad = p.requiere_peso ? 'kg' : 'uds';
    return `
    <div class="product-card ${agotado ? 'agotado' : ''}" onclick="${agotado ? '' : 'agregarTicket(' + p.id + ')'}" title="${p.nombre}">
      <div class="nombre">${p.nombre}</div>
      ${p.categoria ? `<div class="categoria">${p.categoria}</div>` : ''}
      <div class="precio">${fmt(p.precio)}</div>
      <div class="stock-badge ${agotado ? 'agotado' : ''}">${agotado ? 'AGOTADO' : 'Stock: ' + (stock % 1 === 0 ? stock : stock.toFixed(3)) + ' ' + unidad}</div>
      ${p.requiere_peso ? '<div class="peso-badge">Por peso</div>' : ''}
    </div>
  `;
  }).join('');
}

function actualizarTicket() {
  const c = document.getElementById('ticketItems');
  const totalEl = document.getElementById('totalDisplay');
  document.getElementById('btnCobrar').disabled = ticket.length === 0;
  document.getElementById('btnLimpiar').disabled = ticket.length === 0;
  let total = 0;

  c.innerHTML = ticket.map((item, i) => {
    const subtotal = Math.round(item.cantidad * item.precio);
    total += subtotal;
    return `
      <div class="ticket-item">
        <div>
          <div class="item-nombre">${item.nombre}</div>
          <div class="item-detalle">
            ${item.peso
              ? `<input class="cant-input" type="number" step="0.001" min="0" value="${item.cantidad}" onchange="cambiarCantidadTicket(${i}, this.value)" onfocus="this.select()"> kg x ${fmt(item.precio)}/kg`
              : `<input class="cant-input" type="number" step="1" min="0" value="${item.cantidad}" onchange="cambiarCantidadTicket(${i}, this.value)" onfocus="this.select()"> x ${fmt(item.precio)}`}
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
  const p = productos.find(x => x.id === item.id);
  const stock = p ? (p.stock || 0) : 0;
  if (n > stock) { toastWarning('Stock insuficiente de ' + item.nombre + ' (disponible: ' + stock + ')'); actualizarTicket(); return; }
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
    const exist = ticket.findIndex(x => x.id === p.id);
    const actual = exist >= 0 ? ticket[exist].cantidad : 0;
    const stock = p.stock || 0;
    if (actual + 1 > stock) { toastWarning('Stock insuficiente de ' + p.nombre + ' (disponible: ' + stock + ')'); return; }
    if (exist >= 0) {
      ticket[exist].cantidad += 1;
    } else {
      ticket.push({ id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1, peso: null, stock: p.stock || 0 });
    }
    actualizarTicket();
  }
}

function removerTicket(i) { ticket.splice(i, 1); actualizarTicket(); }

let pesoEditIndex = -1;

let pesoCampoActivo = 'peso';

function abrirPesoModal(i) {
  pesoEditIndex = i;
  const item = ticket[i];
  document.getElementById('pesoProductoNombre').textContent = item.nombre;
  document.getElementById('pesoPrecioKg').textContent = fmt(item.precio);
  document.getElementById('pesoInput').value = '';
  document.getElementById('pesoMonto').value = '';
  pesoCampoActivo = 'peso';
  actualizarPesoVista(true);
  document.getElementById('pesoModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('pesoInput').focus(), 100);
}

function pesoPrecio() {
  const item = ticket[pesoEditIndex];
  return item ? item.precio : 0;
}

function actualizarPesoVista(soloVista) {
  const pesoEl = document.getElementById('pesoInput');
  const montoEl = document.getElementById('pesoMonto');
  const vista = document.getElementById('pesoVista');
  const precio = pesoPrecio();
  const peso = parseFloat(pesoEl.value);
  const monto = parseFloat(montoEl.value);

  if (pesoCampoActivo === 'peso') {
    if (peso > 0) {
      const calcMonto = peso * precio;
      if (!soloVista) montoEl.value = calcMonto.toFixed(2);
      vista.textContent = peso.toFixed(3) + ' kg = ' + fmt(calcMonto);
    } else {
      vista.textContent = monto > 0 ? fmt(monto) + ' = ' + (monto / precio).toFixed(3) + ' kg' : '';
    }
  } else {
    if (monto > 0) {
      const calcPeso = monto / precio;
      if (!soloVista) pesoEl.value = calcPeso.toFixed(3);
      vista.textContent = fmt(monto) + ' = ' + calcPeso.toFixed(3) + ' kg';
    } else {
      vista.textContent = peso > 0 ? peso.toFixed(3) + ' kg = ' + fmt(peso * precio) : '';
    }
  }
}

document.getElementById('pesoInput').addEventListener('focus', () => { pesoCampoActivo = 'peso'; actualizarPesoVista(); });
document.getElementById('pesoMonto').addEventListener('focus', () => { pesoCampoActivo = 'monto'; actualizarPesoVista(); });
document.getElementById('pesoInput').addEventListener('input', () => { pesoCampoActivo = 'peso'; actualizarPesoVista(); });
document.getElementById('pesoMonto').addEventListener('input', () => { pesoCampoActivo = 'monto'; actualizarPesoVista(); });

function cerrarPesoModal() {
  document.getElementById('pesoModal').classList.add('hidden');
  if (pesoEditIndex >= 0 && ticket[pesoEditIndex] && !ticket[pesoEditIndex].peso) {
    ticket.splice(pesoEditIndex, 1);
    actualizarTicket();
  }
  pesoEditIndex = -1;
  searchInput.value = '';
  searchResults.classList.remove('visible');
  renderProductos(productosSinCodigo());
}

document.getElementById('btnPesoConfirmar').addEventListener('click', () => {
  actualizarPesoVista();
  const peso = parseFloat(document.getElementById('pesoInput').value);
  if (!peso || peso <= 0) { toastWarning('Ingresa un peso v\u00e1lido o un monto en pesos'); return; }
  if (pesoEditIndex >= 0 && ticket[pesoEditIndex]) {
    const item = ticket[pesoEditIndex];
    const p = productos.find(x => x.id === item.id);
    const stock = p ? (p.stock || 0) : 0;
    if (peso > stock) { toastWarning('Stock insuficiente de ' + item.nombre + ' (disponible: ' + stock + ' kg)'); return; }
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
document.getElementById('pesoMonto').addEventListener('keydown', e => {
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
  document.getElementById('bcPeso').checked = false;
  document.getElementById('barcodeModal').classList.remove('hidden');
}

function cerrarBarcodeModal() {
  document.getElementById('barcodeModal').classList.add('hidden');
  barcodeScannedCode = '';
  searchInput.value = '';
  searchResults.classList.remove('visible');
  renderProductos(productosSinCodigo());
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
  const requiere_peso = document.getElementById('bcPeso').checked ? 1 : 0;

  if (!nombre) { toastWarning('Ingresa el nombre del producto'); return; }
  if (isNaN(precio) || precio < 0) { toastWarning('Ingresa un precio válido'); return; }

  try {
    const res = await fetch(API + '/api/productos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo: barcodeScannedCode, nombre, categoria, precio, requiere_peso })
    });
    const data = await res.json();
    if (!res.ok) { toastError(data.error || 'Error al crear producto'); return; }

    await cargarProductos();
    agregarTicket(data.id);
    mostrarBarcodeToast('Agregado: ' + nombre);
    cerrarBarcodeModal();
  } catch (e) {
    toastError('Error de conexión: ' + e.message);
  }
}

document.getElementById('barcodeModal').addEventListener('click', e => {
  if (e.target === document.getElementById('barcodeModal')) cerrarBarcodeModal();
});

let cobroVentaPendiente = null;

function renderCashButtons(total) {
  const cont = document.getElementById('cashButtons');
  const bills = [20, 50, 100, 200, 500, 1000];
  const exacto = Math.ceil(total);
  let html = `<button type="button" class="btn btn-secondary tooltip-btn cash-btn-exact" data-cash="${exacto}">Exacto ${fmt(exacto)}</button>`;
  html += bills.filter(b => b >= total).slice(0, 5).map(b => `<button type="button" class="btn btn-secondary" data-cash="${b}">${fmt(b)}</button>`).join('');
  cont.innerHTML = html;
  cont.querySelectorAll('[data-cash]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('cobroRecibido').value = btn.dataset.cash;
      calcularCambio();
    });
  });
}

function abrirCobroModal(total, items) {
  cobroVentaPendiente = { total, items };
  document.getElementById('cobroTotalDisplay').textContent = fmt(total);
  document.getElementById('cobroRecibido').value = '';
  document.getElementById('cobroCambioDisplay').textContent = '$0.00';
  document.getElementById('cobroError').style.display = 'none';
  renderCashButtons(total);
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
  const imprimir = document.getElementById('cobroImprimir').checked;

  cerrarCobroModal();

  try {
    const res = await fetch(API + '/api/ventas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, total, recibido, cambio })
    });
    const data = await res.json();
    if (!res.ok) { toastError(data.error || 'Error al registrar venta'); return; }

    if (imprimir) {
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
            toastWarning('Venta registrada. Error al imprimir: ' + (err.error || 'Error desconocido'));
          }
        } catch (e) {
          toastWarning('Venta registrada. Error de impresion: ' + e.message);
        }
      } else {
        toastWarning('Venta registrada. No hay impresora configurada.');
      }
    }

    ticket = [];
    actualizarTicket();
    await cargarProductos();
    document.getElementById('folioDisplay').textContent = String(data.folio + 1).padStart(3, '0');
    toastSuccess('Venta #' + String(data.folio).padStart(4, '0') + ' registrada');
  } catch (e) {
    toastError('Error de conexion: ' + e.message);
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
  if (sinPeso.length) { toastWarning('Hay productos por peso sin asignar'); return; }

  const totalParcial = items.reduce((sum, i) => sum + Math.round(i.cantidad * i.precio_unitario), 0);
  const total = totalParcial;
  abrirCobroModal(total, items);
}

document.getElementById('btnCobrar').addEventListener('click', cobrar);
document.getElementById('btnLimpiar').addEventListener('click', () => { ticket = []; actualizarTicket(); });

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

let searchFiltered = [];
let searchIndex = -1;

function resaltarResultado(nuevoIdx) {
  const items = searchResults.querySelectorAll('.search-result-item');
  if (searchIndex >= 0 && items[searchIndex]) items[searchIndex].classList.remove('active');
  searchIndex = nuevoIdx;
  if (searchIndex >= 0 && items[searchIndex]) {
    items[searchIndex].classList.add('active');
    items[searchIndex].scrollIntoView({ block: 'nearest' });
  }
}

function moverSeleccion(delta) {
  if (!searchFiltered.length) return;
  let idx = searchIndex;
  for (let i = 0; i < searchFiltered.length; i++) {
    idx += delta;
    if (idx < 0) idx = searchFiltered.length - 1;
    if (idx >= searchFiltered.length) idx = 0;
    if ((searchFiltered[idx].stock || 0) > 0) { resaltarResultado(idx); return; }
  }
}

function agregarSeleccionado() {
  if (searchIndex < 0 || !searchFiltered[searchIndex]) return false;
  const p = searchFiltered[searchIndex];
  agregarTicket(p.id);
  searchInput.value = '';
  searchResults.classList.remove('visible');
  renderProductos(productosSinCodigo());
  searchIndex = -1;
  return true;
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  searchIndex = -1;
  if (!q) { searchResults.classList.remove('visible'); renderProductos(productosSinCodigo()); return; }
  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q))
  );
  searchFiltered = filtrados;
  searchResults.innerHTML = filtrados.map(p => {
    const stock = p.stock || 0;
    const agotado = stock <= 0;
    const unidad = p.requiere_peso ? 'kg' : 'uds';
    return `
    <div class="search-result-item ${agotado ? 'agotado' : ''}" ${agotado ? '' : 'onclick="agregarTicket(' + p.id + '); searchInput.value=\'\'; searchResults.classList.remove(\'visible\');"'} title="${p.nombre}">
      <div><div class="nombre">${p.nombre}${agotado ? ' <span class="stock-agotado">AGOTADO</span>' : ' <span class="stock-info">Stock: ' + (stock % 1 === 0 ? stock : stock.toFixed(3)) + ' ' + unidad + '</span>'}</div>${p.codigo ? '<div class="codigo">'+p.codigo+'</div>' : ''}</div>
      <div class="precio">${fmt(p.precio)}</div>
    </div>
  `;
  }).join('');
  searchResults.classList.add('visible');
  renderProductos(filtrados);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moverSeleccion(1); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); moverSeleccion(-1); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (agregarSeleccionado()) return;
    const valor = searchInput.value.trim();
    if (!valor) return;
    const encontrado = buscarCodigoExacto(valor);
    if (encontrado) {
      agregarTicket(encontrado.id);
      mostrarBarcodeToast('Agregado: ' + encontrado.nombre);
      searchInput.value = '';
      searchResults.classList.remove('visible');
      renderProductos(productosSinCodigo());
    } else {
      abrirBarcodeModal(valor);
    }
  }
  if (e.key === 'Escape') { searchResults.classList.remove('visible'); searchIndex = -1; }
});

document.addEventListener('click', e => { if (!e.target.closest('.search-box')) searchResults.classList.remove('visible'); });

function abrirAyuda() { document.getElementById('ayudaModal').classList.remove('hidden'); }
function cerrarAyuda() { document.getElementById('ayudaModal').classList.add('hidden'); }

document.addEventListener('keydown', e => {
  const cobroAbierto = !document.getElementById('cobroModal').classList.contains('hidden');
  const pesoAbierto = !document.getElementById('pesoModal').classList.contains('hidden');
  const barcodeAbierto = !document.getElementById('barcodeModal').classList.contains('hidden');
  if (e.key === 'F1') { e.preventDefault(); abrirAyuda(); return; }
  if (e.key === 'F2') { e.preventDefault(); searchInput.focus(); searchInput.select(); return; }
  if (e.key === 'F8') { e.preventDefault(); if (!cobroAbierto && !pesoAbierto && !barcodeAbierto) cobrar(); return; }
  if (e.key === 'F9') { e.preventDefault(); if (!cobroAbierto && !pesoAbierto && !barcodeAbierto) { ticket = []; actualizarTicket(); } return; }
  if (e.key === 'Escape') { cerrarAyuda(); }
});

async function init() {
  const [folioRes, platRes] = await Promise.all([
    fetch(API + '/api/ventas/folio'),
    fetch(API + '/api/platform')
  ]);
  const folioData = await folioRes.json();
  platformInfo = await platRes.json();
  document.getElementById('folioDisplay').textContent = String(folioData.folio).padStart(3, '0');
  adaptarUIPlataforma();
  await cargarProductos();
  cargarConfigPrinter();
}

init();

function adaptarUIPlataforma() {
  const printerNameInput = document.getElementById('printerNameInput');
  const printerConnection = document.getElementById('printerConnection');
  const printerNameHint = document.getElementById('printerNameHint');
  if (platformInfo.isLinux) {
    printerNameInput.placeholder = 'Ej: Epson_TM-T20, Xprinter, etc.';
    printerNameHint.textContent = 'Linux: usa nombres de CUPS. Verifica con: lpstat -p';
  } else if (platformInfo.isWindows) {
    printerNameInput.placeholder = 'Ej: Epson TM-T20II, Xprinter, etc.';
    printerNameHint.textContent = '';
  } else {
    printerNameHint.textContent = '';
  }
}

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
  adaptarUIPlataforma();
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
  if (!nombre) { toastWarning('Ingresa el nombre de la impresora'); return; }
  if (conexion === 'red' && !ip) { toastWarning('Ingresa la dirección IP de la impresora'); return; }
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
    let detail = config.nombre + ' · ' + config.conexion.toUpperCase() + ' · ' + config.papel + 'mm';
    if (config.conexion === 'usb' && platformInfo.isLinux) {
      detail += ' · Linux (CUPS)';
    } else if (config.conexion === 'usb' && platformInfo.isWindows) {
      detail += ' · Windows';
    }
    statusDetail.textContent = detail;
  } else {
    statusText.textContent = 'No configurada';
    statusText.style.color = 'var(--danger)';
    statusDetail.textContent = 'Haz clic en el indicador de impresora para configurar';
  }
}

async function probarImpresora() {
  const config = JSON.parse(localStorage.getItem('printerConfig') || 'null');
  if (!config || !config.nombre) { toastWarning('Primero configura una impresora'); return; }
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
      toastError('Error: ' + (err.error || 'No se pudo imprimir'));
    }
  } catch (e) {
    toastError('Error de conexion: ' + e.message);
  }
}

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
        codigo: barcodeScannedCode
      })
    });
    if (!res.ok) { const d = await res.json(); toastError(d.error || 'Error al asignar código'); return; }

    await cargarProductos();
    agregarTicket(productoId);
    mostrarBarcodeToast('Código asignado a ' + p.nombre);
    cerrarBarcodeModal();
    document.getElementById('asignarBarcodeModal').classList.add('hidden');
  } catch (e) {
    toastError('Error de conexión: ' + e.message);
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
