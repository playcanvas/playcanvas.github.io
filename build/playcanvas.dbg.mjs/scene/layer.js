/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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

// Layers
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

    // arrays of VisibleInstanceList for each camera of this layer
    this.visibleOpaque = [];
    this.visibleTransparent = [];
  }

  // prepare for culling of camera with specified index
  prepare(index) {
    // make sure visibility lists are allocated
    if (!this.visibleOpaque[index]) {
      this.visibleOpaque[index] = new VisibleInstanceList();
    }
    if (!this.visibleTransparent[index]) {
      this.visibleTransparent[index] = new VisibleInstanceList();
    }

    // mark them as not processed yet
    this.visibleOpaque[index].done = false;
    this.visibleTransparent[index].done = false;
  }

  // delete entry for a camera with specified index
  delete(index) {
    if (index < this.visibleOpaque.length) {
      this.visibleOpaque.splice(index, 1);
    }
    if (index < this.visibleTransparent.length) {
      this.visibleTransparent.splice(index, 1);
    }
  }
}

/**
 * A Layer represents a renderable subset of the scene. It can contain a list of mesh instances,
 * lights and cameras, their render settings and also defines custom callbacks before, after or
 * during rendering. Layers are organized inside {@link LayerComposition} in a desired order.
 */
class Layer {
  /**
   * Create a new Layer instance.
   *
   * @param {object} options - Object for passing optional arguments. These arguments are the
   * same as properties of the Layer.
   */
  constructor(options = {}) {
    var _options$enabled, _options$opaqueSortMo, _options$transparentS, _options$shaderPass, _options$passThrough;
    if (options.id !== undefined) {
      /**
       * A unique ID of the layer. Layer IDs are stored inside {@link ModelComponent#layers},
       * {@link RenderComponent#layers}, {@link CameraComponent#layers},
       * {@link LightComponent#layers} and {@link ElementComponent#layers} instead of names.
       * Can be used in {@link LayerComposition#getLayerById}.
       *
       * @type {number}
       */
      this.id = options.id;
      layerCounter = Math.max(this.id + 1, layerCounter);
    } else {
      this.id = layerCounter++;
    }

    /**
     * Name of the layer. Can be used in {@link LayerComposition#getLayerByName}.
     *
     * @type {string}
     */
    this.name = options.name;

    /**
     * @type {boolean}
     * @private
     */
    this._enabled = (_options$enabled = options.enabled) != null ? _options$enabled : true;
    /**
     * @type {number}
     * @private
     */
    this._refCounter = this._enabled ? 1 : 0;

    /**
     * Defines the method used for sorting opaque (that is, not semi-transparent) mesh
     * instances before rendering. Can be:
     *
     * - {@link SORTMODE_NONE}
     * - {@link SORTMODE_MANUAL}
     * - {@link SORTMODE_MATERIALMESH}
     * - {@link SORTMODE_BACK2FRONT}
     * - {@link SORTMODE_FRONT2BACK}
     *
     * Defaults to {@link SORTMODE_MATERIALMESH}.
     *
     * @type {number}
     */
    this.opaqueSortMode = (_options$opaqueSortMo = options.opaqueSortMode) != null ? _options$opaqueSortMo : SORTMODE_MATERIALMESH;

    /**
     * Defines the method used for sorting semi-transparent mesh instances before rendering. Can be:
     *
     * - {@link SORTMODE_NONE}
     * - {@link SORTMODE_MANUAL}
     * - {@link SORTMODE_MATERIALMESH}
     * - {@link SORTMODE_BACK2FRONT}
     * - {@link SORTMODE_FRONT2BACK}
     *
     * Defaults to {@link SORTMODE_BACK2FRONT}.
     *
     * @type {number}
     */
    this.transparentSortMode = (_options$transparentS = options.transparentSortMode) != null ? _options$transparentS : SORTMODE_BACK2FRONT;
    if (options.renderTarget) {
      this.renderTarget = options.renderTarget;
    }

    /**
     * A type of shader to use during rendering. Possible values are:
     *
     * - {@link SHADER_FORWARD}
     * - {@link SHADER_FORWARDHDR}
     * - {@link SHADER_DEPTH}
     * - Your own custom value. Should be in 19 - 31 range. Use {@link StandardMaterial#onUpdateShader}
     * to apply shader modifications based on this value.
     *
     * Defaults to {@link SHADER_FORWARD}.
     *
     * @type {number}
     */
    this.shaderPass = (_options$shaderPass = options.shaderPass) != null ? _options$shaderPass : SHADER_FORWARD;

    /**
     * Tells that this layer is simple and needs to just render a bunch of mesh instances
     * without lighting, skinning and morphing (faster). Used for UI and Gizmo layers (the
     * layer doesn't use lights, shadows, culling, etc).
     *
     * @type {boolean}
     */
    this.passThrough = (_options$passThrough = options.passThrough) != null ? _options$passThrough : false;

    // clear flags
    /**
     * @type {boolean}
     * @private
     */
    this._clearColorBuffer = !!options.clearColorBuffer;

    /**
     * @type {boolean}
     * @private
     */
    this._clearDepthBuffer = !!options.clearDepthBuffer;

    /**
     * @type {boolean}
     * @private
     */
    this._clearStencilBuffer = !!options.clearStencilBuffer;

    /**
     * Custom function that is called before visibility culling is performed for this layer.
     * Useful, for example, if you want to modify camera projection while still using the same
     * camera and make frustum culling work correctly with it (see
     * {@link CameraComponent#calculateTransform} and {@link CameraComponent#calculateProjection}).
     * This function will receive camera index as the only argument. You can get the actual
     * camera being used by looking up {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPreCull = options.onPreCull;
    /**
     * Custom function that is called before this layer is rendered. Useful, for example, for
     * reacting on screen size changes. This function is called before the first occurrence of
     * this layer in {@link LayerComposition}. It will receive camera index as the only
     * argument. You can get the actual camera being used by looking up
     * {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPreRender = options.onPreRender;
    /**
     * Custom function that is called before opaque mesh instances (not semi-transparent) in
     * this layer are rendered. This function will receive camera index as the only argument.
     * You can get the actual camera being used by looking up {@link LayerComposition#cameras}
     * with this index.
     *
     * @type {Function}
     */
    this.onPreRenderOpaque = options.onPreRenderOpaque;
    /**
     * Custom function that is called before semi-transparent mesh instances in this layer are
     * rendered. This function will receive camera index as the only argument. You can get the
     * actual camera being used by looking up {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPreRenderTransparent = options.onPreRenderTransparent;

    /**
     * Custom function that is called after visibility culling is performed for this layer.
     * Useful for reverting changes done in {@link Layer#onPreCull} and determining final mesh
     * instance visibility (see {@link MeshInstance#visibleThisFrame}). This function will
     * receive camera index as the only argument. You can get the actual camera being used by
     * looking up {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPostCull = options.onPostCull;
    /**
     * Custom function that is called after this layer is rendered. Useful to revert changes
     * made in {@link Layer#onPreRender}. This function is called after the last occurrence of this
     * layer in {@link LayerComposition}. It will receive camera index as the only argument.
     * You can get the actual camera being used by looking up {@link LayerComposition#cameras}
     * with this index.
     *
     * @type {Function}
     */
    this.onPostRender = options.onPostRender;
    /**
     * Custom function that is called after opaque mesh instances (not semi-transparent) in
     * this layer are rendered. This function will receive camera index as the only argument.
     * You can get the actual camera being used by looking up {@link LayerComposition#cameras}
     * with this index.
     *
     * @type {Function}
     */
    this.onPostRenderOpaque = options.onPostRenderOpaque;
    /**
     * Custom function that is called after semi-transparent mesh instances in this layer are
     * rendered. This function will receive camera index as the only argument. You can get the
     * actual camera being used by looking up {@link LayerComposition#cameras} with this index.
     *
     * @type {Function}
     */
    this.onPostRenderTransparent = options.onPostRenderTransparent;

    /**
     * Custom function that is called before every mesh instance in this layer is rendered. It
     * is not recommended to set this function when rendering many objects every frame due to
     * performance reasons.
     *
     * @type {Function}
     */
    this.onDrawCall = options.onDrawCall;
    /**
     * Custom function that is called after the layer has been enabled. This happens when:
     *
     * - The layer is created with {@link Layer#enabled} set to true (which is the default value).
     * - {@link Layer#enabled} was changed from false to true
     * - {@link Layer#incrementCounter} was called and incremented the counter above zero.
     *
     * Useful for allocating resources this layer will use (e.g. creating render targets).
     *
     * @type {Function}
     */
    this.onEnable = options.onEnable;
    /**
     * Custom function that is called after the layer has been disabled. This happens when:
     *
     * - {@link Layer#enabled} was changed from true to false
     * - {@link Layer#decrementCounter} was called and set the counter to zero.
     *
     * @type {Function}
     */
    this.onDisable = options.onDisable;
    if (this._enabled && this.onEnable) {
      this.onEnable();
    }

    /**
     * Make this layer render the same mesh instances that another layer does instead of having
     * its own mesh instance list. Both layers must share cameras. Frustum culling is only
     * performed for one layer. Useful for rendering multiple passes using different shaders.
     *
     * @type {Layer}
     */
    this.layerReference = options.layerReference; // should use the same camera

    /**
     * @type {InstanceList}
     * @ignore
     */
    this.instances = options.layerReference ? options.layerReference.instances : new InstanceList();

    /**
     * Visibility bit mask that interacts with {@link MeshInstance#mask}. Especially useful
     * when combined with layerReference, allowing for the filtering of some objects, while
     * sharing their list and culling.
     *
     * @type {number}
     */
    this.cullingMask = options.cullingMask ? options.cullingMask : 0xFFFFFFFF;

    /**
     * @type {import('./mesh-instance.js').MeshInstance[]}
     * @ignore
     */
    this.opaqueMeshInstances = this.instances.opaqueMeshInstances;
    /**
     * @type {import('./mesh-instance.js').MeshInstance[]}
     * @ignore
     */
    this.transparentMeshInstances = this.instances.transparentMeshInstances;
    /**
     * @type {import('./mesh-instance.js').MeshInstance[]}
     * @ignore
     */
    this.shadowCasters = this.instances.shadowCasters;

    /**
     * @type {Function|null}
     * @ignore
     */
    this.customSortCallback = null;
    /**
     * @type {Function|null}
     * @ignore
     */
    this.customCalculateSortValues = null;

    /**
     * @type {import('./light.js').Light[]}
     * @private
     */
    this._lights = [];
    /**
     * @type {Set<import('./light.js').Light>}
     * @private
     */
    this._lightsSet = new Set();

    /**
     * Set of light used by clustered lighting (omni and spot, but no directional).
     *
     * @type {Set<import('./light.js').Light>}
     * @private
     */
    this._clusteredLightsSet = new Set();

    /**
     * Lights separated by light type.
     *
     * @type {import('./light.js').Light[][]}
     * @ignore
     */
    this._splitLights = [[], [], []];

    /**
     * @type {import('../framework/components/camera/component.js').CameraComponent[]}
     * @ignore
     */
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
    this._shadowDrawCalls = 0; // deprecated, not useful on a layer anymore, could be moved to camera

    this._shaderVersion = -1;

    /**
     * @type {Float32Array}
     * @ignore
     */
    this._lightCube = null;
  }

  /**
   * True if the layer contains omni or spot lights
   *
   * @type {boolean}
   * @ignore
   */
  get hasClusteredLights() {
    return this._clusteredLightsSet.size > 0;
  }

  /**
   * Enable the layer. Disabled layers are skipped. Defaults to true.
   *
   * @type {boolean}
   */
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

  /**
   * If true, the camera will clear the color buffer when it renders this layer.
   *
   * @type {boolean}
   */
  set clearColorBuffer(val) {
    this._clearColorBuffer = val;
    this._dirtyCameras = true;
  }
  get clearColorBuffer() {
    return this._clearColorBuffer;
  }

  /**
   * If true, the camera will clear the depth buffer when it renders this layer.
   *
   * @type {boolean}
   */
  set clearDepthBuffer(val) {
    this._clearDepthBuffer = val;
    this._dirtyCameras = true;
  }
  get clearDepthBuffer() {
    return this._clearDepthBuffer;
  }

  /**
   * If true, the camera will clear the stencil buffer when it renders this layer.
   *
   * @type {boolean}
   */
  set clearStencilBuffer(val) {
    this._clearStencilBuffer = val;
    this._dirtyCameras = true;
  }
  get clearStencilBuffer() {
    return this._clearStencilBuffer;
  }

  /**
   * Returns lights used by clustered lighting in a set.
   *
   * @type {Set<import('./light.js').Light>}
   * @ignore
   */
  get clusteredLightsSet() {
    return this._clusteredLightsSet;
  }

  /**
   * Increments the usage counter of this layer. By default, layers are created with counter set
   * to 1 (if {@link Layer.enabled} is true) or 0 (if it was false). Incrementing the counter
   * from 0 to 1 will enable the layer and call {@link Layer.onEnable}. Use this function to
   * "subscribe" multiple effects to the same layer. For example, if the layer is used to render
   * a reflection texture which is used by 2 mirrors, then each mirror can call this function
   * when visible and {@link Layer.decrementCounter} if invisible. In such case the reflection
   * texture won't be updated, when there is nothing to use it, saving performance.
   *
   * @ignore
   */
  incrementCounter() {
    if (this._refCounter === 0) {
      this._enabled = true;
      if (this.onEnable) this.onEnable();
    }
    this._refCounter++;
  }

  /**
   * Decrements the usage counter of this layer. Decrementing the counter from 1 to 0 will
   * disable the layer and call {@link Layer.onDisable}. See {@link Layer#incrementCounter} for
   * more details.
   *
   * @ignore
   */
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

  /**
   * Adds an array of mesh instances to this layer.
   *1
   *
   * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
   * {@link MeshInstance}.
   * @param {boolean} [skipShadowCasters] - Set it to true if you don't want these mesh instances
   * to cast shadows in this layer.
   */
  addMeshInstances(meshInstances, skipShadowCasters) {
    const sceneShaderVer = this._shaderVersion;
    const casters = this.shadowCasters;
    for (let i = 0; i < meshInstances.length; i++) {
      const m = meshInstances[i];
      const mat = m.material;
      const arr = mat.blendType === BLEND_NONE ? this.opaqueMeshInstances : this.transparentMeshInstances;

      // test for meshInstance in both arrays, as material's alpha could have changed since LayerComposition's update to avoid duplicates
      // TODO - following uses of indexOf are expensive, to add 5000 meshInstances costs about 70ms on Mac. Consider using Set.
      if (this.opaqueMeshInstances.indexOf(m) < 0 && this.transparentMeshInstances.indexOf(m) < 0) {
        arr.push(m);
      }
      if (!skipShadowCasters && m.castShadow && casters.indexOf(m) < 0) casters.push(m);

      // clear old shader variants if necessary
      if (!this.passThrough && sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer) {
        // skip this for materials not using variants
        if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
          // clear shader variants on the material and also on mesh instances that use it
          mat.clearVariants();
        }
        mat._shaderVersion = sceneShaderVer;
      }
    }
    if (!this.passThrough) this._dirty = true;
  }

  /**
   * Internal function to remove a mesh instance from an array.
   *
   * @param {import('./mesh-instance.js').MeshInstance} m - Mesh instance to remove.
   * @param {import('./mesh-instance.js').MeshInstance[]} arr - Array of mesh instances to remove
   * from.
   * @private
   */
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

  /**
   * Removes multiple mesh instances from this layer.
   *
   * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
   * {@link MeshInstance}. If they were added to this layer, they will be removed.
   * @param {boolean} [skipShadowCasters] - Set it to true if you want to still cast shadows from
   * removed mesh instances or if they never did cast shadows before.
   */
  removeMeshInstances(meshInstances, skipShadowCasters) {
    const opaque = this.opaqueMeshInstances;
    const transparent = this.transparentMeshInstances;
    const casters = this.shadowCasters;
    for (let i = 0; i < meshInstances.length; i++) {
      const m = meshInstances[i];

      // remove from opaque
      this.removeMeshInstanceFromArray(m, opaque);

      // remove from transparent
      this.removeMeshInstanceFromArray(m, transparent);

      // remove from casters
      if (!skipShadowCasters) {
        const j = casters.indexOf(m);
        if (j >= 0) casters.splice(j, 1);
      }
    }
    this._dirty = true;
  }

  /**
   * Removes all mesh instances from this layer.
   *
   * @param {boolean} [skipShadowCasters] - Set it to true if you want to still cast shadows from
   * removed mesh instances or if they never did cast shadows before.
   */
  clearMeshInstances(skipShadowCasters) {
    if (this.opaqueMeshInstances.length === 0 && this.transparentMeshInstances.length === 0) {
      if (skipShadowCasters || this.shadowCasters.length === 0) return;
    }
    this.opaqueMeshInstances.length = 0;
    this.transparentMeshInstances.length = 0;
    if (!skipShadowCasters) this.shadowCasters.length = 0;
    if (!this.passThrough) this._dirty = true;
  }

  /**
   * Adds a light to this layer.
   *
   * @param {import('../framework/components/light/component.js').LightComponent} light - A
   * {@link LightComponent}.
   */
  addLight(light) {
    // if the light is not in the layer already
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

  /**
   * Removes a light from this layer.
   *
   * @param {import('../framework/components/light/component.js').LightComponent} light - A
   * {@link LightComponent}.
   */
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

  /**
   * Removes all lights from this layer.
   */
  clearLights() {
    this._lightsSet.clear();
    this._clusteredLightsSet.clear();
    this._lights.length = 0;
    this._dirtyLights = true;
  }

  /**
   * Adds an array of mesh instances to this layer, but only as shadow casters (they will not be
   * rendered anywhere, but only cast shadows on other objects).
   *
   * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
   * {@link MeshInstance}.
   */
  addShadowCasters(meshInstances) {
    const arr = this.shadowCasters;
    for (let i = 0; i < meshInstances.length; i++) {
      const m = meshInstances[i];
      if (!m.castShadow) continue;
      if (arr.indexOf(m) < 0) arr.push(m);
    }
    this._dirtyLights = true;
  }

  /**
   * Removes multiple mesh instances from the shadow casters list of this layer, meaning they
   * will stop casting shadows.
   *
   * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
   * {@link MeshInstance}. If they were added to this layer, they will be removed.
   */
  removeShadowCasters(meshInstances) {
    const arr = this.shadowCasters;
    for (let i = 0; i < meshInstances.length; i++) {
      const id = arr.indexOf(meshInstances[i]);
      if (id >= 0) arr.splice(id, 1);
    }
    this._dirtyLights = true;
  }

  /** @private */
  _generateLightHash() {
    // generate hash to check if layers have the same set of static lights
    // order of lights shouldn't matter
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

  /**
   * Adds a camera to this layer.
   *
   * @param {import('../framework/components/camera/component.js').CameraComponent} camera - A
   * {@link CameraComponent}.
   */
  addCamera(camera) {
    if (this.cameras.indexOf(camera) >= 0) return;
    this.cameras.push(camera);
    this._dirtyCameras = true;
  }

  /**
   * Removes a camera from this layer.
   *
   * @param {import('../framework/components/camera/component.js').CameraComponent} camera - A
   * {@link CameraComponent}.
   */
  removeCamera(camera) {
    const index = this.cameras.indexOf(camera);
    if (index >= 0) {
      this.cameras.splice(index, 1);
      this._dirtyCameras = true;

      // delete the visible list for this camera
      this.instances.delete(index);
    }
  }

  /**
   * Removes all cameras from this layer.
   */
  clearCameras() {
    this.cameras.length = 0;
    this._dirtyCameras = true;
  }

  /**
   * @param {import('./mesh-instance.js').MeshInstance[]} drawCalls - Array of mesh instances.
   * @param {number} drawCallsCount - Number of mesh instances.
   * @param {Vec3} camPos - Camera position.
   * @param {Vec3} camFwd - Camera forward vector.
   * @private
   */
  _calculateSortDistances(drawCalls, drawCallsCount, camPos, camFwd) {
    for (let i = 0; i < drawCallsCount; i++) {
      const drawCall = drawCalls[i];
      if (drawCall.command) continue;
      if (drawCall.layer <= LAYER_FX) continue; // Only alpha sort mesh instances in the main world (backwards comp)
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

  /**
   * @param {boolean} transparent - True if transparent sorting should be used.
   * @param {import('./graph-node.js').GraphNode} cameraNode - Graph node that the camera is
   * attached to.
   * @param {number} cameraPass - Camera pass.
   * @ignore
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9sYXllci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgaGFzaENvZGUgfSBmcm9tICcuLi9jb3JlL2hhc2guanMnO1xuXG5pbXBvcnQge1xuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBCTEVORF9OT05FLFxuICAgIExBWUVSX0ZYLFxuICAgIFNIQURFUl9GT1JXQVJELFxuICAgIFNPUlRLRVlfRk9SV0FSRCxcbiAgICBTT1JUTU9ERV9CQUNLMkZST05ULCBTT1JUTU9ERV9DVVNUT00sIFNPUlRNT0RFX0ZST05UMkJBQ0ssIFNPUlRNT0RFX01BVEVSSUFMTUVTSCwgU09SVE1PREVfTk9ORVxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcblxubGV0IGtleUEsIGtleUIsIHNvcnRQb3MsIHNvcnREaXI7XG5cbmZ1bmN0aW9uIHNvcnRNYW51YWwoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxBLmRyYXdPcmRlciAtIGRyYXdDYWxsQi5kcmF3T3JkZXI7XG59XG5cbmZ1bmN0aW9uIHNvcnRNYXRlcmlhbE1lc2goZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICBrZXlBID0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICBrZXlCID0gZHJhd0NhbGxCLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICBpZiAoa2V5QSA9PT0ga2V5QiAmJiBkcmF3Q2FsbEEubWVzaCAmJiBkcmF3Q2FsbEIubWVzaCkge1xuICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICB9XG4gICAgcmV0dXJuIGtleUIgLSBrZXlBO1xufVxuXG5mdW5jdGlvbiBzb3J0QmFja1RvRnJvbnQoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxCLnpkaXN0IC0gZHJhd0NhbGxBLnpkaXN0O1xufVxuXG5mdW5jdGlvbiBzb3J0RnJvbnRUb0JhY2soZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxBLnpkaXN0IC0gZHJhd0NhbGxCLnpkaXN0O1xufVxuXG5jb25zdCBzb3J0Q2FsbGJhY2tzID0gW251bGwsIHNvcnRNYW51YWwsIHNvcnRNYXRlcmlhbE1lc2gsIHNvcnRCYWNrVG9Gcm9udCwgc29ydEZyb250VG9CYWNrXTtcblxuZnVuY3Rpb24gc29ydExpZ2h0cyhsaWdodEEsIGxpZ2h0Qikge1xuICAgIHJldHVybiBsaWdodEIua2V5IC0gbGlnaHRBLmtleTtcbn1cblxuLy8gTGF5ZXJzXG5sZXQgbGF5ZXJDb3VudGVyID0gMDtcblxuY2xhc3MgVmlzaWJsZUluc3RhbmNlTGlzdCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubGlzdCA9IFtdO1xuICAgICAgICB0aGlzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgIH1cbn1cblxuY2xhc3MgSW5zdGFuY2VMaXN0IHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5vcGFxdWVNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgIHRoaXMudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzdGVycyA9IFtdO1xuXG4gICAgICAgIC8vIGFycmF5cyBvZiBWaXNpYmxlSW5zdGFuY2VMaXN0IGZvciBlYWNoIGNhbWVyYSBvZiB0aGlzIGxheWVyXG4gICAgICAgIHRoaXMudmlzaWJsZU9wYXF1ZSA9IFtdO1xuICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudCA9IFtdO1xuICAgIH1cblxuICAgIC8vIHByZXBhcmUgZm9yIGN1bGxpbmcgb2YgY2FtZXJhIHdpdGggc3BlY2lmaWVkIGluZGV4XG4gICAgcHJlcGFyZShpbmRleCkge1xuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSB2aXNpYmlsaXR5IGxpc3RzIGFyZSBhbGxvY2F0ZWRcbiAgICAgICAgaWYgKCF0aGlzLnZpc2libGVPcGFxdWVbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLnZpc2libGVPcGFxdWVbaW5kZXhdID0gbmV3IFZpc2libGVJbnN0YW5jZUxpc3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy52aXNpYmxlVHJhbnNwYXJlbnRbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudFtpbmRleF0gPSBuZXcgVmlzaWJsZUluc3RhbmNlTGlzdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFyayB0aGVtIGFzIG5vdCBwcm9jZXNzZWQgeWV0XG4gICAgICAgIHRoaXMudmlzaWJsZU9wYXF1ZVtpbmRleF0uZG9uZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudFtpbmRleF0uZG9uZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIGRlbGV0ZSBlbnRyeSBmb3IgYSBjYW1lcmEgd2l0aCBzcGVjaWZpZWQgaW5kZXhcbiAgICBkZWxldGUoaW5kZXgpIHtcbiAgICAgICAgaWYgKGluZGV4IDwgdGhpcy52aXNpYmxlT3BhcXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy52aXNpYmxlT3BhcXVlLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGV4IDwgdGhpcy52aXNpYmxlVHJhbnNwYXJlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudC5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIEEgTGF5ZXIgcmVwcmVzZW50cyBhIHJlbmRlcmFibGUgc3Vic2V0IG9mIHRoZSBzY2VuZS4gSXQgY2FuIGNvbnRhaW4gYSBsaXN0IG9mIG1lc2ggaW5zdGFuY2VzLFxuICogbGlnaHRzIGFuZCBjYW1lcmFzLCB0aGVpciByZW5kZXIgc2V0dGluZ3MgYW5kIGFsc28gZGVmaW5lcyBjdXN0b20gY2FsbGJhY2tzIGJlZm9yZSwgYWZ0ZXIgb3JcbiAqIGR1cmluZyByZW5kZXJpbmcuIExheWVycyBhcmUgb3JnYW5pemVkIGluc2lkZSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0gaW4gYSBkZXNpcmVkIG9yZGVyLlxuICovXG5jbGFzcyBMYXllciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IExheWVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBPYmplY3QgZm9yIHBhc3Npbmcgb3B0aW9uYWwgYXJndW1lbnRzLiBUaGVzZSBhcmd1bWVudHMgYXJlIHRoZVxuICAgICAqIHNhbWUgYXMgcHJvcGVydGllcyBvZiB0aGUgTGF5ZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBBIHVuaXF1ZSBJRCBvZiB0aGUgbGF5ZXIuIExheWVyIElEcyBhcmUgc3RvcmVkIGluc2lkZSB7QGxpbmsgTW9kZWxDb21wb25lbnQjbGF5ZXJzfSxcbiAgICAgICAgICAgICAqIHtAbGluayBSZW5kZXJDb21wb25lbnQjbGF5ZXJzfSwge0BsaW5rIENhbWVyYUNvbXBvbmVudCNsYXllcnN9LFxuICAgICAgICAgICAgICoge0BsaW5rIExpZ2h0Q29tcG9uZW50I2xheWVyc30gYW5kIHtAbGluayBFbGVtZW50Q29tcG9uZW50I2xheWVyc30gaW5zdGVhZCBvZiBuYW1lcy5cbiAgICAgICAgICAgICAqIENhbiBiZSB1c2VkIGluIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2dldExheWVyQnlJZH0uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5pZCA9IG9wdGlvbnMuaWQ7XG4gICAgICAgICAgICBsYXllckNvdW50ZXIgPSBNYXRoLm1heCh0aGlzLmlkICsgMSwgbGF5ZXJDb3VudGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBsYXllckNvdW50ZXIrKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBOYW1lIG9mIHRoZSBsYXllci4gQ2FuIGJlIHVzZWQgaW4ge0BsaW5rIExheWVyQ29tcG9zaXRpb24jZ2V0TGF5ZXJCeU5hbWV9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSBvcHRpb25zLmVuYWJsZWQgPz8gdHJ1ZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9yZWZDb3VudGVyID0gdGhpcy5fZW5hYmxlZCA/IDEgOiAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWZpbmVzIHRoZSBtZXRob2QgdXNlZCBmb3Igc29ydGluZyBvcGFxdWUgKHRoYXQgaXMsIG5vdCBzZW1pLXRyYW5zcGFyZW50KSBtZXNoXG4gICAgICAgICAqIGluc3RhbmNlcyBiZWZvcmUgcmVuZGVyaW5nLiBDYW4gYmU6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX05PTkV9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX01BTlVBTH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9CQUNLMkZST05UfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9GUk9OVDJCQUNLfVxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub3BhcXVlU29ydE1vZGUgPSBvcHRpb25zLm9wYXF1ZVNvcnRNb2RlID8/IFNPUlRNT0RFX01BVEVSSUFMTUVTSDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmaW5lcyB0aGUgbWV0aG9kIHVzZWQgZm9yIHNvcnRpbmcgc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcyBiZWZvcmUgcmVuZGVyaW5nLiBDYW4gYmU6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX05PTkV9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX01BTlVBTH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9CQUNLMkZST05UfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9GUk9OVDJCQUNLfVxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgU09SVE1PREVfQkFDSzJGUk9OVH0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRyYW5zcGFyZW50U29ydE1vZGUgPSBvcHRpb25zLnRyYW5zcGFyZW50U29ydE1vZGUgPz8gU09SVE1PREVfQkFDSzJGUk9OVDtcblxuICAgICAgICBpZiAob3B0aW9ucy5yZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gb3B0aW9ucy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogQSB0eXBlIG9mIHNoYWRlciB0byB1c2UgZHVyaW5nIHJlbmRlcmluZy4gUG9zc2libGUgdmFsdWVzIGFyZTpcbiAgICAgICAgICpcbiAgICAgICAgICogLSB7QGxpbmsgU0hBREVSX0ZPUldBUkR9XG4gICAgICAgICAqIC0ge0BsaW5rIFNIQURFUl9GT1JXQVJESERSfVxuICAgICAgICAgKiAtIHtAbGluayBTSEFERVJfREVQVEh9XG4gICAgICAgICAqIC0gWW91ciBvd24gY3VzdG9tIHZhbHVlLiBTaG91bGQgYmUgaW4gMTkgLSAzMSByYW5nZS4gVXNlIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29uVXBkYXRlU2hhZGVyfVxuICAgICAgICAgKiB0byBhcHBseSBzaGFkZXIgbW9kaWZpY2F0aW9ucyBiYXNlZCBvbiB0aGlzIHZhbHVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgU0hBREVSX0ZPUldBUkR9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zaGFkZXJQYXNzID0gb3B0aW9ucy5zaGFkZXJQYXNzID8/IFNIQURFUl9GT1JXQVJEO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUZWxscyB0aGF0IHRoaXMgbGF5ZXIgaXMgc2ltcGxlIGFuZCBuZWVkcyB0byBqdXN0IHJlbmRlciBhIGJ1bmNoIG9mIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgICAqIHdpdGhvdXQgbGlnaHRpbmcsIHNraW5uaW5nIGFuZCBtb3JwaGluZyAoZmFzdGVyKS4gVXNlZCBmb3IgVUkgYW5kIEdpem1vIGxheWVycyAodGhlXG4gICAgICAgICAqIGxheWVyIGRvZXNuJ3QgdXNlIGxpZ2h0cywgc2hhZG93cywgY3VsbGluZywgZXRjKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBhc3NUaHJvdWdoID0gb3B0aW9ucy5wYXNzVGhyb3VnaCA/PyBmYWxzZTtcblxuICAgICAgICAvLyBjbGVhciBmbGFnc1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jbGVhckNvbG9yQnVmZmVyID0gISFvcHRpb25zLmNsZWFyQ29sb3JCdWZmZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlciA9ICEhb3B0aW9ucy5jbGVhckRlcHRoQnVmZmVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsZWFyU3RlbmNpbEJ1ZmZlciA9ICEhb3B0aW9ucy5jbGVhclN0ZW5jaWxCdWZmZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBiZWZvcmUgdmlzaWJpbGl0eSBjdWxsaW5nIGlzIHBlcmZvcm1lZCBmb3IgdGhpcyBsYXllci5cbiAgICAgICAgICogVXNlZnVsLCBmb3IgZXhhbXBsZSwgaWYgeW91IHdhbnQgdG8gbW9kaWZ5IGNhbWVyYSBwcm9qZWN0aW9uIHdoaWxlIHN0aWxsIHVzaW5nIHRoZSBzYW1lXG4gICAgICAgICAqIGNhbWVyYSBhbmQgbWFrZSBmcnVzdHVtIGN1bGxpbmcgd29yayBjb3JyZWN0bHkgd2l0aCBpdCAoc2VlXG4gICAgICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnQjY2FsY3VsYXRlVHJhbnNmb3JtfSBhbmQge0BsaW5rIENhbWVyYUNvbXBvbmVudCNjYWxjdWxhdGVQcm9qZWN0aW9ufSkuXG4gICAgICAgICAqIFRoaXMgZnVuY3Rpb24gd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC4gWW91IGNhbiBnZXQgdGhlIGFjdHVhbFxuICAgICAgICAgKiBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9IHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblByZUN1bGwgPSBvcHRpb25zLm9uUHJlQ3VsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBiZWZvcmUgdGhpcyBsYXllciBpcyByZW5kZXJlZC4gVXNlZnVsLCBmb3IgZXhhbXBsZSwgZm9yXG4gICAgICAgICAqIHJlYWN0aW5nIG9uIHNjcmVlbiBzaXplIGNoYW5nZXMuIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGJlZm9yZSB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZlxuICAgICAgICAgKiB0aGlzIGxheWVyIGluIHtAbGluayBMYXllckNvbXBvc2l0aW9ufS4gSXQgd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seVxuICAgICAgICAgKiBhcmd1bWVudC4gWW91IGNhbiBnZXQgdGhlIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwXG4gICAgICAgICAqIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9IHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblByZVJlbmRlciA9IG9wdGlvbnMub25QcmVSZW5kZXI7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIG9wYXF1ZSBtZXNoIGluc3RhbmNlcyAobm90IHNlbWktdHJhbnNwYXJlbnQpIGluXG4gICAgICAgICAqIHRoaXMgbGF5ZXIgYXJlIHJlbmRlcmVkLiBUaGlzIGZ1bmN0aW9uIHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuXG4gICAgICAgICAqIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfVxuICAgICAgICAgKiB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25QcmVSZW5kZXJPcGFxdWUgPSBvcHRpb25zLm9uUHJlUmVuZGVyT3BhcXVlO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGJlZm9yZSBzZW1pLXRyYW5zcGFyZW50IG1lc2ggaW5zdGFuY2VzIGluIHRoaXMgbGF5ZXIgYXJlXG4gICAgICAgICAqIHJlbmRlcmVkLiBUaGlzIGZ1bmN0aW9uIHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuIFlvdSBjYW4gZ2V0IHRoZVxuICAgICAgICAgKiBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfSB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25QcmVSZW5kZXJUcmFuc3BhcmVudCA9IG9wdGlvbnMub25QcmVSZW5kZXJUcmFuc3BhcmVudDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHZpc2liaWxpdHkgY3VsbGluZyBpcyBwZXJmb3JtZWQgZm9yIHRoaXMgbGF5ZXIuXG4gICAgICAgICAqIFVzZWZ1bCBmb3IgcmV2ZXJ0aW5nIGNoYW5nZXMgZG9uZSBpbiB7QGxpbmsgTGF5ZXIjb25QcmVDdWxsfSBhbmQgZGV0ZXJtaW5pbmcgZmluYWwgbWVzaFxuICAgICAgICAgKiBpbnN0YW5jZSB2aXNpYmlsaXR5IChzZWUge0BsaW5rIE1lc2hJbnN0YW5jZSN2aXNpYmxlVGhpc0ZyYW1lfSkuIFRoaXMgZnVuY3Rpb24gd2lsbFxuICAgICAgICAgKiByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC4gWW91IGNhbiBnZXQgdGhlIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieVxuICAgICAgICAgKiBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9IHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblBvc3RDdWxsID0gb3B0aW9ucy5vblBvc3RDdWxsO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoaXMgbGF5ZXIgaXMgcmVuZGVyZWQuIFVzZWZ1bCB0byByZXZlcnQgY2hhbmdlc1xuICAgICAgICAgKiBtYWRlIGluIHtAbGluayBMYXllciNvblByZVJlbmRlcn0uIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGFmdGVyIHRoZSBsYXN0IG9jY3VycmVuY2Ugb2YgdGhpc1xuICAgICAgICAgKiBsYXllciBpbiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0uIEl0IHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuXG4gICAgICAgICAqIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfVxuICAgICAgICAgKiB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25Qb3N0UmVuZGVyID0gb3B0aW9ucy5vblBvc3RSZW5kZXI7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgb3BhcXVlIG1lc2ggaW5zdGFuY2VzIChub3Qgc2VtaS10cmFuc3BhcmVudCkgaW5cbiAgICAgICAgICogdGhpcyBsYXllciBhcmUgcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gd2lsbCByZWNlaXZlIGNhbWVyYSBpbmRleCBhcyB0aGUgb25seSBhcmd1bWVudC5cbiAgICAgICAgICogWW91IGNhbiBnZXQgdGhlIGFjdHVhbCBjYW1lcmEgYmVpbmcgdXNlZCBieSBsb29raW5nIHVwIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2NhbWVyYXN9XG4gICAgICAgICAqIHdpdGggdGhpcyBpbmRleC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vblBvc3RSZW5kZXJPcGFxdWUgPSBvcHRpb25zLm9uUG9zdFJlbmRlck9wYXF1ZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciBzZW1pLXRyYW5zcGFyZW50IG1lc2ggaW5zdGFuY2VzIGluIHRoaXMgbGF5ZXIgYXJlXG4gICAgICAgICAqIHJlbmRlcmVkLiBUaGlzIGZ1bmN0aW9uIHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuIFlvdSBjYW4gZ2V0IHRoZVxuICAgICAgICAgKiBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfSB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQgPSBvcHRpb25zLm9uUG9zdFJlbmRlclRyYW5zcGFyZW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIGV2ZXJ5IG1lc2ggaW5zdGFuY2UgaW4gdGhpcyBsYXllciBpcyByZW5kZXJlZC4gSXRcbiAgICAgICAgICogaXMgbm90IHJlY29tbWVuZGVkIHRvIHNldCB0aGlzIGZ1bmN0aW9uIHdoZW4gcmVuZGVyaW5nIG1hbnkgb2JqZWN0cyBldmVyeSBmcmFtZSBkdWUgdG9cbiAgICAgICAgICogcGVyZm9ybWFuY2UgcmVhc29ucy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vbkRyYXdDYWxsID0gb3B0aW9ucy5vbkRyYXdDYWxsO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoZSBsYXllciBoYXMgYmVlbiBlbmFibGVkLiBUaGlzIGhhcHBlbnMgd2hlbjpcbiAgICAgICAgICpcbiAgICAgICAgICogLSBUaGUgbGF5ZXIgaXMgY3JlYXRlZCB3aXRoIHtAbGluayBMYXllciNlbmFibGVkfSBzZXQgdG8gdHJ1ZSAod2hpY2ggaXMgdGhlIGRlZmF1bHQgdmFsdWUpLlxuICAgICAgICAgKiAtIHtAbGluayBMYXllciNlbmFibGVkfSB3YXMgY2hhbmdlZCBmcm9tIGZhbHNlIHRvIHRydWVcbiAgICAgICAgICogLSB7QGxpbmsgTGF5ZXIjaW5jcmVtZW50Q291bnRlcn0gd2FzIGNhbGxlZCBhbmQgaW5jcmVtZW50ZWQgdGhlIGNvdW50ZXIgYWJvdmUgemVyby5cbiAgICAgICAgICpcbiAgICAgICAgICogVXNlZnVsIGZvciBhbGxvY2F0aW5nIHJlc291cmNlcyB0aGlzIGxheWVyIHdpbGwgdXNlIChlLmcuIGNyZWF0aW5nIHJlbmRlciB0YXJnZXRzKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vbkVuYWJsZSA9IG9wdGlvbnMub25FbmFibGU7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgdGhlIGxheWVyIGhhcyBiZWVuIGRpc2FibGVkLiBUaGlzIGhhcHBlbnMgd2hlbjpcbiAgICAgICAgICpcbiAgICAgICAgICogLSB7QGxpbmsgTGF5ZXIjZW5hYmxlZH0gd2FzIGNoYW5nZWQgZnJvbSB0cnVlIHRvIGZhbHNlXG4gICAgICAgICAqIC0ge0BsaW5rIExheWVyI2RlY3JlbWVudENvdW50ZXJ9IHdhcyBjYWxsZWQgYW5kIHNldCB0aGUgY291bnRlciB0byB6ZXJvLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uRGlzYWJsZSA9IG9wdGlvbnMub25EaXNhYmxlO1xuXG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkICYmIHRoaXMub25FbmFibGUpIHtcbiAgICAgICAgICAgIHRoaXMub25FbmFibGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBNYWtlIHRoaXMgbGF5ZXIgcmVuZGVyIHRoZSBzYW1lIG1lc2ggaW5zdGFuY2VzIHRoYXQgYW5vdGhlciBsYXllciBkb2VzIGluc3RlYWQgb2YgaGF2aW5nXG4gICAgICAgICAqIGl0cyBvd24gbWVzaCBpbnN0YW5jZSBsaXN0LiBCb3RoIGxheWVycyBtdXN0IHNoYXJlIGNhbWVyYXMuIEZydXN0dW0gY3VsbGluZyBpcyBvbmx5XG4gICAgICAgICAqIHBlcmZvcm1lZCBmb3Igb25lIGxheWVyLiBVc2VmdWwgZm9yIHJlbmRlcmluZyBtdWx0aXBsZSBwYXNzZXMgdXNpbmcgZGlmZmVyZW50IHNoYWRlcnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtMYXllcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubGF5ZXJSZWZlcmVuY2UgPSBvcHRpb25zLmxheWVyUmVmZXJlbmNlOyAvLyBzaG91bGQgdXNlIHRoZSBzYW1lIGNhbWVyYVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7SW5zdGFuY2VMaXN0fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmluc3RhbmNlcyA9IG9wdGlvbnMubGF5ZXJSZWZlcmVuY2UgPyBvcHRpb25zLmxheWVyUmVmZXJlbmNlLmluc3RhbmNlcyA6IG5ldyBJbnN0YW5jZUxpc3QoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVmlzaWJpbGl0eSBiaXQgbWFzayB0aGF0IGludGVyYWN0cyB3aXRoIHtAbGluayBNZXNoSW5zdGFuY2UjbWFza30uIEVzcGVjaWFsbHkgdXNlZnVsXG4gICAgICAgICAqIHdoZW4gY29tYmluZWQgd2l0aCBsYXllclJlZmVyZW5jZSwgYWxsb3dpbmcgZm9yIHRoZSBmaWx0ZXJpbmcgb2Ygc29tZSBvYmplY3RzLCB3aGlsZVxuICAgICAgICAgKiBzaGFyaW5nIHRoZWlyIGxpc3QgYW5kIGN1bGxpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN1bGxpbmdNYXNrID0gb3B0aW9ucy5jdWxsaW5nTWFzayA/IG9wdGlvbnMuY3VsbGluZ01hc2sgOiAweEZGRkZGRkZGO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vcGFxdWVNZXNoSW5zdGFuY2VzID0gdGhpcy5pbnN0YW5jZXMub3BhcXVlTWVzaEluc3RhbmNlcztcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcztcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNoYWRvd0Nhc3RlcnMgPSB0aGlzLmluc3RhbmNlcy5zaGFkb3dDYXN0ZXJzO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb258bnVsbH1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdXN0b21Tb3J0Q2FsbGJhY2sgPSBudWxsO1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufG51bGx9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY3VzdG9tQ2FsY3VsYXRlU29ydFZhbHVlcyA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbGlnaHQuanMnKS5MaWdodFtdfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbGlnaHRzID0gW107XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7U2V0PGltcG9ydCgnLi9saWdodC5qcycpLkxpZ2h0Pn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpZ2h0c1NldCA9IG5ldyBTZXQoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IG9mIGxpZ2h0IHVzZWQgYnkgY2x1c3RlcmVkIGxpZ2h0aW5nIChvbW5pIGFuZCBzcG90LCBidXQgbm8gZGlyZWN0aW9uYWwpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2V0PGltcG9ydCgnLi9saWdodC5qcycpLkxpZ2h0Pn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldCA9IG5ldyBTZXQoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogTGlnaHRzIHNlcGFyYXRlZCBieSBsaWdodCB0eXBlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2xpZ2h0LmpzJykuTGlnaHRbXVtdfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zcGxpdExpZ2h0cyA9IFtbXSwgW10sIFtdXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudFtdfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNhbWVyYXMgPSBbXTtcblxuICAgICAgICB0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9saWdodEhhc2ggPSAwO1xuICAgICAgICB0aGlzLl9zdGF0aWNMaWdodEhhc2ggPSAwO1xuICAgICAgICB0aGlzLl9uZWVkc1N0YXRpY1ByZXBhcmUgPSB0cnVlO1xuICAgICAgICB0aGlzLl9zdGF0aWNQcmVwYXJlRG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5za2lwUmVuZGVyQWZ0ZXIgPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgICB0aGlzLl9za2lwUmVuZGVyQ291bnRlciA9IDA7XG5cbiAgICAgICAgdGhpcy5fcmVuZGVyVGltZSA9IDA7XG4gICAgICAgIHRoaXMuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLl9zaGFkb3dEcmF3Q2FsbHMgPSAwOyAgLy8gZGVwcmVjYXRlZCwgbm90IHVzZWZ1bCBvbiBhIGxheWVyIGFueW1vcmUsIGNvdWxkIGJlIG1vdmVkIHRvIGNhbWVyYVxuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0aGlzLl9zaGFkZXJWZXJzaW9uID0gLTE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtGbG9hdDMyQXJyYXl9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpZ2h0Q3ViZSA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgbGF5ZXIgY29udGFpbnMgb21uaSBvciBzcG90IGxpZ2h0c1xuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBoYXNDbHVzdGVyZWRMaWdodHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQuc2l6ZSA+IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHRoZSBsYXllci4gRGlzYWJsZWQgbGF5ZXJzIGFyZSBza2lwcGVkLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGVuYWJsZWQodmFsKSB7XG4gICAgICAgIGlmICh2YWwgIT09IHRoaXMuX2VuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VuYWJsZWQgPSB2YWw7XG4gICAgICAgICAgICBpZiAodmFsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmNyZW1lbnRDb3VudGVyKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMub25FbmFibGUpIHRoaXMub25FbmFibGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZWNyZW1lbnRDb3VudGVyKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMub25EaXNhYmxlKSB0aGlzLm9uRGlzYWJsZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGVuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgY29sb3IgYnVmZmVyIHdoZW4gaXQgcmVuZGVycyB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyQ29sb3JCdWZmZXIodmFsKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyQ29sb3JCdWZmZXIgPSB2YWw7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyQ29sb3JCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhckNvbG9yQnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgZGVwdGggYnVmZmVyIHdoZW4gaXQgcmVuZGVycyB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyRGVwdGhCdWZmZXIodmFsKSB7XG4gICAgICAgIHRoaXMuX2NsZWFyRGVwdGhCdWZmZXIgPSB2YWw7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyRGVwdGhCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhckRlcHRoQnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBjYW1lcmEgd2lsbCBjbGVhciB0aGUgc3RlbmNpbCBidWZmZXIgd2hlbiBpdCByZW5kZXJzIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2xlYXJTdGVuY2lsQnVmZmVyKHZhbCkge1xuICAgICAgICB0aGlzLl9jbGVhclN0ZW5jaWxCdWZmZXIgPSB2YWw7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsZWFyU3RlbmNpbEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGxpZ2h0cyB1c2VkIGJ5IGNsdXN0ZXJlZCBsaWdodGluZyBpbiBhIHNldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTZXQ8aW1wb3J0KCcuL2xpZ2h0LmpzJykuTGlnaHQ+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgY2x1c3RlcmVkTGlnaHRzU2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2x1c3RlcmVkTGlnaHRzU2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluY3JlbWVudHMgdGhlIHVzYWdlIGNvdW50ZXIgb2YgdGhpcyBsYXllci4gQnkgZGVmYXVsdCwgbGF5ZXJzIGFyZSBjcmVhdGVkIHdpdGggY291bnRlciBzZXRcbiAgICAgKiB0byAxIChpZiB7QGxpbmsgTGF5ZXIuZW5hYmxlZH0gaXMgdHJ1ZSkgb3IgMCAoaWYgaXQgd2FzIGZhbHNlKS4gSW5jcmVtZW50aW5nIHRoZSBjb3VudGVyXG4gICAgICogZnJvbSAwIHRvIDEgd2lsbCBlbmFibGUgdGhlIGxheWVyIGFuZCBjYWxsIHtAbGluayBMYXllci5vbkVuYWJsZX0uIFVzZSB0aGlzIGZ1bmN0aW9uIHRvXG4gICAgICogXCJzdWJzY3JpYmVcIiBtdWx0aXBsZSBlZmZlY3RzIHRvIHRoZSBzYW1lIGxheWVyLiBGb3IgZXhhbXBsZSwgaWYgdGhlIGxheWVyIGlzIHVzZWQgdG8gcmVuZGVyXG4gICAgICogYSByZWZsZWN0aW9uIHRleHR1cmUgd2hpY2ggaXMgdXNlZCBieSAyIG1pcnJvcnMsIHRoZW4gZWFjaCBtaXJyb3IgY2FuIGNhbGwgdGhpcyBmdW5jdGlvblxuICAgICAqIHdoZW4gdmlzaWJsZSBhbmQge0BsaW5rIExheWVyLmRlY3JlbWVudENvdW50ZXJ9IGlmIGludmlzaWJsZS4gSW4gc3VjaCBjYXNlIHRoZSByZWZsZWN0aW9uXG4gICAgICogdGV4dHVyZSB3b24ndCBiZSB1cGRhdGVkLCB3aGVuIHRoZXJlIGlzIG5vdGhpbmcgdG8gdXNlIGl0LCBzYXZpbmcgcGVyZm9ybWFuY2UuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgaW5jcmVtZW50Q291bnRlcigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlZkNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX2VuYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKHRoaXMub25FbmFibGUpIHRoaXMub25FbmFibGUoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9yZWZDb3VudGVyKys7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVjcmVtZW50cyB0aGUgdXNhZ2UgY291bnRlciBvZiB0aGlzIGxheWVyLiBEZWNyZW1lbnRpbmcgdGhlIGNvdW50ZXIgZnJvbSAxIHRvIDAgd2lsbFxuICAgICAqIGRpc2FibGUgdGhlIGxheWVyIGFuZCBjYWxsIHtAbGluayBMYXllci5vbkRpc2FibGV9LiBTZWUge0BsaW5rIExheWVyI2luY3JlbWVudENvdW50ZXJ9IGZvclxuICAgICAqIG1vcmUgZGV0YWlscy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkZWNyZW1lbnRDb3VudGVyKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVmQ291bnRlciA9PT0gMSkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKHRoaXMub25EaXNhYmxlKSB0aGlzLm9uRGlzYWJsZSgpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fcmVmQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgRGVidWcud2FybignVHJ5aW5nIHRvIGRlY3JlbWVudCBsYXllciBjb3VudGVyIGJlbG93IDAnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9yZWZDb3VudGVyLS07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhbiBhcnJheSBvZiBtZXNoIGluc3RhbmNlcyB0byB0aGlzIGxheWVyLlxuICAgICAqMVxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gQXJyYXkgb2ZcbiAgICAgKiB7QGxpbmsgTWVzaEluc3RhbmNlfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtza2lwU2hhZG93Q2FzdGVyc10gLSBTZXQgaXQgdG8gdHJ1ZSBpZiB5b3UgZG9uJ3Qgd2FudCB0aGVzZSBtZXNoIGluc3RhbmNlc1xuICAgICAqIHRvIGNhc3Qgc2hhZG93cyBpbiB0aGlzIGxheWVyLlxuICAgICAqL1xuICAgIGFkZE1lc2hJbnN0YW5jZXMobWVzaEluc3RhbmNlcywgc2tpcFNoYWRvd0Nhc3RlcnMpIHtcbiAgICAgICAgY29uc3Qgc2NlbmVTaGFkZXJWZXIgPSB0aGlzLl9zaGFkZXJWZXJzaW9uO1xuXG4gICAgICAgIGNvbnN0IGNhc3RlcnMgPSB0aGlzLnNoYWRvd0Nhc3RlcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbSA9IG1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICBjb25zdCBtYXQgPSBtLm1hdGVyaWFsO1xuICAgICAgICAgICAgY29uc3QgYXJyID0gbWF0LmJsZW5kVHlwZSA9PT0gQkxFTkRfTk9ORSA/IHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcyA6IHRoaXMudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICAvLyB0ZXN0IGZvciBtZXNoSW5zdGFuY2UgaW4gYm90aCBhcnJheXMsIGFzIG1hdGVyaWFsJ3MgYWxwaGEgY291bGQgaGF2ZSBjaGFuZ2VkIHNpbmNlIExheWVyQ29tcG9zaXRpb24ncyB1cGRhdGUgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgICAgICAgICAgLy8gVE9ETyAtIGZvbGxvd2luZyB1c2VzIG9mIGluZGV4T2YgYXJlIGV4cGVuc2l2ZSwgdG8gYWRkIDUwMDAgbWVzaEluc3RhbmNlcyBjb3N0cyBhYm91dCA3MG1zIG9uIE1hYy4gQ29uc2lkZXIgdXNpbmcgU2V0LlxuICAgICAgICAgICAgaWYgKHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcy5pbmRleE9mKG0pIDwgMCAmJiB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcy5pbmRleE9mKG0pIDwgMCkge1xuICAgICAgICAgICAgICAgIGFyci5wdXNoKG0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXNraXBTaGFkb3dDYXN0ZXJzICYmIG0uY2FzdFNoYWRvdyAmJiBjYXN0ZXJzLmluZGV4T2YobSkgPCAwKSBjYXN0ZXJzLnB1c2gobSk7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIG9sZCBzaGFkZXIgdmFyaWFudHMgaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgICBpZiAoIXRoaXMucGFzc1Rocm91Z2ggJiYgc2NlbmVTaGFkZXJWZXIgPj0gMCAmJiBtYXQuX3NoYWRlclZlcnNpb24gIT09IHNjZW5lU2hhZGVyVmVyKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBza2lwIHRoaXMgZm9yIG1hdGVyaWFscyBub3QgdXNpbmcgdmFyaWFudHNcbiAgICAgICAgICAgICAgICBpZiAobWF0LmdldFNoYWRlclZhcmlhbnQgIT09IE1hdGVyaWFsLnByb3RvdHlwZS5nZXRTaGFkZXJWYXJpYW50KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNsZWFyIHNoYWRlciB2YXJpYW50cyBvbiB0aGUgbWF0ZXJpYWwgYW5kIGFsc28gb24gbWVzaCBpbnN0YW5jZXMgdGhhdCB1c2UgaXRcbiAgICAgICAgICAgICAgICAgICAgbWF0LmNsZWFyVmFyaWFudHMoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbWF0Ll9zaGFkZXJWZXJzaW9uID0gc2NlbmVTaGFkZXJWZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLnBhc3NUaHJvdWdoKSB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgZnVuY3Rpb24gdG8gcmVtb3ZlIGEgbWVzaCBpbnN0YW5jZSBmcm9tIGFuIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZX0gbSAtIE1lc2ggaW5zdGFuY2UgdG8gcmVtb3ZlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gYXJyIC0gQXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMgdG8gcmVtb3ZlXG4gICAgICogZnJvbS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHJlbW92ZU1lc2hJbnN0YW5jZUZyb21BcnJheShtLCBhcnIpIHtcbiAgICAgICAgbGV0IHNwbGljZU9mZnNldCA9IC0xO1xuICAgICAgICBsZXQgc3BsaWNlQ291bnQgPSAwO1xuICAgICAgICBjb25zdCBsZW4gPSBhcnIubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGFycltqXTtcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbCA9PT0gbSkge1xuICAgICAgICAgICAgICAgIHNwbGljZU9mZnNldCA9IGo7XG4gICAgICAgICAgICAgICAgc3BsaWNlQ291bnQgPSAxO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLl9zdGF0aWNTb3VyY2UgPT09IG0pIHtcbiAgICAgICAgICAgICAgICBpZiAoc3BsaWNlT2Zmc2V0IDwgMCkgc3BsaWNlT2Zmc2V0ID0gajtcbiAgICAgICAgICAgICAgICBzcGxpY2VDb3VudCsrO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChzcGxpY2VPZmZzZXQgPj0gMCkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNwbGljZU9mZnNldCA+PSAwKSB7XG4gICAgICAgICAgICBhcnIuc3BsaWNlKHNwbGljZU9mZnNldCwgc3BsaWNlQ291bnQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBtdWx0aXBsZSBtZXNoIGluc3RhbmNlcyBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IG1lc2hJbnN0YW5jZXMgLSBBcnJheSBvZlxuICAgICAqIHtAbGluayBNZXNoSW5zdGFuY2V9LiBJZiB0aGV5IHdlcmUgYWRkZWQgdG8gdGhpcyBsYXllciwgdGhleSB3aWxsIGJlIHJlbW92ZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbc2tpcFNoYWRvd0Nhc3RlcnNdIC0gU2V0IGl0IHRvIHRydWUgaWYgeW91IHdhbnQgdG8gc3RpbGwgY2FzdCBzaGFkb3dzIGZyb21cbiAgICAgKiByZW1vdmVkIG1lc2ggaW5zdGFuY2VzIG9yIGlmIHRoZXkgbmV2ZXIgZGlkIGNhc3Qgc2hhZG93cyBiZWZvcmUuXG4gICAgICovXG4gICAgcmVtb3ZlTWVzaEluc3RhbmNlcyhtZXNoSW5zdGFuY2VzLCBza2lwU2hhZG93Q2FzdGVycykge1xuXG4gICAgICAgIGNvbnN0IG9wYXF1ZSA9IHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcztcbiAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcztcbiAgICAgICAgY29uc3QgY2FzdGVycyA9IHRoaXMuc2hhZG93Q2FzdGVycztcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG0gPSBtZXNoSW5zdGFuY2VzW2ldO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgZnJvbSBvcGFxdWVcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTWVzaEluc3RhbmNlRnJvbUFycmF5KG0sIG9wYXF1ZSk7XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBmcm9tIHRyYW5zcGFyZW50XG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1lc2hJbnN0YW5jZUZyb21BcnJheShtLCB0cmFuc3BhcmVudCk7XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBmcm9tIGNhc3RlcnNcbiAgICAgICAgICAgIGlmICghc2tpcFNoYWRvd0Nhc3RlcnMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBqID0gY2FzdGVycy5pbmRleE9mKG0pO1xuICAgICAgICAgICAgICAgIGlmIChqID49IDApXG4gICAgICAgICAgICAgICAgICAgIGNhc3RlcnMuc3BsaWNlKGosIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIG1lc2ggaW5zdGFuY2VzIGZyb20gdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3NraXBTaGFkb3dDYXN0ZXJzXSAtIFNldCBpdCB0byB0cnVlIGlmIHlvdSB3YW50IHRvIHN0aWxsIGNhc3Qgc2hhZG93cyBmcm9tXG4gICAgICogcmVtb3ZlZCBtZXNoIGluc3RhbmNlcyBvciBpZiB0aGV5IG5ldmVyIGRpZCBjYXN0IHNoYWRvd3MgYmVmb3JlLlxuICAgICAqL1xuICAgIGNsZWFyTWVzaEluc3RhbmNlcyhza2lwU2hhZG93Q2FzdGVycykge1xuICAgICAgICBpZiAodGhpcy5vcGFxdWVNZXNoSW5zdGFuY2VzLmxlbmd0aCA9PT0gMCAmJiB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGlmIChza2lwU2hhZG93Q2FzdGVycyB8fCB0aGlzLnNoYWRvd0Nhc3RlcnMubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vcGFxdWVNZXNoSW5zdGFuY2VzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzLmxlbmd0aCA9IDA7XG4gICAgICAgIGlmICghc2tpcFNoYWRvd0Nhc3RlcnMpIHRoaXMuc2hhZG93Q2FzdGVycy5sZW5ndGggPSAwO1xuICAgICAgICBpZiAoIXRoaXMucGFzc1Rocm91Z2gpIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgbGlnaHQgdG8gdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9saWdodC9jb21wb25lbnQuanMnKS5MaWdodENvbXBvbmVudH0gbGlnaHQgLSBBXG4gICAgICoge0BsaW5rIExpZ2h0Q29tcG9uZW50fS5cbiAgICAgKi9cbiAgICBhZGRMaWdodChsaWdodCkge1xuXG4gICAgICAgIC8vIGlmIHRoZSBsaWdodCBpcyBub3QgaW4gdGhlIGxheWVyIGFscmVhZHlcbiAgICAgICAgY29uc3QgbCA9IGxpZ2h0LmxpZ2h0O1xuICAgICAgICBpZiAoIXRoaXMuX2xpZ2h0c1NldC5oYXMobCkpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0c1NldC5hZGQobCk7XG5cbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0cy5wdXNoKGwpO1xuICAgICAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fZ2VuZXJhdGVMaWdodEhhc2goKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsLnR5cGUgIT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRzU2V0LmFkZChsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYSBsaWdodCBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzJykuTGlnaHRDb21wb25lbnR9IGxpZ2h0IC0gQVxuICAgICAqIHtAbGluayBMaWdodENvbXBvbmVudH0uXG4gICAgICovXG4gICAgcmVtb3ZlTGlnaHQobGlnaHQpIHtcblxuICAgICAgICBjb25zdCBsID0gbGlnaHQubGlnaHQ7XG4gICAgICAgIGlmICh0aGlzLl9saWdodHNTZXQuaGFzKGwpKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodHNTZXQuZGVsZXRlKGwpO1xuXG4gICAgICAgICAgICB0aGlzLl9saWdodHMuc3BsaWNlKHRoaXMuX2xpZ2h0cy5pbmRleE9mKGwpLCAxKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2dlbmVyYXRlTGlnaHRIYXNoKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobC50eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldC5kZWxldGUobCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBsaWdodHMgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqL1xuICAgIGNsZWFyTGlnaHRzKCkge1xuICAgICAgICB0aGlzLl9saWdodHNTZXQuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRzU2V0LmNsZWFyKCk7XG4gICAgICAgIHRoaXMuX2xpZ2h0cy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhbiBhcnJheSBvZiBtZXNoIGluc3RhbmNlcyB0byB0aGlzIGxheWVyLCBidXQgb25seSBhcyBzaGFkb3cgY2FzdGVycyAodGhleSB3aWxsIG5vdCBiZVxuICAgICAqIHJlbmRlcmVkIGFueXdoZXJlLCBidXQgb25seSBjYXN0IHNoYWRvd3Mgb24gb3RoZXIgb2JqZWN0cykuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IG1lc2hJbnN0YW5jZXMgLSBBcnJheSBvZlxuICAgICAqIHtAbGluayBNZXNoSW5zdGFuY2V9LlxuICAgICAqL1xuICAgIGFkZFNoYWRvd0Nhc3RlcnMobWVzaEluc3RhbmNlcykge1xuICAgICAgICBjb25zdCBhcnIgPSB0aGlzLnNoYWRvd0Nhc3RlcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbSA9IG1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICBpZiAoIW0uY2FzdFNoYWRvdykgY29udGludWU7XG4gICAgICAgICAgICBpZiAoYXJyLmluZGV4T2YobSkgPCAwKSBhcnIucHVzaChtKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBtdWx0aXBsZSBtZXNoIGluc3RhbmNlcyBmcm9tIHRoZSBzaGFkb3cgY2FzdGVycyBsaXN0IG9mIHRoaXMgbGF5ZXIsIG1lYW5pbmcgdGhleVxuICAgICAqIHdpbGwgc3RvcCBjYXN0aW5nIHNoYWRvd3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IG1lc2hJbnN0YW5jZXMgLSBBcnJheSBvZlxuICAgICAqIHtAbGluayBNZXNoSW5zdGFuY2V9LiBJZiB0aGV5IHdlcmUgYWRkZWQgdG8gdGhpcyBsYXllciwgdGhleSB3aWxsIGJlIHJlbW92ZWQuXG4gICAgICovXG4gICAgcmVtb3ZlU2hhZG93Q2FzdGVycyhtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IGFyciA9IHRoaXMuc2hhZG93Q2FzdGVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGFyci5pbmRleE9mKG1lc2hJbnN0YW5jZXNbaV0pO1xuICAgICAgICAgICAgaWYgKGlkID49IDApIGFyci5zcGxpY2UoaWQsIDEpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZ2VuZXJhdGVMaWdodEhhc2goKSB7XG4gICAgICAgIC8vIGdlbmVyYXRlIGhhc2ggdG8gY2hlY2sgaWYgbGF5ZXJzIGhhdmUgdGhlIHNhbWUgc2V0IG9mIHN0YXRpYyBsaWdodHNcbiAgICAgICAgLy8gb3JkZXIgb2YgbGlnaHRzIHNob3VsZG4ndCBtYXR0ZXJcbiAgICAgICAgaWYgKHRoaXMuX2xpZ2h0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodHMuc29ydChzb3J0TGlnaHRzKTtcbiAgICAgICAgICAgIGxldCBzdHIgPSAnJztcbiAgICAgICAgICAgIGxldCBzdHJTdGF0aWMgPSAnJztcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9saWdodHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fbGlnaHRzW2ldLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0clN0YXRpYyArPSB0aGlzLl9saWdodHNbaV0ua2V5O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHN0ciArPSB0aGlzLl9saWdodHNbaV0ua2V5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0ci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9saWdodEhhc2ggPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9saWdodEhhc2ggPSBoYXNoQ29kZShzdHIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc3RyU3RhdGljLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXRpY0xpZ2h0SGFzaCA9IDA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0YXRpY0xpZ2h0SGFzaCA9IGhhc2hDb2RlKHN0clN0YXRpYyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0SGFzaCA9IDA7XG4gICAgICAgICAgICB0aGlzLl9zdGF0aWNMaWdodEhhc2ggPSAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGNhbWVyYSB0byB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIEFcbiAgICAgKiB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50fS5cbiAgICAgKi9cbiAgICBhZGRDYW1lcmEoY2FtZXJhKSB7XG4gICAgICAgIGlmICh0aGlzLmNhbWVyYXMuaW5kZXhPZihjYW1lcmEpID49IDApIHJldHVybjtcbiAgICAgICAgdGhpcy5jYW1lcmFzLnB1c2goY2FtZXJhKTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgY2FtZXJhIGZyb20gdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBBXG4gICAgICoge0BsaW5rIENhbWVyYUNvbXBvbmVudH0uXG4gICAgICovXG4gICAgcmVtb3ZlQ2FtZXJhKGNhbWVyYSkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgIGlmIChpbmRleCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmNhbWVyYXMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGRlbGV0ZSB0aGUgdmlzaWJsZSBsaXN0IGZvciB0aGlzIGNhbWVyYVxuICAgICAgICAgICAgdGhpcy5pbnN0YW5jZXMuZGVsZXRlKGluZGV4KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIGNhbWVyYXMgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqL1xuICAgIGNsZWFyQ2FtZXJhcygpIHtcbiAgICAgICAgdGhpcy5jYW1lcmFzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBkcmF3Q2FsbHMgLSBBcnJheSBvZiBtZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHJhd0NhbGxzQ291bnQgLSBOdW1iZXIgb2YgbWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtWZWMzfSBjYW1Qb3MgLSBDYW1lcmEgcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtWZWMzfSBjYW1Gd2QgLSBDYW1lcmEgZm9yd2FyZCB2ZWN0b3IuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2FsY3VsYXRlU29ydERpc3RhbmNlcyhkcmF3Q2FsbHMsIGRyYXdDYWxsc0NvdW50LCBjYW1Qb3MsIGNhbUZ3ZCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxsc0NvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxsID0gZHJhd0NhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmNvbW1hbmQpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGRyYXdDYWxsLmxheWVyIDw9IExBWUVSX0ZYKSBjb250aW51ZTsgLy8gT25seSBhbHBoYSBzb3J0IG1lc2ggaW5zdGFuY2VzIGluIHRoZSBtYWluIHdvcmxkIChiYWNrd2FyZHMgY29tcClcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jYWxjdWxhdGVTb3J0RGlzdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBkcmF3Q2FsbC56ZGlzdCA9IGRyYXdDYWxsLmNhbGN1bGF0ZVNvcnREaXN0YW5jZShkcmF3Q2FsbCwgY2FtUG9zLCBjYW1Gd2QpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgbWVzaFBvcyA9IGRyYXdDYWxsLmFhYmIuY2VudGVyO1xuICAgICAgICAgICAgY29uc3QgdGVtcHggPSBtZXNoUG9zLnggLSBjYW1Qb3MueDtcbiAgICAgICAgICAgIGNvbnN0IHRlbXB5ID0gbWVzaFBvcy55IC0gY2FtUG9zLnk7XG4gICAgICAgICAgICBjb25zdCB0ZW1weiA9IG1lc2hQb3MueiAtIGNhbVBvcy56O1xuICAgICAgICAgICAgZHJhd0NhbGwuemRpc3QgPSB0ZW1weCAqIGNhbUZ3ZC54ICsgdGVtcHkgKiBjYW1Gd2QueSArIHRlbXB6ICogY2FtRndkLno7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHRyYW5zcGFyZW50IC0gVHJ1ZSBpZiB0cmFuc3BhcmVudCBzb3J0aW5nIHNob3VsZCBiZSB1c2VkLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2dyYXBoLW5vZGUuanMnKS5HcmFwaE5vZGV9IGNhbWVyYU5vZGUgLSBHcmFwaCBub2RlIHRoYXQgdGhlIGNhbWVyYSBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjYW1lcmFQYXNzIC0gQ2FtZXJhIHBhc3MuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9zb3J0VmlzaWJsZSh0cmFuc3BhcmVudCwgY2FtZXJhTm9kZSwgY2FtZXJhUGFzcykge1xuICAgICAgICBjb25zdCBvYmplY3RzID0gdGhpcy5pbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IHNvcnRNb2RlID0gdHJhbnNwYXJlbnQgPyB0aGlzLnRyYW5zcGFyZW50U29ydE1vZGUgOiB0aGlzLm9wYXF1ZVNvcnRNb2RlO1xuICAgICAgICBpZiAoc29ydE1vZGUgPT09IFNPUlRNT0RFX05PTkUpIHJldHVybjtcblxuICAgICAgICBjb25zdCB2aXNpYmxlID0gdHJhbnNwYXJlbnQgPyBvYmplY3RzLnZpc2libGVUcmFuc3BhcmVudFtjYW1lcmFQYXNzXSA6IG9iamVjdHMudmlzaWJsZU9wYXF1ZVtjYW1lcmFQYXNzXTtcblxuICAgICAgICBpZiAoc29ydE1vZGUgPT09IFNPUlRNT0RFX0NVU1RPTSkge1xuICAgICAgICAgICAgc29ydFBvcyA9IGNhbWVyYU5vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIHNvcnREaXIgPSBjYW1lcmFOb2RlLmZvcndhcmQ7XG4gICAgICAgICAgICBpZiAodGhpcy5jdXN0b21DYWxjdWxhdGVTb3J0VmFsdWVzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXN0b21DYWxjdWxhdGVTb3J0VmFsdWVzKHZpc2libGUubGlzdCwgdmlzaWJsZS5sZW5ndGgsIHNvcnRQb3MsIHNvcnREaXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmlzaWJsZS5saXN0Lmxlbmd0aCAhPT0gdmlzaWJsZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2aXNpYmxlLmxpc3QubGVuZ3RoID0gdmlzaWJsZS5sZW5ndGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmN1c3RvbVNvcnRDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIHZpc2libGUubGlzdC5zb3J0KHRoaXMuY3VzdG9tU29ydENhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChzb3J0TW9kZSA9PT0gU09SVE1PREVfQkFDSzJGUk9OVCB8fCBzb3J0TW9kZSA9PT0gU09SVE1PREVfRlJPTlQyQkFDSykge1xuICAgICAgICAgICAgICAgIHNvcnRQb3MgPSBjYW1lcmFOb2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICAgICAgc29ydERpciA9IGNhbWVyYU5vZGUuZm9yd2FyZDtcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVTb3J0RGlzdGFuY2VzKHZpc2libGUubGlzdCwgdmlzaWJsZS5sZW5ndGgsIHNvcnRQb3MsIHNvcnREaXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmlzaWJsZS5saXN0Lmxlbmd0aCAhPT0gdmlzaWJsZS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICB2aXNpYmxlLmxpc3QubGVuZ3RoID0gdmlzaWJsZS5sZW5ndGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZpc2libGUubGlzdC5zb3J0KHNvcnRDYWxsYmFja3Nbc29ydE1vZGVdKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgTGF5ZXIgfTtcbiJdLCJuYW1lcyI6WyJrZXlBIiwia2V5QiIsInNvcnRQb3MiLCJzb3J0RGlyIiwic29ydE1hbnVhbCIsImRyYXdDYWxsQSIsImRyYXdDYWxsQiIsImRyYXdPcmRlciIsInNvcnRNYXRlcmlhbE1lc2giLCJfa2V5IiwiU09SVEtFWV9GT1JXQVJEIiwibWVzaCIsImlkIiwic29ydEJhY2tUb0Zyb250IiwiemRpc3QiLCJzb3J0RnJvbnRUb0JhY2siLCJzb3J0Q2FsbGJhY2tzIiwic29ydExpZ2h0cyIsImxpZ2h0QSIsImxpZ2h0QiIsImtleSIsImxheWVyQ291bnRlciIsIlZpc2libGVJbnN0YW5jZUxpc3QiLCJjb25zdHJ1Y3RvciIsImxpc3QiLCJsZW5ndGgiLCJkb25lIiwiSW5zdGFuY2VMaXN0Iiwib3BhcXVlTWVzaEluc3RhbmNlcyIsInRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyIsInNoYWRvd0Nhc3RlcnMiLCJ2aXNpYmxlT3BhcXVlIiwidmlzaWJsZVRyYW5zcGFyZW50IiwicHJlcGFyZSIsImluZGV4IiwiZGVsZXRlIiwic3BsaWNlIiwiTGF5ZXIiLCJvcHRpb25zIiwiX29wdGlvbnMkZW5hYmxlZCIsIl9vcHRpb25zJG9wYXF1ZVNvcnRNbyIsIl9vcHRpb25zJHRyYW5zcGFyZW50UyIsIl9vcHRpb25zJHNoYWRlclBhc3MiLCJfb3B0aW9ucyRwYXNzVGhyb3VnaCIsInVuZGVmaW5lZCIsIk1hdGgiLCJtYXgiLCJuYW1lIiwiX2VuYWJsZWQiLCJlbmFibGVkIiwiX3JlZkNvdW50ZXIiLCJvcGFxdWVTb3J0TW9kZSIsIlNPUlRNT0RFX01BVEVSSUFMTUVTSCIsInRyYW5zcGFyZW50U29ydE1vZGUiLCJTT1JUTU9ERV9CQUNLMkZST05UIiwicmVuZGVyVGFyZ2V0Iiwic2hhZGVyUGFzcyIsIlNIQURFUl9GT1JXQVJEIiwicGFzc1Rocm91Z2giLCJfY2xlYXJDb2xvckJ1ZmZlciIsImNsZWFyQ29sb3JCdWZmZXIiLCJfY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyRGVwdGhCdWZmZXIiLCJfY2xlYXJTdGVuY2lsQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwib25QcmVDdWxsIiwib25QcmVSZW5kZXIiLCJvblByZVJlbmRlck9wYXF1ZSIsIm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQiLCJvblBvc3RDdWxsIiwib25Qb3N0UmVuZGVyIiwib25Qb3N0UmVuZGVyT3BhcXVlIiwib25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQiLCJvbkRyYXdDYWxsIiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJsYXllclJlZmVyZW5jZSIsImluc3RhbmNlcyIsImN1bGxpbmdNYXNrIiwiY3VzdG9tU29ydENhbGxiYWNrIiwiY3VzdG9tQ2FsY3VsYXRlU29ydFZhbHVlcyIsIl9saWdodHMiLCJfbGlnaHRzU2V0IiwiU2V0IiwiX2NsdXN0ZXJlZExpZ2h0c1NldCIsIl9zcGxpdExpZ2h0cyIsImNhbWVyYXMiLCJfZGlydHkiLCJfZGlydHlMaWdodHMiLCJfZGlydHlDYW1lcmFzIiwiX2xpZ2h0SGFzaCIsIl9zdGF0aWNMaWdodEhhc2giLCJfbmVlZHNTdGF0aWNQcmVwYXJlIiwiX3N0YXRpY1ByZXBhcmVEb25lIiwic2tpcFJlbmRlckFmdGVyIiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwiX3NraXBSZW5kZXJDb3VudGVyIiwiX3JlbmRlclRpbWUiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJfc2hhZGVyVmVyc2lvbiIsIl9saWdodEN1YmUiLCJoYXNDbHVzdGVyZWRMaWdodHMiLCJzaXplIiwidmFsIiwiaW5jcmVtZW50Q291bnRlciIsImRlY3JlbWVudENvdW50ZXIiLCJjbHVzdGVyZWRMaWdodHNTZXQiLCJEZWJ1ZyIsIndhcm4iLCJhZGRNZXNoSW5zdGFuY2VzIiwibWVzaEluc3RhbmNlcyIsInNraXBTaGFkb3dDYXN0ZXJzIiwic2NlbmVTaGFkZXJWZXIiLCJjYXN0ZXJzIiwiaSIsIm0iLCJtYXQiLCJtYXRlcmlhbCIsImFyciIsImJsZW5kVHlwZSIsIkJMRU5EX05PTkUiLCJpbmRleE9mIiwicHVzaCIsImNhc3RTaGFkb3ciLCJnZXRTaGFkZXJWYXJpYW50IiwiTWF0ZXJpYWwiLCJwcm90b3R5cGUiLCJjbGVhclZhcmlhbnRzIiwicmVtb3ZlTWVzaEluc3RhbmNlRnJvbUFycmF5Iiwic3BsaWNlT2Zmc2V0Iiwic3BsaWNlQ291bnQiLCJsZW4iLCJqIiwiZHJhd0NhbGwiLCJfc3RhdGljU291cmNlIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIm9wYXF1ZSIsInRyYW5zcGFyZW50IiwiY2xlYXJNZXNoSW5zdGFuY2VzIiwiYWRkTGlnaHQiLCJsaWdodCIsImwiLCJoYXMiLCJhZGQiLCJfZ2VuZXJhdGVMaWdodEhhc2giLCJ0eXBlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwicmVtb3ZlTGlnaHQiLCJjbGVhckxpZ2h0cyIsImNsZWFyIiwiYWRkU2hhZG93Q2FzdGVycyIsInJlbW92ZVNoYWRvd0Nhc3RlcnMiLCJzb3J0Iiwic3RyIiwic3RyU3RhdGljIiwiaXNTdGF0aWMiLCJoYXNoQ29kZSIsImFkZENhbWVyYSIsImNhbWVyYSIsInJlbW92ZUNhbWVyYSIsImNsZWFyQ2FtZXJhcyIsIl9jYWxjdWxhdGVTb3J0RGlzdGFuY2VzIiwiZHJhd0NhbGxzIiwiZHJhd0NhbGxzQ291bnQiLCJjYW1Qb3MiLCJjYW1Gd2QiLCJjb21tYW5kIiwibGF5ZXIiLCJMQVlFUl9GWCIsImNhbGN1bGF0ZVNvcnREaXN0YW5jZSIsIm1lc2hQb3MiLCJhYWJiIiwiY2VudGVyIiwidGVtcHgiLCJ4IiwidGVtcHkiLCJ5IiwidGVtcHoiLCJ6IiwiX3NvcnRWaXNpYmxlIiwiY2FtZXJhTm9kZSIsImNhbWVyYVBhc3MiLCJvYmplY3RzIiwic29ydE1vZGUiLCJTT1JUTU9ERV9OT05FIiwidmlzaWJsZSIsIlNPUlRNT0RFX0NVU1RPTSIsImdldFBvc2l0aW9uIiwiZm9yd2FyZCIsIlNPUlRNT0RFX0ZST05UMkJBQ0siXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFhQSxJQUFJQSxJQUFJLEVBQUVDLElBQUksRUFBRUMsT0FBTyxFQUFFQyxPQUFPLENBQUE7QUFFaEMsU0FBU0MsVUFBVUEsQ0FBQ0MsU0FBUyxFQUFFQyxTQUFTLEVBQUU7QUFDdEMsRUFBQSxPQUFPRCxTQUFTLENBQUNFLFNBQVMsR0FBR0QsU0FBUyxDQUFDQyxTQUFTLENBQUE7QUFDcEQsQ0FBQTtBQUVBLFNBQVNDLGdCQUFnQkEsQ0FBQ0gsU0FBUyxFQUFFQyxTQUFTLEVBQUU7QUFDNUNOLEVBQUFBLElBQUksR0FBR0ssU0FBUyxDQUFDSSxJQUFJLENBQUNDLGVBQWUsQ0FBQyxDQUFBO0FBQ3RDVCxFQUFBQSxJQUFJLEdBQUdLLFNBQVMsQ0FBQ0csSUFBSSxDQUFDQyxlQUFlLENBQUMsQ0FBQTtFQUN0QyxJQUFJVixJQUFJLEtBQUtDLElBQUksSUFBSUksU0FBUyxDQUFDTSxJQUFJLElBQUlMLFNBQVMsQ0FBQ0ssSUFBSSxFQUFFO0lBQ25ELE9BQU9MLFNBQVMsQ0FBQ0ssSUFBSSxDQUFDQyxFQUFFLEdBQUdQLFNBQVMsQ0FBQ00sSUFBSSxDQUFDQyxFQUFFLENBQUE7QUFDaEQsR0FBQTtFQUNBLE9BQU9YLElBQUksR0FBR0QsSUFBSSxD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
