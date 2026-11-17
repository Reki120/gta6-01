// The state of Neon Bay and one fixed step of it: walking, jumping, driving,
// entering and leaving cars, bumping into buildings, the patrol car that
// chases Rook, and the save file. The renderer only paints what is here.
import { CITY, PLAYER, CAR, SAVE_KEY, START_CASH, OBJECTIVE } from './config.js';
import { buildCity, resolveCollisions } from './city.js';
import { buildCharacter } from './character.js';
import { buildCar, paintJobs, stepCar } from './vehicles.js';

export const EVENT_NONE = 0;
export const EVENT_CRASH = 1;
export const EVENT_OVER = 2;

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: typeof data.cash === 'number' ? data.cash : START_CASH,
      bestCash: typeof data.bestCash === 'number' ? data.bestCash : START_CASH,
      missionsCompleted: Array.isArray(data.missionsCompleted) ? data.missionsCompleted : [],
    };
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      bestCash: state.bestCash,
      missionsCompleted: state.missionsCompleted,
    }));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

const CAR_SPOTS = [
  { x: 6, z: 38, heading: Math.PI },
  { x: -138, z: -198, heading: 0 },
  { x: 126, z: 330, heading: Math.PI },
  { x: 258, z: 66, heading: Math.PI / 2 },
];

export function createWorld(scene, rng, save) {
  const city = buildCity(scene, rng);
  const rook = buildCharacter();
  scene.add(rook.group);

  const paints = paintJobs();
  const cars = CAR_SPOTS.map((spot, i) => {
    const built = buildCar(paints[i % paints.length]);
    built.group.position.set(spot.x, 0, spot.z);
    built.group.rotation.y = spot.heading;
    scene.add(built.group);
    return {
      x: spot.x, z: spot.z, heading: spot.heading,
      speed: 0, vx: 0, vz: 0,
      paint: paints[i % paints.length].name,
      mesh: built.group, wheels: built.wheels,
    };
  });

  const patrol = buildCar({ body: 0x14161c, trim: 0x111111 }, true);
  patrol.group.visible = false;
  scene.add(patrol.group);

  const state = {
    cash: save ? save.cash : START_CASH,
    bestCash: save ? save.bestCash : START_CASH,
    missionsCompleted: save ? save.missionsCompleted : [],
    health: 100,
    wanted: 0,
    objective: OBJECTIVE,
    time: 0,
    player: {
      x: 6, y: 0, z: 43, vy: 0, heading: Math.PI,
      onGround: true, walkPhase: 0, moving: false, speed: 0,
      mesh: rook.group, rig: rook,
    },
    camYaw: Math.PI, // looking north, down the street toward downtown
    camPitch: 0.32,
    cars,
    activeCar: -1,
    police: {
      active: false, x: 0, z: 200, heading: Math.PI, speed: 0, vx: 0, vz: 0,
      mesh: patrol.group, wheels: patrol.wheels,
    },
    city,
  };
  return state;
}

/** Put Rook back on the street by the first car, cash and health restored. */
export function resetWorld(state) {
  state.health = 100;
  state.wanted = 0;
  state.activeCar = -1;
  state.police.active = false;
  state.police.mesh.visible = false;
  state.player.x = 6;
  state.player.y = 0;
  state.player.z = 43;
  state.player.vy = 0;
  state.player.heading = Math.PI;
  state.player.mesh.visible = true;
  state.camYaw = Math.PI;
  state.camPitch = 0.32;
  state.time = 0;
}

function nearestCar(state, maxDist) {
  let best = -1;
  let bestD = maxDist;
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    const dx = car.x - state.player.x;
    const dz = car.z - state.player.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function stepOnFoot(state, dt, controls) {
  const p = state.player;
  const lookX = Math.sin(state.camYaw);
  const lookZ = Math.cos(state.camYaw);
  const rightX = -lookZ;
  const rightZ = lookX;
  let mx = 0;
  let mz = 0;
  if (controls.forward) { mx += lookX; mz += lookZ; }
  if (controls.back) { mx -= lookX; mz -= lookZ; }
  if (controls.right) { mx += rightX; mz += rightZ; }
  if (controls.left) { mx -= rightX; mz -= rightZ; }
  const len = Math.hypot(mx, mz);
  p.moving = len > 0;
  if (p.moving) {
    mx /= len;
    mz /= len;
    const speed = controls.run ? PLAYER.run : PLAYER.walk;
    p.speed = speed;
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    p.heading = Math.atan2(mx, mz);
    p.walkPhase += speed * dt * 1.6;
  } else {
    p.speed = 0;
  }
  if (controls.jump && p.onGround) {
    p.vy = PLAYER.jump;
    p.onGround = false;
  }
  if (!p.onGround || p.y > 0) {
    p.vy -= PLAYER.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }
  const fixed = resolveCollisions(p.x, p.z, PLAYER.radius, state.city.colliders);
  p.x = fixed.x;
  p.z = fixed.z;
  p.x = Math.max(-state.city.bounds, Math.min(state.city.bounds, p.x));
  p.z = Math.max(-state.city.bounds, Math.min(state.city.waterZ - 2, p.z));
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
  if (p.moving) p.rig.pose(p.walkPhase, controls.run ? 1 : 0.6);
  else p.rig.idle();
}

function stepDriving(state, dt, controls) {
  const car = state.cars[state.activeCar];
  const steer = (controls.left ? 1 : 0) - (controls.right ? 1 : 0);
  const drive = controls.forward ? 1 : controls.back ? -1 : 0;
  const beforeX = car.x;
  const beforeZ = car.z;
  const speedBefore = car.speed;
  stepCar(car, drive, steer, dt);
  const fixed = resolveCollisions(car.x, car.z, 1.9, state.city.colliders);
  const pushed = Math.hypot(fixed.x - car.x, fixed.z - car.z);
  car.x = fixed.x;
  car.z = fixed.z;
  car.x = Math.max(-state.city.bounds, Math.min(state.city.bounds, car.x));
  car.z = Math.max(-state.city.bounds, Math.min(state.city.waterZ - 2, car.z));
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt / 0.38;
  for (const wheel of car.wheels) wheel.rotation.x += spin;
  // a hard shunt into a wall hurts, and kills the speed
  if (pushed > 0.15 && Math.abs(speedBefore) > 8) {
    car.speed *= 0.4;
    car.vx *= 0.4;
    car.vz *= 0.4;
    state.health = Math.max(0, state.health - 6);
    return EVENT_CRASH;
  }
  return EVENT_NONE;
}

/** The patrol car steers toward Rook's car and stays on his tail. */
function stepPolice(state, dt) {
  const cop = state.police;
  const target = state.activeCar >= 0 ? state.cars[state.activeCar] : state.player;
  const dx = target.x - cop.x;
  const dz = target.z - cop.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1) return;
  const want = Math.atan2(dx, dz);
  let diff = want - cop.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cop.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
  const wantSpeed = dist > 26 ? 34 : 24;
  cop.speed += (wantSpeed - cop.speed) * Math.min(1, 1.4 * dt);
  cop.x += Math.sin(cop.heading) * cop.speed * dt;
  cop.z += Math.cos(cop.heading) * cop.speed * dt;
  const fixed = resolveCollisions(cop.x, cop.z, 1.9, state.city.colliders);
  cop.x = fixed.x;
  cop.z = fixed.z;
  cop.mesh.position.set(cop.x, 0, cop.z);
  cop.mesh.rotation.y = cop.heading;
}

/**
 * Advance the world one fixed step. `controls` is the plain object the loop
 * builds from the keyboard (or the shots autopilot builds): forward/back/
 * left/right/run/jump booleans, an enter one-shot, and look yaw/pitch deltas.
 */
export function stepWorld(state, dt, controls) {
  state.time += dt;
  state.camYaw += controls.lookYaw || 0;
  state.camPitch = Math.max(-0.15, Math.min(1.1, state.camPitch + (controls.lookPitch || 0)));

  let events = EVENT_NONE;
  if (controls.enter) {
    if (state.activeCar >= 0) {
      if (Math.abs(state.cars[state.activeCar].speed) < 1) {
        const car = state.cars[state.activeCar];
        state.player.x = car.x - Math.cos(car.heading) * 3;
        state.player.z = car.z + Math.sin(car.heading) * 3;
        state.player.mesh.visible = true;
        state.activeCar = -1;
      }
    } else {
      const i = nearestCar(state, CAR.enterDistance);
      if (i >= 0) {
        state.activeCar = i;
        state.player.mesh.visible = false;
      }
    }
  }

  if (state.activeCar >= 0) {
    events |= stepDriving(state, dt, controls);
    // driving keeps the camera behind the car
    const car = state.cars[state.activeCar];
    let diff = car.heading - state.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.camYaw += diff * Math.min(1, 2.2 * dt);
    state.camPitch += (0.3 - state.camPitch) * Math.min(1, 2 * dt);
  } else {
    stepOnFoot(state, dt, controls);
  }

  if (state.police.active) stepPolice(state, dt);

  if (state.health < 100) state.health = Math.min(100, state.health + 0.8 * dt);
  if (state.health <= 0) return EVENT_OVER;
  if (state.cash > state.bestCash) {
    state.bestCash = state.cash;
    saveGame(state);
  }
  return events;
}
