/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
      DebugHelper.setName(bindGroup, `MeshBindGroup_${bindGroup.id}`);
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

      vertexBuffer.format.instancing = true;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVzaC1pbnN0YW5jZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3NjZW5lL21lc2gtaW5zdGFuY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcsIERlYnVnSGVscGVyIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5cbmltcG9ydCB7IEJpbmRHcm91cCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMnO1xuaW1wb3J0IHsgVW5pZm9ybUJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3VuaWZvcm0tYnVmZmVyLmpzJztcblxuaW1wb3J0IHtcbiAgICBCTEVORF9OT05FLCBCTEVORF9OT1JNQUwsXG4gICAgTEFZRVJfV09STEQsXG4gICAgTUFTS19BRkZFQ1RfRFlOQU1JQywgTUFTS19CQUtFLCBNQVNLX0FGRkVDVF9MSUdIVE1BUFBFRCxcbiAgICBSRU5ERVJTVFlMRV9TT0xJRCxcbiAgICBTSEFERVJfRk9SV0FSRCwgU0hBREVSX0ZPUldBUkRIRFIsXG4gICAgU0hBREVSREVGX1VWMCwgU0hBREVSREVGX1VWMSwgU0hBREVSREVGX1ZDT0xPUiwgU0hBREVSREVGX1RBTkdFTlRTLCBTSEFERVJERUZfTk9TSEFET1csIFNIQURFUkRFRl9TS0lOLFxuICAgIFNIQURFUkRFRl9TQ1JFRU5TUEFDRSwgU0hBREVSREVGX01PUlBIX1BPU0lUSU9OLCBTSEFERVJERUZfTU9SUEhfTk9STUFMLCBTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCxcbiAgICBTSEFERVJERUZfTE0sIFNIQURFUkRFRl9ESVJMTSwgU0hBREVSREVGX0xNQU1CSUVOVCxcbiAgICBTT1JUS0VZX0ZPUldBUkRcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdE1hdGVyaWFsIH0gZnJvbSAnLi9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBMaWdodG1hcENhY2hlIH0gZnJvbSAnLi9ncmFwaGljcy9saWdodG1hcC1jYWNoZS5qcyc7XG5cbmNvbnN0IF90bXBBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcEJvbmVBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG5jb25zdCBfdGVtcFNwaGVyZSA9IG5ldyBCb3VuZGluZ1NwaGVyZSgpO1xuY29uc3QgX21lc2hTZXQgPSBuZXcgU2V0KCk7XG5cbi8qKlxuICogSW50ZXJuYWwgZGF0YSBzdHJ1Y3R1cmUgdXNlZCB0byBzdG9yZSBkYXRhIHVzZWQgYnkgaGFyZHdhcmUgaW5zdGFuY2luZy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIEluc3RhbmNpbmdEYXRhIHtcbiAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcnxudWxsfSAqL1xuICAgIHZlcnRleEJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtT2JqZWN0cyAtIFRoZSBudW1iZXIgb2Ygb2JqZWN0cyBpbnN0YW5jZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobnVtT2JqZWN0cykge1xuICAgICAgICB0aGlzLmNvdW50ID0gbnVtT2JqZWN0cztcbiAgICB9XG59XG5cbmNsYXNzIENvbW1hbmQge1xuICAgIGNvbnN0cnVjdG9yKGxheWVyLCBibGVuZFR5cGUsIGNvbW1hbmQpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0gW107XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gZ2V0S2V5KGxheWVyLCBibGVuZFR5cGUsIHRydWUsIDApO1xuICAgICAgICB0aGlzLmNvbW1hbmQgPSBjb21tYW5kO1xuICAgIH1cblxuICAgIHNldCBrZXkodmFsKSB7XG4gICAgICAgIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdID0gdmFsO1xuICAgIH1cblxuICAgIGdldCBrZXkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXTtcbiAgICB9XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgTGF5ZXJ9IHRvIGNhbGN1bGF0ZSB0aGUgXCJzb3J0IGRpc3RhbmNlXCIgZm9yIGEge0BsaW5rIE1lc2hJbnN0YW5jZX0sXG4gKiB3aGljaCBkZXRlcm1pbmVzIGl0cyBwbGFjZSBpbiB0aGUgcmVuZGVyIG9yZGVyLlxuICpcbiAqIEBjYWxsYmFjayBDYWxjdWxhdGVTb3J0RGlzdGFuY2VDYWxsYmFja1xuICogQHBhcmFtIHtNZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlLlxuICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvcmUvbWF0aC92ZWMzLmpzJykuVmVjM30gY2FtZXJhUG9zaXRpb24gLSBUaGUgcG9zaXRpb24gb2YgdGhlIGNhbWVyYS5cbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb3JlL21hdGgvdmVjMy5qcycpLlZlYzN9IGNhbWVyYUZvcndhcmQgLSBUaGUgZm9yd2FyZCB2ZWN0b3Igb2YgdGhlIGNhbWVyYS5cbiAqL1xuXG4vKipcbiAqIEFuIGluc3RhbmNlIG9mIGEge0BsaW5rIGltcG9ydCgnLi9tZXNoLmpzJykuTWVzaH0uIEEgc2luZ2xlIG1lc2ggY2FuIGJlIHJlZmVyZW5jZWQgYnkgbWFueSBtZXNoXG4gKiBpbnN0YW5jZXMgdGhhdCBjYW4gaGF2ZSBkaWZmZXJlbnQgdHJhbnNmb3JtcyBhbmQgbWF0ZXJpYWxzLlxuICovXG5jbGFzcyBNZXNoSW5zdGFuY2Uge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWw7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBzaGFkZXJzIHVzZWQgYnkgdGhlIG1lc2ggaW5zdGFuY2UsIGluZGV4ZWQgYnkgdGhlIHNoYWRlciBwYXNzIGNvbnN0YW50IChTSEFERVJfRk9SV0FSRC4uKVxuICAgICAqXG4gICAgICogQHR5cGUge0FycmF5PGltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzJykuU2hhZGVyPn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3NoYWRlciA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgYmluZCBncm91cHMsIHN0b3JpbmcgdW5pZm9ybXMgcGVyIHBhc3MuIFRoaXMgaGFzIDE6MSByZWxhdGlvbiB3aXRoIHRoZSBfc2hhZGVzIGFycmF5LFxuICAgICAqIGFuZCBpcyBpbmRleGVkIGJ5IHRoZSBzaGFkZXIgcGFzcyBjb25zdGFudCBhcyB3ZWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge0FycmF5PEJpbmRHcm91cD59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9iaW5kR3JvdXBzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTWVzaEluc3RhbmNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vbWVzaC5qcycpLk1lc2h9IG1lc2ggLSBUaGUgZ3JhcGhpY3MgbWVzaCB0byBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnKS5NYXRlcmlhbH0gbWF0ZXJpYWwgLSBUaGUgbWF0ZXJpYWwgdG8gdXNlIGZvciB0aGlzXG4gICAgICogbWVzaCBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge0dyYXBoTm9kZX0gW25vZGVdIC0gVGhlIGdyYXBoIG5vZGUgZGVmaW5pbmcgdGhlIHRyYW5zZm9ybSBmb3IgdGhpcyBpbnN0YW5jZS4gVGhpc1xuICAgICAqIHBhcmFtZXRlciBpcyBvcHRpb25hbCB3aGVuIHVzZWQgd2l0aCB7QGxpbmsgUmVuZGVyQ29tcG9uZW50fSBhbmQgd2lsbCB1c2UgdGhlIG5vZGUgdGhlXG4gICAgICogY29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgbWVzaCBpbnN0YW5jZSBwb2ludGluZyB0byBhIDF4MXgxICdjdWJlJyBtZXNoXG4gICAgICogdmFyIG1lc2ggPSBwYy5jcmVhdGVCb3goZ3JhcGhpY3NEZXZpY2UpO1xuICAgICAqIHZhciBtYXRlcmlhbCA9IG5ldyBwYy5TdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICpcbiAgICAgKiB2YXIgbWVzaEluc3RhbmNlID0gbmV3IHBjLk1lc2hJbnN0YW5jZShtZXNoLCBtYXRlcmlhbCk7XG4gICAgICpcbiAgICAgKiB2YXIgZW50aXR5ID0gbmV3IHBjLkVudGl0eSgpO1xuICAgICAqIGVudGl0eS5hZGRDb21wb25lbnQoJ3JlbmRlcicsIHtcbiAgICAgKiAgICAgbWVzaEluc3RhbmNlczogW21lc2hJbnN0YW5jZV1cbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCB0aGUgZW50aXR5IHRvIHRoZSBzY2VuZSBoaWVyYXJjaHlcbiAgICAgKiB0aGlzLmFwcC5zY2VuZS5yb290LmFkZENoaWxkKGVudGl0eSk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IobWVzaCwgbWF0ZXJpYWwsIG5vZGUgPSBudWxsKSB7XG4gICAgICAgIC8vIGlmIGZpcnN0IHBhcmFtZXRlciBpcyBvZiBHcmFwaE5vZGUgdHlwZSwgaGFuZGxlIHByZXZpb3VzIGNvbnN0cnVjdG9yIHNpZ25hdHVyZTogKG5vZGUsIG1lc2gsIG1hdGVyaWFsKVxuICAgICAgICBpZiAobWVzaCBpbnN0YW5jZW9mIEdyYXBoTm9kZSkge1xuICAgICAgICAgICAgY29uc3QgdGVtcCA9IG1lc2g7XG4gICAgICAgICAgICBtZXNoID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IG5vZGU7XG4gICAgICAgICAgICBub2RlID0gdGVtcDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2tleSA9IFswLCAwXTtcblxuICAgICAgICB0aGlzLmlzU3RhdGljID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3N0YXRpY0xpZ2h0TGlzdCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3N0YXRpY1NvdXJjZSA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBncmFwaCBub2RlIGRlZmluaW5nIHRoZSB0cmFuc2Zvcm0gZm9yIHRoaXMgaW5zdGFuY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtHcmFwaE5vZGV9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5vZGUgPSBub2RlOyAgICAgICAgICAgLy8gVGhlIG5vZGUgdGhhdCBkZWZpbmVzIHRoZSB0cmFuc2Zvcm0gb2YgdGhlIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgdGhpcy5fbWVzaCA9IG1lc2g7ICAgICAgICAgIC8vIFRoZSBtZXNoIHRoYXQgdGhpcyBpbnN0YW5jZSByZW5kZXJzXG4gICAgICAgIG1lc2guaW5jUmVmQ291bnQoKTtcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG1hdGVyaWFsOyAgIC8vIFRoZSBtYXRlcmlhbCB3aXRoIHdoaWNoIHRvIHJlbmRlciB0aGlzIGluc3RhbmNlXG5cbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyA9IE1BU0tfQUZGRUNUX0RZTkFNSUMgPDwgMTY7IC8vIDIgYnl0ZSB0b2dnbGVzLCAyIGJ5dGVzIGxpZ2h0IG1hc2s7IERlZmF1bHQgdmFsdWUgaXMgbm8gdG9nZ2xlcyBhbmQgbWFzayA9IHBjLk1BU0tfQUZGRUNUX0RZTkFNSUNcbiAgICAgICAgdGhpcy5fc2hhZGVyRGVmcyB8PSBtZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuaGFzVXYwID8gU0hBREVSREVGX1VWMCA6IDA7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgfD0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmhhc1V2MSA/IFNIQURFUkRFRl9VVjEgOiAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzIHw9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNDb2xvciA/IFNIQURFUkRFRl9WQ09MT1IgOiAwO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzIHw9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5oYXNUYW5nZW50cyA/IFNIQURFUkRFRl9UQU5HRU5UUyA6IDA7XG5cbiAgICAgICAgdGhpcy5fbGlnaHRIYXNoID0gMDtcblxuICAgICAgICAvLyBSZW5kZXIgb3B0aW9uc1xuICAgICAgICAvKipcbiAgICAgICAgICogRW5hYmxlIHJlbmRlcmluZyBmb3IgdGhpcyBtZXNoIGluc3RhbmNlLiBVc2UgdmlzaWJsZSBwcm9wZXJ0eSB0byBlbmFibGUvZGlzYWJsZVxuICAgICAgICAgKiByZW5kZXJpbmcgd2l0aG91dCBvdmVyaGVhZCBvZiByZW1vdmluZyBmcm9tIHNjZW5lLiBCdXQgbm90ZSB0aGF0IHRoZSBtZXNoIGluc3RhbmNlIGlzXG4gICAgICAgICAqIHN0aWxsIGluIHRoZSBoaWVyYXJjaHkgYW5kIHN0aWxsIGluIHRoZSBkcmF3IGNhbGwgbGlzdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnZpc2libGUgPSB0cnVlO1xuICAgICAgICB0aGlzLmxheWVyID0gTEFZRVJfV09STEQ7IC8vIGxlZ2FjeVxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fcmVuZGVyU3R5bGUgPSBSRU5ERVJTVFlMRV9TT0xJRDtcbiAgICAgICAgdGhpcy5jYXN0U2hhZG93ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3JlY2VpdmVTaGFkb3cgPSB0cnVlO1xuICAgICAgICB0aGlzLl9zY3JlZW5TcGFjZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9ub0RlcHRoRHJhd0dsMSA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb250cm9scyB3aGV0aGVyIHRoZSBtZXNoIGluc3RhbmNlIGNhbiBiZSBjdWxsZWQgYnkgZnJ1c3R1bSBjdWxsaW5nXG4gICAgICAgICAqICh7QGxpbmsgQ2FtZXJhQ29tcG9uZW50I2ZydXN0dW1DdWxsaW5nfSkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdWxsID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJ1ZSBpZiB0aGUgbWVzaCBpbnN0YW5jZSBpcyBwaWNrYWJsZSBieSB0aGUge0BsaW5rIFBpY2tlcn0uIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnBpY2sgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmIgPSB0cnVlO1xuICAgICAgICB0aGlzLl91cGRhdGVBYWJiRnVuYyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNvcnREaXN0YW5jZSA9IG51bGw7XG5cbiAgICAgICAgLy8gNjQtYml0IGludGVnZXIga2V5IHRoYXQgZGVmaW5lcyByZW5kZXIgb3JkZXIgb2YgdGhpcyBtZXNoIGluc3RhbmNlXG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc2tpbi1pbnN0YW5jZS5qcycpLlNraW5JbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NraW5JbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21vcnBoLWluc3RhbmNlLmpzJykuTW9ycGhJbnN0YW5jZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuaW5zdGFuY2luZ0RhdGEgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gbnVsbDtcblxuICAgICAgICAvLyBXb3JsZCBzcGFjZSBBQUJCXG4gICAgICAgIHRoaXMuYWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICB0aGlzLl9hYWJiVmVyID0gLTE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZSB0aGlzIHZhbHVlIHRvIGFmZmVjdCByZW5kZXJpbmcgb3JkZXIgb2YgbWVzaCBpbnN0YW5jZXMuIE9ubHkgdXNlZCB3aGVuIG1lc2hcbiAgICAgICAgICogaW5zdGFuY2VzIGFyZSBhZGRlZCB0byBhIHtAbGluayBMYXllcn0gd2l0aCB7QGxpbmsgTGF5ZXIjb3BhcXVlU29ydE1vZGV9IG9yXG4gICAgICAgICAqIHtAbGluayBMYXllciN0cmFuc3BhcmVudFNvcnRNb2RlfSAoZGVwZW5kaW5nIG9uIHRoZSBtYXRlcmlhbCkgc2V0IHRvXG4gICAgICAgICAqIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZWFkIHRoaXMgdmFsdWUgaW4ge0BsaW5rIExheWVyI29uUG9zdEN1bGx9IHRvIGRldGVybWluZSBpZiB0aGUgb2JqZWN0IGlzIGFjdHVhbGx5IGdvaW5nXG4gICAgICAgICAqIHRvIGJlIHJlbmRlcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudmlzaWJsZVRoaXNGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGN1c3RvbSBmdW5jdGlvbiB1c2VkIHRvIGN1c3RvbWl6ZSBjdWxsaW5nIChlLmcuIGZvciAyRCBVSSBlbGVtZW50cylcbiAgICAgICAgdGhpcy5pc1Zpc2libGVGdW5jID0gbnVsbDtcblxuICAgICAgICB0aGlzLnBhcmFtZXRlcnMgPSB7fTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGcm9udCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3RlbmNpbEJhY2sgPSBudWxsO1xuXG4gICAgICAgIC8vIE5lZ2F0aXZlIHNjYWxlIGJhdGNoaW5nIHN1cHBvcnRcbiAgICAgICAgdGhpcy5mbGlwRmFjZXMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVuZGVyIHN0eWxlIG9mIHRoZSBtZXNoIGluc3RhbmNlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH1cbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9XSVJFRlJBTUV9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfUE9JTlRTfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFJFTkRFUlNUWUxFX1NPTElEfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlbmRlclN0eWxlKHJlbmRlclN0eWxlKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG4gICAgICAgIHRoaXMubWVzaC5wcmVwYXJlUmVuZGVyU3RhdGUocmVuZGVyU3R5bGUpO1xuICAgIH1cblxuICAgIGdldCByZW5kZXJTdHlsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclN0eWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBncmFwaGljcyBtZXNoIGJlaW5nIGluc3RhbmNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWVzaC5qcycpLk1lc2h9XG4gICAgICovXG4gICAgc2V0IG1lc2gobWVzaCkge1xuXG4gICAgICAgIGlmIChtZXNoID09PSB0aGlzLl9tZXNoKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoLmRlY1JlZkNvdW50KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tZXNoID0gbWVzaDtcblxuICAgICAgICBpZiAobWVzaCkge1xuICAgICAgICAgICAgbWVzaC5pbmNSZWZDb3VudCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1lc2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tZXNoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3b3JsZCBzcGFjZSBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94IGZvciB0aGlzIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h9XG4gICAgICovXG4gICAgc2V0IGFhYmIoYWFiYikge1xuICAgICAgICB0aGlzLl9hYWJiID0gYWFiYjtcbiAgICB9XG5cbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgLy8gdXNlIHNwZWNpZmllZCB3b3JsZCBzcGFjZSBhYWJiXG4gICAgICAgIGlmICghdGhpcy5fdXBkYXRlQWFiYikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2FhYmI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjYWxsYmFjayBmdW5jdGlvbiByZXR1cm5pbmcgd29ybGQgc3BhY2UgYWFiYlxuICAgICAgICBpZiAodGhpcy5fdXBkYXRlQWFiYkZ1bmMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl91cGRhdGVBYWJiRnVuYyh0aGlzLl9hYWJiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVzZSBsb2NhbCBzcGFjZSBvdmVycmlkZSBhYWJiIGlmIHNwZWNpZmllZFxuICAgICAgICBsZXQgbG9jYWxBYWJiID0gdGhpcy5fY3VzdG9tQWFiYjtcbiAgICAgICAgbGV0IHRvV29ybGRTcGFjZSA9ICEhbG9jYWxBYWJiO1xuXG4gICAgICAgIC8vIG90aGVyd2lzZSBldmFsdWF0ZSBsb2NhbCBhYWJiXG4gICAgICAgIGlmICghbG9jYWxBYWJiKSB7XG5cbiAgICAgICAgICAgIGxvY2FsQWFiYiA9IF90bXBBYWJiO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5za2luSW5zdGFuY2UpIHtcblxuICAgICAgICAgICAgICAgIC8vIEluaXRpYWxpemUgbG9jYWwgYm9uZSBBQUJCcyBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMubWVzaC5ib25lQWFiYikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtb3JwaFRhcmdldHMgPSB0aGlzLl9tb3JwaEluc3RhbmNlID8gdGhpcy5fbW9ycGhJbnN0YW5jZS5tb3JwaC5fdGFyZ2V0cyA6IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWVzaC5faW5pdEJvbmVBYWJicyhtb3JwaFRhcmdldHMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGV2YWx1YXRlIGxvY2FsIHNwYWNlIGJvdW5kcyBiYXNlZCBvbiBhbGwgYWN0aXZlIGJvbmVzXG4gICAgICAgICAgICAgICAgY29uc3QgYm9uZVVzZWQgPSB0aGlzLm1lc2guYm9uZVVzZWQ7XG4gICAgICAgICAgICAgICAgbGV0IGZpcnN0ID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5tZXNoLmJvbmVBYWJiLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChib25lVXNlZFtpXSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0cmFuc2Zvcm0gYm9uZSBBQUJCIGJ5IGJvbmUgbWF0cml4XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGVtcEJvbmVBYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIodGhpcy5tZXNoLmJvbmVBYWJiW2ldLCB0aGlzLnNraW5JbnN0YW5jZS5tYXRyaWNlc1tpXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGVtIHVwXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZmlyc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5jZW50ZXIuY29weShfdGVtcEJvbmVBYWJiLmNlbnRlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmhhbGZFeHRlbnRzLmNvcHkoX3RlbXBCb25lQWFiYi5oYWxmRXh0ZW50cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5hZGQoX3RlbXBCb25lQWFiYik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0b1dvcmxkU3BhY2UgPSB0cnVlO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubm9kZS5fYWFiYlZlciAhPT0gdGhpcy5fYWFiYlZlcikge1xuXG4gICAgICAgICAgICAgICAgLy8gbG9jYWwgc3BhY2UgYm91bmRpbmcgYm94IC0gZWl0aGVyIGZyb20gbWVzaCBvciBlbXB0eVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmNlbnRlci5jb3B5KHRoaXMubWVzaC5hYWJiLmNlbnRlcik7XG4gICAgICAgICAgICAgICAgICAgIGxvY2FsQWFiYi5oYWxmRXh0ZW50cy5jb3B5KHRoaXMubWVzaC5hYWJiLmhhbGZFeHRlbnRzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuY2VudGVyLnNldCgwLCAwLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxBYWJiLmhhbGZFeHRlbnRzLnNldCgwLCAwLCAwKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgbG9jYWwgc3BhY2UgYm91bmRpbmcgYm94IGJ5IG1vcnBoIHRhcmdldHNcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXNoICYmIHRoaXMubWVzaC5tb3JwaCkge1xuICAgICAgICAgICAgICAgICAgICBsb2NhbEFhYmIuX2V4cGFuZCh0aGlzLm1lc2gubW9ycGguYWFiYi5nZXRNaW4oKSwgdGhpcy5tZXNoLm1vcnBoLmFhYmIuZ2V0TWF4KCkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRvV29ybGRTcGFjZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWFiYlZlciA9IHRoaXMubm9kZS5fYWFiYlZlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHN0b3JlIHdvcmxkIHNwYWNlIGJvdW5kaW5nIGJveFxuICAgICAgICBpZiAodG9Xb3JsZFNwYWNlKSB7XG4gICAgICAgICAgICB0aGlzLl9hYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIobG9jYWxBYWJiLCB0aGlzLm5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fYWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhciB0aGUgaW50ZXJuYWwgc2hhZGVyIGFycmF5LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNsZWFyU2hhZGVycygpIHtcbiAgICAgICAgY29uc3Qgc2hhZGVycyA9IHRoaXMuX3NoYWRlcjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaGFkZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBzaGFkZXJzW2ldID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGVzdHJveUJpbmRHcm91cHMoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95QmluZEdyb3VwcygpIHtcblxuICAgICAgICBjb25zdCBncm91cHMgPSB0aGlzLl9iaW5kR3JvdXBzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdyb3Vwcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZ3JvdXAgPSBncm91cHNbaV07XG4gICAgICAgICAgICBpZiAoZ3JvdXApIHtcbiAgICAgICAgICAgICAgICBjb25zdCB1bmlmb3JtQnVmZmVyID0gZ3JvdXAuZGVmYXVsdFVuaWZvcm1CdWZmZXI7XG4gICAgICAgICAgICAgICAgaWYgKHVuaWZvcm1CdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgdW5pZm9ybUJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdyb3VwLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBncm91cHMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcGFzcyAtIFNoYWRlciBwYXNzIG51bWJlci5cbiAgICAgKiBAcmV0dXJucyB7QmluZEdyb3VwfSAtIFRoZSBtZXNoIGJpbmQgZ3JvdXAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEJpbmRHcm91cChkZXZpY2UsIHBhc3MpIHtcblxuICAgICAgICAvLyBjcmVhdGUgYmluZCBncm91cFxuICAgICAgICBsZXQgYmluZEdyb3VwID0gdGhpcy5fYmluZEdyb3Vwc1twYXNzXTtcbiAgICAgICAgaWYgKCFiaW5kR3JvdXApIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuX3NoYWRlcltwYXNzXTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChzaGFkZXIpO1xuXG4gICAgICAgICAgICAvLyBtZXNoIHVuaWZvcm0gYnVmZmVyXG4gICAgICAgICAgICBjb25zdCB1YkZvcm1hdCA9IHNoYWRlci5tZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydCh1YkZvcm1hdCk7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtQnVmZmVyID0gbmV3IFVuaWZvcm1CdWZmZXIoZGV2aWNlLCB1YkZvcm1hdCk7XG5cbiAgICAgICAgICAgIC8vIG1lc2ggYmluZCBncm91cFxuICAgICAgICAgICAgY29uc3QgYmluZ0dyb3VwRm9ybWF0ID0gc2hhZGVyLm1lc2hCaW5kR3JvdXBGb3JtYXQ7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoYmluZ0dyb3VwRm9ybWF0KTtcbiAgICAgICAgICAgIGJpbmRHcm91cCA9IG5ldyBCaW5kR3JvdXAoZGV2aWNlLCBiaW5nR3JvdXBGb3JtYXQsIHVuaWZvcm1CdWZmZXIpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TmFtZShiaW5kR3JvdXAsIGBNZXNoQmluZEdyb3VwXyR7YmluZEdyb3VwLmlkfWApO1xuXG4gICAgICAgICAgICB0aGlzLl9iaW5kR3JvdXBzW3Bhc3NdID0gYmluZEdyb3VwO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJpbmRHcm91cDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF0ZXJpYWwgdXNlZCBieSB0aGlzIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqL1xuICAgIHNldCBtYXRlcmlhbChtYXRlcmlhbCkge1xuXG4gICAgICAgIHRoaXMuY2xlYXJTaGFkZXJzKCk7XG5cbiAgICAgICAgY29uc3QgcHJldk1hdCA9IHRoaXMuX21hdGVyaWFsO1xuXG4gICAgICAgIC8vIFJlbW92ZSB0aGUgbWF0ZXJpYWwncyByZWZlcmVuY2UgdG8gdGhpcyBtZXNoIGluc3RhbmNlXG4gICAgICAgIGlmIChwcmV2TWF0KSB7XG4gICAgICAgICAgICBwcmV2TWF0LnJlbW92ZU1lc2hJbnN0YW5jZVJlZih0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gbWF0ZXJpYWw7XG5cbiAgICAgICAgaWYgKG1hdGVyaWFsKSB7XG5cbiAgICAgICAgICAgIC8vIFJlY29yZCB0aGF0IHRoZSBtYXRlcmlhbCBpcyByZWZlcmVuY2VkIGJ5IHRoaXMgbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgbWF0ZXJpYWwuYWRkTWVzaEluc3RhbmNlUmVmKHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuXG4gICAgICAgICAgICAvLyBpZiBibGVuZCB0eXBlIG9mIHRoZSBtYXRlcmlhbCBjaGFuZ2VzXG4gICAgICAgICAgICBjb25zdCBwcmV2QmxlbmQgPSBwcmV2TWF0ICYmIHByZXZNYXQudHJhbnNwYXJlbnQ7XG4gICAgICAgICAgICBpZiAobWF0ZXJpYWwudHJhbnNwYXJlbnQgIT09IHByZXZCbGVuZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5fbWF0ZXJpYWwuX3NjZW5lIHx8IHByZXZNYXQ/Ll9zY2VuZTtcbiAgICAgICAgICAgICAgICBpZiAoc2NlbmUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NlbmUubGF5ZXJzLl9kaXJ0eUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5fZGlydHlCbGVuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgc2V0IGxheWVyKGxheWVyKSB7XG4gICAgICAgIHRoaXMuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGxheWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW4gc29tZSBjaXJjdW1zdGFuY2VzIG1lc2ggaW5zdGFuY2VzIGFyZSBzb3J0ZWQgYnkgYSBkaXN0YW5jZSBjYWxjdWxhdGlvbiB0byBkZXRlcm1pbmUgdGhlaXJcbiAgICAgKiByZW5kZXJpbmcgb3JkZXIuIFNldCB0aGlzIGNhbGxiYWNrIHRvIG92ZXJyaWRlIHRoZSBkZWZhdWx0IGRpc3RhbmNlIGNhbGN1bGF0aW9uLCB3aGljaCBnaXZlc1xuICAgICAqIHRoZSBkb3QgcHJvZHVjdCBvZiB0aGUgY2FtZXJhIGZvcndhcmQgdmVjdG9yIGFuZCB0aGUgdmVjdG9yIGJldHdlZW4gdGhlIGNhbWVyYSBwb3NpdGlvbiBhbmRcbiAgICAgKiB0aGUgY2VudGVyIG9mIHRoZSBtZXNoIGluc3RhbmNlJ3MgYXhpcy1hbGlnbmVkIGJvdW5kaW5nIGJveC4gVGhpcyBvcHRpb24gY2FuIGJlIHBhcnRpY3VsYXJseVxuICAgICAqIHVzZWZ1bCBmb3IgcmVuZGVyaW5nIHRyYW5zcGFyZW50IG1lc2hlcyBpbiBhIGJldHRlciBvcmRlciB0aGFuIGRlZmF1bHQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Q2FsY3VsYXRlU29ydERpc3RhbmNlQ2FsbGJhY2t9XG4gICAgICovXG4gICAgc2V0IGNhbGN1bGF0ZVNvcnREaXN0YW5jZShjYWxjdWxhdGVTb3J0RGlzdGFuY2UpIHtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU29ydERpc3RhbmNlID0gY2FsY3VsYXRlU29ydERpc3RhbmNlO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVTb3J0RGlzdGFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWxjdWxhdGVTb3J0RGlzdGFuY2U7XG4gICAgfVxuXG4gICAgc2V0IHJlY2VpdmVTaGFkb3codmFsKSB7XG4gICAgICAgIHRoaXMuX3JlY2VpdmVTaGFkb3cgPSB2YWw7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSB2YWwgPyAodGhpcy5fc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfTk9TSEFET1cpIDogKHRoaXMuX3NoYWRlckRlZnMgfCBTSEFERVJERUZfTk9TSEFET1cpO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRdID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJESERSXSA9IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0IHJlY2VpdmVTaGFkb3coKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWNlaXZlU2hhZG93O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBza2luIGluc3RhbmNlIG1hbmFnaW5nIHNraW5uaW5nIG9mIHRoaXMgbWVzaCBpbnN0YW5jZSwgb3IgbnVsbCBpZiBza2lubmluZyBpcyBub3QgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vc2tpbi1pbnN0YW5jZS5qcycpLlNraW5JbnN0YW5jZX1cbiAgICAgKi9cbiAgICBzZXQgc2tpbkluc3RhbmNlKHZhbCkge1xuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2UgPSB2YWw7XG5cbiAgICAgICAgbGV0IHNoYWRlckRlZnMgPSB0aGlzLl9zaGFkZXJEZWZzO1xuICAgICAgICBzaGFkZXJEZWZzID0gdmFsID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfU0tJTikgOiAoc2hhZGVyRGVmcyAmIH5TSEFERVJERUZfU0tJTik7XG5cbiAgICAgICAgLy8gaWYgc2hhZGVyRGVmcyBoYXZlIGNoYW5nZWRcbiAgICAgICAgaWYgKHNoYWRlckRlZnMgIT09IHRoaXMuX3NoYWRlckRlZnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBzaGFkZXJEZWZzO1xuICAgICAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9zZXR1cFNraW5VcGRhdGUoKTtcbiAgICB9XG5cbiAgICBnZXQgc2tpbkluc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2tpbkluc3RhbmNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtb3JwaCBpbnN0YW5jZSBtYW5hZ2luZyBtb3JwaGluZyBvZiB0aGlzIG1lc2ggaW5zdGFuY2UsIG9yIG51bGwgaWYgbW9ycGhpbmcgaXMgbm90IHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL21vcnBoLWluc3RhbmNlLmpzJykuTW9ycGhJbnN0YW5jZX1cbiAgICAgKi9cbiAgICBzZXQgbW9ycGhJbnN0YW5jZSh2YWwpIHtcblxuICAgICAgICAvLyByZWxlYXNlIGV4aXN0aW5nXG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2U/LmRlc3Ryb3koKTtcblxuICAgICAgICAvLyBhc3NpZ24gbmV3XG4gICAgICAgIHRoaXMuX21vcnBoSW5zdGFuY2UgPSB2YWw7XG5cbiAgICAgICAgbGV0IHNoYWRlckRlZnMgPSB0aGlzLl9zaGFkZXJEZWZzO1xuICAgICAgICBzaGFkZXJEZWZzID0gKHZhbCAmJiB2YWwubW9ycGgudXNlVGV4dHVyZU1vcnBoKSA/IChzaGFkZXJEZWZzIHwgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQpIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQpO1xuICAgICAgICBzaGFkZXJEZWZzID0gKHZhbCAmJiB2YWwubW9ycGgubW9ycGhQb3NpdGlvbnMpID8gKHNoYWRlckRlZnMgfCBTSEFERVJERUZfTU9SUEhfUE9TSVRJT04pIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX1BPU0lUSU9OKTtcbiAgICAgICAgc2hhZGVyRGVmcyA9ICh2YWwgJiYgdmFsLm1vcnBoLm1vcnBoTm9ybWFscykgPyAoc2hhZGVyRGVmcyB8IFNIQURFUkRFRl9NT1JQSF9OT1JNQUwpIDogKHNoYWRlckRlZnMgJiB+U0hBREVSREVGX01PUlBIX05PUk1BTCk7XG5cbiAgICAgICAgLy8gaWYgc2hhZGVyRGVmcyBoYXZlIGNoYW5nZWRcbiAgICAgICAgaWYgKHNoYWRlckRlZnMgIT09IHRoaXMuX3NoYWRlckRlZnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSBzaGFkZXJEZWZzO1xuICAgICAgICAgICAgdGhpcy5jbGVhclNoYWRlcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtb3JwaEluc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9ycGhJbnN0YW5jZTtcbiAgICB9XG5cbiAgICBzZXQgc2NyZWVuU3BhY2UodmFsKSB7XG4gICAgICAgIHRoaXMuX3NjcmVlblNwYWNlID0gdmFsO1xuICAgICAgICB0aGlzLl9zaGFkZXJEZWZzID0gdmFsID8gKHRoaXMuX3NoYWRlckRlZnMgfCBTSEFERVJERUZfU0NSRUVOU1BBQ0UpIDogKHRoaXMuX3NoYWRlckRlZnMgJiB+U0hBREVSREVGX1NDUkVFTlNQQUNFKTtcbiAgICAgICAgdGhpcy5fc2hhZGVyW1NIQURFUl9GT1JXQVJEXSA9IG51bGw7XG4gICAgfVxuXG4gICAgZ2V0IHNjcmVlblNwYWNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2NyZWVuU3BhY2U7XG4gICAgfVxuXG4gICAgc2V0IGtleSh2YWwpIHtcbiAgICAgICAgdGhpcy5fa2V5W1NPUlRLRVlfRk9SV0FSRF0gPSB2YWw7XG4gICAgfVxuXG4gICAgZ2V0IGtleSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2tleVtTT1JUS0VZX0ZPUldBUkRdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hc2sgY29udHJvbGxpbmcgd2hpY2gge0BsaW5rIExpZ2h0Q29tcG9uZW50fXMgbGlnaHQgdGhpcyBtZXNoIGluc3RhbmNlLCB3aGljaFxuICAgICAqIHtAbGluayBDYW1lcmFDb21wb25lbnR9IHNlZXMgaXQgYW5kIGluIHdoaWNoIHtAbGluayBMYXllcn0gaXQgaXMgcmVuZGVyZWQuIERlZmF1bHRzIHRvIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXNrKHZhbCkge1xuICAgICAgICBjb25zdCB0b2dnbGVzID0gdGhpcy5fc2hhZGVyRGVmcyAmIDB4MDAwMEZGRkY7XG4gICAgICAgIHRoaXMuX3NoYWRlckRlZnMgPSB0b2dnbGVzIHwgKHZhbCA8PCAxNik7XG4gICAgICAgIHRoaXMuX3NoYWRlcltTSEFERVJfRk9SV0FSRF0gPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkZXJbU0hBREVSX0ZPUldBUkRIRFJdID0gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRlckRlZnMgPj4gMTY7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTnVtYmVyIG9mIGluc3RhbmNlcyB3aGVuIHVzaW5nIGhhcmR3YXJlIGluc3RhbmNpbmcgdG8gcmVuZGVyIHRoZSBtZXNoLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaW5zdGFuY2luZ0NvdW50KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmluc3RhbmNpbmdEYXRhKVxuICAgICAgICAgICAgdGhpcy5pbnN0YW5jaW5nRGF0YS5jb3VudCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBpbnN0YW5jaW5nQ291bnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNpbmdEYXRhID8gdGhpcy5pbnN0YW5jaW5nRGF0YS5jb3VudCA6IDA7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICBjb25zdCBtZXNoID0gdGhpcy5tZXNoO1xuICAgICAgICBpZiAobWVzaCkge1xuXG4gICAgICAgICAgICAvLyB0aGlzIGRlY3JlYXNlcyByZWYgY291bnQgb24gdGhlIG1lc2hcbiAgICAgICAgICAgIHRoaXMubWVzaCA9IG51bGw7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgbWVzaFxuICAgICAgICAgICAgaWYgKG1lc2gucmVmQ291bnQgPCAxKSB7XG4gICAgICAgICAgICAgICAgbWVzaC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWxlYXNlIHJlZiBjb3VudGVkIGxpZ2h0bWFwc1xuICAgICAgICB0aGlzLnNldFJlYWx0aW1lTGlnaHRtYXAoTWVzaEluc3RhbmNlLmxpZ2h0bWFwUGFyYW1OYW1lc1swXSwgbnVsbCk7XG4gICAgICAgIHRoaXMuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzFdLCBudWxsKTtcblxuICAgICAgICB0aGlzLl9za2luSW5zdGFuY2U/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fc2tpbkluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLm1vcnBoSW5zdGFuY2U/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5tb3JwaEluc3RhbmNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNsZWFyU2hhZGVycygpO1xuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSBtYXRlcmlhbCBjbGVhcnMgcmVmZXJlbmNlcyB0byB0aGlzIG1lc2hJbnN0YW5jZVxuICAgICAgICB0aGlzLm1hdGVyaWFsID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBzaGFkZXIgdW5pZm9ybSBuYW1lcyBmb3IgbGlnaHRtYXBzXG4gICAgc3RhdGljIGxpZ2h0bWFwUGFyYW1OYW1lcyA9IFsndGV4dHVyZV9saWdodE1hcCcsICd0ZXh0dXJlX2RpckxpZ2h0TWFwJ107XG5cbiAgICAvLyBnZW5lcmF0ZXMgd2lyZWZyYW1lcyBmb3IgYW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXNcbiAgICBzdGF0aWMgX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5KG1lc2hJbnN0YW5jZXMsIHJlbmRlclN0eWxlKSB7XG5cbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gc3dpdGNoIG1lc2ggaW5zdGFuY2UgdG8gdGhlIHJlcXVlc3RlZCBzdHlsZVxuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG5cbiAgICAgICAgICAgICAgICAvLyBwcm9jZXNzIGFsbCB1bmlxdWUgbWVzaGVzXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZXNbaV0ubWVzaDtcbiAgICAgICAgICAgICAgICBpZiAoIV9tZXNoU2V0LmhhcyhtZXNoKSkge1xuICAgICAgICAgICAgICAgICAgICBfbWVzaFNldC5hZGQobWVzaCk7XG4gICAgICAgICAgICAgICAgICAgIG1lc2gucHJlcGFyZVJlbmRlclN0YXRlKHJlbmRlclN0eWxlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9tZXNoU2V0LmNsZWFyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB0ZXN0IGlmIG1lc2hJbnN0YW5jZSBpcyB2aXNpYmxlIGJ5IGNhbWVyYS4gSXQgcmVxdWlyZXMgdGhlIGZydXN0dW0gb2YgdGhlIGNhbWVyYSB0byBiZSB1cCB0byBkYXRlLCB3aGljaCBmb3J3YXJkLXJlbmRlcmVyXG4gICAgLy8gdGFrZXMgY2FyZSBvZi4gVGhpcyBmdW5jdGlvbiBzaG91bGQgIG5vdCBiZSBjYWxsZWQgZWxzZXdoZXJlLlxuICAgIF9pc1Zpc2libGUoY2FtZXJhKSB7XG5cbiAgICAgICAgaWYgKHRoaXMudmlzaWJsZSkge1xuXG4gICAgICAgICAgICAvLyBjdXN0b20gdmlzaWJpbGl0eSBtZXRob2Qgb2YgTWVzaEluc3RhbmNlXG4gICAgICAgICAgICBpZiAodGhpcy5pc1Zpc2libGVGdW5jKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNWaXNpYmxlRnVuYyhjYW1lcmEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfdGVtcFNwaGVyZS5jZW50ZXIgPSB0aGlzLmFhYmIuY2VudGVyOyAgLy8gdGhpcyBsaW5lIGV2YWx1YXRlcyBhYWJiXG4gICAgICAgICAgICBfdGVtcFNwaGVyZS5yYWRpdXMgPSB0aGlzLl9hYWJiLmhhbGZFeHRlbnRzLmxlbmd0aCgpO1xuXG4gICAgICAgICAgICByZXR1cm4gY2FtZXJhLmZydXN0dW0uY29udGFpbnNTcGhlcmUoX3RlbXBTcGhlcmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHVwZGF0ZUtleSgpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSB0aGlzLm1hdGVyaWFsO1xuICAgICAgICB0aGlzLl9rZXlbU09SVEtFWV9GT1JXQVJEXSA9IGdldEtleSh0aGlzLmxheWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAobWF0ZXJpYWwuYWxwaGFUb0NvdmVyYWdlIHx8IG1hdGVyaWFsLmFscGhhVGVzdCkgPyBCTEVORF9OT1JNQUwgOiBtYXRlcmlhbC5ibGVuZFR5cGUsIC8vIHJlbmRlciBhbHBoYXRlc3QvYXRvYyBhZnRlciBvcGFxdWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UsIG1hdGVyaWFsLmlkKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHVwIHtAbGluayBNZXNoSW5zdGFuY2V9IHRvIGJlIHJlbmRlcmVkIHVzaW5nIEhhcmR3YXJlIEluc3RhbmNpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcnxudWxsfSB2ZXJ0ZXhCdWZmZXIgLSBWZXJ0ZXggYnVmZmVyIHRvIGhvbGQgcGVyLWluc3RhbmNlIHZlcnRleCBkYXRhXG4gICAgICogKHVzdWFsbHkgd29ybGQgbWF0cmljZXMpLiBQYXNzIG51bGwgdG8gdHVybiBvZmYgaGFyZHdhcmUgaW5zdGFuY2luZy5cbiAgICAgKi9cbiAgICBzZXRJbnN0YW5jaW5nKHZlcnRleEJ1ZmZlcikge1xuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhID0gbmV3IEluc3RhbmNpbmdEYXRhKHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcyk7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcblxuICAgICAgICAgICAgLy8gbWFyayB2ZXJ0ZXggYnVmZmVyIGFzIGluc3RhbmNpbmcgZGF0YVxuICAgICAgICAgICAgdmVydGV4QnVmZmVyLmZvcm1hdC5pbnN0YW5jaW5nID0gdHJ1ZTtcblxuICAgICAgICAgICAgLy8gdHVybiBvZmYgY3VsbGluZyAtIHdlIGRvIG5vdCBkbyBwZXItaW5zdGFuY2UgY3VsbGluZywgYWxsIGluc3RhbmNlcyBhcmUgc3VibWl0dGVkIHRvIEdQVVxuICAgICAgICAgICAgdGhpcy5jdWxsID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmluc3RhbmNpbmdEYXRhID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuY3VsbCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBPYnRhaW4gYSBzaGFkZXIgdmFyaWFudCByZXF1aXJlZCB0byByZW5kZXIgdGhlIG1lc2ggaW5zdGFuY2Ugd2l0aGluIHNwZWNpZmllZCBwYXNzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc2NlbmUuanMnKS5TY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHBhc3MgLSBUaGUgcmVuZGVyIHBhc3MuXG4gICAgICogQHBhcmFtIHthbnl9IHN0YXRpY0xpZ2h0TGlzdCAtIExpc3Qgb2Ygc3RhdGljIGxpZ2h0cy5cbiAgICAgKiBAcGFyYW0ge2FueX0gc29ydGVkTGlnaHRzIC0gQXJyYXkgb2YgYXJyYXlzIG9mIGxpZ2h0cy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJykuVW5pZm9ybUJ1ZmZlckZvcm1hdH0gdmlld1VuaWZvcm1Gb3JtYXQgLSBUaGVcbiAgICAgKiBmb3JtYXQgb2YgdGhlIHZpZXcgdW5pZm9ybSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAtZm9ybWF0LmpzJykuQmluZEdyb3VwRm9ybWF0fSB2aWV3QmluZEdyb3VwRm9ybWF0IC0gVGhlXG4gICAgICogZm9ybWF0IG9mIHRoZSB2aWV3IGJpbmQgZ3JvdXAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHBhc3MsIHN0YXRpY0xpZ2h0TGlzdCwgc29ydGVkTGlnaHRzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCkge1xuICAgICAgICB0aGlzLl9zaGFkZXJbcGFzc10gPSB0aGlzLm1hdGVyaWFsLmdldFNoYWRlclZhcmlhbnQodGhpcy5tZXNoLmRldmljZSwgc2NlbmUsIHRoaXMuX3NoYWRlckRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuICAgIH1cblxuICAgIGVuc3VyZU1hdGVyaWFsKGRldmljZSkge1xuICAgICAgICBpZiAoIXRoaXMubWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYE1lc2ggYXR0YWNoZWQgdG8gZW50aXR5ICcke3RoaXMubm9kZS5uYW1lfScgZG9lcyBub3QgaGF2ZSBhIG1hdGVyaWFsLCB1c2luZyBhIGRlZmF1bHQgb25lLmApO1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IGdldERlZmF1bHRNYXRlcmlhbChkZXZpY2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUGFyYW1ldGVyIG1hbmFnZW1lbnRcbiAgICBjbGVhclBhcmFtZXRlcnMoKSB7XG4gICAgICAgIHRoaXMucGFyYW1ldGVycyA9IHt9O1xuICAgIH1cblxuICAgIGdldFBhcmFtZXRlcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmFtZXRlcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIHRoZSBzcGVjaWZpZWQgc2hhZGVyIHBhcmFtZXRlciBmcm9tIGEgbWVzaCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciB0byBxdWVyeS5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSBUaGUgbmFtZWQgcGFyYW1ldGVyLlxuICAgICAqL1xuICAgIGdldFBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmFtZXRlcnNbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHNoYWRlciBwYXJhbWV0ZXIgb24gYSBtZXNoIGluc3RhbmNlLiBOb3RlIHRoYXQgdGhpcyBwYXJhbWV0ZXIgd2lsbCB0YWtlIHByZWNlZGVuY2VcbiAgICAgKiBvdmVyIHBhcmFtZXRlciBvZiB0aGUgc2FtZSBuYW1lIGlmIHNldCBvbiBNYXRlcmlhbCB0aGlzIG1lc2ggaW5zdGFuY2UgdXNlcyBmb3IgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxudW1iZXJbXXxpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSBkYXRhIC0gVGhlIHZhbHVlXG4gICAgICogZm9yIHRoZSBzcGVjaWZpZWQgcGFyYW1ldGVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbcGFzc0ZsYWdzXSAtIE1hc2sgZGVzY3JpYmluZyB3aGljaCBwYXNzZXMgdGhlIG1hdGVyaWFsIHNob3VsZCBiZSBpbmNsdWRlZFxuICAgICAqIGluLlxuICAgICAqL1xuICAgIHNldFBhcmFtZXRlcihuYW1lLCBkYXRhLCBwYXNzRmxhZ3MgPSAtMjYyMTQxKSB7XG5cbiAgICAgICAgLy8gbm90ZSBvbiAtMjYyMTQxOiBBbGwgYml0cyBzZXQgZXhjZXB0IDIgLSAxOSByYW5nZVxuXG4gICAgICAgIGlmIChkYXRhID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtT2JqZWN0ID0gbmFtZTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtT2JqZWN0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdW5pZm9ybU9iamVjdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFBhcmFtZXRlcih1bmlmb3JtT2JqZWN0W2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmFtZSA9IHVuaWZvcm1PYmplY3QubmFtZTtcbiAgICAgICAgICAgIGRhdGEgPSB1bmlmb3JtT2JqZWN0LnZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGFyYW0gPSB0aGlzLnBhcmFtZXRlcnNbbmFtZV07XG4gICAgICAgIGlmIChwYXJhbSkge1xuICAgICAgICAgICAgcGFyYW0uZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICBwYXJhbS5wYXNzRmxhZ3MgPSBwYXNzRmxhZ3M7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnBhcmFtZXRlcnNbbmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgc2NvcGVJZDogbnVsbCxcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhLFxuICAgICAgICAgICAgICAgIHBhc3NGbGFnczogcGFzc0ZsYWdzXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYSB3cmFwcGVyIG92ZXIgc2V0dGluZ3MgcGFyYW1ldGVyIHNwZWNpZmljYWxseSBmb3IgcmVhbHRpbWUgYmFrZWQgbGlnaHRtYXBzLiBUaGlzIGhhbmRsZXMgcmVmZXJlbmNlIGNvdW50aW5nIG9mIGxpZ2h0bWFwc1xuICAgIC8vIGFuZCByZWxlYXNlcyB0aGVtIHdoZW4gbm8gbG9uZ2VyIHJlZmVyZW5jZWRcbiAgICBzZXRSZWFsdGltZUxpZ2h0bWFwKG5hbWUsIHRleHR1cmUpIHtcblxuICAgICAgICAvLyBubyBjaGFuZ2VcbiAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5nZXRQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIGlmIChvbGQgPT09IHRleHR1cmUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gcmVtb3ZlIG9sZFxuICAgICAgICBpZiAob2xkKSB7XG4gICAgICAgICAgICBMaWdodG1hcENhY2hlLmRlY1JlZihvbGQuZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhc3NpZ24gbmV3XG4gICAgICAgIGlmICh0ZXh0dXJlKSB7XG4gICAgICAgICAgICBMaWdodG1hcENhY2hlLmluY1JlZih0ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyKG5hbWUsIHRleHR1cmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5kZWxldGVQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAgLyoqXG4gICAgICAqIERlbGV0ZXMgYSBzaGFkZXIgcGFyYW1ldGVyIG9uIGEgbWVzaCBpbnN0YW5jZS5cbiAgICAgICpcbiAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgcGFyYW1ldGVyIHRvIGRlbGV0ZS5cbiAgICAgICovXG4gICAgZGVsZXRlUGFyYW1ldGVyKG5hbWUpIHtcbiAgICAgICAgaWYgKHRoaXMucGFyYW1ldGVyc1tuYW1lXSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMucGFyYW1ldGVyc1tuYW1lXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVzZWQgdG8gYXBwbHkgcGFyYW1ldGVycyBmcm9tIHRoaXMgbWVzaCBpbnN0YW5jZSBpbnRvIHNjb3BlIG9mIHVuaWZvcm1zLCBjYWxsZWQgaW50ZXJuYWxseSBieSBmb3J3YXJkLXJlbmRlcmVyXG4gICAgc2V0UGFyYW1ldGVycyhkZXZpY2UsIHBhc3NGbGFnKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtZXRlcnMgPSB0aGlzLnBhcmFtZXRlcnM7XG4gICAgICAgIGZvciAoY29uc3QgcGFyYW1OYW1lIGluIHBhcmFtZXRlcnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtZXRlciA9IHBhcmFtZXRlcnNbcGFyYW1OYW1lXTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXIucGFzc0ZsYWdzICYgcGFzc0ZsYWcpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXBhcmFtZXRlci5zY29wZUlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtZXRlci5zY29wZUlkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUocGFyYW1OYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcGFyYW1ldGVyLnNjb3BlSWQuc2V0VmFsdWUocGFyYW1ldGVyLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0TGlnaHRtYXBwZWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLm1hc2sgPSAodGhpcy5tYXNrIHwgTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQpICYgfihNQVNLX0FGRkVDVF9EWU5BTUlDIHwgTUFTS19CQUtFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzBdLCBudWxsKTtcbiAgICAgICAgICAgIHRoaXMuc2V0UmVhbHRpbWVMaWdodG1hcChNZXNoSW5zdGFuY2UubGlnaHRtYXBQYXJhbU5hbWVzWzFdLCBudWxsKTtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlckRlZnMgJj0gfihTSEFERVJERUZfTE0gfCBTSEFERVJERUZfRElSTE0gfCBTSEFERVJERUZfTE1BTUJJRU5UKTtcbiAgICAgICAgICAgIHRoaXMubWFzayA9ICh0aGlzLm1hc2sgfCBNQVNLX0FGRkVDVF9EWU5BTUlDKSAmIH4oTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQgfCBNQVNLX0JBS0UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0Q3VzdG9tQWFiYihhYWJiKSB7XG5cbiAgICAgICAgaWYgKGFhYmIpIHtcbiAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBvdmVycmlkZSBhYWJiXG4gICAgICAgICAgICBpZiAodGhpcy5fY3VzdG9tQWFiYikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2N1c3RvbUFhYmIuY29weShhYWJiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IGFhYmIuY2xvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vIG92ZXJyaWRlLCBmb3JjZSByZWZyZXNoIHRoZSBhY3R1YWwgb25lXG4gICAgICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NldHVwU2tpblVwZGF0ZSgpO1xuICAgIH1cblxuICAgIF9zZXR1cFNraW5VcGRhdGUoKSB7XG5cbiAgICAgICAgLy8gc2V0IGlmIGJvbmVzIG5lZWQgdG8gYmUgdXBkYXRlZCBiZWZvcmUgY3VsbGluZ1xuICAgICAgICBpZiAodGhpcy5fc2tpbkluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9za2luSW5zdGFuY2UuX3VwZGF0ZUJlZm9yZUN1bGwgPSAhdGhpcy5fY3VzdG9tQWFiYjtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0S2V5KGxheWVyLCBibGVuZFR5cGUsIGlzQ29tbWFuZCwgbWF0ZXJpYWxJZCkge1xuICAgIC8vIEtleSBkZWZpbml0aW9uOlxuICAgIC8vIEJpdFxuICAgIC8vIDMxICAgICAgOiBzaWduIGJpdCAobGVhdmUpXG4gICAgLy8gMjcgLSAzMCA6IGxheWVyXG4gICAgLy8gMjYgICAgICA6IHRyYW5zbHVjZW5jeSB0eXBlIChvcGFxdWUvdHJhbnNwYXJlbnQpXG4gICAgLy8gMjUgICAgICA6IENvbW1hbmQgYml0ICgxOiB0aGlzIGtleSBpcyBmb3IgYSBjb21tYW5kLCAwOiBpdCdzIGEgbWVzaCBpbnN0YW5jZSlcbiAgICAvLyAwIC0gMjQgIDogTWF0ZXJpYWwgSUQgKGlmIG9wYXF1ZSkgb3IgMCAoaWYgdHJhbnNwYXJlbnQgLSB3aWxsIGJlIGRlcHRoKVxuICAgIHJldHVybiAoKGxheWVyICYgMHgwZikgPDwgMjcpIHxcbiAgICAgICAgICAgKChibGVuZFR5cGUgPT09IEJMRU5EX05PTkUgPyAxIDogMCkgPDwgMjYpIHxcbiAgICAgICAgICAgKChpc0NvbW1hbmQgPyAxIDogMCkgPDwgMjUpIHxcbiAgICAgICAgICAgKChtYXRlcmlhbElkICYgMHgxZmZmZmZmKSA8PCAwKTtcbn1cblxuZXhwb3J0IHsgQ29tbWFuZCwgTWVzaEluc3RhbmNlIH07XG4iXSwibmFtZXMiOlsiX3RtcEFhYmIiLCJCb3VuZGluZ0JveCIsIl90ZW1wQm9uZUFhYmIiLCJfdGVtcFNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiX21lc2hTZXQiLCJTZXQiLCJJbnN0YW5jaW5nRGF0YSIsImNvbnN0cnVjdG9yIiwibnVtT2JqZWN0cyIsInZlcnRleEJ1ZmZlciIsImNvdW50IiwiQ29tbWFuZCIsImxheWVyIiwiYmxlbmRUeXBlIiwiY29tbWFuZCIsIl9rZXkiLCJTT1JUS0VZX0ZPUldBUkQiLCJnZXRLZXkiLCJrZXkiLCJ2YWwiLCJNZXNoSW5zdGFuY2UiLCJtZXNoIiwibWF0ZXJpYWwiLCJub2RlIiwiX21hdGVyaWFsIiwiX3NoYWRlciIsIl9iaW5kR3JvdXBzIiwiR3JhcGhOb2RlIiwidGVtcCIsImlzU3RhdGljIiwiX3N0YXRpY0xpZ2h0TGlzdCIsIl9zdGF0aWNTb3VyY2UiLCJfbWVzaCIsImluY1JlZkNvdW50IiwiX3NoYWRlckRlZnMiLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiZm9ybWF0IiwiaGFzVXYwIiwiU0hBREVSREVGX1VWMCIsImhhc1V2MSIsIlNIQURFUkRFRl9VVjEiLCJoYXNDb2xvciIsIlNIQURFUkRFRl9WQ09MT1IiLCJoYXNUYW5nZW50cyIsIlNIQURFUkRFRl9UQU5HRU5UUyIsIl9saWdodEhhc2giLCJ2aXNpYmxlIiwiTEFZRVJfV09STEQiLCJfcmVuZGVyU3R5bGUiLCJSRU5ERVJTVFlMRV9TT0xJRCIsImNhc3RTaGFkb3ciLCJfcmVjZWl2ZVNoYWRvdyIsIl9zY3JlZW5TcGFjZSIsIl9ub0RlcHRoRHJhd0dsMSIsImN1bGwiLCJwaWNrIiwiX3VwZGF0ZUFhYmIiLCJfdXBkYXRlQWFiYkZ1bmMiLCJfY2FsY3VsYXRlU29ydERpc3RhbmNlIiwidXBkYXRlS2V5IiwiX3NraW5JbnN0YW5jZSIsIl9tb3JwaEluc3RhbmNlIiwiaW5zdGFuY2luZ0RhdGEiLCJfY3VzdG9tQWFiYiIsImFhYmIiLCJfYWFiYlZlciIsImRyYXdPcmRlciIsInZpc2libGVUaGlzRnJhbWUiLCJpc1Zpc2libGVGdW5jIiwicGFyYW1ldGVycyIsInN0ZW5jaWxGcm9udCIsInN0ZW5jaWxCYWNrIiwiZmxpcEZhY2VzIiwicmVuZGVyU3R5bGUiLCJwcmVwYXJlUmVuZGVyU3RhdGUiLCJkZWNSZWZDb3VudCIsIl9hYWJiIiwibG9jYWxBYWJiIiwidG9Xb3JsZFNwYWNlIiwic2tpbkluc3RhbmNlIiwiYm9uZUFhYmIiLCJtb3JwaFRhcmdldHMiLCJtb3JwaCIsIl90YXJnZXRzIiwiX2luaXRCb25lQWFiYnMiLCJib25lVXNlZCIsImZpcnN0IiwiaSIsImxlbmd0aCIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJtYXRyaWNlcyIsImNlbnRlciIsImNvcHkiLCJoYWxmRXh0ZW50cyIsImFkZCIsInNldCIsIl9leHBhbmQiLCJnZXRNaW4iLCJnZXRNYXgiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImNsZWFyU2hhZGVycyIsInNoYWRlcnMiLCJkZXN0cm95QmluZEdyb3VwcyIsImdyb3VwcyIsImdyb3VwIiwidW5pZm9ybUJ1ZmZlciIsImRlZmF1bHRVbmlmb3JtQnVmZmVyIiwiZGVzdHJveSIsImdldEJpbmRHcm91cCIsImRldmljZSIsInBhc3MiLCJiaW5kR3JvdXAiLCJzaGFkZXIiLCJEZWJ1ZyIsImFzc2VydCIsInViRm9ybWF0IiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJVbmlmb3JtQnVmZmVyIiwiYmluZ0dyb3VwRm9ybWF0IiwibWVzaEJpbmRHcm91cEZvcm1hdCIsIkJpbmRHcm91cCIsIkRlYnVnSGVscGVyIiwic2V0TmFtZSIsImlkIiwicHJldk1hdCIsInJlbW92ZU1lc2hJbnN0YW5jZVJlZiIsImFkZE1lc2hJbnN0YW5jZVJlZiIsInByZXZCbGVuZCIsInRyYW5zcGFyZW50Iiwic2NlbmUiLCJfc2NlbmUiLCJsYXllcnMiLCJfZGlydHlCbGVuZCIsIl9sYXllciIsImNhbGN1bGF0ZVNvcnREaXN0YW5jZSIsInJlY2VpdmVTaGFkb3ciLCJTSEFERVJERUZfTk9TSEFET1ciLCJTSEFERVJfRk9SV0FSRCIsIlNIQURFUl9GT1JXQVJESERSIiwic2hhZGVyRGVmcyIsIlNIQURFUkRFRl9TS0lOIiwiX3NldHVwU2tpblVwZGF0ZSIsIm1vcnBoSW5zdGFuY2UiLCJ1c2VUZXh0dXJlTW9ycGgiLCJTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCIsIm1vcnBoUG9zaXRpb25zIiwiU0hBREVSREVGX01PUlBIX1BPU0lUSU9OIiwibW9ycGhOb3JtYWxzIiwiU0hBREVSREVGX01PUlBIX05PUk1BTCIsInNjcmVlblNwYWNlIiwiU0hBREVSREVGX1NDUkVFTlNQQUNFIiwibWFzayIsInRvZ2dsZXMiLCJpbnN0YW5jaW5nQ291bnQiLCJ2YWx1ZSIsInJlZkNvdW50Iiwic2V0UmVhbHRpbWVMaWdodG1hcCIsImxpZ2h0bWFwUGFyYW1OYW1lcyIsIl9wcmVwYXJlUmVuZGVyU3R5bGVGb3JBcnJheSIsIm1lc2hJbnN0YW5jZXMiLCJoYXMiLCJjbGVhciIsIl9pc1Zpc2libGUiLCJjYW1lcmEiLCJyYWRpdXMiLCJmcnVzdHVtIiwiY29udGFpbnNTcGhlcmUiLCJhbHBoYVRvQ292ZXJhZ2UiLCJhbHBoYVRlc3QiLCJCTEVORF9OT1JNQUwiLCJzZXRJbnN0YW5jaW5nIiwibnVtVmVydGljZXMiLCJpbnN0YW5jaW5nIiwidXBkYXRlUGFzc1NoYWRlciIsInN0YXRpY0xpZ2h0TGlzdCIsInNvcnRlZExpZ2h0cyIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsImdldFNoYWRlclZhcmlhbnQiLCJlbnN1cmVNYXRlcmlhbCIsIndhcm4iLCJuYW1lIiwiZ2V0RGVmYXVsdE1hdGVyaWFsIiwiY2xlYXJQYXJhbWV0ZXJzIiwiZ2V0UGFyYW1ldGVycyIsImdldFBhcmFtZXRlciIsInNldFBhcmFtZXRlciIsImRhdGEiLCJwYXNzRmxhZ3MiLCJ1bmRlZmluZWQiLCJ1bmlmb3JtT2JqZWN0IiwicGFyYW0iLCJzY29wZUlkIiwidGV4dHVyZSIsIm9sZCIsIkxpZ2h0bWFwQ2FjaGUiLCJkZWNSZWYiLCJpbmNSZWYiLCJkZWxldGVQYXJhbWV0ZXIiLCJzZXRQYXJhbWV0ZXJzIiwicGFzc0ZsYWciLCJwYXJhbU5hbWUiLCJwYXJhbWV0ZXIiLCJzY29wZSIsInJlc29sdmUiLCJzZXRWYWx1ZSIsInNldExpZ2h0bWFwcGVkIiwiTUFTS19BRkZFQ1RfTElHSFRNQVBQRUQiLCJNQVNLX0JBS0UiLCJTSEFERVJERUZfTE0iLCJTSEFERVJERUZfRElSTE0iLCJTSEFERVJERUZfTE1BTUJJRU5UIiwic2V0Q3VzdG9tQWFiYiIsImNsb25lIiwiX3VwZGF0ZUJlZm9yZUN1bGwiLCJpc0NvbW1hbmQiLCJtYXRlcmlhbElkIiwiQkxFTkRfTk9ORSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBd0JBLE1BQU1BLFFBQVEsR0FBRyxJQUFJQyxXQUFXLEVBQUUsQ0FBQTtBQUNsQyxNQUFNQyxhQUFhLEdBQUcsSUFBSUQsV0FBVyxFQUFFLENBQUE7QUFDdkMsTUFBTUUsV0FBVyxHQUFHLElBQUlDLGNBQWMsRUFBRSxDQUFBO0FBQ3hDLE1BQU1DLFFBQVEsR0FBRyxJQUFJQyxHQUFHLEVBQUUsQ0FBQTs7QUFPMUIsTUFBTUMsY0FBYyxDQUFDOztFQU9qQkMsV0FBVyxDQUFDQyxVQUFVLEVBQUU7SUFBQSxJQUx4QkMsQ0FBQUEsWUFBWSxHQUFHLElBQUksQ0FBQTtJQU1mLElBQUksQ0FBQ0MsS0FBSyxHQUFHRixVQUFVLENBQUE7QUFDM0IsR0FBQTtBQUNKLENBQUE7QUFFQSxNQUFNRyxPQUFPLENB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
