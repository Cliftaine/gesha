// build-temporada.js — genera las ilustraciones SVG de las plantillas festivas
// en public/assets/temporada/ (papel picado, calaverita de azúcar, pan de
// muerto, cempasúchil, pétalos y confeti). Correr con `npm run temporada`.
// La bandera (bandera-mx.svg) NO se genera: es el SVG oficial de dominio
// público de Wikimedia Commons (File:Flag_of_Mexico.svg), con su escudo real.
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'assets', 'temporada');
fs.mkdirSync(OUT, { recursive: true });

const svg = (w, h, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>${body}</svg>\n`;
const write = (name, content) => fs.writeFileSync(path.join(OUT, name), content);

// Generador pseudoaleatorio con semilla: los SVG salen idénticos en cada build.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

// ── Cempasúchil ─────────────────────────────────────────────────────────────
// Flor de muchas capas de pétalos rizados, del naranja profundo al amarillo.
function petalRing(n, len, width, fill, stroke, rot = 0) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (360 / n) * i;
    out += `<path transform="rotate(${a.toFixed(1)})" d="M0,0 C${-width},${-len * 0.3} ${-width * 1.15},${-len * 0.8} ${-width * 0.45},${-len} Q0,${-len * 0.9} ${width * 0.45},${-len} C${width * 1.15},${-len * 0.8} ${width},${-len * 0.3} 0,0Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`;
  }
  return out;
}
function cempasuchil() {
  return `<g transform="translate(100 100)">
${petalRing(18, 92, 20, '#e8790c', '#b85a05')}
${petalRing(16, 76, 19, '#f59a1b', '#c46a08', 11)}
${petalRing(14, 60, 17, '#f9ae2c', '#cf7c10', 4)}
${petalRing(12, 44, 15, '#fbc246', '#d88a16', 17)}
${petalRing(9, 28, 12, '#fdd368', '#dc9620', 8)}
<circle r="9" fill="#e8790c" stroke="#b85a05" stroke-width="1.5"/>
</g>`;
}
write('cempasuchil.svg', svg(200, 200, cempasuchil()));

// ── Calaverita de azúcar ────────────────────────────────────────────────────
// Cráneo con anatomía real (bóveda, pómulos, cavidad nasal, dentadura) y
// volumen por degradados; la decoración imita glasé real: cordones finos y
// perlitas con brillo, no formas planas de caricatura.
const C = { ink: '#2a1233', pink: '#d63a82', teal: '#2aa596', yellow: '#eec643', orange: '#ef8f17', purple: '#7d4fc0' };
const GLAZE = Object.entries(C).filter(([k]) => k !== 'ink');
function pearl(cx, cy, r, color) {
  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="url(#g-${color})"/>`;
}
// keep(x, y): permite omitir perlitas (p. ej. donde dos coronas se encimarían).
function pearlRing(cx, cy, rx, ry, n, r, color, start = 0, keep = () => true) {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = start + (Math.PI * 2 * i) / n;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (keep(x, y)) out += pearl(x, y, r, color);
  }
  return out;
}
function calaverita() {
  const glazeDefs = GLAZE.map(([k, c]) => `<radialGradient id="g-${k}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity=".85"/></radialGradient>`).join('');
  // Dentadura: piezas individuales siguiendo el arco del maxilar y la mandíbula.
  let teeth = '';
  const upper = [[-46, 9, 15], [-35, 10, 18], [-23.5, 11, 20], [-11.5, 12, 22], [0.5, 12, 22], [12.5, 11, 20], [23.5, 10, 18], [33.5, 9, 15]];
  for (const [x, w, h] of upper) teeth += `<rect x="${(126 + x).toFixed(1)}" y="${(214 - (22 - h) * 0.2).toFixed(1)}" width="${w}" height="${h}" rx="4" fill="url(#diente)" stroke="#9c8f7a" stroke-width="1"/>`;
  const lower = [[-40, 9, 14], [-29.5, 10, 16], [-18, 10.5, 18], [-6, 11, 19], [6.5, 10.5, 18], [18, 10, 16], [29, 9, 14]];
  for (const [x, w, h] of lower) teeth += `<rect x="${(126 + x).toFixed(1)}" y="${(239 + (19 - h) * 0.4).toFixed(1)}" width="${w}" height="${h}" rx="4" fill="url(#diente)" stroke="#9c8f7a" stroke-width="1"/>`;
  return `<defs>
${glazeDefs}
<radialGradient id="hueso" cx="50%" cy="34%" r="70%"><stop offset="0" stop-color="#fffdf6"/><stop offset=".6" stop-color="#f3ead6"/><stop offset="1" stop-color="#cdbf9f"/></radialGradient>
<radialGradient id="cuenca" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#05020a"/><stop offset=".75" stop-color="#1c0f26"/><stop offset="1" stop-color="#3a2a44"/></radialGradient>
<linearGradient id="diente" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffef8"/><stop offset="1" stop-color="#ddd2b8"/></linearGradient>
<filter id="azucar" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="4" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 -.18" result="g"/><feComposite in="g" in2="SourceAlpha" operator="in" result="gi"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge></filter>
<filter id="suave"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="sombra" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".45"/></filter>
</defs>
<g filter="url(#sombra)">
<!-- bóveda + pómulos + maxilar -->
<path filter="url(#azucar)" d="M126 10 C62 10 22 56 22 116 C22 146 30 168 44 184 C40 196 44 208 56 212 C62 214 66 220 68 228 L70 250 C72 270 96 282 126 282 C156 282 180 270 182 250 L184 228 C186 220 190 214 196 212 C208 208 212 196 208 184 C222 168 230 146 230 116 C230 56 190 10 126 10Z" fill="url(#hueso)" stroke="#a89878" stroke-width="2"/>
<!-- volumen: sienes, bajo pómulos y mentón -->
<g filter="url(#suave)" opacity=".5">
<ellipse cx="40" cy="128" rx="14" ry="40" fill="#8a7a5c"/><ellipse cx="212" cy="128" rx="14" ry="40" fill="#8a7a5c"/>
<ellipse cx="66" cy="204" rx="16" ry="10" fill="#7d6e52"/><ellipse cx="186" cy="204" rx="16" ry="10" fill="#7d6e52"/>
<ellipse cx="126" cy="276" rx="40" ry="8" fill="#8a7a5c"/>
</g>
<ellipse cx="104" cy="52" rx="46" ry="22" fill="#fff" opacity=".5" filter="url(#suave)"/>
<!-- cuencas: forma orbital real, no círculos -->
<path d="M50 128 C50 104 66 92 88 94 C108 96 116 110 114 130 C112 150 98 160 80 158 C62 156 50 146 50 128Z" fill="url(#cuenca)"/>
<path d="M202 128 C202 104 186 92 164 94 C144 96 136 110 138 130 C140 150 154 160 172 158 C190 156 202 146 202 128Z" fill="url(#cuenca)"/>
<!-- cavidad nasal con tabique -->
<path d="M126 154 C118 166 108 182 110 192 C112 200 122 200 126 192 C130 200 140 200 142 192 C144 182 134 166 126 154Z" fill="url(#cuenca)"/>
<path d="M126 162 V194" stroke="#4a3a54" stroke-width="1.5" opacity=".7"/>
<!-- dentadura -->
<path d="M76 214 Q126 226 176 214 L174 256 Q126 268 78 256Z" fill="#1c0f26"/>
${teeth}
</g>
<!-- glasé: perlitas alrededor de las cuencas -->
${pearlRing(82, 126, 39, 39, 22, 4, 'pink', 0.1, (x) => x < 119)}
${pearlRing(170, 126, 39, 39, 22, 4, 'teal', 0.1, (x) => x > 133)}
${pearlRing(82, 126, 47, 47, 14, 2.4, 'yellow', 0.3, (x) => x < 112)}
${pearlRing(170, 126, 47, 47, 14, 2.4, 'yellow', 0.3, (x) => x > 140)}
<!-- frente: cempasúchil pequeño y roleos de cordón fino -->
<g transform="translate(126 52)">
${Array.from({ length: 14 }, (_, i) => `<ellipse transform="rotate(${i * 25.7})" cx="0" cy="-13" rx="4.6" ry="9" fill="url(#g-orange)"/>`).join('')}
${Array.from({ length: 9 }, (_, i) => `<ellipse transform="rotate(${i * 40 + 12})" cx="0" cy="-7" rx="3.6" ry="6" fill="url(#g-yellow)"/>`).join('')}
<circle r="4" fill="url(#g-orange)"/>
</g>
<g fill="none" stroke-linecap="round" stroke-width="2.6">
<path d="M100 56 C86 44 66 48 62 64 C60 74 70 80 76 72" stroke="${C.purple}"/>
<path d="M152 56 C166 44 186 48 190 64 C192 74 182 80 176 72" stroke="${C.purple}"/>
<path d="M104 74 C96 84 84 84 78 78" stroke="${C.teal}"/><path d="M148 74 C156 84 168 84 174 78" stroke="${C.teal}"/>
<path d="M112 86 Q126 78 140 86" stroke="${C.pink}"/>
<path d="M46 176 C52 170 60 172 60 180" stroke="${C.pink}"/><path d="M206 176 C200 170 192 172 192 180" stroke="${C.pink}"/>
<path d="M100 270 Q126 279 152 270" stroke="${C.teal}"/>
</g>
${[-24, -12, 0, 12, 24].map((x, i) => pearl(126 + x, 100 - Math.abs(x) * 0.12, 2.6, ['pink', 'yellow', 'teal', 'yellow', 'pink'][i])).join('')}
${[[52, 192, 'orange'], [200, 192, 'orange'], [92, 204, 'purple'], [160, 204, 'purple'], [126, 146, 'pink']].map(([x, y, c]) => pearl(x, y, 3.4, c)).join('')}`;
}
write('calaverita.svg', svg(252, 296, calaverita()));

// ── Pan de muerto ───────────────────────────────────────────────────────────
// Vista 3/4 desde arriba: bollo dorado con corteza texturizada, cuatro
// "huesitos" de nudillos que bajan desde la bolita central y azúcar encima.
function panDeMuerto() {
  const r = rng(7);
  let sugar = '';
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.6);
    const x = 150 + Math.cos(a) * d * 128;
    const y = 112 + Math.sin(a) * d * 84;
    const big = r() > 0.9;
    sugar += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(big ? 1.9 : 0.7 + r() * 0.8).toFixed(2)}" fill="#fff" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  }
  // Un huesito = cadena de nudillos que se achican y siguen la curva del bollo.
  const bone = (rot, squash) => {
    const knobs = [[30, 17, 14], [56, 15.5, 13.5], [80, 14, 12.5], [101, 12, 11]];
    let out = `<path d="M0 12 C-13 30 -13 84 -9 106 C-4 114 4 114 9 106 C13 84 13 30 0 12Z" fill="url(#masa)" opacity=".9"/>`;
    for (const [y, rx, ry] of knobs) out += `<ellipse cx="0" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#nudillo)" stroke="#8f5516" stroke-width="1.2" stroke-opacity=".55"/>`;
    return `<g transform="translate(150 96) scale(1 ${squash}) rotate(${rot})">${out}</g>`;
  };
  return `<defs>
<radialGradient id="masa" cx="46%" cy="30%" r="78%"><stop offset="0" stop-color="#f3c777"/><stop offset=".45" stop-color="#dc9a40"/><stop offset=".85" stop-color="#b06a1f"/><stop offset="1" stop-color="#8a4d12"/></radialGradient>
<radialGradient id="nudillo" cx="40%" cy="28%" r="80%"><stop offset="0" stop-color="#f8d590"/><stop offset=".55" stop-color="#e0a048"/><stop offset="1" stop-color="#b3701f"/></radialGradient>
<filter id="corteza" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="11" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 .35  0 0 0 0 .18  0 0 0 0 .02  0 0 0 .5 -.12" result="g"/><feComposite in="g" in2="SourceAlpha" operator="in" result="gi"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge></filter>
<filter id="difuso"><feGaussianBlur stdDeviation="7"/></filter>
<clipPath id="bollo"><path d="M14 124 C14 58 74 18 150 18 C226 18 286 58 286 124 C286 172 232 204 150 204 C68 204 14 172 14 124Z"/></clipPath>
</defs>
<ellipse cx="150" cy="200" rx="132" ry="18" fill="#000" opacity=".4" filter="url(#difuso)"/>
<g filter="url(#corteza)">
<path d="M14 124 C14 58 74 18 150 18 C226 18 286 58 286 124 C286 172 232 204 150 204 C68 204 14 172 14 124Z" fill="url(#masa)"/>
<g clip-path="url(#bollo)">
${bone(45, 0.8)}${bone(-45, 0.8)}${bone(135, 0.8)}${bone(-135, 0.8)}
</g>
<ellipse cx="150" cy="92" rx="25" ry="22" fill="url(#nudillo)" stroke="#8f5516" stroke-width="1.2" stroke-opacity=".55"/>
</g>
<g clip-path="url(#bollo)">
<ellipse cx="150" cy="196" rx="150" ry="34" fill="#5a2f08" opacity=".35" filter="url(#difuso)"/>
<ellipse cx="112" cy="58" rx="56" ry="20" fill="#fff" opacity=".28" filter="url(#difuso)"/>
${sugar}
</g>`;
}
write('pan-de-muerto.svg', svg(300, 224, panDeMuerto()));

// ── Papel picado ────────────────────────────────────────────────────────────
// Tira de banderines calados (los huecos dejan ver el fondo) colgados de un
// hilo. Cada banderín: cenefa de círculos, arcos, rombos, motivo central y
// fleco en picos. `motifs` alterna el motivo central.
const FLAG_W = 216, FLAG_H = 150;
const MOTIFS = {
  // Todo lo negro se recorta; lo blanco encima vuelve a ser papel.
  calavera: `<path d="M108 44 C84 44 70 60 70 80 C70 92 76 100 84 105 L84 116 C84 122 94 126 108 126 C122 126 132 122 132 116 L132 105 C140 100 146 92 146 80 C146 60 132 44 108 44Z" fill="#000"/>
<circle cx="94" cy="82" r="9" fill="#fff"/><circle cx="122" cy="82" r="9" fill="#fff"/>
<path d="M108 94 l-5 9 h10Z" fill="#fff"/>
<path d="M96 112 v8 M104 113 v9 M112 113 v9 M120 112 v8" stroke="#fff" stroke-width="3"/>`,
  flor: `<g transform="translate(108 84)">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse transform="rotate(${a})" cx="0" cy="-24" rx="9" ry="17" fill="#000"/>`).join('')}<circle r="9" fill="#000"/><circle r="4" fill="#fff"/></g>`,
  // campana/estrella: motivos patrios, disponibles para otros papeles picados.
  campana: `<path d="M108 46 C90 46 82 62 82 84 C82 98 78 106 70 112 L146 112 C138 106 134 98 134 84 C134 62 126 46 108 46Z" fill="#000"/>
<circle cx="108" cy="121" r="7" fill="#000"/><rect x="104" y="38" width="8" height="10" rx="3" fill="#000"/>
<path d="M90 96 H126" stroke="#fff" stroke-width="3"/>`,
  estrella: `<path d="M108 42 L118 72 L150 72 L124 91 L134 122 L108 103 L82 122 L92 91 L66 72 L98 72Z" fill="#000"/><circle cx="108" cy="86" r="7" fill="#fff"/>`,
  sol: `<g transform="translate(108 84)">${Array.from({ length: 12 }, (_, i) => `<path transform="rotate(${i * 30})" d="M-6 -22 L0 -42 L6 -22Z" fill="#000"/>`).join('')}<circle r="18" fill="#000"/><circle r="8" fill="#fff"/></g>`,
};
function flagMask(id, motif) {
  let holes = '';
  for (let x = 18; x <= FLAG_W - 18; x += 20) holes += `<circle cx="${x}" cy="22" r="5.5" fill="#000"/>`; // cenefa superior
  for (let x = 28; x <= FLAG_W - 28; x += 32) holes += `<path d="M${x - 10} 140 q10 -16 20 0Z" fill="#000"/>`; // arcos abajo
  for (const x of [26, FLAG_W - 26]) for (let y = 48; y <= 120; y += 24) holes += `<path d="M${x} ${y - 9} l7 9 l-7 9 l-7 -9Z" fill="#000"/>`; // rombos laterales
  for (const x of [50, FLAG_W - 50]) holes += `<circle cx="${x}" cy="48" r="5" fill="#000"/><circle cx="${x}" cy="120" r="5" fill="#000"/>`;
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${FLAG_W}" height="${FLAG_H + 20}"><rect width="${FLAG_W}" height="${FLAG_H + 20}" fill="#fff"/>${holes}${MOTIFS[motif]}</mask>`;
}
function flagShape() {
  // Rectángulo con fleco en picos.
  let d = `M6 8 H${FLAG_W - 6} V${FLAG_H}`;
  const teeth = 9, tw = (FLAG_W - 12) / teeth;
  for (let i = 0; i < teeth; i++) d += ` l${(-tw / 2).toFixed(2)} 16 l${(-tw / 2).toFixed(2)} -16`;
  return d + 'Z';
}
function papelPicado(colors, motifs, stroke = null) {
  const n = colors.length;
  let defs = '', flags = '';
  motifs.forEach((m, i) => { defs += flagMask(`m${i}`, m); });
  colors.forEach((c, i) => {
    const mi = i % motifs.length;
    // Leve caída alterna: se ve colgado, no impreso.
    const dy = i % 2 ? 5 : 0;
    flags += `<g transform="translate(${i * FLAG_W} ${dy})"><path d="${flagShape()}" fill="${c}" mask="url(#m${mi})"${stroke ? ` stroke="${stroke}" stroke-width="1.5"` : ''}/></g>`;
  });
  const w = FLAG_W * n;
  return svg(w, FLAG_H + 26, `<defs>${defs}</defs>
<path d="M0 9 ${colors.map((_, i) => `Q${i * FLAG_W + FLAG_W / 2} ${i % 2 ? 19 : 13} ${(i + 1) * FLAG_W} 9`).join(' ')}" fill="none" stroke="#f3e9d8" stroke-width="3" opacity=".85"/>
${flags}`);
}
write('papel-picado-muertos.svg', papelPicado(
  ['#e23d8a', '#f59a1b', '#31b7a5', '#f4d35e', '#8e5bd0'],
  ['calavera', 'flor', 'calavera', 'sol', 'calavera'],
));
// ── Pétalos de cempasúchil cayendo (mosaico) ────────────────────────────────
function petalos() {
  const r = rng(21);
  let out = '';
  for (let i = 0; i < 16; i++) {
    const x = r() * 400, y = r() * 600, rot = r() * 360, s = 0.7 + r() * 0.9;
    const fill = ['#f59a1b', '#f9ae2c', '#e8790c', '#fbc246'][i % 4];
    out += `<path transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${rot.toFixed(0)}) scale(${s.toFixed(2)})" d="M0 0 C-9 -8 -10 -24 -3 -32 Q0 -28 3 -32 C10 -24 9 -8 0 0Z" fill="${fill}" opacity="${(0.55 + r() * 0.4).toFixed(2)}"/>`;
  }
  return svg(400, 600, out);
}
write('petalos.svg', petalos());

// ── Confeti tricolor (mosaico) ──────────────────────────────────────────────
function confeti() {
  const r = rng(1810);
  const colors = ['#0f6b3f', '#b8262c', '#ffffff', '#1f8a54', '#d2383e', '#ffffff'];
  let out = '';
  for (let i = 0; i < 34; i++) {
    const x = r() * 400, y = r() * 600, rot = r() * 360;
    const c = colors[i % colors.length];
    const white = c === '#ffffff' ? ' stroke="rgba(90,80,60,.45)" stroke-width="1"' : '';
    const kind = i % 3;
    const shape = kind === 0
      ? `<rect x="-7" y="-4" width="14" height="8" rx="1.5" fill="${c}"${white}/>`
      : kind === 1
        ? `<circle r="5" fill="${c}"${white}/>`
        : `<path d="M-9 0 q4.5 -7 9 0 t9 0" fill="none" stroke="${c === '#ffffff' ? '#cfc7b4' : c}" stroke-width="3.2" stroke-linecap="round"/>`;
    out += `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) rotate(${rot.toFixed(0)})">${shape}</g>`;
  }
  return svg(400, 600, out);
}
write('confeti-mx.svg', confeti());

console.log('temporada →', fs.readdirSync(OUT).join(', '));
