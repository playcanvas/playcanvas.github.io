/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_WORLD } from '../constants.js';

/**
 * Holds mesh batching settings and a unique id. Created via {@link BatchManager#addGroup}.
 *
 * @property {boolean} dynamic Whether objects within this batch group should support transforming
 * at runtime.
 * @property {number} maxAabbSize Maximum size of any dimension of a bounding box around batched
 * objects. {@link BatchManager#prepare} will split objects into local groups based on this size.
 * @property {number} id Unique id. Can be assigned to model and element components.
 * @property {string} name Name of the group.
 * @property {number[]} [layers] Layer ID array. Default is [{@link LAYERID_WORLD}]. The whole
 * batch group will belong to these layers. Layers of source models will be ignored.
 */
class BatchGroup {
  /**
   * Create a new BatchGroup instance.
   *
   * @param {number} id - Unique id. Can be assigned to model and element components.
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
    this.dynamic = dynamic;
    this.maxAabbSize = maxAabbSize;
    this.id = id;
    this.name = name;
    this.layers = layers;
    this._ui = false;
    this._sprite = false;
    this._obj = {
      model: [],
      element: [],
      sprite: [],
      render: []
    };
  }
}
BatchGroup.MODEL = 'model';
BatchGroup.ELEMENT = 'element';
BatchGroup.SPRITE = 'sprite';
BatchGroup.RENDER = 'render';

export { BatchGroup };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtZ3JvdXAuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9iYXRjaGluZy9iYXRjaC1ncm91cC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX1dPUkxEIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBIb2xkcyBtZXNoIGJhdGNoaW5nIHNldHRpbmdzIGFuZCBhIHVuaXF1ZSBpZC4gQ3JlYXRlZCB2aWEge0BsaW5rIEJhdGNoTWFuYWdlciNhZGRHcm91cH0uXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBkeW5hbWljIFdoZXRoZXIgb2JqZWN0cyB3aXRoaW4gdGhpcyBiYXRjaCBncm91cCBzaG91bGQgc3VwcG9ydCB0cmFuc2Zvcm1pbmdcbiAqIGF0IHJ1bnRpbWUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWF4QWFiYlNpemUgTWF4aW11bSBzaXplIG9mIGFueSBkaW1lbnNpb24gb2YgYSBib3VuZGluZyBib3ggYXJvdW5kIGJhdGNoZWRcbiAqIG9iamVjdHMuIHtAbGluayBCYXRjaE1hbmFnZXIjcHJlcGFyZX0gd2lsbCBzcGxpdCBvYmplY3RzIGludG8gbG9jYWwgZ3JvdXBzIGJhc2VkIG9uIHRoaXMgc2l6ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpZCBVbmlxdWUgaWQuIENhbiBiZSBhc3NpZ25lZCB0byBtb2RlbCBhbmQgZWxlbWVudCBjb21wb25lbnRzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgZ3JvdXAuXG4gKiBAcHJvcGVydHkge251bWJlcltdfSBbbGF5ZXJzXSBMYXllciBJRCBhcnJheS4gRGVmYXVsdCBpcyBbe0BsaW5rIExBWUVSSURfV09STER9XS4gVGhlIHdob2xlXG4gKiBiYXRjaCBncm91cCB3aWxsIGJlbG9uZyB0byB0aGVzZSBsYXllcnMuIExheWVycyBvZiBzb3VyY2UgbW9kZWxzIHdpbGwgYmUgaWdub3JlZC5cbiAqL1xuY2xhc3MgQmF0Y2hHcm91cCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEJhdGNoR3JvdXAgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBVbmlxdWUgaWQuIENhbiBiZSBhc3NpZ25lZCB0byBtb2RlbCBhbmQgZWxlbWVudCBjb21wb25lbnRzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGdyb3VwLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZHluYW1pYyAtIFdoZXRoZXIgb2JqZWN0cyB3aXRoaW4gdGhpcyBiYXRjaCBncm91cCBzaG91bGQgc3VwcG9ydFxuICAgICAqIHRyYW5zZm9ybWluZyBhdCBydW50aW1lLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhBYWJiU2l6ZSAtIE1heGltdW0gc2l6ZSBvZiBhbnkgZGltZW5zaW9uIG9mIGEgYm91bmRpbmcgYm94IGFyb3VuZCBiYXRjaGVkXG4gICAgICogb2JqZWN0cy4ge0BsaW5rIEJhdGNoTWFuYWdlciNwcmVwYXJlfSB3aWxsIHNwbGl0IG9iamVjdHMgaW50byBsb2NhbCBncm91cHMgYmFzZWQgb24gdGhpc1xuICAgICAqIHNpemUuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gW2xheWVyc10gLSBMYXllciBJRCBhcnJheS4gRGVmYXVsdCBpcyBbe0BsaW5rIExBWUVSSURfV09STER9XS4gVGhlIHdob2xlXG4gICAgICogYmF0Y2ggZ3JvdXAgd2lsbCBiZWxvbmcgdG8gdGhlc2UgbGF5ZXJzLiBMYXllcnMgb2Ygc291cmNlIG1vZGVscyB3aWxsIGJlIGlnbm9yZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoaWQsIG5hbWUsIGR5bmFtaWMsIG1heEFhYmJTaXplLCBsYXllcnMgPSBbTEFZRVJJRF9XT1JMRF0pIHtcbiAgICAgICAgdGhpcy5keW5hbWljID0gZHluYW1pYztcbiAgICAgICAgdGhpcy5tYXhBYWJiU2l6ZSA9IG1heEFhYmJTaXplO1xuICAgICAgICB0aGlzLmlkID0gaWQ7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gICAgICAgIHRoaXMubGF5ZXJzID0gbGF5ZXJzO1xuICAgICAgICB0aGlzLl91aSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zcHJpdGUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fb2JqID0ge1xuICAgICAgICAgICAgbW9kZWw6IFtdLFxuICAgICAgICAgICAgZWxlbWVudDogW10sXG4gICAgICAgICAgICBzcHJpdGU6IFtdLFxuICAgICAgICAgICAgcmVuZGVyOiBbXVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHN0YXRpYyBNT0RFTCA9ICdtb2RlbCc7XG5cbiAgICBzdGF0aWMgRUxFTUVOVCA9ICdlbGVtZW50JztcblxuICAgIHN0YXRpYyBTUFJJVEUgPSAnc3ByaXRlJztcblxuICAgIHN0YXRpYyBSRU5ERVIgPSAncmVuZGVyJztcbn1cblxuZXhwb3J0IHsgQmF0Y2hHcm91cCB9O1xuIl0sIm5hbWVzIjpbIkJhdGNoR3JvdXAiLCJjb25zdHJ1Y3RvciIsImlkIiwibmFtZSIsImR5bmFtaWMiLCJtYXhBYWJiU2l6ZSIsImxheWVycyIsIkxBWUVSSURfV09STEQiLCJfdWkiLCJfc3ByaXRlIiwiX29iaiIsIm1vZGVsIiwiZWxlbWVudCIsInNwcml0ZSIsInJlbmRlciIsIk1PREVMIiwiRUxFTUVOVCIsIlNQUklURSIsIlJFTkRFUiJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFVBQVUsQ0FBQztBQUNiO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsRUFBRSxFQUFFQyxJQUFJLEVBQUVDLE9BQU8sRUFBRUMsV0FBVyxFQUFFQyxNQUFNLEdBQUcsQ0FBQ0MsYUFBYSxDQUFDLEVBQUU7SUFDbEUsSUFBSSxDQUFDSCxPQUFPLEdBQUdBLE9BQU8sQ0FBQTtJQUN0QixJQUFJLENBQUNDLFdBQVcsR0FBR0EsV0FBVyxDQUFBO0lBQzlCLElBQUksQ0FBQ0gsRUFBRSxHQUFHQSxFQUFFLENBQUE7SUFDWixJQUFJLENBQUNDLElBQUksR0FBR0EsSUFBSSxDQUFBO0lBQ2hCLElBQUksQ0FBQ0csTUFBTSxHQUFHQSxNQUFNLENBQUE7SUFDcEIsSUFBSSxDQUFDRSxHQUFHLEdBQUcsS0FBSyxDQUFBO0lBQ2hCLElBQUksQ0FBQ0MsT0FBTyxHQUFHLEtBQUssQ0FBQTtJQUNwQixJQUFJLENBQUNDLElBQUksR0FBRztBQUNSQyxNQUFBQSxLQUFLLEVBQUUsRUFBRTtBQUNUQyxNQUFBQSxPQUFPLEVBQUUsRUFBRTtBQUNYQyxNQUFBQSxNQUFNLEVBQUUsRUFBRTtBQUNWQyxNQUFBQSxNQUFNLEVBQUUsRUFBQTtLQUNYLENBQUE7QUFDTCxHQUFBO0FBU0osQ0FBQTtBQXJDTWQsVUFBVSxDQThCTGUsS0FBSyxHQUFHLE9BQU8sQ0FBQTtBQTlCcEJmLFVBQVUsQ0FnQ0xnQixPQUFPLEdBQUcsU0FBUyxDQUFBO0FBaEN4QmhCLFVBQVUsQ0FrQ0xpQixNQUFNLEdBQUcsUUFBUSxDQUFBO0FBbEN0QmpCLFVBQVUsQ0FvQ0xrQixNQUFNLEdBQUcsUUFBUTs7OzsifQ==
