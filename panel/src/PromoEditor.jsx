import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut, debounce, uploadImage, ConflictError } from './api.js';
import { MarkControls } from './MenuEditor.jsx';

const DAYS = [
  ['mon', 'L'], ['tue', 'M'], ['wed', 'X'], ['thu', 'J'],
  ['fri', 'V'], ['sat', 'S'], ['sun', 'D'],
];

export default function PromoEditor() {
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState('');
  const [sim, setSim] = useState({ at: '', temp: 24 });
  const [simResult, setSimResult] = useState(null);

  useEffect(() => {
    apiGet('/promos').then((r) => setCfg(r.data)).catch((e) => setStatus(e.message));
  }, []);

  const saveNow = async (data) => {
    try {
      await apiPut('/promos', data);
      setStatus('Guardado ✓');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      if (e instanceof ConflictError && confirm(e.message)) location.reload();
      else setStatus(e.message);
    }
  };
  const saveDebounced = useMemo(() => debounce(saveNow, 800), []);

  const update = (fn) => {
    setCfg((prev) => {
      const next = structuredClone(prev);
      fn(next);
      setStatus('Guardando…');
      saveDebounced(next);
      return next;
    });
  };

  const simulate = async () => {
    const params = new URLSearchParams();
    if (sim.at) params.set('at', sim.at);
    params.set('temp', sim.temp);
    const res = await fetch(`/api/preview/promos?${params}`);
    setSimResult(await res.json());
  };

  if (!cfg) return <p>Cargando…</p>;

  return (
    <>
      <h1>Promociones</h1>
      <p className="sub">
        La pantalla de promociones rota entre los slides activos según hora, día y clima.
        {' '}<span className={status.includes('✓') ? 'status-saved' : 'status-error'}>{status}</span>
      </p>

      <div className="card">
        <h2>Simulador</h2>
        <div className="row">
          <span>Fecha/hora:</span>
          <input type="datetime-local" value={sim.at} onChange={(e) => setSim({ ...sim, at: e.target.value })} />
          <span>Temperatura: {sim.temp}°C</span>
          <input type="range" min="0" max="40" value={sim.temp} onChange={(e) => setSim({ ...sim, temp: Number(e.target.value) })} />
          <button onClick={simulate}>Simular</button>
        </div>
        {simResult && (
          <div style={{ marginTop: 10 }}>
            {simResult.slides.map((s, i) => (
              <span key={s.id} className="slide-chip">
                <span className="k">#{i + 1} · {s.id} · score {s.score ?? '—'}</span>
                {s.kicker} — <strong>{s.headline}</strong> {s.subtitle}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Slides dinámicos</h2>
        {Object.entries(cfg.dynamic).map(([key, d]) => (
          <div className="row" key={key} style={{ marginBottom: 6 }}>
            <label style={{ width: 130 }}>
              <input
                type="checkbox"
                checked={d.enabled}
                onChange={(e) => update((c) => { c.dynamic[key].enabled = e.target.checked; })}
              />{' '}
              {key}
            </label>
            {'from' in d && (
              <>
                <input type="time" value={d.from || ''} onChange={(e) => update((c) => { c.dynamic[key].from = e.target.value; })} />
                <span>→</span>
                <input type="time" value={d.to || ''} onChange={(e) => update((c) => { c.dynamic[key].to = e.target.value; })} />
              </>
            )}
            <span>prioridad</span>
            <input type="number" value={d.priority} onChange={(e) => update((c) => { c.dynamic[key].priority = Number(e.target.value); })} />
          </div>
        ))}
        <h3>Clima</h3>
        <div className="row">
          <span>Frío debajo de</span>
          <input type="number" value={cfg.weather.coldBelowC} onChange={(e) => update((c) => { c.weather.coldBelowC = Number(e.target.value); })} />
          <span>°C · Calor arriba de</span>
          <input type="number" value={cfg.weather.hotAboveC} onChange={(e) => update((c) => { c.weather.hotAboveC = Number(e.target.value); })} />
          <span>°C · Boost</span>
          <input type="number" value={cfg.weather.boost} onChange={(e) => update((c) => { c.weather.boost = Number(e.target.value); })} />
        </div>
        <h3>Rotación</h3>
        <div className="row">
          <span>Segundos por slide</span>
          <input type="number" value={cfg.rotation.secondsPerSlide} onChange={(e) => update((c) => { c.rotation.secondsPerSlide = Number(e.target.value); })} />
          <span>Máx. slides</span>
          <input type="number" value={cfg.rotation.maxSlides} onChange={(e) => update((c) => { c.rotation.maxSlides = Number(e.target.value); })} />
          <label>
            <input type="checkbox" checked={cfg.rotation.textAnimation !== false}
              onChange={(e) => update((c) => { c.rotation.textAnimation = e.target.checked; })} />{' '}
            Animar texto al entrar cada slide
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <MarkControls
            value={{ isotipo: cfg.rotation.isotipo || 'legacy', live: cfg.rotation.mantaLive || false }}
            onChange={(mark) => update((c) => { c.rotation.isotipo = mark.isotipo; c.rotation.mantaLive = mark.live; })}
          />
        </div>
      </div>

      <div className="card">
        <h2>Promos</h2>
        {cfg.promos.map((p, i) => (
          <PromoCard key={p.id} p={p} onChange={(fn) => update((c) => fn(c.promos[i]))}
            onDelete={() => update((c) => c.promos.splice(i, 1))} />
        ))}
        <button
          className="ghost"
          onClick={() =>
            update((c) =>
              c.promos.push({
                id: 'promo-' + Math.random().toString(36).slice(2, 7),
                enabled: true, kicker: 'Nueva promo', headline: '$0', headlineSize: 168,
                subtitle: '', description: '', footnote: '', image: '',
                rules: { days: [], from: null, to: null, dateFrom: null, dateTo: null },
                tags: [], priority: 50, sucursales: null,
              })
            )
          }
        >
          + Nueva promo
        </button>
      </div>
    </>
  );
}

function PromoCard({ p, onChange, onDelete }) {
  const toggleDay = (d) =>
    onChange((x) => {
      const days = x.rules.days || [];
      x.rules.days = days.includes(d) ? days.filter((y) => y !== d) : [...days, d];
    });
  const toggleTag = (t) =>
    onChange((x) => {
      x.tags = x.tags.includes(t) ? x.tags.filter((y) => y !== t) : [...x.tags, t];
    });

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      onChange((x) => { x.image = url; });
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className={'promo-card' + (p.enabled ? '' : ' disabled')}>
      <div className="row" style={{ marginBottom: 8 }}>
        <label>
          <input type="checkbox" checked={p.enabled} onChange={(e) => onChange((x) => { x.enabled = e.target.checked; })} /> activa
        </label>
        <strong className="grow">{p.id}</strong>
        <span>prioridad</span>
        <input type="number" value={p.priority} onChange={(e) => onChange((x) => { x.priority = Number(e.target.value); })} />
        <button className="danger small" onClick={onDelete}>✕</button>
      </div>
      <div className="row" style={{ marginBottom: 6 }}>
        <input type="text" placeholder="kicker" value={p.kicker} style={{ width: 170 }}
          onChange={(e) => onChange((x) => { x.kicker = e.target.value; })} />
        <input type="text" placeholder="headline" value={p.headline} style={{ width: 130, fontWeight: 700 }}
          onChange={(e) => onChange((x) => { x.headline = e.target.value; })} />
        <input type="text" placeholder="subtítulo" value={p.subtitle} className="grow"
          onChange={(e) => onChange((x) => { x.subtitle = e.target.value; })} />
      </div>
      <div className="row" style={{ marginBottom: 6 }}>
        <input type="text" placeholder="descripción" value={p.description} className="grow"
          onChange={(e) => onChange((x) => { x.description = e.target.value; })} />
        <input type="text" placeholder="nota al pie" value={p.footnote} style={{ width: 220 }}
          onChange={(e) => onChange((x) => { x.footnote = e.target.value; })} />
      </div>
      <div className="row">
        <span className="days">
          {DAYS.map(([d, label]) => (
            <label key={d} className={(p.rules.days || []).includes(d) ? 'on' : ''}>
              <input type="checkbox" checked={(p.rules.days || []).includes(d)} onChange={() => toggleDay(d)} />
              {label}
            </label>
          ))}
        </span>
        <input type="time" value={p.rules.from || ''} onChange={(e) => onChange((x) => { x.rules.from = e.target.value || null; })} />
        <span>→</span>
        <input type="time" value={p.rules.to || ''} onChange={(e) => onChange((x) => { x.rules.to = e.target.value || null; })} />
        {['hot', 'cold', 'ice'].map((t) => (
          <label key={t} style={{ fontSize: 12 }}>
            <input type="checkbox" checked={p.tags.includes(t)} onChange={() => toggleTag(t)} /> {t === 'hot' ? '🔥' : t === 'cold' ? '🧊' : '🍧'} {t}
          </label>
        ))}
        <input type="text" placeholder="URL de imagen" value={p.image} className="grow"
          onChange={(e) => onChange((x) => { x.image = e.target.value; })} />
        <label className="ghost small" style={{ border: '1px solid var(--accent-soft)', borderRadius: 8, padding: '4px 9px', cursor: 'pointer' }}>
          subir <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" hidden onChange={onFile} />
        </label>
      </div>
    </div>
  );
}
