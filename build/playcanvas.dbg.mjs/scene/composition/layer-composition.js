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
