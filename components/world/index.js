import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { shared, HMAP, lerp, smooth, noise } from './common';
import { STOPS, zOf, at } from './stops';
import { createTerrain, createWater, createPerches, center, height } from './landscape';
import { createFlora, createTrees, createRocks, createGrass } from './flora';
import { createSky, createMist, createSmoke } from './sky';
import { createWaterfall, createAir } from './waterfall';
import { createCherry, createPetals } from './cherry';
import { createIsles } from './isles';
import { createBehaviour, heading } from './behaviour';
import { createPhoenix } from './phoenix';
import { createFire } from './fire';

const LAB = at('lab'), RAD = Math.PI / 180, vec = () => new THREE.Vector3();

export function createWorld(el, { reduced = false, onStop } = {}) {
  let dead = false;
  const small = window.innerWidth < 800, low = small || (navigator.hardwareConcurrency || 8) < 5;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio, low ? 1.1 : 1.25);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.24;
  const u = shared(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2600);
  const phx = createPhoenix(u), fire = createFire(u, low ? 1300 : 3000);
  phx.group.rotation.order = 'YXZ'; phx.group.traverse((o) => { if (o.isMesh && !o.material.transparent) o.renderOrder = -3; });
  const kick = () => request(), flora = createFlora(u, low, kick);
  const terrain = createTerrain(u, low), perches = createPerches(), cherry = createCherry(u, low, perches, flora, kick), isles = createIsles(u, low, perches, flora), falls = createWaterfall(u, low, kick), trees = createTrees(flora, low, perches), rocks = createRocks(u, low, perches, kick), bird = createBehaviour(perches);
  const water = createWater(u), grass = createGrass(u, low, kick), mist = createMist(u, low), valley = [terrain, water, trees, rocks, grass, mist];
  const smoke = createSmoke(u);
  scene.add(createSky(u), terrain, water, trees, rocks, grass, mist, smoke, falls, cherry, isles, createPetals(u, low), createAir(u, low), phx.group, fire.mesh);

  // embers the bird feeds on
  const coals = new THREE.Group(); { const g = new THREE.IcosahedronGeometry(0.1, 1), m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.3, 0.03) }), m2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.07, 0.01) }); for (let i = 0; i < 7; i++) { const k = new THREE.Mesh(g, i % 2 ? m : m2); k.position.set(Math.sin(i * 2.4) * 0.17 * Math.sqrt(i / 2), 0.07, Math.cos(i * 2.4) * 0.17 * Math.sqrt(i / 2)); k.scale.setScalar(0.65 + (i % 3) * 0.25); coals.add(k); } } scene.add(coals);

  // scanned surface textures
  const placeholder = new THREE.DataTexture(new Uint8Array([128, 120, 110, 255]), 1, 1), flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); placeholder.needsUpdate = flat.needsUpdate = true;
  const loader = new THREE.TextureLoader(), tex = { tRock: 'rock', tRockN: 'rock_n', tCliff: 'cliff', tCliffN: 'cliff_n', tBasalt: 'basalt', tGrass: 'grass', tSand: 'sand', tBark: 'bark', tLeafy: 'leafy', tForest: 'forest', tForestN: 'forest_n', tBoulder: 'boulder', tBoulderN: 'boulder_n', tCastle: 'castle', tCastleN: 'castle_n', tSlate: 'slate' };
  let texLeft = Object.keys(tex).length; const loaded = [];
  for (const [k, n] of Object.entries(tex)) { u[k].value = k.endsWith('N') ? flat : placeholder; loader.load(`/textures/${n}.jpg`, (t) => { if (dead) return t.dispose(); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (n.startsWith('boulder')) t.flipY = false; t.anisotropy = low ? 2 : 4; if (!k.endsWith('N')) t.colorSpace = THREE.SRGBColorSpace; u[k].value = t; loaded.push(t); texLeft--; request(); }, undefined, () => { texLeft--; request(); }); }

  // sun shadow map around the bird
  const SM = low ? 1024 : 1536, shadowRT = new THREE.WebGLRenderTarget(SM, SM, { depthTexture: new THREE.DepthTexture(SM, SM, THREE.UnsignedIntType) }), sun = new THREE.OrthographicCamera(-62, 62, 62, -62, 1, 420); sun.layers.set(1);
  shadowRT.depthTexture.minFilter = shadowRT.depthTexture.magFilter = THREE.NearestFilter; u.uShadow.value = shadowRT.depthTexture;
  const rockDepth = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: 'void main(){ gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.); }', fragmentShader: 'void main(){ gl_FragColor = vec4(1.); }' });
  let casters = []; const gather = () => { casters = []; scene.traverse((o) => { if (o.userData.depthMat && o.layers.isEnabled(1)) casters.push(o); }); };
  const rocksIn = () => { rocks.children.forEach((r) => { if (r.userData.small) return; r.userData.depthMat = rockDepth; r.layers.enable(1); }); gather(); }; rocks.userData.ready = rocksIn; cherry.userData.ready = gather; gather();
  // mountain-scale shadows: one small map over the whole valley, refreshed only when the sun moves
  const sunRT = new THREE.WebGLRenderTarget(192, 900, { depthBuffer: false }); u.uSunMap.value = sunRT.texture;
  const sunQuad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: u, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `precision highp float; varying vec2 vU; uniform vec3 uSunDir; ${HMAP} void main(){ float s = vU.x * 2. - 1., z = 1320. - vU.y * 4300., x = vcenter(z) + sign(s) * (90. * abs(s) + 560. * s * s); vec2 p = vec2(x, z); gl_FragColor = vec4(vec3(marchSun(vec3(x, hAt(p), z), uSunDir)), 1.); }` }));
  const sunWas = new THREE.Vector3();
  function renderSun() { if (sunWas.distanceToSquared(u.uSunDir.value) < 1e-6) return; sunWas.copy(u.uSunDir.value); u.uSunMap.value = null; renderer.setRenderTarget(sunRT); sunQuad.render(renderer); renderer.setRenderTarget(null); u.uSunMap.value = sunRT.texture; }
  function renderShadow(at) {
    sun.position.copy(u.uSunDir.value).multiplyScalar(200).add(at); sun.up.set(0, 1, 0); sun.lookAt(at); sun.updateMatrixWorld(); sun.updateProjectionMatrix();
    // snap to texels so shadows do not shimmer
    u.uShadowM.value.multiplyMatrices(sun.projectionMatrix, sun.matrixWorldInverse); const o = sv.set(0, 0, 0, 1).applyMatrix4(u.uShadowM.value), px = SM / 2; sun.projectionMatrix.elements[12] += (Math.round(o.x * px) - o.x * px) / px; sun.projectionMatrix.elements[13] += (Math.round(o.y * px) - o.y * px) / px; sun.projectionMatrixInverse.copy(sun.projectionMatrix).invert();
    u.uShadowM.value.multiplyMatrices(sun.projectionMatrix, sun.matrixWorldInverse);
    for (const c of casters) { c.userData.mat = c.material; c.material = c.userData.depthMat; }
    u.uShadow.value = null; renderer.setRenderTarget(shadowRT); renderer.clear(); renderer.render(scene, sun); renderer.setRenderTarget(null); u.uShadow.value = shadowRT.depthTexture;
    for (const c of casters) { c.material = c.userData.mat; }
  }
  let shadowTick = 0; const bornAt = performance.now();
  const sv = new THREE.Vector4();

  // scene goes to one multisampled buffer, resolved exactly once; a small blur pyramid makes the glow, and a single
  // full-screen pass adds it, the light shafts, the film grade, tone mapping and the output curve
  const half = { type: THREE.HalfFloatType, depthBuffer: false }, msaa = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, resolveDepthBuffer: false });
  const LV = 6, down = [...Array(LV)].map(() => new THREE.WebGLRenderTarget(4, 4, half)), up = [...Array(LV - 1)].map(() => new THREE.WebGLRenderTarget(4, 4, half)), FS = 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const pass = (uniforms, f) => new FullScreenQuad(new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, vertexShader: FS, fragmentShader: 'varying vec2 v; ' + f }));
  const pDown = pass({ t: { value: null }, px: { value: new THREE.Vector2() }, bright: { value: 0 } }, 'uniform sampler2D t; uniform vec2 px; uniform float bright; void main(){ vec3 c = (texture2D(t, v + px * vec2(-1.,-1.)).rgb + texture2D(t, v + px * vec2(1.,-1.)).rgb + texture2D(t, v + px * vec2(-1.,1.)).rgb + texture2D(t, v + px).rgb) * .125 + texture2D(t, v).rgb * .5; c = min(c, vec3(24.)); if (bright > .5) c *= smoothstep(1.15, 1.16, dot(c, vec3(.299,.587,.114))); gl_FragColor = vec4(c, 1.); }');
  const pUp = pass({ t: { value: null }, b: { value: null }, px: { value: new THREE.Vector2() } }, 'uniform sampler2D t, b; uniform vec2 px; void main(){ vec3 c = texture2D(b, v).rgb * .25 + (texture2D(b, v + vec2(px.x, 0.)).rgb + texture2D(b, v - vec2(px.x, 0.)).rgb + texture2D(b, v + vec2(0., px.y)).rgb + texture2D(b, v - vec2(0., px.y)).rgb) * .125 + (texture2D(b, v + px).rgb + texture2D(b, v - px).rgb + texture2D(b, v + vec2(px.x, -px.y)).rgb + texture2D(b, v + vec2(-px.x, px.y)).rgb) * .0625; gl_FragColor = vec4(texture2D(t, v).rgb + c, 1.); }');
  // light shafts from the sun and a gentle film grade
  const grade = new FullScreenQuad(new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: { tDiffuse: { value: msaa.texture }, tGlow: { value: up[0].texture }, tSmall: { value: down[0].texture }, uSun: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color() }, uAsp: { value: 1 }, uPx: { value: new THREE.Vector2(1, 1) }, uVeil: { value: 0 }, uT: { value: 0 }, uRush: { value: 0 }, tN: { value: u.tNoise.value }, uVeilC: { value: new THREE.Color() } }, vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `varying vec2 v; uniform sampler2D tDiffuse, tGlow, tSmall; uniform vec3 uSun, uCol; uniform vec2 uPx; uniform float uAsp, uVeil, uT, uRush; uniform sampler2D tN; uniform vec3 uVeilC;
      void main(){ vec3 c0 = texture2D(tDiffuse, v).rgb, nN = texture2D(tDiffuse, v + vec2(0., uPx.y)).rgb, nS = texture2D(tDiffuse, v - vec2(0., uPx.y)).rgb, nE = texture2D(tDiffuse, v + vec2(uPx.x, 0.)).rgb, nW = texture2D(tDiffuse, v - vec2(uPx.x, 0.)).rgb;
        vec3 c = clamp(c0 + (c0 - (nN + nS + nE + nW) * .25) * .42, min(c0, min(min(nN, nS), min(nE, nW))), max(c0, max(max(nN, nS), max(nE, nW)))); c += texture2D(tGlow, v).rgb * .18;
        if (uSun.z > .01) { vec2 d = (uSun.xy - v) / 14. * .82; float j = fract(52.98 * fract(dot(gl_FragCoord.xy, vec2(.0671, .00584)))); vec2 p = v + d * j; float s = 0., w = 1.; for (int i = 0; i < 14; i++) { if (p.x > 0. && p.x < 1. && p.y > 0. && p.y < 1.) { vec3 t = texture2D(tSmall, p).rgb; s += smoothstep(.55, 1.5, min(t.b * 1.35, min(t.r, t.g))) * w; } p += d; w *= .94; } float r = length((uSun.xy - v) * vec2(uAsp, 1.)); c += uCol * s * .0105 * uSun.z * smoothstep(1.5, .1, r); }
        if (uVeil > .004) { vec2 q = (v - .5) * vec2(uAsp, 1.); float n1 = texture2D(tN, q * .10 + vec2(uT * .004, uRush * .5)).r, n2 = texture2D(tN, q * .27 + vec2(-uT * .006, uRush * 1.1) + n1 * .12).r, n3 = texture2D(tN, q * vec2(.6, .34) + vec2(.3, uRush * 1.9)).r; float dn = n1 * .5 + n2 * .32 + n3 * .18; float a = smoothstep(0., 1., uVeil * 1.65 - (1. - smoothstep(.34, .62, dn)) * .62 * (1. - uVeil * .55)); c = mix(c, uVeilC * (.74 + .62 * smoothstep(.36, .62, dn)), clamp(a, 0., 1.)); }
        float l = dot(c, vec3(.2126,.7152,.0722)); c = mix(vec3(l), c, 1.10); c = pow(max(c, 0.), vec3(1.06)) * 1.06; c *= mix(vec3(.985,.995,1.02), vec3(1.02,1.,.975), smoothstep(.05, .9, l));
        vec2 q = v - .5; c *= 1. - dot(q, q) * .34; gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` })); grade.uniforms = grade.material.uniforms;
  const composer = { setSize(w, h) { msaa.setSize(w, h); for (let i = 0; i < LV; i++) { const k = 2 << i; down[i].setSize(Math.max(2, Math.round(w / k)), Math.max(2, Math.round(h / k))); if (i < LV - 1) up[i].setSize(down[i].width, down[i].height); } },
    render() { renderer.setRenderTarget(msaa); renderer.clear(); renderer.render(scene, camera); const D = pDown.material.uniforms, U = pUp.material.uniforms;
      for (let i = 0; i < LV; i++) { const src = i ? down[i - 1] : msaa; D.t.value = src.texture; D.px.value.set(1 / src.width, 1 / src.height); D.bright.value = i === 1 ? 1 : 0; renderer.setRenderTarget(down[i]); pDown.render(renderer); }
      for (let i = LV - 2; i >= 1; i--) { const b = i === LV - 2 ? down[LV - 1] : up[i + 1]; U.t.value = down[i].texture; U.b.value = b.texture; U.px.value.set(1 / b.width, 1 / b.height); renderer.setRenderTarget(up[i]); pUp.render(renderer); }
      grade.uniforms.tGlow.value = up[1].texture; renderer.setRenderTarget(null); grade.render(renderer); },
    dispose() { [msaa, ...down, ...up].forEach((t) => t.dispose()); [pDown, pUp, grade].forEach((q) => { q.material.dispose(); q.dispose(); }); } };

  // palette, parsed once; sun directions become world-space yaws
  const pal = STOPS.map((s, i) => { const C = (c) => new THREE.Color(c), yaw = heading(zOf(i)) + s.az * RAD + s.sun[0] * RAD, e = s.sun[1] * RAD;
    return { ...s, sunDir: new THREE.Vector3(Math.sin(yaw) * Math.cos(e), Math.sin(e), Math.cos(yaw) * Math.cos(e)), sunC: C(s.sunCol).multiplyScalar(s.sunI), zenith: C(s.zenith), horizon: C(s.horizon), sky: C(s.sky), ground: C(s.ground), fog: C(s.fog) }; });
  let targetP = 0, P = -1, W = 1, H = 1, frame = 0, last = performance.now(), time = 0, phase = 0, stop = -1, scrollAt = -1e9, restK = 0, rushY = 0;
  const foff = vec(), focus = vec();
  let mx = 0, my = 0, cmx = 0, cmy = 0, breath = 0, breathT = 0, think = 0, mode = 'idle', acc = 0, slow = 0, frames = 0, speed = 0;
  const camPos = vec(), a = vec(), b = vec(), c = vec(), phxPos = vec();

  function measure() {
    // each stop covers a span of the page: a point for most, the whole section for stops that hold
    const mid = window.innerHeight * 0.5, C = STOPS.map((s) => { const n = document.getElementById(s.id); if (!n) return [0, 0]; const r = n.getBoundingClientRect(), c = r.top + r.height / 2, h = s.hold ? Math.max(0, r.height / 2 - window.innerHeight * 0.32) : 0; return [c - h, c + h]; });
    let p = 0; const last = C.length - 1;
    if (mid >= C[last][0]) p = last; else for (let i = 0; i < last; i++) { if (mid >= C[i][0] && mid <= C[i][1]) { p = i; break; } if (mid > C[i][1] && mid < C[i + 1][0]) { p = i + (mid - C[i][1]) / (C[i + 1][0] - C[i][1]); break; } }
    targetP = p; if (reduced) request();
  }
  function resize() {
    W = el.clientWidth; H = el.clientHeight; if (!W || !H) return;
    renderer.setPixelRatio(dpr); renderer.setSize(W, H); composer.setSize(Math.round(W * dpr), Math.round(H * dpr)); grade.uniforms.uPx.value.set(1 / (W * dpr), 1 / (H * dpr));
    camera.aspect = W / H; measure();
  }

  function spawn(dt) {
    const rest = bird.rest;
    acc += dt * (low ? 240 : 430) * (0.6 + speed * 0.4 + think * 0.8) * (1 - rest * 0.72); const back = c.set(0, 0, -1).applyQuaternion(phx.group.quaternion);
    while (acc > 1) { acc--; const r = Math.random();
      if (r < 0.42 && bird.fold < 0.6) phx.wingPoint(Math.random() < 0.5 ? 1 : -1, 2.6 + Math.random() * 3.1, -0.5 - Math.random() * 1.5, a); else phx.tailPoint(a);
      const spark = Math.random() < 0.22 + rest * 0.5; b.copy(back).multiplyScalar((3 + Math.random() * 4) * (1 - rest)).add({ x: (Math.random() - 0.5) * 0.9, y: (Math.random() - 0.3) * 0.9, z: (Math.random() - 0.5) * 0.9 });
      fire.emit(a, b, spark ? 1 + Math.random() * 1.6 : 0.3 + Math.random() * 0.45, spark ? 0.06 : 0.18 + Math.random() * 0.28, spark ? 1 : 0); }
    if (bird.eat > 0.2 && Math.random() < dt * (6 + bird.peck * 50)) { a.copy(coals.position); fire.emit(a, b.set((Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.4, (Math.random() - 0.5) * 1.5), 0.8, 0.05, 1); }
    if (breath > 0.15) { phx.beak(a); phx.forward(b); const n = Math.ceil(dt * (low ? 90 : 170));
      for (let i = 0; i < n; i++) { const sp = Math.random() < 0.14, s = 10 + Math.random() * 6; c.copy(b).multiplyScalar(s).add({ x: (Math.random() - 0.5) * 2.2, y: (Math.random() - 0.5) * 2.2, z: (Math.random() - 0.5) * 2.2 });
        fire.emit(a, c, sp ? 1.6 : 0.5 + Math.random() * 0.6, sp ? 0.08 : (0.14 + Math.random() * 0.3) * breath, sp ? 1 : 0); } }
    const vd = smooth(LAB - 0.6, LAB - 0.3, P) * (1 - smooth(LAB + 1.6, LAB + 2, P)); // lava fountain
    for (let k = vd * dt * (low ? 25 : 60) + Math.random() * 0.999 * (vd > 0 ? 1 : 0); k >= 1; k--) { a.copy(smoke.userData.vent); a.x += (Math.random() - 0.5) * 10; a.z += (Math.random() - 0.5) * 10; const sp = Math.random() < 0.4; fire.emit(a, b.set((Math.random() - 0.5) * 24, 24 + Math.random() * 34, (Math.random() - 0.5) * 24), sp ? 2.6 + Math.random() : 1.4 + Math.random() * 0.9, sp ? 0.9 : 3.2 + Math.random() * 4, sp ? 1 : 0); }
    const hot = smooth(LAB - 0.4, LAB, P) * (1 - smooth(LAB + 1.3, LAB + 1.9, P));
    if (Math.random() < hot * dt * 40) { a.copy(camera.position).add({ x: (Math.random() - 0.5) * 40, y: -10 + Math.random() * 14, z: (Math.random() - 0.5) * 40 }); fire.emit(a, b.set((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2), 4, 0.1, 1); }
    fire.flush();
  }

  function update(dt, now) {
    if (P < 0 || reduced) P = targetP; else P += (targetP - P) * (1 - Math.exp(-dt * 1.75 * bird.align()));
    const i = Math.min(STOPS.length - 2, Math.floor(P)), f = P - i, e = f * f * f * (f * (f * 6 - 15) + 10), A = pal[i], B = pal[i + 1], altE = smooth(0, 1, f), mixN = (k) => lerp(A[k], B[k], k === 'alt' ? altE : e);
    const hover = mixN('hover'), yaw0 = heading(zOf(P)), tall = W / H < 0.8, sxRaw = mixN('sx');
    const ang = yaw0 + Math.PI + mixN('az') * RAD + cmx * 0.16, camYaw = Math.atan2(Math.sin(ang), Math.cos(ang));
    if (!reduced) bird.step(dt, time, { P, targetP, alt: mixN('alt'), hover, scrolling: now - scrollAt < 160, camYaw, faceSign: sxRaw >= 0 ? -1 : 1 });
    else { bird.pos.set(center(zOf(P)), mixN('alt'), zOf(P)); bird.base.copy(bird.pos); bird.yaw = yaw0; bird.S = 0; }
    speed = bird.speed; if (bird.event) { const [k, p] = bird.event; bird.event = null; isles.userData.burst(k === 'in' ? 0 : 1, p, k === 'in' ? 0.75 : 1.35); if (k === 'out') for (let i = 0; i < (low ? 120 : 420); i++) { const an = Math.random() * 6.28, sp = Math.random(); b.set(Math.cos(an) * (2 + 9 * sp), 5 + Math.random() * 16, Math.sin(an) * (2 + 9 * sp)); fire.emit(a.copy(p), b, 0.8 + Math.random() * 1.6, Math.random() < 0.5 ? 0.09 : 0.35 + Math.random() * 0.5, Math.random() < 0.5 ? 1 : 0); } }
    u.uTime.value = time; u.uSunDir.value.copy(A.sunDir).lerp(B.sunDir, e).normalize(); u.uSunCol.value.copy(A.sunC).lerp(B.sunC, e);
    u.uSky.value.copy(A.sky).lerp(B.sky, e); u.uGround.value.copy(A.ground).lerp(B.ground, e); u.uFog.value.copy(A.fog).lerp(B.fog, e); u.uZenith.value.copy(A.zenith).lerp(B.zenith, e); u.uHorizon.value.copy(A.horizon).lerp(B.horizon, e);
    u.uDen.value = mixN('den') * (1 + 0.85 * Math.pow(Math.sin(Math.PI * f), 2) * (1 - smooth(150, 260, mixN('alt')))) * (1 + 1.9 * smooth(60, 190, mixN('alt')) * (1 - smooth(335, 385, mixN('alt')))); u.uNight.value = mixN('night'); u.uAurora.value = lerp(A.aurora || 0, B.aurora || 0, e); u.uCloud.value = mixN('cloud');

    // bird
    think = lerp(think, mode === 'thinking' ? 1 : 0, 1 - Math.exp(-dt * 4));
    if (breathT > 0) breathT -= dt; breath = reduced ? 0 : lerp(breath, breathT > 0 || bird.fire ? 1 : 0, 1 - Math.exp(-dt * 5));
    phxPos.copy(bird.pos); phase += dt * (bird.flap + think * 1.5);
    const bob = bird.amp * 0.22 * (1 - bird.rest) * Math.sin(phase); phx.group.position.copy(phxPos); phx.group.position.y -= bob + bird.crouch + bird.eat * 0.12; phx.group.rotation.set(bird.pitch, bird.yaw, bird.bank);
    const ps = phx.pose; ps.uPhase.value = reduced ? 0.6 : phase; ps.uAmp.value = bird.amp; ps.uTail.value = bird.tail; ps.uFold.value = bird.fold; ps.uLift.value = bird.lift;
    ps.uNeck.value = bird.neck + hover * (0.62 - breath * 0.12) + think * -0.18; ps.uNeckYaw.value = bird.neckYaw + hover * lerp(Math.sin(time * 0.5) * 0.12 + cmx * 0.35, 1.3, breath);
    ps.uHeat.value = 0.3 + think * 0.9 + breath * 0.9 + (bird.glow || 0) * 1.1; phx.jaw.rotation.x = breath * 0.5 + think * 0.1 + bird.peck * 0.25; phx.mouth.material.opacity = Math.max(breath, think * 0.6); phx.update();
    const stand = Math.max(bird.stand, bird.rest); for (const l of phx.legs) l.rotation.x = lerp(1.42, -bird.pitch - bird.crouch * 0.5, stand);
    phx.group.updateMatrixWorld(true);
    coals.visible = bird.eat > 0.02 && !!bird.perch; if (coals.visible) { coals.position.set(bird.perch.x + Math.sin(bird.yaw) * 0.9, bird.perch.y - 0.2, bird.perch.z + Math.cos(bird.yaw) * 0.9); coals.scale.setScalar(Math.max(0.01, bird.eat)); }
    u.uPhx.value.copy(phxPos); u.uPhxI.value = ((0.35 + u.uNight.value * 0.75) * (0.9 + 0.1 * Math.sin(time * 7) * Math.sin(time * 4.3)) + think * 0.5) * (1 - bird.rest * 0.75) + breath * 0.8;

    // camera orbits the bird; the view is shifted sideways so panels never cover it
    cmx = lerp(cmx, mx, 1 - Math.exp(-dt * 2.5)); cmy = lerp(cmy, my, 1 - Math.exp(-dt * 2.5));
    const restT = bird.state === 'land' || bird.state === 'perch' ? 1 : bird.state === 'cine' ? 0.12 + 0.88 * smooth(7, 9, bird.cineT || 0) : 0; restK = lerp(restK, restT, 1 - Math.exp(-dt * 1.5));
    a.copy(bird.offset).multiplyScalar(1 - 0.3 * (bird.S || 0)); if (bird.state === 'cine' && bird.perch) { const k = smooth(7, 8.8, bird.cineT || 0); b.set(bird.perch.x, bird.perch.y + 1.5 + 4 * smooth(4.2, 5.6, bird.cineT) * (1 - k), bird.perch.z).sub(bird.base); a.lerp(b, 1 - 0.03 * (1 - k)); } foff.lerp(a, 1 - Math.exp(-dt * 3.2)); focus.copy(bird.base).add(foff);
    const lowK = smooth(0.04, 0.12, -mixN('sy')), dist = mixN('dist') * lerp(1, lerp(0.74, 1.08, lowK), restK) * (tall ? 1.75 : W / H < 1.2 ? 1.3 : 1);
    camPos.set(focus.x + Math.sin(ang) * dist, focus.y + lerp(mixN('up'), STOPS[Math.round(P)].tag === 'isles' ? 0.2 : 1.1, restK) - cmy * 1.6, focus.z + Math.cos(ang) * dist);
    const floor = height(camPos.x, camPos.z) + 2.2; camPos.y = Math.max(camPos.y, floor, 2); camera.position.copy(camPos); camera.lookAt(a.copy(focus));
    const sx = tall ? 0 : sxRaw * (W / H < 1.2 ? 0.6 : 1), gorge = Math.max(0, 1 - Math.abs(P - at('labs')) / 0.62), sy = tall ? -0.26 : mixN('sy') - lowK * restK * 0.05 + smooth(0, 0.55, gorge) * (1 - restK) * 0.09;
    camera.setViewOffset(W, H, -sx * W, -sy * H, W, H);
    trees.userData.lod(camPos.z); rocks.userData.lod(camPos.z); terrain.userData.lod(camPos.z);
    // above the clouds the valley is hidden, and far-off set pieces are skipped
    const high = smooth(330, 390, camPos.y); u.uHigh.value = high; for (const o of valley) o.visible = camPos.y < 395; isles.visible = camPos.y > 312; cherry.visible = Math.abs(camPos.z) < 420 && camPos.y < 200; falls.visible = Math.abs(camPos.z + 258) < 1000 && camPos.y < 200; if (falls.visible) { const near = Math.abs(camPos.z + 258) < 260; for (const o of falls.children) if (o.renderOrder >= 2) o.visible = near; } smoke.visible = camPos.y < 395;
    u.uEmber.value = smooth(at('interests') - 0.2, at('interests') + 0.15, P) * 0.22 + smooth(at('interests') + 0.05, at('interests') + 0.6, P) * 0.78 * (1 - smooth(LAB - 0.15, LAB, P) * 0.9);
    grade.uniforms.uT.value = time; grade.uniforms.uRush.value += (bird.pos.y - rushY) * 0.012; rushY = bird.pos.y;
    grade.uniforms.uVeil.value = Math.exp(-Math.pow((camPos.y - 345) / 66, 2)); grade.uniforms.uVeilC.value.copy(u.uFog.value).lerp(u.uSky.value, 0.4).multiplyScalar(0.9); grade.uniforms.uVeilC.value.r += u.uEmber.value * 0.16; grade.uniforms.uVeilC.value.g += u.uEmber.value * 0.035;
    u.uSwirl.value = lerp(u.uSwirl.value, bird.state === 'perch' ? Math.max(bird.lift, 1 - bird.fold) : bird.state === 'fly' ? 0.35 : 1, 1 - Math.exp(-dt * 1.5));
    camera.updateMatrixWorld(); a.copy(u.uSunDir.value).multiplyScalar(1000).add(camera.position).project(camera); const facing = camera.getWorldDirection(b).dot(u.uSunDir.value);
    grade.uniforms.uSun.value.set(a.x * 0.5 + 0.5, a.y * 0.5 + 0.5, smooth(0.35, 0.75, facing)); grade.uniforms.uCol.value.copy(u.uSunCol.value); grade.uniforms.uAsp.value = W / H;

    if (!reduced) spawn(dt);
    const s = Math.round(targetP); if (s !== stop) { stop = s; onStop?.(s); }
  }

  function draw(now) {
    frame = 0; if (dead) return;
    const raw = (now - last) / 1000, dt = Math.min(0.05, Math.max(0.001, raw)); last = now; if (!reduced) time += dt;
    update(dt, now); if (isles.visible) isles.userData.shadow(renderer, pal[at('interests')].sunDir); renderSun(); if (falls.visible) falls.userData.shadow(renderer, u.uSunDir.value); if (reduced || (shadowTick = (shadowTick + 1) % (bird.state === 'fly' || bird.state === 'perch' ? 3 : 2)) === 0) renderShadow(phxPos); composer.render();
    if (texLeft <= 0 && flora.left() <= 0) el.classList.add('ready');
    // step resolution down on slow machines
    if (!reduced && !document.hidden && raw < 0.5 && now > bornAt + 3000) { frames++; if (raw > 0.0235) slow++; if (frames >= 60) { if (slow > 40 && dpr > 0.85) { dpr = Math.max(0.85, dpr - 0.13); resize(); } frames = slow = 0; } }
    if (!reduced && !document.hidden) request();
  }
  function request() { if (!frame && !dead) frame = requestAnimationFrame(draw); }
  const onPointer = (ev) => { if (ev.pointerType === 'touch') return; mx = ev.clientX / window.innerWidth * 2 - 1; my = ev.clientY / window.innerHeight * 2 - 1; };
  const onVis = () => { last = performance.now(); if (!document.hidden) request(); };
  const onPhoenix = (ev) => { mode = ev.detail.state; if (mode === 'speaking') breathT = Math.min(6, ev.detail.seconds || 3); };
  const ro = new ResizeObserver(() => { resize(); request(); }); ro.observe(el); ro.observe(document.body);
  const onScroll = () => { scrollAt = performance.now(); measure(); };
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVis); window.addEventListener('phoenix', onPhoenix);
  el.appendChild(renderer.domElement); resize(); request();

  return () => { dead = true; cancelAnimationFrame(frame); ro.disconnect(); window.removeEventListener('scroll', onScroll); window.removeEventListener('pointermove', onPointer); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('phoenix', onPhoenix);
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); shadowRT.dispose(); sunRT.dispose(); sunQuad.material.dispose(); sunQuad.dispose(); loaded.forEach((t) => t.dispose()); u.uHMap.value?.dispose(); casters.forEach((c) => c.userData.depthMat.dispose()); flora.dispose(); rocks.userData.stop(); cherry.userData.stop(); grass.userData.stop(); isles.userData.stop(); falls.userData.stop(); composer.dispose(); renderer.dispose(); renderer.domElement.remove(); el.classList.remove('ready'); };
}
