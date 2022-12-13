/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
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
      this._lights.push(l);
      this._dirtyLights = true;
      this._generateLightHash();
    }
    if (l.type !== LIGHTTYPE_DIRECTIONAL) {
      this._clusteredLightsSet.add(l);
    }
  }

  removeLight(light) {
    const l = light.light;
    if (this._lightsSet.has(l)) {
      this._lightsSet.delete(l);
      this._lights.splice(this._lights.indexOf(l), 1);
      this._dirtyLights = true;
      this._generateLightHash();
    }
    if (l.type !== LIGHTTYPE_DIRECTIONAL) {
      this._clusteredLightsSet.delete(l);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9sYXllci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgaGFzaENvZGUgfSBmcm9tICcuLi9jb3JlL2hhc2guanMnO1xuXG5pbXBvcnQge1xuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBCTEVORF9OT05FLFxuICAgIExBWUVSX0ZYLFxuICAgIFNIQURFUl9GT1JXQVJELFxuICAgIFNPUlRLRVlfRk9SV0FSRCxcbiAgICBTT1JUTU9ERV9CQUNLMkZST05ULCBTT1JUTU9ERV9DVVNUT00sIFNPUlRNT0RFX0ZST05UMkJBQ0ssIFNPUlRNT0RFX01BVEVSSUFMTUVTSCwgU09SVE1PREVfTk9ORVxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcblxubGV0IGtleUEsIGtleUIsIHNvcnRQb3MsIHNvcnREaXI7XG5cbmZ1bmN0aW9uIHNvcnRNYW51YWwoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxBLmRyYXdPcmRlciAtIGRyYXdDYWxsQi5kcmF3T3JkZXI7XG59XG5cbmZ1bmN0aW9uIHNvcnRNYXRlcmlhbE1lc2goZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICBrZXlBID0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICBrZXlCID0gZHJhd0NhbGxCLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICBpZiAoa2V5QSA9PT0ga2V5QiAmJiBkcmF3Q2FsbEEubWVzaCAmJiBkcmF3Q2FsbEIubWVzaCkge1xuICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICB9XG4gICAgcmV0dXJuIGtleUIgLSBrZXlBO1xufVxuXG5mdW5jdGlvbiBzb3J0QmFja1RvRnJvbnQoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxCLnpkaXN0IC0gZHJhd0NhbGxBLnpkaXN0O1xufVxuXG5mdW5jdGlvbiBzb3J0RnJvbnRUb0JhY2soZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxBLnpkaXN0IC0gZHJhd0NhbGxCLnpkaXN0O1xufVxuXG5jb25zdCBzb3J0Q2FsbGJhY2tzID0gW251bGwsIHNvcnRNYW51YWwsIHNvcnRNYXRlcmlhbE1lc2gsIHNvcnRCYWNrVG9Gcm9udCwgc29ydEZyb250VG9CYWNrXTtcblxuZnVuY3Rpb24gc29ydExpZ2h0cyhsaWdodEEsIGxpZ2h0Qikge1xuICAgIHJldHVybiBsaWdodEIua2V5IC0gbGlnaHRBLmtleTtcbn1cblxuLy8gTGF5ZXJzXG5sZXQgbGF5ZXJDb3VudGVyID0gMDtcblxuY2xhc3MgVmlzaWJsZUluc3RhbmNlTGlzdCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubGlzdCA9IFtdO1xuICAgICAgICB0aGlzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgIH1cbn1cblxuY2xhc3MgSW5zdGFuY2VMaXN0IHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5vcGFxdWVNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgIHRoaXMudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzdGVycyA9IFtdO1xuXG4gICAgICAgIC8vIGFycmF5cyBvZiBWaXNpYmxlSW5zdGFuY2VMaXN0IGZvciBlYWNoIGNhbWVyYSBvZiB0aGlzIGxheWVyXG4gICAgICAgIHRoaXMudmlzaWJsZU9wYXF1ZSA9IFtdO1xuICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudCA9IFtdO1xuICAgIH1cblxuICAgIC8vIHByZXBhcmUgZm9yIGN1bGxpbmcgb2YgY2FtZXJhIHdpdGggc3BlY2lmaWVkIGluZGV4XG4gICAgcHJlcGFyZShpbmRleCkge1xuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSB2aXNpYmlsaXR5IGxpc3RzIGFyZSBhbGxvY2F0ZWRcbiAgICAgICAgaWYgKCF0aGlzLnZpc2libGVPcGFxdWVbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLnZpc2libGVPcGFxdWVbaW5kZXhdID0gbmV3IFZpc2libGVJbnN0YW5jZUxpc3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy52aXNpYmxlVHJhbnNwYXJlbnRbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudFtpbmRleF0gPSBuZXcgVmlzaWJsZUluc3RhbmNlTGlzdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFyayB0aGVtIGFzIG5vdCBwcm9jZXNzZWQgeWV0XG4gICAgICAgIHRoaXMudmlzaWJsZU9wYXF1ZVtpbmRleF0uZG9uZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudFtpbmRleF0uZG9uZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIGRlbGV0ZSBlbnRyeSBmb3IgYSBjYW1lcmEgd2l0aCBzcGVjaWZpZWQgaW5kZXhcbiAgICBkZWxldGUoaW5kZXgpIHtcbiAgICAgICAgaWYgKGluZGV4IDwgdGhpcy52aXNpYmxlT3BhcXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy52aXNpYmxlT3BhcXVlLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGV4IDwgdGhpcy52aXNpYmxlVHJhbnNwYXJlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudC5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIEEgTGF5ZXIgcmVwcmVzZW50cyBhIHJlbmRlcmFibGUgc3Vic2V0IG9mIHRoZSBzY2VuZS4gSXQgY2FuIGNvbnRhaW4gYSBsaXN0IG9mIG1lc2ggaW5zdGFuY2VzLFxuICogbGlnaHRzIGFuZCBjYW1lcmFzLCB0aGVpciByZW5kZXIgc2V0dGluZ3MgYW5kIGFsc28gZGVmaW5lcyBjdXN0b20gY2FsbGJhY2tzIGJlZm9yZSwgYWZ0ZXIgb3JcbiAqIGR1cmluZyByZW5kZXJpbmcuIExheWVycyBhcmUgb3JnYW5pemVkIGluc2lkZSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0gaW4gYSBkZXNpcmVkIG9yZGVyLlxuICovXG5jbGFzcyBMYXllciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IExheWVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBPYmplY3QgZm9yIHBhc3Npbmcgb3B0aW9uYWwgYXJndW1lbnRzLiBUaGVzZSBhcmd1bWVudHMgYXJlIHRoZVxuICAgICAqIHNhbWUgYXMgcHJvcGVydGllcyBvZiB0aGUgTGF5ZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBBIHVuaXF1ZSBJRCBvZiB0aGUgbGF5ZXIuIExheWVyIElEcyBhcmUgc3RvcmVkIGluc2lkZSB7QGxpbmsgTW9kZWxDb21wb25lbnQjbGF5ZXJzfSxcbiAgICAgICAgICAgICAqIHtAbGluayBSZW5kZXJDb21wb25lbnQjbGF5ZXJzfSwge0BsaW5rIENhbWVyYUNvbXBvbmVudCNsYXllcnN9LFxuICAgICAgICAgICAgICoge0BsaW5rIExpZ2h0Q29tcG9uZW50I2xheWVyc30gYW5kIHtAbGluayBFbGVtZW50Q29tcG9uZW50I2xheWVyc30gaW5zdGVhZCBvZiBuYW1lcy5cbiAgICAgICAgICAgICAqIENhbiBiZSB1c2VkIGluIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2dldExheWVyQnlJZH0uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5pZCA9IG9wdGlvbnMuaWQ7XG4gICAgICAgICAgICBsYXllckNvdW50ZXIgPSBNYXRoLm1heCh0aGlzLmlkICsgMSwgbGF5ZXJDb3VudGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBsYXllckNvdW50ZXIrKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBOYW1lIG9mIHRoZSBsYXllci4gQ2FuIGJlIHVzZWQgaW4ge0BsaW5rIExheWVyQ29tcG9zaXRpb24jZ2V0TGF5ZXJCeU5hbWV9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSBvcHRpb25zLmVuYWJsZWQgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBvcHRpb25zLmVuYWJsZWQ7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcmVmQ291bnRlciA9IHRoaXMuX2VuYWJsZWQgPyAxIDogMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmaW5lcyB0aGUgbWV0aG9kIHVzZWQgZm9yIHNvcnRpbmcgb3BhcXVlICh0aGF0IGlzLCBub3Qgc2VtaS10cmFuc3BhcmVudCkgbWVzaFxuICAgICAgICAgKiBpbnN0YW5jZXMgYmVmb3JlIHJlbmRlcmluZy4gQ2FuIGJlOlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9OT05FfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX01BVEVSSUFMTUVTSH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfQkFDSzJGUk9OVH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfRlJPTlQyQkFDS31cbiAgICAgICAgICpcbiAgICAgICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFNPUlRNT0RFX01BVEVSSUFMTUVTSH0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9wYXF1ZVNvcnRNb2RlID0gb3B0aW9ucy5vcGFxdWVTb3J0TW9kZSA9PT0gdW5kZWZpbmVkID8gU09SVE1PREVfTUFURVJJQUxNRVNIIDogb3B0aW9ucy5vcGFxdWVTb3J0TW9kZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmaW5lcyB0aGUgbWV0aG9kIHVzZWQgZm9yIHNvcnRpbmcgc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcyBiZWZvcmUgcmVuZGVyaW5nLiBDYW4gYmU6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX05PTkV9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX01BTlVBTH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9CQUNLMkZST05UfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9GUk9OVDJCQUNLfVxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgU09SVE1PREVfQkFDSzJGUk9OVH0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRyYW5zcGFyZW50U29ydE1vZGUgPSBvcHRpb25zLnRyYW5zcGFyZW50U29ydE1vZGUgPT09IHVuZGVmaW5lZCA/IFNPUlRNT0RFX0JBQ0syRlJPTlQgOiBvcHRpb25zLnRyYW5zcGFyZW50U29ydE1vZGU7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IG9wdGlvbnMucmVuZGVyVGFyZ2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEEgdHlwZSBvZiBzaGFkZXIgdG8gdXNlIGR1cmluZyByZW5kZXJpbmcuIFBvc3NpYmxlIHZhbHVlcyBhcmU6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIFNIQURFUl9GT1JXQVJEfVxuICAgICAgICAgKiAtIHtAbGluayBTSEFERVJfRk9SV0FSREhEUn1cbiAgICAgICAgICogLSB7QGxpbmsgU0hBREVSX0RFUFRIfVxuICAgICAgICAgKiAtIFlvdXIgb3duIGN1c3RvbSB2YWx1ZS4gU2hvdWxkIGJlIGluIDE5IC0gMzEgcmFuZ2UuIFVzZSB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNvblVwZGF0ZVNoYWRlcn1cbiAgICAgICAgICogdG8gYXBwbHkgc2hhZGVyIG1vZGlmaWNhdGlvbnMgYmFzZWQgb24gdGhpcyB2YWx1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFNIQURFUl9GT1JXQVJEfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2hhZGVyUGFzcyA9IG9wdGlvbnMuc2hhZGVyUGFzcyA9PT0gdW5kZWZpbmVkID8gU0hBREVSX0ZPUldBUkQgOiBvcHRpb25zLnNoYWRlclBhc3M7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRlbGxzIHRoYXQgdGhpcyBsYXllciBpcyBzaW1wbGUgYW5kIG5lZWRzIHRvIGp1c3QgcmVuZGVyIGEgYnVuY2ggb2YgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICogd2l0aG91dCBsaWdodGluZywgc2tpbm5pbmcgYW5kIG1vcnBoaW5nIChmYXN0ZXIpLiBVc2VkIGZvciBVSSBhbmQgR2l6bW8gbGF5ZXJzICh0aGVcbiAgICAgICAgICogbGF5ZXIgZG9lc24ndCB1c2UgbGlnaHRzLCBzaGFkb3dzLCBjdWxsaW5nLCBldGMpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucGFzc1Rocm91Z2ggPSBvcHRpb25zLnBhc3NUaHJvdWdoID09PSB1bmRlZmluZWQgPyBmYWxzZSA6IG9wdGlvbnMucGFzc1Rocm91Z2g7XG5cbiAgICAgICAgLy8gY2xlYXIgZmxhZ3NcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2xlYXJDb2xvckJ1ZmZlciA9ICEhb3B0aW9ucy5jbGVhckNvbG9yQnVmZmVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsZWFyRGVwdGhCdWZmZXIgPSAhIW9wdGlvbnMuY2xlYXJEZXB0aEJ1ZmZlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jbGVhclN0ZW5jaWxCdWZmZXIgPSAhIW9wdGlvbnMuY2xlYXJTdGVuY2lsQnVmZmVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIHZpc2liaWxpdHkgY3VsbGluZyBpcyBwZXJmb3JtZWQgZm9yIHRoaXMgbGF5ZXIuXG4gICAgICAgICAqIFVzZWZ1bCwgZm9yIGV4YW1wbGUsIGlmIHlvdSB3YW50IHRvIG1vZGlmeSBjYW1lcmEgcHJvamVjdGlvbiB3aGlsZSBzdGlsbCB1c2luZyB0aGUgc2FtZVxuICAgICAgICAgKiBjYW1lcmEgYW5kIG1ha2UgZnJ1c3R1bSBjdWxsaW5nIHdvcmsgY29ycmVjdGx5IHdpdGggaXQgKHNlZVxuICAgICAgICAgKiB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2NhbGN1bGF0ZVRyYW5zZm9ybX0gYW5kIHtAbGluayBDYW1lcmFDb21wb25lbnQjY2FsY3VsYXRlUHJvamVjdGlvbn0pLlxuICAgICAgICAgKiBUaGlzIGZ1bmN0aW9uIHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWxcbiAgICAgICAgICogY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfSB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25QcmVDdWxsID0gb3B0aW9ucy5vblByZUN1bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIHRoaXMgbGF5ZXIgaXMgcmVuZGVyZWQuIFVzZWZ1bCwgZm9yIGV4YW1wbGUsIGZvclxuICAgICAgICAgKiByZWFjdGluZyBvbiBzY3JlZW4gc2l6ZSBjaGFuZ2VzLiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBiZWZvcmUgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2ZcbiAgICAgICAgICogdGhpcyBsYXllciBpbiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0uIEl0IHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHlcbiAgICAgICAgICogYXJndW1lbnQuIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cFxuICAgICAgICAgKiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfSB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25QcmVSZW5kZXIgPSBvcHRpb25zLm9uUHJlUmVuZGVyO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGJlZm9yZSBvcGFxdWUgbWVzaCBpbnN0YW5jZXMgKG5vdCBzZW1pLXRyYW5zcGFyZW50KSBpblxuICAgICAgICAgKiB0aGlzIGxheWVyIGFyZSByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LlxuICAgICAgICAgKiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc31cbiAgICAgICAgICogd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUHJlUmVuZGVyT3BhcXVlID0gb3B0aW9ucy5vblByZVJlbmRlck9wYXF1ZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBiZWZvcmUgc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcyBpbiB0aGlzIGxheWVyIGFyZVxuICAgICAgICAgKiByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LiBZb3UgY2FuIGdldCB0aGVcbiAgICAgICAgICogYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc30gd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQgPSBvcHRpb25zLm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB2aXNpYmlsaXR5IGN1bGxpbmcgaXMgcGVyZm9ybWVkIGZvciB0aGlzIGxheWVyLlxuICAgICAgICAgKiBVc2VmdWwgZm9yIHJldmVydGluZyBjaGFuZ2VzIGRvbmUgaW4ge0BsaW5rIExheWVyI29uUHJlQ3VsbH0gYW5kIGRldGVybWluaW5nIGZpbmFsIG1lc2hcbiAgICAgICAgICogaW5zdGFuY2UgdmlzaWJpbGl0eSAoc2VlIHtAbGluayBNZXNoSW5zdGFuY2UjdmlzaWJsZVRoaXNGcmFtZX0pLiBUaGlzIGZ1bmN0aW9uIHdpbGxcbiAgICAgICAgICogcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnlcbiAgICAgICAgICogbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfSB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25Qb3N0Q3VsbCA9IG9wdGlvbnMub25Qb3N0Q3VsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGlzIGxheWVyIGlzIHJlbmRlcmVkLiBVc2VmdWwgdG8gcmV2ZXJ0IGNoYW5nZXNcbiAgICAgICAgICogbWFkZSBpbiB7QGxpbmsgTGF5ZXIjb25QcmVSZW5kZXJ9LiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBhZnRlciB0aGUgbGFzdCBvY2N1cnJlbmNlIG9mIHRoaXNcbiAgICAgICAgICogbGF5ZXIgaW4ge0BsaW5rIExheWVyQ29tcG9zaXRpb259LiBJdCB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LlxuICAgICAgICAgKiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc31cbiAgICAgICAgICogd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUG9zdFJlbmRlciA9IG9wdGlvbnMub25Qb3N0UmVuZGVyO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIG9wYXF1ZSBtZXNoIGluc3RhbmNlcyAobm90IHNlbWktdHJhbnNwYXJlbnQpIGluXG4gICAgICAgICAqIHRoaXMgbGF5ZXIgYXJlIHJlbmRlcmVkLiBUaGlzIGZ1bmN0aW9uIHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuXG4gICAgICAgICAqIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfVxuICAgICAgICAgKiB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25Qb3N0UmVuZGVyT3BhcXVlID0gb3B0aW9ucy5vblBvc3RSZW5kZXJPcGFxdWU7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcyBpbiB0aGlzIGxheWVyIGFyZVxuICAgICAgICAgKiByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LiBZb3UgY2FuIGdldCB0aGVcbiAgICAgICAgICogYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc30gd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUG9zdFJlbmRlclRyYW5zcGFyZW50ID0gb3B0aW9ucy5vblBvc3RSZW5kZXJUcmFuc3BhcmVudDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGJlZm9yZSBldmVyeSBtZXNoIGluc3RhbmNlIGluIHRoaXMgbGF5ZXIgaXMgcmVuZGVyZWQuIEl0XG4gICAgICAgICAqIGlzIG5vdCByZWNvbW1lbmRlZCB0byBzZXQgdGhpcyBmdW5jdGlvbiB3aGVuIHJlbmRlcmluZyBtYW55IG9iamVjdHMgZXZlcnkgZnJhbWUgZHVlIHRvXG4gICAgICAgICAqIHBlcmZvcm1hbmNlIHJlYXNvbnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25EcmF3Q2FsbCA9IG9wdGlvbnMub25EcmF3Q2FsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgbGF5ZXIgaGFzIGJlZW4gZW5hYmxlZC4gVGhpcyBoYXBwZW5zIHdoZW46XG4gICAgICAgICAqXG4gICAgICAgICAqIC0gVGhlIGxheWVyIGlzIGNyZWF0ZWQgd2l0aCB7QGxpbmsgTGF5ZXIjZW5hYmxlZH0gc2V0IHRvIHRydWUgKHdoaWNoIGlzIHRoZSBkZWZhdWx0IHZhbHVlKS5cbiAgICAgICAgICogLSB7QGxpbmsgTGF5ZXIjZW5hYmxlZH0gd2FzIGNoYW5nZWQgZnJvbSBmYWxzZSB0byB0cnVlXG4gICAgICAgICAqIC0ge0BsaW5rIExheWVyI2luY3JlbWVudENvdW50ZXJ9IHdhcyBjYWxsZWQgYW5kIGluY3JlbWVudGVkIHRoZSBjb3VudGVyIGFib3ZlIHplcm8uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVzZWZ1bCBmb3IgYWxsb2NhdGluZyByZXNvdXJjZXMgdGhpcyBsYXllciB3aWxsIHVzZSAoZS5nLiBjcmVhdGluZyByZW5kZXIgdGFyZ2V0cykuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25FbmFibGUgPSBvcHRpb25zLm9uRW5hYmxlO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoZSBsYXllciBoYXMgYmVlbiBkaXNhYmxlZC4gVGhpcyBoYXBwZW5zIHdoZW46XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIExheWVyI2VuYWJsZWR9IHdhcyBjaGFuZ2VkIGZyb20gdHJ1ZSB0byBmYWxzZVxuICAgICAgICAgKiAtIHtAbGluayBMYXllciNkZWNyZW1lbnRDb3VudGVyfSB3YXMgY2FsbGVkIGFuZCBzZXQgdGhlIGNvdW50ZXIgdG8gemVyby5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vbkRpc2FibGUgPSBvcHRpb25zLm9uRGlzYWJsZTtcblxuICAgICAgICBpZiAodGhpcy5fZW5hYmxlZCAmJiB0aGlzLm9uRW5hYmxlKSB7XG4gICAgICAgICAgICB0aGlzLm9uRW5hYmxlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogTWFrZSB0aGlzIGxheWVyIHJlbmRlciB0aGUgc2FtZSBtZXNoIGluc3RhbmNlcyB0aGF0IGFub3RoZXIgbGF5ZXIgZG9lcyBpbnN0ZWFkIG9mIGhhdmluZ1xuICAgICAgICAgKiBpdHMgb3duIG1lc2ggaW5zdGFuY2UgbGlzdC4gQm90aCBsYXllcnMgbXVzdCBzaGFyZSBjYW1lcmFzLiBGcnVzdHVtIGN1bGxpbmcgaXMgb25seVxuICAgICAgICAgKiBwZXJmb3JtZWQgZm9yIG9uZSBsYXllci4gVXNlZnVsIGZvciByZW5kZXJpbmcgbXVsdGlwbGUgcGFzc2VzIHVzaW5nIGRpZmZlcmVudCBzaGFkZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7TGF5ZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxheWVyUmVmZXJlbmNlID0gb3B0aW9ucy5sYXllclJlZmVyZW5jZTsgLy8gc2hvdWxkIHVzZSB0aGUgc2FtZSBjYW1lcmFcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0luc3RhbmNlTGlzdH1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbnN0YW5jZXMgPSBvcHRpb25zLmxheWVyUmVmZXJlbmNlID8gb3B0aW9ucy5sYXllclJlZmVyZW5jZS5pbnN0YW5jZXMgOiBuZXcgSW5zdGFuY2VMaXN0KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZpc2liaWxpdHkgYml0IG1hc2sgdGhhdCBpbnRlcmFjdHMgd2l0aCB7QGxpbmsgTWVzaEluc3RhbmNlI21hc2t9LiBFc3BlY2lhbGx5IHVzZWZ1bFxuICAgICAgICAgKiB3aGVuIGNvbWJpbmVkIHdpdGggbGF5ZXJSZWZlcmVuY2UsIGFsbG93aW5nIGZvciB0aGUgZmlsdGVyaW5nIG9mIHNvbWUgb2JqZWN0cywgd2hpbGVcbiAgICAgICAgICogc2hhcmluZyB0aGVpciBsaXN0IGFuZCBjdWxsaW5nLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdWxsaW5nTWFzayA9IG9wdGlvbnMuY3VsbGluZ01hc2sgPyBvcHRpb25zLmN1bGxpbmdNYXNrIDogMHhGRkZGRkZGRjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzLm9wYXF1ZU1lc2hJbnN0YW5jZXM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zaGFkb3dDYXN0ZXJzID0gdGhpcy5pbnN0YW5jZXMuc2hhZG93Q2FzdGVycztcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufG51bGx9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY3VzdG9tU29ydENhbGxiYWNrID0gbnVsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbnxudWxsfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN1c3RvbUNhbGN1bGF0ZVNvcnRWYWx1ZXMgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2xpZ2h0LmpzJykuTGlnaHRbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpZ2h0cyA9IFtdO1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1NldDxpbXBvcnQoJy4vbGlnaHQuanMnKS5MaWdodD59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9saWdodHNTZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCBvZiBsaWdodCB1c2VkIGJ5IGNsdXN0ZXJlZCBsaWdodGluZyAob21uaSBhbmQgc3BvdCwgYnV0IG5vIGRpcmVjdGlvbmFsKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1NldDxpbXBvcnQoJy4vbGlnaHQuanMnKS5MaWdodD59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIExpZ2h0cyBzZXBhcmF0ZWQgYnkgbGlnaHQgdHlwZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9saWdodC5qcycpLkxpZ2h0W11bXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3BsaXRMaWdodHMgPSBbW10sIFtdLCBbXV07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnRbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jYW1lcmFzID0gW107XG5cbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbGlnaHRIYXNoID0gMDtcbiAgICAgICAgdGhpcy5fc3RhdGljTGlnaHRIYXNoID0gMDtcbiAgICAgICAgdGhpcy5fbmVlZHNTdGF0aWNQcmVwYXJlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fc3RhdGljUHJlcGFyZURvbmUgPSBmYWxzZTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc2tpcFJlbmRlckFmdGVyID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgdGhpcy5fc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuXG4gICAgICAgIHRoaXMuX3JlbmRlclRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5fc2hhZG93RHJhd0NhbGxzID0gMDsgIC8vIGRlcHJlY2F0ZWQsIG5vdCB1c2VmdWwgb24gYSBsYXllciBhbnltb3JlLCBjb3VsZCBiZSBtb3ZlZCB0byBjYW1lcmFcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgdGhpcy5fc2hhZGVyVmVyc2lvbiA9IC0xO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7RmxvYXQzMkFycmF5fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9saWdodEN1YmUgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGxheWVyIGNvbnRhaW5zIG9tbmkgb3Igc3BvdCBsaWdodHNcbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgaGFzQ2x1c3RlcmVkTGlnaHRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2x1c3RlcmVkTGlnaHRzU2V0LnNpemUgPiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldCByZW5kZXJUYXJnZXQocnQpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9yZW5kZXJUYXJnZXQgPSBydDtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyVGFyZ2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyVGFyZ2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZSB0aGUgbGF5ZXIuIERpc2FibGVkIGxheWVycyBhcmUgc2tpcHBlZC4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBlbmFibGVkKHZhbCkge1xuICAgICAgICBpZiAodmFsICE9PSB0aGlzLl9lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsO1xuICAgICAgICAgICAgaWYgKHZhbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5jcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9uRW5hYmxlKSB0aGlzLm9uRW5hYmxlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVjcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9uRGlzYWJsZSkgdGhpcy5vbkRpc2FibGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBlbmFibGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIGNvbG9yIGJ1ZmZlciB3aGVuIGl0IHJlbmRlcnMgdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbGVhckNvbG9yQnVmZmVyKHZhbCkge1xuICAgICAgICB0aGlzLl9jbGVhckNvbG9yQnVmZmVyID0gdmFsO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhckNvbG9yQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlciB3aGVuIGl0IHJlbmRlcnMgdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbGVhckRlcHRoQnVmZmVyKHZhbCkge1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoQnVmZmVyID0gdmFsO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhckRlcHRoQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIHN0ZW5jaWwgYnVmZmVyIHdoZW4gaXQgcmVuZGVycyB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcih2YWwpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyID0gdmFsO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhclN0ZW5jaWxCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhclN0ZW5jaWxCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBsaWdodHMgdXNlZCBieSBjbHVzdGVyZWQgbGlnaHRpbmcgaW4gYSBzZXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2V0PGltcG9ydCgnLi9saWdodC5qcycpLkxpZ2h0Pn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IGNsdXN0ZXJlZExpZ2h0c1NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbmNyZW1lbnRzIHRoZSB1c2FnZSBjb3VudGVyIG9mIHRoaXMgbGF5ZXIuIEJ5IGRlZmF1bHQsIGxheWVycyBhcmUgY3JlYXRlZCB3aXRoIGNvdW50ZXIgc2V0XG4gICAgICogdG8gMSAoaWYge0BsaW5rIExheWVyLmVuYWJsZWR9IGlzIHRydWUpIG9yIDAgKGlmIGl0IHdhcyBmYWxzZSkuIEluY3JlbWVudGluZyB0aGUgY291bnRlclxuICAgICAqIGZyb20gMCB0byAxIHdpbGwgZW5hYmxlIHRoZSBsYXllciBhbmQgY2FsbCB7QGxpbmsgTGF5ZXIub25FbmFibGV9LiBVc2UgdGhpcyBmdW5jdGlvbiB0b1xuICAgICAqIFwic3Vic2NyaWJlXCIgbXVsdGlwbGUgZWZmZWN0cyB0byB0aGUgc2FtZSBsYXllci4gRm9yIGV4YW1wbGUsIGlmIHRoZSBsYXllciBpcyB1c2VkIHRvIHJlbmRlclxuICAgICAqIGEgcmVmbGVjdGlvbiB0ZXh0dXJlIHdoaWNoIGlzIHVzZWQgYnkgMiBtaXJyb3JzLCB0aGVuIGVhY2ggbWlycm9yIGNhbiBjYWxsIHRoaXMgZnVuY3Rpb25cbiAgICAgKiB3aGVuIHZpc2libGUgYW5kIHtAbGluayBMYXllci5kZWNyZW1lbnRDb3VudGVyfSBpZiBpbnZpc2libGUuIEluIHN1Y2ggY2FzZSB0aGUgcmVmbGVjdGlvblxuICAgICAqIHRleHR1cmUgd29uJ3QgYmUgdXBkYXRlZCwgd2hlbiB0aGVyZSBpcyBub3RoaW5nIHRvIHVzZSBpdCwgc2F2aW5nIHBlcmZvcm1hbmNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGluY3JlbWVudENvdW50ZXIoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWZDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0aGlzLm9uRW5hYmxlKSB0aGlzLm9uRW5hYmxlKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVmQ291bnRlcisrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlY3JlbWVudHMgdGhlIHVzYWdlIGNvdW50ZXIgb2YgdGhpcyBsYXllci4gRGVjcmVtZW50aW5nIHRoZSBjb3VudGVyIGZyb20gMSB0byAwIHdpbGxcbiAgICAgKiBkaXNhYmxlIHRoZSBsYXllciBhbmQgY2FsbCB7QGxpbmsgTGF5ZXIub25EaXNhYmxlfS4gU2VlIHtAbGluayBMYXllciNpbmNyZW1lbnRDb3VudGVyfSBmb3JcbiAgICAgKiBtb3JlIGRldGFpbHMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVjcmVtZW50Q291bnRlcigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlZkNvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0aGlzLm9uRGlzYWJsZSkgdGhpcy5vbkRpc2FibGUoKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3JlZkNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ1RyeWluZyB0byBkZWNyZW1lbnQgbGF5ZXIgY291bnRlciBiZWxvdyAwJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVmQ291bnRlci0tO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMgdG8gdGhpcyBsYXllci5cbiAgICAgKjFcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gbWVzaEluc3RhbmNlcyAtIEFycmF5IG9mXG4gICAgICoge0BsaW5rIE1lc2hJbnN0YW5jZX0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbc2tpcFNoYWRvd0Nhc3RlcnNdIC0gU2V0IGl0IHRvIHRydWUgaWYgeW91IGRvbid0IHdhbnQgdGhlc2UgbWVzaCBpbnN0YW5jZXNcbiAgICAgKiB0byBjYXN0IHNoYWRvd3MgaW4gdGhpcyBsYXllci5cbiAgICAgKi9cbiAgICBhZGRNZXNoSW5zdGFuY2VzKG1lc2hJbnN0YW5jZXMsIHNraXBTaGFkb3dDYXN0ZXJzKSB7XG4gICAgICAgIGNvbnN0IHNjZW5lU2hhZGVyVmVyID0gdGhpcy5fc2hhZGVyVmVyc2lvbjtcblxuICAgICAgICBjb25zdCBjYXN0ZXJzID0gdGhpcy5zaGFkb3dDYXN0ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG0gPSBtZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWF0ID0gbS5tYXRlcmlhbDtcbiAgICAgICAgICAgIGNvbnN0IGFyciA9IG1hdC5ibGVuZFR5cGUgPT09IEJMRU5EX05PTkUgPyB0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXMgOiB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgLy8gdGVzdCBmb3IgbWVzaEluc3RhbmNlIGluIGJvdGggYXJyYXlzLCBhcyBtYXRlcmlhbCdzIGFscGhhIGNvdWxkIGhhdmUgY2hhbmdlZCBzaW5jZSBMYXllckNvbXBvc2l0aW9uJ3MgdXBkYXRlIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgICAgIC8vIFRPRE8gLSBmb2xsb3dpbmcgdXNlcyBvZiBpbmRleE9mIGFyZSBleHBlbnNpdmUsIHRvIGFkZCA1MDAwIG1lc2hJbnN0YW5jZXMgY29zdHMgYWJvdXQgNzBtcyBvbiBNYWMuIENvbnNpZGVyIHVzaW5nIFNldC5cbiAgICAgICAgICAgIGlmICh0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXMuaW5kZXhPZihtKSA8IDAgJiYgdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMuaW5kZXhPZihtKSA8IDApIHtcbiAgICAgICAgICAgICAgICBhcnIucHVzaChtKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFza2lwU2hhZG93Q2FzdGVycyAmJiBtLmNhc3RTaGFkb3cgJiYgY2FzdGVycy5pbmRleE9mKG0pIDwgMCkgY2FzdGVycy5wdXNoKG0pO1xuXG4gICAgICAgICAgICAvLyBjbGVhciBvbGQgc2hhZGVyIHZhcmlhbnRzIGlmIG5lY2Vzc2FyeVxuICAgICAgICAgICAgaWYgKCF0aGlzLnBhc3NUaHJvdWdoICYmIHNjZW5lU2hhZGVyVmVyID49IDAgJiYgbWF0Ll9zaGFkZXJWZXJzaW9uICE9PSBzY2VuZVNoYWRlclZlcikge1xuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCB0aGlzIGZvciBtYXRlcmlhbHMgbm90IHVzaW5nIHZhcmlhbnRzXG4gICAgICAgICAgICAgICAgaWYgKG1hdC5nZXRTaGFkZXJWYXJpYW50ICE9PSBNYXRlcmlhbC5wcm90b3R5cGUuZ2V0U2hhZGVyVmFyaWFudCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciBzaGFkZXIgdmFyaWFudHMgb24gdGhlIG1hdGVyaWFsIGFuZCBhbHNvIG9uIG1lc2ggaW5zdGFuY2VzIHRoYXQgdXNlIGl0XG4gICAgICAgICAgICAgICAgICAgIG1hdC5jbGVhclZhcmlhbnRzKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1hdC5fc2hhZGVyVmVyc2lvbiA9IHNjZW5lU2hhZGVyVmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5wYXNzVGhyb3VnaCkgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIGZ1bmN0aW9uIHRvIHJlbW92ZSBhIG1lc2ggaW5zdGFuY2UgZnJvbSBhbiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IG0gLSBNZXNoIGluc3RhbmNlIHRvIHJlbW92ZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IGFyciAtIEFycmF5IG9mIG1lc2ggaW5zdGFuY2VzIHRvIHJlbW92ZVxuICAgICAqIGZyb20uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZW1vdmVNZXNoSW5zdGFuY2VGcm9tQXJyYXkobSwgYXJyKSB7XG4gICAgICAgIGxldCBzcGxpY2VPZmZzZXQgPSAtMTtcbiAgICAgICAgbGV0IHNwbGljZUNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbGVuID0gYXJyLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGorKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBhcnJbal07XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwgPT09IG0pIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VPZmZzZXQgPSBqO1xuICAgICAgICAgICAgICAgIHNwbGljZUNvdW50ID0gMTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5fc3RhdGljU291cmNlID09PSBtKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNwbGljZU9mZnNldCA8IDApIHNwbGljZU9mZnNldCA9IGo7XG4gICAgICAgICAgICAgICAgc3BsaWNlQ291bnQrKztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3BsaWNlT2Zmc2V0ID49IDApIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcGxpY2VPZmZzZXQgPj0gMCkge1xuICAgICAgICAgICAgYXJyLnNwbGljZShzcGxpY2VPZmZzZXQsIHNwbGljZUNvdW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgbXVsdGlwbGUgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gQXJyYXkgb2ZcbiAgICAgKiB7QGxpbmsgTWVzaEluc3RhbmNlfS4gSWYgdGhleSB3ZXJlIGFkZGVkIHRvIHRoaXMgbGF5ZXIsIHRoZXkgd2lsbCBiZSByZW1vdmVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3NraXBTaGFkb3dDYXN0ZXJzXSAtIFNldCBpdCB0byB0cnVlIGlmIHlvdSB3YW50IHRvIHN0aWxsIGNhc3Qgc2hhZG93cyBmcm9tXG4gICAgICogcmVtb3ZlZCBtZXNoIGluc3RhbmNlcyBvciBpZiB0aGV5IG5ldmVyIGRpZCBjYXN0IHNoYWRvd3MgYmVmb3JlLlxuICAgICAqL1xuICAgIHJlbW92ZU1lc2hJbnN0YW5jZXMobWVzaEluc3RhbmNlcywgc2tpcFNoYWRvd0Nhc3RlcnMpIHtcblxuICAgICAgICBjb25zdCBvcGFxdWUgPSB0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IGNhc3RlcnMgPSB0aGlzLnNoYWRvd0Nhc3RlcnM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtID0gbWVzaEluc3RhbmNlc1tpXTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gb3BhcXVlXG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1lc2hJbnN0YW5jZUZyb21BcnJheShtLCBvcGFxdWUpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgZnJvbSB0cmFuc3BhcmVudFxuICAgICAgICAgICAgdGhpcy5yZW1vdmVNZXNoSW5zdGFuY2VGcm9tQXJyYXkobSwgdHJhbnNwYXJlbnQpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgZnJvbSBjYXN0ZXJzXG4gICAgICAgICAgICBpZiAoIXNraXBTaGFkb3dDYXN0ZXJzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaiA9IGNhc3RlcnMuaW5kZXhPZihtKTtcbiAgICAgICAgICAgICAgICBpZiAoaiA+PSAwKVxuICAgICAgICAgICAgICAgICAgICBjYXN0ZXJzLnNwbGljZShqLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBtZXNoIGluc3RhbmNlcyBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtza2lwU2hhZG93Q2FzdGVyc10gLSBTZXQgaXQgdG8gdHJ1ZSBpZiB5b3Ugd2FudCB0byBzdGlsbCBjYXN0IHNoYWRvd3MgZnJvbVxuICAgICAqIHJlbW92ZWQgbWVzaCBpbnN0YW5jZXMgb3IgaWYgdGhleSBuZXZlciBkaWQgY2FzdCBzaGFkb3dzIGJlZm9yZS5cbiAgICAgKi9cbiAgICBjbGVhck1lc2hJbnN0YW5jZXMoc2tpcFNoYWRvd0Nhc3RlcnMpIHtcbiAgICAgICAgaWYgKHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcy5sZW5ndGggPT09IDAgJiYgdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBpZiAoc2tpcFNoYWRvd0Nhc3RlcnMgfHwgdGhpcy5zaGFkb3dDYXN0ZXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICBpZiAoIXNraXBTaGFkb3dDYXN0ZXJzKSB0aGlzLnNoYWRvd0Nhc3RlcnMubGVuZ3RoID0gMDtcbiAgICAgICAgaWYgKCF0aGlzLnBhc3NUaHJvdWdoKSB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGxpZ2h0IHRvIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzJykuTGlnaHRDb21wb25lbnR9IGxpZ2h0IC0gQVxuICAgICAqIHtAbGluayBMaWdodENvbXBvbmVudH0uXG4gICAgICovXG4gICAgYWRkTGlnaHQobGlnaHQpIHtcblxuICAgICAgICAvLyBpZiB0aGUgbGlnaHQgaXMgbm90IGluIHRoZSBsYXllciBhbHJlYWR5XG4gICAgICAgIGNvbnN0IGwgPSBsaWdodC5saWdodDtcbiAgICAgICAgaWYgKCF0aGlzLl9saWdodHNTZXQuaGFzKGwpKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodHNTZXQuYWRkKGwpO1xuXG4gICAgICAgICAgICB0aGlzLl9saWdodHMucHVzaChsKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2dlbmVyYXRlTGlnaHRIYXNoKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobC50eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldC5hZGQobCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgbGlnaHQgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2xpZ2h0L2NvbXBvbmVudC5qcycpLkxpZ2h0Q29tcG9uZW50fSBsaWdodCAtIEFcbiAgICAgKiB7QGxpbmsgTGlnaHRDb21wb25lbnR9LlxuICAgICAqL1xuICAgIHJlbW92ZUxpZ2h0KGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbCA9IGxpZ2h0LmxpZ2h0O1xuICAgICAgICBpZiAodGhpcy5fbGlnaHRzU2V0LmhhcyhsKSkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzU2V0LmRlbGV0ZShsKTtcblxuICAgICAgICAgICAgdGhpcy5fbGlnaHRzLnNwbGljZSh0aGlzLl9saWdodHMuaW5kZXhPZihsKSwgMSk7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9nZW5lcmF0ZUxpZ2h0SGFzaCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGwudHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQuZGVsZXRlKGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbGwgbGlnaHRzIGZyb20gdGhpcyBsYXllci5cbiAgICAgKi9cbiAgICBjbGVhckxpZ2h0cygpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRzU2V0LmNsZWFyKCk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldC5jbGVhcigpO1xuICAgICAgICB0aGlzLl9saWdodHMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMgdG8gdGhpcyBsYXllciwgYnV0IG9ubHkgYXMgc2hhZG93IGNhc3RlcnMgKHRoZXkgd2lsbCBub3QgYmVcbiAgICAgKiByZW5kZXJlZCBhbnl3aGVyZSwgYnV0IG9ubHkgY2FzdCBzaGFkb3dzIG9uIG90aGVyIG9iamVjdHMpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gQXJyYXkgb2ZcbiAgICAgKiB7QGxpbmsgTWVzaEluc3RhbmNlfS5cbiAgICAgKi9cbiAgICBhZGRTaGFkb3dDYXN0ZXJzKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgY29uc3QgYXJyID0gdGhpcy5zaGFkb3dDYXN0ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG0gPSBtZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgaWYgKCFtLmNhc3RTaGFkb3cpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGFyci5pbmRleE9mKG0pIDwgMCkgYXJyLnB1c2gobSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgbXVsdGlwbGUgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGUgc2hhZG93IGNhc3RlcnMgbGlzdCBvZiB0aGlzIGxheWVyLCBtZWFuaW5nIHRoZXlcbiAgICAgKiB3aWxsIHN0b3AgY2FzdGluZyBzaGFkb3dzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gQXJyYXkgb2ZcbiAgICAgKiB7QGxpbmsgTWVzaEluc3RhbmNlfS4gSWYgdGhleSB3ZXJlIGFkZGVkIHRvIHRoaXMgbGF5ZXIsIHRoZXkgd2lsbCBiZSByZW1vdmVkLlxuICAgICAqL1xuICAgIHJlbW92ZVNoYWRvd0Nhc3RlcnMobWVzaEluc3RhbmNlcykge1xuICAgICAgICBjb25zdCBhcnIgPSB0aGlzLnNoYWRvd0Nhc3RlcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgaWQgPSBhcnIuaW5kZXhPZihtZXNoSW5zdGFuY2VzW2ldKTtcbiAgICAgICAgICAgIGlmIChpZCA+PSAwKSBhcnIuc3BsaWNlKGlkLCAxKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2dlbmVyYXRlTGlnaHRIYXNoKCkge1xuICAgICAgICAvLyBnZW5lcmF0ZSBoYXNoIHRvIGNoZWNrIGlmIGxheWVycyBoYXZlIHRoZSBzYW1lIHNldCBvZiBzdGF0aWMgbGlnaHRzXG4gICAgICAgIC8vIG9yZGVyIG9mIGxpZ2h0cyBzaG91bGRuJ3QgbWF0dGVyXG4gICAgICAgIGlmICh0aGlzLl9saWdodHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzLnNvcnQoc29ydExpZ2h0cyk7XG4gICAgICAgICAgICBsZXQgc3RyID0gJyc7XG4gICAgICAgICAgICBsZXQgc3RyU3RhdGljID0gJyc7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2xpZ2h0c1tpXS5pc1N0YXRpYykge1xuICAgICAgICAgICAgICAgICAgICBzdHJTdGF0aWMgKz0gdGhpcy5fbGlnaHRzW2ldLmtleTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdHIgKz0gdGhpcy5fbGlnaHRzW2ldLmtleTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGlnaHRIYXNoID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGlnaHRIYXNoID0gaGFzaENvZGUoc3RyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0clN0YXRpYy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGF0aWNMaWdodEhhc2ggPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGF0aWNMaWdodEhhc2ggPSBoYXNoQ29kZShzdHJTdGF0aWMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodEhhc2ggPSAwO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGljTGlnaHRIYXNoID0gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBjYW1lcmEgdG8gdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBBXG4gICAgICoge0BsaW5rIENhbWVyYUNvbXBvbmVudH0uXG4gICAgICovXG4gICAgYWRkQ2FtZXJhKGNhbWVyYSkge1xuICAgICAgICBpZiAodGhpcy5jYW1lcmFzLmluZGV4T2YoY2FtZXJhKSA+PSAwKSByZXR1cm47XG4gICAgICAgIHRoaXMuY2FtZXJhcy5wdXNoKGNhbWVyYSk7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGNhbWVyYSBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gQVxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnR9LlxuICAgICAqL1xuICAgIHJlbW92ZUNhbWVyYShjYW1lcmEpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmNhbWVyYXMuaW5kZXhPZihjYW1lcmEpO1xuICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5jYW1lcmFzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBkZWxldGUgdGhlIHZpc2libGUgbGlzdCBmb3IgdGhpcyBjYW1lcmFcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzLmRlbGV0ZShpbmRleCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBjYW1lcmFzIGZyb20gdGhpcyBsYXllci5cbiAgICAgKi9cbiAgICBjbGVhckNhbWVyYXMoKSB7XG4gICAgICAgIHRoaXMuY2FtZXJhcy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gZHJhd0NhbGxzIC0gQXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRyYXdDYWxsc0NvdW50IC0gTnVtYmVyIG9mIG1lc2ggaW5zdGFuY2VzLlxuICAgICAqIEBwYXJhbSB7VmVjM30gY2FtUG9zIC0gQ2FtZXJhIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjM30gY2FtRndkIC0gQ2FtZXJhIGZvcndhcmQgdmVjdG9yLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NhbGN1bGF0ZVNvcnREaXN0YW5jZXMoZHJhd0NhbGxzLCBkcmF3Q2FsbHNDb3VudCwgY2FtUG9zLCBjYW1Gd2QpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jb21tYW5kKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5sYXllciA8PSBMQVlFUl9GWCkgY29udGludWU7IC8vIE9ubHkgYWxwaGEgc29ydCBtZXNoIGluc3RhbmNlcyBpbiB0aGUgbWFpbiB3b3JsZCAoYmFja3dhcmRzIGNvbXApXG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwuY2FsY3VsYXRlU29ydERpc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgZHJhd0NhbGwuemRpc3QgPSBkcmF3Q2FsbC5jYWxjdWxhdGVTb3J0RGlzdGFuY2UoZHJhd0NhbGwsIGNhbVBvcywgY2FtRndkKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG1lc2hQb3MgPSBkcmF3Q2FsbC5hYWJiLmNlbnRlcjtcbiAgICAgICAgICAgIGNvbnN0IHRlbXB4ID0gbWVzaFBvcy54IC0gY2FtUG9zLng7XG4gICAgICAgICAgICBjb25zdCB0ZW1weSA9IG1lc2hQb3MueSAtIGNhbVBvcy55O1xuICAgICAgICAgICAgY29uc3QgdGVtcHogPSBtZXNoUG9zLnogLSBjYW1Qb3MuejtcbiAgICAgICAgICAgIGRyYXdDYWxsLnpkaXN0ID0gdGVtcHggKiBjYW1Gd2QueCArIHRlbXB5ICogY2FtRndkLnkgKyB0ZW1weiAqIGNhbUZ3ZC56O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtib29sZWFufSB0cmFuc3BhcmVudCAtIFRydWUgaWYgdHJhbnNwYXJlbnQgc29ydGluZyBzaG91bGQgYmUgdXNlZC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ncmFwaC1ub2RlLmpzJykuR3JhcGhOb2RlfSBjYW1lcmFOb2RlIC0gR3JhcGggbm9kZSB0aGF0IHRoZSBjYW1lcmEgaXNcbiAgICAgKiBhdHRhY2hlZCB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2FtZXJhUGFzcyAtIENhbWVyYSBwYXNzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfc29ydFZpc2libGUodHJhbnNwYXJlbnQsIGNhbWVyYU5vZGUsIGNhbWVyYVBhc3MpIHtcbiAgICAgICAgY29uc3Qgb2JqZWN0cyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBjb25zdCBzb3J0TW9kZSA9IHRyYW5zcGFyZW50ID8gdGhpcy50cmFuc3BhcmVudFNvcnRNb2RlIDogdGhpcy5vcGFxdWVTb3J0TW9kZTtcbiAgICAgICAgaWYgKHNvcnRNb2RlID09PSBTT1JUTU9ERV9OT05FKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gb2JqZWN0cy52aXNpYmxlVHJhbnNwYXJlbnRbY2FtZXJhUGFzc10gOiBvYmplY3RzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG5cbiAgICAgICAgaWYgKHNvcnRNb2RlID09PSBTT1JUTU9ERV9DVVNUT00pIHtcbiAgICAgICAgICAgIHNvcnRQb3MgPSBjYW1lcmFOb2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICBzb3J0RGlyID0gY2FtZXJhTm9kZS5mb3J3YXJkO1xuICAgICAgICAgICAgaWYgKHRoaXMuY3VzdG9tQ2FsY3VsYXRlU29ydFZhbHVlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VzdG9tQ2FsY3VsYXRlU29ydFZhbHVlcyh2aXNpYmxlLmxpc3QsIHZpc2libGUubGVuZ3RoLCBzb3J0UG9zLCBzb3J0RGlyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZpc2libGUubGlzdC5sZW5ndGggIT09IHZpc2libGUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmlzaWJsZS5saXN0Lmxlbmd0aCA9IHZpc2libGUubGVuZ3RoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5jdXN0b21Tb3J0Q2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB2aXNpYmxlLmxpc3Quc29ydCh0aGlzLmN1c3RvbVNvcnRDYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoc29ydE1vZGUgPT09IFNPUlRNT0RFX0JBQ0syRlJPTlQgfHwgc29ydE1vZGUgPT09IFNPUlRNT0RFX0ZST05UMkJBQ0spIHtcbiAgICAgICAgICAgICAgICBzb3J0UG9zID0gY2FtZXJhTm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgICAgIHNvcnREaXIgPSBjYW1lcmFOb2RlLmZvcndhcmQ7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlU29ydERpc3RhbmNlcyh2aXNpYmxlLmxpc3QsIHZpc2libGUubGVuZ3RoLCBzb3J0UG9zLCBzb3J0RGlyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZpc2libGUubGlzdC5sZW5ndGggIT09IHZpc2libGUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmlzaWJsZS5saXN0Lmxlbmd0aCA9IHZpc2libGUubGVuZ3RoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2aXNpYmxlLmxpc3Quc29ydChzb3J0Q2FsbGJhY2tzW3NvcnRNb2RlXSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IExheWVyIH07XG4iXSwibmFtZXMiOlsia2V5QSIsImtleUIiLCJzb3J0UG9zIiwic29ydERpciIsInNvcnRNYW51YWwiLCJkcmF3Q2FsbEEiLCJkcmF3Q2FsbEIiLCJkcmF3T3JkZXIiLCJzb3J0TWF0ZXJpYWxNZXNoIiwiX2tleSIsIlNPUlRLRVlfRk9SV0FSRCIsIm1lc2giLCJpZCIsInNvcnRCYWNrVG9Gcm9udCIsInpkaXN0Iiwic29ydEZyb250VG9CYWNrIiwic29ydENhbGxiYWNrcyIsInNvcnRMaWdodHMiLCJsaWdodEEiLCJsaWdodEIiLCJrZXkiLCJsYXllckNvdW50ZXIiLCJWaXNpYmxlSW5zdGFuY2VMaXN0IiwiY29uc3RydWN0b3IiLCJsaXN0IiwibGVuZ3RoIiwiZG9uZSIsIkluc3RhbmNlTGlzdCIsIm9wYXF1ZU1lc2hJbnN0YW5jZXMiLCJ0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMiLCJzaGFkb3dDYXN0ZXJzIiwidmlzaWJsZU9wYXF1ZSIsInZpc2libGVUcmFuc3BhcmVudCIsInByZXBhcmUiLCJpbmRleCIsImRlbGV0ZSIsInNwbGljZSIsIkxheWVyIiwib3B0aW9ucyIsInVuZGVmaW5lZCIsIk1hdGgiLCJtYXgiLCJuYW1lIiwiX2VuYWJsZWQiLCJlbmFibGVkIiwiX3JlZkNvdW50ZXIiLCJvcGFxdWVTb3J0TW9kZSIsIlNPUlRNT0RFX01BVEVSSUFMTUVTSCIsInRyYW5zcGFyZW50U29ydE1vZGUiLCJTT1JUTU9ERV9CQUNLMkZST05UIiwicmVuZGVyVGFyZ2V0Iiwic2hhZGVyUGFzcyIsIlNIQURFUl9GT1JXQVJEIiwicGFzc1Rocm91Z2giLCJfY2xlYXJDb2xvckJ1ZmZlciIsImNsZWFyQ29sb3JCdWZmZXIiLCJfY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyRGVwdGhCdWZmZXIiLCJfY2xlYXJTdGVuY2lsQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwib25QcmVDdWxsIiwib25QcmVSZW5kZXIiLCJvblByZVJlbmRlck9wYXF1ZSIsIm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQiLCJvblBvc3RDdWxsIiwib25Qb3N0UmVuZGVyIiwib25Qb3N0UmVuZGVyT3BhcXVlIiwib25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQiLCJvbkRyYXdDYWxsIiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJsYXllclJlZmVyZW5jZSIsImluc3RhbmNlcyIsImN1bGxpbmdNYXNrIiwiY3VzdG9tU29ydENhbGxiYWNrIiwiY3VzdG9tQ2FsY3VsYXRlU29ydFZhbHVlcyIsIl9saWdodHMiLCJfbGlnaHRzU2V0IiwiU2V0IiwiX2NsdXN0ZXJlZExpZ2h0c1NldCIsIl9zcGxpdExpZ2h0cyIsImNhbWVyYXMiLCJfZGlydHkiLCJfZGlydHlMaWdodHMiLCJfZGlydHlDYW1lcmFzIiwiX2xpZ2h0SGFzaCIsIl9zdGF0aWNMaWdodEhhc2giLCJfbmVlZHNTdGF0aWNQcmVwYXJlIiwiX3N0YXRpY1ByZXBhcmVEb25lIiwic2tpcFJlbmRlckFmdGVyIiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwiX3NraXBSZW5kZXJDb3VudGVyIiwiX3JlbmRlclRpbWUiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJfc2hhZGVyVmVyc2lvbiIsIl9saWdodEN1YmUiLCJoYXNDbHVzdGVyZWRMaWdodHMiLCJzaXplIiwicnQiLCJfcmVuZGVyVGFyZ2V0IiwidmFsIiwiaW5jcmVtZW50Q291bnRlciIsImRlY3JlbWVudENvdW50ZXIiLCJjbHVzdGVyZWRMaWdodHNTZXQiLCJEZWJ1ZyIsIndhcm4iLCJhZGRNZXNoSW5zdGFuY2VzIiwibWVzaEluc3RhbmNlcyIsInNraXBTaGFkb3dDYXN0ZXJzIiwic2NlbmVTaGFkZXJWZXIiLCJjYXN0ZXJzIiwiaSIsIm0iLCJtYXQiLCJtYXRlcmlhbCIsImFyciIsImJsZW5kVHlwZSIsIkJMRU5EX05PTkUiLCJpbmRleE9mIiwicHVzaCIsImNhc3RTaGFkb3ciLCJnZXRTaGFkZXJWYXJpYW50IiwiTWF0ZXJpYWwiLCJwcm90b3R5cGUiLCJjbGVhclZhcmlhbnRzIiwicmVtb3ZlTWVzaEluc3RhbmNlRnJvbUFycmF5Iiwic3BsaWNlT2Zmc2V0Iiwic3BsaWNlQ291bnQiLCJsZW4iLCJqIiwiZHJhd0NhbGwiLCJfc3RhdGljU291cmNlIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIm9wYXF1ZSIsInRyYW5zcGFyZW50IiwiY2xlYXJNZXNoSW5zdGFuY2VzIiwiYWRkTGlnaHQiLCJsaWdodCIsImwiLCJoYXMiLCJhZGQiLCJfZ2VuZXJhdGVMaWdodEhhc2giLCJ0eXBlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwicmVtb3ZlTGlnaHQiLCJjbGVhckxpZ2h0cyIsImNsZWFyIiwiYWRkU2hhZG93Q2FzdGVycyIsInJlbW92ZVNoYWRvd0Nhc3RlcnMiLCJzb3J0Iiwic3RyIiwic3RyU3RhdGljIiwiaXNTdGF0aWMiLCJoYXNoQ29kZSIsImFkZENhbWVyYSIsImNhbWVyYSIsInJlbW92ZUNhbWVyYSIsImNsZWFyQ2FtZXJhcyIsIl9jYWxjdWxhdGVTb3J0RGlzdGFuY2VzIiwiZHJhd0NhbGxzIiwiZHJhd0NhbGxzQ291bnQiLCJjYW1Qb3MiLCJjYW1Gd2QiLCJjb21tYW5kIiwibGF5ZXIiLCJMQVlFUl9GWCIsImNhbGN1bGF0ZVNvcnREaXN0YW5jZSIsIm1lc2hQb3MiLCJhYWJiIiwiY2VudGVyIiwidGVtcHgiLCJ4IiwidGVtcHkiLCJ5IiwidGVtcHoiLCJ6IiwiX3NvcnRWaXNpYmxlIiwiY2FtZXJhTm9kZSIsImNhbWVyYVBhc3MiLCJvYmplY3RzIiwic29ydE1vZGUiLCJTT1JUTU9ERV9OT05FIiwidmlzaWJsZSIsIlNPUlRNT0RFX0NVU1RPTSIsImdldFBvc2l0aW9uIiwiZm9yd2FyZCIsIlNPUlRNT0RFX0ZST05UMkJBQ0siXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFhQSxJQUFJQSxJQUFJLEVBQUVDLElB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
