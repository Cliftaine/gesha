import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut, apiDelete, debounce, uploadImage, uploadFile, ConflictError } from './api.js';
import { MarkControls } from './MenuEditor.jsx';
import { OptionCards, ToggleCard, UploadCard, Field } from './OptionCards.jsx';

const DAYS = [
  ['mon', 'L'], ['tue', 'M'], ['wed', 'X'], ['thu', 'J'],
  ['fri', 'V'], ['sat', 'S'], ['sun', 'D'],
];

export default function PromoEditor() {
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState('');
  const [sim, setSim] = useState({ at: '' });
  const [simResult, setSimResult] = useState(null);
  const [packages, setPackages] = useState([]);

  const loadPackages = () => apiGet('/promo-packages').then((r) => setPackages(r.packages)).catch(() => {});
  const [logos, setLogos] = useState([]); // biblioteca compartida de logos
  const loadLogos = () => apiGet('/theme/catalog').then((r) => setLogos(r.library.logos)).catch(() => {});

  // Mismo esquema que las cartas: `published` (lo que ven las pantallas),
  // `saved` (borrador o lo publicado) y `cfg` (lo que se edita). Nada llega a
  // las pantallas hasta "Aplicar".
  const [published, setPublished] = useState(null);
  const [saved, setSaved] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewH, setPreviewH] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPackages();
    loadLogos();
    apiGet('/promos')
      .then((r) => { setPublished(r.data); setSaved(r.draft || r.data); setCfg(r.draft || r.data); })
      .catch((e) => setStatus(e.message));
  }, []);

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const unsaved = !!cfg && !same(cfg, saved);
  const pending = !!cfg && !same(cfg, published);

  const renderPreview = useMemo(() => debounce(async (data, horizontal) => {
    try {
      const res = await fetch(`/api/preview/promos-carta/${horizontal ? 'promociones-horizontal' : 'promociones'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (res.ok) setPreviewHtml(await res.text());
    } catch { /* la vista previa es best-effort */ }
  }, 450), []);
  useEffect(() => { if (cfg) renderPreview(cfg, previewH); }, [cfg, previewH]);

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
    await apiPut('/promos', cfg);
    setPublished(cfg); setSaved(cfg);
    flash('Aplicado ✓ — las pantallas ya muestran esta versión');
  });
  const saveDraft = () => run(async () => {
    await apiPut('/promos/draft', cfg);
    setSaved(cfg);
    flash('Borrador guardado ✓ — las pantallas siguen igual');
  });
  const discard = () => {
    if (!confirm('¿Descartar todos los cambios y volver a la versión publicada?')) return;
    run(async () => {
      await apiDelete('/promos/draft');
      setSaved(published); setCfg(published);
      flash('Cambios descartados ✓');
    });
  };

  const update = (fn) => {
    setCfg((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  const simulate = async () => {
    const params = new URLSearchParams();
    if (sim.at) params.set('at', sim.at);
    const res = await fetch(`/api/preview/promos?${params}`);
    setSimResult(await res.json());
  };

  if (!cfg) return <p>Cargando…</p>;

  const movePromo = (i, dir) => update((c) => {
    const j = i + dir;
    if (j < 0 || j >= c.promos.length) return;
    [c.promos[i], c.promos[j]] = [c.promos[j], c.promos[i]];
  });

  return (
    <>
      <p className="sub">
        Cada promoción se programa arriba (días, horario y vigencia) y se llena abajo. Las pantallas no cambian hasta que pulses <strong>Aplicar</strong>.
      </p>
      <div className="editor-split">
        <div className="grow">

      <div className="card">
        <h2>Promociones</h2>
        {cfg.promos.map((p, i) => (
          <PromoCard key={p.id} p={p} index={i} total={cfg.promos.length} packages={packages}
            logos={logos} onLibraryChange={loadLogos}
            horizontal={previewH} onOrientation={setPreviewH}
            onChange={(fn) => update((c) => fn(c.promos[i]))}
            onMove={(dir) => movePromo(i, dir)}
            onDelete={() => confirm('¿Eliminar esta promoción?') && update((c) => c.promos.splice(i, 1))} />
        ))}
        <button
          className="ghost"
          onClick={() =>
            update((c) =>
              c.promos.push({
                id: 'promo-' + Math.random().toString(36).slice(2, 7),
                name: 'Nueva promoción',
                enabled: true, kicker: 'Nueva promo', headline: '$0', headlineSize: 168,
                subtitle: '', description: '', footnote: '', image: '',
                rules: { days: [], from: null, to: null, dateFrom: null, dateTo: null },
                tags: [], priority: 50, sucursales: null,
              })
            )
          }
        >
          + Nueva promoción
        </button>
      </div>

      <PackagesCard packages={packages} promos={cfg.promos} reload={loadPackages} />

      <div className="card">
        <h2>Ajustes de la pantalla</h2>
        <div className="fields">
          <Field label="Segundos por promoción" width={170}>
            <input type="number" min="3" value={cfg.rotation.secondsPerSlide} onChange={(e) => update((c) => { c.rotation.secondsPerSlide = Number(e.target.value); })} />
          </Field>
          <Field label="Máximo de promos en rotación" width={210}>
            <input type="number" min="1" value={cfg.rotation.maxSlides} onChange={(e) => update((c) => { c.rotation.maxSlides = Number(e.target.value); })} />
          </Field>
          <Field label="Opciones">
            <ToggleCard size="mini" label="Animar texto" hint="El texto entra escalonado en cada promoción" sketch="a-fade"
              checked={cfg.rotation.textAnimation !== false} onChange={(v) => update((c) => { c.rotation.textAnimation = v; })} />
          </Field>
        </div>
        <h3>Isotipo del diseño estándar</h3>
        <MarkControls
          value={{ isotipo: cfg.rotation.isotipo || 'legacy', live: cfg.rotation.mantaLive || false }}
          onChange={(mark) => update((c) => { c.rotation.isotipo = mark.isotipo; c.rotation.mantaLive = mark.live; })}
        />
      </div>

      <div className="card">
        <h2>Probar una fecha</h2>
        <div className="fields">
          <Field label="Fecha y hora a simular" width={240}>
            <input type="datetime-local" value={sim.at} onChange={(e) => setSim({ ...sim, at: e.target.value })} />
          </Field>
          <button onClick={simulate}>Ver qué saldría</button>
        </div>
        {simResult && (
          <div style={{ marginTop: 10 }}>
            {simResult.slides.map((s, i) => (
              <span key={s.id} className="slide-chip">
                <span className="k">#{i + 1} · {s.id}</span>
                {s.kicker} — <strong>{s.headline}</strong> {s.subtitle}
              </span>
            ))}
          </div>
        )}
      </div>
        </div>
        <aside className="preview-pane sticky">
          <div className="row" style={{ justifyContent: 'center', marginBottom: 8 }}>
            <span className="tabs">
              <button className={previewH ? 'ghost small' : 'small'} onClick={() => setPreviewH(false)}>▯ Vertical</button>
              <button className={previewH ? 'small' : 'ghost small'} onClick={() => setPreviewH(true)}>▭ Horizontal</button>
            </span>
          </div>
          {(() => {
            const cw = previewH ? 1920 : 1080;
            const ch = previewH ? 1080 : 1920;
            const k = 270 / cw;
            return (
              <div className="preview-box" style={{ width: 270, height: Math.round(ch * k) }}>
                <iframe srcDoc={previewHtml} title="preview" style={{ width: cw, height: ch, transform: `scale(${k})` }} />
              </div>
            );
          })()}
          <p className="hint" style={{ textAlign: 'center' }}>Rota por todas las promos activas, sin mirar su horario.</p>
          <p className="preview-state">
            {!pending
              ? <span className="pill ok">Publicado · sin cambios</span>
              : unsaved
                ? <span className="pill warn">Cambios sin guardar</span>
                : <span className="pill draft">Borrador guardado · sin aplicar</span>}
          </p>
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

// ── Plantillas HTML (paquetes) ──────────────────────────────────────────────
// Un paquete = .zip con index.html + imágenes/estilos/fuentes (o un .html solo).
// Los {{campos}} del index.html aparecen como inputs en cada promo que lo use.
function PackagesCard({ packages, promos, reload }) {
  const [status, setStatus] = useState('');

  const onFile = async (e, replaceId = null) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setStatus('Subiendo…');
      const r = await uploadFile('/promo-packages', file, replaceId ? { replace: replaceId } : {});
      setStatus(`"${r.package.name}" lista ✓ — ${r.package.fields.length} campos editables`);
      await reload();
    } catch (err) {
      setStatus(err.message);
    }
  };

  const remove = async (pkg) => {
    const used = promos.filter((p) => p.package === pkg.id).length;
    const warn = used ? ` La usan ${used} promo(s): volverán al diseño estándar.` : '';
    if (!confirm(`¿Eliminar la plantilla "${pkg.name}"?${warn}`)) return;
    try {
      await apiDelete(`/promo-packages/${pkg.id}`);
      await reload();
    } catch (err) {
      setStatus(err.message);
    }
  };

  return (
    <div className="card">
      <h2>Plantillas HTML</h2>
      <p className="hint" style={{ marginTop: 0 }}>
        Sube un <strong>.zip</strong> con <code>index.html</code> + imágenes, estilos y fuentes (o un <code>.html</code> solo),
maquetado a 1080×1920, 1920×1080 o sus versiones <strong>4K</strong> (2160×3840 / 3840×2160): indícalo en{' '}
        <code>promo.json</code> con <code>"size": [2160, 3840]</code> o elígelo aquí después de subirlo. Marca lo editable con <code>{'{{precio}}'}</code>, <code>{'{{nombre|Valor por defecto}}'}</code> o{' '}
        <code>{'{{img:foto|img/foto.jpg}}'}</code>; esos campos aparecerán en cada promo que use la plantilla.{' '}
        <a href="/assets/promo-plantilla-ejemplo.zip" download>Descargar plantilla de ejemplo</a>
      </p>
      <p className="hint">
        Ya vienen <strong>{packages.filter((k) => k.builtin).length} diseños incluidos</strong> (elige uno en el "diseño" de cada promo);
        sus archivos están en <code>server/promo-layouts/</code> por si quieres copiar uno como base.
      </p>
      {packages.filter((k) => !k.builtin).map((pkg) => (
        <div className="row pkg-row" key={pkg.id}>
          <strong style={{ width: 200 }}>{pkg.name}</strong>
          <span className="grow hint" style={{ margin: 0 }}>
            {pkg.fields.map((f) => f.label).join(' · ') || 'sin campos editables'} — {pkg.files} archivo(s), {Math.ceil(pkg.bytes / 1024)} KB
          </span>
          <OptionCards size="xs" value={`${pkg.width}x${pkg.height}`}
            onChange={async (v) => {
              const [width, height] = v.split('x').map(Number);
              try { await apiPut(`/promo-packages/${pkg.id}`, { width, height }); await reload(); } catch (err) { setStatus(err.message); }
            }}
            options={[
              { id: '1080x1920', label: 'Vertical', hint: '1080×1920', sketch: 'o-vertical' },
              { id: '2160x3840', label: 'Vertical 4K', hint: '2160×3840', sketch: 'o-vertical' },
              { id: '1920x1080', label: 'Horizontal', hint: '1920×1080', sketch: 'o-horizontal' },
              { id: '3840x2160', label: 'Horiz. 4K', hint: '3840×2160', sketch: 'o-horizontal' },
            ]} />
          <a href={`/promo-pkg/${pkg.id}/`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>ver</a>
          <label className="file-btn" title="Sube una nueva versión; las promos conservan sus valores">
            actualizar <input type="file" accept=".zip,.html,.htm" hidden onChange={(e) => onFile(e, pkg.id)} />
          </label>
          <button className="danger small" onClick={() => remove(pkg)}>✕</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <label className="file-btn">
          + Subir plantilla (.zip / .html) <input type="file" accept=".zip,.html,.htm" hidden onChange={(e) => onFile(e)} />
        </label>
        <span className={status.includes('✓') ? 'status-saved' : 'status-error'}>{status}</span>
      </div>
    </div>
  );
}

// Logos de Manta siempre disponibles (claros y oscuros) + los subidos a la
// biblioteca compartida. Cada promo guarda el suyo: un slide oscuro puede usar
// el logo blanco y el siguiente, claro, el café.
const BRAND_LOGOS = [
  { id: '/assets/isotipos/manta-02.svg', label: 'Manta blanca', dark: true },
  { id: '/assets/isotipos/manta-04.svg', label: 'Manta óxido', dark: true },
  { id: '/assets/isotipos/manta-03.svg', label: 'Manta café' },
  { id: '/assets/isotipos/manta-mesa1.svg', label: 'Manta oscura' },
  { id: '/assets/wordmark-trim.png', label: 'Manta Café' },
];

function LogoPicker({ value, defaultLabel, logos, onChange, onLibraryChange }) {
  const [error, setError] = useState('');
  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setError('');
      const { entry } = await uploadFile('/library/logos', file);
      await onLibraryChange();
      onChange(entry.url);
    } catch (err) {
      setError(err.message);
    }
  };
  const remove = async (l) => {
    if (!confirm(`¿Eliminar "${l.name}" de la biblioteca de logos?`)) return;
    try { await apiDelete(`/library/logos/${l.id}`); await onLibraryChange(); } catch (err) { setError(err.message); }
  };
  return (
    <div style={{ width: '100%' }}>
      <OptionCards size="xs" value={value || ''} onChange={(v) => onChange(v || null)}
        options={[
          { id: '', label: defaultLabel, node: <span className="sk-time" style={{ fontSize: 13 }}>auto</span> },
          ...BRAND_LOGOS.map((l) => ({ ...l, img: l.id })),
          ...logos.map((l) => ({ id: l.url, label: l.name, img: l.url, dark: true, onRemove: () => remove(l) })),
        ]}
        extra={<UploadCard label="Subir logo" accept="image/png,image/svg+xml,image/webp,image/jpeg" onFile={onUpload} />} />
      {error && <p className="status-error">{error}</p>}
    </div>
  );
}

// Campos de la plantilla de una promo: texto, lista, opciones o imagen.
// El input muestra el valor guardado o, si no hay, el default de la plantilla;
// vaciarlo lo oculta en el slide y ↺ vuelve al default.
function PackageFields({ pkg, values, onChange, logos = [], onLibraryChange }) {
  const onImage = async (key, e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadImage(file);
      onChange(key, url);
    } catch (err) {
      alert(err.message);
    }
  };
  if (!pkg.fields.length) return <p className="hint">Esta plantilla no tiene campos editables.</p>;
  // Imagen y textos primero; logo y su posición al final.
  const rank = (f) => (f.key.startsWith('logo') ? 2 : f.type === 'image' ? 0 : 1);
  const fields = [...pkg.fields].sort((a, b) => rank(a) - rank(b));
  return (
    <div className="pkg-fields">
      {fields.map((f) => {
        const has = typeof values[f.key] === 'string';
        const val = has ? values[f.key] : f.default;
        const reset = has && (
          <button type="button" className="ghost small" title="Volver al valor de la plantilla" onClick={() => onChange(f.key, null)}>↺</button>
        );
        if (f.type === 'image' && f.key.startsWith('logo')) {
          return (
            <div key={f.key} className="wide pkg-logo">
              <span className="fld-title">{f.label} — de esta promoción</span>
              <LogoPicker value={has ? values[f.key] : ''} defaultLabel="El del diseño" logos={logos} onLibraryChange={onLibraryChange}
                onChange={(v) => onChange(f.key, v)} />
            </div>
          );
        }
        return (
          <label key={f.key} className={f.type === 'list' || f.type === 'image' || f.type === 'select' ? 'wide' : ''}>
            {f.label}
            <span className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              {f.type === 'select' ? (
                <OptionCards size="xs" value={f.options.includes(val) ? val : f.default} onChange={(v) => onChange(f.key, v)}
                  options={f.options.map((o) => ({
                    id: o, label: o.replace(/-/g, ' '),
                    // Posiciones conocidas (logo) llevan croquis; otras opciones, solo texto.
                    node: /^(arriba|abajo)-(izquierda|centro|derecha)$|^oculto$/.test(o)
                      ? <span className={'sk-pos' + (pkg.width > pkg.height ? ' h' : '')}><i className={o} /></span>
                      : null,
                  }))} />
              ) : f.type === 'list' ? (
                <textarea className="grow" rows={Math.max(3, val.split(/\n|;/).length)} value={val.replace(/;\s*/g, '\n')}
                  onChange={(e) => onChange(f.key, e.target.value)} />
              ) : (
                <input type="text" className="grow" value={val} placeholder={f.type === 'image' ? 'URL de imagen' : '(oculto)'}
                  onChange={(e) => onChange(f.key, e.target.value)} />
              )}
              {f.type === 'image' && (
                <>
                  {val && <img src={val.startsWith('/') || val.startsWith('http') ? val : `/promo-pkg/${pkg.id}/${val}`} alt=""
                    style={{ width: 44, height: 34, objectFit: 'cover', borderRadius: 6, background: '#ddd' }} />}
                  <span className="file-btn">
                    subir <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden onChange={(e) => onImage(f.key, e)} />
                  </span>
                </>
              )}
              {reset}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// Galería de diseños siempre desplegada (una por orientación): miniaturas del
// estándar, los incluidos y las plantillas subidas; clic = elegir.
// `inactive`: la galería de la orientación que NO se está trabajando se ve
// apagada (no se usa en esas pantallas); un clic sobre ella cambia de orientación.
function DesignPicker({ packages: all, orientation, value, onPick, inactive = false, onActivate }) {
  const horizontal = orientation === 'horizontal';
  const packages = all.filter((k) => (k.width > k.height) === horizontal);
  const current = packages.find((k) => k.id === value);
  return (
    <div className={'design-group' + (inactive ? ' inactive' : '')} onClick={inactive ? onActivate : undefined}
      title={inactive ? `No se usa en pantallas ${horizontal ? 'verticales' : 'horizontales'}. Clic para trabajar en ${horizontal ? 'horizontal' : 'vertical'}.` : undefined}>
      <span className="fld-title">
        {horizontal ? '▭ Pantallas horizontales' : '▯ Pantallas verticales'} — {current ? current.name : 'Estándar'}
        {inactive && <em> · no se usa en {horizontal ? 'vertical' : 'horizontal'} (clic para cambiar)</em>}
      </span>
      <div className={'design-strip' + (horizontal ? ' h' : '')}>
        <button type="button" className={'design-opt' + (!current ? ' on' : '')} onClick={() => onPick(null)}>
          <span className="design-thumb none">Estándar</span>
          <small>Foto + texto</small>
        </button>
        {packages.map((k) => (
          <button type="button" key={k.id} className={'design-opt' + (k.id === value ? ' on' : '')} title={k.description || k.name} onClick={() => onPick(k.id)}>
            {k.thumb
              ? <img className="design-thumb" src={k.thumb} alt="" loading="lazy" />
              : <span className="design-thumb none">HTML</span>}
            <small>{k.name}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

// Resumen legible de la programación: "L M X · 07:00–11:00 · 1 oct → 30 nov".
function scheduleSummary(rules) {
  const days = rules.days || [];
  const parts = [days.length && days.length < 7 ? DAYS.filter(([d]) => days.includes(d)).map(([, l]) => l).join(' ') : 'Todos los días'];
  parts.push(rules.from || rules.to ? `${rules.from || '00:00'}–${rules.to || '24:00'}` : 'Todo el día');
  if (rules.dateFrom || rules.dateTo) parts.push(`${rules.dateFrom || '…'} → ${rules.dateTo || '…'}`);
  return parts.join(' · ');
}

// Una promoción: arriba la programación, luego el diseño y al final el contenido.
function PromoCard({ p, index, total, packages = [], logos = [], onLibraryChange, horizontal = false, onOrientation, onChange, onMove, onDelete }) {
  // Los campos a editar son la unión de los del diseño vertical y el horizontal
  // (los incluidos comparten claves, así que se captura una sola vez).
  const chosen = [p.package, p.packageH].map((id) => packages.find((x) => x.id === id)).filter(Boolean);
  const pkg = chosen.length
    ? { ...chosen[0], fields: chosen.flatMap((k) => k.fields).filter((f, i, arr) => arr.findIndex((g) => g.key === f.key) === i) }
    : null;
  const rules = p.rules || {};
  const setRule = (key, v) => onChange((x) => { x.rules = { ...(x.rules || {}), [key]: v || null }; });
  const toggleDay = (d) =>
    onChange((x) => {
      const days = x.rules.days || [];
      x.rules.days = days.includes(d) ? days.filter((y) => y !== d) : [...days, d];
    });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadImage(file);
      onChange((x) => { x.image = url; });
    } catch (err) {
      alert(err.message);
    }
  };

  const title = p.name || (pkg && p.values?.titulo) || p.subtitle || p.kicker || p.id;
  const price = (pkg && p.values?.precio) || p.headline || '';

  return (
    <div className={'promo-card' + (p.enabled ? '' : ' disabled')}>
      <div className="row" style={{ marginBottom: 10 }}>
        <input type="text" className="promo-name" value={p.name ?? ''} placeholder={title} title="Nombre de la promoción (solo para identificarla aquí; no sale en pantalla)"
          onChange={(e) => onChange((x) => { if (e.target.value) x.name = e.target.value; else delete x.name; })} />
        {price && <span className="pill draft">{price}</span>}
        <span className="hint grow" style={{ margin: 0 }}>{p.enabled ? scheduleSummary(rules) : 'Apagada'}</span>
        <button className="ghost small" disabled={index === 0} title="Subir en la lista" onClick={() => onMove(-1)}>↑</button>
        <button className="ghost small" disabled={index === total - 1} title="Bajar en la lista" onClick={() => onMove(1)}>↓</button>
        <button className="danger small" onClick={onDelete}>✕</button>
      </div>

      <span className="fld-title">Programación</span>
      <div className="fields" style={{ marginBottom: 12 }}>
        <Field label="Estado">
          <ToggleCard size="mini" label="Activa" hint="Apágala para guardarla sin mostrarla" sketch="k-visible"
            checked={!!p.enabled} onChange={(v) => onChange((x) => { x.enabled = v; })} />
        </Field>
        <Field label="Días (ninguno = todos)">
          <span className="days">
            {DAYS.map(([d, label]) => (
              <label key={d} className={(rules.days || []).includes(d) ? 'on' : ''}>
                <input type="checkbox" checked={(rules.days || []).includes(d)} onChange={() => toggleDay(d)} />
                {label}
              </label>
            ))}
          </span>
        </Field>
        <Field label="Desde (hora)" width={118}>
          <input type="time" value={rules.from || ''} onChange={(e) => setRule('from', e.target.value)} />
        </Field>
        <Field label="Hasta (hora)" width={118}>
          <input type="time" value={rules.to || ''} onChange={(e) => setRule('to', e.target.value)} />
        </Field>
        <Field label="Vigente desde" width={150}>
          <input type="date" value={rules.dateFrom || ''} onChange={(e) => setRule('dateFrom', e.target.value)} />
        </Field>
        <Field label="Vigente hasta" width={150}>
          <input type="date" value={rules.dateTo || ''} onChange={(e) => setRule('dateTo', e.target.value)} />
        </Field>
        <Field label="Prioridad" width={92}>
          <input type="number" value={p.priority} title="Si hay más promos vigentes que el máximo en rotación, salen primero las de mayor prioridad"
            onChange={(e) => onChange((x) => { x.priority = Number(e.target.value); })} />
        </Field>
      </div>

      <div style={{ marginBottom: 12 }}>
        {['vertical', 'horizontal'].map((orientation) => {
          const key = orientation === 'horizontal' ? 'packageH' : 'package';
          return (
            <DesignPicker key={key} packages={packages} orientation={orientation} value={p[key] || null}
              inactive={(orientation === 'horizontal') !== horizontal} onActivate={() => onOrientation(orientation === 'horizontal')}
              onPick={(id) => onChange((x) => {
              if (!id) { delete x[key]; return; }
              x[key] = id;
              // Primera vez: los campos comunes se llenan con lo que ya tenía la promo.
              if (!x.values || !Object.keys(x.values).length) {
                const seed = { titulo: x.subtitle, precio: x.headline, slogan: x.kicker, contiene: x.description, tyc: x.footnote, foto: x.image };
                const keys = new Set((packages.find((k) => k.id === id)?.fields || []).map((f) => f.key));
                x.values = {};
                for (const [k, v] of Object.entries(seed)) if (v && keys.has(k)) x.values[k] = v;
              }
            })} />
          );
        })}
      </div>

      <span className="fld-title">Contenido</span>
      {pkg ? (
        <PackageFields pkg={pkg} values={p.values || {}} logos={logos} onLibraryChange={onLibraryChange}
          onChange={(key, v) => onChange((x) => {
            x.values = x.values || {};
            if (v == null) delete x.values[key];
            else x.values[key] = v;
          })} />
      ) : (
        <>
          <div className="fields">
            <Field label="Etiqueta superior" width={200}>
              <input type="text" value={p.kicker} onChange={(e) => onChange((x) => { x.kicker = e.target.value; })} />
            </Field>
            <Field label="Precio o titular" width={150}>
              <input type="text" value={p.headline} style={{ fontWeight: 700 }} onChange={(e) => onChange((x) => { x.headline = e.target.value; })} />
            </Field>
            <Field label="Nombre de la promoción" grow>
              <input type="text" value={p.subtitle} onChange={(e) => onChange((x) => { x.subtitle = e.target.value; })} />
            </Field>
          </div>
          <div className="fields">
            <Field label="Descripción" grow>
              <input type="text" value={p.description} onChange={(e) => onChange((x) => { x.description = e.target.value; })} />
            </Field>
            <Field label="Nota al pie / términos" width={260}>
              <input type="text" value={p.footnote} onChange={(e) => onChange((x) => { x.footnote = e.target.value; })} />
            </Field>
          </div>
          <span className="fld-title">Logo — de esta promoción</span>
          <LogoPicker value={p.logo || ''} defaultLabel="El general" logos={logos} onLibraryChange={onLibraryChange}
            onChange={(v) => onChange((x) => { if (v) x.logo = v; else delete x.logo; })} />
          <div className="fields" style={{ marginTop: 8 }}>
            <Field label="Imagen de fondo (URL o súbela)" grow>
              <input type="text" value={p.image} onChange={(e) => onChange((x) => { x.image = e.target.value; })} />
              {p.image && <img src={p.image} alt="" style={{ width: 52, height: 38, objectFit: 'cover', borderRadius: 6, marginLeft: 6 }} />}
              <label className="file-btn" style={{ marginLeft: 6, whiteSpace: 'nowrap' }}>
                subir <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden onChange={onFile} />
              </label>
            </Field>
          </div>
        </>
      )}
    </div>
  );
}
