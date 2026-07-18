// open-meteo.js — proveedor real de clima. Gratuito, sin API key.
// https://open-meteo.com — cache en memoria por coordenada.
const cache = new Map(); // "lat,lon" -> { tempC, at }

async function fetchTemp(lat, lon, cacheMinutes) {
  const key = `${lat},${lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < cacheMinutes * 60 * 1000) {
    return { tempC: hit.tempC, source: 'open-meteo (cache)' };
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('open-meteo HTTP ' + res.status);
    const json = await res.json();
    const tempC = json.current?.temperature_2m;
    if (typeof tempC !== 'number') throw new Error('open-meteo: payload inesperado');
    cache.set(key, { tempC, at: Date.now() });
    return { tempC, source: 'open-meteo' };
  } finally {
    clearTimeout(timer);
  }
}

// Último valor conocido aunque haya expirado — fallback ante fallos de red.
function lastKnown(lat, lon) {
  const hit = cache.get(`${lat},${lon}`);
  return hit ? { tempC: hit.tempC, source: 'open-meteo (stale)' } : null;
}

module.exports = { fetchTemp, lastKnown };
