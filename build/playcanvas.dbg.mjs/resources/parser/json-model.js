/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../math/mat4.js';
import { Vec3 } from '../../math/vec3.js';
import { BoundingBox } from '../../shape/bounding-box.js';
import { SEMANTIC_COLOR, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN, TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7 } from '../../graphics/constants.js';
import { IndexBuffer } from '../../graphics/index-buffer.js';
import { VertexBuffer } from '../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../graphics/vertex-format.js';
import { VertexIterator } from '../../graphics/vertex-iterator.js';
import { partitionSkin } from '../../scene/skin-partition.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Mesh } from '../../scene/mesh.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Model } from '../../scene/model.js';
import { Morph } from '../../scene/morph.js';
import { MorphInstance } from '../../scene/morph-instance.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { Skin } from '../../scene/skin.js';
import { SkinInstance } from '../../scene/skin-instance.js';

const JSON_PRIMITIVE_TYPE = {
  'points': PRIMITIVE_POINTS,
  'lines': PRIMITIVE_LINES,
  'lineloop': PRIMITIVE_LINELOOP,
  'linestrip': PRIMITIVE_LINESTRIP,
  'triangles': PRIMITIVE_TRIANGLES,
  'trianglestrip': PRIMITIVE_TRISTRIP,
  'trianglefan': PRIMITIVE_TRIFAN
};
const JSON_VERTEX_ELEMENT_TYPE = {
  'int8': TYPE_INT8,
  'uint8': TYPE_UINT8,
  'int16': TYPE_INT16,
  'uint16': TYPE_UINT16,
  'int32': TYPE_INT32,
  'uint32': TYPE_UINT32,
  'float32': TYPE_FLOAT32
};

class JsonModelParser {
  constructor(device, defaultMaterial) {
    this._device = device;
    this._defaultMaterial = defaultMaterial;
  }

  parse(data) {
    const modelData = data.model;

    if (!modelData) {
      return null;
    }

    if (modelData.version <= 1) {
      Debug.warn('JsonModelParser#parse: Trying to parse unsupported model format.');
      return null;
    }

    const nodes = this._parseNodes(data);

    const skins = this._parseSkins(data, nodes);

    const vertexBuffers = this._parseVertexBuffers(data);

    const indices = this._parseIndexBuffers(data, vertexBuffers);

    const morphs = this._parseMorphs(data, nodes, vertexBuffers);

    const meshes = this._parseMeshes(data, skins.skins, morphs.morphs, vertexBuffers, indices.buffer, indices.data);

    const meshInstances = this._parseMeshInstances(data, nodes, meshes, skins.skins, skins.instances, morphs.morphs, morphs.instances);

    const model = new Model();
    model.graph = nodes[0];
    model.meshInstances = meshInstances;
    model.skinInstances = skins.instances;
    model.morphInstances = morphs.instances;
    model.getGraph().syncHierarchy();
    return model;
  }

  _parseNodes(data) {
    const modelData = data.model;
    const nodes = [];
    let i;

    for (i = 0; i < modelData.nodes.length; i++) {
      const nodeData = modelData.nodes[i];
      const node = new GraphNode(nodeData.name);
      node.setLocalPosition(nodeData.position[0], nodeData.position[1], nodeData.position[2]);
      node.setLocalEulerAngles(nodeData.rotation[0], nodeData.rotation[1], nodeData.rotation[2]);
      node.setLocalScale(nodeData.scale[0], nodeData.scale[1], nodeData.scale[2]);
      node.scaleCompensation = !!nodeData.scaleCompensation;
      nodes.push(node);
    }

    for (i = 1; i < modelData.parents.length; i++) {
      nodes[modelData.parents[i]].addChild(nodes[i]);
    }

    return nodes;
  }

  _parseSkins(data, nodes) {
    const modelData = data.model;
    const skins = [];
    const skinInstances = [];
    let i, j;

    if (!this._device.supportsBoneTextures && modelData.skins.length > 0) {
      const boneLimit = this._device.getBoneLimit();

      partitionSkin(modelData, null, boneLimit);
    }

    for (i = 0; i < modelData.skins.length; i++) {
      const skinData = modelData.skins[i];
      const inverseBindMatrices = [];

      for (j = 0; j < skinData.inverseBindMatrices.length; j++) {
        const ibm = skinData.inverseBindMatrices[j];
        inverseBindMatrices[j] = new Mat4().set(ibm);
      }

      const skin = new Skin(this._device, inverseBindMatrices, skinData.boneNames);
      skins.push(skin);
      const skinInstance = new SkinInstance(skin);
      const bones = [];

      for (j = 0; j < skin.boneNames.length; j++) {
        const boneName = skin.boneNames[j];
        const bone = nodes[0].findByName(boneName);
        bones.push(bone);
      }

      skinInstance.bones = bones;
      skinInstances.push(skinInstance);
    }

    return {
      skins: skins,
      instances: skinInstances
    };
  }

  _getMorphVertexCount(modelData, morphIndex, vertexBuffers) {
    for (let i = 0; i < modelData.meshes.length; i++) {
      const meshData = modelData.meshes[i];

      if (meshData.morph === morphIndex) {
        const vertexBuffer = vertexBuffers[meshData.vertices];
        return vertexBuffer.numVertices;
      }
    }

    return undefined;
  }

  _parseMorphs(data, nodes, vertexBuffers) {
    const modelData = data.model;
    const morphs = [];
    const morphInstances = [];
    let i, j, vertexCount;
    let targets, morphTarget, morphTargetArray;

    if (modelData.morphs) {
      const sparseToFull = function sparseToFull(data, indices, totalCount) {
        const full = new Float32Array(totalCount * 3);

        for (let s = 0; s < indices.length; s++) {
          const dstIndex = indices[s] * 3;
          full[dstIndex] = data[s * 3];
          full[dstIndex + 1] = data[s * 3 + 1];
          full[dstIndex + 2] = data[s * 3 + 2];
        }

        return full;
      };

      for (i = 0; i < modelData.morphs.length; i++) {
        targets = modelData.morphs[i].targets;
        morphTargetArray = [];
        vertexCount = this._getMorphVertexCount(modelData, i, vertexBuffers);

        for (j = 0; j < targets.length; j++) {
          const targetAabb = targets[j].aabb;
          const min = targetAabb.min;
          const max = targetAabb.max;
          const aabb = new BoundingBox(new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5), new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5));
          const indices = targets[j].indices;
          let deltaPositions = targets[j].deltaPositions;
          let deltaNormals = targets[j].deltaNormals;

          if (indices) {
            deltaPositions = sparseToFull(deltaPositions, indices, vertexCount);
            deltaNormals = sparseToFull(deltaNormals, indices, vertexCount);
          }

          morphTarget = new MorphTarget({
            deltaPositions: deltaPositions,
            deltaNormals: deltaNormals,
            name: targets[j].name,
            aabb: aabb
          });
          morphTargetArray.push(morphTarget);
        }

        const morph = new Morph(morphTargetArray, this._device);
        morphs.push(morph);
        const morphInstance = new MorphInstance(morph);
        morphInstances.push(morphInstance);
      }
    }

    return {
      morphs: morphs,
      instances: morphInstances
    };
  }

  _parseVertexBuffers(data) {
    const modelData = data.model;
    const vertexBuffers = [];
    const attributeMap = {
      position: SEMANTIC_POSITION,
      normal: SEMANTIC_NORMAL,
      tangent: SEMANTIC_TANGENT,
      blendWeight: SEMANTIC_BLENDWEIGHT,
      blendIndices: SEMANTIC_BLENDINDICES,
      color: SEMANTIC_COLOR,
      texCoord0: SEMANTIC_TEXCOORD0,
      texCoord1: SEMANTIC_TEXCOORD1,
      texCoord2: SEMANTIC_TEXCOORD2,
      texCoord3: SEMANTIC_TEXCOORD3,
      texCoord4: SEMANTIC_TEXCOORD4,
      texCoord5: SEMANTIC_TEXCOORD5,
      texCoord6: SEMANTIC_TEXCOORD6,
      texCoord7: SEMANTIC_TEXCOORD7
    };

    for (let i = 0; i < modelData.vertices.length; i++) {
      const vertexData = modelData.vertices[i];
      const formatDesc = [];

      for (const attributeName in vertexData) {
        const attribute = vertexData[attributeName];
        formatDesc.push({
          semantic: attributeMap[attributeName],
          components: attribute.components,
          type: JSON_VERTEX_ELEMENT_TYPE[attribute.type],
          normalize: attributeMap[attributeName] === SEMANTIC_COLOR
        });
      }

      const vertexFormat = new VertexFormat(this._device, formatDesc);
      const numVertices = vertexData.position.data.length / vertexData.position.components;
      const vertexBuffer = new VertexBuffer(this._device, vertexFormat, numVertices);
      const iterator = new VertexIterator(vertexBuffer);

      for (let j = 0; j < numVertices; j++) {
        for (const attributeName in vertexData) {
          const attribute = vertexData[attributeName];

          switch (attribute.components) {
            case 1:
              iterator.element[attributeMap[attributeName]].set(attribute.data[j]);
              break;

            case 2:
              iterator.element[attributeMap[attributeName]].set(attribute.data[j * 2], 1.0 - attribute.data[j * 2 + 1]);
              break;

            case 3:
              iterator.element[attributeMap[attributeName]].set(attribute.data[j * 3], attribute.data[j * 3 + 1], attribute.data[j * 3 + 2]);
              break;

            case 4:
              iterator.element[attributeMap[attributeName]].set(attribute.data[j * 4], attribute.data[j * 4 + 1], attribute.data[j * 4 + 2], attribute.data[j * 4 + 3]);
              break;
          }
        }

        iterator.next();
      }

      iterator.end();
      vertexBuffers.push(vertexBuffer);
    }

    return vertexBuffers;
  }

  _parseIndexBuffers(data, vertexBuffers) {
    const modelData = data.model;
    let indexBuffer = null;
    let indexData = null;
    let i;
    let numIndices = 0;

    for (i = 0; i < modelData.meshes.length; i++) {
      const meshData = modelData.meshes[i];

      if (meshData.indices !== undefined) {
        numIndices += meshData.indices.length;
      }
    }

    let maxVerts = 0;

    for (i = 0; i < vertexBuffers.length; i++) {
      maxVerts = Math.max(maxVerts, vertexBuffers[i].numVertices);
    }

    if (numIndices > 0) {
      if (maxVerts > 0xFFFF && this._device.extUintElement) {
        indexBuffer = new IndexBuffer(this._device, INDEXFORMAT_UINT32, numIndices);
        indexData = new Uint32Array(indexBuffer.lock());
      } else {
        indexBuffer = new IndexBuffer(this._device, INDEXFORMAT_UINT16, numIndices);
        indexData = new Uint16Array(indexBuffer.lock());
      }
    }

    return {
      buffer: indexBuffer,
      data: indexData
    };
  }

  _parseMeshes(data, skins, morphs, vertexBuffers, indexBuffer, indexData) {
    const modelData = data.model;
    const meshes = [];
    let indexBase = 0;

    for (let i = 0; i < modelData.meshes.length; i++) {
      const meshData = modelData.meshes[i];
      const meshAabb = meshData.aabb;
      const min = meshAabb.min;
      const max = meshAabb.max;
      const aabb = new BoundingBox(new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5), new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5));
      const indexed = meshData.indices !== undefined;
      const mesh = new Mesh(this._device);
      mesh.vertexBuffer = vertexBuffers[meshData.vertices];
      mesh.indexBuffer[0] = indexed ? indexBuffer : null;
      mesh.primitive[0].type = JSON_PRIMITIVE_TYPE[meshData.type];
      mesh.primitive[0].base = indexed ? meshData.base + indexBase : meshData.base;
      mesh.primitive[0].count = meshData.count;
      mesh.primitive[0].indexed = indexed;
      mesh.skin = meshData.skin !== undefined ? skins[meshData.skin] : null;
      mesh.morph = meshData.morph !== undefined ? morphs[meshData.morph] : null;
      mesh.aabb = aabb;

      if (indexed) {
        indexData.set(meshData.indices, indexBase);
        indexBase += meshData.indices.length;
      }

      meshes.push(mesh);
    }

    if (indexBuffer !== null) {
      indexBuffer.unlock();
    }

    return meshes;
  }

  _parseMeshInstances(data, nodes, meshes, skins, skinInstances, morphs, morphInstances) {
    const modelData = data.model;
    const meshInstances = [];
    let i;

    for (i = 0; i < modelData.meshInstances.length; i++) {
      const meshInstanceData = modelData.meshInstances[i];
      const node = nodes[meshInstanceData.node];
      const mesh = meshes[meshInstanceData.mesh];
      const meshInstance = new MeshInstance(mesh, this._defaultMaterial, node);

      if (mesh.skin) {
        const skinIndex = skins.indexOf(mesh.skin);

        if (skinIndex === -1) {
          throw new Error('Mesh\'s skin does not appear in skin array.');
        }

        meshInstance.skinInstance = skinInstances[skinIndex];
      }

      if (mesh.morph) {
        const morphIndex = morphs.indexOf(mesh.morph);

        if (morphIndex === -1) {
          throw new Error('Mesh\'s morph does not appear in morph array.');
        }

        meshInstance.morphInstance = morphInstances[morphIndex];
      }

      meshInstances.push(meshInstance);
    }

    return meshInstances;
  }

}

export { JsonModelParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbi1tb2RlbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3Jlc291cmNlcy9wYXJzZXIvanNvbi1tb2RlbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9tYXRoL3ZlYzMuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uL3NoYXBlL2JvdW5kaW5nLWJveC5qcyc7XG5cbmltcG9ydCB7XG4gICAgSU5ERVhGT1JNQVRfVUlOVDE2LCBJTkRFWEZPUk1BVF9VSU5UMzIsXG4gICAgUFJJTUlUSVZFX0xJTkVMT09QLCBQUklNSVRJVkVfTElORVNUUklQLCBQUklNSVRJVkVfTElORVMsIFBSSU1JVElWRV9QT0lOVFMsIFBSSU1JVElWRV9UUklBTkdMRVMsIFBSSU1JVElWRV9UUklGQU4sIFBSSU1JVElWRV9UUklTVFJJUCxcbiAgICBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19UQU5HRU5ULCBTRU1BTlRJQ19DT0xPUiwgU0VNQU5USUNfQkxFTkRJTkRJQ0VTLCBTRU1BTlRJQ19CTEVORFdFSUdIVCwgU0VNQU5USUNfVEVYQ09PUkQwLCBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQyLCBTRU1BTlRJQ19URVhDT09SRDMsIFNFTUFOVElDX1RFWENPT1JENCwgU0VNQU5USUNfVEVYQ09PUkQ1LCBTRU1BTlRJQ19URVhDT09SRDYsIFNFTUFOVElDX1RFWENPT1JENyxcbiAgICBUWVBFX0lOVDgsIFRZUEVfVUlOVDgsIFRZUEVfSU5UMTYsIFRZUEVfVUlOVDE2LCBUWVBFX0lOVDMyLCBUWVBFX1VJTlQzMiwgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uLy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJbmRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL2luZGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuLi8uLi9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3ZlcnRleC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgVmVydGV4SXRlcmF0b3IgfSBmcm9tICcuLi8uLi9ncmFwaGljcy92ZXJ0ZXgtaXRlcmF0b3IuanMnO1xuXG5pbXBvcnQgeyBwYXJ0aXRpb25Ta2luIH0gZnJvbSAnLi4vLi4vc2NlbmUvc2tpbi1wYXJ0aXRpb24uanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vLi4vc2NlbmUvbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNb3JwaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vc2NlbmUvbW9ycGgtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9ycGhUYXJnZXQgfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uLy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU2tpbkluc3RhbmNlIH0gZnJvbSAnLi4vLi4vc2NlbmUvc2tpbi1pbnN0YW5jZS5qcyc7XG5cbmNvbnN0IEpTT05fUFJJTUlUSVZFX1RZUEUgPSB7XG4gICAgJ3BvaW50cyc6IFBSSU1JVElWRV9QT0lOVFMsXG4gICAgJ2xpbmVzJzogUFJJTUlUSVZFX0xJTkVTLFxuICAgICdsaW5lbG9vcCc6IFBSSU1JVElWRV9MSU5FTE9PUCxcbiAgICAnbGluZXN0cmlwJzogUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICAndHJpYW5nbGVzJzogUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICAndHJpYW5nbGVzdHJpcCc6IFBSSU1JVElWRV9UUklTVFJJUCxcbiAgICAndHJpYW5nbGVmYW4nOiBQUklNSVRJVkVfVFJJRkFOXG59O1xuXG5jb25zdCBKU09OX1ZFUlRFWF9FTEVNRU5UX1RZUEUgPSB7XG4gICAgJ2ludDgnOiBUWVBFX0lOVDgsXG4gICAgJ3VpbnQ4JzogVFlQRV9VSU5UOCxcbiAgICAnaW50MTYnOiBUWVBFX0lOVDE2LFxuICAgICd1aW50MTYnOiBUWVBFX1VJTlQxNixcbiAgICAnaW50MzInOiBUWVBFX0lOVDMyLFxuICAgICd1aW50MzInOiBUWVBFX1VJTlQzMixcbiAgICAnZmxvYXQzMic6IFRZUEVfRkxPQVQzMlxufTtcblxuLy8gVGFrZSBQbGF5Q2FudmFzIEpTT04gbW9kZWwgZGF0YSBhbmQgY3JlYXRlIHBjLk1vZGVsXG5jbGFzcyBKc29uTW9kZWxQYXJzZXIge1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgZGVmYXVsdE1hdGVyaWFsKSB7XG4gICAgICAgIHRoaXMuX2RldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5fZGVmYXVsdE1hdGVyaWFsID0gZGVmYXVsdE1hdGVyaWFsO1xuICAgIH1cblxuICAgIHBhcnNlKGRhdGEpIHtcbiAgICAgICAgY29uc3QgbW9kZWxEYXRhID0gZGF0YS5tb2RlbDtcbiAgICAgICAgaWYgKCFtb2RlbERhdGEpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1vZGVsRGF0YS52ZXJzaW9uIDw9IDEpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ0pzb25Nb2RlbFBhcnNlciNwYXJzZTogVHJ5aW5nIHRvIHBhcnNlIHVuc3VwcG9ydGVkIG1vZGVsIGZvcm1hdC4nKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTk9ERSBISUVSQVJDSFlcbiAgICAgICAgY29uc3Qgbm9kZXMgPSB0aGlzLl9wYXJzZU5vZGVzKGRhdGEpO1xuXG4gICAgICAgIC8vIFNLSU5TXG4gICAgICAgIGNvbnN0IHNraW5zID0gdGhpcy5fcGFyc2VTa2lucyhkYXRhLCBub2Rlcyk7XG5cbiAgICAgICAgLy8gVkVSVEVYIEJVRkZFUlNcbiAgICAgICAgY29uc3QgdmVydGV4QnVmZmVycyA9IHRoaXMuX3BhcnNlVmVydGV4QnVmZmVycyhkYXRhKTtcblxuICAgICAgICAvLyBJTkRFWCBCVUZGRVJcbiAgICAgICAgY29uc3QgaW5kaWNlcyA9IHRoaXMuX3BhcnNlSW5kZXhCdWZmZXJzKGRhdGEsIHZlcnRleEJ1ZmZlcnMpO1xuXG4gICAgICAgIC8vIE1PUlBIU1xuICAgICAgICBjb25zdCBtb3JwaHMgPSB0aGlzLl9wYXJzZU1vcnBocyhkYXRhLCBub2RlcywgdmVydGV4QnVmZmVycyk7XG5cbiAgICAgICAgLy8gTUVTSEVTXG4gICAgICAgIGNvbnN0IG1lc2hlcyA9IHRoaXMuX3BhcnNlTWVzaGVzKGRhdGEsIHNraW5zLnNraW5zLCBtb3JwaHMubW9ycGhzLCB2ZXJ0ZXhCdWZmZXJzLCBpbmRpY2VzLmJ1ZmZlciwgaW5kaWNlcy5kYXRhKTtcblxuICAgICAgICAvLyBNRVNIIElOU1RBTkNFU1xuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fcGFyc2VNZXNoSW5zdGFuY2VzKGRhdGEsIG5vZGVzLCBtZXNoZXMsIHNraW5zLnNraW5zLCBza2lucy5pbnN0YW5jZXMsIG1vcnBocy5tb3JwaHMsIG1vcnBocy5pbnN0YW5jZXMpO1xuXG4gICAgICAgIGNvbnN0IG1vZGVsID0gbmV3IE1vZGVsKCk7XG4gICAgICAgIG1vZGVsLmdyYXBoID0gbm9kZXNbMF07XG4gICAgICAgIG1vZGVsLm1lc2hJbnN0YW5jZXMgPSBtZXNoSW5zdGFuY2VzO1xuICAgICAgICBtb2RlbC5za2luSW5zdGFuY2VzID0gc2tpbnMuaW5zdGFuY2VzO1xuICAgICAgICBtb2RlbC5tb3JwaEluc3RhbmNlcyA9IG1vcnBocy5pbnN0YW5jZXM7XG4gICAgICAgIG1vZGVsLmdldEdyYXBoKCkuc3luY0hpZXJhcmNoeSgpO1xuXG4gICAgICAgIHJldHVybiBtb2RlbDtcbiAgICB9XG5cbiAgICBfcGFyc2VOb2RlcyhkYXRhKSB7XG4gICAgICAgIGNvbnN0IG1vZGVsRGF0YSA9IGRhdGEubW9kZWw7XG4gICAgICAgIGNvbnN0IG5vZGVzID0gW107XG4gICAgICAgIGxldCBpO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBtb2RlbERhdGEubm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gbW9kZWxEYXRhLm5vZGVzW2ldO1xuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gbmV3IEdyYXBoTm9kZShub2RlRGF0YS5uYW1lKTtcbiAgICAgICAgICAgIG5vZGUuc2V0TG9jYWxQb3NpdGlvbihub2RlRGF0YS5wb3NpdGlvblswXSwgbm9kZURhdGEucG9zaXRpb25bMV0sIG5vZGVEYXRhLnBvc2l0aW9uWzJdKTtcbiAgICAgICAgICAgIG5vZGUuc2V0TG9jYWxFdWxlckFuZ2xlcyhub2RlRGF0YS5yb3RhdGlvblswXSwgbm9kZURhdGEucm90YXRpb25bMV0sIG5vZGVEYXRhLnJvdGF0aW9uWzJdKTtcbiAgICAgICAgICAgIG5vZGUuc2V0TG9jYWxTY2FsZShub2RlRGF0YS5zY2FsZVswXSwgbm9kZURhdGEuc2NhbGVbMV0sIG5vZGVEYXRhLnNjYWxlWzJdKTtcbiAgICAgICAgICAgIG5vZGUuc2NhbGVDb21wZW5zYXRpb24gPSAhIW5vZGVEYXRhLnNjYWxlQ29tcGVuc2F0aW9uO1xuXG4gICAgICAgICAgICBub2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gMTsgaSA8IG1vZGVsRGF0YS5wYXJlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBub2Rlc1ttb2RlbERhdGEucGFyZW50c1tpXV0uYWRkQ2hpbGQobm9kZXNbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5vZGVzO1xuICAgIH1cblxuICAgIF9wYXJzZVNraW5zKGRhdGEsIG5vZGVzKSB7XG4gICAgICAgIGNvbnN0IG1vZGVsRGF0YSA9IGRhdGEubW9kZWw7XG4gICAgICAgIGNvbnN0IHNraW5zID0gW107XG4gICAgICAgIGNvbnN0IHNraW5JbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgbGV0IGksIGo7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kZXZpY2Uuc3VwcG9ydHNCb25lVGV4dHVyZXMgJiYgbW9kZWxEYXRhLnNraW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGJvbmVMaW1pdCA9IHRoaXMuX2RldmljZS5nZXRCb25lTGltaXQoKTtcbiAgICAgICAgICAgIHBhcnRpdGlvblNraW4obW9kZWxEYXRhLCBudWxsLCBib25lTGltaXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG1vZGVsRGF0YS5za2lucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2tpbkRhdGEgPSBtb2RlbERhdGEuc2tpbnNbaV07XG5cbiAgICAgICAgICAgIGNvbnN0IGludmVyc2VCaW5kTWF0cmljZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBza2luRGF0YS5pbnZlcnNlQmluZE1hdHJpY2VzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWJtID0gc2tpbkRhdGEuaW52ZXJzZUJpbmRNYXRyaWNlc1tqXTtcbiAgICAgICAgICAgICAgICBpbnZlcnNlQmluZE1hdHJpY2VzW2pdID0gbmV3IE1hdDQoKS5zZXQoaWJtKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc2tpbiA9IG5ldyBTa2luKHRoaXMuX2RldmljZSwgaW52ZXJzZUJpbmRNYXRyaWNlcywgc2tpbkRhdGEuYm9uZU5hbWVzKTtcbiAgICAgICAgICAgIHNraW5zLnB1c2goc2tpbik7XG5cbiAgICAgICAgICAgIGNvbnN0IHNraW5JbnN0YW5jZSA9IG5ldyBTa2luSW5zdGFuY2Uoc2tpbik7XG4gICAgICAgICAgICAvLyBSZXNvbHZlIGJvbmUgSURzIHRvIGFjdHVhbCBncmFwaCBub2Rlc1xuICAgICAgICAgICAgY29uc3QgYm9uZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBza2luLmJvbmVOYW1lcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVOYW1lID0gc2tpbi5ib25lTmFtZXNbal07XG4gICAgICAgICAgICAgICAgY29uc3QgYm9uZSA9IG5vZGVzWzBdLmZpbmRCeU5hbWUoYm9uZU5hbWUpO1xuICAgICAgICAgICAgICAgIGJvbmVzLnB1c2goYm9uZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBza2luSW5zdGFuY2UuYm9uZXMgPSBib25lcztcbiAgICAgICAgICAgIHNraW5JbnN0YW5jZXMucHVzaChza2luSW5zdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNraW5zOiBza2lucyxcbiAgICAgICAgICAgIGluc3RhbmNlczogc2tpbkluc3RhbmNlc1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIGZpbmQgbnVtYmVyIG9mIHZlcnRpY2VzIHVzZWQgYnkgYSBtZXNoIHRoYXQgaXMgdXNpbmcgbW9ycGggdGFyZ2V0IHdpdGggaW5kZXggbW9ycGhJbmRleFxuICAgIF9nZXRNb3JwaFZlcnRleENvdW50KG1vZGVsRGF0YSwgbW9ycGhJbmRleCwgdmVydGV4QnVmZmVycykge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1vZGVsRGF0YS5tZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hEYXRhID0gbW9kZWxEYXRhLm1lc2hlc1tpXTtcblxuICAgICAgICAgICAgaWYgKG1lc2hEYXRhLm1vcnBoID09PSBtb3JwaEluZGV4KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyc1ttZXNoRGF0YS52ZXJ0aWNlc107XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIF9wYXJzZU1vcnBocyhkYXRhLCBub2RlcywgdmVydGV4QnVmZmVycykge1xuICAgICAgICBjb25zdCBtb2RlbERhdGEgPSBkYXRhLm1vZGVsO1xuICAgICAgICBjb25zdCBtb3JwaHMgPSBbXTtcbiAgICAgICAgY29uc3QgbW9ycGhJbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgbGV0IGksIGosIHZlcnRleENvdW50O1xuXG4gICAgICAgIGxldCB0YXJnZXRzLCBtb3JwaFRhcmdldCwgbW9ycGhUYXJnZXRBcnJheTtcblxuICAgICAgICBpZiAobW9kZWxEYXRhLm1vcnBocykge1xuXG4gICAgICAgICAgICAvLyBjb252ZXJ0IHNwYXJzZSBtb3JwaCB0YXJnZXQgdmVydGV4IGRhdGEgdG8gZnVsbCBmb3JtYXRcbiAgICAgICAgICAgIGNvbnN0IHNwYXJzZVRvRnVsbCA9IGZ1bmN0aW9uIChkYXRhLCBpbmRpY2VzLCB0b3RhbENvdW50KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbCA9IG5ldyBGbG9hdDMyQXJyYXkodG90YWxDb3VudCAqIDMpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IHMgPSAwOyBzIDwgaW5kaWNlcy5sZW5ndGg7IHMrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkc3RJbmRleCA9IGluZGljZXNbc10gKiAzO1xuICAgICAgICAgICAgICAgICAgICBmdWxsW2RzdEluZGV4XSA9IGRhdGFbcyAqIDNdO1xuICAgICAgICAgICAgICAgICAgICBmdWxsW2RzdEluZGV4ICsgMV0gPSBkYXRhW3MgKiAzICsgMV07XG4gICAgICAgICAgICAgICAgICAgIGZ1bGxbZHN0SW5kZXggKyAyXSA9IGRhdGFbcyAqIDMgKyAyXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZ1bGw7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbW9kZWxEYXRhLm1vcnBocy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRhcmdldHMgPSBtb2RlbERhdGEubW9ycGhzW2ldLnRhcmdldHM7XG4gICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRBcnJheSA9IFtdO1xuXG4gICAgICAgICAgICAgICAgLy8gdG90YWwgbnVtYmVyIG9mIHZlcnRpY2llcyBvZiB0aGUgbWVzaFxuICAgICAgICAgICAgICAgIHZlcnRleENvdW50ID0gdGhpcy5fZ2V0TW9ycGhWZXJ0ZXhDb3VudChtb2RlbERhdGEsIGksIHZlcnRleEJ1ZmZlcnMpO1xuXG4gICAgICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHRhcmdldHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0QWFiYiA9IHRhcmdldHNbal0uYWFiYjtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBtaW4gPSB0YXJnZXRBYWJiLm1pbjtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF4ID0gdGFyZ2V0QWFiYi5tYXg7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFhYmIgPSBuZXcgQm91bmRpbmdCb3goXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXcgVmVjMygobWF4WzBdICsgbWluWzBdKSAqIDAuNSwgKG1heFsxXSArIG1pblsxXSkgKiAwLjUsIChtYXhbMl0gKyBtaW5bMl0pICogMC41KSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBWZWMzKChtYXhbMF0gLSBtaW5bMF0pICogMC41LCAobWF4WzFdIC0gbWluWzFdKSAqIDAuNSwgKG1heFsyXSAtIG1pblsyXSkgKiAwLjUpXG4gICAgICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29udmVydCBzcGFyc2UgdG8gZnVsbCBmb3JtYXRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5kaWNlcyA9IHRhcmdldHNbal0uaW5kaWNlcztcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRlbHRhUG9zaXRpb25zID0gdGFyZ2V0c1tqXS5kZWx0YVBvc2l0aW9ucztcbiAgICAgICAgICAgICAgICAgICAgbGV0IGRlbHRhTm9ybWFscyA9IHRhcmdldHNbal0uZGVsdGFOb3JtYWxzO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kaWNlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsdGFQb3NpdGlvbnMgPSBzcGFyc2VUb0Z1bGwoZGVsdGFQb3NpdGlvbnMsIGluZGljZXMsIHZlcnRleENvdW50KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbHRhTm9ybWFscyA9IHNwYXJzZVRvRnVsbChkZWx0YU5vcm1hbHMsIGluZGljZXMsIHZlcnRleENvdW50KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0ID0gbmV3IE1vcnBoVGFyZ2V0KHsgZGVsdGFQb3NpdGlvbnM6IGRlbHRhUG9zaXRpb25zLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVsdGFOb3JtYWxzOiBkZWx0YU5vcm1hbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB0YXJnZXRzW2pdLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBhYWJiOiBhYWJiIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0QXJyYXkucHVzaChtb3JwaFRhcmdldCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgbW9ycGggPSBuZXcgTW9ycGgobW9ycGhUYXJnZXRBcnJheSwgdGhpcy5fZGV2aWNlKTtcbiAgICAgICAgICAgICAgICBtb3JwaHMucHVzaChtb3JwaCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtb3JwaEluc3RhbmNlID0gbmV3IE1vcnBoSW5zdGFuY2UobW9ycGgpO1xuICAgICAgICAgICAgICAgIG1vcnBoSW5zdGFuY2VzLnB1c2gobW9ycGhJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbW9ycGhzOiBtb3JwaHMsXG4gICAgICAgICAgICBpbnN0YW5jZXM6IG1vcnBoSW5zdGFuY2VzXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgX3BhcnNlVmVydGV4QnVmZmVycyhkYXRhKSB7XG4gICAgICAgIGNvbnN0IG1vZGVsRGF0YSA9IGRhdGEubW9kZWw7XG4gICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlcnMgPSBbXTtcbiAgICAgICAgY29uc3QgYXR0cmlidXRlTWFwID0ge1xuICAgICAgICAgICAgcG9zaXRpb246IFNFTUFOVElDX1BPU0lUSU9OLFxuICAgICAgICAgICAgbm9ybWFsOiBTRU1BTlRJQ19OT1JNQUwsXG4gICAgICAgICAgICB0YW5nZW50OiBTRU1BTlRJQ19UQU5HRU5ULFxuICAgICAgICAgICAgYmxlbmRXZWlnaHQ6IFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgICAgICAgICAgYmxlbmRJbmRpY2VzOiBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgICAgICAgICBjb2xvcjogU0VNQU5USUNfQ09MT1IsXG4gICAgICAgICAgICB0ZXhDb29yZDA6IFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICAgICAgICAgIHRleENvb3JkMTogU0VNQU5USUNfVEVYQ09PUkQxLFxuICAgICAgICAgICAgdGV4Q29vcmQyOiBTRU1BTlRJQ19URVhDT09SRDIsXG4gICAgICAgICAgICB0ZXhDb29yZDM6IFNFTUFOVElDX1RFWENPT1JEMyxcbiAgICAgICAgICAgIHRleENvb3JkNDogU0VNQU5USUNfVEVYQ09PUkQ0LFxuICAgICAgICAgICAgdGV4Q29vcmQ1OiBTRU1BTlRJQ19URVhDT09SRDUsXG4gICAgICAgICAgICB0ZXhDb29yZDY6IFNFTUFOVElDX1RFWENPT1JENixcbiAgICAgICAgICAgIHRleENvb3JkNzogU0VNQU5USUNfVEVYQ09PUkQ3XG4gICAgICAgIH07XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtb2RlbERhdGEudmVydGljZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleERhdGEgPSBtb2RlbERhdGEudmVydGljZXNbaV07XG5cbiAgICAgICAgICAgIGNvbnN0IGZvcm1hdERlc2MgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXR0cmlidXRlTmFtZSBpbiB2ZXJ0ZXhEYXRhKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlID0gdmVydGV4RGF0YVthdHRyaWJ1dGVOYW1lXTtcblxuICAgICAgICAgICAgICAgIGZvcm1hdERlc2MucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHNlbWFudGljOiBhdHRyaWJ1dGVNYXBbYXR0cmlidXRlTmFtZV0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGF0dHJpYnV0ZS5jb21wb25lbnRzLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBKU09OX1ZFUlRFWF9FTEVNRU5UX1RZUEVbYXR0cmlidXRlLnR5cGVdLFxuICAgICAgICAgICAgICAgICAgICBub3JtYWxpemU6IChhdHRyaWJ1dGVNYXBbYXR0cmlidXRlTmFtZV0gPT09IFNFTUFOVElDX0NPTE9SKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdCh0aGlzLl9kZXZpY2UsIGZvcm1hdERlc2MpO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIHZlcnRleCBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IG51bVZlcnRpY2VzID0gdmVydGV4RGF0YS5wb3NpdGlvbi5kYXRhLmxlbmd0aCAvIHZlcnRleERhdGEucG9zaXRpb24uY29tcG9uZW50cztcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIodGhpcy5fZGV2aWNlLCB2ZXJ0ZXhGb3JtYXQsIG51bVZlcnRpY2VzKTtcblxuICAgICAgICAgICAgY29uc3QgaXRlcmF0b3IgPSBuZXcgVmVydGV4SXRlcmF0b3IodmVydGV4QnVmZmVyKTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVtVmVydGljZXM7IGorKykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYXR0cmlidXRlTmFtZSBpbiB2ZXJ0ZXhEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZSA9IHZlcnRleERhdGFbYXR0cmlidXRlTmFtZV07XG5cbiAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChhdHRyaWJ1dGUuY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZXJhdG9yLmVsZW1lbnRbYXR0cmlidXRlTWFwW2F0dHJpYnV0ZU5hbWVdXS5zZXQoYXR0cmlidXRlLmRhdGFbal0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAyOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZXJhdG9yLmVsZW1lbnRbYXR0cmlidXRlTWFwW2F0dHJpYnV0ZU5hbWVdXS5zZXQoYXR0cmlidXRlLmRhdGFbaiAqIDJdLCAxLjAgLSBhdHRyaWJ1dGUuZGF0YVtqICogMiArIDFdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVyYXRvci5lbGVtZW50W2F0dHJpYnV0ZU1hcFthdHRyaWJ1dGVOYW1lXV0uc2V0KGF0dHJpYnV0ZS5kYXRhW2ogKiAzXSwgYXR0cmlidXRlLmRhdGFbaiAqIDMgKyAxXSwgYXR0cmlidXRlLmRhdGFbaiAqIDMgKyAyXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlcmF0b3IuZWxlbWVudFthdHRyaWJ1dGVNYXBbYXR0cmlidXRlTmFtZV1dLnNldChhdHRyaWJ1dGUuZGF0YVtqICogNF0sIGF0dHJpYnV0ZS5kYXRhW2ogKiA0ICsgMV0sIGF0dHJpYnV0ZS5kYXRhW2ogKiA0ICsgMl0sIGF0dHJpYnV0ZS5kYXRhW2ogKiA0ICsgM10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGl0ZXJhdG9yLm5leHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGl0ZXJhdG9yLmVuZCgpO1xuXG4gICAgICAgICAgICB2ZXJ0ZXhCdWZmZXJzLnB1c2godmVydGV4QnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2ZXJ0ZXhCdWZmZXJzO1xuICAgIH1cblxuICAgIF9wYXJzZUluZGV4QnVmZmVycyhkYXRhLCB2ZXJ0ZXhCdWZmZXJzKSB7XG4gICAgICAgIGNvbnN0IG1vZGVsRGF0YSA9IGRhdGEubW9kZWw7XG4gICAgICAgIGxldCBpbmRleEJ1ZmZlciA9IG51bGw7XG4gICAgICAgIGxldCBpbmRleERhdGEgPSBudWxsO1xuICAgICAgICBsZXQgaTtcblxuICAgICAgICAvLyBDb3VudCB0aGUgbnVtYmVyIG9mIGluZGljZXMgaW4gdGhlIG1vZGVsXG4gICAgICAgIGxldCBudW1JbmRpY2VzID0gMDtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG1vZGVsRGF0YS5tZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hEYXRhID0gbW9kZWxEYXRhLm1lc2hlc1tpXTtcbiAgICAgICAgICAgIGlmIChtZXNoRGF0YS5pbmRpY2VzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBudW1JbmRpY2VzICs9IG1lc2hEYXRhLmluZGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ3JlYXRlIGFuIGluZGV4IGJ1ZmZlciBiaWcgZW5vdWdoIHRvIHN0b3JlIGFsbCBpbmRpY2VzIGluIHRoZSBtb2RlbFxuICAgICAgICBsZXQgbWF4VmVydHMgPSAwO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4QnVmZmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbWF4VmVydHMgPSBNYXRoLm1heChtYXhWZXJ0cywgdmVydGV4QnVmZmVyc1tpXS5udW1WZXJ0aWNlcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG51bUluZGljZXMgPiAwKSB7XG4gICAgICAgICAgICBpZiAobWF4VmVydHMgPiAweEZGRkYgJiYgdGhpcy5fZGV2aWNlLmV4dFVpbnRFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgaW5kZXhCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIodGhpcy5fZGV2aWNlLCBJTkRFWEZPUk1BVF9VSU5UMzIsIG51bUluZGljZXMpO1xuICAgICAgICAgICAgICAgIGluZGV4RGF0YSA9IG5ldyBVaW50MzJBcnJheShpbmRleEJ1ZmZlci5sb2NrKCkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbmRleEJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcih0aGlzLl9kZXZpY2UsIElOREVYRk9STUFUX1VJTlQxNiwgbnVtSW5kaWNlcyk7XG4gICAgICAgICAgICAgICAgaW5kZXhEYXRhID0gbmV3IFVpbnQxNkFycmF5KGluZGV4QnVmZmVyLmxvY2soKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYnVmZmVyOiBpbmRleEJ1ZmZlcixcbiAgICAgICAgICAgIGRhdGE6IGluZGV4RGF0YVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIF9wYXJzZU1lc2hlcyhkYXRhLCBza2lucywgbW9ycGhzLCB2ZXJ0ZXhCdWZmZXJzLCBpbmRleEJ1ZmZlciwgaW5kZXhEYXRhKSB7XG4gICAgICAgIGNvbnN0IG1vZGVsRGF0YSA9IGRhdGEubW9kZWw7XG5cbiAgICAgICAgY29uc3QgbWVzaGVzID0gW107XG4gICAgICAgIGxldCBpbmRleEJhc2UgPSAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbW9kZWxEYXRhLm1lc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaERhdGEgPSBtb2RlbERhdGEubWVzaGVzW2ldO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNoQWFiYiA9IG1lc2hEYXRhLmFhYmI7XG4gICAgICAgICAgICBjb25zdCBtaW4gPSBtZXNoQWFiYi5taW47XG4gICAgICAgICAgICBjb25zdCBtYXggPSBtZXNoQWFiYi5tYXg7XG4gICAgICAgICAgICBjb25zdCBhYWJiID0gbmV3IEJvdW5kaW5nQm94KFxuICAgICAgICAgICAgICAgIG5ldyBWZWMzKChtYXhbMF0gKyBtaW5bMF0pICogMC41LCAobWF4WzFdICsgbWluWzFdKSAqIDAuNSwgKG1heFsyXSArIG1pblsyXSkgKiAwLjUpLFxuICAgICAgICAgICAgICAgIG5ldyBWZWMzKChtYXhbMF0gLSBtaW5bMF0pICogMC41LCAobWF4WzFdIC0gbWluWzFdKSAqIDAuNSwgKG1heFsyXSAtIG1pblsyXSkgKiAwLjUpXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCBpbmRleGVkID0gKG1lc2hEYXRhLmluZGljZXMgIT09IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICBjb25zdCBtZXNoID0gbmV3IE1lc2godGhpcy5fZGV2aWNlKTtcbiAgICAgICAgICAgIG1lc2gudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyc1ttZXNoRGF0YS52ZXJ0aWNlc107XG4gICAgICAgICAgICBtZXNoLmluZGV4QnVmZmVyWzBdID0gaW5kZXhlZCA/IGluZGV4QnVmZmVyIDogbnVsbDtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLnR5cGUgPSBKU09OX1BSSU1JVElWRV9UWVBFW21lc2hEYXRhLnR5cGVdO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uYmFzZSA9IGluZGV4ZWQgPyAobWVzaERhdGEuYmFzZSArIGluZGV4QmFzZSkgOiBtZXNoRGF0YS5iYXNlO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPSBtZXNoRGF0YS5jb3VudDtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSBpbmRleGVkO1xuICAgICAgICAgICAgbWVzaC5za2luID0gKG1lc2hEYXRhLnNraW4gIT09IHVuZGVmaW5lZCkgPyBza2luc1ttZXNoRGF0YS5za2luXSA6IG51bGw7XG4gICAgICAgICAgICBtZXNoLm1vcnBoID0gKG1lc2hEYXRhLm1vcnBoICE9PSB1bmRlZmluZWQpID8gbW9ycGhzW21lc2hEYXRhLm1vcnBoXSA6IG51bGw7XG4gICAgICAgICAgICBtZXNoLmFhYmIgPSBhYWJiO1xuXG4gICAgICAgICAgICBpZiAoaW5kZXhlZCkge1xuICAgICAgICAgICAgICAgIC8vIENyZWF0ZSB0aGUgaW5kZXggYnVmZmVyXG4gICAgICAgICAgICAgICAgaW5kZXhEYXRhLnNldChtZXNoRGF0YS5pbmRpY2VzLCBpbmRleEJhc2UpO1xuICAgICAgICAgICAgICAgIGluZGV4QmFzZSArPSBtZXNoRGF0YS5pbmRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWVzaGVzLnB1c2gobWVzaCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5kZXhCdWZmZXIgIT09IG51bGwpIHtcbiAgICAgICAgICAgIGluZGV4QnVmZmVyLnVubG9jaygpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1lc2hlcztcbiAgICB9XG5cbiAgICBfcGFyc2VNZXNoSW5zdGFuY2VzKGRhdGEsIG5vZGVzLCBtZXNoZXMsIHNraW5zLCBza2luSW5zdGFuY2VzLCBtb3JwaHMsIG1vcnBoSW5zdGFuY2VzKSB7XG4gICAgICAgIGNvbnN0IG1vZGVsRGF0YSA9IGRhdGEubW9kZWw7XG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBbXTtcbiAgICAgICAgbGV0IGk7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG1vZGVsRGF0YS5tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VEYXRhID0gbW9kZWxEYXRhLm1lc2hJbnN0YW5jZXNbaV07XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1ttZXNoSW5zdGFuY2VEYXRhLm5vZGVdO1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hlc1ttZXNoSW5zdGFuY2VEYXRhLm1lc2hdO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMuX2RlZmF1bHRNYXRlcmlhbCwgbm9kZSk7XG5cbiAgICAgICAgICAgIGlmIChtZXNoLnNraW4pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBza2luSW5kZXggPSBza2lucy5pbmRleE9mKG1lc2guc2tpbik7XG4gICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgIGlmIChza2luSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTWVzaFxcJ3Mgc2tpbiBkb2VzIG5vdCBhcHBlYXIgaW4gc2tpbiBhcnJheS4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA9IHNraW5JbnN0YW5jZXNbc2tpbkluZGV4XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1lc2gubW9ycGgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtb3JwaEluZGV4ID0gbW9ycGhzLmluZGV4T2YobWVzaC5tb3JwaCk7XG4gICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgIGlmIChtb3JwaEluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01lc2hcXCdzIG1vcnBoIGRvZXMgbm90IGFwcGVhciBpbiBtb3JwaCBhcnJheS4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1vcnBoSW5zdGFuY2UgPSBtb3JwaEluc3RhbmNlc1ttb3JwaEluZGV4XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWVzaEluc3RhbmNlcy5wdXNoKG1lc2hJbnN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbWVzaEluc3RhbmNlcztcbiAgICB9XG59XG5cbmV4cG9ydCB7IEpzb25Nb2RlbFBhcnNlciB9O1xuIl0sIm5hbWVzIjpbIkpTT05fUFJJTUlUSVZFX1RZUEUiLCJQUklNSVRJVkVfUE9JTlRTIiwiUFJJTUlUSVZFX0xJTkVTIiwiUFJJTUlUSVZFX0xJTkVMT09QIiwiUFJJTUlUSVZFX0xJTkVTVFJJUCIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiSlNPTl9WRVJURVhfRUxFTUVOVF9UWVBFIiwiVFlQRV9JTlQ4IiwiVFlQRV9VSU5UOCIsIlRZUEVfSU5UMTYiLCJUWVBFX1VJTlQxNiIsIlRZUEVfSU5UMzIiLCJUWVBFX1VJTlQzMiIsIlRZUEVfRkxPQVQzMiIsIkpzb25Nb2RlbFBhcnNlciIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwiZGVmYXVsdE1hdGVyaWFsIiwiX2RldmljZSIsIl9kZWZhdWx0TWF0ZXJpYWwiLCJwYXJzZSIsImRhdGEiLCJtb2RlbERhdGEiLCJtb2RlbCIsInZlcnNpb24iLCJEZWJ1ZyIsIndhcm4iLCJub2RlcyIsIl9wYXJzZU5vZGVzIiwic2tpbnMiLCJfcGFyc2VTa2lucyIsInZlcnRleEJ1ZmZlcnMiLCJfcGFyc2VWZXJ0ZXhCdWZmZXJzIiwiaW5kaWNlcyIsIl9wYXJzZUluZGV4QnVmZmVycyIsIm1vcnBocyIsIl9wYXJzZU1vcnBocyIsIm1lc2hlcyIsIl9wYXJzZU1lc2hlcyIsImJ1ZmZlciIsIm1lc2hJbnN0YW5jZXMiLCJfcGFyc2VNZXNoSW5zdGFuY2VzIiwiaW5zdGFuY2VzIiwiTW9kZWwiLCJncmFwaCIsInNraW5JbnN0YW5jZXMiLCJtb3JwaEluc3RhbmNlcyIsImdldEdyYXBoIiwic3luY0hpZXJhcmNoeSIsImkiLCJsZW5ndGgiLCJub2RlRGF0YSIsIm5vZGUiLCJHcmFwaE5vZGUiLCJuYW1lIiwic2V0TG9jYWxQb3NpdGlvbiIsInBvc2l0aW9uIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsInJvdGF0aW9uIiwic2V0TG9jYWxTY2FsZSIsInNjYWxlIiwic2NhbGVDb21wZW5zYXRpb24iLCJwdXNoIiwicGFyZW50cyIsImFkZENoaWxkIiwiaiIsInN1cHBvcnRzQm9uZVRleHR1cmVzIiwiYm9uZUxpbWl0IiwiZ2V0Qm9uZUxpbWl0IiwicGFydGl0aW9uU2tpbiIsInNraW5EYXRhIiwiaW52ZXJzZUJpbmRNYXRyaWNlcyIsImlibSIsIk1hdDQiLCJzZXQiLCJza2luIiwiU2tpbiIsImJvbmVOYW1lcyIsInNraW5JbnN0YW5jZSIsIlNraW5JbnN0YW5jZSIsImJvbmVzIiwiYm9uZU5hbWUiLCJib25lIiwiZmluZEJ5TmFtZSIsIl9nZXRNb3JwaFZlcnRleENvdW50IiwibW9ycGhJbmRleCIsIm1lc2hEYXRhIiwibW9ycGgiLCJ2ZXJ0ZXhCdWZmZXIiLCJ2ZXJ0aWNlcyIsIm51bVZlcnRpY2VzIiwidW5kZWZpbmVkIiwidmVydGV4Q291bnQiLCJ0YXJnZXRzIiwibW9ycGhUYXJnZXQiLCJtb3JwaFRhcmdldEFycmF5Iiwic3BhcnNlVG9GdWxsIiwidG90YWxDb3VudCIsImZ1bGwiLCJGbG9hdDMyQXJyYXkiLCJzIiwiZHN0SW5kZXgiLCJ0YXJnZXRBYWJiIiwiYWFiYiIsIm1pbiIsIm1heCIsIkJvdW5kaW5nQm94IiwiVmVjMyIsImRlbHRhUG9zaXRpb25zIiwiZGVsdGFOb3JtYWxzIiwiTW9ycGhUYXJnZXQiLCJNb3JwaCIsIm1vcnBoSW5zdGFuY2UiLCJNb3JwaEluc3RhbmNlIiwiYXR0cmlidXRlTWFwIiwiU0VNQU5USUNfUE9TSVRJT04iLCJub3JtYWwiLCJTRU1BTlRJQ19OT1JNQUwiLCJ0YW5nZW50IiwiU0VNQU5USUNfVEFOR0VOVCIsImJsZW5kV2VpZ2h0IiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJibGVuZEluZGljZXMiLCJTRU1BTlRJQ19CTEVORElORElDRVMiLCJjb2xvciIsIlNFTUFOVElDX0NPTE9SIiwidGV4Q29vcmQwIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwidGV4Q29vcmQxIiwiU0VNQU5USUNfVEVYQ09PUkQxIiwidGV4Q29vcmQyIiwiU0VNQU5USUNfVEVYQ09PUkQyIiwidGV4Q29vcmQzIiwiU0VNQU5USUNfVEVYQ09PUkQzIiwidGV4Q29vcmQ0IiwiU0VNQU5USUNfVEVYQ09PUkQ0IiwidGV4Q29vcmQ1IiwiU0VNQU5USUNfVEVYQ09PUkQ1IiwidGV4Q29vcmQ2IiwiU0VNQU5USUNfVEVYQ09PUkQ2IiwidGV4Q29vcmQ3IiwiU0VNQU5USUNfVEVYQ09PUkQ3IiwidmVydGV4RGF0YSIsImZvcm1hdERlc2MiLCJhdHRyaWJ1dGVOYW1lIiwiYXR0cmlidXRlIiwic2VtYW50aWMiLCJjb21wb25lbnRzIiwidHlwZSIsIm5vcm1hbGl6ZSIsInZlcnRleEZvcm1hdCIsIlZlcnRleEZvcm1hdCIsIlZlcnRleEJ1ZmZlciIsIml0ZXJhdG9yIiwiVmVydGV4SXRlcmF0b3IiLCJlbGVtZW50IiwibmV4dCIsImVuZCIsImluZGV4QnVmZmVyIiwiaW5kZXhEYXRhIiwibnVtSW5kaWNlcyIsIm1heFZlcnRzIiwiTWF0aCIsImV4dFVpbnRFbGVtZW50IiwiSW5kZXhCdWZmZXIiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJVaW50MzJBcnJheSIsImxvY2siLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJVaW50MTZBcnJheSIsImluZGV4QmFzZSIsIm1lc2hBYWJiIiwiaW5kZXhlZCIsIm1lc2giLCJNZXNoIiwicHJpbWl0aXZlIiwiYmFzZSIsImNvdW50IiwidW5sb2NrIiwibWVzaEluc3RhbmNlRGF0YSIsIm1lc2hJbnN0YW5jZSIsIk1lc2hJbnN0YW5jZSIsInNraW5JbmRleCIsImluZGV4T2YiLCJFcnJvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQThCQSxNQUFNQSxtQkFBbUIsR0FBRztBQUN4QixFQUFBLFFBQUEsRUFBVUMsZ0JBRGM7QUFFeEIsRUFBQSxPQUFBLEVBQVNDLGVBRmU7QUFHeEIsRUFBQSxVQUFBLEVBQVlDLGtCQUhZO0FBSXhCLEVBQUEsV0FBQSxFQUFhQyxtQkFKVztBQUt4QixFQUFBLFdBQUEsRUFBYUMsbUJBTFc7QUFNeEIsRUFBQSxlQUFBLEVBQWlCQyxrQkFOTztFQU94QixhQUFlQyxFQUFBQSxnQkFBQUE7QUFQUyxDQUE1QixDQUFBO0FBVUEsTUFBTUMsd0JBQXdCLEdBQUc7QUFDN0IsRUFBQSxNQUFBLEVBQVFDLFNBRHFCO0FBRTdCLEVBQUEs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
