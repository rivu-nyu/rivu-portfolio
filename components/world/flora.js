import * as THREE from 'three';
import { GLSL, SHADOW, HMAP, noise, smooth, bump, rng } from './common';
import { STOP_GAP } from './stops';
import { BIOME, CONE, FALL, center, fallCliff, height, riverWidth } from './landscape';

/* Photo-scanned trees (Poly Haven, CC0), baked into view-dependent cards: each atlas holds the same tree seen from
   several sides, with its surface direction and ambient occlusion, so a whole forest can be lit like real geometry.
   w/h: card size as a fraction of tree height; foot: how far up the card the ground sits. */
export const KINDS = {
  fir: { views: 8, cols: 4, w: 0.3763, h: 1.0373, foot: 0.0186, tint: [0.60, 0.80, 0.62], leaf: 0.35 },
  spruce: { views: 8, cols: 4, w: 0.6706, h: 1.0518, foot: 0.0252, tint: [1.0, 1.12, 0.9], leaf: 0.3 },
  spruce2: { views: 8, cols: 4, w: 0.6149, h: 1.049, foot: 0.024, tint: [1.0, 1.12, 0.9], leaf: 0.3 },
  oak: { views: 8, cols: 4, w: 1.0869, h: 1.0723, foot: 0.0343, tint: [1.1, 1.16, 0.86], leaf: 0.7 },
  elm: { views: 8, cols: 4, w: 1.0182, h: 1.0689, foot: 0.0328, tint: [1.15, 1.15, 0.86], leaf: 0.75 },
  cherry: { views: 8, cols: 4, w: 1.3478, h: 1.0787, foot: 0.0371, tint: [1, 1, 1], leaf: 0.75 },
  bush: { views: 4, cols: 2, w: 1.7006, h: 1.1565, foot: 0.0708, tint: [1.9, 2.1, 1.3], leaf: 0.5 },
  fern: { views: 4, cols: 2, w: 3.0896, h: 1.33, foot: 0.1408, tint: [0.8, 0.95, 0.6], leaf: 0.6 },
};

const VS = (k, depth) => GLSL + `attribute vec4 aP; attribute vec4 aQ; varying vec2 vC, vU0, vU1; varying float vMix, vSun, vSeed, vSize; varying vec3 vW, vRt, vD, vBio; uniform vec3 uMoon; ${HMAP} ${depth ? '' : `uniform sampler2D uShadow; uniform mat4 uShadowM; float softShade(vec3 p, float r){ vec4 c = uShadowM * vec4(p, 1.); vec3 q = c.xyz / c.w * .5 + .5; vec2 e = min(q.xy, 1. - q.xy); float fade = smoothstep(0., .12, min(e.x, e.y)); if (fade <= 0. || q.z > 1.) return 1.; float s = 0.; for (int i = 0; i < 10; i++){ float a = float(i) * 2.4; s += step(q.z - .004, texture2D(uShadow, q.xy + vec2(cos(a), sin(a)) * sqrt((float(i) + .5) / 10.) * r).r); } return mix(1., s / 10., fade); }`}
  vec2 cell(float i){ i = mod(i, ${k.views.toFixed(1)}); return vec2(mod(i, ${k.cols.toFixed(1)}), floor(i / ${k.cols.toFixed(1)})); }
  void main(){ vec3 o = aP.xyz; float H = aP.w; ${depth ? '' : `vW = o; { ${BIOME} vBio = vec3(canyon, snowy, volc); }`} vec3 d = ${depth ? 'uMoon.y > 0. ? uMoon : uSunDir' : 'cameraPosition - o'}; d.y = 0.; d = normalize(d); vec3 r = vec3(d.z, 0., -d.x);
    float f = (atan(d.x, d.z) - aQ.x) / 6.2831853 * ${k.views.toFixed(1)}; f = f < 0. ? f + ${(k.views * 2).toFixed(1)} : f; float i = floor(f); vMix = smoothstep(.28, .72, f - i);
    vec2 c = position.xy; vC = c; vec2 S = vec2(${k.cols.toFixed(1)}, ${(k.views / k.cols).toFixed(1)}); vec2 a = cell(i), b = cell(i + 1.); vU0 = vec2((a.x + c.x) / S.x, 1. - (a.y + 1. - c.y) / S.y); vU1 = vec2((b.x + c.x) / S.x, 1. - (b.y + 1. - c.y) / S.y);
    float X = (c.x - .5) * ${k.w.toFixed(4)} * H * aQ.y, Y = (c.y - ${k.foot.toFixed(4)}) * ${k.h.toFixed(4)} * H;
    vec3 w = o + r * X + vec3(0., Y, 0.); float sw = Y * Y / H * .006; w.x += sw * sin(uTime * 1.1 + o.x * .2 + o.z * .13); w.z += sw * cos(uTime * .9 + o.z * .2); w += r * sin(uTime * 2.6 + c.y * 9. + c.x * 7. + o.x) * .0022 * H * c.y;
    vW = w; vRt = r; vD = d; vSeed = aQ.z; vSize = H; vSun = ${depth ? '1.' : 'sunVis(o + vec3(0., H * .6, 0.), uSunDir) * mix(.42, 1., softShade(o + vec3(0., H * c.y, 0.) + uSunDir * H * .34, clamp(H * .0016, .006, .03)))'}; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.); }`;

function material(u, k, low, isle) {
  const uni = { ...u, tA: { value: null }, tB: { value: null }, uMoon: { value: new THREE.Vector3(0, -1, 0) } };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS(k, false), fragmentShader: GLSL + SHADOW + /* glsl */ `
    uniform sampler2D tA, tB; varying vec2 vC, vU0, vU1; varying float vMix, vSun, vSeed, vSize; varying vec3 vW, vRt, vD, vBio;
    ${isle ? 'uniform sampler2D uIsleS; uniform mat4 uIsleM; float isleShadow(vec3 p){ vec4 c = uIsleM * vec4(p, 1.); vec3 q = c.xyz / c.w * .5 + .5; if (min(min(q.x, q.y), min(1. - q.x, 1. - q.y)) < 0.) return 1.; float s = 0.; for (int i = 0; i < 4; i++) s += step(q.z - .004, texture2D(uIsleS, q.xy + (vec2(float(i - (i/2)*2), float(i/2)) - .5) * .0012).r); return s * .25; }' : ''}
    void main(){ float canyon = vBio.x, snowy = vBio.y, volc = vBio.z; float dist = length(cameraPosition - vW); if (dist < 15. && hash2(gl_FragCoord.xy) > smoothstep(6., 15., dist) && vSize > 2.) discard;
      vec4 a0 = texture2D(tA, vU0), a1 = texture2D(tA, vU1); float a = mix(a0.a, a1.a, vMix); float cov = (a - .33) / max(fwidth(a), .08) + .5; if (cov < .06) discard; cov = clamp(cov, 0., 1.);
      float w0 = a0.a * (1. - vMix), w1 = a1.a * vMix, ws = max(w0 + w1, .001); vec3 alb = (a0.rgb * w0 + a1.rgb * w1) / ws; vec3 nb = (texture2D(tB, vU0).rgb * w0 + texture2D(tB, vU1).rgb * w1) / ws; float ao = nb.b;
      vec2 nx = nb.xy * 2. - 1.; float nz = sqrt(max(1. - dot(nx, nx), .04)); vec3 N = normalize(vRt * nx.x + vec3(0., nx.y, 0.) + vD * nz), Nc = normalize(vRt * (vC.x - .5) * 2.4 + vec3(0., (vC.y - .42) * 1.7, 0.) + vD * .55);
      N = normalize(mix(N, Nc, .5)); float leaf = ${k.leaf.toFixed(2)} * smoothstep(.0, .05, max(alb.g - alb.r * .86, ${k === KINDS.cherry ? 'alb.r - alb.b * .9' : '0.'}));
      alb *= mix(.5, 1.08, smoothstep(.15, .85, ao)); float s1 = fract(vSeed * 7.31), s2 = fract(vSeed * 3.17); vec3 V = normalize(cameraPosition - vW);
      ${k === KINDS.cherry ? 'float pk = smoothstep(.02, .12, alb.r - alb.g); alb = mix(alb, alb * mix(vec3(1.02,.92,.92), vec3(1.06,1.26,1.2), s1), pk); alb *= mix(vec3(1.), vec3(1.06,1.02,.82), pk); alb = mix(alb, alb * vec3(1.08,.86,.90), pk * smoothstep(.7, .25, ao));'
        : `alb *= vec3(${k.tint.join(',')}) * mix(.72, 1.22, s1) * mix(vec3(1.), vec3(1.22,1.02,.72), s2 * ${k === KINDS.oak || k === KINDS.elm ? '.75' : '.35'});`}
      alb = mix(alb, alb * vec3(1.25,.98,.62), canyon * .55); alb = mix(alb, vec3(dot(alb, vec3(.3))) * vec3(1.1,.95,.9) * .5, volc * .85);
      float sn = snowy * smoothstep(.30, .62, N.y * .6 + ao * .4 + (n2(vC * vec2(26., 46.) + vSeed * 60.) - .5) * .28); alb = mix(alb, vec3(.70,.76,.84), sn * .92);
      float sh = vSun; float self = smoothstep(-.1, .95, ao * .7 + dot(Nc, uSunDir) * .35); ${isle ? 'sh = isleShadow(vW + uSunDir * vSize * .3);' : ''}
      float nl = max(dot(N, uSunDir) * .8 + .2, 0.), back = pow(max(dot(-V, uSunDir), 0.), 3.) * leaf;
      vec3 sky = mix(uGround, uSky, N.y * .5 + .5);
      vec3 col = alb * (uSunCol * sh * (nl * .84 * mix(.28, 1., self) + back * 1.5 * (1. - self * .4)) + sky * 1.22 * mix(.22, 1., ao)) + alb * phxLight(vW, N) * mix(.4, 1., ao);
      ${isle ? 'col += alb * vec3(.03,.22,.14) * uAurora * ao * (.4 + .6 * max(N.y, 0.));' : ''}
      gl_FragColor = vec4(fogged(col, vW), cov); }` });
  mat.alphaToCoverage = true;
  const depth = new THREE.ShaderMaterial({ uniforms: uni, side: THREE.DoubleSide, vertexShader: VS(k, true), fragmentShader: 'precision highp float; uniform sampler2D tA; varying vec2 vU0; void main(){ if (texture2D(tA, vU0).a < .4) discard; gl_FragColor = vec4(1.); }' });
  return { mat, depth, uni };
}

// One set of atlases and materials per world; meshes are added chunk by chunk.
export function createFlora(u, low, onLoad) {
  const loader = new THREE.TextureLoader(), textures = [], mats = {}, quad = new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3); let dead = false, left = 0;
  const load = (n, srgb, cb) => { left++; loader.load(`/trees/${n}${low ? '_s' : ''}.webp`, (t) => { if (dead) return t.dispose(); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; textures.push(t); cb(t); left--; onLoad(); }, undefined, () => { left--; onLoad(); }); };
  const get = (kind, isle) => { const key = kind + (isle ? '*' : ''); if (!mats[key]) { const m = mats[key] = material(isle ? { ...u, ...isle } : u, KINDS[kind], low, !!isle); const other = mats[isle ? kind : kind + '*']; if (other) { m.uni.tA = other.uni.tA; m.uni.tB = other.uni.tB; m.mat.uniforms.tA = m.depth.uniforms.tA = m.uni.tA; m.mat.uniforms.tB = m.depth.uniforms.tB = m.uni.tB; } else { load(kind, true, (t) => { m.uni.tA.value = t; }); load(kind + '_n', false, (t) => { m.uni.tB.value = t; }); } } return mats[key]; };
  // items: [x, y, z, height, turn, width, seed]
  const mesh = (kind, items, opt = {}) => {
    const g = new THREE.InstancedBufferGeometry(), P = new Float32Array(items.length * 4), Q = new Float32Array(items.length * 4); g.setAttribute('position', quad); g.setIndex([0, 1, 2, 0, 2, 3]);
    const box = new THREE.Box3(), v = new THREE.Vector3(); let mh = 0; items.forEach((t, i) => { P.set([t[0], t[1], t[2], t[3]], i * 4); Q.set([t[4], t[5], t[6], 0], i * 4); box.expandByPoint(v.set(t[0], t[1], t[2])); mh = Math.max(mh, t[3]); });
    g.setAttribute('aP', new THREE.InstancedBufferAttribute(P, 4)); g.setAttribute('aQ', new THREE.InstancedBufferAttribute(Q, 4)); g.instanceCount = items.length; g.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); g.boundingSphere.radius += mh * 1.3;
    const { mat, depth } = get(kind, opt.isle), m = new THREE.Mesh(g, mat); m.userData.box = box; if (opt.shadow !== false) { m.userData.depthMat = depth; if (!opt.isle) m.layers.enable(1); } return m;
  };
  return { mesh, get, left: () => left, dispose: () => { dead = true; textures.forEach((t) => t.dispose()); Object.values(mats).forEach((m) => m.depth.dispose()); } };
}

// Forests, thickets and undergrowth along the whole flight.
export function createTrees(flora, low, perches) {
  const R = rng(77), lists = Object.fromEntries(Object.keys(KINDS).map((k) => [k, []])), taken = new Map();
  const key = (x, z) => `${Math.floor(x / 6)},${Math.floor(z / 6)}`;
  const free = (x, z, r) => { for (let i = -1; i < 2; i++) for (let j = -1; j < 2; j++) for (const [a, b, c] of taken.get(key(x + i * 6, z + j * 6)) || []) if ((a - x) ** 2 + (b - z) ** 2 < (r + c) ** 2) return false; return true; };
  const claim = (x, z, r) => { const k = key(x, z); if (!taken.has(k)) taken.set(k, []); taken.get(k).push([x, z, r]); };
  const blocked = (x, z) => Math.hypot(x - CONE.x, z - CONE.z) < 175 || (Math.abs(z - FALL.z) < 34 && x > FALL.x - 48 && fallCliff(x, z) < 24) || (z - FALL.z > -100 && z - FALL.z < 34 && x > center(z) - 4 && x < FALL.x - 4);
  const max = low ? 5200 : 17000; let n = 0;
  for (let t = 0; t < max * 9 && n < max; t++) {
    const focus = t < (low ? 2500 : 9000), z = focus ? FALL.z + (R() - 0.5) * 260 : 1200 - R() * 3900, U = -z / STOP_GAP, q = R(), x = focus ? FALL.x - 20 + R() * 150 : center(z) + (R() < 0.5 ? -1 : 1) * (Math.max(17.5, riverWidth(z) + 6) + (q < 0.5 ? q * 110 : q * q * 270)), y = height(x, z);
    const UW = U + 0.3 * noise(x * 0.011 + 4, z * 0.011) + 0.12 * noise(x * 0.05, z * 0.05), canyon = bump(UW, 2.12, 0.5, 0.45), pink = bump(UW, 0, 0.18, 0.5), snow = bump(UW, 4, 0.42, 0.5), volc = bump(UW, 5.5, 0.7, 0.5);
    if (y < 2.4 || y > 112 || (blocked(x, z) && !(z < FALL.z - 38 && x > center(z) + 34 && x < FALL.x - 10)) || Math.abs(x - center(z)) < Math.max(17, riverWidth(z) + 5)) continue;
    if (R() > 1 - canyon * 0.93 - volc * 0.985 - pink * 0.86) continue;
    const slope = Math.hypot(height(x + 2, z) - y, height(x, z + 2) - y) / 2; const gorge = Math.abs(z - FALL.z) < 135 && x > center(z) + 24, e = gorge ? fallCliff(x, z) : 0; if (slope > (gorge ? 0.55 : 1.15)) continue;
    if (gorge && e > -5 && e < 21) continue; // nothing grows out of a sheer face
    if (!gorge && noise(x * 0.016, z * 0.016) + 0.42 < R() * 0.75) continue; // glades
    if (perches.some((k) => Math.abs(k.z - z) < 17 && Math.hypot(k.x - x, k.z - z) < 15)) continue;
    const low1 = smooth(34, 8, y) * (1 - snow) , grove = noise(x * 0.013 + 40, z * 0.013 + 9); let kind, h, r;
    if (canyon > 0.4) { kind = 'oak'; h = 4 + R() * 4.5; r = h * 0.3; }
    else if (pink > 0.3) { kind = R() < 0.6 ? 'elm' : 'oak'; h = 8 + R() * 7; r = h * 0.3; }
    else if (gorge) { kind = e > 0 ? (R() < 0.3 ? 'fir' : R() < 0.75 ? 'spruce' : 'spruce2') : (R() < 0.35 ? 'oak' : R() < 0.5 ? 'elm' : 'spruce'); h = e > 0 ? 7 + R() * R() * 11 : 8 + R() * 7; r = h * 0.15; }
    else if (R() < low1 * (0.42 + grove * 0.9)) { kind = R() < 0.5 ? 'oak' : 'elm'; h = kind === 'oak' ? 8 + R() * 7 : 10 + R() * 8; r = h * 0.3; }
    else { const c = R(); kind = c < 0.42 + grove * 0.4 ? 'fir' : c < 0.75 ? 'spruce' : 'spruce2'; h = kind === 'fir' ? 14 + R() * 13 : 6 + R() * R() * 13; if (y > 62) h *= 0.8; r = h * (kind === 'fir' ? 0.11 : 0.17); }
    if (Math.abs(x - center(z)) < 11.5 + KINDS[kind].w * h * 0.55) continue; // crowns stay clear of the flight line
    if (!free(x, z, r * 0.8)) continue; claim(x, z, r * 0.8);
    lists[kind].push([x, y - 0.12 - slope * h * 0.02, z, h, R() * 6.28, 0.9 + R() * 0.25, R()]); n++;
  }
  // thickets and ferns near the water and under the trees
  const under = low ? 1500 : 6500; let m = 0;
  for (let t = 0; t < under * 8 && m < under; t++) {
    const gorge = t < (low ? 500 : 2200), z = gorge ? FALL.z + (R() - 0.5) * 190 : 1100 - R() * 3500, U = -z / STOP_GAP, rw = riverWidth(z), x = center(z) + (R() < 0.5 ? -1 : 1) * (rw + 2 + R() * R() * 62), y = height(x, z); const gz = Math.abs(z - FALL.z) < 135 && x > center(z) + 4; if (y < (gz ? 1.1 : 1.5) || y > 34 || (gz ? Math.hypot(x - FALL.x, z - FALL.z) < 26 || (x > center(z) + 24 && fallCliff(x, z) > -2) : blocked(x, z))) continue;
    const canyon = bump(U, 2.12, 0.5, 0.4), snow = bump(U, 4, 0.5, 0.4), volc = bump(U, 5.5, 0.75, 0.4); if (R() < volc * 1.05 || R() < snow * 0.75 || R() < canyon * 0.45) continue; if (noise(x * 0.045, z * 0.045) < (gz ? -0.25 : -0.12)) continue;
    if (perches.some((k) => Math.hypot(k.x - x, k.z - z) < 5)) continue;
    const fern = R() < 0.6 && canyon < 0.3 && snow < 0.3, h = fern ? 0.35 + R() * 0.45 : 0.8 + R() * R() * 2.2; if (!free(x, z, fern ? 0.3 : h * 0.5)) continue;
    lists[fern ? 'fern' : 'bush'].push([x, y - 0.05, z, h, R() * 6.28, 0.9 + R() * 0.3, R()]); m++;
  }
  const group = new THREE.Group(), chunks = [];
  for (const [kind, l] of Object.entries(lists)) { const small = kind === 'bush' || kind === 'fern', C = small ? 34 : 24, bins = new Map(); for (const t of l) { const b = Math.floor((1300 - t[2]) / (4200 / C)) * 2 + (t[0] > center(t[2]) ? 1 : 0); if (!bins.has(b)) bins.set(b, []); bins.get(b).push(t); }
    for (const part of bins.values()) { // front to back order inside a chunk is unknown, so nearest-to-path first is the best guess
      part.sort((a, b) => Math.abs(a[0] - center(a[2])) - Math.abs(b[0] - center(b[2]))); const k = flora.mesh(kind, part); group.add(k); chunks.push({ m: k, z0: k.userData.box.max.z, z1: k.userData.box.min.z, far: small ? (low ? 90 : 190) : low ? 560 : 900 }); } }
  group.userData.lod = (z) => { for (const c of chunks) c.m.visible = (z > c.z0 ? z - c.z0 : z < c.z1 ? c.z1 - z : 0) < c.far; };
  return group;
}

// Tufts follow the camera: a patch that wraps around it and sits on the height map.
export function createGrass(u, low, onLoad) {
  const n = low ? 2600 : 11000, size = low ? 46 : 78, R = rng(3), geo = new THREE.InstancedBufferGeometry(); geo.instanceCount = n;
  const pos = [], uv = [], idx = []; for (let k = 0; k < 2; k++) { const a = k * 1.57, dx = Math.cos(a), dz = Math.sin(a), b = pos.length / 3; for (const [x, y] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { pos.push(dx * x * 0.8, y, dz * x * 0.8); uv.push(x * 0.5 + 0.5, y); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const off = new Float32Array(n * 4); for (let i = 0; i < n; i++) off.set([R() * size, R() * size, R() * 6.28, R()], i * 4); geo.setAttribute('aO', new THREE.InstancedBufferAttribute(off, 4));
  const uni = { ...u, tA: { value: null } }; let dead = false; new THREE.TextureLoader().load('/trees/grass.webp', (t) => { if (dead) return t.dispose(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; uni.tA.value = t; onLoad(); });
  const mat = new THREE.ShaderMaterial({ uniforms: uni, side: THREE.DoubleSide,
    vertexShader: GLSL + HMAP + /* glsl */ `attribute vec4 aO; varying vec3 vW; varying vec2 vU; varying float vY, vR, vSun;
      void main(){ vec2 f = cameraPosition.xz - vec2(viewMatrix[0][2], viewMatrix[2][2]) * ${(size * 0.38).toFixed(1)}; vec2 c = mod(aO.xy - f, ${size.toFixed(1)}) - ${(size / 2).toFixed(1)} + f; vW = vec3(c.x, hAt(c), c.y);
        ${BIOME} float sl = length(vec2(hAt(c + vec2(1.5, 0.)), hAt(c + vec2(0., 1.5))) - vW.y) / 1.5;
        float patchy = smoothstep(.24, .5, fbm2(c * .09) + aO.w * .18 - .06), edge = smoothstep(${(size / 2).toFixed(1)}, ${(size * 0.36).toFixed(1)}, length(c - f));
        float k = patchy * edge * smoothstep(1.2, 2.0, vW.y) * smoothstep(.95, .5, sl) * (1. - volc) * (1. - snowy * .8) * mix(1., step(.70, aO.w), canyon);
        float s = k * (.35 + .75 * fract(aO.w * 13.7)); float ca = cos(aO.z), sa = sin(aO.z); vec3 p = position; p.xz = mat2(ca, -sa, sa, ca) * p.xz; p.y -= .06;
        p.xz += vec2(.16, .08) * p.y * p.y * (sin(uTime * 2.1 + c.x * .4 + c.y * .3) + .4); vW += p * s * vec3(1.15, 1., 1.15); vY = position.y; vR = aO.w; vU = vec2((uv.x + floor(fract(aO.w * 31.) * 4.)) * .25, uv.y * .98); vSun = sunVis(vec3(c.x, vW.y + .5, c.y), uSunDir);
        gl_Position = k < .05 ? vec4(2.,2.,2.,1.) : projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    fragmentShader: GLSL + SHADOW + /* glsl */ `uniform sampler2D tA; varying vec3 vW; varying vec2 vU; varying float vY, vR, vSun; void main(){ ${BIOME} vec4 t = texture2D(tA, vU); float cov = (t.a - .34) / max(fwidth(t.a), .06) + .5; if (cov < .06) discard;
      vec3 alb = t.rgb * mix(vec3(.75,.88,.55), vec3(1.35,1.15,.7), fract(vR * 41.)) * 1.15; alb = mix(alb, alb * vec3(1.9,1.35,.8) + vec3(.06,.04,.015), canyon); alb = mix(alb, vec3(.55,.57,.58), snowy * .55);
      vec3 V = normalize(cameraPosition - vW); float sh = vSun * castShadow(vW + uSunDir * .3, vec3(0.,1.,0.));
      vec3 col = alb * (uSunCol * sh * (max(uSunDir.y, 0.) * .6 + .28 + .9 * pow(max(dot(-V, uSunDir), 0.), 3.)) * (.45 + .55 * vY) + mix(uGround, uSky, .8) * .95 * (.35 + .65 * vY) + phxLight(vW, vec3(0.,1.,0.)));
      gl_FragColor = vec4(fogged(col, vW), clamp(cov, 0., 1.)); }` }); mat.alphaToCoverage = true;
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.userData.stop = () => { dead = true; uni.tA.value?.dispose(); }; return m;
}

// ---------- scanned meshes
export async function loadMeshes(url) {
  const b = await (await fetch(url)).arrayBuffer(), d = new DataView(b), out = []; let o = 4; const take = (T, n) => { const a = new T(b, o, n); o += Math.ceil(a.byteLength / 4) * 4; return a; };
  for (let k = d.getUint32(0, true); k > 0; k--) { const v = d.getUint32(o, true), n = d.getUint32(o + 4, true), s = d.getFloat32(o + 8, true), hasUv = d.getUint32(o + 12, true); o += 16;
    const q = take(Int16Array, v * 3), pos = Float32Array.from(q, (x) => x / 32767 * s); if (!n) { out.push(pos); continue; }
    const nor = take(Int8Array, v * 3), uv = hasUv ? take(Uint16Array, v * 2) : null, idx = take(v < 65536 ? Uint16Array : Uint32Array, n), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true)); if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2, true)); g.setIndex(new THREE.BufferAttribute(idx, 1)); out.push(g); }
  return out;
}

function rockMaterial(u) {
  return new THREE.ShaderMaterial({ uniforms: u, side: THREE.DoubleSide,
    vertexShader: `precision highp float; varying vec3 vW, vN, vP; varying vec2 vU; varying float vAo, vSun; uniform vec3 uSunDir; ${HMAP}
      void main(){ vec4 w = instanceMatrix * vec4(position, 1.); vW = w.xyz; vP = position; vU = uv; mat3 m = mat3(instanceMatrix); vN = m * (normal / vec3(dot(m[0],m[0]), dot(m[1],m[1]), dot(m[2],m[2]))); float big = length(m[1]); vAo = w.y > 300. ? 1. : mix(.35, 1.0, smoothstep(-.1 * big, .7 * big, vW.y - hAt(vW.xz))); vSun = sunVis(vW, uSunDir); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: GLSL + SHADOW + /* glsl */ `uniform sampler2D tBoulder, tBoulderN, tRock, tRockN, tNoise; varying vec3 vW, vN, vP; varying vec2 vU; varying float vAo, vSun;
      void main(){ ${BIOME} float dist = length(cameraPosition - vW); if (dist < 10. && hash2(gl_FragCoord.xy) > smoothstep(6., 10., dist)) discard; vec3 G = normalize(vN), N = G;
        vec3 tn = texture2D(tBoulderN, vU).xyz * 2. - 1.; vec3 dpx = dFdx(vW), dpy = dFdy(vW); vec2 dux = dFdx(vU), duy = dFdy(vU); vec3 T = dpx * duy.y - dpy * dux.y, B = dpy * dux.x - dpx * duy.x; float il = inversesqrt(max(max(dot(T,T), dot(B,B)), 1e-12)); N = normalize(T * il * tn.x * 1.25 + B * il * tn.y * 1.25 + G * tn.z);
        vec3 alb = texture2D(tBoulder, vU).rgb; float l = dot(alb, vec3(.33)); vec3 w = pow(abs(G), vec3(4.)); w /= w.x + w.y + w.z; vec3 p = vW * .55; vec3 dt = texture2D(tRock, p.zy).rgb * w.x + texture2D(tRock, p.xz).rgb * w.y + texture2D(tRock, p.xy).rgb * w.z; alb *= mix(1., .35 + 1.9 * dot(dt, vec3(.33)), smoothstep(60., 14., dist));
        float nz = texture2D(tNoise, vW.xz * .09 + vW.y * .07).r;
        float dry = max(canyon, volc); alb = mix(alb, vec3(dot(alb, vec3(.33))) * vec3(1.05,1.,.94), dry * .85); alb = mix(alb, alb * vec3(1.75,1.02,.66), canyon); alb = mix(alb, alb * .34, volc); alb = mix(alb, vec3(dot(alb, vec3(.33))), .4) * 1.35;
        float sn = snowy * smoothstep(.42, .60, mix(N.y, G.y, .45) + (nz - .5) * .5 + (n2(vW.xz * 3. + vW.y * 2.) - .5) * .22); alb = mix(alb, vec3(.66,.71,.79), sn);
        float wet = smoothstep(1.1, .1, vW.y + (nz - .5)) * (1. - volc); alb *= 1. - .5 * wet;
        float sh = vSun * castShadow(vW + uSunDir * .25, G); float nl = max(dot(N, uSunDir), 0.) * smoothstep(-.05, .2, dot(G, uSunDir)); vec3 V = normalize(cameraPosition - vW);
        vec3 col = alb * (uSunCol * nl * sh * 1.12 + mix(uGround, uSky, N.y * .5 + .5) * .95 * vAo) + alb * uSunCol * canyon * .05 + uSunCol * sh * (wet * .3 + .035) * pow(max(dot(N, normalize(V + uSunDir)), 0.), 30.) + alb * phxLight(vW, N);
        if (hiA > .5) col += alb * vec3(.03,.22,.14) * uAurora * max(N.y, 0.);
        float o = abs(vW.x - (55. * sin(vW.z * .0045) + 24. * sin(vW.z * .011 + 1.3))); col += (alb + .012) * vec3(2.6,.62,.10) * volc * exp(-max(o - 9., 0.) * .085) * exp(-max(vW.y - 1., 0.) * .07) * (.35 + .65 * clamp(1.3 - G.y, 0., 1.));
        gl_FragColor = vec4(fogged(col, vW), 1.); }` });
}

export function createRocks(u, low, perches, onLoad) {
  const group = new THREE.Group(), mat = rockMaterial(u), R = rng(31), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), lists = [0, 1, 2, 3, 4, 5].map(() => []); let dead = false;
  const put = (x, y, z, sc, tilt = 0.5) => lists[Math.floor(R() * 6)].push(new THREE.Matrix4().compose(p.set(x, y, z), q.setFromEuler(e.set((R() - 0.5) * tilt, R() * 6.28, (R() - 0.5) * tilt)), s.set(sc, sc * (0.8 + R() * 0.4), sc)));
  const n = low ? 1100 : 3600;
  for (let i = 0; i < n; i++) { const z = 1160 - R() * 3850, side = R() < 0.5 ? -1 : 1, rw = riverWidth(z), near = R() < 0.5, d = near ? rw - 2 + R() * 11 : rw + R() * R() * 110, x = center(z) + side * d, y = height(x, z);
    if (y < -0.8 || y > 60) continue; const sc = near ? 0.22 + R() * R() * R() * 1.7 : 0.25 + Math.pow(R(), 4) * 3.2; if (perches.some((k) => Math.abs(k.z - z) < 7 && Math.abs(k.x - x) < 7)) continue;
    if (sc * 1.6 > d - 10 && sc > 1.2) continue; put(x, y + sc * 0.16, z, sc); }
  for (let i = 0; i < 40; i++) { const z = FALL.z + (R() - 0.5) * 52, inner = i < 18; let x = FALL.x - 22 + R() * 30; if (inner) { for (x = FALL.x - 4; x < FALL.x + 40 && fallCliff(x, z) < -2.5 - R() * 3; x += 0.5); } else if (Math.abs(z - FALL.z) < 9) continue; const sc = inner ? 0.8 + R() * 1.9 : 0.5 + R() * R() * 2; put(x, height(x, z) + sc * 0.35, z, sc); }
  loadMeshes('/models/rocks.bin').then((geos) => { if (dead) return geos.forEach((g) => g.dispose());
    lists.forEach((l, i) => { l.sort((a, b) => b.elements[14] - a.elements[14]); const C = 8, sz = Math.ceil(l.length / C); for (let c = 0; c < C; c++) { const part = l.slice(c * sz, (c + 1) * sz); if (!part.length) continue; const m = new THREE.InstancedMesh(geos[i], mat, part.length); part.forEach((x, k) => m.setMatrixAt(k, x)); m.computeBoundingSphere(); group.add(m); } });
    // the crags the phoenix lands on: a stack of scanned boulders whose highest point is exactly where it stands
    const G = geos[3], bp = G.attributes.position, stacks = [[], []]; let top = -1, ti = 0; for (let i = 0; i < bp.count; i++) if (bp.getY(i) > top) { top = bp.getY(i); ti = i; }
    perches.forEach((k, i) => { if (k.noRock && !k.rock) return; const a = i * 2.4, sc = k.rock || Math.max(3.1, (k.y - k.ground + 1) / (top + 0.55)), tx = bp.getX(ti) * sc * 1.18, tz = bp.getZ(ti) * sc * 1.18, ca = Math.cos(a), sa = Math.sin(a); const x = k.x - (ca * tx + sa * tz), z = k.z - (-sa * tx + ca * tz), y = k.y - top * sc;
      stacks[0].push(new THREE.Matrix4().compose(p.set(x, y, z), q.setFromEuler(e.set(0, a, 0)), s.set(sc * 1.18, sc, sc * 1.18)));
      for (let j = 0; j < 4; j++) { const b = a + j * 1.57 + R(), r = sc * (0.85 + R() * 0.5), s2 = sc * (0.3 + R() * 0.35), xx = x + Math.cos(b) * r, zz = z + Math.sin(b) * r; stacks[1].push(new THREE.Matrix4().compose(p.set(xx, (k.rock ? y - sc * 0.4 : height(xx, zz) + s2 * 0.15), zz), q.setFromEuler(e.set(R() * 0.5, R() * 6.28, R() * 0.5)), s.set(s2, s2, s2))); } });
    stacks.forEach((l, i) => { const m = new THREE.InstancedMesh(geos[i ? 0 : 3], mat, l.length); l.forEach((x, k) => m.setMatrixAt(k, x)); m.frustumCulled = false; group.add(m); });
    group.userData.ready?.(); onLoad();
  }).catch(onLoad);
  group.userData.stop = () => { dead = true; };
  return group;
}
