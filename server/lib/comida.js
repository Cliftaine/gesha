// comida.js — cliente del servicio de "comida del día" (hoy: el mock local).
// Se consume vía HTTP usando settings.comidaServiceUrl para que conectar el
// servicio real después sea solo cambiar esa URL. Cache 5 min; fallo → null.
const store = require('./store');

let cached = null; // { data, at }
const TTL = 5 * 60 * 1000;

async function getComida() {
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  const settings = store.get('config/settings.json');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(settings.comidaServiceUrl, { signal: ctrl.signal });
    if (!res.ok) throw new Error('comida HTTP ' + res.status);
    const data = await res.json();
    cached = { data, at: Date.now() };
    return data;
  } catch {
    return cached ? cached.data : null; // stale mejor que nada; null si nunca hubo
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { getComida, _clearCache: () => { cached = null; } };
