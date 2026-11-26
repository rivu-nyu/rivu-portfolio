import * as THREE from 'three';
import { GLSL } from './common';

// Flame licks: instanced quads stretched along their on-screen velocity, kept in a ring buffer.
export function createFire(u, N) {
  const geo = new THREE.InstancedBufferGeometry(); geo.instanceCount = N;
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
  const A = (n, s) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(N * s), s); a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute(n, a); return a; };
  const pos = A('aPos', 3), vel = A('aVel', 3), inf = A('aInf', 4); // birth, life, size, kind (0 flame, 1 spark)
  inf.array.fill(-100);
  const mat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime, uSea; attribute vec3 aPos, aVel; attribute vec4 aInf; varying float vA, vK, vS; varying vec2 vQ;
      void main(){ float age = uTime - aInf.x; vA = age / max(aInf.y, .01); vK = aInf.w; vS = fract(aInf.x * 17.31 + aPos.x * 3.1); vQ = position.xy;
        float d = (1. - exp(-1.5 * age)) / 1.5; vec3 p = aPos + aVel * d; p.y += age * age * mix(.6, .3, vK) + uSea * age * 2.2;
        p += vec3(sin(age * 5. + vS * 40.), cos(age * 4. + vS * 30.), sin(age * 4.5 + vS * 20.)) * .12 * age * (1. + vK * 3.);
        vec4 m = viewMatrix * vec4(p, 1.); vec3 vv = mat3(viewMatrix) * (aVel * exp(-1.5 * age) + vec3(0., .8, 0.));
        float sp = length(vv.xy); vec2 dir = sp > .01 ? vv.xy / sp : vec2(0., 1.);
        float s = (uSea > .5 ? .10 + .14 * vS : 1.) * aInf.z * (vK > .5 ? (1. - vA) : (.35 + 1.9 * clamp(vA,0.,1.)));
        float st = uSea > .5 ? 1. : vK > .5 ? 1. + sp * .12 : 1. + min(sp * .22, 1.9);
        m.xy += (dir * position.y * st + vec2(dir.y, -dir.x) * position.x) * s;
        gl_Position = projectionMatrix * m;
        if (aInf.x < 0. || vA < 0. || vA >= 1. || -m.z < 2.5) gl_Position = vec4(2., 2., 2., 1.); }`,
    fragmentShader: GLSL + /* glsl */ `varying float vA, vK, vS; varying vec2 vQ;
      void main(){ float r = dot(vQ, vQ); if (r > 1.) discard; r = sqrt(r);
        if (uSea > .5) { float b = smoothstep(1., .86, r) * smoothstep(.55, .95, r) + .55 * smoothstep(.3, 0., length(vQ - vec2(.35, .4))); gl_FragColor = vec4((vec3(.45,.85,.95) * b * .55 + vec3(1.,.5,.15) * exp(-r * 3.) * .10) * (1. - vA), 1.); return; }
        if (vK > .5) { gl_FragColor = vec4(vec3(2.6, .8, .14) * smoothstep(1., 0., r) * (1. - vA), 1.); return; }
        vec2 q = vQ; q.x += (n2(vec2(q.y * 2.2 - vA * 4., vS * 60.)) - .5) * .7;
        float body = 1. - length(q * vec2(1.5 + q.y * .5, .95));
        vec2 fq = q * vec2(2.6, 1.5) + vec2(vS * 50., -vA * 3.5); float n = n2(fq) * .56 + n2(fq * 2.1 + 3.7) * .28 + n2(fq * 4.3 + 9.1) * .14;
        float k = smoothstep(.12 + vA * .3, .62 + vA * .2, body * .75 + n * .55 - .12) * smoothstep(1., .6, r);
        float t = clamp(vA * 1.15 + (1. - k) * .45, 0., 1.);
        vec3 c = mix(vec3(1.5,.80,.24), vec3(1.05,.26,.025), smoothstep(0.,.4,t)); c = mix(c, vec3(.32,.028,.006), smoothstep(.35,.9,t));
        gl_FragColor = vec4(c * k * smoothstep(1., .5, vA) * smoothstep(0., .08, vA) * .28, 1.); }` });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
  let i = 0, dirty = 0;
  return { mesh,
    emit(p, v, life, size, kind = 0) { pos.setXYZ(i, p.x, p.y, p.z); vel.setXYZ(i, v.x, v.y, v.z); inf.setXYZW(i, u.uTime.value, life, size, kind); i = (i + 1) % N; dirty++; },
    // upload only the particles born this frame, so the GPU never waits for the whole buffer
    flush() { if (!dirty) return; const n = Math.min(dirty, N), a = (i - n + N) % N; for (const t of [pos, vel, inf]) { t.clearUpdateRanges(); const k = t.itemSize; if (a + n <= N) t.addUpdateRange(a * k, n * k); else { t.addUpdateRange(a * k, (N - a) * k); t.addUpdateRange(0, (n - (N - a)) * k); } t.needsUpdate = true; } dirty = 0; } };
}
