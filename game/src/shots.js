// The screenshot scenes behind ?shot=start|drive|foot|chase. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (walk to the nearest car, get in, drive its street; the chase adds a
// police pursuit), so the frame is what real play looks like and the same seed
// always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const DRIVE_SECONDS = 10;
const FOOT_SECONDS = 8;
const CHASE_SECONDS = 8;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Keys that walk Rook toward (tx, tz): point the camera at the target, then go. */
function keysToward(state, tx, tz) {
  const p = state.player;
  const dx = tx - p.x;
  const dz = tz - p.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1.2) return { forward: false, back: false, left: false, right: false, run: false, jump: false, enter: true };
  // Camera forward is (-sin yaw, -cos yaw); aim it at the target.
  state.camera.yaw = Math.atan2(-dx, -dz);
  return { forward: true, back: false, left: false, right: false, run: dist > 8, jump: false, enter: false };
}

/** Keys that drive the car east along the z = 0 street, steering back to the lane. */
function keysDrive(state) {
  const car = state.cars[state.carIndex];
  const desired = Math.PI / 2 + Math.max(-0.35, Math.min(0.35, car.z * 0.03));
  const diff = wrapAngle(desired - car.angle);
  return {
    forward: true,
    back: false,
    left: diff > 0.05,
    right: diff < -0.05,
    run: false,
    jump: false,
    enter: false,
  };
}

/** Walk to the nearest parked car and get in. Returns true once driving. */
function autopilotToCar(world, maxSteps) {
  for (let i = 0; i < maxSteps; i += 1) {
    const state = world.state;
    if (state.mode === 'car') return true;
    const car = state.cars[0];
    world.step(STEP, keysToward(state, car.x, car.z));
  }
  return world.state.mode === 'car';
}

/**
 * Set `world` to the named scene (start, drive, foot or chase; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'foot') {
    world.state.camera.yaw = 0;
    world.state.camera.pitch = 0.32;
    for (let i = 0; i < FOOT_SECONDS / STEP; i += 1) {
      world.step(STEP, { forward: true, back: false, left: false, right: false, run: true, jump: false, enter: false });
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive' || name === 'chase') {
    autopilotToCar(world, 20 / STEP);
    const seconds = name === 'chase' ? CHASE_SECONDS : DRIVE_SECONDS;
    if (name === 'chase') world.spawnPolice();
    for (let i = 0; i < seconds / STEP; i += 1) {
      world.step(STEP, keysDrive(world.state));
    }
    if (name === 'chase' && world.state.police) {
      // Pull the pursuit car up alongside, ahead of the chase camera's view, so
      // the frame shows the chase instead of hiding it behind the camera.
      const car = world.state.cars[world.state.carIndex];
      world.state.police.x = car.x + 10;
      world.state.police.z = car.z - 14;
      world.state.police.angle = car.angle;
    }
    return { screen: SCREEN_PLAY };
  }
  // Title: stand north of the city and look south at the skyline, towers and neon
  // behind the menu.
  world.state.player.x = 0;
  world.state.player.z = -700;
  world.state.camera.yaw = Math.PI;
  world.state.camera.pitch = 0.3;
  for (let i = 0; i < 5; i += 1) {
    world.step(STEP, { forward: false, back: false, left: false, right: false, run: false, jump: false, enter: false });
  }
  return { screen: SCREEN_TITLE };
}

export { SCREEN_OVER };
