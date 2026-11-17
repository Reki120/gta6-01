// The procedural city of Neon Bay: a 10x10 block grid, downtown towers in the
// middle, low houses toward the edges, parks, a beach and harbour water on the
// south edge, and emissive streetlights. Builds the meshes once and hands back
// the collision boxes the walker and the cars push against.
import { CITY, PALETTE } from './config.js';
import { facadeTexture, groundTexture } from './textures.js';
import { pick, range } from './random.js';

const CLADDING = ['#3a3f4d', '#4d3a44', '#37424e', '#4a4038', '#2f3a4a', '#51384a'];
const NEON = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonAmber, null, null];

function blockCentre(i) {
  return (i - (CITY.blocks - 1) / 2) * CITY.pitch;
}

/** Build the city into `scene`. Returns colliders, parks and the world bounds. */
export function buildCity(scene, rng) {
  const colliders = [];
  const parks = [];
  const group = new THREE.Group();
  group.name = 'city';

  // --- parks: three blocks kept green, with a few box trees
  const parkBlocks = [[1, 7], [7, 2], [8, 8]];
  const treeMat = new THREE.MeshLambertMaterial({ color: 0x2e6b34 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4128 });
  for (const [bi, bj] of parkBlocks) {
    const cx = blockCentre(bi);
    const cz = blockCentre(bj);
    const half = CITY.block / 2 - 6;
    parks.push({ minX: cx - half, maxX: cx + half, minZ: cz - half, maxZ: cz + half });
    for (let t = 0; t < 7; t += 1) {
      const tx = cx + range(rng, -half + 8, half - 8);
      const tz = cz + range(rng, -half + 8, half - 8);
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), trunkMat);
      trunk.position.set(tx, 1.1, tz);
      const top = new THREE.Mesh(new THREE.BoxGeometry(range(rng, 2.4, 4), range(rng, 2.4, 4), range(rng, 2.4, 4)), treeMat);
      top.position.set(tx, 3.4, tz);
      top.castShadow = true;
      group.add(trunk, top);
    }
  }
  const isPark = (bi, bj) => parkBlocks.some(([a, b]) => a === bi && b === bj);

  // --- ground: one big textured plane covering city + beach
  const span = CITY.blocks * CITY.pitch + 80;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(span, span + 260),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng, parks) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 110); // shifted south so the beach strip shows
  ground.receiveShadow = true;
  group.add(ground);

  // --- harbour water: a dark, slightly glossy plane past the beach
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(span + 400, 420),
    new THREE.MeshLambertMaterial({ color: 0x14324a, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.4, CITY.blocks * CITY.pitch / 2 + 40 + 210 + 110);
  group.add(water);

  // --- buildings, block by block
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x1c2027 });
  for (let bi = 0; bi < CITY.blocks; bi += 1) {
    for (let bj = 0; bj < CITY.blocks; bj += 1) {
      if (isPark(bi, bj)) continue;
      const cx = blockCentre(bi);
      const cz = blockCentre(bj);
      const downtown = Math.abs(bi - 4.5) <= 2 && Math.abs(bj - 4.5) <= 2;
      const edge = bi === 0 || bj === 0 || bi === CITY.blocks - 1 || bj === CITY.blocks - 1;
      const count = downtown ? 1 : edge ? 2 : Math.floor(rng() * 3) + 1;
      for (let n = 0; n < count; n += 1) {
        const w = downtown ? range(rng, 34, 52) : range(rng, 18, 40);
        const d = downtown ? range(rng, 34, 52) : range(rng, 18, 40);
        const h = downtown
          ? range(rng, 55, 150)
          : edge ? range(rng, 7, 16) : range(rng, 12, 42);
        const ox = count === 1 ? 0 : range(rng, -28, 28);
        const oz = count === 1 ? 0 : range(rng, -28, 28);
        const x = cx + ox;
        const z = cz + oz;
        const floors = Math.max(2, Math.round(h / 7));
        const cols = Math.max(3, Math.round(w / 9));
        const tex = facadeTexture(rng, pick(rng, CLADDING), floors, cols, downtown ? pick(rng, NEON) : null);
        const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5 });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        tower.position.set(x, h / 2, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 1.6, d * 0.55), roofMat);
        roof.position.set(x, h + 0.8, z);
        group.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // --- streetlights: a pole and a warm glowing head on every other corner
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const lampGeo = new THREE.BoxGeometry(0.5, 0.3, 1.6);
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
  for (let k = -CITY.blocks / 2; k <= CITY.blocks / 2; k += 1) {
    for (let m = -CITY.blocks / 2; m <= CITY.blocks / 2; m += 1) {
      if ((k + m) % 2 !== 0) continue;
      const x = k * CITY.pitch + CITY.street / 2 + 1.5;
      const z = m * CITY.pitch + CITY.street / 2 + 1.5;
      if (Math.abs(x) > CITY.blocks * CITY.pitch / 2 + 6 || Math.abs(z) > CITY.blocks * CITY.pitch / 2 + 6) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 3.5, z);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, 7, z);
      group.add(pole, lamp);
    }
  }

  scene.add(group);
  return {
    colliders,
    parks,
    bounds: CITY.blocks * CITY.pitch / 2 + 30, // beach is walkable to here
    waterZ: CITY.blocks * CITY.pitch / 2 + 40,
  };
}

/** Push a circle (x, z, radius) out of every building box it overlaps. */
export function resolveCollisions(x, z, radius, colliders) {
  let px = x;
  let pz = z;
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(px, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * radius;
      pz = cz + (dz / d) * radius;
    } else {
      // dead centre inside a box: shove out along the nearer face
      const pushLeft = px - b.minX;
      const pushRight = b.maxX - px;
      const pushBack = pz - b.minZ;
      const pushFront = b.maxZ - pz;
      const m = Math.min(pushLeft, pushRight, pushBack, pushFront);
      if (m === pushLeft) px = b.minX - radius;
      else if (m === pushRight) px = b.maxX + radius;
      else if (m === pushBack) pz = b.minZ - radius;
      else pz = b.maxZ + radius;
    }
  }
  return { x: px, z: pz };
}
