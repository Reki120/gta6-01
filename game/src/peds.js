// Pedestrians: low-poly walkers on the sidewalks. They stroll along a street
// line (offset onto the sidewalk), turn at intersections, and step aside and
// hurry when a car bears down on them. A hit pedestrian goes down for a few
// seconds, then gets up and walks off.
import { CITY } from './config.js';
import { pick, range } from './random.js';

export const PED_COUNT = 14;

const STREET_LINES = [];
for (let k = -CITY.blocks / 2; k <= CITY.blocks / 2; k += 1) STREET_LINES.push(k * CITY.pitch);
const EDGE = CITY.blocks * CITY.pitch / 2 + 6;
const SIDEWALK = CITY.street / 2 + 2.2; // offset from the street centre line

const SHIRTS = [0xd8d3c8, 0x3f6fb5, 0xb53f6e, 0x4a9a5b, 0xd8a13f, 0x7a4ab5, 0x2e8b8b, 0xc25e3a];
const PANTS = [0x2c3a55, 0x3a3a3a, 0x5a4a3a, 0x24382e];

export function buildPed(rng) {
  const group = new THREE.Group();
  group.name = 'ped';
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, PANTS) });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.66, 0.32), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.3), skin);
  head.position.y = 1.64;
  head.castShadow = true;
  const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.22);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.38, 0);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.14, 0.38, 0);
  for (const l of [legL, legR]) l.castShadow = true;
  group.add(torso, head, legL, legR);
  return { group, legL, legR };
}

function randomSpot(rng) {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const line = pick(rng, STREET_LINES);
  const dir = rng() < 0.5 ? 1 : -1;
  const side = rng() < 0.5 ? 1 : -1;
  const along = range(rng, -EDGE, EDGE);
  return { axis, line, dir, side, along };
}

export function createPeds(scene, rng) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const built = buildPed(rng);
    scene.add(built.group);
    const spot = randomSpot(rng);
    const ped = {
      ...spot,
      x: 0, z: 0, heading: 0,
      speed: range(rng, 1.1, 1.9),
      walkPhase: rng() * Math.PI * 2,
      state: 'walk', // walk | flee | down
      stateTimer: 0,
      dodge: 0, // sideways step off the sidewalk while fleeing, decays back
      mesh: built.group, legL: built.legL, legR: built.legR,
    };
    placePed(ped);
    peds.push(ped);
  }
  return peds;
}

export function placePed(ped) {
  // sidewalk: street line plus the side offset, perpendicular to travel
  if (ped.axis === 'x') {
    ped.x = ped.along;
    ped.z = ped.line + ped.side * SIDEWALK + ped.dodge;
    ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    ped.x = ped.line + ped.side * SIDEWALK + ped.dodge;
    ped.z = ped.along;
    ped.heading = ped.dir > 0 ? 0 : Math.PI;
  }
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.heading;
}

/** Is a fast car closing in on this pedestrian? Returns the threat or null. */
function threatNear(ped, cars) {
  for (const car of cars) {
    const dx = ped.x - car.x;
    const dz = ped.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d > 11 || d < 0.01) continue;
    const speed = Math.abs(car.speed || 0);
    if (speed < 4) continue;
    // closing? the car's velocity points roughly at the ped
    const vx = Math.sin(car.heading) * (car.speed || 0);
    const vz = Math.cos(car.heading) * (car.speed || 0);
    const closing = (dx * vx + dz * vz) / d; // >0 means the car moves toward the ped
    if (closing > 2) return { car, dx, dz, d };
  }
  return null;
}

export function stepPeds(peds, dt, cars) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.stateTimer -= dt;
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
      }
      continue;
    }
    const threat = threatNear(ped, cars);
    if (threat && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.stateTimer = 1.6;
    }
    if (ped.state === 'flee') {
      ped.stateTimer -= dt;
      // hurry sideways, further off the street
      ped.dodge = Math.max(-6, Math.min(6, ped.dodge + ped.side * 4.2 * dt));
      placePed(ped);
      if (ped.stateTimer <= 0) ped.state = 'walk';
    } else {
      // ease back onto the sidewalk line
      ped.dodge *= Math.max(0, 1 - 2 * dt);
      if (Math.abs(ped.dodge) < 0.05) ped.dodge = 0;
      ped.along += ped.dir * ped.speed * dt;
      // at the city edge, turn around; at an intersection, sometimes turn
      if (Math.abs(ped.along) > EDGE) {
        ped.dir *= -1;
        ped.along = Math.max(-EDGE, Math.min(EDGE, ped.along));
      } else if (Math.abs(ped.along % CITY.pitch) < ped.speed * dt * 0.6 && Math.random() < 0.02) {
        // turn onto the cross street at this intersection
        const cross = ped.along;
        const oldAxis = ped.axis;
        ped.axis = oldAxis === 'x' ? 'z' : 'x';
        ped.line = Math.round(cross / CITY.pitch) * CITY.pitch;
        ped.along = ped.axis === 'x' ? ped.z : ped.x;
        ped.side = Math.random() < 0.5 ? 1 : -1;
        ped.dir = Math.random() < 0.5 ? 1 : -1;
      }
      placePed(ped);
    }
    ped.walkPhase += ped.speed * dt * 3.2;
    const swing = ped.state === 'flee' ? 0.9 : 0.5;
    ped.legL.rotation.x = Math.sin(ped.walkPhase) * swing;
    ped.legR.rotation.x = -Math.sin(ped.walkPhase) * swing;
    if (ped.state === 'flee') placePed(ped);
  }
}

/** Knock a pedestrian down (car hit or shot). */
export function knockPedDown(ped, seconds = 4) {
  ped.state = 'down';
  ped.stateTimer = seconds;
  ped.mesh.rotation.x = Math.PI / 2 * 0.9;
  ped.mesh.position.y = 0.25;
  ped.legL.rotation.x = 0;
  ped.legR.rotation.x = 0;
}
