import * as THREE from 'three';
import { GLSL, rng, FastLoader } from './common';
import { STOP_GAP } from './stops';
import { center, CONE, height } from './landscape';

// Distant ranges: 360-degree panoramas ray-marched from real elevation data (North Cascades and Grand Canyon),
// stored as normals, distance, snow, rock and horizon angles so every world's own sun lights and shades them.
const blank = new THREE.DataTexture(new Uint8Array([128, 128, 0, 0]), 1, 1); blank.needsUpdate = true;
export const ranges = { uniforms: { tP1: { value: blank }, tP2: { value: blank }, tP3: { value: blank }, tM1: { value: blank }, tM2: { value: blank }, tM3: { value: blank }, uRgA: { value: new THREE.Vector4() }, uRgB: { value: new THREE.Vector4() } },
  load(low, kick) { const L = new FastLoader(), all = []; let dead = false;
    for (const [k, n] of [['tP', 'peaks'], ['tM', 'mesas']]) for (const q of [1, 2, 3]) L.load(`/skies/${n}${low && q < 3 ? '-s' : ''}_t${q}.webp`, (t) => { if (dead) return t.dispose(); t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; ranges.uniforms[k + q].value = t; all.push(t); kick(); });
    return () => { dead = true; all.forEach((t) => t.dispose()); for (const x of ['tP', 'tM']) for (const q of [1, 2, 3]) ranges.uniforms[x + q].value = blank; }; } };
const RANGE = /* glsl */ `
uniform sampler2D tP1, tP2, tP3, tM1, tM2, tM3; uniform vec4 uRgA, uRgB;
// r.x turn, r.y height scale, r.z 1 for mesas, r.w presence
vec4 rangeOne(sampler2D t1, sampler2D t2, sampler2D t3, vec4 r, float mesa, vec3 d){
  float el = asin(clamp(d.y, -1., 1.)) * 57.29578 / r.y, az = fract(r.x - atan(d.x, d.z) * .1591549); vec2 q = vec2(az, (el + 2.) / 29.); if (q.y < .002 || q.y > .998) return vec4(0.);
  vec4 a = textureLod(t1, q, 0.); if (a.a < .01) return vec4(0.); vec3 b = textureLod(t2, q, 0.).rgb, hz = textureLod(t3, q, 0.).rgb * 1.2;
  vec3 n = vec3(a.r * 2. - 1., 0., a.g * 2. - 1.); n.y = sqrt(max(0., 1. - dot(n, n)));
  float sa = fract(r.x - atan(uSunDir.x, uSunDir.z) * .1591549), se = asin(clamp(uSunDir.y, -1., 1.)), ch = sqrt(max(0., 1. - uSunDir.y * uSunDir.y)); vec3 l = vec3(sin(sa * 6.28318) * ch, uSunDir.y, -cos(sa * 6.28318) * ch);
  float k = sa * 3., f = fract(k); int i = int(floor(k)); vec3 h3 = i == 0 ? hz : i == 1 ? hz.yzx : hz.zxy; float hor = mix(h3.x, h3.y, f);
  float lit = max(dot(n, l), 0.) * mix(.22, 1., smoothstep(-.14, .16, se - hor)), open = 1. - .5 * clamp((hz.x + hz.y + hz.z) / 2.6, 0., 1.);
  vec3 rock = mix(mix(vec3(.15,.148,.15), vec3(.25,.245,.24), b.g), mix(vec3(.22,.085,.045), vec3(.62,.33,.19), b.g), mesa);
  rock = mix(rock, mix(vec3(.035,.055,.028), vec3(.20,.17,.10), mesa), b.b * .85);
  vec3 alb = mix(rock, vec3(.82,.85,.90), b.r * (1. - uNight * .8));
  vec3 c = alb * (uSunCol * lit * .34 + (uSky * (.55 + .45 * n.y) + uGround * .15) * .62 * open);
  // air: thick over the valley floor, thinning toward the summits
  float D = mix(1200., 20500., 0.) * exp(a.b * (mesa > .5 ? 2.77 : 2.84)); float hz1 = 1. - exp(-pow(D * .00011 * (.35 + 1.3 * exp(-max(el, 0.) * .13)) * (uDen * 1000.), .75));
  vec3 hc = mix(mix(uFog, uHorizon, .35), skyAt(normalize(vec3(d.x, .10, d.z))), .45) + uSunCol * .12 * pow(max(dot(d, uSunDir), 0.), 7.);
  c = mix(c, hc, clamp(max(hz1, smoothstep(3., -1.5, el) * .9), 0., .97)); return vec4(c, a.a * r.w); }
vec3 range(vec3 c, vec3 d){ vec4 a = vec4(0.), b = vec4(0.);
  if (uPhMix < 1. && uRgA.w > 0.) a = uRgA.z > .5 ? rangeOne(tM1, tM2, tM3, uRgA, 1., d) : rangeOne(tP1, tP2, tP3, uRgA, 0., d);
  if (uPhMix > 0. && uRgB.w > 0.) b = uRgB.z > .5 ? rangeOne(tM1, tM2, tM3, uRgB, 1., d) : rangeOne(tP1, tP2, tP3, uRgB, 0., d);
  vec4 m = vec4(a.rgb * a.a, a.a) * (1. - uPhMix) + vec4(b.rgb * b.a, b.a) * uPhMix; return c * (1. - m.a * (1. - uHigh)) + m.rgb * (1. - uHigh); }
`;

export function createSky(u) {
  u = { ...u, ...ranges.uniforms };
  const m = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 32), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = (projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position,1.)).xyww; }`,
    fragmentShader: GLSL + /* glsl */ `uniform sampler2D tNoise; float tnS(vec2 p){ return textureLod(tNoise, p * .125, 0.).r; }
      varying vec3 vD;
      ${RANGE}
      float cloud(vec2 p){ float w = fbm2(p * .9 + uTime * .005); return fbm2(p * 1.5 + w * 1.5 + vec2(uTime * .010, 0.)) * .75 + fbm2(p * 5.2 + w * 2. + vec2(uTime * .02, 3.)) * .25; }
      void main(){ vec3 d = normalize(vD); vec3 c = skyAt(d); float ph = mix(uPhA.z, uPhB.z, uPhMix); float s = max(dot(d, uSunDir), 0.);
        c += (1. - uHigh) * uSunCol * mix(5., 2.2, uNight) * smoothstep(.99935, .9997, s);
        if (d.y > mix(0., -.05, uHigh)) {
          { float hiS = max(uHigh, uAurora); if (uNight + hiS > .01) {
          // stars in three sizes with their own colour and twinkle, thicker along the Milky Way
          vec3 mw = normalize(vec3(.52, .62, -.59)); float band0 = dot(d, mw); float milky = exp(-band0 * band0 * 26.); float dust = fbm3(d * 5.5 + 3.), dust2 = fbm3(d * 14.);
          float mk = milky * smoothstep(.30, .72, dust * .7 + dust2 * .35); float lane = smoothstep(.50, .62, fbm3(d * 8. + 11.)) * exp(-band0 * band0 * 160.);
          for (int k = 0; k < 3; k++){ float sc = k == 0 ? 120. : k == 1 ? 230. : 390.; vec3 q = d * sc, g = floor(q), f = fract(q) - .5; float r = hash3(g + float(k) * 19.); float th = (k == 0 ? .9945 : k == 1 ? .988 : .976) - (k == 0 ? .016 : k == 1 ? .055 : .10) * hiS - mk * .035 * hiS;
            float on = step(th, r); vec3 off = (vec3(hash3(g + 5.), hash3(g + 9.), hash3(g + 13.)) - .5) * .5; float rad = length(f - off); float tw = .72 + .28 * sin(uTime * (1.5 + r * 60. * .1) + r * 900.); vec3 tint = mix(vec3(1.,.82,.62), vec3(.68,.80,1.), hash3(g + 23.));
            float core = smoothstep(.20, .0, rad) + (k == 0 ? .35 * exp(-rad * 15.) * smoothstep(.25, .08, rad) : 0.); c += uNight * on * core * tw * tint * (k == 0 ? 1.5 : k == 1 ? 1.1 : .75) * (1. + .9 * hiS) * smoothstep(mix(.0, -.04, hiS), mix(.16, .02, hiS), d.y) * (1. - lane * .7); }
          c += uNight * hiS * (mk * mix(vec3(.16,.19,.30), vec3(.36,.28,.31), dust2) * 1.05 * (1. - lane * .8)) * smoothstep(.0, .2, d.y);
          { float tt = uTime * .13, id = floor(tt), fr = fract(tt) * 7.; if (fr < 1. && hiS > .5) { vec3 a0 = normalize(vec3(sin(id * 4.1), .35 + .3 * hash2(vec2(id, 2.)), cos(id * 2.7))), dv = normalize(vec3(cos(id * 3.3), -.45, sin(id * 1.9))); vec3 hd = normalize(a0 + dv * fr * .5); vec3 rel = d - hd; float al = dot(rel, -dv), pr = length(rel + dv * al); c += vec3(1.6,1.8,2.2) * smoothstep(.0025, .0, pr) * smoothstep(.16, .0, al) * step(0., al) * (1. - fr); } }
          } }
          if (uHigh < .99 && ph < .99) {
          vec2 p = d.xz / (max(d.y, 0.) + .16); vec2 sd = normalize(uSunDir.xz + 1e-4);
          float cl = cloud(p), lit = cloud(p + sd * .10), lit2 = cloud(p + sd * .24);
          float cov = .74 - uCloud * .42, k = (1. - uHigh) * (1. - ph) * smoothstep(cov, cov + .20, cl) * smoothstep(.0, .16, d.y);
          float thick = smoothstep(cov, cov + .42, cl), shade = exp(-max(lit - cov, 0.) * 5. - max(lit2 - cov, 0.) * 3.);
          vec3 cc = (uSky * .55 + uHorizon * .22) * mix(1., .5, thick) + uSunCol * shade * (.10 + .10 * (1. - uNight) + .45 * pow(s, 6.) * (1. - thick * .7));
          c = mix(c, cc, k * .92);
          float au = (1. - uHigh) * (1. - uAurora) * smoothstep(.35,.8,uNight) * (1. - bump(uPhx.z / -${STOP_GAP.toFixed(1)}, 5.6, .7, .4));
          float band = au <= 0. ? 0. : fbm2(vec2(p.x * 1.1 + sin(p.y + uTime * .05) * .6, uTime * .05));
          float curt = smoothstep(.14, .0, abs(band - .48)) * n2(vec2(atan(d.x, d.z) * 34., uTime * .25)) * smoothstep(.06,.28,d.y) * smoothstep(.85,.35,d.y);
          c += au * curt * mix(vec3(.05,.75,.42), vec3(.42,.15,.75), smoothstep(.2,.6,d.y)) * 1.1;
          }
        }
        if (uHigh < .9 && d.y < .5) c = range(c, d);
        if (uAurora > .01 && d.y > .015) {
          vec3 acc = vec3(0.); float jit = hash2(gl_FragCoord.xy + fract(uTime) * 61.);
          for (int i = 0; i < 20; i++) { float fi = (float(i) + jit) * .9, h = 1. + fi * .021 + fi * fi * .0011; vec2 p = d.xz * (2.1 * h / (d.y * 1.5 + .26)); p += vec2(uTime * .012, -uTime * .006);
            vec2 w = vec2(tnS(p * .55 + 2.3 + uTime * .015), tnS(p * .55 + 7.1 - uTime * .012)) - .48; vec2 q = p * vec2(.62, .36) + w * 1.5; float n = tnS(q * .62); float ridge = smoothstep(.020, .0, abs(n - .48)); float ridge2 = smoothstep(.016, .0, abs(tnS(q * .5 + 9.) - .46)) * .75;
            float rays = .12 + 1.5 * pow(tnS(vec2(p.x * 5. + w.x * 6., p.y * 5.) / h + uTime * .10), 1.8); float v = (ridge + ridge2) * rays; float t = fi / 18.;
            vec3 hue = mix(vec3(.06, 1., .45), vec3(.10,.75,.80), smoothstep(.12,.45,t)); hue = mix(hue, vec3(.55,.16,.85), smoothstep(.4,.85,t)); acc += 1.5 * hue * v * exp(-t * 2.6) * smoothstep(0., .05, t + .02); }
          c += acc * .46 * mix(.10, .40, smoothstep(.40, .60, tnS(d.xz * 1.6 / (d.y + .4) + 5.))) * uAurora * smoothstep(.015, .16, d.y);
          c += vec3(.006,.035,.022) * uAurora * exp(-d.y * 4.);
        }
        if (uHigh > .01) { float m = smoothstep(.99925, .99945, s); float cr = fbm3(d * 90.); vec3 mo = vec3(1.5,1.55,1.65) * (.72 + .5 * cr); c = mix(c, mo, m * uHigh); c += uSunCol * uHigh * (.05 * pow(s, 60.) + .22 * pow(s, 900.)); }
        // at altitude the glow of the cloud tops fades up into the night, so there is no seam
        float seam = mix(smoothstep(mix(.10, .045, ph), -.02, d.y) * mix(1., .85, ph), max(smoothstep(.014, -.010, d.y), exp(-max(d.y + .02, 0.) * 34.) * .80), uHigh);
        c = mix(c, mix(mix(uFog, uHorizon, .35) + uSunCol * .16 * pow(s, 7.), highHaze(d), uHigh), seam);
        if (uHigh > .6) { // moonlit cloud banks on the far horizon, so cloud sea and night interlock
          float az = atan(d.x, d.z); for (int k = 0; k < 3; k++) { float fk = float(k); vec2 q = vec2(az * (5.5 + fk * 3.) + fk * 17., fk * 3.1 + uTime * .004); float h = .002 - .010 * fk + .085 * (1. - fk * .22) * pow(tnS(q) * .62 + .38 * tnS(q * 3.1 + 5.), 1.7); float puff = tnS(vec2(az * 34., d.y * 60.) + fk * 9.); float e = h + (puff - .5) * .012 - d.y; float m = smoothstep(-.001, .006, e); float rim = smoothstep(.016, .0, e); vec3 hz = highHaze(d); vec3 cc = hz * mix(.80, .62, fk / 3.) + uSunCol * (.05 + .16 * rim) * (.35 + .65 * pow(max(dot(normalize(vec3(d.x, 0., d.z)), normalize(vec3(uSunDir.x, 0., uSunDir.z))), 0.), 1.5)); cc = mix(cc, hz, smoothstep(.016, -.016, d.y)); c = mix(c, cc, m * smoothstep(.6, 1., uHigh) * (1. - fk * .12)); } }
        gl_FragColor = vec4(c, 1.); }`,
  }));
  m.frustumCulled = false; m.renderOrder = 10; return m;
}

export function createMist(u, low) {
  const geo = new THREE.PlaneGeometry(1, 1), R = rng(5), g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vU; varying vec3 vW; void main(){ vU = uv; vec3 o = modelMatrix[3].xyz; vec3 r = vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
      vec2 s = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz)); vW = o + r * position.x * s.x + vec3(0.,1.,0.) * position.y * s.y; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.); }`,
    fragmentShader: GLSL + /* glsl */ `varying vec2 vU; varying vec3 vW; void main(){ vec2 q = vU * 2. - 1.; float U = -vW.z / ${STOP_GAP.toFixed(1)};
      float a = smoothstep(1., .1, length(q)) * smoothstep(.28, .8, fbm2(vU * vec2(5., 2.2) + vec2(uTime * .03 + vW.z * .01, 0.)));
      float d = length(cameraPosition - vW); a *= smoothstep(45., 130., d) * .16 * (1. - bump(U, 2.12, .55, .3) * .75);
      gl_FragColor = vec4(mix(uFog, uHorizon, .5) + uSunCol * .05, a); }` });
  const n = low ? 18 : 40;
  for (let i = 0; i < n; i++) { const z = 1100 - i * (3700 / n), m = new THREE.Mesh(geo, mat); m.position.set(center(z) + (R() - 0.5) * 90, 9 + R() * 14, z); m.scale.set(130 + R() * 110, 20 + R() * 22, 1); m.renderOrder = 2; g.add(m); }
  return g;
}

// Ash column above the volcano, lit from beneath by the crater.
export function createSmoke(u) {
  const g = new THREE.Group(), top = height(CONE.x, CONE.z) + 10, geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
    vertexShader: `varying vec2 vU; varying vec3 vW; varying float vK; void main(){ vU = uv; vec3 o = modelMatrix[3].xyz; vec3 r = normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0])); vK = length(modelMatrix[2].xyz);
      vW = o + r * position.x * length(modelMatrix[0].xyz) + vec3(0.,1.,0.) * position.y * length(modelMatrix[1].xyz); gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.); }`,
    fragmentShader: GLSL + /* glsl */ `varying vec2 vU; varying vec3 vW; varying float vK; void main(){ vec2 q = vU * 2. - 1.; float h = vU.y; vec2 p = vec2(q.x * 1.6 - h * h * 1.1, h * 3.2 - uTime * .05) * vK; p += vec2(fbm2(p * 1.3 + 4.), fbm2(p * 1.3 - uTime * .03)) * .9;
      float n = fbm2(p * 1.5), wd = mix(.13, .62, pow(h, .7)), cx = q.x - h * h * .42; float a = smoothstep(wd, wd * .25, abs(cx) + (n - .5) * .55) * smoothstep(0., .05, h) * smoothstep(1., .55, h) * smoothstep(.22, .6, n + .12);
      vec3 c = mix(vec3(.05,.045,.05), uSky * .42 + uHorizon * .08, smoothstep(.3,.75,n)); c += vec3(2.4,.5,.06) * exp(-h * 9.) * n; c += uSunCol * .09 * smoothstep(.4,.8,n) * h;
      gl_FragColor = vec4(mix(c, fogged(c, vW), .6), a * .8 * smoothstep(-1230., -1330., uPhx.z)); }` });
  for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(geo, mat); m.position.set(CONE.x, top + 92, CONE.z + i * 8); m.scale.set(190 - i * 30, 205, 1 + i * 0.35); m.renderOrder = 3; m.frustumCulled = false; g.add(m); }
  g.userData.vent = new THREE.Vector3(CONE.x, top - 6, CONE.z); return g;
}
