// Neon Bay boot: read the save, build the world, run the fixed-step loop and
// the four screens (title, play, paused, game over). ?shot=start|drive|foot|
// chase (with &seed=N) stages that scene instead, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, loadSave, resetWorld, saveGame, stepWorld, EVENT_OVER } from './world.js';
import { createView } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER } from './input.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const view = createView(canvas);
const hud = createHud();
const save = loadSave();
const state = createWorld(view.scene, createRandom(seed), save);
const input = createInput(canvas);

function announce(message) {
  status.textContent = message;
}

function runShot(name) {
  const scene = stageShot(name, state);
  hud.setBest(state.bestCash);
  if (scene.screen === 'title') hud.show('title');
  else hud.show(null);
  hud.update(state);
  // Snap the smoothed chase camera onto the staged subject first: with only
  // two paints, its lag would otherwise leave it hundreds of metres behind.
  view.draw(state, 1);
  let painted = 0;
  function paint() {
    view.draw(state, STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = 'title';
  let accumulator = 0;
  let last = performance.now();

  // A harmless hook for automated smoke tests: position, speed, car, health.
  window.__game = {
    state,
    screen: () => screen,
    player() {
      return { x: state.player.x, z: state.player.z, y: state.player.y, heading: state.player.heading };
    },
    speedKmh() {
      const car = state.activeCar >= 0 ? state.cars[state.activeCar] : null;
      return car ? Math.abs(car.speed) * 3.6 : Math.abs(state.player.speed) * 3.6;
    },
    inCar() { return state.activeCar >= 0; },
    health() { return state.health; },
  };

  function startGame() {
    resetWorld(state);
    screen = 'play';
    hud.show(null);
    announce('Playing. Drive to the harbour and meet Mara Voss.');
  }

  function endGame() {
    screen = 'over';
    hud.setOver(state);
    hud.show('over');
    saveGame(state);
    announce(`Game over. Cash $${state.cash}. Best $${state.bestCash}.`);
  }

  function readControls() {
    const look = input.takeLook();
    return {
      forward: input.forward(),
      back: input.back(),
      left: input.left(),
      right: input.right(),
      run: input.run(),
      jump: input.jump(),
      enter: false,
      lookYaw: look.yaw,
      lookPitch: look.pitch,
    };
  }

  function handleActions(controls) {
    const actions = input.takeActions();
    if (actions & ACTION_ENTER) controls.enter = true;
    if (actions & ACTION_CONFIRM && (screen === 'title' || screen === 'over')) startGame();
    else if (actions & ACTION_PAUSE && screen === 'play') {
      screen = 'paused';
      hud.show('pause');
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'paused') {
      screen = 'play';
      hud.show(null);
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    const controls = readControls();
    handleActions(controls);
    if (screen === 'play') {
      while (accumulator >= STEP) {
        const events = stepWorld(state, STEP, controls);
        controls.enter = false;
        accumulator -= STEP;
        if (events & EVENT_OVER) {
          endGame();
          break;
        }
      }
    } else {
      accumulator = 0;
      if (screen === 'title') {
        // the city idles behind the title: slow orbit, Rook on the street
        state.camYaw += frameDt * 0.03;
      }
    }
    hud.update(state);
    view.draw(state, frameDt || STEP);
  }

  canvas.addEventListener('pointerdown', () => {
    if (screen === 'title' || screen === 'over') startGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveGame(state);
      if (screen === 'play') {
        screen = 'paused';
        hud.show('pause');
        announce('Paused.');
      }
    }
  });
  window.addEventListener('beforeunload', () => saveGame(state));

  hud.setBest(state.bestCash);
  hud.show('title');
  announce('Neon Bay. Press Enter or click to start. WASD to move, E to enter a car.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
