// An original, endlessly unfolding piece: felt piano, harp, warm strings and a soft bass in D, played live by the browser.
// Every world keeps the same key, so the music drifts between them with the bird; each changes the harmony, the
// touch and the sound of the place itself (river, falls, wind, embers).
const f = (m) => 440 * Math.pow(2, (m - 69) / 12);
const A = { D: [50, 57, 62, 66, 69], Dadd9: [50, 57, 64, 66, 69], Bm7: [47, 54, 62, 64, 69], G: [43, 50, 62, 66, 69], Gmaj: [43, 50, 59, 62, 66], A: [45, 52, 61, 64, 71], Asus: [45, 52, 62, 64, 69], Fsm: [42, 49, 57, 61, 64], Em7: [40, 52, 55, 62, 66], Elyd: [40, 52, 59, 62, 68], Bm: [47, 54, 59, 62, 66], Bsus: [47, 54, 57, 64, 66] };
const open = ['D', 'A', 'Bm7', 'G', 'Dadd9', 'Fsm', 'G', 'Asus'], calm = ['Dadd9', 'Gmaj', 'Bm7', 'Asus', 'Em7', 'G', 'D', 'Asus'], night = ['Dadd9', 'Elyd', 'Gmaj', 'Dadd9', 'Bm7', 'Elyd', 'G', 'Asus'], dark = ['Bm', 'Gmaj', 'Em7', 'Bsus', 'Bm', 'Fsm', 'G', 'Bsus'];
// chords, seconds per chord, piano, harp, strings, strings brightness, octave of the tune, [river, falls, wind, fire]
const W = {
  home: [open, 7.2, 0.8, 0.35, 0.8, 900, 0, [0.5, 0, 0.35, 0]], about: [calm, 7.2, 0.9, 0.4, 0.7, 800, 0, [0.6, 0, 0.2, 0]],
  education: [calm, 6.8, 0.55, 1, 0.6, 1000, 12, [0.35, 0, 0.15, 0]], labs: [open, 7, 0.7, 0.7, 0.8, 900, 0, [0.4, 1, 0.15, 0]],
  work: [open, 8, 0.8, 0.2, 0.85, 700, 0, [0.5, 0, 0.6, 0]], research: [calm, 8.4, 1, 0.3, 0.9, 700, 0, [0.35, 0, 0.1, 0]],
  skills: [calm, 8, 0.6, 0.6, 0.7, 1100, 12, [0.1, 0, 0.8, 0]], interests: [night, 9, 0.5, 0.9, 1, 1100, 12, [0, 0.25, 0.5, 0]],
  lab: [dark, 9, 0.75, 0, 1, 520, 0, [0, 0, 0.3, 1]], twin: [dark, 8.4, 0.8, 0.2, 1, 600, 0, [0, 0, 0.25, 0.8]], contact: [open, 7.2, 0.9, 0.6, 0.9, 1000, 0, [0.5, 0, 0.25, 0]],
};

export function createMusic(ctx, out = ctx.destination) {
  let seed = 77031; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const G = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -16; limit.ratio.value = 3; limit.attack.value = 0.02; limit.release.value = 0.4; limit.connect(out);
  const master = G(0, limit), duck = G(1, master), dry = G(0.62, duck), wet = G(0.9, duck), place = G(0.4, duck);
  // a long, dark hall
  const sr = ctx.sampleRate, n = Math.floor(sr * 3.8), ir = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0, e = 0; for (let i = 0; i < n; i++) { const t = i / sr, k = 0.55 * Math.exp(-t * 0.9) + 0.02; lp += ((R() * 2 - 1) - lp) * k; d[i] = lp * Math.exp(-t * 1.25) * Math.min(1, t / 0.03); e += d[i] * d[i]; } const s = 1 / Math.sqrt(e); for (let i = 0; i < n; i++) d[i] *= s; }
  const hall = ctx.createConvolver(); hall.normalize = false; hall.buffer = ir; hall.connect(wet);
  const bus = (dr, we) => { const g = G(1); g.connect(G(dr, dry)); g.connect(G(we, hall)); return g; };
  const piano = bus(0.8, 0.5), harp = bus(0.55, 0.75), strings = bus(0.4, 0.7), bass = bus(0.9, 0.15);
  const wave = (a) => ctx.createPeriodicWave(new Float32Array(a.length), Float32Array.from(a)), felt = wave([0, 1, 0.42, 0.16, 0.09, 0.035, 0.02, 0.008]), reed = wave([0, 1, 0.5, 0.34, 0.2, 0.15, 0.1, 0.07, 0.05, 0.035, 0.025]);
  const pan = (p, to) => { const s = ctx.createStereoPanner(); s.pan.value = p; s.connect(to); return s; };

  const vib = (fr) => { const l = ctx.createOscillator(), q = G(2.5); l.frequency.value = fr; l.connect(q); l.start(); return q; }, vibA = vib(4.3), vibB = vib(4.9);

  function key(t, m, v, len = 4.5) { // felt piano: soft hammer, tone darkening as it rings
    const g = G(0), lp = ctx.createBiquadFilter(), p = pan((m - 64) / 60, piano); lp.type = 'lowpass'; lp.Q.value = 0.3; lp.frequency.setValueAtTime(Math.min(6000, f(m) * (2.5 + v * 4)), t); lp.frequency.exponentialRampToValueAtTime(f(m) * 1.3 + 120, t + 1.8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.17, t + 0.014); g.gain.exponentialRampToValueAtTime(v * 0.065, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0002, t + len); lp.connect(g); g.connect(p);
    for (const d of [-2.2, 2.6]) { const o = ctx.createOscillator(); o.setPeriodicWave(felt); o.frequency.value = f(m); o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + len + 0.05); }
  }
  function pluck(t, m, v) { const g = G(0), p = pan(R() * 1.1 - 0.55, harp); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.1, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0002, t + 2.6); g.connect(p);
    for (const [k, a] of [[1, 1], [2.001, 0.35], [3.003, 0.1]]) { const o = ctx.createOscillator(), q = G(a, g); o.frequency.value = f(m) * k; o.connect(q); o.start(t); o.stop(t + 2.7); } }
  function pad(t, m, v, len, bright) { const g = G(0), lp = ctx.createBiquadFilter(), p = pan(R() * 0.9 - 0.45, strings), at = len * 0.45; lp.type = 'lowpass'; lp.Q.value = 0.2; lp.frequency.setValueAtTime(bright * 0.6, t); lp.frequency.linearRampToValueAtTime(bright, t + at); lp.frequency.linearRampToValueAtTime(bright * 0.5, t + len * 1.6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.04, t + at); g.gain.setValueAtTime(v * 0.04, t + len * 0.75); g.gain.linearRampToValueAtTime(0, t + len * 1.6); lp.connect(g); g.connect(p);
    for (const d of [-6, 6]) { const o = ctx.createOscillator(); o.setPeriodicWave(reed); o.frequency.value = f(m); o.detune.value = d; (d < 0 ? vibA : vibB).connect(o.detune); o.connect(lp); o.start(t + R() * 0.2); o.stop(t + len * 1.6 + 0.1); } }
  function low(t, m, v, len) { const g = G(0, bass), o = ctx.createOscillator(); o.frequency.value = f(m); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.1, t + 0.5); g.gain.linearRampToValueAtTime(0, t + len * 1.1); o.connect(g); o.start(t); o.stop(t + len * 1.15); }

  // the sound of the place: two long noise beds, filtered four ways
  const NL = sr * 11, nb = ctx.createBuffer(2, NL, sr); for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); let b = 0; for (let i = 0; i < NL; i++) { b = b * 0.985 + (R() * 2 - 1) * 0.12; d[i] = b; } const x = sr / 2; for (let i = 0; i < x; i++) { const k = i / x; d[i] = d[i] * Math.sqrt(k) + d[NL - x + i] * Math.sqrt(1 - k); } } // seamless loop
  const beds = [['bandpass', 620, 0.5, 0.17, 0.5], ['lowpass', 1500, 0.2, 0.17, 0.13], ['bandpass', 260, 0.9, 0.5, 0.07], ['lowpass', 110, 0.4, 0.2, 0.21]].map(([type, fr, q, base, lfo], i) => {
    const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), g = G(0, place), m = G(base, g), l = ctx.createOscillator(), lg = G(base * 0.4); s.buffer = nb; s.loop = true; s.loopEnd = NL / sr - 0.5; s.playbackRate.value = 1 - i * 0.07; b.type = type; b.frequency.value = fr; b.Q.value = q; s.connect(b); b.connect(m); l.frequency.value = lfo * 0.5; l.connect(lg); lg.connect(m.gain); l.start(); s.start(0, i * 2.3); return g; });
  function ember(t, v) { const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), g = G(0, pan(R() * 1.4 - 0.7, place)); s.buffer = nb; b.type = 'bandpass'; b.frequency.value = 900 + R() * 2200; b.Q.value = 3; g.gain.setValueAtTime(v * (0.5 + R()), t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.03 + R() * 0.05); s.connect(b); b.connect(g); s.start(t, R() * 8, 0.12); }

  let world = 'home', next = 0, bar = 0, line = 4, motif = null; const SCALE = [62, 64, 66, 69, 71, 74, 76, 78, 81];
  function chord(t) {
    const [set, len, pv, hv, sv, bright, oct] = W[world], c = A[set[bar % 8]], first = bar % 8 === 0;
    low(t, c[0] < 45 ? c[0] : c[0] - 12, 0.9, len); c.slice(1).forEach((m, i) => pad(t + i * 0.12, m, sv * (i > 2 ? 0.8 : 1), len, bright));
    // left hand: the chord opened out slowly, never quite on the grid
    const beat = len / 8, hum = () => (R() - 0.5) * 0.07, lh = [0, 1, 2, 3, 4, 3, 2, 1]; lh.forEach((k, i) => { if (i > 5 && R() < 0.5) return; if (i % 2 && R() < 0.25) return; key(t + i * beat + 0.05 + Math.abs(hum()), c[k] + (k === 0 ? 0 : 0), pv * (0.34 + 0.12 * (i === 0) + R() * 0.08), len * 0.8); });
    // right hand: a short idea, answered and varied, resting every fourth bar
    if (bar % 4 !== 3 || R() < 0.25) { if (!motif || bar % 4 === 0) { motif = []; let at = R() < 0.5 ? 0 : 1; const count = 3 + Math.floor(R() * 2); for (let i = 0; i < count; i++) { motif.push([at, Math.round((R() - 0.45) * 2.6)]); at += R() < 0.45 ? 1 : R() < 0.8 ? 2 : 1.5; } }
      motif.forEach(([at, step], i) => { line = Math.max(1, Math.min(7, line + step)); if (line > 5 && R() < 0.5) line--; let m = SCALE[line]; if (i === motif.length - 1) { const tones = c.map((x) => x % 12); for (let k = 0; k < 3 && !tones.includes(m % 12); k++) { line = Math.max(0, line - 1); m = SCALE[line]; } } key(t + at * beat + 0.1 + Math.abs(hum()), m + (R() < 0.7 ? oct : 0), pv * (0.62 + R() * 0.16), len * 0.75); }); }
    if (hv > 0 && R() < 0.35 + hv * 0.5) { const up = [...c.slice(2), ...c.slice(2).map((m) => m + 12)], s = beat * (2 + Math.floor(R() * 4)), gap = 0.11 + R() * 0.09; up.forEach((m, i) => pluck(t + s + i * gap, m + 12, hv * (0.75 - i * 0.06))); }
    if (first && R() < 0.8) key(t + beat * 4, SCALE[7] + 12, pv * 0.25, 6);
    const em = W[world][7][3]; if (em) for (let i = 0; i < len * 3 * em; i++) ember(t + R() * len, em * 0.5);
    bar++; return len;
  }
  return {
    // keep a few seconds of music scheduled ahead
    run(now, ahead = 2.5) { if (next < now) next = now + 0.1; while (next < now + ahead) next += chord(next); },
    world(id, t, fade = 3) { if (!W[id]) return; world = id; W[id][7].forEach((v, i) => beds[i].gain.setTargetAtTime(v, t, fade / 2)); },
    volume(v, t, k = 0.8) { master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(v, t, k); },
    duck(on, t) { duck.gain.setTargetAtTime(on ? 0.35 : 1, t, 0.5); },
  };
}
