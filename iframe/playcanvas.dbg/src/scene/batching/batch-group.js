import { LAYERID_WORLD } from '../constants.js';

/**
 * Holds mesh batching settings and a unique id. Created via {@link BatchManager#addGroup}.
 *
 * @category Graphics
 */
class BatchGroup {
  /**
   * Create a new BatchGroup instance.
   *
   * @param {number} id - Unique id. Can be assigned to model, render and element components.
   * @param {string} name - The name of the group.
   * @param {boolean} dynamic - Whether objects within this batch group should support
   * transforming at runtime.
   * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched
   * objects. {@link BatchManager#prepare} will split objects into local groups based on this
   * size.
   * @param {number[]} [layers] - Layer ID array. Default is [{@link LAYERID_WORLD}]. The whole
   * batch group will belong to these layers. Layers of source models will be ignored.
   */
  constructor(id, name, dynamic, maxAabbSize, layers = [LAYERID_WORLD]) {
    /** @private */
    this._ui = false;
    /** @private */
    this._sprite = false;
    /** @private */
    this._obj = {
      model: [],
      element: [],
      sprite: [],
      render: []
    };
    /**
     * Unique id. Can be assigned to model, render and element components.
     *
     * @type {number}
     */
    this.id = void 0;
    /**
     * Name of the group.
     *
     * @type {string}
     */
    this.name = void 0;
    /**
     * Whether objects within this batch group should support transforming at runtime.
     *
     * @type {boolean}
     */
    this.dynamic = void 0;
    /**
     * Maximum size of any dimension of a bounding box around batched objects.
     * {@link BatchManager#prepare} will split objects into local groups based on this size.
     *
     * @type {number}
     */
    this.maxAabbSize = void 0;
    /**
     * Layer ID array. Default is [{@link LAYERID_WORLD}]. The whole batch group will belong to
     * these layers. Layers of source models will be ignored.
     *
     * @type {number[]}
     */
    this.layers = void 0;
    this.id = id;
    this.name = name;
    this.dynamic = dynamic;
    this.maxAabbSize = maxAabbSize;
    this.layers = layers;
  }
}
BatchGroup.MODEL = 'model';
BatchGroup.ELEMENT = 'element';
BatchGroup.SPRITE = 'sprite';
BatchGroup.RENDER = 'render';

export { BatchGroup };
