// Geometry generation for cube-sphere
import { Vec3 } from './math-utils.js';

export class GeometryBuilder {
  static buildCubeSphere(subdiv = 64) {
    const positions = [];
    const normals = [];
    const directions = [];

    for (let faceId = 0; faceId < 6; faceId++) {
      const { facePositions, faceNormals, faceDirections } = this.buildFace(faceId, subdiv);
      for (let i = 0; i < facePositions.length; i += 1) {
        positions.push(facePositions[i]);
      }
      for (let i = 0; i < faceNormals.length; i += 1) {
        normals.push(faceNormals[i]);
      }
      for (let i = 0; i < faceDirections.length; i += 1) {
        directions.push(faceDirections[i]);
      }
    }

    const indices = this.buildIndices(subdiv);

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      directions: new Float32Array(directions),
      indices: new Uint32Array(indices),
    };
  }

  static buildFace(faceId, subdiv) {
    const { U, V, W } = this.getFaceBasis(faceId);
    const facePositions = [];
    const faceNormals = [];
    const faceDirections = [];

    for (let j = 0; j <= subdiv; j++) {
      for (let i = 0; i <= subdiv; i++) {
        const u = -1 + (2 * i) / subdiv;
        const v = -1 + (2 * j) / subdiv;

        // Cube coordinate
        const cube = new Vec3(
          u * U.x + v * V.x + W.x,
          u * U.y + v * V.y + W.y,
          u * U.z + v * V.z + W.z
        );

        // Map cube to sphere
        const sphere = this.cubeToSphere(cube);
        const direction = sphere.normalize();

        facePositions.push(sphere.x, sphere.y, sphere.z);
        faceDirections.push(direction.x, direction.y, direction.z);
        faceNormals.push(direction.x, direction.y, direction.z);
      }
    }

    return {
      facePositions,
      faceNormals,
      faceDirections,
    };
  }

  static getFaceBasis(faceId) {
    const bases = {
      0: { U: new Vec3(1, 0, 0), V: new Vec3(0, -1, 0), W: new Vec3(0, 0, -1) },
      1: { U: new Vec3(-1, 0, 0), V: new Vec3(0, -1, 0), W: new Vec3(0, 0, 1) },
      2: { U: new Vec3(1, 0, 0), V: new Vec3(0, 0, 1), W: new Vec3(0, -1, 0) },
      3: { U: new Vec3(1, 0, 0), V: new Vec3(0, 0, -1), W: new Vec3(0, 1, 0) },
      4: { U: new Vec3(0, 0, -1), V: new Vec3(0, -1, 0), W: new Vec3(-1, 0, 0) },
      5: { U: new Vec3(0, 0, 1), V: new Vec3(0, -1, 0), W: new Vec3(1, 0, 0) },
    };
    return bases[faceId];
  }

  static cubeToSphere(v) {
    const x = v.x, y = v.y, z = v.z;
    const x2 = x * x, y2 = y * y, z2 = z * z;
    return new Vec3(
      x * Math.sqrt(1 - y2 * 0.5 - z2 * 0.5 + (y2 * z2) / 3),
      y * Math.sqrt(1 - z2 * 0.5 - x2 * 0.5 + (z2 * x2) / 3),
      z * Math.sqrt(1 - x2 * 0.5 - y2 * 0.5 + (x2 * y2) / 3)
    );
  }

  static buildIndices(subdiv) {
    const indices = [];
    const n = subdiv + 1;

    for (let faceId = 0; faceId < 6; faceId++) {
      const offset = faceId * n * n;

      for (let j = 0; j < subdiv; j++) {
        for (let i = 0; i < subdiv; i++) {
          const v00 = offset + j * n + i;
          const v10 = offset + j * n + (i + 1);
          const v11 = offset + (j + 1) * n + (i + 1);
          const v01 = offset + (j + 1) * n + i;

          indices.push(v00, v10, v11, v00, v11, v01);
        }
      }
    }

    return indices;
  }
}
