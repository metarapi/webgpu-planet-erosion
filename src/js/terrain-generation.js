import EROSION_COMMON_WGSL from '../shaders/cube_noise_eroded_common_v4.wgsl?raw';
import EROSION_PASS1_WGSL from '../shaders/cube_noise_eroded_pass1_v4.wgsl?raw';
import EROSION_PASS2_WGSL from '../shaders/cube_noise_eroded_pass2_v4.wgsl?raw';
import { visualizerConfig } from './config.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const cross3 = (a, b) => [
  (a[1] * b[2]) - (a[2] * b[1]),
  (a[2] * b[0]) - (a[0] * b[2]),
  (a[0] * b[1]) - (a[1] * b[0]),
];

function normalize3(x, y, z) {
  const len = Math.hypot(x, y, z);
  if (len < 1e-8) return [0, 1, 0];
  return [x / len, y / len, z / len];
}

function cubeFaceDirection(faceId, u01, v01) {
  const u = 2 * u01 - 1;
  const v = 2 * v01 - 1;

  if (faceId === 0) return normalize3(u, -v, -1);
  if (faceId === 1) return normalize3(-u, -v, 1);
  if (faceId === 2) return normalize3(u, -1, -v);
  if (faceId === 3) return normalize3(u, 1, v);
  if (faceId === 4) return normalize3(-1, -v, -u);
  return normalize3(1, -v, u);
}

function buildErosionParamsBuffer(cfg) {
  const buffer = new ArrayBuffer(128);
  const u32 = new Uint32Array(buffer);
  const f32 = new Float32Array(buffer);

  const tile = cfg.textures.tileSize;
  const normalEps = cfg.normal.eps ?? (1.0 / tile);

  u32[0] = tile;
  u32[1] = cfg.textures.colorMode === 'height' ? 1 : 0;
  u32[2] = cfg.normal.enabled ? 1 : 0;
  u32[3] = Math.max(1, Math.floor(cfg.terrain.octaves));

  f32[4] = cfg.mesh.radius;
  f32[5] = cfg.terrain.noiseScale;
  f32[6] = cfg.terrain.alpha;
  f32[7] = cfg.terrain.lacunarity;

  f32[8] = cfg.terrain.gain;
  f32[9] = cfg.terrain.dispScale;
  f32[10] = cfg.terrain.dispBias;
  f32[11] = normalEps;

  f32[12] = cfg.terrain.outMin;
  f32[13] = cfg.terrain.outMax;
  f32[14] = 0.0;
  f32[15] = 0.0;

  f32[16] = cfg.terrain.erosionScale;
  f32[17] = cfg.terrain.erosionSlopePower;
  f32[18] = cfg.terrain.erosionCellScale;
  f32[19] = cfg.terrain.erosionHeightOffset;

  f32[20] = cfg.terrain.erosionGain;
  f32[21] = cfg.terrain.erosionLacunarity;
  f32[22] = cfg.terrain.erosionStrength;
  f32[23] = cfg.textures.waterHeight;

  f32[24] = Math.max(1, Math.floor(cfg.terrain.octaves));
  f32[25] = Math.max(1, Math.floor(cfg.terrain.erosionOctaves));
  f32[26] = 0.0;
  f32[27] = 0.0;

  f32[28] = 0.0;
  f32[29] = 0.0;
  f32[30] = 0.0;
  f32[31] = 0.0;

  return buffer;
}

async function generateMapsWithCanonicalCompute(device, cfg) {
  const tileSize = cfg.textures.tileSize;
  const pixelCount = 6 * tileSize * tileSize;
  const paramsBytes = buildErosionParamsBuffer(cfg);

  const uniformBuffer = device.createBuffer({
    size: paramsBytes.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, paramsBytes);

  const outHeight = device.createBuffer({
    size: pixelCount * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const outColor = device.createBuffer({
    size: pixelCount * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const outNormal = device.createBuffer({
    size: pixelCount * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const pass1Module = device.createShaderModule({
    code: `${EROSION_COMMON_WGSL}\n${EROSION_PASS1_WGSL}`,
  });
  const pass2Module = device.createShaderModule({
    code: `${EROSION_COMMON_WGSL}\n${EROSION_PASS2_WGSL}`,
  });

  const pass1Pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: pass1Module, entryPoint: 'main' },
  });
  const pass2Pipeline = device.createComputePipeline({
    layout: 'auto',
    compute: { module: pass2Module, entryPoint: 'main' },
  });

  const pass1BindGroup = device.createBindGroup({
    layout: pass1Pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: outHeight } },
      { binding: 2, resource: { buffer: outColor } },
    ],
  });

  const pass2BindGroup = device.createBindGroup({
    layout: pass2Pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: outNormal } },
    ],
  });

  const workX = Math.ceil(tileSize / 8);
  const workY = Math.ceil(tileSize / 8);

  const encoder = device.createCommandEncoder();
  {
    const pass = encoder.beginComputePass();
    pass.setPipeline(pass1Pipeline);
    pass.setBindGroup(0, pass1BindGroup);
    pass.dispatchWorkgroups(workX, workY, 6);
    pass.end();
  }
  {
    const pass = encoder.beginComputePass();
    pass.setPipeline(pass2Pipeline);
    pass.setBindGroup(0, pass2BindGroup);
    pass.dispatchWorkgroups(workX, workY, 6);
    pass.end();
  }

  const readHeight = device.createBuffer({
    size: pixelCount * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const readColor = device.createBuffer({
    size: pixelCount * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const readNormal = device.createBuffer({
    size: pixelCount * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  encoder.copyBufferToBuffer(outHeight, 0, readHeight, 0, pixelCount * 4);
  encoder.copyBufferToBuffer(outColor, 0, readColor, 0, pixelCount * 4);
  encoder.copyBufferToBuffer(outNormal, 0, readNormal, 0, pixelCount * 4);

  device.queue.submit([encoder.finish()]);

  await Promise.all([
    readHeight.mapAsync(GPUMapMode.READ),
    readColor.mapAsync(GPUMapMode.READ),
    readNormal.mapAsync(GPUMapMode.READ),
  ]);

  const heightData = new Float32Array(readHeight.getMappedRange().slice(0));
  const packedColor = new Uint32Array(readColor.getMappedRange().slice(0));
  const packedNormal = new Uint32Array(readNormal.getMappedRange().slice(0));

  const colorData = new Uint8Array(pixelCount * 4);
  const normalData = new Uint8Array(pixelCount * 4);

  for (let i = 0; i < pixelCount; i += 1) {
    const c = packedColor[i];
    const n = packedNormal[i];
    const base = i * 4;

    colorData[base] = c & 255;
    colorData[base + 1] = (c >>> 8) & 255;
    colorData[base + 2] = (c >>> 16) & 255;
    colorData[base + 3] = (c >>> 24) & 255;

    normalData[base] = n & 255;
    normalData[base + 1] = (n >>> 8) & 255;
    normalData[base + 2] = (n >>> 16) & 255;
    normalData[base + 3] = (n >>> 24) & 255;
  }

  readHeight.unmap();
  readColor.unmap();
  readNormal.unmap();

  return { heightData, colorData, normalData, tileSize };
}

function cubemapFaceAndUv(direction) {
  const dx = Math.abs(direction[0]);
  const dy = Math.abs(direction[1]);
  const dz = Math.abs(direction[2]);

  let faceId = 0;
  let u = 0;
  let v = 0;

  if (dz >= dx && dz >= dy) {
    if (direction[2] >= 0) {
      faceId = 1;
      u = -direction[0] / direction[2];
      v = -direction[1] / direction[2];
    } else {
      faceId = 0;
      u = direction[0] / (-direction[2]);
      v = -direction[1] / (-direction[2]);
    }
  } else if (dy >= dx && dy >= dz) {
    if (direction[1] >= 0) {
      faceId = 3;
      u = direction[0] / direction[1];
      v = direction[2] / direction[1];
    } else {
      faceId = 2;
      u = direction[0] / (-direction[1]);
      v = -direction[2] / (-direction[1]);
    }
  } else if (direction[0] >= 0) {
    faceId = 5;
    u = direction[2] / direction[0];
    v = -direction[1] / direction[0];
  } else {
    faceId = 4;
    u = -direction[2] / (-direction[0]);
    v = -direction[1] / (-direction[0]);
  }

  return {
    faceId,
    u01: (u + 1) * 0.5,
    v01: (v + 1) * 0.5,
  };
}

function bilinearSampleHeight(heights, tileSize, direction) {
  const { faceId, u01, v01 } = cubemapFaceAndUv(direction);
  const u = clamp(u01, 0, 1) * (tileSize - 1);
  const v = clamp(v01, 0, 1) * (tileSize - 1);

  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const x1 = Math.min(x0 + 1, tileSize - 1);
  const y1 = Math.min(y0 + 1, tileSize - 1);
  const fu = u - x0;
  const fv = v - y0;

  const base = faceId * tileSize * tileSize;
  const h00 = heights[base + y0 * tileSize + x0];
  const h10 = heights[base + y0 * tileSize + x1];
  const h01 = heights[base + y1 * tileSize + x0];
  const h11 = heights[base + y1 * tileSize + x1];

  const hx0 = (h00 * (1 - fu)) + (h10 * fu);
  const hx1 = (h01 * (1 - fu)) + (h11 * fu);
  return (hx0 * (1 - fv)) + (hx1 * fv);
}

function recomputeNormalsFromIndices(positions, indices) {
  const normals = new Float32Array(positions.length);

  for (let index = 0; index < indices.length; index += 3) {
    const i0 = indices[index] * 3;
    const i1 = indices[index + 1] * 3;
    const i2 = indices[index + 2] * 3;

    const p0 = [positions[i0], positions[i0 + 1], positions[i0 + 2]];
    const p1 = [positions[i1], positions[i1 + 1], positions[i1 + 2]];
    const p2 = [positions[i2], positions[i2 + 1], positions[i2 + 2]];

    const edge1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const edge2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const faceN = cross3(edge1, edge2);

    normals[i0] += faceN[0];
    normals[i0 + 1] += faceN[1];
    normals[i0 + 2] += faceN[2];

    normals[i1] += faceN[0];
    normals[i1 + 1] += faceN[1];
    normals[i1 + 2] += faceN[2];

    normals[i2] += faceN[0];
    normals[i2 + 1] += faceN[1];
    normals[i2 + 2] += faceN[2];
  }

  for (let i = 0; i < normals.length; i += 3) {
    const n = normalize3(normals[i], normals[i + 1], normals[i + 2]);
    normals[i] = n[0];
    normals[i + 1] = n[1];
    normals[i + 2] = n[2];
  }

  return normals;
}

export function generateTerrainAssets(baseGeometry, cfg = visualizerConfig) {
  throw new Error('generateTerrainAssets now requires a GPU device. Use generateTerrainAssetsAsync.');
}

export async function generateTerrainAssetsAsync(baseGeometry, device, cfg = visualizerConfig) {
  const { heightData, colorData, normalData, tileSize } = await generateMapsWithCanonicalCompute(device, cfg);

  const positions = new Float32Array(baseGeometry.positions.length);
  const directions = new Float32Array(baseGeometry.directions);
  for (let i = 0; i < directions.length; i += 3) {
    const dir = [directions[i], directions[i + 1], directions[i + 2]];
    const h = bilinearSampleHeight(heightData, tileSize, dir);
    const planetRadius = cfg.mesh.radius;
    const disp = cfg.terrain.dispBias + (cfg.terrain.dispScale * h);
    const finalRadius = planetRadius + disp;

    positions[i] = dir[0] * finalRadius;
    positions[i + 1] = dir[1] * finalRadius;
    positions[i + 2] = dir[2] * finalRadius;
  }

  const normals = recomputeNormalsFromIndices(positions, baseGeometry.indices);

  return {
    positions,
    normals,
    directions,
    indices: baseGeometry.indices,
    colorData,
    normalData,
    tileSize,
  };
}
