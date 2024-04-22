import { BoundingBox } from '../core/shape/bounding-box.js';
import { BoundingSphere } from '../core/shape/bounding-sphere.js';
import { BindGroup } from '../platform/graphics/bind-group.js';
import { UniformBuffer } from '../platform/graphics/uniform-buffer.js';
import { MASK_AFFECT_DYNAMIC, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_TANGENTS, LAYER_WORLD, RENDERSTYLE_SOLID, SHADERDEF_NOSHADOW, SHADERDEF_SKIN, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_SCREENSPACE, SORTKEY_FORWARD, BLEND_NORMAL, BLEND_NONE, SHADERDEF_INSTANCING, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT } from './constants.js';
import { GraphNode } from './graph-node.js';
import { getDefaultMaterial } from './materials/default-material.js';
import { LightmapCache } from './graphics/lightmap-cache.js';

let id = 0;
const _tmpAabb = new BoundingBox();
const _tempBoneAabb = new BoundingBox();
const _tempSphere = new BoundingSphere();
const _meshSet = new Set();
class InstancingData {
  constructor(numObjects) {
    this.vertexBuffer = null;
    this.count = numObjects;
  }
}
class ShaderInstance {
  constructor() {
    this.shader = void 0;
    this.bindGroup = null;
  }
  getBindGroup(device) {
    if (!this.bindGroup) {
      const shader = this.shader;
      const ubFormat = shader.meshUniformBufferFormat;
      const uniformBuffer = new UniformBuffer(device, ubFormat, false);
      const bindGroupFormat = shader.meshBindGroupFormat;
      this.bindGroup = new BindGroup(device, bindGroupFormat, uniformBuffer);
    }
    return this.bindGroup;
  }
  destroy() {
    const group = this.bindGroup;
    if (group) {
      var _group$defaultUniform;
      (_group$defaultUniform = group.defaultUniformBuffer) == null || _group$defaultUniform.destroy();
      group.destroy();
      this.bindGroup = null;
    }
  }
}
class ShaderCacheEntry {
  constructor() {
    this.shaderInstances = new Map();
  }
  destroy() {
    this.shaderInstances.forEach(instance => instance.destroy());
    this.shaderInstances.clear();
  }
}
class MeshInstance {
  constructor(mesh, material, node = null) {
    this.visible = true;
    this.castShadow = false;
    this.transparent = false;
    this._material = null;
    this._shaderCache = [];
    this.id = id++;
    this.pick = true;
    if (mesh instanceof GraphNode) {
      const temp = mesh;
      mesh = material;
      material = node;
      node = temp;
    }
    this._key = [0, 0];
    this.node = node;
    this._mesh = mesh;
    mesh.incRefCount();
    this.material = material;
    this._shaderDefs = MASK_AFFECT_DYNAMIC << 16;
    if (mesh.vertexBuffer) {
      const format = mesh.vertexBuffer.format;
      this._shaderDefs |= format.hasUv0 ? SHADERDEF_UV0 : 0;
      this._shaderDefs |= format.hasUv1 ? SHADERDEF_UV1 : 0;
      this._shaderDefs |= format.hasColor ? SHADERDEF_VCOLOR : 0;
      this._shaderDefs |= format.hasTangents ? SHADERDEF_TANGENTS : 0;
    }
    this.layer = LAYER_WORLD;
    this._renderStyle = RENDERSTYLE_SOLID;
    this._receiveShadow = true;
    this._screenSpace = false;
    this.cull = true;
    this._updateAabb = true;
    this._updateAabbFunc = null;
    this._calculateSortDistance = null;
    this.updateKey();
    this._skinInstance = null;
    this._morphInstance = null;
    this.gsplatInstance = null;
    this.instancingData = null;
    this._customAabb = null;
    this.aabb = new BoundingBox();
    this._aabbVer = -1;
    this._aabbMeshVer = -1;
    this.drawOrder = 0;
    this.visibleThisFrame = false;
    this.isVisibleFunc = null;
    this.parameters = {};
    this.stencilFront = null;
    this.stencilBack = null;
    this.flipFacesFactor = 1;
  }
  set renderStyle(renderStyle) {
    this._renderStyle = renderStyle;
    this.mesh.prepareRenderState(renderStyle);
  }
  get renderStyle() {
    return this._renderStyle;
  }
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
  set aabb(aabb) {
    this._aabb = aabb;
  }
  get aabb() {
    if (!this._updateAabb) {
      return this._aabb;
    }
    if (this._updateAabbFunc) {
      return this._updateAabbFunc(this._aabb);
    }
    let localAabb = this._customAabb;
    let toWorldSpace = !!localAabb;
    if (!localAabb) {
      localAabb = _tmpAabb;
      if (this.skinInstance) {
        if (!this.mesh.boneAabb) {
          const morphTargets = this._morphInstance ? this._morphInstance.morph._targets : null;
          this.mesh._initBoneAabbs(morphTargets);
        }
        const boneUsed = this.mesh.boneUsed;
        let first = true;
        for (let i = 0; i < this.mesh.boneAabb.length; i++) {
          if (boneUsed[i]) {
            _tempBoneAabb.setFromTransformedAabb(this.mesh.boneAabb[i], this.skinInstance.matrices[i]);
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
      } else if (this.node._aabbVer !== this._aabbVer || this.mesh._aabbVer !== this._aabbMeshVer) {
        if (this.mesh) {
          localAabb.center.copy(this.mesh.aabb.center);
          localAabb.halfExtents.copy(this.mesh.aabb.halfExtents);
        } else {
          localAabb.center.set(0, 0, 0);
          localAabb.halfExtents.set(0, 0, 0);
        }
        if (this.mesh && this.mesh.morph) {
          const morphAabb = this.mesh.morph.aabb;
          localAabb._expand(morphAabb.getMin(), morphAabb.getMax());
        }
        toWorldSpace = true;
        this._aabbVer = this.node._aabbVer;
        this._aabbMeshVer = this.mesh._aabbVer;
      }
    }
    if (toWorldSpace) {
      this._aabb.setFromTransformedAabb(localAabb, this.node.getWorldTransform());
    }
    return this._aabb;
  }
  clearShaders() {
    const shaderCache = this._shaderCache;
    for (let i = 0; i < shaderCache.length; i++) {
      var _shaderCache$i;
      (_shaderCache$i = shaderCache[i]) == null || _shaderCache$i.destroy();
      shaderCache[i] = null;
    }
  }
  getShaderInstance(shaderPass, lightHash, scene, viewUniformFormat, viewBindGroupFormat, sortedLights) {
    let shaderInstance;
    let passEntry = this._shaderCache[shaderPass];
    if (passEntry) {
      shaderInstance = passEntry.shaderInstances.get(lightHash);
    } else {
      passEntry = new ShaderCacheEntry();
      this._shaderCache[shaderPass] = passEntry;
    }
    if (!shaderInstance) {
      const mat = this._material;
      const shaderDefs = this._shaderDefs;
      const variantKey = shaderPass + '_' + shaderDefs + '_' + lightHash;
      shaderInstance = new ShaderInstance();
      shaderInstance.shader = mat.variants.get(variantKey);
      if (!shaderInstance.shader) {
        var _this$_mesh$vertexBuf;
        const shader = mat.getShaderVariant(this.mesh.device, scene, shaderDefs, null, shaderPass, sortedLights, viewUniformFormat, viewBindGroupFormat, (_this$_mesh$vertexBuf = this._mesh.vertexBuffer) == null ? void 0 : _this$_mesh$vertexBuf.format);
        mat.variants.set(variantKey, shader);
        shaderInstance.shader = shader;
      }
      passEntry.shaderInstances.set(lightHash, shaderInstance);
    }
    return shaderInstance;
  }
  set material(material) {
    this.clearShaders();
    const prevMat = this._material;
    if (prevMat) {
      prevMat.removeMeshInstanceRef(this);
    }
    this._material = material;
    if (material) {
      material.addMeshInstanceRef(this);
      this.transparent = material.transparent;
      this.updateKey();
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
  _updateShaderDefs(shaderDefs) {
    if (shaderDefs !== this._shaderDefs) {
      this._shaderDefs = shaderDefs;
      this.clearShaders();
    }
  }
  set calculateSortDistance(calculateSortDistance) {
    this._calculateSortDistance = calculateSortDistance;
  }
  get calculateSortDistance() {
    return this._calculateSortDistance;
  }
  set receiveShadow(val) {
    if (this._receiveShadow !== val) {
      this._receiveShadow = val;
      this._updateShaderDefs(val ? this._shaderDefs & ~SHADERDEF_NOSHADOW : this._shaderDefs | SHADERDEF_NOSHADOW);
    }
  }
  get receiveShadow() {
    return this._receiveShadow;
  }
  set skinInstance(val) {
    this._skinInstance = val;
    this._updateShaderDefs(val ? this._shaderDefs | SHADERDEF_SKIN : this._shaderDefs & ~SHADERDEF_SKIN);
    this._setupSkinUpdate();
  }
  get skinInstance() {
    return this._skinInstance;
  }
  set morphInstance(val) {
    var _this$_morphInstance;
    (_this$_morphInstance = this._morphInstance) == null || _this$_morphInstance.destroy();
    this._morphInstance = val;
    let shaderDefs = this._shaderDefs;
    shaderDefs = val && val.morph.useTextureMorph ? shaderDefs | SHADERDEF_MORPH_TEXTURE_BASED : shaderDefs & ~SHADERDEF_MORPH_TEXTURE_BASED;
    shaderDefs = val && val.morph.morphPositions ? shaderDefs | SHADERDEF_MORPH_POSITION : shaderDefs & ~SHADERDEF_MORPH_POSITION;
    shaderDefs = val && val.morph.morphNormals ? shaderDefs | SHADERDEF_MORPH_NORMAL : shaderDefs & ~SHADERDEF_MORPH_NORMAL;
    this._updateShaderDefs(shaderDefs);
  }
  get morphInstance() {
    return this._morphInstance;
  }
  set screenSpace(val) {
    if (this._screenSpace !== val) {
      this._screenSpace = val;
      this._updateShaderDefs(val ? this._shaderDefs | SHADERDEF_SCREENSPACE : this._shaderDefs & ~SHADERDEF_SCREENSPACE);
    }
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
  set mask(val) {
    const toggles = this._shaderDefs & 0x0000FFFF;
    this._updateShaderDefs(toggles | val << 16);
  }
  get mask() {
    return this._shaderDefs >> 16;
  }
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
      this.mesh = null;
      if (mesh.refCount < 1) {
        mesh.destroy();
      }
    }
    this.setRealtimeLightmap(MeshInstance.lightmapParamNames[0], null);
    this.setRealtimeLightmap(MeshInstance.lightmapParamNames[1], null);
    (_this$_skinInstance = this._skinInstance) == null || _this$_skinInstance.destroy();
    this._skinInstance = null;
    (_this$morphInstance = this.morphInstance) == null || _this$morphInstance.destroy();
    this.morphInstance = null;
    this.clearShaders();
    this.material = null;
  }
  static _prepareRenderStyleForArray(meshInstances, renderStyle) {
    if (meshInstances) {
      for (let i = 0; i < meshInstances.length; i++) {
        meshInstances[i]._renderStyle = renderStyle;
        const mesh = meshInstances[i].mesh;
        if (!_meshSet.has(mesh)) {
          _meshSet.add(mesh);
          mesh.prepareRenderState(renderStyle);
        }
      }
      _meshSet.clear();
    }
  }
  _isVisible(camera) {
    if (this.visible) {
      if (this.isVisibleFunc) {
        return this.isVisibleFunc(camera);
      }
      _tempSphere.center = this.aabb.center;
      _tempSphere.radius = this._aabb.halfExtents.length();
      return camera.frustum.containsSphere(_tempSphere);
    }
    return false;
  }
  updateKey() {
    const material = this.material;
    const blendType = material.alphaToCoverage || material.alphaTest ? BLEND_NORMAL : material.blendType;
    this._key[SORTKEY_FORWARD] = (this.layer & 0x0f) << 27 | (blendType === BLEND_NONE ? 1 : 0) << 26 | (material.id & 0x1ffffff) << 0;
  }
  setInstancing(vertexBuffer, cull = false) {
    if (vertexBuffer) {
      this.instancingData = new InstancingData(vertexBuffer.numVertices);
      this.instancingData.vertexBuffer = vertexBuffer;
      vertexBuffer.format.instancing = true;
      this.cull = cull;
    } else {
      this.instancingData = null;
      this.cull = true;
    }
    this._updateShaderDefs(vertexBuffer ? this._shaderDefs | SHADERDEF_INSTANCING : this._shaderDefs & ~SHADERDEF_INSTANCING);
  }
  ensureMaterial(device) {
    if (!this.material) {
      this.material = getDefaultMaterial(device);
    }
  }
  clearParameters() {
    this.parameters = {};
  }
  getParameters() {
    return this.parameters;
  }
  getParameter(name) {
    return this.parameters[name];
  }
  setParameter(name, data, passFlags = -262141) {
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
  setRealtimeLightmap(name, texture) {
    const old = this.getParameter(name);
    if (old === texture) return;
    if (old) {
      LightmapCache.decRef(old.data);
    }
    if (texture) {
      LightmapCache.incRef(texture);
      this.setParameter(name, texture);
    } else {
      this.deleteParameter(name);
    }
  }
  deleteParameter(name) {
    if (this.parameters[name]) {
      delete this.parameters[name];
    }
  }
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
      if (this._customAabb) {
        this._customAabb.copy(aabb);
      } else {
        this._customAabb = aabb.clone();
      }
    } else {
      this._customAabb = null;
      this._aabbVer = -1;
    }
    this._setupSkinUpdate();
  }
  _setupSkinUpdate() {
    if (this._skinInstance) {
      this._skinInstance._updateBeforeCull = !this._customAabb;
    }
  }
}
MeshInstance.lightmapParamNames = ['texture_lightMap', 'texture_dirLightMap'];

export { MeshInstance };
