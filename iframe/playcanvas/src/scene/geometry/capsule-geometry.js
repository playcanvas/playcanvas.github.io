import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

class CapsuleGeometry extends ConeBaseGeometry {
  constructor(opts = {}) {
    var _opts$radius, _opts$height, _opts$heightSegments, _opts$sides;
    const radius = (_opts$radius = opts.radius) != null ? _opts$radius : 0.3;
    const height = (_opts$height = opts.height) != null ? _opts$height : 1;
    const heightSegments = (_opts$heightSegments = opts.heightSegments) != null ? _opts$heightSegments : 1;
    const sides = (_opts$sides = opts.sides) != null ? _opts$sides : 20;
    super(radius, radius, height - 2 * radius, heightSegments, sides, true);
    if (opts.calculateTangents) {
      this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
    }
  }
}

export { CapsuleGeometry };
