// Neon Bay — every tuning number the world, the cars and the camera share.
// One place to tune the feel: walk and drive speeds, the city grid, the dusk palette.
export const STEP = 1 / 60;

export const SAVE_KEY = 'NEONBAY_SAVE_V1';

export const CITY = {
  blocks: 10, // blocks across, and down
  block: 120, // metres of built land per block
  street: 12, // metres of road between blocks
  pitch: 132, // block + street, centre to centre
};

export const PLAYER = {
  walk: 6,
  run: 10.5,
  jump: 8.5,
  gravity: 26,
  radius: 0.55,
  height: 1.8,
};

export const CAR = {
  accel: 17,
  brake: 32,
  reverseAccel: 11,
  maxSpeed: 38, // about 137 km/h
  maxReverse: 9,
  steer: 0.62, // radians of wheel angle at full lock, scaled by speed
  grip: 5.5, // how fast sideways slide is killed off (the drift feel)
  enterDistance: 4.5,
};

export const CAMERA = {
  distance: 8.5,
  height: 3.4,
  driveDistance: 11,
  driveHeight: 4.2,
  lag: 6, // how fast the chase camera catches up, per second
};

export const PALETTE = {
  sky: 0x2b3357,
  fog: 0x2a2f4a,
  sun: 0xffb36b,
  hemiSky: 0x8a7bd8,
  hemiGround: 0x2e2620,
  ground: '#3a3f47',
  street: '#484d57',
  beach: '#c9a86a',
  neonPink: '#ff2e88',
  neonCyan: '#22e6ff',
  neonAmber: '#ffb02e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const START_CASH = 250;
export const OBJECTIVE = 'Meet Mara Voss at the harbour — missions arrive soon.';
