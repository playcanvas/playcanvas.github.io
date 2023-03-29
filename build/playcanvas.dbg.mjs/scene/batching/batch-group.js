/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_WORLD } from '../constants.js';

/**
 * Holds mesh batching settings and a unique id. Created via {@link BatchManager#addGroup}.
 */
class BatchGroup {
  /** @private */

  /** @private */

  /** @private */

  /**
   * Unique id. Can be assigned to model, render and element components.
   *
   * @type {number}
   */

  /**
   * Name of the group.
   *
   * @type {string}
   */

  /**
   * Whether objects within this batch group should support transforming at runtime.
   *
   * @type {boolean}
   */

  /**
   * Maximum size of any dimension of a bounding box around batched objects.
   * {@link BatchManager#prepare} will split objects into local groups based on this size.
   *
   * @type {number}
   */

  /**
   * Layer ID array. Default is [{@link LAYERID_WORLD}]. The whole batch group will belong to
   * these layers. Layers of source models will be ignored.
   *
   * @type {number[]}
   */

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
    this._ui = false;
    this._sprite = false;
    this._obj = {
      model: [],
      element: [],
      sprite: [],
      render: []
    };
    this.id = void 0;
    this.name = void 0;
    this.dynamic = void 0;
    this.maxAabbSize = void 0;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtZ3JvdXAuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9iYXRjaGluZy9iYXRjaC1ncm91cC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX1dPUkxEIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBIb2xkcyBtZXNoIGJhdGNoaW5nIHNldHRpbmdzIGFuZCBhIHVuaXF1ZSBpZC4gQ3JlYXRlZCB2aWEge0BsaW5rIEJhdGNoTWFuYWdlciNhZGRHcm91cH0uXG4gKi9cbmNsYXNzIEJhdGNoR3JvdXAge1xuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF91aSA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3Nwcml0ZSA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29iaiA9IHtcbiAgICAgICAgbW9kZWw6IFtdLFxuICAgICAgICBlbGVtZW50OiBbXSxcbiAgICAgICAgc3ByaXRlOiBbXSxcbiAgICAgICAgcmVuZGVyOiBbXVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBVbmlxdWUgaWQuIENhbiBiZSBhc3NpZ25lZCB0byBtb2RlbCwgcmVuZGVyIGFuZCBlbGVtZW50IGNvbXBvbmVudHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGlkO1xuXG4gICAgLyoqXG4gICAgICogTmFtZSBvZiB0aGUgZ3JvdXAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWU7XG5cbiAgICAvKipcbiAgICAgKiBXaGV0aGVyIG9iamVjdHMgd2l0aGluIHRoaXMgYmF0Y2ggZ3JvdXAgc2hvdWxkIHN1cHBvcnQgdHJhbnNmb3JtaW5nIGF0IHJ1bnRpbWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBkeW5hbWljO1xuXG4gICAgLyoqXG4gICAgICogTWF4aW11bSBzaXplIG9mIGFueSBkaW1lbnNpb24gb2YgYSBib3VuZGluZyBib3ggYXJvdW5kIGJhdGNoZWQgb2JqZWN0cy5cbiAgICAgKiB7QGxpbmsgQmF0Y2hNYW5hZ2VyI3ByZXBhcmV9IHdpbGwgc3BsaXQgb2JqZWN0cyBpbnRvIGxvY2FsIGdyb3VwcyBiYXNlZCBvbiB0aGlzIHNpemUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIG1heEFhYmJTaXplO1xuXG4gICAgLyoqXG4gICAgICogTGF5ZXIgSUQgYXJyYXkuIERlZmF1bHQgaXMgW3tAbGluayBMQVlFUklEX1dPUkxEfV0uIFRoZSB3aG9sZSBiYXRjaCBncm91cCB3aWxsIGJlbG9uZyB0b1xuICAgICAqIHRoZXNlIGxheWVycy4gTGF5ZXJzIG9mIHNvdXJjZSBtb2RlbHMgd2lsbCBiZSBpZ25vcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIGxheWVycztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBCYXRjaEdyb3VwIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlkIC0gVW5pcXVlIGlkLiBDYW4gYmUgYXNzaWduZWQgdG8gbW9kZWwsIHJlbmRlciBhbmQgZWxlbWVudCBjb21wb25lbnRzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGdyb3VwLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZHluYW1pYyAtIFdoZXRoZXIgb2JqZWN0cyB3aXRoaW4gdGhpcyBiYXRjaCBncm91cCBzaG91bGQgc3VwcG9ydFxuICAgICAqIHRyYW5zZm9ybWluZyBhdCBydW50aW1lLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhBYWJiU2l6ZSAtIE1heGltdW0gc2l6ZSBvZiBhbnkgZGltZW5zaW9uIG9mIGEgYm91bmRpbmcgYm94IGFyb3VuZCBiYXRjaGVkXG4gICAgICogb2JqZWN0cy4ge0BsaW5rIEJhdGNoTWFuYWdlciNwcmVwYXJlfSB3aWxsIHNwbGl0IG9iamVjdHMgaW50byBsb2NhbCBncm91cHMgYmFzZWQgb24gdGhpc1xuICAgICAqIHNpemUuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gW2xheWVyc10gLSBMYXllciBJRCBhcnJheS4gRGVmYXVsdCBpcyBbe0BsaW5rIExBWUVSSURfV09STER9XS4gVGhlIHdob2xlXG4gICAgICogYmF0Y2ggZ3JvdXAgd2lsbCBiZWxvbmcgdG8gdGhlc2UgbGF5ZXJzLiBMYXllcnMgb2Ygc291cmNlIG1vZGVscyB3aWxsIGJlIGlnbm9yZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoaWQsIG5hbWUsIGR5bmFtaWMsIG1heEFhYmJTaXplLCBsYXllcnMgPSBbTEFZRVJJRF9XT1JMRF0pIHtcbiAgICAgICAgdGhpcy5pZCA9IGlkO1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgICAgICB0aGlzLmR5bmFtaWMgPSBkeW5hbWljO1xuICAgICAgICB0aGlzLm1heEFhYmJTaXplID0gbWF4QWFiYlNpemU7XG4gICAgICAgIHRoaXMubGF5ZXJzID0gbGF5ZXJzO1xuICAgIH1cblxuICAgIHN0YXRpYyBNT0RFTCA9ICdtb2RlbCc7XG5cbiAgICBzdGF0aWMgRUxFTUVOVCA9ICdlbGVtZW50JztcblxuICAgIHN0YXRpYyBTUFJJVEUgPSAnc3ByaXRlJztcblxuICAgIHN0YXRpYyBSRU5ERVIgPSAncmVuZGVyJztcbn1cblxuZXhwb3J0IHsgQmF0Y2hHcm91cCB9O1xuIl0sIm5hbWVzIjpbIkJhdGNoR3JvdXAiLCJjb25zdHJ1Y3RvciIsImlkIiwibmFtZSIsImR5bmFtaWMiLCJtYXhBYWJiU2l6ZSIsImxheWVycyIsIkxBWUVSSURfV09STEQiLCJfdWkiLCJfc3ByaXRlIiwiX29iaiIsIm1vZGVsIiwiZWxlbWVudCIsInNwcml0ZSIsInJlbmRlciIsIk1PREVMIiwiRUxFTUVOVCIsIlNQUklURSIsIlJFTkRFUiJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFVBQVUsQ0FBQztBQUNiOztBQUdBOztBQUdBOztBQVFBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBVyxDQUFDQyxFQUFFLEVBQUVDLElBQUksRUFBRUMsT0FBTyxFQUFFQyxXQUFXLEVBQUVDLE1BQU0sR0FBRyxDQUFDQyxhQUFhLENBQUMsRUFBRTtJQUFBLElBL0R0RUMsQ0FBQUEsR0FBRyxHQUFHLEtBQUssQ0FBQTtJQUFBLElBR1hDLENBQUFBLE9BQU8sR0FBRyxLQUFLLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FHZkMsSUFBSSxHQUFHO0FBQ0hDLE1BQUFBLEtBQUssRUFBRSxFQUFFO0FBQ1RDLE1BQUFBLE9BQU8sRUFBRSxFQUFFO0FBQ1hDLE1BQUFBLE1BQU0sRUFBRSxFQUFFO0FBQ1ZDLE1BQUFBLE1BQU0sRUFBRSxFQUFBO0tBQ1gsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU9EWixFQUFFLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPRkMsSUFBSSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBT0pDLE9BQU8sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVFQQyxXQUFXLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FRWEMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBZ0JGLElBQUksQ0FBQ0osRUFBRSxHQUFHQSxFQUFFLENBQUE7SUFDWixJQUFJLENBQUNDLElBQUksR0FBR0EsSUFBSSxDQUFBO0lBQ2hCLElBQUksQ0FBQ0MsT0FBTyxHQUFHQSxPQUFPLENBQUE7SUFDdEIsSUFBSSxDQUFDQyxXQUFXLEdBQUdBLFdBQVcsQ0FBQTtJQUM5QixJQUFJLENBQUNDLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0FBQ3hCLEdBQUE7QUFTSixDQUFBO0FBaEZNTixVQUFVLENBeUVMZSxLQUFLLEdBQUcsT0FBTyxDQUFBO0FBekVwQmYsVUFBVSxDQTJFTGdCLE9BQU8sR0FBRyxTQUFTLENBQUE7QUEzRXhCaEIsVUFBVSxDQTZFTGlCLE1BQU0sR0FBRyxRQUFRLENBQUE7QUE3RXRCakIsVUFBVSxDQStFTGtCLE1BQU0sR0FBRyxRQUFROzs7OyJ9
