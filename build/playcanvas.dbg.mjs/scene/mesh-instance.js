/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC1pbnN0YW5jZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL21lc2gtaW5zdGFuY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5cbmltcG9ydCB7IEJpbmRHcm91cCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORF9OT05FLCBCTEVORF9OT1JNQUwsXG4gICAgTEFZRVJfV09STEQsXG4gICAgTUFTS19BRkZFQ1RfRFlOQU1JQywgTUFTS19CQUtFLCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCxcbiAgICBSRU5ERVJTVFlMRV9TT0xJRCxcbiAgICBTSEFERVJfRk9SV0FSRCwgU0hBREVSX0ZPUldBUkRIRFIsXG4gICAgU0hBREVSREVGX1VWMCwgU0hBREVSREVGX1VWMSwgU0hBREVSREVGX1ZDT0xPUiwgU0hBREVSREVGX1RBTkdFTlRTLCBTSEFERVJERUZfTk9TSEFET1csIFNIQURFUkRFRl9TS0lOLFxuICAgIFNIQURFUkRFRl9TQ1JFRU5TUEFDRSwgU0hBREVSREVGX01PUlBIX1BPU0lUSU9OLCBTSEFERVJERUZfTU9SUEhfTk9STUFMLCBTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCxcbiAgICBTSEFERVJERUZfTE0sIFNIQURFUkRFRl9ESVJMTSwgU0hBREVSREVGX0xNQU1CSUVOVCxcbiAgICBTT1JUS0VZX0ZPUldBUkRcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdE1hdGVyaWFsIH0gZnJvbSAnLi9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBMaWdodG1hcENhY2hlIH0gZnJvbSAnLi9ncmFwaGljcy9saWdodG1hcC1jYWNoZS5qcyc7XG5cbmNvbnN0IF90bXBBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcEJvbmVBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX21lc2hTZXQgPSBuZXcgU2V0KCk7XG5cbi8qKlxuICogSW50ZXJuYWwgZGF0YSBzdHJ1Y3R1cmUgdXNlZCB0byBzdG9yZSBkYXRhIHVzZWQgYnkgaGFyZHdhcmUgaW5zdGFuY2luZy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEluc3RhbmNpbmdEYXRhIHtcbiAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcnxudWxsfSAqL1xuICAgIHZlcnRleEJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtT2JqZWN0cyAtIFRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbnN0YW5jZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobnVtT2JqZWN0cykge1xuICAgICAgICB0aGlzLmNvdW50ID0gbnVtT2JqZWN0cztcbiAgICB9XG59XG5cbmNsYXNzIENvbW1hbmQge1xuICAgIGNvbnN0cnVjdG9yKGxheWVyLCBibGVuZFR5cGUsIGNvbW1hbmQpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0gW107XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gZ2V0S2V5KGxheWVyLCBibGVuZFR5cGUsIHRydWUsIDApO1xuICAgICAgICB0aGlzLmNvbW1hbmQgPSBjb21tYW5kO1xuICAgIH1cblxuICAgIHNldCBrZXkodmFsKSB7XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gdmFsO1xuICAgIH1cblxuICAgIGdldCBrZXkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgTGF5ZXJ9IHRvIGNhbGN1bGF0ZSB0aGUgXCJzb3J0IGRpc3RhbmNlXCIgZm9yIGEge0BsaW5rIE1lc2hJbnN0YW5jZX0sXG4gKiB3aGljaCBkZXRlcm1pbmVzIGl0cyBwbGFjZSBpbiB0aGUgcmVuZGVyIG9yZGVyLlxuICpcbiAqIEBjYWxsYmFjayBDYWxjdWxhdGVTb3J0RGlzdGFuY2VDYWxsYmFja1xuICogQHBhcmFtIHtNZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlLlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gY2FtZXJhUG9zaXRpb24gLSBUaGUgcG9zaXRpb24gb2YgdGhlIGNhbWVyYS5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IGNhbWVyYUZvcndhcmQgLSBUaGUgZm9yd2FyZCB2ZWN0b3Igb2YgdGhlIGNhbWVyYS5cbiAqL1xuXG4vKipcbiAqIEFuIGluc3RhbmNlIG9mIGEge0BsaW5rIE1lc2h9LiBBIHNpbmdsZSBtZXNoIGNhbiBiZSByZWZlcmVuY2VkIGJ5IG1hbnkgbWVzaCBpbnN0YW5jZXMgdGhhdCBjYW5cbiAqIGhhdmUgZGlmZmVyZW50IHRyYW5zZm9ybXMgYW5kIG1hdGVyaWFscy5cbiAqL1xuY2xhc3MgTWVzaEluc3RhbmNlIHtcbiAgICAvKipcbiAgICAgKiBFbmFibGUgcmVuZGVyaW5nIGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuIFVzZSB2aXNpYmxlIHByb3BlcnR5IHRvIGVuYWJsZS9kaXNhYmxlXG4gICAgICogcmVuZGVyaW5nIHdpdGhvdXQgb3ZlcmhlYWQgb2YgcmVtb3ZpbmcgZnJvbSBzY2VuZS4gQnV0IG5vdGUgdGhhdCB0aGUgbWVzaCBpbnN0YW5jZSBpc1xuICAgICAqIHN0aWxsIGluIHRoZSBoaWVyYXJjaHkgYW5kIHN0aWxsIGluIHRoZSBkcmF3IGNhbGwgbGlzdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHZpc2libGUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHNoYWRvdyBjYXN0aW5nIGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuIFVzZSB0aGlzIHByb3BlcnR5IHRvIGVuYWJsZS9kaXNhYmxlXG4gICAgICogc2hhZG93IGNhc3Rpbmcgd2l0aG91dCBvdmVyaGVhZCBvZiByZW1vdmluZyBmcm9tIHNjZW5lLiBOb3RlIHRoYXQgdGhpcyBwcm9wZXJ0eSBkb2VzIG5vdFxuICAgICAqIGFkZCB0aGUgbWVzaCBpbnN0YW5jZSB0byBhcHByb3ByaWF0ZSBsaXN0IG9mIHNoYWRvdyBjYXN0ZXJzIG9uIGEge0BsaW5rIHBjLkxheWVyfSwgYnV0XG4gICAgICogYWxsb3dzIG1lc2ggdG8gYmUgc2tpcHBlZCBmcm9tIHNoYWRvdyBjYXN0aW5nIHdoaWxlIGl0IGlzIGluIHRoZSBsaXN0IGFscmVhZHkuIERlZmF1bHRzIHRvXG4gICAgICogZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBjYXN0U2hhZG93ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hdGVyaWFsO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2Ygc2hhZGVycyB1c2VkIGJ5IHRoZSBtZXNoIGluc3RhbmNlLCBpbmRleGVkIGJ5IHRoZSBzaGFkZXIgcGFzcyBjb25zdGFudCAoU0hBREVSX0ZPUldBUkQuLilcbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcycpLlNoYWRlcj59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9zaGFkZXIgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGJpbmQgZ3JvdXBzLCBzdG9yaW5nIHVuaWZvcm1zIHBlciBwYXNzLiBUaGlzIGhhcyAxOjEgcmVsYXRpb24gd2l0aCB0aGUgX3NoYWRlcyBhcnJheSxcbiAgICAgKiBhbmQgaXMgaW5kZXhlZCBieSB0aGUgc2hhZGVyIHBhc3MgY29uc3RhbnQgYXMgd2VsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxCaW5kR3JvdXA+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfYmluZEdyb3VwcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1lc2hJbnN0YW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2guanMnKS5NZXNofSBtZXNoIC0gVGhlIGdyYXBoaWNzIG1lc2ggdG8gaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSBmb3IgdGhpc1xuICAgICAqIG1lc2ggaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IFtub2RlXSAtIFRoZSBncmFwaCBub2RlIGRlZmluaW5nIHRoZSB0cmFuc2Zvcm0gZm9yIHRoaXMgaW5zdGFuY2UuIFRoaXNcbiAgICAgKiBwYXJhbWV0ZXIgaXMgb3B0aW9uYWwgd2hlbiB1c2VkIHdpdGgge0BsaW5rIFJlbmRlckNvbXBvbmVudH0gYW5kIHdpbGwgdXNlIHRoZSBub2RlIHRoZVxuICAgICAqIGNvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG1lc2ggaW5zdGFuY2UgcG9pbnRpbmcgdG8gYSAxeDF4MSAnY3ViZScgbWVzaFxuICAgICAqIHZhciBtZXNoID0gcGMuY3JlYXRlQm94KGdyYXBoaWNzRGV2aWNlKTtcbiAgICAgKiB2YXIgbWF0ZXJpYWwgPSBuZXcgcGMuU3RhbmRhcmRNYXRlcmlhbCgpO1xuICAgICAqXG4gICAgICogdmFyIG1lc2hJbnN0YW5jZSA9IG5ldyBwYy5NZXNoSW5zdGFuY2UobWVzaCwgbWF0ZXJpYWwpO1xuICAgICAqXG4gICAgICogdmFyIGVudGl0eSA9IG5ldyBwYy5FbnRpdHkoKTtcbiAgICAgKiBlbnRpdHkuYWRkQ29tcG9uZW50KCdyZW5kZXInLCB7XG4gICAgICogICAgIG1lc2hJbnN0YW5jZXM6IFttZXNoSW5zdGFuY2VdXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBBZGQgdGhlIGVudGl0eSB0byB0aGUgc2NlbmUgaGllcmFyY2h5XG4gICAgICogdGhpcy5hcHAuc2NlbmUucm9vdC5hZGRDaGlsZChlbnRpdHkpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1lc2gsIG1hdGVyaWFsLCBub2RlID0gbnVsbCkge1xuICAgICAgICAvLyBpZiBmaXJzdCBwYXJhbWV0ZXIgaXMgb2YgR3JhcGhOb2RlIHR5cGUsIGhhbmRsZSBwcmV2aW91cyBjb25zdHJ1Y3RvciBzaWduYXR1cmU6IChub2RlLCBtZXNoLCBtYXRlcmlhbClcbiAgICAgICAgaWYgKG1lc2ggaW5zdGFuY2VvZiBHcmFwaE5vZGUpIHtcbiAgICAgICAgICAgIGNvbnN0IHRlbXAgPSBtZXNoO1xuICAgICAgICAgICAgbWVzaCA9IG1hdGVyaWFsO1xuICAgICAgICAgICAgbWF0ZXJpYWwgPSBub2RlO1xuICAgICAgICAgICAgbm9kZSA9IHRlbXA7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9rZXkgPSBbMCwgMF07XG5cbiAgICAgICAgdGhpcy5pc1N0YXRpYyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zdGF0aWNMaWdodExpc3QgPSBudWxsO1xuICAgICAgICB0aGlzLl9zdGF0aWNTb3VyY2UgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZ3JhcGggbm9kZSBkZWZpbmluZyB0aGUgdHJhbnNmb3JtIGZvciB0aGlzIGluc3RhbmNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R3JhcGhOb2RlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ub2RlID0gbm9kZTsgICAgICAgICAgIC8vIFRoZSBub2RlIHRoYXQgZGVmaW5lcyB0aGUgdHJhbnNmb3JtIG9mIHRoZSBtZXNoIGluc3RhbmNlXG4gICAgICAgIHRoaXMuX21lc2ggPSBtZXNoOyAgICAgICAgICAvLyBUaGUgbWVzaCB0aGF0IHRoaXMgaW5zdGFuY2UgcmVuZGVyc1xuICAgICAgICBtZXNoLmluY1JlZkNvdW50KCk7XG4gICAgICAgIHRoaXMubWF0ZXJpYWwgPSBtYXRlcmlhbDsgICAvLyBUaGUgbWF0ZXJpYWwgd2l0aCB3aGljaCB0byByZW5kZXIgdGhpcyBpbnN0YW5jZVxuXG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBNQVNLX0FGRkVDVF9EWU5BTUlDIDw8IDE2OyAvLyAyIGJ5dGUgdG9nZ2xlcywgMiBieXRlcyBsaWdodCBtYXNrOyBEZWZhdWx0IHZhbHVlIGlzIG5vIHRvZ2dsZXMgYW5kIG1hc2sgPSBwYy5NQVNLX0FGRkVDVF9EWU5BTUlDXG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgfD0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc1V2MCA/IFNIQURFUkRFRl9VVjAgOiAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzIHw9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNVdjEgPyBTSEFERVJERUZfVVYxIDogMDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzQ29sb3IgPyBTSEFERVJERUZfVkNPTE9SIDogMDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzVGFuZ2VudHMgPyBTSEFERVJERUZfVEFOR0VOVFMgOiAwO1xuXG4gICAgICAgIHRoaXMuX2xpZ2h0SGFzaCA9IDA7XG5cbiAgICAgICAgLy8gUmVuZGVyIG9wdGlvbnNcbiAgICAgICAgdGhpcy5sYXllciA9IExBWUVSX1dPUkxEOyAvLyBsZWdhY3lcbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3JlbmRlclN0eWxlID0gUkVOREVSU1RZTEVfU09MSUQ7XG4gICAgICAgIHRoaXMuX3JlY2VpdmVTaGFkb3cgPSB0cnVlO1xuICAgICAgICB0aGlzLl9zY3JlZW5TcGFjZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9ub0RlcHRoRHJhd0dsMSA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb250cm9scyB3aGV0aGVyIHRoZSBtZXNoIGluc3RhbmNlIGNhbiBiZSBjdWxsZWQgYnkgZnJ1c3R1bSBjdWxsaW5nXG4gICAgICAgICAqICh7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2ZydXN0dW1DdWxsaW5nfSkuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdWxsID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJ1ZSBpZiB0aGUgbWVzaCBpbnN0YW5jZSBpcyBwaWNrYWJsZSBieSB0aGUge0BsaW5rIFBpY2tlcn0uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBpY2sgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmIgPSB0cnVlO1xuICAgICAgICB0aGlzLl91cGRhdGVBYWJiRnVuYyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgLy8gNjQtYml0IGludGVnZXIga2V5IHRoYXQgZGVmaW5lcyByZW5kZXIgb3JkZXIgb2YgdGhpcyBtZXNoIGluc3RhbmNlXG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc2tpbi1pbnN0YW5jZS5qcycpLlNraW5JbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21vcnBoLWluc3RhbmNlLmpzJykuTW9ycGhJbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gbnVsbDtcblxuICAgICAgICAvLyBXb3JsZCBzcGFjZSBBQUJCXG4gICAgICAgIHRoaXMuYWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICB0aGlzLl9hYWJiVmVyID0gLTE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZSB0aGlzIHZhbHVlIHRvIGFmZmVjdCByZW5kZXJpbmcgb3JkZXIgb2YgbWVzaCBpbnN0YW5jZXMuIE9ubHkgdXNlZCB3aGVuIG1lc2hcbiAgICAgICAgICogaW5zdGFuY2VzIGFyZSBhZGRlZCB0byBhIHtAbGluayBMYXllcn0gd2l0aCB7QGxpbmsgTGF5ZXIjb3BhcXVlU29ydE1vZGV9IG9yXG4gICAgICAgICAqIHtAbGluayBMYXllciN0cmFuc3BhcmVudFNvcnRNb2RlfSAoZGVwZW5kaW5nIG9uIHRoZSBtYXRlcmlhbCkgc2V0IHRvXG4gICAgICAgICAqIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWFkIHRoaXMgdmFsdWUgaW4ge0BsaW5rIExheWVyI29uUG9zdEN1bGx9IHRvIGRldGVybWluZSBpZiB0aGUgb2JqZWN0IGlzIGFjdHVhbGx5IGdvaW5nXG4gICAgICAgICAqIHRvIGJlIHJlbmRlcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmlzaWJsZVRoaXNGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGN1c3RvbSBmdW5jdGlvbiB1c2VkIHRvIGN1c3RvbWl6ZSBjdWxsaW5nIChlLmcuIGZvciAyRCBVSSBlbGVtZW50cylcbiAgICAgICAgdGhpcy5pc1Zpc2libGVGdW5jID0gbnVsbDtcblxuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGcm9udCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3RlbmNpbEJhY2sgPSBudWxsO1xuXG4gICAgICAgIC8vIE5lZ2F0aXZlIHNjYWxlIGJhdGNoaW5nIHN1cHBvcnRcbiAgICAgICAgdGhpcy5mbGlwRmFjZXMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVuZGVyIHN0eWxlIG9mIHRoZSBtZXNoIGluc3RhbmNlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH1cbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9XSVJFRlJBTUV9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfUE9JTlRTfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFJFTkRFUlNUWUxFX1NPTElEfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlbmRlclN0eWxlKHJlbmRlclN0eWxlKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG4gICAgICAgIHRoaXMubWVzaC5wcmVwYXJlUmVuZGVyU3RhdGUocmVuZGVyU3R5bGUpO1xuICAgIH1cblxuICAgIGdldCByZW5kZXJTdHlsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclN0eWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBncmFwaGljcyBtZXNoIGJlaW5nIGluc3RhbmNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWVzaC5qcycpLk1lc2h9XG4gICAgICovXG4gICAgc2V0IG1lc2gobWVzaCkge1xuXG4gICAgICAgIGlmIChtZXNoID09PSB0aGlzLl9tZXNoKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoLmRlY1JlZkNvdW50KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tZXNoID0gbWVzaDtcblxuICAgICAgICBpZiAobWVzaCkge1xuICAgICAgICAgICAgbWVzaC5pbmNSZWZDb3VudCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1lc2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tZXNoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3b3JsZCBzcGFjZSBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94IGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h9XG4gICAgICovXG4gICAgc2V0IGFhYmIoYWFiYikge1xuICAgICAgICB0aGlzLl9hYWJiID0gYWFiYjtcbiAgICB9XG5cbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgLy8gdXNlIHNwZWNpZmllZCB3b3JsZCBzcGFjZSBhYWJiXG4gICAgICAgIGlmICghdGhpcy5fdXBkYXRlQWFiYikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FhYmI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjYWxsYmFjayBmdW5jdGlvbiByZXR1cm5pbmcgd29ybGQgc3BhY2UgYWFiYlxuICAgICAgICBpZiAodGhpcy5fdXBkYXRlQWFiYkZ1bmMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl91cGRhdGVBYWJiRnVuYyh0aGlzLl9hYWJiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVzZSBsb2NhbCBzcGFjZSBvdmVycmlkZSBhYWJiIGlmIHNwZWNpZmllZFxuICAgICAgICBsZXQgbG9jYWxBYWJiID0gdGhpcy5fY3VzdG9tQWFiYjtcbiAgICAgICAgbGV0IHRvV29ybGRTcGFjZSA9ICEhbG9jYWxBYWJiO1xuXG4gICAgICAgIC8vIG90aGVyd2lzZSBldmFsdWF0ZSBsb2NhbCBhYWJiXG4gICAgICAgIGlmICghbG9jYWxBYWJiKSB7XG5cbiAgICAgICAgICAgIGxvY2FsQWFiYiA9IF90bXBBYWJiO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5za2luSW5zdGFuY2UpIHtcblxuICAgICAgICAgICAgICAgIC8vIEluaXRpYWxpemUgbG9jYWwgYm9uZSBBQUJCcyBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMubWVzaC5ib25lQWFiYikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtb3JwaFRhcmdldHMgPSB0aGlzLl9tb3JwaEluc3RhbmNlID8gdGhpcy5fbW9ycGhJbnN0YW5jZS5tb3JwaC5fdGFyZ2V0cyA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWVzaC5faW5pdEJvbmVBYWJicyhtb3JwaFRhcmdldHMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGV2YWx1YXRlIGxvY2FsIHNwYWNlIGJvdW5kcyBiYXNlZCBvbiBhbGwgYWN0aXZlIGJvbmVzXG4gICAgICAgICAgICAgICAgY29uc3QgYm9uZVVzZWQgPSB0aGlzLm1lc2guYm9uZVVzZWQ7XG4gICAgICAgICAgICAgICAgbGV0IGZpcnN0ID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5tZXNoLmJvbmVBYWJiLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChib25lVXNlZFtpXSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0cmFuc2Zvcm0gYm9uZSBBQUJCIGJ5IGJvbmUgbWF0cml4XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGVtcEJvbmVBYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy5tZXNoLmJvbmVBYWJiW2ldLCB0aGlzLnNraW5JbnN0YW5jZS5tYXRyaWNlc1tpXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGVtIHVwXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlyc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5jZW50ZXIuY29weShfdGVtcEJvbmVBYWJiLmNlbnRlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmhhbGZFeHRlbnRzLmNvcHkoX3RlbXBCb25lQWFiYi5oYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5hZGQoX3RlbXBCb25lQWFiYik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0b1dvcmxkU3BhY2UgPSB0cnVlO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubm9kZS5fYWFiYlZlciAhPT0gdGhpcy5fYWFiYlZlcikge1xuXG4gICAgICAgICAgICAgICAgLy8gbG9jYWwgc3BhY2UgYm91bmRpbmcgYm94IC0gZWl0aGVyIGZyb20gbWVzaCBvciBlbXB0eVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmNlbnRlci5jb3B5KHRoaXMubWVzaC5hYWJiLmNlbnRlcik7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5jb3B5KHRoaXMubWVzaC5hYWJiLmhhbGZFeHRlbnRzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuY2VudGVyLnNldCgwLCAwLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmhhbGZFeHRlbnRzLnNldCgwLCAwLCAwKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgbG9jYWwgc3BhY2UgYm91bmRpbmcgYm94IGJ5IG1vcnBoIHRhcmdldHNcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXNoICYmIHRoaXMubWVzaC5tb3JwaCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtb3JwaEFhYmIgPSB0aGlzLm1lc2gubW9ycGguYWFiYjtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLl9leHBhbmQobW9ycGhBYWJiLmdldE1pbigpLCBtb3JwaEFhYmIuZ2V0TWF4KCkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRvV29ybGRTcGFjZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWFiYlZlciA9IHRoaXMubm9kZS5fYWFiYlZlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0b3JlIHdvcmxkIHNwYWNlIGJvdW5kaW5nIGJveFxuICAgICAgICBpZiAodG9Xb3JsZFNwYWNlKSB7XG4gICAgICAgICAgICB0aGlzLl9hYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIobG9jYWxBYWJiLCB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fYWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhciB0aGUgaW50ZXJuYWwgc2hhZGVyIGFycmF5LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNsZWFyU2hhZGVycygpIHtcbiAgICAgICAgY29uc3Qgc2hhZGVycyA9IHRoaXMuX3NoYWRlcjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaGFkZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBzaGFkZXJzW2ldID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGVzdHJveUJpbmRHcm91cHMoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95QmluZEdyb3VwcygpIHtcblxuICAgICAgICBjb25zdCBncm91cHMgPSB0aGlzLl9iaW5kR3JvdXBzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdyb3Vwcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZ3JvdXAgPSBncm91cHNbaV07XG4gICAgICAgICAgICBpZiAoZ3JvdXApIHtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmlmb3JtQnVmZmVyID0gZ3JvdXAuZGVmYXVsdFVuaWZvcm1CdWZmZXI7XG4gICAgICAgICAgICAgICAgaWYgKHVuaWZvcm1CdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgdW5pZm9ybUJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdyb3VwLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBncm91cHMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcGFzcyAtIFNoYWRlciBwYXNzIG51bWJlci5cbiAgICAgKiBAcmV0dXJucyB7QmluZEdyb3VwfSAtIFRoZSBtZXNoIGJpbmQgZ3JvdXAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEJpbmRHcm91cChkZXZpY2UsIHBhc3MpIHtcblxuICAgICAgICAvLyBjcmVhdGUgYmluZCBncm91cFxuICAgICAgICBsZXQgYmluZEdyb3VwID0gdGhpcy5fYmluZEdyb3Vwc1twYXNzXTtcbiAgICAgICAgaWYgKCFiaW5kR3JvdXApIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuX3NoYWRlcltwYXNzXTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChzaGFkZXIpO1xuXG4gICAgICAgICAgICAvLyBtZXNoIHVuaWZvcm0gYnVmZmVyXG4gICAgICAgICAgICBjb25zdCB1YkZvcm1hdCA9IHNoYWRlci5tZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydCh1YkZvcm1hdCk7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtQnVmZmVyID0gbmV3IFVuaWZvcm1CdWZmZXIoZGV2aWNlLCB1YkZvcm1hdCk7XG5cbiAgICAgICAgICAgIC8vIG1lc2ggYmluZCBncm91cFxuICAgICAgICAgICAgY29uc3QgYmluZEdyb3VwRm9ybWF0ID0gc2hhZGVyLm1lc2hCaW5kR3JvdXBGb3JtYXQ7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoYmluZEdyb3VwRm9ybWF0KTtcbiAgICAgICAgICAgIGJpbmRHcm91cCA9IG5ldyBCaW5kR3JvdXAoZGV2aWNlLCBiaW5kR3JvdXBGb3JtYXQsIHVuaWZvcm1CdWZmZXIpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShiaW5kR3JvdXAsIGBNZXNoQmluZEdyb3VwXyR7YmluZEdyb3VwLmlkfWApO1xuXG4gICAgICAgICAgICB0aGlzLl9iaW5kR3JvdXBzW3Bhc3NdID0gYmluZEdyb3VwO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJpbmRHcm91cDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF0ZXJpYWwgdXNlZCBieSB0aGlzIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqL1xuICAgIHNldCBtYXRlcmlhbChtYXRlcmlhbCkge1xuXG4gICAgICAgIHRoaXMuY2xlYXJTaGFkZXJzKCk7XG5cbiAgICAgICAgY29uc3QgcHJldk1hdCA9IHRoaXMuX21hdGVyaWFsO1xuXG4gICAgICAgIC8vIFJlbW92ZSB0aGUgbWF0ZXJpYWwncyByZWZlcmVuY2UgdG8gdGhpcyBtZXNoIGluc3RhbmNlXG4gICAgICAgIGlmIChwcmV2TWF0KSB7XG4gICAgICAgICAgICBwcmV2TWF0LnJlbW92ZU1lc2hJbnN0YW5jZVJlZih0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gbWF0ZXJpYWw7XG5cbiAgICAgICAgaWYgKG1hdGVyaWFsKSB7XG5cbiAgICAgICAgICAgIC8vIFJlY29yZCB0aGF0IHRoZSBtYXRlcmlhbCBpcyByZWZlcmVuY2VkIGJ5IHRoaXMgbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgbWF0ZXJpYWwuYWRkTWVzaEluc3RhbmNlUmVmKHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuXG4gICAgICAgICAgICAvLyBpZiBibGVuZCB0eXBlIG9mIHRoZSBtYXRlcmlhbCBjaGFuZ2VzXG4gICAgICAgICAgICBjb25zdCBwcmV2QmxlbmQgPSBwcmV2TWF0ICYmIHByZXZNYXQudHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwudHJhbnNwYXJlbnQgIT09IHByZXZCbGVuZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5fbWF0ZXJpYWwuX3NjZW5lIHx8IHByZXZNYXQ/Ll9zY2VuZTtcbiAgICAgICAgICAgICAgICBpZiAoc2NlbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NlbmUubGF5ZXJzLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5fZGlydHlCbGVuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgc2V0IGxheWVyKGxheWVyKSB7XG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGxheWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW4gc29tZSBjaXJjdW1zdGFuY2VzIG1lc2ggaW5zdGFuY2VzIGFyZSBzb3J0ZWQgYnkgYSBkaXN0YW5jZSBjYWxjdWxhdGlvbiB0byBkZXRlcm1pbmUgdGhlaXJcbiAgICAgKiByZW5kZXJpbmcgb3JkZXIuIFNldCB0aGlzIGNhbGxiYWNrIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0IGRpc3RhbmNlIGNhbGN1bGF0aW9uLCB3aGljaCBnaXZlc1xuICAgICAqIHRoZSBkb3QgcHJvZHVjdCBvZiB0aGUgY2FtZXJhIGZvcndhcmQgdmVjdG9yIGFuZCB0aGUgdmVjdG9yIGJldHdlZW4gdGhlIGNhbWVyYSBwb3NpdGlvbiBhbmRcbiAgICAgKiB0aGUgY2VudGVyIG9mIHRoZSBtZXNoIGluc3RhbmNlJ3MgYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveC4gVGhpcyBvcHRpb24gY2FuIGJlIHBhcnRpY3VsYXJseVxuICAgICAqIHVzZWZ1bCBmb3IgcmVuZGVyaW5nIHRyYW5zcGFyZW50IG1lc2hlcyBpbiBhIGJldHRlciBvcmRlciB0aGFuIGRlZmF1bHQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Q2FsY3VsYXRlU29ydERpc3RhbmNlQ2FsbGJhY2t9XG4gICAgICovXG4gICAgc2V0IGNhbGN1bGF0ZVNvcnREaXN0YW5jZShjYWxjdWxhdGVTb3J0RGlzdGFuY2UpIHtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU29ydERpc3RhbmNlID0gY2FsY3VsYXRlU29ydERpc3RhbmNlO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVTb3J0RGlzdGFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWxjdWxhdGVTb3J0RGlzdGFuY2U7XG4gICAgfVxuXG4gICAgc2V0IHJlY2VpdmVTaGFkb3codmFsKSB7XG4gICAgICAgIHRoaXMuX3JlY2VpdmVTaGFkb3cgPSB2YWw7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSB2YWwgPyAodGhpcy5fc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfTk9TSEFET1cpIDogKHRoaXMuX3NoYWRlckRlZnMgfCBTSEFERVJERUZfTk9TSEFET1cpO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRdID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJESERSXSA9IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0IHJlY2VpdmVTaGFkb3coKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWNlaXZlU2hhZG93O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBza2luIGluc3RhbmNlIG1hbmFnaW5nIHNraW5uaW5nIG9mIHRoaXMgbWVzaCBpbnN0YW5jZSwgb3IgbnVsbCBpZiBza2lubmluZyBpcyBub3QgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc2tpbi1pbnN0YW5jZS5qcycpLlNraW5JbnN0YW5jZX1cbiAgICAgKi9cbiAgICBzZXQgc2tpbkluc3RhbmNlKHZhbCkge1xuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2UgPSB2YWw7XG5cbiAgICAgICAgbGV0IHNoYWRlckRlZnMgPSB0aGlzLl9zaGFkZXJEZWZzO1xuICAgICAgICBzaGFkZXJEZWZzID0gdmFsID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfU0tJTikgOiAoc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfU0tJTik7XG5cbiAgICAgICAgLy8gaWYgc2hhZGVyRGVmcyBoYXZlIGNoYW5nZWRcbiAgICAgICAgaWYgKHNoYWRlckRlZnMgIT09IHRoaXMuX3NoYWRlckRlZnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBzaGFkZXJEZWZzO1xuICAgICAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9zZXR1cFNraW5VcGRhdGUoKTtcbiAgICB9XG5cbiAgICBnZXQgc2tpbkluc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2tpbkluc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtb3JwaCBpbnN0YW5jZSBtYW5hZ2luZyBtb3JwaGluZyBvZiB0aGlzIG1lc2ggaW5zdGFuY2UsIG9yIG51bGwgaWYgbW9ycGhpbmcgaXMgbm90IHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21vcnBoLWluc3RhbmNlLmpzJykuTW9ycGhJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBzZXQgbW9ycGhJbnN0YW5jZSh2YWwpIHtcblxuICAgICAgICAvLyByZWxlYXNlIGV4aXN0aW5nXG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2U/LmRlc3Ryb3koKTtcblxuICAgICAgICAvLyBhc3NpZ24gbmV3XG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2UgPSB2YWw7XG5cbiAgICAgICAgbGV0IHNoYWRlckRlZnMgPSB0aGlzLl9zaGFkZXJEZWZzO1xuICAgICAgICBzaGFkZXJEZWZzID0gKHZhbCAmJiB2YWwubW9ycGgudXNlVGV4dHVyZU1vcnBoKSA/IChzaGFkZXJEZWZzIHwgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQpIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQpO1xuICAgICAgICBzaGFkZXJEZWZzID0gKHZhbCAmJiB2YWwubW9ycGgubW9ycGhQb3NpdGlvbnMpID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfTU9SUEhfUE9TSVRJT04pIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX1BPU0lUSU9OKTtcbiAgICAgICAgc2hhZGVyRGVmcyA9ICh2YWwgJiYgdmFsLm1vcnBoLm1vcnBoTm9ybWFscykgPyAoc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9NT1JQSF9OT1JNQUwpIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX05PUk1BTCk7XG5cbiAgICAgICAgLy8gaWYgc2hhZGVyRGVmcyBoYXZlIGNoYW5nZWRcbiAgICAgICAgaWYgKHNoYWRlckRlZnMgIT09IHRoaXMuX3NoYWRlckRlZnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBzaGFkZXJEZWZzO1xuICAgICAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtb3JwaEluc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9ycGhJbnN0YW5jZTtcbiAgICB9XG5cbiAgICBzZXQgc2NyZWVuU3BhY2UodmFsKSB7XG4gICAgICAgIHRoaXMuX3NjcmVlblNwYWNlID0gdmFsO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gdmFsID8gKHRoaXMuX3NoYWRlckRlZnMgfCBTSEFERVJERUZfU0NSRUVOU1BBQ0UpIDogKHRoaXMuX3NoYWRlckRlZnMgJiB+U0hBREVSREVGX1NDUkVFTlNQQUNFKTtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJEXSA9IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0IHNjcmVlblNwYWNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2NyZWVuU3BhY2U7XG4gICAgfVxuXG4gICAgc2V0IGtleSh2YWwpIHtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSB2YWw7XG4gICAgfVxuXG4gICAgZ2V0IGtleSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hc2sgY29udHJvbGxpbmcgd2hpY2gge0BsaW5rIExpZ2h0Q29tcG9uZW50fXMgbGlnaHQgdGhpcyBtZXNoIGluc3RhbmNlLCB3aGljaFxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnR9IHNlZXMgaXQgYW5kIGluIHdoaWNoIHtAbGluayBMYXllcn0gaXQgaXMgcmVuZGVyZWQuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNrKHZhbCkge1xuICAgICAgICBjb25zdCB0b2dnbGVzID0gdGhpcy5fc2hhZGVyRGVmcyAmIDB4MDAwMEZGRkY7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSB0b2dnbGVzIHwgKHZhbCA8PCAxNik7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSRF0gPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRIRFJdID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRlckRlZnMgPj4gMTY7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTnVtYmVyIG9mIGluc3RhbmNlcyB3aGVuIHVzaW5nIGhhcmR3YXJlIGluc3RhbmNpbmcgdG8gcmVuZGVyIHRoZSBtZXNoLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaW5zdGFuY2luZ0NvdW50KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmluc3RhbmNpbmdEYXRhKVxuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YS5jb3VudCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBpbnN0YW5jaW5nQ291bnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNpbmdEYXRhID8gdGhpcy5pbnN0YW5jaW5nRGF0YS5jb3VudCA6IDA7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICBjb25zdCBtZXNoID0gdGhpcy5tZXNoO1xuICAgICAgICBpZiAobWVzaCkge1xuXG4gICAgICAgICAgICAvLyB0aGlzIGRlY3JlYXNlcyByZWYgY291bnQgb24gdGhlIG1lc2hcbiAgICAgICAgICAgIHRoaXMubWVzaCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgbWVzaFxuICAgICAgICAgICAgaWYgKG1lc2gucmVmQ291bnQgPCAxKSB7XG4gICAgICAgICAgICAgICAgbWVzaC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWxlYXNlIHJlZiBjb3VudGVkIGxpZ2h0bWFwc1xuICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbnVsbCk7XG4gICAgICAgIHRoaXMuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzFdLCBudWxsKTtcblxuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2U/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLm1vcnBoSW5zdGFuY2U/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5tb3JwaEluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNsZWFyU2hhZGVycygpO1xuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSBtYXRlcmlhbCBjbGVhcnMgcmVmZXJlbmNlcyB0byB0aGlzIG1lc2hJbnN0YW5jZVxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBzaGFkZXIgdW5pZm9ybSBuYW1lcyBmb3IgbGlnaHRtYXBzXG4gICAgc3RhdGljIGxpZ2h0bWFwUGFyYW1OYW1lcyA9IFsndGV4dHVyZV9saWdodE1hcCcsICd0ZXh0dXJlX2RpckxpZ2h0TWFwJ107XG5cbiAgICAvLyBnZW5lcmF0ZXMgd2lyZWZyYW1lcyBmb3IgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXNcbiAgICBzdGF0aWMgX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5KG1lc2hJbnN0YW5jZXMsIHJlbmRlclN0eWxlKSB7XG5cbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gc3dpdGNoIG1lc2ggaW5zdGFuY2UgdG8gdGhlIHJlcXVlc3RlZCBzdHlsZVxuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG5cbiAgICAgICAgICAgICAgICAvLyBwcm9jZXNzIGFsbCB1bmlxdWUgbWVzaGVzXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZXNbaV0ubWVzaDtcbiAgICAgICAgICAgICAgICBpZiAoIV9tZXNoU2V0LmhhcyhtZXNoKSkge1xuICAgICAgICAgICAgICAgICAgICBfbWVzaFNldC5hZGQobWVzaCk7XG4gICAgICAgICAgICAgICAgICAgIG1lc2gucHJlcGFyZVJlbmRlclN0YXRlKHJlbmRlclN0eWxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9tZXNoU2V0LmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB0ZXN0IGlmIG1lc2hJbnN0YW5jZSBpcyB2aXNpYmxlIGJ5IGNhbWVyYS4gSXQgcmVxdWlyZXMgdGhlIGZydXN0dW0gb2YgdGhlIGNhbWVyYSB0byBiZSB1cCB0byBkYXRlLCB3aGljaCBmb3J3YXJkLXJlbmRlcmVyXG4gICAgLy8gdGFrZXMgY2FyZSBvZi4gVGhpcyBmdW5jdGlvbiBzaG91bGQgIG5vdCBiZSBjYWxsZWQgZWxzZXdoZXJlLlxuICAgIF9pc1Zpc2libGUoY2FtZXJhKSB7XG5cbiAgICAgICAgaWYgKHRoaXMudmlzaWJsZSkge1xuXG4gICAgICAgICAgICAvLyBjdXN0b20gdmlzaWJpbGl0eSBtZXRob2Qgb2YgTWVzaEluc3RhbmNlXG4gICAgICAgICAgICBpZiAodGhpcy5pc1Zpc2libGVGdW5jKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNWaXNpYmxlRnVuYyhjYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfdGVtcFNwaGVyZS5jZW50ZXIgPSB0aGlzLmFhYmIuY2VudGVyOyAgLy8gdGhpcyBsaW5lIGV2YWx1YXRlcyBhYWJiXG4gICAgICAgICAgICBfdGVtcFNwaGVyZS5yYWRpdXMgPSB0aGlzLl9hYWJiLmhhbGZFeHRlbnRzLmxlbmd0aCgpO1xuXG4gICAgICAgICAgICByZXR1cm4gY2FtZXJhLmZydXN0dW0uY29udGFpbnNTcGhlcmUoX3RlbXBTcGhlcmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHVwZGF0ZUtleSgpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSB0aGlzLm1hdGVyaWFsO1xuICAgICAgICB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXSA9IGdldEtleSh0aGlzLmxheWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobWF0ZXJpYWwuYWxwaGFUb0NvdmVyYWdlIHx8IG1hdGVyaWFsLmFscGhhVGVzdCkgPyBCTEVORF9OT1JNQUwgOiBtYXRlcmlhbC5ibGVuZFR5cGUsIC8vIHJlbmRlciBhbHBoYXRlc3QvYXRvYyBhZnRlciBvcGFxdWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UsIG1hdGVyaWFsLmlkKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHVwIHtAbGluayBNZXNoSW5zdGFuY2V9IHRvIGJlIHJlbmRlcmVkIHVzaW5nIEhhcmR3YXJlIEluc3RhbmNpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcnxudWxsfSB2ZXJ0ZXhCdWZmZXIgLSBWZXJ0ZXggYnVmZmVyIHRvIGhvbGQgcGVyLWluc3RhbmNlIHZlcnRleCBkYXRhXG4gICAgICogKHVzdWFsbHkgd29ybGQgbWF0cmljZXMpLiBQYXNzIG51bGwgdG8gdHVybiBvZmYgaGFyZHdhcmUgaW5zdGFuY2luZy5cbiAgICAgKi9cbiAgICBzZXRJbnN0YW5jaW5nKHZlcnRleEJ1ZmZlcikge1xuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhID0gbmV3IEluc3RhbmNpbmdEYXRhKHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcyk7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcblxuICAgICAgICAgICAgLy8gbWFyayB2ZXJ0ZXggYnVmZmVyIGFzIGluc3RhbmNpbmcgZGF0YVxuICAgICAgICAgICAgdmVydGV4QnVmZmVyLmZvcm1hdC5pbnN0YW5jaW5nID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gdHVybiBvZmYgY3VsbGluZyAtIHdlIGRvIG5vdCBkbyBwZXItaW5zdGFuY2UgY3VsbGluZywgYWxsIGluc3RhbmNlcyBhcmUgc3VibWl0dGVkIHRvIEdQVVxuICAgICAgICAgICAgdGhpcy5jdWxsID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuY3VsbCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBPYnRhaW4gYSBzaGFkZXIgdmFyaWFudCByZXF1aXJlZCB0byByZW5kZXIgdGhlIG1lc2ggaW5zdGFuY2Ugd2l0aGluIHNwZWNpZmllZCBwYXNzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc2NlbmUuanMnKS5TY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHBhc3MgLSBUaGUgcmVuZGVyIHBhc3MuXG4gICAgICogQHBhcmFtIHthbnl9IHN0YXRpY0xpZ2h0TGlzdCAtIExpc3Qgb2Ygc3RhdGljIGxpZ2h0cy5cbiAgICAgKiBAcGFyYW0ge2FueX0gc29ydGVkTGlnaHRzIC0gQXJyYXkgb2YgYXJyYXlzIG9mIGxpZ2h0cy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJykuVW5pZm9ybUJ1ZmZlckZvcm1hdH0gdmlld1VuaWZvcm1Gb3JtYXQgLSBUaGVcbiAgICAgKiBmb3JtYXQgb2YgdGhlIHZpZXcgdW5pZm9ybSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAtZm9ybWF0LmpzJykuQmluZEdyb3VwRm9ybWF0fSB2aWV3QmluZEdyb3VwRm9ybWF0IC0gVGhlXG4gICAgICogZm9ybWF0IG9mIHRoZSB2aWV3IGJpbmQgZ3JvdXAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHBhc3MsIHN0YXRpY0xpZ2h0TGlzdCwgc29ydGVkTGlnaHRzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCkge1xuICAgICAgICB0aGlzLl9zaGFkZXJbcGFzc10gPSB0aGlzLm1hdGVyaWFsLmdldFNoYWRlclZhcmlhbnQodGhpcy5tZXNoLmRldmljZSwgc2NlbmUsIHRoaXMuX3NoYWRlckRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQsIHRoaXMuX21lc2gudmVydGV4QnVmZmVyLmZvcm1hdCk7XG4gICAgfVxuXG4gICAgZW5zdXJlTWF0ZXJpYWwoZGV2aWNlKSB7XG4gICAgICAgIGlmICghdGhpcy5tYXRlcmlhbCkge1xuICAgICAgICAgICAgRGVidWcud2FybihgTWVzaCBhdHRhY2hlZCB0byBlbnRpdHkgJyR7dGhpcy5ub2RlLm5hbWV9JyBkb2VzIG5vdCBoYXZlIGEgbWF0ZXJpYWwsIHVzaW5nIGEgZGVmYXVsdCBvbmUuYCk7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsID0gZ2V0RGVmYXVsdE1hdGVyaWFsKGRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBQYXJhbWV0ZXIgbWFuYWdlbWVudFxuICAgIGNsZWFyUGFyYW1ldGVycygpIHtcbiAgICAgICAgdGhpcy5wYXJhbWV0ZXJzID0ge307XG4gICAgfVxuXG4gICAgZ2V0UGFyYW1ldGVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyYW1ldGVycztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIHNwZWNpZmllZCBzaGFkZXIgcGFyYW1ldGVyIGZyb20gYSBtZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHF1ZXJ5LlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSBuYW1lZCBwYXJhbWV0ZXIuXG4gICAgICovXG4gICAgZ2V0UGFyYW1ldGVyKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyYW1ldGVyc1tuYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGEgc2hhZGVyIHBhcmFtZXRlciBvbiBhIG1lc2ggaW5zdGFuY2UuIE5vdGUgdGhhdCB0aGlzIHBhcmFtZXRlciB3aWxsIHRha2UgcHJlY2VkZW5jZVxuICAgICAqIG92ZXIgcGFyYW1ldGVyIG9mIHRoZSBzYW1lIG5hbWUgaWYgc2V0IG9uIE1hdGVyaWFsIHRoaXMgbWVzaCBpbnN0YW5jZSB1c2VzIGZvciByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfG51bWJlcltdfGltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9IGRhdGEgLSBUaGUgdmFsdWVcbiAgICAgKiBmb3IgdGhlIHNwZWNpZmllZCBwYXJhbWV0ZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwYXNzRmxhZ3NdIC0gTWFzayBkZXNjcmliaW5nIHdoaWNoIHBhc3NlcyB0aGUgbWF0ZXJpYWwgc2hvdWxkIGJlIGluY2x1ZGVkXG4gICAgICogaW4uXG4gICAgICovXG4gICAgc2V0UGFyYW1ldGVyKG5hbWUsIGRhdGEsIHBhc3NGbGFncyA9IC0yNjIxNDEpIHtcblxuICAgICAgICAvLyBub3RlIG9uIC0yNjIxNDE6IEFsbCBiaXRzIHNldCBleGNlcHQgMiAtIDE5IHJhbmdlXG5cbiAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHVuaWZvcm1PYmplY3QgPSBuYW1lO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1PYmplY3QubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB1bmlmb3JtT2JqZWN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyKHVuaWZvcm1PYmplY3RbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuYW1lID0gdW5pZm9ybU9iamVjdC5uYW1lO1xuICAgICAgICAgICAgZGF0YSA9IHVuaWZvcm1PYmplY3QudmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYXJhbSA9IHRoaXMucGFyYW1ldGVyc1tuYW1lXTtcbiAgICAgICAgaWYgKHBhcmFtKSB7XG4gICAgICAgICAgICBwYXJhbS5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgIHBhcmFtLnBhc3NGbGFncyA9IHBhc3NGbGFncztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucGFyYW1ldGVyc1tuYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBzY29wZUlkOiBudWxsLFxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGEsXG4gICAgICAgICAgICAgICAgcGFzc0ZsYWdzOiBwYXNzRmxhZ3NcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhIHdyYXBwZXIgb3ZlciBzZXR0aW5ncyBwYXJhbWV0ZXIgc3BlY2lmaWNhbGx5IGZvciByZWFsdGltZSBiYWtlZCBsaWdodG1hcHMuIFRoaXMgaGFuZGxlcyByZWZlcmVuY2UgY291bnRpbmcgb2YgbGlnaHRtYXBzXG4gICAgLy8gYW5kIHJlbGVhc2VzIHRoZW0gd2hlbiBubyBsb25nZXIgcmVmZXJlbmNlZFxuICAgIHNldFJlYWx0aW1lTGlnaHRtYXAobmFtZSwgdGV4dHVyZSkge1xuXG4gICAgICAgIC8vIG5vIGNoYW5nZVxuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLmdldFBhcmFtZXRlcihuYW1lKTtcbiAgICAgICAgaWYgKG9sZCA9PT0gdGV4dHVyZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyByZW1vdmUgb2xkXG4gICAgICAgIGlmIChvbGQpIHtcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVjUmVmKG9sZC5kYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzc2lnbiBuZXdcbiAgICAgICAgaWYgKHRleHR1cmUpIHtcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuaW5jUmVmKHRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXIobmFtZSwgdGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlbGV0ZVBhcmFtZXRlcihuYW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICAvKipcbiAgICAgICogRGVsZXRlcyBhIHNoYWRlciBwYXJhbWV0ZXIgb24gYSBtZXNoIGluc3RhbmNlLlxuICAgICAgKlxuICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gZGVsZXRlLlxuICAgICAgKi9cbiAgICBkZWxldGVQYXJhbWV0ZXIobmFtZSkge1xuICAgICAgICBpZiAodGhpcy5wYXJhbWV0ZXJzW25hbWVdKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gdXNlZCB0byBhcHBseSBwYXJhbWV0ZXJzIGZyb20gdGhpcyBtZXNoIGluc3RhbmNlIGludG8gc2NvcGUgb2YgdW5pZm9ybXMsIGNhbGxlZCBpbnRlcm5hbGx5IGJ5IGZvcndhcmQtcmVuZGVyZXJcbiAgICBzZXRQYXJhbWV0ZXJzKGRldmljZSwgcGFzc0ZsYWcpIHtcbiAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHRoaXMucGFyYW1ldGVycztcbiAgICAgICAgZm9yIChjb25zdCBwYXJhbU5hbWUgaW4gcGFyYW1ldGVycykge1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gcGFyYW1ldGVyc1twYXJhbU5hbWVdO1xuICAgICAgICAgICAgaWYgKHBhcmFtZXRlci5wYXNzRmxhZ3MgJiBwYXNzRmxhZykge1xuICAgICAgICAgICAgICAgIGlmICghcGFyYW1ldGVyLnNjb3BlSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyLnNjb3BlSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShwYXJhbU5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJhbWV0ZXIuc2NvcGVJZC5zZXRWYWx1ZShwYXJhbWV0ZXIuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRMaWdodG1hcHBlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMubWFzayA9ICh0aGlzLm1hc2sgfCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCkgJiB+KE1BU0tfQUZGRUNUX0RZTkFNSUMgfCBNQVNLX0JBS0UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMF0sIG51bGwpO1xuICAgICAgICAgICAgdGhpcy5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMV0sIG51bGwpO1xuICAgICAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyAmPSB+KFNIQURFUkRFRl9MTSB8IFNIQURFUkRFRl9ESVJMTSB8IFNIQURFUkRFRl9MTUFNQklFTlQpO1xuICAgICAgICAgICAgdGhpcy5tYXNrID0gKHRoaXMubWFzayB8IE1BU0tfQUZGRUNUX0RZTkFNSUMpICYgfihNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCB8IE1BU0tfQkFLRSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDdXN0b21BYWJiKGFhYmIpIHtcblxuICAgICAgICBpZiAoYWFiYikge1xuICAgICAgICAgICAgLy8gc3RvcmUgdGhlIG92ZXJyaWRlIGFhYmJcbiAgICAgICAgICAgIGlmICh0aGlzLl9jdXN0b21BYWJiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY3VzdG9tQWFiYi5jb3B5KGFhYmIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gYWFiYi5jbG9uZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gb3ZlcnJpZGUsIGZvcmNlIHJlZnJlc2ggdGhlIGFjdHVhbCBvbmVcbiAgICAgICAgICAgIHRoaXMuX2N1c3RvbUFhYmIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fYWFiYlZlciA9IC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2V0dXBTa2luVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgX3NldHVwU2tpblVwZGF0ZSgpIHtcblxuICAgICAgICAvLyBzZXQgaWYgYm9uZXMgbmVlZCB0byBiZSB1cGRhdGVkIGJlZm9yZSBjdWxsaW5nXG4gICAgICAgIGlmICh0aGlzLl9za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZS5fdXBkYXRlQmVmb3JlQ3VsbCA9ICF0aGlzLl9jdXN0b21BYWJiO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRLZXkobGF5ZXIsIGJsZW5kVHlwZSwgaXNDb21tYW5kLCBtYXRlcmlhbElkKSB7XG4gICAgLy8gS2V5IGRlZmluaXRpb246XG4gICAgLy8gQml0XG4gICAgLy8gMzEgICAgICA6IHNpZ24gYml0IChsZWF2ZSlcbiAgICAvLyAyNyAtIDMwIDogbGF5ZXJcbiAgICAvLyAyNiAgICAgIDogdHJhbnNsdWNlbmN5IHR5cGUgKG9wYXF1ZS90cmFuc3BhcmVudClcbiAgICAvLyAyNSAgICAgIDogQ29tbWFuZCBiaXQgKDE6IHRoaXMga2V5IGlzIGZvciBhIGNvbW1hbmQsIDA6IGl0J3MgYSBtZXNoIGluc3RhbmNlKVxuICAgIC8vIDAgLSAyNCAgOiBNYXRlcmlhbCBJRCAoaWYgb3BhcXVlKSBvciAwIChpZiB0cmFuc3BhcmVudCAtIHdpbGwgYmUgZGVwdGgpXG4gICAgcmV0dXJuICgobGF5ZXIgJiAweDBmKSA8PCAyNykgfFxuICAgICAgICAgICAoKGJsZW5kVHlwZSA9PT0gQkxFTkRfTk9ORSA/IDEgOiAwKSA8PCAyNikgfFxuICAgICAgICAgICAoKGlzQ29tbWFuZCA/IDEgOiAwKSA8PCAyNSkgfFxuICAgICAgICAgICAoKG1hdGVyaWFsSWQgJiAweDFmZmZmZmYpIDw8IDApO1xufVxuXG5leHBvcnQgeyBDb21tYW5kLCBNZXNoSW5zdGFuY2UgfTtcbiJdLCJuYW1lcyI6WyJfdG1wQWFiYiIsIkJvdW5kaW5nQm94IiwiX3RlbXBCb25lQWFiYiIsIl90ZW1wU3BoZXJlIiwiQm91bmRpbmdTcGhlcmUiLCJfbWVzaFNldCIsIlNldCIsIkluc3RhbmNpbmdEYXRhIiwiY29uc3RydWN0b3IiLCJudW1PYmplY3RzIiwidmVydGV4QnVmZmVyIiwiY291bnQiLCJDb21tYW5kIiwibGF5ZXIiLCJibGVuZFR5cGUiLCJjb21tYW5kIiwiX2tleSIsIlNPUlRLRVlfRk9SV0FSRCIsImdldEtleSIsImtleSIsInZhbCIsIk1lc2hJbnN0YW5jZSIsIm1lc2giLCJtYXRlcmlhbCIsIm5vZGUiLCJ2aXNpYmxlIiwiY2FzdFNoYWRvdyIsIl9tYXRlcmlhbCIsIl9zaGFkZXIiLCJfYmluZEdyb3VwcyIsIkdyYXBoTm9kZSIsInRlbXAiLCJpc1N0YXRpYyIsIl9zdGF0aWNMaWdodExpc3QiLCJfc3RhdGljU291cmNlIiwiX21lc2giLCJpbmNSZWZDb3VudCIsIl9zaGFkZXJEZWZzIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsImZvcm1hdCIsImhhc1V2MCIsIlNIQURFUkRFRl9VVjAiLCJoYXNVdjEiLCJTSEFERVJERUZfVVYxIiwiaGFzQ29sb3IiLCJTSEFERVJERUZfVkNPTE9SIiwiaGFzVGFuZ2VudHMiLCJTSEFERVJERUZfVEFOR0VOVFMiLCJfbGlnaHRIYXNoIiwiTEFZRVJfV09STEQiLCJfcmVuZGVyU3R5bGUiLCJSRU5ERVJTVFlMRV9TT0xJRCIsIl9yZWNlaXZlU2hhZG93IiwiX3NjcmVlblNwYWNlIiwiX25vRGVwdGhEcmF3R2wxIiwiY3VsbCIsInBpY2siLCJfdXBkYXRlQWFiYiIsIl91cGRhdGVBYWJiRnVuYyIsIl9jYWxjdWxhdGVTb3J0RGlzdGFuY2UiLCJ1cGRhdGVLZXkiLCJfc2tpbkluc3RhbmNlIiwiX21vcnBoSW5zdGFuY2UiLCJpbnN0YW5jaW5nRGF0YSIsIl9jdXN0b21BYWJiIiwiYWFiYiIsIl9hYWJiVmVyIiwiZHJhd09yZGVyIiwidmlzaWJsZVRoaXNGcmFtZSIsImlzVmlzaWJsZUZ1bmMiLCJwYXJhbWV0ZXJzIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJmbGlwRmFjZXMiLCJyZW5kZXJTdHlsZSIsInByZXBhcmVSZW5kZXJTdGF0ZSIsImRlY1JlZkNvdW50IiwiX2FhYmIiLCJsb2NhbEFhYmIiLCJ0b1dvcmxkU3BhY2UiLCJza2luSW5zdGFuY2UiLCJib25lQWFiYiIsIm1vcnBoVGFyZ2V0cyIsIm1vcnBoIiwiX3RhcmdldHMiLCJfaW5pdEJvbmVBYWJicyIsImJvbmVVc2VkIiwiZmlyc3QiLCJpIiwibGVuZ3RoIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsIm1hdHJpY2VzIiwiY2VudGVyIiwiY29weSIsImhhbGZFeHRlbnRzIiwiYWRkIiwic2V0IiwibW9ycGhBYWJiIiwiX2V4cGFuZCIsImdldE1pbiIsImdldE1heCIsImdldFdvcmxkVHJhbnNmb3JtIiwiY2xlYXJTaGFkZXJzIiwic2hhZGVycyIsImRlc3Ryb3lCaW5kR3JvdXBzIiwiZ3JvdXBzIiwiZ3JvdXAiLCJ1bmlmb3JtQnVmZmVyIiwiZGVmYXVsdFVuaWZvcm1CdWZmZXIiLCJkZXN0cm95IiwiZ2V0QmluZEdyb3VwIiwiZGV2aWNlIiwicGFzcyIsImJpbmRHcm91cCIsInNoYWRlciIsIkRlYnVnIiwiYXNzZXJ0IiwidWJGb3JtYXQiLCJtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIlVuaWZvcm1CdWZmZXIiLCJiaW5kR3JvdXBGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwiQmluZEdyb3VwIiwiRGVidWdIZWxwZXIiLCJzZXROYW1lIiwiaWQiLCJwcmV2TWF0IiwicmVtb3ZlTWVzaEluc3RhbmNlUmVmIiwiYWRkTWVzaEluc3RhbmNlUmVmIiwicHJldkJsZW5kIiwidHJhbnNwYXJlbnQiLCJzY2VuZSIsIl9zY2VuZSIsImxheWVycyIsIl9kaXJ0eUJsZW5kIiwiX2xheWVyIiwiY2FsY3VsYXRlU29ydERpc3RhbmNlIiwicmVjZWl2ZVNoYWRvdyIsIlNIQURFUkRFRl9OT1NIQURPVyIsIlNIQURFUl9GT1JXQVJEIiwiU0hBREVSX0ZPUldBUkRIRFIiLCJzaGFkZXJEZWZzIiwiU0hBREVSREVGX1NLSU4iLCJfc2V0dXBTa2luVXBkYXRlIiwibW9ycGhJbnN0YW5jZSIsInVzZVRleHR1cmVNb3JwaCIsIlNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEIiwibW9ycGhQb3NpdGlvbnMiLCJTSEFERVJERUZfTU9SUEhfUE9TSVRJT04iLCJtb3JwaE5vcm1hbHMiLCJTSEFERVJERUZfTU9SUEhfTk9STUFMIiwic2NyZWVuU3BhY2UiLCJTSEFERVJERUZfU0NSRUVOU1BBQ0UiLCJtYXNrIiwidG9nZ2xlcyIsImluc3RhbmNpbmdDb3VudCIsInZhbHVlIiwicmVmQ291bnQiLCJzZXRSZWFsdGltZUxpZ2h0bWFwIiwibGlnaHRtYXBQYXJhbU5hbWVzIiwiX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5IiwibWVzaEluc3RhbmNlcyIsImhhcyIsImNsZWFyIiwiX2lzVmlzaWJsZSIsImNhbWVyYSIsInJhZGl1cyIsImZydXN0dW0iLCJjb250YWluc1NwaGVyZSIsImFscGhhVG9Db3ZlcmFnZSIsImFscGhhVGVzdCIsIkJMRU5EX05PUk1BTCIsInNldEluc3RhbmNpbmciLCJudW1WZXJ0aWNlcyIsImluc3RhbmNpbmciLCJ1cGRhdGVQYXNzU2hhZGVyIiwic3RhdGljTGlnaHRMaXN0Iiwic29ydGVkTGlnaHRzIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwiZ2V0U2hhZGVyVmFyaWFudCIsImVuc3VyZU1hdGVyaWFsIiwid2FybiIsIm5hbWUiLCJnZXREZWZhdWx0TWF0ZXJpYWwiLCJjbGVhclBhcmFtZXRlcnMiLCJnZXRQYXJhbWV0ZXJzIiwiZ2V0UGFyYW1ldGVyIiwic2V0UGFyYW1ldGVyIiwiZGF0YSIsInBhc3NGbGFncyIsInVuZGVmaW5lZCIsInVuaWZvcm1PYmplY3QiLCJwYXJhbSIsInNjb3BlSWQiLCJ0ZXh0dXJlIiwib2xkIiwiTGlnaHRtYXBDYWNoZSIsImRlY1JlZiIsImluY1JlZiIsImRlbGV0ZVBhcmFtZXRlciIsInNldFBhcmFtZXRlcnMiLCJwYXNzRmxhZyIsInBhcmFtTmFtZSIsInBhcmFtZXRlciIsInNjb3BlIiwicmVzb2x2ZSIsInNldFZhbHVlIiwic2V0TGlnaHRtYXBwZWQiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsIk1BU0tfQkFLRSIsIlNIQURFUkRFRl9MTSIsIlNIQURFUkRFRl9ESVJMTSIsIlNIQURFUkRFRl9MTUFNQklFTlQiLCJzZXRDdXN0b21BYWJiIiwiY2xvbmUiLCJfdXBkYXRlQmVmb3JlQ3VsbCIsImlzQ29tbWFuZCIsIm1hdGVyaWFsSWQiLCJCTEVORF9OT05FIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUF3QkEsTUFBTUEsUUFBUSxHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBO0FBQ2xDLE1BQU1DLGFBQWEsR0FBRyxJQUFJRCxXQUFXLEVBQUUsQ0FBQTtBQUN2QyxNQUFNRSxXQUFXLEdBQUcsSUFBSUMsY0FBYyxFQUFFLENBQUE7QUFDeEMsTUFBTUMsUUFBUSxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBOztBQUUxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsY0FBYyxDQUFDO0FBQ2pCOztBQUdBO0FBQ0o7QUFDQTtFQUNJQyxXQUFXLENBQUNDLFVBQVUsRUFBRTtJQUFBLElBTHhCQyxDQUFBQSxZQUFZLEdBQUcsSUFBSSxDQUFBO0lBTWYsSUFBSSxDQUFDQyxLQUFLLEdBQUdGLFVBQVUsQ0FBQTtBQUMzQixHQUFBO0FBQ0osQ0FBQTtBQUVBLE1BQU1HLE9BQU8sQ0FBQztBQUNWSixFQUFBQSxXQUFXLENBQUNLLEtBQUssRUFBRUMsU0FBUyxFQUFFQyxPQUFPLEVBQUU7SUFDbkMsSUFBSSxDQUFDQyxJQUFJLEdBQUcsRUFBRSxDQUFBO0FBQ2QsSUFBQSxJQUFJLENBQUNBLElBQUksQ0FBQ0MsZUFBZSxDQUFDLEdBQUdDLE1BQU0sQ0FBQ0wsS0FBSyxFQUFFQyxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFBO0lBQzlELElBQUksQ0FBQ0MsT0FBTyxHQUFHQSxPQUFPLENBQUE7QUFDMUIsR0FBQTtFQUVBLElBQUlJLEdBQUcsQ0FBQ0MsR0FBRyxFQUFFO0FBQ1QsSUFBQSxJQUFJLENBQUNKLElBQUksQ0FBQ0MsZUFBZSxDQUFDLEdBQUdHLEdBQUcsQ0FBQTtBQUNwQyxHQUFBO0FBRUEsRUFBQSxJQUFJRCxHQUFH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
