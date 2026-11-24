import * as THREE from 'three';
import { lerp, smooth, noise } from './common';
import { STOP_GAP } from './stops';
import { center } from './landscape';

export const heading = (z) => Math.atan2((center(z - 12) - center(z + 12)) * 0.9, -24); // yaw of +Z when flying onward
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const ACTS = { wings: 6, fire: 4.6, both: 6.5, eat: 6.4 };

/* Decides what the bird is doing: flying the path, circling, landing, resting, or taking off.
   While resting it picks random actions: spread wings, breathe fire, both, or eat. */
export function createBehaviour(perches) {
  const pos = new THREE.Vector3(), prev = new THREE.Vector3(), p0 = new THREE.Vector3(), m0 = new THREE.Vector3(), m1 = new THREE.Vector3(), F = new THREE.Vector3(), vel = new THREE.Vector3(), perchAt = new THREE.Vector3();
  const out = { pos, yaw: 0, pitch: 0, bank: 0, stand: 0, fold: 0, lift: 0, amp: 0.7, flap: 3.6, neck: 0, neckYaw: 0, tail: 0, fire: 0, eat: 0, peck: 0, crouch: 0, state: 'fly', act: null, perch: null, base: new THREE.Vector3(), offset: new THREE.Vector3(), speed: 0, rest: 0 };
  let dir = 1, k = 0, S = 0, tau = 0, t = 0, T = 1, idle = 0, actT = 0, wait = 0, last = null, perchYaw = 0, started = false, bankRate = 0, glide = 0;

  // how fast the path may move: the bird finishes turning before it flies the other way
let travel = 0;
  out.align = () => (out.state === 'perch' ? 0.02 : Math.max(0.02, Math.min(1, Math.cos(out.yaw - travel) * 1.5 - 0.35)));

  function pickAct() { const names = Object.keys(ACTS).filter((n) => n !== last); last = out.act = names[Math.floor(Math.random() * names.length)]; actT = 0; }

  out.play = (n) => { out.act = last = n; actT = 0; };

  out.step = (dt, time, { P, targetP, alt, hover, scrolling, camYaw, faceSign }) => {
    const delta = targetP - P, z = -P * STOP_GAP, S0 = out.state;
    if (Math.abs(delta) > 0.006) dir = Math.sign(delta); 
    idle = scrolling || Math.abs(delta) > 0.004 ? 0 : idle + dt;
    const landable = P > 0.62 && (P < 5.5 || P > 6.62), soaring = P < 0.4 && idle > 0.6;
    if ((hover > 0.5 || soaring) && idle > 0.5) dir = 1;

    // half-turn when travel direction flips; instant while standing, the take-off covers it
    const wantK = dir > 0 ? 0 : 1; k = S0 === 'perch' ? wantK : k + Math.max(-dt * 1.35, Math.min(dt * 1.35, wantK - k));
    const ke = smooth(0, 1, k), arc = 4 * k * (1 - k), h0 = heading(z), right = -Math.cos(h0), fwd = Math.sin(h0);

    S = damp(S, soaring ? 1 : 0, soaring ? 0.7 : 1.3, dt); if (S < 0.01) tau = 0; else tau += dt * 0.42;
    out.base.set(center(z) * 0.9, alt, z);
    F.copy(out.base); F.x += right * arc * 5; F.z += -fwd * 0 ; F.y += noise(time * 0.15, 5) * 0.7 + Math.sin(time * 0.8) * 0.3 + arc * 0.8 + S * Math.sin(tau * 2) * 1.1;
    F.x += noise(time * 0.12, 3) * 1.2 * (1 - S) - S * 5 * (1 - Math.cos(tau)); F.z += -S * 8 * Math.sin(tau);
    const yaw0 = h0 + Math.PI * ke, a = Math.sin(yaw0) * (1 - S) - S * 5 * Math.sin(tau), b = Math.cos(yaw0) * (1 - S) - S * 8 * Math.cos(tau);
    travel = h0 + (dir > 0 ? 0 : Math.PI);
    let yawT = Math.atan2(a, b), turnK = 9;

    if (!started) { pos.copy(F); out.yaw = yawT; started = true; }
    prev.copy(pos); t += dt;

    if (S0 === 'fly') {
      pos.copy(F);
      if (landable && idle > 0.75 && arc < 0.02 && hover < 0.05) {
        let best = null, bd = 34; for (const p of perches) { const d = Math.abs(p.z - (z - dir * 9)); if (d < bd) { bd = d; best = p; } }
        if (best) { out.perch = best; perchAt.set(best.x, best.y + 1.36, best.z); p0.copy(pos); const dist = p0.distanceTo(perchAt); T = Math.min(4, Math.max(2.3, dist / 9));
          m0.set(Math.sin(out.yaw), 0, Math.cos(out.yaw)).multiplyScalar(dist * 1.1); m1.copy(perchAt).sub(p0).setY(0).multiplyScalar(0.5); m1.y = -1.5; perchYaw = camYaw + faceSign * 0.85; out.state = 'land'; t = 0; }
      }
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
    const dy = wrap(yawT - out.yaw), st = dy * (1 - Math.exp(-turnK * dt)), cap = (S0 === 'takeoff' ? 6 : 4.2) * dt, turn = Math.max(-cap, Math.min(cap, st)); out.yaw = wrap(out.yaw + turn);
    bankRate = damp(bankRate, turn / Math.max(dt, 0.001), 5, dt);

    // pose targets
    const resting = out.state === 'perch', landQ = S0 === 'land' ? smooth(0.5, 0.95, t / T) : 0, up = S0 === 'takeoff' ? 1 - smooth(0.25, 1, t) : 0, stand = resting ? 1 : Math.max(landQ, up);
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
    out.bank = (Math.max(-0.75, Math.min(0.75, -bankRate * 0.42)) + noise(time * 0.2, 9) * 0.12 * (1 - hover)) * fly * (1 - out.stand);
    out.neck = damp(out.neck, resting ? 0.72 - w * 0.18 - f * 0.3 + ea * 0.15 + out.peck * 0.95 + noise(time * 0.35, 60) * 0.12 * (1 - env) : Math.max(out.stand * 0.6, 0) + Math.sin(time * 1.1) * 0.03, out.peck > 0.01 ? 16 : 6, dt);
    const look = Math.sign(noise(time * 0.45, 70)) * smooth(0.12, 0.3, Math.abs(noise(time * 0.45, 70))) * 0.75;
    out.neckYaw = damp(out.neckYaw, resting ? (f > 0.05 ? -faceSign * -0.35 * f : look * (1 - env * 0.8)) : noise(time * 0.25, 40) * 0.3 * (1 - hover), 5, dt);
    out.tail = damp(out.tail, hover * 0.75 + out.rest * -0.2, 4, dt);
    out.offset.copy(pos).sub(out.base); out.S = S;
  };
  return out;
}
