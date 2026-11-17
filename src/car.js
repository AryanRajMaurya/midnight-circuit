/* MIDNIGHT CIRCUIT — the car.
 *
 * Arcade physics on purpose: a velocity vector split into forward and lateral
 * parts, with lateral grip doing the work. Grip drops under nitrous, which is
 * what makes the tail step out. The body is boxes and cylinders; the glow is
 * one point light and an additive plane.
 */

import * as THREE from '../vendor/three.module.js';
import { LAYOUT, roadStart, blockStart, OFFSET } from './world.js';

const TUNING = {
  engine: 30,        // m/s^2 at full throttle
  nitrous: 24,       // extra while the tank lasts
  brake: 46,
  reverse: 16,
  drag: 0.62,
  grip: 7.5,         // how hard lateral velocity is killed
  driftGrip: 2.1,
  turn: 2.5,         // rad/s at full lock
  maxSpeed: 50,
  maxReverse: 14,
  tank: 3.2,         // seconds of nitrous
  tankRegen: 0.28,
};

/* A soft radial falloff for the underglow — a plain plane reads as a rectangle. */
function radialGlow() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function createCar() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshStandardMaterial({
    color: '#6b22a8', metalness: 0.8, roughness: 0.24,
    emissive: '#2a0d4d', emissiveIntensity: 1,
  });
  const glass = new THREE.MeshStandardMaterial({ color: '#0d1c38', metalness: 0.9, roughness: 0.12 });
  const tyre = new THREE.MeshStandardMaterial({ color: '#0a0812', roughness: 0.85 });
  const rim = new THREE.MeshStandardMaterial({ color: '#e8eeff', metalness: 1, roughness: 0.18 });
  const trim = new THREE.MeshBasicMaterial({ color: '#19e6f0' });

  // Chassis: a long wedge. Forward is +z.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 4.6), paint);
  lower.position.y = 0.42;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 1.0), paint);
  nose.position.set(0, 0.36, 2.5);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 2.1), glass);
  cabin.position.set(0, 0.86, -0.35);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.09, 0.42), paint);
  wing.position.set(0, 0.95, -2.16);
  const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.2), paint);
  strutL.position.set(-0.6, 0.74, -2.16);
  const strutR = strutL.clone();
  strutR.position.x = 0.6;
  body.add(lower, nose, cabin, wing, strutL, strutR);

  // Neon side blades and a roof line, so the silhouette reads at night.
  [-1.02, 1.02].forEach((x) => {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 4.2), trim);
    blade.position.set(x, 0.44, 0);
    body.add(blade);
  });
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 2.0), trim);
  spine.position.set(0, 1.14, -0.35);
  body.add(spine);

  // Wheels.
  const wheels = [];
  const tyreGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  tyreGeometry.rotateZ(Math.PI / 2);
  const rimGeometry = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 8);
  rimGeometry.rotateZ(Math.PI / 2);
  const wheelSpots = [
    [-0.95, 0.42, 1.45], [0.95, 0.42, 1.45],
    [-0.95, 0.42, -1.45], [0.95, 0.42, -1.45],
  ];
  wheelSpots.forEach(([x, y, z], index) => {
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(tyreGeometry, tyre), new THREE.Mesh(rimGeometry, rim));
    wheel.position.set(x, y, z);
    wheel.userData.steer = index < 2;
    body.add(wheel);
    wheels.push(wheel);
  });

  // Lights.
  const headMaterial = new THREE.MeshBasicMaterial({ color: '#fff4d6' });
  const tailMaterial = new THREE.MeshBasicMaterial({ color: '#ff2e5c' });
  [-0.62, 0.62].forEach((x) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headMaterial);
    lamp.position.set(x, 0.46, 2.98);
    body.add(lamp);
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.13, 0.08), tailMaterial);
  tail.position.set(0, 0.5, -2.3);
  body.add(tail);
  // Two lamp units so the rear does not read as one flat sticker.
  [-0.55, 0.55].forEach((x) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.06), tailMaterial);
    lamp.position.set(x, 0.62, -2.32);
    body.add(lamp);
  });

  const headL = new THREE.SpotLight('#ffe9c4', 90, 90, 0.42, 0.5, 1.4);
  headL.position.set(-0.62, 0.7, 2.9);
  const headR = headL.clone();
  headR.position.x = 0.62;
  const targetL = new THREE.Object3D();
  targetL.position.set(-1.6, 0, 26);
  const targetR = new THREE.Object3D();
  targetR.position.set(1.6, 0, 26);
  body.add(targetL, targetR, headL, headR);
  headL.target = targetL;
  headR.target = targetR;

  const under = new THREE.PointLight('#ff2e88', 9, 9, 1.6);
  under.position.set(0, 0.5, 0);
  body.add(under);

  // A follow light so the car never collapses into the road.
  const key = new THREE.SpotLight('#ffd8f0', 42, 26, 0.7, 0.9, 1.2);
  key.position.set(0, 12, -6);
  const keyTarget = new THREE.Object3D();
  keyTarget.position.set(0, 0, 2);
  body.add(keyTarget, key);
  key.target = keyTarget;

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 10.5),
    new THREE.MeshBasicMaterial({
      map: radialGlow(), color: '#ff2e88', transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.06;
  group.add(glow);

  // Contact shadow: a dark radial blob. Without it the car floats.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 7.6),
    new THREE.MeshBasicMaterial({
      map: radialGlow(), color: '#000000', transparent: true, opacity: 0.62,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.045;
  group.add(shadow);

  // Headlight pool on the asphalt. The ground is unlit, so the beams are
  // painted rather than computed.
  const beams = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 16),
    new THREE.MeshBasicMaterial({
      map: radialGlow(), color: '#ffe9c4', transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  beams.rotation.x = -Math.PI / 2;
  beams.position.set(0, 0.05, 12);
  group.add(beams);

  /* State. */
  const state = {
    position: new THREE.Vector3(0, 0, 0),
    heading: 0,
    velocity: new THREE.Vector3(),
    speed: 0,
    steering: 0,
    nitrous: 0,
    tank: TUNING.tank,
    wheelSpin: 0,
    crashed: 0,
  };

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const scratch = new THREE.Vector3();

  function place(x, z, heading = 0) {
    state.position.set(x, 0, z);
    state.heading = heading;
    state.velocity.set(0, 0, 0);
    state.speed = 0;
    state.steering = 0;
    state.crashed = 0;
    sync();
  }

  /** Drop the car on the middle of the nearest road. */
  function recover() {
    const x = state.position.x;
    const z = state.position.z;
    let best = null;
    for (let i = 0; i <= LAYOUT.N; i += 1) {
      const centre = roadStart(i) + LAYOUT.ROAD_W / 2;
      const d = Math.abs(centre - x);
      if (!best || d < best.d) best = { d, along: centre, axis: 'x', at: z };
      const dz = Math.abs(centre - z);
      if (!best || dz < best.d) best = { d: dz, along: centre, axis: 'z', at: x };
    }
    if (best.axis === 'x') place(best.along, blockStart(4) + LAYOUT.BLOCK / 2, 0);
    else place(blockStart(4) + LAYOUT.BLOCK / 2, best.along, Math.PI / 2);
    state.tank = TUNING.tank;
  }

  function update(dt, input, world) {
    const throttle = input.throttle ? 1 : 0;
    const braking = input.brake ? 1 : 0;
    const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);

    forward.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    right.set(forward.z, 0, -forward.x);

    let vf = state.velocity.dot(forward);
    let vr = state.velocity.dot(right);

    // Nitrous.
    const boosting = input.nitrous && state.tank > 0 && vf > 2;
    if (boosting) state.tank = Math.max(0, state.tank - dt);
    else state.tank = Math.min(TUNING.tank, state.tank + TUNING.tankRegen * dt);

    const power = throttle * (TUNING.engine + (boosting ? TUNING.nitrous : 0));
    if (throttle) vf += power * dt;
    if (braking) {
      if (vf > 0.5) vf -= TUNING.brake * dt;
      else vf = Math.max(-TUNING.maxReverse, vf - TUNING.reverse * dt);
    }
    vf -= vf * TUNING.drag * dt;
    vf = Math.max(-TUNING.maxReverse, Math.min(TUNING.maxSpeed + (boosting ? 18 : 0), vf));

    // Longitudinal force goes into the velocity first...
    state.velocity.copy(forward).multiplyScalar(vf).addScaledVector(right, vr);

    // ...then the chassis yaws. Steering is useless at a standstill and
    // twitchy at top speed.
    const authority = Math.min(1, Math.abs(vf) / 7) * (1 - Math.min(0.55, Math.abs(vf) / 140));
    state.heading += steer * TUNING.turn * authority * dt * Math.sign(vf || 1);

    // The same world velocity, re-read in the new basis. The mismatch between
    // where the car points and where it is going is the slide; grip erases it.
    forward.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    right.set(forward.z, 0, -forward.x);
    const grip = boosting ? TUNING.driftGrip : TUNING.grip;
    vf = state.velocity.dot(forward);
    vr = state.velocity.dot(right);
    vr -= vr * Math.min(1, grip * dt);

    state.velocity.copy(forward).multiplyScalar(vf).addScaledVector(right, vr);
    state.position.addScaledVector(state.velocity, dt);

    // Buildings.
    const contact = world.collide(state.position.x, state.position.z, 1.15);
    if (contact) {
      state.position.x += contact.nx * contact.depth;
      state.position.z += contact.nz * contact.depth;
      const into = state.velocity.dot(scratch.set(contact.nx, 0, contact.nz));
      if (into < 0) {
        state.velocity.addScaledVector(scratch, -into * 1.35);
        state.crashed = Math.min(1, state.crashed + Math.abs(into) * 0.05);
      }
    }

    state.speed = vf;
    state.steering += (steer - state.steering) * Math.min(1, dt * 9);
    state.nitrous = boosting ? 1 : 0;
    state.crashed = Math.max(0, state.crashed - dt * 1.6);

    // Wheels.
    state.wheelSpin += vf * dt * 2.4;
    wheels.forEach((wheel) => {
      wheel.rotation.x = state.wheelSpin;
      if (wheel.userData.steer) wheel.rotation.y = state.steering * 0.42;
    });

    sync(dt, boosting);
  }

  function sync(dt = 0, boosting = false) {
    group.position.copy(state.position);
    group.rotation.y = state.heading;

    // Body lean: roll into the turn, pitch under power.
    const roll = -state.steering * Math.min(1, Math.abs(state.speed) / 20) * 0.09;
    const pitch = -Math.min(1, Math.abs(state.speed) / 60) * 0.035;
    body.rotation.z += (roll - body.rotation.z) * Math.min(1, dt * 6 || 1);
    body.rotation.x += (pitch - body.rotation.x) * Math.min(1, dt * 6 || 1);

    under.color.set(boosting ? '#19e6f0' : '#ff2e88');
    glow.material.color.set(boosting ? '#19e6f0' : '#ff2e88');
    tailMaterial.color.set(state.speed < -0.5 ? '#ffe9c4' : '#ff2e5c');
  }

  return {
    group,
    state,
    update,
    place,
    recover,
    get boosting() { return state.nitrous === 1; },
    get tank() { return state.tank / TUNING.tank; },
    TUNING,
  };
}
