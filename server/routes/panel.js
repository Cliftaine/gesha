// panel.js — sirve el build de React (panel/dist). Se monta DETRÁS de
// authGate en index.js: los estáticos del panel también quedan gateados.
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const DIST = path.join(__dirname, '..', '..', 'panel', 'dist');

router.use(express.static(DIST));

// SPA fallback (rutas del router de React) + aviso si no hay build.
router.get('*', (req, res) => {
  const index = path.join(DIST, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res
    .status(503)
    .type('html')
    .send('<h1>Panel sin compilar</h1><p>Corre <code>npm run panel:build</code> (o <code>npm run panel:dev</code> en desarrollo).</p>');
});

module.exports = router;
