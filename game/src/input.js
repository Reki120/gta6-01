// Keyboard and pointer input. Held keys give movement and driving; one-shot presses
// (confirm, pause, enter/exit car) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. Mouse drag
// orbits the camera; clicking the canvas also tries pointer lock for free look.
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

export function createInput(target) {
  const held = { forward: false, back: false, left: false, right: false, run: false, jump: false };
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function setHeld(code, value) {
    if (FORWARD.has(code)) held.forward = value;
    else if (BACK.has(code)) held.back = value;
    else if (LEFT.has(code)) held.left = value;
    else if (RIGHT.has(code)) held.right = value;
    else if (RUN.has(code)) held.run = value;
    else if (JUMP.has(code)) held.jump = value;
  }

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code) || JUMP.has(event.code)) {
      setHeld(event.code, true);
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => setHeld(event.code, false));
  // A key released while the tab is hidden never sends keyup: let go of everything.
  window.addEventListener('blur', () => {
    held.forward = held.back = held.left = held.right = held.run = held.jump = false;
    dragging = false;
  });

  target.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    if (document.pointerLockElement !== target) {
      try { target.requestPointerLock(); } catch { /* drag-look still works */ }
    }
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (event) => {
    if (document.pointerLockElement === target) {
      lookDX += event.movementX;
      lookDY += event.movementY;
    } else if (dragging) {
      lookDX += event.clientX - lastX;
      lookDY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  // Clicking the canvas on a menu screen confirms (start / restart).
  target.addEventListener('click', () => { actions |= ACTION_CONFIRM; });

  return {
    /** The held keys, as an object the world steps with. */
    keys() {
      return { ...held, enter: false };
    },
    /** One-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Mouse-look deltas since the last call, in pixels. */
    takeLook() {
      const look = { dx: lookDX, dy: lookDY };
      lookDX = 0;
      lookDY = 0;
      return look;
    },
  };
}
