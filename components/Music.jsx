'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

// Browsers only allow sound after the visitor touches the page, so the music fades in on the first click, tap or key.
export default function Music() {
  const [on, setOn] = useState(true), st = useRef({ want: true, place: 'home' });

  useEffect(() => {
    const s = st.current; let dead = false, timer = 0;
    try { s.want = localStorage.getItem('music') !== 'off'; } catch {}
    setOn(s.want);
    s.start = async () => {
      if (s.ctx || s.loading || dead) return; s.loading = true;
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ctx = new C({ latencyHint: 'playback' }); ctx.resume();
      const { createMusic } = await import('./world/music.js'); if (dead || !s.want) { s.loading = false; ctx.close(); return; }
      s.ctx = ctx; s.m = createMusic(ctx); s.m.world(s.place, ctx.currentTime, 0.1); s.m.volume(0.8, ctx.currentTime, 2.2);
      const tick = () => { if (s.want && ctx.state === 'running') s.m.run(ctx.currentTime, document.hidden ? 8 : 2.5); }; timer = setInterval(tick, 400); tick();
    };
    const first = (e) => { if (e.target.closest?.('.soundtoggle')) return; if (s.want) s.start(); };
    const place = (e) => { s.place = e.detail; s.m?.world(e.detail, s.ctx.currentTime); };
    const speak = (e) => s.m?.duck(e.detail.state === 'speaking', s.ctx.currentTime);
    const vis = () => { if (!s.ctx) return; document.hidden ? s.ctx.suspend() : s.want && s.ctx.resume(); };
    window.addEventListener('pointerdown', first, { passive: true }); window.addEventListener('keydown', first); window.addEventListener('worldstop', place); window.addEventListener('phoenix', speak); document.addEventListener('visibilitychange', vis);
    return () => { dead = true; clearInterval(timer); clearTimeout(s.rest); s.ctx?.close(); s.ctx = s.m = null; s.loading = false; window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); window.removeEventListener('worldstop', place); window.removeEventListener('phoenix', speak); document.removeEventListener('visibilitychange', vis); };
  }, []);

  function toggle() {
    const s = st.current, playing = s.want && s.ctx; s.want = !playing; setOn(s.want); // a first press starts the music
    try { localStorage.setItem('music', s.want ? 'on' : 'off'); } catch {}
    clearTimeout(s.rest);
    if (s.want) { if (s.ctx) { s.ctx.resume(); s.m.volume(0.8, s.ctx.currentTime, 0.8); } else s.start(); }
    else { s.m.volume(0, s.ctx.currentTime, 0.4); s.rest = setTimeout(() => !s.want && s.ctx?.suspend(), 2500); }
  }
  return <button type="button" className="soundtoggle" onClick={toggle} aria-pressed={on} aria-label={on ? 'Music on' : 'Music off'} title={on ? 'Music on' : 'Music off'}>{on ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>;
}
