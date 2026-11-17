// The screenshot scenes behind ?shot=start|drive|foot|chase (with &seed=N).
// Each one plays the real rules forward from a fresh world, steered by a
// simple autopilot, so the frame is what a short session really looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { resetWorld, stepWorld } from './world.js';
import { placePed } from './peds.js';

function idleControls() {
  return { forward: false, back: false, left: false, right: false, run: false, jump: false, enter: false, lookYaw: 0, lookPitch: 0 };
}

/** Steer the driven car toward the centre of the street it is on. */
function driveControls(state) {
  const car = state.cars[state.activeCar];
  if (!car) return idleControls();
  // streets run along x or z at multiples of the pitch; stay near x = 0 lane
  const lane = Math.round(car.x / 132) * 132;
  const off = car.x - lane;
  const wantHeading = Math.PI; // north, up the street
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.4 - off * 0.02));
  return { forward: true, back: false, left: steer > 0.15, right: steer < -0.15, run: false, jump: false, enter: false, lookYaw: 0, lookPitch: 0 };
}

function walkControls(state) {
  // walk north up the street, camera behind
  return { forward: true, back: false, left: false, right: false, run: false, jump: false, enter: false, lookYaw: 0, lookPitch: 0 };
}

function runSteps(state, seconds, controlsFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(state, STEP, controlsFn(state));
  }
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * Unknown names stage the title scene.
 */
export function stageShot(name, state) {
  resetWorld(state);
  if (name === 'start') {
    // a few seconds of the city idling behind the title screen
    runSteps(state, 4, idleControls);
    state.camYaw = Math.PI * 0.78;
    return { screen: 'title' };
  }
  if (name === 'foot') {
    state.camYaw = Math.PI;
    runSteps(state, 7, walkControls);
    // two pedestrians on the sidewalk ahead, so the foot scene shows them
    for (let k = 0; k < 2; k += 1) {
      const ped = state.peds[k];
      ped.axis = 'z';
      ped.line = 0;
      ped.dir = 1;
      ped.side = k === 0 ? 1 : -1;
      ped.along = state.player.z - 16 - k * 9;
      ped.dodge = 0;
      ped.state = 'walk';
      placePed(ped);
    }
    return { screen: 'play' };
  }
  if (name === 'drive') {
    // walk up to the car by the spawn, get in, then drive north through downtown
    runSteps(state, 0.6, walkControls);
    stepWorld(state, STEP, { ...idleControls(), enter: true });
    runSteps(state, 9, driveControls);
    // two traffic cars ahead in the same street, so the drive scene shows them
    const driven = state.cars[state.activeCar];
    const fx = Math.sin(driven.heading);
    const fz = Math.cos(driven.heading);
    for (let k = 0; k < 2; k += 1) {
      const t = state.traffic[k];
      const ahead = 24 + k * 22;
      const side = k === 0 ? -2.6 : 2.6;
      t.x = driven.x + fx * ahead - fz * side;
      t.z = driven.z + fz * ahead + fx * side;
      t.heading = driven.heading;
      t.speed = 10;
      t.mesh.position.set(t.x, 0, t.z);
      t.mesh.rotation.y = t.heading;
    }
    return { screen: 'play' };
  }
  if (name === 'chase') {
    runSteps(state, 0.6, walkControls);
    stepWorld(state, STEP, { ...idleControls(), enter: true });
    state.wanted = 3;
    state.police.active = true;
    state.police.mesh.visible = true;
    const car = state.cars[state.activeCar];
    state.police.x = car.x - Math.sin(car.heading) * 16;
    state.police.z = car.z - Math.cos(car.heading) * 16;
    state.police.heading = car.heading;
    state.police.speed = 20;
    runSteps(state, 8, driveControls);
    // pull the patrol car alongside-behind, inside the chase camera's frame
    const driven = state.cars[state.activeCar];
    const fx = Math.sin(driven.heading);
    const fz = Math.cos(driven.heading);
    state.police.x = driven.x - fx * 4 + fz * 4.5;
    state.police.z = driven.z - fz * 4 + -fx * 4.5;
    state.police.heading = driven.heading;
    state.police.mesh.position.set(state.police.x, 0, state.police.z);
    state.police.mesh.rotation.y = state.police.heading;
    return { screen: 'play' };
  }
  runSteps(state, 4, idleControls);
  return { screen: 'title' };
}
