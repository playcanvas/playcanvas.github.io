/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, SEMANTIC_BLENDINDICES, TYPE_FLOAT32, typedArrayTypes, typedArrayTypesByteSize, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, typedArrayIndexFormats, PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';
import { SPRITE_RENDERMODE_SIMPLE } from '../constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
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
    // compare A -> B
    if (params1.hasOwnProperty(param) && !paramsIdentical(params1[param], params2[param])) return false;
  }
  for (const param in params2) {
    // compare B -> A
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
const _triFanIndices = [0, 1, 3, 2, 3, 1];
const _triStripIndices = [0, 1, 3, 0, 3, 2];
const mat3 = new Mat3();
function getScaleSign(mi) {
  return mi.node.worldTransform.scaleSign;
}

/**
 * Glues many mesh instances into a single one for better performance.
 */
class BatchManager {
  /**
   * Create a new BatchManager instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
   * graphics device used by the batch manager.
   * @param {import('../../framework/entity.js').Entity} root - The entity under which batched
   * models are added.
   * @param {import('../scene.js').Scene} scene - The scene that the batch manager affects.
   */
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

  /**
   * Adds new global batch group.
   *
   * @param {string} name - Custom name.
   * @param {boolean} dynamic - Is this batch group dynamic? Will these objects move/rotate/scale
   * after being batched?
   * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched
   * objects.
   * {@link BatchManager#prepare} will split objects into local groups based on this size.
   * @param {number} [id] - Optional custom unique id for the group (will be generated
   * automatically otherwise).
   * @param {number[]} [layers] - Optional layer ID array. Default is [{@link LAYERID_WORLD}].
   * The whole batch group will belong to these layers. Layers of source models will be ignored.
   * @returns {BatchGroup} Group object.
   */
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

  /**
   * Remove global batch group by id. Note, this traverses the entire scene graph and clears the
   * batch group id from all components.
   *
   * @param {number} id - Batch Group ID.
   */
  removeGroup(id) {
    if (!this._batchGroups[id]) {
      Debug.error(`Batch group with id ${id} doesn't exist.`);
      return;
    }

    // delete batches with matching id
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

  /**
   * Mark a specific batch group as dirty. Dirty groups are re-batched before the next frame is
   * rendered. Note, re-batching a group is a potentially expensive operation.
   *
   * @param {number} id - Batch Group ID to mark as dirty.
   */
  markGroupDirty(id) {
    if (this._dirtyGroups.indexOf(id) < 0) {
      this._dirtyGroups.push(id);
    }
  }

  /**
   * Retrieves a {@link BatchGroup} object with a corresponding name, if it exists, or null
   * otherwise.
   *
   * @param {string} name - Name.
   * @returns {BatchGroup|null} The batch group matching the name or null if not found.
   */
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

  /**
   * Return a list of all {@link Batch} objects that belong to the Batch Group supplied.
   *
   * @param {number} batchGroupId - The id of the batch group.
   * @returns {Batch[]} A list of batches that are used to render the batch group.
   * @private
   */
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

  // traverse full hierarchy and clear the batch group id from all model, element and sprite components
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
        // static mesh instances can be in both drawCall array with _staticSource linking to original
        // and in the original array as well, if no triangle splitting was done
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
        // static mesh instances can be in both drawCall array with _staticSource linking to original
        // and in the original array as well, if no triangle splitting was done
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

  // traverse scene hierarchy down from `node` and collect all components that are marked
  // with a batch group id. Remove from layers any models that these components contains.
  // Fill the `groupMeshInstances` with all the mesh instances to be included in the batch groups,
  // indexed by batch group id.
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

  /**
   * Destroys all batches and creates new based on scene models. Hides original models. Called by
   * engine automatically on app start, and if batchGroupIds on models are changed.
   *
   * @param {number[]} [groupIds] - Optional array of batch group IDs to update. Otherwise all
   * groups are updated.
   */
  generate(groupIds) {
    const groupMeshInstances = {};
    if (!groupIds) {
      // Full scene
      groupIds = Object.keys(this._batchGroups);
    }

    // delete old batches with matching batchGroupId
    const newBatchList = [];
    for (let i = 0; i < this._batchList.length; i++) {
      if (groupIds.indexOf(this._batchList[i].batchGroupId) < 0) {
        newBatchList.push(this._batchList[i]);
        continue;
      }
      this.destroyBatch(this._batchList[i]);
    }
    this._batchList = newBatchList;

    // collect
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

  /**
   * Takes a list of mesh instances to be batched and sorts them into lists one for each draw
   * call. The input list will be split, if:
   *
   * - Mesh instances use different materials.
   * - Mesh instances have different parameters (e.g. lightmaps or static lights).
   * - Mesh instances have different shader defines (shadow receiving, being aligned to screen
   * space, etc).
   * - Too many vertices for a single batch (65535 is maximum).
   * - Too many instances for a single batch (hardware-dependent, expect 128 on low-end and 1024
   * on high-end).
   * - Bounding box of a batch is larger than maxAabbSize in any dimension.
   *
   * @param {MeshInstance[]} meshInstances - Input list of mesh instances
   * @param {boolean} dynamic - Are we preparing for a dynamic batch? Instance count will matter
   * then (otherwise not).
   * @param {number} maxAabbSize - Maximum size of any dimension of a bounding box around batched
   * objects.
   * @param {boolean} translucent - Are we batching UI elements or sprites
   * This is useful to keep a balance between the number of draw calls and the number of drawn
   * triangles, because smaller batches can be hidden when not visible in camera.
   * @returns {MeshInstance[][]} An array of arrays of mesh instances, each valid to pass to
   * {@link BatchManager#create}.
   */
  prepare(meshInstances, dynamic, maxAabbSize = Number.POSITIVE_INFINITY, translucent) {
    if (meshInstances.length === 0) return [];
    const halfMaxAabbSize = maxAabbSize * 0.5;
    const maxInstanceCount = this.device.supportsBoneTextures ? 1024 : this.device.boneLimit;

    // maximum number of vertices that can be used in batch depends on 32bit index buffer support (do this for non-indexed as well,
    // as in some cases (UI elements) non-indexed geometry gets batched into indexed)
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

        // Split by instance number
        if (dynamic && lists[j].length >= maxInstanceCount) {
          meshInstancesLeftB = meshInstancesLeftB.concat(meshInstancesLeftA.slice(i));
          break;
        }

        // Split by material, layer (legacy), vertex format & index compatibility, shader defines, static source, vert count, overlapping UI
        if (material !== mi.material || layer !== mi.layer || vertexFormatBatchingHash !== mi.mesh.vertexBuffer.format.batchingHash || indexed !== mi.mesh.primitive[0].indexed || defs !== mi._shaderDefs || vertCount + mi.mesh.vertexBuffer.getNumVertices() > maxNumVertices) {
          skipMesh(mi);
          continue;
        }
        // Split by AABB
        testAabb.copy(aabb);
        testAabb.add(mi.aabb);
        if (testAabb.halfExtents.x > halfMaxAabbSize || testAabb.halfExtents.y > halfMaxAabbSize || testAabb.halfExtents.z > halfMaxAabbSize) {
          skipMesh(mi);
          continue;
        }
        // Split stencil mask (UI elements), both front and back expected to be the same
        if (stencil) {
          if (!(sf = mi.stencilFront) || stencil.func !== sf.func || stencil.zpass !== sf.zpass) {
            skipMesh(mi);
            continue;
          }
        }
        // Split by negative scale
        if (scaleSign !== getScaleSign(mi)) {
          skipMesh(mi);
          continue;
        }

        // Split by parameters
        if (!equalParamSets(params, mi.parameters)) {
          skipMesh(mi);
          continue;
        }
        // Split by static light list
        const staticLights = mi._staticLightList;
        if (lightList && staticLights) {
          if (!equalLightLists(lightList, staticLights)) {
            skipMesh(mi);
            continue;
          }
        } else if (lightList || staticLights) {
          // Split by static/non static
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
        // vertex counts
        const mesh = meshInstances[i].mesh;
        const numVerts = mesh.vertexBuffer.numVertices;
        batchNumVerts += numVerts;

        // index count
        if (mesh.primitive[0].indexed) {
          batchNumIndices += mesh.primitive[0].count;
        } else {
          // special case of fan / strip non-indexed primitive used by UI
          const primitiveType = mesh.primitive[0].type;
          if (primitiveType === PRIMITIVE_TRIFAN || primitiveType === PRIMITIVE_TRISTRIP) {
            if (mesh.primitive[0].count === 4) batchNumIndices += 6;
          }
        }

        // if first mesh
        if (!streams) {
          // material
          material = meshInstances[i].material;

          // collect used vertex buffer semantic information from first mesh (they all match)
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

          // for dynamic meshes we need bone indices
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

  /**
   * Takes a mesh instance list that has been prepared by {@link BatchManager#prepare}, and
   * returns a {@link Batch} object. This method assumes that all mesh instances provided can be
   * rendered in a single draw call.
   *
   * @param {MeshInstance[]} meshInstances - Input list of mesh instances.
   * @param {boolean} dynamic - Is it a static or dynamic batch? Will objects be transformed
   * after batching?
   * @param {number} [batchGroupId] - Link this batch to a specific batch group. This is done
   * automatically with default batches.
   * @returns {Batch} The resulting batch object.
   */
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

    // find out vertex streams and counts
    const batchData = this.collectBatchedMeshData(meshInstances, dynamic);

    // if anything to batch
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

      // allocate indices
      const indexArrayType = batchNumVerts <= 0xffff ? Uint16Array : Uint32Array;
      const indices = new indexArrayType(batchNumIndices);

      // allocate typed arrays to store final vertex stream data
      for (semantic in streams) {
        stream = streams[semantic];
        stream.typeArrayType = typedArrayTypes[stream.dataType];
        stream.elementByteSize = typedArrayTypesByteSize[stream.dataType];
        stream.buffer = new stream.typeArrayType(batchNumVerts * stream.numComponents);
      }

      // build vertex and index data for final mesh
      for (let i = 0; i < meshInstances.length; i++) {
        if (!meshInstances[i].visible) continue;
        mesh = meshInstances[i].mesh;
        numVerts = mesh.vertexBuffer.numVertices;

        // matrix to transform vertices to world space for static batching
        if (!dynamic) {
          transform = meshInstances[i].node.getWorldTransform();
        }
        for (semantic in streams) {
          if (semantic !== SEMANTIC_BLENDINDICES) {
            stream = streams[semantic];

            // get vertex stream to typed view subarray
            const subarray = new stream.typeArrayType(stream.buffer.buffer, stream.elementByteSize * stream.count);
            const totalComponents = mesh.getVertexStream(semantic, subarray) * stream.numComponents;
            stream.count += totalComponents;

            // transform position, normal and tangent to world space
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
                // handle non-uniform scale by using transposed inverse matrix to transform vectors
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

        // bone index is mesh index
        if (dynamic) {
          stream = streams[SEMANTIC_BLENDINDICES];
          for (let j = 0; j < numVerts; j++) stream.buffer[stream.count++] = i;
        }

        // index buffer
        if (mesh.primitive[0].indexed) {
          indexBase = mesh.primitive[0].base;
          numIndices = mesh.primitive[0].count;

          // source index buffer data mapped to its format
          const srcFormat = mesh.indexBuffer[0].getFormat();
          indexData = new typedArrayIndexFormats[srcFormat](mesh.indexBuffer[0].storage);
        } else {
          // non-indexed

          const primitiveType = mesh.primitive[0].type;
          if (primitiveType === PRIMITIVE_TRIFAN || primitiveType === PRIMITIVE_TRISTRIP) {
            if (mesh.primitive[0].count === 4) {
              indexBase = 0;
              numIndices = 6;
              indexData = primitiveType === PRIMITIVE_TRIFAN ? _triFanIndices : _triStripIndices;
            } else {
              numIndices = 0;
              continue;
            }
          }
        }
        for (let j = 0; j < numIndices; j++) {
          indices[j + indexOffset] = indexData[indexBase + j] + verticesOffset;
        }
        indexOffset += numIndices;
        verticesOffset += numVerts;
      }

      // Create mesh
      mesh = new Mesh(this.device);
      for (semantic in streams) {
        stream = streams[semantic];
        mesh.setVertexStream(semantic, stream.buffer, stream.numComponents, undefined, stream.dataType, stream.normalize);
      }
      if (indices.length > 0) mesh.setIndices(indices);
      mesh.update(PRIMITIVE_TRIANGLES, false);

      // Patch the material
      if (dynamic) {
        material = material.clone();
        material.chunks.transformVS = this.transformVS;
        material.chunks.skinTexVS = this.skinTexVS;
        material.chunks.skinConstVS = this.skinConstVS;
        material.update();
      }

      // Create meshInstance
      const meshInstance = new MeshInstance(mesh, material, this.rootNode);
      meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
      meshInstance.parameters = batch.origMeshInstances[0].parameters;
      meshInstance.isStatic = batch.origMeshInstances[0].isStatic;
      meshInstance.layer = batch.origMeshInstances[0].layer;
      meshInstance._staticLightList = batch.origMeshInstances[0]._staticLightList;
      meshInstance._shaderDefs = batch.origMeshInstances[0]._shaderDefs;

      // meshInstance culling - don't cull UI elements, as they use custom culling Component.isVisibleForCamera
      meshInstance.cull = batch.origMeshInstances[0].cull;
      const batchGroup = this._batchGroups[batchGroupId];
      if (batchGroup && batchGroup._ui) meshInstance.cull = false;
      if (dynamic) {
        // Create skinInstance
        const nodes = [];
        for (let i = 0; i < batch.origMeshInstances.length; i++) {
          nodes.push(batch.origMeshInstances[i].node);
        }
        meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
      }

      // disable aabb update, gets updated manually by batcher
      meshInstance._updateAabb = false;
      meshInstance.drawOrder = batch.origMeshInstances[0].drawOrder;
      meshInstance.stencilFront = batch.origMeshInstances[0].stencilFront;
      meshInstance.stencilBack = batch.origMeshInstances[0].stencilBack;
      meshInstance.flipFacesFactor = getScaleSign(batch.origMeshInstances[0]);
      meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
      batch.meshInstance = meshInstance;
      batch.updateBoundingBox();
    }
    this._stats.createTime += now() - time;
    return batch;
  }

  /**
   * Updates bounding boxes for all dynamic batches. Called automatically.
   *
   * @ignore
   */
  updateAll() {
    // TODO: only call when needed. Applies to skinning matrices as well

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

  /**
   * Clones a batch. This method doesn't rebuild batch geometry, but only creates a new model and
   * batch objects, linked to different source mesh instances.
   *
   * @param {Batch} batch - A batch object.
   * @param {MeshInstance[]} clonedMeshInstances - New mesh instances.
   * @returns {Batch} New batch object.
   */
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

  /**
   * Removes the batch model from all layers and destroys it.
   *
   * @param {Batch} batch - A batch object.
   * @private
   */
  destroyBatch(batch) {
    batch.destroy(this.scene, this._batchGroups[batch.batchGroupId].layers);
  }
}

export { BatchManager };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2JhdGNoaW5nL2JhdGNoLW1hbmFnZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIFBSSU1JVElWRV9UUklBTkdMRVMsIFBSSU1JVElWRV9UUklGQU4sIFBSSU1JVElWRV9UUklTVFJJUCxcbiAgICBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19UQU5HRU5ULCBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgVFlQRV9GTE9BVDMyLFxuICAgIHR5cGVkQXJyYXlJbmRleEZvcm1hdHMsIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemVcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi9tZXNoLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IEJhdGNoIH0gZnJvbSAnLi9iYXRjaC5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi9iYXRjaC1ncm91cC5qcyc7XG5pbXBvcnQgeyBTa2luQmF0Y2hJbnN0YW5jZSB9IGZyb20gJy4vc2tpbi1iYXRjaC1pbnN0YW5jZS5qcyc7XG5cbmZ1bmN0aW9uIHBhcmFtc0lkZW50aWNhbChhLCBiKSB7XG4gICAgaWYgKGEgJiYgIWIpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIWEgJiYgYikgcmV0dXJuIGZhbHNlO1xuICAgIGEgPSBhLmRhdGE7XG4gICAgYiA9IGIuZGF0YTtcbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gICAgaWYgKGEgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgJiYgYiBpbnN0YW5jZW9mIEZsb2F0MzJBcnJheSkge1xuICAgICAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBlcXVhbFBhcmFtU2V0cyhwYXJhbXMxLCBwYXJhbXMyKSB7XG4gICAgZm9yIChjb25zdCBwYXJhbSBpbiBwYXJhbXMxKSB7IC8vIGNvbXBhcmUgQSAtPiBCXG4gICAgICAgIGlmIChwYXJhbXMxLmhhc093blByb3BlcnR5KHBhcmFtKSAmJiAhcGFyYW1zSWRlbnRpY2FsKHBhcmFtczFbcGFyYW1dLCBwYXJhbXMyW3BhcmFtXSkpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyYW0gaW4gcGFyYW1zMikgeyAvLyBjb21wYXJlIEIgLT4gQVxuICAgICAgICBpZiAocGFyYW1zMi5oYXNPd25Qcm9wZXJ0eShwYXJhbSkgJiYgIXBhcmFtc0lkZW50aWNhbChwYXJhbXMyW3BhcmFtXSwgcGFyYW1zMVtwYXJhbV0pKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZXF1YWxMaWdodExpc3RzKGxpZ2h0TGlzdDEsIGxpZ2h0TGlzdDIpIHtcbiAgICBmb3IgKGxldCBrID0gMDsgayA8IGxpZ2h0TGlzdDEubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgaWYgKGxpZ2h0TGlzdDIuaW5kZXhPZihsaWdodExpc3QxW2tdKSA8IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAobGV0IGsgPSAwOyBrIDwgbGlnaHRMaXN0Mi5sZW5ndGg7IGsrKykge1xuICAgICAgICBpZiAobGlnaHRMaXN0MS5pbmRleE9mKGxpZ2h0TGlzdDJba10pIDwgMClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbmNvbnN0IF90cmlGYW5JbmRpY2VzID0gWzAsIDEsIDMsIDIsIDMsIDFdO1xuY29uc3QgX3RyaVN0cmlwSW5kaWNlcyA9IFswLCAxLCAzLCAwLCAzLCAyXTtcblxuY29uc3QgbWF0MyA9IG5ldyBNYXQzKCk7XG5cbmZ1bmN0aW9uIGdldFNjYWxlU2lnbihtaSkge1xuICAgIHJldHVybiBtaS5ub2RlLndvcmxkVHJhbnNmb3JtLnNjYWxlU2lnbjtcbn1cblxuLyoqXG4gKiBHbHVlcyBtYW55IG1lc2ggaW5zdGFuY2VzIGludG8gYSBzaW5nbGUgb25lIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2UuXG4gKi9cbmNsYXNzIEJhdGNoTWFuYWdlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEJhdGNoTWFuYWdlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIGJhdGNoIG1hbmFnZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9lbnRpdHkuanMnKS5FbnRpdHl9IHJvb3QgLSBUaGUgZW50aXR5IHVuZGVyIHdoaWNoIGJhdGNoZWRcbiAgICAgKiBtb2RlbHMgYXJlIGFkZGVkLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zY2VuZS5qcycpLlNjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZSB0aGF0IHRoZSBiYXRjaCBtYW5hZ2VyIGFmZmVjdHMuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCByb290LCBzY2VuZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5yb290Tm9kZSA9IHJvb3Q7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcbiAgICAgICAgdGhpcy5faW5pdCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBzID0ge307XG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBDb3VudGVyID0gMDtcbiAgICAgICAgdGhpcy5fYmF0Y2hMaXN0ID0gW107XG4gICAgICAgIHRoaXMuX2RpcnR5R3JvdXBzID0gW107XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9zdGF0cyA9IHtcbiAgICAgICAgICAgIGNyZWF0ZVRpbWU6IDAsXG4gICAgICAgICAgICB1cGRhdGVMYXN0RnJhbWVUaW1lOiAwXG4gICAgICAgIH07XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5yb290Tm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBudWxsO1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwcyA9IHt9O1xuICAgICAgICB0aGlzLl9iYXRjaExpc3QgPSBbXTtcbiAgICAgICAgdGhpcy5fZGlydHlHcm91cHMgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIG5ldyBnbG9iYWwgYmF0Y2ggZ3JvdXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIEN1c3RvbSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZHluYW1pYyAtIElzIHRoaXMgYmF0Y2ggZ3JvdXAgZHluYW1pYz8gV2lsbCB0aGVzZSBvYmplY3RzIG1vdmUvcm90YXRlL3NjYWxlXG4gICAgICogYWZ0ZXIgYmVpbmcgYmF0Y2hlZD9cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4QWFiYlNpemUgLSBNYXhpbXVtIHNpemUgb2YgYW55IGRpbWVuc2lvbiBvZiBhIGJvdW5kaW5nIGJveCBhcm91bmQgYmF0Y2hlZFxuICAgICAqIG9iamVjdHMuXG4gICAgICoge0BsaW5rIEJhdGNoTWFuYWdlciNwcmVwYXJlfSB3aWxsIHNwbGl0IG9iamVjdHMgaW50byBsb2NhbCBncm91cHMgYmFzZWQgb24gdGhpcyBzaXplLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaWRdIC0gT3B0aW9uYWwgY3VzdG9tIHVuaXF1ZSBpZCBmb3IgdGhlIGdyb3VwICh3aWxsIGJlIGdlbmVyYXRlZFxuICAgICAqIGF1dG9tYXRpY2FsbHkgb3RoZXJ3aXNlKS5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBbbGF5ZXJzXSAtIE9wdGlvbmFsIGxheWVyIElEIGFycmF5LiBEZWZhdWx0IGlzIFt7QGxpbmsgTEFZRVJJRF9XT1JMRH1dLlxuICAgICAqIFRoZSB3aG9sZSBiYXRjaCBncm91cCB3aWxsIGJlbG9uZyB0byB0aGVzZSBsYXllcnMuIExheWVycyBvZiBzb3VyY2UgbW9kZWxzIHdpbGwgYmUgaWdub3JlZC5cbiAgICAgKiBAcmV0dXJucyB7QmF0Y2hHcm91cH0gR3JvdXAgb2JqZWN0LlxuICAgICAqL1xuICAgIGFkZEdyb3VwKG5hbWUsIGR5bmFtaWMsIG1heEFhYmJTaXplLCBpZCwgbGF5ZXJzKSB7XG4gICAgICAgIGlmIChpZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZCA9IHRoaXMuX2JhdGNoR3JvdXBDb3VudGVyO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hHcm91cENvdW50ZXIrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3Vwc1tpZF0pIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKGBCYXRjaCBncm91cCB3aXRoIGlkICR7aWR9IGFscmVhZHkgZXhpc3RzLmApO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gbmV3IEJhdGNoR3JvdXAoaWQsIG5hbWUsIGR5bmFtaWMsIG1heEFhYmJTaXplLCBsYXllcnMpO1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3Vwc1tpZF0gPSBncm91cDtcblxuICAgICAgICByZXR1cm4gZ3JvdXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGdsb2JhbCBiYXRjaCBncm91cCBieSBpZC4gTm90ZSwgdGhpcyB0cmF2ZXJzZXMgdGhlIGVudGlyZSBzY2VuZSBncmFwaCBhbmQgY2xlYXJzIHRoZVxuICAgICAqIGJhdGNoIGdyb3VwIGlkIGZyb20gYWxsIGNvbXBvbmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBCYXRjaCBHcm91cCBJRC5cbiAgICAgKi9cbiAgICByZW1vdmVHcm91cChpZCkge1xuICAgICAgICBpZiAoIXRoaXMuX2JhdGNoR3JvdXBzW2lkXSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYEJhdGNoIGdyb3VwIHdpdGggaWQgJHtpZH0gZG9lc24ndCBleGlzdC5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBiYXRjaGVzIHdpdGggbWF0Y2hpbmcgaWRcbiAgICAgICAgY29uc3QgbmV3QmF0Y2hMaXN0ID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fYmF0Y2hMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fYmF0Y2hMaXN0W2ldLmJhdGNoR3JvdXBJZCA9PT0gaWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3lCYXRjaCh0aGlzLl9iYXRjaExpc3RbaV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXdCYXRjaExpc3QucHVzaCh0aGlzLl9iYXRjaExpc3RbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2JhdGNoTGlzdCA9IG5ld0JhdGNoTGlzdDtcbiAgICAgICAgdGhpcy5fcmVtb3ZlTW9kZWxzRnJvbUJhdGNoR3JvdXAodGhpcy5yb290Tm9kZSwgaWQpO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9iYXRjaEdyb3Vwc1tpZF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFyayBhIHNwZWNpZmljIGJhdGNoIGdyb3VwIGFzIGRpcnR5LiBEaXJ0eSBncm91cHMgYXJlIHJlLWJhdGNoZWQgYmVmb3JlIHRoZSBuZXh0IGZyYW1lIGlzXG4gICAgICogcmVuZGVyZWQuIE5vdGUsIHJlLWJhdGNoaW5nIGEgZ3JvdXAgaXMgYSBwb3RlbnRpYWxseSBleHBlbnNpdmUgb3BlcmF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlkIC0gQmF0Y2ggR3JvdXAgSUQgdG8gbWFyayBhcyBkaXJ0eS5cbiAgICAgKi9cbiAgICBtYXJrR3JvdXBEaXJ0eShpZCkge1xuICAgICAgICBpZiAodGhpcy5fZGlydHlHcm91cHMuaW5kZXhPZihpZCkgPCAwKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUdyb3Vwcy5wdXNoKGlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIHtAbGluayBCYXRjaEdyb3VwfSBvYmplY3Qgd2l0aCBhIGNvcnJlc3BvbmRpbmcgbmFtZSwgaWYgaXQgZXhpc3RzLCBvciBudWxsXG4gICAgICogb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lLlxuICAgICAqIEByZXR1cm5zIHtCYXRjaEdyb3VwfG51bGx9IFRoZSBiYXRjaCBncm91cCBtYXRjaGluZyB0aGUgbmFtZSBvciBudWxsIGlmIG5vdCBmb3VuZC5cbiAgICAgKi9cbiAgICBnZXRHcm91cEJ5TmFtZShuYW1lKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwcyA9IHRoaXMuX2JhdGNoR3JvdXBzO1xuICAgICAgICBmb3IgKGNvbnN0IGdyb3VwIGluIGdyb3Vwcykge1xuICAgICAgICAgICAgaWYgKCFncm91cHMuaGFzT3duUHJvcGVydHkoZ3JvdXApKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChncm91cHNbZ3JvdXBdLm5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ3JvdXBzW2dyb3VwXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYSBsaXN0IG9mIGFsbCB7QGxpbmsgQmF0Y2h9IG9iamVjdHMgdGhhdCBiZWxvbmcgdG8gdGhlIEJhdGNoIEdyb3VwIHN1cHBsaWVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJhdGNoR3JvdXBJZCAtIFRoZSBpZCBvZiB0aGUgYmF0Y2ggZ3JvdXAuXG4gICAgICogQHJldHVybnMge0JhdGNoW119IEEgbGlzdCBvZiBiYXRjaGVzIHRoYXQgYXJlIHVzZWQgdG8gcmVuZGVyIHRoZSBiYXRjaCBncm91cC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGdldEJhdGNoZXMoYmF0Y2hHcm91cElkKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fYmF0Y2hMaXN0Lmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYmF0Y2ggPSB0aGlzLl9iYXRjaExpc3RbaV07XG4gICAgICAgICAgICBpZiAoYmF0Y2guYmF0Y2hHcm91cElkID09PSBiYXRjaEdyb3VwSWQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goYmF0Y2gpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLy8gdHJhdmVyc2UgZnVsbCBoaWVyYXJjaHkgYW5kIGNsZWFyIHRoZSBiYXRjaCBncm91cCBpZCBmcm9tIGFsbCBtb2RlbCwgZWxlbWVudCBhbmQgc3ByaXRlIGNvbXBvbmVudHNcbiAgICBfcmVtb3ZlTW9kZWxzRnJvbUJhdGNoR3JvdXAobm9kZSwgaWQpIHtcbiAgICAgICAgaWYgKCFub2RlLmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBpZiAobm9kZS5tb2RlbCAmJiBub2RlLm1vZGVsLmJhdGNoR3JvdXBJZCA9PT0gaWQpIHtcbiAgICAgICAgICAgIG5vZGUubW9kZWwuYmF0Y2hHcm91cElkID0gLTE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUucmVuZGVyICYmIG5vZGUucmVuZGVyLmJhdGNoR3JvdXBJZCA9PT0gaWQpIHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyLmJhdGNoR3JvdXBJZCA9IC0xO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmVsZW1lbnQgJiYgbm9kZS5lbGVtZW50LmJhdGNoR3JvdXBJZCA9PT0gaWQpIHtcbiAgICAgICAgICAgIG5vZGUuZWxlbWVudC5iYXRjaEdyb3VwSWQgPSAtMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5zcHJpdGUgJiYgbm9kZS5zcHJpdGUuYmF0Y2hHcm91cElkID09PSBpZCkge1xuICAgICAgICAgICAgbm9kZS5zcHJpdGUuYmF0Y2hHcm91cElkID0gLTE7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVNb2RlbHNGcm9tQmF0Y2hHcm91cChub2RlLl9jaGlsZHJlbltpXSwgaWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5zZXJ0KHR5cGUsIGdyb3VwSWQsIG5vZGUpIHtcbiAgICAgICAgY29uc3QgZ3JvdXAgPSB0aGlzLl9iYXRjaEdyb3Vwc1tncm91cElkXTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGdyb3VwLCBgSW52YWxpZCBiYXRjaCAke2dyb3VwSWR9IGluc2VydGlvbmApO1xuXG4gICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgaWYgKGdyb3VwLl9vYmpbdHlwZV0uaW5kZXhPZihub2RlKSA8IDApIHtcbiAgICAgICAgICAgICAgICBncm91cC5fb2JqW3R5cGVdLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJrR3JvdXBEaXJ0eShncm91cElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZSh0eXBlLCBncm91cElkLCBub2RlKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwID0gdGhpcy5fYmF0Y2hHcm91cHNbZ3JvdXBJZF07XG4gICAgICAgIERlYnVnLmFzc2VydChncm91cCwgYEludmFsaWQgYmF0Y2ggJHtncm91cElkfSBpbnNlcnRpb25gKTtcblxuICAgICAgICBpZiAoZ3JvdXApIHtcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IGdyb3VwLl9vYmpbdHlwZV0uaW5kZXhPZihub2RlKTtcbiAgICAgICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgICAgICAgIGdyb3VwLl9vYmpbdHlwZV0uc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJrR3JvdXBEaXJ0eShncm91cElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9leHRyYWN0UmVuZGVyKG5vZGUsIGFyciwgZ3JvdXAsIGdyb3VwTWVzaEluc3RhbmNlcykge1xuICAgICAgICBpZiAobm9kZS5yZW5kZXIpIHtcblxuICAgICAgICAgICAgaWYgKG5vZGUucmVuZGVyLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgLy8gc3RhdGljIG1lc2ggaW5zdGFuY2VzIGNhbiBiZSBpbiBib3RoIGRyYXdDYWxsIGFycmF5IHdpdGggX3N0YXRpY1NvdXJjZSBsaW5raW5nIHRvIG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgLy8gYW5kIGluIHRoZSBvcmlnaW5hbCBhcnJheSBhcyB3ZWxsLCBpZiBubyB0cmlhbmdsZSBzcGxpdHRpbmcgd2FzIGRvbmVcbiAgICAgICAgICAgICAgICBjb25zdCBkcmF3Q2FsbHMgPSB0aGlzLnNjZW5lLmRyYXdDYWxscztcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlTWVzaEluc3RhbmNlcyA9IG5vZGUucmVuZGVyLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbHNbaV0uX3N0YXRpY1NvdXJjZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub2RlTWVzaEluc3RhbmNlcy5pbmRleE9mKGRyYXdDYWxsc1tpXS5fc3RhdGljU291cmNlKSA8IDApIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBhcnIucHVzaChkcmF3Q2FsbHNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVNZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbHMuaW5kZXhPZihub2RlTWVzaEluc3RhbmNlc1tpXSkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyLnB1c2gobm9kZU1lc2hJbnN0YW5jZXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhcnIgPSBncm91cE1lc2hJbnN0YW5jZXNbbm9kZS5yZW5kZXIuYmF0Y2hHcm91cElkXSA9IGFyci5jb25jYXQobm9kZS5yZW5kZXIubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVuZGVyLnJlbW92ZUZyb21MYXllcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgfVxuXG4gICAgX2V4dHJhY3RNb2RlbChub2RlLCBhcnIsIGdyb3VwLCBncm91cE1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgaWYgKG5vZGUubW9kZWwgJiYgbm9kZS5tb2RlbC5tb2RlbCkge1xuICAgICAgICAgICAgaWYgKG5vZGUubW9kZWwuaXNTdGF0aWMpIHtcbiAgICAgICAgICAgICAgICAvLyBzdGF0aWMgbWVzaCBpbnN0YW5jZXMgY2FuIGJlIGluIGJvdGggZHJhd0NhbGwgYXJyYXkgd2l0aCBfc3RhdGljU291cmNlIGxpbmtpbmcgdG8gb3JpZ2luYWxcbiAgICAgICAgICAgICAgICAvLyBhbmQgaW4gdGhlIG9yaWdpbmFsIGFycmF5IGFzIHdlbGwsIGlmIG5vIHRyaWFuZ2xlIHNwbGl0dGluZyB3YXMgZG9uZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxscyA9IHRoaXMuc2NlbmUuZHJhd0NhbGxzO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVNZXNoSW5zdGFuY2VzID0gbm9kZS5tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGxzW2ldLl9zdGF0aWNTb3VyY2UpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZU1lc2hJbnN0YW5jZXMuaW5kZXhPZihkcmF3Q2FsbHNbaV0uX3N0YXRpY1NvdXJjZSkgPCAwKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgYXJyLnB1c2goZHJhd0NhbGxzW2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlTWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGxzLmluZGV4T2Yobm9kZU1lc2hJbnN0YW5jZXNbaV0pID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyci5wdXNoKG5vZGVNZXNoSW5zdGFuY2VzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXJyID0gZ3JvdXBNZXNoSW5zdGFuY2VzW25vZGUubW9kZWwuYmF0Y2hHcm91cElkXSA9IGFyci5jb25jYXQobm9kZS5tb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZS5tb2RlbC5yZW1vdmVNb2RlbEZyb21MYXllcnMoKTtcblxuICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgbm9kZS5tb2RlbC5fYmF0Y2hHcm91cCA9IGdyb3VwO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXJyO1xuICAgIH1cblxuICAgIF9leHRyYWN0RWxlbWVudChub2RlLCBhcnIsIGdyb3VwKSB7XG4gICAgICAgIGlmICghbm9kZS5lbGVtZW50KSByZXR1cm47XG4gICAgICAgIGxldCB2YWxpZCA9IGZhbHNlO1xuICAgICAgICBpZiAobm9kZS5lbGVtZW50Ll90ZXh0ICYmIG5vZGUuZWxlbWVudC5fdGV4dC5fbW9kZWwubWVzaEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBhcnIucHVzaChub2RlLmVsZW1lbnQuX3RleHQuX21vZGVsLm1lc2hJbnN0YW5jZXNbMF0pO1xuICAgICAgICAgICAgbm9kZS5lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyhub2RlLmVsZW1lbnQuX3RleHQuX21vZGVsKTtcblxuICAgICAgICAgICAgdmFsaWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKG5vZGUuZWxlbWVudC5faW1hZ2UpIHtcbiAgICAgICAgICAgIGFyci5wdXNoKG5vZGUuZWxlbWVudC5faW1hZ2UuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlKTtcbiAgICAgICAgICAgIG5vZGUuZWxlbWVudC5yZW1vdmVNb2RlbEZyb21MYXllcnMobm9kZS5lbGVtZW50Ll9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCk7XG5cbiAgICAgICAgICAgIGlmIChub2RlLmVsZW1lbnQuX2ltYWdlLl9yZW5kZXJhYmxlLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGFyci5wdXNoKG5vZGUuZWxlbWVudC5faW1hZ2UuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGUuZWxlbWVudC5faW1hZ2UuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlLnN0ZW5jaWxGcm9udCB8fFxuICAgICAgICAgICAgICAgICAgICAhbm9kZS5lbGVtZW50Ll9pbWFnZS5fcmVuZGVyYWJsZS51bm1hc2tNZXNoSW5zdGFuY2Uuc3RlbmNpbEJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5lbGVtZW50Ll9kaXJ0aWZ5TWFzaygpO1xuICAgICAgICAgICAgICAgICAgICBub2RlLmVsZW1lbnQuX29uUHJlcmVuZGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YWxpZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgIGdyb3VwLl91aSA9IHRydWU7XG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICBub2RlLmVsZW1lbnQuX2JhdGNoR3JvdXAgPSBncm91cDtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gdHJhdmVyc2Ugc2NlbmUgaGllcmFyY2h5IGRvd24gZnJvbSBgbm9kZWAgYW5kIGNvbGxlY3QgYWxsIGNvbXBvbmVudHMgdGhhdCBhcmUgbWFya2VkXG4gICAgLy8gd2l0aCBhIGJhdGNoIGdyb3VwIGlkLiBSZW1vdmUgZnJvbSBsYXllcnMgYW55IG1vZGVscyB0aGF0IHRoZXNlIGNvbXBvbmVudHMgY29udGFpbnMuXG4gICAgLy8gRmlsbCB0aGUgYGdyb3VwTWVzaEluc3RhbmNlc2Agd2l0aCBhbGwgdGhlIG1lc2ggaW5zdGFuY2VzIHRvIGJlIGluY2x1ZGVkIGluIHRoZSBiYXRjaCBncm91cHMsXG4gICAgLy8gaW5kZXhlZCBieSBiYXRjaCBncm91cCBpZC5cbiAgICBfY29sbGVjdEFuZFJlbW92ZU1lc2hJbnN0YW5jZXMoZ3JvdXBNZXNoSW5zdGFuY2VzLCBncm91cElkcykge1xuICAgICAgICBmb3IgKGxldCBnID0gMDsgZyA8IGdyb3VwSWRzLmxlbmd0aDsgZysrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGdyb3VwSWRzW2ddO1xuICAgICAgICAgICAgY29uc3QgZ3JvdXAgPSB0aGlzLl9iYXRjaEdyb3Vwc1tpZF07XG4gICAgICAgICAgICBpZiAoIWdyb3VwKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxldCBhcnIgPSBncm91cE1lc2hJbnN0YW5jZXNbaWRdO1xuICAgICAgICAgICAgaWYgKCFhcnIpIGFyciA9IGdyb3VwTWVzaEluc3RhbmNlc1tpZF0gPSBbXTtcblxuICAgICAgICAgICAgZm9yIChsZXQgbSA9IDA7IG0gPCBncm91cC5fb2JqLm1vZGVsLmxlbmd0aDsgbSsrKSB7XG4gICAgICAgICAgICAgICAgYXJyID0gdGhpcy5fZXh0cmFjdE1vZGVsKGdyb3VwLl9vYmoubW9kZWxbbV0sIGFyciwgZ3JvdXAsIGdyb3VwTWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IHIgPSAwOyByIDwgZ3JvdXAuX29iai5yZW5kZXIubGVuZ3RoOyByKyspIHtcbiAgICAgICAgICAgICAgICBhcnIgPSB0aGlzLl9leHRyYWN0UmVuZGVyKGdyb3VwLl9vYmoucmVuZGVyW3JdLCBhcnIsIGdyb3VwLCBncm91cE1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBlID0gMDsgZSA8IGdyb3VwLl9vYmouZWxlbWVudC5sZW5ndGg7IGUrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2V4dHJhY3RFbGVtZW50KGdyb3VwLl9vYmouZWxlbWVudFtlXSwgYXJyLCBncm91cCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IHMgPSAwOyBzIDwgZ3JvdXAuX29iai5zcHJpdGUubGVuZ3RoOyBzKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlID0gZ3JvdXAuX29iai5zcHJpdGVbc107XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuc3ByaXRlICYmIG5vZGUuc3ByaXRlLl9tZXNoSW5zdGFuY2UgJiZcbiAgICAgICAgICAgICAgICAgICAgKGdyb3VwLmR5bmFtaWMgfHwgbm9kZS5zcHJpdGUuc3ByaXRlLl9yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TSU1QTEUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyci5wdXNoKG5vZGUuc3ByaXRlLl9tZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICBub2RlLnNwcml0ZS5yZW1vdmVNb2RlbEZyb21MYXllcnMoKTtcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXAuX3Nwcml0ZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUuc3ByaXRlLl9iYXRjaEdyb3VwID0gZ3JvdXA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveXMgYWxsIGJhdGNoZXMgYW5kIGNyZWF0ZXMgbmV3IGJhc2VkIG9uIHNjZW5lIG1vZGVscy4gSGlkZXMgb3JpZ2luYWwgbW9kZWxzLiBDYWxsZWQgYnlcbiAgICAgKiBlbmdpbmUgYXV0b21hdGljYWxseSBvbiBhcHAgc3RhcnQsIGFuZCBpZiBiYXRjaEdyb3VwSWRzIG9uIG1vZGVscyBhcmUgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IFtncm91cElkc10gLSBPcHRpb25hbCBhcnJheSBvZiBiYXRjaCBncm91cCBJRHMgdG8gdXBkYXRlLiBPdGhlcndpc2UgYWxsXG4gICAgICogZ3JvdXBzIGFyZSB1cGRhdGVkLlxuICAgICAqL1xuICAgIGdlbmVyYXRlKGdyb3VwSWRzKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwTWVzaEluc3RhbmNlcyA9IHt9O1xuXG4gICAgICAgIGlmICghZ3JvdXBJZHMpIHtcbiAgICAgICAgICAgIC8vIEZ1bGwgc2NlbmVcbiAgICAgICAgICAgIGdyb3VwSWRzID0gT2JqZWN0LmtleXModGhpcy5fYmF0Y2hHcm91cHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVsZXRlIG9sZCBiYXRjaGVzIHdpdGggbWF0Y2hpbmcgYmF0Y2hHcm91cElkXG4gICAgICAgIGNvbnN0IG5ld0JhdGNoTGlzdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2JhdGNoTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGdyb3VwSWRzLmluZGV4T2YodGhpcy5fYmF0Y2hMaXN0W2ldLmJhdGNoR3JvdXBJZCkgPCAwKSB7XG4gICAgICAgICAgICAgICAgbmV3QmF0Y2hMaXN0LnB1c2godGhpcy5fYmF0Y2hMaXN0W2ldKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZGVzdHJveUJhdGNoKHRoaXMuX2JhdGNoTGlzdFtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYmF0Y2hMaXN0ID0gbmV3QmF0Y2hMaXN0O1xuXG4gICAgICAgIC8vIGNvbGxlY3RcbiAgICAgICAgdGhpcy5fY29sbGVjdEFuZFJlbW92ZU1lc2hJbnN0YW5jZXMoZ3JvdXBNZXNoSW5zdGFuY2VzLCBncm91cElkcyk7XG5cbiAgICAgICAgaWYgKGdyb3VwSWRzID09PSB0aGlzLl9kaXJ0eUdyb3Vwcykge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlHcm91cHMubGVuZ3RoID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld0RpcnR5R3JvdXBzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2RpcnR5R3JvdXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGdyb3VwSWRzLmluZGV4T2YodGhpcy5fZGlydHlHcm91cHNbaV0pIDwgMCkgbmV3RGlydHlHcm91cHMucHVzaCh0aGlzLl9kaXJ0eUdyb3Vwc1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUdyb3VwcyA9IG5ld0RpcnR5R3JvdXBzO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGdyb3VwLCBsaXN0cywgZ3JvdXBEYXRhLCBiYXRjaDtcbiAgICAgICAgZm9yIChjb25zdCBncm91cElkIGluIGdyb3VwTWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgaWYgKCFncm91cE1lc2hJbnN0YW5jZXMuaGFzT3duUHJvcGVydHkoZ3JvdXBJZCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgZ3JvdXAgPSBncm91cE1lc2hJbnN0YW5jZXNbZ3JvdXBJZF07XG5cbiAgICAgICAgICAgIGdyb3VwRGF0YSA9IHRoaXMuX2JhdGNoR3JvdXBzW2dyb3VwSWRdO1xuICAgICAgICAgICAgaWYgKCFncm91cERhdGEpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgYmF0Y2ggZ3JvdXAgJHtncm91cElkfSBub3QgZm91bmRgKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGlzdHMgPSB0aGlzLnByZXBhcmUoZ3JvdXAsIGdyb3VwRGF0YS5keW5hbWljLCBncm91cERhdGEubWF4QWFiYlNpemUsIGdyb3VwRGF0YS5fdWkgfHwgZ3JvdXBEYXRhLl9zcHJpdGUpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGJhdGNoID0gdGhpcy5jcmVhdGUobGlzdHNbaV0sIGdyb3VwRGF0YS5keW5hbWljLCBwYXJzZUludChncm91cElkLCAxMCkpO1xuICAgICAgICAgICAgICAgIGlmIChiYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBiYXRjaC5hZGRUb0xheWVycyh0aGlzLnNjZW5lLCBncm91cERhdGEubGF5ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFRha2VzIGEgbGlzdCBvZiBtZXNoIGluc3RhbmNlcyB0byBiZSBiYXRjaGVkIGFuZCBzb3J0cyB0aGVtIGludG8gbGlzdHMgb25lIGZvciBlYWNoIGRyYXdcbiAgICAgKiBjYWxsLiBUaGUgaW5wdXQgbGlzdCB3aWxsIGJlIHNwbGl0LCBpZjpcbiAgICAgKlxuICAgICAqIC0gTWVzaCBpbnN0YW5jZXMgdXNlIGRpZmZlcmVudCBtYXRlcmlhbHMuXG4gICAgICogLSBNZXNoIGluc3RhbmNlcyBoYXZlIGRpZmZlcmVudCBwYXJhbWV0ZXJzIChlLmcuIGxpZ2h0bWFwcyBvciBzdGF0aWMgbGlnaHRzKS5cbiAgICAgKiAtIE1lc2ggaW5zdGFuY2VzIGhhdmUgZGlmZmVyZW50IHNoYWRlciBkZWZpbmVzIChzaGFkb3cgcmVjZWl2aW5nLCBiZWluZyBhbGlnbmVkIHRvIHNjcmVlblxuICAgICAqIHNwYWNlLCBldGMpLlxuICAgICAqIC0gVG9vIG1hbnkgdmVydGljZXMgZm9yIGEgc2luZ2xlIGJhdGNoICg2NTUzNSBpcyBtYXhpbXVtKS5cbiAgICAgKiAtIFRvbyBtYW55IGluc3RhbmNlcyBmb3IgYSBzaW5nbGUgYmF0Y2ggKGhhcmR3YXJlLWRlcGVuZGVudCwgZXhwZWN0IDEyOCBvbiBsb3ctZW5kIGFuZCAxMDI0XG4gICAgICogb24gaGlnaC1lbmQpLlxuICAgICAqIC0gQm91bmRpbmcgYm94IG9mIGEgYmF0Y2ggaXMgbGFyZ2VyIHRoYW4gbWF4QWFiYlNpemUgaW4gYW55IGRpbWVuc2lvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlW119IG1lc2hJbnN0YW5jZXMgLSBJbnB1dCBsaXN0IG9mIG1lc2ggaW5zdGFuY2VzXG4gICAgICogQHBhcmFtIHtib29sZWFufSBkeW5hbWljIC0gQXJlIHdlIHByZXBhcmluZyBmb3IgYSBkeW5hbWljIGJhdGNoPyBJbnN0YW5jZSBjb3VudCB3aWxsIG1hdHRlclxuICAgICAqIHRoZW4gKG90aGVyd2lzZSBub3QpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhBYWJiU2l6ZSAtIE1heGltdW0gc2l6ZSBvZiBhbnkgZGltZW5zaW9uIG9mIGEgYm91bmRpbmcgYm94IGFyb3VuZCBiYXRjaGVkXG4gICAgICogb2JqZWN0cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHRyYW5zbHVjZW50IC0gQXJlIHdlIGJhdGNoaW5nIFVJIGVsZW1lbnRzIG9yIHNwcml0ZXNcbiAgICAgKiBUaGlzIGlzIHVzZWZ1bCB0byBrZWVwIGEgYmFsYW5jZSBiZXR3ZWVuIHRoZSBudW1iZXIgb2YgZHJhdyBjYWxscyBhbmQgdGhlIG51bWJlciBvZiBkcmF3blxuICAgICAqIHRyaWFuZ2xlcywgYmVjYXVzZSBzbWFsbGVyIGJhdGNoZXMgY2FuIGJlIGhpZGRlbiB3aGVuIG5vdCB2aXNpYmxlIGluIGNhbWVyYS5cbiAgICAgKiBAcmV0dXJucyB7TWVzaEluc3RhbmNlW11bXX0gQW4gYXJyYXkgb2YgYXJyYXlzIG9mIG1lc2ggaW5zdGFuY2VzLCBlYWNoIHZhbGlkIHRvIHBhc3MgdG9cbiAgICAgKiB7QGxpbmsgQmF0Y2hNYW5hZ2VyI2NyZWF0ZX0uXG4gICAgICovXG4gICAgcHJlcGFyZShtZXNoSW5zdGFuY2VzLCBkeW5hbWljLCBtYXhBYWJiU2l6ZSA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSwgdHJhbnNsdWNlbnQpIHtcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG4gICAgICAgIGNvbnN0IGhhbGZNYXhBYWJiU2l6ZSA9IG1heEFhYmJTaXplICogMC41O1xuICAgICAgICBjb25zdCBtYXhJbnN0YW5jZUNvdW50ID0gdGhpcy5kZXZpY2Uuc3VwcG9ydHNCb25lVGV4dHVyZXMgPyAxMDI0IDogdGhpcy5kZXZpY2UuYm9uZUxpbWl0O1xuXG4gICAgICAgIC8vIG1heGltdW0gbnVtYmVyIG9mIHZlcnRpY2VzIHRoYXQgY2FuIGJlIHVzZWQgaW4gYmF0Y2ggZGVwZW5kcyBvbiAzMmJpdCBpbmRleCBidWZmZXIgc3VwcG9ydCAoZG8gdGhpcyBmb3Igbm9uLWluZGV4ZWQgYXMgd2VsbCxcbiAgICAgICAgLy8gYXMgaW4gc29tZSBjYXNlcyAoVUkgZWxlbWVudHMpIG5vbi1pbmRleGVkIGdlb21ldHJ5IGdldHMgYmF0Y2hlZCBpbnRvIGluZGV4ZWQpXG4gICAgICAgIGNvbnN0IG1heE51bVZlcnRpY2VzID0gdGhpcy5kZXZpY2UuZXh0VWludEVsZW1lbnQgPyAweGZmZmZmZmZmIDogMHhmZmZmO1xuXG4gICAgICAgIGNvbnN0IGFhYmIgPSBuZXcgQm91bmRpbmdCb3goKTtcbiAgICAgICAgY29uc3QgdGVzdEFhYmIgPSBuZXcgQm91bmRpbmdCb3goKTtcbiAgICAgICAgbGV0IHNraXBUcmFuc2x1Y2VudEFhYmIgPSBudWxsO1xuICAgICAgICBsZXQgc2Y7XG5cbiAgICAgICAgY29uc3QgbGlzdHMgPSBbXTtcbiAgICAgICAgbGV0IGogPSAwO1xuICAgICAgICBpZiAodHJhbnNsdWNlbnQpIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLmRyYXdPcmRlciAtIGIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IG1lc2hJbnN0YW5jZXNMZWZ0QSA9IG1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGxldCBtZXNoSW5zdGFuY2VzTGVmdEI7XG5cbiAgICAgICAgY29uc3Qgc2tpcE1lc2ggPSB0cmFuc2x1Y2VudCA/IGZ1bmN0aW9uIChtaSkge1xuICAgICAgICAgICAgaWYgKHNraXBUcmFuc2x1Y2VudEFhYmIpIHtcbiAgICAgICAgICAgICAgICBza2lwVHJhbnNsdWNlbnRBYWJiLmFkZChtaS5hYWJiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2tpcFRyYW5zbHVjZW50QWFiYiA9IG1pLmFhYmIuY2xvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNMZWZ0Qi5wdXNoKG1pKTtcbiAgICAgICAgfSA6IGZ1bmN0aW9uIChtaSkge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc0xlZnRCLnB1c2gobWkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHdoaWxlIChtZXNoSW5zdGFuY2VzTGVmdEEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGlzdHNbal0gPSBbbWVzaEluc3RhbmNlc0xlZnRBWzBdXTtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNMZWZ0QiA9IFtdO1xuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0ubWF0ZXJpYWw7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5sYXllcjtcbiAgICAgICAgICAgIGNvbnN0IGRlZnMgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0uX3NoYWRlckRlZnM7XG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0ucGFyYW1ldGVycztcbiAgICAgICAgICAgIGNvbnN0IHN0ZW5jaWwgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0uc3RlbmNpbEZyb250O1xuICAgICAgICAgICAgY29uc3QgbGlnaHRMaXN0ID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLl9zdGF0aWNMaWdodExpc3Q7XG4gICAgICAgICAgICBsZXQgdmVydENvdW50ID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLm1lc2gudmVydGV4QnVmZmVyLmdldE51bVZlcnRpY2VzKCk7XG4gICAgICAgICAgICBjb25zdCBkcmF3T3JkZXIgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0uZHJhd09yZGVyO1xuICAgICAgICAgICAgYWFiYi5jb3B5KG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5hYWJiKTtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlU2lnbiA9IGdldFNjYWxlU2lnbihtZXNoSW5zdGFuY2VzTGVmdEFbMF0pO1xuICAgICAgICAgICAgY29uc3QgdmVydGV4Rm9ybWF0QmF0Y2hpbmdIYXNoID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5iYXRjaGluZ0hhc2g7XG4gICAgICAgICAgICBjb25zdCBpbmRleGVkID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLm1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQ7XG4gICAgICAgICAgICBza2lwVHJhbnNsdWNlbnRBYWJiID0gbnVsbDtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBtZXNoSW5zdGFuY2VzTGVmdEEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IG1lc2hJbnN0YW5jZXNMZWZ0QVtpXTtcblxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IGluc3RhbmNlIG51bWJlclxuICAgICAgICAgICAgICAgIGlmIChkeW5hbWljICYmIGxpc3RzW2pdLmxlbmd0aCA+PSBtYXhJbnN0YW5jZUNvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNMZWZ0QiA9IG1lc2hJbnN0YW5jZXNMZWZ0Qi5jb25jYXQobWVzaEluc3RhbmNlc0xlZnRBLnNsaWNlKGkpKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgYnkgbWF0ZXJpYWwsIGxheWVyIChsZWdhY3kpLCB2ZXJ0ZXggZm9ybWF0ICYgaW5kZXggY29tcGF0aWJpbGl0eSwgc2hhZGVyIGRlZmluZXMsIHN0YXRpYyBzb3VyY2UsIHZlcnQgY291bnQsIG92ZXJsYXBwaW5nIFVJXG4gICAgICAgICAgICAgICAgaWYgKChtYXRlcmlhbCAhPT0gbWkubWF0ZXJpYWwpIHx8XG4gICAgICAgICAgICAgICAgICAgIChsYXllciAhPT0gbWkubGF5ZXIpIHx8XG4gICAgICAgICAgICAgICAgICAgICh2ZXJ0ZXhGb3JtYXRCYXRjaGluZ0hhc2ggIT09IG1pLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5iYXRjaGluZ0hhc2gpIHx8XG4gICAgICAgICAgICAgICAgICAgIChpbmRleGVkICE9PSBtaS5tZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkKSB8fFxuICAgICAgICAgICAgICAgICAgICAoZGVmcyAhPT0gbWkuX3NoYWRlckRlZnMpIHx8XG4gICAgICAgICAgICAgICAgICAgICh2ZXJ0Q291bnQgKyBtaS5tZXNoLnZlcnRleEJ1ZmZlci5nZXROdW1WZXJ0aWNlcygpID4gbWF4TnVtVmVydGljZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IEFBQkJcbiAgICAgICAgICAgICAgICB0ZXN0QWFiYi5jb3B5KGFhYmIpO1xuICAgICAgICAgICAgICAgIHRlc3RBYWJiLmFkZChtaS5hYWJiKTtcbiAgICAgICAgICAgICAgICBpZiAodGVzdEFhYmIuaGFsZkV4dGVudHMueCA+IGhhbGZNYXhBYWJiU2l6ZSB8fFxuICAgICAgICAgICAgICAgICAgICB0ZXN0QWFiYi5oYWxmRXh0ZW50cy55ID4gaGFsZk1heEFhYmJTaXplIHx8XG4gICAgICAgICAgICAgICAgICAgIHRlc3RBYWJiLmhhbGZFeHRlbnRzLnogPiBoYWxmTWF4QWFiYlNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgc3RlbmNpbCBtYXNrIChVSSBlbGVtZW50cyksIGJvdGggZnJvbnQgYW5kIGJhY2sgZXhwZWN0ZWQgdG8gYmUgdGhlIHNhbWVcbiAgICAgICAgICAgICAgICBpZiAoc3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIShzZiA9IG1pLnN0ZW5jaWxGcm9udCkgfHwgc3RlbmNpbC5mdW5jICE9PSBzZi5mdW5jIHx8IHN0ZW5jaWwuenBhc3MgIT09IHNmLnpwYXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBza2lwTWVzaChtaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBieSBuZWdhdGl2ZSBzY2FsZVxuICAgICAgICAgICAgICAgIGlmIChzY2FsZVNpZ24gIT09IGdldFNjYWxlU2lnbihtaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBieSBwYXJhbWV0ZXJzXG4gICAgICAgICAgICAgICAgaWYgKCFlcXVhbFBhcmFtU2V0cyhwYXJhbXMsIG1pLnBhcmFtZXRlcnMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IHN0YXRpYyBsaWdodCBsaXN0XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdGljTGlnaHRzID0gbWkuX3N0YXRpY0xpZ2h0TGlzdDtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRMaXN0ICYmIHN0YXRpY0xpZ2h0cykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVxdWFsTGlnaHRMaXN0cyhsaWdodExpc3QsIHN0YXRpY0xpZ2h0cykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaWdodExpc3QgfHwgc3RhdGljTGlnaHRzKSB7IC8vIFNwbGl0IGJ5IHN0YXRpYy9ub24gc3RhdGljXG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRyYW5zbHVjZW50ICYmIHNraXBUcmFuc2x1Y2VudEFhYmIgJiYgc2tpcFRyYW5zbHVjZW50QWFiYi5pbnRlcnNlY3RzKG1pLmFhYmIpICYmIG1pLmRyYXdPcmRlciAhPT0gZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYWFiYi5hZGQobWkuYWFiYik7XG4gICAgICAgICAgICAgICAgdmVydENvdW50ICs9IG1pLm1lc2gudmVydGV4QnVmZmVyLmdldE51bVZlcnRpY2VzKCk7XG4gICAgICAgICAgICAgICAgbGlzdHNbal0ucHVzaChtaSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNMZWZ0QSA9IG1lc2hJbnN0YW5jZXNMZWZ0QjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsaXN0cztcbiAgICB9XG5cbiAgICBjb2xsZWN0QmF0Y2hlZE1lc2hEYXRhKG1lc2hJbnN0YW5jZXMsIGR5bmFtaWMpIHtcblxuICAgICAgICBsZXQgc3RyZWFtcyA9IG51bGw7XG4gICAgICAgIGxldCBiYXRjaE51bVZlcnRzID0gMDtcbiAgICAgICAgbGV0IGJhdGNoTnVtSW5kaWNlcyA9IDA7XG4gICAgICAgIGxldCBtYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobWVzaEluc3RhbmNlc1tpXS52aXNpYmxlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggY291bnRzXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZXNbaV0ubWVzaDtcbiAgICAgICAgICAgICAgICBjb25zdCBudW1WZXJ0cyA9IG1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgICAgIGJhdGNoTnVtVmVydHMgKz0gbnVtVmVydHM7XG5cbiAgICAgICAgICAgICAgICAvLyBpbmRleCBjb3VudFxuICAgICAgICAgICAgICAgIGlmIChtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGJhdGNoTnVtSW5kaWNlcyArPSBtZXNoLnByaW1pdGl2ZVswXS5jb3VudDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBzcGVjaWFsIGNhc2Ugb2YgZmFuIC8gc3RyaXAgbm9uLWluZGV4ZWQgcHJpbWl0aXZlIHVzZWQgYnkgVUlcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlVHlwZSA9IG1lc2gucHJpbWl0aXZlWzBdLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcmltaXRpdmVUeXBlID09PSBQUklNSVRJVkVfVFJJRkFOIHx8IHByaW1pdGl2ZVR5cGUgPT09IFBSSU1JVElWRV9UUklTVFJJUCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID09PSA0KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhdGNoTnVtSW5kaWNlcyArPSA2O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgZmlyc3QgbWVzaFxuICAgICAgICAgICAgICAgIGlmICghc3RyZWFtcykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsID0gbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjb2xsZWN0IHVzZWQgdmVydGV4IGJ1ZmZlciBzZW1hbnRpYyBpbmZvcm1hdGlvbiBmcm9tIGZpcnN0IG1lc2ggKHRoZXkgYWxsIG1hdGNoKVxuICAgICAgICAgICAgICAgICAgICBzdHJlYW1zID0ge307XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1zID0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGVsZW1zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGVsZW1zW2pdLm5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJlYW1zW3NlbWFudGljXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1Db21wb25lbnRzOiBlbGVtc1tqXS5udW1Db21wb25lbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiBlbGVtc1tqXS5kYXRhVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemU6IGVsZW1zW2pdLm5vcm1hbGl6ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogMFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZvciBkeW5hbWljIG1lc2hlcyB3ZSBuZWVkIGJvbmUgaW5kaWNlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoZHluYW1pYykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtc1tTRU1BTlRJQ19CTEVORElORElDRVNdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUNvbXBvbmVudHM6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6IFRZUEVfRkxPQVQzMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0cmVhbXM6IHN0cmVhbXMsXG4gICAgICAgICAgICBiYXRjaE51bVZlcnRzOiBiYXRjaE51bVZlcnRzLFxuICAgICAgICAgICAgYmF0Y2hOdW1JbmRpY2VzOiBiYXRjaE51bUluZGljZXMsXG4gICAgICAgICAgICBtYXRlcmlhbDogbWF0ZXJpYWxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUYWtlcyBhIG1lc2ggaW5zdGFuY2UgbGlzdCB0aGF0IGhhcyBiZWVuIHByZXBhcmVkIGJ5IHtAbGluayBCYXRjaE1hbmFnZXIjcHJlcGFyZX0sIGFuZFxuICAgICAqIHJldHVybnMgYSB7QGxpbmsgQmF0Y2h9IG9iamVjdC4gVGhpcyBtZXRob2QgYXNzdW1lcyB0aGF0IGFsbCBtZXNoIGluc3RhbmNlcyBwcm92aWRlZCBjYW4gYmVcbiAgICAgKiByZW5kZXJlZCBpbiBhIHNpbmdsZSBkcmF3IGNhbGwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gSW5wdXQgbGlzdCBvZiBtZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGR5bmFtaWMgLSBJcyBpdCBhIHN0YXRpYyBvciBkeW5hbWljIGJhdGNoPyBXaWxsIG9iamVjdHMgYmUgdHJhbnNmb3JtZWRcbiAgICAgKiBhZnRlciBiYXRjaGluZz9cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2JhdGNoR3JvdXBJZF0gLSBMaW5rIHRoaXMgYmF0Y2ggdG8gYSBzcGVjaWZpYyBiYXRjaCBncm91cC4gVGhpcyBpcyBkb25lXG4gICAgICogYXV0b21hdGljYWxseSB3aXRoIGRlZmF1bHQgYmF0Y2hlcy5cbiAgICAgKiBAcmV0dXJucyB7QmF0Y2h9IFRoZSByZXN1bHRpbmcgYmF0Y2ggb2JqZWN0LlxuICAgICAqL1xuICAgIGNyZWF0ZShtZXNoSW5zdGFuY2VzLCBkeW5hbWljLCBiYXRjaEdyb3VwSWQpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKCF0aGlzLl9pbml0KSB7XG4gICAgICAgICAgICBjb25zdCBib25lTGltaXQgPSAnI2RlZmluZSBCT05FX0xJTUlUICcgKyB0aGlzLmRldmljZS5nZXRCb25lTGltaXQoKSArICdcXG4nO1xuICAgICAgICAgICAgdGhpcy50cmFuc2Zvcm1WUyA9IGJvbmVMaW1pdCArICcjZGVmaW5lIERZTkFNSUNCQVRDSFxcbicgKyBzaGFkZXJDaHVua3MudHJhbnNmb3JtVlM7XG4gICAgICAgICAgICB0aGlzLnNraW5UZXhWUyA9IHNoYWRlckNodW5rcy5za2luQmF0Y2hUZXhWUztcbiAgICAgICAgICAgIHRoaXMuc2tpbkNvbnN0VlMgPSBzaGFkZXJDaHVua3Muc2tpbkJhdGNoQ29uc3RWUztcbiAgICAgICAgICAgIHRoaXMudmVydGV4Rm9ybWF0cyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5faW5pdCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RyZWFtID0gbnVsbDtcbiAgICAgICAgbGV0IHNlbWFudGljO1xuICAgICAgICBsZXQgbWVzaCwgbnVtVmVydHM7XG4gICAgICAgIGxldCBiYXRjaCA9IG51bGw7XG5cbiAgICAgICAgLy8gZmluZCBvdXQgdmVydGV4IHN0cmVhbXMgYW5kIGNvdW50c1xuICAgICAgICBjb25zdCBiYXRjaERhdGEgPSB0aGlzLmNvbGxlY3RCYXRjaGVkTWVzaERhdGEobWVzaEluc3RhbmNlcywgZHluYW1pYyk7XG5cbiAgICAgICAgLy8gaWYgYW55dGhpbmcgdG8gYmF0Y2hcbiAgICAgICAgaWYgKGJhdGNoRGF0YS5zdHJlYW1zKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHN0cmVhbXMgPSBiYXRjaERhdGEuc3RyZWFtcztcbiAgICAgICAgICAgIGxldCBtYXRlcmlhbCA9IGJhdGNoRGF0YS5tYXRlcmlhbDtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoTnVtVmVydHMgPSBiYXRjaERhdGEuYmF0Y2hOdW1WZXJ0cztcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoTnVtSW5kaWNlcyA9IGJhdGNoRGF0YS5iYXRjaE51bUluZGljZXM7XG5cbiAgICAgICAgICAgIGJhdGNoID0gbmV3IEJhdGNoKG1lc2hJbnN0YW5jZXMsIGR5bmFtaWMsIGJhdGNoR3JvdXBJZCk7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaExpc3QucHVzaChiYXRjaCk7XG5cbiAgICAgICAgICAgIGxldCBpbmRleEJhc2UsIG51bUluZGljZXMsIGluZGV4RGF0YTtcbiAgICAgICAgICAgIGxldCB2ZXJ0aWNlc09mZnNldCA9IDA7XG4gICAgICAgICAgICBsZXQgaW5kZXhPZmZzZXQgPSAwO1xuICAgICAgICAgICAgbGV0IHRyYW5zZm9ybTtcbiAgICAgICAgICAgIGNvbnN0IHZlYyA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIGluZGljZXNcbiAgICAgICAgICAgIGNvbnN0IGluZGV4QXJyYXlUeXBlID0gYmF0Y2hOdW1WZXJ0cyA8PSAweGZmZmYgPyBVaW50MTZBcnJheSA6IFVpbnQzMkFycmF5O1xuICAgICAgICAgICAgY29uc3QgaW5kaWNlcyA9IG5ldyBpbmRleEFycmF5VHlwZShiYXRjaE51bUluZGljZXMpO1xuXG4gICAgICAgICAgICAvLyBhbGxvY2F0ZSB0eXBlZCBhcnJheXMgdG8gc3RvcmUgZmluYWwgdmVydGV4IHN0cmVhbSBkYXRhXG4gICAgICAgICAgICBmb3IgKHNlbWFudGljIGluIHN0cmVhbXMpIHtcbiAgICAgICAgICAgICAgICBzdHJlYW0gPSBzdHJlYW1zW3NlbWFudGljXTtcbiAgICAgICAgICAgICAgICBzdHJlYW0udHlwZUFycmF5VHlwZSA9IHR5cGVkQXJyYXlUeXBlc1tzdHJlYW0uZGF0YVR5cGVdO1xuICAgICAgICAgICAgICAgIHN0cmVhbS5lbGVtZW50Qnl0ZVNpemUgPSB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVtzdHJlYW0uZGF0YVR5cGVdO1xuICAgICAgICAgICAgICAgIHN0cmVhbS5idWZmZXIgPSBuZXcgc3RyZWFtLnR5cGVBcnJheVR5cGUoYmF0Y2hOdW1WZXJ0cyAqIHN0cmVhbS5udW1Db21wb25lbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYnVpbGQgdmVydGV4IGFuZCBpbmRleCBkYXRhIGZvciBmaW5hbCBtZXNoXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1lc2hJbnN0YW5jZXNbaV0udmlzaWJsZSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBtZXNoID0gbWVzaEluc3RhbmNlc1tpXS5tZXNoO1xuICAgICAgICAgICAgICAgIG51bVZlcnRzID0gbWVzaC52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG5cbiAgICAgICAgICAgICAgICAvLyBtYXRyaXggdG8gdHJhbnNmb3JtIHZlcnRpY2VzIHRvIHdvcmxkIHNwYWNlIGZvciBzdGF0aWMgYmF0Y2hpbmdcbiAgICAgICAgICAgICAgICBpZiAoIWR5bmFtaWMpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtID0gbWVzaEluc3RhbmNlc1tpXS5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChzZW1hbnRpYyBpbiBzdHJlYW1zKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZW1hbnRpYyAhPT0gU0VNQU5USUNfQkxFTkRJTkRJQ0VTKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJlYW0gPSBzdHJlYW1zW3NlbWFudGljXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IHZlcnRleCBzdHJlYW0gdG8gdHlwZWQgdmlldyBzdWJhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViYXJyYXkgPSBuZXcgc3RyZWFtLnR5cGVBcnJheVR5cGUoc3RyZWFtLmJ1ZmZlci5idWZmZXIsIHN0cmVhbS5lbGVtZW50Qnl0ZVNpemUgKiBzdHJlYW0uY291bnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdG90YWxDb21wb25lbnRzID0gbWVzaC5nZXRWZXJ0ZXhTdHJlYW0oc2VtYW50aWMsIHN1YmFycmF5KSAqIHN0cmVhbS5udW1Db21wb25lbnRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtLmNvdW50ICs9IHRvdGFsQ29tcG9uZW50cztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIHBvc2l0aW9uLCBub3JtYWwgYW5kIHRhbmdlbnQgdG8gd29ybGQgc3BhY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZHluYW1pYyAmJiBzdHJlYW0ubnVtQ29tcG9uZW50cyA+PSAzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlbWFudGljID09PSBTRU1BTlRJQ19QT1NJVElPTikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRvdGFsQ29tcG9uZW50czsgaiArPSBzdHJlYW0ubnVtQ29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVjLnNldChzdWJhcnJheVtqXSwgc3ViYXJyYXlbaiArIDFdLCBzdWJhcnJheVtqICsgMl0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtLnRyYW5zZm9ybVBvaW50KHZlYywgdmVjKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YmFycmF5W2pdID0gdmVjLng7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqICsgMV0gPSB2ZWMueTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YmFycmF5W2ogKyAyXSA9IHZlYy56O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZW1hbnRpYyA9PT0gU0VNQU5USUNfTk9STUFMIHx8IHNlbWFudGljID09PSBTRU1BTlRJQ19UQU5HRU5UKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaGFuZGxlIG5vbi11bmlmb3JtIHNjYWxlIGJ5IHVzaW5nIHRyYW5zcG9zZWQgaW52ZXJzZSBtYXRyaXggdG8gdHJhbnNmb3JtIHZlY3RvcnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtLmludmVydFRvM3gzKG1hdDMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXQzLnRyYW5zcG9zZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdG90YWxDb21wb25lbnRzOyBqICs9IHN0cmVhbS5udW1Db21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZWMuc2V0KHN1YmFycmF5W2pdLCBzdWJhcnJheVtqICsgMV0sIHN1YmFycmF5W2ogKyAyXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXQzLnRyYW5zZm9ybVZlY3Rvcih2ZWMsIHZlYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqXSA9IHZlYy54O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViYXJyYXlbaiArIDFdID0gdmVjLnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqICsgMl0gPSB2ZWMuejtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGJvbmUgaW5kZXggaXMgbWVzaCBpbmRleFxuICAgICAgICAgICAgICAgIGlmIChkeW5hbWljKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0cmVhbSA9IHN0cmVhbXNbU0VNQU5USUNfQkxFTkRJTkRJQ0VTXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1WZXJ0czsgaisrKVxuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtLmJ1ZmZlcltzdHJlYW0uY291bnQrK10gPSBpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGluZGV4IGJ1ZmZlclxuICAgICAgICAgICAgICAgIGlmIChtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4QmFzZSA9IG1lc2gucHJpbWl0aXZlWzBdLmJhc2U7XG4gICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSBtZXNoLnByaW1pdGl2ZVswXS5jb3VudDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBzb3VyY2UgaW5kZXggYnVmZmVyIGRhdGEgbWFwcGVkIHRvIGl0cyBmb3JtYXRcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3JjRm9ybWF0ID0gbWVzaC5pbmRleEJ1ZmZlclswXS5nZXRGb3JtYXQoKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhEYXRhID0gbmV3IHR5cGVkQXJyYXlJbmRleEZvcm1hdHNbc3JjRm9ybWF0XShtZXNoLmluZGV4QnVmZmVyWzBdLnN0b3JhZ2UpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gbm9uLWluZGV4ZWRcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmltaXRpdmVUeXBlID0gbWVzaC5wcmltaXRpdmVbMF0udHlwZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByaW1pdGl2ZVR5cGUgPT09IFBSSU1JVElWRV9UUklGQU4gfHwgcHJpbWl0aXZlVHlwZSA9PT0gUFJJTUlUSVZFX1RSSVNUUklQKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWVzaC5wcmltaXRpdmVbMF0uY291bnQgPT09IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleEJhc2UgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSA2O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4RGF0YSA9IHByaW1pdGl2ZVR5cGUgPT09IFBSSU1JVElWRV9UUklGQU4gPyBfdHJpRmFuSW5kaWNlcyA6IF90cmlTdHJpcEluZGljZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1JbmRpY2VzOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tqICsgaW5kZXhPZmZzZXRdID0gaW5kZXhEYXRhW2luZGV4QmFzZSArIGpdICsgdmVydGljZXNPZmZzZXQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaW5kZXhPZmZzZXQgKz0gbnVtSW5kaWNlcztcbiAgICAgICAgICAgICAgICB2ZXJ0aWNlc09mZnNldCArPSBudW1WZXJ0cztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIG1lc2hcbiAgICAgICAgICAgIG1lc2ggPSBuZXcgTWVzaCh0aGlzLmRldmljZSk7XG4gICAgICAgICAgICBmb3IgKHNlbWFudGljIGluIHN0cmVhbXMpIHtcbiAgICAgICAgICAgICAgICBzdHJlYW0gPSBzdHJlYW1zW3NlbWFudGljXTtcbiAgICAgICAgICAgICAgICBtZXNoLnNldFZlcnRleFN0cmVhbShzZW1hbnRpYywgc3RyZWFtLmJ1ZmZlciwgc3RyZWFtLm51bUNvbXBvbmVudHMsIHVuZGVmaW5lZCwgc3RyZWFtLmRhdGFUeXBlLCBzdHJlYW0ubm9ybWFsaXplKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGluZGljZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBtZXNoLnNldEluZGljZXMoaW5kaWNlcyk7XG5cbiAgICAgICAgICAgIG1lc2gudXBkYXRlKFBSSU1JVElWRV9UUklBTkdMRVMsIGZhbHNlKTtcblxuICAgICAgICAgICAgLy8gUGF0Y2ggdGhlIG1hdGVyaWFsXG4gICAgICAgICAgICBpZiAoZHluYW1pYykge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsID0gbWF0ZXJpYWwuY2xvbmUoKTtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5jaHVua3MudHJhbnNmb3JtVlMgPSB0aGlzLnRyYW5zZm9ybVZTO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5za2luVGV4VlMgPSB0aGlzLnNraW5UZXhWUztcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5jaHVua3Muc2tpbkNvbnN0VlMgPSB0aGlzLnNraW5Db25zdFZTO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgbWVzaEluc3RhbmNlXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIG1hdGVyaWFsLCB0aGlzLnJvb3ROb2RlKTtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5jYXN0U2hhZG93ID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0uY2FzdFNoYWRvdztcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5wYXJhbWV0ZXJzID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0ucGFyYW1ldGVycztcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5pc1N0YXRpYyA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLmlzU3RhdGljO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmxheWVyID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0ubGF5ZXI7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuX3N0YXRpY0xpZ2h0TGlzdCA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLl9zdGF0aWNMaWdodExpc3Q7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuX3NoYWRlckRlZnMgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5fc2hhZGVyRGVmcztcblxuICAgICAgICAgICAgLy8gbWVzaEluc3RhbmNlIGN1bGxpbmcgLSBkb24ndCBjdWxsIFVJIGVsZW1lbnRzLCBhcyB0aGV5IHVzZSBjdXN0b20gY3VsbGluZyBDb21wb25lbnQuaXNWaXNpYmxlRm9yQ2FtZXJhXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuY3VsbCA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLmN1bGw7XG4gICAgICAgICAgICBjb25zdCBiYXRjaEdyb3VwID0gdGhpcy5fYmF0Y2hHcm91cHNbYmF0Y2hHcm91cElkXTtcbiAgICAgICAgICAgIGlmIChiYXRjaEdyb3VwICYmIGJhdGNoR3JvdXAuX3VpKVxuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5jdWxsID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmIChkeW5hbWljKSB7XG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIHNraW5JbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiYXRjaC5vcmlnTWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBub2Rlcy5wdXNoKGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzW2ldLm5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlID0gbmV3IFNraW5CYXRjaEluc3RhbmNlKHRoaXMuZGV2aWNlLCBub2RlcywgdGhpcy5yb290Tm9kZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGRpc2FibGUgYWFiYiB1cGRhdGUsIGdldHMgdXBkYXRlZCBtYW51YWxseSBieSBiYXRjaGVyXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmIgPSBmYWxzZTtcblxuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLmRyYXdPcmRlcjtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5zdGVuY2lsRnJvbnQgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5zdGVuY2lsRnJvbnQ7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc3RlbmNpbEJhY2sgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5zdGVuY2lsQmFjaztcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5mbGlwRmFjZXNGYWN0b3IgPSBnZXRTY2FsZVNpZ24oYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0pO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5jYXN0U2hhZG93O1xuXG4gICAgICAgICAgICBiYXRjaC5tZXNoSW5zdGFuY2UgPSBtZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICBiYXRjaC51cGRhdGVCb3VuZGluZ0JveCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9zdGF0cy5jcmVhdGVUaW1lICs9IG5vdygpIC0gdGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIGJhdGNoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgYm91bmRpbmcgYm94ZXMgZm9yIGFsbCBkeW5hbWljIGJhdGNoZXMuIENhbGxlZCBhdXRvbWF0aWNhbGx5LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUFsbCgpIHtcbiAgICAgICAgLy8gVE9ETzogb25seSBjYWxsIHdoZW4gbmVlZGVkLiBBcHBsaWVzIHRvIHNraW5uaW5nIG1hdHJpY2VzIGFzIHdlbGxcblxuICAgICAgICBpZiAodGhpcy5fZGlydHlHcm91cHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5nZW5lcmF0ZSh0aGlzLl9kaXJ0eUdyb3Vwcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9iYXRjaExpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fYmF0Y2hMaXN0W2ldLmR5bmFtaWMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hMaXN0W2ldLnVwZGF0ZUJvdW5kaW5nQm94KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLnVwZGF0ZUxhc3RGcmFtZVRpbWUgPSBub3coKSAtIHRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lcyBhIGJhdGNoLiBUaGlzIG1ldGhvZCBkb2Vzbid0IHJlYnVpbGQgYmF0Y2ggZ2VvbWV0cnksIGJ1dCBvbmx5IGNyZWF0ZXMgYSBuZXcgbW9kZWwgYW5kXG4gICAgICogYmF0Y2ggb2JqZWN0cywgbGlua2VkIHRvIGRpZmZlcmVudCBzb3VyY2UgbWVzaCBpbnN0YW5jZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0JhdGNofSBiYXRjaCAtIEEgYmF0Y2ggb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlW119IGNsb25lZE1lc2hJbnN0YW5jZXMgLSBOZXcgbWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHJldHVybnMge0JhdGNofSBOZXcgYmF0Y2ggb2JqZWN0LlxuICAgICAqL1xuICAgIGNsb25lKGJhdGNoLCBjbG9uZWRNZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoMiA9IG5ldyBCYXRjaChjbG9uZWRNZXNoSW5zdGFuY2VzLCBiYXRjaC5keW5hbWljLCBiYXRjaC5iYXRjaEdyb3VwSWQpO1xuICAgICAgICB0aGlzLl9iYXRjaExpc3QucHVzaChiYXRjaDIpO1xuXG4gICAgICAgIGNvbnN0IG5vZGVzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2xvbmVkTWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbm9kZXMucHVzaChjbG9uZWRNZXNoSW5zdGFuY2VzW2ldLm5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UoYmF0Y2gubWVzaEluc3RhbmNlLm1lc2gsIGJhdGNoLm1lc2hJbnN0YW5jZS5tYXRlcmlhbCwgYmF0Y2gubWVzaEluc3RhbmNlLm5vZGUpO1xuICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlLl91cGRhdGVBYWJiID0gZmFsc2U7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UucGFyYW1ldGVycyA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0ucGFyYW1ldGVycztcbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5pc1N0YXRpYyA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0uaXNTdGF0aWM7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuY3VsbCA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0uY3VsbDtcbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5sYXllciA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0ubGF5ZXI7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuX3N0YXRpY0xpZ2h0TGlzdCA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0uX3N0YXRpY0xpZ2h0TGlzdDtcblxuICAgICAgICBpZiAoYmF0Y2guZHluYW1pYykge1xuICAgICAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPSBuZXcgU2tpbkJhdGNoSW5zdGFuY2UodGhpcy5kZXZpY2UsIG5vZGVzLCB0aGlzLnJvb3ROb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGJhdGNoLm1lc2hJbnN0YW5jZS5jYXN0U2hhZG93O1xuICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlLl9zaGFkZXIgPSBiYXRjaC5tZXNoSW5zdGFuY2UuX3NoYWRlci5zbGljZSgpO1xuXG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGJhdGNoLm1lc2hJbnN0YW5jZS5jYXN0U2hhZG93O1xuXG4gICAgICAgIHJldHVybiBiYXRjaDI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyB0aGUgYmF0Y2ggbW9kZWwgZnJvbSBhbGwgbGF5ZXJzIGFuZCBkZXN0cm95cyBpdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QmF0Y2h9IGJhdGNoIC0gQSBiYXRjaCBvYmplY3QuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBkZXN0cm95QmF0Y2goYmF0Y2gpIHtcbiAgICAgICAgYmF0Y2guZGVzdHJveSh0aGlzLnNjZW5lLCB0aGlzLl9iYXRjaEdyb3Vwc1tiYXRjaC5iYXRjaEdyb3VwSWRdLmxheWVycyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBCYXRjaE1hbmFnZXIgfTtcbiJdLCJuYW1lcyI6WyJwYXJhbXNJZGVudGljYWwiLCJhIiwiYiIsImRhdGEiLCJGbG9hdDMyQXJyYXkiLCJsZW5ndGgiLCJpIiwiZXF1YWxQYXJhbVNldHMiLCJwYXJhbXMxIiwicGFyYW1zMiIsInBhcmFtIiwiaGFzT3duUHJvcGVydHkiLCJlcXVhbExpZ2h0TGlzdHMiLCJsaWdodExpc3QxIiwibGlnaHRMaXN0MiIsImsiLCJpbmRleE9mIiwiX3RyaUZhbkluZGljZXMiLCJfdHJpU3RyaXBJbmRpY2VzIiwibWF0MyIsIk1hdDMiLCJnZXRTY2FsZVNpZ24iLCJtaSIsIm5vZGUiLCJ3b3JsZFRyYW5zZm9ybSIsInNjYWxlU2lnbiIsIkJhdGNoTWFuYWdlciIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwicm9vdCIsInNjZW5lIiwicm9vdE5vZGUiLCJfaW5pdCIsIl9iYXRjaEdyb3VwcyIsIl9iYXRjaEdyb3VwQ291bnRlciIsIl9iYXRjaExpc3QiLCJfZGlydHlHcm91cHMiLCJfc3RhdHMiLCJjcmVhdGVUaW1lIiwidXBkYXRlTGFzdEZyYW1lVGltZSIsImRlc3Ryb3kiLCJhZGRHcm91cCIsIm5hbWUiLCJkeW5hbWljIiwibWF4QWFiYlNpemUiLCJpZCIsImxheWVycyIsInVuZGVmaW5lZCIsIkRlYnVnIiwiZXJyb3IiLCJncm91cCIsIkJhdGNoR3JvdXAiLCJyZW1vdmVHcm91cCIsIm5ld0JhdGNoTGlzdCIsImJhdGNoR3JvdXBJZCIsImRlc3Ryb3lCYXRjaCIsInB1c2giLCJfcmVtb3ZlTW9kZWxzRnJvbUJhdGNoR3JvdXAiLCJtYXJrR3JvdXBEaXJ0eSIsImdldEdyb3VwQnlOYW1lIiwiZ3JvdXBzIiwiZ2V0QmF0Y2hlcyIsInJlc3VsdHMiLCJsZW4iLCJiYXRjaCIsImVuYWJsZWQiLCJtb2RlbCIsInJlbmRlciIsImVsZW1lbnQiLCJzcHJpdGUiLCJfY2hpbGRyZW4iLCJpbnNlcnQiLCJ0eXBlIiwiZ3JvdXBJZCIsImFzc2VydCIsIl9vYmoiLCJyZW1vdmUiLCJpZHgiLCJzcGxpY2UiLCJfZXh0cmFjdFJlbmRlciIsImFyciIsImdyb3VwTWVzaEluc3RhbmNlcyIsImlzU3RhdGljIiwiZHJhd0NhbGxzIiwibm9kZU1lc2hJbnN0YW5jZXMiLCJtZXNoSW5zdGFuY2VzIiwiX3N0YXRpY1NvdXJjZSIsImNvbmNhdCIsInJlbW92ZUZyb21MYXllcnMiLCJfZXh0cmFjdE1vZGVsIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwiX2JhdGNoR3JvdXAiLCJfZXh0cmFjdEVsZW1lbnQiLCJ2YWxpZCIsIl90ZXh0IiwiX21vZGVsIiwiX2ltYWdlIiwiX3JlbmRlcmFibGUiLCJtZXNoSW5zdGFuY2UiLCJ1bm1hc2tNZXNoSW5zdGFuY2UiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsIl9kaXJ0aWZ5TWFzayIsIl9vblByZXJlbmRlciIsIl91aSIsIl9jb2xsZWN0QW5kUmVtb3ZlTWVzaEluc3RhbmNlcyIsImdyb3VwSWRzIiwiZyIsIm0iLCJyIiwiZSIsInMiLCJfbWVzaEluc3RhbmNlIiwiX3JlbmRlck1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9TSU1QTEUiLCJfc3ByaXRlIiwiZ2VuZXJhdGUiLCJPYmplY3QiLCJrZXlzIiwibmV3RGlydHlHcm91cHMiLCJsaXN0cyIsImdyb3VwRGF0YSIsInByZXBhcmUiLCJjcmVhdGUiLCJwYXJzZUludCIsImFkZFRvTGF5ZXJzIiwiTnVtYmVyIiwiUE9TSVRJVkVfSU5GSU5JVFkiLCJ0cmFuc2x1Y2VudCIsImhhbGZNYXhBYWJiU2l6ZSIsIm1heEluc3RhbmNlQ291bnQiLCJzdXBwb3J0c0JvbmVUZXh0dXJlcyIsImJvbmVMaW1pdCIsIm1heE51bVZlcnRpY2VzIiwiZXh0VWludEVsZW1lbnQiLCJhYWJiIiwiQm91bmRpbmdCb3giLCJ0ZXN0QWFiYiIsInNraXBUcmFuc2x1Y2VudEFhYmIiLCJzZiIsImoiLCJzb3J0IiwiZHJhd09yZGVyIiwibWVzaEluc3RhbmNlc0xlZnRBIiwibWVzaEluc3RhbmNlc0xlZnRCIiwic2tpcE1lc2giLCJhZGQiLCJjbG9uZSIsIm1hdGVyaWFsIiwibGF5ZXIiLCJkZWZzIiwiX3NoYWRlckRlZnMiLCJwYXJhbXMiLCJwYXJhbWV0ZXJzIiwic3RlbmNpbCIsImxpZ2h0TGlzdCIsIl9zdGF0aWNMaWdodExpc3QiLCJ2ZXJ0Q291bnQiLCJtZXNoIiwidmVydGV4QnVmZmVyIiwiZ2V0TnVtVmVydGljZXMiLCJjb3B5IiwidmVydGV4Rm9ybWF0QmF0Y2hpbmdIYXNoIiwiZm9ybWF0IiwiYmF0Y2hpbmdIYXNoIiwiaW5kZXhlZCIsInByaW1pdGl2ZSIsInNsaWNlIiwiaGFsZkV4dGVudHMiLCJ4IiwieSIsInoiLCJmdW5jIiwienBhc3MiLCJzdGF0aWNMaWdodHMiLCJpbnRlcnNlY3RzIiwiY29sbGVjdEJhdGNoZWRNZXNoRGF0YSIsInN0cmVhbXMiLCJiYXRjaE51bVZlcnRzIiwiYmF0Y2hOdW1JbmRpY2VzIiwidmlzaWJsZSIsIm51bVZlcnRzIiwibnVtVmVydGljZXMiLCJjb3VudCIsInByaW1pdGl2ZVR5cGUiLCJQUklNSVRJVkVfVFJJRkFOIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiZWxlbXMiLCJlbGVtZW50cyIsInNlbWFudGljIiwibnVtQ29tcG9uZW50cyIsImRhdGFUeXBlIiwibm9ybWFsaXplIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiVFlQRV9GTE9BVDMyIiwidGltZSIsIm5vdyIsImdldEJvbmVMaW1pdCIsInRyYW5zZm9ybVZTIiwic2hhZGVyQ2h1bmtzIiwic2tpblRleFZTIiwic2tpbkJhdGNoVGV4VlMiLCJza2luQ29uc3RWUyIsInNraW5CYXRjaENvbnN0VlMiLCJ2ZXJ0ZXhGb3JtYXRzIiwic3RyZWFtIiwiYmF0Y2hEYXRhIiwiQmF0Y2giLCJpbmRleEJhc2UiLCJudW1JbmRpY2VzIiwiaW5kZXhEYXRhIiwidmVydGljZXNPZmZzZXQiLCJpbmRleE9mZnNldCIsInRyYW5zZm9ybSIsInZlYyIsIlZlYzMiLCJpbmRleEFycmF5VHlwZSIsIlVpbnQxNkFycmF5IiwiVWludDMyQXJyYXkiLCJpbmRpY2VzIiwidHlwZUFycmF5VHlwZSIsInR5cGVkQXJyYXlUeXBlcyIsImVsZW1lbnRCeXRlU2l6ZSIsInR5cGVkQXJyYXlUeXBlc0J5dGVTaXplIiwiYnVmZmVyIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJzdWJhcnJheSIsInRvdGFsQ29tcG9uZW50cyIsImdldFZlcnRleFN0cmVhbSIsIlNFTUFOVElDX1BPU0lUSU9OIiwic2V0IiwidHJhbnNmb3JtUG9pbnQiLCJTRU1BTlRJQ19OT1JNQUwiLCJTRU1BTlRJQ19UQU5HRU5UIiwiaW52ZXJ0VG8zeDMiLCJ0cmFuc3Bvc2UiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJiYXNlIiwic3JjRm9ybWF0IiwiaW5kZXhCdWZmZXIiLCJnZXRGb3JtYXQiLCJ0eXBlZEFycmF5SW5kZXhGb3JtYXRzIiwic3RvcmFnZSIsIk1lc2giLCJzZXRWZXJ0ZXhTdHJlYW0iLCJzZXRJbmRpY2VzIiwidXBkYXRlIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsImNodW5rcyIsIk1lc2hJbnN0YW5jZSIsImNhc3RTaGFkb3ciLCJvcmlnTWVzaEluc3RhbmNlcyIsImN1bGwiLCJiYXRjaEdyb3VwIiwibm9kZXMiLCJza2luSW5zdGFuY2UiLCJTa2luQmF0Y2hJbnN0YW5jZSIsIl91cGRhdGVBYWJiIiwiZmxpcEZhY2VzRmFjdG9yIiwidXBkYXRlQm91bmRpbmdCb3giLCJ1cGRhdGVBbGwiLCJjbG9uZWRNZXNoSW5zdGFuY2VzIiwiYmF0Y2gyIiwiX3NoYWRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFCQSxTQUFTQSxlQUFlQSxDQUFDQyxDQUFDLEVBQUVDLENB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
