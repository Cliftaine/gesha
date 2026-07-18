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
  reaparece si alguien sale con Esc). El cursor se oculta tras 3s sin moverse.
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
| `data/menus/*.json` | Contenido de las cartas (categorías, items, precios, variantes) |
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
- **Animaciones**: título máquina de escribir, entrada escalonada (con replay
  opcional cada N segundos) y acentos ✨ por item/categoría/banner (pulso o
  brillo). Con todo apagado el render es pixel-idéntico al diseño original.
  Los slides de promociones animan su texto al entrar (configurable).
- **Isotipos / Manta viva 🌊**: la marca de cada carta es elegible entre el PNG
  clásico y los 4 isotipos SVG oficiales. Con "Manta viva" el isotipo se
  deforma periódicamente (turbulencia + displacement SMIL, corre dentro de
  `<img>`) como si nadara — nada de JS en la pantalla. Los SVG fuente viven en
  la raíz; `npm run isotipos` regenera `public/assets/isotipos/` (limpia el
  fondo, recorta el viewBox al cuerpo de la manta y genera la versión viva).
  En promociones los isotipos blancos (02/04) van sin `invert`, los oscuros
  se invierten como el PNG original.

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

## Deploy

Un proceso Node por tienda (mini-PC) o un VPS para todas. Con pm2:
`pm2 start server/index.js --name gesha`. Datos = archivos JSON (escritura
atómica); respaldar `config/` y `data/`.
