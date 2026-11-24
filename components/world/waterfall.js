import * as THREE from 'three';
import { GLSL, SHADOW, HMAP, rng, lerp, smooth, noise } from './common';
import { FALL, FALLS, height } from './landscape';
import { createGorge } from './gorge';

export function fallMaterial(u, fade = false) {
  const m = new THREE.ShaderMaterial({ uniforms: u, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: `precision highp float; attribute vec4 aD; varying vec2 vU; varying vec4 vD; varying vec3 vW; varying float vSun; uniform float uTime; uniform vec3 uSunDir; uniform sampler2D tNoise; ${HMAP}
      float tv(vec2 p){ return texture2D(tNoise, p * .125).r - .48; }
      void main(){ vU = uv; vD = aD; vec3 p = position; float q = sqrt(uv.y + .4) * 1.55 - uTime * 2.1, k = smoothstep(.06, .4, aD.x);
        // pulses of water billow outward as they fall
        p.x -= k * (tv(vec2(p.z * .5 + aD.y * 20., q * 1.1)) * 2.6 + tv(vec2(p.z * 1.4, q * 2.4 + aD.y * 9.)) * 1.0); p.z += k * tv(vec2(q * 1.2 + aD.y * 31., p.z * .3)) * .9;
        vW = p; vSun = sunVis(p + vec3(-5., 3., 0.), uSunDir); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.); }`,
    fragmentShader: GLSL + /* glsl */ `uniform sampler2D tNoise; varying vec2 vU; varying vec4 vD; varying vec3 vW; varying float vSun;
      float tn(vec2 p){ return texture2D(tNoise, p * .125).r; }
      // q runs with fall time, not distance, so every feature stretches and speeds up as it drops
      float flow(vec2 p, float q, float s){ return tn(vec2(p.x * 2.6 + s, q * 1.1)) * .42 + tn(vec2(p.x * 6.5 - s, q * 1.9)) * .30 + tn(vec2(p.x * .9 + s * 2., q * .75)) * .40; }
      void main(){ float a = vU.x, f = vD.x, s = vD.y * 37., q = sqrt(vU.y + .4) * 1.55 - uTime * 2.1;
        #ifdef FADE
          q = sqrt(vU.y + .4) * 1.15 - uTime * 1.25; float zz = vU.x * 2.4 + vD.y * 11.;
        #else
          float zz = vW.z;
        #endif
        float z = zz + (tn(vec2(zz * .7 + s, q * .8)) - .48) * 1.3 * f;
        float h = flow(vec2(z, 0.), q, s), hz = flow(vec2(z + .07, 0.), q, s), hq = flow(vec2(z, 0.), q + .05, s);
        float clump = smoothstep(.50, .74, tn(vec2(z * 1.15 + s * 3., q * 1.7)) * .75 + tn(vec2(z * 3.1, q * 3.4 - s)) * .32);
        float edge = 1. - smoothstep(.35, 1., abs(a) + (tn(vec2(s + sign(a) * 7., q * 2.2)) - .48) * 1.1 + f * .12);
        float thick = smoothstep(mix(.10,.22,f), mix(.44,.58,f), h + clump * .14);
        float al = edge * mix(thick, 1., (1. - smoothstep(0., .16, f)) * .65); al = clamp(al * vD.z * 1.12 + clump * edge * .35, 0., 1.);
        vec3 N = normalize(vec3(-1., .35 + (h - hq) * 7., (h - hz) * 10.)), V = normalize(cameraPosition - vW);
        float nl = max(dot(N, uSunDir), 0.), hl = pow(max(dot(N, normalize(V + uSunDir)), 0.), 34.);
        // glassy blue-green where thin, aerated white where it breaks
        float lip = smoothstep(.20, .02, f) * step(1.5, vD.w), foot = smoothstep(.80, 1., f); float bub = smoothstep(.50,.66, tn(vec2(z * 7., q * 7. + s))) ; float white = clamp(thick * .5 + clump * .75 + f * .25 - .14 + (lip + foot) * (.35 + .5 * bub), 0., 1.);
        vec3 c = mix(vec3(.10,.22,.24), vec3(.93,.96,.97), white);
        float hollow = smoothstep(.62, .40, h) * (1. - clump); c *= 1. - .48 * hollow;
        vec3 col = c * (uSunCol * vSun * (.10 + .40 * nl) + mix(uGround, uSky, .72 + N.y * .25) * .46);
        col += uSunCol * vSun * hl * (.35 + .9 * clump) * .55;
        col += uSunCol * vSun * (lip + foot) * bub * smoothstep(.55,.9, tn(vec2(z * 11. + uTime, q * 12.)) + .25) * .55;
        // single drops flashing in the sun
        vec2 gq = vec2(z * 5.5, q * 7.); vec2 ce = floor(gq), fr = fract(gq) - .5; float tw = step(.955, hash2(ce + s)) * smoothstep(.42, .0, length(fr)); col += uSunCol * vSun * tw * 1.3 * edge;
        al = max(al, tw * edge * .8) * smoothstep(1., .95, f * step(1.5, vD.w)) ;
        
        #ifdef FADE
          al *= smoothstep(1., .15, f) * mix(1., .55 + .45 * smoothstep(.35,.7,h), f); al *= mix(1., smoothstep(.30 + .35 * f, .75, h + clump * .25), smoothstep(.1, .5, f)); col = mix(col, uSky * .75 + uSunCol * .22, .35 + .3 * f);
        #endif
        gl_FragColor = vec4(fogged(col, vW), min(al, .97)); }` });
  if (fade) m.defines = { FADE: 1 };
  return m;
}

// Many falls gathering into one: every sheet of water follows the measured face of the rock it runs down.
export function createWaterfall(u, low, onLoad) {
  const R = rng(19), X = FALL.x, Z = FALL.z, hitsBase = [], hitsLedge = [], feet = [];
  let spray, gone = false;
  const group = createGorge(u, low, build, onLoad), stopGorge = group.userData.stop; group.userData.stop = () => { gone = true; stopGorge(); };

  function build(D, sample) {
    if (gone) return; const pos = [], uv = [], data = [], idx = [];
    for (const f of FALLS) {
      const M = Math.max(6, Math.round(f.w * 2)), cols = [], half = M / 2; let footX = 0, baseY = 0;
      const rock = (s, y, d) => Math.min(sample(D[f.tier], s, y), d); { let top = -1; for (let y = f.lip + 1; y > 5; y -= 0.5) if (sample(D[f.tier], f.s, y) < 1e3) { top = y; break; } if (top < 0) continue; f.lip = Math.min(f.lip, top - 0.2); }
      // where the middle of the fall leaves the lip, and where it lands
      const mid = rock(f.s, f.lip - 1.2, 1e4), march = (s, lip, x0) => { const path = []; let x = x0, y = lip; for (let g = 0; g < 400; g++) { const r = rock(s, y, 1e4); x = Math.min(x - 0.012, r > 1e3 ? x : r - 0.35); path.push([x, y]); const floor = f.tier === 1 ? -0.25 : height(x - 0.8, Z + s) + 0.2; if (y <= floor) break; y -= 0.4; } return path; };
      const core = march(f.s, f.lip, Math.min(rock(f.s, f.lip - 0.8, mid), mid + 2.5)); baseY = core[core.length - 1][1]; const drop = f.lip - baseY; if (drop < 5) continue; const N = Math.round(Math.min(40, 12 + drop * 0.7));
      const layers = f.tier === 1 && f.w > 4 ? 4 : f.w > 3 ? 4 : f.w > 1.5 ? 3 : 2;
      for (let i = 0; i <= M; i++) { const a = i / M * 2 - 1, s = f.s + a * f.w, path = march(s, f.lip, Math.min(rock(s, f.lip - 0.8, 1e4), mid + 2.5)), col = []; for (let j = 0; j <= N; j++) { const t = j / N, y = f.lip - drop * (0.5 * t + 0.5 * t * t), k = Math.max(0, Math.min(path.length - 1, (f.lip - y) / 0.4)), k0 = Math.floor(k), k1 = Math.min(path.length - 1, k0 + 1); col.push(lerp(path[k0][0], path[k1][0], k - k0)); } cols.push(col); }
      for (let j = 0; j <= N; j++) { const h = Math.round(half), lim = 2.6 * f.w / M + 0.25; for (let i = h + 1; i <= M; i++) cols[i][j] = Math.max(cols[i - 1][j] - lim, Math.min(cols[i - 1][j] + lim, cols[i][j])); for (let i = h - 1; i >= 0; i--) cols[i][j] = Math.max(cols[i + 1][j] - lim, Math.min(cols[i + 1][j] + lim, cols[i][j])); }
      // neighbouring strands pull together, so the sheet stays a sheet
      for (let k = 0; k < 2; k++) for (let j = 0; j <= N; j++) { const c = cols.map((q) => q[j]); for (let i = 1; i < M; i++) cols[i][j] = Math.min(c[i] + 0.2, (c[i - 1] + 2 * c[i] + c[i + 1]) / 4); }
      for (let l = 0; l < layers; l++) { const w = 1 - l * (0.5 / layers), push = l * (f.tier === 1 ? 0.75 : 0.4), off = l ? (R() - 0.5) * f.w * 0.5 : 0, seed = R(), dens = f.dens * (1.12 - l * 0.1), b = pos.length / 3; let len = 0; const run = 3;
        for (let j = -run; j <= N; j++) { const t = Math.max(0, j) / N, y0 = f.lip + (j <= 0 ? 0.28 - j * 0.22 : 0) - drop * (0.5 * t + 0.5 * t * t); len += j <= 0 ? 1.6 : drop / N * (0.5 + t);
          for (let i = 0; i <= M; i++) { const a = i / M * 2 - 1, c = cols[Math.max(0, Math.min(M, Math.round((a * w + off / f.w + 1) * half)))], x = c[Math.max(0, j)] - push * Math.sqrt(t) - (1 - a * a) * 0.35 * t - (j < 0 ? j * 1.9 : 0), s = f.s + (a * w + off / f.w) * f.w * (1 + 0.16 * t * (f.tier === 1 ? 1 : 1.6)); pos.push(x + 0.3 * noise(a * 2 + seed * 9, t * 4), y0 + 0.9 * (1 - t) * noise(a * 2.2 + f.s, seed * 3) * (f.w > 2 ? 1 : 0.3), Z + s); uv.push(a, len); data.push(j < 0 ? 0.0 : Math.max(0.02, t), seed, dens, f.tier === 1 ? 2 : 1); } }
        for (let j = 0; j < N + run; j++) for (let i = 0; i < M; i++) { const k = b + j * (M + 1) + i; idx.push(k, k + 1, k + M + 1, k + 1, k + M + 2, k + M + 1); }
        if (l === layers - 1) footX = cols[Math.round(half)][N] - push; }
      const foot = { p: new THREE.Vector3(footX, Math.max(baseY, f.tier === 1 ? 0.2 : baseY), Z + f.s), w: f.w, k: f.dens, tier: f.tier, f }; feet.push(foot); (f.tier === 1 ? hitsBase : hitsLedge).push(foot);
    }
    // white water running down through the boulders until it all meets above the great fall
    for (const h of feet) { if (h.tier !== 2) continue; const main = FALLS[0], T = 34, K = 6, tgtS = Math.max(-8.5, Math.min(8.5, h.f.s * 0.16)), x0 = h.p.x - 0.5, x1 = X + 44, w = Math.min(3.4, 1.0 + h.w * 0.45);
      for (let l = 0; l < 2; l++) { const b = pos.length / 3, seed = R(); let len = 0; for (let j = 0; j <= T; j++) { const t = j / T, x = lerp(x0, x1 - 6 * smooth(0.7, 1, t), t), q = t * t * (3 - 2 * t), s = lerp(h.f.s, tgtS, q) + 5 * Math.sin(Math.PI * t) * noise(t * 3.1 + h.f.s, 4) + 1.6 * noise(t * 9, h.f.s); len += 2; for (let i = 0; i <= K; i++) { const a = i / K * 2 - 1, ww = w * lerp(1, 1.5, t) * (l ? 0.7 : 1); const zz = Z + s + a * ww; pos.push(x + 0.5 * noise(t * 20, a + seed), Math.max(height(x, zz), height(x, Z + s) - 0.5) + 0.42 + l * 0.25 + 0.2 * (1 - a * a), zz); uv.push(a, len); data.push(0.42, seed, 0.95, 1); } }
        for (let j = 0; j < T; j++) for (let i = 0; i < K; i++) { const k = b + j * (K + 1) + i; idx.push(k, k + 1, k + K + 1, k + 1, k + K + 2, k + K + 1); } } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aD', new THREE.Float32BufferAttribute(data, 4)); g.setIndex(idx);
    const water = new THREE.Mesh(g, fallMaterial(u)); water.renderOrder = 2; water.frustumCulled = false; group.add(water);

    // spray thrown up where the water lands, on the pool and on every ledge above it
    const n = low ? 1200 : 4400, sg = new THREE.InstancedBufferGeometry(); sg.instanceCount = n; sg.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); sg.setIndex([0, 1, 2, 0, 2, 3]);
    const o = new Float32Array(n * 3), v = new Float32Array(n * 4), big0 = hitsBase[0], main3 = hitsBase.filter((q) => q.w > 4);
    for (let i = 0; i < n; i++) { const c = R(), h = c < 0.52 ? main3[Math.floor(R() * main3.length)] : c < 0.66 ? hitsBase[Math.floor(R() * hitsBase.length)] : hitsLedge[Math.floor(R() * hitsLedge.length)], drop = h.w > 4 && h.tier === 1 && R() < 0.22, y0 = drop ? h.p.y + 8 + R() * 16 : h.p.y; o.set([h.p.x + (R() - 0.5) * 2 + (drop ? 1.5 : 0), y0, h.p.z + (R() * 2 - 1) * h.w * 1.1], i * 3); if (drop) { v.set([-(0.2 + R() * 0.9), -20 - R(), (R() - 0.5) * 0.7, 0.018 + R() * 0.025], i * 4); continue; } const puff = R() < (h.tier > 1 ? 0.6 : 0.4), k = h.tier === 3 ? 2.2 : h.tier === 2 ? 1.5 : 1; v.set([-(0.6 + R() * 4.2) * k, 2 + R() * R() * 7, (R() - 0.5) * 4 * k, (puff ? 0.7 + R() * 1.3 : 0.02 + R() * 0.035) * k], i * 4); }
    sg.setAttribute('aO', new THREE.InstancedBufferAttribute(o, 3)); sg.setAttribute('aV', new THREE.InstancedBufferAttribute(v, 4));
    spray = new THREE.Mesh(sg, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `uniform float uTime; attribute vec3 aO; attribute vec4 aV; varying vec2 vQ; varying float vA, vB; varying vec3 vW; void main(){ vQ = position.xy; float drop = step(aV.y, -10.); float life = mix(.7 + max(aV.y, 0.) * .16, 2.0, drop), t = fract(uTime / life + aO.x * 7.3 + aV.z * 3.1) * life; vA = t / life; vB = step(.3, aV.w); vec3 p = aO + vec3(aV.x, max(aV.y, 0.), aV.z) * t * mix(1., .5, vB); p.y -= mix(4.6, 5.6, drop) * t * t * mix(1., .25, vB); if (p.y < min(aO.y, 0.) - .5 && drop < .5) p.y = -50.; vW = p; vec4 m = viewMatrix * vec4(p, 1.); m.xy += position.xy * aV.w * mix(1., 1. + vA * 2.2, vB) * vec2(1., mix(mix(1.7, 2.5 + t * 5., drop), 1., vB)); gl_Position = projectionMatrix * m; }`,
      fragmentShader: GLSL + `varying vec2 vQ; varying float vA, vB; varying vec3 vW; void main(){ float r = length(vQ); if (r > 1.) discard; float nz = mix(1., (n2(vQ * 1.8 + vW.zy * .5 + uTime * .2) * .6 + n2(vQ * 4. - uTime * .3) * .4) * 1.8, vB); float a = mix(smoothstep(1., .2, r), pow(max(1. - r, 0.), 1.6) * nz, vB) * (1. - vA) * smoothstep(0., .15, vA) * mix(.55, .15, vB); vec3 c = uSunCol * mix(.40, .26, vB) + uSky * .5; gl_FragColor = vec4(fogged(c, vW), a); }` }));
    spray.frustumCulled = false; spray.renderOrder = 4; group.add(spray);

    // mist hanging at the foot of every fall
    for (const h of feet) { const k = h.tier === 1 ? (h.w > 4 ? 1 : h.w > 1.5 ? 1 : 0) : 1; for (let i = 0; i < k; i++) { const m = new THREE.Mesh(mg, mm); m.position.set(h.p.x - 2 - R() * 5, h.p.y + 3 + R() * 4 * h.tier, h.p.z + (R() - 0.5) * h.w * 2); m.scale.set((10 + h.w * 3.4) * (0.8 + 0.4 * h.tier), (7 + h.w * 1.6) * (0.8 + 0.3 * h.tier), 1); m.renderOrder = 5; group.add(m); } }
  }

  // drifting mist with a rainbow where the angle to the sun is right
  const mg = new THREE.PlaneGeometry(1, 1), mm = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vec3 c = modelMatrix[3].xyz; vec3 r = vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]); vW = c + r * position.x * length(modelMatrix[0].xyz) + vec3(0.,1.,0.) * position.y * length(modelMatrix[1].xyz); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    fragmentShader: GLSL + /* glsl */ `uniform sampler2D tNoise; varying vec2 vU; varying vec3 vW; void main(){ vec2 q = vU * 2. - 1.; vec2 np = vU * vec2(3.2, 2.4) + vec2(uTime * .06, -uTime * .22) + vW.z * .02; float n = texture2D(tNoise, np * .11).r * .62 + texture2D(tNoise, np * .29 + .4).r * .38; float m = smoothstep(1., .05, length(q * vec2(1., 1.05))); float a = m * smoothstep(.2, .75, n) * .22;
      vec3 c = uSunCol * (.17 + .10 * n) + uSky * .46; gl_FragColor = vec4(mix(c, fogged(c, vW), .5) * a, a); }` });
  mm.blending = THREE.CustomBlending; mm.blendSrc = THREE.OneFactor; mm.blendDst = THREE.OneMinusSrcAlphaFactor;
  for (let i = 0; i < (low ? 3 : 5); i++) { const m = new THREE.Mesh(mg, mm); const f = i / 8; m.position.set(X + 18 - R() * 18, 2 + R() * 5, Z + (R() - 0.5) * 40); m.scale.set(26 + R() * 14, 12 + R() * 12, 1); m.renderOrder = 5; group.add(m); }
  for (const [f, y, z, w, h] of [[74, 60, -30, 120, 26], [78, 62, 50, 120, 26], [150, 92, -40, 190, 34], [156, 96, 70, 190, 34]]) { const m = new THREE.Mesh(mg, mm); m.position.set(X + f, y, Z + z); m.scale.set(w, h, 1); m.renderOrder = 3; group.add(m); }
  // primary and secondary bow, placed by the true 42 and 51 degree angles around the point opposite the sun
  const rb = new THREE.Mesh(mg, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: mm.vertexShader,
    fragmentShader: GLSL + /* glsl */ `varying vec2 vU; varying vec3 vW;
      vec3 spec(float b){ vec3 x = (vec3(b) - vec3(.86, .54, .22)) / vec3(.25, .25, .24); vec3 c = exp(-x * x); c.r += .22 * exp(-pow((b - .02) / .14, 2.)); return c; }
      void main(){ vec2 q = vU * 2. - 1.; vec3 d = normalize(vW - cameraPosition); float ang = degrees(acos(clamp(dot(d, -uSunDir), -1., 1.)));
        float veil = smoothstep(1., .0, length(q * vec2(.98, 1.))) * mix(.62, 1., fbm2(vU * 5. + vec2(uTime * .05, -uTime * .12))) * smoothstep(-.98, -.5, q.y);
        vec3 c = spec((ang - 39.5) / 3.2) * .30 + spec(1. - (ang - 50.4) / 3.6) * .07; c += vec3(.028) * smoothstep(40.5, 34., ang);
        gl_FragColor = vec4(c * veil * uSunCol * .17, 1.); }` }));
  rb.position.set(X + 4, 21, Z + 8); rb.scale.set(84, 58, 1); rb.renderOrder = 6; rb.frustumCulled = false; group.add(rb);
  return group;
}

// Air: snow on the ridge, ash over the caldera, drifting pollen everywhere else.
export function createAir(u, low) {
  const n = low ? 220 : 700, g = new THREE.InstancedBufferGeometry(), R = rng(61), o = new Float32Array(n * 4); g.instanceCount = n; g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  for (let i = 0; i < n; i++) o.set([R() * 60, R() * 34, R() * 60, R()], i * 4); g.setAttribute('aO', new THREE.InstancedBufferAttribute(o, 4));
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: GLSL + /* glsl */ `attribute vec4 aO; varying vec2 vQ; varying float vA; varying vec3 vC; void main(){ vQ = position.xy; float U = -uPhx.z / 300.; float snow = bump(U, 4., .4, .4), ash = bump(U, 5.6, .7, .3), pol = (1. - snow) * (1. - ash); snow *= 1. - uHigh; ash *= 1. - uHigh; pol *= 1. - uHigh * .4;
      vec3 B = vec3(60., 34., 60.); vec3 v = vec3(-.7, -1.9, .3) * snow + vec3(.5, -.55, .2) * ash + vec3(.25, .08, .15) * pol; vec3 f = cameraPosition - vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]) * 24.;
      vec3 p = aO.xyz + v * uTime * (.7 + aO.w * .6); p = mod(p - f, B) - B * .5 + f; p += vec3(sin(uTime * .9 + aO.w * 40.), sin(uTime * .7 + aO.w * 70.) * .6, cos(uTime * .8 + aO.w * 55.)) * mix(.7, .5, snow);
      float d = length(p - cameraPosition); vA = smoothstep(7., 13., d) * smoothstep(34., 22., d) * (snow * .85 + ash * .5 + pol * .42 * step(.55, aO.w)); float glow = pow(max(dot(normalize(p - cameraPosition), uSunDir), 0.), 4.);
      vC = (uSky * .6 + uSunCol * .3) * snow + (vec3(.07,.06,.06) + uSky * .18) * ash + (uSunCol * (.28 + glow * 1.2)) * pol; vec4 m = viewMatrix * vec4(p, 1.); m.xy += position.xy * (.025 + aO.w * .04) * (1. + ash * .4); gl_Position = projectionMatrix * m; }`,
    fragmentShader: 'precision highp float; varying vec2 vQ; varying float vA; varying vec3 vC; void main(){ float r = length(vQ); gl_FragColor = vec4(vC, vA * smoothstep(1., .25, r)); }' }));
  m.frustumCulled = false; m.renderOrder = 6; return m;
}
