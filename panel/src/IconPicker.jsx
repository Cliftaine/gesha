import React, { useEffect, useState } from 'react';

// Lista de iconos (assets/icons) — cacheada a nivel módulo.
let iconsCache = null;
export function useIcons() {
  const [icons, setIcons] = useState(iconsCache || []);
  useEffect(() => {
    if (iconsCache) return;
    fetch('/api/icons')
      .then((r) => r.json())
      .then(({ icons }) => {
        iconsCache = icons;
        setIcons(icons);
      })
      .catch(() => {});
  }, []);
  return icons;
}

// Selector visual de icono: botón con el icono actual → grid de opciones.
export default function IconPicker({ value, onChange, size = 30 }) {
  const icons = useIcons();
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="ghost small"
        title={value}
        onClick={() => setOpen((o) => !o)}
        style={{ padding: 3, lineHeight: 0 }}
      >
        <img src={`/assets/icons/${value}.png`} alt={value} style={{ width: size, height: size, display: 'block' }} />
      </button>
      {open && (
        <span
          style={{
            position: 'absolute', zIndex: 20, top: '100%', left: 0, marginTop: 4,
            background: '#fff', border: '1px solid var(--accent-soft)', borderRadius: 10,
            padding: 8, display: 'grid', gridTemplateColumns: 'repeat(5, 34px)', gap: 4,
            boxShadow: '0 8px 22px rgba(0,0,0,.14)',
          }}
        >
          {icons.map((ic) => (
            <button
              key={ic}
              type="button"
              className="ghost small"
              title={ic}
              onClick={() => { onChange(ic); setOpen(false); }}
              style={{ padding: 2, lineHeight: 0, borderColor: ic === value ? 'var(--accent)' : undefined }}
            >
              <img src={`/assets/icons/${ic}.png`} alt={ic} style={{ width: 28, height: 28, display: 'block' }} />
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
