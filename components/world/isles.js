import * as THREE from 'three';
import { GLSL, rng, lerp, smooth, noise } from './common';
import { CONE, center, groundMaterial } from './landscape';
import { createCastle } from './castle';
import { fallMaterial } from './waterfall';

const V = (x, y, z) => new THREE.Vector3(x, y, z), BOT = 322, TOP = 384;
const fbm = (x, y, o = 5) => { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * noise(x, y); x = x * 2.03 + 13.7; y = y * 2.03 + 5.1; a *= 0.5; } return s; };
const n3 = (x, y, z) => (noise(x + 7.1, y - 3.3) + noise(y + 1.7, z + 9.2) + noise(z - 5.5, x + 2.8)) / 3;

/* One floating island. The plan is an irregular coastline, the top a small landscape with a stream bed,
   the sides broken strata, and the underside a root of fractured rock rather than a smooth cone. */
function isle(seed, R0, depth, A, streamA) {
  const T = 34, B = Math.round(A * 0.62), pos = [], ao = [], idx = [];
  const wrapD = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const rim = (a) => R0 * (1 + 0.46 * fbm(Math.cos(a) * 1.1 + seed, Math.sin(a) * 1.1 - seed, 5)) * (1 - 0.12 * Math.exp(-Math.pow(wrapD(a, streamA) / 0.12, 2)));
  const topY = (a, r, rr) => { const x = Math.cos(a) * rr * r, z = Math.sin(a) * rr * r, across = wrapD(a, streamA) * r * rr; const bed = Math.exp(-Math.pow(across / (R0 * 0.07), 2)) * smooth(0.06, 0.3, r) * (Math.cos(wrapD(a, streamA)) > 0 ? 1 : 0); return R0 * (0.30 * fbm(x / R0 * 1.2 + seed, z / R0 * 1.2) * smooth(1, 0.55, r) + 0.16 * (1 - r) + 0.035 * fbm(x / R0 * 7, z / R0 * 7 + seed)) - R0 * 0.075 * bed - R0 * 0.03 * r * r; };
  for (let j = 0; j <= T + B; j++) for (let i = 0; i <= A; i++) { const a = (i % A) / A * 6.28318, rr = rim(a); let x, y, z, o = 1;
    if (j <= T) { const r = Math.pow(j / T, 0.82); x = Math.cos(a) * rr * r; z = Math.sin(a) * rr * r; y = topY(a, r, rr); }
    else { const t = (j - T) / B, e = topY(a, 1, rr), lobe = 0.55 + 0.9 * Math.max(0, 0.5 + fbm(Math.cos(a) * 1.7 + seed * 2, Math.sin(a) * 1.7, 4));
      const prof = t < 0.07 ? 1 + 0.4 * t : Math.pow(1 - (t - 0.07) / 0.93, 0.78); let r = rr * prof; y = e - depth * (0.9 * t) * lerp(1, lerp(1, lobe, 0.7), smooth(0.1, 0.7, t));
      x = Math.cos(a) * r; z = Math.sin(a) * r; const k = smooth(0, 0.08, t) * smooth(1, 0.94, t);
      const ledge = Math.sin(y * 1.35 + 3 * noise(x * 0.06, z * 0.06)) * 0.035 + noise(y * 0.9 + seed, a * 1.3) * 0.05, crack = Math.pow(1 - Math.abs(noise(a * 6 + noise(y * 0.15, seed) * 1.5, y * 0.035 + seed)), 5);
      let d = R0 * k * (0.30 * n3(x * 0.07 + seed, y * 0.07, z * 0.07) + 0.15 * n3(x * 0.17, y * 0.14 + seed, z * 0.17) + 0.045 * n3(x * 0.42, y * 0.34, z * 0.42 + seed) + ledge * 0.8 - 0.055 * crack);
      x += Math.cos(a) * d; z += Math.sin(a) * d; y += R0 * 0.05 * k * n3(x * 0.14 + 4, y * 0.14, z * 0.14); o = lerp(0.85, 0.5, smooth(0, 0.25, t)) - 0.28 * crack * k; }
    pos.push(x, y, z); ao.push(o); if (j < T + B && i < A) { const k = j * (A + 1) + i; idx.push(k, k + 1, k + A + 1, k + 1, k + A + 2, k + A + 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aAo', new THREE.Float32BufferAttribute(ao, 1)); g.setIndex(idx); g.computeVertexNormals();
  return { g, rim, topY, R0, depth, streamA };
}

/* The great island: one landmass with mountains, a lake, a river that cascades from the snow to the rim,
   forests that follow the ground, and a crag for the castle. Local axes: x = viewer's right, z = away from the viewer. */
const R0 = 150, CRAG = { x: 42, z: 0, r: 43, y: 46 }, LAKE = { x: -52, z: 2, r: 33, y: 19 };
const RIVER = [[-30, 104, 54], [-34, 94, 46], [-28, 82, 38], [-42, 68, 32], [-32, 52, 25.5], [-46, 36, 20], [-52, 18, 19], [-48, -14, 19], [-34, -34, 17], [-14, -48, 12.5], [-22, -68, 8], [-10, -86, 4.5], [-14, -104, 1], [-8, -120, -2.5]];
const rimAt = (a) => R0 * (1 + 0.34 * fbm(Math.cos(a) * 1.25 + 4.4, Math.sin(a) * 1.25 - 2.2, 5));
const END = (() => { const a = Math.atan2(-120, -8), r = rimAt(a); return [Math.cos(a) * r, Math.sin(a) * r]; })();
const RS = (() => { const P = [...RIVER.slice(0, -1), [END[0], END[1], -3.5]], out = [], cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t); for (let i = 0; i < P.length - 1; i++) { const p = [P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(P.length - 1, i + 2)]]; for (let k = 0; k < 14; k++) { const t = k / 14; out.push([cr(p[0][0], p[1][0], p[2][0], p[3][0], t), cr(p[0][1], p[1][1], p[2][1], p[3][1], t), lerp(p[1][2], p[2][2], smooth(0, 1, t))]); } } out.push([END[0], END[1], -3.5]); return out; })();
const riverW = (i) => lerp(1.5, 5.2, i / RS.length);
function near(x, z) { let d = 1e9, k = 0; for (let i = 0; i < RS.length; i++) { const q = (RS[i][0] - x) ** 2 + (RS[i][1] - z) ** 2; if (q < d) { d = q; k = i; } } return [Math.sqrt(d), k]; }
function ground(x, z) {
  const a = Math.atan2(z, x), rr = rimAt(a), r = Math.hypot(x, z) / rr;
  let y = -1 + 25 * smooth(-125, 70, z) + 7 * fbm(x * 0.018 + 3, z * 0.018, 4) + 1.6 * fbm(x * 0.07, z * 0.07 + 8, 3);
  let rid = 0, w = 1, f = 0.0135, am = 0.5; const wx = x + 16 * noise(x * 0.02, z * 0.02 + 4), wz = z + 16 * noise(x * 0.02 + 9, z * 0.02); for (let i = 0; i < 7; i++) { let n = 1 - Math.abs(noise(wx * f + i * 11.3 + 1.7, wz * f - i * 7.7)); n *= n * w; w = Math.min(1, n * 1.8); rid += n * am; am *= 0.5; f *= 2.05; }
  const back = smooth(8, 105, z + 0.22 * Math.abs(x + 20) - 14 + 16 * noise(x * 0.02, 5)), side = smooth(60, 128, Math.abs(x + 12)) * smooth(-70, 10, z) * 0.45;
  y += (22 + rid * 104) * Math.max(back, side) * (0.7 + 0.45 * Math.exp(-Math.pow((x + 40) / 70, 2))) * smooth(1.02, 0.78, r) + 2.4 * back * noise(x * 0.13, z * 0.13);
  y -= 9 * smooth(0.84, 1, r) * (0.7 + 0.5 * noise(x * 0.04, z * 0.04)) + smooth(0.9, 1, r) * (2.2 * noise(x * 0.16, z * 0.16) + 1.4 * noise(x * 0.4, z * 0.4));
  // castle crag
  const cd = Math.hypot(x - CRAG.x, (z - CRAG.z)) * (1 + 0.16 * noise(Math.atan2(z - CRAG.z, x - CRAG.x) * 2.2, 3)), c0 = smooth(CRAG.r + 30, CRAG.r, cd), c1 = 0.55 * c0 + 0.25 * smooth(0.28, 0.42, c0 + 0.1 * noise(x * 0.06, z * 0.06)) + 0.2 * smooth(0.62, 0.74, c0 + 0.1 * noise(x * 0.07 + 5, z * 0.07)), rough = c0 * (1 - c0) * 4 * (6 * noise(x * 0.07, z * 0.07) + 4 * noise(x * 0.2, z * 0.2) + 2 * noise(x * 0.5, z * 0.5)); y = lerp(y, CRAG.y - 1.2, c1) + rough;
  // the ridge that carries the road up to the gate
  { const t = (CRAG.z - CRAG.r + 6 - z) / 46, px = x - CRAG.x + 5 - 9 * smooth(0.2, 1, t) * Math.sin(t * 2.4); if (t > -0.2 && t < 1.2) y = lerp(y, lerp(CRAG.y - 1.5, 13, smooth(-0.05, 1, t)) + noise(x * 0.2, z * 0.2), smooth(17, 4, Math.abs(px) + 2 * noise(x * 0.1, z * 0.1)) * smooth(1.2, 0.8, t)); }
  // lake and river bed
  const ld = Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.15) * (1 + 0.3 * noise(x * 0.035, z * 0.035 + 2)); y = lerp(y, LAKE.y + 2.2, smooth(LAKE.r + 26, LAKE.r + 8, ld)); y = lerp(y, LAKE.y - 4, smooth(LAKE.r + 5, LAKE.r - 12, ld));
  const [d, k] = near(x, z), lv = RS[k][2], rw = riverW(k); y = lerp(y, Math.max(lv + 1.6, Math.min(y, lv + 5 + d * 0.5)), smooth(rw + 22, rw + 5, d)); y = lerp(y, lv - 1.4, smooth(rw + 2.6, rw - 0.6, d));
  return y;
}

function greatIsland(q) {
  const A = Math.round(440 * q), T = Math.round(130 * q), B = Math.round(90 * q), depth = 92, f = 40 / R0, pos = [], ao = [], idx = [];
  for (let j = 0; j <= T + B; j++) for (let i = 0; i <= A; i++) { const a = (i % A) / A * 6.28318, rr = rimAt(a); let x, y, z, o = 1;
    if (j <= T) { const r = Math.pow(j / T, 0.8); x = Math.cos(a) * rr * r; z = Math.sin(a) * rr * r; y = ground(x, z); }
    else { const t = (j - T) / B, e = ground(Math.cos(a) * rr, Math.sin(a) * rr), lobe = 0.45 + 1.1 * Math.max(0, 0.5 + fbm(Math.cos(a) * 1.9 + 6.2, Math.sin(a) * 1.9, 4)), prof = t < 0.05 ? 1 + 0.3 * t : Math.pow(1 - (t - 0.05) / 0.95, 0.72), r = rr * prof; y = e - depth * 0.9 * t * lerp(1, lerp(1, lobe, 0.8), smooth(0.1, 0.7, t)); x = Math.cos(a) * r; z = Math.sin(a) * r; const k = smooth(0, 0.06, t) * smooth(1, 0.94, t);
      const X = x * f, Y = y * f, Z = z * f, crack = Math.pow(1 - Math.abs(noise(a * 16 + noise(y * 0.06, 3) * 1.5, y * 0.016)), 5), strata = Math.sin(y * 0.62 + 4 * noise(x * 0.02, z * 0.02)) * 0.9 + noise(y * 0.45, a * 3) * 2.4;
      const d = k * (30 * n3(X * 0.07 + 3, Y * 0.07, Z * 0.07) + 15 * n3(X * 0.19, Y * 0.15 + 3, Z * 0.19) + 6 * n3(X * 0.5, Y * 0.4, Z * 0.5) + 2.6 * n3(x * 0.3, y * 0.24, z * 0.3) + strata - 6 * crack); x += Math.cos(a) * d; z += Math.sin(a) * d; y += 5 * k * n3(X * 0.2 + 4, Y * 0.2, Z * 0.2); o = lerp(0.8, 0.45, smooth(0, 0.3, t)) - 0.3 * crack * k; }
    pos.push(x, y, z); ao.push(o); if (j < T + B && i < A) { const k = j * (A + 1) + i; idx.push(k, k + 1, k + A + 1, k + 1, k + A + 2, k + A + 1); } }
  for (let j = 3; j < T - 2; j++) for (let i = 0; i <= A; i++) { const v = j * (A + 1) + i, g = (jj, ii) => pos[(jj * (A + 1) + (ii + A) % A) * 3 + 1]; const m = (g(j - 3, i) + g(j + 3, i) + g(j, i - 4) + g(j, i + 4)) / 4; ao[v] = 1 - Math.max(-0.15, Math.min(0.6, (m - pos[v * 3 + 1]) * 0.09)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aAo', new THREE.Float32BufferAttribute(ao, 1)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function createIsles(u, low, perches, flora) {
  const group = new THREE.Group(), R = rng(2024), q = low ? 0.55 : 1;
  const sh = { uIsleS: { value: null }, uIsleM: { value: new THREE.Matrix4() } }, rock = groundMaterial({ ...u, ...sh }, { rock: true, far: true });
  const cx = center(-1350), cz = -1350, yaw = Math.atan2(center(cz - 12) - center(cz + 12), -24), ang = yaw + Math.PI - 34 * Math.PI / 180, L = V(-Math.sin(ang), 0, -Math.cos(ang)), Rt = V(-L.z, 0, L.x);
  const P = (right, up, fwd) => V(cx + Rt.x * right + L.x * fwd, 440 + up, cz + Rt.z * right + L.z * fwd), C = P(-24, -4, 312);
  const W = (x, y, z) => V(C.x + Rt.x * x + L.x * z, C.y + y, C.z + Rt.z * x + L.z * z), basis = new THREE.Matrix4().makeBasis(Rt, V(0, 1, 0), L).setPosition(C);
  const M = (p, s, a = 0) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a), V(s, s, s));
  const inst = (g, m) => { const k = new THREE.InstancedMesh(g, rock, 1); k.setMatrixAt(0, m); k.frustumCulled = false; group.add(k); return k; };

  const land = inst(greatIsland(q), basis);
  // the small shelf the phoenix lands on
  const sg = isle(3.1, 5.6, 13, Math.round(120 * q), 2.6), shelfP = P(1.5, -8.4, 1.5), shelf = inst(sg.g, M(shelfP, 1)); shelf.layers.enable(1);
  perches.push({ x: cx + Rt.x + L.x, z: cz + Rt.z + L.z, y: 440 - 4.4, ground: 431, tag: 'isles', noRock: true, rock: 2.7, face: 0.5, cine: { L, Rt, deck: 362 } });

  // forests
  const kinds = { fir: [], spruce: [], spruce2: [], oak: [], elm: [], cherry: [], bush: [] }, grid = new Map();
  const N = low ? 900 : 3400; let cnt = 0; for (let t = 0; t < N * 14 && cnt < N; t++) { const a = R() * 6.28, rr = Math.sqrt(R()) * 0.96, rm = rimAt(a), x = Math.cos(a) * rm * rr, z = Math.sin(a) * rm * rr, y = ground(x, z); if (y > 78 || Math.hypot(x - CRAG.x, z - CRAG.z) < CRAG.r - 2) continue;
    const sl = Math.hypot(ground(x + 1.5, z) - y, ground(x, z + 1.5) - y) / 1.5; if (sl > 0.95) continue; const [d, k] = near(x, z); if (d < riverW(k) + 2.2) continue; if (Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.15) < LAKE.r + 6 && y < LAKE.y + 0.5) continue; if (Math.abs(x - CRAG.x + 6) < 6 && z < CRAG.z && z > CRAG.z - 78) continue;
    const dens = noise(x * 0.022 + 2, z * 0.022) + 0.36 + smooth(20, 50, y) * 0.25; if (dens < R() * 0.8) continue; const key = Math.round(x / 2.6) + ',' + Math.round(z / 2.6); if (grid.has(key)) continue; grid.set(key, 1);
    const alpine = smooth(16, 44, y + 10 * noise(x * 0.03, z * 0.03)); let kind, h; const c = R(); if (c < alpine) { kind = R() < 0.4 ? 'fir' : R() < 0.5 ? 'spruce' : 'spruce2'; h = (kind === 'fir' ? 7.5 : 5) + R() * 4.5; if (y > 58) h *= 0.7; } else if (Math.hypot(x - LAKE.x, z - LAKE.z) < 58 && R() < 0.22) { kind = 'cherry'; h = 5 + R() * 3; } else if (R() < 0.14) { kind = 'bush'; h = 1.4 + R(); } else { kind = R() < 0.55 ? 'oak' : 'elm'; h = 5 + R() * 4; }
    const p = W(x, y - 0.15, z); kinds[kind].push([p.x, p.y, p.z, h, R() * 6.28, 0.9 + R() * 0.25, R()]); cnt++; }
  const depthOf = []; for (const [k, l] of Object.entries(kinds)) if (l.length) { l.sort((a, b) => (a[0] - cx) ** 2 + (a[2] - cz) ** 2 - (b[0] - cx) ** 2 - (b[2] - cz) ** 2); const m = flora.mesh(k, l, { isle: sh }); depthOf.push(m); group.add(m); }
  { const l = []; for (let i = 0; i < 14; i++) { const a = R() * 6.28, rr = 0.35 + R() * 0.55, rm = sg.rim(a); l.push([shelfP.x + Math.cos(a) * rm * rr, shelfP.y + sg.topY(a, rr, rm) - 0.06, shelfP.z + Math.sin(a) * rm * rr, 0.4 + R() * 0.5, R() * 6.28, 1, R()]); } group.add(flora.mesh('fern', l, { isle: sh, shadow: false })); }

  // castle
  const castle = createCastle(u, sh, low); castle.applyMatrix4(new THREE.Matrix4().copy(basis).multiply(new THREE.Matrix4().compose(V(CRAG.x, CRAG.y, CRAG.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -0.12), V(1.22, 1.22, 1.22)))); castle.updateMatrixWorld(true); group.add(castle);

  // lake and river surface
  { const p = [], uv = [], ix = [], lv = LAKE.y; const K = 48; p.push(LAKE.x, lv, LAKE.z); uv.push(0, 0, 0); for (let k = 0; k <= K; k++) { const a = k / K * 6.2832; p.push(LAKE.x + Math.cos(a) * (LAKE.r + 15), lv, LAKE.z + Math.sin(a) * (LAKE.r + 15) / 1.15); uv.push(0, 0, 0); if (k < K) ix.push(0, k + 2, k + 1); }
    const b = p.length / 3; let len = 0; RS.forEach(([x, z, y], i) => { const n0 = RS[Math.max(0, i - 1)], n1 = RS[Math.min(RS.length - 1, i + 1)], dx = n1[0] - n0[0], dz = n1[1] - n0[1], l = Math.hypot(dx, dz) || 1, w = riverW(i) + 2.2, slope = Math.min(1, Math.max(0, (n0[2] - n1[2]) / l)); if (i) len += Math.hypot(x - RS[i - 1][0], z - RS[i - 1][1], y - RS[i - 1][2]); const inLake = Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r; for (const s of [-1, 1]) { p.push(x - dz / l * w * s, y + (inLake ? -0.3 : 0.05), z + dx / l * w * s); uv.push(s, len, slope); } if (i < RS.length - 1) { const k = b + i * 2; ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('aU', new THREE.Float32BufferAttribute(uv, 3)); g.setIndex(ix); const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { ...u, ...sh }, side: THREE.DoubleSide, transparent: true, depthWrite: false, vertexShader: 'attribute vec3 aU; varying vec3 vW, vU; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vU = aU; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: GLSL + /* glsl */ `uniform sampler2D tNoise; varying vec3 vW, vU; float tn(vec2 p){ return texture2D(tNoise, p * .125).r; } void main(){ vec3 V = normalize(cameraPosition - vW); float run = step(.001, abs(vU.x) + vU.y); vec2 p = mix(vW.xz * .5 + uTime * .12, vec2(vU.x * 3., vU.y * .55 - uTime * 1.6), run); float h = tn(p) + .5 * tn(p * 2.3 + 4.); vec2 e = vec2(.4, 0.); vec3 N = normalize(vec3((h - tn(p + e) - .5 * tn((p + e) * 2.3 + 4.)) * .35, 1., (h - tn(p + e.yx) - .5 * tn((p + e.yx) * 2.3 + 4.)) * .35)); float fr = .03 + .97 * pow(1. - max(dot(N, V), 0.), 4.); vec3 r = reflect(-V, N); r.y = abs(r.y);
        vec3 refl = skyGrad(r) * 1.4 + highHaze(r) * .25 + vec3(.05,.42,.28) * uAurora * smoothstep(.1,.6,r.y) * (.4 + .6 * tn(r.xz * 6. + uTime * .05)) + uSky * .10; vec3 col = mix(vec3(.006,.022,.034), refl, fr); col += uSunCol * 2.2 * pow(max(dot(r, uSunDir), 0.), 180.); col += vec3(1.,.5,.16) * .5 * smoothstep(.4, .9, h) * pow(max(dot(r, normalize(${(() => { const b = W(CRAG.x, CRAG.y + 20, CRAG.z); return `vec3(${b.x.toFixed(1)}, ${b.y.toFixed(1)}, ${b.z.toFixed(1)})`; })()} - vW)), 0.), 10.);
        float white = run * smoothstep(.10, .55, vU.z + (tn(vec2(vU.x * 4., vU.y * .4 - uTime * 2.4)) - .5) * .7); col = mix(col, uSky * .55 + uSunCol * .32, white * .9); float a = mix(.96, smoothstep(1., .62, abs(vU.x)), run); gl_FragColor = vec4(fogged(col, vW), a); }` })); m.applyMatrix4(basis); m.renderOrder = 1; m.frustumCulled = false; group.add(m); }

  // where the river leaves the island: it spills over the rim, thins and turns to mist; smaller threads beside it
  const falls = [], pos = [], uv = [], data = [], idx = [];
  const spill = (bx, bz, by, w, H, layers, seed, out = 1) => { const rm = Math.hypot(bx, bz), d = V(bx / rm, 0, bz / rm), s = V(-d.z, 0, d.x), N = 44, K = 14; for (let l = 0; l < layers; l++) { const b = pos.length / 3; let len = 0; for (let j = 0; j <= N; j++) { const t = j / N, r = rm - 1.5 + out * (2 + 7 * (0.5 + l / layers) * Math.sqrt(t)), y = by + 0.12 - H * (0.35 * t + 0.65 * t * t) * smooth(0, 0.04, t), ww = w * (1 + 0.15 * t + 1.2 * t * t) * (1 - 0.13 * l); len += H / N; const sway = 0.05 * H * t * t * noise(seed * 9 + l, 3); for (let i = 0; i <= K; i++) { const f = i / K * 2 - 1, p = W(d.x * (r + 0.3 * t * (1 - f * f)) + s.x * (f * ww + sway), y, d.z * r + s.z * (f * ww + sway)); pos.push(p.x, p.y, p.z); uv.push(f, len); data.push(t, seed + l * 0.37, 0.92 - l * 0.08, 1); if (j < N && i < K) { const k = b + j * (K + 1) + i; idx.push(k, k + 1, k + K + 1, k + 1, k + K + 2, k + K + 1); } } } } const p = W(d.x * (rm + 4), by, d.z * (rm + 4)); falls.push({ x: p.x, y: p.y, z: p.z, H, w }); };
  spill(END[0], END[1], -3.3, 4.6, 62, low ? 3 : 6, 0.1); for (const [off, w, H, sd] of [[0.33, 0.9, 40, 0.6], [-0.3, 0.7, 46, 0.83], [0.62, 0.6, 38, 0.3]]) { const a = Math.atan2(END[1], END[0]) + off, r = rimAt(a); spill(Math.cos(a) * r, Math.sin(a) * r, ground(Math.cos(a) * r, Math.sin(a) * r) - 0.6, w, H, 3, sd); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setAttribute('aD', new THREE.Float32BufferAttribute(data, 4)); fg.setIndex(idx);
  const fm = new THREE.Mesh(fg, fallMaterial(u, true)); fm.frustumCulled = false; fm.renderOrder = 3; group.add(fm);
  const wg = new THREE.PlaneGeometry(1, 1), bbVS = 'varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vec3 c = modelMatrix[3].xyz; vec3 r = vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]); vW = c + r * position.x * length(modelMatrix[0].xyz) + vec3(0.,1.,0.) * position.y * length(modelMatrix[1].xyz); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }';
  const veil = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, vertexShader: bbVS, fragmentShader: GLSL + 'varying vec2 vU; varying vec3 vW; void main(){ vec2 q = vU * 2. - 1.; float w = mix(.22, .85, smoothstep(1., -1., q.y)); float n = fbm2(vec2(q.x * 2.2, q.y * 1.4 + uTime * .28) + vW.x * .01 + vec2(0., fbm2(q * 2. + uTime * .1))); float a = smoothstep(w, 0., abs(q.x + (n - .5) * .35)) * smoothstep(-1., -.35, q.y) * smoothstep(.75, -.2, q.y) * smoothstep(.22, .7, n) * .5; vec3 c = uSky * .62 + uSunCol * .20 + vec3(.01,.06,.04) * uAurora; gl_FragColor = vec4(fogged(c, vW), a); }' });
  falls.forEach(({ x, y, z, H, w }) => { const m = new THREE.Mesh(wg, veil); m.position.set(x, y - H * 0.66, z); m.scale.set(w * 6 + 5, H * 0.9, 1); m.renderOrder = 4; group.add(m); });
  // low mist lying in the valleys of the island
  const mist = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, vertexShader: bbVS, fragmentShader: GLSL + 'varying vec2 vU; varying vec3 vW; void main(){ vec2 q = vU * 2. - 1.; float n = fbm2(vec2(q.x * 3. + uTime * .02, q.y * 1.5) + vW.xz * .004); float a = smoothstep(1., .1, length(q + (n - .5) * .5)) * smoothstep(.3, .75, n) * .42; gl_FragColor = vec4(fogged(uSky * .42 + uSunCol * .12 + vec3(.01,.07,.045) * uAurora, vW), a); }' });
  [[-60, 24, 40, 120, 14], [-20, 14, -40, 110, 12], [-70, 40, 80, 120, 18], [40, 24, 60, 120, 16], [60, 12, -70, 100, 12], [-90, 12, -50, 90, 12]].forEach(([x, y, z, w, h]) => { const m = new THREE.Mesh(wg, mist); m.position.copy(W(x, y, z)); m.scale.set(w, h, 1); m.renderOrder = 4; group.add(m); });

  // moonlight shadows over the whole island, drawn once
  const SZ = low ? 1024 : 2048, rt = new THREE.WebGLRenderTarget(SZ, SZ, { depthTexture: new THREE.DepthTexture(SZ, SZ, THREE.UnsignedIntType) }); rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter; sh.uIsleS.value = rt.depthTexture; let drawn = false;
  group.userData.shadow = (renderer, dir) => { if (drawn || flora.left()) return; drawn = true; const cam = new THREE.OrthographicCamera(-185, 185, 165, -165, 1, 800); cam.position.copy(C).addScaledVector(dir, 380); cam.position.y += 10; cam.lookAt(C.x, C.y + 10, C.z); cam.updateMatrixWorld(); sh.uIsleM.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const sc = new THREE.Scene(), dm = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }', fragmentShader: 'void main(){ gl_FragColor = vec4(1.); }' }); const add = (g, m, mt = dm) => { const k = new THREE.Mesh(g, mt); k.matrixAutoUpdate = false; k.matrix.copy(m); k.frustumCulled = false; sc.add(k); }; add(land.geometry, basis); castle.userData.solid.forEach((m) => add(m.geometry, m.matrixWorld)); depthOf.forEach((m) => { m.userData.depthMat.uniforms.uMoon.value.copy(dir); add(m.geometry, new THREE.Matrix4(), m.userData.depthMat); });
    sh.uIsleS.value = null; renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, cam); renderer.setRenderTarget(null); sh.uIsleS.value = rt.depthTexture; dm.dispose(); };
  group.userData.stop = () => rt.dispose();
  depthOf.forEach((m) => { m.userData.isleDepth = m.userData.depthMat; });

  // volumetric cloud sea, marched through a slab
  const S = 4400, slab = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; void main(){ vW = position + vec3(${cx.toFixed(1)}, ${TOP.toFixed(1)}, ${cz.toFixed(1)}); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    fragmentShader: GLSL + /* glsl */ `varying vec3 vW; uniform sampler2D tNoise; float tl(vec2 p, float l){ return textureLod(tNoise, p * .125, l).r; }
      float base(vec2 p){ vec2 q = p * .0085 + vec2(uTime * .010, uTime * .004); vec2 w = vec2(tl(q * .8 + 3., 3.), tl(q * .8 + 8., 3.)) - .48; float a = tl(q * .55 + w * .9, 3.), b = tl(q * 1.9 + w * 1.3, 2.5); return a * .95 + (1. - abs(b * 2. - 1.)) * .34; }
      float dens(vec3 p, float b, float l){ float h = (p.y - ${BOT.toFixed(1)}) / ${(TOP - BOT).toFixed(1)}; float top = smoothstep(.46, .86, b); top = top * .92 + .08; vec2 q = p.xz * .062 + p.y * vec2(.016, -.013) + uTime * vec2(.03, .012); float d1 = tl(q, l), d2 = tl(q * 2.7 + p.y * .05 + 4., l) ; return clamp((top * 1.02 - h) * 3.4 + (d1 - .5) * 1.9 + (d2 - .5) * .9, 0., 1.); }
      void main(){ vec3 ro = cameraPosition, rd = normalize(vW - ro); float dist = length(vW - ro); if (rd.y > -.004) discard; float far = smoothstep(420., 1900., dist);
        float L = min(${(TOP - BOT).toFixed(1)} / -rd.y, 260. + dist * .35); int N = 40; float st = L / float(N); float j = fract(52.9829 * fract(dot(gl_FragCoord.xy, vec2(.06711, .00584)))); vec3 p = vW + rd * st * j; float T = 1.; vec3 acc = vec3(0.); float lod = clamp(log2(dist * .006 + 1.), 0., 4.);
        float ph = max(dot(rd, uSunDir), 0.); float silver = .35 + 1.5 * pow(ph, 10.) + .5 * pow(ph, 3.);
        for (int i = 0; i < 40; i++) { float b = base(p.xz), d = dens(p, b, lod); if (d > .02) { vec3 q = p + uSunDir * 9.; float s1 = dens(q, b, lod + .5); q += uSunDir * 13.; float s2 = dens(q, base(q.xz), lod + 1.); float li = exp(-(s1 * .95 + s2 * 1.0)); float h = (p.y - ${BOT.toFixed(1)}) / ${(TOP - BOT).toFixed(1)};
            vec3 c = uSunCol * li * silver * .62 * (1. - exp(-d * 3.)) + uSky * mix(.10, .58, smoothstep(.0, .9, h)); c += vec3(.02,.15,.09) * uAurora * smoothstep(.3, .9, h) * smoothstep(.42, .60, tl(p.xz * .004 + uTime * .01, 2.)); vec3 l = uPhx - p; c += vec3(1.,.40,.10) * uPhxI * 130. / (dot(l, l) + 420.); vec2 vg = p.xz - vec2(${CONE.x.toFixed(1)}, ${CONE.z.toFixed(1)}); c += vec3(2.2,.46,.07) * uEmber * exp(-dot(vg, vg) / 26000.) * smoothstep(1.05, .1, h) * (.6 + .4 * sin(uTime * 1.3 + d * 4.)); c = mix(c, c * vec3(1.15,.72,.58), uEmber * .55);
            float a = 1. - exp(-d * st * .085); acc += T * a * c; T *= 1. - a; if (T < .02) break; } p += rd * st; }
        vec3 fc = highHaze(rd); float al = 1. - T; vec3 col = al > .001 ? acc / al : fc; col = mix(col, fc, far); al = mix(al, 1., far); gl_FragColor = vec4(col, al * smoothstep(0., 30., dist)); }` }));
  slab.renderOrder = 2; slab.frustumCulled = false; group.add(slab);
  // what lies beneath, so gaps in the cloud read as depth
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(S, S).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: `varying vec3 vW; void main(){ vW = position + vec3(${cx.toFixed(1)}, ${(BOT - 14).toFixed(1)}, ${cz.toFixed(1)}); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`, fragmentShader: GLSL + 'varying vec3 vW; void main(){ float d = length(cameraPosition - vW); vec3 c = mix(uFog * .55, highHaze(normalize(vW - cameraPosition)), smoothstep(120., 700., d)); gl_FragColor = vec4(c, 1.); }' })); deep.frustumCulled = false; group.add(deep);

  // cloud thrown aside when the phoenix dives in and bursts out
  const n = low ? 60 : 150, bg = new THREE.InstancedBufferGeometry(); bg.instanceCount = n; bg.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); bg.setIndex([0, 1, 2, 0, 2, 3]); const ba = new Float32Array(n * 4); for (let i = 0; i < n; i++) ba.set([R() * 6.28, R(), R(), R()], i * 4); bg.setAttribute('aB', new THREE.InstancedBufferAttribute(ba, 4));
  const mk = () => { const uni = { ...u, uAt: { value: V(0, -999, 0) }, uT0: { value: -99 }, uPow: { value: 1 } }; const m = new THREE.Mesh(bg, new THREE.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime, uT0, uPow; uniform vec3 uAt; attribute vec4 aB; varying vec2 vQ; varying float vA, vS; varying vec3 vW; void main(){ vQ = position.xy; float t = uTime - uT0; vS = aB.z; float jet = step(.55, aB.y); float e = 1. - exp(-t * 1.5); vec3 p = uAt + vec3(cos(aB.x), 0., sin(aB.x)) * mix(4. + 17. * aB.z, 1. + 5. * aB.z, jet) * e * uPow; p.y += mix(2. + 6. * aB.w, 8. + 24. * aB.w, jet) * uPow * (e - .12 * t * t * .4) ; vW = p; vA = smoothstep(0., .12, t) * smoothstep(3.6, .6, t) * step(t, 3.6); vec4 m = viewMatrix * vec4(p, 1.); m.xy += position.xy * (2.2 + 4.5 * aB.z) * (.5 + e * 1.3) * uPow; gl_Position = vA < .003 ? vec4(2.,2.,2.,1.) : projectionMatrix * m; }`,
    fragmentShader: GLSL + 'varying vec2 vQ; varying float vA, vS; varying vec3 vW; void main(){ float r = length(vQ); float n = fbm2(vQ * 1.7 + vS * 40. + uTime * .15); float a = smoothstep(1., .15, r + (n - .5) * .9) * vA * .34; vec3 l = uPhx - vW; vec3 c = uSky * .55 + uSunCol * (.14 + .16 * n) + vec3(1.,.42,.12) * uPhxI * 120. / (dot(l, l) + 160.); gl_FragColor = vec4(c, a); }' })); m.frustumCulled = false; m.renderOrder = 5; group.add(m); return uni; };
  const b1 = mk(), b2 = mk();
  group.userData.burst = (which, p, pow) => { const b = which ? b2 : b1; b.uAt.value.copy(p); b.uT0.value = u.uTime.value; b.uPow.value = pow; };
  return group;
}
