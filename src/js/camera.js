// Camera controller for orbit interaction
import { Vec3, Mat4 } from './math-utils.js';

export class OrbitCamera {
  constructor(canvas) {
    this.canvas = canvas;
    this.distance = 3;
    this.phi = 0;      // rotation around Y-axis (horizontal)
    this.theta = Math.PI / 4;  // elevation angle
    this.center = new Vec3(0, 0, 0);

    // Mouse interaction
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
  }

  onMouseDown(e) {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  onMouseMove(e) {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastX;
    const deltaY = e.clientY - this.lastY;

    this.phi -= deltaX * 0.005;
    this.theta += deltaY * 0.005;
    this.theta = Math.max(0.1, Math.min(Math.PI - 0.1, this.theta));

    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  onMouseUp(e) {
    this.isDragging = false;
  }

  onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.1 : 0.9;
    this.distance *= delta;
    this.distance = Math.max(0.5, Math.min(50, this.distance));
  }

  getViewMatrix() {
    const x = Math.sin(this.theta) * Math.cos(this.phi);
    const y = Math.cos(this.theta);
    const z = Math.sin(this.theta) * Math.sin(this.phi);

    const eye = this.center.add(new Vec3(x, y, z).mul(this.distance));
    const up = new Vec3(0, 1, 0);

    return Mat4.lookAt(eye, this.center, up);
  }
}
