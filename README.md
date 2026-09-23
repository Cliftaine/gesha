# gesha — Despachador de cartas digitales · Manta Café

Sirve la carta correcta a cada pantalla según **sucursal, día y hora**, con un
panel de administración para editar horarios, precios, promociones y layout.
La carta de promociones es dinámica: reacciona al **clima** (frío → cosas
calientes, calor → frías), al **horario estelar** (desayunos AM, comida del día
PM) y al servicio de **comida del día** (mockeado, swappable).

## Correr

```bash
npm install && npm run panel:build   # primera vez
npm start                            # http://localhost:3000
```

- **Pantalla TV:** `http://<IP>:3000/<sucursal>/<pantalla>` → ej. `/centro/pantalla_1`.
  La carta se muestra centrada y vertical (1080×1920), escalada a cualquier display
  con letterbox negro. Se actualiza sola vía SSE (fallback: polling).
  **Orientación por pantalla** (panel → Horarios): si la TV abre en landscape
  pero está montada de lado, elige "Girada 90° →" o "Girada 90° ←" y el canvas
  se rota para llenar la pantalla; el cambio se aplica en vivo, sin tocar la TV.
  **Pantalla completa**: el player la intenta al cargar; si el navegador exige
  un gesto, un toque en cualquier parte de la pantalla la activa (y el botón
  reaparece si alguien sale con Esc). El cursor nunca se ve: ni en el player, ni en una carta abierta directo
  (`/carta/<id>`), ni sobre las plantillas de promo.
  **4K**: el canvas lógico sigue siendo 1080×1920 y el navegador lo rasteriza a
  resolución del dispositivo — texto e isotipos SVG salen nítidos; las fotos de
  promos se piden a 2160px. Tip: en TV sticks, lanzar Chrome con
  `--kiosk --start-fullscreen` evita el gesto por completo.
- **Panel:** `http://<IP>:3000/panel` — horarios, menús/precios, promos, editor visual.
- **Dev del panel:** `npm run dev` (server) + `npm run panel:dev` (Vite en :5173 con proxy).

## Estructura

| Ruta | Qué es |
|---|---|
| `config/dispatch.json` | Sucursales → pantallas → reglas `{days, from, to, carta}` (primera coincidencia gana; `from > to` cruza medianoche) |
| `config/settings.json` | Timezone, clima (override / Open-Meteo / mock), URL del servicio de comida, player |
| `seed/` | Datos iniciales (`npm run seed` los copia a `data/` y `config/` solo si faltan) |
| `data/menus/*.json` | Contenido de las cartas (categorías, items, precios, variantes) — **no está en git** |
| `data/promos.json` | Promos estáticas + slides dinámicos + umbrales de clima + rotación |
| `data/layouts.json` | Deltas del editor visual por zona (`{}` = diseño original intacto) |
| `data/mock/comida-semana.json` | Comidas del día por día de semana (alimenta el mock) |
| `server/` | Express + EJS. `lib/auth.js` es el seam de autenticación (hoy passthrough) |
| `panel/` | SPA React + Vite (build servido por Express en `/panel`) |
| `cartas-html/` | **Originales intactos** — referencia de fidelidad (`/reference/*`, `/diff/:id` en dev) |


## Edición completa (panel → Menús y precios)

- **Categorías**: crear, renombrar, mover dentro de la columna o a la otra columna,
  recuadro estilo "Especiales", icono seleccionable de la librería (`/api/icons`),
  grupos/sub-secciones (como Frappes → Café/Otros/Frutales).
- **Items**: convertibles entre precio único / por tamaño (CH/G) / variantes,
  y las variantes en 1 o 2 columnas.
- **Banners elegibles**: "Comida del día" (incluye editable, guisado en vivo),
  "Extras" (items con icono) y el strip de fotos se pueden agregar, ocultar o
  quitar de cualquier menú. La vista previa avisa si el contenido se encima.
- **Animaciones** (tarjetas con demo en vivo): entrada del título (máquina de
  escribir, desvanecer, espaciado, desenfoque, caer), **título en loop**
  (respirar, flotar, resplandor, latido), entrada del contenido (subir,
  desvanecer, deslizar, acercar, desenfoque), acentos ✨ en loop (pulso, brillo,
  resplandor, subrayado) y "repetir las entradas" con presets o un tiempo
  personalizado en segundos. **Logos**: el del inicio (`mark.anim`) y el del pie
  (`theme.wordmarkAnim`) se animan por separado — flotar, desvanecer, balanceo,
  latido, voltear, además de "Manta viva" — y cada uno puede ocultarse. Con todo apagado el render es pixel-idéntico al diseño original.
  Los slides de promociones animan su texto al entrar (configurable).
- **Isotipos / Manta viva 🌊**: la marca de cada carta es elegible entre el PNG
  clásico y los 4 isotipos SVG oficiales. Con "Manta viva" el isotipo se
  deforma periódicamente (turbulencia + displacement SMIL, corre dentro de
  `<img>`) como si nadara — nada de JS en la pantalla. Los SVG fuente viven en
  la raíz; `npm run isotipos` regenera `public/assets/isotipos/` (limpia el
  fondo, recorta el viewBox al cuerpo de la manta y genera la versión viva).
  En promociones los isotipos blancos (02/04) van sin `invert`, los oscuros
  se invierten como el PNG original.

## Panel: Cartas, Promociones y borradores

El menú lateral tiene una sección para **Cartas** y otra para **Promociones**.
En Cartas, la **vista previa** queda fija a la derecha durante todo el
recorrido del editor y muestra lo que se está editando (se renderiza con
`POST /api/preview/menu/:id`, sin guardar nada). Debajo:

- **Aplicar** — publica en las pantallas (`PUT /api/menus/:id`) y limpia el borrador.
- **Guardar borrador** — guarda en `data/drafts/menus/<id>.json` para seguir
  después; se escribe "en silencio": no sube la versión ni refresca las TVs.
- **Descartar** — vuelve a la versión publicada.

**Promociones** usa el mismo esquema (borrador en `data/drafts/promos.json`,
logo elegible **por promoción** —isotipos claros/oscuros, biblioteca o subir uno—,
vista previa con `POST /api/preview/promos-carta/:cartaId`, que rota por todas
las promos activas sin mirar su horario) y cada promo tiene un **nombre**
editable solo para identificarla en el panel. Su editor va de lo más
usado a lo menos: primero la lista de **promociones** — cada una con su
**programación arriba** (activa, días, horario, vigencia por fechas, prioridad),
luego el diseño y el contenido con etiquetas —, después las plantillas HTML, los
ajustes de la pantalla y "Probar una fecha".
Las **promociones automáticas** (desayunos, comida del día, promo del día)
están apagadas por ahora: no aparecen en el panel y el motor solo las arma si
`data/promos.json` trae `"dynamicEnabled": true` (su configuración se conserva
en `dynamic`). El **clima también está apagado** para simplificar: sin etiquetas
hot/cold/ice ni umbrales en el panel, y el motor ignora la temperatura salvo
que `data/promos.json` traiga `"weather": { "enabled": true, … }`.

El panel no usa dropdowns ni casillas sueltas en el editor: todo se elige con
**tarjetas** (`OptionCards.jsx`) que muestran un croquis o la imagen real de
cada opción y una pista de cuándo conviene. Dentro de cada categoría, platillo,
marcador, banner y regla de horario se usa la variante **mini** (icono,
recuadro, acento, precios, descripciones, tipo de precio, columnas de
variantes, carta del horario…), con todas las opciones a la vista.

## Diseño de cartas: plantillas, fondo, logo y tipografías

En **Contenido → Cartas**, la tarjeta **Diseño** de cada carta permite elegir:

- **Plantilla**: 8 base (Clásica —el original—, Pizarra, Editorial, Bistró,
  Moderna, Vintage, Nocturna, Fresca) y 8 **festivas/de temporada** (Navidad,
  Halloween, Día de Muertos, Fiestas Patrias, Primavera, Verano, Otoño, Amor y
  amistad) con guirnaldas y fondos hechos con CSS. **Día de Muertos** y
  **Fiestas Patrias** usan ilustraciones SVG en `public/assets/temporada/`
  (`npm run temporada` las regenera): papel picado calado, calaverita de
  azúcar y pan de muerto con volumen y textura, cempasúchil y pétalos cayendo;
  dos banderas de México ondeando junto al título (SVG oficial de dominio
  público, Wikimedia Commons) y confeti tricolor. Las partículas son tenues,
  van detrás del contenido y se apagan por carta (`theme.particles: false`). Todas
  funcionan en **vertical u horizontal** y con **2 o 3 columnas**. Una plantilla
  puede fijar la fuente de un rol (`roleFonts`, p. ej. el titular navideño) sin
  tocar precios ni platillos. Se definen en `TEMPLATES` (`server/lib/theme.js`).
- **Fondo**: presets incluidos, color liso o una imagen propia.
- **Logo**: isotipos Manta o un logo subido (a ambos lados / solo izquierda) y
  el logotipo del pie.
- **Tipografías**, una fila por rol — título de la carta, títulos de categoría,
  platillos, precios, notas y descripciones — cada una con su **fuente**
  (incluidas de Google Fonts o subidas en `.woff2`, `.woff`, `.ttf`, `.otf`),
  **tamaño** en % respecto a la plantilla (con ↺ para restablecer) y **color**.
  Se guarda en `menu.theme.type[rol] = { font, size, color }`.
- **Iconos**: el icono de los títulos de categoría se apaga por categoría
  (casilla "icono") o para toda la carta ("icono en títulos"). El selector trae
  los 13 originales, una librería de 77 iconos con buscador
  (`public/assets/icons/lib/`, trazos de [Lucide](https://lucide.dev), ISC, en
  el mismo estilo de medallón) e iconos propios subidos (PNG/SVG cuadrado).
  Valores: `accent-star` (original), `lib:coffee` (librería), `/uploads/…` (propio).

- **Distribución** (3 por orientación, con croquis en el panel). Vertical:
  Clásico, Destacado arriba (Comida del día bajo el título) y Encabezado
  compacto. Horizontal: Clásico, Panel lateral (logo, título, Comida del día y
  logotipo a la izquierda) y Encabezado compacto. Son solo CSS sobre las zonas
  (`LAYOUTS` en `server/lib/theme.js`); se guarda en `menu.layout`.
- **Resolución**: Full HD o **4K** (`menu.resolution: "4k"`). En 4K la carta se
  maqueta con `zoom: 2` sobre el mismo diseño (2160×3840 / 3840×2160 reales) y
  el player ya no tiene que escalarla en una TV 4K. El panel siempre previsualiza
  y edita a 1080 lógico (`/carta/<id>?res=base`). Imágenes: hasta 25 MB.
- **Banner "Comida del día"**: tamaño **grande** (original), **mediano** o
  **compacto** (una sola franja) en `featured.size`.

Lo que se sube queda en una biblioteca compartida (`data/library.json` +
archivos en `public/uploads/`) reutilizable entre cartas — **respaldar también
`public/uploads/`**.

Cómo funciona (`server/lib/theme.js`): los partials EJS conservan sus literales
verbatim; el tema es un post-proceso del HTML que cambia esos literales por
variables CSS e inyecta los valores de la plantilla. Una carta Clásica sin tema
no se toca: sigue siendo **byte-idéntica** al original.

**Marcadores**: bloques intermedios entre categorías (título de sección, divisor
con icono, nota en recuadro) con icono, título y texto editables; se mueven
entre columnas como las categorías y son zonas del editor visual (`mk-…`).

**Por categoría** se elige si se muestran los **precios** y una **breve
descripción** por platillo.

## Promociones: 10 diseños incluidos

Cada promo elige su **diseño** con miniaturas (Contenido → Promociones →
"diseño"): el estándar o uno de los 10 incluidos en `server/promo-layouts/`
(clásico, mitad y sello, marco centrado, banda diagonal, póster, tarjeta
flotante, columna lateral, polaroid, precio protagonista y revista). Todos
comparten los mismos campos — **imagen** (subible), **título**, **precio**,
**slogan**, **lo que contiene** (una línea por elemento), **términos y
condiciones**, **logo** y **posición del logo** (6 esquinas/centros u oculto) —
así que se puede cambiar de diseño sin recapturar nada. Un campo vacío
desaparece del slide; ↺ vuelve al texto de ejemplo. Son paquetes HTML normales:
cualquiera sirve de base para una plantilla propia.

**Horizontal**: existe la carta `promociones-horizontal` (1920×1080, mismos
datos y reglas) asignable a cualquier pantalla. Cada promo guarda un diseño por
orientación — `package` (▯) y `packageH` (▭) — con 3 diseños horizontales
incluidos (panorámico, mitad y sello, tarjeta); sin diseño para esa
orientación se usa el slide estándar. **4K**: una plantilla declara su
resolución en `promo.json` (`"size": [2160, 3840]`, también `[3840, 2160]`) o
en el selector del panel; el carrusel escala el iframe al marco.

## Promociones con plantilla HTML propia

En **Contenido → Promociones → Plantillas HTML** se sube un **`.zip`** (o un
`.html` solo) diseñado a 1080×1920:

```
mi-promo.zip
├── index.html      ← obligatorio, en la raíz (o dentro de una sola carpeta)
├── style.css, img/…, fonts/…   ← rutas relativas
└── promo.json      ← opcional: { "name": "…", "labels": { "precio": "Precio" } }
```

En `index.html`, lo editable se marca con placeholders:

| Sintaxis | Campo en el panel |
|---|---|
| `{{precio}}` | texto |
| `{{nombre|Combo Mañanero}}` | texto con valor por defecto |
| `{{img:foto|img/foto.jpg}}` | imagen (default = archivo del paquete) |
| `{{list:contiene|Café;Pan}}` | lista, una línea por elemento → `<li>` |
| `{{opt:logo_pos|arriba,abajo,oculto}}` | selector (la primera opción es el default) |

Cada promo elige su **diseño**: "Estándar" o una plantilla; con plantilla, el
panel muestra sus campos y la promo conserva horarios, días, clima y prioridad.
"Actualizar" reemplaza los archivos de una plantilla sin perder los valores ya
capturados. Ejemplo listo para copiar: `ejemplos/promo-plantilla/` (descargable
desde el panel).

Detalles: los archivos viven en `data/promo-packages/<id>/` y se sirven en
`/promo-pkg/<id>/`; el carrusel los embebe en un `<iframe sandbox="allow-scripts">`
(el HTML subido no puede tocar el panel ni la API). Al entrar el slide, el
iframe recibe `postMessage({ type: 'gesha:slide-active' })` para reiniciar
animaciones. Límites: 60 MB, 300 archivos, solo html/css/js/json, imágenes,
fuentes y video.

## Clima

Cadena de resolución: override manual (settings) → Open-Meteo (sin API key,
lat/lon por sucursal, cache 30 min) → último valor conocido → mock. Con frío
(< `coldBelowC`) las promos con tag `hot` reciben boost; con calor
(> `hotAboveC`), las `cold`/`ice`.

## Servicio de comida del día

El promo engine consume `settings.comidaServiceUrl` vía HTTP (hoy apunta al
mock local `/mock/comida`). Para conectar el servicio real: cambiar esa URL —
cero cambios de código. Contrato: `{ today, tomorrow, promoDelDia }`.

## Autenticación (pendiente, diseñada)

Todo lo privado (`/panel`, `/api`) está montado detrás de **un único**
middleware: `server/lib/auth.js` (hoy passthrough). Implementar ahí sesiones +
login + CSRF + rate-limit lo hace no-bypasseable: no existe handler privado
fuera de ese punto de montaje. Las pantallas quedan públicas (pensadas para LAN).

## Verificación rápida

```bash
# dispatcher con reloj falso (solo dev)
curl 'localhost:3000/api/resolve/centro/pantalla_1?now=2026-07-13T13:00:00-06:00'
# dry-run del promo engine
curl 'localhost:3000/api/preview/promos?at=2026-07-14T09:00&temp=10'
# fidelidad pixel contra los originales (dev)
open http://localhost:3000/diff/alimentos
```

## Deploy — servicio del sistema

Un proceso Node por tienda (mini-PC) o un VPS para todas. El Makefile instala
el proyecto como servicio: **arranca con el servidor y se reinicia solo si se
cae**, detectando el sistema operativo.

```bash
make setup             # primera vez: deps + build del panel + isotipos
make service-install   # Linux → systemd (sudo) · macOS → launchd (usuario)
make service-status    # estado + ping HTTP
make service-logs      # logs en vivo (journalctl / tail)
make service-restart   # reinicio manual
make service-uninstall # quitar el servicio
```

Las plantillas viven en `deploy/` (`gesha.service.tpl`, `com.mantacafe.gesha.plist.tpl`)
y `make service-install` sustituye ruta del proyecto, binario de node y usuario
automáticamente. En Linux queda habilitado con el boot (`multi-user.target`);
en macOS arranca al iniciar sesión (`RunAtLoad` + `KeepAlive`, logs en `logs/`).
Datos = archivos JSON (escritura atómica) que **no viajan por git**: `data/`,
`config/` y `public/uploads/` se editan en cada servidor y `git pull` nunca los
toca. Respaldar esas tres carpetas.
