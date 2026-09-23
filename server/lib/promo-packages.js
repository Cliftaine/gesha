// promo-packages.js — "plantillas HTML" de promociones subidas desde el panel.
// Un paquete es un .zip (o un .html suelto) con index.html + imágenes/estilos/
// fuentes. El index.html declara campos editables con placeholders:
//   {{precio}}            campo de texto
//   {{precio|$79}}        con valor por defecto
//   {{img:foto|foto.jpg}} campo de imagen (default = archivo del paquete)
//   {{list:contiene|A;B}}  lista: una línea por elemento → <li>…</li>
//   {{opt:logo_pos|a,b,c}} selector de opciones (la primera es el default)
//   {{pos:foto|50% 50%}}   encuadre de la imagen `foto` (object-position /
//                          background-position); el panel lo edita arrastrando
//                          y lo guarda en values.foto_pos
// Un valor vacío explícito ("") se respeta: deja el hueco vacío (los diseños
// ocultan lo vacío con :empty); sin valor ⇒ default del paquete.
// Además de los subidos hay diseños INCLUIDOS en server/promo-layouts/<id>/
// (ids "base-…", solo lectura) que se sirven y editan igual.
// Opcional: promo.json → { "name": "...", "labels": { "precio": "Precio" } }.
// Los archivos viven en data/promo-packages/<id>/ y el índice (con los campos
// detectados) en data/promo-packages.json, vía store ⇒ versión + SSE.
const fs = require('fs');
const path = require('path');
const store = require('./store');
const { readZip } = require('./unzip');

const ROOT = path.join(__dirname, '..', '..', 'data', 'promo-packages');
const BUILTIN_ROOT = path.join(__dirname, '..', 'promo-layouts');
const INDEX = 'data/promo-packages.json';

const ALLOWED_EXT = new Set([
  '.html', '.css', '.js', '.mjs', '.json', '.txt',
  '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg',
  '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm',
]);

const PLACEHOLDER = /\{\{\s*(img:|list:|opt:|pos:)?([a-zA-Z0-9_-]+)\s*(?:\|([^}]*))?\}\}/g;
const POS = /^\d{1,3}% \d{1,3}%$/;

function index() {
  const idx = store.getSafe(INDEX, null);
  return idx && idx.packages ? idx : { packages: {} };
}

// Resolución de diseño de un paquete: promo.json → "size": [ancho, alto].
// Default 1080×1920. 4K = 2160×3840 (o 3840×2160 horizontal): el carrusel
// escala el iframe al marco, así que el HTML se maqueta en sus píxeles reales.
const SIZES = [[1080, 1920], [2160, 3840], [1920, 1080], [3840, 2160]];
function sizeOf(raw) {
  const [w, h] = Array.isArray(raw) ? raw.map(Number) : [];
  return SIZES.some(([a, b]) => a === w && b === h) ? { width: w, height: h } : { width: 1080, height: 1920 };
}

// Diseños incluidos: se escanean del disco (cache por mtime del index.html).
const builtinCache = new Map();
function builtins() {
  let dirs = [];
  try { dirs = fs.readdirSync(BUILTIN_ROOT).filter((d) => /^base-[a-z0-9-]+$/.test(d)).sort(); } catch { return []; }
  const out = [];
  for (const id of dirs) {
    const file = path.join(BUILTIN_ROOT, id, 'index.html');
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    const hit = builtinCache.get(id);
    if (hit && hit.mtimeMs === stat.mtimeMs) { out.push(hit.meta); continue; }
    let manifest = {};
    try { manifest = JSON.parse(fs.readFileSync(path.join(BUILTIN_ROOT, id, 'promo.json'), 'utf8')); } catch { /* opcional */ }
    const meta = {
      id,
      name: manifest.name || id,
      description: manifest.description || '',
      ...sizeOf(manifest.size),
      fields: scanFields(fs.readFileSync(file, 'utf8'), manifest.labels || {}),
      builtin: true,
      thumb: fs.existsSync(path.join(BUILTIN_ROOT, id, 'thumb.jpg')) ? `/promo-pkg/${id}/thumb.jpg` : null,
    };
    builtinCache.set(id, { mtimeMs: stat.mtimeMs, meta });
    out.push(meta);
  }
  return out;
}

function list() {
  const uploaded = Object.values(index().packages).sort((a, b) => a.name.localeCompare(b.name));
  return [...builtins(), ...uploaded].map((p) => (p.width ? p : { ...p, ...sizeOf(null) }));
}

function get(id) {
  const pkg = index().packages[id] || builtins().find((b) => b.id === id) || null;
  // Paquetes subidos antes de existir la resolución ⇒ 1080×1920.
  return pkg && !pkg.width ? { ...pkg, ...sizeOf(null) } : pkg;
}

function orientationOf(pkg) {
  return pkg.width > pkg.height ? 'horizontal' : 'vertical';
}

function dirOf(id) {
  return path.join(index().packages[id] ? ROOT : BUILTIN_ROOT, id);
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Limpia y valida las rutas del zip; si todo cuelga de una sola carpeta
// (lo normal al comprimir una carpeta), la quita.
function normalizeEntries(entries) {
  let files = entries
    .map((e) => ({ name: e.name.replace(/\\/g, '/'), data: e.data }))
    .filter((e) => !e.name.startsWith('__MACOSX/') && !e.name.split('/').some((seg) => seg.startsWith('.')));

  const hasRootIndex = files.some((f) => f.name === 'index.html');
  if (!hasRootIndex) {
    const tops = new Set(files.map((f) => f.name.split('/')[0]));
    if (tops.size === 1 && files.every((f) => f.name.includes('/'))) {
      const prefix = [...tops][0] + '/';
      files = files.map((f) => ({ ...f, name: f.name.slice(prefix.length) }));
    }
  }

  for (const f of files) {
    const segs = f.name.split('/');
    if (!f.name || f.name.startsWith('/') || segs.includes('..') || segs.includes('') || /^[a-zA-Z]:/.test(f.name)) {
      throw new Error(`Ruta inválida dentro del paquete: "${f.name}"`);
    }
    const ext = path.extname(f.name).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) throw new Error(`Tipo de archivo no permitido: "${f.name}"`);
  }
  if (!files.some((f) => f.name === 'index.html')) {
    throw new Error('El paquete debe incluir un index.html en la raíz');
  }
  return files;
}

// index.html → [{ key, type: 'text'|'image', default, label }]
function scanFields(html, labels = {}) {
  const fields = new Map();
  const framed = new Set(); // imágenes con {{pos:…}} → encuadre editable
  // Los comentarios HTML no cuentan (suelen documentar la sintaxis).
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(PLACEHOLDER)) {
    const key = m[2];
    if (m[1] === 'pos:') { framed.add(key); continue; }
    const def = (m[3] || '').trim();
    const prev = fields.get(key);
    if (prev) {
      if (!prev.default && def) prev.default = def;
      continue;
    }
    const type = { 'img:': 'image', 'list:': 'list', 'opt:': 'select' }[m[1]] || 'text';
    const field = { key, type, default: def, label: labels[key] || key };
    if (type === 'select') {
      field.options = def.split(',').map((o) => o.trim()).filter(Boolean);
      field.default = field.options[0] || '';
    }
    fields.set(key, field);
  }
  for (const key of framed) if (fields.get(key)?.type === 'image') fields.get(key).framing = true;
  return [...fields.values()];
}

// install(buffer, { filename, replaceId }) → metadata del paquete.
function install(buffer, { filename = 'promo.zip', replaceId = null } = {}) {
  const isHtml = /\.html?$/i.test(filename);
  const files = isHtml
    ? [{ name: 'index.html', data: buffer }]
    : normalizeEntries(readZip(buffer));

  let manifest = {};
  const mf = files.find((f) => f.name === 'promo.json');
  if (mf) {
    try { manifest = JSON.parse(mf.data.toString('utf8')) || {}; } catch { throw new Error('promo.json no es JSON válido'); }
  }

  const idx = structuredClone(index());
  let id;
  if (replaceId) {
    if (!idx.packages[replaceId]) throw new Error('El paquete a reemplazar no existe (los diseños incluidos no se reemplazan)');
    id = replaceId;
  } else {
    const base = slugify(manifest.name || filename.replace(/\.[^.]+$/, '')) || 'promo';
    id = base;
    for (let n = 2; get(id); n++) id = `${base}-${n}`;
  }

  // Escribir a un directorio temporal y hacer swap: nunca queda a medias.
  const dir = path.join(ROOT, id);
  const tmp = dir + '.tmp-' + Date.now().toString(36);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    for (const f of files) {
      const abs = path.join(tmp, f.name);
      if (!abs.startsWith(tmp + path.sep)) throw new Error(`Ruta inválida: "${f.name}"`);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, f.data);
    }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(tmp, dir);
  } catch (err) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw err;
  }

  const html = files.find((f) => f.name === 'index.html').data.toString('utf8');
  const meta = {
    id,
    name: String(manifest.name || idx.packages[id]?.name || filename.replace(/\.[^.]+$/, '')),
    // promo.json manda; si no trae size, se conserva lo elegido en el panel.
    ...(manifest.size || !idx.packages[id] ? sizeOf(manifest.size) : sizeOf([idx.packages[id].width, idx.packages[id].height])),
    fields: scanFields(html, manifest.labels || {}),
    files: files.length,
    bytes: files.reduce((n, f) => n + f.data.length, 0),
    uploadedAt: new Date().toISOString(),
  };
  idx.packages[id] = meta;
  store.put(INDEX, idx);
  return meta;
}

// Cambia la resolución de diseño de un paquete subido (selector del panel).
function setSize(id, width, height) {
  const idx = structuredClone(index());
  if (!idx.packages[id]) return null;
  if (!SIZES.some(([w, h]) => w === width && h === height)) throw new Error('Resolución no soportada');
  Object.assign(idx.packages[id], sizeOf([width, height]));
  store.put(INDEX, idx);
  return idx.packages[id];
}

function remove(id) {
  const idx = structuredClone(index());
  if (!idx.packages[id]) return false;
  delete idx.packages[id];
  fs.rmSync(path.join(ROOT, id), { recursive: true, force: true });
  store.put(INDEX, idx);
  return true;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// index.html del paquete con los valores de una promo (o los defaults).
function render(id, values = {}) {
  if (!get(id)) return null;
  const file = path.join(dirOf(id), 'index.html');
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  return html.replace(PLACEHOLDER, (_, kind, key, def) => {
    const fallback = (def || '').trim();
    if (kind === 'pos:') {
      const pos = values[`${key}_pos`];
      return POS.test(pos) ? pos : (POS.test(fallback) ? fallback : '50% 50%');
    }
    const v = typeof values[key] === 'string' ? values[key] : null;
    if (kind === 'opt:') {
      const options = fallback.split(',').map((o) => o.trim()).filter(Boolean);
      return escapeHtml(options.includes(v) ? v : options[0] || '');
    }
    if (kind === 'list:') {
      return (v != null ? v : fallback)
        .split(/\r?\n|;/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('');
    }
    return escapeHtml(v != null ? v : fallback);
  });
}

module.exports = { ROOT, BUILTIN_ROOT, SIZES, setSize, orientationOf, list, get, install, remove, render, scanFields };
