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
const { CARTA_IDS } = require('../lib/render');

const router = express.Router();
router.use(express.json({ limit: '2mb' }));

const MENU_IDS = ['alimentos', 'bebidas'];

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
  if (!MENU_IDS.includes(req.params.id)) return res.status(404).json({ error: 'Menú desconocido' });
  next();
}
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
  if (!CARTA_IDS.includes(req.params.cartaId)) return res.status(404).json({ error: 'Carta desconocida' });
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
