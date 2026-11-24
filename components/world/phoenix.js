import * as THREE from 'three';
import { GLSL, SHADOW, rng, lerp, smooth } from './common';

// Forward is +Z, up is +Y. Every feather is its own card; wings, neck and tail are posed in the vertex shader.
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PIVOT = V(0, 0.2, 0.95);
const WS = [1.2, 1.12, 1.18]; // wing scale

const POSE = /* glsl */ `
uniform float uPhase, uAmp, uNeck, uNeckYaw, uTail, uFold, uLift;
mat3 rx(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 ry(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
float wa(float s){ return mix(.10 + uLift + uAmp * .62 * sin(uPhase) + s * (.155 * uAmp * sin(uPhase - 1.25) + .018 - uLift * .075), -1.22, uFold); }
vec3 armFold(float x){ vec3 e = vec3(.12,-.02,-.95), w = vec3(.2,.06,.25), h = vec3(.3,.02,-.5);
  return x < 1.35 ? mix(vec3(0.), e, x / 1.35) : x < 2.75 ? mix(e, w, (x - 1.35) / 1.4) : mix(w, h, (x - 2.75) / 1.); }
// root: where the feather meets the arm; fan: its spread angle, closed as the wing folds
vec3 wing(vec3 p, vec4 root){
  vec3 d = p - root.xyz; float a = root.w * uFold, ca = cos(a), sa = sin(a);
  d = vec3(ca * d.x + sa * d.z, d.y, -sa * d.x + ca * d.z); d.x *= mix(1., .8, uFold);
  vec3 ro = mix(root.xyz, armFold(clamp(root.x, 0., 3.75)) + vec3(0., root.y, 0.), uFold);
  p = ro + d;
  float ds = p.x / 8.; vec2 c = vec2(0.);
  for (int i = 0; i < 8; i++){ float t = wa((float(i) + .5) * ds); c += ds * vec2(cos(t), sin(t)); }
  float t = wa(p.x); float up = max(cos(uPhase), 0.) * uAmp;
  p.z -= up * smoothstep(1.6, 6., p.x) * p.x * .16;
  vec3 q = vec3(c.x - sin(t) * p.y, c.y + cos(t) * p.y, p.z);
  return q + uFold * vec3(.17, .16, -.06);
}
vec3 neck(vec3 p){
  float k = smoothstep(.75, 1.9, p.z); vec3 o = vec3(${PIVOT.x.toFixed(2)},${PIVOT.y.toFixed(2)},${PIVOT.z.toFixed(2)});
  return o + ry(uNeckYaw * k) * rx(uNeck * k) * (p - o);
}
vec3 tail(vec3 p, float v, float seed){
  float k = v * v;
  p.y += (sin(uTime * 1.9 - v * 3.4 + seed * 3.) * .42 + sin(uPhase - v * 3.) * .28) * k - uTail * k * 3.4;
  p.x += sin(uTime * 1.6 - v * 3.1 + seed * 6.28) * .45 * k;
  p.z += uTail * k * 1.6;
  return p;
}`;

class Feathers {
  constructor() { this.p = []; this.n = []; this.f = []; this.t = []; this.r = []; this.i = []; }
  // f: u, v, tone, seed   t: len, kind
  add(root, dir, up, len, width, tone, seed, { curve = 0, segs = 7, asym = 0, curl = 0, sway = 0, hot = 0 } = {}) {
    dir = dir.clone().normalize(); up = up.clone().addScaledVector(dir, -up.dot(dir)).normalize();
    const side = new THREE.Vector3().crossVectors(dir, up), b = this.p.length / 3, c = root.clone(), d = dir.clone(), U = up.clone(), packed = Math.floor(hot * 10) * 2 + Math.min(0.999, Math.max(0, tone));
    for (let j = 0; j <= segs; j++) { const v = j / segs;
      if (j) { const t0 = Math.max(0, v - 0.42) / 0.58, a = curl * t0 * 2 / segs * 1.0, y = sway * Math.sin(v * 5) / segs; d.applyAxisAngle(side, a); U.applyAxisAngle(side, a); d.addScaledVector(side, y).normalize(); c.addScaledVector(d, len / segs); }
      for (let k = 0; k < 3; k++) { const u = k - 1, q = c.clone().addScaledVector(U, curve * len * v * v - Math.abs(u) * width * 0.16).addScaledVector(side, width * u);
        this.p.push(q.x, q.y, q.z); const n = U.clone().addScaledVector(side, u * 0.35).normalize(); this.n.push(n.x, n.y, n.z);
        this.f.push(u, v, packed, seed); this.t.push(len, asym); this.r.push(root.x, root.y, root.z, Math.atan2(dir.x, -dir.z)); } }
    for (let j = 0; j < segs; j++) for (let k = 0; k < 2; k++) { const q = b + j * 3 + k; this.i.push(q, q + 1, q + 3, q + 1, q + 4, q + 3); }
  }
  build() { const g = new THREE.BufferGeometry(), a = (n, d, s) => g.setAttribute(n, new THREE.Float32BufferAttribute(d, s));
    a('position', this.p, 3); a('normal', this.n, 3); a('aF', this.f, 4); a('aT', this.t, 2); a('aRoot', this.r, 4); g.setIndex(this.i); return g; }
}

const LIGHT = /* glsl */ `
vec3 heatRamp(float h){ return mix(mix(vec3(.9,.06,.008), vec3(1.5,.42,.04), smoothstep(0.,.55,h)), vec3(2.4,1.35,.4), smoothstep(.5,1.,h)); }`;

function featherMaterial(u, pose, kind, depth = false) {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...u, ...pose }, side: THREE.DoubleSide, defines: depth ? { [kind]: 1, DEPTHPASS: 1 } : { [kind]: 1 },
    vertexShader: `uniform float uTime; attribute vec4 aF, aRoot; attribute vec2 aT; varying vec4 vF; varying vec2 vT; varying vec3 vW, vN; ${POSE}
      void main(){ vec3 p = position; vec3 n = normal;
        #ifdef WING
          p.y += sin(uTime * 9. + aF.w * 40.) * .012 * aF.y * aF.y * aT.x; vec3 q = wing(p, aRoot); float t = wa(mix(p.x, .2, uFold));
          n = vec3(n.x*cos(t)-n.y*sin(t), n.x*sin(t)+n.y*cos(t), n.z); p = q;
        #endif
        #ifdef BODY
          { float cr = smoothstep(.55, .8, aT.x) * aF.y * aF.y; p.y += sin(uTime * 3.1 + aF.w * 30. - aF.y * 3.) * .07 * cr; p.x += sin(uTime * 2.3 + aF.w * 50. - aF.y * 3.) * .06 * cr; } p = neck(p); float k = smoothstep(.75,2.,position.z); n = ry(uNeckYaw*k) * rx(uNeck*k) * n;
        #endif
        #ifdef TAIL
          p = tail(p, aF.y * clamp(aT.x / 6., .12, 1.), aF.w);
        #endif
        vF = aF; vT = aT; vec4 w = modelMatrix * vec4(p, 1.); vW = w.xyz; vN = mat3(modelMatrix) * n; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: GLSL + SHADOW + LIGHT + /* glsl */ `varying vec4 vF; varying vec2 vT; varying vec3 vW, vN; uniform float uHeat;
      void main(){
        float u = vF.x, v = vF.y, hot = floor(vF.z * .5 + .001) * .1, tone = vF.z - hot * 20., seed = vF.w, au = abs(u);
        // aT.y: 0..1 flight-feather asymmetry, <0 pointed hackle, >1.5 loose plume
        float lance = step(vT.y, -.5), plume = step(1.5, vT.y), len = vT.x;
        float prof = smoothstep(-.02, .16, v) * pow(max(1. - pow(v, 4.5), 0.), .55);
        prof = mix(prof, smoothstep(-.02,.22,v) * pow(max(1. - v, 0.), .62) * 1.25, lance);
        prof *= mix(1., u > 0. ? .62 : 1., clamp(vT.y, 0., 1.));
        float ph = (v * len * 1.0 - au * mix(.28, .5, plume) ), fw = fwidth(ph) + 1e-4;
        float strand = .5 + .5 * sin(ph * mix(210., 120., plume) + seed * 40. + sin(v * 30. + seed * 9.) * plume);
        float barbN = n2(vec2(v * 26. * max(len, .4) - au * 5., seed * 91. + sign(u) * 3.));
        float split = smoothstep(.80, .98, n2(vec2(v * 7. * max(len,.5) - au * 1.6, seed * 37. + sign(u) * 9.)));
        prof *= 1. - barbN * mix(.16, .3, plume) - split * .38 * smoothstep(.2, .8, au);
        // plumes: narrow near the body, swelling to a soft ragged fan
        prof *= mix(1., (.40 + .60 * smoothstep(.05, .5, v)) * (1. - .25 * smoothstep(.75, 1., v)), plume);
        float fl = n3(vec3(u * 2.5 + seed * 20., v * 4.5 - uTime * 2.4, uTime * .8 + seed * 9.));
        prof -= smoothstep(.72, 1., v) * fl * .5 * step(.9, len);
        // loose barbs open into gaps toward the margin
        float gap = plume * .7 * smoothstep(.35, 1., au) * smoothstep(.03, .004, fw);
        float cov = (prof - au) / max(fwidth(au) * 1.2, 1e-3) + .5;
        cov = min(cov, mix(1.5, (strand - gap * .62) / max(fwidth(strand), .08) + .5, gap));
        if (au < .035 + .01 * plume && v < .97) cov = 1.;
        if (cov < .06) discard; cov = clamp(cov, 0., 1.);
        #ifdef DEPTHPASS
          gl_FragColor = vec4(1.); return;
        #endif
        vec3 V = normalize(cameraPosition - vW), N = normalize(vN); if (dot(N, V) < 0.) N = -N;
        float barb = mix(strand, .5, smoothstep(.004, .022, fw * mix(1., .3, plume)));
        vec3 maroon = vec3(.040,.006,.008), crimson = vec3(.17,.014,.012), scarlet = vec3(.46,.050,.014), orange = vec3(.86,.22,.035), gold = vec3(.98,.50,.12);
        float g = clamp(tone + (v - .45) * .46 + (hash2(vec2(seed*77., 1.)) - .5) * .12, 0., 1.) * 4.;
        vec3 alb = g < 1. ? mix(maroon, crimson, g) : g < 2. ? mix(crimson, scarlet, g - 1.) : g < 3. ? mix(scarlet, orange, g - 2.) : mix(orange, gold, g - 3.);
        float edge = smoothstep(.34, 0., prof - au) * smoothstep(.15, .5, v);
        #ifdef WING
          alb *= mix(1., .38, step(1.3, len) * .55 * smoothstep(.55, .05, v));
        #endif
        alb *= .62 + .6 * barb; alb *= mix(.34, 1., smoothstep(0., .45, v));
        // each feather is rimmed in gold, so the plumage reads as layered scales of fire
        float rim = max(edge, smoothstep(.72, .98, v)) * (1. - plume) * smoothstep(.75, .15, tone);
        alb = mix(alb, mix(scarlet, gold, clamp(tone * 1.6 + .25, 0., 1.)), rim * .62);
        float rach = smoothstep(.06, .02, au) * (1. - v * .7) * step(.9, len); alb = mix(alb, vec3(.80,.30,.06), rach * .55);
        float nl = dot(N, uSunDir), wrap = max(nl * .7 + .3, 0.);
        float trans = pow(max(dot(-V, uSunDir), 0.), 3.) * .8 + max(-nl, 0.) * .35;
        float cs = 1.;
        #ifndef WING
          cs = mix(1., castShadow(vW, N * 2.), .7);
        #endif
        vec3 col = alb * (uSunCol * cs * wrap * .85 + mix(uGround, uSky, N.y * .5 + .5) * .7);
        col += alb * (alb + .06) * uSunCol * trans * .75;
        vec3 Hh = normalize(V + uSunDir); col += uSunCol * pow(max(dot(N, Hh), 0.), 26.) * .10 * (.4 + barb) ;
        float fres = pow(1. - max(dot(N, V), 0.), 3.); col += alb * fres * vec3(1.2,.5,.2) * .6; col += (uSky * .5 + uSunCol * .12) * vec3(.55,.10,.42) * fres * .16 * (1. - tone);
        // living embers: heat creeps in from feather tips and vane edges
        float ember = smoothstep(.72, 1.12, v + fl * .3) * step(.9, vT.x) + edge * .12 * smoothstep(.4,.9,fl) * step(.9, vT.x);
        #ifdef TAIL
          ember = max(ember * 1.1, smoothstep(.3, 1., v) * (.10 + fl * .5) * step(2.5, len) * (.45 + .55 * strand)); 
        #endif
        col += heatRamp(clamp(ember * (.3 + fl * .8), 0., 1.)) * ember * (.26 + .4 * uHeat);
        #ifdef WING
          // light leaking between the layers of the wing, and glassy glowing outer vanes
          float seam = step(1.2, len) * smoothstep(.30, .12, abs(v - .34)) * smoothstep(.45, .8, fl + .18) ; col += heatRamp(.30 + fl * .45) * seam * .16 * (.6 + .6 * uHeat);
          col += alb * step(1.9, len) * smoothstep(.45, 1., v) * vec3(1.15,.42,.12) * (.22 + .28 * strand);
        #endif
        #ifdef TAIL
          col += alb * plume * smoothstep(.1, .9, v) * vec3(1.15,.45,.15) * (.28 + .38 * strand);
        #endif
        // molten breast: scales lit from inside, brightest along their rims
        float mol = hot * (.32 + 1.15 * max(edge, smoothstep(.55,.95,v)) + .75 * smoothstep(.35,.85,fl)) * (.82 + .18 * sin(uTime * 2.1 + seed * 20.));
        col += heatRamp(clamp(.12 + hot * .26 + fl * .38 + edge * .22, 0., 1.)) * mol * (.34 + .35 * uHeat);
        col += alb * (.03 + .10 * uHeat + .10 * uNight);
        gl_FragColor = vec4(fogged(col, vW), cov); }`,
  });
  m.alphaToCoverage = !depth; return m;
}

function skinMaterial(u, pose, color, { gloss = 0.1, emit = 0, bend = false, tip = color, z = [0, 1] } = {}) {
  return new THREE.ShaderMaterial({ uniforms: { ...u, ...pose, uC: { value: new THREE.Color(color) }, uC2: { value: new THREE.Color(tip) }, uZ: { value: new THREE.Vector2(...z) }, uG: { value: gloss }, uE: { value: emit } }, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime; uniform vec2 uZ; varying float vZ; varying vec3 vW, vN; ${POSE} void main(){ vec3 p = position; vZ = smoothstep(uZ.x, uZ.y, p.z); ${bend ? 'p = neck(p);' : ''} vec4 w = modelMatrix * vec4(p,1.); vW = w.xyz; vN = mat3(modelMatrix) * normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: GLSL + `varying float vZ; varying vec3 vW, vN; uniform vec3 uC, uC2; uniform float uG, uE; void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW); if (dot(N,V) < 0.) N = -N;
      vec3 c = mix(uC, uC2, vZ) * (.8 + .3 * n3(vW * 30.)) * (uSunCol * max(dot(N,uSunDir)*.8+.2,0.) + mix(uGround,uSky,N.y*.5+.5) * .8 + vec3(.5,.18,.05));
      c += (uSunCol * .6 + .5) * uG * pow(max(dot(N, normalize(V+uSunDir)),0.), 40.) + uC * uE; gl_FragColor = vec4(fogged(c, vW), 1.); }` });
}

// Elliptical loft through [x,y,z,rx,ry] rings.
function loft(rings, n = 16, sub = 6) {
  const curve = new THREE.CatmullRomCurve3(rings.map((r) => V(r[0], r[1], r[2]))), rc = new THREE.CatmullRomCurve3(rings.map((r) => V(r[3], r[4], 0)));
  const L = (rings.length - 1) * sub, p = [], idx = [];
  for (let j = 0; j <= L; j++) { const t = j / L, c = curve.getPoint(t), r = rc.getPoint(t), T = curve.getTangent(t), up = V(1, 0, 0).cross(T).normalize().negate();
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; p.push(c.x + Math.cos(a) * Math.max(r.x, 0.001), c.y + up.y * Math.sin(a) * Math.max(r.y, 0.001), c.z + up.z * Math.sin(a) * Math.max(r.y, 0.001));
      if (j < L && i < n) { const k = j * (n + 1) + i; idx.push(k, k + 1, k + n + 1, k + 1, k + n + 2, k + n + 1); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

const SPINE = [[0, -1.6, 0.14], [0.04, -1.1, 0.38], [0.02, -0.4, 0.62], [0.0, 0.3, 0.73], [0.1, 0.85, 0.67], [0.3, 1.25, 0.5], [0.5, 1.56, 0.375], [0.66, 1.83, 0.305], [0.75, 2.06, 0.285], [0.74, 2.26, 0.235], [0.69, 2.4, 0.15]];

export function createPhoenix(u) {
  const R = rng(99), group = new THREE.Group();
  const pose = { uPhase: { value: 0 }, uAmp: { value: 0.6 }, uNeck: { value: 0 }, uNeckYaw: { value: 0 }, uTail: { value: 0 }, uFold: { value: 0 }, uLift: { value: 0 }, uHeat: { value: 0 } };

  // ---- wings
  const w = new Feathers(), armC = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.95, 0.05, 0.02), V(1.95, 0.06, 0.16), V(2.95, 0.03, 0.18), V(3.9, 0, -0.16)], false, 'centripetal');
  const armAt = (t) => armC.getPoint(Math.min(1, Math.max(0, t)));
  const up = V(0, 1, 0);
  for (let i = 0; i < 15; i++) { const t = i / 14, a = lerp(0.16, 1.2, Math.pow(t, 1.05)), root = armAt(lerp(0.64, 0.995, t)); root.y -= 0.02 + i * 0.005; // primaries: long, slotted, upswept
    w.add(root, V(Math.sin(a), 0.02, -Math.cos(a)), up, lerp(2.7, 4.1, Math.sin(t * 2.15) * 0.82 + t * 0.14), 0.27 - t * 0.06, 0.46 + t * 0.14, R(), { curve: 0.05, segs: 12, asym: 0.85, curl: 0.34 + t * 0.2 }); }
  for (let i = 0; i < 19; i++) { const t = i / 18, root = armAt(lerp(0.26, 0.65, t)); root.y -= 0.03; w.add(root, V(lerp(-0.12, 0.16, t), 0, -1), up, lerp(2.15, 2.75, t) + 0.12 * (R() - 0.5), 0.24, 0.40, R(), { curve: 0.02, segs: 9, asym: 0.3, curl: 0.22 }); }
  for (let i = 0; i < 11; i++) { const t = i / 10, root = armAt(lerp(0.02, 0.27, t)); root.y -= 0.02; w.add(root, V(lerp(-0.22, -0.1, t), 0, -1), up, lerp(1.5, 2.2, t), 0.25, 0.34, R(), { segs: 7 }); }
  const rows = [[36, 1.7, 0.17, 0.46, 0.04, -0.05], [44, 1.25, 0.145, 0.38, 0.065, 0.03], [52, 0.9, 0.125, 0.3, 0.09, 0.08], [60, 0.64, 0.105, 0.23, 0.11, 0.13], [68, 0.48, 0.09, 0.19, 0.12, 0.17], [76, 0.36, 0.075, 0.2, 0.115, 0.21], [80, 0.3, 0.066, 0.28, 0.09, 0.25], [84, 0.26, 0.06, 0.4, 0.05, 0.28]];
  for (const [n, len, wd, tone, y, fwd] of rows) for (const sgn of [1, -1]) for (let i = 0; i < n; i++) { const t = i / (n - 1), root = armAt(t), fan = smooth(0.62, 1, t) * 0.8;
    root.z += fwd * 0.8 * (1 - t * 0.35) + (R() - 0.5) * 0.03; root.y += y * sgn * (1 - t * 0.5);
    w.add(root, V(Math.sin(fan) + (R() - 0.5) * 0.14, -0.05 * sgn, -Math.cos(fan)), V(0, sgn, 0), len * lerp(0.85, 1.12, smooth(0, 1, t)) * (0.88 + R() * 0.24), wd, tone * 0.82 + t * 0.12 + (sgn < 0 ? 0.1 : 0), R(), { curve: -0.02 + (R() - 0.5) * 0.04, segs: 5, hot: len < 0.4 ? 0.1 : 0 }); }
  for (let i = 0; i < 5; i++) w.add(V(2.8 + i * 0.07, 0.08, 0.4), V(0.75, 0.05, -0.1 - i * 0.2), up, 0.85, 0.1, 0.3, R()); // alula
  const wingGeo = w.build(), wingMat = featherMaterial(u, pose, 'WING'), wingDepth = featherMaterial(u, pose, 'WING', true);
  for (const s of [1, -1]) { const m = new THREE.Mesh(wingGeo, wingMat); m.scale.set(s * WS[0], WS[1], WS[2]); m.position.set(0.42 * s, 0.3, 0.45); m.frustumCulled = false; m.userData.depthMat = wingDepth; m.layers.enable(1); group.add(m); }

  // ---- body plumage
  group.add(new THREE.Mesh(loft(SPINE.map(([y, z, r]) => [0, y, z, r * 0.93, r * 0.93]), 24, 5), skinMaterial(u, pose, '#7a1608', { bend: true })));
  const spine = new THREE.CatmullRomCurve3(SPINE.map(([y, z]) => V(0, y, z))), rad = new THREE.CatmullRomCurve3(SPINE.map(([, , r]) => V(r, 0, 0)));
  const b = new Feathers(), rowsN = 64;
  for (let j = 0; j < rowsN; j++) { const t = 0.02 + 0.955 * Math.pow(j / (rowsN - 1), 0.95), c = spine.getPoint(t), T = spine.getTangent(t), r = rad.getPoint(t).x;
    const U0 = V(1, 0, 0).cross(T).negate().normalize(), neck = smooth(0.44, 0.6, t), head = smooth(0.74, 0.86, t), len = lerp(lerp(0.56, 0.5, neck), 0.15, head), n = Math.round(lerp(lerp(26, 24, neck), 24, head));
    for (let i = 0; i < n; i++) { const a = (i + (j % 2) * 0.5) / n * Math.PI * 2 + (R() - 0.5) * 0.12, N = V(1, 0, 0).multiplyScalar(Math.cos(a)).addScaledVector(U0, Math.sin(a)), z = c.z + N.z * r;
      if (z > 2.1 && Math.abs(Math.cos(a)) > 0.7 && Math.sin(a) > -0.45 && Math.sin(a) < 0.62) continue; // face
      const belly = smooth(-0.1, 0.8, -N.y), nape = neck * smooth(-0.35, 0.5, N.y);
      let tone = lerp(0.1, 0.24, belly); tone = lerp(tone, 0.16 + nape * 0.14, neck); tone = lerp(tone, 0.3 + 0.26 * smooth(-0.2, 1, N.y), head); if (t < 0.22) tone += 0.14;
      const front = smooth(0.35, 0.95, N.z * 0.75 - N.y * 0.62) * smooth(0.45, 1.0, c.z) * smooth(1.95, 1.5, c.z), hot = Math.min(1, front * 1.1 + 0.28 * belly * smooth(0.1, 0.8, c.z) * (1 - neck) + 0.25 * head * smooth(0.3, 1, N.y)); tone += hot * 0.34;
      const e = 0.012, rise = Math.max(0, (rad.getPoint(Math.max(0, t - e)).x - rad.getPoint(Math.min(1, t + e)).x) / spine.getPoint(Math.max(0, t - e)).distanceTo(spine.getPoint(Math.min(1, t + e)))), concave = neck * smooth(0.1, 0.8, N.y) * 0.3;
      const hackle = neck > 0.4 && head < 0.7;
      b.add(c.clone().addScaledVector(N, r * 0.93), T.clone().negate().addScaledVector(N, (hackle ? 0.2 : 0.15) + R() * 0.14 + rise + concave).add(V((R() - 0.5) * 0.12, -0.05, 0)), N, len * (0.8 + R() * 0.45), Math.max(0.034, len * (hackle ? 0.16 : 0.22)), tone, R(), { curve: hackle ? -0.06 : -0.12, segs: 4, asym: hackle ? -1 : 0, hot });
      if (hot > 0.5 && R() < 0.2) b.add(c.clone().addScaledVector(N, r * 0.95), T.clone().negate().multiplyScalar(0.8).addScaledVector(N, 0.35 + R() * 0.4).add(V((R() - 0.5) * 0.7, -0.35, 0)), N, 0.55 + R() * 0.55, 0.04, 0.8, R(), { segs: 9, asym: -1, hot: 0.9, curl: (R() - 0.35) * 2.6, sway: (R() - 0.5) * 1.5 }); } }
  // crest: a swept-back crown, long in the middle
  for (let k = 0; k < 4; k++) for (let i = 0; i < 13; i++) { const t = i / 12 - 0.5, m = 1 - Math.abs(t) * 1.45; b.add(V(t * 0.27, 1.0 - Math.abs(t) * 0.14 - k * 0.025, 2.2 - k * 0.13 - Math.abs(t) * 0.08), V(t * (1.1 + k * 0.1), 0.62 + m * 0.5 - k * 0.16 + (R() - 0.5) * 0.16, -0.95 + (R() - 0.5) * 0.1), V(0, 1, 0.6), (0.55 + m * 0.85 + R() * 0.3) * (1 - k * 0.06), 0.085, 0.42 + k * 0.03, R(), { curve: 0.02, segs: 11, asym: -1, curl: (k % 2 ? 0.9 : -0.5) + (R() - 0.5) * 0.9, sway: (R() - 0.5) * 0.6, hot: 0.5 + m * 0.2 }); }
  const bm = new THREE.Mesh(b.build(), featherMaterial(u, pose, 'BODY')); bm.frustumCulled = false; bm.userData.depthMat = featherMaterial(u, pose, 'BODY', true); bm.layers.enable(1); group.add(bm);

  // ---- head (pivots with the neck)
  const legs = [], head = new THREE.Group(), inner = new THREE.Group(); head.position.copy(PIVOT); inner.position.copy(PIVOT).negate(); head.add(inner); group.add(head);
  head.rotation.order = 'YXZ';
  const horn = skinMaterial(u, pose, '#7a3c1a', { gloss: 0.6 }), dark = skinMaterial(u, pose, '#2a0a08', { gloss: 0.4 }), beakM = skinMaterial(u, pose, '#8a3d16', { gloss: 1.2, tip: '#160705', z: [2.42, 2.66] }), brow = skinMaterial(u, pose, '#5e0f0a', { gloss: 0.15 }), cere = skinMaterial(u, pose, '#b4561c', { gloss: 0.6 });
  // raptor beak: deep at the base, long flat top line, then a hard hook past the lower jaw
  inner.add(new THREE.Mesh(loft([[0, 0.735, 2.24, 0.165, 0.13], [0, 0.745, 2.36, 0.125, 0.122], [0, 0.742, 2.46, 0.098, 0.112], [0, 0.712, 2.56, 0.072, 0.098], [0, 0.65, 2.645, 0.047, 0.074], [0, 0.57, 2.69, 0.028, 0.046], [0, 0.49, 2.69, 0.013, 0.022], [0, 0.445, 2.678, 0.003, 0.004]], 20, 8), beakM));
  inner.add(new THREE.Mesh(loft([[0, 0.742, 2.26, 0.162, 0.13], [0, 0.753, 2.34, 0.136, 0.13], [0, 0.752, 2.395, 0.118, 0.124], [0, 0.745, 2.41, 0.08, 0.08]], 20), cere));
  const jaw = new THREE.Group(); jaw.position.set(0, 0.6, 2.2);
  jaw.add(new THREE.Mesh(loft([[0, 0.035, -0.04, 0.14, 0.055], [0, 0.03, 0.14, 0.1, 0.044], [0, 0.026, 0.27, 0.064, 0.034], [0, 0.028, 0.37, 0.028, 0.02], [0, 0.034, 0.41, 0.004, 0.004]], 16), skinMaterial(u, pose, '#7c3614', { gloss: 0.8, tip: '#1c0a06', z: [0.15, 0.4] }))); inner.add(jaw);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 1.6, 0.25), transparent: true, opacity: 0 })); mouth.position.set(0, 0.64, 2.38); mouth.scale.set(0.75, 0.4, 1.5); inner.add(mouth);
  const iris = new THREE.ShaderMaterial({ uniforms: u, vertexShader: 'varying vec3 vP, vN, vW; void main(){ vP = position; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = mat3(modelMatrix) * normal; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GLSL + `varying vec3 vP, vN, vW; void main(){ float r = length(vP.yz - vec2(0., .006)) / .072; vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
      float st = n2(vec2(atan(vP.y, vP.z) * 9., r * 2.)); vec3 c = mix(vec3(1.25,.62,.05), vec3(.75,.16,.01), smoothstep(.35,.95,r)) * (.65 + .5 * st); c *= mix(.25, 1., smoothstep(.22, .38, r)); c *= smoothstep(1.06, .9, r); c = c * 1.5 + vec3(1.9,1.05,.34) * smoothstep(1., .25, r) * (.9 + .1 * sin(uTime * 3.));
      c *= .55 + .5 * max(dot(N, uSunDir), 0.); c += vec3(1.6) * smoothstep(.93, .97, dot(N, normalize(V + uSunDir * .6 + vec3(0.,.5,0.)))); gl_FragColor = vec4(c, 1.); }` });
  const hc = document.createElement('canvas'); hc.width = hc.height = 64; { const g = hc.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); } const haloTex = new THREE.CanvasTexture(hc);
  for (const s of [1, -1]) {
    const patch = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 12), dark); patch.scale.set(0.5, 0.6, 0.9); patch.position.set(s * 0.182, 0.803, 2.22); inner.add(patch);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(1.6, 0.7, 0.18), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })); halo.position.set(s * 0.275, 0.81, 2.265); halo.scale.setScalar(0.34); inner.add(halo);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.076, 24, 18), iris); eye.position.set(s * 0.2, 0.805, 2.235); eye.rotation.y = s * -0.42; inner.add(eye);
    // heavy brow gives the fierce raptor glare
    inner.add(new THREE.Mesh(loft([[s * 0.13, 0.94, 1.98, 0.03, 0.03], [s * 0.225, 0.92, 2.1, 0.055, 0.04], [s * 0.248, 0.884, 2.22, 0.058, 0.036], [s * 0.2, 0.845, 2.32, 0.04, 0.026], [s * 0.13, 0.815, 2.39, 0.01, 0.008]], 12), brow));
    // yellow gape running back under the eye
    inner.add(new THREE.Mesh(loft([[s * 0.09, 0.652, 2.44, 0.01, 0.008], [s * 0.135, 0.65, 2.34, 0.016, 0.013], [s * 0.175, 0.66, 2.24, 0.016, 0.013], [s * 0.2, 0.685, 2.14, 0.004, 0.004]], 10), cere));
    const nos = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), dark); nos.scale.set(0.5, 0.7, 1.3); nos.position.set(s * 0.112, 0.782, 2.375); inner.add(nos);
    // leg: hangs along -Y from the hip; tucks back in flight
    const leg = new THREE.Group(); leg.position.set(s * 0.3, -0.3, -0.1); legs.push(leg); group.add(leg);
    leg.add(new THREE.Mesh(loft([[0, 0.12, 0, 0.19, 0.22], [0, -0.2, 0.03, 0.18, 0.2], [0, -0.5, -0.02, 0.09, 0.1], [0, -0.62, -0.05, 0.06, 0.065]], 14), skinMaterial(u, pose, '#3c120a')));
    leg.add(new THREE.Mesh(loft([[0, -0.55, -0.05, 0.055, 0.055], [0, -0.85, -0.02, 0.045, 0.045], [0, -1.14, 0.02, 0.052, 0.052]], 10), horn));
    for (const [dx, dz] of [[-0.55, 0.85], [0, 1], [0.55, 0.85], [0, -0.8]]) {
      leg.add(new THREE.Mesh(loft([[0, -1.13, 0.02, 0.05, 0.05], [dx * 0.16, -1.15, 0.02 + dz * 0.17, 0.045, 0.045], [dx * 0.3, -1.2, 0.02 + dz * 0.32, 0.04, 0.04]], 8, 4), horn));
      leg.add(new THREE.Mesh(loft([[dx * 0.29, -1.19, 0.02 + dz * 0.31, 0.034, 0.034], [dx * 0.36, -1.2, 0.02 + dz * 0.4, 0.024, 0.024], [dx * 0.4, -1.27, 0.02 + dz * 0.45, 0.003, 0.003]], 8, 4), dark));
    }
    const thigh = new Feathers(); for (let j = 0; j < 10; j++) for (let i = 0; i < 16; i++) { const a = (i + (j % 2) * 0.5) / 16 * 6.283, y = 0.16 - j * 0.075, r = lerp(0.24, 0.09, j / 9), n = V(Math.cos(a), 0.15, Math.sin(a)); thigh.add(V(Math.cos(a) * r, y, Math.sin(a) * r), V(Math.cos(a) * 0.2, -1, Math.sin(a) * 0.2 - 0.12), n, 0.34 + R() * 0.12, 0.06, 0.22 + j * 0.02 + R() * 0.1, R(), { curve: -0.08, segs: 4, asym: -1 }); }
    const th = new THREE.Mesh(thigh.build(), featherMaterial(u, pose, 'LEG')); leg.add(th);
  }

  // ---- tail: fan plus long streamers
  const tl = new Feathers();
  // rump coverts bridge the body into the train
  for (let k = 0; k < 5; k++) for (const sgn of [1, -1]) for (let i = 0; i < 15; i++) { const t = i / 14 - 0.5; tl.add(V(t * (0.62 - k * 0.04), (0.2 - Math.abs(t) * 0.24) * sgn + 0.03, -0.95 - k * 0.14), V(t * 0.75, sgn * 0.03, -1), V(0, sgn, 0), 0.8 + k * 0.34 + R() * 0.25, 0.12 + k * 0.012, 0.18 + k * 0.05, R(), { curve: -0.05, segs: 5 }); }
  for (let k = 0; k < 2; k++) for (let i = 0; i < 17; i++) { const t = i / 16 - 0.5; tl.add(V(t * 0.34, 0.06 - k * 0.07 - Math.abs(t) * 0.08, -1.4), V(t * (1.5 - k * 0.3), 0, -1), up, 2.9 + k * 0.9 - Math.abs(t) * 0.9, 0.25, 0.34 + k * 0.06, R(), { segs: 8, curve: -0.03 }); }
  // the train: long silk ribbons that curl at the ends
  for (let k = 0; k < 3; k++) { const n = 11 - k * 2; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5 + (R() - 0.5) * 0.03, L = (10.4 - k * 2 - Math.abs(t) * 5) * (0.9 + R() * 0.2); tl.add(V(t * 0.36, 0.14 - k * 0.1, -1.35 - R() * 0.1), V(t * (0.8 + k * 0.3), 0.05 - k * 0.07 + (R() - 0.5) * 0.06, -1), up, L, 0.34 + R() * 0.14, 0.4 + k * 0.05, R(), { segs: 36, asym: 2, curl: (R() < 0.75 ? 1 : -1) * (0.9 + R() * 1.9), sway: (R() - 0.5) * 1.6 }); } }
  // fine filaments, tightly curled
  for (let i = 0; i < 18; i++) { const t = i / 17 - 0.5; tl.add(V(t * 0.3, 0.12, -1.4), V(t * 1.05, 0.06 * Math.sin(i * 2.2), -1), up, 5 + R() * 4 - Math.abs(t) * 2, 0.11, 0.66, R(), { segs: 34, asym: -1, hot: 0.3, curl: (R() < 0.6 ? 1 : -1) * (1.6 + R() * 2.6), sway: (R() - 0.5) * 2.4 }); }
  const tm = new THREE.Mesh(tl.build(), featherMaterial(u, pose, 'TAIL')); tm.frustumCulled = false; tm.userData.depthMat = featherMaterial(u, pose, 'TAIL', true); tm.layers.enable(1); group.add(tm);

  // CPU mirror of the wing bend, so fire can leave the real wingtips.
  const local = V(0, 0, 0);
  const ang = (s) => 0.1 + pose.uLift.value * (1 - s * 0.075) + pose.uAmp.value * 0.62 * Math.sin(pose.uPhase.value) + s * 0.155 * pose.uAmp.value * Math.sin(pose.uPhase.value - 1.25) + s * 0.018;
  const wingPoint = (side, x, z, out) => { let cx = 0, cy = 0; const ds = x / 8; for (let i = 0; i < 8; i++) { const t = ang((i + 0.5) * ds); cx += ds * Math.cos(t); cy += ds * Math.sin(t); }
    const sw = Math.max(Math.cos(pose.uPhase.value), 0) * pose.uAmp.value * smooth(1.6, 6, x) * x * 0.16;
    return group.localToWorld(out.set(side * (cx * WS[0] + 0.42), cy * WS[1] + 0.3, (z - sw) * WS[2] + 0.45)); };
  return { group, pose, head, jaw, legs, mouth, wingPoint,
    tailPoint: (out) => group.localToWorld(out.set((R() - 0.5) * 1.4, 0.1, -2.2 - R() * 4)),
    beak: (out) => inner.localToWorld(out.set(0, 0.63, 2.78)),
    forward: (out) => inner.localToWorld(out.set(0, 0.5, 3.95)).sub(inner.localToWorld(local.set(0, 0.5, 2.95))).normalize(),
    update() { head.rotation.set(pose.uNeck.value, pose.uNeckYaw.value, 0); } };
}
