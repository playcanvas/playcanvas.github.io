import { BoundingBox } from '../../core/shape/bounding-box.js';
import { Entity } from '../entity.js';
import { GSplatInstance } from '../../scene/gsplat/gsplat-instance.js';
import { GSplat } from '../../scene/gsplat/gsplat.js';

/**
 * The resource for the gsplat asset type.
 *
 * @category Graphics
 */
class GSplatResource {
  /**
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The graphics device.
   * @param {import('../../scene/gsplat/gsplat-data.js').GSplatData} splatData - The splat data.
   * @ignore
   */
  constructor(device, splatData) {
    /**
     * @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice}
     * @ignore
     */
    this.device = void 0;
    /**
     * @type {import('../../scene/gsplat/gsplat-data.js').GSplatData}
     * @ignore
     */
    this.splatData = void 0;
    /**
     * @type {GSplat | null}
     * @ignore
     */
    this.splat = null;
    this.device = device;
    this.splatData = splatData.isCompressed ? splatData.decompress() : splatData;
  }
  destroy() {
    var _this$splat;
    this.device = null;
    this.splatData = null;
    (_this$splat = this.splat) == null || _this$splat.destroy();
    this.splat = null;
  }
  createSplat() {
    if (!this.splat) {
      const splatData = this.splatData;
      const aabb = new BoundingBox();
      this.splatData.calcAabb(aabb);
      const splat = new GSplat(this.device, splatData.numSplats, aabb);
      this.splat = splat;

      // texture data
      splat.updateColorData(splatData.getProp('f_dc_0'), splatData.getProp('f_dc_1'), splatData.getProp('f_dc_2'), splatData.getProp('opacity'));
      splat.updateTransformData(splatData.getProp('x'), splatData.getProp('y'), splatData.getProp('z'), splatData.getProp('rot_0'), splatData.getProp('rot_1'), splatData.getProp('rot_2'), splatData.getProp('rot_3'), splatData.getProp('scale_0'), splatData.getProp('scale_1'), splatData.getProp('scale_2'));

      // centers - constant buffer that is sent to the worker
      const x = splatData.getProp('x');
      const y = splatData.getProp('y');
      const z = splatData.getProp('z');
      const centers = new Float32Array(this.splatData.numSplats * 3);
      for (let i = 0; i < this.splatData.numSplats; ++i) {
        centers[i * 3 + 0] = x[i];
        centers[i * 3 + 1] = y[i];
        centers[i * 3 + 2] = z[i];
      }
      splat.centers = centers;
    }
    return this.splat;
  }

  /**
   * Instantiates an entity with a {@link GSplatComponent}.
   *
   * @param {import('../../scene/gsplat/gsplat-material.js').SplatMaterialOptions} [options] - The options.
   * @returns {Entity} The entity with {@link GSplatComponent}.
   */
  instantiate(options = {}) {
    const splatInstance = this.createInstance(options);
    const entity = new Entity();
    const component = entity.addComponent('gsplat', {
      instance: splatInstance
    });

    // set custom aabb
    component.customAabb = splatInstance.splat.aabb.clone();
    return entity;
  }
  createInstance(options = {}) {
    // shared splat between instances
    const splat = this.createSplat();
    return new GSplatInstance(splat, options);
  }
}

export { GSplatResource };
