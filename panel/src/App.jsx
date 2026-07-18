import React, { useEffect, useState } from 'react';
import ScreenConfig from './ScreenConfig.jsx';
import ContentEditor from './ContentEditor.jsx';

const ROUTES = [
  ['#/pantallas', 'Configuración de pantallas'],
  ['#/contenido', 'Contenido'],
];

// Hashes viejos → nueva estructura.
const LEGACY = { horarios: 'pantallas', menus: 'contenido', promos: 'contenido', layout: 'contenido' };

export default function App() {
  const [hash, setHash] = useState(location.hash || '#/pantallas');
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    const onHash = () => setHash(location.hash || '#/pantallas');
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetch('/api/weather')
      .then((r) => (r.ok ? r.json() : null))
      .then(setWeather)
      .catch(() => {});
  }, []);

  let route = hash.split('/')[1] || 'pantallas';
  if (LEGACY[route]) route = LEGACY[route];

  return (
    <>
      <nav className="sidebar">
        <div className="brand">Manta Café</div>
        {ROUTES.map(([href, label]) => (
          <a key={href} href={href} className={route === href.split('/')[1] ? 'active' : ''}>
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
        {route === 'pantallas' && <ScreenConfig />}
        {route === 'contenido' && <ContentEditor />}
      </main>
    </>
  );
}
