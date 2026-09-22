// store.js — JSON en disco como única fuente de datos.
// Lectura con cache invalidado por mtime, escritura atómica (tmp + rename),
// contador de versión global y EventEmitter para que SSE empuje cambios.
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const ROOT = path.join(__dirname, '..', '..');

const emitter = new EventEmitter();
emitter.setMaxListeners(100); // muchas pantallas conectadas por SSE

let version = 1;
const cache = new Map(); // relPath -> { mtimeMs, data }

function absPath(relPath) {
  const abs = path.normalize(path.join(ROOT, relPath));
  if (!abs.startsWith(ROOT)) throw new Error('Ruta fuera del proyecto: ' + relPath);
  return abs;
}

function get(relPath) {
  const abs = absPath(relPath);
  const stat = fs.statSync(abs);
  const hit = cache.get(relPath);
  if (hit && hit.mtimeMs === stat.mtimeMs) return hit.data;
  const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
  cache.set(relPath, { mtimeMs: stat.mtimeMs, data });
  return data;
}

function getSafe(relPath, fallback = null) {
  try {
    return get(relPath);
  } catch {
    return fallback;
  }
}

// silent: escribe sin subir la versión ni avisar a las pantallas (borradores).
function put(relPath, obj, { silent = false } = {}) {
  const abs = absPath(relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = abs + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, abs); // atómico en el mismo filesystem
  const stat = fs.statSync(abs);
  cache.set(relPath, { mtimeMs: stat.mtimeMs, data: obj });
  if (silent) return version;
  version++;
  emitter.emit('change', relPath);
  return version;
}

function remove(relPath, { silent = false } = {}) {
  const abs = absPath(relPath);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
  cache.delete(relPath);
  if (silent) return version;
  version++;
  emitter.emit('change', relPath);
  return version;
}

module.exports = {
  get,
  getSafe,
  put,
  remove,
  version: () => version,
  onChange: (fn) => emitter.on('change', fn),
  offChange: (fn) => emitter.off('change', fn),
};
