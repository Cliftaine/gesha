// player.js — pantalla TV: centra la carta 1080×1920 vertical, la escala a
// cualquier display (letterbox negro) y la mantiene al día vía SSE con
// fallback a polling. Swap con doble buffer para evitar flash blanco.
(() => {
  const body = document.body;
  const SUCURSAL = body.dataset.sucursal;
  const PANTALLA = body.dataset.pantalla;
  const POLL_SECONDS = Number(body.dataset.pollSeconds) || 60;
  const DAILY_RELOAD_AT = body.dataset.dailyReloadAt || '04:30';

  const frames = [document.getElementById('a'), document.getElementById('b')];
  let active = 0;
  let current = { carta: null, version: null };
  let rotation = Number(body.dataset.rotation) || 0; // 0 | 90 | 180 | 270
  let canvas = { w: 1080, h: 1920 }; // dimensiones de la carta (llega en resolve/SSE)
  const status = document.getElementById('status');

  // ── Centrado + scale-to-fit con rotación y canvas dinámico ──────────────
  // La carta puede ser vertical (1080×1920) u horizontal (1920×1080), y la
  // pantalla puede estar montada girada: rotamos el canvas 0/90/180/270°
  // y escalamos su huella al display.
  function fit() {
    const swap = rotation === 90 || rotation === 270;
    const fw = swap ? canvas.h : canvas.w; // huella en pantalla
    const fh = swap ? canvas.w : canvas.h;
    const scale = Math.min(innerWidth / fw, innerHeight / fh);
    const rot = rotation ? ` rotate(${rotation}deg)` : '';
    for (const f of frames) {
      f.style.width = canvas.w + 'px';
      f.style.height = canvas.h + 'px';
      f.style.transform = `translate(-50%, -50%)${rot} scale(${scale})`;
    }
  }
  addEventListener('resize', fit);
  fit();

  function applyView(rot, cv) {
    let changed = false;
    if ([0, 90, 180, 270].includes(rot) && rot !== rotation) {
      rotation = rot;
      changed = true;
    }
    if (cv && cv.w && (cv.w !== canvas.w || cv.h !== canvas.h)) {
      canvas = cv;
      changed = true;
    }
    if (changed) fit();
  }

  // ── Swap con doble buffer ────────────────────────────────────────────────
  function show(carta, version) {
    if (carta === current.carta && version === current.version) return;
    current = { carta, version };
    const next = frames[1 - active];
    const src = `/carta/${carta}?sucursal=${encodeURIComponent(SUCURSAL)}&pantalla=${encodeURIComponent(PANTALLA)}&v=${version}`;
    next.addEventListener('load', function onload() {
      next.removeEventListener('load', onload);
      next.classList.remove('hidden');
      frames[active].classList.add('hidden');
      active = 1 - active;
    });
    next.src = src;
    status.textContent = `${carta} · v${version}`;
  }

  async function poll() {
    try {
      const res = await fetch(`/api/resolve/${SUCURSAL}/${PANTALLA}`);
      if (!res.ok) return;
      const { carta, version, rotation: rot, canvas: cv } = await res.json();
      applyView(rot, cv);
      show(carta, version);
    } catch { /* red caída: reintenta al siguiente tick */ }
  }

  // ── SSE con reconexión; polling como respaldo permanente ────────────────
  function connect() {
    const es = new EventSource(`/events/${SUCURSAL}/${PANTALLA}`);
    es.onmessage = (e) => {
      try {
        const { carta, version, rotation: rot, canvas: cv } = JSON.parse(e.data);
        applyView(rot, cv);
        show(carta, version);
      } catch { /* payload malformado: ignorar */ }
    };
    es.onerror = () => {
      es.close();
      setTimeout(connect, 5000);
    };
  }
  connect();
  poll();
  setInterval(poll, POLL_SECONDS * 1000);

  // ── Pantalla completa ────────────────────────────────────────────────────
  // Intento al cargar (funciona en modo kiosko / algunos navegadores de TV).
  // Si el navegador exige gesto del usuario, mostramos un botón que ocupa
  // toda la pantalla: un toque en cualquier parte entra a fullscreen.
  const fsBtn = document.getElementById('fs');

  async function goFullscreen() {
    if (document.fullscreenElement) return true;
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      return true;
    } catch {
      return false;
    }
  }

  async function tryAutoFullscreen() {
    const ok = await goFullscreen();
    body.classList.toggle('show-fs', !ok);
  }

  fsBtn.addEventListener('click', async () => {
    await goFullscreen();
    body.classList.remove('show-fs');
  });

  document.addEventListener('fullscreenchange', () => {
    // Si alguien sale de fullscreen (Esc / control), reofrecemos el botón.
    body.classList.toggle('show-fs', !document.fullscreenElement);
    fit();
  });

  tryAutoFullscreen();

  // El cursor se oculta siempre por CSS (ver player.ejs): en una TV no hay
  // nada que señalar y los TV sticks lo dibujan enorme.

  // ── Reload completo diario (higiene en TV sticks) ────────────────────────
  const [rh, rm] = DAILY_RELOAD_AT.split(':').map(Number);
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === rh && now.getMinutes() === rm && now.getSeconds() < 30) {
      location.reload();
    }
  }, 30 * 1000);
})();
