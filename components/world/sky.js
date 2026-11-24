import * as THREE from 'three';
import { GLSL, rng } from './common';
import { STOP_GAP } from './stops';
import { center, CONE, height } from './landscape';

export function createSky(u) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 32), new THREE.ShaderMaterial({
    uniforms: u, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = (projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position,1.)).xyww; }`,
    fragmentShader: GLSL + /* glsl */ `varying vec3 vD;
      float cloud(vec2 p){ float w = fbm2(p * .9 + uTime * .005); return fbm2(p * 1.5 + w * 1.5 + vec2(uTime * .010, 0.)) * .75 + fbm2(p * 5.2 + w * 2. + vec2(uTime * .02, 3.)) * .25; }
      void main(){ vec3 d = normalize(vD); vec3 c = skyGrad(d); float s = max(dot(d, uSunDir), 0.);
        c += uSunCol * mix(5., 2.2, uNight) * smoothstep(.99935, .9997, s);
        if (d.y > 0.) {
          vec3 g = floor(d * 190.); float r = hash3(g); vec3 f = fract(d * 190.) - .5;
          c += uNight * step(.988, r) * smoothstep(.34, .0, length(f)) * (.5 + .5 * sin(uTime * 2. + r * 900.)) * smoothstep(.02,.3,d.y) * 1.6;
          vec2 p = d.xz / (d.y + .16); vec2 sd = normalize(uSunDir.xz + 1e-4);
          float cl = cloud(p), lit = cloud(p + sd * .10), lit2 = cloud(p + sd * .24);
          float cov = .74 - uCloud * .42, k = smoothstep(cov, cov + .20, cl) * smoothstep(.0, .16, d.y);
          float thick = smoothstep(cov, cov + .42, cl), shade = exp(-max(lit - cov, 0.) * 5. - max(lit2 - cov, 0.) * 3.);
          vec3 cc = (uSky * .55 + uHorizon * .22) * mix(1., .5, thick) + uSunCol * shade * (.10 + .10 * (1. - uNight) + .45 * pow(s, 6.) * (1. - thick * .7));
          c = mix(c, cc, k * .92);
          float au = smoothstep(.35,.8,uNight) * (1. - bump(uPhx.z / -${STOP_GAP.toFixed(1)}, 5.6, .7, .4));
          float band = fbm2(vec2(p.x * 1.1 + sin(p.y + uTime * .05) * .6, uTime * .05));
          float curt = smoothstep(.14, .0, abs(band - .48)) * n2(vec2(atan(d.x, d.z) * 34., uTime * .25)) * smoothstep(.06,.28,d.y) * smoothstep(.85,.35,d.y);
          c += au * curt * mix(vec3(.05,.75,.42), vec3(.42,.15,.75), smoothstep(.2,.6,d.y)) * 1.1;
        }
        c = mix(c, mix(uFog, uHorizon, .35) + uSunCol * .16 * pow(s, 7.), smoothstep(.10, -.02, d.y));
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
  for (let i = 0; i < n; i++) { const z = 800 - i * (3400 / n), m = new THREE.Mesh(geo, mat); m.position.set(center(z) + (R() - 0.5) * 90, 9 + R() * 14, z); m.scale.set(130 + R() * 110, 20 + R() * 22, 1); m.renderOrder = 2; g.add(m); }
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
