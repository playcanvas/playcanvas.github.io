/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug, DebugHelper } from '../core/debug.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { BoundingSphere } from '../core/shape/bounding-sphere.js';
import { BindGroup } from '../platform/graphics/bind-group.js';
import { UniformBuffer } from '../platform/graphics/uniform-buffer.js';
import { SORTKEY_FORWARD, MASK_AFFECT_DYNAMIC, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_TANGENTS, LAYER_WORLD, RENDERSTYLE_SOLID, SHADERDEF_NOSHADOW, SHADER_FORWARD, SHADER_FORWARDHDR, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_SCREENSPACE, BLEND_NORMAL, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT, BLEND_NONE, SHADERDEF_SKIN } from './constants.js';
import { GraphNode } from './graph-node.js';
import { getDefaultMaterial } from './materials/default-material.js';
import { LightmapCache } from './graphics/lightmap-cache.js';

const _tmpAabb = new BoundingBox();
const _tempBoneAabb = new BoundingBox();
const _tempSphere = new BoundingSphere();
const _meshSet = new Set();

/**
 * Internal data structure used to store data used by hardware instancing.
 *
 * @ignore
 */
class InstancingData {
  /** @type {import('../platform/graphics/vertex-buffer.js').VertexBuffer|null} */

  /**
   * @param {number} numObjects - The number of objects instanced.
   */
  constructor(numObjects) {
    this.vertexBuffer = null;
    this.count = numObjects;
  }
}
class Command {
  constructor(layer, blendType, command) {
    this._key = [];
    this._key[SORTKEY_FORWARD] = getKey(layer, blendType, true, 0);
    this.command = command;
  }
  set key(val) {
    this._key[SORTKEY_FORWARD] = val;
  }
  get key() {
    return this._key[SORTKEY_FORWARD];
  }
}

/**
 * Callback used by {@link Layer} to calculate the "sort distance" for a {@link MeshInstance},
 * which determines its place in the render order.
 *
 * @callback CalculateSortDistanceCallback
 * @param {MeshInstance} meshInstance - The mesh instance.
 * @param {import('../core/math/vec3.js').Vec3} cameraPosition - The position of the camera.
 * @param {import('../core/math/vec3.js').Vec3} cameraForward - The forward vector of the camera.
 */

/**
 * An instance of a {@link Mesh}. A single mesh can be referenced by many mesh instances that can
 * have different transforms and materials.
 */
class MeshInstance {
  /**
   * @type {import('./materials/material.js').Material}
   * @private
   */

  /**
   * An array of shaders used by the mesh instance, indexed by the shader pass constant (SHADER_FORWARD..)
   *
   * @type {Array<import('../platform/graphics/shader.js').Shader>}
   * @ignore
   */

  /**
   * An array of bind groups, storing uniforms per pass. This has 1:1 relation with the _shades array,
   * and is indexed by the shader pass constant as well.
   *
   * @type {Array<BindGroup>}
   * @ignore
   */

  /**
   * Create a new MeshInstance instance.
   *
   * @param {import('./mesh.js').Mesh} mesh - The graphics mesh to instance.
   * @param {import('./materials/material.js').Material} material - The material to use for this
   * mesh instance.
   * @param {GraphNode} [node] - The graph node defining the transform for this instance. This
   * parameter is optional when used with {@link RenderComponent} and will use the node the
   * component is attached to.
   * @example
   * // Create a mesh instance pointing to a 1x1x1 'cube' mesh
   * var mesh = pc.createBox(graphicsDevice);
   * var material = new pc.StandardMaterial();
   *
   * var meshInstance = new pc.MeshInstance(mesh, material);
   *
   * var entity = new pc.Entity();
   * entity.addComponent('render', {
   *     meshInstances: [meshInstance]
   * });
   *
   * // Add the entity to the scene hierarchy
   * this.app.scene.root.addChild(entity);
   */
  constructor(mesh, material, node = null) {
    this._material = void 0;
    this._shader = [];
    this._bindGroups = [];
    // if first parameter is of GraphNode type, handle previous constructor signature: (node, mesh, material)
    if (mesh instanceof GraphNode) {
      const temp = mesh;
      mesh = material;
      material = node;
      node = temp;
    }
    this._key = [0, 0];
    this.isStatic = false;
    this._staticLightList = null;
    this._staticSource = null;

    /**
     * The graph node defining the transform for this instance.
     *
     * @type {GraphNode}
     */
    this.node = node; // The node that defines the transform of the mesh instance
    this._mesh = mesh; // The mesh that this instance renders
    mesh.incRefCount();
    this.material = material; // The material with which to render this instance

    this._shaderDefs = MASK_AFFECT_DYNAMIC << 16; // 2 byte toggles, 2 bytes light mask; Default value is no toggles and mask = pc.MASK_AFFECT_DYNAMIC
    this._shaderDefs |= mesh.vertexBuffer.format.hasUv0 ? SHADERDEF_UV0 : 0;
    this._shaderDefs |= mesh.vertexBuffer.format.hasUv1 ? SHADERDEF_UV1 : 0;
    this._shaderDefs |= mesh.vertexBuffer.format.hasColor ? SHADERDEF_VCOLOR : 0;
    this._shaderDefs |= mesh.vertexBuffer.format.hasTangents ? SHADERDEF_TANGENTS : 0;
    this._lightHash = 0;

    // Render options
    /**
     * Enable rendering for this mesh instance. Use visible property to enable/disable
     * rendering without overhead of removing from scene. But note that the mesh instance is
     * still in the hierarchy and still in the draw call list.
     *
     * @type {boolean}
     */
    this.visible = true;
    this.layer = LAYER_WORLD; // legacy
    /** @private */
    this._renderStyle = RENDERSTYLE_SOLID;
    this.castShadow = false;
    this._receiveShadow = true;
    this._screenSpace = false;
    this._noDepthDrawGl1 = false;

    /**
     * Controls whether the mesh instance can be culled by frustum culling
     * ({@link CameraComponent#frustumCulling}).
     *
     * @type {boolean}
     */
    this.cull = true;

    /**
     * True if the mesh instance is pickable by the {@link Picker}. Defaults to true.
     *
     * @type {boolean}
     * @ignore
     */
    this.pick = true;
    this._updateAabb = true;
    this._updateAabbFunc = null;
    this._calculateSortDistance = null;

    // 64-bit integer key that defines render order of this mesh instance
    this.updateKey();

    /**
     * @type {import('./skin-instance.js').SkinInstance}
     * @private
     */
    this._skinInstance = null;
    /**
     * @type {import('./morph-instance.js').MorphInstance}
     * @private
     */
    this._morphInstance = null;
    this.instancingData = null;

    /**
     * @type {BoundingBox}
     * @private
     */
    this._customAabb = null;

    // World space AABB
    this.aabb = new BoundingBox();
    this._aabbVer = -1;

    /**
     * Use this value to affect rendering order of mesh instances. Only used when mesh
     * instances are added to a {@link Layer} with {@link Layer#opaqueSortMode} or
     * {@link Layer#transparentSortMode} (depending on the material) set to
     * {@link SORTMODE_MANUAL}.
     *
     * @type {number}
     */
    this.drawOrder = 0;

    /**
     * Read this value in {@link Layer#onPostCull} to determine if the object is actually going
     * to be rendered.
     *
     * @type {boolean}
     */
    this.visibleThisFrame = false;

    // custom function used to customize culling (e.g. for 2D UI elements)
    this.isVisibleFunc = null;
    this.parameters = {};
    this.stencilFront = null;
    this.stencilBack = null;

    // Negative scale batching support
    this.flipFaces = false;
  }

  /**
   * The render style of the mesh instance. Can be:
   *
   * - {@link RENDERSTYLE_SOLID}
   * - {@link RENDERSTYLE_WIREFRAME}
   * - {@link RENDERSTYLE_POINTS}
   *
   * Defaults to {@link RENDERSTYLE_SOLID}.
   *
   * @type {number}
   */
  set renderStyle(renderStyle) {
    this._renderStyle = renderStyle;
    this.mesh.prepareRenderState(renderStyle);
  }
  get renderStyle() {
    return this._renderStyle;
  }

  /**
   * The graphics mesh being instanced.
   *
   * @type {import('./mesh.js').Mesh}
   */
  set mesh(mesh) {
    if (mesh === this._mesh) return;
    if (this._mesh) {
      this._mesh.decRefCount();
    }
    this._mesh = mesh;
    if (mesh) {
      mesh.incRefCount();
    }
  }
  get mesh() {
    return this._mesh;
  }

  /**
   * The world space axis-aligned bounding box for this mesh instance.
   *
   * @type {BoundingBox}
   */
  set aabb(aabb) {
    this._aabb = aabb;
  }
  get aabb() {
    // use specified world space aabb
    if (!this._updateAabb) {
      return this._aabb;
    }

    // callback function returning world space aabb
    if (this._updateAabbFunc) {
      return this._updateAabbFunc(this._aabb);
    }

    // use local space override aabb if specified
    let localAabb = this._customAabb;
    let toWorldSpace = !!localAabb;

    // otherwise evaluate local aabb
    if (!localAabb) {
      localAabb = _tmpAabb;
      if (this.skinInstance) {
        // Initialize local bone AABBs if needed
        if (!this.mesh.boneAabb) {
          const morphTargets = this._morphInstance ? this._morphInstance.morph._targets : null;
          this.mesh._initBoneAabbs(morphTargets);
        }

        // evaluate local space bounds based on all active bones
        const boneUsed = this.mesh.boneUsed;
        let first = true;
        for (let i = 0; i < this.mesh.boneAabb.length; i++) {
          if (boneUsed[i]) {
            // transform bone AABB by bone matrix
            _tempBoneAabb.setFromTransformedAabb(this.mesh.boneAabb[i], this.skinInstance.matrices[i]);

            // add them up
            if (first) {
              first = false;
              localAabb.center.copy(_tempBoneAabb.center);
              localAabb.halfExtents.copy(_tempBoneAabb.halfExtents);
            } else {
              localAabb.add(_tempBoneAabb);
            }
          }
        }
        toWorldSpace = true;
      } else if (this.node._aabbVer !== this._aabbVer) {
        // local space bounding box - either from mesh or empty
        if (this.mesh) {
          localAabb.center.copy(this.mesh.aabb.center);
          localAabb.halfExtents.copy(this.mesh.aabb.halfExtents);
        } else {
          localAabb.center.set(0, 0, 0);
          localAabb.halfExtents.set(0, 0, 0);
        }

        // update local space bounding box by morph targets
        if (this.mesh && this.mesh.morph) {
          localAabb._expand(this.mesh.morph.aabb.getMin(), this.mesh.morph.aabb.getMax());
        }
        toWorldSpace = true;
        this._aabbVer = this.node._aabbVer;
      }
    }

    // store world space bounding box
    if (toWorldSpace) {
      this._aabb.setFromTransformedAabb(localAabb, this.node.getWorldTransform());
    }
    return this._aabb;
  }

  /**
   * Clear the internal shader array.
   *
   * @ignore
   */
  clearShaders() {
    const shaders = this._shader;
    for (let i = 0; i < shaders.length; i++) {
      shaders[i] = null;
    }
    this.destroyBindGroups();
  }
  destroyBindGroups() {
    const groups = this._bindGroups;
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group) {
        const uniformBuffer = group.defaultUniformBuffer;
        if (uniformBuffer) {
          uniformBuffer.destroy();
        }
        group.destroy();
      }
    }
    groups.length = 0;
  }

  /**
   * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} device - The
   * graphics device.
   * @param {number} pass - Shader pass number.
   * @returns {BindGroup} - The mesh bind group.
   * @ignore
   */
  getBindGroup(device, pass) {
    // create bind group
    let bindGroup = this._bindGroups[pass];
    if (!bindGroup) {
      const shader = this._shader[pass];
      Debug.assert(shader);

      // mesh uniform buffer
      const ubFormat = shader.meshUniformBufferFormat;
      Debug.assert(ubFormat);
      const uniformBuffer = new UniformBuffer(device, ubFormat);

      // mesh bind group
      const bingGroupFormat = shader.meshBindGroupFormat;
      Debug.assert(bingGroupFormat);
      bindGroup = new BindGroup(device, bingGroupFormat, uniformBuffer);
      DebugHelper.setName(bindGroup, `MeshBindGroup_${bindGroup.id}`);
      this._bindGroups[pass] = bindGroup;
    }
    return bindGroup;
  }

  /**
   * The material used by this mesh instance.
   *
   * @type {import('./materials/material.js').Material}
   */
  set material(material) {
    this.clearShaders();
    const prevMat = this._material;

    // Remove the material's reference to this mesh instance
    if (prevMat) {
      prevMat.removeMeshInstanceRef(this);
    }
    this._material = material;
    if (material) {
      // Record that the material is referenced by this mesh instance
      material.addMeshInstanceRef(this);
      this.updateKey();

      // if blend type of the material changes
      const prevBlend = prevMat && prevMat.transparent;
      if (material.transparent !== prevBlend) {
        const scene = this._material._scene || (prevMat == null ? void 0 : prevMat._scene);
        if (scene) {
          scene.layers._dirtyBlend = true;
        } else {
          material._dirtyBlend = true;
        }
      }
    }
  }
  get material() {
    return this._material;
  }
  set layer(layer) {
    this._layer = layer;
    this.updateKey();
  }
  get layer() {
    return this._layer;
  }

  /**
   * In some circumstances mesh instances are sorted by a distance calculation to determine their
   * rendering order. Set this callback to override the default distance calculation, which gives
   * the dot product of the camera forward vector and the vector between the camera position and
   * the center of the mesh instance's axis-aligned bounding box. This option can be particularly
   * useful for rendering transparent meshes in a better order than default.
   *
   * @type {CalculateSortDistanceCallback}
   */
  set calculateSortDistance(calculateSortDistance) {
    this._calculateSortDistance = calculateSortDistance;
  }
  get calculateSortDistance() {
    return this._calculateSortDistance;
  }
  set receiveShadow(val) {
    this._receiveShadow = val;
    this._shaderDefs = val ? this._shaderDefs & ~SHADERDEF_NOSHADOW : this._shaderDefs | SHADERDEF_NOSHADOW;
    this._shader[SHADER_FORWARD] = null;
    this._shader[SHADER_FORWARDHDR] = null;
  }
  get receiveShadow() {
    return this._receiveShadow;
  }

  /**
   * The skin instance managing skinning of this mesh instance, or null if skinning is not used.
   *
   * @type {import('./skin-instance.js').SkinInstance}
   */
  set skinInstance(val) {
    this._skinInstance = val;
    let shaderDefs = this._shaderDefs;
    shaderDefs = val ? shaderDefs | SHADERDEF_SKIN : shaderDefs & ~SHADERDEF_SKIN;

    // if shaderDefs have changed
    if (shaderDefs !== this._shaderDefs) {
      this._shaderDefs = shaderDefs;
      this.clearShaders();
    }
    this._setupSkinUpdate();
  }
  get skinInstance() {
    return this._skinInstance;
  }

  /**
   * The morph instance managing morphing of this mesh instance, or null if morphing is not used.
   *
   * @type {import('./morph-instance.js').MorphInstance}
   */
  set morphInstance(val) {
    var _this$_morphInstance;
    // release existing
    (_this$_morphInstance = this._morphInstance) == null ? void 0 : _this$_morphInstance.destroy();

    // assign new
    this._morphInstance = val;
    let shaderDefs = this._shaderDefs;
    shaderDefs = val && val.morph.useTextureMorph ? shaderDefs | SHADERDEF_MORPH_TEXTURE_BASED : shaderDefs & ~SHADERDEF_MORPH_TEXTURE_BASED;
    shaderDefs = val && val.morph.morphPositions ? shaderDefs | SHADERDEF_MORPH_POSITION : shaderDefs & ~SHADERDEF_MORPH_POSITION;
    shaderDefs = val && val.morph.morphNormals ? shaderDefs | SHADERDEF_MORPH_NORMAL : shaderDefs & ~SHADERDEF_MORPH_NORMAL;

    // if shaderDefs have changed
    if (shaderDefs !== this._shaderDefs) {
      this._shaderDefs = shaderDefs;
      this.clearShaders();
    }
  }
  get morphInstance() {
    return this._morphInstance;
  }
  set screenSpace(val) {
    this._screenSpace = val;
    this._shaderDefs = val ? this._shaderDefs | SHADERDEF_SCREENSPACE : this._shaderDefs & ~SHADERDEF_SCREENSPACE;
    this._shader[SHADER_FORWARD] = null;
  }
  get screenSpace() {
    return this._screenSpace;
  }
  set key(val) {
    this._key[SORTKEY_FORWARD] = val;
  }
  get key() {
    return this._key[SORTKEY_FORWARD];
  }

  /**
   * Mask controlling which {@link LightComponent}s light this mesh instance, which
   * {@link CameraComponent} sees it and in which {@link Layer} it is rendered. Defaults to 1.
   *
   * @type {number}
   */
  set mask(val) {
    const toggles = this._shaderDefs & 0x0000FFFF;
    this._shaderDefs = toggles | val << 16;
    this._shader[SHADER_FORWARD] = null;
    this._shader[SHADER_FORWARDHDR] = null;
  }
  get mask() {
    return this._shaderDefs >> 16;
  }

  /**
   * Number of instances when using hardware instancing to render the mesh.
   *
   * @type {number}
   */
  set instancingCount(value) {
    if (this.instancingData) this.instancingData.count = value;
  }
  get instancingCount() {
    return this.instancingData ? this.instancingData.count : 0;
  }
  destroy() {
    var _this$_skinInstance, _this$morphInstance;
    const mesh = this.mesh;
    if (mesh) {
      // this decreases ref count on the mesh
      this.mesh = null;

      // destroy mesh
      if (mesh.refCount < 1) {
        mesh.destroy();
      }
    }

    // release ref counted lightmaps
    this.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], null);
    this.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], null);
    (_this$_skinInstance = this._skinInstance) == null ? void 0 : _this$_skinInstance.destroy();
    this._skinInstance = null;
    (_this$morphInstance = this.morphInstance) == null ? void 0 : _this$morphInstance.destroy();
    this.morphInstance = null;
    this.clearShaders();

    // make sure material clears references to this meshInstance
    this.material = null;
  }

  // shader uniform names for lightmaps

  // generates wireframes for an array of mesh instances
  static _prepareRenderStyleForArray(meshInstances, renderStyle) {
    if (meshInstances) {
      for (let i = 0; i < meshInstances.length; i++) {
        // switch mesh instance to the requested style
        meshInstances[i]._renderStyle = renderStyle;

        // process all unique meshes
        const mesh = meshInstances[i].mesh;
        if (!_meshSet.has(mesh)) {
          _meshSet.add(mesh);
          mesh.prepareRenderState(renderStyle);
        }
      }
      _meshSet.clear();
    }
  }

  // test if meshInstance is visible by camera. It requires the frustum of the camera to be up to date, which forward-renderer
  // takes care of. This function should  not be called elsewhere.
  _isVisible(camera) {
    if (this.visible) {
      // custom visibility method of MeshInstance
      if (this.isVisibleFunc) {
        return this.isVisibleFunc(camera);
      }
      _tempSphere.center = this.aabb.center; // this line evaluates aabb
      _tempSphere.radius = this._aabb.halfExtents.length();
      return camera.frustum.containsSphere(_tempSphere);
    }
    return false;
  }
  updateKey() {
    const material = this.material;
    this._key[SORTKEY_FORWARD] = getKey(this.layer, material.alphaToCoverage || material.alphaTest ? BLEND_NORMAL : material.blendType,
    // render alphatest/atoc after opaque
    false, material.id);
  }

  /**
   * Sets up {@link MeshInstance} to be rendered using Hardware Instancing.
   *
   * @param {import('../platform/graphics/vertex-buffer.js').VertexBuffer|null} vertexBuffer - Vertex buffer to hold per-instance vertex data
   * (usually world matrices). Pass null to turn off hardware instancing.
   */
  setInstancing(vertexBuffer) {
    if (vertexBuffer) {
      this.instancingData = new InstancingData(vertexBuffer.numVertices);
      this.instancingData.vertexBuffer = vertexBuffer;

      // mark vertex buffer as instancing data
      vertexBuffer.format.instancing = true;

      // turn off culling - we do not do per-instance culling, all instances are submitted to GPU
      this.cull = false;
    } else {
      this.instancingData = null;
      this.cull = true;
    }
  }

  /**
   * Obtain a shader variant required to render the mesh instance within specified pass.
   *
   * @param {import('./scene.js').Scene} scene - The scene.
   * @param {number} pass - The render pass.
   * @param {any} staticLightList - List of static lights.
   * @param {any} sortedLights - Array of arrays of lights.
   * @param {import('../platform/graphics/uniform-buffer-format.js').UniformBufferFormat} viewUniformFormat - The
   * format of the view uniform buffer.
   * @param {import('../platform/graphics/bind-group-format.js').BindGroupFormat} viewBindGroupFormat - The
   * format of the view bind group.
   * @ignore
   */
  updatePassShader(scene, pass, staticLightList, sortedLights, viewUniformFormat, viewBindGroupFormat) {
    this._shader[pass] = this.material.getShaderVariant(this.mesh.device, scene, this._shaderDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat);
  }
  ensureMaterial(device) {
    if (!this.material) {
      Debug.warn(`Mesh attached to entity '${this.node.name}' does not have a material, using a default one.`);
      this.material = getDefaultMaterial(device);
    }
  }

  // Parameter management
  clearParameters() {
    this.parameters = {};
  }
  getParameters() {
    return this.parameters;
  }

  /**
   * Retrieves the specified shader parameter from a mesh instance.
   *
   * @param {string} name - The name of the parameter to query.
   * @returns {object} The named parameter.
   */
  getParameter(name) {
    return this.parameters[name];
  }

  /**
   * Sets a shader parameter on a mesh instance. Note that this parameter will take precedence
   * over parameter of the same name if set on Material this mesh instance uses for rendering.
   *
   * @param {string} name - The name of the parameter to set.
   * @param {number|number[]|import('../platform/graphics/texture.js').Texture} data - The value
   * for the specified parameter.
   * @param {number} [passFlags] - Mask describing which passes the material should be included
   * in.
   */
  setParameter(name, data, passFlags = -262141) {
    // note on -262141: All bits set except 2 - 19 range

    if (data === undefined && typeof name === 'object') {
      const uniformObject = name;
      if (uniformObject.length) {
        for (let i = 0; i < uniformObject.length; i++) {
          this.setParameter(uniformObject[i]);
        }
        return;
      }
      name = uniformObject.name;
      data = uniformObject.value;
    }
    const param = this.parameters[name];
    if (param) {
      param.data = data;
      param.passFlags = passFlags;
    } else {
      this.parameters[name] = {
        scopeId: null,
        data: data,
        passFlags: passFlags
      };
    }
  }

  // a wrapper over settings parameter specifically for realtime baked lightmaps. This handles reference counting of lightmaps
  // and releases them when no longer referenced
  setRealtimeLightmap(name, texture) {
    // no change
    const old = this.getParameter(name);
    if (old === texture) return;

    // remove old
    if (old) {
      LightmapCache.decRef(old.data);
    }

    // assign new
    if (texture) {
      LightmapCache.incRef(texture);
      this.setParameter(name, texture);
    } else {
      this.deleteParameter(name);
    }
  }

  /**
   * Deletes a shader parameter on a mesh instance.
   *
   * @param {string} name - The name of the parameter to delete.
   */
  deleteParameter(name) {
    if (this.parameters[name]) {
      delete this.parameters[name];
    }
  }

  // used to apply parameters from this mesh instance into scope of uniforms, called internally by forward-renderer
  setParameters(device, passFlag) {
    const parameters = this.parameters;
    for (const paramName in parameters) {
      const parameter = parameters[paramName];
      if (parameter.passFlags & passFlag) {
        if (!parameter.scopeId) {
          parameter.scopeId = device.scope.resolve(paramName);
        }
        parameter.scopeId.setValue(parameter.data);
      }
    }
  }
  setLightmapped(value) {
    if (value) {
      this.mask = (this.mask | MASK_AFFECT_LIGHTMAPPED) & ~(MASK_AFFECT_DYNAMIC | MASK_BAKE);
    } else {
      this.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], null);
      this.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], null);
      this._shaderDefs &= ~(SHADERDEF_LM | SHADERDEF_DIRLM | SHADERDEF_LMAMBIENT);
      this.mask = (this.mask | MASK_AFFECT_DYNAMIC) & ~(MASK_AFFECT_LIGHTMAPPED | MASK_BAKE);
    }
  }
  setCustomAabb(aabb) {
    if (aabb) {
      // store the override aabb
      if (this._customAabb) {
        this._customAabb.copy(aabb);
      } else {
        this._customAabb = aabb.clone();
      }
    } else {
      // no override, force refresh the actual one
      this._customAabb = null;
      this._aabbVer = -1;
    }
    this._setupSkinUpdate();
  }
  _setupSkinUpdate() {
    // set if bones need to be updated before culling
    if (this._skinInstance) {
      this._skinInstance._updateBeforeCull = !this._customAabb;
    }
  }
}
MeshInstance.lightmapParamNames = ['texture_lightMap', 'texture_dirLightMap'];
function getKey(layer, blendType, isCommand, materialId) {
  // Key definition:
  // Bit
  // 31      : sign bit (leave)
  // 27 - 30 : layer
  // 26      : translucency type (opaque/transparent)
  // 25      : Command bit (1: this key is for a command, 0: it's a mesh instance)
  // 0 - 24  : Material ID (if opaque) or 0 (if transparent - will be depth)
  return (layer & 0x0f) << 27 | (blendType === BLEND_NONE ? 1 : 0) << 26 | (isCommand ? 1 : 0) << 25 | (materialId & 0x1ffffff) << 0;
}

export { Command, MeshInstance };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC1pbnN0YW5jZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL21lc2gtaW5zdGFuY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5cbmltcG9ydCB7IEJpbmRHcm91cCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORF9OT05FLCBCTEVORF9OT1JNQUwsXG4gICAgTEFZRVJfV09STEQsXG4gICAgTUFTS19BRkZFQ1RfRFlOQU1JQywgTUFTS19CQUtFLCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCxcbiAgICBSRU5ERVJTVFlMRV9TT0xJRCxcbiAgICBTSEFERVJfRk9SV0FSRCwgU0hBREVSX0ZPUldBUkRIRFIsXG4gICAgU0hBREVSREVGX1VWMCwgU0hBREVSREVGX1VWMSwgU0hBREVSREVGX1ZDT0xPUiwgU0hBREVSREVGX1RBTkdFTlRTLCBTSEFERVJERUZfTk9TSEFET1csIFNIQURFUkRFRl9TS0lOLFxuICAgIFNIQURFUkRFRl9TQ1JFRU5TUEFDRSwgU0hBREVSREVGX01PUlBIX1BPU0lUSU9OLCBTSEFERVJERUZfTU9SUEhfTk9STUFMLCBTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCxcbiAgICBTSEFERVJERUZfTE0sIFNIQURFUkRFRl9ESVJMTSwgU0hBREVSREVGX0xNQU1CSUVOVCxcbiAgICBTT1JUS0VZX0ZPUldBUkRcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdE1hdGVyaWFsIH0gZnJvbSAnLi9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBMaWdodG1hcENhY2hlIH0gZnJvbSAnLi9ncmFwaGljcy9saWdodG1hcC1jYWNoZS5qcyc7XG5cbmNvbnN0IF90bXBBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcEJvbmVBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX21lc2hTZXQgPSBuZXcgU2V0KCk7XG5cbi8qKlxuICogSW50ZXJuYWwgZGF0YSBzdHJ1Y3R1cmUgdXNlZCB0byBzdG9yZSBkYXRhIHVzZWQgYnkgaGFyZHdhcmUgaW5zdGFuY2luZy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEluc3RhbmNpbmdEYXRhIHtcbiAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcnxudWxsfSAqL1xuICAgIHZlcnRleEJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtT2JqZWN0cyAtIFRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbnN0YW5jZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobnVtT2JqZWN0cykge1xuICAgICAgICB0aGlzLmNvdW50ID0gbnVtT2JqZWN0cztcbiAgICB9XG59XG5cbmNsYXNzIENvbW1hbmQge1xuICAgIGNvbnN0cnVjdG9yKGxheWVyLCBibGVuZFR5cGUsIGNvbW1hbmQpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0gW107XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gZ2V0S2V5KGxheWVyLCBibGVuZFR5cGUsIHRydWUsIDApO1xuICAgICAgICB0aGlzLmNvbW1hbmQgPSBjb21tYW5kO1xuICAgIH1cblxuICAgIHNldCBrZXkodmFsKSB7XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gdmFsO1xuICAgIH1cblxuICAgIGdldCBrZXkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgTGF5ZXJ9IHRvIGNhbGN1bGF0ZSB0aGUgXCJzb3J0IGRpc3RhbmNlXCIgZm9yIGEge0BsaW5rIE1lc2hJbnN0YW5jZX0sXG4gKiB3aGljaCBkZXRlcm1pbmVzIGl0cyBwbGFjZSBpbiB0aGUgcmVuZGVyIG9yZGVyLlxuICpcbiAqIEBjYWxsYmFjayBDYWxjdWxhdGVTb3J0RGlzdGFuY2VDYWxsYmFja1xuICogQHBhcmFtIHtNZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlLlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gY2FtZXJhUG9zaXRpb24gLSBUaGUgcG9zaXRpb24gb2YgdGhlIGNhbWVyYS5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IGNhbWVyYUZvcndhcmQgLSBUaGUgZm9yd2FyZCB2ZWN0b3Igb2YgdGhlIGNhbWVyYS5cbiAqL1xuXG4vKipcbiAqIEFuIGluc3RhbmNlIG9mIGEge0BsaW5rIE1lc2h9LiBBIHNpbmdsZSBtZXNoIGNhbiBiZSByZWZlcmVuY2VkIGJ5IG1hbnkgbWVzaCBpbnN0YW5jZXMgdGhhdCBjYW5cbiAqIGhhdmUgZGlmZmVyZW50IHRyYW5zZm9ybXMgYW5kIG1hdGVyaWFscy5cbiAqL1xuY2xhc3MgTWVzaEluc3RhbmNlIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hdGVyaWFsO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2Ygc2hhZGVycyB1c2VkIGJ5IHRoZSBtZXNoIGluc3RhbmNlLCBpbmRleGVkIGJ5IHRoZSBzaGFkZXIgcGFzcyBjb25zdGFudCAoU0hBREVSX0ZPUldBUkQuLilcbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcycpLlNoYWRlcj59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9zaGFkZXIgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGJpbmQgZ3JvdXBzLCBzdG9yaW5nIHVuaWZvcm1zIHBlciBwYXNzLiBUaGlzIGhhcyAxOjEgcmVsYXRpb24gd2l0aCB0aGUgX3NoYWRlcyBhcnJheSxcbiAgICAgKiBhbmQgaXMgaW5kZXhlZCBieSB0aGUgc2hhZGVyIHBhc3MgY29uc3RhbnQgYXMgd2VsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxCaW5kR3JvdXA+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfYmluZEdyb3VwcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1lc2hJbnN0YW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2guanMnKS5NZXNofSBtZXNoIC0gVGhlIGdyYXBoaWNzIG1lc2ggdG8gaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSBmb3IgdGhpc1xuICAgICAqIG1lc2ggaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IFtub2RlXSAtIFRoZSBncmFwaCBub2RlIGRlZmluaW5nIHRoZSB0cmFuc2Zvcm0gZm9yIHRoaXMgaW5zdGFuY2UuIFRoaXNcbiAgICAgKiBwYXJhbWV0ZXIgaXMgb3B0aW9uYWwgd2hlbiB1c2VkIHdpdGgge0BsaW5rIFJlbmRlckNvbXBvbmVudH0gYW5kIHdpbGwgdXNlIHRoZSBub2RlIHRoZVxuICAgICAqIGNvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG1lc2ggaW5zdGFuY2UgcG9pbnRpbmcgdG8gYSAxeDF4MSAnY3ViZScgbWVzaFxuICAgICAqIHZhciBtZXNoID0gcGMuY3JlYXRlQm94KGdyYXBoaWNzRGV2aWNlKTtcbiAgICAgKiB2YXIgbWF0ZXJpYWwgPSBuZXcgcGMuU3RhbmRhcmRNYXRlcmlhbCgpO1xuICAgICAqXG4gICAgICogdmFyIG1lc2hJbnN0YW5jZSA9IG5ldyBwYy5NZXNoSW5zdGFuY2UobWVzaCwgbWF0ZXJpYWwpO1xuICAgICAqXG4gICAgICogdmFyIGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAgICAgKiBlbnRpdHkuYWRkQ29tcG9uZW50KCdyZW5kZXInLCB7XG4gICAgICogICAgIG1lc2hJbnN0YW5jZXM6IFttZXNoSW5zdGFuY2VdXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBBZGQgdGhlIGVudGl0eSB0byB0aGUgc2NlbmUgaGllcmFyY2h5XG4gICAgICogdGhpcy5hcHAuc2NlbmUucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1lc2gsIG1hdGVyaWFsLCBub2RlID0gbnVsbCkge1xuICAgICAgICAvLyBpZiBmaXJzdCBwYXJhbWV0ZXIgaXMgb2YgR3JhcGhOb2RlIHR5cGUsIGhhbmRsZSBwcmV2aW91cyBjb25zdHJ1Y3RvciBzaWduYXR1cmU6IChub2RlLCBtZXNoLCBtYXRlcmlhbClcbiAgICAgICAgaWYgKG1lc2ggaW5zdGFuY2VvZiBHcmFwaE5vZGUpIHtcbiAgICAgICAgICAgIGNvbnN0IHRlbXAgPSBtZXNoO1xuICAgICAgICAgICAgbWVzaCA9IG1hdGVyaWFsO1xuICAgICAgICAgICAgbWF0ZXJpYWwgPSBub2RlO1xuICAgICAgICAgICAgbm9kZSA9IHRlbXA7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9rZXkgPSBbMCwgMF07XG5cbiAgICAgICAgdGhpcy5pc1N0YXRpYyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zdGF0aWNMaWdodExpc3QgPSBudWxsO1xuICAgICAgICB0aGlzLl9zdGF0aWNTb3VyY2UgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZ3JhcGggbm9kZSBkZWZpbmluZyB0aGUgdHJhbnNmb3JtIGZvciB0aGlzIGluc3RhbmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ub2RlID0gbm9kZTsgICAgICAgICAgIC8vIFRoZSBub2RlIHRoYXQgZGVmaW5lcyB0aGUgdHJhbnNmb3JtIG9mIHRoZSBtZXNoIGluc3RhbmNlXG4gICAgICAgIHRoaXMuX21lc2ggPSBtZXNoOyAgICAgICAgICAvLyBUaGUgbWVzaCB0aGF0IHRoaXMgaW5zdGFuY2UgcmVuZGVyc1xuICAgICAgICBtZXNoLmluY1JlZkNvdW50KCk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBtYXRlcmlhbDsgICAvLyBUaGUgbWF0ZXJpYWwgd2l0aCB3aGljaCB0byByZW5kZXIgdGhpcyBpbnN0YW5jZVxuXG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBNQVNLX0FGRkVDVF9EWU5BTUlDIDw8IDE2OyAvLyAyIGJ5dGUgdG9nZ2xlcywgMiBieXRlcyBsaWdodCBtYXNrOyBEZWZhdWx0IHZhbHVlIGlzIG5vIHRvZ2dsZXMgYW5kIG1hc2sgPSBwYy5NQVNLX0FGRkVDVF9EWU5BTUlDXG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgfD0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc1V2MCA/IFNIQURFUkRFRl9VVjAgOiAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzIHw9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNVdjEgPyBTSEFERVJERUZfVVYxIDogMDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzQ29sb3IgPyBTSEFERVJERUZfVkNPTE9SIDogMDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzVGFuZ2VudHMgPyBTSEFERVJERUZfVEFOR0VOVFMgOiAwO1xuXG4gICAgICAgIHRoaXMuX2xpZ2h0SGFzaCA9IDA7XG5cbiAgICAgICAgLy8gUmVuZGVyIG9wdGlvbnNcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEVuYWJsZSByZW5kZXJpbmcgZm9yIHRoaXMgbWVzaCBpbnN0YW5jZS4gVXNlIHZpc2libGUgcHJvcGVydHkgdG8gZW5hYmxlL2Rpc2FibGVcbiAgICAgICAgICogcmVuZGVyaW5nIHdpdGhvdXQgb3ZlcmhlYWQgb2YgcmVtb3ZpbmcgZnJvbSBzY2VuZS4gQnV0IG5vdGUgdGhhdCB0aGUgbWVzaCBpbnN0YW5jZSBpc1xuICAgICAgICAgKiBzdGlsbCBpbiB0aGUgaGllcmFyY2h5IGFuZCBzdGlsbCBpbiB0aGUgZHJhdyBjYWxsIGxpc3QuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5sYXllciA9IExBWUVSX1dPUkxEOyAvLyBsZWdhY3lcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3JlbmRlclN0eWxlID0gUkVOREVSU1RZTEVfU09MSUQ7XG4gICAgICAgIHRoaXMuY2FzdFNoYWRvdyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9yZWNlaXZlU2hhZG93ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fc2NyZWVuU3BhY2UgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fbm9EZXB0aERyYXdHbDEgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29udHJvbHMgd2hldGhlciB0aGUgbWVzaCBpbnN0YW5jZSBjYW4gYmUgY3VsbGVkIGJ5IGZydXN0dW0gY3VsbGluZ1xuICAgICAgICAgKiAoe0BsaW5rIENhbWVyYUNvbXBvbmVudCNmcnVzdHVtQ3VsbGluZ30pLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY3VsbCA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRydWUgaWYgdGhlIG1lc2ggaW5zdGFuY2UgaXMgcGlja2FibGUgYnkgdGhlIHtAbGluayBQaWNrZXJ9LiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5waWNrID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl91cGRhdGVBYWJiID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fdXBkYXRlQWFiYkZ1bmMgPSBudWxsO1xuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTb3J0RGlzdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIC8vIDY0LWJpdCBpbnRlZ2VyIGtleSB0aGF0IGRlZmluZXMgcmVuZGVyIG9yZGVyIG9mIHRoaXMgbWVzaCBpbnN0YW5jZVxuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3NraW4taW5zdGFuY2UuanMnKS5Ta2luSW5zdGFuY2V9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9tb3JwaC1pbnN0YW5jZS5qcycpLk1vcnBoSW5zdGFuY2V9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9tb3JwaEluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0JvdW5kaW5nQm94fVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IG51bGw7XG5cbiAgICAgICAgLy8gV29ybGQgc3BhY2UgQUFCQlxuICAgICAgICB0aGlzLmFhYmIgPSBuZXcgQm91bmRpbmdCb3goKTtcbiAgICAgICAgdGhpcy5fYWFiYlZlciA9IC0xO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVc2UgdGhpcyB2YWx1ZSB0byBhZmZlY3QgcmVuZGVyaW5nIG9yZGVyIG9mIG1lc2ggaW5zdGFuY2VzLiBPbmx5IHVzZWQgd2hlbiBtZXNoXG4gICAgICAgICAqIGluc3RhbmNlcyBhcmUgYWRkZWQgdG8gYSB7QGxpbmsgTGF5ZXJ9IHdpdGgge0BsaW5rIExheWVyI29wYXF1ZVNvcnRNb2RlfSBvclxuICAgICAgICAgKiB7QGxpbmsgTGF5ZXIjdHJhbnNwYXJlbnRTb3J0TW9kZX0gKGRlcGVuZGluZyBvbiB0aGUgbWF0ZXJpYWwpIHNldCB0b1xuICAgICAgICAgKiB7QGxpbmsgU09SVE1PREVfTUFOVUFMfS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZHJhd09yZGVyID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVhZCB0aGlzIHZhbHVlIGluIHtAbGluayBMYXllciNvblBvc3RDdWxsfSB0byBkZXRlcm1pbmUgaWYgdGhlIG9iamVjdCBpcyBhY3R1YWxseSBnb2luZ1xuICAgICAgICAgKiB0byBiZSByZW5kZXJlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnZpc2libGVUaGlzRnJhbWUgPSBmYWxzZTtcblxuICAgICAgICAvLyBjdXN0b20gZnVuY3Rpb24gdXNlZCB0byBjdXN0b21pemUgY3VsbGluZyAoZS5nLiBmb3IgMkQgVUkgZWxlbWVudHMpXG4gICAgICAgIHRoaXMuaXNWaXNpYmxlRnVuYyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5wYXJhbWV0ZXJzID0ge307XG5cbiAgICAgICAgdGhpcy5zdGVuY2lsRnJvbnQgPSBudWxsO1xuICAgICAgICB0aGlzLnN0ZW5jaWxCYWNrID0gbnVsbDtcblxuICAgICAgICAvLyBOZWdhdGl2ZSBzY2FsZSBiYXRjaGluZyBzdXBwb3J0XG4gICAgICAgIHRoaXMuZmxpcEZhY2VzID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbmRlciBzdHlsZSBvZiB0aGUgbWVzaCBpbnN0YW5jZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfU09MSUR9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfV0lSRUZSQU1FfVxuICAgICAqIC0ge0BsaW5rIFJFTkRFUlNUWUxFX1BPSU5UU31cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByZW5kZXJTdHlsZShyZW5kZXJTdHlsZSkge1xuICAgICAgICB0aGlzLl9yZW5kZXJTdHlsZSA9IHJlbmRlclN0eWxlO1xuICAgICAgICB0aGlzLm1lc2gucHJlcGFyZVJlbmRlclN0YXRlKHJlbmRlclN0eWxlKTtcbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU3R5bGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJTdHlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZ3JhcGhpY3MgbWVzaCBiZWluZyBpbnN0YW5jZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21lc2guanMnKS5NZXNofVxuICAgICAqL1xuICAgIHNldCBtZXNoKG1lc2gpIHtcblxuICAgICAgICBpZiAobWVzaCA9PT0gdGhpcy5fbWVzaClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaCkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaC5kZWNSZWZDb3VudCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWVzaCA9IG1lc2g7XG5cbiAgICAgICAgaWYgKG1lc2gpIHtcbiAgICAgICAgICAgIG1lc2guaW5jUmVmQ291bnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtZXNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWVzaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd29ybGQgc3BhY2UgYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveCBmb3IgdGhpcyBtZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0JvdW5kaW5nQm94fVxuICAgICAqL1xuICAgIHNldCBhYWJiKGFhYmIpIHtcbiAgICAgICAgdGhpcy5fYWFiYiA9IGFhYmI7XG4gICAgfVxuXG4gICAgZ2V0IGFhYmIoKSB7XG4gICAgICAgIC8vIHVzZSBzcGVjaWZpZWQgd29ybGQgc3BhY2UgYWFiYlxuICAgICAgICBpZiAoIXRoaXMuX3VwZGF0ZUFhYmIpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9hYWJiO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsbGJhY2sgZnVuY3Rpb24gcmV0dXJuaW5nIHdvcmxkIHNwYWNlIGFhYmJcbiAgICAgICAgaWYgKHRoaXMuX3VwZGF0ZUFhYmJGdW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlQWFiYkZ1bmModGhpcy5fYWFiYik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1c2UgbG9jYWwgc3BhY2Ugb3ZlcnJpZGUgYWFiYiBpZiBzcGVjaWZpZWRcbiAgICAgICAgbGV0IGxvY2FsQWFiYiA9IHRoaXMuX2N1c3RvbUFhYmI7XG4gICAgICAgIGxldCB0b1dvcmxkU3BhY2UgPSAhIWxvY2FsQWFiYjtcblxuICAgICAgICAvLyBvdGhlcndpc2UgZXZhbHVhdGUgbG9jYWwgYWFiYlxuICAgICAgICBpZiAoIWxvY2FsQWFiYikge1xuXG4gICAgICAgICAgICBsb2NhbEFhYmIgPSBfdG1wQWFiYjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc2tpbkluc3RhbmNlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBJbml0aWFsaXplIGxvY2FsIGJvbmUgQUFCQnMgaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm1lc2guYm9uZUFhYmIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRzID0gdGhpcy5fbW9ycGhJbnN0YW5jZSA/IHRoaXMuX21vcnBoSW5zdGFuY2UubW9ycGguX3RhcmdldHMgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1lc2guX2luaXRCb25lQWFiYnMobW9ycGhUYXJnZXRzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBldmFsdWF0ZSBsb2NhbCBzcGFjZSBib3VuZHMgYmFzZWQgb24gYWxsIGFjdGl2ZSBib25lc1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVVc2VkID0gdGhpcy5tZXNoLmJvbmVVc2VkO1xuICAgICAgICAgICAgICAgIGxldCBmaXJzdCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWVzaC5ib25lQWFiYi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYm9uZVVzZWRbaV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIGJvbmUgQUFCQiBieSBib25lIG1hdHJpeFxuICAgICAgICAgICAgICAgICAgICAgICAgX3RlbXBCb25lQWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKHRoaXMubWVzaC5ib25lQWFiYltpXSwgdGhpcy5za2luSW5zdGFuY2UubWF0cmljZXNbaV0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdGhlbSB1cFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpcnN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuY2VudGVyLmNvcHkoX3RlbXBCb25lQWFiYi5jZW50ZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5jb3B5KF90ZW1wQm9uZUFhYmIuaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuYWRkKF90ZW1wQm9uZUFhYmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdG9Xb3JsZFNwYWNlID0gdHJ1ZTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm5vZGUuX2FhYmJWZXIgIT09IHRoaXMuX2FhYmJWZXIpIHtcblxuICAgICAgICAgICAgICAgIC8vIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCAtIGVpdGhlciBmcm9tIG1lc2ggb3IgZW1wdHlcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5jZW50ZXIuY29weSh0aGlzLm1lc2guYWFiYi5jZW50ZXIpO1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuaGFsZkV4dGVudHMuY29weSh0aGlzLm1lc2guYWFiYi5oYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmNlbnRlci5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCBieSBtb3JwaCB0YXJnZXRzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubWVzaCAmJiB0aGlzLm1lc2gubW9ycGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLl9leHBhbmQodGhpcy5tZXNoLm1vcnBoLmFhYmIuZ2V0TWluKCksIHRoaXMubWVzaC5tb3JwaC5hYWJiLmdldE1heCgpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0b1dvcmxkU3BhY2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FhYmJWZXIgPSB0aGlzLm5vZGUuX2FhYmJWZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdG9yZSB3b3JsZCBzcGFjZSBib3VuZGluZyBib3hcbiAgICAgICAgaWYgKHRvV29ybGRTcGFjZSkge1xuICAgICAgICAgICAgdGhpcy5fYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGxvY2FsQWFiYiwgdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FhYmI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgdGhlIGludGVybmFsIHNoYWRlciBhcnJheS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjbGVhclNoYWRlcnMoKSB7XG4gICAgICAgIGNvbnN0IHNoYWRlcnMgPSB0aGlzLl9zaGFkZXI7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2hhZGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc2hhZGVyc1tpXSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRlc3Ryb3lCaW5kR3JvdXBzKCk7XG4gICAgfVxuXG4gICAgZGVzdHJveUJpbmRHcm91cHMoKSB7XG5cbiAgICAgICAgY29uc3QgZ3JvdXBzID0gdGhpcy5fYmluZEdyb3VwcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBncm91cHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gZ3JvdXBzW2ldO1xuICAgICAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5pZm9ybUJ1ZmZlciA9IGdyb3VwLmRlZmF1bHRVbmlmb3JtQnVmZmVyO1xuICAgICAgICAgICAgICAgIGlmICh1bmlmb3JtQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVuaWZvcm1CdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBncm91cC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHBhc3MgLSBTaGFkZXIgcGFzcyBudW1iZXIuXG4gICAgICogQHJldHVybnMge0JpbmRHcm91cH0gLSBUaGUgbWVzaCBiaW5kIGdyb3VwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRCaW5kR3JvdXAoZGV2aWNlLCBwYXNzKSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIGJpbmQgZ3JvdXBcbiAgICAgICAgbGV0IGJpbmRHcm91cCA9IHRoaXMuX2JpbmRHcm91cHNbcGFzc107XG4gICAgICAgIGlmICghYmluZEdyb3VwKSB7XG4gICAgICAgICAgICBjb25zdCBzaGFkZXIgPSB0aGlzLl9zaGFkZXJbcGFzc107XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoc2hhZGVyKTtcblxuICAgICAgICAgICAgLy8gbWVzaCB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgY29uc3QgdWJGb3JtYXQgPSBzaGFkZXIubWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQ7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodWJGb3JtYXQpO1xuICAgICAgICAgICAgY29uc3QgdW5pZm9ybUJ1ZmZlciA9IG5ldyBVbmlmb3JtQnVmZmVyKGRldmljZSwgdWJGb3JtYXQpO1xuXG4gICAgICAgICAgICAvLyBtZXNoIGJpbmQgZ3JvdXBcbiAgICAgICAgICAgIGNvbnN0IGJpbmdHcm91cEZvcm1hdCA9IHNoYWRlci5tZXNoQmluZEdyb3VwRm9ybWF0O1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGJpbmdHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICBiaW5kR3JvdXAgPSBuZXcgQmluZEdyb3VwKGRldmljZSwgYmluZ0dyb3VwRm9ybWF0LCB1bmlmb3JtQnVmZmVyKTtcbiAgICAgICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUoYmluZEdyb3VwLCBgTWVzaEJpbmRHcm91cF8ke2JpbmRHcm91cC5pZH1gKTtcblxuICAgICAgICAgICAgdGhpcy5fYmluZEdyb3Vwc1twYXNzXSA9IGJpbmRHcm91cDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBiaW5kR3JvdXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIHVzZWQgYnkgdGhpcyBtZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnKS5NYXRlcmlhbH1cbiAgICAgKi9cbiAgICBzZXQgbWF0ZXJpYWwobWF0ZXJpYWwpIHtcblxuICAgICAgICB0aGlzLmNsZWFyU2hhZGVycygpO1xuXG4gICAgICAgIGNvbnN0IHByZXZNYXQgPSB0aGlzLl9tYXRlcmlhbDtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIG1hdGVyaWFsJ3MgcmVmZXJlbmNlIHRvIHRoaXMgbWVzaCBpbnN0YW5jZVxuICAgICAgICBpZiAocHJldk1hdCkge1xuICAgICAgICAgICAgcHJldk1hdC5yZW1vdmVNZXNoSW5zdGFuY2VSZWYodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IG1hdGVyaWFsO1xuXG4gICAgICAgIGlmIChtYXRlcmlhbCkge1xuXG4gICAgICAgICAgICAvLyBSZWNvcmQgdGhhdCB0aGUgbWF0ZXJpYWwgaXMgcmVmZXJlbmNlZCBieSB0aGlzIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgIG1hdGVyaWFsLmFkZE1lc2hJbnN0YW5jZVJlZih0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcblxuICAgICAgICAgICAgLy8gaWYgYmxlbmQgdHlwZSBvZiB0aGUgbWF0ZXJpYWwgY2hhbmdlc1xuICAgICAgICAgICAgY29uc3QgcHJldkJsZW5kID0gcHJldk1hdCAmJiBwcmV2TWF0LnRyYW5zcGFyZW50O1xuICAgICAgICAgICAgaWYgKG1hdGVyaWFsLnRyYW5zcGFyZW50ICE9PSBwcmV2QmxlbmQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuX21hdGVyaWFsLl9zY2VuZSB8fCBwcmV2TWF0Py5fc2NlbmU7XG4gICAgICAgICAgICAgICAgaWYgKHNjZW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lLmxheWVycy5fZGlydHlCbGVuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuX2RpcnR5QmxlbmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIHNldCBsYXllcihsYXllcikge1xuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBsYXllcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluIHNvbWUgY2lyY3Vtc3RhbmNlcyBtZXNoIGluc3RhbmNlcyBhcmUgc29ydGVkIGJ5IGEgZGlzdGFuY2UgY2FsY3VsYXRpb24gdG8gZGV0ZXJtaW5lIHRoZWlyXG4gICAgICogcmVuZGVyaW5nIG9yZGVyLiBTZXQgdGhpcyBjYWxsYmFjayB0byBvdmVycmlkZSB0aGUgZGVmYXVsdCBkaXN0YW5jZSBjYWxjdWxhdGlvbiwgd2hpY2ggZ2l2ZXNcbiAgICAgKiB0aGUgZG90IHByb2R1Y3Qgb2YgdGhlIGNhbWVyYSBmb3J3YXJkIHZlY3RvciBhbmQgdGhlIHZlY3RvciBiZXR3ZWVuIHRoZSBjYW1lcmEgcG9zaXRpb24gYW5kXG4gICAgICogdGhlIGNlbnRlciBvZiB0aGUgbWVzaCBpbnN0YW5jZSdzIGF4aXMtYWxpZ25lZCBib3VuZGluZyBib3guIFRoaXMgb3B0aW9uIGNhbiBiZSBwYXJ0aWN1bGFybHlcbiAgICAgKiB1c2VmdWwgZm9yIHJlbmRlcmluZyB0cmFuc3BhcmVudCBtZXNoZXMgaW4gYSBiZXR0ZXIgb3JkZXIgdGhhbiBkZWZhdWx0LlxuICAgICAqXG4gICAgICogQHR5cGUge0NhbGN1bGF0ZVNvcnREaXN0YW5jZUNhbGxiYWNrfVxuICAgICAqL1xuICAgIHNldCBjYWxjdWxhdGVTb3J0RGlzdGFuY2UoY2FsY3VsYXRlU29ydERpc3RhbmNlKSB7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZSA9IGNhbGN1bGF0ZVNvcnREaXN0YW5jZTtcbiAgICB9XG5cbiAgICBnZXQgY2FsY3VsYXRlU29ydERpc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FsY3VsYXRlU29ydERpc3RhbmNlO1xuICAgIH1cblxuICAgIHNldCByZWNlaXZlU2hhZG93KHZhbCkge1xuICAgICAgICB0aGlzLl9yZWNlaXZlU2hhZG93ID0gdmFsO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gdmFsID8gKHRoaXMuX3NoYWRlckRlZnMgJiB+U0hBREVSREVGX05PU0hBRE9XKSA6ICh0aGlzLl9zaGFkZXJEZWZzIHwgU0hBREVSREVGX05PU0hBRE9XKTtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJEXSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSREhEUl0gPSBudWxsO1xuICAgIH1cblxuICAgIGdldCByZWNlaXZlU2hhZG93KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjZWl2ZVNoYWRvdztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc2tpbiBpbnN0YW5jZSBtYW5hZ2luZyBza2lubmluZyBvZiB0aGlzIG1lc2ggaW5zdGFuY2UsIG9yIG51bGwgaWYgc2tpbm5pbmcgaXMgbm90IHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3NraW4taW5zdGFuY2UuanMnKS5Ta2luSW5zdGFuY2V9XG4gICAgICovXG4gICAgc2V0IHNraW5JbnN0YW5jZSh2YWwpIHtcbiAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlID0gdmFsO1xuXG4gICAgICAgIGxldCBzaGFkZXJEZWZzID0gdGhpcy5fc2hhZGVyRGVmcztcbiAgICAgICAgc2hhZGVyRGVmcyA9IHZhbCA/IChzaGFkZXJEZWZzIHwgU0hBREVSREVGX1NLSU4pIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX1NLSU4pO1xuXG4gICAgICAgIC8vIGlmIHNoYWRlckRlZnMgaGF2ZSBjaGFuZ2VkXG4gICAgICAgIGlmIChzaGFkZXJEZWZzICE9PSB0aGlzLl9zaGFkZXJEZWZzKSB7XG4gICAgICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gc2hhZGVyRGVmcztcbiAgICAgICAgICAgIHRoaXMuY2xlYXJTaGFkZXJzKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc2V0dXBTa2luVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgZ2V0IHNraW5JbnN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NraW5JbnN0YW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbW9ycGggaW5zdGFuY2UgbWFuYWdpbmcgbW9ycGhpbmcgb2YgdGhpcyBtZXNoIGluc3RhbmNlLCBvciBudWxsIGlmIG1vcnBoaW5nIGlzIG5vdCB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9tb3JwaC1pbnN0YW5jZS5qcycpLk1vcnBoSW5zdGFuY2V9XG4gICAgICovXG4gICAgc2V0IG1vcnBoSW5zdGFuY2UodmFsKSB7XG5cbiAgICAgICAgLy8gcmVsZWFzZSBleGlzdGluZ1xuICAgICAgICB0aGlzLl9tb3JwaEluc3RhbmNlPy5kZXN0cm95KCk7XG5cbiAgICAgICAgLy8gYXNzaWduIG5ld1xuICAgICAgICB0aGlzLl9tb3JwaEluc3RhbmNlID0gdmFsO1xuXG4gICAgICAgIGxldCBzaGFkZXJEZWZzID0gdGhpcy5fc2hhZGVyRGVmcztcbiAgICAgICAgc2hhZGVyRGVmcyA9ICh2YWwgJiYgdmFsLm1vcnBoLnVzZVRleHR1cmVNb3JwaCkgPyAoc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEKSA6IChzaGFkZXJEZWZzICYgflNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEKTtcbiAgICAgICAgc2hhZGVyRGVmcyA9ICh2YWwgJiYgdmFsLm1vcnBoLm1vcnBoUG9zaXRpb25zKSA/IChzaGFkZXJEZWZzIHwgU0hBREVSREVGX01PUlBIX1BPU0lUSU9OKSA6IChzaGFkZXJEZWZzICYgflNIQURFUkRFRl9NT1JQSF9QT1NJVElPTik7XG4gICAgICAgIHNoYWRlckRlZnMgPSAodmFsICYmIHZhbC5tb3JwaC5tb3JwaE5vcm1hbHMpID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfTU9SUEhfTk9STUFMKSA6IChzaGFkZXJEZWZzICYgflNIQURFUkRFRl9NT1JQSF9OT1JNQUwpO1xuXG4gICAgICAgIC8vIGlmIHNoYWRlckRlZnMgaGF2ZSBjaGFuZ2VkXG4gICAgICAgIGlmIChzaGFkZXJEZWZzICE9PSB0aGlzLl9zaGFkZXJEZWZzKSB7XG4gICAgICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gc2hhZGVyRGVmcztcbiAgICAgICAgICAgIHRoaXMuY2xlYXJTaGFkZXJzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbW9ycGhJbnN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21vcnBoSW5zdGFuY2U7XG4gICAgfVxuXG4gICAgc2V0IHNjcmVlblNwYWNlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY3JlZW5TcGFjZSA9IHZhbDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IHZhbCA/ICh0aGlzLl9zaGFkZXJEZWZzIHwgU0hBREVSREVGX1NDUkVFTlNQQUNFKSA6ICh0aGlzLl9zaGFkZXJEZWZzICYgflNIQURFUkRFRl9TQ1JFRU5TUEFDRSk7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSRF0gPSBudWxsO1xuICAgIH1cblxuICAgIGdldCBzY3JlZW5TcGFjZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NjcmVlblNwYWNlO1xuICAgIH1cblxuICAgIHNldCBrZXkodmFsKSB7XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gdmFsO1xuICAgIH1cblxuICAgIGdldCBrZXkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXNrIGNvbnRyb2xsaW5nIHdoaWNoIHtAbGluayBMaWdodENvbXBvbmVudH1zIGxpZ2h0IHRoaXMgbWVzaCBpbnN0YW5jZSwgd2hpY2hcbiAgICAgKiB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50fSBzZWVzIGl0IGFuZCBpbiB3aGljaCB7QGxpbmsgTGF5ZXJ9IGl0IGlzIHJlbmRlcmVkLiBEZWZhdWx0cyB0byAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWFzayh2YWwpIHtcbiAgICAgICAgY29uc3QgdG9nZ2xlcyA9IHRoaXMuX3NoYWRlckRlZnMgJiAweDAwMDBGRkZGO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gdG9nZ2xlcyB8ICh2YWwgPDwgMTYpO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRdID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJESERSXSA9IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0IG1hc2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkZXJEZWZzID4+IDE2O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE51bWJlciBvZiBpbnN0YW5jZXMgd2hlbiB1c2luZyBoYXJkd2FyZSBpbnN0YW5jaW5nIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGluc3RhbmNpbmdDb3VudCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5pbnN0YW5jaW5nRGF0YSlcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEuY291bnQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgaW5zdGFuY2luZ0NvdW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jaW5nRGF0YSA/IHRoaXMuaW5zdGFuY2luZ0RhdGEuY291bnQgOiAwO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgY29uc3QgbWVzaCA9IHRoaXMubWVzaDtcbiAgICAgICAgaWYgKG1lc2gpIHtcblxuICAgICAgICAgICAgLy8gdGhpcyBkZWNyZWFzZXMgcmVmIGNvdW50IG9uIHRoZSBtZXNoXG4gICAgICAgICAgICB0aGlzLm1lc2ggPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IG1lc2hcbiAgICAgICAgICAgIGlmIChtZXNoLnJlZkNvdW50IDwgMSkge1xuICAgICAgICAgICAgICAgIG1lc2guZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSByZWYgY291bnRlZCBsaWdodG1hcHNcbiAgICAgICAgdGhpcy5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMF0sIG51bGwpO1xuICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1sxXSwgbnVsbCk7XG5cbiAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5tb3JwaEluc3RhbmNlPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubW9ycGhJbnN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcblxuICAgICAgICAvLyBtYWtlIHN1cmUgbWF0ZXJpYWwgY2xlYXJzIHJlZmVyZW5jZXMgdG8gdGhpcyBtZXNoSW5zdGFuY2VcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gc2hhZGVyIHVuaWZvcm0gbmFtZXMgZm9yIGxpZ2h0bWFwc1xuICAgIHN0YXRpYyBsaWdodG1hcFBhcmFtTmFtZXMgPSBbJ3RleHR1cmVfbGlnaHRNYXAnLCAndGV4dHVyZV9kaXJMaWdodE1hcCddO1xuXG4gICAgLy8gZ2VuZXJhdGVzIHdpcmVmcmFtZXMgZm9yIGFuIGFycmF5IG9mIG1lc2ggaW5zdGFuY2VzXG4gICAgc3RhdGljIF9wcmVwYXJlUmVuZGVyU3R5bGVGb3JBcnJheShtZXNoSW5zdGFuY2VzLCByZW5kZXJTdHlsZSkge1xuXG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIC8vIHN3aXRjaCBtZXNoIGluc3RhbmNlIHRvIHRoZSByZXF1ZXN0ZWQgc3R5bGVcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLl9yZW5kZXJTdHlsZSA9IHJlbmRlclN0eWxlO1xuXG4gICAgICAgICAgICAgICAgLy8gcHJvY2VzcyBhbGwgdW5pcXVlIG1lc2hlc1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoSW5zdGFuY2VzW2ldLm1lc2g7XG4gICAgICAgICAgICAgICAgaWYgKCFfbWVzaFNldC5oYXMobWVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgX21lc2hTZXQuYWRkKG1lc2gpO1xuICAgICAgICAgICAgICAgICAgICBtZXNoLnByZXBhcmVSZW5kZXJTdGF0ZShyZW5kZXJTdHlsZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfbWVzaFNldC5jbGVhcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gdGVzdCBpZiBtZXNoSW5zdGFuY2UgaXMgdmlzaWJsZSBieSBjYW1lcmEuIEl0IHJlcXVpcmVzIHRoZSBmcnVzdHVtIG9mIHRoZSBjYW1lcmEgdG8gYmUgdXAgdG8gZGF0ZSwgd2hpY2ggZm9yd2FyZC1yZW5kZXJlclxuICAgIC8vIHRha2VzIGNhcmUgb2YuIFRoaXMgZnVuY3Rpb24gc2hvdWxkICBub3QgYmUgY2FsbGVkIGVsc2V3aGVyZS5cbiAgICBfaXNWaXNpYmxlKGNhbWVyYSkge1xuXG4gICAgICAgIGlmICh0aGlzLnZpc2libGUpIHtcblxuICAgICAgICAgICAgLy8gY3VzdG9tIHZpc2liaWxpdHkgbWV0aG9kIG9mIE1lc2hJbnN0YW5jZVxuICAgICAgICAgICAgaWYgKHRoaXMuaXNWaXNpYmxlRnVuYykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmlzVmlzaWJsZUZ1bmMoY2FtZXJhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX3RlbXBTcGhlcmUuY2VudGVyID0gdGhpcy5hYWJiLmNlbnRlcjsgIC8vIHRoaXMgbGluZSBldmFsdWF0ZXMgYWFiYlxuICAgICAgICAgICAgX3RlbXBTcGhlcmUucmFkaXVzID0gdGhpcy5fYWFiYi5oYWxmRXh0ZW50cy5sZW5ndGgoKTtcblxuICAgICAgICAgICAgcmV0dXJuIGNhbWVyYS5mcnVzdHVtLmNvbnRhaW5zU3BoZXJlKF90ZW1wU3BoZXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB1cGRhdGVLZXkoKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbDtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSBnZXRLZXkodGhpcy5sYXllcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG1hdGVyaWFsLmFscGhhVG9Db3ZlcmFnZSB8fCBtYXRlcmlhbC5hbHBoYVRlc3QpID8gQkxFTkRfTk9STUFMIDogbWF0ZXJpYWwuYmxlbmRUeXBlLCAvLyByZW5kZXIgYWxwaGF0ZXN0L2F0b2MgYWZ0ZXIgb3BhcXVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhbHNlLCBtYXRlcmlhbC5pZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB1cCB7QGxpbmsgTWVzaEluc3RhbmNlfSB0byBiZSByZW5kZXJlZCB1c2luZyBIYXJkd2FyZSBJbnN0YW5jaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnKS5WZXJ0ZXhCdWZmZXJ8bnVsbH0gdmVydGV4QnVmZmVyIC0gVmVydGV4IGJ1ZmZlciB0byBob2xkIHBlci1pbnN0YW5jZSB2ZXJ0ZXggZGF0YVxuICAgICAqICh1c3VhbGx5IHdvcmxkIG1hdHJpY2VzKS4gUGFzcyBudWxsIHRvIHR1cm4gb2ZmIGhhcmR3YXJlIGluc3RhbmNpbmcuXG4gICAgICovXG4gICAgc2V0SW5zdGFuY2luZyh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgaWYgKHZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YSA9IG5ldyBJbnN0YW5jaW5nRGF0YSh2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXMpO1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YS52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG5cbiAgICAgICAgICAgIC8vIG1hcmsgdmVydGV4IGJ1ZmZlciBhcyBpbnN0YW5jaW5nIGRhdGFcbiAgICAgICAgICAgIHZlcnRleEJ1ZmZlci5mb3JtYXQuaW5zdGFuY2luZyA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIHR1cm4gb2ZmIGN1bGxpbmcgLSB3ZSBkbyBub3QgZG8gcGVyLWluc3RhbmNlIGN1bGxpbmcsIGFsbCBpbnN0YW5jZXMgYXJlIHN1Ym1pdHRlZCB0byBHUFVcbiAgICAgICAgICAgIHRoaXMuY3VsbCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmN1bGwgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogT2J0YWluIGEgc2hhZGVyIHZhcmlhbnQgcmVxdWlyZWQgdG8gcmVuZGVyIHRoZSBtZXNoIGluc3RhbmNlIHdpdGhpbiBzcGVjaWZpZWQgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3NjZW5lLmpzJykuU2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwYXNzIC0gVGhlIHJlbmRlciBwYXNzLlxuICAgICAqIEBwYXJhbSB7YW55fSBzdGF0aWNMaWdodExpc3QgLSBMaXN0IG9mIHN0YXRpYyBsaWdodHMuXG4gICAgICogQHBhcmFtIHthbnl9IHNvcnRlZExpZ2h0cyAtIEFycmF5IG9mIGFycmF5cyBvZiBsaWdodHMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcycpLlVuaWZvcm1CdWZmZXJGb3JtYXR9IHZpZXdVbmlmb3JtRm9ybWF0IC0gVGhlXG4gICAgICogZm9ybWF0IG9mIHRoZSB2aWV3IHVuaWZvcm0gYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9iaW5kLWdyb3VwLWZvcm1hdC5qcycpLkJpbmRHcm91cEZvcm1hdH0gdmlld0JpbmRHcm91cEZvcm1hdCAtIFRoZVxuICAgICAqIGZvcm1hdCBvZiB0aGUgdmlldyBiaW5kIGdyb3VwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBzdGF0aWNMaWdodExpc3QsIHNvcnRlZExpZ2h0cywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpIHtcbiAgICAgICAgdGhpcy5fc2hhZGVyW3Bhc3NdID0gdGhpcy5tYXRlcmlhbC5nZXRTaGFkZXJWYXJpYW50KHRoaXMubWVzaC5kZXZpY2UsIHNjZW5lLCB0aGlzLl9zaGFkZXJEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0KTtcbiAgICB9XG5cbiAgICBlbnN1cmVNYXRlcmlhbChkZXZpY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1hdGVyaWFsKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBNZXNoIGF0dGFjaGVkIHRvIGVudGl0eSAnJHt0aGlzLm5vZGUubmFtZX0nIGRvZXMgbm90IGhhdmUgYSBtYXRlcmlhbCwgdXNpbmcgYSBkZWZhdWx0IG9uZS5gKTtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwgPSBnZXREZWZhdWx0TWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFBhcmFtZXRlciBtYW5hZ2VtZW50XG4gICAgY2xlYXJQYXJhbWV0ZXJzKCkge1xuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcbiAgICB9XG5cbiAgICBnZXRQYXJhbWV0ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgc3BlY2lmaWVkIHNoYWRlciBwYXJhbWV0ZXIgZnJvbSBhIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gcXVlcnkuXG4gICAgICogQHJldHVybnMge29iamVjdH0gVGhlIG5hbWVkIHBhcmFtZXRlci5cbiAgICAgKi9cbiAgICBnZXRQYXJhbWV0ZXIobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYSBzaGFkZXIgcGFyYW1ldGVyIG9uIGEgbWVzaCBpbnN0YW5jZS4gTm90ZSB0aGF0IHRoaXMgcGFyYW1ldGVyIHdpbGwgdGFrZSBwcmVjZWRlbmNlXG4gICAgICogb3ZlciBwYXJhbWV0ZXIgb2YgdGhlIHNhbWUgbmFtZSBpZiBzZXQgb24gTWF0ZXJpYWwgdGhpcyBtZXNoIGluc3RhbmNlIHVzZXMgZm9yIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW118aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gZGF0YSAtIFRoZSB2YWx1ZVxuICAgICAqIGZvciB0aGUgc3BlY2lmaWVkIHBhcmFtZXRlci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3Bhc3NGbGFnc10gLSBNYXNrIGRlc2NyaWJpbmcgd2hpY2ggcGFzc2VzIHRoZSBtYXRlcmlhbCBzaG91bGQgYmUgaW5jbHVkZWRcbiAgICAgKiBpbi5cbiAgICAgKi9cbiAgICBzZXRQYXJhbWV0ZXIobmFtZSwgZGF0YSwgcGFzc0ZsYWdzID0gLTI2MjE0MSkge1xuXG4gICAgICAgIC8vIG5vdGUgb24gLTI2MjE0MTogQWxsIGJpdHMgc2V0IGV4Y2VwdCAyIC0gMTkgcmFuZ2VcblxuICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgY29uc3QgdW5pZm9ybU9iamVjdCA9IG5hbWU7XG4gICAgICAgICAgICBpZiAodW5pZm9ybU9iamVjdC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVuaWZvcm1PYmplY3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXIodW5pZm9ybU9iamVjdFtpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5hbWUgPSB1bmlmb3JtT2JqZWN0Lm5hbWU7XG4gICAgICAgICAgICBkYXRhID0gdW5pZm9ybU9iamVjdC52YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhcmFtID0gdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgICAgICBpZiAocGFyYW0pIHtcbiAgICAgICAgICAgIHBhcmFtLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgcGFyYW0ucGFzc0ZsYWdzID0gcGFzc0ZsYWdzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wYXJhbWV0ZXJzW25hbWVdID0ge1xuICAgICAgICAgICAgICAgIHNjb3BlSWQ6IG51bGwsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgICAgICBwYXNzRmxhZ3M6IHBhc3NGbGFnc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGEgd3JhcHBlciBvdmVyIHNldHRpbmdzIHBhcmFtZXRlciBzcGVjaWZpY2FsbHkgZm9yIHJlYWx0aW1lIGJha2VkIGxpZ2h0bWFwcy4gVGhpcyBoYW5kbGVzIHJlZmVyZW5jZSBjb3VudGluZyBvZiBsaWdodG1hcHNcbiAgICAvLyBhbmQgcmVsZWFzZXMgdGhlbSB3aGVuIG5vIGxvbmdlciByZWZlcmVuY2VkXG4gICAgc2V0UmVhbHRpbWVMaWdodG1hcChuYW1lLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgLy8gbm8gY2hhbmdlXG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuZ2V0UGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICBpZiAob2xkID09PSB0ZXh0dXJlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIHJlbW92ZSBvbGRcbiAgICAgICAgaWYgKG9sZCkge1xuICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5kZWNSZWYob2xkLmRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXNzaWduIG5ld1xuICAgICAgICBpZiAodGV4dHVyZSkge1xuICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5pbmNSZWYodGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLnNldFBhcmFtZXRlcihuYW1lLCB0ZXh0dXJlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsZXRlUGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgIC8qKlxuICAgICAgKiBEZWxldGVzIGEgc2hhZGVyIHBhcmFtZXRlciBvbiBhIG1lc2ggaW5zdGFuY2UuXG4gICAgICAqXG4gICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBkZWxldGUuXG4gICAgICAqL1xuICAgIGRlbGV0ZVBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIGlmICh0aGlzLnBhcmFtZXRlcnNbbmFtZV0pIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBhcmFtZXRlcnNbbmFtZV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB1c2VkIHRvIGFwcGx5IHBhcmFtZXRlcnMgZnJvbSB0aGlzIG1lc2ggaW5zdGFuY2UgaW50byBzY29wZSBvZiB1bmlmb3JtcywgY2FsbGVkIGludGVybmFsbHkgYnkgZm9yd2FyZC1yZW5kZXJlclxuICAgIHNldFBhcmFtZXRlcnMoZGV2aWNlLCBwYXNzRmxhZykge1xuICAgICAgICBjb25zdCBwYXJhbWV0ZXJzID0gdGhpcy5wYXJhbWV0ZXJzO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcmFtTmFtZSBpbiBwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXIgPSBwYXJhbWV0ZXJzW3BhcmFtTmFtZV07XG4gICAgICAgICAgICBpZiAocGFyYW1ldGVyLnBhc3NGbGFncyAmIHBhc3NGbGFnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFwYXJhbWV0ZXIuc2NvcGVJZCkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbWV0ZXIuc2NvcGVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKHBhcmFtTmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBhcmFtZXRlci5zY29wZUlkLnNldFZhbHVlKHBhcmFtZXRlci5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldExpZ2h0bWFwcGVkKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5tYXNrID0gKHRoaXMubWFzayB8IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEKSAmIH4oTUFTS19BRkZFQ1RfRFlOQU1JQyB8IE1BU0tfQkFLRSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbnVsbCk7XG4gICAgICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1sxXSwgbnVsbCk7XG4gICAgICAgICAgICB0aGlzLl9zaGFkZXJEZWZzICY9IH4oU0hBREVSREVGX0xNIHwgU0hBREVSREVGX0RJUkxNIHwgU0hBREVSREVGX0xNQU1CSUVOVCk7XG4gICAgICAgICAgICB0aGlzLm1hc2sgPSAodGhpcy5tYXNrIHwgTUFTS19BRkZFQ1RfRFlOQU1JQykgJiB+KE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIHwgTUFTS19CQUtFKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEN1c3RvbUFhYmIoYWFiYikge1xuXG4gICAgICAgIGlmIChhYWJiKSB7XG4gICAgICAgICAgICAvLyBzdG9yZSB0aGUgb3ZlcnJpZGUgYWFiYlxuICAgICAgICAgICAgaWYgKHRoaXMuX2N1c3RvbUFhYmIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXN0b21BYWJiLmNvcHkoYWFiYik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2N1c3RvbUFhYmIgPSBhYWJiLmNsb25lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyBvdmVycmlkZSwgZm9yY2UgcmVmcmVzaCB0aGUgYWN0dWFsIG9uZVxuICAgICAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9hYWJiVmVyID0gLTE7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXR1cFNraW5VcGRhdGUoKTtcbiAgICB9XG5cbiAgICBfc2V0dXBTa2luVXBkYXRlKCkge1xuXG4gICAgICAgIC8vIHNldCBpZiBib25lcyBuZWVkIHRvIGJlIHVwZGF0ZWQgYmVmb3JlIGN1bGxpbmdcbiAgICAgICAgaWYgKHRoaXMuX3NraW5JbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlLl91cGRhdGVCZWZvcmVDdWxsID0gIXRoaXMuX2N1c3RvbUFhYmI7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldEtleShsYXllciwgYmxlbmRUeXBlLCBpc0NvbW1hbmQsIG1hdGVyaWFsSWQpIHtcbiAgICAvLyBLZXkgZGVmaW5pdGlvbjpcbiAgICAvLyBCaXRcbiAgICAvLyAzMSAgICAgIDogc2lnbiBiaXQgKGxlYXZlKVxuICAgIC8vIDI3IC0gMzAgOiBsYXllclxuICAgIC8vIDI2ICAgICAgOiB0cmFuc2x1Y2VuY3kgdHlwZSAob3BhcXVlL3RyYW5zcGFyZW50KVxuICAgIC8vIDI1ICAgICAgOiBDb21tYW5kIGJpdCAoMTogdGhpcyBrZXkgaXMgZm9yIGEgY29tbWFuZCwgMDogaXQncyBhIG1lc2ggaW5zdGFuY2UpXG4gICAgLy8gMCAtIDI0ICA6IE1hdGVyaWFsIElEIChpZiBvcGFxdWUpIG9yIDAgKGlmIHRyYW5zcGFyZW50IC0gd2lsbCBiZSBkZXB0aClcbiAgICByZXR1cm4gKChsYXllciAmIDB4MGYpIDw8IDI3KSB8XG4gICAgICAgICAgICgoYmxlbmRUeXBlID09PSBCTEVORF9OT05FID8gMSA6IDApIDw8IDI2KSB8XG4gICAgICAgICAgICgoaXNDb21tYW5kID8gMSA6IDApIDw8IDI1KSB8XG4gICAgICAgICAgICgobWF0ZXJpYWxJZCAmIDB4MWZmZmZmZikgPDwgMCk7XG59XG5cbmV4cG9ydCB7IENvbW1hbmQsIE1lc2hJbnN0YW5jZSB9O1xuIl0sIm5hbWVzIjpbIl90bXBBYWJiIiwiQm91bmRpbmdCb3giLCJfdGVtcEJvbmVBYWJiIiwiX3RlbXBTcGhlcmUiLCJCb3VuZGluZ1NwaGVyZSIsIl9tZXNoU2V0IiwiU2V0IiwiSW5zdGFuY2luZ0RhdGEiLCJjb25zdHJ1Y3RvciIsIm51bU9iamVjdHMiLCJ2ZXJ0ZXhCdWZmZXIiLCJjb3VudCIsIkNvbW1hbmQiLCJsYXllciIsImJsZW5kVHlwZSIsImNvbW1hbmQiLCJfa2V5IiwiU09SVEtFWV9GT1JXQVJEIiwiZ2V0S2V5Iiwia2V5IiwidmFsIiwiTWVzaEluc3RhbmNlIiwibWVzaCIsIm1hdGVyaWFsIiwibm9kZSIsIl9tYXRlcmlhbCIsIl9zaGFkZXIiLCJfYmluZEdyb3VwcyIsIkdyYXBoTm9kZSIsInRlbXAiLCJpc1N0YXRpYyIsIl9zdGF0aWNMaWdodExpc3QiLCJfc3RhdGljU291cmNlIiwiX21lc2giLCJpbmNSZWZDb3VudCIsIl9zaGFkZXJEZWZzIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsImZvcm1hdCIsImhhc1V2MCIsIlNIQURFUkRFRl9VVjAiLCJoYXNVdjEiLCJTSEFERVJERUZfVVYxIiwiaGFzQ29sb3IiLCJTSEFERVJERUZfVkNPTE9SIiwiaGFzVGFuZ2VudHMiLCJTSEFERVJERUZfVEFOR0VOVFMiLCJfbGlnaHRIYXNoIiwidmlzaWJsZSIsIkxBWUVSX1dPUkxEIiwiX3JlbmRlclN0eWxlIiwiUkVOREVSU1RZTEVfU09MSUQiLCJjYXN0U2hhZG93IiwiX3JlY2VpdmVTaGFkb3ciLCJfc2NyZWVuU3BhY2UiLCJfbm9EZXB0aERyYXdHbDEiLCJjdWxsIiwicGljayIsIl91cGRhdGVBYWJiIiwiX3VwZGF0ZUFhYmJGdW5jIiwiX2NhbGN1bGF0ZVNvcnREaXN0YW5jZSIsInVwZGF0ZUtleSIsIl9za2luSW5zdGFuY2UiLCJfbW9ycGhJbnN0YW5jZSIsImluc3RhbmNpbmdEYXRhIiwiX2N1c3RvbUFhYmIiLCJhYWJiIiwiX2FhYmJWZXIiLCJkcmF3T3JkZXIiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwiaXNWaXNpYmxlRnVuYyIsInBhcmFtZXRlcnMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsImZsaXBGYWNlcyIsInJlbmRlclN0eWxlIiwicHJlcGFyZVJlbmRlclN0YXRlIiwiZGVjUmVmQ291bnQiLCJfYWFiYiIsImxvY2FsQWFiYiIsInRvV29ybGRTcGFjZSIsInNraW5JbnN0YW5jZSIsImJvbmVBYWJiIiwibW9ycGhUYXJnZXRzIiwibW9ycGgiLCJfdGFyZ2V0cyIsIl9pbml0Qm9uZUFhYmJzIiwiYm9uZVVzZWQiLCJmaXJzdCIsImkiLCJsZW5ndGgiLCJzZXRGcm9tVHJhbnNmb3JtZWRBYWJiIiwibWF0cmljZXMiLCJjZW50ZXIiLCJjb3B5IiwiaGFsZkV4dGVudHMiLCJhZGQiLCJzZXQiLCJfZXhwYW5kIiwiZ2V0TWluIiwiZ2V0TWF4IiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJjbGVhclNoYWRlcnMiLCJzaGFkZXJzIiwiZGVzdHJveUJpbmRHcm91cHMiLCJncm91cHMiLCJncm91cCIsInVuaWZvcm1CdWZmZXIiLCJkZWZhdWx0VW5pZm9ybUJ1ZmZlciIsImRlc3Ryb3kiLCJnZXRCaW5kR3JvdXAiLCJkZXZpY2UiLCJwYXNzIiwiYmluZEdyb3VwIiwic2hhZGVyIiwiRGVidWciLCJhc3NlcnQiLCJ1YkZvcm1hdCIsIm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0IiwiVW5pZm9ybUJ1ZmZlciIsImJpbmdHcm91cEZvcm1hdCIsIm1lc2hCaW5kR3JvdXBGb3JtYXQiLCJCaW5kR3JvdXAiLCJEZWJ1Z0hlbHBlciIsInNldE5hbWUiLCJpZCIsInByZXZNYXQiLCJyZW1vdmVNZXNoSW5zdGFuY2VSZWYiLCJhZGRNZXNoSW5zdGFuY2VSZWYiLCJwcmV2QmxlbmQiLCJ0cmFuc3BhcmVudCIsInNjZW5lIiwiX3NjZW5lIiwibGF5ZXJzIiwiX2RpcnR5QmxlbmQiLCJfbGF5ZXIiLCJjYWxjdWxhdGVTb3J0RGlzdGFuY2UiLCJyZWNlaXZlU2hhZG93IiwiU0hBREVSREVGX05PU0hBRE9XIiwiU0hBREVSX0ZPUldBUkQiLCJTSEFERVJfRk9SV0FSREhEUiIsInNoYWRlckRlZnMiLCJTSEFERVJERUZfU0tJTiIsIl9zZXR1cFNraW5VcGRhdGUiLCJtb3JwaEluc3RhbmNlIiwidXNlVGV4dHVyZU1vcnBoIiwiU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQiLCJtb3JwaFBvc2l0aW9ucyIsIlNIQURFUkRFRl9NT1JQSF9QT1NJVElPTiIsIm1vcnBoTm9ybWFscyIsIlNIQURFUkRFRl9NT1JQSF9OT1JNQUwiLCJzY3JlZW5TcGFjZSIsIlNIQURFUkRFRl9TQ1JFRU5TUEFDRSIsIm1hc2siLCJ0b2dnbGVzIiwiaW5zdGFuY2luZ0NvdW50IiwidmFsdWUiLCJyZWZDb3VudCIsInNldFJlYWx0aW1lTGlnaHRtYXAiLCJsaWdodG1hcFBhcmFtTmFtZXMiLCJfcHJlcGFyZVJlbmRlclN0eWxlRm9yQXJyYXkiLCJtZXNoSW5zdGFuY2VzIiwiaGFzIiwiY2xlYXIiLCJfaXNWaXNpYmxlIiwiY2FtZXJhIiwicmFkaXVzIiwiZnJ1c3R1bSIsImNvbnRhaW5zU3BoZXJlIiwiYWxwaGFUb0NvdmVyYWdlIiwiYWxwaGFUZXN0IiwiQkxFTkRfTk9STUFMIiwic2V0SW5zdGFuY2luZyIsIm51bVZlcnRpY2VzIiwiaW5zdGFuY2luZyIsInVwZGF0ZVBhc3NTaGFkZXIiLCJzdGF0aWNMaWdodExpc3QiLCJzb3J0ZWRMaWdodHMiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJnZXRTaGFkZXJWYXJpYW50IiwiZW5zdXJlTWF0ZXJpYWwiLCJ3YXJuIiwibmFtZSIsImdldERlZmF1bHRNYXRlcmlhbCIsImNsZWFyUGFyYW1ldGVycyIsImdldFBhcmFtZXRlcnMiLCJnZXRQYXJhbWV0ZXIiLCJzZXRQYXJhbWV0ZXIiLCJkYXRhIiwicGFzc0ZsYWdzIiwidW5kZWZpbmVkIiwidW5pZm9ybU9iamVjdCIsInBhcmFtIiwic2NvcGVJZCIsInRleHR1cmUiLCJvbGQiLCJMaWdodG1hcENhY2hlIiwiZGVjUmVmIiwiaW5jUmVmIiwiZGVsZXRlUGFyYW1ldGVyIiwic2V0UGFyYW1ldGVycyIsInBhc3NGbGFnIiwicGFyYW1OYW1lIiwicGFyYW1ldGVyIiwic2NvcGUiLCJyZXNvbHZlIiwic2V0VmFsdWUiLCJzZXRMaWdodG1hcHBlZCIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiTUFTS19CQUtFIiwiU0hBREVSREVGX0xNIiwiU0hBREVSREVGX0RJUkxNIiwiU0hBREVSREVGX0xNQU1CSUVOVCIsInNldEN1c3RvbUFhYmIiLCJjbG9uZSIsIl91cGRhdGVCZWZvcmVDdWxsIiwiaXNDb21tYW5kIiwibWF0ZXJpYWxJZCIsIkJMRU5EX05PTkUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQXdCQSxNQUFNQSxRQUFRLEdBQUcsSUFBSUMsV0FBVyxFQUFFLENBQUE7QUFDbEMsTUFBTUMsYUFBYSxHQUFHLElBQUlELFdBQVcsRUFBRSxDQUFBO0FBQ3ZDLE1BQU1FLFdBQVcsR0FBRyxJQUFJQyxjQUFjLEVBQUUsQ0FBQTtBQUN4QyxNQUFNQyxRQUFRLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7O0FBRTFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxjQUFjLENBQUM7QUFDakI7O0FBR0E7QUFDSjtBQUNBO0VBQ0lDLFdBQVcsQ0FBQ0MsVUFBVSxFQUFFO0lBQUEsSUFMeEJDLENBQUFBLFlBQVksR0FBRyxJQUFJLENBQUE7SUFNZixJQUFJLENBQUNDLEtBQUssR0FBR0YsVUFBVSxDQUFBO0FBQzNCLEdBQUE7QUFD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
