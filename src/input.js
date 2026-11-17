/* MIDNIGHT CIRCUIT — input: keyboard plus a drag-to-look pointer. */

export function createInput(canvas) {
  const state = {
    throttle: false, brake: false, left: false, right: false, nitrous: false,
  };

  const look = { yaw: 0, pitch: 0, dragging: false, lastX: 0, lastY: 0 };

  const keymap = {
    KeyW: 'throttle', ArrowUp: 'throttle',
    KeyS: 'brake', ArrowDown: 'brake',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'nitrous', ShiftRight: 'nitrous',
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    const action = keymap[event.code];
    if (action) {
      state[action] = true;
      event.preventDefault();
    }
    if (event.code === 'KeyR') emit('recover');
    if (event.code === 'Escape') emit('pause');
  }

  function onKeyUp(event) {
    const action = keymap[event.code];
    if (action) {
      state[action] = false;
      event.preventDefault();
    }
  }

  function onPointerDown(event) {
    look.dragging = true;
    look.lastX = event.clientX;
    look.lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!look.dragging) return;
    const dx = event.clientX - look.lastX;
    const dy = event.clientY - look.lastY;
    look.lastX = event.clientX;
    look.lastY = event.clientY;
    look.yaw = Math.max(-2.6, Math.min(2.6, look.yaw - dx * 0.004));
    look.pitch = Math.max(-0.28, Math.min(0.72, look.pitch + dy * 0.003));
  }

  function onPointerUp() {
    look.dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', (event) => {
    look.pitch = Math.max(-0.28, Math.min(0.72, look.pitch + event.deltaY * 0.0012));
  }, { passive: true });

  const handlers = new Map();
  function on(name, fn) {
    if (!handlers.has(name)) handlers.set(name, []);
    handlers.get(name).push(fn);
  }
  function emit(name) {
    (handlers.get(name) || []).forEach((fn) => fn());
  }

  /** The chase camera eases the look offsets back behind the car. */
  function relax(dt) {
    if (look.dragging) return;
    const k = Math.min(1, dt * 1.4);
    look.yaw -= look.yaw * k;
    look.pitch -= look.pitch * k * 0.7;
  }

  return { state, look, on, relax, destroy() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  } };
}
