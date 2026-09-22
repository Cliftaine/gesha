import React, { useEffect, useState } from 'react';
import { apiDelete, uploadFile } from './api.js';

// Valor de icono → URL (espejo de server/lib/icons.js):
// 'accent-star' → PNG original · 'lib:coffee' → librería SVG · '/uploads/…' → subido.
export function iconSrc(icon) {
  const v = String(icon || '');
  if (v.startsWith('lib:')) return `/assets/icons/lib/${v.slice(4)}.svg`;
  if (v.startsWith('/uploads/')) return v;
  return `/assets/icons/${v}.png`;
}

// Catálogo de iconos — cacheado a nivel módulo; los pickers abiertos se
// enteran de subidas/borrados vía listeners.
let cache = null;
const listeners = new Set();
async function loadIcons() {
  const r = await fetch('/api/icons').then((x) => x.json());
  cache = { icons: r.icons || [], library: r.library || [], uploaded: r.uploaded || [] };
  listeners.forEach((fn) => fn(cache));
}

export function useIcons() {
  const [data, setData] = useState(cache || { icons: [], library: [], uploaded: [] });
  useEffect(() => {
    listeners.add(setData);
    if (!cache) loadIcons().catch(() => {});
    return () => listeners.delete(setData);
  }, []);
  return data;
}

// Selector visual de icono: botón con el icono actual → originales, librería
// (con búsqueda) e iconos propios (subir / eliminar).
export default function IconPicker({ value, onChange, size = 30 }) {
  const { icons, library, uploaded } = useIcons();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const pick = (v) => { onChange(v); setOpen(false); };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setError('');
      const { entry } = await uploadFile('/library/icons', file);
      await loadIcons();
      pick(entry.url);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeUploaded = async (u) => {
    if (!confirm(`¿Eliminar el icono "${u.name}" de la biblioteca?`)) return;
    try {
      await apiDelete(`/library/icons/${u.id}`);
      await loadIcons();
    } catch (err) {
      setError(err.message);
    }
  };

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const term = norm(q.trim());
  const lib = term ? library.filter((i) => norm(i.label).includes(term) || i.id.includes(term)) : library;

  const Cell = ({ v, title }) => (
    <button type="button" className={'ghost small pick' + (v === value ? ' on' : '')} title={title} onClick={() => pick(v)}>
      <img src={iconSrc(v)} alt={title} />
    </button>
  );

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="ghost small" title="Cambiar icono" onClick={() => setOpen((o) => !o)}
        style={{ padding: 3, lineHeight: 0 }}>
        <img src={iconSrc(value)} alt="" style={{ width: size, height: size, display: 'block', objectFit: 'contain' }} />
      </button>
      {open && (
        <div className="icon-pop">
          <input type="text" autoFocus placeholder="Buscar: café, postre, picante…" value={q} onChange={(e) => setQ(e.target.value)} />
          {!term && (
            <>
              <h4>Manta</h4>
              <div className="icon-grid">{icons.map((ic) => <Cell key={ic} v={ic} title={ic} />)}</div>
            </>
          )}
          <h4>Librería</h4>
          <div className="icon-grid">
            {lib.map((i) => <Cell key={i.id} v={i.id} title={i.label} />)}
            {!lib.length && <span className="hint" style={{ gridColumn: '1 / -1' }}>Sin resultados</span>}
          </div>
          <h4>Míos</h4>
          <div className="icon-grid">
            {uploaded.map((u) => (
              <span key={u.id} className="ic">
                <Cell v={u.url} title={u.name} />
                <button type="button" className="swatch-x" title="Eliminar" onClick={() => removeUploaded(u)}>✕</button>
              </span>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <label className="file-btn">
              + subir icono <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" hidden onChange={onUpload} />
            </label>
            <span className="hint" style={{ margin: 0 }}>PNG/SVG cuadrado, fondo transparente.</span>
          </div>
          {error && <p className="status-error">{error}</p>}
        </div>
      )}
    </span>
  );
}
