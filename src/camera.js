/* MIDNIGHT CIRCUIT — chase camera with a free-look offset. */

import * as THREE from '../vendor/three.module.js';

export function createCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(62, aspect, 0.4, 4000);

  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const back = new THREE.Vector3();

  let shake = 0;

  function snap(car) {
    camera.position.copy(car.state.position).add(new THREE.Vector3(0, 4.4, -9));
    camera.lookAt(car.state.position.x, 1.4, car.state.position.z);
  }

  function update(dt, car, look) {
    const heading = car.state.heading + look.yaw;

    // Distance and height grow with speed so the car shrinks into the night.
    const speed = Math.abs(car.state.speed);
    const distance = 8.6 + speed * 0.075;
    const height = 3.5 + speed * 0.028 + look.pitch * 5.5;

    back.set(Math.sin(heading), 0, Math.cos(heading));
    desired.copy(car.state.position).addScaledVector(back, -distance);
    desired.y = height;

    // Never sink below the street.
    desired.y = Math.max(1.4, desired.y);

    const k = Math.min(1, dt * 5.2);
    camera.position.lerp(desired, k);

    // A little shake when the car is crashing or on nitrous.
    const energy = Math.min(1, car.state.crashed + (car.boosting ? 0.35 : 0));
    shake += (energy - shake) * Math.min(1, dt * 4);
    if (shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake * 0.5;
      camera.position.y += (Math.random() - 0.5) * shake * 0.35;
    }

    lookAt.copy(car.state.position);
    lookAt.y += 1.5;
    lookAt.addScaledVector(back, 7);
    target.lerp(lookAt, Math.min(1, dt * 7));
    camera.lookAt(target);

    const fov = 62 + Math.min(16, speed * 0.22) + (car.boosting ? 5 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
      camera.updateProjectionMatrix();
    }
  }

  return { camera, update, snap, get object() { return camera; } };
}
