// auth.js — EL seam de autenticación. Hoy es un passthrough deliberado.
//
// TODO(auth, Fase 8): implementar aquí (y solo aquí + rutas de login):
//   - express-session con file store (consistente con la decisión sin-DB)
//   - cookies httpOnly, SameSite=Lax, Secure
//   - credencial admin: hash bcrypt vía variable de entorno
//   - CSRF double-submit en métodos mutantes
//   - rate-limit en /panel/login y rotación de sesión al entrar
//
// Todo lo privado (/panel y /api) se monta detrás de ESTE middleware en
// server/index.js — un único punto de montaje es lo que hace que la auth
// futura sea no-bypasseable: no existe handler privado fuera de ese seam.
module.exports = function authGate(req, res, next) {
  next();
};
