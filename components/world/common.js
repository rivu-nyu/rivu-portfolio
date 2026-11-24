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
  uPhxI: { value: 1 }, uAurora: { value: 0 }, uHigh: { value: 0 }, uSwirl: { value: 0 }, uEmber: { value: 0 },
  uShadow: { value: null }, uShadowM: { value: new THREE.Matrix4() },
  uHMap: { value: null }, uSunMap: { value: null }, tNoise: { value: noiseTexture() },
  tRock: { value: null }, tRockN: { value: null }, tCliff: { value: null }, tCliffN: { value: null }, tBasalt: { value: null }, tGrass: { value: null }, tSand: { value: null }, tBark: { value: null },
});

export const GLSL = /* glsl */ `
precision highp float;
uniform float uEmber; uniform float uTime, uDen, uNight, uCloud, uPhxI, uAurora, uHigh, uSwirl;
uniform vec3 uSunDir, uSunCol, uSky, uGround, uFog, uZenith, uHorizon, uPhx;
float hash2(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float hash3(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash2(i), hash2(i+vec2(1,0)), f.x), mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), f.x), f.y); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm2(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n2(p); p=mat2(1.6,1.2,-1.2,1.6)*p; a*=.5; } return s; }
float fbm3(vec3 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n3(p); p=p*2.03+7.1; a*=.5; } return s; }
float bump(float u, float c, float hw, float e){ return smoothstep(c-hw-e, c-hw, u) * (1. - smoothstep(c+hw, c+hw+e, u)); }
// one haze colour for the far cloud sea and the sky that meets it
vec3 highHaze(vec3 d){ float g = pow(max(dot(normalize(vec3(d.x, 0., d.z)), normalize(vec3(uSunDir.x, 0., uSunDir.z))), 0.), 3.); return uSky * .30 + uFog * .35 + uSunCol * (.035 + .07 * g) + vec3(.004,.030,.022) * uAurora + vec3(.30,.075,.02) * uEmber; }
vec3 skyGrad(vec3 d){
  float h = max(d.y, 0.);
  vec3 c = mix(uHorizon, uZenith, 1. - exp(-h * 4.2));
  float s = max(dot(d, uSunDir), 0.);
  c += uSunCol * (.10 * pow(s, 6.) + .22 * pow(s, 48.)) * (1. - .92 * uHigh);
  return c;
}
vec3 fogged(vec3 c, vec3 wp){
  vec3 v = wp - cameraPosition; float d = length(v); v /= d;
  float hf = exp(-max(wp.y, 0.) * .0055);
  float f = 1. - exp(-pow(d * uDen * (.45 + .75 * hf), 1.3));
  vec3 fc = mix(uFog, uHorizon, .35) + uSunCol * .16 * pow(max(dot(v, uSunDir), 0.), 7.);
  fc = mix(fc, highHaze(v), uHigh);
  return mix(c, fc, clamp(f, 0., 1.));
}
vec3 phxLight(vec3 wp, vec3 n){
  vec3 l = uPhx - wp; float d2 = dot(l, l); 
  return vec3(1., .36, .08) * uPhxI * 260. / (d2 + 160.) * (.35 + .65 * max(dot(n, normalize(l)), 0.));
}
`;

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
export const lerp = (a, b, t) => a + (b - a) * t;
export const bump = (u, c, hw, e) => smooth(c - hw - e, c - hw, u) * (1 - smooth(c + hw, c + hw + e, u));
export function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
