'use client';
import { useEffect, useRef, useState } from 'react';
import { STOPS } from './world/stops';

export default function World() {
  const host = useRef(null);
  const [stop, setStop] = useState(0);

  useEffect(() => {
    let dispose, cancelled = false;
    const el = host.current;
    import('./world/index.js').then(async ({ createWorld, loadRelief }) => {
      await loadRelief();
      if (cancelled) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      dispose = createWorld(el, { reduced, onStop: setStop });
    }).catch((err) => console.warn('3D world unavailable, showing the static backdrop.', err));
    return () => { cancelled = true; dispose?.(); };
  }, []);

  useEffect(() => { window.dispatchEvent(new CustomEvent('worldstop', { detail: STOPS[stop].id })); }, [stop]);

  return (
    <>
      <div className="world" ref={host} aria-hidden="true" />
      <div className="worldshade" aria-hidden="true" data-stop={STOPS[stop].id} />
      <nav className="flightpath" aria-label="Flight path">
        {STOPS.map((s, i) => (
          <a key={s.id} href={`#${s.id}`} className={i === stop ? 'on' : ''} aria-current={i === stop ? 'location' : undefined}><span>{s.place}</span><i /></a>
        ))}
      </nav>
    </>
  );
}
