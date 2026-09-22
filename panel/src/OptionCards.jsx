import React from 'react';

// Controles visuales del panel: tarjetas grandes en vez de selects/checkboxes.
// OptionCards = elección única; ToggleCard = encendido/apagado.
// Cada opción: { id, label, hint?, sketch? (clase CSS de croquis), img?, dark?, node? }.
// size: 'md' | 'sm' | 'xs' | 'mini' (mini = dentro de filas: croquis + etiqueta).
// `extra`: nodo al final de la fila (p. ej. una UploadCard).
export function OptionCards({ label, options, value, onChange, size = 'md', extra = null }) {
  return (
    <div className="opt-group">
      {label && <span className="opt-label">{label}</span>}
      <div className={'opt-cards ' + size}>
        {options.map((o) => (
          <button key={o.id} type="button" title={o.hint || o.label}
            className={'opt-card' + (o.id === value ? ' on' : '')} onClick={() => onChange(o.id)}>
            <OptionArt option={o} />
            <strong>{o.label}</strong>
            {o.hint && size !== 'mini' && <small>{o.hint}</small>}
            {o.onRemove && (
              <span className="swatch-x" role="button" title="Eliminar de la biblioteca"
                onClick={(e) => { e.stopPropagation(); o.onRemove(); }}>✕</span>
            )}
          </button>
        ))}
        {extra}
      </div>
    </div>
  );
}

// size 'mini': para filas del editor (categorías, platillos, banners); el
// estado se ve en el borde y en la palomita, sin la píldora Activado/Apagado.
export function ToggleCard({ label, hint, sketch, checked, onChange, size = 'md' }) {
  const mini = size === 'mini';
  return (
    <button type="button" className={'opt-card toggle' + (mini ? ' mini' : '') + (checked ? ' on' : '')} title={hint || label}
      aria-pressed={checked} onClick={() => onChange(!checked)}>
      {mini && <span className="opt-check">{checked ? '✓' : ''}</span>}
      {sketch && <span className={'sk ' + sketch}><i /><i /><i /></span>}
      <strong>{label}</strong>
      {hint && !mini && <small>{hint}</small>}
      {!mini && <span className="opt-state">{checked ? 'Activado' : 'Apagado'}</span>}
    </button>
  );
}

function OptionArt({ option: o }) {
  if (o.node) return <span className="sk-wrap">{o.node}</span>;
  if (o.img) return <span className={'sk-img' + (o.dark ? ' dark' : '')}><img src={o.img} alt="" /></span>;
  if (o.sketch) return <span className={'sk ' + o.sketch}><i /><i /><i /></span>;
  return null;
}

// Tarjeta "subir archivo" con el mismo tamaño que las opciones.
export function UploadCard({ label, accept, onFile }) {
  return (
    <label className="opt-card upload">
      <span className="sk-img"><span className="plus">+</span></span>
      <strong>{label}</strong>
      <input type="file" accept={accept} hidden onChange={onFile} />
    </label>
  );
}

// Campo con etiqueta: deja claro qué se está llenando (nombre, precio, nota…).
// El control va en una caja de alto fijo para que las etiquetas de una misma
// fila queden parejas aunque un control (el icono) sea más alto que un input.
export function Field({ label, children, grow = false, width }) {
  return (
    <label className={'fld' + (grow ? ' grow' : '')} style={width ? { width } : undefined}>
      <span>{label}</span>
      <div className="fld-control">{children}</div>
    </label>
  );
}
