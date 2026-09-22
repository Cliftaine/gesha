// render.js — renderiza una carta a HTML: junta datos (menú o promos),
// overrides de layout y el template EJS correspondiente.
const path = require('path');
const ejs = require('ejs');
const store = require('./store');
const { getWeather } = require('./weather');
const { getComida } = require('./comida');
const { selectSlides } = require('./promo-engine');
const { themeFor } = require('./theme');
const { iconSrc } = require('./icons');

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

// Promociones es una carta virtual con dos orientaciones (mismos datos).
const PROMO_CARTAS = { promociones: { w: 1080, h: 1920 }, 'promociones-horizontal': { w: 1920, h: 1080 } };

function cartaIds() {
  return [...menuIds(), ...Object.keys(PROMO_CARTAS)];
}

// Dimensiones del canvas de una carta. Los menús pueden ser horizontales y/o
// 4K (menu.resolution === '4k' ⇒ mismo diseño con zoom 2: 2160×3840 reales).
function canvasFor(cartaId) {
  if (PROMO_CARTAS[cartaId]) return PROMO_CARTAS[cartaId];
  const menu = store.getSafe(`data/menus/${cartaId}.json`);
  const base = menu && menu.canvas === 'horizontal' ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };
  return menu && menu.resolution === '4k' ? { w: base.w * 2, h: base.h * 2 } : base;
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

// baseRes: render a 1080 lógico aunque la carta sea 4K (previews/editor del panel).
async function renderCarta(cartaId, { now = new Date(), sucursal = null, tempOverride = null, editMode = false, baseRes = false, menuOverride = null, promosOverride = null } = {}) {
  const overrides = layoutStyles(cartaId);

  if (PROMO_CARTAS[cartaId]) {
    const stage = PROMO_CARTAS[cartaId];
    // La vista previa del panel no usa clima ni comida del día: no se consultan.
    let weather = promosOverride ? null : await getWeather(sucursal);
    if (typeof tempOverride === 'number' && !isNaN(tempOverride)) {
      weather = { tempC: tempOverride, source: 'query-override' };
    }
    const comida = promosOverride ? null : await getComida();
    const { slides, rotation } = selectSlides(now, weather, comida, sucursal, stage.w > stage.h ? 'horizontal' : 'vertical', { cfg: promosOverride });
    return ejs.renderFile(path.join(VIEWS, 'cartas', 'promociones.ejs'), {
      slides,
      rotation,
      stage,
      overrides,
      editMode,
      version: store.version(),
    });
  }

  // Menús (alimentos / bebidas) — un solo template normalizado.
  // `menu` inyectado = vista previa del editor (cambios aún sin guardar).
  const menu = menuOverride || store.get(`data/menus/${cartaId}.json`);
  let guisadoHoy = null;
  if (menu.featured?.liveGuisado) {
    const comida = await getComida();
    guisadoHoy = comida?.today?.guisado || null;
  }
  const html = await ejs.renderFile(path.join(VIEWS, 'cartas', 'menu.ejs'), {
    menu,
    guisadoHoy,
    overrides,
    editMode,
    iconSrc,
    zoom4k: menu.resolution === '4k' && !baseRes,
  });
  // Plantilla/tema: post-proceso del HTML (null ⇒ clásica intacta).
  const theme = themeFor(menu);
  return theme ? theme.transform(html) : html;
}

module.exports = { renderCarta, menuIds, cartaIds, canvasFor };
