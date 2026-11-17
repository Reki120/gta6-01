// NEON BAY — boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title, play,
// paused and game over. Save data lives in localStorage under NEONBAY_SAVE_V1.
//
// ?seed=N fixes the city. ?shot=start|drive|foot|chase (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ENTER, EVENT_EXIT } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, createInput } from './input.js';
import { createHud } from './hud.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const world = createWorld(random);
const renderer = createRenderer(canvas, random);
const hud = createHud({
  cashEl: document.getElementById('hud-cash'),
  speedEl: document.getElementById('hud-speed'),
  healthEl: document.getElementById('hud-health'),
  healthBarEl: document.getElementById('hud-health-bar'),
  starsEl: document.getElementById('hud-stars'),
  objectiveEl: document.getElementById('hud-objective'),
  promptEl: document.getElementById('hud-prompt'),
  minimap: document.getElementById('minimap'),
});

const screens = {
  [SCREEN_TITLE]: document.getElementById('screen-title'),
  [SCREEN_PAUSED]: document.getElementById('screen-paused'),
  [SCREEN_OVER]: document.getElementById('screen-over'),
};
const hudEl = document.getElementById('hud');

function readSave() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
    if (parsed && typeof parsed === 'object') {
      return {
        cash: Number(parsed.cash) || 0,
        bestCash: Number(parsed.bestCash) || 0,
        missionsCompleted: Array.isArray(parsed.missionsCompleted) ? parsed.missionsCompleted : [],
      };
    }
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
  return { cash: 250, bestCash: 250, missionsCompleted: [] };
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // See readSave: storage off means the save lasts this visit only.
  }
}

const save = readSave();
world.state.cash = save.cash;
world.state.bestCash = save.bestCash;

function persist() {
  save.cash = world.state.cash;
  save.bestCash = Math.max(save.bestCash, world.state.cash);
  world.state.bestCash = save.bestCash;
  writeSave(save);
}

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    if (screens[key]) screens[key].classList.toggle('hidden', key !== name);
  }
  if (hudEl) hudEl.classList.toggle('hidden', name !== SCREEN_PLAY);
}

function runShot(name) {
  const scene = stageShot(name, world);
  renderer.snapCamera(world.state);
  renderer.buildActors(world.state);
  showScreen(scene.screen);
  hud.showTitle(save.bestCash);
  hud.update(world.state, world.speedKmh());
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.state.cash = save.cash;
    world.state.bestCash = save.bestCash;
    renderer.buildActors(world.state);
    renderer.snapCamera(world.state);
    accumulator = 0;
    screen = SCREEN_PLAY;
    showScreen(screen);
    announce('Playing Neon Bay. Find a ride.');
  }

  function endGame() {
    persist();
    screen = SCREEN_OVER;
    showScreen(screen);
    hud.showGameOver(world.state.cash, save.bestCash);
    announce(`Game over. Cash $${world.state.cash}. Best $${save.bestCash}.`);
  }

  function setScreen(next) {
    screen = next;
    showScreen(screen);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      setScreen(SCREEN_PLAY);
      announce('Playing.');
    }
    return actions;
  }

  function applyLook() {
    const look = input.takeLook();
    if (look.dx === 0 && look.dy === 0) return;
    world.state.camera.yaw -= look.dx * 0.004;
    world.state.camera.pitch = Math.max(0.05, Math.min(1.1, world.state.camera.pitch + look.dy * 0.003));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    applyLook();
    if (screen === SCREEN_PLAY) {
      let enterPending = Boolean(actions & ACTION_ENTER);
      while (accumulator >= STEP) {
        const keys = input.keys();
        keys.enter = enterPending;
        enterPending = false; // one press, one enter/exit — never both in one frame
        const events = world.step(STEP, keys);
        if (events & EVENT_ENTER) { persist(); announce('You are driving. W A S D to drive, E to get out when stopped.'); }
        if (events & EVENT_EXIT) { persist(); announce('On foot. Find another car with E.'); }
        if (world.state.health <= 0) {
          endGame();
          break;
        }
        accumulator -= STEP;
      }
      if (screen === SCREEN_PLAY) {
        hud.update(world.state, world.speedKmh());
        renderer.draw(world.state, screen, STEP);
      }
    } else if (screen === SCREEN_TITLE) {
      // The city idles behind the title screen.
      while (accumulator >= STEP) {
        world.step(STEP, { forward: false, back: false, left: false, right: false, run: false, jump: false, enter: false });
        accumulator -= STEP;
      }
      renderer.draw(world.state, screen, STEP);
    } else {
      accumulator = 0;
      renderer.draw(world.state, screen, STEP);
    }
  }

  // Leaving the tab pauses a running game and saves, rather than losing progress.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persist();
      if (screen === SCREEN_PLAY) {
        setScreen(SCREEN_PAUSED);
        announce('Paused.');
      }
    }
  });
  window.addEventListener('beforeunload', persist);

  hud.showTitle(save.bestCash);
  showScreen(SCREEN_TITLE);
  announce('Neon Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

// A harmless hook for play-testing: the live state, read-only from the console.
window.__game = { world, get state() { return world.state; }, save };

if (shot) runShot(shot);
else runGame();
