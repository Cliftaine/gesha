// theme.js — plantillas, tipografías y fondos de las cartas.
// Decisión: los partials EJS conservan sus literales verbatim. El tema se aplica
// como POST-PROCESO del HTML ya renderizado: los literales de color/tipografía
// del diseño original se cambian por variables CSS y se inyecta un <style> con
// los valores de la plantilla. Plantilla "clasica" sin tema ⇒ no se toca nada
// ⇒ el render sigue siendo byte-idéntico al original.
const store = require('./store');

// ── Tipografías incluidas (Google Fonts) ────────────────────────────────────
const FONTS = {
  cormorant: { label: 'Cormorant Garamond', stack: '"Cormorant Garamond", Georgia, serif', google: 'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500', role: 'display' },
  playfair: { label: 'Playfair Display', stack: '"Playfair Display", Georgia, serif', google: 'Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400', role: 'display' },
  fraunces: { label: 'Fraunces', stack: 'Fraunces, Georgia, serif', google: 'Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400', role: 'display' },
  'dm-serif': { label: 'DM Serif Display', stack: '"DM Serif Display", Georgia, serif', google: 'DM+Serif+Display:ital@0;1', role: 'display' },
  bebas: { label: 'Bebas Neue', stack: '"Bebas Neue", Impact, sans-serif', google: 'Bebas+Neue', role: 'display' },
  caveat: { label: 'Caveat (manuscrita)', stack: 'Caveat, cursive', google: 'Caveat:wght@400;500;600;700', role: 'display' },
  abril: { label: 'Abril Fatface', stack: '"Abril Fatface", Georgia, serif', google: 'Abril+Fatface', role: 'display' },
  lobster: { label: 'Lobster', stack: 'Lobster, cursive', google: 'Lobster', role: 'display' },
  mountains: { label: 'Mountains of Christmas', stack: '"Mountains of Christmas", Georgia, serif', google: 'Mountains+of+Christmas:wght@400;700', role: 'display' },
  creepster: { label: 'Creepster', stack: 'Creepster, Impact, fantasy', google: 'Creepster', role: 'display' },
  archivo: { label: 'Archivo', stack: 'Archivo, system-ui, sans-serif', google: 'Archivo:wght@400;500;600;700', role: 'body' },
  inter: { label: 'Inter', stack: 'Inter, system-ui, sans-serif', google: 'Inter:wght@400;500;600;700', role: 'body' },
  'work-sans': { label: 'Work Sans', stack: '"Work Sans", system-ui, sans-serif', google: 'Work+Sans:wght@400;500;600;700', role: 'body' },
  montserrat: { label: 'Montserrat', stack: 'Montserrat, system-ui, sans-serif', google: 'Montserrat:wght@400;500;600;700', role: 'body' },
  spectral: { label: 'Spectral', stack: 'Spectral, Georgia, serif', google: 'Spectral:ital,wght@0,400;0,500;0,600;1,400', role: 'body' },
};

// ── Fondos incluidos (valores CSS de `background`, sin archivos) ────────────
const BACKGROUNDS = {
  papel: { label: 'Papel (original)', css: 'rgb(244, 239, 230)' },
  lino: { label: 'Lino', css: 'repeating-linear-gradient(0deg, rgba(122,90,60,.035) 0 2px, transparent 2px 5px), repeating-linear-gradient(90deg, rgba(122,90,60,.035) 0 2px, transparent 2px 5px), rgb(240, 233, 221)' },
  blanco: { label: 'Blanco', css: '#fbfaf7' },
  kraft: { label: 'Kraft', css: 'radial-gradient(ellipse at 50% 30%, #dcc7a3 0%, #c9ae82 100%)' },
  pizarra: { label: 'Pizarra', css: 'radial-gradient(ellipse at 50% 20%, #33403b 0%, #1f2825 70%, #171d1b 100%)' },
  noche: { label: 'Noche', css: 'linear-gradient(180deg, #1c1a17 0%, #14120f 100%)' },
  niebla: { label: 'Niebla', css: 'linear-gradient(180deg, #f3f5f6 0%, #e6eaec 100%)' },
  pergamino: { label: 'Pergamino', css: 'radial-gradient(ellipse at 50% 35%, #f1e4c6 0%, #e2cfa3 70%, #d3bb86 100%)' },
  navidad: { label: 'Navidad', css: 'radial-gradient(circle, rgba(255,255,255,.5) 0 2px, transparent 3px) 0 0 / 90px 90px, radial-gradient(circle, rgba(255,255,255,.28) 0 3px, transparent 4px) 45px 50px / 130px 130px, radial-gradient(ellipse at 50% 20%, #1f4d38 0%, #123324 65%, #0c2419 100%)' },
  halloween: { label: 'Halloween', css: 'radial-gradient(circle at 87% 4.4%, #f6c667 0 54px, rgba(246,198,103,.18) 56px 84px, transparent 86px), linear-gradient(180deg, #24123a 0%, #150b22 60%, #0d0716 100%)' },
  muertos: { label: 'Día de Muertos', css: 'radial-gradient(circle, rgba(245,154,27,.16) 0 5px, transparent 6px) 0 0 / 70px 70px, radial-gradient(ellipse at 50% 15%, #3a1646 0%, #220c2c 60%, #15071c 100%)' },
  patrio: { label: 'Fiestas Patrias', css: 'linear-gradient(180deg, #fbf7ec 0%, #f4ecd8 100%)' },
  primavera: { label: 'Primavera', css: 'radial-gradient(circle, rgba(226,120,156,.22) 0 7px, transparent 8px) 0 0 / 110px 110px, radial-gradient(circle, rgba(122,170,96,.2) 0 5px, transparent 6px) 55px 60px / 110px 110px, linear-gradient(180deg, #fdf3f4 0%, #f3f7e8 100%)' },
  verano: { label: 'Verano', css: 'radial-gradient(circle at 88% 4.4%, #ffd25e 0 56px, rgba(255,210,94,.25) 58px 86px, transparent 88px), linear-gradient(180deg, #e2f6f5 0%, #fdf1d6 100%)' },
  otono: { label: 'Otoño', css: 'radial-gradient(ellipse at 50% 25%, #f8e6c8 0%, #efcf9d 70%, #e3b877 100%)' },
  amor: { label: 'Amor y amistad', css: 'radial-gradient(circle, rgba(194,47,74,.12) 0 6px, transparent 7px) 0 0 / 80px 80px, linear-gradient(180deg, #fdeef0 0%, #f9dfe3 100%)' },
  salvia: { label: 'Salvia', css: 'linear-gradient(180deg, #e6eadf 0%, #d9e0d0 100%)' },
};

// ── Plantillas ──────────────────────────────────────────────────────────────
// colors: ink (texto), accent (precios/líneas), muted, faint, rule, slot.
// css: ajustes estructurales sobre data-zones (sin tocar los partials).
// Piezas CSS compartidas por las plantillas.
// DARK: isotipos y logotipo en claro sobre fondos oscuros.
const DARK = `
.fx-accent::before{opacity:.22}
[data-zone="wordmark"] img{filter:brightness(0) invert(.9)}
[data-t^="mark"]:not([data-custom]){filter:brightness(0) invert(.9)}`;
// Guirnalda de ondas / papel picado / banda tricolor arriba del canvas.
const scallops = (colors, size = 56) => colors
  .map((c, i) => `radial-gradient(circle at 50% 0, ${c} 0 ${size * 0.46}px, transparent ${size * 0.46 + 1}px) ${i * size}px 0 / ${size * colors.length}px ${size * 0.6}px repeat-x`)
  .join(',');
const picado = (colors, size = 72) => colors
  .map((c, i) => `conic-gradient(from 135deg at 50% 0, ${c} 90deg, transparent 0) ${i * size}px 0 / ${size * colors.length}px ${size * 0.62}px repeat-x`)
  .join(',');
// Arte de temporada (scripts/build-temporada.js) colgado arriba del canvas:
// el encabezado baja para que el papel picado no tape isotipos ni título.
const ART = '/assets/temporada';
const HANGING = (file, tileWidth) => `
[data-t="canvas"]{isolation:isolate}
[data-t="canvas"]::before{content:'';position:absolute;left:0;right:0;top:0;height:150px;background:url(${ART}/${file}) center top / ${tileWidth}px auto repeat-x;z-index:3;pointer-events:none}
[data-zone="title"]{padding-top:160px !important}
[data-t^="mark"]{top:142px !important}
/* horizontal: menos alto disponible ⇒ papel picado más chico */
[data-t="canvas"][style*="width: 1920px"]::before{height:112px;background-size:${Math.round(tileWidth * 0.72)}px auto}
[data-t="canvas"][style*="width: 1920px"] [data-zone="title"]{padding-top:112px !important}
[data-t="canvas"][style*="width: 1920px"] [data-t^="mark"]{top:96px !important}`;
const topBand = (background, height) => `
[data-t="canvas"]::before{content:'';position:absolute;left:0;right:0;top:0;height:${height}px;background:${background};z-index:2;pointer-events:none}
[data-t="frame"]{display:none}`;

const TEMPLATES = {
  clasica: {
    label: 'Clásica',
    description: 'El diseño original de Manta: papel cálido, serif elegante.',
    colors: { ink: [42, 38, 32], accent: [122, 90, 60], muted: [126, 116, 104], faint: [171, 162, 148], rule: [154, 122, 85], slot: [239, 231, 217] },
    background: 'papel',
    fonts: { display: 'cormorant', body: 'archivo' },
    css: '',
  },
  pizarra: {
    label: 'Pizarra',
    description: 'Fondo oscuro tipo pizarrón, texto crema y acentos dorados.',
    colors: { ink: [240, 232, 218], accent: [214, 170, 102], muted: [176, 168, 152], faint: [140, 134, 122], rule: [214, 170, 102], slot: [44, 54, 50] },
    background: 'pizarra',
    fonts: { display: 'playfair', body: 'work-sans' },
    dark: true,
    css: `
.fx-accent::before{opacity:.22}
[data-zone="wordmark"] img{filter:brightness(0) invert(.9)}
[data-t^="mark"]:not([data-custom]){filter:brightness(0) invert(.9)}`,
  },
  editorial: {
    label: 'Editorial',
    description: 'Minimalista: blanco, tipografía fuerte, título alineado a la izquierda.',
    colors: { ink: [20, 20, 20], accent: [196, 62, 40], muted: [110, 110, 110], faint: [160, 160, 160], rule: [20, 20, 20], slot: [238, 238, 234] },
    background: 'blanco',
    fonts: { display: 'dm-serif', body: 'inter' },
    css: `
[data-t="frame"]{display:none}
[data-zone="title"] > div{text-align:left !important;padding-left:150px}
[data-t="mark-r"]{display:none}
[data-t="rule"]{height:4px !important;opacity:1 !important}
[data-zone^="cat-"],[data-zone^="mk-"]{border-radius:0 !important}
[data-zone="featured"] > div,[data-zone="extras"] > div{border-radius:0 !important}`,
  },
  bistro: {
    label: 'Bistró',
    description: 'Kraft y verde botella, doble marco y serif cálida.',
    colors: { ink: [38, 46, 38], accent: [44, 92, 66], muted: [86, 92, 80], faint: [120, 124, 110], rule: [44, 92, 66], slot: [214, 196, 160] },
    background: 'kraft',
    fonts: { display: 'fraunces', body: 'work-sans' },
    css: `
[data-t="frame"]{border-width:2px !important;border-color:rgba(44,92,66,.55) !important;outline:1px solid rgba(44,92,66,.35);outline-offset:-10px}
[data-t="rule"]{height:3px !important;opacity:.8 !important;border-radius:3px}`,
  },
  moderna: {
    label: 'Moderna',
    description: 'Limpia y geométrica: gris niebla, sans en todo y acento turquesa.',
    colors: { ink: [31, 41, 51], accent: [15, 118, 110], muted: [96, 108, 118], faint: [148, 158, 166], rule: [15, 118, 110], slot: [222, 228, 231] },
    background: 'niebla',
    fonts: { display: 'montserrat', body: 'montserrat' },
    css: `
[data-t="frame"]{display:none}
[data-t="rule"]{height:6px !important;opacity:1 !important;width:120px;margin-left:auto !important;margin-right:auto !important;border-radius:6px}
[data-zone^="cat-"],[data-zone^="mk-"]{border-radius:8px !important}`,
  },
  vintage: {
    label: 'Vintage',
    description: 'Pergamino envejecido, sepia y borgoña con doble filete clásico.',
    colors: { ink: [62, 42, 28], accent: [123, 45, 38], muted: [120, 98, 78], faint: [160, 140, 116], rule: [123, 45, 38], slot: [222, 205, 165] },
    background: 'pergamino',
    fonts: { display: 'playfair', body: 'spectral' },
    css: `
[data-t="frame"]{border:3px double rgba(123,45,38,.6) !important;inset:22px !important}
[data-t="rule"]{height:5px !important;opacity:.7 !important;background:transparent !important;border-top:2px solid rgb(123,45,38);border-bottom:1px solid rgb(123,45,38)}`,
  },
  nocturna: {
    label: 'Nocturna',
    description: 'Negro y dorado: elegante para bar, cenas y cartas de noche.',
    colors: { ink: [240, 234, 222], accent: [201, 162, 74], muted: [170, 162, 148], faint: [128, 122, 110], rule: [201, 162, 74], slot: [38, 35, 30] },
    background: 'noche',
    fonts: { display: 'cormorant', body: 'montserrat' },
    dark: true,
    css: DARK + `
[data-t="frame"]{border-color:rgba(201,162,74,.5) !important}`,
  },
  fresca: {
    label: 'Fresca',
    description: 'Verde salvia y terracota: ligera, natural, de brunch.',
    colors: { ink: [34, 56, 44], accent: [192, 98, 59], muted: [92, 110, 98], faint: [134, 150, 138], rule: [192, 98, 59], slot: [206, 216, 196] },
    background: 'salvia',
    fonts: { display: 'fraunces', body: 'inter' },
    css: `
[data-t="frame"]{border-radius:28px;border-color:rgba(34,56,44,.25) !important}
[data-t="rule"]{opacity:.9 !important;border-radius:3px;height:3px !important}`,
  },

  // ── Festivas / de temporada ───────────────────────────────────────────────
  navidad: {
    group: 'festiva', emoji: '🎄',
    label: 'Navidad',
    description: 'Verde pino con nieve, dorado y guirnalda roja. Posadas y diciembre.',
    colors: { ink: [246, 240, 226], accent: [226, 186, 96], muted: [190, 200, 186], faint: [140, 158, 144], rule: [190, 58, 48], slot: [28, 66, 48] },
    background: 'navidad',
    fonts: { display: 'playfair', body: 'work-sans' },
    roleFonts: { title: 'mountains' },
    dark: true,
    css: DARK + topBand(scallops(['#be3a30', '#e2ba60', '#f6f0e2']), 34) + `
[data-t="rule"]{opacity:.9 !important;height:3px !important}`,
  },
  halloween: {
    group: 'festiva', emoji: '🎃',
    label: 'Halloween',
    description: 'Noche morada con luna llena y naranja calabaza.',
    colors: { ink: [244, 236, 250], accent: [240, 138, 36], muted: [186, 170, 204], faint: [136, 120, 156], rule: [240, 138, 36], slot: [44, 26, 66] },
    background: 'halloween',
    fonts: { display: 'bebas', body: 'work-sans' },
    roleFonts: { title: 'creepster', note: 'work-sans' },
    dark: true,
    css: DARK + topBand(scallops(['#f08a24'], 64), 38) + `
[data-t="mark-r"]{display:none}
[data-t="rule"]{opacity:.9 !important;height:3px !important}`,
  },
  muertos: {
    group: 'festiva', emoji: '💀', particles: 'Pétalos cayendo',
    label: 'Día de Muertos',
    description: 'Papel picado, cempasúchil y morado de ofrenda.',
    colors: { ink: [252, 240, 222], accent: [245, 154, 27], muted: [214, 180, 210], faint: [160, 126, 160], rule: [226, 61, 138], slot: [56, 24, 66] },
    background: 'muertos',
    fonts: { display: 'abril', body: 'work-sans' },
    dark: true,
    // Ilustraciones en public/assets/temporada (npm run temporada): papel
    // picado calado con calaveras, pétalos de cempasúchil cayendo detrás del
    // contenido y, abajo, calaverita de azúcar, pan de muerto y cempasúchil.
    css: DARK + HANGING('papel-picado-muertos.svg', 864) + `
[data-t="frame"]{inset:0 !important;border:0 !important;z-index:-1;opacity:.2;background:url(${ART}/petalos.svg) 0 0 / 560px 840px;animation:fxCaer 46s linear infinite}
@keyframes fxCaer{to{background-position:0 840px}}
[data-t="canvas"]::after{content:'';position:absolute;left:0;right:0;bottom:8px;height:106px;z-index:3;pointer-events:none;background:
url(${ART}/calaverita.svg) 146px 100% / auto 104px no-repeat,
url(${ART}/cempasuchil.svg) 38px 100% / 100px no-repeat,
url(${ART}/cempasuchil.svg) 232px 100% / 62px no-repeat,
url(${ART}/pan-de-muerto.svg) calc(100% - 128px) 100% / auto 92px no-repeat,
url(${ART}/cempasuchil.svg) calc(100% - 40px) 100% / 94px no-repeat,
url(${ART}/cempasuchil.svg) calc(100% - 268px) 100% / 62px no-repeat}
[data-t="rule"]{opacity:1 !important;height:3px !important}`,
  },
  patrio: {
    group: 'festiva', emoji: '🇲🇽', particles: 'Confeti cayendo',
    label: 'Fiestas Patrias',
    description: 'Verde, blanco y rojo con dos banderas ondeando y confeti. Septiembre.',
    colors: { ink: [26, 60, 40], accent: [184, 38, 44], muted: [92, 108, 96], faint: [140, 152, 142], rule: [15, 107, 63], slot: [232, 224, 200] },
    background: 'patrio',
    fonts: { display: 'abril', body: 'archivo' },
    // Dos banderas oficiales ondeando a los lados del título (SVG de dominio
    // público, Wikimedia Commons) y confeti tricolor tenue detrás del contenido.
    css: `
[data-t="canvas"]{isolation:isolate}
[data-t="frame"]{inset:0 !important;border:0 !important;z-index:-1;opacity:.2;background:url(${ART}/confeti-mx.svg) 0 0 / 720px 1080px,url(${ART}/confeti-mx.svg) 300px 0 / 1040px 1560px;animation:fxConfeti 26s linear infinite}
@keyframes fxConfeti{to{background-position:0 1080px,300px 1560px}}
[data-t^="mark"]{display:none}
[data-zone="title"]::before,[data-zone="title"]::after{content:'';position:absolute;top:40px;width:204px;height:150px;background:linear-gradient(90deg,#d8b45c,#8a6a2a) 0 0 / 7px 100% no-repeat,url(${ART}/bandera-mx.svg) 7px 8px / 196px 112px no-repeat;transform-origin:0 30%;animation:fxBandera 5s ease-in-out infinite;filter:drop-shadow(0 6px 10px rgba(0,0,0,.2))}
[data-zone="title"]::before{left:54px}
[data-zone="title"]::after{right:54px;animation-delay:-2.2s}
@keyframes fxBandera{0%,100%{transform:perspective(700px) rotateY(0deg) skewY(0deg)}50%{transform:perspective(700px) rotateY(-16deg) skewY(-1.6deg)}}
[data-t="canvas"]::after{content:'';position:absolute;left:0;right:0;bottom:0;height:14px;background:linear-gradient(90deg,#0f6b3f 0 33.3%,#fff 33.3% 66.6%,#b8262c 66.6%);z-index:2}
[data-t="rule"]{opacity:1 !important;height:3px !important}`,
  },
  primavera: {
    group: 'festiva', emoji: '🌸',
    label: 'Primavera',
    description: 'Pasteles rosa y verde con pétalos. Marzo a mayo, Día de las Madres.',
    colors: { ink: [70, 52, 62], accent: [194, 86, 122], muted: [128, 108, 118], faint: [170, 152, 160], rule: [122, 170, 96], slot: [246, 226, 232] },
    background: 'primavera',
    fonts: { display: 'playfair', body: 'work-sans' },
    roleFonts: { title: 'lobster' },
    css: topBand(scallops(['#e2789c', '#f6c1d0', '#9cc47e'], 60), 36) + `
[data-t="rule"]{opacity:.9 !important;height:3px !important;border-radius:3px}`,
  },
  verano: {
    group: 'festiva', emoji: '☀️',
    label: 'Verano',
    description: 'Sol, turquesa y coral: bebidas frías y temporada de calor.',
    colors: { ink: [22, 60, 78], accent: [232, 98, 60], muted: [84, 118, 130], faint: [132, 160, 170], rule: [26, 160, 168], slot: [214, 238, 236] },
    background: 'verano',
    fonts: { display: 'bebas', body: 'work-sans' },
    roleFonts: { title: 'lobster', note: 'work-sans' },
    css: `
[data-t="frame"]{display:none}
[data-t="mark-r"]{display:none}
[data-t="canvas"]::after{content:'';position:absolute;left:0;right:0;bottom:0;height:30px;background:${scallops(['#1aa0a8', '#7fd3d2'], 70).replace(/at 50% 0/g, 'at 50% 100%').replace(/px 0 \//g, 'px 100% /')};z-index:2}
[data-t="rule"]{opacity:1 !important;height:4px !important;border-radius:4px}`,
  },
  otono: {
    group: 'festiva', emoji: '🍂',
    label: 'Otoño',
    description: 'Ocres y cobre tostado: pan de temporada, calabaza y canela.',
    colors: { ink: [66, 40, 22], accent: [180, 83, 31], muted: [124, 96, 70], faint: [166, 140, 112], rule: [143, 99, 38], slot: [232, 204, 156] },
    background: 'otono',
    fonts: { display: 'fraunces', body: 'work-sans' },
    css: topBand(scallops(['#b4531f', '#d99a3a', '#8f6326'], 60), 34) + `
[data-t="rule"]{opacity:.9 !important;height:3px !important}`,
  },
  amor: {
    group: 'festiva', emoji: '💝',
    label: 'Amor y amistad',
    description: 'Rosa y rojo para el 14 de febrero y fechas especiales.',
    colors: { ink: [84, 30, 44], accent: [194, 47, 74], muted: [140, 96, 108], faint: [184, 148, 156], rule: [194, 47, 74], slot: [248, 214, 220] },
    background: 'amor',
    fonts: { display: 'playfair', body: 'work-sans' },
    roleFonts: { title: 'lobster' },
    css: topBand(scallops(['#c22f4a', '#f2a1b0'], 56), 34) + `
[data-t="rule"]{opacity:.9 !important;height:3px !important;border-radius:3px}`,
  },
};

// ── Roles tipográficos ──────────────────────────────────────────────────────
// Cada rol agrupa textos de la carta y admite fuente, tamaño (%) y color
// propios en menu.theme.type[rol] = { font, size, color }. `match` reconoce el
// rol por la firma del style inline original (los partials no se tocan).
// family/color: de dónde sale el valor cuando no hay override.
const ROLES = {
  price: {
    label: 'Precios', hint: 'Precios de platillos, variantes y banners',
    family: 'display', color: 'accent',
    match: (st) => st.includes('tabular-nums'),
  },
  title: {
    label: 'Título de la carta', hint: 'El nombre grande de arriba',
    family: 'display', color: 'ink',
    match: (st) => st.includes('font-size: 96px'),
  },
  category: {
    label: 'Títulos de categoría', hint: 'Encabezados de categoría, marcadores y banners',
    family: 'body', color: 'ink',
    match: (st) => st.includes('letter-spacing: 0.13em') || st.includes('font-size: 62px') || st.includes('font-size: 46px')
      || (st.includes('font-weight: 600; font-size: 30px') && st.includes('line-height: 1;')),
  },
  item: {
    label: 'Platillos', hint: 'Nombre de cada platillo y de sus variantes',
    family: 'body', color: 'ink',
    match: (st) => st.includes('line-height: 1.12;') || st.includes('line-height: 1.15;'),
  },
  note: {
    label: 'Notas y descripciones', hint: 'Notas en cursiva, descripciones, sabores y pies de nota',
    family: 'display', color: 'muted',
    match: (st) => st.includes('font-style: italic') || st.includes('max-width: 92%') || st.includes('letter-spacing: 0.01em'),
  },
};
// El orden de evaluación importa (precio antes que categoría: comparten 30px).
const ROLE_ORDER = ['price', 'title', 'category', 'item', 'note'];
const FAMILY_LITERALS = ['&quot;Cormorant Garamond&quot;, Georgia, serif', 'Archivo, system-ui, sans-serif'];

// Overrides válidos de un rol (o null si no hay ninguno).
function roleOverride(theme, role) {
  const raw = theme.type && theme.type[role];
  if (!raw) return null;
  const size = Number(raw.size);
  const o = {
    font: typeof raw.font === 'string' && raw.font ? raw.font : null,
    scale: size && size !== 100 ? Math.min(200, Math.max(50, size)) / 100 : null,
    color: safeColor(raw.color),
  };
  return o.font || o.scale || o.color ? o : null;
}

function toHex(rgb) {
  return '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
}

// ── Distribuciones (layouts) ────────────────────────────────────────────────
// Reacomodan las piezas de la carta (título, columnas, banners, logotipo) solo
// con CSS sobre data-zone / data-t. 3 para vertical y 3 para horizontal;
// 'clasico' es el diseño original y no inyecta nada.
const LAYOUTS = {
  vertical: {
    clasico: { label: 'Clásico', description: 'Título arriba, columnas al centro y banners abajo.', css: '' },
    destacado: {
      label: 'Destacado arriba',
      description: 'El banner de Comida del día sube debajo del título; las columnas fluyen después.',
      css: `
[data-t="canvas"]{display:flex !important;flex-direction:column}
[data-zone="featured"]{position:relative !important;left:auto !important;right:auto !important;bottom:auto !important;margin:24px 64px 0;order:1}
[data-t="grid"]{order:2}`,
    },
    compacto: {
      label: 'Encabezado compacto',
      description: 'Título y logotipo más pequeños y banners pegados abajo: más alto útil para el contenido.',
      css: `
[data-zone="title"]{zoom:.62}
[data-t="rule"]{margin-top:12px !important}
[data-t="grid"]{padding-top:22px !important}
[data-zone="wordmark"]{bottom:34px !important}
[data-zone="wordmark"] img{height:40px !important}
[data-zone="featured"]{bottom:92px !important}
[data-zone="extras"]{bottom:88px !important}
[data-zone="image-strip"]{bottom:222px !important}`,
    },
  },
  horizontal: {
    clasico: { label: 'Clásico', description: 'Título arriba, columnas al centro y banners abajo.', css: '' },
    lateral: {
      label: 'Panel lateral',
      description: 'Panel a la izquierda con logo, título, Comida del día y logotipo; columnas a la derecha.',
      css: `
[data-zone="title"]{position:absolute !important;left:0;top:0;bottom:0;width:470px;padding:64px 36px 0 !important;background:rgba(var(--c-accent-rgb),.07);border-right:1px solid rgba(var(--c-accent-rgb),.28)}
[data-t="mark-l"]{position:static !important;display:block;margin:0 auto 18px;height:118px !important}
[data-t="mark-r"]{display:none}
[data-zone="title"] > div{zoom:.74}
[data-t="rule"]{display:none}
[data-t="grid"]{margin-left:470px;padding-top:56px !important}
[data-zone="featured"]{left:42px !important;right:auto !important;width:569px;bottom:200px !important;zoom:.72}
[data-zone="featured"] > div{padding-left:26px !important;padding-right:26px !important;flex-wrap:wrap}
[data-zone="featured"] > div > div:first-child{flex-direction:column;gap:6px}
[data-zone="featured"] > div > div:first-child > span{position:static !important;transform:none !important;white-space:normal !important}
[data-zone="featured"] [style*="grid-template-columns"]{grid-template-columns:1fr 1fr !important}
[data-zone="featured"] [style*="white-space: nowrap"]{white-space:normal !important}
[data-zone="wordmark"]{left:0 !important;right:auto !important;width:470px;bottom:48px !important}
[data-zone="extras"],[data-zone="image-strip"]{left:534px !important}`,
    },
    compacto: {
      label: 'Encabezado compacto',
      description: 'Una sola franja arriba (título a la izquierda, logotipo a la derecha) y banners pegados abajo.',
      css: `
[data-zone="title"]{zoom:.5;padding-top:50px !important}
[data-zone="title"] > div{text-align:left !important;padding-left:170px}
[data-t="mark-r"]{display:none}
[data-t="rule"]{margin-top:10px !important}
[data-t="grid"]{padding-top:20px !important}
[data-zone="wordmark"]{top:30px !important;bottom:auto !important;left:auto !important;right:80px !important}
[data-zone="wordmark"] img{height:40px !important}
[data-zone="featured"]{bottom:40px !important}
[data-zone="extras"]{bottom:40px !important}
[data-zone="image-strip"]{bottom:174px !important}`,
    },
  },
};

function layoutFor(menu) {
  const set = LAYOUTS[menu.canvas === 'horizontal' ? 'horizontal' : 'vertical'];
  return set[menu.layout] ? menu.layout : 'clasico';
}

// 'menu' es el valor histórico del scaffold → clásica.
function templateId(menu) {
  return TEMPLATES[menu.template] ? menu.template : 'clasica';
}

function library() {
  const lib = store.getSafe('data/library.json', {}) || {};
  return { fonts: lib.fonts || [], backgrounds: lib.backgrounds || [], logos: lib.logos || [], icons: lib.icons || [] };
}

// Catálogo para el panel.
function catalog() {
  return {
    templates: Object.entries(TEMPLATES).map(([id, t]) => ({
      id, label: t.label, description: t.description, background: t.background, fonts: t.fonts, dark: !!t.dark,
      group: t.group || 'base', emoji: t.emoji || null, roleFonts: t.roleFonts || {}, particles: t.particles || null,
      colors: { ink: toHex(t.colors.ink), accent: toHex(t.colors.accent), muted: toHex(t.colors.muted) },
      swatch: { ink: `rgb(${t.colors.ink})`, accent: `rgb(${t.colors.accent})`, bg: BACKGROUNDS[t.background].css },
    })),
    fonts: Object.entries(FONTS).map(([id, f]) => ({ id, label: f.label, role: f.role, stack: f.stack, google: f.google })),
    backgrounds: Object.entries(BACKGROUNDS).map(([id, b]) => ({ id, label: b.label, css: b.css })),
    layouts: Object.fromEntries(Object.entries(LAYOUTS).map(([canvas, set]) => [
      canvas, Object.entries(set).map(([id, l]) => ({ id, label: l.label, description: l.description })),
    ])),
    roles: ['title', 'category', 'item', 'price', 'note'].map((id) => ({
      id, label: ROLES[id].label, hint: ROLES[id].hint, family: ROLES[id].family, color: ROLES[id].color,
    })),
    library: library(),
  };
}

const FONT_FORMATS = { '.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype' };

// fontId → { stack, google?, face? }. Los ids "lib:<id>" son tipografías subidas.
function resolveFont(id, fallbackId) {
  if (typeof id === 'string' && id.startsWith('lib:')) {
    const f = library().fonts.find((x) => x.id === id.slice(4));
    if (f) {
      const ext = (f.url.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
      const family = `U-${f.id}`;
      return {
        stack: `"${family}", ${FONTS[fallbackId].stack}`,
        google: FONTS[fallbackId].google,
        face: `@font-face{font-family:"${family}";src:url("${f.url}") format("${FONT_FORMATS[ext] || 'woff2'}");font-display:swap}`,
      };
    }
  }
  const f = FONTS[id] || FONTS[fallbackId];
  return { stack: f.stack, google: f.google };
}

// Solo valores CSS seguros para meter dentro de un <style>.
function safeCssUrl(url) {
  return typeof url === 'string' && /^(\/uploads\/|https?:\/\/)[^"'()\\<>\s]+$/.test(url) ? url : null;
}
function safeColor(c) {
  return typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : null;
}

function backgroundCss(bg, tpl) {
  if (bg && bg.kind === 'image') {
    const url = safeCssUrl(bg.value);
    if (url) return `url("${url}") center / cover no-repeat`;
  }
  if (bg && bg.kind === 'color' && safeColor(bg.value)) return bg.value;
  if (bg && bg.kind === 'preset' && BACKGROUNDS[bg.value]) return BACKGROUNDS[bg.value].css;
  return BACKGROUNDS[tpl.background].css;
}

// Ganchos para el CSS de las plantillas: se marcan piezas del markup original
// (marco, línea del título, isotipos) con data-t, sin tocar el template.
const HOOKS = [
  ['<div style="position: absolute; inset: 26px;', '<div data-t="frame" style="position: absolute; inset: 26px;'],
  ['<div style="height: 2px; background: rgb(154, 122, 85); opacity: 0.5;', '<div data-t="rule" style="height: 2px; background: rgb(154, 122, 85); opacity: 0.5;'],
  [' alt="" style="position: absolute; left: 58px; top: 48px;', ' alt="" data-t="mark-l" style="position: absolute; left: 58px; top: 48px;'],
  [' alt="" style="position: absolute; right: 58px; top: 48px;', ' alt="" data-t="mark-r" style="position: absolute; right: 58px; top: 48px;'],
  ['<body>\n<div style="width: ', '<body>\n<div data-t="canvas" style="width: '],
  ['<div style="display: grid; grid-template-columns: 1fr 1fr; column-gap:', '<div data-t="grid" style="display: grid; grid-template-columns: 1fr 1fr; column-gap:'],
  ['<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap:', '<div data-t="grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap:'],
];

// Literales del diseño original → variables CSS. El orden importa: primero
// los rgba con alpha (más específicos), luego los rgb sólidos.
function replacements() {
  const out = [];
  for (const a of ['0.07', '0.16', '0.28', '0.55']) {
    out.push([`rgba(122, 90, 60, ${a})`, `rgba(var(--c-accent-rgb), ${a})`]);
  }
  out.push(
    ['rgb(42, 38, 32)', 'var(--c-ink)'],
    ['rgb(122, 90, 60)', 'var(--c-accent)'],
    ['rgb(122,90,60)', 'var(--c-accent)'],
    ['rgb(126, 116, 104)', 'var(--c-muted)'],
    ['rgb(171, 162, 148)', 'var(--c-faint)'],
    ['rgb(154, 122, 85)', 'var(--c-rule)'],
    ['stroke="#9A7A55"', 'stroke="currentColor" style="color: var(--c-rule)"'],
    ['rgb(239, 231, 217)', 'var(--c-slot)'],
    ['background: rgb(244, 239, 230)', 'background: var(--c-paper)'],
    ['&quot;Cormorant Garamond&quot;, Georgia, serif', 'var(--f-display)'],
    ['Archivo, system-ui, sans-serif', 'var(--f-body)'],
  );
  return out;
}

// themeFor(menu) → null (nada que aplicar) o { head, transform(html) }.
function themeFor(menu) {
  const id = templateId(menu);
  const theme = menu.theme || {};
  // Overrides por rol: lo del usuario manda; si no eligió fuente, aplica la
  // que la plantilla define para ese rol (p. ej. un titular festivo).
  const tplRoleFonts = TEMPLATES[id].roleFonts || {};
  const overrides = {};
  for (const role of ROLE_ORDER) {
    const o = roleOverride(theme, role) || (tplRoleFonts[role] ? { font: null, scale: null, color: null } : null);
    if (!o) continue;
    if (!o.font && tplRoleFonts[role]) o.font = tplRoleFonts[role];
    overrides[role] = o;
  }
  const layout = layoutFor(menu);
  const layoutCss = LAYOUTS[menu.canvas === 'horizontal' ? 'horizontal' : 'vertical'][layout].css;
  const hasTheme = !!(theme.background || theme.fonts?.display || theme.fonts?.body || Object.keys(overrides).length || layoutCss);
  if (id === 'clasica' && !hasTheme) return null;

  const tpl = TEMPLATES[id];
  const display = resolveFont(theme.fonts?.display, tpl.fonts.display);
  const body = resolveFont(theme.fonts?.body, tpl.fonts.body);
  const c = tpl.colors;

  // Variables por rol (solo las que el usuario movió).
  const roleVars = [];
  const roleFonts = [];
  for (const [role, o] of Object.entries(overrides)) {
    if (o.font) {
      const f = resolveFont(o.font, tpl.fonts[ROLES[role].family]);
      roleFonts.push(f);
      roleVars.push(`--f-${role}:${f.stack}`);
    }
    if (o.scale) roleVars.push(`--s-${role}:${o.scale}`);
    if (o.color) roleVars.push(`--c-r-${role}:${o.color}`);
  }
  const families = [...new Set([display, body, ...roleFonts].map((f) => f.google).filter(Boolean))];
  const faces = [...new Set([display, body, ...roleFonts].map((f) => f.face).filter(Boolean))];

  const vars = [
    `--c-ink:rgb(${c.ink})`, `--c-accent:rgb(${c.accent})`, `--c-accent-rgb:${c.accent.join(', ')}`,
    `--c-muted:rgb(${c.muted})`, `--c-faint:rgb(${c.faint})`, `--c-rule:rgb(${c.rule})`, `--c-slot:rgb(${c.slot})`,
    `--c-paper:${backgroundCss(theme.background, tpl)}`,
    `--f-display:${display.stack}`, `--f-body:${body.stack}`,
    ...roleVars,
  ];
  const head = [
    families.length
      ? `<link href="https://fonts.googleapis.com/css2?${families.map((f) => 'family=' + f).join('&')}&display=swap" rel="stylesheet"/>`
      : '',
    `<style data-theme="${id}">`,
    faces.join('\n'),
    `:root{${vars.join(';')}}`,
    tpl.dark ? 'html,body{background:#14120f}' : '',
    tpl.css.trim(),
    // Partículas (pétalos/confeti) apagables por carta: theme.particles === false.
    tpl.particles && theme.particles === false ? '[data-t="frame"]{display:none !important}' : '',
    layoutCss ? `/* distribución: ${layout} */\n${layoutCss.trim()}` : '',
    '</style>',
  ].filter(Boolean).join('\n');

  const pairs = [...HOOKS, ...replacements()];
  return {
    id,
    head,
    transform(html) {
      // Solo el <body>: el <head> trae el CSS de fx, que también usa literales.
      const cut = html.indexOf('<body>');
      let bodyHtml = html.slice(cut);
      // 1) Roles con override: se reescribe solo lo que el usuario movió, sobre
      //    el style original; lo demás lo resuelve el pase genérico de abajo.
      if (Object.keys(overrides).length) {
        bodyHtml = bodyHtml.replace(/style="([^"]*)"/g, (m, st) => {
          if (!st.includes('font-size')) return m;
          // `--r: rol` marca explícita (markup nuevo); si no, firma del original.
          const tagged = (st.match(/--r: (\w+)/) || [])[1];
          const role = ROLES[tagged] ? tagged : ROLE_ORDER.find((r) => ROLES[r].match(st));
          const o = role && overrides[role];
          if (!o) return m;
          let out = st;
          if (o.font) for (const lit of FAMILY_LITERALS) out = out.split(lit).join(`var(--f-${role})`);
          if (o.scale) out = out.replace(/font-size: ([\d.]+)px/, `font-size: calc($1px * var(--s-${role}))`);
          if (o.color) out = out.replace(/(?<![-\w])color: [^;]+;/, `color: var(--c-r-${role});`);
          return `style="${out}"`;
        });
      }
      for (const [from, to] of pairs) bodyHtml = bodyHtml.split(from).join(to);
      let headHtml = html.slice(0, cut).split('background:rgb(122,90,60)').join('background:var(--c-accent)');
      headHtml = headHtml.replace('</head>', head + '\n</head>');
      return headHtml + bodyHtml;
    },
  };
}

module.exports = { ROLES, LAYOUTS, layoutFor, themeFor, catalog, library, templateId, safeCssUrl, TEMPLATES, FONTS, BACKGROUNDS };
