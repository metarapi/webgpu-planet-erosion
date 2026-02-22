// GPU resource management for sphere-cube displaced terrain
import TERRAIN_SHADER_SOURCE from '../shaders/sphere_cube_displaced_v4.wgsl?raw';
import { visualizerConfig } from './config.js';

export class GPUResources {
  constructor(config = visualizerConfig) {
    this.config = config;
    this.device = null;
    this.queue = null;
    this.canvas = null;
    this.context = null;
    this.format = null;
    this.pipeline = null;
    this.bindGroup = null;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.indexCount = 0;
    this.cameraBuffer = null;
    this.materialBuffer = null;
    this.planetRotBuffer = null;
    this.depthTexture = null;
    this.depthTextureSize = { width: 0, height: 0 };
    this.depthFormat = 'depth24plus';
  }

  async init(canvas) {
    this.canvas = canvas;

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter not found');

    this.device = await adapter.requestDevice();
    this.queue = this.device.queue;

    this.context = canvas.getContext('webgpu');
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
    });
  }

  createGeometry(positions, normals, directions, indices) {
    this.indexBuffer = this.device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Uint32Array(this.indexBuffer.getMappedRange()).set(indices);
    this.indexBuffer.unmap();

    this.indexCount = indices.length;

    const vertexData = new Float32Array(positions.length + normals.length + directions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const vIdx = (i / 3) * 9;
      vertexData[vIdx] = positions[i];
      vertexData[vIdx + 1] = positions[i + 1];
      vertexData[vIdx + 2] = positions[i + 2];
      vertexData[vIdx + 3] = normals[i];
      vertexData[vIdx + 4] = normals[i + 1];
      vertexData[vIdx + 5] = normals[i + 2];
      vertexData[vIdx + 6] = directions[i];
      vertexData[vIdx + 7] = directions[i + 1];
      vertexData[vIdx + 8] = directions[i + 2];
    }

    this.vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertexData);
    this.vertexBuffer.unmap();
  }

  createTexturesAndPipeline(colorPixels, normalPixels, tileSize) {
    if (!colorPixels || !normalPixels) {
      throw new Error('createTexturesAndPipeline requires in-memory color and normal buffers.');
    }

    const colorTex = this.device.createTexture({
      size: [tileSize, tileSize, 6],
      dimension: '2d',
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const normalTex = this.device.createTexture({
      size: [tileSize, tileSize, 6],
      dimension: '2d',
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const textureLayout = {
      bytesPerRow: tileSize * 4,
      rowsPerImage: tileSize,
    };

    this.queue.writeTexture({ texture: colorTex }, colorPixels, textureLayout, [tileSize, tileSize, 6]);
    this.queue.writeTexture({ texture: normalTex }, normalPixels, textureLayout, [tileSize, tileSize, 6]);

    const sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.cameraBuffer = this.device.createBuffer({
      size: 144,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.materialBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.planetRotBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
        { binding: 5, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
      ],
    });

    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: colorTex.createView({ dimension: '2d-array' }) },
        { binding: 2, resource: sampler },
        { binding: 3, resource: normalTex.createView({ dimension: '2d-array' }) },
        { binding: 4, resource: { buffer: this.materialBuffer } },
        { binding: 5, resource: { buffer: this.planetRotBuffer } },
      ],
    });

    const shaderModule = this.device.createShaderModule({ code: TERRAIN_SHADER_SOURCE });

    this.pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 36,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' },
              { shaderLocation: 2, offset: 24, format: 'float32x3' },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: this.depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });
  }

  ensureDepthTexture() {
    const width = Math.max(1, this.canvas.width);
    const height = Math.max(1, this.canvas.height);

    if (
      this.depthTexture &&
      this.depthTextureSize.width === width &&
      this.depthTextureSize.height === height
    ) {
      return;
    }

    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    this.depthTexture = this.device.createTexture({
      size: [width, height, 1],
      format: this.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureSize = { width, height };
  }

  updateUniforms(viewMat, projMat, eyePos, planetRotationRadians = 0.0) {
    const cameraData = new Float32Array(36);
    cameraData.set(viewMat.toArray(), 0);
    cameraData.set(projMat.toArray(), 16);
    cameraData[32] = eyePos.x;
    cameraData[33] = eyePos.y;
    cameraData[34] = eyePos.z;
    this.queue.writeBuffer(this.cameraBuffer, 0, cameraData);

    const materialData = new Float32Array(12);
    const { material, mesh, normal, terrain } = this.config;
    const lightDirLen = Math.hypot(material.lightDir[0], material.lightDir[1], material.lightDir[2]);
    const safeLen = lightDirLen > 1e-8 ? lightDirLen : 1.0;

    const effectiveNormalStrength = (() => {
      if (!normal.generatedScale) return normal.strength;
      const denom = Math.max(1e-20, Math.abs(normal.generatedScale));
      const dispScale = terrain?.dispScale ?? mesh.scale;
      return Math.max(0.0, Math.min(10.0, normal.strength * (Math.abs(dispScale) / denom)));
    })();

    materialData[0] = material.roughness;
    materialData[1] = material.metallic;
    materialData[2] = material.f0;
    materialData[3] = material.lightIntensity;
    materialData[4] = material.lightDir[0] / safeLen;
    materialData[5] = material.lightDir[1] / safeLen;
    materialData[6] = material.lightDir[2] / safeLen;
    materialData[7] = material.ambient;
    materialData[8] = material.baseColorMul[0];
    materialData[9] = material.baseColorMul[1];
    materialData[10] = material.baseColorMul[2];
    materialData[11] = effectiveNormalStrength;
    this.queue.writeBuffer(this.materialBuffer, 0, materialData);

    const rotData = new Float32Array(4);
    rotData[0] = planetRotationRadians;
    this.queue.writeBuffer(this.planetRotBuffer, 0, rotData);
  }

  render() {
    this.ensureDepthTexture();

    const cmdEncoder = this.device.createCommandEncoder();
    const texView = this.context.getCurrentTexture().createView();
    const passEncoder = cmdEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: texView,
          clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.setIndexBuffer(this.indexBuffer, 'uint32');
    passEncoder.drawIndexed(this.indexCount);
    passEncoder.end();

    this.queue.submit([cmdEncoder.finish()]);
  }
}
