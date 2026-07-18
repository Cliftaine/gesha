// weather/index.js — cadena de resolución del clima:
//   override manual (panel) → Open-Meteo live → último valor cacheado → mock.
const store = require('../store');
const openMeteo = require('./open-meteo');
const mock = require('./mock');

async function getWeather(sucursal = null) {
  const settings = store.get('config/settings.json');
  const w = settings.weather;

  if (typeof w.override === 'number') {
    return { tempC: w.override, source: 'override' };
  }

  const loc = (sucursal && w.locations?.[sucursal]) || Object.values(w.locations || {})[0];
  if (w.openMeteo?.enabled && loc) {
    try {
      return await openMeteo.fetchTemp(loc.lat, loc.lon, w.openMeteo.cacheMinutes || 30);
    } catch {
      const stale = openMeteo.lastKnown(loc.lat, loc.lon);
      if (stale) return stale;
    }
  }

  return mock(settings);
}

module.exports = { getWeather };
