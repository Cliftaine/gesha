// media.js — fondos de promo: imagen o video, decidido por la extensión de la URL.
const VIDEO_EXT = /\.(mp4|webm)$/i;

function isVideo(url) {
  return typeof url === 'string' && VIDEO_EXT.test(url.split(/[?#]/)[0]);
}

module.exports = { isVideo };
