import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut } from './api.js';

const DAYS = [
  ['mon', 'L'], ['tue', 'M'], ['wed', 'X'], ['thu', 'J'],
  ['fri', 'V'], ['sat', 'S'], ['sun', 'D'],
];
const CARTAS = ['alimentos', 'bebidas', 'promociones'];

function DayPicker({ value, onChange }) {
  const toggle = (d) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <span className="days">
      {DAYS.map(([d, label]) => (
        <label key={d} className={value.includes(d) ? 'on' : ''}>
          <input type="checkbox" checked={value.includes(d)} onChange={() => toggle(d)} />
          {label}
        </label>
      ))}
    </span>
  );
}

// Mini-grid 7×24: qué carta queda resuelta cada hora de la semana.
function WeekGrid({ screen }) {
  const COLORS = { alimentos: '#7a5a3c', bebidas: '#4a6f5d', promociones: '#98512c' };
  const cells = useMemo(() => {
    const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    return DAYS.map(([d]) =>
      Array.from({ length: 24 }, (_, h) => {
        const minutes = h * 60 + 30;
        for (const r of screen.schedule || []) {
          if (Array.isArray(r.days) && r.days.length && !r.days.includes(d)) continue;
          if (!r.from || !r.to) return r.carta;
          const from = toMin(r.from), to = toMin(r.to);
          const match = from <= to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
          if (match) return r.carta;
        }
        return screen.default;
      })
    );
  }, [screen]);
  return (
    <div style={{ marginTop: 10 }}>
      {cells.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 1, marginBottom: 1, alignItems: 'center' }}>
          <span style={{ width: 16, fontSize: 10, color: 'var(--muted)' }}>{DAYS[i][1]}</span>
          {row.map((carta, h) => (
            <span
              key={h}
              title={`${DAYS[i][1]} ${h}:00 → ${carta}`}
              style={{ width: 14, height: 12, background: COLORS[carta] || '#ccc', opacity: 0.85, borderRadius: 2 }}
            />
          ))}
        </div>
      ))}
      <div className="row" style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
        {Object.entries(COLORS).map(([c, col]) => (
          <span key={c}><span style={{ display: 'inline-block', width: 10, height: 10, background: col, borderRadius: 2, marginRight: 4 }} />{c}</span>
        ))}
      </div>
    </div>
  );
}

export default function ScheduleEditor() {
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    apiGet('/config/dispatch').then((r) => setCfg(r.data)).catch((e) => setStatus(e.message));
  }, []);

  if (!cfg) return <p>Cargando…</p>;

  const save = async (next) => {
    setCfg(next);
    try {
      await apiPut('/config/dispatch', next);
      setStatus('Guardado ✓');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setStatus(e.message);
    }
  };

  const updateScreen = (suc, pan, fn) => {
    const next = structuredClone(cfg);
    fn(next.sucursales[suc].pantallas[pan]);
    save(next);
  };

  return (
    <>
      <h1>Horarios</h1>
      <p className="sub">
        Qué carta muestra cada pantalla según día y hora. Las reglas se evalúan en orden: la primera que coincide gana; sin coincidencia se usa la carta por defecto.
        {' '}<span className={status.includes('✓') ? 'status-saved' : 'status-error'}>{status}</span>
      </p>
      {Object.entries(cfg.sucursales).map(([sucId, suc]) =>
        Object.entries(suc.pantallas).map(([panId, screen]) => (
          <div className="card" key={sucId + panId}>
            <h2>{suc.name} · {panId}{screen.name ? ` — ${screen.name}` : ''}</h2>
            <div className="row" style={{ marginBottom: 10 }}>
              <span>Carta por defecto:</span>
              <select
                value={screen.default}
                onChange={(e) => updateScreen(sucId, panId, (s) => { s.default = e.target.value; })}
              >
                {CARTAS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <span>Orientación:</span>
              <select
                value={screen.orientation || 'portrait'}
                title="Cómo está montada la TV — el canvas se rota para llenarla"
                onChange={(e) => updateScreen(sucId, panId, (s) => { s.orientation = e.target.value; })}
              >
                <option value="portrait">Vertical (TV en vertical)</option>
                <option value="cw">Girada 90° → (TV landscape)</option>
                <option value="ccw">Girada 90° ← (TV landscape)</option>
              </select>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                URL: /{sucId}/{panId}
              </span>
            </div>
            {(screen.schedule || []).map((rule, i) => (
              <div className="row" key={i} style={{ marginBottom: 6 }}>
                <span style={{ color: 'var(--muted)', width: 18 }}>{i + 1}.</span>
                <DayPicker
                  value={rule.days || []}
                  onChange={(days) => updateScreen(sucId, panId, (s) => { s.schedule[i].days = days; })}
                />
                <input type="time" value={rule.from || ''}
                  onChange={(e) => updateScreen(sucId, panId, (s) => { s.schedule[i].from = e.target.value || null; })} />
                <span>→</span>
                <input type="time" value={rule.to || ''}
                  onChange={(e) => updateScreen(sucId, panId, (s) => { s.schedule[i].to = e.target.value || null; })} />
                <select value={rule.carta}
                  onChange={(e) => updateScreen(sucId, panId, (s) => { s.schedule[i].carta = e.target.value; })}>
                  {CARTAS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <button className="ghost small" disabled={i === 0}
                  onClick={() => updateScreen(sucId, panId, (s) => {
                    [s.schedule[i - 1], s.schedule[i]] = [s.schedule[i], s.schedule[i - 1]];
                  })}>↑</button>
                <button className="ghost small" disabled={i === (screen.schedule || []).length - 1}
                  onClick={() => updateScreen(sucId, panId, (s) => {
                    [s.schedule[i + 1], s.schedule[i]] = [s.schedule[i], s.schedule[i + 1]];
                  })}>↓</button>
                <button className="danger small"
                  onClick={() => updateScreen(sucId, panId, (s) => { s.schedule.splice(i, 1); })}>✕</button>
              </div>
            ))}
            <button className="ghost small"
              onClick={() => updateScreen(sucId, panId, (s) => {
                s.schedule = s.schedule || [];
                s.schedule.push({ days: [], from: '08:00', to: '12:00', carta: screen.default });
              })}>+ Agregar regla</button>
            <WeekGrid screen={screen} />
          </div>
        ))
      )}
    </>
  );
}
