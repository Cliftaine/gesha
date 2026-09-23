// seed.js — copia los datos iniciales (seed/) a data/ y config/ SOLO si no
// existen. Los archivos vivos se editan desde el panel y no están en git, así
// que un `git pull` en el servidor nunca los pisa; una instalación nueva
// arranca con estos ejemplos. Correr con `npm run seed` (make setup lo hace).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(ROOT, 'seed');

function copyMissing(rel) {
  const from = path.join(SEED, rel);
  const to = path.join(ROOT, rel);
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const f of fs.readdirSync(from)) copyMissing(path.join(rel, f));
    return;
  }
  if (fs.existsSync(to)) return;
  fs.copyFileSync(from, to);
  console.log('creado', rel);
}

copyMissing('data');
copyMissing('config');
console.log('seed listo (los archivos existentes no se tocaron)');
