/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
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
    this._enabled = options.enabled === undefined ? true : options.enabled;
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
    this.opaqueSortMode = options.opaqueSortMode === undefined ? SORTMODE_MATERIALMESH : options.opaqueSortMode;

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
    this.transparentSortMode = options.transparentSortMode === undefined ? SORTMODE_BACK2FRONT : options.transparentSortMode;
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
    this.shaderPass = options.shaderPass === undefined ? SHADER_FORWARD : options.shaderPass;

    /**
     * Tells that this layer is simple and needs to just render a bunch of mesh instances
     * without lighting, skinning and morphing (faster). Used for UI and Gizmo layers (the
     * layer doesn't use lights, shadows, culling, etc).
     *
     * @type {boolean}
     */
    this.passThrough = options.passThrough === undefined ? false : options.passThrough;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9sYXllci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgaGFzaENvZGUgfSBmcm9tICcuLi9jb3JlL2hhc2guanMnO1xuXG5pbXBvcnQge1xuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICBCTEVORF9OT05FLFxuICAgIExBWUVSX0ZYLFxuICAgIFNIQURFUl9GT1JXQVJELFxuICAgIFNPUlRLRVlfRk9SV0FSRCxcbiAgICBTT1JUTU9ERV9CQUNLMkZST05ULCBTT1JUTU9ERV9DVVNUT00sIFNPUlRNT0RFX0ZST05UMkJBQ0ssIFNPUlRNT0RFX01BVEVSSUFMTUVTSCwgU09SVE1PREVfTk9ORVxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcblxubGV0IGtleUEsIGtleUIsIHNvcnRQb3MsIHNvcnREaXI7XG5cbmZ1bmN0aW9uIHNvcnRNYW51YWwoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxBLmRyYXdPcmRlciAtIGRyYXdDYWxsQi5kcmF3T3JkZXI7XG59XG5cbmZ1bmN0aW9uIHNvcnRNYXRlcmlhbE1lc2goZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICBrZXlBID0gZHJhd0NhbGxBLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICBrZXlCID0gZHJhd0NhbGxCLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICBpZiAoa2V5QSA9PT0ga2V5QiAmJiBkcmF3Q2FsbEEubWVzaCAmJiBkcmF3Q2FsbEIubWVzaCkge1xuICAgICAgICByZXR1cm4gZHJhd0NhbGxCLm1lc2guaWQgLSBkcmF3Q2FsbEEubWVzaC5pZDtcbiAgICB9XG4gICAgcmV0dXJuIGtleUIgLSBrZXlBO1xufVxuXG5mdW5jdGlvbiBzb3J0QmFja1RvRnJvbnQoZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxCLnpkaXN0IC0gZHJhd0NhbGxBLnpkaXN0O1xufVxuXG5mdW5jdGlvbiBzb3J0RnJvbnRUb0JhY2soZHJhd0NhbGxBLCBkcmF3Q2FsbEIpIHtcbiAgICByZXR1cm4gZHJhd0NhbGxBLnpkaXN0IC0gZHJhd0NhbGxCLnpkaXN0O1xufVxuXG5jb25zdCBzb3J0Q2FsbGJhY2tzID0gW251bGwsIHNvcnRNYW51YWwsIHNvcnRNYXRlcmlhbE1lc2gsIHNvcnRCYWNrVG9Gcm9udCwgc29ydEZyb250VG9CYWNrXTtcblxuZnVuY3Rpb24gc29ydExpZ2h0cyhsaWdodEEsIGxpZ2h0Qikge1xuICAgIHJldHVybiBsaWdodEIua2V5IC0gbGlnaHRBLmtleTtcbn1cblxuLy8gTGF5ZXJzXG5sZXQgbGF5ZXJDb3VudGVyID0gMDtcblxuY2xhc3MgVmlzaWJsZUluc3RhbmNlTGlzdCB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubGlzdCA9IFtdO1xuICAgICAgICB0aGlzLmxlbmd0aCA9IDA7XG4gICAgICAgIHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgIH1cbn1cblxuY2xhc3MgSW5zdGFuY2VMaXN0IHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5vcGFxdWVNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgIHRoaXMudHJhbnNwYXJlbnRNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgIHRoaXMuc2hhZG93Q2FzdGVycyA9IFtdO1xuXG4gICAgICAgIC8vIGFycmF5cyBvZiBWaXNpYmxlSW5zdGFuY2VMaXN0IGZvciBlYWNoIGNhbWVyYSBvZiB0aGlzIGxheWVyXG4gICAgICAgIHRoaXMudmlzaWJsZU9wYXF1ZSA9IFtdO1xuICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudCA9IFtdO1xuICAgIH1cblxuICAgIC8vIHByZXBhcmUgZm9yIGN1bGxpbmcgb2YgY2FtZXJhIHdpdGggc3BlY2lmaWVkIGluZGV4XG4gICAgcHJlcGFyZShpbmRleCkge1xuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSB2aXNpYmlsaXR5IGxpc3RzIGFyZSBhbGxvY2F0ZWRcbiAgICAgICAgaWYgKCF0aGlzLnZpc2libGVPcGFxdWVbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLnZpc2libGVPcGFxdWVbaW5kZXhdID0gbmV3IFZpc2libGVJbnN0YW5jZUxpc3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy52aXNpYmxlVHJhbnNwYXJlbnRbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudFtpbmRleF0gPSBuZXcgVmlzaWJsZUluc3RhbmNlTGlzdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFyayB0aGVtIGFzIG5vdCBwcm9jZXNzZWQgeWV0XG4gICAgICAgIHRoaXMudmlzaWJsZU9wYXF1ZVtpbmRleF0uZG9uZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudFtpbmRleF0uZG9uZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIGRlbGV0ZSBlbnRyeSBmb3IgYSBjYW1lcmEgd2l0aCBzcGVjaWZpZWQgaW5kZXhcbiAgICBkZWxldGUoaW5kZXgpIHtcbiAgICAgICAgaWYgKGluZGV4IDwgdGhpcy52aXNpYmxlT3BhcXVlLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy52aXNpYmxlT3BhcXVlLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGV4IDwgdGhpcy52aXNpYmxlVHJhbnNwYXJlbnQubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLnZpc2libGVUcmFuc3BhcmVudC5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIEEgTGF5ZXIgcmVwcmVzZW50cyBhIHJlbmRlcmFibGUgc3Vic2V0IG9mIHRoZSBzY2VuZS4gSXQgY2FuIGNvbnRhaW4gYSBsaXN0IG9mIG1lc2ggaW5zdGFuY2VzLFxuICogbGlnaHRzIGFuZCBjYW1lcmFzLCB0aGVpciByZW5kZXIgc2V0dGluZ3MgYW5kIGFsc28gZGVmaW5lcyBjdXN0b20gY2FsbGJhY2tzIGJlZm9yZSwgYWZ0ZXIgb3JcbiAqIGR1cmluZyByZW5kZXJpbmcuIExheWVycyBhcmUgb3JnYW5pemVkIGluc2lkZSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0gaW4gYSBkZXNpcmVkIG9yZGVyLlxuICovXG5jbGFzcyBMYXllciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IExheWVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBPYmplY3QgZm9yIHBhc3Npbmcgb3B0aW9uYWwgYXJndW1lbnRzLiBUaGVzZSBhcmd1bWVudHMgYXJlIHRoZVxuICAgICAqIHNhbWUgYXMgcHJvcGVydGllcyBvZiB0aGUgTGF5ZXIuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBBIHVuaXF1ZSBJRCBvZiB0aGUgbGF5ZXIuIExheWVyIElEcyBhcmUgc3RvcmVkIGluc2lkZSB7QGxpbmsgTW9kZWxDb21wb25lbnQjbGF5ZXJzfSxcbiAgICAgICAgICAgICAqIHtAbGluayBSZW5kZXJDb21wb25lbnQjbGF5ZXJzfSwge0BsaW5rIENhbWVyYUNvbXBvbmVudCNsYXllcnN9LFxuICAgICAgICAgICAgICoge0BsaW5rIExpZ2h0Q29tcG9uZW50I2xheWVyc30gYW5kIHtAbGluayBFbGVtZW50Q29tcG9uZW50I2xheWVyc30gaW5zdGVhZCBvZiBuYW1lcy5cbiAgICAgICAgICAgICAqIENhbiBiZSB1c2VkIGluIHtAbGluayBMYXllckNvbXBvc2l0aW9uI2dldExheWVyQnlJZH0uXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5pZCA9IG9wdGlvbnMuaWQ7XG4gICAgICAgICAgICBsYXllckNvdW50ZXIgPSBNYXRoLm1heCh0aGlzLmlkICsgMSwgbGF5ZXJDb3VudGVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBsYXllckNvdW50ZXIrKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBOYW1lIG9mIHRoZSBsYXllci4gQ2FuIGJlIHVzZWQgaW4ge0BsaW5rIExheWVyQ29tcG9zaXRpb24jZ2V0TGF5ZXJCeU5hbWV9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSBvcHRpb25zLmVuYWJsZWQgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBvcHRpb25zLmVuYWJsZWQ7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcmVmQ291bnRlciA9IHRoaXMuX2VuYWJsZWQgPyAxIDogMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmaW5lcyB0aGUgbWV0aG9kIHVzZWQgZm9yIHNvcnRpbmcgb3BhcXVlICh0aGF0IGlzLCBub3Qgc2VtaS10cmFuc3BhcmVudCkgbWVzaFxuICAgICAgICAgKiBpbnN0YW5jZXMgYmVmb3JlIHJlbmRlcmluZy4gQ2FuIGJlOlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9OT05FfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX01BVEVSSUFMTUVTSH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfQkFDSzJGUk9OVH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfRlJPTlQyQkFDS31cbiAgICAgICAgICpcbiAgICAgICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFNPUlRNT0RFX01BVEVSSUFMTUVTSH0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9wYXF1ZVNvcnRNb2RlID0gb3B0aW9ucy5vcGFxdWVTb3J0TW9kZSA9PT0gdW5kZWZpbmVkID8gU09SVE1PREVfTUFURVJJQUxNRVNIIDogb3B0aW9ucy5vcGFxdWVTb3J0TW9kZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmaW5lcyB0aGUgbWV0aG9kIHVzZWQgZm9yIHNvcnRpbmcgc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcyBiZWZvcmUgcmVuZGVyaW5nLiBDYW4gYmU6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX05PTkV9XG4gICAgICAgICAqIC0ge0BsaW5rIFNPUlRNT0RFX01BTlVBTH1cbiAgICAgICAgICogLSB7QGxpbmsgU09SVE1PREVfTUFURVJJQUxNRVNIfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9CQUNLMkZST05UfVxuICAgICAgICAgKiAtIHtAbGluayBTT1JUTU9ERV9GUk9OVDJCQUNLfVxuICAgICAgICAgKlxuICAgICAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgU09SVE1PREVfQkFDSzJGUk9OVH0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRyYW5zcGFyZW50U29ydE1vZGUgPSBvcHRpb25zLnRyYW5zcGFyZW50U29ydE1vZGUgPT09IHVuZGVmaW5lZCA/IFNPUlRNT0RFX0JBQ0syRlJPTlQgOiBvcHRpb25zLnRyYW5zcGFyZW50U29ydE1vZGU7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IG9wdGlvbnMucmVuZGVyVGFyZ2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEEgdHlwZSBvZiBzaGFkZXIgdG8gdXNlIGR1cmluZyByZW5kZXJpbmcuIFBvc3NpYmxlIHZhbHVlcyBhcmU6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIFNIQURFUl9GT1JXQVJEfVxuICAgICAgICAgKiAtIHtAbGluayBTSEFERVJfRk9SV0FSREhEUn1cbiAgICAgICAgICogLSB7QGxpbmsgU0hBREVSX0RFUFRIfVxuICAgICAgICAgKiAtIFlvdXIgb3duIGN1c3RvbSB2YWx1ZS4gU2hvdWxkIGJlIGluIDE5IC0gMzEgcmFuZ2UuIFVzZSB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNvblVwZGF0ZVNoYWRlcn1cbiAgICAgICAgICogdG8gYXBwbHkgc2hhZGVyIG1vZGlmaWNhdGlvbnMgYmFzZWQgb24gdGhpcyB2YWx1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFNIQURFUl9GT1JXQVJEfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2hhZGVyUGFzcyA9IG9wdGlvbnMuc2hhZGVyUGFzcyA9PT0gdW5kZWZpbmVkID8gU0hBREVSX0ZPUldBUkQgOiBvcHRpb25zLnNoYWRlclBhc3M7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRlbGxzIHRoYXQgdGhpcyBsYXllciBpcyBzaW1wbGUgYW5kIG5lZWRzIHRvIGp1c3QgcmVuZGVyIGEgYnVuY2ggb2YgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICogd2l0aG91dCBsaWdodGluZywgc2tpbm5pbmcgYW5kIG1vcnBoaW5nIChmYXN0ZXIpLiBVc2VkIGZvciBVSSBhbmQgR2l6bW8gbGF5ZXJzICh0aGVcbiAgICAgICAgICogbGF5ZXIgZG9lc24ndCB1c2UgbGlnaHRzLCBzaGFkb3dzLCBjdWxsaW5nLCBldGMpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucGFzc1Rocm91Z2ggPSBvcHRpb25zLnBhc3NUaHJvdWdoID09PSB1bmRlZmluZWQgPyBmYWxzZSA6IG9wdGlvbnMucGFzc1Rocm91Z2g7XG5cbiAgICAgICAgLy8gY2xlYXIgZmxhZ3NcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY2xlYXJDb2xvckJ1ZmZlciA9ICEhb3B0aW9ucy5jbGVhckNvbG9yQnVmZmVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsZWFyRGVwdGhCdWZmZXIgPSAhIW9wdGlvbnMuY2xlYXJEZXB0aEJ1ZmZlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jbGVhclN0ZW5jaWxCdWZmZXIgPSAhIW9wdGlvbnMuY2xlYXJTdGVuY2lsQnVmZmVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIHZpc2liaWxpdHkgY3VsbGluZyBpcyBwZXJmb3JtZWQgZm9yIHRoaXMgbGF5ZXIuXG4gICAgICAgICAqIFVzZWZ1bCwgZm9yIGV4YW1wbGUsIGlmIHlvdSB3YW50IHRvIG1vZGlmeSBjYW1lcmEgcHJvamVjdGlvbiB3aGlsZSBzdGlsbCB1c2luZyB0aGUgc2FtZVxuICAgICAgICAgKiBjYW1lcmEgYW5kIG1ha2UgZnJ1c3R1bSBjdWxsaW5nIHdvcmsgY29ycmVjdGx5IHdpdGggaXQgKHNlZVxuICAgICAgICAgKiB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2NhbGN1bGF0ZVRyYW5zZm9ybX0gYW5kIHtAbGluayBDYW1lcmFDb21wb25lbnQjY2FsY3VsYXRlUHJvamVjdGlvbn0pLlxuICAgICAgICAgKiBUaGlzIGZ1bmN0aW9uIHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWxcbiAgICAgICAgICogY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfSB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25QcmVDdWxsID0gb3B0aW9ucy5vblByZUN1bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYmVmb3JlIHRoaXMgbGF5ZXIgaXMgcmVuZGVyZWQuIFVzZWZ1bCwgZm9yIGV4YW1wbGUsIGZvclxuICAgICAgICAgKiByZWFjdGluZyBvbiBzY3JlZW4gc2l6ZSBjaGFuZ2VzLiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBiZWZvcmUgdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2ZcbiAgICAgICAgICogdGhpcyBsYXllciBpbiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0uIEl0IHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHlcbiAgICAgICAgICogYXJndW1lbnQuIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cFxuICAgICAgICAgKiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfSB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25QcmVSZW5kZXIgPSBvcHRpb25zLm9uUHJlUmVuZGVyO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGJlZm9yZSBvcGFxdWUgbWVzaCBpbnN0YW5jZXMgKG5vdCBzZW1pLXRyYW5zcGFyZW50KSBpblxuICAgICAgICAgKiB0aGlzIGxheWVyIGFyZSByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LlxuICAgICAgICAgKiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc31cbiAgICAgICAgICogd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUHJlUmVuZGVyT3BhcXVlID0gb3B0aW9ucy5vblByZVJlbmRlck9wYXF1ZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBiZWZvcmUgc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcyBpbiB0aGlzIGxheWVyIGFyZVxuICAgICAgICAgKiByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LiBZb3UgY2FuIGdldCB0aGVcbiAgICAgICAgICogYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc30gd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQgPSBvcHRpb25zLm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB2aXNpYmlsaXR5IGN1bGxpbmcgaXMgcGVyZm9ybWVkIGZvciB0aGlzIGxheWVyLlxuICAgICAgICAgKiBVc2VmdWwgZm9yIHJldmVydGluZyBjaGFuZ2VzIGRvbmUgaW4ge0BsaW5rIExheWVyI29uUHJlQ3VsbH0gYW5kIGRldGVybWluaW5nIGZpbmFsIG1lc2hcbiAgICAgICAgICogaW5zdGFuY2UgdmlzaWJpbGl0eSAoc2VlIHtAbGluayBNZXNoSW5zdGFuY2UjdmlzaWJsZVRoaXNGcmFtZX0pLiBUaGlzIGZ1bmN0aW9uIHdpbGxcbiAgICAgICAgICogcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnlcbiAgICAgICAgICogbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfSB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25Qb3N0Q3VsbCA9IG9wdGlvbnMub25Qb3N0Q3VsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGlzIGxheWVyIGlzIHJlbmRlcmVkLiBVc2VmdWwgdG8gcmV2ZXJ0IGNoYW5nZXNcbiAgICAgICAgICogbWFkZSBpbiB7QGxpbmsgTGF5ZXIjb25QcmVSZW5kZXJ9LiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBhZnRlciB0aGUgbGFzdCBvY2N1cnJlbmNlIG9mIHRoaXNcbiAgICAgICAgICogbGF5ZXIgaW4ge0BsaW5rIExheWVyQ29tcG9zaXRpb259LiBJdCB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LlxuICAgICAgICAgKiBZb3UgY2FuIGdldCB0aGUgYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc31cbiAgICAgICAgICogd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUG9zdFJlbmRlciA9IG9wdGlvbnMub25Qb3N0UmVuZGVyO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIG9wYXF1ZSBtZXNoIGluc3RhbmNlcyAobm90IHNlbWktdHJhbnNwYXJlbnQpIGluXG4gICAgICAgICAqIHRoaXMgbGF5ZXIgYXJlIHJlbmRlcmVkLiBUaGlzIGZ1bmN0aW9uIHdpbGwgcmVjZWl2ZSBjYW1lcmEgaW5kZXggYXMgdGhlIG9ubHkgYXJndW1lbnQuXG4gICAgICAgICAqIFlvdSBjYW4gZ2V0IHRoZSBhY3R1YWwgY2FtZXJhIGJlaW5nIHVzZWQgYnkgbG9va2luZyB1cCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbiNjYW1lcmFzfVxuICAgICAgICAgKiB3aXRoIHRoaXMgaW5kZXguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25Qb3N0UmVuZGVyT3BhcXVlID0gb3B0aW9ucy5vblBvc3RSZW5kZXJPcGFxdWU7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDdXN0b20gZnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgYWZ0ZXIgc2VtaS10cmFuc3BhcmVudCBtZXNoIGluc3RhbmNlcyBpbiB0aGlzIGxheWVyIGFyZVxuICAgICAgICAgKiByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiB3aWxsIHJlY2VpdmUgY2FtZXJhIGluZGV4IGFzIHRoZSBvbmx5IGFyZ3VtZW50LiBZb3UgY2FuIGdldCB0aGVcbiAgICAgICAgICogYWN0dWFsIGNhbWVyYSBiZWluZyB1c2VkIGJ5IGxvb2tpbmcgdXAge0BsaW5rIExheWVyQ29tcG9zaXRpb24jY2FtZXJhc30gd2l0aCB0aGlzIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm9uUG9zdFJlbmRlclRyYW5zcGFyZW50ID0gb3B0aW9ucy5vblBvc3RSZW5kZXJUcmFuc3BhcmVudDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGJlZm9yZSBldmVyeSBtZXNoIGluc3RhbmNlIGluIHRoaXMgbGF5ZXIgaXMgcmVuZGVyZWQuIEl0XG4gICAgICAgICAqIGlzIG5vdCByZWNvbW1lbmRlZCB0byBzZXQgdGhpcyBmdW5jdGlvbiB3aGVuIHJlbmRlcmluZyBtYW55IG9iamVjdHMgZXZlcnkgZnJhbWUgZHVlIHRvXG4gICAgICAgICAqIHBlcmZvcm1hbmNlIHJlYXNvbnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25EcmF3Q2FsbCA9IG9wdGlvbnMub25EcmF3Q2FsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBhZnRlciB0aGUgbGF5ZXIgaGFzIGJlZW4gZW5hYmxlZC4gVGhpcyBoYXBwZW5zIHdoZW46XG4gICAgICAgICAqXG4gICAgICAgICAqIC0gVGhlIGxheWVyIGlzIGNyZWF0ZWQgd2l0aCB7QGxpbmsgTGF5ZXIjZW5hYmxlZH0gc2V0IHRvIHRydWUgKHdoaWNoIGlzIHRoZSBkZWZhdWx0IHZhbHVlKS5cbiAgICAgICAgICogLSB7QGxpbmsgTGF5ZXIjZW5hYmxlZH0gd2FzIGNoYW5nZWQgZnJvbSBmYWxzZSB0byB0cnVlXG4gICAgICAgICAqIC0ge0BsaW5rIExheWVyI2luY3JlbWVudENvdW50ZXJ9IHdhcyBjYWxsZWQgYW5kIGluY3JlbWVudGVkIHRoZSBjb3VudGVyIGFib3ZlIHplcm8uXG4gICAgICAgICAqXG4gICAgICAgICAqIFVzZWZ1bCBmb3IgYWxsb2NhdGluZyByZXNvdXJjZXMgdGhpcyBsYXllciB3aWxsIHVzZSAoZS5nLiBjcmVhdGluZyByZW5kZXIgdGFyZ2V0cykuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub25FbmFibGUgPSBvcHRpb25zLm9uRW5hYmxlO1xuICAgICAgICAvKipcbiAgICAgICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoZSBsYXllciBoYXMgYmVlbiBkaXNhYmxlZC4gVGhpcyBoYXBwZW5zIHdoZW46XG4gICAgICAgICAqXG4gICAgICAgICAqIC0ge0BsaW5rIExheWVyI2VuYWJsZWR9IHdhcyBjaGFuZ2VkIGZyb20gdHJ1ZSB0byBmYWxzZVxuICAgICAgICAgKiAtIHtAbGluayBMYXllciNkZWNyZW1lbnRDb3VudGVyfSB3YXMgY2FsbGVkIGFuZCBzZXQgdGhlIGNvdW50ZXIgdG8gemVyby5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vbkRpc2FibGUgPSBvcHRpb25zLm9uRGlzYWJsZTtcblxuICAgICAgICBpZiAodGhpcy5fZW5hYmxlZCAmJiB0aGlzLm9uRW5hYmxlKSB7XG4gICAgICAgICAgICB0aGlzLm9uRW5hYmxlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogTWFrZSB0aGlzIGxheWVyIHJlbmRlciB0aGUgc2FtZSBtZXNoIGluc3RhbmNlcyB0aGF0IGFub3RoZXIgbGF5ZXIgZG9lcyBpbnN0ZWFkIG9mIGhhdmluZ1xuICAgICAgICAgKiBpdHMgb3duIG1lc2ggaW5zdGFuY2UgbGlzdC4gQm90aCBsYXllcnMgbXVzdCBzaGFyZSBjYW1lcmFzLiBGcnVzdHVtIGN1bGxpbmcgaXMgb25seVxuICAgICAgICAgKiBwZXJmb3JtZWQgZm9yIG9uZSBsYXllci4gVXNlZnVsIGZvciByZW5kZXJpbmcgbXVsdGlwbGUgcGFzc2VzIHVzaW5nIGRpZmZlcmVudCBzaGFkZXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7TGF5ZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxheWVyUmVmZXJlbmNlID0gb3B0aW9ucy5sYXllclJlZmVyZW5jZTsgLy8gc2hvdWxkIHVzZSB0aGUgc2FtZSBjYW1lcmFcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0luc3RhbmNlTGlzdH1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbnN0YW5jZXMgPSBvcHRpb25zLmxheWVyUmVmZXJlbmNlID8gb3B0aW9ucy5sYXllclJlZmVyZW5jZS5pbnN0YW5jZXMgOiBuZXcgSW5zdGFuY2VMaXN0KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFZpc2liaWxpdHkgYml0IG1hc2sgdGhhdCBpbnRlcmFjdHMgd2l0aCB7QGxpbmsgTWVzaEluc3RhbmNlI21hc2t9LiBFc3BlY2lhbGx5IHVzZWZ1bFxuICAgICAgICAgKiB3aGVuIGNvbWJpbmVkIHdpdGggbGF5ZXJSZWZlcmVuY2UsIGFsbG93aW5nIGZvciB0aGUgZmlsdGVyaW5nIG9mIHNvbWUgb2JqZWN0cywgd2hpbGVcbiAgICAgICAgICogc2hhcmluZyB0aGVpciBsaXN0IGFuZCBjdWxsaW5nLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdWxsaW5nTWFzayA9IG9wdGlvbnMuY3VsbGluZ01hc2sgPyBvcHRpb25zLmN1bGxpbmdNYXNrIDogMHhGRkZGRkZGRjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcyA9IHRoaXMuaW5zdGFuY2VzLm9wYXF1ZU1lc2hJbnN0YW5jZXM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMgPSB0aGlzLmluc3RhbmNlcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zaGFkb3dDYXN0ZXJzID0gdGhpcy5pbnN0YW5jZXMuc2hhZG93Q2FzdGVycztcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0Z1bmN0aW9ufG51bGx9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY3VzdG9tU29ydENhbGxiYWNrID0gbnVsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtGdW5jdGlvbnxudWxsfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN1c3RvbUNhbGN1bGF0ZVNvcnRWYWx1ZXMgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2xpZ2h0LmpzJykuTGlnaHRbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpZ2h0cyA9IFtdO1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1NldDxpbXBvcnQoJy4vbGlnaHQuanMnKS5MaWdodD59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9saWdodHNTZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCBvZiBsaWdodCB1c2VkIGJ5IGNsdXN0ZXJlZCBsaWdodGluZyAob21uaSBhbmQgc3BvdCwgYnV0IG5vIGRpcmVjdGlvbmFsKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1NldDxpbXBvcnQoJy4vbGlnaHQuanMnKS5MaWdodD59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIExpZ2h0cyBzZXBhcmF0ZWQgYnkgbGlnaHQgdHlwZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9saWdodC5qcycpLkxpZ2h0W11bXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc3BsaXRMaWdodHMgPSBbW10sIFtdLCBbXV07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnRbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jYW1lcmFzID0gW107XG5cbiAgICAgICAgdGhpcy5fZGlydHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZGlydHlDYW1lcmFzID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbGlnaHRIYXNoID0gMDtcbiAgICAgICAgdGhpcy5fc3RhdGljTGlnaHRIYXNoID0gMDtcbiAgICAgICAgdGhpcy5fbmVlZHNTdGF0aWNQcmVwYXJlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fc3RhdGljUHJlcGFyZURvbmUgPSBmYWxzZTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc2tpcFJlbmRlckFmdGVyID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICAgICAgdGhpcy5fc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuXG4gICAgICAgIHRoaXMuX3JlbmRlclRpbWUgPSAwO1xuICAgICAgICB0aGlzLl9mb3J3YXJkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5fc2hhZG93RHJhd0NhbGxzID0gMDsgIC8vIGRlcHJlY2F0ZWQsIG5vdCB1c2VmdWwgb24gYSBsYXllciBhbnltb3JlLCBjb3VsZCBiZSBtb3ZlZCB0byBjYW1lcmFcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgdGhpcy5fc2hhZGVyVmVyc2lvbiA9IC0xO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7RmxvYXQzMkFycmF5fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9saWdodEN1YmUgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGxheWVyIGNvbnRhaW5zIG9tbmkgb3Igc3BvdCBsaWdodHNcbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgaGFzQ2x1c3RlcmVkTGlnaHRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2x1c3RlcmVkTGlnaHRzU2V0LnNpemUgPiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZSB0aGUgbGF5ZXIuIERpc2FibGVkIGxheWVycyBhcmUgc2tpcHBlZC4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBlbmFibGVkKHZhbCkge1xuICAgICAgICBpZiAodmFsICE9PSB0aGlzLl9lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsO1xuICAgICAgICAgICAgaWYgKHZhbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5jcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9uRW5hYmxlKSB0aGlzLm9uRW5hYmxlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVjcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9uRGlzYWJsZSkgdGhpcy5vbkRpc2FibGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBlbmFibGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIGNvbG9yIGJ1ZmZlciB3aGVuIGl0IHJlbmRlcnMgdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbGVhckNvbG9yQnVmZmVyKHZhbCkge1xuICAgICAgICB0aGlzLl9jbGVhckNvbG9yQnVmZmVyID0gdmFsO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhckNvbG9yQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJDb2xvckJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlciB3aGVuIGl0IHJlbmRlcnMgdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbGVhckRlcHRoQnVmZmVyKHZhbCkge1xuICAgICAgICB0aGlzLl9jbGVhckRlcHRoQnVmZmVyID0gdmFsO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhckRlcHRoQnVmZmVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xlYXJEZXB0aEJ1ZmZlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgY2FtZXJhIHdpbGwgY2xlYXIgdGhlIHN0ZW5jaWwgYnVmZmVyIHdoZW4gaXQgcmVuZGVycyB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsZWFyU3RlbmNpbEJ1ZmZlcih2YWwpIHtcbiAgICAgICAgdGhpcy5fY2xlYXJTdGVuY2lsQnVmZmVyID0gdmFsO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH1cblxuICAgIGdldCBjbGVhclN0ZW5jaWxCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGVhclN0ZW5jaWxCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBsaWdodHMgdXNlZCBieSBjbHVzdGVyZWQgbGlnaHRpbmcgaW4gYSBzZXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U2V0PGltcG9ydCgnLi9saWdodC5qcycpLkxpZ2h0Pn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IGNsdXN0ZXJlZExpZ2h0c1NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbmNyZW1lbnRzIHRoZSB1c2FnZSBjb3VudGVyIG9mIHRoaXMgbGF5ZXIuIEJ5IGRlZmF1bHQsIGxheWVycyBhcmUgY3JlYXRlZCB3aXRoIGNvdW50ZXIgc2V0XG4gICAgICogdG8gMSAoaWYge0BsaW5rIExheWVyLmVuYWJsZWR9IGlzIHRydWUpIG9yIDAgKGlmIGl0IHdhcyBmYWxzZSkuIEluY3JlbWVudGluZyB0aGUgY291bnRlclxuICAgICAqIGZyb20gMCB0byAxIHdpbGwgZW5hYmxlIHRoZSBsYXllciBhbmQgY2FsbCB7QGxpbmsgTGF5ZXIub25FbmFibGV9LiBVc2UgdGhpcyBmdW5jdGlvbiB0b1xuICAgICAqIFwic3Vic2NyaWJlXCIgbXVsdGlwbGUgZWZmZWN0cyB0byB0aGUgc2FtZSBsYXllci4gRm9yIGV4YW1wbGUsIGlmIHRoZSBsYXllciBpcyB1c2VkIHRvIHJlbmRlclxuICAgICAqIGEgcmVmbGVjdGlvbiB0ZXh0dXJlIHdoaWNoIGlzIHVzZWQgYnkgMiBtaXJyb3JzLCB0aGVuIGVhY2ggbWlycm9yIGNhbiBjYWxsIHRoaXMgZnVuY3Rpb25cbiAgICAgKiB3aGVuIHZpc2libGUgYW5kIHtAbGluayBMYXllci5kZWNyZW1lbnRDb3VudGVyfSBpZiBpbnZpc2libGUuIEluIHN1Y2ggY2FzZSB0aGUgcmVmbGVjdGlvblxuICAgICAqIHRleHR1cmUgd29uJ3QgYmUgdXBkYXRlZCwgd2hlbiB0aGVyZSBpcyBub3RoaW5nIHRvIHVzZSBpdCwgc2F2aW5nIHBlcmZvcm1hbmNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGluY3JlbWVudENvdW50ZXIoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWZDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0aGlzLm9uRW5hYmxlKSB0aGlzLm9uRW5hYmxlKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVmQ291bnRlcisrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlY3JlbWVudHMgdGhlIHVzYWdlIGNvdW50ZXIgb2YgdGhpcyBsYXllci4gRGVjcmVtZW50aW5nIHRoZSBjb3VudGVyIGZyb20gMSB0byAwIHdpbGxcbiAgICAgKiBkaXNhYmxlIHRoZSBsYXllciBhbmQgY2FsbCB7QGxpbmsgTGF5ZXIub25EaXNhYmxlfS4gU2VlIHtAbGluayBMYXllciNpbmNyZW1lbnRDb3VudGVyfSBmb3JcbiAgICAgKiBtb3JlIGRldGFpbHMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZGVjcmVtZW50Q291bnRlcigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlZkNvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0aGlzLm9uRGlzYWJsZSkgdGhpcy5vbkRpc2FibGUoKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3JlZkNvdW50ZXIgPT09IDApIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ1RyeWluZyB0byBkZWNyZW1lbnQgbGF5ZXIgY291bnRlciBiZWxvdyAwJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcmVmQ291bnRlci0tO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMgdG8gdGhpcyBsYXllci5cbiAgICAgKjFcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gbWVzaEluc3RhbmNlcyAtIEFycmF5IG9mXG4gICAgICoge0BsaW5rIE1lc2hJbnN0YW5jZX0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbc2tpcFNoYWRvd0Nhc3RlcnNdIC0gU2V0IGl0IHRvIHRydWUgaWYgeW91IGRvbid0IHdhbnQgdGhlc2UgbWVzaCBpbnN0YW5jZXNcbiAgICAgKiB0byBjYXN0IHNoYWRvd3MgaW4gdGhpcyBsYXllci5cbiAgICAgKi9cbiAgICBhZGRNZXNoSW5zdGFuY2VzKG1lc2hJbnN0YW5jZXMsIHNraXBTaGFkb3dDYXN0ZXJzKSB7XG4gICAgICAgIGNvbnN0IHNjZW5lU2hhZGVyVmVyID0gdGhpcy5fc2hhZGVyVmVyc2lvbjtcblxuICAgICAgICBjb25zdCBjYXN0ZXJzID0gdGhpcy5zaGFkb3dDYXN0ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG0gPSBtZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWF0ID0gbS5tYXRlcmlhbDtcbiAgICAgICAgICAgIGNvbnN0IGFyciA9IG1hdC5ibGVuZFR5cGUgPT09IEJMRU5EX05PTkUgPyB0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXMgOiB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgLy8gdGVzdCBmb3IgbWVzaEluc3RhbmNlIGluIGJvdGggYXJyYXlzLCBhcyBtYXRlcmlhbCdzIGFscGhhIGNvdWxkIGhhdmUgY2hhbmdlZCBzaW5jZSBMYXllckNvbXBvc2l0aW9uJ3MgdXBkYXRlIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICAgICAgICAgIC8vIFRPRE8gLSBmb2xsb3dpbmcgdXNlcyBvZiBpbmRleE9mIGFyZSBleHBlbnNpdmUsIHRvIGFkZCA1MDAwIG1lc2hJbnN0YW5jZXMgY29zdHMgYWJvdXQgNzBtcyBvbiBNYWMuIENvbnNpZGVyIHVzaW5nIFNldC5cbiAgICAgICAgICAgIGlmICh0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXMuaW5kZXhPZihtKSA8IDAgJiYgdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMuaW5kZXhPZihtKSA8IDApIHtcbiAgICAgICAgICAgICAgICBhcnIucHVzaChtKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFza2lwU2hhZG93Q2FzdGVycyAmJiBtLmNhc3RTaGFkb3cgJiYgY2FzdGVycy5pbmRleE9mKG0pIDwgMCkgY2FzdGVycy5wdXNoKG0pO1xuXG4gICAgICAgICAgICAvLyBjbGVhciBvbGQgc2hhZGVyIHZhcmlhbnRzIGlmIG5lY2Vzc2FyeVxuICAgICAgICAgICAgaWYgKCF0aGlzLnBhc3NUaHJvdWdoICYmIHNjZW5lU2hhZGVyVmVyID49IDAgJiYgbWF0Ll9zaGFkZXJWZXJzaW9uICE9PSBzY2VuZVNoYWRlclZlcikge1xuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCB0aGlzIGZvciBtYXRlcmlhbHMgbm90IHVzaW5nIHZhcmlhbnRzXG4gICAgICAgICAgICAgICAgaWYgKG1hdC5nZXRTaGFkZXJWYXJpYW50ICE9PSBNYXRlcmlhbC5wcm90b3R5cGUuZ2V0U2hhZGVyVmFyaWFudCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciBzaGFkZXIgdmFyaWFudHMgb24gdGhlIG1hdGVyaWFsIGFuZCBhbHNvIG9uIG1lc2ggaW5zdGFuY2VzIHRoYXQgdXNlIGl0XG4gICAgICAgICAgICAgICAgICAgIG1hdC5jbGVhclZhcmlhbnRzKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1hdC5fc2hhZGVyVmVyc2lvbiA9IHNjZW5lU2hhZGVyVmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5wYXNzVGhyb3VnaCkgdGhpcy5fZGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIGZ1bmN0aW9uIHRvIHJlbW92ZSBhIG1lc2ggaW5zdGFuY2UgZnJvbSBhbiBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IG0gLSBNZXNoIGluc3RhbmNlIHRvIHJlbW92ZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119IGFyciAtIEFycmF5IG9mIG1lc2ggaW5zdGFuY2VzIHRvIHJlbW92ZVxuICAgICAqIGZyb20uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICByZW1vdmVNZXNoSW5zdGFuY2VGcm9tQXJyYXkobSwgYXJyKSB7XG4gICAgICAgIGxldCBzcGxpY2VPZmZzZXQgPSAtMTtcbiAgICAgICAgbGV0IHNwbGljZUNvdW50ID0gMDtcbiAgICAgICAgY29uc3QgbGVuID0gYXJyLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGorKykge1xuICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBhcnJbal07XG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwgPT09IG0pIHtcbiAgICAgICAgICAgICAgICBzcGxpY2VPZmZzZXQgPSBqO1xuICAgICAgICAgICAgICAgIHNwbGljZUNvdW50ID0gMTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5fc3RhdGljU291cmNlID09PSBtKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNwbGljZU9mZnNldCA8IDApIHNwbGljZU9mZnNldCA9IGo7XG4gICAgICAgICAgICAgICAgc3BsaWNlQ291bnQrKztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3BsaWNlT2Zmc2V0ID49IDApIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzcGxpY2VPZmZzZXQgPj0gMCkge1xuICAgICAgICAgICAgYXJyLnNwbGljZShzcGxpY2VPZmZzZXQsIHNwbGljZUNvdW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgbXVsdGlwbGUgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gQXJyYXkgb2ZcbiAgICAgKiB7QGxpbmsgTWVzaEluc3RhbmNlfS4gSWYgdGhleSB3ZXJlIGFkZGVkIHRvIHRoaXMgbGF5ZXIsIHRoZXkgd2lsbCBiZSByZW1vdmVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3NraXBTaGFkb3dDYXN0ZXJzXSAtIFNldCBpdCB0byB0cnVlIGlmIHlvdSB3YW50IHRvIHN0aWxsIGNhc3Qgc2hhZG93cyBmcm9tXG4gICAgICogcmVtb3ZlZCBtZXNoIGluc3RhbmNlcyBvciBpZiB0aGV5IG5ldmVyIGRpZCBjYXN0IHNoYWRvd3MgYmVmb3JlLlxuICAgICAqL1xuICAgIHJlbW92ZU1lc2hJbnN0YW5jZXMobWVzaEluc3RhbmNlcywgc2tpcFNoYWRvd0Nhc3RlcnMpIHtcblxuICAgICAgICBjb25zdCBvcGFxdWUgPSB0aGlzLm9wYXF1ZU1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IHRyYW5zcGFyZW50ID0gdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGNvbnN0IGNhc3RlcnMgPSB0aGlzLnNoYWRvd0Nhc3RlcnM7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtID0gbWVzaEluc3RhbmNlc1tpXTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gb3BhcXVlXG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1lc2hJbnN0YW5jZUZyb21BcnJheShtLCBvcGFxdWUpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgZnJvbSB0cmFuc3BhcmVudFxuICAgICAgICAgICAgdGhpcy5yZW1vdmVNZXNoSW5zdGFuY2VGcm9tQXJyYXkobSwgdHJhbnNwYXJlbnQpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgZnJvbSBjYXN0ZXJzXG4gICAgICAgICAgICBpZiAoIXNraXBTaGFkb3dDYXN0ZXJzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaiA9IGNhc3RlcnMuaW5kZXhPZihtKTtcbiAgICAgICAgICAgICAgICBpZiAoaiA+PSAwKVxuICAgICAgICAgICAgICAgICAgICBjYXN0ZXJzLnNwbGljZShqLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2RpcnR5ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBtZXNoIGluc3RhbmNlcyBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtza2lwU2hhZG93Q2FzdGVyc10gLSBTZXQgaXQgdG8gdHJ1ZSBpZiB5b3Ugd2FudCB0byBzdGlsbCBjYXN0IHNoYWRvd3MgZnJvbVxuICAgICAqIHJlbW92ZWQgbWVzaCBpbnN0YW5jZXMgb3IgaWYgdGhleSBuZXZlciBkaWQgY2FzdCBzaGFkb3dzIGJlZm9yZS5cbiAgICAgKi9cbiAgICBjbGVhck1lc2hJbnN0YW5jZXMoc2tpcFNoYWRvd0Nhc3RlcnMpIHtcbiAgICAgICAgaWYgKHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcy5sZW5ndGggPT09IDAgJiYgdGhpcy50cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBpZiAoc2tpcFNoYWRvd0Nhc3RlcnMgfHwgdGhpcy5zaGFkb3dDYXN0ZXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub3BhcXVlTWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICBpZiAoIXNraXBTaGFkb3dDYXN0ZXJzKSB0aGlzLnNoYWRvd0Nhc3RlcnMubGVuZ3RoID0gMDtcbiAgICAgICAgaWYgKCF0aGlzLnBhc3NUaHJvdWdoKSB0aGlzLl9kaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGxpZ2h0IHRvIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzJykuTGlnaHRDb21wb25lbnR9IGxpZ2h0IC0gQVxuICAgICAqIHtAbGluayBMaWdodENvbXBvbmVudH0uXG4gICAgICovXG4gICAgYWRkTGlnaHQobGlnaHQpIHtcblxuICAgICAgICAvLyBpZiB0aGUgbGlnaHQgaXMgbm90IGluIHRoZSBsYXllciBhbHJlYWR5XG4gICAgICAgIGNvbnN0IGwgPSBsaWdodC5saWdodDtcbiAgICAgICAgaWYgKCF0aGlzLl9saWdodHNTZXQuaGFzKGwpKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodHNTZXQuYWRkKGwpO1xuXG4gICAgICAgICAgICB0aGlzLl9saWdodHMucHVzaChsKTtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuX2dlbmVyYXRlTGlnaHRIYXNoKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobC50eXBlICE9PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldC5hZGQobCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgbGlnaHQgZnJvbSB0aGlzIGxheWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2xpZ2h0L2NvbXBvbmVudC5qcycpLkxpZ2h0Q29tcG9uZW50fSBsaWdodCAtIEFcbiAgICAgKiB7QGxpbmsgTGlnaHRDb21wb25lbnR9LlxuICAgICAqL1xuICAgIHJlbW92ZUxpZ2h0KGxpZ2h0KSB7XG5cbiAgICAgICAgY29uc3QgbCA9IGxpZ2h0LmxpZ2h0O1xuICAgICAgICBpZiAodGhpcy5fbGlnaHRzU2V0LmhhcyhsKSkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzU2V0LmRlbGV0ZShsKTtcblxuICAgICAgICAgICAgdGhpcy5fbGlnaHRzLnNwbGljZSh0aGlzLl9saWdodHMuaW5kZXhPZihsKSwgMSk7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9nZW5lcmF0ZUxpZ2h0SGFzaCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGwudHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICB0aGlzLl9jbHVzdGVyZWRMaWdodHNTZXQuZGVsZXRlKGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhbGwgbGlnaHRzIGZyb20gdGhpcyBsYXllci5cbiAgICAgKi9cbiAgICBjbGVhckxpZ2h0cygpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRzU2V0LmNsZWFyKCk7XG4gICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0c1NldC5jbGVhcigpO1xuICAgICAgICB0aGlzLl9saWdodHMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMgdG8gdGhpcyBsYXllciwgYnV0IG9ubHkgYXMgc2hhZG93IGNhc3RlcnMgKHRoZXkgd2lsbCBub3QgYmVcbiAgICAgKiByZW5kZXJlZCBhbnl3aGVyZSwgYnV0IG9ubHkgY2FzdCBzaGFkb3dzIG9uIG90aGVyIG9iamVjdHMpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gQXJyYXkgb2ZcbiAgICAgKiB7QGxpbmsgTWVzaEluc3RhbmNlfS5cbiAgICAgKi9cbiAgICBhZGRTaGFkb3dDYXN0ZXJzKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgY29uc3QgYXJyID0gdGhpcy5zaGFkb3dDYXN0ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG0gPSBtZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgaWYgKCFtLmNhc3RTaGFkb3cpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGFyci5pbmRleE9mKG0pIDwgMCkgYXJyLnB1c2gobSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgbXVsdGlwbGUgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGUgc2hhZG93IGNhc3RlcnMgbGlzdCBvZiB0aGlzIGxheWVyLCBtZWFuaW5nIHRoZXlcbiAgICAgKiB3aWxsIHN0b3AgY2FzdGluZyBzaGFkb3dzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gQXJyYXkgb2ZcbiAgICAgKiB7QGxpbmsgTWVzaEluc3RhbmNlfS4gSWYgdGhleSB3ZXJlIGFkZGVkIHRvIHRoaXMgbGF5ZXIsIHRoZXkgd2lsbCBiZSByZW1vdmVkLlxuICAgICAqL1xuICAgIHJlbW92ZVNoYWRvd0Nhc3RlcnMobWVzaEluc3RhbmNlcykge1xuICAgICAgICBjb25zdCBhcnIgPSB0aGlzLnNoYWRvd0Nhc3RlcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgaWQgPSBhcnIuaW5kZXhPZihtZXNoSW5zdGFuY2VzW2ldKTtcbiAgICAgICAgICAgIGlmIChpZCA+PSAwKSBhcnIuc3BsaWNlKGlkLCAxKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2dlbmVyYXRlTGlnaHRIYXNoKCkge1xuICAgICAgICAvLyBnZW5lcmF0ZSBoYXNoIHRvIGNoZWNrIGlmIGxheWVycyBoYXZlIHRoZSBzYW1lIHNldCBvZiBzdGF0aWMgbGlnaHRzXG4gICAgICAgIC8vIG9yZGVyIG9mIGxpZ2h0cyBzaG91bGRuJ3QgbWF0dGVyXG4gICAgICAgIGlmICh0aGlzLl9saWdodHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRzLnNvcnQoc29ydExpZ2h0cyk7XG4gICAgICAgICAgICBsZXQgc3RyID0gJyc7XG4gICAgICAgICAgICBsZXQgc3RyU3RhdGljID0gJyc7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2xpZ2h0c1tpXS5pc1N0YXRpYykge1xuICAgICAgICAgICAgICAgICAgICBzdHJTdGF0aWMgKz0gdGhpcy5fbGlnaHRzW2ldLmtleTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdHIgKz0gdGhpcy5fbGlnaHRzW2ldLmtleTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzdHIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGlnaHRIYXNoID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGlnaHRIYXNoID0gaGFzaENvZGUoc3RyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHN0clN0YXRpYy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGF0aWNMaWdodEhhc2ggPSAwO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdGF0aWNMaWdodEhhc2ggPSBoYXNoQ29kZShzdHJTdGF0aWMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodEhhc2ggPSAwO1xuICAgICAgICAgICAgdGhpcy5fc3RhdGljTGlnaHRIYXNoID0gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBjYW1lcmEgdG8gdGhpcyBsYXllci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBBXG4gICAgICoge0BsaW5rIENhbWVyYUNvbXBvbmVudH0uXG4gICAgICovXG4gICAgYWRkQ2FtZXJhKGNhbWVyYSkge1xuICAgICAgICBpZiAodGhpcy5jYW1lcmFzLmluZGV4T2YoY2FtZXJhKSA+PSAwKSByZXR1cm47XG4gICAgICAgIHRoaXMuY2FtZXJhcy5wdXNoKGNhbWVyYSk7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGNhbWVyYSBmcm9tIHRoaXMgbGF5ZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gQVxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnR9LlxuICAgICAqL1xuICAgIHJlbW92ZUNhbWVyYShjYW1lcmEpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmNhbWVyYXMuaW5kZXhPZihjYW1lcmEpO1xuICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5jYW1lcmFzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyBkZWxldGUgdGhlIHZpc2libGUgbGlzdCBmb3IgdGhpcyBjYW1lcmFcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2VzLmRlbGV0ZShpbmRleCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGFsbCBjYW1lcmFzIGZyb20gdGhpcyBsYXllci5cbiAgICAgKi9cbiAgICBjbGVhckNhbWVyYXMoKSB7XG4gICAgICAgIHRoaXMuY2FtZXJhcy5sZW5ndGggPSAwO1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2VbXX0gZHJhd0NhbGxzIC0gQXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRyYXdDYWxsc0NvdW50IC0gTnVtYmVyIG9mIG1lc2ggaW5zdGFuY2VzLlxuICAgICAqIEBwYXJhbSB7VmVjM30gY2FtUG9zIC0gQ2FtZXJhIHBvc2l0aW9uLlxuICAgICAqIEBwYXJhbSB7VmVjM30gY2FtRndkIC0gQ2FtZXJhIGZvcndhcmQgdmVjdG9yLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NhbGN1bGF0ZVNvcnREaXN0YW5jZXMoZHJhd0NhbGxzLCBkcmF3Q2FsbHNDb3VudCwgY2FtUG9zLCBjYW1Gd2QpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHNDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGRyYXdDYWxsc1tpXTtcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5jb21tYW5kKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5sYXllciA8PSBMQVlFUl9GWCkgY29udGludWU7IC8vIE9ubHkgYWxwaGEgc29ydCBtZXNoIGluc3RhbmNlcyBpbiB0aGUgbWFpbiB3b3JsZCAoYmFja3dhcmRzIGNvbXApXG4gICAgICAgICAgICBpZiAoZHJhd0NhbGwuY2FsY3VsYXRlU29ydERpc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgZHJhd0NhbGwuemRpc3QgPSBkcmF3Q2FsbC5jYWxjdWxhdGVTb3J0RGlzdGFuY2UoZHJhd0NhbGwsIGNhbVBvcywgY2FtRndkKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG1lc2hQb3MgPSBkcmF3Q2FsbC5hYWJiLmNlbnRlcjtcbiAgICAgICAgICAgIGNvbnN0IHRlbXB4ID0gbWVzaFBvcy54IC0gY2FtUG9zLng7XG4gICAgICAgICAgICBjb25zdCB0ZW1weSA9IG1lc2hQb3MueSAtIGNhbVBvcy55O1xuICAgICAgICAgICAgY29uc3QgdGVtcHogPSBtZXNoUG9zLnogLSBjYW1Qb3MuejtcbiAgICAgICAgICAgIGRyYXdDYWxsLnpkaXN0ID0gdGVtcHggKiBjYW1Gd2QueCArIHRlbXB5ICogY2FtRndkLnkgKyB0ZW1weiAqIGNhbUZ3ZC56O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtib29sZWFufSB0cmFuc3BhcmVudCAtIFRydWUgaWYgdHJhbnNwYXJlbnQgc29ydGluZyBzaG91bGQgYmUgdXNlZC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ncmFwaC1ub2RlLmpzJykuR3JhcGhOb2RlfSBjYW1lcmFOb2RlIC0gR3JhcGggbm9kZSB0aGF0IHRoZSBjYW1lcmEgaXNcbiAgICAgKiBhdHRhY2hlZCB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY2FtZXJhUGFzcyAtIENhbWVyYSBwYXNzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfc29ydFZpc2libGUodHJhbnNwYXJlbnQsIGNhbWVyYU5vZGUsIGNhbWVyYVBhc3MpIHtcbiAgICAgICAgY29uc3Qgb2JqZWN0cyA9IHRoaXMuaW5zdGFuY2VzO1xuICAgICAgICBjb25zdCBzb3J0TW9kZSA9IHRyYW5zcGFyZW50ID8gdGhpcy50cmFuc3BhcmVudFNvcnRNb2RlIDogdGhpcy5vcGFxdWVTb3J0TW9kZTtcbiAgICAgICAgaWYgKHNvcnRNb2RlID09PSBTT1JUTU9ERV9OT05FKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgdmlzaWJsZSA9IHRyYW5zcGFyZW50ID8gb2JqZWN0cy52aXNpYmxlVHJhbnNwYXJlbnRbY2FtZXJhUGFzc10gOiBvYmplY3RzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG5cbiAgICAgICAgaWYgKHNvcnRNb2RlID09PSBTT1JUTU9ERV9DVVNUT00pIHtcbiAgICAgICAgICAgIHNvcnRQb3MgPSBjYW1lcmFOb2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICBzb3J0RGlyID0gY2FtZXJhTm9kZS5mb3J3YXJkO1xuICAgICAgICAgICAgaWYgKHRoaXMuY3VzdG9tQ2FsY3VsYXRlU29ydFZhbHVlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VzdG9tQ2FsY3VsYXRlU29ydFZhbHVlcyh2aXNpYmxlLmxpc3QsIHZpc2libGUubGVuZ3RoLCBzb3J0UG9zLCBzb3J0RGlyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZpc2libGUubGlzdC5sZW5ndGggIT09IHZpc2libGUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmlzaWJsZS5saXN0Lmxlbmd0aCA9IHZpc2libGUubGVuZ3RoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5jdXN0b21Tb3J0Q2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICB2aXNpYmxlLmxpc3Quc29ydCh0aGlzLmN1c3RvbVNvcnRDYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoc29ydE1vZGUgPT09IFNPUlRNT0RFX0JBQ0syRlJPTlQgfHwgc29ydE1vZGUgPT09IFNPUlRNT0RFX0ZST05UMkJBQ0spIHtcbiAgICAgICAgICAgICAgICBzb3J0UG9zID0gY2FtZXJhTm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgICAgIHNvcnREaXIgPSBjYW1lcmFOb2RlLmZvcndhcmQ7XG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlU29ydERpc3RhbmNlcyh2aXNpYmxlLmxpc3QsIHZpc2libGUubGVuZ3RoLCBzb3J0UG9zLCBzb3J0RGlyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZpc2libGUubGlzdC5sZW5ndGggIT09IHZpc2libGUubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdmlzaWJsZS5saXN0Lmxlbmd0aCA9IHZpc2libGUubGVuZ3RoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2aXNpYmxlLmxpc3Quc29ydChzb3J0Q2FsbGJhY2tzW3NvcnRNb2RlXSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IExheWVyIH07XG4iXSwibmFtZXMiOlsia2V5QSIsImtleUIiLCJzb3J0UG9zIiwic29ydERpciIsInNvcnRNYW51YWwiLCJkcmF3Q2FsbEEiLCJkcmF3Q2FsbEIiLCJkcmF3T3JkZXIiLCJzb3J0TWF0ZXJpYWxNZXNoIiwiX2tleSIsIlNPUlRLRVlfRk9SV0FSRCIsIm1lc2giLCJpZCIsInNvcnRCYWNrVG9Gcm9udCIsInpkaXN0Iiwic29ydEZyb250VG9CYWNrIiwic29ydENhbGxiYWNrcyIsInNvcnRMaWdodHMiLCJsaWdodEEiLCJsaWdodEIiLCJrZXkiLCJsYXllckNvdW50ZXIiLCJWaXNpYmxlSW5zdGFuY2VMaXN0IiwiY29uc3RydWN0b3IiLCJsaXN0IiwibGVuZ3RoIiwiZG9uZSIsIkluc3RhbmNlTGlzdCIsIm9wYXF1ZU1lc2hJbnN0YW5jZXMiLCJ0cmFuc3BhcmVudE1lc2hJbnN0YW5jZXMiLCJzaGFkb3dDYXN0ZXJzIiwidmlzaWJsZU9wYXF1ZSIsInZpc2libGVUcmFuc3BhcmVudCIsInByZXBhcmUiLCJpbmRleCIsImRlbGV0ZSIsInNwbGljZSIsIkxheWVyIiwib3B0aW9ucyIsInVuZGVmaW5lZCIsIk1hdGgiLCJtYXgiLCJuYW1lIiwiX2VuYWJsZWQiLCJlbmFibGVkIiwiX3JlZkNvdW50ZXIiLCJvcGFxdWVTb3J0TW9kZSIsIlNPUlRNT0RFX01BVEVSSUFMTUVTSCIsInRyYW5zcGFyZW50U29ydE1vZGUiLCJTT1JUTU9ERV9CQUNLMkZST05UIiwicmVuZGVyVGFyZ2V0Iiwic2hhZGVyUGFzcyIsIlNIQURFUl9GT1JXQVJEIiwicGFzc1Rocm91Z2giLCJfY2xlYXJDb2xvckJ1ZmZlciIsImNsZWFyQ29sb3JCdWZmZXIiLCJfY2xlYXJEZXB0aEJ1ZmZlciIsImNsZWFyRGVwdGhCdWZmZXIiLCJfY2xlYXJTdGVuY2lsQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwib25QcmVDdWxsIiwib25QcmVSZW5kZXIiLCJvblByZVJlbmRlck9wYXF1ZSIsIm9uUHJlUmVuZGVyVHJhbnNwYXJlbnQiLCJvblBvc3RDdWxsIiwib25Qb3N0UmVuZGVyIiwib25Qb3N0UmVuZGVyT3BhcXVlIiwib25Qb3N0UmVuZGVyVHJhbnNwYXJlbnQiLCJvbkRyYXdDYWxsIiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJsYXllclJlZmVyZW5jZSIsImluc3RhbmNlcyIsImN1bGxpbmdNYXNrIiwiY3VzdG9tU29ydENhbGxiYWNrIiwiY3VzdG9tQ2FsY3VsYXRlU29ydFZhbHVlcyIsIl9saWdodHMiLCJfbGlnaHRzU2V0IiwiU2V0IiwiX2NsdXN0ZXJlZExpZ2h0c1NldCIsIl9zcGxpdExpZ2h0cyIsImNhbWVyYXMiLCJfZGlydHkiLCJfZGlydHlMaWdodHMiLCJfZGlydHlDYW1lcmFzIiwiX2xpZ2h0SGFzaCIsIl9zdGF0aWNMaWdodEhhc2giLCJfbmVlZHNTdGF0aWNQcmVwYXJlIiwiX3N0YXRpY1ByZXBhcmVEb25lIiwic2tpcFJlbmRlckFmdGVyIiwiTnVtYmVyIiwiTUFYX1ZBTFVFIiwiX3NraXBSZW5kZXJDb3VudGVyIiwiX3JlbmRlclRpbWUiLCJfZm9yd2FyZERyYXdDYWxscyIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJfc2hhZGVyVmVyc2lvbiIsIl9saWdodEN1YmUiLCJoYXNDbHVzdGVyZWRMaWdodHMiLCJzaXplIiwidmFsIiwiaW5jcmVtZW50Q291bnRlciIsImRlY3JlbWVudENvdW50ZXIiLCJjbHVzdGVyZWRMaWdodHNTZXQiLCJEZWJ1ZyIsIndhcm4iLCJhZGRNZXNoSW5zdGFuY2VzIiwibWVzaEluc3RhbmNlcyIsInNraXBTaGFkb3dDYXN0ZXJzIiwic2NlbmVTaGFkZXJWZXIiLCJjYXN0ZXJzIiwiaSIsIm0iLCJtYXQiLCJtYXRlcmlhbCIsImFyciIsImJsZW5kVHlwZSIsIkJMRU5EX05PTkUiLCJpbmRleE9mIiwicHVzaCIsImNhc3RTaGFkb3ciLCJnZXRTaGFkZXJWYXJpYW50IiwiTWF0ZXJpYWwiLCJwcm90b3R5cGUiLCJjbGVhclZhcmlhbnRzIiwicmVtb3ZlTWVzaEluc3RhbmNlRnJvbUFycmF5Iiwic3BsaWNlT2Zmc2V0Iiwic3BsaWNlQ291bnQiLCJsZW4iLCJqIiwiZHJhd0NhbGwiLCJfc3RhdGljU291cmNlIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIm9wYXF1ZSIsInRyYW5zcGFyZW50IiwiY2xlYXJNZXNoSW5zdGFuY2VzIiwiYWRkTGlnaHQiLCJsaWdodCIsImwiLCJoYXMiLCJhZGQiLCJfZ2VuZXJhdGVMaWdodEhhc2giLCJ0eXBlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwicmVtb3ZlTGlnaHQiLCJjbGVhckxpZ2h0cyIsImNsZWFyIiwiYWRkU2hhZG93Q2FzdGVycyIsInJlbW92ZVNoYWRvd0Nhc3RlcnMiLCJzb3J0Iiwic3RyIiwic3RyU3RhdGljIiwiaXNTdGF0aWMiLCJoYXNoQ29kZSIsImFkZENhbWVyYSIsImNhbWVyYSIsInJlbW92ZUNhbWVyYSIsImNsZWFyQ2FtZXJhcyIsIl9jYWxjdWxhdGVTb3J0RGlzdGFuY2VzIiwiZHJhd0NhbGxzIiwiZHJhd0NhbGxzQ291bnQiLCJjYW1Qb3MiLCJjYW1Gd2QiLCJjb21tYW5kIiwibGF5ZXIiLCJMQVlFUl9GWCIsImNhbGN1bGF0ZVNvcnREaXN0YW5jZSIsIm1lc2hQb3MiLCJhYWJiIiwiY2VudGVyIiwidGVtcHgiLCJ4IiwidGVtcHkiLCJ5IiwidGVtcHoiLCJ6IiwiX3NvcnRWaXNpYmxlIiwiY2FtZXJhTm9kZSIsImNhbWVyYVBhc3MiLCJvYmplY3RzIiwic29ydE1vZGUiLCJTT1JUTU9ERV9OT05FIiwidmlzaWJsZSIsIlNPUlRNT0RFX0NVU1RPTSIsImdldFBvc2l0aW9uIiwiZm9yd2FyZCIsIlNPUlRNT0RFX0ZST05UMkJBQ0siXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFhQSxJQUFJQSxJQUFJLEVBQUVDLElBQUksRUFBRUMsT0FBTyxFQUFFQyxPQUFPLENBQUE7QUFFaEMsU0FBU0MsVUFBVSxDQUFDQyxTQUFTLEVBQUVDLFNBQVMsRUFBRTtBQUN0QyxFQUFBLE9BQU9ELFNBQVMsQ0FBQ0UsU0FBUyxHQUFHRCxTQUFTLENBQUNDLFNBQVMsQ0FBQTtBQUNwRCxDQUFBO0FBRUEsU0FBU0MsZ0JBQWdCLENBQUNILFNBQVMsRUFBRUMsU0FBUyxFQUFFO0FBQzVDTixFQUFBQSxJQUFJLEdBQUdLLFNBQVMsQ0FBQ0ksSUFBSSxDQUFDQyxlQUFlLENBQUMsQ0FBQTtBQUN0Q1QsRUFBQUEsSUFBSSxHQUFHSyxTQUFTLENBQUNHLElBQUksQ0FBQ0MsZUFBZSxDQUFDLENBQUE7RUFDdEMsSUFBSVYsSUFBSSxLQUFLQyxJQUFJLElBQUlJLFNBQVMsQ0FBQ00sSUFBSSxJQUFJTCxTQUFTLENBQUNLLElBQUksRUFBRTtJQUNuRCxPQUFPTCxTQUFTLENBQUNLLElBQUksQ0FBQ0MsRUFBRSxHQUFHUCxTQUFTLENBQUNNLElBQUksQ0FBQ0MsRUFBRSxDQUFBO0FBQ2hELEdBQUE7RUFDQSxPQUFPWCxJQUFJLEdBQUdELElBQUksQ0FBQTtBQUN0QixDQUFBO0FBRUEsU0FBU2EsZUFBZSxDQUFDUixTQUFTLEVBQUVDLFNBQVMsRUFBRTtBQUMzQyxFQUFBLE9BQU9BLFNBQVMsQ0FBQ1EsS0FBSyxHQUFHVCxTQUFTLENBQUNTLEtBQUssQ0FBQTtBQUM1QyxDQUFBO0FBRUEsU0FBU0MsZUFBZSxDQUFDVixTQUFTLEVBQUVDLFNBQVMsRUFBRTtBQUMzQyxFQUFBLE9BQU9ELFNBQVMsQ0FBQ1MsS0FBSyxHQUFHUixTQUFTLENBQUNRLEtBQUssQ0FBQTtBQUM1QyxDQUFBO0FBRUEsTUFBTUUsYUFBYSxHQUFHLENBQUMsSUFBSSxFQUFFWixVQUFVLEVBQUVJLGdCQUFnQixFQUFFSyxlQUFlLEVBQUVFLGVBQWUsQ0FBQyxDQUFBO0FBRTVGLFNBQVNFLFVBQVUsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUU7QUFDaEMsRUFBQSxPQUFPQSxNQUFNLENBQUNDLEdBQUcsR0FBR0YsTUFBTSxDQUFDRSxHQUFHLENBQUE7QUFDbEMsQ0FBQTs7QUFFQTtBQUNBLElBQUlDLFlBQVksR0FBRyxDQUFDLENBQUE7QUFFcEIsTUFBTUMsbUJBQW1CLENBQUM7QUFDdEJDLEVBQUFBLFdBQVcsR0FBRztJQUNWLElBQUksQ0FBQ0MsSUFBSSxHQUFHLEVBQUUsQ0FBQTtJQUNkLElBQUksQ0FBQ0MsTUFBTSxHQUFHLENBQUMsQ0FBQTtJQUNmLElBQUksQ0FBQ0MsSUFBSSxHQUFHLEtBQUssQ0FBQTtBQUNyQixHQUFBO0FBQ0osQ0FBQTtBQUVBLE1BQU1DLFlBQVksQ0FBQztBQUNmSixFQUFBQSxXQUFXLEdBQUc7SUFDVixJQUFJLENBQUNLLG1CQUFtQixHQUFHLEVBQUUsQ0FBQTtJQUM3QixJQUFJLENBQUNDLHdCQUF3QixHQUFHLEVBQUUsQ0FBQTtJQUNsQyxJQUFJLENBQUNDLGFBQWEsR0FBRyxFQUFFLENBQUE7O0FBRXZCO0lBQ0EsSUFBSSxDQUFDQyxhQUFhLEdBQUcsRUFBRSxDQUFBO0lBQ3ZCLElBQUksQ0FBQ0Msa0JBQWtCLEdBQUcsRUFBRSxDQUFBO0FBQ2hDLEdBQUE7O0FBRUE7RUFDQUMsT0FBTyxDQUFDQyxLQUFLLEVBQUU7QUFFWDtBQUNBLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ0gsYUFBYSxDQUFDRyxLQUFLLENBQUMsRUFBRTtNQUM1QixJQUFJLENBQUNILGFBQWEsQ0FBQ0csS0FBSyxDQUFDLEdBQUcsSUFBSVosbUJBQW1CLEVBQUUsQ0FBQTtBQUN6RCxLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDVSxrQkFBa0IsQ0FBQ0UsS0FBSyxDQUFDLEVBQUU7TUFDakMsSUFBSSxDQUFDRixrQkFBa0IsQ0FBQ0UsS0FBSyxDQUFDLEdBQUcsSUFBSVosbUJBQW1CLEVBQUUsQ0FBQTtBQUM5RCxLQUFBOztBQUVBO0lBQ0EsSUFBSSxDQUFDUyxhQUFhLENBQUNHLEtBQUssQ0FBQyxDQUFDUixJQUFJLEdBQUcsS0FBSyxDQUFBO0lBQ3RDLElBQUksQ0FBQ00sa0JBQWtCLENBQUNFLEtBQUssQ0FBQyxDQUFDUixJQUFJLEdBQUcsS0FBSyxDQUFBO0FBQy9DLEdBQUE7O0FBRUE7RUFDQVMsTUFBTSxDQUFDRCxLQUFLLEVBQUU7QUFDVixJQUFBLElBQUlBLEtBQUssR0FBRyxJQUFJLENBQUNILGFBQWEsQ0FBQ04sTUFBTSxFQUFFO01BQ25DLElBQUksQ0FBQ00sYUFBYSxDQUFDSyxNQUFNLENBQUNGLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUN2QyxLQUFBO0FBQ0EsSUFBQSxJQUFJQSxLQUFLLEdBQUcsSUFBSSxDQUFDRixrQkFBa0IsQ0FBQ1AsTUFBTSxFQUFFO01BQ3hDLElBQUksQ0FBQ08sa0JBQWtCLENBQUNJLE1BQU0sQ0FBQ0YsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQzVDLEtBQUE7QUFDSixHQUFBO0FBQ0osQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUcsS0FBSyxDQUFDO0FBQ1I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lkLEVBQUFBLFdBQVcsQ0FBQ2UsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUV0QixJQUFBLElBQUlBLE9BQU8sQ0FBQzFCLEVBQUUsS0FBSzJCLFNBQVMsRUFBRTtBQUMxQjtBQUNaO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1ksTUFBQSxJQUFJLENBQUMzQixFQUFFLEdBQUcwQixPQUFPLENBQUMxQixFQUFFLENBQUE7QUFDcEJTLE1BQUFBLFlBQVksR0FBR21CLElBQUksQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQzdCLEVBQUUsR0FBRyxDQUFDLEVBQUVTLFlBQVksQ0FBQyxDQUFBO0FBQ3RELEtBQUMsTUFBTTtBQUNILE1BQUEsSUFBSSxDQUFDVCxFQUFFLEdBQUdTLFlBQVksRUFBRSxDQUFBO0FBQzVCLEtBQUE7O0FBRUE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDcUIsSUFBSSxHQUFHSixPQUFPLENBQUNJLElBQUksQ0FBQTs7QUFFeEI7QUFDUjtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsUUFBUSxHQUFHTCxPQUFPLENBQUNNLE9BQU8sS0FBS0wsU0FBUyxHQUFHLElBQUksR0FBR0QsT0FBTyxDQUFDTSxPQUFPLENBQUE7QUFDdEU7QUFDUjtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJLENBQUNGLFFBQVEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFBOztBQUV4QztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNHLGNBQWMsR0FBR1IsT0FBTyxDQUFDUSxjQUFjLEtBQUtQLFNBQVMsR0FBR1EscUJBQXFCLEdBQUdULE9BQU8sQ0FBQ1EsY0FBYyxDQUFBOztBQUUzRztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDRSxtQkFBbUIsR0FBR1YsT0FBTyxDQUFDVSxtQkFBbUIsS0FBS1QsU0FBUyxHQUFHVSxtQkFBbUIsR0FBR1gsT0FBTyxDQUFDVSxtQkFBbUIsQ0FBQTtJQUV4SCxJQUFJVixPQUFPLENBQUNZLFlBQVksRUFBRTtBQUN0QixNQUFBLElBQUksQ0FBQ0EsWUFBWSxHQUFHWixPQUFPLENBQUNZLFlBQVksQ0FBQTtBQUM1QyxLQUFBOztBQUVBO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLFVBQVUsR0FBR2IsT0FBTyxDQUFDYSxVQUFVLEtBQUtaLFNBQVMsR0FBR2EsY0FBYyxHQUFHZCxPQUFPLENBQUNhLFVBQVUsQ0FBQTs7QUFFeEY7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0UsV0FBVyxHQUFHZixPQUFPLENBQUNlLFdBQVcsS0FBS2QsU0FBUyxHQUFHLEtBQUssR0FBR0QsT0FBTyxDQUFDZSxXQUFXLENBQUE7O0FBRWxGO0FBQ0E7QUFDUjtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDaEIsT0FBTyxDQUFDaUIsZ0JBQWdCLENBQUE7O0FBRW5EO0FBQ1I7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLGlCQUFpQixHQUFHLENBQUMsQ0FBQ2xCLE9BQU8sQ0FBQ21CLGdCQUFnQixDQUFBOztBQUVuRDtBQUNSO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDQyxtQkFBbUIsR0FBRyxDQUFDLENBQUNwQixPQUFPLENBQUNxQixrQkFBa0IsQ0FBQTs7QUFFdkQ7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsU0FBUyxHQUFHdEIsT0FBTyxDQUFDc0IsU0FBUyxDQUFBO0FBQ2xDO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDQyxXQUFXLEdBQUd2QixPQUFPLENBQUN1QixXQUFXLENBQUE7QUFDdEM7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDQyxpQkFBaUIsR0FBR3hCLE9BQU8sQ0FBQ3dCLGlCQUFpQixDQUFBO0FBQ2xEO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLHNCQUFzQixHQUFHekIsT0FBTyxDQUFDeUIsc0JBQXNCLENBQUE7O0FBRTVEO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDQyxVQUFVLEdBQUcxQixPQUFPLENBQUMwQixVQUFVLENBQUE7QUFDcEM7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLFlBQVksR0FBRzNCLE9BQU8sQ0FBQzJCLFlBQVksQ0FBQTtBQUN4QztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLGtCQUFrQixHQUFHNUIsT0FBTyxDQUFDNEIsa0JBQWtCLENBQUE7QUFDcEQ7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsdUJBQXVCLEdBQUc3QixPQUFPLENBQUM2Qix1QkFBdUIsQ0FBQTs7QUFFOUQ7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsVUFBVSxHQUFHOUIsT0FBTyxDQUFDOEIsVUFBVSxDQUFBO0FBQ3BDO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsUUFBUSxHQUFHL0IsT0FBTyxDQUFDK0IsUUFBUSxDQUFBO0FBQ2hDO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsU0FBUyxHQUFHaEMsT0FBTyxDQUFDZ0MsU0FBUyxDQUFBO0FBRWxDLElBQUEsSUFBSSxJQUFJLENBQUMzQixRQUFRLElBQUksSUFBSSxDQUFDMEIsUUFBUSxFQUFFO01BQ2hDLElBQUksQ0FBQ0EsUUFBUSxFQUFFLENBQUE7QUFDbkIsS0FBQTs7QUFFQTtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDRSxjQUFjLEdBQUdqQyxPQUFPLENBQUNpQyxjQUFjLENBQUM7O0FBRTdDO0FBQ1I7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLFNBQVMsR0FBR2xDLE9BQU8sQ0FBQ2lDLGNBQWMsR0FBR2pDLE9BQU8sQ0FBQ2lDLGNBQWMsQ0FBQ0MsU0FBUyxHQUFHLElBQUk3QyxZQUFZLEVBQUUsQ0FBQTs7QUFFL0Y7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUM4QyxXQUFXLEdBQUduQyxPQUFPLENBQUNtQyxXQUFXLEdBQUduQyxPQUFPLENBQUNtQyxXQUFXLEdBQUcsVUFBVSxDQUFBOztBQUV6RTtBQUNSO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDN0MsbUJBQW1CLEdBQUcsSUFBSSxDQUFDNEMsU0FBUyxDQUFDNUMsbUJBQW1CLENBQUE7QUFDN0Q7QUFDUjtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0Msd0JBQXdCLEdBQUcsSUFBSSxDQUFDMkMsU0FBUyxDQUFDM0Msd0JBQXdCLENBQUE7QUFDdkU7QUFDUjtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUksQ0FBQzBDLFNBQVMsQ0FBQzFDLGFBQWEsQ0FBQTs7QUFFakQ7QUFDUjtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUM0QyxrQkFBa0IsR0FBRyxJQUFJLENBQUE7QUFDOUI7QUFDUjtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLHlCQUF5QixHQUFHLElBQUksQ0FBQTs7QUFFckM7QUFDUjtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLE9BQU8sR0FBRyxFQUFFLENBQUE7QUFDakI7QUFDUjtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsVUFBVSxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBOztBQUUzQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsSUFBSUQsR0FBRyxFQUFFLENBQUE7O0FBRXBDO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0UsWUFBWSxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQTs7QUFFaEM7QUFDUjtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLE9BQU8sR0FBRyxFQUFFLENBQUE7SUFFakIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsS0FBSyxDQUFBO0lBQ25CLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEtBQUssQ0FBQTtJQUN6QixJQUFJLENBQUNDLGFBQWEsR0FBRyxLQUFLLENBQUE7SUFFMUIsSUFBSSxDQUFDQyxVQUFVLEdBQUcsQ0FBQyxDQUFBO0lBQ25CLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO0lBQ3pCLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUcsSUFBSSxDQUFBO0lBQy9CLElBQUksQ0FBQ0Msa0JBQWtCLEdBQUcsS0FBSyxDQUFBO0FBRy9CLElBQUEsSUFBSSxDQUFDQyxlQUFlLEdBQUdDLE1BQU0sQ0FBQ0MsU0FBUyxDQUFBO0lBQ3ZDLElBQUksQ0FBQ0Msa0JBQWtCLEdBQUcsQ0FBQyxDQUFBO0lBRTNCLElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQUMsQ0FBQTtJQUNwQixJQUFJLENBQUNDLGlCQUFpQixHQUFHLENBQUMsQ0FBQTtBQUMxQixJQUFBLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDOztBQUcxQixJQUFBLElBQUksQ0FBQ0MsY0FBYyxHQUFHLENBQUMsQ0FBQyxDQUFBOztBQUV4QjtBQUNSO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsVUFBVSxHQUFHLElBQUksQ0FBQTtBQUMxQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJLEVBQUEsSUFBSUMsa0JBQWtCLEdBQUc7QUFDckIsSUFBQSxPQUFPLElBQUksQ0FBQ25CLG1CQUFtQixDQUFDb0IsSUFBSSxHQUFHLENBQUMsQ0FBQTtBQUM1QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJdkQsT0FBTyxDQUFDd0QsR0FBRyxFQUFFO0FBQ2IsSUFBQSxJQUFJQSxHQUFHLEtBQUssSUFBSSxDQUFDekQsUUFBUSxFQUFFO01BQ3ZCLElBQUksQ0FBQ0EsUUFBUSxHQUFHeUQsR0FBRyxDQUFBO0FBQ25CLE1BQUEsSUFBSUEsR0FBRyxFQUFFO1FBQ0wsSUFBSSxDQUFDQyxnQkFBZ0IsRUFBRSxDQUFBO0FBQ3ZCLFFBQUEsSUFBSSxJQUFJLENBQUNoQyxRQUFRLEVBQUUsSUFBSSxDQUFDQSxRQUFRLEVBQUUsQ0FBQTtBQUN0QyxPQUFDLE1BQU07UUFDSCxJQUFJLENBQUNpQyxnQkFBZ0IsRUFBRSxDQUFBO0FBQ3ZCLFFBQUEsSUFBSSxJQUFJLENBQUNoQyxTQUFTLEVBQUUsSUFBSSxDQUFDQSxTQUFTLEVBQUUsQ0FBQTtBQUN4QyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUkxQixPQUFPLEdBQUc7SUFDVixPQUFPLElBQUksQ0FBQ0QsUUFBUSxDQUFBO0FBQ3hCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlZLGdCQUFnQixDQUFDNkMsR0FBRyxFQUFFO0lBQ3RCLElBQUksQ0FBQzlDLGlCQUFpQixHQUFHOEMsR0FBRyxDQUFBO0lBQzVCLElBQUksQ0FBQ2hCLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDN0IsR0FBQTtBQUVBLEVBQUEsSUFBSTdCLGdCQUFnQixHQUFHO0lBQ25CLE9BQU8sSUFBSSxDQUFDRCxpQkFBaUIsQ0FBQTtBQUNqQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJRyxnQkFBZ0IsQ0FBQzJDLEdBQUcsRUFBRTtJQUN0QixJQUFJLENBQUM1QyxpQkFBaUIsR0FBRzRDLEdBQUcsQ0FBQTtJQUM1QixJQUFJLENBQUNoQixhQUFhLEdBQUcsSUFBSSxDQUFBO0FBQzdCLEdBQUE7QUFFQSxFQUFBLElBQUkzQixnQkFBZ0IsR0FBRztJQUNuQixPQUFPLElBQUksQ0FBQ0QsaUJBQWlCLENBQUE7QUFDakMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUcsa0JBQWtCLENBQUN5QyxHQUFHLEVBQUU7SUFDeEIsSUFBSSxDQUFDMUMsbUJBQW1CLEdBQUcwQyxHQUFHLENBQUE7SUFDOUIsSUFBSSxDQUFDaEIsYUFBYSxHQUFHLElBQUksQ0FBQTtBQUM3QixHQUFBO0FBRUEsRUFBQSxJQUFJekIsa0JBQWtCLEdBQUc7SUFDckIsT0FBTyxJQUFJLENBQUNELG1CQUFtQixDQUFBO0FBQ25DLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0ksRUFBQSxJQUFJNkMsa0JBQWtCLEdBQUc7SUFDckIsT0FBTyxJQUFJLENBQUN4QixtQkFBbUIsQ0FBQTtBQUNuQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSXNCLEVBQUFBLGdCQUFnQixHQUFHO0FBQ2YsSUFBQSxJQUFJLElBQUksQ0FBQ3hELFdBQVcsS0FBSyxDQUFDLEVBQUU7TUFDeEIsSUFBSSxDQUFDRixRQUFRLEdBQUcsSUFBSSxDQUFBO0FBQ3BCLE1BQUEsSUFBSSxJQUFJLENBQUMwQixRQUFRLEVBQUUsSUFBSSxDQUFDQSxRQUFRLEVBQUUsQ0FBQTtBQUN0QyxLQUFBO0lBQ0EsSUFBSSxDQUFDeEIsV0FBVyxFQUFFLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJeUQsRUFBQUEsZ0JBQWdCLEdBQUc7QUFDZixJQUFBLElBQUksSUFBSSxDQUFDekQsV0FBVyxLQUFLLENBQUMsRUFBRTtNQUN4QixJQUFJLENBQUNGLFFBQVEsR0FBRyxLQUFLLENBQUE7QUFDckIsTUFBQSxJQUFJLElBQUksQ0FBQzJCLFNBQVMsRUFBRSxJQUFJLENBQUNBLFNBQVMsRUFBRSxDQUFBO0FBRXhDLEtBQUMsTUFBTSxJQUFJLElBQUksQ0FBQ3pCLFdBQVcsS0FBSyxDQUFDLEVBQUU7QUFDL0IyRCxNQUFBQSxLQUFLLENBQUNDLElBQUksQ0FBQywyQ0FBMkMsQ0FBQyxDQUFBO0FBQ3ZELE1BQUEsT0FBQTtBQUNKLEtBQUE7SUFDQSxJQUFJLENBQUM1RCxXQUFXLEVBQUUsQ0FBQTtBQUN0QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJNkQsRUFBQUEsZ0JBQWdCLENBQUNDLGFBQWEsRUFBRUMsaUJBQWlCLEVBQUU7QUFDL0MsSUFBQSxNQUFNQyxjQUFjLEdBQUcsSUFBSSxDQUFDYixjQUFjLENBQUE7QUFFMUMsSUFBQSxNQUFNYyxPQUFPLEdBQUcsSUFBSSxDQUFDaEYsYUFBYSxDQUFBO0FBQ2xDLElBQUEsS0FBSyxJQUFJaUYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSixhQUFhLENBQUNsRixNQUFNLEVBQUVzRixDQUFDLEVBQUUsRUFBRTtBQUMzQyxNQUFBLE1BQU1DLENBQUMsR0FBR0wsYUFBYSxDQUFDSSxDQUFDLENBQUMsQ0FBQTtBQUMxQixNQUFBLE1BQU1FLEdBQUcsR0FBR0QsQ0FBQyxDQUFDRSxRQUFRLENBQUE7QUFDdEIsTUFBQSxNQUFNQyxHQUFHLEdBQUdGLEdBQUcsQ0FBQ0csU0FBUyxLQUFLQyxVQUFVLEdBQUcsSUFBSSxDQUFDekYsbUJBQW1CLEdBQUcsSUFBSSxDQUFDQyx3QkFBd0IsQ0FBQTs7QUFFbkc7QUFDQTtNQUNBLElBQUksSUFBSSxDQUFDRCxtQkFBbUIsQ0FBQzBGLE9BQU8sQ0FBQ04sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQ25GLHdCQUF3QixDQUFDeUYsT0FBTyxDQUFDTixDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDekZHLFFBQUFBLEdBQUcsQ0FBQ0ksSUFBSSxDQUFDUCxDQUFDLENBQUMsQ0FBQTtBQUNmLE9BQUE7TUFFQSxJQUFJLENBQUNKLGlCQUFpQixJQUFJSSxDQUFDLENBQUNRLFVBQVUsSUFBSVYsT0FBTyxDQUFDUSxPQUFPLENBQUNOLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRUYsT0FBTyxDQUFDUyxJQUFJLENBQUNQLENBQUMsQ0FBQyxDQUFBOztBQUVqRjtBQUNBLE1BQUEsSUFBSSxDQUFDLElBQUksQ0FBQzNELFdBQVcsSUFBSXdELGNBQWMsSUFBSSxDQUFDLElBQUlJLEdBQUcsQ0FBQ2pCLGNBQWMsS0FBS2EsY0FBYyxFQUFFO0FBRW5GO1FBQ0EsSUFBSUksR0FBRyxDQUFDUSxnQkFBZ0IsS0FBS0MsUUFBUSxDQUFDQyxTQUFTLENBQUNGLGdCQUFnQixFQUFFO0FBQzlEO1VBQ0FSLEdBQUcsQ0FBQ1csYUFBYSxFQUFFLENBQUE7QUFDdkIsU0FBQTtRQUNBWCxHQUFHLENBQUNqQixjQUFjLEdBQUdhLGNBQWMsQ0FBQTtBQUN2QyxPQUFBO0FBQ0osS0FBQTtJQUNBLElBQUksQ0FBQyxJQUFJLENBQUN4RCxXQUFXLEVBQUUsSUFBSSxDQUFDNkIsTUFBTSxHQUFHLElBQUksQ0FBQTtBQUM3QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTJDLEVBQUFBLDJCQUEyQixDQUFDYixDQUFDLEVBQUVHLEdBQUcsRUFBRTtJQUNoQyxJQUFJVyxZQUFZLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFDckIsSUFBSUMsV0FBVyxHQUFHLENBQUMsQ0FBQTtBQUNuQixJQUFBLE1BQU1DLEdBQUcsR0FBR2IsR0FBRyxDQUFDMUYsTUFBTSxDQUFBO0lBQ3RCLEtBQUssSUFBSXdHLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0QsR0FBRyxFQUFFQyxDQUFDLEVBQUUsRUFBRTtBQUMxQixNQUFBLE1BQU1DLFFBQVEsR0FBR2YsR0FBRyxDQUFDYyxDQUFDLENBQUMsQ0FBQTtNQUN2QixJQUFJQyxRQUFRLEtBQUtsQixDQUFDLEVBQUU7QUFDaEJjLFFBQUFBLFlBQVksR0FBR0csQ0FBQyxDQUFBO0FBQ2hCRixRQUFBQSxXQUFXLEdBQUcsQ0FBQyxDQUFBO0FBQ2YsUUFBQSxNQUFBO0FBQ0osT0FBQTtBQUNBLE1BQUEsSUFBSUcsUUFBUSxDQUFDQyxhQUFhLEtBQUtuQixDQUFDLEVBQUU7QUFDOUIsUUFBQSxJQUFJYyxZQUFZLEdBQUcsQ0FBQyxFQUFFQSxZQUFZLEdBQUdHLENBQUMsQ0FBQTtBQUN0Q0YsUUFBQUEsV0FBVyxFQUFFLENBQUE7QUFDakIsT0FBQyxNQUFNLElBQUlELFlBQVksSUFBSSxDQUFDLEVBQUU7QUFDMUIsUUFBQSxNQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJQSxZQUFZLElBQUksQ0FBQyxFQUFFO0FBQ25CWCxNQUFBQSxHQUFHLENBQUMvRSxNQUFNLENBQUMwRixZQUFZLEVBQUVDLFdBQVcsQ0FBQyxDQUFBO0FBQ3pDLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUssRUFBQUEsbUJBQW1CLENBQUN6QixhQUFhLEVBQUVDLGlCQUFpQixFQUFFO0FBRWxELElBQUEsTUFBTXlCLE1BQU0sR0FBRyxJQUFJLENBQUN6RyxtQkFBbUIsQ0FBQTtBQUN2QyxJQUFBLE1BQU0wRyxXQUFXLEdBQUcsSUFBSSxDQUFDekcsd0JBQXdCLENBQUE7QUFDakQsSUFBQSxNQUFNaUYsT0FBTyxHQUFHLElBQUksQ0FBQ2hGLGFBQWEsQ0FBQTtBQUVsQyxJQUFBLEtBQUssSUFBSWlGLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0osYUFBYSxDQUFDbEYsTUFBTSxFQUFFc0YsQ0FBQyxFQUFFLEVBQUU7QUFDM0MsTUFBQSxNQUFNQyxDQUFDLEdBQUdMLGFBQWEsQ0FBQ0ksQ0FBQyxDQUFDLENBQUE7O0FBRTFCO0FBQ0EsTUFBQSxJQUFJLENBQUNjLDJCQUEyQixDQUFDYixDQUFDLEVBQUVxQixNQUFNLENBQUMsQ0FBQTs7QUFFM0M7QUFDQSxNQUFBLElBQUksQ0FBQ1IsMkJBQTJCLENBQUNiLENBQUMsRUFBRXNCLFdBQVcsQ0FBQyxDQUFBOztBQUVoRDtNQUNBLElBQUksQ0FBQzFCLGlCQUFpQixFQUFFO0FBQ3BCLFFBQUEsTUFBTXFCLENBQUMsR0FBR25CLE9BQU8sQ0FBQ1EsT0FBTyxDQUFDTixDQUFDLENBQUMsQ0FBQTtRQUM1QixJQUFJaUIsQ0FBQyxJQUFJLENBQUMsRUFDTm5CLE9BQU8sQ0FBQzFFLE1BQU0sQ0FBQzZGLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUM1QixPQUFBO0FBQ0osS0FBQTtJQUVBLElBQUksQ0FBQy9DLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSXFELGtCQUFrQixDQUFDM0IsaUJBQWlCLEVBQUU7QUFDbEMsSUFBQSxJQUFJLElBQUksQ0FBQ2hGLG1CQUFtQixDQUFDSCxNQUFNLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQ0ksd0JBQXdCLENBQUNKLE1BQU0sS0FBSyxDQUFDLEVBQUU7TUFDckYsSUFBSW1GLGlCQUFpQixJQUFJLElBQUksQ0FBQzlFLGFBQWEsQ0FBQ0wsTUFBTSxLQUFLLENBQUMsRUFBRSxPQUFBO0FBQzlELEtBQUE7QUFDQSxJQUFBLElBQUksQ0FBQ0csbUJBQW1CLENBQUNILE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDbkMsSUFBQSxJQUFJLENBQUNJLHdCQUF3QixDQUFDSixNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBQ3hDLElBQUksQ0FBQ21GLGlCQUFpQixFQUFFLElBQUksQ0FBQzlFLGFBQWEsQ0FBQ0wsTUFBTSxHQUFHLENBQUMsQ0FBQTtJQUNyRCxJQUFJLENBQUMsSUFBSSxDQUFDNEIsV0FBVyxFQUFFLElBQUksQ0FBQzZCLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFDN0MsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSXNELFFBQVEsQ0FBQ0MsS0FBSyxFQUFFO0FBRVo7QUFDQSxJQUFBLE1BQU1DLENBQUMsR0FBR0QsS0FBSyxDQUFDQSxLQUFLLENBQUE7SUFDckIsSUFBSSxDQUFDLElBQUksQ0FBQzVELFVBQVUsQ0FBQzhELEdBQUcsQ0FBQ0QsQ0FBQyxDQUFDLEVBQUU7QUFDekIsTUFBQSxJQUFJLENBQUM3RCxVQUFVLENBQUMrRCxHQUFHLENBQUNGLENBQUMsQ0FBQyxDQUFBO0FBRXRCLE1BQUEsSUFBSSxDQUFDOUQsT0FBTyxDQUFDMkMsSUFBSSxDQUFDbUIsQ0FBQyxDQUFDLENBQUE7TUFDcEIsSUFBSSxDQUFDdkQsWUFBWSxHQUFHLElBQUksQ0FBQTtNQUN4QixJQUFJLENBQUMwRCxrQkFBa0IsRUFBRSxDQUFBO0FBQzdCLEtBQUE7QUFFQSxJQUFBLElBQUlILENBQUMsQ0FBQ0ksSUFBSSxLQUFLQyxxQkFBcUIsRUFBRTtBQUNsQyxNQUFBLElBQUksQ0FBQ2hFLG1CQUFtQixDQUFDNkQsR0FBRyxDQUFDRixDQUFDLENBQUMsQ0FBQTtBQUNuQyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSU0sV0FBVyxDQUFDUCxLQUFLLEVBQUU7QUFFZixJQUFBLE1BQU1DLENBQUMsR0FBR0QsS0FBSyxDQUFDQSxLQUFLLENBQUE7SUFDckIsSUFBSSxJQUFJLENBQUM1RCxVQUFVLENBQUM4RCxHQUFHLENBQUNELENBQUMsQ0FBQyxFQUFFO0FBQ3hCLE1BQUEsSUFBSSxDQUFDN0QsVUFBVSxDQUFDMUMsTUFBTSxDQUFDdUcsQ0FBQyxDQUFDLENBQUE7QUFFekIsTUFBQSxJQUFJLENBQUM5RCxPQUFPLENBQUN4QyxNQUFNLENBQUMsSUFBSSxDQUFDd0MsT0FBTyxDQUFDMEMsT0FBTyxDQUFDb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7TUFDL0MsSUFBSSxDQUFDdkQsWUFBWSxHQUFHLElBQUksQ0FBQTtNQUN4QixJQUFJLENBQUMwRCxrQkFBa0IsRUFBRSxDQUFBO0FBQzdCLEtBQUE7QUFFQSxJQUFBLElBQUlILENBQUMsQ0FBQ0ksSUFBSSxLQUFLQyxxQkFBcUIsRUFBRTtBQUNsQyxNQUFBLElBQUksQ0FBQ2hFLG1CQUFtQixDQUFDNUMsTUFBTSxDQUFDdUcsQ0FBQyxDQUFDLENBQUE7QUFDdEMsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0lPLEVBQUFBLFdBQVcsR0FBRztBQUNWLElBQUEsSUFBSSxDQUFDcEUsVUFBVSxDQUFDcUUsS0FBSyxFQUFFLENBQUE7QUFDdkIsSUFBQSxJQUFJLENBQUNuRSxtQkFBbUIsQ0FBQ21FLEtBQUssRUFBRSxDQUFBO0FBQ2hDLElBQUEsSUFBSSxDQUFDdEUsT0FBTyxDQUFDbkQsTUFBTSxHQUFHLENBQUMsQ0FBQTtJQUN2QixJQUFJLENBQUMwRCxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBQzVCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSWdFLGdCQUFnQixDQUFDeEMsYUFBYSxFQUFFO0FBQzVCLElBQUEsTUFBTVEsR0FBRyxHQUFHLElBQUksQ0FBQ3JGLGFBQWEsQ0FBQTtBQUM5QixJQUFBLEtBQUssSUFBSWlGLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0osYUFBYSxDQUFDbEYsTUFBTSxFQUFFc0YsQ0FBQyxFQUFFLEVBQUU7QUFDM0MsTUFBQSxNQUFNQyxDQUFDLEdBQUdMLGFBQWEsQ0FBQ0ksQ0FBQyxDQUFDLENBQUE7QUFDMUIsTUFBQSxJQUFJLENBQUNDLENBQUMsQ0FBQ1EsVUFBVSxFQUFFLFNBQUE7QUFDbkIsTUFBQSxJQUFJTCxHQUFHLENBQUNHLE9BQU8sQ0FBQ04sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFRyxHQUFHLENBQUNJLElBQUksQ0FBQ1AsQ0FBQyxDQUFDLENBQUE7QUFDdkMsS0FBQTtJQUNBLElBQUksQ0FBQzdCLFlBQVksR0FBRyxJQUFJLENBQUE7QUFDNUIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJaUUsbUJBQW1CLENBQUN6QyxhQUFhLEVBQUU7QUFDL0IsSUFBQSxNQUFNUSxHQUFHLEdBQUcsSUFBSSxDQUFDckYsYUFBYSxDQUFBO0FBQzlCLElBQUEsS0FBSyxJQUFJaUYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSixhQUFhLENBQUNsRixNQUFNLEVBQUVzRixDQUFDLEVBQUUsRUFBRTtNQUMzQyxNQUFNbkcsRUFBRSxHQUFHdUcsR0FBRyxDQUFDRyxPQUFPLENBQUNYLGFBQWEsQ0FBQ0ksQ0FBQyxDQUFDLENBQUMsQ0FBQTtNQUN4QyxJQUFJbkcsRUFBRSxJQUFJLENBQUMsRUFBRXVHLEdBQUcsQ0FBQy9FLE1BQU0sQ0FBQ3hCLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNsQyxLQUFBO0lBQ0EsSUFBSSxDQUFDdUUsWUFBWSxHQUFHLElBQUksQ0FBQTtBQUM1QixHQUFBOztBQUVBO0FBQ0EwRCxFQUFBQSxrQkFBa0IsR0FBRztBQUNqQjtBQUNBO0FBQ0EsSUFBQSxJQUFJLElBQUksQ0FBQ2pFLE9BQU8sQ0FBQ25ELE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDekIsTUFBQSxJQUFJLENBQUNtRCxPQUFPLENBQUN5RSxJQUFJLENBQUNwSSxVQUFVLENBQUMsQ0FBQTtNQUM3QixJQUFJcUksR0FBRyxHQUFHLEVBQUUsQ0FBQTtNQUNaLElBQUlDLFNBQVMsR0FBRyxFQUFFLENBQUE7QUFFbEIsTUFBQSxLQUFLLElBQUl4QyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDbkMsT0FBTyxDQUFDbkQsTUFBTSxFQUFFc0YsQ0FBQyxFQUFFLEVBQUU7UUFDMUMsSUFBSSxJQUFJLENBQUNuQyxPQUFPLENBQUNtQyxDQUFDLENBQUMsQ0FBQ3lDLFFBQVEsRUFBRTtVQUMxQkQsU0FBUyxJQUFJLElBQUksQ0FBQzNFLE9BQU8sQ0FBQ21DLENBQUMsQ0FBQyxDQUFDM0YsR0FBRyxDQUFBO0FBQ3BDLFNBQUMsTUFBTTtVQUNIa0ksR0FBRyxJQUFJLElBQUksQ0FBQzFFLE9BQU8sQ0FBQ21DLENBQUMsQ0FBQyxDQUFDM0YsR0FBRyxDQUFBO0FBQzlCLFNBQUE7QUFDSixPQUFBO0FBRUEsTUFBQSxJQUFJa0ksR0FBRyxDQUFDN0gsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUNsQixJQUFJLENBQUM0RCxVQUFVLEdBQUcsQ0FBQyxDQUFBO0FBQ3ZCLE9BQUMsTUFBTTtBQUNILFFBQUEsSUFBSSxDQUFDQSxVQUFVLEdBQUdvRSxRQUFRLENBQUNILEdBQUcsQ0FBQyxDQUFBO0FBQ25DLE9BQUE7QUFFQSxNQUFBLElBQUlDLFNBQVMsQ0FBQzlILE1BQU0sS0FBSyxDQUFDLEVBQUU7UUFDeEIsSUFBSSxDQUFDNkQsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO0FBQzdCLE9BQUMsTUFBTTtBQUNILFFBQUEsSUFBSSxDQUFDQSxnQkFBZ0IsR0FBR21FLFFBQVEsQ0FBQ0YsU0FBUyxDQUFDLENBQUE7QUFDL0MsT0FBQTtBQUVKLEtBQUMsTUFBTTtNQUNILElBQUksQ0FBQ2xFLFVBQVUsR0FBRyxDQUFDLENBQUE7TUFDbkIsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUE7QUFDN0IsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lvRSxTQUFTLENBQUNDLE1BQU0sRUFBRTtJQUNkLElBQUksSUFBSSxDQUFDMUUsT0FBTyxDQUFDcUMsT0FBTyxDQUFDcUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQUE7QUFDdkMsSUFBQSxJQUFJLENBQUMxRSxPQUFPLENBQUNzQyxJQUFJLENBQUNvQyxNQUFNLENBQUMsQ0FBQTtJQUN6QixJQUFJLENBQUN2RSxhQUFhLEdBQUcsSUFBSSxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0l3RSxZQUFZLENBQUNELE1BQU0sRUFBRTtJQUNqQixNQUFNekgsS0FBSyxHQUFHLElBQUksQ0FBQytDLE9BQU8sQ0FBQ3FDLE9BQU8sQ0FBQ3FDLE1BQU0sQ0FBQyxDQUFBO0lBQzFDLElBQUl6SCxLQUFLLElBQUksQ0FBQyxFQUFFO01BQ1osSUFBSSxDQUFDK0MsT0FBTyxDQUFDN0MsTUFBTSxDQUFDRixLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUE7TUFDN0IsSUFBSSxDQUFDa0QsYUFBYSxHQUFHLElBQUksQ0FBQTs7QUFFekI7QUFDQSxNQUFBLElBQUksQ0FBQ1osU0FBUyxDQUFDckMsTUFBTSxDQUFDRCxLQUFLLENBQUMsQ0FBQTtBQUNoQyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDSTJILEVBQUFBLFlBQVksR0FBRztBQUNYLElBQUEsSUFBSSxDQUFDNUUsT0FBTyxDQUFDeEQsTUFBTSxHQUFHLENBQUMsQ0FBQTtJQUN2QixJQUFJLENBQUMyRCxhQUFhLEdBQUcsSUFBSSxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSTBFLHVCQUF1QixDQUFDQyxTQUFTLEVBQUVDLGNBQWMsRUFBRUMsTUFBTSxFQUFFQyxNQUFNLEVBQUU7SUFDL0QsS0FBSyxJQUFJbkQsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHaUQsY0FBYyxFQUFFakQsQ0FBQyxFQUFFLEVBQUU7QUFDckMsTUFBQSxNQUFNbUIsUUFBUSxHQUFHNkIsU0FBUyxDQUFDaEQsQ0FBQyxDQUFDLENBQUE7TUFDN0IsSUFBSW1CLFFBQVEsQ0FBQ2lDLE9BQU8sRUFBRSxTQUFBO0FBQ3RCLE1BQUEsSUFBSWpDLFFBQVEsQ0FBQ2tDLEtBQUssSUFBSUMsUUFBUSxFQUFFLFNBQVM7TUFDekMsSUFBSW5DLFFBQVEsQ0FBQ29DLHFCQUFxQixFQUFFO0FBQ2hDcEMsUUFBQUEsUUFBUSxDQUFDcEgsS0FBSyxHQUFHb0gsUUFBUSxDQUFDb0MscUJBQXFCLENBQUNwQyxRQUFRLEVBQUUrQixNQUFNLEVBQUVDLE1BQU0sQ0FBQyxDQUFBO0FBQ3pFLFFBQUEsU0FBQTtBQUNKLE9BQUE7QUFDQSxNQUFBLE1BQU1LLE9BQU8sR0FBR3JDLFFBQVEsQ0FBQ3NDLElBQUksQ0FBQ0MsTUFBTSxDQUFBO01BQ3BDLE1BQU1DLEtBQUssR0FBR0gsT0FBTyxDQUFDSSxDQUFDLEdBQUdWLE1BQU0sQ0FBQ1UsQ0FBQyxDQUFBO01BQ2xDLE1BQU1DLEtBQUssR0FBR0wsT0FBTyxDQUFDTSxDQUFDLEdBQUdaLE1BQU0sQ0FBQ1ksQ0FBQyxDQUFBO01BQ2xDLE1BQU1DLEtBQUssR0FBR1AsT0FBTyxDQUFDUSxDQUFDLEdBQUdkLE1BQU0sQ0FBQ2MsQ0FBQyxDQUFBO0FBQ2xDN0MsTUFBQUEsUUFBUSxDQUFDcEgsS0FBSyxHQUFHNEosS0FBSyxHQUFHUixNQUFNLENBQUNTLENBQUMsR0FBR0MsS0FBSyxHQUFHVixNQUFNLENBQUNXLENBQUMsR0FBR0MsS0FBSyxHQUFHWixNQUFNLENBQUNhLENBQUMsQ0FBQTtBQUMzRSxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxZQUFZLENBQUMxQyxXQUFXLEVBQUUyQyxVQUFVLEVBQUVDLFVBQVUsRUFBRTtBQUM5QyxJQUFBLE1BQU1DLE9BQU8sR0FBRyxJQUFJLENBQUMzRyxTQUFTLENBQUE7SUFDOUIsTUFBTTRHLFFBQVEsR0FBRzlDLFdBQVcsR0FBRyxJQUFJLENBQUN0RixtQkFBbUIsR0FBRyxJQUFJLENBQUNGLGNBQWMsQ0FBQTtJQUM3RSxJQUFJc0ksUUFBUSxLQUFLQyxhQUFhLEVBQUUsT0FBQTtBQUVoQyxJQUFBLE1BQU1DLE9BQU8sR0FBR2hELFdBQVcsR0FBRzZDLE9BQU8sQ0FBQ25KLGtCQUFrQixDQUFDa0osVUFBVSxDQUFDLEdBQUdDLE9BQU8sQ0FBQ3BKLGFBQWEsQ0FBQ21KLFVBQVUsQ0FBQyxDQUFBO0lBRXhHLElBQUlFLFFBQVEsS0FBS0csZUFBZSxFQUFFO0FBQzlCckwsTUFBQUEsT0FBTyxHQUFHK0ssVUFBVSxDQUFDTyxXQUFXLEVBQUUsQ0FBQTtNQUNsQ3JMLE9BQU8sR0FBRzhLLFVBQVUsQ0FBQ1EsT0FBTyxDQUFBO01BQzVCLElBQUksSUFBSSxDQUFDOUcseUJBQXlCLEVBQUU7QUFDaEMsUUFBQSxJQUFJLENBQUNBLHlCQUF5QixDQUFDMkcsT0FBTyxDQUFDOUosSUFBSSxFQUFFOEosT0FBTyxDQUFDN0osTUFBTSxFQUFFdkIsT0FBTyxFQUFFQyxPQUFPLENBQUMsQ0FBQTtBQUNsRixPQUFBO01BRUEsSUFBSW1MLE9BQU8sQ0FBQzlKLElBQUksQ0FBQ0MsTUFBTSxLQUFLNkosT0FBTyxDQUFDN0osTUFBTSxFQUFFO0FBQ3hDNkosUUFBQUEsT0FBTyxDQUFDOUosSUFBSSxDQUFDQyxNQUFNLEdBQUc2SixPQUFPLENBQUM3SixNQUFNLENBQUE7QUFDeEMsT0FBQTtNQUVBLElBQUksSUFBSSxDQUFDaUQsa0JBQWtCLEVBQUU7UUFDekI0RyxPQUFPLENBQUM5SixJQUFJLENBQUM2SCxJQUFJLENBQUMsSUFBSSxDQUFDM0Usa0JBQWtCLENBQUMsQ0FBQTtBQUM5QyxPQUFBO0FBQ0osS0FBQyxNQUFNO0FBQ0gsTUFBQSxJQUFJMEcsUUFBUSxLQUFLbkksbUJBQW1CLElBQUltSSxRQUFRLEtBQUtNLG1CQUFtQixFQUFFO0FBQ3RFeEwsUUFBQUEsT0FBTyxHQUFHK0ssVUFBVSxDQUFDTyxXQUFXLEVBQUUsQ0FBQTtRQUNsQ3JMLE9BQU8sR0FBRzhLLFVBQVUsQ0FBQ1EsT0FBTyxDQUFBO0FBQzVCLFFBQUEsSUFBSSxDQUFDM0IsdUJBQXVCLENBQUN3QixPQUFPLENBQUM5SixJQUFJLEVBQUU4SixPQUFPLENBQUM3SixNQUFNLEVBQUV2QixPQUFPLEVBQUVDLE9BQU8sQ0FBQyxDQUFBO0FBQ2hGLE9BQUE7TUFFQSxJQUFJbUwsT0FBTyxDQUFDOUosSUFBSSxDQUFDQyxNQUFNLEtBQUs2SixPQUFPLENBQUM3SixNQUFNLEVBQUU7QUFDeEM2SixRQUFBQSxPQUFPLENBQUM5SixJQUFJLENBQUNDLE1BQU0sR0FBRzZKLE9BQU8sQ0FBQzdKLE1BQU0sQ0FBQTtBQUN4QyxPQUFBO01BRUE2SixPQUFPLENBQUM5SixJQUFJLENBQUM2SCxJQUFJLENBQUNySSxhQUFhLENBQUNvSyxRQUFRLENBQUMsQ0FBQyxDQUFBO0FBQzlDLEtBQUE7QUFDSixHQUFBO0FBQ0o7Ozs7In0=
