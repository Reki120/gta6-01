// The DOM HUD: cash, speed, health, wanted stars, the objective line, the "press E"
// prompt, and a 2D canvas minimap (streets, parks, the sea, the player arrow and the
// parked cars). Text is rebuilt only when its value changes.
import { FONT } from './config.js';

export function createHud(elements) {
  const { cashEl, speedEl, healthEl, healthBarEl, starsEl, objectiveEl, promptEl, minimap } = elements;
  const mapCtx = minimap.getContext('2d');
  const MAP_SIZE = 168;
  minimap.width = MAP_SIZE;
  minimap.height = MAP_SIZE;

  let lastCash = -1;
  let lastSpeed = -1;
  let lastHealth = -1;
  let lastWanted = -1;
  let lastObjective = '';
  let lastPrompt = '';

  function setText(el, value, last) {
    if (value !== last) el.textContent = value;
    return value;
  }

  function update(state, speedKmh) {
    lastCash = setText(cashEl, `$${state.cash}`, lastCash);
    const speed = Math.round(speedKmh);
    lastSpeed = setText(speedEl, state.mode === 'car' ? `${speed} km/h` : '', lastSpeed);
    lastHealth = setText(healthEl, `${state.health}`, lastHealth);
    if (healthBarEl) healthBarEl.style.width = `${state.health}%`;
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(Math.max(0, 5 - state.wanted));
    lastWanted = setText(starsEl, stars, lastWanted);
    lastObjective = setText(objectiveEl, state.objective, lastObjective);
    const prompt = state.mode === 'foot' && state.nearCar ? 'Press E to get in' : state.mode === 'car' ? 'Press E to get out (when stopped)' : '';
    lastPrompt = setText(promptEl, prompt, lastPrompt);
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const city = state.city;
    const half = city.half + 70;
    const scale = MAP_SIZE / (half * 2);
    const toMap = (x, z) => [(x + half) * scale, (z + half) * scale];

    mapCtx.fillStyle = '#14121e';
    mapCtx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // The sea along the bottom (south) edge.
    mapCtx.fillStyle = '#14425e';
    const [, seaY] = toMap(0, city.beachZ);
    mapCtx.fillRect(0, seaY, MAP_SIZE, MAP_SIZE - seaY);
    // Parks.
    mapCtx.fillStyle = '#1e4d2a';
    for (const park of city.parks) {
      const [x, y] = toMap(park.x - park.size / 2, park.z - park.size / 2);
      mapCtx.fillRect(x, y, park.size * scale, park.size * scale);
    }
    // Streets.
    mapCtx.fillStyle = '#3d3a52';
    for (let i = 0; i <= 10; i += 1) {
      const offset = (i - 5) * 132;
      const [x] = toMap(offset - 6, 0);
      mapCtx.fillRect(x, 0, 12 * scale, MAP_SIZE);
      const [, y] = toMap(0, offset - 6);
      mapCtx.fillRect(0, y, MAP_SIZE, 12 * scale);
    }
    // Parked cars (not the one being driven).
    for (let i = 0; i < state.cars.length; i += 1) {
      if (i === state.carIndex) continue;
      const car = state.cars[i];
      const [x, y] = toMap(car.x, car.z);
      mapCtx.fillStyle = '#f2c94c';
      mapCtx.beginPath();
      mapCtx.arc(x, y, 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // The player arrow, pointing along the heading.
    const [px, py] = toMap(state.player.x, state.player.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(state.player.heading);
    mapCtx.fillStyle = '#2ee6ff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(0, 3);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  /** Fill the title screen's best-cash line and the game-over summary. */
  function showTitle(bestCash) {
    const el = document.getElementById('title-best');
    if (el) el.textContent = bestCash > 0 ? `Best cash: $${bestCash}` : '';
  }

  function showGameOver(cash, bestCash) {
    const el = document.getElementById('over-stats');
    if (el) el.textContent = `Cash $${cash} · Best $${bestCash}`;
  }

  return { update, showTitle, showGameOver, FONT };
}
