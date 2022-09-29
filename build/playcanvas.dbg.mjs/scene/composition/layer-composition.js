/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXItY29tcG9zaXRpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUUkFDRUlEX1JFTkRFUl9BQ1RJT04gfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVHJhY2luZyB9IGZyb20gJy4uLy4uL2NvcmUvdHJhY2luZy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgc2V0IH0gZnJvbSAnLi4vLi4vY29yZS9zZXQtdXRpbHMuanMnO1xuaW1wb3J0IHsgc29ydFByaW9yaXR5IH0gZnJvbSAnLi4vLi4vY29yZS9zb3J0LmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUklEX0RFUFRILFxuICAgIENPTVBVUERBVEVEX0JMRU5ELCBDT01QVVBEQVRFRF9DQU1FUkFTLCBDT01QVVBEQVRFRF9JTlNUQU5DRVMsIENPTVBVUERBVEVEX0xJR0hUUyxcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJBY3Rpb24gfSBmcm9tICcuL3JlbmRlci1hY3Rpb24uanMnO1xuaW1wb3J0IHsgV29ybGRDbHVzdGVycyB9IGZyb20gJy4uL2xpZ2h0aW5nL3dvcmxkLWNsdXN0ZXJzLmpzJztcbmltcG9ydCB7IExpZ2h0Q29tcG9zaXRpb25EYXRhIH0gZnJvbSAnLi9saWdodC1jb21wb3NpdGlvbi1kYXRhLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBHcmFwaGljc0RldmljZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9IENhbWVyYUNvbXBvbmVudCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IExheWVyICovXG5cbmNvbnN0IHRlbXBTZXQgPSBuZXcgU2V0KCk7XG5jb25zdCB0ZW1wQ2x1c3RlckFycmF5ID0gW107XG5cbi8qKlxuICogTGF5ZXIgQ29tcG9zaXRpb24gaXMgYSBjb2xsZWN0aW9uIG9mIHtAbGluayBMYXllcn0gdGhhdCBpcyBmZWQgdG8ge0BsaW5rIFNjZW5lI2xheWVyc30gdG8gZGVmaW5lXG4gKiByZW5kZXJpbmcgb3JkZXIuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBMYXllckNvbXBvc2l0aW9uIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvLyBDb21wb3NpdGlvbiBjYW4gaG9sZCBvbmx5IDIgc3VibGF5ZXJzIG9mIGVhY2ggbGF5ZXJcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBPcHRpb25hbCBub24tdW5pcXVlIG5hbWUgb2YgdGhlIGxheWVyIGNvbXBvc2l0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIFwiVW50aXRsZWRcIiBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUgPSAnVW50aXRsZWQnKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2Yge0BsaW5rIExheWVyfSBzb3J0ZWQgaW4gdGhlIG9yZGVyIHRoZXkgd2lsbCBiZSByZW5kZXJlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0xheWVyW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxheWVyTGlzdCA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIHJlYWQtb25seSBhcnJheSBvZiBib29sZWFuIHZhbHVlcywgbWF0Y2hpbmcge0BsaW5rIExheWVyI2xheWVyTGlzdH0uIFRydWUgbWVhbnMgb25seVxuICAgICAgICAgKiBzZW1pLXRyYW5zcGFyZW50IG9iamVjdHMgYXJlIHJlbmRlcmVkLCBhbmQgZmFsc2UgbWVhbnMgb3BhcXVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbltdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zdWJMYXllckxpc3QgPSBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2YgYm9vbGVhbiB2YWx1ZXMsIG1hdGNoaW5nIHtAbGluayBMYXllciNsYXllckxpc3R9LiBUcnVlIG1lYW5zIHRoZVxuICAgICAgICAgKiBsYXllciBpcyByZW5kZXJlZCwgZmFsc2UgbWVhbnMgaXQncyBza2lwcGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbltdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQgPSBbXTsgLy8gbW9yZSBncmFudWxhciBjb250cm9sIG9uIHRvcCBvZiBsYXllci5lbmFibGVkIChBTkRlZClcblxuICAgICAgICB0aGlzLl9vcGFxdWVPcmRlciA9IHt9O1xuICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyID0ge307XG5cbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSBmYWxzZTtcblxuICAgICAgICAvLyBhbGwgdW5pcXVlIG1lc2hJbnN0YW5jZXMgZnJvbSBhbGwgbGF5ZXJzLCBzdG9yZWQgYm90aCBhcyBhbiBhcnJheSwgYW5kIGFsc28gYSBzZXQgZm9yIGZhc3Qgc2VhcmNoXG4gICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1NldCA9IG5ldyBTZXQoKTtcblxuICAgICAgICAvLyBhbiBhcnJheSBvZiBhbGwgdW5pcXVlIGxpZ2h0cyBmcm9tIGFsbCBsYXllcnNcbiAgICAgICAgdGhpcy5fbGlnaHRzID0gW107XG5cbiAgICAgICAgLy8gYSBtYXAgb2YgTGlnaHQgdG8gaW5kZXggaW4gX2xpZ2h0cyBmb3IgZmFzdCBsb29rdXBcbiAgICAgICAgdGhpcy5fbGlnaHRzTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIC8vIGVhY2ggZW50cnkgaW4gX2xpZ2h0cyBoYXMgZW50cnkgb2YgdHlwZSBMaWdodENvbXBvc2l0aW9uRGF0YSBoZXJlIGF0IHRoZSBzYW1lIGluZGV4LFxuICAgICAgICAvLyBzdG9yaW5nIHNoYWRvdyBjYXN0ZXJzIGFuZCBhZGRpdGlvbmFsIGNvbXBvc2l0aW9uIHJlbGF0ZWQgZGF0YSBmb3IgdGhlIGxpZ2h0XG4gICAgICAgIHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhID0gW107XG5cbiAgICAgICAgLy8gX2xpZ2h0cyBzcGxpdCBpbnRvIGFycmF5cyBwZXIgdHlwZSBvZiBsaWdodCwgaW5kZXhlZCBieSBMSUdIVFRZUEVfKioqIGNvbnN0YW50c1xuICAgICAgICB0aGlzLl9zcGxpdExpZ2h0cyA9IFtbXSwgW10sIFtdXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSByZWFkLW9ubHkgYXJyYXkgb2Yge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gdGhhdCBjYW4gYmUgdXNlZCBkdXJpbmcgcmVuZGVyaW5nLiBlLmcuXG4gICAgICAgICAqIEluc2lkZSB7QGxpbmsgTGF5ZXIjb25QcmVDdWxsfSwge0BsaW5rIExheWVyI29uUG9zdEN1bGx9LCB7QGxpbmsgTGF5ZXIjb25QcmVSZW5kZXJ9LFxuICAgICAgICAgKiB7QGxpbmsgTGF5ZXIjb25Qb3N0UmVuZGVyfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NhbWVyYUNvbXBvbmVudFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jYW1lcmFzID0gW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhY3R1YWwgcmVuZGVyaW5nIHNlcXVlbmNlLCBnZW5lcmF0ZWQgYmFzZWQgb24gbGF5ZXJzIGFuZCBjYW1lcmFzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtSZW5kZXJBY3Rpb25bXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9ucyA9IFtdO1xuXG4gICAgICAgIC8vIGFsbCBjdXJyZW50bHkgY3JlYXRlZCBsaWdodCBjbHVzdGVycywgdGhhdCBuZWVkIHRvIGJlIHVwZGF0ZWQgYmVmb3JlIHJlbmRlcmluZ1xuICAgICAgICB0aGlzLl93b3JsZENsdXN0ZXJzID0gW107XG5cbiAgICAgICAgLy8gZW1wdHkgY2x1c3RlciB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMgPSBudWxsO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIGVtcHR5IGxpZ2h0IGNsdXN0ZXJcbiAgICAgICAgaWYgKHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycykge1xuICAgICAgICAgICAgdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhbGwgb3RoZXIgY2x1c3RlcnNcbiAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycy5mb3JFYWNoKChjbHVzdGVyKSA9PiB7XG4gICAgICAgICAgICBjbHVzdGVyLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3dvcmxkQ2x1c3RlcnMgPSBudWxsO1xuXG4gICAgICAgIC8vIHJlbmRlciBhY3Rpb25zXG4gICAgICAgIHRoaXMuX3JlbmRlckFjdGlvbnMuZm9yRWFjaChyYSA9PiByYS5kZXN0cm95KCkpO1xuICAgICAgICB0aGlzLl9yZW5kZXJBY3Rpb25zID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIGFuIGVtcHR5IGxpZ2h0IGNsdXN0ZXIgb2JqZWN0IHRvIGJlIHVzZWQgd2hlbiBubyBsaWdodHMgYXJlIHVzZWRcbiAgICBnZXRFbXB0eVdvcmxkQ2x1c3RlcnMoZGV2aWNlKSB7XG4gICAgICAgIGlmICghdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBjbHVzdGVyIHN0cnVjdHVyZSB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICAgICAgdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzID0gbmV3IFdvcmxkQ2x1c3RlcnMoZGV2aWNlKTtcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycy5uYW1lID0gJ0NsdXN0ZXJFbXB0eSc7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBpdCBvbmNlIHRvIGF2b2lkIGRvaW5nIGl0IGVhY2ggZnJhbWVcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycy51cGRhdGUoW10sIGZhbHNlLCBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnM7XG4gICAgfVxuXG4gICAgLy8gZnVuY3Rpb24gd2hpY2ggc3BsaXRzIGxpc3Qgb2YgbGlnaHRzIG9uIGEgYSB0YXJnZXQgb2JqZWN0IGludG8gc2VwYXJhdGUgbGlzdHMgb2YgbGlnaHRzIGJhc2VkIG9uIGxpZ2h0IHR5cGVcbiAgICBfc3BsaXRMaWdodHNBcnJheSh0YXJnZXQpIHtcbiAgICAgICAgY29uc3QgbGlnaHRzID0gdGFyZ2V0Ll9saWdodHM7XG4gICAgICAgIHRhcmdldC5fc3BsaXRMaWdodHNbTElHSFRUWVBFX0RJUkVDVElPTkFMXS5sZW5ndGggPSAwO1xuICAgICAgICB0YXJnZXQuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9PTU5JXS5sZW5ndGggPSAwO1xuICAgICAgICB0YXJnZXQuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9TUE9UXS5sZW5ndGggPSAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGlmIChsaWdodC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Ll9zcGxpdExpZ2h0c1tsaWdodC5fdHlwZV0ucHVzaChsaWdodCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlKGRldmljZSwgY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gZmFsc2UpIHtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICBsZXQgcmVzdWx0ID0gMDtcblxuICAgICAgICAvLyBpZiBjb21wb3NpdGlvbiBkaXJ0eSBmbGFncyBhcmUgbm90IHNldCwgdGVzdCBpZiBsYXllcnMgYXJlIG1hcmtlZCBkaXJ0eVxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5IHx8ICF0aGlzLl9kaXJ0eUxpZ2h0cyB8fCAhdGhpcy5fZGlydHlDYW1lcmFzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX2RpcnR5KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLl9kaXJ0eUxpZ2h0cykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsYXllci5fZGlydHlDYW1lcmFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZnVuY3Rpb24gYWRkcyB1bmlxdWUgbWVzaEluc3RhbmNlcyBmcm9tIHNyYyBhcnJheSBpbnRvIGRlc3RBcnJheS4gQSBkZXN0U2V0IGlzIGEgU2V0IGNvbnRhaW5pbmcgYWxyZWFkeVxuICAgICAgICAvLyBleGlzdGluZyBtZXNoSW5zdGFuY2VzICB0byBhY2NlbGVyYXRlIHRoZSByZW1vdmFsIG9mIGR1cGxpY2F0ZXNcbiAgICAgICAgLy8gcmV0dXJucyB0cnVlIGlmIGFueSBvZiB0aGUgbWF0ZXJpYWxzIG9uIHRoZXNlIG1lc2hJbnN0YW5jZXMgaGFzIF9kaXJ0eUJsZW5kIHNldFxuICAgICAgICBmdW5jdGlvbiBhZGRVbmlxdWVNZXNoSW5zdGFuY2UoZGVzdEFycmF5LCBkZXN0U2V0LCBzcmNBcnJheSkge1xuICAgICAgICAgICAgbGV0IGRpcnR5QmxlbmQgPSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IHNyY0xlbiA9IHNyY0FycmF5Lmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IHMgPSAwOyBzIDwgc3JjTGVuOyBzKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5zdCA9IHNyY0FycmF5W3NdO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFkZXN0U2V0LmhhcyhtZXNoSW5zdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVzdFNldC5hZGQobWVzaEluc3QpO1xuICAgICAgICAgICAgICAgICAgICBkZXN0QXJyYXkucHVzaChtZXNoSW5zdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBtZXNoSW5zdC5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsICYmIG1hdGVyaWFsLl9kaXJ0eUJsZW5kKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLl9kaXJ0eUJsZW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGlydHlCbGVuZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlYnVpbGQgdGhpcy5fbWVzaEluc3RhbmNlcyBhcnJheSAtIGFkZCBhbGwgdW5pcXVlIG1lc2hJbnN0YW5jZXMgZnJvbSBhbGwgbGF5ZXJzIHRvIGl0XG4gICAgICAgIC8vIGFsc28gc2V0IHRoaXMuX2RpcnR5QmxlbmQgdG8gdHJ1ZSBpZiBtYXRlcmlhbCBvZiBhbnkgbWVzaEluc3RhbmNlIGhhcyBfZGlydHlCbGVuZCBzZXQsIGFuZCBjbGVhciB0aG9zZSBmbGFncyBvbiBtYXRlcmlhbHNcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5KSB7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfSU5TVEFOQ0VTO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1NldC5jbGVhcigpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyLnBhc3NUaHJvdWdoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIG1lc2hJbnN0YW5jZXMgZnJvbSBib3RoIG9wYXF1ZSBhbmQgdHJhbnNwYXJlbnQgbGlzdHNcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGFkZFVuaXF1ZU1lc2hJbnN0YW5jZSh0aGlzLl9tZXNoSW5zdGFuY2VzLCB0aGlzLl9tZXNoSW5zdGFuY2VzU2V0LCBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzKSB8fCB0aGlzLl9kaXJ0eUJsZW5kO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUJsZW5kID0gYWRkVW5pcXVlTWVzaEluc3RhbmNlKHRoaXMuX21lc2hJbnN0YW5jZXMsIHRoaXMuX21lc2hJbnN0YW5jZXNTZXQsIGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcykgfHwgdGhpcy5fZGlydHlCbGVuZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsYXllci5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZ1bmN0aW9uIG1vdmVzIHRyYW5zcGFyZW50IG9yIG9wYXF1ZSBtZXNoZXMgYmFzZWQgb24gbW92ZVRyYW5zcGFyZW50IGZyb20gc3JjIHRvIGRlc3QgYXJyYXlcbiAgICAgICAgZnVuY3Rpb24gbW92ZUJ5QmxlbmRUeXBlKGRlc3QsIHNyYywgbW92ZVRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBzID0gMDsgcyA8IHNyYy5sZW5ndGg7KSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3JjW3NdLm1hdGVyaWFsPy50cmFuc3BhcmVudCA9PT0gbW92ZVRyYW5zcGFyZW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIGl0IHRvIGRlc3RcbiAgICAgICAgICAgICAgICAgICAgZGVzdC5wdXNoKHNyY1tzXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIGl0IGZyb20gc3JjXG4gICAgICAgICAgICAgICAgICAgIHNyY1tzXSA9IHNyY1tzcmMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgICAgIHNyYy5sZW5ndGgtLTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8ganVzdCBza2lwIGl0XG4gICAgICAgICAgICAgICAgICAgIHMrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3IgZWFjaCBsYXllciwgc3BsaXQgaXRzIG1lc2hJbnN0YW5jZXMgdG8gZWl0aGVyIG9wYXF1ZSBvciB0cmFuc3BhcmVudCBhcnJheSBiYXNlZCBvbiBtYXRlcmlhbCBibGVuZCB0eXBlXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUJsZW5kKSB7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfQkxFTkQ7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgICAgIGlmICghbGF5ZXIucGFzc1Rocm91Z2gpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtb3ZlIGFueSBvcGFxdWUgbWVzaEluc3RhbmNlcyBmcm9tIHRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyB0byBvcGFxdWVNZXNoSW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgICAgIG1vdmVCeUJsZW5kVHlwZShsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzLCBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMsIGZhbHNlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtb3ZlIGFueSB0cmFuc3BhcmVudCBtZXNoSW5zdGFuY2VzIGZyb20gb3BhcXVlTWVzaEluc3RhbmNlcyB0byB0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXNcbiAgICAgICAgICAgICAgICAgICAgbW92ZUJ5QmxlbmRUeXBlKGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcywgbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TGlnaHRzKSB7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfTElHSFRTO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy51cGRhdGVMaWdodHMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIG1lc2hlcyBPUiBsaWdodHMgY2hhbmdlZCwgcmVidWlsZCBzaGFkb3cgY2FzdGVyc1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRvd0Nhc3RlcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUNhbWVyYXMgfHwgKHJlc3VsdCAmIENPTVBVUERBVEVEX0xJR0hUUykpIHtcblxuICAgICAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gZmFsc2U7XG4gICAgICAgICAgICByZXN1bHQgfD0gQ09NUFVQREFURURfQ0FNRVJBUztcblxuICAgICAgICAgICAgLy8gd2FsayB0aGUgbGF5ZXJzIGFuZCBidWlsZCBhbiBhcnJheSBvZiB1bmlxdWUgY2FtZXJhcyBmcm9tIGFsbCBsYXllcnNcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhcy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgICAgICAgICAgbGF5ZXIuX2RpcnR5Q2FtZXJhcyA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgLy8gZm9yIGFsbCBjYW1lcmFzIGluIHRoZSBsYXllclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXIuY2FtZXJhcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW2pdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY2FtZXJhcy5wdXNoKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNvcnQgY2FtZXJhcyBieSBwcmlvcml0eVxuICAgICAgICAgICAgaWYgKHRoaXMuY2FtZXJhcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgc29ydFByaW9yaXR5KHRoaXMuY2FtZXJhcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvbGxlY3QgYSBsaXN0IG9mIGxheWVycyB0aGlzIGNhbWVyYSByZW5kZXJzXG4gICAgICAgICAgICBjb25zdCBjYW1lcmFMYXllcnMgPSBbXTtcblxuICAgICAgICAgICAgLy8gcmVuZGVyIGluIG9yZGVyIG9mIGNhbWVyYXMgc29ydGVkIGJ5IHByaW9yaXR5XG4gICAgICAgICAgICBsZXQgcmVuZGVyQWN0aW9uQ291bnQgPSAwO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmNhbWVyYXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSB0aGlzLmNhbWVyYXNbaV07XG4gICAgICAgICAgICAgICAgY2FtZXJhTGF5ZXJzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgICAgICAgICAvLyBmaXJzdCByZW5kZXIgYWN0aW9uIGZvciB0aGlzIGNhbWVyYVxuICAgICAgICAgICAgICAgIGxldCBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCA9IHJlbmRlckFjdGlvbkNvdW50O1xuXG4gICAgICAgICAgICAgICAgLy8gbGFzdCByZW5kZXIgYWN0aW9uIGZvciB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgbGV0IGxhc3RSZW5kZXJBY3Rpb24gPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgLy8gdHJ1ZSBpZiBwb3N0IHByb2Nlc3Npbmcgc3RvcCBsYXllciB3YXMgZm91bmQgZm9yIHRoZSBjYW1lcmFcbiAgICAgICAgICAgICAgICBsZXQgcG9zdFByb2Nlc3NNYXJrZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIC8vIHdhbGsgYWxsIGdsb2JhbCBzb3J0ZWQgbGlzdCBvZiBsYXllcnMgKHN1YmxheWVycykgdG8gY2hlY2sgaWYgY2FtZXJhIHJlbmRlcnMgaXRcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGFkZHMgYm90aCBvcGFxdWUgYW5kIHRyYW5zcGFyZW50IHN1YmxheWVycyBpZiBjYW1lcmEgcmVuZGVycyB0aGUgbGF5ZXJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaisrKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtqXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIGxheWVyIG5lZWRzIHRvIGJlIHJlbmRlcmVkXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIuY2FtZXJhcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY2FtZXJhIHJlbmRlcnMgdGhpcyBsYXllclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmEubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpID49IDApIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFMYXllcnMucHVzaChsYXllcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhpcyBsYXllciBpcyB0aGUgc3RvcCBsYXllciBmb3IgcG9zdHByb2Nlc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFwb3N0UHJvY2Vzc01hcmtlZCAmJiBsYXllci5pZCA9PT0gY2FtZXJhLmRpc2FibGVQb3N0RWZmZWN0c0xheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0UHJvY2Vzc01hcmtlZCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBwcmV2aW91c2x5IGFkZGVkIHJlbmRlciBhY3Rpb24gaXMgdGhlIGxhc3QgcG9zdC1wcm9jZXNzZWQgbGF5ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXN0UmVuZGVyQWN0aW9uKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBtYXJrIGl0IHRvIHRyaWdnZXIgcG9zdHByb2Nlc3NpbmcgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0UmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjYW1lcmEgaW5kZXggaW4gdGhlIGxheWVyIGFycmF5XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYUluZGV4ID0gbGF5ZXIuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmFJbmRleCA+PSAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCByZW5kZXIgYWN0aW9uIHRvIGRlc2NyaWJlIHJlbmRlcmluZyBzdGVwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0UmVuZGVyQWN0aW9uID0gdGhpcy5hZGRSZW5kZXJBY3Rpb24odGhpcy5fcmVuZGVyQWN0aW9ucywgcmVuZGVyQWN0aW9uQ291bnQsIGxheWVyLCBqLCBjYW1lcmFJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiwgcG9zdFByb2Nlc3NNYXJrZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyQWN0aW9uQ291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY2FtZXJhIHJlbmRlcnMgYW55IGxheWVycy5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCA8IHJlbmRlckFjdGlvbkNvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGJhc2VkIG9uIGFsbCBsYXllcnMgdGhpcyBjYW1lcmEgcmVuZGVycywgcHJlcGFyZSBhIGxpc3Qgb2YgZGlyZWN0aW9uYWwgbGlnaHRzIHRoZSBjYW1lcmEgbmVlZHMgdG8gcmVuZGVyIHNoYWRvdyBmb3JcbiAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHNldCB0aGVzZSB1cCBvbiB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBmb3IgdGhlIGNhbWVyYS5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9uc1tjYW1lcmFGaXJzdFJlbmRlckFjdGlvbkluZGV4XS5jb2xsZWN0RGlyZWN0aW9uYWxMaWdodHMoY2FtZXJhTGF5ZXJzLCB0aGlzLl9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfRElSRUNUSU9OQUxdLCB0aGlzLl9saWdodHMpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hcmsgdGhlIGxhc3QgcmVuZGVyIGFjdGlvbiBhcyBsYXN0IG9uZSB1c2luZyB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgICAgIGxhc3RSZW5kZXJBY3Rpb24ubGFzdENhbWVyYVVzZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgbm8gcmVuZGVyIGFjdGlvbiBmb3IgdGhpcyBjYW1lcmEgd2FzIG1hcmtlZCBmb3IgZW5kIG9mIHBvc3Rwcm9jZXNzaW5nLCBtYXJrIGxhc3Qgb25lXG4gICAgICAgICAgICAgICAgaWYgKCFwb3N0UHJvY2Vzc01hcmtlZCAmJiBsYXN0UmVuZGVyQWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RSZW5kZXJBY3Rpb24udHJpZ2dlclBvc3Rwcm9jZXNzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBoYW5kbGUgY2FtZXJhIHN0YWNraW5nIGlmIHRoaXMgcmVuZGVyIGFjdGlvbiBoYXMgcG9zdHByb2Nlc3NpbmcgZW5hYmxlZFxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEucmVuZGVyVGFyZ2V0ICYmIGNhbWVyYS5wb3N0RWZmZWN0c0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJvY2VzcyBwcmV2aW91cyByZW5kZXIgYWN0aW9ucyBzdGFydGluZyB3aXRoIHByZXZpb3VzIGNhbWVyYVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb3BhZ2F0ZVJlbmRlclRhcmdldChjYW1lcmFGaXJzdFJlbmRlckFjdGlvbkluZGV4IC0gMSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgdW51c2VkIHJlbmRlciBhY3Rpb25zXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gcmVuZGVyQWN0aW9uQ291bnQ7IGkgPCB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9uc1tpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aCA9IHJlbmRlckFjdGlvbkNvdW50O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWxsb2NhdGUgbGlnaHQgY2x1c3RlcmVzIGlmIGxpZ2h0cyBvciBtZXNoZXMgb3IgY2FtZXJhcyBhcmUgbW9kaWZpZWRcbiAgICAgICAgaWYgKHJlc3VsdCAmIChDT01QVVBEQVRFRF9DQU1FUkFTIHwgQ09NUFVQREFURURfTElHSFRTIHwgQ09NUFVQREFURURfSU5TVEFOQ0VTKSkge1xuXG4gICAgICAgICAgICAvLyBwcmVwYXJlIGNsdXN0ZXJlZCBsaWdodGluZyBmb3IgcmVuZGVyIGFjdGlvbnNcbiAgICAgICAgICAgIGlmIChjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFsbG9jYXRlTGlnaHRDbHVzdGVycyhkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlc3VsdCAmIChDT01QVVBEQVRFRF9MSUdIVFMgfCBDT01QVVBEQVRFRF9MSUdIVFMpKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2dSZW5kZXJBY3Rpb25zKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHVwZGF0ZVNoYWRvd0Nhc3RlcnMoKSB7XG5cbiAgICAgICAgLy8gX2xpZ2h0Q29tcG9zaXRpb25EYXRhIGFscmVhZHkgaGFzIHRoZSByaWdodCBzaXplLCBqdXN0IGNsZWFuIHVwIHNoYWRvdyBjYXN0ZXJzXG4gICAgICAgIGNvbnN0IGxpZ2h0Q291bnQgPSB0aGlzLl9saWdodHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRDb21wb3NpdGlvbkRhdGFbaV0uY2xlYXJTaGFkb3dDYXN0ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3IgZWFjaCBsYXllclxuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbaV07XG5cbiAgICAgICAgICAgIC8vIGxheWVyIGNhbiBiZSBpbiB0aGUgbGlzdCB0d28gdGltZXMgKG9wYXF1ZSwgdHJhbnNwKSwgYWRkIGNhc3RlcnMgb25seSBvbmUgdGltZVxuICAgICAgICAgICAgaWYgKCF0ZW1wU2V0LmhhcyhsYXllcikpIHtcbiAgICAgICAgICAgICAgICB0ZW1wU2V0LmFkZChsYXllcik7XG5cbiAgICAgICAgICAgICAgICAvLyBmb3IgZWFjaCBsaWdodCBvZiBhIGxheWVyXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRzID0gbGF5ZXIuX2xpZ2h0cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxpZ2h0cy5sZW5ndGg7IGorKykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG9ubHkgbmVlZCBjYXN0ZXJzIHdoZW4gY2FzdGluZyBzaGFkb3dzXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodHNbal0uY2FzdFNoYWRvd3MpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmluZCBpdHMgaW5kZXggaW4gZ2xvYmFsIGxpZ2h0IGxpc3QsIGFuZCBnZXQgc2hhZG93IGNhc3RlcnMgZm9yIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodEluZGV4ID0gdGhpcy5fbGlnaHRzTWFwLmdldChsaWdodHNbal0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRDb21wRGF0YSA9IHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdW5pcXVlIG1lc2hlcyBmcm9tIHRoZSBsYXllciB0byBjYXN0ZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodENvbXBEYXRhLmFkZFNoYWRvd0Nhc3RlcnMobGF5ZXIuc2hhZG93Q2FzdGVycyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wU2V0LmNsZWFyKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlTGlnaHRzKCkge1xuXG4gICAgICAgIC8vIGJ1aWxkIGEgbGlzdCBhbmQgbWFwIG9mIGFsbCB1bmlxdWUgbGlnaHRzIGZyb20gYWxsIGxheWVyc1xuICAgICAgICB0aGlzLl9saWdodHMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fbGlnaHRzTWFwLmNsZWFyKCk7XG5cbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcblxuICAgICAgICAgICAgLy8gbGF5ZXIgY2FuIGJlIGluIHRoZSBsaXN0IHR3byB0aW1lcyAob3BhcXVlLCB0cmFuc3ApLCBwcm9jZXNzIGl0IG9ubHkgb25lIHRpbWVcbiAgICAgICAgICAgIGlmICghdGVtcFNldC5oYXMobGF5ZXIpKSB7XG4gICAgICAgICAgICAgICAgdGVtcFNldC5hZGQobGF5ZXIpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHRzID0gbGF5ZXIuX2xpZ2h0cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxpZ2h0cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tqXTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhZGQgbmV3IGxpZ2h0XG4gICAgICAgICAgICAgICAgICAgIGxldCBsaWdodEluZGV4ID0gdGhpcy5fbGlnaHRzTWFwLmdldChsaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodEluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0SW5kZXggPSB0aGlzLl9saWdodHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGlnaHRzTWFwLnNldChsaWdodCwgbGlnaHRJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9saWdodHMucHVzaChsaWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0aGUgbGlnaHQgaGFzIGNvbXBvc2l0aW9uIGRhdGEgYWxsb2NhdGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbGlnaHRDb21wRGF0YSA9IHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodENvbXBEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRDb21wRGF0YSA9IG5ldyBMaWdodENvbXBvc2l0aW9uRGF0YSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2xpZ2h0SW5kZXhdID0gbGlnaHRDb21wRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3BsaXQgbGF5ZXIgbGlnaHRzIGxpc3RzIGJ5IHR5cGVcbiAgICAgICAgICAgIHRoaXMuX3NwbGl0TGlnaHRzQXJyYXkobGF5ZXIpO1xuICAgICAgICAgICAgbGF5ZXIuX2RpcnR5TGlnaHRzID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0ZW1wU2V0LmNsZWFyKCk7XG5cbiAgICAgICAgLy8gc3BsaXQgbGlnaHQgbGlzdCBieSB0eXBlXG4gICAgICAgIHRoaXMuX3NwbGl0TGlnaHRzQXJyYXkodGhpcyk7XG5cbiAgICAgICAgLy8gYWRqdXN0IF9saWdodENvbXBvc2l0aW9uRGF0YSB0byB0aGUgcmlnaHQgc2l6ZSwgbWF0Y2hpbmcgbnVtYmVyIG9mIGxpZ2h0c1xuICAgICAgICBjb25zdCBsaWdodENvdW50ID0gdGhpcy5fbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fbGlnaHRDb21wb3NpdGlvbkRhdGEubGVuZ3RoID0gbGlnaHRDb3VudDtcbiAgICB9XG5cbiAgICAvLyBmaW5kIGV4aXN0aW5nIGxpZ2h0IGNsdXN0ZXIgdGhhdCBpcyBjb21wYXRpYmxlIHdpdGggc3BlY2lmaWVkIGxheWVyXG4gICAgZmluZENvbXBhdGlibGVDbHVzdGVyKGxheWVyLCByZW5kZXJBY3Rpb25Db3VudCwgZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgLy8gY2hlY2sgYWxyZWFkeSBzZXQgdXAgcmVuZGVyIGFjdGlvbnNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW5kZXJBY3Rpb25Db3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByYSA9IHRoaXMuX3JlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCByYUxheWVyID0gdGhpcy5sYXllckxpc3RbcmEubGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIC8vIG9ubHkgcmV1c2UgY2x1c3RlcnMgaWYgbm90IGVtcHR5XG4gICAgICAgICAgICBpZiAocmEubGlnaHRDbHVzdGVycyAhPT0gZW1wdHlXb3JsZENsdXN0ZXJzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBsYXllciBpcyB0aGUgc2FtZSAoYnV0IGRpZmZlcmVudCBzdWJsYXllciksIGNsdXN0ZXIgY2FuIGJlIHVzZWQgZGlyZWN0bHkgYXMgbGlnaHRzIGFyZSB0aGUgc2FtZVxuICAgICAgICAgICAgICAgIGlmIChsYXllciA9PT0gcmFMYXllcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmEubGlnaHRDbHVzdGVycztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocmEubGlnaHRDbHVzdGVycykge1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgbGF5ZXIgaGFzIGV4YWN0bHkgdGhlIHNhbWUgc2V0IG9mIGxpZ2h0cywgdXNlIHRoZSBzYW1lIGNsdXN0ZXJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNldC5lcXVhbHMobGF5ZXIuX2NsdXN0ZXJlZExpZ2h0c1NldCwgcmFMYXllci5fY2x1c3RlcmVkTGlnaHRzU2V0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJhLmxpZ2h0Q2x1c3RlcnM7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBubyBtYXRjaFxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBhc3NpZ24gbGlnaHQgY2x1c3RlcnMgdG8gcmVuZGVyIGFjdGlvbnMgdGhhdCBuZWVkIGl0XG4gICAgYWxsb2NhdGVMaWdodENsdXN0ZXJzKGRldmljZSkge1xuXG4gICAgICAgIC8vIHJldXNlIHByZXZpb3VzbHkgYWxsb2NhdGVkIGNsdXN0ZXJzXG4gICAgICAgIHRlbXBDbHVzdGVyQXJyYXkucHVzaCguLi50aGlzLl93b3JsZENsdXN0ZXJzKTtcblxuICAgICAgICAvLyB0aGUgY2x1c3RlciB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICBjb25zdCBlbXB0eVdvcmxkQ2x1c3RlcnMgPSB0aGlzLmdldEVtcHR5V29ybGRDbHVzdGVycyhkZXZpY2UpO1xuXG4gICAgICAgIC8vIHN0YXJ0IHdpdGggbm8gY2x1c3RlcnNcbiAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vIHByb2Nlc3MgYWxsIHJlbmRlciBhY3Rpb25zXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fcmVuZGVyQWN0aW9ucy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtyYS5sYXllckluZGV4XTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIGxheWVyIGhhcyBsaWdodHMgdXNlZCBieSBjbHVzdGVyc1xuICAgICAgICAgICAgaWYgKGxheWVyLmhhc0NsdXN0ZXJlZExpZ2h0cykge1xuXG4gICAgICAgICAgICAgICAgLy8gYW5kIGlmIHRoZSBsYXllciBoYXMgbWVzaGVzXG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSB0aGlzLnN1YkxheWVyTGlzdFtyYS5sYXllckluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdHJhbnNwYXJlbnQgPyBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgOiBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2VzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJldXNlIGNsdXN0ZXIgdGhhdCB3YXMgYWxyZWFkeSBzZXQgdXAgYW5kIGlzIGNvbXBhdGlibGVcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNsdXN0ZXJzID0gdGhpcy5maW5kQ29tcGF0aWJsZUNsdXN0ZXIobGF5ZXIsIGksIGVtcHR5V29ybGRDbHVzdGVycyk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY2x1c3RlcnMpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdXNlIGFscmVhZHkgYWxsb2NhdGVkIGNsdXN0ZXIgZnJvbSBiZWZvcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0ZW1wQ2x1c3RlckFycmF5Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJzID0gdGVtcENsdXN0ZXJBcnJheS5wb3AoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIG5ldyBjbHVzdGVyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNsdXN0ZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlcnMgPSBuZXcgV29ybGRDbHVzdGVycyhkZXZpY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVycy5uYW1lID0gJ0NsdXN0ZXItJyArIHRoaXMuX3dvcmxkQ2x1c3RlcnMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycy5wdXNoKGNsdXN0ZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJhLmxpZ2h0Q2x1c3RlcnMgPSBjbHVzdGVycztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG5vIGNsdXN0ZXJlZCBsaWdodHMsIHVzZSB0aGUgY2x1c3RlciB3aXRoIG5vIGxpZ2h0c1xuICAgICAgICAgICAgaWYgKCFyYS5saWdodENsdXN0ZXJzKSB7XG4gICAgICAgICAgICAgICAgcmEubGlnaHRDbHVzdGVycyA9IGVtcHR5V29ybGRDbHVzdGVycztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBsZWZ0b3ZlcnNcbiAgICAgICAgdGVtcENsdXN0ZXJBcnJheS5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgICAgICBpdGVtLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRlbXBDbHVzdGVyQXJyYXkubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBhZGRzIG5ldyByZW5kZXIgYWN0aW9uIHRvIGEgbGlzdCwgd2hpbGUgdHJ5aW5nIHRvIGxpbWl0IGFsbG9jYXRpb24gYW5kIHJldXNlIGFscmVhZHkgYWxsb2NhdGVkIG9iamVjdHNcbiAgICBhZGRSZW5kZXJBY3Rpb24ocmVuZGVyQWN0aW9ucywgcmVuZGVyQWN0aW9uSW5kZXgsIGxheWVyLCBsYXllckluZGV4LCBjYW1lcmFJbmRleCwgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24sIHBvc3RQcm9jZXNzTWFya2VkKSB7XG5cbiAgICAgICAgLy8gdHJ5IGFuZCByZXVzZSBvYmplY3QsIG90aGVyd2lzZSBhbGxvY2F0ZSBuZXdcbiAgICAgICAgLyoqIEB0eXBlIHtSZW5kZXJBY3Rpb259ICovXG4gICAgICAgIGxldCByZW5kZXJBY3Rpb24gPSByZW5kZXJBY3Rpb25zW3JlbmRlckFjdGlvbkluZGV4XTtcbiAgICAgICAgaWYgKCFyZW5kZXJBY3Rpb24pIHtcbiAgICAgICAgICAgIHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbcmVuZGVyQWN0aW9uSW5kZXhdID0gbmV3IFJlbmRlckFjdGlvbigpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVuZGVyIHRhcmdldCBmcm9tIHRoZSBjYW1lcmEgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHRoZSByZW5kZXIgdGFyZ2V0IGZyb20gdGhlIGxheWVyXG4gICAgICAgIGxldCBydCA9IGxheWVyLnJlbmRlclRhcmdldDtcbiAgICAgICAgLyoqIEB0eXBlIHtDYW1lcmFDb21wb25lbnR9ICovXG4gICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbY2FtZXJhSW5kZXhdO1xuICAgICAgICBpZiAoY2FtZXJhICYmIGNhbWVyYS5yZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgIGlmIChsYXllci5pZCAhPT0gTEFZRVJJRF9ERVBUSCkgeyAgIC8vIGlnbm9yZSBkZXB0aCBsYXllclxuICAgICAgICAgICAgICAgIHJ0ID0gY2FtZXJhLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHdhcyBjYW1lcmEgYW5kIHJlbmRlciB0YXJnZXQgY29tYm8gdXNlZCBhbHJlYWR5XG4gICAgICAgIGxldCB1c2VkID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGkgPSByZW5kZXJBY3Rpb25JbmRleCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBpZiAocmVuZGVyQWN0aW9uc1tpXS5jYW1lcmEgPT09IGNhbWVyYSAmJiByZW5kZXJBY3Rpb25zW2ldLnJlbmRlclRhcmdldCA9PT0gcnQpIHtcbiAgICAgICAgICAgICAgICB1c2VkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIGZsYWdzIC0gdXNlIGNhbWVyYSBjbGVhciBmbGFncyBpbiB0aGUgZmlyc3QgcmVuZGVyIGFjdGlvbiBmb3IgZWFjaCBjYW1lcmEsXG4gICAgICAgIC8vIG9yIHdoZW4gcmVuZGVyIHRhcmdldCAoZnJvbSBsYXllcikgd2FzIG5vdCB5ZXQgY2xlYXJlZCBieSB0aGlzIGNhbWVyYVxuICAgICAgICBjb25zdCBuZWVkc0NsZWFyID0gY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24gfHwgIXVzZWQ7XG4gICAgICAgIGxldCBjbGVhckNvbG9yID0gbmVlZHNDbGVhciA/IGNhbWVyYS5jbGVhckNvbG9yQnVmZmVyIDogZmFsc2U7XG4gICAgICAgIGxldCBjbGVhckRlcHRoID0gbmVlZHNDbGVhciA/IGNhbWVyYS5jbGVhckRlcHRoQnVmZmVyIDogZmFsc2U7XG4gICAgICAgIGxldCBjbGVhclN0ZW5jaWwgPSBuZWVkc0NsZWFyID8gY2FtZXJhLmNsZWFyU3RlbmNpbEJ1ZmZlciA6IGZhbHNlO1xuXG4gICAgICAgIC8vIGNsZWFyIGJ1ZmZlcnMgaWYgcmVxdWVzdGVkIGJ5IHRoZSBsYXllclxuICAgICAgICBjbGVhckNvbG9yIHx8PSBsYXllci5jbGVhckNvbG9yQnVmZmVyO1xuICAgICAgICBjbGVhckRlcHRoIHx8PSBsYXllci5jbGVhckRlcHRoQnVmZmVyO1xuICAgICAgICBjbGVhclN0ZW5jaWwgfHw9IGxheWVyLmNsZWFyU3RlbmNpbEJ1ZmZlcjtcblxuICAgICAgICAvLyBmb3IgY2FtZXJhcyB3aXRoIHBvc3QgcHJvY2Vzc2luZyBlbmFibGVkLCBvbiBsYXllcnMgYWZ0ZXIgcG9zdCBwcm9jZXNzaW5nIGhhcyBiZWVuIGFwcGxpZWQgYWxyZWFkeSAoc28gVUkgYW5kIHNpbWlsYXIpLFxuICAgICAgICAvLyBkb24ndCByZW5kZXIgdGhlbSB0byByZW5kZXIgdGFyZ2V0IGFueW1vcmVcbiAgICAgICAgaWYgKHBvc3RQcm9jZXNzTWFya2VkICYmIGNhbWVyYS5wb3N0RWZmZWN0c0VuYWJsZWQpIHtcbiAgICAgICAgICAgIHJ0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0b3JlIHRoZSBwcm9wZXJ0aWVzIC0gd3JpdGUgYWxsIGFzIHdlIHJldXNlIHByZXZpb3VzbHkgYWxsb2NhdGVkIGNsYXNzIGluc3RhbmNlc1xuICAgICAgICByZW5kZXJBY3Rpb24ucmVzZXQoKTtcbiAgICAgICAgcmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyA9IGZhbHNlO1xuICAgICAgICByZW5kZXJBY3Rpb24ubGF5ZXJJbmRleCA9IGxheWVySW5kZXg7XG4gICAgICAgIHJlbmRlckFjdGlvbi5jYW1lcmFJbmRleCA9IGNhbWVyYUluZGV4O1xuICAgICAgICByZW5kZXJBY3Rpb24uY2FtZXJhID0gY2FtZXJhO1xuICAgICAgICByZW5kZXJBY3Rpb24ucmVuZGVyVGFyZ2V0ID0gcnQ7XG4gICAgICAgIHJlbmRlckFjdGlvbi5jbGVhckNvbG9yID0gY2xlYXJDb2xvcjtcbiAgICAgICAgcmVuZGVyQWN0aW9uLmNsZWFyRGVwdGggPSBjbGVhckRlcHRoO1xuICAgICAgICByZW5kZXJBY3Rpb24uY2xlYXJTdGVuY2lsID0gY2xlYXJTdGVuY2lsO1xuICAgICAgICByZW5kZXJBY3Rpb24uZmlyc3RDYW1lcmFVc2UgPSBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbjtcbiAgICAgICAgcmVuZGVyQWN0aW9uLmxhc3RDYW1lcmFVc2UgPSBmYWxzZTtcblxuICAgICAgICByZXR1cm4gcmVuZGVyQWN0aW9uO1xuICAgIH1cblxuICAgIC8vIGV4ZWN1dGVzIHdoZW4gcG9zdC1wcm9jZXNzaW5nIGNhbWVyYSdzIHJlbmRlciBhY3Rpb25zIHdlcmUgY3JlYXRlZCB0byBwcm9wYWdhdGUgcmVuZGVyaW5nIHRvXG4gICAgLy8gcmVuZGVyIHRhcmdldHMgdG8gcHJldmlvdXMgY2FtZXJhIGFzIG5lZWRlZFxuICAgIHByb3BhZ2F0ZVJlbmRlclRhcmdldChzdGFydEluZGV4LCBmcm9tQ2FtZXJhKSB7XG5cbiAgICAgICAgZm9yIChsZXQgYSA9IHN0YXJ0SW5kZXg7IGEgPj0gMDsgYS0tKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHJhID0gdGhpcy5fcmVuZGVyQWN0aW9uc1thXTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbcmEubGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIC8vIGlmIHdlIGhpdCByZW5kZXIgYWN0aW9uIHdpdGggYSByZW5kZXIgdGFyZ2V0IChvdGhlciB0aGFuIGRlcHRoIGxheWVyKSwgdGhhdCBtYXJrcyB0aGUgZW5kIG9mIGNhbWVyYSBzdGFja1xuICAgICAgICAgICAgLy8gVE9ETzogcmVmYWN0b3IgdGhpcyBhcyBwYXJ0IG9mIGRlcHRoIGxheWVyIHJlZmFjdG9yaW5nXG4gICAgICAgICAgICBpZiAocmEucmVuZGVyVGFyZ2V0ICYmIGxheWVyLmlkICE9PSBMQVlFUklEX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNraXAgb3ZlciBkZXB0aCBsYXllclxuICAgICAgICAgICAgaWYgKGxheWVyLmlkID09PSBMQVlFUklEX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNhbWVyYSBzdGFjayBlbmRzIHdoZW4gdmlld3BvcnQgb3Igc2Npc3NvciBvZiB0aGUgY2FtZXJhIGNoYW5nZXNcbiAgICAgICAgICAgIGNvbnN0IHRoaXNDYW1lcmEgPSByYT8uY2FtZXJhLmNhbWVyYTtcbiAgICAgICAgICAgIGlmICh0aGlzQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFmcm9tQ2FtZXJhLmNhbWVyYS5yZWN0LmVxdWFscyh0aGlzQ2FtZXJhLnJlY3QpIHx8ICFmcm9tQ2FtZXJhLmNhbWVyYS5zY2lzc29yUmVjdC5lcXVhbHModGhpc0NhbWVyYS5zY2lzc29yUmVjdCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZW5kZXIgaXQgdG8gcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgcmEucmVuZGVyVGFyZ2V0ID0gZnJvbUNhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBsb2dzIHJlbmRlciBhY3Rpb24gYW5kIHRoZWlyIHByb3BlcnRpZXNcbiAgICBfbG9nUmVuZGVyQWN0aW9ucygpIHtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmIChUcmFjaW5nLmdldChUUkFDRUlEX1JFTkRFUl9BQ1RJT04pKSB7XG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9BQ1RJT04sICdSZW5kZXIgQWN0aW9ucyBmb3IgY29tcG9zaXRpb246ICcgKyB0aGlzLm5hbWUpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9yZW5kZXJBY3Rpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVySW5kZXggPSByYS5sYXllckluZGV4O1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbbGF5ZXJJbmRleF07XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IGxheWVyLmVuYWJsZWQgJiYgdGhpcy5zdWJMYXllckVuYWJsZWRbbGF5ZXJJbmRleF07XG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSB0aGlzLnN1YkxheWVyTGlzdFtsYXllckluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBsYXllci5jYW1lcmFzW3JhLmNhbWVyYUluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBkaXJMaWdodENvdW50ID0gcmEuZGlyZWN0aW9uYWxMaWdodHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNsZWFyID0gKHJhLmNsZWFyQ29sb3IgPyAnQ29sb3IgJyA6ICcuLi4uLiAnKSArIChyYS5jbGVhckRlcHRoID8gJ0RlcHRoICcgOiAnLi4uLi4gJykgKyAocmEuY2xlYXJTdGVuY2lsID8gJ1N0ZW5jaWwnIDogJy4uLi4uLi4nKTtcblxuICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0FDVElPTiwgaSArXG4gICAgICAgICAgICAgICAgICAgICgnIENhbTogJyArIChjYW1lcmEgPyBjYW1lcmEuZW50aXR5Lm5hbWUgOiAnLScpKS5wYWRFbmQoMjIsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAoJyBMYXk6ICcgKyBsYXllci5uYW1lKS5wYWRFbmQoMjIsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAodHJhbnNwYXJlbnQgPyAnIFRSQU5TUCcgOiAnIE9QQVFVRScpICtcbiAgICAgICAgICAgICAgICAgICAgKGVuYWJsZWQgPyAnIEVOQUJMRUQgJyA6ICcgRElTQUJMRUQnKSArXG4gICAgICAgICAgICAgICAgICAgICcgTWVzaGVzOiAnLCAodHJhbnNwYXJlbnQgPyBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMubGVuZ3RoIDogbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcy5sZW5ndGgpLnRvU3RyaW5nKCkucGFkU3RhcnQoNCkgK1xuICAgICAgICAgICAgICAgICAgICAoJyBSVDogJyArIChyYS5yZW5kZXJUYXJnZXQgPyByYS5yZW5kZXJUYXJnZXQubmFtZSA6ICctJykpLnBhZEVuZCgzMCwgJyAnKSArXG4gICAgICAgICAgICAgICAgICAgICcgQ2xlYXI6ICcgKyBjbGVhciArXG4gICAgICAgICAgICAgICAgICAgICcgTGlnaHRzOiAoJyArIGxheWVyLl9jbHVzdGVyZWRMaWdodHNTZXQuc2l6ZSArICcvJyArIGxheWVyLl9saWdodHNTZXQuc2l6ZSArICcpJyArXG4gICAgICAgICAgICAgICAgICAgICcgJyArIChyYS5saWdodENsdXN0ZXJzICE9PSB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMgPyAocmEubGlnaHRDbHVzdGVycy5uYW1lKSA6ICcnKS5wYWRFbmQoMTAsICcgJykgK1xuICAgICAgICAgICAgICAgICAgICAocmEuZmlyc3RDYW1lcmFVc2UgPyAnIENBTS1GSVJTVCcgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgICAocmEubGFzdENhbWVyYVVzZSA/ICcgQ0FNLUxBU1QnIDogJycpICtcbiAgICAgICAgICAgICAgICAgICAgKHJhLnRyaWdnZXJQb3N0cHJvY2VzcyA/ICcgUE9TVFBST0NFU1MnIDogJycpICtcbiAgICAgICAgICAgICAgICAgICAgKGRpckxpZ2h0Q291bnQgPyAoJyBEaXJMaWdodHM6ICcgKyBkaXJMaWdodENvdW50KSA6ICcnKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgX2lzTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBpZiAodGhpcy5sYXllckxpc3QuaW5kZXhPZihsYXllcikgPj0gMCkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0xheWVyIGlzIGFscmVhZHkgYWRkZWQuJyk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2lzU3VibGF5ZXJBZGRlZChsYXllciwgdHJhbnNwYXJlbnQpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMubGF5ZXJMaXN0W2ldID09PSBsYXllciAmJiB0aGlzLnN1YkxheWVyTGlzdFtpXSA9PT0gdHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcignU3VibGF5ZXIgaXMgYWxyZWFkeSBhZGRlZC4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gV2hvbGUgbGF5ZXIgQVBJXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbGF5ZXIgKGJvdGggb3BhcXVlIGFuZCBzZW1pLXRyYW5zcGFyZW50IHBhcnRzKSB0byB0aGUgZW5kIG9mIHRoZSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKi9cbiAgICBwdXNoKGxheWVyKSB7XG4gICAgICAgIC8vIGFkZCBib3RoIG9wYXF1ZSBhbmQgdHJhbnNwYXJlbnQgdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXlcbiAgICAgICAgaWYgKHRoaXMuX2lzTGF5ZXJBZGRlZChsYXllcikpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3QucHVzaChsYXllcik7XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnB1c2gobGF5ZXIpO1xuICAgICAgICB0aGlzLl9vcGFxdWVPcmRlcltsYXllci5pZF0gPSB0aGlzLnN1YkxheWVyTGlzdC5wdXNoKGZhbHNlKSAtIDE7XG4gICAgICAgIHRoaXMuX3RyYW5zcGFyZW50T3JkZXJbbGF5ZXIuaWRdID0gdGhpcy5zdWJMYXllckxpc3QucHVzaCh0cnVlKSAtIDE7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIGEgbGF5ZXIgKGJvdGggb3BhcXVlIGFuZCBzZW1pLXRyYW5zcGFyZW50IHBhcnRzKSBhdCB0aGUgY2hvc2VuIGluZGV4IGluIHRoZVxuICAgICAqIHtAbGluayBMYXllciNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtMYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluc2VydGlvbiBwb3NpdGlvbi5cbiAgICAgKi9cbiAgICBpbnNlcnQobGF5ZXIsIGluZGV4KSB7XG4gICAgICAgIC8vIGluc2VydCBib3RoIG9wYXF1ZSBhbmQgdHJhbnNwYXJlbnQgYXQgdGhlIGluZGV4XG4gICAgICAgIGlmICh0aGlzLl9pc0xheWVyQWRkZWQobGF5ZXIpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnNwbGljZShpbmRleCwgMCwgbGF5ZXIsIGxheWVyKTtcbiAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCBmYWxzZSwgdHJ1ZSk7XG5cbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU9wYXF1ZU9yZGVyKGluZGV4LCBjb3VudCAtIDEpO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc3BhcmVudE9yZGVyKGluZGV4LCBjb3VudCAtIDEpO1xuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaW5kZXgsIDAsIHRydWUsIHRydWUpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGxheWVyIChib3RoIG9wYXF1ZSBhbmQgc2VtaS10cmFuc3BhcmVudCBwYXJ0cykgZnJvbSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICByZW1vdmUobGF5ZXIpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGFsbCBvY2N1cnJlbmNlcyBvZiBhIGxheWVyXG4gICAgICAgIGxldCBpZCA9IHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIpO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9vcGFxdWVPcmRlcltpZF07XG4gICAgICAgIGRlbGV0ZSB0aGlzLl90cmFuc3BhcmVudE9yZGVyW2lkXTtcblxuICAgICAgICB3aGlsZSAoaWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGlkLCAxKTtcbiAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpZCwgMSk7XG4gICAgICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaWQsIDEpO1xuICAgICAgICAgICAgaWQgPSB0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGxheWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBib3RoIG9yZGVyc1xuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdXBkYXRlT3BhcXVlT3JkZXIoMCwgY291bnQgLSAxKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNwYXJlbnRPcmRlcigwLCBjb3VudCAtIDEpO1xuICAgIH1cblxuICAgIC8vIFN1YmxheWVyIEFQSVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBwYXJ0IG9mIHRoZSBsYXllciB3aXRoIG9wYXF1ZSAobm9uIHNlbWktdHJhbnNwYXJlbnQpIG9iamVjdHMgdG8gdGhlIGVuZCBvZiB0aGVcbiAgICAgKiB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKi9cbiAgICBwdXNoT3BhcXVlKGxheWVyKSB7XG4gICAgICAgIC8vIGFkZCBvcGFxdWUgdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXlcbiAgICAgICAgaWYgKHRoaXMuX2lzU3VibGF5ZXJBZGRlZChsYXllciwgZmFsc2UpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnB1c2gobGF5ZXIpO1xuICAgICAgICB0aGlzLl9vcGFxdWVPcmRlcltsYXllci5pZF0gPSB0aGlzLnN1YkxheWVyTGlzdC5wdXNoKGZhbHNlKSAtIDE7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIGFuIG9wYXF1ZSBwYXJ0IG9mIHRoZSBsYXllciAobm9uIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMpIGF0IHRoZSBjaG9zZW5cbiAgICAgKiBpbmRleCBpbiB0aGUge0BsaW5rIExheWVyI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBhZGQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gSW5zZXJ0aW9uIHBvc2l0aW9uLlxuICAgICAqL1xuICAgIGluc2VydE9wYXF1ZShsYXllciwgaW5kZXgpIHtcbiAgICAgICAgLy8gaW5zZXJ0IG9wYXF1ZSBhdCBpbmRleFxuICAgICAgICBpZiAodGhpcy5faXNTdWJsYXllckFkZGVkKGxheWVyLCBmYWxzZSkpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCBsYXllcik7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpbmRleCwgMCwgZmFsc2UpO1xuXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5zdWJMYXllckxpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLl91cGRhdGVPcGFxdWVPcmRlcihpbmRleCwgY291bnQgLSAxKTtcblxuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaW5kZXgsIDAsIHRydWUpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbiBvcGFxdWUgcGFydCBvZiB0aGUgbGF5ZXIgKG5vbiBzZW1pLXRyYW5zcGFyZW50IG1lc2ggaW5zdGFuY2VzKSBmcm9tXG4gICAgICoge0BsaW5rIExheWVyI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlT3BhcXVlKGxheWVyKSB7XG4gICAgICAgIC8vIHJlbW92ZSBvcGFxdWUgb2NjdXJyZW5jZXMgb2YgYSBsYXllclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5sYXllckxpc3QubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdFtpXSA9PT0gbGF5ZXIgJiYgIXRoaXMuc3ViTGF5ZXJMaXN0W2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgIGxlbi0tO1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU9wYXF1ZU9yZGVyKGksIGxlbiAtIDEpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3QuaW5kZXhPZihsYXllcikgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJywgbGF5ZXIpOyAvLyBubyBzdWJsYXllcnMgbGVmdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHBhcnQgb2YgdGhlIGxheWVyIHdpdGggc2VtaS10cmFuc3BhcmVudCBvYmplY3RzIHRvIHRoZSBlbmQgb2YgdGhlIHtAbGluayBMYXllciNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtMYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqL1xuICAgIHB1c2hUcmFuc3BhcmVudChsYXllcikge1xuICAgICAgICAvLyBhZGQgdHJhbnNwYXJlbnQgdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXlcbiAgICAgICAgaWYgKHRoaXMuX2lzU3VibGF5ZXJBZGRlZChsYXllciwgdHJ1ZSkpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3QucHVzaChsYXllcik7XG4gICAgICAgIHRoaXMuX3RyYW5zcGFyZW50T3JkZXJbbGF5ZXIuaWRdID0gdGhpcy5zdWJMYXllckxpc3QucHVzaCh0cnVlKSAtIDE7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnB1c2godHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIGEgc2VtaS10cmFuc3BhcmVudCBwYXJ0IG9mIHRoZSBsYXllciBhdCB0aGUgY2hvc2VuIGluZGV4IGluIHRoZSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBJbnNlcnRpb24gcG9zaXRpb24uXG4gICAgICovXG4gICAgaW5zZXJ0VHJhbnNwYXJlbnQobGF5ZXIsIGluZGV4KSB7XG4gICAgICAgIC8vIGluc2VydCB0cmFuc3BhcmVudCBhdCBpbmRleFxuICAgICAgICBpZiAodGhpcy5faXNTdWJsYXllckFkZGVkKGxheWVyLCB0cnVlKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIGxheWVyKTtcbiAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCB0cnVlKTtcblxuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMuc3ViTGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNwYXJlbnRPcmRlcihpbmRleCwgY291bnQgLSAxKTtcblxuICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaW5kZXgsIDAsIHRydWUpO1xuICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIHRyYW5zcGFyZW50IHBhcnQgb2YgdGhlIGxheWVyIGZyb20ge0BsaW5rIExheWVyI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlVHJhbnNwYXJlbnQobGF5ZXIpIHtcbiAgICAgICAgLy8gcmVtb3ZlIHRyYW5zcGFyZW50IG9jY3VycmVuY2VzIG9mIGEgbGF5ZXJcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0gPT09IGxheWVyICYmIHRoaXMuc3ViTGF5ZXJMaXN0W2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJMaXN0LnNwbGljZShpLCAxKTtcblxuICAgICAgICAgICAgICAgIGxlbi0tO1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIoaSwgbGVuIC0gMSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmUnLCBsYXllcik7IC8vIG5vIHN1YmxheWVycyBsZWZ0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9nZXRTdWJsYXllckluZGV4KGxheWVyLCB0cmFuc3BhcmVudCkge1xuICAgICAgICAvLyBmaW5kIHN1YmxheWVyIGluZGV4IGluIHRoZSBjb21wb3NpdGlvbiBhcnJheVxuICAgICAgICBsZXQgaWQgPSB0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKTtcbiAgICAgICAgaWYgKGlkIDwgMCkgcmV0dXJuIC0xO1xuXG4gICAgICAgIGlmICh0aGlzLnN1YkxheWVyTGlzdFtpZF0gIT09IHRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICBpZCA9IHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIsIGlkICsgMSk7XG4gICAgICAgICAgICBpZiAoaWQgPCAwKSByZXR1cm4gLTE7XG4gICAgICAgICAgICBpZiAodGhpcy5zdWJMYXllckxpc3RbaWRdICE9PSB0cmFuc3BhcmVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBpbmRleCBvZiB0aGUgb3BhcXVlIHBhcnQgb2YgdGhlIHN1cHBsaWVkIGxheWVyIGluIHRoZSB7QGxpbmsgTGF5ZXIjbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGZpbmQgaW5kZXggb2YuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGluZGV4IG9mIHRoZSBvcGFxdWUgcGFydCBvZiB0aGUgc3BlY2lmaWVkIGxheWVyLlxuICAgICAqL1xuICAgIGdldE9wYXF1ZUluZGV4KGxheWVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTdWJsYXllckluZGV4KGxheWVyLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBpbmRleCBvZiB0aGUgc2VtaS10cmFuc3BhcmVudCBwYXJ0IG9mIHRoZSBzdXBwbGllZCBsYXllciBpbiB0aGUge0BsaW5rIExheWVyI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0xheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBmaW5kIGluZGV4IG9mLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBpbmRleCBvZiB0aGUgc2VtaS10cmFuc3BhcmVudCBwYXJ0IG9mIHRoZSBzcGVjaWZpZWQgbGF5ZXIuXG4gICAgICovXG4gICAgZ2V0VHJhbnNwYXJlbnRJbmRleChsYXllcikge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U3VibGF5ZXJJbmRleChsYXllciwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgYSBsYXllciBpbnNpZGUgdGhpcyBjb21wb3NpdGlvbiBieSBpdHMgSUQuIE51bGwgaXMgcmV0dXJuZWQsIGlmIG5vdGhpbmcgaXMgZm91bmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBBbiBJRCBvZiB0aGUgbGF5ZXIgdG8gZmluZC5cbiAgICAgKiBAcmV0dXJucyB7TGF5ZXJ8bnVsbH0gVGhlIGxheWVyIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNwZWNpZmllZCBJRC4gUmV0dXJucyBudWxsIGlmIGxheWVyIGlzXG4gICAgICogbm90IGZvdW5kLlxuICAgICAqL1xuICAgIGdldExheWVyQnlJZChpZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0uaWQgPT09IGlkKSByZXR1cm4gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgYSBsYXllciBpbnNpZGUgdGhpcyBjb21wb3NpdGlvbiBieSBpdHMgbmFtZS4gTnVsbCBpcyByZXR1cm5lZCwgaWYgbm90aGluZyBpcyBmb3VuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGxheWVyIHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge0xheWVyfG51bGx9IFRoZSBsYXllciBjb3JyZXNwb25kaW5nIHRvIHRoZSBzcGVjaWZpZWQgbmFtZS4gUmV0dXJucyBudWxsIGlmIGxheWVyXG4gICAgICogaXMgbm90IGZvdW5kLlxuICAgICAqL1xuICAgIGdldExheWVyQnlOYW1lKG5hbWUpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVyTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMubGF5ZXJMaXN0W2ldLm5hbWUgPT09IG5hbWUpIHJldHVybiB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBfdXBkYXRlT3BhcXVlT3JkZXIoc3RhcnRJbmRleCwgZW5kSW5kZXgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPD0gZW5kSW5kZXg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3ViTGF5ZXJMaXN0W2ldID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX29wYXF1ZU9yZGVyW3RoaXMubGF5ZXJMaXN0W2ldLmlkXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlVHJhbnNwYXJlbnRPcmRlcihzdGFydEluZGV4LCBlbmRJbmRleCkge1xuICAgICAgICBmb3IgKGxldCBpID0gc3RhcnRJbmRleDsgaSA8PSBlbmRJbmRleDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zdWJMYXllckxpc3RbaV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90cmFuc3BhcmVudE9yZGVyW3RoaXMubGF5ZXJMaXN0W2ldLmlkXSA9IGk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVc2VkIHRvIGRldGVybWluZSB3aGljaCBhcnJheSBvZiBsYXllcnMgaGFzIGFueSBzdWJsYXllciB0aGF0IGlzXG4gICAgLy8gb24gdG9wIG9mIGFsbCB0aGUgc3VibGF5ZXJzIGluIHRoZSBvdGhlciBhcnJheS4gVGhlIG9yZGVyIGlzIGEgZGljdGlvbmFyeVxuICAgIC8vIG9mIDxsYXllcklkLCBpbmRleD4uXG4gICAgX3NvcnRMYXllcnNEZXNjZW5kaW5nKGxheWVyc0EsIGxheWVyc0IsIG9yZGVyKSB7XG4gICAgICAgIGxldCB0b3BMYXllckEgPSAtMTtcbiAgICAgICAgbGV0IHRvcExheWVyQiA9IC0xO1xuXG4gICAgICAgIC8vIHNlYXJjaCBmb3Igd2hpY2ggbGF5ZXIgaXMgb24gdG9wIGluIGxheWVyc0FcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxheWVyc0EubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gbGF5ZXJzQVtpXTtcbiAgICAgICAgICAgIGlmIChvcmRlci5oYXNPd25Qcm9wZXJ0eShpZCkpIHtcbiAgICAgICAgICAgICAgICB0b3BMYXllckEgPSBNYXRoLm1heCh0b3BMYXllckEsIG9yZGVyW2lkXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZWFyY2ggZm9yIHdoaWNoIGxheWVyIGlzIG9uIHRvcCBpbiBsYXllcnNCXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXllcnNCLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGxheWVyc0JbaV07XG4gICAgICAgICAgICBpZiAob3JkZXIuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgdG9wTGF5ZXJCID0gTWF0aC5tYXgodG9wTGF5ZXJCLCBvcmRlcltpZF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIGxheWVycyBvZiBsYXllcnNBIG9yIGxheWVyc0IgZG8gbm90IGV4aXN0IGF0IGFsbFxuICAgICAgICAvLyBpbiB0aGUgY29tcG9zaXRpb24gdGhlbiByZXR1cm4gZWFybHkgd2l0aCB0aGUgb3RoZXIuXG4gICAgICAgIGlmICh0b3BMYXllckEgPT09IC0xICYmIHRvcExheWVyQiAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9IGVsc2UgaWYgKHRvcExheWVyQiA9PT0gLTEgJiYgdG9wTGF5ZXJBICE9PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc29ydCBpbiBkZXNjZW5kaW5nIG9yZGVyIHNpbmNlIHdlIHdhbnRcbiAgICAgICAgLy8gdGhlIGhpZ2hlciBvcmRlciB0byBiZSBmaXJzdFxuICAgICAgICByZXR1cm4gdG9wTGF5ZXJCIC0gdG9wTGF5ZXJBO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVzZWQgdG8gZGV0ZXJtaW5lIHdoaWNoIGFycmF5IG9mIGxheWVycyBoYXMgYW55IHRyYW5zcGFyZW50IHN1YmxheWVyIHRoYXQgaXMgb24gdG9wIG9mIGFsbFxuICAgICAqIHRoZSB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gdGhlIG90aGVyIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQSAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQiAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBhIG5lZ2F0aXZlIG51bWJlciBpZiBhbnkgb2YgdGhlIHRyYW5zcGFyZW50IHN1YmxheWVycyBpbiBsYXllcnNBXG4gICAgICogaXMgb24gdG9wIG9mIGFsbCB0aGUgdHJhbnNwYXJlbnQgc3VibGF5ZXJzIGluIGxheWVyc0IsIG9yIGEgcG9zaXRpdmUgbnVtYmVyIGlmIGFueSBvZiB0aGVcbiAgICAgKiB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gbGF5ZXJzQiBpcyBvbiB0b3Agb2YgYWxsIHRoZSB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gbGF5ZXJzQSwgb3IgMFxuICAgICAqIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHNvcnRUcmFuc3BhcmVudExheWVycyhsYXllcnNBLCBsYXllcnNCKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3J0TGF5ZXJzRGVzY2VuZGluZyhsYXllcnNBLCBsYXllcnNCLCB0aGlzLl90cmFuc3BhcmVudE9yZGVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGRldGVybWluZSB3aGljaCBhcnJheSBvZiBsYXllcnMgaGFzIGFueSBvcGFxdWUgc3VibGF5ZXIgdGhhdCBpcyBvbiB0b3Agb2YgYWxsIHRoZVxuICAgICAqIG9wYXF1ZSBzdWJsYXllcnMgaW4gdGhlIG90aGVyIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQSAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbGF5ZXJzQiAtIElEcyBvZiBsYXllcnMuXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBhIG5lZ2F0aXZlIG51bWJlciBpZiBhbnkgb2YgdGhlIG9wYXF1ZSBzdWJsYXllcnMgaW4gbGF5ZXJzQSBpcyBvblxuICAgICAqIHRvcCBvZiBhbGwgdGhlIG9wYXF1ZSBzdWJsYXllcnMgaW4gbGF5ZXJzQiwgb3IgYSBwb3NpdGl2ZSBudW1iZXIgaWYgYW55IG9mIHRoZSBvcGFxdWVcbiAgICAgKiBzdWJsYXllcnMgaW4gbGF5ZXJzQiBpcyBvbiB0b3Agb2YgYWxsIHRoZSBvcGFxdWUgc3VibGF5ZXJzIGluIGxheWVyc0EsIG9yIDAgb3RoZXJ3aXNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgc29ydE9wYXF1ZUxheWVycyhsYXllcnNBLCBsYXllcnNCKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3J0TGF5ZXJzRGVzY2VuZGluZyhsYXllcnNBLCBsYXllcnNCLCB0aGlzLl9vcGFxdWVPcmRlcik7XG4gICAgfVxufVxuXG5leHBvcnQgeyBMYXllckNvbXBvc2l0aW9uIH07XG4iXSwibmFtZXMiOlsidGVtcFNldCIsIlNldCIsInRlbXBDbHVzdGVyQXJyYXkiLCJMYXllckNvbXBvc2l0aW9uIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJuYW1lIiwibGF5ZXJMaXN0Iiwic3ViTGF5ZXJMaXN0Iiwic3ViTGF5ZXJFbmFibGVkIiwiX29wYXF1ZU9yZGVyIiwiX3RyYW5zcGFyZW50T3JkZXIiLCJfZGlydHkiLCJfZGlydHlCbGVuZCIsIl9kaXJ0eUxpZ2h0cyIsIl9kaXJ0eUNhbWVyYXMiLCJfbWVzaEluc3RhbmNlcyIsIl9tZXNoSW5zdGFuY2VzU2V0IiwiX2xpZ2h0cyIsIl9saWdodHNNYXAiLCJNYXAiLCJfbGlnaHRDb21wb3NpdGlvbkRhdGEiLCJfc3BsaXRMaWdodHMiLCJjYW1lcmFzIiwiX3JlbmRlckFjdGlvbnMiLCJfd29ybGRDbHVzdGVycyIsIl9lbXB0eVdvcmxkQ2x1c3RlcnMiLCJkZXN0cm95IiwiZm9yRWFjaCIsImNsdXN0ZXIiLCJyYSIsImdldEVtcHR5V29ybGRDbHVzdGVycyIsImRldmljZSIsIldvcmxkQ2x1c3RlcnMiLCJ1cGRhdGUiLCJfc3BsaXRMaWdodHNBcnJheSIsInRhcmdldCIsImxpZ2h0cyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsImxlbmd0aCIsIkxJR0hUVFlQRV9PTU5JIiwiTElHSFRUWVBFX1NQT1QiLCJpIiwibGlnaHQiLCJlbmFibGVkIiwiX3R5cGUiLCJwdXNoIiwiX3VwZGF0ZSIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImxlbiIsInJlc3VsdCIsImxheWVyIiwiYWRkVW5pcXVlTWVzaEluc3RhbmNlIiwiZGVzdEFycmF5IiwiZGVzdFNldCIsInNyY0FycmF5IiwiZGlydHlCbGVuZCIsInNyY0xlbiIsInMiLCJtZXNoSW5zdCIsImhhcyIsImFkZCIsIm1hdGVyaWFsIiwiQ09NUFVQREFURURfSU5TVEFOQ0VTIiwiY2xlYXIiLCJwYXNzVGhyb3VnaCIsIm9wYXF1ZU1lc2hJbnN0YW5jZXMiLCJ0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMiLCJtb3ZlQnlCbGVuZFR5cGUiLCJkZXN0Iiwic3JjIiwibW92ZVRyYW5zcGFyZW50IiwidHJhbnNwYXJlbnQiLCJDT01QVVBEQVRFRF9CTEVORCIsIkNPTVBVUERBVEVEX0xJR0hUUyIsInVwZGF0ZUxpZ2h0cyIsInVwZGF0ZVNoYWRvd0Nhc3RlcnMiLCJDT01QVVBEQVRFRF9DQU1FUkFTIiwiaiIsImNhbWVyYSIsImluZGV4IiwiaW5kZXhPZiIsInNvcnRQcmlvcml0eSIsImNhbWVyYUxheWVycyIsInJlbmRlckFjdGlvbkNvdW50IiwiY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24iLCJjYW1lcmFGaXJzdFJlbmRlckFjdGlvbkluZGV4IiwibGFzdFJlbmRlckFjdGlvbiIsInBvc3RQcm9jZXNzTWFya2VkIiwibGF5ZXJzIiwiaWQiLCJkaXNhYmxlUG9zdEVmZmVjdHNMYXllciIsInRyaWdnZXJQb3N0cHJvY2VzcyIsImNhbWVyYUluZGV4IiwiYWRkUmVuZGVyQWN0aW9uIiwiY29sbGVjdERpcmVjdGlvbmFsTGlnaHRzIiwibGFzdENhbWVyYVVzZSIsInJlbmRlclRhcmdldCIsInBvc3RFZmZlY3RzRW5hYmxlZCIsInByb3BhZ2F0ZVJlbmRlclRhcmdldCIsImFsbG9jYXRlTGlnaHRDbHVzdGVycyIsIl9sb2dSZW5kZXJBY3Rpb25zIiwibGlnaHRDb3VudCIsImNsZWFyU2hhZG93Q2FzdGVycyIsImNhc3RTaGFkb3dzIiwibGlnaHRJbmRleCIsImdldCIsImxpZ2h0Q29tcERhdGEiLCJhZGRTaGFkb3dDYXN0ZXJzIiwic2hhZG93Q2FzdGVycyIsImNvdW50IiwidW5kZWZpbmVkIiwic2V0IiwiTGlnaHRDb21wb3NpdGlvbkRhdGEiLCJmaW5kQ29tcGF0aWJsZUNsdXN0ZXIiLCJlbXB0eVdvcmxkQ2x1c3RlcnMiLCJyYUxheWVyIiwibGF5ZXJJbmRleCIsImxpZ2h0Q2x1c3RlcnMiLCJlcXVhbHMiLCJfY2x1c3RlcmVkTGlnaHRzU2V0IiwiaGFzQ2x1c3RlcmVkTGlnaHRzIiwibWVzaEluc3RhbmNlcyIsImNsdXN0ZXJzIiwicG9wIiwiaXRlbSIsInJlbmRlckFjdGlvbnMiLCJyZW5kZXJBY3Rpb25JbmRleCIsInJlbmRlckFjdGlvbiIsIlJlbmRlckFjdGlvbiIsInJ0IiwiTEFZRVJJRF9ERVBUSCIsInVzZWQiLCJuZWVkc0NsZWFyIiwiY2xlYXJDb2xvciIsImNsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckRlcHRoIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbCIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsInJlc2V0IiwiZmlyc3RDYW1lcmFVc2UiLCJzdGFydEluZGV4IiwiZnJvbUNhbWVyYSIsImEiLCJ0aGlzQ2FtZXJhIiwicmVjdCIsInNjaXNzb3JSZWN0IiwiVHJhY2luZyIsIlRSQUNFSURfUkVOREVSX0FDVElPTiIsIkRlYnVnIiwidHJhY2UiLCJkaXJMaWdodENvdW50IiwiZGlyZWN0aW9uYWxMaWdodHMiLCJlbnRpdHkiLCJwYWRFbmQiLCJ0b1N0cmluZyIsInBhZFN0YXJ0Iiwic2l6ZSIsIl9saWdodHNTZXQiLCJfaXNMYXllckFkZGVkIiwiZXJyb3IiLCJfaXNTdWJsYXllckFkZGVkIiwiZmlyZSIsImluc2VydCIsInNwbGljZSIsIl91cGRhdGVPcGFxdWVPcmRlciIsIl91cGRhdGVUcmFuc3BhcmVudE9yZGVyIiwicmVtb3ZlIiwicHVzaE9wYXF1ZSIsImluc2VydE9wYXF1ZSIsInJlbW92ZU9wYXF1ZSIsInB1c2hUcmFuc3BhcmVudCIsImluc2VydFRyYW5zcGFyZW50IiwicmVtb3ZlVHJhbnNwYXJlbnQiLCJfZ2V0U3VibGF5ZXJJbmRleCIsImdldE9wYXF1ZUluZGV4IiwiZ2V0VHJhbnNwYXJlbnRJbmRleCIsImdldExheWVyQnlJZCIsImdldExheWVyQnlOYW1lIiwiZW5kSW5kZXgiLCJfc29ydExheWVyc0Rlc2NlbmRpbmciLCJsYXllcnNBIiwibGF5ZXJzQiIsIm9yZGVyIiwidG9wTGF5ZXJBIiwidG9wTGF5ZXJCIiwiaGFzT3duUHJvcGVydHkiLCJNYXRoIiwibWF4Iiwic29ydFRyYW5zcGFyZW50TGF5ZXJzIiwic29ydE9wYXF1ZUxheWVycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQXFCQSxNQUFNQSxPQUFPLEdBQUcsSUFBSUMsR0FBSixFQUFoQixDQUFBO0FBQ0EsTUFBTUMsZ0JBQWdCLEdBQUcsRUFBekIsQ0FBQTs7QUFRQSxNQUFNQyxnQkFBTixTQUErQkMsWUFBL0IsQ0FBNEM7QUFTeENDLEVBQUFBLFdBQVcsQ0FBQ0MsSUFBSSxHQUFHLFVBQVIsRUFBb0I7QUFDM0IsSUFBQSxLQUFBLEVBQUEsQ0FBQTtJQUVBLElBQUtBLENBQUFBLElBQUwsR0FBWUEsSUFBWixDQUFBO0lBT0EsSUFBS0MsQ0FBQUEsU0FBTCxHQUFpQixFQUFqQixDQUFBO0lBUUEsSUFBS0MsQ0FBQUEsWUFBTCxHQUFv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
