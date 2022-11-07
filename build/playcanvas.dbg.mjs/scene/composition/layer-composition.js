/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXItY29tcG9zaXRpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUUkFDRUlEX1JFTkRFUl9BQ1RJT04gfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVHJhY2luZyB9IGZyb20gJy4uLy4uL2NvcmUvdHJhY2luZy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgc2V0IH0gZnJvbSAnLi4vLi4vY29yZS9zZXQtdXRpbHMuanMnO1xuaW1wb3J0IHsgc29ydFByaW9yaXR5IH0gZnJvbSAnLi4vLi4vY29yZS9zb3J0LmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUklEX0RFUFRILFxuICAgIENPTVBVUERBVEVEX0JMRU5ELCBDT01QVVBEQVRFRF9DQU1FUkFTLCBDT01QVVBEQVRFRF9JTlNUQU5DRVMsIENPTVBVUERBVEVEX0xJR0hUUyxcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJBY3Rpb24gfSBmcm9tICcuL3JlbmRlci1hY3Rpb24uanMnO1xuaW1wb3J0IHsgV29ybGRDbHVzdGVycyB9IGZyb20gJy4uL2xpZ2h0aW5nL3dvcmxkLWNsdXN0ZXJzLmpzJztcbmltcG9ydCB7IExpZ2h0Q29tcG9zaXRpb25EYXRhIH0gZnJvbSAnLi9saWdodC1jb21wb3NpdGlvbi1kYXRhLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBHcmFwaGljc0RldmljZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9IENhbWVyYUNvbXBvbmVudCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IExheWVyICovXG5cbmNvbnN0IHRlbXBTZXQgPSBuZXcgU2V0KCk7XG5jb25zdCB0ZW1wQ2x1c3RlckFycmF5ID0gW107XG5cbi8qKlxuICogTGF5ZXIgQ29tcG9zaXRpb24gaXMgYSBjb2xsZWN0aW9uIG9mIHtAbGluayBMYXllcn0gdGhhdCBpcyBmZWQgdG8ge0BsaW5rIFNjZW5lI2xheWVyc30gdG8gZGVmaW5lXG4gKiByZW5kZXJpbmcgb3JkZXIuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBMYXllckNvbXBvc2l0aW9uIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvLyBDb21wb3NpdGlvbiBjYW4gaG9sZCBvbmx5IDIgc3VibGF5ZXJzIG9mIGVhY2ggbGF5ZXJcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBPcHRpb25hbCBub24tdW5pcXVlIG5hbWUgb2YgdGhlIGxheWVyIGNvbXBvc2l0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIFwiVW50aXRsZWRcIiBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUgPSAnVW50aXRsZWQnKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2Yge0BsaW5rIExheWVyfSBzb3J0ZWQgaW4gdGhlIG9yZGVyIHRoZXkgd2lsbCBiZSByZW5kZXJlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0xheWVyW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxheWVyTGlzdCA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIHJlYWQtb25seSBhcnJheSBvZiBib29sZWFuIHZhbHVlcywgbWF0Y2hpbmcge0BsaW5rIExheWVyI2xheWVyTGlzdH0uIFRydWUgbWVhbnMgb25seVxuICAgICAgICAgKiBzZW1pLXRyYW5zcGFyZW50IG9iamVjdHMgYXJlIHJlbmRlcmVkLCBhbmQgZmFsc2UgbWVhbnMgb3BhcXVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbltdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zdWJMYXllckxpc3QgPSBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2YgYm9vbGVhbiB2YWx1ZXMsIG1hdGNoaW5nIHtAbGluayBMYXllciNsYXllckxpc3R9LiBUcnVlIG1lYW5zIHRoZVxuICAgICAgICAgKiBsYXllciBpcyByZW5kZXJlZCwgZmFsc2UgbWVhbnMgaXQncyBza2lwcGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbltdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQgPSBbXTsgLy8gbW9yZSBncmFudWxhciBjb250cm9sIG9uIHRvcCBvZiBsYXllci5lbmFibGVkIChBTkRlZClcblxuICAgICAgICB0aGlzLl9vcGFxdWVPcmRlciA9IHt9O1xuICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyID0ge307XG5cbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSBmYWxzZTtcblxuICAgICAgICAvLyBhbGwgdW5pcXVlIG1lc2hJbnN0YW5jZXMgZnJvbSBhbGwgbGF5ZXJzLCBzdG9yZWQgYm90aCBhcyBhbiBhcnJheSwgYW5kIGFsc28gYSBzZXQgZm9yIGZhc3Qgc2VhcmNoXG4gICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1NldCA9IG5ldyBTZXQoKTtcblxuICAgICAgICAvLyBhbiBhcnJheSBvZiBhbGwgdW5pcXVlIGxpZ2h0cyBmcm9tIGFsbCBsYXllcnNcbiAgICAgICAgdGhpcy5fbGlnaHRzID0gW107XG5cbiAgICAgICAgLy8gYSBtYXAgb2YgTGlnaHQgdG8gaW5kZXggaW4gX2xpZ2h0cyBmb3IgZmFzdCBsb29rdXBcbiAgICAgICAgdGhpcy5fbGlnaHRzTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIGVhY2ggZW50cnkgaW4gX2xpZ2h0cyBoYXMgZW50cnkgb2YgdHlwZSBMaWdodENvbXBvc2l0aW9uRGF0YSBoZXJlIGF0IHRoZSBzYW1lIGluZGV4LFxuICAgICAgICAvLyBzdG9yaW5nIHNoYWRvdyBjYXN0ZXJzIGFuZCBhZGRpdGlvbmFsIGNvbXBvc2l0aW9uIHJlbGF0ZWQgZGF0YSBmb3IgdGhlIGxpZ2h0XG4gICAgICAgIHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhID0gW107XG5cbiAgICAgICAgLy8gX2xpZ2h0cyBzcGxpdCBpbnRvIGFycmF5cyBwZXIgdHlwZSBvZiBsaWdodCwgaW5kZXhlZCBieSBMSUdIVFRZUEVfKioqIGNvbnN0YW50c1xuICAgICAgICB0aGlzLl9zcGxpdExpZ2h0cyA9IFtbXSwgW10sIFtdXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2Yge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gdGhhdCBjYW4gYmUgdXNlZCBkdXJpbmcgcmVuZGVyaW5nLiBlLmcuXG4gICAgICAgICAqIEluc2lkZSB7QGxpbmsgTGF5ZXIjb25QcmVDdWxsfSwge0BsaW5rIExheWVyI29uUG9zdEN1bGx9LCB7QGxpbmsgTGF5ZXIjb25QcmVSZW5kZXJ9LFxuICAgICAgICAgKiB7QGxpbmsgTGF5ZXIjb25Qb3N0UmVuZGVyfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NhbWVyYUNvbXBvbmVudFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jYW1lcmFzID0gW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhY3R1YWwgcmVuZGVyaW5nIHNlcXVlbmNlLCBnZW5lcmF0ZWQgYmFzZWQgb24gbGF5ZXJzIGFuZCBjYW1lcmFzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtSZW5kZXJBY3Rpb25bXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9ucyA9IFtdO1xuXG4gICAgICAgIC8vIGFsbCBjdXJyZW50bHkgY3JlYXRlZCBsaWdodCBjbHVzdGVycywgdGhhdCBuZWVkIHRvIGJlIHVwZGF0ZWQgYmVmb3JlIHJlbmRlcmluZ1xuICAgICAgICB0aGlzLl93b3JsZENsdXN0ZXJzID0gW107XG5cbiAgICAgICAgLy8gZW1wdHkgY2x1c3RlciB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMgPSBudWxsO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIGVtcHR5IGxpZ2h0IGNsdXN0ZXJcbiAgICAgICAgaWYgKHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycykge1xuICAgICAgICAgICAgdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhbGwgb3RoZXIgY2x1c3RlcnNcbiAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycy5mb3JFYWNoKChjbHVzdGVyKSA9PiB7XG4gICAgICAgICAgICBjbHVzdGVyLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3dvcmxkQ2x1c3RlcnMgPSBudWxsO1xuXG4gICAgICAgIC8vIHJlbmRlciBhY3Rpb25zXG4gICAgICAgIHRoaXMuX3JlbmRlckFjdGlvbnMuZm9yRWFjaChyYSA9PiByYS5kZXN0cm95KCkpO1xuICAgICAgICB0aGlzLl9yZW5kZXJBY3Rpb25zID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIGFuIGVtcHR5IGxpZ2h0IGNsdXN0ZXIgb2JqZWN0IHRvIGJlIHVzZWQgd2hlbiBubyBsaWdodHMgYXJlIHVzZWRcbiAgICBnZXRFbXB0eVdvcmxkQ2x1c3RlcnMoZGV2aWNlKSB7XG4gICAgICAgIGlmICghdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBjbHVzdGVyIHN0cnVjdHVyZSB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICAgICAgdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzID0gbmV3IFdvcmxkQ2x1c3RlcnMoZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycy5uYW1lID0gJ0NsdXN0ZXJFbXB0eSc7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBpdCBvbmNlIHRvIGF2b2lkIGRvaW5nIGl0IGVhY2ggZnJhbWVcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycy51cGRhdGUoW10sIGZhbHNlLCBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnM7XG4gICAgfVxuXG4gICAgLy8gZnVuY3Rpb24gd2hpY2ggc3BsaXRzIGxpc3Qgb2YgbGlnaHRzIG9uIGEgYSB0YXJnZXQgb2JqZWN0IGludG8gc2VwYXJhdGUgbGlzdHMgb2YgbGlnaHRzIGJhc2VkIG9uIGxpZ2h0IHR5cGVcbiAgICBfc3BsaXRMaWdodHNBcnJheSh0YXJnZXQpIHtcbiAgICAgICAgY29uc3QgbGlnaHRzID0gdGFyZ2V0Ll9saWdodHM7XG4gICAgICAgIHRhcmdldC5fc3BsaXRMaWdodHNbTElHSFRUWVBFX0RJUkVDVElPTkFMXS5sZW5ndGggPSAwO1xuICAgICAgICB0YXJnZXQuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXS5sZW5ndGggPSAwO1xuICAgICAgICB0YXJnZXQuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXS5sZW5ndGggPSAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGlmIChsaWdodC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Ll9zcGxpdExpZ2h0c1tsaWdodC5fdHlwZV0ucHVzaChsaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlKGRldmljZSwgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gZmFsc2UpIHtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICBsZXQgcmVzdWx0ID0gMDtcblxuICAgICAgICAvLyBpZiBjb21wb3NpdGlvbiBkaXJ0eSBmbGFncyBhcmUgbm90IHNldCwgdGVzdCBpZiBsYXllcnMgYXJlIG1hcmtlZCBkaXJ0eVxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5IHx8ICF0aGlzLl9kaXJ0eUxpZ2h0cyB8fCAhdGhpcy5fZGlydHlDYW1lcmFzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX2RpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLl9kaXJ0eUxpZ2h0cykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsYXllci5fZGlydHlDYW1lcmFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZnVuY3Rpb24gYWRkcyB1bmlxdWUgbWVzaEluc3RhbmNlcyBmcm9tIHNyYyBhcnJheSBpbnRvIGRlc3RBcnJheS4gQSBkZXN0U2V0IGlzIGEgU2V0IGNvbnRhaW5pbmcgYWxyZWFkeVxuICAgICAgICAvLyBleGlzdGluZyBtZXNoSW5zdGFuY2VzICB0byBhY2NlbGVyYXRlIHRoZSByZW1vdmFsIG9mIGR1cGxpY2F0ZXNcbiAgICAgICAgLy8gcmV0dXJucyB0cnVlIGlmIGFueSBvZiB0aGUgbWF0ZXJpYWxzIG9uIHRoZXNlIG1lc2hJbnN0YW5jZXMgaGFzIF9kaXJ0eUJsZW5kIHNldFxuICAgICAgICBmdW5jdGlvbiBhZGRVbmlxdWVNZXNoSW5zdGFuY2UoZGVzdEFycmF5LCBkZXN0U2V0LCBzcmNBcnJheSkge1xuICAgICAgICAgICAgbGV0IGRpcnR5QmxlbmQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IHNyY0xlbiA9IHNyY0FycmF5Lmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IHMgPSAwOyBzIDwgc3JjTGVuOyBzKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5zdCA9IHNyY0FycmF5W3NdO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFkZXN0U2V0LmhhcyhtZXNoSW5zdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzdFNldC5hZGQobWVzaEluc3QpO1xuICAgICAgICAgICAgICAgICAgICBkZXN0QXJyYXkucHVzaChtZXNoSW5zdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBtZXNoSW5zdC5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsICYmIG1hdGVyaWFsLl9kaXJ0eUJsZW5kKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLl9kaXJ0eUJsZW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGlydHlCbGVuZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlYnVpbGQgdGhpcy5fbWVzaEluc3RhbmNlcyBhcnJheSAtIGFkZCBhbGwgdW5pcXVlIG1lc2hJbnN0YW5jZXMgZnJvbSBhbGwgbGF5ZXJzIHRvIGl0XG4gICAgICAgIC8vIGFsc28gc2V0IHRoaXMuX2RpcnR5QmxlbmQgdG8gdHJ1ZSBpZiBtYXRlcmlhbCBvZiBhbnkgbWVzaEluc3RhbmNlIGhhcyBfZGlydHlCbGVuZCBzZXQsIGFuZCBjbGVhciB0aG9zZSBmbGFncyBvbiBtYXRlcmlhbHNcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5KSB7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfSU5TVEFOQ0VTO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1NldC5jbGVhcigpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyLnBhc3NUaHJvdWdoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIG1lc2hJbnN0YW5jZXMgZnJvbSBib3RoIG9wYXF1ZSBhbmQgdHJhbnNwYXJlbnQgbGlzdHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGFkZFVuaXF1ZU1lc2hJbnN0YW5jZSh0aGlzLl9tZXNoSW5zdGFuY2VzLCB0aGlzLl9tZXNoSW5zdGFuY2VzU2V0LCBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzKSB8fCB0aGlzLl9kaXJ0eUJsZW5kO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUJsZW5kID0gYWRkVW5pcXVlTWVzaEluc3RhbmNlKHRoaXMuX21lc2hJbnN0YW5jZXMsIHRoaXMuX21lc2hJbnN0YW5jZXNTZXQsIGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcykgfHwgdGhpcy5fZGlydHlCbGVuZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsYXllci5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZ1bmN0aW9uIG1vdmVzIHRyYW5zcGFyZW50IG9yIG9wYXF1ZSBtZXNoZXMgYmFzZWQgb24gbW92ZVRyYW5zcGFyZW50IGZyb20gc3JjIHRvIGRlc3QgYXJyYXlcbiAgICAgICAgZnVuY3Rpb24gbW92ZUJ5QmxlbmRUeXBlKGRlc3QsIHNyYywgbW92ZVRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzID0gMDsgcyA8IHNyYy5sZW5ndGg7KSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3JjW3NdLm1hdGVyaWFsPy50cmFuc3BhcmVudCA9PT0gbW92ZVRyYW5zcGFyZW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIGl0IHRvIGRlc3RcbiAgICAgICAgICAgICAgICAgICAgZGVzdC5wdXNoKHNyY1tzXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGl0IGZyb20gc3JjXG4gICAgICAgICAgICAgICAgICAgIHNyY1tzXSA9IHNyY1tzcmMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgICAgIHNyYy5sZW5ndGgtLTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8ganVzdCBza2lwIGl0XG4gICAgICAgICAgICAgICAgICAgIHMrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3IgZWFjaCBsYXllciwgc3BsaXQgaXRzIG1lc2hJbnN0YW5jZXMgdG8gZWl0aGVyIG9wYXF1ZSBvciB0cmFuc3BhcmVudCBhcnJheSBiYXNlZCBvbiBtYXRlcmlhbCBibGVuZCB0eXBlXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUJsZW5kKSB7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfQkxFTkQ7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgICAgIGlmICghbGF5ZXIucGFzc1Rocm91Z2gpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtb3ZlIGFueSBvcGFxdWUgbWVzaEluc3RhbmNlcyBmcm9tIHRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyB0byBvcGFxdWVNZXNoSW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgICAgIG1vdmVCeUJsZW5kVHlwZShsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzLCBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMsIGZhbHNlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtb3ZlIGFueSB0cmFuc3BhcmVudCBtZXNoSW5zdGFuY2VzIGZyb20gb3BhcXVlTWVzaEluc3RhbmNlcyB0byB0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXNcbiAgICAgICAgICAgICAgICAgICAgbW92ZUJ5QmxlbmRUeXBlKGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcywgbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TGlnaHRzKSB7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfTElHSFRTO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy51cGRhdGVMaWdodHMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIG1lc2hlcyBPUiBsaWdodHMgY2hhbmdlZCwgcmVidWlsZCBzaGFkb3cgY2FzdGVyc1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRvd0Nhc3RlcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUNhbWVyYXMgfHwgKHJlc3VsdCAmIENPTVBVUERBVEVEX0xJR0hUUykpIHtcblxuICAgICAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gZmFsc2U7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfQ0FNRVJBUztcblxuICAgICAgICAgICAgLy8gd2FsayB0aGUgbGF5ZXJzIGFuZCBidWlsZCBhbiBhcnJheSBvZiB1bmlxdWUgY2FtZXJhcyBmcm9tIGFsbCBsYXllcnNcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgICAgICAgICAgbGF5ZXIuX2RpcnR5Q2FtZXJhcyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgLy8gZm9yIGFsbCBjYW1lcmFzIGluIHRoZSBsYXllclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuY2FtZXJhcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW2pdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2FtZXJhcy5wdXNoKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNvcnQgY2FtZXJhcyBieSBwcmlvcml0eVxuICAgICAgICAgICAgaWYgKHRoaXMuY2FtZXJhcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgc29ydFByaW9yaXR5KHRoaXMuY2FtZXJhcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvbGxlY3QgYSBsaXN0IG9mIGxheWVycyB0aGlzIGNhbWVyYSByZW5kZXJzXG4gICAgICAgICAgICBjb25zdCBjYW1lcmFMYXllcnMgPSBbXTtcblxuICAgICAgICAgICAgLy8gcmVuZGVyIGluIG9yZGVyIG9mIGNhbWVyYXMgc29ydGVkIGJ5IHByaW9yaXR5XG4gICAgICAgICAgICBsZXQgcmVuZGVyQWN0aW9uQ291bnQgPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNhbWVyYXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSB0aGlzLmNhbWVyYXNbaV07XG4gICAgICAgICAgICAgICAgY2FtZXJhTGF5ZXJzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgICAgICAgICAvLyBmaXJzdCByZW5kZXIgYWN0aW9uIGZvciB0aGlzIGNhbWVyYVxuICAgICAgICAgICAgICAgIGxldCBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCA9IHJlbmRlckFjdGlvbkNvdW50O1xuXG4gICAgICAgICAgICAgICAgLy8gbGFzdCByZW5kZXIgYWN0aW9uIGZvciB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgbGV0IGxhc3RSZW5kZXJBY3Rpb24gPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgLy8gdHJ1ZSBpZiBwb3N0IHByb2Nlc3Npbmcgc3RvcCBsYXllciB3YXMgZm91bmQgZm9yIHRoZSBjYW1lcmFcbiAgICAgICAgICAgICAgICBsZXQgcG9zdFByb2Nlc3NNYXJrZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIC8vIHdhbGsgYWxsIGdsb2JhbCBzb3J0ZWQgbGlzdCBvZiBsYXllcnMgKHN1YmxheWVycykgdG8gY2hlY2sgaWYgY2FtZXJhIHJlbmRlcnMgaXRcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGFkZHMgYm90aCBvcGFxdWUgYW5kIHRyYW5zcGFyZW50IHN1YmxheWVycyBpZiBjYW1lcmEgcmVuZGVycyB0aGUgbGF5ZXJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaisrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtqXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIGxheWVyIG5lZWRzIHRvIGJlIHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIuY2FtZXJhcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY2FtZXJhIHJlbmRlcnMgdGhpcyBsYXllclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmEubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpID49IDApIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFMYXllcnMucHVzaChsYXllcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhpcyBsYXllciBpcyB0aGUgc3RvcCBsYXllciBmb3IgcG9zdHByb2Nlc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFwb3N0UHJvY2Vzc01hcmtlZCAmJiBsYXllci5pZCA9PT0gY2FtZXJhLmRpc2FibGVQb3N0RWZmZWN0c0xheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0UHJvY2Vzc01hcmtlZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBwcmV2aW91c2x5IGFkZGVkIHJlbmRlciBhY3Rpb24gaXMgdGhlIGxhc3QgcG9zdC1wcm9jZXNzZWQgbGF5ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXN0UmVuZGVyQWN0aW9uKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBtYXJrIGl0IHRvIHRyaWdnZXIgcG9zdHByb2Nlc3NpbmcgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0UmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYW1lcmEgaW5kZXggaW4gdGhlIGxheWVyIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYUluZGV4ID0gbGF5ZXIuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmFJbmRleCA+PSAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCByZW5kZXIgYWN0aW9uIHRvIGRlc2NyaWJlIHJlbmRlcmluZyBzdGVwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0UmVuZGVyQWN0aW9uID0gdGhpcy5hZGRSZW5kZXJBY3Rpb24odGhpcy5fcmVuZGVyQWN0aW9ucywgcmVuZGVyQWN0aW9uQ291bnQsIGxheWVyLCBqLCBjYW1lcmFJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiwgcG9zdFByb2Nlc3NNYXJrZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyQWN0aW9uQ291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY2FtZXJhIHJlbmRlcnMgYW55IGxheWVycy5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCA8IHJlbmRlckFjdGlvbkNvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGJhc2VkIG9uIGFsbCBsYXllcnMgdGhpcyBjYW1lcmEgcmVuZGVycywgcHJlcGFyZSBhIGxpc3Qgb2YgZGlyZWN0aW9uYWwgbGlnaHRzIHRoZSBjYW1lcmEgbmVlZHMgdG8gcmVuZGVyIHNoYWRvdyBmb3JcbiAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHNldCB0aGVzZSB1cCBvbiB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBmb3IgdGhlIGNhbWVyYS5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9uc1tjYW1lcmFGaXJzdFJlbmRlckFjdGlvbkluZGV4XS5jb2xsZWN0RGlyZWN0aW9uYWxMaWdodHMoY2FtZXJhTGF5ZXJzLCB0aGlzLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfRElSRUNUSU9OQUxdLCB0aGlzLl9saWdodHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hcmsgdGhlIGxhc3QgcmVuZGVyIGFjdGlvbiBhcyBsYXN0IG9uZSB1c2luZyB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgICAgIGxhc3RSZW5kZXJBY3Rpb24ubGFzdENhbWVyYVVzZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgbm8gcmVuZGVyIGFjdGlvbiBmb3IgdGhpcyBjYW1lcmEgd2FzIG1hcmtlZCBmb3IgZW5kIG9mIHBvc3Rwcm9jZXNzaW5nLCBtYXJrIGxhc3Qgb25lXG4gICAgICAgICAgICAgICAgaWYgKCFwb3N0UHJvY2Vzc01hcmtlZCAmJiBsYXN0UmVuZGVyQWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RSZW5kZXJBY3Rpb24udHJpZ2dlclBvc3Rwcm9jZXNzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBoYW5kbGUgY2FtZXJhIHN0YWNraW5nIGlmIHRoaXMgcmVuZGVyIGFjdGlvbiBoYXMgcG9zdHByb2Nlc3NpbmcgZW5hYmxlZFxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEucmVuZGVyVGFyZ2V0ICYmIGNhbWVyYS5wb3N0RWZmZWN0c0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJvY2VzcyBwcmV2aW91cyByZW5kZXIgYWN0aW9ucyBzdGFydGluZyB3aXRoIHByZXZpb3VzIGNhbWVyYVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb3BhZ2F0ZVJlbmRlclRhcmdldChjYW1lcmFGaXJzdFJlbmRlckFjdGlvbkluZGV4IC0gMSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgdW51c2VkIHJlbmRlciBhY3Rpb25zXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gcmVuZGVyQWN0aW9uQ291bnQ7IGkgPCB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9uc1tpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aCA9IHJlbmRlckFjdGlvbkNvdW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWxsb2NhdGUgbGlnaHQgY2x1c3RlcmVzIGlmIGxpZ2h0cyBvciBtZXNoZXMgb3IgY2FtZXJhcyBhcmUgbW9kaWZpZWRcbiAgICAgICAgaWYgKHJlc3VsdCAmIChDT01QVVBEQVRFRF9DQU1FUkFTIHwgQ09NUFVQREFURURfTElHSFRTIHwgQ09NUFVQREFURURfSU5TVEFOQ0VTKSkge1xuXG4gICAgICAgICAgICAvLyBwcmVwYXJlIGNsdXN0ZXJlZCBsaWdodGluZyBmb3IgcmVuZGVyIGFjdGlvbnNcbiAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFsbG9jYXRlTGlnaHRDbHVzdGVycyhkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdCAmIChDT01QVVBEQVRFRF9MSUdIVFMgfCBDT01QVVBEQVRFRF9MSUdIVFMpKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2dSZW5kZXJBY3Rpb25zKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHVwZGF0ZVNoYWRvd0Nhc3RlcnMoKSB7XG5cbiAgICAgICAgLy8gX2xpZ2h0Q29tcG9zaXRpb25EYXRhIGFscmVhZHkgaGFzIHRoZSByaWdodCBzaXplLCBqdXN0IGNsZWFuIHVwIHNoYWRvdyBjYXN0ZXJzXG4gICAgICAgIGNvbnN0IGxpZ2h0Q291bnQgPSB0aGlzLl9saWdodHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRDb21wb3NpdGlvbkRhdGFbaV0uY2xlYXJTaGFkb3dDYXN0ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3IgZWFjaCBsYXllclxuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbaV07XG5cbiAgICAgICAgICAgIC8vIGxheWVyIGNhbiBiZSBpbiB0aGUgbGlzdCB0d28gdGltZXMgKG9wYXF1ZSwgdHJhbnNwKSwgYWRkIGNhc3RlcnMgb25seSBvbmUgdGltZVxuICAgICAgICAgICAgaWYgKCF0ZW1wU2V0LmhhcyhsYXllcikpIHtcbiAgICAgICAgICAgICAgICB0ZW1wU2V0LmFkZChsYXllcik7XG5cbiAgICAgICAgICAgICAgICAvLyBmb3IgZWFjaCBsaWdodCBvZiBhIGxheWVyXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRzID0gbGF5ZXIuX2xpZ2h0cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxpZ2h0cy5sZW5ndGg7IGorKykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgbmVlZCBjYXN0ZXJzIHdoZW4gY2FzdGluZyBzaGFkb3dzXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodHNbal0uY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmluZCBpdHMgaW5kZXggaW4gZ2xvYmFsIGxpZ2h0IGxpc3QsIGFuZCBnZXQgc2hhZG93IGNhc3RlcnMgZm9yIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodEluZGV4ID0gdGhpcy5fbGlnaHRzTWFwLmdldChsaWdodHNbal0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRDb21wRGF0YSA9IHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdW5pcXVlIG1lc2hlcyBmcm9tIHRoZSBsYXllciB0byBjYXN0ZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodENvbXBEYXRhLmFkZFNoYWRvd0Nhc3RlcnMobGF5ZXIuc2hhZG93Q2FzdGVycyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wU2V0LmNsZWFyKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlTGlnaHRzKCkge1xuXG4gICAgICAgIC8vIGJ1aWxkIGEgbGlzdCBhbmQgbWFwIG9mIGFsbCB1bmlxdWUgbGlnaHRzIGZyb20gYWxsIGxheWVyc1xuICAgICAgICB0aGlzLl9saWdodHMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fbGlnaHRzTWFwLmNsZWFyKCk7XG5cbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcblxuICAgICAgICAgICAgLy8gbGF5ZXIgY2FuIGJlIGluIHRoZSBsaXN0IHR3byB0aW1lcyAob3BhcXVlLCB0cmFuc3ApLCBwcm9jZXNzIGl0IG9ubHkgb25lIHRpbWVcbiAgICAgICAgICAgIGlmICghdGVtcFNldC5oYXMobGF5ZXIpKSB7XG4gICAgICAgICAgICAgICAgdGVtcFNldC5hZGQobGF5ZXIpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRzID0gbGF5ZXIuX2xpZ2h0cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxpZ2h0cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tqXTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhZGQgbmV3IGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgIGxldCBsaWdodEluZGV4ID0gdGhpcy5fbGlnaHRzTWFwLmdldChsaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodEluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0SW5kZXggPSB0aGlzLl9saWdodHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGlnaHRzTWFwLnNldChsaWdodCwgbGlnaHRJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9saWdodHMucHVzaChsaWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0aGUgbGlnaHQgaGFzIGNvbXBvc2l0aW9uIGRhdGEgYWxsb2NhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbGlnaHRDb21wRGF0YSA9IHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodENvbXBEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRDb21wRGF0YSA9IG5ldyBMaWdodENvbXBvc2l0aW9uRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdID0gbGlnaHRDb21wRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3BsaXQgbGF5ZXIgbGlnaHRzIGxpc3RzIGJ5IHR5cGVcbiAgICAgICAgICAgIHRoaXMuX3NwbGl0TGlnaHRzQXJyYXkobGF5ZXIpO1xuICAgICAgICAgICAgbGF5ZXIuX2RpcnR5TGlnaHRzID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wU2V0LmNsZWFyKCk7XG5cbiAgICAgICAgLy8gc3BsaXQgbGlnaHQgbGlzdCBieSB0eXBlXG4gICAgICAgIHRoaXMuX3NwbGl0TGlnaHRzQXJyYXkodGhpcyk7XG5cbiAgICAgICAgLy8gYWRqdXN0IF9saWdodENvbXBvc2l0aW9uRGF0YSB0byB0aGUgcmlnaHQgc2l6ZSwgbWF0Y2hpbmcgbnVtYmVyIG9mIGxpZ2h0c1xuICAgICAgICBjb25zdCBsaWdodENvdW50ID0gdGhpcy5fbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fbGlnaHRDb21wb3NpdGlvbkRhdGEubGVuZ3RoID0gbGlnaHRDb3VudDtcbiAgICB9XG5cbiAgICAvLyBmaW5kIGV4aXN0aW5nIGxpZ2h0IGNsdXN0ZXIgdGhhdCBpcyBjb21wYXRpYmxlIHdpdGggc3BlY2lmaWVkIGxheWVyXG4gICAgZmluZENvbXBhdGlibGVDbHVzdGVyKGxheWVyLCByZW5kZXJBY3Rpb25Db3VudCwgZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgLy8gY2hlY2sgYWxyZWFkeSBzZXQgdXAgcmVuZGVyIGFjdGlvbnNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJBY3Rpb25Db3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByYSA9IHRoaXMuX3JlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCByYUxheWVyID0gdGhpcy5sYXllckxpc3RbcmEubGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIC8vIG9ubHkgcmV1c2UgY2x1c3RlcnMgaWYgbm90IGVtcHR5XG4gICAgICAgICAgICBpZiAocmEubGlnaHRDbHVzdGVycyAhPT0gZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBsYXllciBpcyB0aGUgc2FtZSAoYnV0IGRpZmZlcmVudCBzdWJsYXllciksIGNsdXN0ZXIgY2FuIGJlIHVzZWQgZGlyZWN0bHkgYXMgbGlnaHRzIGFyZSB0aGUgc2FtZVxuICAgICAgICAgICAgICAgIGlmIChsYXllciA9PT0gcmFMYXllcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmEubGlnaHRDbHVzdGVycztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocmEubGlnaHRDbHVzdGVycykge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgbGF5ZXIgaGFzIGV4YWN0bHkgdGhlIHNhbWUgc2V0IG9mIGxpZ2h0cywgdXNlIHRoZSBzYW1lIGNsdXN0ZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNldC5lcXVhbHMobGF5ZXIuX2NsdXN0ZXJlZExpZ2h0c1NldCwgcmFMYXllci5fY2x1c3RlcmVkTGlnaHRzU2V0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJhLmxpZ2h0Q2x1c3RlcnM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBubyBtYXRjaFxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBhc3NpZ24gbGlnaHQgY2x1c3RlcnMgdG8gcmVuZGVyIGFjdGlvbnMgdGhhdCBuZWVkIGl0XG4gICAgYWxsb2NhdGVMaWdodENsdXN0ZXJzKGRldmljZSkge1xuXG4gICAgICAgIC8vIHJldXNlIHByZXZpb3VzbHkgYWxsb2NhdGVkIGNsdXN0ZXJzXG4gICAgICAgIHRlbXBDbHVzdGVyQXJyYXkucHVzaCguLi50aGlzLl93b3JsZENsdXN0ZXJzKTtcblxuICAgICAgICAvLyB0aGUgY2x1c3RlciB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICBjb25zdCBlbXB0eVdvcmxkQ2x1c3RlcnMgPSB0aGlzLmdldEVtcHR5V29ybGRDbHVzdGVycyhkZXZpY2UpO1xuXG4gICAgICAgIC8vIHN0YXJ0IHdpdGggbm8gY2x1c3RlcnNcbiAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vIHByb2Nlc3MgYWxsIHJlbmRlciBhY3Rpb25zXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fcmVuZGVyQWN0aW9ucy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtyYS5sYXllckluZGV4XTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIGxheWVyIGhhcyBsaWdodHMgdXNlZCBieSBjbHVzdGVyc1xuICAgICAgICAgICAgaWYgKGxheWVyLmhhc0NsdXN0ZXJlZExpZ2h0cykge1xuXG4gICAgICAgICAgICAgICAgLy8gYW5kIGlmIHRoZSBsYXllciBoYXMgbWVzaGVzXG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSB0aGlzLnN1YkxheWVyTGlzdFtyYS5sYXllckluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdHJhbnNwYXJlbnQgPyBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgOiBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2VzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJldXNlIGNsdXN0ZXIgdGhhdCB3YXMgYWxyZWFkeSBzZXQgdXAgYW5kIGlzIGNvbXBhdGlibGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNsdXN0ZXJzID0gdGhpcy5maW5kQ29tcGF0aWJsZUNsdXN0ZXIobGF5ZXIsIGksIGVtcHR5V29ybGRDbHVzdGVycyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY2x1c3RlcnMpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlIGFscmVhZHkgYWxsb2NhdGVkIGNsdXN0ZXIgZnJvbSBiZWZvcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0ZW1wQ2x1c3RlckFycmF5Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJzID0gdGVtcENsdXN0ZXJBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIG5ldyBjbHVzdGVyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNsdXN0ZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlcnMgPSBuZXcgV29ybGRDbHVzdGVycyhkZXZpY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVycy5uYW1lID0gJ0NsdXN0ZXItJyArIHRoaXMuX3dvcmxkQ2x1c3RlcnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycy5wdXNoKGNsdXN0ZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJhLmxpZ2h0Q2x1c3RlcnMgPSBjbHVzdGVycztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG5vIGNsdXN0ZXJlZCBsaWdodHMsIHVzZSB0aGUgY2x1c3RlciB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICAgICAgaWYgKCFyYS5saWdodENsdXN0ZXJzKSB7XG4gICAgICAgICAgICAgICAgcmEubGlnaHRDbHVzdGVycyA9IGVtcHR5V29ybGRDbHVzdGVycztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBsZWZ0b3ZlcnNcbiAgICAgICAgdGVtcENsdXN0ZXJBcnJheS5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgICAgICBpdGVtLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRlbXBDbHVzdGVyQXJyYXkubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBhZGRzIG5ldyByZW5kZXIgYWN0aW9uIHRvIGEgbGlzdCwgd2hpbGUgdHJ5aW5nIHRvIGxpbWl0IGFsbG9jYXRpb24gYW5kIHJldXNlIGFscmVhZHkgYWxsb2NhdGVkIG9iamVjdHNcbiAgICBhZGRSZW5kZXJBY3Rpb24ocmVuZGVyQWN0aW9ucywgcmVuZGVyQWN0aW9uSW5kZXgsIGxheWVyLCBsYXllckluZGV4LCBjYW1lcmFJbmRleCwgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24sIHBvc3RQcm9jZXNzTWFya2VkKSB7XG5cbiAgICAgICAgLy8gdHJ5IGFuZCByZXVzZSBvYmplY3QsIG90aGVyd2lzZSBhbGxvY2F0ZSBuZXdcbiAgICAgICAgLyoqIEB0eXBlIHtSZW5kZXJBY3Rpb259ICovXG4gICAgICAgIGxldCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW3JlbmRlckFjdGlvbkluZGV4XTtcbiAgICAgICAgaWYgKCFyZW5kZXJBY3Rpb24pIHtcbiAgICAgICAgICAgIHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbcmVuZGVyQWN0aW9uSW5kZXhdID0gbmV3IFJlbmRlckFjdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVuZGVyIHRhcmdldCBmcm9tIHRoZSBjYW1lcmEgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHRoZSByZW5kZXIgdGFyZ2V0IGZyb20gdGhlIGxheWVyXG4gICAgICAgIGxldCBydCA9IGxheWVyLnJlbmRlclRhcmdldDtcbiAgICAgICAgLyoqIEB0eXBlIHtDYW1lcmFDb21wb25lbnR9ICovXG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhSW5kZXhdO1xuICAgICAgICBpZiAoY2FtZXJhICYmIGNhbWVyYS5yZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgIGlmIChsYXllci5pZCAhPT0gTEFZRVJJRF9ERVBUSCkgeyAgIC8vIGlnbm9yZSBkZXB0aCBsYXllclxuICAgICAgICAgICAgICAgIHJ0ID0gY2FtZXJhLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdhcyBjYW1lcmEgYW5kIHJlbmRlciB0YXJnZXQgY29tYm8gdXNlZCBhbHJlYWR5XG4gICAgICAgIGxldCB1c2VkID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGkgPSByZW5kZXJBY3Rpb25JbmRleCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBpZiAocmVuZGVyQWN0aW9uc1tpXS5jYW1lcmEgPT09IGNhbWVyYSAmJiByZW5kZXJBY3Rpb25zW2ldLnJlbmRlclRhcmdldCA9PT0gcnQpIHtcbiAgICAgICAgICAgICAgICB1c2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGZsYWdzIC0gdXNlIGNhbWVyYSBjbGVhciBmbGFncyBpbiB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBmb3IgZWFjaCBjYW1lcmEsXG4gICAgICAgIC8vIG9yIHdoZW4gcmVuZGVyIHRhcmdldCAoZnJvbSBsYXllcikgd2FzIG5vdCB5ZXQgY2xlYXJlZCBieSB0aGlzIGNhbWVyYVxuICAgICAgICBjb25zdCBuZWVkc0NsZWFyID0gY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24gfHwgIXVzZWQ7XG4gICAgICAgIGxldCBjbGVhckNvbG9yID0gbmVlZHNDbGVhciA/IGNhbWVyYS5jbGVhckNvbG9yQnVmZmVyIDogZmFsc2U7XG4gICAgICAgIGxldCBjbGVhckRlcHRoID0gbmVlZHNDbGVhciA/IGNhbWVyYS5jbGVhckRlcHRoQnVmZmVyIDogZmFsc2U7XG4gICAgICAgIGxldCBjbGVhclN0ZW5jaWwgPSBuZWVkc0NsZWFyID8gY2FtZXJhLmNsZWFyU3RlbmNpbEJ1ZmZlciA6IGZhbHNlO1xuXG4gICAgICAgIC8vIGNsZWFyIGJ1ZmZlcnMgaWYgcmVxdWVzdGVkIGJ5IHRoZSBsYXllclxuICAgICAgICBjbGVhckNvbG9yIHx8PSBsYXllci5jbGVhckNvbG9yQnVmZmVyO1xuICAgICAgICBjbGVhckRlcHRoIHx8PSBsYXllci5jbGVhckRlcHRoQnVmZmVyO1xuICAgICAgICBjbGVhclN0ZW5jaWwgfHw9IGxheWVyLmNsZWFyU3RlbmNpbEJ1ZmZlcjtcblxuICAgICAgICAvLyBmb3IgY2FtZXJhcyB3aXRoIHBvc3QgcHJvY2Vzc2luZyBlbmFibGVkLCBvbiBsYXllcnMgYWZ0ZXIgcG9zdCBwcm9jZXNzaW5nIGhhcyBiZWVuIGFwcGxpZWQgYWxyZWFkeSAoc28gVUkgYW5kIHNpbWlsYXIpLFxuICAgICAgICAvLyBkb24ndCByZW5kZXIgdGhlbSB0byByZW5kZXIgdGFyZ2V0IGFueW1vcmVcbiAgICAgICAgaWYgKHBvc3RQcm9jZXNzTWFya2VkICYmIGNhbWVyYS5wb3N0RWZmZWN0c0VuYWJsZWQpIHtcbiAgICAgICAgICAgIHJ0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0b3JlIHRoZSBwcm9wZXJ0aWVzIC0gd3JpdGUgYWxsIGFzIHdlIHJldXNlIHByZXZpb3VzbHkgYWxsb2NhdGVkIGNsYXNzIGluc3RhbmNlc1xuICAgICAgICByZW5kZXJBY3Rpb24ucmVzZXQoKTtcbiAgICAgICAgcmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyA9IGZhbHNlO1xuICAgICAgICByZW5kZXJBY3Rpb24ubGF5ZXJJbmRleCA9IGxheWVySW5kZXg7XG4gICAgICAgIHJlbmRlckFjdGlvbi5jYW1lcmFJbmRleCA9IGNhbWVyYUluZGV4O1xuICAgICAgICByZW5kZXJBY3Rpb24uY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0ID0gcnQ7XG4gICAgICAgIHJlbmRlckFjdGlvbi5jbGVhckNvbG9yID0gY2xlYXJDb2xvcjtcbiAgICAgICAgcmVuZGVyQWN0aW9uLmNsZWFyRGVwdGggPSBjbGVhckRlcHRoO1xuICAgICAgICByZW5kZXJBY3Rpb24uY2xlYXJTdGVuY2lsID0gY2xlYXJTdGVuY2lsO1xuICAgICAgICByZW5kZXJBY3Rpb24uZmlyc3RDYW1lcmFVc2UgPSBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbjtcbiAgICAgICAgcmVuZGVyQWN0aW9uLmxhc3RDYW1lcmFVc2UgPSBmYWxzZTtcblxuICAgICAgICByZXR1cm4gcmVuZGVyQWN0aW9uO1xuICAgIH1cblxuICAgIC8vIGV4ZWN1dGVzIHdoZW4gcG9zdC1wcm9jZXNzaW5nIGNhbWVyYSdzIHJlbmRlciBhY3Rpb25zIHdlcmUgY3JlYXRlZCB0byBwcm9wYWdhdGUgcmVuZGVyaW5nIHRvXG4gICAgLy8gcmVuZGVyIHRhcmdldHMgdG8gcHJldmlvdXMgY2FtZXJhIGFzIG5lZWRlZFxuICAgIHByb3BhZ2F0ZVJlbmRlclRhcmdldChzdGFydEluZGV4LCBmcm9tQ2FtZXJhKSB7XG5cbiAgICAgICAgZm9yIChsZXQgYSA9IHN0YXJ0SW5kZXg7IGEgPj0gMDsgYS0tKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJhID0gdGhpcy5fcmVuZGVyQWN0aW9uc1thXTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbcmEubGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIC8vIGlmIHdlIGhpdCByZW5kZXIgYWN0aW9uIHdpdGggYSByZW5kZXIgdGFyZ2V0IChvdGhlciB0aGFuIGRlcHRoIGxheWVyKSwgdGhhdCBtYXJrcyB0aGUgZW5kIG9mIGNhbWVyYSBzdGFja1xuICAgICAgICAgICAgLy8gVE9ETzogcmVmYWN0b3IgdGhpcyBhcyBwYXJ0IG9mIGRlcHRoIGxheWVyIHJlZmFjdG9yaW5nXG4gICAgICAgICAgICBpZiAocmEucmVuZGVyVGFyZ2V0ICYmIGxheWVyLmlkICE9PSBMQVlFUklEX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNraXAgb3ZlciBkZXB0aCBsYXllclxuICAgICAgICAgICAgaWYgKGxheWVyLmlkID09PSBMQVlFUklEX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYSBzdGFjayBlbmRzIHdoZW4gdmlld3BvcnQgb3Igc2Npc3NvciBvZiB0aGUgY2FtZXJhIGNoYW5nZXNcbiAgICAgICAgICAgIGNvbnN0IHRoaXNDYW1lcmEgPSByYT8uY2FtZXJhLmNhbWVyYTtcbiAgICAgICAgICAgIGlmICh0aGlzQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmcm9tQ2FtZXJhLmNhbWVyYS5yZWN0LmVxdWFscyh0aGlzQ2FtZXJhLnJlY3QpIHx8ICFmcm9tQ2FtZXJhLmNhbWVyYS5zY2lzc29yUmVjdC5lcXVhbHModGhpc0NhbWVyYS5zY2lzc29yUmVjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZW5kZXIgaXQgdG8gcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgcmEucmVuZGVyVGFyZ2V0ID0gZnJvbUNhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBsb2dzIHJlbmRlciBhY3Rpb24gYW5kIHRoZWlyIHByb3BlcnRpZXNcbiAgICBfbG9nUmVuZGVyQWN0aW9ucygpIHtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmIChUcmFjaW5nLmdldChUUkFDRUlEX1JFTkRFUl9BQ1RJT04pKSB7XG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9BQ1RJT04sICdSZW5kZXIgQWN0aW9ucyBmb3IgY29tcG9zaXRpb246ICcgKyB0aGlzLm5hbWUpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVySW5kZXggPSByYS5sYXllckluZGV4O1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbbGF5ZXJJbmRleF07XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IGxheWVyLmVuYWJsZWQgJiYgdGhpcy5zdWJMYXllckVuYWJsZWRbbGF5ZXJJbmRleF07XG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSB0aGlzLnN1YkxheWVyTGlzdFtsYXllckluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW3JhLmNhbWVyYUluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXJMaWdodENvdW50ID0gcmEuZGlyZWN0aW9uYWxMaWdodHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNsZWFyID0gKHJhLmNsZWFyQ29sb3IgPyAnQ29sb3IgJyA6ICcuLi4uLiAnKSArIChyYS5jbGVhckRlcHRoID8gJ0RlcHRoICcgOiAnLi4uLi4gJykgKyAocmEuY2xlYXJTdGVuY2lsID8gJ1N0ZW5jaWwnIDogJy4uLi4uLi4nKTtcblxuICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0FDVElPTiwgaSArXG4gICAgICAgICAgICAgICAgICAgICgnIENhbTogJyArIChjYW1lcmEgPyBjYW1lcmEuZW50aXR5Lm5hbWUgOiAnLScpKS5wYWRFbmQoMjIsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAoJyBMYXk6ICcgKyBsYXllci5uYW1lKS5wYWRFbmQoMjIsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAodHJhbnNwYXJlbnQgPyAnIFRSQU5TUCcgOiAnIE9QQVFVRScpICtcbiAgICAgICAgICAgICAgICAgICAgKGVuYWJsZWQgPyAnIEVOQUJMRUQgJyA6ICcgRElTQUJMRUQnKSArXG4gICAgICAgICAgICAgICAgICAgICcgTWVzaGVzOiAnLCAodHJhbnNwYXJlbnQgPyBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMubGVuZ3RoIDogbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcy5sZW5ndGgpLnRvU3RyaW5nKCkucGFkU3RhcnQoNCkgK1xuICAgICAgICAgICAgICAgICAgICAoJyBSVDogJyArIChyYS5yZW5kZXJUYXJnZXQgPyByYS5yZW5kZXJUYXJnZXQubmFtZSA6ICctJykpLnBhZEVuZCgzMCwgJyAnKSArXG4gICAgICAgICAgICAgICAgICAgICcgQ2xlYXI6ICcgKyBjbGVhciArXG4gICAgICAgICAgICAgICAgICAgICcgTGlnaHRzOiAoJyArIGxheWVyLl9jbHVzdGVyZWRMaWdodHNTZXQuc2l6ZSArICcvJyArIGxheWVyLl9saWdodHNTZXQuc2l6ZSArICcpJyArXG4gICAgICAgICAgICAgICAgICAgICcgJyArIChyYS5saWdodENsdXN0ZXJzICE9PSB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMgPyAocmEubGlnaHRDbHVzdGVycy5uYW1lKSA6ICcnKS5wYWRFbmQoMTAsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAocmEuZmlyc3RDYW1lcmFVc2UgPyAnIENBTS1GSVJTVCcgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgICAocmEubGFzdENhbWVyYVVzZSA/ICcgQ0FNLUxBU1QnIDogJycpICtcbiAgICAgICAgICAgICAgICAgICAgKHJhLnRyaWdnZXJQb3N0cHJvY2VzcyA/ICcgUE9TVFBST0NFU1MnIDogJycpICtcbiAgICAgICAgICAgICAgICAgICAgKGRpckxpZ2h0Q291bnQgPyAoJyBEaXJMaWdodHM6ICcgKyBkaXJMaWdodENvdW50KSA6ICcnKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgX2lzTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBpZiAodGhpcy5sYXllckxpc3QuaW5kZXhPZihsYXllcikgPj0gMCkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0xheWVyIGlzIGFscmVhZHkgYWRkZWQuJyk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2lzU3VibGF5ZXJBZGRlZChsYXllciwgdHJhbnNwYXJlbnQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMubGF5ZXJMaXN0W2ldID09PSBsYXllciAmJiB0aGlzLnN1YkxheWVyTGlzdFtpXSA9PT0gdHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcignU3VibGF5ZXIgaXMgYWxyZWFkeSBhZGRlZC4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gV2hvbGUgbGF5ZXIgQVBJXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbGF5ZXIgKGJvdGggb3BhcXVlIGFuZCBzZW1pLXRyYW5zcGFyZW50IHBhcnRzKSB0byB0aGUgZW5kIG9mIHRoZSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKi9cbiAgICBwdXNoKGxheWVyKSB7XG4gICAgICAgIC8vIGFkZCBib3RoIG9wYXF1ZSBhbmQgdHJhbnNwYXJlbnQgdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXlcbiAgICAgICAgaWYgKHRoaXMuX2lzTGF5ZXJBZGRlZChsYXllcikpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3QucHVzaChsYXllcik7XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnB1c2gobGF5ZXIpO1xuICAgICAgICB0aGlzLl9vcGFxdWVPcmRlcltsYXllci5pZF0gPSB0aGlzLnN1YkxheWVyTGlzdC5wdXNoKGZhbHNlKSAtIDE7XG4gICAgICAgIHRoaXMuX3RyYW5zcGFyZW50T3JkZXJbbGF5ZXIuaWRdID0gdGhpcy5zdWJMYXllckxpc3QucHVzaCh0cnVlKSAtIDE7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIGEgbGF5ZXIgKGJvdGggb3BhcXVlIGFuZCBzZW1pLXRyYW5zcGFyZW50IHBhcnRzKSBhdCB0aGUgY2hvc2VuIGluZGV4IGluIHRoZVxuICAgICAqIHtAbGluayBMYXllciNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtMYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluc2VydGlvbiBwb3NpdGlvbi5cbiAgICAgKi9cbiAgICBpbnNlcnQobGF5ZXIsIGluZGV4KSB7XG4gICAgICAgIC8vIGluc2VydCBib3RoIG9wYXF1ZSBhbmQgdHJhbnNwYXJlbnQgYXQgdGhlIGluZGV4XG4gICAgICAgIGlmICh0aGlzLl9pc0xheWVyQWRkZWQobGF5ZXIpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnNwbGljZShpbmRleCwgMCwgbGF5ZXIsIGxheWVyKTtcbiAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCBmYWxzZSwgdHJ1ZSk7XG5cbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU9wYXF1ZU9yZGVyKGluZGV4LCBjb3VudCAtIDEpO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc3BhcmVudE9yZGVyKGluZGV4LCBjb3VudCAtIDEpO1xuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaW5kZXgsIDAsIHRydWUsIHRydWUpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGxheWVyIChib3RoIG9wYXF1ZSBhbmQgc2VtaS10cmFuc3BhcmVudCBwYXJ0cykgZnJvbSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICByZW1vdmUobGF5ZXIpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGFsbCBvY2N1cnJlbmNlcyBvZiBhIGxheWVyXG4gICAgICAgIGxldCBpZCA9IHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIpO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9vcGFxdWVPcmRlcltpZF07XG4gICAgICAgIGRlbGV0ZSB0aGlzLl90cmFuc3BhcmVudE9yZGVyW2lkXTtcblxuICAgICAgICB3aGlsZSAoaWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGlkLCAxKTtcbiAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpZCwgMSk7XG4gICAgICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaWQsIDEpO1xuICAgICAgICAgICAgaWQgPSB0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGxheWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBib3RoIG9yZGVyc1xuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdXBkYXRlT3BhcXVlT3JkZXIoMCwgY291bnQgLSAxKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNwYXJlbnRPcmRlcigwLCBjb3VudCAtIDEpO1xuICAgIH1cblxuICAgIC8vIFN1YmxheWVyIEFQSVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBwYXJ0IG9mIHRoZSBsYXllciB3aXRoIG9wYXF1ZSAobm9uIHNlbWktdHJhbnNwYXJlbnQpIG9iamVjdHMgdG8gdGhlIGVuZCBvZiB0aGVcbiAgICAgKiB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKi9cbiAgICBwdXNoT3BhcXVlKGxheWVyKSB7XG4gICAgICAgIC8vIGFkZCBvcGFxdWUgdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXlcbiAgICAgICAgaWYgKHRoaXMuX2lzU3VibGF5ZXJBZGRlZChsYXllciwgZmFsc2UpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnB1c2gobGF5ZXIpO1xuICAgICAgICB0aGlzLl9vcGFxdWVPcmRlcltsYXllci5pZF0gPSB0aGlzLnN1YkxheWVyTGlzdC5wdXNoKGZhbHNlKSAtIDE7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIGFuIG9wYXF1ZSBwYXJ0IG9mIHRoZSBsYXllciAobm9uIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMpIGF0IHRoZSBjaG9zZW5cbiAgICAgKiBpbmRleCBpbiB0aGUge0BsaW5rIExheWVyI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBhZGQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gSW5zZXJ0aW9uIHBvc2l0aW9uLlxuICAgICAqL1xuICAgIGluc2VydE9wYXF1ZShsYXllciwgaW5kZXgpIHtcbiAgICAgICAgLy8gaW5zZXJ0IG9wYXF1ZSBhdCBpbmRleFxuICAgICAgICBpZiAodGhpcy5faXNTdWJsYXllckFkZGVkKGxheWVyLCBmYWxzZSkpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCBsYXllcik7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpbmRleCwgMCwgZmFsc2UpO1xuXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5zdWJMYXllckxpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLl91cGRhdGVPcGFxdWVPcmRlcihpbmRleCwgY291bnQgLSAxKTtcblxuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaW5kZXgsIDAsIHRydWUpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbiBvcGFxdWUgcGFydCBvZiB0aGUgbGF5ZXIgKG5vbiBzZW1pLXRyYW5zcGFyZW50IG1lc2ggaW5zdGFuY2VzKSBmcm9tXG4gICAgICoge0BsaW5rIExheWVyI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlT3BhcXVlKGxheWVyKSB7XG4gICAgICAgIC8vIHJlbW92ZSBvcGFxdWUgb2NjdXJyZW5jZXMgb2YgYSBsYXllclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5sYXllckxpc3QubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdFtpXSA9PT0gbGF5ZXIgJiYgIXRoaXMuc3ViTGF5ZXJMaXN0W2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgIGxlbi0tO1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU9wYXF1ZU9yZGVyKGksIGxlbiAtIDEpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3QuaW5kZXhPZihsYXllcikgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJywgbGF5ZXIpOyAvLyBubyBzdWJsYXllcnMgbGVmdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHBhcnQgb2YgdGhlIGxheWVyIHdpdGggc2VtaS10cmFuc3BhcmVudCBvYmplY3RzIHRvIHRoZSBlbmQgb2YgdGhlIHtAbGluayBMYXllciNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtMYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqL1xuICAgIHB1c2hUcmFuc3BhcmVudChsYXllcikge1xuICAgICAgICAvLyBhZGQgdHJhbnNwYXJlbnQgdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXlcbiAgICAgICAgaWYgKHRoaXMuX2lzU3VibGF5ZXJBZGRlZChsYXllciwgdHJ1ZSkpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3QucHVzaChsYXllcik7XG4gICAgICAgIHRoaXMuX3RyYW5zcGFyZW50T3JkZXJbbGF5ZXIuaWRdID0gdGhpcy5zdWJMYXllckxpc3QucHVzaCh0cnVlKSAtIDE7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIGEgc2VtaS10cmFuc3BhcmVudCBwYXJ0IG9mIHRoZSBsYXllciBhdCB0aGUgY2hvc2VuIGluZGV4IGluIHRoZSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBJbnNlcnRpb24gcG9zaXRpb24uXG4gICAgICovXG4gICAgaW5zZXJ0VHJhbnNwYXJlbnQobGF5ZXIsIGluZGV4KSB7XG4gICAgICAgIC8vIGluc2VydCB0cmFuc3BhcmVudCBhdCBpbmRleFxuICAgICAgICBpZiAodGhpcy5faXNTdWJsYXllckFkZGVkKGxheWVyLCB0cnVlKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIGxheWVyKTtcbiAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCB0cnVlKTtcblxuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMuc3ViTGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNwYXJlbnRPcmRlcihpbmRleCwgY291bnQgLSAxKTtcblxuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaW5kZXgsIDAsIHRydWUpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIHRyYW5zcGFyZW50IHBhcnQgb2YgdGhlIGxheWVyIGZyb20ge0BsaW5rIExheWVyI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlVHJhbnNwYXJlbnQobGF5ZXIpIHtcbiAgICAgICAgLy8gcmVtb3ZlIHRyYW5zcGFyZW50IG9jY3VycmVuY2VzIG9mIGEgbGF5ZXJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0gPT09IGxheWVyICYmIHRoaXMuc3ViTGF5ZXJMaXN0W2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgIGxlbi0tO1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIoaSwgbGVuIC0gMSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmUnLCBsYXllcik7IC8vIG5vIHN1YmxheWVycyBsZWZ0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9nZXRTdWJsYXllckluZGV4KGxheWVyLCB0cmFuc3BhcmVudCkge1xuICAgICAgICAvLyBmaW5kIHN1YmxheWVyIGluZGV4IGluIHRoZSBjb21wb3NpdGlvbiBhcnJheVxuICAgICAgICBsZXQgaWQgPSB0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKTtcbiAgICAgICAgaWYgKGlkIDwgMCkgcmV0dXJuIC0xO1xuXG4gICAgICAgIGlmICh0aGlzLnN1YkxheWVyTGlzdFtpZF0gIT09IHRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBpZCA9IHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIsIGlkICsgMSk7XG4gICAgICAgICAgICBpZiAoaWQgPCAwKSByZXR1cm4gLTE7XG4gICAgICAgICAgICBpZiAodGhpcy5zdWJMYXllckxpc3RbaWRdICE9PSB0cmFuc3BhcmVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBpbmRleCBvZiB0aGUgb3BhcXVlIHBhcnQgb2YgdGhlIHN1cHBsaWVkIGxheWVyIGluIHRoZSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGZpbmQgaW5kZXggb2YuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGluZGV4IG9mIHRoZSBvcGFxdWUgcGFydCBvZiB0aGUgc3BlY2lmaWVkIGxheWVyLlxuICAgICAqL1xuICAgIGdldE9wYXF1ZUluZGV4KGxheWVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTdWJsYXllckluZGV4KGxheWVyLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBpbmRleCBvZiB0aGUgc2VtaS10cmFuc3BhcmVudCBwYXJ0IG9mIHRoZSBzdXBwbGllZCBsYXllciBpbiB0aGUge0BsaW5rIExheWVyI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBmaW5kIGluZGV4IG9mLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBpbmRleCBvZiB0aGUgc2VtaS10cmFuc3BhcmVudCBwYXJ0IG9mIHRoZSBzcGVjaWZpZWQgbGF5ZXIuXG4gICAgICovXG4gICAgZ2V0VHJhbnNwYXJlbnRJbmRleChsYXllcikge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U3VibGF5ZXJJbmRleChsYXllciwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgYSBsYXllciBpbnNpZGUgdGhpcyBjb21wb3NpdGlvbiBieSBpdHMgSUQuIE51bGwgaXMgcmV0dXJuZWQsIGlmIG5vdGhpbmcgaXMgZm91bmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBBbiBJRCBvZiB0aGUgbGF5ZXIgdG8gZmluZC5cbiAgICAgKiBAcmV0dXJucyB7TGF5ZXJ8bnVsbH0gVGhlIGxheWVyIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNwZWNpZmllZCBJRC4gUmV0dXJucyBudWxsIGlmIGxheWVyIGlzXG4gICAgICogbm90IGZvdW5kLlxuICAgICAqL1xuICAgIGdldExheWVyQnlJZChpZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0uaWQgPT09IGlkKSByZXR1cm4gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgYSBsYXllciBpbnNpZGUgdGhpcyBjb21wb3NpdGlvbiBieSBpdHMgbmFtZS4gTnVsbCBpcyByZXR1cm5lZCwgaWYgbm90aGluZyBpcyBmb3VuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGxheWVyIHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge0xheWVyfG51bGx9IFRoZSBsYXllciBjb3JyZXNwb25kaW5nIHRvIHRoZSBzcGVjaWZpZWQgbmFtZS4gUmV0dXJucyBudWxsIGlmIGxheWVyXG4gICAgICogaXMgbm90IGZvdW5kLlxuICAgICAqL1xuICAgIGdldExheWVyQnlOYW1lKG5hbWUpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMubGF5ZXJMaXN0W2ldLm5hbWUgPT09IG5hbWUpIHJldHVybiB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBfdXBkYXRlT3BhcXVlT3JkZXIoc3RhcnRJbmRleCwgZW5kSW5kZXgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPD0gZW5kSW5kZXg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3ViTGF5ZXJMaXN0W2ldID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX29wYXF1ZU9yZGVyW3RoaXMubGF5ZXJMaXN0W2ldLmlkXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlVHJhbnNwYXJlbnRPcmRlcihzdGFydEluZGV4LCBlbmRJbmRleCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8PSBlbmRJbmRleDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zdWJMYXllckxpc3RbaV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyW3RoaXMubGF5ZXJMaXN0W2ldLmlkXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVc2VkIHRvIGRldGVybWluZSB3aGljaCBhcnJheSBvZiBsYXllcnMgaGFzIGFueSBzdWJsYXllciB0aGF0IGlzXG4gICAgLy8gb24gdG9wIG9mIGFsbCB0aGUgc3VibGF5ZXJzIGluIHRoZSBvdGhlciBhcnJheS4gVGhlIG9yZGVyIGlzIGEgZGljdGlvbmFyeVxuICAgIC8vIG9mIDxsYXllcklkLCBpbmRleD4uXG4gICAgX3NvcnRMYXllcnNEZXNjZW5kaW5nKGxheWVyc0EsIGxheWVyc0IsIG9yZGVyKSB7XG4gICAgICAgIGxldCB0b3BMYXllckEgPSAtMTtcbiAgICAgICAgbGV0IHRvcExheWVyQiA9IC0xO1xuXG4gICAgICAgIC8vIHNlYXJjaCBmb3Igd2hpY2ggbGF5ZXIgaXMgb24gdG9wIGluIGxheWVyc0FcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxheWVyc0EubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gbGF5ZXJzQVtpXTtcbiAgICAgICAgICAgIGlmIChvcmRlci5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgICAgICB0b3BMYXllckEgPSBNYXRoLm1heCh0b3BMYXllckEsIG9yZGVyW2lkXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZWFyY2ggZm9yIHdoaWNoIGxheWVyIGlzIG9uIHRvcCBpbiBsYXllcnNCXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXllcnNCLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGxheWVyc0JbaV07XG4gICAgICAgICAgICBpZiAob3JkZXIuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgdG9wTGF5ZXJCID0gTWF0aC5tYXgodG9wTGF5ZXJCLCBvcmRlcltpZF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIGxheWVycyBvZiBsYXllcnNBIG9yIGxheWVyc0IgZG8gbm90IGV4aXN0IGF0IGFsbFxuICAgICAgICAvLyBpbiB0aGUgY29tcG9zaXRpb24gdGhlbiByZXR1cm4gZWFybHkgd2l0aCB0aGUgb3RoZXIuXG4gICAgICAgIGlmICh0b3BMYXllckEgPT09IC0xICYmIHRvcExheWVyQiAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2UgaWYgKHRvcExheWVyQiA9PT0gLTEgJiYgdG9wTGF5ZXJBICE9PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc29ydCBpbiBkZXNjZW5kaW5nIG9yZGVyIHNpbmNlIHdlIHdhbnRcbiAgICAgICAgLy8gdGhlIGhpZ2hlciBvcmRlciB0byBiZSBmaXJzdFxuICAgICAgICByZXR1cm4gdG9wTGF5ZXJCIC0gdG9wTGF5ZXJBO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGV0ZXJtaW5lIHdoaWNoIGFycmF5IG9mIGxheWVycyBoYXMgYW55IHRyYW5zcGFyZW50IHN1YmxheWVyIHRoYXQgaXMgb24gdG9wIG9mIGFsbFxuICAgICAqIHRoZSB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gdGhlIG90aGVyIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQSAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQiAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBhIG5lZ2F0aXZlIG51bWJlciBpZiBhbnkgb2YgdGhlIHRyYW5zcGFyZW50IHN1YmxheWVycyBpbiBsYXllcnNBXG4gICAgICogaXMgb24gdG9wIG9mIGFsbCB0aGUgdHJhbnNwYXJlbnQgc3VibGF5ZXJzIGluIGxheWVyc0IsIG9yIGEgcG9zaXRpdmUgbnVtYmVyIGlmIGFueSBvZiB0aGVcbiAgICAgKiB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gbGF5ZXJzQiBpcyBvbiB0b3Agb2YgYWxsIHRoZSB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gbGF5ZXJzQSwgb3IgMFxuICAgICAqIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHNvcnRUcmFuc3BhcmVudExheWVycyhsYXllcnNBLCBsYXllcnNCKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3J0TGF5ZXJzRGVzY2VuZGluZyhsYXllcnNBLCBsYXllcnNCLCB0aGlzLl90cmFuc3BhcmVudE9yZGVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGRldGVybWluZSB3aGljaCBhcnJheSBvZiBsYXllcnMgaGFzIGFueSBvcGFxdWUgc3VibGF5ZXIgdGhhdCBpcyBvbiB0b3Agb2YgYWxsIHRoZVxuICAgICAqIG9wYXF1ZSBzdWJsYXllcnMgaW4gdGhlIG90aGVyIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQSAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQiAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBhIG5lZ2F0aXZlIG51bWJlciBpZiBhbnkgb2YgdGhlIG9wYXF1ZSBzdWJsYXllcnMgaW4gbGF5ZXJzQSBpcyBvblxuICAgICAqIHRvcCBvZiBhbGwgdGhlIG9wYXF1ZSBzdWJsYXllcnMgaW4gbGF5ZXJzQiwgb3IgYSBwb3NpdGl2ZSBudW1iZXIgaWYgYW55IG9mIHRoZSBvcGFxdWVcbiAgICAgKiBzdWJsYXllcnMgaW4gbGF5ZXJzQiBpcyBvbiB0b3Agb2YgYWxsIHRoZSBvcGFxdWUgc3VibGF5ZXJzIGluIGxheWVyc0EsIG9yIDAgb3RoZXJ3aXNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc29ydE9wYXF1ZUxheWVycyhsYXllcnNBLCBsYXllcnNCKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3J0TGF5ZXJzRGVzY2VuZGluZyhsYXllcnNBLCBsYXllcnNCLCB0aGlzLl9vcGFxdWVPcmRlcik7XG4gICAgfVxufVxuXG5leHBvcnQgeyBMYXllckNvbXBvc2l0aW9uIH07XG4iXSwibmFtZXMiOlsidGVtcFNldCIsIlNldCIsInRlbXBDbHVzdGVyQXJyYXkiLCJMYXllckNvbXBvc2l0aW9uIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJuYW1lIiwibGF5ZXJMaXN0Iiwic3ViTGF5ZXJMaXN0Iiwic3ViTGF5ZXJFbmFibGVkIiwiX29wYXF1ZU9yZGVyIiwiX3RyYW5zcGFyZW50T3JkZXIiLCJfZGlydHkiLCJfZGlydHlCbGVuZCIsIl9kaXJ0eUxpZ2h0cyIsIl9kaXJ0eUNhbWVyYXMiLCJfbWVzaEluc3RhbmNlcyIsIl9tZXNoSW5zdGFuY2VzU2V0IiwiX2xpZ2h0cyIsIl9saWdodHNNYXAiLCJNYXAiLCJfbGlnaHRDb21wb3NpdGlvbkRhdGEiLCJfc3BsaXRMaWdodHMiLCJjYW1lcmFzIiwiX3JlbmRlckFjdGlvbnMiLCJfd29ybGRDbHVzdGVycyIsIl9lbXB0eVdvcmxkQ2x1c3RlcnMiLCJkZXN0cm95IiwiZm9yRWFjaCIsImNsdXN0ZXIiLCJyYSIsImdldEVtcHR5V29ybGRDbHVzdGVycyIsImRldmljZSIsIldvcmxkQ2x1c3RlcnMiLCJ1cGRhdGUiLCJfc3BsaXRMaWdodHNBcnJheSIsInRhcmdldCIsImxpZ2h0cyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImxlbmd0aCIsIkxJR0hUVFlQRV9PTU5JIiwiTElHSFRUWVBFX1NQT1QiLCJpIiwibGlnaHQiLCJlbmFibGVkIiwiX3R5cGUiLCJwdXNoIiwiX3VwZGF0ZSIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImxlbiIsInJlc3VsdCIsImxheWVyIiwiYWRkVW5pcXVlTWVzaEluc3RhbmNlIiwiZGVzdEFycmF5IiwiZGVzdFNldCIsInNyY0FycmF5IiwiZGlydHlCbGVuZCIsInNyY0xlbiIsInMiLCJtZXNoSW5zdCIsImhhcyIsImFkZCIsIm1hdGVyaWFsIiwiQ09NUFVQREFURURfSU5TVEFOQ0VTIiwiY2xlYXIiLCJwYXNzVGhyb3VnaCIsIm9wYXF1ZU1lc2hJbnN0YW5jZXMiLCJ0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMiLCJtb3ZlQnlCbGVuZFR5cGUiLCJkZXN0Iiwic3JjIiwibW92ZVRyYW5zcGFyZW50IiwidHJhbnNwYXJlbnQiLCJDT01QVVBEQVRFRF9CTEVORCIsIkNPTVBVUERBVEVEX0xJR0hUUyIsInVwZGF0ZUxpZ2h0cyIsInVwZGF0ZVNoYWRvd0Nhc3RlcnMiLCJDT01QVVBEQVRFRF9DQU1FUkFTIiwiaiIsImNhbWVyYSIsImluZGV4IiwiaW5kZXhPZiIsInNvcnRQcmlvcml0eSIsImNhbWVyYUxheWVycyIsInJlbmRlckFjdGlvbkNvdW50IiwiY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24iLCJjYW1lcmFGaXJzdFJlbmRlckFjdGlvbkluZGV4IiwibGFzdFJlbmRlckFjdGlvbiIsInBvc3RQcm9jZXNzTWFya2VkIiwibGF5ZXJzIiwiaWQiLCJkaXNhYmxlUG9zdEVmZmVjdHNMYXllciIsInRyaWdnZXJQb3N0cHJvY2VzcyIsImNhbWVyYUluZGV4IiwiYWRkUmVuZGVyQWN0aW9uIiwiY29sbGVjdERpcmVjdGlvbmFsTGlnaHRzIiwibGFzdENhbWVyYVVzZSIsInJlbmRlclRhcmdldCIsInBvc3RFZmZlY3RzRW5hYmxlZCIsInByb3BhZ2F0ZVJlbmRlclRhcmdldCIsImFsbG9jYXRlTGlnaHRDbHVzdGVycyIsIl9sb2dSZW5kZXJBY3Rpb25zIiwibGlnaHRDb3VudCIsImNsZWFyU2hhZG93Q2FzdGVycyIsImNhc3RTaGFkb3dzIiwibGlnaHRJbmRleCIsImdldCIsImxpZ2h0Q29tcERhdGEiLCJhZGRTaGFkb3dDYXN0ZXJzIiwic2hhZG93Q2FzdGVycyIsImNvdW50IiwidW5kZWZpbmVkIiwic2V0IiwiTGlnaHRDb21wb3NpdGlvbkRhdGEiLCJmaW5kQ29tcGF0aWJsZUNsdXN0ZXIiLCJlbXB0eVdvcmxkQ2x1c3RlcnMiLCJyYUxheWVyIiwibGF5ZXJJbmRleCIsImxpZ2h0Q2x1c3RlcnMiLCJlcXVhbHMiLCJfY2x1c3RlcmVkTGlnaHRzU2V0IiwiaGFzQ2x1c3RlcmVkTGlnaHRzIiwibWVzaEluc3RhbmNlcyIsImNsdXN0ZXJzIiwicG9wIiwiaXRlbSIsInJlbmRlckFjdGlvbnMiLCJyZW5kZXJBY3Rpb25JbmRleCIsInJlbmRlckFjdGlvbiIsIlJlbmRlckFjdGlvbiIsInJ0IiwiTEFZRVJJRF9ERVBUSCIsInVzZWQiLCJuZWVkc0NsZWFyIiwiY2xlYXJDb2xvciIsImNsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckRlcHRoIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbCIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsInJlc2V0IiwiZmlyc3RDYW1lcmFVc2UiLCJzdGFydEluZGV4IiwiZnJvbUNhbWVyYSIsImEiLCJ0aGlzQ2FtZXJhIiwicmVjdCIsInNjaXNzb3JSZWN0IiwiVHJhY2luZyIsIlRSQUNFSURfUkVOREVSX0FDVElPTiIsIkRlYnVnIiwidHJhY2UiLCJkaXJMaWdodENvdW50IiwiZGlyZWN0aW9uYWxMaWdodHMiLCJlbnRpdHkiLCJwYWRFbmQiLCJ0b1N0cmluZyIsInBhZFN0YXJ0Iiwic2l6ZSIsIl9saWdodHNTZXQiLCJfaXNMYXllckFkZGVkIiwiZXJyb3IiLCJfaXNTdWJsYXllckFkZGVkIiwiZmlyZSIsImluc2VydCIsInNwbGljZSIsIl91cGRhdGVPcGFxdWVPcmRlciIsIl91cGRhdGVUcmFuc3BhcmVudE9yZGVyIiwicmVtb3ZlIiwicHVzaE9wYXF1ZSIsImluc2VydE9wYXF1ZSIsInJlbW92ZU9wYXF1ZSIsInB1c2hUcmFuc3BhcmVudCIsImluc2VydFRyYW5zcGFyZW50IiwicmVtb3ZlVHJhbnNwYXJlbnQiLCJfZ2V0U3VibGF5ZXJJbmRleCIsImdldE9wYXF1ZUluZGV4IiwiZ2V0VHJhbnNwYXJlbnRJbmRleCIsImdldExheWVyQnlJZCIsImdldExheWVyQnlOYW1lIiwiZW5kSW5kZXgiLCJfc29ydExheWVyc0Rlc2NlbmRpbmciLCJsYXllcnNBIiwibGF5ZXJzQiIsIm9yZGVyIiwidG9wTGF5ZXJBIiwidG9wTGF5ZXJCIiwiaGFzT3duUHJvcGVydHkiLCJNYXRoIiwibWF4Iiwic29ydFRyYW5zcGFyZW50TGF5ZXJzIiwic29ydE9wYXF1ZUxheWVycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQXFCQSxNQUFNQSxPQUFPLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7QUFDekIsTUFBTUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFBOztBQVEzQixNQUFNQyxnQkFBZ0IsU0FBU0MsWUFBWSxDQUFDOztBQVN4Q0MsRUFBQUEsV0FBVyxDQUFDQyxJQUFJLEdBQUcsVUFBVSxFQUFFO0FBQzNCLElBQUEsS0FBSyxFQUFFLENBQUE7SUFFUCxJQUFJLENBQUNBLElBQUksR0FBR0EsSUFBSSxDQUFBOztJQU9oQixJQUFJLENBQUNDLFNBQVMsR0FBRyxFQUFFLENBQUE7O0lBUW5CLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEVBQUUsQ0FBQTs7SUFRdEIsSUFBSSxDQUFDQyxlQUFlLEdBQUcsRUFBRSxDQUFBOztBQUV6QixJQUFBLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEVBQUUsQ0FBQTtBQUN0QixJQUFBLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsRUFBRSxDQUFBO0lBRTNCLElBQUksQ0FBQ0MsTUFBTSxHQUFHLEtBQUssQ0FBQTtJQUNuQixJQUFJLENBQUNDLFdBQVcsR0FBRyxLQUFLLENBQUE7SUFDeEIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsS0FBSyxDQUFBO0lBQ3pCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLEtBQUssQ0FBQTs7SUFHMUIsSUFBSSxDQUFDQyxjQUFjLEdBQUcsRUFBRSxDQUFBO0FBQ3hCLElBQUEsSUFBSSxDQUFDQyxpQkFBaUIsR0FBRyxJQUFJaEIsR0FBRyxFQUFFLENBQUE7O0lBR2xDLElBQUksQ0FBQ2lCLE9BQU8sR0FBRyxFQUFFLENBQUE7O0FBR2pCLElBQUEsSUFBSSxDQUFDQyxVQUFVLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7O0lBSTNCLElBQUksQ0FBQ0MscUJBQXFCLEdBQUcsRUFBRSxDQUFBOztJQUcvQixJQUFJLENBQUNDLFlBQVksR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUE7O0lBU2hDLElBQUksQ0FBQ0MsT0FBTyxHQUFHLEVBQUUsQ0FBQTs7SUFRakIsSUFBSSxDQUFDQyxjQUFjLEdBQUcsRUFBRSxDQUFBOztJQUd4QixJQUFJLENBQUNDLGNBQWMsR0FBRyxFQUFFLENBQUE7O0lBR3hCLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsSUFBSSxDQUFBO0FBQ25DLEdBQUE7QUFFQUMsRUFBQUEsT0FBTyxHQUFHO0lBRU4sSUFBSSxJQUFJLENBQUNELG1CQUFtQixFQUFFO0FBQzFCLE1BQUEsSUFBSSxDQUFDQSxtQkFBbUIsQ0FBQ0MsT0FBTyxFQUFFLENBQUE7TUFDbEMsSUFBSSxDQUFDRCxtQkFBbUIsR0FBRyxJQUFJLENBQUE7QUFDbkMsS0FBQTs7QUFHQSxJQUFBLElBQUksQ0FBQ0QsY0FBYyxDQUFDRyxPQUFPLENBQUVDLE9BQU8sSUFBSztNQUNyQ0EsT0FBTyxDQUFDRixPQUFPLEVBQUUsQ0FBQTtBQUNyQixLQUFDLENBQUMsQ0FBQTtJQUNGLElBQUksQ0FBQ0YsY0FBYyxHQUFHLElBQUksQ0FBQTs7SUFHMUIsSUFBSSxDQUFDRCxjQUFjLENBQUNJLE9BQU8sQ0FBQ0UsRUFBRSxJQUFJQSxFQUFFLENBQUNILE9BQU8sRUFBRSxDQUFDLENBQUE7SUFDL0MsSUFBSSxDQUFDSCxjQUFjLEdBQUcsSUFBSSxDQUFBO0FBQzlCLEdBQUE7O0VBR0FPLHFCQUFxQixDQUFDQyxNQUFNLEVBQUU7QUFDMUIsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDTixtQkFBbUIsRUFBRTtBQUczQixNQUFBLElBQUksQ0FBQ0EsbUJBQW1CLEdBQUcsSUFBSU8sYUFBYSxDQUFDRCxNQUFNLENBQUMsQ0FBQTtBQUNwRCxNQUFBLElBQUksQ0FBQ04sbUJBQW1CLENBQUNwQixJQUFJLEdBQUcsY0FBYyxDQUFBOztNQUc5QyxJQUFJLENBQUNvQixtQkFBbUIsQ0FBQ1EsTUFBTSxDQUFDLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDcEQsS0FBQTtJQUVBLE9BQU8sSUFBSSxDQUFDUixtQkFBbUIsQ0FBQTtBQUNuQyxHQUFBOztFQUdBUyxpQkFBaUIsQ0FBQ0MsTUFBTSxFQUFFO0FBQ3RCLElBQUEsTUFBTUMsTUFBTSxHQUFHRCxNQUFNLENBQUNsQixPQUFPLENBQUE7SUFDN0JrQixNQUFNLENBQUNkLFlBQVksQ0FBQ2dCLHFCQUFxQixDQUFDLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUE7SUFDckRILE1BQU0sQ0FBQ2QsWUFBWSxDQUFDa0IsY0FBYyxDQUFDLENBQUNELE1BQU0sR0FBRyxDQUFDLENBQUE7SUFDOUNILE1BQU0sQ0FBQ2QsWUFBWSxDQUFDbUIsY0FBYyxDQUFDLENBQUNGLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFFOUMsSUFBQSxLQUFLLElBQUlHLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0wsTUFBTSxDQUFDRSxNQUFNLEVBQUVHLENBQUMsRUFBRSxFQUFFO0FBQ3BDLE1BQUEsTUFBTUMsS0FBSyxHQUFHTixNQUFNLENBQUNLLENBQUMsQ0FBQyxDQUFBO01BQ3ZCLElBQUlDLEtBQUssQ0FBQ0MsT0FBTyxFQUFFO1FBQ2ZSLE1BQU0sQ0FBQ2QsWUFBWSxDQUFDcUIsS0FBSyxDQUFDRSxLQUFLLENBQUMsQ0FBQ0MsSUFBSSxDQUFDSCxLQUFLLENBQUMsQ0FBQTtBQUNoRCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQUksRUFBQUEsT0FBTyxDQUFDZixNQUFNLEVBQUVnQix3QkFBd0IsR0FBRyxLQUFLLEVBQUU7QUFDOUMsSUFBQSxNQUFNQyxHQUFHLEdBQUcsSUFBSSxDQUFDMUMsU0FBUyxDQUFDZ0MsTUFBTSxDQUFBO0lBQ2pDLElBQUlXLE1BQU0sR0FBRyxDQUFDLENBQUE7O0FBR2QsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDdEMsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDRSxZQUFZLElBQUksQ0FBQyxJQUFJLENBQUNDLGFBQWEsRUFBRTtNQUMzRCxLQUFLLElBQUkyQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdPLEdBQUcsRUFBRVAsQ0FBQyxFQUFFLEVBQUU7QUFDMUIsUUFBQSxNQUFNUyxLQUFLLEdBQUcsSUFBSSxDQUFDNUMsU0FBUyxDQUFDbUMsQ0FBQyxDQUFDLENBQUE7UUFDL0IsSUFBSVMsS0FBSyxDQUFDdkMsTUFBTSxFQUFFO1VBQ2QsSUFBSSxDQUFDQSxNQUFNLEdBQUcsSUFBSSxDQUFBO0FBQ3RCLFNBQUE7UUFDQSxJQUFJdUMsS0FBSyxDQUFDckMsWUFBWSxFQUFFO1VBQ3BCLElBQUksQ0FBQ0EsWUFBWSxHQUFHLElBQUksQ0FBQTtBQUM1QixTQUFBO1FBQ0EsSUFBSXFDLEtBQUssQ0FBQ3BDLGFBQWEsRUFBRTtVQUNyQixJQUFJLENBQUNBLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDN0IsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBOztBQUtBLElBQUEsU0FBU3FDLHFCQUFxQixDQUFDQyxTQUFTLEVBQUVDLE9BQU8sRUFBRUMsUUFBUSxFQUFFO01BQ3pELElBQUlDLFVBQVUsR0FBRyxLQUFLLENBQUE7QUFDdEIsTUFBQSxNQUFNQyxNQUFNLEdBQUdGLFFBQVEsQ0FBQ2hCLE1BQU0sQ0FBQTtNQUM5QixLQUFLLElBQUltQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7QUFDN0IsUUFBQSxNQUFNQyxRQUFRLEdBQUdKLFFBQVEsQ0FBQ0csQ0FBQyxDQUFDLENBQUE7QUFFNUIsUUFBQSxJQUFJLENBQUNKLE9BQU8sQ0FBQ00sR0FBRyxDQUFDRCxRQUFRLENBQUMsRUFBRTtBQUN4QkwsVUFBQUEsT0FBTyxDQUFDTyxHQUFHLENBQUNGLFFBQVEsQ0FBQyxDQUFBO0FBQ3JCTixVQUFBQSxTQUFTLENBQUNQLElBQUksQ0FBQ2EsUUFBUSxDQUFDLENBQUE7QUFFeEIsVUFBQSxNQUFNRyxRQUFRLEdBQUdILFFBQVEsQ0FBQ0csUUFBUSxDQUFBO0FBQ2xDLFVBQUEsSUFBSUEsUUFBUSxJQUFJQSxRQUFRLENBQUNqRCxXQUFXLEVBQUU7QUFDbEMyQyxZQUFBQSxVQUFVLEdBQUcsSUFBSSxDQUFBO1lBQ2pCTSxRQUFRLENBQUNqRCxXQUFXLEdBQUcsS0FBSyxDQUFBO0FBQ2hDLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNBLE1BQUEsT0FBTzJDLFVBQVUsQ0FBQTtBQUNyQixLQUFBOztJQUlBLElBQUksSUFBSSxDQUFDNUMsTUFBTSxFQUFFO0FBQ2JzQyxNQUFBQSxNQUFNLElBQUlhLHFCQUFxQixDQUFBO0FBQy9CLE1BQUEsSUFBSSxDQUFDL0MsY0FBYyxDQUFDdUIsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUM5QixNQUFBLElBQUksQ0FBQ3RCLGlCQUFpQixDQUFDK0MsS0FBSyxFQUFFLENBQUE7TUFFOUIsS0FBSyxJQUFJdEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHTyxHQUFHLEVBQUVQLENBQUMsRUFBRSxFQUFFO0FBQzFCLFFBQUEsTUFBTVMsS0FBSyxHQUFHLElBQUksQ0FBQzVDLFNBQVMsQ0FBQ21DLENBQUMsQ0FBQyxDQUFBO0FBQy9CLFFBQUEsSUFBSSxDQUFDUyxLQUFLLENBQUNjLFdBQVcsRUFBRTtVQUdwQixJQUFJLENBQUNwRCxXQUFXLEdBQUd1QyxxQkFBcUIsQ0FBQyxJQUFJLENBQUNwQyxjQUFjLEVBQUUsSUFBSSxDQUFDQyxpQkFBaUIsRUFBRWtDLEtBQUssQ0FBQ2UsbUJBQW1CLENBQUMsSUFBSSxJQUFJLENBQUNyRCxXQUFXLENBQUE7VUFDcEksSUFBSSxDQUFDQSxXQUFXLEdBQUd1QyxxQkFBcUIsQ0FBQyxJQUFJLENBQUNwQyxjQUFjLEVBQUUsSUFBSSxDQUFDQyxpQkFBaUIsRUFBRWtDLEtBQUssQ0FBQ2dCLHdCQUF3QixDQUFDLElBQUksSUFBSSxDQUFDdEQsV0FBVyxDQUFBO0FBQzdJLFNBQUE7UUFFQXNDLEtBQUssQ0FBQ3ZDLE1BQU0sR0FBRyxLQUFLLENBQUE7QUFDeEIsT0FBQTtNQUVBLElBQUksQ0FBQ0EsTUFBTSxHQUFHLEtBQUssQ0FBQTtBQUN2QixLQUFBOztBQUdBLElBQUEsU0FBU3dELGVBQWUsQ0FBQ0MsSUFBSSxFQUFFQyxHQUFHLEVBQUVDLGVBQWUsRUFBRTtNQUNqRCxLQUFLLElBQUliLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR1ksR0FBRyxDQUFDL0IsTUFBTSxHQUFHO0FBQUEsUUFBQSxJQUFBLGVBQUEsQ0FBQTtBQUU3QixRQUFBLElBQUksQ0FBQStCLENBQUFBLGVBQUFBLEdBQUFBLEdBQUcsQ0FBQ1osQ0FBQyxDQUFDLENBQUNJLFFBQVEsS0FBQSxJQUFBLEdBQUEsS0FBQSxDQUFBLEdBQWYsZUFBaUJVLENBQUFBLFdBQVcsTUFBS0QsZUFBZSxFQUFFO0FBR2xERixVQUFBQSxJQUFJLENBQUN2QixJQUFJLENBQUN3QixHQUFHLENBQUNaLENBQUMsQ0FBQyxDQUFDLENBQUE7O1VBR2pCWSxHQUFHLENBQUNaLENBQUMsQ0FBQyxHQUFHWSxHQUFHLENBQUNBLEdBQUcsQ0FBQy9CLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQTtVQUM1QitCLEdBQUcsQ0FBQy9CLE1BQU0sRUFBRSxDQUFBO0FBRWhCLFNBQUMsTUFBTTtBQUdIbUIsVUFBQUEsQ0FBQyxFQUFFLENBQUE7QUFDUCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0lBR0EsSUFBSSxJQUFJLENBQUM3QyxXQUFXLEVBQUU7QUFDbEJxQyxNQUFBQSxNQUFNLElBQUl1QixpQkFBaUIsQ0FBQTtNQUUzQixLQUFLLElBQUkvQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdPLEdBQUcsRUFBRVAsQ0FBQyxFQUFFLEVBQUU7QUFDMUIsUUFBQSxNQUFNUyxLQUFLLEdBQUcsSUFBSSxDQUFDNUMsU0FBUyxDQUFDbUMsQ0FBQyxDQUFDLENBQUE7QUFDL0IsUUFBQSxJQUFJLENBQUNTLEtBQUssQ0FBQ2MsV0FBVyxFQUFFO1VBR3BCRyxlQUFlLENBQUNqQixLQUFLLENBQUNlLG1CQUFtQixFQUFFZixLQUFLLENBQUNnQix3QkFBd0IsRUFBRSxLQUFLLENBQUMsQ0FBQTs7VUFHakZDLGVBQWUsQ0FBQ2pCLEtBQUssQ0FBQ2dCLHdCQUF3QixFQUFFaEIsS0FBSyxDQUFDZSxtQkFBbUIsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNwRixTQUFBO0FBQ0osT0FBQTtNQUNBLElBQUksQ0FBQ3JELFdBQVcsR0FBRyxLQUFLLENBQUE7QUFDNUIsS0FBQTtJQUVBLElBQUksSUFBSSxDQUFDQyxZQUFZLEVBQUU7QUFDbkJvQyxNQUFBQSxNQUFNLElBQUl3QixrQkFBa0IsQ0FBQTtNQUM1QixJQUFJLENBQUM1RCxZQUFZLEdBQUcsS0FBSyxDQUFBO01BRXpCLElBQUksQ0FBQzZELFlBQVksRUFBRSxDQUFBO0FBQ3ZCLEtBQUE7O0FBR0EsSUFBQSxJQUFJekIsTUFBTSxFQUFFO01BQ1IsSUFBSSxDQUFDMEIsbUJBQW1CLEVBQUUsQ0FBQTtBQUM5QixLQUFBO0FBRUEsSUFBQSxJQUFJLElBQUksQ0FBQzdELGFBQWEsSUFBS21DLE1BQU0sR0FBR3dCLGtCQUFtQixFQUFFO01BRXJELElBQUksQ0FBQzNELGFBQWEsR0FBRyxLQUFLLENBQUE7QUFDMUJtQyxNQUFBQSxNQUFNLElBQUkyQixtQkFBbUIsQ0FBQTs7QUFHN0IsTUFBQSxJQUFJLENBQUN0RCxPQUFPLENBQUNnQixNQUFNLEdBQUcsQ0FBQyxDQUFBO01BQ3ZCLEtBQUssSUFBSUcsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHTyxHQUFHLEVBQUVQLENBQUMsRUFBRSxFQUFFO0FBQzFCLFFBQUEsTUFBTVMsS0FBSyxHQUFHLElBQUksQ0FBQzVDLFNBQVMsQ0FBQ21DLENBQUMsQ0FBQyxDQUFBO1FBQy9CUyxLQUFLLENBQUNwQyxhQUFhLEdBQUcsS0FBSyxDQUFBOztBQUczQixRQUFBLEtBQUssSUFBSStELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzNCLEtBQUssQ0FBQzVCLE9BQU8sQ0FBQ2dCLE1BQU0sRUFBRXVDLENBQUMsRUFBRSxFQUFFO0FBQzNDLFVBQUEsTUFBTUMsTUFBTSxHQUFHNUIsS0FBSyxDQUFDNUIsT0FBTyxDQUFDdUQsQ0FBQyxDQUFDLENBQUE7VUFDL0IsTUFBTUUsS0FBSyxHQUFHLElBQUksQ0FBQ3pELE9BQU8sQ0FBQzBELE9BQU8sQ0FBQ0YsTUFBTSxDQUFDLENBQUE7VUFDMUMsSUFBSUMsS0FBSyxHQUFHLENBQUMsRUFBRTtBQUNYLFlBQUEsSUFBSSxDQUFDekQsT0FBTyxDQUFDdUIsSUFBSSxDQUFDaUMsTUFBTSxDQUFDLENBQUE7QUFDN0IsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFBOztBQUdBLE1BQUEsSUFBSSxJQUFJLENBQUN4RCxPQUFPLENBQUNnQixNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQ3pCMkMsUUFBQUEsWUFBWSxDQUFDLElBQUksQ0FBQzNELE9BQU8sQ0FBQyxDQUFBO0FBQzlCLE9BQUE7O01BR0EsTUFBTTRELFlBQVksR0FBRyxFQUFFLENBQUE7O01BR3ZCLElBQUlDLGlCQUFpQixHQUFHLENBQUMsQ0FBQTtBQUN6QixNQUFBLEtBQUssSUFBSTFDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNuQixPQUFPLENBQUNnQixNQUFNLEVBQUVHLENBQUMsRUFBRSxFQUFFO0FBQzFDLFFBQUEsTUFBTXFDLE1BQU0sR0FBRyxJQUFJLENBQUN4RCxPQUFPLENBQUNtQixDQUFDLENBQUMsQ0FBQTtRQUM5QnlDLFlBQVksQ0FBQzVDLE1BQU0sR0FBRyxDQUFDLENBQUE7O1FBR3ZCLElBQUk4Qyx1QkFBdUIsR0FBRyxJQUFJLENBQUE7UUFDbEMsTUFBTUMsNEJBQTRCLEdBQUdGLGlCQUFpQixDQUFBOztRQUd0RCxJQUFJRyxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7O1FBRzNCLElBQUlDLGlCQUFpQixHQUFHLEtBQUssQ0FBQTs7UUFJN0IsS0FBSyxJQUFJVixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUc3QixHQUFHLEVBQUU2QixDQUFDLEVBQUUsRUFBRTtBQUUxQixVQUFBLE1BQU0zQixLQUFLLEdBQUcsSUFBSSxDQUFDNUMsU0FBUyxDQUFDdUUsQ0FBQyxDQUFDLENBQUE7QUFDL0IsVUFBQSxJQUFJM0IsS0FBSyxFQUFFO0FBR1AsWUFBQSxJQUFJQSxLQUFLLENBQUM1QixPQUFPLENBQUNnQixNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBRzFCLGNBQUEsSUFBSXdDLE1BQU0sQ0FBQ1UsTUFBTSxDQUFDUixPQUFPLENBQUM5QixLQUFLLENBQUN1QyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFFdENQLGdCQUFBQSxZQUFZLENBQUNyQyxJQUFJLENBQUNLLEtBQUssQ0FBQyxDQUFBOztnQkFHeEIsSUFBSSxDQUFDcUMsaUJBQWlCLElBQUlyQyxLQUFLLENBQUN1QyxFQUFFLEtBQUtYLE1BQU0sQ0FBQ1ksdUJBQXVCLEVBQUU7QUFDbkVILGtCQUFBQSxpQkFBaUIsR0FBRyxJQUFJLENBQUE7O0FBR3hCLGtCQUFBLElBQUlELGdCQUFnQixFQUFFO29CQUdsQkEsZ0JBQWdCLENBQUNLLGtCQUFrQixHQUFHLElBQUksQ0FBQTtBQUM5QyxtQkFBQTtBQUNKLGlCQUFBOztnQkFHQSxNQUFNQyxXQUFXLEdBQUcxQyxLQUFLLENBQUM1QixPQUFPLENBQUMwRCxPQUFPLENBQUNGLE1BQU0sQ0FBQyxDQUFBO2dCQUNqRCxJQUFJYyxXQUFXLElBQUksQ0FBQyxFQUFFO2tCQUdsQk4sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDTyxlQUFlLENBQUMsSUFBSSxDQUFDdEUsY0FBYyxFQUFFNEQsaUJBQWlCLEVBQUVqQyxLQUFLLEVBQUUyQixDQUFDLEVBQUVlLFdBQVcsRUFDN0RSLHVCQUF1QixFQUFFRyxpQkFBaUIsQ0FBQyxDQUFBO0FBQ25GSixrQkFBQUEsaUJBQWlCLEVBQUUsQ0FBQTtBQUNuQkMsa0JBQUFBLHVCQUF1QixHQUFHLEtBQUssQ0FBQTtBQUNuQyxpQkFBQTtBQUNKLGVBQUE7QUFDSixhQUFBO0FBQ0osV0FBQTtBQUNKLFNBQUE7O1FBR0EsSUFBSUMsNEJBQTRCLEdBQUdGLGlCQUFpQixFQUFFO1VBR2xELElBQUksQ0FBQzVELGNBQWMsQ0FBQzhELDRCQUE0QixDQUFDLENBQUNTLHdCQUF3QixDQUFDWixZQUFZLEVBQUUsSUFBSSxDQUFDN0QsWUFBWSxDQUFDZ0IscUJBQXFCLENBQUMsRUFBRSxJQUFJLENBQUNwQixPQUFPLENBQUMsQ0FBQTs7VUFHaEpxRSxnQkFBZ0IsQ0FBQ1MsYUFBYSxHQUFHLElBQUksQ0FBQTtBQUN6QyxTQUFBOztBQUdBLFFBQUEsSUFBSSxDQUFDUixpQkFBaUIsSUFBSUQsZ0JBQWdCLEVBQUU7VUFDeENBLGdCQUFnQixDQUFDSyxrQkFBa0IsR0FBRyxJQUFJLENBQUE7QUFDOUMsU0FBQTs7QUFHQSxRQUFBLElBQUliLE1BQU0sQ0FBQ2tCLFlBQVksSUFBSWxCLE1BQU0sQ0FBQ21CLGtCQUFrQixFQUFFO1VBRWxELElBQUksQ0FBQ0MscUJBQXFCLENBQUNiLDRCQUE0QixHQUFHLENBQUMsRUFBRVAsTUFBTSxDQUFDLENBQUE7QUFDeEUsU0FBQTtBQUNKLE9BQUE7O0FBR0EsTUFBQSxLQUFLLElBQUlyQyxDQUFDLEdBQUcwQyxpQkFBaUIsRUFBRTFDLENBQUMsR0FBRyxJQUFJLENBQUNsQixjQUFjLENBQUNlLE1BQU0sRUFBRUcsQ0FBQyxFQUFFLEVBQUU7QUFDakUsUUFBQSxJQUFJLENBQUNsQixjQUFjLENBQUNrQixDQUFDLENBQUMsQ0FBQ2YsT0FBTyxFQUFFLENBQUE7QUFDcEMsT0FBQTtBQUNBLE1BQUEsSUFBSSxDQUFDSCxjQUFjLENBQUNlLE1BQU0sR0FBRzZDLGlCQUFpQixDQUFBO0FBQ2xELEtBQUE7O0lBR0EsSUFBSWxDLE1BQU0sSUFBSTJCLG1CQUFtQixHQUFHSCxrQkFBa0IsR0FBR1gscUJBQXFCLENBQUMsRUFBRTtBQUc3RSxNQUFBLElBQUlmLHdCQUF3QixFQUFFO0FBQzFCLFFBQUEsSUFBSSxDQUFDb0QscUJBQXFCLENBQUNwRSxNQUFNLENBQUMsQ0FBQTtBQUN0QyxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsSUFBSWtCLE1BQU0sSUFBSXdCLGtCQUFrQixHQUFHQSxrQkFBa0IsQ0FBQyxFQUFFO01BQ3BELElBQUksQ0FBQzJCLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsS0FBQTtBQUVBLElBQUEsT0FBT25ELE1BQU0sQ0FBQTtBQUNqQixHQUFBO0FBRUEwQixFQUFBQSxtQkFBbUIsR0FBRztBQUdsQixJQUFBLE1BQU0wQixVQUFVLEdBQUcsSUFBSSxDQUFDcEYsT0FBTyxDQUFDcUIsTUFBTSxDQUFBO0lBQ3RDLEtBQUssSUFBSUcsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHNEQsVUFBVSxFQUFFNUQsQ0FBQyxFQUFFLEVBQUU7QUFDakMsTUFBQSxJQUFJLENBQUNyQixxQkFBcUIsQ0FBQ3FCLENBQUMsQ0FBQyxDQUFDNkQsa0JBQWtCLEVBQUUsQ0FBQTtBQUN0RCxLQUFBOztBQUdBLElBQUEsTUFBTXRELEdBQUcsR0FBRyxJQUFJLENBQUMxQyxTQUFTLENBQUNnQyxNQUFNLENBQUE7SUFDakMsS0FBSyxJQUFJRyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdPLEdBQUcsRUFBRVAsQ0FBQyxFQUFFLEVBQUU7QUFDMUIsTUFBQSxNQUFNUyxLQUFLLEdBQUcsSUFBSSxDQUFDNUMsU0FBUyxDQUFDbUMsQ0FBQyxDQUFDLENBQUE7O0FBRy9CLE1BQUEsSUFBSSxDQUFDMUMsT0FBTyxDQUFDNEQsR0FBRyxDQUFDVCxLQUFLLENBQUMsRUFBRTtBQUNyQm5ELFFBQUFBLE9BQU8sQ0FBQzZELEdBQUcsQ0FBQ1YsS0FBSyxDQUFDLENBQUE7O0FBR2xCLFFBQUEsTUFBTWQsTUFBTSxHQUFHYyxLQUFLLENBQUNqQyxPQUFPLENBQUE7QUFDNUIsUUFBQSxLQUFLLElBQUk0RCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd6QyxNQUFNLENBQUNFLE1BQU0sRUFBRXVDLENBQUMsRUFBRSxFQUFFO0FBR3BDLFVBQUEsSUFBSXpDLE1BQU0sQ0FBQ3lDLENBQUMsQ0FBQyxDQUFDMEIsV0FBVyxFQUFFO0FBR3ZCLFlBQUEsTUFBTUMsVUFBVSxHQUFHLElBQUksQ0FBQ3RGLFVBQVUsQ0FBQ3VGLEdBQUcsQ0FBQ3JFLE1BQU0sQ0FBQ3lDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakQsWUFBQSxNQUFNNkIsYUFBYSxHQUFHLElBQUksQ0FBQ3RGLHFCQUFxQixDQUFDb0YsVUFBVSxDQUFDLENBQUE7O0FBRzVERSxZQUFBQSxhQUFhLENBQUNDLGdCQUFnQixDQUFDekQsS0FBSyxDQUFDMEQsYUFBYSxDQUFDLENBQUE7QUFDdkQsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtJQUVBN0csT0FBTyxDQUFDZ0UsS0FBSyxFQUFFLENBQUE7QUFDbkIsR0FBQTtBQUVBVyxFQUFBQSxZQUFZLEdBQUc7QUFHWCxJQUFBLElBQUksQ0FBQ3pELE9BQU8sQ0FBQ3FCLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDdkIsSUFBQSxJQUFJLENBQUNwQixVQUFVLENBQUM2QyxLQUFLLEVBQUUsQ0FBQTtBQUV2QixJQUFBLE1BQU04QyxLQUFLLEdBQUcsSUFBSSxDQUFDdkcsU0FBUyxDQUFDZ0MsTUFBTSxDQUFBO0lBQ25DLEtBQUssSUFBSUcsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHb0UsS0FBSyxFQUFFcEUsQ0FBQyxFQUFFLEVBQUU7QUFDNUIsTUFBQSxNQUFNUyxLQUFLLEdBQUcsSUFBSSxDQUFDNUMsU0FBUyxDQUFDbUMsQ0FBQyxDQUFDLENBQUE7O0FBRy9CLE1BQUEsSUFBSSxDQUFDMUMsT0FBTyxDQUFDNEQsR0FBRyxDQUFDVCxLQUFLLENBQUMsRUFBRTtBQUNyQm5ELFFBQUFBLE9BQU8sQ0FBQzZELEdBQUcsQ0FBQ1YsS0FBSyxDQUFDLENBQUE7QUFFbEIsUUFBQSxNQUFNZCxNQUFNLEdBQUdjLEtBQUssQ0FBQ2pDLE9BQU8sQ0FBQTtBQUM1QixRQUFBLEtBQUssSUFBSTRELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3pDLE1BQU0sQ0FBQ0UsTUFBTSxFQUFFdUMsQ0FBQyxFQUFFLEVBQUU7QUFDcEMsVUFBQSxNQUFNbkMsS0FBSyxHQUFHTixNQUFNLENBQUN5QyxDQUFDLENBQUMsQ0FBQTs7VUFHdkIsSUFBSTJCLFVBQVUsR0FBRyxJQUFJLENBQUN0RixVQUFVLENBQUN1RixHQUFHLENBQUMvRCxLQUFLLENBQUMsQ0FBQTtVQUMzQyxJQUFJOEQsVUFBVSxLQUFLTSxTQUFTLEVBQUU7QUFDMUJOLFlBQUFBLFVBQVUsR0FBRyxJQUFJLENBQUN2RixPQUFPLENBQUNxQixNQUFNLENBQUE7WUFDaEMsSUFBSSxDQUFDcEIsVUFBVSxDQUFDNkYsR0FBRyxDQUFDckUsS0FBSyxFQUFFOEQsVUFBVSxDQUFDLENBQUE7QUFDdEMsWUFBQSxJQUFJLENBQUN2RixPQUFPLENBQUM0QixJQUFJLENBQUNILEtBQUssQ0FBQyxDQUFBOztBQUd4QixZQUFBLElBQUlnRSxhQUFhLEdBQUcsSUFBSSxDQUFDdEYscUJBQXFCLENBQUNvRixVQUFVLENBQUMsQ0FBQTtZQUMxRCxJQUFJLENBQUNFLGFBQWEsRUFBRTtjQUNoQkEsYUFBYSxHQUFHLElBQUlNLG9CQUFvQixFQUFFLENBQUE7QUFDMUMsY0FBQSxJQUFJLENBQUM1RixxQkFBcUIsQ0FBQ29GLFVBQVUsQ0FBQyxHQUFHRSxhQUFhLENBQUE7QUFDMUQsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTs7QUFHQSxNQUFBLElBQUksQ0FBQ3hFLGlCQUFpQixDQUFDZ0IsS0FBSyxDQUFDLENBQUE7TUFDN0JBLEtBQUssQ0FBQ3JDLFlBQVksR0FBRyxLQUFLLENBQUE7QUFDOUIsS0FBQTtJQUVBZCxPQUFPLENBQUNnRSxLQUFLLEVBQUUsQ0FBQTs7QUFHZixJQUFBLElBQUksQ0FBQzdCLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFBOztBQUc1QixJQUFBLE1BQU1tRSxVQUFVLEdBQUcsSUFBSSxDQUFDcEYsT0FBTyxDQUFDcUIsTUFBTSxDQUFBO0FBQ3RDLElBQUEsSUFBSSxDQUFDbEIscUJBQXFCLENBQUNrQixNQUFNLEdBQUcrRCxVQUFVLENBQUE7QUFDbEQsR0FBQTs7QUFHQVksRUFBQUEscUJBQXFCLENBQUMvRCxLQUFLLEVBQUVpQyxpQkFBaUIsRUFBRStCLGtCQUFrQixFQUFFO0lBR2hFLEtBQUssSUFBSXpFLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzBDLGlCQUFpQixFQUFFMUMsQ0FBQyxFQUFFLEVBQUU7QUFDeEMsTUFBQSxNQUFNWixFQUFFLEdBQUcsSUFBSSxDQUFDTixjQUFjLENBQUNrQixDQUFDLENBQUMsQ0FBQTtNQUNqQyxNQUFNMEUsT0FBTyxHQUFHLElBQUksQ0FBQzdHLFNBQVMsQ0FBQ3VCLEVBQUUsQ0FBQ3VGLFVBQVUsQ0FBQyxDQUFBOztBQUc3QyxNQUFBLElBQUl2RixFQUFFLENBQUN3RixhQUFhLEtBQUtILGtCQUFrQixFQUFFO1FBR3pDLElBQUloRSxLQUFLLEtBQUtpRSxPQUFPLEVBQUU7VUFDbkIsT0FBT3RGLEVBQUUsQ0FBQ3dGLGFBQWEsQ0FBQTtBQUMzQixTQUFBO1FBRUEsSUFBSXhGLEVBQUUsQ0FBQ3dGLGFBQWEsRUFBRTtBQUVsQixVQUFBLElBQUlOLEdBQUcsQ0FBQ08sTUFBTSxDQUFDcEUsS0FBSyxDQUFDcUUsbUJBQW1CLEVBQUVKLE9BQU8sQ0FBQ0ksbUJBQW1CLENBQUMsRUFBRTtZQUNwRSxPQUFPMUYsRUFBRSxDQUFDd0YsYUFBYSxDQUFBO0FBQzNCLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBR0EsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0VBR0FsQixxQkFBcUIsQ0FBQ3BFLE1BQU0sRUFBRTtBQUcxQjlCLElBQUFBLGdCQUFnQixDQUFDNEMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDckIsY0FBYyxDQUFDLENBQUE7O0FBRzdDLElBQUEsTUFBTTBGLGtCQUFrQixHQUFHLElBQUksQ0FBQ3BGLHFCQUFxQixDQUFDQyxNQUFNLENBQUMsQ0FBQTs7QUFHN0QsSUFBQSxJQUFJLENBQUNQLGNBQWMsQ0FBQ2MsTUFBTSxHQUFHLENBQUMsQ0FBQTs7QUFHOUIsSUFBQSxNQUFNdUUsS0FBSyxHQUFHLElBQUksQ0FBQ3RGLGNBQWMsQ0FBQ2UsTUFBTSxDQUFBO0lBQ3hDLEtBQUssSUFBSUcsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHb0UsS0FBSyxFQUFFcEUsQ0FBQyxFQUFFLEVBQUU7QUFDNUIsTUFBQSxNQUFNWixFQUFFLEdBQUcsSUFBSSxDQUFDTixjQUFjLENBQUNrQixDQUFDLENBQUMsQ0FBQTtNQUNqQyxNQUFNUyxLQUFLLEdBQUcsSUFBSSxDQUFDNUMsU0FBUyxDQUFDdUIsRUFBRSxDQUFDdUYsVUFBVSxDQUFDLENBQUE7O01BRzNDLElBQUlsRSxLQUFLLENBQUNzRSxrQkFBa0IsRUFBRTtRQUcxQixNQUFNakQsV0FBVyxHQUFHLElBQUksQ0FBQ2hFLFlBQVksQ0FBQ3NCLEVBQUUsQ0FBQ3VGLFVBQVUsQ0FBQyxDQUFBO1FBQ3BELE1BQU1LLGFBQWEsR0FBR2xELFdBQVcsR0FBR3JCLEtBQUssQ0FBQ2dCLHdCQUF3QixHQUFHaEIsS0FBSyxDQUFDZSxtQkFBbUIsQ0FBQTtRQUM5RixJQUFJd0QsYUFBYSxDQUFDbkYsTUFBTSxFQUFFO1VBR3RCLElBQUlvRixRQUFRLEdBQUcsSUFBSSxDQUFDVCxxQkFBcUIsQ0FBQy9ELEtBQUssRUFBRVQsQ0FBQyxFQUFFeUUsa0JBQWtCLENBQUMsQ0FBQTtVQUN2RSxJQUFJLENBQUNRLFFBQVEsRUFBRTtZQUdYLElBQUl6SCxnQkFBZ0IsQ0FBQ3FDLE1BQU0sRUFBRTtBQUN6Qm9GLGNBQUFBLFFBQVEsR0FBR3pILGdCQUFnQixDQUFDMEgsR0FBRyxFQUFFLENBQUE7QUFDckMsYUFBQTs7WUFHQSxJQUFJLENBQUNELFFBQVEsRUFBRTtBQUNYQSxjQUFBQSxRQUFRLEdBQUcsSUFBSTFGLGFBQWEsQ0FBQ0QsTUFBTSxDQUFDLENBQUE7QUFDeEMsYUFBQTtZQUVBMkYsUUFBUSxDQUFDckgsSUFBSSxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUNtQixjQUFjLENBQUNjLE1BQU0sQ0FBQTtBQUN2RCxZQUFBLElBQUksQ0FBQ2QsY0FBYyxDQUFDcUIsSUFBSSxDQUFDNkUsUUFBUSxDQUFDLENBQUE7QUFDdEMsV0FBQTtVQUVBN0YsRUFBRSxDQUFDd0YsYUFBYSxHQUFHSyxRQUFRLENBQUE7QUFDL0IsU0FBQTtBQUNKLE9BQUE7O0FBR0EsTUFBQSxJQUFJLENBQUM3RixFQUFFLENBQUN3RixhQUFhLEVBQUU7UUFDbkJ4RixFQUFFLENBQUN3RixhQUFhLEdBQUdILGtCQUFrQixDQUFBO0FBQ3pDLE9BQUE7QUFDSixLQUFBOztBQUdBakgsSUFBQUEsZ0JBQWdCLENBQUMwQixPQUFPLENBQUVpRyxJQUFJLElBQUs7TUFDL0JBLElBQUksQ0FBQ2xHLE9BQU8sRUFBRSxDQUFBO0FBQ2xCLEtBQUMsQ0FBQyxDQUFBO0lBQ0Z6QixnQkFBZ0IsQ0FBQ3FDLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDL0IsR0FBQTs7QUFHQXVELEVBQUFBLGVBQWUsQ0FBQ2dDLGFBQWEsRUFBRUMsaUJBQWlCLEVBQUU1RSxLQUFLLEVBQUVrRSxVQUFVLEVBQUV4QixXQUFXLEVBQUVSLHVCQUF1QixFQUFFRyxpQkFBaUIsRUFBRTtBQUkxSCxJQUFBLElBQUl3QyxZQUFZLEdBQUdGLGFBQWEsQ0FBQ0MsaUJBQWlCLENBQUMsQ0FBQTtJQUNuRCxJQUFJLENBQUNDLFlBQVksRUFBRTtNQUNmQSxZQUFZLEdBQUdGLGFBQWEsQ0FBQ0MsaUJBQWlCLENBQUMsR0FBRyxJQUFJRSxZQUFZLEVBQUUsQ0FBQTtBQUN4RSxLQUFBOztBQUdBLElBQUEsSUFBSUMsRUFBRSxHQUFHL0UsS0FBSyxDQUFDOEMsWUFBWSxDQUFBO0FBRTNCLElBQUEsTUFBTWxCLE1BQU0sR0FBRzVCLEtBQUssQ0FBQzVCLE9BQU8sQ0FBQ3NFLFdBQVcsQ0FBQyxDQUFBO0FBQ3pDLElBQUEsSUFBSWQsTUFBTSxJQUFJQSxNQUFNLENBQUNrQixZQUFZLEVBQUU7QUFDL0IsTUFBQSxJQUFJOUMsS0FBSyxDQUFDdUMsRUFBRSxLQUFLeUMsYUFBYSxFQUFFO1FBQzVCRCxFQUFFLEdBQUduRCxNQUFNLENBQUNrQixZQUFZLENBQUE7QUFDNUIsT0FBQTtBQUNKLEtBQUE7O0lBR0EsSUFBSW1DLElBQUksR0FBRyxLQUFLLENBQUE7QUFDaEIsSUFBQSxLQUFLLElBQUkxRixDQUFDLEdBQUdxRixpQkFBaUIsR0FBRyxDQUFDLEVBQUVyRixDQUFDLElBQUksQ0FBQyxFQUFFQSxDQUFDLEVBQUUsRUFBRTtBQUM3QyxNQUFBLElBQUlvRixhQUFhLENBQUNwRixDQUFDLENBQUMsQ0FBQ3FDLE1BQU0sS0FBS0EsTUFBTSxJQUFJK0MsYUFBYSxDQUFDcEYsQ0FBQyxDQUFDLENBQUN1RCxZQUFZLEtBQUtpQyxFQUFFLEVBQUU7QUFDNUVFLFFBQUFBLElBQUksR0FBRyxJQUFJLENBQUE7QUFDWCxRQUFBLE1BQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7QUFJQSxJQUFBLE1BQU1DLFVBQVUsR0FBR2hELHVCQUF1QixJQUFJLENBQUMrQyxJQUFJLENBQUE7SUFDbkQsSUFBSUUsVUFBVSxHQUFHRCxVQUFVLEdBQUd0RCxNQUFNLENBQUN3RCxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7SUFDN0QsSUFBSUMsVUFBVSxHQUFHSCxVQUFVLEdBQUd0RCxNQUFNLENBQUMwRCxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7SUFDN0QsSUFBSUMsWUFBWSxHQUFHTCxVQUFVLEdBQUd0RCxNQUFNLENBQUM0RCxrQkFBa0IsR0FBRyxLQUFLLENBQUE7O0FBR2pFTCxJQUFBQSxVQUFVLEtBQVZBLFVBQVUsR0FBS25GLEtBQUssQ0FBQ29GLGdCQUFnQixDQUFBLENBQUE7QUFDckNDLElBQUFBLFVBQVUsS0FBVkEsVUFBVSxHQUFLckYsS0FBSyxDQUFDc0YsZ0JBQWdCLENBQUEsQ0FBQTtBQUNyQ0MsSUFBQUEsWUFBWSxLQUFaQSxZQUFZLEdBQUt2RixLQUFLLENBQUN3RixrQkFBa0IsQ0FBQSxDQUFBOztBQUl6QyxJQUFBLElBQUluRCxpQkFBaUIsSUFBSVQsTUFBTSxDQUFDbUIsa0JBQWtCLEVBQUU7QUFDaERnQyxNQUFBQSxFQUFFLEdBQUcsSUFBSSxDQUFBO0FBQ2IsS0FBQTs7SUFHQUYsWUFBWSxDQUFDWSxLQUFLLEVBQUUsQ0FBQTtJQUNwQlosWUFBWSxDQUFDcEMsa0JBQWtCLEdBQUcsS0FBSyxDQUFBO0lBQ3ZDb0MsWUFBWSxDQUFDWCxVQUFVLEdBQUdBLFVBQVUsQ0FBQTtJQUNwQ1csWUFBWSxDQUFDbkMsV0FBVyxHQUFHQSxXQUFXLENBQUE7SUFDdENtQyxZQUFZLENBQUNqRCxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtJQUM1QmlELFlBQVksQ0FBQy9CLFlBQVksR0FBR2lDLEVBQUUsQ0FBQTtJQUM5QkYsWUFBWSxDQUFDTSxVQUFVLEdBQUdBLFVBQVUsQ0FBQTtJQUNwQ04sWUFBWSxDQUFDUSxVQUFVLEdBQUdBLFVBQVUsQ0FBQTtJQUNwQ1IsWUFBWSxDQUFDVSxZQUFZLEdBQUdBLFlBQVksQ0FBQTtJQUN4Q1YsWUFBWSxDQUFDYSxjQUFjLEdBQUd4RCx1QkFBdUIsQ0FBQTtJQUNyRDJDLFlBQVksQ0FBQ2hDLGFBQWEsR0FBRyxLQUFLLENBQUE7QUFFbEMsSUFBQSxPQUFPZ0MsWUFBWSxDQUFBO0FBQ3ZCLEdBQUE7O0FBSUE3QixFQUFBQSxxQkFBcUIsQ0FBQzJDLFVBQVUsRUFBRUMsVUFBVSxFQUFFO0lBRTFDLEtBQUssSUFBSUMsQ0FBQyxHQUFHRixVQUFVLEVBQUVFLENBQUMsSUFBSSxDQUFDLEVBQUVBLENBQUMsRUFBRSxFQUFFO0FBRWxDLE1BQUEsTUFBTWxILEVBQUUsR0FBRyxJQUFJLENBQUNOLGNBQWMsQ0FBQ3dILENBQUMsQ0FBQyxDQUFBO01BQ2pDLE1BQU03RixLQUFLLEdBQUcsSUFBSSxDQUFDNUMsU0FBUyxDQUFDdUIsRUFBRSxDQUFDdUYsVUFBVSxDQUFDLENBQUE7O01BSTNDLElBQUl2RixFQUFFLENBQUNtRSxZQUFZLElBQUk5QyxLQUFLLENBQUN1QyxFQUFFLEtBQUt5QyxhQUFhLEVBQUU7QUFDL0MsUUFBQSxNQUFBO0FBQ0osT0FBQTs7QUFHQSxNQUFBLElBQUloRixLQUFLLENBQUN1QyxFQUFFLEtBQUt5QyxhQUFhLEVBQUU7QUFDNUIsUUFBQSxTQUFBO0FBQ0osT0FBQTs7TUFHQSxNQUFNYyxVQUFVLEdBQUduSCxFQUFFLElBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUFGQSxFQUFFLENBQUVpRCxNQUFNLENBQUNBLE1BQU0sQ0FBQTtBQUNwQyxNQUFBLElBQUlrRSxVQUFVLEVBQUU7UUFDWixJQUFJLENBQUNGLFVBQVUsQ0FBQ2hFLE1BQU0sQ0FBQ21FLElBQUksQ0FBQzNCLE1BQU0sQ0FBQzBCLFVBQVUsQ0FBQ0MsSUFBSSxDQUFDLElBQUksQ0FBQ0gsVUFBVSxDQUFDaEUsTUFBTSxDQUFDb0UsV0FBVyxDQUFDNUIsTUFBTSxDQUFDMEIsVUFBVSxDQUFDRSxXQUFXLENBQUMsRUFBRTtBQUNsSCxVQUFBLE1BQUE7QUFDSixTQUFBO0FBQ0osT0FBQTs7QUFHQXJILE1BQUFBLEVBQUUsQ0FBQ21FLFlBQVksR0FBRzhDLFVBQVUsQ0FBQzlDLFlBQVksQ0FBQTtBQUM3QyxLQUFBO0FBQ0osR0FBQTs7QUFHQUksRUFBQUEsaUJBQWlCLEdBQUc7QUFHaEIsSUFBQSxJQUFJK0MsT0FBTyxDQUFDMUMsR0FBRyxDQUFDMkMscUJBQXFCLENBQUMsRUFBRTtNQUNwQ0MsS0FBSyxDQUFDQyxLQUFLLENBQUNGLHFCQUFxQixFQUFFLGtDQUFrQyxHQUFHLElBQUksQ0FBQy9JLElBQUksQ0FBQyxDQUFBO0FBQ2xGLE1BQUEsS0FBSyxJQUFJb0MsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ2xCLGNBQWMsQ0FBQ2UsTUFBTSxFQUFFRyxDQUFDLEVBQUUsRUFBRTtBQUNqRCxRQUFBLE1BQU1aLEVBQUUsR0FBRyxJQUFJLENBQUNOLGNBQWMsQ0FBQ2tCLENBQUMsQ0FBQyxDQUFBO0FBQ2pDLFFBQUEsTUFBTTJFLFVBQVUsR0FBR3ZGLEVBQUUsQ0FBQ3VGLFVBQVUsQ0FBQTtBQUNoQyxRQUFBLE1BQU1sRSxLQUFLLEdBQUcsSUFBSSxDQUFDNUMsU0FBUyxDQUFDOEcsVUFBVSxDQUFDLENBQUE7UUFDeEMsTUFBTXpFLE9BQU8sR0FBR08sS0FBSyxDQUFDUCxPQUFPLElBQUksSUFBSSxDQUFDbkMsZUFBZSxDQUFDNEcsVUFBVSxDQUFDLENBQUE7QUFDakUsUUFBQSxNQUFNN0MsV0FBVyxHQUFHLElBQUksQ0FBQ2hFLFlBQVksQ0FBQzZHLFVBQVUsQ0FBQyxDQUFBO1FBQ2pELE1BQU10QyxNQUFNLEdBQUc1QixLQUFLLENBQUM1QixPQUFPLENBQUNPLEVBQUUsQ0FBQytELFdBQVcsQ0FBQyxDQUFBO0FBQzVDLFFBQUEsTUFBTTJELGFBQWEsR0FBRzFILEVBQUUsQ0FBQzJILGlCQUFpQixDQUFDbEgsTUFBTSxDQUFBO1FBQ2pELE1BQU15QixLQUFLLEdBQUcsQ0FBQ2xDLEVBQUUsQ0FBQ3dHLFVBQVUsR0FBRyxRQUFRLEdBQUcsUUFBUSxLQUFLeEcsRUFBRSxDQUFDMEcsVUFBVSxHQUFHLFFBQVEsR0FBRyxRQUFRLENBQUMsSUFBSTFHLEVBQUUsQ0FBQzRHLFlBQVksR0FBRyxTQUFTLEdBQUcsU0FBUyxDQUFDLENBQUE7QUFFdklZLFFBQUFBLEtBQUssQ0FBQ0MsS0FBSyxDQUFDRixxQkFBcUIsRUFBRTNHLENBQUMsR0FDaEMsQ0FBQyxRQUFRLElBQUlxQyxNQUFNLEdBQUdBLE1BQU0sQ0FBQzJFLE1BQU0sQ0FBQ3BKLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRXFKLE1BQU0sQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEdBQ2hFLENBQUMsUUFBUSxHQUFHeEcsS0FBSyxDQUFDN0MsSUFBSSxFQUFFcUosTUFBTSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsSUFDdENuRixXQUFXLEdBQUcsU0FBUyxHQUFHLFNBQVMsQ0FBQyxJQUNwQzVCLE9BQU8sR0FBRyxXQUFXLEdBQUcsV0FBVyxDQUFDLEdBQ3JDLFdBQVcsRUFBRSxDQUFDNEIsV0FBVyxHQUFHckIsS0FBSyxDQUFDZ0Isd0JBQXdCLENBQUM1QixNQUFNLEdBQUdZLEtBQUssQ0FBQ2UsbUJBQW1CLENBQUMzQixNQUFNLEVBQUVxSCxRQUFRLEVBQUUsQ0FBQ0MsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUM1SCxDQUFDLE9BQU8sSUFBSS9ILEVBQUUsQ0FBQ21FLFlBQVksR0FBR25FLEVBQUUsQ0FBQ21FLFlBQVksQ0FBQzNGLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRXFKLE1BQU0sQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEdBQzFFLFVBQVUsR0FBRzNGLEtBQUssR0FDbEIsWUFBWSxHQUFHYixLQUFLLENBQUNxRSxtQkFBbUIsQ0FBQ3NDLElBQUksR0FBRyxHQUFHLEdBQUczRyxLQUFLLENBQUM0RyxVQUFVLENBQUNELElBQUksR0FBRyxHQUFHLEdBQ2pGLEdBQUcsR0FBRyxDQUFDaEksRUFBRSxDQUFDd0YsYUFBYSxLQUFLLElBQUksQ0FBQzVGLG1CQUFtQixHQUFJSSxFQUFFLENBQUN3RixhQUFhLENBQUNoSCxJQUFJLEdBQUksRUFBRSxFQUFFcUosTUFBTSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsSUFDbkc3SCxFQUFFLENBQUMrRyxjQUFjLEdBQUcsWUFBWSxHQUFHLEVBQUUsQ0FBQyxJQUN0Qy9HLEVBQUUsQ0FBQ2tFLGFBQWEsR0FBRyxXQUFXLEdBQUcsRUFBRSxDQUFDLElBQ3BDbEUsRUFBRSxDQUFDOEQsa0JBQWtCLEdBQUcsY0FBYyxHQUFHLEVBQUUsQ0FBQyxJQUM1QzRELGFBQWEsR0FBSSxjQUFjLEdBQUdBLGFBQWEsR0FBSSxFQUFFLENBQUMsQ0FDMUQsQ0FBQTtBQUNMLE9BQUE7QUFDSixLQUFBO0FBRUosR0FBQTtFQUVBUSxhQUFhLENBQUM3RyxLQUFLLEVBQUU7SUFDakIsSUFBSSxJQUFJLENBQUM1QyxTQUFTLENBQUMwRSxPQUFPLENBQUM5QixLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDcENtRyxNQUFBQSxLQUFLLENBQUNXLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFBO0FBQ3RDLE1BQUEsT0FBTyxJQUFJLENBQUE7QUFDZixLQUFBO0FBQ0EsSUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixHQUFBO0FBRUFDLEVBQUFBLGdCQUFnQixDQUFDL0csS0FBSyxFQUFFcUIsV0FBVyxFQUFFO0FBQ2pDLElBQUEsS0FBSyxJQUFJOUIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ25DLFNBQVMsQ0FBQ2dDLE1BQU0sRUFBRUcsQ0FBQyxFQUFFLEVBQUU7QUFDNUMsTUFBQSxJQUFJLElBQUksQ0FBQ25DLFNBQVMsQ0FBQ21DLENBQUMsQ0FBQyxLQUFLUyxLQUFLLElBQUksSUFBSSxDQUFDM0MsWUFBWSxDQUFDa0MsQ0FBQyxDQUFDLEtBQUs4QixXQUFXLEVBQUU7QUFDckU4RSxRQUFBQSxLQUFLLENBQUNXLEtBQUssQ0FBQyw0QkFBNEIsQ0FBQyxDQUFBO0FBQ3pDLFFBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixPQUFBO0FBQ0osS0FBQTtBQUNBLElBQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsR0FBQTs7RUFTQW5ILElBQUksQ0FBQ0ssS0FBSyxFQUFFO0FBRVIsSUFBQSxJQUFJLElBQUksQ0FBQzZHLGFBQWEsQ0FBQzdHLEtBQUssQ0FBQyxFQUFFLE9BQUE7QUFDL0IsSUFBQSxJQUFJLENBQUM1QyxTQUFTLENBQUN1QyxJQUFJLENBQUNLLEtBQUssQ0FBQyxDQUFBO0FBQzFCLElBQUEsSUFBSSxDQUFDNUMsU0FBUyxDQUFDdUMsSUFBSSxDQUFDSyxLQUFLLENBQUMsQ0FBQTtBQUMxQixJQUFBLElBQUksQ0FBQ3pDLFlBQVksQ0FBQ3lDLEtBQUssQ0FBQ3VDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQ2xGLFlBQVksQ0FBQ3NDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDL0QsSUFBQSxJQUFJLENBQUNuQyxpQkFBaUIsQ0FBQ3dDLEtBQUssQ0FBQ3VDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQ2xGLFlBQVksQ0FBQ3NDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDbkUsSUFBQSxJQUFJLENBQUNyQyxlQUFlLENBQUNxQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDL0IsSUFBQSxJQUFJLENBQUNyQyxlQUFlLENBQUNxQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDL0IsSUFBSSxDQUFDbEMsTUFBTSxHQUFHLElBQUksQ0FBQTtJQUNsQixJQUFJLENBQUNFLFlBQVksR0FBRyxJQUFJLENBQUE7SUFDeEIsSUFBSSxDQUFDQyxhQUFhLEdBQUcsSUFBSSxDQUFBO0FBQ3pCLElBQUEsSUFBSSxDQUFDb0osSUFBSSxDQUFDLEtBQUssRUFBRWhILEtBQUssQ0FBQyxDQUFBO0FBQzNCLEdBQUE7O0FBU0FpSCxFQUFBQSxNQUFNLENBQUNqSCxLQUFLLEVBQUU2QixLQUFLLEVBQUU7QUFFakIsSUFBQSxJQUFJLElBQUksQ0FBQ2dGLGFBQWEsQ0FBQzdHLEtBQUssQ0FBQyxFQUFFLE9BQUE7QUFDL0IsSUFBQSxJQUFJLENBQUM1QyxTQUFTLENBQUM4SixNQUFNLENBQUNyRixLQUFLLEVBQUUsQ0FBQyxFQUFFN0IsS0FBSyxFQUFFQSxLQUFLLENBQUMsQ0FBQTtBQUM3QyxJQUFBLElBQUksQ0FBQzNDLFlBQVksQ0FBQzZKLE1BQU0sQ0FBQ3JGLEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBRS9DLElBQUEsTUFBTThCLEtBQUssR0FBRyxJQUFJLENBQUN2RyxTQUFTLENBQUNnQyxNQUFNLENBQUE7SUFDbkMsSUFBSSxDQUFDK0gsa0JBQWtCLENBQUN0RixLQUFLLEVBQUU4QixLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFDekMsSUFBSSxDQUFDeUQsdUJBQXVCLENBQUN2RixLQUFLLEVBQUU4QixLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDOUMsSUFBQSxJQUFJLENBQUNyRyxlQUFlLENBQUM0SixNQUFNLENBQUNyRixLQUFLLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUNqRCxJQUFJLENBQUNwRSxNQUFNLEdBQUcsSUFBSSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0UsWUFBWSxHQUFHLElBQUksQ0FBQTtJQUN4QixJQUFJLENBQUNDLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDekIsSUFBQSxJQUFJLENBQUNvSixJQUFJLENBQUMsS0FBSyxFQUFFaEgsS0FBSyxDQUFDLENBQUE7QUFDM0IsR0FBQTs7RUFPQXFILE1BQU0sQ0FBQ3JILEtBQUssRUFBRTtJQUVWLElBQUl1QyxFQUFFLEdBQUcsSUFBSSxDQUFDbkYsU0FBUyxDQUFDMEUsT0FBTyxDQUFDOUIsS0FBSyxDQUFDLENBQUE7QUFFdEMsSUFBQSxPQUFPLElBQUksQ0FBQ3pDLFlBQVksQ0FBQ2dGLEVBQUUsQ0FBQyxDQUFBO0FBQzVCLElBQUEsT0FBTyxJQUFJLENBQUMvRSxpQkFBaUIsQ0FBQytFLEVBQUUsQ0FBQyxDQUFBO0lBRWpDLE9BQU9BLEVBQUUsSUFBSSxDQUFDLEVBQUU7TUFDWixJQUFJLENBQUNuRixTQUFTLENBQUM4SixNQUFNLENBQUMzRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUE7TUFDNUIsSUFBSSxDQUFDbEYsWUFBWSxDQUFDNkosTUFBTSxDQUFDM0UsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFBO01BQy9CLElBQUksQ0FBQ2pGLGVBQWUsQ0FBQzRKLE1BQU0sQ0FBQzNFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQTtNQUNsQ0EsRUFBRSxHQUFHLElBQUksQ0FBQ25GLFNBQVMsQ0FBQzBFLE9BQU8sQ0FBQzlCLEtBQUssQ0FBQyxDQUFBO01BQ2xDLElBQUksQ0FBQ3ZDLE1BQU0sR0FBRyxJQUFJLENBQUE7TUFDbEIsSUFBSSxDQUFDRSxZQUFZLEdBQUcsSUFBSSxDQUFBO01BQ3hCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUksQ0FBQTtBQUN6QixNQUFBLElBQUksQ0FBQ29KLElBQUksQ0FBQyxRQUFRLEVBQUVoSCxLQUFLLENBQUMsQ0FBQTtBQUM5QixLQUFBOztBQUdBLElBQUEsTUFBTTJELEtBQUssR0FBRyxJQUFJLENBQUN2RyxTQUFTLENBQUNnQyxNQUFNLENBQUE7SUFDbkMsSUFBSSxDQUFDK0gsa0JBQWtCLENBQUMsQ0FBQyxFQUFFeEQsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFBO0lBQ3JDLElBQUksQ0FBQ3lELHVCQUF1QixDQUFDLENBQUMsRUFBRXpELEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUM5QyxHQUFBOztFQVVBMkQsVUFBVSxDQUFDdEgsS0FBSyxFQUFFO0lBRWQsSUFBSSxJQUFJLENBQUMrRyxnQkFBZ0IsQ0FBQy9HLEtBQUssRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFBO0FBQ3pDLElBQUEsSUFBSSxDQUFDNUMsU0FBUyxDQUFDdUMsSUFBSSxDQUFDSyxLQUFLLENBQUMsQ0FBQTtBQUMxQixJQUFBLElBQUksQ0FBQ3pDLFlBQVksQ0FBQ3lDLEtBQUssQ0FBQ3VDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQ2xGLFlBQVksQ0FBQ3NDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDL0QsSUFBQSxJQUFJLENBQUNyQyxlQUFlLENBQUNxQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUE7SUFDL0IsSUFBSSxDQUFDbEMsTUFBTSxHQUFHLElBQUksQ0FBQTtJQUNsQixJQUFJLENBQUNFLFlBQVksR0FBRyxJQUFJLENBQUE7SUFDeEIsSUFBSSxDQUFDQyxhQUFhLEdBQUcsSUFBSSxDQUFBO0FBQ3pCLElBQUEsSUFBSSxDQUFDb0osSUFBSSxDQUFDLEtBQUssRUFBRWhILEtBQUssQ0FBQyxDQUFBO0FBQzNCLEdBQUE7O0FBU0F1SCxFQUFBQSxZQUFZLENBQUN2SCxLQUFLLEVBQUU2QixLQUFLLEVBQUU7SUFFdkIsSUFBSSxJQUFJLENBQUNrRixnQkFBZ0IsQ0FBQy9HLEtBQUssRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFBO0lBQ3pDLElBQUksQ0FBQzVDLFNBQVMsQ0FBQzhKLE1BQU0sQ0FBQ3JGLEtBQUssRUFBRSxDQUFDLEVBQUU3QixLQUFLLENBQUMsQ0FBQTtJQUN0QyxJQUFJLENBQUMzQyxZQUFZLENBQUM2SixNQUFNLENBQUNyRixLQUFLLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFBO0FBRXpDLElBQUEsTUFBTThCLEtBQUssR0FBRyxJQUFJLENBQUN0RyxZQUFZLENBQUMrQixNQUFNLENBQUE7SUFDdEMsSUFBSSxDQUFDK0gsa0JBQWtCLENBQUN0RixLQUFLLEVBQUU4QixLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFFekMsSUFBSSxDQUFDckcsZUFBZSxDQUFDNEosTUFBTSxDQUFDckYsS0FBSyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUMzQyxJQUFJLENBQUNwRSxNQUFNLEdBQUcsSUFBSSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0UsWUFBWSxHQUFHLElBQUksQ0FBQTtJQUN4QixJQUFJLENBQUNDLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDekIsSUFBQSxJQUFJLENBQUNvSixJQUFJLENBQUMsS0FBSyxFQUFFaEgsS0FBSyxDQUFDLENBQUE7QUFDM0IsR0FBQTs7RUFRQXdILFlBQVksQ0FBQ3hILEtBQUssRUFBRTtBQUVoQixJQUFBLEtBQUssSUFBSVQsQ0FBQyxHQUFHLENBQUMsRUFBRU8sR0FBRyxHQUFHLElBQUksQ0FBQzFDLFNBQVMsQ0FBQ2dDLE1BQU0sRUFBRUcsQ0FBQyxHQUFHTyxHQUFHLEVBQUVQLENBQUMsRUFBRSxFQUFFO0FBQ3ZELE1BQUEsSUFBSSxJQUFJLENBQUNuQyxTQUFTLENBQUNtQyxDQUFDLENBQUMsS0FBS1MsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDM0MsWUFBWSxDQUFDa0MsQ0FBQyxDQUFDLEVBQUU7UUFDdEQsSUFBSSxDQUFDbkMsU0FBUyxDQUFDOEosTUFBTSxDQUFDM0gsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO1FBQzNCLElBQUksQ0FBQ2xDLFlBQVksQ0FBQzZKLE1BQU0sQ0FBQzNILENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUU5Qk8sUUFBQUEsR0FBRyxFQUFFLENBQUE7UUFDTCxJQUFJLENBQUNxSCxrQkFBa0IsQ0FBQzVILENBQUMsRUFBRU8sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFBO1FBRW5DLElBQUksQ0FBQ3hDLGVBQWUsQ0FBQzRKLE1BQU0sQ0FBQzNILENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtRQUNqQyxJQUFJLENBQUM5QixNQUFNLEdBQUcsSUFBSSxDQUFBO1FBQ2xCLElBQUksQ0FBQ0UsWUFBWSxHQUFHLElBQUksQ0FBQTtRQUN4QixJQUFJLENBQUNDLGFBQWEsR0FBRyxJQUFJLENBQUE7UUFDekIsSUFBSSxJQUFJLENBQUNSLFNBQVMsQ0FBQzBFLE9BQU8sQ0FBQzlCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUNuQyxVQUFBLElBQUksQ0FBQ2dILElBQUksQ0FBQyxRQUFRLEVBQUVoSCxLQUFLLENBQUMsQ0FBQTtBQUM5QixTQUFBOztBQUNBLFFBQUEsT0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7RUFPQXlILGVBQWUsQ0FBQ3pILEtBQUssRUFBRTtJQUVuQixJQUFJLElBQUksQ0FBQytHLGdCQUFnQixDQUFDL0csS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFLE9BQUE7QUFDeEMsSUFBQSxJQUFJLENBQUM1QyxTQUFTLENBQUN1QyxJQUFJLENBQUNLLEtBQUssQ0FBQyxDQUFBO0FBQzFCLElBQUEsSUFBSSxDQUFDeEMsaUJBQWlCLENBQUN3QyxLQUFLLENBQUN1QyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUNsRixZQUFZLENBQUNzQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ25FLElBQUEsSUFBSSxDQUFDckMsZUFBZSxDQUFDcUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO0lBQy9CLElBQUksQ0FBQ2xDLE1BQU0sR0FBRyxJQUFJLENBQUE7SUFDbEIsSUFBSSxDQUFDRSxZQUFZLEdBQUcsSUFBSSxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUksQ0FBQTtBQUN6QixJQUFBLElBQUksQ0FBQ29KLElBQUksQ0FBQyxLQUFLLEVBQUVoSCxLQUFLLENBQUMsQ0FBQTtBQUMzQixHQUFBOztBQVFBMEgsRUFBQUEsaUJBQWlCLENBQUMxSCxLQUFLLEVBQUU2QixLQUFLLEVBQUU7SUFFNUIsSUFBSSxJQUFJLENBQUNrRixnQkFBZ0IsQ0FBQy9HLEtBQUssRUFBRSxJQUFJLENBQUMsRUFBRSxPQUFBO0lBQ3hDLElBQUksQ0FBQzVDLFNBQVMsQ0FBQzhKLE1BQU0sQ0FBQ3JGLEtBQUssRUFBRSxDQUFDLEVBQUU3QixLQUFLLENBQUMsQ0FBQTtJQUN0QyxJQUFJLENBQUMzQyxZQUFZLENBQUM2SixNQUFNLENBQUNyRixLQUFLLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBRXhDLElBQUEsTUFBTThCLEtBQUssR0FBRyxJQUFJLENBQUN0RyxZQUFZLENBQUMrQixNQUFNLENBQUE7SUFDdEMsSUFBSSxDQUFDZ0ksdUJBQXVCLENBQUN2RixLQUFLLEVBQUU4QixLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFFOUMsSUFBSSxDQUFDckcsZUFBZSxDQUFDNEosTUFBTSxDQUFDckYsS0FBSyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUMzQyxJQUFJLENBQUNwRSxNQUFNLEdBQUcsSUFBSSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0UsWUFBWSxHQUFHLElBQUksQ0FBQTtJQUN4QixJQUFJLENBQUNDLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDekIsSUFBQSxJQUFJLENBQUNvSixJQUFJLENBQUMsS0FBSyxFQUFFaEgsS0FBSyxDQUFDLENBQUE7QUFDM0IsR0FBQTs7RUFPQTJILGlCQUFpQixDQUFDM0gsS0FBSyxFQUFFO0FBRXJCLElBQUEsS0FBSyxJQUFJVCxDQUFDLEdBQUcsQ0FBQyxFQUFFTyxHQUFHLEdBQUcsSUFBSSxDQUFDMUMsU0FBUyxDQUFDZ0MsTUFBTSxFQUFFRyxDQUFDLEdBQUdPLEdBQUcsRUFBRVAsQ0FBQyxFQUFFLEVBQUU7QUFDdkQsTUFBQSxJQUFJLElBQUksQ0FBQ25DLFNBQVMsQ0FBQ21DLENBQUMsQ0FBQyxLQUFLUyxLQUFLLElBQUksSUFBSSxDQUFDM0MsWUFBWSxDQUFDa0MsQ0FBQyxDQUFDLEVBQUU7UUFDckQsSUFBSSxDQUFDbkMsU0FBUyxDQUFDOEosTUFBTSxDQUFDM0gsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO1FBQzNCLElBQUksQ0FBQ2xDLFlBQVksQ0FBQzZKLE1BQU0sQ0FBQzNILENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUU5Qk8sUUFBQUEsR0FBRyxFQUFFLENBQUE7UUFDTCxJQUFJLENBQUNzSCx1QkFBdUIsQ0FBQzdILENBQUMsRUFBRU8sR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFBO1FBRXhDLElBQUksQ0FBQ3hDLGVBQWUsQ0FBQzRKLE1BQU0sQ0FBQzNILENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtRQUNqQyxJQUFJLENBQUM5QixNQUFNLEdBQUcsSUFBSSxDQUFBO1FBQ2xCLElBQUksQ0FBQ0UsWUFBWSxHQUFHLElBQUksQ0FBQTtRQUN4QixJQUFJLENBQUNDLGFBQWEsR0FBRyxJQUFJLENBQUE7UUFDekIsSUFBSSxJQUFJLENBQUNSLFNBQVMsQ0FBQzBFLE9BQU8sQ0FBQzlCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUNuQyxVQUFBLElBQUksQ0FBQ2dILElBQUksQ0FBQyxRQUFRLEVBQUVoSCxLQUFLLENBQUMsQ0FBQTtBQUM5QixTQUFBOztBQUNBLFFBQUEsT0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBNEgsRUFBQUEsaUJBQWlCLENBQUM1SCxLQUFLLEVBQUVxQixXQUFXLEVBQUU7SUFFbEMsSUFBSWtCLEVBQUUsR0FBRyxJQUFJLENBQUNuRixTQUFTLENBQUMwRSxPQUFPLENBQUM5QixLQUFLLENBQUMsQ0FBQTtBQUN0QyxJQUFBLElBQUl1QyxFQUFFLEdBQUcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUE7SUFFckIsSUFBSSxJQUFJLENBQUNsRixZQUFZLENBQUNrRixFQUFFLENBQUMsS0FBS2xCLFdBQVcsRUFBRTtBQUN2Q2tCLE1BQUFBLEVBQUUsR0FBRyxJQUFJLENBQUNuRixTQUFTLENBQUMwRSxPQUFPLENBQUM5QixLQUFLLEVBQUV1QyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDMUMsTUFBQSxJQUFJQSxFQUFFLEdBQUcsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUE7TUFDckIsSUFBSSxJQUFJLENBQUNsRixZQUFZLENBQUNrRixFQUFFLENBQUMsS0FBS2xCLFdBQVcsRUFBRTtBQUN2QyxRQUFBLE9BQU8sQ0FBQyxDQUFDLENBQUE7QUFDYixPQUFBO0FBQ0osS0FBQTtBQUNBLElBQUEsT0FBT2tCLEVBQUUsQ0FBQTtBQUNiLEdBQUE7O0VBUUFzRixjQUFjLENBQUM3SCxLQUFLLEVBQUU7QUFDbEIsSUFBQSxPQUFPLElBQUksQ0FBQzRILGlCQUFpQixDQUFDNUgsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFBO0FBQy9DLEdBQUE7O0VBUUE4SCxtQkFBbUIsQ0FBQzlILEtBQUssRUFBRTtBQUN2QixJQUFBLE9BQU8sSUFBSSxDQUFDNEgsaUJBQWlCLENBQUM1SCxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDOUMsR0FBQTs7RUFTQStILFlBQVksQ0FBQ3hGLEVBQUUsRUFBRTtBQUNiLElBQUEsS0FBSyxJQUFJaEQsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ25DLFNBQVMsQ0FBQ2dDLE1BQU0sRUFBRUcsQ0FBQyxFQUFFLEVBQUU7QUFDNUMsTUFBQSxJQUFJLElBQUksQ0FBQ25DLFNBQVMsQ0FBQ21DLENBQUMsQ0FBQyxDQUFDZ0QsRUFBRSxLQUFLQSxFQUFFLEVBQUUsT0FBTyxJQUFJLENBQUNuRixTQUFTLENBQUNtQyxDQUFDLENBQUMsQ0FBQTtBQUM3RCxLQUFBO0FBQ0EsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0VBU0F5SSxjQUFjLENBQUM3SyxJQUFJLEVBQUU7QUFDakIsSUFBQSxLQUFLLElBQUlvQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDbkMsU0FBUyxDQUFDZ0MsTUFBTSxFQUFFRyxDQUFDLEVBQUUsRUFBRTtBQUM1QyxNQUFBLElBQUksSUFBSSxDQUFDbkMsU0FBUyxDQUFDbUMsQ0FBQyxDQUFDLENBQUNwQyxJQUFJLEtBQUtBLElBQUksRUFBRSxPQUFPLElBQUksQ0FBQ0MsU0FBUyxDQUFDbUMsQ0FBQyxDQUFDLENBQUE7QUFDakUsS0FBQTtBQUNBLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBO0FBRUE0SCxFQUFBQSxrQkFBa0IsQ0FBQ3hCLFVBQVUsRUFBRXNDLFFBQVEsRUFBRTtJQUNyQyxLQUFLLElBQUkxSSxDQUFDLEdBQUdvRyxVQUFVLEVBQUVwRyxDQUFDLElBQUkwSSxRQUFRLEVBQUUxSSxDQUFDLEVBQUUsRUFBRTtNQUN6QyxJQUFJLElBQUksQ0FBQ2xDLFlBQVksQ0FBQ2tDLENBQUMsQ0FBQyxLQUFLLEtBQUssRUFBRTtBQUNoQyxRQUFBLElBQUksQ0FBQ2hDLFlBQVksQ0FBQyxJQUFJLENBQUNILFNBQVMsQ0FBQ21DLENBQUMsQ0FBQyxDQUFDZ0QsRUFBRSxDQUFDLEdBQUdoRCxDQUFDLENBQUE7QUFDL0MsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUE2SCxFQUFBQSx1QkFBdUIsQ0FBQ3pCLFVBQVUsRUFBRXNDLFFBQVEsRUFBRTtJQUMxQyxLQUFLLElBQUkxSSxDQUFDLEdBQUdvRyxVQUFVLEVBQUVwRyxDQUFDLElBQUkwSSxRQUFRLEVBQUUxSSxDQUFDLEVBQUUsRUFBRTtNQUN6QyxJQUFJLElBQUksQ0FBQ2xDLFlBQVksQ0FBQ2tDLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRTtBQUMvQixRQUFBLElBQUksQ0FBQy9CLGlCQUFpQixDQUFDLElBQUksQ0FBQ0osU0FBUyxDQUFDbUMsQ0FBQyxDQUFDLENBQUNnRCxFQUFFLENBQUMsR0FBR2hELENBQUMsQ0FBQTtBQUNwRCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBS0EySSxFQUFBQSxxQkFBcUIsQ0FBQ0MsT0FBTyxFQUFFQyxPQUFPLEVBQUVDLEtBQUssRUFBRTtJQUMzQyxJQUFJQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFDbEIsSUFBSUMsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFBOztBQUdsQixJQUFBLEtBQUssSUFBSWhKLENBQUMsR0FBRyxDQUFDLEVBQUVPLEdBQUcsR0FBR3FJLE9BQU8sQ0FBQy9JLE1BQU0sRUFBRUcsQ0FBQyxHQUFHTyxHQUFHLEVBQUVQLENBQUMsRUFBRSxFQUFFO0FBQ2hELE1BQUEsTUFBTWdELEVBQUUsR0FBRzRGLE9BQU8sQ0FBQzVJLENBQUMsQ0FBQyxDQUFBO0FBQ3JCLE1BQUEsSUFBSThJLEtBQUssQ0FBQ0csY0FBYyxDQUFDakcsRUFBRSxDQUFDLEVBQUU7UUFDMUIrRixTQUFTLEdBQUdHLElBQUksQ0FBQ0MsR0FBRyxDQUFDSixTQUFTLEVBQUVELEtBQUssQ0FBQzlGLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDOUMsT0FBQTtBQUNKLEtBQUE7O0FBR0EsSUFBQSxLQUFLLElBQUloRCxDQUFDLEdBQUcsQ0FBQyxFQUFFTyxHQUFHLEdBQUdzSSxPQUFPLENBQUNoSixNQUFNLEVBQUVHLENBQUMsR0FBR08sR0FBRyxFQUFFUCxDQUFDLEVBQUUsRUFBRTtBQUNoRCxNQUFBLE1BQU1nRCxFQUFFLEdBQUc2RixPQUFPLENBQUM3SSxDQUFDLENBQUMsQ0FBQTtBQUNyQixNQUFBLElBQUk4SSxLQUFLLENBQUNHLGNBQWMsQ0FBQ2pHLEVBQUUsQ0FBQyxFQUFFO1FBQzFCZ0csU0FBUyxHQUFHRSxJQUFJLENBQUNDLEdBQUcsQ0FBQ0gsU0FBUyxFQUFFRixLQUFLLENBQUM5RixFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQzlDLE9BQUE7QUFDSixLQUFBOztJQUlBLElBQUkrRixTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUlDLFNBQVMsS0FBSyxDQUFDLENBQUMsRUFBRTtBQUN0QyxNQUFBLE9BQU8sQ0FBQyxDQUFBO0tBQ1gsTUFBTSxJQUFJQSxTQUFTLEtBQUssQ0FBQyxDQUFDLElBQUlELFNBQVMsS0FBSyxDQUFDLENBQUMsRUFBRTtBQUM3QyxNQUFBLE9BQU8sQ0FBQyxDQUFDLENBQUE7QUFDYixLQUFBOztJQUlBLE9BQU9DLFNBQVMsR0FBR0QsU0FBUyxDQUFBO0FBQ2hDLEdBQUE7O0FBY0FLLEVBQUFBLHFCQUFxQixDQUFDUixPQUFPLEVBQUVDLE9BQU8sRUFBRTtJQUNwQyxPQUFPLElBQUksQ0FBQ0YscUJBQXFCLENBQUNDLE9BQU8sRUFBRUMsT0FBTyxFQUFFLElBQUksQ0FBQzVLLGlCQUFpQixDQUFDLENBQUE7QUFDL0UsR0FBQTs7QUFhQW9MLEVBQUFBLGdCQUFnQixDQUFDVCxPQUFPLEVBQUVDLE9BQU8sRUFBRTtJQUMvQixPQUFPLElBQUksQ0FBQ0YscUJBQXFCLENBQUNDLE9BQU8sRUFBRUMsT0FBTyxFQUFFLElBQUksQ0FBQzdLLFlBQVksQ0FBQyxDQUFBO0FBQzFFLEdBQUE7QUFDSjs7OzsifQ==
