// Canvas-generated textures, made at runtime: lit windows for building faces, a neon
// sign strip, and a road surface with a centre line. No image files, no network.
import { PALETTE } from './config.js';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A facade of glowing windows on a dark wall. `lit` is the share of windows lit. */
export function windowTexture(random, base, lit) {
  const { canvas, ctx } = makeCanvas(128, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 6;
  const rows = 14;
  const w = 128 / cols;
  const h = 256 / rows;
  const litColours = ['#ffd98a', '#9be8ff', '#ff9ecf', '#fff3c4'];
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      if (random() < lit) {
        ctx.fillStyle = litColours[Math.floor(random() * litColours.length)];
        ctx.globalAlpha = 0.55 + random() * 0.45;
      } else {
        ctx.fillStyle = '#101018';
        ctx.globalAlpha = 1;
      }
      ctx.fillRect(c * w + 3, r * h + 4, w - 6, h - 8);
    }
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
}

/** A vertical neon sign strip in one glow colour, with dark brackets between signs. */
export function neonTexture(colour) {
  const { canvas, ctx } = makeCanvas(32, 256);
  ctx.fillStyle = '#0c0a14';
  ctx.fillRect(0, 0, 32, 256);
  ctx.fillStyle = colour;
  for (let y = 8; y < 256; y += 42) {
    ctx.globalAlpha = 0.9;
    ctx.fillRect(6, y, 20, 26);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(2, y - 3, 28, 32);
  }
  ctx.globalAlpha = 1;
  return toTexture(canvas);
}

/** Dark asphalt with a dashed centre line running along the texture's length. */
export function roadTexture() {
  const { canvas, ctx } = makeCanvas(64, 256);
  ctx.fillStyle = '#2a2738';
  ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = '#565270';
  for (let y = 0; y < 256; y += 32) ctx.fillRect(30, y, 4, 18);
  // Faint tyre wear on both lanes.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(10, 0, 8, 256);
  ctx.fillRect(46, 0, 8, 256);
  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** A plain flat colour texture (used for the sea and the sand so they shade evenly). */
export function flatTexture(hex) {
  const { canvas, ctx } = makeCanvas(4, 4);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 4, 4);
  return toTexture(canvas);
}

export { PALETTE };
