/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../core/time.js';
import { Debug } from '../../core/debug.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat3 } from '../../core/math/mat3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PRIMITIVE_TRIFAN, SEMANTIC_BLENDINDICES, TYPE_FLOAT32, typedArrayTypes, typedArrayTypesByteSize, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, typedArrayIndexFormats, PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { SPRITE_RENDERMODE_SIMPLE } from '../constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { Batch } from './batch.js';
import { BatchGroup } from './batch-group.js';
import { SkinBatchInstance } from './skin-batch-instance.js';

function paramsIdentical(a, b) {
  if (a && !b) return false;
  if (!a && b) return false;
  a = a.data;
  b = b.data;
  if (a === b) return true;
  if (a instanceof Float32Array && b instanceof Float32Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  return false;
}
function equalParamSets(params1, params2) {
  for (const param in params1) {
    if (params1.hasOwnProperty(param) && !paramsIdentical(params1[param], params2[param])) return false;
  }
  for (const param in params2) {
    if (params2.hasOwnProperty(param) && !paramsIdentical(params2[param], params1[param])) return false;
  }
  return true;
}
function equalLightLists(lightList1, lightList2) {
  for (let k = 0; k < lightList1.length; k++) {
    if (lightList2.indexOf(lightList1[k]) < 0) return false;
  }
  for (let k = 0; k < lightList2.length; k++) {
    if (lightList1.indexOf(lightList2[k]) < 0) return false;
  }
  return true;
}
const mat3 = new Mat3();
const worldMatX = new Vec3();
const worldMatY = new Vec3();
const worldMatZ = new Vec3();
function getScaleSign(mi) {
  const wt = mi.node.worldTransform;
  wt.getX(worldMatX);
  wt.getY(worldMatY);
  wt.getZ(worldMatZ);
  worldMatX.cross(worldMatX, worldMatY);
  return worldMatX.dot(worldMatZ) >= 0 ? 1 : -1;
}

class BatchManager {
  constructor(device, root, scene) {
    this.device = device;
    this.rootNode = root;
    this.scene = scene;
    this._init = false;
    this._batchGroups = {};
    this._batchGroupCounter = 0;
    this._batchList = [];
    this._dirtyGroups = [];
    this._stats = {
      createTime: 0,
      updateLastFrameTime: 0
    };
  }
  destroy() {
    this.device = null;
    this.rootNode = null;
    this.scene = null;
    this._batchGroups = {};
    this._batchList = [];
    this._dirtyGroups = [];
  }

  addGroup(name, dynamic, maxAabbSize, id, layers) {
    if (id === undefined) {
      id = this._batchGroupCounter;
      this._batchGroupCounter++;
    }
    if (this._batchGroups[id]) {
      Debug.error(`Batch group with id ${id} already exists.`);
      return undefined;
    }
    const group = new BatchGroup(id, name, dynamic, maxAabbSize, layers);
    this._batchGroups[id] = group;
    return group;
  }

  removeGroup(id) {
    if (!this._batchGroups[id]) {
      Debug.error(`Batch group with id ${id} doesn't exist.`);
      return;
    }

    const newBatchList = [];
    for (let i = 0; i < this._batchList.length; i++) {
      if (this._batchList[i].batchGroupId === id) {
        this.destroyBatch(this._batchList[i]);
      } else {
        newBatchList.push(this._batchList[i]);
      }
    }
    this._batchList = newBatchList;
    this._removeModelsFromBatchGroup(this.rootNode, id);
    delete this._batchGroups[id];
  }

  markGroupDirty(id) {
    if (this._dirtyGroups.indexOf(id) < 0) {
      this._dirtyGroups.push(id);
    }
  }

  getGroupByName(name) {
    const groups = this._batchGroups;
    for (const group in groups) {
      if (!groups.hasOwnProperty(group)) continue;
      if (groups[group].name === name) {
        return groups[group];
      }
    }
    return null;
  }

  getBatches(batchGroupId) {
    const results = [];
    const len = this._batchList.length;
    for (let i = 0; i < len; i++) {
      const batch = this._batchList[i];
      if (batch.batchGroupId === batchGroupId) {
        results.push(batch);
      }
    }
    return results;
  }

  _removeModelsFromBatchGroup(node, id) {
    if (!node.enabled) return;
    if (node.model && node.model.batchGroupId === id) {
      node.model.batchGroupId = -1;
    }
    if (node.render && node.render.batchGroupId === id) {
      node.render.batchGroupId = -1;
    }
    if (node.element && node.element.batchGroupId === id) {
      node.element.batchGroupId = -1;
    }
    if (node.sprite && node.sprite.batchGroupId === id) {
      node.sprite.batchGroupId = -1;
    }
    for (let i = 0; i < node._children.length; i++) {
      this._removeModelsFromBatchGroup(node._children[i], id);
    }
  }
  insert(type, groupId, node) {
    const group = this._batchGroups[groupId];
    Debug.assert(group, `Invalid batch ${groupId} insertion`);
    if (group) {
      if (group._obj[type].indexOf(node) < 0) {
        group._obj[type].push(node);
        this.markGroupDirty(groupId);
      }
    }
  }
  remove(type, groupId, node) {
    const group = this._batchGroups[groupId];
    Debug.assert(group, `Invalid batch ${groupId} insertion`);
    if (group) {
      const idx = group._obj[type].indexOf(node);
      if (idx >= 0) {
        group._obj[type].splice(idx, 1);
        this.markGroupDirty(groupId);
      }
    }
  }
  _extractRender(node, arr, group, groupMeshInstances) {
    if (node.render) {
      if (node.render.isStatic) {
        const drawCalls = this.scene.drawCalls;
        const nodeMeshInstances = node.render.meshInstances;
        for (let i = 0; i < drawCalls.length; i++) {
          if (!drawCalls[i]._staticSource) continue;
          if (nodeMeshInstances.indexOf(drawCalls[i]._staticSource) < 0) continue;
          arr.push(drawCalls[i]);
        }
        for (let i = 0; i < nodeMeshInstances.length; i++) {
          if (drawCalls.indexOf(nodeMeshInstances[i]) >= 0) {
            arr.push(nodeMeshInstances[i]);
          }
        }
      } else {
        arr = groupMeshInstances[node.render.batchGroupId] = arr.concat(node.render.meshInstances);
      }
      node.render.removeFromLayers();
    }
    return arr;
  }
  _extractModel(node, arr, group, groupMeshInstances) {
    if (node.model && node.model.model) {
      if (node.model.isStatic) {
        const drawCalls = this.scene.drawCalls;
        const nodeMeshInstances = node.model.meshInstances;
        for (let i = 0; i < drawCalls.length; i++) {
          if (!drawCalls[i]._staticSource) continue;
          if (nodeMeshInstances.indexOf(drawCalls[i]._staticSource) < 0) continue;
          arr.push(drawCalls[i]);
        }
        for (let i = 0; i < nodeMeshInstances.length; i++) {
          if (drawCalls.indexOf(nodeMeshInstances[i]) >= 0) {
            arr.push(nodeMeshInstances[i]);
          }
        }
      } else {
        arr = groupMeshInstances[node.model.batchGroupId] = arr.concat(node.model.meshInstances);
      }
      node.model.removeModelFromLayers();
      node.model._batchGroup = group;
    }
    return arr;
  }
  _extractElement(node, arr, group) {
    if (!node.element) return;
    let valid = false;
    if (node.element._text && node.element._text._model.meshInstances.length > 0) {
      arr.push(node.element._text._model.meshInstances[0]);
      node.element.removeModelFromLayers(node.element._text._model);
      valid = true;
    } else if (node.element._image) {
      arr.push(node.element._image._renderable.meshInstance);
      node.element.removeModelFromLayers(node.element._image._renderable.model);
      if (node.element._image._renderable.unmaskMeshInstance) {
        arr.push(node.element._image._renderable.unmaskMeshInstance);
        if (!node.element._image._renderable.unmaskMeshInstance.stencilFront || !node.element._image._renderable.unmaskMeshInstance.stencilBack) {
          node.element._dirtifyMask();
          node.element._onPrerender();
        }
      }
      valid = true;
    }
    if (valid) {
      group._ui = true;
      node.element._batchGroup = group;
    }
  }

  _collectAndRemoveMeshInstances(groupMeshInstances, groupIds) {
    for (let g = 0; g < groupIds.length; g++) {
      const id = groupIds[g];
      const group = this._batchGroups[id];
      if (!group) continue;
      let arr = groupMeshInstances[id];
      if (!arr) arr = groupMeshInstances[id] = [];
      for (let m = 0; m < group._obj.model.length; m++) {
        arr = this._extractModel(group._obj.model[m], arr, group, groupMeshInstances);
      }
      for (let r = 0; r < group._obj.render.length; r++) {
        arr = this._extractRender(group._obj.render[r], arr, group, groupMeshInstances);
      }
      for (let e = 0; e < group._obj.element.length; e++) {
        this._extractElement(group._obj.element[e], arr, group);
      }
      for (let s = 0; s < group._obj.sprite.length; s++) {
        const node = group._obj.sprite[s];
        if (node.sprite && node.sprite._meshInstance && (group.dynamic || node.sprite.sprite._renderMode === SPRITE_RENDERMODE_SIMPLE)) {
          arr.push(node.sprite._meshInstance);
          node.sprite.removeModelFromLayers();
          group._sprite = true;
          node.sprite._batchGroup = group;
        }
      }
    }
  }

  generate(groupIds) {
    const groupMeshInstances = {};
    if (!groupIds) {
      groupIds = Object.keys(this._batchGroups);
    }

    const newBatchList = [];
    for (let i = 0; i < this._batchList.length; i++) {
      if (groupIds.indexOf(this._batchList[i].batchGroupId) < 0) {
        newBatchList.push(this._batchList[i]);
        continue;
      }
      this.destroyBatch(this._batchList[i]);
    }
    this._batchList = newBatchList;

    this._collectAndRemoveMeshInstances(groupMeshInstances, groupIds);
    if (groupIds === this._dirtyGroups) {
      this._dirtyGroups.length = 0;
    } else {
      const newDirtyGroups = [];
      for (let i = 0; i < this._dirtyGroups.length; i++) {
        if (groupIds.indexOf(this._dirtyGroups[i]) < 0) newDirtyGroups.push(this._dirtyGroups[i]);
      }
      this._dirtyGroups = newDirtyGroups;
    }
    let group, lists, groupData, batch;
    for (const groupId in groupMeshInstances) {
      if (!groupMeshInstances.hasOwnProperty(groupId)) continue;
      group = groupMeshInstances[groupId];
      groupData = this._batchGroups[groupId];
      if (!groupData) {
        Debug.error(`batch group ${groupId} not found`);
        continue;
      }
      lists = this.prepare(group, groupData.dynamic, groupData.maxAabbSize, groupData._ui || groupData._sprite);
      for (let i = 0; i < lists.length; i++) {
        batch = this.create(lists[i], groupData.dynamic, parseInt(groupId, 10));
        if (batch) {
          batch.addToLayers(this.scene, groupData.layers);
        }
      }
    }
  }

  prepare(meshInstances, dynamic, maxAabbSize = Number.POSITIVE_INFINITY, translucent) {
    if (meshInstances.length === 0) return [];
    const halfMaxAabbSize = maxAabbSize * 0.5;
    const maxInstanceCount = this.device.supportsBoneTextures ? 1024 : this.device.boneLimit;

    const maxNumVertices = this.device.extUintElement ? 0xffffffff : 0xffff;
    const aabb = new BoundingBox();
    const testAabb = new BoundingBox();
    let skipTranslucentAabb = null;
    let sf;
    const lists = [];
    let j = 0;
    if (translucent) {
      meshInstances.sort(function (a, b) {
        return a.drawOrder - b.drawOrder;
      });
    }
    let meshInstancesLeftA = meshInstances;
    let meshInstancesLeftB;
    const skipMesh = translucent ? function (mi) {
      if (skipTranslucentAabb) {
        skipTranslucentAabb.add(mi.aabb);
      } else {
        skipTranslucentAabb = mi.aabb.clone();
      }
      meshInstancesLeftB.push(mi);
    } : function (mi) {
      meshInstancesLeftB.push(mi);
    };
    while (meshInstancesLeftA.length > 0) {
      lists[j] = [meshInstancesLeftA[0]];
      meshInstancesLeftB = [];
      const material = meshInstancesLeftA[0].material;
      const layer = meshInstancesLeftA[0].layer;
      const defs = meshInstancesLeftA[0]._shaderDefs;
      const params = meshInstancesLeftA[0].parameters;
      const stencil = meshInstancesLeftA[0].stencilFront;
      const lightList = meshInstancesLeftA[0]._staticLightList;
      let vertCount = meshInstancesLeftA[0].mesh.vertexBuffer.getNumVertices();
      const drawOrder = meshInstancesLeftA[0].drawOrder;
      aabb.copy(meshInstancesLeftA[0].aabb);
      const scaleSign = getScaleSign(meshInstancesLeftA[0]);
      const vertexFormatBatchingHash = meshInstancesLeftA[0].mesh.vertexBuffer.format.batchingHash;
      const indexed = meshInstancesLeftA[0].mesh.primitive[0].indexed;
      skipTranslucentAabb = null;
      for (let i = 1; i < meshInstancesLeftA.length; i++) {
        const mi = meshInstancesLeftA[i];

        if (dynamic && lists[j].length >= maxInstanceCount) {
          meshInstancesLeftB = meshInstancesLeftB.concat(meshInstancesLeftA.slice(i));
          break;
        }

        if (material !== mi.material || layer !== mi.layer || vertexFormatBatchingHash !== mi.mesh.vertexBuffer.format.batchingHash || indexed !== mi.mesh.primitive[0].indexed || defs !== mi._shaderDefs || vertCount + mi.mesh.vertexBuffer.getNumVertices() > maxNumVertices) {
          skipMesh(mi);
          continue;
        }
        testAabb.copy(aabb);
        testAabb.add(mi.aabb);
        if (testAabb.halfExtents.x > halfMaxAabbSize || testAabb.halfExtents.y > halfMaxAabbSize || testAabb.halfExtents.z > halfMaxAabbSize) {
          skipMesh(mi);
          continue;
        }
        if (stencil) {
          if (!(sf = mi.stencilFront) || stencil.func !== sf.func || stencil.zpass !== sf.zpass) {
            skipMesh(mi);
            continue;
          }
        }
        if (scaleSign !== getScaleSign(mi)) {
          skipMesh(mi);
          continue;
        }

        if (!equalParamSets(params, mi.parameters)) {
          skipMesh(mi);
          continue;
        }
        const staticLights = mi._staticLightList;
        if (lightList && staticLights) {
          if (!equalLightLists(lightList, staticLights)) {
            skipMesh(mi);
            continue;
          }
        } else if (lightList || staticLights) {
          skipMesh(mi);
          continue;
        }
        if (translucent && skipTranslucentAabb && skipTranslucentAabb.intersects(mi.aabb) && mi.drawOrder !== drawOrder) {
          skipMesh(mi);
          continue;
        }
        aabb.add(mi.aabb);
        vertCount += mi.mesh.vertexBuffer.getNumVertices();
        lists[j].push(mi);
      }
      j++;
      meshInstancesLeftA = meshInstancesLeftB;
    }
    return lists;
  }
  collectBatchedMeshData(meshInstances, dynamic) {
    let streams = null;
    let batchNumVerts = 0;
    let batchNumIndices = 0;
    let material = null;
    for (let i = 0; i < meshInstances.length; i++) {
      if (meshInstances[i].visible) {
        const mesh = meshInstances[i].mesh;
        const numVerts = mesh.vertexBuffer.numVertices;
        batchNumVerts += numVerts;

        batchNumIndices += mesh.primitive[0].indexed ? mesh.primitive[0].count : mesh.primitive[0].type === PRIMITIVE_TRIFAN && mesh.primitive[0].count === 4 ? 6 : 0;

        if (!streams) {
          material = meshInstances[i].material;

          streams = {};
          const elems = mesh.vertexBuffer.format.elements;
          for (let j = 0; j < elems.length; j++) {
            const semantic = elems[j].name;
            streams[semantic] = {
              numComponents: elems[j].numComponents,
              dataType: elems[j].dataType,
              normalize: elems[j].normalize,
              count: 0
            };
          }

          if (dynamic) {
            streams[SEMANTIC_BLENDINDICES] = {
              numComponents: 1,
              dataType: TYPE_FLOAT32,
              normalize: false,
              count: 0
            };
          }
        }
      }
    }
    return {
      streams: streams,
      batchNumVerts: batchNumVerts,
      batchNumIndices: batchNumIndices,
      material: material
    };
  }

  create(meshInstances, dynamic, batchGroupId) {
    const time = now();
    if (!this._init) {
      const boneLimit = '#define BONE_LIMIT ' + this.device.getBoneLimit() + '\n';
      this.transformVS = boneLimit + '#define DYNAMICBATCH\n' + shaderChunks.transformVS;
      this.skinTexVS = shaderChunks.skinBatchTexVS;
      this.skinConstVS = shaderChunks.skinBatchConstVS;
      this.vertexFormats = {};
      this._init = true;
    }
    let stream = null;
    let semantic;
    let mesh, numVerts;
    let batch = null;

    const batchData = this.collectBatchedMeshData(meshInstances, dynamic);

    if (batchData.streams) {
      const streams = batchData.streams;
      let material = batchData.material;
      const batchNumVerts = batchData.batchNumVerts;
      const batchNumIndices = batchData.batchNumIndices;
      batch = new Batch(meshInstances, dynamic, batchGroupId);
      this._batchList.push(batch);
      let indexBase, numIndices, indexData;
      let verticesOffset = 0;
      let indexOffset = 0;
      let transform;
      const vec = new Vec3();

      const indexArrayType = batchNumVerts <= 0xffff ? Uint16Array : Uint32Array;
      const indices = new indexArrayType(batchNumIndices);

      for (semantic in streams) {
        stream = streams[semantic];
        stream.typeArrayType = typedArrayTypes[stream.dataType];
        stream.elementByteSize = typedArrayTypesByteSize[stream.dataType];
        stream.buffer = new stream.typeArrayType(batchNumVerts * stream.numComponents);
      }

      for (let i = 0; i < meshInstances.length; i++) {
        if (!meshInstances[i].visible) continue;
        mesh = meshInstances[i].mesh;
        numVerts = mesh.vertexBuffer.numVertices;

        if (!dynamic) {
          transform = meshInstances[i].node.getWorldTransform();
        }
        for (semantic in streams) {
          if (semantic !== SEMANTIC_BLENDINDICES) {
            stream = streams[semantic];

            const subarray = new stream.typeArrayType(stream.buffer.buffer, stream.elementByteSize * stream.count);
            const totalComponents = mesh.getVertexStream(semantic, subarray) * stream.numComponents;
            stream.count += totalComponents;

            if (!dynamic && stream.numComponents >= 3) {
              if (semantic === SEMANTIC_POSITION) {
                for (let j = 0; j < totalComponents; j += stream.numComponents) {
                  vec.set(subarray[j], subarray[j + 1], subarray[j + 2]);
                  transform.transformPoint(vec, vec);
                  subarray[j] = vec.x;
                  subarray[j + 1] = vec.y;
                  subarray[j + 2] = vec.z;
                }
              } else if (semantic === SEMANTIC_NORMAL || semantic === SEMANTIC_TANGENT) {
                transform.invertTo3x3(mat3);
                mat3.transpose();
                for (let j = 0; j < totalComponents; j += stream.numComponents) {
                  vec.set(subarray[j], subarray[j + 1], subarray[j + 2]);
                  mat3.transformVector(vec, vec);
                  subarray[j] = vec.x;
                  subarray[j + 1] = vec.y;
                  subarray[j + 2] = vec.z;
                }
              }
            }
          }
        }

        if (dynamic) {
          stream = streams[SEMANTIC_BLENDINDICES];
          for (let j = 0; j < numVerts; j++) stream.buffer[stream.count++] = i;
        }

        if (mesh.primitive[0].indexed) {
          indexBase = mesh.primitive[0].base;
          numIndices = mesh.primitive[0].count;

          const srcFormat = mesh.indexBuffer[0].getFormat();
          indexData = new typedArrayIndexFormats[srcFormat](mesh.indexBuffer[0].storage);
        } else if (mesh.primitive[0].type === PRIMITIVE_TRIFAN && mesh.primitive[0].count === 4) {
          indexBase = 0;
          numIndices = 6;
          indexData = [0, 1, 3, 2, 3, 1];
        } else {
          numIndices = 0;
          continue;
        }
        for (let j = 0; j < numIndices; j++) {
          indices[j + indexOffset] = indexData[indexBase + j] + verticesOffset;
        }
        indexOffset += numIndices;
        verticesOffset += numVerts;
      }

      mesh = new Mesh(this.device);
      for (semantic in streams) {
        stream = streams[semantic];
        mesh.setVertexStream(semantic, stream.buffer, stream.numComponents, undefined, stream.dataType, stream.normalize);
      }
      if (indices.length > 0) mesh.setIndices(indices);
      mesh.update(PRIMITIVE_TRIANGLES, false);

      if (dynamic) {
        material = material.clone();
        material.chunks.transformVS = this.transformVS;
        material.chunks.skinTexVS = this.skinTexVS;
        material.chunks.skinConstVS = this.skinConstVS;
        material.update();
      }

      const meshInstance = new MeshInstance(mesh, material, this.rootNode);
      meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
      meshInstance.parameters = batch.origMeshInstances[0].parameters;
      meshInstance.isStatic = batch.origMeshInstances[0].isStatic;
      meshInstance.layer = batch.origMeshInstances[0].layer;
      meshInstance._staticLightList = batch.origMeshInstances[0]._staticLightList;
      meshInstance._shaderDefs = batch.origMeshInstances[0]._shaderDefs;

      meshInstance.cull = batch.origMeshInstances[0].cull;
      const batchGroup = this._batchGroups[batchGroupId];
      if (batchGroup && batchGroup._ui) meshInstance.cull = false;
      if (dynamic) {
        const nodes = [];
        for (let i = 0; i < batch.origMeshInstances.length; i++) {
          nodes.push(batch.origMeshInstances[i].node);
        }
        meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
      }

      meshInstance._updateAabb = false;
      meshInstance.drawOrder = batch.origMeshInstances[0].drawOrder;
      meshInstance.stencilFront = batch.origMeshInstances[0].stencilFront;
      meshInstance.stencilBack = batch.origMeshInstances[0].stencilBack;
      meshInstance.flipFaces = getScaleSign(batch.origMeshInstances[0]) < 0;
      meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
      batch.meshInstance = meshInstance;
      batch.updateBoundingBox();
    }
    this._stats.createTime += now() - time;
    return batch;
  }

  updateAll() {

    if (this._dirtyGroups.length > 0) {
      this.generate(this._dirtyGroups);
    }
    const time = now();
    for (let i = 0; i < this._batchList.length; i++) {
      if (!this._batchList[i].dynamic) continue;
      this._batchList[i].updateBoundingBox();
    }
    this._stats.updateLastFrameTime = now() - time;
  }

  clone(batch, clonedMeshInstances) {
    const batch2 = new Batch(clonedMeshInstances, batch.dynamic, batch.batchGroupId);
    this._batchList.push(batch2);
    const nodes = [];
    for (let i = 0; i < clonedMeshInstances.length; i++) {
      nodes.push(clonedMeshInstances[i].node);
    }
    batch2.meshInstance = new MeshInstance(batch.meshInstance.mesh, batch.meshInstance.material, batch.meshInstance.node);
    batch2.meshInstance._updateAabb = false;
    batch2.meshInstance.parameters = clonedMeshInstances[0].parameters;
    batch2.meshInstance.isStatic = clonedMeshInstances[0].isStatic;
    batch2.meshInstance.cull = clonedMeshInstances[0].cull;
    batch2.meshInstance.layer = clonedMeshInstances[0].layer;
    batch2.meshInstance._staticLightList = clonedMeshInstances[0]._staticLightList;
    if (batch.dynamic) {
      batch2.meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
    }
    batch2.meshInstance.castShadow = batch.meshInstance.castShadow;
    batch2.meshInstance._shader = batch.meshInstance._shader.slice();
    batch2.meshInstance.castShadow = batch.meshInstance.castShadow;
    return batch2;
  }

  destroyBatch(batch) {
    batch.destroy(this.scene, this._batchGroups[batch.batchGroupId].layers);
  }
}

export { BatchManager };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2JhdGNoaW5nL2JhdGNoLW1hbmFnZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHtcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTLCBQUklNSVRJVkVfVFJJRkFOLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICBUWVBFX0ZMT0FUMzIsXG4gICAgdHlwZWRBcnJheUluZGV4Rm9ybWF0cywgdHlwZWRBcnJheVR5cGVzLCB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVxufSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi8uLi9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuXG5pbXBvcnQgeyBTUFJJVEVfUkVOREVSTU9ERV9TSU1QTEUgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uL21lc2guanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vbWVzaC1pbnN0YW5jZS5qcyc7XG5cbmltcG9ydCB7IEJhdGNoIH0gZnJvbSAnLi9iYXRjaC5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi9iYXRjaC1ncm91cC5qcyc7XG5pbXBvcnQgeyBTa2luQmF0Y2hJbnN0YW5jZSB9IGZyb20gJy4vc2tpbi1iYXRjaC1pbnN0YW5jZS5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gR3JhcGhpY3NEZXZpY2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9zY2VuZS5qcycpLlNjZW5lfSBTY2VuZSAqL1xuXG5mdW5jdGlvbiBwYXJhbXNJZGVudGljYWwoYSwgYikge1xuICAgIGlmIChhICYmICFiKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCFhICYmIGIpIHJldHVybiBmYWxzZTtcbiAgICBhID0gYS5kYXRhO1xuICAgIGIgPSBiLmRhdGE7XG4gICAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICAgIGlmIChhIGluc3RhbmNlb2YgRmxvYXQzMkFycmF5ICYmIGIgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkpIHtcbiAgICAgICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZXF1YWxQYXJhbVNldHMocGFyYW1zMSwgcGFyYW1zMikge1xuICAgIGZvciAoY29uc3QgcGFyYW0gaW4gcGFyYW1zMSkgeyAvLyBjb21wYXJlIEEgLT4gQlxuICAgICAgICBpZiAocGFyYW1zMS5oYXNPd25Qcm9wZXJ0eShwYXJhbSkgJiYgIXBhcmFtc0lkZW50aWNhbChwYXJhbXMxW3BhcmFtXSwgcGFyYW1zMltwYXJhbV0pKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmFtIGluIHBhcmFtczIpIHsgLy8gY29tcGFyZSBCIC0+IEFcbiAgICAgICAgaWYgKHBhcmFtczIuaGFzT3duUHJvcGVydHkocGFyYW0pICYmICFwYXJhbXNJZGVudGljYWwocGFyYW1zMltwYXJhbV0sIHBhcmFtczFbcGFyYW1dKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGVxdWFsTGlnaHRMaXN0cyhsaWdodExpc3QxLCBsaWdodExpc3QyKSB7XG4gICAgZm9yIChsZXQgayA9IDA7IGsgPCBsaWdodExpc3QxLmxlbmd0aDsgaysrKSB7XG4gICAgICAgIGlmIChsaWdodExpc3QyLmluZGV4T2YobGlnaHRMaXN0MVtrXSkgPCAwKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmb3IgKGxldCBrID0gMDsgayA8IGxpZ2h0TGlzdDIubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgaWYgKGxpZ2h0TGlzdDEuaW5kZXhPZihsaWdodExpc3QyW2tdKSA8IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxuXG5jb25zdCBtYXQzID0gbmV3IE1hdDMoKTtcblxuY29uc3Qgd29ybGRNYXRYID0gbmV3IFZlYzMoKTtcbmNvbnN0IHdvcmxkTWF0WSA9IG5ldyBWZWMzKCk7XG5jb25zdCB3b3JsZE1hdFogPSBuZXcgVmVjMygpO1xuZnVuY3Rpb24gZ2V0U2NhbGVTaWduKG1pKSB7XG4gICAgY29uc3Qgd3QgPSBtaS5ub2RlLndvcmxkVHJhbnNmb3JtO1xuICAgIHd0LmdldFgod29ybGRNYXRYKTtcbiAgICB3dC5nZXRZKHdvcmxkTWF0WSk7XG4gICAgd3QuZ2V0Wih3b3JsZE1hdFopO1xuICAgIHdvcmxkTWF0WC5jcm9zcyh3b3JsZE1hdFgsIHdvcmxkTWF0WSk7XG4gICAgcmV0dXJuIHdvcmxkTWF0WC5kb3Qod29ybGRNYXRaKSA+PSAwID8gMSA6IC0xO1xufVxuXG4vKipcbiAqIEdsdWVzIG1hbnkgbWVzaCBpbnN0YW5jZXMgaW50byBhIHNpbmdsZSBvbmUgZm9yIGJldHRlciBwZXJmb3JtYW5jZS5cbiAqL1xuY2xhc3MgQmF0Y2hNYW5hZ2VyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQmF0Y2hNYW5hZ2VyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIGJ5IHRoZSBiYXRjaCBtYW5hZ2VyLlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSByb290IC0gVGhlIGVudGl0eSB1bmRlciB3aGljaCBiYXRjaGVkIG1vZGVscyBhcmUgYWRkZWQuXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUgdGhhdCB0aGUgYmF0Y2ggbWFuYWdlciBhZmZlY3RzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgcm9vdCwgc2NlbmUpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIHRoaXMucm9vdE5vZGUgPSByb290O1xuICAgICAgICB0aGlzLnNjZW5lID0gc2NlbmU7XG4gICAgICAgIHRoaXMuX2luaXQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwcyA9IHt9O1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwQ291bnRlciA9IDA7XG4gICAgICAgIHRoaXMuX2JhdGNoTGlzdCA9IFtdO1xuICAgICAgICB0aGlzLl9kaXJ0eUdyb3VwcyA9IFtdO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc3RhdHMgPSB7XG4gICAgICAgICAgICBjcmVhdGVUaW1lOiAwLFxuICAgICAgICAgICAgdXBkYXRlTGFzdEZyYW1lVGltZTogMFxuICAgICAgICB9O1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmRldmljZSA9IG51bGw7XG4gICAgICAgIHRoaXMucm9vdE5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cHMgPSB7fTtcbiAgICAgICAgdGhpcy5fYmF0Y2hMaXN0ID0gW107XG4gICAgICAgIHRoaXMuX2RpcnR5R3JvdXBzID0gW107XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBuZXcgZ2xvYmFsIGJhdGNoIGdyb3VwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBDdXN0b20gbmFtZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGR5bmFtaWMgLSBJcyB0aGlzIGJhdGNoIGdyb3VwIGR5bmFtaWM/IFdpbGwgdGhlc2Ugb2JqZWN0cyBtb3ZlL3JvdGF0ZS9zY2FsZVxuICAgICAqIGFmdGVyIGJlaW5nIGJhdGNoZWQ/XG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heEFhYmJTaXplIC0gTWF4aW11bSBzaXplIG9mIGFueSBkaW1lbnNpb24gb2YgYSBib3VuZGluZyBib3ggYXJvdW5kIGJhdGNoZWRcbiAgICAgKiBvYmplY3RzLlxuICAgICAqIHtAbGluayBCYXRjaE1hbmFnZXIjcHJlcGFyZX0gd2lsbCBzcGxpdCBvYmplY3RzIGludG8gbG9jYWwgZ3JvdXBzIGJhc2VkIG9uIHRoaXMgc2l6ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2lkXSAtIE9wdGlvbmFsIGN1c3RvbSB1bmlxdWUgaWQgZm9yIHRoZSBncm91cCAod2lsbCBiZSBnZW5lcmF0ZWRcbiAgICAgKiBhdXRvbWF0aWNhbGx5IG90aGVyd2lzZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gW2xheWVyc10gLSBPcHRpb25hbCBsYXllciBJRCBhcnJheS4gRGVmYXVsdCBpcyBbe0BsaW5rIExBWUVSSURfV09STER9XS5cbiAgICAgKiBUaGUgd2hvbGUgYmF0Y2ggZ3JvdXAgd2lsbCBiZWxvbmcgdG8gdGhlc2UgbGF5ZXJzLiBMYXllcnMgb2Ygc291cmNlIG1vZGVscyB3aWxsIGJlIGlnbm9yZWQuXG4gICAgICogQHJldHVybnMge0JhdGNoR3JvdXB9IEdyb3VwIG9iamVjdC5cbiAgICAgKi9cbiAgICBhZGRHcm91cChuYW1lLCBkeW5hbWljLCBtYXhBYWJiU2l6ZSwgaWQsIGxheWVycykge1xuICAgICAgICBpZiAoaWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWQgPSB0aGlzLl9iYXRjaEdyb3VwQ291bnRlcjtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoR3JvdXBDb3VudGVyKys7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cHNbaWRdKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihgQmF0Y2ggZ3JvdXAgd2l0aCBpZCAke2lkfSBhbHJlYWR5IGV4aXN0cy5gKTtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBncm91cCA9IG5ldyBCYXRjaEdyb3VwKGlkLCBuYW1lLCBkeW5hbWljLCBtYXhBYWJiU2l6ZSwgbGF5ZXJzKTtcbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cHNbaWRdID0gZ3JvdXA7XG5cbiAgICAgICAgcmV0dXJuIGdyb3VwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBnbG9iYWwgYmF0Y2ggZ3JvdXAgYnkgaWQuIE5vdGUsIHRoaXMgdHJhdmVyc2VzIHRoZSBlbnRpcmUgc2NlbmUgZ3JhcGggYW5kIGNsZWFycyB0aGVcbiAgICAgKiBiYXRjaCBncm91cCBpZCBmcm9tIGFsbCBjb21wb25lbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlkIC0gQmF0Y2ggR3JvdXAgSUQuXG4gICAgICovXG4gICAgcmVtb3ZlR3JvdXAoaWQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9iYXRjaEdyb3Vwc1tpZF0pIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKGBCYXRjaCBncm91cCB3aXRoIGlkICR7aWR9IGRvZXNuJ3QgZXhpc3QuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZWxldGUgYmF0Y2hlcyB3aXRoIG1hdGNoaW5nIGlkXG4gICAgICAgIGNvbnN0IG5ld0JhdGNoTGlzdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2JhdGNoTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2JhdGNoTGlzdFtpXS5iYXRjaEdyb3VwSWQgPT09IGlkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZXN0cm95QmF0Y2godGhpcy5fYmF0Y2hMaXN0W2ldKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbmV3QmF0Y2hMaXN0LnB1c2godGhpcy5fYmF0Y2hMaXN0W2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9iYXRjaExpc3QgPSBuZXdCYXRjaExpc3Q7XG4gICAgICAgIHRoaXMuX3JlbW92ZU1vZGVsc0Zyb21CYXRjaEdyb3VwKHRoaXMucm9vdE5vZGUsIGlkKTtcblxuICAgICAgICBkZWxldGUgdGhpcy5fYmF0Y2hHcm91cHNbaWRdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmsgYSBzcGVjaWZpYyBiYXRjaCBncm91cCBhcyBkaXJ0eS4gRGlydHkgZ3JvdXBzIGFyZSByZS1iYXRjaGVkIGJlZm9yZSB0aGUgbmV4dCBmcmFtZSBpc1xuICAgICAqIHJlbmRlcmVkLiBOb3RlLCByZS1iYXRjaGluZyBhIGdyb3VwIGlzIGEgcG90ZW50aWFsbHkgZXhwZW5zaXZlIG9wZXJhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpZCAtIEJhdGNoIEdyb3VwIElEIHRvIG1hcmsgYXMgZGlydHkuXG4gICAgICovXG4gICAgbWFya0dyb3VwRGlydHkoaWQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5R3JvdXBzLmluZGV4T2YoaWQpIDwgMCkge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlHcm91cHMucHVzaChpZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgYSB7QGxpbmsgQmF0Y2hHcm91cH0gb2JqZWN0IHdpdGggYSBjb3JyZXNwb25kaW5nIG5hbWUsIGlmIGl0IGV4aXN0cywgb3IgbnVsbFxuICAgICAqIG90aGVyd2lzZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gTmFtZS5cbiAgICAgKiBAcmV0dXJucyB7QmF0Y2hHcm91cHxudWxsfSBUaGUgYmF0Y2ggZ3JvdXAgbWF0Y2hpbmcgdGhlIG5hbWUgb3IgbnVsbCBpZiBub3QgZm91bmQuXG4gICAgICovXG4gICAgZ2V0R3JvdXBCeU5hbWUobmFtZSkge1xuICAgICAgICBjb25zdCBncm91cHMgPSB0aGlzLl9iYXRjaEdyb3VwcztcbiAgICAgICAgZm9yIChjb25zdCBncm91cCBpbiBncm91cHMpIHtcbiAgICAgICAgICAgIGlmICghZ3JvdXBzLmhhc093blByb3BlcnR5KGdyb3VwKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoZ3JvdXBzW2dyb3VwXS5uYW1lID09PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGdyb3Vwc1tncm91cF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGEgbGlzdCBvZiBhbGwge0BsaW5rIEJhdGNofSBvYmplY3RzIHRoYXQgYmVsb25nIHRvIHRoZSBCYXRjaCBHcm91cCBzdXBwbGllZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiYXRjaEdyb3VwSWQgLSBUaGUgaWQgb2YgdGhlIGJhdGNoIGdyb3VwLlxuICAgICAqIEByZXR1cm5zIHtCYXRjaFtdfSBBIGxpc3Qgb2YgYmF0Y2hlcyB0aGF0IGFyZSB1c2VkIHRvIHJlbmRlciB0aGUgYmF0Y2ggZ3JvdXAuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBnZXRCYXRjaGVzKGJhdGNoR3JvdXBJZCkge1xuICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgICAgIGNvbnN0IGxlbiA9IHRoaXMuX2JhdGNoTGlzdC5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoID0gdGhpcy5fYmF0Y2hMaXN0W2ldO1xuICAgICAgICAgICAgaWYgKGJhdGNoLmJhdGNoR3JvdXBJZCA9PT0gYmF0Y2hHcm91cElkKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKGJhdGNoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIC8vIHRyYXZlcnNlIGZ1bGwgaGllcmFyY2h5IGFuZCBjbGVhciB0aGUgYmF0Y2ggZ3JvdXAgaWQgZnJvbSBhbGwgbW9kZWwsIGVsZW1lbnQgYW5kIHNwcml0ZSBjb21wb25lbnRzXG4gICAgX3JlbW92ZU1vZGVsc0Zyb21CYXRjaEdyb3VwKG5vZGUsIGlkKSB7XG4gICAgICAgIGlmICghbm9kZS5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKG5vZGUubW9kZWwgJiYgbm9kZS5tb2RlbC5iYXRjaEdyb3VwSWQgPT09IGlkKSB7XG4gICAgICAgICAgICBub2RlLm1vZGVsLmJhdGNoR3JvdXBJZCA9IC0xO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLnJlbmRlciAmJiBub2RlLnJlbmRlci5iYXRjaEdyb3VwSWQgPT09IGlkKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlci5iYXRjaEdyb3VwSWQgPSAtMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5lbGVtZW50ICYmIG5vZGUuZWxlbWVudC5iYXRjaEdyb3VwSWQgPT09IGlkKSB7XG4gICAgICAgICAgICBub2RlLmVsZW1lbnQuYmF0Y2hHcm91cElkID0gLTE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUuc3ByaXRlICYmIG5vZGUuc3ByaXRlLmJhdGNoR3JvdXBJZCA9PT0gaWQpIHtcbiAgICAgICAgICAgIG5vZGUuc3ByaXRlLmJhdGNoR3JvdXBJZCA9IC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLl9jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlTW9kZWxzRnJvbUJhdGNoR3JvdXAobm9kZS5fY2hpbGRyZW5baV0sIGlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGluc2VydCh0eXBlLCBncm91cElkLCBub2RlKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwID0gdGhpcy5fYmF0Y2hHcm91cHNbZ3JvdXBJZF07XG4gICAgICAgIERlYnVnLmFzc2VydChncm91cCwgYEludmFsaWQgYmF0Y2ggJHtncm91cElkfSBpbnNlcnRpb25gKTtcblxuICAgICAgICBpZiAoZ3JvdXApIHtcbiAgICAgICAgICAgIGlmIChncm91cC5fb2JqW3R5cGVdLmluZGV4T2Yobm9kZSkgPCAwKSB7XG4gICAgICAgICAgICAgICAgZ3JvdXAuX29ialt0eXBlXS5wdXNoKG5vZGUpO1xuICAgICAgICAgICAgICAgIHRoaXMubWFya0dyb3VwRGlydHkoZ3JvdXBJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmUodHlwZSwgZ3JvdXBJZCwgbm9kZSkge1xuICAgICAgICBjb25zdCBncm91cCA9IHRoaXMuX2JhdGNoR3JvdXBzW2dyb3VwSWRdO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZ3JvdXAsIGBJbnZhbGlkIGJhdGNoICR7Z3JvdXBJZH0gaW5zZXJ0aW9uYCk7XG5cbiAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICBjb25zdCBpZHggPSBncm91cC5fb2JqW3R5cGVdLmluZGV4T2Yobm9kZSk7XG4gICAgICAgICAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgICAgICAgICAgICBncm91cC5fb2JqW3R5cGVdLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMubWFya0dyb3VwRGlydHkoZ3JvdXBJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZXh0cmFjdFJlbmRlcihub2RlLCBhcnIsIGdyb3VwLCBncm91cE1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgaWYgKG5vZGUucmVuZGVyKSB7XG5cbiAgICAgICAgICAgIGlmIChub2RlLnJlbmRlci5pc1N0YXRpYykge1xuICAgICAgICAgICAgICAgIC8vIHN0YXRpYyBtZXNoIGluc3RhbmNlcyBjYW4gYmUgaW4gYm90aCBkcmF3Q2FsbCBhcnJheSB3aXRoIF9zdGF0aWNTb3VyY2UgbGlua2luZyB0byBvcmlnaW5hbFxuICAgICAgICAgICAgICAgIC8vIGFuZCBpbiB0aGUgb3JpZ2luYWwgYXJyYXkgYXMgd2VsbCwgaWYgbm8gdHJpYW5nbGUgc3BsaXR0aW5nIHdhcyBkb25lXG4gICAgICAgICAgICAgICAgY29uc3QgZHJhd0NhbGxzID0gdGhpcy5zY2VuZS5kcmF3Q2FsbHM7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZU1lc2hJbnN0YW5jZXMgPSBub2RlLnJlbmRlci5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGxzW2ldLl9zdGF0aWNTb3VyY2UpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZU1lc2hJbnN0YW5jZXMuaW5kZXhPZihkcmF3Q2FsbHNbaV0uX3N0YXRpY1NvdXJjZSkgPCAwKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgYXJyLnB1c2goZHJhd0NhbGxzW2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlTWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGxzLmluZGV4T2Yobm9kZU1lc2hJbnN0YW5jZXNbaV0pID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyci5wdXNoKG5vZGVNZXNoSW5zdGFuY2VzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXJyID0gZ3JvdXBNZXNoSW5zdGFuY2VzW25vZGUucmVuZGVyLmJhdGNoR3JvdXBJZF0gPSBhcnIuY29uY2F0KG5vZGUucmVuZGVyLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub2RlLnJlbmRlci5yZW1vdmVGcm9tTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXJyO1xuICAgIH1cblxuICAgIF9leHRyYWN0TW9kZWwobm9kZSwgYXJyLCBncm91cCwgZ3JvdXBNZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGlmIChub2RlLm1vZGVsICYmIG5vZGUubW9kZWwubW9kZWwpIHtcbiAgICAgICAgICAgIGlmIChub2RlLm1vZGVsLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgLy8gc3RhdGljIG1lc2ggaW5zdGFuY2VzIGNhbiBiZSBpbiBib3RoIGRyYXdDYWxsIGFycmF5IHdpdGggX3N0YXRpY1NvdXJjZSBsaW5raW5nIHRvIG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgLy8gYW5kIGluIHRoZSBvcmlnaW5hbCBhcnJheSBhcyB3ZWxsLCBpZiBubyB0cmlhbmdsZSBzcGxpdHRpbmcgd2FzIGRvbmVcbiAgICAgICAgICAgICAgICBjb25zdCBkcmF3Q2FsbHMgPSB0aGlzLnNjZW5lLmRyYXdDYWxscztcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlTWVzaEluc3RhbmNlcyA9IG5vZGUubW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsc1tpXS5fc3RhdGljU291cmNlKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGVNZXNoSW5zdGFuY2VzLmluZGV4T2YoZHJhd0NhbGxzW2ldLl9zdGF0aWNTb3VyY2UpIDwgMCkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGFyci5wdXNoKGRyYXdDYWxsc1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZU1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxscy5pbmRleE9mKG5vZGVNZXNoSW5zdGFuY2VzW2ldKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcnIucHVzaChub2RlTWVzaEluc3RhbmNlc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFyciA9IGdyb3VwTWVzaEluc3RhbmNlc1tub2RlLm1vZGVsLmJhdGNoR3JvdXBJZF0gPSBhcnIuY29uY2F0KG5vZGUubW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUubW9kZWwucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCk7XG5cbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIG5vZGUubW9kZWwuX2JhdGNoR3JvdXAgPSBncm91cDtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFycjtcbiAgICB9XG5cbiAgICBfZXh0cmFjdEVsZW1lbnQobm9kZSwgYXJyLCBncm91cCkge1xuICAgICAgICBpZiAoIW5vZGUuZWxlbWVudCkgcmV0dXJuO1xuICAgICAgICBsZXQgdmFsaWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKG5vZGUuZWxlbWVudC5fdGV4dCAmJiBub2RlLmVsZW1lbnQuX3RleHQuX21vZGVsLm1lc2hJbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgYXJyLnB1c2gobm9kZS5lbGVtZW50Ll90ZXh0Ll9tb2RlbC5tZXNoSW5zdGFuY2VzWzBdKTtcbiAgICAgICAgICAgIG5vZGUuZWxlbWVudC5yZW1vdmVNb2RlbEZyb21MYXllcnMobm9kZS5lbGVtZW50Ll90ZXh0Ll9tb2RlbCk7XG5cbiAgICAgICAgICAgIHZhbGlkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChub2RlLmVsZW1lbnQuX2ltYWdlKSB7XG4gICAgICAgICAgICBhcnIucHVzaChub2RlLmVsZW1lbnQuX2ltYWdlLl9yZW5kZXJhYmxlLm1lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICBub2RlLmVsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKG5vZGUuZWxlbWVudC5faW1hZ2UuX3JlbmRlcmFibGUubW9kZWwpO1xuXG4gICAgICAgICAgICBpZiAobm9kZS5lbGVtZW50Ll9pbWFnZS5fcmVuZGVyYWJsZS51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBhcnIucHVzaChub2RlLmVsZW1lbnQuX2ltYWdlLl9yZW5kZXJhYmxlLnVubWFza01lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFub2RlLmVsZW1lbnQuX2ltYWdlLl9yZW5kZXJhYmxlLnVubWFza01lc2hJbnN0YW5jZS5zdGVuY2lsRnJvbnQgfHxcbiAgICAgICAgICAgICAgICAgICAgIW5vZGUuZWxlbWVudC5faW1hZ2UuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUuZWxlbWVudC5fZGlydGlmeU1hc2soKTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5lbGVtZW50Ll9vblByZXJlbmRlcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFsaWQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbGlkKSB7XG4gICAgICAgICAgICBncm91cC5fdWkgPSB0cnVlO1xuICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgbm9kZS5lbGVtZW50Ll9iYXRjaEdyb3VwID0gZ3JvdXA7XG4gICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHRyYXZlcnNlIHNjZW5lIGhpZXJhcmNoeSBkb3duIGZyb20gYG5vZGVgIGFuZCBjb2xsZWN0IGFsbCBjb21wb25lbnRzIHRoYXQgYXJlIG1hcmtlZFxuICAgIC8vIHdpdGggYSBiYXRjaCBncm91cCBpZC4gUmVtb3ZlIGZyb20gbGF5ZXJzIGFueSBtb2RlbHMgdGhhdCB0aGVzZSBjb21wb25lbnRzIGNvbnRhaW5zLlxuICAgIC8vIEZpbGwgdGhlIGBncm91cE1lc2hJbnN0YW5jZXNgIHdpdGggYWxsIHRoZSBtZXNoIGluc3RhbmNlcyB0byBiZSBpbmNsdWRlZCBpbiB0aGUgYmF0Y2ggZ3JvdXBzLFxuICAgIC8vIGluZGV4ZWQgYnkgYmF0Y2ggZ3JvdXAgaWQuXG4gICAgX2NvbGxlY3RBbmRSZW1vdmVNZXNoSW5zdGFuY2VzKGdyb3VwTWVzaEluc3RhbmNlcywgZ3JvdXBJZHMpIHtcbiAgICAgICAgZm9yIChsZXQgZyA9IDA7IGcgPCBncm91cElkcy5sZW5ndGg7IGcrKykge1xuICAgICAgICAgICAgY29uc3QgaWQgPSBncm91cElkc1tnXTtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gdGhpcy5fYmF0Y2hHcm91cHNbaWRdO1xuICAgICAgICAgICAgaWYgKCFncm91cCkgY29udGludWU7XG4gICAgICAgICAgICBsZXQgYXJyID0gZ3JvdXBNZXNoSW5zdGFuY2VzW2lkXTtcbiAgICAgICAgICAgIGlmICghYXJyKSBhcnIgPSBncm91cE1lc2hJbnN0YW5jZXNbaWRdID0gW107XG5cbiAgICAgICAgICAgIGZvciAobGV0IG0gPSAwOyBtIDwgZ3JvdXAuX29iai5tb2RlbC5sZW5ndGg7IG0rKykge1xuICAgICAgICAgICAgICAgIGFyciA9IHRoaXMuX2V4dHJhY3RNb2RlbChncm91cC5fb2JqLm1vZGVsW21dLCBhcnIsIGdyb3VwLCBncm91cE1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCByID0gMDsgciA8IGdyb3VwLl9vYmoucmVuZGVyLmxlbmd0aDsgcisrKSB7XG4gICAgICAgICAgICAgICAgYXJyID0gdGhpcy5fZXh0cmFjdFJlbmRlcihncm91cC5fb2JqLnJlbmRlcltyXSwgYXJyLCBncm91cCwgZ3JvdXBNZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgZSA9IDA7IGUgPCBncm91cC5fb2JqLmVsZW1lbnQubGVuZ3RoOyBlKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9leHRyYWN0RWxlbWVudChncm91cC5fb2JqLmVsZW1lbnRbZV0sIGFyciwgZ3JvdXApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBzID0gMDsgcyA8IGdyb3VwLl9vYmouc3ByaXRlLmxlbmd0aDsgcysrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGdyb3VwLl9vYmouc3ByaXRlW3NdO1xuICAgICAgICAgICAgICAgIGlmIChub2RlLnNwcml0ZSAmJiBub2RlLnNwcml0ZS5fbWVzaEluc3RhbmNlICYmXG4gICAgICAgICAgICAgICAgICAgIChncm91cC5keW5hbWljIHx8IG5vZGUuc3ByaXRlLnNwcml0ZS5fcmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFKSkge1xuICAgICAgICAgICAgICAgICAgICBhcnIucHVzaChub2RlLnNwcml0ZS5fbWVzaEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5zcHJpdGUucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCk7XG4gICAgICAgICAgICAgICAgICAgIGdyb3VwLl9zcHJpdGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBub2RlLnNwcml0ZS5fYmF0Y2hHcm91cCA9IGdyb3VwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIGFsbCBiYXRjaGVzIGFuZCBjcmVhdGVzIG5ldyBiYXNlZCBvbiBzY2VuZSBtb2RlbHMuIEhpZGVzIG9yaWdpbmFsIG1vZGVscy4gQ2FsbGVkIGJ5XG4gICAgICogZW5naW5lIGF1dG9tYXRpY2FsbHkgb24gYXBwIHN0YXJ0LCBhbmQgaWYgYmF0Y2hHcm91cElkcyBvbiBtb2RlbHMgYXJlIGNoYW5nZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBbZ3JvdXBJZHNdIC0gT3B0aW9uYWwgYXJyYXkgb2YgYmF0Y2ggZ3JvdXAgSURzIHRvIHVwZGF0ZS4gT3RoZXJ3aXNlIGFsbFxuICAgICAqIGdyb3VwcyBhcmUgdXBkYXRlZC5cbiAgICAgKi9cbiAgICBnZW5lcmF0ZShncm91cElkcykge1xuICAgICAgICBjb25zdCBncm91cE1lc2hJbnN0YW5jZXMgPSB7fTtcblxuICAgICAgICBpZiAoIWdyb3VwSWRzKSB7XG4gICAgICAgICAgICAvLyBGdWxsIHNjZW5lXG4gICAgICAgICAgICBncm91cElkcyA9IE9iamVjdC5rZXlzKHRoaXMuX2JhdGNoR3JvdXBzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBvbGQgYmF0Y2hlcyB3aXRoIG1hdGNoaW5nIGJhdGNoR3JvdXBJZFxuICAgICAgICBjb25zdCBuZXdCYXRjaExpc3QgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9iYXRjaExpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChncm91cElkcy5pbmRleE9mKHRoaXMuX2JhdGNoTGlzdFtpXS5iYXRjaEdyb3VwSWQpIDwgMCkge1xuICAgICAgICAgICAgICAgIG5ld0JhdGNoTGlzdC5wdXNoKHRoaXMuX2JhdGNoTGlzdFtpXSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lCYXRjaCh0aGlzLl9iYXRjaExpc3RbaV0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2JhdGNoTGlzdCA9IG5ld0JhdGNoTGlzdDtcblxuICAgICAgICAvLyBjb2xsZWN0XG4gICAgICAgIHRoaXMuX2NvbGxlY3RBbmRSZW1vdmVNZXNoSW5zdGFuY2VzKGdyb3VwTWVzaEluc3RhbmNlcywgZ3JvdXBJZHMpO1xuXG4gICAgICAgIGlmIChncm91cElkcyA9PT0gdGhpcy5fZGlydHlHcm91cHMpIHtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5R3JvdXBzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBuZXdEaXJ0eUdyb3VwcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9kaXJ0eUdyb3Vwcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChncm91cElkcy5pbmRleE9mKHRoaXMuX2RpcnR5R3JvdXBzW2ldKSA8IDApIG5ld0RpcnR5R3JvdXBzLnB1c2godGhpcy5fZGlydHlHcm91cHNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fZGlydHlHcm91cHMgPSBuZXdEaXJ0eUdyb3VwcztcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBncm91cCwgbGlzdHMsIGdyb3VwRGF0YSwgYmF0Y2g7XG4gICAgICAgIGZvciAoY29uc3QgZ3JvdXBJZCBpbiBncm91cE1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGlmICghZ3JvdXBNZXNoSW5zdGFuY2VzLmhhc093blByb3BlcnR5KGdyb3VwSWQpKSBjb250aW51ZTtcbiAgICAgICAgICAgIGdyb3VwID0gZ3JvdXBNZXNoSW5zdGFuY2VzW2dyb3VwSWRdO1xuXG4gICAgICAgICAgICBncm91cERhdGEgPSB0aGlzLl9iYXRjaEdyb3Vwc1tncm91cElkXTtcbiAgICAgICAgICAgIGlmICghZ3JvdXBEYXRhKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYGJhdGNoIGdyb3VwICR7Z3JvdXBJZH0gbm90IGZvdW5kYCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxpc3RzID0gdGhpcy5wcmVwYXJlKGdyb3VwLCBncm91cERhdGEuZHluYW1pYywgZ3JvdXBEYXRhLm1heEFhYmJTaXplLCBncm91cERhdGEuX3VpIHx8IGdyb3VwRGF0YS5fc3ByaXRlKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBiYXRjaCA9IHRoaXMuY3JlYXRlKGxpc3RzW2ldLCBncm91cERhdGEuZHluYW1pYywgcGFyc2VJbnQoZ3JvdXBJZCwgMTApKTtcbiAgICAgICAgICAgICAgICBpZiAoYmF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgYmF0Y2guYWRkVG9MYXllcnModGhpcy5zY2VuZSwgZ3JvdXBEYXRhLmxheWVycyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBUYWtlcyBhIGxpc3Qgb2YgbWVzaCBpbnN0YW5jZXMgdG8gYmUgYmF0Y2hlZCBhbmQgc29ydHMgdGhlbSBpbnRvIGxpc3RzIG9uZSBmb3IgZWFjaCBkcmF3XG4gICAgICogY2FsbC4gVGhlIGlucHV0IGxpc3Qgd2lsbCBiZSBzcGxpdCwgaWY6XG4gICAgICpcbiAgICAgKiAtIE1lc2ggaW5zdGFuY2VzIHVzZSBkaWZmZXJlbnQgbWF0ZXJpYWxzLlxuICAgICAqIC0gTWVzaCBpbnN0YW5jZXMgaGF2ZSBkaWZmZXJlbnQgcGFyYW1ldGVycyAoZS5nLiBsaWdodG1hcHMgb3Igc3RhdGljIGxpZ2h0cykuXG4gICAgICogLSBNZXNoIGluc3RhbmNlcyBoYXZlIGRpZmZlcmVudCBzaGFkZXIgZGVmaW5lcyAoc2hhZG93IHJlY2VpdmluZywgYmVpbmcgYWxpZ25lZCB0byBzY3JlZW5cbiAgICAgKiBzcGFjZSwgZXRjKS5cbiAgICAgKiAtIFRvbyBtYW55IHZlcnRpY2VzIGZvciBhIHNpbmdsZSBiYXRjaCAoNjU1MzUgaXMgbWF4aW11bSkuXG4gICAgICogLSBUb28gbWFueSBpbnN0YW5jZXMgZm9yIGEgc2luZ2xlIGJhdGNoIChoYXJkd2FyZS1kZXBlbmRlbnQsIGV4cGVjdCAxMjggb24gbG93LWVuZCBhbmQgMTAyNFxuICAgICAqIG9uIGhpZ2gtZW5kKS5cbiAgICAgKiAtIEJvdW5kaW5nIGJveCBvZiBhIGJhdGNoIGlzIGxhcmdlciB0aGFuIG1heEFhYmJTaXplIGluIGFueSBkaW1lbnNpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gSW5wdXQgbGlzdCBvZiBtZXNoIGluc3RhbmNlc1xuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZHluYW1pYyAtIEFyZSB3ZSBwcmVwYXJpbmcgZm9yIGEgZHluYW1pYyBiYXRjaD8gSW5zdGFuY2UgY291bnQgd2lsbCBtYXR0ZXJcbiAgICAgKiB0aGVuIChvdGhlcndpc2Ugbm90KS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4QWFiYlNpemUgLSBNYXhpbXVtIHNpemUgb2YgYW55IGRpbWVuc2lvbiBvZiBhIGJvdW5kaW5nIGJveCBhcm91bmQgYmF0Y2hlZFxuICAgICAqIG9iamVjdHMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB0cmFuc2x1Y2VudCAtIEFyZSB3ZSBiYXRjaGluZyBVSSBlbGVtZW50cyBvciBzcHJpdGVzXG4gICAgICogVGhpcyBpcyB1c2VmdWwgdG8ga2VlcCBhIGJhbGFuY2UgYmV0d2VlbiB0aGUgbnVtYmVyIG9mIGRyYXcgY2FsbHMgYW5kIHRoZSBudW1iZXIgb2YgZHJhd25cbiAgICAgKiB0cmlhbmdsZXMsIGJlY2F1c2Ugc21hbGxlciBiYXRjaGVzIGNhbiBiZSBoaWRkZW4gd2hlbiBub3QgdmlzaWJsZSBpbiBjYW1lcmEuXG4gICAgICogQHJldHVybnMge01lc2hJbnN0YW5jZVtdW119IEFuIGFycmF5IG9mIGFycmF5cyBvZiBtZXNoIGluc3RhbmNlcywgZWFjaCB2YWxpZCB0byBwYXNzIHRvXG4gICAgICoge0BsaW5rIEJhdGNoTWFuYWdlciNjcmVhdGV9LlxuICAgICAqL1xuICAgIHByZXBhcmUobWVzaEluc3RhbmNlcywgZHluYW1pYywgbWF4QWFiYlNpemUgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksIHRyYW5zbHVjZW50KSB7XG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuICAgICAgICBjb25zdCBoYWxmTWF4QWFiYlNpemUgPSBtYXhBYWJiU2l6ZSAqIDAuNTtcbiAgICAgICAgY29uc3QgbWF4SW5zdGFuY2VDb3VudCA9IHRoaXMuZGV2aWNlLnN1cHBvcnRzQm9uZVRleHR1cmVzID8gMTAyNCA6IHRoaXMuZGV2aWNlLmJvbmVMaW1pdDtcblxuICAgICAgICAvLyBtYXhpbXVtIG51bWJlciBvZiB2ZXJ0aWNlcyB0aGF0IGNhbiBiZSB1c2VkIGluIGJhdGNoIGRlcGVuZHMgb24gMzJiaXQgaW5kZXggYnVmZmVyIHN1cHBvcnQgKGRvIHRoaXMgZm9yIG5vbi1pbmRleGVkIGFzIHdlbGwsXG4gICAgICAgIC8vIGFzIGluIHNvbWUgY2FzZXMgKFVJIGVsZW1lbnRzKSBub24taW5kZXhlZCBnZW9tZXRyeSBnZXRzIGJhdGNoZWQgaW50byBpbmRleGVkKVxuICAgICAgICBjb25zdCBtYXhOdW1WZXJ0aWNlcyA9IHRoaXMuZGV2aWNlLmV4dFVpbnRFbGVtZW50ID8gMHhmZmZmZmZmZiA6IDB4ZmZmZjtcblxuICAgICAgICBjb25zdCBhYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIGNvbnN0IHRlc3RBYWJiID0gbmV3IEJvdW5kaW5nQm94KCk7XG4gICAgICAgIGxldCBza2lwVHJhbnNsdWNlbnRBYWJiID0gbnVsbDtcbiAgICAgICAgbGV0IHNmO1xuXG4gICAgICAgIGNvbnN0IGxpc3RzID0gW107XG4gICAgICAgIGxldCBqID0gMDtcbiAgICAgICAgaWYgKHRyYW5zbHVjZW50KSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYS5kcmF3T3JkZXIgLSBiLmRyYXdPcmRlcjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGxldCBtZXNoSW5zdGFuY2VzTGVmdEEgPSBtZXNoSW5zdGFuY2VzO1xuICAgICAgICBsZXQgbWVzaEluc3RhbmNlc0xlZnRCO1xuXG4gICAgICAgIGNvbnN0IHNraXBNZXNoID0gdHJhbnNsdWNlbnQgPyBmdW5jdGlvbiAobWkpIHtcbiAgICAgICAgICAgIGlmIChza2lwVHJhbnNsdWNlbnRBYWJiKSB7XG4gICAgICAgICAgICAgICAgc2tpcFRyYW5zbHVjZW50QWFiYi5hZGQobWkuYWFiYik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNraXBUcmFuc2x1Y2VudEFhYmIgPSBtaS5hYWJiLmNsb25lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzTGVmdEIucHVzaChtaSk7XG4gICAgICAgIH0gOiBmdW5jdGlvbiAobWkpIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNMZWZ0Qi5wdXNoKG1pKTtcbiAgICAgICAgfTtcblxuICAgICAgICB3aGlsZSAobWVzaEluc3RhbmNlc0xlZnRBLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxpc3RzW2pdID0gW21lc2hJbnN0YW5jZXNMZWZ0QVswXV07XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzTGVmdEIgPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLm1hdGVyaWFsO1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0ubGF5ZXI7XG4gICAgICAgICAgICBjb25zdCBkZWZzID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLl9zaGFkZXJEZWZzO1xuICAgICAgICAgICAgY29uc3QgcGFyYW1zID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLnBhcmFtZXRlcnM7XG4gICAgICAgICAgICBjb25zdCBzdGVuY2lsID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLnN0ZW5jaWxGcm9udDtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0TGlzdCA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5fc3RhdGljTGlnaHRMaXN0O1xuICAgICAgICAgICAgbGV0IHZlcnRDb3VudCA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5tZXNoLnZlcnRleEJ1ZmZlci5nZXROdW1WZXJ0aWNlcygpO1xuICAgICAgICAgICAgY29uc3QgZHJhd09yZGVyID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLmRyYXdPcmRlcjtcbiAgICAgICAgICAgIGFhYmIuY29weShtZXNoSW5zdGFuY2VzTGVmdEFbMF0uYWFiYik7XG4gICAgICAgICAgICBjb25zdCBzY2FsZVNpZ24gPSBnZXRTY2FsZVNpZ24obWVzaEluc3RhbmNlc0xlZnRBWzBdKTtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleEZvcm1hdEJhdGNoaW5nSGFzaCA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5tZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuYmF0Y2hpbmdIYXNoO1xuICAgICAgICAgICAgY29uc3QgaW5kZXhlZCA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5tZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkO1xuICAgICAgICAgICAgc2tpcFRyYW5zbHVjZW50QWFiYiA9IG51bGw7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgbWVzaEluc3RhbmNlc0xlZnRBLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWkgPSBtZXNoSW5zdGFuY2VzTGVmdEFbaV07XG5cbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBieSBpbnN0YW5jZSBudW1iZXJcbiAgICAgICAgICAgICAgICBpZiAoZHluYW1pYyAmJiBsaXN0c1tqXS5sZW5ndGggPj0gbWF4SW5zdGFuY2VDb3VudCkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzTGVmdEIgPSBtZXNoSW5zdGFuY2VzTGVmdEIuY29uY2F0KG1lc2hJbnN0YW5jZXNMZWZ0QS5zbGljZShpKSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IG1hdGVyaWFsLCBsYXllciAobGVnYWN5KSwgdmVydGV4IGZvcm1hdCAmIGluZGV4IGNvbXBhdGliaWxpdHksIHNoYWRlciBkZWZpbmVzLCBzdGF0aWMgc291cmNlLCB2ZXJ0IGNvdW50LCBvdmVybGFwcGluZyBVSVxuICAgICAgICAgICAgICAgIGlmICgobWF0ZXJpYWwgIT09IG1pLm1hdGVyaWFsKSB8fFxuICAgICAgICAgICAgICAgICAgICAobGF5ZXIgIT09IG1pLmxheWVyKSB8fFxuICAgICAgICAgICAgICAgICAgICAodmVydGV4Rm9ybWF0QmF0Y2hpbmdIYXNoICE9PSBtaS5tZXNoLnZlcnRleEJ1ZmZlci5mb3JtYXQuYmF0Y2hpbmdIYXNoKSB8fFxuICAgICAgICAgICAgICAgICAgICAoaW5kZXhlZCAhPT0gbWkubWVzaC5wcmltaXRpdmVbMF0uaW5kZXhlZCkgfHxcbiAgICAgICAgICAgICAgICAgICAgKGRlZnMgIT09IG1pLl9zaGFkZXJEZWZzKSB8fFxuICAgICAgICAgICAgICAgICAgICAodmVydENvdW50ICsgbWkubWVzaC52ZXJ0ZXhCdWZmZXIuZ2V0TnVtVmVydGljZXMoKSA+IG1heE51bVZlcnRpY2VzKSkge1xuICAgICAgICAgICAgICAgICAgICBza2lwTWVzaChtaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBieSBBQUJCXG4gICAgICAgICAgICAgICAgdGVzdEFhYmIuY29weShhYWJiKTtcbiAgICAgICAgICAgICAgICB0ZXN0QWFiYi5hZGQobWkuYWFiYik7XG4gICAgICAgICAgICAgICAgaWYgKHRlc3RBYWJiLmhhbGZFeHRlbnRzLnggPiBoYWxmTWF4QWFiYlNpemUgfHxcbiAgICAgICAgICAgICAgICAgICAgdGVzdEFhYmIuaGFsZkV4dGVudHMueSA+IGhhbGZNYXhBYWJiU2l6ZSB8fFxuICAgICAgICAgICAgICAgICAgICB0ZXN0QWFiYi5oYWxmRXh0ZW50cy56ID4gaGFsZk1heEFhYmJTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IHN0ZW5jaWwgbWFzayAoVUkgZWxlbWVudHMpLCBib3RoIGZyb250IGFuZCBiYWNrIGV4cGVjdGVkIHRvIGJlIHRoZSBzYW1lXG4gICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoc2YgPSBtaS5zdGVuY2lsRnJvbnQpIHx8IHN0ZW5jaWwuZnVuYyAhPT0gc2YuZnVuYyB8fCBzdGVuY2lsLnpwYXNzICE9PSBzZi56cGFzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgYnkgbmVnYXRpdmUgc2NhbGVcbiAgICAgICAgICAgICAgICBpZiAoc2NhbGVTaWduICE9PSBnZXRTY2FsZVNpZ24obWkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgYnkgcGFyYW1ldGVyc1xuICAgICAgICAgICAgICAgIGlmICghZXF1YWxQYXJhbVNldHMocGFyYW1zLCBtaS5wYXJhbWV0ZXJzKSkge1xuICAgICAgICAgICAgICAgICAgICBza2lwTWVzaChtaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBieSBzdGF0aWMgbGlnaHQgbGlzdFxuICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRpY0xpZ2h0cyA9IG1pLl9zdGF0aWNMaWdodExpc3Q7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0TGlzdCAmJiBzdGF0aWNMaWdodHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcXVhbExpZ2h0TGlzdHMobGlnaHRMaXN0LCBzdGF0aWNMaWdodHMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBza2lwTWVzaChtaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobGlnaHRMaXN0IHx8IHN0YXRpY0xpZ2h0cykgeyAvLyBTcGxpdCBieSBzdGF0aWMvbm9uIHN0YXRpY1xuICAgICAgICAgICAgICAgICAgICBza2lwTWVzaChtaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0cmFuc2x1Y2VudCAmJiBza2lwVHJhbnNsdWNlbnRBYWJiICYmIHNraXBUcmFuc2x1Y2VudEFhYmIuaW50ZXJzZWN0cyhtaS5hYWJiKSAmJiBtaS5kcmF3T3JkZXIgIT09IGRyYXdPcmRlcikge1xuICAgICAgICAgICAgICAgICAgICBza2lwTWVzaChtaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGFhYmIuYWRkKG1pLmFhYmIpO1xuICAgICAgICAgICAgICAgIHZlcnRDb3VudCArPSBtaS5tZXNoLnZlcnRleEJ1ZmZlci5nZXROdW1WZXJ0aWNlcygpO1xuICAgICAgICAgICAgICAgIGxpc3RzW2pdLnB1c2gobWkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBqKys7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzTGVmdEEgPSBtZXNoSW5zdGFuY2VzTGVmdEI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGlzdHM7XG4gICAgfVxuXG4gICAgY29sbGVjdEJhdGNoZWRNZXNoRGF0YShtZXNoSW5zdGFuY2VzLCBkeW5hbWljKSB7XG5cbiAgICAgICAgbGV0IHN0cmVhbXMgPSBudWxsO1xuICAgICAgICBsZXQgYmF0Y2hOdW1WZXJ0cyA9IDA7XG4gICAgICAgIGxldCBiYXRjaE51bUluZGljZXMgPSAwO1xuICAgICAgICBsZXQgbWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXNbaV0udmlzaWJsZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gdmVydGV4IGNvdW50c1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoSW5zdGFuY2VzW2ldLm1lc2g7XG4gICAgICAgICAgICAgICAgY29uc3QgbnVtVmVydHMgPSBtZXNoLnZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgICAgICBiYXRjaE51bVZlcnRzICs9IG51bVZlcnRzO1xuXG4gICAgICAgICAgICAgICAgLy8gaW5kZXggY291bnRzIChoYW5kbGVzIHNwZWNpYWwgY2FzZSBvZiBUUkktRkFOLXR5cGUgbm9uLWluZGV4ZWQgcHJpbWl0aXZlIHVzZWQgYnkgVUkpXG4gICAgICAgICAgICAgICAgYmF0Y2hOdW1JbmRpY2VzICs9IG1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQgPyBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA6XG4gICAgICAgICAgICAgICAgICAgIChtZXNoLnByaW1pdGl2ZVswXS50eXBlID09PSBQUklNSVRJVkVfVFJJRkFOICYmIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID09PSA0ID8gNiA6IDApO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgZmlyc3QgbWVzaFxuICAgICAgICAgICAgICAgIGlmICghc3RyZWFtcykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsID0gbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjb2xsZWN0IHVzZWQgdmVydGV4IGJ1ZmZlciBzZW1hbnRpYyBpbmZvcm1hdGlvbiBmcm9tIGZpcnN0IG1lc2ggKHRoZXkgYWxsIG1hdGNoKVxuICAgICAgICAgICAgICAgICAgICBzdHJlYW1zID0ge307XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1zID0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGVsZW1zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGVsZW1zW2pdLm5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJlYW1zW3NlbWFudGljXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1Db21wb25lbnRzOiBlbGVtc1tqXS5udW1Db21wb25lbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiBlbGVtc1tqXS5kYXRhVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemU6IGVsZW1zW2pdLm5vcm1hbGl6ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogMFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZvciBkeW5hbWljIG1lc2hlcyB3ZSBuZWVkIGJvbmUgaW5kaWNlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoZHluYW1pYykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtc1tTRU1BTlRJQ19CTEVORElORElDRVNdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUNvbXBvbmVudHM6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6IFRZUEVfRkxPQVQzMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0cmVhbXM6IHN0cmVhbXMsXG4gICAgICAgICAgICBiYXRjaE51bVZlcnRzOiBiYXRjaE51bVZlcnRzLFxuICAgICAgICAgICAgYmF0Y2hOdW1JbmRpY2VzOiBiYXRjaE51bUluZGljZXMsXG4gICAgICAgICAgICBtYXRlcmlhbDogbWF0ZXJpYWxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUYWtlcyBhIG1lc2ggaW5zdGFuY2UgbGlzdCB0aGF0IGhhcyBiZWVuIHByZXBhcmVkIGJ5IHtAbGluayBCYXRjaE1hbmFnZXIjcHJlcGFyZX0sIGFuZFxuICAgICAqIHJldHVybnMgYSB7QGxpbmsgQmF0Y2h9IG9iamVjdC4gVGhpcyBtZXRob2QgYXNzdW1lcyB0aGF0IGFsbCBtZXNoIGluc3RhbmNlcyBwcm92aWRlZCBjYW4gYmVcbiAgICAgKiByZW5kZXJlZCBpbiBhIHNpbmdsZSBkcmF3IGNhbGwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gSW5wdXQgbGlzdCBvZiBtZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGR5bmFtaWMgLSBJcyBpdCBhIHN0YXRpYyBvciBkeW5hbWljIGJhdGNoPyBXaWxsIG9iamVjdHMgYmUgdHJhbnNmb3JtZWRcbiAgICAgKiBhZnRlciBiYXRjaGluZz9cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2JhdGNoR3JvdXBJZF0gLSBMaW5rIHRoaXMgYmF0Y2ggdG8gYSBzcGVjaWZpYyBiYXRjaCBncm91cC4gVGhpcyBpcyBkb25lXG4gICAgICogYXV0b21hdGljYWxseSB3aXRoIGRlZmF1bHQgYmF0Y2hlcy5cbiAgICAgKiBAcmV0dXJucyB7QmF0Y2h9IFRoZSByZXN1bHRpbmcgYmF0Y2ggb2JqZWN0LlxuICAgICAqL1xuICAgIGNyZWF0ZShtZXNoSW5zdGFuY2VzLCBkeW5hbWljLCBiYXRjaEdyb3VwSWQpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKCF0aGlzLl9pbml0KSB7XG4gICAgICAgICAgICBjb25zdCBib25lTGltaXQgPSAnI2RlZmluZSBCT05FX0xJTUlUICcgKyB0aGlzLmRldmljZS5nZXRCb25lTGltaXQoKSArICdcXG4nO1xuICAgICAgICAgICAgdGhpcy50cmFuc2Zvcm1WUyA9IGJvbmVMaW1pdCArICcjZGVmaW5lIERZTkFNSUNCQVRDSFxcbicgKyBzaGFkZXJDaHVua3MudHJhbnNmb3JtVlM7XG4gICAgICAgICAgICB0aGlzLnNraW5UZXhWUyA9IHNoYWRlckNodW5rcy5za2luQmF0Y2hUZXhWUztcbiAgICAgICAgICAgIHRoaXMuc2tpbkNvbnN0VlMgPSBzaGFkZXJDaHVua3Muc2tpbkJhdGNoQ29uc3RWUztcbiAgICAgICAgICAgIHRoaXMudmVydGV4Rm9ybWF0cyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5faW5pdCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RyZWFtID0gbnVsbDtcbiAgICAgICAgbGV0IHNlbWFudGljO1xuICAgICAgICBsZXQgbWVzaCwgbnVtVmVydHM7XG4gICAgICAgIGxldCBiYXRjaCA9IG51bGw7XG5cbiAgICAgICAgLy8gZmluZCBvdXQgdmVydGV4IHN0cmVhbXMgYW5kIGNvdW50c1xuICAgICAgICBjb25zdCBiYXRjaERhdGEgPSB0aGlzLmNvbGxlY3RCYXRjaGVkTWVzaERhdGEobWVzaEluc3RhbmNlcywgZHluYW1pYyk7XG5cbiAgICAgICAgLy8gaWYgYW55dGhpbmcgdG8gYmF0Y2hcbiAgICAgICAgaWYgKGJhdGNoRGF0YS5zdHJlYW1zKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHN0cmVhbXMgPSBiYXRjaERhdGEuc3RyZWFtcztcbiAgICAgICAgICAgIGxldCBtYXRlcmlhbCA9IGJhdGNoRGF0YS5tYXRlcmlhbDtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoTnVtVmVydHMgPSBiYXRjaERhdGEuYmF0Y2hOdW1WZXJ0cztcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoTnVtSW5kaWNlcyA9IGJhdGNoRGF0YS5iYXRjaE51bUluZGljZXM7XG5cbiAgICAgICAgICAgIGJhdGNoID0gbmV3IEJhdGNoKG1lc2hJbnN0YW5jZXMsIGR5bmFtaWMsIGJhdGNoR3JvdXBJZCk7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaExpc3QucHVzaChiYXRjaCk7XG5cbiAgICAgICAgICAgIGxldCBpbmRleEJhc2UsIG51bUluZGljZXMsIGluZGV4RGF0YTtcbiAgICAgICAgICAgIGxldCB2ZXJ0aWNlc09mZnNldCA9IDA7XG4gICAgICAgICAgICBsZXQgaW5kZXhPZmZzZXQgPSAwO1xuICAgICAgICAgICAgbGV0IHRyYW5zZm9ybTtcbiAgICAgICAgICAgIGNvbnN0IHZlYyA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIGluZGljZXNcbiAgICAgICAgICAgIGNvbnN0IGluZGV4QXJyYXlUeXBlID0gYmF0Y2hOdW1WZXJ0cyA8PSAweGZmZmYgPyBVaW50MTZBcnJheSA6IFVpbnQzMkFycmF5O1xuICAgICAgICAgICAgY29uc3QgaW5kaWNlcyA9IG5ldyBpbmRleEFycmF5VHlwZShiYXRjaE51bUluZGljZXMpO1xuXG4gICAgICAgICAgICAvLyBhbGxvY2F0ZSB0eXBlZCBhcnJheXMgdG8gc3RvcmUgZmluYWwgdmVydGV4IHN0cmVhbSBkYXRhXG4gICAgICAgICAgICBmb3IgKHNlbWFudGljIGluIHN0cmVhbXMpIHtcbiAgICAgICAgICAgICAgICBzdHJlYW0gPSBzdHJlYW1zW3NlbWFudGljXTtcbiAgICAgICAgICAgICAgICBzdHJlYW0udHlwZUFycmF5VHlwZSA9IHR5cGVkQXJyYXlUeXBlc1tzdHJlYW0uZGF0YVR5cGVdO1xuICAgICAgICAgICAgICAgIHN0cmVhbS5lbGVtZW50Qnl0ZVNpemUgPSB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVtzdHJlYW0uZGF0YVR5cGVdO1xuICAgICAgICAgICAgICAgIHN0cmVhbS5idWZmZXIgPSBuZXcgc3RyZWFtLnR5cGVBcnJheVR5cGUoYmF0Y2hOdW1WZXJ0cyAqIHN0cmVhbS5udW1Db21wb25lbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYnVpbGQgdmVydGV4IGFuZCBpbmRleCBkYXRhIGZvciBmaW5hbCBtZXNoXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1lc2hJbnN0YW5jZXNbaV0udmlzaWJsZSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBtZXNoID0gbWVzaEluc3RhbmNlc1tpXS5tZXNoO1xuICAgICAgICAgICAgICAgIG51bVZlcnRzID0gbWVzaC52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG5cbiAgICAgICAgICAgICAgICAvLyBtYXRyaXggdG8gdHJhbnNmb3JtIHZlcnRpY2VzIHRvIHdvcmxkIHNwYWNlIGZvciBzdGF0aWMgYmF0Y2hpbmdcbiAgICAgICAgICAgICAgICBpZiAoIWR5bmFtaWMpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtID0gbWVzaEluc3RhbmNlc1tpXS5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChzZW1hbnRpYyBpbiBzdHJlYW1zKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZW1hbnRpYyAhPT0gU0VNQU5USUNfQkxFTkRJTkRJQ0VTKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJlYW0gPSBzdHJlYW1zW3NlbWFudGljXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IHZlcnRleCBzdHJlYW0gdG8gdHlwZWQgdmlldyBzdWJhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViYXJyYXkgPSBuZXcgc3RyZWFtLnR5cGVBcnJheVR5cGUoc3RyZWFtLmJ1ZmZlci5idWZmZXIsIHN0cmVhbS5lbGVtZW50Qnl0ZVNpemUgKiBzdHJlYW0uY291bnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdG90YWxDb21wb25lbnRzID0gbWVzaC5nZXRWZXJ0ZXhTdHJlYW0oc2VtYW50aWMsIHN1YmFycmF5KSAqIHN0cmVhbS5udW1Db21wb25lbnRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtLmNvdW50ICs9IHRvdGFsQ29tcG9uZW50cztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIHBvc2l0aW9uLCBub3JtYWwgYW5kIHRhbmdlbnQgdG8gd29ybGQgc3BhY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZHluYW1pYyAmJiBzdHJlYW0ubnVtQ29tcG9uZW50cyA+PSAzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlbWFudGljID09PSBTRU1BTlRJQ19QT1NJVElPTikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRvdGFsQ29tcG9uZW50czsgaiArPSBzdHJlYW0ubnVtQ29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVjLnNldChzdWJhcnJheVtqXSwgc3ViYXJyYXlbaiArIDFdLCBzdWJhcnJheVtqICsgMl0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtLnRyYW5zZm9ybVBvaW50KHZlYywgdmVjKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YmFycmF5W2pdID0gdmVjLng7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqICsgMV0gPSB2ZWMueTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YmFycmF5W2ogKyAyXSA9IHZlYy56O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZW1hbnRpYyA9PT0gU0VNQU5USUNfTk9STUFMIHx8IHNlbWFudGljID09PSBTRU1BTlRJQ19UQU5HRU5UKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaGFuZGxlIG5vbi11bmlmb3JtIHNjYWxlIGJ5IHVzaW5nIHRyYW5zcG9zZWQgaW52ZXJzZSBtYXRyaXggdG8gdHJhbnNmb3JtIHZlY3RvcnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtLmludmVydFRvM3gzKG1hdDMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXQzLnRyYW5zcG9zZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdG90YWxDb21wb25lbnRzOyBqICs9IHN0cmVhbS5udW1Db21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZWMuc2V0KHN1YmFycmF5W2pdLCBzdWJhcnJheVtqICsgMV0sIHN1YmFycmF5W2ogKyAyXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXQzLnRyYW5zZm9ybVZlY3Rvcih2ZWMsIHZlYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqXSA9IHZlYy54O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViYXJyYXlbaiArIDFdID0gdmVjLnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqICsgMl0gPSB2ZWMuejtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGJvbmUgaW5kZXggaXMgbWVzaCBpbmRleFxuICAgICAgICAgICAgICAgIGlmIChkeW5hbWljKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0cmVhbSA9IHN0cmVhbXNbU0VNQU5USUNfQkxFTkRJTkRJQ0VTXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1WZXJ0czsgaisrKVxuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtLmJ1ZmZlcltzdHJlYW0uY291bnQrK10gPSBpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGluZGV4IGJ1ZmZlclxuICAgICAgICAgICAgICAgIGlmIChtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4QmFzZSA9IG1lc2gucHJpbWl0aXZlWzBdLmJhc2U7XG4gICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSBtZXNoLnByaW1pdGl2ZVswXS5jb3VudDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBzb3VyY2UgaW5kZXggYnVmZmVyIGRhdGEgbWFwcGVkIHRvIGl0cyBmb3JtYXRcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3JjRm9ybWF0ID0gbWVzaC5pbmRleEJ1ZmZlclswXS5nZXRGb3JtYXQoKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhEYXRhID0gbmV3IHR5cGVkQXJyYXlJbmRleEZvcm1hdHNbc3JjRm9ybWF0XShtZXNoLmluZGV4QnVmZmVyWzBdLnN0b3JhZ2UpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobWVzaC5wcmltaXRpdmVbMF0udHlwZSA9PT0gUFJJTUlUSVZFX1RSSUZBTiAmJiBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9PT0gNCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIFVJIGltYWdlIGVsZW1lbnRzXG4gICAgICAgICAgICAgICAgICAgIGluZGV4QmFzZSA9IDA7XG4gICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSA2O1xuICAgICAgICAgICAgICAgICAgICBpbmRleERhdGEgPSBbMCwgMSwgMywgMiwgMywgMV07XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtSW5kaWNlcyA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVtSW5kaWNlczsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXNbaiArIGluZGV4T2Zmc2V0XSA9IGluZGV4RGF0YVtpbmRleEJhc2UgKyBqXSArIHZlcnRpY2VzT2Zmc2V0O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGluZGV4T2Zmc2V0ICs9IG51bUluZGljZXM7XG4gICAgICAgICAgICAgICAgdmVydGljZXNPZmZzZXQgKz0gbnVtVmVydHM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBtZXNoXG4gICAgICAgICAgICBtZXNoID0gbmV3IE1lc2godGhpcy5kZXZpY2UpO1xuICAgICAgICAgICAgZm9yIChzZW1hbnRpYyBpbiBzdHJlYW1zKSB7XG4gICAgICAgICAgICAgICAgc3RyZWFtID0gc3RyZWFtc1tzZW1hbnRpY107XG4gICAgICAgICAgICAgICAgbWVzaC5zZXRWZXJ0ZXhTdHJlYW0oc2VtYW50aWMsIHN0cmVhbS5idWZmZXIsIHN0cmVhbS5udW1Db21wb25lbnRzLCB1bmRlZmluZWQsIHN0cmVhbS5kYXRhVHlwZSwgc3RyZWFtLm5vcm1hbGl6ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpbmRpY2VzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgbWVzaC5zZXRJbmRpY2VzKGluZGljZXMpO1xuXG4gICAgICAgICAgICBtZXNoLnVwZGF0ZShQUklNSVRJVkVfVFJJQU5HTEVTLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIC8vIFBhdGNoIHRoZSBtYXRlcmlhbFxuICAgICAgICAgICAgaWYgKGR5bmFtaWMpIHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbCA9IG1hdGVyaWFsLmNsb25lKCk7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLnRyYW5zZm9ybVZTID0gdGhpcy50cmFuc2Zvcm1WUztcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5jaHVua3Muc2tpblRleFZTID0gdGhpcy5za2luVGV4VlM7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLnNraW5Db25zdFZTID0gdGhpcy5za2luQ29uc3RWUztcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIG1lc2hJbnN0YW5jZVxuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gbmV3IE1lc2hJbnN0YW5jZShtZXNoLCBtYXRlcmlhbCwgdGhpcy5yb290Tm9kZSk7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLmNhc3RTaGFkb3c7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UucGFyYW1ldGVycyA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLnBhcmFtZXRlcnM7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuaXNTdGF0aWMgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5pc1N0YXRpYztcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5sYXllciA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLmxheWVyO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9zdGF0aWNMaWdodExpc3QgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5fc3RhdGljTGlnaHRMaXN0O1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLl9zaGFkZXJEZWZzID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0uX3NoYWRlckRlZnM7XG5cbiAgICAgICAgICAgIC8vIG1lc2hJbnN0YW5jZSBjdWxsaW5nIC0gZG9uJ3QgY3VsbCBVSSBlbGVtZW50cywgYXMgdGhleSB1c2UgY3VzdG9tIGN1bGxpbmcgQ29tcG9uZW50LmlzVmlzaWJsZUZvckNhbWVyYVxuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmN1bGwgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5jdWxsO1xuICAgICAgICAgICAgY29uc3QgYmF0Y2hHcm91cCA9IHRoaXMuX2JhdGNoR3JvdXBzW2JhdGNoR3JvdXBJZF07XG4gICAgICAgICAgICBpZiAoYmF0Y2hHcm91cCAmJiBiYXRjaEdyb3VwLl91aSlcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2UuY3VsbCA9IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoZHluYW1pYykge1xuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBza2luSW5zdGFuY2VcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlcyA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZXMucHVzaChiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1tpXS5ub2RlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA9IG5ldyBTa2luQmF0Y2hJbnN0YW5jZSh0aGlzLmRldmljZSwgbm9kZXMsIHRoaXMucm9vdE5vZGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkaXNhYmxlIGFhYmIgdXBkYXRlLCBnZXRzIHVwZGF0ZWQgbWFudWFsbHkgYnkgYmF0Y2hlclxuICAgICAgICAgICAgbWVzaEluc3RhbmNlLl91cGRhdGVBYWJiID0gZmFsc2U7XG5cbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5kcmF3T3JkZXIgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5kcmF3T3JkZXI7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc3RlbmNpbEZyb250ID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0uc3RlbmNpbEZyb250O1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0uc3RlbmNpbEJhY2s7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuZmxpcEZhY2VzID0gZ2V0U2NhbGVTaWduKGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdKSA8IDA7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLmNhc3RTaGFkb3c7XG5cbiAgICAgICAgICAgIGJhdGNoLm1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZTtcbiAgICAgICAgICAgIGJhdGNoLnVwZGF0ZUJvdW5kaW5nQm94KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLmNyZWF0ZVRpbWUgKz0gbm93KCkgLSB0aW1lO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICByZXR1cm4gYmF0Y2g7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyBib3VuZGluZyBib3hlcyBmb3IgYWxsIGR5bmFtaWMgYmF0Y2hlcy4gQ2FsbGVkIGF1dG9tYXRpY2FsbHkuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlQWxsKCkge1xuICAgICAgICAvLyBUT0RPOiBvbmx5IGNhbGwgd2hlbiBuZWVkZWQuIEFwcGxpZXMgdG8gc2tpbm5pbmcgbWF0cmljZXMgYXMgd2VsbFxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUdyb3Vwcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmdlbmVyYXRlKHRoaXMuX2RpcnR5R3JvdXBzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgY29uc3QgdGltZSA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2JhdGNoTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9iYXRjaExpc3RbaV0uZHluYW1pYykgY29udGludWU7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaExpc3RbaV0udXBkYXRlQm91bmRpbmdCb3goKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fc3RhdHMudXBkYXRlTGFzdEZyYW1lVGltZSA9IG5vdygpIC0gdGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvbmVzIGEgYmF0Y2guIFRoaXMgbWV0aG9kIGRvZXNuJ3QgcmVidWlsZCBiYXRjaCBnZW9tZXRyeSwgYnV0IG9ubHkgY3JlYXRlcyBhIG5ldyBtb2RlbCBhbmRcbiAgICAgKiBiYXRjaCBvYmplY3RzLCBsaW5rZWQgdG8gZGlmZmVyZW50IHNvdXJjZSBtZXNoIGluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QmF0Y2h9IGJhdGNoIC0gQSBiYXRjaCBvYmplY3QuXG4gICAgICogQHBhcmFtIHtNZXNoSW5zdGFuY2VbXX0gY2xvbmVkTWVzaEluc3RhbmNlcyAtIE5ldyBtZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcmV0dXJucyB7QmF0Y2h9IE5ldyBiYXRjaCBvYmplY3QuXG4gICAgICovXG4gICAgY2xvbmUoYmF0Y2gsIGNsb25lZE1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgY29uc3QgYmF0Y2gyID0gbmV3IEJhdGNoKGNsb25lZE1lc2hJbnN0YW5jZXMsIGJhdGNoLmR5bmFtaWMsIGJhdGNoLmJhdGNoR3JvdXBJZCk7XG4gICAgICAgIHRoaXMuX2JhdGNoTGlzdC5wdXNoKGJhdGNoMik7XG5cbiAgICAgICAgY29uc3Qgbm9kZXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjbG9uZWRNZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBub2Rlcy5wdXNoKGNsb25lZE1lc2hJbnN0YW5jZXNbaV0ubm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlID0gbmV3IE1lc2hJbnN0YW5jZShiYXRjaC5tZXNoSW5zdGFuY2UubWVzaCwgYmF0Y2gubWVzaEluc3RhbmNlLm1hdGVyaWFsLCBiYXRjaC5tZXNoSW5zdGFuY2Uubm9kZSk7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmIgPSBmYWxzZTtcbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5wYXJhbWV0ZXJzID0gY2xvbmVkTWVzaEluc3RhbmNlc1swXS5wYXJhbWV0ZXJzO1xuICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlLmlzU3RhdGljID0gY2xvbmVkTWVzaEluc3RhbmNlc1swXS5pc1N0YXRpYztcbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5jdWxsID0gY2xvbmVkTWVzaEluc3RhbmNlc1swXS5jdWxsO1xuICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlLmxheWVyID0gY2xvbmVkTWVzaEluc3RhbmNlc1swXS5sYXllcjtcbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5fc3RhdGljTGlnaHRMaXN0ID0gY2xvbmVkTWVzaEluc3RhbmNlc1swXS5fc3RhdGljTGlnaHRMaXN0O1xuXG4gICAgICAgIGlmIChiYXRjaC5keW5hbWljKSB7XG4gICAgICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA9IG5ldyBTa2luQmF0Y2hJbnN0YW5jZSh0aGlzLmRldmljZSwgbm9kZXMsIHRoaXMucm9vdE5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5jYXN0U2hhZG93ID0gYmF0Y2gubWVzaEluc3RhbmNlLmNhc3RTaGFkb3c7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuX3NoYWRlciA9IGJhdGNoLm1lc2hJbnN0YW5jZS5fc2hhZGVyLnNsaWNlKCk7XG5cbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5jYXN0U2hhZG93ID0gYmF0Y2gubWVzaEluc3RhbmNlLmNhc3RTaGFkb3c7XG5cbiAgICAgICAgcmV0dXJuIGJhdGNoMjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIHRoZSBiYXRjaCBtb2RlbCBmcm9tIGFsbCBsYXllcnMgYW5kIGRlc3Ryb3lzIGl0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtCYXRjaH0gYmF0Y2ggLSBBIGJhdGNoIG9iamVjdC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGRlc3Ryb3lCYXRjaChiYXRjaCkge1xuICAgICAgICBiYXRjaC5kZXN0cm95KHRoaXMuc2NlbmUsIHRoaXMuX2JhdGNoR3JvdXBzW2JhdGNoLmJhdGNoR3JvdXBJZF0ubGF5ZXJzKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEJhdGNoTWFuYWdlciB9O1xuIl0sIm5hbWVzIjpbInBhcmFtc0lkZW50aWNhbCIsImEiLCJiIiwiZGF0YSIsIkZsb2F0MzJBcnJheSIsImxlbmd0aCIsImkiLCJlcXVhbFBhcmFtU2V0cyIsInBhcmFtczEiLCJwYXJhbXMyIiwicGFyYW0iLCJoYXNPd25Qcm9wZXJ0eSIsImVxdWFsTGlnaHRMaXN0cyIsImxpZ2h0TGlzdDEiLCJsaWdodExpc3QyIiwiayIsImluZGV4T2YiLCJtYXQzIiwiTWF0MyIsIndvcmxkTWF0WCIsIlZlYzMiLCJ3b3JsZE1hdFkiLCJ3b3JsZE1hdFoiLCJnZXRTY2FsZVNpZ24iLCJtaSIsInd0Iiwibm9kZSIsIndvcmxkVHJhbnNmb3JtIiwiZ2V0WCIsImdldFkiLCJnZXRaIiwiY3Jvc3MiLCJkb3QiLCJCYXRjaE1hbmFnZXIiLCJjb25zdHJ1Y3RvciIsImRldmljZSIsInJvb3QiLCJzY2VuZSIsInJvb3ROb2RlIiwiX2luaXQiLCJfYmF0Y2hHcm91cHMiLCJfYmF0Y2hHcm91cENvdW50ZXIiLCJfYmF0Y2hMaXN0IiwiX2RpcnR5R3JvdXBzIiwiX3N0YXRzIiwiY3JlYXRlVGltZSIsInVwZGF0ZUxhc3RGcmFtZVRpbWUiLCJkZXN0cm95IiwiYWRkR3JvdXAiLCJuYW1lIiwiZHluYW1pYyIsIm1heEFhYmJTaXplIiwiaWQiLCJsYXllcnMiLCJ1bmRlZmluZWQiLCJEZWJ1ZyIsImVycm9yIiwiZ3JvdXAiLCJCYXRjaEdyb3VwIiwicmVtb3ZlR3JvdXAiLCJuZXdCYXRjaExpc3QiLCJiYXRjaEdyb3VwSWQiLCJkZXN0cm95QmF0Y2giLCJwdXNoIiwiX3JlbW92ZU1vZGVsc0Zyb21CYXRjaEdyb3VwIiwibWFya0dyb3VwRGlydHkiLCJnZXRHcm91cEJ5TmFtZSIsImdyb3VwcyIsImdldEJhdGNoZXMiLCJyZXN1bHRzIiwibGVuIiwiYmF0Y2giLCJlbmFibGVkIiwibW9kZWwiLCJyZW5kZXIiLCJlbGVtZW50Iiwic3ByaXRlIiwiX2NoaWxkcmVuIiwiaW5zZXJ0IiwidHlwZSIsImdyb3VwSWQiLCJhc3NlcnQiLCJfb2JqIiwicmVtb3ZlIiwiaWR4Iiwic3BsaWNlIiwiX2V4dHJhY3RSZW5kZXIiLCJhcnIiLCJncm91cE1lc2hJbnN0YW5jZXMiLCJpc1N0YXRpYyIsImRyYXdDYWxscyIsIm5vZGVNZXNoSW5zdGFuY2VzIiwibWVzaEluc3RhbmNlcyIsIl9zdGF0aWNTb3VyY2UiLCJjb25jYXQiLCJyZW1vdmVGcm9tTGF5ZXJzIiwiX2V4dHJhY3RNb2RlbCIsInJlbW92ZU1vZGVsRnJvbUxheWVycyIsIl9iYXRjaEdyb3VwIiwiX2V4dHJhY3RFbGVtZW50IiwidmFsaWQiLCJfdGV4dCIsIl9tb2RlbCIsIl9pbWFnZSIsIl9yZW5kZXJhYmxlIiwibWVzaEluc3RhbmNlIiwidW5tYXNrTWVzaEluc3RhbmNlIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJfZGlydGlmeU1hc2siLCJfb25QcmVyZW5kZXIiLCJfdWkiLCJfY29sbGVjdEFuZFJlbW92ZU1lc2hJbnN0YW5jZXMiLCJncm91cElkcyIsImciLCJtIiwiciIsImUiLCJzIiwiX21lc2hJbnN0YW5jZSIsIl9yZW5kZXJNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIiwiX3Nwcml0ZSIsImdlbmVyYXRlIiwiT2JqZWN0Iiwia2V5cyIsIm5ld0RpcnR5R3JvdXBzIiwibGlzdHMiLCJncm91cERhdGEiLCJwcmVwYXJlIiwiY3JlYXRlIiwicGFyc2VJbnQiLCJhZGRUb0xheWVycyIsIk51bWJlciIsIlBPU0lUSVZFX0lORklOSVRZIiwidHJhbnNsdWNlbnQiLCJoYWxmTWF4QWFiYlNpemUiLCJtYXhJbnN0YW5jZUNvdW50Iiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJib25lTGltaXQiLCJtYXhOdW1WZXJ0aWNlcyIsImV4dFVpbnRFbGVtZW50IiwiYWFiYiIsIkJvdW5kaW5nQm94IiwidGVzdEFhYmIiLCJza2lwVHJhbnNsdWNlbnRBYWJiIiwic2YiLCJqIiwic29ydCIsImRyYXdPcmRlciIsIm1lc2hJbnN0YW5jZXNMZWZ0QSIsIm1lc2hJbnN0YW5jZXNMZWZ0QiIsInNraXBNZXNoIiwiYWRkIiwiY2xvbmUiLCJtYXRlcmlhbCIsImxheWVyIiwiZGVmcyIsIl9zaGFkZXJEZWZzIiwicGFyYW1zIiwicGFyYW1ldGVycyIsInN0ZW5jaWwiLCJsaWdodExpc3QiLCJfc3RhdGljTGlnaHRMaXN0IiwidmVydENvdW50IiwibWVzaCIsInZlcnRleEJ1ZmZlciIsImdldE51bVZlcnRpY2VzIiwiY29weSIsInNjYWxlU2lnbiIsInZlcnRleEZvcm1hdEJhdGNoaW5nSGFzaCIsImZvcm1hdCIsImJhdGNoaW5nSGFzaCIsImluZGV4ZWQiLCJwcmltaXRpdmUiLCJzbGljZSIsImhhbGZFeHRlbnRzIiwieCIsInkiLCJ6IiwiZnVuYyIsInpwYXNzIiwic3RhdGljTGlnaHRzIiwiaW50ZXJzZWN0cyIsImNvbGxlY3RCYXRjaGVkTWVzaERhdGEiLCJzdHJlYW1zIiwiYmF0Y2hOdW1WZXJ0cyIsImJhdGNoTnVtSW5kaWNlcyIsInZpc2libGUiLCJudW1WZXJ0cyIsIm51bVZlcnRpY2VzIiwiY291bnQiLCJQUklNSVRJVkVfVFJJRkFOIiwiZWxlbXMiLCJlbGVtZW50cyIsInNlbWFudGljIiwibnVtQ29tcG9uZW50cyIsImRhdGFUeXBlIiwibm9ybWFsaXplIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiVFlQRV9GTE9BVDMyIiwidGltZSIsIm5vdyIsImdldEJvbmVMaW1pdCIsInRyYW5zZm9ybVZTIiwic2hhZGVyQ2h1bmtzIiwic2tpblRleFZTIiwic2tpbkJhdGNoVGV4VlMiLCJza2luQ29uc3RWUyIsInNraW5CYXRjaENvbnN0VlMiLCJ2ZXJ0ZXhGb3JtYXRzIiwic3RyZWFtIiwiYmF0Y2hEYXRhIiwiQmF0Y2giLCJpbmRleEJhc2UiLCJudW1JbmRpY2VzIiwiaW5kZXhEYXRhIiwidmVydGljZXNPZmZzZXQiLCJpbmRleE9mZnNldCIsInRyYW5zZm9ybSIsInZlYyIsImluZGV4QXJyYXlUeXBlIiwiVWludDE2QXJyYXkiLCJVaW50MzJBcnJheSIsImluZGljZXMiLCJ0eXBlQXJyYXlUeXBlIiwidHlwZWRBcnJheVR5cGVzIiwiZWxlbWVudEJ5dGVTaXplIiwidHlwZWRBcnJheVR5cGVzQnl0ZVNpemUiLCJidWZmZXIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsInN1YmFycmF5IiwidG90YWxDb21wb25lbnRzIiwiZ2V0VmVydGV4U3RyZWFtIiwiU0VNQU5USUNfUE9TSVRJT04iLCJzZXQiLCJ0cmFuc2Zvcm1Qb2ludCIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX1RBTkdFTlQiLCJpbnZlcnRUbzN4MyIsInRyYW5zcG9zZSIsInRyYW5zZm9ybVZlY3RvciIsImJhc2UiLCJzcmNGb3JtYXQiLCJpbmRleEJ1ZmZlciIsImdldEZvcm1hdCIsInR5cGVkQXJyYXlJbmRleEZvcm1hdHMiLCJzdG9yYWdlIiwiTWVzaCIsInNldFZlcnRleFN0cmVhbSIsInNldEluZGljZXMiLCJ1cGRhdGUiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwiY2h1bmtzIiwiTWVzaEluc3RhbmNlIiwiY2FzdFNoYWRvdyIsIm9yaWdNZXNoSW5zdGFuY2VzIiwiY3VsbCIsImJhdGNoR3JvdXAiLCJub2RlcyIsInNraW5JbnN0YW5jZSIsIlNraW5CYXRjaEluc3RhbmNlIiwiX3VwZGF0ZUFhYmIiLCJmbGlwRmFjZXMiLCJ1cGRhdGVCb3VuZGluZ0JveCIsInVwZGF0ZUFsbCIsImNsb25lZE1lc2hJbnN0YW5jZXMiLCJiYXRjaDIiLCJfc2hhZGVyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNkJBLFNBQVNBLGVBQWUsQ0FBQ0MsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7QUFDM0IsRUFBQSxJQUFJRCxDQUFDLElBQUksQ0FBQ0MsQ0FBQyxFQUFFLE9BQU8sS0FBSyxDQUFBO0FBQ3pCLEVBQUEsSUFBSSxDQUFDRCxDQUFDLElBQUlDLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQTtFQUN6QkQsQ0FBQyxHQUFHQSxDQUFDLENBQUNFLElBQUksQ0FBQTtFQUNWRCxDQUFDLEdBQUdBLENBQUMsQ0FBQ0MsSUFBSSxDQUFBO0FBQ1YsRUFBQSxJQUFJRixDQUFDLEtBQUtDLENBQUMsRUFBRSxPQUFPLElBQUksQ0FBQTtBQUN4QixFQUFBLElBQUlELENBQUMsWUFBWUcsWUFBWSxJQUFJRixDQUFDLFlBQVlFLFlBQVksRUFBRTtJQUN4RCxJQUFJSCxDQUFDLENBQUNJLE1BQU0sS0FBS0gsQ0FBQyxDQUFDRyxNQUFNLEVBQUUsT0FBTyxLQUFLLENBQUE7QUFDdkMsSUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0wsQ0FBQyxDQUFDSSxNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO01BQy9CLElBQUlMLENBQUMsQ0FBQ0ssQ0FBQyxDQUFDLEtBQUtKLENBQUMsQ0FBQ0ksQ0FBQyxDQUFDLEVBQUUsT0FBTyxLQUFLLENBQUE7QUFDbkMsS0FBQTtBQUNBLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBO0FBQ0EsRUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixDQUFBO0FBRUEsU0FBU0MsY0FBYyxDQUFDQyxPQUFPLEVBQUVDLE9BQU8sRUFBRTtBQUN0QyxFQUFBLEtBQUssTUFBTUMsS0FBSyxJQUFJRixPQUFPLEVBQUU7SUFDekIsSUFBSUEsT0FBTyxDQUFDRyxjQUFjLENBQUNELEtBQUssQ0FBQyxJQUFJLENBQUNWLGVBQWUsQ0FBQ1EsT0FBTyxDQUFDRSxLQUFLLENBQUMsRUFBRUQsT0FBTyxDQUFDQyxLQUFLLENBQUMsQ0FBQyxFQUNqRixPQUFPLEtBQUssQ0FBQTtBQUNwQixHQUFBO0FBQ0EsRUFBQSxLQUFLLE1BQU1BLEtBQUssSUFBSUQsT0FBTyxFQUFFO0lBQ3pCLElBQUlBLE9BQU8sQ0FBQ0UsY0FBYyxDQUFDRCxLQUFLLENBQUMsSUFBSSxDQUFDVixlQUFlLENBQUNTLE9BQU8sQ0FBQ0MsS0FBSyxDQUFDLEVBQUVGLE9BQU8sQ0FBQ0UsS0FBSyxDQUFDLENBQUMsRUFDakYsT0FBTyxLQUFLLENBQUE7QUFDcEIsR0FBQTtBQUNBLEVBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixDQUFBO0FBRUEsU0FBU0UsZUFBZSxDQUFDQyxVQUFVLEVBQUVDLFVBQVUsRUFBRTtBQUM3QyxFQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRixVQUFVLENBQUNSLE1BQU0sRUFBRVUsQ0FBQyxFQUFFLEVBQUU7QUFDeEMsSUFBQSxJQUFJRCxVQUFVLENBQUNFLE9BQU8sQ0FBQ0gsVUFBVSxDQUFDRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFDckMsT0FBTyxLQUFLLENBQUE7QUFDcEIsR0FBQTtBQUNBLEVBQUEsS0FBSyxJQUFJQSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELFVBQVUsQ0FBQ1QsTUFBTSxFQUFFVSxDQUFDLEVBQUUsRUFBRTtBQUN4QyxJQUFBLElBQUlGLFVBQVUsQ0FBQ0csT0FBTyxDQUFDRixVQUFVLENBQUNDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUNyQyxPQUFPLEtBQUssQ0FBQTtBQUNwQixHQUFBO0FBQ0EsRUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLENBQUE7QUFFQSxNQUFNRSxJQUFJLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFFdkIsTUFBTUMsU0FBUyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzVCLE1BQU1DLFNBQVMsR0FBRyxJQUFJRCxJQUFJLEVBQUUsQ0FBQTtBQUM1QixNQUFNRSxTQUFTLEdBQUcsSUFBSUYsSUFBSSxFQUFFLENBQUE7QUFDNUIsU0FBU0csWUFBWSxDQUFDQyxFQUFFLEVBQUU7QUFDdEIsRUFBQSxNQUFNQyxFQUFFLEdBQUdELEVBQUUsQ0FBQ0UsSUFBSSxDQUFDQyxjQUFjLENBQUE7QUFDakNGLEVBQUFBLEVBQUUsQ0FBQ0csSUFBSSxDQUFDVCxTQUFTLENBQUMsQ0FBQTtBQUNsQk0sRUFBQUEsRUFBRSxDQUFDSSxJQUFJLENBQUNSLFNBQVMsQ0FBQyxDQUFBO0FBQ2xCSSxFQUFBQSxFQUFFLENBQUNLLElBQUksQ0FBQ1IsU0FBUyxDQUFDLENBQUE7QUFDbEJILEVBQUFBLFNBQVMsQ0FBQ1ksS0FBSyxDQUFDWixTQUFTLEVBQUVFLFNBQVMsQ0FBQyxDQUFBO0FBQ3JDLEVBQUEsT0FBT0YsU0FBUyxDQUFDYSxHQUFHLENBQUNWLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDakQsQ0FBQTs7QUFLQSxNQUFNVyxZQUFZLENBQUM7QUFRZkMsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFFO0lBQzdCLElBQUksQ0FBQ0YsTUFBTSxHQUFHQSxNQUFNLENBQUE7SUFDcEIsSUFBSSxDQUFDRyxRQUFRLEdBQUdGLElBQUksQ0FBQTtJQUNwQixJQUFJLENBQUNDLEtBQUssR0FBR0EsS0FBSyxDQUFBO0lBQ2xCLElBQUksQ0FBQ0UsS0FBSyxHQUFHLEtBQUssQ0FBQTtBQUVsQixJQUFBLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEVBQUUsQ0FBQTtJQUN0QixJQUFJLENBQUNDLGtCQUFrQixHQUFHLENBQUMsQ0FBQTtJQUMzQixJQUFJLENBQUNDLFVBQVUsR0FBRyxFQUFFLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsRUFBRSxDQUFBO0lBR3RCLElBQUksQ0FBQ0MsTUFBTSxHQUFHO0FBQ1ZDLE1BQUFBLFVBQVUsRUFBRSxDQUFDO0FBQ2JDLE1BQUFBLG1CQUFtQixFQUFFLENBQUE7S0FDeEIsQ0FBQTtBQUVMLEdBQUE7QUFFQUMsRUFBQUEsT0FBTyxHQUFHO0lBQ04sSUFBSSxDQUFDWixNQUFNLEdBQUcsSUFBSSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0csUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNwQixJQUFJLENBQUNELEtBQUssR0FBRyxJQUFJLENBQUE7QUFDakIsSUFBQSxJQUFJLENBQUNHLFlBQVksR0FBRyxFQUFFLENBQUE7SUFDdEIsSUFBSSxDQUFDRSxVQUFVLEdBQUcsRUFBRSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEVBQUUsQ0FBQTtBQUMxQixHQUFBOztFQWlCQUssUUFBUSxDQUFDQyxJQUFJLEVBQUVDLE9BQU8sRUFBRUMsV0FBVyxFQUFFQyxFQUFFLEVBQUVDLE1BQU0sRUFBRTtJQUM3QyxJQUFJRCxFQUFFLEtBQUtFLFNBQVMsRUFBRTtNQUNsQkYsRUFBRSxHQUFHLElBQUksQ0FBQ1gsa0JBQWtCLENBQUE7TUFDNUIsSUFBSSxDQUFDQSxrQkFBa0IsRUFBRSxDQUFBO0FBQzdCLEtBQUE7QUFFQSxJQUFBLElBQUksSUFBSSxDQUFDRCxZQUFZLENBQUNZLEVBQUUsQ0FBQyxFQUFFO0FBQ3ZCRyxNQUFBQSxLQUFLLENBQUNDLEtBQUssQ0FBRSxDQUFzQkosb0JBQUFBLEVBQUFBLEVBQUcsa0JBQWlCLENBQUMsQ0FBQTtBQUN4RCxNQUFBLE9BQU9FLFNBQVMsQ0FBQTtBQUNwQixLQUFBO0FBRUEsSUFBQSxNQUFNRyxLQUFLLEdBQUcsSUFBSUMsVUFBVSxDQUFDTixFQUFFLEVBQUVILElBQUksRUFBRUMsT0FBTyxFQUFFQyxXQUFXLEVBQUVFLE1BQU0sQ0FBQyxDQUFBO0FBQ3BFLElBQUEsSUFBSSxDQUFDYixZQUFZLENBQUNZLEVBQUUsQ0FBQyxHQUFHSyxLQUFLLENBQUE7QUFFN0IsSUFBQSxPQUFPQSxLQUFLLENBQUE7QUFDaEIsR0FBQTs7RUFRQUUsV0FBVyxDQUFDUCxFQUFFLEVBQUU7QUFDWixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNaLFlBQVksQ0FBQ1ksRUFBRSxDQUFDLEVBQUU7QUFDeEJHLE1BQUFBLEtBQUssQ0FBQ0MsS0FBSyxDQUFFLENBQXNCSixvQkFBQUEsRUFBQUEsRUFBRyxpQkFBZ0IsQ0FBQyxDQUFBO0FBQ3ZELE1BQUEsT0FBQTtBQUNKLEtBQUE7O0lBR0EsTUFBTVEsWUFBWSxHQUFHLEVBQUUsQ0FBQTtBQUN2QixJQUFBLEtBQUssSUFBSXRELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNvQyxVQUFVLENBQUNyQyxNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO01BQzdDLElBQUksSUFBSSxDQUFDb0MsVUFBVSxDQUFDcEMsQ0FBQyxDQUFDLENBQUN1RCxZQUFZLEtBQUtULEVBQUUsRUFBRTtRQUN4QyxJQUFJLENBQUNVLFlBQVksQ0FBQyxJQUFJLENBQUNwQixVQUFVLENBQUNwQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3pDLE9BQUMsTUFBTTtRQUNIc0QsWUFBWSxDQUFDRyxJQUFJLENBQUMsSUFBSSxDQUFDckIsVUFBVSxDQUFDcEMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN6QyxPQUFBO0FBQ0osS0FBQTtJQUNBLElBQUksQ0FBQ29DLFVBQVUsR0FBR2tCLFlBQVksQ0FBQTtJQUM5QixJQUFJLENBQUNJLDJCQUEyQixDQUFDLElBQUksQ0FBQzFCLFFBQVEsRUFBRWMsRUFBRSxDQUFDLENBQUE7QUFFbkQsSUFBQSxPQUFPLElBQUksQ0FBQ1osWUFBWSxDQUFDWSxFQUFFLENBQUMsQ0FBQTtBQUNoQyxHQUFBOztFQVFBYSxjQUFjLENBQUNiLEVBQUUsRUFBRTtJQUNmLElBQUksSUFBSSxDQUFDVCxZQUFZLENBQUMzQixPQUFPLENBQUNvQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDbkMsTUFBQSxJQUFJLENBQUNULFlBQVksQ0FBQ29CLElBQUksQ0FBQ1gsRUFBRSxDQUFDLENBQUE7QUFDOUIsS0FBQTtBQUNKLEdBQUE7O0VBU0FjLGNBQWMsQ0FBQ2pCLElBQUksRUFBRTtBQUNqQixJQUFBLE1BQU1rQixNQUFNLEdBQUcsSUFBSSxDQUFDM0IsWUFBWSxDQUFBO0FBQ2hDLElBQUEsS0FBSyxNQUFNaUIsS0FBSyxJQUFJVSxNQUFNLEVBQUU7QUFDeEIsTUFBQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ3hELGNBQWMsQ0FBQzhDLEtBQUssQ0FBQyxFQUFFLFNBQUE7TUFDbkMsSUFBSVUsTUFBTSxDQUFDVixLQUFLLENBQUMsQ0FBQ1IsSUFBSSxLQUFLQSxJQUFJLEVBQUU7UUFDN0IsT0FBT2tCLE1BQU0sQ0FBQ1YsS0FBSyxDQUFDLENBQUE7QUFDeEIsT0FBQTtBQUNKLEtBQUE7QUFDQSxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7RUFTQVcsVUFBVSxDQUFDUCxZQUFZLEVBQUU7SUFDckIsTUFBTVEsT0FBTyxHQUFHLEVBQUUsQ0FBQTtBQUNsQixJQUFBLE1BQU1DLEdBQUcsR0FBRyxJQUFJLENBQUM1QixVQUFVLENBQUNyQyxNQUFNLENBQUE7SUFDbEMsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdnRSxHQUFHLEVBQUVoRSxDQUFDLEVBQUUsRUFBRTtBQUMxQixNQUFBLE1BQU1pRSxLQUFLLEdBQUcsSUFBSSxDQUFDN0IsVUFBVSxDQUFDcEMsQ0FBQyxDQUFDLENBQUE7QUFDaEMsTUFBQSxJQUFJaUUsS0FBSyxDQUFDVixZQUFZLEtBQUtBLFlBQVksRUFBRTtBQUNyQ1EsUUFBQUEsT0FBTyxDQUFDTixJQUFJLENBQUNRLEtBQUssQ0FBQyxDQUFBO0FBQ3ZCLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPRixPQUFPLENBQUE7QUFDbEIsR0FBQTs7QUFHQUwsRUFBQUEsMkJBQTJCLENBQUN0QyxJQUFJLEVBQUUwQixFQUFFLEVBQUU7QUFDbEMsSUFBQSxJQUFJLENBQUMxQixJQUFJLENBQUM4QyxPQUFPLEVBQUUsT0FBQTtJQUVuQixJQUFJOUMsSUFBSSxDQUFDK0MsS0FBSyxJQUFJL0MsSUFBSSxDQUFDK0MsS0FBSyxDQUFDWixZQUFZLEtBQUtULEVBQUUsRUFBRTtBQUM5QzFCLE1BQUFBLElBQUksQ0FBQytDLEtBQUssQ0FBQ1osWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2hDLEtBQUE7SUFDQSxJQUFJbkMsSUFBSSxDQUFDZ0QsTUFBTSxJQUFJaEQsSUFBSSxDQUFDZ0QsTUFBTSxDQUFDYixZQUFZLEtBQUtULEVBQUUsRUFBRTtBQUNoRDFCLE1BQUFBLElBQUksQ0FBQ2dELE1BQU0sQ0FBQ2IsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2pDLEtBQUE7SUFDQSxJQUFJbkMsSUFBSSxDQUFDaUQsT0FBTyxJQUFJakQsSUFBSSxDQUFDaUQsT0FBTyxDQUFDZCxZQUFZLEtBQUtULEVBQUUsRUFBRTtBQUNsRDFCLE1BQUFBLElBQUksQ0FBQ2lELE9BQU8sQ0FBQ2QsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7SUFDQSxJQUFJbkMsSUFBSSxDQUFDa0QsTUFBTSxJQUFJbEQsSUFBSSxDQUFDa0QsTUFBTSxDQUFDZixZQUFZLEtBQUtULEVBQUUsRUFBRTtBQUNoRDFCLE1BQUFBLElBQUksQ0FBQ2tELE1BQU0sQ0FBQ2YsWUFBWSxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ2pDLEtBQUE7QUFFQSxJQUFBLEtBQUssSUFBSXZELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR29CLElBQUksQ0FBQ21ELFNBQVMsQ0FBQ3hFLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7TUFDNUMsSUFBSSxDQUFDMEQsMkJBQTJCLENBQUN0QyxJQUFJLENBQUNtRCxTQUFTLENBQUN2RSxDQUFDLENBQUMsRUFBRThDLEVBQUUsQ0FBQyxDQUFBO0FBQzNELEtBQUE7QUFDSixHQUFBO0FBRUEwQixFQUFBQSxNQUFNLENBQUNDLElBQUksRUFBRUMsT0FBTyxFQUFFdEQsSUFBSSxFQUFFO0FBQ3hCLElBQUEsTUFBTStCLEtBQUssR0FBRyxJQUFJLENBQUNqQixZQUFZLENBQUN3QyxPQUFPLENBQUMsQ0FBQTtJQUN4Q3pCLEtBQUssQ0FBQzBCLE1BQU0sQ0FBQ3hCLEtBQUssRUFBRyxDQUFnQnVCLGNBQUFBLEVBQUFBLE9BQVEsWUFBVyxDQUFDLENBQUE7QUFFekQsSUFBQSxJQUFJdkIsS0FBSyxFQUFFO0FBQ1AsTUFBQSxJQUFJQSxLQUFLLENBQUN5QixJQUFJLENBQUNILElBQUksQ0FBQyxDQUFDL0QsT0FBTyxDQUFDVSxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDcEMrQixLQUFLLENBQUN5QixJQUFJLENBQUNILElBQUksQ0FBQyxDQUFDaEIsSUFBSSxDQUFDckMsSUFBSSxDQUFDLENBQUE7QUFDM0IsUUFBQSxJQUFJLENBQUN1QyxjQUFjLENBQUNlLE9BQU8sQ0FBQyxDQUFBO0FBQ2hDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBRyxFQUFBQSxNQUFNLENBQUNKLElBQUksRUFBRUMsT0FBTyxFQUFFdEQsSUFBSSxFQUFFO0FBQ3hCLElBQUEsTUFBTStCLEtBQUssR0FBRyxJQUFJLENBQUNqQixZQUFZLENBQUN3QyxPQUFPLENBQUMsQ0FBQTtJQUN4Q3pCLEtBQUssQ0FBQzBCLE1BQU0sQ0FBQ3hCLEtBQUssRUFBRyxDQUFnQnVCLGNBQUFBLEVBQUFBLE9BQVEsWUFBVyxDQUFDLENBQUE7QUFFekQsSUFBQSxJQUFJdkIsS0FBSyxFQUFFO0FBQ1AsTUFBQSxNQUFNMkIsR0FBRyxHQUFHM0IsS0FBSyxDQUFDeUIsSUFBSSxDQUFDSCxJQUFJLENBQUMsQ0FBQy9ELE9BQU8sQ0FBQ1UsSUFBSSxDQUFDLENBQUE7TUFDMUMsSUFBSTBELEdBQUcsSUFBSSxDQUFDLEVBQUU7UUFDVjNCLEtBQUssQ0FBQ3lCLElBQUksQ0FBQ0gsSUFBSSxDQUFDLENBQUNNLE1BQU0sQ0FBQ0QsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQy9CLFFBQUEsSUFBSSxDQUFDbkIsY0FBYyxDQUFDZSxPQUFPLENBQUMsQ0FBQTtBQUNoQyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7RUFFQU0sY0FBYyxDQUFDNUQsSUFBSSxFQUFFNkQsR0FBRyxFQUFFOUIsS0FBSyxFQUFFK0Isa0JBQWtCLEVBQUU7SUFDakQsSUFBSTlELElBQUksQ0FBQ2dELE1BQU0sRUFBRTtBQUViLE1BQUEsSUFBSWhELElBQUksQ0FBQ2dELE1BQU0sQ0FBQ2UsUUFBUSxFQUFFO0FBR3RCLFFBQUEsTUFBTUMsU0FBUyxHQUFHLElBQUksQ0FBQ3JELEtBQUssQ0FBQ3FELFNBQVMsQ0FBQTtBQUN0QyxRQUFBLE1BQU1DLGlCQUFpQixHQUFHakUsSUFBSSxDQUFDZ0QsTUFBTSxDQUFDa0IsYUFBYSxDQUFBO0FBQ25ELFFBQUEsS0FBSyxJQUFJdEYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHb0YsU0FBUyxDQUFDckYsTUFBTSxFQUFFQyxDQUFDLEVBQUUsRUFBRTtBQUN2QyxVQUFBLElBQUksQ0FBQ29GLFNBQVMsQ0FBQ3BGLENBQUMsQ0FBQyxDQUFDdUYsYUFBYSxFQUFFLFNBQUE7QUFDakMsVUFBQSxJQUFJRixpQkFBaUIsQ0FBQzNFLE9BQU8sQ0FBQzBFLFNBQVMsQ0FBQ3BGLENBQUMsQ0FBQyxDQUFDdUYsYUFBYSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFNBQUE7QUFDL0ROLFVBQUFBLEdBQUcsQ0FBQ3hCLElBQUksQ0FBQzJCLFNBQVMsQ0FBQ3BGLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDMUIsU0FBQTtBQUNBLFFBQUEsS0FBSyxJQUFJQSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdxRixpQkFBaUIsQ0FBQ3RGLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7VUFDL0MsSUFBSW9GLFNBQVMsQ0FBQzFFLE9BQU8sQ0FBQzJFLGlCQUFpQixDQUFDckYsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDOUNpRixZQUFBQSxHQUFHLENBQUN4QixJQUFJLENBQUM0QixpQkFBaUIsQ0FBQ3JGLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEMsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFDLE1BQU07QUFDSGlGLFFBQUFBLEdBQUcsR0FBR0Msa0JBQWtCLENBQUM5RCxJQUFJLENBQUNnRCxNQUFNLENBQUNiLFlBQVksQ0FBQyxHQUFHMEIsR0FBRyxDQUFDTyxNQUFNLENBQUNwRSxJQUFJLENBQUNnRCxNQUFNLENBQUNrQixhQUFhLENBQUMsQ0FBQTtBQUM5RixPQUFBO0FBRUFsRSxNQUFBQSxJQUFJLENBQUNnRCxNQUFNLENBQUNxQixnQkFBZ0IsRUFBRSxDQUFBO0FBQ2xDLEtBQUE7QUFFQSxJQUFBLE9BQU9SLEdBQUcsQ0FBQTtBQUNkLEdBQUE7RUFFQVMsYUFBYSxDQUFDdEUsSUFBSSxFQUFFNkQsR0FBRyxFQUFFOUIsS0FBSyxFQUFFK0Isa0JBQWtCLEVBQUU7SUFDaEQsSUFBSTlELElBQUksQ0FBQytDLEtBQUssSUFBSS9DLElBQUksQ0FBQytDLEtBQUssQ0FBQ0EsS0FBSyxFQUFFO0FBQ2hDLE1BQUEsSUFBSS9DLElBQUksQ0FBQytDLEtBQUssQ0FBQ2dCLFFBQVEsRUFBRTtBQUdyQixRQUFBLE1BQU1DLFNBQVMsR0FBRyxJQUFJLENBQUNyRCxLQUFLLENBQUNxRCxTQUFTLENBQUE7QUFDdEMsUUFBQSxNQUFNQyxpQkFBaUIsR0FBR2pFLElBQUksQ0FBQytDLEtBQUssQ0FBQ21CLGFBQWEsQ0FBQTtBQUNsRCxRQUFBLEtBQUssSUFBSXRGLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR29GLFNBQVMsQ0FBQ3JGLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7QUFDdkMsVUFBQSxJQUFJLENBQUNvRixTQUFTLENBQUNwRixDQUFDLENBQUMsQ0FBQ3VGLGFBQWEsRUFBRSxTQUFBO0FBQ2pDLFVBQUEsSUFBSUYsaUJBQWlCLENBQUMzRSxPQUFPLENBQUMwRSxTQUFTLENBQUNwRixDQUFDLENBQUMsQ0FBQ3VGLGFBQWEsQ0FBQyxHQUFHLENBQUMsRUFBRSxTQUFBO0FBQy9ETixVQUFBQSxHQUFHLENBQUN4QixJQUFJLENBQUMyQixTQUFTLENBQUNwRixDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzFCLFNBQUE7QUFDQSxRQUFBLEtBQUssSUFBSUEsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHcUYsaUJBQWlCLENBQUN0RixNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO1VBQy9DLElBQUlvRixTQUFTLENBQUMxRSxPQUFPLENBQUMyRSxpQkFBaUIsQ0FBQ3JGLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQzlDaUYsWUFBQUEsR0FBRyxDQUFDeEIsSUFBSSxDQUFDNEIsaUJBQWlCLENBQUNyRixDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xDLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQyxNQUFNO0FBQ0hpRixRQUFBQSxHQUFHLEdBQUdDLGtCQUFrQixDQUFDOUQsSUFBSSxDQUFDK0MsS0FBSyxDQUFDWixZQUFZLENBQUMsR0FBRzBCLEdBQUcsQ0FBQ08sTUFBTSxDQUFDcEUsSUFBSSxDQUFDK0MsS0FBSyxDQUFDbUIsYUFBYSxDQUFDLENBQUE7QUFDNUYsT0FBQTtBQUVBbEUsTUFBQUEsSUFBSSxDQUFDK0MsS0FBSyxDQUFDd0IscUJBQXFCLEVBQUUsQ0FBQTtBQUdsQ3ZFLE1BQUFBLElBQUksQ0FBQytDLEtBQUssQ0FBQ3lCLFdBQVcsR0FBR3pDLEtBQUssQ0FBQTtBQUVsQyxLQUFBO0FBRUEsSUFBQSxPQUFPOEIsR0FBRyxDQUFBO0FBQ2QsR0FBQTtBQUVBWSxFQUFBQSxlQUFlLENBQUN6RSxJQUFJLEVBQUU2RCxHQUFHLEVBQUU5QixLQUFLLEVBQUU7QUFDOUIsSUFBQSxJQUFJLENBQUMvQixJQUFJLENBQUNpRCxPQUFPLEVBQUUsT0FBQTtJQUNuQixJQUFJeUIsS0FBSyxHQUFHLEtBQUssQ0FBQTtBQUNqQixJQUFBLElBQUkxRSxJQUFJLENBQUNpRCxPQUFPLENBQUMwQixLQUFLLElBQUkzRSxJQUFJLENBQUNpRCxPQUFPLENBQUMwQixLQUFLLENBQUNDLE1BQU0sQ0FBQ1YsYUFBYSxDQUFDdkYsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUMxRWtGLE1BQUFBLEdBQUcsQ0FBQ3hCLElBQUksQ0FBQ3JDLElBQUksQ0FBQ2lELE9BQU8sQ0FBQzBCLEtBQUssQ0FBQ0MsTUFBTSxDQUFDVixhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNwRGxFLE1BQUFBLElBQUksQ0FBQ2lELE9BQU8sQ0FBQ3NCLHFCQUFxQixDQUFDdkUsSUFBSSxDQUFDaUQsT0FBTyxDQUFDMEIsS0FBSyxDQUFDQyxNQUFNLENBQUMsQ0FBQTtBQUU3REYsTUFBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUNoQixLQUFDLE1BQU0sSUFBSTFFLElBQUksQ0FBQ2lELE9BQU8sQ0FBQzRCLE1BQU0sRUFBRTtBQUM1QmhCLE1BQUFBLEdBQUcsQ0FBQ3hCLElBQUksQ0FBQ3JDLElBQUksQ0FBQ2lELE9BQU8sQ0FBQzRCLE1BQU0sQ0FBQ0MsV0FBVyxDQUFDQyxZQUFZLENBQUMsQ0FBQTtBQUN0RC9FLE1BQUFBLElBQUksQ0FBQ2lELE9BQU8sQ0FBQ3NCLHFCQUFxQixDQUFDdkUsSUFBSSxDQUFDaUQsT0FBTyxDQUFDNEIsTUFBTSxDQUFDQyxXQUFXLENBQUMvQixLQUFLLENBQUMsQ0FBQTtNQUV6RSxJQUFJL0MsSUFBSSxDQUFDaUQsT0FBTyxDQUFDNEIsTUFBTSxDQUFDQyxXQUFXLENBQUNFLGtCQUFrQixFQUFFO0FBQ3BEbkIsUUFBQUEsR0FBRyxDQUFDeEIsSUFBSSxDQUFDckMsSUFBSSxDQUFDaUQsT0FBTyxDQUFDNEIsTUFBTSxDQUFDQyxXQUFXLENBQUNFLGtCQUFrQixDQUFDLENBQUE7UUFDNUQsSUFBSSxDQUFDaEYsSUFBSSxDQUFDaUQsT0FBTyxDQUFDNEIsTUFBTSxDQUFDQyxXQUFXLENBQUNFLGtCQUFrQixDQUFDQyxZQUFZLElBQ2hFLENBQUNqRixJQUFJLENBQUNpRCxPQUFPLENBQUM0QixNQUFNLENBQUNDLFdBQVcsQ0FBQ0Usa0JBQWtCLENBQUNFLFdBQVcsRUFBRTtBQUNqRWxGLFVBQUFBLElBQUksQ0FBQ2lELE9BQU8sQ0FBQ2tDLFlBQVksRUFBRSxDQUFBO0FBQzNCbkYsVUFBQUEsSUFBSSxDQUFDaUQsT0FBTyxDQUFDbUMsWUFBWSxFQUFFLENBQUE7QUFDL0IsU0FBQTtBQUNKLE9BQUE7QUFFQVYsTUFBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUNoQixLQUFBO0FBRUEsSUFBQSxJQUFJQSxLQUFLLEVBQUU7TUFDUDNDLEtBQUssQ0FBQ3NELEdBQUcsR0FBRyxJQUFJLENBQUE7QUFFaEJyRixNQUFBQSxJQUFJLENBQUNpRCxPQUFPLENBQUN1QixXQUFXLEdBQUd6QyxLQUFLLENBQUE7QUFFcEMsS0FBQTtBQUNKLEdBQUE7O0FBTUF1RCxFQUFBQSw4QkFBOEIsQ0FBQ3hCLGtCQUFrQixFQUFFeUIsUUFBUSxFQUFFO0FBQ3pELElBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELFFBQVEsQ0FBQzVHLE1BQU0sRUFBRTZHLENBQUMsRUFBRSxFQUFFO0FBQ3RDLE1BQUEsTUFBTTlELEVBQUUsR0FBRzZELFFBQVEsQ0FBQ0MsQ0FBQyxDQUFDLENBQUE7QUFDdEIsTUFBQSxNQUFNekQsS0FBSyxHQUFHLElBQUksQ0FBQ2pCLFlBQVksQ0FBQ1ksRUFBRSxDQUFDLENBQUE7TUFDbkMsSUFBSSxDQUFDSyxLQUFLLEVBQUUsU0FBQTtBQUNaLE1BQUEsSUFBSThCLEdBQUcsR0FBR0Msa0JBQWtCLENBQUNwQyxFQUFFLENBQUMsQ0FBQTtNQUNoQyxJQUFJLENBQUNtQyxHQUFHLEVBQUVBLEdBQUcsR0FBR0Msa0JBQWtCLENBQUNwQyxFQUFFLENBQUMsR0FBRyxFQUFFLENBQUE7QUFFM0MsTUFBQSxLQUFLLElBQUkrRCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcxRCxLQUFLLENBQUN5QixJQUFJLENBQUNULEtBQUssQ0FBQ3BFLE1BQU0sRUFBRThHLENBQUMsRUFBRSxFQUFFO0FBQzlDNUIsUUFBQUEsR0FBRyxHQUFHLElBQUksQ0FBQ1MsYUFBYSxDQUFDdkMsS0FBSyxDQUFDeUIsSUFBSSxDQUFDVCxLQUFLLENBQUMwQyxDQUFDLENBQUMsRUFBRTVCLEdBQUcsRUFBRTlCLEtBQUssRUFBRStCLGtCQUFrQixDQUFDLENBQUE7QUFDakYsT0FBQTtBQUVBLE1BQUEsS0FBSyxJQUFJNEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHM0QsS0FBSyxDQUFDeUIsSUFBSSxDQUFDUixNQUFNLENBQUNyRSxNQUFNLEVBQUUrRyxDQUFDLEVBQUUsRUFBRTtBQUMvQzdCLFFBQUFBLEdBQUcsR0FBRyxJQUFJLENBQUNELGNBQWMsQ0FBQzdCLEtBQUssQ0FBQ3lCLElBQUksQ0FBQ1IsTUFBTSxDQUFDMEMsQ0FBQyxDQUFDLEVBQUU3QixHQUFHLEVBQUU5QixLQUFLLEVBQUUrQixrQkFBa0IsQ0FBQyxDQUFBO0FBQ25GLE9BQUE7QUFFQSxNQUFBLEtBQUssSUFBSTZCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzVELEtBQUssQ0FBQ3lCLElBQUksQ0FBQ1AsT0FBTyxDQUFDdEUsTUFBTSxFQUFFZ0gsQ0FBQyxFQUFFLEVBQUU7QUFDaEQsUUFBQSxJQUFJLENBQUNsQixlQUFlLENBQUMxQyxLQUFLLENBQUN5QixJQUFJLENBQUNQLE9BQU8sQ0FBQzBDLENBQUMsQ0FBQyxFQUFFOUIsR0FBRyxFQUFFOUIsS0FBSyxDQUFDLENBQUE7QUFDM0QsT0FBQTtBQUVBLE1BQUEsS0FBSyxJQUFJNkQsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHN0QsS0FBSyxDQUFDeUIsSUFBSSxDQUFDTixNQUFNLENBQUN2RSxNQUFNLEVBQUVpSCxDQUFDLEVBQUUsRUFBRTtRQUMvQyxNQUFNNUYsSUFBSSxHQUFHK0IsS0FBSyxDQUFDeUIsSUFBSSxDQUFDTixNQUFNLENBQUMwQyxDQUFDLENBQUMsQ0FBQTtRQUNqQyxJQUFJNUYsSUFBSSxDQUFDa0QsTUFBTSxJQUFJbEQsSUFBSSxDQUFDa0QsTUFBTSxDQUFDMkMsYUFBYSxLQUN2QzlELEtBQUssQ0FBQ1AsT0FBTyxJQUFJeEIsSUFBSSxDQUFDa0QsTUFBTSxDQUFDQSxNQUFNLENBQUM0QyxXQUFXLEtBQUtDLHdCQUF3QixDQUFDLEVBQUU7VUFDaEZsQyxHQUFHLENBQUN4QixJQUFJLENBQUNyQyxJQUFJLENBQUNrRCxNQUFNLENBQUMyQyxhQUFhLENBQUMsQ0FBQTtBQUNuQzdGLFVBQUFBLElBQUksQ0FBQ2tELE1BQU0sQ0FBQ3FCLHFCQUFxQixFQUFFLENBQUE7VUFDbkN4QyxLQUFLLENBQUNpRSxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3BCaEcsVUFBQUEsSUFBSSxDQUFDa0QsTUFBTSxDQUFDc0IsV0FBVyxHQUFHekMsS0FBSyxDQUFBO0FBQ25DLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0VBU0FrRSxRQUFRLENBQUNWLFFBQVEsRUFBRTtJQUNmLE1BQU16QixrQkFBa0IsR0FBRyxFQUFFLENBQUE7SUFFN0IsSUFBSSxDQUFDeUIsUUFBUSxFQUFFO01BRVhBLFFBQVEsR0FBR1csTUFBTSxDQUFDQyxJQUFJLENBQUMsSUFBSSxDQUFDckYsWUFBWSxDQUFDLENBQUE7QUFDN0MsS0FBQTs7SUFHQSxNQUFNb0IsWUFBWSxHQUFHLEVBQUUsQ0FBQTtBQUN2QixJQUFBLEtBQUssSUFBSXRELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNvQyxVQUFVLENBQUNyQyxNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO0FBQzdDLE1BQUEsSUFBSTJHLFFBQVEsQ0FBQ2pHLE9BQU8sQ0FBQyxJQUFJLENBQUMwQixVQUFVLENBQUNwQyxDQUFDLENBQUMsQ0FBQ3VELFlBQVksQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN2REQsWUFBWSxDQUFDRyxJQUFJLENBQUMsSUFBSSxDQUFDckIsVUFBVSxDQUFDcEMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyQyxRQUFBLFNBQUE7QUFDSixPQUFBO01BQ0EsSUFBSSxDQUFDd0QsWUFBWSxDQUFDLElBQUksQ0FBQ3BCLFVBQVUsQ0FBQ3BDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDekMsS0FBQTtJQUNBLElBQUksQ0FBQ29DLFVBQVUsR0FBR2tCLFlBQVksQ0FBQTs7QUFHOUIsSUFBQSxJQUFJLENBQUNvRCw4QkFBOEIsQ0FBQ3hCLGtCQUFrQixFQUFFeUIsUUFBUSxDQUFDLENBQUE7QUFFakUsSUFBQSxJQUFJQSxRQUFRLEtBQUssSUFBSSxDQUFDdEUsWUFBWSxFQUFFO0FBQ2hDLE1BQUEsSUFBSSxDQUFDQSxZQUFZLENBQUN0QyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ2hDLEtBQUMsTUFBTTtNQUNILE1BQU15SCxjQUFjLEdBQUcsRUFBRSxDQUFBO0FBQ3pCLE1BQUEsS0FBSyxJQUFJeEgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ3FDLFlBQVksQ0FBQ3RDLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7UUFDL0MsSUFBSTJHLFFBQVEsQ0FBQ2pHLE9BQU8sQ0FBQyxJQUFJLENBQUMyQixZQUFZLENBQUNyQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRXdILGNBQWMsQ0FBQy9ELElBQUksQ0FBQyxJQUFJLENBQUNwQixZQUFZLENBQUNyQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzdGLE9BQUE7TUFDQSxJQUFJLENBQUNxQyxZQUFZLEdBQUdtRixjQUFjLENBQUE7QUFDdEMsS0FBQTtBQUVBLElBQUEsSUFBSXJFLEtBQUssRUFBRXNFLEtBQUssRUFBRUMsU0FBUyxFQUFFekQsS0FBSyxDQUFBO0FBQ2xDLElBQUEsS0FBSyxNQUFNUyxPQUFPLElBQUlRLGtCQUFrQixFQUFFO0FBQ3RDLE1BQUEsSUFBSSxDQUFDQSxrQkFBa0IsQ0FBQzdFLGNBQWMsQ0FBQ3FFLE9BQU8sQ0FBQyxFQUFFLFNBQUE7QUFDakR2QixNQUFBQSxLQUFLLEdBQUcrQixrQkFBa0IsQ0FBQ1IsT0FBTyxDQUFDLENBQUE7QUFFbkNnRCxNQUFBQSxTQUFTLEdBQUcsSUFBSSxDQUFDeEYsWUFBWSxDQUFDd0MsT0FBTyxDQUFDLENBQUE7TUFDdEMsSUFBSSxDQUFDZ0QsU0FBUyxFQUFFO0FBQ1p6RSxRQUFBQSxLQUFLLENBQUNDLEtBQUssQ0FBRSxDQUFjd0IsWUFBQUEsRUFBQUEsT0FBUSxZQUFXLENBQUMsQ0FBQTtBQUMvQyxRQUFBLFNBQUE7QUFDSixPQUFBO01BRUErQyxLQUFLLEdBQUcsSUFBSSxDQUFDRSxPQUFPLENBQUN4RSxLQUFLLEVBQUV1RSxTQUFTLENBQUM5RSxPQUFPLEVBQUU4RSxTQUFTLENBQUM3RSxXQUFXLEVBQUU2RSxTQUFTLENBQUNqQixHQUFHLElBQUlpQixTQUFTLENBQUNOLE9BQU8sQ0FBQyxDQUFBO0FBQ3pHLE1BQUEsS0FBSyxJQUFJcEgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHeUgsS0FBSyxDQUFDMUgsTUFBTSxFQUFFQyxDQUFDLEVBQUUsRUFBRTtRQUNuQ2lFLEtBQUssR0FBRyxJQUFJLENBQUMyRCxNQUFNLENBQUNILEtBQUssQ0FBQ3pILENBQUMsQ0FBQyxFQUFFMEgsU0FBUyxDQUFDOUUsT0FBTyxFQUFFaUYsUUFBUSxDQUFDbkQsT0FBTyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDdkUsUUFBQSxJQUFJVCxLQUFLLEVBQUU7VUFDUEEsS0FBSyxDQUFDNkQsV0FBVyxDQUFDLElBQUksQ0FBQy9GLEtBQUssRUFBRTJGLFNBQVMsQ0FBQzNFLE1BQU0sQ0FBQyxDQUFBO0FBQ25ELFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBMkJBNEUsRUFBQUEsT0FBTyxDQUFDckMsYUFBYSxFQUFFMUMsT0FBTyxFQUFFQyxXQUFXLEdBQUdrRixNQUFNLENBQUNDLGlCQUFpQixFQUFFQyxXQUFXLEVBQUU7QUFDakYsSUFBQSxJQUFJM0MsYUFBYSxDQUFDdkYsTUFBTSxLQUFLLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQTtBQUN6QyxJQUFBLE1BQU1tSSxlQUFlLEdBQUdyRixXQUFXLEdBQUcsR0FBRyxDQUFBO0FBQ3pDLElBQUEsTUFBTXNGLGdCQUFnQixHQUFHLElBQUksQ0FBQ3RHLE1BQU0sQ0FBQ3VHLG9CQUFvQixHQUFHLElBQUksR0FBRyxJQUFJLENBQUN2RyxNQUFNLENBQUN3RyxTQUFTLENBQUE7O0lBSXhGLE1BQU1DLGNBQWMsR0FBRyxJQUFJLENBQUN6RyxNQUFNLENBQUMwRyxjQUFjLEdBQUcsVUFBVSxHQUFHLE1BQU0sQ0FBQTtBQUV2RSxJQUFBLE1BQU1DLElBQUksR0FBRyxJQUFJQyxXQUFXLEVBQUUsQ0FBQTtBQUM5QixJQUFBLE1BQU1DLFFBQVEsR0FBRyxJQUFJRCxXQUFXLEVBQUUsQ0FBQTtJQUNsQyxJQUFJRSxtQkFBbUIsR0FBRyxJQUFJLENBQUE7QUFDOUIsSUFBQSxJQUFJQyxFQUFFLENBQUE7SUFFTixNQUFNbkIsS0FBSyxHQUFHLEVBQUUsQ0FBQTtJQUNoQixJQUFJb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUNULElBQUEsSUFBSVosV0FBVyxFQUFFO0FBQ2IzQyxNQUFBQSxhQUFhLENBQUN3RCxJQUFJLENBQUMsVUFBVW5KLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0FBQy9CLFFBQUEsT0FBT0QsQ0FBQyxDQUFDb0osU0FBUyxHQUFHbkosQ0FBQyxDQUFDbUosU0FBUyxDQUFBO0FBQ3BDLE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQTtJQUNBLElBQUlDLGtCQUFrQixHQUFHMUQsYUFBYSxDQUFBO0FBQ3RDLElBQUEsSUFBSTJELGtCQUFrQixDQUFBO0FBRXRCLElBQUEsTUFBTUMsUUFBUSxHQUFHakIsV0FBVyxHQUFHLFVBQVUvRyxFQUFFLEVBQUU7QUFDekMsTUFBQSxJQUFJeUgsbUJBQW1CLEVBQUU7QUFDckJBLFFBQUFBLG1CQUFtQixDQUFDUSxHQUFHLENBQUNqSSxFQUFFLENBQUNzSCxJQUFJLENBQUMsQ0FBQTtBQUNwQyxPQUFDLE1BQU07QUFDSEcsUUFBQUEsbUJBQW1CLEdBQUd6SCxFQUFFLENBQUNzSCxJQUFJLENBQUNZLEtBQUssRUFBRSxDQUFBO0FBQ3pDLE9BQUE7QUFDQUgsTUFBQUEsa0JBQWtCLENBQUN4RixJQUFJLENBQUN2QyxFQUFFLENBQUMsQ0FBQTtLQUM5QixHQUFHLFVBQVVBLEVBQUUsRUFBRTtBQUNkK0gsTUFBQUEsa0JBQWtCLENBQUN4RixJQUFJLENBQUN2QyxFQUFFLENBQUMsQ0FBQTtLQUM5QixDQUFBO0FBRUQsSUFBQSxPQUFPOEgsa0JBQWtCLENBQUNqSixNQUFNLEdBQUcsQ0FBQyxFQUFFO01BQ2xDMEgsS0FBSyxDQUFDb0IsQ0FBQyxDQUFDLEdBQUcsQ0FBQ0csa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNsQ0MsTUFBQUEsa0JBQWtCLEdBQUcsRUFBRSxDQUFBO0FBQ3ZCLE1BQUEsTUFBTUksUUFBUSxHQUFHTCxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQ0ssUUFBUSxDQUFBO0FBQy9DLE1BQUEsTUFBTUMsS0FBSyxHQUFHTixrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQ00sS0FBSyxDQUFBO0FBQ3pDLE1BQUEsTUFBTUMsSUFBSSxHQUFHUCxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQ1EsV0FBVyxDQUFBO0FBQzlDLE1BQUEsTUFBTUMsTUFBTSxHQUFHVCxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQ1UsVUFBVSxDQUFBO0FBQy9DLE1BQUEsTUFBTUMsT0FBTyxHQUFHWCxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzNDLFlBQVksQ0FBQTtBQUNsRCxNQUFBLE1BQU11RCxTQUFTLEdBQUdaLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDYSxnQkFBZ0IsQ0FBQTtBQUN4RCxNQUFBLElBQUlDLFNBQVMsR0FBR2Qsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUNlLElBQUksQ0FBQ0MsWUFBWSxDQUFDQyxjQUFjLEVBQUUsQ0FBQTtBQUN4RSxNQUFBLE1BQU1sQixTQUFTLEdBQUdDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDRCxTQUFTLENBQUE7TUFDakRQLElBQUksQ0FBQzBCLElBQUksQ0FBQ2xCLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDUixJQUFJLENBQUMsQ0FBQTtNQUNyQyxNQUFNMkIsU0FBUyxHQUFHbEosWUFBWSxDQUFDK0gsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyRCxNQUFBLE1BQU1vQix3QkFBd0IsR0FBR3BCLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDZSxJQUFJLENBQUNDLFlBQVksQ0FBQ0ssTUFBTSxDQUFDQyxZQUFZLENBQUE7QUFDNUYsTUFBQSxNQUFNQyxPQUFPLEdBQUd2QixrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQ2UsSUFBSSxDQUFDUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNELE9BQU8sQ0FBQTtBQUMvRDVCLE1BQUFBLG1CQUFtQixHQUFHLElBQUksQ0FBQTtBQUUxQixNQUFBLEtBQUssSUFBSTNJLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR2dKLGtCQUFrQixDQUFDakosTUFBTSxFQUFFQyxDQUFDLEVBQUUsRUFBRTtBQUNoRCxRQUFBLE1BQU1rQixFQUFFLEdBQUc4SCxrQkFBa0IsQ0FBQ2hKLENBQUMsQ0FBQyxDQUFBOztRQUdoQyxJQUFJNEMsT0FBTyxJQUFJNkUsS0FBSyxDQUFDb0IsQ0FBQyxDQUFDLENBQUM5SSxNQUFNLElBQUlvSSxnQkFBZ0IsRUFBRTtVQUNoRGMsa0JBQWtCLEdBQUdBLGtCQUFrQixDQUFDekQsTUFBTSxDQUFDd0Qsa0JBQWtCLENBQUN5QixLQUFLLENBQUN6SyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzNFLFVBQUEsTUFBQTtBQUNKLFNBQUE7O1FBR0EsSUFBS3FKLFFBQVEsS0FBS25JLEVBQUUsQ0FBQ21JLFFBQVEsSUFDeEJDLEtBQUssS0FBS3BJLEVBQUUsQ0FBQ29JLEtBQU0sSUFDbkJjLHdCQUF3QixLQUFLbEosRUFBRSxDQUFDNkksSUFBSSxDQUFDQyxZQUFZLENBQUNLLE1BQU0sQ0FBQ0MsWUFBYSxJQUN0RUMsT0FBTyxLQUFLckosRUFBRSxDQUFDNkksSUFBSSxDQUFDUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNELE9BQVEsSUFDekNoQixJQUFJLEtBQUtySSxFQUFFLENBQUNzSSxXQUFZLElBQ3hCTSxTQUFTLEdBQUc1SSxFQUFFLENBQUM2SSxJQUFJLENBQUNDLFlBQVksQ0FBQ0MsY0FBYyxFQUFFLEdBQUczQixjQUFlLEVBQUU7VUFDdEVZLFFBQVEsQ0FBQ2hJLEVBQUUsQ0FBQyxDQUFBO0FBQ1osVUFBQSxTQUFBO0FBQ0osU0FBQTtBQUVBd0gsUUFBQUEsUUFBUSxDQUFDd0IsSUFBSSxDQUFDMUIsSUFBSSxDQUFDLENBQUE7QUFDbkJFLFFBQUFBLFFBQVEsQ0FBQ1MsR0FBRyxDQUFDakksRUFBRSxDQUFDc0gsSUFBSSxDQUFDLENBQUE7UUFDckIsSUFBSUUsUUFBUSxDQUFDZ0MsV0FBVyxDQUFDQyxDQUFDLEdBQUd6QyxlQUFlLElBQ3hDUSxRQUFRLENBQUNnQyxXQUFXLENBQUNFLENBQUMsR0FBRzFDLGVBQWUsSUFDeENRLFFBQVEsQ0FBQ2dDLFdBQVcsQ0FBQ0csQ0FBQyxHQUFHM0MsZUFBZSxFQUFFO1VBQzFDZ0IsUUFBUSxDQUFDaEksRUFBRSxDQUFDLENBQUE7QUFDWixVQUFBLFNBQUE7QUFDSixTQUFBO0FBRUEsUUFBQSxJQUFJeUksT0FBTyxFQUFFO1VBQ1QsSUFBSSxFQUFFZixFQUFFLEdBQUcxSCxFQUFFLENBQUNtRixZQUFZLENBQUMsSUFBSXNELE9BQU8sQ0FBQ21CLElBQUksS0FBS2xDLEVBQUUsQ0FBQ2tDLElBQUksSUFBSW5CLE9BQU8sQ0FBQ29CLEtBQUssS0FBS25DLEVBQUUsQ0FBQ21DLEtBQUssRUFBRTtZQUNuRjdCLFFBQVEsQ0FBQ2hJLEVBQUUsQ0FBQyxDQUFBO0FBQ1osWUFBQSxTQUFBO0FBQ0osV0FBQTtBQUNKLFNBQUE7QUFFQSxRQUFBLElBQUlpSixTQUFTLEtBQUtsSixZQUFZLENBQUNDLEVBQUUsQ0FBQyxFQUFFO1VBQ2hDZ0ksUUFBUSxDQUFDaEksRUFBRSxDQUFDLENBQUE7QUFDWixVQUFBLFNBQUE7QUFDSixTQUFBOztRQUdBLElBQUksQ0FBQ2pCLGNBQWMsQ0FBQ3dKLE1BQU0sRUFBRXZJLEVBQUUsQ0FBQ3dJLFVBQVUsQ0FBQyxFQUFFO1VBQ3hDUixRQUFRLENBQUNoSSxFQUFFLENBQUMsQ0FBQTtBQUNaLFVBQUEsU0FBQTtBQUNKLFNBQUE7QUFFQSxRQUFBLE1BQU04SixZQUFZLEdBQUc5SixFQUFFLENBQUMySSxnQkFBZ0IsQ0FBQTtRQUN4QyxJQUFJRCxTQUFTLElBQUlvQixZQUFZLEVBQUU7QUFDM0IsVUFBQSxJQUFJLENBQUMxSyxlQUFlLENBQUNzSixTQUFTLEVBQUVvQixZQUFZLENBQUMsRUFBRTtZQUMzQzlCLFFBQVEsQ0FBQ2hJLEVBQUUsQ0FBQyxDQUFBO0FBQ1osWUFBQSxTQUFBO0FBQ0osV0FBQTtBQUNKLFNBQUMsTUFBTSxJQUFJMEksU0FBUyxJQUFJb0IsWUFBWSxFQUFFO1VBQ2xDOUIsUUFBUSxDQUFDaEksRUFBRSxDQUFDLENBQUE7QUFDWixVQUFBLFNBQUE7QUFDSixTQUFBO0FBRUEsUUFBQSxJQUFJK0csV0FBVyxJQUFJVSxtQkFBbUIsSUFBSUEsbUJBQW1CLENBQUNzQyxVQUFVLENBQUMvSixFQUFFLENBQUNzSCxJQUFJLENBQUMsSUFBSXRILEVBQUUsQ0FBQzZILFNBQVMsS0FBS0EsU0FBUyxFQUFFO1VBQzdHRyxRQUFRLENBQUNoSSxFQUFFLENBQUMsQ0FBQTtBQUNaLFVBQUEsU0FBQTtBQUNKLFNBQUE7QUFFQXNILFFBQUFBLElBQUksQ0FBQ1csR0FBRyxDQUFDakksRUFBRSxDQUFDc0gsSUFBSSxDQUFDLENBQUE7UUFDakJzQixTQUFTLElBQUk1SSxFQUFFLENBQUM2SSxJQUFJLENBQUNDLFlBQVksQ0FBQ0MsY0FBYyxFQUFFLENBQUE7QUFDbER4QyxRQUFBQSxLQUFLLENBQUNvQixDQUFDLENBQUMsQ0FBQ3BGLElBQUksQ0FBQ3ZDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCLE9BQUE7QUFFQTJILE1BQUFBLENBQUMsRUFBRSxDQUFBO0FBQ0hHLE1BQUFBLGtCQUFrQixHQUFHQyxrQkFBa0IsQ0FBQTtBQUMzQyxLQUFBO0FBRUEsSUFBQSxPQUFPeEIsS0FBSyxDQUFBO0FBQ2hCLEdBQUE7QUFFQXlELEVBQUFBLHNCQUFzQixDQUFDNUYsYUFBYSxFQUFFMUMsT0FBTyxFQUFFO0lBRTNDLElBQUl1SSxPQUFPLEdBQUcsSUFBSSxDQUFBO0lBQ2xCLElBQUlDLGFBQWEsR0FBRyxDQUFDLENBQUE7SUFDckIsSUFBSUMsZUFBZSxHQUFHLENBQUMsQ0FBQTtJQUN2QixJQUFJaEMsUUFBUSxHQUFHLElBQUksQ0FBQTtBQUVuQixJQUFBLEtBQUssSUFBSXJKLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3NGLGFBQWEsQ0FBQ3ZGLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7QUFDM0MsTUFBQSxJQUFJc0YsYUFBYSxDQUFDdEYsQ0FBQyxDQUFDLENBQUNzTCxPQUFPLEVBQUU7QUFHMUIsUUFBQSxNQUFNdkIsSUFBSSxHQUFHekUsYUFBYSxDQUFDdEYsQ0FBQyxDQUFDLENBQUMrSixJQUFJLENBQUE7QUFDbEMsUUFBQSxNQUFNd0IsUUFBUSxHQUFHeEIsSUFBSSxDQUFDQyxZQUFZLENBQUN3QixXQUFXLENBQUE7QUFDOUNKLFFBQUFBLGFBQWEsSUFBSUcsUUFBUSxDQUFBOztBQUd6QkYsUUFBQUEsZUFBZSxJQUFJdEIsSUFBSSxDQUFDUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNELE9BQU8sR0FBR1IsSUFBSSxDQUFDUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNpQixLQUFLLEdBQ2pFMUIsSUFBSSxDQUFDUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMvRixJQUFJLEtBQUtpSCxnQkFBZ0IsSUFBSTNCLElBQUksQ0FBQ1MsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDaUIsS0FBSyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFBOztRQUcxRixJQUFJLENBQUNOLE9BQU8sRUFBRTtBQUdWOUIsVUFBQUEsUUFBUSxHQUFHL0QsYUFBYSxDQUFDdEYsQ0FBQyxDQUFDLENBQUNxSixRQUFRLENBQUE7O1VBR3BDOEIsT0FBTyxHQUFHLEVBQUUsQ0FBQTtVQUNaLE1BQU1RLEtBQUssR0FBRzVCLElBQUksQ0FBQ0MsWUFBWSxDQUFDSyxNQUFNLENBQUN1QixRQUFRLENBQUE7QUFDL0MsVUFBQSxLQUFLLElBQUkvQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUc4QyxLQUFLLENBQUM1TCxNQUFNLEVBQUU4SSxDQUFDLEVBQUUsRUFBRTtBQUNuQyxZQUFBLE1BQU1nRCxRQUFRLEdBQUdGLEtBQUssQ0FBQzlDLENBQUMsQ0FBQyxDQUFDbEcsSUFBSSxDQUFBO1lBQzlCd0ksT0FBTyxDQUFDVSxRQUFRLENBQUMsR0FBRztBQUNoQkMsY0FBQUEsYUFBYSxFQUFFSCxLQUFLLENBQUM5QyxDQUFDLENBQUMsQ0FBQ2lELGFBQWE7QUFDckNDLGNBQUFBLFFBQVEsRUFBRUosS0FBSyxDQUFDOUMsQ0FBQyxDQUFDLENBQUNrRCxRQUFRO0FBQzNCQyxjQUFBQSxTQUFTLEVBQUVMLEtBQUssQ0FBQzlDLENBQUMsQ0FBQyxDQUFDbUQsU0FBUztBQUM3QlAsY0FBQUEsS0FBSyxFQUFFLENBQUE7YUFDVixDQUFBO0FBQ0wsV0FBQTs7QUFHQSxVQUFBLElBQUk3SSxPQUFPLEVBQUU7WUFDVHVJLE9BQU8sQ0FBQ2MscUJBQXFCLENBQUMsR0FBRztBQUM3QkgsY0FBQUEsYUFBYSxFQUFFLENBQUM7QUFDaEJDLGNBQUFBLFFBQVEsRUFBRUcsWUFBWTtBQUN0QkYsY0FBQUEsU0FBUyxFQUFFLEtBQUs7QUFDaEJQLGNBQUFBLEtBQUssRUFBRSxDQUFBO2FBQ1YsQ0FBQTtBQUNMLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7SUFFQSxPQUFPO0FBQ0hOLE1BQUFBLE9BQU8sRUFBRUEsT0FBTztBQUNoQkMsTUFBQUEsYUFBYSxFQUFFQSxhQUFhO0FBQzVCQyxNQUFBQSxlQUFlLEVBQUVBLGVBQWU7QUFDaENoQyxNQUFBQSxRQUFRLEVBQUVBLFFBQUFBO0tBQ2IsQ0FBQTtBQUNMLEdBQUE7O0FBY0F6QixFQUFBQSxNQUFNLENBQUN0QyxhQUFhLEVBQUUxQyxPQUFPLEVBQUVXLFlBQVksRUFBRTtJQUd6QyxNQUFNNEksSUFBSSxHQUFHQyxHQUFHLEVBQUUsQ0FBQTtBQUdsQixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNuSyxLQUFLLEVBQUU7TUFDYixNQUFNb0csU0FBUyxHQUFHLHFCQUFxQixHQUFHLElBQUksQ0FBQ3hHLE1BQU0sQ0FBQ3dLLFlBQVksRUFBRSxHQUFHLElBQUksQ0FBQTtNQUMzRSxJQUFJLENBQUNDLFdBQVcsR0FBR2pFLFNBQVMsR0FBRyx3QkFBd0IsR0FBR2tFLFlBQVksQ0FBQ0QsV0FBVyxDQUFBO0FBQ2xGLE1BQUEsSUFBSSxDQUFDRSxTQUFTLEdBQUdELFlBQVksQ0FBQ0UsY0FBYyxDQUFBO0FBQzVDLE1BQUEsSUFBSSxDQUFDQyxXQUFXLEdBQUdILFlBQVksQ0FBQ0ksZ0JBQWdCLENBQUE7QUFDaEQsTUFBQSxJQUFJLENBQUNDLGFBQWEsR0FBRyxFQUFFLENBQUE7TUFDdkIsSUFBSSxDQUFDM0ssS0FBSyxHQUFHLElBQUksQ0FBQTtBQUNyQixLQUFBO0lBRUEsSUFBSTRLLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFDakIsSUFBQSxJQUFJaEIsUUFBUSxDQUFBO0lBQ1osSUFBSTlCLElBQUksRUFBRXdCLFFBQVEsQ0FBQTtJQUNsQixJQUFJdEgsS0FBSyxHQUFHLElBQUksQ0FBQTs7SUFHaEIsTUFBTTZJLFNBQVMsR0FBRyxJQUFJLENBQUM1QixzQkFBc0IsQ0FBQzVGLGFBQWEsRUFBRTFDLE9BQU8sQ0FBQyxDQUFBOztJQUdyRSxJQUFJa0ssU0FBUyxDQUFDM0IsT0FBTyxFQUFFO0FBRW5CLE1BQUEsTUFBTUEsT0FBTyxHQUFHMkIsU0FBUyxDQUFDM0IsT0FBTyxDQUFBO0FBQ2pDLE1BQUEsSUFBSTlCLFFBQVEsR0FBR3lELFNBQVMsQ0FBQ3pELFFBQVEsQ0FBQTtBQUNqQyxNQUFBLE1BQU0rQixhQUFhLEdBQUcwQixTQUFTLENBQUMxQixhQUFhLENBQUE7QUFDN0MsTUFBQSxNQUFNQyxlQUFlLEdBQUd5QixTQUFTLENBQUN6QixlQUFlLENBQUE7TUFFakRwSCxLQUFLLEdBQUcsSUFBSThJLEtBQUssQ0FBQ3pILGFBQWEsRUFBRTFDLE9BQU8sRUFBRVcsWUFBWSxDQUFDLENBQUE7QUFDdkQsTUFBQSxJQUFJLENBQUNuQixVQUFVLENBQUNxQixJQUFJLENBQUNRLEtBQUssQ0FBQyxDQUFBO0FBRTNCLE1BQUEsSUFBSStJLFNBQVMsRUFBRUMsVUFBVSxFQUFFQyxTQUFTLENBQUE7TUFDcEMsSUFBSUMsY0FBYyxHQUFHLENBQUMsQ0FBQTtNQUN0QixJQUFJQyxXQUFXLEdBQUcsQ0FBQyxDQUFBO0FBQ25CLE1BQUEsSUFBSUMsU0FBUyxDQUFBO0FBQ2IsTUFBQSxNQUFNQyxHQUFHLEdBQUcsSUFBSXhNLElBQUksRUFBRSxDQUFBOztNQUd0QixNQUFNeU0sY0FBYyxHQUFHbkMsYUFBYSxJQUFJLE1BQU0sR0FBR29DLFdBQVcsR0FBR0MsV0FBVyxDQUFBO0FBQzFFLE1BQUEsTUFBTUMsT0FBTyxHQUFHLElBQUlILGNBQWMsQ0FBQ2xDLGVBQWUsQ0FBQyxDQUFBOztNQUduRCxLQUFLUSxRQUFRLElBQUlWLE9BQU8sRUFBRTtBQUN0QjBCLFFBQUFBLE1BQU0sR0FBRzFCLE9BQU8sQ0FBQ1UsUUFBUSxDQUFDLENBQUE7UUFDMUJnQixNQUFNLENBQUNjLGFBQWEsR0FBR0MsZUFBZSxDQUFDZixNQUFNLENBQUNkLFFBQVEsQ0FBQyxDQUFBO1FBQ3ZEYyxNQUFNLENBQUNnQixlQUFlLEdBQUdDLHVCQUF1QixDQUFDakIsTUFBTSxDQUFDZCxRQUFRLENBQUMsQ0FBQTtBQUNqRWMsUUFBQUEsTUFBTSxDQUFDa0IsTUFBTSxHQUFHLElBQUlsQixNQUFNLENBQUNjLGFBQWEsQ0FBQ3ZDLGFBQWEsR0FBR3lCLE1BQU0sQ0FBQ2YsYUFBYSxDQUFDLENBQUE7QUFDbEYsT0FBQTs7QUFHQSxNQUFBLEtBQUssSUFBSTlMLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3NGLGFBQWEsQ0FBQ3ZGLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7QUFDM0MsUUFBQSxJQUFJLENBQUNzRixhQUFhLENBQUN0RixDQUFDLENBQUMsQ0FBQ3NMLE9BQU8sRUFDekIsU0FBQTtBQUVKdkIsUUFBQUEsSUFBSSxHQUFHekUsYUFBYSxDQUFDdEYsQ0FBQyxDQUFDLENBQUMrSixJQUFJLENBQUE7QUFDNUJ3QixRQUFBQSxRQUFRLEdBQUd4QixJQUFJLENBQUNDLFlBQVksQ0FBQ3dCLFdBQVcsQ0FBQTs7UUFHeEMsSUFBSSxDQUFDNUksT0FBTyxFQUFFO1VBQ1Z5SyxTQUFTLEdBQUcvSCxhQUFhLENBQUN0RixDQUFDLENBQUMsQ0FBQ29CLElBQUksQ0FBQzRNLGlCQUFpQixFQUFFLENBQUE7QUFDekQsU0FBQTtRQUVBLEtBQUtuQyxRQUFRLElBQUlWLE9BQU8sRUFBRTtVQUN0QixJQUFJVSxRQUFRLEtBQUtJLHFCQUFxQixFQUFFO0FBQ3BDWSxZQUFBQSxNQUFNLEdBQUcxQixPQUFPLENBQUNVLFFBQVEsQ0FBQyxDQUFBOztZQUcxQixNQUFNb0MsUUFBUSxHQUFHLElBQUlwQixNQUFNLENBQUNjLGFBQWEsQ0FBQ2QsTUFBTSxDQUFDa0IsTUFBTSxDQUFDQSxNQUFNLEVBQUVsQixNQUFNLENBQUNnQixlQUFlLEdBQUdoQixNQUFNLENBQUNwQixLQUFLLENBQUMsQ0FBQTtBQUN0RyxZQUFBLE1BQU15QyxlQUFlLEdBQUduRSxJQUFJLENBQUNvRSxlQUFlLENBQUN0QyxRQUFRLEVBQUVvQyxRQUFRLENBQUMsR0FBR3BCLE1BQU0sQ0FBQ2YsYUFBYSxDQUFBO1lBQ3ZGZSxNQUFNLENBQUNwQixLQUFLLElBQUl5QyxlQUFlLENBQUE7O1lBRy9CLElBQUksQ0FBQ3RMLE9BQU8sSUFBSWlLLE1BQU0sQ0FBQ2YsYUFBYSxJQUFJLENBQUMsRUFBRTtjQUN2QyxJQUFJRCxRQUFRLEtBQUt1QyxpQkFBaUIsRUFBRTtBQUNoQyxnQkFBQSxLQUFLLElBQUl2RixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdxRixlQUFlLEVBQUVyRixDQUFDLElBQUlnRSxNQUFNLENBQUNmLGFBQWEsRUFBRTtrQkFDNUR3QixHQUFHLENBQUNlLEdBQUcsQ0FBQ0osUUFBUSxDQUFDcEYsQ0FBQyxDQUFDLEVBQUVvRixRQUFRLENBQUNwRixDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUVvRixRQUFRLENBQUNwRixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN0RHdFLGtCQUFBQSxTQUFTLENBQUNpQixjQUFjLENBQUNoQixHQUFHLEVBQUVBLEdBQUcsQ0FBQyxDQUFBO0FBQ2xDVyxrQkFBQUEsUUFBUSxDQUFDcEYsQ0FBQyxDQUFDLEdBQUd5RSxHQUFHLENBQUMzQyxDQUFDLENBQUE7a0JBQ25Cc0QsUUFBUSxDQUFDcEYsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHeUUsR0FBRyxDQUFDMUMsQ0FBQyxDQUFBO2tCQUN2QnFELFFBQVEsQ0FBQ3BGLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBR3lFLEdBQUcsQ0FBQ3pDLENBQUMsQ0FBQTtBQUMzQixpQkFBQTtlQUNILE1BQU0sSUFBSWdCLFFBQVEsS0FBSzBDLGVBQWUsSUFBSTFDLFFBQVEsS0FBSzJDLGdCQUFnQixFQUFFO0FBR3RFbkIsZ0JBQUFBLFNBQVMsQ0FBQ29CLFdBQVcsQ0FBQzlOLElBQUksQ0FBQyxDQUFBO2dCQUMzQkEsSUFBSSxDQUFDK04sU0FBUyxFQUFFLENBQUE7QUFFaEIsZ0JBQUEsS0FBSyxJQUFJN0YsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHcUYsZUFBZSxFQUFFckYsQ0FBQyxJQUFJZ0UsTUFBTSxDQUFDZixhQUFhLEVBQUU7a0JBQzVEd0IsR0FBRyxDQUFDZSxHQUFHLENBQUNKLFFBQVEsQ0FBQ3BGLENBQUMsQ0FBQyxFQUFFb0YsUUFBUSxDQUFDcEYsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFb0YsUUFBUSxDQUFDcEYsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdERsSSxrQkFBQUEsSUFBSSxDQUFDZ08sZUFBZSxDQUFDckIsR0FBRyxFQUFFQSxHQUFHLENBQUMsQ0FBQTtBQUM5Qlcsa0JBQUFBLFFBQVEsQ0FBQ3BGLENBQUMsQ0FBQyxHQUFHeUUsR0FBRyxDQUFDM0MsQ0FBQyxDQUFBO2tCQUNuQnNELFFBQVEsQ0FBQ3BGLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBR3lFLEdBQUcsQ0FBQzFDLENBQUMsQ0FBQTtrQkFDdkJxRCxRQUFRLENBQUNwRixDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUd5RSxHQUFHLENBQUN6QyxDQUFDLENBQUE7QUFDM0IsaUJBQUE7QUFDSixlQUFBO0FBQ0osYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBOztBQUdBLFFBQUEsSUFBSWpJLE9BQU8sRUFBRTtBQUNUaUssVUFBQUEsTUFBTSxHQUFHMUIsT0FBTyxDQUFDYyxxQkFBcUIsQ0FBQyxDQUFBO1VBQ3ZDLEtBQUssSUFBSXBELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzBDLFFBQVEsRUFBRTFDLENBQUMsRUFBRSxFQUM3QmdFLE1BQU0sQ0FBQ2tCLE1BQU0sQ0FBQ2xCLE1BQU0sQ0FBQ3BCLEtBQUssRUFBRSxDQUFDLEdBQUd6TCxDQUFDLENBQUE7QUFDekMsU0FBQTs7UUFHQSxJQUFJK0osSUFBSSxDQUFDUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNELE9BQU8sRUFBRTtVQUMzQnlDLFNBQVMsR0FBR2pELElBQUksQ0FBQ1MsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDb0UsSUFBSSxDQUFBO1VBQ2xDM0IsVUFBVSxHQUFHbEQsSUFBSSxDQUFDUyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNpQixLQUFLLENBQUE7O1VBR3BDLE1BQU1vRCxTQUFTLEdBQUc5RSxJQUFJLENBQUMrRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUNDLFNBQVMsRUFBRSxDQUFBO0FBQ2pEN0IsVUFBQUEsU0FBUyxHQUFHLElBQUk4QixzQkFBc0IsQ0FBQ0gsU0FBUyxDQUFDLENBQUM5RSxJQUFJLENBQUMrRSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUNHLE9BQU8sQ0FBQyxDQUFBO1NBQ2pGLE1BQU0sSUFBSWxGLElBQUksQ0FBQ1MsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDL0YsSUFBSSxLQUFLaUgsZ0JBQWdCLElBQUkzQixJQUFJLENBQUNTLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQ2lCLEtBQUssS0FBSyxDQUFDLEVBQUU7QUFFckZ1QixVQUFBQSxTQUFTLEdBQUcsQ0FBQyxDQUFBO0FBQ2JDLFVBQUFBLFVBQVUsR0FBRyxDQUFDLENBQUE7QUFDZEMsVUFBQUEsU0FBUyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNsQyxTQUFDLE1BQU07QUFDSEQsVUFBQUEsVUFBVSxHQUFHLENBQUMsQ0FBQTtBQUNkLFVBQUEsU0FBQTtBQUNKLFNBQUE7UUFFQSxLQUFLLElBQUlwRSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdvRSxVQUFVLEVBQUVwRSxDQUFDLEVBQUUsRUFBRTtBQUNqQzZFLFVBQUFBLE9BQU8sQ0FBQzdFLENBQUMsR0FBR3VFLFdBQVcsQ0FBQyxHQUFHRixTQUFTLENBQUNGLFNBQVMsR0FBR25FLENBQUMsQ0FBQyxHQUFHc0UsY0FBYyxDQUFBO0FBQ3hFLFNBQUE7QUFFQUMsUUFBQUEsV0FBVyxJQUFJSCxVQUFVLENBQUE7QUFDekJFLFFBQUFBLGNBQWMsSUFBSTVCLFFBQVEsQ0FBQTtBQUM5QixPQUFBOztBQUdBeEIsTUFBQUEsSUFBSSxHQUFHLElBQUltRixJQUFJLENBQUMsSUFBSSxDQUFDck4sTUFBTSxDQUFDLENBQUE7TUFDNUIsS0FBS2dLLFFBQVEsSUFBSVYsT0FBTyxFQUFFO0FBQ3RCMEIsUUFBQUEsTUFBTSxHQUFHMUIsT0FBTyxDQUFDVSxRQUFRLENBQUMsQ0FBQTtRQUMxQjlCLElBQUksQ0FBQ29GLGVBQWUsQ0FBQ3RELFFBQVEsRUFBRWdCLE1BQU0sQ0FBQ2tCLE1BQU0sRUFBRWxCLE1BQU0sQ0FBQ2YsYUFBYSxFQUFFOUksU0FBUyxFQUFFNkosTUFBTSxDQUFDZCxRQUFRLEVBQUVjLE1BQU0sQ0FBQ2IsU0FBUyxDQUFDLENBQUE7QUFDckgsT0FBQTtNQUVBLElBQUkwQixPQUFPLENBQUMzTixNQUFNLEdBQUcsQ0FBQyxFQUNsQmdLLElBQUksQ0FBQ3FGLFVBQVUsQ0FBQzFCLE9BQU8sQ0FBQyxDQUFBO0FBRTVCM0QsTUFBQUEsSUFBSSxDQUFDc0YsTUFBTSxDQUFDQyxtQkFBbUIsRUFBRSxLQUFLLENBQUMsQ0FBQTs7QUFHdkMsTUFBQSxJQUFJMU0sT0FBTyxFQUFFO0FBQ1R5RyxRQUFBQSxRQUFRLEdBQUdBLFFBQVEsQ0FBQ0QsS0FBSyxFQUFFLENBQUE7QUFDM0JDLFFBQUFBLFFBQVEsQ0FBQ2tHLE1BQU0sQ0FBQ2pELFdBQVcsR0FBRyxJQUFJLENBQUNBLFdBQVcsQ0FBQTtBQUM5Q2pELFFBQUFBLFFBQVEsQ0FBQ2tHLE1BQU0sQ0FBQy9DLFNBQVMsR0FBRyxJQUFJLENBQUNBLFNBQVMsQ0FBQTtBQUMxQ25ELFFBQUFBLFFBQVEsQ0FBQ2tHLE1BQU0sQ0FBQzdDLFdBQVcsR0FBRyxJQUFJLENBQUNBLFdBQVcsQ0FBQTtRQUM5Q3JELFFBQVEsQ0FBQ2dHLE1BQU0sRUFBRSxDQUFBO0FBQ3JCLE9BQUE7O0FBR0EsTUFBQSxNQUFNbEosWUFBWSxHQUFHLElBQUlxSixZQUFZLENBQUN6RixJQUFJLEVBQUVWLFFBQVEsRUFBRSxJQUFJLENBQUNySCxRQUFRLENBQUMsQ0FBQTtNQUNwRW1FLFlBQVksQ0FBQ3NKLFVBQVUsR0FBR3hMLEtBQUssQ0FBQ3lMLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDRCxVQUFVLENBQUE7TUFDL0R0SixZQUFZLENBQUN1RCxVQUFVLEdBQUd6RixLQUFLLENBQUN5TCxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQ2hHLFVBQVUsQ0FBQTtNQUMvRHZELFlBQVksQ0FBQ2hCLFFBQVEsR0FBR2xCLEtBQUssQ0FBQ3lMLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDdkssUUFBUSxDQUFBO01BQzNEZ0IsWUFBWSxDQUFDbUQsS0FBSyxHQUFHckYsS0FBSyxDQUFDeUwsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUNwRyxLQUFLLENBQUE7TUFDckRuRCxZQUFZLENBQUMwRCxnQkFBZ0IsR0FBRzVGLEtBQUssQ0FBQ3lMLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDN0YsZ0JBQWdCLENBQUE7TUFDM0UxRCxZQUFZLENBQUNxRCxXQUFXLEdBQUd2RixLQUFLLENBQUN5TCxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQ2xHLFdBQVcsQ0FBQTs7TUFHakVyRCxZQUFZLENBQUN3SixJQUFJLEdBQUcxTCxLQUFLLENBQUN5TCxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQ0MsSUFBSSxDQUFBO0FBQ25ELE1BQUEsTUFBTUMsVUFBVSxHQUFHLElBQUksQ0FBQzFOLFlBQVksQ0FBQ3FCLFlBQVksQ0FBQyxDQUFBO01BQ2xELElBQUlxTSxVQUFVLElBQUlBLFVBQVUsQ0FBQ25KLEdBQUcsRUFDNUJOLFlBQVksQ0FBQ3dKLElBQUksR0FBRyxLQUFLLENBQUE7QUFFN0IsTUFBQSxJQUFJL00sT0FBTyxFQUFFO1FBRVQsTUFBTWlOLEtBQUssR0FBRyxFQUFFLENBQUE7QUFDaEIsUUFBQSxLQUFLLElBQUk3UCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdpRSxLQUFLLENBQUN5TCxpQkFBaUIsQ0FBQzNQLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7VUFDckQ2UCxLQUFLLENBQUNwTSxJQUFJLENBQUNRLEtBQUssQ0FBQ3lMLGlCQUFpQixDQUFDMVAsQ0FBQyxDQUFDLENBQUNvQixJQUFJLENBQUMsQ0FBQTtBQUMvQyxTQUFBO0FBQ0ErRSxRQUFBQSxZQUFZLENBQUMySixZQUFZLEdBQUcsSUFBSUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDbE8sTUFBTSxFQUFFZ08sS0FBSyxFQUFFLElBQUksQ0FBQzdOLFFBQVEsQ0FBQyxDQUFBO0FBQ3hGLE9BQUE7O01BR0FtRSxZQUFZLENBQUM2SixXQUFXLEdBQUcsS0FBSyxDQUFBO01BRWhDN0osWUFBWSxDQUFDNEMsU0FBUyxHQUFHOUUsS0FBSyxDQUFDeUwsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLENBQUMzRyxTQUFTLENBQUE7TUFDN0Q1QyxZQUFZLENBQUNFLFlBQVksR0FBR3BDLEtBQUssQ0FBQ3lMLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDckosWUFBWSxDQUFBO01BQ25FRixZQUFZLENBQUNHLFdBQVcsR0FBR3JDLEtBQUssQ0FBQ3lMLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDcEosV0FBVyxDQUFBO0FBQ2pFSCxNQUFBQSxZQUFZLENBQUM4SixTQUFTLEdBQUdoUCxZQUFZLENBQUNnRCxLQUFLLENBQUN5TCxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtNQUNyRXZKLFlBQVksQ0FBQ3NKLFVBQVUsR0FBR3hMLEtBQUssQ0FBQ3lMLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFDRCxVQUFVLENBQUE7TUFFL0R4TCxLQUFLLENBQUNrQyxZQUFZLEdBQUdBLFlBQVksQ0FBQTtNQUNqQ2xDLEtBQUssQ0FBQ2lNLGlCQUFpQixFQUFFLENBQUE7QUFDN0IsS0FBQTtJQUdBLElBQUksQ0FBQzVOLE1BQU0sQ0FBQ0MsVUFBVSxJQUFJNkosR0FBRyxFQUFFLEdBQUdELElBQUksQ0FBQTtBQUd0QyxJQUFBLE9BQU9sSSxLQUFLLENBQUE7QUFDaEIsR0FBQTs7QUFPQWtNLEVBQUFBLFNBQVMsR0FBRzs7QUFHUixJQUFBLElBQUksSUFBSSxDQUFDOU4sWUFBWSxDQUFDdEMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM5QixNQUFBLElBQUksQ0FBQ3NILFFBQVEsQ0FBQyxJQUFJLENBQUNoRixZQUFZLENBQUMsQ0FBQTtBQUNwQyxLQUFBO0lBR0EsTUFBTThKLElBQUksR0FBR0MsR0FBRyxFQUFFLENBQUE7QUFHbEIsSUFBQSxLQUFLLElBQUlwTSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDb0MsVUFBVSxDQUFDckMsTUFBTSxFQUFFQyxDQUFDLEVBQUUsRUFBRTtNQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDb0MsVUFBVSxDQUFDcEMsQ0FBQyxDQUFDLENBQUM0QyxPQUFPLEVBQUUsU0FBQTtBQUNqQyxNQUFBLElBQUksQ0FBQ1IsVUFBVSxDQUFDcEMsQ0FBQyxDQUFDLENBQUNrUSxpQkFBaUIsRUFBRSxDQUFBO0FBQzFDLEtBQUE7SUFHQSxJQUFJLENBQUM1TixNQUFNLENBQUNFLG1CQUFtQixHQUFHNEosR0FBRyxFQUFFLEdBQUdELElBQUksQ0FBQTtBQUVsRCxHQUFBOztBQVVBL0MsRUFBQUEsS0FBSyxDQUFDbkYsS0FBSyxFQUFFbU0sbUJBQW1CLEVBQUU7QUFDOUIsSUFBQSxNQUFNQyxNQUFNLEdBQUcsSUFBSXRELEtBQUssQ0FBQ3FELG1CQUFtQixFQUFFbk0sS0FBSyxDQUFDckIsT0FBTyxFQUFFcUIsS0FBSyxDQUFDVixZQUFZLENBQUMsQ0FBQTtBQUNoRixJQUFBLElBQUksQ0FBQ25CLFVBQVUsQ0FBQ3FCLElBQUksQ0FBQzRNLE1BQU0sQ0FBQyxDQUFBO0lBRTVCLE1BQU1SLEtBQUssR0FBRyxFQUFFLENBQUE7QUFDaEIsSUFBQSxLQUFLLElBQUk3UCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdvUSxtQkFBbUIsQ0FBQ3JRLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7TUFDakQ2UCxLQUFLLENBQUNwTSxJQUFJLENBQUMyTSxtQkFBbUIsQ0FBQ3BRLENBQUMsQ0FBQyxDQUFDb0IsSUFBSSxDQUFDLENBQUE7QUFDM0MsS0FBQTtJQUVBaVAsTUFBTSxDQUFDbEssWUFBWSxHQUFHLElBQUlxSixZQUFZLENBQUN2TCxLQUFLLENBQUNrQyxZQUFZLENBQUM0RCxJQUFJLEVBQUU5RixLQUFLLENBQUNrQyxZQUFZLENBQUNrRCxRQUFRLEVBQUVwRixLQUFLLENBQUNrQyxZQUFZLENBQUMvRSxJQUFJLENBQUMsQ0FBQTtBQUNySGlQLElBQUFBLE1BQU0sQ0FBQ2xLLFlBQVksQ0FBQzZKLFdBQVcsR0FBRyxLQUFLLENBQUE7SUFDdkNLLE1BQU0sQ0FBQ2xLLFlBQVksQ0FBQ3VELFVBQVUsR0FBRzBHLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDMUcsVUFBVSxDQUFBO0lBQ2xFMkcsTUFBTSxDQUFDbEssWUFBWSxDQUFDaEIsUUFBUSxHQUFHaUwsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUNqTCxRQUFRLENBQUE7SUFDOURrTCxNQUFNLENBQUNsSyxZQUFZLENBQUN3SixJQUFJLEdBQUdTLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDVCxJQUFJLENBQUE7SUFDdERVLE1BQU0sQ0FBQ2xLLFlBQVksQ0FBQ21ELEtBQUssR0FBRzhHLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDOUcsS0FBSyxDQUFBO0lBQ3hEK0csTUFBTSxDQUFDbEssWUFBWSxDQUFDMEQsZ0JBQWdCLEdBQUd1RyxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQ3ZHLGdCQUFnQixDQUFBO0lBRTlFLElBQUk1RixLQUFLLENBQUNyQixPQUFPLEVBQUU7QUFDZnlOLE1BQUFBLE1BQU0sQ0FBQ2xLLFlBQVksQ0FBQzJKLFlBQVksR0FBRyxJQUFJQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUNsTyxNQUFNLEVBQUVnTyxLQUFLLEVBQUUsSUFBSSxDQUFDN04sUUFBUSxDQUFDLENBQUE7QUFDL0YsS0FBQTtJQUVBcU8sTUFBTSxDQUFDbEssWUFBWSxDQUFDc0osVUFBVSxHQUFHeEwsS0FBSyxDQUFDa0MsWUFBWSxDQUFDc0osVUFBVSxDQUFBO0FBQzlEWSxJQUFBQSxNQUFNLENBQUNsSyxZQUFZLENBQUNtSyxPQUFPLEdBQUdyTSxLQUFLLENBQUNrQyxZQUFZLENBQUNtSyxPQUFPLENBQUM3RixLQUFLLEVBQUUsQ0FBQTtJQUVoRTRGLE1BQU0sQ0FBQ2xLLFlBQVksQ0FBQ3NKLFVBQVUsR0FBR3hMLEtBQUssQ0FBQ2tDLFlBQVksQ0FBQ3NKLFVBQVUsQ0FBQTtBQUU5RCxJQUFBLE9BQU9ZLE1BQU0sQ0FBQTtBQUNqQixHQUFBOztFQVFBN00sWUFBWSxDQUFDUyxLQUFLLEVBQUU7QUFDaEJBLElBQUFBLEtBQUssQ0FBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUNWLEtBQUssRUFBRSxJQUFJLENBQUNHLFlBQVksQ0FBQytCLEtBQUssQ0FBQ1YsWUFBWSxDQUFDLENBQUNSLE1BQU0sQ0FBQyxDQUFBO0FBQzNFLEdBQUE7QUFDSjs7OzsifQ==
