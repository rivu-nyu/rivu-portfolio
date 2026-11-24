// One stop per page section, in page order. The phoenix flies between them.
// hold: keep this view while its whole section scrolls past
// az: camera angle around the bird (deg, 0 = behind, 180 = in front)
// sx/sy: where the bird sits on screen, as a fraction of the viewport from centre
// sun: [degrees left of camera view, elevation in degrees]
export const STOP_GAP = 300;
export const STOPS = [
  { id: 'home', z: 600, place: 'Sunrise Pass', az: 166, dist: 21, up: 2.6, sx: 0.12, sy: -0.04, alt: 17, hover: 0,
    sun: [-26, 13], sunCol: '#ffc486', sunI: 4.4, zenith: '#3565a8', horizon: '#f2cda8', sky: '#a9c0e4', ground: '#6a5a48', fog: '#b9b6c4', den: 0.0008, night: 0, cloud: 0.42 },
  { id: 'about', z: 300, place: 'River Valley', az: 52, dist: 17, up: 1, sx: 0.23, sy: 0, alt: 14, hover: 0,
    sun: [24, 34], sunCol: '#ffe9c6', sunI: 3.5, zenith: '#2c66ab', horizon: '#c2daec', sky: '#9cbbe0', ground: '#5a5c45', fog: '#b4cbdc', den: 0.00075, night: 0, cloud: 0.45 },
  { id: 'education', z: 0, place: 'Blossom Sanctuary', tag: 'cherry', az: 5, dist: 27, up: 3, sx: -0.25, sy: 0.12, alt: 11, hover: 0, hold: true,
    sun: [-24, 24], sunCol: '#ffd9b0', sunI: 4.1, zenith: '#3f7fd6', horizon: '#f7d6cf', sky: '#b2bfe8', ground: '#8a6f68', fog: '#e6c6cf', den: 0.0008, night: 0, cloud: 0.42 },
  { id: 'labs', z: -300, place: 'Silver Falls', az: -98, dist: 26, up: 2.4, sx: -0.3, sy: 0.235, alt: 20, hover: 0, hold: true,
    sun: [136, 34], sunCol: '#ffe0b4', sunI: 3.1, zenith: '#2560ad', horizon: '#bcd6e6', sky: '#7299cc', ground: '#3f4a33', fog: '#9dbccb', den: 0.0007, night: 0, cloud: 0.5 },
  { id: 'work', z: -600, place: 'Red Canyon', az: -38, dist: 18, up: 2, sx: 0.25, sy: -0.02, alt: 16, hover: 0,
    sun: [38, 30], sunCol: '#ffd9ab', sunI: 4.2, zenith: '#3f72b0', horizon: '#e9d2b8', sky: '#aab6cf', ground: '#7d6450', fog: '#cdb5a2', den: 0.0012, night: 0, cloud: 0.35 },
  { id: 'research', z: -900, place: 'Mirror Lake', az: 18, dist: 18, up: 2.6, sx: -0.23, sy: 0, alt: 13, hover: 0,
    sun: [-14, 8], sunCol: '#ffa066', sunI: 3.6, zenith: '#3a4d8c', horizon: '#f0a07c', sky: '#8d90bd', ground: '#4d4350', fog: '#b08c98', den: 0.0012, night: 0, cloud: 0.5 },
  { id: 'skills', z: -1200, place: 'Snow Ridge', az: -58, dist: 18, up: 3, sx: -0.24, sy: 0, alt: 16, hover: 0,
    sun: [58, 26], sunCol: '#ffd2a0', sunI: 2.1, zenith: '#2f66ad', horizon: '#d9c3b8', sky: '#6f95d0', ground: '#5d6c94', fog: '#b9c6dc', den: 0.0011, night: 0, cloud: 0.4 },
  { id: 'interests', z: -1350, place: 'Sky Islands', tag: 'isles', az: -34, dist: 31, up: 1.5, sx: 0.23, sy: 0.23, alt: 440, hover: 0, hold: true,
    sun: [82, 30], sunCol: '#c4d6ff', sunI: 2.5, zenith: '#02040c', horizon: '#0d1c3a', sky: '#5f82c4', ground: '#46598a', fog: '#14264a', den: 0.0015, night: 1, cloud: 0.02, aurora: 1 },
  { id: 'lab', z: -1500, place: 'Ember Caldera', az: -125, dist: 17, up: 1, sx: 0.23, sy: 0, alt: 17, hover: 0,
    sun: [30, 12], sunCol: '#ff9c70', sunI: 2.3, zenith: '#131327', horizon: '#9c4a34', sky: '#6f6680', ground: '#5a443f', fog: '#4a3540', den: 0.0012, night: 0.7, cloud: 0.75 },
  { id: 'twin', z: -1800, place: 'The Phoenix', az: -160, dist: 18.5, up: 0.2, sx: -0.25, sy: 0.02, alt: 20, hover: 1,
    sun: [36, 9], sunCol: '#ff8a52', sunI: 2.4, zenith: '#1b1a30', horizon: '#ab5338', sky: '#786a80', ground: '#584440', fog: '#57424a', den: 0.0013, night: 0.6, cloud: 0.7 },
  { id: 'contact', z: -2100, place: 'New Dawn', az: -335, dist: 19, up: 1, sx: 0, sy: -0.15, alt: 17, hover: 0,
    sun: [24, 12], sunCol: '#ffbf7a', sunI: 3.4, zenith: '#41639b', horizon: '#ffc08e', sky: '#98a4c6', ground: '#594742', fog: '#c0b0b8', den: 0.00095, night: 0, cloud: 0.6 },
];

// z along the flight for a fractional stop index, and back again
export const zOf = (p) => { const i = Math.max(0, Math.min(STOPS.length - 2, Math.floor(p))); return STOPS[i].z + (STOPS[i + 1].z - STOPS[i].z) * (p - i); };
export const pOf = (z) => { for (let i = 0; i < STOPS.length - 1; i++) if (z > STOPS[i + 1].z) return Math.max(0, i + (STOPS[i].z - z) / (STOPS[i].z - STOPS[i + 1].z)); return STOPS.length - 1; };
export const at = (id) => STOPS.findIndex((s) => s.id === id);
