/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
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
   * Enable rendering for this mesh instance. Use visible property to enable/disable
   * rendering without overhead of removing from scene. But note that the mesh instance is
   * still in the hierarchy and still in the draw call list.
   *
   * @type {boolean}
   */

  /**
   * Enable shadow casting for this mesh instance. Use this property to enable/disable
   * shadow casting without overhead of removing from scene. Note that this property does not
   * add the mesh instance to appropriate list of shadow casters on a {@link pc.Layer}, but
   * allows mesh to be skipped from shadow casting while it is in the list already. Defaults to
   * false.
   *
   * @type {boolean}
   */

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
    this.visible = true;
    this.castShadow = false;
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
    this.layer = LAYER_WORLD; // legacy
    /** @private */
    this._renderStyle = RENDERSTYLE_SOLID;
    this._receiveShadow = true;
    this._screenSpace = false;
    this._noDepthDrawGl1 = false;

    /**
     * Controls whether the mesh instance can be culled by frustum culling
     * ({@link CameraComponent#frustumCulling}). Defaults to true.
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
    this.flipFacesFactor = 1;
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
          const morphAabb = this.mesh.morph.aabb;
          localAabb._expand(morphAabb.getMin(), morphAabb.getMax());
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
      const bindGroupFormat = shader.meshBindGroupFormat;
      Debug.assert(bindGroupFormat);
      bindGroup = new BindGroup(device, bindGroupFormat, uniformBuffer);
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
    this._shader[pass] = this.material.getShaderVariant(this.mesh.device, scene, this._shaderDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, this._mesh.vertexBuffer.format);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC1pbnN0YW5jZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL21lc2gtaW5zdGFuY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5cbmltcG9ydCB7IEJpbmRHcm91cCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORF9OT05FLCBCTEVORF9OT1JNQUwsXG4gICAgTEFZRVJfV09STEQsXG4gICAgTUFTS19BRkZFQ1RfRFlOQU1JQywgTUFTS19CQUtFLCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCxcbiAgICBSRU5ERVJTVFlMRV9TT0xJRCxcbiAgICBTSEFERVJfRk9SV0FSRCwgU0hBREVSX0ZPUldBUkRIRFIsXG4gICAgU0hBREVSREVGX1VWMCwgU0hBREVSREVGX1VWMSwgU0hBREVSREVGX1ZDT0xPUiwgU0hBREVSREVGX1RBTkdFTlRTLCBTSEFERVJERUZfTk9TSEFET1csIFNIQURFUkRFRl9TS0lOLFxuICAgIFNIQURFUkRFRl9TQ1JFRU5TUEFDRSwgU0hBREVSREVGX01PUlBIX1BPU0lUSU9OLCBTSEFERVJERUZfTU9SUEhfTk9STUFMLCBTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCxcbiAgICBTSEFERVJERUZfTE0sIFNIQURFUkRFRl9ESVJMTSwgU0hBREVSREVGX0xNQU1CSUVOVCxcbiAgICBTT1JUS0VZX0ZPUldBUkRcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdE1hdGVyaWFsIH0gZnJvbSAnLi9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBMaWdodG1hcENhY2hlIH0gZnJvbSAnLi9ncmFwaGljcy9saWdodG1hcC1jYWNoZS5qcyc7XG5cbmNvbnN0IF90bXBBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcEJvbmVBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX21lc2hTZXQgPSBuZXcgU2V0KCk7XG5cbi8qKlxuICogSW50ZXJuYWwgZGF0YSBzdHJ1Y3R1cmUgdXNlZCB0byBzdG9yZSBkYXRhIHVzZWQgYnkgaGFyZHdhcmUgaW5zdGFuY2luZy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEluc3RhbmNpbmdEYXRhIHtcbiAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcnxudWxsfSAqL1xuICAgIHZlcnRleEJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtT2JqZWN0cyAtIFRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbnN0YW5jZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobnVtT2JqZWN0cykge1xuICAgICAgICB0aGlzLmNvdW50ID0gbnVtT2JqZWN0cztcbiAgICB9XG59XG5cbmNsYXNzIENvbW1hbmQge1xuICAgIGNvbnN0cnVjdG9yKGxheWVyLCBibGVuZFR5cGUsIGNvbW1hbmQpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0gW107XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gZ2V0S2V5KGxheWVyLCBibGVuZFR5cGUsIHRydWUsIDApO1xuICAgICAgICB0aGlzLmNvbW1hbmQgPSBjb21tYW5kO1xuICAgIH1cblxuICAgIHNldCBrZXkodmFsKSB7XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gdmFsO1xuICAgIH1cblxuICAgIGdldCBrZXkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgTGF5ZXJ9IHRvIGNhbGN1bGF0ZSB0aGUgXCJzb3J0IGRpc3RhbmNlXCIgZm9yIGEge0BsaW5rIE1lc2hJbnN0YW5jZX0sXG4gKiB3aGljaCBkZXRlcm1pbmVzIGl0cyBwbGFjZSBpbiB0aGUgcmVuZGVyIG9yZGVyLlxuICpcbiAqIEBjYWxsYmFjayBDYWxjdWxhdGVTb3J0RGlzdGFuY2VDYWxsYmFja1xuICogQHBhcmFtIHtNZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlLlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gY2FtZXJhUG9zaXRpb24gLSBUaGUgcG9zaXRpb24gb2YgdGhlIGNhbWVyYS5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IGNhbWVyYUZvcndhcmQgLSBUaGUgZm9yd2FyZCB2ZWN0b3Igb2YgdGhlIGNhbWVyYS5cbiAqL1xuXG4vKipcbiAqIEFuIGluc3RhbmNlIG9mIGEge0BsaW5rIE1lc2h9LiBBIHNpbmdsZSBtZXNoIGNhbiBiZSByZWZlcmVuY2VkIGJ5IG1hbnkgbWVzaCBpbnN0YW5jZXMgdGhhdCBjYW5cbiAqIGhhdmUgZGlmZmVyZW50IHRyYW5zZm9ybXMgYW5kIG1hdGVyaWFscy5cbiAqL1xuY2xhc3MgTWVzaEluc3RhbmNlIHtcbiAgICAvKipcbiAgICAgKiBFbmFibGUgcmVuZGVyaW5nIGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuIFVzZSB2aXNpYmxlIHByb3BlcnR5IHRvIGVuYWJsZS9kaXNhYmxlXG4gICAgICogcmVuZGVyaW5nIHdpdGhvdXQgb3ZlcmhlYWQgb2YgcmVtb3ZpbmcgZnJvbSBzY2VuZS4gQnV0IG5vdGUgdGhhdCB0aGUgbWVzaCBpbnN0YW5jZSBpc1xuICAgICAqIHN0aWxsIGluIHRoZSBoaWVyYXJjaHkgYW5kIHN0aWxsIGluIHRoZSBkcmF3IGNhbGwgbGlzdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHZpc2libGUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHNoYWRvdyBjYXN0aW5nIGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuIFVzZSB0aGlzIHByb3BlcnR5IHRvIGVuYWJsZS9kaXNhYmxlXG4gICAgICogc2hhZG93IGNhc3Rpbmcgd2l0aG91dCBvdmVyaGVhZCBvZiByZW1vdmluZyBmcm9tIHNjZW5lLiBOb3RlIHRoYXQgdGhpcyBwcm9wZXJ0eSBkb2VzIG5vdFxuICAgICAqIGFkZCB0aGUgbWVzaCBpbnN0YW5jZSB0byBhcHByb3ByaWF0ZSBsaXN0IG9mIHNoYWRvdyBjYXN0ZXJzIG9uIGEge0BsaW5rIHBjLkxheWVyfSwgYnV0XG4gICAgICogYWxsb3dzIG1lc2ggdG8gYmUgc2tpcHBlZCBmcm9tIHNoYWRvdyBjYXN0aW5nIHdoaWxlIGl0IGlzIGluIHRoZSBsaXN0IGFscmVhZHkuIERlZmF1bHRzIHRvXG4gICAgICogZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBjYXN0U2hhZG93ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hdGVyaWFsO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2Ygc2hhZGVycyB1c2VkIGJ5IHRoZSBtZXNoIGluc3RhbmNlLCBpbmRleGVkIGJ5IHRoZSBzaGFkZXIgcGFzcyBjb25zdGFudCAoU0hBREVSX0ZPUldBUkQuLilcbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcycpLlNoYWRlcj59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9zaGFkZXIgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGJpbmQgZ3JvdXBzLCBzdG9yaW5nIHVuaWZvcm1zIHBlciBwYXNzLiBUaGlzIGhhcyAxOjEgcmVsYXRpb24gd2l0aCB0aGUgX3NoYWRlcyBhcnJheSxcbiAgICAgKiBhbmQgaXMgaW5kZXhlZCBieSB0aGUgc2hhZGVyIHBhc3MgY29uc3RhbnQgYXMgd2VsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxCaW5kR3JvdXA+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfYmluZEdyb3VwcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1lc2hJbnN0YW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2guanMnKS5NZXNofSBtZXNoIC0gVGhlIGdyYXBoaWNzIG1lc2ggdG8gaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSBmb3IgdGhpc1xuICAgICAqIG1lc2ggaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IFtub2RlXSAtIFRoZSBncmFwaCBub2RlIGRlZmluaW5nIHRoZSB0cmFuc2Zvcm0gZm9yIHRoaXMgaW5zdGFuY2UuIFRoaXNcbiAgICAgKiBwYXJhbWV0ZXIgaXMgb3B0aW9uYWwgd2hlbiB1c2VkIHdpdGgge0BsaW5rIFJlbmRlckNvbXBvbmVudH0gYW5kIHdpbGwgdXNlIHRoZSBub2RlIHRoZVxuICAgICAqIGNvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG1lc2ggaW5zdGFuY2UgcG9pbnRpbmcgdG8gYSAxeDF4MSAnY3ViZScgbWVzaFxuICAgICAqIHZhciBtZXNoID0gcGMuY3JlYXRlQm94KGdyYXBoaWNzRGV2aWNlKTtcbiAgICAgKiB2YXIgbWF0ZXJpYWwgPSBuZXcgcGMuU3RhbmRhcmRNYXRlcmlhbCgpO1xuICAgICAqXG4gICAgICogdmFyIG1lc2hJbnN0YW5jZSA9IG5ldyBwYy5NZXNoSW5zdGFuY2UobWVzaCwgbWF0ZXJpYWwpO1xuICAgICAqXG4gICAgICogdmFyIGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAgICAgKiBlbnRpdHkuYWRkQ29tcG9uZW50KCdyZW5kZXInLCB7XG4gICAgICogICAgIG1lc2hJbnN0YW5jZXM6IFttZXNoSW5zdGFuY2VdXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBBZGQgdGhlIGVudGl0eSB0byB0aGUgc2NlbmUgaGllcmFyY2h5XG4gICAgICogdGhpcy5hcHAuc2NlbmUucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1lc2gsIG1hdGVyaWFsLCBub2RlID0gbnVsbCkge1xuICAgICAgICAvLyBpZiBmaXJzdCBwYXJhbWV0ZXIgaXMgb2YgR3JhcGhOb2RlIHR5cGUsIGhhbmRsZSBwcmV2aW91cyBjb25zdHJ1Y3RvciBzaWduYXR1cmU6IChub2RlLCBtZXNoLCBtYXRlcmlhbClcbiAgICAgICAgaWYgKG1lc2ggaW5zdGFuY2VvZiBHcmFwaE5vZGUpIHtcbiAgICAgICAgICAgIGNvbnN0IHRlbXAgPSBtZXNoO1xuICAgICAgICAgICAgbWVzaCA9IG1hdGVyaWFsO1xuICAgICAgICAgICAgbWF0ZXJpYWwgPSBub2RlO1xuICAgICAgICAgICAgbm9kZSA9IHRlbXA7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9rZXkgPSBbMCwgMF07XG5cbiAgICAgICAgdGhpcy5pc1N0YXRpYyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zdGF0aWNMaWdodExpc3QgPSBudWxsO1xuICAgICAgICB0aGlzLl9zdGF0aWNTb3VyY2UgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZ3JhcGggbm9kZSBkZWZpbmluZyB0aGUgdHJhbnNmb3JtIGZvciB0aGlzIGluc3RhbmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ub2RlID0gbm9kZTsgICAgICAgICAgIC8vIFRoZSBub2RlIHRoYXQgZGVmaW5lcyB0aGUgdHJhbnNmb3JtIG9mIHRoZSBtZXNoIGluc3RhbmNlXG4gICAgICAgIHRoaXMuX21lc2ggPSBtZXNoOyAgICAgICAgICAvLyBUaGUgbWVzaCB0aGF0IHRoaXMgaW5zdGFuY2UgcmVuZGVyc1xuICAgICAgICBtZXNoLmluY1JlZkNvdW50KCk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBtYXRlcmlhbDsgICAvLyBUaGUgbWF0ZXJpYWwgd2l0aCB3aGljaCB0byByZW5kZXIgdGhpcyBpbnN0YW5jZVxuXG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBNQVNLX0FGRkVDVF9EWU5BTUlDIDw8IDE2OyAvLyAyIGJ5dGUgdG9nZ2xlcywgMiBieXRlcyBsaWdodCBtYXNrOyBEZWZhdWx0IHZhbHVlIGlzIG5vIHRvZ2dsZXMgYW5kIG1hc2sgPSBwYy5NQVNLX0FGRkVDVF9EWU5BTUlDXG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgfD0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc1V2MCA/IFNIQURFUkRFRl9VVjAgOiAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzIHw9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNVdjEgPyBTSEFERVJERUZfVVYxIDogMDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzQ29sb3IgPyBTSEFERVJERUZfVkNPTE9SIDogMDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzVGFuZ2VudHMgPyBTSEFERVJERUZfVEFOR0VOVFMgOiAwO1xuXG4gICAgICAgIHRoaXMuX2xpZ2h0SGFzaCA9IDA7XG5cbiAgICAgICAgLy8gUmVuZGVyIG9wdGlvbnNcbiAgICAgICAgdGhpcy5sYXllciA9IExBWUVSX1dPUkxEOyAvLyBsZWdhY3lcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3JlbmRlclN0eWxlID0gUkVOREVSU1RZTEVfU09MSUQ7XG4gICAgICAgIHRoaXMuX3JlY2VpdmVTaGFkb3cgPSB0cnVlO1xuICAgICAgICB0aGlzLl9zY3JlZW5TcGFjZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9ub0RlcHRoRHJhd0dsMSA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb250cm9scyB3aGV0aGVyIHRoZSBtZXNoIGluc3RhbmNlIGNhbiBiZSBjdWxsZWQgYnkgZnJ1c3R1bSBjdWxsaW5nXG4gICAgICAgICAqICh7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2ZydXN0dW1DdWxsaW5nfSkuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdWxsID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJ1ZSBpZiB0aGUgbWVzaCBpbnN0YW5jZSBpcyBwaWNrYWJsZSBieSB0aGUge0BsaW5rIFBpY2tlcn0uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBpY2sgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmIgPSB0cnVlO1xuICAgICAgICB0aGlzLl91cGRhdGVBYWJiRnVuYyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgLy8gNjQtYml0IGludGVnZXIga2V5IHRoYXQgZGVmaW5lcyByZW5kZXIgb3JkZXIgb2YgdGhpcyBtZXNoIGluc3RhbmNlXG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc2tpbi1pbnN0YW5jZS5qcycpLlNraW5JbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21vcnBoLWluc3RhbmNlLmpzJykuTW9ycGhJbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gbnVsbDtcblxuICAgICAgICAvLyBXb3JsZCBzcGFjZSBBQUJCXG4gICAgICAgIHRoaXMuYWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICB0aGlzLl9hYWJiVmVyID0gLTE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZSB0aGlzIHZhbHVlIHRvIGFmZmVjdCByZW5kZXJpbmcgb3JkZXIgb2YgbWVzaCBpbnN0YW5jZXMuIE9ubHkgdXNlZCB3aGVuIG1lc2hcbiAgICAgICAgICogaW5zdGFuY2VzIGFyZSBhZGRlZCB0byBhIHtAbGluayBMYXllcn0gd2l0aCB7QGxpbmsgTGF5ZXIjb3BhcXVlU29ydE1vZGV9IG9yXG4gICAgICAgICAqIHtAbGluayBMYXllciN0cmFuc3BhcmVudFNvcnRNb2RlfSAoZGVwZW5kaW5nIG9uIHRoZSBtYXRlcmlhbCkgc2V0IHRvXG4gICAgICAgICAqIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWFkIHRoaXMgdmFsdWUgaW4ge0BsaW5rIExheWVyI29uUG9zdEN1bGx9IHRvIGRldGVybWluZSBpZiB0aGUgb2JqZWN0IGlzIGFjdHVhbGx5IGdvaW5nXG4gICAgICAgICAqIHRvIGJlIHJlbmRlcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmlzaWJsZVRoaXNGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGN1c3RvbSBmdW5jdGlvbiB1c2VkIHRvIGN1c3RvbWl6ZSBjdWxsaW5nIChlLmcuIGZvciAyRCBVSSBlbGVtZW50cylcbiAgICAgICAgdGhpcy5pc1Zpc2libGVGdW5jID0gbnVsbDtcblxuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGcm9udCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3RlbmNpbEJhY2sgPSBudWxsO1xuXG4gICAgICAgIC8vIE5lZ2F0aXZlIHNjYWxlIGJhdGNoaW5nIHN1cHBvcnRcbiAgICAgICAgdGhpcy5mbGlwRmFjZXNGYWN0b3IgPSAxO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSByZW5kZXIgc3R5bGUgb2YgdGhlIG1lc2ggaW5zdGFuY2UuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFJFTkRFUlNUWUxFX1NPTElEfVxuICAgICAqIC0ge0BsaW5rIFJFTkRFUlNUWUxFX1dJUkVGUkFNRX1cbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9QT0lOVFN9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgUkVOREVSU1RZTEVfU09MSUR9LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcmVuZGVyU3R5bGUocmVuZGVyU3R5bGUpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyU3R5bGUgPSByZW5kZXJTdHlsZTtcbiAgICAgICAgdGhpcy5tZXNoLnByZXBhcmVSZW5kZXJTdGF0ZShyZW5kZXJTdHlsZSk7XG4gICAgfVxuXG4gICAgZ2V0IHJlbmRlclN0eWxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyU3R5bGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGdyYXBoaWNzIG1lc2ggYmVpbmcgaW5zdGFuY2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9tZXNoLmpzJykuTWVzaH1cbiAgICAgKi9cbiAgICBzZXQgbWVzaChtZXNoKSB7XG5cbiAgICAgICAgaWYgKG1lc2ggPT09IHRoaXMuX21lc2gpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX21lc2gpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2guZGVjUmVmQ291bnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21lc2ggPSBtZXNoO1xuXG4gICAgICAgIGlmIChtZXNoKSB7XG4gICAgICAgICAgICBtZXNoLmluY1JlZkNvdW50KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWVzaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21lc2g7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHdvcmxkIHNwYWNlIGF4aXMtYWxpZ25lZCBib3VuZGluZyBib3ggZm9yIHRoaXMgbWVzaCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtCb3VuZGluZ0JveH1cbiAgICAgKi9cbiAgICBzZXQgYWFiYihhYWJiKSB7XG4gICAgICAgIHRoaXMuX2FhYmIgPSBhYWJiO1xuICAgIH1cblxuICAgIGdldCBhYWJiKCkge1xuICAgICAgICAvLyB1c2Ugc3BlY2lmaWVkIHdvcmxkIHNwYWNlIGFhYmJcbiAgICAgICAgaWYgKCF0aGlzLl91cGRhdGVBYWJiKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fYWFiYjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNhbGxiYWNrIGZ1bmN0aW9uIHJldHVybmluZyB3b3JsZCBzcGFjZSBhYWJiXG4gICAgICAgIGlmICh0aGlzLl91cGRhdGVBYWJiRnVuYykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3VwZGF0ZUFhYmJGdW5jKHRoaXMuX2FhYmIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXNlIGxvY2FsIHNwYWNlIG92ZXJyaWRlIGFhYmIgaWYgc3BlY2lmaWVkXG4gICAgICAgIGxldCBsb2NhbEFhYmIgPSB0aGlzLl9jdXN0b21BYWJiO1xuICAgICAgICBsZXQgdG9Xb3JsZFNwYWNlID0gISFsb2NhbEFhYmI7XG5cbiAgICAgICAgLy8gb3RoZXJ3aXNlIGV2YWx1YXRlIGxvY2FsIGFhYmJcbiAgICAgICAgaWYgKCFsb2NhbEFhYmIpIHtcblxuICAgICAgICAgICAgbG9jYWxBYWJiID0gX3RtcEFhYmI7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLnNraW5JbnN0YW5jZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSBsb2NhbCBib25lIEFBQkJzIGlmIG5lZWRlZFxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5tZXNoLmJvbmVBYWJiKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0cyA9IHRoaXMuX21vcnBoSW5zdGFuY2UgPyB0aGlzLl9tb3JwaEluc3RhbmNlLm1vcnBoLl90YXJnZXRzIDogbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tZXNoLl9pbml0Qm9uZUFhYmJzKG1vcnBoVGFyZ2V0cyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZXZhbHVhdGUgbG9jYWwgc3BhY2UgYm91bmRzIGJhc2VkIG9uIGFsbCBhY3RpdmUgYm9uZXNcbiAgICAgICAgICAgICAgICBjb25zdCBib25lVXNlZCA9IHRoaXMubWVzaC5ib25lVXNlZDtcbiAgICAgICAgICAgICAgICBsZXQgZmlyc3QgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm1lc2guYm9uZUFhYmIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGJvbmVVc2VkW2ldKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRyYW5zZm9ybSBib25lIEFBQkIgYnkgYm9uZSBtYXRyaXhcbiAgICAgICAgICAgICAgICAgICAgICAgIF90ZW1wQm9uZUFhYmIuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYih0aGlzLm1lc2guYm9uZUFhYmJbaV0sIHRoaXMuc2tpbkluc3RhbmNlLm1hdHJpY2VzW2ldKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZW0gdXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChmaXJzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmNlbnRlci5jb3B5KF90ZW1wQm9uZUFhYmIuY2VudGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuaGFsZkV4dGVudHMuY29weShfdGVtcEJvbmVBYWJiLmhhbGZFeHRlbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmFkZChfdGVtcEJvbmVBYWJiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRvV29ybGRTcGFjZSA9IHRydWU7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5ub2RlLl9hYWJiVmVyICE9PSB0aGlzLl9hYWJiVmVyKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBsb2NhbCBzcGFjZSBib3VuZGluZyBib3ggLSBlaXRoZXIgZnJvbSBtZXNoIG9yIGVtcHR5XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubWVzaCkge1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuY2VudGVyLmNvcHkodGhpcy5tZXNoLmFhYmIuY2VudGVyKTtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmhhbGZFeHRlbnRzLmNvcHkodGhpcy5tZXNoLmFhYmIuaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5jZW50ZXIuc2V0KDAsIDAsIDApO1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuaGFsZkV4dGVudHMuc2V0KDAsIDAsIDApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBsb2NhbCBzcGFjZSBib3VuZGluZyBib3ggYnkgbW9ycGggdGFyZ2V0c1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1lc2ggJiYgdGhpcy5tZXNoLm1vcnBoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1vcnBoQWFiYiA9IHRoaXMubWVzaC5tb3JwaC5hYWJiO1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuX2V4cGFuZChtb3JwaEFhYmIuZ2V0TWluKCksIG1vcnBoQWFiYi5nZXRNYXgoKSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdG9Xb3JsZFNwYWNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hYWJiVmVyID0gdGhpcy5ub2RlLl9hYWJiVmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RvcmUgd29ybGQgc3BhY2UgYm91bmRpbmcgYm94XG4gICAgICAgIGlmICh0b1dvcmxkU3BhY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2FhYmIuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihsb2NhbEFhYmIsIHRoaXMubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9hYWJiO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFyIHRoZSBpbnRlcm5hbCBzaGFkZXIgYXJyYXkuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY2xlYXJTaGFkZXJzKCkge1xuICAgICAgICBjb25zdCBzaGFkZXJzID0gdGhpcy5fc2hhZGVyO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNoYWRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHNoYWRlcnNbaV0gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kZXN0cm95QmluZEdyb3VwcygpO1xuICAgIH1cblxuICAgIGRlc3Ryb3lCaW5kR3JvdXBzKCkge1xuXG4gICAgICAgIGNvbnN0IGdyb3VwcyA9IHRoaXMuX2JpbmRHcm91cHM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ3JvdXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBncm91cCA9IGdyb3Vwc1tpXTtcbiAgICAgICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHVuaWZvcm1CdWZmZXIgPSBncm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBpZiAodW5pZm9ybUJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICB1bmlmb3JtQnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZ3JvdXAuZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGdyb3Vwcy5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwYXNzIC0gU2hhZGVyIHBhc3MgbnVtYmVyLlxuICAgICAqIEByZXR1cm5zIHtCaW5kR3JvdXB9IC0gVGhlIG1lc2ggYmluZCBncm91cC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0QmluZEdyb3VwKGRldmljZSwgcGFzcykge1xuXG4gICAgICAgIC8vIGNyZWF0ZSBiaW5kIGdyb3VwXG4gICAgICAgIGxldCBiaW5kR3JvdXAgPSB0aGlzLl9iaW5kR3JvdXBzW3Bhc3NdO1xuICAgICAgICBpZiAoIWJpbmRHcm91cCkge1xuICAgICAgICAgICAgY29uc3Qgc2hhZGVyID0gdGhpcy5fc2hhZGVyW3Bhc3NdO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHNoYWRlcik7XG5cbiAgICAgICAgICAgIC8vIG1lc2ggdW5pZm9ybSBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IHViRm9ybWF0ID0gc2hhZGVyLm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0O1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHViRm9ybWF0KTtcbiAgICAgICAgICAgIGNvbnN0IHVuaWZvcm1CdWZmZXIgPSBuZXcgVW5pZm9ybUJ1ZmZlcihkZXZpY2UsIHViRm9ybWF0KTtcblxuICAgICAgICAgICAgLy8gbWVzaCBiaW5kIGdyb3VwXG4gICAgICAgICAgICBjb25zdCBiaW5kR3JvdXBGb3JtYXQgPSBzaGFkZXIubWVzaEJpbmRHcm91cEZvcm1hdDtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChiaW5kR3JvdXBGb3JtYXQpO1xuICAgICAgICAgICAgYmluZEdyb3VwID0gbmV3IEJpbmRHcm91cChkZXZpY2UsIGJpbmRHcm91cEZvcm1hdCwgdW5pZm9ybUJ1ZmZlcik7XG4gICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKGJpbmRHcm91cCwgYE1lc2hCaW5kR3JvdXBfJHtiaW5kR3JvdXAuaWR9YCk7XG5cbiAgICAgICAgICAgIHRoaXMuX2JpbmRHcm91cHNbcGFzc10gPSBiaW5kR3JvdXA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYmluZEdyb3VwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXRlcmlhbCB1c2VkIGJ5IHRoaXMgbWVzaCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsKG1hdGVyaWFsKSB7XG5cbiAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcblxuICAgICAgICBjb25zdCBwcmV2TWF0ID0gdGhpcy5fbWF0ZXJpYWw7XG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBtYXRlcmlhbCdzIHJlZmVyZW5jZSB0byB0aGlzIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgaWYgKHByZXZNYXQpIHtcbiAgICAgICAgICAgIHByZXZNYXQucmVtb3ZlTWVzaEluc3RhbmNlUmVmKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBtYXRlcmlhbDtcblxuICAgICAgICBpZiAobWF0ZXJpYWwpIHtcblxuICAgICAgICAgICAgLy8gUmVjb3JkIHRoYXQgdGhlIG1hdGVyaWFsIGlzIHJlZmVyZW5jZWQgYnkgdGhpcyBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICBtYXRlcmlhbC5hZGRNZXNoSW5zdGFuY2VSZWYodGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgICAgIC8vIGlmIGJsZW5kIHR5cGUgb2YgdGhlIG1hdGVyaWFsIGNoYW5nZXNcbiAgICAgICAgICAgIGNvbnN0IHByZXZCbGVuZCA9IHByZXZNYXQgJiYgcHJldk1hdC50cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC50cmFuc3BhcmVudCAhPT0gcHJldkJsZW5kKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLl9tYXRlcmlhbC5fc2NlbmUgfHwgcHJldk1hdD8uX3NjZW5lO1xuICAgICAgICAgICAgICAgIGlmIChzY2VuZSkge1xuICAgICAgICAgICAgICAgICAgICBzY2VuZS5sYXllcnMuX2RpcnR5QmxlbmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICBzZXQgbGF5ZXIobGF5ZXIpIHtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbiBzb21lIGNpcmN1bXN0YW5jZXMgbWVzaCBpbnN0YW5jZXMgYXJlIHNvcnRlZCBieSBhIGRpc3RhbmNlIGNhbGN1bGF0aW9uIHRvIGRldGVybWluZSB0aGVpclxuICAgICAqIHJlbmRlcmluZyBvcmRlci4gU2V0IHRoaXMgY2FsbGJhY2sgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHQgZGlzdGFuY2UgY2FsY3VsYXRpb24sIHdoaWNoIGdpdmVzXG4gICAgICogdGhlIGRvdCBwcm9kdWN0IG9mIHRoZSBjYW1lcmEgZm9yd2FyZCB2ZWN0b3IgYW5kIHRoZSB2ZWN0b3IgYmV0d2VlbiB0aGUgY2FtZXJhIHBvc2l0aW9uIGFuZFxuICAgICAqIHRoZSBjZW50ZXIgb2YgdGhlIG1lc2ggaW5zdGFuY2UncyBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94LiBUaGlzIG9wdGlvbiBjYW4gYmUgcGFydGljdWxhcmx5XG4gICAgICogdXNlZnVsIGZvciByZW5kZXJpbmcgdHJhbnNwYXJlbnQgbWVzaGVzIGluIGEgYmV0dGVyIG9yZGVyIHRoYW4gZGVmYXVsdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDYWxjdWxhdGVTb3J0RGlzdGFuY2VDYWxsYmFja31cbiAgICAgKi9cbiAgICBzZXQgY2FsY3VsYXRlU29ydERpc3RhbmNlKGNhbGN1bGF0ZVNvcnREaXN0YW5jZSkge1xuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTb3J0RGlzdGFuY2UgPSBjYWxjdWxhdGVTb3J0RGlzdGFuY2U7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZVNvcnREaXN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZTtcbiAgICB9XG5cbiAgICBzZXQgcmVjZWl2ZVNoYWRvdyh2YWwpIHtcbiAgICAgICAgdGhpcy5fcmVjZWl2ZVNoYWRvdyA9IHZhbDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IHZhbCA/ICh0aGlzLl9zaGFkZXJEZWZzICYgflNIQURFUkRFRl9OT1NIQURPVykgOiAodGhpcy5fc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9OT1NIQURPVyk7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSRF0gPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRIRFJdID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgcmVjZWl2ZVNoYWRvdygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlY2VpdmVTaGFkb3c7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHNraW4gaW5zdGFuY2UgbWFuYWdpbmcgc2tpbm5pbmcgb2YgdGhpcyBtZXNoIGluc3RhbmNlLCBvciBudWxsIGlmIHNraW5uaW5nIGlzIG5vdCB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9za2luLWluc3RhbmNlLmpzJykuU2tpbkluc3RhbmNlfVxuICAgICAqL1xuICAgIHNldCBza2luSW5zdGFuY2UodmFsKSB7XG4gICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZSA9IHZhbDtcblxuICAgICAgICBsZXQgc2hhZGVyRGVmcyA9IHRoaXMuX3NoYWRlckRlZnM7XG4gICAgICAgIHNoYWRlckRlZnMgPSB2YWwgPyAoc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9TS0lOKSA6IChzaGFkZXJEZWZzICYgflNIQURFUkRFRl9TS0lOKTtcblxuICAgICAgICAvLyBpZiBzaGFkZXJEZWZzIGhhdmUgY2hhbmdlZFxuICAgICAgICBpZiAoc2hhZGVyRGVmcyAhPT0gdGhpcy5fc2hhZGVyRGVmcykge1xuICAgICAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IHNoYWRlckRlZnM7XG4gICAgICAgICAgICB0aGlzLmNsZWFyU2hhZGVycygpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3NldHVwU2tpblVwZGF0ZSgpO1xuICAgIH1cblxuICAgIGdldCBza2luSW5zdGFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9za2luSW5zdGFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1vcnBoIGluc3RhbmNlIG1hbmFnaW5nIG1vcnBoaW5nIG9mIHRoaXMgbWVzaCBpbnN0YW5jZSwgb3IgbnVsbCBpZiBtb3JwaGluZyBpcyBub3QgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbW9ycGgtaW5zdGFuY2UuanMnKS5Nb3JwaEluc3RhbmNlfVxuICAgICAqL1xuICAgIHNldCBtb3JwaEluc3RhbmNlKHZhbCkge1xuXG4gICAgICAgIC8vIHJlbGVhc2UgZXhpc3RpbmdcbiAgICAgICAgdGhpcy5fbW9ycGhJbnN0YW5jZT8uZGVzdHJveSgpO1xuXG4gICAgICAgIC8vIGFzc2lnbiBuZXdcbiAgICAgICAgdGhpcy5fbW9ycGhJbnN0YW5jZSA9IHZhbDtcblxuICAgICAgICBsZXQgc2hhZGVyRGVmcyA9IHRoaXMuX3NoYWRlckRlZnM7XG4gICAgICAgIHNoYWRlckRlZnMgPSAodmFsICYmIHZhbC5tb3JwaC51c2VUZXh0dXJlTW9ycGgpID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCkgOiAoc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCk7XG4gICAgICAgIHNoYWRlckRlZnMgPSAodmFsICYmIHZhbC5tb3JwaC5tb3JwaFBvc2l0aW9ucykgPyAoc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9NT1JQSF9QT1NJVElPTikgOiAoc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfTU9SUEhfUE9TSVRJT04pO1xuICAgICAgICBzaGFkZXJEZWZzID0gKHZhbCAmJiB2YWwubW9ycGgubW9ycGhOb3JtYWxzKSA/IChzaGFkZXJEZWZzIHwgU0hBREVSREVGX01PUlBIX05PUk1BTCkgOiAoc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfTU9SUEhfTk9STUFMKTtcblxuICAgICAgICAvLyBpZiBzaGFkZXJEZWZzIGhhdmUgY2hhbmdlZFxuICAgICAgICBpZiAoc2hhZGVyRGVmcyAhPT0gdGhpcy5fc2hhZGVyRGVmcykge1xuICAgICAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IHNoYWRlckRlZnM7XG4gICAgICAgICAgICB0aGlzLmNsZWFyU2hhZGVycygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1vcnBoSW5zdGFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tb3JwaEluc3RhbmNlO1xuICAgIH1cblxuICAgIHNldCBzY3JlZW5TcGFjZSh2YWwpIHtcbiAgICAgICAgdGhpcy5fc2NyZWVuU3BhY2UgPSB2YWw7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSB2YWwgPyAodGhpcy5fc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9TQ1JFRU5TUEFDRSkgOiAodGhpcy5fc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfU0NSRUVOU1BBQ0UpO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRdID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgc2NyZWVuU3BhY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zY3JlZW5TcGFjZTtcbiAgICB9XG5cbiAgICBzZXQga2V5KHZhbCkge1xuICAgICAgICB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXSA9IHZhbDtcbiAgICB9XG5cbiAgICBnZXQga2V5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFzayBjb250cm9sbGluZyB3aGljaCB7QGxpbmsgTGlnaHRDb21wb25lbnR9cyBsaWdodCB0aGlzIG1lc2ggaW5zdGFuY2UsIHdoaWNoXG4gICAgICoge0BsaW5rIENhbWVyYUNvbXBvbmVudH0gc2VlcyBpdCBhbmQgaW4gd2hpY2gge0BsaW5rIExheWVyfSBpdCBpcyByZW5kZXJlZC4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1hc2sodmFsKSB7XG4gICAgICAgIGNvbnN0IHRvZ2dsZXMgPSB0aGlzLl9zaGFkZXJEZWZzICYgMHgwMDAwRkZGRjtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IHRvZ2dsZXMgfCAodmFsIDw8IDE2KTtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJEXSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSREhEUl0gPSBudWxsO1xuICAgIH1cblxuICAgIGdldCBtYXNrKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2hhZGVyRGVmcyA+PiAxNjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBOdW1iZXIgb2YgaW5zdGFuY2VzIHdoZW4gdXNpbmcgaGFyZHdhcmUgaW5zdGFuY2luZyB0byByZW5kZXIgdGhlIG1lc2guXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBpbnN0YW5jaW5nQ291bnQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuaW5zdGFuY2luZ0RhdGEpXG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhLmNvdW50ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGluc3RhbmNpbmdDb3VudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5zdGFuY2luZ0RhdGEgPyB0aGlzLmluc3RhbmNpbmdEYXRhLmNvdW50IDogMDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIGNvbnN0IG1lc2ggPSB0aGlzLm1lc2g7XG4gICAgICAgIGlmIChtZXNoKSB7XG5cbiAgICAgICAgICAgIC8vIHRoaXMgZGVjcmVhc2VzIHJlZiBjb3VudCBvbiB0aGUgbWVzaFxuICAgICAgICAgICAgdGhpcy5tZXNoID0gbnVsbDtcblxuICAgICAgICAgICAgLy8gZGVzdHJveSBtZXNoXG4gICAgICAgICAgICBpZiAobWVzaC5yZWZDb3VudCA8IDEpIHtcbiAgICAgICAgICAgICAgICBtZXNoLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbGVhc2UgcmVmIGNvdW50ZWQgbGlnaHRtYXBzXG4gICAgICAgIHRoaXMuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzBdLCBudWxsKTtcbiAgICAgICAgdGhpcy5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMV0sIG51bGwpO1xuXG4gICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZT8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMubW9ycGhJbnN0YW5jZT8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLm1vcnBoSW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuY2xlYXJTaGFkZXJzKCk7XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIG1hdGVyaWFsIGNsZWFycyByZWZlcmVuY2VzIHRvIHRoaXMgbWVzaEluc3RhbmNlXG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBudWxsO1xuICAgIH1cblxuICAgIC8vIHNoYWRlciB1bmlmb3JtIG5hbWVzIGZvciBsaWdodG1hcHNcbiAgICBzdGF0aWMgbGlnaHRtYXBQYXJhbU5hbWVzID0gWyd0ZXh0dXJlX2xpZ2h0TWFwJywgJ3RleHR1cmVfZGlyTGlnaHRNYXAnXTtcblxuICAgIC8vIGdlbmVyYXRlcyB3aXJlZnJhbWVzIGZvciBhbiBhcnJheSBvZiBtZXNoIGluc3RhbmNlc1xuICAgIHN0YXRpYyBfcHJlcGFyZVJlbmRlclN0eWxlRm9yQXJyYXkobWVzaEluc3RhbmNlcywgcmVuZGVyU3R5bGUpIHtcblxuICAgICAgICBpZiAobWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBzd2l0Y2ggbWVzaCBpbnN0YW5jZSB0byB0aGUgcmVxdWVzdGVkIHN0eWxlXG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5fcmVuZGVyU3R5bGUgPSByZW5kZXJTdHlsZTtcblxuICAgICAgICAgICAgICAgIC8vIHByb2Nlc3MgYWxsIHVuaXF1ZSBtZXNoZXNcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gbWVzaEluc3RhbmNlc1tpXS5tZXNoO1xuICAgICAgICAgICAgICAgIGlmICghX21lc2hTZXQuaGFzKG1lc2gpKSB7XG4gICAgICAgICAgICAgICAgICAgIF9tZXNoU2V0LmFkZChtZXNoKTtcbiAgICAgICAgICAgICAgICAgICAgbWVzaC5wcmVwYXJlUmVuZGVyU3RhdGUocmVuZGVyU3R5bGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX21lc2hTZXQuY2xlYXIoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRlc3QgaWYgbWVzaEluc3RhbmNlIGlzIHZpc2libGUgYnkgY2FtZXJhLiBJdCByZXF1aXJlcyB0aGUgZnJ1c3R1bSBvZiB0aGUgY2FtZXJhIHRvIGJlIHVwIHRvIGRhdGUsIHdoaWNoIGZvcndhcmQtcmVuZGVyZXJcbiAgICAvLyB0YWtlcyBjYXJlIG9mLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCAgbm90IGJlIGNhbGxlZCBlbHNld2hlcmUuXG4gICAgX2lzVmlzaWJsZShjYW1lcmEpIHtcblxuICAgICAgICBpZiAodGhpcy52aXNpYmxlKSB7XG5cbiAgICAgICAgICAgIC8vIGN1c3RvbSB2aXNpYmlsaXR5IG1ldGhvZCBvZiBNZXNoSW5zdGFuY2VcbiAgICAgICAgICAgIGlmICh0aGlzLmlzVmlzaWJsZUZ1bmMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5pc1Zpc2libGVGdW5jKGNhbWVyYSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF90ZW1wU3BoZXJlLmNlbnRlciA9IHRoaXMuYWFiYi5jZW50ZXI7ICAvLyB0aGlzIGxpbmUgZXZhbHVhdGVzIGFhYmJcbiAgICAgICAgICAgIF90ZW1wU3BoZXJlLnJhZGl1cyA9IHRoaXMuX2FhYmIuaGFsZkV4dGVudHMubGVuZ3RoKCk7XG5cbiAgICAgICAgICAgIHJldHVybiBjYW1lcmEuZnJ1c3R1bS5jb250YWluc1NwaGVyZShfdGVtcFNwaGVyZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgdXBkYXRlS2V5KCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHRoaXMubWF0ZXJpYWw7XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gZ2V0S2V5KHRoaXMubGF5ZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChtYXRlcmlhbC5hbHBoYVRvQ292ZXJhZ2UgfHwgbWF0ZXJpYWwuYWxwaGFUZXN0KSA/IEJMRU5EX05PUk1BTCA6IG1hdGVyaWFsLmJsZW5kVHlwZSwgLy8gcmVuZGVyIGFscGhhdGVzdC9hdG9jIGFmdGVyIG9wYXF1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxzZSwgbWF0ZXJpYWwuaWQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdXAge0BsaW5rIE1lc2hJbnN0YW5jZX0gdG8gYmUgcmVuZGVyZWQgdXNpbmcgSGFyZHdhcmUgSW5zdGFuY2luZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJykuVmVydGV4QnVmZmVyfG51bGx9IHZlcnRleEJ1ZmZlciAtIFZlcnRleCBidWZmZXIgdG8gaG9sZCBwZXItaW5zdGFuY2UgdmVydGV4IGRhdGFcbiAgICAgKiAodXN1YWxseSB3b3JsZCBtYXRyaWNlcykuIFBhc3MgbnVsbCB0byB0dXJuIG9mZiBoYXJkd2FyZSBpbnN0YW5jaW5nLlxuICAgICAqL1xuICAgIHNldEluc3RhbmNpbmcodmVydGV4QnVmZmVyKSB7XG4gICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEgPSBuZXcgSW5zdGFuY2luZ0RhdGEodmVydGV4QnVmZmVyLm51bVZlcnRpY2VzKTtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyO1xuXG4gICAgICAgICAgICAvLyBtYXJrIHZlcnRleCBidWZmZXIgYXMgaW5zdGFuY2luZyBkYXRhXG4gICAgICAgICAgICB2ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmluc3RhbmNpbmcgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyB0dXJuIG9mZiBjdWxsaW5nIC0gd2UgZG8gbm90IGRvIHBlci1pbnN0YW5jZSBjdWxsaW5nLCBhbGwgaW5zdGFuY2VzIGFyZSBzdWJtaXR0ZWQgdG8gR1BVXG4gICAgICAgICAgICB0aGlzLmN1bGwgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5jdWxsID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE9idGFpbiBhIHNoYWRlciB2YXJpYW50IHJlcXVpcmVkIHRvIHJlbmRlciB0aGUgbWVzaCBpbnN0YW5jZSB3aXRoaW4gc3BlY2lmaWVkIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zY2VuZS5qcycpLlNjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcGFzcyAtIFRoZSByZW5kZXIgcGFzcy5cbiAgICAgKiBAcGFyYW0ge2FueX0gc3RhdGljTGlnaHRMaXN0IC0gTGlzdCBvZiBzdGF0aWMgbGlnaHRzLlxuICAgICAqIEBwYXJhbSB7YW55fSBzb3J0ZWRMaWdodHMgLSBBcnJheSBvZiBhcnJheXMgb2YgbGlnaHRzLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy91bmlmb3JtLWJ1ZmZlci1mb3JtYXQuanMnKS5Vbmlmb3JtQnVmZmVyRm9ybWF0fSB2aWV3VW5pZm9ybUZvcm1hdCAtIFRoZVxuICAgICAqIGZvcm1hdCBvZiB0aGUgdmlldyB1bmlmb3JtIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC1mb3JtYXQuanMnKS5CaW5kR3JvdXBGb3JtYXR9IHZpZXdCaW5kR3JvdXBGb3JtYXQgLSBUaGVcbiAgICAgKiBmb3JtYXQgb2YgdGhlIHZpZXcgYmluZCBncm91cC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgcGFzcywgc3RhdGljTGlnaHRMaXN0LCBzb3J0ZWRMaWdodHMsIHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0KSB7XG4gICAgICAgIHRoaXMuX3NoYWRlcltwYXNzXSA9IHRoaXMubWF0ZXJpYWwuZ2V0U2hhZGVyVmFyaWFudCh0aGlzLm1lc2guZGV2aWNlLCBzY2VuZSwgdGhpcy5fc2hhZGVyRGVmcywgc3RhdGljTGlnaHRMaXN0LCBwYXNzLCBzb3J0ZWRMaWdodHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCwgdGhpcy5fbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0KTtcbiAgICB9XG5cbiAgICBlbnN1cmVNYXRlcmlhbChkZXZpY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1hdGVyaWFsKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBNZXNoIGF0dGFjaGVkIHRvIGVudGl0eSAnJHt0aGlzLm5vZGUubmFtZX0nIGRvZXMgbm90IGhhdmUgYSBtYXRlcmlhbCwgdXNpbmcgYSBkZWZhdWx0IG9uZS5gKTtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwgPSBnZXREZWZhdWx0TWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFBhcmFtZXRlciBtYW5hZ2VtZW50XG4gICAgY2xlYXJQYXJhbWV0ZXJzKCkge1xuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcbiAgICB9XG5cbiAgICBnZXRQYXJhbWV0ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgc3BlY2lmaWVkIHNoYWRlciBwYXJhbWV0ZXIgZnJvbSBhIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gcXVlcnkuXG4gICAgICogQHJldHVybnMge29iamVjdH0gVGhlIG5hbWVkIHBhcmFtZXRlci5cbiAgICAgKi9cbiAgICBnZXRQYXJhbWV0ZXIobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYSBzaGFkZXIgcGFyYW1ldGVyIG9uIGEgbWVzaCBpbnN0YW5jZS4gTm90ZSB0aGF0IHRoaXMgcGFyYW1ldGVyIHdpbGwgdGFrZSBwcmVjZWRlbmNlXG4gICAgICogb3ZlciBwYXJhbWV0ZXIgb2YgdGhlIHNhbWUgbmFtZSBpZiBzZXQgb24gTWF0ZXJpYWwgdGhpcyBtZXNoIGluc3RhbmNlIHVzZXMgZm9yIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW118aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gZGF0YSAtIFRoZSB2YWx1ZVxuICAgICAqIGZvciB0aGUgc3BlY2lmaWVkIHBhcmFtZXRlci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3Bhc3NGbGFnc10gLSBNYXNrIGRlc2NyaWJpbmcgd2hpY2ggcGFzc2VzIHRoZSBtYXRlcmlhbCBzaG91bGQgYmUgaW5jbHVkZWRcbiAgICAgKiBpbi5cbiAgICAgKi9cbiAgICBzZXRQYXJhbWV0ZXIobmFtZSwgZGF0YSwgcGFzc0ZsYWdzID0gLTI2MjE0MSkge1xuXG4gICAgICAgIC8vIG5vdGUgb24gLTI2MjE0MTogQWxsIGJpdHMgc2V0IGV4Y2VwdCAyIC0gMTkgcmFuZ2VcblxuICAgICAgICBpZiAoZGF0YSA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBuYW1lID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgY29uc3QgdW5pZm9ybU9iamVjdCA9IG5hbWU7XG4gICAgICAgICAgICBpZiAodW5pZm9ybU9iamVjdC5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVuaWZvcm1PYmplY3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXIodW5pZm9ybU9iamVjdFtpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG5hbWUgPSB1bmlmb3JtT2JqZWN0Lm5hbWU7XG4gICAgICAgICAgICBkYXRhID0gdW5pZm9ybU9iamVjdC52YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhcmFtID0gdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgICAgICBpZiAocGFyYW0pIHtcbiAgICAgICAgICAgIHBhcmFtLmRhdGEgPSBkYXRhO1xuICAgICAgICAgICAgcGFyYW0ucGFzc0ZsYWdzID0gcGFzc0ZsYWdzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5wYXJhbWV0ZXJzW25hbWVdID0ge1xuICAgICAgICAgICAgICAgIHNjb3BlSWQ6IG51bGwsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YSxcbiAgICAgICAgICAgICAgICBwYXNzRmxhZ3M6IHBhc3NGbGFnc1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGEgd3JhcHBlciBvdmVyIHNldHRpbmdzIHBhcmFtZXRlciBzcGVjaWZpY2FsbHkgZm9yIHJlYWx0aW1lIGJha2VkIGxpZ2h0bWFwcy4gVGhpcyBoYW5kbGVzIHJlZmVyZW5jZSBjb3VudGluZyBvZiBsaWdodG1hcHNcbiAgICAvLyBhbmQgcmVsZWFzZXMgdGhlbSB3aGVuIG5vIGxvbmdlciByZWZlcmVuY2VkXG4gICAgc2V0UmVhbHRpbWVMaWdodG1hcChuYW1lLCB0ZXh0dXJlKSB7XG5cbiAgICAgICAgLy8gbm8gY2hhbmdlXG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuZ2V0UGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICBpZiAob2xkID09PSB0ZXh0dXJlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIC8vIHJlbW92ZSBvbGRcbiAgICAgICAgaWYgKG9sZCkge1xuICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5kZWNSZWYob2xkLmRhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXNzaWduIG5ld1xuICAgICAgICBpZiAodGV4dHVyZSkge1xuICAgICAgICAgICAgTGlnaHRtYXBDYWNoZS5pbmNSZWYodGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLnNldFBhcmFtZXRlcihuYW1lLCB0ZXh0dXJlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZGVsZXRlUGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgIC8qKlxuICAgICAgKiBEZWxldGVzIGEgc2hhZGVyIHBhcmFtZXRlciBvbiBhIG1lc2ggaW5zdGFuY2UuXG4gICAgICAqXG4gICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBkZWxldGUuXG4gICAgICAqL1xuICAgIGRlbGV0ZVBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIGlmICh0aGlzLnBhcmFtZXRlcnNbbmFtZV0pIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBhcmFtZXRlcnNbbmFtZV07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB1c2VkIHRvIGFwcGx5IHBhcmFtZXRlcnMgZnJvbSB0aGlzIG1lc2ggaW5zdGFuY2UgaW50byBzY29wZSBvZiB1bmlmb3JtcywgY2FsbGVkIGludGVybmFsbHkgYnkgZm9yd2FyZC1yZW5kZXJlclxuICAgIHNldFBhcmFtZXRlcnMoZGV2aWNlLCBwYXNzRmxhZykge1xuICAgICAgICBjb25zdCBwYXJhbWV0ZXJzID0gdGhpcy5wYXJhbWV0ZXJzO1xuICAgICAgICBmb3IgKGNvbnN0IHBhcmFtTmFtZSBpbiBwYXJhbWV0ZXJzKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXIgPSBwYXJhbWV0ZXJzW3BhcmFtTmFtZV07XG4gICAgICAgICAgICBpZiAocGFyYW1ldGVyLnBhc3NGbGFncyAmIHBhc3NGbGFnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFwYXJhbWV0ZXIuc2NvcGVJZCkge1xuICAgICAgICAgICAgICAgICAgICBwYXJhbWV0ZXIuc2NvcGVJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKHBhcmFtTmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHBhcmFtZXRlci5zY29wZUlkLnNldFZhbHVlKHBhcmFtZXRlci5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldExpZ2h0bWFwcGVkKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5tYXNrID0gKHRoaXMubWFzayB8IE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEKSAmIH4oTUFTS19BRkZFQ1RfRFlOQU1JQyB8IE1BU0tfQkFLRSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbnVsbCk7XG4gICAgICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1sxXSwgbnVsbCk7XG4gICAgICAgICAgICB0aGlzLl9zaGFkZXJEZWZzICY9IH4oU0hBREVSREVGX0xNIHwgU0hBREVSREVGX0RJUkxNIHwgU0hBREVSREVGX0xNQU1CSUVOVCk7XG4gICAgICAgICAgICB0aGlzLm1hc2sgPSAodGhpcy5tYXNrIHwgTUFTS19BRkZFQ1RfRFlOQU1JQykgJiB+KE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIHwgTUFTS19CQUtFKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEN1c3RvbUFhYmIoYWFiYikge1xuXG4gICAgICAgIGlmIChhYWJiKSB7XG4gICAgICAgICAgICAvLyBzdG9yZSB0aGUgb3ZlcnJpZGUgYWFiYlxuICAgICAgICAgICAgaWYgKHRoaXMuX2N1c3RvbUFhYmIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXN0b21BYWJiLmNvcHkoYWFiYik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2N1c3RvbUFhYmIgPSBhYWJiLmNsb25lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyBvdmVycmlkZSwgZm9yY2UgcmVmcmVzaCB0aGUgYWN0dWFsIG9uZVxuICAgICAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9hYWJiVmVyID0gLTE7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXR1cFNraW5VcGRhdGUoKTtcbiAgICB9XG5cbiAgICBfc2V0dXBTa2luVXBkYXRlKCkge1xuXG4gICAgICAgIC8vIHNldCBpZiBib25lcyBuZWVkIHRvIGJlIHVwZGF0ZWQgYmVmb3JlIGN1bGxpbmdcbiAgICAgICAgaWYgKHRoaXMuX3NraW5JbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlLl91cGRhdGVCZWZvcmVDdWxsID0gIXRoaXMuX2N1c3RvbUFhYmI7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldEtleShsYXllciwgYmxlbmRUeXBlLCBpc0NvbW1hbmQsIG1hdGVyaWFsSWQpIHtcbiAgICAvLyBLZXkgZGVmaW5pdGlvbjpcbiAgICAvLyBCaXRcbiAgICAvLyAzMSAgICAgIDogc2lnbiBiaXQgKGxlYXZlKVxuICAgIC8vIDI3IC0gMzAgOiBsYXllclxuICAgIC8vIDI2ICAgICAgOiB0cmFuc2x1Y2VuY3kgdHlwZSAob3BhcXVlL3RyYW5zcGFyZW50KVxuICAgIC8vIDI1ICAgICAgOiBDb21tYW5kIGJpdCAoMTogdGhpcyBrZXkgaXMgZm9yIGEgY29tbWFuZCwgMDogaXQncyBhIG1lc2ggaW5zdGFuY2UpXG4gICAgLy8gMCAtIDI0ICA6IE1hdGVyaWFsIElEIChpZiBvcGFxdWUpIG9yIDAgKGlmIHRyYW5zcGFyZW50IC0gd2lsbCBiZSBkZXB0aClcbiAgICByZXR1cm4gKChsYXllciAmIDB4MGYpIDw8IDI3KSB8XG4gICAgICAgICAgICgoYmxlbmRUeXBlID09PSBCTEVORF9OT05FID8gMSA6IDApIDw8IDI2KSB8XG4gICAgICAgICAgICgoaXNDb21tYW5kID8gMSA6IDApIDw8IDI1KSB8XG4gICAgICAgICAgICgobWF0ZXJpYWxJZCAmIDB4MWZmZmZmZikgPDwgMCk7XG59XG5cbmV4cG9ydCB7IENvbW1hbmQsIE1lc2hJbnN0YW5jZSB9O1xuIl0sIm5hbWVzIjpbIl90bXBBYWJiIiwiQm91bmRpbmdCb3giLCJfdGVtcEJvbmVBYWJiIiwiX3RlbXBTcGhlcmUiLCJCb3VuZGluZ1NwaGVyZSIsIl9tZXNoU2V0IiwiU2V0IiwiSW5zdGFuY2luZ0RhdGEiLCJjb25zdHJ1Y3RvciIsIm51bU9iamVjdHMiLCJ2ZXJ0ZXhCdWZmZXIiLCJjb3VudCIsIkNvbW1hbmQiLCJsYXllciIsImJsZW5kVHlwZSIsImNvbW1hbmQiLCJfa2V5IiwiU09SVEtFWV9GT1JXQVJEIiwiZ2V0S2V5Iiwia2V5IiwidmFsIiwiTWVzaEluc3RhbmNlIiwibWVzaCIsIm1hdGVyaWFsIiwibm9kZSIsInZpc2libGUiLCJjYXN0U2hhZG93IiwiX21hdGVyaWFsIiwiX3NoYWRlciIsIl9iaW5kR3JvdXBzIiwiR3JhcGhOb2RlIiwidGVtcCIsImlzU3RhdGljIiwiX3N0YXRpY0xpZ2h0TGlzdCIsIl9zdGF0aWNTb3VyY2UiLCJfbWVzaCIsImluY1JlZkNvdW50IiwiX3NoYWRlckRlZnMiLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiZm9ybWF0IiwiaGFzVXYwIiwiU0hBREVSREVGX1VWMCIsImhhc1V2MSIsIlNIQURFUkRFRl9VVjEiLCJoYXNDb2xvciIsIlNIQURFUkRFRl9WQ09MT1IiLCJoYXNUYW5nZW50cyIsIlNIQURFUkRFRl9UQU5HRU5UUyIsIl9saWdodEhhc2giLCJMQVlFUl9XT1JMRCIsIl9yZW5kZXJTdHlsZSIsIlJFTkRFUlNUWUxFX1NPTElEIiwiX3JlY2VpdmVTaGFkb3ciLCJfc2NyZWVuU3BhY2UiLCJfbm9EZXB0aERyYXdHbDEiLCJjdWxsIiwicGljayIsIl91cGRhdGVBYWJiIiwiX3VwZGF0ZUFhYmJGdW5jIiwiX2NhbGN1bGF0ZVNvcnREaXN0YW5jZSIsInVwZGF0ZUtleSIsIl9za2luSW5zdGFuY2UiLCJfbW9ycGhJbnN0YW5jZSIsImluc3RhbmNpbmdEYXRhIiwiX2N1c3RvbUFhYmIiLCJhYWJiIiwiX2FhYmJWZXIiLCJkcmF3T3JkZXIiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwiaXNWaXNpYmxlRnVuYyIsInBhcmFtZXRlcnMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsImZsaXBGYWNlc0ZhY3RvciIsInJlbmRlclN0eWxlIiwicHJlcGFyZVJlbmRlclN0YXRlIiwiZGVjUmVmQ291bnQiLCJfYWFiYiIsImxvY2FsQWFiYiIsInRvV29ybGRTcGFjZSIsInNraW5JbnN0YW5jZSIsImJvbmVBYWJiIiwibW9ycGhUYXJnZXRzIiwibW9ycGgiLCJfdGFyZ2V0cyIsIl9pbml0Qm9uZUFhYmJzIiwiYm9uZVVzZWQiLCJmaXJzdCIsImkiLCJsZW5ndGgiLCJzZXRGcm9tVHJhbnNmb3JtZWRBYWJiIiwibWF0cmljZXMiLCJjZW50ZXIiLCJjb3B5IiwiaGFsZkV4dGVudHMiLCJhZGQiLCJzZXQiLCJtb3JwaEFhYmIiLCJfZXhwYW5kIiwiZ2V0TWluIiwiZ2V0TWF4IiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJjbGVhclNoYWRlcnMiLCJzaGFkZXJzIiwiZGVzdHJveUJpbmRHcm91cHMiLCJncm91cHMiLCJncm91cCIsInVuaWZvcm1CdWZmZXIiLCJkZWZhdWx0VW5pZm9ybUJ1ZmZlciIsImRlc3Ryb3kiLCJnZXRCaW5kR3JvdXAiLCJkZXZpY2UiLCJwYXNzIiwiYmluZEdyb3VwIiwic2hhZGVyIiwiRGVidWciLCJhc3NlcnQiLCJ1YkZvcm1hdCIsIm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0IiwiVW5pZm9ybUJ1ZmZlciIsImJpbmRHcm91cEZvcm1hdCIsIm1lc2hCaW5kR3JvdXBGb3JtYXQiLCJCaW5kR3JvdXAiLCJEZWJ1Z0hlbHBlciIsInNldE5hbWUiLCJpZCIsInByZXZNYXQiLCJyZW1vdmVNZXNoSW5zdGFuY2VSZWYiLCJhZGRNZXNoSW5zdGFuY2VSZWYiLCJwcmV2QmxlbmQiLCJ0cmFuc3BhcmVudCIsInNjZW5lIiwiX3NjZW5lIiwibGF5ZXJzIiwiX2RpcnR5QmxlbmQiLCJfbGF5ZXIiLCJjYWxjdWxhdGVTb3J0RGlzdGFuY2UiLCJyZWNlaXZlU2hhZG93IiwiU0hBREVSREVGX05PU0hBRE9XIiwiU0hBREVSX0ZPUldBUkQiLCJTSEFERVJfRk9SV0FSREhEUiIsInNoYWRlckRlZnMiLCJTSEFERVJERUZfU0tJTiIsIl9zZXR1cFNraW5VcGRhdGUiLCJtb3JwaEluc3RhbmNlIiwiX3RoaXMkX21vcnBoSW5zdGFuY2UiLCJ1c2VUZXh0dXJlTW9ycGgiLCJTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCIsIm1vcnBoUG9zaXRpb25zIiwiU0hBREVSREVGX01PUlBIX1BPU0lUSU9OIiwibW9ycGhOb3JtYWxzIiwiU0hBREVSREVGX01PUlBIX05PUk1BTCIsInNjcmVlblNwYWNlIiwiU0hBREVSREVGX1NDUkVFTlNQQUNFIiwibWFzayIsInRvZ2dsZXMiLCJpbnN0YW5jaW5nQ291bnQiLCJ2YWx1ZSIsIl90aGlzJF9za2luSW5zdGFuY2UiLCJfdGhpcyRtb3JwaEluc3RhbmNlIiwicmVmQ291bnQiLCJzZXRSZWFsdGltZUxpZ2h0bWFwIiwibGlnaHRtYXBQYXJhbU5hbWVzIiwiX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5IiwibWVzaEluc3RhbmNlcyIsImhhcyIsImNsZWFyIiwiX2lzVmlzaWJsZSIsImNhbWVyYSIsInJhZGl1cyIsImZydXN0dW0iLCJjb250YWluc1NwaGVyZSIsImFscGhhVG9Db3ZlcmFnZSIsImFscGhhVGVzdCIsIkJMRU5EX05PUk1BTCIsInNldEluc3RhbmNpbmciLCJudW1WZXJ0aWNlcyIsImluc3RhbmNpbmciLCJ1cGRhdGVQYXNzU2hhZGVyIiwic3RhdGljTGlnaHRMaXN0Iiwic29ydGVkTGlnaHRzIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwiZ2V0U2hhZGVyVmFyaWFudCIsImVuc3VyZU1hdGVyaWFsIiwid2FybiIsIm5hbWUiLCJnZXREZWZhdWx0TWF0ZXJpYWwiLCJjbGVhclBhcmFtZXRlcnMiLCJnZXRQYXJhbWV0ZXJzIiwiZ2V0UGFyYW1ldGVyIiwic2V0UGFyYW1ldGVyIiwiZGF0YSIsInBhc3NGbGFncyIsInVuZGVmaW5lZCIsInVuaWZvcm1PYmplY3QiLCJwYXJhbSIsInNjb3BlSWQiLCJ0ZXh0dXJlIiwib2xkIiwiTGlnaHRtYXBDYWNoZSIsImRlY1JlZiIsImluY1JlZiIsImRlbGV0ZVBhcmFtZXRlciIsInNldFBhcmFtZXRlcnMiLCJwYXNzRmxhZyIsInBhcmFtTmFtZSIsInBhcmFtZXRlciIsInNjb3BlIiwicmVzb2x2ZSIsInNldFZhbHVlIiwic2V0TGlnaHRtYXBwZWQiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsIk1BU0tfQkFLRSIsIlNIQURFUkRFRl9MTSIsIlNIQURFUkRFRl9ESVJMTSIsIlNIQURFUkRFRl9MTUFNQklFTlQiLCJzZXRDdXN0b21BYWJiIiwiY2xvbmUiLCJfdXBkYXRlQmVmb3JlQ3VsbCIsImlzQ29tbWFuZCIsIm1hdGVyaWFsSWQiLCJCTEVORF9OT05FIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUF3QkEsTUFBTUEsUUFBUSxHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBO0FBQ2xDLE1BQU1DLGFBQWEsR0FBRyxJQUFJRCxXQUFXLEVBQUUsQ0FBQTtBQUN2QyxNQUFNRSxXQUFXLEdBQUcsSUFBSUMsY0FBYyxFQUFFLENBQUE7QUFDeEMsTUFBTUMsUUFBUSxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBOztBQUUxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsY0FBYyxDQUFDO0FBQ2pCOztBQUdBO0FBQ0o7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxVQUFVLEVBQUU7SUFBQSxJQUx4QkMsQ0FBQUEsWUFBWSxHQUFHLElBQUksQ0FBQTtJQU1mLElBQUksQ0FBQ0MsS0FBSyxHQUFHRixVQUFVLENBQUE7QUFDM0IsR0FBQTtBQUNKLENBQUE7QUFFQSxNQUFNRyxPQUFPLENBQUM7QUFDVkosRUFBQUEsV0FBV0EsQ0FBQ0ssS0FBSyxFQUFFQyxTQUFTLEVBQUVDLE9BQU8sRUFBRTtJQUNuQyxJQUFJLENBQUNDLElBQUksR0FBRyxFQUFFLENBQUE7QUFDZCxJQUFBLElBQUksQ0FBQ0EsSUFBSSxDQUFDQyxlQUFlLENBQUMsR0FBR0MsTUFBTSxDQUFDTCxLQUFLLEVBQUVDLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDOUQsSUFBSSxDQUFDQyxPQUFPLEdBQUdBLE9BQU8sQ0FBQTtBQUMxQixHQUFBO0VBRUEsSUFBSUksR0FBR0EsQ0FBQ0MsR0FBRyxFQUFFO0FBQ1QsSUFBQSxJ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
