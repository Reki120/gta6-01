// NEON BAY — every tuning number and colour in one place.
// A fictional coastal city at dusk. All sizes are in metres.
export const STEP = 1 / 60;

export const CITY = {
  blocks: 10,          // blocks per side
  blockSize: 120,      // metres of buildings per block
  streetWidth: 12,     // metres of road between blocks
  downtownRadius: 2,   // blocks around the centre that grow towers
};

/** Distance between two neighbouring block centres (block + street). */
export const PITCH = CITY.blockSize + CITY.streetWidth;

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  jumpSpeed: 8.5,
  gravity: 24,
  radius: 0.55,
  height: 1.8,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 42,        // m/s, about 150 km/h
  maxReverse: 10,
  steerMax: 0.55,      // radians at standstill
  drag: 0.35,
  enterDistance: 4,
};

export const PALETTE = {
  sky: 0x3d2a6b,
  fog: 0x54407a,
  ground: 0x3a3550,
  road: 0x2a2738,
  sidewalk: 0x35324a,
  sand: 0xc2a878,
  sea: 0x14425e,
  park: 0x1e4d2a,
  neonPink: 0xff2e88,
  neonCyan: 0x2ee6ff,
  neonAmber: 0xffb02e,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'NEONBAY_SAVE_V1';

export const OBJECTIVE_START = 'Find a ride. Press E near a parked car to get in.';
export const OBJECTIVE_DRIVE = 'Cruise Neon Bay. E to get out, Shift to run on foot.';
