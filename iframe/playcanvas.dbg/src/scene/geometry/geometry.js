import { Debug } from '../../core/debug.js';
import { calculateNormals, calculateTangents } from './geometry-utils.js';

/**
 * The Geometry class serves as a container for storing geometric information. It encapsulates data
 * such as positions, normals, colors, and indices.
 *
 * @category Graphics
 */
class Geometry {
  constructor() {
    /**
     * Positions.
     *
     * @type {number[]|undefined}
     */
    this.positions = void 0;
    /**
     * Normals.
     *
     * @type {number[]|undefined}
     */
    this.normals = void 0;
    /**
     * Colors.
     *
     * @type {number[]|undefined}
     */
    this.colors = void 0;
    /**
     * UVs.
     *
     * @type {number[]|undefined}
     */
    this.uvs = void 0;
    /**
     * Additional Uvs.
     *
     * @type {number[]|undefined}
     */
    this.uvs1 = void 0;
    /**
     * Blend indices.
     *
     * @type {number[]|undefined}
     */
    this.blendIndices = void 0;
    /**
     * Blend weights.
     *
     * @type {number[]|undefined}
     */
    this.blendWeights = void 0;
    /**
     * Tangents.
     *
     * @type {number[]|undefined}
     */
    this.tangents = void 0;
    /**
     * Indices.
     *
     * @type {number[]|undefined}
     */
    this.indices = void 0;
  }
  /**
   * Generates normal information from the positions and triangle indices.
   */
  calculateNormals() {
    Debug.assert(this.positions, 'Geometry must have positions set');
    Debug.assert(this.indices, 'Geometry must have indices set');
    this.normals = calculateNormals(this.positions, this.indices);
  }

  /**
   * Generates tangent information from the positions, normals, texture coordinates and triangle
   * indices.
   */
  calculateTangents() {
    Debug.assert(this.positions, 'Geometry must have positions set');
    Debug.assert(this.normals, 'Geometry must have normals set');
    Debug.assert(this.uvs, 'Geometry must have uvs set');
    Debug.assert(this.indices, 'Geometry must have indices set');
    this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
  }
}

export { Geometry };
