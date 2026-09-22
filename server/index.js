// index.js — wiring de la aplicación. AQUÍ vive el seam de autenticación:
// todo lo privado (/panel, /api de administración) se monta detrás de authGate.
const path = require('path');
const express = require('express');

const authGate = require('./lib/auth');
const screensRouter = require('./routes/screens');
const apiRouter = require('./routes/api');
const panelRouter = require('./routes/panel');
const mockComidaRouter = require('./routes/mock-comida');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

// Estáticos públicos (assets de cartas, uploads, player.js)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  // Los SVG subidos (logos/iconos) nunca ejecutan scripts si se abren directo.
  setHeaders: (res, file) => {
    if (file.endsWith('.svg') && file.includes(`${path.sep}uploads${path.sep}`)) {
      res.set('Content-Security-Policy', "script-src 'none'; sandbox");
    }
  },
}));

// ── Privado: UN solo punto de montaje por superficie ──────────────────────
app.use('/panel', authGate, panelRouter);
app.use('/api', authGate, apiRouter);

// ── Servicio mockeado de comida (aislado, swappable) ──────────────────────
app.use('/mock', mockComidaRouter);

// ── Público: pantallas, cartas, resolve, SSE ──────────────────────────────
app.use('/', screensRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Error interno');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`gesha corriendo en http://localhost:${PORT}`);
  console.log(`ej. pantalla: http://localhost:${PORT}/centro/pantalla_1`);
  console.log(`panel:        http://localhost:${PORT}/panel`);
});
