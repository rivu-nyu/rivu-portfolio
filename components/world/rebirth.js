import * as THREE from 'three';
import { GLSL, rng, smooth, lerp } from './common';
import { STOPS, at } from './stops';

/* The death and rebirth of the phoenix, between the caldera and the new dawn. Everything is a function of how far the
   page has been scrolled (q runs 0 to 1 over the flight), so the visitor drives it. It belongs to the flight onward:
   coming back, the bird simply flies. */
const FROM = at('twin'), HIT = 0.235;
const DIVINE = /* glsl */ `vec3 divine(float h){ h = fract(h) * 6.; vec3 c = mix(vec3(1.,.62,.12), vec3(1.,.22,.34), smoothstep(0.,1.,h)); c = mix(c, vec3(.86,.18,.88), smoothstep(1.,2.,h)); c = mix(c, vec3(.34,.26,1.), smoothstep(2.,3.,h)); c = mix(c, vec3(.10,.68,1.), smoothstep(3.,4.,h)); c = mix(c, vec3(.16,.95,.58), smoothstep(4.,5.,h)); return mix(c, vec3(1.,.62,.12), smoothstep(5.,6.,h)); }`;

export function createRebirth(u, low, phx, fire, vent) {
  const R = rng(4409), group = new THREE.Group(), uni = { ...u, uQ: { value: 0 }, uG: { value: new THREE.Matrix4() }, uFw: { value: new THREE.Vector3(0, 0, -1) }, uDiv: { value: 0 } }; group.visible = false;
  const quad = () => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]); return g; };
  const inst = (g, n, name, size, fill) => { const a = new Float32Array(n * size); for (let i = 0; i < n; i++) fill(a, i * size); g.setAttribute(name, new THREE.InstancedBufferAttribute(a, size)); g.instanceCount = n; };

  // ---- ash: each flake leaves its own place on the bird, rides the wind, and returns to it
  const N = low ? 4200 : 16000, ag = quad();
  inst(ag, N, 'aS', 3, (a, k) => { const q = R(), s = R() < 0.5 ? -1 : 1; if (q < 0.56) { const x = 0.5 + Math.pow(R(), 0.8) * 6.3; a[k] = s * x; a[k + 1] = 0.35 + x * 0.12 + (R() - 0.5) * 0.15; a[k + 2] = 0.7 - R() * (3.2 - x * 0.12); } else if (q < 0.76) { const t = R(), an = R() * 6.28, r = 0.65 * Math.sin(0.5 + t * 2.3); a[k] = Math.cos(an) * r; a[k + 1] = Math.sin(an) * r + t * 0.5; a[k + 2] = -1.5 + t * 3.6; } else { const l = R(); a[k] = (R() - 0.5) * (0.6 + l * 5); a[k + 1] = 0.1 + (R() - 0.5) * 0.4; a[k + 2] = -1.4 - l * 8.5; } });
  inst(ag, N, 'aR', 4, (a, k) => { for (let j = 0; j < 4; j++) a[k + j] = R(); });
  const ash = new THREE.Mesh(ag, new THREE.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: GLSL + /* glsl */ `attribute vec3 aS; attribute vec4 aR; uniform float uQ; uniform mat4 uG; uniform vec3 uFw; varying vec2 vQ; varying vec3 vW; varying float vA, vHot, vGold, vSeed, vSmoke, vDim;
      void main(){ float smoke = step(.965, aR.w); float rel = ${HIT.toFixed(2)} + .04 + .22 * (aR.x * .55 + .45 * smoothstep(0., 9., length(aS - vec3(.6,.3,.2)))); float age = (uQ - rel) / .28;
        vec3 src = (uG * vec4(aS, 1.)).xyz, side = normalize(cross(uFw, vec3(0.,1.,0.)));
        // a long scarf of ash on the wind, folding over itself
        float s = aR.y, t = uTime * .35 + uQ * 9.; vec3 jit = (vec3(aR.z, fract(aR.z * 57.), fract(aR.w * 91.)) - .5);
        vec3 stream = uPhx - uFw * (s - .42) * 25. + side * (sin(s * 6.5 + t) * 3.4 + sin(s * 15. - t * 1.7) * .9) + vec3(0., cos(s * 5.2 + t * .9) * 2.1 + s * 1.5, 0.);
        float wide = .5 + 2.3 * s * s + 1.1 * n2(vec2(s * 9., uTime * .3)); stream += jit * wide * 1.7; stream += (vec3(n2(vec2(s * 14. + t, aR.z * 9.)), n2(vec2(s * 11. - t, aR.z * 7. + 5.)), n2(vec2(s * 13. + t, aR.z * 8. + 9.))) - .5) * 2.6;
        // then it turns inward, a slow whirl that tightens
        float conv = smoothstep(.60, .84, uQ + (aR.x - .5) * .05), an = aR.z * 6.283 + conv * 8.5 + uTime * (.5 + conv * .9) + aR.y * 2.; float gz = (aR.w + fract(aR.w * 71.) + fract(aR.z * 43.) - 1.5) * .9, gr = pow(aR.x, .7) * (.4 + .6 * fract(aR.x * 37.)); float arm = floor(fract(aR.z * 5.) * 3.) * 2.094 - gr * 3.6; an = arm + (fract(aR.z * 5. * 3.) - .5) * 1.3 + conv * 7. + uTime * (.4 + .8 * conv); float rad = mix(11., .9, conv * conv) * gr + .15; vec3 vort = uPhx + vec3(cos(an) * rad, gz * mix(4.2, 1.1, conv) * (1.15 - gr * .75) + sin(an + uQ * 12.) * rad * .22, sin(an) * rad);
        float fly = smoothstep(0., 1., age); vec3 p = mix(src, stream, fly * fly * (3. - 2. * fly)); p.y += sin(fly * 3.14159) * (1.2 * aR.z + .3);
        p = mix(p, vort, smoothstep(.56, .72, uQ + (aR.y - .5) * .05)); p = mix(p, src, smoothstep(.80, .92, uQ + (aR.z - .5) * .07));
        float tw = .5 + .5 * sin(uTime * (3. + aR.x * 7.) + aR.y * 90.); vHot = exp(-max(age, 0.) * (9. + aR.y * 16.)) * .9 + step(.955, aR.z) * tw * .55 * (1. - smoothstep(.45, .7, uQ)); vGold = smoothstep(.64, .86, uQ + (aR.x - .5) * .12); vSeed = aR.x; vSmoke = smoke; vDim = mix(.55, .16, smoothstep(.66, .80, uQ)) + .5 * smoothstep(.82, .92, uQ); vQ = position.xy;
        float a1 = uTime * (1. + aR.y * 3.) + aR.z * 60., sz = (.022 + .060 * aR.x * aR.x + .05 * step(.95, aR.y)) * mix(1., .75, vGold); if (smoke > .5) sz = (1.1 + 1.6 * aR.x) * smoothstep(0., .5, fly) * (1. - vGold);
        mat2 rot = mat2(cos(a1), -sin(a1), sin(a1), cos(a1)); vec2 c = rot * (position.xy * vec2(1., smoke > .5 ? 1. : .35 + .65 * abs(sin(a1 * 1.7)))) * sz; vec4 m = viewMatrix * vec4(p, 1.); m.xy += c; vW = p;
        vA = smoothstep(rel, rel + .02, uQ) * (1. - smoothstep(.90, .985, uQ + (aR.x - .5) * .04)); gl_Position = vA < .01 || sz < .001 || -m.z < 1.5 ? vec4(2.,2.,2.,1.) : projectionMatrix * m; }`,
    fragmentShader: GLSL + DIVINE + /* glsl */ `varying vec2 vQ; varying vec3 vW; varying float vA, vHot, vGold, vSeed, vSmoke, vDim; void main(){ float r = length(vQ); 
      if (vSmoke > .5) { float n = fbm2(vQ * 1.6 + vSeed * 40. + uTime * .1); float a = smoothstep(1., .1, r) * smoothstep(.2, .7, n) * .085 * vA; gl_FragColor = vec4((uSky * .16 + uSunCol * .03 + vec3(.9,.2,.03) * vHot) * a, a); return; }
      float edge = .62 + .38 * n2(vQ * 2.2 + vSeed * 70.); float a = smoothstep(edge, edge - .25, r) * vA; if (a < .02) discard;
      vec3 grey = mix(vec3(.025), vec3(.26,.25,.24), vSeed * vSeed * vSeed) * (uSky * .7 + uSunCol * .22) + vec3(1.,.30,.05) * .03 * (1. - vGold); vec3 c = fogged(grey, vW) + vec3(3.2,.85,.12) * vHot; vec3 gold = mix(vec3(1.35,.58,.10), divine(vSeed + vW.y * .09 + uTime * .06) * 1.0, .5) * vDim;
      c = mix(c, gold, vGold * (.35 + .65 * vSeed)); gl_FragColor = vec4(c * a, a * mix(1., .25, vGold)); }` }));
  ash.frustumCulled = false; ash.renderOrder = 7; group.add(ash);

  // ---- divine fire: tongues of many colours climbing in two counter-turning spirals
  const M = low ? 240 : 620, dg = quad(); inst(dg, M, 'aR', 4, (a, k) => { for (let j = 0; j < 4; j++) a[k + j] = R(); });
  const tongues = new THREE.Mesh(dg, new THREE.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: GLSL + /* glsl */ `attribute vec4 aR; uniform float uDiv; varying vec2 vQ; varying float vL, vS, vH, vA; void main(){ float life = fract(uTime * (.22 + .2 * aR.x) + aR.y), dirn = aR.w < .5 ? 1. : -1.; float arm = floor(aR.z * 4.) / 4., an = arm * 6.283 + dirn * (life * 3.3 + uTime * .35) + (fract(aR.z * 4.) - .5) * .9;
      float rad = (1.2 + 4.6 * sin(3.14159 * pow(life, .7))) * (.45 + .55 * uDiv) * (.75 + .5 * aR.x); vec3 p = uPhx + vec3(cos(an) * rad, mix(-4.2, 7.5, life) * (.4 + .6 * uDiv) , sin(an) * rad); vec3 tang = vec3(-sin(an) * dirn, 1.5, cos(an) * dirn);
      vec2 v = normalize((mat3(viewMatrix) * tang).xy + 1e-4); float s = (.35 + 1.15 * aR.w * fract(aR.w * 37.) + .25) * sin(3.14159 * life) * uDiv; vec4 m = viewMatrix * vec4(p, 1.); m.xy += (v * position.y * 2.5 + vec2(v.y, -v.x) * position.x) * s; vQ = position.xy; vL = life; vS = aR.x; vH = arm + life * .45 + aR.z * .12; vA = uDiv; gl_Position = uDiv < .01 || -m.z < 2. ? vec4(2.,2.,2.,1.) : projectionMatrix * m; }`,
    fragmentShader: GLSL + DIVINE + /* glsl */ `varying vec2 vQ; varying float vL, vS, vH, vA; void main(){ vec2 q = vQ; q.x += (n2(vec2(q.y * 2. - uTime * 2.2, vS * 60.)) - .5) * .8; float body = 1. - length(q * vec2(1.55 + q.y * .55, .95)); vec2 f = q * vec2(2.4, 1.3) + vec2(vS * 50., -uTime * 1.6 - vL * 2.); float n = n2(f) * .56 + n2(f * 2.1 + 3.7) * .28 + n2(f * 4.3 + 9.1) * .16; float k = smoothstep(.16, .72, body * .8 + n * .55 - .14) * smoothstep(1., .7, length(vQ)); if (k < .01) discard;
      vec3 c = divine(vH + n * .12); c *= c;  c = mix(c, vec3(1.,.93,.80), smoothstep(.75, 1., k) * .3); gl_FragColor = vec4(c * k * .125 * smoothstep(0., .15, vL) * smoothstep(1., .6, vL) * vA, 1.); }` }));
  tongues.frustumCulled = false; tongues.renderOrder = 8; group.add(tongues);

  // ---- the light at the heart of it
  const halo = new THREE.Mesh(quad(), new THREE.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL + 'uniform float uDiv, uQ; varying vec2 vQ; void main(){ vQ = position.xy; vec4 m = viewMatrix * vec4(uPhx, 1.); m.xy += position.xy * 13.; m.z -= 3.; gl_Position = projectionMatrix * m; }',
    fragmentShader: GLSL + DIVINE + /* glsl */ `uniform float uDiv, uQ; varying vec2 vQ; void main(){ float r = length(vQ); if (r > 1.) discard; float a = atan(vQ.y, vQ.x); float rays = pow(n2(vec2(a * 5.1 + 20., uTime * .25)) * .6 + n2(vec2(a * 13. + 40., -uTime * .35)) * .4, 2.2); float core = exp(-r * 9.); float birth = exp(-pow((uQ - .84) / .06, 2.)); float ring = smoothstep(.05, .0, abs(r - smoothstep(.80, .97, uQ) * .95)) * smoothstep(.80, .83, uQ) * (1. - smoothstep(.90, .97, uQ));
      vec3 c = vec3(1.,.80,.46) * core * (.22 + .55 * birth) + divine(a * .159 + r * .6 - uTime * .05) * rays * exp(-r * 3.4) * .34 + divine(a * .159 * 2. + uTime * .1) * ring * .45; gl_FragColor = vec4(c * uDiv * smoothstep(1., .6, r), 1.); }` }));
  halo.geometry.instanceCount = 1; halo.frustumCulled = false; halo.renderOrder = 4; group.add(halo);

  // ---- what the mountain throws: one bomb that finds the bird, and others that miss
  const bg = new THREE.IcosahedronGeometry(1, 5), bp = bg.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < bp.count; i++) { v.fromBufferAttribute(bp, i); const w = 1 + 0.2 * Math.sin(v.x * 3.1 + 1) * Math.cos(v.y * 2.7) + 0.12 * Math.sin(v.z * 6.3 + v.x * 4.1) + 0.05 * Math.sin(v.y * 14 + v.z * 11); bp.setXYZ(i, v.x * w * 1.15, v.y * w * 0.9, v.z * w); } bg.computeVertexNormals();
  const bm = new THREE.ShaderMaterial({ uniforms: u, vertexShader: 'varying vec3 vP, vN, vW; void main(){ vP = position; vN = mat3(modelMatrix) * normal; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: GLSL + 'uniform sampler2D tBasalt; varying vec3 vP, vN, vW; void main(){ vec3 N = normalize(vN); vec3 t = texture2D(tBasalt, vP.xy * .4 + vP.z * .2).rgb; float n = fbm3(vP * 2.3), cr = 1. - abs(fbm3(vP * 2.9 + 7.) * 2. - 1.); float hot = smoothstep(.72, .98, cr) + smoothstep(.56, .72, n) * .55; vec3 c = t * .16 * (uSky + uSunCol * max(dot(N, uSunDir), 0.)); c += mix(vec3(1.6,.12,.01), vec3(4.2,1.7,.35), smoothstep(.3, 1.2, hot)) * hot * (.8 + .2 * sin(uTime * 9. + n * 20.)); gl_FragColor = vec4(fogged(c, vW), 1.); }' });
  const bombs = [0, 1, 2, 3, 4].map((i) => { const m = new THREE.Mesh(bg, bm); m.frustumCulled = false; m.scale.setScalar(i ? 0.8 + i * 0.22 : 1.5); group.add(m); return { m, miss: i ? new THREE.Vector3([0, -34, 26, 48, -22][i], [0, -16, -18, -20, -22][i], [0, 20, 34, -14, 46][i]) : null, t0: [0.06, 0.02, 0.08, 0.13, 0.16][i], t1: [HIT, 0.2, 0.26, 0.31, 0.36][i] }; });

  const s = { q: 0, on: false, armed: true, reborn: 0, burn: 0, alive: 1, fall: 0, jolt: 0, glory: 0 }, a = new THREE.Vector3(), b = new THREE.Vector3(), hit = new THREE.Vector3(); let qWas = 0;
  const burst = (n, p, sp, life, size, kind) => { for (let i = 0; i < n; i++) { const an = R() * 6.28, z = R() * 2 - 1, r = Math.sqrt(1 - z * z), k = sp * (0.2 + R()); fire.emit(p, b.set(Math.cos(an) * r * k, z * k + sp * 0.15, Math.sin(an) * r * k), life * (0.4 + R()), size * (0.4 + R()), kind); } };

  // called before the bird is posed
  s.plan = (P, onward, dt) => {
    const q = P - FROM;
    if (q < 0.015) { s.armed = true; s.on = false; } else if (q >= 0.995) { if (s.on) s.reborn = 1; s.on = false; s.armed = false; } else if (!s.on && s.armed && onward && q < 0.3) s.on = true;
    if (q < 0 || (q > 0.02 && !s.on && q < 0.9)) s.reborn = 0;
    s.q = s.on ? q : 0; s.reborn = Math.max(0, s.reborn - dt / 5); qWas = s.on ? qWas : 0;
    const x = s.q; s.fall = smooth(HIT, 0.47, x) * (1 - smooth(0.62, 0.8, x)); s.jolt = x > HIT ? Math.exp(-(x - HIT) * 26) : 0;
    s.alive = 1 - smooth(HIT + 0.05, 0.46, x) * (1 - smooth(0.84, 0.95, x)); s.glory = Math.max(smooth(0.74, 0.86, x), s.reborn * s.reborn * (3 - 2 * s.reborn)); s.rise = smooth(0.8, 0.92, x) * (1 - smooth(0.965, 1, x));
    u.uBurn.value.set(smooth(HIT, 0.42, x) * (1 - smooth(0.6, 0.7, x)), x < 0.6 ? smooth(HIT + 0.06, 0.47, x) : 1 - smooth(0.83, 0.955, x), smooth(0.6, 0.7, x), 0); if (!s.on) u.uBurn.value.set(0, 0, 0, 0);
    group.visible = s.on || s.reborn > 0.01; uni.uQ.value = x; uni.uDiv.value = s.glory; return s;
  };
  // called once the bird stands where it stands this frame
  s.draw = (dt, time, fwd) => {
    ash.visible = s.on; if (!group.visible) return; const x = s.q; uni.uG.value.copy(phx.group.matrixWorld); uni.uFw.value.copy(fwd); halo.visible = tongues.visible = s.glory > 0.005;
    const target = phx.group.position; hit.copy(target); u.uBurnO.value.copy(target).add(a.set(0.6, 0.4, 0).applyQuaternion(phx.group.quaternion));
    for (const k of bombs) { const t = (x - k.t0) / (k.t1 - k.t0), on = s.on && t > 0 && t < (k.miss ? 1.25 : 1); k.m.visible = on; if (!on) continue; a.copy(target); if (k.miss) a.add(k.miss); const e = t * (0.75 + 0.25 * t); k.m.position.copy(vent).lerp(a, e); k.m.position.y += 4 * e * (1 - e) * (k.miss ? 46 : 34); k.m.rotation.set(time * 3.1 + t * 9, time * 2.3, t * 7);
      for (let i = 0; i < (low ? 2 : 4); i++) { const sc = k.m.scale.x, back = b.copy(vent).sub(a).normalize(); a.copy(k.m.position).add({ x: (R() - 0.5) * sc, y: (R() - 0.5) * sc, z: (R() - 0.5) * sc }); back.multiplyScalar(6 + R() * 10); back.y += 2; fire.emit(a, back, 0.5 + R() * 0.9, sc * (0.5 + R() * 0.7), R() < 0.25 ? 1 : 0); a.copy(target); if (k.miss) a.add(k.miss); } }
    if (s.on && qWas < HIT && x >= HIT) { burst(low ? 70 : 240, hit, 22, 1.5, 0.12, 1); burst(low ? 14 : 34, hit, 9, 0.7, 1.1, 0); }
    if (s.on && x > HIT && x < 0.46) { for (let i = 0; i < (low ? 1 : 2); i++) { const sd = R() < 0.5 ? -1 : 1; if (R() < 0.6) phx.wingPoint(sd, 0.6 + R() * 5, -R() * 2, a); else phx.tailPoint(a); fire.emit(a, b.set((R() - 0.5) * 2, 2 + R() * 4, (R() - 0.5) * 2), 0.4 + R() * 0.5, 0.22 + R() * 0.4, R() < 0.55 ? 1 : 0); } }
    if (s.on && qWas < 0.9 && x >= 0.9) burst(low ? 60 : 220, hit, 13, 1.8, 0.1, 1);
    qWas = x;
  };
  s.group = group; return s;
}
