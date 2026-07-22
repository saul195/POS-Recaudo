const http = require('http');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { execSync } = require('child_process');
const net = require('net');
const os = require('os');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = path.join(__dirname, 'database.sqlite');

let db;

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  filePath = path.normalize(filePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end(); return;
  }
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(d2);
        });
      } else {
        res.writeHead(500); res.end('Error interno');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function fechaLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function handleProductos(req, res, url) {
  const method = req.method;

  if (method === 'DELETE' && url.pathname === '/api/productos') {
    db.run('DELETE FROM productos');
    saveDB();
    sendJSON(res, 200, { ok: true, message: 'Todos los productos fueron eliminados' });
    return true;
  }

  if (method === 'GET' && url.pathname === '/api/productos') {
    const q = url.searchParams.get('q');
    let rows;
    if (q) {
      const stmt = db.prepare('SELECT * FROM productos WHERE nombre LIKE ? OR codigo LIKE ? ORDER BY id');
      stmt.bind(['%' + q + '%', '%' + q + '%']);
      rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
    } else {
      const stmt = db.prepare('SELECT * FROM productos ORDER BY id');
      rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
    }
    sendJSON(res, 200, rows);
    return true;
  }

  if (method === 'POST' && url.pathname === '/api/productos') {
    readBody(req).then(data => {
      if (!data.nombre || !data.nombre.trim()) { sendJSON(res, 400, { error: 'El nombre es obligatorio' }); return; }
      const dup = db.exec("SELECT id FROM productos WHERE LOWER(TRIM(nombre)) = LOWER(TRIM('" + data.nombre.trim().replace(/'/g, "''") + "'))");
      if (dup.length && dup[0].values.length) { sendJSON(res, 409, { error: 'Ya existe un producto con ese nombre' }); return; }
      if (data.codigo) {
        const dupCod = db.exec("SELECT id FROM productos WHERE codigo IS NOT NULL AND LOWER(TRIM(codigo)) = LOWER(TRIM('" + data.codigo.trim().replace(/'/g, "''") + "'))");
        if (dupCod.length && dupCod[0].values.length) { sendJSON(res, 409, { error: 'Ya existe un producto con ese código de barras' }); return; }
      }
      db.run(
        'INSERT INTO productos (codigo, nombre, categoria, precio, requiere_peso, stock) VALUES (?, ?, ?, ?, ?, ?)',
        [data.codigo || null, data.nombre.trim(), data.categoria || null, parseFloat(data.precio) || 0, data.requiere_peso ? 1 : 0, parseFloat(data.stock) || 0]
      );
      const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      const nuevo = db.exec('SELECT * FROM productos WHERE id = ' + lastId);
      saveDB();
      sendJSON(res, 201, nuevo[0] ? nuevo[0].values.map(r => {
        const obj = {};
        nuevo[0].columns.forEach((c, i) => obj[c] = r[i]);
        return obj;
      })[0] : { id: lastId });
    }).catch(e => sendJSON(res, 400, { error: e.message }));
    return true;
  }

  const idMatch = url.pathname.match(/^\/api\/productos\/(\d+)$/);
  if (idMatch) {
    const id = parseInt(idMatch[1]);

    if (method === 'PUT') {
      readBody(req).then(data => {
        const exResult = db.exec('SELECT * FROM productos WHERE id = ' + id);
        if (!exResult.length || !exResult[0].values.length) { sendJSON(res, 404, { error: 'Producto no encontrado' }); return; }
        const existing = {};
        exResult[0].columns.forEach((c, i) => existing[c] = exResult[0].values[0][i]);

        if (!data.nombre || !data.nombre.trim()) { sendJSON(res, 400, { error: 'El nombre es obligatorio' }); return; }
        const dup = db.exec("SELECT id FROM productos WHERE LOWER(TRIM(nombre)) = LOWER(TRIM('" + data.nombre.trim().replace(/'/g, "''") + "')) AND id != " + id);
        if (dup.length && dup[0].values.length) { sendJSON(res, 409, { error: 'Ya existe un producto con ese nombre' }); return; }
        if (data.codigo) {
          const dupCod = db.exec("SELECT id FROM productos WHERE codigo IS NOT NULL AND LOWER(TRIM(codigo)) = LOWER(TRIM('" + data.codigo.trim().replace(/'/g, "''") + "')) AND id != " + id);
          if (dupCod.length && dupCod[0].values.length) { sendJSON(res, 409, { error: 'Ya existe un producto con ese código de barras' }); return; }
        }
        db.run(
          'UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, precio = ?, requiere_peso = ?, stock = ? WHERE id = ?',
          [
            data.codigo !== undefined ? (data.codigo || null) : existing.codigo,
            data.nombre.trim(),
            data.categoria !== undefined ? (data.categoria || null) : existing.categoria,
            parseFloat(data.precio) || 0,
            data.requiere_peso !== undefined ? (data.requiere_peso ? 1 : 0) : existing.requiere_peso,
            parseFloat(data.stock) || 0,
            id
          ]
        );
        saveDB();
        const upResult = db.exec('SELECT * FROM productos WHERE id = ' + id);
        const updated = {};
        upResult[0].columns.forEach((c, i) => updated[c] = upResult[0].values[0][i]);
        sendJSON(res, 200, updated);
      }).catch(e => sendJSON(res, 400, { error: e.message }));
      return true;
    }

    if (method === 'DELETE') {
      const exResult = db.exec('SELECT id FROM productos WHERE id = ' + id);
      if (!exResult.length || !exResult[0].values.length) { sendJSON(res, 404, { error: 'Producto no encontrado' }); return true; }
      db.run('DELETE FROM productos WHERE id = ?', [id]);
      saveDB();
      sendJSON(res, 200, { ok: true });
      return true;
    }
  }

  return false;
}

function handleImport(req, res) {
  if (req.method !== 'POST' || req.url !== '/api/productos/import') return false;
  readBody(req).then(data => {
    if (!Array.isArray(data)) { sendJSON(res, 400, { error: 'Se esperaba un array de productos' }); return; }
    let count = 0;
    for (const item of data) {
      if (!item.nombre || !item.nombre.trim()) continue;
      const dup = db.exec("SELECT id FROM productos WHERE LOWER(TRIM(nombre)) = LOWER(TRIM('" + item.nombre.trim().replace(/'/g, "''") + "'))");
      if (dup.length && dup[0].values.length) continue;
      db.run(
        'INSERT INTO productos (codigo, nombre, categoria, precio, requiere_peso, stock) VALUES (?, ?, ?, ?, ?, ?)',
        [item.codigo || null, item.nombre.trim(), item.categoria || null, parseFloat(item.precio) || 0, item.requiere_peso ? 1 : 0, parseFloat(item.stock) || 0]
      );
      count++;
    }
    saveDB();
    sendJSON(res, 200, { ok: true, imported: count, total: data.length });
  }).catch(e => sendJSON(res, 400, { error: e.message }));
  return true;
}

function parseRows(result) {
  if (!result.length || !result[0].values.length) return [];
  return result[0].values.map(r => {
    const obj = {};
    result[0].columns.forEach((c, i) => obj[c] = r[i]);
    return obj;
  });
}

function parseRow(result) {
  const rows = parseRows(result);
  return rows.length ? rows[0] : null;
}

function generarTicket(data) {
  const NL = '\n';
  const W = 48;
  let t = '';
  t += '\x1B\x40';
  t += '\x1B\x74\x10';
  t += '\x1B\x61\x01';
  t += '\x1B\x21\x18';
  t += 'RECAUDO' + NL;
  t += '\x1B\x21\x00';
  t += data.fecha + NL;
  t += 'Folio: #' + String(data.folio).padStart(4, '0') + NL;
  t += NL;
  t += '\x1B\x61\x00';
  t += '-'.repeat(W) + NL;
  for (const item of data.items) {
    const name = item.producto_nombre;
    const qty = item.peso ? item.cantidad.toFixed(3) + 'kg' : 'x' + item.cantidad.toFixed(0);
    const sub = '$' + item.subtotal.toFixed(2);
    const detail = name + ' ' + qty;
    t += detail.padEnd(W - sub.length) + sub + NL;
    if (item.peso) {
      const unitPrice = '$' + item.precio_unitario.toFixed(2) + '/kg';
      t += ('  @' + unitPrice).padEnd(W) + NL;
    }
  }
  t += '-'.repeat(W) + NL;
  t += '\x1B\x61\x02';
  t += '\x1B\x45\x01';
  t += ('TOTAL: $' + data.total.toFixed(2)) + NL;
  t += '\x1B\x45\x00';
  t += ('RECIBIDO: $' + data.recibido.toFixed(2)) + NL;
  t += ('CAMBIO: $' + data.cambio.toFixed(2)) + NL;
  t += '\x1B\x61\x00';
  t += '-'.repeat(W) + NL;
  t += '\x1B\x61\x01';
  t += 'Gracias por su compra' + NL;
  t += NL + NL + NL + NL + NL + NL;
  t += '\x1D\x56\x00';
  return t;
}

function imprimirTCP(ip, port, escposData) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port || 9100, ip, () => {
      socket.write(Buffer.from(escposData, 'binary'));
      socket.end();
      resolve();
    });
    socket.on('error', reject);
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error('Timeout de conexion con la impresora'));
    });
  });
}

function imprimirWindows(printerName, escposData) {
  const dataFile = path.join(os.tmpdir(), 'ticket_data_' + Date.now() + '.bin');
  const psFile = path.join(os.tmpdir(), 'print_ticket_' + Date.now() + '.ps1');
  fs.writeFileSync(dataFile, escposData, 'binary');
  const psScript = `
$ErrorActionPreference = "Stop"
Add-Type @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [DllImport("winspool.drv", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, IntPtr pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBuf, int cbBuf, out int pcWritten);
}
"@

$printer = '${printerName.replace(/'/g, "''")}'
$file = '${dataFile.replace(/'/g, "''")}'
$bytes = [System.IO.File]::ReadAllBytes($file)

$hPrinter = [IntPtr]::Zero
if (-not [RawPrinterHelper]::OpenPrinter($printer, [ref]$hPrinter, [IntPtr]::Zero)) {
    throw "No se pudo abrir la impresora: $printer (Error: $([System.Runtime.InteropServices.Marshal]::GetLastWin32Error()))"
}

$docName = [System.Runtime.InteropServices.Marshal]::StringToHGlobalAnsi("Ticket POS")
$docInfoPtr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal([IntPtr]::Size * 3)
[System.Runtime.InteropServices.Marshal]::WriteIntPtr($docInfoPtr, 0, $docName)
[System.Runtime.InteropServices.Marshal]::WriteIntPtr($docInfoPtr, [IntPtr]::Size, [IntPtr]::Zero)
[System.Runtime.InteropServices.Marshal]::WriteIntPtr($docInfoPtr, [IntPtr]::Size * 2, [IntPtr]::Zero)

if (-not [RawPrinterHelper]::StartDocPrinter($hPrinter, 1, $docInfoPtr)) {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($docInfoPtr)
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($docName)
    [RawPrinterHelper]::ClosePrinter($hPrinter)
    throw "StartDocPrinter fallo (Error: $err)"
}
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($docInfoPtr)
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($docName)

if (-not [RawPrinterHelper]::StartPagePrinter($hPrinter)) {
    [RawPrinterHelper]::EndDocPrinter($hPrinter)
    [RawPrinterHelper]::ClosePrinter($hPrinter)
    throw "StartPagePrinter fallo"
}

$buf = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $buf, $bytes.Length)
$written = 0
if (-not [RawPrinterHelper]::WritePrinter($hPrinter, $buf, $bytes.Length, [ref]$written)) {
    $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($buf)
    [RawPrinterHelper]::EndPagePrinter($hPrinter)
    [RawPrinterHelper]::EndDocPrinter($hPrinter)
    [RawPrinterHelper]::ClosePrinter($hPrinter)
    throw "WritePrinter fallo (Error: $err)"
}
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($buf)
[RawPrinterHelper]::EndPagePrinter($hPrinter)
[RawPrinterHelper]::EndDocPrinter($hPrinter)
[RawPrinterHelper]::ClosePrinter($hPrinter)

Write-Output "OK:$written"
`;
  fs.writeFileSync(psFile, psScript);
  try {
    const result = execSync(`powershell -ExecutionPolicy Bypass -NoProfile -File "${psFile}"`, {
      windowsHide: true,
      timeout: 10000,
      encoding: 'utf8'
    });
    console.log('[Impresion]', result.trim());
  } finally {
    setTimeout(() => {
      try { fs.unlinkSync(dataFile); } catch(e) {}
      try { fs.unlinkSync(psFile); } catch(e) {}
    }, 1000);
  }
}

function handleVentas(req, res, url) {
  const method = req.method;

  if (method === 'DELETE' && url.pathname === '/api/ventas') {
    db.run('DELETE FROM ventas');
    saveDB();
    sendJSON(res, 200, { ok: true, message: 'Todas las ventas fueron eliminadas' });
    return true;
  }

  if (method === 'GET' && url.pathname === '/api/ventas/folio') {
    const hoy = fechaLocal();
    const result = db.exec("SELECT COALESCE(MAX(folio), 0) + 1 AS folio FROM ventas WHERE fecha_venta = '" + hoy + "'");
    const folio = result.length ? result[0].values[0][0] : 1;
    sendJSON(res, 200, { folio });
    return true;
  }

  if (method === 'GET' && url.pathname === '/api/ventas') {
    const desde = url.searchParams.get('desde');
    const hasta = url.searchParams.get('hasta');
    let result;
    if (desde && hasta) {
      result = db.exec("SELECT * FROM ventas WHERE created_at >= '" + desde + "' AND created_at <= '" + hasta + " 23:59:59' ORDER BY id DESC");
    } else {
      result = db.exec('SELECT * FROM ventas ORDER BY id DESC');
    }
    const rows = parseRows(result);
    const parsed = rows.map(v => ({ ...v, items: JSON.parse(v.items) }));
    sendJSON(res, 200, parsed);
    return true;
  }

  if (method === 'GET' && url.pathname === '/api/reportes') {
    const periodo = url.searchParams.get('periodo') || 'hoy';
    const hoy = fechaLocal();
    let fechaInicio;
    if (periodo === 'semana') {
      const d = new Date(); d.setDate(d.getDate() - 6);
      fechaInicio = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    } else if (periodo === 'mes') {
      const d = new Date(); d.setDate(1);
      fechaInicio = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    } else {
      fechaInicio = hoy;
    }
    const ventas = parseRows(db.exec("SELECT * FROM ventas WHERE fecha_venta >= '" + fechaInicio + "' AND fecha_venta <= '" + hoy + "' ORDER BY id DESC"));
    let totalVentas = ventas.length;
    let totalIngresos = 0;
    const productoMap = {};
    for (const v of ventas) {
      totalIngresos += v.total;
      const items = JSON.parse(v.items);
      for (const it of items) {
        const key = it.producto_nombre;
        if (!productoMap[key]) productoMap[key] = { nombre: key, cantidad: 0, ingresos: 0 };
        productoMap[key].cantidad += it.cantidad;
        productoMap[key].ingresos += it.subtotal;
      }
    }
    const productos = Object.values(productoMap).sort((a, b) => b.ingresos - a.ingresos);
    sendJSON(res, 200, { periodo, fechaInicio, fechaFin: hoy, totalVentas, totalIngresos, productos });
    return true;
  }

  if (method === 'POST' && url.pathname === '/api/ventas') {
    readBody(req).then(data => {
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        sendJSON(res, 400, { error: 'La venta debe tener al menos un item' }); return;
      }
      for (const item of data.items) {
        const prod = parseRow(db.exec('SELECT * FROM productos WHERE id = ' + item.producto_id));
        if (!prod) { sendJSON(res, 400, { error: 'Producto no encontrado: ' + item.producto_id }); return; }
        if (item.cantidad > prod.stock) { sendJSON(res, 400, { error: 'Stock insuficiente para ' + prod.nombre + '. Disponible: ' + prod.stock.toFixed(3) }); return; }
      }
      for (const item of data.items) {
        const prod = parseRow(db.exec('SELECT stock FROM productos WHERE id = ' + item.producto_id));
        const nuevoStock = Math.max(0, prod.stock - item.cantidad);
        db.run('UPDATE productos SET stock = ? WHERE id = ?', [nuevoStock, item.producto_id]);
      }
      const hoy = fechaLocal();
      const folioResult = db.exec("SELECT COALESCE(MAX(folio), 0) + 1 AS folio FROM ventas WHERE fecha_venta = '" + hoy + "'");
      const folio = folioResult[0].values[0][0];
      const items = data.items.map(i => ({ ...i, subtotal: i.cantidad * i.precio_unitario }));
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      const now = new Date().toLocaleString('es-MX');
      db.run('INSERT INTO ventas (folio, total, items, created_at, fecha_venta) VALUES (?, ?, ?, ?, ?)', [folio, total, JSON.stringify(items), now, hoy]);
      const ventaResult = db.exec('SELECT last_insert_rowid()');
      const id = ventaResult[0].values[0][0];
      saveDB();
      sendJSON(res, 201, { id, folio, total, items, created_at: now });
    }).catch(e => sendJSON(res, 400, { error: e.message }));
    return true;
  }

  return false;
}

async function start() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT,
      nombre TEXT NOT NULL UNIQUE,
      categoria TEXT,
      precio REAL DEFAULT 0,
      requiere_peso INTEGER DEFAULT 0,
      stock REAL DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio INTEGER NOT NULL,
      total REAL NOT NULL,
      items TEXT NOT NULL,
      created_at TEXT NOT NULL,
      fecha_venta TEXT NOT NULL DEFAULT ''
    )
  `);
  try { db.run("ALTER TABLE ventas ADD COLUMN fecha_venta TEXT NOT NULL DEFAULT ''"); } catch(e) {}
  const oldSales = parseRows(db.exec("SELECT id, created_at FROM ventas WHERE fecha_venta = ''"));
  for (const s of oldSales) {
    const match = s.created_at.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const fecha = match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0');
      db.run("UPDATE ventas SET fecha_venta = '" + fecha + "' WHERE id = " + s.id);
    }
  }
  saveDB();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/imprimir' && req.method === 'POST') {
        readBody(req).then(async data => {
          try {
            const ticket = generarTicket(data);
            if (data.printerConnection === 'red' && data.printerIP) {
              await imprimirTCP(data.printerIP, 9100, ticket);
            } else if (data.printerName) {
              imprimirWindows(data.printerName, ticket);
            } else {
              sendJSON(res, 400, { error: 'No hay impresora configurada' }); return;
            }
            sendJSON(res, 200, { ok: true });
          } catch (e) {
            sendJSON(res, 500, { error: 'Error al imprimir: ' + e.message });
          }
        }).catch(e => sendJSON(res, 400, { error: e.message }));
        return;
      }
      if (handleProductos(req, res, url)) return;
      if (handleImport(req, res)) return;
      if (handleVentas(req, res, url)) return;
      sendJSON(res, 404, { error: 'Endpoint no encontrado' });
      return;
    }

    serveStatic(req, res);
  });

  server.listen(PORT, () => {
    console.log('POS Recaudo corriendo en http://localhost:' + PORT);
  });
}

start().catch(err => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});
