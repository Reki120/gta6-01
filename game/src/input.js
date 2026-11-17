// Keyboard and pointer input. Held keys steer and drive; one-shot presses
// (confirm, pause, enter/exit a car) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const JUMP = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let dragYaw = 0;
  let dragPitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) ||
        RIGHT.has(event.code) || RUN.has(event.code) || JUMP.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (ENTER.has(event.code)) {
      actions |= ACTION_ENTER;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => held.clear());

  // Drag to look: pointer lock on click is a bonus, drag is the promise.
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    if (document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch { /* drag still works */ }
    }
  });
  canvas.addEventListener('pointermove', (event) => {
    if (document.pointerLockElement === canvas) {
      dragYaw -= event.movementX * 0.0032;
      dragPitch -= event.movementY * 0.0028;
      return;
    }
    if (!dragging) return;
    dragYaw -= (event.clientX - lastX) * 0.005;
    dragPitch -= (event.clientY - lastY) * 0.004;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  return {
    forward() { return [...FORWARD].some((c) => held.has(c)); },
    back() { return [...BACK].some((c) => held.has(c)); },
    left() { return [...LEFT].some((c) => held.has(c)); },
    right() { return [...RIGHT].some((c) => held.has(c)); },
    run() { return [...RUN].some((c) => held.has(c)); },
    jump() { return [...JUMP].some((c) => held.has(c)); },
    /** Camera orbit delta since the last call, in radians. */
    takeLook() {
      const look = { yaw: dragYaw, pitch: dragPitch };
      dragYaw = 0;
      dragPitch = 0;
      return look;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Test and autopilot helper: pretend a key is held. */
    setHeld(code, on) {
      if (on) held.add(code);
      else held.delete(code);
    },
  };
}
