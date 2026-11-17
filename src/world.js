/* MIDNIGHT CIRCUIT — the world.
 *
 * Everything is generated: no model, texture or audio file is loaded. The city
 * is a grid of blocks, the ground is one canvas drawn once, buildings and props
 * are instanced meshes so the whole district costs a handful of draw calls.
 */

import * as THREE from '../vendor/three.module.js';

/* ── layout ────────────────────────────────────────────────────────────── */

export const LAYOUT = {
  ROAD_W: 16,
  BLOCK: 64,
  PITCH: 80,
  N: 9,
  MARGIN: 900,
};

export const CITY_SIZE = LAYOUT.N * LAYOUT.PITCH + LAYOUT.ROAD_W;
export const HALF = CITY_SIZE / 2;
export const OFFSET = -HALF;

/** Road i runs along [i*PITCH, i*PITCH + ROAD_W]; block i sits after it. */
export function roadStart(i) { return OFFSET + i * LAYOUT.PITCH; }
export function blockStart(i) { return OFFSET + i * LAYOUT.PITCH + LAYOUT.ROAD_W; }
export function blockEnd(i) { return blockStart(i) + LAYOUT.BLOCK; }

/** Which district name a world position falls in — the HUD reads it. */
export function districtName(x, z) {
  const col = Math.floor((x - OFFSET) / LAYOUT.PITCH);
  const row = Math.floor((z - OFFSET) / LAYOUT.PITCH);
  if (col < 0 || row < 0 || col > LAYOUT.N || row > LAYOUT.N) return 'OUTSKIRTS';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${letters[col % 26]}${row + 1}`;
}

/* ── palettes ──────────────────────────────────────────────────────────── */

export const TIMES = {
  dusk: {
    label: 'DUSK',
    skyTop: '#150436', skyHorizon: '#ff2e88', skyGlow: '#ffb347',
    fog: '#2a0a34', fogNear: 90, fogFar: 620,
    sun: '#ffd08a', sunY: -30,
    ambient: 0.85, moon: 0.35, hemi: 0.35,
    lamp: 1.0, neon: 1.0,
  },
  night: {
    label: 'NIGHT',
    skyTop: '#07031a', skyHorizon: '#c4187a', skyGlow: '#ff7ab8',
    fog: '#0d0620', fogNear: 100, fogFar: 560,
    sun: '#ff9ecb', sunY: -60,
    ambient: 0.55, moon: 0.5, hemi: 0.22,
    lamp: 1.0, neon: 1.0,
  },
  midnight: {
    label: 'MIDNIGHT',
    skyTop: '#02010c', skyHorizon: '#4a1060', skyGlow: '#19e6f0',
    fog: '#05030f', fogNear: 55, fogFar: 420,
    sun: '#9fd8ff', sunY: -90,
    ambient: 0.4, moon: 0.62, hemi: 0.14,
    lamp: 0.85, neon: 0.9,
  },
};

/* ── helpers ───────────────────────────────────────────────────────────── */

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  draw(canvas.getContext('2d'), canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Small deterministic PRNG so the district is identical on every visit. */
function rng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/* ── ground ────────────────────────────────────────────────────────────── */

function buildGroundTexture() {
  return canvasTexture({ w: 2048, h: 2048 }, (ctx, w, h) => {
    const px = w / (CITY_SIZE + 120);
    const toX = (x) => (x - OFFSET + 60) * px;
    const toY = (z) => (z - OFFSET + 60) * px;

    // Base: the district floor.
    ctx.fillStyle = '#18103a';
    ctx.fillRect(0, 0, w, h);

    // Synthwave grid over the whole plate.
    ctx.strokeStyle = 'rgba(25,230,240,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 64; i += 1) {
      const p = (i / 64) * w;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }

    // Blocks: raised sidewalk plate, then the lot itself.
    for (let i = 0; i < LAYOUT.N; i += 1) {
      for (let j = 0; j < LAYOUT.N; j += 1) {
        const x = toX(blockStart(i));
        const y = toY(blockStart(j));
        const s = LAYOUT.BLOCK * px;
        ctx.fillStyle = '#1e1445';
        ctx.fillRect(x - 8, y - 8, s + 16, s + 16);
        ctx.fillStyle = '#150d33';
        ctx.fillRect(x, y, s, s);
      }
    }

    // Roads: asphalt, kerbs, centre line, neon edge.
    // `axis` is the world direction the corridor runs in: 'z' means the canvas
    // rectangle is tall and narrow, so its lit edges are the vertical sides.
    const road = (x0, y0, x1, y1, axis) => {
      ctx.fillStyle = '#161032';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

      // A sheen across the carriageway so the asphalt is not a dead void.
      const sheen = axis === 'z'
        ? ctx.createLinearGradient(x0, 0, x1, 0)
        : ctx.createLinearGradient(0, y0, 0, y1);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(150,140,220,0.14)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

      const len = 14 * px;
      const gap = 12 * px;

      if (axis === 'z') {
        ctx.fillStyle = '#2a1d5c';
        ctx.fillRect(x0 - 3, y0, 3, y1 - y0);
        ctx.fillRect(x1, y0, 3, y1 - y0);
        ctx.fillStyle = 'rgba(255,46,136,0.95)';
        ctx.fillRect(x0 - 1.4, y0, 2.6, y1 - y0);
        ctx.fillRect(x1 - 1.2, y0, 2.6, y1 - y0);
        ctx.fillStyle = 'rgba(25,230,240,0.9)';
        const mid = (x0 + x1) / 2;
        for (let y = y0 + gap; y < y1 - len; y += len + gap) ctx.fillRect(mid - 1.2, y, 2.4, len);
      } else {
        ctx.fillStyle = '#2a1d5c';
        ctx.fillRect(x0, y0 - 3, x1 - x0, 3);
        ctx.fillRect(x0, y1, x1 - x0, 3);
        ctx.fillStyle = 'rgba(255,46,136,0.95)';
        ctx.fillRect(x0, y0 - 1.4, x1 - x0, 2.6);
        ctx.fillRect(x0, y1 - 1.2, x1 - x0, 2.6);
        ctx.fillStyle = 'rgba(25,230,240,0.9)';
        const mid = (y0 + y1) / 2;
        for (let x = x0 + gap; x < x1 - len; x += len + gap) ctx.fillRect(x, mid - 1.2, len, 2.4);
      }
    };

    for (let i = 0; i <= LAYOUT.N; i += 1) {
      const s = roadStart(i);
      const e = s + LAYOUT.ROAD_W;
      road(toX(s), 0, toX(e), h, 'z');   // corridor running along world z
      road(0, toY(s), w, toY(e), 'x');   // corridor running along world x
    }

    // Intersections: a soft pool of light where two corridors cross.
    for (let i = 0; i <= LAYOUT.N; i += 1) {
      for (let j = 0; j <= LAYOUT.N; j += 1) {
        const cx = toX(roadStart(i) + LAYOUT.ROAD_W / 2);
        const cy = toY(roadStart(j) + LAYOUT.ROAD_W / 2);
        const radius = LAYOUT.ROAD_W * px * 0.9;
        const pool = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        pool.addColorStop(0, 'rgba(255,46,136,0.22)');
        pool.addColorStop(1, 'rgba(255,46,136,0)');
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/* ── sky, sun, stars ───────────────────────────────────────────────────── */

function buildSky() {
  const geometry = new THREE.SphereGeometry(3000, 24, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#07031a') },
      horizon: { value: new THREE.Color('#c4187a') },
      glow: { value: new THREE.Color('#ff7ab8') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 glow;
      varying vec3 vWorld;
      void main() {
        float h = clamp(normalize(vWorld).y * 0.5 + 0.5, 0.0, 1.0);
        vec3 colour = mix(horizon, top, smoothstep(0.48, 0.86, h));
        // A hot band right on the horizon.
        float band = exp(-abs(normalize(vWorld).y) * 14.0);
        colour += glow * band * 0.55;
        gl_FragColor = vec4(colour, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function buildSun() {
  const texture = canvasTexture({ w: 512, h: 512 }, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const r = w * 0.46;
    const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    grad.addColorStop(0, '#ffe6a8');
    grad.addColorStop(0.55, '#ff7ab8');
    grad.addColorStop(1, '#ff2e88');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // The synthwave slits: wider gaps toward the bottom.
    ctx.globalCompositeOperation = 'destination-out';
    let y = cy + r * 0.05;
    let thickness = 3;
    while (y < cy + r) {
      ctx.fillRect(0, y, w, thickness);
      y += thickness + Math.max(6, (y - cy) * 0.22);
      thickness += 1.6;
    }
    ctx.globalCompositeOperation = 'source-over';
  });

  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, fog: false, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), material);
  mesh.position.set(0, -60, -2600);
  return mesh;
}

function buildStars(count, seed) {
  const random = rng(seed);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(random() * 0.85);
    const radius = 2800;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) + 60;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#cfe6ff', size: 2.6, sizeAttenuation: false,
    transparent: true, opacity: 0.8, fog: false, depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

/* ── facades ───────────────────────────────────────────────────────────── */

function facadeTexture(seed, litRatio) {
  return canvasTexture({ w: 128, h: 256 }, (ctx, w, h) => {
    const random = rng(seed);
    ctx.fillStyle = '#05030f';
    ctx.fillRect(0, 0, w, h);

    const cols = 6;
    const rows = 16;
    const cw = w / cols;
    const rh = h / rows;
    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        if (random() > litRatio) continue;
        const warm = random() > 0.45;
        ctx.fillStyle = warm
          ? `rgba(255,${200 + Math.floor(random() * 55)},140,${0.7 + random() * 0.3})`
          : `rgba(140,${230 + Math.floor(random() * 25)},255,${0.6 + random() * 0.4})`;
        ctx.fillRect(x * cw + cw * 0.22, y * rh + rh * 0.24, cw * 0.56, rh * 0.5);
      }
    }
  });
}

/* ── the city ──────────────────────────────────────────────────────────── */

/**
 * One merged mesh for every tower, with UVs scaled in world units so a facade
 * tile always covers the same number of metres. Instancing a unit box stretches
 * one texture over towers of wildly different heights and the windows smear.
 */
function buildingGeometry(buildings, tile = 11) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colours = [];
  const indices = [];
  const tint = new THREE.Color();

  let offset = 0;
  const quad = (corners, normal, colour, axisU, axisV, origin) => {
    for (const corner of corners) {
      positions.push(corner[0], corner[1], corner[2]);
      normals.push(normal[0], normal[1], normal[2]);
      colours.push(colour.r, colour.g, colour.b);
      uvs.push((corner[axisU] - origin[axisU]) / tile, (corner[axisV] - origin[axisV]) / tile);
    }
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    offset += 4;
  };

  for (const b of buildings) {
    const x0 = b.x - b.w / 2;
    const x1 = b.x + b.w / 2;
    const z0 = b.z - b.d / 2;
    const z1 = b.z + b.d / 2;
    const y1 = b.height;
    tint.setScalar(b.tint);
    const roof = tint.clone().multiplyScalar(0.12);

    // Sides. UVs run up the wall, so windows keep their aspect on any tower.
    quad([[x0, 0, z1], [x1, 0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], tint, 0, 1, [x0, 0, 0]);
    quad([[x1, 0, z0], [x0, 0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], tint, 0, 1, [x0, 0, 0]);
    quad([[x1, 0, z1], [x1, 0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], tint, 2, 1, [0, 0, z0]);
    quad([[x0, 0, z0], [x0, 0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], tint, 2, 1, [0, 0, z0]);
    // Roof.
    quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0], roof, 0, 2, [x0, 0, z0]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  return geometry;
}

export function buildWorld({ quality = 'high' } = {}) {
  const group = new THREE.Group();
  const random = rng(19860101);

  // Ground: the detailed plate under the district, plus an endless dark floor.
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE + 120, CITY_SIZE + 120),
    new THREE.MeshBasicMaterial({ map: buildGroundTexture() })
  );
  plate.rotation.x = -Math.PI / 2;
  plate.position.y = 0.02;
  group.add(plate);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshBasicMaterial({ color: '#060414' })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  const sky = buildSky();
  const sun = buildSun();
  const stars = buildStars(quality === 'low' ? 400 : 1400, 7);
  group.add(sky, sun, stars);

  /* Buildings — one instanced mesh. */
  const facades = [facadeTexture(11, 0.5), facadeTexture(23, 0.34), facadeTexture(37, 0.62)];
  const buildings = [];
  const lots = [];

  for (let i = 0; i < LAYOUT.N; i += 1) {
    for (let j = 0; j < LAYOUT.N; j += 1) {
      const x0 = blockStart(i);
      const z0 = blockStart(j);
      const split = random() > 0.62 ? 2 : 1;
      for (let a = 0; a < split; a += 1) {
        for (let b = 0; b < split; b += 1) {
          const cw = LAYOUT.BLOCK / split;
          const lx = x0 + a * cw;
          const lz = z0 + b * cw;
          const inset = 3 + random() * 5;
          const w = cw - inset * 2;
          const d = cw - inset * 2;
          if (random() < 0.16) continue; // left as an empty lot

          const tall = random();
          const height = 10 + Math.pow(tall, 2.1) * (quality === 'low' ? 55 : 95);
          buildings.push({
            x: lx + cw / 2,
            z: lz + cw / 2,
            w, d, height,
            facade: Math.floor(random() * facades.length),
            tint: 0.55 + random() * 0.45,
          });
          lots.push({ x0: lx + inset, z0: lz + inset, x1: lx + cw - inset, z1: lz + cw - inset });
        }
      }
    }
  }

  // Three facade families, one merged mesh each, so the district is not a
  // repeating wallpaper.
  const buildingMaterial = new THREE.MeshBasicMaterial({
    map: facades[0], vertexColors: true, side: THREE.DoubleSide,
  });
  for (let family = 0; family < facades.length; family += 1) {
    const subset = buildings.filter((b) => b.facade === family);
    if (!subset.length) continue;
    const material = buildingMaterial.clone();
    material.map = facades[family];
    const merged = new THREE.Mesh(buildingGeometry(subset), material);
    group.add(merged);
  }

  // The tints carry the variety within a family; the three families differ.

  /* Roof neon — thin emissive slabs on a subset of towers. */
  const stripGeometry = new THREE.BoxGeometry(1, 1, 1);
  const stripMaterial = new THREE.MeshBasicMaterial({ color: '#ff2e88' });
  const strips = buildings.filter((b) => b.height > 24 && random() > 0.22);
  const stripMesh = new THREE.InstancedMesh(stripGeometry, stripMaterial, strips.length * 2);
  const matrix = new THREE.Matrix4();
  let si = 0;
  strips.forEach((b) => {
    const y = b.height + 0.35;
    matrix.makeScale(b.w + 0.6, 0.7, b.d + 0.6);
    matrix.setPosition(b.x, y, b.z);
    stripMesh.setMatrixAt(si++, matrix);
    matrix.makeScale(b.w + 0.6, 0.7, b.d + 0.6);
    matrix.setPosition(b.x, y + 1.4, b.z);
    stripMesh.setMatrixAt(si++, matrix);
  });
  stripMesh.count = si;
  stripMesh.instanceMatrix.needsUpdate = true;
  group.add(stripMesh);

  /* Street lamps along the roads. */
  const lampPositions = [];
  for (let i = 0; i <= LAYOUT.N; i += 1) {
    const s = roadStart(i) + LAYOUT.ROAD_W / 2;
    for (let k = 0; k < LAYOUT.N; k += 1) {
      const along = blockStart(k) + LAYOUT.BLOCK / 2;
      if (random() > 0.5) lampPositions.push([s - LAYOUT.ROAD_W / 2 - 1.6, along]);
      if (random() > 0.5) lampPositions.push([along, s + LAYOUT.ROAD_W / 2 + 1.6]);
    }
  }

  const poleGeometry = new THREE.CylinderGeometry(0.18, 0.24, 7, 5);
  poleGeometry.translate(0, 3.5, 0);
  const poleMesh = new THREE.InstancedMesh(
    poleGeometry, new THREE.MeshBasicMaterial({ color: '#1a1436' }), lampPositions.length
  );
  const headGeometry = new THREE.SphereGeometry(0.55, 6, 5);
  const headMesh = new THREE.InstancedMesh(
    headGeometry, new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), lampPositions.length
  );
  lampPositions.forEach((p, index) => {
    matrix.makeScale(1, 1, 1);
    matrix.setPosition(p[0], 0, p[1]);
    poleMesh.setMatrixAt(index, matrix);
    headMesh.setMatrixAt(index, matrix.clone().setPosition(p[0], 7, p[1]));
  });
  poleMesh.instanceMatrix.needsUpdate = true;
  headMesh.instanceMatrix.needsUpdate = true;
  group.add(poleMesh, headMesh);

  /* Palms silhouetted along the kerb. */
  const palmSpots = [];
  for (let i = 0; i <= LAYOUT.N; i += 1) {
    const s = roadStart(i);
    for (let k = 0; k < LAYOUT.N; k += 1) {
      const along = blockStart(k) + (random() * LAYOUT.BLOCK);
      if (random() > 0.45) palmSpots.push([s - 2.2, along]);
    }
  }
  const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.34, 9, 5);
  trunkGeometry.translate(0, 4.5, 0);
  const trunkMesh = new THREE.InstancedMesh(
    trunkGeometry, new THREE.MeshBasicMaterial({ color: '#0d0820' }), palmSpots.length
  );
  const frondGeometry = new THREE.ConeGeometry(3.2, 1.4, 6);
  frondGeometry.translate(0, 9.2, 0);
  const frondMesh = new THREE.InstancedMesh(
    frondGeometry, new THREE.MeshBasicMaterial({ color: '#120b2c' }), palmSpots.length
  );
  palmSpots.forEach((p, index) => {
    const scale = 0.8 + random() * 0.7;
    matrix.makeScale(scale, scale, scale);
    matrix.setPosition(p[0], 0, p[1]);
    trunkMesh.setMatrixAt(index, matrix);
    frondMesh.setMatrixAt(index, matrix.clone());
  });
  trunkMesh.instanceMatrix.needsUpdate = true;
  frondMesh.instanceMatrix.needsUpdate = true;
  group.add(trunkMesh, frondMesh);

  /* Lights. */
  const ambient = new THREE.AmbientLight('#8fa8ff', 0.55);
  const moon = new THREE.DirectionalLight('#9fc4ff', 0.5);
  moon.position.set(-160, 240, -120);
  const hemi = new THREE.HemisphereLight('#ff7ab8', '#0a0618', 0.22);
  group.add(ambient, moon, hemi);

  /* Collision: the building footprints, bucketed by block. */
  const buckets = new Map();
  const key = (i, j) => `${i},${j}`;
  lots.forEach((lot) => {
    const i = Math.floor((lot.x0 - OFFSET) / LAYOUT.PITCH);
    const j = Math.floor((lot.z0 - OFFSET) / LAYOUT.PITCH);
    if (!buckets.has(key(i, j))) buckets.set(key(i, j), []);
    buckets.get(key(i, j)).push(lot);
  });

  const colliders = [];
  /**
   * Push a circle out of any building footprint it overlaps.
   * Returns the deepest contact as { x, z, nx, nz, depth } or null.
   */
  function collide(x, z, radius) {
    const i = Math.floor((x - OFFSET) / LAYOUT.PITCH);
    const j = Math.floor((z - OFFSET) / LAYOUT.PITCH);
    let best = null;

    for (let a = i - 1; a <= i + 1; a += 1) {
      for (let b = j - 1; b <= j + 1; b += 1) {
        const list = buckets.get(key(a, b));
        if (!list) continue;
        for (const lot of list) {
          const cx = Math.max(lot.x0, Math.min(x, lot.x1));
          const cz = Math.max(lot.z0, Math.min(z, lot.z1));
          const dx = x - cx;
          const dz = z - cz;
          const distance = Math.hypot(dx, dz);
          if (distance >= radius) continue;

          let nx; let nz; let depth;
          if (distance > 1e-4) {
            nx = dx / distance;
            nz = dz / distance;
            depth = radius - distance;
          } else {
            // Centre is inside the footprint: exit through the nearest face.
            const left = x - lot.x0;
            const right = lot.x1 - x;
            const near = z - lot.z0;
            const far = lot.z1 - z;
            const min = Math.min(left, right, near, far);
            if (min === left) { nx = -1; nz = 0; depth = left + radius; }
            else if (min === right) { nx = 1; nz = 0; depth = right + radius; }
            else if (min === near) { nx = 0; nz = -1; depth = near + radius; }
            else { nx = 0; nz = 1; depth = far + radius; }
          }

          if (!best || depth > best.depth) best = { x, z, nx, nz, depth };
        }
      }
    }
    colliders.length = 0;
    return best;
  }

  /* Time of day. */
  const target = { ...TIMES.night };
  const skyTop = new THREE.Color(target.skyTop);
  const skyHorizon = new THREE.Color(target.skyHorizon);
  const skyGlow = new THREE.Color(target.skyGlow);
  const fogColour = new THREE.Color(target.fog);
  const sunColour = new THREE.Color(target.sun);
  const fog = new THREE.Fog(target.fog, target.fogNear, target.fogFar);

  function applyTime(name, immediate = false) {
    const next = TIMES[name] || TIMES.night;
    Object.assign(target, next);
    if (immediate) {
      skyTop.set(next.skyTop);
      skyHorizon.set(next.skyHorizon);
      skyGlow.set(next.skyGlow);
      fogColour.set(next.fog);
      sunColour.set(next.sun);
      fog.color.set(next.fog);
      fog.near = next.fogNear;
      fog.far = next.fogFar;
      sun.position.y = next.sunY;
      ambient.intensity = next.ambient;
      moon.intensity = next.moon;
      hemi.intensity = next.hemi;
    }
  }

  function tick(dt) {
    const k = Math.min(1, dt * 1.6);
    skyTop.lerp(new THREE.Color(target.skyTop), k);
    skyHorizon.lerp(new THREE.Color(target.skyHorizon), k);
    skyGlow.lerp(new THREE.Color(target.skyGlow), k);
    fogColour.lerp(new THREE.Color(target.fog), k);
    sunColour.lerp(new THREE.Color(target.sun), k);
    sun.position.y += (target.sunY - sun.position.y) * k;
    ambient.intensity += (target.ambient - ambient.intensity) * k;
    moon.intensity += (target.moon - moon.intensity) * k;
    hemi.intensity += (target.hemi - hemi.intensity) * k;
    fog.near += (target.fogNear - fog.near) * k;
    fog.far += (target.fogFar - fog.far) * k;

    sky.material.uniforms.top.value.copy(skyTop);
    sky.material.uniforms.horizon.value.copy(skyHorizon);
    sky.material.uniforms.glow.value.copy(skyGlow);
    fog.color.copy(fogColour);
    sun.material.color.copy(sunColour);
  }

  applyTime('night', true);

  return {
    group,
    fog,
    collide,
    applyTime,
    tick,
    groundImage() { return plate.material.map.image.toDataURL('image/png'); },
    get timeLabel() { return target.label; },
    lampPositions,
    get buildings() { return buildings; },
  };
}
