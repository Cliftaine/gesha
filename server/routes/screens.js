// screens.js — rutas PÚBLICAS: player de pantalla, render de cartas,
// resolución de despacho y SSE para actualizaciones en vivo.
const express = require('express');
const path = require('path');
const store = require('../lib/store');
const { resolveCarta, getScreen } = require('../lib/dispatch');
const { renderCarta, cartaIds, canvasFor } = require('../lib/render');

// Rotación de la pantalla en grados (0/90/180/270). Compat con el formato
// viejo ('portrait'/'cw'/'ccw').
function rotationFor(screen) {
  if ([0, 90, 180, 270].includes(screen.rotation)) return screen.rotation;
  if (screen.orientation === 'cw') return 90;
  if (screen.orientation === 'ccw') return 270;
  return 0;
}

const router = express.Router();

const DEV = process.env.NODE_ENV !== 'production';

// Override de reloj solo en dev: ?now=2026-07-14T09:00
function nowFrom(req) {
  if (DEV && req.query.now) {
    const d = new Date(req.query.now);
    if (!isNaN(d)) return d;
  }
  return new Date();
}

// ── Cartas server-rendered (contenido del iframe del player) ─────────────
router.get('/carta/:cartaId', async (req, res, next) => {
  try {
    const { cartaId } = req.params;
    if (!cartaIds().includes(cartaId)) return res.status(404).send('Carta desconocida');
    const html = await renderCarta(cartaId, {
      now: nowFrom(req),
      sucursal: req.query.sucursal || null,
      tempOverride: DEV && req.query.temp !== undefined ? Number(req.query.temp) : null,
      editMode: req.query.edit === '1',
    });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

// ── Referencia de fidelidad: originales intactos + onion-skin ─────────────
router.use('/reference', express.static(path.join(__dirname, '..', '..', 'cartas-html')));

if (DEV) {
  router.get('/diff/:cartaId', (req, res) => {
    const { cartaId } = req.params;
    res.type('html').send(`<!doctype html><html><head><title>diff ${cartaId}</title>
<style>body{margin:0;background:#333}.wrap{position:relative;width:1080px;height:1920px;margin:0 auto}
iframe{position:absolute;inset:0;width:1080px;height:1920px;border:0}#b{opacity:.5}
.bar{position:fixed;top:8px;left:8px;z-index:9;background:#000;color:#fff;padding:6px 10px;font:13px system-ui}</style></head>
<body><div class="bar">onion-skin: original vs template — <input type="range" min="0" max="1" step="0.05" value="0.5"
oninput="document.getElementById('b').style.opacity=this.value"></div>
<div class="wrap"><iframe id="a" src="/reference/carta-${cartaId}.html"></iframe>
<iframe id="b" src="/carta/${cartaId}"></iframe></div></body></html>`);
  });
}

// ── API pública de resolución ──────────────────────────────────────────────
// Incluye la orientación para que un cambio desde el panel se aplique en vivo.
router.get('/api/resolve/:sucursal/:pantalla', (req, res) => {
  const { sucursal, pantalla } = req.params;
  const resolved = resolveCarta(sucursal, pantalla, nowFrom(req));
  if (!resolved) return res.status(404).json({ error: 'Pantalla no encontrada' });
  const screen = getScreen(sucursal, pantalla);
  res.json({
    carta: resolved.carta,
    version: store.version(),
    rotation: rotationFor(screen),
    canvas: canvasFor(resolved.carta),
  });
});

// ── SSE: push en cambios de datos + tick por minuto (cruces de horario) ───
const sseClients = new Set(); // { res, sucursal, pantalla, lastCarta }

function pushClient(client) {
  const resolved = resolveCarta(client.sucursal, client.pantalla);
  if (!resolved) return;
  const screen = getScreen(client.sucursal, client.pantalla);
  const payload = {
    carta: resolved.carta,
    version: store.version(),
    rotation: screen ? rotationFor(screen) : 0,
    canvas: canvasFor(resolved.carta),
  };
  client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  client.lastCarta = resolved.carta;
}

store.onChange(() => {
  for (const client of sseClients) pushClient(client);
});

// Tick por minuto: solo empuja si la carta resuelta cambió (frontera de horario).
setInterval(() => {
  for (const client of sseClients) {
    const resolved = resolveCarta(client.sucursal, client.pantalla);
    if (resolved && resolved.carta !== client.lastCarta) pushClient(client);
  }
}, 30 * 1000).unref();

router.get('/events/:sucursal/:pantalla', (req, res) => {
  const { sucursal, pantalla } = req.params;
  if (!getScreen(sucursal, pantalla)) return res.status(404).end();
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  const client = { res, sucursal, pantalla, lastCarta: null };
  sseClients.add(client);
  pushClient(client); // estado inicial
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25 * 1000);
  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(client);
  });
});

// ── Índice: GET / → directorio de pantallas ───────────────────────────────
// Página simple para configurar TVs: entra a la raíz y toca tu pantalla.
function indexPage() {
  const cfg = store.get('config/dispatch.json');
  const links = [];
  for (const [sucId, suc] of Object.entries(cfg.sucursales)) {
    for (const [panId, screen] of Object.entries(suc.pantallas)) {
      links.push(
        `<a href="/${sucId}/${panId}"><strong>${suc.name || sucId} · ${screen.name || panId}</strong><span>/${sucId}/${panId}</span></a>`
      );
    }
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Manta Café — Pantallas</title>
<style>body{margin:0;background:#14120f;color:#F3EDE3;font:16px/1.5 system-ui,sans-serif;
display:flex;flex-direction:column;align-items:center;padding:48px 24px}
h1{font-weight:500;letter-spacing:.3em;text-transform:uppercase;font-size:18px;color:#986A4C}
a{display:flex;flex-direction:column;gap:2px;width:min(460px,100%);margin:8px 0;padding:18px 22px;
background:rgba(243,237,227,.06);border:1px solid rgba(243,237,227,.15);border-radius:12px;
color:#F3EDE3;text-decoration:none}
a:hover{background:rgba(243,237,227,.12)}
a span{color:rgba(243,237,227,.5);font-size:13px}
.panel{margin-top:28px;color:#986A4C}</style></head>
<body><h1>Manta Café · Pantallas</h1>${links.join('')}
<a class="panel" href="/panel"><strong>Panel de administración</strong><span>/panel</span></a>
</body></html>`;
}

router.get('/', (req, res) => {
  res.type('html').send(indexPage());
});

// ── Dispatcher: GET /:sucursal/:pantalla → shell del player ───────────────
// Va al final para no capturar /carta, /api, /events, etc.
router.get('/:sucursal/:pantalla', (req, res, next) => {
  const { sucursal, pantalla } = req.params;
  const screen = getScreen(sucursal, pantalla);
  if (!screen) return next(); // cae al 404 amigable con el directorio
  const settings = store.get('config/settings.json');
  res.render('player', {
    sucursal,
    pantalla,
    rotation: rotationFor(screen),
    pollSeconds: settings.player.pollSeconds,
    dailyReloadAt: settings.player.dailyReloadAt,
  });
});

// ── 404 amigable: cualquier ruta desconocida muestra el directorio ────────
router.use((req, res) => {
  res.status(404).type('html').send(indexPage());
});

module.exports = router;
