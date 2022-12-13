/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { TRACEID_RENDER_ACTION } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { EventHandler } from '../../core/event-handler.js';
import { set } from '../../core/set-utils.js';
import { sortPriority } from '../../core/sort.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, COMPUPDATED_LIGHTS, COMPUPDATED_CAMERAS, COMPUPDATED_INSTANCES, LAYERID_DEPTH, COMPUPDATED_BLEND } from '../constants.js';
import { RenderAction } from './render-action.js';
import { WorldClusters } from '../lighting/world-clusters.js';
import { LightCompositionData } from './light-composition-data.js';

const tempSet = new Set();
const tempClusterArray = [];

class LayerComposition extends EventHandler {

  constructor(name = 'Untitled') {
    super();
    this.name = name;

    this.layerList = [];

    this.subLayerList = [];

    this.subLayerEnabled = [];

    this._opaqueOrder = {};
    this._transparentOrder = {};
    this._dirty = false;
    this._dirtyBlend = false;
    this._dirtyLights = false;
    this._dirtyCameras = false;

    this._meshInstances = [];
    this._meshInstancesSet = new Set();

    this._lights = [];

    this._lightsMap = new Map();

    this._lightCompositionData = [];

    this._splitLights = [[], [], []];

    this.cameras = [];

    this._renderActions = [];

    this._worldClusters = [];

    this._emptyWorldClusters = null;
  }
  destroy() {
    if (this._emptyWorldClusters) {
      this._emptyWorldClusters.destroy();
      this._emptyWorldClusters = null;
    }

    this._worldClusters.forEach(cluster => {
      cluster.destroy();
    });
    this._worldClusters = null;

    this._renderActions.forEach(ra => ra.destroy());
    this._renderActions = null;
  }

  getEmptyWorldClusters(device) {
    if (!this._emptyWorldClusters) {
      this._emptyWorldClusters = new WorldClusters(device);
      this._emptyWorldClusters.name = 'ClusterEmpty';

      this._emptyWorldClusters.update([], false, null);
    }
    return this._emptyWorldClusters;
  }

  _splitLightsArray(target) {
    const lights = target._lights;
    target._splitLights[LIGHTTYPE_DIRECTIONAL].length = 0;
    target._splitLights[LIGHTTYPE_OMNI].length = 0;
    target._splitLights[LIGHTTYPE_SPOT].length = 0;
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      if (light.enabled) {
        target._splitLights[light._type].push(light);
      }
    }
  }
  _update(device, clusteredLightingEnabled = false) {
    const len = this.layerList.length;
    let result = 0;

    if (!this._dirty || !this._dirtyLights || !this._dirtyCameras) {
      for (let i = 0; i < len; i++) {
        const layer = this.layerList[i];
        if (layer._dirty) {
          this._dirty = true;
        }
        if (layer._dirtyLights) {
          this._dirtyLights = true;
        }
        if (layer._dirtyCameras) {
          this._dirtyCameras = true;
        }
      }
    }

    function addUniqueMeshInstance(destArray, destSet, srcArray) {
      let dirtyBlend = false;
      const srcLen = srcArray.length;
      for (let s = 0; s < srcLen; s++) {
        const meshInst = srcArray[s];
        if (!destSet.has(meshInst)) {
          destSet.add(meshInst);
          destArray.push(meshInst);
          const material = meshInst.material;
          if (material && material._dirtyBlend) {
            dirtyBlend = true;
            material._dirtyBlend = false;
          }
        }
      }
      return dirtyBlend;
    }

    if (this._dirty) {
      result |= COMPUPDATED_INSTANCES;
      this._meshInstances.length = 0;
      this._meshInstancesSet.clear();
      for (let i = 0; i < len; i++) {
        const layer = this.layerList[i];
        if (!layer.passThrough) {
          this._dirtyBlend = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.opaqueMeshInstances) || this._dirtyBlend;
          this._dirtyBlend = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.transparentMeshInstances) || this._dirtyBlend;
        }
        layer._dirty = false;
      }
      this._dirty = false;
    }

    function moveByBlendType(dest, src, moveTransparent) {
      for (let s = 0; s < src.length;) {
        var _src$s$material;
        if (((_src$s$material = src[s].material) == null ? void 0 : _src$s$material.transparent) === moveTransparent) {
          dest.push(src[s]);

          src[s] = src[src.length - 1];
          src.length--;
        } else {
          s++;
        }
      }
    }

    if (this._dirtyBlend) {
      result |= COMPUPDATED_BLEND;
      for (let i = 0; i < len; i++) {
        const layer = this.layerList[i];
        if (!layer.passThrough) {
          moveByBlendType(layer.opaqueMeshInstances, layer.transparentMeshInstances, false);

          moveByBlendType(layer.transparentMeshInstances, layer.opaqueMeshInstances, true);
        }
      }
      this._dirtyBlend = false;
    }
    if (this._dirtyLights) {
      result |= COMPUPDATED_LIGHTS;
      this._dirtyLights = false;
      this.updateLights();
    }

    if (result) {
      this.updateShadowCasters();
    }
    if (this._dirtyCameras || result & COMPUPDATED_LIGHTS) {
      this._dirtyCameras = false;
      result |= COMPUPDATED_CAMERAS;

      this.cameras.length = 0;
      for (let i = 0; i < len; i++) {
        const layer = this.layerList[i];
        layer._dirtyCameras = false;

        for (let j = 0; j < layer.cameras.length; j++) {
          const camera = layer.cameras[j];
          const index = this.cameras.indexOf(camera);
          if (index < 0) {
            this.cameras.push(camera);
          }
        }
      }

      if (this.cameras.length > 1) {
        sortPriority(this.cameras);
      }

      const cameraLayers = [];

      let renderActionCount = 0;
      for (let i = 0; i < this.cameras.length; i++) {
        const camera = this.cameras[i];
        cameraLayers.length = 0;

        let cameraFirstRenderAction = true;
        const cameraFirstRenderActionIndex = renderActionCount;

        let lastRenderAction = null;

        let postProcessMarked = false;

        for (let j = 0; j < len; j++) {
          const layer = this.layerList[j];
          if (layer) {
            if (layer.cameras.length > 0) {
              if (camera.layers.indexOf(layer.id) >= 0) {
                cameraLayers.push(layer);

                if (!postProcessMarked && layer.id === camera.disablePostEffectsLayer) {
                  postProcessMarked = true;

                  if (lastRenderAction) {
                    lastRenderAction.triggerPostprocess = true;
                  }
                }

                const cameraIndex = layer.cameras.indexOf(camera);
                if (cameraIndex >= 0) {
                  lastRenderAction = this.addRenderAction(this._renderActions, renderActionCount, layer, j, cameraIndex, cameraFirstRenderAction, postProcessMarked);
                  renderActionCount++;
                  cameraFirstRenderAction = false;
                }
              }
            }
          }
        }

        if (cameraFirstRenderActionIndex < renderActionCount) {
          this._renderActions[cameraFirstRenderActionIndex].collectDirectionalLights(cameraLayers, this._splitLights[LIGHTTYPE_DIRECTIONAL], this._lights);

          lastRenderAction.lastCameraUse = true;
        }

        if (!postProcessMarked && lastRenderAction) {
          lastRenderAction.triggerPostprocess = true;
        }

        if (camera.renderTarget && camera.postEffectsEnabled) {
          this.propagateRenderTarget(cameraFirstRenderActionIndex - 1, camera);
        }
      }

      for (let i = renderActionCount; i < this._renderActions.length; i++) {
        this._renderActions[i].destroy();
      }
      this._renderActions.length = renderActionCount;
    }

    if (result & (COMPUPDATED_CAMERAS | COMPUPDATED_LIGHTS | COMPUPDATED_INSTANCES)) {
      if (clusteredLightingEnabled) {
        this.allocateLightClusters(device);
      }
    }
    if (result & (COMPUPDATED_LIGHTS | COMPUPDATED_LIGHTS)) {
      this._logRenderActions();
    }
    return result;
  }
  updateShadowCasters() {
    const lightCount = this._lights.length;
    for (let i = 0; i < lightCount; i++) {
      this._lightCompositionData[i].clearShadowCasters();
    }

    const len = this.layerList.length;
    for (let i = 0; i < len; i++) {
      const layer = this.layerList[i];

      if (!tempSet.has(layer)) {
        tempSet.add(layer);

        const lights = layer._lights;
        for (let j = 0; j < lights.length; j++) {
          if (lights[j].castShadows) {
            const lightIndex = this._lightsMap.get(lights[j]);
            const lightCompData = this._lightCompositionData[lightIndex];

            lightCompData.addShadowCasters(layer.shadowCasters);
          }
        }
      }
    }
    tempSet.clear();
  }
  updateLights() {
    this._lights.length = 0;
    this._lightsMap.clear();
    const count = this.layerList.length;
    for (let i = 0; i < count; i++) {
      const layer = this.layerList[i];

      if (!tempSet.has(layer)) {
        tempSet.add(layer);
        const lights = layer._lights;
        for (let j = 0; j < lights.length; j++) {
          const light = lights[j];

          let lightIndex = this._lightsMap.get(light);
          if (lightIndex === undefined) {
            lightIndex = this._lights.length;
            this._lightsMap.set(light, lightIndex);
            this._lights.push(light);

            let lightCompData = this._lightCompositionData[lightIndex];
            if (!lightCompData) {
              lightCompData = new LightCompositionData();
              this._lightCompositionData[lightIndex] = lightCompData;
            }
          }
        }
      }

      this._splitLightsArray(layer);
      layer._dirtyLights = false;
    }
    tempSet.clear();

    this._splitLightsArray(this);

    const lightCount = this._lights.length;
    this._lightCompositionData.length = lightCount;
  }

  findCompatibleCluster(layer, renderActionCount, emptyWorldClusters) {
    for (let i = 0; i < renderActionCount; i++) {
      const ra = this._renderActions[i];
      const raLayer = this.layerList[ra.layerIndex];

      if (ra.lightClusters !== emptyWorldClusters) {
        if (layer === raLayer) {
          return ra.lightClusters;
        }
        if (ra.lightClusters) {
          if (set.equals(layer._clusteredLightsSet, raLayer._clusteredLightsSet)) {
            return ra.lightClusters;
          }
        }
      }
    }

    return null;
  }

  allocateLightClusters(device) {
    tempClusterArray.push(...this._worldClusters);

    const emptyWorldClusters = this.getEmptyWorldClusters(device);

    this._worldClusters.length = 0;

    const count = this._renderActions.length;
    for (let i = 0; i < count; i++) {
      const ra = this._renderActions[i];
      const layer = this.layerList[ra.layerIndex];

      if (layer.hasClusteredLights) {
        const transparent = this.subLayerList[ra.layerIndex];
        const meshInstances = transparent ? layer.transparentMeshInstances : layer.opaqueMeshInstances;
        if (meshInstances.length) {
          let clusters = this.findCompatibleCluster(layer, i, emptyWorldClusters);
          if (!clusters) {
            if (tempClusterArray.length) {
              clusters = tempClusterArray.pop();
            }

            if (!clusters) {
              clusters = new WorldClusters(device);
            }
            clusters.name = 'Cluster-' + this._worldClusters.length;
            this._worldClusters.push(clusters);
          }
          ra.lightClusters = clusters;
        }
      }

      if (!ra.lightClusters) {
        ra.lightClusters = emptyWorldClusters;
      }
    }

    tempClusterArray.forEach(item => {
      item.destroy();
    });
    tempClusterArray.length = 0;
  }

  addRenderAction(renderActions, renderActionIndex, layer, layerIndex, cameraIndex, cameraFirstRenderAction, postProcessMarked) {
    let renderAction = renderActions[renderActionIndex];
    if (!renderAction) {
      renderAction = renderActions[renderActionIndex] = new RenderAction();
    }

    let rt = layer.renderTarget;
    const camera = layer.cameras[cameraIndex];
    if (camera && camera.renderTarget) {
      if (layer.id !== LAYERID_DEPTH) {
        rt = camera.renderTarget;
      }
    }

    let used = false;
    for (let i = renderActionIndex - 1; i >= 0; i--) {
      if (renderActions[i].camera === camera && renderActions[i].renderTarget === rt) {
        used = true;
        break;
      }
    }

    const needsClear = cameraFirstRenderAction || !used;
    let clearColor = needsClear ? camera.clearColorBuffer : false;
    let clearDepth = needsClear ? camera.clearDepthBuffer : false;
    let clearStencil = needsClear ? camera.clearStencilBuffer : false;

    clearColor || (clearColor = layer.clearColorBuffer);
    clearDepth || (clearDepth = layer.clearDepthBuffer);
    clearStencil || (clearStencil = layer.clearStencilBuffer);

    if (postProcessMarked && camera.postEffectsEnabled) {
      rt = null;
    }

    renderAction.reset();
    renderAction.triggerPostprocess = false;
    renderAction.layerIndex = layerIndex;
    renderAction.cameraIndex = cameraIndex;
    renderAction.camera = camera;
    renderAction.renderTarget = rt;
    renderAction.clearColor = clearColor;
    renderAction.clearDepth = clearDepth;
    renderAction.clearStencil = clearStencil;
    renderAction.firstCameraUse = cameraFirstRenderAction;
    renderAction.lastCameraUse = false;
    return renderAction;
  }

  propagateRenderTarget(startIndex, fromCamera) {
    for (let a = startIndex; a >= 0; a--) {
      const ra = this._renderActions[a];
      const layer = this.layerList[ra.layerIndex];

      if (ra.renderTarget && layer.id !== LAYERID_DEPTH) {
        break;
      }

      if (layer.id === LAYERID_DEPTH) {
        continue;
      }

      const thisCamera = ra == null ? void 0 : ra.camera.camera;
      if (thisCamera) {
        if (!fromCamera.camera.rect.equals(thisCamera.rect) || !fromCamera.camera.scissorRect.equals(thisCamera.scissorRect)) {
          break;
        }
      }

      ra.renderTarget = fromCamera.renderTarget;
    }
  }

  _logRenderActions() {
    if (Tracing.get(TRACEID_RENDER_ACTION)) {
      Debug.trace(TRACEID_RENDER_ACTION, 'Render Actions for composition: ' + this.name);
      for (let i = 0; i < this._renderActions.length; i++) {
        const ra = this._renderActions[i];
        const layerIndex = ra.layerIndex;
        const layer = this.layerList[layerIndex];
        const enabled = layer.enabled && this.subLayerEnabled[layerIndex];
        const transparent = this.subLayerList[layerIndex];
        const camera = layer.cameras[ra.cameraIndex];
        const dirLightCount = ra.directionalLights.length;
        const clear = (ra.clearColor ? 'Color ' : '..... ') + (ra.clearDepth ? 'Depth ' : '..... ') + (ra.clearStencil ? 'Stencil' : '.......');
        Debug.trace(TRACEID_RENDER_ACTION, i + (' Cam: ' + (camera ? camera.entity.name : '-')).padEnd(22, ' ') + (' Lay: ' + layer.name).padEnd(22, ' ') + (transparent ? ' TRANSP' : ' OPAQUE') + (enabled ? ' ENABLED ' : ' DISABLED') + ' Meshes: ', (transparent ? layer.transparentMeshInstances.length : layer.opaqueMeshInstances.length).toString().padStart(4) + (' RT: ' + (ra.renderTarget ? ra.renderTarget.name : '-')).padEnd(30, ' ') + ' Clear: ' + clear + ' Lights: (' + layer._clusteredLightsSet.size + '/' + layer._lightsSet.size + ')' + ' ' + (ra.lightClusters !== this._emptyWorldClusters ? ra.lightClusters.name : '').padEnd(10, ' ') + (ra.firstCameraUse ? ' CAM-FIRST' : '') + (ra.lastCameraUse ? ' CAM-LAST' : '') + (ra.triggerPostprocess ? ' POSTPROCESS' : '') + (dirLightCount ? ' DirLights: ' + dirLightCount : ''));
      }
    }
  }
  _isLayerAdded(layer) {
    if (this.layerList.indexOf(layer) >= 0) {
      Debug.error('Layer is already added.');
      return true;
    }
    return false;
  }
  _isSublayerAdded(layer, transparent) {
    for (let i = 0; i < this.layerList.length; i++) {
      if (this.layerList[i] === layer && this.subLayerList[i] === transparent) {
        Debug.error('Sublayer is already added.');
        return true;
      }
    }
    return false;
  }

  push(layer) {
    if (this._isLayerAdded(layer)) return;
    this.layerList.push(layer);
    this.layerList.push(layer);
    this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
    this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
    this.subLayerEnabled.push(true);
    this.subLayerEnabled.push(true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire('add', layer);
  }

  insert(layer, index) {
    if (this._isLayerAdded(layer)) return;
    this.layerList.splice(index, 0, layer, layer);
    this.subLayerList.splice(index, 0, false, true);
    const count = this.layerList.length;
    this._updateOpaqueOrder(index, count - 1);
    this._updateTransparentOrder(index, count - 1);
    this.subLayerEnabled.splice(index, 0, true, true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire('add', layer);
  }

  remove(layer) {
    let id = this.layerList.indexOf(layer);
    delete this._opaqueOrder[id];
    delete this._transparentOrder[id];
    while (id >= 0) {
      this.layerList.splice(id, 1);
      this.subLayerList.splice(id, 1);
      this.subLayerEnabled.splice(id, 1);
      id = this.layerList.indexOf(layer);
      this._dirty = true;
      this._dirtyLights = true;
      this._dirtyCameras = true;
      this.fire('remove', layer);
    }

    const count = this.layerList.length;
    this._updateOpaqueOrder(0, count - 1);
    this._updateTransparentOrder(0, count - 1);
  }

  pushOpaque(layer) {
    if (this._isSublayerAdded(layer, false)) return;
    this.layerList.push(layer);
    this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
    this.subLayerEnabled.push(true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire('add', layer);
  }

  insertOpaque(layer, index) {
    if (this._isSublayerAdded(layer, false)) return;
    this.layerList.splice(index, 0, layer);
    this.subLayerList.splice(index, 0, false);
    const count = this.subLayerList.length;
    this._updateOpaqueOrder(index, count - 1);
    this.subLayerEnabled.splice(index, 0, true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire('add', layer);
  }

  removeOpaque(layer) {
    for (let i = 0, len = this.layerList.length; i < len; i++) {
      if (this.layerList[i] === layer && !this.subLayerList[i]) {
        this.layerList.splice(i, 1);
        this.subLayerList.splice(i, 1);
        len--;
        this._updateOpaqueOrder(i, len - 1);
        this.subLayerEnabled.splice(i, 1);
        this._dirty = true;
        this._dirtyLights = true;
        this._dirtyCameras = true;
        if (this.layerList.indexOf(layer) < 0) {
          this.fire('remove', layer);
        }

        return;
      }
    }
  }

  pushTransparent(layer) {
    if (this._isSublayerAdded(layer, true)) return;
    this.layerList.push(layer);
    this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
    this.subLayerEnabled.push(true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire('add', layer);
  }

  insertTransparent(layer, index) {
    if (this._isSublayerAdded(layer, true)) return;
    this.layerList.splice(index, 0, layer);
    this.subLayerList.splice(index, 0, true);
    const count = this.subLayerList.length;
    this._updateTransparentOrder(index, count - 1);
    this.subLayerEnabled.splice(index, 0, true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire('add', layer);
  }

  removeTransparent(layer) {
    for (let i = 0, len = this.layerList.length; i < len; i++) {
      if (this.layerList[i] === layer && this.subLayerList[i]) {
        this.layerList.splice(i, 1);
        this.subLayerList.splice(i, 1);
        len--;
        this._updateTransparentOrder(i, len - 1);
        this.subLayerEnabled.splice(i, 1);
        this._dirty = true;
        this._dirtyLights = true;
        this._dirtyCameras = true;
        if (this.layerList.indexOf(layer) < 0) {
          this.fire('remove', layer);
        }

        return;
      }
    }
  }
  _getSublayerIndex(layer, transparent) {
    let id = this.layerList.indexOf(layer);
    if (id < 0) return -1;
    if (this.subLayerList[id] !== transparent) {
      id = this.layerList.indexOf(layer, id + 1);
      if (id < 0) return -1;
      if (this.subLayerList[id] !== transparent) {
        return -1;
      }
    }
    return id;
  }

  getOpaqueIndex(layer) {
    return this._getSublayerIndex(layer, false);
  }

  getTransparentIndex(layer) {
    return this._getSublayerIndex(layer, true);
  }

  getLayerById(id) {
    for (let i = 0; i < this.layerList.length; i++) {
      if (this.layerList[i].id === id) return this.layerList[i];
    }
    return null;
  }

  getLayerByName(name) {
    for (let i = 0; i < this.layerList.length; i++) {
      if (this.layerList[i].name === name) return this.layerList[i];
    }
    return null;
  }
  _updateOpaqueOrder(startIndex, endIndex) {
    for (let i = startIndex; i <= endIndex; i++) {
      if (this.subLayerList[i] === false) {
        this._opaqueOrder[this.layerList[i].id] = i;
      }
    }
  }
  _updateTransparentOrder(startIndex, endIndex) {
    for (let i = startIndex; i <= endIndex; i++) {
      if (this.subLayerList[i] === true) {
        this._transparentOrder[this.layerList[i].id] = i;
      }
    }
  }

  _sortLayersDescending(layersA, layersB, order) {
    let topLayerA = -1;
    let topLayerB = -1;

    for (let i = 0, len = layersA.length; i < len; i++) {
      const id = layersA[i];
      if (order.hasOwnProperty(id)) {
        topLayerA = Math.max(topLayerA, order[id]);
      }
    }

    for (let i = 0, len = layersB.length; i < len; i++) {
      const id = layersB[i];
      if (order.hasOwnProperty(id)) {
        topLayerB = Math.max(topLayerB, order[id]);
      }
    }

    if (topLayerA === -1 && topLayerB !== -1) {
      return 1;
    } else if (topLayerB === -1 && topLayerA !== -1) {
      return -1;
    }

    return topLayerB - topLayerA;
  }

  sortTransparentLayers(layersA, layersB) {
    return this._sortLayersDescending(layersA, layersB, this._transparentOrder);
  }

  sortOpaqueLayers(layersA, layersB) {
    return this._sortLayersDescending(layersA, layersB, this._opaqueOrder);
  }
}

export { LayerComposition };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXItY29tcG9zaXRpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUUkFDRUlEX1JFTkRFUl9BQ1RJT04gfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVHJhY2luZyB9IGZyb20gJy4uLy4uL2NvcmUvdHJhY2luZy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgc2V0IH0gZnJvbSAnLi4vLi4vY29yZS9zZXQtdXRpbHMuanMnO1xuaW1wb3J0IHsgc29ydFByaW9yaXR5IH0gZnJvbSAnLi4vLi4vY29yZS9zb3J0LmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUklEX0RFUFRILFxuICAgIENPTVBVUERBVEVEX0JMRU5ELCBDT01QVVBEQVRFRF9DQU1FUkFTLCBDT01QVVBEQVRFRF9JTlNUQU5DRVMsIENPTVBVUERBVEVEX0xJR0hUUyxcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJBY3Rpb24gfSBmcm9tICcuL3JlbmRlci1hY3Rpb24uanMnO1xuaW1wb3J0IHsgV29ybGRDbHVzdGVycyB9IGZyb20gJy4uL2xpZ2h0aW5nL3dvcmxkLWNsdXN0ZXJzLmpzJztcbmltcG9ydCB7IExpZ2h0Q29tcG9zaXRpb25EYXRhIH0gZnJvbSAnLi9saWdodC1jb21wb3NpdGlvbi1kYXRhLmpzJztcblxuY29uc3QgdGVtcFNldCA9IG5ldyBTZXQoKTtcbmNvbnN0IHRlbXBDbHVzdGVyQXJyYXkgPSBbXTtcblxuLyoqXG4gKiBMYXllciBDb21wb3NpdGlvbiBpcyBhIGNvbGxlY3Rpb24gb2Yge0BsaW5rIExheWVyfSB0aGF0IGlzIGZlZCB0byB7QGxpbmsgU2NlbmUjbGF5ZXJzfSB0byBkZWZpbmVcbiAqIHJlbmRlcmluZyBvcmRlci5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIExheWVyQ29tcG9zaXRpb24gZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8vIENvbXBvc2l0aW9uIGNhbiBob2xkIG9ubHkgMiBzdWJsYXllcnMgb2YgZWFjaCBsYXllclxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIE9wdGlvbmFsIG5vbi11bmlxdWUgbmFtZSBvZiB0aGUgbGF5ZXIgY29tcG9zaXRpb24uIERlZmF1bHRzIHRvXG4gICAgICogXCJVbnRpdGxlZFwiIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobmFtZSA9ICdVbnRpdGxlZCcpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIHJlYWQtb25seSBhcnJheSBvZiB7QGxpbmsgTGF5ZXJ9IHNvcnRlZCBpbiB0aGUgb3JkZXIgdGhleSB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxheWVyTGlzdCA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIHJlYWQtb25seSBhcnJheSBvZiBib29sZWFuIHZhbHVlcywgbWF0Y2hpbmcge0BsaW5rIExheWVyI2xheWVyTGlzdH0uIFRydWUgbWVhbnMgb25seVxuICAgICAgICAgKiBzZW1pLXRyYW5zcGFyZW50IG9iamVjdHMgYXJlIHJlbmRlcmVkLCBhbmQgZmFsc2UgbWVhbnMgb3BhcXVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbltdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zdWJMYXllckxpc3QgPSBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2YgYm9vbGVhbiB2YWx1ZXMsIG1hdGNoaW5nIHtAbGluayBMYXllciNsYXllckxpc3R9LiBUcnVlIG1lYW5zIHRoZVxuICAgICAgICAgKiBsYXllciBpcyByZW5kZXJlZCwgZmFsc2UgbWVhbnMgaXQncyBza2lwcGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbltdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQgPSBbXTsgLy8gbW9yZSBncmFudWxhciBjb250cm9sIG9uIHRvcCBvZiBsYXllci5lbmFibGVkIChBTkRlZClcblxuICAgICAgICB0aGlzLl9vcGFxdWVPcmRlciA9IHt9O1xuICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyID0ge307XG5cbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSBmYWxzZTtcblxuICAgICAgICAvLyBhbGwgdW5pcXVlIG1lc2hJbnN0YW5jZXMgZnJvbSBhbGwgbGF5ZXJzLCBzdG9yZWQgYm90aCBhcyBhbiBhcnJheSwgYW5kIGFsc28gYSBzZXQgZm9yIGZhc3Qgc2VhcmNoXG4gICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1NldCA9IG5ldyBTZXQoKTtcblxuICAgICAgICAvLyBhbiBhcnJheSBvZiBhbGwgdW5pcXVlIGxpZ2h0cyBmcm9tIGFsbCBsYXllcnNcbiAgICAgICAgdGhpcy5fbGlnaHRzID0gW107XG5cbiAgICAgICAgLy8gYSBtYXAgb2YgTGlnaHQgdG8gaW5kZXggaW4gX2xpZ2h0cyBmb3IgZmFzdCBsb29rdXBcbiAgICAgICAgdGhpcy5fbGlnaHRzTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIGVhY2ggZW50cnkgaW4gX2xpZ2h0cyBoYXMgZW50cnkgb2YgdHlwZSBMaWdodENvbXBvc2l0aW9uRGF0YSBoZXJlIGF0IHRoZSBzYW1lIGluZGV4LFxuICAgICAgICAvLyBzdG9yaW5nIHNoYWRvdyBjYXN0ZXJzIGFuZCBhZGRpdGlvbmFsIGNvbXBvc2l0aW9uIHJlbGF0ZWQgZGF0YSBmb3IgdGhlIGxpZ2h0XG4gICAgICAgIHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhID0gW107XG5cbiAgICAgICAgLy8gX2xpZ2h0cyBzcGxpdCBpbnRvIGFycmF5cyBwZXIgdHlwZSBvZiBsaWdodCwgaW5kZXhlZCBieSBMSUdIVFRZUEVfKioqIGNvbnN0YW50c1xuICAgICAgICB0aGlzLl9zcGxpdExpZ2h0cyA9IFtbXSwgW10sIFtdXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2Yge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gdGhhdCBjYW4gYmUgdXNlZCBkdXJpbmcgcmVuZGVyaW5nLiBlLmcuXG4gICAgICAgICAqIEluc2lkZSB7QGxpbmsgTGF5ZXIjb25QcmVDdWxsfSwge0BsaW5rIExheWVyI29uUG9zdEN1bGx9LCB7QGxpbmsgTGF5ZXIjb25QcmVSZW5kZXJ9LFxuICAgICAgICAgKiB7QGxpbmsgTGF5ZXIjb25Qb3N0UmVuZGVyfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jYW1lcmFzID0gW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhY3R1YWwgcmVuZGVyaW5nIHNlcXVlbmNlLCBnZW5lcmF0ZWQgYmFzZWQgb24gbGF5ZXJzIGFuZCBjYW1lcmFzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtSZW5kZXJBY3Rpb25bXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9ucyA9IFtdO1xuXG4gICAgICAgIC8vIGFsbCBjdXJyZW50bHkgY3JlYXRlZCBsaWdodCBjbHVzdGVycywgdGhhdCBuZWVkIHRvIGJlIHVwZGF0ZWQgYmVmb3JlIHJlbmRlcmluZ1xuICAgICAgICB0aGlzLl93b3JsZENsdXN0ZXJzID0gW107XG5cbiAgICAgICAgLy8gZW1wdHkgY2x1c3RlciB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMgPSBudWxsO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIGVtcHR5IGxpZ2h0IGNsdXN0ZXJcbiAgICAgICAgaWYgKHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycykge1xuICAgICAgICAgICAgdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhbGwgb3RoZXIgY2x1c3RlcnNcbiAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycy5mb3JFYWNoKChjbHVzdGVyKSA9PiB7XG4gICAgICAgICAgICBjbHVzdGVyLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3dvcmxkQ2x1c3RlcnMgPSBudWxsO1xuXG4gICAgICAgIC8vIHJlbmRlciBhY3Rpb25zXG4gICAgICAgIHRoaXMuX3JlbmRlckFjdGlvbnMuZm9yRWFjaChyYSA9PiByYS5kZXN0cm95KCkpO1xuICAgICAgICB0aGlzLl9yZW5kZXJBY3Rpb25zID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIGFuIGVtcHR5IGxpZ2h0IGNsdXN0ZXIgb2JqZWN0IHRvIGJlIHVzZWQgd2hlbiBubyBsaWdodHMgYXJlIHVzZWRcbiAgICBnZXRFbXB0eVdvcmxkQ2x1c3RlcnMoZGV2aWNlKSB7XG4gICAgICAgIGlmICghdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBjbHVzdGVyIHN0cnVjdHVyZSB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICAgICAgdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzID0gbmV3IFdvcmxkQ2x1c3RlcnMoZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycy5uYW1lID0gJ0NsdXN0ZXJFbXB0eSc7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBpdCBvbmNlIHRvIGF2b2lkIGRvaW5nIGl0IGVhY2ggZnJhbWVcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycy51cGRhdGUoW10sIGZhbHNlLCBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnM7XG4gICAgfVxuXG4gICAgLy8gZnVuY3Rpb24gd2hpY2ggc3BsaXRzIGxpc3Qgb2YgbGlnaHRzIG9uIGEgYSB0YXJnZXQgb2JqZWN0IGludG8gc2VwYXJhdGUgbGlzdHMgb2YgbGlnaHRzIGJhc2VkIG9uIGxpZ2h0IHR5cGVcbiAgICBfc3BsaXRMaWdodHNBcnJheSh0YXJnZXQpIHtcbiAgICAgICAgY29uc3QgbGlnaHRzID0gdGFyZ2V0Ll9saWdodHM7XG4gICAgICAgIHRhcmdldC5fc3BsaXRMaWdodHNbTElHSFRUWVBFX0RJUkVDVElPTkFMXS5sZW5ndGggPSAwO1xuICAgICAgICB0YXJnZXQuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXS5sZW5ndGggPSAwO1xuICAgICAgICB0YXJnZXQuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXS5sZW5ndGggPSAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGlmIChsaWdodC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Ll9zcGxpdExpZ2h0c1tsaWdodC5fdHlwZV0ucHVzaChsaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlKGRldmljZSwgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gZmFsc2UpIHtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICBsZXQgcmVzdWx0ID0gMDtcblxuICAgICAgICAvLyBpZiBjb21wb3NpdGlvbiBkaXJ0eSBmbGFncyBhcmUgbm90IHNldCwgdGVzdCBpZiBsYXllcnMgYXJlIG1hcmtlZCBkaXJ0eVxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5IHx8ICF0aGlzLl9kaXJ0eUxpZ2h0cyB8fCAhdGhpcy5fZGlydHlDYW1lcmFzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX2RpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLl9kaXJ0eUxpZ2h0cykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsYXllci5fZGlydHlDYW1lcmFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZnVuY3Rpb24gYWRkcyB1bmlxdWUgbWVzaEluc3RhbmNlcyBmcm9tIHNyYyBhcnJheSBpbnRvIGRlc3RBcnJheS4gQSBkZXN0U2V0IGlzIGEgU2V0IGNvbnRhaW5pbmcgYWxyZWFkeVxuICAgICAgICAvLyBleGlzdGluZyBtZXNoSW5zdGFuY2VzICB0byBhY2NlbGVyYXRlIHRoZSByZW1vdmFsIG9mIGR1cGxpY2F0ZXNcbiAgICAgICAgLy8gcmV0dXJucyB0cnVlIGlmIGFueSBvZiB0aGUgbWF0ZXJpYWxzIG9uIHRoZXNlIG1lc2hJbnN0YW5jZXMgaGFzIF9kaXJ0eUJsZW5kIHNldFxuICAgICAgICBmdW5jdGlvbiBhZGRVbmlxdWVNZXNoSW5zdGFuY2UoZGVzdEFycmF5LCBkZXN0U2V0LCBzcmNBcnJheSkge1xuICAgICAgICAgICAgbGV0IGRpcnR5QmxlbmQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IHNyY0xlbiA9IHNyY0FycmF5Lmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IHMgPSAwOyBzIDwgc3JjTGVuOyBzKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5zdCA9IHNyY0FycmF5W3NdO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFkZXN0U2V0LmhhcyhtZXNoSW5zdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzdFNldC5hZGQobWVzaEluc3QpO1xuICAgICAgICAgICAgICAgICAgICBkZXN0QXJyYXkucHVzaChtZXNoSW5zdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBtZXNoSW5zdC5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsICYmIG1hdGVyaWFsLl9kaXJ0eUJsZW5kKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLl9kaXJ0eUJsZW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGlydHlCbGVuZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlYnVpbGQgdGhpcy5fbWVzaEluc3RhbmNlcyBhcnJheSAtIGFkZCBhbGwgdW5pcXVlIG1lc2hJbnN0YW5jZXMgZnJvbSBhbGwgbGF5ZXJzIHRvIGl0XG4gICAgICAgIC8vIGFsc28gc2V0IHRoaXMuX2RpcnR5QmxlbmQgdG8gdHJ1ZSBpZiBtYXRlcmlhbCBvZiBhbnkgbWVzaEluc3RhbmNlIGhhcyBfZGlydHlCbGVuZCBzZXQsIGFuZCBjbGVhciB0aG9zZSBmbGFncyBvbiBtYXRlcmlhbHNcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5KSB7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfSU5TVEFOQ0VTO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1NldC5jbGVhcigpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyLnBhc3NUaHJvdWdoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIG1lc2hJbnN0YW5jZXMgZnJvbSBib3RoIG9wYXF1ZSBhbmQgdHJhbnNwYXJlbnQgbGlzdHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGFkZFVuaXF1ZU1lc2hJbnN0YW5jZSh0aGlzLl9tZXNoSW5zdGFuY2VzLCB0aGlzLl9tZXNoSW5zdGFuY2VzU2V0LCBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzKSB8fCB0aGlzLl9kaXJ0eUJsZW5kO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUJsZW5kID0gYWRkVW5pcXVlTWVzaEluc3RhbmNlKHRoaXMuX21lc2hJbnN0YW5jZXMsIHRoaXMuX21lc2hJbnN0YW5jZXNTZXQsIGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcykgfHwgdGhpcy5fZGlydHlCbGVuZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsYXllci5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZ1bmN0aW9uIG1vdmVzIHRyYW5zcGFyZW50IG9yIG9wYXF1ZSBtZXNoZXMgYmFzZWQgb24gbW92ZVRyYW5zcGFyZW50IGZyb20gc3JjIHRvIGRlc3QgYXJyYXlcbiAgICAgICAgZnVuY3Rpb24gbW92ZUJ5QmxlbmRUeXBlKGRlc3QsIHNyYywgbW92ZVRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzID0gMDsgcyA8IHNyYy5sZW5ndGg7KSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3JjW3NdLm1hdGVyaWFsPy50cmFuc3BhcmVudCA9PT0gbW92ZVRyYW5zcGFyZW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIGl0IHRvIGRlc3RcbiAgICAgICAgICAgICAgICAgICAgZGVzdC5wdXNoKHNyY1tzXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGl0IGZyb20gc3JjXG4gICAgICAgICAgICAgICAgICAgIHNyY1tzXSA9IHNyY1tzcmMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgICAgIHNyYy5sZW5ndGgtLTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8ganVzdCBza2lwIGl0XG4gICAgICAgICAgICAgICAgICAgIHMrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3IgZWFjaCBsYXllciwgc3BsaXQgaXRzIG1lc2hJbnN0YW5jZXMgdG8gZWl0aGVyIG9wYXF1ZSBvciB0cmFuc3BhcmVudCBhcnJheSBiYXNlZCBvbiBtYXRlcmlhbCBibGVuZCB0eXBlXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUJsZW5kKSB7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfQkxFTkQ7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgICAgIGlmICghbGF5ZXIucGFzc1Rocm91Z2gpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtb3ZlIGFueSBvcGFxdWUgbWVzaEluc3RhbmNlcyBmcm9tIHRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyB0byBvcGFxdWVNZXNoSW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgICAgIG1vdmVCeUJsZW5kVHlwZShsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzLCBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMsIGZhbHNlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtb3ZlIGFueSB0cmFuc3BhcmVudCBtZXNoSW5zdGFuY2VzIGZyb20gb3BhcXVlTWVzaEluc3RhbmNlcyB0byB0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXNcbiAgICAgICAgICAgICAgICAgICAgbW92ZUJ5QmxlbmRUeXBlKGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcywgbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TGlnaHRzKSB7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfTElHSFRTO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy51cGRhdGVMaWdodHMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIG1lc2hlcyBPUiBsaWdodHMgY2hhbmdlZCwgcmVidWlsZCBzaGFkb3cgY2FzdGVyc1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRvd0Nhc3RlcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUNhbWVyYXMgfHwgKHJlc3VsdCAmIENPTVBVUERBVEVEX0xJR0hUUykpIHtcblxuICAgICAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gZmFsc2U7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfQ0FNRVJBUztcblxuICAgICAgICAgICAgLy8gd2FsayB0aGUgbGF5ZXJzIGFuZCBidWlsZCBhbiBhcnJheSBvZiB1bmlxdWUgY2FtZXJhcyBmcm9tIGFsbCBsYXllcnNcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgICAgICAgICAgbGF5ZXIuX2RpcnR5Q2FtZXJhcyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgLy8gZm9yIGFsbCBjYW1lcmFzIGluIHRoZSBsYXllclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuY2FtZXJhcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW2pdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2FtZXJhcy5wdXNoKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNvcnQgY2FtZXJhcyBieSBwcmlvcml0eVxuICAgICAgICAgICAgaWYgKHRoaXMuY2FtZXJhcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgc29ydFByaW9yaXR5KHRoaXMuY2FtZXJhcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvbGxlY3QgYSBsaXN0IG9mIGxheWVycyB0aGlzIGNhbWVyYSByZW5kZXJzXG4gICAgICAgICAgICBjb25zdCBjYW1lcmFMYXllcnMgPSBbXTtcblxuICAgICAgICAgICAgLy8gcmVuZGVyIGluIG9yZGVyIG9mIGNhbWVyYXMgc29ydGVkIGJ5IHByaW9yaXR5XG4gICAgICAgICAgICBsZXQgcmVuZGVyQWN0aW9uQ291bnQgPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNhbWVyYXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSB0aGlzLmNhbWVyYXNbaV07XG4gICAgICAgICAgICAgICAgY2FtZXJhTGF5ZXJzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgICAgICAgICAvLyBmaXJzdCByZW5kZXIgYWN0aW9uIGZvciB0aGlzIGNhbWVyYVxuICAgICAgICAgICAgICAgIGxldCBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCA9IHJlbmRlckFjdGlvbkNvdW50O1xuXG4gICAgICAgICAgICAgICAgLy8gbGFzdCByZW5kZXIgYWN0aW9uIGZvciB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgbGV0IGxhc3RSZW5kZXJBY3Rpb24gPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgLy8gdHJ1ZSBpZiBwb3N0IHByb2Nlc3Npbmcgc3RvcCBsYXllciB3YXMgZm91bmQgZm9yIHRoZSBjYW1lcmFcbiAgICAgICAgICAgICAgICBsZXQgcG9zdFByb2Nlc3NNYXJrZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIC8vIHdhbGsgYWxsIGdsb2JhbCBzb3J0ZWQgbGlzdCBvZiBsYXllcnMgKHN1YmxheWVycykgdG8gY2hlY2sgaWYgY2FtZXJhIHJlbmRlcnMgaXRcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGFkZHMgYm90aCBvcGFxdWUgYW5kIHRyYW5zcGFyZW50IHN1YmxheWVycyBpZiBjYW1lcmEgcmVuZGVycyB0aGUgbGF5ZXJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaisrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtqXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIGxheWVyIG5lZWRzIHRvIGJlIHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIuY2FtZXJhcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY2FtZXJhIHJlbmRlcnMgdGhpcyBsYXllclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmEubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpID49IDApIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFMYXllcnMucHVzaChsYXllcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhpcyBsYXllciBpcyB0aGUgc3RvcCBsYXllciBmb3IgcG9zdHByb2Nlc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFwb3N0UHJvY2Vzc01hcmtlZCAmJiBsYXllci5pZCA9PT0gY2FtZXJhLmRpc2FibGVQb3N0RWZmZWN0c0xheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0UHJvY2Vzc01hcmtlZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBwcmV2aW91c2x5IGFkZGVkIHJlbmRlciBhY3Rpb24gaXMgdGhlIGxhc3QgcG9zdC1wcm9jZXNzZWQgbGF5ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXN0UmVuZGVyQWN0aW9uKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBtYXJrIGl0IHRvIHRyaWdnZXIgcG9zdHByb2Nlc3NpbmcgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0UmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYW1lcmEgaW5kZXggaW4gdGhlIGxheWVyIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYUluZGV4ID0gbGF5ZXIuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmFJbmRleCA+PSAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCByZW5kZXIgYWN0aW9uIHRvIGRlc2NyaWJlIHJlbmRlcmluZyBzdGVwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0UmVuZGVyQWN0aW9uID0gdGhpcy5hZGRSZW5kZXJBY3Rpb24odGhpcy5fcmVuZGVyQWN0aW9ucywgcmVuZGVyQWN0aW9uQ291bnQsIGxheWVyLCBqLCBjYW1lcmFJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiwgcG9zdFByb2Nlc3NNYXJrZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyQWN0aW9uQ291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY2FtZXJhIHJlbmRlcnMgYW55IGxheWVycy5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCA8IHJlbmRlckFjdGlvbkNvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGJhc2VkIG9uIGFsbCBsYXllcnMgdGhpcyBjYW1lcmEgcmVuZGVycywgcHJlcGFyZSBhIGxpc3Qgb2YgZGlyZWN0aW9uYWwgbGlnaHRzIHRoZSBjYW1lcmEgbmVlZHMgdG8gcmVuZGVyIHNoYWRvdyBmb3JcbiAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHNldCB0aGVzZSB1cCBvbiB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBmb3IgdGhlIGNhbWVyYS5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9uc1tjYW1lcmFGaXJzdFJlbmRlckFjdGlvbkluZGV4XS5jb2xsZWN0RGlyZWN0aW9uYWxMaWdodHMoY2FtZXJhTGF5ZXJzLCB0aGlzLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfRElSRUNUSU9OQUxdLCB0aGlzLl9saWdodHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hcmsgdGhlIGxhc3QgcmVuZGVyIGFjdGlvbiBhcyBsYXN0IG9uZSB1c2luZyB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgICAgIGxhc3RSZW5kZXJBY3Rpb24ubGFzdENhbWVyYVVzZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgbm8gcmVuZGVyIGFjdGlvbiBmb3IgdGhpcyBjYW1lcmEgd2FzIG1hcmtlZCBmb3IgZW5kIG9mIHBvc3Rwcm9jZXNzaW5nLCBtYXJrIGxhc3Qgb25lXG4gICAgICAgICAgICAgICAgaWYgKCFwb3N0UHJvY2Vzc01hcmtlZCAmJiBsYXN0UmVuZGVyQWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RSZW5kZXJBY3Rpb24udHJpZ2dlclBvc3Rwcm9jZXNzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBoYW5kbGUgY2FtZXJhIHN0YWNraW5nIGlmIHRoaXMgcmVuZGVyIGFjdGlvbiBoYXMgcG9zdHByb2Nlc3NpbmcgZW5hYmxlZFxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEucmVuZGVyVGFyZ2V0ICYmIGNhbWVyYS5wb3N0RWZmZWN0c0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJvY2VzcyBwcmV2aW91cyByZW5kZXIgYWN0aW9ucyBzdGFydGluZyB3aXRoIHByZXZpb3VzIGNhbWVyYVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb3BhZ2F0ZVJlbmRlclRhcmdldChjYW1lcmFGaXJzdFJlbmRlckFjdGlvbkluZGV4IC0gMSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgdW51c2VkIHJlbmRlciBhY3Rpb25zXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gcmVuZGVyQWN0aW9uQ291bnQ7IGkgPCB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9uc1tpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aCA9IHJlbmRlckFjdGlvbkNvdW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWxsb2NhdGUgbGlnaHQgY2x1c3RlcmVzIGlmIGxpZ2h0cyBvciBtZXNoZXMgb3IgY2FtZXJhcyBhcmUgbW9kaWZpZWRcbiAgICAgICAgaWYgKHJlc3VsdCAmIChDT01QVVBEQVRFRF9DQU1FUkFTIHwgQ09NUFVQREFURURfTElHSFRTIHwgQ09NUFVQREFURURfSU5TVEFOQ0VTKSkge1xuXG4gICAgICAgICAgICAvLyBwcmVwYXJlIGNsdXN0ZXJlZCBsaWdodGluZyBmb3IgcmVuZGVyIGFjdGlvbnNcbiAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFsbG9jYXRlTGlnaHRDbHVzdGVycyhkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdCAmIChDT01QVVBEQVRFRF9MSUdIVFMgfCBDT01QVVBEQVRFRF9MSUdIVFMpKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2dSZW5kZXJBY3Rpb25zKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHVwZGF0ZVNoYWRvd0Nhc3RlcnMoKSB7XG5cbiAgICAgICAgLy8gX2xpZ2h0Q29tcG9zaXRpb25EYXRhIGFscmVhZHkgaGFzIHRoZSByaWdodCBzaXplLCBqdXN0IGNsZWFuIHVwIHNoYWRvdyBjYXN0ZXJzXG4gICAgICAgIGNvbnN0IGxpZ2h0Q291bnQgPSB0aGlzLl9saWdodHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRDb21wb3NpdGlvbkRhdGFbaV0uY2xlYXJTaGFkb3dDYXN0ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3IgZWFjaCBsYXllclxuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbaV07XG5cbiAgICAgICAgICAgIC8vIGxheWVyIGNhbiBiZSBpbiB0aGUgbGlzdCB0d28gdGltZXMgKG9wYXF1ZSwgdHJhbnNwKSwgYWRkIGNhc3RlcnMgb25seSBvbmUgdGltZVxuICAgICAgICAgICAgaWYgKCF0ZW1wU2V0LmhhcyhsYXllcikpIHtcbiAgICAgICAgICAgICAgICB0ZW1wU2V0LmFkZChsYXllcik7XG5cbiAgICAgICAgICAgICAgICAvLyBmb3IgZWFjaCBsaWdodCBvZiBhIGxheWVyXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRzID0gbGF5ZXIuX2xpZ2h0cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxpZ2h0cy5sZW5ndGg7IGorKykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgbmVlZCBjYXN0ZXJzIHdoZW4gY2FzdGluZyBzaGFkb3dzXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodHNbal0uY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmluZCBpdHMgaW5kZXggaW4gZ2xvYmFsIGxpZ2h0IGxpc3QsIGFuZCBnZXQgc2hhZG93IGNhc3RlcnMgZm9yIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodEluZGV4ID0gdGhpcy5fbGlnaHRzTWFwLmdldChsaWdodHNbal0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRDb21wRGF0YSA9IHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdW5pcXVlIG1lc2hlcyBmcm9tIHRoZSBsYXllciB0byBjYXN0ZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodENvbXBEYXRhLmFkZFNoYWRvd0Nhc3RlcnMobGF5ZXIuc2hhZG93Q2FzdGVycyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wU2V0LmNsZWFyKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlTGlnaHRzKCkge1xuXG4gICAgICAgIC8vIGJ1aWxkIGEgbGlzdCBhbmQgbWFwIG9mIGFsbCB1bmlxdWUgbGlnaHRzIGZyb20gYWxsIGxheWVyc1xuICAgICAgICB0aGlzLl9saWdodHMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fbGlnaHRzTWFwLmNsZWFyKCk7XG5cbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcblxuICAgICAgICAgICAgLy8gbGF5ZXIgY2FuIGJlIGluIHRoZSBsaXN0IHR3byB0aW1lcyAob3BhcXVlLCB0cmFuc3ApLCBwcm9jZXNzIGl0IG9ubHkgb25lIHRpbWVcbiAgICAgICAgICAgIGlmICghdGVtcFNldC5oYXMobGF5ZXIpKSB7XG4gICAgICAgICAgICAgICAgdGVtcFNldC5hZGQobGF5ZXIpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRzID0gbGF5ZXIuX2xpZ2h0cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxpZ2h0cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tqXTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhZGQgbmV3IGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgIGxldCBsaWdodEluZGV4ID0gdGhpcy5fbGlnaHRzTWFwLmdldChsaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodEluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0SW5kZXggPSB0aGlzLl9saWdodHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGlnaHRzTWFwLnNldChsaWdodCwgbGlnaHRJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9saWdodHMucHVzaChsaWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0aGUgbGlnaHQgaGFzIGNvbXBvc2l0aW9uIGRhdGEgYWxsb2NhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbGlnaHRDb21wRGF0YSA9IHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodENvbXBEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRDb21wRGF0YSA9IG5ldyBMaWdodENvbXBvc2l0aW9uRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdID0gbGlnaHRDb21wRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3BsaXQgbGF5ZXIgbGlnaHRzIGxpc3RzIGJ5IHR5cGVcbiAgICAgICAgICAgIHRoaXMuX3NwbGl0TGlnaHRzQXJyYXkobGF5ZXIpO1xuICAgICAgICAgICAgbGF5ZXIuX2RpcnR5TGlnaHRzID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wU2V0LmNsZWFyKCk7XG5cbiAgICAgICAgLy8gc3BsaXQgbGlnaHQgbGlzdCBieSB0eXBlXG4gICAgICAgIHRoaXMuX3NwbGl0TGlnaHRzQXJyYXkodGhpcyk7XG5cbiAgICAgICAgLy8gYWRqdXN0IF9saWdodENvbXBvc2l0aW9uRGF0YSB0byB0aGUgcmlnaHQgc2l6ZSwgbWF0Y2hpbmcgbnVtYmVyIG9mIGxpZ2h0c1xuICAgICAgICBjb25zdCBsaWdodENvdW50ID0gdGhpcy5fbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fbGlnaHRDb21wb3NpdGlvbkRhdGEubGVuZ3RoID0gbGlnaHRDb3VudDtcbiAgICB9XG5cbiAgICAvLyBmaW5kIGV4aXN0aW5nIGxpZ2h0IGNsdXN0ZXIgdGhhdCBpcyBjb21wYXRpYmxlIHdpdGggc3BlY2lmaWVkIGxheWVyXG4gICAgZmluZENvbXBhdGlibGVDbHVzdGVyKGxheWVyLCByZW5kZXJBY3Rpb25Db3VudCwgZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgLy8gY2hlY2sgYWxyZWFkeSBzZXQgdXAgcmVuZGVyIGFjdGlvbnNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJBY3Rpb25Db3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByYSA9IHRoaXMuX3JlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCByYUxheWVyID0gdGhpcy5sYXllckxpc3RbcmEubGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIC8vIG9ubHkgcmV1c2UgY2x1c3RlcnMgaWYgbm90IGVtcHR5XG4gICAgICAgICAgICBpZiAocmEubGlnaHRDbHVzdGVycyAhPT0gZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBsYXllciBpcyB0aGUgc2FtZSAoYnV0IGRpZmZlcmVudCBzdWJsYXllciksIGNsdXN0ZXIgY2FuIGJlIHVzZWQgZGlyZWN0bHkgYXMgbGlnaHRzIGFyZSB0aGUgc2FtZVxuICAgICAgICAgICAgICAgIGlmIChsYXllciA9PT0gcmFMYXllcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmEubGlnaHRDbHVzdGVycztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocmEubGlnaHRDbHVzdGVycykge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgbGF5ZXIgaGFzIGV4YWN0bHkgdGhlIHNhbWUgc2V0IG9mIGxpZ2h0cywgdXNlIHRoZSBzYW1lIGNsdXN0ZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNldC5lcXVhbHMobGF5ZXIuX2NsdXN0ZXJlZExpZ2h0c1NldCwgcmFMYXllci5fY2x1c3RlcmVkTGlnaHRzU2V0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJhLmxpZ2h0Q2x1c3RlcnM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBubyBtYXRjaFxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBhc3NpZ24gbGlnaHQgY2x1c3RlcnMgdG8gcmVuZGVyIGFjdGlvbnMgdGhhdCBuZWVkIGl0XG4gICAgYWxsb2NhdGVMaWdodENsdXN0ZXJzKGRldmljZSkge1xuXG4gICAgICAgIC8vIHJldXNlIHByZXZpb3VzbHkgYWxsb2NhdGVkIGNsdXN0ZXJzXG4gICAgICAgIHRlbXBDbHVzdGVyQXJyYXkucHVzaCguLi50aGlzLl93b3JsZENsdXN0ZXJzKTtcblxuICAgICAgICAvLyB0aGUgY2x1c3RlciB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICBjb25zdCBlbXB0eVdvcmxkQ2x1c3RlcnMgPSB0aGlzLmdldEVtcHR5V29ybGRDbHVzdGVycyhkZXZpY2UpO1xuXG4gICAgICAgIC8vIHN0YXJ0IHdpdGggbm8gY2x1c3RlcnNcbiAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vIHByb2Nlc3MgYWxsIHJlbmRlciBhY3Rpb25zXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fcmVuZGVyQWN0aW9ucy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtyYS5sYXllckluZGV4XTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIGxheWVyIGhhcyBsaWdodHMgdXNlZCBieSBjbHVzdGVyc1xuICAgICAgICAgICAgaWYgKGxheWVyLmhhc0NsdXN0ZXJlZExpZ2h0cykge1xuXG4gICAgICAgICAgICAgICAgLy8gYW5kIGlmIHRoZSBsYXllciBoYXMgbWVzaGVzXG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSB0aGlzLnN1YkxheWVyTGlzdFtyYS5sYXllckluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdHJhbnNwYXJlbnQgPyBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgOiBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2VzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJldXNlIGNsdXN0ZXIgdGhhdCB3YXMgYWxyZWFkeSBzZXQgdXAgYW5kIGlzIGNvbXBhdGlibGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNsdXN0ZXJzID0gdGhpcy5maW5kQ29tcGF0aWJsZUNsdXN0ZXIobGF5ZXIsIGksIGVtcHR5V29ybGRDbHVzdGVycyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY2x1c3RlcnMpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlIGFscmVhZHkgYWxsb2NhdGVkIGNsdXN0ZXIgZnJvbSBiZWZvcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0ZW1wQ2x1c3RlckFycmF5Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJzID0gdGVtcENsdXN0ZXJBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIG5ldyBjbHVzdGVyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNsdXN0ZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlcnMgPSBuZXcgV29ybGRDbHVzdGVycyhkZXZpY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVycy5uYW1lID0gJ0NsdXN0ZXItJyArIHRoaXMuX3dvcmxkQ2x1c3RlcnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycy5wdXNoKGNsdXN0ZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJhLmxpZ2h0Q2x1c3RlcnMgPSBjbHVzdGVycztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG5vIGNsdXN0ZXJlZCBsaWdodHMsIHVzZSB0aGUgY2x1c3RlciB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICAgICAgaWYgKCFyYS5saWdodENsdXN0ZXJzKSB7XG4gICAgICAgICAgICAgICAgcmEubGlnaHRDbHVzdGVycyA9IGVtcHR5V29ybGRDbHVzdGVycztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBsZWZ0b3ZlcnNcbiAgICAgICAgdGVtcENsdXN0ZXJBcnJheS5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgICAgICBpdGVtLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRlbXBDbHVzdGVyQXJyYXkubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBhZGRzIG5ldyByZW5kZXIgYWN0aW9uIHRvIGEgbGlzdCwgd2hpbGUgdHJ5aW5nIHRvIGxpbWl0IGFsbG9jYXRpb24gYW5kIHJldXNlIGFscmVhZHkgYWxsb2NhdGVkIG9iamVjdHNcbiAgICBhZGRSZW5kZXJBY3Rpb24ocmVuZGVyQWN0aW9ucywgcmVuZGVyQWN0aW9uSW5kZXgsIGxheWVyLCBsYXllckluZGV4LCBjYW1lcmFJbmRleCwgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24sIHBvc3RQcm9jZXNzTWFya2VkKSB7XG5cbiAgICAgICAgLy8gdHJ5IGFuZCByZXVzZSBvYmplY3QsIG90aGVyd2lzZSBhbGxvY2F0ZSBuZXdcbiAgICAgICAgLyoqIEB0eXBlIHtSZW5kZXJBY3Rpb259ICovXG4gICAgICAgIGxldCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW3JlbmRlckFjdGlvbkluZGV4XTtcbiAgICAgICAgaWYgKCFyZW5kZXJBY3Rpb24pIHtcbiAgICAgICAgICAgIHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbcmVuZGVyQWN0aW9uSW5kZXhdID0gbmV3IFJlbmRlckFjdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVuZGVyIHRhcmdldCBmcm9tIHRoZSBjYW1lcmEgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHRoZSByZW5kZXIgdGFyZ2V0IGZyb20gdGhlIGxheWVyXG4gICAgICAgIGxldCBydCA9IGxheWVyLnJlbmRlclRhcmdldDtcbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9ICovXG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhSW5kZXhdO1xuICAgICAgICBpZiAoY2FtZXJhICYmIGNhbWVyYS5yZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgIGlmIChsYXllci5pZCAhPT0gTEFZRVJJRF9ERVBUSCkgeyAgIC8vIGlnbm9yZSBkZXB0aCBsYXllclxuICAgICAgICAgICAgICAgIHJ0ID0gY2FtZXJhLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdhcyBjYW1lcmEgYW5kIHJlbmRlciB0YXJnZXQgY29tYm8gdXNlZCBhbHJlYWR5XG4gICAgICAgIGxldCB1c2VkID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGkgPSByZW5kZXJBY3Rpb25JbmRleCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBpZiAocmVuZGVyQWN0aW9uc1tpXS5jYW1lcmEgPT09IGNhbWVyYSAmJiByZW5kZXJBY3Rpb25zW2ldLnJlbmRlclRhcmdldCA9PT0gcnQpIHtcbiAgICAgICAgICAgICAgICB1c2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGZsYWdzIC0gdXNlIGNhbWVyYSBjbGVhciBmbGFncyBpbiB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBmb3IgZWFjaCBjYW1lcmEsXG4gICAgICAgIC8vIG9yIHdoZW4gcmVuZGVyIHRhcmdldCAoZnJvbSBsYXllcikgd2FzIG5vdCB5ZXQgY2xlYXJlZCBieSB0aGlzIGNhbWVyYVxuICAgICAgICBjb25zdCBuZWVkc0NsZWFyID0gY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24gfHwgIXVzZWQ7XG4gICAgICAgIGxldCBjbGVhckNvbG9yID0gbmVlZHNDbGVhciA/IGNhbWVyYS5jbGVhckNvbG9yQnVmZmVyIDogZmFsc2U7XG4gICAgICAgIGxldCBjbGVhckRlcHRoID0gbmVlZHNDbGVhciA/IGNhbWVyYS5jbGVhckRlcHRoQnVmZmVyIDogZmFsc2U7XG4gICAgICAgIGxldCBjbGVhclN0ZW5jaWwgPSBuZWVkc0NsZWFyID8gY2FtZXJhLmNsZWFyU3RlbmNpbEJ1ZmZlciA6IGZhbHNlO1xuXG4gICAgICAgIC8vIGNsZWFyIGJ1ZmZlcnMgaWYgcmVxdWVzdGVkIGJ5IHRoZSBsYXllclxuICAgICAgICBjbGVhckNvbG9yIHx8PSBsYXllci5jbGVhckNvbG9yQnVmZmVyO1xuICAgICAgICBjbGVhckRlcHRoIHx8PSBsYXllci5jbGVhckRlcHRoQnVmZmVyO1xuICAgICAgICBjbGVhclN0ZW5jaWwgfHw9IGxheWVyLmNsZWFyU3RlbmNpbEJ1ZmZlcjtcblxuICAgICAgICAvLyBmb3IgY2FtZXJhcyB3aXRoIHBvc3QgcHJvY2Vzc2luZyBlbmFibGVkLCBvbiBsYXllcnMgYWZ0ZXIgcG9zdCBwcm9jZXNzaW5nIGhhcyBiZWVuIGFwcGxpZWQgYWxyZWFkeSAoc28gVUkgYW5kIHNpbWlsYXIpLFxuICAgICAgICAvLyBkb24ndCByZW5kZXIgdGhlbSB0byByZW5kZXIgdGFyZ2V0IGFueW1vcmVcbiAgICAgICAgaWYgKHBvc3RQcm9jZXNzTWFya2VkICYmIGNhbWVyYS5wb3N0RWZmZWN0c0VuYWJsZWQpIHtcbiAgICAgICAgICAgIHJ0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0b3JlIHRoZSBwcm9wZXJ0aWVzIC0gd3JpdGUgYWxsIGFzIHdlIHJldXNlIHByZXZpb3VzbHkgYWxsb2NhdGVkIGNsYXNzIGluc3RhbmNlc1xuICAgICAgICByZW5kZXJBY3Rpb24ucmVzZXQoKTtcbiAgICAgICAgcmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyA9IGZhbHNlO1xuICAgICAgICByZW5kZXJBY3Rpb24ubGF5ZXJJbmRleCA9IGxheWVySW5kZXg7XG4gICAgICAgIHJlbmRlckFjdGlvbi5jYW1lcmFJbmRleCA9IGNhbWVyYUluZGV4O1xuICAgICAgICByZW5kZXJBY3Rpb24uY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0ID0gcnQ7XG4gICAgICAgIHJlbmRlckFjdGlvbi5jbGVhckNvbG9yID0gY2xlYXJDb2xvcjtcbiAgICAgICAgcmVuZGVyQWN0aW9uLmNsZWFyRGVwdGggPSBjbGVhckRlcHRoO1xuICAgICAgICByZW5kZXJBY3Rpb24uY2xlYXJTdGVuY2lsID0gY2xlYXJTdGVuY2lsO1xuICAgICAgICByZW5kZXJBY3Rpb24uZmlyc3RDYW1lcmFVc2UgPSBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbjtcbiAgICAgICAgcmVuZGVyQWN0aW9uLmxhc3RDYW1lcmFVc2UgPSBmYWxzZTtcblxuICAgICAgICByZXR1cm4gcmVuZGVyQWN0aW9uO1xuICAgIH1cblxuICAgIC8vIGV4ZWN1dGVzIHdoZW4gcG9zdC1wcm9jZXNzaW5nIGNhbWVyYSdzIHJlbmRlciBhY3Rpb25zIHdlcmUgY3JlYXRlZCB0byBwcm9wYWdhdGUgcmVuZGVyaW5nIHRvXG4gICAgLy8gcmVuZGVyIHRhcmdldHMgdG8gcHJldmlvdXMgY2FtZXJhIGFzIG5lZWRlZFxuICAgIHByb3BhZ2F0ZVJlbmRlclRhcmdldChzdGFydEluZGV4LCBmcm9tQ2FtZXJhKSB7XG5cbiAgICAgICAgZm9yIChsZXQgYSA9IHN0YXJ0SW5kZXg7IGEgPj0gMDsgYS0tKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJhID0gdGhpcy5fcmVuZGVyQWN0aW9uc1thXTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbcmEubGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIC8vIGlmIHdlIGhpdCByZW5kZXIgYWN0aW9uIHdpdGggYSByZW5kZXIgdGFyZ2V0IChvdGhlciB0aGFuIGRlcHRoIGxheWVyKSwgdGhhdCBtYXJrcyB0aGUgZW5kIG9mIGNhbWVyYSBzdGFja1xuICAgICAgICAgICAgLy8gVE9ETzogcmVmYWN0b3IgdGhpcyBhcyBwYXJ0IG9mIGRlcHRoIGxheWVyIHJlZmFjdG9yaW5nXG4gICAgICAgICAgICBpZiAocmEucmVuZGVyVGFyZ2V0ICYmIGxheWVyLmlkICE9PSBMQVlFUklEX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNraXAgb3ZlciBkZXB0aCBsYXllclxuICAgICAgICAgICAgaWYgKGxheWVyLmlkID09PSBMQVlFUklEX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYSBzdGFjayBlbmRzIHdoZW4gdmlld3BvcnQgb3Igc2Npc3NvciBvZiB0aGUgY2FtZXJhIGNoYW5nZXNcbiAgICAgICAgICAgIGNvbnN0IHRoaXNDYW1lcmEgPSByYT8uY2FtZXJhLmNhbWVyYTtcbiAgICAgICAgICAgIGlmICh0aGlzQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmcm9tQ2FtZXJhLmNhbWVyYS5yZWN0LmVxdWFscyh0aGlzQ2FtZXJhLnJlY3QpIHx8ICFmcm9tQ2FtZXJhLmNhbWVyYS5zY2lzc29yUmVjdC5lcXVhbHModGhpc0NhbWVyYS5zY2lzc29yUmVjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZW5kZXIgaXQgdG8gcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgcmEucmVuZGVyVGFyZ2V0ID0gZnJvbUNhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBsb2dzIHJlbmRlciBhY3Rpb24gYW5kIHRoZWlyIHByb3BlcnRpZXNcbiAgICBfbG9nUmVuZGVyQWN0aW9ucygpIHtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmIChUcmFjaW5nLmdldChUUkFDRUlEX1JFTkRFUl9BQ1RJT04pKSB7XG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9BQ1RJT04sICdSZW5kZXIgQWN0aW9ucyBmb3IgY29tcG9zaXRpb246ICcgKyB0aGlzLm5hbWUpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVySW5kZXggPSByYS5sYXllckluZGV4O1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbbGF5ZXJJbmRleF07XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IGxheWVyLmVuYWJsZWQgJiYgdGhpcy5zdWJMYXllckVuYWJsZWRbbGF5ZXJJbmRleF07XG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSB0aGlzLnN1YkxheWVyTGlzdFtsYXllckluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW3JhLmNhbWVyYUluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXJMaWdodENvdW50ID0gcmEuZGlyZWN0aW9uYWxMaWdodHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNsZWFyID0gKHJhLmNsZWFyQ29sb3IgPyAnQ29sb3IgJyA6ICcuLi4uLiAnKSArIChyYS5jbGVhckRlcHRoID8gJ0RlcHRoICcgOiAnLi4uLi4gJykgKyAocmEuY2xlYXJTdGVuY2lsID8gJ1N0ZW5jaWwnIDogJy4uLi4uLi4nKTtcblxuICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0FDVElPTiwgaSArXG4gICAgICAgICAgICAgICAgICAgICgnIENhbTogJyArIChjYW1lcmEgPyBjYW1lcmEuZW50aXR5Lm5hbWUgOiAnLScpKS5wYWRFbmQoMjIsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAoJyBMYXk6ICcgKyBsYXllci5uYW1lKS5wYWRFbmQoMjIsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAodHJhbnNwYXJlbnQgPyAnIFRSQU5TUCcgOiAnIE9QQVFVRScpICtcbiAgICAgICAgICAgICAgICAgICAgKGVuYWJsZWQgPyAnIEVOQUJMRUQgJyA6ICcgRElTQUJMRUQnKSArXG4gICAgICAgICAgICAgICAgICAgICcgTWVzaGVzOiAnLCAodHJhbnNwYXJlbnQgPyBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMubGVuZ3RoIDogbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcy5sZW5ndGgpLnRvU3RyaW5nKCkucGFkU3RhcnQoNCkgK1xuICAgICAgICAgICAgICAgICAgICAoJyBSVDogJyArIChyYS5yZW5kZXJUYXJnZXQgPyByYS5yZW5kZXJUYXJnZXQubmFtZSA6ICctJykpLnBhZEVuZCgzMCwgJyAnKSArXG4gICAgICAgICAgICAgICAgICAgICcgQ2xlYXI6ICcgKyBjbGVhciArXG4gICAgICAgICAgICAgICAgICAgICcgTGlnaHRzOiAoJyArIGxheWVyLl9jbHVzdGVyZWRMaWdodHNTZXQuc2l6ZSArICcvJyArIGxheWVyLl9saWdodHNTZXQuc2l6ZSArICcpJyArXG4gICAgICAgICAgICAgICAgICAgICcgJyArIChyYS5saWdodENsdXN0ZXJzICE9PSB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMgPyAocmEubGlnaHRDbHVzdGVycy5uYW1lKSA6ICcnKS5wYWRFbmQoMTAsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAocmEuZmlyc3RDYW1lcmFVc2UgPyAnIENBTS1GSVJTVCcgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgICAocmEubGFzdENhbWVyYVVzZSA/ICcgQ0FNLUxBU1QnIDogJycpICtcbiAgICAgICAgICAgICAgICAgICAgKHJhLnRyaWdnZXJQb3N0cHJvY2VzcyA/ICcgUE9TVFBST0NFU1MnIDogJycpICtcbiAgICAgICAgICAgICAgICAgICAgKGRpckxpZ2h0Q291bnQgPyAoJyBEaXJMaWdodHM6ICcgKyBkaXJMaWdodENvdW50KSA6ICcnKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgX2lzTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBpZiAodGhpcy5sYXllckxpc3QuaW5kZXhPZihsYXllcikgPj0gMCkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0xheWVyIGlzIGFscmVhZHkgYWRkZWQuJyk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2lzU3VibGF5ZXJBZGRlZChsYXllciwgdHJhbnNwYXJlbnQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMubGF5ZXJMaXN0W2ldID09PSBsYXllciAmJiB0aGlzLnN1YkxheWVyTGlzdFtpXSA9PT0gdHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcignU3VibGF5ZXIgaXMgYWxyZWFkeSBhZGRlZC4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gV2hvbGUgbGF5ZXIgQVBJXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbGF5ZXIgKGJvdGggb3BhcXVlIGFuZCBzZW1pLXRyYW5zcGFyZW50IHBhcnRzKSB0byB0aGUgZW5kIG9mIHRoZSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBhZGQuXG4gICAgICovXG4gICAgcHVzaChsYXllcikge1xuICAgICAgICAvLyBhZGQgYm90aCBvcGFxdWUgYW5kIHRyYW5zcGFyZW50IHRvIHRoZSBlbmQgb2YgdGhlIGFycmF5XG4gICAgICAgIGlmICh0aGlzLl9pc0xheWVyQWRkZWQobGF5ZXIpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnB1c2gobGF5ZXIpO1xuICAgICAgICB0aGlzLmxheWVyTGlzdC5wdXNoKGxheWVyKTtcbiAgICAgICAgdGhpcy5fb3BhcXVlT3JkZXJbbGF5ZXIuaWRdID0gdGhpcy5zdWJMYXllckxpc3QucHVzaChmYWxzZSkgLSAxO1xuICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyW2xheWVyLmlkXSA9IHRoaXMuc3ViTGF5ZXJMaXN0LnB1c2godHJ1ZSkgLSAxO1xuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5wdXNoKHRydWUpO1xuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5wdXNoKHRydWUpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyBhIGxheWVyIChib3RoIG9wYXF1ZSBhbmQgc2VtaS10cmFuc3BhcmVudCBwYXJ0cykgYXQgdGhlIGNob3NlbiBpbmRleCBpbiB0aGVcbiAgICAgKiB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBhZGQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gSW5zZXJ0aW9uIHBvc2l0aW9uLlxuICAgICAqL1xuICAgIGluc2VydChsYXllciwgaW5kZXgpIHtcbiAgICAgICAgLy8gaW5zZXJ0IGJvdGggb3BhcXVlIGFuZCB0cmFuc3BhcmVudCBhdCB0aGUgaW5kZXhcbiAgICAgICAgaWYgKHRoaXMuX2lzTGF5ZXJBZGRlZChsYXllcikpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCBsYXllciwgbGF5ZXIpO1xuICAgICAgICB0aGlzLnN1YkxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIGZhbHNlLCB0cnVlKTtcblxuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdXBkYXRlT3BhcXVlT3JkZXIoaW5kZXgsIGNvdW50IC0gMSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIoaW5kZXgsIGNvdW50IC0gMSk7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpbmRleCwgMCwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgbGF5ZXIgKGJvdGggb3BhcXVlIGFuZCBzZW1pLXRyYW5zcGFyZW50IHBhcnRzKSBmcm9tIHtAbGluayBMYXllciNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICByZW1vdmUobGF5ZXIpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGFsbCBvY2N1cnJlbmNlcyBvZiBhIGxheWVyXG4gICAgICAgIGxldCBpZCA9IHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIpO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9vcGFxdWVPcmRlcltpZF07XG4gICAgICAgIGRlbGV0ZSB0aGlzLl90cmFuc3BhcmVudE9yZGVyW2lkXTtcblxuICAgICAgICB3aGlsZSAoaWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGlkLCAxKTtcbiAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpZCwgMSk7XG4gICAgICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaWQsIDEpO1xuICAgICAgICAgICAgaWQgPSB0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGxheWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBib3RoIG9yZGVyc1xuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdXBkYXRlT3BhcXVlT3JkZXIoMCwgY291bnQgLSAxKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNwYXJlbnRPcmRlcigwLCBjb3VudCAtIDEpO1xuICAgIH1cblxuICAgIC8vIFN1YmxheWVyIEFQSVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBwYXJ0IG9mIHRoZSBsYXllciB3aXRoIG9wYXF1ZSAobm9uIHNlbWktdHJhbnNwYXJlbnQpIG9iamVjdHMgdG8gdGhlIGVuZCBvZiB0aGVcbiAgICAgKiB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBhZGQuXG4gICAgICovXG4gICAgcHVzaE9wYXF1ZShsYXllcikge1xuICAgICAgICAvLyBhZGQgb3BhcXVlIHRvIHRoZSBlbmQgb2YgdGhlIGFycmF5XG4gICAgICAgIGlmICh0aGlzLl9pc1N1YmxheWVyQWRkZWQobGF5ZXIsIGZhbHNlKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmxheWVyTGlzdC5wdXNoKGxheWVyKTtcbiAgICAgICAgdGhpcy5fb3BhcXVlT3JkZXJbbGF5ZXIuaWRdID0gdGhpcy5zdWJMYXllckxpc3QucHVzaChmYWxzZSkgLSAxO1xuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5wdXNoKHRydWUpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyBhbiBvcGFxdWUgcGFydCBvZiB0aGUgbGF5ZXIgKG5vbiBzZW1pLXRyYW5zcGFyZW50IG1lc2ggaW5zdGFuY2VzKSBhdCB0aGUgY2hvc2VuXG4gICAgICogaW5kZXggaW4gdGhlIHtAbGluayBMYXllciNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBJbnNlcnRpb24gcG9zaXRpb24uXG4gICAgICovXG4gICAgaW5zZXJ0T3BhcXVlKGxheWVyLCBpbmRleCkge1xuICAgICAgICAvLyBpbnNlcnQgb3BhcXVlIGF0IGluZGV4XG4gICAgICAgIGlmICh0aGlzLl9pc1N1YmxheWVyQWRkZWQobGF5ZXIsIGZhbHNlKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIGxheWVyKTtcbiAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCBmYWxzZSk7XG5cbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLnN1YkxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU9wYXF1ZU9yZGVyKGluZGV4LCBjb3VudCAtIDEpO1xuXG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpbmRleCwgMCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFuIG9wYXF1ZSBwYXJ0IG9mIHRoZSBsYXllciAobm9uIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMpIGZyb21cbiAgICAgKiB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlT3BhcXVlKGxheWVyKSB7XG4gICAgICAgIC8vIHJlbW92ZSBvcGFxdWUgb2NjdXJyZW5jZXMgb2YgYSBsYXllclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5sYXllckxpc3QubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdFtpXSA9PT0gbGF5ZXIgJiYgIXRoaXMuc3ViTGF5ZXJMaXN0W2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgIGxlbi0tO1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU9wYXF1ZU9yZGVyKGksIGxlbiAtIDEpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3QuaW5kZXhPZihsYXllcikgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJywgbGF5ZXIpOyAvLyBubyBzdWJsYXllcnMgbGVmdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHBhcnQgb2YgdGhlIGxheWVyIHdpdGggc2VtaS10cmFuc3BhcmVudCBvYmplY3RzIHRvIHRoZSBlbmQgb2YgdGhlIHtAbGluayBMYXllciNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKi9cbiAgICBwdXNoVHJhbnNwYXJlbnQobGF5ZXIpIHtcbiAgICAgICAgLy8gYWRkIHRyYW5zcGFyZW50IHRvIHRoZSBlbmQgb2YgdGhlIGFycmF5XG4gICAgICAgIGlmICh0aGlzLl9pc1N1YmxheWVyQWRkZWQobGF5ZXIsIHRydWUpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnB1c2gobGF5ZXIpO1xuICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyW2xheWVyLmlkXSA9IHRoaXMuc3ViTGF5ZXJMaXN0LnB1c2godHJ1ZSkgLSAxO1xuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5wdXNoKHRydWUpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyBhIHNlbWktdHJhbnNwYXJlbnQgcGFydCBvZiB0aGUgbGF5ZXIgYXQgdGhlIGNob3NlbiBpbmRleCBpbiB0aGUge0BsaW5rIExheWVyI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluc2VydGlvbiBwb3NpdGlvbi5cbiAgICAgKi9cbiAgICBpbnNlcnRUcmFuc3BhcmVudChsYXllciwgaW5kZXgpIHtcbiAgICAgICAgLy8gaW5zZXJ0IHRyYW5zcGFyZW50IGF0IGluZGV4XG4gICAgICAgIGlmICh0aGlzLl9pc1N1YmxheWVyQWRkZWQobGF5ZXIsIHRydWUpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnNwbGljZShpbmRleCwgMCwgbGF5ZXIpO1xuICAgICAgICB0aGlzLnN1YkxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIHRydWUpO1xuXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5zdWJMYXllckxpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc3BhcmVudE9yZGVyKGluZGV4LCBjb3VudCAtIDEpO1xuXG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpbmRleCwgMCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgdHJhbnNwYXJlbnQgcGFydCBvZiB0aGUgbGF5ZXIgZnJvbSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlVHJhbnNwYXJlbnQobGF5ZXIpIHtcbiAgICAgICAgLy8gcmVtb3ZlIHRyYW5zcGFyZW50IG9jY3VycmVuY2VzIG9mIGEgbGF5ZXJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0gPT09IGxheWVyICYmIHRoaXMuc3ViTGF5ZXJMaXN0W2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgIGxlbi0tO1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIoaSwgbGVuIC0gMSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmUnLCBsYXllcik7IC8vIG5vIHN1YmxheWVycyBsZWZ0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9nZXRTdWJsYXllckluZGV4KGxheWVyLCB0cmFuc3BhcmVudCkge1xuICAgICAgICAvLyBmaW5kIHN1YmxheWVyIGluZGV4IGluIHRoZSBjb21wb3NpdGlvbiBhcnJheVxuICAgICAgICBsZXQgaWQgPSB0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKTtcbiAgICAgICAgaWYgKGlkIDwgMCkgcmV0dXJuIC0xO1xuXG4gICAgICAgIGlmICh0aGlzLnN1YkxheWVyTGlzdFtpZF0gIT09IHRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBpZCA9IHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIsIGlkICsgMSk7XG4gICAgICAgICAgICBpZiAoaWQgPCAwKSByZXR1cm4gLTE7XG4gICAgICAgICAgICBpZiAodGhpcy5zdWJMYXllckxpc3RbaWRdICE9PSB0cmFuc3BhcmVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBpbmRleCBvZiB0aGUgb3BhcXVlIHBhcnQgb2YgdGhlIHN1cHBsaWVkIGxheWVyIGluIHRoZSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBmaW5kIGluZGV4IG9mLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBpbmRleCBvZiB0aGUgb3BhcXVlIHBhcnQgb2YgdGhlIHNwZWNpZmllZCBsYXllci5cbiAgICAgKi9cbiAgICBnZXRPcGFxdWVJbmRleChsYXllcikge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U3VibGF5ZXJJbmRleChsYXllciwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgaW5kZXggb2YgdGhlIHNlbWktdHJhbnNwYXJlbnQgcGFydCBvZiB0aGUgc3VwcGxpZWQgbGF5ZXIgaW4gdGhlIHtAbGluayBMYXllciNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGZpbmQgaW5kZXggb2YuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGluZGV4IG9mIHRoZSBzZW1pLXRyYW5zcGFyZW50IHBhcnQgb2YgdGhlIHNwZWNpZmllZCBsYXllci5cbiAgICAgKi9cbiAgICBnZXRUcmFuc3BhcmVudEluZGV4KGxheWVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTdWJsYXllckluZGV4KGxheWVyLCB0cnVlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaW5kcyBhIGxheWVyIGluc2lkZSB0aGlzIGNvbXBvc2l0aW9uIGJ5IGl0cyBJRC4gTnVsbCBpcyByZXR1cm5lZCwgaWYgbm90aGluZyBpcyBmb3VuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpZCAtIEFuIElEIG9mIHRoZSBsYXllciB0byBmaW5kLlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ8bnVsbH0gVGhlIGxheWVyIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNwZWNpZmllZCBJRC5cbiAgICAgKiBSZXR1cm5zIG51bGwgaWYgbGF5ZXIgaXMgbm90IGZvdW5kLlxuICAgICAqL1xuICAgIGdldExheWVyQnlJZChpZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0uaWQgPT09IGlkKSByZXR1cm4gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgYSBsYXllciBpbnNpZGUgdGhpcyBjb21wb3NpdGlvbiBieSBpdHMgbmFtZS4gTnVsbCBpcyByZXR1cm5lZCwgaWYgbm90aGluZyBpcyBmb3VuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGxheWVyIHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcnxudWxsfSBUaGUgbGF5ZXIgY29ycmVzcG9uZGluZyB0byB0aGUgc3BlY2lmaWVkIG5hbWUuXG4gICAgICogUmV0dXJucyBudWxsIGlmIGxheWVyIGlzIG5vdCBmb3VuZC5cbiAgICAgKi9cbiAgICBnZXRMYXllckJ5TmFtZShuYW1lKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdFtpXS5uYW1lID09PSBuYW1lKSByZXR1cm4gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU9wYXF1ZU9yZGVyKHN0YXJ0SW5kZXgsIGVuZEluZGV4KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDw9IGVuZEluZGV4OyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnN1YkxheWVyTGlzdFtpXSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vcGFxdWVPcmRlclt0aGlzLmxheWVyTGlzdFtpXS5pZF0gPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIoc3RhcnRJbmRleCwgZW5kSW5kZXgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPD0gZW5kSW5kZXg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3ViTGF5ZXJMaXN0W2ldID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNwYXJlbnRPcmRlclt0aGlzLmxheWVyTGlzdFtpXS5pZF0gPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXNlZCB0byBkZXRlcm1pbmUgd2hpY2ggYXJyYXkgb2YgbGF5ZXJzIGhhcyBhbnkgc3VibGF5ZXIgdGhhdCBpc1xuICAgIC8vIG9uIHRvcCBvZiBhbGwgdGhlIHN1YmxheWVycyBpbiB0aGUgb3RoZXIgYXJyYXkuIFRoZSBvcmRlciBpcyBhIGRpY3Rpb25hcnlcbiAgICAvLyBvZiA8bGF5ZXJJZCwgaW5kZXg+LlxuICAgIF9zb3J0TGF5ZXJzRGVzY2VuZGluZyhsYXllcnNBLCBsYXllcnNCLCBvcmRlcikge1xuICAgICAgICBsZXQgdG9wTGF5ZXJBID0gLTE7XG4gICAgICAgIGxldCB0b3BMYXllckIgPSAtMTtcblxuICAgICAgICAvLyBzZWFyY2ggZm9yIHdoaWNoIGxheWVyIGlzIG9uIHRvcCBpbiBsYXllcnNBXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXllcnNBLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGxheWVyc0FbaV07XG4gICAgICAgICAgICBpZiAob3JkZXIuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgdG9wTGF5ZXJBID0gTWF0aC5tYXgodG9wTGF5ZXJBLCBvcmRlcltpZF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2VhcmNoIGZvciB3aGljaCBsYXllciBpcyBvbiB0b3AgaW4gbGF5ZXJzQlxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGF5ZXJzQi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgaWQgPSBsYXllcnNCW2ldO1xuICAgICAgICAgICAgaWYgKG9yZGVyLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgICAgICAgICAgIHRvcExheWVyQiA9IE1hdGgubWF4KHRvcExheWVyQiwgb3JkZXJbaWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBsYXllcnMgb2YgbGF5ZXJzQSBvciBsYXllcnNCIGRvIG5vdCBleGlzdCBhdCBhbGxcbiAgICAgICAgLy8gaW4gdGhlIGNvbXBvc2l0aW9uIHRoZW4gcmV0dXJuIGVhcmx5IHdpdGggdGhlIG90aGVyLlxuICAgICAgICBpZiAodG9wTGF5ZXJBID09PSAtMSAmJiB0b3BMYXllckIgIT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIGlmICh0b3BMYXllckIgPT09IC0xICYmIHRvcExheWVyQSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNvcnQgaW4gZGVzY2VuZGluZyBvcmRlciBzaW5jZSB3ZSB3YW50XG4gICAgICAgIC8vIHRoZSBoaWdoZXIgb3JkZXIgdG8gYmUgZmlyc3RcbiAgICAgICAgcmV0dXJuIHRvcExheWVyQiAtIHRvcExheWVyQTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGRldGVybWluZSB3aGljaCBhcnJheSBvZiBsYXllcnMgaGFzIGFueSB0cmFuc3BhcmVudCBzdWJsYXllciB0aGF0IGlzIG9uIHRvcCBvZiBhbGxcbiAgICAgKiB0aGUgdHJhbnNwYXJlbnQgc3VibGF5ZXJzIGluIHRoZSBvdGhlciBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGxheWVyc0EgLSBJRHMgb2YgbGF5ZXJzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGxheWVyc0IgLSBJRHMgb2YgbGF5ZXJzLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgYSBuZWdhdGl2ZSBudW1iZXIgaWYgYW55IG9mIHRoZSB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gbGF5ZXJzQVxuICAgICAqIGlzIG9uIHRvcCBvZiBhbGwgdGhlIHRyYW5zcGFyZW50IHN1YmxheWVycyBpbiBsYXllcnNCLCBvciBhIHBvc2l0aXZlIG51bWJlciBpZiBhbnkgb2YgdGhlXG4gICAgICogdHJhbnNwYXJlbnQgc3VibGF5ZXJzIGluIGxheWVyc0IgaXMgb24gdG9wIG9mIGFsbCB0aGUgdHJhbnNwYXJlbnQgc3VibGF5ZXJzIGluIGxheWVyc0EsIG9yIDBcbiAgICAgKiBvdGhlcndpc2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzb3J0VHJhbnNwYXJlbnRMYXllcnMobGF5ZXJzQSwgbGF5ZXJzQikge1xuICAgICAgICByZXR1cm4gdGhpcy5fc29ydExheWVyc0Rlc2NlbmRpbmcobGF5ZXJzQSwgbGF5ZXJzQiwgdGhpcy5fdHJhbnNwYXJlbnRPcmRlcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXNlZCB0byBkZXRlcm1pbmUgd2hpY2ggYXJyYXkgb2YgbGF5ZXJzIGhhcyBhbnkgb3BhcXVlIHN1YmxheWVyIHRoYXQgaXMgb24gdG9wIG9mIGFsbCB0aGVcbiAgICAgKiBvcGFxdWUgc3VibGF5ZXJzIGluIHRoZSBvdGhlciBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGxheWVyc0EgLSBJRHMgb2YgbGF5ZXJzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGxheWVyc0IgLSBJRHMgb2YgbGF5ZXJzLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgYSBuZWdhdGl2ZSBudW1iZXIgaWYgYW55IG9mIHRoZSBvcGFxdWUgc3VibGF5ZXJzIGluIGxheWVyc0EgaXMgb25cbiAgICAgKiB0b3Agb2YgYWxsIHRoZSBvcGFxdWUgc3VibGF5ZXJzIGluIGxheWVyc0IsIG9yIGEgcG9zaXRpdmUgbnVtYmVyIGlmIGFueSBvZiB0aGUgb3BhcXVlXG4gICAgICogc3VibGF5ZXJzIGluIGxheWVyc0IgaXMgb24gdG9wIG9mIGFsbCB0aGUgb3BhcXVlIHN1YmxheWVycyBpbiBsYXllcnNBLCBvciAwIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHNvcnRPcGFxdWVMYXllcnMobGF5ZXJzQSwgbGF5ZXJzQikge1xuICAgICAgICByZXR1cm4gdGhpcy5fc29ydExheWVyc0Rlc2NlbmRpbmcobGF5ZXJzQSwgbGF5ZXJzQiwgdGhpcy5fb3BhcXVlT3JkZXIpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTGF5ZXJDb21wb3NpdGlvbiB9O1xuIl0sIm5hbWVzIjpbInRlbXBTZXQiLCJTZXQiLCJ0ZW1wQ2x1c3RlckFycmF5IiwiTGF5ZXJDb21wb3NpdGlvbiIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibmFtZSIsImxheWVyTGlzdCIsInN1YkxheWVyTGlzdCIsInN1YkxheWVyRW5hYmxlZCIsIl9vcGFxdWVPcmRlciIsIl90cmFuc3BhcmVudE9yZGVyIiwiX2RpcnR5IiwiX2RpcnR5QmxlbmQiLCJfZGlydHlMaWdodHMiLCJfZGlydHlDYW1lcmFzIiwiX21lc2hJbnN0YW5jZXMiLCJfbWVzaEluc3RhbmNlc1NldCIsIl9saWdodHMiLCJfbGlnaHRzTWFwIiwiTWFwIiwiX2xpZ2h0Q29tcG9zaXRpb25EYXRhIiwiX3NwbGl0TGlnaHRzIiwiY2FtZXJhcyIsIl9yZW5kZXJBY3Rpb25zIiwiX3dvcmxkQ2x1c3RlcnMiLCJfZW1wdHlXb3JsZENsdXN0ZXJzIiwiZGVzdHJveSIsImZvckVhY2giLCJjbHVzdGVyIiwicmEiLCJnZXRFbXB0eVdvcmxkQ2x1c3RlcnMiLCJkZXZpY2UiLCJXb3JsZENsdXN0ZXJzIiwidXBkYXRlIiwiX3NwbGl0TGlnaHRzQXJyYXkiLCJ0YXJnZXQiLCJsaWdodHMiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJsZW5ndGgiLCJMSUdIVFRZUEVfT01OSSIsIkxJR0hUVFlQRV9TUE9UIiwiaSIsImxpZ2h0IiwiZW5hYmxlZCIsIl90eXBlIiwicHVzaCIsIl91cGRhdGUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJsZW4iLCJyZXN1bHQiLCJsYXllciIsImFkZFVuaXF1ZU1lc2hJbnN0YW5jZSIsImRlc3RBcnJheSIsImRlc3RTZXQiLCJzcmNBcnJheSIsImRpcnR5QmxlbmQiLCJzcmNMZW4iLCJzIiwibWVzaEluc3QiLCJoYXMiLCJhZGQiLCJtYXRlcmlhbCIsIkNPTVBVUERBVEVEX0lOU1RBTkNFUyIsImNsZWFyIiwicGFzc1Rocm91Z2giLCJvcGFxdWVNZXNoSW5zdGFuY2VzIiwidHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzIiwibW92ZUJ5QmxlbmRUeXBlIiwiZGVzdCIsInNyYyIsIm1vdmVUcmFuc3BhcmVudCIsInRyYW5zcGFyZW50IiwiQ09NUFVQREFURURfQkxFTkQiLCJDT01QVVBEQVRFRF9MSUdIVFMiLCJ1cGRhdGVMaWdodHMiLCJ1cGRhdGVTaGFkb3dDYXN0ZXJzIiwiQ09NUFVQREFURURfQ0FNRVJBUyIsImoiLCJjYW1lcmEiLCJpbmRleCIsImluZGV4T2YiLCJzb3J0UHJpb3JpdHkiLCJjYW1lcmFMYXllcnMiLCJyZW5kZXJBY3Rpb25Db3VudCIsImNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uIiwiY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCIsImxhc3RSZW5kZXJBY3Rpb24iLCJwb3N0UHJvY2Vzc01hcmtlZCIsImxheWVycyIsImlkIiwiZGlzYWJsZVBvc3RFZmZlY3RzTGF5ZXIiLCJ0cmlnZ2VyUG9zdHByb2Nlc3MiLCJjYW1lcmFJbmRleCIsImFkZFJlbmRlckFjdGlvbiIsImNvbGxlY3REaXJlY3Rpb25hbExpZ2h0cyIsImxhc3RDYW1lcmFVc2UiLCJyZW5kZXJUYXJnZXQiLCJwb3N0RWZmZWN0c0VuYWJsZWQiLCJwcm9wYWdhdGVSZW5kZXJUYXJnZXQiLCJhbGxvY2F0ZUxpZ2h0Q2x1c3RlcnMiLCJfbG9nUmVuZGVyQWN0aW9ucyIsImxpZ2h0Q291bnQiLCJjbGVhclNoYWRvd0Nhc3RlcnMiLCJjYXN0U2hhZG93cyIsImxpZ2h0SW5kZXgiLCJnZXQiLCJsaWdodENvbXBEYXRhIiwiYWRkU2hhZG93Q2FzdGVycyIsInNoYWRvd0Nhc3RlcnMiLCJjb3VudCIsInVuZGVmaW5lZCIsInNldCIsIkxpZ2h0Q29tcG9zaXRpb25EYXRhIiwiZmluZENvbXBhdGlibGVDbHVzdGVyIiwiZW1wdHlXb3JsZENsdXN0ZXJzIiwicmFMYXllciIsImxheWVySW5kZXgiLCJsaWdodENsdXN0ZXJzIiwiZXF1YWxzIiwiX2NsdXN0ZXJlZExpZ2h0c1NldCIsImhhc0NsdXN0ZXJlZExpZ2h0cyIsIm1lc2hJbnN0YW5jZXMiLCJjbHVzdGVycyIsInBvcCIsIml0ZW0iLCJyZW5kZXJBY3Rpb25zIiwicmVuZGVyQWN0aW9uSW5kZXgiLCJyZW5kZXJBY3Rpb24iLCJSZW5kZXJBY3Rpb24iLCJydCIsIkxBWUVSSURfREVQVEgiLCJ1c2VkIiwibmVlZHNDbGVhciIsImNsZWFyQ29sb3IiLCJjbGVhckNvbG9yQnVmZmVyIiwiY2xlYXJEZXB0aCIsImNsZWFyRGVwdGhCdWZmZXIiLCJjbGVhclN0ZW5jaWwiLCJjbGVhclN0ZW5jaWxCdWZmZXIiLCJyZXNldCIsImZpcnN0Q2FtZXJhVXNlIiwic3RhcnRJbmRleCIsImZyb21DYW1lcmEiLCJhIiwidGhpc0NhbWVyYSIsInJlY3QiLCJzY2lzc29yUmVjdCIsIlRyYWNpbmciLCJUUkFDRUlEX1JFTkRFUl9BQ1RJT04iLCJEZWJ1ZyIsInRyYWNlIiwiZGlyTGlnaHRDb3VudCIsImRpcmVjdGlvbmFsTGlnaHRzIiwiZW50aXR5IiwicGFkRW5kIiwidG9TdHJpbmciLCJwYWRTdGFydCIsInNpemUiLCJfbGlnaHRzU2V0IiwiX2lzTGF5ZXJBZGRlZCIsImVycm9yIiwiX2lzU3VibGF5ZXJBZGRlZCIsImZpcmUiLCJpbnNlcnQiLCJzcGxpY2UiLCJfdXBkYXRlT3BhcXVlT3JkZXIiLCJfdXBkYXRlVHJhbnNwYXJlbnRPcmRlciIsInJlbW92ZSIsInB1c2hPcGFxdWUiLCJpbnNlcnRPcGFxdWUiLCJyZW1vdmVPcGFxdWUiLCJwdXNoVHJhbnNwYXJlbnQiLCJpbnNlcnRUcmFuc3BhcmVudCIsInJlbW92ZVRyYW5zcGFyZW50IiwiX2dldFN1YmxheWVySW5kZXgiLCJnZXRPcGFxdWVJbmRleCIsImdldFRyYW5zcGFyZW50SW5kZXgiLCJnZXRMYXllckJ5SWQiLCJnZXRMYXllckJ5TmFtZSIsImVuZEluZGV4IiwiX3NvcnRMYXllcnNEZXNjZW5kaW5nIiwibGF5ZXJzQSIsImxheWVyc0IiLCJvcmRlciIsInRvcExheWVyQSIsInRvcExheWVyQiIsImhhc093blByb3BlcnR5IiwiTWF0aCIsIm1heCIsInNvcnRUcmFuc3BhcmVudExheWVycyIsInNvcnRPcGFxdWVMYXllcnMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpQkEsTUFBTUEsT0FBTyxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBO0FBQ3pCLE1BQU1DLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTs7QUFRM0IsTUFBTUMsZ0JBQWdCLFNBQVNDLFlBQVksQ0FBQzs7QUFTeENDLEVB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
