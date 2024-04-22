import { ConeBaseGeometry } from './cone-base-geometry.js';
import { calculateTangents } from './geometry-utils.js';

/**
 * A procedural cone-shaped geometry.
 *
 * The size, shape and tesselation properties of the cone can be controlled via constructor
 * parameters. By default, the function will create a cone standing vertically centered on the
 * XZ-plane with a base radius of 0.5, a height of 1.0, 5 height segments and 18 cap segments.
 *
 * Note that the cone is created with UVs in the range of 0 to 1.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics
 * device used to manage the mesh.
 * @param {object} [opts] - An object that specifies optional inputs for the function as follows:
 * @param {number} [opts.baseRadius] - The base radius of the cone (defaults to 0.5).
 * @param {number} [opts.peakRadius] - The peak radius of the cone (defaults to 0.0).
 * @param {number} [opts.height] - The length of the body of the cone (defaults to 1.0).
 * @param {number} [opts.heightSegments] - The number of divisions along the length of the cone
 * (defaults to 5).
 * @param {number} [opts.capSegments] - The number of divisions around the tubular body of the cone
 * (defaults to 18).
 * @param {boolean} [opts.calculateTangents] - Generate tangent information (defaults to false).
 * @category Graphics
 */
class ConeGeometry extends ConeBaseGeometry {
  constructor(opts = {}) {
    var _opts$baseRadius, _opts$peakRadius, _opts$height, _opts$heightSegments, _opts$capSegments;
    // Check the supplied options and provide defaults for unspecified ones
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
