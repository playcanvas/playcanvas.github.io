import { calculateNormals, calculateTangents } from './geometry-utils.js';

class Geometry {
  constructor() {
    this.positions = void 0;
    this.normals = void 0;
    this.colors = void 0;
    this.uvs = void 0;
    this.uvs1 = void 0;
    this.blendIndices = void 0;
    this.blendWeights = void 0;
    this.tangents = void 0;
    this.indices = void 0;
  }
  calculateNormals() {
    this.normals = calculateNormals(this.positions, this.indices);
  }
  calculateTangents() {
    this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
  }
}

export { Geometry };
