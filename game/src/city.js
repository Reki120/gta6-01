// The procedural city layout: a 10x10 block grid with towers downtown, low houses at
// the edges, parks, a harbour and a beach on the south edge, and parked cars. This file
// only computes data — the renderer turns it into meshes. All coordinates are metres,
// x east, z south, the city centred on (0, 0).
import { CITY, PITCH } from './config.js';
import { pick, range } from './random.js';

const EDGE_COLOURS = ['#8a6f5c', '#7d8a99', '#a08a6a', '#6f7d6a', '#96707a'];
const MID_COLOURS = ['#5c6b8a', '#7a6a8a', '#4a5a6e', '#8a7a5c', '#6e7d8a'];
const TOWER_COLOURS = ['#3a3f5e', '#4a3a5e', '#2e4a5e', '#5e3a4a', '#3a5e4a'];

export const CAR_COLOURS = [0xd83a3a, 0x2e9be6, 0xf2c94c, 0x37c978];

/** Centre of block (i, j), with i, j in 0..blocks-1. */
export function blockCentre(i, j) {
  const half = (CITY.blocks - 1) / 2;
  return { x: (i - half) * PITCH, z: (j - half) * PITCH };
}

/** The full width of the built-up city, in metres. */
export function cityHalfSize() {
  return (CITY.blocks * PITCH - CITY.streetWidth) / 2;
}

export function generateCity(random) {
  const buildings = [];
  const colliders = [];
  const parks = [];
  const lights = [];
  const carSpawns = [];

  for (let i = 0; i < CITY.blocks; i += 1) {
    for (let j = 0; j < CITY.blocks; j += 1) {
      const centre = blockCentre(i, j);
      const dist = Math.max(Math.abs(i - 4.5), Math.abs(j - 4.5));
      const downtown = dist <= CITY.downtownRadius;
      const mid = !downtown && dist <= 3.5;

      // A couple of blocks are parks instead of buildings.
      if ((i === 2 && j === 7) || (i === 7 && j === 2) || (i === 6 && j === 6)) {
        parks.push({ x: centre.x, z: centre.z, size: CITY.blockSize - 16 });
        continue;
      }

      const count = downtown ? 1 : mid ? 2 : 3 + Math.floor(random() * 2);
      for (let b = 0; b < count; b += 1) {
        const slot = count === 1 ? 0 : b;
        const cols = count === 1 ? 1 : 2;
        const rows = Math.ceil(count / 2);
        const w = (CITY.blockSize - 24) / cols;
        const d = (CITY.blockSize - 24) / rows;
        const x = centre.x - (CITY.blockSize - 24) / 2 + (slot % cols) * w + w / 2;
        const z = centre.z - (CITY.blockSize - 24) / 2 + Math.floor(slot / cols) * d + d / 2;
        const height = downtown
          ? range(random, 45, 115)
          : mid ? range(random, 16, 42) : range(random, 6, 15);
        const bw = w * range(random, 0.72, 0.92);
        const bd = d * range(random, 0.72, 0.92);
        const colour = downtown ? pick(random, TOWER_COLOURS) : mid ? pick(random, MID_COLOURS) : pick(random, EDGE_COLOURS);
        const building = { x, z, w: bw, d: bd, h: height, colour, downtown };
        buildings.push(building);
        colliders.push({ minX: x - bw / 2, maxX: x + bw / 2, minZ: z - bd / 2, maxZ: z + bd / 2 });
      }
    }
  }

  // Streetlights at the corners of every other street crossing.
  for (let i = 0; i <= CITY.blocks; i += 1) {
    for (let j = 0; j <= CITY.blocks; j += 1) {
      if ((i + j) % 2 !== 0) continue;
      const x = (i - CITY.blocks / 2) * PITCH + 8;
      const z = (j - CITY.blocks / 2) * PITCH + 8;
      lights.push({ x, z });
    }
  }

  // Parked cars on the streets near the spawn, each facing along its street.
  carSpawns.push({ x: 8, z: 0, angle: Math.PI / 2, colour: CAR_COLOURS[0] });
  carSpawns.push({ x: 132, z: -40, angle: 0, colour: CAR_COLOURS[1] });
  carSpawns.push({ x: -132, z: 50, angle: Math.PI, colour: CAR_COLOURS[2] });
  carSpawns.push({ x: 40, z: -132, angle: -Math.PI / 2, colour: CAR_COLOURS[3] });

  const half = cityHalfSize();
  return {
    buildings,
    colliders,
    parks,
    lights,
    carSpawns,
    half,
    // South edge: sand strip then open water.
    beachZ: half + 30,
    seaZ: half + 90,
    spawn: { x: 0, z: 12, heading: Math.PI },
  };
}

/** Push a circle (x, z, radius) out of every building it overlaps. Returns true on a hit. */
export function resolveCollisions(colliders, pos, radius) {
  let hit = false;
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const nearestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nearestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nearestX;
    const dz = pos.z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) continue;
    hit = true;
    if (distSq > 0.000001) {
      const dist = Math.sqrt(distSq);
      pos.x = nearestX + (dx / dist) * radius;
      pos.z = nearestZ + (dz / dist) * radius;
    } else {
      // Centre inside the box: push out along the smallest penetration.
      const pushLeft = pos.x - c.minX;
      const pushRight = c.maxX - pos.x;
      const pushUp = pos.z - c.minZ;
      const pushDown = c.maxZ - pos.z;
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) pos.x = c.minX - radius;
      else if (min === pushRight) pos.x = c.maxX + radius;
      else if (min === pushUp) pos.z = c.minZ - radius;
      else pos.z = c.maxZ + radius;
    }
  }
  return hit;
}
