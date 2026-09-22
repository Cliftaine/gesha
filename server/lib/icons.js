// icons.js — resuelve el valor `icon` de categorías/marcadores/extras a una URL.
//   'accent-star'        → PNG original (/assets/icons/accent-star.png)
//   'lib:coffee'         → librería SVG incluida (/assets/icons/lib/coffee.svg)
//   '/uploads/icons-…'   → icono propio subido desde el panel
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', '..', 'public', 'assets', 'icons');

function iconSrc(icon) {
  const v = String(icon || '');
  if (v.startsWith('lib:') && /^[a-z0-9-]+$/.test(v.slice(4))) return `/assets/icons/lib/${v.slice(4)}.svg`;
  if (v.startsWith('/uploads/')) return v;
  return `/assets/icons/${v}.png`;
}

// Librería incluida: public/assets/icons/lib/index.json → [{ id, label }].
function libraryIcons() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ICONS_DIR, 'lib', 'index.json'), 'utf8'))
      .map((i) => ({ id: `lib:${i.id}`, label: i.label }));
  } catch {
    return [];
  }
}

module.exports = { iconSrc, libraryIcons, ICONS_DIR };
