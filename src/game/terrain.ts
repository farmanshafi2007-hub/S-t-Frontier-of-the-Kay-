import * as THREE from 'three';

export const WORLD_SIZE = 760;
export const WATER_LEVEL = -1.5;

function fract(x: number): number {
  return x - Math.floor(x);
}

function hash2(x: number, z: number): number {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}

export function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const u = fx * fx * (3.0 - 2.0 * fx);
  const v = fz * fz * (3.0 - 2.0 * fz);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, z: number, octaves = 5): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * (valueNoise(x * freq, z * freq) * 2 - 1);
    freq *= 2.04;
    amp *= 0.48;
  }
  return val;
}

// River center X coordinate for any Z coordinate
export function getRiverCenterX(z: number): number {
  return Math.sin(z * 0.014) * 28 + Math.cos(z * 0.006) * 18 + 12;
}

// Distance from the winding river channel
export function getRiverDist(x: number, z: number): number {
  const rx = getRiverCenterX(z);
  return Math.abs(x - rx);
}

// Distance to Söğüt Lake center (52, 82)
export function getLakeFactor(x: number, z: number): number {
  const dx = x - 52;
  const dz = z - 82;
  const angle = Math.atan2(dz, dx);
  const radiusMod = 58 + Math.sin(angle * 3) * 8 + Math.cos(angle * 5) * 5;
  const dist = Math.hypot(dx, dz);
  return Math.max(0, 1 - dist / radiusMod);
}

// Waterfall Plunge Pool centered at (24, -96)
export function getWaterfallPoolFactor(x: number, z: number): number {
  const dist = Math.hypot(x - 24, z - -96);
  const poolRadius = 26;
  return Math.max(0, 1 - dist / poolRadius);
}

// Dirt trail / road factor (0 = off-road, 1 = on main trail)
export function getRoadFactor(x: number, z: number): number {
  // Segment A: Kayı Oba (-75, 45) -> River Bridge (10, -20)
  const d1 = distToSegment(x, z, -75, 45, 10, -20);
  // Segment B: River Bridge (10, -20) -> Karacahisar Watchtower (115, -65)
  const d2 = distToSegment(x, z, 10, -20, 115, -65);
  // Segment C: River Bridge (10, -20) -> Karadağ Mountain Pass (-35, -175)
  const d3 = distToSegment(x, z, 10, -20, -35, -175);
  // Segment D: Kayı Oba (-75, 45) -> Lake Shore & Caravanserai (95, 72)
  const d4 = distToSegment(x, z, -75, 45, 2, 82);
  const d5 = distToSegment(x, z, 10, -20, 96, 68);

  const minDist = Math.min(d1, d2, d3, d4, d5);
  const width = 4.6;
  if (minDist > width) return 0;
  return Math.pow(1 - minDist / width, 1.5);
}

function distToSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number
): number {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const wx = px - x1;
  const wz = pz - z1;
  const c1 = wx * vx + wz * vz;
  if (c1 <= 0) return Math.hypot(px - x1, pz - z1);
  const c2 = vx * vx + vz * vz;
  if (c2 <= c1) return Math.hypot(px - x2, pz - z2);
  const b = c1 / c2;
  const bx = x1 + b * vx;
  const bz = z1 + b * vz;
  return Math.hypot(px - bx, pz - bz);
}

/**
 * Exact continuous heightfield at any world (x, z).
 */
export function groundHeightAt(x: number, z: number): number {
  const n1 = fbm(x * 0.0055, z * 0.0055, 5);
  const n2 = fbm(x * 0.018 + 11.3, z * 0.018 - 7.1, 3);
  let h = n1 * 14.2 + n2 * 2.9 + 1.8;

  // 1. Flatten Kayı Oba Village plateau around (-75, 45)
  const obaDist = Math.hypot(x - -75, z - 45);
  if (obaDist < 62) {
    const t = THREE.MathUtils.smoothstep(obaDist, 28, 62);
    h = THREE.MathUtils.lerp(2.6, h, t);
  }

  // 2. Flatten Seljuk Caravanserai & Çavdar Bazaar Oasis around (104, 68)
  const bazaarDist = Math.hypot(x - 104, z - 68);
  if (bazaarDist < 42) {
    const t = THREE.MathUtils.smoothstep(bazaarDist, 18, 42);
    h = THREE.MathUtils.lerp(2.4, h, t);
  }

  // 3. Eastern Karacahisar Watchtower & Fortress Plateau around (115, -65)
  const towerDist = Math.hypot(x - 115, z - -65);
  if (towerDist < 46) {
    const t = THREE.MathUtils.smoothstep(towerDist, 20, 46);
    h = THREE.MathUtils.lerp(9.8, h, t);
  }

  // 4. Northern Çağlayan Waterfall Cliff at (24, -118)
  const wfCliffDist = Math.hypot((x - 24) * 0.75, z - -124);
  if (wfCliffDist < 38) {
    const cliffBoost = (1 - wfCliffDist / 38) * 26.5;
    h += cliffBoost;
  }

  // 5. Northern Mountain ridges & Karadağ Pass
  if (z < -95) {
    const northFactor = THREE.MathUtils.smoothstep(-z, 95, 290);
    const passDist = Math.abs(x - -35);
    const passCarve = THREE.MathUtils.smoothstep(passDist, 14, 48);
    const ridgeNoise = Math.abs(fbm(x * 0.012, z * 0.012, 4)) * 46;
    h += northFactor * passCarve * (18 + ridgeNoise);
  }

  // 6. Outer Natural Highland Mountain Ring
  const radialDist = Math.hypot(x, z);
  if (radialDist > 195) {
    const edgeFactor = THREE.MathUtils.smoothstep(radialDist, 195, 340);
    const peakNoise = Math.abs(fbm(x * 0.014 + 4.2, z * 0.014, 4)) * 56;
    h += edgeFactor * (22 + peakNoise);
  }

  // 7. Carve the Söğüt Crystal Lake basin around (52, 82)
  const lakeFactor = getLakeFactor(x, z);
  if (lakeFactor > 0) {
    const smoothLake = THREE.MathUtils.smoothstep(lakeFactor, 0, 0.55);
    h = THREE.MathUtils.lerp(h, WATER_LEVEL - 3.4, smoothLake);
  }

  // 8. Carve the Çağlayan Waterfall Plunge Pool around (24, -96)
  const poolFactor = getWaterfallPoolFactor(x, z);
  if (poolFactor > 0) {
    const smoothPool = THREE.MathUtils.smoothstep(poolFactor, 0, 0.65);
    h = THREE.MathUtils.lerp(h, WATER_LEVEL - 2.9, smoothPool);
  }

  // 9. Carve the Winding River channel from the Waterfall Pool (-96) southward
  if (z > -102) {
    const rDist = getRiverDist(x, z);
    const riverWidth = 13.5;
    if (rDist < riverWidth * 2.1) {
      const rt = THREE.MathUtils.smoothstep(rDist, 3.5, riverWidth * 1.85);
      const riverBedHeight = WATER_LEVEL - 1.95;
      h = THREE.MathUtils.lerp(riverBedHeight, h, rt);
    }
  }

  return h;
}

export function walkableHeightAt(x: number, z: number): number {
  const terrainH = groundHeightAt(x, z);
  if (x >= -5 && x <= 27 && z >= -24.2 && z <= -15.8) {
    const spanT = (x - -5) / 32;
    const archHeight = Math.sin(spanT * Math.PI) * 1.55;
    const bridgeDeckY = 0.85 + archHeight;
    return Math.max(terrainH, bridgeDeckY);
  }
  return terrainH;
}

export function isOnBridge(x: number, z: number): boolean {
  return x >= -5 && x <= 27 && z >= -24.2 && z <= -15.8;
}

export function isWaterAt(x: number, z: number): boolean {
  if (isOnBridge(x, z)) return false;
  return groundHeightAt(x, z) < WATER_LEVEL + 0.15;
}

export function getTerritoryDetailsAt(
  x: number,
  z: number
): { regionName: string; faction: string; bannerSubtitle: string } {
  if (Math.hypot(x - -75, z - 45) < 60) {
    return {
      regionName: 'Kayı Oba Nomadic Encampment',
      faction: 'Kayı Tribe Sanctuary',
      bannerSubtitle: 'Heartland of Ertuğrul Bey & the Kayı Alps',
    };
  }
  if (Math.hypot(x - 24, z - -98) < 42) {
    return {
      regionName: 'Çağlayan Mountain Waterfall',
      faction: 'Sacred Highland Springs',
      bannerSubtitle: 'Cascading glacial waters feeding the Sakarya River',
    };
  }
  if (Math.hypot(x - 104, z - 68) < 44) {
    return {
      regionName: 'Hanlı Pazar & Seljuk Caravanserai',
      faction: 'Silk Road Trade Territory',
      bannerSubtitle: 'Crossroads of Anatolian merchants, smiths, and nomads',
    };
  }
  if (getLakeFactor(x, z) > 0.04) {
    return {
      regionName: 'Söğüt Crystal Lake',
      faction: 'Anatolian Basin',
      bannerSubtitle: 'Calm turquoise waters mirroring the frontier peaks',
    };
  }
  if (Math.hypot(x - 115, z - -65) < 54) {
    return {
      regionName: 'Karacahisar Byzantine Citadel',
      faction: 'Byzantine Tekfur Territory',
      bannerSubtitle: 'Heavily fortified stone bastion & vanguard garrison',
    };
  }
  if (z < -118) {
    return {
      regionName: 'Karadağ Snow Pass',
      faction: 'Noyan Steppe Horde Outpost',
      bannerSubtitle: 'Frozen northern gorge patrolled by ruthless Steppe riders',
    };
  }
  if (isOnBridge(x, z) || getRiverDist(x, z) < 22) {
    return {
      regionName: 'Sakarya River Crossing',
      faction: 'Contested Frontier Border',
      bannerSubtitle: 'Strategic timber bridge linking East and West Söğüt',
    };
  }
  return {
    regionName: 'Söğüt Emerald Valley',
    faction: 'Anatolian Frontier',
    bannerSubtitle: 'Open grazing steppes and pine-covered foothills',
  };
}

export function getRegionNameAt(x: number, z: number): string {
  return getTerritoryDetailsAt(x, z).regionName;
}

/**
 * Generates a high-frequency micro-normal map for 8K-style crisp surface detail
 * on terrain, stone, and metal without external assets.
 */
export function createMicroNormalTexture(maxAnisotropy: number, repeat = 95): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const hL = valueNoise(x * 0.35, y * 0.35);
      const hR = valueNoise((x + 1) * 0.35, y * 0.35);
      const hD = valueNoise(x * 0.35, (y + 1) * 0.35);

      const dx = (hL - hR) * 2.2;
      const dy = (hL - hD) * 2.2;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);

      data[idx] = Math.floor(((dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor(((dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.floor(((dz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Builds the high-density vertex-colored 3D terrain mesh with normal mapping.
 */
export function createTerrainMesh(maxAnisotropy: number): THREE.Mesh {
  const segments = 250;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const count = pos.count;
  const colors = new Float32Array(count * 3);

  const cLushGrass = new THREE.Color('#365826');
  const cDrySteppe = new THREE.Color('#616a35');
  const cDirtTrail = new THREE.Color('#6d5339');
  const cSandBank = new THREE.Color('#8e7b5c');
  const cGraniteRock = new THREE.Color('#53565b');
  const cAlpineSnow = new THREE.Color('#eef3f8');
  const cObaEarth = new THREE.Color('#5b4a35');
  const tmpColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    const hx = groundHeightAt(x + 1.4, z);
    const hz = groundHeightAt(x, z + 1.4);
    const slope = Math.hypot(hx - y, hz - y) / 1.4;

    const n = valueNoise(x * 0.045, z * 0.045);
    tmpColor.copy(cLushGrass).lerp(cDrySteppe, n * 0.65);

    // Oba camp & Caravanserai courtyard trampled earth
    const obaDist = Math.hypot(x - -75, z - 45);
    if (obaDist < 42) {
      tmpColor.lerp(cObaEarth, (1 - obaDist / 42) * 0.65);
    }
    const bazaarDist = Math.hypot(x - 104, z - 68);
    if (bazaarDist < 32) {
      tmpColor.lerp(cSandBank, (1 - bazaarDist / 32) * 0.72);
    }

    // Dirt road trails
    const roadF = getRoadFactor(x, z);
    if (roadF > 0.01) {
      tmpColor.lerp(cDirtTrail, Math.min(1, roadF * 0.92));
    }

    // Sandbank near water level
    if (y < WATER_LEVEL + 1.15) {
      const sandT = THREE.MathUtils.clamp(1 - (y - (WATER_LEVEL - 0.8)) / 1.95, 0, 1);
      tmpColor.lerp(cSandBank, sandT * 0.9);
    }

    // Steep rocky slopes & Waterfall cliff
    if (slope > 0.4 || y > 13.0) {
      const rockT = THREE.MathUtils.clamp((slope - 0.36) * 1.75 + Math.max(0, (y - 13.5) * 0.06), 0, 1);
      tmpColor.lerp(cGraniteRock, rockT);
    }

    // High altitude snow caps
    if (y > 20.5 || (z < -125 && y > 11.5)) {
      const snowBase = z < -125 ? 11.5 : 20.5;
      const snowT = THREE.MathUtils.clamp((y - snowBase) / 8.5 - slope * 0.22, 0, 1);
      tmpColor.lerp(cAlpineSnow, snowT);
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const detailTex = createTerrainDetailTexture(maxAnisotropy);
  const normalTex = createMicroNormalTexture(maxAnisotropy, 110);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.86,
    metalness: 0.04,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

export function createTerrainDetailTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#dadada';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 190 + Math.floor(Math.random() * 62);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(110, 110);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createKayiTextileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dfd5c3';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = 'rgba(90, 65, 42, 0.06)';
  for (let y = 0; y < 512; y += 4) {
    ctx.fillRect(0, y, 512, 2);
  }
  for (let x = 0; x < 512; x += 4) {
    ctx.fillRect(x, 0, 2, 512);
  }

  ctx.fillStyle = '#8b261d';
  ctx.fillRect(0, 40, 512, 36);
  ctx.fillRect(0, 420, 512, 42);

  ctx.fillStyle = '#1d6b78';
  ctx.fillRect(0, 82, 512, 20);
  ctx.fillRect(0, 394, 512, 20);

  ctx.fillStyle = '#d4a853';
  for (let x = 16; x < 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 46);
    ctx.lineTo(x + 12, 58);
    ctx.lineTo(x, 70);
    ctx.lineTo(x - 12, 58);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createKayiBannerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#124e66';
  ctx.fillRect(0, 0, 256, 512);

  ctx.strokeStyle = '#d4a853';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 228, 484);

  ctx.strokeStyle = '#f4efe6';
  ctx.lineWidth = 16;
  ctx.lineCap = 'square';

  ctx.beginPath();
  ctx.moveTo(58, 190);
  ctx.lineTo(58, 320);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(198, 190);
  ctx.lineTo(198, 320);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(96, 190);
  ctx.lineTo(128, 248);
  ctx.lineTo(160, 190);
  ctx.moveTo(128, 245);
  ctx.lineTo(128, 320);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
