import { hash32Fnv1a } from '../core/hash.js';
import { SORTMODE_MATERIALMESH, SORTMODE_BACK2FRONT, SHADER_FORWARD, LIGHTTYPE_DIRECTIONAL, LAYER_FX, SORTMODE_NONE, SORTMODE_CUSTOM, SORTMODE_FRONT2BACK, SORTKEY_FORWARD } from './constants.js';
import { Material } from './materials/material.js';

function sortManual(drawCallA, drawCallB) {
  return drawCallA.drawOrder - drawCallB.drawOrder;
}
function sortMaterialMesh(drawCallA, drawCallB) {
  const keyA = drawCallA._key[SORTKEY_FORWARD];
  const keyB = drawCallB._key[SORTKEY_FORWARD];
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
let layerCounter = 0;
const lightKeys = [];
const _tempMaterials = new Set();
class CulledInstances {
  constructor() {
    this.opaque = [];
    this.transparent = [];
  }
}
class Layer {
  constructor(options = {}) {
    var _options$enabled, _options$opaqueSortMo, _options$transparentS, _options$shaderPass;
    this.meshInstances = [];
    this.meshInstancesSet = new Set();
    this.shadowCasters = [];
    this.shadowCastersSet = new Set();
    this._visibleInstances = new WeakMap();
    this._lights = [];
    this._lightsSet = new Set();
    this._clusteredLightsSet = new Set();
    this._splitLights = [[], [], []];
    this._splitLightsDirty = true;
    this.requiresLightCube = false;
    this.cameras = [];
    this.camerasSet = new Set();
    this._dirtyComposition = false;
    if (options.id !== undefined) {
      this.id = options.id;
      layerCounter = Math.max(this.id + 1, layerCounter);
    } else {
      this.id = layerCounter++;
    }
    this.name = options.name;
    this._enabled = (_options$enabled = options.enabled) != null ? _options$enabled : true;
    this._refCounter = this._enabled ? 1 : 0;
    this.opaqueSortMode = (_options$opaqueSortMo = options.opaqueSortMode) != null ? _options$opaqueSortMo : SORTMODE_MATERIALMESH;
    this.transparentSortMode = (_options$transparentS = options.transparentSortMode) != null ? _options$transparentS : SORTMODE_BACK2FRONT;
    if (options.renderTarget) {
      this.renderTarget = options.renderTarget;
    }
    this.shaderPass = (_options$shaderPass = options.shaderPass) != null ? _options$shaderPass : SHADER_FORWARD;
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
    this.customSortCallback = null;
    this.customCalculateSortValues = null;
    this._lightHash = 0;
    this._lightHashDirty = false;
    this._lightIdHash = 0;
    this._lightIdHashDirty = false;
    this._shaderVersion = -1;
  }
  set enabled(val) {
    if (val !== this._enabled) {
      this._dirtyComposition = true;
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
    this._dirtyComposition = true;
  }
  get clearColorBuffer() {
    return this._clearColorBuffer;
  }
  set clearDepthBuffer(val) {
    this._clearDepthBuffer = val;
    this._dirtyComposition = true;
  }
  get clearDepthBuffer() {
    return this._clearDepthBuffer;
  }
  set clearStencilBuffer(val) {
    this._clearStencilBuffer = val;
    this._dirtyComposition = true;
  }
  get clearStencilBuffer() {
    return this._clearStencilBuffer;
  }
  get hasClusteredLights() {
    return this._clusteredLightsSet.size > 0;
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
      return;
    }
    this._refCounter--;
  }
  addMeshInstances(meshInstances, skipShadowCasters) {
    const destMeshInstances = this.meshInstances;
    const destMeshInstancesSet = this.meshInstancesSet;
    for (let i = 0; i < meshInstances.length; i++) {
      const mi = meshInstances[i];
      if (!destMeshInstancesSet.has(mi)) {
        destMeshInstances.push(mi);
        destMeshInstancesSet.add(mi);
        _tempMaterials.add(mi.material);
      }
    }
    if (!skipShadowCasters) {
      this.addShadowCasters(meshInstances);
    }
    if (_tempMaterials.size > 0) {
      const sceneShaderVer = this._shaderVersion;
      _tempMaterials.forEach(mat => {
        if (sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer) {
          if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
            mat.clearVariants();
          }
          mat._shaderVersion = sceneShaderVer;
        }
      });
      _tempMaterials.clear();
    }
  }
  removeMeshInstances(meshInstances, skipShadowCasters) {
    const destMeshInstances = this.meshInstances;
    const destMeshInstancesSet = this.meshInstancesSet;
    for (let i = 0; i < meshInstances.length; i++) {
      const mi = meshInstances[i];
      if (destMeshInstancesSet.has(mi)) {
        destMeshInstancesSet.delete(mi);
        const j = destMeshInstances.indexOf(mi);
        if (j >= 0) {
          destMeshInstances.splice(j, 1);
        }
      }
    }
    if (!skipShadowCasters) {
      this.removeShadowCasters(meshInstances);
    }
  }
  addShadowCasters(meshInstances) {
    const shadowCasters = this.shadowCasters;
    const shadowCastersSet = this.shadowCastersSet;
    for (let i = 0; i < meshInstances.length; i++) {
      const mi = meshInstances[i];
      if (mi.castShadow && !shadowCastersSet.has(mi)) {
        shadowCastersSet.add(mi);
        shadowCasters.push(mi);
      }
    }
  }
  removeShadowCasters(meshInstances) {
    const shadowCasters = this.shadowCasters;
    const shadowCastersSet = this.shadowCastersSet;
    for (let i = 0; i < meshInstances.length; i++) {
      const mi = meshInstances[i];
      if (shadowCastersSet.has(mi)) {
        shadowCastersSet.delete(mi);
        const j = shadowCasters.indexOf(mi);
        if (j >= 0) {
          shadowCasters.splice(j, 1);
        }
      }
    }
  }
  clearMeshInstances(skipShadowCasters = false) {
    this.meshInstances.length = 0;
    this.meshInstancesSet.clear();
    if (!skipShadowCasters) {
      this.shadowCasters.length = 0;
      this.shadowCastersSet.clear();
    }
  }
  markLightsDirty() {
    this._lightHashDirty = true;
    this._lightIdHashDirty = true;
    this._splitLightsDirty = true;
  }
  addLight(light) {
    const l = light.light;
    if (!this._lightsSet.has(l)) {
      this._lightsSet.add(l);
      this._lights.push(l);
      this.markLightsDirty();
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
      this.markLightsDirty();
    }
    if (l.type !== LIGHTTYPE_DIRECTIONAL) {
      this._clusteredLightsSet.delete(l);
    }
  }
  clearLights() {
    this._lightsSet.forEach(light => light.removeLayer(this));
    this._lightsSet.clear();
    this._clusteredLightsSet.clear();
    this._lights.length = 0;
    this.markLightsDirty();
  }
  get splitLights() {
    if (this._splitLightsDirty) {
      this._splitLightsDirty = false;
      const splitLights = this._splitLights;
      for (let i = 0; i < splitLights.length; i++) splitLights[i].length = 0;
      const lights = this._lights;
      for (let i = 0; i < lights.length; i++) {
        const light = lights[i];
        if (light.enabled) {
          splitLights[light._type].push(light);
        }
      }
      for (let i = 0; i < splitLights.length; i++) splitLights[i].sort((a, b) => a.key - b.key);
    }
    return this._splitLights;
  }
  evaluateLightHash(localLights, directionalLights, useIds) {
    let hash = 0;
    const lights = this._lights;
    for (let i = 0; i < lights.length; i++) {
      const isLocalLight = lights[i].type !== LIGHTTYPE_DIRECTIONAL;
      if (localLights && isLocalLight || directionalLights && !isLocalLight) {
        lightKeys.push(useIds ? lights[i].id : lights[i].key);
      }
    }
    if (lightKeys.length > 0) {
      lightKeys.sort();
      hash = hash32Fnv1a(lightKeys);
      lightKeys.length = 0;
    }
    return hash;
  }
  getLightHash(isClustered) {
    if (this._lightHashDirty) {
      this._lightHashDirty = false;
      this._lightHash = this.evaluateLightHash(!isClustered, true, false);
    }
    return this._lightHash;
  }
  getLightIdHash() {
    if (this._lightIdHashDirty) {
      this._lightIdHashDirty = false;
      this._lightIdHash = this.evaluateLightHash(true, false, true);
    }
    return this._lightIdHash;
  }
  addCamera(camera) {
    if (!this.camerasSet.has(camera.camera)) {
      this.camerasSet.add(camera.camera);
      this.cameras.push(camera);
      this._dirtyComposition = true;
    }
  }
  removeCamera(camera) {
    if (this.camerasSet.has(camera.camera)) {
      this.camerasSet.delete(camera.camera);
      const index = this.cameras.indexOf(camera);
      this.cameras.splice(index, 1);
      this._dirtyComposition = true;
    }
  }
  clearCameras() {
    this.cameras.length = 0;
    this.camerasSet.clear();
    this._dirtyComposition = true;
  }
  _calculateSortDistances(drawCalls, drawCallsCount, camPos, camFwd) {
    for (let i = 0; i < drawCallsCount; i++) {
      const drawCall = drawCalls[i];
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
  getCulledInstances(camera) {
    let instances = this._visibleInstances.get(camera);
    if (!instances) {
      instances = new CulledInstances();
      this._visibleInstances.set(camera, instances);
    }
    return instances;
  }
  sortVisible(camera, transparent) {
    const sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
    if (sortMode === SORTMODE_NONE) return;
    const culledInstances = this.getCulledInstances(camera);
    const instances = transparent ? culledInstances.transparent : culledInstances.opaque;
    const cameraNode = camera.node;
    if (sortMode === SORTMODE_CUSTOM) {
      const sortPos = cameraNode.getPosition();
      const sortDir = cameraNode.forward;
      if (this.customCalculateSortValues) {
        this.customCalculateSortValues(instances, instances.length, sortPos, sortDir);
      }
      if (this.customSortCallback) {
        instances.sort(this.customSortCallback);
      }
    } else {
      if (sortMode === SORTMODE_BACK2FRONT || sortMode === SORTMODE_FRONT2BACK) {
        const sortPos = cameraNode.getPosition();
        const sortDir = cameraNode.forward;
        this._calculateSortDistances(instances, instances.length, sortPos, sortDir);
      }
      instances.sort(sortCallbacks[sortMode]);
    }
  }
}

export { CulledInstances, Layer };
