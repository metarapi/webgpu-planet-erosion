// Main application entry point
import { GPUResources } from './js/gpu-resources.js';
import { GeometryBuilder } from './js/geometry.js';
import { OrbitCamera } from './js/camera.js';
import { Vec3, Mat4 } from './js/math-utils.js';
import { visualizerConfig } from './js/config.js';
import { generateTerrainAssetsAsync } from './js/terrain-generation.js';

class App {
  constructor() {
    this.canvas = null;
    this.gpu = null;
    this.camera = null;
    this.running = false;
    this.startTimeMs = 0;
  }

  async init() {
    this.canvas = document.getElementById('canvas');
    if (!this.canvas) {
      console.error('Canvas element not found');
      return;
    }

    // Set canvas size
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Initialize GPU
    this.gpu = new GPUResources(visualizerConfig);
    await this.gpu.init(this.canvas);

    // Create base geometry then generate in-memory terrain assets
    const baseGeom = GeometryBuilder.buildCubeSphere(visualizerConfig.mesh.subdiv);
    const terrainAssets = await generateTerrainAssetsAsync(baseGeom, this.gpu.device, visualizerConfig);

    this.gpu.createGeometry(
      terrainAssets.positions,
      terrainAssets.normals,
      terrainAssets.directions,
      terrainAssets.indices
    );

    this.gpu.createTexturesAndPipeline(
      terrainAssets.colorData,
      terrainAssets.normalData,
      terrainAssets.tileSize
    );

    // Initialize camera
    this.camera = new OrbitCamera(this.canvas);

    // Handle window resize
    window.addEventListener('resize', () => this.onResize());

    console.log('WebGPU application initialized');
    this.running = true;
    this.startTimeMs = performance.now();
  }

  onResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  update() {
    // Get camera matrices
    const fov = Math.PI / 3;
    const aspect = this.canvas.width / this.canvas.height;
    const near = 0.1;
    const far = 1000;

    const projMat = Mat4.perspective(fov, aspect, near, far);
    const viewMat = this.camera.getViewMatrix();

    // Calculate eye position from camera
    const x = Math.sin(this.camera.theta) * Math.cos(this.camera.phi);
    const y = Math.cos(this.camera.theta);
    const z = Math.sin(this.camera.theta) * Math.sin(this.camera.phi);
    const eyePos = this.camera.center.add(new Vec3(x, y, z).mul(this.camera.distance));

    const elapsedSec = (performance.now() - this.startTimeMs) / 1000;
    const rotationSpeedDeg = this.gpu.config.animation?.rotationSpeed ?? 0.0;
    const planetRotationRadians = elapsedSec * rotationSpeedDeg * (Math.PI / 180);

    // Update GPU uniforms
    this.gpu.updateUniforms(viewMat, projMat, eyePos, planetRotationRadians);
  }

  render() {
    this.gpu.render();
  }

  frame() {
    if (!this.running) return;

    this.update();
    this.render();

    requestAnimationFrame(() => this.frame());
  }

  run() {
    this.frame();
  }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    try {
      await app.init();
      app.run();
    } catch (err) {
      console.error('Failed to initialize app:', err);
    }
  });
} else {
  const app = new App();
  app.init().then(() => app.run()).catch(err => console.error('Failed to initialize app:', err));
}
