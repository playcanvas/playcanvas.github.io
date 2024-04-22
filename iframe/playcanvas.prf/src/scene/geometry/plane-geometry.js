import { Vec2 } from '../../core/math/vec2.js';
import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

class PlaneGeometry extends Geometry {
  constructor(opts = {}) {
    var _opts$halfExtents, _opts$widthSegments, _opts$lengthSegments;
    super();
    const he = (_opts$halfExtents = opts.halfExtents) != null ? _opts$halfExtents : new Vec2(0.5, 0.5);
    const ws = (_opts$widthSegments = opts.widthSegments) != null ? _opts$widthSegments : 5;
    const ls = (_opts$lengthSegments = opts.lengthSegments) != null ? _opts$lengthSegments : 5;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let vcounter = 0;
    for (let i = 0; i <= ws; i++) {
      for (let j = 0; j <= ls; j++) {
        const x = -he.x + 2 * he.x * i / ws;
        const y = 0.0;
        const z = -(-he.y + 2 * he.y * j / ls);
        const u = i / ws;
        const v = j / ls;
        positions.push(x, y, z);
        normals.push(0, 1, 0);
        uvs.push(u, 1 - v);
        if (i < ws && j < ls) {
          indices.push(vcounter + ls + 1, vcounter + 1, vcounter);
          indices.push(vcounter + ls + 1, vcounter + ls + 2, vcounter + 1);
        }
        vcounter++;
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

export { PlaneGeometry };
