import { SphereGeometry } from './sphere-geometry.js';

class DomeGeometry extends SphereGeometry {
  constructor(opts = {}) {
    var _opts$latitudeBands, _opts$longitudeBands;
    const radius = 0.5;
    const latitudeBands = (_opts$latitudeBands = opts.latitudeBands) != null ? _opts$latitudeBands : 16;
    const longitudeBands = (_opts$longitudeBands = opts.longitudeBands) != null ? _opts$longitudeBands : 16;
    super({
      radius,
      latitudeBands,
      longitudeBands
    });
    const bottomLimit = 0.1;
    const curvatureRadius = 0.95;
    const curvatureRadiusSq = curvatureRadius * curvatureRadius;
    const positions = this.positions;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] / radius;
      let y = positions[i + 1] / radius;
      const z = positions[i + 2] / radius;
      if (y < 0) {
        y *= 0.3;
        if (x * x + z * z < curvatureRadiusSq) {
          y = -bottomLimit;
        }
      }
      y += bottomLimit;
      y *= radius;
      positions[i + 1] = y;
    }
  }
}

export { DomeGeometry };
