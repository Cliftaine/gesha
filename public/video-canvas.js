// video-canvas.js — pinta un <video> dentro de un <canvas> que lo reemplaza.
// Las TVs (Samsung Tizen, LG webOS) dibujan el video en un plano de hardware
// aparte que ignora los transform CSS: con la pantalla girada desde el player
// (rotate 90/270) el video sale sin rotar. Un canvas sí es parte de la página
// y gira con ella. El <video> sigue reproduciendo, oculto, como fuente.
// Lo usan el carrusel (promociones.ejs) y los paquetes (promo-packages.js).
(function () {
  // Resolución máxima del canvas: un 4K por frame es demasiado para la TV;
  // el CSS lo estira al tamaño del hueco.
  var MAX_SIDE = 1920;

  window.geshaVideoCanvas = function (video) {
    if (video.geshaCanvas) return video.geshaCanvas;
    var canvas = document.createElement('canvas');
    if (video.className) canvas.className = video.className;
    canvas.setAttribute('style', video.getAttribute('style') || '');
    video.parentNode.insertBefore(canvas, video);
    // Fuera de la vista pero vivo (visibility:hidden basta para que la TV no
    // abra su plano de video, y sigue decodificando).
    video.style.visibility = 'hidden';
    var ctx = canvas.getContext('2d');
    var running = false;

    function fitCanvas() {
      var w = canvas.offsetWidth || 1, h = canvas.offsetHeight || 1;
      var k = Math.min(1, MAX_SIDE / Math.max(w, h));
      var cw = Math.round(w * k), ch = Math.round(h * k);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    }
    // object-fit: cover + object-position "x% y%", como el <video> original.
    function draw() {
      var vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return;
      fitCanvas();
      var cw = canvas.width, ch = canvas.height;
      var pos = (getComputedStyle(video).objectPosition || '50% 50%').split(' ');
      var px = parseFloat(pos[0]) / 100, py = parseFloat(pos[1]) / 100;
      if (!isFinite(px)) px = 0.5;
      if (!isFinite(py)) py = 0.5;
      var s = Math.max(cw / vw, ch / vh), dw = vw * s, dh = vh * s;
      ctx.drawImage(video, (cw - dw) * px, (ch - dh) * py, dw, dh);
    }
    var hasVFC = typeof video.requestVideoFrameCallback === 'function';
    function loop() {
      if (!running) return;
      draw();
      if (hasVFC) video.requestVideoFrameCallback(loop);
      else requestAnimationFrame(loop);
    }
    function start() { if (!running) { running = true; loop(); } }
    function stop() { running = false; }
    video.addEventListener('play', start);
    video.addEventListener('pause', stop);
    video.addEventListener('ended', stop);
    video.addEventListener('loadeddata', draw); // primer cuadro, aun en pausa
    if (!video.paused) start();
    else if (video.readyState >= 2) draw();

    video.geshaCanvas = canvas;
    return canvas;
  };

  // ¿Hace falta? Solo si se pide con ?vc=1 en la URL del player y la pantalla
  // está girada. No es automático: en la Samsung el canvas no funcionó y los
  // videos se suben ya rotados; activarlo ahí los giraría dos veces.
  window.geshaNeedsVideoCanvas = function (rotation) {
    return /[?&]vc=1/.test(location.search) && (rotation === 90 || rotation === 270);
  };
})();
