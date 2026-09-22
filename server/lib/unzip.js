// unzip.js — lector ZIP mínimo (sin dependencias): directorio central +
// métodos 0 (stored) y 8 (deflate) con zlib. Suficiente para los paquetes de
// promociones; no soporta ZIP64 ni cifrado (se rechazan con error claro).
const zlib = require('zlib');

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

// readZip(buffer, { maxFiles, maxBytes }) → [{ name, data }]
function readZip(buf, { maxFiles = 300, maxBytes = 120 * 1024 * 1024 } = {}) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un ZIP válido');

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || off === 0xffffffff) throw new Error('ZIP64 no soportado: comprime de nuevo con menos archivos');
  if (count > maxFiles) throw new Error(`El ZIP trae demasiados archivos (máx. ${maxFiles})`);

  const entries = [];
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== CEN_SIG) throw new Error('ZIP corrupto (directorio central)');
    const flags = buf.readUInt16LE(off + 8);
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const size = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const locOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    off += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith('/')) continue; // directorio
    if (flags & 0x1) throw new Error('ZIP cifrado no soportado');
    total += size;
    if (total > maxBytes) throw new Error('El contenido del ZIP es demasiado grande');

    if (buf.readUInt32LE(locOff) !== LOC_SIG) throw new Error('ZIP corrupto (cabecera local)');
    const start = locOff + 30 + buf.readUInt16LE(locOff + 26) + buf.readUInt16LE(locOff + 28);
    const raw = buf.subarray(start, start + compSize);
    let data;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: maxBytes });
    else throw new Error(`Método de compresión no soportado en "${name}"`);
    entries.push({ name, data });
  }
  return entries;
}

module.exports = { readZip };
