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

/**
 * Layer Composition is a collection of {@link Layer} that is fed to {@link Scene#layers} to define
 * rendering order.
 *
 * @augments EventHandler
 */
class LayerComposition extends EventHandler {
  // Composition can hold only 2 sublayers of each layer

  /**
   * Create a new layer composition.
   *
   * @param {string} [name] - Optional non-unique name of the layer composition. Defaults to
   * "Untitled" if not specified.
   */
  constructor(name = 'Untitled') {
    super();
    this.name = name;

    /**
     * A read-only array of {@link Layer} sorted in the order they will be rendered.
     *
     * @type {import('../layer.js').Layer[]}
     */
    this.layerList = [];

    /**
     * A read-only array of boolean values, matching {@link LayerComposition#layerList}. True means only
     * semi-transparent objects are rendered, and false means opaque.
     *
     * @type {boolean[]}
     */
    this.subLayerList = [];

    /**
     * A read-only array of boolean values, matching {@link LayerComposition#layerList}. True means the
     * layer is rendered, false means it's skipped.
     *
     * @type {boolean[]}
     */
    this.subLayerEnabled = []; // more granular control on top of layer.enabled (ANDed)

    this._opaqueOrder = {};
    this._transparentOrder = {};
    this._dirty = false;
    this._dirtyBlend = false;
    this._dirtyLights = false;
    this._dirtyCameras = false;

    // all unique meshInstances from all layers, stored both as an array, and also a set for fast search
    this._meshInstances = [];
    this._meshInstancesSet = new Set();

    // an array of all unique lights from all layers
    this._lights = [];

    // a map of Light to index in _lights for fast lookup
    this._lightsMap = new Map();

    // each entry in _lights has entry of type LightCompositionData here at the same index,
    // storing shadow casters and additional composition related data for the light
    this._lightCompositionData = [];

    // _lights split into arrays per type of light, indexed by LIGHTTYPE_*** constants
    this._splitLights = [[], [], []];

    /**
     * A read-only array of {@link CameraComponent} that can be used during rendering. e.g.
     * Inside {@link Layer#onPreCull}, {@link Layer#onPostCull}, {@link Layer#onPreRender},
     * {@link Layer#onPostRender}.
     *
     * @type {import('../../framework/components/camera/component.js').CameraComponent[]}
     */
    this.cameras = [];

    /**
     * The actual rendering sequence, generated based on layers and cameras
     *
     * @type {RenderAction[]}
     * @ignore
     */
    this._renderActions = [];

    // all currently created light clusters, that need to be updated before rendering
    this._worldClusters = [];

    // empty cluster with no lights
    this._emptyWorldClusters = null;
  }
  destroy() {
    // empty light cluster
    if (this._emptyWorldClusters) {
      this._emptyWorldClusters.destroy();
      this._emptyWorldClusters = null;
    }

    // all other clusters
    this._worldClusters.forEach(cluster => {
      cluster.destroy();
    });
    this._worldClusters = null;

    // render actions
    this._renderActions.forEach(ra => ra.destroy());
    this._renderActions = null;
  }

  // returns an empty light cluster object to be used when no lights are used
  getEmptyWorldClusters(device) {
    if (!this._emptyWorldClusters) {
      // create cluster structure with no lights
      this._emptyWorldClusters = new WorldClusters(device);
      this._emptyWorldClusters.name = 'ClusterEmpty';

      // update it once to avoid doing it each frame
      this._emptyWorldClusters.update([], false, null);
    }
    return this._emptyWorldClusters;
  }

  // function which splits list of lights on a a target object into separate lists of lights based on light type
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

    // if composition dirty flags are not set, test if layers are marked dirty
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

    // function adds unique meshInstances from src array into destArray. A destSet is a Set containing already
    // existing meshInstances  to accelerate the removal of duplicates
    // returns true if any of the materials on these meshInstances has _dirtyBlend set
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

    // rebuild this._meshInstances array - add all unique meshInstances from all layers to it
    // also set this._dirtyBlend to true if material of any meshInstance has _dirtyBlend set, and clear those flags on materials
    if (this._dirty) {
      result |= COMPUPDATED_INSTANCES;
      this._meshInstances.length = 0;
      this._meshInstancesSet.clear();
      for (let i = 0; i < len; i++) {
        const layer = this.layerList[i];
        if (!layer.passThrough) {
          // add meshInstances from both opaque and transparent lists
          this._dirtyBlend = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.opaqueMeshInstances) || this._dirtyBlend;
          this._dirtyBlend = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.transparentMeshInstances) || this._dirtyBlend;
        }
        layer._dirty = false;
      }
      this._dirty = false;
    }

    // function moves transparent or opaque meshes based on moveTransparent from src to dest array
    function moveByBlendType(dest, src, moveTransparent) {
      for (let s = 0; s < src.length;) {
        var _src$s$material;
        if (((_src$s$material = src[s].material) == null ? void 0 : _src$s$material.transparent) === moveTransparent) {
          // add it to dest
          dest.push(src[s]);

          // remove it from src
          src[s] = src[src.length - 1];
          src.length--;
        } else {
          // just skip it
          s++;
        }
      }
    }

    // for each layer, split its meshInstances to either opaque or transparent array based on material blend type
    if (this._dirtyBlend) {
      result |= COMPUPDATED_BLEND;
      for (let i = 0; i < len; i++) {
        const layer = this.layerList[i];
        if (!layer.passThrough) {
          // move any opaque meshInstances from transparentMeshInstances to opaqueMeshInstances
          moveByBlendType(layer.opaqueMeshInstances, layer.transparentMeshInstances, false);

          // move any transparent meshInstances from opaqueMeshInstances to transparentMeshInstances
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

    // if meshes OR lights changed, rebuild shadow casters
    if (result) {
      this.updateShadowCasters();
    }
    if (this._dirtyCameras || result & COMPUPDATED_LIGHTS) {
      this._dirtyCameras = false;
      result |= COMPUPDATED_CAMERAS;

      // walk the layers and build an array of unique cameras from all layers
      this.cameras.length = 0;
      for (let i = 0; i < len; i++) {
        const layer = this.layerList[i];
        layer._dirtyCameras = false;

        // for all cameras in the layer
        for (let j = 0; j < layer.cameras.length; j++) {
          const camera = layer.cameras[j];
          const index = this.cameras.indexOf(camera);
          if (index < 0) {
            this.cameras.push(camera);
          }
        }
      }

      // sort cameras by priority
      if (this.cameras.length > 1) {
        sortPriority(this.cameras);
      }

      // collect a list of layers this camera renders
      const cameraLayers = [];

      // render in order of cameras sorted by priority
      let renderActionCount = 0;
      for (let i = 0; i < this.cameras.length; i++) {
        const camera = this.cameras[i];
        cameraLayers.length = 0;

        // first render action for this camera
        let cameraFirstRenderAction = true;
        const cameraFirstRenderActionIndex = renderActionCount;

        // last render action for the camera
        let lastRenderAction = null;

        // true if post processing stop layer was found for the camera
        let postProcessMarked = false;

        // walk all global sorted list of layers (sublayers) to check if camera renders it
        // this adds both opaque and transparent sublayers if camera renders the layer
        for (let j = 0; j < len; j++) {
          const layer = this.layerList[j];
          const isLayerEnabled = this.subLayerEnabled[j];
          if (layer && isLayerEnabled) {
            // if layer needs to be rendered
            if (layer.cameras.length > 0) {
              // if the camera renders this layer
              if (camera.layers.indexOf(layer.id) >= 0) {
                cameraLayers.push(layer);

                // if this layer is the stop layer for postprocessing
                if (!postProcessMarked && layer.id === camera.disablePostEffectsLayer) {
                  postProcessMarked = true;

                  // the previously added render action is the last post-processed layer
                  if (lastRenderAction) {
                    // mark it to trigger postprocessing callback
                    lastRenderAction.triggerPostprocess = true;
                  }
                }

                // camera index in the layer array
                const cameraIndex = layer.cameras.indexOf(camera);
                if (cameraIndex >= 0) {
                  // add render action to describe rendering step
                  lastRenderAction = this.addRenderAction(this._renderActions, renderActionCount, layer, j, cameraIndex, cameraFirstRenderAction, postProcessMarked);
                  renderActionCount++;
                  cameraFirstRenderAction = false;
                }
              }
            }
          }
        }

        // if the camera renders any layers.
        if (cameraFirstRenderActionIndex < renderActionCount) {
          // based on all layers this camera renders, prepare a list of directional lights the camera needs to render shadow for
          // and set these up on the first render action for the camera.
          this._renderActions[cameraFirstRenderActionIndex].collectDirectionalLights(cameraLayers, this._splitLights[LIGHTTYPE_DIRECTIONAL], this._lights);

          // mark the last render action as last one using the camera
          lastRenderAction.lastCameraUse = true;
        }

        // if no render action for this camera was marked for end of postprocessing, mark last one
        if (!postProcessMarked && lastRenderAction) {
          lastRenderAction.triggerPostprocess = true;
        }

        // handle camera stacking if this render action has postprocessing enabled
        if (camera.renderTarget && camera.postEffectsEnabled) {
          // process previous render actions starting with previous camera
          this.propagateRenderTarget(cameraFirstRenderActionIndex - 1, camera);
        }
      }

      // destroy unused render actions
      for (let i = renderActionCount; i < this._renderActions.length; i++) {
        this._renderActions[i].destroy();
      }
      this._renderActions.length = renderActionCount;
    }

    // allocate light clusteres if lights or meshes or cameras are modified
    if (result & (COMPUPDATED_CAMERAS | COMPUPDATED_LIGHTS | COMPUPDATED_INSTANCES)) {
      // prepare clustered lighting for render actions
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
    // _lightCompositionData already has the right size, just clean up shadow casters
    const lightCount = this._lights.length;
    for (let i = 0; i < lightCount; i++) {
      this._lightCompositionData[i].clearShadowCasters();
    }

    // for each layer
    const len = this.layerList.length;
    for (let i = 0; i < len; i++) {
      const layer = this.layerList[i];

      // layer can be in the list two times (opaque, transp), add casters only one time
      if (!tempSet.has(layer)) {
        tempSet.add(layer);

        // for each light of a layer
        const lights = layer._lights;
        for (let j = 0; j < lights.length; j++) {
          // only need casters when casting shadows
          if (lights[j].castShadows) {
            // find its index in global light list, and get shadow casters for it
            const lightIndex = this._lightsMap.get(lights[j]);
            const lightCompData = this._lightCompositionData[lightIndex];

            // add unique meshes from the layer to casters
            lightCompData.addShadowCasters(layer.shadowCasters);
          }
        }
      }
    }
    tempSet.clear();
  }
  updateLights() {
    // build a list and map of all unique lights from all layers
    this._lights.length = 0;
    this._lightsMap.clear();
    const count = this.layerList.length;
    for (let i = 0; i < count; i++) {
      const layer = this.layerList[i];

      // layer can be in the list two times (opaque, transp), process it only one time
      if (!tempSet.has(layer)) {
        tempSet.add(layer);
        const lights = layer._lights;
        for (let j = 0; j < lights.length; j++) {
          const light = lights[j];

          // add new light
          let lightIndex = this._lightsMap.get(light);
          if (lightIndex === undefined) {
            lightIndex = this._lights.length;
            this._lightsMap.set(light, lightIndex);
            this._lights.push(light);

            // make sure the light has composition data allocated
            let lightCompData = this._lightCompositionData[lightIndex];
            if (!lightCompData) {
              lightCompData = new LightCompositionData();
              this._lightCompositionData[lightIndex] = lightCompData;
            }
          }
        }
      }

      // split layer lights lists by type
      this._splitLightsArray(layer);
      layer._dirtyLights = false;
    }
    tempSet.clear();

    // split light list by type
    this._splitLightsArray(this);

    // adjust _lightCompositionData to the right size, matching number of lights
    const lightCount = this._lights.length;
    this._lightCompositionData.length = lightCount;
  }

  // find existing light cluster that is compatible with specified layer
  findCompatibleCluster(layer, renderActionCount, emptyWorldClusters) {
    // check already set up render actions
    for (let i = 0; i < renderActionCount; i++) {
      const ra = this._renderActions[i];
      const raLayer = this.layerList[ra.layerIndex];

      // only reuse clusters if not empty
      if (ra.lightClusters !== emptyWorldClusters) {
        // if layer is the same (but different sublayer), cluster can be used directly as lights are the same
        if (layer === raLayer) {
          return ra.lightClusters;
        }
        if (ra.lightClusters) {
          // if the layer has exactly the same set of lights, use the same cluster
          if (set.equals(layer._clusteredLightsSet, raLayer._clusteredLightsSet)) {
            return ra.lightClusters;
          }
        }
      }
    }

    // no match
    return null;
  }

  // assign light clusters to render actions that need it
  allocateLightClusters(device) {
    // reuse previously allocated clusters
    tempClusterArray.push(...this._worldClusters);

    // the cluster with no lights
    const emptyWorldClusters = this.getEmptyWorldClusters(device);

    // start with no clusters
    this._worldClusters.length = 0;

    // process all render actions
    const count = this._renderActions.length;
    for (let i = 0; i < count; i++) {
      const ra = this._renderActions[i];
      const layer = this.layerList[ra.layerIndex];
      ra.lightClusters = null;

      // if the layer has lights used by clusters
      if (layer.hasClusteredLights) {
        // and if the layer has meshes
        const transparent = this.subLayerList[ra.layerIndex];
        const meshInstances = transparent ? layer.transparentMeshInstances : layer.opaqueMeshInstances;
        if (meshInstances.length) {
          // reuse cluster that was already set up and is compatible
          let clusters = this.findCompatibleCluster(layer, i, emptyWorldClusters);
          if (!clusters) {
            // use already allocated cluster from before
            if (tempClusterArray.length) {
              clusters = tempClusterArray.pop();
            }

            // create new cluster
            if (!clusters) {
              clusters = new WorldClusters(device);
            }
            clusters.name = 'Cluster-' + this._worldClusters.length;
            this._worldClusters.push(clusters);
          }
          ra.lightClusters = clusters;
        }
      }

      // no clustered lights, use the cluster with no lights
      if (!ra.lightClusters) {
        ra.lightClusters = emptyWorldClusters;
      }
    }

    // delete leftovers
    tempClusterArray.forEach(item => {
      item.destroy();
    });
    tempClusterArray.length = 0;
  }

  // function adds new render action to a list, while trying to limit allocation and reuse already allocated objects
  addRenderAction(renderActions, renderActionIndex, layer, layerIndex, cameraIndex, cameraFirstRenderAction, postProcessMarked) {
    // try and reuse object, otherwise allocate new
    /** @type {RenderAction} */
    let renderAction = renderActions[renderActionIndex];
    if (!renderAction) {
      renderAction = renderActions[renderActionIndex] = new RenderAction();
    }

    // render target from the camera takes precedence over the render target from the layer
    let rt = layer.renderTarget;
    /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
    const camera = layer.cameras[cameraIndex];
    if (camera && camera.renderTarget) {
      if (layer.id !== LAYERID_DEPTH) {
        // ignore depth layer
        rt = camera.renderTarget;
      }
    }

    // was camera and render target combo used already
    let used = false;
    for (let i = renderActionIndex - 1; i >= 0; i--) {
      if (renderActions[i].camera === camera && renderActions[i].renderTarget === rt) {
        used = true;
        break;
      }
    }

    // clear flags - use camera clear flags in the first render action for each camera,
    // or when render target (from layer) was not yet cleared by this camera
    const needsClear = cameraFirstRenderAction || !used;
    let clearColor = needsClear ? camera.clearColorBuffer : false;
    let clearDepth = needsClear ? camera.clearDepthBuffer : false;
    let clearStencil = needsClear ? camera.clearStencilBuffer : false;

    // clear buffers if requested by the layer
    clearColor || (clearColor = layer.clearColorBuffer);
    clearDepth || (clearDepth = layer.clearDepthBuffer);
    clearStencil || (clearStencil = layer.clearStencilBuffer);

    // for cameras with post processing enabled, on layers after post processing has been applied already (so UI and similar),
    // don't render them to render target anymore
    if (postProcessMarked && camera.postEffectsEnabled) {
      rt = null;
    }

    // store the properties - write all as we reuse previously allocated class instances
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

  // executes when post-processing camera's render actions were created to propagate rendering to
  // render targets to previous camera as needed
  propagateRenderTarget(startIndex, fromCamera) {
    for (let a = startIndex; a >= 0; a--) {
      const ra = this._renderActions[a];
      const layer = this.layerList[ra.layerIndex];

      // if we hit render action with a render target (other than depth layer), that marks the end of camera stack
      // TODO: refactor this as part of depth layer refactoring
      if (ra.renderTarget && layer.id !== LAYERID_DEPTH) {
        break;
      }

      // skip over depth layer
      if (layer.id === LAYERID_DEPTH) {
        continue;
      }

      // camera stack ends when viewport or scissor of the camera changes
      const thisCamera = ra == null ? void 0 : ra.camera.camera;
      if (thisCamera) {
        if (!fromCamera.camera.rect.equals(thisCamera.rect) || !fromCamera.camera.scissorRect.equals(thisCamera.scissorRect)) {
          break;
        }
      }

      // render it to render target
      ra.renderTarget = fromCamera.renderTarget;
    }
  }

  // logs render action and their properties
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

  // Whole layer API

  /**
   * Adds a layer (both opaque and semi-transparent parts) to the end of the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   */
  push(layer) {
    // add both opaque and transparent to the end of the array
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

  /**
   * Inserts a layer (both opaque and semi-transparent parts) at the chosen index in the
   * {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   * @param {number} index - Insertion position.
   */
  insert(layer, index) {
    // insert both opaque and transparent at the index
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

  /**
   * Removes a layer (both opaque and semi-transparent parts) from {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to remove.
   */
  remove(layer) {
    // remove all occurrences of a layer
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

    // update both orders
    const count = this.layerList.length;
    this._updateOpaqueOrder(0, count - 1);
    this._updateTransparentOrder(0, count - 1);
  }

  // Sublayer API

  /**
   * Adds part of the layer with opaque (non semi-transparent) objects to the end of the
   * {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   */
  pushOpaque(layer) {
    // add opaque to the end of the array
    if (this._isSublayerAdded(layer, false)) return;
    this.layerList.push(layer);
    this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
    this.subLayerEnabled.push(true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire('add', layer);
  }

  /**
   * Inserts an opaque part of the layer (non semi-transparent mesh instances) at the chosen
   * index in the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   * @param {number} index - Insertion position.
   */
  insertOpaque(layer, index) {
    // insert opaque at index
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

  /**
   * Removes an opaque part of the layer (non semi-transparent mesh instances) from
   * {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to remove.
   */
  removeOpaque(layer) {
    // remove opaque occurrences of a layer
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
          this.fire('remove', layer); // no sublayers left
        }

        return;
      }
    }
  }

  /**
   * Adds part of the layer with semi-transparent objects to the end of the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   */
  pushTransparent(layer) {
    // add transparent to the end of the array
    if (this._isSublayerAdded(layer, true)) return;
    this.layerList.push(layer);
    this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
    this.subLayerEnabled.push(true);
    this._dirty = true;
    this._dirtyLights = true;
    this._dirtyCameras = true;
    this.fire('add', layer);
  }

  /**
   * Inserts a semi-transparent part of the layer at the chosen index in the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
   * @param {number} index - Insertion position.
   */
  insertTransparent(layer, index) {
    // insert transparent at index
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

  /**
   * Removes a transparent part of the layer from {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to remove.
   */
  removeTransparent(layer) {
    // remove transparent occurrences of a layer
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
          this.fire('remove', layer); // no sublayers left
        }

        return;
      }
    }
  }
  _getSublayerIndex(layer, transparent) {
    // find sublayer index in the composition array
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

  /**
   * Gets index of the opaque part of the supplied layer in the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to find index of.
   * @returns {number} The index of the opaque part of the specified layer.
   */
  getOpaqueIndex(layer) {
    return this._getSublayerIndex(layer, false);
  }

  /**
   * Gets index of the semi-transparent part of the supplied layer in the {@link LayerComposition#layerList}.
   *
   * @param {import('../layer.js').Layer} layer - A {@link Layer} to find index of.
   * @returns {number} The index of the semi-transparent part of the specified layer.
   */
  getTransparentIndex(layer) {
    return this._getSublayerIndex(layer, true);
  }

  /**
   * Finds a layer inside this composition by its ID. Null is returned, if nothing is found.
   *
   * @param {number} id - An ID of the layer to find.
   * @returns {import('../layer.js').Layer|null} The layer corresponding to the specified ID.
   * Returns null if layer is not found.
   */
  getLayerById(id) {
    for (let i = 0; i < this.layerList.length; i++) {
      if (this.layerList[i].id === id) return this.layerList[i];
    }
    return null;
  }

  /**
   * Finds a layer inside this composition by its name. Null is returned, if nothing is found.
   *
   * @param {string} name - The name of the layer to find.
   * @returns {import('../layer.js').Layer|null} The layer corresponding to the specified name.
   * Returns null if layer is not found.
   */
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

  // Used to determine which array of layers has any sublayer that is
  // on top of all the sublayers in the other array. The order is a dictionary
  // of <layerId, index>.
  _sortLayersDescending(layersA, layersB, order) {
    let topLayerA = -1;
    let topLayerB = -1;

    // search for which layer is on top in layersA
    for (let i = 0, len = layersA.length; i < len; i++) {
      const id = layersA[i];
      if (order.hasOwnProperty(id)) {
        topLayerA = Math.max(topLayerA, order[id]);
      }
    }

    // search for which layer is on top in layersB
    for (let i = 0, len = layersB.length; i < len; i++) {
      const id = layersB[i];
      if (order.hasOwnProperty(id)) {
        topLayerB = Math.max(topLayerB, order[id]);
      }
    }

    // if the layers of layersA or layersB do not exist at all
    // in the composition then return early with the other.
    if (topLayerA === -1 && topLayerB !== -1) {
      return 1;
    } else if (topLayerB === -1 && topLayerA !== -1) {
      return -1;
    }

    // sort in descending order since we want
    // the higher order to be first
    return topLayerB - topLayerA;
  }

  /**
   * Used to determine which array of layers has any transparent sublayer that is on top of all
   * the transparent sublayers in the other array.
   *
   * @param {number[]} layersA - IDs of layers.
   * @param {number[]} layersB - IDs of layers.
   * @returns {number} Returns a negative number if any of the transparent sublayers in layersA
   * is on top of all the transparent sublayers in layersB, or a positive number if any of the
   * transparent sublayers in layersB is on top of all the transparent sublayers in layersA, or 0
   * otherwise.
   * @private
   */
  sortTransparentLayers(layersA, layersB) {
    return this._sortLayersDescending(layersA, layersB, this._transparentOrder);
  }

  /**
   * Used to determine which array of layers has any opaque sublayer that is on top of all the
   * opaque sublayers in the other array.
   *
   * @param {number[]} layersA - IDs of layers.
   * @param {number[]} layersB - IDs of layers.
   * @returns {number} Returns a negative number if any of the opaque sublayers in layersA is on
   * top of all the opaque sublayers in layersB, or a positive number if any of the opaque
   * sublayers in layersB is on top of all the opaque sublayers in layersA, or 0 otherwise.
   * @private
   */
  sortOpaqueLayers(layersA, layersB) {
    return this._sortLayersDescending(layersA, layersB, this._opaqueOrder);
  }
}

export { LayerComposition };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXItY29tcG9zaXRpb24uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUUkFDRUlEX1JFTkRFUl9BQ1RJT04gfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVHJhY2luZyB9IGZyb20gJy4uLy4uL2NvcmUvdHJhY2luZy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgc2V0IH0gZnJvbSAnLi4vLi4vY29yZS9zZXQtdXRpbHMuanMnO1xuaW1wb3J0IHsgc29ydFByaW9yaXR5IH0gZnJvbSAnLi4vLi4vY29yZS9zb3J0LmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUklEX0RFUFRILFxuICAgIENPTVBVUERBVEVEX0JMRU5ELCBDT01QVVBEQVRFRF9DQU1FUkFTLCBDT01QVVBEQVRFRF9JTlNUQU5DRVMsIENPTVBVUERBVEVEX0xJR0hUUyxcbiAgICBMSUdIVFRZUEVfRElSRUNUSU9OQUwsIExJR0hUVFlQRV9PTU5JLCBMSUdIVFRZUEVfU1BPVFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJBY3Rpb24gfSBmcm9tICcuL3JlbmRlci1hY3Rpb24uanMnO1xuaW1wb3J0IHsgV29ybGRDbHVzdGVycyB9IGZyb20gJy4uL2xpZ2h0aW5nL3dvcmxkLWNsdXN0ZXJzLmpzJztcbmltcG9ydCB7IExpZ2h0Q29tcG9zaXRpb25EYXRhIH0gZnJvbSAnLi9saWdodC1jb21wb3NpdGlvbi1kYXRhLmpzJztcblxuY29uc3QgdGVtcFNldCA9IG5ldyBTZXQoKTtcbmNvbnN0IHRlbXBDbHVzdGVyQXJyYXkgPSBbXTtcblxuLyoqXG4gKiBMYXllciBDb21wb3NpdGlvbiBpcyBhIGNvbGxlY3Rpb24gb2Yge0BsaW5rIExheWVyfSB0aGF0IGlzIGZlZCB0byB7QGxpbmsgU2NlbmUjbGF5ZXJzfSB0byBkZWZpbmVcbiAqIHJlbmRlcmluZyBvcmRlci5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIExheWVyQ29tcG9zaXRpb24gZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8vIENvbXBvc2l0aW9uIGNhbiBob2xkIG9ubHkgMiBzdWJsYXllcnMgb2YgZWFjaCBsYXllclxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IGxheWVyIGNvbXBvc2l0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtuYW1lXSAtIE9wdGlvbmFsIG5vbi11bmlxdWUgbmFtZSBvZiB0aGUgbGF5ZXIgY29tcG9zaXRpb24uIERlZmF1bHRzIHRvXG4gICAgICogXCJVbnRpdGxlZFwiIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobmFtZSA9ICdVbnRpdGxlZCcpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIHJlYWQtb25seSBhcnJheSBvZiB7QGxpbmsgTGF5ZXJ9IHNvcnRlZCBpbiB0aGUgb3JkZXIgdGhleSB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxheWVyTGlzdCA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIHJlYWQtb25seSBhcnJheSBvZiBib29sZWFuIHZhbHVlcywgbWF0Y2hpbmcge0BsaW5rIExheWVyQ29tcG9zaXRpb24jbGF5ZXJMaXN0fS4gVHJ1ZSBtZWFucyBvbmx5XG4gICAgICAgICAqIHNlbWktdHJhbnNwYXJlbnQgb2JqZWN0cyBhcmUgcmVuZGVyZWQsIGFuZCBmYWxzZSBtZWFucyBvcGFxdWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFuW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnN1YkxheWVyTGlzdCA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIHJlYWQtb25seSBhcnJheSBvZiBib29sZWFuIHZhbHVlcywgbWF0Y2hpbmcge0BsaW5rIExheWVyQ29tcG9zaXRpb24jbGF5ZXJMaXN0fS4gVHJ1ZSBtZWFucyB0aGVcbiAgICAgICAgICogbGF5ZXIgaXMgcmVuZGVyZWQsIGZhbHNlIG1lYW5zIGl0J3Mgc2tpcHBlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW5bXX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkID0gW107IC8vIG1vcmUgZ3JhbnVsYXIgY29udHJvbCBvbiB0b3Agb2YgbGF5ZXIuZW5hYmxlZCAoQU5EZWQpXG5cbiAgICAgICAgdGhpcy5fb3BhcXVlT3JkZXIgPSB7fTtcbiAgICAgICAgdGhpcy5fdHJhbnNwYXJlbnRPcmRlciA9IHt9O1xuXG4gICAgICAgIHRoaXMuX2RpcnR5ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2RpcnR5QmxlbmQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYWxsIHVuaXF1ZSBtZXNoSW5zdGFuY2VzIGZyb20gYWxsIGxheWVycywgc3RvcmVkIGJvdGggYXMgYW4gYXJyYXksIGFuZCBhbHNvIGEgc2V0IGZvciBmYXN0IHNlYXJjaFxuICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNTZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLy8gYW4gYXJyYXkgb2YgYWxsIHVuaXF1ZSBsaWdodHMgZnJvbSBhbGwgbGF5ZXJzXG4gICAgICAgIHRoaXMuX2xpZ2h0cyA9IFtdO1xuXG4gICAgICAgIC8vIGEgbWFwIG9mIExpZ2h0IHRvIGluZGV4IGluIF9saWdodHMgZm9yIGZhc3QgbG9va3VwXG4gICAgICAgIHRoaXMuX2xpZ2h0c01hcCA9IG5ldyBNYXAoKTtcblxuICAgICAgICAvLyBlYWNoIGVudHJ5IGluIF9saWdodHMgaGFzIGVudHJ5IG9mIHR5cGUgTGlnaHRDb21wb3NpdGlvbkRhdGEgaGVyZSBhdCB0aGUgc2FtZSBpbmRleCxcbiAgICAgICAgLy8gc3RvcmluZyBzaGFkb3cgY2FzdGVycyBhbmQgYWRkaXRpb25hbCBjb21wb3NpdGlvbiByZWxhdGVkIGRhdGEgZm9yIHRoZSBsaWdodFxuICAgICAgICB0aGlzLl9saWdodENvbXBvc2l0aW9uRGF0YSA9IFtdO1xuXG4gICAgICAgIC8vIF9saWdodHMgc3BsaXQgaW50byBhcnJheXMgcGVyIHR5cGUgb2YgbGlnaHQsIGluZGV4ZWQgYnkgTElHSFRUWVBFXyoqKiBjb25zdGFudHNcbiAgICAgICAgdGhpcy5fc3BsaXRMaWdodHMgPSBbW10sIFtdLCBbXV07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEEgcmVhZC1vbmx5IGFycmF5IG9mIHtAbGluayBDYW1lcmFDb21wb25lbnR9IHRoYXQgY2FuIGJlIHVzZWQgZHVyaW5nIHJlbmRlcmluZy4gZS5nLlxuICAgICAgICAgKiBJbnNpZGUge0BsaW5rIExheWVyI29uUHJlQ3VsbH0sIHtAbGluayBMYXllciNvblBvc3RDdWxsfSwge0BsaW5rIExheWVyI29uUHJlUmVuZGVyfSxcbiAgICAgICAgICoge0BsaW5rIExheWVyI29uUG9zdFJlbmRlcn0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnRbXX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY2FtZXJhcyA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYWN0dWFsIHJlbmRlcmluZyBzZXF1ZW5jZSwgZ2VuZXJhdGVkIGJhc2VkIG9uIGxheWVycyBhbmQgY2FtZXJhc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7UmVuZGVyQWN0aW9uW119XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3JlbmRlckFjdGlvbnMgPSBbXTtcblxuICAgICAgICAvLyBhbGwgY3VycmVudGx5IGNyZWF0ZWQgbGlnaHQgY2x1c3RlcnMsIHRoYXQgbmVlZCB0byBiZSB1cGRhdGVkIGJlZm9yZSByZW5kZXJpbmdcbiAgICAgICAgdGhpcy5fd29ybGRDbHVzdGVycyA9IFtdO1xuXG4gICAgICAgIC8vIGVtcHR5IGNsdXN0ZXIgd2l0aCBubyBsaWdodHNcbiAgICAgICAgdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzID0gbnVsbDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyBlbXB0eSBsaWdodCBjbHVzdGVyXG4gICAgICAgIGlmICh0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMpIHtcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycy5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWxsIG90aGVyIGNsdXN0ZXJzXG4gICAgICAgIHRoaXMuX3dvcmxkQ2x1c3RlcnMuZm9yRWFjaCgoY2x1c3RlcikgPT4ge1xuICAgICAgICAgICAgY2x1c3Rlci5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl93b3JsZENsdXN0ZXJzID0gbnVsbDtcblxuICAgICAgICAvLyByZW5kZXIgYWN0aW9uc1xuICAgICAgICB0aGlzLl9yZW5kZXJBY3Rpb25zLmZvckVhY2gocmEgPT4gcmEuZGVzdHJveSgpKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9ucyA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyBhbiBlbXB0eSBsaWdodCBjbHVzdGVyIG9iamVjdCB0byBiZSB1c2VkIHdoZW4gbm8gbGlnaHRzIGFyZSB1c2VkXG4gICAgZ2V0RW1wdHlXb3JsZENsdXN0ZXJzKGRldmljZSkge1xuICAgICAgICBpZiAoIXRoaXMuX2VtcHR5V29ybGRDbHVzdGVycykge1xuXG4gICAgICAgICAgICAvLyBjcmVhdGUgY2x1c3RlciBzdHJ1Y3R1cmUgd2l0aCBubyBsaWdodHNcbiAgICAgICAgICAgIHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycyA9IG5ldyBXb3JsZENsdXN0ZXJzKGRldmljZSk7XG4gICAgICAgICAgICB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMubmFtZSA9ICdDbHVzdGVyRW1wdHknO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgaXQgb25jZSB0byBhdm9pZCBkb2luZyBpdCBlYWNoIGZyYW1lXG4gICAgICAgICAgICB0aGlzLl9lbXB0eVdvcmxkQ2x1c3RlcnMudXBkYXRlKFtdLCBmYWxzZSwgbnVsbCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fZW1wdHlXb3JsZENsdXN0ZXJzO1xuICAgIH1cblxuICAgIC8vIGZ1bmN0aW9uIHdoaWNoIHNwbGl0cyBsaXN0IG9mIGxpZ2h0cyBvbiBhIGEgdGFyZ2V0IG9iamVjdCBpbnRvIHNlcGFyYXRlIGxpc3RzIG9mIGxpZ2h0cyBiYXNlZCBvbiBsaWdodCB0eXBlXG4gICAgX3NwbGl0TGlnaHRzQXJyYXkodGFyZ2V0KSB7XG4gICAgICAgIGNvbnN0IGxpZ2h0cyA9IHRhcmdldC5fbGlnaHRzO1xuICAgICAgICB0YXJnZXQuX3NwbGl0TGlnaHRzW0xJR0hUVFlQRV9ESVJFQ1RJT05BTF0ubGVuZ3RoID0gMDtcbiAgICAgICAgdGFyZ2V0Ll9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfT01OSV0ubGVuZ3RoID0gMDtcbiAgICAgICAgdGFyZ2V0Ll9zcGxpdExpZ2h0c1tMSUdIVFRZUEVfU1BPVF0ubGVuZ3RoID0gMDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpZ2h0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG4gICAgICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRhcmdldC5fc3BsaXRMaWdodHNbbGlnaHQuX3R5cGVdLnB1c2gobGlnaHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZShkZXZpY2UsIGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IGZhbHNlKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgbGV0IHJlc3VsdCA9IDA7XG5cbiAgICAgICAgLy8gaWYgY29tcG9zaXRpb24gZGlydHkgZmxhZ3MgYXJlIG5vdCBzZXQsIHRlc3QgaWYgbGF5ZXJzIGFyZSBtYXJrZWQgZGlydHlcbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eSB8fCAhdGhpcy5fZGlydHlMaWdodHMgfHwgIXRoaXMuX2RpcnR5Q2FtZXJhcykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyLl9kaXJ0eSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChsYXllci5fZGlydHlMaWdodHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIuX2RpcnR5Q2FtZXJhcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZ1bmN0aW9uIGFkZHMgdW5pcXVlIG1lc2hJbnN0YW5jZXMgZnJvbSBzcmMgYXJyYXkgaW50byBkZXN0QXJyYXkuIEEgZGVzdFNldCBpcyBhIFNldCBjb250YWluaW5nIGFscmVhZHlcbiAgICAgICAgLy8gZXhpc3RpbmcgbWVzaEluc3RhbmNlcyAgdG8gYWNjZWxlcmF0ZSB0aGUgcmVtb3ZhbCBvZiBkdXBsaWNhdGVzXG4gICAgICAgIC8vIHJldHVybnMgdHJ1ZSBpZiBhbnkgb2YgdGhlIG1hdGVyaWFscyBvbiB0aGVzZSBtZXNoSW5zdGFuY2VzIGhhcyBfZGlydHlCbGVuZCBzZXRcbiAgICAgICAgZnVuY3Rpb24gYWRkVW5pcXVlTWVzaEluc3RhbmNlKGRlc3RBcnJheSwgZGVzdFNldCwgc3JjQXJyYXkpIHtcbiAgICAgICAgICAgIGxldCBkaXJ0eUJsZW5kID0gZmFsc2U7XG4gICAgICAgICAgICBjb25zdCBzcmNMZW4gPSBzcmNBcnJheS5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBzID0gMDsgcyA8IHNyY0xlbjsgcysrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3QgPSBzcmNBcnJheVtzXTtcblxuICAgICAgICAgICAgICAgIGlmICghZGVzdFNldC5oYXMobWVzaEluc3QpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlc3RTZXQuYWRkKG1lc2hJbnN0KTtcbiAgICAgICAgICAgICAgICAgICAgZGVzdEFycmF5LnB1c2gobWVzaEluc3QpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3QubWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCAmJiBtYXRlcmlhbC5fZGlydHlCbGVuZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGlydHlCbGVuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5fZGlydHlCbGVuZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGRpcnR5QmxlbmQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWJ1aWxkIHRoaXMuX21lc2hJbnN0YW5jZXMgYXJyYXkgLSBhZGQgYWxsIHVuaXF1ZSBtZXNoSW5zdGFuY2VzIGZyb20gYWxsIGxheWVycyB0byBpdFxuICAgICAgICAvLyBhbHNvIHNldCB0aGlzLl9kaXJ0eUJsZW5kIHRvIHRydWUgaWYgbWF0ZXJpYWwgb2YgYW55IG1lc2hJbnN0YW5jZSBoYXMgX2RpcnR5QmxlbmQgc2V0LCBhbmQgY2xlYXIgdGhvc2UgZmxhZ3Mgb24gbWF0ZXJpYWxzXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eSkge1xuICAgICAgICAgICAgcmVzdWx0IHw9IENPTVBVUERBVEVEX0lOU1RBTkNFUztcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNTZXQuY2xlYXIoKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgICAgICAgICAgaWYgKCFsYXllci5wYXNzVGhyb3VnaCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCBtZXNoSW5zdGFuY2VzIGZyb20gYm90aCBvcGFxdWUgYW5kIHRyYW5zcGFyZW50IGxpc3RzXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5QmxlbmQgPSBhZGRVbmlxdWVNZXNoSW5zdGFuY2UodGhpcy5fbWVzaEluc3RhbmNlcywgdGhpcy5fbWVzaEluc3RhbmNlc1NldCwgbGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcykgfHwgdGhpcy5fZGlydHlCbGVuZDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGlydHlCbGVuZCA9IGFkZFVuaXF1ZU1lc2hJbnN0YW5jZSh0aGlzLl9tZXNoSW5zdGFuY2VzLCB0aGlzLl9tZXNoSW5zdGFuY2VzU2V0LCBsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMpIHx8IHRoaXMuX2RpcnR5QmxlbmQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGF5ZXIuX2RpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmdW5jdGlvbiBtb3ZlcyB0cmFuc3BhcmVudCBvciBvcGFxdWUgbWVzaGVzIGJhc2VkIG9uIG1vdmVUcmFuc3BhcmVudCBmcm9tIHNyYyB0byBkZXN0IGFycmF5XG4gICAgICAgIGZ1bmN0aW9uIG1vdmVCeUJsZW5kVHlwZShkZXN0LCBzcmMsIG1vdmVUcmFuc3BhcmVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgcyA9IDA7IHMgPCBzcmMubGVuZ3RoOykge1xuXG4gICAgICAgICAgICAgICAgaWYgKHNyY1tzXS5tYXRlcmlhbD8udHJhbnNwYXJlbnQgPT09IG1vdmVUcmFuc3BhcmVudCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCBpdCB0byBkZXN0XG4gICAgICAgICAgICAgICAgICAgIGRlc3QucHVzaChzcmNbc10pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBpdCBmcm9tIHNyY1xuICAgICAgICAgICAgICAgICAgICBzcmNbc10gPSBzcmNbc3JjLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgICAgICAgICBzcmMubGVuZ3RoLS07XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGp1c3Qgc2tpcCBpdFxuICAgICAgICAgICAgICAgICAgICBzKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yIGVhY2ggbGF5ZXIsIHNwbGl0IGl0cyBtZXNoSW5zdGFuY2VzIHRvIGVpdGhlciBvcGFxdWUgb3IgdHJhbnNwYXJlbnQgYXJyYXkgYmFzZWQgb24gbWF0ZXJpYWwgYmxlbmQgdHlwZVxuICAgICAgICBpZiAodGhpcy5fZGlydHlCbGVuZCkge1xuICAgICAgICAgICAgcmVzdWx0IHw9IENPTVBVUERBVEVEX0JMRU5EO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyLnBhc3NUaHJvdWdoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbW92ZSBhbnkgb3BhcXVlIG1lc2hJbnN0YW5jZXMgZnJvbSB0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgdG8gb3BhcXVlTWVzaEluc3RhbmNlc1xuICAgICAgICAgICAgICAgICAgICBtb3ZlQnlCbGVuZFR5cGUobGF5ZXIub3BhcXVlTWVzaEluc3RhbmNlcywgbGF5ZXIudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzLCBmYWxzZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbW92ZSBhbnkgdHJhbnNwYXJlbnQgbWVzaEluc3RhbmNlcyBmcm9tIG9wYXF1ZU1lc2hJbnN0YW5jZXMgdG8gdHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgICAgIG1vdmVCeUJsZW5kVHlwZShsYXllci50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMsIGxheWVyLm9wYXF1ZU1lc2hJbnN0YW5jZXMsIHRydWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5QmxlbmQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxpZ2h0cykge1xuICAgICAgICAgICAgcmVzdWx0IHw9IENPTVBVUERBVEVEX0xJR0hUUztcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMudXBkYXRlTGlnaHRzKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBtZXNoZXMgT1IgbGlnaHRzIGNoYW5nZWQsIHJlYnVpbGQgc2hhZG93IGNhc3RlcnNcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkb3dDYXN0ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZGlydHlDYW1lcmFzIHx8IChyZXN1bHQgJiBDT01QVVBEQVRFRF9MSUdIVFMpKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IGZhbHNlO1xuICAgICAgICAgICAgcmVzdWx0IHw9IENPTVBVUERBVEVEX0NBTUVSQVM7XG5cbiAgICAgICAgICAgIC8vIHdhbGsgdGhlIGxheWVycyBhbmQgYnVpbGQgYW4gYXJyYXkgb2YgdW5pcXVlIGNhbWVyYXMgZnJvbSBhbGwgbGF5ZXJzXG4gICAgICAgICAgICB0aGlzLmNhbWVyYXMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJMaXN0W2ldO1xuICAgICAgICAgICAgICAgIGxheWVyLl9kaXJ0eUNhbWVyYXMgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIC8vIGZvciBhbGwgY2FtZXJhcyBpbiB0aGUgbGF5ZXJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxheWVyLmNhbWVyYXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tqXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmNhbWVyYXMuaW5kZXhPZihjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNhbWVyYXMucHVzaChjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzb3J0IGNhbWVyYXMgYnkgcHJpb3JpdHlcbiAgICAgICAgICAgIGlmICh0aGlzLmNhbWVyYXMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIHNvcnRQcmlvcml0eSh0aGlzLmNhbWVyYXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjb2xsZWN0IGEgbGlzdCBvZiBsYXllcnMgdGhpcyBjYW1lcmEgcmVuZGVyc1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhTGF5ZXJzID0gW107XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBpbiBvcmRlciBvZiBjYW1lcmFzIHNvcnRlZCBieSBwcmlvcml0eVxuICAgICAgICAgICAgbGV0IHJlbmRlckFjdGlvbkNvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5jYW1lcmFzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gdGhpcy5jYW1lcmFzW2ldO1xuICAgICAgICAgICAgICAgIGNhbWVyYUxheWVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgICAgICAgICAgLy8gZmlyc3QgcmVuZGVyIGFjdGlvbiBmb3IgdGhpcyBjYW1lcmFcbiAgICAgICAgICAgICAgICBsZXQgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uSW5kZXggPSByZW5kZXJBY3Rpb25Db3VudDtcblxuICAgICAgICAgICAgICAgIC8vIGxhc3QgcmVuZGVyIGFjdGlvbiBmb3IgdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgIGxldCBsYXN0UmVuZGVyQWN0aW9uID0gbnVsbDtcblxuICAgICAgICAgICAgICAgIC8vIHRydWUgaWYgcG9zdCBwcm9jZXNzaW5nIHN0b3AgbGF5ZXIgd2FzIGZvdW5kIGZvciB0aGUgY2FtZXJhXG4gICAgICAgICAgICAgICAgbGV0IHBvc3RQcm9jZXNzTWFya2VkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAvLyB3YWxrIGFsbCBnbG9iYWwgc29ydGVkIGxpc3Qgb2YgbGF5ZXJzIChzdWJsYXllcnMpIHRvIGNoZWNrIGlmIGNhbWVyYSByZW5kZXJzIGl0XG4gICAgICAgICAgICAgICAgLy8gdGhpcyBhZGRzIGJvdGggb3BhcXVlIGFuZCB0cmFuc3BhcmVudCBzdWJsYXllcnMgaWYgY2FtZXJhIHJlbmRlcnMgdGhlIGxheWVyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGorKykge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3Rbal07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzTGF5ZXJFbmFibGVkID0gdGhpcy5zdWJMYXllckVuYWJsZWRbal07XG4gICAgICAgICAgICAgICAgICAgIGlmIChsYXllciAmJiBpc0xheWVyRW5hYmxlZCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBsYXllciBuZWVkcyB0byBiZSByZW5kZXJlZFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyLmNhbWVyYXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIGNhbWVyYSByZW5kZXJzIHRoaXMgbGF5ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLmxheWVycy5pbmRleE9mKGxheWVyLmlkKSA+PSAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhTGF5ZXJzLnB1c2gobGF5ZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoaXMgbGF5ZXIgaXMgdGhlIHN0b3AgbGF5ZXIgZm9yIHBvc3Rwcm9jZXNzaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcG9zdFByb2Nlc3NNYXJrZWQgJiYgbGF5ZXIuaWQgPT09IGNhbWVyYS5kaXNhYmxlUG9zdEVmZmVjdHNMYXllcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zdFByb2Nlc3NNYXJrZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB0aGUgcHJldmlvdXNseSBhZGRlZCByZW5kZXIgYWN0aW9uIGlzIHRoZSBsYXN0IHBvc3QtcHJvY2Vzc2VkIGxheWVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobGFzdFJlbmRlckFjdGlvbikge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbWFyayBpdCB0byB0cmlnZ2VyIHBvc3Rwcm9jZXNzaW5nIGNhbGxiYWNrXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdFJlbmRlckFjdGlvbi50cmlnZ2VyUG9zdHByb2Nlc3MgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2FtZXJhIGluZGV4IGluIHRoZSBsYXllciBhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmFJbmRleCA9IGxheWVyLmNhbWVyYXMuaW5kZXhPZihjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhSW5kZXggPj0gMCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgcmVuZGVyIGFjdGlvbiB0byBkZXNjcmliZSByZW5kZXJpbmcgc3RlcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdFJlbmRlckFjdGlvbiA9IHRoaXMuYWRkUmVuZGVyQWN0aW9uKHRoaXMuX3JlbmRlckFjdGlvbnMsIHJlbmRlckFjdGlvbkNvdW50LCBsYXllciwgaiwgY2FtZXJhSW5kZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb24sIHBvc3RQcm9jZXNzTWFya2VkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbmRlckFjdGlvbkNvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlIGNhbWVyYSByZW5kZXJzIGFueSBsYXllcnMuXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uSW5kZXggPCByZW5kZXJBY3Rpb25Db3VudCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBiYXNlZCBvbiBhbGwgbGF5ZXJzIHRoaXMgY2FtZXJhIHJlbmRlcnMsIHByZXBhcmUgYSBsaXN0IG9mIGRpcmVjdGlvbmFsIGxpZ2h0cyB0aGUgY2FtZXJhIG5lZWRzIHRvIHJlbmRlciBzaGFkb3cgZm9yXG4gICAgICAgICAgICAgICAgICAgIC8vIGFuZCBzZXQgdGhlc2UgdXAgb24gdGhlIGZpcnN0IHJlbmRlciBhY3Rpb24gZm9yIHRoZSBjYW1lcmEuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlckFjdGlvbnNbY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleF0uY29sbGVjdERpcmVjdGlvbmFsTGlnaHRzKGNhbWVyYUxheWVycywgdGhpcy5fc3BsaXRMaWdodHNbTElHSFRUWVBFX0RJUkVDVElPTkFMXSwgdGhpcy5fbGlnaHRzKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtYXJrIHRoZSBsYXN0IHJlbmRlciBhY3Rpb24gYXMgbGFzdCBvbmUgdXNpbmcgdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgICAgICBsYXN0UmVuZGVyQWN0aW9uLmxhc3RDYW1lcmFVc2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGlmIG5vIHJlbmRlciBhY3Rpb24gZm9yIHRoaXMgY2FtZXJhIHdhcyBtYXJrZWQgZm9yIGVuZCBvZiBwb3N0cHJvY2Vzc2luZywgbWFyayBsYXN0IG9uZVxuICAgICAgICAgICAgICAgIGlmICghcG9zdFByb2Nlc3NNYXJrZWQgJiYgbGFzdFJlbmRlckFjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBsYXN0UmVuZGVyQWN0aW9uLnRyaWdnZXJQb3N0cHJvY2VzcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaGFuZGxlIGNhbWVyYSBzdGFja2luZyBpZiB0aGlzIHJlbmRlciBhY3Rpb24gaGFzIHBvc3Rwcm9jZXNzaW5nIGVuYWJsZWRcbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLnJlbmRlclRhcmdldCAmJiBjYW1lcmEucG9zdEVmZmVjdHNFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHByb2Nlc3MgcHJldmlvdXMgcmVuZGVyIGFjdGlvbnMgc3RhcnRpbmcgd2l0aCBwcmV2aW91cyBjYW1lcmFcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9wYWdhdGVSZW5kZXJUYXJnZXQoY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCAtIDEsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkZXN0cm95IHVudXNlZCByZW5kZXIgYWN0aW9uc1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHJlbmRlckFjdGlvbkNvdW50OyBpIDwgdGhpcy5fcmVuZGVyQWN0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlckFjdGlvbnNbaV0uZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fcmVuZGVyQWN0aW9ucy5sZW5ndGggPSByZW5kZXJBY3Rpb25Db3VudDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFsbG9jYXRlIGxpZ2h0IGNsdXN0ZXJlcyBpZiBsaWdodHMgb3IgbWVzaGVzIG9yIGNhbWVyYXMgYXJlIG1vZGlmaWVkXG4gICAgICAgIGlmIChyZXN1bHQgJiAoQ09NUFVQREFURURfQ0FNRVJBUyB8IENPTVBVUERBVEVEX0xJR0hUUyB8IENPTVBVUERBVEVEX0lOU1RBTkNFUykpIHtcblxuICAgICAgICAgICAgLy8gcHJlcGFyZSBjbHVzdGVyZWQgbGlnaHRpbmcgZm9yIHJlbmRlciBhY3Rpb25zXG4gICAgICAgICAgICBpZiAoY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hbGxvY2F0ZUxpZ2h0Q2x1c3RlcnMoZGV2aWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZXN1bHQgJiAoQ09NUFVQREFURURfTElHSFRTIHwgQ09NUFVQREFURURfTElHSFRTKSkge1xuICAgICAgICAgICAgdGhpcy5fbG9nUmVuZGVyQWN0aW9ucygpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICB1cGRhdGVTaGFkb3dDYXN0ZXJzKCkge1xuXG4gICAgICAgIC8vIF9saWdodENvbXBvc2l0aW9uRGF0YSBhbHJlYWR5IGhhcyB0aGUgcmlnaHQgc2l6ZSwganVzdCBjbGVhbiB1cCBzaGFkb3cgY2FzdGVyc1xuICAgICAgICBjb25zdCBsaWdodENvdW50ID0gdGhpcy5fbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaWdodENvdW50OyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhW2ldLmNsZWFyU2hhZG93Q2FzdGVycygpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yIGVhY2ggbGF5ZXJcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJMaXN0W2ldO1xuXG4gICAgICAgICAgICAvLyBsYXllciBjYW4gYmUgaW4gdGhlIGxpc3QgdHdvIHRpbWVzIChvcGFxdWUsIHRyYW5zcCksIGFkZCBjYXN0ZXJzIG9ubHkgb25lIHRpbWVcbiAgICAgICAgICAgIGlmICghdGVtcFNldC5oYXMobGF5ZXIpKSB7XG4gICAgICAgICAgICAgICAgdGVtcFNldC5hZGQobGF5ZXIpO1xuXG4gICAgICAgICAgICAgICAgLy8gZm9yIGVhY2ggbGlnaHQgb2YgYSBsYXllclxuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0cyA9IGxheWVyLl9saWdodHM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsaWdodHMubGVuZ3RoOyBqKyspIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBvbmx5IG5lZWQgY2FzdGVycyB3aGVuIGNhc3Rpbmcgc2hhZG93c1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRzW2pdLmNhc3RTaGFkb3dzKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpbmQgaXRzIGluZGV4IGluIGdsb2JhbCBsaWdodCBsaXN0LCBhbmQgZ2V0IHNoYWRvdyBjYXN0ZXJzIGZvciBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRJbmRleCA9IHRoaXMuX2xpZ2h0c01hcC5nZXQobGlnaHRzW2pdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0Q29tcERhdGEgPSB0aGlzLl9saWdodENvbXBvc2l0aW9uRGF0YVtsaWdodEluZGV4XTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHVuaXF1ZSBtZXNoZXMgZnJvbSB0aGUgbGF5ZXIgdG8gY2FzdGVyc1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRDb21wRGF0YS5hZGRTaGFkb3dDYXN0ZXJzKGxheWVyLnNoYWRvd0Nhc3RlcnMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGVtcFNldC5jbGVhcigpO1xuICAgIH1cblxuICAgIHVwZGF0ZUxpZ2h0cygpIHtcblxuICAgICAgICAvLyBidWlsZCBhIGxpc3QgYW5kIG1hcCBvZiBhbGwgdW5pcXVlIGxpZ2h0cyBmcm9tIGFsbCBsYXllcnNcbiAgICAgICAgdGhpcy5fbGlnaHRzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuX2xpZ2h0c01hcC5jbGVhcigpO1xuXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbaV07XG5cbiAgICAgICAgICAgIC8vIGxheWVyIGNhbiBiZSBpbiB0aGUgbGlzdCB0d28gdGltZXMgKG9wYXF1ZSwgdHJhbnNwKSwgcHJvY2VzcyBpdCBvbmx5IG9uZSB0aW1lXG4gICAgICAgICAgICBpZiAoIXRlbXBTZXQuaGFzKGxheWVyKSkge1xuICAgICAgICAgICAgICAgIHRlbXBTZXQuYWRkKGxheWVyKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0cyA9IGxheWVyLl9saWdodHM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsaWdodHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbal07XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIG5ldyBsaWdodFxuICAgICAgICAgICAgICAgICAgICBsZXQgbGlnaHRJbmRleCA9IHRoaXMuX2xpZ2h0c01hcC5nZXQobGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHRJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodEluZGV4ID0gdGhpcy5fbGlnaHRzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xpZ2h0c01hcC5zZXQobGlnaHQsIGxpZ2h0SW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGlnaHRzLnB1c2gobGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtYWtlIHN1cmUgdGhlIGxpZ2h0IGhhcyBjb21wb3NpdGlvbiBkYXRhIGFsbG9jYXRlZFxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGxpZ2h0Q29tcERhdGEgPSB0aGlzLl9saWdodENvbXBvc2l0aW9uRGF0YVtsaWdodEluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRDb21wRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0Q29tcERhdGEgPSBuZXcgTGlnaHRDb21wb3NpdGlvbkRhdGEoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9saWdodENvbXBvc2l0aW9uRGF0YVtsaWdodEluZGV4XSA9IGxpZ2h0Q29tcERhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNwbGl0IGxheWVyIGxpZ2h0cyBsaXN0cyBieSB0eXBlXG4gICAgICAgICAgICB0aGlzLl9zcGxpdExpZ2h0c0FycmF5KGxheWVyKTtcbiAgICAgICAgICAgIGxheWVyLl9kaXJ0eUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGVtcFNldC5jbGVhcigpO1xuXG4gICAgICAgIC8vIHNwbGl0IGxpZ2h0IGxpc3QgYnkgdHlwZVxuICAgICAgICB0aGlzLl9zcGxpdExpZ2h0c0FycmF5KHRoaXMpO1xuXG4gICAgICAgIC8vIGFkanVzdCBfbGlnaHRDb21wb3NpdGlvbkRhdGEgdG8gdGhlIHJpZ2h0IHNpemUsIG1hdGNoaW5nIG51bWJlciBvZiBsaWdodHNcbiAgICAgICAgY29uc3QgbGlnaHRDb3VudCA9IHRoaXMuX2xpZ2h0cy5sZW5ndGg7XG4gICAgICAgIHRoaXMuX2xpZ2h0Q29tcG9zaXRpb25EYXRhLmxlbmd0aCA9IGxpZ2h0Q291bnQ7XG4gICAgfVxuXG4gICAgLy8gZmluZCBleGlzdGluZyBsaWdodCBjbHVzdGVyIHRoYXQgaXMgY29tcGF0aWJsZSB3aXRoIHNwZWNpZmllZCBsYXllclxuICAgIGZpbmRDb21wYXRpYmxlQ2x1c3RlcihsYXllciwgcmVuZGVyQWN0aW9uQ291bnQsIGVtcHR5V29ybGRDbHVzdGVycykge1xuXG4gICAgICAgIC8vIGNoZWNrIGFscmVhZHkgc2V0IHVwIHJlbmRlciBhY3Rpb25zXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyQWN0aW9uQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgcmFMYXllciA9IHRoaXMubGF5ZXJMaXN0W3JhLmxheWVySW5kZXhdO1xuXG4gICAgICAgICAgICAvLyBvbmx5IHJldXNlIGNsdXN0ZXJzIGlmIG5vdCBlbXB0eVxuICAgICAgICAgICAgaWYgKHJhLmxpZ2h0Q2x1c3RlcnMgIT09IGVtcHR5V29ybGRDbHVzdGVycykge1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgbGF5ZXIgaXMgdGhlIHNhbWUgKGJ1dCBkaWZmZXJlbnQgc3VibGF5ZXIpLCBjbHVzdGVyIGNhbiBiZSB1c2VkIGRpcmVjdGx5IGFzIGxpZ2h0cyBhcmUgdGhlIHNhbWVcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIgPT09IHJhTGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJhLmxpZ2h0Q2x1c3RlcnM7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHJhLmxpZ2h0Q2x1c3RlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIGxheWVyIGhhcyBleGFjdGx5IHRoZSBzYW1lIHNldCBvZiBsaWdodHMsIHVzZSB0aGUgc2FtZSBjbHVzdGVyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZXQuZXF1YWxzKGxheWVyLl9jbHVzdGVyZWRMaWdodHNTZXQsIHJhTGF5ZXIuX2NsdXN0ZXJlZExpZ2h0c1NldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiByYS5saWdodENsdXN0ZXJzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gbm8gbWF0Y2hcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gYXNzaWduIGxpZ2h0IGNsdXN0ZXJzIHRvIHJlbmRlciBhY3Rpb25zIHRoYXQgbmVlZCBpdFxuICAgIGFsbG9jYXRlTGlnaHRDbHVzdGVycyhkZXZpY2UpIHtcblxuICAgICAgICAvLyByZXVzZSBwcmV2aW91c2x5IGFsbG9jYXRlZCBjbHVzdGVyc1xuICAgICAgICB0ZW1wQ2x1c3RlckFycmF5LnB1c2goLi4udGhpcy5fd29ybGRDbHVzdGVycyk7XG5cbiAgICAgICAgLy8gdGhlIGNsdXN0ZXIgd2l0aCBubyBsaWdodHNcbiAgICAgICAgY29uc3QgZW1wdHlXb3JsZENsdXN0ZXJzID0gdGhpcy5nZXRFbXB0eVdvcmxkQ2x1c3RlcnMoZGV2aWNlKTtcblxuICAgICAgICAvLyBzdGFydCB3aXRoIG5vIGNsdXN0ZXJzXG4gICAgICAgIHRoaXMuX3dvcmxkQ2x1c3RlcnMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBwcm9jZXNzIGFsbCByZW5kZXIgYWN0aW9uc1xuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMuX3JlbmRlckFjdGlvbnMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJhID0gdGhpcy5fcmVuZGVyQWN0aW9uc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllckxpc3RbcmEubGF5ZXJJbmRleF07XG5cbiAgICAgICAgICAgIHJhLmxpZ2h0Q2x1c3RlcnMgPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgbGF5ZXIgaGFzIGxpZ2h0cyB1c2VkIGJ5IGNsdXN0ZXJzXG4gICAgICAgICAgICBpZiAobGF5ZXIuaGFzQ2x1c3RlcmVkTGlnaHRzKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBhbmQgaWYgdGhlIGxheWVyIGhhcyBtZXNoZXNcbiAgICAgICAgICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IHRoaXMuc3ViTGF5ZXJMaXN0W3JhLmxheWVySW5kZXhdO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSB0cmFuc3BhcmVudCA/IGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyA6IGxheWVyLm9wYXF1ZU1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMubGVuZ3RoKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmV1c2UgY2x1c3RlciB0aGF0IHdhcyBhbHJlYWR5IHNldCB1cCBhbmQgaXMgY29tcGF0aWJsZVxuICAgICAgICAgICAgICAgICAgICBsZXQgY2x1c3RlcnMgPSB0aGlzLmZpbmRDb21wYXRpYmxlQ2x1c3RlcihsYXllciwgaSwgZW1wdHlXb3JsZENsdXN0ZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjbHVzdGVycykge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB1c2UgYWxyZWFkeSBhbGxvY2F0ZWQgY2x1c3RlciBmcm9tIGJlZm9yZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRlbXBDbHVzdGVyQXJyYXkubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2x1c3RlcnMgPSB0ZW1wQ2x1c3RlckFycmF5LnBvcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgbmV3IGNsdXN0ZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2x1c3RlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbHVzdGVycyA9IG5ldyBXb3JsZENsdXN0ZXJzKGRldmljZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsdXN0ZXJzLm5hbWUgPSAnQ2x1c3Rlci0nICsgdGhpcy5fd29ybGRDbHVzdGVycy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl93b3JsZENsdXN0ZXJzLnB1c2goY2x1c3RlcnMpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmEubGlnaHRDbHVzdGVycyA9IGNsdXN0ZXJzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbm8gY2x1c3RlcmVkIGxpZ2h0cywgdXNlIHRoZSBjbHVzdGVyIHdpdGggbm8gbGlnaHRzXG4gICAgICAgICAgICBpZiAoIXJhLmxpZ2h0Q2x1c3RlcnMpIHtcbiAgICAgICAgICAgICAgICByYS5saWdodENsdXN0ZXJzID0gZW1wdHlXb3JsZENsdXN0ZXJzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVsZXRlIGxlZnRvdmVyc1xuICAgICAgICB0ZW1wQ2x1c3RlckFycmF5LmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIGl0ZW0uZGVzdHJveSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGVtcENsdXN0ZXJBcnJheS5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIC8vIGZ1bmN0aW9uIGFkZHMgbmV3IHJlbmRlciBhY3Rpb24gdG8gYSBsaXN0LCB3aGlsZSB0cnlpbmcgdG8gbGltaXQgYWxsb2NhdGlvbiBhbmQgcmV1c2UgYWxyZWFkeSBhbGxvY2F0ZWQgb2JqZWN0c1xuICAgIGFkZFJlbmRlckFjdGlvbihyZW5kZXJBY3Rpb25zLCByZW5kZXJBY3Rpb25JbmRleCwgbGF5ZXIsIGxheWVySW5kZXgsIGNhbWVyYUluZGV4LCBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiwgcG9zdFByb2Nlc3NNYXJrZWQpIHtcblxuICAgICAgICAvLyB0cnkgYW5kIHJldXNlIG9iamVjdCwgb3RoZXJ3aXNlIGFsbG9jYXRlIG5ld1xuICAgICAgICAvKiogQHR5cGUge1JlbmRlckFjdGlvbn0gKi9cbiAgICAgICAgbGV0IHJlbmRlckFjdGlvbiA9IHJlbmRlckFjdGlvbnNbcmVuZGVyQWN0aW9uSW5kZXhdO1xuICAgICAgICBpZiAoIXJlbmRlckFjdGlvbikge1xuICAgICAgICAgICAgcmVuZGVyQWN0aW9uID0gcmVuZGVyQWN0aW9uc1tyZW5kZXJBY3Rpb25JbmRleF0gPSBuZXcgUmVuZGVyQWN0aW9uKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW5kZXIgdGFyZ2V0IGZyb20gdGhlIGNhbWVyYSB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgdGhlIHJlbmRlciB0YXJnZXQgZnJvbSB0aGUgbGF5ZXJcbiAgICAgICAgbGV0IHJ0ID0gbGF5ZXIucmVuZGVyVGFyZ2V0O1xuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gKi9cbiAgICAgICAgY29uc3QgY2FtZXJhID0gbGF5ZXIuY2FtZXJhc1tjYW1lcmFJbmRleF07XG4gICAgICAgIGlmIChjYW1lcmEgJiYgY2FtZXJhLnJlbmRlclRhcmdldCkge1xuICAgICAgICAgICAgaWYgKGxheWVyLmlkICE9PSBMQVlFUklEX0RFUFRIKSB7ICAgLy8gaWdub3JlIGRlcHRoIGxheWVyXG4gICAgICAgICAgICAgICAgcnQgPSBjYW1lcmEucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gd2FzIGNhbWVyYSBhbmQgcmVuZGVyIHRhcmdldCBjb21ibyB1c2VkIGFscmVhZHlcbiAgICAgICAgbGV0IHVzZWQgPSBmYWxzZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IHJlbmRlckFjdGlvbkluZGV4IC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGlmIChyZW5kZXJBY3Rpb25zW2ldLmNhbWVyYSA9PT0gY2FtZXJhICYmIHJlbmRlckFjdGlvbnNbaV0ucmVuZGVyVGFyZ2V0ID09PSBydCkge1xuICAgICAgICAgICAgICAgIHVzZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2xlYXIgZmxhZ3MgLSB1c2UgY2FtZXJhIGNsZWFyIGZsYWdzIGluIHRoZSBmaXJzdCByZW5kZXIgYWN0aW9uIGZvciBlYWNoIGNhbWVyYSxcbiAgICAgICAgLy8gb3Igd2hlbiByZW5kZXIgdGFyZ2V0IChmcm9tIGxheWVyKSB3YXMgbm90IHlldCBjbGVhcmVkIGJ5IHRoaXMgY2FtZXJhXG4gICAgICAgIGNvbnN0IG5lZWRzQ2xlYXIgPSBjYW1lcmFGaXJzdFJlbmRlckFjdGlvbiB8fCAhdXNlZDtcbiAgICAgICAgbGV0IGNsZWFyQ29sb3IgPSBuZWVkc0NsZWFyID8gY2FtZXJhLmNsZWFyQ29sb3JCdWZmZXIgOiBmYWxzZTtcbiAgICAgICAgbGV0IGNsZWFyRGVwdGggPSBuZWVkc0NsZWFyID8gY2FtZXJhLmNsZWFyRGVwdGhCdWZmZXIgOiBmYWxzZTtcbiAgICAgICAgbGV0IGNsZWFyU3RlbmNpbCA9IG5lZWRzQ2xlYXIgPyBjYW1lcmEuY2xlYXJTdGVuY2lsQnVmZmVyIDogZmFsc2U7XG5cbiAgICAgICAgLy8gY2xlYXIgYnVmZmVycyBpZiByZXF1ZXN0ZWQgYnkgdGhlIGxheWVyXG4gICAgICAgIGNsZWFyQ29sb3IgfHw9IGxheWVyLmNsZWFyQ29sb3JCdWZmZXI7XG4gICAgICAgIGNsZWFyRGVwdGggfHw9IGxheWVyLmNsZWFyRGVwdGhCdWZmZXI7XG4gICAgICAgIGNsZWFyU3RlbmNpbCB8fD0gbGF5ZXIuY2xlYXJTdGVuY2lsQnVmZmVyO1xuXG4gICAgICAgIC8vIGZvciBjYW1lcmFzIHdpdGggcG9zdCBwcm9jZXNzaW5nIGVuYWJsZWQsIG9uIGxheWVycyBhZnRlciBwb3N0IHByb2Nlc3NpbmcgaGFzIGJlZW4gYXBwbGllZCBhbHJlYWR5IChzbyBVSSBhbmQgc2ltaWxhciksXG4gICAgICAgIC8vIGRvbid0IHJlbmRlciB0aGVtIHRvIHJlbmRlciB0YXJnZXQgYW55bW9yZVxuICAgICAgICBpZiAocG9zdFByb2Nlc3NNYXJrZWQgJiYgY2FtZXJhLnBvc3RFZmZlY3RzRW5hYmxlZCkge1xuICAgICAgICAgICAgcnQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RvcmUgdGhlIHByb3BlcnRpZXMgLSB3cml0ZSBhbGwgYXMgd2UgcmV1c2UgcHJldmlvdXNseSBhbGxvY2F0ZWQgY2xhc3MgaW5zdGFuY2VzXG4gICAgICAgIHJlbmRlckFjdGlvbi5yZXNldCgpO1xuICAgICAgICByZW5kZXJBY3Rpb24udHJpZ2dlclBvc3Rwcm9jZXNzID0gZmFsc2U7XG4gICAgICAgIHJlbmRlckFjdGlvbi5sYXllckluZGV4ID0gbGF5ZXJJbmRleDtcbiAgICAgICAgcmVuZGVyQWN0aW9uLmNhbWVyYUluZGV4ID0gY2FtZXJhSW5kZXg7XG4gICAgICAgIHJlbmRlckFjdGlvbi5jYW1lcmEgPSBjYW1lcmE7XG4gICAgICAgIHJlbmRlckFjdGlvbi5yZW5kZXJUYXJnZXQgPSBydDtcbiAgICAgICAgcmVuZGVyQWN0aW9uLmNsZWFyQ29sb3IgPSBjbGVhckNvbG9yO1xuICAgICAgICByZW5kZXJBY3Rpb24uY2xlYXJEZXB0aCA9IGNsZWFyRGVwdGg7XG4gICAgICAgIHJlbmRlckFjdGlvbi5jbGVhclN0ZW5jaWwgPSBjbGVhclN0ZW5jaWw7XG4gICAgICAgIHJlbmRlckFjdGlvbi5maXJzdENhbWVyYVVzZSA9IGNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uO1xuICAgICAgICByZW5kZXJBY3Rpb24ubGFzdENhbWVyYVVzZSA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiByZW5kZXJBY3Rpb247XG4gICAgfVxuXG4gICAgLy8gZXhlY3V0ZXMgd2hlbiBwb3N0LXByb2Nlc3NpbmcgY2FtZXJhJ3MgcmVuZGVyIGFjdGlvbnMgd2VyZSBjcmVhdGVkIHRvIHByb3BhZ2F0ZSByZW5kZXJpbmcgdG9cbiAgICAvLyByZW5kZXIgdGFyZ2V0cyB0byBwcmV2aW91cyBjYW1lcmEgYXMgbmVlZGVkXG4gICAgcHJvcGFnYXRlUmVuZGVyVGFyZ2V0KHN0YXJ0SW5kZXgsIGZyb21DYW1lcmEpIHtcblxuICAgICAgICBmb3IgKGxldCBhID0gc3RhcnRJbmRleDsgYSA+PSAwOyBhLS0pIHtcblxuICAgICAgICAgICAgY29uc3QgcmEgPSB0aGlzLl9yZW5kZXJBY3Rpb25zW2FdO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtyYS5sYXllckluZGV4XTtcblxuICAgICAgICAgICAgLy8gaWYgd2UgaGl0IHJlbmRlciBhY3Rpb24gd2l0aCBhIHJlbmRlciB0YXJnZXQgKG90aGVyIHRoYW4gZGVwdGggbGF5ZXIpLCB0aGF0IG1hcmtzIHRoZSBlbmQgb2YgY2FtZXJhIHN0YWNrXG4gICAgICAgICAgICAvLyBUT0RPOiByZWZhY3RvciB0aGlzIGFzIHBhcnQgb2YgZGVwdGggbGF5ZXIgcmVmYWN0b3JpbmdcbiAgICAgICAgICAgIGlmIChyYS5yZW5kZXJUYXJnZXQgJiYgbGF5ZXIuaWQgIT09IExBWUVSSURfREVQVEgpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2tpcCBvdmVyIGRlcHRoIGxheWVyXG4gICAgICAgICAgICBpZiAobGF5ZXIuaWQgPT09IExBWUVSSURfREVQVEgpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2FtZXJhIHN0YWNrIGVuZHMgd2hlbiB2aWV3cG9ydCBvciBzY2lzc29yIG9mIHRoZSBjYW1lcmEgY2hhbmdlc1xuICAgICAgICAgICAgY29uc3QgdGhpc0NhbWVyYSA9IHJhPy5jYW1lcmEuY2FtZXJhO1xuICAgICAgICAgICAgaWYgKHRoaXNDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWZyb21DYW1lcmEuY2FtZXJhLnJlY3QuZXF1YWxzKHRoaXNDYW1lcmEucmVjdCkgfHwgIWZyb21DYW1lcmEuY2FtZXJhLnNjaXNzb3JSZWN0LmVxdWFscyh0aGlzQ2FtZXJhLnNjaXNzb3JSZWN0KSkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBpdCB0byByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICByYS5yZW5kZXJUYXJnZXQgPSBmcm9tQ2FtZXJhLnJlbmRlclRhcmdldDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGxvZ3MgcmVuZGVyIGFjdGlvbiBhbmQgdGhlaXIgcHJvcGVydGllc1xuICAgIF9sb2dSZW5kZXJBY3Rpb25zKCkge1xuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKFRyYWNpbmcuZ2V0KFRSQUNFSURfUkVOREVSX0FDVElPTikpIHtcbiAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0FDVElPTiwgJ1JlbmRlciBBY3Rpb25zIGZvciBjb21wb3NpdGlvbjogJyArIHRoaXMubmFtZSk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3JlbmRlckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCByYSA9IHRoaXMuX3JlbmRlckFjdGlvbnNbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXJJbmRleCA9IHJhLmxheWVySW5kZXg7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVyTGlzdFtsYXllckluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbmFibGVkID0gbGF5ZXIuZW5hYmxlZCAmJiB0aGlzLnN1YkxheWVyRW5hYmxlZFtsYXllckluZGV4XTtcbiAgICAgICAgICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IHRoaXMuc3ViTGF5ZXJMaXN0W2xheWVySW5kZXhdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGxheWVyLmNhbWVyYXNbcmEuY2FtZXJhSW5kZXhdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpckxpZ2h0Q291bnQgPSByYS5kaXJlY3Rpb25hbExpZ2h0cy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xlYXIgPSAocmEuY2xlYXJDb2xvciA/ICdDb2xvciAnIDogJy4uLi4uICcpICsgKHJhLmNsZWFyRGVwdGggPyAnRGVwdGggJyA6ICcuLi4uLiAnKSArIChyYS5jbGVhclN0ZW5jaWwgPyAnU3RlbmNpbCcgOiAnLi4uLi4uLicpO1xuXG4gICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfQUNUSU9OLCBpICtcbiAgICAgICAgICAgICAgICAgICAgKCcgQ2FtOiAnICsgKGNhbWVyYSA/IGNhbWVyYS5lbnRpdHkubmFtZSA6ICctJykpLnBhZEVuZCgyMiwgJyAnKSArXG4gICAgICAgICAgICAgICAgICAgICgnIExheTogJyArIGxheWVyLm5hbWUpLnBhZEVuZCgyMiwgJyAnKSArXG4gICAgICAgICAgICAgICAgICAgICh0cmFuc3BhcmVudCA/ICcgVFJBTlNQJyA6ICcgT1BBUVVFJykgK1xuICAgICAgICAgICAgICAgICAgICAoZW5hYmxlZCA/ICcgRU5BQkxFRCAnIDogJyBESVNBQkxFRCcpICtcbiAgICAgICAgICAgICAgICAgICAgJyBNZXNoZXM6ICcsICh0cmFuc3BhcmVudCA/IGxheWVyLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcy5sZW5ndGggOiBsYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzLmxlbmd0aCkudG9TdHJpbmcoKS5wYWRTdGFydCg0KSArXG4gICAgICAgICAgICAgICAgICAgICgnIFJUOiAnICsgKHJhLnJlbmRlclRhcmdldCA/IHJhLnJlbmRlclRhcmdldC5uYW1lIDogJy0nKSkucGFkRW5kKDMwLCAnICcpICtcbiAgICAgICAgICAgICAgICAgICAgJyBDbGVhcjogJyArIGNsZWFyICtcbiAgICAgICAgICAgICAgICAgICAgJyBMaWdodHM6ICgnICsgbGF5ZXIuX2NsdXN0ZXJlZExpZ2h0c1NldC5zaXplICsgJy8nICsgbGF5ZXIuX2xpZ2h0c1NldC5zaXplICsgJyknICtcbiAgICAgICAgICAgICAgICAgICAgJyAnICsgKHJhLmxpZ2h0Q2x1c3RlcnMgIT09IHRoaXMuX2VtcHR5V29ybGRDbHVzdGVycyA/IChyYS5saWdodENsdXN0ZXJzLm5hbWUpIDogJycpLnBhZEVuZCgxMCwgJyAnKSArXG4gICAgICAgICAgICAgICAgICAgIChyYS5maXJzdENhbWVyYVVzZSA/ICcgQ0FNLUZJUlNUJyA6ICcnKSArXG4gICAgICAgICAgICAgICAgICAgIChyYS5sYXN0Q2FtZXJhVXNlID8gJyBDQU0tTEFTVCcgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgICAocmEudHJpZ2dlclBvc3Rwcm9jZXNzID8gJyBQT1NUUFJPQ0VTUycgOiAnJykgK1xuICAgICAgICAgICAgICAgICAgICAoZGlyTGlnaHRDb3VudCA/ICgnIERpckxpZ2h0czogJyArIGRpckxpZ2h0Q291bnQpIDogJycpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBfaXNMYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGlmICh0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKSA+PSAwKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcignTGF5ZXIgaXMgYWxyZWFkeSBhZGRlZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfaXNTdWJsYXllckFkZGVkKGxheWVyLCB0cmFuc3BhcmVudCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0gPT09IGxheWVyICYmIHRoaXMuc3ViTGF5ZXJMaXN0W2ldID09PSB0cmFuc3BhcmVudCkge1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKCdTdWJsYXllciBpcyBhbHJlYWR5IGFkZGVkLicpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBXaG9sZSBsYXllciBBUElcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBsYXllciAoYm90aCBvcGFxdWUgYW5kIHNlbWktdHJhbnNwYXJlbnQgcGFydHMpIHRvIHRoZSBlbmQgb2YgdGhlIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqL1xuICAgIHB1c2gobGF5ZXIpIHtcbiAgICAgICAgLy8gYWRkIGJvdGggb3BhcXVlIGFuZCB0cmFuc3BhcmVudCB0byB0aGUgZW5kIG9mIHRoZSBhcnJheVxuICAgICAgICBpZiAodGhpcy5faXNMYXllckFkZGVkKGxheWVyKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmxheWVyTGlzdC5wdXNoKGxheWVyKTtcbiAgICAgICAgdGhpcy5sYXllckxpc3QucHVzaChsYXllcik7XG4gICAgICAgIHRoaXMuX29wYXF1ZU9yZGVyW2xheWVyLmlkXSA9IHRoaXMuc3ViTGF5ZXJMaXN0LnB1c2goZmFsc2UpIC0gMTtcbiAgICAgICAgdGhpcy5fdHJhbnNwYXJlbnRPcmRlcltsYXllci5pZF0gPSB0aGlzLnN1YkxheWVyTGlzdC5wdXNoKHRydWUpIC0gMTtcbiAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQucHVzaCh0cnVlKTtcbiAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQucHVzaCh0cnVlKTtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgIHRoaXMuZmlyZSgnYWRkJywgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydHMgYSBsYXllciAoYm90aCBvcGFxdWUgYW5kIHNlbWktdHJhbnNwYXJlbnQgcGFydHMpIGF0IHRoZSBjaG9zZW4gaW5kZXggaW4gdGhlXG4gICAgICoge0BsaW5rIExheWVyQ29tcG9zaXRpb24jbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBhZGQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gSW5zZXJ0aW9uIHBvc2l0aW9uLlxuICAgICAqL1xuICAgIGluc2VydChsYXllciwgaW5kZXgpIHtcbiAgICAgICAgLy8gaW5zZXJ0IGJvdGggb3BhcXVlIGFuZCB0cmFuc3BhcmVudCBhdCB0aGUgaW5kZXhcbiAgICAgICAgaWYgKHRoaXMuX2lzTGF5ZXJBZGRlZChsYXllcikpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCBsYXllciwgbGF5ZXIpO1xuICAgICAgICB0aGlzLnN1YkxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIGZhbHNlLCB0cnVlKTtcblxuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDtcbiAgICAgICAgdGhpcy5fdXBkYXRlT3BhcXVlT3JkZXIoaW5kZXgsIGNvdW50IC0gMSk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIoaW5kZXgsIGNvdW50IC0gMSk7XG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpbmRleCwgMCwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgbGF5ZXIgKGJvdGggb3BhcXVlIGFuZCBzZW1pLXRyYW5zcGFyZW50IHBhcnRzKSBmcm9tIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gcmVtb3ZlLlxuICAgICAqL1xuICAgIHJlbW92ZShsYXllcikge1xuICAgICAgICAvLyByZW1vdmUgYWxsIG9jY3VycmVuY2VzIG9mIGEgbGF5ZXJcbiAgICAgICAgbGV0IGlkID0gdGhpcy5sYXllckxpc3QuaW5kZXhPZihsYXllcik7XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuX29wYXF1ZU9yZGVyW2lkXTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3RyYW5zcGFyZW50T3JkZXJbaWRdO1xuXG4gICAgICAgIHdoaWxlIChpZCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmxheWVyTGlzdC5zcGxpY2UoaWQsIDEpO1xuICAgICAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGlkLCAxKTtcbiAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpZCwgMSk7XG4gICAgICAgICAgICBpZCA9IHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIpO1xuICAgICAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlJywgbGF5ZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIGJvdGggb3JkZXJzXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5sYXllckxpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLl91cGRhdGVPcGFxdWVPcmRlcigwLCBjb3VudCAtIDEpO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc3BhcmVudE9yZGVyKDAsIGNvdW50IC0gMSk7XG4gICAgfVxuXG4gICAgLy8gU3VibGF5ZXIgQVBJXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIHBhcnQgb2YgdGhlIGxheWVyIHdpdGggb3BhcXVlIChub24gc2VtaS10cmFuc3BhcmVudCkgb2JqZWN0cyB0byB0aGUgZW5kIG9mIHRoZVxuICAgICAqIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqL1xuICAgIHB1c2hPcGFxdWUobGF5ZXIpIHtcbiAgICAgICAgLy8gYWRkIG9wYXF1ZSB0byB0aGUgZW5kIG9mIHRoZSBhcnJheVxuICAgICAgICBpZiAodGhpcy5faXNTdWJsYXllckFkZGVkKGxheWVyLCBmYWxzZSkpIHJldHVybjtcbiAgICAgICAgdGhpcy5sYXllckxpc3QucHVzaChsYXllcik7XG4gICAgICAgIHRoaXMuX29wYXF1ZU9yZGVyW2xheWVyLmlkXSA9IHRoaXMuc3ViTGF5ZXJMaXN0LnB1c2goZmFsc2UpIC0gMTtcbiAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQucHVzaCh0cnVlKTtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgIHRoaXMuZmlyZSgnYWRkJywgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydHMgYW4gb3BhcXVlIHBhcnQgb2YgdGhlIGxheWVyIChub24gc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcykgYXQgdGhlIGNob3NlblxuICAgICAqIGluZGV4IGluIHRoZSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGFkZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBJbnNlcnRpb24gcG9zaXRpb24uXG4gICAgICovXG4gICAgaW5zZXJ0T3BhcXVlKGxheWVyLCBpbmRleCkge1xuICAgICAgICAvLyBpbnNlcnQgb3BhcXVlIGF0IGluZGV4XG4gICAgICAgIGlmICh0aGlzLl9pc1N1YmxheWVyQWRkZWQobGF5ZXIsIGZhbHNlKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIGxheWVyKTtcbiAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGluZGV4LCAwLCBmYWxzZSk7XG5cbiAgICAgICAgY29uc3QgY291bnQgPSB0aGlzLnN1YkxheWVyTGlzdC5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU9wYXF1ZU9yZGVyKGluZGV4LCBjb3VudCAtIDEpO1xuXG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpbmRleCwgMCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFuIG9wYXF1ZSBwYXJ0IG9mIHRoZSBsYXllciAobm9uIHNlbWktdHJhbnNwYXJlbnQgbWVzaCBpbnN0YW5jZXMpIGZyb21cbiAgICAgKiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICByZW1vdmVPcGFxdWUobGF5ZXIpIHtcbiAgICAgICAgLy8gcmVtb3ZlIG9wYXF1ZSBvY2N1cnJlbmNlcyBvZiBhIGxheWVyXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmxheWVyTGlzdC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMubGF5ZXJMaXN0W2ldID09PSBsYXllciAmJiAhdGhpcy5zdWJMYXllckxpc3RbaV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxheWVyTGlzdC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGksIDEpO1xuXG4gICAgICAgICAgICAgICAgbGVuLS07XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlT3BhcXVlT3JkZXIoaSwgbGVuIC0gMSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLnN1YkxheWVyRW5hYmxlZC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdC5pbmRleE9mKGxheWVyKSA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmUnLCBsYXllcik7IC8vIG5vIHN1YmxheWVycyBsZWZ0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgcGFydCBvZiB0aGUgbGF5ZXIgd2l0aCBzZW1pLXRyYW5zcGFyZW50IG9iamVjdHMgdG8gdGhlIGVuZCBvZiB0aGUge0BsaW5rIExheWVyQ29tcG9zaXRpb24jbGF5ZXJMaXN0fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9sYXllci5qcycpLkxheWVyfSBsYXllciAtIEEge0BsaW5rIExheWVyfSB0byBhZGQuXG4gICAgICovXG4gICAgcHVzaFRyYW5zcGFyZW50KGxheWVyKSB7XG4gICAgICAgIC8vIGFkZCB0cmFuc3BhcmVudCB0byB0aGUgZW5kIG9mIHRoZSBhcnJheVxuICAgICAgICBpZiAodGhpcy5faXNTdWJsYXllckFkZGVkKGxheWVyLCB0cnVlKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmxheWVyTGlzdC5wdXNoKGxheWVyKTtcbiAgICAgICAgdGhpcy5fdHJhbnNwYXJlbnRPcmRlcltsYXllci5pZF0gPSB0aGlzLnN1YkxheWVyTGlzdC5wdXNoKHRydWUpIC0gMTtcbiAgICAgICAgdGhpcy5zdWJMYXllckVuYWJsZWQucHVzaCh0cnVlKTtcbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgIHRoaXMuZmlyZSgnYWRkJywgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydHMgYSBzZW1pLXRyYW5zcGFyZW50IHBhcnQgb2YgdGhlIGxheWVyIGF0IHRoZSBjaG9zZW4gaW5kZXggaW4gdGhlIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gYWRkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIEluc2VydGlvbiBwb3NpdGlvbi5cbiAgICAgKi9cbiAgICBpbnNlcnRUcmFuc3BhcmVudChsYXllciwgaW5kZXgpIHtcbiAgICAgICAgLy8gaW5zZXJ0IHRyYW5zcGFyZW50IGF0IGluZGV4XG4gICAgICAgIGlmICh0aGlzLl9pc1N1YmxheWVyQWRkZWQobGF5ZXIsIHRydWUpKSByZXR1cm47XG4gICAgICAgIHRoaXMubGF5ZXJMaXN0LnNwbGljZShpbmRleCwgMCwgbGF5ZXIpO1xuICAgICAgICB0aGlzLnN1YkxheWVyTGlzdC5zcGxpY2UoaW5kZXgsIDAsIHRydWUpO1xuXG4gICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5zdWJMYXllckxpc3QubGVuZ3RoO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc3BhcmVudE9yZGVyKGluZGV4LCBjb3VudCAtIDEpO1xuXG4gICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpbmRleCwgMCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgdHJhbnNwYXJlbnQgcGFydCBvZiB0aGUgbGF5ZXIgZnJvbSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICByZW1vdmVUcmFuc3BhcmVudChsYXllcikge1xuICAgICAgICAvLyByZW1vdmUgdHJhbnNwYXJlbnQgb2NjdXJyZW5jZXMgb2YgYSBsYXllclxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5sYXllckxpc3QubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdFtpXSA9PT0gbGF5ZXIgJiYgdGhpcy5zdWJMYXllckxpc3RbaV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmxheWVyTGlzdC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zdWJMYXllckxpc3Quc3BsaWNlKGksIDEpO1xuXG4gICAgICAgICAgICAgICAgbGVuLS07XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNwYXJlbnRPcmRlcihpLCBsZW4gLSAxKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc3ViTGF5ZXJFbmFibGVkLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIpIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGxheWVyKTsgLy8gbm8gc3VibGF5ZXJzIGxlZnRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2dldFN1YmxheWVySW5kZXgobGF5ZXIsIHRyYW5zcGFyZW50KSB7XG4gICAgICAgIC8vIGZpbmQgc3VibGF5ZXIgaW5kZXggaW4gdGhlIGNvbXBvc2l0aW9uIGFycmF5XG4gICAgICAgIGxldCBpZCA9IHRoaXMubGF5ZXJMaXN0LmluZGV4T2YobGF5ZXIpO1xuICAgICAgICBpZiAoaWQgPCAwKSByZXR1cm4gLTE7XG5cbiAgICAgICAgaWYgKHRoaXMuc3ViTGF5ZXJMaXN0W2lkXSAhPT0gdHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgIGlkID0gdGhpcy5sYXllckxpc3QuaW5kZXhPZihsYXllciwgaWQgKyAxKTtcbiAgICAgICAgICAgIGlmIChpZCA8IDApIHJldHVybiAtMTtcbiAgICAgICAgICAgIGlmICh0aGlzLnN1YkxheWVyTGlzdFtpZF0gIT09IHRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGluZGV4IG9mIHRoZSBvcGFxdWUgcGFydCBvZiB0aGUgc3VwcGxpZWQgbGF5ZXIgaW4gdGhlIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2xheWVyTGlzdH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcn0gbGF5ZXIgLSBBIHtAbGluayBMYXllcn0gdG8gZmluZCBpbmRleCBvZi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgaW5kZXggb2YgdGhlIG9wYXF1ZSBwYXJ0IG9mIHRoZSBzcGVjaWZpZWQgbGF5ZXIuXG4gICAgICovXG4gICAgZ2V0T3BhcXVlSW5kZXgobGF5ZXIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFN1YmxheWVySW5kZXgobGF5ZXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGluZGV4IG9mIHRoZSBzZW1pLXRyYW5zcGFyZW50IHBhcnQgb2YgdGhlIHN1cHBsaWVkIGxheWVyIGluIHRoZSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNsYXllckxpc3R9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ9IGxheWVyIC0gQSB7QGxpbmsgTGF5ZXJ9IHRvIGZpbmQgaW5kZXggb2YuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGluZGV4IG9mIHRoZSBzZW1pLXRyYW5zcGFyZW50IHBhcnQgb2YgdGhlIHNwZWNpZmllZCBsYXllci5cbiAgICAgKi9cbiAgICBnZXRUcmFuc3BhcmVudEluZGV4KGxheWVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTdWJsYXllckluZGV4KGxheWVyLCB0cnVlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaW5kcyBhIGxheWVyIGluc2lkZSB0aGlzIGNvbXBvc2l0aW9uIGJ5IGl0cyBJRC4gTnVsbCBpcyByZXR1cm5lZCwgaWYgbm90aGluZyBpcyBmb3VuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpZCAtIEFuIElEIG9mIHRoZSBsYXllciB0byBmaW5kLlxuICAgICAqIEByZXR1cm5zIHtpbXBvcnQoJy4uL2xheWVyLmpzJykuTGF5ZXJ8bnVsbH0gVGhlIGxheWVyIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNwZWNpZmllZCBJRC5cbiAgICAgKiBSZXR1cm5zIG51bGwgaWYgbGF5ZXIgaXMgbm90IGZvdW5kLlxuICAgICAqL1xuICAgIGdldExheWVyQnlJZChpZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5sYXllckxpc3RbaV0uaWQgPT09IGlkKSByZXR1cm4gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgYSBsYXllciBpbnNpZGUgdGhpcyBjb21wb3NpdGlvbiBieSBpdHMgbmFtZS4gTnVsbCBpcyByZXR1cm5lZCwgaWYgbm90aGluZyBpcyBmb3VuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGxheWVyIHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi4vbGF5ZXIuanMnKS5MYXllcnxudWxsfSBUaGUgbGF5ZXIgY29ycmVzcG9uZGluZyB0byB0aGUgc3BlY2lmaWVkIG5hbWUuXG4gICAgICogUmV0dXJucyBudWxsIGlmIGxheWVyIGlzIG5vdCBmb3VuZC5cbiAgICAgKi9cbiAgICBnZXRMYXllckJ5TmFtZShuYW1lKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllckxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxheWVyTGlzdFtpXS5uYW1lID09PSBuYW1lKSByZXR1cm4gdGhpcy5sYXllckxpc3RbaV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU9wYXF1ZU9yZGVyKHN0YXJ0SW5kZXgsIGVuZEluZGV4KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDw9IGVuZEluZGV4OyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnN1YkxheWVyTGlzdFtpXSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vcGFxdWVPcmRlclt0aGlzLmxheWVyTGlzdFtpXS5pZF0gPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZVRyYW5zcGFyZW50T3JkZXIoc3RhcnRJbmRleCwgZW5kSW5kZXgpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXg7IGkgPD0gZW5kSW5kZXg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuc3ViTGF5ZXJMaXN0W2ldID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJhbnNwYXJlbnRPcmRlclt0aGlzLmxheWVyTGlzdFtpXS5pZF0gPSBpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVXNlZCB0byBkZXRlcm1pbmUgd2hpY2ggYXJyYXkgb2YgbGF5ZXJzIGhhcyBhbnkgc3VibGF5ZXIgdGhhdCBpc1xuICAgIC8vIG9uIHRvcCBvZiBhbGwgdGhlIHN1YmxheWVycyBpbiB0aGUgb3RoZXIgYXJyYXkuIFRoZSBvcmRlciBpcyBhIGRpY3Rpb25hcnlcbiAgICAvLyBvZiA8bGF5ZXJJZCwgaW5kZXg+LlxuICAgIF9zb3J0TGF5ZXJzRGVzY2VuZGluZyhsYXllcnNBLCBsYXllcnNCLCBvcmRlcikge1xuICAgICAgICBsZXQgdG9wTGF5ZXJBID0gLTE7XG4gICAgICAgIGxldCB0b3BMYXllckIgPSAtMTtcblxuICAgICAgICAvLyBzZWFyY2ggZm9yIHdoaWNoIGxheWVyIGlzIG9uIHRvcCBpbiBsYXllcnNBXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsYXllcnNBLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGxheWVyc0FbaV07XG4gICAgICAgICAgICBpZiAob3JkZXIuaGFzT3duUHJvcGVydHkoaWQpKSB7XG4gICAgICAgICAgICAgICAgdG9wTGF5ZXJBID0gTWF0aC5tYXgodG9wTGF5ZXJBLCBvcmRlcltpZF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2VhcmNoIGZvciB3aGljaCBsYXllciBpcyBvbiB0b3AgaW4gbGF5ZXJzQlxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGF5ZXJzQi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgaWQgPSBsYXllcnNCW2ldO1xuICAgICAgICAgICAgaWYgKG9yZGVyLmhhc093blByb3BlcnR5KGlkKSkge1xuICAgICAgICAgICAgICAgIHRvcExheWVyQiA9IE1hdGgubWF4KHRvcExheWVyQiwgb3JkZXJbaWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBsYXllcnMgb2YgbGF5ZXJzQSBvciBsYXllcnNCIGRvIG5vdCBleGlzdCBhdCBhbGxcbiAgICAgICAgLy8gaW4gdGhlIGNvbXBvc2l0aW9uIHRoZW4gcmV0dXJuIGVhcmx5IHdpdGggdGhlIG90aGVyLlxuICAgICAgICBpZiAodG9wTGF5ZXJBID09PSAtMSAmJiB0b3BMYXllckIgIT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfSBlbHNlIGlmICh0b3BMYXllckIgPT09IC0xICYmIHRvcExheWVyQSAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNvcnQgaW4gZGVzY2VuZGluZyBvcmRlciBzaW5jZSB3ZSB3YW50XG4gICAgICAgIC8vIHRoZSBoaWdoZXIgb3JkZXIgdG8gYmUgZmlyc3RcbiAgICAgICAgcmV0dXJuIHRvcExheWVyQiAtIHRvcExheWVyQTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIHRvIGRldGVybWluZSB3aGljaCBhcnJheSBvZiBsYXllcnMgaGFzIGFueSB0cmFuc3BhcmVudCBzdWJsYXllciB0aGF0IGlzIG9uIHRvcCBvZiBhbGxcbiAgICAgKiB0aGUgdHJhbnNwYXJlbnQgc3VibGF5ZXJzIGluIHRoZSBvdGhlciBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGxheWVyc0EgLSBJRHMgb2YgbGF5ZXJzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGxheWVyc0IgLSBJRHMgb2YgbGF5ZXJzLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgYSBuZWdhdGl2ZSBudW1iZXIgaWYgYW55IG9mIHRoZSB0cmFuc3BhcmVudCBzdWJsYXllcnMgaW4gbGF5ZXJzQVxuICAgICAqIGlzIG9uIHRvcCBvZiBhbGwgdGhlIHRyYW5zcGFyZW50IHN1YmxheWVycyBpbiBsYXllcnNCLCBvciBhIHBvc2l0aXZlIG51bWJlciBpZiBhbnkgb2YgdGhlXG4gICAgICogdHJhbnNwYXJlbnQgc3VibGF5ZXJzIGluIGxheWVyc0IgaXMgb24gdG9wIG9mIGFsbCB0aGUgdHJhbnNwYXJlbnQgc3VibGF5ZXJzIGluIGxheWVyc0EsIG9yIDBcbiAgICAgKiBvdGhlcndpc2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzb3J0VHJhbnNwYXJlbnRMYXllcnMobGF5ZXJzQSwgbGF5ZXJzQikge1xuICAgICAgICByZXR1cm4gdGhpcy5fc29ydExheWVyc0Rlc2NlbmRpbmcobGF5ZXJzQSwgbGF5ZXJzQiwgdGhpcy5fdHJhbnNwYXJlbnRPcmRlcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXNlZCB0byBkZXRlcm1pbmUgd2hpY2ggYXJyYXkgb2YgbGF5ZXJzIGhhcyBhbnkgb3BhcXVlIHN1YmxheWVyIHRoYXQgaXMgb24gdG9wIG9mIGFsbCB0aGVcbiAgICAgKiBvcGFxdWUgc3VibGF5ZXJzIGluIHRoZSBvdGhlciBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGxheWVyc0EgLSBJRHMgb2YgbGF5ZXJzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGxheWVyc0IgLSBJRHMgb2YgbGF5ZXJzLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgYSBuZWdhdGl2ZSBudW1iZXIgaWYgYW55IG9mIHRoZSBvcGFxdWUgc3VibGF5ZXJzIGluIGxheWVyc0EgaXMgb25cbiAgICAgKiB0b3Agb2YgYWxsIHRoZSBvcGFxdWUgc3VibGF5ZXJzIGluIGxheWVyc0IsIG9yIGEgcG9zaXRpdmUgbnVtYmVyIGlmIGFueSBvZiB0aGUgb3BhcXVlXG4gICAgICogc3VibGF5ZXJzIGluIGxheWVyc0IgaXMgb24gdG9wIG9mIGFsbCB0aGUgb3BhcXVlIHN1YmxheWVycyBpbiBsYXllcnNBLCBvciAwIG90aGVyd2lzZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHNvcnRPcGFxdWVMYXllcnMobGF5ZXJzQSwgbGF5ZXJzQikge1xuICAgICAgICByZXR1cm4gdGhpcy5fc29ydExheWVyc0Rlc2NlbmRpbmcobGF5ZXJzQSwgbGF5ZXJzQiwgdGhpcy5fb3BhcXVlT3JkZXIpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTGF5ZXJDb21wb3NpdGlvbiB9O1xuIl0sIm5hbWVzIjpbInRlbXBTZXQiLCJTZXQiLCJ0ZW1wQ2x1c3RlckFycmF5IiwiTGF5ZXJDb21wb3NpdGlvbiIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibmFtZSIsImxheWVyTGlzdCIsInN1YkxheWVyTGlzdCIsInN1YkxheWVyRW5hYmxlZCIsIl9vcGFxdWVPcmRlciIsIl90cmFuc3BhcmVudE9yZGVyIiwiX2RpcnR5IiwiX2RpcnR5QmxlbmQiLCJfZGlydHlMaWdodHMiLCJfZGlydHlDYW1lcmFzIiwiX21lc2hJbnN0YW5jZXMiLCJfbWVzaEluc3RhbmNlc1NldCIsIl9saWdodHMiLCJfbGlnaHRzTWFwIiwiTWFwIiwiX2xpZ2h0Q29tcG9zaXRpb25EYXRhIiwiX3NwbGl0TGlnaHRzIiwiY2FtZXJhcyIsIl9yZW5kZXJBY3Rpb25zIiwiX3dvcmxkQ2x1c3RlcnMiLCJfZW1wdHlXb3JsZENsdXN0ZXJzIiwiZGVzdHJveSIsImZvckVhY2giLCJjbHVzdGVyIiwicmEiLCJnZXRFbXB0eVdvcmxkQ2x1c3RlcnMiLCJkZXZpY2UiLCJXb3JsZENsdXN0ZXJzIiwidXBkYXRlIiwiX3NwbGl0TGlnaHRzQXJyYXkiLCJ0YXJnZXQiLCJsaWdodHMiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJsZW5ndGgiLCJMSUdIVFRZUEVfT01OSSIsIkxJR0hUVFlQRV9TUE9UIiwiaSIsImxpZ2h0IiwiZW5hYmxlZCIsIl90eXBlIiwicHVzaCIsIl91cGRhdGUiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJsZW4iLCJyZXN1bHQiLCJsYXllciIsImFkZFVuaXF1ZU1lc2hJbnN0YW5jZSIsImRlc3RBcnJheSIsImRlc3RTZXQiLCJzcmNBcnJheSIsImRpcnR5QmxlbmQiLCJzcmNMZW4iLCJzIiwibWVzaEluc3QiLCJoYXMiLCJhZGQiLCJtYXRlcmlhbCIsIkNPTVBVUERBVEVEX0lOU1RBTkNFUyIsImNsZWFyIiwicGFzc1Rocm91Z2giLCJvcGFxdWVNZXNoSW5zdGFuY2VzIiwidHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzIiwibW92ZUJ5QmxlbmRUeXBlIiwiZGVzdCIsInNyYyIsIm1vdmVUcmFuc3BhcmVudCIsIl9zcmMkcyRtYXRlcmlhbCIsInRyYW5zcGFyZW50IiwiQ09NUFVQREFURURfQkxFTkQiLCJDT01QVVBEQVRFRF9MSUdIVFMiLCJ1cGRhdGVMaWdodHMiLCJ1cGRhdGVTaGFkb3dDYXN0ZXJzIiwiQ09NUFVQREFURURfQ0FNRVJBUyIsImoiLCJjYW1lcmEiLCJpbmRleCIsImluZGV4T2YiLCJzb3J0UHJpb3JpdHkiLCJjYW1lcmFMYXllcnMiLCJyZW5kZXJBY3Rpb25Db3VudCIsImNhbWVyYUZpcnN0UmVuZGVyQWN0aW9uIiwiY2FtZXJhRmlyc3RSZW5kZXJBY3Rpb25JbmRleCIsImxhc3RSZW5kZXJBY3Rpb24iLCJwb3N0UHJvY2Vzc01hcmtlZCIsImlzTGF5ZXJFbmFibGVkIiwibGF5ZXJzIiwiaWQiLCJkaXNhYmxlUG9zdEVmZmVjdHNMYXllciIsInRyaWdnZXJQb3N0cHJvY2VzcyIsImNhbWVyYUluZGV4IiwiYWRkUmVuZGVyQWN0aW9uIiwiY29sbGVjdERpcmVjdGlvbmFsTGlnaHRzIiwibGFzdENhbWVyYVVzZSIsInJlbmRlclRhcmdldCIsInBvc3RFZmZlY3RzRW5hYmxlZCIsInByb3BhZ2F0ZVJlbmRlclRhcmdldCIsImFsbG9jYXRlTGlnaHRDbHVzdGVycyIsIl9sb2dSZW5kZXJBY3Rpb25zIiwibGlnaHRDb3VudCIsImNsZWFyU2hhZG93Q2FzdGVycyIsImNhc3RTaGFkb3dzIiwibGlnaHRJbmRleCIsImdldCIsImxpZ2h0Q29tcERhdGEiLCJhZGRTaGFkb3dDYXN0ZXJzIiwic2hhZG93Q2FzdGVycyIsImNvdW50IiwidW5kZWZpbmVkIiwic2V0IiwiTGlnaHRDb21wb3NpdGlvbkRhdGEiLCJmaW5kQ29tcGF0aWJsZUNsdXN0ZXIiLCJlbXB0eVdvcmxkQ2x1c3RlcnMiLCJyYUxheWVyIiwibGF5ZXJJbmRleCIsImxpZ2h0Q2x1c3RlcnMiLCJlcXVhbHMiLCJfY2x1c3RlcmVkTGlnaHRzU2V0IiwiaGFzQ2x1c3RlcmVkTGlnaHRzIiwibWVzaEluc3RhbmNlcyIsImNsdXN0ZXJzIiwicG9wIiwiaXRlbSIsInJlbmRlckFjdGlvbnMiLCJyZW5kZXJBY3Rpb25JbmRleCIsInJlbmRlckFjdGlvbiIsIlJlbmRlckFjdGlvbiIsInJ0IiwiTEFZRVJJRF9ERVBUSCIsInVzZWQiLCJuZWVkc0NsZWFyIiwiY2xlYXJDb2xvciIsImNsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckRlcHRoIiwiY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyU3RlbmNpbCIsImNsZWFyU3RlbmNpbEJ1ZmZlciIsInJlc2V0IiwiZmlyc3RDYW1lcmFVc2UiLCJzdGFydEluZGV4IiwiZnJvbUNhbWVyYSIsImEiLCJ0aGlzQ2FtZXJhIiwicmVjdCIsInNjaXNzb3JSZWN0IiwiVHJhY2luZyIsIlRSQUNFSURfUkVOREVSX0FDVElPTiIsIkRlYnVnIiwidHJhY2UiLCJkaXJMaWdodENvdW50IiwiZGlyZWN0aW9uYWxMaWdodHMiLCJlbnRpdHkiLCJwYWRFbmQiLCJ0b1N0cmluZyIsInBhZFN0YXJ0Iiwic2l6ZSIsIl9saWdodHNTZXQiLCJfaXNMYXllckFkZGVkIiwiZXJyb3IiLCJfaXNTdWJsYXllckFkZGVkIiwiZmlyZSIsImluc2VydCIsInNwbGljZSIsIl91cGRhdGVPcGFxdWVPcmRlciIsIl91cGRhdGVUcmFuc3BhcmVudE9yZGVyIiwicmVtb3ZlIiwicHVzaE9wYXF1ZSIsImluc2VydE9wYXF1ZSIsInJlbW92ZU9wYXF1ZSIsInB1c2hUcmFuc3BhcmVudCIsImluc2VydFRyYW5zcGFyZW50IiwicmVtb3ZlVHJhbnNwYXJlbnQiLCJfZ2V0U3VibGF5ZXJJbmRleCIsImdldE9wYXF1ZUluZGV4IiwiZ2V0VHJhbnNwYXJlbnRJbmRleCIsImdldExheWVyQnlJZCIsImdldExheWVyQnlOYW1lIiwiZW5kSW5kZXgiLCJfc29ydExheWVyc0Rlc2NlbmRpbmciLCJsYXllcnNBIiwibGF5ZXJzQiIsIm9yZGVyIiwidG9wTGF5ZXJBIiwidG9wTGF5ZXJCIiwiaGFzT3duUHJvcGVydHkiLCJNYXRoIiwibWF4Iiwic29ydFRyYW5zcGFyZW50TGF5ZXJzIiwic29ydE9wYXF1ZUxheWVycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFpQkEsTUFBTUEsT0FBTyxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBO0FBQ3pCLE1BQU1DLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTs7QUFFM0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsZ0JBQWdCLFNBQVNDLFlBQVksQ0FBQztBQUN4Qzs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsSUFBSSxHQUFHLFVBQVUsRUFBRTtBQUMzQixJQUFBLEtBQUssRUFBRSxDQUFBO0lBRVAsSUFBSSxDQUFDQSxJQUFJLEdBQUdBLElBQUksQ0FBQTs7QUFFaEI7QUFDUjtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsU0FBUyxHQUFHLEVBQUUsQ0FBQTs7QUFFbkI7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxZQUFZLEdBQUcsRUFBRSxDQUFBOztBQUV0QjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsZUFBZSxHQUFHLEVBQUUsQ0FBQzs7QUFFMUIsSUFBQSxJQUFJLENBQUNDLFlBQVksR0FBRyxFQUFFLENBQUE7QUFDdEIsSUFBQSxJQUFJLENBQUNDLGlCQUFpQixHQUFHLEVBQUUsQ0FBQTtJQUUzQixJQUFJLENBQUNDLE1BQU0sR0FBRyxLQUFLLENBQUE7SUFDbkIsSUFBSSxDQUFDQyxXQUFXLEdBQUcsS0FBSyxDQUFBO0lBQ3hCLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEtBQUssQ0FBQTtJQUN6QixJQUFJLENBQUNDLGFBQWEsR0FBRyxLQUFLLENB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
