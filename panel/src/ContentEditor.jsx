import React, { useEffect, useState } from 'react';
import MenuEditor from './MenuEditor.jsx';
import PromoEditor from './PromoEditor.jsx';
import LayoutEditor from './LayoutEditor.jsx';
import { apiGet } from './api.js';

// Contenido — todo lo que se muestra en las cartas, en un solo lugar:
// selector de carta (menús dinámicos + promociones), botón crear/eliminar,
// y dos pestañas: "Contenido" (datos) y "Diseño visual" (drag/resize).
export default function ContentEditor() {
  const [menus, setMenus] = useState(null);
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState('contenido');

  const load = async (keepSel = true) => {
    const r = await apiGet('/menus');
    setMenus(r.menus);
    setSel((prev) => {
      if (keepSel && prev && (prev === 'promociones' || r.menus.some((m) => m.id === prev))) return prev;
      return r.menus[0]?.id || 'promociones';
    });
  };

  useEffect(() => { load().catch(() => {}); }, []);

  if (!menus) return <p>Cargando…</p>;

  const selMenu = menus.find((m) => m.id === sel) || null;
  const canvas = selMenu?.canvas === 'horizontal' ? { w: 1920, h: 1080 } : { w: 1080, h: 1920 };

  const createMenu = async () => {
    const title = prompt('Nombre de la nueva carta (ej. "Postres", "Temporada"):');
    if (!title) return;
    const res = await fetch('/api/menus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error || 'No se pudo crear');
    await load(false);
    setSel(json.id);
    setTab('contenido');
  };

  const deleteMenu = async () => {
    if (!selMenu) return;
    if (!confirm(`¿Eliminar la carta "${selMenu.title}" con todo su contenido? Las pantallas que la usen caerán a su carta por defecto.`)) return;
    const res = await fetch(`/api/menus/${sel}`, { method: 'DELETE' });
    if (!res.ok) return alert('No se pudo eliminar');
    await load(false);
  };

  return (
    <>
      <h1>Contenido</h1>
      <p className="sub">Edita las cartas: items y precios en "Contenido", posición y tamaño de zonas en "Diseño visual".</p>
      <div className="row" style={{ marginBottom: 16 }}>
        <select value={sel} onChange={(e) => { setSel(e.target.value); setTab('contenido'); }}>
          {menus.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          <option value="promociones">Promociones</option>
        </select>
        <button className="ghost" onClick={createMenu}>+ Crear menú</button>
        {selMenu && menus.length > 1 && (
          <button className="danger small" onClick={deleteMenu}>✕ eliminar carta</button>
        )}
        <span className="grow" />
        <span className="tabs">
          <button className={tab === 'contenido' ? '' : 'ghost'} onClick={() => setTab('contenido')}>Contenido</button>
          <button className={tab === 'diseno' ? '' : 'ghost'} onClick={() => setTab('diseno')}>Diseño visual</button>
        </span>
      </div>
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
