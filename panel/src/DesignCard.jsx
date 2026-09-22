import React, { useEffect, useState } from 'react';
import { apiGet, apiDelete, uploadFile } from './api.js';
import { ISOTIPOS } from './MenuEditor.jsx';
import { OptionCards, ToggleCard, UploadCard } from './OptionCards.jsx';

// Diseño de la carta: plantilla (4), orientación, columnas (2-3), fondo,
// logo y tipografías por rol (fuente, tamaño, color). Lo subido va a una
// biblioteca compartida (data/library.json) reutilizable entre cartas.
export default function DesignCard({ menu, update }) {
  const [cat, setCat] = useState(null);
  const [error, setError] = useState('');

  const loadCatalog = () => apiGet('/theme/catalog').then(setCat).catch((e) => setError(e.message));
  useEffect(() => { loadCatalog(); }, []);

  // Migración: el formato anterior (theme.fonts.display/body) pasa a roles.
  useEffect(() => {
    if (!menu.theme?.fonts) return;
    update((m) => {
      const { display, body } = m.theme.fonts;
      const type = { ...(m.theme.type || {}) };
      const seed = (role, font) => { if (font && !type[role]?.font) type[role] = { ...(type[role] || {}), font }; };
      ['title', 'price', 'note'].forEach((r) => seed(r, display));
      ['category', 'item'].forEach((r) => seed(r, body));
      delete m.theme.fonts;
      if (Object.keys(type).length) m.theme.type = type;
      if (!Object.keys(m.theme).length) delete m.theme;
    });
  }, [!!menu.theme?.fonts]);

  if (!cat) return <div className="card"><h2>Diseño</h2><p>{error || 'Cargando…'}</p></div>;

  const tplId = cat.templates.some((t) => t.id === menu.template) ? menu.template : 'clasica';
  const tpl = cat.templates.find((t) => t.id === tplId);
  const theme = menu.theme || {};
  const setTheme = (fn) => update((m) => {
    m.theme = m.theme || {};
    fn(m.theme);
    // Tema vacío ⇒ se quita: la carta clásica vuelve a su render original.
    for (const k of Object.keys(m.theme)) if (m.theme[k] == null) delete m.theme[k];
    if (!Object.keys(m.theme).length) delete m.theme;
  });

  const upload = async (kind, e, onDone) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setError('');
      const { entry } = await uploadFile(`/library/${kind}`, file);
      await loadCatalog();
      onDone(entry);
    } catch (err) {
      setError(err.message);
    }
  };

  const removeFromLibrary = async (kind, entry) => {
    if (!confirm(`¿Eliminar "${entry.name}" de la biblioteca? Las cartas que lo usen volverán al valor de su plantilla.`)) return;
    try {
      await apiDelete(`/library/${kind}/${entry.id}`);
      await loadCatalog();
    } catch (err) {
      setError(err.message);
    }
  };

  const setColumns = (n) => update((m) => {
    while (m.columns.length < n) m.columns.push([]);
    // Al reducir, lo que había en las columnas sobrantes pasa a la última.
    while (m.columns.length > n) {
      const extra = m.columns.pop();
      m.columns[m.columns.length - 1].push(...extra);
    }
  });

  const horizontal = menu.canvas === 'horizontal';
  const bg = theme.background || null;
  const bgIs = (kind, value) => (bg ? bg.kind === kind && bg.value === value : kind === 'preset' && value === tpl.background);

  return (
    <div className="card">
      <h2>Diseño</h2>
      {error && <p className="status-error">{error}</p>}

      {[['base', 'Plantillas base'], ['festiva', 'Plantillas festivas y de temporada']].map(([group, title]) => (
        <React.Fragment key={group}>
          <h3>{title}</h3>
          <div className="tpl-grid">
            {cat.templates.filter((t) => t.group === group).map((t) => (
              <button key={t.id} type="button" className={'tpl-option' + (t.id === tplId ? ' on' : '')}
                onClick={() => update((m) => { m.template = t.id; })}>
                <span className="tpl-swatch" style={{ background: t.swatch.bg }}>
                  {t.emoji && <span className="tpl-emoji">{t.emoji}</span>}
                  <span style={{ color: t.swatch.ink, fontFamily: cat.fonts.find((f) => f.id === (t.roleFonts.title || t.fonts.display))?.stack }}>Aa</span>
                  <i style={{ background: t.swatch.accent }} />
                </span>
                <strong>{t.label}</strong>
                <small>{t.description}</small>
              </button>
            ))}
          </div>
        </React.Fragment>
      ))}

      {tpl.particles && (
        <div className="opt-row" style={{ marginTop: 12 }}>
          <ToggleCard label={tpl.particles} hint="Partículas animadas detrás del contenido" sketch="a-fall"
            checked={theme.particles !== false}
            onChange={(v) => setTheme((t) => { t.particles = v ? null : false; })} />
        </div>
      )}

      <h3>Formato</h3>
      <div className="opt-row">
        <OptionCards label="Orientación" value={horizontal ? 'horizontal' : 'vertical'}
          onChange={(v) => update((m) => { m.canvas = v; })}
          options={[
            { id: 'vertical', label: 'Vertical', hint: menu.resolution === '4k' ? '2160×3840' : '1080×1920', sketch: 'o-vertical' },
            { id: 'horizontal', label: 'Horizontal', hint: menu.resolution === '4k' ? '3840×2160' : '1920×1080', sketch: 'o-horizontal' },
          ]} />
        <OptionCards label="Columnas" value={menu.columns.length >= 3 ? 3 : 2} onChange={setColumns}
          options={[
            { id: 2, label: '2 columnas', sketch: 'c-2', hint: 'Ideal en vertical' },
            { id: 3, label: '3 columnas', sketch: 'c-3', hint: 'Ideal en horizontal' },
          ]} />
        <OptionCards label="Resolución" value={menu.resolution === '4k' ? '4k' : '1080'}
          onChange={(v) => update((m) => { if (v === '4k') m.resolution = '4k'; else delete m.resolution; })}
          options={[
            { id: '1080', label: 'Full HD', hint: 'Nítida en cualquier TV', sketch: 'r-hd' },
            { id: '4k', label: '4K', hint: 'Solo si la TV es 4K nativa', sketch: 'r-4k' },
          ]} />
        <OptionCards label="Densidad" value={menu.dense ? 'dense' : 'wide'}
          onChange={(v) => update((m) => { m.dense = v === 'dense'; })}
          options={[
            { id: 'wide', label: 'Amplia', hint: 'Texto más grande', sketch: 'd-wide' },
            { id: 'dense', label: 'Compacta', hint: 'Caben más platillos', sketch: 'd-dense' },
          ]} />
      </div>
      <p className="hint">La rotación física de la TV se configura por pantalla.</p>

      <h3>Logos</h3>
      <div className="sub-card">
        <h4>Logo al inicio</h4>
      <div className="opt-row">
        <OptionCards label="Junto al título" size="sm"
          value={theme.logo?.hidden ? 'none' : theme.logo?.url || `iso:${menu.mark?.isotipo || 'legacy'}`}
          onChange={(v) => {
            if (v === 'none') return setTheme((t) => { t.logo = { hidden: true }; });
            if (v.startsWith('iso:')) {
              setTheme((t) => { t.logo = null; });
              update((m) => { m.mark = { ...(m.mark || { live: false }), isotipo: v.slice(4) }; });
            } else {
              setTheme((t) => { t.logo = { url: v, placement: t.logo?.placement || 'lados' }; });
            }
          }}
          options={[
            { id: 'none', label: 'Sin logo', node: <span className="sk-none" /> },
            ...ISOTIPOS.map(([id, label]) => ({
              id: `iso:${id}`, label,
              img: id === 'legacy' ? '/assets/manta-mark.png' : `/assets/isotipos/manta-${id}.svg`,
              dark: id === '02' || id === '04',
            })),
            ...cat.library.logos.map((l) => ({ id: l.url, label: l.name, img: l.url, onRemove: () => removeFromLibrary('logos', l) })),
          ]}
          extra={<UploadCard label="Subir logo" accept="image/png,image/svg+xml,image/webp,image/jpeg"
            onFile={(e) => upload('logos', e, (entry) => setTheme((t) => { t.logo = { url: entry.url, placement: 'lados' }; }))} />} />
      </div>
      {!theme.logo?.hidden && (
        <div className="opt-row" style={{ marginTop: 14 }}>
          {theme.logo?.url && (
            <OptionCards label="Colocación" size="sm" value={theme.logo.placement || 'lados'}
              onChange={(v) => setTheme((t) => { t.logo.placement = v; })}
              options={[
                { id: 'lados', label: 'A ambos lados', sketch: 'p-lados' },
                { id: 'izquierda', label: 'Solo izquierda', sketch: 'p-izquierda' },
              ]} />
          )}
          <OptionCards label="Animación del logo" size="sm"
            value={LOGO_ANIMS.some(([id]) => id === menu.mark?.anim) ? menu.mark.anim : menu.mark?.live ? 'viva' : 'none'}
            onChange={(v) => update((m) => {
              m.mark = { ...(m.mark || { isotipo: 'legacy' }), live: v === 'viva' };
              if (v === 'none' || v === 'viva') delete m.mark.anim; else m.mark.anim = v;
            })}
            options={[
              { id: 'none', label: 'Quieto', sketch: 'l-none' },
              ...(theme.logo?.url ? [] : [{ id: 'viva', label: 'Manta viva 🌊', hint: 'Se deforma como si nadara', sketch: 'l-viva' }]),
              ...LOGO_ANIMS.map(([id, label]) => ({ id, label, sketch: `l-${id}` })),
            ]} />
        </div>
      )}

        <h4>Logo al pie</h4>
      <div className="opt-row">
        <OptionCards label="Logotipo" size="sm" value={theme.wordmark?.hidden ? 'none' : theme.wordmark?.url || ''}
          onChange={(v) => setTheme((t) => { t.wordmark = v === 'none' ? { hidden: true } : v ? { url: v } : null; })}
          options={[
            { id: 'none', label: 'Sin logo', node: <span className="sk-none" /> },
            { id: '', label: 'Manta Café', img: '/assets/wordmark-trim.png' },
            ...cat.library.logos.map((l) => ({ id: l.url, label: l.name, img: l.url, onRemove: () => removeFromLibrary('logos', l) })),
          ]}
          extra={<UploadCard label="Subir logo" accept="image/png,image/svg+xml,image/webp,image/jpeg"
            onFile={(e) => upload('logos', e, (entry) => setTheme((t) => { t.wordmark = { url: entry.url }; }))} />} />
      </div>
      {!theme.wordmark?.hidden && (
        <div className="opt-row" style={{ marginTop: 14 }}>
          <OptionCards label="Animación del logo al pie" size="sm" value={theme.wordmarkAnim || 'none'}
            onChange={(v) => setTheme((t) => { t.wordmarkAnim = v === 'none' ? null : v; })}
            options={[
              { id: 'none', label: 'Quieto', sketch: 'l-none' },
              ...LOGO_ANIMS.map(([id, label]) => ({ id, label, sketch: `l-${id}` })),
            ]} />
        </div>
      )}
      </div>

      <h3>Distribución</h3>
      <div className="tpl-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {cat.layouts[menu.canvas === 'horizontal' ? 'horizontal' : 'vertical'].map((l) => {
          const current = cat.layouts[menu.canvas === 'horizontal' ? 'horizontal' : 'vertical'].some((x) => x.id === menu.layout) ? menu.layout : 'clasico';
          return (
            <button key={l.id} type="button" className={'tpl-option' + (l.id === current ? ' on' : '')}
              onClick={() => update((m) => { if (l.id === 'clasico') delete m.layout; else m.layout = l.id; })}>
              <LayoutSketch id={l.id} horizontal={menu.canvas === 'horizontal'} />
              <strong>{l.label}</strong>
              <small>{l.description}</small>
            </button>
          );
        })}
      </div>

      <h3>Fondo</h3>
      <div className="row swatches">
        {cat.backgrounds.map((b) => (
          <button key={b.id} type="button" title={b.label}
            className={'swatch' + (bgIs('preset', b.id) ? ' on' : '')} style={{ background: b.css }}
            onClick={() => setTheme((t) => { t.background = b.id === tpl.background ? null : { kind: 'preset', value: b.id }; })} />
        ))}
        {cat.library.backgrounds.map((b) => (
          <span key={b.id} className="swatch-wrap">
            <button type="button" title={b.name}
              className={'swatch' + (bgIs('image', b.url) ? ' on' : '')}
              style={{ backgroundImage: `url(${b.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
              onClick={() => setTheme((t) => { t.background = { kind: 'image', value: b.url }; })} />
            <button type="button" className="swatch-x" title="Eliminar de la biblioteca" onClick={() => removeFromLibrary('backgrounds', b)}>✕</button>
          </span>
        ))}
        <label className="file-btn">
          + subir fondo
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden
            onChange={(e) => upload('backgrounds', e, (entry) => setTheme((t) => { t.background = { kind: 'image', value: entry.url }; }))} />
        </label>
        <label className="row" style={{ gap: 4, fontSize: 12 }}>
          color
          <input type="color" value={bg?.kind === 'color' ? bg.value : '#f4efe6'}
            onChange={(e) => setTheme((t) => { t.background = { kind: 'color', value: e.target.value }; })} />
        </label>
        {bg && <button className="ghost small" onClick={() => setTheme((t) => { t.background = null; })}>usar el de la plantilla</button>}
      </div>
      <p className="hint">Fondo propio: imagen de {menu.canvas === 'horizontal' ? '1920×1080' : '1080×1920'} px, o el doble ({menu.canvas === 'horizontal' ? '3840×2160' : '2160×3840'}) para 4K. Se recorta para cubrir; hasta 25 MB.</p>

      <h3>Tipografías</h3>
      <div className="type-rows">
        {cat.roles.map((role) => (
          <TypeRow key={role.id} role={role} cat={cat} tpl={tpl}
            value={theme.type?.[role.id] || {}}
            onChange={(patch) => setTheme((t) => {
              const next = { ...(t.type?.[role.id] || {}), ...patch };
              for (const k of Object.keys(next)) if (next[k] == null || next[k] === '' || (k === 'size' && next[k] === 100)) delete next[k];
              t.type = { ...(t.type || {}) };
              if (Object.keys(next).length) t.type[role.id] = next;
              else delete t.type[role.id];
              if (!Object.keys(t.type).length) t.type = null;
            })}>
          </TypeRow>
        ))}
      </div>
      <div className="opt-row" style={{ marginTop: 12 }}>
        <ToggleCard label="Icono en títulos" hint="Medallón junto a cada categoría" sketch="a-icons"
          checked={!theme.hideCategoryIcons}
          onChange={(v) => setTheme((t) => { t.hideCategoryIcons = v ? null : true; })} />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <label className="file-btn">
          + subir tipografía
          <input type="file" accept=".woff2,.woff,.ttf,.otf" hidden onChange={(e) => upload('fonts', e, () => {})} />
        </label>
        {cat.library.fonts.map((f) => (
          <span key={f.id} className="lib-chip">{f.name} <a onClick={() => removeFromLibrary('fonts', f)}>✕</a></span>
        ))}
        <span className="hint" style={{ margin: 0 }}>.woff2 (recomendado), .woff, .ttf, .otf — al subirla aparece en los selectores.</span>
      </div>
    </div>
  );
}

// Animaciones en loop disponibles para los logos (espejo de LOGO_FX en menu.ejs).
const LOGO_ANIMS = [
  ['flotar', 'Flotar'],
  ['desvanecer', 'Desvanecer'],
  ['balanceo', 'Balanceo'],
  ['latido', 'Latido'],
  ['voltear', 'Voltear'],
];

// Croquis de una distribución: título (t), columnas (c), banner (b), logotipo (w).
function LayoutSketch({ id, horizontal }) {
  const key = (horizontal ? 'h-' : 'v-') + id;
  return <span className={'lay-sketch ' + key}><i className="t" /><i className="c" /><i className="b" /><i className="w" /></span>;
}

// Carga las Google Fonts del catálogo en el panel para poder mostrarlas.
let fontsLoaded = false;
function ensurePanelFonts(cat) {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${cat.fonts.map((f) => 'family=' + f.google).join('&')}&display=swap`;
  document.head.append(link);
  for (const f of cat.library.fonts) {
    const face = new FontFace(`U-${f.id}`, `url(${f.url})`);
    face.load().then((ff) => document.fonts.add(ff)).catch(() => {});
  }
}

// Selector de tipografía en tarjetas: cada opción se ve en su propia letra.
function FontPicker({ cat, fallback, value, sample, onChange }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { ensurePanelFonts(cat); }, []);
  const stackOf = (id) => (id.startsWith('lib:') ? `"U-${id.slice(4)}", sans-serif` : cat.fonts.find((f) => f.id === id)?.stack);
  const nameOf = (id) => (id.startsWith('lib:') ? cat.library.fonts.find((f) => f.id === id.slice(4))?.name : cat.fonts.find((f) => f.id === id)?.label);
  const Card = ({ id, label, hint }) => (
    <button type="button" className={'font-card' + (id === value ? ' on' : '')} onClick={() => { onChange(id); setOpen(false); }}>
      <span className="sample" style={{ fontFamily: stackOf(id || fallback.id) }}>{sample}</span>
      <small>{label}{hint ? ` · ${hint}` : ''}</small>
    </button>
  );
  return (
    <span className="font-pick">
      <button type="button" onClick={() => setOpen((o) => !o)}>
        <b style={{ fontFamily: stackOf(value || fallback.id) }}>{value ? nameOf(value) : fallback.label}</b>
        <small style={{ color: 'var(--muted)' }}>{value ? '▾' : 'plantilla ▾'}</small>
      </button>
      {open && (
        <div className="font-pop">
          <div className="font-grid"><Card id="" label={fallback.label} hint="la de la plantilla" /></div>
          <h4>Para títulos y precios</h4>
          <div className="font-grid">{cat.fonts.filter((f) => f.role === 'display').map((f) => <Card key={f.id} id={f.id} label={f.label} />)}</div>
          <h4>Para texto</h4>
          <div className="font-grid">{cat.fonts.filter((f) => f.role === 'body').map((f) => <Card key={f.id} id={f.id} label={f.label} />)}</div>
          {cat.library.fonts.length > 0 && (
            <>
              <h4>Subidas</h4>
              <div className="font-grid">{cat.library.fonts.map((f) => <Card key={f.id} id={`lib:${f.id}`} label={f.name} />)}</div>
            </>
          )}
        </div>
      )}
    </span>
  );
}

// Una fila por rol tipográfico: qué mueve · fuente · tamaño (con restablecer) · color.
function TypeRow({ role, cat, tpl, value, onChange, children }) {
  const fallback = cat.fonts.find((f) => f.id === tpl.fonts[role.family]);
  const size = value.size || 100;
  const step = (d) => onChange({ size: Math.min(200, Math.max(50, size + d)) });
  return (
    <div className="type-row">
      <div className="type-what">
        <strong>{role.label}</strong>
        <small>{role.hint}</small>
      </div>
      <FontPicker cat={cat} fallback={fallback} value={value.font || ''} sample={role.id === 'price' ? '$66' : role.id === 'note' ? 'con queso fresco' : 'Alimentos'} onChange={(v) => onChange({ font: v || null })} />
      <span className="type-size" title="Tamaño relativo al de la plantilla">
        <button type="button" className="ghost small" onClick={() => step(-5)}>−</button>
        <input type="number" min="50" max="200" step="5" value={size}
          onChange={(e) => onChange({ size: Number(e.target.value) || 100 })} />
        <span>%</span>
        <button type="button" className="ghost small" onClick={() => step(5)}>+</button>
        <button type="button" className="ghost small" disabled={size === 100} title="Restablecer tamaño" onClick={() => onChange({ size: null })}>↺</button>
      </span>
      <span className="type-color">
        <input type="color" value={value.color || tpl.colors[role.color]} title="Color del texto"
          onChange={(e) => onChange({ color: e.target.value })} />
        <button type="button" className="ghost small" disabled={!value.color} title="Volver al color de la plantilla" onClick={() => onChange({ color: null })}>↺</button>
      </span>
      <span className="type-extra">{children}</span>
    </div>
  );
}
