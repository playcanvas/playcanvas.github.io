/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
    this._clusterSkipId = device.scope.resolve('clusterSkip');
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
    // skip clustered lights shader evaluation if only the dummy light exists
    this._clusterSkipId.setValue(this._usedLights.length > 1 ? 0 : 1);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ybGQtY2x1c3RlcnMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9saWdodGluZy93b3JsZC1jbHVzdGVycy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgUElYRUxGT1JNQVRfTDggfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfU1BPVCwgTUFTS19BRkZFQ1RfRFlOQU1JQywgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTGlnaHRzQnVmZmVyIH0gZnJvbSAnLi9saWdodHMtYnVmZmVyLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmNvbnN0IHRlbXBWZWMzID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRlbXBNaW4zID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRlbXBNYXgzID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRlbXBCb3ggPSBuZXcgQm91bmRpbmdCb3goKTtcblxuY29uc3QgZXBzaWxvbiA9IDAuMDAwMDAxO1xuY29uc3QgbWF4VGV4dHVyZVNpemUgPSA0MDk2OyAgICAvLyBtYXhpbXVtIHRleHR1cmUgc2l6ZSBhbGxvd2VkIHRvIHdvcmsgb24gYWxsIGRldmljZXNcblxuLy8gaGVscGVyIGNsYXNzIHRvIHN0b3JlIHByb3BlcnRpZXMgb2YgYSBsaWdodCB1c2VkIGJ5IGNsdXN0ZXJpbmdcbmNsYXNzIENsdXN0ZXJMaWdodCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIC8vIHRoZSBsaWdodCBpdHNlbGZcbiAgICAgICAgdGhpcy5saWdodCA9IG51bGw7XG5cbiAgICAgICAgLy8gYm91bmRpbmcgYm94XG4gICAgICAgIHRoaXMubWluID0gbmV3IFZlYzMoKTtcbiAgICAgICAgdGhpcy5tYXggPSBuZXcgVmVjMygpO1xuICAgIH1cbn1cblxuLy8gTWFpbiBjbGFzcyBpbXBsZW1lbnRpbmcgY2x1c3RlcmVkIGxpZ2h0aW5nLiBJbnRlcm5hbGx5IGl0IG9yZ2FuaXplcyB0aGUgb21uaSAvIHNwb3QgbGlnaHRzIHBsYWNlbWVudCBpbiB3b3JsZCBzcGFjZSAzZCBjZWxsIHN0cnVjdHVyZSxcbi8vIGFuZCBhbHNvIHVzZXMgTGlnaHRzQnVmZmVyIGNsYXNzIHRvIHN0b3JlIGxpZ2h0IHByb3BlcnRpZXMgaW4gdGV4dHVyZXNcbmNsYXNzIFdvcmxkQ2x1c3RlcnMge1xuICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gKi9cbiAgICBjbHVzdGVyVGV4dHVyZTtcblxuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5uYW1lID0gJ1VudGl0bGVkJztcblxuICAgICAgICAvLyBudW1iZXIgb2YgdGltZXMgYSB3YXJuaW5nIHdhcyByZXBvcnRlZFxuICAgICAgICB0aGlzLnJlcG9ydENvdW50ID0gMDtcblxuICAgICAgICAvLyBib3VuZHMgb2YgYWxsIGxpZ2h0IHZvbHVtZXMgKHZvbHVtZSBjb3ZlcmVkIGJ5IHRoZSBjbHVzdGVycylcbiAgICAgICAgdGhpcy5ib3VuZHNNaW4gPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLmJvdW5kc01heCA9IG5ldyBWZWMzKCk7XG4gICAgICAgIHRoaXMuYm91bmRzRGVsdGEgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgIC8vIG51bWJlciBvZiBjZWxscyBhbG9uZyAzIGF4ZXNcbiAgICAgICAgdGhpcy5fY2VsbHMgPSBuZXcgVmVjMygxLCAxLCAxKTsgICAgICAgLy8gbnVtYmVyIG9mIGNlbGxzXG4gICAgICAgIHRoaXMuX2NlbGxzTGltaXQgPSBuZXcgVmVjMygpOyAgLy8gbnVtYmVyIG9mIGNlbGxzIG1pbnVzIG9uZVxuICAgICAgICB0aGlzLmNlbGxzID0gdGhpcy5fY2VsbHM7XG5cbiAgICAgICAgLy8gbnVtYmVyIG9mIGxpZ2h0cyBlYWNoIGNlbGwgY2FuIHN0b3JlXG4gICAgICAgIHRoaXMubWF4Q2VsbExpZ2h0Q291bnQgPSA0O1xuXG4gICAgICAgIC8vIGxpbWl0cyBvbiBzb21lIGxpZ2h0IHByb3BlcnRpZXMsIHVzZWQgZm9yIGNvbXByZXNzaW9uIHRvIDhiaXQgdGV4dHVyZVxuICAgICAgICB0aGlzLl9tYXhBdHRlbnVhdGlvbiA9IDA7XG4gICAgICAgIHRoaXMuX21heENvbG9yVmFsdWUgPSAwO1xuXG4gICAgICAgIC8vIGludGVybmFsIGxpc3Qgb2YgbGlnaHRzIChvZiB0eXBlIENsdXN0ZXJMaWdodClcbiAgICAgICAgdGhpcy5fdXNlZExpZ2h0cyA9IFtdO1xuXG4gICAgICAgIC8vIGxpZ2h0IDAgaXMgYWx3YXlzIHJlc2VydmVkIGZvciAnbm8gbGlnaHQnIGluZGV4XG4gICAgICAgIHRoaXMuX3VzZWRMaWdodHMucHVzaChuZXcgQ2x1c3RlckxpZ2h0KCkpO1xuXG4gICAgICAgIC8vIGFsbG9jYXRlIHRleHR1cmVzIHRvIHN0b3JlIGxpZ2h0c1xuICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlciA9IG5ldyBMaWdodHNCdWZmZXIoZGV2aWNlKTtcblxuICAgICAgICAvLyByZWdpc3RlciBzaGFkZXIgdW5pZm9ybXNcbiAgICAgICAgdGhpcy5yZWdpc3RlclVuaWZvcm1zKGRldmljZSk7XG4gICAgfVxuXG4gICAgc2V0IG1heENlbGxMaWdodENvdW50KGNvdW50KSB7XG5cbiAgICAgICAgaWYgKGNvdW50ICE9PSB0aGlzLl9tYXhDZWxsTGlnaHRDb3VudCkge1xuICAgICAgICAgICAgdGhpcy5fbWF4Q2VsbExpZ2h0Q291bnQgPSBjb3VudDtcbiAgICAgICAgICAgIHRoaXMuX2NlbGxzRGlydHkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1heENlbGxMaWdodENvdW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF4Q2VsbExpZ2h0Q291bnQ7XG4gICAgfVxuXG4gICAgc2V0IGNlbGxzKHZhbHVlKSB7XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIHdlIGhhdmUgd2hvbGUgbnVtYmVyc1xuICAgICAgICB0ZW1wVmVjMy5jb3B5KHZhbHVlKS5mbG9vcigpO1xuXG4gICAgICAgIGlmICghdGhpcy5fY2VsbHMuZXF1YWxzKHRlbXBWZWMzKSkge1xuICAgICAgICAgICAgdGhpcy5fY2VsbHMuY29weSh0ZW1wVmVjMyk7XG4gICAgICAgICAgICB0aGlzLl9jZWxsc0xpbWl0LmNvcHkodGVtcFZlYzMpLnN1YihWZWMzLk9ORSk7XG4gICAgICAgICAgICB0aGlzLl9jZWxsc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjZWxscygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NlbGxzO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgdGhpcy5saWdodHNCdWZmZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMucmVsZWFzZUNsdXN0ZXJUZXh0dXJlKCk7XG4gICAgfVxuXG4gICAgcmVsZWFzZUNsdXN0ZXJUZXh0dXJlKCkge1xuICAgICAgICBpZiAodGhpcy5jbHVzdGVyVGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5jbHVzdGVyVGV4dHVyZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmNsdXN0ZXJUZXh0dXJlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlZ2lzdGVyVW5pZm9ybXMoZGV2aWNlKSB7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlclNraXBJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyU2tpcCcpO1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJNYXhDZWxsc0lkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJNYXhDZWxscycpO1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJXb3JsZFRleHR1cmVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyV29ybGRUZXh0dXJlJyk7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlclRleHR1cmVTaXplSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY2x1c3RlclRleHR1cmVTaXplJyk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJUZXh0dXJlU2l6ZURhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNNaW5JZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyQm91bmRzTWluJyk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNNaW5EYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcblxuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzRGVsdGFJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyQm91bmRzRGVsdGEnKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc0RlbHRhRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzQ291bnRCeUJvdW5kc1NpemVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCdjbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZScpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZURhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0RvdElkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJDZWxsc0RvdCcpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNEb3REYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcblxuICAgICAgICAvLyBudW1iZXIgb2YgY2VsbHMgaW4gZWFjaCBkaXJlY3Rpb24gKHZlYzMpXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc01heElkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJDZWxsc01heCcpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcblxuICAgICAgICAvLyBjb21wcmVzc2lvbiBsaW1pdCAwXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MElkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2NsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MCcpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ29tcHJlc3Npb25MaW1pdDBEYXRhID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICB9XG5cbiAgICAvLyB1cGRhdGVzIGl0c2VsZiBiYXNlZCBvbiBwYXJhbWV0ZXJzIHN0b3JlZCBpbiB0aGUgc2NlbmVcbiAgICB1cGRhdGVQYXJhbXMobGlnaHRpbmdQYXJhbXMpIHtcbiAgICAgICAgaWYgKGxpZ2h0aW5nUGFyYW1zKSB7XG4gICAgICAgICAgICB0aGlzLmNlbGxzID0gbGlnaHRpbmdQYXJhbXMuY2VsbHM7XG4gICAgICAgICAgICB0aGlzLm1heENlbGxMaWdodENvdW50ID0gbGlnaHRpbmdQYXJhbXMubWF4TGlnaHRzUGVyQ2VsbDtcblxuICAgICAgICAgICAgdGhpcy5saWdodHNCdWZmZXIuY29va2llc0VuYWJsZWQgPSBsaWdodGluZ1BhcmFtcy5jb29raWVzRW5hYmxlZDtcbiAgICAgICAgICAgIHRoaXMubGlnaHRzQnVmZmVyLnNoYWRvd3NFbmFibGVkID0gbGlnaHRpbmdQYXJhbXMuc2hhZG93c0VuYWJsZWQ7XG5cbiAgICAgICAgICAgIHRoaXMubGlnaHRzQnVmZmVyLmFyZWFMaWdodHNFbmFibGVkID0gbGlnaHRpbmdQYXJhbXMuYXJlYUxpZ2h0c0VuYWJsZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVDZWxscygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NlbGxzRGlydHkpIHtcbiAgICAgICAgICAgIHRoaXMuX2NlbGxzRGlydHkgPSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3QgY3ggPSB0aGlzLl9jZWxscy54O1xuICAgICAgICAgICAgY29uc3QgY3kgPSB0aGlzLl9jZWxscy55O1xuICAgICAgICAgICAgY29uc3QgY3ogPSB0aGlzLl9jZWxscy56O1xuXG4gICAgICAgICAgICAvLyBzdG9yaW5nIDEgbGlnaHQgcGVyIHBpeGVsXG4gICAgICAgICAgICBjb25zdCBudW1DZWxscyA9IGN4ICogY3kgKiBjejtcbiAgICAgICAgICAgIGNvbnN0IHRvdGFsUGl4ZWxzID0gdGhpcy5tYXhDZWxsTGlnaHRDb3VudCAqIG51bUNlbGxzO1xuXG4gICAgICAgICAgICAvLyBjbHVzdGVyIHRleHR1cmUgc2l6ZSAtIHJvdWdobHkgc3F1YXJlIHRoYXQgZml0cyBhbGwgY2VsbHMuIFRoZSB3aWR0aCBpcyBtdWx0aXBseSBvZiBudW1QaXhlbHMgdG8gc2ltcGxpZnkgc2hhZGVyIG1hdGhcbiAgICAgICAgICAgIGxldCB3aWR0aCA9IE1hdGguY2VpbChNYXRoLnNxcnQodG90YWxQaXhlbHMpKTtcbiAgICAgICAgICAgIHdpZHRoID0gbWF0aC5yb3VuZFVwKHdpZHRoLCB0aGlzLm1heENlbGxMaWdodENvdW50KTtcbiAgICAgICAgICAgIGNvbnN0IGhlaWdodCA9IE1hdGguY2VpbCh0b3RhbFBpeGVscyAvIHdpZHRoKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHRleHR1cmUgaXMgYWxsb3dlZCBzaXplXG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQod2lkdGggPD0gbWF4VGV4dHVyZVNpemUgJiYgaGVpZ2h0IDw9IG1heFRleHR1cmVTaXplLFxuICAgICAgICAgICAgICAgICAgICAgICAgICdDbHVzdGVyZWQgbGlnaHRzIHBhcmFtZXRlcnMgY2F1c2UgdGhlIHRleHR1cmUgc2l6ZSB0byBiZSBvdmVyIHRoZSBsaW1pdCwgcGxlYXNlIGFkanVzdCB0aGVtLicpO1xuXG4gICAgICAgICAgICAvLyBtYXhpbXVtIHJhbmdlIG9mIGNlbGxzXG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhWzBdID0gY3g7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhWzFdID0gY3k7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhWzJdID0gY3o7XG5cbiAgICAgICAgICAgIC8vIHZlY3RvciB0byBhbGxvdyBzaW5nbGUgZG90IHByb2R1Y3QgdG8gY29udmVydCBmcm9tIHdvcmxkIGNvb3JkaW5hdGVzIHRvIGNsdXN0ZXIgaW5kZXhcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0RvdERhdGFbMF0gPSB0aGlzLm1heENlbGxMaWdodENvdW50O1xuICAgICAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzRG90RGF0YVsxXSA9IGN4ICogY3ogKiB0aGlzLm1heENlbGxMaWdodENvdW50O1xuICAgICAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzRG90RGF0YVsyXSA9IGN4ICogdGhpcy5tYXhDZWxsTGlnaHRDb3VudDtcblxuICAgICAgICAgICAgLy8gY2x1c3RlciBkYXRhIGFuZCBudW1iZXIgb2YgbGlnaHRzIHBlciBjZWxsXG4gICAgICAgICAgICB0aGlzLmNsdXN0ZXJzID0gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KHRvdGFsUGl4ZWxzKTtcbiAgICAgICAgICAgIHRoaXMuY291bnRzID0gbmV3IEludDMyQXJyYXkobnVtQ2VsbHMpO1xuXG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVEYXRhWzBdID0gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVEYXRhWzFdID0gMS4wIC8gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVEYXRhWzJdID0gMS4wIC8gaGVpZ2h0O1xuXG4gICAgICAgICAgICB0aGlzLnJlbGVhc2VDbHVzdGVyVGV4dHVyZSgpO1xuICAgICAgICAgICAgdGhpcy5jbHVzdGVyVGV4dHVyZSA9IExpZ2h0c0J1ZmZlci5jcmVhdGVUZXh0dXJlKHRoaXMuZGV2aWNlLCB3aWR0aCwgaGVpZ2h0LCBQSVhFTEZPUk1BVF9MOCwgJ0NsdXN0ZXJUZXh0dXJlJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGxvYWRUZXh0dXJlcygpIHtcblxuICAgICAgICB0aGlzLmNsdXN0ZXJUZXh0dXJlLmxvY2soKS5zZXQodGhpcy5jbHVzdGVycyk7XG4gICAgICAgIHRoaXMuY2x1c3RlclRleHR1cmUudW5sb2NrKCk7XG5cbiAgICAgICAgdGhpcy5saWdodHNCdWZmZXIudXBsb2FkVGV4dHVyZXMoKTtcbiAgICB9XG5cbiAgICB1cGRhdGVVbmlmb3JtcygpIHtcblxuICAgICAgICAvLyBza2lwIGNsdXN0ZXJlZCBsaWdodHMgc2hhZGVyIGV2YWx1YXRpb24gaWYgb25seSB0aGUgZHVtbXkgbGlnaHQgZXhpc3RzXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJTa2lwSWQuc2V0VmFsdWUodGhpcy5fdXNlZExpZ2h0cy5sZW5ndGggPiAxID8gMCA6IDEpO1xuXG4gICAgICAgIHRoaXMubGlnaHRzQnVmZmVyLnVwZGF0ZVVuaWZvcm1zKCk7XG5cbiAgICAgICAgLy8gdGV4dHVyZVxuICAgICAgICB0aGlzLl9jbHVzdGVyV29ybGRUZXh0dXJlSWQuc2V0VmFsdWUodGhpcy5jbHVzdGVyVGV4dHVyZSk7XG5cbiAgICAgICAgLy8gdW5pZm9ybSB2YWx1ZXNcbiAgICAgICAgdGhpcy5fY2x1c3Rlck1heENlbGxzSWQuc2V0VmFsdWUodGhpcy5tYXhDZWxsTGlnaHRDb3VudCk7XG5cbiAgICAgICAgY29uc3QgYm91bmRzRGVsdGEgPSB0aGlzLmJvdW5kc0RlbHRhO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZURhdGFbMF0gPSB0aGlzLl9jZWxscy54IC8gYm91bmRzRGVsdGEueDtcbiAgICAgICAgdGhpcy5fY2x1c3RlckNlbGxzQ291bnRCeUJvdW5kc1NpemVEYXRhWzFdID0gdGhpcy5fY2VsbHMueSAvIGJvdW5kc0RlbHRhLnk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplRGF0YVsyXSA9IHRoaXMuX2NlbGxzLnogLyBib3VuZHNEZWx0YS56O1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNDb3VudEJ5Qm91bmRzU2l6ZUlkLnNldFZhbHVlKHRoaXMuX2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplRGF0YSk7XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc01pbkRhdGFbMF0gPSB0aGlzLmJvdW5kc01pbi54O1xuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzTWluRGF0YVsxXSA9IHRoaXMuYm91bmRzTWluLnk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNNaW5EYXRhWzJdID0gdGhpcy5ib3VuZHNNaW4uejtcblxuICAgICAgICB0aGlzLl9jbHVzdGVyQm91bmRzRGVsdGFEYXRhWzBdID0gYm91bmRzRGVsdGEueDtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc0RlbHRhRGF0YVsxXSA9IGJvdW5kc0RlbHRhLnk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJCb3VuZHNEZWx0YURhdGFbMl0gPSBib3VuZHNEZWx0YS56O1xuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MERhdGFbMF0gPSB0aGlzLl9tYXhBdHRlbnVhdGlvbjtcbiAgICAgICAgdGhpcy5fY2x1c3RlckNvbXByZXNzaW9uTGltaXQwRGF0YVsxXSA9IHRoaXMuX21heENvbG9yVmFsdWU7XG5cbiAgICAgICAgLy8gYXNzaWduIHZhbHVlc1xuICAgICAgICB0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVJZC5zZXRWYWx1ZSh0aGlzLl9jbHVzdGVyVGV4dHVyZVNpemVEYXRhKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc01pbklkLnNldFZhbHVlKHRoaXMuX2NsdXN0ZXJCb3VuZHNNaW5EYXRhKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckJvdW5kc0RlbHRhSWQuc2V0VmFsdWUodGhpcy5fY2x1c3RlckJvdW5kc0RlbHRhRGF0YSk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJDZWxsc0RvdElkLnNldFZhbHVlKHRoaXMuX2NsdXN0ZXJDZWxsc0RvdERhdGEpO1xuICAgICAgICB0aGlzLl9jbHVzdGVyQ2VsbHNNYXhJZC5zZXRWYWx1ZSh0aGlzLl9jbHVzdGVyQ2VsbHNNYXhEYXRhKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlckNvbXByZXNzaW9uTGltaXQwSWQuc2V0VmFsdWUodGhpcy5fY2x1c3RlckNvbXByZXNzaW9uTGltaXQwRGF0YSk7XG4gICAgfVxuXG4gICAgLy8gZXZhbHVhdGVzIG1pbiBhbmQgbWF4IGNvb3JkaW5hdGVzIG9mIEFBQkIgb2YgdGhlIGxpZ2h0IGluIHRoZSBjZWxsIHNwYWNlXG4gICAgZXZhbExpZ2h0Q2VsbE1pbk1heChjbHVzdGVyZWRMaWdodCwgbWluLCBtYXgpIHtcblxuICAgICAgICAvLyBtaW4gcG9pbnQgb2YgQUFCQiBpbiBjZWxsIHNwYWNlXG4gICAgICAgIG1pbi5jb3B5KGNsdXN0ZXJlZExpZ2h0Lm1pbik7XG4gICAgICAgIG1pbi5zdWIodGhpcy5ib3VuZHNNaW4pO1xuICAgICAgICBtaW4uZGl2KHRoaXMuYm91bmRzRGVsdGEpO1xuICAgICAgICBtaW4ubXVsMihtaW4sIHRoaXMuY2VsbHMpO1xuICAgICAgICBtaW4uZmxvb3IoKTtcblxuICAgICAgICAvLyBtYXggcG9pbnQgb2YgQUFCQiBpbiBjZWxsIHNwYWNlXG4gICAgICAgIG1heC5jb3B5KGNsdXN0ZXJlZExpZ2h0Lm1heCk7XG4gICAgICAgIG1heC5zdWIodGhpcy5ib3VuZHNNaW4pO1xuICAgICAgICBtYXguZGl2KHRoaXMuYm91bmRzRGVsdGEpO1xuICAgICAgICBtYXgubXVsMihtYXgsIHRoaXMuY2VsbHMpO1xuICAgICAgICBtYXguY2VpbCgpO1xuXG4gICAgICAgIC8vIGNsYW1wIHRvIGxpbWl0c1xuICAgICAgICBtaW4ubWF4KFZlYzMuWkVSTyk7XG4gICAgICAgIG1heC5taW4odGhpcy5fY2VsbHNMaW1pdCk7XG4gICAgfVxuXG4gICAgY29sbGVjdExpZ2h0cyhsaWdodHMpIHtcblxuICAgICAgICBjb25zdCBtYXhMaWdodHMgPSB0aGlzLmxpZ2h0c0J1ZmZlci5tYXhMaWdodHM7XG5cbiAgICAgICAgLy8gc2tpcCBpbmRleCAwIGFzIHRoYXQgaXMgdXNlZCBmb3IgdW51c2VkIGxpZ2h0XG4gICAgICAgIGNvbnN0IHVzZWRMaWdodHMgPSB0aGlzLl91c2VkTGlnaHRzO1xuICAgICAgICBsZXQgbGlnaHRJbmRleCA9IDE7XG5cbiAgICAgICAgbGlnaHRzLmZvckVhY2goKGxpZ2h0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBydW50aW1lTGlnaHQgPSAhIShsaWdodC5tYXNrICYgKE1BU0tfQUZGRUNUX0RZTkFNSUMgfCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCkpO1xuICAgICAgICAgICAgY29uc3QgemVyb0FuZ2xlU3BvdGxpZ2h0ID0gbGlnaHQudHlwZSA9PT0gTElHSFRUWVBFX1NQT1QgJiYgbGlnaHQuX291dGVyQ29uZUFuZ2xlID09PSAwO1xuICAgICAgICAgICAgaWYgKGxpZ2h0LmVuYWJsZWQgJiYgbGlnaHQudHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMICYmIGxpZ2h0LnZpc2libGVUaGlzRnJhbWUgJiYgbGlnaHQuaW50ZW5zaXR5ID4gMCAmJiBydW50aW1lTGlnaHQgJiYgIXplcm9BbmdsZVNwb3RsaWdodCkge1xuXG4gICAgICAgICAgICAgICAgLy8gd2l0aGluIGxpZ2h0IGxpbWl0XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0SW5kZXggPCBtYXhMaWdodHMpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZXVzZSBhbGxvY2F0ZWQgc3BvdFxuICAgICAgICAgICAgICAgICAgICBsZXQgY2x1c3RlcmVkTGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodEluZGV4IDwgdXNlZExpZ2h0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJlZExpZ2h0ID0gdXNlZExpZ2h0c1tsaWdodEluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbG9jYXRlIG5ldyBzcG90XG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVyZWRMaWdodCA9IG5ldyBDbHVzdGVyTGlnaHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZWRMaWdodHMucHVzaChjbHVzdGVyZWRMaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBzdG9yZSBsaWdodCBwcm9wZXJ0aWVzXG4gICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJlZExpZ2h0LmxpZ2h0ID0gbGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0LmdldEJvdW5kaW5nQm94KHRlbXBCb3gpO1xuICAgICAgICAgICAgICAgICAgICBjbHVzdGVyZWRMaWdodC5taW4uY29weSh0ZW1wQm94LmdldE1pbigpKTtcbiAgICAgICAgICAgICAgICAgICAgY2x1c3RlcmVkTGlnaHQubWF4LmNvcHkodGVtcEJveC5nZXRNYXgoKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgbGlnaHRJbmRleCsrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKGBDbHVzdGVyZWQgbGlnaHRpbmc6IG1vcmUgdGhhbiAke21heExpZ2h0cyAtIDF9IGxpZ2h0cyBpbiB0aGUgZnJhbWUsIGlnbm9yaW5nIHNvbWUuYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB1c2VkTGlnaHRzLmxlbmd0aCA9IGxpZ2h0SW5kZXg7XG4gICAgfVxuXG4gICAgLy8gZXZhbHVhdGUgdGhlIGFyZWEgYWxsIGxpZ2h0cyBjb3ZlclxuICAgIGV2YWx1YXRlQm91bmRzKCkge1xuXG4gICAgICAgIGNvbnN0IHVzZWRMaWdodHMgPSB0aGlzLl91c2VkTGlnaHRzO1xuXG4gICAgICAgIC8vIGJvdW5kcyBvZiB0aGUgYXJlYSB0aGUgbGlnaHRzIGNvdmVyXG4gICAgICAgIGNvbnN0IG1pbiA9IHRoaXMuYm91bmRzTWluO1xuICAgICAgICBjb25zdCBtYXggPSB0aGlzLmJvdW5kc01heDtcblxuICAgICAgICAvLyBpZiBhdCBsZWFzdCBvbmUgbGlnaHQgKGluZGV4IDAgaXMgbnVsbCwgc28gaWdub3JlIHRoYXQgb25lKVxuICAgICAgICBpZiAodXNlZExpZ2h0cy5sZW5ndGggPiAxKSB7XG5cbiAgICAgICAgICAgIC8vIEFBQkIgb2YgdGhlIGZpcnN0IGxpZ2h0XG4gICAgICAgICAgICBtaW4uY29weSh1c2VkTGlnaHRzWzFdLm1pbik7XG4gICAgICAgICAgICBtYXguY29weSh1c2VkTGlnaHRzWzFdLm1heCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAyOyBpIDwgdXNlZExpZ2h0cy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gZXhwYW5kIGJ5IEFBQkIgb2YgdGhpcyBsaWdodFxuICAgICAgICAgICAgICAgIG1pbi5taW4odXNlZExpZ2h0c1tpXS5taW4pO1xuICAgICAgICAgICAgICAgIG1heC5tYXgodXNlZExpZ2h0c1tpXS5tYXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBhbnkgc21hbGwgdm9sdW1lIGlmIG5vIGxpZ2h0c1xuICAgICAgICAgICAgbWluLnNldCgwLCAwLCAwKTtcbiAgICAgICAgICAgIG1heC5zZXQoMSwgMSwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBib3VuZHMgcmFuZ2VcbiAgICAgICAgdGhpcy5ib3VuZHNEZWx0YS5zdWIyKG1heCwgbWluKTtcblxuICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlci5zZXRCb3VuZHMobWluLCB0aGlzLmJvdW5kc0RlbHRhKTtcbiAgICB9XG5cbiAgICAvLyBldmFsdWF0ZSByYW5nZXMgb2YgdmFyaWFibGVzIGNvbXByZXNzZWQgdG8gOGJpdCB0ZXh0dXJlIHRvIGFsbG93IHRoZWlyIHNjYWxpbmcgdG8gMC4uMSByYW5nZVxuICAgIGV2YWx1YXRlQ29tcHJlc3Npb25MaW1pdHMoZ2FtbWFDb3JyZWN0aW9uKSB7XG5cbiAgICAgICAgbGV0IG1heEF0dGVudWF0aW9uID0gMDtcbiAgICAgICAgbGV0IG1heENvbG9yVmFsdWUgPSAwO1xuXG4gICAgICAgIGNvbnN0IHVzZWRMaWdodHMgPSB0aGlzLl91c2VkTGlnaHRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IHVzZWRMaWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gdXNlZExpZ2h0c1tpXS5saWdodDtcbiAgICAgICAgICAgIG1heEF0dGVudWF0aW9uID0gTWF0aC5tYXgobGlnaHQuYXR0ZW51YXRpb25FbmQsIG1heEF0dGVudWF0aW9uKTtcblxuICAgICAgICAgICAgY29uc3QgY29sb3IgPSBnYW1tYUNvcnJlY3Rpb24gPyBsaWdodC5fbGluZWFyRmluYWxDb2xvciA6IGxpZ2h0Ll9maW5hbENvbG9yO1xuICAgICAgICAgICAgbWF4Q29sb3JWYWx1ZSA9IE1hdGgubWF4KGNvbG9yWzBdLCBtYXhDb2xvclZhbHVlKTtcbiAgICAgICAgICAgIG1heENvbG9yVmFsdWUgPSBNYXRoLm1heChjb2xvclsxXSwgbWF4Q29sb3JWYWx1ZSk7XG4gICAgICAgICAgICBtYXhDb2xvclZhbHVlID0gTWF0aC5tYXgoY29sb3JbMl0sIG1heENvbG9yVmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW5jcmVhc2Ugc2xpZ2h0bHkgYXMgY29tcHJlc3Npb24gbmVlZHMgdmFsdWUgPCAxXG4gICAgICAgIHRoaXMuX21heEF0dGVudWF0aW9uID0gbWF4QXR0ZW51YXRpb24gKyBlcHNpbG9uO1xuICAgICAgICB0aGlzLl9tYXhDb2xvclZhbHVlID0gbWF4Q29sb3JWYWx1ZSArIGVwc2lsb247XG5cbiAgICAgICAgdGhpcy5saWdodHNCdWZmZXIuc2V0Q29tcHJlc3Npb25SYW5nZXModGhpcy5fbWF4QXR0ZW51YXRpb24sIHRoaXMuX21heENvbG9yVmFsdWUpO1xuICAgIH1cblxuICAgIHVwZGF0ZUNsdXN0ZXJzKGdhbW1hQ29ycmVjdGlvbikge1xuXG4gICAgICAgIC8vIGNsZWFyIGNsdXN0ZXJzXG4gICAgICAgIHRoaXMuY291bnRzLmZpbGwoMCk7XG4gICAgICAgIHRoaXMuY2x1c3RlcnMuZmlsbCgwKTtcblxuICAgICAgICAvLyBsb2NhbCBhY2Nlc3NvcnNcbiAgICAgICAgY29uc3QgZGl2WCA9IHRoaXMuX2NlbGxzLng7XG4gICAgICAgIGNvbnN0IGRpdlogPSB0aGlzLl9jZWxscy56O1xuICAgICAgICBjb25zdCBjb3VudHMgPSB0aGlzLmNvdW50cztcbiAgICAgICAgY29uc3QgbGltaXQgPSB0aGlzLl9tYXhDZWxsTGlnaHRDb3VudDtcbiAgICAgICAgY29uc3QgY2x1c3RlcnMgPSB0aGlzLmNsdXN0ZXJzO1xuICAgICAgICBjb25zdCBwaXhlbHNQZXJDZWxsQ291bnQgPSB0aGlzLm1heENlbGxMaWdodENvdW50O1xuICAgICAgICBsZXQgdG9vTWFueUxpZ2h0cyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHN0YXJ0ZWQgZnJvbSBpbmRleCAxLCB6ZXJvIGlzIFwibm8tbGlnaHRcIiBpbmRleFxuICAgICAgICBjb25zdCB1c2VkTGlnaHRzID0gdGhpcy5fdXNlZExpZ2h0cztcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCB1c2VkTGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjbHVzdGVyZWRMaWdodCA9IHVzZWRMaWdodHNbaV07XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGNsdXN0ZXJlZExpZ2h0LmxpZ2h0O1xuXG4gICAgICAgICAgICAvLyBhZGQgbGlnaHQgZGF0YSBpbnRvIHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLmxpZ2h0c0J1ZmZlci5hZGRMaWdodERhdGEobGlnaHQsIGksIGdhbW1hQ29ycmVjdGlvbik7XG5cbiAgICAgICAgICAgIC8vIGxpZ2h0J3MgYm91bmRzIGluIGNlbGwgc3BhY2VcbiAgICAgICAgICAgIHRoaXMuZXZhbExpZ2h0Q2VsbE1pbk1heChjbHVzdGVyZWRMaWdodCwgdGVtcE1pbjMsIHRlbXBNYXgzKTtcblxuICAgICAgICAgICAgY29uc3QgeFN0YXJ0ID0gdGVtcE1pbjMueDtcbiAgICAgICAgICAgIGNvbnN0IHhFbmQgPSB0ZW1wTWF4My54O1xuICAgICAgICAgICAgY29uc3QgeVN0YXJ0ID0gdGVtcE1pbjMueTtcbiAgICAgICAgICAgIGNvbnN0IHlFbmQgPSB0ZW1wTWF4My55O1xuICAgICAgICAgICAgY29uc3QgelN0YXJ0ID0gdGVtcE1pbjMuejtcbiAgICAgICAgICAgIGNvbnN0IHpFbmQgPSB0ZW1wTWF4My56O1xuXG4gICAgICAgICAgICAvLyBhZGQgdGhlIGxpZ2h0IHRvIHRoZSBjZWxsc1xuICAgICAgICAgICAgZm9yIChsZXQgeCA9IHhTdGFydDsgeCA8PSB4RW5kOyB4KyspIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCB6ID0gelN0YXJ0OyB6IDw9IHpFbmQ7IHorKykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB5ID0geVN0YXJ0OyB5IDw9IHlFbmQ7IHkrKykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbHVzdGVySW5kZXggPSB4ICsgZGl2WCAqICh6ICsgeSAqIGRpdlopO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY291bnQgPSBjb3VudHNbY2x1c3RlckluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb3VudCA8IGxpbWl0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlcnNbcGl4ZWxzUGVyQ2VsbENvdW50ICogY2x1c3RlckluZGV4ICsgY291bnRdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3VudHNbY2x1c3RlckluZGV4XSA9IGNvdW50ICsgMTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b29NYW55TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRvb01hbnlMaWdodHMpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlcG9ydExpbWl0ID0gNTtcbiAgICAgICAgICAgIGlmICh0aGlzLnJlcG9ydENvdW50IDwgcmVwb3J0TGltaXQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1RvbyBtYW55IGxpZ2h0cyBpbiBsaWdodCBjbHVzdGVyICcgKyB0aGlzLm5hbWUgKyAnLCBwbGVhc2UgYWRqdXN0IHBhcmFtZXRlcnMuJyArXG4gICAgICAgICAgICAgICAgKHRoaXMucmVwb3J0Q291bnQgPT09IHJlcG9ydExpbWl0IC0gMSA/ICcgR2l2aW5nIHVwIG9uIHJlcG9ydGluZyBpdC4nIDogJycpKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlcG9ydENvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLy8gaW50ZXJuYWwgdXBkYXRlIG9mIHRoZSBjbHVzdGVyIGRhdGEsIGV4ZWN1dGVzIG9uY2UgcGVyIGZyYW1lXG4gICAgdXBkYXRlKGxpZ2h0cywgZ2FtbWFDb3JyZWN0aW9uLCBsaWdodGluZ1BhcmFtcykge1xuICAgICAgICB0aGlzLnVwZGF0ZVBhcmFtcyhsaWdodGluZ1BhcmFtcyk7XG4gICAgICAgIHRoaXMudXBkYXRlQ2VsbHMoKTtcbiAgICAgICAgdGhpcy5jb2xsZWN0TGlnaHRzKGxpZ2h0cyk7XG4gICAgICAgIHRoaXMuZXZhbHVhdGVCb3VuZHMoKTtcbiAgICAgICAgdGhpcy5ldmFsdWF0ZUNvbXByZXNzaW9uTGltaXRzKGdhbW1hQ29ycmVjdGlvbik7XG4gICAgICAgIHRoaXMudXBkYXRlQ2x1c3RlcnMoZ2FtbWFDb3JyZWN0aW9uKTtcbiAgICAgICAgdGhpcy51cGxvYWRUZXh0dXJlcygpO1xuICAgIH1cblxuICAgIC8vIGNhbGxlZCBvbiBhbHJlYWR5IHVwZGF0ZWQgY2x1c3RlcnMsIGFjdGl2YXRlcyBmb3IgcmVuZGVyaW5nIGJ5IHNldHRpbmcgdXAgdW5pZm9ybXMgLyB0ZXh0dXJlcyBvbiB0aGUgZGV2aWNlXG4gICAgYWN0aXZhdGUoKSB7XG4gICAgICAgIHRoaXMudXBkYXRlVW5pZm9ybXMoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdvcmxkQ2x1c3RlcnMgfTtcbiJdLCJuYW1lcyI6WyJ0ZW1wVmVjMyIsIlZlYzMiLCJ0ZW1wTWluMyIsInRlbXBNYXgzIiwidGVtcEJveCIsIkJvdW5kaW5nQm94IiwiZXBzaWxvbiIsIm1heFRleHR1cmVTaXplIiwiQ2x1c3RlckxpZ2h0IiwiY29uc3RydWN0b3IiLCJsaWdodCIsIm1pbiIsIm1heCIsIldvcmxkQ2x1c3RlcnMiLCJkZXZpY2UiLCJjbHVzdGVyVGV4dHVyZSIsIm5hbWUiLCJyZXBvcnRDb3VudCIsImJvdW5kc01pbiIsImJvdW5kc01heCIsImJvdW5kc0RlbHRhIiwiX2NlbGxzIiwiX2NlbGxzTGltaXQiLCJjZWxscyIsIm1heENlbGxMaWdodENvdW50IiwiX21heEF0dGVudWF0aW9uIiwiX21heENvbG9yVmFsdWUiLCJfdXNlZExpZ2h0cyIsInB1c2giLCJsaWdodHNCdWZmZXIiLCJMaWdodHNCdWZmZXIiLCJyZWdpc3RlclVuaWZvcm1zIiwiY291bnQiLCJfbWF4Q2VsbExpZ2h0Q291bnQiLCJfY2VsbHNEaXJ0eSIsInZhbHVlIiwiY29weSIsImZsb29yIiwiZXF1YWxzIiwic3ViIiwiT05FIiwiZGVzdHJveSIsInJlbGVhc2VDbHVzdGVyVGV4dHVyZSIsIl9jbHVzdGVyU2tpcElkIiwic2NvcGUiLCJyZXNvbHZlIiwiX2NsdXN0ZXJNYXhDZWxsc0lkIiwiX2NsdXN0ZXJXb3JsZFRleHR1cmVJZCIsIl9jbHVzdGVyVGV4dHVyZVNpemVJZCIsIl9jbHVzdGVyVGV4dHVyZVNpemVEYXRhIiwiRmxvYXQzMkFycmF5IiwiX2NsdXN0ZXJCb3VuZHNNaW5JZCIsIl9jbHVzdGVyQm91bmRzTWluRGF0YSIsIl9jbHVzdGVyQm91bmRzRGVsdGFJZCIsIl9jbHVzdGVyQm91bmRzRGVsdGFEYXRhIiwiX2NsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplSWQiLCJfY2x1c3RlckNlbGxzQ291bnRCeUJvdW5kc1NpemVEYXRhIiwiX2NsdXN0ZXJDZWxsc0RvdElkIiwiX2NsdXN0ZXJDZWxsc0RvdERhdGEiLCJfY2x1c3RlckNlbGxzTWF4SWQiLCJfY2x1c3RlckNlbGxzTWF4RGF0YSIsIl9jbHVzdGVyQ29tcHJlc3Npb25MaW1pdDBJZCIsIl9jbHVzdGVyQ29tcHJlc3Npb25MaW1pdDBEYXRhIiwidXBkYXRlUGFyYW1zIiwibGlnaHRpbmdQYXJhbXMiLCJtYXhMaWdodHNQZXJDZWxsIiwiY29va2llc0VuYWJsZWQiLCJzaGFkb3dzRW5hYmxlZCIsImFyZWFMaWdodHNFbmFibGVkIiwidXBkYXRlQ2VsbHMiLCJjeCIsIngiLCJjeSIsInkiLCJjeiIsInoiLCJudW1DZWxscyIsInRvdGFsUGl4ZWxzIiwid2lkdGgiLCJNYXRoIiwiY2VpbCIsInNxcnQiLCJtYXRoIiwicm91bmRVcCIsImhlaWdodCIsIkRlYnVnIiwiYXNzZXJ0IiwiY2x1c3RlcnMiLCJVaW50OENsYW1wZWRBcnJheSIsImNvdW50cyIsIkludDMyQXJyYXkiLCJjcmVhdGVUZXh0dXJlIiwiUElYRUxGT1JNQVRfTDgiLCJ1cGxvYWRUZXh0dXJlcyIsImxvY2siLCJzZXQiLCJ1bmxvY2siLCJ1cGRhdGVVbmlmb3JtcyIsInNldFZhbHVlIiwibGVuZ3RoIiwiZXZhbExpZ2h0Q2VsbE1pbk1heCIsImNsdXN0ZXJlZExpZ2h0IiwiZGl2IiwibXVsMiIsIlpFUk8iLCJjb2xsZWN0TGlnaHRzIiwibGlnaHRzIiwibWF4TGlnaHRzIiwidXNlZExpZ2h0cyIsImxpZ2h0SW5kZXgiLCJmb3JFYWNoIiwicnVudGltZUxpZ2h0IiwibWFzayIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsInplcm9BbmdsZVNwb3RsaWdodCIsInR5cGUiLCJMSUdIVFRZUEVfU1BPVCIsIl9vdXRlckNvbmVBbmdsZSIsImVuYWJsZWQiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwiaW50ZW5zaXR5IiwiZ2V0Qm91bmRpbmdCb3giLCJnZXRNaW4iLCJnZXRNYXgiLCJ3YXJuT25jZSIsImV2YWx1YXRlQm91bmRzIiwiaSIsInN1YjIiLCJzZXRCb3VuZHMiLCJldmFsdWF0ZUNvbXByZXNzaW9uTGltaXRzIiwiZ2FtbWFDb3JyZWN0aW9uIiwibWF4QXR0ZW51YXRpb24iLCJtYXhDb2xvclZhbHVlIiwiYXR0ZW51YXRpb25FbmQiLCJjb2xvciIsIl9saW5lYXJGaW5hbENvbG9yIiwiX2ZpbmFsQ29sb3IiLCJzZXRDb21wcmVzc2lvblJhbmdlcyIsInVwZGF0ZUNsdXN0ZXJzIiwiZmlsbCIsImRpdlgiLCJkaXZaIiwibGltaXQiLCJwaXhlbHNQZXJDZWxsQ291bnQiLCJ0b29NYW55TGlnaHRzIiwiYWRkTGlnaHREYXRhIiwieFN0YXJ0IiwieEVuZCIsInlTdGFydCIsInlFbmQiLCJ6U3RhcnQiLCJ6RW5kIiwiY2x1c3RlckluZGV4IiwicmVwb3J0TGltaXQiLCJjb25zb2xlIiwid2FybiIsInVwZGF0ZSIsImFjdGl2YXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBUUEsTUFBTUEsUUFBUSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzNCLE1BQU1DLFFBQVEsR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUMzQixNQUFNRSxRQUFRLEdBQUcsSUFBSUYsSUFBSSxFQUFFLENBQUE7QUFDM0IsTUFBTUcsT0FBTyxHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBO0FBRWpDLE1BQU1DLE9BQU8sR0FBRyxRQUFRLENBQUE7QUFDeEIsTUFBTUMsY0FBYyxHQUFHLElBQUksQ0FBQzs7QUFFNUI7QUFDQSxNQUFNQyxZQUFZLENBQUM7QUFDZkMsRUFBQUEsV0FBVyxHQUFHO0FBQ1Y7SUFDQSxJQUFJLENBQUNDLEtBQUssR0FBRyxJQUFJLENBQUE7O0FBRWpCO0FBQ0EsSUFBQSxJQUFJLENBQUNDLEdBQUcsR0FBRyxJQUFJVixJQUFJLEVBQUUsQ0FBQTtBQUNyQixJQUFBLElBQUksQ0FBQ1csR0FBRyxHQUFHLElBQUlYLElBQUksRUFBRSxDQUFBO0FBQ3pCLEdBQUE7QUFDSixDQUFBOztBQUVBO0FBQ0E7QUFDQSxNQUFNWSxhQUFhLENBQUM7QUFDaEI7O0VBR0FKLFdBQVcsQ0FBQ0ssTUFBTSxFQUFFO0FBQUEsSUFBQSxJQUFBLENBRnBCQyxjQUFjLEdBQUEsS0FBQSxDQUFBLENBQUE7SUFHVixJQUFJLENBQUNELE1BQU0sR0FBR0EsTUFBTSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0UsSUFBSSxHQUFHLFVBQVUsQ0FBQTs7QUFFdEI7SUFDQSxJQUFJLENBQUNDLFdBQVcsR0FBRyxDQUFDLENBQUE7O0FBRXBCO0FBQ0EsSUFBQSxJQUFJLENBQUNDLFNBQVMsR0FBRyxJQUFJakIsSUFBSSxFQUFFLENBQUE7QUFDM0IsSUFBQSxJQUFJLENBQUNr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
