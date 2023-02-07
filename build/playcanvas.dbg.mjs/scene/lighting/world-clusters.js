/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../../core/math/vec3.js';
import { math } from '../../core/math/math.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_L8 } from '../../platform/graphics/constants.js';
import { MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL } from '../constants.js';
import { LightsBuffer } from './lights-buffer.js';
import { Debug } from '../../core/debug.js';

const tempVec3 = new Vec3();
const tempMin3 = new Vec3();
const tempMax3 = new Vec3();
const tempBox = new BoundingBox();
const epsilon = 0.000001;
const maxTextureSize = 4096; // maximum texture size allowed to work on all devices

// helper class to store properties of a light used by clustering
class ClusterLight {
  constructor() {
    // the light itself
    this.light = null;

    // bounding box
    this.min = new Vec3();
    this.max = new Vec3();
  }
}

// Main class implementing clustered lighting. Internally it organizes the omni / spot lights placement in world space 3d cell structure,
// and also uses LightsBuffer class to store light properties in textures
class WorldClusters {
  /** @type {import('../../platform/graphics/texture.js').Texture} */

  constructor(device) {
    this.clusterTexture = void 0;
    this.device = device;
    this.name = 'Untitled';

    // number of times a warning was reported
    this.reportCount = 0;

    // bounds of all light volumes (volume covered by the clusters)
    this.boundsMin = new Vec3();
    this.boundsMax = new Vec3();
    this.boundsDelta = new Vec3();

    // number of cells along 3 axes
    this._cells = new Vec3(1, 1, 1); // number of cells
    this._cellsLimit = new Vec3(); // number of cells minus one
    this.cells = this._cells;

    // number of lights each cell can store
    this.maxCellLightCount = 4;

    // limits on some light properties, used for compression to 8bit texture
    this._maxAttenuation = 0;
    this._maxColorValue = 0;

    // internal list of lights (of type ClusterLight)
    this._usedLights = [];

    // light 0 is always reserved for 'no light' index
    this._usedLights.push(new ClusterLight());

    // allocate textures to store lights
    this.lightsBuffer = new LightsBuffer(device);

    // register shader uniforms
    this.registerUniforms(device);
  }
  set maxCellLightCount(count) {
    if (count !== this._maxCellLightCount) {
      this._maxCellLightCount = count;
      this._cellsDirty = true;
    }
  }
  get maxCellLightCount() {
    return this._maxCellLightCount;
  }
  set cells(value) {
    // make sure we have whole numbers
    tempVec3.copy(value).floor();
    if (!this._cells.equals(tempVec3)) {
      this._cells.copy(tempVec3);
      this._cellsLimit.copy(tempVec3).sub(Vec3.ONE);
      this._cellsDirty = true;
    }
  }
  get cells() {
    return this._cells;
  }
  destroy() {
    this.lightsBuffer.destroy();
    this.releaseClusterTexture();
  }
  releaseClusterTexture() {
    if (this.clusterTexture) {
      this.clusterTexture.destroy();
      this.clusterTexture = null;
    }
  }
  registerUniforms(device) {
    this._clusterMaxCellsId = device.scope.resolve('clusterMaxCells');
    this._clusterWorldTextureId = device.scope.resolve('clusterWorldTexture');
    this._clusterTextureSizeId = device.scope.resolve('clusterTextureSize');
    this._clusterTextureSizeData = new Float32Array(3);
    this._clusterBoundsMinId = device.scope.resolve('clusterBoundsMin');
    this._clusterBoundsMinData = new Float32Array(3);
    this._clusterBoundsDeltaId = device.scope.resolve('clusterBoundsDelta');
    this._clusterBoundsDeltaData = new Float32Array(3);
    this._clusterCellsCountByBoundsSizeId = device.scope.resolve('clusterCellsCountByBoundsSize');
    this._clusterCellsCountByBoundsSizeData = new Float32Array(3);
    this._clusterCellsDotId = device.scope.resolve('clusterCellsDot');
    this._clusterCellsDotData = new Float32Array(3);

    // number of cells in each direction (vec3)
    this._clusterCellsMaxId = device.scope.resolve('clusterCellsMax');
    this._clusterCellsMaxData = new Float32Array(3);

    // compression limit 0
    this._clusterCompressionLimit0Id = device.scope.resolve('clusterCompressionLimit0');
    this._clusterCompressionLimit0Data = new Float32Array(2);
  }

  // updates itself based on parameters stored in the scene
  updateParams(lightingParams) {
    if (lightingParams) {
      this.cells = lightingParams.cells;
      this.maxCellLightCount = lightingParams.maxLightsPerCell;
      this.lightsBuffer.cookiesEnabled = lightingParams.cookiesEnabled;
      this.lightsBuffer.shadowsEnabled = lightingParams.shadowsEnabled;
      this.lightsBuffer.areaLightsEnabled = lightingParams.areaLightsEnabled;
    }
  }
  updateCells() {
    if (this._cellsDirty) {
      this._cellsDirty = false;
      const cx = this._cells.x;
      const cy = this._cells.y;
      const cz = this._cells.z;

      // storing 1 light per pixel
      const numCells = cx * cy * cz;
      const totalPixels = this.maxCellLightCount * numCells;

      // cluster texture size - roughly square that fits all cells. The width is multiply of numPixels to simplify shader math
      let width = Math.ceil(Math.sqrt(totalPixels));
      width = math.roundUp(width, this.maxCellLightCount);
      const height = Math.ceil(totalPixels / width);

      // if the texture is allowed size
      Debug.assert(width <= maxTextureSize && height <= maxTextureSize, 'Clustered lights parameters cause the texture size to be over the limit, please adjust them.');

      // maximum range of cells
      this._clusterCellsMaxData[0] = cx;
      this._clusterCellsMaxData[1] = cy;
      this._clusterCellsMaxData[2] = cz;

      // vector to allow single dot product to convert from world coordinates to cluster index
      this._clusterCellsDotData[0] = this.maxCellLightCount;
      this._clusterCellsDotData[1] = cx * cz * this.maxCellLightCount;
      this._clusterCellsDotData[2] = cx * this.maxCellLightCount;

      // cluster data and number of lights per cell
      this.clusters = new Uint8ClampedArray(totalPixels);
      this.counts = new Int32Array(numCells);
      this._clusterTextureSizeData[0] = width;
      this._clusterTextureSizeData[1] = 1.0 / width;
      this._clusterTextureSizeData[2] = 1.0 / height;
      this.releaseClusterTexture();
      this.clusterTexture = LightsBuffer.createTexture(this.device, width, height, PIXELFORMAT_L8, 'ClusterTexture');
    }
  }
  uploadTextures() {
    this.clusterTexture.lock().set(this.clusters);
    this.clusterTexture.unlock();
    this.lightsBuffer.uploadTextures();
  }
  updateUniforms() {
    this.lightsBuffer.updateUniforms();

    // texture
    this._clusterWorldTextureId.setValue(this.clusterTexture);

    // uniform values
    this._clusterMaxCellsId.setValue(this.maxCellLightCount);
    const boundsDelta = this.boundsDelta;
    this._clusterCellsCountByBoundsSizeData[0] = this._cells.x / boundsDelta.x;
    this._clusterCellsCountByBoundsSizeData[1] = this._cells.y / boundsDelta.y;
    this._clusterCellsCountByBoundsSizeData[2] = this._cells.z / boundsDelta.z;
    this._clusterCellsCountByBoundsSizeId.setValue(this._clusterCellsCountByBoundsSizeData);
    this._clusterBoundsMinData[0] = this.boundsMin.x;
    this._clusterBoundsMinData[1] = this.boundsMin.y;
    this._clusterBoundsMinData[2] = this.boundsMin.z;
    this._clusterBoundsDeltaData[0] = boundsDelta.x;
    this._clusterBoundsDeltaData[1] = boundsDelta.y;
    this._clusterBoundsDeltaData[2] = boundsDelta.z;
    this._clusterCompressionLimit0Data[0] = this._maxAttenuation;
    this._clusterCompressionLimit0Data[1] = this._maxColorValue;

    // assign values
    this._clusterTextureSizeId.setValue(this._clusterTextureSizeData);
    this._clusterBoundsMinId.setValue(this._clusterBoundsMinData);
    this._clusterBoundsDeltaId.setValue(this._clusterBoundsDeltaData);
    this._clusterCellsDotId.setValue(this._clusterCellsDotData);
    this._clusterCellsMaxId.setValue(this._clusterCellsMaxData);
    this._clusterCompressionLimit0Id.setValue(this._clusterCompressionLimit0Data);
  }

  // evaluates min and max coordinates of AABB of the light in the cell space
  evalLightCellMinMax(clusteredLight, min, max) {
    // min point of AABB in cell space
    min.copy(clusteredLight.min);
    min.sub(this.boundsMin);
    min.div(this.boundsDelta);
    min.mul2(min, this.cells);
    min.floor();

    // max point of AABB in cell space
    max.copy(clusteredLight.max);
    max.sub(this.boundsMin);
    max.div(this.boundsDelta);
    max.mul2(max, this.cells);
    max.ceil();

    // clamp to limits
    min.max(Vec3.ZERO);
    max.min(this._cellsLimit);
  }
  collectLights(lights) {
    const maxLights = this.lightsBuffer.maxLights;

    // skip index 0 as that is used for unused light
    const usedLights = this._usedLights;
    let lightIndex = 1;
    lights.forEach(light => {
      const runtimeLight = !!(light.mask & (MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED));
      const zeroAngleSpotlight = light.type === LIGHTTYPE_SPOT && light._outerConeAngle === 0;
      if (light.enabled && light.type !== LIGHTTYPE_DIRECTIONAL && light.visibleThisFrame && light.intensity > 0 && runtimeLight && !zeroAngleSpotlight) {
        // within light limit
        if (lightIndex < maxLights) {
          // reuse allocated spot
          let clusteredLight;
          if (lightIndex < usedLights.length) {
            clusteredLight = usedLights[lightIndex];
          } else {
            // allocate new spot
            clusteredLight = new ClusterLight();
            usedLights.push(clusteredLight);
          }

          // store light properties
          clusteredLight.light = light;
          light.getBoundingBox(tempBox);
          clusteredLight.min.copy(tempBox.getMin());
          clusteredLight.max.copy(tempBox.getMax());
          lightIndex++;
        } else {
          Debug.warnOnce(`Clustered lighting: more than ${maxLights - 1} lights in the frame, ignoring some.`);
        }
      }
    });
    usedLights.length = lightIndex;
  }

  // evaluate the area all lights cover
  evaluateBounds() {
    const usedLights = this._usedLights;

    // bounds of the area the lights cover
    const min = this.boundsMin;
    const max = this.boundsMax;

    // if at least one light (index 0 is null, so ignore that one)
    if (usedLights.length > 1) {
      // AABB of the first light
      min.copy(usedLights[1].min);
      max.copy(usedLights[1].max);
      for (let i = 2; i < usedLights.length; i++) {
        // expand by AABB of this light
        min.min(usedLights[i].min);
        max.max(usedLights[i].max);
      }
    } else {
      // any small volume if no lights
      min.set(0, 0, 0);
      max.set(1, 1, 1);
    }

    // bounds range
    this.boundsDelta.sub2(max, min);
    this.lightsBuffer.setBounds(min, this.boundsDelta);
  }

  // evaluate ranges of variables compressed to 8bit texture to allow their scaling to 0..1 range
  evaluateCompressionLimits(gammaCorrection) {
    let maxAttenuation = 0;
    let maxColorValue = 0;
    const usedLights = this._usedLights;
    for (let i = 1; i < usedLights.length; i++) {
      const light = usedLights[i].light;
      maxAttenuation = Math.max(light.attenuationEnd, maxAttenuation);
      const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
      maxColorValue = Math.max(color[0], maxColorValue);
      maxColorValue = Math.max(color[1], maxColorValue);
      maxColorValue = Math.max(color[2], maxColorValue);
    }

    // increase slightly as compression needs value < 1
    this._maxAttenuation = maxAttenuation + epsilon;
    this._maxColorValue = maxColorValue + epsilon;
    this.lightsBuffer.setCompressionRanges(this._maxAttenuation, this._maxColorValue);
  }
  updateClusters(gammaCorrection) {
    // clear clusters
    this.counts.fill(0);
    this.clusters.fill(0);

    // local accessors
    const divX = this._cells.x;
    const divZ = this._cells.z;
    const counts = this.counts;
    const limit = this._maxCellLightCount;
    const clusters = this.clusters;
    const pixelsPerCellCount = this.maxCellLightCount;
    let tooManyLights = false;

    // started from index 1, zero is "no-light" index
    const usedLights = this._usedLights;
    for (let i = 1; i < usedLights.length; i++) {
      const clusteredLight = usedLights[i];
      const light = clusteredLight.light;

      // add light data into textures
      this.lightsBuffer.addLightData(light, i, gammaCorrection);

      // light's bounds in cell space
      this.evalLightCellMinMax(clusteredLight, tempMin3, tempMax3);
      const xStart = tempMin3.x;
      const xEnd = tempMax3.x;
      const yStart = tempMin3.y;
      const yEnd = tempMax3.y;
      const zStart = tempMin3.z;
      const zEnd = tempMax3.z;

      // add the light to the cells
      for (let x = xStart; x <= xEnd; x++) {
        for (let z = zStart; z <= zEnd; z++) {
          for (let y = yStart; y <= yEnd; y++) {
            const clusterIndex = x + divX * (z + y * divZ);
            const count = counts[clusterIndex];
            if (count < limit) {
              clusters[pixelsPerCellCount * clusterIndex + count] = i;
              counts[clusterIndex] = count + 1;
            } else {
              tooManyLights = true;
            }
          }
        }
      }
    }
    if (tooManyLights) {
      const reportLimit = 5;
      if (this.reportCount < reportLimit) {
        console.warn('Too many lights in light cluster ' + this.name + ', please adjust parameters.' + (this.reportCount === reportLimit - 1 ? ' Giving up on reporting it.' : ''));
        this.reportCount++;
      }
    }
  }

  // internal update of the cluster data, executes once per frame
  update(lights, gammaCorrection, lightingParams) {
    this.updateParams(lightingParams);
    this.updateCells();
    this.collectLights(lights);
    this.evaluateBounds();
    this.evaluateCompressionLimits(gammaCorrection);
    this.updateClusters(gammaCorrection);
    this.uploadTextures();
  }

  // called on already updated clusters, activates for rendering by setting up uniforms / textures on the device
  activate() {
    this.updateUniforms();
  }
}

export { WorldClusters };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ybGQtY2x1c3RlcnMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9saWdodGluZy93b3JsZC1jbHVzdGVycy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgUElYRUxGT1JNQVRfTDggfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfU1BPVCwgTUFTS19BRkZFQ1RfRFlOQU1JQywgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTGlnaHRzQnVmZmVyIH0gZnJvbSAnLi9saWdodHMtYnVmZmVyLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmNvbnN0IHRlbXBWZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRlbXBNaW4zID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRlbXBNYXgzID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRlbXBCb3ggPSBuZXcgQm91bmRpbmdCb3goKTtcblxuY29uc3QgZXBzaWxvbiA9IDAuMDAwMDAxO1xuY29uc3QgbWF4VGV4dHVyZVNpemUgPSA0MDk2OyAgICAvLyBtYXhpbXVtIHRleHR1cmUgc2l6ZSBhbGxvd2VkIHRvIHdvcmsgb24gYWxsIGRldmljZXNcblxuLy8gaGVscGVyIGNsYXNzIHRvIHN0b3JlIHByb3BlcnRpZXMgb2YgYSBsaWdodCB1c2VkIGJ5IGNsdXN0ZXJpbmdcbmNsYXNzIENsdXN0ZXJMaWdodCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8vIHRoZSBsaWdodCBpdHNlbGZcbiAgICAgICAgdGhpcy5saWdodCA9IG51bGw7XG5cbiAgICAgICAgLy8gYm91bmRpbmcgYm94XG4gICAgICAgIHRoaXMubWluID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5tYXggPSBuZXcgVmVjMygpO1xuICAgIH1cbn1cblxuLy8gTWFpbiBjbGFzcyBpbXBsZW1lbnRpbmcgY2x1c3RlcmVkIGxpZ2h0aW5nLiBJbnRlcm5hbGx5IGl0IG9yZ2FuaXplcyB0aGUgb21uaSAvIHNwb3QgbGlnaHRzIHBsYWNlbWVudCBpbiB3b3JsZCBzcGFjZSAzZCBjZWxsIHN0cnVjdHVyZSxcbi8vIGFuZCBhbHNvIHVzZXMgTGlnaHRzQnVmZmVyIGNsYXNzIHRvIHN0b3JlIGxpZ2h0IHByb3BlcnRpZXMgaW4gdGV4dHVyZXNcbmNsYXNzIFdvcmxkQ2x1c3RlcnMge1xuICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gKi9cbiAgICBjbHVzdGVyVGV4dHVyZTtcblxuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5uYW1lID0gJ1VudGl0bGVkJztcblxuICAgICAgICAvLyBudW1iZXIgb2YgdGltZXMgYSB3YXJuaW5nIHdhcyByZXBvcnRlZFxuICAgICAgICB0aGlzLnJlcG9ydENvdW50ID0gMDtcblxuICAgICAgICAvLyBib3VuZHMgb2YgYWxsIGxpZ2h0IHZvbHVtZXMgKHZvbHVtZSBjb3ZlcmVkIGJ5IHRoZSBjbHVzdGVycylcbiAgICAgICAgdGhpcy5ib3VuZHNNaW4gPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLmJvdW5kc01heCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMuYm91bmRzRGVsdGEgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8vIG51bWJlciBvZiBjZWxscyBhbG9uZyAzIGF4ZXNcbiAgICAgICAgdGhpcy5fY2VsbHMgPSBuZXcgVmVjMygxLCAxLCAxKTsgICAgICAgLy8gbnVtYmVyIG9mIGNlbGxzXG4gICAgICAgIHRoaXMuX2NlbGxzTGltaXQgPSBuZXcgVmVjMygpOyAgLy8gbnVtYmVyIG9mIGNlbGxzIG1pbnVzIG9uZVxuICAgICAgICB0aGlzLmNlbGxzID0gdGhpcy5fY2VsbHM7XG5cbiAgICAgICAgLy8gbnVtYmVyIG9mIGxpZ2h0cyBlYWNoIGNlbGwgY2FuIHN0b3JlXG4gICAgICAgIHRoaXMubWF4Q2VsbExpZ2h0Q291bnQgPSA0O1xuXG4gICAgICAgIC8vIGxpbWl0cyBvbiBzb21lIGxpZ2h0IHByb3BlcnRpZXMsIHVzZWQgZm9yIGNvbXByZXNzaW9uIHRvIDhiaXQgdGV4dHVyZVxuICAgICAgICB0aGlzLl9tYXhBdHRlbnVhdGlvbiA9IDA7XG4gICAgICAgIHRoaXMuX21heENvbG9yVmFsdWUgPSAwO1xuXG4gICAgICAgIC8vIGludGVybmFsIGxpc3Qgb2YgbGlnaHRzIChvZiB0eXBlIENsdXN0ZXJMaWdodClcbiAgICAgICAgdGhpcy5fdXNlZExpZ2h0cyA9IFtdO1xuXG4gICAgICAgIC8vIGxpZ2h0IDAgaXMgYWx3YXlzIHJlc2VydmVkIGZvciAnbm8gbGlnaHQnIGluZGV4XG4gICAgICAgIHRoaXMuX3VzZWRMaWdodHMucHVzaChuZXcgQ2x1c3RlckxpZ2h0KCkpO1xuXG4gICAgICAgIC8vIGFsbG9jYXRlIHRleHR1cmVzIHRvIHN0b3JlIGxpZ2h0c1xuICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlciA9IG5ldyBMaWdodHNCdWZmZXIoZGV2aWNlKTtcblxuICAgICAgICAvLyByZWdpc3RlciBzaGFkZXIgdW5pZm9ybXNcbiAgICAgICAgdGhpcy5yZWdpc3RlclVuaWZvcm1zKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0IG1heENlbGxMaWdodENvdW50KGNvdW50KSB7XG5cbiAgICAgICAgaWYgKGNvdW50ICE9PSB0aGlzLl9tYXhDZWxsTGlnaHRDb3VudCkge1xuICAgICAgICAgICAgdGhpcy5fbWF4Q2VsbExpZ2h0Q291bnQgPSBjb3VudDtcbiAgICAgICAgICAgIHRoaXMuX2NlbGxzRGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1heENlbGxMaWdodENvdW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF4Q2VsbExpZ2h0Q291bnQ7XG4gICAgfVxuXG4gICAgc2V0IGNlbGxzKHZhbHVlKSB7XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIHdlIGhhdmUgd2hvbGUgbnVtYmVyc1xuICAgICAgICB0ZW1wVmVjMy5jb3B5KHZhbHVlKS5mbG9vcigpO1xuXG4gICAgICAgIGlmICghdGhpcy5fY2VsbHMuZXF1YWxzKHRlbXBWZWMzKSkge1xuICAgICAgICAgICAgdGhpcy5fY2VsbHMuY29weSh0ZW1wVmVjMyk7XG4gICAgICAgICAgICB0aGlzLl9jZWxsc0xpbWl0LmNvcHkodGVtcFZlYzMpLnN1YihWZWMzLk9ORSk7XG4gICAgICAgICAgICB0aGlzLl9jZWxsc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjZWxscygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NlbGxzO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgdGhpcy5saWdodHNCdWZmZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMucmVsZWFzZUNsdXN0ZXJUZXh0dXJlKCk7XG4gICAgfVxuXG4gICAgcmVsZWFzZUNsdXN0ZXJUZXh0dXJlKCkge1xuICAgICAgICBpZiAodGhpcy5jbHVzdGVyVGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5jbHVzdGVyVGV4dHVyZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmNsdXN0ZXJUZXh0dXJlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlZ2lzdGVyVW5pZm9ybXMoZGV2aWNlKSB7XG5cbiAgICAgICAgdGhpcy5fY2x1c3Rlck1heENlbGxzSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY2x1c3Rlck1heENlbGxzJyk7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlcldvcmxkVGV4dHVyZUlkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJXb3JsZFRleHR1cmUnKTtcblxuICAgICAgICB0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyVGV4dHVyZVNpemUnKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlclRleHR1cmVTaXplRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc01pbklkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJCb3VuZHNNaW4nKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc01pbkRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNEZWx0YUlkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJCb3VuZHNEZWx0YScpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzRGVsdGFEYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcblxuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZUlkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplJyk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzRG90SWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY2x1c3RlckNlbGxzRG90Jyk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0RvdERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgICAgIC8vIG51bWJlciBvZiBjZWxscyBpbiBlYWNoIGRpcmVjdGlvbiAodmVjMylcbiAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzTWF4SWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY2x1c3RlckNlbGxzTWF4Jyk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc01heERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgICAgIC8vIGNvbXByZXNzaW9uIGxpbWl0IDBcbiAgICAgICAgdGhpcy5fY2x1c3RlckNvbXByZXNzaW9uTGltaXQwSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY2x1c3RlckNvbXByZXNzaW9uTGltaXQwJyk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgIH1cblxuICAgIC8vIHVwZGF0ZXMgaXRzZWxmIGJhc2VkIG9uIHBhcmFtZXRlcnMgc3RvcmVkIGluIHRoZSBzY2VuZVxuICAgIHVwZGF0ZVBhcmFtcyhsaWdodGluZ1BhcmFtcykge1xuICAgICAgICBpZiAobGlnaHRpbmdQYXJhbXMpIHtcbiAgICAgICAgICAgIHRoaXMuY2VsbHMgPSBsaWdodGluZ1BhcmFtcy5jZWxscztcbiAgICAgICAgICAgIHRoaXMubWF4Q2VsbExpZ2h0Q291bnQgPSBsaWdodGluZ1BhcmFtcy5tYXhMaWdodHNQZXJDZWxsO1xuXG4gICAgICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlci5jb29raWVzRW5hYmxlZCA9IGxpZ2h0aW5nUGFyYW1zLmNvb2tpZXNFbmFibGVkO1xuICAgICAgICAgICAgdGhpcy5saWdodHNCdWZmZXIuc2hhZG93c0VuYWJsZWQgPSBsaWdodGluZ1BhcmFtcy5zaGFkb3dzRW5hYmxlZDtcblxuICAgICAgICAgICAgdGhpcy5saWdodHNCdWZmZXIuYXJlYUxpZ2h0c0VuYWJsZWQgPSBsaWdodGluZ1BhcmFtcy5hcmVhTGlnaHRzRW5hYmxlZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUNlbGxzKCkge1xuICAgICAgICBpZiAodGhpcy5fY2VsbHNEaXJ0eSkge1xuICAgICAgICAgICAgdGhpcy5fY2VsbHNEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBjeCA9IHRoaXMuX2NlbGxzLng7XG4gICAgICAgICAgICBjb25zdCBjeSA9IHRoaXMuX2NlbGxzLnk7XG4gICAgICAgICAgICBjb25zdCBjeiA9IHRoaXMuX2NlbGxzLno7XG5cbiAgICAgICAgICAgIC8vIHN0b3JpbmcgMSBsaWdodCBwZXIgcGl4ZWxcbiAgICAgICAgICAgIGNvbnN0IG51bUNlbGxzID0gY3ggKiBjeSAqIGN6O1xuICAgICAgICAgICAgY29uc3QgdG90YWxQaXhlbHMgPSB0aGlzLm1heENlbGxMaWdodENvdW50ICogbnVtQ2VsbHM7XG5cbiAgICAgICAgICAgIC8vIGNsdXN0ZXIgdGV4dHVyZSBzaXplIC0gcm91Z2hseSBzcXVhcmUgdGhhdCBmaXRzIGFsbCBjZWxscy4gVGhlIHdpZHRoIGlzIG11bHRpcGx5IG9mIG51bVBpeGVscyB0byBzaW1wbGlmeSBzaGFkZXIgbWF0aFxuICAgICAgICAgICAgbGV0IHdpZHRoID0gTWF0aC5jZWlsKE1hdGguc3FydCh0b3RhbFBpeGVscykpO1xuICAgICAgICAgICAgd2lkdGggPSBtYXRoLnJvdW5kVXAod2lkdGgsIHRoaXMubWF4Q2VsbExpZ2h0Q291bnQpO1xuICAgICAgICAgICAgY29uc3QgaGVpZ2h0ID0gTWF0aC5jZWlsKHRvdGFsUGl4ZWxzIC8gd2lkdGgpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgdGV4dHVyZSBpcyBhbGxvd2VkIHNpemVcbiAgICAgICAgICAgIERlYnVnLmFzc2VydCh3aWR0aCA8PSBtYXhUZXh0dXJlU2l6ZSAmJiBoZWlnaHQgPD0gbWF4VGV4dHVyZVNpemUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ0NsdXN0ZXJlZCBsaWdodHMgcGFyYW1ldGVycyBjYXVzZSB0aGUgdGV4dHVyZSBzaXplIHRvIGJlIG92ZXIgdGhlIGxpbWl0LCBwbGVhc2UgYWRqdXN0IHRoZW0uJyk7XG5cbiAgICAgICAgICAgIC8vIG1heGltdW0gcmFuZ2Ugb2YgY2VsbHNcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc01heERhdGFbMF0gPSBjeDtcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc01heERhdGFbMV0gPSBjeTtcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc01heERhdGFbMl0gPSBjejtcblxuICAgICAgICAgICAgLy8gdmVjdG9yIHRvIGFsbG93IHNpbmdsZSBkb3QgcHJvZHVjdCB0byBjb252ZXJ0IGZyb20gd29ybGQgY29vcmRpbmF0ZXMgdG8gY2x1c3RlciBpbmRleFxuICAgICAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzRG90RGF0YVswXSA9IHRoaXMubWF4Q2VsbExpZ2h0Q291bnQ7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNEb3REYXRhWzFdID0gY3ggKiBjeiAqIHRoaXMubWF4Q2VsbExpZ2h0Q291bnQ7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNEb3REYXRhWzJdID0gY3ggKiB0aGlzLm1heENlbGxMaWdodENvdW50O1xuXG4gICAgICAgICAgICAvLyBjbHVzdGVyIGRhdGEgYW5kIG51bWJlciBvZiBsaWdodHMgcGVyIGNlbGxcbiAgICAgICAgICAgIHRoaXMuY2x1c3RlcnMgPSBuZXcgVWludDhDbGFtcGVkQXJyYXkodG90YWxQaXhlbHMpO1xuICAgICAgICAgICAgdGhpcy5jb3VudHMgPSBuZXcgSW50MzJBcnJheShudW1DZWxscyk7XG5cbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJUZXh0dXJlU2l6ZURhdGFbMF0gPSB3aWR0aDtcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJUZXh0dXJlU2l6ZURhdGFbMV0gPSAxLjAgLyB3aWR0aDtcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJUZXh0dXJlU2l6ZURhdGFbMl0gPSAxLjAgLyBoZWlnaHQ7XG5cbiAgICAgICAgICAgIHRoaXMucmVsZWFzZUNsdXN0ZXJUZXh0dXJlKCk7XG4gICAgICAgICAgICB0aGlzLmNsdXN0ZXJUZXh0dXJlID0gTGlnaHRzQnVmZmVyLmNyZWF0ZVRleHR1cmUodGhpcy5kZXZpY2UsIHdpZHRoLCBoZWlnaHQsIFBJWEVMRk9STUFUX0w4LCAnQ2x1c3RlclRleHR1cmUnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwbG9hZFRleHR1cmVzKCkge1xuXG4gICAgICAgIHRoaXMuY2x1c3RlclRleHR1cmUubG9jaygpLnNldCh0aGlzLmNsdXN0ZXJzKTtcbiAgICAgICAgdGhpcy5jbHVzdGVyVGV4dHVyZS51bmxvY2soKTtcblxuICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlci51cGxvYWRUZXh0dXJlcygpO1xuICAgIH1cblxuICAgIHVwZGF0ZVVuaWZvcm1zKCkge1xuXG4gICAgICAgIHRoaXMubGlnaHRzQnVmZmVyLnVwZGF0ZVVuaWZvcm1zKCk7XG5cbiAgICAgICAgLy8gdGV4dHVyZVxuICAgICAgICB0aGlzLl9jbHVzdGVyV29ybGRUZXh0dXJlSWQuc2V0VmFsdWUodGhpcy5jbHVzdGVyVGV4dHVyZSk7XG5cbiAgICAgICAgLy8gdW5pZm9ybSB2YWx1ZXNcbiAgICAgICAgdGhpcy5fY2x1c3Rlck1heENlbGxzSWQuc2V0VmFsdWUodGhpcy5tYXhDZWxsTGlnaHRDb3VudCk7XG5cbiAgICAgICAgY29uc3QgYm91bmRzRGVsdGEgPSB0aGlzLmJvdW5kc0RlbHRhO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZURhdGFbMF0gPSB0aGlzLl9jZWxscy54IC8gYm91bmRzRGVsdGEueDtcbiAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzQ291bnRCeUJvdW5kc1NpemVEYXRhWzFdID0gdGhpcy5fY2VsbHMueSAvIGJvdW5kc0RlbHRhLnk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplRGF0YVsyXSA9IHRoaXMuX2NlbGxzLnogLyBib3VuZHNEZWx0YS56O1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZUlkLnNldFZhbHVlKHRoaXMuX2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplRGF0YSk7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc01pbkRhdGFbMF0gPSB0aGlzLmJvdW5kc01pbi54O1xuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzTWluRGF0YVsxXSA9IHRoaXMuYm91bmRzTWluLnk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNNaW5EYXRhWzJdID0gdGhpcy5ib3VuZHNNaW4uejtcblxuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzRGVsdGFEYXRhWzBdID0gYm91bmRzRGVsdGEueDtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc0RlbHRhRGF0YVsxXSA9IGJvdW5kc0RlbHRhLnk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNEZWx0YURhdGFbMl0gPSBib3VuZHNEZWx0YS56O1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MERhdGFbMF0gPSB0aGlzLl9tYXhBdHRlbnVhdGlvbjtcbiAgICAgICAgdGhpcy5fY2x1c3RlckNvbXByZXNzaW9uTGltaXQwRGF0YVsxXSA9IHRoaXMuX21heENvbG9yVmFsdWU7XG5cbiAgICAgICAgLy8gYXNzaWduIHZhbHVlc1xuICAgICAgICB0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVJZC5zZXRWYWx1ZSh0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVEYXRhKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc01pbklkLnNldFZhbHVlKHRoaXMuX2NsdXN0ZXJCb3VuZHNNaW5EYXRhKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc0RlbHRhSWQuc2V0VmFsdWUodGhpcy5fY2x1c3RlckJvdW5kc0RlbHRhRGF0YSk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0RvdElkLnNldFZhbHVlKHRoaXMuX2NsdXN0ZXJDZWxsc0RvdERhdGEpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhJZC5zZXRWYWx1ZSh0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckNvbXByZXNzaW9uTGltaXQwSWQuc2V0VmFsdWUodGhpcy5fY2x1c3RlckNvbXByZXNzaW9uTGltaXQwRGF0YSk7XG4gICAgfVxuXG4gICAgLy8gZXZhbHVhdGVzIG1pbiBhbmQgbWF4IGNvb3JkaW5hdGVzIG9mIEFBQkIgb2YgdGhlIGxpZ2h0IGluIHRoZSBjZWxsIHNwYWNlXG4gICAgZXZhbExpZ2h0Q2VsbE1pbk1heChjbHVzdGVyZWRMaWdodCwgbWluLCBtYXgpIHtcblxuICAgICAgICAvLyBtaW4gcG9pbnQgb2YgQUFCQiBpbiBjZWxsIHNwYWNlXG4gICAgICAgIG1pbi5jb3B5KGNsdXN0ZXJlZExpZ2h0Lm1pbik7XG4gICAgICAgIG1pbi5zdWIodGhpcy5ib3VuZHNNaW4pO1xuICAgICAgICBtaW4uZGl2KHRoaXMuYm91bmRzRGVsdGEpO1xuICAgICAgICBtaW4ubXVsMihtaW4sIHRoaXMuY2VsbHMpO1xuICAgICAgICBtaW4uZmxvb3IoKTtcblxuICAgICAgICAvLyBtYXggcG9pbnQgb2YgQUFCQiBpbiBjZWxsIHNwYWNlXG4gICAgICAgIG1heC5jb3B5KGNsdXN0ZXJlZExpZ2h0Lm1heCk7XG4gICAgICAgIG1heC5zdWIodGhpcy5ib3VuZHNNaW4pO1xuICAgICAgICBtYXguZGl2KHRoaXMuYm91bmRzRGVsdGEpO1xuICAgICAgICBtYXgubXVsMihtYXgsIHRoaXMuY2VsbHMpO1xuICAgICAgICBtYXguY2VpbCgpO1xuXG4gICAgICAgIC8vIGNsYW1wIHRvIGxpbWl0c1xuICAgICAgICBtaW4ubWF4KFZlYzMuWkVSTyk7XG4gICAgICAgIG1heC5taW4odGhpcy5fY2VsbHNMaW1pdCk7XG4gICAgfVxuXG4gICAgY29sbGVjdExpZ2h0cyhsaWdodHMpIHtcblxuICAgICAgICBjb25zdCBtYXhMaWdodHMgPSB0aGlzLmxpZ2h0c0J1ZmZlci5tYXhMaWdodHM7XG5cbiAgICAgICAgLy8gc2tpcCBpbmRleCAwIGFzIHRoYXQgaXMgdXNlZCBmb3IgdW51c2VkIGxpZ2h0XG4gICAgICAgIGNvbnN0IHVzZWRMaWdodHMgPSB0aGlzLl91c2VkTGlnaHRzO1xuICAgICAgICBsZXQgbGlnaHRJbmRleCA9IDE7XG5cbiAgICAgICAgbGlnaHRzLmZvckVhY2goKGxpZ2h0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBydW50aW1lTGlnaHQgPSAhIShsaWdodC5tYXNrICYgKE1BU0tfQUZGRUNUX0RZTkFNSUMgfCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCkpO1xuICAgICAgICAgICAgY29uc3QgemVyb0FuZ2xlU3BvdGxpZ2h0ID0gbGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX1NQT1QgJiYgbGlnaHQuX291dGVyQ29uZUFuZ2xlID09PSAwO1xuICAgICAgICAgICAgaWYgKGxpZ2h0LmVuYWJsZWQgJiYgbGlnaHQudHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMICYmIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgJiYgbGlnaHQuaW50ZW5zaXR5ID4gMCAmJiBydW50aW1lTGlnaHQgJiYgIXplcm9BbmdsZVNwb3RsaWdodCkge1xuXG4gICAgICAgICAgICAgICAgLy8gd2l0aGluIGxpZ2h0IGxpbWl0XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0SW5kZXggPCBtYXhMaWdodHMpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZXVzZSBhbGxvY2F0ZWQgc3BvdFxuICAgICAgICAgICAgICAgICAgICBsZXQgY2x1c3RlcmVkTGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodEluZGV4IDwgdXNlZExpZ2h0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJlZExpZ2h0ID0gdXNlZExpZ2h0c1tsaWdodEluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbG9jYXRlIG5ldyBzcG90XG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyZWRMaWdodCA9IG5ldyBDbHVzdGVyTGlnaHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZWRMaWdodHMucHVzaChjbHVzdGVyZWRMaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBzdG9yZSBsaWdodCBwcm9wZXJ0aWVzXG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJlZExpZ2h0LmxpZ2h0ID0gbGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0LmdldEJvdW5kaW5nQm94KHRlbXBCb3gpO1xuICAgICAgICAgICAgICAgICAgICBjbHVzdGVyZWRMaWdodC5taW4uY29weSh0ZW1wQm94LmdldE1pbigpKTtcbiAgICAgICAgICAgICAgICAgICAgY2x1c3RlcmVkTGlnaHQubWF4LmNvcHkodGVtcEJveC5nZXRNYXgoKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgbGlnaHRJbmRleCsrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKGBDbHVzdGVyZWQgbGlnaHRpbmc6IG1vcmUgdGhhbiAke21heExpZ2h0cyAtIDF9IGxpZ2h0cyBpbiB0aGUgZnJhbWUsIGlnbm9yaW5nIHNvbWUuYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB1c2VkTGlnaHRzLmxlbmd0aCA9IGxpZ2h0SW5kZXg7XG4gICAgfVxuXG4gICAgLy8gZXZhbHVhdGUgdGhlIGFyZWEgYWxsIGxpZ2h0cyBjb3ZlclxuICAgIGV2YWx1YXRlQm91bmRzKCkge1xuXG4gICAgICAgIGNvbnN0IHVzZWRMaWdodHMgPSB0aGlzLl91c2VkTGlnaHRzO1xuXG4gICAgICAgIC8vIGJvdW5kcyBvZiB0aGUgYXJlYSB0aGUgbGlnaHRzIGNvdmVyXG4gICAgICAgIGNvbnN0IG1pbiA9IHRoaXMuYm91bmRzTWluO1xuICAgICAgICBjb25zdCBtYXggPSB0aGlzLmJvdW5kc01heDtcblxuICAgICAgICAvLyBpZiBhdCBsZWFzdCBvbmUgbGlnaHQgKGluZGV4IDAgaXMgbnVsbCwgc28gaWdub3JlIHRoYXQgb25lKVxuICAgICAgICBpZiAodXNlZExpZ2h0cy5sZW5ndGggPiAxKSB7XG5cbiAgICAgICAgICAgIC8vIEFBQkIgb2YgdGhlIGZpcnN0IGxpZ2h0XG4gICAgICAgICAgICBtaW4uY29weSh1c2VkTGlnaHRzWzFdLm1pbik7XG4gICAgICAgICAgICBtYXguY29weSh1c2VkTGlnaHRzWzFdLm1heCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAyOyBpIDwgdXNlZExpZ2h0cy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gZXhwYW5kIGJ5IEFBQkIgb2YgdGhpcyBsaWdodFxuICAgICAgICAgICAgICAgIG1pbi5taW4odXNlZExpZ2h0c1tpXS5taW4pO1xuICAgICAgICAgICAgICAgIG1heC5tYXgodXNlZExpZ2h0c1tpXS5tYXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBhbnkgc21hbGwgdm9sdW1lIGlmIG5vIGxpZ2h0c1xuICAgICAgICAgICAgbWluLnNldCgwLCAwLCAwKTtcbiAgICAgICAgICAgIG1heC5zZXQoMSwgMSwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBib3VuZHMgcmFuZ2VcbiAgICAgICAgdGhpcy5ib3VuZHNEZWx0YS5zdWIyKG1heCwgbWluKTtcblxuICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlci5zZXRCb3VuZHMobWluLCB0aGlzLmJvdW5kc0RlbHRhKTtcbiAgICB9XG5cbiAgICAvLyBldmFsdWF0ZSByYW5nZXMgb2YgdmFyaWFibGVzIGNvbXByZXNzZWQgdG8gOGJpdCB0ZXh0dXJlIHRvIGFsbG93IHRoZWlyIHNjYWxpbmcgdG8gMC4uMSByYW5nZVxuICAgIGV2YWx1YXRlQ29tcHJlc3Npb25MaW1pdHMoZ2FtbWFDb3JyZWN0aW9uKSB7XG5cbiAgICAgICAgbGV0IG1heEF0dGVudWF0aW9uID0gMDtcbiAgICAgICAgbGV0IG1heENvbG9yVmFsdWUgPSAwO1xuXG4gICAgICAgIGNvbnN0IHVzZWRMaWdodHMgPSB0aGlzLl91c2VkTGlnaHRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHVzZWRMaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gdXNlZExpZ2h0c1tpXS5saWdodDtcbiAgICAgICAgICAgIG1heEF0dGVudWF0aW9uID0gTWF0aC5tYXgobGlnaHQuYXR0ZW51YXRpb25FbmQsIG1heEF0dGVudWF0aW9uKTtcblxuICAgICAgICAgICAgY29uc3QgY29sb3IgPSBnYW1tYUNvcnJlY3Rpb24gPyBsaWdodC5fbGluZWFyRmluYWxDb2xvciA6IGxpZ2h0Ll9maW5hbENvbG9yO1xuICAgICAgICAgICAgbWF4Q29sb3JWYWx1ZSA9IE1hdGgubWF4KGNvbG9yWzBdLCBtYXhDb2xvclZhbHVlKTtcbiAgICAgICAgICAgIG1heENvbG9yVmFsdWUgPSBNYXRoLm1heChjb2xvclsxXSwgbWF4Q29sb3JWYWx1ZSk7XG4gICAgICAgICAgICBtYXhDb2xvclZhbHVlID0gTWF0aC5tYXgoY29sb3JbMl0sIG1heENvbG9yVmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5jcmVhc2Ugc2xpZ2h0bHkgYXMgY29tcHJlc3Npb24gbmVlZHMgdmFsdWUgPCAxXG4gICAgICAgIHRoaXMuX21heEF0dGVudWF0aW9uID0gbWF4QXR0ZW51YXRpb24gKyBlcHNpbG9uO1xuICAgICAgICB0aGlzLl9tYXhDb2xvclZhbHVlID0gbWF4Q29sb3JWYWx1ZSArIGVwc2lsb247XG5cbiAgICAgICAgdGhpcy5saWdodHNCdWZmZXIuc2V0Q29tcHJlc3Npb25SYW5nZXModGhpcy5fbWF4QXR0ZW51YXRpb24sIHRoaXMuX21heENvbG9yVmFsdWUpO1xuICAgIH1cblxuICAgIHVwZGF0ZUNsdXN0ZXJzKGdhbW1hQ29ycmVjdGlvbikge1xuXG4gICAgICAgIC8vIGNsZWFyIGNsdXN0ZXJzXG4gICAgICAgIHRoaXMuY291bnRzLmZpbGwoMCk7XG4gICAgICAgIHRoaXMuY2x1c3RlcnMuZmlsbCgwKTtcblxuICAgICAgICAvLyBsb2NhbCBhY2Nlc3NvcnNcbiAgICAgICAgY29uc3QgZGl2WCA9IHRoaXMuX2NlbGxzLng7XG4gICAgICAgIGNvbnN0IGRpdlogPSB0aGlzLl9jZWxscy56O1xuICAgICAgICBjb25zdCBjb3VudHMgPSB0aGlzLmNvdW50cztcbiAgICAgICAgY29uc3QgbGltaXQgPSB0aGlzLl9tYXhDZWxsTGlnaHRDb3VudDtcbiAgICAgICAgY29uc3QgY2x1c3RlcnMgPSB0aGlzLmNsdXN0ZXJzO1xuICAgICAgICBjb25zdCBwaXhlbHNQZXJDZWxsQ291bnQgPSB0aGlzLm1heENlbGxMaWdodENvdW50O1xuICAgICAgICBsZXQgdG9vTWFueUxpZ2h0cyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHN0YXJ0ZWQgZnJvbSBpbmRleCAxLCB6ZXJvIGlzIFwibm8tbGlnaHRcIiBpbmRleFxuICAgICAgICBjb25zdCB1c2VkTGlnaHRzID0gdGhpcy5fdXNlZExpZ2h0cztcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCB1c2VkTGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodCA9IHVzZWRMaWdodHNbaV07XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGNsdXN0ZXJlZExpZ2h0LmxpZ2h0O1xuXG4gICAgICAgICAgICAvLyBhZGQgbGlnaHQgZGF0YSBpbnRvIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlci5hZGRMaWdodERhdGEobGlnaHQsIGksIGdhbW1hQ29ycmVjdGlvbik7XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0J3MgYm91bmRzIGluIGNlbGwgc3BhY2VcbiAgICAgICAgICAgIHRoaXMuZXZhbExpZ2h0Q2VsbE1pbk1heChjbHVzdGVyZWRMaWdodCwgdGVtcE1pbjMsIHRlbXBNYXgzKTtcblxuICAgICAgICAgICAgY29uc3QgeFN0YXJ0ID0gdGVtcE1pbjMueDtcbiAgICAgICAgICAgIGNvbnN0IHhFbmQgPSB0ZW1wTWF4My54O1xuICAgICAgICAgICAgY29uc3QgeVN0YXJ0ID0gdGVtcE1pbjMueTtcbiAgICAgICAgICAgIGNvbnN0IHlFbmQgPSB0ZW1wTWF4My55O1xuICAgICAgICAgICAgY29uc3QgelN0YXJ0ID0gdGVtcE1pbjMuejtcbiAgICAgICAgICAgIGNvbnN0IHpFbmQgPSB0ZW1wTWF4My56O1xuXG4gICAgICAgICAgICAvLyBhZGQgdGhlIGxpZ2h0IHRvIHRoZSBjZWxsc1xuICAgICAgICAgICAgZm9yIChsZXQgeCA9IHhTdGFydDsgeCA8PSB4RW5kOyB4KyspIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCB6ID0gelN0YXJ0OyB6IDw9IHpFbmQ7IHorKykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB5ID0geVN0YXJ0OyB5IDw9IHlFbmQ7IHkrKykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbHVzdGVySW5kZXggPSB4ICsgZGl2WCAqICh6ICsgeSAqIGRpdlopO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY291bnQgPSBjb3VudHNbY2x1c3RlckluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb3VudCA8IGxpbWl0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlcnNbcGl4ZWxzUGVyQ2VsbENvdW50ICogY2x1c3RlckluZGV4ICsgY291bnRdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3VudHNbY2x1c3RlckluZGV4XSA9IGNvdW50ICsgMTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b29NYW55TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRvb01hbnlMaWdodHMpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlcG9ydExpbWl0ID0gNTtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlcG9ydENvdW50IDwgcmVwb3J0TGltaXQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1RvbyBtYW55IGxpZ2h0cyBpbiBsaWdodCBjbHVzdGVyICcgKyB0aGlzLm5hbWUgKyAnLCBwbGVhc2UgYWRqdXN0IHBhcmFtZXRlcnMuJyArXG4gICAgICAgICAgICAgICAgKHRoaXMucmVwb3J0Q291bnQgPT09IHJlcG9ydExpbWl0IC0gMSA/ICcgR2l2aW5nIHVwIG9uIHJlcG9ydGluZyBpdC4nIDogJycpKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcG9ydENvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLy8gaW50ZXJuYWwgdXBkYXRlIG9mIHRoZSBjbHVzdGVyIGRhdGEsIGV4ZWN1dGVzIG9uY2UgcGVyIGZyYW1lXG4gICAgdXBkYXRlKGxpZ2h0cywgZ2FtbWFDb3JyZWN0aW9uLCBsaWdodGluZ1BhcmFtcykge1xuICAgICAgICB0aGlzLnVwZGF0ZVBhcmFtcyhsaWdodGluZ1BhcmFtcyk7XG4gICAgICAgIHRoaXMudXBkYXRlQ2VsbHMoKTtcbiAgICAgICAgdGhpcy5jb2xsZWN0TGlnaHRzKGxpZ2h0cyk7XG4gICAgICAgIHRoaXMuZXZhbHVhdGVCb3VuZHMoKTtcbiAgICAgICAgdGhpcy5ldmFsdWF0ZUNvbXByZXNzaW9uTGltaXRzKGdhbW1hQ29ycmVjdGlvbik7XG4gICAgICAgIHRoaXMudXBkYXRlQ2x1c3RlcnMoZ2FtbWFDb3JyZWN0aW9uKTtcbiAgICAgICAgdGhpcy51cGxvYWRUZXh0dXJlcygpO1xuICAgIH1cblxuICAgIC8vIGNhbGxlZCBvbiBhbHJlYWR5IHVwZGF0ZWQgY2x1c3RlcnMsIGFjdGl2YXRlcyBmb3IgcmVuZGVyaW5nIGJ5IHNldHRpbmcgdXAgdW5pZm9ybXMgLyB0ZXh0dXJlcyBvbiB0aGUgZGV2aWNlXG4gICAgYWN0aXZhdGUoKSB7XG4gICAgICAgIHRoaXMudXBkYXRlVW5pZm9ybXMoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdvcmxkQ2x1c3RlcnMgfTtcbiJdLCJuYW1lcyI6WyJ0ZW1wVmVjMyIsIlZlYzMiLCJ0ZW1wTWluMyIsInRlbXBNYXgzIiwidGVtcEJveCIsIkJvdW5kaW5nQm94IiwiZXBzaWxvbiIsIm1heFRleHR1cmVTaXplIiwiQ2x1c3RlckxpZ2h0IiwiY29uc3RydWN0b3IiLCJsaWdodCIsIm1pbiIsIm1heCIsIldvcmxkQ2x1c3RlcnMiLCJkZXZpY2UiLCJjbHVzdGVyVGV4dHVyZSIsIm5hbWUiLCJyZXBvcnRDb3VudCIsImJvdW5kc01pbiIsImJvdW5kc01heCIsImJvdW5kc0RlbHRhIiwiX2NlbGxzIiwiX2NlbGxzTGltaXQiLCJjZWxscyIsIm1heENlbGxMaWdodENvdW50IiwiX21heEF0dGVudWF0aW9uIiwiX21heENvbG9yVmFsdWUiLCJfdXNlZExpZ2h0cyIsInB1c2giLCJsaWdodHNCdWZmZXIiLCJMaWdodHNCdWZmZXIiLCJyZWdpc3RlclVuaWZvcm1zIiwiY291bnQiLCJfbWF4Q2VsbExpZ2h0Q291bnQiLCJfY2VsbHNEaXJ0eSIsInZhbHVlIiwiY29weSIsImZsb29yIiwiZXF1YWxzIiwic3ViIiwiT05FIiwiZGVzdHJveSIsInJlbGVhc2VDbHVzdGVyVGV4dHVyZSIsIl9jbHVzdGVyTWF4Q2VsbHNJZCIsInNjb3BlIiwicmVzb2x2ZSIsIl9jbHVzdGVyV29ybGRUZXh0dXJlSWQiLCJfY2x1c3RlclRleHR1cmVTaXplSWQiLCJfY2x1c3RlclRleHR1cmVTaXplRGF0YSIsIkZsb2F0MzJBcnJheSIsIl9jbHVzdGVyQm91bmRzTWluSWQiLCJfY2x1c3RlckJvdW5kc01pbkRhdGEiLCJfY2x1c3RlckJvdW5kc0RlbHRhSWQiLCJfY2x1c3RlckJvdW5kc0RlbHRhRGF0YSIsIl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZUlkIiwiX2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplRGF0YSIsIl9jbHVzdGVyQ2VsbHNEb3RJZCIsIl9jbHVzdGVyQ2VsbHNEb3REYXRhIiwiX2NsdXN0ZXJDZWxsc01heElkIiwiX2NsdXN0ZXJDZWxsc01heERhdGEiLCJfY2x1c3RlckNvbXByZXNzaW9uTGltaXQwSWQiLCJfY2x1c3RlckNvbXByZXNzaW9uTGltaXQwRGF0YSIsInVwZGF0ZVBhcmFtcyIsImxpZ2h0aW5nUGFyYW1zIiwibWF4TGlnaHRzUGVyQ2VsbCIsImNvb2tpZXNFbmFibGVkIiwic2hhZG93c0VuYWJsZWQiLCJhcmVhTGlnaHRzRW5hYmxlZCIsInVwZGF0ZUNlbGxzIiwiY3giLCJ4IiwiY3kiLCJ5IiwiY3oiLCJ6IiwibnVtQ2VsbHMiLCJ0b3RhbFBpeGVscyIsIndpZHRoIiwiTWF0aCIsImNlaWwiLCJzcXJ0IiwibWF0aCIsInJvdW5kVXAiLCJoZWlnaHQiLCJEZWJ1ZyIsImFzc2VydCIsImNsdXN0ZXJzIiwiVWludDhDbGFtcGVkQXJyYXkiLCJjb3VudHMiLCJJbnQzMkFycmF5IiwiY3JlYXRlVGV4dHVyZSIsIlBJWEVMRk9STUFUX0w4IiwidXBsb2FkVGV4dHVyZXMiLCJsb2NrIiwic2V0IiwidW5sb2NrIiwidXBkYXRlVW5pZm9ybXMiLCJzZXRWYWx1ZSIsImV2YWxMaWdodENlbGxNaW5NYXgiLCJjbHVzdGVyZWRMaWdodCIsImRpdiIsIm11bDIiLCJaRVJPIiwiY29sbGVjdExpZ2h0cyIsImxpZ2h0cyIsIm1heExpZ2h0cyIsInVzZWRMaWdodHMiLCJsaWdodEluZGV4IiwiZm9yRWFjaCIsInJ1bnRpbWVMaWdodCIsIm1hc2siLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQiLCJ6ZXJvQW5nbGVTcG90bGlnaHQiLCJ0eXBlIiwiTElHSFRUWVBFX1NQT1QiLCJfb3V0ZXJDb25lQW5nbGUiLCJlbmFibGVkIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwidmlzaWJsZVRoaXNGcmFtZSIsImludGVuc2l0eSIsImxlbmd0aCIsImdldEJvdW5kaW5nQm94IiwiZ2V0TWluIiwiZ2V0TWF4Iiwid2Fybk9uY2UiLCJldmFsdWF0ZUJvdW5kcyIsImkiLCJzdWIyIiwic2V0Qm91bmRzIiwiZXZhbHVhdGVDb21wcmVzc2lvbkxpbWl0cyIsImdhbW1hQ29ycmVjdGlvbiIsIm1heEF0dGVudWF0aW9uIiwibWF4Q29sb3JWYWx1ZSIsImF0dGVudWF0aW9uRW5kIiwiY29sb3IiLCJfbGluZWFyRmluYWxDb2xvciIsIl9maW5hbENvbG9yIiwic2V0Q29tcHJlc3Npb25SYW5nZXMiLCJ1cGRhdGVDbHVzdGVycyIsImZpbGwiLCJkaXZYIiwiZGl2WiIsImxpbWl0IiwicGl4ZWxzUGVyQ2VsbENvdW50IiwidG9vTWFueUxpZ2h0cyIsImFkZExpZ2h0RGF0YSIsInhTdGFydCIsInhFbmQiLCJ5U3RhcnQiLCJ5RW5kIiwielN0YXJ0IiwiekVuZCIsImNsdXN0ZXJJbmRleCIsInJlcG9ydExpbWl0IiwiY29uc29sZSIsIndhcm4iLCJ1cGRhdGUiLCJhY3RpdmF0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQVFBLE1BQU1BLFFBQVEsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUMzQixNQUFNQyxRQUFRLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFDM0IsTUFBTUUsUUFBUSxHQUFHLElBQUlGLElBQUks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
