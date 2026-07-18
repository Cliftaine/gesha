import React, { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut } from './api.js';

// Configuración de pantallas: sucursales y pantallas (crear/renombrar/borrar),
// asignación de cartas por horario, rotación física de la TV (0/90/180/270)
// y carta por defecto.
const DAYS = [
  ['mon', 'L'], ['tue', 'M'], ['wed', 'X'], ['thu', 'J'],
  ['fri', 'V'], ['sat', 'S'], ['sun', 'D'],
];

const slug = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Rotación efectiva (compat con el formato viejo orientation).
const rotationOf = (screen) => {
  if ([0, 90, 180, 270].includes(screen.rotation)) return screen.rotation;
  if (screen.orientation === 'cw') return 90;
  if (screen.orientation === 'ccw') return 270;
  return 0;
};

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

const PALETTE = ['#7a5a3c', '#4a6f5d', '#98512c', '#5a5a8a', '#8a5a7a', '#4a7a8a', '#7a7a4a'];

function WeekGrid({ screen, cartas }) {
  const colorOf = (c) => PALETTE[Math.max(0, cartas.indexOf(c)) % PALETTE.length];
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
            <span key={h} title={`${DAYS[i][1]} ${h}:00 → ${carta}`}
              style={{ width: 14, height: 12, background: colorOf(carta), opacity: 0.85, borderRadius: 2 }} />
          ))}
        </div>
      ))}
      <div className="row" style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
        {cartas.map((c) => (
          <span key={c}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: colorOf(c), borderRadius: 2, marginRight: 4 }} />
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ScreenConfig() {
  const [cfg, setCfg] = useState(null);
  const [cartas, setCartas] = useState(['promociones']);
  const [status, setStatus] = useState('');

  useEffect(() => {
    apiGet('/config/dispatch').then((r) => setCfg(r.data)).catch((e) => setStatus(e.message));
    apiGet('/menus')
      .then((r) => setCartas([...r.menus.map((m) => m.id), 'promociones']))
      .catch(() => {});
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

  const mutate = (fn) => {
    const next = structuredClone(cfg);
    fn(next);
    save(next);
  };

  const updateScreen = (suc, pan, fn) => mutate((c) => fn(c.sucursales[suc].pantallas[pan]));

  const createSucursal = () => {
    const name = prompt('Nombre de la sucursal (ej. "Norte"):');
    if (!name) return;
    const id = slug(name);
    if (!id || cfg.sucursales[id]) return alert('Nombre inválido o ya existe.');
    mutate((c) => { c.sucursales[id] = { name, pantallas: {} }; });
  };

  const createPantalla = (sucId) => {
    const name = prompt('Nombre de la pantalla (ej. "Barra", "Entrada"):');
    if (!name) return;
    const suc = cfg.sucursales[sucId];
    let id = 'pantalla_' + (Object.keys(suc.pantallas).length + 1);
    while (suc.pantallas[id]) id += '_b';
    mutate((c) => {
      c.sucursales[sucId].pantallas[id] = {
        name, default: cartas[0] || 'promociones', rotation: 0, schedule: [],
      };
    });
  };

  return (
    <>
      <h1>Configuración de pantallas</h1>
      <p className="sub">
        Sucursales, pantallas, qué carta muestra cada una según día/hora, y la rotación física de la TV.
        {' '}<span className={status.includes('✓') ? 'status-saved' : 'status-error'}>{status}</span>
      </p>
      {Object.entries(cfg.sucursales).map(([sucId, suc]) => (
        <div key={sucId} className="card" style={{ background: 'transparent' }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Sucursal: {suc.name || sucId}</h2>
            <span className="grow" />
            <button className="ghost small" onClick={() => createPantalla(sucId)}>+ Crear pantalla</button>
            <button className="danger small"
              onClick={() =>
                confirm(`¿Eliminar la sucursal "${suc.name || sucId}" con todas sus pantallas?`) &&
                mutate((c) => { delete c.sucursales[sucId]; })
              }>
              ✕ sucursal
            </button>
          </div>
          {Object.entries(suc.pantallas).map(([panId, screen]) => (
            <div className="card" key={panId}>
              <div className="row" style={{ marginBottom: 10 }}>
                <input type="text" value={screen.name || ''} placeholder={panId} style={{ fontWeight: 600, width: 180 }}
                  onChange={(e) => updateScreen(sucId, panId, (s) => { s.name = e.target.value; })} />
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>URL: /{sucId}/{panId}</span>
                <span className="grow" />
                <button className="danger small"
                  onClick={() =>
                    confirm(`¿Eliminar la pantalla "${screen.name || panId}"?`) &&
                    mutate((c) => { delete c.sucursales[sucId].pantallas[panId]; })
                  }>
                  ✕ pantalla
                </button>
              </div>
              <div className="row" style={{ marginBottom: 10 }}>
                <span>Carta por defecto:</span>
                <select value={screen.default}
                  onChange={(e) => updateScreen(sucId, panId, (s) => { s.default = e.target.value; })}>
                  {cartas.map((c) => <option key={c}>{c}</option>)}
                </select>
                <span>Rotación de TV:</span>
                <select value={rotationOf(screen)}
                  title="Cómo está montada físicamente la TV — el canvas se rota para compensar"
                  onChange={(e) => updateScreen(sucId, panId, (s) => {
                    s.rotation = Number(e.target.value);
                    delete s.orientation; // limpia el formato viejo
                  })}>
                  <option value={0}>0° (normal)</option>
                  <option value={90}>90°</option>
                  <option value={180}>180°</option>
                  <option value={270}>270°</option>
                </select>
              </div>
              {(screen.schedule || []).map((rule, i) => (
                <div className="row" key={i} style={{ marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted)', width: 18 }}>{i + 1}.</span>
                  <DayPicker value={rule.days || []}
                    onChange={(days) => updateScreen(sucId, panId, (s) => { s.schedule[i].days = days; })} />
                  <input type="time" value={rule.from || ''}
                    onChange={(e) => updateScreen(sucId, panId, (s) => { s.schedule[i].from = e.target.value || null; })} />
                  <span>→</span>
                  <input type="time" value={rule.to || ''}
                    onChange={(e) => updateScreen(sucId, panId, (s) => { s.schedule[i].to = e.target.value || null; })} />
                  <select value={rule.carta}
                    onChange={(e) => updateScreen(sucId, panId, (s) => { s.schedule[i].carta = e.target.value; })}>
                    {cartas.map((c) => <option key={c}>{c}</option>)}
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
                })}>
                + Agregar regla de horario
              </button>
              <WeekGrid screen={screen} cartas={cartas} />
            </div>
          ))}
          {!Object.keys(suc.pantallas).length && (
            <p style={{ color: 'var(--muted)' }}>Sin pantallas — crea la primera.</p>
          )}
        </div>
      ))}
      <button onClick={createSucursal}>+ Crear sucursal</button>
    </>
  );
}
