// Simple vector/matrix utilities for WebGPU
export class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  static from(v) {
    return new Vec2(v.x || 0, v.y || 0);
  }

  add(v) {
    return new Vec2(this.x + v.x, this.y + v.y);
  }

  sub(v) {
    return new Vec2(this.x - v.x, this.y - v.y);
  }

  mul(s) {
    return new Vec2(this.x * s, this.y * s);
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const len = this.length();
    if (len < 1e-8) return this;
    return new Vec2(this.x / len, this.y / len);
  }
}

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  static from(v) {
    return new Vec3(v.x || 0, v.y || 0, v.z || 0);
  }

  add(v) {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v) {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  mul(s) {
    return new Vec3(this.x * s, this.y * s, this.z * s);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  cross(v) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x
    );
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize() {
    const len = this.length();
    if (len < 1e-8) return this;
    return new Vec3(this.x / len, this.y / len, this.z / len);
  }

  toArray() {
    return [this.x, this.y, this.z];
  }
}

export class Vec4 {
  constructor(x = 0, y = 0, z = 0, w = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  toArray() {
    return [this.x, this.y, this.z, this.w];
  }
}

export class Mat4 {
  constructor(data = null) {
    // Row-major 4x4 matrix stored as flat array
    if (data) {
      this.data = new Float32Array(data);
    } else {
      this.data = new Float32Array(16);
      this.identity();
    }
  }

  identity() {
    this.data.fill(0);
    this.data[0] = this.data[5] = this.data[10] = this.data[15] = 1;
    return this;
  }

  static identity() {
    return new Mat4().identity();
  }

  static perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const m = new Mat4();
    m.data[0] = f / aspect;
    m.data[5] = f;
    m.data[10] = (far + near) / (near - far);
    m.data[11] = -1;
    m.data[14] = (2 * far * near) / (near - far);
    m.data[15] = 0;
    return m;
  }

  static lookAt(eye, center, up) {
    const f = center.sub(eye).normalize();
    const s = f.cross(up).normalize();
    const u = s.cross(f).normalize();

    const m = new Mat4();
    m.data[0] = s.x;
    m.data[1] = u.x;
    m.data[2] = -f.x;
    m.data[3] = 0;

    m.data[4] = s.y;
    m.data[5] = u.y;
    m.data[6] = -f.y;
    m.data[7] = 0;

    m.data[8] = s.z;
    m.data[9] = u.z;
    m.data[10] = -f.z;
    m.data[11] = 0;

    m.data[12] = -s.dot(eye);
    m.data[13] = -u.dot(eye);
    m.data[14] = f.dot(eye);
    m.data[15] = 1;

    return m;
  }

  static rotationY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = new Mat4();
    m.data[0] = c;
    m.data[2] = s;
    m.data[5] = 1;
    m.data[8] = -s;
    m.data[10] = c;
    m.data[15] = 1;
    return m;
  }

  toArray() {
    return Array.from(this.data);
  }
}
