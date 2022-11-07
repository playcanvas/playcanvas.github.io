/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
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

class InstancingData {

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

class MeshInstance {

  constructor(mesh, material, node = null) {
    this._material = void 0;
    this._shader = [];
    this._bindGroups = [];
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

    this.node = node;
    this._mesh = mesh;
    mesh.incRefCount();
    this.material = material;

    this._shaderDefs = MASK_AFFECT_DYNAMIC << 16;
    this._shaderDefs |= mesh.vertexBuffer.format.hasUv0 ? SHADERDEF_UV0 : 0;
    this._shaderDefs |= mesh.vertexBuffer.format.hasUv1 ? SHADERDEF_UV1 : 0;
    this._shaderDefs |= mesh.vertexBuffer.format.hasColor ? SHADERDEF_VCOLOR : 0;
    this._shaderDefs |= mesh.vertexBuffer.format.hasTangents ? SHADERDEF_TANGENTS : 0;
    this._lightHash = 0;

    this.visible = true;
    this.layer = LAYER_WORLD;
    this._renderStyle = RENDERSTYLE_SOLID;
    this.castShadow = false;
    this._receiveShadow = true;
    this._screenSpace = false;
    this._noDepthDrawGl1 = false;

    this.cull = true;

    this.pick = true;
    this._updateAabb = true;
    this._updateAabbFunc = null;
    this._calculateSortDistance = null;

    this.updateKey();

    this._skinInstance = null;
    this._morphInstance = null;
    this.instancingData = null;

    this._customAabb = null;

    this.aabb = new BoundingBox();
    this._aabbVer = -1;

    this.drawOrder = 0;

    this.visibleThisFrame = false;

    this.isVisibleFunc = null;
    this.parameters = {};
    this.stencilFront = null;
    this.stencilBack = null;

    this.flipFaces = false;
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
      } else if (this.node._aabbVer !== this._aabbVer) {
        if (this.mesh) {
          localAabb.center.copy(this.mesh.aabb.center);
          localAabb.halfExtents.copy(this.mesh.aabb.halfExtents);
        } else {
          localAabb.center.set(0, 0, 0);
          localAabb.halfExtents.set(0, 0, 0);
        }

        if (this.mesh && this.mesh.morph) {
          localAabb._expand(this.mesh.morph.aabb.getMin(), this.mesh.morph.aabb.getMax());
        }
        toWorldSpace = true;
        this._aabbVer = this.node._aabbVer;
      }
    }

    if (toWorldSpace) {
      this._aabb.setFromTransformedAabb(localAabb, this.node.getWorldTransform());
    }
    return this._aabb;
  }

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

  getBindGroup(device, pass) {
    let bindGroup = this._bindGroups[pass];
    if (!bindGroup) {
      const shader = this._shader[pass];
      Debug.assert(shader);

      const ubFormat = shader.meshUniformBufferFormat;
      Debug.assert(ubFormat);
      const uniformBuffer = new UniformBuffer(device, ubFormat);

      const bingGroupFormat = shader.meshBindGroupFormat;
      Debug.assert(bingGroupFormat);
      bindGroup = new BindGroup(device, bingGroupFormat, uniformBuffer);
      this._bindGroups[pass] = bindGroup;
    }
    return bindGroup;
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
      this.updateKey();

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

  set skinInstance(val) {
    this._skinInstance = val;
    let shaderDefs = this._shaderDefs;
    shaderDefs = val ? shaderDefs | SHADERDEF_SKIN : shaderDefs & ~SHADERDEF_SKIN;

    if (shaderDefs !== this._shaderDefs) {
      this._shaderDefs = shaderDefs;
      this.clearShaders();
    }
    this._setupSkinUpdate();
  }
  get skinInstance() {
    return this._skinInstance;
  }

  set morphInstance(val) {
    var _this$_morphInstance;
    (_this$_morphInstance = this._morphInstance) == null ? void 0 : _this$_morphInstance.destroy();

    this._morphInstance = val;
    let shaderDefs = this._shaderDefs;
    shaderDefs = val && val.morph.useTextureMorph ? shaderDefs | SHADERDEF_MORPH_TEXTURE_BASED : shaderDefs & ~SHADERDEF_MORPH_TEXTURE_BASED;
    shaderDefs = val && val.morph.morphPositions ? shaderDefs | SHADERDEF_MORPH_POSITION : shaderDefs & ~SHADERDEF_MORPH_POSITION;
    shaderDefs = val && val.morph.morphNormals ? shaderDefs | SHADERDEF_MORPH_NORMAL : shaderDefs & ~SHADERDEF_MORPH_NORMAL;

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

  set mask(val) {
    const toggles = this._shaderDefs & 0x0000FFFF;
    this._shaderDefs = toggles | val << 16;
    this._shader[SHADER_FORWARD] = null;
    this._shader[SHADER_FORWARDHDR] = null;
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
    (_this$_skinInstance = this._skinInstance) == null ? void 0 : _this$_skinInstance.destroy();
    this._skinInstance = null;
    (_this$morphInstance = this.morphInstance) == null ? void 0 : _this$morphInstance.destroy();
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
    this._key[SORTKEY_FORWARD] = getKey(this.layer, material.alphaToCoverage || material.alphaTest ? BLEND_NORMAL : material.blendType,
    false, material.id);
  }

  setInstancing(vertexBuffer) {
    if (vertexBuffer) {
      this.instancingData = new InstancingData(vertexBuffer.numVertices);
      this.instancingData.vertexBuffer = vertexBuffer;

      vertexBuffer.instancing = true;

      this.cull = false;
    } else {
      this.instancingData = null;
      this.cull = true;
    }
  }

  updatePassShader(scene, pass, staticLightList, sortedLights, viewUniformFormat, viewBindGroupFormat) {
    this._shader[pass] = this.material.getShaderVariant(this.mesh.device, scene, this._shaderDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat);
  }
  ensureMaterial(device) {
    if (!this.material) {
      Debug.warn(`Mesh attached to entity '${this.node.name}' does not have a material, using a default one.`);
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
function getKey(layer, blendType, isCommand, materialId) {
  return (layer & 0x0f) << 27 | (blendType === BLEND_NONE ? 1 : 0) << 26 | (isCommand ? 1 : 0) << 25 | (materialId & 0x1ffffff) << 0;
}

export { Command, MeshInstance };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC1pbnN0YW5jZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL21lc2gtaW5zdGFuY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgQm91bmRpbmdCb3ggfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ1NwaGVyZSB9IGZyb20gJy4uL2NvcmUvc2hhcGUvYm91bmRpbmctc3BoZXJlLmpzJztcblxuaW1wb3J0IHsgQmluZEdyb3VwIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC5qcyc7XG5pbXBvcnQgeyBVbmlmb3JtQnVmZmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXIuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEJMRU5EX05PUk1BTCxcbiAgICBMQVlFUl9XT1JMRCxcbiAgICBNQVNLX0FGRkVDVF9EWU5BTUlDLCBNQVNLX0JBS0UsIE1BU0tfQUZGRUNUX0xJR0hUTUFQUEVELFxuICAgIFJFTkRFUlNUWUxFX1NPTElELFxuICAgIFNIQURFUl9GT1JXQVJELCBTSEFERVJfRk9SV0FSREhEUixcbiAgICBTSEFERVJERUZfVVYwLCBTSEFERVJERUZfVVYxLCBTSEFERVJERUZfVkNPTE9SLCBTSEFERVJERUZfVEFOR0VOVFMsIFNIQURFUkRFRl9OT1NIQURPVywgU0hBREVSREVGX1NLSU4sXG4gICAgU0hBREVSREVGX1NDUkVFTlNQQUNFLCBTSEFERVJERUZfTU9SUEhfUE9TSVRJT04sIFNIQURFUkRFRl9NT1JQSF9OT1JNQUwsIFNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VELFxuICAgIFNIQURFUkRFRl9MTSwgU0hBREVSREVGX0RJUkxNLCBTSEFERVJERUZfTE1BTUJJRU5ULFxuICAgIFNPUlRLRVlfRk9SV0FSRFxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4vZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0TWF0ZXJpYWwgfSBmcm9tICcuL21hdGVyaWFscy9kZWZhdWx0LW1hdGVyaWFsLmpzJztcbmltcG9ydCB7IExpZ2h0bWFwQ2FjaGUgfSBmcm9tICcuL2dyYXBoaWNzL2xpZ2h0bWFwLWNhY2hlLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSBUZXh0dXJlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzJykuU2hhZGVyfSBTaGFkZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJykuVmVydGV4QnVmZmVyfSBWZXJ0ZXhCdWZmZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9iaW5kLWdyb3VwLWZvcm1hdC5qcycpLkJpbmRHcm91cEZvcm1hdH0gQmluZEdyb3VwRm9ybWF0ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJykuVW5pZm9ybUJ1ZmZlckZvcm1hdH0gVW5pZm9ybUJ1ZmZlckZvcm1hdCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBHcmFwaGljc0RldmljZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gVmVjMyAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9IE1hdGVyaWFsICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9tZXNoLmpzJykuTWVzaH0gTWVzaCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc2NlbmUuanMnKS5TY2VuZX0gU2NlbmUgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL21vcnBoLWluc3RhbmNlLmpzJykuTW9ycGhJbnN0YW5jZX0gTW9ycGhJbnN0YW5jZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc2tpbi1pbnN0YW5jZS5qcycpLlNraW5JbnN0YW5jZX0gU2tpbkluc3RhbmNlICovXG5cbmNvbnN0IF90bXBBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcEJvbmVBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX21lc2hTZXQgPSBuZXcgU2V0KCk7XG5cblxuLyoqXG4gKiBJbnRlcm5hbCBkYXRhIHN0cnVjdHVyZSB1c2VkIHRvIHN0b3JlIGRhdGEgdXNlZCBieSBoYXJkd2FyZSBpbnN0YW5jaW5nLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgSW5zdGFuY2luZ0RhdGEge1xuICAgIC8qKiBAdHlwZSB7VmVydGV4QnVmZmVyfG51bGx9ICovXG4gICAgdmVydGV4QnVmZmVyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW1PYmplY3RzIC0gVGhlIG51bWJlciBvZiBvYmplY3RzIGluc3RhbmNlZC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihudW1PYmplY3RzKSB7XG4gICAgICAgIHRoaXMuY291bnQgPSBudW1PYmplY3RzO1xuICAgIH1cbn1cblxuY2xhc3MgQ29tbWFuZCB7XG4gICAgY29uc3RydWN0b3IobGF5ZXIsIGJsZW5kVHlwZSwgY29tbWFuZCkge1xuICAgICAgICB0aGlzLl9rZXkgPSBbXTtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSBnZXRLZXkobGF5ZXIsIGJsZW5kVHlwZSwgdHJ1ZSwgMCk7XG4gICAgICAgIHRoaXMuY29tbWFuZCA9IGNvbW1hbmQ7XG4gICAgfVxuXG4gICAgc2V0IGtleSh2YWwpIHtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSB2YWw7XG4gICAgfVxuXG4gICAgZ2V0IGtleSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBMYXllcn0gdG8gY2FsY3VsYXRlIHRoZSBcInNvcnQgZGlzdGFuY2VcIiBmb3IgYSB7QGxpbmsgTWVzaEluc3RhbmNlfSxcbiAqIHdoaWNoIGRldGVybWluZXMgaXRzIHBsYWNlIGluIHRoZSByZW5kZXIgb3JkZXIuXG4gKlxuICogQGNhbGxiYWNrIENhbGN1bGF0ZVNvcnREaXN0YW5jZUNhbGxiYWNrXG4gKiBAcGFyYW0ge01lc2hJbnN0YW5jZX0gbWVzaEluc3RhbmNlIC0gVGhlIG1lc2ggaW5zdGFuY2UuXG4gKiBAcGFyYW0ge1ZlYzN9IGNhbWVyYVBvc2l0aW9uIC0gVGhlIHBvc2l0aW9uIG9mIHRoZSBjYW1lcmEuXG4gKiBAcGFyYW0ge1ZlYzN9IGNhbWVyYUZvcndhcmQgLSBUaGUgZm9yd2FyZCB2ZWN0b3Igb2YgdGhlIGNhbWVyYS5cbiAqL1xuXG4vKipcbiAqIEFuIGluc3RhbmNlIG9mIGEge0BsaW5rIE1lc2h9LiBBIHNpbmdsZSBtZXNoIGNhbiBiZSByZWZlcmVuY2VkIGJ5IG1hbnkgbWVzaCBpbnN0YW5jZXMgdGhhdCBjYW5cbiAqIGhhdmUgZGlmZmVyZW50IHRyYW5zZm9ybXMgYW5kIG1hdGVyaWFscy5cbiAqL1xuY2xhc3MgTWVzaEluc3RhbmNlIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0ZXJpYWx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWw7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBzaGFkZXJzIHVzZWQgYnkgdGhlIG1lc2ggaW5zdGFuY2UsIGluZGV4ZWQgYnkgdGhlIHNoYWRlciBwYXNzIGNvbnN0YW50IChTSEFERVJfRk9SV0FSRC4uKVxuICAgICAqXG4gICAgICogQHR5cGUge0FycmF5PFNoYWRlcj59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9zaGFkZXIgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGJpbmQgZ3JvdXBzLCBzdG9yaW5nIHVuaWZvcm1zIHBlciBwYXNzLiBUaGlzIGhhcyAxOjEgcmVsYXRpb24gd2l0aCB0aGUgX3NoYWRlcyBhcnJheSxcbiAgICAgKiBhbmQgaXMgaW5kZXhlZCBieSB0aGUgc2hhZGVyIHBhc3MgY29uc3RhbnQgYXMgd2VsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxCaW5kR3JvdXA+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfYmluZEdyb3VwcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1lc2hJbnN0YW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWVzaH0gbWVzaCAtIFRoZSBncmFwaGljcyBtZXNoIHRvIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSBmb3IgdGhpcyBtZXNoIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBbbm9kZV0gLSBUaGUgZ3JhcGggbm9kZSBkZWZpbmluZyB0aGUgdHJhbnNmb3JtIGZvciB0aGlzIGluc3RhbmNlLiBUaGlzXG4gICAgICogcGFyYW1ldGVyIGlzIG9wdGlvbmFsIHdoZW4gdXNlZCB3aXRoIHtAbGluayBSZW5kZXJDb21wb25lbnR9IGFuZCB3aWxsIHVzZSB0aGUgbm9kZSB0aGVcbiAgICAgKiBjb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBtZXNoIGluc3RhbmNlIHBvaW50aW5nIHRvIGEgMXgxeDEgJ2N1YmUnIG1lc2hcbiAgICAgKiB2YXIgbWVzaCA9IHBjLmNyZWF0ZUJveChncmFwaGljc0RldmljZSk7XG4gICAgICogdmFyIG1hdGVyaWFsID0gbmV3IHBjLlN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgKlxuICAgICAqIHZhciBtZXNoSW5zdGFuY2UgPSBuZXcgcGMuTWVzaEluc3RhbmNlKG1lc2gsIG1hdGVyaWFsKTtcbiAgICAgKlxuICAgICAqIHZhciBlbnRpdHkgPSBuZXcgcGMuRW50aXR5KCk7XG4gICAgICogZW50aXR5LmFkZENvbXBvbmVudCgncmVuZGVyJywge1xuICAgICAqICAgICBtZXNoSW5zdGFuY2VzOiBbbWVzaEluc3RhbmNlXVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gQWRkIHRoZSBlbnRpdHkgdG8gdGhlIHNjZW5lIGhpZXJhcmNoeVxuICAgICAqIHRoaXMuYXBwLnNjZW5lLnJvb3QuYWRkQ2hpbGQoZW50aXR5KTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtZXNoLCBtYXRlcmlhbCwgbm9kZSA9IG51bGwpIHtcbiAgICAgICAgLy8gaWYgZmlyc3QgcGFyYW1ldGVyIGlzIG9mIEdyYXBoTm9kZSB0eXBlLCBoYW5kbGUgcHJldmlvdXMgY29uc3RydWN0b3Igc2lnbmF0dXJlOiAobm9kZSwgbWVzaCwgbWF0ZXJpYWwpXG4gICAgICAgIGlmIChtZXNoIGluc3RhbmNlb2YgR3JhcGhOb2RlKSB7XG4gICAgICAgICAgICBjb25zdCB0ZW1wID0gbWVzaDtcbiAgICAgICAgICAgIG1lc2ggPSBtYXRlcmlhbDtcbiAgICAgICAgICAgIG1hdGVyaWFsID0gbm9kZTtcbiAgICAgICAgICAgIG5vZGUgPSB0ZW1wO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fa2V5ID0gWzAsIDBdO1xuXG4gICAgICAgIHRoaXMuaXNTdGF0aWMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fc3RhdGljTGlnaHRMaXN0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3RhdGljU291cmNlID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGdyYXBoIG5vZGUgZGVmaW5pbmcgdGhlIHRyYW5zZm9ybSBmb3IgdGhpcyBpbnN0YW5jZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0dyYXBoTm9kZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubm9kZSA9IG5vZGU7ICAgICAgICAgICAvLyBUaGUgbm9kZSB0aGF0IGRlZmluZXMgdGhlIHRyYW5zZm9ybSBvZiB0aGUgbWVzaCBpbnN0YW5jZVxuICAgICAgICB0aGlzLl9tZXNoID0gbWVzaDsgICAgICAgICAgLy8gVGhlIG1lc2ggdGhhdCB0aGlzIGluc3RhbmNlIHJlbmRlcnNcbiAgICAgICAgbWVzaC5pbmNSZWZDb3VudCgpO1xuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbWF0ZXJpYWw7ICAgLy8gVGhlIG1hdGVyaWFsIHdpdGggd2hpY2ggdG8gcmVuZGVyIHRoaXMgaW5zdGFuY2VcblxuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gTUFTS19BRkZFQ1RfRFlOQU1JQyA8PCAxNjsgLy8gMiBieXRlIHRvZ2dsZXMsIDIgYnl0ZXMgbGlnaHQgbWFzazsgRGVmYXVsdCB2YWx1ZSBpcyBubyB0b2dnbGVzIGFuZCBtYXNrID0gcGMuTUFTS19BRkZFQ1RfRFlOQU1JQ1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzIHw9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNVdjAgPyBTSEFERVJERUZfVVYwIDogMDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzVXYxID8gU0hBREVSREVGX1VWMSA6IDA7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgfD0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc0NvbG9yID8gU0hBREVSREVGX1ZDT0xPUiA6IDA7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgfD0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc1RhbmdlbnRzID8gU0hBREVSREVGX1RBTkdFTlRTIDogMDtcblxuICAgICAgICB0aGlzLl9saWdodEhhc2ggPSAwO1xuXG4gICAgICAgIC8vIFJlbmRlciBvcHRpb25zXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBFbmFibGUgcmVuZGVyaW5nIGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuIFVzZSB2aXNpYmxlIHByb3BlcnR5IHRvIGVuYWJsZS9kaXNhYmxlXG4gICAgICAgICAqIHJlbmRlcmluZyB3aXRob3V0IG92ZXJoZWFkIG9mIHJlbW92aW5nIGZyb20gc2NlbmUuIEJ1dCBub3RlIHRoYXQgdGhlIG1lc2ggaW5zdGFuY2UgaXNcbiAgICAgICAgICogc3RpbGwgaW4gdGhlIGhpZXJhcmNoeSBhbmQgc3RpbGwgaW4gdGhlIGRyYXcgY2FsbCBsaXN0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmlzaWJsZSA9IHRydWU7XG4gICAgICAgIHRoaXMubGF5ZXIgPSBMQVlFUl9XT1JMRDsgLy8gbGVnYWN5XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9yZW5kZXJTdHlsZSA9IFJFTkRFUlNUWUxFX1NPTElEO1xuICAgICAgICB0aGlzLmNhc3RTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fcmVjZWl2ZVNoYWRvdyA9IHRydWU7XG4gICAgICAgIHRoaXMuX3NjcmVlblNwYWNlID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX25vRGVwdGhEcmF3R2wxID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIG1lc2ggaW5zdGFuY2UgY2FuIGJlIGN1bGxlZCBieSBmcnVzdHVtIGN1bGxpbmdcbiAgICAgICAgICogKHtAbGluayBDYW1lcmFDb21wb25lbnQjZnJ1c3R1bUN1bGxpbmd9KS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN1bGwgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBtZXNoIGluc3RhbmNlIGlzIHBpY2thYmxlIGJ5IHRoZSB7QGxpbmsgUGlja2VyfS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucGljayA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlQWFiYiA9IHRydWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmJGdW5jID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU29ydERpc3RhbmNlID0gbnVsbDtcblxuICAgICAgICAvLyA2NC1iaXQgaW50ZWdlciBrZXkgdGhhdCBkZWZpbmVzIHJlbmRlciBvcmRlciBvZiB0aGlzIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1NraW5JbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TW9ycGhJbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gbnVsbDtcblxuICAgICAgICAvLyBXb3JsZCBzcGFjZSBBQUJCXG4gICAgICAgIHRoaXMuYWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICB0aGlzLl9hYWJiVmVyID0gLTE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZSB0aGlzIHZhbHVlIHRvIGFmZmVjdCByZW5kZXJpbmcgb3JkZXIgb2YgbWVzaCBpbnN0YW5jZXMuIE9ubHkgdXNlZCB3aGVuIG1lc2hcbiAgICAgICAgICogaW5zdGFuY2VzIGFyZSBhZGRlZCB0byBhIHtAbGluayBMYXllcn0gd2l0aCB7QGxpbmsgTGF5ZXIjb3BhcXVlU29ydE1vZGV9IG9yXG4gICAgICAgICAqIHtAbGluayBMYXllciN0cmFuc3BhcmVudFNvcnRNb2RlfSAoZGVwZW5kaW5nIG9uIHRoZSBtYXRlcmlhbCkgc2V0IHRvXG4gICAgICAgICAqIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWFkIHRoaXMgdmFsdWUgaW4ge0BsaW5rIExheWVyI29uUG9zdEN1bGx9IHRvIGRldGVybWluZSBpZiB0aGUgb2JqZWN0IGlzIGFjdHVhbGx5IGdvaW5nXG4gICAgICAgICAqIHRvIGJlIHJlbmRlcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmlzaWJsZVRoaXNGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGN1c3RvbSBmdW5jdGlvbiB1c2VkIHRvIGN1c3RvbWl6ZSBjdWxsaW5nIChlLmcuIGZvciAyRCBVSSBlbGVtZW50cylcbiAgICAgICAgdGhpcy5pc1Zpc2libGVGdW5jID0gbnVsbDtcblxuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGcm9udCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3RlbmNpbEJhY2sgPSBudWxsO1xuXG4gICAgICAgIC8vIE5lZ2F0aXZlIHNjYWxlIGJhdGNoaW5nIHN1cHBvcnRcbiAgICAgICAgdGhpcy5mbGlwRmFjZXMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVuZGVyIHN0eWxlIG9mIHRoZSBtZXNoIGluc3RhbmNlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH1cbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9XSVJFRlJBTUV9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfUE9JTlRTfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFJFTkRFUlNUWUxFX1NPTElEfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlbmRlclN0eWxlKHJlbmRlclN0eWxlKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG4gICAgICAgIHRoaXMubWVzaC5wcmVwYXJlUmVuZGVyU3RhdGUocmVuZGVyU3R5bGUpO1xuICAgIH1cblxuICAgIGdldCByZW5kZXJTdHlsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclN0eWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBncmFwaGljcyBtZXNoIGJlaW5nIGluc3RhbmNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNZXNofVxuICAgICAqL1xuICAgIHNldCBtZXNoKG1lc2gpIHtcblxuICAgICAgICBpZiAobWVzaCA9PT0gdGhpcy5fbWVzaClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaCkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaC5kZWNSZWZDb3VudCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWVzaCA9IG1lc2g7XG5cbiAgICAgICAgaWYgKG1lc2gpIHtcbiAgICAgICAgICAgIG1lc2guaW5jUmVmQ291bnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtZXNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWVzaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd29ybGQgc3BhY2UgYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveCBmb3IgdGhpcyBtZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0JvdW5kaW5nQm94fVxuICAgICAqL1xuICAgIHNldCBhYWJiKGFhYmIpIHtcbiAgICAgICAgdGhpcy5fYWFiYiA9IGFhYmI7XG4gICAgfVxuXG4gICAgZ2V0IGFhYmIoKSB7XG4gICAgICAgIC8vIHVzZSBzcGVjaWZpZWQgd29ybGQgc3BhY2UgYWFiYlxuICAgICAgICBpZiAoIXRoaXMuX3VwZGF0ZUFhYmIpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9hYWJiO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsbGJhY2sgZnVuY3Rpb24gcmV0dXJuaW5nIHdvcmxkIHNwYWNlIGFhYmJcbiAgICAgICAgaWYgKHRoaXMuX3VwZGF0ZUFhYmJGdW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlQWFiYkZ1bmModGhpcy5fYWFiYik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1c2UgbG9jYWwgc3BhY2Ugb3ZlcnJpZGUgYWFiYiBpZiBzcGVjaWZpZWRcbiAgICAgICAgbGV0IGxvY2FsQWFiYiA9IHRoaXMuX2N1c3RvbUFhYmI7XG4gICAgICAgIGxldCB0b1dvcmxkU3BhY2UgPSAhIWxvY2FsQWFiYjtcblxuICAgICAgICAvLyBvdGhlcndpc2UgZXZhbHVhdGUgbG9jYWwgYWFiYlxuICAgICAgICBpZiAoIWxvY2FsQWFiYikge1xuXG4gICAgICAgICAgICBsb2NhbEFhYmIgPSBfdG1wQWFiYjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc2tpbkluc3RhbmNlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBJbml0aWFsaXplIGxvY2FsIGJvbmUgQUFCQnMgaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm1lc2guYm9uZUFhYmIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRzID0gdGhpcy5fbW9ycGhJbnN0YW5jZSA/IHRoaXMuX21vcnBoSW5zdGFuY2UubW9ycGguX3RhcmdldHMgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1lc2guX2luaXRCb25lQWFiYnMobW9ycGhUYXJnZXRzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBldmFsdWF0ZSBsb2NhbCBzcGFjZSBib3VuZHMgYmFzZWQgb24gYWxsIGFjdGl2ZSBib25lc1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVVc2VkID0gdGhpcy5tZXNoLmJvbmVVc2VkO1xuICAgICAgICAgICAgICAgIGxldCBmaXJzdCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWVzaC5ib25lQWFiYi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYm9uZVVzZWRbaV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIGJvbmUgQUFCQiBieSBib25lIG1hdHJpeFxuICAgICAgICAgICAgICAgICAgICAgICAgX3RlbXBCb25lQWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKHRoaXMubWVzaC5ib25lQWFiYltpXSwgdGhpcy5za2luSW5zdGFuY2UubWF0cmljZXNbaV0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdGhlbSB1cFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpcnN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuY2VudGVyLmNvcHkoX3RlbXBCb25lQWFiYi5jZW50ZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5jb3B5KF90ZW1wQm9uZUFhYmIuaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuYWRkKF90ZW1wQm9uZUFhYmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdG9Xb3JsZFNwYWNlID0gdHJ1ZTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm5vZGUuX2FhYmJWZXIgIT09IHRoaXMuX2FhYmJWZXIpIHtcblxuICAgICAgICAgICAgICAgIC8vIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCAtIGVpdGhlciBmcm9tIG1lc2ggb3IgZW1wdHlcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5jZW50ZXIuY29weSh0aGlzLm1lc2guYWFiYi5jZW50ZXIpO1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuaGFsZkV4dGVudHMuY29weSh0aGlzLm1lc2guYWFiYi5oYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmNlbnRlci5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCBieSBtb3JwaCB0YXJnZXRzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubWVzaCAmJiB0aGlzLm1lc2gubW9ycGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLl9leHBhbmQodGhpcy5tZXNoLm1vcnBoLmFhYmIuZ2V0TWluKCksIHRoaXMubWVzaC5tb3JwaC5hYWJiLmdldE1heCgpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0b1dvcmxkU3BhY2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FhYmJWZXIgPSB0aGlzLm5vZGUuX2FhYmJWZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdG9yZSB3b3JsZCBzcGFjZSBib3VuZGluZyBib3hcbiAgICAgICAgaWYgKHRvV29ybGRTcGFjZSkge1xuICAgICAgICAgICAgdGhpcy5fYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGxvY2FsQWFiYiwgdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FhYmI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgdGhlIGludGVybmFsIHNoYWRlciBhcnJheS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjbGVhclNoYWRlcnMoKSB7XG4gICAgICAgIGNvbnN0IHNoYWRlcnMgPSB0aGlzLl9zaGFkZXI7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2hhZGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc2hhZGVyc1tpXSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRlc3Ryb3lCaW5kR3JvdXBzKCk7XG4gICAgfVxuXG4gICAgZGVzdHJveUJpbmRHcm91cHMoKSB7XG5cbiAgICAgICAgY29uc3QgZ3JvdXBzID0gdGhpcy5fYmluZEdyb3VwcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBncm91cHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gZ3JvdXBzW2ldO1xuICAgICAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5pZm9ybUJ1ZmZlciA9IGdyb3VwLmRlZmF1bHRVbmlmb3JtQnVmZmVyO1xuICAgICAgICAgICAgICAgIGlmICh1bmlmb3JtQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVuaWZvcm1CdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBncm91cC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcGFzcyAtIFNoYWRlciBwYXNzIG51bWJlci5cbiAgICAgKiBAcmV0dXJucyB7QmluZEdyb3VwfSAtIFRoZSBtZXNoIGJpbmQgZ3JvdXAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEJpbmRHcm91cChkZXZpY2UsIHBhc3MpIHtcblxuICAgICAgICAvLyBjcmVhdGUgYmluZCBncm91cFxuICAgICAgICBsZXQgYmluZEdyb3VwID0gdGhpcy5fYmluZEdyb3Vwc1twYXNzXTtcbiAgICAgICAgaWYgKCFiaW5kR3JvdXApIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuX3NoYWRlcltwYXNzXTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChzaGFkZXIpO1xuXG4gICAgICAgICAgICAvLyBtZXNoIHVuaWZvcm0gYnVmZmVyXG4gICAgICAgICAgICBjb25zdCB1YkZvcm1hdCA9IHNoYWRlci5tZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydCh1YkZvcm1hdCk7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtQnVmZmVyID0gbmV3IFVuaWZvcm1CdWZmZXIoZGV2aWNlLCB1YkZvcm1hdCk7XG5cbiAgICAgICAgICAgIC8vIG1lc2ggYmluZCBncm91cFxuICAgICAgICAgICAgY29uc3QgYmluZ0dyb3VwRm9ybWF0ID0gc2hhZGVyLm1lc2hCaW5kR3JvdXBGb3JtYXQ7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoYmluZ0dyb3VwRm9ybWF0KTtcbiAgICAgICAgICAgIGJpbmRHcm91cCA9IG5ldyBCaW5kR3JvdXAoZGV2aWNlLCBiaW5nR3JvdXBGb3JtYXQsIHVuaWZvcm1CdWZmZXIpO1xuXG4gICAgICAgICAgICB0aGlzLl9iaW5kR3JvdXBzW3Bhc3NdID0gYmluZEdyb3VwO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJpbmRHcm91cDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF0ZXJpYWwgdXNlZCBieSB0aGlzIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWF0ZXJpYWx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsKG1hdGVyaWFsKSB7XG5cbiAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcblxuICAgICAgICBjb25zdCBwcmV2TWF0ID0gdGhpcy5fbWF0ZXJpYWw7XG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBtYXRlcmlhbCdzIHJlZmVyZW5jZSB0byB0aGlzIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgaWYgKHByZXZNYXQpIHtcbiAgICAgICAgICAgIHByZXZNYXQucmVtb3ZlTWVzaEluc3RhbmNlUmVmKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBtYXRlcmlhbDtcblxuICAgICAgICBpZiAobWF0ZXJpYWwpIHtcblxuICAgICAgICAgICAgLy8gUmVjb3JkIHRoYXQgdGhlIG1hdGVyaWFsIGlzIHJlZmVyZW5jZWQgYnkgdGhpcyBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICBtYXRlcmlhbC5hZGRNZXNoSW5zdGFuY2VSZWYodGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgICAgIC8vIGlmIGJsZW5kIHR5cGUgb2YgdGhlIG1hdGVyaWFsIGNoYW5nZXNcbiAgICAgICAgICAgIGNvbnN0IHByZXZCbGVuZCA9IHByZXZNYXQgJiYgcHJldk1hdC50cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC50cmFuc3BhcmVudCAhPT0gcHJldkJsZW5kKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLl9tYXRlcmlhbC5fc2NlbmUgfHwgcHJldk1hdD8uX3NjZW5lO1xuICAgICAgICAgICAgICAgIGlmIChzY2VuZSkge1xuICAgICAgICAgICAgICAgICAgICBzY2VuZS5sYXllcnMuX2RpcnR5QmxlbmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICBzZXQgbGF5ZXIobGF5ZXIpIHtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbiBzb21lIGNpcmN1bXN0YW5jZXMgbWVzaCBpbnN0YW5jZXMgYXJlIHNvcnRlZCBieSBhIGRpc3RhbmNlIGNhbGN1bGF0aW9uIHRvIGRldGVybWluZSB0aGVpclxuICAgICAqIHJlbmRlcmluZyBvcmRlci4gU2V0IHRoaXMgY2FsbGJhY2sgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHQgZGlzdGFuY2UgY2FsY3VsYXRpb24sIHdoaWNoIGdpdmVzXG4gICAgICogdGhlIGRvdCBwcm9kdWN0IG9mIHRoZSBjYW1lcmEgZm9yd2FyZCB2ZWN0b3IgYW5kIHRoZSB2ZWN0b3IgYmV0d2VlbiB0aGUgY2FtZXJhIHBvc2l0aW9uIGFuZFxuICAgICAqIHRoZSBjZW50ZXIgb2YgdGhlIG1lc2ggaW5zdGFuY2UncyBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94LiBUaGlzIG9wdGlvbiBjYW4gYmUgcGFydGljdWxhcmx5XG4gICAgICogdXNlZnVsIGZvciByZW5kZXJpbmcgdHJhbnNwYXJlbnQgbWVzaGVzIGluIGEgYmV0dGVyIG9yZGVyIHRoYW4gZGVmYXVsdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDYWxjdWxhdGVTb3J0RGlzdGFuY2VDYWxsYmFja31cbiAgICAgKi9cbiAgICBzZXQgY2FsY3VsYXRlU29ydERpc3RhbmNlKGNhbGN1bGF0ZVNvcnREaXN0YW5jZSkge1xuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTb3J0RGlzdGFuY2UgPSBjYWxjdWxhdGVTb3J0RGlzdGFuY2U7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZVNvcnREaXN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZTtcbiAgICB9XG5cbiAgICBzZXQgcmVjZWl2ZVNoYWRvdyh2YWwpIHtcbiAgICAgICAgdGhpcy5fcmVjZWl2ZVNoYWRvdyA9IHZhbDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IHZhbCA/ICh0aGlzLl9zaGFkZXJEZWZzICYgflNIQURFUkRFRl9OT1NIQURPVykgOiAodGhpcy5fc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9OT1NIQURPVyk7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSRF0gPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRIRFJdID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgcmVjZWl2ZVNoYWRvdygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlY2VpdmVTaGFkb3c7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHNraW4gaW5zdGFuY2UgbWFuYWdpbmcgc2tpbm5pbmcgb2YgdGhpcyBtZXNoIGluc3RhbmNlLCBvciBudWxsIGlmIHNraW5uaW5nIGlzIG5vdCB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge1NraW5JbnN0YW5jZX1cbiAgICAgKi9cbiAgICBzZXQgc2tpbkluc3RhbmNlKHZhbCkge1xuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2UgPSB2YWw7XG5cbiAgICAgICAgbGV0IHNoYWRlckRlZnMgPSB0aGlzLl9zaGFkZXJEZWZzO1xuICAgICAgICBzaGFkZXJEZWZzID0gdmFsID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfU0tJTikgOiAoc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfU0tJTik7XG5cbiAgICAgICAgLy8gaWYgc2hhZGVyRGVmcyBoYXZlIGNoYW5nZWRcbiAgICAgICAgaWYgKHNoYWRlckRlZnMgIT09IHRoaXMuX3NoYWRlckRlZnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBzaGFkZXJEZWZzO1xuICAgICAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9zZXR1cFNraW5VcGRhdGUoKTtcbiAgICB9XG5cbiAgICBnZXQgc2tpbkluc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2tpbkluc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtb3JwaCBpbnN0YW5jZSBtYW5hZ2luZyBtb3JwaGluZyBvZiB0aGlzIG1lc2ggaW5zdGFuY2UsIG9yIG51bGwgaWYgbW9ycGhpbmcgaXMgbm90IHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TW9ycGhJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBzZXQgbW9ycGhJbnN0YW5jZSh2YWwpIHtcblxuICAgICAgICAvLyByZWxlYXNlIGV4aXN0aW5nXG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2U/LmRlc3Ryb3koKTtcblxuICAgICAgICAvLyBhc3NpZ24gbmV3XG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2UgPSB2YWw7XG5cbiAgICAgICAgbGV0IHNoYWRlckRlZnMgPSB0aGlzLl9zaGFkZXJEZWZzO1xuICAgICAgICBzaGFkZXJEZWZzID0gKHZhbCAmJiB2YWwubW9ycGgudXNlVGV4dHVyZU1vcnBoKSA/IChzaGFkZXJEZWZzIHwgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQpIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQpO1xuICAgICAgICBzaGFkZXJEZWZzID0gKHZhbCAmJiB2YWwubW9ycGgubW9ycGhQb3NpdGlvbnMpID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfTU9SUEhfUE9TSVRJT04pIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX1BPU0lUSU9OKTtcbiAgICAgICAgc2hhZGVyRGVmcyA9ICh2YWwgJiYgdmFsLm1vcnBoLm1vcnBoTm9ybWFscykgPyAoc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9NT1JQSF9OT1JNQUwpIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX05PUk1BTCk7XG5cbiAgICAgICAgLy8gaWYgc2hhZGVyRGVmcyBoYXZlIGNoYW5nZWRcbiAgICAgICAgaWYgKHNoYWRlckRlZnMgIT09IHRoaXMuX3NoYWRlckRlZnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBzaGFkZXJEZWZzO1xuICAgICAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtb3JwaEluc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9ycGhJbnN0YW5jZTtcbiAgICB9XG5cbiAgICBzZXQgc2NyZWVuU3BhY2UodmFsKSB7XG4gICAgICAgIHRoaXMuX3NjcmVlblNwYWNlID0gdmFsO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gdmFsID8gKHRoaXMuX3NoYWRlckRlZnMgfCBTSEFERVJERUZfU0NSRUVOU1BBQ0UpIDogKHRoaXMuX3NoYWRlckRlZnMgJiB+U0hBREVSREVGX1NDUkVFTlNQQUNFKTtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJEXSA9IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0IHNjcmVlblNwYWNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2NyZWVuU3BhY2U7XG4gICAgfVxuXG4gICAgc2V0IGtleSh2YWwpIHtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSB2YWw7XG4gICAgfVxuXG4gICAgZ2V0IGtleSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hc2sgY29udHJvbGxpbmcgd2hpY2gge0BsaW5rIExpZ2h0Q29tcG9uZW50fXMgbGlnaHQgdGhpcyBtZXNoIGluc3RhbmNlLCB3aGljaFxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnR9IHNlZXMgaXQgYW5kIGluIHdoaWNoIHtAbGluayBMYXllcn0gaXQgaXMgcmVuZGVyZWQuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNrKHZhbCkge1xuICAgICAgICBjb25zdCB0b2dnbGVzID0gdGhpcy5fc2hhZGVyRGVmcyAmIDB4MDAwMEZGRkY7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSB0b2dnbGVzIHwgKHZhbCA8PCAxNik7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSRF0gPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRIRFJdID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRlckRlZnMgPj4gMTY7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTnVtYmVyIG9mIGluc3RhbmNlcyB3aGVuIHVzaW5nIGhhcmR3YXJlIGluc3RhbmNpbmcgdG8gcmVuZGVyIHRoZSBtZXNoLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaW5zdGFuY2luZ0NvdW50KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmluc3RhbmNpbmdEYXRhKVxuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YS5jb3VudCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBpbnN0YW5jaW5nQ291bnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNpbmdEYXRhID8gdGhpcy5pbnN0YW5jaW5nRGF0YS5jb3VudCA6IDA7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICBjb25zdCBtZXNoID0gdGhpcy5tZXNoO1xuICAgICAgICBpZiAobWVzaCkge1xuXG4gICAgICAgICAgICAvLyB0aGlzIGRlY3JlYXNlcyByZWYgY291bnQgb24gdGhlIG1lc2hcbiAgICAgICAgICAgIHRoaXMubWVzaCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgbWVzaFxuICAgICAgICAgICAgaWYgKG1lc2gucmVmQ291bnQgPCAxKSB7XG4gICAgICAgICAgICAgICAgbWVzaC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWxlYXNlIHJlZiBjb3VudGVkIGxpZ2h0bWFwc1xuICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbnVsbCk7XG4gICAgICAgIHRoaXMuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzFdLCBudWxsKTtcblxuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2U/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLm1vcnBoSW5zdGFuY2U/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5tb3JwaEluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNsZWFyU2hhZGVycygpO1xuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSBtYXRlcmlhbCBjbGVhcnMgcmVmZXJlbmNlcyB0byB0aGlzIG1lc2hJbnN0YW5jZVxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBzaGFkZXIgdW5pZm9ybSBuYW1lcyBmb3IgbGlnaHRtYXBzXG4gICAgc3RhdGljIGxpZ2h0bWFwUGFyYW1OYW1lcyA9IFsndGV4dHVyZV9saWdodE1hcCcsICd0ZXh0dXJlX2RpckxpZ2h0TWFwJ107XG5cbiAgICAvLyBnZW5lcmF0ZXMgd2lyZWZyYW1lcyBmb3IgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXNcbiAgICBzdGF0aWMgX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5KG1lc2hJbnN0YW5jZXMsIHJlbmRlclN0eWxlKSB7XG5cbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gc3dpdGNoIG1lc2ggaW5zdGFuY2UgdG8gdGhlIHJlcXVlc3RlZCBzdHlsZVxuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG5cbiAgICAgICAgICAgICAgICAvLyBwcm9jZXNzIGFsbCB1bmlxdWUgbWVzaGVzXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZXNbaV0ubWVzaDtcbiAgICAgICAgICAgICAgICBpZiAoIV9tZXNoU2V0LmhhcyhtZXNoKSkge1xuICAgICAgICAgICAgICAgICAgICBfbWVzaFNldC5hZGQobWVzaCk7XG4gICAgICAgICAgICAgICAgICAgIG1lc2gucHJlcGFyZVJlbmRlclN0YXRlKHJlbmRlclN0eWxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9tZXNoU2V0LmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB0ZXN0IGlmIG1lc2hJbnN0YW5jZSBpcyB2aXNpYmxlIGJ5IGNhbWVyYS4gSXQgcmVxdWlyZXMgdGhlIGZydXN0dW0gb2YgdGhlIGNhbWVyYSB0byBiZSB1cCB0byBkYXRlLCB3aGljaCBmb3J3YXJkLXJlbmRlcmVyXG4gICAgLy8gdGFrZXMgY2FyZSBvZi4gVGhpcyBmdW5jdGlvbiBzaG91bGQgIG5vdCBiZSBjYWxsZWQgZWxzZXdoZXJlLlxuICAgIF9pc1Zpc2libGUoY2FtZXJhKSB7XG5cbiAgICAgICAgaWYgKHRoaXMudmlzaWJsZSkge1xuXG4gICAgICAgICAgICAvLyBjdXN0b20gdmlzaWJpbGl0eSBtZXRob2Qgb2YgTWVzaEluc3RhbmNlXG4gICAgICAgICAgICBpZiAodGhpcy5pc1Zpc2libGVGdW5jKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNWaXNpYmxlRnVuYyhjYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfdGVtcFNwaGVyZS5jZW50ZXIgPSB0aGlzLmFhYmIuY2VudGVyOyAgLy8gdGhpcyBsaW5lIGV2YWx1YXRlcyBhYWJiXG4gICAgICAgICAgICBfdGVtcFNwaGVyZS5yYWRpdXMgPSB0aGlzLl9hYWJiLmhhbGZFeHRlbnRzLmxlbmd0aCgpO1xuXG4gICAgICAgICAgICByZXR1cm4gY2FtZXJhLmZydXN0dW0uY29udGFpbnNTcGhlcmUoX3RlbXBTcGhlcmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHVwZGF0ZUtleSgpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSB0aGlzLm1hdGVyaWFsO1xuICAgICAgICB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXSA9IGdldEtleSh0aGlzLmxheWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobWF0ZXJpYWwuYWxwaGFUb0NvdmVyYWdlIHx8IG1hdGVyaWFsLmFscGhhVGVzdCkgPyBCTEVORF9OT1JNQUwgOiBtYXRlcmlhbC5ibGVuZFR5cGUsIC8vIHJlbmRlciBhbHBoYXRlc3QvYXRvYyBhZnRlciBvcGFxdWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UsIG1hdGVyaWFsLmlkKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHVwIHtAbGluayBNZXNoSW5zdGFuY2V9IHRvIGJlIHJlbmRlcmVkIHVzaW5nIEhhcmR3YXJlIEluc3RhbmNpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlcnRleEJ1ZmZlcnxudWxsfSB2ZXJ0ZXhCdWZmZXIgLSBWZXJ0ZXggYnVmZmVyIHRvIGhvbGQgcGVyLWluc3RhbmNlIHZlcnRleCBkYXRhXG4gICAgICogKHVzdWFsbHkgd29ybGQgbWF0cmljZXMpLiBQYXNzIG51bGwgdG8gdHVybiBvZmYgaGFyZHdhcmUgaW5zdGFuY2luZy5cbiAgICAgKi9cbiAgICBzZXRJbnN0YW5jaW5nKHZlcnRleEJ1ZmZlcikge1xuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhID0gbmV3IEluc3RhbmNpbmdEYXRhKHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcyk7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcblxuICAgICAgICAgICAgLy8gbWFyayB2ZXJ0ZXggYnVmZmVyIGFzIGluc3RhbmNpbmcgZGF0YVxuICAgICAgICAgICAgdmVydGV4QnVmZmVyLmluc3RhbmNpbmcgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyB0dXJuIG9mZiBjdWxsaW5nIC0gd2UgZG8gbm90IGRvIHBlci1pbnN0YW5jZSBjdWxsaW5nLCBhbGwgaW5zdGFuY2VzIGFyZSBzdWJtaXR0ZWQgdG8gR1BVXG4gICAgICAgICAgICB0aGlzLmN1bGwgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5jdWxsID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE9idGFpbiBhIHNoYWRlciB2YXJpYW50IHJlcXVpcmVkIHRvIHJlbmRlciB0aGUgbWVzaCBpbnN0YW5jZSB3aXRoaW4gc3BlY2lmaWVkIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcGFzcyAtIFRoZSByZW5kZXIgcGFzcy5cbiAgICAgKiBAcGFyYW0ge2FueX0gc3RhdGljTGlnaHRMaXN0IC0gTGlzdCBvZiBzdGF0aWMgbGlnaHRzLlxuICAgICAqIEBwYXJhbSB7YW55fSBzb3J0ZWRMaWdodHMgLSBBcnJheSBvZiBhcnJheXMgb2YgbGlnaHRzLlxuICAgICAqIEBwYXJhbSB7VW5pZm9ybUJ1ZmZlckZvcm1hdH0gdmlld1VuaWZvcm1Gb3JtYXQgLSBUSGUgZm9ybWF0IG9mIHRoZSB2aWV3IHVuaWZvcm0gYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7QmluZEdyb3VwRm9ybWF0fSB2aWV3QmluZEdyb3VwRm9ybWF0IC0gVGhlIGZvcm1hdCBvZiB0aGUgdmlldyBiaW5kIGdyb3VwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBzdGF0aWNMaWdodExpc3QsIHNvcnRlZExpZ2h0cywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpIHtcbiAgICAgICAgdGhpcy5fc2hhZGVyW3Bhc3NdID0gdGhpcy5tYXRlcmlhbC5nZXRTaGFkZXJWYXJpYW50KHRoaXMubWVzaC5kZXZpY2UsIHNjZW5lLCB0aGlzLl9zaGFkZXJEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0KTtcbiAgICB9XG5cbiAgICBlbnN1cmVNYXRlcmlhbChkZXZpY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1hdGVyaWFsKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBNZXNoIGF0dGFjaGVkIHRvIGVudGl0eSAnJHt0aGlzLm5vZGUubmFtZX0nIGRvZXMgbm90IGhhdmUgYSBtYXRlcmlhbCwgdXNpbmcgYSBkZWZhdWx0IG9uZS5gKTtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwgPSBnZXREZWZhdWx0TWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFBhcmFtZXRlciBtYW5hZ2VtZW50XG4gICAgY2xlYXJQYXJhbWV0ZXJzKCkge1xuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcbiAgICB9XG5cbiAgICBnZXRQYXJhbWV0ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgc3BlY2lmaWVkIHNoYWRlciBwYXJhbWV0ZXIgZnJvbSBhIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gcXVlcnkuXG4gICAgICogQHJldHVybnMge29iamVjdH0gVGhlIG5hbWVkIHBhcmFtZXRlci5cbiAgICAgKi9cbiAgICBnZXRQYXJhbWV0ZXIobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYSBzaGFkZXIgcGFyYW1ldGVyIG9uIGEgbWVzaCBpbnN0YW5jZS4gTm90ZSB0aGF0IHRoaXMgcGFyYW1ldGVyIHdpbGwgdGFrZSBwcmVjZWRlbmNlXG4gICAgICogb3ZlciBwYXJhbWV0ZXIgb2YgdGhlIHNhbWUgbmFtZSBpZiBzZXQgb24gTWF0ZXJpYWwgdGhpcyBtZXNoIGluc3RhbmNlIHVzZXMgZm9yIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW118VGV4dHVyZX0gZGF0YSAtIFRoZSB2YWx1ZSBmb3IgdGhlIHNwZWNpZmllZCBwYXJhbWV0ZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwYXNzRmxhZ3NdIC0gTWFzayBkZXNjcmliaW5nIHdoaWNoIHBhc3NlcyB0aGUgbWF0ZXJpYWwgc2hvdWxkIGJlIGluY2x1ZGVkXG4gICAgICogaW4uXG4gICAgICovXG4gICAgc2V0UGFyYW1ldGVyKG5hbWUsIGRhdGEsIHBhc3NGbGFncyA9IC0yNjIxNDEpIHtcblxuICAgICAgICAvLyBub3RlIG9uIC0yNjIxNDE6IEFsbCBiaXRzIHNldCBleGNlcHQgMiAtIDE5IHJhbmdlXG5cbiAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHVuaWZvcm1PYmplY3QgPSBuYW1lO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1PYmplY3QubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB1bmlmb3JtT2JqZWN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyKHVuaWZvcm1PYmplY3RbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuYW1lID0gdW5pZm9ybU9iamVjdC5uYW1lO1xuICAgICAgICAgICAgZGF0YSA9IHVuaWZvcm1PYmplY3QudmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYXJhbSA9IHRoaXMucGFyYW1ldGVyc1tuYW1lXTtcbiAgICAgICAgaWYgKHBhcmFtKSB7XG4gICAgICAgICAgICBwYXJhbS5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgIHBhcmFtLnBhc3NGbGFncyA9IHBhc3NGbGFncztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucGFyYW1ldGVyc1tuYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBzY29wZUlkOiBudWxsLFxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGEsXG4gICAgICAgICAgICAgICAgcGFzc0ZsYWdzOiBwYXNzRmxhZ3NcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhIHdyYXBwZXIgb3ZlciBzZXR0aW5ncyBwYXJhbWV0ZXIgc3BlY2lmaWNhbGx5IGZvciByZWFsdGltZSBiYWtlZCBsaWdodG1hcHMuIFRoaXMgaGFuZGxlcyByZWZlcmVuY2UgY291bnRpbmcgb2YgbGlnaHRtYXBzXG4gICAgLy8gYW5kIHJlbGVhc2VzIHRoZW0gd2hlbiBubyBsb25nZXIgcmVmZXJlbmNlZFxuICAgIHNldFJlYWx0aW1lTGlnaHRtYXAobmFtZSwgdGV4dHVyZSkge1xuXG4gICAgICAgIC8vIG5vIGNoYW5nZVxuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLmdldFBhcmFtZXRlcihuYW1lKTtcbiAgICAgICAgaWYgKG9sZCA9PT0gdGV4dHVyZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyByZW1vdmUgb2xkXG4gICAgICAgIGlmIChvbGQpIHtcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVjUmVmKG9sZC5kYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzc2lnbiBuZXdcbiAgICAgICAgaWYgKHRleHR1cmUpIHtcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuaW5jUmVmKHRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXIobmFtZSwgdGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlbGV0ZVBhcmFtZXRlcihuYW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICAvKipcbiAgICAgICogRGVsZXRlcyBhIHNoYWRlciBwYXJhbWV0ZXIgb24gYSBtZXNoIGluc3RhbmNlLlxuICAgICAgKlxuICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gZGVsZXRlLlxuICAgICAgKi9cbiAgICBkZWxldGVQYXJhbWV0ZXIobmFtZSkge1xuICAgICAgICBpZiAodGhpcy5wYXJhbWV0ZXJzW25hbWVdKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gdXNlZCB0byBhcHBseSBwYXJhbWV0ZXJzIGZyb20gdGhpcyBtZXNoIGluc3RhbmNlIGludG8gc2NvcGUgb2YgdW5pZm9ybXMsIGNhbGxlZCBpbnRlcm5hbGx5IGJ5IGZvcndhcmQtcmVuZGVyZXJcbiAgICBzZXRQYXJhbWV0ZXJzKGRldmljZSwgcGFzc0ZsYWcpIHtcbiAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHRoaXMucGFyYW1ldGVycztcbiAgICAgICAgZm9yIChjb25zdCBwYXJhbU5hbWUgaW4gcGFyYW1ldGVycykge1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gcGFyYW1ldGVyc1twYXJhbU5hbWVdO1xuICAgICAgICAgICAgaWYgKHBhcmFtZXRlci5wYXNzRmxhZ3MgJiBwYXNzRmxhZykge1xuICAgICAgICAgICAgICAgIGlmICghcGFyYW1ldGVyLnNjb3BlSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyLnNjb3BlSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShwYXJhbU5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJhbWV0ZXIuc2NvcGVJZC5zZXRWYWx1ZShwYXJhbWV0ZXIuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRMaWdodG1hcHBlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMubWFzayA9ICh0aGlzLm1hc2sgfCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCkgJiB+KE1BU0tfQUZGRUNUX0RZTkFNSUMgfCBNQVNLX0JBS0UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMF0sIG51bGwpO1xuICAgICAgICAgICAgdGhpcy5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMV0sIG51bGwpO1xuICAgICAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyAmPSB+KFNIQURFUkRFRl9MTSB8IFNIQURFUkRFRl9ESVJMTSB8IFNIQURFUkRFRl9MTUFNQklFTlQpO1xuICAgICAgICAgICAgdGhpcy5tYXNrID0gKHRoaXMubWFzayB8IE1BU0tfQUZGRUNUX0RZTkFNSUMpICYgfihNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCB8IE1BU0tfQkFLRSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDdXN0b21BYWJiKGFhYmIpIHtcblxuICAgICAgICBpZiAoYWFiYikge1xuICAgICAgICAgICAgLy8gc3RvcmUgdGhlIG92ZXJyaWRlIGFhYmJcbiAgICAgICAgICAgIGlmICh0aGlzLl9jdXN0b21BYWJiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY3VzdG9tQWFiYi5jb3B5KGFhYmIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gYWFiYi5jbG9uZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gb3ZlcnJpZGUsIGZvcmNlIHJlZnJlc2ggdGhlIGFjdHVhbCBvbmVcbiAgICAgICAgICAgIHRoaXMuX2N1c3RvbUFhYmIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fYWFiYlZlciA9IC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2V0dXBTa2luVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgX3NldHVwU2tpblVwZGF0ZSgpIHtcblxuICAgICAgICAvLyBzZXQgaWYgYm9uZXMgbmVlZCB0byBiZSB1cGRhdGVkIGJlZm9yZSBjdWxsaW5nXG4gICAgICAgIGlmICh0aGlzLl9za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZS5fdXBkYXRlQmVmb3JlQ3VsbCA9ICF0aGlzLl9jdXN0b21BYWJiO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRLZXkobGF5ZXIsIGJsZW5kVHlwZSwgaXNDb21tYW5kLCBtYXRlcmlhbElkKSB7XG4gICAgLy8gS2V5IGRlZmluaXRpb246XG4gICAgLy8gQml0XG4gICAgLy8gMzEgICAgICA6IHNpZ24gYml0IChsZWF2ZSlcbiAgICAvLyAyNyAtIDMwIDogbGF5ZXJcbiAgICAvLyAyNiAgICAgIDogdHJhbnNsdWNlbmN5IHR5cGUgKG9wYXF1ZS90cmFuc3BhcmVudClcbiAgICAvLyAyNSAgICAgIDogQ29tbWFuZCBiaXQgKDE6IHRoaXMga2V5IGlzIGZvciBhIGNvbW1hbmQsIDA6IGl0J3MgYSBtZXNoIGluc3RhbmNlKVxuICAgIC8vIDAgLSAyNCAgOiBNYXRlcmlhbCBJRCAoaWYgb3BhcXVlKSBvciAwIChpZiB0cmFuc3BhcmVudCAtIHdpbGwgYmUgZGVwdGgpXG4gICAgcmV0dXJuICgobGF5ZXIgJiAweDBmKSA8PCAyNykgfFxuICAgICAgICAgICAoKGJsZW5kVHlwZSA9PT0gQkxFTkRfTk9ORSA/IDEgOiAwKSA8PCAyNikgfFxuICAgICAgICAgICAoKGlzQ29tbWFuZCA/IDEgOiAwKSA8PCAyNSkgfFxuICAgICAgICAgICAoKG1hdGVyaWFsSWQgJiAweDFmZmZmZmYpIDw8IDApO1xufVxuXG5leHBvcnQgeyBDb21tYW5kLCBNZXNoSW5zdGFuY2UgfTtcbiJdLCJuYW1lcyI6WyJfdG1wQWFiYiIsIkJvdW5kaW5nQm94IiwiX3RlbXBCb25lQWFiYiIsIl90ZW1wU3BoZXJlIiwiQm91bmRpbmdTcGhlcmUiLCJfbWVzaFNldCIsIlNldCIsIkluc3RhbmNpbmdEYXRhIiwiY29uc3RydWN0b3IiLCJudW1PYmplY3RzIiwidmVydGV4QnVmZmVyIiwiY291bnQiLCJDb21tYW5kIiwibGF5ZXIiLCJibGVuZFR5cGUiLCJjb21tYW5kIiwiX2tleSIsIlNPUlRLRVlfRk9SV0FSRCIsImdldEtleSIsImtleSIsInZhbCIsIk1lc2hJbnN0YW5jZSIsIm1lc2giLCJtYXRlcmlhbCIsIm5vZGUiLCJfbWF0ZXJpYWwiLCJfc2hhZGVyIiwiX2JpbmRHcm91cHMiLCJHcmFwaE5vZGUiLCJ0ZW1wIiwiaXNTdGF0aWMiLCJfc3RhdGljTGlnaHRMaXN0IiwiX3N0YXRpY1NvdXJjZSIsIl9tZXNoIiwiaW5jUmVmQ291bnQiLCJfc2hhZGVyRGVmcyIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJmb3JtYXQiLCJoYXNVdjAiLCJTSEFERVJERUZfVVYwIiwiaGFzVXYxIiwiU0hBREVSREVGX1VWMSIsImhhc0NvbG9yIiwiU0hBREVSREVGX1ZDT0xPUiIsImhhc1RhbmdlbnRzIiwiU0hBREVSREVGX1RBTkdFTlRTIiwiX2xpZ2h0SGFzaCIsInZpc2libGUiLCJMQVlFUl9XT1JMRCIsIl9yZW5kZXJTdHlsZSIsIlJFTkRFUlNUWUxFX1NPTElEIiwiY2FzdFNoYWRvdyIsIl9yZWNlaXZlU2hhZG93IiwiX3NjcmVlblNwYWNlIiwiX25vRGVwdGhEcmF3R2wxIiwiY3VsbCIsInBpY2siLCJfdXBkYXRlQWFiYiIsIl91cGRhdGVBYWJiRnVuYyIsIl9jYWxjdWxhdGVTb3J0RGlzdGFuY2UiLCJ1cGRhdGVLZXkiLCJfc2tpbkluc3RhbmNlIiwiX21vcnBoSW5zdGFuY2UiLCJpbnN0YW5jaW5nRGF0YSIsIl9jdXN0b21BYWJiIiwiYWFiYiIsIl9hYWJiVmVyIiwiZHJhd09yZGVyIiwidmlzaWJsZVRoaXNGcmFtZSIsImlzVmlzaWJsZUZ1bmMiLCJwYXJhbWV0ZXJzIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJmbGlwRmFjZXMiLCJyZW5kZXJTdHlsZSIsInByZXBhcmVSZW5kZXJTdGF0ZSIsImRlY1JlZkNvdW50IiwiX2FhYmIiLCJsb2NhbEFhYmIiLCJ0b1dvcmxkU3BhY2UiLCJza2luSW5zdGFuY2UiLCJib25lQWFiYiIsIm1vcnBoVGFyZ2V0cyIsIm1vcnBoIiwiX3RhcmdldHMiLCJfaW5pdEJvbmVBYWJicyIsImJvbmVVc2VkIiwiZmlyc3QiLCJpIiwibGVuZ3RoIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsIm1hdHJpY2VzIiwiY2VudGVyIiwiY29weSIsImhhbGZFeHRlbnRzIiwiYWRkIiwic2V0IiwiX2V4cGFuZCIsImdldE1pbiIsImdldE1heCIsImdldFdvcmxkVHJhbnNmb3JtIiwiY2xlYXJTaGFkZXJzIiwic2hhZGVycyIsImRlc3Ryb3lCaW5kR3JvdXBzIiwiZ3JvdXBzIiwiZ3JvdXAiLCJ1bmlmb3JtQnVmZmVyIiwiZGVmYXVsdFVuaWZvcm1CdWZmZXIiLCJkZXN0cm95IiwiZ2V0QmluZEdyb3VwIiwiZGV2aWNlIiwicGFzcyIsImJpbmRHcm91cCIsInNoYWRlciIsIkRlYnVnIiwiYXNzZXJ0IiwidWJGb3JtYXQiLCJtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIlVuaWZvcm1CdWZmZXIiLCJiaW5nR3JvdXBGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwiQmluZEdyb3VwIiwicHJldk1hdCIsInJlbW92ZU1lc2hJbnN0YW5jZVJlZiIsImFkZE1lc2hJbnN0YW5jZVJlZiIsInByZXZCbGVuZCIsInRyYW5zcGFyZW50Iiwic2NlbmUiLCJfc2NlbmUiLCJsYXllcnMiLCJfZGlydHlCbGVuZCIsIl9sYXllciIsImNhbGN1bGF0ZVNvcnREaXN0YW5jZSIsInJlY2VpdmVTaGFkb3ciLCJTSEFERVJERUZfTk9TSEFET1ciLCJTSEFERVJfRk9SV0FSRCIsIlNIQURFUl9GT1JXQVJESERSIiwic2hhZGVyRGVmcyIsIlNIQURFUkRFRl9TS0lOIiwiX3NldHVwU2tpblVwZGF0ZSIsIm1vcnBoSW5zdGFuY2UiLCJ1c2VUZXh0dXJlTW9ycGgiLCJTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCIsIm1vcnBoUG9zaXRpb25zIiwiU0hBREVSREVGX01PUlBIX1BPU0lUSU9OIiwibW9ycGhOb3JtYWxzIiwiU0hBREVSREVGX01PUlBIX05PUk1BTCIsInNjcmVlblNwYWNlIiwiU0hBREVSREVGX1NDUkVFTlNQQUNFIiwibWFzayIsInRvZ2dsZXMiLCJpbnN0YW5jaW5nQ291bnQiLCJ2YWx1ZSIsInJlZkNvdW50Iiwic2V0UmVhbHRpbWVMaWdodG1hcCIsImxpZ2h0bWFwUGFyYW1OYW1lcyIsIl9wcmVwYXJlUmVuZGVyU3R5bGVGb3JBcnJheSIsIm1lc2hJbnN0YW5jZXMiLCJoYXMiLCJjbGVhciIsIl9pc1Zpc2libGUiLCJjYW1lcmEiLCJyYWRpdXMiLCJmcnVzdHVtIiwiY29udGFpbnNTcGhlcmUiLCJhbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRlc3QiLCJCTEVORF9OT1JNQUwiLCJpZCIsInNldEluc3RhbmNpbmciLCJudW1WZXJ0aWNlcyIsImluc3RhbmNpbmciLCJ1cGRhdGVQYXNzU2hhZGVyIiwic3RhdGljTGlnaHRMaXN0Iiwic29ydGVkTGlnaHRzIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwiZ2V0U2hhZGVyVmFyaWFudCIsImVuc3VyZU1hdGVyaWFsIiwid2FybiIsIm5hbWUiLCJnZXREZWZhdWx0TWF0ZXJpYWwiLCJjbGVhclBhcmFtZXRlcnMiLCJnZXRQYXJhbWV0ZXJzIiwiZ2V0UGFyYW1ldGVyIiwic2V0UGFyYW1ldGVyIiwiZGF0YSIsInBhc3NGbGFncyIsInVuZGVmaW5lZCIsInVuaWZvcm1PYmplY3QiLCJwYXJhbSIsInNjb3BlSWQiLCJ0ZXh0dXJlIiwib2xkIiwiTGlnaHRtYXBDYWNoZSIsImRlY1JlZiIsImluY1JlZiIsImRlbGV0ZVBhcmFtZXRlciIsInNldFBhcmFtZXRlcnMiLCJwYXNzRmxhZyIsInBhcmFtTmFtZSIsInBhcmFtZXRlciIsInNjb3BlIiwicmVzb2x2ZSIsInNldFZhbHVlIiwic2V0TGlnaHRtYXBwZWQiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsIk1BU0tfQkFLRSIsIlNIQURFUkRFRl9MTSIsIlNIQURFUkRFRl9ESVJMTSIsIlNIQURFUkRFRl9MTUFNQklFTlQiLCJzZXRDdXN0b21BYWJiIiwiY2xvbmUiLCJfdXBkYXRlQmVmb3JlQ3VsbCIsImlzQ29tbWFuZCIsIm1hdGVyaWFsSWQiLCJCTEVORF9OT05FIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFxQ0EsTUFBTUEsUUFBUSxHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBO0FBQ2xDLE1BQU1DLGFBQWEsR0FBRyxJQUFJRCxXQUFXLEVBQUUsQ0FBQTtBQUN2QyxNQUFNRSxXQUFXLEdBQUcsSUFBSUMsY0FBYyxFQUFFLENBQUE7QUFDeEMsTUFBTUMsUUFBUSxHQUFHLElBQUlDLEdBQUcsRUFBRSxDQUFBOztBQVExQixNQUFNQyxjQUFjLENBQUM7O0VBT2pCQyxXQUFXLENBQUNDLFVBQVUsRUFBRTtJQUFBLElBTHhCQyxDQUFBQSxZQUFZLEdBQUcs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
