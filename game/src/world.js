// The state of Neon Bay and one fixed step of it: walking, jumping, driving,
// entering and leaving cars, bumping into buildings, traffic and pedestrians,
// the police and the wanted level, Mara Voss's missions, the pistol, and the
// save file. The renderer only paints what is here.
import { CITY, PLAYER, CAR, SAVE_KEY, START_CASH, OBJECTIVE } from './config.js';
import { buildCity, resolveCollisions } from './city.js';
import { buildCharacter } from './character.js';
import { buildCar, paintJobs, stepCar } from './vehicles.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPeds, stepPeds, knockPedDown } from './peds.js';
import { MISSIONS, createMissionState, missionTarget, missionObjective, startMission, advanceMission, stepMission } from './missions.js';
import { createCombat, shoot, reload, stepCombat, MAG_SIZE } from './combat.js';

export const EVENT_NONE = 0;
export const EVENT_CRASH = 1;
export const EVENT_OVER = 2;
export const EVENT_BUSTED = 4;

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

export function addWanted(state, n) {
  state.wanted = Math.max(0, Math.min(5, state.wanted + n));
  state.wantedTimer = 0;
}

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
      owned: i === 0, // the car by the spawn is Rook's own; the rest are theft
      stolen: false,
      mesh: built.group, wheels: built.wheels,
    };
  });

  // five patrol cars, hidden until the wanted level calls them in
  const policeUnits = [];
  for (let i = 0; i < 5; i += 1) {
    const patrol = buildCar({ body: 0x14161c, trim: 0x111111 }, true);
    patrol.group.visible = false;
    scene.add(patrol.group);
    policeUnits.push({
      active: false, x: 0, z: 200, heading: Math.PI, speed: 0, vx: 0, vz: 0,
      mesh: patrol.group, wheels: patrol.wheels,
      hp: 100, arrestTimer: 0, fireTimer: 1.4, ramCooldown: 0, disabledTimer: 0,
    });
  }

  const traffic = createTraffic(scene, rng);
  const peds = createPeds(scene, rng);
  const combat = createCombat(scene);

  // mission beacon: a pink light pillar + ground ring at the current target
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  const beacon = new THREE.Group();
  beacon.add(beam, ring);
  scene.add(beacon);

  const completed = save ? save.missionsCompleted : [];
  const mission = createMissionState(completed);

  const state = {
    cash: save ? save.cash : START_CASH,
    bestCash: save ? save.bestCash : START_CASH,
    missionsCompleted: completed,
    health: 100,
    wanted: 0,
    wantedTimer: 0,
    loseTimer: 0, // how long the nearest cop has been >100m away
    policeCooldown: 0, // after losing the trail, no fresh patrols spawn for a while
    objective: OBJECTIVE,
    time: 0,
    bustedLost: 0,
    trafficHitCooldown: 0,
    trafficCrashCooldown: 0,
    player: {
      x: 6, y: 0, z: 43, vy: 0, heading: Math.PI,
      onGround: true, walkPhase: 0, moving: false, speed: 0,
      mesh: rook.group, rig: rook,
    },
    camYaw: Math.PI, // looking north, down the street toward downtown
    camPitch: 0.32,
    cars,
    activeCar: -1,
    police: policeUnits[0], // lead unit; the HUD and shots still read this
    policeUnits,
    traffic,
    peds,
    combat,
    mission,
    beacon,
    rng,
    city,
  };
  state.objective = missionObjective(state);
  updateBeacon(state);
  return state;
}

function updateBeacon(state) {
  const target = missionTarget(state);
  if (!target) {
    state.beacon.visible = false;
    return;
  }
  state.beacon.visible = true;
  state.beacon.position.set(target.x, 0, target.z);
}

/** Put Rook back on the street by the first car, cash and health restored. */
export function resetWorld(state) {
  state.health = 100;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.loseTimer = 0;
  state.policeCooldown = 0;
  state.activeCar = -1;
  state.bustedLost = 0;
  for (const unit of state.policeUnits) {
    unit.active = false;
    unit.mesh.visible = false;
    unit.hp = 100;
    unit.arrestTimer = 0;
    unit.speed = 0;
  }
  state.police.active = false;
  state.police.mesh.visible = false;
  state.combat.ammo = MAG_SIZE;
  state.combat.reloadTimer = 0;
  state.combat.cooldown = 0;
  state.combat.tracer.visible = false;
  state.mission.active = null;
  state.mission.next = state.missionsCompleted.length >= MISSIONS.length
    ? -1
    : MISSIONS.findIndex((m) => !state.missionsCompleted.includes(m.id));
  state.mission.banner = null;
  state.mission.timer = 0;
  state.objective = missionObjective(state);
  updateBeacon(state);
  for (const ped of state.peds) {
    if (ped.state === 'down') {
      ped.state = 'walk';
      ped.mesh.rotation.x = 0;
      ped.mesh.position.y = 0;
    }
  }
  for (const car of state.traffic) {
    car.stopTimer = 0;
    car.shove = 0;
  }
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

/** Keep the number of active patrol cars equal to the wanted level. */
function syncPolice(state) {
  const want = state.wanted;
  let active = 0;
  for (const unit of state.policeUnits) if (unit.active) active += 1;
  // right after Rook loses the trail, no fresh patrols spawn for a while
  if (active < want && state.policeCooldown <= 0) {
    for (const unit of state.policeUnits) {
      if (active >= want) break;
      if (unit.active || unit.disabledTimer > 0) continue;
      // spawn on a street ~90m from Rook, in a random direction
      const a = Math.random() * Math.PI * 2;
      const px = state.player.x + Math.sin(a) * 90;
      const pz = state.player.z + Math.cos(a) * 90;
      const fixed = resolveCollisions(
        Math.max(-state.city.bounds, Math.min(state.city.bounds, px)),
        Math.max(-state.city.bounds, Math.min(state.city.waterZ - 2, pz)),
        2, state.city.colliders,
      );
      unit.x = fixed.x;
      unit.z = fixed.z;
      unit.heading = Math.atan2(state.player.x - unit.x, state.player.z - unit.z);
      unit.speed = 18;
      unit.hp = 100;
      unit.arrestTimer = 0;
      unit.fireTimer = 1.4;
      unit.active = true;
      unit.mesh.visible = true;
      unit.mesh.rotation.z = 0;
      unit.mesh.position.set(unit.x, 0, unit.z);
      unit.mesh.rotation.y = unit.heading;
      active += 1;
    }
  } else if (active > want) {
    // switch off the furthest units first
    const actives = state.policeUnits
      .filter((u) => u.active)
      .sort((a, b) => {
        const da = Math.hypot(a.x - state.player.x, a.z - state.player.z);
        const db = Math.hypot(b.x - state.player.x, b.z - state.player.z);
        return db - da;
      });
    for (let i = 0; i < active - want; i += 1) {
      actives[i].active = false;
      actives[i].mesh.visible = false;
      actives[i].speed = 0;
    }
  }
  // keep the lead-unit alias pointing at an active unit when there is one
  const first = state.policeUnits.find((u) => u.active);
  state.police = first || state.policeUnits[0];
}

/** One patrol car steers toward Rook, rams his car, or closes in to arrest. */
function stepPoliceUnit(state, unit, dt) {
  if (unit.disabledTimer > 0) {
    unit.disabledTimer -= dt;
    unit.speed = Math.max(0, unit.speed - 20 * dt);
    unit.mesh.position.set(unit.x, 0, unit.z);
    if (unit.disabledTimer <= 0) {
      unit.active = false;
      unit.mesh.visible = false;
    }
    return false;
  }
  const target = state.activeCar >= 0 ? state.cars[state.activeCar] : state.player;
  const dx = target.x - unit.x;
  const dz = target.z - unit.z;
  const dist = Math.hypot(dx, dz);
  const onFoot = state.activeCar < 0;
  // arrest and return fire are checked before movement: a cop already on
  // top of Rook must still be able to arrest / shoot him
  if (onFoot && dist < 2.4) {
    unit.arrestTimer += dt;
    if (unit.arrestTimer > 1.2) return true; // busted
  } else {
    unit.arrestTimer = Math.max(0, unit.arrestTimer - dt * 2);
  }
  // return fire at 3+ stars when Rook is on foot and close
  if (onFoot && state.wanted >= 3 && dist < 30) {
    unit.fireTimer -= dt;
    if (unit.fireTimer <= 0) {
      unit.fireTimer = 1.4;
      state.health = Math.max(0, state.health - 4);
    }
  }
  if (dist < 1) return false;
  const want = Math.atan2(dx, dz);
  let diff = want - unit.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  unit.heading += Math.max(-1.8 * dt, Math.min(1.8 * dt, diff));
  // on foot the cop slows right down for the last few metres, so it can
  // stay on Rook and run the arrest clock instead of overshooting him
  const wantSpeed = onFoot
    ? (dist > 14 ? 26 + state.wanted * 2 : dist > 6 ? 12 : 3)
    : (dist > 26 ? 30 + state.wanted * 2 : 24 + state.wanted);
  unit.speed += (wantSpeed - unit.speed) * Math.min(1, 1.4 * dt);
  unit.x += Math.sin(unit.heading) * unit.speed * dt;
  unit.z += Math.cos(unit.heading) * unit.speed * dt;
  const fixed = resolveCollisions(unit.x, unit.z, 1.9, state.city.colliders);
  unit.x = fixed.x;
  unit.z = fixed.z;
  unit.mesh.position.set(unit.x, 0, unit.z);
  unit.mesh.rotation.y = unit.heading;
  const spin = unit.speed * dt / 0.38;
  for (const wheel of unit.wheels) wheel.rotation.x += spin;
  if (unit.ramCooldown > 0) unit.ramCooldown -= dt;

  // ramming Rook's car hurts him and slows the car
  if (!onFoot && dist < 3.8 && unit.ramCooldown <= 0) {
    const car = state.cars[state.activeCar];
    car.speed *= 0.7;
    car.vx *= 0.7;
    car.vz *= 0.7;
    state.health = Math.max(0, state.health - 2);
    unit.speed *= 0.6;
    unit.ramCooldown = 1;
  }
  return false;
}

function applyBusted(state) {
  const lost = Math.max(50, Math.round(state.cash * 0.25));
  state.cash = Math.max(0, state.cash - lost);
  state.bustedLost = lost;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.health = 100;
  for (const unit of state.policeUnits) {
    unit.active = false;
    unit.mesh.visible = false;
    unit.speed = 0;
    unit.arrestTimer = 0;
  }
  state.police.active = false;
  state.police.mesh.visible = false;
  if (state.mission) state.mission.banner = { text: `BUSTED! Mara Voss's job is still waiting — but the cops took $${lost}.`, t: 5 };
  state.objective = missionObjective(state);
  updateBeacon(state);
}

/** Rook's car against traffic, pedestrians and patrol cars. */
function stepCarCollisions(state) {
  if (state.activeCar < 0) return;
  const car = state.cars[state.activeCar];
  const speed = Math.abs(car.speed);
  // traffic cars
  for (const t of state.traffic) {
    const d = Math.hypot(t.x - car.x, t.z - car.z);
    if (d >= 3.6) continue;
    // shove the traffic car aside and slow both down
    const dx = t.x - car.x;
    const dz = t.z - car.z;
    const len = Math.hypot(dx, dz) || 1;
    t.shove += ((dx / len) * 6 + (dz / len) * 6) * 0.5;
    t.stopTimer = Math.max(t.stopTimer, 0.8);
    if (speed > 10 && state.trafficCrashCooldown <= 0) {
      state.trafficCrashCooldown = 4;
      car.speed *= 0.5;
      car.vx *= 0.5;
      car.vz *= 0.5;
      state.health = Math.max(0, state.health - 5);
      addWanted(state, 1); // reckless driving into traffic
    } else if (speed > 2) {
      car.speed *= 0.92;
    }
  }
  // pedestrians: a fast car is a weapon
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - car.x, ped.z - car.z);
    if (d < 2.2 && speed > 4) {
      knockPedDown(ped, 5);
      car.speed *= 0.9;
      addWanted(state, 2);
    }
  }
  // ramming a patrol car
  for (const unit of state.policeUnits) {
    if (!unit.active || unit.disabledTimer > 0) continue;
    const d = Math.hypot(unit.x - car.x, unit.z - car.z);
    if (d < 3.8 && speed > 8 && unit.ramCooldown <= 0) {
      unit.ramCooldown = 3;
      unit.speed *= 0.3;
      car.speed *= 0.6;
      state.health = Math.max(0, state.health - 3);
      addWanted(state, 2);
    }
  }
}

/** A traffic car hitting Rook on foot knocks him down (health, not death). */
function stepFootTrafficHit(state) {
  if (state.activeCar >= 0 || state.trafficHitCooldown > 0) return;
  const p = state.player;
  for (const t of state.traffic) {
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if (d < 1.8 && Math.abs(t.speed) > 5) {
      state.health = Math.max(0, state.health - 8);
      state.trafficHitCooldown = 2;
      t.stopTimer = 2;
      // knock Rook sideways, away from the car
      const dx = p.x - t.x;
      const dz = p.z - t.z;
      const len = Math.hypot(dx, dz) || 1;
      p.x += (dx / len) * 3;
      p.z += (dz / len) * 3;
      break;
    }
  }
}

function handleShoot(state) {
  if (state.activeCar >= 0) return; // pistol is on-foot only
  const targets = [];
  for (const unit of state.policeUnits) {
    if (unit.active && unit.disabledTimer <= 0) targets.push({ x: unit.x, z: unit.z, radius: 1.4, kind: 'cop', ref: unit });
  }
  for (const ped of state.peds) {
    if (ped.state !== 'down') targets.push({ x: ped.x, z: ped.z, radius: 1.0, kind: 'ped', ref: ped });
  }
  for (const t of state.traffic) targets.push({ x: t.x, z: t.z, radius: 2.2, kind: 'car', ref: t });
  const hit = shoot(state, targets);
  if (!hit) return;
  if (hit.kind === 'ped') {
    knockPedDown(hit.ref, 6);
    addWanted(state, 2);
  } else if (hit.kind === 'cop') {
    hit.ref.hp -= 34;
    addWanted(state, 2);
    if (hit.ref.hp <= 0) {
      hit.ref.disabledTimer = 8; // shot-up patrol car pulls over, crew down
      hit.ref.mesh.rotation.z = 0.12;
    }
  } else if (hit.kind === 'car') {
    hit.ref.stopTimer = 4;
    hit.ref.speed = 0;
  }
}

/** Mission target reached? Advance (or start) the job. */
function checkMissionProximity(state) {
  const m = state.mission;
  if (!m) return;
  const p = state.activeCar >= 0 ? state.cars[state.activeCar] : state.player;
  if (!m.active) {
    // near the start marker, on foot: E starts it (handled in stepWorld);
    // walking onto it also shows the prompt via the objective line
    return;
  }
  const def = MISSIONS[m.active.index];
  const stage = def.stages[m.active.stage];
  if (!stage || stage.loseHeat || stage.car) return;
  const d = Math.hypot(stage.x - p.x, stage.z - p.z);
  if (d > 7) return;
  if (stage.onFoot && state.activeCar >= 0) return;
  if (stage.inCar && state.activeCar < 0) return;
  advanceMission(state);
  updateBeacon(state);
}

/**
 * Advance the world one fixed step. `controls` is the plain object the loop
 * builds from the keyboard (or the shots autopilot builds): forward/back/
 * left/right/run/jump booleans, an enter one-shot, shoot/reload one-shots,
 * and look yaw/pitch deltas.
 */
export function stepWorld(state, dt, controls) {
  state.time += dt;
  state.camYaw += controls.lookYaw || 0;
  state.camPitch = Math.max(-0.15, Math.min(1.1, state.camPitch + (controls.lookPitch || 0)));

  let events = EVENT_NONE;
  if (state.trafficHitCooldown > 0) state.trafficHitCooldown -= dt;
  if (state.trafficCrashCooldown > 0) state.trafficCrashCooldown -= dt;
  if (state.policeCooldown > 0) state.policeCooldown -= dt;

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
      // mission first: near the start marker, E starts the job
      const target = missionTarget(state);
      const m = state.mission;
      if (!m.active && m.next >= 0 && target) {
        const d = Math.hypot(target.x - state.player.x, target.z - state.player.z);
        if (d < 7) {
          if (startMission(state)) {
            updateBeacon(state);
            controls.enter = false;
          }
        }
      }
      if (controls.enter) {
        const i = nearestCar(state, CAR.enterDistance);
        if (i >= 0) {
          const taking = state.cars[i];
          // stealing the Hot Wheels target advances that job
          if (m.active && MISSIONS[m.active.index].id === 'hotwheels' && m.active.stage === 0 &&
              MISSIONS[m.active.index].targetCar === i) {
            advanceMission(state);
            updateBeacon(state);
            taking.stolen = true;
          } else if (!taking.owned && !taking.stolen) {
            // taking someone else's parked car is grand theft auto
            taking.stolen = true;
            addWanted(state, 1);
          }
          state.activeCar = i;
          state.player.mesh.visible = false;
        }
      }
    }
  }

  if (controls.reload) reload(state);
  if (controls.shoot) handleShoot(state);

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

  // traffic and pedestrians keep moving whether Rook drives or walks
  const playerCar = state.activeCar >= 0 ? state.cars[state.activeCar] : null;
  stepTraffic(state.traffic, dt, playerCar, state.rng);
  const allCars = [...state.traffic];
  if (playerCar) allCars.push(playerCar);
  for (const unit of state.policeUnits) if (unit.active) allCars.push(unit);
  stepPeds(state.peds, dt, allCars);
  stepCarCollisions(state);
  stepFootTrafficHit(state);

  // police: numbers follow the wanted level, then each unit pursues
  syncPolice(state);
  for (const unit of state.policeUnits) {
    if (!unit.active) continue;
    if (stepPoliceUnit(state, unit, dt)) {
      applyBusted(state);
      return EVENT_BUSTED;
    }
  }

  // wanted decays only when no patrol car can see Rook; outrun them past
  // 100m for a few seconds and they lose the trail: the heat drops a star
  // and no fresh patrols spawn for a while, so the rest can decay away
  if (state.wanted > 0) {
    let nearest = Infinity;
    for (const unit of state.policeUnits) {
      if (!unit.active) continue;
      nearest = Math.min(nearest, Math.hypot(unit.x - state.player.x, unit.z - state.player.z));
    }
    if (nearest > 100) {
      state.loseTimer += dt;
      if (state.loseTimer > 6) {
        for (const unit of state.policeUnits) {
          unit.active = false;
          unit.mesh.visible = false;
          unit.speed = 0;
        }
        state.loseTimer = 0;
        state.wanted = Math.max(0, state.wanted - 1);
        state.wantedTimer = 0;
        state.policeCooldown = 20;
        nearest = Infinity;
      }
    } else {
      state.loseTimer = 0;
    }
    if (nearest > 60) {
      state.wantedTimer += dt;
      if (state.wantedTimer > 8 + state.wanted * 4) {
        state.wanted -= 1;
        state.wantedTimer = 0;
      }
    } else {
      state.wantedTimer = 0;
    }
  }

  stepMission(state, dt);
  checkMissionProximity(state);
  updateBeacon(state);
  stepCombat(state, dt);

  if (state.health < 100) state.health = Math.min(100, state.health + 0.8 * dt);
  if (state.health <= 0) return EVENT_OVER;
  if (state.cash > state.bestCash) {
    state.bestCash = state.cash;
    saveGame(state);
  }
  return events;
}
