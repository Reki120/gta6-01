// The DOM overlay: cash, speed, health, wanted stars, the objective line, the
// 2D minimap, and the title / pause / game-over screens. The 3D view never
// touches the DOM; this module owns all of it.
import { CITY } from './config.js';
import { missionTarget } from './missions.js';

function starRow(wanted) {
  let out = '';
  for (let i = 0; i < 5; i += 1) out += i < wanted ? '★' : '☆';
  return out;
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const cash = el('hud-cash');
  const speed = el('hud-speed');
  const health = el('hud-health');
  const stars = el('hud-stars');
  const objective = el('hud-objective');
  const ammo = el('hud-ammo-count');
  const ammoBox = el('hud-ammo');
  const crosshair = el('hud-crosshair');
  const hit = el('hud-hit');
  const toast = el('hud-toast');
  const minimap = el('minimap');
  const ctx = minimap.getContext('2d');
  const overlays = {
    title: el('screen-title'),
    pause: el('screen-pause'),
    over: el('screen-over'),
    busted: el('screen-busted'),
  };
  const bestLine = el('title-best');
  const overLine = el('over-stats');
  const bustedLine = el('busted-stats');

  function show(name) {
    for (const key of Object.keys(overlays)) {
      overlays[key].classList.toggle('hidden', key !== name);
    }
  }

  /** Draw the top-down map: streets, parks, cars, the patrol car, Rook. */
  function drawMinimap(state) {
    const size = minimap.width;
    const span = CITY.blocks * CITY.pitch + 80;
    const toPx = (v) => ((v + span / 2) / span) * size;
    ctx.fillStyle = 'rgba(10,14,22,0.85)';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#2f5d3a';
    for (const park of state.city.parks) {
      ctx.fillRect(toPx(park.minX), toPx(park.minZ), toPx(park.maxX) - toPx(park.minX), toPx(park.maxZ) - toPx(park.minZ));
    }
    ctx.strokeStyle = '#565d6b';
    ctx.lineWidth = 2;
    for (let k = -CITY.blocks / 2; k <= CITY.blocks / 2; k += 1) {
      const c = toPx(k * CITY.pitch);
      ctx.beginPath(); ctx.moveTo(c, 0); ctx.lineTo(c, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, c); ctx.lineTo(size, c); ctx.stroke();
    }
    // parked cars
    ctx.fillStyle = '#ffd23e';
    for (const car of state.cars) {
      ctx.fillRect(toPx(car.x) - 2, toPx(car.z) - 2, 4, 4);
    }
    // traffic cars
    ctx.fillStyle = '#9aa3b5';
    for (const car of state.traffic || []) {
      ctx.fillRect(toPx(car.x) - 1.5, toPx(car.z) - 1.5, 3, 3);
    }
    // pedestrians
    ctx.fillStyle = '#7ddf9a';
    for (const ped of state.peds || []) {
      ctx.fillRect(toPx(ped.x) - 1, toPx(ped.z) - 1, 2, 2);
    }
    // mission marker: pink diamond
    if (state.mission) {
      const target = missionTarget(state);
      if (target) {
        const tx = toPx(target.x);
        const tz = toPx(target.z);
        ctx.fillStyle = '#ff2e88';
        ctx.beginPath();
        ctx.moveTo(tx, tz - 6);
        ctx.lineTo(tx + 5, tz);
        ctx.lineTo(tx, tz + 6);
        ctx.lineTo(tx - 5, tz);
        ctx.closePath();
        ctx.fill();
      }
    }
    // patrol cars
    for (const unit of state.policeUnits || []) {
      if (!unit.active) continue;
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(toPx(unit.x), toPx(unit.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rook: a white arrow pointing where he faces
    const p = state.player;
    const px = toPx(p.x);
    const pz = toPx(p.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - p.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    show,
    setBest(best) {
      bestLine.textContent = `Best cash: $${best.toLocaleString('en-US')}`;
    },
    setOver(state) {
      overLine.textContent = `Cash $${state.cash.toLocaleString('en-US')} · Best $${state.bestCash.toLocaleString('en-US')}`;
    },
    setBusted(state) {
      bustedLine.textContent = `The cops took $${state.bustedLost.toLocaleString('en-US')} of your cash. Cash now $${state.cash.toLocaleString('en-US')}.`;
    },
    update(state) {
      cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
      const car = state.activeCar >= 0 ? state.cars[state.activeCar] : null;
      const kmh = car ? Math.abs(car.speed) * 3.6 : Math.abs(state.player.speed) * 3.6;
      speed.textContent = `${Math.round(kmh)} km/h`;
      health.textContent = `${Math.round(state.health)}`;
      health.style.color = state.health < 35 ? '#ff5a5a' : '#eef1f5';
      stars.textContent = starRow(state.wanted);
      stars.style.color = state.wanted > 0 ? '#ffb02e' : '#8b93a3';
      objective.textContent = state.objective;
      // pistol: crosshair + ammo only on foot; HIT flash on a hit
      const onFoot = state.activeCar < 0;
      crosshair.classList.toggle('hidden', !onFoot);
      ammoBox.classList.toggle('hidden', !onFoot);
      ammo.textContent = state.combat.reloadTimer > 0
        ? 'Reloading…'
        : `${state.combat.ammo} / 12`;
      hit.classList.toggle('hidden', !(state.combat.hitFlash > 0));
      // mission banner (intro / complete / fail / busted)
      const banner = state.mission ? state.mission.banner : null;
      if (banner) {
        toast.textContent = banner.text;
        toast.classList.remove('hidden');
      } else {
        toast.classList.add('hidden');
      }
      drawMinimap(state);
    },
  };
}
