import * as THREE from 'three';
import { GLSL, rng, lerp, smooth, noise } from './common';
import { CONE, center, groundMaterial, pineMesh, spireGeometry } from './landscape';
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

export function createIsles(u, low, perches) {
  const group = new THREE.Group(), R = rng(2024), rock = groundMaterial(u, { rock: true, far: true }), q = low ? 0.5 : 1;
  const cx = center(-1350), cz = -1350, yaw = Math.atan2(center(cz - 12) - center(cz + 12), -24), ang = yaw + Math.PI - 34 * Math.PI / 180, L = V(-Math.sin(ang), 0, -Math.cos(ang)), Rt = V(-L.z, 0, L.x);
  const P = (right, up, fwd) => V(cx + Rt.x * right + L.x * fwd, 440 + up, cz + Rt.z * right + L.z * fwd), facing = Math.atan2(-L.z, -L.x);
  const trees = [], boulders = [], falls = [];
  const M = (p, s, a = 0) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a), V(s, s, s));
  // [seed, radius, depth, segments, centre, trees, stream direction off the viewer's line]
  const defs = [[3.1, 11, 15, 110, P(1.5, -9.4, 1.5), 5, 2.6], [11.8, 40, 50, 230, P(-66, 6, 196), 46, 0.45], [23.4, 27, 34, 130, P(78, 24, 330), 22, -0.5], [31.9, 46, 50, 120, P(-300, 46, 520), 26, 0.3]];
  const all = defs.map(([seed, r, d, seg, p, n, off], i) => { const o = isle(seed, r, d, Math.round(seg * q), facing + off); const m = new THREE.InstancedMesh(o.g, rock, 1); m.setMatrixAt(0, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); m.frustumCulled = false; group.add(m);
    for (let t = 0, k = 0; t < n * 30 && k < n; t++) { const a = R() * 6.28, rr = Math.sqrt(R()) * 0.9, rm = o.rim(a), x = Math.cos(a) * rm * rr, z = Math.sin(a) * rm * rr, dA = Math.atan2(Math.sin(a - o.streamA), Math.cos(a - o.streamA)); if (Math.abs(dA * rr * rm) < r * 0.14 && Math.abs(dA) < 1.4) continue; if (i === 0 && (rr < 0.5 || x * L.x + z * L.z < 2)) continue; if (noise(x * 0.12 + seed, z * 0.12) < -0.12) continue; trees.push(M(V(p.x + x, p.y + o.topY(a, rr, rm) - 0.15, p.z + z), i === 0 ? 1.8 + R() * 2 : 3.4 + R() * R() * 5.5, R() * 6.28)); k++; }
    return { ...o, p }; });
  group.add(pineMesh(u, trees));

  // the crag the phoenix lands on
  const py = 440 - 4.4; perches.push({ x: cx + Rt.x + L.x, z: cz + Rt.z + L.z, y: py, ground: 431, tag: 'isles', noRock: true, face: 0.5, cine: { L, Rt, deck: 362 } });
  const crag = new THREE.InstancedMesh(spireGeometry(), rock, 1); crag.geometry.setAttribute('aAo', new THREE.Float32BufferAttribute(new Float32Array(crag.geometry.attributes.position.count).fill(0.92), 1)); crag.setMatrixAt(0, new THREE.Matrix4().makeTranslation(cx + Rt.x + L.x, py, cz + Rt.z + L.z)); crag.frustumCulled = false; crag.layers.enable(1); group.add(crag);

  // a few broken fragments drifting beside the main island
  [[-30, -14, 168, 2.2], [-104, 2, 190, 3.0], [-38, -27, 190, 1.5], [52, 6, 300, 2.6]].forEach(([a, b, c, s], i) => { const o = isle(50 + i * 7.7, s, s * 1.7, 34, 0), m = new THREE.InstancedMesh(o.g, rock, 1), p = P(a, b, c); m.setMatrixAt(0, M(p, 1, i * 2)); m.frustumCulled = false; m.userData.bob = [p, i * 2, i]; group.add(m); });

  // streams: run along the bed, spill over the notch, thin out and turn to mist before the clouds
  const pos = [], uv = [], data = [], idx = [];
  const spill = (o, w, H, layers, side = 0, seed = 0.2) => { const a0 = o.streamA + side, d = V(Math.cos(a0), 0, Math.sin(a0)), s = V(-d.z, 0, d.x), rm = o.rim(a0), run = 12, N = 44, K = 14;
    for (let l = 0; l < layers; l++) { const b = pos.length / 3; let len = 0; for (let j = 0; j <= run + N; j++) { let r, y, t = 0, ww;
        if (j <= run) { const k = lerp(side ? 0.9 : 0.22, 1, j / run); r = rm * k; y = o.topY(a0, Math.min(1, k), rm) + 0.30 + l * 0.03; ww = w * lerp(0.55, 1, j / run); if (j) len += rm * 0.07; }
        else { t = (j - run) / N; r = rm + (0.5 + 1.1 * l / layers) * 2.2 * Math.sqrt(t) * Math.sqrt(H / 40) ; y = o.topY(a0, 1, rm) + 0.2 - H * (0.35 * t + 0.65 * t * t); ww = w * (1 + 0.15 * t + 1.5 * t * t) * (1 - 0.13 * l); len += H / N; }
        const sway = 0.05 * H * t * t * noise(seed * 9 + l, 3);
        for (let i = 0; i <= K; i++) { const f = i / K * 2 - 1; pos.push(o.p.x + d.x * (r - (1 - f * f) * -0.3 * t) + s.x * (f * ww + sway), o.p.y + y, o.p.z + d.z * r + s.z * (f * ww + sway)); uv.push(f, len); data.push(t, seed + l * 0.37, 0.92 - l * 0.08, j <= run ? 0 : 1); } }
      for (let j = 0; j < run + N; j++) for (let i = 0; i < K; i++) { const k = b + j * (K + 1) + i; idx.push(k, k + 1, k + K + 1, k + 1, k + K + 2, k + K + 1); } }
    falls.push({ x: o.p.x + d.x * (rm + 2.5), y: o.p.y + o.topY(a0, 1, rm), z: o.p.z + d.z * (rm + 2.5), H, w }); };
  spill(all[1], 2.7, 78, 6, 0, 0.1); spill(all[1], 0.6, 52, 3, 0.34, 0.6); spill(all[1], 0.45, 46, 3, -0.4, 0.83); spill(all[2], 1.5, 62, 4, 0, 0.4); spill(all[3], 2.4, 80, 3, 0, 0.7);
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); fg.setAttribute('aD', new THREE.Float32BufferAttribute(data, 4)); fg.setIndex(idx);
  const fm = new THREE.Mesh(fg, fallMaterial(u, true)); fm.frustumCulled = false; fm.renderOrder = 3; group.add(fm);
  const wg = new THREE.PlaneGeometry(1, 1), bbVS = 'varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vec3 c = modelMatrix[3].xyz; vec3 r = vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]); vW = c + r * position.x * length(modelMatrix[0].xyz) + vec3(0.,1.,0.) * position.y * length(modelMatrix[1].xyz); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }';
  const veil = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, vertexShader: bbVS, fragmentShader: GLSL + 'varying vec2 vU; varying vec3 vW; void main(){ vec2 q = vU * 2. - 1.; float w = mix(.22, .85, smoothstep(1., -1., q.y)); float n = fbm2(vec2(q.x * 2.2, q.y * 1.4 + uTime * .28) + vW.x * .01 + vec2(0., fbm2(q * 2. + uTime * .1))); float a = smoothstep(w, 0., abs(q.x + (n - .5) * .35)) * smoothstep(-1., -.35, q.y) * smoothstep(.75, -.2, q.y) * smoothstep(.22, .7, n) * .55; vec3 c = uSky * .62 + uSunCol * .20 + vec3(.01,.06,.04) * uAurora; gl_FragColor = vec4(fogged(c, vW), a); }' });
  falls.forEach(({ x, y, z, H, w }) => { const m = new THREE.Mesh(wg, veil); m.position.set(x, y - H * 0.66, z); m.scale.set(w * 9 + 5, H * 0.9, 1); m.renderOrder = 4; group.add(m); });

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
  group.userData.update = (time) => group.children.forEach((m) => { if (m.userData.bob) { const [p, a, i] = m.userData.bob; m.setMatrixAt(0, M(V(p.x, p.y + Math.sin(time * 0.4 + i) * 0.5, p.z), 1, a + time * 0.02)); m.instanceMatrix.needsUpdate = true; } });
  return group;
}
