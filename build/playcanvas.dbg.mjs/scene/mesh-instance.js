/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { BoundingBox } from '../shape/bounding-box.js';
import { BoundingSphere } from '../shape/bounding-sphere.js';
import { BindGroup } from '../graphics/bind-group.js';
import { UniformBuffer } from '../graphics/uniform-buffer.js';
import { SORTKEY_FORWARD, MASK_AFFECT_DYNAMIC, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR, SHADERDEF_TANGENTS, LAYER_WORLD, RENDERSTYLE_SOLID, SHADERDEF_NOSHADOW, SHADER_FORWARD, SHADER_FORWARDHDR, SHADERDEF_MORPH_TEXTURE_BASED, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_SCREENSPACE, BLEND_NORMAL, MASK_AFFECT_LIGHTMAPPED, MASK_BAKE, SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT, BLEND_NONE, SHADERDEF_SKIN } from './constants.js';
import { GraphNode } from './graph-node.js';
import { getDefaultMaterial } from './materials/default-material.js';
import { LightmapCache } from './lightmapper/lightmap-cache.js';

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
    this._key[SORTKEY_FORWARD] = getKey(this.layer, material.alphaToCoverage || material.alphaTest ? BLEND_NORMAL : material.blendType, false, material.id);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC1pbnN0YW5jZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL21lc2gtaW5zdGFuY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgQm91bmRpbmdCb3ggfSBmcm9tICcuLi9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9zaGFwZS9ib3VuZGluZy1zcGhlcmUuanMnO1xuXG5pbXBvcnQgeyBCaW5kR3JvdXAgfSBmcm9tICcuLi9ncmFwaGljcy9iaW5kLWdyb3VwLmpzJztcbmltcG9ydCB7IFVuaWZvcm1CdWZmZXIgfSBmcm9tICcuLi9ncmFwaGljcy91bmlmb3JtLWJ1ZmZlci5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgQkxFTkRfTk9STUFMLFxuICAgIExBWUVSX1dPUkxELFxuICAgIE1BU0tfQUZGRUNUX0RZTkFNSUMsIE1BU0tfQkFLRSwgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQsXG4gICAgUkVOREVSU1RZTEVfU09MSUQsXG4gICAgU0hBREVSX0ZPUldBUkQsIFNIQURFUl9GT1JXQVJESERSLFxuICAgIFNIQURFUkRFRl9VVjAsIFNIQURFUkRFRl9VVjEsIFNIQURFUkRFRl9WQ09MT1IsIFNIQURFUkRFRl9UQU5HRU5UUywgU0hBREVSREVGX05PU0hBRE9XLCBTSEFERVJERUZfU0tJTixcbiAgICBTSEFERVJERUZfU0NSRUVOU1BBQ0UsIFNIQURFUkRFRl9NT1JQSF9QT1NJVElPTiwgU0hBREVSREVGX01PUlBIX05PUk1BTCwgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQsXG4gICAgU0hBREVSREVGX0xNLCBTSEFERVJERUZfRElSTE0sIFNIQURFUkRFRl9MTUFNQklFTlQsXG4gICAgU09SVEtFWV9GT1JXQVJEXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWxzL2RlZmF1bHQtbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTGlnaHRtYXBDYWNoZSB9IGZyb20gJy4vbGlnaHRtYXBwZXIvbGlnaHRtYXAtY2FjaGUuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9IFRleHR1cmUgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9ncmFwaGljcy9zaGFkZXIuanMnKS5TaGFkZXJ9IFNoYWRlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnKS5WZXJ0ZXhCdWZmZXJ9IFZlcnRleEJ1ZmZlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2dyYXBoaWNzL2JpbmQtZ3JvdXAtZm9ybWF0LmpzJykuQmluZEdyb3VwRm9ybWF0fSBCaW5kR3JvdXBGb3JtYXQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9ncmFwaGljcy91bmlmb3JtLWJ1ZmZlci1mb3JtYXQuanMnKS5Vbmlmb3JtQnVmZmVyRm9ybWF0fSBVbmlmb3JtQnVmZmVyRm9ybWF0ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vbWF0aC92ZWMzLmpzJykuVmVjM30gVmVjMyAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9IE1hdGVyaWFsICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9tZXNoLmpzJykuTWVzaH0gTWVzaCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc2NlbmUuanMnKS5TY2VuZX0gU2NlbmUgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL21vcnBoLWluc3RhbmNlLmpzJykuTW9ycGhJbnN0YW5jZX0gTW9ycGhJbnN0YW5jZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc2tpbi1pbnN0YW5jZS5qcycpLlNraW5JbnN0YW5jZX0gU2tpbkluc3RhbmNlICovXG5cbmNvbnN0IF90bXBBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcEJvbmVBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX21lc2hTZXQgPSBuZXcgU2V0KCk7XG5cblxuLyoqXG4gKiBJbnRlcm5hbCBkYXRhIHN0cnVjdHVyZSB1c2VkIHRvIHN0b3JlIGRhdGEgdXNlZCBieSBoYXJkd2FyZSBpbnN0YW5jaW5nLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgSW5zdGFuY2luZ0RhdGEge1xuICAgIC8qKiBAdHlwZSB7VmVydGV4QnVmZmVyfG51bGx9ICovXG4gICAgdmVydGV4QnVmZmVyID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW1PYmplY3RzIC0gVGhlIG51bWJlciBvZiBvYmplY3RzIGluc3RhbmNlZC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihudW1PYmplY3RzKSB7XG4gICAgICAgIHRoaXMuY291bnQgPSBudW1PYmplY3RzO1xuICAgIH1cbn1cblxuY2xhc3MgQ29tbWFuZCB7XG4gICAgY29uc3RydWN0b3IobGF5ZXIsIGJsZW5kVHlwZSwgY29tbWFuZCkge1xuICAgICAgICB0aGlzLl9rZXkgPSBbXTtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSBnZXRLZXkobGF5ZXIsIGJsZW5kVHlwZSwgdHJ1ZSwgMCk7XG4gICAgICAgIHRoaXMuY29tbWFuZCA9IGNvbW1hbmQ7XG4gICAgfVxuXG4gICAgc2V0IGtleSh2YWwpIHtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSB2YWw7XG4gICAgfVxuXG4gICAgZ2V0IGtleSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBMYXllcn0gdG8gY2FsY3VsYXRlIHRoZSBcInNvcnQgZGlzdGFuY2VcIiBmb3IgYSB7QGxpbmsgTWVzaEluc3RhbmNlfSxcbiAqIHdoaWNoIGRldGVybWluZXMgaXRzIHBsYWNlIGluIHRoZSByZW5kZXIgb3JkZXIuXG4gKlxuICogQGNhbGxiYWNrIENhbGN1bGF0ZVNvcnREaXN0YW5jZUNhbGxiYWNrXG4gKiBAcGFyYW0ge01lc2hJbnN0YW5jZX0gbWVzaEluc3RhbmNlIC0gVGhlIG1lc2ggaW5zdGFuY2UuXG4gKiBAcGFyYW0ge1ZlYzN9IGNhbWVyYVBvc2l0aW9uIC0gVGhlIHBvc2l0aW9uIG9mIHRoZSBjYW1lcmEuXG4gKiBAcGFyYW0ge1ZlYzN9IGNhbWVyYUZvcndhcmQgLSBUaGUgZm9yd2FyZCB2ZWN0b3Igb2YgdGhlIGNhbWVyYS5cbiAqL1xuXG4vKipcbiAqIEFuIGluc3RhbmNlIG9mIGEge0BsaW5rIE1lc2h9LiBBIHNpbmdsZSBtZXNoIGNhbiBiZSByZWZlcmVuY2VkIGJ5IG1hbnkgbWVzaCBpbnN0YW5jZXMgdGhhdCBjYW5cbiAqIGhhdmUgZGlmZmVyZW50IHRyYW5zZm9ybXMgYW5kIG1hdGVyaWFscy5cbiAqL1xuY2xhc3MgTWVzaEluc3RhbmNlIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWF0ZXJpYWx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWw7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBzaGFkZXJzIHVzZWQgYnkgdGhlIG1lc2ggaW5zdGFuY2UsIGluZGV4ZWQgYnkgdGhlIHNoYWRlciBwYXNzIGNvbnN0YW50IChTSEFERVJfRk9SV0FSRC4uKVxuICAgICAqXG4gICAgICogQHR5cGUge0FycmF5PFNoYWRlcj59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9zaGFkZXIgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGJpbmQgZ3JvdXBzLCBzdG9yaW5nIHVuaWZvcm1zIHBlciBwYXNzLiBUaGlzIGhhcyAxOjEgcmVsYXRpb24gd2l0aCB0aGUgX3NoYWRlcyBhcnJheSxcbiAgICAgKiBhbmQgaXMgaW5kZXhlZCBieSB0aGUgc2hhZGVyIHBhc3MgY29uc3RhbnQgYXMgd2VsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBcnJheTxCaW5kR3JvdXA+fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfYmluZEdyb3VwcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1lc2hJbnN0YW5jZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWVzaH0gbWVzaCAtIFRoZSBncmFwaGljcyBtZXNoIHRvIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSBmb3IgdGhpcyBtZXNoIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7R3JhcGhOb2RlfSBbbm9kZV0gLSBUaGUgZ3JhcGggbm9kZSBkZWZpbmluZyB0aGUgdHJhbnNmb3JtIGZvciB0aGlzIGluc3RhbmNlLiBUaGlzXG4gICAgICogcGFyYW1ldGVyIGlzIG9wdGlvbmFsIHdoZW4gdXNlZCB3aXRoIHtAbGluayBSZW5kZXJDb21wb25lbnR9IGFuZCB3aWxsIHVzZSB0aGUgbm9kZSB0aGVcbiAgICAgKiBjb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBtZXNoIGluc3RhbmNlIHBvaW50aW5nIHRvIGEgMXgxeDEgJ2N1YmUnIG1lc2hcbiAgICAgKiB2YXIgbWVzaCA9IHBjLmNyZWF0ZUJveChncmFwaGljc0RldmljZSk7XG4gICAgICogdmFyIG1hdGVyaWFsID0gbmV3IHBjLlN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgKlxuICAgICAqIHZhciBtZXNoSW5zdGFuY2UgPSBuZXcgcGMuTWVzaEluc3RhbmNlKG1lc2gsIG1hdGVyaWFsKTtcbiAgICAgKlxuICAgICAqIHZhciBlbnRpdHkgPSBuZXcgcGMuRW50aXR5KCk7XG4gICAgICogZW50aXR5LmFkZENvbXBvbmVudCgncmVuZGVyJywge1xuICAgICAqICAgICBtZXNoSW5zdGFuY2VzOiBbbWVzaEluc3RhbmNlXVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gQWRkIHRoZSBlbnRpdHkgdG8gdGhlIHNjZW5lIGhpZXJhcmNoeVxuICAgICAqIHRoaXMuYXBwLnNjZW5lLnJvb3QuYWRkQ2hpbGQoZW50aXR5KTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtZXNoLCBtYXRlcmlhbCwgbm9kZSA9IG51bGwpIHtcbiAgICAgICAgLy8gaWYgZmlyc3QgcGFyYW1ldGVyIGlzIG9mIEdyYXBoTm9kZSB0eXBlLCBoYW5kbGUgcHJldmlvdXMgY29uc3RydWN0b3Igc2lnbmF0dXJlOiAobm9kZSwgbWVzaCwgbWF0ZXJpYWwpXG4gICAgICAgIGlmIChtZXNoIGluc3RhbmNlb2YgR3JhcGhOb2RlKSB7XG4gICAgICAgICAgICBjb25zdCB0ZW1wID0gbWVzaDtcbiAgICAgICAgICAgIG1lc2ggPSBtYXRlcmlhbDtcbiAgICAgICAgICAgIG1hdGVyaWFsID0gbm9kZTtcbiAgICAgICAgICAgIG5vZGUgPSB0ZW1wO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fa2V5ID0gWzAsIDBdO1xuXG4gICAgICAgIHRoaXMuaXNTdGF0aWMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fc3RhdGljTGlnaHRMaXN0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3RhdGljU291cmNlID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGdyYXBoIG5vZGUgZGVmaW5pbmcgdGhlIHRyYW5zZm9ybSBmb3IgdGhpcyBpbnN0YW5jZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0dyYXBoTm9kZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubm9kZSA9IG5vZGU7ICAgICAgICAgICAvLyBUaGUgbm9kZSB0aGF0IGRlZmluZXMgdGhlIHRyYW5zZm9ybSBvZiB0aGUgbWVzaCBpbnN0YW5jZVxuICAgICAgICB0aGlzLl9tZXNoID0gbWVzaDsgICAgICAgICAgLy8gVGhlIG1lc2ggdGhhdCB0aGlzIGluc3RhbmNlIHJlbmRlcnNcbiAgICAgICAgbWVzaC5pbmNSZWZDb3VudCgpO1xuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbWF0ZXJpYWw7ICAgLy8gVGhlIG1hdGVyaWFsIHdpdGggd2hpY2ggdG8gcmVuZGVyIHRoaXMgaW5zdGFuY2VcblxuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gTUFTS19BRkZFQ1RfRFlOQU1JQyA8PCAxNjsgLy8gMiBieXRlIHRvZ2dsZXMsIDIgYnl0ZXMgbGlnaHQgbWFzazsgRGVmYXVsdCB2YWx1ZSBpcyBubyB0b2dnbGVzIGFuZCBtYXNrID0gcGMuTUFTS19BRkZFQ1RfRFlOQU1JQ1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzIHw9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNVdjAgPyBTSEFERVJERUZfVVYwIDogMDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzVXYxID8gU0hBREVSREVGX1VWMSA6IDA7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgfD0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc0NvbG9yID8gU0hBREVSREVGX1ZDT0xPUiA6IDA7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgfD0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc1RhbmdlbnRzID8gU0hBREVSREVGX1RBTkdFTlRTIDogMDtcblxuICAgICAgICB0aGlzLl9saWdodEhhc2ggPSAwO1xuXG4gICAgICAgIC8vIFJlbmRlciBvcHRpb25zXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBFbmFibGUgcmVuZGVyaW5nIGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuIFVzZSB2aXNpYmxlIHByb3BlcnR5IHRvIGVuYWJsZS9kaXNhYmxlXG4gICAgICAgICAqIHJlbmRlcmluZyB3aXRob3V0IG92ZXJoZWFkIG9mIHJlbW92aW5nIGZyb20gc2NlbmUuIEJ1dCBub3RlIHRoYXQgdGhlIG1lc2ggaW5zdGFuY2UgaXNcbiAgICAgICAgICogc3RpbGwgaW4gdGhlIGhpZXJhcmNoeSBhbmQgc3RpbGwgaW4gdGhlIGRyYXcgY2FsbCBsaXN0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmlzaWJsZSA9IHRydWU7XG4gICAgICAgIHRoaXMubGF5ZXIgPSBMQVlFUl9XT1JMRDsgLy8gbGVnYWN5XG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9yZW5kZXJTdHlsZSA9IFJFTkRFUlNUWUxFX1NPTElEO1xuICAgICAgICB0aGlzLmNhc3RTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fcmVjZWl2ZVNoYWRvdyA9IHRydWU7XG4gICAgICAgIHRoaXMuX3NjcmVlblNwYWNlID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX25vRGVwdGhEcmF3R2wxID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIG1lc2ggaW5zdGFuY2UgY2FuIGJlIGN1bGxlZCBieSBmcnVzdHVtIGN1bGxpbmdcbiAgICAgICAgICogKHtAbGluayBDYW1lcmFDb21wb25lbnQjZnJ1c3R1bUN1bGxpbmd9KS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN1bGwgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBtZXNoIGluc3RhbmNlIGlzIHBpY2thYmxlIGJ5IHRoZSB7QGxpbmsgUGlja2VyfS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucGljayA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlQWFiYiA9IHRydWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmJGdW5jID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU29ydERpc3RhbmNlID0gbnVsbDtcblxuICAgICAgICAvLyA2NC1iaXQgaW50ZWdlciBrZXkgdGhhdCBkZWZpbmVzIHJlbmRlciBvcmRlciBvZiB0aGlzIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1NraW5JbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7TW9ycGhJbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gbnVsbDtcblxuICAgICAgICAvLyBXb3JsZCBzcGFjZSBBQUJCXG4gICAgICAgIHRoaXMuYWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICB0aGlzLl9hYWJiVmVyID0gLTE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZSB0aGlzIHZhbHVlIHRvIGFmZmVjdCByZW5kZXJpbmcgb3JkZXIgb2YgbWVzaCBpbnN0YW5jZXMuIE9ubHkgdXNlZCB3aGVuIG1lc2hcbiAgICAgICAgICogaW5zdGFuY2VzIGFyZSBhZGRlZCB0byBhIHtAbGluayBMYXllcn0gd2l0aCB7QGxpbmsgTGF5ZXIjb3BhcXVlU29ydE1vZGV9IG9yXG4gICAgICAgICAqIHtAbGluayBMYXllciN0cmFuc3BhcmVudFNvcnRNb2RlfSAoZGVwZW5kaW5nIG9uIHRoZSBtYXRlcmlhbCkgc2V0IHRvXG4gICAgICAgICAqIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWFkIHRoaXMgdmFsdWUgaW4ge0BsaW5rIExheWVyI29uUG9zdEN1bGx9IHRvIGRldGVybWluZSBpZiB0aGUgb2JqZWN0IGlzIGFjdHVhbGx5IGdvaW5nXG4gICAgICAgICAqIHRvIGJlIHJlbmRlcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmlzaWJsZVRoaXNGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGN1c3RvbSBmdW5jdGlvbiB1c2VkIHRvIGN1c3RvbWl6ZSBjdWxsaW5nIChlLmcuIGZvciAyRCBVSSBlbGVtZW50cylcbiAgICAgICAgdGhpcy5pc1Zpc2libGVGdW5jID0gbnVsbDtcblxuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGcm9udCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3RlbmNpbEJhY2sgPSBudWxsO1xuXG4gICAgICAgIC8vIE5lZ2F0aXZlIHNjYWxlIGJhdGNoaW5nIHN1cHBvcnRcbiAgICAgICAgdGhpcy5mbGlwRmFjZXMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVuZGVyIHN0eWxlIG9mIHRoZSBtZXNoIGluc3RhbmNlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH1cbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9XSVJFRlJBTUV9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfUE9JTlRTfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFJFTkRFUlNUWUxFX1NPTElEfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlbmRlclN0eWxlKHJlbmRlclN0eWxlKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG4gICAgICAgIHRoaXMubWVzaC5wcmVwYXJlUmVuZGVyU3RhdGUocmVuZGVyU3R5bGUpO1xuICAgIH1cblxuICAgIGdldCByZW5kZXJTdHlsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclN0eWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBncmFwaGljcyBtZXNoIGJlaW5nIGluc3RhbmNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNZXNofVxuICAgICAqL1xuICAgIHNldCBtZXNoKG1lc2gpIHtcblxuICAgICAgICBpZiAobWVzaCA9PT0gdGhpcy5fbWVzaClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaCkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaC5kZWNSZWZDb3VudCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWVzaCA9IG1lc2g7XG5cbiAgICAgICAgaWYgKG1lc2gpIHtcbiAgICAgICAgICAgIG1lc2guaW5jUmVmQ291bnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtZXNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWVzaDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd29ybGQgc3BhY2UgYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveCBmb3IgdGhpcyBtZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0JvdW5kaW5nQm94fVxuICAgICAqL1xuICAgIHNldCBhYWJiKGFhYmIpIHtcbiAgICAgICAgdGhpcy5fYWFiYiA9IGFhYmI7XG4gICAgfVxuXG4gICAgZ2V0IGFhYmIoKSB7XG4gICAgICAgIC8vIHVzZSBzcGVjaWZpZWQgd29ybGQgc3BhY2UgYWFiYlxuICAgICAgICBpZiAoIXRoaXMuX3VwZGF0ZUFhYmIpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9hYWJiO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsbGJhY2sgZnVuY3Rpb24gcmV0dXJuaW5nIHdvcmxkIHNwYWNlIGFhYmJcbiAgICAgICAgaWYgKHRoaXMuX3VwZGF0ZUFhYmJGdW5jKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdXBkYXRlQWFiYkZ1bmModGhpcy5fYWFiYik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1c2UgbG9jYWwgc3BhY2Ugb3ZlcnJpZGUgYWFiYiBpZiBzcGVjaWZpZWRcbiAgICAgICAgbGV0IGxvY2FsQWFiYiA9IHRoaXMuX2N1c3RvbUFhYmI7XG4gICAgICAgIGxldCB0b1dvcmxkU3BhY2UgPSAhIWxvY2FsQWFiYjtcblxuICAgICAgICAvLyBvdGhlcndpc2UgZXZhbHVhdGUgbG9jYWwgYWFiYlxuICAgICAgICBpZiAoIWxvY2FsQWFiYikge1xuXG4gICAgICAgICAgICBsb2NhbEFhYmIgPSBfdG1wQWFiYjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc2tpbkluc3RhbmNlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBJbml0aWFsaXplIGxvY2FsIGJvbmUgQUFCQnMgaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm1lc2guYm9uZUFhYmIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRzID0gdGhpcy5fbW9ycGhJbnN0YW5jZSA/IHRoaXMuX21vcnBoSW5zdGFuY2UubW9ycGguX3RhcmdldHMgOiBudWxsO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1lc2guX2luaXRCb25lQWFiYnMobW9ycGhUYXJnZXRzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBldmFsdWF0ZSBsb2NhbCBzcGFjZSBib3VuZHMgYmFzZWQgb24gYWxsIGFjdGl2ZSBib25lc1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVVc2VkID0gdGhpcy5tZXNoLmJvbmVVc2VkO1xuICAgICAgICAgICAgICAgIGxldCBmaXJzdCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWVzaC5ib25lQWFiYi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYm9uZVVzZWRbaV0pIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIGJvbmUgQUFCQiBieSBib25lIG1hdHJpeFxuICAgICAgICAgICAgICAgICAgICAgICAgX3RlbXBCb25lQWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKHRoaXMubWVzaC5ib25lQWFiYltpXSwgdGhpcy5za2luSW5zdGFuY2UubWF0cmljZXNbaV0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdGhlbSB1cFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpcnN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuY2VudGVyLmNvcHkoX3RlbXBCb25lQWFiYi5jZW50ZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5jb3B5KF90ZW1wQm9uZUFhYmIuaGFsZkV4dGVudHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuYWRkKF90ZW1wQm9uZUFhYmIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdG9Xb3JsZFNwYWNlID0gdHJ1ZTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm5vZGUuX2FhYmJWZXIgIT09IHRoaXMuX2FhYmJWZXIpIHtcblxuICAgICAgICAgICAgICAgIC8vIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCAtIGVpdGhlciBmcm9tIG1lc2ggb3IgZW1wdHlcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5jZW50ZXIuY29weSh0aGlzLm1lc2guYWFiYi5jZW50ZXIpO1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuaGFsZkV4dGVudHMuY29weSh0aGlzLm1lc2guYWFiYi5oYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmNlbnRlci5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRlIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCBieSBtb3JwaCB0YXJnZXRzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMubWVzaCAmJiB0aGlzLm1lc2gubW9ycGgpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLl9leHBhbmQodGhpcy5tZXNoLm1vcnBoLmFhYmIuZ2V0TWluKCksIHRoaXMubWVzaC5tb3JwaC5hYWJiLmdldE1heCgpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0b1dvcmxkU3BhY2UgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FhYmJWZXIgPSB0aGlzLm5vZGUuX2FhYmJWZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdG9yZSB3b3JsZCBzcGFjZSBib3VuZGluZyBib3hcbiAgICAgICAgaWYgKHRvV29ybGRTcGFjZSkge1xuICAgICAgICAgICAgdGhpcy5fYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGxvY2FsQWFiYiwgdGhpcy5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FhYmI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXIgdGhlIGludGVybmFsIHNoYWRlciBhcnJheS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjbGVhclNoYWRlcnMoKSB7XG4gICAgICAgIGNvbnN0IHNoYWRlcnMgPSB0aGlzLl9zaGFkZXI7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2hhZGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc2hhZGVyc1tpXSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRlc3Ryb3lCaW5kR3JvdXBzKCk7XG4gICAgfVxuXG4gICAgZGVzdHJveUJpbmRHcm91cHMoKSB7XG5cbiAgICAgICAgY29uc3QgZ3JvdXBzID0gdGhpcy5fYmluZEdyb3VwcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBncm91cHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gZ3JvdXBzW2ldO1xuICAgICAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdW5pZm9ybUJ1ZmZlciA9IGdyb3VwLmRlZmF1bHRVbmlmb3JtQnVmZmVyO1xuICAgICAgICAgICAgICAgIGlmICh1bmlmb3JtQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHVuaWZvcm1CdWZmZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBncm91cC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZ3JvdXBzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcGFzcyAtIFNoYWRlciBwYXNzIG51bWJlci5cbiAgICAgKiBAcmV0dXJucyB7QmluZEdyb3VwfSAtIFRoZSBtZXNoIGJpbmQgZ3JvdXAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEJpbmRHcm91cChkZXZpY2UsIHBhc3MpIHtcblxuICAgICAgICAvLyBjcmVhdGUgYmluZCBncm91cFxuICAgICAgICBsZXQgYmluZEdyb3VwID0gdGhpcy5fYmluZEdyb3Vwc1twYXNzXTtcbiAgICAgICAgaWYgKCFiaW5kR3JvdXApIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuX3NoYWRlcltwYXNzXTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChzaGFkZXIpO1xuXG4gICAgICAgICAgICAvLyBtZXNoIHVuaWZvcm0gYnVmZmVyXG4gICAgICAgICAgICBjb25zdCB1YkZvcm1hdCA9IHNoYWRlci5tZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydCh1YkZvcm1hdCk7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtQnVmZmVyID0gbmV3IFVuaWZvcm1CdWZmZXIoZGV2aWNlLCB1YkZvcm1hdCk7XG5cbiAgICAgICAgICAgIC8vIG1lc2ggYmluZCBncm91cFxuICAgICAgICAgICAgY29uc3QgYmluZ0dyb3VwRm9ybWF0ID0gc2hhZGVyLm1lc2hCaW5kR3JvdXBGb3JtYXQ7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoYmluZ0dyb3VwRm9ybWF0KTtcbiAgICAgICAgICAgIGJpbmRHcm91cCA9IG5ldyBCaW5kR3JvdXAoZGV2aWNlLCBiaW5nR3JvdXBGb3JtYXQsIHVuaWZvcm1CdWZmZXIpO1xuXG4gICAgICAgICAgICB0aGlzLl9iaW5kR3JvdXBzW3Bhc3NdID0gYmluZEdyb3VwO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJpbmRHcm91cDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF0ZXJpYWwgdXNlZCBieSB0aGlzIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWF0ZXJpYWx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsKG1hdGVyaWFsKSB7XG5cbiAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcblxuICAgICAgICBjb25zdCBwcmV2TWF0ID0gdGhpcy5fbWF0ZXJpYWw7XG5cbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBtYXRlcmlhbCdzIHJlZmVyZW5jZSB0byB0aGlzIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgaWYgKHByZXZNYXQpIHtcbiAgICAgICAgICAgIHByZXZNYXQucmVtb3ZlTWVzaEluc3RhbmNlUmVmKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBtYXRlcmlhbDtcblxuICAgICAgICBpZiAobWF0ZXJpYWwpIHtcblxuICAgICAgICAgICAgLy8gUmVjb3JkIHRoYXQgdGhlIG1hdGVyaWFsIGlzIHJlZmVyZW5jZWQgYnkgdGhpcyBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICBtYXRlcmlhbC5hZGRNZXNoSW5zdGFuY2VSZWYodGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgICAgIC8vIGlmIGJsZW5kIHR5cGUgb2YgdGhlIG1hdGVyaWFsIGNoYW5nZXNcbiAgICAgICAgICAgIGNvbnN0IHByZXZCbGVuZCA9IHByZXZNYXQgJiYgcHJldk1hdC50cmFuc3BhcmVudDtcbiAgICAgICAgICAgIGlmIChtYXRlcmlhbC50cmFuc3BhcmVudCAhPT0gcHJldkJsZW5kKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLl9tYXRlcmlhbC5fc2NlbmUgfHwgcHJldk1hdD8uX3NjZW5lO1xuICAgICAgICAgICAgICAgIGlmIChzY2VuZSkge1xuICAgICAgICAgICAgICAgICAgICBzY2VuZS5sYXllcnMuX2RpcnR5QmxlbmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICBzZXQgbGF5ZXIobGF5ZXIpIHtcbiAgICAgICAgdGhpcy5fbGF5ZXIgPSBsYXllcjtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgbGF5ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbiBzb21lIGNpcmN1bXN0YW5jZXMgbWVzaCBpbnN0YW5jZXMgYXJlIHNvcnRlZCBieSBhIGRpc3RhbmNlIGNhbGN1bGF0aW9uIHRvIGRldGVybWluZSB0aGVpclxuICAgICAqIHJlbmRlcmluZyBvcmRlci4gU2V0IHRoaXMgY2FsbGJhY2sgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHQgZGlzdGFuY2UgY2FsY3VsYXRpb24sIHdoaWNoIGdpdmVzXG4gICAgICogdGhlIGRvdCBwcm9kdWN0IG9mIHRoZSBjYW1lcmEgZm9yd2FyZCB2ZWN0b3IgYW5kIHRoZSB2ZWN0b3IgYmV0d2VlbiB0aGUgY2FtZXJhIHBvc2l0aW9uIGFuZFxuICAgICAqIHRoZSBjZW50ZXIgb2YgdGhlIG1lc2ggaW5zdGFuY2UncyBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94LiBUaGlzIG9wdGlvbiBjYW4gYmUgcGFydGljdWxhcmx5XG4gICAgICogdXNlZnVsIGZvciByZW5kZXJpbmcgdHJhbnNwYXJlbnQgbWVzaGVzIGluIGEgYmV0dGVyIG9yZGVyIHRoYW4gZGVmYXVsdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDYWxjdWxhdGVTb3J0RGlzdGFuY2VDYWxsYmFja31cbiAgICAgKi9cbiAgICBzZXQgY2FsY3VsYXRlU29ydERpc3RhbmNlKGNhbGN1bGF0ZVNvcnREaXN0YW5jZSkge1xuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTb3J0RGlzdGFuY2UgPSBjYWxjdWxhdGVTb3J0RGlzdGFuY2U7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZVNvcnREaXN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZTtcbiAgICB9XG5cbiAgICBzZXQgcmVjZWl2ZVNoYWRvdyh2YWwpIHtcbiAgICAgICAgdGhpcy5fcmVjZWl2ZVNoYWRvdyA9IHZhbDtcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IHZhbCA/ICh0aGlzLl9zaGFkZXJEZWZzICYgflNIQURFUkRFRl9OT1NIQURPVykgOiAodGhpcy5fc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9OT1NIQURPVyk7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSRF0gPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRIRFJdID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgcmVjZWl2ZVNoYWRvdygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlY2VpdmVTaGFkb3c7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHNraW4gaW5zdGFuY2UgbWFuYWdpbmcgc2tpbm5pbmcgb2YgdGhpcyBtZXNoIGluc3RhbmNlLCBvciBudWxsIGlmIHNraW5uaW5nIGlzIG5vdCB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge1NraW5JbnN0YW5jZX1cbiAgICAgKi9cbiAgICBzZXQgc2tpbkluc3RhbmNlKHZhbCkge1xuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2UgPSB2YWw7XG5cbiAgICAgICAgbGV0IHNoYWRlckRlZnMgPSB0aGlzLl9zaGFkZXJEZWZzO1xuICAgICAgICBzaGFkZXJEZWZzID0gdmFsID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfU0tJTikgOiAoc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfU0tJTik7XG5cbiAgICAgICAgLy8gaWYgc2hhZGVyRGVmcyBoYXZlIGNoYW5nZWRcbiAgICAgICAgaWYgKHNoYWRlckRlZnMgIT09IHRoaXMuX3NoYWRlckRlZnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBzaGFkZXJEZWZzO1xuICAgICAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9zZXR1cFNraW5VcGRhdGUoKTtcbiAgICB9XG5cbiAgICBnZXQgc2tpbkluc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2tpbkluc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtb3JwaCBpbnN0YW5jZSBtYW5hZ2luZyBtb3JwaGluZyBvZiB0aGlzIG1lc2ggaW5zdGFuY2UsIG9yIG51bGwgaWYgbW9ycGhpbmcgaXMgbm90IHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TW9ycGhJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBzZXQgbW9ycGhJbnN0YW5jZSh2YWwpIHtcblxuICAgICAgICAvLyByZWxlYXNlIGV4aXN0aW5nXG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2U/LmRlc3Ryb3koKTtcblxuICAgICAgICAvLyBhc3NpZ24gbmV3XG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2UgPSB2YWw7XG5cbiAgICAgICAgbGV0IHNoYWRlckRlZnMgPSB0aGlzLl9zaGFkZXJEZWZzO1xuICAgICAgICBzaGFkZXJEZWZzID0gKHZhbCAmJiB2YWwubW9ycGgudXNlVGV4dHVyZU1vcnBoKSA/IChzaGFkZXJEZWZzIHwgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQpIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQpO1xuICAgICAgICBzaGFkZXJEZWZzID0gKHZhbCAmJiB2YWwubW9ycGgubW9ycGhQb3NpdGlvbnMpID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfTU9SUEhfUE9TSVRJT04pIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX1BPU0lUSU9OKTtcbiAgICAgICAgc2hhZGVyRGVmcyA9ICh2YWwgJiYgdmFsLm1vcnBoLm1vcnBoTm9ybWFscykgPyAoc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9NT1JQSF9OT1JNQUwpIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX05PUk1BTCk7XG5cbiAgICAgICAgLy8gaWYgc2hhZGVyRGVmcyBoYXZlIGNoYW5nZWRcbiAgICAgICAgaWYgKHNoYWRlckRlZnMgIT09IHRoaXMuX3NoYWRlckRlZnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBzaGFkZXJEZWZzO1xuICAgICAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtb3JwaEluc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9ycGhJbnN0YW5jZTtcbiAgICB9XG5cbiAgICBzZXQgc2NyZWVuU3BhY2UodmFsKSB7XG4gICAgICAgIHRoaXMuX3NjcmVlblNwYWNlID0gdmFsO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gdmFsID8gKHRoaXMuX3NoYWRlckRlZnMgfCBTSEFERVJERUZfU0NSRUVOU1BBQ0UpIDogKHRoaXMuX3NoYWRlckRlZnMgJiB+U0hBREVSREVGX1NDUkVFTlNQQUNFKTtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJEXSA9IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0IHNjcmVlblNwYWNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2NyZWVuU3BhY2U7XG4gICAgfVxuXG4gICAgc2V0IGtleSh2YWwpIHtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSB2YWw7XG4gICAgfVxuXG4gICAgZ2V0IGtleSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hc2sgY29udHJvbGxpbmcgd2hpY2gge0BsaW5rIExpZ2h0Q29tcG9uZW50fXMgbGlnaHQgdGhpcyBtZXNoIGluc3RhbmNlLCB3aGljaFxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnR9IHNlZXMgaXQgYW5kIGluIHdoaWNoIHtAbGluayBMYXllcn0gaXQgaXMgcmVuZGVyZWQuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNrKHZhbCkge1xuICAgICAgICBjb25zdCB0b2dnbGVzID0gdGhpcy5fc2hhZGVyRGVmcyAmIDB4MDAwMEZGRkY7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSB0b2dnbGVzIHwgKHZhbCA8PCAxNik7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSRF0gPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRIRFJdID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRlckRlZnMgPj4gMTY7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTnVtYmVyIG9mIGluc3RhbmNlcyB3aGVuIHVzaW5nIGhhcmR3YXJlIGluc3RhbmNpbmcgdG8gcmVuZGVyIHRoZSBtZXNoLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaW5zdGFuY2luZ0NvdW50KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmluc3RhbmNpbmdEYXRhKVxuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YS5jb3VudCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBpbnN0YW5jaW5nQ291bnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNpbmdEYXRhID8gdGhpcy5pbnN0YW5jaW5nRGF0YS5jb3VudCA6IDA7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICBjb25zdCBtZXNoID0gdGhpcy5tZXNoO1xuICAgICAgICBpZiAobWVzaCkge1xuXG4gICAgICAgICAgICAvLyB0aGlzIGRlY3JlYXNlcyByZWYgY291bnQgb24gdGhlIG1lc2hcbiAgICAgICAgICAgIHRoaXMubWVzaCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgbWVzaFxuICAgICAgICAgICAgaWYgKG1lc2gucmVmQ291bnQgPCAxKSB7XG4gICAgICAgICAgICAgICAgbWVzaC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWxlYXNlIHJlZiBjb3VudGVkIGxpZ2h0bWFwc1xuICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbnVsbCk7XG4gICAgICAgIHRoaXMuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzFdLCBudWxsKTtcblxuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2U/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLm1vcnBoSW5zdGFuY2U/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5tb3JwaEluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNsZWFyU2hhZGVycygpO1xuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSBtYXRlcmlhbCBjbGVhcnMgcmVmZXJlbmNlcyB0byB0aGlzIG1lc2hJbnN0YW5jZVxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBzaGFkZXIgdW5pZm9ybSBuYW1lcyBmb3IgbGlnaHRtYXBzXG4gICAgc3RhdGljIGxpZ2h0bWFwUGFyYW1OYW1lcyA9IFsndGV4dHVyZV9saWdodE1hcCcsICd0ZXh0dXJlX2RpckxpZ2h0TWFwJ107XG5cbiAgICAvLyBnZW5lcmF0ZXMgd2lyZWZyYW1lcyBmb3IgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXNcbiAgICBzdGF0aWMgX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5KG1lc2hJbnN0YW5jZXMsIHJlbmRlclN0eWxlKSB7XG5cbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gc3dpdGNoIG1lc2ggaW5zdGFuY2UgdG8gdGhlIHJlcXVlc3RlZCBzdHlsZVxuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG5cbiAgICAgICAgICAgICAgICAvLyBwcm9jZXNzIGFsbCB1bmlxdWUgbWVzaGVzXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZXNbaV0ubWVzaDtcbiAgICAgICAgICAgICAgICBpZiAoIV9tZXNoU2V0LmhhcyhtZXNoKSkge1xuICAgICAgICAgICAgICAgICAgICBfbWVzaFNldC5hZGQobWVzaCk7XG4gICAgICAgICAgICAgICAgICAgIG1lc2gucHJlcGFyZVJlbmRlclN0YXRlKHJlbmRlclN0eWxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9tZXNoU2V0LmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB0ZXN0IGlmIG1lc2hJbnN0YW5jZSBpcyB2aXNpYmxlIGJ5IGNhbWVyYS4gSXQgcmVxdWlyZXMgdGhlIGZydXN0dW0gb2YgdGhlIGNhbWVyYSB0byBiZSB1cCB0byBkYXRlLCB3aGljaCBmb3J3YXJkLXJlbmRlcmVyXG4gICAgLy8gdGFrZXMgY2FyZSBvZi4gVGhpcyBmdW5jdGlvbiBzaG91bGQgIG5vdCBiZSBjYWxsZWQgZWxzZXdoZXJlLlxuICAgIF9pc1Zpc2libGUoY2FtZXJhKSB7XG5cbiAgICAgICAgaWYgKHRoaXMudmlzaWJsZSkge1xuXG4gICAgICAgICAgICAvLyBjdXN0b20gdmlzaWJpbGl0eSBtZXRob2Qgb2YgTWVzaEluc3RhbmNlXG4gICAgICAgICAgICBpZiAodGhpcy5pc1Zpc2libGVGdW5jKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNWaXNpYmxlRnVuYyhjYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfdGVtcFNwaGVyZS5jZW50ZXIgPSB0aGlzLmFhYmIuY2VudGVyOyAgLy8gdGhpcyBsaW5lIGV2YWx1YXRlcyBhYWJiXG4gICAgICAgICAgICBfdGVtcFNwaGVyZS5yYWRpdXMgPSB0aGlzLl9hYWJiLmhhbGZFeHRlbnRzLmxlbmd0aCgpO1xuXG4gICAgICAgICAgICByZXR1cm4gY2FtZXJhLmZydXN0dW0uY29udGFpbnNTcGhlcmUoX3RlbXBTcGhlcmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHVwZGF0ZUtleSgpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSB0aGlzLm1hdGVyaWFsO1xuICAgICAgICB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXSA9IGdldEtleSh0aGlzLmxheWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobWF0ZXJpYWwuYWxwaGFUb0NvdmVyYWdlIHx8IG1hdGVyaWFsLmFscGhhVGVzdCkgPyBCTEVORF9OT1JNQUwgOiBtYXRlcmlhbC5ibGVuZFR5cGUsIC8vIHJlbmRlciBhbHBoYXRlc3QvYXRvYyBhZnRlciBvcGFxdWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UsIG1hdGVyaWFsLmlkKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHVwIHtAbGluayBNZXNoSW5zdGFuY2V9IHRvIGJlIHJlbmRlcmVkIHVzaW5nIEhhcmR3YXJlIEluc3RhbmNpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlcnRleEJ1ZmZlcnxudWxsfSB2ZXJ0ZXhCdWZmZXIgLSBWZXJ0ZXggYnVmZmVyIHRvIGhvbGQgcGVyLWluc3RhbmNlIHZlcnRleCBkYXRhXG4gICAgICogKHVzdWFsbHkgd29ybGQgbWF0cmljZXMpLiBQYXNzIG51bGwgdG8gdHVybiBvZmYgaGFyZHdhcmUgaW5zdGFuY2luZy5cbiAgICAgKi9cbiAgICBzZXRJbnN0YW5jaW5nKHZlcnRleEJ1ZmZlcikge1xuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhID0gbmV3IEluc3RhbmNpbmdEYXRhKHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcyk7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcblxuICAgICAgICAgICAgLy8gbWFyayB2ZXJ0ZXggYnVmZmVyIGFzIGluc3RhbmNpbmcgZGF0YVxuICAgICAgICAgICAgdmVydGV4QnVmZmVyLmluc3RhbmNpbmcgPSB0cnVlO1xuXG4gICAgICAgICAgICAvLyB0dXJuIG9mZiBjdWxsaW5nIC0gd2UgZG8gbm90IGRvIHBlci1pbnN0YW5jZSBjdWxsaW5nLCBhbGwgaW5zdGFuY2VzIGFyZSBzdWJtaXR0ZWQgdG8gR1BVXG4gICAgICAgICAgICB0aGlzLmN1bGwgPSBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5jdWxsID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE9idGFpbiBhIHNoYWRlciB2YXJpYW50IHJlcXVpcmVkIHRvIHJlbmRlciB0aGUgbWVzaCBpbnN0YW5jZSB3aXRoaW4gc3BlY2lmaWVkIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcGFzcyAtIFRoZSByZW5kZXIgcGFzcy5cbiAgICAgKiBAcGFyYW0ge2FueX0gc3RhdGljTGlnaHRMaXN0IC0gTGlzdCBvZiBzdGF0aWMgbGlnaHRzLlxuICAgICAqIEBwYXJhbSB7YW55fSBzb3J0ZWRMaWdodHMgLSBBcnJheSBvZiBhcnJheXMgb2YgbGlnaHRzLlxuICAgICAqIEBwYXJhbSB7VW5pZm9ybUJ1ZmZlckZvcm1hdH0gdmlld1VuaWZvcm1Gb3JtYXQgLSBUSGUgZm9ybWF0IG9mIHRoZSB2aWV3IHVuaWZvcm0gYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7QmluZEdyb3VwRm9ybWF0fSB2aWV3QmluZEdyb3VwRm9ybWF0IC0gVGhlIGZvcm1hdCBvZiB0aGUgdmlldyBiaW5kIGdyb3VwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBzdGF0aWNMaWdodExpc3QsIHNvcnRlZExpZ2h0cywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpIHtcbiAgICAgICAgdGhpcy5fc2hhZGVyW3Bhc3NdID0gdGhpcy5tYXRlcmlhbC5nZXRTaGFkZXJWYXJpYW50KHRoaXMubWVzaC5kZXZpY2UsIHNjZW5lLCB0aGlzLl9zaGFkZXJEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpZXdVbmlmb3JtRm9ybWF0LCB2aWV3QmluZEdyb3VwRm9ybWF0KTtcbiAgICB9XG5cbiAgICBlbnN1cmVNYXRlcmlhbChkZXZpY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1hdGVyaWFsKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBNZXNoIGF0dGFjaGVkIHRvIGVudGl0eSAnJHt0aGlzLm5vZGUubmFtZX0nIGRvZXMgbm90IGhhdmUgYSBtYXRlcmlhbCwgdXNpbmcgYSBkZWZhdWx0IG9uZS5gKTtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwgPSBnZXREZWZhdWx0TWF0ZXJpYWwoZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFBhcmFtZXRlciBtYW5hZ2VtZW50XG4gICAgY2xlYXJQYXJhbWV0ZXJzKCkge1xuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcbiAgICB9XG5cbiAgICBnZXRQYXJhbWV0ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgc3BlY2lmaWVkIHNoYWRlciBwYXJhbWV0ZXIgZnJvbSBhIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gcXVlcnkuXG4gICAgICogQHJldHVybnMge29iamVjdH0gVGhlIG5hbWVkIHBhcmFtZXRlci5cbiAgICAgKi9cbiAgICBnZXRQYXJhbWV0ZXIobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgYSBzaGFkZXIgcGFyYW1ldGVyIG9uIGEgbWVzaCBpbnN0YW5jZS4gTm90ZSB0aGF0IHRoaXMgcGFyYW1ldGVyIHdpbGwgdGFrZSBwcmVjZWRlbmNlXG4gICAgICogb3ZlciBwYXJhbWV0ZXIgb2YgdGhlIHNhbWUgbmFtZSBpZiBzZXQgb24gTWF0ZXJpYWwgdGhpcyBtZXNoIGluc3RhbmNlIHVzZXMgZm9yIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVtYmVyW118VGV4dHVyZX0gZGF0YSAtIFRoZSB2YWx1ZSBmb3IgdGhlIHNwZWNpZmllZCBwYXJhbWV0ZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtwYXNzRmxhZ3NdIC0gTWFzayBkZXNjcmliaW5nIHdoaWNoIHBhc3NlcyB0aGUgbWF0ZXJpYWwgc2hvdWxkIGJlIGluY2x1ZGVkXG4gICAgICogaW4uXG4gICAgICovXG4gICAgc2V0UGFyYW1ldGVyKG5hbWUsIGRhdGEsIHBhc3NGbGFncyA9IC0yNjIxNDEpIHtcblxuICAgICAgICAvLyBub3RlIG9uIC0yNjIxNDE6IEFsbCBiaXRzIHNldCBleGNlcHQgMiAtIDE5IHJhbmdlXG5cbiAgICAgICAgaWYgKGRhdGEgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGNvbnN0IHVuaWZvcm1PYmplY3QgPSBuYW1lO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1PYmplY3QubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB1bmlmb3JtT2JqZWN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyKHVuaWZvcm1PYmplY3RbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuYW1lID0gdW5pZm9ybU9iamVjdC5uYW1lO1xuICAgICAgICAgICAgZGF0YSA9IHVuaWZvcm1PYmplY3QudmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwYXJhbSA9IHRoaXMucGFyYW1ldGVyc1tuYW1lXTtcbiAgICAgICAgaWYgKHBhcmFtKSB7XG4gICAgICAgICAgICBwYXJhbS5kYXRhID0gZGF0YTtcbiAgICAgICAgICAgIHBhcmFtLnBhc3NGbGFncyA9IHBhc3NGbGFncztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucGFyYW1ldGVyc1tuYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBzY29wZUlkOiBudWxsLFxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGEsXG4gICAgICAgICAgICAgICAgcGFzc0ZsYWdzOiBwYXNzRmxhZ3NcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhIHdyYXBwZXIgb3ZlciBzZXR0aW5ncyBwYXJhbWV0ZXIgc3BlY2lmaWNhbGx5IGZvciByZWFsdGltZSBiYWtlZCBsaWdodG1hcHMuIFRoaXMgaGFuZGxlcyByZWZlcmVuY2UgY291bnRpbmcgb2YgbGlnaHRtYXBzXG4gICAgLy8gYW5kIHJlbGVhc2VzIHRoZW0gd2hlbiBubyBsb25nZXIgcmVmZXJlbmNlZFxuICAgIHNldFJlYWx0aW1lTGlnaHRtYXAobmFtZSwgdGV4dHVyZSkge1xuXG4gICAgICAgIC8vIG5vIGNoYW5nZVxuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLmdldFBhcmFtZXRlcihuYW1lKTtcbiAgICAgICAgaWYgKG9sZCA9PT0gdGV4dHVyZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyByZW1vdmUgb2xkXG4gICAgICAgIGlmIChvbGQpIHtcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuZGVjUmVmKG9sZC5kYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzc2lnbiBuZXdcbiAgICAgICAgaWYgKHRleHR1cmUpIHtcbiAgICAgICAgICAgIExpZ2h0bWFwQ2FjaGUuaW5jUmVmKHRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXIobmFtZSwgdGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmRlbGV0ZVBhcmFtZXRlcihuYW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICAvKipcbiAgICAgICogRGVsZXRlcyBhIHNoYWRlciBwYXJhbWV0ZXIgb24gYSBtZXNoIGluc3RhbmNlLlxuICAgICAgKlxuICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBwYXJhbWV0ZXIgdG8gZGVsZXRlLlxuICAgICAgKi9cbiAgICBkZWxldGVQYXJhbWV0ZXIobmFtZSkge1xuICAgICAgICBpZiAodGhpcy5wYXJhbWV0ZXJzW25hbWVdKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5wYXJhbWV0ZXJzW25hbWVdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gdXNlZCB0byBhcHBseSBwYXJhbWV0ZXJzIGZyb20gdGhpcyBtZXNoIGluc3RhbmNlIGludG8gc2NvcGUgb2YgdW5pZm9ybXMsIGNhbGxlZCBpbnRlcm5hbGx5IGJ5IGZvcndhcmQtcmVuZGVyZXJcbiAgICBzZXRQYXJhbWV0ZXJzKGRldmljZSwgcGFzc0ZsYWcpIHtcbiAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHRoaXMucGFyYW1ldGVycztcbiAgICAgICAgZm9yIChjb25zdCBwYXJhbU5hbWUgaW4gcGFyYW1ldGVycykge1xuICAgICAgICAgICAgY29uc3QgcGFyYW1ldGVyID0gcGFyYW1ldGVyc1twYXJhbU5hbWVdO1xuICAgICAgICAgICAgaWYgKHBhcmFtZXRlci5wYXNzRmxhZ3MgJiBwYXNzRmxhZykge1xuICAgICAgICAgICAgICAgIGlmICghcGFyYW1ldGVyLnNjb3BlSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1ldGVyLnNjb3BlSWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZShwYXJhbU5hbWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwYXJhbWV0ZXIuc2NvcGVJZC5zZXRWYWx1ZShwYXJhbWV0ZXIuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRMaWdodG1hcHBlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMubWFzayA9ICh0aGlzLm1hc2sgfCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCkgJiB+KE1BU0tfQUZGRUNUX0RZTkFNSUMgfCBNQVNLX0JBS0UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMF0sIG51bGwpO1xuICAgICAgICAgICAgdGhpcy5zZXRSZWFsdGltZUxpZ2h0bWFwKE1lc2hJbnN0YW5jZS5saWdodG1hcFBhcmFtTmFtZXNbMV0sIG51bGwpO1xuICAgICAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyAmPSB+KFNIQURFUkRFRl9MTSB8IFNIQURFUkRFRl9ESVJMTSB8IFNIQURFUkRFRl9MTUFNQklFTlQpO1xuICAgICAgICAgICAgdGhpcy5tYXNrID0gKHRoaXMubWFzayB8IE1BU0tfQUZGRUNUX0RZTkFNSUMpICYgfihNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCB8IE1BU0tfQkFLRSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDdXN0b21BYWJiKGFhYmIpIHtcblxuICAgICAgICBpZiAoYWFiYikge1xuICAgICAgICAgICAgLy8gc3RvcmUgdGhlIG92ZXJyaWRlIGFhYmJcbiAgICAgICAgICAgIGlmICh0aGlzLl9jdXN0b21BYWJiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY3VzdG9tQWFiYi5jb3B5KGFhYmIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gYWFiYi5jbG9uZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gb3ZlcnJpZGUsIGZvcmNlIHJlZnJlc2ggdGhlIGFjdHVhbCBvbmVcbiAgICAgICAgICAgIHRoaXMuX2N1c3RvbUFhYmIgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fYWFiYlZlciA9IC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2V0dXBTa2luVXBkYXRlKCk7XG4gICAgfVxuXG4gICAgX3NldHVwU2tpblVwZGF0ZSgpIHtcblxuICAgICAgICAvLyBzZXQgaWYgYm9uZXMgbmVlZCB0byBiZSB1cGRhdGVkIGJlZm9yZSBjdWxsaW5nXG4gICAgICAgIGlmICh0aGlzLl9za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZS5fdXBkYXRlQmVmb3JlQ3VsbCA9ICF0aGlzLl9jdXN0b21BYWJiO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRLZXkobGF5ZXIsIGJsZW5kVHlwZSwgaXNDb21tYW5kLCBtYXRlcmlhbElkKSB7XG4gICAgLy8gS2V5IGRlZmluaXRpb246XG4gICAgLy8gQml0XG4gICAgLy8gMzEgICAgICA6IHNpZ24gYml0IChsZWF2ZSlcbiAgICAvLyAyNyAtIDMwIDogbGF5ZXJcbiAgICAvLyAyNiAgICAgIDogdHJhbnNsdWNlbmN5IHR5cGUgKG9wYXF1ZS90cmFuc3BhcmVudClcbiAgICAvLyAyNSAgICAgIDogQ29tbWFuZCBiaXQgKDE6IHRoaXMga2V5IGlzIGZvciBhIGNvbW1hbmQsIDA6IGl0J3MgYSBtZXNoIGluc3RhbmNlKVxuICAgIC8vIDAgLSAyNCAgOiBNYXRlcmlhbCBJRCAoaWYgb3BhcXVlKSBvciAwIChpZiB0cmFuc3BhcmVudCAtIHdpbGwgYmUgZGVwdGgpXG4gICAgcmV0dXJuICgobGF5ZXIgJiAweDBmKSA8PCAyNykgfFxuICAgICAgICAgICAoKGJsZW5kVHlwZSA9PT0gQkxFTkRfTk9ORSA/IDEgOiAwKSA8PCAyNikgfFxuICAgICAgICAgICAoKGlzQ29tbWFuZCA/IDEgOiAwKSA8PCAyNSkgfFxuICAgICAgICAgICAoKG1hdGVyaWFsSWQgJiAweDFmZmZmZmYpIDw8IDApO1xufVxuXG5leHBvcnQgeyBDb21tYW5kLCBNZXNoSW5zdGFuY2UgfTtcbiJdLCJuYW1lcyI6WyJfdG1wQWFiYiIsIkJvdW5kaW5nQm94IiwiX3RlbXBCb25lQWFiYiIsIl90ZW1wU3BoZXJlIiwiQm91bmRpbmdTcGhlcmUiLCJfbWVzaFNldCIsIlNldCIsIkluc3RhbmNpbmdEYXRhIiwiY29uc3RydWN0b3IiLCJudW1PYmplY3RzIiwidmVydGV4QnVmZmVyIiwiY291bnQiLCJDb21tYW5kIiwibGF5ZXIiLCJibGVuZFR5cGUiLCJjb21tYW5kIiwiX2tleSIsIlNPUlRLRVlfRk9SV0FSRCIsImdldEtleSIsImtleSIsInZhbCIsIk1lc2hJbnN0YW5jZSIsIm1lc2giLCJtYXRlcmlhbCIsIm5vZGUiLCJfbWF0ZXJpYWwiLCJfc2hhZGVyIiwiX2JpbmRHcm91cHMiLCJHcmFwaE5vZGUiLCJ0ZW1wIiwiaXNTdGF0aWMiLCJfc3RhdGljTGlnaHRMaXN0IiwiX3N0YXRpY1NvdXJjZSIsIl9tZXNoIiwiaW5jUmVmQ291bnQiLCJfc2hhZGVyRGVmcyIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJmb3JtYXQiLCJoYXNVdjAiLCJTSEFERVJERUZfVVYwIiwiaGFzVXYxIiwiU0hBREVSREVGX1VWMSIsImhhc0NvbG9yIiwiU0hBREVSREVGX1ZDT0xPUiIsImhhc1RhbmdlbnRzIiwiU0hBREVSREVGX1RBTkdFTlRTIiwiX2xpZ2h0SGFzaCIsInZpc2libGUiLCJMQVlFUl9XT1JMRCIsIl9yZW5kZXJTdHlsZSIsIlJFTkRFUlNUWUxFX1NPTElEIiwiY2FzdFNoYWRvdyIsIl9yZWNlaXZlU2hhZG93IiwiX3NjcmVlblNwYWNlIiwiX25vRGVwdGhEcmF3R2wxIiwiY3VsbCIsInBpY2siLCJfdXBkYXRlQWFiYiIsIl91cGRhdGVBYWJiRnVuYyIsIl9jYWxjdWxhdGVTb3J0RGlzdGFuY2UiLCJ1cGRhdGVLZXkiLCJfc2tpbkluc3RhbmNlIiwiX21vcnBoSW5zdGFuY2UiLCJpbnN0YW5jaW5nRGF0YSIsIl9jdXN0b21BYWJiIiwiYWFiYiIsIl9hYWJiVmVyIiwiZHJhd09yZGVyIiwidmlzaWJsZVRoaXNGcmFtZSIsImlzVmlzaWJsZUZ1bmMiLCJwYXJhbWV0ZXJzIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJmbGlwRmFjZXMiLCJyZW5kZXJTdHlsZSIsInByZXBhcmVSZW5kZXJTdGF0ZSIsImRlY1JlZkNvdW50IiwiX2FhYmIiLCJsb2NhbEFhYmIiLCJ0b1dvcmxkU3BhY2UiLCJza2luSW5zdGFuY2UiLCJib25lQWFiYiIsIm1vcnBoVGFyZ2V0cyIsIm1vcnBoIiwiX3RhcmdldHMiLCJfaW5pdEJvbmVBYWJicyIsImJvbmVVc2VkIiwiZmlyc3QiLCJpIiwibGVuZ3RoIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsIm1hdHJpY2VzIiwiY2VudGVyIiwiY29weSIsImhhbGZFeHRlbnRzIiwiYWRkIiwic2V0IiwiX2V4cGFuZCIsImdldE1pbiIsImdldE1heCIsImdldFdvcmxkVHJhbnNmb3JtIiwiY2xlYXJTaGFkZXJzIiwic2hhZGVycyIsImRlc3Ryb3lCaW5kR3JvdXBzIiwiZ3JvdXBzIiwiZ3JvdXAiLCJ1bmlmb3JtQnVmZmVyIiwiZGVmYXVsdFVuaWZvcm1CdWZmZXIiLCJkZXN0cm95IiwiZ2V0QmluZEdyb3VwIiwiZGV2aWNlIiwicGFzcyIsImJpbmRHcm91cCIsInNoYWRlciIsIkRlYnVnIiwiYXNzZXJ0IiwidWJGb3JtYXQiLCJtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIlVuaWZvcm1CdWZmZXIiLCJiaW5nR3JvdXBGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwiQmluZEdyb3VwIiwicHJldk1hdCIsInJlbW92ZU1lc2hJbnN0YW5jZVJlZiIsImFkZE1lc2hJbnN0YW5jZVJlZiIsInByZXZCbGVuZCIsInRyYW5zcGFyZW50Iiwic2NlbmUiLCJfc2NlbmUiLCJsYXllcnMiLCJfZGlydHlCbGVuZCIsIl9sYXllciIsImNhbGN1bGF0ZVNvcnREaXN0YW5jZSIsInJlY2VpdmVTaGFkb3ciLCJTSEFERVJERUZfTk9TSEFET1ciLCJTSEFERVJfRk9SV0FSRCIsIlNIQURFUl9GT1JXQVJESERSIiwic2hhZGVyRGVmcyIsIlNIQURFUkRFRl9TS0lOIiwiX3NldHVwU2tpblVwZGF0ZSIsIm1vcnBoSW5zdGFuY2UiLCJ1c2VUZXh0dXJlTW9ycGgiLCJTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCIsIm1vcnBoUG9zaXRpb25zIiwiU0hBREVSREVGX01PUlBIX1BPU0lUSU9OIiwibW9ycGhOb3JtYWxzIiwiU0hBREVSREVGX01PUlBIX05PUk1BTCIsInNjcmVlblNwYWNlIiwiU0hBREVSREVGX1NDUkVFTlNQQUNFIiwibWFzayIsInRvZ2dsZXMiLCJpbnN0YW5jaW5nQ291bnQiLCJ2YWx1ZSIsInJlZkNvdW50Iiwic2V0UmVhbHRpbWVMaWdodG1hcCIsImxpZ2h0bWFwUGFyYW1OYW1lcyIsIl9wcmVwYXJlUmVuZGVyU3R5bGVGb3JBcnJheSIsIm1lc2hJbnN0YW5jZXMiLCJoYXMiLCJjbGVhciIsIl9pc1Zpc2libGUiLCJjYW1lcmEiLCJyYWRpdXMiLCJmcnVzdHVtIiwiY29udGFpbnNTcGhlcmUiLCJhbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRlc3QiLCJCTEVORF9OT1JNQUwiLCJpZCIsInNldEluc3RhbmNpbmciLCJudW1WZXJ0aWNlcyIsImluc3RhbmNpbmciLCJ1cGRhdGVQYXNzU2hhZGVyIiwic3RhdGljTGlnaHRMaXN0Iiwic29ydGVkTGlnaHRzIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwiZ2V0U2hhZGVyVmFyaWFudCIsImVuc3VyZU1hdGVyaWFsIiwid2FybiIsIm5hbWUiLCJnZXREZWZhdWx0TWF0ZXJpYWwiLCJjbGVhclBhcmFtZXRlcnMiLCJnZXRQYXJhbWV0ZXJzIiwiZ2V0UGFyYW1ldGVyIiwic2V0UGFyYW1ldGVyIiwiZGF0YSIsInBhc3NGbGFncyIsInVuZGVmaW5lZCIsInVuaWZvcm1PYmplY3QiLCJwYXJhbSIsInNjb3BlSWQiLCJ0ZXh0dXJlIiwib2xkIiwiTGlnaHRtYXBDYWNoZSIsImRlY1JlZiIsImluY1JlZiIsImRlbGV0ZVBhcmFtZXRlciIsInNldFBhcmFtZXRlcnMiLCJwYXNzRmxhZyIsInBhcmFtTmFtZSIsInBhcmFtZXRlciIsInNjb3BlIiwicmVzb2x2ZSIsInNldFZhbHVlIiwic2V0TGlnaHRtYXBwZWQiLCJNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCIsIk1BU0tfQkFLRSIsIlNIQURFUkRFRl9MTSIsIlNIQURFUkRFRl9ESVJMTSIsIlNIQURFUkRFRl9MTUFNQklFTlQiLCJzZXRDdXN0b21BYWJiIiwiY2xvbmUiLCJfdXBkYXRlQmVmb3JlQ3VsbCIsImlzQ29tbWFuZCIsIm1hdGVyaWFsSWQiLCJCTEVORF9OT05FIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFxQ0EsTUFBTUEsUUFBUSxHQUFHLElBQUlDLFdBQUosRUFBakIsQ0FBQTs7QUFDQSxNQUFNQyxhQUFhLEdBQUcsSUFBSUQsV0FBSixFQUF0QixDQUFBOztBQUNBLE1BQU1FLFdBQVcsR0FBRyxJQUFJQyxjQUFKLEVBQXBCLENBQUE7O0FBQ0EsTUFBTUMsUUFBUSxHQUFHLElBQUlDLEdBQUosRUFBakIsQ0FBQTs7QUFRQSxNQUFNQyxjQUFOLENBQXFCO0VBT2pCQyxXQUFXLENBQUNDLFVBQUQsRUFBYTtJQUFBLElBTHhCQyxDQUFBQSxZQUt3QixHQUxULElBS1MsQ0FBQTtJQUNwQixJQUFLQyxDQUFBQSxLQUFMLEdBQWFGLFVBQWIsQ0FBQTtBQUNILEdBQUE7O0FBVGdCLENBQUE7O0FBWXJCLE1B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
