import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

class CylinderGeometry extends ConeBaseGeometry {
  constructor(opts = {}) {
    var _opts$radius, _opts$height, _opts$heightSegments, _opts$capSegments;
    const radius = (_opts$radius = opts.radius) != null ? _opts$radius : 0.5;
    const height = (_opts$height = opts.height) != null ? _opts$height : 1;
    const heightSegments = (_opts$heightSegments = opts.heightSegments) != null ? _opts$heightSegments : 5;
    const capSegments = (_opts$capSegments = opts.capSegments) != null ? _opts$capSegments : 20;
    super(radius, radius, height, heightSegments, capSegments, false);
    if (opts.calculateTangents) {
      this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
    }
  }
}

export { CylinderGeometry };
