import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut, apiDelete, debounce, uploadImage, ConflictError } from './api.js';
import IconPicker from './IconPicker.jsx';
import DesignCard from './DesignCard.jsx';
import { OptionCards, ToggleCard, Field } from './OptionCards.jsx';

// Editor completo de menús: categorías (crear/mover/renombrar/iconos),
// items (precio único / por tamaño / variantes en 1-2 columnas), banners
// elegibles (Comida del día, Extras, fotos), canvas y animaciones/acentos.
// Recibe menuId del ContentEditor; onMeta avisa cambios de metadata (canvas).
export default function MenuEditor({ menuId, onMeta }) {
  const [menu, setMenu] = useState(null);
  const [status, setStatus] = useState('');
  const [overlap, setOverlap] = useState(false);

  // Detecta si las columnas se enciman con los banners absolutos de abajo.
  const checkOverlap = (e) => {
    try {
      const doc = e.target.contentDocument;
      const banners = ['featured', 'extras', 'image-strip', 'wordmark']
        .map((z) => doc.querySelector(`[data-zone="${z}"]`))
        .filter(Boolean);
      if (!banners.length) return setOverlap(false);
      const bannerTop = Math.min(...banners.map((b) => b.getBoundingClientRect().top));
      const cols = [...doc.querySelectorAll('[data-zone^="col-"]')];
      const colBottom = Math.max(0, ...cols.map((c) => c.getBoundingClientRect().bottom));
      setOverlap(colBottom > bannerTop + 4);
    } catch {
      setOverlap(false);
    }
  };

  // Tres copias: `published` (lo que ven las pantallas), `saved` (borrador
  // guardado o, si no hay, lo publicado) y `menu` (lo que se está editando).
  // Nada llega a las pantallas hasta "Aplicar".
  const [published, setPublished] = useState(null);
  const [saved, setSaved] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMenu(null);
    apiGet(`/menus/${menuId}`)
      .then((r) => { setPublished(r.data); setSaved(r.draft || r.data); setMenu(r.draft || r.data); })
      .catch((e) => setStatus(e.message));
  }, [menuId]);

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const unsaved = !!menu && !same(menu, saved); // cambios sin guardar como borrador
  const pending = !!menu && !same(menu, published); // diferencias contra lo publicado

  // Vista previa de lo que se está editando (sin guardar nada).
  const renderPreview = useMemo(() => debounce(async (data) => {
    try {
      const res = await fetch(`/api/preview/menu/${menuId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (res.ok) setPreviewHtml(await res.text());
    } catch { /* la vista previa es best-effort */ }
  }, 350), [menuId]);
  useEffect(() => { if (menu) renderPreview(menu); }, [menu]);

  // Aviso al cerrar/recargar con cambios sin guardar.
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [unsaved]);

  const flash = (msg) => { setStatus(msg); setTimeout(() => setStatus(''), 2500); };
  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) {
      if (e instanceof ConflictError && confirm(e.message)) location.reload();
      else setStatus(e.message);
    } finally { setBusy(false); }
  };

  const apply = () => run(async () => {
    await apiPut(`/menus/${menuId}`, menu); // publica y elimina el borrador
    setPublished(menu); setSaved(menu);
    onMeta?.();
    flash('Aplicado ✓ — las pantallas ya muestran esta versión');
  });
  const saveDraft = () => run(async () => {
    await apiPut(`/menus/${menuId}/draft`, menu);
    setSaved(menu);
    flash('Borrador guardado ✓ — las pantallas siguen igual');
  });
  const discard = () => {
    if (!confirm('¿Descartar todos los cambios y volver a la versión publicada?')) return;
    run(async () => {
      await apiDelete(`/menus/${menuId}/draft`);
      setSaved(published); setMenu(published);
      flash('Cambios descartados ✓');
    });
  };

  const update = (fn) => {
    setMenu((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  if (!menu) return <p>Cargando…</p>;

  const sized = (menu.sizes || []).length > 0;

  return (
    <>
      <p className="sub">
        Edita con calma: la vista previa te acompaña y las pantallas no cambian hasta que pulses <strong>Aplicar</strong>.
      </p>
      <div className="editor-split">
        <div className="grow">
          <DesignCard menu={menu} update={update} />
          <AnimationsCard menu={menu} update={update} />
          {menu.columns.map((column, ci) => (
            <div className="card" key={ci} style={{ background: 'transparent' }}>
              <h2>Columna {ci + 1}</h2>
              {column.map((catId, pos) => {
                const moveInColumn = (dir) =>
                  update((m) => {
                    const col = m.columns[ci];
                    const j = pos + dir;
                    if (j < 0 || j >= col.length) return;
                    [col[pos], col[j]] = [col[j], col[pos]];
                  });
                const switchColumn = () =>
                  update((m) => {
                    m.columns[ci].splice(pos, 1);
                    m.columns[(ci + 1) % m.columns.length].push(catId);
                  });
                const marker = menu.markers?.[catId];
                if (marker) {
                  return (
                    <MarkerCard
                      key={catId}
                      marker={marker}
                      onChange={(fn) => update((m) => fn(m.markers[catId]))}
                      onMove={moveInColumn}
                      onSwitchColumn={switchColumn}
                      onDelete={() =>
                        update((m) => {
                          delete m.markers[catId];
                          m.columns = m.columns.map((col) => col.filter((x) => x !== catId));
                        })
                      }
                    />
                  );
                }
                const cat = menu.categories[catId];
                if (!cat) return null;
                return (
                  <CategoryCard
                    key={catId}
                    catId={catId}
                    cat={cat}
                    menu={menu}
                    sized={sized}
                    update={update}
                    onMove={moveInColumn}
                    onSwitchColumn={switchColumn}
                    onDelete={() =>
                      confirm(`¿Eliminar la categoría "${cat.title}" con todos sus items?`) &&
                      update((m) => {
                        delete m.categories[catId];
                        m.columns = m.columns.map((col) => col.filter((x) => x !== catId));
                      })
                    }
                  />
                );
              })}
              <button
                className="ghost"
                onClick={() =>
                  update((m) => {
                    const id = 'cat-' + Date.now().toString(36);
                    m.categories[id] = {
                      title: 'Nueva categoría',
                      icon: 'accent-star',
                      boxed: false,
                      groups: [{ label: null, items: [] }],
                    };
                    m.columns[ci].push(id);
                  })
                }
              >
                + Nueva categoría
              </button>{' '}
              <button
                className="ghost"
                title="Bloque intermedio entre categorías: título de sección, divisor o nota"
                onClick={() =>
                  update((m) => {
                    const id = 'mk-' + Date.now().toString(36);
                    m.markers = m.markers || {};
                    m.markers[id] = { kind: 'titulo', title: 'Nueva sección', text: '', icon: null };
                    m.columns[ci].push(id);
                  })
                }
              >
                + Marcador
              </button>
            </div>
          ))}
          <BannersCard menu={menu} update={update} />
        </div>
        <aside className="preview-pane sticky">
          {(() => {
            const cw = menu.canvas === 'horizontal' ? 1920 : 1080;
            const ch = menu.canvas === 'horizontal' ? 1080 : 1920;
            const s = 270 / cw;
            return (
              <div className="preview-box" style={{ width: 270, height: Math.round(ch * s) }}>
                <iframe
                  srcDoc={previewHtml}
                  title="preview"
                  onLoad={checkOverlap}
                  style={{ width: cw, height: ch, transform: `scale(${s})` }}
                />
              </div>
            );
          })()}
          <p className="preview-state">
            {!pending
              ? <span className="pill ok">Publicada · sin cambios</span>
              : unsaved
                ? <span className="pill warn">Cambios sin guardar</span>
                : <span className="pill draft">Borrador guardado · sin aplicar</span>}
          </p>
          {overlap && (
            <p className="status-error" style={{ textAlign: 'center', fontSize: 12 }}>
              ⚠ El contenido se encima con los banners de abajo: quita items, achica un banner o ajusta zonas en Diseño visual.
            </p>
          )}
          <div className="preview-actions">
            <button disabled={busy || !pending} onClick={apply} title="Publica estos cambios en las pantallas">Aplicar</button>
            <button className="ghost" disabled={busy || !unsaved} onClick={saveDraft} title="Guarda para seguir después; las pantallas no cambian">Guardar borrador</button>
            <button className="danger" disabled={busy || !pending} onClick={discard} title="Vuelve a la versión publicada">Descartar</button>
          </div>
          <p className={status.includes('✓') ? 'status-saved' : 'status-error'} style={{ textAlign: 'center', minHeight: 18 }}>{status}</p>
        </aside>
      </div>
    </>
  );
}

// Isotipos disponibles para la marca de la carta.
export const ISOTIPOS = [
  ['legacy', 'Clásica (PNG)'],
  ['mesa1', 'Silueta oscura'],
  ['03', 'Silueta café'],
  ['02', 'Blanca texturizada'],
  ['04', 'Óxido texturizada'],
];

// Isotipo de Manta + "Manta viva", como tarjetas (lo usa la rotación de promos).
export function MarkControls({ value, onChange }) {
  const mark = value || { isotipo: 'legacy', live: false };
  return (
    <div className="opt-row">
      <OptionCards label="Isotipo" size="xs" value={mark.isotipo || 'legacy'} onChange={(v) => onChange({ ...mark, isotipo: v })}
        options={ISOTIPOS.map(([id, label]) => ({
          id, label,
          img: id === 'legacy' ? '/assets/manta-mark.png' : `/assets/isotipos/manta-${id}.svg`,
          dark: id === '02' || id === '04',
        }))} />
      <OptionCards label="Movimiento" size="xs" value={mark.live ? 'viva' : 'none'} onChange={(v) => onChange({ ...mark, live: v === 'viva' })}
        options={[
          { id: 'none', label: 'Quieto', sketch: 'l-none' },
          { id: 'viva', label: 'Manta viva 🌊', sketch: 'l-viva' },
        ]} />
    </div>
  );
}

// ── Animaciones ─────────────────────────────────────────────────────────────
const REPLAY_PRESETS = [0, 30, 60, 120];

function AnimationsCard({ menu, update }) {
  const a = menu.animations || {};
  const set = (patch) => update((m) => { m.animations = { ...(m.animations || {}), ...patch }; });
  const replay = a.replaySeconds || 0;
  const custom = !REPLAY_PRESETS.includes(replay);
  return (
    <div className="card">
      <h2>Animaciones</h2>
      <div className="opt-row">
        <OptionCards label="Entrada del título" size="sm" value={a.title && a.title !== 'none' ? a.title : 'none'} onChange={(v) => set({ title: v })}
          options={[
            { id: 'none', label: 'Sin animación', sketch: 'e-none' },
            { id: 'typewriter', label: 'Máquina de escribir', sketch: 'a-type' },
            { id: 'fade', label: 'Desvanecer', sketch: 'e-fade' },
            { id: 'tracking', label: 'Espaciado', sketch: 'e-track' },
            { id: 'blur', label: 'Desenfoque', sketch: 'e-blur' },
            { id: 'drop', label: 'Caer', sketch: 'e-drop' },
          ]} />
      </div>
      <div className="opt-row" style={{ marginTop: 14 }}>
        <OptionCards label="Título en loop" size="sm" value={a.titleLoop || 'none'} onChange={(v) => set({ titleLoop: v })}
          options={[
            { id: 'none', label: 'Quieto', sketch: 'e-none' },
            { id: 'respirar', label: 'Respirar', sketch: 't-respirar' },
            { id: 'flotar', label: 'Flotar', sketch: 't-flotar' },
            { id: 'brillo', label: 'Resplandor', sketch: 't-brillo' },
            { id: 'latido', label: 'Latido', sketch: 't-latido' },
          ]} />
      </div>
      <div className="opt-row" style={{ marginTop: 14 }}>
        <OptionCards label="Entrada del contenido" size="sm" value={a.entrance && a.entrance !== 'none' ? a.entrance : 'none'} onChange={(v) => set({ entrance: v })}
          options={[
            { id: 'none', label: 'Sin animación', sketch: 'c-none' },
            { id: 'fade-up', label: 'Subir', sketch: 'a-fade' },
            { id: 'fade', label: 'Desvanecer', sketch: 'c-fade' },
            { id: 'slide', label: 'Deslizar', sketch: 'c-slide' },
            { id: 'zoom', label: 'Acercar', sketch: 'c-zoom' },
            { id: 'blur', label: 'Desenfoque', sketch: 'c-blur' },
          ]} />
      </div>
      <div className="opt-row" style={{ marginTop: 14 }}>
        <OptionCards label="Acento ✨ (en loop)" size="sm" value={a.accentStyle || 'pulse'} onChange={(v) => set({ accentStyle: v })}
          options={[
            { id: 'pulse', label: 'Pulso', sketch: 'a-pulse' },
            { id: 'shimmer', label: 'Brillo', sketch: 'a-shimmer' },
            { id: 'resplandor', label: 'Resplandor', sketch: 'a-glow' },
            { id: 'subrayado', label: 'Subrayado', sketch: 'a-under' },
          ]} />
      </div>
      <div className="opt-row" style={{ marginTop: 14 }}>
        <OptionCards label="Repetir las entradas" size="sm" value={custom ? 'custom' : replay}
          onChange={(v) => set({ replaySeconds: v })}
          options={[
            { id: 0, label: 'Solo al cargar', node: <span className="sk-time">1×</span> },
            { id: 30, label: 'Cada 30 s', node: <span className="sk-time">30s</span> },
            { id: 60, label: 'Cada minuto', node: <span className="sk-time">1m</span> },
            { id: 120, label: 'Cada 2 min', node: <span className="sk-time">2m</span> },
          ]}
          extra={
            <label className={'opt-card custom' + (custom ? ' on' : '')} title="Tiempo personalizado en segundos">
              <span className="sk-wrap">
                <input type="number" min="5" step="5" placeholder="seg" value={custom ? replay : ''}
                  onChange={(e) => set({ replaySeconds: Math.max(0, Number(e.target.value) || 0) })} />
              </span>
              <strong>Personalizado</strong>
            </label>
          } />
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 0' }}>
        Marca ✨ en items, categorías o banners para resaltarlos con el acento elegido. Los loops (título, acento y logos) corren siempre;
        "Repetir" vuelve a lanzar las animaciones de entrada.
      </p>
    </div>
  );
}

// ── Marcador (bloque intermedio entre categorías) ───────────────────────────
const MARKER_KINDS = [
  ['titulo', 'Título de sección', 'Abre un bloque nuevo'],
  ['divisor', 'Divisor', 'Separa sin ocupar alto'],
  ['nota', 'Nota en recuadro', 'Avisos: "pregunta por…"'],
];

function MarkerCard({ marker, onChange, onMove, onSwitchColumn, onDelete }) {
  return (
    <div className="card marker-card">
      <span className="fld-title">Opciones</span>
      <div className="ribbon">
        <span className="marker-tag">Marcador</span>
        <OptionCards size="mini" value={marker.kind || 'titulo'} onChange={(v) => onChange((k) => { k.kind = v; })}
          options={MARKER_KINDS.map(([id, label, hint]) => ({ id, label, hint, sketch: `m-${id}` }))} />
        <span className="ribbon-sep" />
        <ToggleCard size="mini" label="Icono" hint="Medallón del marcador" sketch="a-icons" checked={!!marker.icon}
          onChange={(v) => onChange((k) => { k.icon = v ? 'accent-star' : null; })} />
        <ToggleCard size="mini" label="Acento ✨" hint="Resalta el marcador con el efecto elegido" sketch="a-pulse" checked={!!marker.accent}
          onChange={(v) => onChange((k) => { k.accent = v; })} />
        <span className="grow" />
        <button className="ghost small" onClick={() => onMove(-1)}>↑</button>
        <button className="ghost small" onClick={() => onMove(1)}>↓</button>
        <button className="ghost small" title="Mover a la otra columna" onClick={onSwitchColumn}>⇄ columna</button>
        <button className="danger small" onClick={onDelete}>✕</button>
      </div>
      <div className="fields">
        {marker.icon && (
          <Field label="Icono">
            <IconPicker value={marker.icon} onChange={(icon) => onChange((k) => { k.icon = icon; })} />
          </Field>
        )}
        <Field label="Título" width={260}>
          <input type="text" value={marker.title || ''} style={{ fontWeight: 600 }}
            onChange={(e) => onChange((k) => { k.title = e.target.value; })} />
        </Field>
        {marker.kind !== 'divisor' && (
          <Field label="Texto (opcional)" grow>
            <input type="text" value={marker.text || ''} onChange={(e) => onChange((k) => { k.text = e.target.value; })} />
          </Field>
        )}
      </div>
    </div>
  );
}

// ── Categoría ───────────────────────────────────────────────────────────────
function CategoryCard({ catId, cat, menu, sized, update, onMove, onSwitchColumn, onDelete }) {
  const sizeIds = cat.legendSizes || (menu.sizes || []).map((s) => s.id);
  const mut = (fn) => update((m) => fn(m.categories[catId]));
  return (
    <div className="card">
      <span className="fld-title">Opciones</span>
      <div className="ribbon">
        <div className="opt-cards mini">
          <ToggleCard size="mini" label="Icono" hint="Medallón junto al título" sketch="a-icons" checked={cat.showIcon !== false}
            onChange={(v) => mut((c) => { if (v) delete c.showIcon; else c.showIcon = false; })} />
          <ToggleCard size="mini" label="Recuadro" hint='Enmarca la categoría (estilo "Especiales")' sketch="k-recuadro" checked={!!cat.boxed}
            onChange={(v) => mut((c) => { c.boxed = v; })} />
          <ToggleCard size="mini" label="Acento ✨" hint="Resalta toda la categoría con el efecto elegido" sketch="a-pulse" checked={!!cat.accent}
            onChange={(v) => mut((c) => { c.accent = v; })} />
          <ToggleCard size="mini" label="Precios" hint="Muestra los precios de esta categoría" sketch="k-precios" checked={cat.show?.price !== false}
            onChange={(v) => mut((c) => { c.show = { ...(c.show || {}), price: v }; })} />
          <ToggleCard size="mini" label="Descripciones" hint="Una breve descripción debajo de cada platillo" sketch="k-desc" checked={!!cat.show?.description}
            onChange={(v) => mut((c) => { c.show = { ...(c.show || {}), description: v }; })} />
        </div>
        <span className="grow" />
        <button className="ghost small" onClick={() => onMove(-1)}>↑</button>
        <button className="ghost small" onClick={() => onMove(1)}>↓</button>
        <button className="ghost small" title="Mover a la otra columna" onClick={onSwitchColumn}>⇄ columna</button>
        <button className="danger small" onClick={onDelete}>✕</button>
      </div>
      <div className="fields">
        {cat.showIcon !== false && (
          <Field label="Icono">
            <IconPicker value={cat.icon} onChange={(icon) => mut((c) => { c.icon = icon; })} />
          </Field>
        )}
        <Field label="Nombre de la categoría" width={300}>
          <input type="text" value={cat.title} style={{ fontWeight: 600 }}
            onChange={(e) => mut((c) => { c.title = e.target.value; })} />
        </Field>
      </div>
      {cat.groups.map((group, gi) => (
        <div key={gi}>
          <div className="fields" style={{ margin: '12px 0 6px' }}>
            <Field label="Sub-sección (opcional)" width={240}>
              <input type="text" placeholder="ej. Café, Frutales…" value={group.label || ''}
                onChange={(e) => mut((c) => { c.groups[gi].label = e.target.value || null; })} />
            </Field>
            {cat.groups.length > 1 && (
              <button className="danger small"
                onClick={() => confirm('¿Eliminar este grupo y sus items?') && mut((c) => c.groups.splice(gi, 1))}>
                ✕ grupo
              </button>
            )}
          </div>
          <div className="items">
              {group.items.map((item, ii) => (
                <ItemRow
                  key={ii}
                  item={item}
                  sizeIds={sizeIds}
                  sized={sized}
                  showDescription={!!cat.show?.description}
                  onChange={(fn) => mut((c) => fn(c.groups[gi].items[ii]))}
                  onReplace={(next) => mut((c) => { c.groups[gi].items[ii] = next; })}
                  onDelete={() => mut((c) => c.groups[gi].items.splice(ii, 1))}
                  onMove={(dir) => mut((c) => {
                    const items = c.groups[gi].items;
                    const j = ii + dir;
                    if (j < 0 || j >= items.length) return;
                    [items[ii], items[j]] = [items[j], items[ii]];
                  })}
                />
              ))}
          </div>
          <button className="ghost small" style={{ marginTop: 6 }}
            onClick={() => mut((c) => c.groups[gi].items.push(sized ? { name: 'Nuevo item', prices: {} } : { name: 'Nuevo item', price: 0 }))}>
            + Item
          </button>
        </div>
      ))}
      <button className="ghost small" style={{ marginTop: 8 }}
        onClick={() => mut((c) => c.groups.push({ label: 'Sub-sección', items: [] }))}>
        + Grupo
      </button>
    </div>
  );
}

// ── Item: tipo convertible (único / por tamaño / variantes 1-2 col) ────────
function itemType(item) {
  if (item.variants) return 'variants';
  if (item.prices) return 'sized';
  return 'simple';
}

function convertItem(item, type, sizeIds) {
  const base = { name: item.name };
  for (const k of ['qualifier', 'note', 'flavors', 'description']) if (item[k]) base[k] = item[k];
  if (item.accent) base.accent = true;
  const firstPrice = item.price ?? Object.values(item.prices || {})[0] ?? item.variants?.[0]?.price ?? 0;
  if (type === 'simple') base.price = firstPrice;
  if (type === 'sized') base.prices = item.prices || { [sizeIds[0]]: firstPrice };
  if (type === 'variants') {
    base.variants = item.variants || [{ name: 'Variante', price: firstPrice }];
    base.variantCols = item.variantCols ?? 2;
  }
  return base;
}

// Un platillo: primero la cinta de modos (cómo se cobra, acento) y debajo los
// campos a llenar, cada uno con su etiqueta.
function ItemRow({ item, sizeIds, sized, showDescription, onChange, onReplace, onDelete, onMove }) {
  const type = itemType(item);
  const noteField = item.flavors !== undefined ? 'flavors' : item.qualifier !== undefined && item.note === undefined ? 'qualifier' : 'note';
  return (
    <div className="item-block">
      <span className="fld-title">Opciones</span>
      <div className="ribbon">
        <OptionCards size="mini" value={type} onChange={(v) => onReplace(convertItem(item, v, sizeIds))}
          options={[
            { id: 'simple', label: 'Precio único', hint: 'Un solo precio', sketch: 'p-simple' },
            ...(sized ? [{ id: 'sized', label: 'Por tamaño', hint: 'Un precio por tamaño (CH/G)', sketch: 'p-sized' }] : []),
            { id: 'variants', label: 'Variantes', hint: 'Varias opciones, cada una con su precio', sketch: 'p-variants' },
          ]} />
        {type === 'variants' && (
          <>
            <span className="ribbon-sep" />
            <OptionCards size="mini" value={item.variantCols === 1 ? 1 : 2} onChange={(v) => onChange((it) => { it.variantCols = v; })}
              options={[
                { id: 2, label: '2 columnas', hint: 'Variantes en dos columnas: ahorra alto', sketch: 'v-2' },
                { id: 1, label: '1 columna', hint: 'Una variante por renglón: para nombres largos', sketch: 'v-1' },
              ]} />
          </>
        )}
        <span className="ribbon-sep" />
        <ToggleCard size="mini" label="Acento ✨" hint="Resalta este platillo con el efecto elegido" sketch="a-pulse" checked={!!item.accent}
          onChange={(v) => onChange((it) => { if (v) it.accent = true; else delete it.accent; })} />
        <span className="grow" />
        <button className="ghost small" onClick={() => onMove(-1)}>↑</button>
        <button className="ghost small" onClick={() => onMove(1)}>↓</button>
        <button className="danger small" onClick={onDelete}>✕</button>
      </div>
      <div className="fields">
        <Field label="Nombre del platillo" width="30%">
          <input type="text" value={item.name} onChange={(e) => onChange((it) => { it.name = e.target.value; })} />
        </Field>
        {type === 'simple' && (
          <Field label="Precio ($)" width={100}>
            <input type="number" value={item.price ?? ''} onChange={(e) => onChange((it) => { it.price = Number(e.target.value); })} />
          </Field>
        )}
        {type === 'sized' && sizeIds.map((sid) => (
          <Field key={sid} label={`Precio ${sid} ($)`} width={100}>
            <input type="number" value={item.prices[sid] ?? ''}
              onChange={(e) => onChange((it) => {
                if (e.target.value === '') delete it.prices[sid];
                else it.prices[sid] = Number(e.target.value);
              })} />
          </Field>
        ))}
        <Field label={noteField === 'flavors' ? 'Sabores' : 'Nota (en cursiva)'} grow>
          <input type="text" value={item[noteField] || ''} placeholder="ej. 3 pz · Verdes o rojos · incluye papas"
            onChange={(e) => onChange((it) => {
              if (e.target.value === '') delete it[noteField];
              else it[noteField] = e.target.value;
            })} />
        </Field>
      </div>
      {showDescription && (
        <div className="fields">
          <Field label="Descripción breve" grow>
            <input type="text" value={item.description || ''} placeholder="ej. Con frijoles refritos, queso fresco y tortillas hechas a mano" maxLength={140}
              onChange={(e) => onChange((it) => {
                if (e.target.value === '') delete it.description;
                else it.description = e.target.value;
              })} />
          </Field>
        </div>
      )}
      {type === 'variants' && (
        <div className="variants">
          {item.variants.map((v, vi) => (
            <div className="fields" key={vi}>
              <Field label={vi === 0 ? 'Variante' : ''} width="30%">
                <input type="text" value={v.name} onChange={(e) => onChange((it) => { it.variants[vi].name = e.target.value; })} />
              </Field>
              <Field label={vi === 0 ? 'Precio ($)' : ''} width={100}>
                <input type="number" value={v.price} onChange={(e) => onChange((it) => { it.variants[vi].price = Number(e.target.value); })} />
              </Field>
              <button className="danger small" onClick={() => onChange((it) => it.variants.splice(vi, 1))}>✕</button>
            </div>
          ))}
          <button className="ghost small" onClick={() => onChange((it) => it.variants.push({ name: 'Nueva', price: 0 }))}>
            + Variante
          </button>
        </div>
      )}
    </div>
  );
}

// ── Banners elegibles ───────────────────────────────────────────────────────
function stripSlots(strip) {
  return Array.isArray(strip) ? strip : strip?.slots || [];
}

function BannersCard({ menu, update }) {
  return (
    <div className="card">
      <h2>Banners</h2>
      <FeaturedEditor menu={menu} update={update} />
      <ExtrasEditor menu={menu} update={update} />
      <StripEditor menu={menu} update={update} />
    </div>
  );
}

function BannerHeader({ label, obj, onToggle, onAccent, onAdd, onRemove }) {
  if (!obj) {
    return (
      <div className="row" style={{ marginBottom: 8 }}>
        <strong style={{ width: 170 }}>{label}</strong>
        <button className="ghost small" onClick={onAdd}>+ Agregar banner</button>
      </div>
    );
  }
  return (
    <div className="row" style={{ marginBottom: 8 }}>
      <strong style={{ width: 150 }}>{label}</strong>
      <ToggleCard size="mini" label="Visible" hint="Muestra u oculta el banner sin borrarlo" sketch="k-visible" checked={obj.enabled !== false} onChange={onToggle} />
      <ToggleCard size="mini" label="Acento ✨" hint="Resalta el banner con el efecto elegido" sketch="a-pulse" checked={!!obj.accent} onChange={onAccent} />
      <span className="grow" />
      <button className="danger small" onClick={onRemove}>quitar del menú</button>
    </div>
  );
}

function FeaturedEditor({ menu, update }) {
  const f = menu.featured;
  return (
    <div style={{ borderTop: '1px solid var(--accent-soft)', paddingTop: 10, marginBottom: 12 }}>
      <BannerHeader
        label="Comida del día"
        obj={f}
        onToggle={(v) => update((m) => { m.featured.enabled = v; })}
        onAccent={(v) => update((m) => { m.featured.accent = v; })}
        onAdd={() => update((m) => {
          m.featured = {
            enabled: true, title: 'Comida del día', price: 110, label: 'Incluye',
            includes: ['Sopa o consomé', 'Arroz o pasta', 'Guisado', 'Guarnición', 'Postre', 'Agua'],
            footnote: '', liveGuisado: false,
          };
        })}
        onRemove={() => confirm('¿Quitar el banner de este menú?') && update((m) => { m.featured = null; })}
      />
      {f && (
        <>
          <div style={{ marginBottom: 10 }}>
            <OptionCards label="Tamaño del banner" size="sm" value={f.size || 'grande'}
              onChange={(v) => update((m) => { if (v === 'grande') delete m.featured.size; else m.featured.size = v; })}
              options={[
                { id: 'grande', label: 'Grande', node: <span className="sk-banner g" /> },
                { id: 'mediano', label: 'Mediano', node: <span className="sk-banner m" /> },
                { id: 'compacto', label: 'Compacto', node: <span className="sk-banner c" /> },
              ]}
              extra={<ToggleCard size="mini" label="Guisado en vivo" hint="Muestra el guisado de hoy desde el servicio de comida" sketch="k-live"
                checked={!!f.liveGuisado} onChange={(v) => update((m) => { m.featured.liveGuisado = v; })} />} />
          </div>
          <div className="fields" style={{ marginBottom: 8 }}>
            <Field label="Título del banner" width={220}>
              <input type="text" value={f.title} onChange={(e) => update((m) => { m.featured.title = e.target.value; })} />
            </Field>
            <Field label="Precio ($)" width={100}>
              <input type="number" value={f.price} onChange={(e) => update((m) => { m.featured.price = Number(e.target.value); })} />
            </Field>
            <Field label='Etiqueta ("Incluye")' width={130}>
              <input type="text" value={f.label} onChange={(e) => update((m) => { m.featured.label = e.target.value; })} />
            </Field>
            <Field label="Nota al pie" grow>
              <input type="text" value={f.footnote} onChange={(e) => update((m) => { m.featured.footnote = e.target.value; })} />
            </Field>
          </div>
          <span className="fld-title">Qué incluye</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {f.includes.map((inc, i) => (
              <span key={i} className="row" style={{ gap: 2 }}>
                <input type="text" value={inc} style={{ width: 150 }}
                  onChange={(e) => update((m) => { m.featured.includes[i] = e.target.value; })} />
                <button className="danger small" onClick={() => update((m) => m.featured.includes.splice(i, 1))}>✕</button>
              </span>
            ))}
            <button className="ghost small" onClick={() => update((m) => m.featured.includes.push('Nuevo'))}>+ incluye</button>
          </div>
        </>
      )}
    </div>
  );
}

function ExtrasEditor({ menu, update }) {
  const ex = menu.extras;
  return (
    <div style={{ borderTop: '1px solid var(--accent-soft)', paddingTop: 10, marginBottom: 12 }}>
      <BannerHeader
        label="Extras"
        obj={ex}
        onToggle={(v) => update((m) => { m.extras.enabled = v; })}
        onAccent={(v) => update((m) => { m.extras.accent = v; })}
        onAdd={() => update((m) => {
          m.extras = { enabled: true, title: 'Extras', price: 13, unit: 'c/u', items: [] };
        })}
        onRemove={() => confirm('¿Quitar el banner de este menú?') && update((m) => { m.extras = null; })}
      />
      {ex && (
        <>
          <div className="fields" style={{ marginBottom: 8 }}>
            <Field label="Título del banner" width={180}>
              <input type="text" value={ex.title} onChange={(e) => update((m) => { m.extras.title = e.target.value; })} />
            </Field>
            <Field label="Precio extra (+$)" width={120}>
              <input type="number" value={ex.price} onChange={(e) => update((m) => { m.extras.price = Number(e.target.value); })} />
            </Field>
            <Field label='Unidad ("c/u")' width={110}>
              <input type="text" value={ex.unit} onChange={(e) => update((m) => { m.extras.unit = e.target.value; })} />
            </Field>
          </div>
          <span className="fld-title">Extras (icono + nombre)</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            {ex.items.map((it, i) => (
              <span key={i} className="row" style={{ gap: 3 }}>
                <IconPicker value={it.icon} size={24} onChange={(icon) => update((m) => { m.extras.items[i].icon = icon; })} />
                <input type="text" value={it.label} style={{ width: 130 }}
                  onChange={(e) => update((m) => { m.extras.items[i].label = e.target.value; })} />
                <button className="danger small" onClick={() => update((m) => m.extras.items.splice(i, 1))}>✕</button>
              </span>
            ))}
            <button className="ghost small"
              onClick={() => update((m) => m.extras.items.push({ icon: 'accent-star', label: 'Nuevo' }))}>
              + extra
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StripEditor({ menu, update }) {
  const strip = menu.imageStrip;
  const slots = stripSlots(strip);
  // Normaliza el formato legacy (array) a { enabled, slots } al editar.
  const mutStrip = (fn) => update((m) => {
    if (Array.isArray(m.imageStrip)) m.imageStrip = { enabled: true, slots: m.imageStrip };
    fn(m.imageStrip);
  });
  const onFile = async (i, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      mutStrip((s) => { s.slots[i].src = url; });
    } catch (err) {
      alert(err.message);
    }
  };
  return (
    <div style={{ borderTop: '1px solid var(--accent-soft)', paddingTop: 10 }}>
      <BannerHeader
        label="Strip de fotos"
        obj={strip && !Array.isArray(strip) ? strip : strip ? { enabled: true } : null}
        onToggle={(v) => mutStrip((s) => { s.enabled = v; })}
        onAccent={() => {}}
        onAdd={() => update((m) => {
          m.imageStrip = { enabled: true, slots: [{ id: 's1', src: null, placeholder: 'Foto producto' }] };
        })}
        onRemove={() => confirm('¿Quitar el strip de fotos?') && update((m) => { m.imageStrip = null; })}
      />
      {strip && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {slots.map((slot, i) => (
            <span key={i} className="row" style={{ gap: 3 }}>
              {slot.src
                ? <img src={slot.src} alt="" style={{ width: 44, height: 30, objectFit: 'cover', borderRadius: 6 }} />
                : <span style={{ fontSize: 11, color: 'var(--muted)' }}>vacío</span>}
              <input type="text" value={slot.placeholder || ''} placeholder="texto placeholder" style={{ width: 130 }}
                onChange={(e) => mutStrip((s) => { s.slots[i].placeholder = e.target.value; })} />
              <label className="ghost small" style={{ border: '1px solid var(--accent-soft)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                foto <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden onChange={(e) => onFile(i, e)} />
              </label>
              {slot.src && (
                <button className="ghost small" onClick={() => mutStrip((s) => { s.slots[i].src = null; })}>quitar foto</button>
              )}
              <button className="danger small" onClick={() => mutStrip((s) => s.slots.splice(i, 1))}>✕</button>
            </span>
          ))}
          <button className="ghost small"
            onClick={() => mutStrip((s) => s.slots.push({ id: 's' + Date.now().toString(36), src: null, placeholder: 'Foto' }))}>
            + slot
          </button>
        </div>
      )}
    </div>
  );
}
