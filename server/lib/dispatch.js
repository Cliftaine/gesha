// dispatch.js — resuelve qué carta corresponde a una pantalla en un instante dado.
// El matcher día/hora se reutiliza también en el promo engine.
const store = require('./store');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Convierte un Date a { day, minutes } en la timezone dada, sin dependencias.
function localParts(now, timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const day = parts.weekday.toLowerCase().slice(0, 3);
  // 'hour' puede ser "24" a medianoche con hourCycle h24 en algunos runtimes; normalizamos.
  const minutes = (parseInt(parts.hour, 10) % 24) * 60 + parseInt(parts.minute, 10);
  return { day, minutes };
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Regla { days, from, to } — rango [from, to); si from > to el rango cruza medianoche.
function ruleMatches(rule, day, minutes) {
  if (Array.isArray(rule.days) && rule.days.length && !rule.days.includes(day)) return false;
  if (!rule.from || !rule.to) return true; // sin ventana horaria = todo el día
  const from = toMinutes(rule.from);
  const to = toMinutes(rule.to);
  if (from <= to) return minutes >= from && minutes < to;
  return minutes >= from || minutes < to; // nocturno
}

// Ventana de fechas opcional { dateFrom, dateTo } (YYYY-MM-DD, inclusivo) — usada por promos.
function dateWindowMatches(rule, now, timezone) {
  if (!rule.dateFrom && !rule.dateTo) return true;
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); // YYYY-MM-DD
  const today = fmt.format(now);
  if (rule.dateFrom && today < rule.dateFrom) return false;
  if (rule.dateTo && today > rule.dateTo) return false;
  return true;
}

function getScreen(sucursal, pantalla) {
  const cfg = store.get('config/dispatch.json');
  return cfg.sucursales[sucursal]?.pantallas?.[pantalla] || null;
}

// → { carta } o null si la pantalla no existe. Primera regla que coincide gana.
function resolveCarta(sucursal, pantalla, now = new Date()) {
  const cfg = store.get('config/dispatch.json');
  const screen = getScreen(sucursal, pantalla);
  if (!screen) return null;
  const { day, minutes } = localParts(now, cfg.timezone);
  for (const rule of screen.schedule || []) {
    if (ruleMatches(rule, day, minutes)) return { carta: rule.carta };
  }
  return { carta: screen.default };
}

module.exports = { resolveCarta, getScreen, ruleMatches, dateWindowMatches, localParts, toMinutes, DAY_KEYS };
