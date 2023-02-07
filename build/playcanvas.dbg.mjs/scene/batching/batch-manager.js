/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { now } from '../../core/time.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PRIMITIVE_TRIFAN, SEMANTIC_BLENDINDICES, TYPE_FLOAT32, typedArrayTypes, typedArrayTypesByteSize, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, typedArrayIndexFormats, PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';
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

        // index counts (handles special case of TRI-FAN-type non-indexed primitive used by UI)
        batchNumIndices += mesh.primitive[0].indexed ? mesh.primitive[0].count : mesh.primitive[0].type === PRIMITIVE_TRIFAN && mesh.primitive[0].count === 4 ? 6 : 0;

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
        } else if (mesh.primitive[0].type === PRIMITIVE_TRIFAN && mesh.primitive[0].count === 4) {
          // Special case for UI image elements
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
      meshInstance.flipFaces = getScaleSign(batch.origMeshInstances[0]) < 0;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2JhdGNoaW5nL2JhdGNoLW1hbmFnZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIFBSSU1JVElWRV9UUklBTkdMRVMsIFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfVEFOR0VOVCwgU0VNQU5USUNfQkxFTkRJTkRJQ0VTLFxuICAgIFRZUEVfRkxPQVQzMixcbiAgICB0eXBlZEFycmF5SW5kZXhGb3JtYXRzLCB0eXBlZEFycmF5VHlwZXMsIHR5cGVkQXJyYXlUeXBlc0J5dGVTaXplXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBCYXRjaCB9IGZyb20gJy4vYmF0Y2guanMnO1xuaW1wb3J0IHsgQmF0Y2hHcm91cCB9IGZyb20gJy4vYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgU2tpbkJhdGNoSW5zdGFuY2UgfSBmcm9tICcuL3NraW4tYmF0Y2gtaW5zdGFuY2UuanMnO1xuXG5mdW5jdGlvbiBwYXJhbXNJZGVudGljYWwoYSwgYikge1xuICAgIGlmIChhICYmICFiKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCFhICYmIGIpIHJldHVybiBmYWxzZTtcbiAgICBhID0gYS5kYXRhO1xuICAgIGIgPSBiLmRhdGE7XG4gICAgaWYgKGEgPT09IGIpIHJldHVybiB0cnVlO1xuICAgIGlmIChhIGluc3RhbmNlb2YgRmxvYXQzMkFycmF5ICYmIGIgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkpIHtcbiAgICAgICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZXF1YWxQYXJhbVNldHMocGFyYW1zMSwgcGFyYW1zMikge1xuICAgIGZvciAoY29uc3QgcGFyYW0gaW4gcGFyYW1zMSkgeyAvLyBjb21wYXJlIEEgLT4gQlxuICAgICAgICBpZiAocGFyYW1zMS5oYXNPd25Qcm9wZXJ0eShwYXJhbSkgJiYgIXBhcmFtc0lkZW50aWNhbChwYXJhbXMxW3BhcmFtXSwgcGFyYW1zMltwYXJhbV0pKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IHBhcmFtIGluIHBhcmFtczIpIHsgLy8gY29tcGFyZSBCIC0+IEFcbiAgICAgICAgaWYgKHBhcmFtczIuaGFzT3duUHJvcGVydHkocGFyYW0pICYmICFwYXJhbXNJZGVudGljYWwocGFyYW1zMltwYXJhbV0sIHBhcmFtczFbcGFyYW1dKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGVxdWFsTGlnaHRMaXN0cyhsaWdodExpc3QxLCBsaWdodExpc3QyKSB7XG4gICAgZm9yIChsZXQgayA9IDA7IGsgPCBsaWdodExpc3QxLmxlbmd0aDsgaysrKSB7XG4gICAgICAgIGlmIChsaWdodExpc3QyLmluZGV4T2YobGlnaHRMaXN0MVtrXSkgPCAwKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmb3IgKGxldCBrID0gMDsgayA8IGxpZ2h0TGlzdDIubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgaWYgKGxpZ2h0TGlzdDEuaW5kZXhPZihsaWdodExpc3QyW2tdKSA8IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxuXG5jb25zdCBtYXQzID0gbmV3IE1hdDMoKTtcblxuY29uc3Qgd29ybGRNYXRYID0gbmV3IFZlYzMoKTtcbmNvbnN0IHdvcmxkTWF0WSA9IG5ldyBWZWMzKCk7XG5jb25zdCB3b3JsZE1hdFogPSBuZXcgVmVjMygpO1xuZnVuY3Rpb24gZ2V0U2NhbGVTaWduKG1pKSB7XG4gICAgY29uc3Qgd3QgPSBtaS5ub2RlLndvcmxkVHJhbnNmb3JtO1xuICAgIHd0LmdldFgod29ybGRNYXRYKTtcbiAgICB3dC5nZXRZKHdvcmxkTWF0WSk7XG4gICAgd3QuZ2V0Wih3b3JsZE1hdFopO1xuICAgIHdvcmxkTWF0WC5jcm9zcyh3b3JsZE1hdFgsIHdvcmxkTWF0WSk7XG4gICAgcmV0dXJuIHdvcmxkTWF0WC5kb3Qod29ybGRNYXRaKSA+PSAwID8gMSA6IC0xO1xufVxuXG4vKipcbiAqIEdsdWVzIG1hbnkgbWVzaCBpbnN0YW5jZXMgaW50byBhIHNpbmdsZSBvbmUgZm9yIGJldHRlciBwZXJmb3JtYW5jZS5cbiAqL1xuY2xhc3MgQmF0Y2hNYW5hZ2VyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQmF0Y2hNYW5hZ2VyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgYmF0Y2ggbWFuYWdlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2VudGl0eS5qcycpLkVudGl0eX0gcm9vdCAtIFRoZSBlbnRpdHkgdW5kZXIgd2hpY2ggYmF0Y2hlZFxuICAgICAqIG1vZGVscyBhcmUgYWRkZWQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NjZW5lLmpzJykuU2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lIHRoYXQgdGhlIGJhdGNoIG1hbmFnZXIgYWZmZWN0cy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIHJvb3QsIHNjZW5lKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLnJvb3ROb2RlID0gcm9vdDtcbiAgICAgICAgdGhpcy5zY2VuZSA9IHNjZW5lO1xuICAgICAgICB0aGlzLl9pbml0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cHMgPSB7fTtcbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cENvdW50ZXIgPSAwO1xuICAgICAgICB0aGlzLl9iYXRjaExpc3QgPSBbXTtcbiAgICAgICAgdGhpcy5fZGlydHlHcm91cHMgPSBbXTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzID0ge1xuICAgICAgICAgICAgY3JlYXRlVGltZTogMCxcbiAgICAgICAgICAgIHVwZGF0ZUxhc3RGcmFtZVRpbWU6IDBcbiAgICAgICAgfTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBudWxsO1xuICAgICAgICB0aGlzLnJvb3ROb2RlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zY2VuZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBzID0ge307XG4gICAgICAgIHRoaXMuX2JhdGNoTGlzdCA9IFtdO1xuICAgICAgICB0aGlzLl9kaXJ0eUdyb3VwcyA9IFtdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgbmV3IGdsb2JhbCBiYXRjaCBncm91cC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gQ3VzdG9tIG5hbWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBkeW5hbWljIC0gSXMgdGhpcyBiYXRjaCBncm91cCBkeW5hbWljPyBXaWxsIHRoZXNlIG9iamVjdHMgbW92ZS9yb3RhdGUvc2NhbGVcbiAgICAgKiBhZnRlciBiZWluZyBiYXRjaGVkP1xuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhBYWJiU2l6ZSAtIE1heGltdW0gc2l6ZSBvZiBhbnkgZGltZW5zaW9uIG9mIGEgYm91bmRpbmcgYm94IGFyb3VuZCBiYXRjaGVkXG4gICAgICogb2JqZWN0cy5cbiAgICAgKiB7QGxpbmsgQmF0Y2hNYW5hZ2VyI3ByZXBhcmV9IHdpbGwgc3BsaXQgb2JqZWN0cyBpbnRvIGxvY2FsIGdyb3VwcyBiYXNlZCBvbiB0aGlzIHNpemUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpZF0gLSBPcHRpb25hbCBjdXN0b20gdW5pcXVlIGlkIGZvciB0aGUgZ3JvdXAgKHdpbGwgYmUgZ2VuZXJhdGVkXG4gICAgICogYXV0b21hdGljYWxseSBvdGhlcndpc2UpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IFtsYXllcnNdIC0gT3B0aW9uYWwgbGF5ZXIgSUQgYXJyYXkuIERlZmF1bHQgaXMgW3tAbGluayBMQVlFUklEX1dPUkxEfV0uXG4gICAgICogVGhlIHdob2xlIGJhdGNoIGdyb3VwIHdpbGwgYmVsb25nIHRvIHRoZXNlIGxheWVycy4gTGF5ZXJzIG9mIHNvdXJjZSBtb2RlbHMgd2lsbCBiZSBpZ25vcmVkLlxuICAgICAqIEByZXR1cm5zIHtCYXRjaEdyb3VwfSBHcm91cCBvYmplY3QuXG4gICAgICovXG4gICAgYWRkR3JvdXAobmFtZSwgZHluYW1pYywgbWF4QWFiYlNpemUsIGlkLCBsYXllcnMpIHtcbiAgICAgICAgaWYgKGlkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlkID0gdGhpcy5fYmF0Y2hHcm91cENvdW50ZXI7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaEdyb3VwQ291bnRlcisrO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBzW2lkXSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYEJhdGNoIGdyb3VwIHdpdGggaWQgJHtpZH0gYWxyZWFkeSBleGlzdHMuYCk7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JvdXAgPSBuZXcgQmF0Y2hHcm91cChpZCwgbmFtZSwgZHluYW1pYywgbWF4QWFiYlNpemUsIGxheWVycyk7XG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBzW2lkXSA9IGdyb3VwO1xuXG4gICAgICAgIHJldHVybiBncm91cDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgZ2xvYmFsIGJhdGNoIGdyb3VwIGJ5IGlkLiBOb3RlLCB0aGlzIHRyYXZlcnNlcyB0aGUgZW50aXJlIHNjZW5lIGdyYXBoIGFuZCBjbGVhcnMgdGhlXG4gICAgICogYmF0Y2ggZ3JvdXAgaWQgZnJvbSBhbGwgY29tcG9uZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpZCAtIEJhdGNoIEdyb3VwIElELlxuICAgICAqL1xuICAgIHJlbW92ZUdyb3VwKGlkKSB7XG4gICAgICAgIGlmICghdGhpcy5fYmF0Y2hHcm91cHNbaWRdKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihgQmF0Y2ggZ3JvdXAgd2l0aCBpZCAke2lkfSBkb2Vzbid0IGV4aXN0LmApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVsZXRlIGJhdGNoZXMgd2l0aCBtYXRjaGluZyBpZFxuICAgICAgICBjb25zdCBuZXdCYXRjaExpc3QgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9iYXRjaExpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9iYXRjaExpc3RbaV0uYmF0Y2hHcm91cElkID09PSBpZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGVzdHJveUJhdGNoKHRoaXMuX2JhdGNoTGlzdFtpXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5ld0JhdGNoTGlzdC5wdXNoKHRoaXMuX2JhdGNoTGlzdFtpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYmF0Y2hMaXN0ID0gbmV3QmF0Y2hMaXN0O1xuICAgICAgICB0aGlzLl9yZW1vdmVNb2RlbHNGcm9tQmF0Y2hHcm91cCh0aGlzLnJvb3ROb2RlLCBpZCk7XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuX2JhdGNoR3JvdXBzW2lkXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgYXMgZGlydHkuIERpcnR5IGdyb3VwcyBhcmUgcmUtYmF0Y2hlZCBiZWZvcmUgdGhlIG5leHQgZnJhbWUgaXNcbiAgICAgKiByZW5kZXJlZC4gTm90ZSwgcmUtYmF0Y2hpbmcgYSBncm91cCBpcyBhIHBvdGVudGlhbGx5IGV4cGVuc2l2ZSBvcGVyYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBCYXRjaCBHcm91cCBJRCB0byBtYXJrIGFzIGRpcnR5LlxuICAgICAqL1xuICAgIG1hcmtHcm91cERpcnR5KGlkKSB7XG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUdyb3Vwcy5pbmRleE9mKGlkKSA8IDApIHtcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5R3JvdXBzLnB1c2goaWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmVzIGEge0BsaW5rIEJhdGNoR3JvdXB9IG9iamVjdCB3aXRoIGEgY29ycmVzcG9uZGluZyBuYW1lLCBpZiBpdCBleGlzdHMsIG9yIG51bGxcbiAgICAgKiBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIE5hbWUuXG4gICAgICogQHJldHVybnMge0JhdGNoR3JvdXB8bnVsbH0gVGhlIGJhdGNoIGdyb3VwIG1hdGNoaW5nIHRoZSBuYW1lIG9yIG51bGwgaWYgbm90IGZvdW5kLlxuICAgICAqL1xuICAgIGdldEdyb3VwQnlOYW1lKG5hbWUpIHtcbiAgICAgICAgY29uc3QgZ3JvdXBzID0gdGhpcy5fYmF0Y2hHcm91cHM7XG4gICAgICAgIGZvciAoY29uc3QgZ3JvdXAgaW4gZ3JvdXBzKSB7XG4gICAgICAgICAgICBpZiAoIWdyb3Vwcy5oYXNPd25Qcm9wZXJ0eShncm91cCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGdyb3Vwc1tncm91cF0ubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBncm91cHNbZ3JvdXBdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhIGxpc3Qgb2YgYWxsIHtAbGluayBCYXRjaH0gb2JqZWN0cyB0aGF0IGJlbG9uZyB0byB0aGUgQmF0Y2ggR3JvdXAgc3VwcGxpZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmF0Y2hHcm91cElkIC0gVGhlIGlkIG9mIHRoZSBiYXRjaCBncm91cC5cbiAgICAgKiBAcmV0dXJucyB7QmF0Y2hbXX0gQSBsaXN0IG9mIGJhdGNoZXMgdGhhdCBhcmUgdXNlZCB0byByZW5kZXIgdGhlIGJhdGNoIGdyb3VwLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgZ2V0QmF0Y2hlcyhiYXRjaEdyb3VwSWQpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLl9iYXRjaExpc3QubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBiYXRjaCA9IHRoaXMuX2JhdGNoTGlzdFtpXTtcbiAgICAgICAgICAgIGlmIChiYXRjaC5iYXRjaEdyb3VwSWQgPT09IGJhdGNoR3JvdXBJZCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChiYXRjaCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvLyB0cmF2ZXJzZSBmdWxsIGhpZXJhcmNoeSBhbmQgY2xlYXIgdGhlIGJhdGNoIGdyb3VwIGlkIGZyb20gYWxsIG1vZGVsLCBlbGVtZW50IGFuZCBzcHJpdGUgY29tcG9uZW50c1xuICAgIF9yZW1vdmVNb2RlbHNGcm9tQmF0Y2hHcm91cChub2RlLCBpZCkge1xuICAgICAgICBpZiAoIW5vZGUuZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmIChub2RlLm1vZGVsICYmIG5vZGUubW9kZWwuYmF0Y2hHcm91cElkID09PSBpZCkge1xuICAgICAgICAgICAgbm9kZS5tb2RlbC5iYXRjaEdyb3VwSWQgPSAtMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5yZW5kZXIgJiYgbm9kZS5yZW5kZXIuYmF0Y2hHcm91cElkID09PSBpZCkge1xuICAgICAgICAgICAgbm9kZS5yZW5kZXIuYmF0Y2hHcm91cElkID0gLTE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUuZWxlbWVudCAmJiBub2RlLmVsZW1lbnQuYmF0Y2hHcm91cElkID09PSBpZCkge1xuICAgICAgICAgICAgbm9kZS5lbGVtZW50LmJhdGNoR3JvdXBJZCA9IC0xO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLnNwcml0ZSAmJiBub2RlLnNwcml0ZS5iYXRjaEdyb3VwSWQgPT09IGlkKSB7XG4gICAgICAgICAgICBub2RlLnNwcml0ZS5iYXRjaEdyb3VwSWQgPSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5fY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbW92ZU1vZGVsc0Zyb21CYXRjaEdyb3VwKG5vZGUuX2NoaWxkcmVuW2ldLCBpZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpbnNlcnQodHlwZSwgZ3JvdXBJZCwgbm9kZSkge1xuICAgICAgICBjb25zdCBncm91cCA9IHRoaXMuX2JhdGNoR3JvdXBzW2dyb3VwSWRdO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZ3JvdXAsIGBJbnZhbGlkIGJhdGNoICR7Z3JvdXBJZH0gaW5zZXJ0aW9uYCk7XG5cbiAgICAgICAgaWYgKGdyb3VwKSB7XG4gICAgICAgICAgICBpZiAoZ3JvdXAuX29ialt0eXBlXS5pbmRleE9mKG5vZGUpIDwgMCkge1xuICAgICAgICAgICAgICAgIGdyb3VwLl9vYmpbdHlwZV0ucHVzaChub2RlKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1hcmtHcm91cERpcnR5KGdyb3VwSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlKHR5cGUsIGdyb3VwSWQsIG5vZGUpIHtcbiAgICAgICAgY29uc3QgZ3JvdXAgPSB0aGlzLl9iYXRjaEdyb3Vwc1tncm91cElkXTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGdyb3VwLCBgSW52YWxpZCBiYXRjaCAke2dyb3VwSWR9IGluc2VydGlvbmApO1xuXG4gICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgY29uc3QgaWR4ID0gZ3JvdXAuX29ialt0eXBlXS5pbmRleE9mKG5vZGUpO1xuICAgICAgICAgICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgZ3JvdXAuX29ialt0eXBlXS5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLm1hcmtHcm91cERpcnR5KGdyb3VwSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2V4dHJhY3RSZW5kZXIobm9kZSwgYXJyLCBncm91cCwgZ3JvdXBNZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGlmIChub2RlLnJlbmRlcikge1xuXG4gICAgICAgICAgICBpZiAobm9kZS5yZW5kZXIuaXNTdGF0aWMpIHtcbiAgICAgICAgICAgICAgICAvLyBzdGF0aWMgbWVzaCBpbnN0YW5jZXMgY2FuIGJlIGluIGJvdGggZHJhd0NhbGwgYXJyYXkgd2l0aCBfc3RhdGljU291cmNlIGxpbmtpbmcgdG8gb3JpZ2luYWxcbiAgICAgICAgICAgICAgICAvLyBhbmQgaW4gdGhlIG9yaWdpbmFsIGFycmF5IGFzIHdlbGwsIGlmIG5vIHRyaWFuZ2xlIHNwbGl0dGluZyB3YXMgZG9uZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxscyA9IHRoaXMuc2NlbmUuZHJhd0NhbGxzO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVNZXNoSW5zdGFuY2VzID0gbm9kZS5yZW5kZXIubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRyYXdDYWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYXdDYWxsc1tpXS5fc3RhdGljU291cmNlKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5vZGVNZXNoSW5zdGFuY2VzLmluZGV4T2YoZHJhd0NhbGxzW2ldLl9zdGF0aWNTb3VyY2UpIDwgMCkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGFyci5wdXNoKGRyYXdDYWxsc1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZU1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxscy5pbmRleE9mKG5vZGVNZXNoSW5zdGFuY2VzW2ldKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcnIucHVzaChub2RlTWVzaEluc3RhbmNlc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFyciA9IGdyb3VwTWVzaEluc3RhbmNlc1tub2RlLnJlbmRlci5iYXRjaEdyb3VwSWRdID0gYXJyLmNvbmNhdChub2RlLnJlbmRlci5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZS5yZW5kZXIucmVtb3ZlRnJvbUxheWVycygpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFycjtcbiAgICB9XG5cbiAgICBfZXh0cmFjdE1vZGVsKG5vZGUsIGFyciwgZ3JvdXAsIGdyb3VwTWVzaEluc3RhbmNlcykge1xuICAgICAgICBpZiAobm9kZS5tb2RlbCAmJiBub2RlLm1vZGVsLm1vZGVsKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5tb2RlbC5pc1N0YXRpYykge1xuICAgICAgICAgICAgICAgIC8vIHN0YXRpYyBtZXNoIGluc3RhbmNlcyBjYW4gYmUgaW4gYm90aCBkcmF3Q2FsbCBhcnJheSB3aXRoIF9zdGF0aWNTb3VyY2UgbGlua2luZyB0byBvcmlnaW5hbFxuICAgICAgICAgICAgICAgIC8vIGFuZCBpbiB0aGUgb3JpZ2luYWwgYXJyYXkgYXMgd2VsbCwgaWYgbm8gdHJpYW5nbGUgc3BsaXR0aW5nIHdhcyBkb25lXG4gICAgICAgICAgICAgICAgY29uc3QgZHJhd0NhbGxzID0gdGhpcy5zY2VuZS5kcmF3Q2FsbHM7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZU1lc2hJbnN0YW5jZXMgPSBub2RlLm1vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbHNbaV0uX3N0YXRpY1NvdXJjZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub2RlTWVzaEluc3RhbmNlcy5pbmRleE9mKGRyYXdDYWxsc1tpXS5fc3RhdGljU291cmNlKSA8IDApIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBhcnIucHVzaChkcmF3Q2FsbHNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVNZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbHMuaW5kZXhPZihub2RlTWVzaEluc3RhbmNlc1tpXSkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyLnB1c2gobm9kZU1lc2hJbnN0YW5jZXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhcnIgPSBncm91cE1lc2hJbnN0YW5jZXNbbm9kZS5tb2RlbC5iYXRjaEdyb3VwSWRdID0gYXJyLmNvbmNhdChub2RlLm1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub2RlLm1vZGVsLnJlbW92ZU1vZGVsRnJvbUxheWVycygpO1xuXG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICBub2RlLm1vZGVsLl9iYXRjaEdyb3VwID0gZ3JvdXA7XG4gICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgfVxuXG4gICAgX2V4dHJhY3RFbGVtZW50KG5vZGUsIGFyciwgZ3JvdXApIHtcbiAgICAgICAgaWYgKCFub2RlLmVsZW1lbnQpIHJldHVybjtcbiAgICAgICAgbGV0IHZhbGlkID0gZmFsc2U7XG4gICAgICAgIGlmIChub2RlLmVsZW1lbnQuX3RleHQgJiYgbm9kZS5lbGVtZW50Ll90ZXh0Ll9tb2RlbC5tZXNoSW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGFyci5wdXNoKG5vZGUuZWxlbWVudC5fdGV4dC5fbW9kZWwubWVzaEluc3RhbmNlc1swXSk7XG4gICAgICAgICAgICBub2RlLmVsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKG5vZGUuZWxlbWVudC5fdGV4dC5fbW9kZWwpO1xuXG4gICAgICAgICAgICB2YWxpZCA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZS5lbGVtZW50Ll9pbWFnZSkge1xuICAgICAgICAgICAgYXJyLnB1c2gobm9kZS5lbGVtZW50Ll9pbWFnZS5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgbm9kZS5lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyhub2RlLmVsZW1lbnQuX2ltYWdlLl9yZW5kZXJhYmxlLm1vZGVsKTtcblxuICAgICAgICAgICAgaWYgKG5vZGUuZWxlbWVudC5faW1hZ2UuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgYXJyLnB1c2gobm9kZS5lbGVtZW50Ll9pbWFnZS5fcmVuZGVyYWJsZS51bm1hc2tNZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZS5lbGVtZW50Ll9pbWFnZS5fcmVuZGVyYWJsZS51bm1hc2tNZXNoSW5zdGFuY2Uuc3RlbmNpbEZyb250IHx8XG4gICAgICAgICAgICAgICAgICAgICFub2RlLmVsZW1lbnQuX2ltYWdlLl9yZW5kZXJhYmxlLnVubWFza01lc2hJbnN0YW5jZS5zdGVuY2lsQmFjaykge1xuICAgICAgICAgICAgICAgICAgICBub2RlLmVsZW1lbnQuX2RpcnRpZnlNYXNrKCk7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUuZWxlbWVudC5fb25QcmVyZW5kZXIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhbGlkID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICAgICAgZ3JvdXAuX3VpID0gdHJ1ZTtcbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIG5vZGUuZWxlbWVudC5fYmF0Y2hHcm91cCA9IGdyb3VwO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB0cmF2ZXJzZSBzY2VuZSBoaWVyYXJjaHkgZG93biBmcm9tIGBub2RlYCBhbmQgY29sbGVjdCBhbGwgY29tcG9uZW50cyB0aGF0IGFyZSBtYXJrZWRcbiAgICAvLyB3aXRoIGEgYmF0Y2ggZ3JvdXAgaWQuIFJlbW92ZSBmcm9tIGxheWVycyBhbnkgbW9kZWxzIHRoYXQgdGhlc2UgY29tcG9uZW50cyBjb250YWlucy5cbiAgICAvLyBGaWxsIHRoZSBgZ3JvdXBNZXNoSW5zdGFuY2VzYCB3aXRoIGFsbCB0aGUgbWVzaCBpbnN0YW5jZXMgdG8gYmUgaW5jbHVkZWQgaW4gdGhlIGJhdGNoIGdyb3VwcyxcbiAgICAvLyBpbmRleGVkIGJ5IGJhdGNoIGdyb3VwIGlkLlxuICAgIF9jb2xsZWN0QW5kUmVtb3ZlTWVzaEluc3RhbmNlcyhncm91cE1lc2hJbnN0YW5jZXMsIGdyb3VwSWRzKSB7XG4gICAgICAgIGZvciAobGV0IGcgPSAwOyBnIDwgZ3JvdXBJZHMubGVuZ3RoOyBnKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gZ3JvdXBJZHNbZ107XG4gICAgICAgICAgICBjb25zdCBncm91cCA9IHRoaXMuX2JhdGNoR3JvdXBzW2lkXTtcbiAgICAgICAgICAgIGlmICghZ3JvdXApIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IGFyciA9IGdyb3VwTWVzaEluc3RhbmNlc1tpZF07XG4gICAgICAgICAgICBpZiAoIWFycikgYXJyID0gZ3JvdXBNZXNoSW5zdGFuY2VzW2lkXSA9IFtdO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBtID0gMDsgbSA8IGdyb3VwLl9vYmoubW9kZWwubGVuZ3RoOyBtKyspIHtcbiAgICAgICAgICAgICAgICBhcnIgPSB0aGlzLl9leHRyYWN0TW9kZWwoZ3JvdXAuX29iai5tb2RlbFttXSwgYXJyLCBncm91cCwgZ3JvdXBNZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgciA9IDA7IHIgPCBncm91cC5fb2JqLnJlbmRlci5sZW5ndGg7IHIrKykge1xuICAgICAgICAgICAgICAgIGFyciA9IHRoaXMuX2V4dHJhY3RSZW5kZXIoZ3JvdXAuX29iai5yZW5kZXJbcl0sIGFyciwgZ3JvdXAsIGdyb3VwTWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGUgPSAwOyBlIDwgZ3JvdXAuX29iai5lbGVtZW50Lmxlbmd0aDsgZSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZXh0cmFjdEVsZW1lbnQoZ3JvdXAuX29iai5lbGVtZW50W2VdLCBhcnIsIGdyb3VwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgcyA9IDA7IHMgPCBncm91cC5fb2JqLnNwcml0ZS5sZW5ndGg7IHMrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBncm91cC5fb2JqLnNwcml0ZVtzXTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5zcHJpdGUgJiYgbm9kZS5zcHJpdGUuX21lc2hJbnN0YW5jZSAmJlxuICAgICAgICAgICAgICAgICAgICAoZ3JvdXAuZHluYW1pYyB8fCBub2RlLnNwcml0ZS5zcHJpdGUuX3JlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSkpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJyLnB1c2gobm9kZS5zcHJpdGUuX21lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUuc3ByaXRlLnJlbW92ZU1vZGVsRnJvbUxheWVycygpO1xuICAgICAgICAgICAgICAgICAgICBncm91cC5fc3ByaXRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5zcHJpdGUuX2JhdGNoR3JvdXAgPSBncm91cDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyBhbGwgYmF0Y2hlcyBhbmQgY3JlYXRlcyBuZXcgYmFzZWQgb24gc2NlbmUgbW9kZWxzLiBIaWRlcyBvcmlnaW5hbCBtb2RlbHMuIENhbGxlZCBieVxuICAgICAqIGVuZ2luZSBhdXRvbWF0aWNhbGx5IG9uIGFwcCBzdGFydCwgYW5kIGlmIGJhdGNoR3JvdXBJZHMgb24gbW9kZWxzIGFyZSBjaGFuZ2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gW2dyb3VwSWRzXSAtIE9wdGlvbmFsIGFycmF5IG9mIGJhdGNoIGdyb3VwIElEcyB0byB1cGRhdGUuIE90aGVyd2lzZSBhbGxcbiAgICAgKiBncm91cHMgYXJlIHVwZGF0ZWQuXG4gICAgICovXG4gICAgZ2VuZXJhdGUoZ3JvdXBJZHMpIHtcbiAgICAgICAgY29uc3QgZ3JvdXBNZXNoSW5zdGFuY2VzID0ge307XG5cbiAgICAgICAgaWYgKCFncm91cElkcykge1xuICAgICAgICAgICAgLy8gRnVsbCBzY2VuZVxuICAgICAgICAgICAgZ3JvdXBJZHMgPSBPYmplY3Qua2V5cyh0aGlzLl9iYXRjaEdyb3Vwcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZWxldGUgb2xkIGJhdGNoZXMgd2l0aCBtYXRjaGluZyBiYXRjaEdyb3VwSWRcbiAgICAgICAgY29uc3QgbmV3QmF0Y2hMaXN0ID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fYmF0Y2hMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoZ3JvdXBJZHMuaW5kZXhPZih0aGlzLl9iYXRjaExpc3RbaV0uYmF0Y2hHcm91cElkKSA8IDApIHtcbiAgICAgICAgICAgICAgICBuZXdCYXRjaExpc3QucHVzaCh0aGlzLl9iYXRjaExpc3RbaV0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5kZXN0cm95QmF0Y2godGhpcy5fYmF0Y2hMaXN0W2ldKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9iYXRjaExpc3QgPSBuZXdCYXRjaExpc3Q7XG5cbiAgICAgICAgLy8gY29sbGVjdFxuICAgICAgICB0aGlzLl9jb2xsZWN0QW5kUmVtb3ZlTWVzaEluc3RhbmNlcyhncm91cE1lc2hJbnN0YW5jZXMsIGdyb3VwSWRzKTtcblxuICAgICAgICBpZiAoZ3JvdXBJZHMgPT09IHRoaXMuX2RpcnR5R3JvdXBzKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUdyb3Vwcy5sZW5ndGggPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgbmV3RGlydHlHcm91cHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fZGlydHlHcm91cHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoZ3JvdXBJZHMuaW5kZXhPZih0aGlzLl9kaXJ0eUdyb3Vwc1tpXSkgPCAwKSBuZXdEaXJ0eUdyb3Vwcy5wdXNoKHRoaXMuX2RpcnR5R3JvdXBzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5R3JvdXBzID0gbmV3RGlydHlHcm91cHM7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZ3JvdXAsIGxpc3RzLCBncm91cERhdGEsIGJhdGNoO1xuICAgICAgICBmb3IgKGNvbnN0IGdyb3VwSWQgaW4gZ3JvdXBNZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBpZiAoIWdyb3VwTWVzaEluc3RhbmNlcy5oYXNPd25Qcm9wZXJ0eShncm91cElkKSkgY29udGludWU7XG4gICAgICAgICAgICBncm91cCA9IGdyb3VwTWVzaEluc3RhbmNlc1tncm91cElkXTtcblxuICAgICAgICAgICAgZ3JvdXBEYXRhID0gdGhpcy5fYmF0Y2hHcm91cHNbZ3JvdXBJZF07XG4gICAgICAgICAgICBpZiAoIWdyb3VwRGF0YSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBiYXRjaCBncm91cCAke2dyb3VwSWR9IG5vdCBmb3VuZGApO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsaXN0cyA9IHRoaXMucHJlcGFyZShncm91cCwgZ3JvdXBEYXRhLmR5bmFtaWMsIGdyb3VwRGF0YS5tYXhBYWJiU2l6ZSwgZ3JvdXBEYXRhLl91aSB8fCBncm91cERhdGEuX3Nwcml0ZSk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYmF0Y2ggPSB0aGlzLmNyZWF0ZShsaXN0c1tpXSwgZ3JvdXBEYXRhLmR5bmFtaWMsIHBhcnNlSW50KGdyb3VwSWQsIDEwKSk7XG4gICAgICAgICAgICAgICAgaWYgKGJhdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgIGJhdGNoLmFkZFRvTGF5ZXJzKHRoaXMuc2NlbmUsIGdyb3VwRGF0YS5sYXllcnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogVGFrZXMgYSBsaXN0IG9mIG1lc2ggaW5zdGFuY2VzIHRvIGJlIGJhdGNoZWQgYW5kIHNvcnRzIHRoZW0gaW50byBsaXN0cyBvbmUgZm9yIGVhY2ggZHJhd1xuICAgICAqIGNhbGwuIFRoZSBpbnB1dCBsaXN0IHdpbGwgYmUgc3BsaXQsIGlmOlxuICAgICAqXG4gICAgICogLSBNZXNoIGluc3RhbmNlcyB1c2UgZGlmZmVyZW50IG1hdGVyaWFscy5cbiAgICAgKiAtIE1lc2ggaW5zdGFuY2VzIGhhdmUgZGlmZmVyZW50IHBhcmFtZXRlcnMgKGUuZy4gbGlnaHRtYXBzIG9yIHN0YXRpYyBsaWdodHMpLlxuICAgICAqIC0gTWVzaCBpbnN0YW5jZXMgaGF2ZSBkaWZmZXJlbnQgc2hhZGVyIGRlZmluZXMgKHNoYWRvdyByZWNlaXZpbmcsIGJlaW5nIGFsaWduZWQgdG8gc2NyZWVuXG4gICAgICogc3BhY2UsIGV0YykuXG4gICAgICogLSBUb28gbWFueSB2ZXJ0aWNlcyBmb3IgYSBzaW5nbGUgYmF0Y2ggKDY1NTM1IGlzIG1heGltdW0pLlxuICAgICAqIC0gVG9vIG1hbnkgaW5zdGFuY2VzIGZvciBhIHNpbmdsZSBiYXRjaCAoaGFyZHdhcmUtZGVwZW5kZW50LCBleHBlY3QgMTI4IG9uIGxvdy1lbmQgYW5kIDEwMjRcbiAgICAgKiBvbiBoaWdoLWVuZCkuXG4gICAgICogLSBCb3VuZGluZyBib3ggb2YgYSBiYXRjaCBpcyBsYXJnZXIgdGhhbiBtYXhBYWJiU2l6ZSBpbiBhbnkgZGltZW5zaW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNZXNoSW5zdGFuY2VbXX0gbWVzaEluc3RhbmNlcyAtIElucHV0IGxpc3Qgb2YgbWVzaCBpbnN0YW5jZXNcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGR5bmFtaWMgLSBBcmUgd2UgcHJlcGFyaW5nIGZvciBhIGR5bmFtaWMgYmF0Y2g/IEluc3RhbmNlIGNvdW50IHdpbGwgbWF0dGVyXG4gICAgICogdGhlbiAob3RoZXJ3aXNlIG5vdCkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heEFhYmJTaXplIC0gTWF4aW11bSBzaXplIG9mIGFueSBkaW1lbnNpb24gb2YgYSBib3VuZGluZyBib3ggYXJvdW5kIGJhdGNoZWRcbiAgICAgKiBvYmplY3RzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdHJhbnNsdWNlbnQgLSBBcmUgd2UgYmF0Y2hpbmcgVUkgZWxlbWVudHMgb3Igc3ByaXRlc1xuICAgICAqIFRoaXMgaXMgdXNlZnVsIHRvIGtlZXAgYSBiYWxhbmNlIGJldHdlZW4gdGhlIG51bWJlciBvZiBkcmF3IGNhbGxzIGFuZCB0aGUgbnVtYmVyIG9mIGRyYXduXG4gICAgICogdHJpYW5nbGVzLCBiZWNhdXNlIHNtYWxsZXIgYmF0Y2hlcyBjYW4gYmUgaGlkZGVuIHdoZW4gbm90IHZpc2libGUgaW4gY2FtZXJhLlxuICAgICAqIEByZXR1cm5zIHtNZXNoSW5zdGFuY2VbXVtdfSBBbiBhcnJheSBvZiBhcnJheXMgb2YgbWVzaCBpbnN0YW5jZXMsIGVhY2ggdmFsaWQgdG8gcGFzcyB0b1xuICAgICAqIHtAbGluayBCYXRjaE1hbmFnZXIjY3JlYXRlfS5cbiAgICAgKi9cbiAgICBwcmVwYXJlKG1lc2hJbnN0YW5jZXMsIGR5bmFtaWMsIG1heEFhYmJTaXplID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLCB0cmFuc2x1Y2VudCkge1xuICAgICAgICBpZiAobWVzaEluc3RhbmNlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcbiAgICAgICAgY29uc3QgaGFsZk1heEFhYmJTaXplID0gbWF4QWFiYlNpemUgKiAwLjU7XG4gICAgICAgIGNvbnN0IG1heEluc3RhbmNlQ291bnQgPSB0aGlzLmRldmljZS5zdXBwb3J0c0JvbmVUZXh0dXJlcyA/IDEwMjQgOiB0aGlzLmRldmljZS5ib25lTGltaXQ7XG5cbiAgICAgICAgLy8gbWF4aW11bSBudW1iZXIgb2YgdmVydGljZXMgdGhhdCBjYW4gYmUgdXNlZCBpbiBiYXRjaCBkZXBlbmRzIG9uIDMyYml0IGluZGV4IGJ1ZmZlciBzdXBwb3J0IChkbyB0aGlzIGZvciBub24taW5kZXhlZCBhcyB3ZWxsLFxuICAgICAgICAvLyBhcyBpbiBzb21lIGNhc2VzIChVSSBlbGVtZW50cykgbm9uLWluZGV4ZWQgZ2VvbWV0cnkgZ2V0cyBiYXRjaGVkIGludG8gaW5kZXhlZClcbiAgICAgICAgY29uc3QgbWF4TnVtVmVydGljZXMgPSB0aGlzLmRldmljZS5leHRVaW50RWxlbWVudCA/IDB4ZmZmZmZmZmYgOiAweGZmZmY7XG5cbiAgICAgICAgY29uc3QgYWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICBjb25zdCB0ZXN0QWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuICAgICAgICBsZXQgc2tpcFRyYW5zbHVjZW50QWFiYiA9IG51bGw7XG4gICAgICAgIGxldCBzZjtcblxuICAgICAgICBjb25zdCBsaXN0cyA9IFtdO1xuICAgICAgICBsZXQgaiA9IDA7XG4gICAgICAgIGlmICh0cmFuc2x1Y2VudCkge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlcy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGEuZHJhd09yZGVyIC0gYi5kcmF3T3JkZXI7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgbWVzaEluc3RhbmNlc0xlZnRBID0gbWVzaEluc3RhbmNlcztcbiAgICAgICAgbGV0IG1lc2hJbnN0YW5jZXNMZWZ0QjtcblxuICAgICAgICBjb25zdCBza2lwTWVzaCA9IHRyYW5zbHVjZW50ID8gZnVuY3Rpb24gKG1pKSB7XG4gICAgICAgICAgICBpZiAoc2tpcFRyYW5zbHVjZW50QWFiYikge1xuICAgICAgICAgICAgICAgIHNraXBUcmFuc2x1Y2VudEFhYmIuYWRkKG1pLmFhYmIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBza2lwVHJhbnNsdWNlbnRBYWJiID0gbWkuYWFiYi5jbG9uZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWVzaEluc3RhbmNlc0xlZnRCLnB1c2gobWkpO1xuICAgICAgICB9IDogZnVuY3Rpb24gKG1pKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzTGVmdEIucHVzaChtaSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgd2hpbGUgKG1lc2hJbnN0YW5jZXNMZWZ0QS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsaXN0c1tqXSA9IFttZXNoSW5zdGFuY2VzTGVmdEFbMF1dO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc0xlZnRCID0gW107XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5tYXRlcmlhbDtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLmxheWVyO1xuICAgICAgICAgICAgY29uc3QgZGVmcyA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5fc2hhZGVyRGVmcztcbiAgICAgICAgICAgIGNvbnN0IHBhcmFtcyA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5wYXJhbWV0ZXJzO1xuICAgICAgICAgICAgY29uc3Qgc3RlbmNpbCA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5zdGVuY2lsRnJvbnQ7XG4gICAgICAgICAgICBjb25zdCBsaWdodExpc3QgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0uX3N0YXRpY0xpZ2h0TGlzdDtcbiAgICAgICAgICAgIGxldCB2ZXJ0Q291bnQgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0ubWVzaC52ZXJ0ZXhCdWZmZXIuZ2V0TnVtVmVydGljZXMoKTtcbiAgICAgICAgICAgIGNvbnN0IGRyYXdPcmRlciA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5kcmF3T3JkZXI7XG4gICAgICAgICAgICBhYWJiLmNvcHkobWVzaEluc3RhbmNlc0xlZnRBWzBdLmFhYmIpO1xuICAgICAgICAgICAgY29uc3Qgc2NhbGVTaWduID0gZ2V0U2NhbGVTaWduKG1lc2hJbnN0YW5jZXNMZWZ0QVswXSk7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhGb3JtYXRCYXRjaGluZ0hhc2ggPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0ubWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmJhdGNoaW5nSGFzaDtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ZWQgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0ubWVzaC5wcmltaXRpdmVbMF0uaW5kZXhlZDtcbiAgICAgICAgICAgIHNraXBUcmFuc2x1Y2VudEFhYmIgPSBudWxsO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMTsgaSA8IG1lc2hJbnN0YW5jZXNMZWZ0QS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gbWVzaEluc3RhbmNlc0xlZnRBW2ldO1xuXG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgYnkgaW5zdGFuY2UgbnVtYmVyXG4gICAgICAgICAgICAgICAgaWYgKGR5bmFtaWMgJiYgbGlzdHNbal0ubGVuZ3RoID49IG1heEluc3RhbmNlQ291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc0xlZnRCID0gbWVzaEluc3RhbmNlc0xlZnRCLmNvbmNhdChtZXNoSW5zdGFuY2VzTGVmdEEuc2xpY2UoaSkpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBieSBtYXRlcmlhbCwgbGF5ZXIgKGxlZ2FjeSksIHZlcnRleCBmb3JtYXQgJiBpbmRleCBjb21wYXRpYmlsaXR5LCBzaGFkZXIgZGVmaW5lcywgc3RhdGljIHNvdXJjZSwgdmVydCBjb3VudCwgb3ZlcmxhcHBpbmcgVUlcbiAgICAgICAgICAgICAgICBpZiAoKG1hdGVyaWFsICE9PSBtaS5tYXRlcmlhbCkgfHxcbiAgICAgICAgICAgICAgICAgICAgKGxheWVyICE9PSBtaS5sYXllcikgfHxcbiAgICAgICAgICAgICAgICAgICAgKHZlcnRleEZvcm1hdEJhdGNoaW5nSGFzaCAhPT0gbWkubWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmJhdGNoaW5nSGFzaCkgfHxcbiAgICAgICAgICAgICAgICAgICAgKGluZGV4ZWQgIT09IG1pLm1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQpIHx8XG4gICAgICAgICAgICAgICAgICAgIChkZWZzICE9PSBtaS5fc2hhZGVyRGVmcykgfHxcbiAgICAgICAgICAgICAgICAgICAgKHZlcnRDb3VudCArIG1pLm1lc2gudmVydGV4QnVmZmVyLmdldE51bVZlcnRpY2VzKCkgPiBtYXhOdW1WZXJ0aWNlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgYnkgQUFCQlxuICAgICAgICAgICAgICAgIHRlc3RBYWJiLmNvcHkoYWFiYik7XG4gICAgICAgICAgICAgICAgdGVzdEFhYmIuYWRkKG1pLmFhYmIpO1xuICAgICAgICAgICAgICAgIGlmICh0ZXN0QWFiYi5oYWxmRXh0ZW50cy54ID4gaGFsZk1heEFhYmJTaXplIHx8XG4gICAgICAgICAgICAgICAgICAgIHRlc3RBYWJiLmhhbGZFeHRlbnRzLnkgPiBoYWxmTWF4QWFiYlNpemUgfHxcbiAgICAgICAgICAgICAgICAgICAgdGVzdEFhYmIuaGFsZkV4dGVudHMueiA+IGhhbGZNYXhBYWJiU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICBza2lwTWVzaChtaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBzdGVuY2lsIG1hc2sgKFVJIGVsZW1lbnRzKSwgYm90aCBmcm9udCBhbmQgYmFjayBleHBlY3RlZCB0byBiZSB0aGUgc2FtZVxuICAgICAgICAgICAgICAgIGlmIChzdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghKHNmID0gbWkuc3RlbmNpbEZyb250KSB8fCBzdGVuY2lsLmZ1bmMgIT09IHNmLmZ1bmMgfHwgc3RlbmNpbC56cGFzcyAhPT0gc2YuenBhc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IG5lZ2F0aXZlIHNjYWxlXG4gICAgICAgICAgICAgICAgaWYgKHNjYWxlU2lnbiAhPT0gZ2V0U2NhbGVTaWduKG1pKSkge1xuICAgICAgICAgICAgICAgICAgICBza2lwTWVzaChtaSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IHBhcmFtZXRlcnNcbiAgICAgICAgICAgICAgICBpZiAoIWVxdWFsUGFyYW1TZXRzKHBhcmFtcywgbWkucGFyYW1ldGVycykpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgYnkgc3RhdGljIGxpZ2h0IGxpc3RcbiAgICAgICAgICAgICAgICBjb25zdCBzdGF0aWNMaWdodHMgPSBtaS5fc3RhdGljTGlnaHRMaXN0O1xuICAgICAgICAgICAgICAgIGlmIChsaWdodExpc3QgJiYgc3RhdGljTGlnaHRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXF1YWxMaWdodExpc3RzKGxpZ2h0TGlzdCwgc3RhdGljTGlnaHRzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxpZ2h0TGlzdCB8fCBzdGF0aWNMaWdodHMpIHsgLy8gU3BsaXQgYnkgc3RhdGljL25vbiBzdGF0aWNcbiAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHJhbnNsdWNlbnQgJiYgc2tpcFRyYW5zbHVjZW50QWFiYiAmJiBza2lwVHJhbnNsdWNlbnRBYWJiLmludGVyc2VjdHMobWkuYWFiYikgJiYgbWkuZHJhd09yZGVyICE9PSBkcmF3T3JkZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhYWJiLmFkZChtaS5hYWJiKTtcbiAgICAgICAgICAgICAgICB2ZXJ0Q291bnQgKz0gbWkubWVzaC52ZXJ0ZXhCdWZmZXIuZ2V0TnVtVmVydGljZXMoKTtcbiAgICAgICAgICAgICAgICBsaXN0c1tqXS5wdXNoKG1pKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaisrO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc0xlZnRBID0gbWVzaEluc3RhbmNlc0xlZnRCO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxpc3RzO1xuICAgIH1cblxuICAgIGNvbGxlY3RCYXRjaGVkTWVzaERhdGEobWVzaEluc3RhbmNlcywgZHluYW1pYykge1xuXG4gICAgICAgIGxldCBzdHJlYW1zID0gbnVsbDtcbiAgICAgICAgbGV0IGJhdGNoTnVtVmVydHMgPSAwO1xuICAgICAgICBsZXQgYmF0Y2hOdW1JbmRpY2VzID0gMDtcbiAgICAgICAgbGV0IG1hdGVyaWFsID0gbnVsbDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2VzW2ldLnZpc2libGUpIHtcblxuICAgICAgICAgICAgICAgIC8vIHZlcnRleCBjb3VudHNcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gbWVzaEluc3RhbmNlc1tpXS5tZXNoO1xuICAgICAgICAgICAgICAgIGNvbnN0IG51bVZlcnRzID0gbWVzaC52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICAgICAgYmF0Y2hOdW1WZXJ0cyArPSBudW1WZXJ0cztcblxuICAgICAgICAgICAgICAgIC8vIGluZGV4IGNvdW50cyAoaGFuZGxlcyBzcGVjaWFsIGNhc2Ugb2YgVFJJLUZBTi10eXBlIG5vbi1pbmRleGVkIHByaW1pdGl2ZSB1c2VkIGJ5IFVJKVxuICAgICAgICAgICAgICAgIGJhdGNoTnVtSW5kaWNlcyArPSBtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkID8gbWVzaC5wcmltaXRpdmVbMF0uY291bnQgOlxuICAgICAgICAgICAgICAgICAgICAobWVzaC5wcmltaXRpdmVbMF0udHlwZSA9PT0gUFJJTUlUSVZFX1RSSUZBTiAmJiBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9PT0gNCA/IDYgOiAwKTtcblxuICAgICAgICAgICAgICAgIC8vIGlmIGZpcnN0IG1lc2hcbiAgICAgICAgICAgICAgICBpZiAoIXN0cmVhbXMpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBtYXRlcmlhbFxuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbCA9IG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWw7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29sbGVjdCB1c2VkIHZlcnRleCBidWZmZXIgc2VtYW50aWMgaW5mb3JtYXRpb24gZnJvbSBmaXJzdCBtZXNoICh0aGV5IGFsbCBtYXRjaClcbiAgICAgICAgICAgICAgICAgICAgc3RyZWFtcyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbGVtcyA9IG1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cztcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBlbGVtcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBlbGVtc1tqXS5uYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtc1tzZW1hbnRpY10gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtQ29tcG9uZW50czogZWxlbXNbal0ubnVtQ29tcG9uZW50cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhVHlwZTogZWxlbXNbal0uZGF0YVR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplOiBlbGVtc1tqXS5ub3JtYWxpemUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY291bnQ6IDBcbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBmb3IgZHluYW1pYyBtZXNoZXMgd2UgbmVlZCBib25lIGluZGljZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKGR5bmFtaWMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cmVhbXNbU0VNQU5USUNfQkxFTkRJTkRJQ0VTXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1Db21wb25lbnRzOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiBUWVBFX0ZMT0FUMzIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9ybWFsaXplOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogMFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdHJlYW1zOiBzdHJlYW1zLFxuICAgICAgICAgICAgYmF0Y2hOdW1WZXJ0czogYmF0Y2hOdW1WZXJ0cyxcbiAgICAgICAgICAgIGJhdGNoTnVtSW5kaWNlczogYmF0Y2hOdW1JbmRpY2VzLFxuICAgICAgICAgICAgbWF0ZXJpYWw6IG1hdGVyaWFsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGFrZXMgYSBtZXNoIGluc3RhbmNlIGxpc3QgdGhhdCBoYXMgYmVlbiBwcmVwYXJlZCBieSB7QGxpbmsgQmF0Y2hNYW5hZ2VyI3ByZXBhcmV9LCBhbmRcbiAgICAgKiByZXR1cm5zIGEge0BsaW5rIEJhdGNofSBvYmplY3QuIFRoaXMgbWV0aG9kIGFzc3VtZXMgdGhhdCBhbGwgbWVzaCBpbnN0YW5jZXMgcHJvdmlkZWQgY2FuIGJlXG4gICAgICogcmVuZGVyZWQgaW4gYSBzaW5nbGUgZHJhdyBjYWxsLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNZXNoSW5zdGFuY2VbXX0gbWVzaEluc3RhbmNlcyAtIElucHV0IGxpc3Qgb2YgbWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBkeW5hbWljIC0gSXMgaXQgYSBzdGF0aWMgb3IgZHluYW1pYyBiYXRjaD8gV2lsbCBvYmplY3RzIGJlIHRyYW5zZm9ybWVkXG4gICAgICogYWZ0ZXIgYmF0Y2hpbmc/XG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtiYXRjaEdyb3VwSWRdIC0gTGluayB0aGlzIGJhdGNoIHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAuIFRoaXMgaXMgZG9uZVxuICAgICAqIGF1dG9tYXRpY2FsbHkgd2l0aCBkZWZhdWx0IGJhdGNoZXMuXG4gICAgICogQHJldHVybnMge0JhdGNofSBUaGUgcmVzdWx0aW5nIGJhdGNoIG9iamVjdC5cbiAgICAgKi9cbiAgICBjcmVhdGUobWVzaEluc3RhbmNlcywgZHluYW1pYywgYmF0Y2hHcm91cElkKSB7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBjb25zdCB0aW1lID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmICghdGhpcy5faW5pdCkge1xuICAgICAgICAgICAgY29uc3QgYm9uZUxpbWl0ID0gJyNkZWZpbmUgQk9ORV9MSU1JVCAnICsgdGhpcy5kZXZpY2UuZ2V0Qm9uZUxpbWl0KCkgKyAnXFxuJztcbiAgICAgICAgICAgIHRoaXMudHJhbnNmb3JtVlMgPSBib25lTGltaXQgKyAnI2RlZmluZSBEWU5BTUlDQkFUQ0hcXG4nICsgc2hhZGVyQ2h1bmtzLnRyYW5zZm9ybVZTO1xuICAgICAgICAgICAgdGhpcy5za2luVGV4VlMgPSBzaGFkZXJDaHVua3Muc2tpbkJhdGNoVGV4VlM7XG4gICAgICAgICAgICB0aGlzLnNraW5Db25zdFZTID0gc2hhZGVyQ2h1bmtzLnNraW5CYXRjaENvbnN0VlM7XG4gICAgICAgICAgICB0aGlzLnZlcnRleEZvcm1hdHMgPSB7fTtcbiAgICAgICAgICAgIHRoaXMuX2luaXQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHN0cmVhbSA9IG51bGw7XG4gICAgICAgIGxldCBzZW1hbnRpYztcbiAgICAgICAgbGV0IG1lc2gsIG51bVZlcnRzO1xuICAgICAgICBsZXQgYmF0Y2ggPSBudWxsO1xuXG4gICAgICAgIC8vIGZpbmQgb3V0IHZlcnRleCBzdHJlYW1zIGFuZCBjb3VudHNcbiAgICAgICAgY29uc3QgYmF0Y2hEYXRhID0gdGhpcy5jb2xsZWN0QmF0Y2hlZE1lc2hEYXRhKG1lc2hJbnN0YW5jZXMsIGR5bmFtaWMpO1xuXG4gICAgICAgIC8vIGlmIGFueXRoaW5nIHRvIGJhdGNoXG4gICAgICAgIGlmIChiYXRjaERhdGEuc3RyZWFtcykge1xuXG4gICAgICAgICAgICBjb25zdCBzdHJlYW1zID0gYmF0Y2hEYXRhLnN0cmVhbXM7XG4gICAgICAgICAgICBsZXQgbWF0ZXJpYWwgPSBiYXRjaERhdGEubWF0ZXJpYWw7XG4gICAgICAgICAgICBjb25zdCBiYXRjaE51bVZlcnRzID0gYmF0Y2hEYXRhLmJhdGNoTnVtVmVydHM7XG4gICAgICAgICAgICBjb25zdCBiYXRjaE51bUluZGljZXMgPSBiYXRjaERhdGEuYmF0Y2hOdW1JbmRpY2VzO1xuXG4gICAgICAgICAgICBiYXRjaCA9IG5ldyBCYXRjaChtZXNoSW5zdGFuY2VzLCBkeW5hbWljLCBiYXRjaEdyb3VwSWQpO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hMaXN0LnB1c2goYmF0Y2gpO1xuXG4gICAgICAgICAgICBsZXQgaW5kZXhCYXNlLCBudW1JbmRpY2VzLCBpbmRleERhdGE7XG4gICAgICAgICAgICBsZXQgdmVydGljZXNPZmZzZXQgPSAwO1xuICAgICAgICAgICAgbGV0IGluZGV4T2Zmc2V0ID0gMDtcbiAgICAgICAgICAgIGxldCB0cmFuc2Zvcm07XG4gICAgICAgICAgICBjb25zdCB2ZWMgPSBuZXcgVmVjMygpO1xuXG4gICAgICAgICAgICAvLyBhbGxvY2F0ZSBpbmRpY2VzXG4gICAgICAgICAgICBjb25zdCBpbmRleEFycmF5VHlwZSA9IGJhdGNoTnVtVmVydHMgPD0gMHhmZmZmID8gVWludDE2QXJyYXkgOiBVaW50MzJBcnJheTtcbiAgICAgICAgICAgIGNvbnN0IGluZGljZXMgPSBuZXcgaW5kZXhBcnJheVR5cGUoYmF0Y2hOdW1JbmRpY2VzKTtcblxuICAgICAgICAgICAgLy8gYWxsb2NhdGUgdHlwZWQgYXJyYXlzIHRvIHN0b3JlIGZpbmFsIHZlcnRleCBzdHJlYW0gZGF0YVxuICAgICAgICAgICAgZm9yIChzZW1hbnRpYyBpbiBzdHJlYW1zKSB7XG4gICAgICAgICAgICAgICAgc3RyZWFtID0gc3RyZWFtc1tzZW1hbnRpY107XG4gICAgICAgICAgICAgICAgc3RyZWFtLnR5cGVBcnJheVR5cGUgPSB0eXBlZEFycmF5VHlwZXNbc3RyZWFtLmRhdGFUeXBlXTtcbiAgICAgICAgICAgICAgICBzdHJlYW0uZWxlbWVudEJ5dGVTaXplID0gdHlwZWRBcnJheVR5cGVzQnl0ZVNpemVbc3RyZWFtLmRhdGFUeXBlXTtcbiAgICAgICAgICAgICAgICBzdHJlYW0uYnVmZmVyID0gbmV3IHN0cmVhbS50eXBlQXJyYXlUeXBlKGJhdGNoTnVtVmVydHMgKiBzdHJlYW0ubnVtQ29tcG9uZW50cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGJ1aWxkIHZlcnRleCBhbmQgaW5kZXggZGF0YSBmb3IgZmluYWwgbWVzaFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtZXNoSW5zdGFuY2VzW2ldLnZpc2libGUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgbWVzaCA9IG1lc2hJbnN0YW5jZXNbaV0ubWVzaDtcbiAgICAgICAgICAgICAgICBudW1WZXJ0cyA9IG1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuXG4gICAgICAgICAgICAgICAgLy8gbWF0cml4IHRvIHRyYW5zZm9ybSB2ZXJ0aWNlcyB0byB3b3JsZCBzcGFjZSBmb3Igc3RhdGljIGJhdGNoaW5nXG4gICAgICAgICAgICAgICAgaWYgKCFkeW5hbWljKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybSA9IG1lc2hJbnN0YW5jZXNbaV0ubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAoc2VtYW50aWMgaW4gc3RyZWFtcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2VtYW50aWMgIT09IFNFTUFOVElDX0JMRU5ESU5ESUNFUykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtID0gc3RyZWFtc1tzZW1hbnRpY107XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGdldCB2ZXJ0ZXggc3RyZWFtIHRvIHR5cGVkIHZpZXcgc3ViYXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YmFycmF5ID0gbmV3IHN0cmVhbS50eXBlQXJyYXlUeXBlKHN0cmVhbS5idWZmZXIuYnVmZmVyLCBzdHJlYW0uZWxlbWVudEJ5dGVTaXplICogc3RyZWFtLmNvdW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvdGFsQ29tcG9uZW50cyA9IG1lc2guZ2V0VmVydGV4U3RyZWFtKHNlbWFudGljLCBzdWJhcnJheSkgKiBzdHJlYW0ubnVtQ29tcG9uZW50cztcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cmVhbS5jb3VudCArPSB0b3RhbENvbXBvbmVudHM7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRyYW5zZm9ybSBwb3NpdGlvbiwgbm9ybWFsIGFuZCB0YW5nZW50IHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWR5bmFtaWMgJiYgc3RyZWFtLm51bUNvbXBvbmVudHMgPj0gMykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZW1hbnRpYyA9PT0gU0VNQU5USUNfUE9TSVRJT04pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0b3RhbENvbXBvbmVudHM7IGogKz0gc3RyZWFtLm51bUNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlYy5zZXQoc3ViYXJyYXlbal0sIHN1YmFycmF5W2ogKyAxXSwgc3ViYXJyYXlbaiArIDJdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybS50cmFuc2Zvcm1Qb2ludCh2ZWMsIHZlYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqXSA9IHZlYy54O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViYXJyYXlbaiArIDFdID0gdmVjLnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqICsgMl0gPSB2ZWMuejtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2VtYW50aWMgPT09IFNFTUFOVElDX05PUk1BTCB8fCBzZW1hbnRpYyA9PT0gU0VNQU5USUNfVEFOR0VOVCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBub24tdW5pZm9ybSBzY2FsZSBieSB1c2luZyB0cmFuc3Bvc2VkIGludmVyc2UgbWF0cml4IHRvIHRyYW5zZm9ybSB2ZWN0b3JzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybS5pbnZlcnRUbzN4MyhtYXQzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0My50cmFuc3Bvc2UoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRvdGFsQ29tcG9uZW50czsgaiArPSBzdHJlYW0ubnVtQ29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVjLnNldChzdWJhcnJheVtqXSwgc3ViYXJyYXlbaiArIDFdLCBzdWJhcnJheVtqICsgMl0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0My50cmFuc2Zvcm1WZWN0b3IodmVjLCB2ZWMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViYXJyYXlbal0gPSB2ZWMueDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YmFycmF5W2ogKyAxXSA9IHZlYy55O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViYXJyYXlbaiArIDJdID0gdmVjLno7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBib25lIGluZGV4IGlzIG1lc2ggaW5kZXhcbiAgICAgICAgICAgICAgICBpZiAoZHluYW1pYykge1xuICAgICAgICAgICAgICAgICAgICBzdHJlYW0gPSBzdHJlYW1zW1NFTUFOVElDX0JMRU5ESU5ESUNFU107XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVtVmVydHM7IGorKylcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0cmVhbS5idWZmZXJbc3RyZWFtLmNvdW50KytdID0gaTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpbmRleCBidWZmZXJcbiAgICAgICAgICAgICAgICBpZiAobWVzaC5wcmltaXRpdmVbMF0uaW5kZXhlZCkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEJhc2UgPSBtZXNoLnByaW1pdGl2ZVswXS5iYXNlO1xuICAgICAgICAgICAgICAgICAgICBudW1JbmRpY2VzID0gbWVzaC5wcmltaXRpdmVbMF0uY291bnQ7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc291cmNlIGluZGV4IGJ1ZmZlciBkYXRhIG1hcHBlZCB0byBpdHMgZm9ybWF0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNyY0Zvcm1hdCA9IG1lc2guaW5kZXhCdWZmZXJbMF0uZ2V0Rm9ybWF0KCk7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4RGF0YSA9IG5ldyB0eXBlZEFycmF5SW5kZXhGb3JtYXRzW3NyY0Zvcm1hdF0obWVzaC5pbmRleEJ1ZmZlclswXS5zdG9yYWdlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1lc2gucHJpbWl0aXZlWzBdLnR5cGUgPT09IFBSSU1JVElWRV9UUklGQU4gJiYgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPT09IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciBVSSBpbWFnZSBlbGVtZW50c1xuICAgICAgICAgICAgICAgICAgICBpbmRleEJhc2UgPSAwO1xuICAgICAgICAgICAgICAgICAgICBudW1JbmRpY2VzID0gNjtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhEYXRhID0gWzAsIDEsIDMsIDIsIDMsIDFdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSAwO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bUluZGljZXM7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzW2ogKyBpbmRleE9mZnNldF0gPSBpbmRleERhdGFbaW5kZXhCYXNlICsgal0gKyB2ZXJ0aWNlc09mZnNldDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpbmRleE9mZnNldCArPSBudW1JbmRpY2VzO1xuICAgICAgICAgICAgICAgIHZlcnRpY2VzT2Zmc2V0ICs9IG51bVZlcnRzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgbWVzaFxuICAgICAgICAgICAgbWVzaCA9IG5ldyBNZXNoKHRoaXMuZGV2aWNlKTtcbiAgICAgICAgICAgIGZvciAoc2VtYW50aWMgaW4gc3RyZWFtcykge1xuICAgICAgICAgICAgICAgIHN0cmVhbSA9IHN0cmVhbXNbc2VtYW50aWNdO1xuICAgICAgICAgICAgICAgIG1lc2guc2V0VmVydGV4U3RyZWFtKHNlbWFudGljLCBzdHJlYW0uYnVmZmVyLCBzdHJlYW0ubnVtQ29tcG9uZW50cywgdW5kZWZpbmVkLCBzdHJlYW0uZGF0YVR5cGUsIHN0cmVhbS5ub3JtYWxpemUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaW5kaWNlcy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIG1lc2guc2V0SW5kaWNlcyhpbmRpY2VzKTtcblxuICAgICAgICAgICAgbWVzaC51cGRhdGUoUFJJTUlUSVZFX1RSSUFOR0xFUywgZmFsc2UpO1xuXG4gICAgICAgICAgICAvLyBQYXRjaCB0aGUgbWF0ZXJpYWxcbiAgICAgICAgICAgIGlmIChkeW5hbWljKSB7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwgPSBtYXRlcmlhbC5jbG9uZSgpO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy50cmFuc2Zvcm1WUyA9IHRoaXMudHJhbnNmb3JtVlM7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLnNraW5UZXhWUyA9IHRoaXMuc2tpblRleFZTO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5za2luQ29uc3RWUyA9IHRoaXMuc2tpbkNvbnN0VlM7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBtZXNoSW5zdGFuY2VcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaCwgbWF0ZXJpYWwsIHRoaXMucm9vdE5vZGUpO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5jYXN0U2hhZG93O1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLnBhcmFtZXRlcnMgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5wYXJhbWV0ZXJzO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmlzU3RhdGljID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0uaXNTdGF0aWM7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UubGF5ZXIgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5sYXllcjtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5fc3RhdGljTGlnaHRMaXN0ID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0uX3N0YXRpY0xpZ2h0TGlzdDtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5fc2hhZGVyRGVmcyA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLl9zaGFkZXJEZWZzO1xuXG4gICAgICAgICAgICAvLyBtZXNoSW5zdGFuY2UgY3VsbGluZyAtIGRvbid0IGN1bGwgVUkgZWxlbWVudHMsIGFzIHRoZXkgdXNlIGN1c3RvbSBjdWxsaW5nIENvbXBvbmVudC5pc1Zpc2libGVGb3JDYW1lcmFcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5jdWxsID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0uY3VsbDtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoR3JvdXAgPSB0aGlzLl9iYXRjaEdyb3Vwc1tiYXRjaEdyb3VwSWRdO1xuICAgICAgICAgICAgaWYgKGJhdGNoR3JvdXAgJiYgYmF0Y2hHcm91cC5fdWkpXG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLmN1bGwgPSBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKGR5bmFtaWMpIHtcbiAgICAgICAgICAgICAgICAvLyBDcmVhdGUgc2tpbkluc3RhbmNlXG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZXMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVzLnB1c2goYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbaV0ubm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPSBuZXcgU2tpbkJhdGNoSW5zdGFuY2UodGhpcy5kZXZpY2UsIG5vZGVzLCB0aGlzLnJvb3ROb2RlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZGlzYWJsZSBhYWJiIHVwZGF0ZSwgZ2V0cyB1cGRhdGVkIG1hbnVhbGx5IGJ5IGJhdGNoZXJcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYiA9IGZhbHNlO1xuXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0uZHJhd09yZGVyO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLnN0ZW5jaWxGcm9udCA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLnN0ZW5jaWxGcm9udDtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5zdGVuY2lsQmFjayA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLnN0ZW5jaWxCYWNrO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmZsaXBGYWNlcyA9IGdldFNjYWxlU2lnbihiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXSkgPCAwO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5jYXN0U2hhZG93O1xuXG4gICAgICAgICAgICBiYXRjaC5tZXNoSW5zdGFuY2UgPSBtZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICBiYXRjaC51cGRhdGVCb3VuZGluZ0JveCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9zdGF0cy5jcmVhdGVUaW1lICs9IG5vdygpIC0gdGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIGJhdGNoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgYm91bmRpbmcgYm94ZXMgZm9yIGFsbCBkeW5hbWljIGJhdGNoZXMuIENhbGxlZCBhdXRvbWF0aWNhbGx5LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUFsbCgpIHtcbiAgICAgICAgLy8gVE9ETzogb25seSBjYWxsIHdoZW4gbmVlZGVkLiBBcHBsaWVzIHRvIHNraW5uaW5nIG1hdHJpY2VzIGFzIHdlbGxcblxuICAgICAgICBpZiAodGhpcy5fZGlydHlHcm91cHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5nZW5lcmF0ZSh0aGlzLl9kaXJ0eUdyb3Vwcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9iYXRjaExpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fYmF0Y2hMaXN0W2ldLmR5bmFtaWMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hMaXN0W2ldLnVwZGF0ZUJvdW5kaW5nQm94KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLnVwZGF0ZUxhc3RGcmFtZVRpbWUgPSBub3coKSAtIHRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lcyBhIGJhdGNoLiBUaGlzIG1ldGhvZCBkb2Vzbid0IHJlYnVpbGQgYmF0Y2ggZ2VvbWV0cnksIGJ1dCBvbmx5IGNyZWF0ZXMgYSBuZXcgbW9kZWwgYW5kXG4gICAgICogYmF0Y2ggb2JqZWN0cywgbGlua2VkIHRvIGRpZmZlcmVudCBzb3VyY2UgbWVzaCBpbnN0YW5jZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0JhdGNofSBiYXRjaCAtIEEgYmF0Y2ggb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlW119IGNsb25lZE1lc2hJbnN0YW5jZXMgLSBOZXcgbWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHJldHVybnMge0JhdGNofSBOZXcgYmF0Y2ggb2JqZWN0LlxuICAgICAqL1xuICAgIGNsb25lKGJhdGNoLCBjbG9uZWRNZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoMiA9IG5ldyBCYXRjaChjbG9uZWRNZXNoSW5zdGFuY2VzLCBiYXRjaC5keW5hbWljLCBiYXRjaC5iYXRjaEdyb3VwSWQpO1xuICAgICAgICB0aGlzLl9iYXRjaExpc3QucHVzaChiYXRjaDIpO1xuXG4gICAgICAgIGNvbnN0IG5vZGVzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2xvbmVkTWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbm9kZXMucHVzaChjbG9uZWRNZXNoSW5zdGFuY2VzW2ldLm5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UoYmF0Y2gubWVzaEluc3RhbmNlLm1lc2gsIGJhdGNoLm1lc2hJbnN0YW5jZS5tYXRlcmlhbCwgYmF0Y2gubWVzaEluc3RhbmNlLm5vZGUpO1xuICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlLl91cGRhdGVBYWJiID0gZmFsc2U7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UucGFyYW1ldGVycyA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0ucGFyYW1ldGVycztcbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5pc1N0YXRpYyA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0uaXNTdGF0aWM7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuY3VsbCA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0uY3VsbDtcbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5sYXllciA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0ubGF5ZXI7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuX3N0YXRpY0xpZ2h0TGlzdCA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0uX3N0YXRpY0xpZ2h0TGlzdDtcblxuICAgICAgICBpZiAoYmF0Y2guZHluYW1pYykge1xuICAgICAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPSBuZXcgU2tpbkJhdGNoSW5zdGFuY2UodGhpcy5kZXZpY2UsIG5vZGVzLCB0aGlzLnJvb3ROb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGJhdGNoLm1lc2hJbnN0YW5jZS5jYXN0U2hhZG93O1xuICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlLl9zaGFkZXIgPSBiYXRjaC5tZXNoSW5zdGFuY2UuX3NoYWRlci5zbGljZSgpO1xuXG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGJhdGNoLm1lc2hJbnN0YW5jZS5jYXN0U2hhZG93O1xuXG4gICAgICAgIHJldHVybiBiYXRjaDI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyB0aGUgYmF0Y2ggbW9kZWwgZnJvbSBhbGwgbGF5ZXJzIGFuZCBkZXN0cm95cyBpdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QmF0Y2h9IGJhdGNoIC0gQSBiYXRjaCBvYmplY3QuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBkZXN0cm95QmF0Y2goYmF0Y2gpIHtcbiAgICAgICAgYmF0Y2guZGVzdHJveSh0aGlzLnNjZW5lLCB0aGlzLl9iYXRjaEdyb3Vwc1tiYXRjaC5iYXRjaEdyb3VwSWRdLmxheWVycyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBCYXRjaE1hbmFnZXIgfTtcbiJdLCJuYW1lcyI6WyJwYXJhbXNJZGVudGljYWwiLCJhIiwiYiIsImRhdGEiLCJGbG9hdDMyQXJyYXkiLCJsZW5ndGgiLCJpIiwiZXF1YWxQYXJhbVNldHMiLCJwYXJhbXMxIiwicGFyYW1zMiIsInBhcmFtIiwiaGFzT3duUHJvcGVydHkiLCJlcXVhbExpZ2h0TGlzdHMiLCJsaWdodExpc3QxIiwibGlnaHRMaXN0MiIsImsiLCJpbmRleE9mIiwibWF0MyIsIk1hdDMiLCJ3b3JsZE1hdFgiLCJWZWMzIiwid29ybGRNYXRZIiwid29ybGRNYXRaIiwiZ2V0U2NhbGVTaWduIiwibWkiLCJ3dCIsIm5vZGUiLCJ3b3JsZFRyYW5zZm9ybSIsImdldFgiLCJnZXRZIiwiZ2V0WiIsImNyb3NzIiwiZG90IiwiQmF0Y2hNYW5hZ2VyIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJyb290Iiwic2NlbmUiLCJyb290Tm9kZSIsIl9pbml0IiwiX2JhdGNoR3JvdXBzIiwiX2JhdGNoR3JvdXBDb3VudGVyIiwiX2JhdGNoTGlzdCIsIl9kaXJ0eUdyb3VwcyIsIl9zdGF0cyIsImNyZWF0ZVRpbWUiLCJ1cGRhdGVMYXN0RnJhbWVUaW1lIiwiZGVzdHJveSIsImFkZEdyb3VwIiwibmFtZSIsImR5bmFtaWMiLCJtYXhBYWJiU2l6ZSIsImlkIiwibGF5ZXJzIiwidW5kZWZpbmVkIiwiRGVidWciLCJlcnJvciIsImdyb3VwIiwiQmF0Y2hHcm91cCIsInJlbW92ZUdyb3VwIiwibmV3QmF0Y2hMaXN0IiwiYmF0Y2hHcm91cElkIiwiZGVzdHJveUJhdGNoIiwicHVzaCIsIl9yZW1vdmVNb2RlbHNGcm9tQmF0Y2hHcm91cCIsIm1hcmtHcm91cERpcnR5IiwiZ2V0R3JvdXBCeU5hbWUiLCJncm91cHMiLCJnZXRCYXRjaGVzIiwicmVzdWx0cyIsImxlbiIsImJhdGNoIiwiZW5hYmxlZCIsIm1vZGVsIiwicmVuZGVyIiwiZWxlbWVudCIsInNwcml0ZSIsIl9jaGlsZHJlbiIsImluc2VydCIsInR5cGUiLCJncm91cElkIiwiYXNzZXJ0IiwiX29iaiIsInJlbW92ZSIsImlkeCIsInNwbGljZSIsIl9leHRyYWN0UmVuZGVyIiwiYXJyIiwiZ3JvdXBNZXNoSW5zdGFuY2VzIiwiaXNTdGF0aWMiLCJkcmF3Q2FsbHMiLCJub2RlTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZXMiLCJfc3RhdGljU291cmNlIiwiY29uY2F0IiwicmVtb3ZlRnJvbUxheWVycyIsIl9leHRyYWN0TW9kZWwiLCJyZW1vdmVNb2RlbEZyb21MYXllcnMiLCJfYmF0Y2hHcm91cCIsIl9leHRyYWN0RWxlbWVudCIsInZhbGlkIiwiX3RleHQiLCJfbW9kZWwiLCJfaW1hZ2UiLCJfcmVuZGVyYWJsZSIsIm1lc2hJbnN0YW5jZSIsInVubWFza01lc2hJbnN0YW5jZSIsInN0ZW5jaWxGcm9udCIsInN0ZW5jaWxCYWNrIiwiX2RpcnRpZnlNYXNrIiwiX29uUHJlcmVuZGVyIiwiX3VpIiwiX2NvbGxlY3RBbmRSZW1vdmVNZXNoSW5zdGFuY2VzIiwiZ3JvdXBJZHMiLCJnIiwibSIsInIiLCJlIiwicyIsIl9tZXNoSW5zdGFuY2UiLCJfcmVuZGVyTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSIsIl9zcHJpdGUiLCJnZW5lcmF0ZSIsIk9iamVjdCIsImtleXMiLCJuZXdEaXJ0eUdyb3VwcyIsImxpc3RzIiwiZ3JvdXBEYXRhIiwicHJlcGFyZSIsImNyZWF0ZSIsInBhcnNlSW50IiwiYWRkVG9MYXllcnMiLCJOdW1iZXIiLCJQT1NJVElWRV9JTkZJTklUWSIsInRyYW5zbHVjZW50IiwiaGFsZk1heEFhYmJTaXplIiwibWF4SW5zdGFuY2VDb3VudCIsInN1cHBvcnRzQm9uZVRleHR1cmVzIiwiYm9uZUxpbWl0IiwibWF4TnVtVmVydGljZXMiLCJleHRVaW50RWxlbWVudCIsImFhYmIiLCJCb3VuZGluZ0JveCIsInRlc3RBYWJiIiwic2tpcFRyYW5zbHVjZW50QWFiYiIsInNmIiwiaiIsInNvcnQiLCJkcmF3T3JkZXIiLCJtZXNoSW5zdGFuY2VzTGVmdEEiLCJtZXNoSW5zdGFuY2VzTGVmdEIiLCJza2lwTWVzaCIsImFkZCIsImNsb25lIiwibWF0ZXJpYWwiLCJsYXllciIsImRlZnMiLCJfc2hhZGVyRGVmcyIsInBhcmFtcyIsInBhcmFtZXRlcnMiLCJzdGVuY2lsIiwibGlnaHRMaXN0IiwiX3N0YXRpY0xpZ2h0TGlzdCIsInZlcnRDb3VudCIsIm1lc2giLCJ2ZXJ0ZXhCdWZmZXIiLCJnZXROdW1WZXJ0aWNlcyIsImNvcHkiLCJzY2FsZVNpZ24iLCJ2ZXJ0ZXhGb3JtYXRCYXRjaGluZ0hhc2giLCJmb3JtYXQiLCJiYXRjaGluZ0hhc2giLCJpbmRleGVkIiwicHJpbWl0aXZlIiwic2xpY2UiLCJoYWxmRXh0ZW50cyIsIngiLCJ5IiwieiIsImZ1bmMiLCJ6cGFzcyIsInN0YXRpY0xpZ2h0cyIsImludGVyc2VjdHMiLCJjb2xsZWN0QmF0Y2hlZE1lc2hEYXRhIiwic3RyZWFtcyIsImJhdGNoTnVtVmVydHMiLCJiYXRjaE51bUluZGljZXMiLCJ2aXNpYmxlIiwibnVtVmVydHMiLCJudW1WZXJ0aWNlcyIsImNvdW50IiwiUFJJTUlUSVZFX1RSSUZBTiIsImVsZW1zIiwiZWxlbWVudHMiLCJzZW1hbnRpYyIsIm51bUNvbXBvbmVudHMiLCJkYXRhVHlwZSIsIm5vcm1hbGl6ZSIsIlNFTUFOVElDX0JMRU5ESU5ESUNFUyIsIlRZUEVfRkxPQVQzMiIsInRpbWUiLCJub3ciLCJnZXRCb25lTGltaXQiLCJ0cmFuc2Zvcm1WUyIsInNoYWRlckNodW5rcyIsInNraW5UZXhWUyIsInNraW5CYXRjaFRleFZTIiwic2tpbkNvbnN0VlMiLCJza2luQmF0Y2hDb25zdFZTIiwidmVydGV4Rm9ybWF0cyIsInN0cmVhbSIsImJhdGNoRGF0YSIsIkJhdGNoIiwiaW5kZXhCYXNlIiwibnVtSW5kaWNlcyIsImluZGV4RGF0YSIsInZlcnRpY2VzT2Zmc2V0IiwiaW5kZXhPZmZzZXQiLCJ0cmFuc2Zvcm0iLCJ2ZWMiLCJpbmRleEFycmF5VHlwZSIsIlVpbnQxNkFycmF5IiwiVWludDMyQXJyYXkiLCJpbmRpY2VzIiwidHlwZUFycmF5VHlwZSIsInR5cGVkQXJyYXlUeXBlcyIsImVsZW1lbnRCeXRlU2l6ZSIsInR5cGVkQXJyYXlUeXBlc0J5dGVTaXplIiwiYnVmZmVyIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJzdWJhcnJheSIsInRvdGFsQ29tcG9uZW50cyIsImdldFZlcnRleFN0cmVhbSIsIlNFTUFOVElDX1BPU0lUSU9OIiwic2V0IiwidHJhbnNmb3JtUG9pbnQiLCJTRU1BTlRJQ19OT1JNQUwiLCJTRU1BTlRJQ19UQU5HRU5UIiwiaW52ZXJ0VG8zeDMiLCJ0cmFuc3Bvc2UiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJiYXNlIiwic3JjRm9ybWF0IiwiaW5kZXhCdWZmZXIiLCJnZXRGb3JtYXQiLCJ0eXBlZEFycmF5SW5kZXhGb3JtYXRzIiwic3RvcmFnZSIsIk1lc2giLCJzZXRWZXJ0ZXhTdHJlYW0iLCJzZXRJbmRpY2VzIiwidXBkYXRlIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsImNodW5rcyIsIk1lc2hJbnN0YW5jZSIsImNhc3RTaGFkb3ciLCJvcmlnTWVzaEluc3RhbmNlcyIsImN1bGwiLCJiYXRjaEdyb3VwIiwibm9kZXMiLCJza2luSW5zdGFuY2UiLCJTa2luQmF0Y2hJbnN0YW5jZSIsIl91cGRhdGVBYWJiIiwiZmxpcEZhY2VzIiwidXBkYXRlQm91bmRpbmdCb3giLCJ1cGRhdGVBbGwiLCJjbG9uZWRNZXNoSW5zdGFuY2VzIiwiYmF0Y2gyIiwiX3NoYWRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFCQSxTQUFTQSxlQUFlLENBQUNDLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0FBQzNCLEVBQUEsSUFBSUQsQ0FBQyxJQUFJLENBQUNDLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQTtBQUN6QixFQUFBLElBQUksQ0FBQ0QsQ0FBQyxJQUFJQyxDQUFDLEVBQUUsT0FBTyxLQUFLLENBQUE7RUFDekJELENBQUMsR0FBR0EsQ0FBQyxDQUFDRSxJQUFJLENBQUE7RUFDVkQsQ0FBQyxHQUFHQSxDQUFDLENBQUNDLElBQUksQ0FBQTtBQUNWLEVBQUEsSUFBSUYsQ0FBQyxLQUFLQyxDQUFDLEVBQUUsT0FBTyxJQUFJLENBQUE7QUFDeEIsRUFBQSxJQUFJRCxDQUFDLFlBQVlHLFlBQVksSUFBSUYsQ0FBQyxZQUFZRSxZQUFZLEVBQUU7SUFDeEQsSUFBSUgsQ0FBQyxDQUFDSSxNQUFNLEtBQUtILENBQUMsQ0FBQ0csTUFBTSxFQUFFLE9BQU8sS0FBSyxDQUFBO0FBQ3ZDLElBQUEsS0FB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
