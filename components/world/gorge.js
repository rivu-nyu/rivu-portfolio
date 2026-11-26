import * as THREE from 'three';
import { GLSL, SHADOW, rng, lerp, smooth, noise, FastLoader } from './common';
import { FALL, FALLS, alcove } from './landscape';
import { loadMeshes } from './flora';

/* Silver Falls: a mountain basin on three tiers, assembled from scanned cliffs. The scans are placed, bent and notched
   here, merged, and measured (front-most rock for every lateral position and height) so the water can follow them. */
const X = FALL.x, Z = FALL.z, V = (x, y, z) => new THREE.Vector3(x, y, z);

// [model, scale, sideways, inward, base height, turn, mirrored, lean, tier]
function layout() {
  const P = [], M = 0, C = 1, N = 2, d = Math.PI / 180;
  // lower wall: two long faces closing in on the recess, the face behind the great fall, fractured buttresses
  P.push([C, 3.5, -74, 8, -4, 13 * d, 1, 0, 1], [C, 3.5, 74, 9, -4, -13 * d, -1, 0, 1], [M, 3.1, 1, 28, -4, 0, 1, 0, 1], [M, 2.9, -26, 20, -4, 34 * d, -1, 0, 1], [M, 2.8, 27, 20, -4, -32 * d, 1, 0, 1]);
  P.push([N, 2.6, -46, 5, -5, 22 * d, 1, 0, 1], [N, 2.4, 50, 6, -5, -24 * d, -1, 0, 1],  [M, 3.0, -70, 10, -4, -8 * d, -1, 0, 1], [M, 3.0, 66, 10, -4, 12 * d, 1, 0, 1]);
  // middle wall
  [[-92, 3.7, 12], [-72, 3.3, -10], [-46, 3.4, 20], [-18, 3.1, 8], [12, 3.4, -6], [40, 3.2, -22], [70, 3.5, 10], [92, 3.8, -14]].forEach(([s, sc, a], i) => P.push([M, sc, s, alcove(s) + 63 + (i % 3) * 2.5, 33 + Math.abs(s) * 0.13, a * d, i % 2 ? -1 : 1, -4 * d, 2]));
  P.push([C, 2.6, -40, 82, 36, 6 * d, -1, 0, 2], [C, 2.6, 52, 80, 38, -7 * d, 1, 0, 2], [N, 2.6, -58, 70, 36, 14 * d, -1, 0, 2], [N, 2.6, 56, 71, 37, -15 * d, 1, 0, 2]);
  // upper wall and the peaks behind it
  [[-140, 6.2, 20, 142], [-92, 5.9, 8, 146], [-38, 5.6, -8, 152], [14, 6.0, 6, 148], [66, 5.8, -9, 146], [118, 6.2, -14, 142], [150, 6.4, -18, 146]].forEach(([s, sc, a, f], i) => P.push([M, sc, s, f, 54, a * d, i % 2 ? 1 : -1, -6 * d, 3]));
  P.push([C, 5.2, -30, 166, 58, 4 * d, 1, 0, 3]);
  [[-128, 8.4, 10, 226], [-52, 9.6, -4, 244], [26, 8.8, 5, 236], [98, 9.2, -9, 232]].forEach(([s, sc, a, f], i) => P.push([M, sc, s, f, 70, a * d, i % 2 ? -1 : 1, -8 * d, 4]));
  return P;
}

const S0 = -150, DS = 0.5, NS = 600, Y0 = -4, DY = 0.5, NY = 300;

export function createGorge(u, low, onWater, onLoad) {
  const group = new THREE.Group(), gs = { uGorgeS: { value: null }, uGorgeM: { value: new THREE.Matrix4() } }; let dead = false, meshes = [], drawn = V(), textures = [];
  const mats = [1, 2, 3].map((k) => { const uni = { ...u, ...gs, tC: { value: null }, tCN: { value: null } }; const ld = new FastLoader(() => false); ld.load(`/textures/crag${k}.webp`, (t) => { if (dead) return t.dispose(); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; uni.tC.value = t; textures.push(t); onLoad(); }); ld.load(`/textures/crag${k}_n.webp`, (t) => { if (dead) return t.dispose(); t.flipY = false; t.anisotropy = 2; uni.tCN.value = t; textures.push(t); onLoad(); });
    return new THREE.ShaderMaterial({ uniforms: uni, side: THREE.DoubleSide, vertexShader: `precision highp float; attribute float aWet; varying vec3 vW, vN; varying vec2 vU; varying float vWet; void main(){ vW = position; vN = normal; vU = uv; vWet = aWet; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }`,
      fragmentShader: GLSL + SHADOW + /* glsl */ `uniform sampler2D tC, tCN, tRock, tNoise, tGrass, tLeafy, uGorgeS; uniform mat4 uGorgeM; varying vec3 vW, vN; varying vec2 vU; varying float vWet;
        float tn(vec2 p){ return texture2D(tNoise, p * .125).r; }
        float gShadow(vec3 p){ vec4 c = uGorgeM * vec4(p, 1.); vec3 q = c.xyz / c.w * .5 + .5; if (min(min(q.x, q.y), min(1. - q.x, 1. - q.y)) < 0. || q.z > 1.) return 1.; float s = 0.; for (int i = 0; i < 8; i++) { float t = float(i) * 2.4; s += step(q.z - .0016, texture2D(uGorgeS, q.xy + vec2(cos(t), sin(t)) * sqrt(float(i) + .5) * .00042).r); } return s / 8.; }
        void main(){ vec3 G = normalize(vN), V = normalize(cameraPosition - vW); if (!gl_FrontFacing) G = -G; float dist = length(cameraPosition - vW);
          vec3 tnm = texture2D(tCN, vU).xyz * 2. - 1.; vec3 dpx = dFdx(vW), dpy = dFdy(vW); vec2 dux = dFdx(vU), duy = dFdy(vU); vec3 T = dpx * duy.y - dpy * dux.y, B = dpy * dux.x - dpx * duy.x; float il = inversesqrt(max(max(dot(T,T), dot(B,B)), 1e-14)); vec3 N = normalize(T * il * tnm.x * 1.5 + B * il * tnm.y * 1.5 + G * tnm.z);
          vec3 w = pow(abs(G), vec3(4.)); w /= w.x + w.y + w.z; vec3 p = vW * .16; vec3 dt = texture2D(tRock, p.zy).rgb * w.x + texture2D(tRock, p.xz).rgb * w.y + texture2D(tRock, p.xy).rgb * w.z; float det = dot(dt, vec3(.33));
          vec3 alb = texture2D(tC, vU).rgb; float l = dot(alb, vec3(.3,.5,.2)); alb = mix(alb, vec3(l) * vec3(1.04,1.,.95), .55); alb *= mix(1., .45 + 1.9 * det, .75);
          float big = tn(vec2(vW.z * .06 + vW.x * .04, vW.y * .05)), fine = tn(vW.zy * .55 + vW.x * .3); alb *= mix(vec3(.72,.76,.82), vec3(1.30,1.20,1.06), smoothstep(.32,.64, big)); alb *= .86;
          // dark lichen streaks below seeps, moss and turf wherever soil can sit
          float seep = smoothstep(.50,.64, tn(vec2(vW.z * .55, vW.y * .035 + 3.))) * (1. - abs(G.y)); alb *= 1. - .38 * seep;
          float up = mix(G.y, N.y, .45); float damp = clamp(vWet * 1.2 + smoothstep(30., 0., vW.y) * .35, 0., 1.);
          float moss = smoothstep(.12, .62, up + (fine - .5) * .9 + damp * .22) * smoothstep(125., 70., vW.y + big * 30.); alb = mix(alb, mix(vec3(.022,.042,.012), vec3(.062,.088,.026), smoothstep(.36,.62,fine)) * (.5 + det * 1.6), moss * .88);
          float turf = smoothstep(.62, .82, up + (fine - .5) * .25) * smoothstep(120., 80., vW.y); alb = mix(alb, mix(texture2D(tGrass, vW.xz * .05).rgb, texture2D(tLeafy, vW.xz * .13).rgb * .6, .4) * vec3(.50,.66,.36), turf * .9);
          float snow = smoothstep(128., 168., vW.y + (fine - .5) * 40. + big * 24.) * smoothstep(.22, .5, up + (fine - .5) * .3); alb = mix(alb, vec3(.66,.71,.79), snow); N = normalize(mix(N, G, snow * .6));
          float wetK = vWet * smoothstep(.25, .6, vWet + (fine - .5) * .7); alb *= 1. - .58 * wetK;
          float nl = max(dot(N, uSunDir), 0.) * smoothstep(-.05, .15, dot(G, uSunDir)), sh = gShadow(vW + G * .7) * castShadow(vW, G);
          float ao = mix(.45, 1., smoothstep(-.6, .5, G.y)) * mix(.75, 1.1, smoothstep(.25,.6,det)) * mix(.6, 1., smoothstep(-2., 9., vW.y));
          vec3 col = alb * (uSunCol * nl * sh * 1.18 + mix(uGround, uSky, N.y * .5 + .5) * .95 * ao + uSunCol * .05 * (1. - sh));
          float h = pow(max(dot(N, normalize(V + uSunDir)), 0.), mix(18., 60., wetK)); col += uSunCol * sh * h * (.02 + .34 * wetK) + uSky * wetK * .10 * pow(1. - max(dot(N, V), 0.), 3.);
          col += alb * phxLight(vW, N); vec3 fc = fogged(col, vW);
          // air in the basin: spray lifts off the pool and hangs between the tiers
          float spray = exp(-max(vW.y, 0.) * .06) * smoothstep(46., 4., abs(vW.z - ${Z.toFixed(1)})) * .06; fc = mix(fc, uSky * .5 + uSunCol * .2, spray); gl_FragColor = vec4(fc, 1.); }` }); });
  const SZ = low ? 1024 : 2048, rt = new THREE.WebGLRenderTarget(SZ, SZ, { depthTexture: new THREE.DepthTexture(SZ, SZ, THREE.UnsignedIntType) }); rt.depthTexture.minFilter = rt.depthTexture.magFilter = THREE.NearestFilter; gs.uGorgeS.value = rt.depthTexture;

  loadMeshes('/models/cliffs.bin').then((geos) => { if (dead) return; const src = geos.map((g) => ({ p: g.attributes.position.array, n: g.attributes.normal.array, u: g.attributes.uv.array, i: g.index.array }));
    const out = src.map(() => ({ p: [], u: [], w: [], i: [] })), D = [null, 1, 2, 3].map((k) => k && new Float32Array(NS * NY).fill(1e4)), a = V(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
    for (const [k, sc, s0, f0, y0, turn, mir, lean, tier] of layout()) { if (low && tier === 4 && Math.abs(s0) > 100) continue; const g = src[k], o = out[k], base = o.p.length / 3, n = g.p.length / 3; q.setFromEuler(e.set(lean, -Math.PI / 2 + turn, 0)); const sd = s0 * 0.37 + sc;
      for (let i = 0; i < n; i++) { a.set(g.p[i * 3] * sc * mir, g.p[i * 3 + 1] * sc, g.p[i * 3 + 2] * sc).applyQuaternion(q); let x = X + f0 + a.x, y = y0 + a.y, z = Z + s0 + a.z; const wf = 1.1 / sc * 0.6, am = sc * 0.42;
        // bend each copy differently so no two read as the same stone
        x += am * noise(z * wf * 0.12 + sd, y * wf * 0.12); y += am * 0.55 * noise(x * wf * 0.1 + 9, z * wf * 0.14 + sd); z += am * noise(y * wf * 0.13 + sd, x * wf * 0.1 + 4);
        // the ends of every wall curve back into the hillside, so no scan is ever seen from behind
        { const lim = [0, 78, 92, 150, 165][tier], k = smooth(lim, lim + 24, Math.abs(z - Z)); x += k * (tier < 3 ? 46 : 60); y -= k * 6; }
        const s = z - Z; let wet = 0; for (const f of FALLS) { const ds = Math.abs(s - f.s); if (f.tier === tier) { const cut = f.lip - 0.5 + Math.max(0, ds - f.w * 0.85) * 1.15 + 0.5 * noise(s * 0.6, 3); if (ds < f.w + 14 && y > cut) y = lerp(cut, y, smooth(f.w + 5, f.w + 14, ds)); if (y < f.lip + 1) wet = Math.max(wet, Math.exp(-Math.pow(Math.max(0, ds - f.w * 0.9) / (2 + f.w * 0.35), 2))); } }
        o.p.push(x, y, z); o.u.push(g.u[i * 2] / 65535, g.u[i * 2 + 1] / 65535); o.w.push(wet); }
      for (let i = 0; i < g.i.length; i += 3) { const t = [g.i[i] + base, g.i[i + (mir < 0 ? 2 : 1)] + base, g.i[i + (mir < 0 ? 1 : 2)] + base]; if (t.every((v) => Math.abs(o.p[v * 3 + 2] - Z) > [0, 106, 120, 178, 195][tier])) continue; o.i.push(...t);
        if (tier < 4) { const P = t.map((v) => [(o.p[v * 3 + 2] - Z - S0) / DS, (o.p[v * 3 + 1] - Y0) / DY, o.p[v * 3]]); raster(D[tier], P); } } }
    meshes = out.map((o, k) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(o.u, 2)); g.setAttribute('aWet', new THREE.Float32BufferAttribute(o.w, 1)); g.setIndex(o.i); weld(g); const m = new THREE.Mesh(g, mats[k]); m.renderOrder = -1; group.add(m); return m; });
    onWater(D, sample); onLoad(); geos.forEach((g) => g.dispose());
  }).catch(onLoad);

  function raster(d, P) { const [A, B, C] = P, x0 = Math.max(0, Math.ceil(Math.min(A[0], B[0], C[0]))), x1 = Math.min(NS - 1, Math.floor(Math.max(A[0], B[0], C[0]))), y0 = Math.max(0, Math.ceil(Math.min(A[1], B[1], C[1]))), y1 = Math.min(NY - 1, Math.floor(Math.max(A[1], B[1], C[1]))); const den = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1]); if (Math.abs(den) < 1e-9) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const a = ((B[1] - C[1]) * (x - C[0]) + (C[0] - B[0]) * (y - C[1])) / den, b = ((C[1] - A[1]) * (x - C[0]) + (A[0] - C[0]) * (y - C[1])) / den, c = 1 - a - b; if (a < -0.02 || b < -0.02 || c < -0.02) continue; const v = a * A[2] + b * B[2] + c * C[2], k = y * NS + x; if (v < d[k]) d[k] = v; } }
  function sample(d, s, y) { const i = Math.round((s - S0) / DS), j = Math.round((y - Y0) / DY); if (i < 0 || j < 0 || i >= NS || j >= NY) return 1e4; return d[j * NS + i]; }
  // smooth normals across texture seams
  function weld(g) { g.computeVertexNormals(); const p = g.attributes.position.array, n = g.attributes.normal.array, m = new Map(); for (let i = 0; i < p.length; i += 3) { const k = Math.round(p[i] * 40) + ',' + Math.round(p[i + 1] * 40) + ',' + Math.round(p[i + 2] * 40); let v = m.get(k); if (!v) m.set(k, v = [0, 0, 0]); v[0] += n[i]; v[1] += n[i + 1]; v[2] += n[i + 2]; } for (let i = 0; i < p.length; i += 3) { const v = m.get(Math.round(p[i] * 40) + ',' + Math.round(p[i + 1] * 40) + ',' + Math.round(p[i + 2] * 40)), l = Math.hypot(...v) || 1; n[i] = v[0] / l; n[i + 1] = v[1] / l; n[i + 2] = v[2] / l; } }

  // sunlight and shade across the whole basin, redrawn only when the sun has moved
  const cam = new THREE.OrthographicCamera(-185, 185, 170, -170, 1, 900), dm = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: 'void main(){ gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }', fragmentShader: 'void main(){ gl_FragColor = vec4(1.); }' }), sc = new THREE.Scene(); let added = false;
  group.userData.shadow = (renderer, dir) => { if (!meshes.length || drawn.distanceToSquared(dir) < 0.0006) return; drawn.copy(dir); if (!added) { added = true; meshes.forEach((m) => { const k = new THREE.Mesh(m.geometry, dm); k.frustumCulled = false; sc.add(k); }); } cam.position.set(X + 70, 55, Z).addScaledVector(dir, 420); cam.lookAt(X + 70, 55, Z); cam.updateMatrixWorld(); gs.uGorgeM.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); gs.uGorgeS.value = null; renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sc, cam); renderer.setRenderTarget(null); gs.uGorgeS.value = rt.depthTexture; };
  group.userData.stop = () => { dead = true; rt.dispose(); dm.dispose(); textures.forEach((t) => t.dispose()); };
  return group;
}
