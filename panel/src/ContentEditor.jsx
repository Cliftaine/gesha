import React, { useEffect, useState } from 'react';
import MenuEditor from './MenuEditor.jsx';
import PromoEditor from './PromoEditor.jsx';
import LayoutEditor from './LayoutEditor.jsx';
import { apiGet } from './api.js';
import { OptionCards } from './OptionCards.jsx';

// Contenido — todo lo que se muestra en las cartas, en un solo lugar:
// selector de carta (menús dinámicos + promociones), botón crear/eliminar,
// y dos pestañas: "Contenido" (datos) y "Diseño visual" (drag/resize).
// `mode` viene del menú lateral: 'cartas' o 'promociones' (cada uno su sección).
export default function ContentEditor({ mode = 'cartas' }) {
  const [menus, setMenus] = useState(null);
  const [sel, setSel] = useState(mode === 'promociones' ? 'promociones' : null);
  const [tab, setTab] = useState('contenido');
  const [creating, setCreating] = useState(null); // formulario de nueva carta

  const load = async (keepSel = true) => {
    const r = await apiGet('/menus');
    setMenus(r.menus);
    setSel((prev) => {
      if (mode === 'promociones') return 'promociones';
      if (keepSel && prev && r.menus.some((m) => m.id === prev)) return prev;
      return r.menus[0]?.id || null;
    });
  };

  const [templates, setTemplates] = useState([]); // para el formulario de nueva carta
  useEffect(() => {
    load().catch(() => {});
    apiGet('/theme/catalog').then((r) => setTemplates(r.templates)).catch(() => {});
  }, []);

  if (!menus) return <p>Cargando…</p>;

  const selMenu = menus.find((m) => m.id === sel) || null;
  const canvas = selMenu?.canvas === 'horizontal' ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };

  const createMenu = async (e) => {
    e.preventDefault();
    if (!creating.title.trim()) return;
    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creating),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || 'No se pudo crear');
    setCreating(null);
    await load(false);
    setSel(json.id);
    setTab('contenido');
  };

  const isPromos = sel === 'promociones';

  const deleteMenu = async () => {
    if (!selMenu) return;
    if (!confirm(`¿Eliminar la carta "${selMenu.title}" con todo su contenido? Las pantallas que la usen caerán a su carta por defecto.`)) return;
    const res = await fetch(`/api/menus/${sel}`, { method: 'DELETE' });
    if (!res.ok) return alert('No se pudo eliminar');
    await load(false);
  };

  return (
    <>
      <h1>{isPromos ? 'Promociones' : 'Cartas'}</h1>
      <p className="sub">
        {isPromos
          ? 'Slides de la pantalla de promociones: contenido y reglas en "Contenido", posición de zonas en "Diseño visual".'
          : 'Edita las cartas: diseño, platillos y precios en "Contenido"; posición y tamaño de zonas en "Diseño visual".'}
      </p>
      {!isPromos && (
        <div className="carta-cards" style={{ marginBottom: 14 }}>
          <OptionCards size="sm" value={sel} onChange={(v) => { setSel(v); setTab('contenido'); setCreating(null); }}
            options={menus.map((m) => ({
              id: m.id, label: m.title,
              hint: `${m.canvas === 'horizontal' ? 'Horizontal' : 'Vertical'} · ${m.resolution === '4k' ? '4K' : 'Full HD'}`,
              sketch: m.canvas === 'horizontal' ? 'o-horizontal' : 'o-vertical',
            }))}
            extra={
              <button type="button" className={'opt-card upload' + (creating ? ' on' : '')}
                onClick={() => setCreating(creating ? null : { title: '', template: 'clasica', canvas: 'vertical', columns: 2 })}>
                <span className="sk-img"><span className="plus">+</span></span>
                <strong>Crear carta</strong>
              </button>
            } />
        </div>
      )}
      <div className="row" style={{ marginBottom: 16 }}>
        {selMenu && menus.length > 1 && !creating && (
          <button className="danger small" onClick={deleteMenu}>✕ eliminar "{selMenu.title}"</button>
        )}
        <span className="grow" />
        <span className="tabs">
          <button className={tab === 'contenido' ? '' : 'ghost'} onClick={() => setTab('contenido')}>Contenido</button>
          <button className={tab === 'diseno' ? '' : 'ghost'} onClick={() => setTab('diseno')}>Diseño visual</button>
        </span>
      </div>
      {creating && (
        <form className="card new-carta" onSubmit={createMenu}>
          <h2>Nueva carta</h2>
          <input type="text" autoFocus placeholder='Nombre (ej. "Postres", "Temporada")' value={creating.title} style={{ width: 320, fontSize: 16 }}
            onChange={(e) => setCreating({ ...creating, title: e.target.value })} />
          <div className="opt-row" style={{ marginTop: 14 }}>
            <OptionCards label="Orientación" size="sm" value={creating.canvas}
              onChange={(v) => setCreating({ ...creating, canvas: v, columns: v === 'horizontal' ? 3 : 2 })}
              options={[
                { id: 'vertical', label: 'Vertical', hint: 'TV montada de pie', sketch: 'o-vertical' },
                { id: 'horizontal', label: 'Horizontal', hint: 'TV normal', sketch: 'o-horizontal' },
              ]} />
            <OptionCards label="Columnas" size="sm" value={creating.columns} onChange={(v) => setCreating({ ...creating, columns: v })}
              options={[
                { id: 2, label: '2 columnas', sketch: 'c-2' },
                { id: 3, label: '3 columnas', sketch: 'c-3' },
              ]} />
          </div>
          {[['base', 'Plantilla'], ['festiva', 'o una festiva / de temporada']].map(([group, title]) => (
            <React.Fragment key={group}>
              <h3>{title}</h3>
              <div className="tpl-grid mini">
                {templates.filter((t) => t.group === group).map((t) => (
                  <button key={t.id} type="button" title={t.description} className={'tpl-option' + (t.id === creating.template ? ' on' : '')}
                    onClick={() => setCreating({ ...creating, template: t.id })}>
                    <span className="tpl-swatch" style={{ background: t.swatch.bg }}>
                      {t.emoji && <span className="tpl-emoji">{t.emoji}</span>}
                      <span style={{ color: t.swatch.ink }}>Aa</span>
                      <i style={{ background: t.swatch.accent }} />
                    </span>
                    <strong>{t.label}</strong>
                  </button>
                ))}
              </div>
            </React.Fragment>
          ))}
          <div className="row" style={{ marginTop: 16 }}>
            <button type="submit" disabled={!creating.title.trim()}>Crear carta</button>
            <button type="button" className="ghost" onClick={() => setCreating(null)}>Cancelar</button>
            <span className="hint" style={{ margin: 0 }}>Todo se puede cambiar después en Diseño.</span>
          </div>
        </form>
      )}
      {tab === 'contenido' ? (
        sel === 'promociones'
          ? <PromoEditor embedded />
          : <MenuEditor key={sel} menuId={sel} onMeta={() => load()} />
      ) : (
        <LayoutEditor key={sel + '-layout'} cartaId={sel} canvas={sel === 'promociones' ? { w: 1080, h: 1920 } : canvas} />
      )}
    </>
  );
}
