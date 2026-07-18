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
const { menuIds, cartaIds } = require('../lib/render');

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
    return { id, title: m.title || id, canvas: m.canvas || 'vertical', dense: !!m.dense };
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
  if (id === 'promociones' || menuIds().includes(id)) {
    return res.status(409).json({ error: `Ya existe una carta "${id}"` });
  }
  const scaffold = {
    id,
    template: 'menu',
    title,
    dense: false,
    canvas: req.body?.canvas === 'horizontal' ? 'horizontal' : 'vertical',
    sizes: [],
    columns: [[], []],
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
  const version = store.remove(`data/menus/${req.params.id}.json`);
  res.json({ ok: true, version });
});

const menuRes = jsonResource((req) => `data/menus/${req.params.id}.json`, (req) =>
  !req.body?.categories ? 'el menú debe tener "categories"' : null
);
router.get('/menus/:id', checkMenuId, menuRes.get);
router.put('/menus/:id', checkMenuId, menuRes.put);

const promosRes = jsonResource(() => 'data/promos.json', (req) =>
  !Array.isArray(req.body?.promos) ? 'promos.json debe tener "promos" (array)' : null
);
router.get('/promos', promosRes.get);
router.put('/promos', promosRes.put);

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

// Lista de iconos disponibles (assets/icons/*.png) para los pickers del panel.
router.get('/icons', (req, res) => {
  const dir = path.join(__dirname, '..', '..', 'public', 'assets', 'icons');
  const icons = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => f.replace(/\.png$/, ''))
    .sort();
  res.json({ icons });
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
  express.raw({ type: Object.keys(IMG_TYPES), limit: '8mb' }),
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

module.exports = router;
