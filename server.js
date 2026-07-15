const http = require('http');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

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

function handleProductos(req, res, url) {
  const method = req.method;

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

function handleVentas(req, res, url) {
  const method = req.method;

  if (method === 'GET' && url.pathname === '/api/ventas/folio') {
    const result = db.exec('SELECT COALESCE(MAX(folio), 0) + 1 AS folio FROM ventas');
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
      const folioResult = db.exec('SELECT COALESCE(MAX(folio), 0) + 1 AS folio FROM ventas');
      const folio = folioResult[0].values[0][0];
      const items = data.items.map(i => ({ ...i, subtotal: i.cantidad * i.precio_unitario }));
      const total = items.reduce((sum, i) => sum + i.subtotal, 0);
      const now = new Date().toLocaleString('es-MX');
      db.run('INSERT INTO ventas (folio, total, items, created_at) VALUES (?, ?, ?, ?)', [folio, total, JSON.stringify(items), now]);
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
      created_at TEXT NOT NULL
    )
  `);
  saveDB();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
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
