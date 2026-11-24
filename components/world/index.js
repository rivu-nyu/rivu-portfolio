import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { shared, HMAP, lerp, smooth, noise } from './common';
import { STOPS, STOP_GAP } from './stops';
import { createTerrain, createWater, createTrees, createRocks, createGrass, createPerches, center, height } from './landscape';
import { createSky, createMist, createSmoke } from './sky';
import { createBehaviour, heading } from './behaviour';
import { createPhoenix } from './phoenix';
import { createFire } from './fire';

const RAD = Math.PI / 180, vec = () => new THREE.Vector3();

export function createWorld(el, { reduced = false, onStop } = {}) {
  let dead = false;
  const small = window.innerWidth < 800, low = small || (navigator.hardwareConcurrency || 8) < 5;
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  let dpr = Math.min(window.devicePixelRatio, low ? 1.1 : 1.25);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  const u = shared(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2600);
  const phx = createPhoenix(u), fire = createFire(u, low ? 1300 : 3000);
  phx.group.rotation.order = 'YXZ';
  const terrain = createTerrain(u, low), perches = createPerches(), trees = createTrees(u, low, perches), rocks = createRocks(u, low, perches), bird = createBehaviour(perches);
  const smoke = createSmoke(u); rocks.children[0].layers.enable(1);
  scene.add(createSky(u), terrain, createWater(u), trees, rocks, createGrass(u, low), createMist(u, low), smoke, phx.group, fire.mesh);

  // embers the bird feeds on
  const coals = new THREE.Group(); { const g = new THREE.IcosahedronGeometry(0.1, 1), m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.3, 0.03) }), m2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.07, 0.01) }); for (let i = 0; i < 7; i++) { const k = new THREE.Mesh(g, i % 2 ? m : m2); k.position.set(Math.sin(i * 2.4) * 0.17 * Math.sqrt(i / 2), 0.07, Math.cos(i * 2.4) * 0.17 * Math.sqrt(i / 2)); k.scale.setScalar(0.65 + (i % 3) * 0.25); coals.add(k); } } scene.add(coals);

  // scanned surface textures
  const placeholder = new THREE.DataTexture(new Uint8Array([128, 120, 110, 255]), 1, 1), flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); placeholder.needsUpdate = flat.needsUpdate = true;
  const loader = new THREE.TextureLoader(), tex = { tRock: 'rock', tRockN: 'rock_n', tCliff: 'cliff', tCliffN: 'cliff_n', tBasalt: 'basalt', tGrass: 'grass', tSand: 'sand' };
  let texLeft = Object.keys(tex).length; const loaded = [];
  for (const [k, n] of Object.entries(tex)) { u[k].value = k.endsWith('N') ? flat : placeholder; loader.load(`/textures/${n}.jpg`, (t) => { if (dead) return t.dispose(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = low ? 2 : 4; if (!k.endsWith('N')) t.colorSpace = THREE.SRGBColorSpace; u[k].value = t; loaded.push(t); texLeft--; request(); }, undefined, () => { texLeft--; request(); }); }

  // sun shadow map around the bird
  const SM = low ? 1024 : 2048, shadowRT = new THREE.WebGLRenderTarget(SM, SM, { depthTexture: new THREE.DepthTexture(SM, SM, THREE.UnsignedIntType) }), sun = new THREE.OrthographicCamera(-62, 62, 62, -62, 1, 420); sun.layers.set(1);
  shadowRT.depthTexture.minFilter = shadowRT.depthTexture.magFilter = THREE.NearestFilter; u.uShadow.value = shadowRT.depthTexture;
  const rockDepth = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: 'void main(){ gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.); }', fragmentShader: 'void main(){ gl_FragColor = vec4(1.); }' });
  rocks.children.forEach((r) => { r.userData.depthMat = rockDepth; r.layers.enable(1); });
  const casters = []; scene.traverse((o) => { if (o.userData.depthMat) casters.push(o); });
  // mountain-scale shadows: one small map over the whole valley, refreshed only when the sun moves
  const sunRT = new THREE.WebGLRenderTarget(192, 900, { depthBuffer: false }); u.uSunMap.value = sunRT.texture;
  const sunQuad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: u, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `precision highp float; varying vec2 vU; uniform vec3 uSunDir; ${HMAP} void main(){ float s = vU.x * 2. - 1., z = 720. - vU.y * 3700., x = vcenter(z) + sign(s) * (90. * abs(s) + 560. * s * s); vec2 p = vec2(x, z); gl_FragColor = vec4(vec3(marchSun(vec3(x, hAt(p), z), uSunDir)), 1.); }` }));
  const sunWas = new THREE.Vector3();
  function renderSun() { if (sunWas.distanceToSquared(u.uSunDir.value) < 1e-6) return; sunWas.copy(u.uSunDir.value); u.uSunMap.value = null; renderer.setRenderTarget(sunRT); sunQuad.render(renderer); renderer.setRenderTarget(null); u.uSunMap.value = sunRT.texture; }
  function renderShadow(at) {
    sun.position.copy(u.uSunDir.value).multiplyScalar(200).add(at); sun.up.set(0, 1, 0); sun.lookAt(at); sun.updateMatrixWorld(); sun.updateProjectionMatrix();
    // snap to texels so shadows do not shimmer
    u.uShadowM.value.multiplyMatrices(sun.projectionMatrix, sun.matrixWorldInverse); const o = sv.set(0, 0, 0, 1).applyMatrix4(u.uShadowM.value), px = SM / 2; sun.projectionMatrix.elements[12] += (Math.round(o.x * px) - o.x * px) / px; sun.projectionMatrix.elements[13] += (Math.round(o.y * px) - o.y * px) / px; sun.projectionMatrixInverse.copy(sun.projectionMatrix).invert();
    u.uShadowM.value.multiplyMatrices(sun.projectionMatrix, sun.matrixWorldInverse);
    for (const c of casters) { c.userData.mat = c.material; c.material = c.userData.depthMat; if (c.parent === trees) { c.userData.geo = c.geometry; c.geometry = trees.userData.shadowGeo; } }
    u.uShadow.value = null; renderer.setRenderTarget(shadowRT); renderer.clear(); renderer.render(scene, sun); renderer.setRenderTarget(null); u.uShadow.value = shadowRT.depthTexture;
    for (const c of casters) { c.material = c.userData.mat; if (c.parent === trees) c.geometry = c.userData.geo; }
  }
  let shadowTick = 0; const bornAt = performance.now();
  const sv = new THREE.Vector4();

  // scene goes to one multisampled buffer, resolved exactly once; bloom and tone mapping run on plain buffers
  const msaa = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4, resolveDepthBuffer: false });
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false })), bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 1.15);
  class ScenePass extends Pass {
    constructor() { super(); this.needsSwap = false; this.copy = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { t: { value: msaa.texture } }, depthTest: false, depthWrite: false, vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: 'varying vec2 v; uniform sampler2D t; void main(){ gl_FragColor = vec4(texture2D(t, v).rgb, 1.); }' })); }
    setSize(w, h) { msaa.setSize(w, h); }
    render(r, _w, read) { r.setRenderTarget(msaa); r.clear(); r.render(scene, camera); r.setRenderTarget(read); this.copy.render(r); }
    dispose() { msaa.dispose(); this.copy.material.dispose(); this.copy.dispose(); }
  }
  composer.addPass(new ScenePass()); composer.addPass(bloom); composer.addPass(new OutputPass());

  // palette, parsed once; sun directions become world-space yaws
  const pal = STOPS.map((s, i) => { const C = (c) => new THREE.Color(c), yaw = heading(-i * STOP_GAP) + s.az * RAD + s.sun[0] * RAD, e = s.sun[1] * RAD;
    return { ...s, sunDir: new THREE.Vector3(Math.sin(yaw) * Math.cos(e), Math.sin(e), Math.cos(yaw) * Math.cos(e)), sunC: C(s.sunCol).multiplyScalar(s.sunI), zenith: C(s.zenith), horizon: C(s.horizon), sky: C(s.sky), ground: C(s.ground), fog: C(s.fog) }; });
  let targetP = 0, P = -1, W = 1, H = 1, frame = 0, last = performance.now(), time = 0, phase = 0, stop = -1, scrollAt = -1e9, restK = 0;
  const foff = vec(), focus = vec();
  let mx = 0, my = 0, cmx = 0, cmy = 0, breath = 0, breathT = 0, think = 0, mode = 'idle', acc = 0, slow = 0, frames = 0, speed = 0;
  const camPos = vec(), a = vec(), b = vec(), c = vec(), phxPos = vec();

  function measure() {
    const mid = window.innerHeight * 0.5, C = STOPS.map((s) => { const n = document.getElementById(s.id); if (!n) return 0; const r = n.getBoundingClientRect(); return r.top + r.height / 2; });
    let p = 0;
    if (mid >= C[C.length - 1]) p = C.length - 1; else for (let i = 0; i < C.length - 1; i++) if (mid >= C[i] && mid < C[i + 1]) { p = i + (mid - C[i]) / (C[i + 1] - C[i]); break; }
    targetP = p; if (reduced) request();
  }
  function resize() {
    W = el.clientWidth; H = el.clientHeight; if (!W || !H) return;
    renderer.setPixelRatio(dpr); renderer.setSize(W, H); composer.setPixelRatio(dpr); composer.setSize(W, H); bloom.setSize(W * dpr * 0.5, H * dpr * 0.5);
    camera.aspect = W / H; measure();
  }

  function spawn(dt) {
    const rest = bird.rest;
    acc += dt * (low ? 260 : 620) * (0.6 + speed * 0.4 + think * 0.8) * (1 - rest * 0.9); const back = c.set(0, 0, -1).applyQuaternion(phx.group.quaternion);
    while (acc > 1) { acc--; const r = Math.random();
      if (r < 0.42 && bird.fold < 0.3) phx.wingPoint(Math.random() < 0.5 ? 1 : -1, 2.6 + Math.random() * 3.1, -0.5 - Math.random() * 1.5, a); else phx.tailPoint(a);
      const spark = Math.random() < 0.22 + rest * 0.5; b.copy(back).multiplyScalar((3 + Math.random() * 4) * (1 - rest)).add({ x: (Math.random() - 0.5) * 0.9, y: (Math.random() - 0.3) * 0.9, z: (Math.random() - 0.5) * 0.9 });
      fire.emit(a, b, spark ? 1 + Math.random() * 1.6 : 0.3 + Math.random() * 0.45, spark ? 0.06 : 0.16 + Math.random() * 0.26, spark ? 1 : 0); }
    if (bird.eat > 0.2 && Math.random() < dt * (6 + bird.peck * 50)) { a.copy(coals.position); fire.emit(a, b.set((Math.random() - 0.5) * 1.5, 1 + Math.random() * 1.4, (Math.random() - 0.5) * 1.5), 0.8, 0.05, 1); }
    if (breath > 0.15) { phx.beak(a); phx.forward(b); const n = Math.ceil(dt * (low ? 90 : 170));
      for (let i = 0; i < n; i++) { const sp = Math.random() < 0.14, s = 10 + Math.random() * 6; c.copy(b).multiplyScalar(s).add({ x: (Math.random() - 0.5) * 2.2, y: (Math.random() - 0.5) * 2.2, z: (Math.random() - 0.5) * 2.2 });
        fire.emit(a, c, sp ? 1.6 : 0.5 + Math.random() * 0.6, sp ? 0.08 : (0.14 + Math.random() * 0.3) * breath, sp ? 1 : 0); } }
    const vd = smooth(4.35, 4.7, P) * (1 - smooth(6.6, 7, P)); // lava fountain
    for (let k = vd * dt * (low ? 25 : 60) + Math.random() * 0.999 * (vd > 0 ? 1 : 0); k >= 1; k--) { a.copy(smoke.userData.vent); a.x += (Math.random() - 0.5) * 10; a.z += (Math.random() - 0.5) * 10; const sp = Math.random() < 0.4; fire.emit(a, b.set((Math.random() - 0.5) * 24, 24 + Math.random() * 34, (Math.random() - 0.5) * 24), sp ? 2.6 + Math.random() : 1.4 + Math.random() * 0.9, sp ? 0.9 : 3.2 + Math.random() * 4, sp ? 1 : 0); }
    const hot = smooth(4.3, 5, P) * (1 - smooth(6.3, 6.9, P));
    if (Math.random() < hot * dt * 40) { a.copy(camera.position).add({ x: (Math.random() - 0.5) * 40, y: -10 + Math.random() * 14, z: (Math.random() - 0.5) * 40 }); fire.emit(a, b.set((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2), 4, 0.1, 1); }
    fire.flush();
  }

  function update(dt, now) {
    if (P < 0 || reduced) P = targetP; else P += (targetP - P) * (1 - Math.exp(-dt * 2.6 * bird.align()));
    const i = Math.min(STOPS.length - 2, Math.floor(P)), f = P - i, e = smooth(0, 1, f), A = pal[i], B = pal[i + 1], mixN = (k) => lerp(A[k], B[k], e);
    const hover = mixN('hover'), yaw0 = heading(-P * STOP_GAP), tall = W / H < 0.8, sxRaw = mixN('sx');
    const ang = yaw0 + Math.PI + mixN('az') * RAD + cmx * 0.16, camYaw = Math.atan2(Math.sin(ang), Math.cos(ang));
    if (!reduced) bird.step(dt, time, { P, targetP, alt: mixN('alt'), hover, scrolling: now - scrollAt < 160, camYaw, faceSign: sxRaw >= 0 ? -1 : 1 });
    else { bird.pos.set(center(-P * STOP_GAP) * 0.9, mixN('alt'), -P * STOP_GAP); bird.base.copy(bird.pos); bird.yaw = yaw0; bird.S = 0; }
    speed = bird.speed;
    u.uTime.value = time; u.uSunDir.value.copy(A.sunDir).lerp(B.sunDir, e).normalize(); u.uSunCol.value.copy(A.sunC).lerp(B.sunC, e);
    u.uSky.value.copy(A.sky).lerp(B.sky, e); u.uGround.value.copy(A.ground).lerp(B.ground, e); u.uFog.value.copy(A.fog).lerp(B.fog, e); u.uZenith.value.copy(A.zenith).lerp(B.zenith, e); u.uHorizon.value.copy(A.horizon).lerp(B.horizon, e);
    u.uDen.value = mixN('den'); u.uNight.value = mixN('night'); u.uCloud.value = mixN('cloud');

    // bird
    think = lerp(think, mode === 'thinking' ? 1 : 0, 1 - Math.exp(-dt * 4));
    if (breathT > 0) breathT -= dt; breath = reduced ? 0 : lerp(breath, breathT > 0 || bird.fire ? 1 : 0, 1 - Math.exp(-dt * 5));
    phxPos.copy(bird.pos); phase += dt * (bird.flap + think * 1.5);
    const bob = bird.amp * 0.22 * (1 - bird.rest) * Math.sin(phase); phx.group.position.copy(phxPos); phx.group.position.y -= bob + bird.crouch + bird.eat * 0.12; phx.group.rotation.set(bird.pitch, bird.yaw, bird.bank);
    const ps = phx.pose; ps.uPhase.value = reduced ? 0.6 : phase; ps.uAmp.value = bird.amp; ps.uTail.value = bird.tail; ps.uFold.value = bird.fold; ps.uLift.value = bird.lift;
    ps.uNeck.value = bird.neck + hover * (0.62 - breath * 0.12) + think * -0.18; ps.uNeckYaw.value = bird.neckYaw + hover * lerp(Math.sin(time * 0.5) * 0.12 + cmx * 0.35, 1.3, breath);
    ps.uHeat.value = 0.3 + think * 0.9 + breath * 0.9; phx.jaw.rotation.x = breath * 0.5 + think * 0.1 + bird.peck * 0.25; phx.mouth.material.opacity = Math.max(breath, think * 0.6); phx.update();
    const stand = Math.max(bird.stand, bird.rest); for (const l of phx.legs) l.rotation.x = lerp(1.42, -bird.pitch - bird.crouch * 0.5, stand);
    phx.group.updateMatrixWorld(true);
    coals.visible = bird.eat > 0.02 && !!bird.perch; if (coals.visible) { coals.position.set(bird.perch.x + Math.sin(bird.yaw) * 0.9, bird.perch.y - 0.2, bird.perch.z + Math.cos(bird.yaw) * 0.9); coals.scale.setScalar(Math.max(0.01, bird.eat)); }
    u.uPhx.value.copy(phxPos); u.uPhxI.value = ((0.35 + u.uNight.value * 0.75) * (0.9 + 0.1 * Math.sin(time * 7) * Math.sin(time * 4.3)) + think * 0.5) * (1 - bird.rest * 0.75) + breath * 0.8;

    // camera orbits the bird; the view is shifted sideways so panels never cover it
    cmx = lerp(cmx, mx, 1 - Math.exp(-dt * 2.5)); cmy = lerp(cmy, my, 1 - Math.exp(-dt * 2.5));
    const restT = bird.state === 'land' || bird.state === 'perch' ? 1 : 0; restK = lerp(restK, restT, 1 - Math.exp(-dt * 1.5));
    a.copy(bird.offset).multiplyScalar(1 - 0.3 * (bird.S || 0)); foff.lerp(a, 1 - Math.exp(-dt * 3.2)); focus.copy(bird.base).add(foff);
    const lowK = smooth(0.04, 0.12, -mixN('sy')), dist = mixN('dist') * lerp(1, lerp(0.74, 1.08, lowK), restK) * (tall ? 1.75 : W / H < 1.2 ? 1.3 : 1);
    camPos.set(focus.x + Math.sin(ang) * dist, focus.y + lerp(mixN('up'), 1.1, restK) - cmy * 1.6, focus.z + Math.cos(ang) * dist);
    const floor = height(camPos.x, camPos.z) + 2.2; camPos.y = Math.max(camPos.y, floor, 2); camera.position.copy(camPos); camera.lookAt(a.copy(focus));
    const sx = tall ? 0 : sxRaw * (W / H < 1.2 ? 0.6 : 1), sy = tall ? -0.26 : mixN('sy') - lowK * restK * 0.05;
    camera.setViewOffset(W, H, -sx * W, -sy * H, W, H);
    trees.userData.lod(camPos.z);

    if (!reduced) spawn(dt);
    const s = Math.round(targetP); if (s !== stop) { stop = s; onStop?.(s); }
  }

  function draw(now) {
    frame = 0; if (dead) return;
    const raw = (now - last) / 1000, dt = Math.min(0.05, Math.max(0.001, raw)); last = now; if (!reduced) time += dt;
    update(dt, now); renderSun(); if ((shadowTick ^= 1) || reduced) renderShadow(phxPos); composer.render();
    if (texLeft <= 0) el.classList.add('ready');
    // step resolution down on slow machines
    if (!reduced && !document.hidden && raw < 0.5 && now > bornAt + 3000) { frames++; if (raw > 0.030) slow++; if (frames >= 90) { if (slow > 55 && dpr > 0.9) { dpr = Math.max(0.9, dpr - 0.2); resize(); } frames = slow = 0; } }
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
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); shadowRT.dispose(); sunRT.dispose(); sunQuad.material.dispose(); sunQuad.dispose(); loaded.forEach((t) => t.dispose()); u.uHMap.value?.dispose(); casters.forEach((c) => c.userData.depthMat.dispose()); trees.userData.extra.forEach((x) => x.dispose()); composer.passes.forEach((p) => p.dispose?.()); composer.dispose(); renderer.dispose(); renderer.domElement.remove(); el.classList.remove('ready'); };
}
