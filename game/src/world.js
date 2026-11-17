// The game's rules and state, with no drawing and no browser in it: Rook on foot,
// arcade driving, entering and leaving cars, collisions with the city, cash, health
// and the wanted level. step() advances one fixed step and returns what happened as
// bit flags, so the caller can react without the world knowing about screens.
import { CAR, OBJECTIVE_DRIVE, OBJECTIVE_START, PLAYER } from './config.js';
import { generateCity, resolveCollisions } from './city.js';

export const EVENT_ENTER = 1;
export const EVENT_EXIT = 2;
export const EVENT_DAMAGE = 4;

export function createWorld(random) {
  const city = generateCity(random);
  const state = {
    city,
    mode: 'foot',           // 'foot' or 'car'
    player: { x: city.spawn.x, z: city.spawn.z, y: 0, vy: 0, heading: city.spawn.heading, speed: 0, onGround: true },
    camera: { yaw: city.spawn.heading + Math.PI, pitch: 0.32 },
    cars: city.carSpawns.map((spawn) => ({ ...spawn, speed: 0, steer: 0, taken: false })),
    carIndex: -1,
    police: null,           // { x, z, angle, speed } while a pursuit is staged
    cash: 250,
    bestCash: 250,
    health: 100,
    wanted: 0,
    objective: OBJECTIVE_START,
    elapsed: 0,
    nearCar: false,
  };

  function reset() {
    // The city layout stays fixed for the whole visit (the renderer builds its
    // meshes once from it); only Rook, the cars and the run state reset.
    const fresh = state.city;
    state.mode = 'foot';
    state.player.x = fresh.spawn.x;
    state.player.z = fresh.spawn.z;
    state.player.y = 0;
    state.player.vy = 0;
    state.player.heading = fresh.spawn.heading;
    state.player.speed = 0;
    state.player.onGround = true;
    state.camera.yaw = fresh.spawn.heading + Math.PI;
    state.camera.pitch = 0.32;
    state.cars = fresh.carSpawns.map((spawn) => ({ ...spawn, speed: 0, steer: 0, taken: false }));
    state.carIndex = -1;
    state.police = null;
    state.health = 100;
    state.wanted = 0;
    state.objective = OBJECTIVE_START;
    state.elapsed = 0;
    state.nearCar = false;
  }

  function nearestCarIndex(maxDist) {
    const p = state.player;
    let best = -1;
    let bestDist = maxDist;
    for (let i = 0; i < state.cars.length; i += 1) {
      const car = state.cars[i];
      const dx = car.x - p.x;
      const dz = car.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function stepFoot(dt, keys) {
    const p = state.player;
    const cam = state.camera;
    // Movement relative to the camera: forward is away from the camera.
    let mx = 0;
    let mz = 0;
    if (keys.forward) { mx += -Math.sin(cam.yaw); mz += -Math.cos(cam.yaw); }
    if (keys.back) { mx += Math.sin(cam.yaw); mz += Math.cos(cam.yaw); }
    if (keys.left) { mx += -Math.cos(cam.yaw); mz += Math.sin(cam.yaw); }
    if (keys.right) { mx += Math.cos(cam.yaw); mz += -Math.sin(cam.yaw); }
    const len = Math.hypot(mx, mz);
    const speed = keys.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (len > 0) {
      mx /= len;
      mz /= len;
      p.x += mx * speed * dt;
      p.z += mz * speed * dt;
      p.heading = Math.atan2(mx, mz);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    if (keys.jump && p.onGround) {
      p.vy = PLAYER.jumpSpeed;
      p.onGround = false;
    }
    if (!p.onGround) {
      p.vy -= PLAYER.gravity * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.onGround = true;
      }
    }
    resolveCollisions(state.city.colliders, p, PLAYER.radius);
    // Keep Rook inside the playable area (city + beach).
    const limit = state.city.half + 60;
    p.x = Math.max(-limit, Math.min(limit, p.x));
    p.z = Math.max(-limit, Math.min(limit, p.z));
    state.nearCar = nearestCarIndex(CAR.enterDistance) !== -1;
  }

  function stepCar(dt, keys) {
    const car = state.cars[state.carIndex];
    const speedFactor = Math.min(1, Math.abs(car.speed) / 8);
    const steerTarget = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    const steerMax = CAR.steerMax * (1 - 0.6 * speedFactor);
    car.steer += (steerTarget * steerMax - car.steer) * Math.min(1, dt * 10);
    if (keys.forward) car.speed += CAR.accel * dt;
    if (keys.back) {
      car.speed -= car.speed > 0.5 ? CAR.brake * dt : CAR.reverseAccel * dt;
    }
    // Rolling drag and a touch of drift: the car slides a little sideways at speed.
    car.speed -= car.speed * CAR.drag * dt;
    if (!keys.forward && !keys.back) car.speed -= car.speed * 1.2 * dt;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    car.angle += (car.speed / 2.6) * Math.tan(car.steer) * dt;
    const fx = Math.sin(car.angle);
    const fz = Math.cos(car.angle);
    car.x += fx * car.speed * dt;
    car.z += fz * car.speed * dt;
    const hit = resolveCollisions(state.city.colliders, car, 1.6);
    if (hit) car.speed *= 0.4;
    const limit = state.city.half + 60;
    car.x = Math.max(-limit, Math.min(limit, car.x));
    car.z = Math.max(-limit, Math.min(limit, car.z));
    // Rook rides along.
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.heading = car.angle;
    state.player.speed = Math.abs(car.speed);
    state.nearCar = false;
  }

  function stepPolice(dt) {
    const police = state.police;
    if (!police || state.carIndex < 0) return;
    const car = state.cars[state.carIndex];
    const dx = car.x - police.x;
    const dz = car.z - police.z;
    const dist = Math.hypot(dx, dz);
    const targetAngle = Math.atan2(dx, dz);
    let diff = targetAngle - police.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    police.angle += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    police.speed = Math.min(38, police.speed + 14 * dt);
    if (dist < 6) police.speed = Math.max(0, police.speed - 20 * dt);
    police.x += Math.sin(police.angle) * police.speed * dt;
    police.z += Math.cos(police.angle) * police.speed * dt;
  }

  /** Stage a police pursuit behind the player's car (used by the chase screenshot). */
  function spawnPolice() {
    if (state.carIndex < 0) return;
    const car = state.cars[state.carIndex];
    state.police = {
      x: car.x - Math.sin(car.angle) * 14,
      z: car.z - Math.cos(car.angle) * 14,
      angle: car.angle,
      speed: 20,
    };
    state.wanted = 3;
  }

  function enterCar() {
    const index = nearestCarIndex(CAR.enterDistance);
    if (index === -1) return 0;
    state.carIndex = index;
    state.cars[index].taken = true;
    state.mode = 'car';
    state.objective = OBJECTIVE_DRIVE;
    return EVENT_ENTER;
  }

  function exitCar() {
    const car = state.cars[state.carIndex];
    state.player.x = car.x - Math.sin(car.angle) * 2.5;
    state.player.z = car.z - Math.cos(car.angle) * 2.5;
    state.player.y = 0;
    state.carIndex = -1;
    state.mode = 'foot';
    state.objective = OBJECTIVE_START;
    return EVENT_EXIT;
  }

  /**
   * One fixed step. `keys` holds the held keys as booleans:
   * forward/back/left/right/run/jump/enter. Returns EVENT_* flags.
   */
  function step(dt, keys) {
    state.elapsed += dt;
    let events = 0;
    if (keys.enter) {
      if (state.mode === 'foot') events |= enterCar();
      else if (state.mode === 'car' && Math.abs(state.cars[state.carIndex].speed) < 2) events |= exitCar();
    }
    if (state.mode === 'car') stepCar(dt, keys);
    else stepFoot(dt, keys);
    stepPolice(dt);
    return events;
  }

  /** Speed of the driven car in km/h, 0 on foot. */
  function speedKmh() {
    if (state.mode !== 'car' || state.carIndex < 0) return 0;
    return Math.abs(state.cars[state.carIndex].speed) * 3.6;
  }

  reset();
  return { state, reset, step, spawnPolice, speedKmh, nearestCarIndex };
}
