// Missions for Mara Voss: four jobs in order, each a start marker (walk up
// and press E), a beacon + minimap marker, and a cash reward. Progress is the
// save file's missionsCompleted list; the next job is the first not in it.
// Stages are simple: go to a point (on foot), or steal a named car and drive
// it to a point, or lose a wanted level, or a timed multi-stop run.
export const MISSIONS = [
  {
    id: 'pickup',
    title: 'First Pickup',
    reward: 400,
    intro: 'Mara Voss: "Rook. A package is waiting downtown. Pick it up, bring it to the docks contact. No detours."',
    start: { x: 0, z: 132, label: 'Meet the contact' },
    stages: [
      { x: 264, z: -132, label: 'Pick up the package downtown', onFoot: true },
      { x: -264, z: 132, label: 'Deliver the package to the docks', onFoot: true },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    reward: 600,
    intro: 'Mara Voss: "A Lagoon coupe is parked up north — I need it. Take it, and bring it to the lockup. Quietly."',
    start: { x: -132, z: 0, label: 'Mara has a job for you' },
    targetCar: 1, // cars[1], the Lagoon parked at (-138, -198)
    stages: [
      { x: -138, z: -198, label: 'Steal the Lagoon coupe (press E by the car)', car: true },
      { x: 264, z: 264, label: 'Deliver the Lagoon to the lockup', inCar: true },
    ],
  },
  {
    id: 'getaway',
    title: 'Getaway',
    reward: 500,
    intro: 'Mara Voss: "The cops are onto the last job. You start hot — lose them, then come see me. Do not get caught."',
    start: { x: 0, z: -132, label: 'Mara has a job for you' },
    startWanted: 2,
    stages: [
      { x: 0, z: 0, label: 'Lose the heat — get your wanted level to zero', loseHeat: true },
    ],
  },
  {
    id: 'bigscore',
    title: 'The Big Score',
    reward: 1200,
    intro: 'Mara Voss: "Three drops, one night, and the whole city watching. Four minutes. Make me proud, Rook."',
    start: { x: 132, z: 132, label: 'Mara has a job for you' },
    timeLimit: 240,
    stages: [
      { x: 396, z: -264, label: 'Drop 1 of 3 — north-east', onFoot: false },
      { x: -396, z: 264, label: 'Drop 2 of 3 — south-west', onFoot: false },
      { x: 0, z: 396, label: 'Drop 3 of 3 — the beach', onFoot: false },
    ],
  },
];

/** Index of the next mission to offer, or -1 when all four are done. */
export function nextMissionIndex(completed) {
  for (let i = 0; i < MISSIONS.length; i += 1) {
    if (!completed.includes(MISSIONS[i].id)) return i;
  }
  return -1;
}

export function createMissionState(completed) {
  return {
    active: null, // { index, stage } while a job is running
    next: nextMissionIndex(completed),
    timer: 0, // counts down for timed jobs
    banner: null, // { text, t } shown on screen for a few seconds
  };
}

export function missionTarget(state) {
  const m = state.mission;
  if (!m) return null;
  if (m.active) {
    const def = MISSIONS[m.active.index];
    const stage = def.stages[m.active.stage];
    return stage ? { x: stage.x, z: stage.z, label: stage.label } : null;
  }
  if (m.next >= 0) {
    const def = MISSIONS[m.next];
    return { x: def.start.x, z: def.start.z, label: def.start.label };
  }
  return null;
}

export function missionObjective(state) {
  const m = state.mission;
  if (!m) return '';
  if (m.active) {
    const def = MISSIONS[m.active.index];
    const stage = def.stages[m.active.stage];
    let text = stage ? stage.label : def.title;
    if (def.timeLimit) text += ` — ${Math.max(0, Math.ceil(m.timer))}s left`;
    return `${def.title}: ${text}`;
  }
  if (m.next >= 0) return `Mara Voss: ${MISSIONS[m.next].title} — go to the pink marker (press E).`;
  return 'All jobs done for Mara Voss. Free roam — the city is yours.';
}

/** Start the next mission. Returns true if one started. */
export function startMission(state) {
  const m = state.mission;
  if (!m || m.active || m.next < 0) return false;
  const def = MISSIONS[m.next];
  m.active = { index: m.next, stage: 0 };
  m.timer = def.timeLimit || 0;
  m.banner = { text: def.intro, t: 6 };
  state.objective = missionObjective(state);
  if (def.startWanted) state.wanted = Math.max(state.wanted, def.startWanted);
  return true;
}

/**
 * Advance the active mission. Called when Rook reaches the current target
 * (on foot, in the car, or by stealing the target car). Returns 'complete'
 * when the last stage is done, 'stage' when a stage advanced, else null.
 */
export function advanceMission(state) {
  const m = state.mission;
  if (!m || !m.active) return null;
  const def = MISSIONS[m.active.index];
  const stage = def.stages[m.active.stage];
  if (!stage) return null;
  if (def.id === 'bigscore') {
    // every drop draws heat
    state.wanted = Math.min(5, state.wanted + 1);
  }
  m.active.stage += 1;
  if (m.active.stage >= def.stages.length) {
    state.cash += def.reward;
    if (!state.missionsCompleted.includes(def.id)) state.missionsCompleted.push(def.id);
    m.active = null;
    m.next = nextMissionIndex(state.missionsCompleted);
    m.banner = { text: `${def.title} complete! Mara Voss paid you $${def.reward}.`, t: 5 };
    state.objective = missionObjective(state);
    return 'complete';
  }
  state.objective = missionObjective(state);
  return 'stage';
}

/** Fail a timed mission: back to the start marker, ready to retry. */
export function failMission(state, reason) {
  const m = state.mission;
  if (!m || !m.active) return;
  const def = MISSIONS[m.active.index];
  m.active = null;
  m.banner = { text: `${def.title} failed — ${reason} Go back to the pink marker to try again.`, t: 5 };
  state.objective = missionObjective(state);
}

/** Per-step mission bookkeeping: timer, lose-heat completion. */
export function stepMission(state, dt) {
  const m = state.mission;
  if (!m) return;
  if (m.banner) {
    m.banner.t -= dt;
    if (m.banner.t <= 0) m.banner = null;
  }
  if (!m.active) return;
  const def = MISSIONS[m.active.index];
  if (def.timeLimit) {
    m.timer -= dt;
    state.objective = missionObjective(state);
    if (m.timer <= 0) failMission(state, 'out of time.');
  }
  const stage = def.stages[m.active.stage];
  if (stage && stage.loseHeat && state.wanted <= 0) advanceMission(state);
}
