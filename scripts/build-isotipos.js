// build-isotipos.js — procesa los isotipos SVG de la raíz:
//   1. Quita el rect de fondo (transparencia) → assets/isotipos/manta-XX.svg
//   2. Genera la versión "viva" → manta-XX-live.svg: deformación orgánica
//      periódica (feTurbulence + feDisplacementMap animados con SMIL, que
//      corre incluso dentro de <img>) + un balanceo sutil. La manta "nada"
//      cada cierto tiempo y luego descansa.
// Correr tras cambiar los SVGs fuente: node scripts/build-isotipos.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'assets', 'isotipos');

const SOURCES = {
  '02': 'Isotipo_Manta_Café_(RGB)-02.svg',
  '03': 'Isotipo_Manta_Café_(RGB)-03.svg',
  '04': 'Isotipo_Manta_Café_(RGB)-04.svg',
  'mesa1': 'Isotipo_Manta_Café_(RGB)_Mesa de trabajo 1.svg',
};

// Pulso de nado: reposo (~40% del ciclo) → ondulación → reposo.
const LIVE_DEFS = `<defs><filter id="fxswim" x="-15%" y="-15%" width="130%" height="130%">
<feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="n">
<animate attributeName="baseFrequency" dur="11s" values="0.012 0.018;0.017 0.023;0.012 0.018" repeatCount="indefinite"/>
</feTurbulence>
<feDisplacementMap in="SourceGraphic" in2="n" xChannelSelector="R" yChannelSelector="G" scale="0">
<animate attributeName="scale" dur="8s" values="0;0;16;8;22;4;0;0" keyTimes="0;0.22;0.36;0.5;0.62;0.76;0.88;1" repeatCount="indefinite"/>
</feDisplacementMap>
</filter></defs>`;

const LIVE_OPEN = `<g filter="url(#fxswim)">
<animateTransform attributeName="transform" type="rotate" values="0 300 300;1.8 300 300;0 300 300;-1.6 300 300;0 300 300" dur="12s" repeatCount="indefinite" additive="sum"/>
<g>
<animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0;0 5;0 0" dur="9s" repeatCount="indefinite" additive="sum"/>`;

const LIVE_CLOSE = '</g></g>';

fs.mkdirSync(OUT, { recursive: true });

for (const [id, file] of Object.entries(SOURCES)) {
  const src = path.join(ROOT, file);
  if (!fs.existsSync(src)) {
    console.warn(`⚠ no existe ${file}, lo salto`);
    continue;
  }
  let svg = fs.readFileSync(src, 'utf8');

  // Fondo: rect que cubre todo el lienzo (600.07 ancho) → fuera.
  svg = svg.replace(/<rect[^>]*width="600\.0?7?"[^>]*\/>/g, '');

  // El isotipo ocupa ~x:190-410 y:182-418 del lienzo 600×600 (medido con
  // getBBox). Recortamos el viewBox para que <img height=126> muestre la
  // manta al mismo tamaño visual que el PNG recortado original.
  svg = svg.replace(/viewBox="0 0 600 600"/, 'viewBox="183 174 234 252"');

  // Estático limpio.
  fs.writeFileSync(path.join(OUT, `manta-${id}.svg`), svg);

  // Vivo: defs de filtro tras </style> y contenido envuelto en los grupos animados.
  const styleEnd = svg.indexOf('</style>');
  const bodyStart = styleEnd >= 0 ? styleEnd + '</style>'.length : svg.indexOf('>', svg.indexOf('<svg')) + 1;
  const svgClose = svg.lastIndexOf('</svg>');
  const live =
    svg.slice(0, bodyStart) +
    LIVE_DEFS + LIVE_OPEN +
    svg.slice(bodyStart, svgClose) +
    LIVE_CLOSE +
    svg.slice(svgClose);
  fs.writeFileSync(path.join(OUT, `manta-${id}-live.svg`), live);
  console.log(`✓ manta-${id}.svg + manta-${id}-live.svg`);
}
