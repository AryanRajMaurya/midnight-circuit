/* MIDNIGHT CIRCUIT — boot, loop and screens. */

import * as THREE from '../vendor/three.module.js';
import { buildWorld, TIMES, LAYOUT, roadStart } from './world.js';
import { createCar } from './car.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const loaderLabel = document.getElementById('loader-label');
const loaderBar = document.getElementById('loader-bar');
const titleScreen = document.getElementById('title');
const pauseScreen = document.getElementById('pause');
const hud = document.getElementById('hud');
const fatalScreen = document.getElementById('fatal');
const fatalText = document.getElementById('fatal-text');

function fail(message) {
  fatalScreen.hidden = false;
  fatalText.textContent = message;
  loader.classList.remove('is-on');
}

/** Yield a frame so the loader can paint between build steps. */
function frame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function progress(label, pct) {
  loaderLabel.textContent = label;
  loaderBar.style.width = `${pct}%`;
  await frame();
}

const state = {
  phase: 'boot',           // boot | title | drive | pause
  quality: 'high',
  time: 'night',
  fps: 0,
  frames: 0,
};

let renderer;
let scene;
let world;
let car;
let chase;
let input;
let audio;
let hud2;

async function boot() {
  await progress('Starting', 4);

  if (!window.WebGLRenderingContext) {
    fail('This browser does not expose WebGL, so MIDNIGHT CIRCUIT cannot draw its city.');
    return;
  }

  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance', stencil: false,
    });
  } catch (error) {
    fail(`The WebGL context could not be created: ${error.message}`);
    return;
  }

  await progress('Drawing the sky', 18);

  const applyQuality = () => {
    const ratio = window.devicePixelRatio || 1;
    const cap = state.quality === 'high' ? 2 : state.quality === 'medium' ? 1.5 : 1;
    renderer.setPixelRatio(Math.min(ratio, cap));
  };
  applyQuality();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;

  scene = new THREE.Scene();
  chase = createCamera(window.innerWidth / window.innerHeight);

  await progress('Laying out the district', 38);
  world = buildWorld({ quality: state.quality });
  scene.add(world.group);
  scene.fog = world.fog;

  await progress('Parking the car', 62);
  car = createCar();
  scene.add(car.group);
  // Spawn on the middle road, not in the middle of a block.
  car.place(roadStart(4) + LAYOUT.ROAD_W / 2, 0, 0);

  await progress('Tuning the engine', 78);
  input = createInput(canvas);
  audio = createAudio();
  hud2 = createHud();

  input.on('recover', () => {
    if (state.phase !== 'drive') return;
    car.recover();
    hud2.toast('BACK ON THE ROAD');
  });
  input.on('pause', () => {
    if (state.phase === 'drive') pause();
    else if (state.phase === 'pause') resume();
  });

  window.addEventListener('resize', onResize);

  await progress('Ready', 100);
  loader.classList.remove('is-on');
  showTitle();
  requestAnimationFrame(loop);
}

function onResize() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
  chase.camera.aspect = window.innerWidth / window.innerHeight;
  chase.camera.updateProjectionMatrix();
}

/* ── screens ───────────────────────────────────────────────────────────── */

function showTitle() {
  state.phase = 'title';
  titleScreen.hidden = false;
  pauseScreen.hidden = true;
  hud.hidden = true;
  document.body.dataset.state = 'title';
}

function start() {
  audio.resume();
  titleScreen.hidden = true;
  pauseScreen.hidden = true;
  hud.hidden = false;
  state.phase = 'drive';
  document.body.dataset.state = 'drive';
  chase.snap(car);
  audio.blip(880);
  hud2.toast('DRIVE');
}

function pause() {
  if (state.phase !== 'drive') return;
  state.phase = 'pause';
  pauseScreen.hidden = false;
  document.body.dataset.state = 'pause';
  audio.blip(440);
}

function resume() {
  if (state.phase !== 'pause') return;
  state.phase = 'drive';
  pauseScreen.hidden = true;
  document.body.dataset.state = 'drive';
  audio.resume();
  audio.blip(880);
}

function setTime(name, immediate = false) {
  if (!TIMES[name]) return;
  state.time = name;
  world.applyTime(name, immediate);
  document.getElementById('opt-time').value = name;
  document.getElementById('pause-time').value = name;
}

/* ── loop ──────────────────────────────────────────────────────────────── */

let last = 0;
let overview = false;
const slipScratch = { value: 0 };

function loop(now) {
  requestAnimationFrame(loop);
  if (!last) last = now;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  state.frames += 1;
  state.fps = state.frames * 1000 / Math.max(1, now - (loop.started || (loop.started = now)));

  if (state.phase === 'drive') {
    input.relax(dt);
    car.update(dt, input.state, world);

    const lateral = Math.abs(car.state.velocity.x * Math.cos(car.state.heading)
      - car.state.velocity.z * Math.sin(car.state.heading));
    slipScratch.value += (lateral - slipScratch.value) * Math.min(1, dt * 8);

    audio.update(dt, {
      speed: car.state.speed,
      throttle: input.state.throttle ? 1 : 0,
      slip: slipScratch.value,
      boosting: car.boosting,
    });
  } else {
    audio.update(dt, { speed: 0, throttle: 0, slip: 0 });
  }

  world.tick(dt);
  if (overview) {
    chase.camera.position.set(0, 460, 0.01);
    chase.camera.lookAt(0, 0, 0);
    if (Math.abs(chase.camera.fov - 50) > 0.1) { chase.camera.fov = 50; chase.camera.updateProjectionMatrix(); }
  } else {
    chase.update(dt, car, input.look);
  }

  if (state.phase === 'drive' || state.phase === 'pause') {
    hud2.update(car, world.timeLabel);
  }

  renderer.render(scene, chase.camera);
}

/* ── controls ──────────────────────────────────────────────────────────── */

function wireControls() {
  document.getElementById('start').addEventListener('click', start);
  document.getElementById('resume').addEventListener('click', resume);
  document.getElementById('quit').addEventListener('click', showTitle);
  document.getElementById('tool-pause').addEventListener('click', () => {
    if (state.phase === 'drive') pause();
  });
  document.getElementById('tool-time').addEventListener('click', () => {
    const order = ['dusk', 'night', 'midnight'];
    const next = order[(order.indexOf(state.time) + 1) % order.length];
    setTime(next);
    hud2.toast(TIMES[next].label);
  });
  document.getElementById('tool-mute').addEventListener('click', (event) => {
    audio.resume();
    audio.setMuted(!audio.muted);
    event.currentTarget.setAttribute('aria-pressed', String(audio.muted));
    event.currentTarget.textContent = audio.muted ? 'MUTED' : 'SOUND';
  });

  document.getElementById('opt-time').addEventListener('change', (event) => {
    setTime(event.target.value);
  });
  document.getElementById('pause-time').addEventListener('change', (event) => {
    setTime(event.target.value);
  });
  document.getElementById('opt-quality').addEventListener('change', (event) => {
    state.quality = event.target.value;
    const ratio = window.devicePixelRatio || 1;
    const cap = state.quality === 'high' ? 2 : state.quality === 'medium' ? 1.5 : 1;
    renderer.setPixelRatio(Math.min(ratio, cap));
    hud2.toast(`QUALITY ${state.quality.toUpperCase()}`);
  });

  // A click anywhere on the title screen after the first starts the engine.
  window.addEventListener('keydown', (event) => {
    if (state.phase === 'title' && (event.code === 'Enter' || event.code === 'Space')) start();
  });
}

/* ── hooks for the browser check ───────────────────────────────────────── */

window.__midnight = {
  get ready() { return Boolean(renderer) && state.phase !== 'boot'; },
  get phase() { return state.phase; },
  get fps() { return Math.round(state.fps); },
  get time() { return state.time; },
  get speed() { return car ? car.state.speed : 0; },
  get position() { return car ? { x: car.state.position.x, z: car.state.position.z } : null; },
  get tank() { return car ? car.tank : 0; },
  get muted() { return audio ? audio.muted : false; },
  get info() {
    return renderer ? {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    } : null;
  },
  get car() { return car; },
  get input() { return input ? input.state : null; },
  world: () => world,
  get objects() {
    return {
      scene,
      plate: world ? world.group.children[0] : null,
      floor: world ? world.group.children[1] : null,
    };
  },
  start, pause, resume, setTime,
  setOverview(value) { overview = Boolean(value); },
  drive: {
    throttle(on) { input.state.throttle = on; },
    brake(on) { input.state.brake = on; },
    steer(value) { input.state.left = value < 0; input.state.right = value > 0; },
    nitrous(on) { input.state.nitrous = on; },
  },
};

wireControls();
boot().catch((error) => fail(error?.message || String(error)));
