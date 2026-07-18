// render.js — renderiza una carta a HTML: junta datos (menú o promos),
// overrides de layout y el template EJS correspondiente.
const path = require('path');
const ejs = require('ejs');
const store = require('./store');
const { getWeather } = require('./weather');
const { getComida } = require('./comida');
const { selectSlides } = require('./promo-engine');

const fs = require('fs');
const VIEWS = path.join(__dirname, '..', 'views');
const MENUS_DIR = path.join(__dirname, '..', '..', 'data', 'menus');

// Los menús son dinámicos: cada data/menus/*.json es una carta.
function menuIds() {
  return fs
    .readdirSync(MENUS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
}

function cartaIds() {
  return [...menuIds(), 'promociones'];
}

// Dimensiones del canvas de una carta (los menús pueden ser horizontales).
function canvasFor(cartaId) {
  if (cartaId !== 'promociones') {
    const menu = require('./store').getSafe(`data/menus/${cartaId}.json`);
    if (menu && menu.canvas === 'horizontal') return { w: 1920, h: 1080 };
  }
  return { w: 1080, h: 1920 };
}

// layouts.json → bloque <style> con los deltas de zonas del editor visual.
// Sin overrides ⇒ string vacío ⇒ render pixel-idéntico al baseline.
function layoutStyles(cartaId) {
  const layouts = store.getSafe('data/layouts.json', {});
  const zones = layouts[cartaId]?.zones || {};
  const rules = [];
  for (const [zone, z] of Object.entries(zones)) {
    const decl = [];
    if (z.hidden) decl.push('display:none');
    if (z.dx || z.dy) decl.push(`transform:translate(${z.dx || 0}px,${z.dy || 0}px)`);
    if (z.w != null) decl.push(`width:${z.w}px`);
    if (z.h != null) decl.push(`height:${z.h}px`);
    if (decl.length) rules.push(`[data-zone="${zone}"]{${decl.join(';')} !important}`);
  }
  return rules.length ? `<style data-layout-overrides>\n${rules.join('\n')}\n</style>` : '';
}

async function renderCarta(cartaId, { now = new Date(), sucursal = null, tempOverride = null, editMode = false } = {}) {
  const overrides = layoutStyles(cartaId);

  if (cartaId === 'promociones') {
    let weather = await getWeather(sucursal);
    if (typeof tempOverride === 'number' && !isNaN(tempOverride)) {
      weather = { tempC: tempOverride, source: 'query-override' };
    }
    const comida = await getComida();
    const { slides, rotation } = selectSlides(now, weather, comida, sucursal);
    return ejs.renderFile(path.join(VIEWS, 'cartas', 'promociones.ejs'), {
      slides,
      rotation,
      overrides,
      editMode,
    });
  }

  // Menús (alimentos / bebidas) — un solo template normalizado.
  const menu = store.get(`data/menus/${cartaId}.json`);
  let guisadoHoy = null;
  if (menu.featured?.liveGuisado) {
    const comida = await getComida();
    guisadoHoy = comida?.today?.guisado || null;
  }
  return ejs.renderFile(path.join(VIEWS, 'cartas', 'menu.ejs'), {
    menu,
    guisadoHoy,
    overrides,
    editMode,
  });
}

module.exports = { renderCarta, menuIds, cartaIds, canvasFor };
