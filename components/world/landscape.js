import * as THREE from 'three';
import { GLSL, SHADOW, HMAP, noise, smooth, bump, rng, lerp } from './common';
import { STOP_GAP, STOPS, pOf } from './stops';

const Z0 = 1320, Z1 = -2980;
export const center = (z) => 55 * Math.sin(z * 0.0045) + 24 * Math.sin(z * 0.011 + 1.3);
// The volcano beside the caldera: shared by the terrain, its lava and its smoke.
export const CONE = { z: -1400, r: 205, h: 150 }; CONE.x = center(CONE.z) + 235;
// Silver Falls: a cliff alcove on the right bank with a plunge pool and an outflow to the river.
export const FALL = { z: -258 }; FALL.x = center(FALL.z) + 66; // centre of the plunge pool
export const alcove = (s) => 19 * Math.sqrt(Math.max(0, 1 - (s / 46) ** 2));
export function fallCliff(x, z) { // distance into the rock face, curved into an alcove
  const t = (z - FALL.z) / 46;
  return x - (FALL.x + alcove(z - FALL.z)) + 3.4 * noise(x * 0.07, z * 0.07) + 1.6 * noise(z * 0.21, x * 0.13 + 4) + 5 * Math.max(0, Math.abs(t) - 0.6);
}
// Every fall in the basin: s sideways, w half-width, tier (1 the great fall and its neighbours, 2 the middle wall, 3 the far wall)
export const FALLS = [[-5.5, 7.5, 1, 1], [6, 6.5, 1, 1], [0.5, 4.5, 1, 1], [-33, 1.7, 1, 0.8], [34, 2.2, 1, 0.8], [-24, 0.8, 1, 0.6], [-58, 1.1, 1, 0.6], [-60, 2.2, 2, 0.9], [-32, 4.4, 2, 1], [-4, 2.0, 2, 0.8], [26, 5.2, 2, 1], [55, 2.4, 2, 0.9], [84, 1.4, 2, 0.7], [-84, 1.6, 2, 0.7], [-54, 3.6, 3, 0.9], [10, 5.0, 3, 1], [72, 3.4, 3, 0.9], [-118, 2.2, 3, 0.7]].map(([s, w, tier, dens]) => ({ s, w, tier, dens, lip: 0 }));
const lakeAt = (z) => bump(-z / STOP_GAP, 3.2, 0.28, 0.3);
// Blossom Sanctuary: the river widens into a still pond with an islet
export const pondAt = (z) => bump(-z / STOP_GAP, 0, 0.1, 0.34);
export const HERO = { x: center(2) - 31, z: 2 }; // the great tree on the left bank
export const riverWidth = (z) => 7 + 3 * noise(z * 0.02, 1) + lakeAt(z) * 40 + pondAt(z) * 12;

export function height(x, z) {
  const u = -z / STOP_GAP, o = x - center(z), d = Math.abs(o);
  const canyon = bump(u + 0.1 * noise(x * 0.008, z * 0.008), 2.12, 0.5, 0.4), lake = lakeAt(z), volc = bump(u, 5.5, 0.7, 0.4);
  const rw = riverWidth(z), bank = smooth(rw + 4, rw + 30, d);
  // meandering valley walls
  const wob = (14 * noise(x * 0.011, z * 0.011) + 6 * noise(x * 0.034 + 9, z * 0.034)) * smooth(18, 60, d);
  const pond = pondAt(z), fw = 27 + 9 * noise(z * 0.01, 4.2) + lake * 34 + canyon * 24 + pond * 34, dw = d + wob;
  let m = 0;
  if (canyon < 1) {
    const wx = x + 30 * noise(x * 0.006 + 3, z * 0.006) + 11 * noise(x * 0.021, z * 0.021 + 5), wz = z + 30 * noise(x * 0.006, z * 0.006 + 7) + 11 * noise(x * 0.021 + 8, z * 0.021);
    let r = 0, a = 0.5, f = 0.0058, w = 1;
    for (let i = 0; i < 7; i++) {
      let n = 1.07 - Math.sqrt(noise(wx * f + i * 17.3, wz * f - i * 9.1) ** 2 + 0.012); n *= n * w;
      w = Math.min(1, Math.max(0, n * 1.7)); r += n * a * (i > 2 ? smooth(520, 190, d) * 0.85 + 0.15 : 1); a *= 0.5; f *= 2.07;
    }
    m = Math.pow(smooth(fw, fw + 215, dw), 1.25) * (22 + (205 - volc * 60) * r * (0.75 + 0.35 * noise(x * 0.0021, z * 0.0021 + 8))) + smooth(160, 560, d) * 70;
  }
  if (canyon > 0) {
    // Eroded canyon: broken rims, side gullies, talus aprons and uneven ledges instead of clean terraces.
    const gully = Math.pow(1 - Math.abs(noise(x * 0.019 + 31, z * 0.019)), 4), g2 = Math.pow(1 - Math.abs(noise(x * 0.055, z * 0.055 + 12)), 3);
    const e = dw - 8 * noise(x * 0.09, z * 0.09) + gully * 22 + g2 * 5 - 12, big = 0.8 + 0.35 * noise(x * 0.004 + 5, z * 0.004);
    const tilt = 4 * noise(x * 0.008, z * 0.008 + 2);
    let c = 17 * Math.pow(smooth(fw - 14, fw + 24, e), 1.4);
    c += 26 * big * smooth(fw + 17, fw + 29 + 8 * noise(x * 0.03, z * 0.03), e);
    c += 9 * smooth(fw + 28, fw + 62, e);
    c += 34 * big * smooth(fw + 54 + tilt, fw + 69 + tilt, e);
    c += 12 * smooth(fw + 70, fw + 125, e);
    c += 46 * big * smooth(fw + 122, fw + 146 + tilt * 2, e) + smooth(fw + 150, fw + 420, e) * 50;
    const steep = smooth(fw, fw + 40, e);
    c += steep * (3.2 * noise(x * 0.06, z * 0.06) + 1.8 * noise(x * 0.16, z * 0.16) + 0.9 * noise(x * 0.37, z * 0.37) - gully * 9 - g2 * 3.5);
    m = lerp(m, c, canyon);
  }
  const cd = Math.hypot(x - CONE.x, z - CONE.z) * (1 + 0.14 * noise(x * 0.012, z * 0.012));
  if (cd < CONE.r) { const q = 1 - cd / CONE.r, rib = 1 - Math.abs(noise(Math.atan2(z - CONE.z, x - CONE.x) * 4.2, cd * 0.006)); let c = CONE.h * Math.pow(q, 1.35) - (rib * 9 + 5 * noise(x * 0.05, z * 0.05)) * smooth(0, 0.25, q) * smooth(1, 0.7, q) * 1.0; if (cd < 26) c -= 24 * (1 - smooth(8, 26, cd)); m = lerp(m, c + 6, smooth(0, 0.22, q)); }
  const fz = Math.abs(z - FALL.z);
  if (fz < 205 && o > 24) {
    const e = fallCliff(x, z), sd = z - FALL.z, as = Math.abs(sd), col = noise(z * 0.16, 3) * 1.4 + noise(z * 0.43, x * 0.1) * 0.7 + 5 * noise(z * 0.045, 11) * smooth(16, 40, fz), side = smooth(8, 34, fz);
    let c = -1.6 + 3.1 * smooth(14, 30, Math.hypot((x - FALL.x - 3) * 0.9, sd));
    if (e > 0) {
      const up = smooth(20, 70, e); c += (23 + 0.04 * as + 3 * side * noise(z * 0.05, 8) - 1.5 * Math.exp(-((sd / 14) ** 2))) * smooth(11 + col, 27 + col, e); // lower wall
      c += up * (17 + 0.17 * Math.max(0, as - 14)) + smooth(18, 30, e) * (2.4 * noise(x * 0.075, z * 0.075) + 1.3 * noise(x * 0.21, z * 0.21)) * (0.35 + 0.65 * side); // boulder slope where the streams gather
      c += (19 + 5 * noise(z * 0.035, 21)) * smooth(76 + col * 1.5, 98 + col * 1.5, e) + 10 * smooth(98, 132, e) + 3 * smooth(76, 90, e) * noise(x * 0.045, z * 0.045); // middle wall and hanging valley
      c += (20 + 8 * noise(z * 0.021, 31)) * smooth(140, 172, e); // far wall
      if (e > 128) { let r = 0, a2 = 0.5, f2 = 0.009, w2 = 1; for (let i = 0; i < 6; i++) { let n2 = 1.06 - Math.sqrt(noise(x * f2 + i * 13.1 + 1.3 * noise(z * 0.02, 4), z * f2 - i * 5.3 + 1.3 * noise(x * 0.02, 9)) ** 2 + 0.012); n2 *= n2 * w2; w2 = Math.min(1, n2 * 1.7); r += n2 * a2 * (i > 2 ? 0.45 : 1); a2 *= 0.5; f2 *= 2.07; } c += r * 46 * smooth(150, 300, e); }
    }
    const out = Math.exp(-Math.pow((sd - 4 * noise(x * 0.06, 2)) / 6.5, 2)) * smooth(4, -6, e); // stream to the river
    c = lerp(c, -1.4, out);
    m = lerp(m, c - 2.2, smooth(205, 125, fz) * smooth(24, 36, o));
    if (e < 4 && fz < 88) { m = c - 2.2; }
  }
  const hills = (noise(x * 0.03, z * 0.03) + 0.5 * noise(x * 0.08, z * 0.08)) * 3.2 * bank * (fz < 60 && o > 20 ? smooth(30, 60, fz) : 1) + 0.35 * noise(x * 0.31, z * 0.31);
  let y = 2.2 + hills + m - 7 * (1 - smooth(rw - 3, rw + 12, d + 2.5 * noise(x * 0.07, z * 0.07)));
  if (fz < 30 && o > 4 && o < 110) { const e = fallCliff(x, z), path = z - FALL.z - 4.5 * noise(x * 0.05, 2); y = Math.min(y, lerp(y, -1.3, smooth(17, 7, Math.abs(path)) * smooth(2, -5, e))); }
  return y;
}

for (const f of FALLS) f.lip = [0, 25 + 0.05 * Math.abs(f.s) + 1.5 * noise(f.s * 0.3, 2), 59 + 0.14 * Math.abs(f.s) + 5 * noise(f.s * 0.11, 7), 101 + 0.04 * Math.abs(f.s) + 7 * noise(f.s * 0.07, 3)][f.tier];
export const BIOME = /* glsl */ `
float U = -vW.z / ${STOP_GAP.toFixed(1)};
// borders wander and interlock instead of cutting straight across the valley
float UW = U + (n2(vW.xz * .011) - .5) * .42 + (n2(vW.xz * .045 + 7.) - .5) * .16 + (n2(vW.xz * .19 + 3.) - .5) * .05;
float canyon = bump(UW, 2.12, .50, .36), snowy = bump(UW, 4., .42, .62), volc = bump(UW, 5.5, .66, .48);
float hiA = step(300., vW.y); canyon *= 1. - hiA; snowy *= 1. - hiA; volc *= 1. - hiA; float pinkK = bump(UW, 0., .17, .42) * (1. - hiA);
vec2 cp = vW.xz - vec2(${CONE.x.toFixed(2)}, ${CONE.z.toFixed(1)}); float coneD = length(cp); float cone = (1. - hiA) * smoothstep(${CONE.r.toFixed(1)}, 120., coneD); volc = max(volc, cone); snowy *= 1. - cone;`;

// Shared rock/soil surface built from scanned textures, projected from three sides so cliffs never stretch.
const SURFACE = /* glsl */ `
uniform sampler2D tNoise;
float tn(vec2 p){ return texture2D(tNoise, p * .125).r; }
float tn3(vec3 p, vec3 w){ return dot(vec3(tn(p.zy), tn(p.xz + 3.7), tn(p.xy + 1.3)), w); }
uniform sampler2D tRock, tRockN, tCliff, tCliffN, tBasalt, tGrass, tSand, tLeafy, tForest, tForestN;
vec3 tri(sampler2D t, vec3 p, vec3 w){ return texture2D(t, p.zy).rgb * w.x + texture2D(t, p.xz).rgb * w.y + texture2D(t, p.xy).rgb * w.z; }
vec3 triN(sampler2D t, vec3 p, vec3 w, vec3 n, float k){
  vec3 a = texture2D(t, p.zy).xyz * 2. - 1., b = texture2D(t, p.xz).xyz * 2. - 1., c = texture2D(t, p.xy).xyz * 2. - 1.;
  return normalize(n + k * (vec3(0., a.y, a.x) * w.x + vec3(b.x, 0., b.y) * w.y + vec3(c.x, c.y, 0.) * w.z)); }
vec3 planar(sampler2D t, vec2 p){ vec2 q = mat2(.82,.57,-.57,.82) * p; return mix(texture2D(t, p).rgb, texture2D(t, q * .31 + .37).rgb, smoothstep(.35,.65, n2(p * .7))); }
`;

export function groundMaterial(u, { rock = false, far = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: u, side: THREE.DoubleSide, defines: rock ? (far ? { ROCK: 1, ISLE: 1 } : { ROCK: 1 }) : {},
    vertexShader: `precision highp float; attribute float aAo; varying vec3 vW, vN; varying float vAo, vSun; uniform vec3 uSunDir; ${HMAP}
      void main(){
        #ifdef ROCK
          vec4 w = instanceMatrix * vec4(position, 1.); vW = w.xyz; vN = mat3(instanceMatrix) * (normal / vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz), dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz), dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz)));
          vAo = mix(.45, 1.05, smoothstep(-.2, 2.2, vW.y - hAt(vW.xz)));
          #ifdef ISLE
            vAo = aAo;
          #endif
        #else
          vW = position; vN = normal; vAo = aAo;
        #endif
        vSun = sunVis(vW, uSunDir); gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.); }`,
    fragmentShader: GLSL + SHADOW + SURFACE + /* glsl */ `
      varying vec3 vW, vN; varying float vAo, vSun;
      #ifdef ISLE
      uniform sampler2D uIsleS; uniform mat4 uIsleM; float isleShadow(vec3 p){ vec4 c = uIsleM * vec4(p, 1.); vec3 q = c.xyz / c.w * .5 + .5; if (min(min(q.x, q.y), min(1. - q.x, 1. - q.y)) < 0.) return 1.; float s = 0.; for (int i = 0; i < 6; i++) { float t = float(i) * 2.4; s += step(q.z - .003, texture2D(uIsleS, q.xy + vec2(cos(t), sin(t)) * sqrt(float(i) + .5) * .0005).r); } return s / 6.; }
      #endif
      void main(){
        ${BIOME}
        vec3 G = normalize(vN), N = G; float dist = length(cameraPosition - vW);
        vec3 w = pow(abs(G), vec3(5.)); w /= w.x + w.y + w.z;
        float big = tn(vW.xz * .022), fine = tn3(vW * .16, w), grit = tn3(vW * .9, w);
        float nk = exp(-dist * .0032);
        // rock, at two scales so tiling never reads
        vec3 rk = tri(tRock, vW * .019 + .3, w); bool close = dist < 150.; if (close) rk = mix(mix(tri(tRock, vW * .085, w), rk, .45), rk, smoothstep(90., 150., dist)); rk = pow(rk, vec3(1.25)) * .62;
        if (close) N = triN(tRockN, vW * .085, w, N, .9 * nk * smoothstep(150., 100., dist)); 
        if (canyon > .01) {
          // scanned strata, gently warped, with slow colour banding by elevation
          vec3 q = vW; q.y += 3.5 * (big - .5) * 6. + (fine - .5) * 5.;
          vec3 c1 = tri(tCliff, q * vec3(.042,.05,.042), w), c2 = tri(tCliff, q * vec3(.013,.016,.013) + .21, w);
          vec3 cl = c1 * (.45 + 1.1 * c2); if (dist < 70.) cl *= mix(vec3(1.), .35 + 1.5 * tri(tRock, vW * .33, w), exp(-dist * .04));
          float band = n2(vec2(q.y * .115, 3.)), band2 = n2(vec2(q.y * .42, 9.));
          cl *= mix(vec3(.80,.62,.52), vec3(1.16,1.06,.96), smoothstep(.25,.8, band)); cl = mix(cl, cl * vec3(1.25,1.2,1.12) + .03, smoothstep(.62,.85,band2) * .45);
          float stain = smoothstep(.5,.8, n2(vec2((vW.x + vW.z) * .22, vW.y * .018 + 4.))) * (1. - w.y); cl *= 1. - .32 * stain;
          rk = mix(rk, cl * 1.15, canyon); N = normalize(mix(N, triN(tCliffN, q * vec3(.042,.05,.042), w, G, 1.3 * nk), canyon));
        }
        vec3 bs = vec3(.05); if (volc > .01) { bs = tri(tBasalt, vW * .07, w); bs = mix(bs, tri(tBasalt, vW * .02, w), .4); bs = mix(vec3(dot(bs, vec3(.33))), bs, .6) * 1.15 + .012; } rk = mix(rk, bs * vec3(.86,.80,.80), volc);
        #ifdef ISLE
          rk = mix(tri(tRock, vW * .045, w), tri(tRock, vW * .012, w), .4); rk = pow(rk, vec3(1.1)) * .95; rk *= .6 + .6 * tn3(vW * .3, w); N = triN(tRockN, vW * .05, w, G, 1.3); rk = mix(rk, vec3(.10,.14,.06), smoothstep(.45,.62, tn3(vW * .5, w)) * smoothstep(.0,.6,G.y) * .6); float strat = tn(vec2(vW.y * 1.1 + fine * 3., 4.)); rk *= .72 + .55 * strat; rk *= mix(1., .55, smoothstep(.1, -.6, G.y)); rk *= .42 + .78 * smoothstep(.36, .60, tn3(vW * vec3(.11,.03,.11), w)); rk = pow(rk, vec3(1.25)) * .95; { vec3 t2 = tri(tCliffN, vW * vec3(.035,.04,.035), w) * 2. - 1.; N = normalize(N + .8 * vec3(t2.x, t2.y, t2.x) * (1. - w.y)); }
        #endif
        // ground cover
        float slope = 1. - normalize(mix(G, N, .55)).y;
        float gs = smoothstep(.40 + .16 * pinkK, .20 + .14 * pinkK, slope + (fine - .5) * .22) * max(hiA, smoothstep(125., 60., vW.y + big * 40.));
        #ifdef ROCK
          gs = smoothstep(.25, .05, slope + (grit - .4) * .5) * .55 * (1. - volc) * (1. - canyon); if (hiA > .5) gs = smoothstep(.40, .22, slope + (grit - .5) * .2 + (fine - .5) * .25) * step(0., G.y);
        #endif
        vec3 gr = rk, sd = vec3(.22,.15,.09);
        if (gs > .01 || slope < .5) {
        gr = texture2D(tGrass, vW.xz * .017 + .4).rgb; if (close) gr = mix(mix(planar(tGrass, vW.xz * .11), gr, .4), gr, smoothstep(90., 150., dist)); 
        // turf underfoot, leaf litter in the shade of the woods, worn earth between
        if (dist < 260.) { vec3 lf = mix(planar(tLeafy, vW.xz * .19), texture2D(tLeafy, vW.xz * .043).rgb, .35) * vec3(.62,.78,.42); gr = mix(gr, lf * (.55 + 1.4 * gr.g), .62 * smoothstep(260., 120., dist)); }
        float wood = smoothstep(.40, .58, tn(vW.xz * .055 + 9.) * .6 + fine * .4); vec3 fl = planar(tForest, vW.xz * (close ? .16 : .04)) * vec3(1.15,1.02,.86); gr = mix(gr, fl, wood * .72 * (1. - pinkK * .6));
        gr *= mix(vec3(.66,.74,.56), vec3(1.28,1.12,.78), smoothstep(.3,.7,big + (grit - .5) * .3));
        if (close) { vec3 bn = texture2D(tForestN, vW.xz * .16).xyz * 2. - 1.; N = normalize(mix(N, normalize(G + vec3(bn.x, 0., -bn.y) * .9 * nk), gs * smoothstep(150., 60., dist))); }
        sd = texture2D(tSand, vW.xz * .021).rgb; if (close) sd = mix(mix(planar(tSand, vW.xz * .13), sd, .35), sd, smoothstep(90., 150., dist));
        gr = mix(gr, sd, smoothstep(.52,.66, fine + (grit - .5) * .5) * .75);
        vec3 soil = mix(sd * vec3(1.25,.86,.62), sd * vec3(1.35,1.1,.85), smoothstep(.35,.65,big)); soil = mix(soil, vec3(.17,.16,.06), smoothstep(.55,.72, grit) * smoothstep(.45,.65, big) * .5);
        gr = mix(gr, mix(vec3(.055,.105,.022), vec3(.17,.21,.06), clamp(big * 1.5 - .35 + grit * .4, 0., 1.)) * (.6 + .8 * gr.g * 2.2), pinkK * .95); gr = mix(gr, soil, canyon); gr = mix(gr, mix(bs * .8, vec3(.085,.078,.08) * (.6 + grit), smoothstep(.4,.65,fine)), volc);
        }
        vec2 fp = vW.xz - vec2(${FALL.x.toFixed(2)}, ${FALL.z.toFixed(1)}); float nearF = (1. - hiA) * smoothstep(190., 120., length(fp));
        if (nearF > .01) {
          vec3 rs = tri(tRock, vW * .055, w) * (.55 + .75 * tri(tRock, vW * .16, w)); rk = mix(rk, pow(rs, vec3(1.35)) * .85, nearF * .75); N = normalize(mix(N, triN(tRockN, vW * .06, w, G, 1.5), nearF * .8)); rk *= mix(vec3(1.), vec3(.60,.58,.54) * (.75 + .5 * tn(vec2(fp.y * .16, vW.y * .05))), nearF); float moss = nearF * smoothstep(1.0, .35, slope + (fine - .5) * 1.1) * smoothstep(.42, .56, fine * .5 + grit * .5 + (tn(vW.xz * 1.9 + vW.y) - .48) * .5);
          rk = mix(rk, vec3(.035,.075,.016) * (.6 + grit * 1.4), moss * .9);
          float wetR = nearF * smoothstep(17., 3., abs(fp.y) + (fine - .5) * 12.) * smoothstep(-4., 12., fp.x); rk *= 1. - .5 * wetR;
          float cracks = smoothstep(.42,.5, tn(vec2(fp.y * .9, vW.y * .16))) ; rk *= mix(1., .8 + .25 * cracks, nearF * (1. - w.y) * smoothstep(8., 16., fp.x));
        }
        gr = mix(gr, mix(vec3(.030,.058,.013), vec3(.105,.145,.035), smoothstep(.3,.65,fine * .6 + grit * .4)) * (.55 + 2.4 * gr.g), nearF * .72); rk = rk; { float hillF = (1. - hiA) * smoothstep(230., 150., abs(fp.y) + (big - .5) * 60.) * smoothstep(-20., 20., fp.x) * smoothstep(330., 230., fp.x) * smoothstep(9., 24., vW.y) * smoothstep(140., 105., vW.y); vec3 fl2 = mix(vec3(.020,.032,.012), vec3(.058,.066,.026), smoothstep(.34,.62, fine * .5 + grit * .5)) * (.6 + 2. * gr.g); gr = mix(gr, fl2, hillF * .88); rk = mix(rk, rk * vec3(.74,.78,.74), hillF * .6); }
        vec3 alb = mix(rk, gr, gs);
        // scree at the foot of cliffs
        alb = mix(alb, mix(rk, sd, .4) * (.65 + .7 * grit), smoothstep(.16,.28,slope) * smoothstep(.52,.36,slope) * .55);
        float line = mix(112., 14., snowy) + canyon * 300. + volc * 400. + hiA * 382.;
        float snow = smoothstep(line - 12., line + 26., vW.y + (fine - .5) * 46. + big * 18.) * smoothstep(.46, .26, slope + (grit - .5) * .22 + (fine - .5) * .25);
        snow = max(snow, snowy * smoothstep(.42, .2, slope + (grit - .5) * .25) * smoothstep(.8, 3.2, vW.y));
        alb = mix(alb, mix(vec3(.46,.51,.60), vec3(.62,.67,.75), max(snowy, hiA)) * (.93 + .12 * grit), snow); N = normalize(mix(N, G, snow * .75));
        if (pinkK > .01) { vec2 pq = vW.xz * 5.5; vec2 pc = floor(pq); float ph = hash2(pc); vec2 pf = fract(pq) - .5 - (vec2(hash2(pc + 3.), hash2(pc + 7.)) - .5) * .5; float ca = cos(ph * 40.), sa = sin(ph * 40.); pf = mat2(ca, -sa, sa, ca) * pf; float pet = step(.28 + .4 * fine, ph) * smoothstep(.26, .20, length(pf * vec2(1., 1.7))); alb = mix(alb, mix(vec3(.82,.28,.45), vec3(.97,.70,.79), hash2(pc + 11.)), pet * pinkK * smoothstep(26., 10., dist) * smoothstep(.6,.2,slope)); alb = mix(alb, vec3(.74,.36,.46), pinkK * smoothstep(8., 30., dist) * smoothstep(.42, .66, big * .5 + fine * .35 + grit * .25) * .34 * smoothstep(.5,.2,slope)); }
        float shore = smoothstep(2.3, .4, vW.y + (grit - .5) * 1.6 + (fine - .5) * 2.); alb = mix(alb, mix(sd * .75, rk * 1.1, smoothstep(.4, .6, grit)), shore * .72 * (1. - volc)); alb *= 1. - .45 * smoothstep(1., .0, vW.y) * (1. - hiA);
        float ao = clamp(vAo, .25, 1.1) * mix(1., .62 + .7 * grit, nk * (1. - snow * .8));
        float sh = vSun * castShadow(vW, G);
        #ifdef ISLE
          sh *= isleShadow(vW + G * .6);
        #endif
         if (nearF > .01) sh *= mix(1., .42 + .58 * smoothstep(.40, .56, tn(vW.xz * .035 + vec2(uTime * .09, uTime * .05)) + .22 * smoothstep(34., 8., abs(fp.y))), nearF);
        float nl = max(dot(N, uSunDir), 0.) * smoothstep(-.05, .15, dot(G, uSunDir));
        vec3 sky = mix(uGround, uSky, N.y * .5 + .5);
        vec3 col = alb * (uSunCol * nl * sh * 1.12 + sky * .96 * ao);
        // light bounced off sunlit canyon walls
        col += alb * uSunCol * canyon * vec3(.075,.05,.034) * (1. - nl * sh) * ao;
        vec3 V = normalize(cameraPosition - vW); float wet = smoothstep(1.2, .2, vW.y) * (1. - volc);
        col += uSunCol * sh * (wet * .25 + snow * .10) * pow(max(dot(N, normalize(V + uSunDir)), 0.), 40.);
        if (snow > .2 && dist < 110.) { float sp = 0.; for (int k = 0; k < 2; k++){ vec3 q = vW * (k == 0 ? 16. : 7.); vec3 ce = floor(q), rn = normalize(vec3(hash3(ce), hash3(ce + 17.), hash3(ce + 41.)) - .5 + N * .55); vec3 fr = fract(q) - .5; sp += smoothstep(.955, .995, dot(rn, normalize(V + uSunDir))) * smoothstep(.42, .05, length(fr)); } col += uSunCol * sh * snow * sp * 7. * exp(-dist * .02); col += uSunCol * sh * snow * alb * .35 * pow(1. - max(dot(N, V), 0.), 3.) * max(dot(-V, uSunDir), 0.); }
        col += alb * phxLight(vW, N);
        if (volc > .01) {
          float seen = smoothstep(-1270., -1400., uPhx.z) ; float flick = seen * (.85 + .15 * sin(uTime * 1.7 + big * 20.));
          // glow thrown up from the lava river
          float o = abs(vW.x - (55. * sin(vW.z * .0045) + 24. * sin(vW.z * .011 + 1.3)));
          float gl = exp(-max(o - 9., 0.) * .085) * exp(-max(vW.y - 1., 0.) * .07) * (1. - cone);
          col += (alb + .015) * vec3(2.6,.62,.10) * volc * gl * flick * (.35 + .65 * clamp(1. - G.y + .35, 0., 1.));
          #ifndef ROCK
          vec2 q = vW.xz * .03; q += vec2(fbm2(q * 2.3), fbm2(q * 2.3 + 9.)) * 1.1; float cr = abs(fbm2(q) - .47), aw = fwidth(cr);
          float keep = smoothstep(.5,.62, fbm2(vW.xz * .018 + 4.)) * smoothstep(60., 6., vW.y) * (1. - cone);
          float core = smoothstep(.010 + aw, .002, cr), halo = exp(-cr * 55.);
          // streams running down the volcano
          float an = atan(cp.y, cp.x); an += (fbm2(vec2(coneD * .035, an * 2.)) - .5) * .55; float lane = abs(fract(an * 1.114 + .13) - .5) / 1.114, wd = mix(.035, .11, smoothstep(170., 20., coneD));
          float run = cone * smoothstep(195., 150., coneD + 40. * hash2(vec2(floor(an * 1.114 + .13), 3.))); float st = run * smoothstep(wd, wd * .2, lane), sh2 = run * exp(-lane * 16.);
          float flow = fbm2(vec2(an * 14., coneD * .09 - uTime * .35)); float crater = smoothstep(24., 12., coneD);
          col += (core * keep * 2.2 + st * (.5 + 2.6 * smoothstep(.35,.65,flow)) + crater * 4.) * vec3(2.2,.42,.035) * flick * max(volc, cone);
          col += (halo * keep * .5 + sh2 * .55) * (alb * 3. + .03) * vec3(2.4,.45,.06) * flick;
          #endif
        }
        #ifdef ISLE
          col += alb * (vec3(.04,.22,.15) * uAurora * (.35 + .65 * max(N.y, 0.)) + uSky * .22 * (.2 + .8 * max(dot(N, normalize(vec3(-.5,.45,.75))), 0.))); col += uSky * .10 * pow(1. - max(dot(N, V), 0.), 3.);
        #endif
        gl_FragColor = vec4(fogged(col, vW), 1.);
      }`,
  });
}

const PATCH = { x0: 12, x1: 162, z0: -104, z1: 104 }; // around the pool centre
const patchSink = (x, z) => { const a = x - FALL.x + 40, b = z - FALL.z; return 7 * smooth(PATCH.x0 + 6, PATCH.x0 + 18, a) * smooth(PATCH.x1 - 6, PATCH.x1 - 20, a) * smooth(PATCH.z0 + 6, PATCH.z0 + 18, b) * smooth(PATCH.z1 - 6, PATCH.z1 - 18, b); };
// Fine mesh over the falls, where the main grid is too coarse for a believable cliff.
function cliffPatch(mat, low) {
  const st = low ? 1.8 : 1.05, nx = Math.round((PATCH.x1 - PATCH.x0) / st), nz = Math.round((PATCH.z1 - PATCH.z0) / st), W = nx + 1, pos = new Float32Array(W * (nz + 1) * 3), ao = new Float32Array(W * (nz + 1)), idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i < W; i++) { const x = FALL.x - 40 + PATCH.x0 + i * st, z = FALL.z + PATCH.z0 + j * st; let y = height(x, z); const e = fallCliff(x, z);
    const edge = Math.min(i, nx - i, j, nz - j) < 2 ? -1.5 : 0, inCliff = smooth(-2, 2, e) * smooth(26, 18, e);
    const px = x - inCliff * (1.1 * noise(y * 0.35, z * 0.22) + 0.6 * noise(y * 0.9, z * 0.6) + 0.5 * Math.sin(y * 0.75 + 2 * noise(z * 0.06, 3)));
    pos.set([px, y + edge + inCliff * 0.5 * noise(x * 0.8, z * 0.8), z], (j * W + i) * 3);
    if (j < nz && i < nx) { const v = j * W + i; idx.push(v, v + W, v + 1, v + 1, v + W, v + W + 1); } }
  for (let j = 0; j <= nz; j++) for (let i = 0; i < W; i++) { const k = j * W + i, g = (a, b) => pos[(Math.min(nz, Math.max(0, b)) * W + Math.min(nx, Math.max(0, a))) * 3 + 1]; const q = (g(i - 4, j) + g(i + 4, j) + g(i, j - 4) + g(i, j + 4)) / 4; ao[k] = 1 - Math.max(-0.1, Math.min(0.6, (q - pos[k * 3 + 1]) * 0.05)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aAo', new THREE.BufferAttribute(ao, 1)); g.setIndex(idx); g.computeVertexNormals(); return new THREE.Mesh(g, mat);
}

export function createTerrain(u, low) {
  const step = low ? 6 : 4.2, cols = low ? 150 : 220, chunks = 12;
  const rowsTotal = Math.ceil((Z0 - Z1) / step / chunks) * chunks, dz = (Z0 - Z1) / rowsTotal, per = rowsTotal / chunks;
  const group = new THREE.Group(), mat = groundMaterial(u);
  const W = cols + 1, H = rowsTotal + 1, P = new Float32Array(W * H * 3), tex = new Uint16Array(W * H);
  for (let j = 0; j < H; j++) { const z = Z0 - j * dz, c = center(z);
    for (let i = 0; i < W; i++) { const s = (i / cols) * 2 - 1, a = Math.abs(s), x = c + Math.sign(s) * (a * 90 + a * a * 560);
      const k = (j * W + i) * 3; P[k] = x; P[k + 1] = height(x, z); P[k + 2] = z; tex[j * W + i] = THREE.DataUtils.toHalfFloat(P[k + 1]); } }
  const hm = new THREE.DataTexture(tex, W, H, THREE.RedFormat, THREE.HalfFloatType); hm.minFilter = hm.magFilter = THREE.LinearFilter; hm.unpackAlignment = 2; hm.needsUpdate = true; u.uHMap.value = hm;
  const at = (i, j) => (Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))) * 3;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let c = 0; c < chunks; c++) {
    const n = W * (per + 1), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), ao = new Float32Array(n), idx = [];
    for (let j = 0; j <= per; j++) for (let i = 0; i < W; i++) {
      const J = c * per + j, k = at(i, J), o = j * W + i;
      pos.set([P[k], P[k + 1] - patchSink(P[k], P[k + 2]), P[k + 2]], o * 3);
      const l = at(i - 1, J), r = at(i + 1, J), d = at(i, J - 1), e = at(i, J + 1);
      a.set(P[r] - P[l], P[r + 1] - P[l + 1], P[r + 2] - P[l + 2]); b.set(P[e] - P[d], P[e + 1] - P[d + 1], P[e + 2] - P[d + 2]);
      a.cross(b).normalize(); if (a.y < 0) a.negate(); nor.set([a.x, a.y, a.z], o * 3);
      const q = (P[at(i - 4, J) + 1] + P[at(i + 4, J) + 1] + P[at(i, J - 3) + 1] + P[at(i, J + 3) + 1]) / 4;
      ao[o] = 1 - Math.max(-0.1, Math.min(0.7, (q - P[k + 1]) * 0.06));
      if (j < per && i < cols) { const v = o; idx.push(v, v + 1, v + W, v + 1, v + W + 1, v + W); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('aAo', new THREE.BufferAttribute(ao, 1)); geo.setIndex(idx);
    group.add(new THREE.Mesh(geo, mat));
  }
  group.add(cliffPatch(mat, low));
  return group;
}

export function createWater(u) {
  const rows = 400, pos = [], idx = [];
  for (let j = 0; j <= rows; j++) { const z = Z0 + (Z1 - Z0) * j / rows, c = center(z); pos.push(c - 110, 0, z, c + 110, 0, z); if (j < rows) { const k = j * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: u, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vW; void main(){ vW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position,1.); }`,
    fragmentShader: GLSL + SHADOW + HMAP + /* glsl */ `uniform sampler2D tBasalt; varying vec3 vW;
      uniform sampler2D tNoise; float tn(vec2 p){ return texture2D(tNoise, p * .125).r; }
      float wv(vec2 p){ return tn(p * .22 + vec2(uTime*.12, uTime*.5)) + .42 * tn(mat2(.8,.6,-.6,.8) * p * .55 + vec2(-uTime*.3, uTime*.6)); }
      void main(){ ${BIOME}
        float depth = -hAt(vW.xz) + (n2(vW.xz * .7) - .5) * .5; if (depth < -.3) discard;
        vec3 V = normalize(cameraPosition - vW); float dist = length(cameraPosition - vW);
        vec2 e = vec2(.35, 0.); float h = wv(vW.xz);
        float calm = mix(.5, .14, max(bump(U, 3.2, .4, .3), bump(U, 0., .14, .12))) / (1. + dist * .012);
        vec3 N = normalize(vec3((h - wv(vW.xz + e.xy)) * calm, .35, (h - wv(vW.xz + e.yx)) * calm));
        float fr = .03 + .97 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        // reflect the surrounding slopes as well as the sky
        vec3 refl = skyGrad(normalize(R + vec3(0., .06, 0.))) * .85; float hit = 0., t = 8.;
        for (int i = 0; i < 9; i++){ vec3 q = vW + R * t; if (q.y < hAt(q.xz)) { hit = 1.; break; } t *= 1.5; }
        vec3 land = mix(mix(vec3(.10,.12,.06), vec3(.34,.16,.08), canyon), vec3(.5,.55,.62), snowy) * (uSky * .6 + uSunCol * .22); land = mix(land, uFog, clamp(1. - exp(-t * uDen * 1.4), 0., 1.));
        land = mix(land, mix(vec3(.16,.22,.07), vec3(.86,.42,.56), smoothstep(.36, .56, n2(vW.xz * .09 + R.xz * 5.) )) * (uSky * .55 + uSunCol * .26), pinkK * .85 * smoothstep(120., 30., t)); refl = mix(refl, land, hit * .85);
        float sh = castShadow(vW, N), vSunW = sunVis(vW, uSunDir);
        vec3 deep = mix(vec3(.10,.15,.11), vec3(.012,.055,.06), smoothstep(0., 2.6, depth)) * (uSky + uSunCol * .2 * sh);
        vec3 col = mix(deep, refl, fr);
        col += uSunCol * 3. * sh * (1. - hit) * pow(max(dot(R, uSunDir), 0.), 260.);
        // sun glitter: thousands of tiny wave facets catching the light
        { float toward = pow(max(dot(normalize(vec3(R.x, max(R.y, .02), R.z)), uSunDir), 0.), 14.); float gsum = 0.;
          for (int k = 0; k < 2; k++){ float sc = (k == 0 ? 4.2 : 2.1); vec2 gq = vW.xz * sc + vec2(uTime * .35, uTime * .8) * (k == 0 ? 1. : .5); vec2 ce = floor(gq); float hh = hash2(ce + float(k) * 31.); float tw = pow(max(sin(uTime * (2.5 + hh * 4.) + hh * 80.), 0.), 10.); vec2 f = fract(gq) - .5; gsum += tw * smoothstep(.34, .0, length(f * vec2(.7, 2.2))) * (k == 0 ? exp(-dist * .022) : exp(-dist * .006)); }
          col += uSunCol * toward * gsum * sh * vSunW * 5. * (1. - volc);
          float broad = (1. - .6 * pinkK) * pow(max(dot(normalize(R * vec3(1., .55, 1.)), normalize(uSunDir * vec3(1., .55, 1.))), 0.), 70.); col += uSunCol * broad * .75 * smoothstep(.55, .95, h) * sh * vSunW * (1. - hit * .7) * (1. - volc); }
        col += phxLight(vW, N) * (.10 + .5 * pow(max(dot(R, normalize(uPhx - vW)), 0.), 24.));
        float foam = exp(-dist * .022) * smoothstep(.45, .05, depth) * smoothstep(.42,.62, n2(vW.xz * 1.3 + vec2(uTime * .3, -uTime * .6))) * (1. - bump(U, 3.2, .4, .3) * .7);
        { vec2 ip = vW.xz - vec2(${(FALL.x + 15).toFixed(2)}, ${FALL.z.toFixed(1)}); float id = length(ip * vec2(1., .72));
          if (id < 34.) { float ring = fbm2(vec2(id * .55 - uTime * 1.5, atan(ip.y, ip.x) * 3.)); float churn = fbm2(ip * .5 + vec2(uTime * .9, -uTime * .6)); float fm = smoothstep(22., 3., id + (churn - .5) * 13.) + smoothstep(.55,.75, ring) * smoothstep(34., 8., id) * .5; foam = max(foam, clamp(fm, 0., 1.) * 1.5); } }
        col = mix(col, (uSky * .5 + uSunCol * .25) * .8, min(foam * .55, .9));
        if (pinkK > .01) { vec2 pq = (vW.xz + vec2(sin(vW.z * .15 + uTime * .1), uTime * .12)) * 3.2; vec2 pc = floor(pq); float ph = hash2(pc); vec2 pf = fract(pq) - .5 - (vec2(hash2(pc + 3.), hash2(pc + 7.)) - .5) * .5; float ca = cos(ph * 40.), sa = sin(ph * 40.); pf = mat2(ca, -sa, sa, ca) * pf; float pet = step(1. - .60 * smoothstep(.36,.62, fbm2(vW.xz * .13 + 3.)), ph) * smoothstep(.26, .18, length(pf * vec2(1., 1.6))); col = mix(col, mix(vec3(.86,.30,.48), vec3(.98,.70,.79), fract(ph * 17.)) * (uSunCol * .3 * sh + uSky * .55), pet * pinkK * smoothstep(70., 20., dist)); }
        if (volc > .01) {
          vec2 lp = vW.xz * .085 + vec2(0., uTime * .16); vec2 wq = vec2(fbm2(lp * .8 + 3.), fbm2(lp * .8 + 8. - uTime * .02)); vec2 q = lp + wq * 1.8;
          float plates = fbm2(q), seams = 1. - abs(fbm2(q * 2.1 + wq) * 2. - 1.), heat = smoothstep(.60, .30, plates) * .85 + pow(seams, 7.) * .75; heat *= mix(.5, 1., smoothstep(-.2, 1.6, depth)); heat = clamp(heat + smoothstep(.5,.0,depth) * .25, 0., 1.4);
          vec3 cru = texture2D(tBasalt, q * .9).rgb * .22 + vec3(.012,.008,.008); cru *= uSky * .8 + uSunCol * .4 * max(uSunDir.y + .2, 0.);
          vec3 hotc = mix(vec3(.35,.012,.0), vec3(2.0,.30,.02), smoothstep(.1,.55,heat)); hotc = mix(hotc, vec3(2.9,.95,.14), smoothstep(.65,1.3,heat));
          col = mix(col, cru * (1. - smoothstep(.05,.5,heat)) + hotc * smoothstep(.03,.35,heat), volc); }
        float a = max(smoothstep(-.05, .75, depth) * mix(.72, 1., smoothstep(.3, 2., depth)), volc * smoothstep(-.1,.1,depth));
        gl_FragColor = vec4(fogged(col, vW), max(a, foam * .5)); }`,
  })); m.renderOrder = 1; return m;
}

// ---------- perches: one standing rock every few metres of flight path, on the camera's side of the water
export function createPerches() {
  const out = [], camSide = (z) => { const p = Math.min(STOPS.length - 1.001, pOf(z)), i = Math.floor(p), f = smooth(0, 1, p - i); return Math.sin(lerp(STOPS[i].az, STOPS[i + 1].az, f) * Math.PI / 180) >= 0 ? 1 : -1; };
  for (let z = 454; z > -2180; z -= 26) {
    if (Math.abs(z) < 75) continue;
    const side = camSide(z), c = center(z); let d = riverWidth(z) + 3; while (height(c + side * d, z) < 2.3 && d < 120) d += 1;
    d += 2; const x = c + side * d, g = height(x, z), top = g + 5 + 1.6 * Math.abs(noise(z * 0.7, 2));
    out.push({ x, z, ground: g, y: top });
  }
  return out;
}
