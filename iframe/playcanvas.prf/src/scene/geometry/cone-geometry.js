import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

class ConeGeometry extends ConeBaseGeometry {
  constructor(opts = {}) {
    var _opts$baseRadius, _opts$peakRadius, _opts$height, _opts$heightSegments, _opts$capSegments;
    const baseRadius = (_opts$baseRadius = opts.baseRadius) != null ? _opts$baseRadius : 0.5;
    const peakRadius = (_opts$peakRadius = opts.peakRadius) != null ? _opts$peakRadius : 0;
    const height = (_opts$height = opts.height) != null ? _opts$height : 1;
    const heightSegments = (_opts$heightSegments = opts.heightSegments) != null ? _opts$heightSegments : 5;
    const capSegments = (_opts$capSegments = opts.capSegments) != null ? _opts$capSegments : 18;
    super(baseRadius, peakRadius, height, heightSegments, capSegments, false);
    if (opts.calculateTangents) {
      this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
    }
  }
}

export { ConeGeometry };
