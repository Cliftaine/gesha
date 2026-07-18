// api.js — cliente central: guarda la última versión vista y la manda como
// If-Match en cada PUT; un 409 significa que alguien más guardó primero.
let lastVersion = null;

export class ConflictError extends Error {
  constructor() {
    super('Conflicto: alguien más guardó cambios. Recarga para ver la última versión.');
    this.name = 'ConflictError';
  }
}

export async function apiGet(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  const json = await res.json();
  if (json.version) lastVersion = json.version;
  return json;
}

export async function apiPut(path, data) {
  const res = await fetch(`/api${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(lastVersion ? { 'If-Match': String(lastVersion) } : {}),
    },
    body: JSON.stringify(data),
  });
  if (res.status === 409) throw new ConflictError();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `PUT ${path} → ${res.status}`);
  }
  const json = await res.json();
  if (json.version) lastVersion = json.version;
  return json;
}

export async function uploadImage(file) {
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error al subir la imagen');
  }
  return (await res.json()).url;
}

// Debounce simple para auto-save.
export function debounce(fn, ms = 800) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
