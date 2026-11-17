// Combat: Rook's pistol, on foot only. Click to shoot down the camera's
// forward line, 12-round magazine, R to reload, short cooldown between shots.
// A tracer line and a hit flash give feedback; shooting a cop or a pedestrian
// is a crime, and cops shoot back when the heat is high.
export const MAG_SIZE = 12;
export const SHOT_COOLDOWN = 0.35;
export const SHOT_RANGE = 70;
export const RELOAD_TIME = 1.4;

export function createCombat(scene) {
  // tracer: a 2-point line, hidden until a shot is fired
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066 }));
  tracer.visible = false;
  tracer.frustumCulled = false;
  scene.add(tracer);
  return {
    ammo: MAG_SIZE,
    cooldown: 0,
    reloadTimer: 0,
    hitFlash: 0, // counts down; HUD shows HIT while > 0
    tracer, tracerTimer: 0,
  };
}

function setTracer(combat, from, to) {
  const pos = combat.tracer.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  combat.tracer.visible = true;
  combat.tracerTimer = 0.09;
}

function rayHit(origin, dir, target, radius) {
  // distance along the ray to the closest approach, and the miss distance
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const along = dx * dir.x + dz * dir.z;
  if (along < 0 || along > SHOT_RANGE) return null;
  const cx = origin.x + dir.x * along;
  const cz = origin.z + dir.z * along;
  const miss = Math.hypot(target.x - cx, target.z - cz);
  if (miss > radius) return null;
  return along;
}

/**
 * Fire one shot. `targets` is [{x, z, radius, kind, ref}] — police units,
 * pedestrians and traffic cars. Returns { kind, ref, along } for the nearest
 * hit, or null for a miss. Caller applies damage / wanted.
 */
export function shoot(state, targets) {
  const c = state.combat;
  if (c.cooldown > 0 || c.reloadTimer > 0) return null;
  if (c.ammo <= 0) {
    c.reloadTimer = RELOAD_TIME; // dry-fire starts a reload
    return null;
  }
  c.ammo -= 1;
  c.cooldown = SHOT_COOLDOWN;
  const p = state.player;
  const origin = { x: p.x, y: p.y + 1.5, z: p.z };
  const dir = { x: Math.sin(state.camYaw), z: Math.cos(state.camYaw) };
  let best = null;
  for (const t of targets) {
    const along = rayHit(origin, dir, t, t.radius);
    if (along !== null && (!best || along < best.along)) best = { ...t, along };
  }
  const end = best
    ? { x: origin.x + dir.x * best.along, y: 1.3, z: origin.z + dir.z * best.along }
    : { x: origin.x + dir.x * SHOT_RANGE, y: 1.3, z: origin.z + dir.z * SHOT_RANGE };
  setTracer(c, origin, end);
  if (best) c.hitFlash = 0.25;
  return best;
}

export function reload(state) {
  const c = state.combat;
  if (c.reloadTimer > 0 || c.ammo >= MAG_SIZE) return;
  c.reloadTimer = RELOAD_TIME;
}

export function stepCombat(state, dt) {
  const c = state.combat;
  if (c.cooldown > 0) c.cooldown -= dt;
  if (c.reloadTimer > 0) {
    c.reloadTimer -= dt;
    if (c.reloadTimer <= 0) c.ammo = MAG_SIZE;
  }
  if (c.hitFlash > 0) c.hitFlash -= dt;
  if (c.tracerTimer > 0) {
    c.tracerTimer -= dt;
    if (c.tracerTimer <= 0) c.tracer.visible = false;
  }
}
