import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut, debounce, uploadImage, ConflictError } from './api.js';
import IconPicker from './IconPicker.jsx';

// Editor completo de menús: categorías (crear/mover/renombrar/iconos),
// items (precio único / por tamaño / variantes en 1-2 columnas), banners
// elegibles (Comida del día, Extras, fotos) y animaciones/acentos.
export default function MenuEditor() {
  const [menuId, setMenuId] = useState('alimentos');
  const [menu, setMenu] = useState(null);
  const [status, setStatus] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
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

  useEffect(() => {
    setMenu(null);
    apiGet(`/menus/${menuId}`).then((r) => setMenu(r.data)).catch((e) => setStatus(e.message));
  }, [menuId]);

  const saveNow = async (data) => {
    try {
      await apiPut(`/menus/${menuId}`, data);
      setStatus('Guardado ✓');
      setPreviewKey((k) => k + 1);
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      if (e instanceof ConflictError && confirm(e.message)) location.reload();
      else setStatus(e.message);
    }
  };
  const saveDebounced = useMemo(() => debounce(saveNow, 800), [menuId]);

  const update = (fn) => {
    setMenu((prev) => {
      const next = structuredClone(prev);
      fn(next);
      setStatus('Guardando…');
      saveDebounced(next);
      return next;
    });
  };

  if (!menu) return <p>Cargando…</p>;

  const sized = (menu.sizes || []).length > 0;

  return (
    <>
      <h1>Menús y precios</h1>
      <p className="sub">
        Edición completa: categorías, items, banners y animaciones. Los cambios se guardan solos.
        {' '}<span className={status.includes('✓') ? 'status-saved' : 'status-error'}>{status}</span>
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <select value={menuId} onChange={(e) => setMenuId(e.target.value)}>
          <option value="alimentos">Alimentos</option>
          <option value="bebidas">Bebidas</option>
        </select>
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <AnimationsCard menu={menu} update={update} />
          {menu.columns.map((column, ci) => (
            <div className="card" key={ci} style={{ background: 'transparent' }}>
              <h2>Columna {ci + 1}</h2>
              {column.map((catId, pos) => {
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
                    onMove={(dir) =>
                      update((m) => {
                        const col = m.columns[ci];
                        const j = pos + dir;
                        if (j < 0 || j >= col.length) return;
                        [col[pos], col[j]] = [col[j], col[pos]];
                      })
                    }
                    onSwitchColumn={() =>
                      update((m) => {
                        m.columns[ci].splice(pos, 1);
                        m.columns[(ci + 1) % m.columns.length].push(catId);
                      })
                    }
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
              </button>
            </div>
          ))}
          <BannersCard menu={menu} update={update} />
        </div>
        <div className="preview-pane">
          <div className="preview-box">
            <iframe key={previewKey} src={`/carta/${menuId}`} title="preview" onLoad={checkOverlap} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Vista previa en vivo</p>
          {overlap && (
            <p className="status-error" style={{ textAlign: 'center', fontSize: 12 }}>
              ⚠ El contenido se encima con los banners de abajo: quita items, oculta un banner o ajusta zonas en el Editor visual.
            </p>
          )}
        </div>
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

export function MarkControls({ value, onChange }) {
  const mark = value || { isotipo: 'legacy', live: false };
  return (
    <>
      <span>Isotipo:</span>
      <select value={mark.isotipo || 'legacy'} onChange={(e) => onChange({ ...mark, isotipo: e.target.value })}>
        {ISOTIPOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
      <label title="La manta se deforma cada cierto tiempo, como si nadara">
        <input type="checkbox" checked={!!mark.live} onChange={(e) => onChange({ ...mark, live: e.target.checked })} />{' '}
        Manta viva 🌊
      </label>
    </>
  );
}

// ── Animaciones ─────────────────────────────────────────────────────────────
function AnimationsCard({ menu, update }) {
  const a = menu.animations || {};
  const set = (patch) => update((m) => { m.animations = { ...(m.animations || {}), ...patch }; });
  return (
    <div className="card">
      <h2>Animaciones</h2>
      <div className="row" style={{ marginBottom: 8 }}>
        <MarkControls value={menu.mark} onChange={(mark) => update((m) => { m.mark = mark; })} />
      </div>
      <div className="row">
        <label>
          <input type="checkbox" checked={a.title === 'typewriter'}
            onChange={(e) => set({ title: e.target.checked ? 'typewriter' : 'none' })} />{' '}
          Título máquina de escribir
        </label>
        <label>
          <input type="checkbox" checked={a.entrance === 'fade-up'}
            onChange={(e) => set({ entrance: e.target.checked ? 'fade-up' : 'none' })} />{' '}
          Entrada escalonada
        </label>
        <span>Estilo de acento ✨:</span>
        <select value={a.accentStyle || 'pulse'} onChange={(e) => set({ accentStyle: e.target.value })}>
          <option value="pulse">Pulso (anillo)</option>
          <option value="shimmer">Brillo (sheen)</option>
        </select>
        <span>Repetir cada</span>
        <input type="number" value={a.replaySeconds || 0} min="0"
          onChange={(e) => set({ replaySeconds: Number(e.target.value) })} />
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>seg (0 = solo al cargar)</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>
        Marca ✨ en items, categorías o banners para resaltarlos con el efecto elegido.
      </p>
    </div>
  );
}

// ── Categoría ───────────────────────────────────────────────────────────────
function CategoryCard({ catId, cat, menu, sized, update, onMove, onSwitchColumn, onDelete }) {
  const sizeIds = cat.legendSizes || (menu.sizes || []).map((s) => s.id);
  const mut = (fn) => update((m) => fn(m.categories[catId]));
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <IconPicker value={cat.icon} onChange={(icon) => mut((c) => { c.icon = icon; })} />
        <input type="text" value={cat.title} style={{ fontWeight: 600, width: 220 }}
          onChange={(e) => mut((c) => { c.title = e.target.value; })} />
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={!!cat.boxed} onChange={(e) => mut((c) => { c.boxed = e.target.checked; })} /> recuadro
        </label>
        <label style={{ fontSize: 12 }} title="Resaltar con efecto">
          <input type="checkbox" checked={!!cat.accent} onChange={(e) => mut((c) => { c.accent = e.target.checked; })} /> ✨
        </label>
        <span className="grow" />
        <button className="ghost small" onClick={() => onMove(-1)}>↑</button>
        <button className="ghost small" onClick={() => onMove(1)}>↓</button>
        <button className="ghost small" title="Mover a la otra columna" onClick={onSwitchColumn}>⇄ columna</button>
        <button className="danger small" onClick={onDelete}>✕</button>
      </div>
      {cat.groups.map((group, gi) => (
        <div key={gi}>
          <div className="row" style={{ margin: '10px 0 4px' }}>
          <input type="text" placeholder="(sub-sección opcional)" value={group.label || ''}
            style={{ fontSize: 12, width: 190 }}
            onChange={(e) => mut((c) => { c.groups[gi].label = e.target.value || null; })} />
            {cat.groups.length > 1 && (
              <button className="danger small"
                onClick={() => confirm('¿Eliminar este grupo y sus items?') && mut((c) => c.groups.splice(gi, 1))}>
                ✕ grupo
              </button>
            )}
          </div>
          <table>
            <tbody>
              {group.items.map((item, ii) => (
                <ItemRow
                  key={ii}
                  item={item}
                  sizeIds={sizeIds}
                  sized={sized}
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
            </tbody>
          </table>
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
  for (const k of ['qualifier', 'note', 'flavors']) if (item[k]) base[k] = item[k];
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

function ItemRow({ item, sizeIds, sized, onChange, onReplace, onDelete, onMove }) {
  const type = itemType(item);
  return (
    <>
      <tr>
        <td style={{ width: '34%' }}>
          <input type="text" value={item.name} onChange={(e) => onChange((it) => { it.name = e.target.value; })} />
        </td>
        <td style={{ width: 120 }}>
          <select value={type} onChange={(e) => onReplace(convertItem(item, e.target.value, sizeIds))} style={{ fontSize: 12 }}>
            <option value="simple">precio único</option>
            {sized && <option value="sized">por tamaño</option>}
            <option value="variants">variantes</option>
          </select>
        </td>
        {type === 'variants' ? (
          <td style={{ width: 150 }}>
            <select value={item.variantCols === 1 ? 1 : 2} style={{ fontSize: 12 }}
              onChange={(e) => onChange((it) => { it.variantCols = Number(e.target.value); })}>
              <option value={2}>2 columnas</option>
              <option value={1}>1 columna</option>
            </select>
          </td>
        ) : type === 'sized' ? (
          <td style={{ width: 150 }}>
            <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              {sizeIds.map((sid) => (
                <input key={sid} type="number" value={item.prices[sid] ?? ''} placeholder={sid} style={{ width: 62 }}
                  onChange={(e) => onChange((it) => {
                    if (e.target.value === '') delete it.prices[sid];
                    else it.prices[sid] = Number(e.target.value);
                  })} />
              ))}
            </span>
          </td>
        ) : (
          <td style={{ width: 150 }}>
            <input type="number" value={item.price ?? ''}
              onChange={(e) => onChange((it) => { it.price = Number(e.target.value); })} />
          </td>
        )}
        <td>
          <input type="text" value={item.note || item.flavors || item.qualifier || ''} placeholder="nota / sabores"
            onChange={(e) => onChange((it) => {
              const field = it.flavors !== undefined ? 'flavors' : it.qualifier !== undefined && it.note === undefined ? 'qualifier' : 'note';
              if (e.target.value === '') delete it[field];
              else it[field] = e.target.value;
            })} />
        </td>
        <td style={{ width: 130, whiteSpace: 'nowrap' }}>
          <label title="Resaltar con efecto" style={{ fontSize: 12, marginRight: 4 }}>
            <input type="checkbox" checked={!!item.accent}
              onChange={(e) => onChange((it) => { if (e.target.checked) it.accent = true; else delete it.accent; })} /> ✨
          </label>
          <button className="ghost small" onClick={() => onMove(-1)}>↑</button>
          <button className="ghost small" onClick={() => onMove(1)}>↓</button>
          <button className="danger small" onClick={onDelete}>✕</button>
        </td>
      </tr>
      {type === 'variants' &&
        item.variants.map((v, vi) => (
          <tr key={vi}>
            <td style={{ paddingLeft: 26 }} colSpan={2}>
              <input type="text" value={v.name} onChange={(e) => onChange((it) => { it.variants[vi].name = e.target.value; })} />
            </td>
            <td>
              <input type="number" value={v.price} onChange={(e) => onChange((it) => { it.variants[vi].price = Number(e.target.value); })} />
            </td>
            <td></td>
            <td>
              <button className="danger small" onClick={() => onChange((it) => it.variants.splice(vi, 1))}>✕</button>
            </td>
          </tr>
        ))}
      {type === 'variants' && (
        <tr>
          <td colSpan={5} style={{ paddingLeft: 26 }}>
            <button className="ghost small" onClick={() => onChange((it) => it.variants.push({ name: 'Nueva', price: 0 }))}>
              + Variante
            </button>
          </td>
        </tr>
      )}
    </>
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
      <label style={{ width: 170 }}>
        <input type="checkbox" checked={obj.enabled !== false} onChange={(e) => onToggle(e.target.checked)} />{' '}
        <strong>{label}</strong>
      </label>
      <label title="Resaltar con efecto" style={{ fontSize: 12 }}>
        <input type="checkbox" checked={!!obj.accent} onChange={(e) => onAccent(e.target.checked)} /> ✨
      </label>
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
          <div className="row" style={{ marginBottom: 6 }}>
            <input type="text" value={f.title} style={{ width: 200 }}
              onChange={(e) => update((m) => { m.featured.title = e.target.value; })} />
            <span>$</span>
            <input type="number" value={f.price} onChange={(e) => update((m) => { m.featured.price = Number(e.target.value); })} />
            <input type="text" value={f.label} style={{ width: 110 }} title="Etiqueta del divisor"
              onChange={(e) => update((m) => { m.featured.label = e.target.value; })} />
            <input type="text" value={f.footnote} className="grow" placeholder="nota al pie"
              onChange={(e) => update((m) => { m.featured.footnote = e.target.value; })} />
            <label style={{ fontSize: 12 }} title="Mostrar el guisado de hoy desde el servicio de comida">
              <input type="checkbox" checked={!!f.liveGuisado}
                onChange={(e) => update((m) => { m.featured.liveGuisado = e.target.checked; })} /> guisado en vivo
            </label>
          </div>
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
          <div className="row" style={{ marginBottom: 6 }}>
            <input type="text" value={ex.title} style={{ width: 140 }}
              onChange={(e) => update((m) => { m.extras.title = e.target.value; })} />
            <span>+$</span>
            <input type="number" value={ex.price} onChange={(e) => update((m) => { m.extras.price = Number(e.target.value); })} />
            <input type="text" value={ex.unit} style={{ width: 70 }}
              onChange={(e) => update((m) => { m.extras.unit = e.target.value; })} />
          </div>
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
