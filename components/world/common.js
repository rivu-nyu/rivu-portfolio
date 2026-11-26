import * as THREE from 'three';

// Uniforms shared (by reference) by every material, so one update moves the whole atmosphere.
export const shared = () => ({
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color() },
  uSky: { value: new THREE.Color() },
  uGround: { value: new THREE.Color() },
  uFog: { value: new THREE.Color() },
  uDen: { value: 0.002 },
  uZenith: { value: new THREE.Color() },
  uHorizon: { value: new THREE.Color() },
  uNight: { value: 0 },
  uCloud: { value: 0.5 },
  uPhx: { value: new THREE.Vector3() },
  uPhxI: { value: 1 }, uAurora: { value: 0 }, uHigh: { value: 0 }, uSwirl: { value: 0 }, uBurn: { value: new THREE.Vector4() }, uBurnO: { value: new THREE.Vector3() }, uSea: { value: 0 }, uSeaL: { value: 0 }, uEmber: { value: 0 },
  uShadow: { value: null }, uShadowM: { value: new THREE.Matrix4() },
  uHMap: { value: null }, uSunMap: { value: null }, tNoise: { value: noiseTexture() }, tVal: { value: valueTexture() },
  tSkyA: { value: null }, tSkyB: { value: null }, uPhA: { value: new THREE.Vector4(0, 1, 0, 0) }, uPhB: { value: new THREE.Vector4(0, 1, 0, 0) }, uPhTA: { value: new THREE.Vector3(1, 1, 1) }, uPhTB: { value: new THREE.Vector3(1, 1, 1) }, uPhMix: { value: 0 },
  tRock: { value: null }, tRockN: { value: null }, tCliff: { value: null }, tCliffN: { value: null }, tBasalt: { value: null }, tGrass: { value: null }, tSand: { value: null }, tBark: { value: null }, tLeafy: { value: null }, tForest: { value: null }, tForestN: { value: null }, tBoulder: { value: null }, tBoulderN: { value: null }, tCastle: { value: null }, tCastleN: { value: null }, tSlate: { value: null }, tAer: { value: null }, tPeb: { value: null }, tMead: { value: null }, tLime: { value: null }, tLimeN: { value: null }, tCliffSkin: { value: null }, tCliffSkinN: { value: null }, tCrackN: { value: null }, tCoral: { value: null }, tCoralN: { value: null }, uCut: { value: 0 }, uFrost: { value: 0 }, uMound: { value: new THREE.Vector4(0, 0, 0, 9) }, uDay: { value: new THREE.Color() }, uSplash: { value: new THREE.Vector4(0, 0, -99, 1) },
});

export const GLSL = /* glsl */ `
precision highp float;
uniform float uEmber, uSea, uSeaL; uniform float uTime, uDen, uNight, uCloud, uPhxI, uAurora, uHigh, uSwirl;
uniform vec3 uSunDir, uSunCol, uSky, uGround, uFog, uZenith, uHorizon, uPhx;
float hash2(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float hash3(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
uniform highp sampler2D tVal;
// value noise from one texture fetch; the second channel holds the next z slice for the 3D version
float n2(vec2 p){ vec2 i = floor(p), f = p - i; f = f*f*(3.-2.*f); return textureLod(tVal, (i + f + .5) / 256., 0.).r; }
float n3(vec3 p){ vec3 i = floor(p), f = p - i; f = f*f*(3.-2.*f); vec2 v = textureLod(tVal, (i.xy + vec2(37., 17.) * i.z + f.xy + .5) / 256., 0.).rg; return mix(v.r, v.g, f.z); }
float fbm2(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n2(p); p=mat2(1.6,1.2,-1.2,1.6)*p; a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n3(p); p=p*2.03+7.1; a*=.5; } return s; }
float bump(float u, float c, float hw, float e){ return smoothstep(c-hw-e, c-hw, u) * (1. - smoothstep(c+hw, c+hw+e, u)); }
// one haze colour for the far cloud sea and the sky that meets it
vec3 highHaze(vec3 d){ float g = pow(max(dot(normalize(vec3(d.x, 0., d.z)), normalize(vec3(uSunDir.x, 0., uSunDir.z))), 0.), 3.); return uSky * .30 + uFog * .35 + uSunCol * (.035 + .07 * g) + vec3(.004,.030,.022) * uAurora + vec3(.30,.075,.02) * uEmber; }
uniform float uCut, uFrost; bool cut(vec3 p, float z){ return uFrost > .5 && (p.z < -1336. || length(p.xz - vec2(210.1, -1400.)) < 222. && p.x - 55. * sin(p.z * .0045) - 24. * sin(p.z * .011 + 1.3) > 100.) || uCut > .5 && p.z < z && abs(p.x - 55. * sin(p.z * .0045) - 24. * sin(p.z * .011 + 1.3)) < 64.; }
vec3 skyGrad(vec3 d){
  float h = max(d.y, 0.);
  vec3 c = mix(uHorizon, uZenith, 1. - exp(-h * 4.2));
  float s = max(dot(d, uSunDir), 0.);
  c += uSunCol * (.10 * pow(s, 6.) + .22 * pow(s, 48.)) * (1. - .92 * uHigh);
  return c;
}
// photographed skies: one for the world being left, one for the world ahead (x: turn, y: sun height warp, z: presence)
uniform sampler2D tSkyA, tSkyB; uniform vec4 uPhA, uPhB; uniform vec3 uPhTA, uPhTB; uniform float uPhMix;
vec3 photo(sampler2D t, vec4 p, vec3 tint, vec3 d){ float el = asin(clamp(d.y, .002, 1.)) * .6366198; el = pow(el, p.y); vec3 c = textureLod(t, vec2(fract(p.x - atan(d.x, d.z) * .1591549), el), 0.).rgb; c *= c; c /= max(1.004 - c, .02); float L = dot(c, vec3(.3,.5,.2)); return c * (L > .7 ? (.7 + .9 * (1. - exp(-(L - .7) * .9))) / L : 1.) * tint; }
vec3 skyAt(vec3 d){ vec3 g = skyGrad(d), a = g, b = g; if (uPhMix < 1. && uPhA.z > 0.) a = mix(g, photo(tSkyA, uPhA, uPhTA, d), uPhA.z); if (uPhMix > 0. && uPhB.z > 0.) b = mix(g, photo(tSkyB, uPhB, uPhTB, d), uPhB.z); return mix(a, b, uPhMix); }
// under water: reds go first, then greens; the water itself glows with the light above it
vec3 seaFog(vec3 c, vec3 wp){ vec3 v = wp - cameraPosition; float d = length(v); v /= d; vec3 ext = exp(-d * vec3(.024,.0095,.0075)); float dp = exp(cameraPosition.y * .030); vec3 day = mix(vec3(.003,.036,.092), vec3(.08,.37,.56), smoothstep(-.6, .95, v.y)) * dp; vec3 night = vec3(.002,.012,.030) + vec3(.004,.05,.12) * smoothstep(-.2, 1., v.y); return c * ext + mix(night, day, uSeaL) * (1. - exp(-d * .017)); }
vec3 fogged(vec3 c, vec3 wp){
  if (uSea > .5) return seaFog(c, wp);
  vec3 v = wp - cameraPosition; float d = length(v); v /= d;
  float hf = exp(-max(wp.y, 0.) * .0055);
  float f = 1. - exp(-pow(d * uDen * (.45 + .75 * hf), 1.3));
  vec3 fc = mix(uFog, uHorizon, .35) + uSunCol * .16 * pow(max(dot(v, uSunDir), 0.), 7.);
  fc = mix(fc, highHaze(v), uHigh);
  return mix(c, fc, clamp(f, 0., 1.));
}
// glacier ice at the cave's threshold: day soaks through it, deepening from white to blue to black with distance inside
uniform vec3 uDay;
vec3 glacier(vec3 p, vec3 N, vec3 G, float ao, float dep, out float spec){ vec3 v = normalize(p - cameraPosition); float thin = exp(-max(dep, 0.) * .030), ndv = max(dot(N, -v), 0.); vec3 r = refract(v, N, .76);
  // clear blue ice: the light is carried in its thickness, so cups glow at their rims and go deep at their hearts
  float thick = 0.; vec3 acc = vec3(0.); for (int i = 0; i < 3; i++) { vec3 q = p + r * (.4 + 1.5 * float(i)); float cl = n3(q * vec3(.34,.22,.34)) * .6 + n3(q * vec3(1.1,.7,1.1) + 5.) * .3 + n3(q * 3.1) * .1; thick += cl; float bub = smoothstep(.74, .92, n3(q * vec3(5.5,2.6,5.5))) * smoothstep(.45,.7, n3(q * .5 + 9.)); acc += vec3(.70,.84,.93) * bub * (.16 - .04 * float(i)); } thick /= 3.; float band = smoothstep(.55,.80, n2(vec2(p.y * .42 + p.x * .06 + 1.6 * n3(p * .10), 3.))) ; float silt = smoothstep(.70,.84, n2(vec2(p.y * .9 + p.z * .05 + 1.2 * n3(p * .13), 17.)));
  float rim = smoothstep(.30,.95, ao); vec3 body = exp(-vec3(2.6, 1.05, .52) * (1.55 - .95 * rim + 1.1 * (thick - .5) * 2. + .5 * band)); body = mix(body, body * vec3(.30,.27,.24), silt * .75); spec = .4 + .6 * n3(p * 2.1); vec3 lightIn = uDay * (thin * (.65 + .55 * rim) * (1. + .30 * max(-N.y, 0.)) + .03); vec3 c = (body * 1.05 + acc * .8) * lightIn * 1.5; vec3 rf = reflect(v, N); c += uDay * (.03 + .97 * pow(1. - ndv, 5.)) * mix(vec3(.015,.05,.09), vec3(.75,.88,1.), smoothstep(-.1, .9, rf.z)) * thin * .8; c += uDay * thin * pow(max(rf.z, 0.), 24.) * .8; float frost = smoothstep(.40,.75, N.y) * smoothstep(.42,.6, n3(p * .6)) * thin; return mix(c, vec3(.62,.72,.82) * uDay * .6, frost * .8); }
vec3 phxLight(vec3 wp, vec3 n){
  vec3 l = uPhx - wp; float d2 = dot(l, l); 
  return vec3(1., .36, .08) * uPhxI * 260. / (d2 + 160.) * (.35 + .65 * max(dot(n, normalize(l)), 0.));
}
`;

function valueTexture() {
  const N = 256, d = new Uint16Array(N * N * 4), r = rng(9241), v = Float32Array.from({ length: N * N }, () => r()), H = THREE.DataUtils.toHalfFloat;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = (y * N + x) * 4; d[k] = H(v[y * N + x]); d[k + 1] = H(v[((y + 17) % N) * N + (x + 37) % N]); d[k + 3] = H(1); }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.HalfFloatType); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

// Tileable fractal noise, baked once so ground shading costs a texture fetch instead of dozens of hashes.
function noiseTexture() {
  const N = 256, d = new Uint16Array(N * N * 4), r = rng(4242), lat = [...Array(4)].map(() => Float32Array.from({ length: 128 * 128 }, () => r()));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let c = 0; c < 4; c++) {
    let s = 0, a = 0.5;
    for (let o = 0, p = 8; o < 5; o++, p *= 2) { const fx = x / N * p, fy = y / N * p, X = Math.floor(fx), Y = Math.floor(fy), u = smooth(0, 1, fx - X), v = smooth(0, 1, fy - Y), L = (i, j) => lat[c][((j % p) * 128 + (i % p) + o * 17) % 16384];
      s += a * lerp(lerp(L(X, Y), L(X + 1, Y), u), lerp(L(X, Y + 1), L(X + 1, Y + 1), u), v); a *= 0.5; }
    d[(y * N + x) * 4 + c] = THREE.DataUtils.toHalfFloat(s);
  }
  const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.HalfFloatType); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true; return t;
}

// Contact-scale shadows (bird, trees, rocks) from the shadow map.
export const SHADOW = /* glsl */ `
uniform sampler2D uShadow; uniform mat4 uShadowM;
float castShadow(vec3 wp, vec3 n){
  vec4 c = uShadowM * vec4(wp + n * .12, 1.); vec3 p = c.xyz / c.w * .5 + .5;
  vec2 e = min(p.xy, 1. - p.xy); float fade = smoothstep(0., .08, min(e.x, e.y)); if (fade <= 0. || p.z > 1.) return 1.;
  float a = hash2(gl_FragCoord.xy) * 6.28, s = 0.; mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
  for (int i = 0; i < 6; i++){ float r = sqrt((float(i) + .5) / 6.), t = float(i) * 2.4; s += step(p.z - .0012, texture2D(uShadow, p.xy + R * vec2(cos(t), sin(t)) * r * .0013).r); }
  return mix(1., s / 6., fade);
}`;
// Vertex-side lookups into the terrain height map, including mountain-scale sun shadows.
export const HMAP = /* glsl */ `
uniform sampler2D uHMap;
float vcenter(float z){ return 55. * sin(z * .0045) + 24. * sin(z * .011 + 1.3); }
float hAt(vec2 xz){ float o = xz.x - vcenter(xz.y); float s = (-90. + sqrt(8100. + 2240. * abs(o))) / 1120.;
  return texture2D(uHMap, vec2(sign(o) * s * .5 + .5, (1320. - xz.y) / 4300.)).r; }
uniform sampler2D uSunMap;
float sunVis(vec3 p, vec3 sun){ if (p.y > 300.) return 1.; float o = p.x - vcenter(p.z); float s = (-90. + sqrt(8100. + 2240. * abs(o))) / 1120.;
  return texture2D(uSunMap, vec2(sign(o) * s * .5 + .5, (1320. - p.z) / 4300.)).r; }
float marchSun(vec3 p, vec3 sun){ float v = 1., t = 5.; p.y += 1.5;
  for (int i = 0; i < 18; i++){ vec3 q = p + sun * t; if (q.y > 330.) break; v = min(v, .5 + 7. * (q.y - hAt(q.xz)) / t); t *= 1.32; if (v <= 0.) break; }
  return smoothstep(0., 1., v); }`;

// Seeded 2D gradient noise, used for building terrain on the CPU.
const perm = new Uint8Array(512);
{ let s = 1337; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
const G = [...Array(16)].map((_, i) => [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
export function noise(x, y) {
  const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y;
  const g = (i, j) => { const v = G[perm[perm[(X + i) & 255] + ((Y + j) & 255)] & 15]; return v[0] * (fx - i) + v[1] * (fy - j); };
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = g(0, 0) + u * (g(1, 0) - g(0, 0)), b = g(0, 1) + u * (g(1, 1) - g(0, 1));
  return (a + v * (b - a)) * 1.5;
}
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Images are decoded off the main thread, already oriented, so handing them to the GPU is a plain copy. Uploads then
// wait in a queue and go up one per frame, never several at once in the middle of a flight.
export const uploads = [];
export class FastLoader { constructor(flip = () => true) { this.flip = flip; }
  load(url, onLoad, _p, onError) { const t = new THREE.Texture(); t.flipY = false;
    if (typeof createImageBitmap !== 'function') { new THREE.TextureLoader().load(url, (x) => { if (!this.flip(url)) x.flipY = false; onLoad?.(x); }, undefined, onError); return t; }
    fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.blob(); }).then((b) => createImageBitmap(b, { imageOrientation: this.flip(url) ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
      .then((bm) => { t.name = url; if (typeof window !== 'undefined' && window.__texlog) window.__texlog.push([url, bm.width, bm.height, Math.round(performance.now())]); t.image = bm; t.needsUpdate = true; const d = t.dispose.bind(t); t.dispose = () => { d(); bm.close?.(); }; uploads.push(t); onLoad?.(t); }).catch((e) => onError?.(e)); return t; } }
// Big opaque photographs (the skies) are decoded to raw pixels on a worker: a raw upload costs a few milliseconds,
// where handing the GPU a picture can hold a frame for a tenth of a second.
let decoder = null, dq = 0; const waiting = new Map();
export function decodeRGBA(url) { if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return Promise.reject(new Error('no worker'));
  if (!decoder) { const src = `onmessage = async (e) => { const { id, url } = e.data; try { const b = await (await fetch(url)).blob(); const bm = await createImageBitmap(b, { imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); const c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, bm.width, bm.height).data; postMessage({ id, w: bm.width, h: bm.height, buf: d.buffer }, [d.buffer]); bm.close(); } catch (err) { postMessage({ id, err: String(err) }); } };`;
    decoder = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); decoder.onmessage = (e) => { const w = waiting.get(e.data.id); waiting.delete(e.data.id); if (!w) return; if (e.data.err) w[1](new Error(e.data.err)); else w[0]({ w: e.data.w, h: e.data.h, data: new Uint8Array(e.data.buf) }); }; }
  const id = ++dq; return new Promise((ok, no) => { waiting.set(id, [ok, no]); decoder.postMessage({ id, url: new URL(url, location.href).href }); }); }
export const lerp = (a, b, t) => a + (b - a) * t;
export const bump = (u, c, hw, e) => smooth(c - hw - e, c - hw, u) * (1 - smooth(c + hw, c + hw + e, u));
export function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
