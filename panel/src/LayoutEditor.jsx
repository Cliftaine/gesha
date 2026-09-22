import React, { useEffect, useRef, useState } from 'react';
import interact from 'interactjs';
import { apiGet, apiPut, ConflictError } from './api.js';

// Editor visual: carga la carta real en un iframe escalado, lee las zonas
// data-zone del documento y dibuja cajas overlay arrastrables/redimensionables.
// Los deltas (dx/dy/w/h) se guardan en layouts.json y el server los inyecta
// como <style> al renderizar — sin overrides el render es pixel-idéntico.
// Recibe cartaId y canvas {w,h} del ContentEditor (soporta horizontal).
export default function LayoutEditor({ cartaId, canvas = { w: 1080, h: 1920 } }) {
  // Escala para que el canvas quepa en un área de trabajo de ~460×810.
  const SCALE = Math.min(460 / canvas.w, 810 / canvas.h);
  const [layout, setLayout] = useState({ zones: {} });
  const [zones, setZones] = useState([]); // [{name, rect}] rects base (sin overrides) en px de carta
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    setLayout({ zones: {} });
    setZones([]);
    setSelected(null);
    apiGet(`/layouts/${cartaId}`).then((r) => setLayout(r.data || { zones: {} })).catch((e) => setStatus(e.message));
  }, [cartaId]);

  // Al cargar el iframe, medir las zonas SIN overrides (el ?edit=1 no los inyecta…
  // en realidad el server sí los inyecta; medimos restando el delta guardado).
  const onIframeLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const found = [];
    doc.querySelectorAll('[data-zone]').forEach((el) => {
      const name = el.getAttribute('data-zone');
      if (found.some((z) => z.name === name)) return; // promo-frames repiten zona
      const r = el.getBoundingClientRect();
      const saved = layoutRef.current.zones[name] || {};
      found.push({
        name,
        base: {
          x: r.left - (saved.dx || 0),
          y: r.top - (saved.dy || 0),
          w: saved.w != null ? null : r.width, // si hay w guardado, r.width ya lo incluye
          wMeasured: r.width - 0,
          hMeasured: r.height - 0,
        },
      });
    });
    // Para simplificar: base w/h = medido menos override aplicado no es trivial con
    // transform; guardamos el rect medido y tratamos w/h overrides como absolutos.
    setZones(found.map((z) => ({ name: z.name, rect: { x: z.base.x, y: z.base.y, w: z.base.wMeasured, h: z.base.hMeasured } })));
  };

  const save = async (next) => {
    try {
      await apiPut(`/layouts/${cartaId}`, next);
      setStatus('Guardado ✓');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      if (e instanceof ConflictError && confirm(e.message)) location.reload();
      else setStatus(e.message);
    }
  };

  const updateZone = (name, patch) => {
    setLayout((prev) => {
      const next = structuredClone(prev);
      next.zones[name] = { ...(next.zones[name] || {}), ...patch };
      save(next);
      return next;
    });
  };

  const resetZone = (name) => {
    setLayout((prev) => {
      const next = structuredClone(prev);
      delete next.zones[name];
      save(next);
      setIframeKey((k) => k + 1);
      return next;
    });
  };

  const resetAll = () => {
    const next = { zones: {} };
    setLayout(next);
    save(next);
    setIframeKey((k) => k + 1);
  };

  return (
    <>
      <p className="sub">
        Arrastra las zonas para moverlas; usa las esquinas para redimensionar. Los cambios son deltas sobre el diseño original.
        {' '}<span className={status.includes('✓') ? 'status-saved' : 'status-error'}>{status}</span>
      </p>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="ghost" onClick={() => setIframeKey((k) => k + 1)}>Recargar vista</button>
        <button className="danger" onClick={resetAll}>Restablecer todo</button>
        <TemplateSwitcher cartaId={cartaId} onSwitched={() => setIframeKey((k) => k + 1)} setStatus={setStatus} />
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="layout-wrap" style={{ width: canvas.w * SCALE, height: canvas.h * SCALE }}>
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={`/carta/${cartaId}?edit=1&res=base`}
            title="layout"
            onLoad={onIframeLoad}
            style={{ width: canvas.w, height: canvas.h, transform: `scale(${SCALE})` }}
          />
          <div className="zone-overlay">
            {zones.map((z) => (
              <ZoneBox
                key={z.name + iframeKey}
                zone={z}
                scale={SCALE}
                override={layout.zones[z.name] || {}}
                selected={selected === z.name}
                onSelect={() => setSelected(z.name)}
                onCommit={(patch) => updateZone(z.name, patch)}
              />
            ))}
          </div>
        </div>
        <div className="card grow">
          <h2>Zonas</h2>
          {zones.map((z) => {
            const o = layout.zones[z.name] || {};
            const touched = o.dx || o.dy || o.w != null || o.h != null || o.hidden;
            return (
              <div className="row" key={z.name} style={{ marginBottom: 6 }}>
                <strong style={{ width: 120, cursor: 'pointer' }} onClick={() => setSelected(z.name)}>
                  {z.name}
                </strong>
                <span style={{ fontSize: 12, color: 'var(--muted)', width: 190 }}>
                  {touched
                    ? `dx:${o.dx || 0} dy:${o.dy || 0}${o.w != null ? ` w:${o.w}` : ''}${o.h != null ? ` h:${o.h}` : ''}${o.hidden ? ' oculta' : ''}`
                    : 'original'}
                </span>
                <label style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={!!o.hidden}
                    onChange={(e) => updateZone(z.name, { hidden: e.target.checked })}
                  />{' '}
                  ocultar
                </label>
                {touched && (
                  <button className="ghost small" onClick={() => resetZone(z.name)}>restablecer</button>
                )}
              </div>
            );
          })}
          {!zones.length && <p style={{ color: 'var(--muted)' }}>Cargando zonas…</p>}
        </div>
      </div>
    </>
  );
}

// Cambia el template del menú re-renderizando los mismos datos con la otra
// densidad (los menús comparten schema, así que es un swap de parámetros).
function TemplateSwitcher({ cartaId, onSwitched, setStatus }) {
  if (cartaId === 'promociones') return null;
  const applyDensity = async (dense) => {
    try {
      const { data } = await apiGet(`/menus/${cartaId}`);
      data.dense = dense;
      await apiPut(`/menus/${cartaId}`, data);
      onSwitched();
      setStatus('Template cambiado ✓');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setStatus(e.message);
    }
  };
  return (
    <span className="row" style={{ gap: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>Template:</span>
      <button className="ghost small" onClick={() => applyDensity(false)}>Amplio (alimentos)</button>
      <button className="ghost small" onClick={() => applyDensity(true)}>Compacto (bebidas)</button>
    </span>
  );
}

function ZoneBox({ zone, scale: SCALE, override, selected, onSelect, onCommit }) {
  const ref = useRef(null);
  // Posición visual = rect medido en px de carta × SCALE. El rect medido ya
  // incluye el delta guardado (el server inyectó los overrides), así que la
  // caja se dibuja donde la zona está realmente.
  const [live, setLive] = useState(null); // {dx, dy, w, h} en px de carta durante el drag

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let acc = { dx: 0, dy: 0, w: null, h: null };
    const inter = interact(el)
      .draggable({
        listeners: {
          start() { acc = { dx: 0, dy: 0, w: null, h: null }; },
          move(ev) {
            acc.dx += ev.dx / SCALE;
            acc.dy += ev.dy / SCALE;
            setLive({ ...acc });
          },
          end() {
            onCommit({
              dx: Math.round((override.dx || 0) + acc.dx),
              dy: Math.round((override.dy || 0) + acc.dy),
            });
            setLive(null);
          },
        },
      })
      .resizable({
        edges: { left: false, top: false, right: true, bottom: true },
        listeners: {
          start() { acc = { dx: 0, dy: 0, w: zone.rect.w, h: zone.rect.h }; },
          move(ev) {
            acc.w = ev.rect.width / SCALE;
            acc.h = ev.rect.height / SCALE;
            setLive({ ...acc });
          },
          end() {
            onCommit({ w: Math.round(acc.w), h: Math.round(acc.h) });
            setLive(null);
          },
        },
      });
    return () => inter.unset();
  }, [zone.name, override.dx, override.dy]);

  const dx = live?.dx || 0;
  const dy = live?.dy || 0;
  const w = live?.w ?? zone.rect.w;
  const h = live?.h ?? zone.rect.h;

  return (
    <div
      ref={ref}
      className={'zone-box' + (selected ? ' selected' : '')}
      onPointerDown={onSelect}
      style={{
        left: (zone.rect.x + dx) * SCALE,
        top: (zone.rect.y + dy) * SCALE,
        width: w * SCALE,
        height: h * SCALE,
        display: override.hidden ? 'none' : undefined,
      }}
    >
      <span className="tag">{zone.name}</span>
    </div>
  );
}
