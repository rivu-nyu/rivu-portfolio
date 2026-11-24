import * as THREE from 'three';
import { GLSL, SHADOW, HMAP, rng, lerp, smooth, noise } from './common';
import { FALL, height } from './landscape';

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

// Falling water as layered sheets that follow the cliff profile, plus spray, drifting mist and a faint rainbow.
export function createWaterfall(u, low) {
  const group = new THREE.Group(), R = rng(19), X = FALL.x, Z = FALL.z;
  // where the rock face lies at this z: walk inward until the ground reaches a height
  const faceX = (z, y, from) => { for (let x = from; x < X + 60; x += 0.4) if (height(x, z) > y) return x; return X + 60; };
  const sheets = [];
  const add = (z0, w, o) => sheets.push({ z0, w, ...o });
  // back curtain, body, then loose outer strands: depth comes from many overlapping layers
  add(0, 9.2, { push: 0.5, seed: 0.05, dens: 1.15 }); add(0.4, 8.4, { push: 1.3, seed: 0.1, dens: 1.1 }); add(-0.6, 7.4, { push: 2.1, seed: 0.5, dens: 1 }); add(1.2, 5.6, { push: 3.0, seed: 0.27, dens: 0.9 }); add(-2.2, 4.6, { push: 3.5, seed: 0.62, dens: 0.8 }); add(0.2, 3.4, { push: 4.3, seed: 0.83, dens: 0.75 }); add(3.6, 2.4, { push: 3.9, seed: 0.71, dens: 0.6 });
  add(-14.5, 1.7, { push: 1.0, seed: 0.3, dens: 0.8 }); add(13.8, 2.0, { push: 1.1, seed: 0.65, dens: 0.8 }); add(18.4, 0.8, { push: 0.8, seed: 0.9, dens: 0.6 }); add(-18.6, 0.8, { push: 0.8, seed: 0.45, dens: 0.6 });
  const pos = [], uv = [], data = [], idx = [];
  const ribbon = (path, s, tier, flare) => { const n = path.length, M = 22, base = pos.length / 3; let len = 0;
    for (let j = 0; j < n; j++) { if (j) len += path[j].distanceTo(path[j - 1]); const f = j / (n - 1);
      for (let i = 0; i <= M; i++) { const a = i / M * 2 - 1, w = s.w * (1 + flare * f) * (tier === 2 ? 1.2 : 1); const z = Z + s.z0 + a * w, bow = (1 - a * a) * 0.5;
        pos.push(path[j].x - bow + 0.35 * noise(a * 2 + s.seed * 9, f * 3), path[j].y, z); uv.push(a, len); data.push(f, s.seed, s.dens, tier); } }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < M; i++) { const k = base + j * (M + 1) + i; idx.push(k, k + 1, k + M + 1, k + 1, k + M + 2, k + M + 1); } };
  for (const s of sheets) {
    const z = Z + s.z0, lipX = faceX(z, FALL.top - 5, X + 12), topY = height(lipX + 5, z) + 0.6, lowX = faceX(z, FALL.ledge - 5, X + 4), ledgeY = FALL.ledge + 1.0;
    const V = (x, y) => new THREE.Vector3(x, y, z);
    // plateau run-in, upper fall, ledge, main fall
    const up = [V(lipX + 11, height(lipX + 11, z) + 0.45), V(lipX + 5, topY)]; for (let i = 0; i <= 14; i++) { const t = i / 14; up.push(V(lerp(lipX + 1.2, lipX - 2.2 - s.push * 0.5, Math.sqrt(t)), lerp(topY - 0.3, ledgeY, t * t * 0.55 + t * 0.45))); }
    ribbon(up, s, 1, 0.1);
    const dn = [V(lipX - 1.5, ledgeY + 0.35), V(lerp(lipX, lowX, 0.6), ledgeY + 0.3)]; for (let i = 0; i <= 34; i++) { const t = i / 34; dn.push(V(lerp(lowX + 0.6, lowX - 2.2 - s.push * 1.5, Math.pow(t, 0.6)), lerp(ledgeY, -0.2, t * t * 0.6 + t * 0.4))); }
    ribbon(dn, s, 2, 0.28);
    s.base = new THREE.Vector3(lowX - 2.5 - s.push * 1.3, 0.3, z);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aD', new THREE.Float32BufferAttribute(data, 4)); g.setIndex(idx); g.computeVertexNormals();
  const water = new THREE.Mesh(g, fallMaterial(u));
  water.renderOrder = 2; water.frustumCulled = false; group.add(water);

  // spray thrown up where each strand lands
  const n = low ? 700 : 2400, sg = new THREE.InstancedBufferGeometry(); sg.instanceCount = n; sg.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); sg.setIndex([0, 1, 2, 0, 2, 3]);
  const o = new Float32Array(n * 3), v = new Float32Array(n * 4), hits = [...sheets.map((s) => ({ p: s.base, w: s.w * 1.25, k: s.dens })), ...sheets.slice(0, 3).map((s) => ({ p: new THREE.Vector3(s.base.x + 9, FALL.ledge + 0.9, Z), w: s.w * 0.9, k: 0.5 }))];
  for (let i = 0; i < n; i++) { const h = hits[R() < 0.62 ? 0 : Math.floor(R() * hits.length)]; o.set([h.p.x + (R() - 0.5) * 2, h.p.y, h.p.z + (R() * 2 - 1) * h.w], i * 3); const drop = R() < 0.22; if (drop) { const h2 = sheets[Math.floor(R() * 5)]; o.set([h2.base.x + 1.2 - R() * 2.4, FALL.ledge - R() * 6, h2.base.z + (R() * 2 - 1) * h2.w * 1.15], i * 3); v.set([-(0.2 + R() * 0.9), -20 - R(), (R() - 0.5) * 0.7, 0.035 + R() * 0.05], i * 4); continue; } const big = R() < 0.34; v.set([-(0.6 + R() * 4.2), 2 + R() * R() * 7, (R() - 0.5) * 4, big ? 0.5 + R() * 0.7 : 0.05 + R() * 0.09], i * 4); }
  sg.setAttribute('aO', new THREE.InstancedBufferAttribute(o, 3)); sg.setAttribute('aV', new THREE.InstancedBufferAttribute(v, 4));
  const spray = new THREE.Mesh(sg, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime; attribute vec3 aO; attribute vec4 aV; varying vec2 vQ; varying float vA, vB; varying vec3 vW; void main(){ vQ = position.xy; float drop = step(aV.y, -10.); float life = mix(.7 + max(aV.y, 0.) * .16, 2.5, drop), t = fract(uTime / life + aO.x * 7.3 + aV.z * 3.1) * life; vA = t / life; vB = step(.3, aV.w); vec3 p = aO + vec3(aV.x, max(aV.y, 0.), aV.z) * t * mix(1., .5, vB); p.y -= mix(4.6, 5.6, drop) * t * t * mix(1., .25, vB); if (p.y < -.3) p.y = -50.; vW = p; vec4 m = viewMatrix * vec4(p, 1.); m.xy += position.xy * aV.w * mix(1., 1. + vA * 2.2, vB) * vec2(1., mix(mix(1.7, 2.5 + t * 5., drop), 1., vB)); gl_Position = projectionMatrix * m; }`,
    fragmentShader: GLSL + `varying vec2 vQ; varying float vA, vB; varying vec3 vW; void main(){ float r = length(vQ); if (r > 1.) discard; float a = smoothstep(1., 0., r) * (1. - vA) * smoothstep(0., .1, vA) * mix(.75, .13, vB); vec3 c = uSunCol * mix(.62, .30, vB) + uSky * .45; gl_FragColor = vec4(fogged(c, vW), a); }` }));
  spray.frustumCulled = false; spray.renderOrder = 4; group.add(spray);

  // bubbling foam: shaded froth where the upper fall hits the ledge and where the main fall meets the pool
  const fn = low ? 420 : 1500, fg = new THREE.InstancedBufferGeometry(); fg.instanceCount = fn; fg.setAttribute('position', sg.getAttribute('position')); fg.setIndex([0, 1, 2, 0, 2, 3]);
  const fo = new Float32Array(fn * 4), fv = new Float32Array(fn * 4);
  for (let i = 0; i < fn; i++) { const ledge = i < fn * 0.36, s = sheets[ledge ? Math.floor(R() * 4) : Math.floor(R() * sheets.length)], a = R() * 2 - 1, z = s.base.z + a * s.w * (ledge ? 1.12 : 1.3), k = R();
    const x = ledge ? s.base.x + 4.5 + R() * 6.5 : s.base.x + 1.8 - k * k * 9, gy = ledge ? FALL.ledge + 0.75 + 0.5 * R() : 0.1 + 1.1 * (1 - k) * R();
    fo.set([x, gy, z, R()], i * 4); fv.set([ledge ? 0.16 + R() * 0.36 : (0.16 + R() * 0.55) * (1 - k * 0.5), 0.5 + R() * 1.6, R() * 6.28, ledge ? 1 : 0], i * 4); }
  fg.setAttribute('aO', new THREE.InstancedBufferAttribute(fo, 4)); fg.setAttribute('aV', new THREE.InstancedBufferAttribute(fv, 4));
  const froth = new THREE.Mesh(fg, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `precision highp float; uniform float uTime; uniform vec3 uSunDir; attribute vec4 aO, aV; varying vec2 vQ; varying float vA, vS, vSun; varying vec3 vW; ${HMAP} void main(){ vQ = position.xy; vS = aO.w; float t = fract(uTime * aV.y * .55 + aO.w); vA = sin(t * 3.1416); vec3 p = aO.xyz; p.x -= t * mix(1.6, 2.2, aV.w); p.y += sin(t * 3.1416) * mix(.55, .4, aV.w) * (.4 + aO.w); p.z += sin(uTime * 2.2 + aV.z) * .22; vW = p; vSun = sunVis(p + vec3(-5., 2., 0.), uSunDir); vec4 m = viewMatrix * vec4(p, 1.); m.xy += position.xy * aV.x * (.6 + .6 * vA); gl_Position = projectionMatrix * m; }`,
    fragmentShader: GLSL + `varying vec2 vQ; varying float vA, vS, vSun; varying vec3 vW; void main(){ float r = length(vQ); if (r > 1.) discard; vec3 n = vec3(vQ, sqrt(1. - r * r)); vec3 right = vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]), up = vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]), fw = vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2]); vec3 N = normalize(right * n.x + up * n.y + fw * n.z);
      float cell = n2(vQ * 4.5 + vS * 60. + uTime * .6); float nl = max(dot(N, uSunDir) * .6 + .4, 0.); vec3 V = normalize(cameraPosition - vW); float sp = pow(max(dot(N, normalize(V + uSunDir)), 0.), 30.);
      vec3 c = vec3(.90,.94,.96) * (.72 + .4 * cell) * (uSunCol * vSun * .42 * nl + mix(uGround, uSky, N.y * .5 + .5) * .5); float tw = step(.82, hash2(vec2(floor(uTime * 7. + vS * 30.), vS * 91.))); c += uSunCol * vSun * sp * (.35 + 2.4 * tw);
      gl_FragColor = vec4(fogged(c, vW), smoothstep(1., .55, r + (cell - .5) * .5) * vA * .85); }` }));
  froth.frustumCulled = false; froth.renderOrder = 4; group.add(froth);

  // drifting mist with a rainbow where the angle to the sun is right
  const mg = new THREE.PlaneGeometry(1, 1), mm = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vec3 c = modelMatrix[3].xyz; vec3 r = vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]); vW = c + r * position.x * length(modelMatrix[0].xyz) + vec3(0.,1.,0.) * position.y * length(modelMatrix[1].xyz); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    fragmentShader: GLSL + /* glsl */ `varying vec2 vU; varying vec3 vW; void main(){ vec2 q = vU * 2. - 1.; float n = fbm2(vU * vec2(3.2, 2.4) + vec2(uTime * .06, -uTime * .22) + vW.z * .02); float m = smoothstep(1., .05, length(q * vec2(1., 1.05))); float a = m * smoothstep(.2, .75, n) * .30;
      vec3 c = uSunCol * (.17 + .10 * n) + uSky * .46; gl_FragColor = vec4(mix(c, fogged(c, vW), .5) * a, a); }` });
  mm.blending = THREE.CustomBlending; mm.blendSrc = THREE.OneFactor; mm.blendDst = THREE.OneMinusSrcAlphaFactor;
  for (let i = 0; i < (low ? 5 : 13); i++) { const m = new THREE.Mesh(mg, mm); const f = i / 8; m.position.set(X + 12 - R() * 24, 2 + R() * 8, Z + (R() - 0.5) * 46); m.scale.set(26 + R() * 14, 12 + R() * 12, 1); m.renderOrder = 5; group.add(m); }
  const lm = new THREE.Mesh(mg, mm); lm.position.set(X + 24, FALL.ledge + 3, Z); lm.scale.set(20, 9, 1); lm.renderOrder = 3; group.add(lm);
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
