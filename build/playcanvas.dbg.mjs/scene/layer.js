/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { hashCode } from '../core/hash.js';
import { SORTMODE_MATERIALMESH, SORTMODE_BACK2FRONT, SHADER_FORWARD, BLEND_NONE, LIGHTTYPE_DIRECTIONAL, LAYER_FX, SORTMODE_NONE, SORTMODE_CUSTOM, SORTMODE_FRONT2BACK, SORTKEY_FORWARD } from './constants.js';
import { Material } from './materials/material.js';

let keyA, keyB, sortPos, sortDir;

function sortManual(drawCallA, drawCallB) {
  return drawCallA.drawOrder - drawCallB.drawOrder;
}

function sortMaterialMesh(drawCallA, drawCallB) {
  keyA = drawCallA._key[SORTKEY_FORWARD];
  keyB = drawCallB._key[SORTKEY_FORWARD];

  if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
    return drawCallB.mesh.id - drawCallA.mesh.id;
  }

  return keyB - keyA;
}

function sortBackToFront(drawCallA, drawCallB) {
  return drawCallB.zdist - drawCallA.zdist;
}

function sortFrontToBack(drawCallA, drawCallB) {
  return drawCallA.zdist - drawCallB.zdist;
}

const sortCallbacks = [null, sortManual, sortMaterialMesh, sortBackToFront, sortFrontToBack];

function sortLights(lightA, lightB) {
  return lightB.key - lightA.key;
}

let layerCounter = 0;

class VisibleInstanceList {
  constructor() {
    this.list = [];
    this.length = 0;
    this.done = false;
  }

}

class InstanceList {
  constructor() {
    this.opaqueMeshInstances = [];
    this.transparentMeshInstances = [];
    this.shadowCasters = [];
    this.visibleOpaque = [];
    this.visibleTransparent = [];
  }

  prepare(index) {
    if (!this.visibleOpaque[index]) {
      this.visibleOpaque[index] = new VisibleInstanceList();
    }

    if (!this.visibleTransparent[index]) {
      this.visibleTransparent[index] = new VisibleInstanceList();
    }

    this.visibleOpaque[index].done = false;
    this.visibleTransparent[index].done = false;
  }

  delete(index) {
    if (index < this.visibleOpaque.length) {
      this.visibleOpaque.splice(index, 1);
    }

    if (index < this.visibleTransparent.length) {
      this.visibleTransparent.splice(index, 1);
    }
  }

}

class Layer {
  constructor(options = {}) {
    if (options.id !== undefined) {
      this.id = options.id;
      layerCounter = Math.max(this.id + 1, layerCounter);
    } else {
      this.id = layerCounter++;
    }

    this.name = options.name;
    this._enabled = options.enabled === undefined ? true : options.enabled;
    this._refCounter = this._enabled ? 1 : 0;
    this.opaqueSortMode = options.opaqueSortMode === undefined ? SORTMODE_MATERIALMESH : options.opaqueSortMode;
    this.transparentSortMode = options.transparentSortMode === undefined ? SORTMODE_BACK2FRONT : options.transparentSortMode;

    if (options.renderTarget) {
      this.renderTarget = options.renderTarget;
    }

    this.shaderPass = options.shaderPass === undefined ? SHADER_FORWARD : options.shaderPass;
    this.passThrough = options.passThrough === undefined ? false : options.passThrough;
    this._clearColorBuffer = !!options.clearColorBuffer;
    this._clearDepthBuffer = !!options.clearDepthBuffer;
    this._clearStencilBuffer = !!options.clearStencilBuffer;
    this.onPreCull = options.onPreCull;
    this.onPreRender = options.onPreRender;
    this.onPreRenderOpaque = options.onPreRenderOpaque;
    this.onPreRenderTransparent = options.onPreRenderTransparent;
    this.onPostCull = options.onPostCull;
    this.onPostRender = options.onPostRender;
    this.onPostRenderOpaque = options.onPostRenderOpaque;
    this.onPostRenderTransparent = options.onPostRenderTransparent;
    this.onDrawCall = options.onDrawCall;
    this.onEnable = options.onEnable;
    this.onDisable = options.onDisable;

    if (this._enabled && this.onEnable) {
      this.onEnable();
    }

    this.layerReference = options.layerReference;
    this.instances = options.layerReference ? options.layerReference.instances : new InstanceList();
    this.cullingMask = options.cullingMask ? options.cullingMask : 0xFFFFFFFF;
    this.opaqueMeshInstances = this.instances.opaqueMeshInstances;
    this.transparentMeshInstances = this.instances.transparentMeshInstances;
    this.shadowCasters = this.instances.shadowCasters;
    this.customSortCallback = null;
    this.customCalculateSortValues = null;
    this._lights = [];
    this._lightsSet = new Set();
    this._clusteredLightsSet = new Set();
    this._splitLights = [[], [], []];
    this.cameras = [];
    this._dirty = false;
    this._dirtyLights = false;
    this._dirtyCameras = false;
    this._lightHash = 0;
    this._staticLightHash = 0;
    this._needsStaticPrepare = true;
    this._staticPrepareDone = false;
    this.skipRenderAfter = Number.MAX_VALUE;
    this._skipRenderCounter = 0;
    this._renderTime = 0;
    this._forwardDrawCalls = 0;
    this._shadowDrawCalls = 0;
    this._shaderVersion = -1;
    this._lightCube = null;
  }

  get hasClusteredLights() {
    return this._clusteredLightsSet.size > 0;
  }

  set renderTarget(rt) {
    this._renderTarget = rt;
    this._dirtyCameras = true;
  }

  get renderTarget() {
    return this._renderTarget;
  }

  set enabled(val) {
    if (val !== this._enabled) {
      this._enabled = val;

      if (val) {
        this.incrementCounter();
        if (this.onEnable) this.onEnable();
      } else {
        this.decrementCounter();
        if (this.onDisable) this.onDisable();
      }
    }
  }

  get enabled() {
    return this._enabled;
  }

  set clearColorBuffer(val) {
    this._clearColorBuffer = val;
    this._dirtyCameras = true;
  }

  get clearColorBuffer() {
    return this._clearColorBuffer;
  }

  set clearDepthBuffer(val) {
    this._clearDepthBuffer = val;
    this._dirtyCameras = true;
  }

  get clearDepthBuffer() {
    return this._clearDepthBuffer;
  }

  set clearStencilBuffer(val) {
    this._clearStencilBuffer = val;
    this._dirtyCameras = true;
  }

  get clearStencilBuffer() {
    return this._clearStencilBuffer;
  }

  get clusteredLightsSet() {
    return this._clusteredLightsSet;
  }

  incrementCounter() {
    if (this._refCounter === 0) {
      this._enabled = true;
      if (this.onEnable) this.onEnable();
    }

    this._refCounter++;
  }

  decrementCounter() {
    if (this._refCounter === 1) {
      this._enabled = false;
      if (this.onDisable) this.onDisable();
    } else if (this._refCounter === 0) {
      Debug.warn('Trying to decrement layer counter below 0');
      return;
    }

    this._refCounter--;
  }

  addMeshInstances(meshInstances, skipShadowCasters) {
    const sceneShaderVer = this._shaderVersion;
    const casters = this.shadowCasters;

    for (let i = 0; i < meshInstances.length; i++) {
      const m = meshInstances[i];
      const mat = m.material;
      const arr = mat.blendType === BLEND_NONE ? this.opaqueMeshInstances : this.transparentMeshInstances;

      if (this.opaqueMeshInstances.indexOf(m) < 0 && this.transparentMeshInstances.indexOf(m) < 0) {
        arr.push(m);
      }

      if (!skipShadowCasters && m.castShadow && casters.indexOf(m) < 0) casters.push(m);

      if (!this.passThrough && sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer) {
        if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
          mat.clearVariants();
        }

        mat._shaderVersion = sceneShaderVer;
      }
    }

    if (!this.passThrough) this._dirty = true;
  }

  removeMeshInstanceFromArray(m, arr) {
    let spliceOffset = -1;
    let spliceCount = 0;
    const len = arr.length;

    for (let j = 0; j < len; j++) {
      const drawCall = arr[j];

      if (drawCall === m) {
        spliceOffset = j;
        spliceCount = 1;
        break;
      }

      if (drawCall._staticSource === m) {
        if (spliceOffset < 0) spliceOffset = j;
        spliceCount++;
      } else if (spliceOffset >= 0) {
        break;
      }
    }

    if (spliceOffset >= 0) {
      arr.splice(spliceOffset, spliceCount);
    }
  }

  removeMeshInstances(meshInstances, skipShadowCasters) {
    const opaque = this.opaqueMeshInstances;
    const transparent = this.transparentMeshInstances;
    const casters = this.shadowCasters;

    for (let i = 0; i < meshInstances.length; i++) {
      const m = meshInstances[i];
      this.removeMeshInstanceFromArray(m, opaque);
      this.removeMeshInstanceFromArray(m, transparent);

      if (!skipShadowCasters) {
        const j = casters.indexOf(m);
        if (j >= 0) casters.splice(j, 1);
      }
    }

    this._dirty = true;
  }

  clearMeshInstances(skipShadowCasters) {
    if (this.opaqueMeshInstances.length === 0 && this.transparentMeshInstances.length === 0) {
      if (skipShadowCasters || this.shadowCasters.length === 0) return;
    }

    this.opaqueMeshInstances.length = 0;
    this.transparentMeshInstances.length = 0;
    if (!skipShadowCasters) this.shadowCasters.length = 0;
    if (!this.passThrough) this._dirty = true;
  }

  addLight(light) {
    const l = light.light;

    if (!this._lightsSet.has(l)) {
      this._lightsSet.add(l);

      if (l.type !== LIGHTTYPE_DIRECTIONAL) {
        this._clusteredLightsSet.add(l);
      }

      this._lights.push(l);

      this._dirtyLights = true;

      this._generateLightHash();
    }
  }

  removeLight(light) {
    const l = light.light;

    if (this._lightsSet.has(l)) {
      this._lightsSet.delete(l);

      if (l.type !== LIGHTTYPE_DIRECTIONAL) {
        this._clusteredLightsSet.delete(l);
      }

      this._lights.splice(this._lights.indexOf(l), 1);

      this._dirtyLights = true;

      this._generateLightHash();
    }
  }

  clearLights() {
    this._lightsSet.clear();

    this._clusteredLightsSet.clear();

    this._lights.length = 0;
    this._dirtyLights = true;
  }

  addShadowCasters(meshInstances) {
    const arr = this.shadowCasters;

    for (let i = 0; i < meshInstances.length; i++) {
      const m = meshInstances[i];
      if (!m.castShadow) continue;
      if (arr.indexOf(m) < 0) arr.push(m);
    }

    this._dirtyLights = true;
  }

  removeShadowCasters(meshInstances) {
    const arr = this.shadowCasters;

    for (let i = 0; i < meshInstances.length; i++) {
      const id = arr.indexOf(meshInstances[i]);
      if (id >= 0) arr.splice(id, 1);
    }

    this._dirtyLights = true;
  }

  _generateLightHash() {
    if (this._lights.length > 0) {
      this._lights.sort(sortLights);

      let str = '';
      let strStatic = '';

      for (let i = 0; i < this._lights.length; i++) {
        if (this._lights[i].isStatic) {
          strStatic += this._lights[i].key;
        } else {
          str += this._lights[i].key;
        }
      }

      if (str.length === 0) {
        this._lightHash = 0;
      } else {
        this._lightHash = hashCode(str);
      }

      if (strStatic.length === 0) {
        this._staticLightHash = 0;
      } else {
        this._staticLightHash = hashCode(strStatic);
      }
    } else {
      this._lightHash = 0;
      this._staticLightHash = 0;
    }
  }

  addCamera(camera) {
    if (this.cameras.indexOf(camera) >= 0) return;
    this.cameras.push(camera);
    this._dirtyCameras = true;
  }

  removeCamera(camera) {
    const index = this.cameras.indexOf(camera);

    if (index >= 0) {
      this.cameras.splice(index, 1);
      this._dirtyCameras = true;
      this.instances.delete(index);
    }
  }

  clearCameras() {
    this.cameras.length = 0;
    this._dirtyCameras = true;
  }

  _calculateSortDistances(drawCalls, drawCallsCount, camPos, camFwd) {
    for (let i = 0; i < drawCallsCount; i++) {
      const drawCall = drawCalls[i];
      if (drawCall.command) continue;
      if (drawCall.layer <= LAYER_FX) continue;

      if (drawCall.calculateSortDistance) {
        drawCall.zdist = drawCall.calculateSortDistance(drawCall, camPos, camFwd);
        continue;
      }

      const meshPos = drawCall.aabb.center;
      const tempx = meshPos.x - camPos.x;
      const tempy = meshPos.y - camPos.y;
      const tempz = meshPos.z - camPos.z;
      drawCall.zdist = tempx * camFwd.x + tempy * camFwd.y + tempz * camFwd.z;
    }
  }

  _sortVisible(transparent, cameraNode, cameraPass) {
    const objects = this.instances;
    const sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
    if (sortMode === SORTMODE_NONE) return;
    const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

    if (sortMode === SORTMODE_CUSTOM) {
      sortPos = cameraNode.getPosition();
      sortDir = cameraNode.forward;

      if (this.customCalculateSortValues) {
        this.customCalculateSortValues(visible.list, visible.length, sortPos, sortDir);
      }

      if (visible.list.length !== visible.length) {
        visible.list.length = visible.length;
      }

      if (this.customSortCallback) {
        visible.list.sort(this.customSortCallback);
      }
    } else {
      if (sortMode === SORTMODE_BACK2FRONT || sortMode === SORTMODE_FRONT2BACK) {
        sortPos = cameraNode.getPosition();
        sortDir = cameraNode.forward;

        this._calculateSortDistances(visible.list, visible.length, sortPos, sortDir);
      }

      if (visible.list.length !== visible.length) {
        visible.list.length = visible.length;
      }

      visible.list.sort(sortCallbacks[sortMode]);
    }
  }

}

export { Layer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9sYXllci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgaGFzaENvZGUgfSBmcm9tICcuLi9jb3JlL2hhc2guanMnO1xuXG5pbXBvcnQge1xuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBCTEVORF9OT05FLFxuICAgIExBWUVSX0ZYLFxuICAgIFNIQURFUl9GT1JXQVJELFxuICAgIFNPUlRLRVlfRk9SV0FSRCxcbiAgICBTT1JUTU9ERV9CQUNLMkZST05ULCBTT1JUTU9ERV9DVVNUT00sIFNPUlRNT0RFX0ZST05UMkJBQ0ssIFNPUlRNT0RFX01BVEVSSUFMTUVTSCwgU09SVE1PREVfTk9ORVxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9IENhbWVyYUNvbXBvbmVudCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2xpZ2h0L2NvbXBvbmVudC5qcycpLkxpZ2h0Q29tcG9uZW50fSBMaWdodENvbXBvbmVudCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vZ3JhcGgtbm9kZS5qcycpLkdyYXBoTm9kZX0gR3JhcGhOb2RlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9saWdodC5qcycpLkxpZ2h0fSBMaWdodCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZX0gTWVzaEluc3RhbmNlICovXG5cbmxldCBrZXlBLCBrZXlCLCBzb3J0UG9zLCBzb3J0RGlyO1xuXG5mdW5jdGlvbiBzb3J0TWFudWFsKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgcmV0dXJuIGRyYXdDYWxsQS5kcmF3T3JkZXIgLSBkcmF3Q2FsbEIuZHJhd09yZGVyO1xufVxuXG5mdW5jdGlvbiBzb3J0TWF0ZXJpYWxNZXNoKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAga2V5QSA9IGRyYXdDYWxsQS5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG4gICAga2V5QiA9IGRyYXdDYWxsQi5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG4gICAgaWYgKGtleUEgPT09IGtleUIgJiYgZHJhd0NhbGxBLm1lc2ggJiYgZHJhd0NhbGxCLm1lc2gpIHtcbiAgICAgICAgcmV0dXJuIGRyYXdDYWxsQi5tZXNoLmlkIC0gZHJhd0NhbGxBLm1lc2guaWQ7XG4gICAgfVxuICAgIHJldHVybiBrZXlCIC0ga2V5QTtcbn1cblxuZnVuY3Rpb24gc29ydEJhY2tUb0Zyb250KGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgcmV0dXJuIGRyYXdDYWxsQi56ZGlzdCAtIGRyYXdDYWxsQS56ZGlzdDtcbn1cblxuZnVuY3Rpb24gc29ydEZyb250VG9CYWNrKGRyYXdDYWxsQSwgZHJhd0NhbGxCKSB7XG4gICAgcmV0dXJuIGRyYXdDYWxsQS56ZGlzdCAtIGRyYXdDYWxsQi56ZGlzdDtcbn1cblxuY29uc3Qgc29ydENhbGxiYWNrcyA9IFtudWxsLCBzb3J0TWFudWFsLCBzb3J0TWF0ZXJpYWxNZXNoLCBzb3J0QmFja1RvRnJvbnQsIHNvcnRGcm9udFRvQmFja107XG5cbmZ1bmN0aW9uIHNvcnRMaWdodHMobGlnaHRBLCBsaWdodEIpIHtcbiAgICByZXR1cm4gbGlnaHRCLmtleSAtIGxpZ2h0QS5rZXk7XG59XG5cbi8vIExheWVyc1xubGV0IGxheWVyQ291bnRlciA9IDA7XG5cbmNsYXNzIFZpc2libGVJbnN0YW5jZUxpc3Qge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmxpc3QgPSBbXTtcbiAgICAgICAgdGhpcy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICB9XG59XG5cbmNsYXNzIEluc3RhbmNlTGlzdCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcyA9IFtdO1xuICAgICAgICB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyA9IFtdO1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc3RlcnMgPSBbXTtcblxuICAgICAgICAvLyBhcnJheXMgb2YgVmlzaWJsZUluc3RhbmNlTGlzdCBmb3IgZWFjaCBjYW1lcmEgb2YgdGhpcyBsYXllclxuICAgICAgICB0aGlzLnZpc2libGVPcGFxdWUgPSBbXTtcbiAgICAgICAgdGhpcy52aXNpYmxlVHJhbnNwYXJlbnQgPSBbXTtcbiAgICB9XG5cbiAgICAvLyBwcmVwYXJlIGZvciBjdWxsaW5nIG9mIGNhbWVyYSB3aXRoIHNwZWNpZmllZCBpbmRleFxuICAgIHByZXBhcmUoaW5kZXgpIHtcblxuICAgICAgICAvLyBtYWtlIHN1cmUgdmlzaWJpbGl0eSBsaXN0cyBhcmUgYWxsb2NhdGVkXG4gICAgICAgIGlmICghdGhpcy52aXNpYmxlT3BhcXVlW2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy52aXNpYmxlT3BhcXVlW2luZGV4XSA9IG5ldyBWaXNpYmxlSW5zdGFuY2VMaXN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMudmlzaWJsZVRyYW5zcGFyZW50W2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy52aXNpYmxlVHJhbnNwYXJlbnRbaW5kZXhdID0gbmV3IFZpc2libGVJbnN0YW5jZUxpc3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1hcmsgdGhlbSBhcyBub3QgcHJvY2Vzc2VkIHlldFxuICAgICAgICB0aGlzLnZpc2libGVPcGFxdWVbaW5kZXhdLmRvbmUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy52aXNpYmxlVHJhbnNwYXJlbnRbaW5kZXhdLmRvbmUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBkZWxldGUgZW50cnkgZm9yIGEgY2FtZXJhIHdpdGggc3BlY2lmaWVkIGluZGV4XG4gICAgZGVsZXRlKGluZGV4KSB7XG4gICAgICAgIGlmIChpbmRleCA8IHRoaXMudmlzaWJsZU9wYXF1ZS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMudmlzaWJsZU9wYXF1ZS5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpbmRleCA8IHRoaXMudmlzaWJsZVRyYW5zcGFyZW50Lmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy52aXNpYmxlVHJhbnNwYXJlbnQuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBBIExheWVyIHJlcHJlc2VudHMgYSByZW5kZXJhYmxlIHN1YnNldCBvZiB0aGUgc2NlbmUuIEl0IGNhbiBjb250YWluIGEgbGlzdCBvZiBtZXNoIGluc3RhbmNlcyxcbiAqIGxpZ2h0cyBhbmQgY2FtZXJhcywgdGhlaXIgcmVuZGVyIHNldHRpbmdzIGFuZCBhbHNvIGRlZmluZXMgY3VzdG9tIGNhbGxiYWNrcyBiZWZvcmUsIGFmdGVyIG9yXG4gKiBkdXJpbmcgcmVuZGVyaW5nLiBMYXllcnMgYXJlIG9yZ2FuaXplZCBpbnNpZGUge0BsaW5rIExheWVyQ29tcG9zaXRpb259IGluIGEgZGVzaXJlZCBvcmRlci5cbiAqL1xuY2xhc3MgTGF5ZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBMYXllciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gT2JqZWN0IGZvciBwYXNzaW5nIG9wdGlvbmFsIGFyZ3VtZW50cy4gVGhlc2UgYXJndW1lbnRzIGFyZSB0aGVcbiAgICAgKiBzYW1lIGFzIHByb3BlcnRpZXMgb2YgdGhlIExheWVyLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuXG4gICAgICAgIGlmIChvcHRpb25zLmlkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQSB1bmlxdWUgSUQgb2YgdGhlIGxheWVyLiBMYXllciBJRHMgYXJlIHN0b3JlZCBpbnNpZGUge0BsaW5rIE1vZGVsQ29tcG9uZW50I2xheWVyc30sXG4gICAgICAgICAgICAgKiB7QGxpbmsgUmVuZGVyQ29tcG9uZW50I2xheWVyc30sIHtAbGluayBDYW1lcmFDb21wb25lbnQjbGF5ZXJzfSxcbiAgICAgICAgICAgICAqIHtAbGluayBMaWdodENvbXBvbmVudCNsYXllcnN9IGFuZCB7QGxpbmsgRWxlbWVudENvbXBvbmVudCNsYXllcnN9IGluc3RlYWQgb2YgbmFtZXMuXG4gICAgICAgICAgICAgKiBDYW4gYmUgdXNlZCBpbiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNnZXRMYXllckJ5SWR9LlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuaWQgPSBvcHRpb25zLmlkO1xuICAgICAgICAgICAgbGF5ZXJDb3VudGVyID0gTWF0aC5tYXgodGhpcy5pZCArIDEsIGxheWVyQ291bnRlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gbGF5ZXJDb3VudGVyKys7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogTmFtZSBvZiB0aGUgbGF5ZXIuIENhbiBiZSB1c2VkIGluIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2dldExheWVyQnlOYW1lfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gb3B0aW9ucy5lbmFibGVkID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0aW9ucy5lbmFibGVkO1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3JlZkNvdW50ZXIgPSB0aGlzLl9lbmFibGVkID8gMSA6IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERlZmluZXMgdGhlIG1ldGhvZCB1c2VkIGZvciBzb3J0aW5nIG9wYXF1ZSAodGhhdCBpcywgbm90IHNlbWktdHJhbnNwYXJlbnQpIG1lc2hcbiAgICAgICAgICogaW5zdGFuY2VzIGJlZm9yZSByZW5kZXJpbmcuIENhbiBiZTpcbiAgICAgICAgICpcbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfTk9ORX1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfTUFOVUFMfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9NQVRFUklBTE1FU0h9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX0JBQ0syRlJPTlR9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX0ZST05UMkJBQ0t9XG4gICAgICAgICAqXG4gICAgICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBTT1JUTU9ERV9NQVRFUklBTE1FU0h9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vcGFxdWVTb3J0TW9kZSA9IG9wdGlvbnMub3BhcXVlU29ydE1vZGUgPT09IHVuZGVmaW5lZCA/IFNPUlRNT0RFX01BVEVSSUFMTUVTSCA6IG9wdGlvbnMub3BhcXVlU29ydE1vZGU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERlZmluZXMgdGhlIG1ldGhvZCB1c2VkIGZvciBzb3J0aW5nIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMgYmVmb3JlIHJlbmRlcmluZy4gQ2FuIGJlOlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9OT05FfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX01BVEVSSUFMTUVTSH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfQkFDSzJGUk9OVH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfRlJPTlQyQkFDS31cbiAgICAgICAgICpcbiAgICAgICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFNPUlRNT0RFX0JBQ0syRlJPTlR9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50cmFuc3BhcmVudFNvcnRNb2RlID0gb3B0aW9ucy50cmFuc3BhcmVudFNvcnRNb2RlID09PSB1bmRlZmluZWQgPyBTT1JUTU9ERV9CQUNLMkZST05UIDogb3B0aW9ucy50cmFuc3BhcmVudFNvcnRNb2RlO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnJlbmRlclRhcmdldCkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSBvcHRpb25zLnJlbmRlclRhcmdldDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIHR5cGUgb2Ygc2hhZGVyIHRvIHVzZSBkdXJpbmcgcmVuZGVyaW5nLiBQb3NzaWJsZSB2YWx1ZXMgYXJlOlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIHtAbGluayBTSEFERVJfRk9SV0FSRH1cbiAgICAgICAgICogLSB7QGxpbmsgU0hBREVSX0ZPUldBUkRIRFJ9XG4gICAgICAgICAqIC0ge0BsaW5rIFNIQURFUl9ERVBUSH1cbiAgICAgICAgICogLSBZb3VyIG93biBjdXN0b20gdmFsdWUuIFNob3VsZCBiZSBpbiAxOSAtIDMxIHJhbmdlLiBVc2Uge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb25VcGRhdGVTaGFkZXJ9XG4gICAgICAgICAqIHRvIGFwcGx5IHNoYWRlciBtb2RpZmljYXRpb25zIGJhc2VkIG9uIHRoaXMgdmFsdWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBTSEFERVJfRk9SV0FSRH0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNoYWRlclBhc3MgPSBvcHRpb25zLnNoYWRlclBhc3MgPT09IHVuZGVmaW5lZCA/IFNIQURFUl9GT1JXQVJEIDogb3B0aW9ucy5zaGFkZXJQYXNzO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUZWxscyB0aGF0IHRoaXMgbGF5ZXIgaXMgc2ltcGxlIGFuZCBuZWVkcyB0byBqdXN0IHJlbmRlciBhIGJ1bmNoIG9mIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgICAqIHdpdGhvdXQgbGlnaHRpbmcsIHNraW5uaW5nIGFuZCBtb3JwaGluZyAoZmFzdGVyKS4gVXNlZCBmb3IgVUkgYW5kIEdpem1vIGxheWVycyAodGhlXG4gICAgICAgICAqIGxheWVyIGRvZXNuJ3QgdXNlIGxpZ2h0cywgc2hhZG93cywgY3VsbGluZywgZXRjKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBhc3NUaHJvdWdoID0gb3B0aW9ucy5wYXNzVGhyb3VnaCA9PT0gdW5kZWZpbmVkID8gZmFsc2UgOiBvcHRpb25zLnBhc3NUaHJvdWdoO1xuXG4gICAgICAgIC8vIGNsZWFyIGZsYWdzXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3JCdWZmZXIgPSAhIW9wdGlvbnMuY2xlYXJDb2xvckJ1ZmZlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoQnVmZmVyID0gISFvcHRpb25zLmNsZWFyRGVwdGhCdWZmZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyID0gISFvcHRpb25zLmNsZWFyU3RlbmNpbEJ1ZmZlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGJlZm9yZSB2aXNpYmlsaXR5IGN1bGxpbmcgaXMgcGVyZm9ybWVkIGZvciB0aGlzIGxheWVyLlxuICAgICAgICAgKiBVc2VmdWwsIGZvciBleGFtcGxlLCBpZiB5b3Ugd2FudCB0byBtb2RpZnkgY2FtZXJhIHByb2plY3Rpb24gd2hpbGUgc3RpbGwgdXNpbmcgdGhlIHNhbWVcbiAgICAgICAgICogY2FtZXJhIGFuZCBtYWtlIGZydXN0dW0gY3VsbGluZyB3b3JrIGNvcnJlY3RseSB3aXRoIGl0IChzZWVcbiAgICAgICAgICoge0BsaW5rIENhbWVyYUNvbXBvbmVudCNjYWxjdWxhdGVUcmFuc2Zvcm19IGFuZCB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2NhbGN1bGF0ZVByb2plY3Rpb259KS5cbiAgICAgICAgICogVGhpcyBmdW5jdGlvbiB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsXG4gICAgICAgICAqIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc30gd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUHJlQ3VsbCA9IG9wdGlvbnMub25QcmVDdWxsO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGJlZm9yZSB0aGlzIGxheWVyIGlzIHJlbmRlcmVkLiBVc2VmdWwsIGZvciBleGFtcGxlLCBmb3JcbiAgICAgICAgICogcmVhY3Rpbmcgb24gc2NyZWVuIHNpemUgY2hhbmdlcy4gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgYmVmb3JlIHRoZSBmaXJzdCBvY2N1cnJlbmNlIG9mXG4gICAgICAgICAqIHRoaXMgbGF5ZXIgaW4ge0BsaW5rIExheWVyQ29tcG9zaXRpb259LiBJdCB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5XG4gICAgICAgICAqIGFyZ3VtZW50LiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXBcbiAgICAgICAgICoge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc30gd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUHJlUmVuZGVyID0gb3B0aW9ucy5vblByZVJlbmRlcjtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBiZWZvcmUgb3BhcXVlIG1lc2ggaW5zdGFuY2VzIChub3Qgc2VtaS10cmFuc3BhcmVudCkgaW5cbiAgICAgICAgICogdGhpcyBsYXllciBhcmUgcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC5cbiAgICAgICAgICogWW91IGNhbiBnZXQgdGhlIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9XG4gICAgICAgICAqIHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblByZVJlbmRlck9wYXF1ZSA9IG9wdGlvbnMub25QcmVSZW5kZXJPcGFxdWU7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMgaW4gdGhpcyBsYXllciBhcmVcbiAgICAgICAgICogcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC4gWW91IGNhbiBnZXQgdGhlXG4gICAgICAgICAqIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9IHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblByZVJlbmRlclRyYW5zcGFyZW50ID0gb3B0aW9ucy5vblByZVJlbmRlclRyYW5zcGFyZW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdmlzaWJpbGl0eSBjdWxsaW5nIGlzIHBlcmZvcm1lZCBmb3IgdGhpcyBsYXllci5cbiAgICAgICAgICogVXNlZnVsIGZvciByZXZlcnRpbmcgY2hhbmdlcyBkb25lIGluIHtAbGluayBMYXllciNvblByZUN1bGx9IGFuZCBkZXRlcm1pbmluZyBmaW5hbCBtZXNoXG4gICAgICAgICAqIGluc3RhbmNlIHZpc2liaWxpdHkgKHNlZSB7QGxpbmsgTWVzaEluc3RhbmNlI3Zpc2libGVUaGlzRnJhbWV9KS4gVGhpcyBmdW5jdGlvbiB3aWxsXG4gICAgICAgICAqIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5XG4gICAgICAgICAqIGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc30gd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUG9zdEN1bGwgPSBvcHRpb25zLm9uUG9zdEN1bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhpcyBsYXllciBpcyByZW5kZXJlZC4gVXNlZnVsIHRvIHJldmVydCBjaGFuZ2VzXG4gICAgICAgICAqIG1hZGUgaW4ge0BsaW5rIExheWVyI29uUHJlUmVuZGVyfS4gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgYWZ0ZXIgdGhlIGxhc3Qgb2NjdXJyZW5jZSBvZiB0aGlzXG4gICAgICAgICAqIGxheWVyIGluIHtAbGluayBMYXllckNvbXBvc2l0aW9ufS4gSXQgd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC5cbiAgICAgICAgICogWW91IGNhbiBnZXQgdGhlIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9XG4gICAgICAgICAqIHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblBvc3RSZW5kZXIgPSBvcHRpb25zLm9uUG9zdFJlbmRlcjtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciBvcGFxdWUgbWVzaCBpbnN0YW5jZXMgKG5vdCBzZW1pLXRyYW5zcGFyZW50KSBpblxuICAgICAgICAgKiB0aGlzIGxheWVyIGFyZSByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LlxuICAgICAgICAgKiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc31cbiAgICAgICAgICogd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUG9zdFJlbmRlck9wYXF1ZSA9IG9wdGlvbnMub25Qb3N0UmVuZGVyT3BhcXVlO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMgaW4gdGhpcyBsYXllciBhcmVcbiAgICAgICAgICogcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC4gWW91IGNhbiBnZXQgdGhlXG4gICAgICAgICAqIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9IHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblBvc3RSZW5kZXJUcmFuc3BhcmVudCA9IG9wdGlvbnMub25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBiZWZvcmUgZXZlcnkgbWVzaCBpbnN0YW5jZSBpbiB0aGlzIGxheWVyIGlzIHJlbmRlcmVkLiBJdFxuICAgICAgICAgKiBpcyBub3QgcmVjb21tZW5kZWQgdG8gc2V0IHRoaXMgZnVuY3Rpb24gd2hlbiByZW5kZXJpbmcgbWFueSBvYmplY3RzIGV2ZXJ5IGZyYW1lIGR1ZSB0b1xuICAgICAgICAgKiBwZXJmb3JtYW5jZSByZWFzb25zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uRHJhd0NhbGwgPSBvcHRpb25zLm9uRHJhd0NhbGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhlIGxheWVyIGhhcyBiZWVuIGVuYWJsZWQuIFRoaXMgaGFwcGVucyB3aGVuOlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIFRoZSBsYXllciBpcyBjcmVhdGVkIHdpdGgge0BsaW5rIExheWVyI2VuYWJsZWR9IHNldCB0byB0cnVlICh3aGljaCBpcyB0aGUgZGVmYXVsdCB2YWx1ZSkuXG4gICAgICAgICAqIC0ge0BsaW5rIExheWVyI2VuYWJsZWR9IHdhcyBjaGFuZ2VkIGZyb20gZmFsc2UgdG8gdHJ1ZVxuICAgICAgICAgKiAtIHtAbGluayBMYXllciNpbmNyZW1lbnRDb3VudGVyfSB3YXMgY2FsbGVkIGFuZCBpbmNyZW1lbnRlZCB0aGUgY291bnRlciBhYm92ZSB6ZXJvLlxuICAgICAgICAgKlxuICAgICAgICAgKiBVc2VmdWwgZm9yIGFsbG9jYXRpbmcgcmVzb3VyY2VzIHRoaXMgbGF5ZXIgd2lsbCB1c2UgKGUuZy4gY3JlYXRpbmcgcmVuZGVyIHRhcmdldHMpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uRW5hYmxlID0gb3B0aW9ucy5vbkVuYWJsZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgbGF5ZXIgaGFzIGJlZW4gZGlzYWJsZWQuIFRoaXMgaGFwcGVucyB3aGVuOlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIHtAbGluayBMYXllciNlbmFibGVkfSB3YXMgY2hhbmdlZCBmcm9tIHRydWUgdG8gZmFsc2VcbiAgICAgICAgICogLSB7QGxpbmsgTGF5ZXIjZGVjcmVtZW50Q291bnRlcn0gd2FzIGNhbGxlZCBhbmQgc2V0IHRoZSBjb3VudGVyIHRvIHplcm8uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25EaXNhYmxlID0gb3B0aW9ucy5vbkRpc2FibGU7XG5cbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZWQgJiYgdGhpcy5vbkVuYWJsZSkge1xuICAgICAgICAgICAgdGhpcy5vbkVuYWJsZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIE1ha2UgdGhpcyBsYXllciByZW5kZXIgdGhlIHNhbWUgbWVzaCBpbnN0YW5jZXMgdGhhdCBhbm90aGVyIGxheWVyIGRvZXMgaW5zdGVhZCBvZiBoYXZpbmdcbiAgICAgICAgICogaXRzIG93biBtZXNoIGluc3RhbmNlIGxpc3QuIEJvdGggbGF5ZXJzIG11c3Qgc2hhcmUgY2FtZXJhcy4gRnJ1c3R1bSBjdWxsaW5nIGlzIG9ubHlcbiAgICAgICAgICogcGVyZm9ybWVkIGZvciBvbmUgbGF5ZXIuIFVzZWZ1bCBmb3IgcmVuZGVyaW5nIG11bHRpcGxlIHBhc3NlcyB1c2luZyBkaWZmZXJlbnQgc2hhZGVycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0xheWVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sYXllclJlZmVyZW5jZSA9IG9wdGlvbnMubGF5ZXJSZWZlcmVuY2U7IC8vIHNob3VsZCB1c2UgdGhlIHNhbWUgY2FtZXJhXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtJbnN0YW5jZUxpc3R9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaW5zdGFuY2VzID0gb3B0aW9ucy5sYXllclJlZmVyZW5jZSA/IG9wdGlvbnMubGF5ZXJSZWZlcmVuY2UuaW5zdGFuY2VzIDogbmV3IEluc3RhbmNlTGlzdCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBWaXNpYmlsaXR5IGJpdCBtYXNrIHRoYXQgaW50ZXJhY3RzIHdpdGgge0BsaW5rIE1lc2hJbnN0YW5jZSNtYXNrfS4gRXNwZWNpYWxseSB1c2VmdWxcbiAgICAgICAgICogd2hlbiBjb21iaW5lZCB3aXRoIGxheWVyUmVmZXJlbmNlLCBhbGxvd2luZyBmb3IgdGhlIGZpbHRlcmluZyBvZiBzb21lIG9iamVjdHMsIHdoaWxlXG4gICAgICAgICAqIHNoYXJpbmcgdGhlaXIgbGlzdCBhbmQgY3VsbGluZy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY3VsbGluZ01hc2sgPSBvcHRpb25zLmN1bGxpbmdNYXNrID8gb3B0aW9ucy5jdWxsaW5nTWFzayA6IDB4RkZGRkZGRkY7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtNZXNoSW5zdGFuY2VbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vcGFxdWVNZXNoSW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXMub3BhcXVlTWVzaEluc3RhbmNlcztcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtNZXNoSW5zdGFuY2VbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TWVzaEluc3RhbmNlW119XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2hhZG93Q2FzdGVycyA9IHRoaXMuaW5zdGFuY2VzLnNoYWRvd0Nhc3RlcnM7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbnxudWxsfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN1c3RvbVNvcnRDYWxsYmFjayA9IG51bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb258bnVsbH1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdXN0b21DYWxjdWxhdGVTb3J0VmFsdWVzID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0xpZ2h0W119XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9saWdodHMgPSBbXTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtTZXQ8TGlnaHQ+fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbGlnaHRzU2V0ID0gbmV3IFNldCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgb2YgbGlnaHQgdXNlZCBieSBjbHVzdGVyZWQgbGlnaHRpbmcgKG9tbmkgYW5kIHNwb3QsIGJ1dCBubyBkaXJlY3Rpb25hbCkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTZXQ8TGlnaHQ+fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRzU2V0ID0gbmV3IFNldCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMaWdodHMgc2VwYXJhdGVkIGJ5IGxpZ2h0IHR5cGUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtMaWdodFtdW119XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NwbGl0TGlnaHRzID0gW1tdLCBbXSwgW11dO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Q2FtZXJhQ29tcG9uZW50W119XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY2FtZXJhcyA9IFtdO1xuXG4gICAgICAgIHRoaXMuX2RpcnR5ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2xpZ2h0SGFzaCA9IDA7XG4gICAgICAgIHRoaXMuX3N0YXRpY0xpZ2h0SGFzaCA9IDA7XG4gICAgICAgIHRoaXMuX25lZWRzU3RhdGljUHJlcGFyZSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3N0YXRpY1ByZXBhcmVEb25lID0gZmFsc2U7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnNraXBSZW5kZXJBZnRlciA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgICAgIHRoaXMuX3NraXBSZW5kZXJDb3VudGVyID0gMDtcblxuICAgICAgICB0aGlzLl9yZW5kZXJUaW1lID0gMDtcbiAgICAgICAgdGhpcy5fZm9yd2FyZERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMuX3NoYWRvd0RyYXdDYWxscyA9IDA7ICAvLyBkZXByZWNhdGVkLCBub3QgdXNlZnVsIG9uIGEgbGF5ZXIgYW55bW9yZSwgY291bGQgYmUgbW92ZWQgdG8gY2FtZXJhXG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuX3NoYWRlclZlcnNpb24gPSAtMTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0Zsb2F0MzJBcnJheX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbGlnaHRDdWJlID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBsYXllciBjb250YWlucyBvbW5pIG9yIHNwb3QgbGlnaHRzXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IGhhc0NsdXN0ZXJlZExpZ2h0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldC5zaXplID4gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7UmVuZGVyVGFyZ2V0fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXQgcmVuZGVyVGFyZ2V0KHJ0KSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7UmVuZGVyVGFyZ2V0fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0ID0gcnQ7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgZ2V0IHJlbmRlclRhcmdldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclRhcmdldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgdGhlIGxheWVyLiBEaXNhYmxlZCBsYXllcnMgYXJlIHNraXBwZWQuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZW5hYmxlZCh2YWwpIHtcbiAgICAgICAgaWYgKHZhbCAhPT0gdGhpcy5fZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHZhbDtcbiAgICAgICAgICAgIGlmICh2YWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vbkVuYWJsZSkgdGhpcy5vbkVuYWJsZSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vbkRpc2FibGUpIHRoaXMub25EaXNhYmxlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlIGNhbWVyYSB3aWxsIGNsZWFyIHRoZSBjb2xvciBidWZmZXIgd2hlbiBpdCByZW5kZXJzIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2xlYXJDb2xvckJ1ZmZlcih2YWwpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJDb2xvckJ1ZmZlciA9IHZhbDtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJDb2xvckJ1ZmZlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyQ29sb3JCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlIGNhbWVyYSB3aWxsIGNsZWFyIHRoZSBkZXB0aCBidWZmZXIgd2hlbiBpdCByZW5kZXJzIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2xlYXJEZXB0aEJ1ZmZlcih2YWwpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlciA9IHZhbDtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJEZXB0aEJ1ZmZlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyRGVwdGhCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlIGNhbWVyYSB3aWxsIGNsZWFyIHRoZSBzdGVuY2lsIGJ1ZmZlciB3aGVuIGl0IHJlbmRlcnMgdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbGVhclN0ZW5jaWxCdWZmZXIodmFsKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbEJ1ZmZlciA9IHZhbDtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2xlYXJTdGVuY2lsQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgbGlnaHRzIHVzZWQgYnkgY2x1c3RlcmVkIGxpZ2h0aW5nIGluIGEgc2V0LlxuICAgICAqXG4gICAgICogQHR5cGUge1NldDxMaWdodD59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBjbHVzdGVyZWRMaWdodHNTZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5jcmVtZW50cyB0aGUgdXNhZ2UgY291bnRlciBvZiB0aGlzIGxheWVyLiBCeSBkZWZhdWx0LCBsYXllcnMgYXJlIGNyZWF0ZWQgd2l0aCBjb3VudGVyIHNldFxuICAgICAqIHRvIDEgKGlmIHtAbGluayBMYXllci5lbmFibGVkfSBpcyB0cnVlKSBvciAwIChpZiBpdCB3YXMgZmFsc2UpLiBJbmNyZW1lbnRpbmcgdGhlIGNvdW50ZXJcbiAgICAgKiBmcm9tIDAgdG8gMSB3aWxsIGVuYWJsZSB0aGUgbGF5ZXIgYW5kIGNhbGwge0BsaW5rIExheWVyLm9uRW5hYmxlfS4gVXNlIHRoaXMgZnVuY3Rpb24gdG9cbiAgICAgKiBcInN1YnNjcmliZVwiIG11bHRpcGxlIGVmZmVjdHMgdG8gdGhlIHNhbWUgbGF5ZXIuIEZvciBleGFtcGxlLCBpZiB0aGUgbGF5ZXIgaXMgdXNlZCB0byByZW5kZXJcbiAgICAgKiBhIHJlZmxlY3Rpb24gdGV4dHVyZSB3aGljaCBpcyB1c2VkIGJ5IDIgbWlycm9ycywgdGhlbiBlYWNoIG1pcnJvciBjYW4gY2FsbCB0aGlzIGZ1bmN0aW9uXG4gICAgICogd2hlbiB2aXNpYmxlIGFuZCB7QGxpbmsgTGF5ZXIuZGVjcmVtZW50Q291bnRlcn0gaWYgaW52aXNpYmxlLiBJbiBzdWNoIGNhc2UgdGhlIHJlZmxlY3Rpb25cbiAgICAgKiB0ZXh0dXJlIHdvbid0IGJlIHVwZGF0ZWQsIHdoZW4gdGhlcmUgaXMgbm90aGluZyB0byB1c2UgaXQsIHNhdmluZyBwZXJmb3JtYW5jZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbmNyZW1lbnRDb3VudGVyKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVmQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHRydWU7XG4gICAgICAgICAgICBpZiAodGhpcy5vbkVuYWJsZSkgdGhpcy5vbkVuYWJsZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3JlZkNvdW50ZXIrKztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWNyZW1lbnRzIHRoZSB1c2FnZSBjb3VudGVyIG9mIHRoaXMgbGF5ZXIuIERlY3JlbWVudGluZyB0aGUgY291bnRlciBmcm9tIDEgdG8gMCB3aWxsXG4gICAgICogZGlzYWJsZSB0aGUgbGF5ZXIgYW5kIGNhbGwge0BsaW5rIExheWVyLm9uRGlzYWJsZX0uIFNlZSB7QGxpbmsgTGF5ZXIjaW5jcmVtZW50Q291bnRlcn0gZm9yXG4gICAgICogbW9yZSBkZXRhaWxzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlY3JlbWVudENvdW50ZXIoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWZDb3VudGVyID09PSAxKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAodGhpcy5vbkRpc2FibGUpIHRoaXMub25EaXNhYmxlKCk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9yZWZDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKCdUcnlpbmcgdG8gZGVjcmVtZW50IGxheWVyIGNvdW50ZXIgYmVsb3cgMCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3JlZkNvdW50ZXItLTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGFuIGFycmF5IG9mIG1lc2ggaW5zdGFuY2VzIHRvIHRoaXMgbGF5ZXIuXG4gICAgICoxXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gQXJyYXkgb2Yge0BsaW5rIE1lc2hJbnN0YW5jZX0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbc2tpcFNoYWRvd0Nhc3RlcnNdIC0gU2V0IGl0IHRvIHRydWUgaWYgeW91IGRvbid0IHdhbnQgdGhlc2UgbWVzaCBpbnN0YW5jZXNcbiAgICAgKiB0byBjYXN0IHNoYWRvd3MgaW4gdGhpcyBsYXllci5cbiAgICAgKi9cbiAgICBhZGRNZXNoSW5zdGFuY2VzKG1lc2hJbnN0YW5jZXMsIHNraXBTaGFkb3dDYXN0ZXJzKSB7XG4gICAgICAgIGNvbnN0IHNjZW5lU2hhZGVyVmVyID0gdGhpcy5fc2hhZGVyVmVyc2lvbjtcblxuICAgICAgICBjb25zdCBjYXN0ZXJzID0gdGhpcy5zaGFkb3dDYXN0ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG0gPSBtZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWF0ID0gbS5tYXRlcmlhbDtcbiAgICAgICAgICAgIGNvbnN0IGFyciA9IG1hdC5ibGVuZFR5cGUgPT09IEJMRU5EX05PTkUgPyB0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXMgOiB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgLy8gdGVzdCBmb3IgbWVzaEluc3RhbmNlIGluIGJvdGggYXJyYXlzLCBhcyBtYXRlcmlhbCdzIGFscGhhIGNvdWxkIGhhdmUgY2hhbmdlZCBzaW5jZSBMYXllckNvbXBvc2l0aW9uJ3MgdXBkYXRlIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgICAgIC8vIFRPRE8gLSBmb2xsb3dpbmcgdXNlcyBvZiBpbmRleE9mIGFyZSBleHBlbnNpdmUsIHRvIGFkZCA1MDAwIG1lc2hJbnN0YW5jZXMgY29zdHMgYWJvdXQgNzBtcyBvbiBNYWMuIENvbnNpZGVyIHVzaW5nIFNldC5cbiAgICAgICAgICAgIGlmICh0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXMuaW5kZXhPZihtKSA8IDAgJiYgdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMuaW5kZXhPZihtKSA8IDApIHtcbiAgICAgICAgICAgICAgICBhcnIucHVzaChtKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFza2lwU2hhZG93Q2FzdGVycyAmJiBtLmNhc3RTaGFkb3cgJiYgY2FzdGVycy5pbmRleE9mKG0pIDwgMCkgY2FzdGVycy5wdXNoKG0pO1xuXG4gICAgICAgICAgICAvLyBjbGVhciBvbGQgc2hhZGVyIHZhcmlhbnRzIGlmIG5lY2Vzc2FyeVxuICAgICAgICAgICAgaWYgKCF0aGlzLnBhc3NUaHJvdWdoICYmIHNjZW5lU2hhZGVyVmVyID49IDAgJiYgbWF0Ll9zaGFkZXJWZXJzaW9uICE9PSBzY2VuZVNoYWRlclZlcikge1xuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCB0aGlzIGZvciBtYXRlcmlhbHMgbm90IHVzaW5nIHZhcmlhbnRzXG4gICAgICAgICAgICAgICAgaWYgKG1hdC5nZXRTaGFkZXJWYXJpYW50ICE9PSBNYXRlcmlhbC5wcm90b3R5cGUuZ2V0U2hhZGVyVmFyaWFudCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciBzaGFkZXIgdmFyaWFudHMgb24gdGhlIG1hdGVyaWFsIGFuZCBhbHNvIG9uIG1lc2ggaW5zdGFuY2VzIHRoYXQgdXNlIGl0XG4gICAgICAgICAgICAgICAgICAgIG1hdC5jbGVhclZhcmlhbnRzKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1hdC5fc2hhZGVyVmVyc2lvbiA9IHNjZW5lU2hhZGVyVmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5wYXNzVGhyb3VnaCkgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIGZ1bmN0aW9uIHRvIHJlbW92ZSBhIG1lc2ggaW5zdGFuY2UgZnJvbSBhbiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlfSBtIC0gTWVzaCBpbnN0YW5jZSB0byByZW1vdmUuXG4gICAgICogQHBhcmFtIHtNZXNoSW5zdGFuY2VbXX0gYXJyIC0gQXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMgdG8gcmVtb3ZlIGZyb20uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZW1vdmVNZXNoSW5zdGFuY2VGcm9tQXJyYXkobSwgYXJyKSB7XG4gICAgICAgIGxldCBzcGxpY2VPZmZzZXQgPSAtMTtcbiAgICAgICAgbGV0IHNwbGljZUNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbGVuID0gYXJyLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGorKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBhcnJbal07XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwgPT09IG0pIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VPZmZzZXQgPSBqO1xuICAgICAgICAgICAgICAgIHNwbGljZUNvdW50ID0gMTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5fc3RhdGljU291cmNlID09PSBtKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNwbGljZU9mZnNldCA8IDApIHNwbGljZU9mZnNldCA9IGo7XG4gICAgICAgICAgICAgICAgc3BsaWNlQ291bnQrKztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3BsaWNlT2Zmc2V0ID49IDApIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcGxpY2VPZmZzZXQgPj0gMCkge1xuICAgICAgICAgICAgYXJyLnNwbGljZShzcGxpY2VPZmZzZXQsIHNwbGljZUNvdW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgbXVsdGlwbGUgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNZXNoSW5zdGFuY2VbXX0gbWVzaEluc3RhbmNlcyAtIEFycmF5IG9mIHtAbGluayBNZXNoSW5zdGFuY2V9LiBJZiB0aGV5IHdlcmUgYWRkZWQgdG9cbiAgICAgKiB0aGlzIGxheWVyLCB0aGV5IHdpbGwgYmUgcmVtb3ZlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtza2lwU2hhZG93Q2FzdGVyc10gLSBTZXQgaXQgdG8gdHJ1ZSBpZiB5b3Ugd2FudCB0byBzdGlsbCBjYXN0IHNoYWRvd3MgZnJvbVxuICAgICAqIHJlbW92ZWQgbWVzaCBpbnN0YW5jZXMgb3IgaWYgdGhleSBuZXZlciBkaWQgY2FzdCBzaGFkb3dzIGJlZm9yZS5cbiAgICAgKi9cbiAgICByZW1vdmVNZXNoSW5zdGFuY2VzKG1lc2hJbnN0YW5jZXMsIHNraXBTaGFkb3dDYXN0ZXJzKSB7XG5cbiAgICAgICAgY29uc3Qgb3BhcXVlID0gdGhpcy5vcGFxdWVNZXNoSW5zdGFuY2VzO1xuICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IHRoaXMudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzO1xuICAgICAgICBjb25zdCBjYXN0ZXJzID0gdGhpcy5zaGFkb3dDYXN0ZXJzO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbSA9IG1lc2hJbnN0YW5jZXNbaV07XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBmcm9tIG9wYXF1ZVxuICAgICAgICAgICAgdGhpcy5yZW1vdmVNZXNoSW5zdGFuY2VGcm9tQXJyYXkobSwgb3BhcXVlKTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gdHJhbnNwYXJlbnRcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTWVzaEluc3RhbmNlRnJvbUFycmF5KG0sIHRyYW5zcGFyZW50KTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gY2FzdGVyc1xuICAgICAgICAgICAgaWYgKCFza2lwU2hhZG93Q2FzdGVycykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGogPSBjYXN0ZXJzLmluZGV4T2YobSk7XG4gICAgICAgICAgICAgICAgaWYgKGogPj0gMClcbiAgICAgICAgICAgICAgICAgICAgY2FzdGVycy5zcGxpY2UoaiwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbGwgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbc2tpcFNoYWRvd0Nhc3RlcnNdIC0gU2V0IGl0IHRvIHRydWUgaWYgeW91IHdhbnQgdG8gc3RpbGwgY2FzdCBzaGFkb3dzIGZyb21cbiAgICAgKiByZW1vdmVkIG1lc2ggaW5zdGFuY2VzIG9yIGlmIHRoZXkgbmV2ZXIgZGlkIGNhc3Qgc2hhZG93cyBiZWZvcmUuXG4gICAgICovXG4gICAgY2xlYXJNZXNoSW5zdGFuY2VzKHNraXBTaGFkb3dDYXN0ZXJzKSB7XG4gICAgICAgIGlmICh0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXMubGVuZ3RoID09PSAwICYmIHRoaXMudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgaWYgKHNraXBTaGFkb3dDYXN0ZXJzIHx8IHRoaXMuc2hhZG93Q2FzdGVycy5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMubGVuZ3RoID0gMDtcbiAgICAgICAgaWYgKCFza2lwU2hhZG93Q2FzdGVycykgdGhpcy5zaGFkb3dDYXN0ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIGlmICghdGhpcy5wYXNzVGhyb3VnaCkgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBsaWdodCB0byB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtMaWdodENvbXBvbmVudH0gbGlnaHQgLSBBIHtAbGluayBMaWdodENvbXBvbmVudH0uXG4gICAgICovXG4gICAgYWRkTGlnaHQobGlnaHQpIHtcblxuICAgICAgICAvLyBpZiB0aGUgbGlnaHQgaXMgbm90IGluIHRoZSBsYXllciBhbHJlYWR5XG4gICAgICAgIGNvbnN0IGwgPSBsaWdodC5saWdodDtcbiAgICAgICAgaWYgKCF0aGlzLl9saWdodHNTZXQuaGFzKGwpKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodHNTZXQuYWRkKGwpO1xuXG4gICAgICAgICAgICBpZiAobC50eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQuYWRkKGwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9saWdodHMucHVzaChsKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2dlbmVyYXRlTGlnaHRIYXNoKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgbGlnaHQgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtMaWdodENvbXBvbmVudH0gbGlnaHQgLSBBIHtAbGluayBMaWdodENvbXBvbmVudH0uXG4gICAgICovXG4gICAgcmVtb3ZlTGlnaHQobGlnaHQpIHtcblxuICAgICAgICBjb25zdCBsID0gbGlnaHQubGlnaHQ7XG4gICAgICAgIGlmICh0aGlzLl9saWdodHNTZXQuaGFzKGwpKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodHNTZXQuZGVsZXRlKGwpO1xuXG4gICAgICAgICAgICBpZiAobC50eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQuZGVsZXRlKGwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9saWdodHMuc3BsaWNlKHRoaXMuX2xpZ2h0cy5pbmRleE9mKGwpLCAxKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2dlbmVyYXRlTGlnaHRIYXNoKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBsaWdodHMgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqL1xuICAgIGNsZWFyTGlnaHRzKCkge1xuICAgICAgICB0aGlzLl9saWdodHNTZXQuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRzU2V0LmNsZWFyKCk7XG4gICAgICAgIHRoaXMuX2xpZ2h0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhbiBhcnJheSBvZiBtZXNoIGluc3RhbmNlcyB0byB0aGlzIGxheWVyLCBidXQgb25seSBhcyBzaGFkb3cgY2FzdGVycyAodGhleSB3aWxsIG5vdCBiZVxuICAgICAqIHJlbmRlcmVkIGFueXdoZXJlLCBidXQgb25seSBjYXN0IHNoYWRvd3Mgb24gb3RoZXIgb2JqZWN0cykuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gQXJyYXkgb2Yge0BsaW5rIE1lc2hJbnN0YW5jZX0uXG4gICAgICovXG4gICAgYWRkU2hhZG93Q2FzdGVycyhtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IGFyciA9IHRoaXMuc2hhZG93Q2FzdGVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtID0gbWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgIGlmICghbS5jYXN0U2hhZG93KSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChhcnIuaW5kZXhPZihtKSA8IDApIGFyci5wdXNoKG0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIG11bHRpcGxlIG1lc2ggaW5zdGFuY2VzIGZyb20gdGhlIHNoYWRvdyBjYXN0ZXJzIGxpc3Qgb2YgdGhpcyBsYXllciwgbWVhbmluZyB0aGV5XG4gICAgICogd2lsbCBzdG9wIGNhc3Rpbmcgc2hhZG93cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlW119IG1lc2hJbnN0YW5jZXMgLSBBcnJheSBvZiB7QGxpbmsgTWVzaEluc3RhbmNlfS4gSWYgdGhleSB3ZXJlIGFkZGVkIHRvXG4gICAgICogdGhpcyBsYXllciwgdGhleSB3aWxsIGJlIHJlbW92ZWQuXG4gICAgICovXG4gICAgcmVtb3ZlU2hhZG93Q2FzdGVycyhtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IGFyciA9IHRoaXMuc2hhZG93Q2FzdGVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGFyci5pbmRleE9mKG1lc2hJbnN0YW5jZXNbaV0pO1xuICAgICAgICAgICAgaWYgKGlkID49IDApIGFyci5zcGxpY2UoaWQsIDEpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZ2VuZXJhdGVMaWdodEhhc2goKSB7XG4gICAgICAgIC8vIGdlbmVyYXRlIGhhc2ggdG8gY2hlY2sgaWYgbGF5ZXJzIGhhdmUgdGhlIHNhbWUgc2V0IG9mIHN0YXRpYyBsaWdodHNcbiAgICAgICAgLy8gb3JkZXIgb2YgbGlnaHRzIHNob3VsZG4ndCBtYXR0ZXJcbiAgICAgICAgaWYgKHRoaXMuX2xpZ2h0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodHMuc29ydChzb3J0TGlnaHRzKTtcbiAgICAgICAgICAgIGxldCBzdHIgPSAnJztcbiAgICAgICAgICAgIGxldCBzdHJTdGF0aWMgPSAnJztcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9saWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fbGlnaHRzW2ldLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0clN0YXRpYyArPSB0aGlzLl9saWdodHNbaV0ua2V5O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSB0aGlzLl9saWdodHNbaV0ua2V5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0ci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9saWdodEhhc2ggPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9saWdodEhhc2ggPSBoYXNoQ29kZShzdHIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3RyU3RhdGljLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXRpY0xpZ2h0SGFzaCA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXRpY0xpZ2h0SGFzaCA9IGhhc2hDb2RlKHN0clN0YXRpYyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0SGFzaCA9IDA7XG4gICAgICAgICAgICB0aGlzLl9zdGF0aWNMaWdodEhhc2ggPSAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGNhbWVyYSB0byB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtDYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIEEge0BsaW5rIENhbWVyYUNvbXBvbmVudH0uXG4gICAgICovXG4gICAgYWRkQ2FtZXJhKGNhbWVyYSkge1xuICAgICAgICBpZiAodGhpcy5jYW1lcmFzLmluZGV4T2YoY2FtZXJhKSA+PSAwKSByZXR1cm47XG4gICAgICAgIHRoaXMuY2FtZXJhcy5wdXNoKGNhbWVyYSk7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGNhbWVyYSBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0NhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gQSB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50fS5cbiAgICAgKi9cbiAgICByZW1vdmVDYW1lcmEoY2FtZXJhKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5jYW1lcmFzLmluZGV4T2YoY2FtZXJhKTtcbiAgICAgICAgaWYgKGluZGV4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSB2aXNpYmxlIGxpc3QgZm9yIHRoaXMgY2FtZXJhXG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlcy5kZWxldGUoaW5kZXgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbGwgY2FtZXJhcyBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICovXG4gICAgY2xlYXJDYW1lcmFzKCkge1xuICAgICAgICB0aGlzLmNhbWVyYXMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZVtdfSBkcmF3Q2FsbHMgLSBBcnJheSBvZiBtZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHJhd0NhbGxzQ291bnQgLSBOdW1iZXIgb2YgbWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtWZWMzfSBjYW1Qb3MgLSBDYW1lcmEgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtWZWMzfSBjYW1Gd2QgLSBDYW1lcmEgZm9yd2FyZCB2ZWN0b3IuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2FsY3VsYXRlU29ydERpc3RhbmNlcyhkcmF3Q2FsbHMsIGRyYXdDYWxsc0NvdW50LCBjYW1Qb3MsIGNhbUZ3ZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmNvbW1hbmQpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmxheWVyIDw9IExBWUVSX0ZYKSBjb250aW51ZTsgLy8gT25seSBhbHBoYSBzb3J0IG1lc2ggaW5zdGFuY2VzIGluIHRoZSBtYWluIHdvcmxkIChiYWNrd2FyZHMgY29tcClcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jYWxjdWxhdGVTb3J0RGlzdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC56ZGlzdCA9IGRyYXdDYWxsLmNhbGN1bGF0ZVNvcnREaXN0YW5jZShkcmF3Q2FsbCwgY2FtUG9zLCBjYW1Gd2QpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbWVzaFBvcyA9IGRyYXdDYWxsLmFhYmIuY2VudGVyO1xuICAgICAgICAgICAgY29uc3QgdGVtcHggPSBtZXNoUG9zLnggLSBjYW1Qb3MueDtcbiAgICAgICAgICAgIGNvbnN0IHRlbXB5ID0gbWVzaFBvcy55IC0gY2FtUG9zLnk7XG4gICAgICAgICAgICBjb25zdCB0ZW1weiA9IG1lc2hQb3MueiAtIGNhbVBvcy56O1xuICAgICAgICAgICAgZHJhd0NhbGwuemRpc3QgPSB0ZW1weCAqIGNhbUZ3ZC54ICsgdGVtcHkgKiBjYW1Gd2QueSArIHRlbXB6ICogY2FtRndkLno7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHRyYW5zcGFyZW50IC0gVHJ1ZSBpZiB0cmFuc3BhcmVudCBzb3J0aW5nIHNob3VsZCBiZSB1c2VkLlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBjYW1lcmFOb2RlIC0gR3JhcGggbm9kZSB0aGF0IHRoZSBjYW1lcmEgaXMgYXR0YWNoZWQgdG8uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNhbWVyYVBhc3MgLSBDYW1lcmEgcGFzcy5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3NvcnRWaXNpYmxlKHRyYW5zcGFyZW50LCBjYW1lcmFOb2RlLCBjYW1lcmFQYXNzKSB7XG4gICAgICAgIGNvbnN0IG9iamVjdHMgPSB0aGlzLmluc3RhbmNlcztcbiAgICAgICAgY29uc3Qgc29ydE1vZGUgPSB0cmFuc3BhcmVudCA/IHRoaXMudHJhbnNwYXJlbnRTb3J0TW9kZSA6IHRoaXMub3BhcXVlU29ydE1vZGU7XG4gICAgICAgIGlmIChzb3J0TW9kZSA9PT0gU09SVE1PREVfTk9ORSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHZpc2libGUgPSB0cmFuc3BhcmVudCA/IG9iamVjdHMudmlzaWJsZVRyYW5zcGFyZW50W2NhbWVyYVBhc3NdIDogb2JqZWN0cy52aXNpYmxlT3BhcXVlW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgIGlmIChzb3J0TW9kZSA9PT0gU09SVE1PREVfQ1VTVE9NKSB7XG4gICAgICAgICAgICBzb3J0UG9zID0gY2FtZXJhTm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgc29ydERpciA9IGNhbWVyYU5vZGUuZm9yd2FyZDtcbiAgICAgICAgICAgIGlmICh0aGlzLmN1c3RvbUNhbGN1bGF0ZVNvcnRWYWx1ZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmN1c3RvbUNhbGN1bGF0ZVNvcnRWYWx1ZXModmlzaWJsZS5saXN0LCB2aXNpYmxlLmxlbmd0aCwgc29ydFBvcywgc29ydERpcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2aXNpYmxlLmxpc3QubGVuZ3RoICE9PSB2aXNpYmxlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZpc2libGUubGlzdC5sZW5ndGggPSB2aXNpYmxlLmxlbmd0aDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuY3VzdG9tU29ydENhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgdmlzaWJsZS5saXN0LnNvcnQodGhpcy5jdXN0b21Tb3J0Q2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHNvcnRNb2RlID09PSBTT1JUTU9ERV9CQUNLMkZST05UIHx8IHNvcnRNb2RlID09PSBTT1JUTU9ERV9GUk9OVDJCQUNLKSB7XG4gICAgICAgICAgICAgICAgc29ydFBvcyA9IGNhbWVyYU5vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgICAgICBzb3J0RGlyID0gY2FtZXJhTm9kZS5mb3J3YXJkO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZXModmlzaWJsZS5saXN0LCB2aXNpYmxlLmxlbmd0aCwgc29ydFBvcywgc29ydERpcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2aXNpYmxlLmxpc3QubGVuZ3RoICE9PSB2aXNpYmxlLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHZpc2libGUubGlzdC5sZW5ndGggPSB2aXNpYmxlLmxlbmd0aDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmlzaWJsZS5saXN0LnNvcnQoc29ydENhbGxiYWNrc1tzb3J0TW9kZV0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBMYXllciB9O1xuIl0sIm5hbWVzIjpbImtleUEiLCJrZXlCIiwic29ydFBvcyIsInNvcnREaXIiLCJzb3J0TWFudWFsIiwiZHJhd0NhbGxBIiwiZHJhd0NhbGxCIiwiZHJhd09yZGVyIiwic29ydE1hdGVyaWFsTWVzaCIsIl9rZXkiLCJTT1JUS0VZX0ZPUldBUkQiLCJtZXNoIiwiaWQiLCJzb3J0QmFja1RvRnJvbnQiLCJ6ZGlzdCIsInNvcnRGcm9udFRvQmFjayIsInNvcnRDYWxsYmFja3MiLCJzb3J0TGlnaHRzIiwibGlnaHRBIiwibGlnaHRCIiwia2V5IiwibGF5ZXJDb3VudGVyIiwiVmlzaWJsZUluc3RhbmNlTGlzdCIsImNvbnN0cnVjdG9yIiwibGlzdCIsImxlbmd0aCIsImRvbmUiLCJJbnN0YW5jZUxpc3QiLCJvcGFxdWVNZXNoSW5zdGFuY2VzIiwidHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzIiwic2hhZG93Q2FzdGVycyIsInZpc2libGVPcGFxdWUiLCJ2aXNpYmxlVHJhbnNwYXJlbnQiLCJwcmVwYXJlIiwiaW5kZXgiLCJkZWxldGUiLCJzcGxpY2UiLCJMYXllciIsIm9wdGlvbnMiLCJ1bmRlZmluZWQiLCJNYXRoIiwibWF4IiwibmFtZSIsIl9lbmFibGVkIiwiZW5hYmxlZCIsIl9yZWZDb3VudGVyIiwib3BhcXVlU29ydE1vZGUiLCJTT1JUTU9ERV9NQVRFUklBTE1FU0giLCJ0cmFuc3BhcmVudFNvcnRNb2RlIiwiU09SVE1PREVfQkFDSzJGUk9OVCIsInJlbmRlclRhcmdldCIsInNoYWRlclBhc3MiLCJTSEFERVJfRk9SV0FSRCIsInBhc3NUaHJvdWdoIiwiX2NsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckNvbG9yQnVmZmVyIiwiX2NsZWFyRGVwdGhCdWZmZXIiLCJjbGVhckRlcHRoQnVmZmVyIiwiX2NsZWFyU3RlbmNpbEJ1ZmZlciIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsIm9uUHJlQ3VsbCIsIm9uUHJlUmVuZGVyIiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblByZVJlbmRlclRyYW5zcGFyZW50Iiwib25Qb3N0Q3VsbCIsIm9uUG9zdFJlbmRlciIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsIm9uUG9zdFJlbmRlclRyYW5zcGFyZW50Iiwib25EcmF3Q2FsbCIsIm9uRW5hYmxlIiwib25EaXNhYmxlIiwibGF5ZXJSZWZlcmVuY2UiLCJpbnN0YW5jZXMiLCJjdWxsaW5nTWFzayIsImN1c3RvbVNvcnRDYWxsYmFjayIsImN1c3RvbUNhbGN1bGF0ZVNvcnRWYWx1ZXMiLCJfbGlnaHRzIiwiX2xpZ2h0c1NldCIsIlNldCIsIl9jbHVzdGVyZWRMaWdodHNTZXQiLCJfc3BsaXRMaWdodHMiLCJjYW1lcmFzIiwiX2RpcnR5IiwiX2RpcnR5TGlnaHRzIiwiX2RpcnR5Q2FtZXJhcyIsIl9saWdodEhhc2giLCJfc3RhdGljTGlnaHRIYXNoIiwiX25lZWRzU3RhdGljUHJlcGFyZSIsIl9zdGF0aWNQcmVwYXJlRG9uZSIsInNraXBSZW5kZXJBZnRlciIsIk51bWJlciIsIk1BWF9WQUxVRSIsIl9za2lwUmVuZGVyQ291bnRlciIsIl9yZW5kZXJUaW1lIiwiX2ZvcndhcmREcmF3Q2FsbHMiLCJfc2hhZG93RHJhd0NhbGxzIiwiX3NoYWRlclZlcnNpb24iLCJfbGlnaHRDdWJlIiwiaGFzQ2x1c3RlcmVkTGlnaHRzIiwic2l6ZSIsInJ0IiwiX3JlbmRlclRhcmdldCIsInZhbCIsImluY3JlbWVudENvdW50ZXIiLCJkZWNyZW1lbnRDb3VudGVyIiwiY2x1c3RlcmVkTGlnaHRzU2V0IiwiRGVidWciLCJ3YXJuIiwiYWRkTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZXMiLCJza2lwU2hhZG93Q2FzdGVycyIsInNjZW5lU2hhZGVyVmVyIiwiY2FzdGVycyIsImkiLCJtIiwibWF0IiwibWF0ZXJpYWwiLCJhcnIiLCJibGVuZFR5cGUiLCJCTEVORF9OT05FIiwiaW5kZXhPZiIsInB1c2giLCJjYXN0U2hhZG93IiwiZ2V0U2hhZGVyVmFyaWFudCIsIk1hdGVyaWFsIiwicHJvdG90eXBlIiwiY2xlYXJWYXJpYW50cyIsInJlbW92ZU1lc2hJbnN0YW5jZUZyb21BcnJheSIsInNwbGljZU9mZnNldCIsInNwbGljZUNvdW50IiwibGVuIiwiaiIsImRyYXdDYWxsIiwiX3N0YXRpY1NvdXJjZSIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJvcGFxdWUiLCJ0cmFuc3BhcmVudCIsImNsZWFyTWVzaEluc3RhbmNlcyIsImFkZExpZ2h0IiwibGlnaHQiLCJsIiwiaGFzIiwiYWRkIiwidHlwZSIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIl9nZW5lcmF0ZUxpZ2h0SGFzaCIsInJlbW92ZUxpZ2h0IiwiY2xlYXJMaWdodHMiLCJjbGVhciIsImFkZFNoYWRvd0Nhc3RlcnMiLCJyZW1vdmVTaGFkb3dDYXN0ZXJzIiwic29ydCIsInN0ciIsInN0clN0YXRpYyIsImlzU3RhdGljIiwiaGFzaENvZGUiLCJhZGRDYW1lcmEiLCJjYW1lcmEiLCJyZW1vdmVDYW1lcmEiLCJjbGVhckNhbWVyYXMiLCJfY2FsY3VsYXRlU29ydERpc3RhbmNlcyIsImRyYXdDYWxscyIsImRyYXdDYWxsc0NvdW50IiwiY2FtUG9zIiwiY2FtRndkIiwiY29tbWFuZCIsImxheWVyIiwiTEFZRVJfRlgiLCJjYWxjdWxhdGVTb3J0RGlzdGFuY2UiLCJtZXNoUG9zIiwiYWFiYiIsImNlbnRlciIsInRlbXB4IiwieCIsInRlbXB5IiwieSIsInRlbXB6IiwieiIsIl9zb3J0VmlzaWJsZSIsImNhbWVyYU5vZGUiLCJjYW1lcmFQYXNzIiwib2JqZWN0cyIsInNvcnRNb2RlIiwiU09SVE1PREVfTk9ORSIsInZpc2libGUiLCJTT1JUTU9ERV9DVVNUT00iLCJnZXRQb3NpdGlvbiIsImZvcndhcmQiLCJTT1JUTU9ERV9GUk9OVDJCQUNLIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBbUJBLElBQUlBLElBQUosRUFBVUMsSUFBVixFQUFnQkMsT0FBaEIsRUFBeUJDLE9BQXpCLENBQUE7O0FBRUEsU0FBU0MsVUFBVCxDQUFvQkMsU0FBcEIsRUFBK0JDLFNBQS9CLEVBQTBDO0FBQ3RDLEVBQUEsT0FBT0QsU0FBUyxDQUFDRSxTQUFWLEdBQXNCRCxTQUFTLENBQUNDLFNBQXZDLENBQUE7QUFDSCxDQUFBOztBQUVELFNBQVNDLGdCQUFULENBQTBCSCxTQUExQixFQUFxQ0MsU0FBckMsRUFBZ0Q7QUFDNUNOLEVBQUFBLElBQUksR0FBR0ssU0FBUyxDQUFDSSxJQUFWLENBQWVDLGVBQWYsQ0FBUCxDQUFBO0FBQ0FULEVBQUFBLElBQUksR0FBR0ssU0FBUyxDQUFDRyxJQUFWLENBQWVDLGVBQWYsQ0FBUCxDQUFBOztFQUNBLElBQUlWLElBQUksS0FBS0MsSUFBVCxJQUFpQkksU0FBUyxDQUFDTSxJQUEzQixJQUFtQ0wsU0FBUyxDQUFDSyxJQUFqRCxFQUF1RDtJQUNuRCxPQUFPTCxTQUFT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
