// api.js — API de administración (montada detrás de authGate en index.js).
// PUT con If-Match:<version> → 409 en conflicto para evitar lost updates.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('../lib/store');
const { getWeather } = require('../lib/weather');
const { getComida } = require('../lib/comida');
const { selectSlides } = require('../lib/promo-engine');
const { menuIds, cartaIds, renderCarta } = require('../lib/render');
const theme = require('../lib/theme');
const promoPackages = require('../lib/promo-packages');
const { libraryIcons, ICONS_DIR } = require('../lib/icons');

const router = express.Router();
router.use(express.json({ limit: '2mb' }));

// GET devuelve { version, data }; el PUT correspondiente exige If-Match.
function jsonResource(relPathFor, validate = null) {
  return {
    get(req, res) {
      res.json({ version: store.version(), data: store.get(relPathFor(req)) });
    },
    put(req, res) {
      const ifMatch = Number(req.get('If-Match'));
      if (ifMatch && ifMatch !== store.version()) {
        return res.status(409).json({ error: 'Conflicto: alguien más guardó cambios', version: store.version() });
      }
      if (validate) {
        const err = validate(req);
        if (err) return res.status(400).json({ error: err });
      }
      const version = store.put(relPathFor(req), req.body);
      res.json({ ok: true, version });
    },
  };
}

const dispatchRes = jsonResource(() => 'config/dispatch.json', (req) =>
  !req.body?.sucursales ? 'dispatch.json debe tener "sucursales"' : null
);
router.get('/config/dispatch', dispatchRes.get);
router.put('/config/dispatch', dispatchRes.put);

const settingsRes = jsonResource(() => 'config/settings.json');
router.get('/config/settings', settingsRes.get);
router.put('/config/settings', settingsRes.put);

function checkMenuId(req, res, next) {
  if (!menuIds().includes(req.params.id)) return res.status(404).json({ error: 'Menú desconocido' });
  next();
}

// Lista de menús (cartas editables) — el panel la usa para navegar y asignar.
router.get('/menus', (req, res) => {
  const list = menuIds().map((id) => {
    const m = store.getSafe(`data/menus/${id}.json`) || {};
    return { id, title: m.title || id, canvas: m.canvas || 'vertical', dense: !!m.dense, resolution: m.resolution === '4k' ? '4k' : '1080' };
  });
  res.json({ version: store.version(), menus: list });
});

// Crear un menú nuevo (scaffold vacío listo para el editor).
router.post('/menus', (req, res) => {
  const title = (req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Falta "title"' });
  const id = (req.body?.id || title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!id) return res.status(400).json({ error: 'Id inválido' });
  if (cartaIds().includes(id)) {
    return res.status(409).json({ error: `Ya existe una carta "${id}"` });
  }
  const scaffold = {
    id,
    template: theme.TEMPLATES[req.body?.template] ? req.body.template : 'clasica',
    title,
    dense: false,
    canvas: req.body?.canvas === 'horizontal' ? 'horizontal' : 'vertical',
    sizes: [],
    columns: Number(req.body?.columns) === 3 ? [[], [], []] : [[], []],
    categories: {},
    featured: null,
    imageStrip: null,
    extras: null,
  };
  const version = store.put(`data/menus/${id}.json`, scaffold);
  res.json({ ok: true, id, version });
});

// Eliminar un menú (el panel confirma antes; las pantallas que lo usaban
// caen a su carta default en el siguiente resolve).
router.delete('/menus/:id', checkMenuId, (req, res) => {
  store.remove(draftPath(req), { silent: true });
  const version = store.remove(`data/menus/${req.params.id}.json`);
  res.json({ ok: true, version });
});

const menuRes = jsonResource((req) => `data/menus/${req.params.id}.json`, (req) =>
  !req.body?.categories ? 'el menú debe tener "categories"' : null
);
// GET incluye el borrador guardado (o null). PUT = "Aplicar": publica a las
// pantallas y descarta el borrador, que ya quedó aplicado.
router.get('/menus/:id', checkMenuId, (req, res) => {
  res.json({
    version: store.version(),
    data: store.get(`data/menus/${req.params.id}.json`),
    draft: store.getSafe(draftPath(req), null),
  });
});
router.put('/menus/:id', checkMenuId, (req, res) => {
  store.remove(draftPath(req), { silent: true });
  menuRes.put(req, res);
});

// ── Borradores de carta ─────────────────────────────────────────────────────
// Viven en data/drafts/menus/<id>.json y se escriben en silencio: no suben la
// versión ni refrescan las pantallas. Solo "Aplicar" (PUT /menus/:id) publica.
function draftPath(req) {
  return `data/drafts/menus/${req.params.id}.json`;
}
router.put('/menus/:id/draft', checkMenuId, (req, res) => {
  if (!req.body?.categories) return res.status(400).json({ error: 'el menú debe tener "categories"' });
  store.put(draftPath(req), req.body, { silent: true });
  res.json({ ok: true });
});
router.delete('/menus/:id/draft', checkMenuId, (req, res) => {
  store.remove(draftPath(req), { silent: true });
  res.json({ ok: true });
});

// Vista previa de cambios sin guardar: recibe el menú y devuelve el HTML de la
// carta (a 1080 lógico). No escribe nada.
router.post('/preview/menu/:id', checkMenuId, async (req, res, next) => {
  try {
    if (!req.body?.categories || !Array.isArray(req.body.columns)) return res.status(400).json({ error: 'Menú inválido' });
    const html = await renderCarta(req.params.id, { baseRes: true, menuOverride: req.body });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

const promosRes = jsonResource(() => 'data/promos.json', (req) =>
  !Array.isArray(req.body?.promos) ? 'promos.json debe tener "promos" (array)' : null
);
// Igual que las cartas: GET trae el borrador; PUT = "Aplicar" (publica y borra
// el borrador); el borrador se escribe en silencio y no refresca pantallas.
const PROMOS_DRAFT = 'data/drafts/promos.json';
router.get('/promos', (req, res) => {
  res.json({ version: store.version(), data: store.get('data/promos.json'), draft: store.getSafe(PROMOS_DRAFT, null) });
});
router.put('/promos', (req, res) => {
  store.remove(PROMOS_DRAFT, { silent: true });
  promosRes.put(req, res);
});
router.put('/promos/draft', (req, res) => {
  if (!Array.isArray(req.body?.promos)) return res.status(400).json({ error: 'promos.json debe tener "promos" (array)' });
  store.put(PROMOS_DRAFT, req.body, { silent: true });
  res.json({ ok: true });
});
router.delete('/promos/draft', (req, res) => {
  store.remove(PROMOS_DRAFT, { silent: true });
  res.json({ ok: true });
});
// Vista previa del carrusel con promos sin guardar (no escribe nada).
router.post('/preview/promos-carta/:cartaId', async (req, res, next) => {
  try {
    if (!['promociones', 'promociones-horizontal'].includes(req.params.cartaId)) return res.status(404).json({ error: 'Carta desconocida' });
    if (!Array.isArray(req.body?.promos) || !req.body.rotation) return res.status(400).json({ error: 'Promos inválidas' });
    res.type('html').send(await renderCarta(req.params.cartaId, { promosOverride: req.body }));
  } catch (err) {
    next(err);
  }
});

function checkCartaId(req, res, next) {
  if (!cartaIds().includes(req.params.cartaId)) return res.status(404).json({ error: 'Carta desconocida' });
  next();
}
router.get('/layouts/:cartaId', checkCartaId, (req, res) => {
  const layouts = store.get('data/layouts.json');
  res.json({ version: store.version(), data: layouts[req.params.cartaId] || { zones: {} } });
});
router.put('/layouts/:cartaId', checkCartaId, (req, res) => {
  const ifMatch = Number(req.get('If-Match'));
  if (ifMatch && ifMatch !== store.version()) {
    return res.status(409).json({ error: 'Conflicto: alguien más guardó cambios', version: store.version() });
  }
  const layouts = store.get('data/layouts.json');
  layouts[req.params.cartaId] = req.body;
  const version = store.put('data/layouts.json', layouts);
  res.json({ ok: true, version });
});

// Dry-run del promo engine para el preview del panel: ?at=ISO&temp=N&sucursal=
router.get('/preview/promos', async (req, res, next) => {
  try {
    const now = req.query.at ? new Date(req.query.at) : new Date();
    if (isNaN(now)) return res.status(400).json({ error: 'Parámetro "at" inválido' });
    let weather = await getWeather(req.query.sucursal || null);
    if (req.query.temp !== undefined) weather = { tempC: Number(req.query.temp), source: 'preview' };
    const comida = await getComida();
    res.json(selectSlides(now, weather, comida, req.query.sucursal || null));
  } catch (err) {
    next(err);
  }
});

// Iconos para los pickers del panel: originales (PNG), librería incluida
// (SVG, ids "lib:…") y los subidos a la biblioteca (su URL es el valor).
router.get('/icons', (req, res) => {
  const icons = fs
    .readdirSync(ICONS_DIR)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.replace(/\.png$/, ''))
    .sort();
  res.json({ icons, library: libraryIcons(), uploaded: theme.library().icons });
});

router.get('/weather', async (req, res, next) => {
  try {
    res.json(await getWeather(req.query.sucursal || null));
  } catch (err) {
    next(err);
  }
});

// Subida de imágenes (promos / strip de fotos). Body binario crudo + query name.
const UPLOADS = path.join(__dirname, '..', '..', 'public', 'uploads');
const IMG_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/avif': '.avif' };
router.post(
  '/uploads',
  express.raw({ type: Object.keys(IMG_TYPES), limit: '25mb' }), // fotos 4K
  (req, res) => {
    const ext = IMG_TYPES[req.get('content-type')];
    if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) {
      return res.status(400).json({ error: 'Envía el binario de una imagen (png/jpeg/webp/avif)' });
    }
    const name = crypto.randomBytes(8).toString('hex') + ext;
    fs.writeFileSync(path.join(UPLOADS, name), req.body);
    res.json({ ok: true, url: `/uploads/${name}` });
  }
);

// ── Plantillas / tema ───────────────────────────────────────────────────────
// Catálogo de plantillas, tipografías y fondos incluidos + biblioteca subida.
router.get('/theme/catalog', (req, res) => {
  res.json({ version: store.version(), ...theme.catalog() });
});

// Biblioteca reutilizable entre cartas: tipografías, fondos y logos propios.
// Body binario crudo; el nombre original viaja en ?name= (los navegadores no
// mandan un content-type confiable para fuentes).
const LIB_KINDS = {
  fonts: { key: 'fonts', exts: ['.woff2', '.woff', '.ttf', '.otf'], limit: '6mb' },
  backgrounds: { key: 'backgrounds', exts: ['.png', '.jpg', '.jpeg', '.webp', '.avif'], limit: '12mb' },
  logos: { key: 'logos', exts: ['.png', '.svg', '.webp', '.jpg', '.jpeg'], limit: '6mb' },
  icons: { key: 'icons', exts: ['.png', '.svg', '.webp', '.jpg', '.jpeg'], limit: '2mb' },
};
router.post('/library/:kind', express.raw({ type: () => true, limit: '25mb' }), (req, res) => {
  const kind = LIB_KINDS[req.params.kind];
  if (!kind) return res.status(404).json({ error: 'Tipo de biblioteca desconocido' });
  const original = String(req.query.name || '');
  const ext = path.extname(original).toLowerCase();
  if (!kind.exts.includes(ext)) {
    return res.status(400).json({ error: `Formato no permitido. Usa: ${kind.exts.join(', ')}` });
  }
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Archivo vacío' });
  const id = crypto.randomBytes(6).toString('hex');
  const file = `${kind.key}-${id}${ext}`;
  fs.writeFileSync(path.join(UPLOADS, file), req.body);
  const lib = structuredClone(store.getSafe('data/library.json', {}) || {});
  const entry = { id, name: path.basename(original, ext).slice(0, 60) || id, url: `/uploads/${file}` };
  lib[kind.key] = [...(lib[kind.key] || []), entry];
  const version = store.put('data/library.json', lib);
  res.json({ ok: true, entry, version });
});
router.delete('/library/:kind/:id', (req, res) => {
  const kind = LIB_KINDS[req.params.kind];
  if (!kind) return res.status(404).json({ error: 'Tipo de biblioteca desconocido' });
  const lib = structuredClone(store.getSafe('data/library.json', {}) || {});
  const entry = (lib[kind.key] || []).find((x) => x.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'No existe' });
  lib[kind.key] = lib[kind.key].filter((x) => x.id !== entry.id);
  fs.rmSync(path.join(UPLOADS, path.basename(entry.url)), { force: true });
  const version = store.put('data/library.json', lib);
  res.json({ ok: true, version });
});

// ── Paquetes HTML de promociones ────────────────────────────────────────────
// POST con el .zip (o .html) crudo; ?name=archivo.zip y ?replace=<id> para
// actualizar un paquete sin perder los valores de las promos que lo usan.
router.get('/promo-packages', (req, res) => {
  res.json({ version: store.version(), packages: promoPackages.list() });
});
router.post('/promo-packages', express.raw({ type: () => true, limit: '60mb' }), (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Archivo vacío' });
  const filename = String(req.query.name || 'promo.zip');
  if (!/\.(zip|html?)$/i.test(filename)) return res.status(400).json({ error: 'Sube un .zip o un .html' });
  try {
    const pkg = promoPackages.install(req.body, { filename, replaceId: req.query.replace || null });
    res.json({ ok: true, package: pkg, version: store.version() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Resolución de diseño de un paquete subido: { width, height }.
router.put('/promo-packages/:id', (req, res) => {
  let pkg;
  try {
    pkg = promoPackages.setSize(req.params.id, Number(req.body?.width), Number(req.body?.height));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!pkg) return res.status(404).json({ error: 'Paquete desconocido (los diseños incluidos no se editan)' });
  res.json({ ok: true, package: pkg, version: store.version() });
});
router.delete('/promo-packages/:id', (req, res) => {
  if (!promoPackages.remove(req.params.id)) return res.status(404).json({ error: 'Paquete desconocido' });
  res.json({ ok: true, version: store.version() });
});

module.exports = router;
