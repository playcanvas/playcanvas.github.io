import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

class SphereGeometry extends Geometry {
  constructor(opts = {}) {
    var _opts$radius, _opts$latitudeBands, _opts$longitudeBands;
    super();
    const radius = (_opts$radius = opts.radius) != null ? _opts$radius : 0.5;
    const latitudeBands = (_opts$latitudeBands = opts.latitudeBands) != null ? _opts$latitudeBands : 16;
    const longitudeBands = (_opts$longitudeBands = opts.longitudeBands) != null ? _opts$longitudeBands : 16;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    for (let lat = 0; lat <= latitudeBands; lat++) {
      const theta = lat * Math.PI / latitudeBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let lon = 0; lon <= longitudeBands; lon++) {
        const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;
        const u = 1 - lon / longitudeBands;
        const v = 1 - lat / latitudeBands;
        positions.push(x * radius, y * radius, z * radius);
        normals.push(x, y, z);
        uvs.push(u, 1 - v);
      }
    }
    for (let lat = 0; lat < latitudeBands; ++lat) {
      for (let lon = 0; lon < longitudeBands; ++lon) {
        const first = lat * (longitudeBands + 1) + lon;
        const second = first + longitudeBands + 1;
        indices.push(first + 1, second, first);
        indices.push(first + 1, second + 1, second);
      }
    }
    this.positions = positions;
    this.normals = normals;
    this.uvs = uvs;
    this.uvs1 = uvs;
    this.indices = indices;
    if (opts.calculateTangents) {
      this.tangents = calculateTangents(positions, normals, uvs, indices);
    }
  }
}

export { SphereGeometry };
