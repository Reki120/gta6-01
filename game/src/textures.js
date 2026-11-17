// Canvas textures painted at runtime — no image files, no network.
// Facades get lit windows for the dusk look; the ground gets the whole street map.
import { CITY, PALETTE } from './config.js';

/** A building face: dark cladding, a grid of windows, some of them warmly lit. */
export function facadeTexture(rng, base, floors, columns, neon) {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  // faint vertical seams between panels
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let c = 0; c <= columns; c += 1) ctx.fillRect((c * w) / columns - 1, 0, 2, h);
  const lit = ['#ffd27a', '#ffe9a8', '#9be8ff', '#ff9ecf'];
  for (let f = 0; f < floors; f += 1) {
    for (let c = 0; c < columns; c += 1) {
      const x = 10 + (c * (w - 20)) / columns;
      const y = 12 + (f * (h - 24)) / floors;
      const ww = (w - 20) / columns - 8;
      const hh = (h - 24) / floors - 8;
      if (rng() < 0.42) {
        ctx.fillStyle = lit[Math.floor(rng() * lit.length)];
        ctx.fillRect(x, y, ww, hh);
      } else {
        ctx.fillStyle = 'rgba(8,12,24,0.85)';
        ctx.fillRect(x, y, ww, hh);
      }
    }
  }
  if (neon) {
    // a glowing sign band near the roofline
    ctx.fillStyle = neon;
    ctx.fillRect(0, 6, w, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 8, w, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * The ground seen from above: asphalt base, the street grid with dashed centre
 * lines, pale sidewalks around each block, green parks, and the sand strip
 * along the south edge where the city meets the harbour.
 */
export function groundTexture(rng, parks) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = (CITY.blocks * CITY.pitch) / 2; // 660
  const toPx = (v) => ((v + half + 40) / (half * 2 + 80)) * size;
  ctx.fillStyle = '#4a505c'; // asphalt base, lifted so dusk shadows stay readable
  ctx.fillRect(0, 0, size, size);
  // sand along the south edge
  ctx.fillStyle = PALETTE.beach;
  ctx.fillRect(0, toPx(half), size, size - toPx(half));
  // parks
  ctx.fillStyle = '#2f5d3a';
  for (const park of parks) {
    ctx.fillRect(toPx(park.minX), toPx(park.minZ), toPx(park.maxX) - toPx(park.minX), toPx(park.maxZ) - toPx(park.minZ));
  }
  // streets: pale sidewalk border, darker road, dashed centre line.
  // Street centrelines sit on multiples of the pitch, between the blocks.
  const centres = [];
  for (let k = -CITY.blocks / 2; k <= CITY.blocks / 2; k += 1) centres.push(k * CITY.pitch);
  for (const c of centres) {
    ctx.fillStyle = '#565b66'; // sidewalk edge
    ctx.fillRect(toPx(c - CITY.street / 2 - 4), 0, toPx(CITY.street + 8) - toPx(0), size);
    ctx.fillRect(0, toPx(c - CITY.street / 2 - 4), size, toPx(CITY.street + 8) - toPx(0));
    ctx.fillStyle = '#626874'; // road
    ctx.fillRect(toPx(c - CITY.street / 2), 0, toPx(CITY.street) - toPx(0), size);
    ctx.fillRect(0, toPx(c - CITY.street / 2), size, toPx(CITY.street) - toPx(0));
    // dashed centre line
    ctx.fillStyle = 'rgba(230,220,150,0.55)';
    const dash = toPx(6) - toPx(0);
    for (let v = -half - 40; v < half + 40; v += 18) {
      ctx.fillRect(toPx(c) - 1, toPx(v), 2, dash);
      ctx.fillRect(toPx(v), toPx(c) - 1, dash, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
