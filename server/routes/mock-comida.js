// mock-comida.js — servicio MOCKEADO de "comida del día", aislado en su propio
// router. El promo engine lo consume vía HTTP usando settings.comidaServiceUrl,
// así que conectar el servicio real después es solo cambiar esa URL.
const express = require('express');
const store = require('../lib/store');
const { localParts, DAY_KEYS } = require('../lib/dispatch');

const router = express.Router();

router.get('/comida', (req, res) => {
  const settings = store.get('config/settings.json');
  const semana = store.get('data/mock/comida-semana.json');
  const now = new Date();
  const { day } = localParts(now, settings.timezone);
  const tomorrow = DAY_KEYS[(DAY_KEYS.indexOf(day) + 1) % 7];
  res.json({
    today: { day, ...semana[day] },
    tomorrow: { day: tomorrow, ...semana[tomorrow] },
    promoDelDia: semana[day]?.promoDelDia || null,
  });
});

module.exports = router;
