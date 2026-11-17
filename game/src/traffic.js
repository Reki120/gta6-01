// Traffic: AI cars that drive the street grid in loops. Each car sticks to one
// street line (a multiple of the pitch), in one lane, at a steady cruise
// speed. They slow for the car ahead and for Rook's car, and when they reach
// the edge of the city they loop back to the far side on a (maybe new) street.
import { CITY } from './config.js';
import { buildCar, paintJobs } from './vehicles.js';
import { pick, range } from './random.js';

export const TRAFFIC_COUNT = 8;

const STREET_LINES = [];
for (let k = -CITY.blocks / 2; k <= CITY.blocks / 2; k += 1) STREET_LINES.push(k * CITY.pitch);
const EDGE = CITY.blocks * CITY.pitch / 2 + 18; // just past the last street
const LANE = 2.6; // right-hand lane offset from the street centre line

function randomStreet(rng) {
  return pick(rng, STREET_LINES);
}

/** One traffic car: axis 'x' (drives along x, z fixed) or 'z'. */
export function spawnTrafficCar(scene, rng, paints, edge = false) {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const line = randomStreet(rng);
  const dir = rng() < 0.5 ? 1 : -1;
  const along = edge ? -dir * EDGE : range(rng, -EDGE, EDGE);
  const paint = pick(rng, paints);
  const built = buildCar(paint);
  scene.add(built.group);
  const car = {
    axis, line, dir,
    x: axis === 'x' ? along : line + (dir > 0 ? LANE : -LANE),
    z: axis === 'z' ? along : line + (dir > 0 ? -LANE : LANE),
    heading: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    speed: range(rng, 9, 14),
    cruise: range(rng, 9, 14),
    mesh: built.group, wheels: built.wheels,
    stopTimer: 0, // forced stop (shot, or hard shove): counts down, then resumes
    shove: 0, // sideways knock from a collision, decays away
  };
  // NOTE: heading convention — forward is (sin h, cos h). Along +x is h=PI/2,
  // along -x is h=-PI/2, along +z is h=0, along -z is h=PI. The lane offset
  // above puts the car on the right-hand side for its direction of travel.
  car.heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  return car;
}

export function createTraffic(scene, rng) {
  const paints = paintJobs();
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) cars.push(spawnTrafficCar(scene, rng, paints));
  return cars;
}

/** Distance ahead of `car` to the nearest other car on the same street lane. */
function carAhead(car, others) {
  let best = Infinity;
  for (const o of others) {
    if (o === car || o.axis !== car.axis || o.dir !== car.dir) continue;
    if (Math.abs(o.line - car.line) > 1) continue;
    const along = car.axis === 'x' ? o.x - car.x : o.z - car.z;
    const ahead = along * car.dir;
    if (ahead > 0 && ahead < best) best = ahead;
  }
  return best;
}

export function stepTraffic(cars, dt, playerCar, rng) {
  for (const car of cars) {
    if (car.stopTimer > 0) {
      car.stopTimer -= dt;
      car.speed = Math.max(0, car.speed - 20 * dt);
    } else {
      // slow down for traffic ahead, stop bumper-to-bumper
      const ahead = carAhead(car, cars);
      let want = car.cruise;
      if (ahead < 14) want = Math.min(want, Math.max(0, (ahead - 6) * 0.9));
      // and for Rook's car if it is in the way on the same street
      if (playerCar) {
        const dLine = car.axis === 'x' ? Math.abs(playerCar.z - car.z) : Math.abs(playerCar.x - car.x);
        if (dLine < 3.5) {
          const along = car.axis === 'x' ? playerCar.x - car.x : playerCar.z - car.z;
          const a = along * car.dir;
          if (a > 0 && a < 12) want = Math.min(want, Math.max(0, (a - 5) * 0.8));
        }
      }
      car.speed += (want - car.speed) * Math.min(1, 1.8 * dt);
    }
    const step = car.speed * car.dir * dt;
    if (car.axis === 'x') car.x += step;
    else car.z += step;
    // sideways knock from a collision, decaying
    if (Math.abs(car.shove) > 0.01) {
      if (car.axis === 'x') car.z += car.shove * dt;
      else car.x += car.shove * dt;
      car.shove *= Math.max(0, 1 - 3 * dt);
    }
    // off the edge: loop back to the far side, sometimes on a new street
    const along = car.axis === 'x' ? car.x : car.z;
    if (along * car.dir > EDGE) {
      const line = rng() < 0.6 ? car.line : randomStreet(rng);
      car.line = line;
      if (car.axis === 'x') {
        car.x = -car.dir * EDGE;
        car.z = line + (car.dir > 0 ? -LANE : LANE);
      } else {
        car.z = -car.dir * EDGE;
        car.x = line + (car.dir > 0 ? LANE : -LANE);
      }
      car.speed = car.cruise;
      car.stopTimer = 0;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt / 0.38;
    for (const wheel of car.wheels) wheel.rotation.x += spin;
  }
}
