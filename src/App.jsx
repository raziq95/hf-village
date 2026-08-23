import React, { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, Environment, Lightformer, SoftShadows, AdaptiveDpr } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA } from '@react-three/postprocessing';
import * as THREE from 'three';
import Village, { PROGRAMS } from './Village.jsx';
import { BRAND } from './programs.js';

export default function App() {
  // einmalig ermittelt: steuert Renderaufwand und Bedienhinweise
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
  const [active, setActive] = useState(null);

  // Beim Ausblenden bleibt der letzte Inhalt stehen, sonst wäre die Karte kurz leer.
  const [displayed, setDisplayed] = useState(null);
  const current = PROGRAMS.find(p => p.key === displayed);

  const onHover = useCallback(key => {
    setActive(prev => (prev === key ? prev : key));
    if (key) setDisplayed(key);
  }, []);

  // Klick auf einen Bereich (oder Chip) öffnet direkt die zugehörige Programmseite.
  const openProgram = useCallback(key => {
    const prog = PROGRAMS.find(p => p.key === key);
    if (prog) window.location.href = prog.url;
  }, []);

  // Auf Touch wäre ein direktes Öffnen beim ersten Tippen überraschend — der Nutzer
  // hat die Programminfo noch nicht gesehen. Daher: erst auswählen, zweiter Tap öffnet.
  const [armed, setArmed] = useState(null);
  useEffect(() => { if (!active) setArmed(null); }, [active]);

  const onCanvasClick = useCallback(e => {
    if (!active) return;
    const touch = e?.nativeEvent?.pointerType === 'touch';
    if (touch && armed !== active) { setArmed(active); return; }
    openProgram(active);
  }, [active, armed, openProgram]);

  // Bedienhinweis: verschwindet, sobald der Nutzer selbst einen Bereich entdeckt hat.
  const [discovered, setDiscovered] = useState(false);
  useEffect(() => { if (active) setDiscovered(true); }, [active]);
  const hint = discovered ? null
    : mobile ? 'Tippe auf einen Bereich, um ihn zu entdecken'
    : 'Bewege die Maus, um die Programme zu entdecken';

  const shown = active;
  const info = PROGRAMS.find(p => p.key === (active ? displayed : null));

  return (
    <section className={'hero' + (shown ? ' is-target' : '')}>
      <div className="copy">
        <p className="kicker">Humanity First Deutschland</p>
        {/* Zwei Zustände im selben Raster: Standardtitel und Programminfo blenden
            übereinander. Das ersetzt das früher schwebende Label. */}
        <div className="titles">
          <div className={'t-default' + (info ? ' hide' : '')}>
            <h1>Ein Dorf zeigt, was Ihre Spende bewegt</h1>
            <p>Bildung, Wasser, Gesundheit, Ernährung: acht Programme, ein Ort. Fahren Sie über einen Bereich, um ihn zum Leben zu erwecken.</p>
          </div>
          <div className={'t-program' + (info ? ' show' : '')} aria-live="polite">
            {info && <img className="logo" src={BRAND[info.key]?.logo} alt={info.name} />}
            <p>{info?.line}</p>
          </div>
        </div>
        <div className="cta">
          <a className="btn btn-primary" href="https://humanityfirst.de/spenden">Jetzt spenden</a>
          <a className="btn btn-ghost" href={info ? info.url : 'https://humanityfirst.de/programme/community-care/'}>
            {info ? 'Programmseite ansehen' : 'Programme ansehen'}
          </a>
        </div>
      </div>

      <div className="stage">
      <Canvas
        shadows
        dpr={mobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        onClick={onCanvasClick}
      >
        <OrthographicCamera makeDefault position={[0, 120, 100]} zoom={7} near={1} far={600} />
        <Environment background={false} environmentIntensity={0.8} resolution={256}>
          <color attach="background" args={['#bcd6f2']} />
          <Lightformer form="rect" intensity={2.4} color="#eaf2ff" position={[0, 20, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[40, 40, 1]} />
          <Lightformer form="rect" intensity={1.1} color="#fff2dc" position={[-24, 12, 18]} rotation={[0, Math.PI / 4, 0]} scale={[20, 14, 1]} />
          <Lightformer form="rect" intensity={0.6} color="#dceaff" position={[24, 8, -18]} rotation={[0, -Math.PI / 3, 0]} scale={[20, 14, 1]} />
        </Environment>
        <SoftShadows size={26} samples={18} focus={0.9} />
        <directionalLight
          position={[-30, 46, 24]} intensity={2.0} color="#fff2dc" castShadow
          shadow-mapSize={mobile ? [1024, 1024] : [2048, 2048]} shadow-bias={-0.0006} shadow-normalBias={0.035}
          shadow-camera-left={-38} shadow-camera-right={38}
          shadow-camera-top={38} shadow-camera-bottom={-38}
          shadow-camera-near={1} shadow-camera-far={160}
        />
        <directionalLight position={[26, 14, -26]} intensity={0.34} color="#dceaff" />
        <Village activeKey={shown} onHover={onHover} />
        <EffectComposer disableNormalPass multisampling={0}>
          <N8AO aoRadius={2.2} intensity={1.6} distanceFalloff={1.0} quality="performance" />
          <SMAA />
        </EffectComposer>
        <AdaptiveDpr pixelated={false} />
      </Canvas>
      </div>

      <nav className="chips" aria-label="Programme">
        {PROGRAMS.map(p => (
          <button
            key={p.key}
            aria-pressed={shown === p.key}
            onMouseEnter={() => { setActive(p.key); setDisplayed(p.key); }}
            onMouseLeave={() => setActive(prev => (prev === p.key ? null : prev))}
            onClick={() => openProgram(p.key)}
          >{p.name}</button>
        ))}
      </nav>

      <div className={'hint-bar' + (hint ? ' on' : '')} aria-live="polite">
        <span>{hint}</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M9 4v9.5a2.5 2.5 0 0 0 5 0V8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 8.5 6.5 11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

    </section>
  );
}
