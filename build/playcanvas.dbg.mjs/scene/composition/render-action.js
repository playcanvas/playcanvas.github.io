/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { LIGHTTYPE_DIRECTIONAL } from '../constants.js';

/**
 * Class representing an entry in the final order of rendering of cameras and layers in the engine
 * this is populated at runtime based on LayerComposition
 *
 * @ignore
 */
class RenderAction {
  constructor() {
    // index into a layer stored in LayerComposition.layerList
    this.layerIndex = 0;

    // index into a camera array of the layer, stored in Layer.cameras
    this.cameraIndex = 0;

    // camera of type CameraComponent
    this.camera = null;

    /**
     * render target this render action renders to (taken from either camera or layer)
     *
     * @type {import('../../platform/graphics/render-target.js').RenderTarget|null}
     */
    this.renderTarget = null;

    // light clusters (type WorldClusters)
    this.lightClusters = null;

    // clear flags
    this.clearColor = false;
    this.clearDepth = false;
    this.clearStencil = false;

    // true if this render action should trigger postprocessing callback for the camera
    this.triggerPostprocess = false;

    // true if this is first render action using this camera
    this.firstCameraUse = false;

    // true if this is the last render action using this camera
    this.lastCameraUse = false;

    // directional lights that needs to update their shadows for this render action, stored as a set
    this.directionalLightsSet = new Set();

    // and also store them as an array
    this.directionalLights = [];

    // and also the same directional lights, stored as indices into LayerComposition._lights
    this.directionalLightsIndices = [];

    // an array of view bind groups (the number of these corresponds to the number of views when XR is used)
    /** @type {import('../../platform/graphics/bind-group.js').BindGroup[]} */
    this.viewBindGroups = [];
  }

  // releases GPU resources
  destroy() {
    this.viewBindGroups.forEach(bg => {
      bg.defaultUniformBuffer.destroy();
      bg.destroy();
    });
    this.viewBindGroups.length = 0;
  }
  get hasDirectionalShadowLights() {
    return this.directionalLights.length > 0;
  }

  // prepares render action for re-use
  reset() {
    this.lightClusters = null;
    this.directionalLightsSet.clear();
    this.directionalLights.length = 0;
    this.directionalLightsIndices.length = 0;
  }

  /**
   * @param {import('./layer-composition.js').LayerComposition} layerComposition - The layer
   * composition.
   * @returns {boolean} - True if the layer / sublayer referenced by the render action is enabled
   */
  isLayerEnabled(layerComposition) {
    const layer = layerComposition.layerList[this.layerIndex];
    return layer.enabled && layerComposition.subLayerEnabled[this.layerIndex];
  }

  // store directional lights that are needed for this camera based on layers it renders
  collectDirectionalLights(cameraLayers, dirLights, allLights) {
    this.directionalLightsSet.clear();
    this.directionalLights.length = 0;
    this.directionalLightsIndices.length = 0;
    for (let i = 0; i < dirLights.length; i++) {
      const light = dirLights[i];

      // only shadow casting lights
      if (light.castShadows) {
        for (let l = 0; l < cameraLayers.length; l++) {
          // if layer has the light
          if (cameraLayers[l]._splitLights[LIGHTTYPE_DIRECTIONAL].indexOf(light) >= 0) {
            if (!this.directionalLightsSet.has(light)) {
              this.directionalLightsSet.add(light);
              this.directionalLights.push(light);

              // store index into all lights
              const lightIndex = allLights.indexOf(light);
              this.directionalLightsIndices.push(lightIndex);
            }
          }
        }
      }
    }
  }
}

export { RenderAction };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLWFjdGlvbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2NvbXBvc2l0aW9uL3JlbmRlci1hY3Rpb24uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUxcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBDbGFzcyByZXByZXNlbnRpbmcgYW4gZW50cnkgaW4gdGhlIGZpbmFsIG9yZGVyIG9mIHJlbmRlcmluZyBvZiBjYW1lcmFzIGFuZCBsYXllcnMgaW4gdGhlIGVuZ2luZVxuICogdGhpcyBpcyBwb3B1bGF0ZWQgYXQgcnVudGltZSBiYXNlZCBvbiBMYXllckNvbXBvc2l0aW9uXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZW5kZXJBY3Rpb24ge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuXG4gICAgICAgIC8vIGluZGV4IGludG8gYSBsYXllciBzdG9yZWQgaW4gTGF5ZXJDb21wb3NpdGlvbi5sYXllckxpc3RcbiAgICAgICAgdGhpcy5sYXllckluZGV4ID0gMDtcblxuICAgICAgICAvLyBpbmRleCBpbnRvIGEgY2FtZXJhIGFycmF5IG9mIHRoZSBsYXllciwgc3RvcmVkIGluIExheWVyLmNhbWVyYXNcbiAgICAgICAgdGhpcy5jYW1lcmFJbmRleCA9IDA7XG5cbiAgICAgICAgLy8gY2FtZXJhIG9mIHR5cGUgQ2FtZXJhQ29tcG9uZW50XG4gICAgICAgIHRoaXMuY2FtZXJhID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmVuZGVyIHRhcmdldCB0aGlzIHJlbmRlciBhY3Rpb24gcmVuZGVycyB0byAodGFrZW4gZnJvbSBlaXRoZXIgY2FtZXJhIG9yIGxheWVyKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fG51bGx9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IG51bGw7XG5cbiAgICAgICAgLy8gbGlnaHQgY2x1c3RlcnMgKHR5cGUgV29ybGRDbHVzdGVycylcbiAgICAgICAgdGhpcy5saWdodENsdXN0ZXJzID0gbnVsbDtcblxuICAgICAgICAvLyBjbGVhciBmbGFnc1xuICAgICAgICB0aGlzLmNsZWFyQ29sb3IgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gZmFsc2U7XG4gICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsID0gZmFsc2U7XG5cbiAgICAgICAgLy8gdHJ1ZSBpZiB0aGlzIHJlbmRlciBhY3Rpb24gc2hvdWxkIHRyaWdnZXIgcG9zdHByb2Nlc3NpbmcgY2FsbGJhY2sgZm9yIHRoZSBjYW1lcmFcbiAgICAgICAgdGhpcy50cmlnZ2VyUG9zdHByb2Nlc3MgPSBmYWxzZTtcblxuICAgICAgICAvLyB0cnVlIGlmIHRoaXMgaXMgZmlyc3QgcmVuZGVyIGFjdGlvbiB1c2luZyB0aGlzIGNhbWVyYVxuICAgICAgICB0aGlzLmZpcnN0Q2FtZXJhVXNlID0gZmFsc2U7XG5cbiAgICAgICAgLy8gdHJ1ZSBpZiB0aGlzIGlzIHRoZSBsYXN0IHJlbmRlciBhY3Rpb24gdXNpbmcgdGhpcyBjYW1lcmFcbiAgICAgICAgdGhpcy5sYXN0Q2FtZXJhVXNlID0gZmFsc2U7XG5cbiAgICAgICAgLy8gZGlyZWN0aW9uYWwgbGlnaHRzIHRoYXQgbmVlZHMgdG8gdXBkYXRlIHRoZWlyIHNoYWRvd3MgZm9yIHRoaXMgcmVuZGVyIGFjdGlvbiwgc3RvcmVkIGFzIGEgc2V0XG4gICAgICAgIHRoaXMuZGlyZWN0aW9uYWxMaWdodHNTZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLy8gYW5kIGFsc28gc3RvcmUgdGhlbSBhcyBhbiBhcnJheVxuICAgICAgICB0aGlzLmRpcmVjdGlvbmFsTGlnaHRzID0gW107XG5cbiAgICAgICAgLy8gYW5kIGFsc28gdGhlIHNhbWUgZGlyZWN0aW9uYWwgbGlnaHRzLCBzdG9yZWQgYXMgaW5kaWNlcyBpbnRvIExheWVyQ29tcG9zaXRpb24uX2xpZ2h0c1xuICAgICAgICB0aGlzLmRpcmVjdGlvbmFsTGlnaHRzSW5kaWNlcyA9IFtdO1xuXG4gICAgICAgIC8vIGFuIGFycmF5IG9mIHZpZXcgYmluZCBncm91cHMgKHRoZSBudW1iZXIgb2YgdGhlc2UgY29ycmVzcG9uZHMgdG8gdGhlIG51bWJlciBvZiB2aWV3cyB3aGVuIFhSIGlzIHVzZWQpXG4gICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9iaW5kLWdyb3VwLmpzJykuQmluZEdyb3VwW119ICovXG4gICAgICAgIHRoaXMudmlld0JpbmRHcm91cHMgPSBbXTtcbiAgICB9XG5cbiAgICAvLyByZWxlYXNlcyBHUFUgcmVzb3VyY2VzXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy52aWV3QmluZEdyb3Vwcy5mb3JFYWNoKChiZykgPT4ge1xuICAgICAgICAgICAgYmcuZGVmYXVsdFVuaWZvcm1CdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgYmcuZGVzdHJveSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy52aWV3QmluZEdyb3Vwcy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIGdldCBoYXNEaXJlY3Rpb25hbFNoYWRvd0xpZ2h0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGlyZWN0aW9uYWxMaWdodHMubGVuZ3RoID4gMDtcbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlcyByZW5kZXIgYWN0aW9uIGZvciByZS11c2VcbiAgICByZXNldCgpIHtcbiAgICAgICAgdGhpcy5saWdodENsdXN0ZXJzID0gbnVsbDtcbiAgICAgICAgdGhpcy5kaXJlY3Rpb25hbExpZ2h0c1NldC5jbGVhcigpO1xuICAgICAgICB0aGlzLmRpcmVjdGlvbmFsTGlnaHRzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBsYXllckNvbXBvc2l0aW9uIC0gVGhlIGxheWVyXG4gICAgICogY29tcG9zaXRpb24uXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IC0gVHJ1ZSBpZiB0aGUgbGF5ZXIgLyBzdWJsYXllciByZWZlcmVuY2VkIGJ5IHRoZSByZW5kZXIgYWN0aW9uIGlzIGVuYWJsZWRcbiAgICAgKi9cbiAgICBpc0xheWVyRW5hYmxlZChsYXllckNvbXBvc2l0aW9uKSB7XG4gICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJDb21wb3NpdGlvbi5sYXllckxpc3RbdGhpcy5sYXllckluZGV4XTtcbiAgICAgICAgcmV0dXJuIGxheWVyLmVuYWJsZWQgJiYgbGF5ZXJDb21wb3NpdGlvbi5zdWJMYXllckVuYWJsZWRbdGhpcy5sYXllckluZGV4XTtcbiAgICB9XG5cbiAgICAvLyBzdG9yZSBkaXJlY3Rpb25hbCBsaWdodHMgdGhhdCBhcmUgbmVlZGVkIGZvciB0aGlzIGNhbWVyYSBiYXNlZCBvbiBsYXllcnMgaXQgcmVuZGVyc1xuICAgIGNvbGxlY3REaXJlY3Rpb25hbExpZ2h0cyhjYW1lcmFMYXllcnMsIGRpckxpZ2h0cywgYWxsTGlnaHRzKSB7XG5cbiAgICAgICAgdGhpcy5kaXJlY3Rpb25hbExpZ2h0c1NldC5jbGVhcigpO1xuICAgICAgICB0aGlzLmRpcmVjdGlvbmFsTGlnaHRzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuZGlyZWN0aW9uYWxMaWdodHNJbmRpY2VzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkaXJMaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gZGlyTGlnaHRzW2ldO1xuXG4gICAgICAgICAgICAvLyBvbmx5IHNoYWRvdyBjYXN0aW5nIGxpZ2h0c1xuICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbCA9IDA7IGwgPCBjYW1lcmFMYXllcnMubGVuZ3RoOyBsKyspIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiBsYXllciBoYXMgdGhlIGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmFMYXllcnNbbF0uX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9ESVJFQ1RJT05BTF0uaW5kZXhPZihsaWdodCkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRpcmVjdGlvbmFsTGlnaHRzU2V0LmhhcyhsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpcmVjdGlvbmFsTGlnaHRzU2V0LmFkZChsaWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpcmVjdGlvbmFsTGlnaHRzLnB1c2gobGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3RvcmUgaW5kZXggaW50byBhbGwgbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRJbmRleCA9IGFsbExpZ2h0cy5pbmRleE9mKGxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpcmVjdGlvbmFsTGlnaHRzSW5kaWNlcy5wdXNoKGxpZ2h0SW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBSZW5kZXJBY3Rpb24gfTtcbiJdLCJuYW1lcyI6WyJSZW5kZXJBY3Rpb24iLCJjb25zdHJ1Y3RvciIsImxheWVySW5kZXgiLCJjYW1lcmFJbmRleCIsImNhbWVyYSIsInJlbmRlclRhcmdldCIsImxpZ2h0Q2x1c3RlcnMiLCJjbGVhckNvbG9yIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsInRyaWdnZXJQb3N0cHJvY2VzcyIsImZpcnN0Q2FtZXJhVXNlIiwibGFzdENhbWVyYVVzZSIsImRpcmVjdGlvbmFsTGlnaHRzU2V0IiwiU2V0IiwiZGlyZWN0aW9uYWxMaWdodHMiLCJkaXJlY3Rpb25hbExpZ2h0c0luZGljZXMiLCJ2aWV3QmluZEdyb3VwcyIsImRlc3Ryb3kiLCJmb3JFYWNoIiwiYmciLCJkZWZhdWx0VW5pZm9ybUJ1ZmZlciIsImxlbmd0aCIsImhhc0RpcmVjdGlvbmFsU2hhZG93TGlnaHRzIiwicmVzZXQiLCJjbGVhciIsImlzTGF5ZXJFbmFibGVkIiwibGF5ZXJDb21wb3NpdGlvbiIsImxheWVyIiwibGF5ZXJMaXN0IiwiZW5hYmxlZCIsInN1YkxheWVyRW5hYmxlZCIsImNvbGxlY3REaXJlY3Rpb25hbExpZ2h0cyIsImNhbWVyYUxheWVycyIsImRpckxpZ2h0cyIsImFsbExpZ2h0cyIsImkiLCJsaWdodCIsImNhc3RTaGFkb3dzIiwibCIsIl9zcGxpdExpZ2h0cyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImluZGV4T2YiLCJoYXMiLCJhZGQiLCJwdXNoIiwibGlnaHRJbmRleCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFlBQVksQ0FBQztBQUNmQyxFQUFBQSxXQUFXLEdBQUc7QUFFVjtJQUNBLElBQUksQ0FBQ0MsVUFBVSxHQUFHLENBQUMsQ0FBQTs7QUFFbkI7SUFDQSxJQUFJLENBQUNDLFdBQVcsR0FBRyxDQUFDLENBQUE7O0FBRXBCO0lBQ0EsSUFBSSxDQUFDQyxNQUFNLEdBQUcsSUFBSSxDQUFBOztBQUVsQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxZQUFZLEdBQUcsSUFBSSxDQUFBOztBQUV4QjtJQUNBLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUksQ0FBQTs7QUFFekI7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
