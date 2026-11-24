import * as THREE from 'three';
import { lerp, smooth, noise } from './common';
import { STOPS, zOf, at } from './stops';
import { center } from './landscape';

export const heading = (z) => Math.atan2(center(z - 12) - center(z + 12), -24); // yaw of +Z when flying onward
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const ACTS = { wings: 6, fire: 4.6, both: 6.5, eat: 6.4 };

/* Decides what the bird is doing: flying the path, circling, landing, resting, or taking off.
   While resting it picks random actions: spread wings, breathe fire, both, or eat. */
export function createBehaviour(perches) {
  const pos = new THREE.Vector3(), prev = new THREE.Vector3(), p0 = new THREE.Vector3(), m0 = new THREE.Vector3(), m1 = new THREE.Vector3(), F = new THREE.Vector3(), vel = new THREE.Vector3(), perchAt = new THREE.Vector3();
  const out = { pos, yaw: 0, pitch: 0, bank: 0, stand: 0, fold: 0, lift: 0, amp: 0.7, flap: 3.6, neck: 0, neckYaw: 0, tail: 0, fire: 0, eat: 0, peck: 0, crouch: 0, state: 'fly', act: null, perch: null, base: new THREE.Vector3(), offset: new THREE.Vector3(), speed: 0, rest: 0 };
  let cine = null, seen = false, dir = 1, k = 0, S = 0, tau = 0, t = 0, T = 1, idle = 0, actT = 0, wait = 0, last = null, perchYaw = 0, started = false, bankRate = 0, glide = 0;

  // how fast the path may move: the bird finishes turning before it flies the other way
let travel = 0;
  out.align = () => (out.state === 'perch' || out.state === 'cine' ? 0.02 : Math.max(0.02, Math.min(1, Math.cos(out.yaw - travel) * 1.5 - 0.35)));

  function pickAct() { const names = Object.keys(ACTS).filter((n) => n !== last); last = out.act = names[Math.floor(Math.random() * names.length)]; actT = 0; }

  // Film entrance: fold, dive into the clouds, burst out with wings thrown wide, hang there, then settle.
  function startCine(b, camYaw, faceSign) {
    const { L, Rt, deck } = b.cine, c = new THREE.Vector3(b.x, 0, b.z), at = (r, y, f) => new THREE.Vector3(c.x + Rt.x * r + L.x * f, y, c.z + Rt.z * r + L.z * f);
    out.perch = b; seen = true; perchAt.set(b.x, b.y + 1.36, b.z); perchYaw = camYaw + faceSign * 0.5; out.state = 'cine'; t = 0;
    const keys = [[0, pos.clone()], [0.9, at(-4, b.y + 17, 20)], [1.5, at(-9, b.y + 13, 32)], [2.5, at(-13, deck - 4, 40)], [3.0, at(-13, deck - 26, 38)], [3.9, at(-8, deck - 22, 24)], [4.5, at(-5.5, deck + 6, 18)], [5.2, at(-3.6, b.y - 6, 13)], [5.9, at(-2.4, b.y + 8.5, 9)], [7.2, at(-1.4, b.y + 9.6, 6)], [8.3, at(-0.3, b.y + 4.2, 1.6)], [9.0, perchAt.clone()]];
    cine = { keys, in: false, out: false, camYaw };
  }
  function cineAt(time, v) { const k = cine.keys; let i = 0; while (i < k.length - 2 && time > k[i + 1][0]) i++; const g = (j) => k[Math.max(0, Math.min(k.length - 1, j))], a = g(i), b = g(i + 1), h = b[0] - a[0], s = Math.min(1, Math.max(0, (time - a[0]) / h)), m = (j, p, n) => p[1].clone().sub(n[1]).divideScalar(p[0] - n[0]), ma = i === 0 ? m(0, b, a) : m(0, b, g(i - 1)), mb = i + 2 >= k.length ? new THREE.Vector3(0, -1.2, 0) : m(0, g(i + 2), a), s2 = s * s, s3 = s2 * s; return v.set(0, 0, 0).addScaledVector(a[1], 2 * s3 - 3 * s2 + 1).addScaledVector(ma, (s3 - 2 * s2 + s) * h).addScaledVector(b[1], -2 * s3 + 3 * s2).addScaledVector(mb, (s3 - s2) * h); }

  out.play = (n) => { out.act = last = n; actT = 0; };

  out.step = (dt, time, { P, targetP, alt, hover, scrolling, camYaw, faceSign }) => {
    const delta = targetP - P, z = zOf(P), S0 = out.state, tag0 = STOPS[Math.round(P)]?.tag;
    if (Math.abs(delta) > 0.006) dir = Math.sign(delta); 
    idle = scrolling || Math.abs(delta) > 0.004 ? 0 : idle + dt;
    const TW = at('twin'), landable = P > 0.62 && (P < TW - 0.5 || P > TW + 0.62), soaring = P < 0.4 && idle > 0.6;
    if ((hover > 0.5 || soaring) && idle > 0.5) dir = 1;

    // half-turn when travel direction flips; instant while standing, the take-off covers it
    const wantK = dir > 0 ? 0 : 1; k = S0 === 'perch' ? wantK : k + Math.max(-dt * 1.35, Math.min(dt * 1.35, wantK - k));
    const ke = smooth(0, 1, k), arc = 4 * k * (1 - k), h0 = heading(z), right = -Math.cos(h0), fwd = Math.sin(h0);

    S = damp(S, soaring ? 1 : 0, soaring ? 0.7 : 1.3, dt); if (S < 0.01) tau = 0; else tau += dt * 0.42;
    out.base.set(center(z), alt, z);
    F.copy(out.base); F.x += right * arc * 5; F.z += -fwd * 0 ; F.y += noise(time * 0.15, 5) * 0.7 + Math.sin(time * 0.8) * 0.3 + arc * 0.8 + S * Math.sin(tau * 2) * 1.1;
    F.x += noise(time * 0.12, 3) * 1.2 * (1 - S) - S * 5 * (1 - Math.cos(tau)); F.z += -S * 8 * Math.sin(tau);
    const yaw0 = h0 + Math.PI * ke, a = Math.sin(yaw0) * (1 - S) - S * 5 * Math.sin(tau), b = Math.cos(yaw0) * (1 - S) - S * 8 * Math.cos(tau);
    travel = h0 + (dir > 0 ? 0 : Math.PI);
    let yawT = Math.atan2(a, b), turnK = 9;

    if (!started) { pos.copy(F); out.yaw = yawT; started = true; }
    prev.copy(pos); t += dt; out.cineT = S0 === 'cine' ? t : 0;

    if (S0 === 'fly') {
      pos.copy(F);
      if (landable && idle > 0.75 && arc < 0.02 && hover < 0.05) {
        let best = null, bd = 34; const tag = STOPS[Math.round(P)]?.tag; for (const p of perches) { if ((p.tag || undefined) !== tag || (tag && Math.abs(P - Math.round(P)) > 0.2)) continue; const d = Math.abs(p.z - (z - dir * (STOPS[Math.round(P)]?.hold ? 1 : 9))); if (d < bd) { bd = d; best = p; } }
        if (best && best.cine && !seen) { startCine(best, camYaw, faceSign); } else if (best) { out.perch = best; perchAt.set(best.x, best.y + 1.36, best.z); p0.copy(pos); const dist = p0.distanceTo(perchAt); T = Math.min(4, Math.max(2.3, dist / 9));
          m0.set(Math.sin(out.yaw), 0, Math.cos(out.yaw)).multiplyScalar(dist * 1.1); m1.copy(perchAt).sub(p0).setY(0).multiplyScalar(0.5); m1.y = -1.5; perchYaw = camYaw + faceSign * (best.face ?? 0.85); out.state = 'land'; t = 0; }
      }
    } else if (S0 === 'cine') {
      cineAt(Math.min(t, 9), pos); turnK = 5;
      if (!cine.in && t > 2.35) { cine.in = true; out.event = ['in', pos.clone()]; } if (!cine.out && t > 4.42) { cine.out = true; out.event = ['out', pos.clone()]; }
      if (idle === 0) { out.state = 'takeoff'; t = 0.2; p0.copy(pos); } else if (t >= 9) { out.state = 'perch'; t = 0; out.act = null; wait = 2.4; }
    } else if (S0 === 'land') {
      const q = Math.min(1, t / T), e = q * (1.55 - 0.55 * q * q) / 1, s = Math.min(1, e), s2 = s * s, s3 = s2 * s;
      pos.set(0, 0, 0).addScaledVector(p0, 2 * s3 - 3 * s2 + 1).addScaledVector(m0, s3 - 2 * s2 + s).addScaledVector(perchAt, -2 * s3 + 3 * s2).addScaledVector(m1, s3 - s2); pos.y += Math.sin(Math.PI * s) * 1.4;
      if (idle === 0) { out.state = 'takeoff'; t = 0.2; p0.copy(pos); }
      else if (q >= 1) { out.state = 'perch'; t = 0; out.act = null; wait = 1.6; }
    } else if (S0 === 'perch') {
      pos.copy(perchAt); yawT = perchYaw; turnK = 4;
      if (out.act) { actT += dt; if (actT > ACTS[out.act]) { out.act = null; wait = 1.4 + Math.random() * 2.2; } }
      else if ((wait -= dt) < 0) pickAct();
      if (idle === 0) { out.state = 'takeoff'; t = 0; p0.copy(pos); out.act = null; }
    } else { // takeoff: crouch, leap, climb back to the path
      const q = Math.min(1, Math.max(0, (t - 0.35) / 1.75)), e = q * q * (3 - 2 * q);
      pos.copy(p0).lerp(F, e); pos.y += Math.sin(Math.PI * Math.min(1, q * 1.15)) * 2.2 * (q < 0.87 ? 1 : 0.0) + (q >= 0.87 ? 0 : 0);
      if (q >= 1) { out.state = 'fly'; out.perch = null; }
    }

    vel.copy(pos).sub(prev).divideScalar(Math.max(dt, 0.001)); out.speed = damp(out.speed, Math.min(1.5, vel.length() / 60), 4, dt);
    if (S0 === 'land') { const q = t / T; if (Math.hypot(vel.x, vel.z) > 1.5) yawT = Math.atan2(vel.x, vel.z); if (q > 0.62) yawT = yawT + wrap(perchYaw - yawT) * smooth(0.62, 1, q); turnK = 5; }
    if (S0 === 'takeoff') { k = wantK; const fx = F.x - pos.x, fz = F.z - pos.z; if (Math.hypot(fx, fz) > 5) yawT = Math.atan2(fx, fz); else yawT = h0 + Math.PI * wantK; turnK = 8; }
    if (S0 === 'cine') { if (t < 4.2 && Math.hypot(vel.x, vel.z) > 1.5) yawT = Math.atan2(vel.x, vel.z); else yawT = cine.camYaw + (perchYaw - cine.camYaw) * smooth(7.2, 9, t); turnK = t > 3 && t < 4.4 ? 14 : 5; }
    if (!(tag0 === 'isles')) seen = false;
    const dy = wrap(yawT - out.yaw), st = dy * (1 - Math.exp(-turnK * dt)), cap = (S0 === 'takeoff' ? 6 : S0 === 'cine' ? 9 : 4.2) * dt, turn = Math.max(-cap, Math.min(cap, st)); out.yaw = wrap(out.yaw + turn);
    bankRate = damp(bankRate, turn / Math.max(dt, 0.001), 5, dt);

    // pose targets
    const resting = out.state === 'perch', landQ = S0 === 'land' ? smooth(0.5, 0.95, t / T) : S0 === 'cine' ? smooth(7.9, 8.7, t) : 0, up = S0 === 'takeoff' ? 1 - smooth(0.25, 1, t) : 0, stand = resting ? 1 : Math.max(landQ, up);
    out.rest = damp(out.rest, resting ? 1 : 0, 5, dt); out.stand = damp(out.stand, stand, 9, dt);
    const D = out.act ? ACTS[out.act] : 1, env = out.act ? smooth(0, 1.1, actT) * (1 - smooth(D - 1.1, D, actT)) : 0;
    const w = out.act === 'wings' || out.act === 'both' ? env : 0, f = out.act === 'fire' || out.act === 'both' ? env : 0, ea = out.act === 'eat' ? env : 0;
    out.fire = f > 0.75 ? 1 : 0; out.eat = damp(out.eat, ea, 5, dt);
    const beat = (actT - 0.9) / 1.25, fr = beat - Math.floor(beat); out.peck = ea > 0.6 ? smooth(0, 0.22, fr) * (1 - smooth(0.34, 0.62, fr)) : 0;
    out.fold = damp(out.fold, resting ? 1 - Math.max(w, f * 0.4) : 0, resting ? 3.2 : 9, dt);
    out.lift = damp(out.lift, resting ? w * (0.62 + 0.05 * Math.sin(time * 1.6)) : 0, 3.5, dt);
    out.crouch = S0 === 'takeoff' && t < 0.2 ? smooth(0, 0.2, t) * 0.25 : damp(out.crouch, 0, 8, dt);
    glide = damp(glide, smooth(0.05, 0.45, noise(time * 0.17, 20) + S * 0.25), 2, dt) ;
    const fly = 1 - out.rest, g = glide * (1 - hover) * (1 - Math.min(1, out.speed * 1.4)) * (1 - landQ) * (1 - up) * (S0 === 'takeoff' ? 0 : 1);
    out.amp = damp(out.amp, resting ? 0 : lerp(0.78, 0.2, g) + hover * 0.12 + landQ * 0.22 + (S0 === 'takeoff' ? 0.3 : 0), resting ? 6 : 7, dt);
    out.flap = lerp(3.8, 1.7, g) + out.speed * 1.8 + hover * 1.4 + landQ * 4.5 + (S0 === 'takeoff' ? 4.2 * (1 - smooth(1, 1.9, t)) : 0);
    const flare = S0 === 'land' ? smooth(0.55, 0.85, t / T) * 0.35 : 0;
    out.pitch = lerp(-0.05 - hover * 0.62 - (S0 === 'takeoff' ? 0.4 * Math.sin(Math.PI * Math.min(1, t / 1.6)) : 0), -0.78 - flare, Math.max(out.stand, out.rest)) + out.eat * 0.58 + out.peck * 0.16 - f * 0.1;
    { const climb = S0 === 'perch' ? 0 : Math.atan2(vel.y, Math.max(6, Math.hypot(vel.x, vel.z))); out.climb = damp(out.climb || 0, Math.max(-0.75, Math.min(0.75, climb)) * (1 - out.stand) * (S0 === 'fly' ? 1 : 0), 3, dt); out.pitch -= out.climb; }
    out.bank = (Math.max(-0.75, Math.min(0.75, -bankRate * 0.42)) + noise(time * 0.2, 9) * 0.12 * (1 - hover)) * fly * (1 - out.stand);
    out.neck = damp(out.neck, resting ? 0.72 - w * 0.18 - f * 0.3 + ea * 0.15 + out.peck * 0.95 + noise(time * 0.35, 60) * 0.12 * (1 - env) : Math.max(out.stand * 0.6, 0) + Math.sin(time * 1.1) * 0.03, out.peck > 0.01 ? 16 : 6, dt);
    const look = Math.sign(noise(time * 0.45, 70)) * smooth(0.12, 0.3, Math.abs(noise(time * 0.45, 70))) * 0.75;
    out.neckYaw = damp(out.neckYaw, resting ? (f > 0.05 ? -faceSign * -0.35 * f : look * (1 - env * 0.8)) : noise(time * 0.25, 40) * 0.3 * (1 - hover), 5, dt);
    out.tail = damp(out.tail, hover * 0.75 + out.rest * -0.2, 4, dt);
    if (S0 === 'cine') {
      const dive = smooth(0.9, 1.6, t) * (1 - smooth(3.6, 4.2, t)), burst = smooth(4.25, 4.5, t) * (1 - smooth(5.5, 6.1, t)), spread = smooth(5.3, 6.0, t) * (1 - smooth(8.2, 8.9, t));
      out.fold = damp(out.fold, dive * 0.72, 7, dt); out.amp = damp(out.amp, dive > 0.4 ? 0.04 : burst > 0.3 ? 1.05 : spread > 0.2 ? 0.16 : 0.8, 8, dt); out.flap = burst > 0.3 ? 9.5 : spread > 0.3 ? 2.0 : 4.2; out.lift = damp(out.lift, spread * 0.46 + burst * 0.2, 5, dt);
      const climb = Math.atan2(vel.y, Math.max(3, Math.hypot(vel.x, vel.z))); out.pitch = damp(out.cp ?? 0, t < 4.2 ? -climb * 0.95 : -1.12 * smooth(4.2, 4.6, t) + 0.28 * spread - 0.0, 7, dt); out.cp = out.pitch; out.neck = damp(out.neck, t < 4.2 ? 0.1 : 0.72 + 0.42 * smooth(6, 6.4, t) * (1 - smooth(7.4, 7.9, t)), 5, dt); out.neckYaw = damp(out.neckYaw, 0.35 * faceSign * smooth(6, 6.4, t) * (1 - smooth(7.4, 7.9, t)), 5, dt); out.tail = damp(out.tail, spread * 0.55 + burst * 0.2, 4, dt); out.bank *= 1 - Math.max(burst, spread); out.glow = burst + spread * 0.8; out.fire = t > 6.3 && t < 7.4 ? 1 : 0;
    } else { out.cp = out.pitch; out.glow = damp(out.glow || 0, 0, 2, dt); }
    out.offset.copy(pos).sub(out.base); out.S = S;
  };
  return out;
}
