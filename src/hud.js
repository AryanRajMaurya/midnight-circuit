/* MIDNIGHT CIRCUIT — the HUD and its minimap. */

import { LAYOUT, roadStart, blockStart, OFFSET, districtName } from './world.js';

export function createHud() {
  const speedEl = document.getElementById('speed');
  const clockEl = document.getElementById('clock');
  const districtEl = document.getElementById('district');
  const toastEl = document.getElementById('toast');
  const minimap = document.getElementById('minimap');
  const ctx = minimap.getContext('2d');

  const size = minimap.width;
  const span = LAYOUT.N * LAYOUT.PITCH + LAYOUT.ROAD_W;
  const scale = size / (span + 80);
  const toMap = (x, z) => [
    (x - OFFSET + 40) * scale,
    (z - OFFSET + 40) * scale,
  ];

  // Static plate, drawn once.
  const plate = document.createElement('canvas');
  plate.width = size;
  plate.height = size;
  {
    const c = plate.getContext('2d');
    c.fillStyle = 'rgba(8,5,20,0.72)';
    c.fillRect(0, 0, size, size);
    c.strokeStyle = 'rgba(255,46,136,0.35)';
    c.lineWidth = 1;
    for (let i = 0; i <= LAYOUT.N; i += 1) {
      const s = (roadStart(i) - OFFSET + 40) * scale;
      const e = (roadStart(i) + LAYOUT.ROAD_W - OFFSET + 40) * scale;
      c.beginPath(); c.moveTo(s, 0); c.lineTo(s, size); c.stroke();
      c.beginPath(); c.moveTo(0, s); c.lineTo(size, s); c.stroke();
      c.beginPath(); c.moveTo(e, 0); c.lineTo(e, size); c.stroke();
      c.beginPath(); c.moveTo(0, e); c.lineTo(size, e); c.stroke();
    }
  }

  let toastTimer = 0;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toastEl.hidden = true; }, 1800);
  }

  function update(car, timeLabel) {
    speedEl.textContent = String(Math.round(Math.abs(car.state.speed) * 3.6));
    clockEl.textContent = timeLabel;
    districtEl.textContent = districtName(car.state.position.x, car.state.position.z);

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(plate, 0, 0);

    const [x, y] = toMap(car.state.position.x, car.state.position.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-car.state.heading);
    ctx.fillStyle = '#19e6f0';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }

  return { update, toast };
}
