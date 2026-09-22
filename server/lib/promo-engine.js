// promo-engine.js — decide qué slides muestra la carta de promociones:
// promos estáticas (con boost por clima) + slides dinámicos (horario estelar,
// comida del día de hoy/mañana, promo del día del servicio de comida).
const store = require('./store');
const { ruleMatches, dateWindowMatches, localParts } = require('./dispatch');
const promoPackages = require('./promo-packages');

// Imágenes por defecto para slides dinámicos (Unsplash, como los seeds actuales).
const DEFAULT_IMAGES = {
  desayunos: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=2160&q=80&auto=format&fit=crop',
  comida: 'https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=2160&q=80&auto=format&fit=crop',
  promoDelDia: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=2160&q=80&auto=format&fit=crop',
};

function weatherBoost(tags, tempC, wcfg) {
  if (!Array.isArray(tags) || typeof tempC !== 'number') return 0;
  if (tempC < wcfg.coldBelowC && tags.includes('hot')) return wcfg.boost;
  if (tempC > wcfg.hotAboveC && (tags.includes('cold') || tags.includes('ice'))) return wcfg.boost;
  return 0;
}

// Bucket de clima para theming de slides dinámicos.
function weatherBucket(tempC, wcfg) {
  if (typeof tempC !== 'number') return 'templado';
  if (tempC < wcfg.coldBelowC) return 'frio';
  if (tempC > wcfg.hotAboveC) return 'calor';
  return 'templado';
}

// Una promo guarda un diseño por orientación: `package` (vertical) y
// `packageH` (horizontal). Sin diseño para la orientación ⇒ slide estándar.
function packageFor(p, orientation) {
  const pkg = promoPackages.get(orientation === 'horizontal' ? p.packageH : p.package);
  return pkg && promoPackages.orientationOf(pkg) === orientation ? pkg : null;
}

function toSlide(p, score, orientation = 'vertical') {
  const pkg = packageFor(p, orientation);
  return {
    id: p.id,
    kicker: p.kicker || '',
    headline: p.headline || '',
    headlineSize: p.headlineSize || 168,
    subtitle: p.subtitle || '',
    description: p.description || '',
    footnote: p.footnote || '',
    image: p.image || DEFAULT_IMAGES.promoDelDia,
    // Logo propio de esta promo en el diseño estándar (si no, el isotipo general).
    logo: typeof p.logo === 'string' && /^(\/uploads\/|\/assets\/)[^"'<>\s]+$/.test(p.logo) ? p.logo : null,
    // Diseño propio: paquete HTML subido (ver promo-packages.js).
    package: pkg ? pkg.id : null,
    packageSize: pkg ? { w: pkg.width, h: pkg.height } : null,
    score,
  };
}

// selectSlides(now, weather, comida, sucursal) → slides ordenados por score.
// opts.cfg: promos sin guardar (vista previa del panel). En ese modo se muestran
// TODAS las promociones en el orden de la lista, sin mirar programación, para
// poder revisar cualquiera mientras se edita.
function selectSlides(now, weather, comida, sucursal = null, orientation = 'vertical', opts = {}) {
  const cfg = opts.cfg || store.get('data/promos.json');
  if (opts.cfg) {
    const list = cfg.promos.filter((p) => p.enabled);
    const slides = (list.length ? list : cfg.promos).map((p) => ({ ...toSlide(p, p.priority, orientation), previewValues: p.values || {} }));
    return { slides, rotation: cfg.rotation, weather: { bucket: 'templado' } };
  }
  const settings = store.get('config/settings.json');
  const { day, minutes } = localParts(now, settings.timezone);
  const wcfg = cfg.weather;
  // Clima apagado por ahora (gestión simple): sin boost por etiquetas ni textos
  // por temperatura, salvo que promos.json traiga weather.enabled === true.
  if (!wcfg.enabled) weather = null;
  const bucket = weatherBucket(weather?.tempC, wcfg);
  const candidates = [];

  // 1. Promos estáticas
  for (const p of cfg.promos) {
    if (!p.enabled) continue;
    if (Array.isArray(p.sucursales) && sucursal && !p.sucursales.includes(sucursal)) continue;
    const rules = p.rules || {};
    if (!dateWindowMatches(rules, now, settings.timezone)) continue;
    if (!ruleMatches(rules, day, minutes)) continue;
    candidates.push(toSlide(p, p.priority + weatherBoost(p.tags, weather?.tempC, wcfg), orientation));
  }

  // 2. Slides dinámicos (promociones automáticas). Apagados por ahora para una
  // gestión más simple: solo corren si promos.json trae "dynamicEnabled": true.
  // La configuración de cada uno se conserva en cfg.dynamic.
  const d = cfg.dynamicEnabled === true ? cfg.dynamic : {};
  const inWindow = (cfgSlide) => ruleMatches({ days: [], from: cfgSlide.from, to: cfgSlide.to }, day, minutes);

  if (d.desayunos?.enabled && inWindow(d.desayunos)) {
    candidates.push(toSlide({
      id: 'dyn-desayunos',
      kicker: d.desayunos.kicker || 'Horario estelar',
      headline: bucket === 'frio' ? 'Calientito' : 'Buenos días',
      headlineSize: 110,
      subtitle: d.desayunos.subtitle || 'Desayunos Manta',
      description: bucket === 'frio'
        ? 'Para el frío: hot cakes, chilaquiles y café recién hecho.'
        : 'Huevos al gusto, chilaquiles y pan dulce de la casa.',
      footnote: 'Todos los días hasta las 11:30',
      image: d.desayunos.image || DEFAULT_IMAGES.desayunos,
    }, d.desayunos.priority));
  }

  const menuAlimentos = store.getSafe('data/menus/alimentos.json');
  if (d.comidaHoy?.enabled && inWindow(d.comidaHoy) && comida?.today?.guisado) {
    candidates.push(toSlide({
      id: 'dyn-comida-hoy',
      kicker: d.comidaHoy.kicker || 'Comida del día',
      headline: '$' + (menuAlimentos?.featured?.price ?? 110),
      subtitle: comida.today.guisado,
      description: `Incluye ${comida.today.sopa.toLowerCase()}, guarnición, postre y agua.`,
      footnote: 'Hoy hasta agotar existencias',
      image: d.comidaHoy.image || DEFAULT_IMAGES.comida,
    }, d.comidaHoy.priority));
  }

  if (d.comidaManana?.enabled && inWindow(d.comidaManana) && comida?.tomorrow?.guisado) {
    candidates.push(toSlide({
      id: 'dyn-comida-manana',
      kicker: d.comidaManana.kicker || 'Mañana en Manta',
      headline: 'Mañana',
      headlineSize: 110,
      subtitle: comida.tomorrow.guisado,
      description: `Con ${comida.tomorrow.sopa.toLowerCase()} y ${comida.tomorrow.postre.toLowerCase()}. Te esperamos.`,
      footnote: 'Comida del día · $' + (menuAlimentos?.featured?.price ?? 110),
      image: d.comidaManana.image || DEFAULT_IMAGES.comida,
    }, d.comidaManana.priority));
  }

  if (d.promoDelDia?.enabled && comida?.promoDelDia) {
    const p = comida.promoDelDia;
    candidates.push(toSlide({
      id: 'dyn-promo-del-dia',
      kicker: 'Promo del día',
      headline: p.headline,
      subtitle: p.subtitle,
      description: p.description,
      footnote: 'Válido únicamente hoy',
      image: p.image || DEFAULT_IMAGES.promoDelDia,
    }, d.promoDelDia.priority + weatherBoost(p.tags, weather?.tempC, wcfg)));
  }

  // 3. Orden estable por score desc, cap. Fallback: nunca dejar la pantalla en blanco.
  candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  let slides = candidates.slice(0, cfg.rotation.maxSlides || 6);
  if (!slides.length) {
    slides = cfg.promos.filter((p) => p.enabled).map((p) => toSlide(p, p.priority, orientation));
  }
  return { slides, rotation: cfg.rotation, weather: { ...weather, bucket } };
}

module.exports = { selectSlides };
