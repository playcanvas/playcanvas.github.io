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
   * const mesh = pc.createBox(graphicsDevice);
   * const material = new pc.StandardMaterial();
   *
   * const meshInstance = new pc.MeshInstance(mesh, material);
   *
   * const entity = new pc.Entity();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC1pbnN0YW5jZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL21lc2gtaW5zdGFuY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5cbmltcG9ydCB7IEJpbmRHcm91cCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORF9OT05FLCBCTEVORF9OT1JNQUwsXG4gICAgTEFZRVJfV09STEQsXG4gICAgTUFTS19BRkZFQ1RfRFlOQU1JQywgTUFTS19CQUtFLCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCxcbiAgICBSRU5ERVJTVFlMRV9TT0xJRCxcbiAgICBTSEFERVJfRk9SV0FSRCwgU0hBREVSX0ZPUldBUkRIRFIsXG4gICAgU0hBREVSREVGX1VWMCwgU0hBREVSREVGX1VWMSwgU0hBREVSREVGX1ZDT0xPUiwgU0hBREVSREVGX1RBTkdFTlRTLCBTSEFERVJERUZfTk9TSEFET1csIFNIQURFUkRFRl9TS0lOLFxuICAgIFNIQURFUkRFRl9TQ1JFRU5TUEFDRSwgU0hBREVSREVGX01PUlBIX1BPU0lUSU9OLCBTSEFERVJERUZfTU9SUEhfTk9STUFMLCBTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCxcbiAgICBTSEFERVJERUZfTE0sIFNIQURFUkRFRl9ESVJMTSwgU0hBREVSREVGX0xNQU1CSUVOVCxcbiAgICBTT1JUS0VZX0ZPUldBUkRcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdE1hdGVyaWFsIH0gZnJvbSAnLi9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBMaWdodG1hcENhY2hlIH0gZnJvbSAnLi9ncmFwaGljcy9saWdodG1hcC1jYWNoZS5qcyc7XG5cbmNvbnN0IF90bXBBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcEJvbmVBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX21lc2hTZXQgPSBuZXcgU2V0KCk7XG5cbi8qKlxuICogSW50ZXJuYWwgZGF0YSBzdHJ1Y3R1cmUgdXNlZCB0byBzdG9yZSBkYXRhIHVzZWQgYnkgaGFyZHdhcmUgaW5zdGFuY2luZy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEluc3RhbmNpbmdEYXRhIHtcbiAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcnxudWxsfSAqL1xuICAgIHZlcnRleEJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtT2JqZWN0cyAtIFRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbnN0YW5jZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobnVtT2JqZWN0cykge1xuICAgICAgICB0aGlzLmNvdW50ID0gbnVtT2JqZWN0cztcbiAgICB9XG59XG5cbmNsYXNzIENvbW1hbmQge1xuICAgIGNvbnN0cnVjdG9yKGxheWVyLCBibGVuZFR5cGUsIGNvbW1hbmQpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0gW107XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gZ2V0S2V5KGxheWVyLCBibGVuZFR5cGUsIHRydWUsIDApO1xuICAgICAgICB0aGlzLmNvbW1hbmQgPSBjb21tYW5kO1xuICAgIH1cblxuICAgIHNldCBrZXkodmFsKSB7XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gdmFsO1xuICAgIH1cblxuICAgIGdldCBrZXkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgTGF5ZXJ9IHRvIGNhbGN1bGF0ZSB0aGUgXCJzb3J0IGRpc3RhbmNlXCIgZm9yIGEge0BsaW5rIE1lc2hJbnN0YW5jZX0sXG4gKiB3aGljaCBkZXRlcm1pbmVzIGl0cyBwbGFjZSBpbiB0aGUgcmVuZGVyIG9yZGVyLlxuICpcbiAqIEBjYWxsYmFjayBDYWxjdWxhdGVTb3J0RGlzdGFuY2VDYWxsYmFja1xuICogQHBhcmFtIHtNZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlLlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gY2FtZXJhUG9zaXRpb24gLSBUaGUgcG9zaXRpb24gb2YgdGhlIGNhbWVyYS5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IGNhbWVyYUZvcndhcmQgLSBUaGUgZm9yd2FyZCB2ZWN0b3Igb2YgdGhlIGNhbWVyYS5cbiAqL1xuXG4vKipcbiAqIEFuIGluc3RhbmNlIG9mIGEge0BsaW5rIE1lc2h9LiBBIHNpbmdsZSBtZXNoIGNhbiBiZSByZWZlcmVuY2VkIGJ5IG1hbnkgbWVzaCBpbnN0YW5jZXMgdGhhdCBjYW5cbiAqIGhhdmUgZGlmZmVyZW50IHRyYW5zZm9ybXMgYW5kIG1hdGVyaWFscy5cbiAqL1xuY2xhc3MgTWVzaEluc3RhbmNlIHtcbiAgICAvKipcbiAgICAgKiBFbmFibGUgcmVuZGVyaW5nIGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuIFVzZSB2aXNpYmxlIHByb3BlcnR5IHRvIGVuYWJsZS9kaXNhYmxlXG4gICAgICogcmVuZGVyaW5nIHdpdGhvdXQgb3ZlcmhlYWQgb2YgcmVtb3ZpbmcgZnJvbSBzY2VuZS4gQnV0IG5vdGUgdGhhdCB0aGUgbWVzaCBpbnN0YW5jZSBpc1xuICAgICAqIHN0aWxsIGluIHRoZSBoaWVyYXJjaHkgYW5kIHN0aWxsIGluIHRoZSBkcmF3IGNhbGwgbGlzdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHZpc2libGUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHNoYWRvdyBjYXN0aW5nIGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuIFVzZSB0aGlzIHByb3BlcnR5IHRvIGVuYWJsZS9kaXNhYmxlXG4gICAgICogc2hhZG93IGNhc3Rpbmcgd2l0aG91dCBvdmVyaGVhZCBvZiByZW1vdmluZyBmcm9tIHNjZW5lLiBOb3RlIHRoYXQgdGhpcyBwcm9wZXJ0eSBkb2VzIG5vdFxuICAgICAqIGFkZCB0aGUgbWVzaCBpbnN0YW5jZSB0byBhcHByb3ByaWF0ZSBsaXN0IG9mIHNoYWRvdyBjYXN0ZXJzIG9uIGEge0BsaW5rIHBjLkxheWVyfSwgYnV0XG4gICAgICogYWxsb3dzIG1lc2ggdG8gYmUgc2tpcHBlZCBmcm9tIHNoYWRvdyBjYXN0aW5nIHdoaWxlIGl0IGlzIGluIHRoZSBsaXN0IGFscmVhZHkuIERlZmF1bHRzIHRvXG4gICAgICogZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBjYXN0U2hhZG93ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hdGVyaWFsO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2Ygc2hhZGVycyB1c2VkIGJ5IHRoZSBtZXNoIGluc3RhbmNlLCBpbmRleGVkIGJ5IHRoZSBzaGFkZXIgcGFzcyBjb25zdGFudCAoU0hBREVSX0ZPUldBUkQuLilcbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcycpLlNoYWRlcj59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9zaGFkZXIgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGJpbmQgZ3JvdXBzLCBzdG9yaW5nIHVuaWZvcm1zIHBlciBwYXNzLiBUaGlzIGhhcyAxOjEgcmVsYXRpb24gd2l0aCB0aGUgX3NoYWRlcyBhcnJheSxcbiAgICAgKiBhbmQgaXMgaW5kZXhlZCBieSB0aGUgc2hhZGVyIHBhc3MgY29uc3RhbnQgYXMgd2VsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxCaW5kR3JvdXA+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfYmluZEdyb3VwcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1lc2hJbnN0YW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL21lc2guanMnKS5NZXNofSBtZXNoIC0gVGhlIGdyYXBoaWNzIG1lc2ggdG8gaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSBmb3IgdGhpc1xuICAgICAqIG1lc2ggaW5zdGFuY2UuXG4gICAgICogQHBhcmFtIHtHcmFwaE5vZGV9IFtub2RlXSAtIFRoZSBncmFwaCBub2RlIGRlZmluaW5nIHRoZSB0cmFuc2Zvcm0gZm9yIHRoaXMgaW5zdGFuY2UuIFRoaXNcbiAgICAgKiBwYXJhbWV0ZXIgaXMgb3B0aW9uYWwgd2hlbiB1c2VkIHdpdGgge0BsaW5rIFJlbmRlckNvbXBvbmVudH0gYW5kIHdpbGwgdXNlIHRoZSBub2RlIHRoZVxuICAgICAqIGNvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG1lc2ggaW5zdGFuY2UgcG9pbnRpbmcgdG8gYSAxeDF4MSAnY3ViZScgbWVzaFxuICAgICAqIGNvbnN0IG1lc2ggPSBwYy5jcmVhdGVCb3goZ3JhcGhpY3NEZXZpY2UpO1xuICAgICAqIGNvbnN0IG1hdGVyaWFsID0gbmV3IHBjLlN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgKlxuICAgICAqIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG5ldyBwYy5NZXNoSW5zdGFuY2UobWVzaCwgbWF0ZXJpYWwpO1xuICAgICAqXG4gICAgICogY29uc3QgZW50aXR5ID0gbmV3IHBjLkVudGl0eSgpO1xuICAgICAqIGVudGl0eS5hZGRDb21wb25lbnQoJ3JlbmRlcicsIHtcbiAgICAgKiAgICAgbWVzaEluc3RhbmNlczogW21lc2hJbnN0YW5jZV1cbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCB0aGUgZW50aXR5IHRvIHRoZSBzY2VuZSBoaWVyYXJjaHlcbiAgICAgKiB0aGlzLmFwcC5zY2VuZS5yb290LmFkZENoaWxkKGVudGl0eSk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IobWVzaCwgbWF0ZXJpYWwsIG5vZGUgPSBudWxsKSB7XG4gICAgICAgIC8vIGlmIGZpcnN0IHBhcmFtZXRlciBpcyBvZiBHcmFwaE5vZGUgdHlwZSwgaGFuZGxlIHByZXZpb3VzIGNvbnN0cnVjdG9yIHNpZ25hdHVyZTogKG5vZGUsIG1lc2gsIG1hdGVyaWFsKVxuICAgICAgICBpZiAobWVzaCBpbnN0YW5jZW9mIEdyYXBoTm9kZSkge1xuICAgICAgICAgICAgY29uc3QgdGVtcCA9IG1lc2g7XG4gICAgICAgICAgICBtZXNoID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IG5vZGU7XG4gICAgICAgICAgICBub2RlID0gdGVtcDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2tleSA9IFswLCAwXTtcblxuICAgICAgICB0aGlzLmlzU3RhdGljID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3N0YXRpY0xpZ2h0TGlzdCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3N0YXRpY1NvdXJjZSA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBncmFwaCBub2RlIGRlZmluaW5nIHRoZSB0cmFuc2Zvcm0gZm9yIHRoaXMgaW5zdGFuY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtHcmFwaE5vZGV9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5vZGUgPSBub2RlOyAgICAgICAgICAgLy8gVGhlIG5vZGUgdGhhdCBkZWZpbmVzIHRoZSB0cmFuc2Zvcm0gb2YgdGhlIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgdGhpcy5fbWVzaCA9IG1lc2g7ICAgICAgICAgIC8vIFRoZSBtZXNoIHRoYXQgdGhpcyBpbnN0YW5jZSByZW5kZXJzXG4gICAgICAgIG1lc2guaW5jUmVmQ291bnQoKTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG1hdGVyaWFsOyAgIC8vIFRoZSBtYXRlcmlhbCB3aXRoIHdoaWNoIHRvIHJlbmRlciB0aGlzIGluc3RhbmNlXG5cbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IE1BU0tfQUZGRUNUX0RZTkFNSUMgPDwgMTY7IC8vIDIgYnl0ZSB0b2dnbGVzLCAyIGJ5dGVzIGxpZ2h0IG1hc2s7IERlZmF1bHQgdmFsdWUgaXMgbm8gdG9nZ2xlcyBhbmQgbWFzayA9IHBjLk1BU0tfQUZGRUNUX0RZTkFNSUNcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzVXYwID8gU0hBREVSREVGX1VWMCA6IDA7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgfD0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc1V2MSA/IFNIQURFUkRFRl9VVjEgOiAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzIHw9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNDb2xvciA/IFNIQURFUkRFRl9WQ09MT1IgOiAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzIHw9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNUYW5nZW50cyA/IFNIQURFUkRFRl9UQU5HRU5UUyA6IDA7XG5cbiAgICAgICAgdGhpcy5fbGlnaHRIYXNoID0gMDtcblxuICAgICAgICAvLyBSZW5kZXIgb3B0aW9uc1xuICAgICAgICB0aGlzLmxheWVyID0gTEFZRVJfV09STEQ7IC8vIGxlZ2FjeVxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fcmVuZGVyU3R5bGUgPSBSRU5ERVJTVFlMRV9TT0xJRDtcbiAgICAgICAgdGhpcy5fcmVjZWl2ZVNoYWRvdyA9IHRydWU7XG4gICAgICAgIHRoaXMuX3NjcmVlblNwYWNlID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX25vRGVwdGhEcmF3R2wxID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIG1lc2ggaW5zdGFuY2UgY2FuIGJlIGN1bGxlZCBieSBmcnVzdHVtIGN1bGxpbmdcbiAgICAgICAgICogKHtAbGluayBDYW1lcmFDb21wb25lbnQjZnJ1c3R1bUN1bGxpbmd9KS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN1bGwgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBtZXNoIGluc3RhbmNlIGlzIHBpY2thYmxlIGJ5IHRoZSB7QGxpbmsgUGlja2VyfS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucGljayA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlQWFiYiA9IHRydWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmJGdW5jID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU29ydERpc3RhbmNlID0gbnVsbDtcblxuICAgICAgICAvLyA2NC1iaXQgaW50ZWdlciBrZXkgdGhhdCBkZWZpbmVzIHJlbmRlciBvcmRlciBvZiB0aGlzIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9za2luLWluc3RhbmNlLmpzJykuU2tpbkluc3RhbmNlfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbW9ycGgtaW5zdGFuY2UuanMnKS5Nb3JwaEluc3RhbmNlfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fbW9ycGhJbnN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YSA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtCb3VuZGluZ0JveH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2N1c3RvbUFhYmIgPSBudWxsO1xuXG4gICAgICAgIC8vIFdvcmxkIHNwYWNlIEFBQkJcbiAgICAgICAgdGhpcy5hYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIHRoaXMuX2FhYmJWZXIgPSAtMTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlIHRoaXMgdmFsdWUgdG8gYWZmZWN0IHJlbmRlcmluZyBvcmRlciBvZiBtZXNoIGluc3RhbmNlcy4gT25seSB1c2VkIHdoZW4gbWVzaFxuICAgICAgICAgKiBpbnN0YW5jZXMgYXJlIGFkZGVkIHRvIGEge0BsaW5rIExheWVyfSB3aXRoIHtAbGluayBMYXllciNvcGFxdWVTb3J0TW9kZX0gb3JcbiAgICAgICAgICoge0BsaW5rIExheWVyI3RyYW5zcGFyZW50U29ydE1vZGV9IChkZXBlbmRpbmcgb24gdGhlIG1hdGVyaWFsKSBzZXQgdG9cbiAgICAgICAgICoge0BsaW5rIFNPUlRNT0RFX01BTlVBTH0uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmRyYXdPcmRlciA9IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlYWQgdGhpcyB2YWx1ZSBpbiB7QGxpbmsgTGF5ZXIjb25Qb3N0Q3VsbH0gdG8gZGV0ZXJtaW5lIGlmIHRoZSBvYmplY3QgaXMgYWN0dWFsbHkgZ29pbmdcbiAgICAgICAgICogdG8gYmUgcmVuZGVyZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy52aXNpYmxlVGhpc0ZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgLy8gY3VzdG9tIGZ1bmN0aW9uIHVzZWQgdG8gY3VzdG9taXplIGN1bGxpbmcgKGUuZy4gZm9yIDJEIFVJIGVsZW1lbnRzKVxuICAgICAgICB0aGlzLmlzVmlzaWJsZUZ1bmMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucGFyYW1ldGVycyA9IHt9O1xuXG4gICAgICAgIHRoaXMuc3RlbmNpbEZyb250ID0gbnVsbDtcbiAgICAgICAgdGhpcy5zdGVuY2lsQmFjayA9IG51bGw7XG5cbiAgICAgICAgLy8gTmVnYXRpdmUgc2NhbGUgYmF0Y2hpbmcgc3VwcG9ydFxuICAgICAgICB0aGlzLmZsaXBGYWNlc0ZhY3RvciA9IDE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbmRlciBzdHlsZSBvZiB0aGUgbWVzaCBpbnN0YW5jZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfU09MSUR9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfV0lSRUZSQU1FfVxuICAgICAqIC0ge0BsaW5rIFJFTkRFUlNUWUxFX1BPSU5UU31cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByZW5kZXJTdHlsZShyZW5kZXJTdHlsZSkge1xuICAgICAgICB0aGlzLl9yZW5kZXJTdHlsZSA9IHJlbmRlclN0eWxlO1xuICAgICAgICB0aGlzLm1lc2gucHJlcGFyZVJlbmRlclN0YXRlKHJlbmRlclN0eWxlKTtcbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU3R5bGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJTdHlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZ3JhcGhpY3MgbWVzaCBiZWluZyBpbnN0YW5jZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21lc2guanMnKS5NZXNofVxuICAgICAqL1xuICAgIHNldCBtZXNoKG1lc2gpIHtcblxuICAgICAgICBpZiAobWVzaCA9PT0gdGhpcy5fbWVzaClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaCkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaC5kZWNSZWZDb3VudCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWVzaCA9IG1lc2g7XG5cbiAgICAgICAgaWYgKG1lc2gpIHtcbiAgICAgICAgICAgIG1lc2guaW5jUmVmQ291bnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtZXNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWVzaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd29ybGQgc3BhY2UgYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveCBmb3IgdGhpcyBtZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0JvdW5kaW5nQm94fVxuICAgICAqL1xuICAgIHNldCBhYWJiKGFhYmIpIHtcbiAgICAgICAgdGhpcy5fYWFiYiA9IGFhYmI7XG4gICAgfVxuXG4gICAgZ2V0IGFhYmIoKSB7XG4gICAgICAgIC8vIHVzZSBzcGVjaWZpZWQgd29ybGQgc3BhY2UgYWFiYlxuICAgICAgICBpZiAoIXRoaXMuX3VwZGF0ZUFhYmIpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9hYWJiO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsbGJhY2sgZnVuY3Rpb24gcmV0dXJuaW5nIHdvcmxkIHNwYWNlIGFhYmJcbiAgICAgICAgaWYgKHRoaXMuX3VwZGF0ZUFhYmJGdW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlQWFiYkZ1bmModGhpcy5fYWFiYik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1c2UgbG9jYWwgc3BhY2Ugb3ZlcnJpZGUgYWFiYiBpZiBzcGVjaWZpZWRcbiAgICAgICAgbGV0IGxvY2FsQWFiYiA9IHRoaXMuX2N1c3RvbUFhYmI7XG4gICAgICAgIGxldCB0b1dvcmxkU3BhY2UgPSAhIWxvY2FsQWFiYjtcblxuICAgICAgICAvLyBvdGhlcndpc2UgZXZhbHVhdGUgbG9jYWwgYWFiYlxuICAgICAgICBpZiAoIWxvY2FsQWFiYikge1xuXG4gICAgICAgICAgICBsb2NhbEFhYmIgPSBfdG1wQWFiYjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc2tpbkluc3RhbmNlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBJbml0aWFsaXplIGxvY2FsIGJvbmUgQUFCQnMgaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm1lc2guYm9uZUFhYmIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRzID0gdGhpcy5fbW9ycGhJbnN0YW5jZSA/IHRoaXMuX21vcnBoSW5zdGFuY2UubW9ycGguX3RhcmdldHMgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1lc2guX2luaXRCb25lQWFiYnMobW9ycGhUYXJnZXRzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBldmFsdWF0ZSBsb2NhbCBzcGFjZSBib3VuZHMgYmFzZWQgb24gYWxsIGFjdGl2ZSBib25lc1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVVc2VkID0gdGhpcy5tZXNoLmJvbmVVc2VkO1xuICAgICAgICAgICAgICAgIGxldCBmaXJzdCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWVzaC5ib25lQWFiYi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYm9uZVVzZWRbaV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIGJvbmUgQUFCQiBieSBib25lIG1hdHJpeFxuICAgICAgICAgICAgICAgICAgICAgICAgX3RlbXBCb25lQWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKHRoaXMubWVzaC5ib25lQWFiYltpXSwgdGhpcy5za2luSW5zdGFuY2UubWF0cmljZXNbaV0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdGhlbSB1cFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpcnN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuY2VudGVyLmNvcHkoX3RlbXBCb25lQWFiYi5jZW50ZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5jb3B5KF90ZW1wQm9uZUFhYmIuaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuYWRkKF90ZW1wQm9uZUFhYmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdG9Xb3JsZFNwYWNlID0gdHJ1ZTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm5vZGUuX2FhYmJWZXIgIT09IHRoaXMuX2FhYmJWZXIpIHtcblxuICAgICAgICAgICAgICAgIC8vIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCAtIGVpdGhlciBmcm9tIG1lc2ggb3IgZW1wdHlcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5jZW50ZXIuY29weSh0aGlzLm1lc2guYWFiYi5jZW50ZXIpO1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuaGFsZkV4dGVudHMuY29weSh0aGlzLm1lc2guYWFiYi5oYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmNlbnRlci5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCBieSBtb3JwaCB0YXJnZXRzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubWVzaCAmJiB0aGlzLm1lc2gubW9ycGgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbW9ycGhBYWJiID0gdGhpcy5tZXNoLm1vcnBoLmFhYmI7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5fZXhwYW5kKG1vcnBoQWFiYi5nZXRNaW4oKSwgbW9ycGhBYWJiLmdldE1heCgpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0b1dvcmxkU3BhY2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FhYmJWZXIgPSB0aGlzLm5vZGUuX2FhYmJWZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdG9yZSB3b3JsZCBzcGFjZSBib3VuZGluZyBib3hcbiAgICAgICAgaWYgKHRvV29ybGRTcGFjZSkge1xuICAgICAgICAgICAgdGhpcy5fYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGxvY2FsQWFiYiwgdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FhYmI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgdGhlIGludGVybmFsIHNoYWRlciBhcnJheS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjbGVhclNoYWRlcnMoKSB7XG4gICAgICAgIGNvbnN0IHNoYWRlcnMgPSB0aGlzLl9zaGFkZXI7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2hhZGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc2hhZGVyc1tpXSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRlc3Ryb3lCaW5kR3JvdXBzKCk7XG4gICAgfVxuXG4gICAgZGVzdHJveUJpbmRHcm91cHMoKSB7XG5cbiAgICAgICAgY29uc3QgZ3JvdXBzID0gdGhpcy5fYmluZEdyb3VwcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBncm91cHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gZ3JvdXBzW2ldO1xuICAgICAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5pZm9ybUJ1ZmZlciA9IGdyb3VwLmRlZmF1bHRVbmlmb3JtQnVmZmVyO1xuICAgICAgICAgICAgICAgIGlmICh1bmlmb3JtQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVuaWZvcm1CdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBncm91cC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHBhc3MgLSBTaGFkZXIgcGFzcyBudW1iZXIuXG4gICAgICogQHJldHVybnMge0JpbmRHcm91cH0gLSBUaGUgbWVzaCBiaW5kIGdyb3VwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRCaW5kR3JvdXAoZGV2aWNlLCBwYXNzKSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIGJpbmQgZ3JvdXBcbiAgICAgICAgbGV0IGJpbmRHcm91cCA9IHRoaXMuX2JpbmRHcm91cHNbcGFzc107XG4gICAgICAgIGlmICghYmluZEdyb3VwKSB7XG4gICAgICAgICAgICBjb25zdCBzaGFkZXIgPSB0aGlzLl9zaGFkZXJbcGFzc107XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoc2hhZGVyKTtcblxuICAgICAgICAgICAgLy8gbWVzaCB1bmlmb3JtIGJ1ZmZlclxuICAgICAgICAgICAgY29uc3QgdWJGb3JtYXQgPSBzaGFkZXIubWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQ7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodWJGb3JtYXQpO1xuICAgICAgICAgICAgY29uc3QgdW5pZm9ybUJ1ZmZlciA9IG5ldyBVbmlmb3JtQnVmZmVyKGRldmljZSwgdWJGb3JtYXQpO1xuXG4gICAgICAgICAgICAvLyBtZXNoIGJpbmQgZ3JvdXBcbiAgICAgICAgICAgIGNvbnN0IGJpbmRHcm91cEZvcm1hdCA9IHNoYWRlci5tZXNoQmluZEdyb3VwRm9ybWF0O1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGJpbmRHcm91cEZvcm1hdCk7XG4gICAgICAgICAgICBiaW5kR3JvdXAgPSBuZXcgQmluZEdyb3VwKGRldmljZSwgYmluZEdyb3VwRm9ybWF0LCB1bmlmb3JtQnVmZmVyKTtcbiAgICAgICAgICAgIERlYnVnSGVscGVyLnNldE5hbWUoYmluZEdyb3VwLCBgTWVzaEJpbmRHcm91cF8ke2JpbmRHcm91cC5pZH1gKTtcblxuICAgICAgICAgICAgdGhpcy5fYmluZEdyb3Vwc1twYXNzXSA9IGJpbmRHcm91cDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBiaW5kR3JvdXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIHVzZWQgYnkgdGhpcyBtZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnKS5NYXRlcmlhbH1cbiAgICAgKi9cbiAgICBzZXQgbWF0ZXJpYWwobWF0ZXJpYWwpIHtcblxuICAgICAgICB0aGlzLmNsZWFyU2hhZGVycygpO1xuXG4gICAgICAgIGNvbnN0IHByZXZNYXQgPSB0aGlzLl9tYXRlcmlhbDtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIG1hdGVyaWFsJ3MgcmVmZXJlbmNlIHRvIHRoaXMgbWVzaCBpbnN0YW5jZVxuICAgICAgICBpZiAocHJldk1hdCkge1xuICAgICAgICAgICAgcHJldk1hdC5yZW1vdmVNZXNoSW5zdGFuY2VSZWYodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IG1hdGVyaWFsO1xuXG4gICAgICAgIGlmIChtYXRlcmlhbCkge1xuXG4gICAgICAgICAgICAvLyBSZWNvcmQgdGhhdCB0aGUgbWF0ZXJpYWwgaXMgcmVmZXJlbmNlZCBieSB0aGlzIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgIG1hdGVyaWFsLmFkZE1lc2hJbnN0YW5jZVJlZih0aGlzKTtcblxuICAgICAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcblxuICAgICAgICAgICAgLy8gaWYgYmxlbmQgdHlwZSBvZiB0aGUgbWF0ZXJpYWwgY2hhbmdlc1xuICAgICAgICAgICAgY29uc3QgcHJldkJsZW5kID0gcHJldk1hdCAmJiBwcmV2TWF0LnRyYW5zcGFyZW50O1xuICAgICAgICAgICAgaWYgKG1hdGVyaWFsLnRyYW5zcGFyZW50ICE9PSBwcmV2QmxlbmQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuX21hdGVyaWFsLl9zY2VuZSB8fCBwcmV2TWF0Py5fc2NlbmU7XG4gICAgICAgICAgICAgICAgaWYgKHNjZW5lKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lLmxheWVycy5fZGlydHlCbGVuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuX2RpcnR5QmxlbmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIHNldCBsYXllcihsYXllcikge1xuICAgICAgICB0aGlzLl9sYXllciA9IGxheWVyO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBsYXllcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluIHNvbWUgY2lyY3Vtc3RhbmNlcyBtZXNoIGluc3RhbmNlcyBhcmUgc29ydGVkIGJ5IGEgZGlzdGFuY2UgY2FsY3VsYXRpb24gdG8gZGV0ZXJtaW5lIHRoZWlyXG4gICAgICogcmVuZGVyaW5nIG9yZGVyLiBTZXQgdGhpcyBjYWxsYmFjayB0byBvdmVycmlkZSB0aGUgZGVmYXVsdCBkaXN0YW5jZSBjYWxjdWxhdGlvbiwgd2hpY2ggZ2l2ZXNcbiAgICAgKiB0aGUgZG90IHByb2R1Y3Qgb2YgdGhlIGNhbWVyYSBmb3J3YXJkIHZlY3RvciBhbmQgdGhlIHZlY3RvciBiZXR3ZWVuIHRoZSBjYW1lcmEgcG9zaXRpb24gYW5kXG4gICAgICogdGhlIGNlbnRlciBvZiB0aGUgbWVzaCBpbnN0YW5jZSdzIGF4aXMtYWxpZ25lZCBib3VuZGluZyBib3guIFRoaXMgb3B0aW9uIGNhbiBiZSBwYXJ0aWN1bGFybHlcbiAgICAgKiB1c2VmdWwgZm9yIHJlbmRlcmluZyB0cmFuc3BhcmVudCBtZXNoZXMgaW4gYSBiZXR0ZXIgb3JkZXIgdGhhbiBkZWZhdWx0LlxuICAgICAqXG4gICAgICogQHR5cGUge0NhbGN1bGF0ZVNvcnREaXN0YW5jZUNhbGxiYWNrfVxuICAgICAqL1xuICAgIHNldCBjYWxjdWxhdGVTb3J0RGlzdGFuY2UoY2FsY3VsYXRlU29ydERpc3RhbmNlKSB7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZSA9IGNhbGN1bGF0ZVNvcnREaXN0YW5jZTtcbiAgICB9XG5cbiAgICBnZXQgY2FsY3VsYXRlU29ydERpc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FsY3VsYXRlU29ydERpc3RhbmNlO1xuICAgIH1cblxuICAgIHNldCByZWNlaXZlU2hhZG93KHZhbCkge1xuICAgICAgICB0aGlzLl9yZWNlaXZlU2hhZG93ID0gdmFsO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gdmFsID8gKHRoaXMuX3NoYWRlckRlZnMgJiB+U0hBREVSREVGX05PU0hBRE9XKSA6ICh0aGlzLl9zaGFkZXJEZWZzIHwgU0hBREVSREVGX05PU0hBRE9XKTtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJEXSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSREhEUl0gPSBudWxsO1xuICAgIH1cblxuICAgIGdldCByZWNlaXZlU2hhZG93KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjZWl2ZVNoYWRvdztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc2tpbiBpbnN0YW5jZSBtYW5hZ2luZyBza2lubmluZyBvZiB0aGlzIG1lc2ggaW5zdGFuY2UsIG9yIG51bGwgaWYgc2tpbm5pbmcgaXMgbm90IHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3NraW4taW5zdGFuY2UuanMnKS5Ta2luSW5zdGFuY2V9XG4gICAgICovXG4gICAgc2V0IHNraW5JbnN0YW5jZSh2YWwpIHtcbiAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlID0gdmFsO1xuXG4gICAgICAgIGxldCBzaGFkZXJEZWZzID0gdGhpcy5fc2hhZGVyRGVmcztcbiAgICAgICAgc2hhZGVyRGVmcyA9IHZhbCA/IChzaGFkZXJEZWZzIHwgU0hBREVSREVGX1NLSU4pIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX1NLSU4pO1xuXG4gICAgICAgIC8vIGlmIHNoYWRlckRlZnMgaGF2ZSBjaGFuZ2VkXG4gICAgICAgIGlmIChzaGFkZXJEZWZzICE9PSB0aGlzLl9zaGFkZXJEZWZzKSB7XG4gICAgICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gc2hhZGVyRGVmcztcbiAgICAgICAgICAgIHRoaXMuY2xlYXJTaGFkZXJzKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc2V0dXBTa2luVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgZ2V0IHNraW5JbnN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NraW5JbnN0YW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbW9ycGggaW5zdGFuY2UgbWFuYWdpbmcgbW9ycGhpbmcgb2YgdGhpcyBtZXNoIGluc3RhbmNlLCBvciBudWxsIGlmIG1vcnBoaW5nIGlzIG5vdCB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9tb3JwaC1pbnN0YW5jZS5qcycpLk1vcnBoSW5zdGFuY2V9XG4gICAgICovXG4gICAgc2V0IG1vcnBoSW5zdGFuY2UodmFsKSB7XG5cbiAgICAgICAgLy8gcmVsZWFzZSBleGlzdGluZ1xuICAgICAgICB0aGlzLl9tb3JwaEluc3RhbmNlPy5kZXN0cm95KCk7XG5cbiAgICAgICAgLy8gYXNzaWduIG5ld1xuICAgICAgICB0aGlzLl9tb3JwaEluc3RhbmNlID0gdmFsO1xuXG4gICAgICAgIGxldCBzaGFkZXJEZWZzID0gdGhpcy5fc2hhZGVyRGVmcztcbiAgICAgICAgc2hhZGVyRGVmcyA9ICh2YWwgJiYgdmFsLm1vcnBoLnVzZVRleHR1cmVNb3JwaCkgPyAoc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEKSA6IChzaGFkZXJEZWZzICYgflNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEKTtcbiAgICAgICAgc2hhZGVyRGVmcyA9ICh2YWwgJiYgdmFsLm1vcnBoLm1vcnBoUG9zaXRpb25zKSA/IChzaGFkZXJEZWZzIHwgU0hBREVSREVGX01PUlBIX1BPU0lUSU9OKSA6IChzaGFkZXJEZWZzICYgflNIQURFUkRFRl9NT1JQSF9QT1NJVElPTik7XG4gICAgICAgIHNoYWRlckRlZnMgPSAodmFsICYmIHZhbC5tb3JwaC5tb3JwaE5vcm1hbHMpID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfTU9SUEhfTk9STUFMKSA6IChzaGFkZXJEZWZzICYgflNIQURFUkRFRl9NT1JQSF9OT1JNQUwpO1xuXG4gICAgICAgIC8vIGlmIHNoYWRlckRlZnMgaGF2ZSBjaGFuZ2VkXG4gICAgICAgIGlmIChzaGFkZXJEZWZzICE9PSB0aGlzLl9zaGFkZXJEZWZzKSB7XG4gICAgICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gc2hhZGVyRGVmcztcbiAgICAgICAgICAgIHRoaXMuY2xlYXJTaGFkZXJzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbW9ycGhJbnN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21vcnBoSW5zdGFuY2U7XG4gICAgfVxuXG4gICAgc2V0IHNjcmVlblNwYWNlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY3JlZW5TcGFjZSA9IHZhbDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IHZhbCA/ICh0aGlzLl9zaGFkZXJEZWZzIHwgU0hBREVSREVGX1NDUkVFTlNQQUNFKSA6ICh0aGlzLl9zaGFkZXJEZWZzICYgflNIQURFUkRFRl9TQ1JFRU5TUEFDRSk7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSRF0gPSBudWxsO1xuICAgIH1cblxuICAgIGdldCBzY3JlZW5TcGFjZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NjcmVlblNwYWNlO1xuICAgIH1cblxuICAgIHNldCBrZXkodmFsKSB7XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gdmFsO1xuICAgIH1cblxuICAgIGdldCBrZXkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXNrIGNvbnRyb2xsaW5nIHdoaWNoIHtAbGluayBMaWdodENvbXBvbmVudH1zIGxpZ2h0IHRoaXMgbWVzaCBpbnN0YW5jZSwgd2hpY2hcbiAgICAgKiB7QGxpbmsgQ2FtZXJhQ29tcG9uZW50fSBzZWVzIGl0IGFuZCBpbiB3aGljaCB7QGxpbmsgTGF5ZXJ9IGl0IGlzIHJlbmRlcmVkLiBEZWZhdWx0cyB0byAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWFzayh2YWwpIHtcbiAgICAgICAgY29uc3QgdG9nZ2xlcyA9IHRoaXMuX3NoYWRlckRlZnMgJiAweDAwMDBGRkZGO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gdG9nZ2xlcyB8ICh2YWwgPDwgMTYpO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRdID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJESERSXSA9IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0IG1hc2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkZXJEZWZzID4+IDE2O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE51bWJlciBvZiBpbnN0YW5jZXMgd2hlbiB1c2luZyBoYXJkd2FyZSBpbnN0YW5jaW5nIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGluc3RhbmNpbmdDb3VudCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5pbnN0YW5jaW5nRGF0YSlcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEuY291bnQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgaW5zdGFuY2luZ0NvdW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jaW5nRGF0YSA/IHRoaXMuaW5zdGFuY2luZ0RhdGEuY291bnQgOiAwO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgY29uc3QgbWVzaCA9IHRoaXMubWVzaDtcbiAgICAgICAgaWYgKG1lc2gpIHtcblxuICAgICAgICAgICAgLy8gdGhpcyBkZWNyZWFzZXMgcmVmIGNvdW50IG9uIHRoZSBtZXNoXG4gICAgICAgICAgICB0aGlzLm1lc2ggPSBudWxsO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IG1lc2hcbiAgICAgICAgICAgIGlmIChtZXNoLnJlZkNvdW50IDwgMSkge1xuICAgICAgICAgICAgICAgIG1lc2guZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSByZWYgY291bnRlZCBsaWdodG1hcHNcbiAgICAgICAgdGhpcy5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMF0sIG51bGwpO1xuICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1sxXSwgbnVsbCk7XG5cbiAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5tb3JwaEluc3RhbmNlPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubW9ycGhJbnN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcblxuICAgICAgICAvLyBtYWtlIHN1cmUgbWF0ZXJpYWwgY2xlYXJzIHJlZmVyZW5jZXMgdG8gdGhpcyBtZXNoSW5zdGFuY2VcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gc2hhZGVyIHVuaWZvcm0gbmFtZXMgZm9yIGxpZ2h0bWFwc1xuICAgIHN0YXRpYyBsaWdodG1hcFBhcmFtTmFtZXMgPSBbJ3RleHR1cmVfbGlnaHRNYXAnLCAndGV4dHVyZV9kaXJMaWdodE1hcCddO1xuXG4gICAgLy8gZ2VuZXJhdGVzIHdpcmVmcmFtZXMgZm9yIGFuIGFycmF5IG9mIG1lc2ggaW5zdGFuY2VzXG4gICAgc3RhdGljIF9wcmVwYXJlUmVuZGVyU3R5bGVGb3JBcnJheShtZXNoSW5zdGFuY2VzLCByZW5kZXJTdHlsZSkge1xuXG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIC8vIHN3aXRjaCBtZXNoIGluc3RhbmNlIHRvIHRoZSByZXF1ZXN0ZWQgc3R5bGVcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLl9yZW5kZXJTdHlsZSA9IHJlbmRlclN0eWxlO1xuXG4gICAgICAgICAgICAgICAgLy8gcHJvY2VzcyBhbGwgdW5pcXVlIG1lc2hlc1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoSW5zdGFuY2VzW2ldLm1lc2g7XG4gICAgICAgICAgICAgICAgaWYgKCFfbWVzaFNldC5oYXMobWVzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgX21lc2hTZXQuYWRkKG1lc2gpO1xuICAgICAgICAgICAgICAgICAgICBtZXNoLnByZXBhcmVSZW5kZXJTdGF0ZShyZW5kZXJTdHlsZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfbWVzaFNldC5jbGVhcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gdGVzdCBpZiBtZXNoSW5zdGFuY2UgaXMgdmlzaWJsZSBieSBjYW1lcmEuIEl0IHJlcXVpcmVzIHRoZSBmcnVzdHVtIG9mIHRoZSBjYW1lcmEgdG8gYmUgdXAgdG8gZGF0ZSwgd2hpY2ggZm9yd2FyZC1yZW5kZXJlclxuICAgIC8vIHRha2VzIGNhcmUgb2YuIFRoaXMgZnVuY3Rpb24gc2hvdWxkICBub3QgYmUgY2FsbGVkIGVsc2V3aGVyZS5cbiAgICBfaXNWaXNpYmxlKGNhbWVyYSkge1xuXG4gICAgICAgIGlmICh0aGlzLnZpc2libGUpIHtcblxuICAgICAgICAgICAgLy8gY3VzdG9tIHZpc2liaWxpdHkgbWV0aG9kIG9mIE1lc2hJbnN0YW5jZVxuICAgICAgICAgICAgaWYgKHRoaXMuaXNWaXNpYmxlRnVuYykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmlzVmlzaWJsZUZ1bmMoY2FtZXJhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX3RlbXBTcGhlcmUuY2VudGVyID0gdGhpcy5hYWJiLmNlbnRlcjsgIC8vIHRoaXMgbGluZSBldmFsdWF0ZXMgYWFiYlxuICAgICAgICAgICAgX3RlbXBTcGhlcmUucmFkaXVzID0gdGhpcy5fYWFiYi5oYWxmRXh0ZW50cy5sZW5ndGgoKTtcblxuICAgICAgICAgICAgcmV0dXJuIGNhbWVyYS5mcnVzdHVtLmNvbnRhaW5zU3BoZXJlKF90ZW1wU3BoZXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB1cGRhdGVLZXkoKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gdGhpcy5tYXRlcmlhbDtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSBnZXRLZXkodGhpcy5sYXllcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKG1hdGVyaWFsLmFscGhhVG9Db3ZlcmFnZSB8fCBtYXRlcmlhbC5hbHBoYVRlc3QpID8gQkxFTkRfTk9STUFMIDogbWF0ZXJpYWwuYmxlbmRUeXBlLCAvLyByZW5kZXIgYWxwaGF0ZXN0L2F0b2MgYWZ0ZXIgb3BhcXVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhbHNlLCBtYXRlcmlhbC5pZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB1cCB7QGxpbmsgTWVzaEluc3RhbmNlfSB0byBiZSByZW5kZXJlZCB1c2luZyBIYXJkd2FyZSBJbnN0YW5jaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnKS5WZXJ0ZXhCdWZmZXJ8bnVsbH0gdmVydGV4QnVmZmVyIC0gVmVydGV4IGJ1ZmZlciB0byBob2xkIHBlci1pbnN0YW5jZSB2ZXJ0ZXggZGF0YVxuICAgICAqICh1c3VhbGx5IHdvcmxkIG1hdHJpY2VzKS4gUGFzcyBudWxsIHRvIHR1cm4gb2ZmIGhhcmR3YXJlIGluc3RhbmNpbmcuXG4gICAgICovXG4gICAgc2V0SW5zdGFuY2luZyh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgaWYgKHZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YSA9IG5ldyBJbnN0YW5jaW5nRGF0YSh2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXMpO1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YS52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG5cbiAgICAgICAgICAgIC8vIG1hcmsgdmVydGV4IGJ1ZmZlciBhcyBpbnN0YW5jaW5nIGRhdGFcbiAgICAgICAgICAgIHZlcnRleEJ1ZmZlci5mb3JtYXQuaW5zdGFuY2luZyA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIHR1cm4gb2ZmIGN1bGxpbmcgLSB3ZSBkbyBub3QgZG8gcGVyLWluc3RhbmNlIGN1bGxpbmcsIGFsbCBpbnN0YW5jZXMgYXJlIHN1Ym1pdHRlZCB0byBHUFVcbiAgICAgICAgICAgIHRoaXMuY3VsbCA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmN1bGwgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogT2J0YWluIGEgc2hhZGVyIHZhcmlhbnQgcmVxdWlyZWQgdG8gcmVuZGVyIHRoZSBtZXNoIGluc3RhbmNlIHdpdGhpbiBzcGVjaWZpZWQgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3NjZW5lLmpzJykuU2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwYXNzIC0gVGhlIHJlbmRlciBwYXNzLlxuICAgICAqIEBwYXJhbSB7YW55fSBzdGF0aWNMaWdodExpc3QgLSBMaXN0IG9mIHN0YXRpYyBsaWdodHMuXG4gICAgICogQHBhcmFtIHthbnl9IHNvcnRlZExpZ2h0cyAtIEFycmF5IG9mIGFycmF5cyBvZiBsaWdodHMuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcycpLlVuaWZvcm1CdWZmZXJGb3JtYXR9IHZpZXdVbmlmb3JtRm9ybWF0IC0gVGhlXG4gICAgICogZm9ybWF0IG9mIHRoZSB2aWV3IHVuaWZvcm0gYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9iaW5kLWdyb3VwLWZvcm1hdC5qcycpLkJpbmRHcm91cEZvcm1hdH0gdmlld0JpbmRHcm91cEZvcm1hdCAtIFRoZVxuICAgICAqIGZvcm1hdCBvZiB0aGUgdmlldyBiaW5kIGdyb3VwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBzdGF0aWNMaWdodExpc3QsIHNvcnRlZExpZ2h0cywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpIHtcbiAgICAgICAgdGhpcy5fc2hhZGVyW3Bhc3NdID0gdGhpcy5tYXRlcmlhbC5nZXRTaGFkZXJWYXJpYW50KHRoaXMubWVzaC5kZXZpY2UsIHNjZW5lLCB0aGlzLl9zaGFkZXJEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0LCB0aGlzLl9tZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQpO1xuICAgIH1cblxuICAgIGVuc3VyZU1hdGVyaWFsKGRldmljZSkge1xuICAgICAgICBpZiAoIXRoaXMubWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYE1lc2ggYXR0YWNoZWQgdG8gZW50aXR5ICcke3RoaXMubm9kZS5uYW1lfScgZG9lcyBub3QgaGF2ZSBhIG1hdGVyaWFsLCB1c2luZyBhIGRlZmF1bHQgb25lLmApO1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IGdldERlZmF1bHRNYXRlcmlhbChkZXZpY2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUGFyYW1ldGVyIG1hbmFnZW1lbnRcbiAgICBjbGVhclBhcmFtZXRlcnMoKSB7XG4gICAgICAgIHRoaXMucGFyYW1ldGVycyA9IHt9O1xuICAgIH1cblxuICAgIGdldFBhcmFtZXRlcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmFtZXRlcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBzcGVjaWZpZWQgc2hhZGVyIHBhcmFtZXRlciBmcm9tIGEgbWVzaCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBxdWVyeS5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSBUaGUgbmFtZWQgcGFyYW1ldGVyLlxuICAgICAqL1xuICAgIGdldFBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmFtZXRlcnNbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHNoYWRlciBwYXJhbWV0ZXIgb24gYSBtZXNoIGluc3RhbmNlLiBOb3RlIHRoYXQgdGhpcyBwYXJhbWV0ZXIgd2lsbCB0YWtlIHByZWNlZGVuY2VcbiAgICAgKiBvdmVyIHBhcmFtZXRlciBvZiB0aGUgc2FtZSBuYW1lIGlmIHNldCBvbiBNYXRlcmlhbCB0aGlzIG1lc2ggaW5zdGFuY2UgdXNlcyBmb3IgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxudW1iZXJbXXxpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSBkYXRhIC0gVGhlIHZhbHVlXG4gICAgICogZm9yIHRoZSBzcGVjaWZpZWQgcGFyYW1ldGVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcGFzc0ZsYWdzXSAtIE1hc2sgZGVzY3JpYmluZyB3aGljaCBwYXNzZXMgdGhlIG1hdGVyaWFsIHNob3VsZCBiZSBpbmNsdWRlZFxuICAgICAqIGluLlxuICAgICAqL1xuICAgIHNldFBhcmFtZXRlcihuYW1lLCBkYXRhLCBwYXNzRmxhZ3MgPSAtMjYyMTQxKSB7XG5cbiAgICAgICAgLy8gbm90ZSBvbiAtMjYyMTQxOiBBbGwgYml0cyBzZXQgZXhjZXB0IDIgLSAxOSByYW5nZVxuXG4gICAgICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtT2JqZWN0ID0gbmFtZTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtT2JqZWN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdW5pZm9ybU9iamVjdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFBhcmFtZXRlcih1bmlmb3JtT2JqZWN0W2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmFtZSA9IHVuaWZvcm1PYmplY3QubmFtZTtcbiAgICAgICAgICAgIGRhdGEgPSB1bmlmb3JtT2JqZWN0LnZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGFyYW0gPSB0aGlzLnBhcmFtZXRlcnNbbmFtZV07XG4gICAgICAgIGlmIChwYXJhbSkge1xuICAgICAgICAgICAgcGFyYW0uZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICBwYXJhbS5wYXNzRmxhZ3MgPSBwYXNzRmxhZ3M7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBhcmFtZXRlcnNbbmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgc2NvcGVJZDogbnVsbCxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgICAgICAgICAgIHBhc3NGbGFnczogcGFzc0ZsYWdzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYSB3cmFwcGVyIG92ZXIgc2V0dGluZ3MgcGFyYW1ldGVyIHNwZWNpZmljYWxseSBmb3IgcmVhbHRpbWUgYmFrZWQgbGlnaHRtYXBzLiBUaGlzIGhhbmRsZXMgcmVmZXJlbmNlIGNvdW50aW5nIG9mIGxpZ2h0bWFwc1xuICAgIC8vIGFuZCByZWxlYXNlcyB0aGVtIHdoZW4gbm8gbG9uZ2VyIHJlZmVyZW5jZWRcbiAgICBzZXRSZWFsdGltZUxpZ2h0bWFwKG5hbWUsIHRleHR1cmUpIHtcblxuICAgICAgICAvLyBubyBjaGFuZ2VcbiAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5nZXRQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIGlmIChvbGQgPT09IHRleHR1cmUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gcmVtb3ZlIG9sZFxuICAgICAgICBpZiAob2xkKSB7XG4gICAgICAgICAgICBMaWdodG1hcENhY2hlLmRlY1JlZihvbGQuZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhc3NpZ24gbmV3XG4gICAgICAgIGlmICh0ZXh0dXJlKSB7XG4gICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyKG5hbWUsIHRleHR1cmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWxldGVQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAgLyoqXG4gICAgICAqIERlbGV0ZXMgYSBzaGFkZXIgcGFyYW1ldGVyIG9uIGEgbWVzaCBpbnN0YW5jZS5cbiAgICAgICpcbiAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIGRlbGV0ZS5cbiAgICAgICovXG4gICAgZGVsZXRlUGFyYW1ldGVyKG5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMucGFyYW1ldGVyc1tuYW1lXSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMucGFyYW1ldGVyc1tuYW1lXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVzZWQgdG8gYXBwbHkgcGFyYW1ldGVycyBmcm9tIHRoaXMgbWVzaCBpbnN0YW5jZSBpbnRvIHNjb3BlIG9mIHVuaWZvcm1zLCBjYWxsZWQgaW50ZXJuYWxseSBieSBmb3J3YXJkLXJlbmRlcmVyXG4gICAgc2V0UGFyYW1ldGVycyhkZXZpY2UsIHBhc3NGbGFnKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtZXRlcnMgPSB0aGlzLnBhcmFtZXRlcnM7XG4gICAgICAgIGZvciAoY29uc3QgcGFyYW1OYW1lIGluIHBhcmFtZXRlcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtZXRlciA9IHBhcmFtZXRlcnNbcGFyYW1OYW1lXTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXIucGFzc0ZsYWdzICYgcGFzc0ZsYWcpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXBhcmFtZXRlci5zY29wZUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtZXRlci5zY29wZUlkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUocGFyYW1OYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcGFyYW1ldGVyLnNjb3BlSWQuc2V0VmFsdWUocGFyYW1ldGVyLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0TGlnaHRtYXBwZWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLm1hc2sgPSAodGhpcy5tYXNrIHwgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQpICYgfihNQVNLX0FGRkVDVF9EWU5BTUlDIHwgTUFTS19CQUtFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzBdLCBudWxsKTtcbiAgICAgICAgICAgIHRoaXMuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzFdLCBudWxsKTtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgJj0gfihTSEFERVJERUZfTE0gfCBTSEFERVJERUZfRElSTE0gfCBTSEFERVJERUZfTE1BTUJJRU5UKTtcbiAgICAgICAgICAgIHRoaXMubWFzayA9ICh0aGlzLm1hc2sgfCBNQVNLX0FGRkVDVF9EWU5BTUlDKSAmIH4oTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQgfCBNQVNLX0JBS0UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0Q3VzdG9tQWFiYihhYWJiKSB7XG5cbiAgICAgICAgaWYgKGFhYmIpIHtcbiAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBvdmVycmlkZSBhYWJiXG4gICAgICAgICAgICBpZiAodGhpcy5fY3VzdG9tQWFiYikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2N1c3RvbUFhYmIuY29weShhYWJiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IGFhYmIuY2xvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vIG92ZXJyaWRlLCBmb3JjZSByZWZyZXNoIHRoZSBhY3R1YWwgb25lXG4gICAgICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NldHVwU2tpblVwZGF0ZSgpO1xuICAgIH1cblxuICAgIF9zZXR1cFNraW5VcGRhdGUoKSB7XG5cbiAgICAgICAgLy8gc2V0IGlmIGJvbmVzIG5lZWQgdG8gYmUgdXBkYXRlZCBiZWZvcmUgY3VsbGluZ1xuICAgICAgICBpZiAodGhpcy5fc2tpbkluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9za2luSW5zdGFuY2UuX3VwZGF0ZUJlZm9yZUN1bGwgPSAhdGhpcy5fY3VzdG9tQWFiYjtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0S2V5KGxheWVyLCBibGVuZFR5cGUsIGlzQ29tbWFuZCwgbWF0ZXJpYWxJZCkge1xuICAgIC8vIEtleSBkZWZpbml0aW9uOlxuICAgIC8vIEJpdFxuICAgIC8vIDMxICAgICAgOiBzaWduIGJpdCAobGVhdmUpXG4gICAgLy8gMjcgLSAzMCA6IGxheWVyXG4gICAgLy8gMjYgICAgICA6IHRyYW5zbHVjZW5jeSB0eXBlIChvcGFxdWUvdHJhbnNwYXJlbnQpXG4gICAgLy8gMjUgICAgICA6IENvbW1hbmQgYml0ICgxOiB0aGlzIGtleSBpcyBmb3IgYSBjb21tYW5kLCAwOiBpdCdzIGEgbWVzaCBpbnN0YW5jZSlcbiAgICAvLyAwIC0gMjQgIDogTWF0ZXJpYWwgSUQgKGlmIG9wYXF1ZSkgb3IgMCAoaWYgdHJhbnNwYXJlbnQgLSB3aWxsIGJlIGRlcHRoKVxuICAgIHJldHVybiAoKGxheWVyICYgMHgwZikgPDwgMjcpIHxcbiAgICAgICAgICAgKChibGVuZFR5cGUgPT09IEJMRU5EX05PTkUgPyAxIDogMCkgPDwgMjYpIHxcbiAgICAgICAgICAgKChpc0NvbW1hbmQgPyAxIDogMCkgPDwgMjUpIHxcbiAgICAgICAgICAgKChtYXRlcmlhbElkICYgMHgxZmZmZmZmKSA8PCAwKTtcbn1cblxuZXhwb3J0IHsgQ29tbWFuZCwgTWVzaEluc3RhbmNlIH07XG4iXSwibmFtZXMiOlsiX3RtcEFhYmIiLCJCb3VuZGluZ0JveCIsIl90ZW1wQm9uZUFhYmIiLCJfdGVtcFNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiX21lc2hTZXQiLCJTZXQiLCJJbnN0YW5jaW5nRGF0YSIsImNvbnN0cnVjdG9yIiwibnVtT2JqZWN0cyIsInZlcnRleEJ1ZmZlciIsImNvdW50IiwiQ29tbWFuZCIsImxheWVyIiwiYmxlbmRUeXBlIiwiY29tbWFuZCIsIl9rZXkiLCJTT1JUS0VZX0ZPUldBUkQiLCJnZXRLZXkiLCJrZXkiLCJ2YWwiLCJNZXNoSW5zdGFuY2UiLCJtZXNoIiwibWF0ZXJpYWwiLCJub2RlIiwidmlzaWJsZSIsImNhc3RTaGFkb3ciLCJfbWF0ZXJpYWwiLCJfc2hhZGVyIiwiX2JpbmRHcm91cHMiLCJHcmFwaE5vZGUiLCJ0ZW1wIiwiaXNTdGF0aWMiLCJfc3RhdGljTGlnaHRMaXN0IiwiX3N0YXRpY1NvdXJjZSIsIl9tZXNoIiwiaW5jUmVmQ291bnQiLCJfc2hhZGVyRGVmcyIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJmb3JtYXQiLCJoYXNVdjAiLCJTSEFERVJERUZfVVYwIiwiaGFzVXYxIiwiU0hBREVSREVGX1VWMSIsImhhc0NvbG9yIiwiU0hBREVSREVGX1ZDT0xPUiIsImhhc1RhbmdlbnRzIiwiU0hBREVSREVGX1RBTkdFTlRTIiwiX2xpZ2h0SGFzaCIsIkxBWUVSX1dPUkxEIiwiX3JlbmRlclN0eWxlIiwiUkVOREVSU1RZTEVfU09MSUQiLCJfcmVjZWl2ZVNoYWRvdyIsIl9zY3JlZW5TcGFjZSIsIl9ub0RlcHRoRHJhd0dsMSIsImN1bGwiLCJwaWNrIiwiX3VwZGF0ZUFhYmIiLCJfdXBkYXRlQWFiYkZ1bmMiLCJfY2FsY3VsYXRlU29ydERpc3RhbmNlIiwidXBkYXRlS2V5IiwiX3NraW5JbnN0YW5jZSIsIl9tb3JwaEluc3RhbmNlIiwiaW5zdGFuY2luZ0RhdGEiLCJfY3VzdG9tQWFiYiIsImFhYmIiLCJfYWFiYlZlciIsImRyYXdPcmRlciIsInZpc2libGVUaGlzRnJhbWUiLCJpc1Zpc2libGVGdW5jIiwicGFyYW1ldGVycyIsInN0ZW5jaWxGcm9udCIsInN0ZW5jaWxCYWNrIiwiZmxpcEZhY2VzRmFjdG9yIiwicmVuZGVyU3R5bGUiLCJwcmVwYXJlUmVuZGVyU3RhdGUiLCJkZWNSZWZDb3VudCIsIl9hYWJiIiwibG9jYWxBYWJiIiwidG9Xb3JsZFNwYWNlIiwic2tpbkluc3RhbmNlIiwiYm9uZUFhYmIiLCJtb3JwaFRhcmdldHMiLCJtb3JwaCIsIl90YXJnZXRzIiwiX2luaXRCb25lQWFiYnMiLCJib25lVXNlZCIsImZpcnN0IiwiaSIsImxlbmd0aCIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJtYXRyaWNlcyIsImNlbnRlciIsImNvcHkiLCJoYWxmRXh0ZW50cyIsImFkZCIsInNldCIsIm1vcnBoQWFiYiIsIl9leHBhbmQiLCJnZXRNaW4iLCJnZXRNYXgiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImNsZWFyU2hhZGVycyIsInNoYWRlcnMiLCJkZXN0cm95QmluZEdyb3VwcyIsImdyb3VwcyIsImdyb3VwIiwidW5pZm9ybUJ1ZmZlciIsImRlZmF1bHRVbmlmb3JtQnVmZmVyIiwiZGVzdHJveSIsImdldEJpbmRHcm91cCIsImRldmljZSIsInBhc3MiLCJiaW5kR3JvdXAiLCJzaGFkZXIiLCJEZWJ1ZyIsImFzc2VydCIsInViRm9ybWF0IiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJVbmlmb3JtQnVmZmVyIiwiYmluZEdyb3VwRm9ybWF0IiwibWVzaEJpbmRHcm91cEZvcm1hdCIsIkJpbmRHcm91cCIsIkRlYnVnSGVscGVyIiwic2V0TmFtZSIsImlkIiwicHJldk1hdCIsInJlbW92ZU1lc2hJbnN0YW5jZVJlZiIsImFkZE1lc2hJbnN0YW5jZVJlZiIsInByZXZCbGVuZCIsInRyYW5zcGFyZW50Iiwic2NlbmUiLCJfc2NlbmUiLCJsYXllcnMiLCJfZGlydHlCbGVuZCIsIl9sYXllciIsImNhbGN1bGF0ZVNvcnREaXN0YW5jZSIsInJlY2VpdmVTaGFkb3ciLCJTSEFERVJERUZfTk9TSEFET1ciLCJTSEFERVJfRk9SV0FSRCIsIlNIQURFUl9GT1JXQVJESERSIiwic2hhZGVyRGVmcyIsIlNIQURFUkRFRl9TS0lOIiwiX3NldHVwU2tpblVwZGF0ZSIsIm1vcnBoSW5zdGFuY2UiLCJfdGhpcyRfbW9ycGhJbnN0YW5jZSIsInVzZVRleHR1cmVNb3JwaCIsIlNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEIiwibW9ycGhQb3NpdGlvbnMiLCJTSEFERVJERUZfTU9SUEhfUE9TSVRJT04iLCJtb3JwaE5vcm1hbHMiLCJTSEFERVJERUZfTU9SUEhfTk9STUFMIiwic2NyZWVuU3BhY2UiLCJTSEFERVJERUZfU0NSRUVOU1BBQ0UiLCJtYXNrIiwidG9nZ2xlcyIsImluc3RhbmNpbmdDb3VudCIsInZhbHVlIiwiX3RoaXMkX3NraW5JbnN0YW5jZSIsIl90aGlzJG1vcnBoSW5zdGFuY2UiLCJyZWZDb3VudCIsInNldFJlYWx0aW1lTGlnaHRtYXAiLCJsaWdodG1hcFBhcmFtTmFtZXMiLCJfcHJlcGFyZVJlbmRlclN0eWxlRm9yQXJyYXkiLCJtZXNoSW5zdGFuY2VzIiwiaGFzIiwiY2xlYXIiLCJfaXNWaXNpYmxlIiwiY2FtZXJhIiwicmFkaXVzIiwiZnJ1c3R1bSIsImNvbnRhaW5zU3BoZXJlIiwiYWxwaGFUb0NvdmVyYWdlIiwiYWxwaGFUZXN0IiwiQkxFTkRfTk9STUFMIiwic2V0SW5zdGFuY2luZyIsIm51bVZlcnRpY2VzIiwiaW5zdGFuY2luZyIsInVwZGF0ZVBhc3NTaGFkZXIiLCJzdGF0aWNMaWdodExpc3QiLCJzb3J0ZWRMaWdodHMiLCJ2aWV3VW5pZm9ybUZvcm1hdCIsInZpZXdCaW5kR3JvdXBGb3JtYXQiLCJnZXRTaGFkZXJWYXJpYW50IiwiZW5zdXJlTWF0ZXJpYWwiLCJ3YXJuIiwibmFtZSIsImdldERlZmF1bHRNYXRlcmlhbCIsImNsZWFyUGFyYW1ldGVycyIsImdldFBhcmFtZXRlcnMiLCJnZXRQYXJhbWV0ZXIiLCJzZXRQYXJhbWV0ZXIiLCJkYXRhIiwicGFzc0ZsYWdzIiwidW5kZWZpbmVkIiwidW5pZm9ybU9iamVjdCIsInBhcmFtIiwic2NvcGVJZCIsInRleHR1cmUiLCJvbGQiLCJMaWdodG1hcENhY2hlIiwiZGVjUmVmIiwiaW5jUmVmIiwiZGVsZXRlUGFyYW1ldGVyIiwic2V0UGFyYW1ldGVycyIsInBhc3NGbGFnIiwicGFyYW1OYW1lIiwicGFyYW1ldGVyIiwic2NvcGUiLCJyZXNvbHZlIiwic2V0VmFsdWUiLCJzZXRMaWdodG1hcHBlZCIsIk1BU0tfQUZGRUNUX0xJR0hUTUFQUEVEIiwiTUFTS19CQUtFIiwiU0hBREVSREVGX0xNIiwiU0hBREVSREVGX0RJUkxNIiwiU0hBREVSREVGX0xNQU1CSUVOVCIsInNldEN1c3RvbUFhYmIiLCJjbG9uZSIsIl91cGRhdGVCZWZvcmVDdWxsIiwiaXNDb21tYW5kIiwibWF0ZXJpYWxJZCIsIkJMRU5EX05PTkUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUF3QkEsTUFBTUEsUUFBUSxHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBO0FBQ2xDLE1BQU1DLGFBQWEsR0FBRyxJQUFJRCxXQUFXLEVBQUUsQ0FBQTtBQUN2QyxNQUFNRSxXQUFXLEdBQUcsSUFBSUMsY0FBYyxFQUFFLENBQUE7QUFDeEMsTUFBTUMsUUFBUSxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBOztBQUUxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsY0FBYyxDQUFDO0FBQ2pCOztBQUdBO0FBQ0o7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxVQUFVLEVBQUU7SUFBQSxJQUx4QkMsQ0FBQUEsWUFBWSxHQUFHLElBQUksQ0FBQTtJQU1mLElBQUksQ0FBQ0MsS0FBSyxHQUFHRixVQUFVLENBQUE7QUFDM0IsR0FBQTtBQUNKLENBQUE7QUFFQSxNQUFNRyxPQUFPLENBQUM7QUFDVkosRUFBQUEsV0FBV0EsQ0FBQ0ssS0FBSyxFQUFFQyxTQUFTLEVBQUVDLE9BQU8sRUFBRTtJQUNuQyxJQUFJLENBQUNDLElBQUksR0FBRyxFQUFFLENBQUE7QUFDZCxJQUFBLElBQUksQ0FBQ0EsSUFBSSxDQUFDQyxlQUFlLENBQUMsR0FBR0MsTUFBTSxDQUFDTCxLQUFLLEVBQUVDLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDOUQsSUFBSSxDQUFDQyxPQUFPLEdBQUdBLE9BQU8sQ0FBQTtBQUMxQixHQUFBO0VBRUEsSUFBSUksR0FBR0EsQ0FBQ0MsR0FBRyxFQUFFO0FBQ1QsSUFB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
