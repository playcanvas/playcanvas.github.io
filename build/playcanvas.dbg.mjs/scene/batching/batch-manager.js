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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtbWFuYWdlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2JhdGNoaW5nL2JhdGNoLW1hbmFnZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IG5vdyB9IGZyb20gJy4uLy4uL2NvcmUvdGltZS5qcyc7XG5pbXBvcnQgeyBNYXQzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDMuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIFBSSU1JVElWRV9UUklBTkdMRVMsIFBSSU1JVElWRV9UUklGQU4sIFBSSU1JVElWRV9UUklTVFJJUCxcbiAgICBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19UQU5HRU5ULCBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgVFlQRV9GTE9BVDMyLFxuICAgIHR5cGVkQXJyYXlJbmRleEZvcm1hdHMsIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemVcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi9tZXNoLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vc2hhZGVyLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IEJhdGNoIH0gZnJvbSAnLi9iYXRjaC5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi9iYXRjaC1ncm91cC5qcyc7XG5pbXBvcnQgeyBTa2luQmF0Y2hJbnN0YW5jZSB9IGZyb20gJy4vc2tpbi1iYXRjaC1pbnN0YW5jZS5qcyc7XG5cbmZ1bmN0aW9uIHBhcmFtc0lkZW50aWNhbChhLCBiKSB7XG4gICAgaWYgKGEgJiYgIWIpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIWEgJiYgYikgcmV0dXJuIGZhbHNlO1xuICAgIGEgPSBhLmRhdGE7XG4gICAgYiA9IGIuZGF0YTtcbiAgICBpZiAoYSA9PT0gYikgcmV0dXJuIHRydWU7XG4gICAgaWYgKGEgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgJiYgYiBpbnN0YW5jZW9mIEZsb2F0MzJBcnJheSkge1xuICAgICAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBlcXVhbFBhcmFtU2V0cyhwYXJhbXMxLCBwYXJhbXMyKSB7XG4gICAgZm9yIChjb25zdCBwYXJhbSBpbiBwYXJhbXMxKSB7IC8vIGNvbXBhcmUgQSAtPiBCXG4gICAgICAgIGlmIChwYXJhbXMxLmhhc093blByb3BlcnR5KHBhcmFtKSAmJiAhcGFyYW1zSWRlbnRpY2FsKHBhcmFtczFbcGFyYW1dLCBwYXJhbXMyW3BhcmFtXSkpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAoY29uc3QgcGFyYW0gaW4gcGFyYW1zMikgeyAvLyBjb21wYXJlIEIgLT4gQVxuICAgICAgICBpZiAocGFyYW1zMi5oYXNPd25Qcm9wZXJ0eShwYXJhbSkgJiYgIXBhcmFtc0lkZW50aWNhbChwYXJhbXMyW3BhcmFtXSwgcGFyYW1zMVtwYXJhbV0pKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZXF1YWxMaWdodExpc3RzKGxpZ2h0TGlzdDEsIGxpZ2h0TGlzdDIpIHtcbiAgICBmb3IgKGxldCBrID0gMDsgayA8IGxpZ2h0TGlzdDEubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgaWYgKGxpZ2h0TGlzdDIuaW5kZXhPZihsaWdodExpc3QxW2tdKSA8IDApXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAobGV0IGsgPSAwOyBrIDwgbGlnaHRMaXN0Mi5sZW5ndGg7IGsrKykge1xuICAgICAgICBpZiAobGlnaHRMaXN0MS5pbmRleE9mKGxpZ2h0TGlzdDJba10pIDwgMClcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbmNvbnN0IF90cmlGYW5JbmRpY2VzID0gWzAsIDEsIDMsIDIsIDMsIDFdO1xuY29uc3QgX3RyaVN0cmlwSW5kaWNlcyA9IFswLCAxLCAzLCAwLCAzLCAyXTtcblxuY29uc3QgbWF0MyA9IG5ldyBNYXQzKCk7XG5cbmZ1bmN0aW9uIGdldFNjYWxlU2lnbihtaSkge1xuICAgIHJldHVybiBtaS5ub2RlLndvcmxkVHJhbnNmb3JtLnNjYWxlU2lnbjtcbn1cblxuLyoqXG4gKiBHbHVlcyBtYW55IG1lc2ggaW5zdGFuY2VzIGludG8gYSBzaW5nbGUgb25lIGZvciBiZXR0ZXIgcGVyZm9ybWFuY2UuXG4gKi9cbmNsYXNzIEJhdGNoTWFuYWdlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEJhdGNoTWFuYWdlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gICAgICogZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIGJhdGNoIG1hbmFnZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9lbnRpdHkuanMnKS5FbnRpdHl9IHJvb3QgLSBUaGUgZW50aXR5IHVuZGVyIHdoaWNoIGJhdGNoZWRcbiAgICAgKiBtb2RlbHMgYXJlIGFkZGVkLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zY2VuZS5qcycpLlNjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZSB0aGF0IHRoZSBiYXRjaCBtYW5hZ2VyIGFmZmVjdHMuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCByb290LCBzY2VuZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5yb290Tm9kZSA9IHJvb3Q7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcbiAgICAgICAgdGhpcy5faW5pdCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBzID0ge307XG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBDb3VudGVyID0gMDtcbiAgICAgICAgdGhpcy5fYmF0Y2hMaXN0ID0gW107XG4gICAgICAgIHRoaXMuX2RpcnR5R3JvdXBzID0gW107XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9zdGF0cyA9IHtcbiAgICAgICAgICAgIGNyZWF0ZVRpbWU6IDAsXG4gICAgICAgICAgICB1cGRhdGVMYXN0RnJhbWVUaW1lOiAwXG4gICAgICAgIH07XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5yb290Tm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBudWxsO1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwcyA9IHt9O1xuICAgICAgICB0aGlzLl9iYXRjaExpc3QgPSBbXTtcbiAgICAgICAgdGhpcy5fZGlydHlHcm91cHMgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIG5ldyBnbG9iYWwgYmF0Y2ggZ3JvdXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIEN1c3RvbSBuYW1lLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZHluYW1pYyAtIElzIHRoaXMgYmF0Y2ggZ3JvdXAgZHluYW1pYz8gV2lsbCB0aGVzZSBvYmplY3RzIG1vdmUvcm90YXRlL3NjYWxlXG4gICAgICogYWZ0ZXIgYmVpbmcgYmF0Y2hlZD9cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4QWFiYlNpemUgLSBNYXhpbXVtIHNpemUgb2YgYW55IGRpbWVuc2lvbiBvZiBhIGJvdW5kaW5nIGJveCBhcm91bmQgYmF0Y2hlZFxuICAgICAqIG9iamVjdHMuXG4gICAgICoge0BsaW5rIEJhdGNoTWFuYWdlciNwcmVwYXJlfSB3aWxsIHNwbGl0IG9iamVjdHMgaW50byBsb2NhbCBncm91cHMgYmFzZWQgb24gdGhpcyBzaXplLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaWRdIC0gT3B0aW9uYWwgY3VzdG9tIHVuaXF1ZSBpZCBmb3IgdGhlIGdyb3VwICh3aWxsIGJlIGdlbmVyYXRlZFxuICAgICAqIGF1dG9tYXRpY2FsbHkgb3RoZXJ3aXNlKS5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBbbGF5ZXJzXSAtIE9wdGlvbmFsIGxheWVyIElEIGFycmF5LiBEZWZhdWx0IGlzIFt7QGxpbmsgTEFZRVJJRF9XT1JMRH1dLlxuICAgICAqIFRoZSB3aG9sZSBiYXRjaCBncm91cCB3aWxsIGJlbG9uZyB0byB0aGVzZSBsYXllcnMuIExheWVycyBvZiBzb3VyY2UgbW9kZWxzIHdpbGwgYmUgaWdub3JlZC5cbiAgICAgKiBAcmV0dXJucyB7QmF0Y2hHcm91cH0gR3JvdXAgb2JqZWN0LlxuICAgICAqL1xuICAgIGFkZEdyb3VwKG5hbWUsIGR5bmFtaWMsIG1heEFhYmJTaXplLCBpZCwgbGF5ZXJzKSB7XG4gICAgICAgIGlmIChpZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZCA9IHRoaXMuX2JhdGNoR3JvdXBDb3VudGVyO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hHcm91cENvdW50ZXIrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3Vwc1tpZF0pIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKGBCYXRjaCBncm91cCB3aXRoIGlkICR7aWR9IGFscmVhZHkgZXhpc3RzLmApO1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gbmV3IEJhdGNoR3JvdXAoaWQsIG5hbWUsIGR5bmFtaWMsIG1heEFhYmJTaXplLCBsYXllcnMpO1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3Vwc1tpZF0gPSBncm91cDtcblxuICAgICAgICByZXR1cm4gZ3JvdXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGdsb2JhbCBiYXRjaCBncm91cCBieSBpZC4gTm90ZSwgdGhpcyB0cmF2ZXJzZXMgdGhlIGVudGlyZSBzY2VuZSBncmFwaCBhbmQgY2xlYXJzIHRoZVxuICAgICAqIGJhdGNoIGdyb3VwIGlkIGZyb20gYWxsIGNvbXBvbmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBCYXRjaCBHcm91cCBJRC5cbiAgICAgKi9cbiAgICByZW1vdmVHcm91cChpZCkge1xuICAgICAgICBpZiAoIXRoaXMuX2JhdGNoR3JvdXBzW2lkXSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoYEJhdGNoIGdyb3VwIHdpdGggaWQgJHtpZH0gZG9lc24ndCBleGlzdC5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlbGV0ZSBiYXRjaGVzIHdpdGggbWF0Y2hpbmcgaWRcbiAgICAgICAgY29uc3QgbmV3QmF0Y2hMaXN0ID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fYmF0Y2hMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fYmF0Y2hMaXN0W2ldLmJhdGNoR3JvdXBJZCA9PT0gaWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3lCYXRjaCh0aGlzLl9iYXRjaExpc3RbaV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBuZXdCYXRjaExpc3QucHVzaCh0aGlzLl9iYXRjaExpc3RbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2JhdGNoTGlzdCA9IG5ld0JhdGNoTGlzdDtcbiAgICAgICAgdGhpcy5fcmVtb3ZlTW9kZWxzRnJvbUJhdGNoR3JvdXAodGhpcy5yb290Tm9kZSwgaWQpO1xuXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9iYXRjaEdyb3Vwc1tpZF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFyayBhIHNwZWNpZmljIGJhdGNoIGdyb3VwIGFzIGRpcnR5LiBEaXJ0eSBncm91cHMgYXJlIHJlLWJhdGNoZWQgYmVmb3JlIHRoZSBuZXh0IGZyYW1lIGlzXG4gICAgICogcmVuZGVyZWQuIE5vdGUsIHJlLWJhdGNoaW5nIGEgZ3JvdXAgaXMgYSBwb3RlbnRpYWxseSBleHBlbnNpdmUgb3BlcmF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlkIC0gQmF0Y2ggR3JvdXAgSUQgdG8gbWFyayBhcyBkaXJ0eS5cbiAgICAgKi9cbiAgICBtYXJrR3JvdXBEaXJ0eShpZCkge1xuICAgICAgICBpZiAodGhpcy5fZGlydHlHcm91cHMuaW5kZXhPZihpZCkgPCAwKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUdyb3Vwcy5wdXNoKGlkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyBhIHtAbGluayBCYXRjaEdyb3VwfSBvYmplY3Qgd2l0aCBhIGNvcnJlc3BvbmRpbmcgbmFtZSwgaWYgaXQgZXhpc3RzLCBvciBudWxsXG4gICAgICogb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lLlxuICAgICAqIEByZXR1cm5zIHtCYXRjaEdyb3VwfG51bGx9IFRoZSBiYXRjaCBncm91cCBtYXRjaGluZyB0aGUgbmFtZSBvciBudWxsIGlmIG5vdCBmb3VuZC5cbiAgICAgKi9cbiAgICBnZXRHcm91cEJ5TmFtZShuYW1lKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwcyA9IHRoaXMuX2JhdGNoR3JvdXBzO1xuICAgICAgICBmb3IgKGNvbnN0IGdyb3VwIGluIGdyb3Vwcykge1xuICAgICAgICAgICAgaWYgKCFncm91cHMuaGFzT3duUHJvcGVydHkoZ3JvdXApKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChncm91cHNbZ3JvdXBdLm5hbWUgPT09IG5hbWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZ3JvdXBzW2dyb3VwXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYSBsaXN0IG9mIGFsbCB7QGxpbmsgQmF0Y2h9IG9iamVjdHMgdGhhdCBiZWxvbmcgdG8gdGhlIEJhdGNoIEdyb3VwIHN1cHBsaWVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJhdGNoR3JvdXBJZCAtIFRoZSBpZCBvZiB0aGUgYmF0Y2ggZ3JvdXAuXG4gICAgICogQHJldHVybnMge0JhdGNoW119IEEgbGlzdCBvZiBiYXRjaGVzIHRoYXQgYXJlIHVzZWQgdG8gcmVuZGVyIHRoZSBiYXRjaCBncm91cC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGdldEJhdGNoZXMoYmF0Y2hHcm91cElkKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICAgICAgY29uc3QgbGVuID0gdGhpcy5fYmF0Y2hMaXN0Lmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYmF0Y2ggPSB0aGlzLl9iYXRjaExpc3RbaV07XG4gICAgICAgICAgICBpZiAoYmF0Y2guYmF0Y2hHcm91cElkID09PSBiYXRjaEdyb3VwSWQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goYmF0Y2gpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLy8gdHJhdmVyc2UgZnVsbCBoaWVyYXJjaHkgYW5kIGNsZWFyIHRoZSBiYXRjaCBncm91cCBpZCBmcm9tIGFsbCBtb2RlbCwgZWxlbWVudCBhbmQgc3ByaXRlIGNvbXBvbmVudHNcbiAgICBfcmVtb3ZlTW9kZWxzRnJvbUJhdGNoR3JvdXAobm9kZSwgaWQpIHtcbiAgICAgICAgaWYgKCFub2RlLmVuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBpZiAobm9kZS5tb2RlbCAmJiBub2RlLm1vZGVsLmJhdGNoR3JvdXBJZCA9PT0gaWQpIHtcbiAgICAgICAgICAgIG5vZGUubW9kZWwuYmF0Y2hHcm91cElkID0gLTE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUucmVuZGVyICYmIG5vZGUucmVuZGVyLmJhdGNoR3JvdXBJZCA9PT0gaWQpIHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyLmJhdGNoR3JvdXBJZCA9IC0xO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmVsZW1lbnQgJiYgbm9kZS5lbGVtZW50LmJhdGNoR3JvdXBJZCA9PT0gaWQpIHtcbiAgICAgICAgICAgIG5vZGUuZWxlbWVudC5iYXRjaEdyb3VwSWQgPSAtMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5zcHJpdGUgJiYgbm9kZS5zcHJpdGUuYmF0Y2hHcm91cElkID09PSBpZCkge1xuICAgICAgICAgICAgbm9kZS5zcHJpdGUuYmF0Y2hHcm91cElkID0gLTE7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVNb2RlbHNGcm9tQmF0Y2hHcm91cChub2RlLl9jaGlsZHJlbltpXSwgaWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5zZXJ0KHR5cGUsIGdyb3VwSWQsIG5vZGUpIHtcbiAgICAgICAgY29uc3QgZ3JvdXAgPSB0aGlzLl9iYXRjaEdyb3Vwc1tncm91cElkXTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGdyb3VwLCBgSW52YWxpZCBiYXRjaCAke2dyb3VwSWR9IGluc2VydGlvbmApO1xuXG4gICAgICAgIGlmIChncm91cCkge1xuICAgICAgICAgICAgaWYgKGdyb3VwLl9vYmpbdHlwZV0uaW5kZXhPZihub2RlKSA8IDApIHtcbiAgICAgICAgICAgICAgICBncm91cC5fb2JqW3R5cGVdLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJrR3JvdXBEaXJ0eShncm91cElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZSh0eXBlLCBncm91cElkLCBub2RlKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwID0gdGhpcy5fYmF0Y2hHcm91cHNbZ3JvdXBJZF07XG4gICAgICAgIERlYnVnLmFzc2VydChncm91cCwgYEludmFsaWQgYmF0Y2ggJHtncm91cElkfSBpbnNlcnRpb25gKTtcblxuICAgICAgICBpZiAoZ3JvdXApIHtcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IGdyb3VwLl9vYmpbdHlwZV0uaW5kZXhPZihub2RlKTtcbiAgICAgICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgICAgICAgIGdyb3VwLl9vYmpbdHlwZV0uc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXJrR3JvdXBEaXJ0eShncm91cElkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9leHRyYWN0UmVuZGVyKG5vZGUsIGFyciwgZ3JvdXAsIGdyb3VwTWVzaEluc3RhbmNlcykge1xuICAgICAgICBpZiAobm9kZS5yZW5kZXIpIHtcblxuICAgICAgICAgICAgaWYgKG5vZGUucmVuZGVyLmlzU3RhdGljKSB7XG4gICAgICAgICAgICAgICAgLy8gc3RhdGljIG1lc2ggaW5zdGFuY2VzIGNhbiBiZSBpbiBib3RoIGRyYXdDYWxsIGFycmF5IHdpdGggX3N0YXRpY1NvdXJjZSBsaW5raW5nIHRvIG9yaWdpbmFsXG4gICAgICAgICAgICAgICAgLy8gYW5kIGluIHRoZSBvcmlnaW5hbCBhcnJheSBhcyB3ZWxsLCBpZiBubyB0cmlhbmdsZSBzcGxpdHRpbmcgd2FzIGRvbmVcbiAgICAgICAgICAgICAgICBjb25zdCBkcmF3Q2FsbHMgPSB0aGlzLnNjZW5lLmRyYXdDYWxscztcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlTWVzaEluc3RhbmNlcyA9IG5vZGUucmVuZGVyLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkcmF3Q2FsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkcmF3Q2FsbHNbaV0uX3N0YXRpY1NvdXJjZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub2RlTWVzaEluc3RhbmNlcy5pbmRleE9mKGRyYXdDYWxsc1tpXS5fc3RhdGljU291cmNlKSA8IDApIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBhcnIucHVzaChkcmF3Q2FsbHNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGVNZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbHMuaW5kZXhPZihub2RlTWVzaEluc3RhbmNlc1tpXSkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJyLnB1c2gobm9kZU1lc2hJbnN0YW5jZXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhcnIgPSBncm91cE1lc2hJbnN0YW5jZXNbbm9kZS5yZW5kZXIuYmF0Y2hHcm91cElkXSA9IGFyci5jb25jYXQobm9kZS5yZW5kZXIubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVuZGVyLnJlbW92ZUZyb21MYXllcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgfVxuXG4gICAgX2V4dHJhY3RNb2RlbChub2RlLCBhcnIsIGdyb3VwLCBncm91cE1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgaWYgKG5vZGUubW9kZWwgJiYgbm9kZS5tb2RlbC5tb2RlbCkge1xuICAgICAgICAgICAgaWYgKG5vZGUubW9kZWwuaXNTdGF0aWMpIHtcbiAgICAgICAgICAgICAgICAvLyBzdGF0aWMgbWVzaCBpbnN0YW5jZXMgY2FuIGJlIGluIGJvdGggZHJhd0NhbGwgYXJyYXkgd2l0aCBfc3RhdGljU291cmNlIGxpbmtpbmcgdG8gb3JpZ2luYWxcbiAgICAgICAgICAgICAgICAvLyBhbmQgaW4gdGhlIG9yaWdpbmFsIGFycmF5IGFzIHdlbGwsIGlmIG5vIHRyaWFuZ2xlIHNwbGl0dGluZyB3YXMgZG9uZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRyYXdDYWxscyA9IHRoaXMuc2NlbmUuZHJhd0NhbGxzO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVNZXNoSW5zdGFuY2VzID0gbm9kZS5tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHJhd0NhbGxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZHJhd0NhbGxzW2ldLl9zdGF0aWNTb3VyY2UpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZU1lc2hJbnN0YW5jZXMuaW5kZXhPZihkcmF3Q2FsbHNbaV0uX3N0YXRpY1NvdXJjZSkgPCAwKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgYXJyLnB1c2goZHJhd0NhbGxzW2ldKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlTWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZHJhd0NhbGxzLmluZGV4T2Yobm9kZU1lc2hJbnN0YW5jZXNbaV0pID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyci5wdXNoKG5vZGVNZXNoSW5zdGFuY2VzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXJyID0gZ3JvdXBNZXNoSW5zdGFuY2VzW25vZGUubW9kZWwuYmF0Y2hHcm91cElkXSA9IGFyci5jb25jYXQobm9kZS5tb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbm9kZS5tb2RlbC5yZW1vdmVNb2RlbEZyb21MYXllcnMoKTtcblxuICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgbm9kZS5tb2RlbC5fYmF0Y2hHcm91cCA9IGdyb3VwO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXJyO1xuICAgIH1cblxuICAgIF9leHRyYWN0RWxlbWVudChub2RlLCBhcnIsIGdyb3VwKSB7XG4gICAgICAgIGlmICghbm9kZS5lbGVtZW50KSByZXR1cm47XG4gICAgICAgIGxldCB2YWxpZCA9IGZhbHNlO1xuICAgICAgICBpZiAobm9kZS5lbGVtZW50Ll90ZXh0ICYmIG5vZGUuZWxlbWVudC5fdGV4dC5fbW9kZWwubWVzaEluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBhcnIucHVzaChub2RlLmVsZW1lbnQuX3RleHQuX21vZGVsLm1lc2hJbnN0YW5jZXNbMF0pO1xuICAgICAgICAgICAgbm9kZS5lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyhub2RlLmVsZW1lbnQuX3RleHQuX21vZGVsKTtcblxuICAgICAgICAgICAgdmFsaWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKG5vZGUuZWxlbWVudC5faW1hZ2UpIHtcbiAgICAgICAgICAgIGFyci5wdXNoKG5vZGUuZWxlbWVudC5faW1hZ2UuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlKTtcbiAgICAgICAgICAgIG5vZGUuZWxlbWVudC5yZW1vdmVNb2RlbEZyb21MYXllcnMobm9kZS5lbGVtZW50Ll9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCk7XG5cbiAgICAgICAgICAgIGlmIChub2RlLmVsZW1lbnQuX2ltYWdlLl9yZW5kZXJhYmxlLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGFyci5wdXNoKG5vZGUuZWxlbWVudC5faW1hZ2UuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGUuZWxlbWVudC5faW1hZ2UuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlLnN0ZW5jaWxGcm9udCB8fFxuICAgICAgICAgICAgICAgICAgICAhbm9kZS5lbGVtZW50Ll9pbWFnZS5fcmVuZGVyYWJsZS51bm1hc2tNZXNoSW5zdGFuY2Uuc3RlbmNpbEJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5lbGVtZW50Ll9kaXJ0aWZ5TWFzaygpO1xuICAgICAgICAgICAgICAgICAgICBub2RlLmVsZW1lbnQuX29uUHJlcmVuZGVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YWxpZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsaWQpIHtcbiAgICAgICAgICAgIGdyb3VwLl91aSA9IHRydWU7XG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICBub2RlLmVsZW1lbnQuX2JhdGNoR3JvdXAgPSBncm91cDtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gdHJhdmVyc2Ugc2NlbmUgaGllcmFyY2h5IGRvd24gZnJvbSBgbm9kZWAgYW5kIGNvbGxlY3QgYWxsIGNvbXBvbmVudHMgdGhhdCBhcmUgbWFya2VkXG4gICAgLy8gd2l0aCBhIGJhdGNoIGdyb3VwIGlkLiBSZW1vdmUgZnJvbSBsYXllcnMgYW55IG1vZGVscyB0aGF0IHRoZXNlIGNvbXBvbmVudHMgY29udGFpbnMuXG4gICAgLy8gRmlsbCB0aGUgYGdyb3VwTWVzaEluc3RhbmNlc2Agd2l0aCBhbGwgdGhlIG1lc2ggaW5zdGFuY2VzIHRvIGJlIGluY2x1ZGVkIGluIHRoZSBiYXRjaCBncm91cHMsXG4gICAgLy8gaW5kZXhlZCBieSBiYXRjaCBncm91cCBpZC5cbiAgICBfY29sbGVjdEFuZFJlbW92ZU1lc2hJbnN0YW5jZXMoZ3JvdXBNZXNoSW5zdGFuY2VzLCBncm91cElkcykge1xuICAgICAgICBmb3IgKGxldCBnID0gMDsgZyA8IGdyb3VwSWRzLmxlbmd0aDsgZysrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IGdyb3VwSWRzW2ddO1xuICAgICAgICAgICAgY29uc3QgZ3JvdXAgPSB0aGlzLl9iYXRjaEdyb3Vwc1tpZF07XG4gICAgICAgICAgICBpZiAoIWdyb3VwKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxldCBhcnIgPSBncm91cE1lc2hJbnN0YW5jZXNbaWRdO1xuICAgICAgICAgICAgaWYgKCFhcnIpIGFyciA9IGdyb3VwTWVzaEluc3RhbmNlc1tpZF0gPSBbXTtcblxuICAgICAgICAgICAgZm9yIChsZXQgbSA9IDA7IG0gPCBncm91cC5fb2JqLm1vZGVsLmxlbmd0aDsgbSsrKSB7XG4gICAgICAgICAgICAgICAgYXJyID0gdGhpcy5fZXh0cmFjdE1vZGVsKGdyb3VwLl9vYmoubW9kZWxbbV0sIGFyciwgZ3JvdXAsIGdyb3VwTWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IHIgPSAwOyByIDwgZ3JvdXAuX29iai5yZW5kZXIubGVuZ3RoOyByKyspIHtcbiAgICAgICAgICAgICAgICBhcnIgPSB0aGlzLl9leHRyYWN0UmVuZGVyKGdyb3VwLl9vYmoucmVuZGVyW3JdLCBhcnIsIGdyb3VwLCBncm91cE1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBlID0gMDsgZSA8IGdyb3VwLl9vYmouZWxlbWVudC5sZW5ndGg7IGUrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2V4dHJhY3RFbGVtZW50KGdyb3VwLl9vYmouZWxlbWVudFtlXSwgYXJyLCBncm91cCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IHMgPSAwOyBzIDwgZ3JvdXAuX29iai5zcHJpdGUubGVuZ3RoOyBzKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlID0gZ3JvdXAuX29iai5zcHJpdGVbc107XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuc3ByaXRlICYmIG5vZGUuc3ByaXRlLl9tZXNoSW5zdGFuY2UgJiZcbiAgICAgICAgICAgICAgICAgICAgKGdyb3VwLmR5bmFtaWMgfHwgbm9kZS5zcHJpdGUuc3ByaXRlLl9yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TSU1QTEUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyci5wdXNoKG5vZGUuc3ByaXRlLl9tZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgICAgICBub2RlLnNwcml0ZS5yZW1vdmVNb2RlbEZyb21MYXllcnMoKTtcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXAuX3Nwcml0ZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUuc3ByaXRlLl9iYXRjaEdyb3VwID0gZ3JvdXA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveXMgYWxsIGJhdGNoZXMgYW5kIGNyZWF0ZXMgbmV3IGJhc2VkIG9uIHNjZW5lIG1vZGVscy4gSGlkZXMgb3JpZ2luYWwgbW9kZWxzLiBDYWxsZWQgYnlcbiAgICAgKiBlbmdpbmUgYXV0b21hdGljYWxseSBvbiBhcHAgc3RhcnQsIGFuZCBpZiBiYXRjaEdyb3VwSWRzIG9uIG1vZGVscyBhcmUgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IFtncm91cElkc10gLSBPcHRpb25hbCBhcnJheSBvZiBiYXRjaCBncm91cCBJRHMgdG8gdXBkYXRlLiBPdGhlcndpc2UgYWxsXG4gICAgICogZ3JvdXBzIGFyZSB1cGRhdGVkLlxuICAgICAqL1xuICAgIGdlbmVyYXRlKGdyb3VwSWRzKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwTWVzaEluc3RhbmNlcyA9IHt9O1xuXG4gICAgICAgIGlmICghZ3JvdXBJZHMpIHtcbiAgICAgICAgICAgIC8vIEZ1bGwgc2NlbmVcbiAgICAgICAgICAgIGdyb3VwSWRzID0gT2JqZWN0LmtleXModGhpcy5fYmF0Y2hHcm91cHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVsZXRlIG9sZCBiYXRjaGVzIHdpdGggbWF0Y2hpbmcgYmF0Y2hHcm91cElkXG4gICAgICAgIGNvbnN0IG5ld0JhdGNoTGlzdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2JhdGNoTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGdyb3VwSWRzLmluZGV4T2YodGhpcy5fYmF0Y2hMaXN0W2ldLmJhdGNoR3JvdXBJZCkgPCAwKSB7XG4gICAgICAgICAgICAgICAgbmV3QmF0Y2hMaXN0LnB1c2godGhpcy5fYmF0Y2hMaXN0W2ldKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZGVzdHJveUJhdGNoKHRoaXMuX2JhdGNoTGlzdFtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYmF0Y2hMaXN0ID0gbmV3QmF0Y2hMaXN0O1xuXG4gICAgICAgIC8vIGNvbGxlY3RcbiAgICAgICAgdGhpcy5fY29sbGVjdEFuZFJlbW92ZU1lc2hJbnN0YW5jZXMoZ3JvdXBNZXNoSW5zdGFuY2VzLCBncm91cElkcyk7XG5cbiAgICAgICAgaWYgKGdyb3VwSWRzID09PSB0aGlzLl9kaXJ0eUdyb3Vwcykge1xuICAgICAgICAgICAgdGhpcy5fZGlydHlHcm91cHMubGVuZ3RoID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld0RpcnR5R3JvdXBzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2RpcnR5R3JvdXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGdyb3VwSWRzLmluZGV4T2YodGhpcy5fZGlydHlHcm91cHNbaV0pIDwgMCkgbmV3RGlydHlHcm91cHMucHVzaCh0aGlzLl9kaXJ0eUdyb3Vwc1tpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eUdyb3VwcyA9IG5ld0RpcnR5R3JvdXBzO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGdyb3VwLCBsaXN0cywgZ3JvdXBEYXRhLCBiYXRjaDtcbiAgICAgICAgZm9yIChjb25zdCBncm91cElkIGluIGdyb3VwTWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgaWYgKCFncm91cE1lc2hJbnN0YW5jZXMuaGFzT3duUHJvcGVydHkoZ3JvdXBJZCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgZ3JvdXAgPSBncm91cE1lc2hJbnN0YW5jZXNbZ3JvdXBJZF07XG5cbiAgICAgICAgICAgIGdyb3VwRGF0YSA9IHRoaXMuX2JhdGNoR3JvdXBzW2dyb3VwSWRdO1xuICAgICAgICAgICAgaWYgKCFncm91cERhdGEpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgYmF0Y2ggZ3JvdXAgJHtncm91cElkfSBub3QgZm91bmRgKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGlzdHMgPSB0aGlzLnByZXBhcmUoZ3JvdXAsIGdyb3VwRGF0YS5keW5hbWljLCBncm91cERhdGEubWF4QWFiYlNpemUsIGdyb3VwRGF0YS5fdWkgfHwgZ3JvdXBEYXRhLl9zcHJpdGUpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGJhdGNoID0gdGhpcy5jcmVhdGUobGlzdHNbaV0sIGdyb3VwRGF0YS5keW5hbWljLCBwYXJzZUludChncm91cElkLCAxMCkpO1xuICAgICAgICAgICAgICAgIGlmIChiYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBiYXRjaC5hZGRUb0xheWVycyh0aGlzLnNjZW5lLCBncm91cERhdGEubGF5ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFRha2VzIGEgbGlzdCBvZiBtZXNoIGluc3RhbmNlcyB0byBiZSBiYXRjaGVkIGFuZCBzb3J0cyB0aGVtIGludG8gbGlzdHMgb25lIGZvciBlYWNoIGRyYXdcbiAgICAgKiBjYWxsLiBUaGUgaW5wdXQgbGlzdCB3aWxsIGJlIHNwbGl0LCBpZjpcbiAgICAgKlxuICAgICAqIC0gTWVzaCBpbnN0YW5jZXMgdXNlIGRpZmZlcmVudCBtYXRlcmlhbHMuXG4gICAgICogLSBNZXNoIGluc3RhbmNlcyBoYXZlIGRpZmZlcmVudCBwYXJhbWV0ZXJzIChlLmcuIGxpZ2h0bWFwcyBvciBzdGF0aWMgbGlnaHRzKS5cbiAgICAgKiAtIE1lc2ggaW5zdGFuY2VzIGhhdmUgZGlmZmVyZW50IHNoYWRlciBkZWZpbmVzIChzaGFkb3cgcmVjZWl2aW5nLCBiZWluZyBhbGlnbmVkIHRvIHNjcmVlblxuICAgICAqIHNwYWNlLCBldGMpLlxuICAgICAqIC0gVG9vIG1hbnkgdmVydGljZXMgZm9yIGEgc2luZ2xlIGJhdGNoICg2NTUzNSBpcyBtYXhpbXVtKS5cbiAgICAgKiAtIFRvbyBtYW55IGluc3RhbmNlcyBmb3IgYSBzaW5nbGUgYmF0Y2ggKGhhcmR3YXJlLWRlcGVuZGVudCwgZXhwZWN0IDEyOCBvbiBsb3ctZW5kIGFuZCAxMDI0XG4gICAgICogb24gaGlnaC1lbmQpLlxuICAgICAqIC0gQm91bmRpbmcgYm94IG9mIGEgYmF0Y2ggaXMgbGFyZ2VyIHRoYW4gbWF4QWFiYlNpemUgaW4gYW55IGRpbWVuc2lvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlW119IG1lc2hJbnN0YW5jZXMgLSBJbnB1dCBsaXN0IG9mIG1lc2ggaW5zdGFuY2VzXG4gICAgICogQHBhcmFtIHtib29sZWFufSBkeW5hbWljIC0gQXJlIHdlIHByZXBhcmluZyBmb3IgYSBkeW5hbWljIGJhdGNoPyBJbnN0YW5jZSBjb3VudCB3aWxsIG1hdHRlclxuICAgICAqIHRoZW4gKG90aGVyd2lzZSBub3QpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhBYWJiU2l6ZSAtIE1heGltdW0gc2l6ZSBvZiBhbnkgZGltZW5zaW9uIG9mIGEgYm91bmRpbmcgYm94IGFyb3VuZCBiYXRjaGVkXG4gICAgICogb2JqZWN0cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHRyYW5zbHVjZW50IC0gQXJlIHdlIGJhdGNoaW5nIFVJIGVsZW1lbnRzIG9yIHNwcml0ZXNcbiAgICAgKiBUaGlzIGlzIHVzZWZ1bCB0byBrZWVwIGEgYmFsYW5jZSBiZXR3ZWVuIHRoZSBudW1iZXIgb2YgZHJhdyBjYWxscyBhbmQgdGhlIG51bWJlciBvZiBkcmF3blxuICAgICAqIHRyaWFuZ2xlcywgYmVjYXVzZSBzbWFsbGVyIGJhdGNoZXMgY2FuIGJlIGhpZGRlbiB3aGVuIG5vdCB2aXNpYmxlIGluIGNhbWVyYS5cbiAgICAgKiBAcmV0dXJucyB7TWVzaEluc3RhbmNlW11bXX0gQW4gYXJyYXkgb2YgYXJyYXlzIG9mIG1lc2ggaW5zdGFuY2VzLCBlYWNoIHZhbGlkIHRvIHBhc3MgdG9cbiAgICAgKiB7QGxpbmsgQmF0Y2hNYW5hZ2VyI2NyZWF0ZX0uXG4gICAgICovXG4gICAgcHJlcGFyZShtZXNoSW5zdGFuY2VzLCBkeW5hbWljLCBtYXhBYWJiU2l6ZSA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSwgdHJhbnNsdWNlbnQpIHtcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG4gICAgICAgIGNvbnN0IGhhbGZNYXhBYWJiU2l6ZSA9IG1heEFhYmJTaXplICogMC41O1xuICAgICAgICBjb25zdCBtYXhJbnN0YW5jZUNvdW50ID0gdGhpcy5kZXZpY2Uuc3VwcG9ydHNCb25lVGV4dHVyZXMgPyAxMDI0IDogdGhpcy5kZXZpY2UuYm9uZUxpbWl0O1xuXG4gICAgICAgIC8vIG1heGltdW0gbnVtYmVyIG9mIHZlcnRpY2VzIHRoYXQgY2FuIGJlIHVzZWQgaW4gYmF0Y2ggZGVwZW5kcyBvbiAzMmJpdCBpbmRleCBidWZmZXIgc3VwcG9ydCAoZG8gdGhpcyBmb3Igbm9uLWluZGV4ZWQgYXMgd2VsbCxcbiAgICAgICAgLy8gYXMgaW4gc29tZSBjYXNlcyAoVUkgZWxlbWVudHMpIG5vbi1pbmRleGVkIGdlb21ldHJ5IGdldHMgYmF0Y2hlZCBpbnRvIGluZGV4ZWQpXG4gICAgICAgIGNvbnN0IG1heE51bVZlcnRpY2VzID0gdGhpcy5kZXZpY2UuZXh0VWludEVsZW1lbnQgPyAweGZmZmZmZmZmIDogMHhmZmZmO1xuXG4gICAgICAgIGNvbnN0IGFhYmIgPSBuZXcgQm91bmRpbmdCb3goKTtcbiAgICAgICAgY29uc3QgdGVzdEFhYmIgPSBuZXcgQm91bmRpbmdCb3goKTtcbiAgICAgICAgbGV0IHNraXBUcmFuc2x1Y2VudEFhYmIgPSBudWxsO1xuICAgICAgICBsZXQgc2Y7XG5cbiAgICAgICAgY29uc3QgbGlzdHMgPSBbXTtcbiAgICAgICAgbGV0IGogPSAwO1xuICAgICAgICBpZiAodHJhbnNsdWNlbnQpIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLmRyYXdPcmRlciAtIGIuZHJhd09yZGVyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IG1lc2hJbnN0YW5jZXNMZWZ0QSA9IG1lc2hJbnN0YW5jZXM7XG4gICAgICAgIGxldCBtZXNoSW5zdGFuY2VzTGVmdEI7XG5cbiAgICAgICAgY29uc3Qgc2tpcE1lc2ggPSB0cmFuc2x1Y2VudCA/IGZ1bmN0aW9uIChtaSkge1xuICAgICAgICAgICAgaWYgKHNraXBUcmFuc2x1Y2VudEFhYmIpIHtcbiAgICAgICAgICAgICAgICBza2lwVHJhbnNsdWNlbnRBYWJiLmFkZChtaS5hYWJiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2tpcFRyYW5zbHVjZW50QWFiYiA9IG1pLmFhYmIuY2xvbmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNMZWZ0Qi5wdXNoKG1pKTtcbiAgICAgICAgfSA6IGZ1bmN0aW9uIChtaSkge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlc0xlZnRCLnB1c2gobWkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHdoaWxlIChtZXNoSW5zdGFuY2VzTGVmdEEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGlzdHNbal0gPSBbbWVzaEluc3RhbmNlc0xlZnRBWzBdXTtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNMZWZ0QiA9IFtdO1xuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0ubWF0ZXJpYWw7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5sYXllcjtcbiAgICAgICAgICAgIGNvbnN0IGRlZnMgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0uX3NoYWRlckRlZnM7XG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0ucGFyYW1ldGVycztcbiAgICAgICAgICAgIGNvbnN0IHN0ZW5jaWwgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0uc3RlbmNpbEZyb250O1xuICAgICAgICAgICAgY29uc3QgbGlnaHRMaXN0ID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLl9zdGF0aWNMaWdodExpc3Q7XG4gICAgICAgICAgICBsZXQgdmVydENvdW50ID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLm1lc2gudmVydGV4QnVmZmVyLmdldE51bVZlcnRpY2VzKCk7XG4gICAgICAgICAgICBjb25zdCBkcmF3T3JkZXIgPSBtZXNoSW5zdGFuY2VzTGVmdEFbMF0uZHJhd09yZGVyO1xuICAgICAgICAgICAgYWFiYi5jb3B5KG1lc2hJbnN0YW5jZXNMZWZ0QVswXS5hYWJiKTtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlU2lnbiA9IGdldFNjYWxlU2lnbihtZXNoSW5zdGFuY2VzTGVmdEFbMF0pO1xuICAgICAgICAgICAgY29uc3QgdmVydGV4Rm9ybWF0QmF0Y2hpbmdIYXNoID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5iYXRjaGluZ0hhc2g7XG4gICAgICAgICAgICBjb25zdCBpbmRleGVkID0gbWVzaEluc3RhbmNlc0xlZnRBWzBdLm1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQ7XG4gICAgICAgICAgICBza2lwVHJhbnNsdWNlbnRBYWJiID0gbnVsbDtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBtZXNoSW5zdGFuY2VzTGVmdEEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IG1lc2hJbnN0YW5jZXNMZWZ0QVtpXTtcblxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IGluc3RhbmNlIG51bWJlclxuICAgICAgICAgICAgICAgIGlmIChkeW5hbWljICYmIGxpc3RzW2pdLmxlbmd0aCA+PSBtYXhJbnN0YW5jZUNvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNMZWZ0QiA9IG1lc2hJbnN0YW5jZXNMZWZ0Qi5jb25jYXQobWVzaEluc3RhbmNlc0xlZnRBLnNsaWNlKGkpKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgYnkgbWF0ZXJpYWwsIGxheWVyIChsZWdhY3kpLCB2ZXJ0ZXggZm9ybWF0ICYgaW5kZXggY29tcGF0aWJpbGl0eSwgc2hhZGVyIGRlZmluZXMsIHN0YXRpYyBzb3VyY2UsIHZlcnQgY291bnQsIG92ZXJsYXBwaW5nIFVJXG4gICAgICAgICAgICAgICAgaWYgKChtYXRlcmlhbCAhPT0gbWkubWF0ZXJpYWwpIHx8XG4gICAgICAgICAgICAgICAgICAgIChsYXllciAhPT0gbWkubGF5ZXIpIHx8XG4gICAgICAgICAgICAgICAgICAgICh2ZXJ0ZXhGb3JtYXRCYXRjaGluZ0hhc2ggIT09IG1pLm1lc2gudmVydGV4QnVmZmVyLmZvcm1hdC5iYXRjaGluZ0hhc2gpIHx8XG4gICAgICAgICAgICAgICAgICAgIChpbmRleGVkICE9PSBtaS5tZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkKSB8fFxuICAgICAgICAgICAgICAgICAgICAoZGVmcyAhPT0gbWkuX3NoYWRlckRlZnMpIHx8XG4gICAgICAgICAgICAgICAgICAgICh2ZXJ0Q291bnQgKyBtaS5tZXNoLnZlcnRleEJ1ZmZlci5nZXROdW1WZXJ0aWNlcygpID4gbWF4TnVtVmVydGljZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IEFBQkJcbiAgICAgICAgICAgICAgICB0ZXN0QWFiYi5jb3B5KGFhYmIpO1xuICAgICAgICAgICAgICAgIHRlc3RBYWJiLmFkZChtaS5hYWJiKTtcbiAgICAgICAgICAgICAgICBpZiAodGVzdEFhYmIuaGFsZkV4dGVudHMueCA+IGhhbGZNYXhBYWJiU2l6ZSB8fFxuICAgICAgICAgICAgICAgICAgICB0ZXN0QWFiYi5oYWxmRXh0ZW50cy55ID4gaGFsZk1heEFhYmJTaXplIHx8XG4gICAgICAgICAgICAgICAgICAgIHRlc3RBYWJiLmhhbGZFeHRlbnRzLnogPiBoYWxmTWF4QWFiYlNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgc3RlbmNpbCBtYXNrIChVSSBlbGVtZW50cyksIGJvdGggZnJvbnQgYW5kIGJhY2sgZXhwZWN0ZWQgdG8gYmUgdGhlIHNhbWVcbiAgICAgICAgICAgICAgICBpZiAoc3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIShzZiA9IG1pLnN0ZW5jaWxGcm9udCkgfHwgc3RlbmNpbC5mdW5jICE9PSBzZi5mdW5jIHx8IHN0ZW5jaWwuenBhc3MgIT09IHNmLnpwYXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBza2lwTWVzaChtaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBieSBuZWdhdGl2ZSBzY2FsZVxuICAgICAgICAgICAgICAgIGlmIChzY2FsZVNpZ24gIT09IGdldFNjYWxlU2lnbihtaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2tpcE1lc2gobWkpO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBTcGxpdCBieSBwYXJhbWV0ZXJzXG4gICAgICAgICAgICAgICAgaWYgKCFlcXVhbFBhcmFtU2V0cyhwYXJhbXMsIG1pLnBhcmFtZXRlcnMpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IHN0YXRpYyBsaWdodCBsaXN0XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RhdGljTGlnaHRzID0gbWkuX3N0YXRpY0xpZ2h0TGlzdDtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHRMaXN0ICYmIHN0YXRpY0xpZ2h0cykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVxdWFsTGlnaHRMaXN0cyhsaWdodExpc3QsIHN0YXRpY0xpZ2h0cykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChsaWdodExpc3QgfHwgc3RhdGljTGlnaHRzKSB7IC8vIFNwbGl0IGJ5IHN0YXRpYy9ub24gc3RhdGljXG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRyYW5zbHVjZW50ICYmIHNraXBUcmFuc2x1Y2VudEFhYmIgJiYgc2tpcFRyYW5zbHVjZW50QWFiYi5pbnRlcnNlY3RzKG1pLmFhYmIpICYmIG1pLmRyYXdPcmRlciAhPT0gZHJhd09yZGVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNraXBNZXNoKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYWFiYi5hZGQobWkuYWFiYik7XG4gICAgICAgICAgICAgICAgdmVydENvdW50ICs9IG1pLm1lc2gudmVydGV4QnVmZmVyLmdldE51bVZlcnRpY2VzKCk7XG4gICAgICAgICAgICAgICAgbGlzdHNbal0ucHVzaChtaSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNMZWZ0QSA9IG1lc2hJbnN0YW5jZXNMZWZ0QjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsaXN0cztcbiAgICB9XG5cbiAgICBjb2xsZWN0QmF0Y2hlZE1lc2hEYXRhKG1lc2hJbnN0YW5jZXMsIGR5bmFtaWMpIHtcblxuICAgICAgICBsZXQgc3RyZWFtcyA9IG51bGw7XG4gICAgICAgIGxldCBiYXRjaE51bVZlcnRzID0gMDtcbiAgICAgICAgbGV0IGJhdGNoTnVtSW5kaWNlcyA9IDA7XG4gICAgICAgIGxldCBtYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobWVzaEluc3RhbmNlc1tpXS52aXNpYmxlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB2ZXJ0ZXggY291bnRzXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZXNbaV0ubWVzaDtcbiAgICAgICAgICAgICAgICBjb25zdCBudW1WZXJ0cyA9IG1lc2gudmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgICAgIGJhdGNoTnVtVmVydHMgKz0gbnVtVmVydHM7XG5cbiAgICAgICAgICAgICAgICAvLyBpbmRleCBjb3VudFxuICAgICAgICAgICAgICAgIGlmIChtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGJhdGNoTnVtSW5kaWNlcyArPSBtZXNoLnByaW1pdGl2ZVswXS5jb3VudDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBzcGVjaWFsIGNhc2Ugb2YgZmFuIC8gc3RyaXAgbm9uLWluZGV4ZWQgcHJpbWl0aXZlIHVzZWQgYnkgVUlcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlVHlwZSA9IG1lc2gucHJpbWl0aXZlWzBdLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcmltaXRpdmVUeXBlID09PSBQUklNSVRJVkVfVFJJRkFOIHx8IHByaW1pdGl2ZVR5cGUgPT09IFBSSU1JVElWRV9UUklTVFJJUCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID09PSA0KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhdGNoTnVtSW5kaWNlcyArPSA2O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgZmlyc3QgbWVzaFxuICAgICAgICAgICAgICAgIGlmICghc3RyZWFtcykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hdGVyaWFsXG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsID0gbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjb2xsZWN0IHVzZWQgdmVydGV4IGJ1ZmZlciBzZW1hbnRpYyBpbmZvcm1hdGlvbiBmcm9tIGZpcnN0IG1lc2ggKHRoZXkgYWxsIG1hdGNoKVxuICAgICAgICAgICAgICAgICAgICBzdHJlYW1zID0ge307XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1zID0gbWVzaC52ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGVsZW1zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGVsZW1zW2pdLm5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJlYW1zW3NlbWFudGljXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1Db21wb25lbnRzOiBlbGVtc1tqXS5udW1Db21wb25lbnRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFUeXBlOiBlbGVtc1tqXS5kYXRhVHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemU6IGVsZW1zW2pdLm5vcm1hbGl6ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogMFxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZvciBkeW5hbWljIG1lc2hlcyB3ZSBuZWVkIGJvbmUgaW5kaWNlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoZHluYW1pYykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtc1tTRU1BTlRJQ19CTEVORElORElDRVNdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUNvbXBvbmVudHM6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YVR5cGU6IFRZUEVfRkxPQVQzMixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxpemU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0cmVhbXM6IHN0cmVhbXMsXG4gICAgICAgICAgICBiYXRjaE51bVZlcnRzOiBiYXRjaE51bVZlcnRzLFxuICAgICAgICAgICAgYmF0Y2hOdW1JbmRpY2VzOiBiYXRjaE51bUluZGljZXMsXG4gICAgICAgICAgICBtYXRlcmlhbDogbWF0ZXJpYWxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUYWtlcyBhIG1lc2ggaW5zdGFuY2UgbGlzdCB0aGF0IGhhcyBiZWVuIHByZXBhcmVkIGJ5IHtAbGluayBCYXRjaE1hbmFnZXIjcHJlcGFyZX0sIGFuZFxuICAgICAqIHJldHVybnMgYSB7QGxpbmsgQmF0Y2h9IG9iamVjdC4gVGhpcyBtZXRob2QgYXNzdW1lcyB0aGF0IGFsbCBtZXNoIGluc3RhbmNlcyBwcm92aWRlZCBjYW4gYmVcbiAgICAgKiByZW5kZXJlZCBpbiBhIHNpbmdsZSBkcmF3IGNhbGwuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZVtdfSBtZXNoSW5zdGFuY2VzIC0gSW5wdXQgbGlzdCBvZiBtZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGR5bmFtaWMgLSBJcyBpdCBhIHN0YXRpYyBvciBkeW5hbWljIGJhdGNoPyBXaWxsIG9iamVjdHMgYmUgdHJhbnNmb3JtZWRcbiAgICAgKiBhZnRlciBiYXRjaGluZz9cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2JhdGNoR3JvdXBJZF0gLSBMaW5rIHRoaXMgYmF0Y2ggdG8gYSBzcGVjaWZpYyBiYXRjaCBncm91cC4gVGhpcyBpcyBkb25lXG4gICAgICogYXV0b21hdGljYWxseSB3aXRoIGRlZmF1bHQgYmF0Y2hlcy5cbiAgICAgKiBAcmV0dXJucyB7QmF0Y2h9IFRoZSByZXN1bHRpbmcgYmF0Y2ggb2JqZWN0LlxuICAgICAqL1xuICAgIGNyZWF0ZShtZXNoSW5zdGFuY2VzLCBkeW5hbWljLCBiYXRjaEdyb3VwSWQpIHtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKCF0aGlzLl9pbml0KSB7XG4gICAgICAgICAgICBjb25zdCBib25lTGltaXQgPSAnI2RlZmluZSBCT05FX0xJTUlUICcgKyB0aGlzLmRldmljZS5nZXRCb25lTGltaXQoKSArICdcXG4nO1xuICAgICAgICAgICAgdGhpcy50cmFuc2Zvcm1WUyA9IGJvbmVMaW1pdCArICcjZGVmaW5lIERZTkFNSUNCQVRDSFxcbicgKyBzaGFkZXJDaHVua3MudHJhbnNmb3JtVlM7XG4gICAgICAgICAgICB0aGlzLnNraW5UZXhWUyA9IHNoYWRlckNodW5rcy5za2luQmF0Y2hUZXhWUztcbiAgICAgICAgICAgIHRoaXMuc2tpbkNvbnN0VlMgPSBzaGFkZXJDaHVua3Muc2tpbkJhdGNoQ29uc3RWUztcbiAgICAgICAgICAgIHRoaXMudmVydGV4Rm9ybWF0cyA9IHt9O1xuICAgICAgICAgICAgdGhpcy5faW5pdCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RyZWFtID0gbnVsbDtcbiAgICAgICAgbGV0IHNlbWFudGljO1xuICAgICAgICBsZXQgbWVzaCwgbnVtVmVydHM7XG4gICAgICAgIGxldCBiYXRjaCA9IG51bGw7XG5cbiAgICAgICAgLy8gZmluZCBvdXQgdmVydGV4IHN0cmVhbXMgYW5kIGNvdW50c1xuICAgICAgICBjb25zdCBiYXRjaERhdGEgPSB0aGlzLmNvbGxlY3RCYXRjaGVkTWVzaERhdGEobWVzaEluc3RhbmNlcywgZHluYW1pYyk7XG5cbiAgICAgICAgLy8gaWYgYW55dGhpbmcgdG8gYmF0Y2hcbiAgICAgICAgaWYgKGJhdGNoRGF0YS5zdHJlYW1zKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHN0cmVhbXMgPSBiYXRjaERhdGEuc3RyZWFtcztcbiAgICAgICAgICAgIGxldCBtYXRlcmlhbCA9IGJhdGNoRGF0YS5tYXRlcmlhbDtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoTnVtVmVydHMgPSBiYXRjaERhdGEuYmF0Y2hOdW1WZXJ0cztcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoTnVtSW5kaWNlcyA9IGJhdGNoRGF0YS5iYXRjaE51bUluZGljZXM7XG5cbiAgICAgICAgICAgIGJhdGNoID0gbmV3IEJhdGNoKG1lc2hJbnN0YW5jZXMsIGR5bmFtaWMsIGJhdGNoR3JvdXBJZCk7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaExpc3QucHVzaChiYXRjaCk7XG5cbiAgICAgICAgICAgIGxldCBpbmRleEJhc2UsIG51bUluZGljZXMsIGluZGV4RGF0YTtcbiAgICAgICAgICAgIGxldCB2ZXJ0aWNlc09mZnNldCA9IDA7XG4gICAgICAgICAgICBsZXQgaW5kZXhPZmZzZXQgPSAwO1xuICAgICAgICAgICAgbGV0IHRyYW5zZm9ybTtcbiAgICAgICAgICAgIGNvbnN0IHZlYyA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIGluZGljZXNcbiAgICAgICAgICAgIGNvbnN0IGluZGV4QXJyYXlUeXBlID0gYmF0Y2hOdW1WZXJ0cyA8PSAweGZmZmYgPyBVaW50MTZBcnJheSA6IFVpbnQzMkFycmF5O1xuICAgICAgICAgICAgY29uc3QgaW5kaWNlcyA9IG5ldyBpbmRleEFycmF5VHlwZShiYXRjaE51bUluZGljZXMpO1xuXG4gICAgICAgICAgICAvLyBhbGxvY2F0ZSB0eXBlZCBhcnJheXMgdG8gc3RvcmUgZmluYWwgdmVydGV4IHN0cmVhbSBkYXRhXG4gICAgICAgICAgICBmb3IgKHNlbWFudGljIGluIHN0cmVhbXMpIHtcbiAgICAgICAgICAgICAgICBzdHJlYW0gPSBzdHJlYW1zW3NlbWFudGljXTtcbiAgICAgICAgICAgICAgICBzdHJlYW0udHlwZUFycmF5VHlwZSA9IHR5cGVkQXJyYXlUeXBlc1tzdHJlYW0uZGF0YVR5cGVdO1xuICAgICAgICAgICAgICAgIHN0cmVhbS5lbGVtZW50Qnl0ZVNpemUgPSB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVtzdHJlYW0uZGF0YVR5cGVdO1xuICAgICAgICAgICAgICAgIHN0cmVhbS5idWZmZXIgPSBuZXcgc3RyZWFtLnR5cGVBcnJheVR5cGUoYmF0Y2hOdW1WZXJ0cyAqIHN0cmVhbS5udW1Db21wb25lbnRzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYnVpbGQgdmVydGV4IGFuZCBpbmRleCBkYXRhIGZvciBmaW5hbCBtZXNoXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIW1lc2hJbnN0YW5jZXNbaV0udmlzaWJsZSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBtZXNoID0gbWVzaEluc3RhbmNlc1tpXS5tZXNoO1xuICAgICAgICAgICAgICAgIG51bVZlcnRzID0gbWVzaC52ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG5cbiAgICAgICAgICAgICAgICAvLyBtYXRyaXggdG8gdHJhbnNmb3JtIHZlcnRpY2VzIHRvIHdvcmxkIHNwYWNlIGZvciBzdGF0aWMgYmF0Y2hpbmdcbiAgICAgICAgICAgICAgICBpZiAoIWR5bmFtaWMpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtID0gbWVzaEluc3RhbmNlc1tpXS5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChzZW1hbnRpYyBpbiBzdHJlYW1zKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzZW1hbnRpYyAhPT0gU0VNQU5USUNfQkxFTkRJTkRJQ0VTKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJlYW0gPSBzdHJlYW1zW3NlbWFudGljXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2V0IHZlcnRleCBzdHJlYW0gdG8gdHlwZWQgdmlldyBzdWJhcnJheVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViYXJyYXkgPSBuZXcgc3RyZWFtLnR5cGVBcnJheVR5cGUoc3RyZWFtLmJ1ZmZlci5idWZmZXIsIHN0cmVhbS5lbGVtZW50Qnl0ZVNpemUgKiBzdHJlYW0uY291bnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdG90YWxDb21wb25lbnRzID0gbWVzaC5nZXRWZXJ0ZXhTdHJlYW0oc2VtYW50aWMsIHN1YmFycmF5KSAqIHN0cmVhbS5udW1Db21wb25lbnRzO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtLmNvdW50ICs9IHRvdGFsQ29tcG9uZW50cztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIHBvc2l0aW9uLCBub3JtYWwgYW5kIHRhbmdlbnQgdG8gd29ybGQgc3BhY2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZHluYW1pYyAmJiBzdHJlYW0ubnVtQ29tcG9uZW50cyA+PSAzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNlbWFudGljID09PSBTRU1BTlRJQ19QT1NJVElPTikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRvdGFsQ29tcG9uZW50czsgaiArPSBzdHJlYW0ubnVtQ29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVjLnNldChzdWJhcnJheVtqXSwgc3ViYXJyYXlbaiArIDFdLCBzdWJhcnJheVtqICsgMl0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtLnRyYW5zZm9ybVBvaW50KHZlYywgdmVjKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YmFycmF5W2pdID0gdmVjLng7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqICsgMV0gPSB2ZWMueTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1YmFycmF5W2ogKyAyXSA9IHZlYy56O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzZW1hbnRpYyA9PT0gU0VNQU5USUNfTk9STUFMIHx8IHNlbWFudGljID09PSBTRU1BTlRJQ19UQU5HRU5UKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gaGFuZGxlIG5vbi11bmlmb3JtIHNjYWxlIGJ5IHVzaW5nIHRyYW5zcG9zZWQgaW52ZXJzZSBtYXRyaXggdG8gdHJhbnNmb3JtIHZlY3RvcnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtLmludmVydFRvM3gzKG1hdDMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXQzLnRyYW5zcG9zZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdG90YWxDb21wb25lbnRzOyBqICs9IHN0cmVhbS5udW1Db21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZWMuc2V0KHN1YmFycmF5W2pdLCBzdWJhcnJheVtqICsgMV0sIHN1YmFycmF5W2ogKyAyXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXQzLnRyYW5zZm9ybVZlY3Rvcih2ZWMsIHZlYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqXSA9IHZlYy54O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3ViYXJyYXlbaiArIDFdID0gdmVjLnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWJhcnJheVtqICsgMl0gPSB2ZWMuejtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGJvbmUgaW5kZXggaXMgbWVzaCBpbmRleFxuICAgICAgICAgICAgICAgIGlmIChkeW5hbWljKSB7XG4gICAgICAgICAgICAgICAgICAgIHN0cmVhbSA9IHN0cmVhbXNbU0VNQU5USUNfQkxFTkRJTkRJQ0VTXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1WZXJ0czsgaisrKVxuICAgICAgICAgICAgICAgICAgICAgICAgc3RyZWFtLmJ1ZmZlcltzdHJlYW0uY291bnQrK10gPSBpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGluZGV4IGJ1ZmZlclxuICAgICAgICAgICAgICAgIGlmIChtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4QmFzZSA9IG1lc2gucHJpbWl0aXZlWzBdLmJhc2U7XG4gICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSBtZXNoLnByaW1pdGl2ZVswXS5jb3VudDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBzb3VyY2UgaW5kZXggYnVmZmVyIGRhdGEgbWFwcGVkIHRvIGl0cyBmb3JtYXRcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3JjRm9ybWF0ID0gbWVzaC5pbmRleEJ1ZmZlclswXS5nZXRGb3JtYXQoKTtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhEYXRhID0gbmV3IHR5cGVkQXJyYXlJbmRleEZvcm1hdHNbc3JjRm9ybWF0XShtZXNoLmluZGV4QnVmZmVyWzBdLnN0b3JhZ2UpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gbm9uLWluZGV4ZWRcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmltaXRpdmVUeXBlID0gbWVzaC5wcmltaXRpdmVbMF0udHlwZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByaW1pdGl2ZVR5cGUgPT09IFBSSU1JVElWRV9UUklGQU4gfHwgcHJpbWl0aXZlVHlwZSA9PT0gUFJJTUlUSVZFX1RSSVNUUklQKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWVzaC5wcmltaXRpdmVbMF0uY291bnQgPT09IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleEJhc2UgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSA2O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGV4RGF0YSA9IHByaW1pdGl2ZVR5cGUgPT09IFBSSU1JVElWRV9UUklGQU4gPyBfdHJpRmFuSW5kaWNlcyA6IF90cmlTdHJpcEluZGljZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1JbmRpY2VzOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlc1tqICsgaW5kZXhPZmZzZXRdID0gaW5kZXhEYXRhW2luZGV4QmFzZSArIGpdICsgdmVydGljZXNPZmZzZXQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaW5kZXhPZmZzZXQgKz0gbnVtSW5kaWNlcztcbiAgICAgICAgICAgICAgICB2ZXJ0aWNlc09mZnNldCArPSBudW1WZXJ0cztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ3JlYXRlIG1lc2hcbiAgICAgICAgICAgIG1lc2ggPSBuZXcgTWVzaCh0aGlzLmRldmljZSk7XG4gICAgICAgICAgICBmb3IgKHNlbWFudGljIGluIHN0cmVhbXMpIHtcbiAgICAgICAgICAgICAgICBzdHJlYW0gPSBzdHJlYW1zW3NlbWFudGljXTtcbiAgICAgICAgICAgICAgICBtZXNoLnNldFZlcnRleFN0cmVhbShzZW1hbnRpYywgc3RyZWFtLmJ1ZmZlciwgc3RyZWFtLm51bUNvbXBvbmVudHMsIHVuZGVmaW5lZCwgc3RyZWFtLmRhdGFUeXBlLCBzdHJlYW0ubm9ybWFsaXplKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGluZGljZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBtZXNoLnNldEluZGljZXMoaW5kaWNlcyk7XG5cbiAgICAgICAgICAgIG1lc2gudXBkYXRlKFBSSU1JVElWRV9UUklBTkdMRVMsIGZhbHNlKTtcblxuICAgICAgICAgICAgLy8gUGF0Y2ggdGhlIG1hdGVyaWFsXG4gICAgICAgICAgICBpZiAoZHluYW1pYykge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsID0gbWF0ZXJpYWwuY2xvbmUoKTtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5jaHVua3MudHJhbnNmb3JtVlMgPSB0aGlzLnRyYW5zZm9ybVZTO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmNodW5rcy5za2luVGV4VlMgPSB0aGlzLnNraW5UZXhWUztcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5jaHVua3Muc2tpbkNvbnN0VlMgPSB0aGlzLnNraW5Db25zdFZTO1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgbWVzaEluc3RhbmNlXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIG1hdGVyaWFsLCB0aGlzLnJvb3ROb2RlKTtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5jYXN0U2hhZG93ID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0uY2FzdFNoYWRvdztcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5wYXJhbWV0ZXJzID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0ucGFyYW1ldGVycztcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5pc1N0YXRpYyA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLmlzU3RhdGljO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmxheWVyID0gYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0ubGF5ZXI7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuX3N0YXRpY0xpZ2h0TGlzdCA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLl9zdGF0aWNMaWdodExpc3Q7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuX3NoYWRlckRlZnMgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5fc2hhZGVyRGVmcztcblxuICAgICAgICAgICAgLy8gbWVzaEluc3RhbmNlIGN1bGxpbmcgLSBkb24ndCBjdWxsIFVJIGVsZW1lbnRzLCBhcyB0aGV5IHVzZSBjdXN0b20gY3VsbGluZyBDb21wb25lbnQuaXNWaXNpYmxlRm9yQ2FtZXJhXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuY3VsbCA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLmN1bGw7XG4gICAgICAgICAgICBjb25zdCBiYXRjaEdyb3VwID0gdGhpcy5fYmF0Y2hHcm91cHNbYmF0Y2hHcm91cElkXTtcbiAgICAgICAgICAgIGlmIChiYXRjaEdyb3VwICYmIGJhdGNoR3JvdXAuX3VpKVxuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5jdWxsID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmIChkeW5hbWljKSB7XG4gICAgICAgICAgICAgICAgLy8gQ3JlYXRlIHNraW5JbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVzID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiYXRjaC5vcmlnTWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBub2Rlcy5wdXNoKGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzW2ldLm5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlID0gbmV3IFNraW5CYXRjaEluc3RhbmNlKHRoaXMuZGV2aWNlLCBub2RlcywgdGhpcy5yb290Tm9kZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGRpc2FibGUgYWFiYiB1cGRhdGUsIGdldHMgdXBkYXRlZCBtYW51YWxseSBieSBiYXRjaGVyXG4gICAgICAgICAgICBtZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmIgPSBmYWxzZTtcblxuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IGJhdGNoLm9yaWdNZXNoSW5zdGFuY2VzWzBdLmRyYXdPcmRlcjtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5zdGVuY2lsRnJvbnQgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5zdGVuY2lsRnJvbnQ7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc3RlbmNpbEJhY2sgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5zdGVuY2lsQmFjaztcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5mbGlwRmFjZXNGYWN0b3IgPSBnZXRTY2FsZVNpZ24oYmF0Y2gub3JpZ01lc2hJbnN0YW5jZXNbMF0pO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBiYXRjaC5vcmlnTWVzaEluc3RhbmNlc1swXS5jYXN0U2hhZG93O1xuXG4gICAgICAgICAgICBiYXRjaC5tZXNoSW5zdGFuY2UgPSBtZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICBiYXRjaC51cGRhdGVCb3VuZGluZ0JveCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9zdGF0cy5jcmVhdGVUaW1lICs9IG5vdygpIC0gdGltZTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgcmV0dXJuIGJhdGNoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgYm91bmRpbmcgYm94ZXMgZm9yIGFsbCBkeW5hbWljIGJhdGNoZXMuIENhbGxlZCBhdXRvbWF0aWNhbGx5LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUFsbCgpIHtcbiAgICAgICAgLy8gVE9ETzogb25seSBjYWxsIHdoZW4gbmVlZGVkLiBBcHBsaWVzIHRvIHNraW5uaW5nIG1hdHJpY2VzIGFzIHdlbGxcblxuICAgICAgICBpZiAodGhpcy5fZGlydHlHcm91cHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdGhpcy5nZW5lcmF0ZSh0aGlzLl9kaXJ0eUdyb3Vwcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGNvbnN0IHRpbWUgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9iYXRjaExpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fYmF0Y2hMaXN0W2ldLmR5bmFtaWMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hMaXN0W2ldLnVwZGF0ZUJvdW5kaW5nQm94KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3N0YXRzLnVwZGF0ZUxhc3RGcmFtZVRpbWUgPSBub3coKSAtIHRpbWU7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lcyBhIGJhdGNoLiBUaGlzIG1ldGhvZCBkb2Vzbid0IHJlYnVpbGQgYmF0Y2ggZ2VvbWV0cnksIGJ1dCBvbmx5IGNyZWF0ZXMgYSBuZXcgbW9kZWwgYW5kXG4gICAgICogYmF0Y2ggb2JqZWN0cywgbGlua2VkIHRvIGRpZmZlcmVudCBzb3VyY2UgbWVzaCBpbnN0YW5jZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0JhdGNofSBiYXRjaCAtIEEgYmF0Y2ggb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7TWVzaEluc3RhbmNlW119IGNsb25lZE1lc2hJbnN0YW5jZXMgLSBOZXcgbWVzaCBpbnN0YW5jZXMuXG4gICAgICogQHJldHVybnMge0JhdGNofSBOZXcgYmF0Y2ggb2JqZWN0LlxuICAgICAqL1xuICAgIGNsb25lKGJhdGNoLCBjbG9uZWRNZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoMiA9IG5ldyBCYXRjaChjbG9uZWRNZXNoSW5zdGFuY2VzLCBiYXRjaC5keW5hbWljLCBiYXRjaC5iYXRjaEdyb3VwSWQpO1xuICAgICAgICB0aGlzLl9iYXRjaExpc3QucHVzaChiYXRjaDIpO1xuXG4gICAgICAgIGNvbnN0IG5vZGVzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2xvbmVkTWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbm9kZXMucHVzaChjbG9uZWRNZXNoSW5zdGFuY2VzW2ldLm5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UoYmF0Y2gubWVzaEluc3RhbmNlLm1lc2gsIGJhdGNoLm1lc2hJbnN0YW5jZS5tYXRlcmlhbCwgYmF0Y2gubWVzaEluc3RhbmNlLm5vZGUpO1xuICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlLl91cGRhdGVBYWJiID0gZmFsc2U7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UucGFyYW1ldGVycyA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0ucGFyYW1ldGVycztcbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5pc1N0YXRpYyA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0uaXNTdGF0aWM7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuY3VsbCA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0uY3VsbDtcbiAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5sYXllciA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0ubGF5ZXI7XG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuX3N0YXRpY0xpZ2h0TGlzdCA9IGNsb25lZE1lc2hJbnN0YW5jZXNbMF0uX3N0YXRpY0xpZ2h0TGlzdDtcblxuICAgICAgICBpZiAoYmF0Y2guZHluYW1pYykge1xuICAgICAgICAgICAgYmF0Y2gyLm1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPSBuZXcgU2tpbkJhdGNoSW5zdGFuY2UodGhpcy5kZXZpY2UsIG5vZGVzLCB0aGlzLnJvb3ROb2RlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGJhdGNoLm1lc2hJbnN0YW5jZS5jYXN0U2hhZG93O1xuICAgICAgICBiYXRjaDIubWVzaEluc3RhbmNlLl9zaGFkZXIgPSBiYXRjaC5tZXNoSW5zdGFuY2UuX3NoYWRlci5zbGljZSgpO1xuXG4gICAgICAgIGJhdGNoMi5tZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGJhdGNoLm1lc2hJbnN0YW5jZS5jYXN0U2hhZG93O1xuXG4gICAgICAgIHJldHVybiBiYXRjaDI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyB0aGUgYmF0Y2ggbW9kZWwgZnJvbSBhbGwgbGF5ZXJzIGFuZCBkZXN0cm95cyBpdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QmF0Y2h9IGJhdGNoIC0gQSBiYXRjaCBvYmplY3QuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBkZXN0cm95QmF0Y2goYmF0Y2gpIHtcbiAgICAgICAgYmF0Y2guZGVzdHJveSh0aGlzLnNjZW5lLCB0aGlzLl9iYXRjaEdyb3Vwc1tiYXRjaC5iYXRjaEdyb3VwSWRdLmxheWVycyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBCYXRjaE1hbmFnZXIgfTtcbiJdLCJuYW1lcyI6WyJwYXJhbXNJZGVudGljYWwiLCJhIiwiYiIsImRhdGEiLCJGbG9hdDMyQXJyYXkiLCJsZW5ndGgiLCJpIiwiZXF1YWxQYXJhbVNldHMiLCJwYXJhbXMxIiwicGFyYW1zMiIsInBhcmFtIiwiaGFzT3duUHJvcGVydHkiLCJlcXVhbExpZ2h0TGlzdHMiLCJsaWdodExpc3QxIiwibGlnaHRMaXN0MiIsImsiLCJpbmRleE9mIiwiX3RyaUZhbkluZGljZXMiLCJfdHJpU3RyaXBJbmRpY2VzIiwibWF0MyIsIk1hdDMiLCJnZXRTY2FsZVNpZ24iLCJtaSIsIm5vZGUiLCJ3b3JsZFRyYW5zZm9ybSIsInNjYWxlU2lnbiIsIkJhdGNoTWFuYWdlciIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwicm9vdCIsInNjZW5lIiwicm9vdE5vZGUiLCJfaW5pdCIsIl9iYXRjaEdyb3VwcyIsIl9iYXRjaEdyb3VwQ291bnRlciIsIl9iYXRjaExpc3QiLCJfZGlydHlHcm91cHMiLCJfc3RhdHMiLCJjcmVhdGVUaW1lIiwidXBkYXRlTGFzdEZyYW1lVGltZSIsImRlc3Ryb3kiLCJhZGRHcm91cCIsIm5hbWUiLCJkeW5hbWljIiwibWF4QWFiYlNpemUiLCJpZCIsImxheWVycyIsInVuZGVmaW5lZCIsIkRlYnVnIiwiZXJyb3IiLCJncm91cCIsIkJhdGNoR3JvdXAiLCJyZW1vdmVHcm91cCIsIm5ld0JhdGNoTGlzdCIsImJhdGNoR3JvdXBJZCIsImRlc3Ryb3lCYXRjaCIsInB1c2giLCJfcmVtb3ZlTW9kZWxzRnJvbUJhdGNoR3JvdXAiLCJtYXJrR3JvdXBEaXJ0eSIsImdldEdyb3VwQnlOYW1lIiwiZ3JvdXBzIiwiZ2V0QmF0Y2hlcyIsInJlc3VsdHMiLCJsZW4iLCJiYXRjaCIsImVuYWJsZWQiLCJtb2RlbCIsInJlbmRlciIsImVsZW1lbnQiLCJzcHJpdGUiLCJfY2hpbGRyZW4iLCJpbnNlcnQiLCJ0eXBlIiwiZ3JvdXBJZCIsImFzc2VydCIsIl9vYmoiLCJyZW1vdmUiLCJpZHgiLCJzcGxpY2UiLCJfZXh0cmFjdFJlbmRlciIsImFyciIsImdyb3VwTWVzaEluc3RhbmNlcyIsImlzU3RhdGljIiwiZHJhd0NhbGxzIiwibm9kZU1lc2hJbnN0YW5jZXMiLCJtZXNoSW5zdGFuY2VzIiwiX3N0YXRpY1NvdXJjZSIsImNvbmNhdCIsInJlbW92ZUZyb21MYXllcnMiLCJfZXh0cmFjdE1vZGVsIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwiX2JhdGNoR3JvdXAiLCJfZXh0cmFjdEVsZW1lbnQiLCJ2YWxpZCIsIl90ZXh0IiwiX21vZGVsIiwiX2ltYWdlIiwiX3JlbmRlcmFibGUiLCJtZXNoSW5zdGFuY2UiLCJ1bm1hc2tNZXNoSW5zdGFuY2UiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsIl9kaXJ0aWZ5TWFzayIsIl9vblByZXJlbmRlciIsIl91aSIsIl9jb2xsZWN0QW5kUmVtb3ZlTWVzaEluc3RhbmNlcyIsImdyb3VwSWRzIiwiZyIsIm0iLCJyIiwiZSIsInMiLCJfbWVzaEluc3RhbmNlIiwiX3JlbmRlck1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9TSU1QTEUiLCJfc3ByaXRlIiwiZ2VuZXJhdGUiLCJPYmplY3QiLCJrZXlzIiwibmV3RGlydHlHcm91cHMiLCJsaXN0cyIsImdyb3VwRGF0YSIsInByZXBhcmUiLCJjcmVhdGUiLCJwYXJzZUludCIsImFkZFRvTGF5ZXJzIiwiTnVtYmVyIiwiUE9TSVRJVkVfSU5GSU5JVFkiLCJ0cmFuc2x1Y2VudCIsImhhbGZNYXhBYWJiU2l6ZSIsIm1heEluc3RhbmNlQ291bnQiLCJzdXBwb3J0c0JvbmVUZXh0dXJlcyIsImJvbmVMaW1pdCIsIm1heE51bVZlcnRpY2VzIiwiZXh0VWludEVsZW1lbnQiLCJhYWJiIiwiQm91bmRpbmdCb3giLCJ0ZXN0QWFiYiIsInNraXBUcmFuc2x1Y2VudEFhYmIiLCJzZiIsImoiLCJzb3J0IiwiZHJhd09yZGVyIiwibWVzaEluc3RhbmNlc0xlZnRBIiwibWVzaEluc3RhbmNlc0xlZnRCIiwic2tpcE1lc2giLCJhZGQiLCJjbG9uZSIsIm1hdGVyaWFsIiwibGF5ZXIiLCJkZWZzIiwiX3NoYWRlckRlZnMiLCJwYXJhbXMiLCJwYXJhbWV0ZXJzIiwic3RlbmNpbCIsImxpZ2h0TGlzdCIsIl9zdGF0aWNMaWdodExpc3QiLCJ2ZXJ0Q291bnQiLCJtZXNoIiwidmVydGV4QnVmZmVyIiwiZ2V0TnVtVmVydGljZXMiLCJjb3B5IiwidmVydGV4Rm9ybWF0QmF0Y2hpbmdIYXNoIiwiZm9ybWF0IiwiYmF0Y2hpbmdIYXNoIiwiaW5kZXhlZCIsInByaW1pdGl2ZSIsInNsaWNlIiwiaGFsZkV4dGVudHMiLCJ4IiwieSIsInoiLCJmdW5jIiwienBhc3MiLCJzdGF0aWNMaWdodHMiLCJpbnRlcnNlY3RzIiwiY29sbGVjdEJhdGNoZWRNZXNoRGF0YSIsInN0cmVhbXMiLCJiYXRjaE51bVZlcnRzIiwiYmF0Y2hOdW1JbmRpY2VzIiwidmlzaWJsZSIsIm51bVZlcnRzIiwibnVtVmVydGljZXMiLCJjb3VudCIsInByaW1pdGl2ZVR5cGUiLCJQUklNSVRJVkVfVFJJRkFOIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiZWxlbXMiLCJlbGVtZW50cyIsInNlbWFudGljIiwibnVtQ29tcG9uZW50cyIsImRhdGFUeXBlIiwibm9ybWFsaXplIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiVFlQRV9GTE9BVDMyIiwidGltZSIsIm5vdyIsImdldEJvbmVMaW1pdCIsInRyYW5zZm9ybVZTIiwic2hhZGVyQ2h1bmtzIiwic2tpblRleFZTIiwic2tpbkJhdGNoVGV4VlMiLCJza2luQ29uc3RWUyIsInNraW5CYXRjaENvbnN0VlMiLCJ2ZXJ0ZXhGb3JtYXRzIiwic3RyZWFtIiwiYmF0Y2hEYXRhIiwiQmF0Y2giLCJpbmRleEJhc2UiLCJudW1JbmRpY2VzIiwiaW5kZXhEYXRhIiwidmVydGljZXNPZmZzZXQiLCJpbmRleE9mZnNldCIsInRyYW5zZm9ybSIsInZlYyIsIlZlYzMiLCJpbmRleEFycmF5VHlwZSIsIlVpbnQxNkFycmF5IiwiVWludDMyQXJyYXkiLCJpbmRpY2VzIiwidHlwZUFycmF5VHlwZSIsInR5cGVkQXJyYXlUeXBlcyIsImVsZW1lbnRCeXRlU2l6ZSIsInR5cGVkQXJyYXlUeXBlc0J5dGVTaXplIiwiYnVmZmVyIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJzdWJhcnJheSIsInRvdGFsQ29tcG9uZW50cyIsImdldFZlcnRleFN0cmVhbSIsIlNFTUFOVElDX1BPU0lUSU9OIiwic2V0IiwidHJhbnNmb3JtUG9pbnQiLCJTRU1BTlRJQ19OT1JNQUwiLCJTRU1BTlRJQ19UQU5HRU5UIiwiaW52ZXJ0VG8zeDMiLCJ0cmFuc3Bvc2UiLCJ0cmFuc2Zvcm1WZWN0b3IiLCJiYXNlIiwic3JjRm9ybWF0IiwiaW5kZXhCdWZmZXIiLCJnZXRGb3JtYXQiLCJ0eXBlZEFycmF5SW5kZXhGb3JtYXRzIiwic3RvcmFnZSIsIk1lc2giLCJzZXRWZXJ0ZXhTdHJlYW0iLCJzZXRJbmRpY2VzIiwidXBkYXRlIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsImNodW5rcyIsIk1lc2hJbnN0YW5jZSIsImNhc3RTaGFkb3ciLCJvcmlnTWVzaEluc3RhbmNlcyIsImN1bGwiLCJiYXRjaEdyb3VwIiwibm9kZXMiLCJza2luSW5zdGFuY2UiLCJTa2luQmF0Y2hJbnN0YW5jZSIsIl91cGRhdGVBYWJiIiwiZmxpcEZhY2VzRmFjdG9yIiwidXBkYXRlQm91bmRpbmdCb3giLCJ1cGRhdGVBbGwiLCJjbG9uZWRNZXNoSW5zdGFuY2VzIiwiYmF0Y2gyIiwiX3NoYWRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFxQkEsU0FBU0EsZUFBZUEsQ0FBQ0MsQ0FBQyxFQUFFQyxDQUFDLEVB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
