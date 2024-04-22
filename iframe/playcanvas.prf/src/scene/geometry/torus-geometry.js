import { math } from '../../core/math/math.js';
import { calculateTangents } from './geometry-utils.js';
import { Geometry } from './geometry.js';

class TorusGeometry extends Geometry {
  constructor(opts = {}) {
    var _opts$tubeRadius, _opts$ringRadius, _opts$sectorAngle, _opts$segments, _opts$sides;
    super();
    const rc = (_opts$tubeRadius = opts.tubeRadius) != null ? _opts$tubeRadius : 0.2;
    const rt = (_opts$ringRadius = opts.ringRadius) != null ? _opts$ringRadius : 0.3;
    const sectorAngle = ((_opts$sectorAngle = opts.sectorAngle) != null ? _opts$sectorAngle : 360) * math.DEG_TO_RAD;
    const segments = (_opts$segments = opts.segments) != null ? _opts$segments : 30;
    const sides = (_opts$sides = opts.sides) != null ? _opts$sides : 20;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= sides; i++) {
      for (let j = 0; j <= segments; j++) {
        const x = Math.cos(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
        const y = Math.sin(2 * Math.PI * i / sides) * rc;
        const z = Math.sin(sectorAngle * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
        const nx = Math.cos(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);
        const ny = Math.sin(2 * Math.PI * i / sides);
        const nz = Math.sin(sectorAngle * j / segments) * Math.cos(2 * Math.PI * i / sides);
        const u = i / sides;
        const v = 1 - j / segments;
        positions.push(x, y, z);
        normals.push(nx, ny, nz);
        uvs.push(u, 1.0 - v);
        if (i < sides && j < segments) {
          const first = i * (segments + 1) + j;
          const second = (i + 1) * (segments + 1) + j;
          const third = i * (segments + 1) + (j + 1);
          const fourth = (i + 1) * (segments + 1) + (j + 1);
          indices.push(first, second, third);
          indices.push(second, fourth, third);
        }
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

export { TorusGeometry };
