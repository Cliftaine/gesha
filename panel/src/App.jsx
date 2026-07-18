import React, { useEffect, useState } from 'react';
import ScheduleEditor from './ScheduleEditor.jsx';
import MenuEditor from './MenuEditor.jsx';
import PromoEditor from './PromoEditor.jsx';
import LayoutEditor from './LayoutEditor.jsx';
import { apiGet } from './api.js';

const ROUTES = [
  ['#/horarios', 'Horarios'],
  ['#/menus', 'Menús y precios'],
  ['#/promos', 'Promociones'],
  ['#/layout', 'Editor visual'],
];

export default function App() {
  const [hash, setHash] = useState(location.hash || '#/horarios');
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const onHash = () => setHash(location.hash || '#/horarios');
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetch('/api/weather')
      .then((r) => (r.ok ? r.json() : null))
      .then(setWeather)
      .catch(() => {});
  }, []);

  const route = hash.split('/')[1] || 'horarios';

  return (
    <>
      <nav className="sidebar">
        <div className="brand">Manta Café</div>
        {ROUTES.map(([href, label]) => (
          <a key={href} href={href} className={hash.startsWith(href) ? 'active' : ''}>
            {label}
          </a>
        ))}
        <div className="weather">
          {weather
            ? <>Clima: <strong>{weather.tempC}°C</strong><br /><span style={{ opacity: 0.7 }}>{weather.source}</span></>
            : 'Clima: —'}
        </div>
      </nav>
      <main className="main">
        {route === 'horarios' && <ScheduleEditor />}
        {route === 'menus' && <MenuEditor />}
        {route === 'promos' && <PromoEditor />}
        {route === 'layout' && <LayoutEditor />}
      </main>
    </>
  );
}
