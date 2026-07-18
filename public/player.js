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
  let orientation = body.dataset.orientation || 'portrait';
  const status = document.getElementById('status');

  // ── Centrado + scale-to-fit con orientación ─────────────────────────────
  // El canvas siempre es 1080×1920 vertical; en TVs montadas de lado
  // ('cw' = girada 90° horario, 'ccw' = antihorario) rotamos el canvas para
  // llenar la pantalla landscape.
  function fit() {
    const rotated = orientation === 'cw' || orientation === 'ccw';
    const scale = rotated
      ? Math.min(innerWidth / 1920, innerHeight / 1080)
      : Math.min(innerWidth / 1080, innerHeight / 1920);
    const rot = orientation === 'cw' ? ' rotate(90deg)' : orientation === 'ccw' ? ' rotate(-90deg)' : '';
    for (const f of frames) {
      f.style.transform = `translate(-50%, -50%)${rot} scale(${scale})`;
    }
  }
  addEventListener('resize', fit);
  fit();

  function setOrientation(next) {
    if (!next || next === orientation) return;
    orientation = next;
    fit();
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
      const { carta, version, orientation: orient } = await res.json();
      setOrientation(orient);
      show(carta, version);
    } catch { /* red caída: reintenta al siguiente tick */ }
  }

  // ── SSE con reconexión; polling como respaldo permanente ────────────────
  function connect() {
    const es = new EventSource(`/events/${SUCURSAL}/${PANTALLA}`);
    es.onmessage = (e) => {
      try {
        const { carta, version, orientation: orient } = JSON.parse(e.data);
        setOrientation(orient);
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

  // ── Cursor oculto tras 3s sin movimiento (señalización) ─────────────────
  let cursorTimer;
  function pokeCursor() {
    body.classList.remove('hide-cursor');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => body.classList.add('hide-cursor'), 3000);
  }
  addEventListener('pointermove', pokeCursor);
  pokeCursor();

  // ── Reload completo diario (higiene en TV sticks) ────────────────────────
  const [rh, rm] = DAILY_RELOAD_AT.split(':').map(Number);
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === rh && now.getMinutes() === rm && now.getSeconds() < 30) {
      location.reload();
    }
  }, 30 * 1000);
})();
