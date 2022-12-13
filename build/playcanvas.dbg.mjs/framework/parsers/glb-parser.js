/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { path } from '../../core/path.js';
import { WasmModule } from '../../core/wasm-module.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { CHUNKAPI_1_58, CULLFACE_NONE, CULLFACE_BACK, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, BUFFER_STATIC, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_POINTS, SEMANTIC_NORMAL, INDEXFORMAT_UINT8, TYPE_FLOAT32, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE, TYPE_UINT32, TYPE_INT32, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, typedArrayTypesByteSize, typedArrayTypes } from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { http } from '../../platform/net/http.js';
import { SPECOCC_AO, BLEND_NONE, BLEND_NORMAL, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, ASPECT_AUTO, LIGHTFALLOFF_INVERSESQUARED, ASPECT_MANUAL } from '../../scene/constants.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Light, lightTypes } from '../../scene/light.js';
import { Mesh } from '../../scene/mesh.js';
import { Morph } from '../../scene/morph.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { calculateNormals } from '../../scene/procedural.js';
import { Render } from '../../scene/render.js';
import { Skin } from '../../scene/skin.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { Entity } from '../entity.js';
import { INTERPOLATION_LINEAR, INTERPOLATION_CUBIC, INTERPOLATION_STEP } from '../anim/constants.js';
import { AnimCurve } from '../anim/evaluator/anim-curve.js';
import { AnimData } from '../anim/evaluator/anim-data.js';
import { AnimTrack } from '../anim/evaluator/anim-track.js';
import { Asset } from '../asset/asset.js';
import { GlbContainerResource } from './glb-container-resource.js';

let dracoDecoderInstance = null;
const getGlobalDracoDecoderModule = () => {
  return typeof window !== 'undefined' && window.DracoDecoderModule;
};

class GlbResources {
  constructor(gltf) {
    this.gltf = gltf;
    this.nodes = null;
    this.scenes = null;
    this.animations = null;
    this.textures = null;
    this.materials = null;
    this.variants = null;
    this.meshVariants = null;
    this.meshDefaultMaterials = null;
    this.renders = null;
    this.skins = null;
    this.lights = null;
    this.cameras = null;
  }
  destroy() {
    if (this.renders) {
      this.renders.forEach(render => {
        render.meshes = null;
      });
    }
  }
}
const isDataURI = function isDataURI(uri) {
  return /^data:.*,.*$/i.test(uri);
};
const getDataURIMimeType = function getDataURIMimeType(uri) {
  return uri.substring(uri.indexOf(':') + 1, uri.indexOf(';'));
};
const getNumComponents = function getNumComponents(accessorType) {
  switch (accessorType) {
    case 'SCALAR':
      return 1;
    case 'VEC2':
      return 2;
    case 'VEC3':
      return 3;
    case 'VEC4':
      return 4;
    case 'MAT2':
      return 4;
    case 'MAT3':
      return 9;
    case 'MAT4':
      return 16;
    default:
      return 3;
  }
};
const getComponentType = function getComponentType(componentType) {
  switch (componentType) {
    case 5120:
      return TYPE_INT8;
    case 5121:
      return TYPE_UINT8;
    case 5122:
      return TYPE_INT16;
    case 5123:
      return TYPE_UINT16;
    case 5124:
      return TYPE_INT32;
    case 5125:
      return TYPE_UINT32;
    case 5126:
      return TYPE_FLOAT32;
    default:
      return 0;
  }
};
const getComponentSizeInBytes = function getComponentSizeInBytes(componentType) {
  switch (componentType) {
    case 5120:
      return 1;
    case 5121:
      return 1;
    case 5122:
      return 2;
    case 5123:
      return 2;
    case 5124:
      return 4;
    case 5125:
      return 4;
    case 5126:
      return 4;
    default:
      return 0;
  }
};
const getComponentDataType = function getComponentDataType(componentType) {
  switch (componentType) {
    case 5120:
      return Int8Array;
    case 5121:
      return Uint8Array;
    case 5122:
      return Int16Array;
    case 5123:
      return Uint16Array;
    case 5124:
      return Int32Array;
    case 5125:
      return Uint32Array;
    case 5126:
      return Float32Array;
    default:
      return null;
  }
};
const gltfToEngineSemanticMap = {
  'POSITION': SEMANTIC_POSITION,
  'NORMAL': SEMANTIC_NORMAL,
  'TANGENT': SEMANTIC_TANGENT,
  'COLOR_0': SEMANTIC_COLOR,
  'JOINTS_0': SEMANTIC_BLENDINDICES,
  'WEIGHTS_0': SEMANTIC_BLENDWEIGHT,
  'TEXCOORD_0': SEMANTIC_TEXCOORD0,
  'TEXCOORD_1': SEMANTIC_TEXCOORD1,
  'TEXCOORD_2': SEMANTIC_TEXCOORD2,
  'TEXCOORD_3': SEMANTIC_TEXCOORD3,
  'TEXCOORD_4': SEMANTIC_TEXCOORD4,
  'TEXCOORD_5': SEMANTIC_TEXCOORD5,
  'TEXCOORD_6': SEMANTIC_TEXCOORD6,
  'TEXCOORD_7': SEMANTIC_TEXCOORD7
};

const getDequantizeFunc = srcType => {
  switch (srcType) {
    case TYPE_INT8:
      return x => Math.max(x / 127.0, -1.0);
    case TYPE_UINT8:
      return x => x / 255.0;
    case TYPE_INT16:
      return x => Math.max(x / 32767.0, -1.0);
    case TYPE_UINT16:
      return x => x / 65535.0;
    default:
      return x => x;
  }
};

const dequantizeArray = function dequantizeArray(dstArray, srcArray, srcType) {
  const convFunc = getDequantizeFunc(srcType);
  const len = srcArray.length;
  for (let i = 0; i < len; ++i) {
    dstArray[i] = convFunc(srcArray[i]);
  }
  return dstArray;
};

const getAccessorData = function getAccessorData(gltfAccessor, bufferViews, flatten = false) {
  const numComponents = getNumComponents(gltfAccessor.type);
  const dataType = getComponentDataType(gltfAccessor.componentType);
  if (!dataType) {
    return null;
  }
  const bufferView = bufferViews[gltfAccessor.bufferView];
  let result;
  if (gltfAccessor.sparse) {
    const sparse = gltfAccessor.sparse;

    const indicesAccessor = {
      count: sparse.count,
      type: 'SCALAR'
    };
    const indices = getAccessorData(Object.assign(indicesAccessor, sparse.indices), bufferViews, true);

    const valuesAccessor = {
      count: sparse.count,
      type: gltfAccessor.scalar,
      componentType: gltfAccessor.componentType
    };
    const values = getAccessorData(Object.assign(valuesAccessor, sparse.values), bufferViews, true);

    if (gltfAccessor.hasOwnProperty('bufferView')) {
      const baseAccessor = {
        bufferView: gltfAccessor.bufferView,
        byteOffset: gltfAccessor.byteOffset,
        componentType: gltfAccessor.componentType,
        count: gltfAccessor.count,
        type: gltfAccessor.type
      };
      result = getAccessorData(baseAccessor, bufferViews, true).slice();
    } else {
      result = new dataType(gltfAccessor.count * numComponents);
    }
    for (let i = 0; i < sparse.count; ++i) {
      const targetIndex = indices[i];
      for (let j = 0; j < numComponents; ++j) {
        result[targetIndex * numComponents + j] = values[i * numComponents + j];
      }
    }
  } else if (flatten && bufferView.hasOwnProperty('byteStride')) {
    const bytesPerElement = numComponents * dataType.BYTES_PER_ELEMENT;
    const storage = new ArrayBuffer(gltfAccessor.count * bytesPerElement);
    const tmpArray = new Uint8Array(storage);
    let dstOffset = 0;
    for (let i = 0; i < gltfAccessor.count; ++i) {
      let srcOffset = (gltfAccessor.byteOffset || 0) + i * bufferView.byteStride;
      for (let b = 0; b < bytesPerElement; ++b) {
        tmpArray[dstOffset++] = bufferView[srcOffset++];
      }
    }
    result = new dataType(storage);
  } else {
    result = new dataType(bufferView.buffer, bufferView.byteOffset + (gltfAccessor.byteOffset || 0), gltfAccessor.count * numComponents);
  }
  return result;
};

const getAccessorDataFloat32 = function getAccessorDataFloat32(gltfAccessor, bufferViews) {
  const data = getAccessorData(gltfAccessor, bufferViews, true);
  if (data instanceof Float32Array || !gltfAccessor.normalized) {
    return data;
  }
  const float32Data = new Float32Array(data.length);
  dequantizeArray(float32Data, data, getComponentType(gltfAccessor.componentType));
  return float32Data;
};

const getAccessorBoundingBox = function getAccessorBoundingBox(gltfAccessor) {
  let min = gltfAccessor.min;
  let max = gltfAccessor.max;
  if (!min || !max) {
    return null;
  }
  if (gltfAccessor.normalized) {
    const ctype = getComponentType(gltfAccessor.componentType);
    min = dequantizeArray([], min, ctype);
    max = dequantizeArray([], max, ctype);
  }
  return new BoundingBox(new Vec3((max[0] + min[0]) * 0.5, (max[1] + min[1]) * 0.5, (max[2] + min[2]) * 0.5), new Vec3((max[0] - min[0]) * 0.5, (max[1] - min[1]) * 0.5, (max[2] - min[2]) * 0.5));
};
const getPrimitiveType = function getPrimitiveType(primitive) {
  if (!primitive.hasOwnProperty('mode')) {
    return PRIMITIVE_TRIANGLES;
  }
  switch (primitive.mode) {
    case 0:
      return PRIMITIVE_POINTS;
    case 1:
      return PRIMITIVE_LINES;
    case 2:
      return PRIMITIVE_LINELOOP;
    case 3:
      return PRIMITIVE_LINESTRIP;
    case 4:
      return PRIMITIVE_TRIANGLES;
    case 5:
      return PRIMITIVE_TRISTRIP;
    case 6:
      return PRIMITIVE_TRIFAN;
    default:
      return PRIMITIVE_TRIANGLES;
  }
};
const generateIndices = function generateIndices(numVertices) {
  const dummyIndices = new Uint16Array(numVertices);
  for (let i = 0; i < numVertices; i++) {
    dummyIndices[i] = i;
  }
  return dummyIndices;
};
const generateNormals = function generateNormals(sourceDesc, indices) {
  const p = sourceDesc[SEMANTIC_POSITION];
  if (!p || p.components !== 3) {
    return;
  }
  let positions;
  if (p.size !== p.stride) {
    const srcStride = p.stride / typedArrayTypesByteSize[p.type];
    const src = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * srcStride);
    positions = new typedArrayTypes[p.type](p.count * 3);
    for (let i = 0; i < p.count; ++i) {
      positions[i * 3 + 0] = src[i * srcStride + 0];
      positions[i * 3 + 1] = src[i * srcStride + 1];
      positions[i * 3 + 2] = src[i * srcStride + 2];
    }
  } else {
    positions = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * 3);
  }
  const numVertices = p.count;

  if (!indices) {
    indices = generateIndices(numVertices);
  }

  const normalsTemp = calculateNormals(positions, indices);
  const normals = new Float32Array(normalsTemp.length);
  normals.set(normalsTemp);
  sourceDesc[SEMANTIC_NORMAL] = {
    buffer: normals.buffer,
    size: 12,
    offset: 0,
    stride: 12,
    count: numVertices,
    components: 3,
    type: TYPE_FLOAT32
  };
};
const flipTexCoordVs = function flipTexCoordVs(vertexBuffer) {
  let i, j;
  const floatOffsets = [];
  const shortOffsets = [];
  const byteOffsets = [];
  for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
    const element = vertexBuffer.format.elements[i];
    if (element.name === SEMANTIC_TEXCOORD0 || element.name === SEMANTIC_TEXCOORD1) {
      switch (element.dataType) {
        case TYPE_FLOAT32:
          floatOffsets.push({
            offset: element.offset / 4 + 1,
            stride: element.stride / 4
          });
          break;
        case TYPE_UINT16:
          shortOffsets.push({
            offset: element.offset / 2 + 1,
            stride: element.stride / 2
          });
          break;
        case TYPE_UINT8:
          byteOffsets.push({
            offset: element.offset + 1,
            stride: element.stride
          });
          break;
      }
    }
  }
  const flip = function flip(offsets, type, one) {
    const typedArray = new type(vertexBuffer.storage);
    for (i = 0; i < offsets.length; ++i) {
      let index = offsets[i].offset;
      const stride = offsets[i].stride;
      for (j = 0; j < vertexBuffer.numVertices; ++j) {
        typedArray[index] = one - typedArray[index];
        index += stride;
      }
    }
  };
  if (floatOffsets.length > 0) {
    flip(floatOffsets, Float32Array, 1.0);
  }
  if (shortOffsets.length > 0) {
    flip(shortOffsets, Uint16Array, 65535);
  }
  if (byteOffsets.length > 0) {
    flip(byteOffsets, Uint8Array, 255);
  }
};

const cloneTexture = function cloneTexture(texture) {
  const shallowCopyLevels = function shallowCopyLevels(texture) {
    const result = [];
    for (let mip = 0; mip < texture._levels.length; ++mip) {
      let level = [];
      if (texture.cubemap) {
        for (let face = 0; face < 6; ++face) {
          level.push(texture._levels[mip][face]);
        }
      } else {
        level = texture._levels[mip];
      }
      result.push(level);
    }
    return result;
  };
  const result = new Texture(texture.device, texture);
  result._levels = shallowCopyLevels(texture);
  return result;
};

const cloneTextureAsset = function cloneTextureAsset(src) {
  const result = new Asset(src.name + '_clone', src.type, src.file, src.data, src.options);
  result.loaded = true;
  result.resource = cloneTexture(src.resource);
  src.registry.add(result);
  return result;
};
const createVertexBufferInternal = function createVertexBufferInternal(device, sourceDesc, flipV) {
  const positionDesc = sourceDesc[SEMANTIC_POSITION];
  if (!positionDesc) {
    return null;
  }
  const numVertices = positionDesc.count;

  const vertexDesc = [];
  for (const semantic in sourceDesc) {
    if (sourceDesc.hasOwnProperty(semantic)) {
      vertexDesc.push({
        semantic: semantic,
        components: sourceDesc[semantic].components,
        type: sourceDesc[semantic].type,
        normalize: !!sourceDesc[semantic].normalize
      });
    }
  }

  const elementOrder = [SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1];

  vertexDesc.sort(function (lhs, rhs) {
    const lhsOrder = elementOrder.indexOf(lhs.semantic);
    const rhsOrder = elementOrder.indexOf(rhs.semantic);
    return lhsOrder < rhsOrder ? -1 : rhsOrder < lhsOrder ? 1 : 0;
  });
  let i, j, k;
  let source, target, sourceOffset;
  const vertexFormat = new VertexFormat(device, vertexDesc);

  let isCorrectlyInterleaved = true;
  for (i = 0; i < vertexFormat.elements.length; ++i) {
    target = vertexFormat.elements[i];
    source = sourceDesc[target.name];
    sourceOffset = source.offset - positionDesc.offset;
    if (source.buffer !== positionDesc.buffer || source.stride !== target.stride || source.size !== target.size || sourceOffset !== target.offset) {
      isCorrectlyInterleaved = false;
      break;
    }
  }

  const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, BUFFER_STATIC);
  const vertexData = vertexBuffer.lock();
  const targetArray = new Uint32Array(vertexData);
  let sourceArray;
  if (isCorrectlyInterleaved) {
    sourceArray = new Uint32Array(positionDesc.buffer, positionDesc.offset, numVertices * vertexBuffer.format.size / 4);
    targetArray.set(sourceArray);
  } else {
    let targetStride, sourceStride;
    for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
      target = vertexBuffer.format.elements[i];
      targetStride = target.stride / 4;
      source = sourceDesc[target.name];
      sourceStride = source.stride / 4;
      sourceArray = new Uint32Array(source.buffer, source.offset, (source.count - 1) * sourceStride + (source.size + 3) / 4);
      let src = 0;
      let dst = target.offset / 4;
      const kend = Math.floor((source.size + 3) / 4);
      for (j = 0; j < numVertices; ++j) {
        for (k = 0; k < kend; ++k) {
          targetArray[dst + k] = sourceArray[src + k];
        }
        src += sourceStride;
        dst += targetStride;
      }
    }
  }
  if (flipV) {
    flipTexCoordVs(vertexBuffer);
  }
  vertexBuffer.unlock();
  return vertexBuffer;
};
const createVertexBuffer = function createVertexBuffer(device, attributes, indices, accessors, bufferViews, flipV, vertexBufferDict) {
  const useAttributes = {};
  const attribIds = [];
  for (const attrib in attributes) {
    if (attributes.hasOwnProperty(attrib) && gltfToEngineSemanticMap.hasOwnProperty(attrib)) {
      useAttributes[attrib] = attributes[attrib];

      attribIds.push(attrib + ':' + attributes[attrib]);
    }
  }

  attribIds.sort();
  const vbKey = attribIds.join();

  let vb = vertexBufferDict[vbKey];
  if (!vb) {
    const sourceDesc = {};
    for (const attrib in useAttributes) {
      const accessor = accessors[attributes[attrib]];
      const accessorData = getAccessorData(accessor, bufferViews);
      const bufferView = bufferViews[accessor.bufferView];
      const semantic = gltfToEngineSemanticMap[attrib];
      const size = getNumComponents(accessor.type) * getComponentSizeInBytes(accessor.componentType);
      const stride = bufferView.hasOwnProperty('byteStride') ? bufferView.byteStride : size;
      sourceDesc[semantic] = {
        buffer: accessorData.buffer,
        size: size,
        offset: accessorData.byteOffset,
        stride: stride,
        count: accessor.count,
        components: getNumComponents(accessor.type),
        type: getComponentType(accessor.componentType),
        normalize: accessor.normalized
      };
    }

    if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
      generateNormals(sourceDesc, indices);
    }

    vb = createVertexBufferInternal(device, sourceDesc, flipV);
    vertexBufferDict[vbKey] = vb;
  }
  return vb;
};
const createVertexBufferDraco = function createVertexBufferDraco(device, outputGeometry, extDraco, decoder, decoderModule, indices, flipV) {
  const numPoints = outputGeometry.num_points();

  const extractDracoAttributeInfo = function extractDracoAttributeInfo(uniqueId, semantic) {
    const attribute = decoder.GetAttributeByUniqueId(outputGeometry, uniqueId);
    const numValues = numPoints * attribute.num_components();
    const dracoFormat = attribute.data_type();
    let ptr, values, componentSizeInBytes, storageType;

    switch (dracoFormat) {
      case decoderModule.DT_UINT8:
        storageType = TYPE_UINT8;
        componentSizeInBytes = 1;
        ptr = decoderModule._malloc(numValues * componentSizeInBytes);
        decoder.GetAttributeDataArrayForAllPoints(outputGeometry, attribute, decoderModule.DT_UINT8, numValues * componentSizeInBytes, ptr);
        values = new Uint8Array(decoderModule.HEAPU8.buffer, ptr, numValues).slice();
        break;
      case decoderModule.DT_UINT16:
        storageType = TYPE_UINT16;
        componentSizeInBytes = 2;
        ptr = decoderModule._malloc(numValues * componentSizeInBytes);
        decoder.GetAttributeDataArrayForAllPoints(outputGeometry, attribute, decoderModule.DT_UINT16, numValues * componentSizeInBytes, ptr);
        values = new Uint16Array(decoderModule.HEAPU16.buffer, ptr, numValues).slice();
        break;
      case decoderModule.DT_FLOAT32:
      default:
        storageType = TYPE_FLOAT32;
        componentSizeInBytes = 4;
        ptr = decoderModule._malloc(numValues * componentSizeInBytes);
        decoder.GetAttributeDataArrayForAllPoints(outputGeometry, attribute, decoderModule.DT_FLOAT32, numValues * componentSizeInBytes, ptr);
        values = new Float32Array(decoderModule.HEAPF32.buffer, ptr, numValues).slice();
        break;
    }
    decoderModule._free(ptr);
    return {
      values: values,
      numComponents: attribute.num_components(),
      componentSizeInBytes: componentSizeInBytes,
      storageType: storageType,
      normalized: semantic === SEMANTIC_COLOR && storageType === TYPE_UINT8 ? true : attribute.normalized()
    };
  };

  const sourceDesc = {};
  const attributes = extDraco.attributes;
  for (const attrib in attributes) {
    if (attributes.hasOwnProperty(attrib) && gltfToEngineSemanticMap.hasOwnProperty(attrib)) {
      const semantic = gltfToEngineSemanticMap[attrib];
      const attributeInfo = extractDracoAttributeInfo(attributes[attrib], semantic);

      const size = attributeInfo.numComponents * attributeInfo.componentSizeInBytes;
      sourceDesc[semantic] = {
        values: attributeInfo.values,
        buffer: attributeInfo.values.buffer,
        size: size,
        offset: 0,
        stride: size,
        count: numPoints,
        components: attributeInfo.numComponents,
        type: attributeInfo.storageType,
        normalize: attributeInfo.normalized
      };
    }
  }

  if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
    generateNormals(sourceDesc, indices);
  }
  return createVertexBufferInternal(device, sourceDesc, flipV);
};
const createSkin = function createSkin(device, gltfSkin, accessors, bufferViews, nodes, glbSkins) {
  let i, j, bindMatrix;
  const joints = gltfSkin.joints;
  const numJoints = joints.length;
  const ibp = [];
  if (gltfSkin.hasOwnProperty('inverseBindMatrices')) {
    const inverseBindMatrices = gltfSkin.inverseBindMatrices;
    const ibmData = getAccessorData(accessors[inverseBindMatrices], bufferViews, true);
    const ibmValues = [];
    for (i = 0; i < numJoints; i++) {
      for (j = 0; j < 16; j++) {
        ibmValues[j] = ibmData[i * 16 + j];
      }
      bindMatrix = new Mat4();
      bindMatrix.set(ibmValues);
      ibp.push(bindMatrix);
    }
  } else {
    for (i = 0; i < numJoints; i++) {
      bindMatrix = new Mat4();
      ibp.push(bindMatrix);
    }
  }
  const boneNames = [];
  for (i = 0; i < numJoints; i++) {
    boneNames[i] = nodes[joints[i]].name;
  }

  const key = boneNames.join('#');
  let skin = glbSkins.get(key);
  if (!skin) {
    skin = new Skin(device, ibp, boneNames);
    glbSkins.set(key, skin);
  }
  return skin;
};
const tempMat = new Mat4();
const tempVec = new Vec3();
const createMesh = function createMesh(device, gltfMesh, accessors, bufferViews, callback, flipV, vertexBufferDict, meshVariants, meshDefaultMaterials, assetOptions) {
  const meshes = [];
  gltfMesh.primitives.forEach(function (primitive) {
    let primitiveType, vertexBuffer, numIndices;
    let indices = null;
    let canUseMorph = true;

    if (primitive.hasOwnProperty('extensions')) {
      const extensions = primitive.extensions;
      if (extensions.hasOwnProperty('KHR_draco_mesh_compression')) {
        const decoderModule = dracoDecoderInstance || getGlobalDracoDecoderModule();
        if (decoderModule) {
          const extDraco = extensions.KHR_draco_mesh_compression;
          if (extDraco.hasOwnProperty('attributes')) {
            const uint8Buffer = bufferViews[extDraco.bufferView];
            const buffer = new decoderModule.DecoderBuffer();
            buffer.Init(uint8Buffer, uint8Buffer.length);
            const decoder = new decoderModule.Decoder();
            const geometryType = decoder.GetEncodedGeometryType(buffer);
            let outputGeometry, status;
            switch (geometryType) {
              case decoderModule.POINT_CLOUD:
                primitiveType = PRIMITIVE_POINTS;
                outputGeometry = new decoderModule.PointCloud();
                status = decoder.DecodeBufferToPointCloud(buffer, outputGeometry);
                break;
              case decoderModule.TRIANGULAR_MESH:
                primitiveType = PRIMITIVE_TRIANGLES;
                outputGeometry = new decoderModule.Mesh();
                status = decoder.DecodeBufferToMesh(buffer, outputGeometry);
                break;
              case decoderModule.INVALID_GEOMETRY_TYPE:
            }
            if (!status || !status.ok() || outputGeometry.ptr === 0) {
              callback('Failed to decode draco compressed asset: ' + (status ? status.error_msg() : 'Mesh asset - invalid draco compressed geometry type: ' + geometryType));
              return;
            }

            const numFaces = outputGeometry.num_faces();
            if (geometryType === decoderModule.TRIANGULAR_MESH) {
              const bit32 = outputGeometry.num_points() > 65535;
              numIndices = numFaces * 3;
              const dataSize = numIndices * (bit32 ? 4 : 2);
              const ptr = decoderModule._malloc(dataSize);
              if (bit32) {
                decoder.GetTrianglesUInt32Array(outputGeometry, dataSize, ptr);
                indices = new Uint32Array(decoderModule.HEAPU32.buffer, ptr, numIndices).slice();
              } else {
                decoder.GetTrianglesUInt16Array(outputGeometry, dataSize, ptr);
                indices = new Uint16Array(decoderModule.HEAPU16.buffer, ptr, numIndices).slice();
              }
              decoderModule._free(ptr);
            }

            vertexBuffer = createVertexBufferDraco(device, outputGeometry, extDraco, decoder, decoderModule, indices, flipV);

            decoderModule.destroy(outputGeometry);
            decoderModule.destroy(decoder);
            decoderModule.destroy(buffer);

            canUseMorph = false;
          }
        } else {
          Debug.warn('File contains draco compressed data, but DracoDecoderModule is not configured.');
        }
      }
    }

    if (!vertexBuffer) {
      indices = primitive.hasOwnProperty('indices') ? getAccessorData(accessors[primitive.indices], bufferViews, true) : null;
      vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, flipV, vertexBufferDict);
      primitiveType = getPrimitiveType(primitive);
    }
    let mesh = null;
    if (vertexBuffer) {
      mesh = new Mesh(device);
      mesh.vertexBuffer = vertexBuffer;
      mesh.primitive[0].type = primitiveType;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].indexed = indices !== null;

      if (indices !== null) {
        let indexFormat;
        if (indices instanceof Uint8Array) {
          indexFormat = INDEXFORMAT_UINT8;
        } else if (indices instanceof Uint16Array) {
          indexFormat = INDEXFORMAT_UINT16;
        } else {
          indexFormat = INDEXFORMAT_UINT32;
        }

        if (indexFormat === INDEXFORMAT_UINT32 && !device.extUintElement) {
          if (vertexBuffer.numVertices > 0xFFFF) {
            console.warn('Glb file contains 32bit index buffer but these are not supported by this device - it may be rendered incorrectly.');
          }

          indexFormat = INDEXFORMAT_UINT16;
          indices = new Uint16Array(indices);
        }
        const indexBuffer = new IndexBuffer(device, indexFormat, indices.length, BUFFER_STATIC, indices);
        mesh.indexBuffer[0] = indexBuffer;
        mesh.primitive[0].count = indices.length;
      } else {
        mesh.primitive[0].count = vertexBuffer.numVertices;
      }
      if (primitive.hasOwnProperty("extensions") && primitive.extensions.hasOwnProperty("KHR_materials_variants")) {
        const variants = primitive.extensions.KHR_materials_variants;
        const tempMapping = {};
        variants.mappings.forEach(mapping => {
          mapping.variants.forEach(variant => {
            tempMapping[variant] = mapping.material;
          });
        });
        meshVariants[mesh.id] = tempMapping;
      }
      meshDefaultMaterials[mesh.id] = primitive.material;
      let accessor = accessors[primitive.attributes.POSITION];
      mesh.aabb = getAccessorBoundingBox(accessor);

      if (canUseMorph && primitive.hasOwnProperty('targets')) {
        const targets = [];
        primitive.targets.forEach(function (target, index) {
          const options = {};
          if (target.hasOwnProperty('POSITION')) {
            accessor = accessors[target.POSITION];
            options.deltaPositions = getAccessorDataFloat32(accessor, bufferViews);
            options.deltaPositionsType = TYPE_FLOAT32;
            options.aabb = getAccessorBoundingBox(accessor);
          }
          if (target.hasOwnProperty('NORMAL')) {
            accessor = accessors[target.NORMAL];
            options.deltaNormals = getAccessorDataFloat32(accessor, bufferViews);
            options.deltaNormalsType = TYPE_FLOAT32;
          }

          if (gltfMesh.hasOwnProperty('extras') && gltfMesh.extras.hasOwnProperty('targetNames')) {
            options.name = gltfMesh.extras.targetNames[index];
          } else {
            options.name = index.toString(10);
          }

          if (gltfMesh.hasOwnProperty('weights')) {
            options.defaultWeight = gltfMesh.weights[index];
          }
          options.preserveData = assetOptions.morphPreserveData;
          targets.push(new MorphTarget(options));
        });
        mesh.morph = new Morph(targets, device);
      }
    }
    meshes.push(mesh);
  });
  return meshes;
};
const extractTextureTransform = function extractTextureTransform(source, material, maps) {
  var _source$extensions;
  let map;
  const texCoord = source.texCoord;
  if (texCoord) {
    for (map = 0; map < maps.length; ++map) {
      material[maps[map] + 'MapUv'] = texCoord;
    }
  }
  const zeros = [0, 0];
  const ones = [1, 1];
  const textureTransform = (_source$extensions = source.extensions) == null ? void 0 : _source$extensions.KHR_texture_transform;
  if (textureTransform) {
    const offset = textureTransform.offset || zeros;
    const scale = textureTransform.scale || ones;
    const rotation = textureTransform.rotation ? -textureTransform.rotation * math.RAD_TO_DEG : 0;
    const tilingVec = new Vec2(scale[0], scale[1]);
    const offsetVec = new Vec2(offset[0], 1.0 - scale[1] - offset[1]);
    for (map = 0; map < maps.length; ++map) {
      material[`${maps[map]}MapTiling`] = tilingVec;
      material[`${maps[map]}MapOffset`] = offsetVec;
      material[`${maps[map]}MapRotation`] = rotation;
    }
  }
};
const extensionPbrSpecGlossiness = function extensionPbrSpecGlossiness(data, material, textures) {
  let color, texture;
  if (data.hasOwnProperty('diffuseFactor')) {
    color = data.diffuseFactor;
    material.diffuse.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
    material.opacity = color[3];
  } else {
    material.diffuse.set(1, 1, 1);
    material.opacity = 1;
  }
  if (data.hasOwnProperty('diffuseTexture')) {
    const diffuseTexture = data.diffuseTexture;
    texture = textures[diffuseTexture.index];
    material.diffuseMap = texture;
    material.diffuseMapChannel = 'rgb';
    material.opacityMap = texture;
    material.opacityMapChannel = 'a';
    extractTextureTransform(diffuseTexture, material, ['diffuse', 'opacity']);
  }
  material.useMetalness = false;
  if (data.hasOwnProperty('specularFactor')) {
    color = data.specularFactor;
    material.specular.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
  } else {
    material.specular.set(1, 1, 1);
  }
  if (data.hasOwnProperty('glossinessFactor')) {
    material.shininess = 100 * data.glossinessFactor;
  } else {
    material.shininess = 100;
  }
  if (data.hasOwnProperty('specularGlossinessTexture')) {
    const specularGlossinessTexture = data.specularGlossinessTexture;
    material.specularEncoding = 'srgb';
    material.specularMap = material.glossMap = textures[specularGlossinessTexture.index];
    material.specularMapChannel = 'rgb';
    material.glossMapChannel = 'a';
    extractTextureTransform(specularGlossinessTexture, material, ['gloss', 'metalness']);
  }
};
const extensionClearCoat = function extensionClearCoat(data, material, textures) {
  if (data.hasOwnProperty('clearcoatFactor')) {
    material.clearCoat = data.clearcoatFactor * 0.25;
  } else {
    material.clearCoat = 0;
  }
  if (data.hasOwnProperty('clearcoatTexture')) {
    const clearcoatTexture = data.clearcoatTexture;
    material.clearCoatMap = textures[clearcoatTexture.index];
    material.clearCoatMapChannel = 'r';
    extractTextureTransform(clearcoatTexture, material, ['clearCoat']);
  }
  if (data.hasOwnProperty('clearcoatRoughnessFactor')) {
    material.clearCoatGlossiness = data.clearcoatRoughnessFactor;
  } else {
    material.clearCoatGlossiness = 0;
  }
  if (data.hasOwnProperty('clearcoatRoughnessTexture')) {
    const clearcoatRoughnessTexture = data.clearcoatRoughnessTexture;
    material.clearCoatGlossMap = textures[clearcoatRoughnessTexture.index];
    material.clearCoatGlossMapChannel = 'g';
    extractTextureTransform(clearcoatRoughnessTexture, material, ['clearCoatGloss']);
  }
  if (data.hasOwnProperty('clearcoatNormalTexture')) {
    const clearcoatNormalTexture = data.clearcoatNormalTexture;
    material.clearCoatNormalMap = textures[clearcoatNormalTexture.index];
    extractTextureTransform(clearcoatNormalTexture, material, ['clearCoatNormal']);
    if (clearcoatNormalTexture.hasOwnProperty('scale')) {
      material.clearCoatBumpiness = clearcoatNormalTexture.scale;
    }
  }
  const clearCoatGlossChunk = `
        #ifdef MAPFLOAT
        uniform float material_clearCoatGlossiness;
        #endif
        
        void getClearCoatGlossiness() {
            ccGlossiness = 1.0;
        
        #ifdef MAPFLOAT
            ccGlossiness *= material_clearCoatGlossiness;
        #endif
        
        #ifdef MAPTEXTURE
            ccGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
        #endif
        
        #ifdef MAPVERTEX
            ccGlossiness *= saturate(vVertexColor.$VC);
        #endif
        
            ccGlossiness = 1.0 - ccGlossiness;
        
            ccGlossiness += 0.0000001;
        }
        `;
  material.chunks.clearCoatGlossPS = clearCoatGlossChunk;
};
const extensionUnlit = function extensionUnlit(data, material, textures) {
  material.useLighting = false;

  material.emissive.copy(material.diffuse);
  material.emissiveTint = material.diffuseTint;
  material.emissiveMap = material.diffuseMap;
  material.emissiveMapUv = material.diffuseMapUv;
  material.emissiveMapTiling.copy(material.diffuseMapTiling);
  material.emissiveMapOffset.copy(material.diffuseMapOffset);
  material.emissiveMapRotation = material.diffuseMapRotation;
  material.emissiveMapChannel = material.diffuseMapChannel;
  material.emissiveVertexColor = material.diffuseVertexColor;
  material.emissiveVertexColorChannel = material.diffuseVertexColorChannel;

  material.diffuse.set(0, 0, 0);
  material.diffuseTint = false;
  material.diffuseMap = null;
  material.diffuseVertexColor = false;
};
const extensionSpecular = function extensionSpecular(data, material, textures) {
  material.useMetalnessSpecularColor = true;
  if (data.hasOwnProperty('specularColorTexture')) {
    material.specularEncoding = 'srgb';
    material.specularMap = textures[data.specularColorTexture.index];
    material.specularMapChannel = 'rgb';
    extractTextureTransform(data.specularColorTexture, material, ['specular']);
  }
  if (data.hasOwnProperty('specularColorFactor')) {
    const color = data.specularColorFactor;
    material.specular.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
  } else {
    material.specular.set(1, 1, 1);
  }
  if (data.hasOwnProperty('specularFactor')) {
    material.specularityFactor = data.specularFactor;
  } else {
    material.specularityFactor = 1;
  }
  if (data.hasOwnProperty('specularTexture')) {
    material.specularityFactorMapChannel = 'a';
    material.specularityFactorMap = textures[data.specularTexture.index];
    extractTextureTransform(data.specularTexture, material, ['specularityFactor']);
  }
};
const extensionIor = function extensionIor(data, material, textures) {
  if (data.hasOwnProperty('ior')) {
    material.refractionIndex = 1.0 / data.ior;
  }
};
const extensionTransmission = function extensionTransmission(data, material, textures) {
  material.blendType = BLEND_NORMAL;
  material.useDynamicRefraction = true;
  if (data.hasOwnProperty('transmissionFactor')) {
    material.refraction = data.transmissionFactor;
  }
  if (data.hasOwnProperty('transmissionTexture')) {
    material.refractionMapChannel = 'r';
    material.refractionMap = textures[data.transmissionTexture.index];
    extractTextureTransform(data.transmissionTexture, material, ['refraction']);
  }
};
const extensionSheen = function extensionSheen(data, material, textures) {
  material.useSheen = true;
  if (data.hasOwnProperty('sheenColorFactor')) {
    const color = data.sheenColorFactor;
    material.sheen.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
  } else {
    material.sheen.set(1, 1, 1);
  }
  if (data.hasOwnProperty('sheenColorTexture')) {
    material.sheenMap = textures[data.sheenColorTexture.index];
    material.sheenEncoding = 'srgb';
    extractTextureTransform(data.sheenColorTexture, material, ['sheen']);
  }
  if (data.hasOwnProperty('sheenRoughnessFactor')) {
    material.sheenGlossiness = data.sheenRoughnessFactor;
  } else {
    material.sheenGlossiness = 0.0;
  }
  if (data.hasOwnProperty('sheenRoughnessTexture')) {
    material.sheenGlossinessMap = textures[data.sheenRoughnessTexture.index];
    material.sheenGlossinessMapChannel = 'a';
    extractTextureTransform(data.sheenRoughnessTexture, material, ['sheenGlossiness']);
  }
  const sheenGlossChunk = `
    #ifdef MAPFLOAT
    uniform float material_sheenGlossiness;
    #endif

    #ifdef MAPTEXTURE
    uniform sampler2D texture_sheenGlossinessMap;
    #endif

    void getSheenGlossiness() {
        float sheenGlossiness = 1.0;

        #ifdef MAPFLOAT
        sheenGlossiness *= material_sheenGlossiness;
        #endif

        #ifdef MAPTEXTURE
        sheenGlossiness *= texture2DBias(texture_sheenGlossinessMap, $UV, textureBias).$CH;
        #endif

        #ifdef MAPVERTEX
        sheenGlossiness *= saturate(vVertexColor.$VC);
        #endif

        sheenGlossiness = 1.0 - sheenGlossiness;
        sheenGlossiness += 0.0000001;
        sGlossiness = sheenGlossiness;
    }
    `;
  material.chunks.sheenGlossPS = sheenGlossChunk;
};
const extensionVolume = function extensionVolume(data, material, textures) {
  material.blendType = BLEND_NORMAL;
  material.useDynamicRefraction = true;
  if (data.hasOwnProperty('thicknessFactor')) {
    material.thickness = data.thicknessFactor;
  }
  if (data.hasOwnProperty('thicknessTexture')) {
    material.thicknessMap = textures[data.thicknessTexture.index];
    extractTextureTransform(data.thicknessTexture, material, ['thickness']);
  }
  if (data.hasOwnProperty('attenuationDistance')) {
    material.attenuationDistance = data.attenuationDistance;
  }
  if (data.hasOwnProperty('attenuationColor')) {
    const color = data.attenuationColor;
    material.attenuation.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
  }
};
const extensionEmissiveStrength = function extensionEmissiveStrength(data, material, textures) {
  if (data.hasOwnProperty('emissiveStrength')) {
    material.emissiveIntensity = data.emissiveStrength;
  }
};
const extensionIridescence = function extensionIridescence(data, material, textures) {
  material.useIridescence = true;
  if (data.hasOwnProperty('iridescenceFactor')) {
    material.iridescence = data.iridescenceFactor;
  }
  if (data.hasOwnProperty('iridescenceTexture')) {
    material.iridescenceMapChannel = 'r';
    material.iridescenceMap = textures[data.iridescenceTexture.index];
    extractTextureTransform(data.iridescenceTexture, material, ['iridescence']);
  }
  if (data.hasOwnProperty('iridescenceIor')) {
    material.iridescenceRefractionIndex = data.iridescenceIor;
  }
  if (data.hasOwnProperty('iridescenceThicknessMinimum')) {
    material.iridescenceThicknessMin = data.iridescenceThicknessMinimum;
  }
  if (data.hasOwnProperty('iridescenceThicknessMaximum')) {
    material.iridescenceThicknessMax = data.iridescenceThicknessMaximum;
  }
  if (data.hasOwnProperty('iridescenceThicknessTexture')) {
    material.iridescenceThicknessMapChannel = 'g';
    material.iridescenceThicknessMap = textures[data.iridescenceThicknessTexture.index];
    extractTextureTransform(data.iridescenceThicknessTexture, material, ['iridescenceThickness']);
  }
};
const createMaterial = function createMaterial(gltfMaterial, textures, flipV) {
  const glossChunk = `
        #ifdef MAPFLOAT
        uniform float material_shininess;
        #endif
        
        void getGlossiness() {
            dGlossiness = 1.0;
        
        #ifdef MAPFLOAT
            dGlossiness *= material_shininess;
        #endif
        
        #ifdef MAPTEXTURE
            dGlossiness *= texture2DBias($SAMPLER, $UV, textureBias).$CH;
        #endif
        
        #ifdef MAPVERTEX
            dGlossiness *= saturate(vVertexColor.$VC);
        #endif
        
            dGlossiness = 1.0 - dGlossiness;
        
            dGlossiness += 0.0000001;
        }
        `;
  const material = new StandardMaterial();

  material.occludeSpecular = SPECOCC_AO;
  material.diffuseTint = true;
  material.diffuseVertexColor = true;
  material.specularTint = true;
  material.specularVertexColor = true;
  material.chunks.APIVersion = CHUNKAPI_1_58;
  if (gltfMaterial.hasOwnProperty('name')) {
    material.name = gltfMaterial.name;
  }
  let color, texture;
  if (gltfMaterial.hasOwnProperty('pbrMetallicRoughness')) {
    const pbrData = gltfMaterial.pbrMetallicRoughness;
    if (pbrData.hasOwnProperty('baseColorFactor')) {
      color = pbrData.baseColorFactor;
      material.diffuse.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
      material.opacity = color[3];
    } else {
      material.diffuse.set(1, 1, 1);
      material.opacity = 1;
    }
    if (pbrData.hasOwnProperty('baseColorTexture')) {
      const baseColorTexture = pbrData.baseColorTexture;
      texture = textures[baseColorTexture.index];
      material.diffuseMap = texture;
      material.diffuseMapChannel = 'rgb';
      material.opacityMap = texture;
      material.opacityMapChannel = 'a';
      extractTextureTransform(baseColorTexture, material, ['diffuse', 'opacity']);
    }
    material.useMetalness = true;
    material.specular.set(1, 1, 1);
    if (pbrData.hasOwnProperty('metallicFactor')) {
      material.metalness = pbrData.metallicFactor;
    } else {
      material.metalness = 1;
    }
    if (pbrData.hasOwnProperty('roughnessFactor')) {
      material.shininess = 100 * pbrData.roughnessFactor;
    } else {
      material.shininess = 100;
    }
    if (pbrData.hasOwnProperty('metallicRoughnessTexture')) {
      const metallicRoughnessTexture = pbrData.metallicRoughnessTexture;
      material.metalnessMap = material.glossMap = textures[metallicRoughnessTexture.index];
      material.metalnessMapChannel = 'b';
      material.glossMapChannel = 'g';
      extractTextureTransform(metallicRoughnessTexture, material, ['gloss', 'metalness']);
    }
    material.chunks.glossPS = glossChunk;
  }
  if (gltfMaterial.hasOwnProperty('normalTexture')) {
    const normalTexture = gltfMaterial.normalTexture;
    material.normalMap = textures[normalTexture.index];
    extractTextureTransform(normalTexture, material, ['normal']);
    if (normalTexture.hasOwnProperty('scale')) {
      material.bumpiness = normalTexture.scale;
    }
  }
  if (gltfMaterial.hasOwnProperty('occlusionTexture')) {
    const occlusionTexture = gltfMaterial.occlusionTexture;
    material.aoMap = textures[occlusionTexture.index];
    material.aoMapChannel = 'r';
    extractTextureTransform(occlusionTexture, material, ['ao']);
  }

  if (gltfMaterial.hasOwnProperty('emissiveFactor')) {
    color = gltfMaterial.emissiveFactor;
    material.emissive.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
    material.emissiveTint = true;
  } else {
    material.emissive.set(0, 0, 0);
    material.emissiveTint = false;
  }
  if (gltfMaterial.hasOwnProperty('emissiveTexture')) {
    const emissiveTexture = gltfMaterial.emissiveTexture;
    material.emissiveMap = textures[emissiveTexture.index];
    extractTextureTransform(emissiveTexture, material, ['emissive']);
  }
  if (gltfMaterial.hasOwnProperty('alphaMode')) {
    switch (gltfMaterial.alphaMode) {
      case 'MASK':
        material.blendType = BLEND_NONE;
        if (gltfMaterial.hasOwnProperty('alphaCutoff')) {
          material.alphaTest = gltfMaterial.alphaCutoff;
        } else {
          material.alphaTest = 0.5;
        }
        break;
      case 'BLEND':
        material.blendType = BLEND_NORMAL;
        material.depthWrite = false;
        break;
      default:
      case 'OPAQUE':
        material.blendType = BLEND_NONE;
        break;
    }
  } else {
    material.blendType = BLEND_NONE;
  }
  if (gltfMaterial.hasOwnProperty('doubleSided')) {
    material.twoSidedLighting = gltfMaterial.doubleSided;
    material.cull = gltfMaterial.doubleSided ? CULLFACE_NONE : CULLFACE_BACK;
  } else {
    material.twoSidedLighting = false;
    material.cull = CULLFACE_BACK;
  }

  const extensions = {
    "KHR_materials_clearcoat": extensionClearCoat,
    "KHR_materials_emissive_strength": extensionEmissiveStrength,
    "KHR_materials_ior": extensionIor,
    "KHR_materials_iridescence": extensionIridescence,
    "KHR_materials_pbrSpecularGlossiness": extensionPbrSpecGlossiness,
    "KHR_materials_sheen": extensionSheen,
    "KHR_materials_specular": extensionSpecular,
    "KHR_materials_transmission": extensionTransmission,
    "KHR_materials_unlit": extensionUnlit,
    "KHR_materials_volume": extensionVolume
  };

  if (gltfMaterial.hasOwnProperty('extensions')) {
    for (const key in gltfMaterial.extensions) {
      const extensionFunc = extensions[key];
      if (extensionFunc !== undefined) {
        extensionFunc(gltfMaterial.extensions[key], material, textures);
      }
    }
  }
  material.update();
  return material;
};

const createAnimation = function createAnimation(gltfAnimation, animationIndex, gltfAccessors, bufferViews, nodes, meshes) {
  const createAnimData = function createAnimData(gltfAccessor) {
    return new AnimData(getNumComponents(gltfAccessor.type), getAccessorDataFloat32(gltfAccessor, bufferViews));
  };
  const interpMap = {
    'STEP': INTERPOLATION_STEP,
    'LINEAR': INTERPOLATION_LINEAR,
    'CUBICSPLINE': INTERPOLATION_CUBIC
  };

  const inputMap = {};
  const outputMap = {};
  const curveMap = {};
  let outputCounter = 1;
  let i;

  for (i = 0; i < gltfAnimation.samplers.length; ++i) {
    const sampler = gltfAnimation.samplers[i];

    if (!inputMap.hasOwnProperty(sampler.input)) {
      inputMap[sampler.input] = createAnimData(gltfAccessors[sampler.input]);
    }

    if (!outputMap.hasOwnProperty(sampler.output)) {
      outputMap[sampler.output] = createAnimData(gltfAccessors[sampler.output]);
    }
    const interpolation = sampler.hasOwnProperty('interpolation') && interpMap.hasOwnProperty(sampler.interpolation) ? interpMap[sampler.interpolation] : INTERPOLATION_LINEAR;

    const curve = {
      paths: [],
      input: sampler.input,
      output: sampler.output,
      interpolation: interpolation
    };
    curveMap[i] = curve;
  }
  const quatArrays = [];
  const transformSchema = {
    'translation': 'localPosition',
    'rotation': 'localRotation',
    'scale': 'localScale'
  };
  const constructNodePath = node => {
    const path = [];
    while (node) {
      path.unshift(node.name);
      node = node.parent;
    }
    return path;
  };
  const retrieveWeightName = (nodeName, weightIndex) => {
    if (!meshes) return weightIndex;
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i];
      if (mesh.name === nodeName && mesh.hasOwnProperty('extras') && mesh.extras.hasOwnProperty('targetNames') && mesh.extras.targetNames[weightIndex]) {
        return `name.${mesh.extras.targetNames[weightIndex]}`;
      }
    }
    return weightIndex;
  };

  const createMorphTargetCurves = (curve, node, entityPath) => {
    if (!outputMap[curve.output]) {
      Debug.warn(`glb-parser: No output data is available for the morph target curve (${entityPath}/graph/weights). Skipping.`);
      return;
    }
    const morphTargetCount = outputMap[curve.output].data.length / inputMap[curve.input].data.length;
    const keyframeCount = outputMap[curve.output].data.length / morphTargetCount;
    for (let j = 0; j < morphTargetCount; j++) {
      const morphTargetOutput = new Float32Array(keyframeCount);
      for (let k = 0; k < keyframeCount; k++) {
        morphTargetOutput[k] = outputMap[curve.output].data[k * morphTargetCount + j];
      }
      const output = new AnimData(1, morphTargetOutput);
      outputMap[-outputCounter] = output;
      const morphCurve = {
        paths: [{
          entityPath: entityPath,
          component: 'graph',
          propertyPath: [`weight.${retrieveWeightName(node.name, j)}`]
        }],
        input: curve.input,
        output: -outputCounter,
        interpolation: curve.interpolation
      };
      outputCounter++;
      curveMap[`morphCurve-${i}-${j}`] = morphCurve;
    }
  };

  for (i = 0; i < gltfAnimation.channels.length; ++i) {
    const channel = gltfAnimation.channels[i];
    const target = channel.target;
    const curve = curveMap[channel.sampler];
    const node = nodes[target.node];
    const entityPath = constructNodePath(node);
    if (target.path.startsWith('weights')) {
      createMorphTargetCurves(curve, node, entityPath);
      curveMap[channel.sampler].morphCurve = true;
    } else {
      curve.paths.push({
        entityPath: entityPath,
        component: 'graph',
        propertyPath: [transformSchema[target.path]]
      });
    }
  }
  const inputs = [];
  const outputs = [];
  const curves = [];

  for (const inputKey in inputMap) {
    inputs.push(inputMap[inputKey]);
    inputMap[inputKey] = inputs.length - 1;
  }
  for (const outputKey in outputMap) {
    outputs.push(outputMap[outputKey]);
    outputMap[outputKey] = outputs.length - 1;
  }
  for (const curveKey in curveMap) {
    const curveData = curveMap[curveKey];
    if (curveData.morphCurve) {
      continue;
    }
    curves.push(new AnimCurve(curveData.paths, inputMap[curveData.input], outputMap[curveData.output], curveData.interpolation));

    if (curveData.paths.length > 0 && curveData.paths[0].propertyPath[0] === 'localRotation' && curveData.interpolation !== INTERPOLATION_CUBIC) {
      quatArrays.push(curves[curves.length - 1].output);
    }
  }

  quatArrays.sort();

  let prevIndex = null;
  let data;
  for (i = 0; i < quatArrays.length; ++i) {
    const index = quatArrays[i];
    if (i === 0 || index !== prevIndex) {
      data = outputs[index];
      if (data.components === 4) {
        const d = data.data;
        const len = d.length - 4;
        for (let j = 0; j < len; j += 4) {
          const dp = d[j + 0] * d[j + 4] + d[j + 1] * d[j + 5] + d[j + 2] * d[j + 6] + d[j + 3] * d[j + 7];
          if (dp < 0) {
            d[j + 4] *= -1;
            d[j + 5] *= -1;
            d[j + 6] *= -1;
            d[j + 7] *= -1;
          }
        }
      }
      prevIndex = index;
    }
  }

  let duration = 0;
  for (i = 0; i < inputs.length; i++) {
    data = inputs[i]._data;
    duration = Math.max(duration, data.length === 0 ? 0 : data[data.length - 1]);
  }
  return new AnimTrack(gltfAnimation.hasOwnProperty('name') ? gltfAnimation.name : 'animation_' + animationIndex, duration, inputs, outputs, curves);
};
const createNode = function createNode(gltfNode, nodeIndex) {
  const entity = new GraphNode();
  if (gltfNode.hasOwnProperty('name') && gltfNode.name.length > 0) {
    entity.name = gltfNode.name;
  } else {
    entity.name = 'node_' + nodeIndex;
  }

  if (gltfNode.hasOwnProperty('matrix')) {
    tempMat.data.set(gltfNode.matrix);
    tempMat.getTranslation(tempVec);
    entity.setLocalPosition(tempVec);
    tempMat.getEulerAngles(tempVec);
    entity.setLocalEulerAngles(tempVec);
    tempMat.getScale(tempVec);
    entity.setLocalScale(tempVec);
  }
  if (gltfNode.hasOwnProperty('rotation')) {
    const r = gltfNode.rotation;
    entity.setLocalRotation(r[0], r[1], r[2], r[3]);
  }
  if (gltfNode.hasOwnProperty('translation')) {
    const t = gltfNode.translation;
    entity.setLocalPosition(t[0], t[1], t[2]);
  }
  if (gltfNode.hasOwnProperty('scale')) {
    const s = gltfNode.scale;
    entity.setLocalScale(s[0], s[1], s[2]);
  }
  return entity;
};

const createCamera = function createCamera(gltfCamera, node) {
  const projection = gltfCamera.type === 'orthographic' ? PROJECTION_ORTHOGRAPHIC : PROJECTION_PERSPECTIVE;
  const gltfProperties = projection === PROJECTION_ORTHOGRAPHIC ? gltfCamera.orthographic : gltfCamera.perspective;
  const componentData = {
    enabled: false,
    projection: projection,
    nearClip: gltfProperties.znear,
    aspectRatioMode: ASPECT_AUTO
  };
  if (gltfProperties.zfar) {
    componentData.farClip = gltfProperties.zfar;
  }
  if (projection === PROJECTION_ORTHOGRAPHIC) {
    componentData.orthoHeight = 0.5 * gltfProperties.ymag;
    if (gltfProperties.ymag) {
      componentData.aspectRatioMode = ASPECT_MANUAL;
      componentData.aspectRatio = gltfProperties.xmag / gltfProperties.ymag;
    }
  } else {
    componentData.fov = gltfProperties.yfov * math.RAD_TO_DEG;
    if (gltfProperties.aspectRatio) {
      componentData.aspectRatioMode = ASPECT_MANUAL;
      componentData.aspectRatio = gltfProperties.aspectRatio;
    }
  }
  const cameraEntity = new Entity(gltfCamera.name);
  cameraEntity.addComponent('camera', componentData);
  return cameraEntity;
};

const createLight = function createLight(gltfLight, node) {
  const lightProps = {
    enabled: false,
    type: gltfLight.type === 'point' ? 'omni' : gltfLight.type,
    color: gltfLight.hasOwnProperty('color') ? new Color(gltfLight.color) : Color.WHITE,
    range: gltfLight.hasOwnProperty('range') ? gltfLight.range : 9999,
    falloffMode: LIGHTFALLOFF_INVERSESQUARED,
    intensity: gltfLight.hasOwnProperty('intensity') ? math.clamp(gltfLight.intensity, 0, 2) : 1
  };
  if (gltfLight.hasOwnProperty('spot')) {
    lightProps.innerConeAngle = gltfLight.spot.hasOwnProperty('innerConeAngle') ? gltfLight.spot.innerConeAngle * math.RAD_TO_DEG : 0;
    lightProps.outerConeAngle = gltfLight.spot.hasOwnProperty('outerConeAngle') ? gltfLight.spot.outerConeAngle * math.RAD_TO_DEG : Math.PI / 4;
  }

  if (gltfLight.hasOwnProperty("intensity")) {
    lightProps.luminance = gltfLight.intensity * Light.getLightUnitConversion(lightTypes[lightProps.type], lightProps.outerConeAngle, lightProps.innerConeAngle);
  }

  const lightEntity = new Entity(node.name);
  lightEntity.rotateLocal(90, 0, 0);

  lightEntity.addComponent('light', lightProps);
  return lightEntity;
};
const createSkins = function createSkins(device, gltf, nodes, bufferViews) {
  if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
    return [];
  }

  const glbSkins = new Map();
  return gltf.skins.map(function (gltfSkin) {
    return createSkin(device, gltfSkin, gltf.accessors, bufferViews, nodes, glbSkins);
  });
};
const createMeshes = function createMeshes(device, gltf, bufferViews, callback, flipV, meshVariants, meshDefaultMaterials, options) {
  if (!gltf.hasOwnProperty('meshes') || gltf.meshes.length === 0 || !gltf.hasOwnProperty('accessors') || gltf.accessors.length === 0 || !gltf.hasOwnProperty('bufferViews') || gltf.bufferViews.length === 0) {
    return [];
  }

  const vertexBufferDict = {};
  return gltf.meshes.map(function (gltfMesh) {
    return createMesh(device, gltfMesh, gltf.accessors, bufferViews, callback, flipV, vertexBufferDict, meshVariants, meshDefaultMaterials, options);
  });
};
const createMaterials = function createMaterials(gltf, textures, options, flipV) {
  if (!gltf.hasOwnProperty('materials') || gltf.materials.length === 0) {
    return [];
  }
  const preprocess = options && options.material && options.material.preprocess;
  const process = options && options.material && options.material.process || createMaterial;
  const postprocess = options && options.material && options.material.postprocess;
  return gltf.materials.map(function (gltfMaterial) {
    if (preprocess) {
      preprocess(gltfMaterial);
    }
    const material = process(gltfMaterial, textures, flipV);
    if (postprocess) {
      postprocess(gltfMaterial, material);
    }
    return material;
  });
};
const createVariants = function createVariants(gltf) {
  if (!gltf.hasOwnProperty("extensions") || !gltf.extensions.hasOwnProperty("KHR_materials_variants")) return null;
  const data = gltf.extensions.KHR_materials_variants.variants;
  const variants = {};
  for (let i = 0; i < data.length; i++) {
    variants[data[i].name] = i;
  }
  return variants;
};
const createAnimations = function createAnimations(gltf, nodes, bufferViews, options) {
  if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
    return [];
  }
  const preprocess = options && options.animation && options.animation.preprocess;
  const postprocess = options && options.animation && options.animation.postprocess;
  return gltf.animations.map(function (gltfAnimation, index) {
    if (preprocess) {
      preprocess(gltfAnimation);
    }
    const animation = createAnimation(gltfAnimation, index, gltf.accessors, bufferViews, nodes, gltf.meshes);
    if (postprocess) {
      postprocess(gltfAnimation, animation);
    }
    return animation;
  });
};
const createNodes = function createNodes(gltf, options) {
  if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
    return [];
  }
  const preprocess = options && options.node && options.node.preprocess;
  const process = options && options.node && options.node.process || createNode;
  const postprocess = options && options.node && options.node.postprocess;
  const nodes = gltf.nodes.map(function (gltfNode, index) {
    if (preprocess) {
      preprocess(gltfNode);
    }
    const node = process(gltfNode, index);
    if (postprocess) {
      postprocess(gltfNode, node);
    }
    return node;
  });

  for (let i = 0; i < gltf.nodes.length; ++i) {
    const gltfNode = gltf.nodes[i];
    if (gltfNode.hasOwnProperty('children')) {
      const parent = nodes[i];
      const uniqueNames = {};
      for (let j = 0; j < gltfNode.children.length; ++j) {
        const child = nodes[gltfNode.children[j]];
        if (!child.parent) {
          if (uniqueNames.hasOwnProperty(child.name)) {
            child.name += uniqueNames[child.name]++;
          } else {
            uniqueNames[child.name] = 1;
          }
          parent.addChild(child);
        }
      }
    }
  }
  return nodes;
};
const createScenes = function createScenes(gltf, nodes) {
  var _gltf$scenes$0$nodes;
  const scenes = [];
  const count = gltf.scenes.length;

  if (count === 1 && ((_gltf$scenes$0$nodes = gltf.scenes[0].nodes) == null ? void 0 : _gltf$scenes$0$nodes.length) === 1) {
    const nodeIndex = gltf.scenes[0].nodes[0];
    scenes.push(nodes[nodeIndex]);
  } else {
    for (let i = 0; i < count; i++) {
      const scene = gltf.scenes[i];
      if (scene.nodes) {
        const sceneRoot = new GraphNode(scene.name);
        for (let n = 0; n < scene.nodes.length; n++) {
          const childNode = nodes[scene.nodes[n]];
          sceneRoot.addChild(childNode);
        }
        scenes.push(sceneRoot);
      }
    }
  }
  return scenes;
};
const createCameras = function createCameras(gltf, nodes, options) {
  let cameras = null;
  if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('cameras') && gltf.cameras.length > 0) {
    const preprocess = options && options.camera && options.camera.preprocess;
    const process = options && options.camera && options.camera.process || createCamera;
    const postprocess = options && options.camera && options.camera.postprocess;
    gltf.nodes.forEach(function (gltfNode, nodeIndex) {
      if (gltfNode.hasOwnProperty('camera')) {
        const gltfCamera = gltf.cameras[gltfNode.camera];
        if (gltfCamera) {
          if (preprocess) {
            preprocess(gltfCamera);
          }
          const camera = process(gltfCamera, nodes[nodeIndex]);
          if (postprocess) {
            postprocess(gltfCamera, camera);
          }

          if (camera) {
            if (!cameras) cameras = new Map();
            cameras.set(gltfNode, camera);
          }
        }
      }
    });
  }
  return cameras;
};
const createLights = function createLights(gltf, nodes, options) {
  let lights = null;
  if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('extensions') && gltf.extensions.hasOwnProperty('KHR_lights_punctual') && gltf.extensions.KHR_lights_punctual.hasOwnProperty('lights')) {
    const gltfLights = gltf.extensions.KHR_lights_punctual.lights;
    if (gltfLights.length) {
      const preprocess = options && options.light && options.light.preprocess;
      const process = options && options.light && options.light.process || createLight;
      const postprocess = options && options.light && options.light.postprocess;

      gltf.nodes.forEach(function (gltfNode, nodeIndex) {
        if (gltfNode.hasOwnProperty('extensions') && gltfNode.extensions.hasOwnProperty('KHR_lights_punctual') && gltfNode.extensions.KHR_lights_punctual.hasOwnProperty('light')) {
          const lightIndex = gltfNode.extensions.KHR_lights_punctual.light;
          const gltfLight = gltfLights[lightIndex];
          if (gltfLight) {
            if (preprocess) {
              preprocess(gltfLight);
            }
            const light = process(gltfLight, nodes[nodeIndex]);
            if (postprocess) {
              postprocess(gltfLight, light);
            }

            if (light) {
              if (!lights) lights = new Map();
              lights.set(gltfNode, light);
            }
          }
        }
      });
    }
  }
  return lights;
};

const linkSkins = function linkSkins(gltf, renders, skins) {
  gltf.nodes.forEach(gltfNode => {
    if (gltfNode.hasOwnProperty('mesh') && gltfNode.hasOwnProperty('skin')) {
      const meshGroup = renders[gltfNode.mesh].meshes;
      meshGroup.forEach(mesh => {
        mesh.skin = skins[gltfNode.skin];
      });
    }
  });
};

const createResources = function createResources(device, gltf, bufferViews, textureAssets, options, callback) {
  const preprocess = options && options.global && options.global.preprocess;
  const postprocess = options && options.global && options.global.postprocess;
  if (preprocess) {
    preprocess(gltf);
  }

  const flipV = gltf.asset && gltf.asset.generator === 'PlayCanvas';

  if (flipV) {
    Debug.warn('glTF model may have flipped UVs. Please reconvert.');
  }
  const nodes = createNodes(gltf, options);
  const scenes = createScenes(gltf, nodes);
  const lights = createLights(gltf, nodes, options);
  const cameras = createCameras(gltf, nodes, options);
  const animations = createAnimations(gltf, nodes, bufferViews, options);
  const materials = createMaterials(gltf, textureAssets.map(function (textureAsset) {
    return textureAsset.resource;
  }), options, flipV);
  const variants = createVariants(gltf);
  const meshVariants = {};
  const meshDefaultMaterials = {};
  const meshes = createMeshes(device, gltf, bufferViews, callback, flipV, meshVariants, meshDefaultMaterials, options);
  const skins = createSkins(device, gltf, nodes, bufferViews);

  const renders = [];
  for (let i = 0; i < meshes.length; i++) {
    renders[i] = new Render();
    renders[i].meshes = meshes[i];
  }

  linkSkins(gltf, renders, skins);
  const result = new GlbResources(gltf);
  result.nodes = nodes;
  result.scenes = scenes;
  result.animations = animations;
  result.textures = textureAssets;
  result.materials = materials;
  result.variants = variants;
  result.meshVariants = meshVariants;
  result.meshDefaultMaterials = meshDefaultMaterials;
  result.renders = renders;
  result.skins = skins;
  result.lights = lights;
  result.cameras = cameras;
  if (postprocess) {
    postprocess(gltf, result);
  }
  callback(null, result);
};
const applySampler = function applySampler(texture, gltfSampler) {
  const getFilter = function getFilter(filter, defaultValue) {
    switch (filter) {
      case 9728:
        return FILTER_NEAREST;
      case 9729:
        return FILTER_LINEAR;
      case 9984:
        return FILTER_NEAREST_MIPMAP_NEAREST;
      case 9985:
        return FILTER_LINEAR_MIPMAP_NEAREST;
      case 9986:
        return FILTER_NEAREST_MIPMAP_LINEAR;
      case 9987:
        return FILTER_LINEAR_MIPMAP_LINEAR;
      default:
        return defaultValue;
    }
  };
  const getWrap = function getWrap(wrap, defaultValue) {
    switch (wrap) {
      case 33071:
        return ADDRESS_CLAMP_TO_EDGE;
      case 33648:
        return ADDRESS_MIRRORED_REPEAT;
      case 10497:
        return ADDRESS_REPEAT;
      default:
        return defaultValue;
    }
  };
  if (texture) {
    gltfSampler = gltfSampler || {};
    texture.minFilter = getFilter(gltfSampler.minFilter, FILTER_LINEAR_MIPMAP_LINEAR);
    texture.magFilter = getFilter(gltfSampler.magFilter, FILTER_LINEAR);
    texture.addressU = getWrap(gltfSampler.wrapS, ADDRESS_REPEAT);
    texture.addressV = getWrap(gltfSampler.wrapT, ADDRESS_REPEAT);
  }
};
let gltfTextureUniqueId = 0;

const loadImageAsync = function loadImageAsync(gltfImage, index, bufferViews, urlBase, registry, options, callback) {
  const preprocess = options && options.image && options.image.preprocess;
  const processAsync = options && options.image && options.image.processAsync || function (gltfImage, callback) {
    callback(null, null);
  };
  const postprocess = options && options.image && options.image.postprocess;
  const onLoad = function onLoad(textureAsset) {
    if (postprocess) {
      postprocess(gltfImage, textureAsset);
    }
    callback(null, textureAsset);
  };
  const mimeTypeFileExtensions = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/basis': 'basis',
    'image/ktx': 'ktx',
    'image/ktx2': 'ktx2',
    'image/vnd-ms.dds': 'dds'
  };
  const loadTexture = function loadTexture(url, bufferView, mimeType, options) {
    const name = (gltfImage.name || 'gltf-texture') + '-' + gltfTextureUniqueId++;

    const file = {
      url: url || name
    };
    if (bufferView) {
      file.contents = bufferView.slice(0).buffer;
    }
    if (mimeType) {
      const extension = mimeTypeFileExtensions[mimeType];
      if (extension) {
        file.filename = file.url + '.' + extension;
      }
    }

    const asset = new Asset(name, 'texture', file, null, options);
    asset.on('load', onLoad);
    asset.on('error', callback);
    registry.add(asset);
    registry.load(asset);
  };
  if (preprocess) {
    preprocess(gltfImage);
  }
  processAsync(gltfImage, function (err, textureAsset) {
    if (err) {
      callback(err);
    } else if (textureAsset) {
      onLoad(textureAsset);
    } else {
      if (gltfImage.hasOwnProperty('uri')) {
        if (isDataURI(gltfImage.uri)) {
          loadTexture(gltfImage.uri, null, getDataURIMimeType(gltfImage.uri), null);
        } else {
          loadTexture(path.join(urlBase, gltfImage.uri), null, null, {
            crossOrigin: 'anonymous'
          });
        }
      } else if (gltfImage.hasOwnProperty('bufferView') && gltfImage.hasOwnProperty('mimeType')) {
        loadTexture(null, bufferViews[gltfImage.bufferView], gltfImage.mimeType, null);
      } else {
        callback('Invalid image found in gltf (neither uri or bufferView found). index=' + index);
      }
    }
  });
};

const loadTexturesAsync = function loadTexturesAsync(gltf, bufferViews, urlBase, registry, options, callback) {
  if (!gltf.hasOwnProperty('images') || gltf.images.length === 0 || !gltf.hasOwnProperty('textures') || gltf.textures.length === 0) {
    callback(null, []);
    return;
  }
  const preprocess = options && options.texture && options.texture.preprocess;
  const processAsync = options && options.texture && options.texture.processAsync || function (gltfTexture, gltfImages, callback) {
    callback(null, null);
  };
  const postprocess = options && options.texture && options.texture.postprocess;
  const assets = [];
  const textures = [];

  let remaining = gltf.textures.length;
  const onLoad = function onLoad(textureIndex, imageIndex) {
    if (!textures[imageIndex]) {
      textures[imageIndex] = [];
    }
    textures[imageIndex].push(textureIndex);
    if (--remaining === 0) {
      const result = [];
      textures.forEach(function (textureList, imageIndex) {
        textureList.forEach(function (textureIndex, index) {
          const textureAsset = index === 0 ? assets[imageIndex] : cloneTextureAsset(assets[imageIndex]);
          applySampler(textureAsset.resource, (gltf.samplers || [])[gltf.textures[textureIndex].sampler]);
          result[textureIndex] = textureAsset;
          if (postprocess) {
            postprocess(gltf.textures[textureIndex], textureAsset);
          }
        });
      });
      callback(null, result);
    }
  };
  for (let i = 0; i < gltf.textures.length; ++i) {
    const gltfTexture = gltf.textures[i];
    if (preprocess) {
      preprocess(gltfTexture);
    }
    processAsync(gltfTexture, gltf.images, function (i, gltfTexture, err, gltfImageIndex) {
      if (err) {
        callback(err);
      } else {
        if (gltfImageIndex === undefined || gltfImageIndex === null) {
          var _gltfTexture$extensio, _gltfTexture$extensio2;
          gltfImageIndex = gltfTexture == null ? void 0 : (_gltfTexture$extensio = gltfTexture.extensions) == null ? void 0 : (_gltfTexture$extensio2 = _gltfTexture$extensio.KHR_texture_basisu) == null ? void 0 : _gltfTexture$extensio2.source;
          if (gltfImageIndex === undefined) {
            gltfImageIndex = gltfTexture.source;
          }
        }
        if (assets[gltfImageIndex]) {
          onLoad(i, gltfImageIndex);
        } else {
          const gltfImage = gltf.images[gltfImageIndex];
          loadImageAsync(gltfImage, i, bufferViews, urlBase, registry, options, function (err, textureAsset) {
            if (err) {
              callback(err);
            } else {
              assets[gltfImageIndex] = textureAsset;
              onLoad(i, gltfImageIndex);
            }
          });
        }
      }
    }.bind(null, i, gltfTexture));
  }
};

const loadBuffersAsync = function loadBuffersAsync(gltf, binaryChunk, urlBase, options, callback) {
  const result = [];
  if (!gltf.buffers || gltf.buffers.length === 0) {
    callback(null, result);
    return;
  }
  const preprocess = options && options.buffer && options.buffer.preprocess;
  const processAsync = options && options.buffer && options.buffer.processAsync || function (gltfBuffer, callback) {
    callback(null, null);
  };
  const postprocess = options && options.buffer && options.buffer.postprocess;
  let remaining = gltf.buffers.length;
  const onLoad = function onLoad(index, buffer) {
    result[index] = buffer;
    if (postprocess) {
      postprocess(gltf.buffers[index], buffer);
    }
    if (--remaining === 0) {
      callback(null, result);
    }
  };
  for (let i = 0; i < gltf.buffers.length; ++i) {
    const gltfBuffer = gltf.buffers[i];
    if (preprocess) {
      preprocess(gltfBuffer);
    }
    processAsync(gltfBuffer, function (i, gltfBuffer, err, arrayBuffer) {
      if (err) {
        callback(err);
      } else if (arrayBuffer) {
        onLoad(i, new Uint8Array(arrayBuffer));
      } else {
        if (gltfBuffer.hasOwnProperty('uri')) {
          if (isDataURI(gltfBuffer.uri)) {
            const byteString = atob(gltfBuffer.uri.split(',')[1]);

            const binaryArray = new Uint8Array(byteString.length);

            for (let j = 0; j < byteString.length; j++) {
              binaryArray[j] = byteString.charCodeAt(j);
            }
            onLoad(i, binaryArray);
          } else {
            http.get(path.join(urlBase, gltfBuffer.uri), {
              cache: true,
              responseType: 'arraybuffer',
              retry: false
            }, function (i, err, result) {
              if (err) {
                callback(err);
              } else {
                onLoad(i, new Uint8Array(result));
              }
            }.bind(null, i));
          }
        } else {
          onLoad(i, binaryChunk);
        }
      }
    }.bind(null, i, gltfBuffer));
  }
};

const parseGltf = function parseGltf(gltfChunk, callback) {
  const decodeBinaryUtf8 = function decodeBinaryUtf8(array) {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder().decode(array);
    }
    let str = '';
    for (let i = 0; i < array.length; i++) {
      str += String.fromCharCode(array[i]);
    }
    return decodeURIComponent(escape(str));
  };
  const gltf = JSON.parse(decodeBinaryUtf8(gltfChunk));

  if (gltf.asset && gltf.asset.version && parseFloat(gltf.asset.version) < 2) {
    callback(`Invalid gltf version. Expected version 2.0 or above but found version '${gltf.asset.version}'.`);
    return;
  }

  const extensionsRequired = (gltf == null ? void 0 : gltf.extensionsRequired) || [];
  if (!dracoDecoderInstance && !getGlobalDracoDecoderModule() && extensionsRequired.indexOf('KHR_draco_mesh_compression') !== -1) {
    WasmModule.getInstance('DracoDecoderModule', instance => {
      dracoDecoderInstance = instance;
      callback(null, gltf);
    });
  } else {
    callback(null, gltf);
  }
};

const parseGlb = function parseGlb(glbData, callback) {
  const data = glbData instanceof ArrayBuffer ? new DataView(glbData) : new DataView(glbData.buffer, glbData.byteOffset, glbData.byteLength);

  const magic = data.getUint32(0, true);
  const version = data.getUint32(4, true);
  const length = data.getUint32(8, true);
  if (magic !== 0x46546C67) {
    callback('Invalid magic number found in glb header. Expected 0x46546C67, found 0x' + magic.toString(16));
    return;
  }
  if (version !== 2) {
    callback('Invalid version number found in glb header. Expected 2, found ' + version);
    return;
  }
  if (length <= 0 || length > data.byteLength) {
    callback('Invalid length found in glb header. Found ' + length);
    return;
  }

  const chunks = [];
  let offset = 12;
  while (offset < length) {
    const chunkLength = data.getUint32(offset, true);
    if (offset + chunkLength + 8 > data.byteLength) {
      throw new Error('Invalid chunk length found in glb. Found ' + chunkLength);
    }
    const chunkType = data.getUint32(offset + 4, true);
    const chunkData = new Uint8Array(data.buffer, data.byteOffset + offset + 8, chunkLength);
    chunks.push({
      length: chunkLength,
      type: chunkType,
      data: chunkData
    });
    offset += chunkLength + 8;
  }
  if (chunks.length !== 1 && chunks.length !== 2) {
    callback('Invalid number of chunks found in glb file.');
    return;
  }
  if (chunks[0].type !== 0x4E4F534A) {
    callback('Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x' + chunks[0].type.toString(16));
    return;
  }
  if (chunks.length > 1 && chunks[1].type !== 0x004E4942) {
    callback('Invalid chunk type found in glb file. Expected 0x004E4942, found 0x' + chunks[1].type.toString(16));
    return;
  }
  callback(null, {
    gltfChunk: chunks[0].data,
    binaryChunk: chunks.length === 2 ? chunks[1].data : null
  });
};

const parseChunk = function parseChunk(filename, data, callback) {
  const hasGlbHeader = () => {
    const u8 = new Uint8Array(data);
    return u8[0] === 103 && u8[1] === 108 && u8[2] === 84 && u8[3] === 70;
  };
  if (filename && filename.toLowerCase().endsWith('.glb') || hasGlbHeader()) {
    parseGlb(data, callback);
  } else {
    callback(null, {
      gltfChunk: data,
      binaryChunk: null
    });
  }
};

const parseBufferViewsAsync = function parseBufferViewsAsync(gltf, buffers, options, callback) {
  const result = [];
  const preprocess = options && options.bufferView && options.bufferView.preprocess;
  const processAsync = options && options.bufferView && options.bufferView.processAsync || function (gltfBufferView, buffers, callback) {
    callback(null, null);
  };
  const postprocess = options && options.bufferView && options.bufferView.postprocess;
  let remaining = gltf.bufferViews ? gltf.bufferViews.length : 0;

  if (!remaining) {
    callback(null, null);
    return;
  }
  const onLoad = function onLoad(index, bufferView) {
    const gltfBufferView = gltf.bufferViews[index];
    if (gltfBufferView.hasOwnProperty('byteStride')) {
      bufferView.byteStride = gltfBufferView.byteStride;
    }
    result[index] = bufferView;
    if (postprocess) {
      postprocess(gltfBufferView, bufferView);
    }
    if (--remaining === 0) {
      callback(null, result);
    }
  };
  for (let i = 0; i < gltf.bufferViews.length; ++i) {
    const gltfBufferView = gltf.bufferViews[i];
    if (preprocess) {
      preprocess(gltfBufferView);
    }
    processAsync(gltfBufferView, buffers, function (i, gltfBufferView, err, result) {
      if (err) {
        callback(err);
      } else if (result) {
        onLoad(i, result);
      } else {
        const buffer = buffers[gltfBufferView.buffer];
        const typedArray = new Uint8Array(buffer.buffer, buffer.byteOffset + (gltfBufferView.byteOffset || 0), gltfBufferView.byteLength);
        onLoad(i, typedArray);
      }
    }.bind(null, i, gltfBufferView));
  }
};

class GlbParser {
  static parseAsync(filename, urlBase, data, device, registry, options, callback) {
    parseChunk(filename, data, function (err, chunks) {
      if (err) {
        callback(err);
        return;
      }

      parseGltf(chunks.gltfChunk, function (err, gltf) {
        if (err) {
          callback(err);
          return;
        }

        loadBuffersAsync(gltf, chunks.binaryChunk, urlBase, options, function (err, buffers) {
          if (err) {
            callback(err);
            return;
          }

          parseBufferViewsAsync(gltf, buffers, options, function (err, bufferViews) {
            if (err) {
              callback(err);
              return;
            }

            loadTexturesAsync(gltf, bufferViews, urlBase, registry, options, function (err, textureAssets) {
              if (err) {
                callback(err);
                return;
              }
              createResources(device, gltf, bufferViews, textureAssets, options, callback);
            });
          });
        });
      });
    });
  }

  static parse(filename, data, device, options) {
    let result = null;
    options = options || {};

    parseChunk(filename, data, function (err, chunks) {
      if (err) {
        console.error(err);
      } else {
        parseGltf(chunks.gltfChunk, function (err, gltf) {
          if (err) {
            console.error(err);
          } else {
            parseBufferViewsAsync(gltf, [chunks.binaryChunk], options, function (err, bufferViews) {
              if (err) {
                console.error(err);
              } else {
                createResources(device, gltf, bufferViews, [], options, function (err, result_) {
                  if (err) {
                    console.error(err);
                  } else {
                    result = result_;
                  }
                });
              }
            });
          }
        });
      }
    });
    return result;
  }
  constructor(device, assets, maxRetries) {
    this._device = device;
    this._assets = assets;
    this._defaultMaterial = createMaterial({
      name: 'defaultGlbMaterial'
    }, []);
    this.maxRetries = maxRetries;
  }
  _getUrlWithoutParams(url) {
    return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
  }
  load(url, callback, asset) {
    Asset.fetchArrayBuffer(url.load, (err, result) => {
      if (err) {
        callback(err);
      } else {
        GlbParser.parseAsync(this._getUrlWithoutParams(url.original), path.extractPath(url.load), result, this._device, asset.registry, asset.options, (err, result) => {
          if (err) {
            callback(err);
          } else {
            callback(null, new GlbContainerResource(result, asset, this._assets, this._defaultMaterial));
          }
        });
      }
    }, asset, this.maxRetries);
  }
  open(url, data, asset) {
    return data;
  }
  patch(asset, assets) {}
}

export { GlbParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9wYXJzZXJzL2dsYi1wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi8uLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgV2FzbU1vZHVsZSB9IGZyb20gJy4uLy4uL2NvcmUvd2FzbS1tb2R1bGUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUsXG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDVUxMRkFDRV9OT05FLCBDVUxMRkFDRV9CQUNLLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQUklNSVRJVkVfTElORUxPT1AsIFBSSU1JVElWRV9MSU5FU1RSSVAsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX1BPSU5UUywgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIFNFTUFOVElDX1RFWENPT1JEMCwgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19URVhDT09SRDIsIFNFTUFOVElDX1RFWENPT1JEMywgU0VNQU5USUNfVEVYQ09PUkQ0LCBTRU1BTlRJQ19URVhDT09SRDUsIFNFTUFOVElDX1RFWENPT1JENiwgU0VNQU5USUNfVEVYQ09PUkQ3LFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzIsIENIVU5LQVBJXzFfNThcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEJMRU5EX05PUk1BTCwgTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuICAgIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIEFTUEVDVF9NQU5VQUwsIEFTUEVDVF9BVVRPLCBTUEVDT0NDX0FPXG59IGZyb20gJy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IExpZ2h0LCBsaWdodFR5cGVzIH0gZnJvbSAnLi4vLi4vc2NlbmUvbGlnaHQuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNb3JwaFRhcmdldCB9IGZyb20gJy4uLy4uL3NjZW5lL21vcnBoLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBjYWxjdWxhdGVOb3JtYWxzIH0gZnJvbSAnLi4vLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBSZW5kZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9yZW5kZXIuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uLy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBJTlRFUlBPTEFUSU9OX0NVQklDLCBJTlRFUlBPTEFUSU9OX0xJTkVBUiwgSU5URVJQT0xBVElPTl9TVEVQIH0gZnJvbSAnLi4vYW5pbS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQW5pbUN1cnZlIH0gZnJvbSAnLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBBbmltRGF0YSB9IGZyb20gJy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyc7XG5pbXBvcnQgeyBBbmltVHJhY2sgfSBmcm9tICcuLi9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vYXNzZXQvYXNzZXQuanMnO1xuaW1wb3J0IHsgR2xiQ29udGFpbmVyUmVzb3VyY2UgfSBmcm9tICcuL2dsYi1jb250YWluZXItcmVzb3VyY2UuanMnO1xuXG4vLyBpbnN0YW5jZSBvZiB0aGUgZHJhY28gZGVjb2RlclxubGV0IGRyYWNvRGVjb2Rlckluc3RhbmNlID0gbnVsbDtcblxuY29uc3QgZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlID0gKCkgPT4ge1xuICAgIHJldHVybiB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuRHJhY29EZWNvZGVyTW9kdWxlO1xufTtcblxuLy8gcmVzb3VyY2VzIGxvYWRlZCBmcm9tIEdMQiBmaWxlIHRoYXQgdGhlIHBhcnNlciByZXR1cm5zXG5jbGFzcyBHbGJSZXNvdXJjZXMge1xuICAgIGNvbnN0cnVjdG9yKGdsdGYpIHtcbiAgICAgICAgdGhpcy5nbHRmID0gZ2x0ZjtcbiAgICAgICAgdGhpcy5ub2RlcyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2NlbmVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5hbmltYXRpb25zID0gbnVsbDtcbiAgICAgICAgdGhpcy50ZXh0dXJlcyA9IG51bGw7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy52YXJpYW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaFZhcmlhbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5tZXNoRGVmYXVsdE1hdGVyaWFscyA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVycyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2tpbnMgPSBudWxsO1xuICAgICAgICB0aGlzLmxpZ2h0cyA9IG51bGw7XG4gICAgICAgIHRoaXMuY2FtZXJhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gcmVuZGVyIG5lZWRzIHRvIGRlYyByZWYgbWVzaGVzXG4gICAgICAgIGlmICh0aGlzLnJlbmRlcnMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVycy5mb3JFYWNoKChyZW5kZXIpID0+IHtcbiAgICAgICAgICAgICAgICByZW5kZXIubWVzaGVzID0gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBpc0RhdGFVUkkgPSBmdW5jdGlvbiAodXJpKSB7XG4gICAgcmV0dXJuIC9eZGF0YTouKiwuKiQvaS50ZXN0KHVyaSk7XG59O1xuXG5jb25zdCBnZXREYXRhVVJJTWltZVR5cGUgPSBmdW5jdGlvbiAodXJpKSB7XG4gICAgcmV0dXJuIHVyaS5zdWJzdHJpbmcodXJpLmluZGV4T2YoJzonKSArIDEsIHVyaS5pbmRleE9mKCc7JykpO1xufTtcblxuY29uc3QgZ2V0TnVtQ29tcG9uZW50cyA9IGZ1bmN0aW9uIChhY2Nlc3NvclR5cGUpIHtcbiAgICBzd2l0Y2ggKGFjY2Vzc29yVHlwZSkge1xuICAgICAgICBjYXNlICdTQ0FMQVInOiByZXR1cm4gMTtcbiAgICAgICAgY2FzZSAnVkVDMic6IHJldHVybiAyO1xuICAgICAgICBjYXNlICdWRUMzJzogcmV0dXJuIDM7XG4gICAgICAgIGNhc2UgJ1ZFQzQnOiByZXR1cm4gNDtcbiAgICAgICAgY2FzZSAnTUFUMic6IHJldHVybiA0O1xuICAgICAgICBjYXNlICdNQVQzJzogcmV0dXJuIDk7XG4gICAgICAgIGNhc2UgJ01BVDQnOiByZXR1cm4gMTY7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAzO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudFR5cGUgPSBmdW5jdGlvbiAoY29tcG9uZW50VHlwZSkge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiBUWVBFX0lOVDg7XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIFRZUEVfVUlOVDg7XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIFRZUEVfSU5UMTY7XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIFRZUEVfVUlOVDE2O1xuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiBUWVBFX0lOVDMyO1xuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiBUWVBFX1VJTlQzMjtcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gVFlQRV9GTE9BVDMyO1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gMDtcbiAgICB9XG59O1xuXG5jb25zdCBnZXRDb21wb25lbnRTaXplSW5CeXRlcyA9IGZ1bmN0aW9uIChjb21wb25lbnRUeXBlKSB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIDE7ICAgIC8vIGludDhcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gMTsgICAgLy8gdWludDhcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gMjsgICAgLy8gaW50MTZcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gMjsgICAgLy8gdWludDE2XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIDQ7ICAgIC8vIGludDMyXG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIDQ7ICAgIC8vIHVpbnQzMlxuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiA0OyAgICAvLyBmbG9hdDMyXG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAwO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudERhdGFUeXBlID0gZnVuY3Rpb24gKGNvbXBvbmVudFR5cGUpIHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gSW50OEFycmF5O1xuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiBVaW50OEFycmF5O1xuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiBJbnQxNkFycmF5O1xuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiBVaW50MTZBcnJheTtcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gSW50MzJBcnJheTtcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gVWludDMyQXJyYXk7XG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIEZsb2F0MzJBcnJheTtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuY29uc3QgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAgPSB7XG4gICAgJ1BPU0lUSU9OJzogU0VNQU5USUNfUE9TSVRJT04sXG4gICAgJ05PUk1BTCc6IFNFTUFOVElDX05PUk1BTCxcbiAgICAnVEFOR0VOVCc6IFNFTUFOVElDX1RBTkdFTlQsXG4gICAgJ0NPTE9SXzAnOiBTRU1BTlRJQ19DT0xPUixcbiAgICAnSk9JTlRTXzAnOiBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgJ1dFSUdIVFNfMCc6IFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgICdURVhDT09SRF8wJzogU0VNQU5USUNfVEVYQ09PUkQwLFxuICAgICdURVhDT09SRF8xJzogU0VNQU5USUNfVEVYQ09PUkQxLFxuICAgICdURVhDT09SRF8yJzogU0VNQU5USUNfVEVYQ09PUkQyLFxuICAgICdURVhDT09SRF8zJzogU0VNQU5USUNfVEVYQ09PUkQzLFxuICAgICdURVhDT09SRF80JzogU0VNQU5USUNfVEVYQ09PUkQ0LFxuICAgICdURVhDT09SRF81JzogU0VNQU5USUNfVEVYQ09PUkQ1LFxuICAgICdURVhDT09SRF82JzogU0VNQU5USUNfVEVYQ09PUkQ2LFxuICAgICdURVhDT09SRF83JzogU0VNQU5USUNfVEVYQ09PUkQ3XG59O1xuXG4vLyByZXR1cm5zIGEgZnVuY3Rpb24gZm9yIGRlcXVhbnRpemluZyB0aGUgZGF0YSB0eXBlXG5jb25zdCBnZXREZXF1YW50aXplRnVuYyA9IChzcmNUeXBlKSA9PiB7XG4gICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9LaHJvbm9zR3JvdXAvZ2xURi90cmVlL21hc3Rlci9leHRlbnNpb25zLzIuMC9LaHJvbm9zL0tIUl9tZXNoX3F1YW50aXphdGlvbiNlbmNvZGluZy1xdWFudGl6ZWQtZGF0YVxuICAgIHN3aXRjaCAoc3JjVHlwZSkge1xuICAgICAgICBjYXNlIFRZUEVfSU5UODogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDEyNy4wLCAtMS4wKTtcbiAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OiByZXR1cm4geCA9PiB4IC8gMjU1LjA7XG4gICAgICAgIGNhc2UgVFlQRV9JTlQxNjogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDMyNzY3LjAsIC0xLjApO1xuICAgICAgICBjYXNlIFRZUEVfVUlOVDE2OiByZXR1cm4geCA9PiB4IC8gNjU1MzUuMDtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIHggPT4geDtcbiAgICB9XG59O1xuXG4vLyBkZXF1YW50aXplIGFuIGFycmF5IG9mIGRhdGFcbmNvbnN0IGRlcXVhbnRpemVBcnJheSA9IGZ1bmN0aW9uIChkc3RBcnJheSwgc3JjQXJyYXksIHNyY1R5cGUpIHtcbiAgICBjb25zdCBjb252RnVuYyA9IGdldERlcXVhbnRpemVGdW5jKHNyY1R5cGUpO1xuICAgIGNvbnN0IGxlbiA9IHNyY0FycmF5Lmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIGRzdEFycmF5W2ldID0gY29udkZ1bmMoc3JjQXJyYXlbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gZHN0QXJyYXk7XG59O1xuXG4vLyBnZXQgYWNjZXNzb3IgZGF0YSwgbWFraW5nIGEgY29weSBhbmQgcGF0Y2hpbmcgaW4gdGhlIGNhc2Ugb2YgYSBzcGFyc2UgYWNjZXNzb3JcbmNvbnN0IGdldEFjY2Vzc29yRGF0YSA9IGZ1bmN0aW9uIChnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCBmbGF0dGVuID0gZmFsc2UpIHtcbiAgICBjb25zdCBudW1Db21wb25lbnRzID0gZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSk7XG4gICAgY29uc3QgZGF0YVR5cGUgPSBnZXRDb21wb25lbnREYXRhVHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgaWYgKCFkYXRhVHlwZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBidWZmZXJWaWV3ID0gYnVmZmVyVmlld3NbZ2x0ZkFjY2Vzc29yLmJ1ZmZlclZpZXddO1xuICAgIGxldCByZXN1bHQ7XG5cbiAgICBpZiAoZ2x0ZkFjY2Vzc29yLnNwYXJzZSkge1xuICAgICAgICAvLyBoYW5kbGUgc3BhcnNlIGRhdGFcbiAgICAgICAgY29uc3Qgc3BhcnNlID0gZ2x0ZkFjY2Vzc29yLnNwYXJzZTtcblxuICAgICAgICAvLyBnZXQgaW5kaWNlcyBkYXRhXG4gICAgICAgIGNvbnN0IGluZGljZXNBY2Nlc3NvciA9IHtcbiAgICAgICAgICAgIGNvdW50OiBzcGFyc2UuY291bnQsXG4gICAgICAgICAgICB0eXBlOiAnU0NBTEFSJ1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBpbmRpY2VzID0gZ2V0QWNjZXNzb3JEYXRhKE9iamVjdC5hc3NpZ24oaW5kaWNlc0FjY2Vzc29yLCBzcGFyc2UuaW5kaWNlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBkYXRhIHZhbHVlcyBkYXRhXG4gICAgICAgIGNvbnN0IHZhbHVlc0FjY2Vzc29yID0ge1xuICAgICAgICAgICAgY291bnQ6IHNwYXJzZS5jb3VudCxcbiAgICAgICAgICAgIHR5cGU6IGdsdGZBY2Nlc3Nvci5zY2FsYXIsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiBnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbih2YWx1ZXNBY2Nlc3Nvciwgc3BhcnNlLnZhbHVlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBnZXQgYmFzZSBkYXRhXG4gICAgICAgIGlmIChnbHRmQWNjZXNzb3IuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUFjY2Vzc29yID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXc6IGdsdGZBY2Nlc3Nvci5idWZmZXJWaWV3LFxuICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXQ6IGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgIGNvdW50OiBnbHRmQWNjZXNzb3IuY291bnQsXG4gICAgICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYmFzZSBkYXRhIHNpbmNlIHdlJ2xsIHBhdGNoIHRoZSB2YWx1ZXNcbiAgICAgICAgICAgIHJlc3VsdCA9IGdldEFjY2Vzc29yRGF0YShiYXNlQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKS5zbGljZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gYmFzZSBkYXRhLCBjcmVhdGUgZW1wdHkgMCdkIG91dCBkYXRhXG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvdW50ICogbnVtQ29tcG9uZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwYXJzZS5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRJbmRleCA9IGluZGljZXNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bUNvbXBvbmVudHM7ICsraikge1xuICAgICAgICAgICAgICAgIHJlc3VsdFt0YXJnZXRJbmRleCAqIG51bUNvbXBvbmVudHMgKyBqXSA9IHZhbHVlc1tpICogbnVtQ29tcG9uZW50cyArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChmbGF0dGVuICYmIGJ1ZmZlclZpZXcuaGFzT3duUHJvcGVydHkoJ2J5dGVTdHJpZGUnKSkge1xuICAgICAgICAvLyBmbGF0dGVuIHN0cmlkZGVuIGRhdGFcbiAgICAgICAgY29uc3QgYnl0ZXNQZXJFbGVtZW50ID0gbnVtQ29tcG9uZW50cyAqIGRhdGFUeXBlLkJZVEVTX1BFUl9FTEVNRU5UO1xuICAgICAgICBjb25zdCBzdG9yYWdlID0gbmV3IEFycmF5QnVmZmVyKGdsdGZBY2Nlc3Nvci5jb3VudCAqIGJ5dGVzUGVyRWxlbWVudCk7XG4gICAgICAgIGNvbnN0IHRtcEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoc3RvcmFnZSk7XG5cbiAgICAgICAgbGV0IGRzdE9mZnNldCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0ZkFjY2Vzc29yLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gYWRkIGJ1ZmZlclZpZXcuYnl0ZU9mZnNldCBiZWNhdXNlIGFjY2Vzc29yIHRha2VzIHRoaXMgaW50byBhY2NvdW50XG4gICAgICAgICAgICBsZXQgc3JjT2Zmc2V0ID0gKGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0IHx8IDApICsgaSAqIGJ1ZmZlclZpZXcuYnl0ZVN0cmlkZTtcbiAgICAgICAgICAgIGZvciAobGV0IGIgPSAwOyBiIDwgYnl0ZXNQZXJFbGVtZW50OyArK2IpIHtcbiAgICAgICAgICAgICAgICB0bXBBcnJheVtkc3RPZmZzZXQrK10gPSBidWZmZXJWaWV3W3NyY09mZnNldCsrXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdCA9IG5ldyBkYXRhVHlwZShzdG9yYWdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoYnVmZmVyVmlldy5idWZmZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVPZmZzZXQgKyAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbHRmQWNjZXNzb3IuY291bnQgKiBudW1Db21wb25lbnRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gZ2V0IGFjY2Vzc29yIGRhdGEgYXMgKHVubm9ybWFsaXplZCwgdW5xdWFudGl6ZWQpIEZsb2F0MzIgZGF0YVxuY29uc3QgZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMiA9IGZ1bmN0aW9uIChnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzKSB7XG4gICAgY29uc3QgZGF0YSA9IGdldEFjY2Vzc29yRGF0YShnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKTtcbiAgICBpZiAoZGF0YSBpbnN0YW5jZW9mIEZsb2F0MzJBcnJheSB8fCAhZ2x0ZkFjY2Vzc29yLm5vcm1hbGl6ZWQpIHtcbiAgICAgICAgLy8gaWYgdGhlIHNvdXJjZSBkYXRhIGlzIHF1YW50aXplZCAoc2F5IHRvIGludDE2KSwgYnV0IG5vdCBub3JtYWxpemVkXG4gICAgICAgIC8vIHRoZW4gcmVhZGluZyB0aGUgdmFsdWVzIG9mIHRoZSBhcnJheSBpcyB0aGUgc2FtZSB3aGV0aGVyIHRoZSB2YWx1ZXNcbiAgICAgICAgLy8gYXJlIHN0b3JlZCBhcyBmbG9hdDMyIG9yIGludDE2LiBzbyBwcm9iYWJseSBubyBuZWVkIHRvIGNvbnZlcnQgdG9cbiAgICAgICAgLy8gZmxvYXQzMi5cbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuXG4gICAgY29uc3QgZmxvYXQzMkRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KGRhdGEubGVuZ3RoKTtcbiAgICBkZXF1YW50aXplQXJyYXkoZmxvYXQzMkRhdGEsIGRhdGEsIGdldENvbXBvbmVudFR5cGUoZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUpKTtcbiAgICByZXR1cm4gZmxvYXQzMkRhdGE7XG59O1xuXG4vLyByZXR1cm5zIGEgZGVxdWFudGl6ZWQgYm91bmRpbmcgYm94IGZvciB0aGUgYWNjZXNzb3JcbmNvbnN0IGdldEFjY2Vzc29yQm91bmRpbmdCb3ggPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yKSB7XG4gICAgbGV0IG1pbiA9IGdsdGZBY2Nlc3Nvci5taW47XG4gICAgbGV0IG1heCA9IGdsdGZBY2Nlc3Nvci5tYXg7XG4gICAgaWYgKCFtaW4gfHwgIW1heCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoZ2x0ZkFjY2Vzc29yLm5vcm1hbGl6ZWQpIHtcbiAgICAgICAgY29uc3QgY3R5cGUgPSBnZXRDb21wb25lbnRUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgbWluID0gZGVxdWFudGl6ZUFycmF5KFtdLCBtaW4sIGN0eXBlKTtcbiAgICAgICAgbWF4ID0gZGVxdWFudGl6ZUFycmF5KFtdLCBtYXgsIGN0eXBlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEJvdW5kaW5nQm94KFxuICAgICAgICBuZXcgVmVjMygobWF4WzBdICsgbWluWzBdKSAqIDAuNSwgKG1heFsxXSArIG1pblsxXSkgKiAwLjUsIChtYXhbMl0gKyBtaW5bMl0pICogMC41KSxcbiAgICAgICAgbmV3IFZlYzMoKG1heFswXSAtIG1pblswXSkgKiAwLjUsIChtYXhbMV0gLSBtaW5bMV0pICogMC41LCAobWF4WzJdIC0gbWluWzJdKSAqIDAuNSlcbiAgICApO1xufTtcblxuY29uc3QgZ2V0UHJpbWl0aXZlVHlwZSA9IGZ1bmN0aW9uIChwcmltaXRpdmUpIHtcbiAgICBpZiAoIXByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgnbW9kZScpKSB7XG4gICAgICAgIHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgIH1cblxuICAgIHN3aXRjaCAocHJpbWl0aXZlLm1vZGUpIHtcbiAgICAgICAgY2FzZSAwOiByZXR1cm4gUFJJTUlUSVZFX1BPSU5UUztcbiAgICAgICAgY2FzZSAxOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVTO1xuICAgICAgICBjYXNlIDI6IHJldHVybiBQUklNSVRJVkVfTElORUxPT1A7XG4gICAgICAgIGNhc2UgMzogcmV0dXJuIFBSSU1JVElWRV9MSU5FU1RSSVA7XG4gICAgICAgIGNhc2UgNDogcmV0dXJuIFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgICAgIGNhc2UgNTogcmV0dXJuIFBSSU1JVElWRV9UUklTVFJJUDtcbiAgICAgICAgY2FzZSA2OiByZXR1cm4gUFJJTUlUSVZFX1RSSUZBTjtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgfVxufTtcblxuY29uc3QgZ2VuZXJhdGVJbmRpY2VzID0gZnVuY3Rpb24gKG51bVZlcnRpY2VzKSB7XG4gICAgY29uc3QgZHVtbXlJbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KG51bVZlcnRpY2VzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVZlcnRpY2VzOyBpKyspIHtcbiAgICAgICAgZHVtbXlJbmRpY2VzW2ldID0gaTtcbiAgICB9XG4gICAgcmV0dXJuIGR1bW15SW5kaWNlcztcbn07XG5cbmNvbnN0IGdlbmVyYXRlTm9ybWFscyA9IGZ1bmN0aW9uIChzb3VyY2VEZXNjLCBpbmRpY2VzKSB7XG4gICAgLy8gZ2V0IHBvc2l0aW9uc1xuICAgIGNvbnN0IHAgPSBzb3VyY2VEZXNjW1NFTUFOVElDX1BPU0lUSU9OXTtcbiAgICBpZiAoIXAgfHwgcC5jb21wb25lbnRzICE9PSAzKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgcG9zaXRpb25zO1xuICAgIGlmIChwLnNpemUgIT09IHAuc3RyaWRlKSB7XG4gICAgICAgIC8vIGV4dHJhY3QgcG9zaXRpb25zIHdoaWNoIGFyZW4ndCB0aWdodGx5IHBhY2tlZFxuICAgICAgICBjb25zdCBzcmNTdHJpZGUgPSBwLnN0cmlkZSAvIHR5cGVkQXJyYXlUeXBlc0J5dGVTaXplW3AudHlwZV07XG4gICAgICAgIGNvbnN0IHNyYyA9IG5ldyB0eXBlZEFycmF5VHlwZXNbcC50eXBlXShwLmJ1ZmZlciwgcC5vZmZzZXQsIHAuY291bnQgKiBzcmNTdHJpZGUpO1xuICAgICAgICBwb3NpdGlvbnMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5jb3VudCAqIDMpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHAuY291bnQ7ICsraSkge1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAzICsgMF0gPSBzcmNbaSAqIHNyY1N0cmlkZSArIDBdO1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAzICsgMV0gPSBzcmNbaSAqIHNyY1N0cmlkZSArIDFdO1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAzICsgMl0gPSBzcmNbaSAqIHNyY1N0cmlkZSArIDJdO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gcG9zaXRpb24gZGF0YSBpcyB0aWdodGx5IHBhY2tlZCBzbyB3ZSBjYW4gdXNlIGl0IGRpcmVjdGx5XG4gICAgICAgIHBvc2l0aW9ucyA9IG5ldyB0eXBlZEFycmF5VHlwZXNbcC50eXBlXShwLmJ1ZmZlciwgcC5vZmZzZXQsIHAuY291bnQgKiAzKTtcbiAgICB9XG5cbiAgICBjb25zdCBudW1WZXJ0aWNlcyA9IHAuY291bnQ7XG5cbiAgICAvLyBnZW5lcmF0ZSBpbmRpY2VzIGlmIG5lY2Vzc2FyeVxuICAgIGlmICghaW5kaWNlcykge1xuICAgICAgICBpbmRpY2VzID0gZ2VuZXJhdGVJbmRpY2VzKG51bVZlcnRpY2VzKTtcbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZSBub3JtYWxzXG4gICAgY29uc3Qgbm9ybWFsc1RlbXAgPSBjYWxjdWxhdGVOb3JtYWxzKHBvc2l0aW9ucywgaW5kaWNlcyk7XG4gICAgY29uc3Qgbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkobm9ybWFsc1RlbXAubGVuZ3RoKTtcbiAgICBub3JtYWxzLnNldChub3JtYWxzVGVtcCk7XG5cbiAgICBzb3VyY2VEZXNjW1NFTUFOVElDX05PUk1BTF0gPSB7XG4gICAgICAgIGJ1ZmZlcjogbm9ybWFscy5idWZmZXIsXG4gICAgICAgIHNpemU6IDEyLFxuICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgIHN0cmlkZTogMTIsXG4gICAgICAgIGNvdW50OiBudW1WZXJ0aWNlcyxcbiAgICAgICAgY29tcG9uZW50czogMyxcbiAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgfTtcbn07XG5cbmNvbnN0IGZsaXBUZXhDb29yZFZzID0gZnVuY3Rpb24gKHZlcnRleEJ1ZmZlcikge1xuICAgIGxldCBpLCBqO1xuXG4gICAgY29uc3QgZmxvYXRPZmZzZXRzID0gW107XG4gICAgY29uc3Qgc2hvcnRPZmZzZXRzID0gW107XG4gICAgY29uc3QgYnl0ZU9mZnNldHMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgaWYgKGVsZW1lbnQubmFtZSA9PT0gU0VNQU5USUNfVEVYQ09PUkQwIHx8XG4gICAgICAgICAgICBlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMSkge1xuICAgICAgICAgICAgc3dpdGNoIChlbGVtZW50LmRhdGFUeXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX0ZMT0FUMzI6XG4gICAgICAgICAgICAgICAgICAgIGZsb2F0T2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCAvIDQgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIC8gNCB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQxNjpcbiAgICAgICAgICAgICAgICAgICAgc2hvcnRPZmZzZXRzLnB1c2goeyBvZmZzZXQ6IGVsZW1lbnQub2Zmc2V0IC8gMiArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgLyAyIH0pO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFRZUEVfVUlOVDg6XG4gICAgICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXRzLnB1c2goeyBvZmZzZXQ6IGVsZW1lbnQub2Zmc2V0ICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBmbGlwID0gZnVuY3Rpb24gKG9mZnNldHMsIHR5cGUsIG9uZSkge1xuICAgICAgICBjb25zdCB0eXBlZEFycmF5ID0gbmV3IHR5cGUodmVydGV4QnVmZmVyLnN0b3JhZ2UpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2Zmc2V0cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gb2Zmc2V0c1tpXS5vZmZzZXQ7XG4gICAgICAgICAgICBjb25zdCBzdHJpZGUgPSBvZmZzZXRzW2ldLnN0cmlkZTtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCB2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7ICsraikge1xuICAgICAgICAgICAgICAgIHR5cGVkQXJyYXlbaW5kZXhdID0gb25lIC0gdHlwZWRBcnJheVtpbmRleF07XG4gICAgICAgICAgICAgICAgaW5kZXggKz0gc3RyaWRlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGlmIChmbG9hdE9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKGZsb2F0T2Zmc2V0cywgRmxvYXQzMkFycmF5LCAxLjApO1xuICAgIH1cbiAgICBpZiAoc2hvcnRPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChzaG9ydE9mZnNldHMsIFVpbnQxNkFycmF5LCA2NTUzNSk7XG4gICAgfVxuICAgIGlmIChieXRlT2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoYnl0ZU9mZnNldHMsIFVpbnQ4QXJyYXksIDI1NSk7XG4gICAgfVxufTtcblxuLy8gZ2l2ZW4gYSB0ZXh0dXJlLCBjbG9uZSBpdFxuLy8gTk9URTogQ1BVLXNpZGUgdGV4dHVyZSBkYXRhIHdpbGwgYmUgc2hhcmVkIGJ1dCBHUFUgbWVtb3J5IHdpbGwgYmUgZHVwbGljYXRlZFxuY29uc3QgY2xvbmVUZXh0dXJlID0gZnVuY3Rpb24gKHRleHR1cmUpIHtcbiAgICBjb25zdCBzaGFsbG93Q29weUxldmVscyA9IGZ1bmN0aW9uICh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBtaXAgPSAwOyBtaXAgPCB0ZXh0dXJlLl9sZXZlbHMubGVuZ3RoOyArK21pcCkge1xuICAgICAgICAgICAgbGV0IGxldmVsID0gW107XG4gICAgICAgICAgICBpZiAodGV4dHVyZS5jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyArK2ZhY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWwucHVzaCh0ZXh0dXJlLl9sZXZlbHNbbWlwXVtmYWNlXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXZlbCA9IHRleHR1cmUuX2xldmVsc1ttaXBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnB1c2gobGV2ZWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBUZXh0dXJlKHRleHR1cmUuZGV2aWNlLCB0ZXh0dXJlKTsgICAvLyBkdXBsaWNhdGUgdGV4dHVyZVxuICAgIHJlc3VsdC5fbGV2ZWxzID0gc2hhbGxvd0NvcHlMZXZlbHModGV4dHVyZSk7ICAgICAgICAgICAgLy8gc2hhbGxvdyBjb3B5IHRoZSBsZXZlbHMgc3RydWN0dXJlXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdpdmVuIGEgdGV4dHVyZSBhc3NldCwgY2xvbmUgaXRcbmNvbnN0IGNsb25lVGV4dHVyZUFzc2V0ID0gZnVuY3Rpb24gKHNyYykge1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBBc3NldChzcmMubmFtZSArICdfY2xvbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLmZpbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5kYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMub3B0aW9ucyk7XG4gICAgcmVzdWx0LmxvYWRlZCA9IHRydWU7XG4gICAgcmVzdWx0LnJlc291cmNlID0gY2xvbmVUZXh0dXJlKHNyYy5yZXNvdXJjZSk7XG4gICAgc3JjLnJlZ2lzdHJ5LmFkZChyZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbCA9IGZ1bmN0aW9uIChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKSB7XG4gICAgY29uc3QgcG9zaXRpb25EZXNjID0gc291cmNlRGVzY1tTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgaWYgKCFwb3NpdGlvbkRlc2MpIHtcbiAgICAgICAgLy8gaWdub3JlIG1lc2hlcyB3aXRob3V0IHBvc2l0aW9uc1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgbnVtVmVydGljZXMgPSBwb3NpdGlvbkRlc2MuY291bnQ7XG5cbiAgICAvLyBnZW5lcmF0ZSB2ZXJ0ZXhEZXNjIGVsZW1lbnRzXG4gICAgY29uc3QgdmVydGV4RGVzYyA9IFtdO1xuICAgIGZvciAoY29uc3Qgc2VtYW50aWMgaW4gc291cmNlRGVzYykge1xuICAgICAgICBpZiAoc291cmNlRGVzYy5oYXNPd25Qcm9wZXJ0eShzZW1hbnRpYykpIHtcbiAgICAgICAgICAgIHZlcnRleERlc2MucHVzaCh7XG4gICAgICAgICAgICAgICAgc2VtYW50aWM6IHNlbWFudGljLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IHNvdXJjZURlc2Nbc2VtYW50aWNdLmNvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgdHlwZTogc291cmNlRGVzY1tzZW1hbnRpY10udHlwZSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6ICEhc291cmNlRGVzY1tzZW1hbnRpY10ubm9ybWFsaXplXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIG9yZGVyIHZlcnRleERlc2MgdG8gbWF0Y2ggdGhlIHJlc3Qgb2YgdGhlIGVuZ2luZVxuICAgIGNvbnN0IGVsZW1lbnRPcmRlciA9IFtcbiAgICAgICAgU0VNQU5USUNfUE9TSVRJT04sXG4gICAgICAgIFNFTUFOVElDX05PUk1BTCxcbiAgICAgICAgU0VNQU5USUNfVEFOR0VOVCxcbiAgICAgICAgU0VNQU5USUNfQ09MT1IsXG4gICAgICAgIFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICAgICAgU0VNQU5USUNfQkxFTkRXRUlHSFQsXG4gICAgICAgIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICAgICAgU0VNQU5USUNfVEVYQ09PUkQxXG4gICAgXTtcblxuICAgIC8vIHNvcnQgdmVydGV4IGVsZW1lbnRzIGJ5IGVuZ2luZS1pZGVhbCBvcmRlclxuICAgIHZlcnRleERlc2Muc29ydChmdW5jdGlvbiAobGhzLCByaHMpIHtcbiAgICAgICAgY29uc3QgbGhzT3JkZXIgPSBlbGVtZW50T3JkZXIuaW5kZXhPZihsaHMuc2VtYW50aWMpO1xuICAgICAgICBjb25zdCByaHNPcmRlciA9IGVsZW1lbnRPcmRlci5pbmRleE9mKHJocy5zZW1hbnRpYyk7XG4gICAgICAgIHJldHVybiAobGhzT3JkZXIgPCByaHNPcmRlcikgPyAtMSA6IChyaHNPcmRlciA8IGxoc09yZGVyID8gMSA6IDApO1xuICAgIH0pO1xuXG4gICAgbGV0IGksIGosIGs7XG4gICAgbGV0IHNvdXJjZSwgdGFyZ2V0LCBzb3VyY2VPZmZzZXQ7XG5cbiAgICBjb25zdCB2ZXJ0ZXhGb3JtYXQgPSBuZXcgVmVydGV4Rm9ybWF0KGRldmljZSwgdmVydGV4RGVzYyk7XG5cbiAgICAvLyBjaGVjayB3aGV0aGVyIHNvdXJjZSBkYXRhIGlzIGNvcnJlY3RseSBpbnRlcmxlYXZlZFxuICAgIGxldCBpc0NvcnJlY3RseUludGVybGVhdmVkID0gdHJ1ZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4Rm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHRhcmdldCA9IHZlcnRleEZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgc291cmNlID0gc291cmNlRGVzY1t0YXJnZXQubmFtZV07XG4gICAgICAgIHNvdXJjZU9mZnNldCA9IHNvdXJjZS5vZmZzZXQgLSBwb3NpdGlvbkRlc2Mub2Zmc2V0O1xuICAgICAgICBpZiAoKHNvdXJjZS5idWZmZXIgIT09IHBvc2l0aW9uRGVzYy5idWZmZXIpIHx8XG4gICAgICAgICAgICAoc291cmNlLnN0cmlkZSAhPT0gdGFyZ2V0LnN0cmlkZSkgfHxcbiAgICAgICAgICAgIChzb3VyY2Uuc2l6ZSAhPT0gdGFyZ2V0LnNpemUpIHx8XG4gICAgICAgICAgICAoc291cmNlT2Zmc2V0ICE9PSB0YXJnZXQub2Zmc2V0KSkge1xuICAgICAgICAgICAgaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgdmVydGV4IGJ1ZmZlclxuICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIoZGV2aWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVydGV4Rm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmVydGljZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBCVUZGRVJfU1RBVElDKTtcblxuICAgIGNvbnN0IHZlcnRleERhdGEgPSB2ZXJ0ZXhCdWZmZXIubG9jaygpO1xuICAgIGNvbnN0IHRhcmdldEFycmF5ID0gbmV3IFVpbnQzMkFycmF5KHZlcnRleERhdGEpO1xuICAgIGxldCBzb3VyY2VBcnJheTtcblxuICAgIGlmIChpc0NvcnJlY3RseUludGVybGVhdmVkKSB7XG4gICAgICAgIC8vIGNvcHkgZGF0YVxuICAgICAgICBzb3VyY2VBcnJheSA9IG5ldyBVaW50MzJBcnJheShwb3NpdGlvbkRlc2MuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbkRlc2Mub2Zmc2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1WZXJ0aWNlcyAqIHZlcnRleEJ1ZmZlci5mb3JtYXQuc2l6ZSAvIDQpO1xuICAgICAgICB0YXJnZXRBcnJheS5zZXQoc291cmNlQXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCB0YXJnZXRTdHJpZGUsIHNvdXJjZVN0cmlkZTtcbiAgICAgICAgLy8gY29weSBkYXRhIGFuZCBpbnRlcmxlYXZlXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB0YXJnZXQgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgdGFyZ2V0U3RyaWRlID0gdGFyZ2V0LnN0cmlkZSAvIDQ7XG5cbiAgICAgICAgICAgIHNvdXJjZSA9IHNvdXJjZURlc2NbdGFyZ2V0Lm5hbWVdO1xuICAgICAgICAgICAgc291cmNlU3RyaWRlID0gc291cmNlLnN0cmlkZSAvIDQ7XG4gICAgICAgICAgICAvLyBlbnN1cmUgd2UgZG9uJ3QgZ28gYmV5b25kIHRoZSBlbmQgb2YgdGhlIGFycmF5YnVmZmVyIHdoZW4gZGVhbGluZyB3aXRoXG4gICAgICAgICAgICAvLyBpbnRlcmxhY2VkIHZlcnRleCBmb3JtYXRzXG4gICAgICAgICAgICBzb3VyY2VBcnJheSA9IG5ldyBVaW50MzJBcnJheShzb3VyY2UuYnVmZmVyLCBzb3VyY2Uub2Zmc2V0LCAoc291cmNlLmNvdW50IC0gMSkgKiBzb3VyY2VTdHJpZGUgKyAoc291cmNlLnNpemUgKyAzKSAvIDQpO1xuXG4gICAgICAgICAgICBsZXQgc3JjID0gMDtcbiAgICAgICAgICAgIGxldCBkc3QgPSB0YXJnZXQub2Zmc2V0IC8gNDtcbiAgICAgICAgICAgIGNvbnN0IGtlbmQgPSBNYXRoLmZsb29yKChzb3VyY2Uuc2l6ZSArIDMpIC8gNCk7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgbnVtVmVydGljZXM7ICsraikge1xuICAgICAgICAgICAgICAgIGZvciAoayA9IDA7IGsgPCBrZW5kOyArK2spIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0QXJyYXlbZHN0ICsga10gPSBzb3VyY2VBcnJheVtzcmMgKyBrXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3JjICs9IHNvdXJjZVN0cmlkZTtcbiAgICAgICAgICAgICAgICBkc3QgKz0gdGFyZ2V0U3RyaWRlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIGZsaXBUZXhDb29yZFZzKHZlcnRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgdmVydGV4QnVmZmVyLnVubG9jaygpO1xuXG4gICAgcmV0dXJuIHZlcnRleEJ1ZmZlcjtcbn07XG5cbmNvbnN0IGNyZWF0ZVZlcnRleEJ1ZmZlciA9IGZ1bmN0aW9uIChkZXZpY2UsIGF0dHJpYnV0ZXMsIGluZGljZXMsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0KSB7XG5cbiAgICAvLyBleHRyYWN0IGxpc3Qgb2YgYXR0cmlidXRlcyB0byB1c2VcbiAgICBjb25zdCB1c2VBdHRyaWJ1dGVzID0ge307XG4gICAgY29uc3QgYXR0cmliSWRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHJpYikgJiYgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAuaGFzT3duUHJvcGVydHkoYXR0cmliKSkge1xuICAgICAgICAgICAgdXNlQXR0cmlidXRlc1thdHRyaWJdID0gYXR0cmlidXRlc1thdHRyaWJdO1xuXG4gICAgICAgICAgICAvLyBidWlsZCB1bmlxdWUgaWQgZm9yIGVhY2ggYXR0cmlidXRlIGluIGZvcm1hdDogU2VtYW50aWM6YWNjZXNzb3JJbmRleFxuICAgICAgICAgICAgYXR0cmliSWRzLnB1c2goYXR0cmliICsgJzonICsgYXR0cmlidXRlc1thdHRyaWJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdW5pcXVlIGlkcyBhbmQgY3JlYXRlIHVuaXF1ZSB2ZXJ0ZXggYnVmZmVyIElEXG4gICAgYXR0cmliSWRzLnNvcnQoKTtcbiAgICBjb25zdCB2YktleSA9IGF0dHJpYklkcy5qb2luKCk7XG5cbiAgICAvLyByZXR1cm4gYWxyZWFkeSBjcmVhdGVkIHZlcnRleCBidWZmZXIgaWYgaWRlbnRpY2FsXG4gICAgbGV0IHZiID0gdmVydGV4QnVmZmVyRGljdFt2YktleV07XG4gICAgaWYgKCF2Yikge1xuICAgICAgICAvLyBidWlsZCB2ZXJ0ZXggYnVmZmVyIGZvcm1hdCBkZXNjIGFuZCBzb3VyY2VcbiAgICAgICAgY29uc3Qgc291cmNlRGVzYyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiB1c2VBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NvciA9IGFjY2Vzc29yc1thdHRyaWJ1dGVzW2F0dHJpYl1dO1xuICAgICAgICAgICAgY29uc3QgYWNjZXNzb3JEYXRhID0gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yLCBidWZmZXJWaWV3cyk7XG4gICAgICAgICAgICBjb25zdCBidWZmZXJWaWV3ID0gYnVmZmVyVmlld3NbYWNjZXNzb3IuYnVmZmVyVmlld107XG4gICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGdsdGZUb0VuZ2luZVNlbWFudGljTWFwW2F0dHJpYl07XG4gICAgICAgICAgICBjb25zdCBzaXplID0gZ2V0TnVtQ29tcG9uZW50cyhhY2Nlc3Nvci50eXBlKSAqIGdldENvbXBvbmVudFNpemVJbkJ5dGVzKGFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gYnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpID8gYnVmZmVyVmlldy5ieXRlU3RyaWRlIDogc2l6ZTtcbiAgICAgICAgICAgIHNvdXJjZURlc2Nbc2VtYW50aWNdID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYWNjZXNzb3JEYXRhLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgICAgIG9mZnNldDogYWNjZXNzb3JEYXRhLmJ5dGVPZmZzZXQsXG4gICAgICAgICAgICAgICAgc3RyaWRlOiBzdHJpZGUsXG4gICAgICAgICAgICAgICAgY291bnQ6IGFjY2Vzc29yLmNvdW50LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSksXG4gICAgICAgICAgICAgICAgdHlwZTogZ2V0Q29tcG9uZW50VHlwZShhY2Nlc3Nvci5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6IGFjY2Vzc29yLm5vcm1hbGl6ZWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBnZW5lcmF0ZSBub3JtYWxzIGlmIHRoZXkncmUgbWlzc2luZyAodGhpcyBzaG91bGQgcHJvYmFibHkgYmUgYSB1c2VyIG9wdGlvbilcbiAgICAgICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgICAgIGdlbmVyYXRlTm9ybWFscyhzb3VyY2VEZXNjLCBpbmRpY2VzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgc3RvcmUgaXQgaW4gdGhlIGRpY3Rpb25hcnlcbiAgICAgICAgdmIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbiAgICAgICAgdmVydGV4QnVmZmVyRGljdFt2YktleV0gPSB2YjtcbiAgICB9XG5cbiAgICByZXR1cm4gdmI7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXJEcmFjbyA9IGZ1bmN0aW9uIChkZXZpY2UsIG91dHB1dEdlb21ldHJ5LCBleHREcmFjbywgZGVjb2RlciwgZGVjb2Rlck1vZHVsZSwgaW5kaWNlcywgZmxpcFYpIHtcblxuICAgIGNvbnN0IG51bVBvaW50cyA9IG91dHB1dEdlb21ldHJ5Lm51bV9wb2ludHMoKTtcblxuICAgIC8vIGhlbHBlciBmdW5jdGlvbiB0byBkZWNvZGUgZGF0YSBzdHJlYW0gd2l0aCBpZCB0byBUeXBlZEFycmF5IG9mIGFwcHJvcHJpYXRlIHR5cGVcbiAgICBjb25zdCBleHRyYWN0RHJhY29BdHRyaWJ1dGVJbmZvID0gZnVuY3Rpb24gKHVuaXF1ZUlkLCBzZW1hbnRpYykge1xuICAgICAgICBjb25zdCBhdHRyaWJ1dGUgPSBkZWNvZGVyLkdldEF0dHJpYnV0ZUJ5VW5pcXVlSWQob3V0cHV0R2VvbWV0cnksIHVuaXF1ZUlkKTtcbiAgICAgICAgY29uc3QgbnVtVmFsdWVzID0gbnVtUG9pbnRzICogYXR0cmlidXRlLm51bV9jb21wb25lbnRzKCk7XG4gICAgICAgIGNvbnN0IGRyYWNvRm9ybWF0ID0gYXR0cmlidXRlLmRhdGFfdHlwZSgpO1xuICAgICAgICBsZXQgcHRyLCB2YWx1ZXMsIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBzdG9yYWdlVHlwZTtcblxuICAgICAgICAvLyBzdG9yYWdlIGZvcm1hdCBpcyBiYXNlZCBvbiBkcmFjbyBhdHRyaWJ1dGUgZGF0YSB0eXBlXG4gICAgICAgIHN3aXRjaCAoZHJhY29Gb3JtYXQpIHtcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX1VJTlQ4OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9VSU5UODtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRTaXplSW5CeXRlcyA9IDE7XG4gICAgICAgICAgICAgICAgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzKTtcbiAgICAgICAgICAgICAgICBkZWNvZGVyLkdldEF0dHJpYnV0ZURhdGFBcnJheUZvckFsbFBvaW50cyhvdXRwdXRHZW9tZXRyeSwgYXR0cmlidXRlLCBkZWNvZGVyTW9kdWxlLkRUX1VJTlQ4LCBudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcywgcHRyKTtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBuZXcgVWludDhBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVOC5idWZmZXIsIHB0ciwgbnVtVmFsdWVzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuRFRfVUlOVDE2OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9VSU5UMTY7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50U2l6ZUluQnl0ZXMgPSAyO1xuICAgICAgICAgICAgICAgIHB0ciA9IGRlY29kZXJNb2R1bGUuX21hbGxvYyhudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcyk7XG4gICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMob3V0cHV0R2VvbWV0cnksIGF0dHJpYnV0ZSwgZGVjb2Rlck1vZHVsZS5EVF9VSU5UMTYsIG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBwdHIpO1xuICAgICAgICAgICAgICAgIHZhbHVlcyA9IG5ldyBVaW50MTZBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMTYuYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX0ZMT0FUMzI6XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzID0gNDtcbiAgICAgICAgICAgICAgICBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MobnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMpO1xuICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0QXR0cmlidXRlRGF0YUFycmF5Rm9yQWxsUG9pbnRzKG91dHB1dEdlb21ldHJ5LCBhdHRyaWJ1dGUsIGRlY29kZXJNb2R1bGUuRFRfRkxPQVQzMiwgbnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMsIHB0cik7XG4gICAgICAgICAgICAgICAgdmFsdWVzID0gbmV3IEZsb2F0MzJBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBGMzIuYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGRlY29kZXJNb2R1bGUuX2ZyZWUocHRyKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWVzOiB2YWx1ZXMsXG4gICAgICAgICAgICBudW1Db21wb25lbnRzOiBhdHRyaWJ1dGUubnVtX2NvbXBvbmVudHMoKSxcbiAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzOiBjb21wb25lbnRTaXplSW5CeXRlcyxcbiAgICAgICAgICAgIHN0b3JhZ2VUeXBlOiBzdG9yYWdlVHlwZSxcblxuICAgICAgICAgICAgLy8gdGhlcmUgYXJlIGdsYiBmaWxlcyBhcm91bmQgd2hlcmUgOGJpdCBjb2xvcnMgYXJlIG1pc3Npbmcgbm9ybWFsaXplZCBmbGFnXG4gICAgICAgICAgICBub3JtYWxpemVkOiAoc2VtYW50aWMgPT09IFNFTUFOVElDX0NPTE9SICYmIHN0b3JhZ2VUeXBlID09PSBUWVBFX1VJTlQ4KSA/IHRydWUgOiBhdHRyaWJ1dGUubm9ybWFsaXplZCgpXG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIC8vIGJ1aWxkIHZlcnRleCBidWZmZXIgZm9ybWF0IGRlc2MgYW5kIHNvdXJjZVxuICAgIGNvbnN0IHNvdXJjZURlc2MgPSB7fTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzID0gZXh0RHJhY28uYXR0cmlidXRlcztcbiAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHJpYikgJiYgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAuaGFzT3duUHJvcGVydHkoYXR0cmliKSkge1xuICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFthdHRyaWJdO1xuICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlSW5mbyA9IGV4dHJhY3REcmFjb0F0dHJpYnV0ZUluZm8oYXR0cmlidXRlc1thdHRyaWJdLCBzZW1hbnRpYyk7XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBpbmZvIHdlJ2xsIG5lZWQgdG8gY29weSB0aGlzIGRhdGEgaW50byB0aGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGF0dHJpYnV0ZUluZm8ubnVtQ29tcG9uZW50cyAqIGF0dHJpYnV0ZUluZm8uY29tcG9uZW50U2l6ZUluQnl0ZXM7XG4gICAgICAgICAgICBzb3VyY2VEZXNjW3NlbWFudGljXSA9IHtcbiAgICAgICAgICAgICAgICB2YWx1ZXM6IGF0dHJpYnV0ZUluZm8udmFsdWVzLFxuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYXR0cmlidXRlSW5mby52YWx1ZXMuYnVmZmVyLFxuICAgICAgICAgICAgICAgIHNpemU6IHNpemUsXG4gICAgICAgICAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICAgICAgICAgIHN0cmlkZTogc2l6ZSxcbiAgICAgICAgICAgICAgICBjb3VudDogbnVtUG9pbnRzLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGF0dHJpYnV0ZUluZm8ubnVtQ29tcG9uZW50cyxcbiAgICAgICAgICAgICAgICB0eXBlOiBhdHRyaWJ1dGVJbmZvLnN0b3JhZ2VUeXBlLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZTogYXR0cmlidXRlSW5mby5ub3JtYWxpemVkXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFscyBpZiB0aGV5J3JlIG1pc3NpbmcgKHRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIGEgdXNlciBvcHRpb24pXG4gICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgZ2VuZXJhdGVOb3JtYWxzKHNvdXJjZURlc2MsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbn07XG5cbmNvbnN0IGNyZWF0ZVNraW4gPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmU2tpbiwgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsYlNraW5zKSB7XG4gICAgbGV0IGksIGosIGJpbmRNYXRyaXg7XG4gICAgY29uc3Qgam9pbnRzID0gZ2x0ZlNraW4uam9pbnRzO1xuICAgIGNvbnN0IG51bUpvaW50cyA9IGpvaW50cy5sZW5ndGg7XG4gICAgY29uc3QgaWJwID0gW107XG4gICAgaWYgKGdsdGZTa2luLmhhc093blByb3BlcnR5KCdpbnZlcnNlQmluZE1hdHJpY2VzJykpIHtcbiAgICAgICAgY29uc3QgaW52ZXJzZUJpbmRNYXRyaWNlcyA9IGdsdGZTa2luLmludmVyc2VCaW5kTWF0cmljZXM7XG4gICAgICAgIGNvbnN0IGlibURhdGEgPSBnZXRBY2Nlc3NvckRhdGEoYWNjZXNzb3JzW2ludmVyc2VCaW5kTWF0cmljZXNdLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IGlibVZhbHVlcyA9IFtdO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBudW1Kb2ludHM7IGkrKykge1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IDE2OyBqKyspIHtcbiAgICAgICAgICAgICAgICBpYm1WYWx1ZXNbal0gPSBpYm1EYXRhW2kgKiAxNiArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYmluZE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgICAgICBiaW5kTWF0cml4LnNldChpYm1WYWx1ZXMpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGJpbmRNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBib25lTmFtZXMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgYm9uZU5hbWVzW2ldID0gbm9kZXNbam9pbnRzW2ldXS5uYW1lO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZSBhIGNhY2hlIGtleSBmcm9tIGJvbmUgbmFtZXMgYW5kIHNlZSBpZiB3ZSBoYXZlIG1hdGNoaW5nIHNraW5cbiAgICBjb25zdCBrZXkgPSBib25lTmFtZXMuam9pbignIycpO1xuICAgIGxldCBza2luID0gZ2xiU2tpbnMuZ2V0KGtleSk7XG4gICAgaWYgKCFza2luKSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSBza2luIGFuZCBhZGQgaXQgdG8gdGhlIGNhY2hlXG4gICAgICAgIHNraW4gPSBuZXcgU2tpbihkZXZpY2UsIGlicCwgYm9uZU5hbWVzKTtcbiAgICAgICAgZ2xiU2tpbnMuc2V0KGtleSwgc2tpbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNraW47XG59O1xuXG5jb25zdCB0ZW1wTWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRlbXBWZWMgPSBuZXcgVmVjMygpO1xuXG5jb25zdCBjcmVhdGVNZXNoID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0Zk1lc2gsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgYXNzZXRPcHRpb25zKSB7XG4gICAgY29uc3QgbWVzaGVzID0gW107XG5cbiAgICBnbHRmTWVzaC5wcmltaXRpdmVzLmZvckVhY2goZnVuY3Rpb24gKHByaW1pdGl2ZSkge1xuXG4gICAgICAgIGxldCBwcmltaXRpdmVUeXBlLCB2ZXJ0ZXhCdWZmZXIsIG51bUluZGljZXM7XG4gICAgICAgIGxldCBpbmRpY2VzID0gbnVsbDtcbiAgICAgICAgbGV0IGNhblVzZU1vcnBoID0gdHJ1ZTtcblxuICAgICAgICAvLyB0cnkgYW5kIGdldCBkcmFjbyBjb21wcmVzc2VkIGRhdGEgZmlyc3RcbiAgICAgICAgaWYgKHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgnZXh0ZW5zaW9ucycpKSB7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb25zID0gcHJpbWl0aXZlLmV4dGVuc2lvbnM7XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb24nKSkge1xuXG4gICAgICAgICAgICAgICAgLy8gYWNjZXNzIERyYWNvRGVjb2Rlck1vZHVsZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRlY29kZXJNb2R1bGUgPSBkcmFjb0RlY29kZXJJbnN0YW5jZSB8fCBnZXRHbG9iYWxEcmFjb0RlY29kZXJNb2R1bGUoKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVjb2Rlck1vZHVsZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHREcmFjbyA9IGV4dGVuc2lvbnMuS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb247XG4gICAgICAgICAgICAgICAgICAgIGlmIChleHREcmFjby5oYXNPd25Qcm9wZXJ0eSgnYXR0cmlidXRlcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1aW50OEJ1ZmZlciA9IGJ1ZmZlclZpZXdzW2V4dERyYWNvLmJ1ZmZlclZpZXddO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IGRlY29kZXJNb2R1bGUuRGVjb2RlckJ1ZmZlcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyLkluaXQodWludDhCdWZmZXIsIHVpbnQ4QnVmZmVyLmxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlY29kZXIgPSBuZXcgZGVjb2Rlck1vZHVsZS5EZWNvZGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBnZW9tZXRyeVR5cGUgPSBkZWNvZGVyLkdldEVuY29kZWRHZW9tZXRyeVR5cGUoYnVmZmVyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG91dHB1dEdlb21ldHJ5LCBzdGF0dXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGdlb21ldHJ5VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5QT0lOVF9DTE9VRDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVHlwZSA9IFBSSU1JVElWRV9QT0lOVFM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dEdlb21ldHJ5ID0gbmV3IGRlY29kZXJNb2R1bGUuUG9pbnRDbG91ZCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMgPSBkZWNvZGVyLkRlY29kZUJ1ZmZlclRvUG9pbnRDbG91ZChidWZmZXIsIG91dHB1dEdlb21ldHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLlRSSUFOR1VMQVJfTUVTSDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVHlwZSA9IFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dEdlb21ldHJ5ID0gbmV3IGRlY29kZXJNb2R1bGUuTWVzaCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMgPSBkZWNvZGVyLkRlY29kZUJ1ZmZlclRvTWVzaChidWZmZXIsIG91dHB1dEdlb21ldHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLklOVkFMSURfR0VPTUVUUllfVFlQRTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzdGF0dXMgfHwgIXN0YXR1cy5vaygpIHx8IG91dHB1dEdlb21ldHJ5LnB0ciA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCdGYWlsZWQgdG8gZGVjb2RlIGRyYWNvIGNvbXByZXNzZWQgYXNzZXQ6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzdGF0dXMgPyBzdGF0dXMuZXJyb3JfbXNnKCkgOiAoJ01lc2ggYXNzZXQgLSBpbnZhbGlkIGRyYWNvIGNvbXByZXNzZWQgZ2VvbWV0cnkgdHlwZTogJyArIGdlb21ldHJ5VHlwZSkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluZGljZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG51bUZhY2VzID0gb3V0cHV0R2VvbWV0cnkubnVtX2ZhY2VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZ2VvbWV0cnlUeXBlID09PSBkZWNvZGVyTW9kdWxlLlRSSUFOR1VMQVJfTUVTSCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpdDMyID0gb3V0cHV0R2VvbWV0cnkubnVtX3BvaW50cygpID4gNjU1MzU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1JbmRpY2VzID0gbnVtRmFjZXMgKiAzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGFTaXplID0gbnVtSW5kaWNlcyAqIChiaXQzMiA/IDQgOiAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MoZGF0YVNpemUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJpdDMyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0VHJpYW5nbGVzVUludDMyQXJyYXkob3V0cHV0R2VvbWV0cnksIGRhdGFTaXplLCBwdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQzMkFycmF5KGRlY29kZXJNb2R1bGUuSEVBUFUzMi5idWZmZXIsIHB0ciwgbnVtSW5kaWNlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyLkdldFRyaWFuZ2xlc1VJbnQxNkFycmF5KG91dHB1dEdlb21ldHJ5LCBkYXRhU2l6ZSwgcHRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMTYuYnVmZmVyLCBwdHIsIG51bUluZGljZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5fZnJlZShwdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB2ZXJ0aWNlc1xuICAgICAgICAgICAgICAgICAgICAgICAgdmVydGV4QnVmZmVyID0gY3JlYXRlVmVydGV4QnVmZmVyRHJhY28oZGV2aWNlLCBvdXRwdXRHZW9tZXRyeSwgZXh0RHJhY28sIGRlY29kZXIsIGRlY29kZXJNb2R1bGUsIGluZGljZXMsIGZsaXBWKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYW4gdXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXJNb2R1bGUuZGVzdHJveShvdXRwdXRHZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLmRlc3Ryb3koZGVjb2Rlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLmRlc3Ryb3koYnVmZmVyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbW9ycGggc3RyZWFtcyBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCBkcmFjbyBjb21wcmVzc2lvbiwgZGlzYWJsZSBtb3JwaGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FuVXNlTW9ycGggPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0ZpbGUgY29udGFpbnMgZHJhY28gY29tcHJlc3NlZCBkYXRhLCBidXQgRHJhY29EZWNvZGVyTW9kdWxlIGlzIG5vdCBjb25maWd1cmVkLicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIG1lc2ggd2FzIG5vdCBjb25zdHJ1Y3RlZCBmcm9tIGRyYWNvIGRhdGEsIHVzZSB1bmNvbXByZXNzZWRcbiAgICAgICAgaWYgKCF2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIGluZGljZXMgPSBwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ2luZGljZXMnKSA/IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvcnNbcHJpbWl0aXZlLmluZGljZXNdLCBidWZmZXJWaWV3cywgdHJ1ZSkgOiBudWxsO1xuICAgICAgICAgICAgdmVydGV4QnVmZmVyID0gY3JlYXRlVmVydGV4QnVmZmVyKGRldmljZSwgcHJpbWl0aXZlLmF0dHJpYnV0ZXMsIGluZGljZXMsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0KTtcbiAgICAgICAgICAgIHByaW1pdGl2ZVR5cGUgPSBnZXRQcmltaXRpdmVUeXBlKHByaW1pdGl2ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbWVzaCA9IG51bGw7XG4gICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIGJ1aWxkIHRoZSBtZXNoXG4gICAgICAgICAgICBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICAgICAgICAgIG1lc2gudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0udHlwZSA9IHByaW1pdGl2ZVR5cGU7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5iYXNlID0gMDtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSAoaW5kaWNlcyAhPT0gbnVsbCk7XG5cbiAgICAgICAgICAgIC8vIGluZGV4IGJ1ZmZlclxuICAgICAgICAgICAgaWYgKGluZGljZXMgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXhGb3JtYXQ7XG4gICAgICAgICAgICAgICAgaWYgKGluZGljZXMgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDg7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpbmRpY2VzIGluc3RhbmNlb2YgVWludDE2QXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMTY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMzI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gMzJiaXQgaW5kZXggYnVmZmVyIGlzIHVzZWQgYnV0IG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhGb3JtYXQgPT09IElOREVYRk9STUFUX1VJTlQzMiAmJiAhZGV2aWNlLmV4dFVpbnRFbGVtZW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgICAgICBpZiAodmVydGV4QnVmZmVyLm51bVZlcnRpY2VzID4gMHhGRkZGKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0dsYiBmaWxlIGNvbnRhaW5zIDMyYml0IGluZGV4IGJ1ZmZlciBidXQgdGhlc2UgYXJlIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBkZXZpY2UgLSBpdCBtYXkgYmUgcmVuZGVyZWQgaW5jb3JyZWN0bHkuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29udmVydCB0byAxNmJpdFxuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShpbmRpY2VzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBpbmRleEJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcihkZXZpY2UsIGluZGV4Rm9ybWF0LCBpbmRpY2VzLmxlbmd0aCwgQlVGRkVSX1NUQVRJQywgaW5kaWNlcyk7XG4gICAgICAgICAgICAgICAgbWVzaC5pbmRleEJ1ZmZlclswXSA9IGluZGV4QnVmZmVyO1xuICAgICAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID0gaW5kaWNlcy5sZW5ndGg7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID0gdmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocHJpbWl0aXZlLmhhc093blByb3BlcnR5KFwiZXh0ZW5zaW9uc1wiKSAmJiBwcmltaXRpdmUuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eShcIktIUl9tYXRlcmlhbHNfdmFyaWFudHNcIikpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YXJpYW50cyA9IHByaW1pdGl2ZS5leHRlbnNpb25zLktIUl9tYXRlcmlhbHNfdmFyaWFudHM7XG4gICAgICAgICAgICAgICAgY29uc3QgdGVtcE1hcHBpbmcgPSB7fTtcbiAgICAgICAgICAgICAgICB2YXJpYW50cy5tYXBwaW5ncy5mb3JFYWNoKChtYXBwaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmcudmFyaWFudHMuZm9yRWFjaCgodmFyaWFudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcE1hcHBpbmdbdmFyaWFudF0gPSBtYXBwaW5nLm1hdGVyaWFsO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBtZXNoVmFyaWFudHNbbWVzaC5pZF0gPSB0ZW1wTWFwcGluZztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWVzaERlZmF1bHRNYXRlcmlhbHNbbWVzaC5pZF0gPSBwcmltaXRpdmUubWF0ZXJpYWw7XG5cbiAgICAgICAgICAgIGxldCBhY2Nlc3NvciA9IGFjY2Vzc29yc1twcmltaXRpdmUuYXR0cmlidXRlcy5QT1NJVElPTl07XG4gICAgICAgICAgICBtZXNoLmFhYmIgPSBnZXRBY2Nlc3NvckJvdW5kaW5nQm94KGFjY2Vzc29yKTtcblxuICAgICAgICAgICAgLy8gbW9ycGggdGFyZ2V0c1xuICAgICAgICAgICAgaWYgKGNhblVzZU1vcnBoICYmIHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgndGFyZ2V0cycpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0cyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgcHJpbWl0aXZlLnRhcmdldHMuZm9yRWFjaChmdW5jdGlvbiAodGFyZ2V0LCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0ge307XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldC5oYXNPd25Qcm9wZXJ0eSgnUE9TSVRJT04nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbdGFyZ2V0LlBPU0lUSU9OXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFQb3NpdGlvbnMgPSBnZXRBY2Nlc3NvckRhdGFGbG9hdDMyKGFjY2Vzc29yLCBidWZmZXJWaWV3cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhUG9zaXRpb25zVHlwZSA9IFRZUEVfRkxPQVQzMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuYWFiYiA9IGdldEFjY2Vzc29yQm91bmRpbmdCb3goYWNjZXNzb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldC5oYXNPd25Qcm9wZXJ0eSgnTk9STUFMJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2Vzc29yID0gYWNjZXNzb3JzW3RhcmdldC5OT1JNQUxdO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gTk9URTogdGhlIG1vcnBoIHRhcmdldHMgY2FuJ3QgY3VycmVudGx5IGFjY2VwdCBxdWFudGl6ZWQgbm9ybWFsc1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YU5vcm1hbHMgPSBnZXRBY2Nlc3NvckRhdGFGbG9hdDMyKGFjY2Vzc29yLCBidWZmZXJWaWV3cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhTm9ybWFsc1R5cGUgPSBUWVBFX0ZMT0FUMzI7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBuYW1lIGlmIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0Zk1lc2guaGFzT3duUHJvcGVydHkoJ2V4dHJhcycpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBnbHRmTWVzaC5leHRyYXMuaGFzT3duUHJvcGVydHkoJ3RhcmdldE5hbWVzJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubmFtZSA9IGdsdGZNZXNoLmV4dHJhcy50YXJnZXROYW1lc1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLm5hbWUgPSBpbmRleC50b1N0cmluZygxMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBkZWZhdWx0IHdlaWdodCBpZiBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZNZXNoLmhhc093blByb3BlcnR5KCd3ZWlnaHRzJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVmYXVsdFdlaWdodCA9IGdsdGZNZXNoLndlaWdodHNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5wcmVzZXJ2ZURhdGEgPSBhc3NldE9wdGlvbnMubW9ycGhQcmVzZXJ2ZURhdGE7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldHMucHVzaChuZXcgTW9ycGhUYXJnZXQob3B0aW9ucykpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgbWVzaC5tb3JwaCA9IG5ldyBNb3JwaCh0YXJnZXRzLCBkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbWVzaGVzLnB1c2gobWVzaCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWVzaGVzO1xufTtcblxuY29uc3QgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0gPSBmdW5jdGlvbiAoc291cmNlLCBtYXRlcmlhbCwgbWFwcykge1xuICAgIGxldCBtYXA7XG5cbiAgICBjb25zdCB0ZXhDb29yZCA9IHNvdXJjZS50ZXhDb29yZDtcbiAgICBpZiAodGV4Q29vcmQpIHtcbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW21hcHNbbWFwXSArICdNYXBVdiddID0gdGV4Q29vcmQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB6ZXJvcyA9IFswLCAwXTtcbiAgICBjb25zdCBvbmVzID0gWzEsIDFdO1xuICAgIGNvbnN0IHRleHR1cmVUcmFuc2Zvcm0gPSBzb3VyY2UuZXh0ZW5zaW9ucz8uS0hSX3RleHR1cmVfdHJhbnNmb3JtO1xuICAgIGlmICh0ZXh0dXJlVHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IHRleHR1cmVUcmFuc2Zvcm0ub2Zmc2V0IHx8IHplcm9zO1xuICAgICAgICBjb25zdCBzY2FsZSA9IHRleHR1cmVUcmFuc2Zvcm0uc2NhbGUgfHwgb25lcztcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSB0ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uID8gKC10ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uICogbWF0aC5SQURfVE9fREVHKSA6IDA7XG5cbiAgICAgICAgY29uc3QgdGlsaW5nVmVjID0gbmV3IFZlYzIoc2NhbGVbMF0sIHNjYWxlWzFdKTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0VmVjID0gbmV3IFZlYzIob2Zmc2V0WzBdLCAxLjAgLSBzY2FsZVsxXSAtIG9mZnNldFsxXSk7XG5cbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBUaWxpbmdgXSA9IHRpbGluZ1ZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBPZmZzZXRgXSA9IG9mZnNldFZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBSb3RhdGlvbmBdID0gcm90YXRpb247XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBsZXQgY29sb3IsIHRleHR1cmU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2RpZmZ1c2VGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuZGlmZnVzZUZhY3RvcjtcbiAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gY29sb3JbM107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZGlmZnVzZVRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBkaWZmdXNlVGV4dHVyZSA9IGRhdGEuZGlmZnVzZVRleHR1cmU7XG4gICAgICAgIHRleHR1cmUgPSB0ZXh0dXJlc1tkaWZmdXNlVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IHRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkaWZmdXNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZGlmZnVzZScsICdvcGFjaXR5J10pO1xuICAgIH1cbiAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3MgPSBmYWxzZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZ2xvc3NpbmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoaW5pbmVzcyA9IDEwMCAqIGRhdGEuZ2xvc3NpbmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zaGluaW5lc3MgPSAxMDA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZSA9IGRhdGEuc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJFbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSBtYXRlcmlhbC5nbG9zc01hcCA9IHRleHR1cmVzW3NwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgbWF0ZXJpYWwuZ2xvc3NNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKHNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2dsb3NzJywgJ21ldGFsbmVzcyddKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25DbGVhckNvYXQgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdEZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdCA9IGRhdGEuY2xlYXJjb2F0RmFjdG9yICogMC4yNTsgLy8gVE9ETzogcmVtb3ZlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciByZXBsaWNhdGluZyBnbFRGIGNsZWFyLWNvYXQgdmlzdWFsc1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdCA9IDA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgY2xlYXJjb2F0VGV4dHVyZSA9IGRhdGEuY2xlYXJjb2F0VGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0TWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0VGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdE1hcENoYW5uZWwgPSAncic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0VGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0J10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NpbmVzcyA9IGRhdGEuY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzaW5lc3MgPSAwO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUgPSBkYXRhLmNsZWFyY29hdFJvdWdobmVzc1RleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwQ2hhbm5lbCA9ICdnJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXRHbG9zcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdE5vcm1hbFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXROb3JtYWxUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXROb3JtYWxUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXROb3JtYWxNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXROb3JtYWxUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXROb3JtYWxUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXROb3JtYWwnXSk7XG5cbiAgICAgICAgaWYgKGNsZWFyY29hdE5vcm1hbFRleHR1cmUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEJ1bXBpbmVzcyA9IGNsZWFyY29hdE5vcm1hbFRleHR1cmUuc2NhbGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjbGVhckNvYXRHbG9zc0NodW5rID0gLyogZ2xzbCAqL2BcbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgIHVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfY2xlYXJDb2F0R2xvc3NpbmVzcztcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICB2b2lkIGdldENsZWFyQ29hdEdsb3NzaW5lc3MoKSB7XG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgPSAxLjA7XG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyAqPSBtYXRlcmlhbF9jbGVhckNvYXRHbG9zc2luZXNzO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgKj0gdGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykuJENIO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyAqPSBzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKTtcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAgICAgY2NHbG9zc2luZXNzID0gMS4wIC0gY2NHbG9zc2luZXNzO1xuICAgICAgICBcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyArPSAwLjAwMDAwMDE7XG4gICAgICAgIH1cbiAgICAgICAgYDtcbiAgICBtYXRlcmlhbC5jaHVua3MuY2xlYXJDb2F0R2xvc3NQUyA9IGNsZWFyQ29hdEdsb3NzQ2h1bms7XG59O1xuXG5jb25zdCBleHRlbnNpb25VbmxpdCA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC51c2VMaWdodGluZyA9IGZhbHNlO1xuXG4gICAgLy8gY29weSBkaWZmdXNlIGludG8gZW1pc3NpdmVcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZS5jb3B5KG1hdGVyaWFsLmRpZmZ1c2UpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IG1hdGVyaWFsLmRpZmZ1c2VUaW50O1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwID0gbWF0ZXJpYWwuZGlmZnVzZU1hcDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFV2ID0gbWF0ZXJpYWwuZGlmZnVzZU1hcFV2O1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwVGlsaW5nLmNvcHkobWF0ZXJpYWwuZGlmZnVzZU1hcFRpbGluZyk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBPZmZzZXQuY29weShtYXRlcmlhbC5kaWZmdXNlTWFwT2Zmc2V0KTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFJvdGF0aW9uID0gbWF0ZXJpYWwuZGlmZnVzZU1hcFJvdGF0aW9uO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwQ2hhbm5lbCA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVmVydGV4Q29sb3IgPSBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3I7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVWZXJ0ZXhDb2xvckNoYW5uZWwgPSBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsO1xuXG4gICAgLy8gYmxhbmsgZGlmZnVzZVxuICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDAsIDAsIDApO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VUaW50ID0gZmFsc2U7XG4gICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IG51bGw7XG4gICAgbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yID0gZmFsc2U7XG59O1xuXG5jb25zdCBleHRlbnNpb25TcGVjdWxhciA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3NTcGVjdWxhckNvbG9yID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJDb2xvclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhckVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcCA9IHRleHR1cmVzW2RhdGEuc3BlY3VsYXJDb2xvclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcENoYW5uZWwgPSAncmdiJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNwZWN1bGFyQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydzcGVjdWxhciddKTtcblxuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJDb2xvckZhY3RvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5zcGVjdWxhckNvbG9yRmFjdG9yO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgIH1cblxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyaXR5RmFjdG9yID0gZGF0YS5zcGVjdWxhckZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3RvciA9IDE7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3Rvck1hcENoYW5uZWwgPSAnYSc7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyaXR5RmFjdG9yTWFwID0gdGV4dHVyZXNbZGF0YS5zcGVjdWxhclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNwZWN1bGFyVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc3BlY3VsYXJpdHlGYWN0b3InXSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uSW9yID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpb3InKSkge1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uSW5kZXggPSAxLjAgLyBkYXRhLmlvcjtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25UcmFuc21pc3Npb24gPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9STUFMO1xuICAgIG1hdGVyaWFsLnVzZUR5bmFtaWNSZWZyYWN0aW9uID0gdHJ1ZTtcblxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0cmFuc21pc3Npb25GYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uID0gZGF0YS50cmFuc21pc3Npb25GYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0cmFuc21pc3Npb25UZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbk1hcENoYW5uZWwgPSAncic7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25NYXAgPSB0ZXh0dXJlc1tkYXRhLnRyYW5zbWlzc2lvblRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnRyYW5zbWlzc2lvblRleHR1cmUsIG1hdGVyaWFsLCBbJ3JlZnJhY3Rpb24nXSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uU2hlZW4gPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwudXNlU2hlZW4gPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlbkNvbG9yRmFjdG9yJykpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSBkYXRhLnNoZWVuQ29sb3JGYWN0b3I7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbi5zZXQoMSwgMSwgMSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlbkNvbG9yVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuTWFwID0gdGV4dHVyZXNbZGF0YS5zaGVlbkNvbG9yVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuRW5jb2RpbmcgPSAnc3JnYic7XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc2hlZW5Db2xvclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NoZWVuJ10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Sb3VnaG5lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzaW5lc3MgPSBkYXRhLnNoZWVuUm91Z2huZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NpbmVzcyA9IDAuMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NpbmVzc01hcCA9IHRleHR1cmVzW2RhdGEuc2hlZW5Sb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zc2luZXNzTWFwQ2hhbm5lbCA9ICdhJztcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zaGVlblJvdWdobmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ3NoZWVuR2xvc3NpbmVzcyddKTtcbiAgICB9XG5cbiAgICBjb25zdCBzaGVlbkdsb3NzQ2h1bmsgPSBgXG4gICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgdW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9zaGVlbkdsb3NzaW5lc3M7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgIHVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfc2hlZW5HbG9zc2luZXNzTWFwO1xuICAgICNlbmRpZlxuXG4gICAgdm9pZCBnZXRTaGVlbkdsb3NzaW5lc3MoKSB7XG4gICAgICAgIGZsb2F0IHNoZWVuR2xvc3NpbmVzcyA9IDEuMDtcblxuICAgICAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICAgICAgc2hlZW5HbG9zc2luZXNzICo9IG1hdGVyaWFsX3NoZWVuR2xvc3NpbmVzcztcbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICAgICAgc2hlZW5HbG9zc2luZXNzICo9IHRleHR1cmUyREJpYXModGV4dHVyZV9zaGVlbkdsb3NzaW5lc3NNYXAsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgI2lmZGVmIE1BUFZFUlRFWFxuICAgICAgICBzaGVlbkdsb3NzaW5lc3MgKj0gc2F0dXJhdGUodlZlcnRleENvbG9yLiRWQyk7XG4gICAgICAgICNlbmRpZlxuXG4gICAgICAgIHNoZWVuR2xvc3NpbmVzcyA9IDEuMCAtIHNoZWVuR2xvc3NpbmVzcztcbiAgICAgICAgc2hlZW5HbG9zc2luZXNzICs9IDAuMDAwMDAwMTtcbiAgICAgICAgc0dsb3NzaW5lc3MgPSBzaGVlbkdsb3NzaW5lc3M7XG4gICAgfVxuICAgIGA7XG4gICAgbWF0ZXJpYWwuY2h1bmtzLnNoZWVuR2xvc3NQUyA9IHNoZWVuR2xvc3NDaHVuaztcbn07XG5cbmNvbnN0IGV4dGVuc2lvblZvbHVtZSA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgbWF0ZXJpYWwudXNlRHluYW1pY1JlZnJhY3Rpb24gPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0aGlja25lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3MgPSBkYXRhLnRoaWNrbmVzc0ZhY3RvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnRoaWNrbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ3RoaWNrbmVzcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2F0dGVudWF0aW9uRGlzdGFuY2UnKSkge1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbkRpc3RhbmNlID0gZGF0YS5hdHRlbnVhdGlvbkRpc3RhbmNlO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXR0ZW51YXRpb25Db2xvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5hdHRlbnVhdGlvbkNvbG9yO1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uRW1pc3NpdmVTdHJlbmd0aCA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVTdHJlbmd0aCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlSW50ZW5zaXR5ID0gZGF0YS5lbWlzc2l2ZVN0cmVuZ3RoO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklyaWRlc2NlbmNlID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZUlyaWRlc2NlbmNlID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZSA9IGRhdGEuaXJpZGVzY2VuY2VGYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZU1hcENoYW5uZWwgPSAncic7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2UnXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlSW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXggPSBkYXRhLmlyaWRlc2NlbmNlSW9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNaW4gPSBkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzTWF4aW11bScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4ID0gZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW07XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01hcENoYW5uZWwgPSAnZyc7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2VUaGlja25lc3MnXSk7XG4gICAgfVxufTtcblxuY29uc3QgY3JlYXRlTWF0ZXJpYWwgPSBmdW5jdGlvbiAoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpIHtcbiAgICAvLyBUT0RPOiBpbnRlZ3JhdGUgdGhlc2Ugc2hhZGVyIGNodW5rcyBpbnRvIHRoZSBuYXRpdmUgZW5naW5lXG4gICAgY29uc3QgZ2xvc3NDaHVuayA9IGBcbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgIHVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfc2hpbmluZXNzO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgIHZvaWQgZ2V0R2xvc3NpbmVzcygpIHtcbiAgICAgICAgICAgIGRHbG9zc2luZXNzID0gMS4wO1xuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgICAgICBkR2xvc3NpbmVzcyAqPSBtYXRlcmlhbF9zaGluaW5lc3M7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICAgICAgICAgIGRHbG9zc2luZXNzICo9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgICAgICAgICBkR2xvc3NpbmVzcyAqPSBzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKTtcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAgICAgZEdsb3NzaW5lc3MgPSAxLjAgLSBkR2xvc3NpbmVzcztcbiAgICAgICAgXG4gICAgICAgICAgICBkR2xvc3NpbmVzcyArPSAwLjAwMDAwMDE7XG4gICAgICAgIH1cbiAgICAgICAgYDtcblxuXG4gICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuXG4gICAgLy8gZ2xURiBkb2Vzbid0IGRlZmluZSBob3cgdG8gb2NjbHVkZSBzcGVjdWxhclxuICAgIG1hdGVyaWFsLm9jY2x1ZGVTcGVjdWxhciA9IFNQRUNPQ0NfQU87XG5cbiAgICBtYXRlcmlhbC5kaWZmdXNlVGludCA9IHRydWU7XG4gICAgbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yID0gdHJ1ZTtcblxuICAgIG1hdGVyaWFsLnNwZWN1bGFyVGludCA9IHRydWU7XG4gICAgbWF0ZXJpYWwuc3BlY3VsYXJWZXJ0ZXhDb2xvciA9IHRydWU7XG5cbiAgICBtYXRlcmlhbC5jaHVua3MuQVBJVmVyc2lvbiA9IENIVU5LQVBJXzFfNTg7XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCduYW1lJykpIHtcbiAgICAgICAgbWF0ZXJpYWwubmFtZSA9IGdsdGZNYXRlcmlhbC5uYW1lO1xuICAgIH1cblxuICAgIGxldCBjb2xvciwgdGV4dHVyZTtcbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdwYnJNZXRhbGxpY1JvdWdobmVzcycpKSB7XG4gICAgICAgIGNvbnN0IHBickRhdGEgPSBnbHRmTWF0ZXJpYWwucGJyTWV0YWxsaWNSb3VnaG5lc3M7XG5cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ2Jhc2VDb2xvckZhY3RvcicpKSB7XG4gICAgICAgICAgICBjb2xvciA9IHBickRhdGEuYmFzZUNvbG9yRmFjdG9yO1xuICAgICAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSBjb2xvclszXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDEsIDEsIDEpO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ2Jhc2VDb2xvclRleHR1cmUnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUNvbG9yVGV4dHVyZSA9IHBickRhdGEuYmFzZUNvbG9yVGV4dHVyZTtcbiAgICAgICAgICAgIHRleHR1cmUgPSB0ZXh0dXJlc1tiYXNlQ29sb3JUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IHRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcCA9IHRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oYmFzZUNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZGlmZnVzZScsICdvcGFjaXR5J10pO1xuICAgICAgICB9XG4gICAgICAgIG1hdGVyaWFsLnVzZU1ldGFsbmVzcyA9IHRydWU7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ21ldGFsbGljRmFjdG9yJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzcyA9IHBickRhdGEubWV0YWxsaWNGYWN0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3MgPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdyb3VnaG5lc3NGYWN0b3InKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2hpbmluZXNzID0gMTAwICogcGJyRGF0YS5yb3VnaG5lc3NGYWN0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zaGluaW5lc3MgPSAxMDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ21ldGFsbGljUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUgPSBwYnJEYXRhLm1ldGFsbGljUm91Z2huZXNzVGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcCA9IG1hdGVyaWFsLmdsb3NzTWFwID0gdGV4dHVyZXNbbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcENoYW5uZWwgPSAnYic7XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zc01hcENoYW5uZWwgPSAnZyc7XG5cbiAgICAgICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG1ldGFsbGljUm91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZ2xvc3MnLCAnbWV0YWxuZXNzJ10pO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLmdsb3NzUFMgPSBnbG9zc0NodW5rO1xuICAgIH1cblxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ25vcm1hbFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBub3JtYWxUZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLm5vcm1hbFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLm5vcm1hbE1hcCA9IHRleHR1cmVzW25vcm1hbFRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG5vcm1hbFRleHR1cmUsIG1hdGVyaWFsLCBbJ25vcm1hbCddKTtcblxuICAgICAgICBpZiAobm9ybWFsVGV4dHVyZS5oYXNPd25Qcm9wZXJ0eSgnc2NhbGUnKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuYnVtcGluZXNzID0gbm9ybWFsVGV4dHVyZS5zY2FsZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdvY2NsdXNpb25UZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgb2NjbHVzaW9uVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5vY2NsdXNpb25UZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5hb01hcCA9IHRleHR1cmVzW29jY2x1c2lvblRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5hb01hcENoYW5uZWwgPSAncic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0ob2NjbHVzaW9uVGV4dHVyZSwgbWF0ZXJpYWwsIFsnYW8nXSk7XG4gICAgICAgIC8vIFRPRE86IHN1cHBvcnQgJ3N0cmVuZ3RoJ1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdlbWlzc2l2ZUZhY3RvcicpKSB7XG4gICAgICAgIGNvbG9yID0gZ2x0Zk1hdGVyaWFsLmVtaXNzaXZlRmFjdG9yO1xuICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmUuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldCgwLCAwLCAwKTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gZmFsc2U7XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGVtaXNzaXZlVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5lbWlzc2l2ZVRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwID0gdGV4dHVyZXNbZW1pc3NpdmVUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShlbWlzc2l2ZVRleHR1cmUsIG1hdGVyaWFsLCBbJ2VtaXNzaXZlJ10pO1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdhbHBoYU1vZGUnKSkge1xuICAgICAgICBzd2l0Y2ggKGdsdGZNYXRlcmlhbC5hbHBoYU1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ01BU0snOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnYWxwaGFDdXRvZmYnKSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbHBoYVRlc3QgPSBnbHRmTWF0ZXJpYWwuYWxwaGFDdXRvZmY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuYWxwaGFUZXN0ID0gMC41O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ0JMRU5EJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgICAgICAgICAgICAgLy8gbm90ZTogYnkgZGVmYXVsdCBkb24ndCB3cml0ZSBkZXB0aCBvbiBzZW1pdHJhbnNwYXJlbnQgbWF0ZXJpYWxzXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuZGVwdGhXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGNhc2UgJ09QQVFVRSc6XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2RvdWJsZVNpZGVkJykpIHtcbiAgICAgICAgbWF0ZXJpYWwudHdvU2lkZWRMaWdodGluZyA9IGdsdGZNYXRlcmlhbC5kb3VibGVTaWRlZDtcbiAgICAgICAgbWF0ZXJpYWwuY3VsbCA9IGdsdGZNYXRlcmlhbC5kb3VibGVTaWRlZCA/IENVTExGQUNFX05PTkUgOiBDVUxMRkFDRV9CQUNLO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnR3b1NpZGVkTGlnaHRpbmcgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwuY3VsbCA9IENVTExGQUNFX0JBQ0s7XG4gICAgfVxuXG4gICAgLy8gUHJvdmlkZSBsaXN0IG9mIHN1cHBvcnRlZCBleHRlbnNpb25zIGFuZCB0aGVpciBmdW5jdGlvbnNcbiAgICBjb25zdCBleHRlbnNpb25zID0ge1xuICAgICAgICBcIktIUl9tYXRlcmlhbHNfY2xlYXJjb2F0XCI6IGV4dGVuc2lvbkNsZWFyQ29hdCxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2VtaXNzaXZlX3N0cmVuZ3RoXCI6IGV4dGVuc2lvbkVtaXNzaXZlU3RyZW5ndGgsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19pb3JcIjogZXh0ZW5zaW9uSW9yLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfaXJpZGVzY2VuY2VcIjogZXh0ZW5zaW9uSXJpZGVzY2VuY2UsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19wYnJTcGVjdWxhckdsb3NzaW5lc3NcIjogZXh0ZW5zaW9uUGJyU3BlY0dsb3NzaW5lc3MsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19zaGVlblwiOiBleHRlbnNpb25TaGVlbixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3NwZWN1bGFyXCI6IGV4dGVuc2lvblNwZWN1bGFyLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfdHJhbnNtaXNzaW9uXCI6IGV4dGVuc2lvblRyYW5zbWlzc2lvbixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3VubGl0XCI6IGV4dGVuc2lvblVubGl0LFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfdm9sdW1lXCI6IGV4dGVuc2lvblZvbHVtZVxuICAgIH07XG5cbiAgICAvLyBIYW5kbGUgZXh0ZW5zaW9uc1xuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBnbHRmTWF0ZXJpYWwuZXh0ZW5zaW9ucykge1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uRnVuYyA9IGV4dGVuc2lvbnNba2V5XTtcbiAgICAgICAgICAgIGlmIChleHRlbnNpb25GdW5jICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBleHRlbnNpb25GdW5jKGdsdGZNYXRlcmlhbC5leHRlbnNpb25zW2tleV0sIG1hdGVyaWFsLCB0ZXh0dXJlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtYXRlcmlhbC51cGRhdGUoKTtcblxuICAgIHJldHVybiBtYXRlcmlhbDtcbn07XG5cbi8vIGNyZWF0ZSB0aGUgYW5pbSBzdHJ1Y3R1cmVcbmNvbnN0IGNyZWF0ZUFuaW1hdGlvbiA9IGZ1bmN0aW9uIChnbHRmQW5pbWF0aW9uLCBhbmltYXRpb25JbmRleCwgZ2x0ZkFjY2Vzc29ycywgYnVmZmVyVmlld3MsIG5vZGVzLCBtZXNoZXMpIHtcblxuICAgIC8vIGNyZWF0ZSBhbmltYXRpb24gZGF0YSBibG9jayBmb3IgdGhlIGFjY2Vzc29yXG4gICAgY29uc3QgY3JlYXRlQW5pbURhdGEgPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yKSB7XG4gICAgICAgIHJldHVybiBuZXcgQW5pbURhdGEoZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSksIGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykpO1xuICAgIH07XG5cbiAgICBjb25zdCBpbnRlcnBNYXAgPSB7XG4gICAgICAgICdTVEVQJzogSU5URVJQT0xBVElPTl9TVEVQLFxuICAgICAgICAnTElORUFSJzogSU5URVJQT0xBVElPTl9MSU5FQVIsXG4gICAgICAgICdDVUJJQ1NQTElORSc6IElOVEVSUE9MQVRJT05fQ1VCSUNcbiAgICB9O1xuXG4gICAgLy8gSW5wdXQgYW5kIG91dHB1dCBtYXBzIHJlZmVyZW5jZSBkYXRhIGJ5IHNhbXBsZXIgaW5wdXQvb3V0cHV0IGtleS5cbiAgICBjb25zdCBpbnB1dE1hcCA9IHsgfTtcbiAgICBjb25zdCBvdXRwdXRNYXAgPSB7IH07XG4gICAgLy8gVGhlIGN1cnZlIG1hcCBzdG9yZXMgdGVtcG9yYXJ5IGN1cnZlIGRhdGEgYnkgc2FtcGxlciBpbmRleC4gRWFjaCBjdXJ2ZXMgaW5wdXQvb3V0cHV0IHZhbHVlIHdpbGwgYmUgcmVzb2x2ZWQgdG8gYW4gaW5wdXRzL291dHB1dHMgYXJyYXkgaW5kZXggYWZ0ZXIgYWxsIHNhbXBsZXJzIGhhdmUgYmVlbiBwcm9jZXNzZWQuXG4gICAgLy8gQ3VydmVzIGFuZCBvdXRwdXRzIHRoYXQgYXJlIGRlbGV0ZWQgZnJvbSB0aGVpciBtYXBzIHdpbGwgbm90IGJlIGluY2x1ZGVkIGluIHRoZSBmaW5hbCBBbmltVHJhY2tcbiAgICBjb25zdCBjdXJ2ZU1hcCA9IHsgfTtcbiAgICBsZXQgb3V0cHV0Q291bnRlciA9IDE7XG5cbiAgICBsZXQgaTtcblxuICAgIC8vIGNvbnZlcnQgc2FtcGxlcnNcbiAgICBmb3IgKGkgPSAwOyBpIDwgZ2x0ZkFuaW1hdGlvbi5zYW1wbGVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBzYW1wbGVyID0gZ2x0ZkFuaW1hdGlvbi5zYW1wbGVyc1tpXTtcblxuICAgICAgICAvLyBnZXQgaW5wdXQgZGF0YVxuICAgICAgICBpZiAoIWlucHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIuaW5wdXQpKSB7XG4gICAgICAgICAgICBpbnB1dE1hcFtzYW1wbGVyLmlucHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5pbnB1dF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG91dHB1dCBkYXRhXG4gICAgICAgIGlmICghb3V0cHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIub3V0cHV0KSkge1xuICAgICAgICAgICAgb3V0cHV0TWFwW3NhbXBsZXIub3V0cHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5vdXRwdXRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGludGVycG9sYXRpb24gPVxuICAgICAgICAgICAgc2FtcGxlci5oYXNPd25Qcm9wZXJ0eSgnaW50ZXJwb2xhdGlvbicpICYmXG4gICAgICAgICAgICBpbnRlcnBNYXAuaGFzT3duUHJvcGVydHkoc2FtcGxlci5pbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgaW50ZXJwTWFwW3NhbXBsZXIuaW50ZXJwb2xhdGlvbl0gOiBJTlRFUlBPTEFUSU9OX0xJTkVBUjtcblxuICAgICAgICAvLyBjcmVhdGUgY3VydmVcbiAgICAgICAgY29uc3QgY3VydmUgPSB7XG4gICAgICAgICAgICBwYXRoczogW10sXG4gICAgICAgICAgICBpbnB1dDogc2FtcGxlci5pbnB1dCxcbiAgICAgICAgICAgIG91dHB1dDogc2FtcGxlci5vdXRwdXQsXG4gICAgICAgICAgICBpbnRlcnBvbGF0aW9uOiBpbnRlcnBvbGF0aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgY3VydmVNYXBbaV0gPSBjdXJ2ZTtcbiAgICB9XG5cbiAgICBjb25zdCBxdWF0QXJyYXlzID0gW107XG5cbiAgICBjb25zdCB0cmFuc2Zvcm1TY2hlbWEgPSB7XG4gICAgICAgICd0cmFuc2xhdGlvbic6ICdsb2NhbFBvc2l0aW9uJyxcbiAgICAgICAgJ3JvdGF0aW9uJzogJ2xvY2FsUm90YXRpb24nLFxuICAgICAgICAnc2NhbGUnOiAnbG9jYWxTY2FsZSdcbiAgICB9O1xuXG4gICAgY29uc3QgY29uc3RydWN0Tm9kZVBhdGggPSAobm9kZSkgPT4ge1xuICAgICAgICBjb25zdCBwYXRoID0gW107XG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBwYXRoLnVuc2hpZnQobm9kZS5uYW1lKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnBhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICB9O1xuXG4gICAgY29uc3QgcmV0cmlldmVXZWlnaHROYW1lID0gKG5vZGVOYW1lLCB3ZWlnaHRJbmRleCkgPT4ge1xuICAgICAgICBpZiAoIW1lc2hlcykgcmV0dXJuIHdlaWdodEluZGV4O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hlc1tpXTtcbiAgICAgICAgICAgIGlmIChtZXNoLm5hbWUgPT09IG5vZGVOYW1lICYmIG1lc2guaGFzT3duUHJvcGVydHkoJ2V4dHJhcycpICYmIG1lc2guZXh0cmFzLmhhc093blByb3BlcnR5KCd0YXJnZXROYW1lcycpICYmIG1lc2guZXh0cmFzLnRhcmdldE5hbWVzW3dlaWdodEluZGV4XSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBgbmFtZS4ke21lc2guZXh0cmFzLnRhcmdldE5hbWVzW3dlaWdodEluZGV4XX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB3ZWlnaHRJbmRleDtcbiAgICB9O1xuXG4gICAgLy8gQWxsIG1vcnBoIHRhcmdldHMgYXJlIGluY2x1ZGVkIGluIGEgc2luZ2xlIGNoYW5uZWwgb2YgdGhlIGFuaW1hdGlvbiwgd2l0aCBhbGwgdGFyZ2V0cyBvdXRwdXQgZGF0YSBpbnRlcmxlYXZlZCB3aXRoIGVhY2ggb3RoZXIuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzcGxpdHMgZWFjaCBtb3JwaCB0YXJnZXQgb3V0IGludG8gaXQgYSBjdXJ2ZSB3aXRoIGl0cyBvd24gb3V0cHV0IGRhdGEsIGFsbG93aW5nIHVzIHRvIGFuaW1hdGUgZWFjaCBtb3JwaCB0YXJnZXQgaW5kZXBlbmRlbnRseSBieSBuYW1lLlxuICAgIGNvbnN0IGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzID0gKGN1cnZlLCBub2RlLCBlbnRpdHlQYXRoKSA9PiB7XG4gICAgICAgIGlmICghb3V0cHV0TWFwW2N1cnZlLm91dHB1dF0pIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGdsYi1wYXJzZXI6IE5vIG91dHB1dCBkYXRhIGlzIGF2YWlsYWJsZSBmb3IgdGhlIG1vcnBoIHRhcmdldCBjdXJ2ZSAoJHtlbnRpdHlQYXRofS9ncmFwaC93ZWlnaHRzKS4gU2tpcHBpbmcuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRDb3VudCA9IG91dHB1dE1hcFtjdXJ2ZS5vdXRwdXRdLmRhdGEubGVuZ3RoIC8gaW5wdXRNYXBbY3VydmUuaW5wdXRdLmRhdGEubGVuZ3RoO1xuICAgICAgICBjb25zdCBrZXlmcmFtZUNvdW50ID0gb3V0cHV0TWFwW2N1cnZlLm91dHB1dF0uZGF0YS5sZW5ndGggLyBtb3JwaFRhcmdldENvdW50O1xuXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbW9ycGhUYXJnZXRDb3VudDsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCBtb3JwaFRhcmdldE91dHB1dCA9IG5ldyBGbG9hdDMyQXJyYXkoa2V5ZnJhbWVDb3VudCk7XG4gICAgICAgICAgICAvLyB0aGUgb3V0cHV0IGRhdGEgZm9yIGFsbCBtb3JwaCB0YXJnZXRzIGluIGEgc2luZ2xlIGN1cnZlIGlzIGludGVybGVhdmVkLiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBrZXlmcmFtZSBvdXRwdXQgZGF0YSBmb3IgYSBzaW5nbGUgbW9ycGggdGFyZ2V0XG4gICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGtleWZyYW1lQ291bnQ7IGsrKykge1xuICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0T3V0cHV0W2tdID0gb3V0cHV0TWFwW2N1cnZlLm91dHB1dF0uZGF0YVtrICogbW9ycGhUYXJnZXRDb3VudCArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gbmV3IEFuaW1EYXRhKDEsIG1vcnBoVGFyZ2V0T3V0cHV0KTtcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgaW5kaXZpZHVhbCBtb3JwaCB0YXJnZXQgb3V0cHV0IGRhdGEgdG8gdGhlIG91dHB1dE1hcCB1c2luZyBhIG5lZ2F0aXZlIHZhbHVlIGtleSAoc28gYXMgbm90IHRvIGNsYXNoIHdpdGggc2FtcGxlci5vdXRwdXQgdmFsdWVzKVxuICAgICAgICAgICAgb3V0cHV0TWFwWy1vdXRwdXRDb3VudGVyXSA9IG91dHB1dDtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoQ3VydmUgPSB7XG4gICAgICAgICAgICAgICAgcGF0aHM6IFt7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eVBhdGg6IGVudGl0eVBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudDogJ2dyYXBoJyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoOiBbYHdlaWdodC4ke3JldHJpZXZlV2VpZ2h0TmFtZShub2RlLm5hbWUsIGopfWBdXG4gICAgICAgICAgICAgICAgfV0sXG4gICAgICAgICAgICAgICAgLy8gZWFjaCBtb3JwaCB0YXJnZXQgY3VydmUgaW5wdXQgY2FuIHVzZSB0aGUgc2FtZSBzYW1wbGVyLmlucHV0IGZyb20gdGhlIGNoYW5uZWwgdGhleSB3ZXJlIGFsbCBpblxuICAgICAgICAgICAgICAgIGlucHV0OiBjdXJ2ZS5pbnB1dCxcbiAgICAgICAgICAgICAgICAvLyBidXQgZWFjaCBtb3JwaCB0YXJnZXQgY3VydmUgc2hvdWxkIHJlZmVyZW5jZSBpdHMgaW5kaXZpZHVhbCBvdXRwdXQgdGhhdCB3YXMganVzdCBjcmVhdGVkXG4gICAgICAgICAgICAgICAgb3V0cHV0OiAtb3V0cHV0Q291bnRlcixcbiAgICAgICAgICAgICAgICBpbnRlcnBvbGF0aW9uOiBjdXJ2ZS5pbnRlcnBvbGF0aW9uXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgb3V0cHV0Q291bnRlcisrO1xuICAgICAgICAgICAgLy8gYWRkIHRoZSBtb3JwaCB0YXJnZXQgY3VydmUgdG8gdGhlIGN1cnZlTWFwXG4gICAgICAgICAgICBjdXJ2ZU1hcFtgbW9ycGhDdXJ2ZS0ke2l9LSR7an1gXSA9IG1vcnBoQ3VydmU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gY29udmVydCBhbmltIGNoYW5uZWxzXG4gICAgZm9yIChpID0gMDsgaSA8IGdsdGZBbmltYXRpb24uY2hhbm5lbHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgY2hhbm5lbCA9IGdsdGZBbmltYXRpb24uY2hhbm5lbHNbaV07XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGNoYW5uZWwudGFyZ2V0O1xuICAgICAgICBjb25zdCBjdXJ2ZSA9IGN1cnZlTWFwW2NoYW5uZWwuc2FtcGxlcl07XG5cbiAgICAgICAgY29uc3Qgbm9kZSA9IG5vZGVzW3RhcmdldC5ub2RlXTtcbiAgICAgICAgY29uc3QgZW50aXR5UGF0aCA9IGNvbnN0cnVjdE5vZGVQYXRoKG5vZGUpO1xuXG4gICAgICAgIGlmICh0YXJnZXQucGF0aC5zdGFydHNXaXRoKCd3ZWlnaHRzJykpIHtcbiAgICAgICAgICAgIGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzKGN1cnZlLCBub2RlLCBlbnRpdHlQYXRoKTtcbiAgICAgICAgICAgIC8vIGFzIGFsbCBpbmRpdmlkdWFsIG1vcnBoIHRhcmdldHMgaW4gdGhpcyBtb3JwaCBjdXJ2ZSBoYXZlIHRoZWlyIG93biBjdXJ2ZSBub3csIHRoaXMgbW9ycGggY3VydmUgc2hvdWxkIGJlIGZsYWdnZWRcbiAgICAgICAgICAgIC8vIHNvIGl0J3Mgbm90IGluY2x1ZGVkIGluIHRoZSBmaW5hbCBvdXRwdXRcbiAgICAgICAgICAgIGN1cnZlTWFwW2NoYW5uZWwuc2FtcGxlcl0ubW9ycGhDdXJ2ZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjdXJ2ZS5wYXRocy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlbnRpdHlQYXRoOiBlbnRpdHlQYXRoLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudDogJ2dyYXBoJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6IFt0cmFuc2Zvcm1TY2hlbWFbdGFyZ2V0LnBhdGhdXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGNvbnN0IGlucHV0cyA9IFtdO1xuICAgIGNvbnN0IG91dHB1dHMgPSBbXTtcbiAgICBjb25zdCBjdXJ2ZXMgPSBbXTtcblxuICAgIC8vIEFkZCBlYWNoIGlucHV0IGluIHRoZSBtYXAgdG8gdGhlIGZpbmFsIGlucHV0cyBhcnJheS4gVGhlIGlucHV0TWFwIHNob3VsZCBub3cgcmVmZXJlbmNlIHRoZSBpbmRleCBvZiBpbnB1dCBpbiB0aGUgaW5wdXRzIGFycmF5IGluc3RlYWQgb2YgdGhlIGlucHV0IGl0c2VsZi5cbiAgICBmb3IgKGNvbnN0IGlucHV0S2V5IGluIGlucHV0TWFwKSB7XG4gICAgICAgIGlucHV0cy5wdXNoKGlucHV0TWFwW2lucHV0S2V5XSk7XG4gICAgICAgIGlucHV0TWFwW2lucHV0S2V5XSA9IGlucHV0cy5sZW5ndGggLSAxO1xuICAgIH1cbiAgICAvLyBBZGQgZWFjaCBvdXRwdXQgaW4gdGhlIG1hcCB0byB0aGUgZmluYWwgb3V0cHV0cyBhcnJheS4gVGhlIG91dHB1dE1hcCBzaG91bGQgbm93IHJlZmVyZW5jZSB0aGUgaW5kZXggb2Ygb3V0cHV0IGluIHRoZSBvdXRwdXRzIGFycmF5IGluc3RlYWQgb2YgdGhlIG91dHB1dCBpdHNlbGYuXG4gICAgZm9yIChjb25zdCBvdXRwdXRLZXkgaW4gb3V0cHV0TWFwKSB7XG4gICAgICAgIG91dHB1dHMucHVzaChvdXRwdXRNYXBbb3V0cHV0S2V5XSk7XG4gICAgICAgIG91dHB1dE1hcFtvdXRwdXRLZXldID0gb3V0cHV0cy5sZW5ndGggLSAxO1xuICAgIH1cbiAgICAvLyBDcmVhdGUgYW4gQW5pbUN1cnZlIGZvciBlYWNoIGN1cnZlIG9iamVjdCBpbiB0aGUgY3VydmVNYXAuIEVhY2ggY3VydmUgb2JqZWN0J3MgaW5wdXQgdmFsdWUgc2hvdWxkIGJlIHJlc29sdmVkIHRvIHRoZSBpbmRleCBvZiB0aGUgaW5wdXQgaW4gdGhlXG4gICAgLy8gaW5wdXRzIGFycmF5cyB1c2luZyB0aGUgaW5wdXRNYXAuIExpa2V3aXNlIGZvciBvdXRwdXQgdmFsdWVzLlxuICAgIGZvciAoY29uc3QgY3VydmVLZXkgaW4gY3VydmVNYXApIHtcbiAgICAgICAgY29uc3QgY3VydmVEYXRhID0gY3VydmVNYXBbY3VydmVLZXldO1xuICAgICAgICAvLyBpZiB0aGUgY3VydmVEYXRhIGNvbnRhaW5zIGEgbW9ycGggY3VydmUgdGhlbiBkbyBub3QgYWRkIGl0IHRvIHRoZSBmaW5hbCBjdXJ2ZSBsaXN0IGFzIHRoZSBpbmRpdmlkdWFsIG1vcnBoIHRhcmdldCBjdXJ2ZXMgYXJlIGluY2x1ZGVkIGluc3RlYWRcbiAgICAgICAgaWYgKGN1cnZlRGF0YS5tb3JwaEN1cnZlKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjdXJ2ZXMucHVzaChuZXcgQW5pbUN1cnZlKFxuICAgICAgICAgICAgY3VydmVEYXRhLnBhdGhzLFxuICAgICAgICAgICAgaW5wdXRNYXBbY3VydmVEYXRhLmlucHV0XSxcbiAgICAgICAgICAgIG91dHB1dE1hcFtjdXJ2ZURhdGEub3V0cHV0XSxcbiAgICAgICAgICAgIGN1cnZlRGF0YS5pbnRlcnBvbGF0aW9uXG4gICAgICAgICkpO1xuXG4gICAgICAgIC8vIGlmIHRoaXMgdGFyZ2V0IGlzIGEgc2V0IG9mIHF1YXRlcm5pb24ga2V5cywgbWFrZSBub3RlIG9mIGl0cyBpbmRleCBzbyB3ZSBjYW4gcGVyZm9ybVxuICAgICAgICAvLyBxdWF0ZXJuaW9uLXNwZWNpZmljIHByb2Nlc3Npbmcgb24gaXQuXG4gICAgICAgIGlmIChjdXJ2ZURhdGEucGF0aHMubGVuZ3RoID4gMCAmJiBjdXJ2ZURhdGEucGF0aHNbMF0ucHJvcGVydHlQYXRoWzBdID09PSAnbG9jYWxSb3RhdGlvbicgJiYgY3VydmVEYXRhLmludGVycG9sYXRpb24gIT09IElOVEVSUE9MQVRJT05fQ1VCSUMpIHtcbiAgICAgICAgICAgIHF1YXRBcnJheXMucHVzaChjdXJ2ZXNbY3VydmVzLmxlbmd0aCAtIDFdLm91dHB1dCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHRoZSBsaXN0IG9mIGFycmF5IGluZGV4ZXMgc28gd2UgY2FuIHNraXAgZHVwc1xuICAgIHF1YXRBcnJheXMuc29ydCgpO1xuXG4gICAgLy8gcnVuIHRocm91Z2ggdGhlIHF1YXRlcm5pb24gZGF0YSBhcnJheXMgZmxpcHBpbmcgcXVhdGVybmlvbiBrZXlzXG4gICAgLy8gdGhhdCBkb24ndCBmYWxsIGluIHRoZSBzYW1lIHdpbmRpbmcgb3JkZXIuXG4gICAgbGV0IHByZXZJbmRleCA9IG51bGw7XG4gICAgbGV0IGRhdGE7XG4gICAgZm9yIChpID0gMDsgaSA8IHF1YXRBcnJheXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBxdWF0QXJyYXlzW2ldO1xuICAgICAgICAvLyBza2lwIG92ZXIgZHVwbGljYXRlIGFycmF5IGluZGljZXNcbiAgICAgICAgaWYgKGkgPT09IDAgfHwgaW5kZXggIT09IHByZXZJbmRleCkge1xuICAgICAgICAgICAgZGF0YSA9IG91dHB1dHNbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKGRhdGEuY29tcG9uZW50cyA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGQgPSBkYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVuID0gZC5sZW5ndGggLSA0O1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqICs9IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHAgPSBkW2ogKyAwXSAqIGRbaiArIDRdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgMV0gKiBkW2ogKyA1XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDJdICogZFtqICsgNl0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAzXSAqIGRbaiArIDddO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChkcCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDRdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNV0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA2XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDddICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJldkluZGV4ID0gaW5kZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjYWxjdWxhdGUgZHVyYXRpb24gb2YgdGhlIGFuaW1hdGlvbiBhcyBtYXhpbXVtIHRpbWUgdmFsdWVcbiAgICBsZXQgZHVyYXRpb24gPSAwO1xuICAgIGZvciAoaSA9IDA7IGkgPCBpbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZGF0YSAgPSBpbnB1dHNbaV0uX2RhdGE7XG4gICAgICAgIGR1cmF0aW9uID0gTWF0aC5tYXgoZHVyYXRpb24sIGRhdGEubGVuZ3RoID09PSAwID8gMCA6IGRhdGFbZGF0YS5sZW5ndGggLSAxXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBBbmltVHJhY2soXG4gICAgICAgIGdsdGZBbmltYXRpb24uaGFzT3duUHJvcGVydHkoJ25hbWUnKSA/IGdsdGZBbmltYXRpb24ubmFtZSA6ICgnYW5pbWF0aW9uXycgKyBhbmltYXRpb25JbmRleCksXG4gICAgICAgIGR1cmF0aW9uLFxuICAgICAgICBpbnB1dHMsXG4gICAgICAgIG91dHB1dHMsXG4gICAgICAgIGN1cnZlcyk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlID0gZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICBjb25zdCBlbnRpdHkgPSBuZXcgR3JhcGhOb2RlKCk7XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ25hbWUnKSAmJiBnbHRmTm9kZS5uYW1lLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZW50aXR5Lm5hbWUgPSBnbHRmTm9kZS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVudGl0eS5uYW1lID0gJ25vZGVfJyArIG5vZGVJbmRleDtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSB0cmFuc2Zvcm1hdGlvbiBwcm9wZXJ0aWVzXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdtYXRyaXgnKSkge1xuICAgICAgICB0ZW1wTWF0LmRhdGEuc2V0KGdsdGZOb2RlLm1hdHJpeCk7XG4gICAgICAgIHRlbXBNYXQuZ2V0VHJhbnNsYXRpb24odGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHRlbXBWZWMpO1xuICAgICAgICB0ZW1wTWF0LmdldEV1bGVyQW5nbGVzKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyh0ZW1wVmVjKTtcbiAgICAgICAgdGVtcE1hdC5nZXRTY2FsZSh0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsU2NhbGUodGVtcFZlYyk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdyb3RhdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHIgPSBnbHRmTm9kZS5yb3RhdGlvbjtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUm90YXRpb24oclswXSwgclsxXSwgclsyXSwgclszXSk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCd0cmFuc2xhdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHQgPSBnbHRmTm9kZS50cmFuc2xhdGlvbjtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUG9zaXRpb24odFswXSwgdFsxXSwgdFsyXSk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgIGNvbnN0IHMgPSBnbHRmTm9kZS5zY2FsZTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsU2NhbGUoc1swXSwgc1sxXSwgc1syXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudGl0eTtcbn07XG5cbi8vIGNyZWF0ZXMgYSBjYW1lcmEgY29tcG9uZW50IG9uIHRoZSBzdXBwbGllZCBub2RlLCBhbmQgcmV0dXJucyBpdFxuY29uc3QgY3JlYXRlQ2FtZXJhID0gZnVuY3Rpb24gKGdsdGZDYW1lcmEsIG5vZGUpIHtcblxuICAgIGNvbnN0IHByb2plY3Rpb24gPSBnbHRmQ2FtZXJhLnR5cGUgPT09ICdvcnRob2dyYXBoaWMnID8gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgOiBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFO1xuICAgIGNvbnN0IGdsdGZQcm9wZXJ0aWVzID0gcHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgPyBnbHRmQ2FtZXJhLm9ydGhvZ3JhcGhpYyA6IGdsdGZDYW1lcmEucGVyc3BlY3RpdmU7XG5cbiAgICBjb25zdCBjb21wb25lbnREYXRhID0ge1xuICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgICAgcHJvamVjdGlvbjogcHJvamVjdGlvbixcbiAgICAgICAgbmVhckNsaXA6IGdsdGZQcm9wZXJ0aWVzLnpuZWFyLFxuICAgICAgICBhc3BlY3RSYXRpb01vZGU6IEFTUEVDVF9BVVRPXG4gICAgfTtcblxuICAgIGlmIChnbHRmUHJvcGVydGllcy56ZmFyKSB7XG4gICAgICAgIGNvbXBvbmVudERhdGEuZmFyQ2xpcCA9IGdsdGZQcm9wZXJ0aWVzLnpmYXI7XG4gICAgfVxuXG4gICAgaWYgKHByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDKSB7XG4gICAgICAgIGNvbXBvbmVudERhdGEub3J0aG9IZWlnaHQgPSAwLjUgKiBnbHRmUHJvcGVydGllcy55bWFnO1xuICAgICAgICBpZiAoZ2x0ZlByb3BlcnRpZXMueW1hZykge1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfTUFOVUFMO1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpbyA9IGdsdGZQcm9wZXJ0aWVzLnhtYWcgLyBnbHRmUHJvcGVydGllcy55bWFnO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5mb3YgPSBnbHRmUHJvcGVydGllcy55Zm92ICogbWF0aC5SQURfVE9fREVHO1xuICAgICAgICBpZiAoZ2x0ZlByb3BlcnRpZXMuYXNwZWN0UmF0aW8pIHtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW9Nb2RlID0gQVNQRUNUX01BTlVBTDtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW8gPSBnbHRmUHJvcGVydGllcy5hc3BlY3RSYXRpbztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNhbWVyYUVudGl0eSA9IG5ldyBFbnRpdHkoZ2x0ZkNhbWVyYS5uYW1lKTtcbiAgICBjYW1lcmFFbnRpdHkuYWRkQ29tcG9uZW50KCdjYW1lcmEnLCBjb21wb25lbnREYXRhKTtcbiAgICByZXR1cm4gY2FtZXJhRW50aXR5O1xufTtcblxuLy8gY3JlYXRlcyBsaWdodCBjb21wb25lbnQsIGFkZHMgaXQgdG8gdGhlIG5vZGUgYW5kIHJldHVybnMgdGhlIGNyZWF0ZWQgbGlnaHQgY29tcG9uZW50XG5jb25zdCBjcmVhdGVMaWdodCA9IGZ1bmN0aW9uIChnbHRmTGlnaHQsIG5vZGUpIHtcblxuICAgIGNvbnN0IGxpZ2h0UHJvcHMgPSB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICB0eXBlOiBnbHRmTGlnaHQudHlwZSA9PT0gJ3BvaW50JyA/ICdvbW5pJyA6IGdsdGZMaWdodC50eXBlLFxuICAgICAgICBjb2xvcjogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdjb2xvcicpID8gbmV3IENvbG9yKGdsdGZMaWdodC5jb2xvcikgOiBDb2xvci5XSElURSxcblxuICAgICAgICAvLyB3aGVuIHJhbmdlIGlzIG5vdCBkZWZpbmVkLCBpbmZpbml0eSBzaG91bGQgYmUgdXNlZCAtIGJ1dCB0aGF0IGlzIGNhdXNpbmcgaW5maW5pdHkgaW4gYm91bmRzIGNhbGN1bGF0aW9uc1xuICAgICAgICByYW5nZTogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdyYW5nZScpID8gZ2x0ZkxpZ2h0LnJhbmdlIDogOTk5OSxcblxuICAgICAgICBmYWxsb2ZmTW9kZTogTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuXG4gICAgICAgIC8vIFRPRE86IChlbmdpbmUgaXNzdWUgIzMyNTIpIFNldCBpbnRlbnNpdHkgdG8gbWF0Y2ggZ2xURiBzcGVjaWZpY2F0aW9uLCB3aGljaCB1c2VzIHBoeXNpY2FsbHkgYmFzZWQgdmFsdWVzOlxuICAgICAgICAvLyAtIE9tbmkgYW5kIHNwb3QgbGlnaHRzIHVzZSBsdW1pbm91cyBpbnRlbnNpdHkgaW4gY2FuZGVsYSAobG0vc3IpXG4gICAgICAgIC8vIC0gRGlyZWN0aW9uYWwgbGlnaHRzIHVzZSBpbGx1bWluYW5jZSBpbiBsdXggKGxtL20yKS5cbiAgICAgICAgLy8gQ3VycmVudCBpbXBsZW1lbnRhdGlvbjogY2xhcG1zIHNwZWNpZmllZCBpbnRlbnNpdHkgdG8gMC4uMiByYW5nZVxuICAgICAgICBpbnRlbnNpdHk6IGdsdGZMaWdodC5oYXNPd25Qcm9wZXJ0eSgnaW50ZW5zaXR5JykgPyBtYXRoLmNsYW1wKGdsdGZMaWdodC5pbnRlbnNpdHksIDAsIDIpIDogMVxuICAgIH07XG5cbiAgICBpZiAoZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdzcG90JykpIHtcbiAgICAgICAgbGlnaHRQcm9wcy5pbm5lckNvbmVBbmdsZSA9IGdsdGZMaWdodC5zcG90Lmhhc093blByb3BlcnR5KCdpbm5lckNvbmVBbmdsZScpID8gZ2x0ZkxpZ2h0LnNwb3QuaW5uZXJDb25lQW5nbGUgKiBtYXRoLlJBRF9UT19ERUcgOiAwO1xuICAgICAgICBsaWdodFByb3BzLm91dGVyQ29uZUFuZ2xlID0gZ2x0ZkxpZ2h0LnNwb3QuaGFzT3duUHJvcGVydHkoJ291dGVyQ29uZUFuZ2xlJykgPyBnbHRmTGlnaHQuc3BvdC5vdXRlckNvbmVBbmdsZSAqIG1hdGguUkFEX1RPX0RFRyA6IE1hdGguUEkgLyA0O1xuICAgIH1cblxuICAgIC8vIGdsVEYgc3RvcmVzIGxpZ2h0IGFscmVhZHkgaW4gZW5lcmd5L2FyZWEsIGJ1dCB3ZSBuZWVkIHRvIHByb3ZpZGUgdGhlIGxpZ2h0IHdpdGggb25seSB0aGUgZW5lcmd5IHBhcmFtZXRlcixcbiAgICAvLyBzbyB3ZSBuZWVkIHRoZSBpbnRlbnNpdGllcyBpbiBjYW5kZWxhIGJhY2sgdG8gbHVtZW5cbiAgICBpZiAoZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KFwiaW50ZW5zaXR5XCIpKSB7XG4gICAgICAgIGxpZ2h0UHJvcHMubHVtaW5hbmNlID0gZ2x0ZkxpZ2h0LmludGVuc2l0eSAqIExpZ2h0LmdldExpZ2h0VW5pdENvbnZlcnNpb24obGlnaHRUeXBlc1tsaWdodFByb3BzLnR5cGVdLCBsaWdodFByb3BzLm91dGVyQ29uZUFuZ2xlLCBsaWdodFByb3BzLmlubmVyQ29uZUFuZ2xlKTtcbiAgICB9XG5cbiAgICAvLyBSb3RhdGUgdG8gbWF0Y2ggbGlnaHQgb3JpZW50YXRpb24gaW4gZ2xURiBzcGVjaWZpY2F0aW9uXG4gICAgLy8gTm90ZSB0aGF0IHRoaXMgYWRkcyBhIG5ldyBlbnRpdHkgbm9kZSBpbnRvIHRoZSBoaWVyYXJjaHkgdGhhdCBkb2VzIG5vdCBleGlzdCBpbiB0aGUgZ2x0ZiBoaWVyYXJjaHlcbiAgICBjb25zdCBsaWdodEVudGl0eSA9IG5ldyBFbnRpdHkobm9kZS5uYW1lKTtcbiAgICBsaWdodEVudGl0eS5yb3RhdGVMb2NhbCg5MCwgMCwgMCk7XG5cbiAgICAvLyBhZGQgY29tcG9uZW50XG4gICAgbGlnaHRFbnRpdHkuYWRkQ29tcG9uZW50KCdsaWdodCcsIGxpZ2h0UHJvcHMpO1xuICAgIHJldHVybiBsaWdodEVudGl0eTtcbn07XG5cbmNvbnN0IGNyZWF0ZVNraW5zID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdza2lucycpIHx8IGdsdGYuc2tpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICAvLyBjYWNoZSBmb3Igc2tpbnMgdG8gZmlsdGVyIG91dCBkdXBsaWNhdGVzXG4gICAgY29uc3QgZ2xiU2tpbnMgPSBuZXcgTWFwKCk7XG5cbiAgICByZXR1cm4gZ2x0Zi5za2lucy5tYXAoZnVuY3Rpb24gKGdsdGZTa2luKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVTa2luKGRldmljZSwgZ2x0ZlNraW4sIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsYlNraW5zKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZU1lc2hlcyA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCBjYWxsYmFjaywgZmxpcFYsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ21lc2hlcycpIHx8IGdsdGYubWVzaGVzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAhZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnYWNjZXNzb3JzJykgfHwgZ2x0Zi5hY2Nlc3NvcnMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICFnbHRmLmhhc093blByb3BlcnR5KCdidWZmZXJWaWV3cycpIHx8IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICAvLyBkaWN0aW9uYXJ5IG9mIHZlcnRleCBidWZmZXJzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICBjb25zdCB2ZXJ0ZXhCdWZmZXJEaWN0ID0ge307XG5cbiAgICByZXR1cm4gZ2x0Zi5tZXNoZXMubWFwKGZ1bmN0aW9uIChnbHRmTWVzaCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIGdsdGZNZXNoLCBnbHRmLmFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgb3B0aW9ucyk7XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVNYXRlcmlhbHMgPSBmdW5jdGlvbiAoZ2x0ZiwgdGV4dHVyZXMsIG9wdGlvbnMsIGZsaXBWKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdtYXRlcmlhbHMnKSB8fCBnbHRmLm1hdGVyaWFscy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubWF0ZXJpYWwgJiYgb3B0aW9ucy5tYXRlcmlhbC5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubWF0ZXJpYWwgJiYgb3B0aW9ucy5tYXRlcmlhbC5wcm9jZXNzIHx8IGNyZWF0ZU1hdGVyaWFsO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm1hdGVyaWFsICYmIG9wdGlvbnMubWF0ZXJpYWwucG9zdHByb2Nlc3M7XG5cbiAgICByZXR1cm4gZ2x0Zi5tYXRlcmlhbHMubWFwKGZ1bmN0aW9uIChnbHRmTWF0ZXJpYWwpIHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk1hdGVyaWFsKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHByb2Nlc3MoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZNYXRlcmlhbCwgbWF0ZXJpYWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZVZhcmlhbnRzID0gZnVuY3Rpb24gKGdsdGYpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoXCJleHRlbnNpb25zXCIpIHx8ICFnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKVxuICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGRhdGEgPSBnbHRmLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cy52YXJpYW50cztcbiAgICBjb25zdCB2YXJpYW50cyA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXJpYW50c1tkYXRhW2ldLm5hbWVdID0gaTtcbiAgICB9XG4gICAgcmV0dXJuIHZhcmlhbnRzO1xufTtcblxuY29uc3QgY3JlYXRlQW5pbWF0aW9ucyA9IGZ1bmN0aW9uIChnbHRmLCBub2RlcywgYnVmZmVyVmlld3MsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ2FuaW1hdGlvbnMnKSB8fCBnbHRmLmFuaW1hdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLmFuaW1hdGlvbnMubWFwKGZ1bmN0aW9uIChnbHRmQW5pbWF0aW9uLCBpbmRleCkge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQW5pbWF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbmltYXRpb24gPSBjcmVhdGVBbmltYXRpb24oZ2x0ZkFuaW1hdGlvbiwgaW5kZXgsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsdGYubWVzaGVzKTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQW5pbWF0aW9uLCBhbmltYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhbmltYXRpb247XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlcyA9IGZ1bmN0aW9uIChnbHRmLCBvcHRpb25zKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpIHx8IGdsdGYubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm5vZGUgJiYgb3B0aW9ucy5ub2RlLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5ub2RlICYmIG9wdGlvbnMubm9kZS5wcm9jZXNzIHx8IGNyZWF0ZU5vZGU7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubm9kZSAmJiBvcHRpb25zLm5vZGUucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBub2RlcyA9IGdsdGYubm9kZXMubWFwKGZ1bmN0aW9uIChnbHRmTm9kZSwgaW5kZXgpIHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5vZGUgPSBwcm9jZXNzKGdsdGZOb2RlLCBpbmRleCk7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zk5vZGUsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH0pO1xuXG4gICAgLy8gYnVpbGQgbm9kZSBoaWVyYXJjaHlcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYubm9kZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0Zk5vZGUgPSBnbHRmLm5vZGVzW2ldO1xuICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NoaWxkcmVuJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgdW5pcXVlTmFtZXMgPSB7IH07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGdsdGZOb2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBub2Rlc1tnbHRmTm9kZS5jaGlsZHJlbltqXV07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZC5wYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVuaXF1ZU5hbWVzLmhhc093blByb3BlcnR5KGNoaWxkLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5uYW1lICs9IHVuaXF1ZU5hbWVzW2NoaWxkLm5hbWVdKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlxdWVOYW1lc1tjaGlsZC5uYW1lXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZXM7XG59O1xuXG5jb25zdCBjcmVhdGVTY2VuZXMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMpIHtcbiAgICBjb25zdCBzY2VuZXMgPSBbXTtcbiAgICBjb25zdCBjb3VudCA9IGdsdGYuc2NlbmVzLmxlbmd0aDtcblxuICAgIC8vIGlmIHRoZXJlJ3MgYSBzaW5nbGUgc2NlbmUgd2l0aCBhIHNpbmdsZSBub2RlIGluIGl0LCBkb24ndCBjcmVhdGUgd3JhcHBlciBub2Rlc1xuICAgIGlmIChjb3VudCA9PT0gMSAmJiBnbHRmLnNjZW5lc1swXS5ub2Rlcz8ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IGdsdGYuc2NlbmVzWzBdLm5vZGVzWzBdO1xuICAgICAgICBzY2VuZXMucHVzaChub2Rlc1tub2RlSW5kZXhdKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIC8vIGNyZWF0ZSByb290IG5vZGUgcGVyIHNjZW5lXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lc1tpXTtcbiAgICAgICAgICAgIGlmIChzY2VuZS5ub2Rlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lUm9vdCA9IG5ldyBHcmFwaE5vZGUoc2NlbmUubmFtZSk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbiA9IDA7IG4gPCBzY2VuZS5ub2Rlcy5sZW5ndGg7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZE5vZGUgPSBub2Rlc1tzY2VuZS5ub2Rlc1tuXV07XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lUm9vdC5hZGRDaGlsZChjaGlsZE5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzY2VuZXMucHVzaChzY2VuZVJvb3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjZW5lcztcbn07XG5cbmNvbnN0IGNyZWF0ZUNhbWVyYXMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpIHtcblxuICAgIGxldCBjYW1lcmFzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2NhbWVyYXMnKSAmJiBnbHRmLmNhbWVyYXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuY2FtZXJhICYmIG9wdGlvbnMuY2FtZXJhLnByZXByb2Nlc3M7XG4gICAgICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuY2FtZXJhICYmIG9wdGlvbnMuY2FtZXJhLnByb2Nlc3MgfHwgY3JlYXRlQ2FtZXJhO1xuICAgICAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jYW1lcmEgJiYgb3B0aW9ucy5jYW1lcmEucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChnbHRmTm9kZSwgbm9kZUluZGV4KSB7XG4gICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NhbWVyYScpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkNhbWVyYSA9IGdsdGYuY2FtZXJhc1tnbHRmTm9kZS5jYW1lcmFdO1xuICAgICAgICAgICAgICAgIGlmIChnbHRmQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZDYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHByb2Nlc3MoZ2x0ZkNhbWVyYSwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkNhbWVyYSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgY2FtZXJhIHRvIG5vZGUtPmNhbWVyYSBtYXBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYW1lcmFzKSBjYW1lcmFzID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhcy5zZXQoZ2x0Zk5vZGUsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjYW1lcmFzO1xufTtcblxuY29uc3QgY3JlYXRlTGlnaHRzID0gZnVuY3Rpb24gKGdsdGYsIG5vZGVzLCBvcHRpb25zKSB7XG5cbiAgICBsZXQgbGlnaHRzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSAmJlxuICAgICAgICBnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9saWdodHNfcHVuY3R1YWwnKSAmJiBnbHRmLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHRzJykpIHtcblxuICAgICAgICBjb25zdCBnbHRmTGlnaHRzID0gZ2x0Zi5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHRzO1xuICAgICAgICBpZiAoZ2x0ZkxpZ2h0cy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5saWdodCAmJiBvcHRpb25zLmxpZ2h0LnByZXByb2Nlc3M7XG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpZ2h0ICYmIG9wdGlvbnMubGlnaHQucHJvY2VzcyB8fCBjcmVhdGVMaWdodDtcbiAgICAgICAgICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpZ2h0ICYmIG9wdGlvbnMubGlnaHQucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBub2RlcyB3aXRoIGxpZ2h0c1xuICAgICAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChnbHRmTm9kZSwgbm9kZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2xpZ2h0c19wdW5jdHVhbCcpICYmXG4gICAgICAgICAgICAgICAgICAgIGdsdGZOb2RlLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHQnKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0SW5kZXggPSBnbHRmTm9kZS5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZMaWdodCA9IGdsdGZMaWdodHNbbGlnaHRJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBwcm9jZXNzKGdsdGZMaWdodCwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTGlnaHQsIGxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBsaWdodCB0byBub2RlLT5saWdodCBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRzKSBsaWdodHMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRzLnNldChnbHRmTm9kZSwgbGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlnaHRzO1xufTtcblxuLy8gbGluayBza2lucyB0byB0aGUgbWVzaGVzXG5jb25zdCBsaW5rU2tpbnMgPSBmdW5jdGlvbiAoZ2x0ZiwgcmVuZGVycywgc2tpbnMpIHtcbiAgICBnbHRmLm5vZGVzLmZvckVhY2goKGdsdGZOb2RlKSA9PiB7XG4gICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbWVzaCcpICYmIGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdza2luJykpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hHcm91cCA9IHJlbmRlcnNbZ2x0Zk5vZGUubWVzaF0ubWVzaGVzO1xuICAgICAgICAgICAgbWVzaEdyb3VwLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgICAgICAgICBtZXNoLnNraW4gPSBza2luc1tnbHRmTm9kZS5za2luXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBjcmVhdGUgZW5naW5lIHJlc291cmNlcyBmcm9tIHRoZSBkb3dubG9hZGVkIEdMQiBkYXRhXG5jb25zdCBjcmVhdGVSZXNvdXJjZXMgPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZUFzc2V0cywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmdsb2JhbCAmJiBvcHRpb25zLmdsb2JhbC5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmdsb2JhbCAmJiBvcHRpb25zLmdsb2JhbC5wb3N0cHJvY2VzcztcblxuICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgIHByZXByb2Nlc3MoZ2x0Zik7XG4gICAgfVxuXG4gICAgLy8gVGhlIG9yaWdpbmFsIHZlcnNpb24gb2YgRkFDVCBnZW5lcmF0ZWQgaW5jb3JyZWN0bHkgZmxpcHBlZCBWIHRleHR1cmVcbiAgICAvLyBjb29yZGluYXRlcy4gV2UgbXVzdCBjb21wZW5zYXRlIGJ5IGZsaXBwaW5nIFYgaW4gdGhpcyBjYXNlLiBPbmNlXG4gICAgLy8gYWxsIG1vZGVscyBoYXZlIGJlZW4gcmUtZXhwb3J0ZWQgd2UgY2FuIHJlbW92ZSB0aGlzIGZsYWcuXG4gICAgY29uc3QgZmxpcFYgPSBnbHRmLmFzc2V0ICYmIGdsdGYuYXNzZXQuZ2VuZXJhdG9yID09PSAnUGxheUNhbnZhcyc7XG5cbiAgICAvLyBXZSdkIGxpa2UgdG8gcmVtb3ZlIHRoZSBmbGlwViBjb2RlIGF0IHNvbWUgcG9pbnQuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ2dsVEYgbW9kZWwgbWF5IGhhdmUgZmxpcHBlZCBVVnMuIFBsZWFzZSByZWNvbnZlcnQuJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZXMgPSBjcmVhdGVOb2RlcyhnbHRmLCBvcHRpb25zKTtcbiAgICBjb25zdCBzY2VuZXMgPSBjcmVhdGVTY2VuZXMoZ2x0Ziwgbm9kZXMpO1xuICAgIGNvbnN0IGxpZ2h0cyA9IGNyZWF0ZUxpZ2h0cyhnbHRmLCBub2Rlcywgb3B0aW9ucyk7XG4gICAgY29uc3QgY2FtZXJhcyA9IGNyZWF0ZUNhbWVyYXMoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IGFuaW1hdGlvbnMgPSBjcmVhdGVBbmltYXRpb25zKGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3cywgb3B0aW9ucyk7XG4gICAgY29uc3QgbWF0ZXJpYWxzID0gY3JlYXRlTWF0ZXJpYWxzKGdsdGYsIHRleHR1cmVBc3NldHMubWFwKGZ1bmN0aW9uICh0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgcmV0dXJuIHRleHR1cmVBc3NldC5yZXNvdXJjZTtcbiAgICB9KSwgb3B0aW9ucywgZmxpcFYpO1xuICAgIGNvbnN0IHZhcmlhbnRzID0gY3JlYXRlVmFyaWFudHMoZ2x0Zik7XG4gICAgY29uc3QgbWVzaFZhcmlhbnRzID0ge307XG4gICAgY29uc3QgbWVzaERlZmF1bHRNYXRlcmlhbHMgPSB7fTtcbiAgICBjb25zdCBtZXNoZXMgPSBjcmVhdGVNZXNoZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgY2FsbGJhY2ssIGZsaXBWLCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBvcHRpb25zKTtcbiAgICBjb25zdCBza2lucyA9IGNyZWF0ZVNraW5zKGRldmljZSwgZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzKTtcblxuICAgIC8vIGNyZWF0ZSByZW5kZXJzIHRvIHdyYXAgbWVzaGVzXG4gICAgY29uc3QgcmVuZGVycyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlbmRlcnNbaV0gPSBuZXcgUmVuZGVyKCk7XG4gICAgICAgIHJlbmRlcnNbaV0ubWVzaGVzID0gbWVzaGVzW2ldO1xuICAgIH1cblxuICAgIC8vIGxpbmsgc2tpbnMgdG8gbWVzaGVzXG4gICAgbGlua1NraW5zKGdsdGYsIHJlbmRlcnMsIHNraW5zKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBHbGJSZXNvdXJjZXMoZ2x0Zik7XG4gICAgcmVzdWx0Lm5vZGVzID0gbm9kZXM7XG4gICAgcmVzdWx0LnNjZW5lcyA9IHNjZW5lcztcbiAgICByZXN1bHQuYW5pbWF0aW9ucyA9IGFuaW1hdGlvbnM7XG4gICAgcmVzdWx0LnRleHR1cmVzID0gdGV4dHVyZUFzc2V0cztcbiAgICByZXN1bHQubWF0ZXJpYWxzID0gbWF0ZXJpYWxzO1xuICAgIHJlc3VsdC52YXJpYW50cyA9IHZhcmlhbnRzO1xuICAgIHJlc3VsdC5tZXNoVmFyaWFudHMgPSBtZXNoVmFyaWFudHM7XG4gICAgcmVzdWx0Lm1lc2hEZWZhdWx0TWF0ZXJpYWxzID0gbWVzaERlZmF1bHRNYXRlcmlhbHM7XG4gICAgcmVzdWx0LnJlbmRlcnMgPSByZW5kZXJzO1xuICAgIHJlc3VsdC5za2lucyA9IHNraW5zO1xuICAgIHJlc3VsdC5saWdodHMgPSBsaWdodHM7XG4gICAgcmVzdWx0LmNhbWVyYXMgPSBjYW1lcmFzO1xuXG4gICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgIHBvc3Rwcm9jZXNzKGdsdGYsIHJlc3VsdCk7XG4gICAgfVxuXG4gICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbn07XG5cbmNvbnN0IGFwcGx5U2FtcGxlciA9IGZ1bmN0aW9uICh0ZXh0dXJlLCBnbHRmU2FtcGxlcikge1xuICAgIGNvbnN0IGdldEZpbHRlciA9IGZ1bmN0aW9uIChmaWx0ZXIsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICBzd2l0Y2ggKGZpbHRlcikge1xuICAgICAgICAgICAgY2FzZSA5NzI4OiByZXR1cm4gRklMVEVSX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk3Mjk6IHJldHVybiBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgY2FzZSA5OTg0OiByZXR1cm4gRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk5ODU6IHJldHVybiBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUO1xuICAgICAgICAgICAgY2FzZSA5OTg2OiByZXR1cm4gRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUjtcbiAgICAgICAgICAgIGNhc2UgOTk4NzogcmV0dXJuIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUjtcbiAgICAgICAgICAgIGRlZmF1bHQ6ICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBnZXRXcmFwID0gZnVuY3Rpb24gKHdyYXAsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICBzd2l0Y2ggKHdyYXApIHtcbiAgICAgICAgICAgIGNhc2UgMzMwNzE6IHJldHVybiBBRERSRVNTX0NMQU1QX1RPX0VER0U7XG4gICAgICAgICAgICBjYXNlIDMzNjQ4OiByZXR1cm4gQUREUkVTU19NSVJST1JFRF9SRVBFQVQ7XG4gICAgICAgICAgICBjYXNlIDEwNDk3OiByZXR1cm4gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgICAgICBkZWZhdWx0OiAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGlmICh0ZXh0dXJlKSB7XG4gICAgICAgIGdsdGZTYW1wbGVyID0gZ2x0ZlNhbXBsZXIgfHwgeyB9O1xuICAgICAgICB0ZXh0dXJlLm1pbkZpbHRlciA9IGdldEZpbHRlcihnbHRmU2FtcGxlci5taW5GaWx0ZXIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUik7XG4gICAgICAgIHRleHR1cmUubWFnRmlsdGVyID0gZ2V0RmlsdGVyKGdsdGZTYW1wbGVyLm1hZ0ZpbHRlciwgRklMVEVSX0xJTkVBUik7XG4gICAgICAgIHRleHR1cmUuYWRkcmVzc1UgPSBnZXRXcmFwKGdsdGZTYW1wbGVyLndyYXBTLCBBRERSRVNTX1JFUEVBVCk7XG4gICAgICAgIHRleHR1cmUuYWRkcmVzc1YgPSBnZXRXcmFwKGdsdGZTYW1wbGVyLndyYXBULCBBRERSRVNTX1JFUEVBVCk7XG4gICAgfVxufTtcblxubGV0IGdsdGZUZXh0dXJlVW5pcXVlSWQgPSAwO1xuXG4vLyBsb2FkIGFuIGltYWdlXG5jb25zdCBsb2FkSW1hZ2VBc3luYyA9IGZ1bmN0aW9uIChnbHRmSW1hZ2UsIGluZGV4LCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5pbWFnZSAmJiBvcHRpb25zLmltYWdlLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5pbWFnZSAmJiBvcHRpb25zLmltYWdlLnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZJbWFnZSwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5pbWFnZSAmJiBvcHRpb25zLmltYWdlLnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKHRleHR1cmVBc3NldCkge1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZJbWFnZSwgdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlQXNzZXQpO1xuICAgIH07XG5cbiAgICBjb25zdCBtaW1lVHlwZUZpbGVFeHRlbnNpb25zID0ge1xuICAgICAgICAnaW1hZ2UvcG5nJzogJ3BuZycsXG4gICAgICAgICdpbWFnZS9qcGVnJzogJ2pwZycsXG4gICAgICAgICdpbWFnZS9iYXNpcyc6ICdiYXNpcycsXG4gICAgICAgICdpbWFnZS9rdHgnOiAna3R4JyxcbiAgICAgICAgJ2ltYWdlL2t0eDInOiAna3R4MicsXG4gICAgICAgICdpbWFnZS92bmQtbXMuZGRzJzogJ2RkcydcbiAgICB9O1xuXG4gICAgY29uc3QgbG9hZFRleHR1cmUgPSBmdW5jdGlvbiAodXJsLCBidWZmZXJWaWV3LCBtaW1lVHlwZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBuYW1lID0gKGdsdGZJbWFnZS5uYW1lIHx8ICdnbHRmLXRleHR1cmUnKSArICctJyArIGdsdGZUZXh0dXJlVW5pcXVlSWQrKztcblxuICAgICAgICAvLyBjb25zdHJ1Y3QgdGhlIGFzc2V0IGZpbGVcbiAgICAgICAgY29uc3QgZmlsZSA9IHtcbiAgICAgICAgICAgIHVybDogdXJsIHx8IG5hbWVcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGJ1ZmZlclZpZXcpIHtcbiAgICAgICAgICAgIGZpbGUuY29udGVudHMgPSBidWZmZXJWaWV3LnNsaWNlKDApLmJ1ZmZlcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWltZVR5cGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IG1pbWVUeXBlRmlsZUV4dGVuc2lvbnNbbWltZVR5cGVdO1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbikge1xuICAgICAgICAgICAgICAgIGZpbGUuZmlsZW5hbWUgPSBmaWxlLnVybCArICcuJyArIGV4dGVuc2lvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgbG9hZCB0aGUgYXNzZXRcbiAgICAgICAgY29uc3QgYXNzZXQgPSBuZXcgQXNzZXQobmFtZSwgJ3RleHR1cmUnLCBmaWxlLCBudWxsLCBvcHRpb25zKTtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCBvbkxvYWQpO1xuICAgICAgICBhc3NldC5vbignZXJyb3InLCBjYWxsYmFjayk7XG4gICAgICAgIHJlZ2lzdHJ5LmFkZChhc3NldCk7XG4gICAgICAgIHJlZ2lzdHJ5LmxvYWQoYXNzZXQpO1xuICAgIH07XG5cbiAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICBwcmVwcm9jZXNzKGdsdGZJbWFnZSk7XG4gICAgfVxuXG4gICAgcHJvY2Vzc0FzeW5jKGdsdGZJbWFnZSwgZnVuY3Rpb24gKGVyciwgdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0gZWxzZSBpZiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICBvbkxvYWQodGV4dHVyZUFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChnbHRmSW1hZ2UuaGFzT3duUHJvcGVydHkoJ3VyaScpKSB7XG4gICAgICAgICAgICAgICAgLy8gdXJpIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgIGlmIChpc0RhdGFVUkkoZ2x0ZkltYWdlLnVyaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9hZFRleHR1cmUoZ2x0ZkltYWdlLnVyaSwgbnVsbCwgZ2V0RGF0YVVSSU1pbWVUeXBlKGdsdGZJbWFnZS51cmkpLCBudWxsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZShwYXRoLmpvaW4odXJsQmFzZSwgZ2x0ZkltYWdlLnVyaSksIG51bGwsIG51bGwsIHsgY3Jvc3NPcmlnaW46ICdhbm9ueW1vdXMnIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCdidWZmZXJWaWV3JykgJiYgZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCdtaW1lVHlwZScpKSB7XG4gICAgICAgICAgICAgICAgLy8gYnVmZmVydmlld1xuICAgICAgICAgICAgICAgIGxvYWRUZXh0dXJlKG51bGwsIGJ1ZmZlclZpZXdzW2dsdGZJbWFnZS5idWZmZXJWaWV3XSwgZ2x0ZkltYWdlLm1pbWVUeXBlLCBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gZmFpbFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGltYWdlIGZvdW5kIGluIGdsdGYgKG5laXRoZXIgdXJpIG9yIGJ1ZmZlclZpZXcgZm91bmQpLiBpbmRleD0nICsgaW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBsb2FkIHRleHR1cmVzIHVzaW5nIHRoZSBhc3NldCBzeXN0ZW1cbmNvbnN0IGxvYWRUZXh0dXJlc0FzeW5jID0gZnVuY3Rpb24gKGdsdGYsIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ2ltYWdlcycpIHx8IGdsdGYuaW1hZ2VzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAhZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgndGV4dHVyZXMnKSB8fCBnbHRmLnRleHR1cmVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBbXSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLnRleHR1cmUgJiYgb3B0aW9ucy50ZXh0dXJlLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy50ZXh0dXJlICYmIG9wdGlvbnMudGV4dHVyZS5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmVGV4dHVyZSwgZ2x0ZkltYWdlcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy50ZXh0dXJlICYmIG9wdGlvbnMudGV4dHVyZS5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IGFzc2V0cyA9IFtdOyAgICAgICAgLy8gb25lIHBlciBpbWFnZVxuICAgIGNvbnN0IHRleHR1cmVzID0gW107ICAgICAgLy8gbGlzdCBwZXIgaW1hZ2VcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLnRleHR1cmVzLmxlbmd0aDtcbiAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAodGV4dHVyZUluZGV4LCBpbWFnZUluZGV4KSB7XG4gICAgICAgIGlmICghdGV4dHVyZXNbaW1hZ2VJbmRleF0pIHtcbiAgICAgICAgICAgIHRleHR1cmVzW2ltYWdlSW5kZXhdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGV4dHVyZXNbaW1hZ2VJbmRleF0ucHVzaCh0ZXh0dXJlSW5kZXgpO1xuXG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgICAgICAgICB0ZXh0dXJlcy5mb3JFYWNoKGZ1bmN0aW9uICh0ZXh0dXJlTGlzdCwgaW1hZ2VJbmRleCkge1xuICAgICAgICAgICAgICAgIHRleHR1cmVMaXN0LmZvckVhY2goZnVuY3Rpb24gKHRleHR1cmVJbmRleCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4dHVyZUFzc2V0ID0gKGluZGV4ID09PSAwKSA/IGFzc2V0c1tpbWFnZUluZGV4XSA6IGNsb25lVGV4dHVyZUFzc2V0KGFzc2V0c1tpbWFnZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIGFwcGx5U2FtcGxlcih0ZXh0dXJlQXNzZXQucmVzb3VyY2UsIChnbHRmLnNhbXBsZXJzIHx8IFtdKVtnbHRmLnRleHR1cmVzW3RleHR1cmVJbmRleF0uc2FtcGxlcl0pO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbdGV4dHVyZUluZGV4XSA9IHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmLnRleHR1cmVzW3RleHR1cmVJbmRleF0sIHRleHR1cmVBc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYudGV4dHVyZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZlRleHR1cmUgPSBnbHRmLnRleHR1cmVzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZUZXh0dXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmVGV4dHVyZSwgZ2x0Zi5pbWFnZXMsIGZ1bmN0aW9uIChpLCBnbHRmVGV4dHVyZSwgZXJyLCBnbHRmSW1hZ2VJbmRleCkge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChnbHRmSW1hZ2VJbmRleCA9PT0gdW5kZWZpbmVkIHx8IGdsdGZJbWFnZUluZGV4ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGdsdGZJbWFnZUluZGV4ID0gZ2x0ZlRleHR1cmU/LmV4dGVuc2lvbnM/LktIUl90ZXh0dXJlX2Jhc2lzdT8uc291cmNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0ZkltYWdlSW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZkltYWdlSW5kZXggPSBnbHRmVGV4dHVyZS5zb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRzW2dsdGZJbWFnZUluZGV4XSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpbWFnZSBoYXMgYWxyZWFkeSBiZWVuIGxvYWRlZFxuICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgZ2x0ZkltYWdlSW5kZXgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcnN0IG9jY2N1cnJlbmNlLCBsb2FkIGl0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZJbWFnZSA9IGdsdGYuaW1hZ2VzW2dsdGZJbWFnZUluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgbG9hZEltYWdlQXN5bmMoZ2x0ZkltYWdlLCBpLCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHRleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0c1tnbHRmSW1hZ2VJbmRleF0gPSB0ZXh0dXJlQXNzZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25Mb2FkKGksIGdsdGZJbWFnZUluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQobnVsbCwgaSwgZ2x0ZlRleHR1cmUpKTtcbiAgICB9XG59O1xuXG4vLyBsb2FkIGdsdGYgYnVmZmVycyBhc3luY2hyb25vdXNseSwgcmV0dXJuaW5nIHRoZW0gaW4gdGhlIGNhbGxiYWNrXG5jb25zdCBsb2FkQnVmZmVyc0FzeW5jID0gZnVuY3Rpb24gKGdsdGYsIGJpbmFyeUNodW5rLCB1cmxCYXNlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgaWYgKCFnbHRmLmJ1ZmZlcnMgfHwgZ2x0Zi5idWZmZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXIgJiYgb3B0aW9ucy5idWZmZXIucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlciAmJiBvcHRpb25zLmJ1ZmZlci5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmQnVmZmVyLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlciAmJiBvcHRpb25zLmJ1ZmZlci5wb3N0cHJvY2VzcztcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLmJ1ZmZlcnMubGVuZ3RoO1xuICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uIChpbmRleCwgYnVmZmVyKSB7XG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBidWZmZXI7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zi5idWZmZXJzW2luZGV4XSwgYnVmZmVyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoLS1yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbHRmLmJ1ZmZlcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlciA9IGdsdGYuYnVmZmVyc1tpXTtcblxuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyLCBmdW5jdGlvbiAoaSwgZ2x0ZkJ1ZmZlciwgZXJyLCBhcnJheUJ1ZmZlcikgeyAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhcnJheUJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCBuZXcgVWludDhBcnJheShhcnJheUJ1ZmZlcikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0ZkJ1ZmZlci5oYXNPd25Qcm9wZXJ0eSgndXJpJykpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzRGF0YVVSSShnbHRmQnVmZmVyLnVyaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgYmFzZTY0IHRvIHJhdyBiaW5hcnkgZGF0YSBoZWxkIGluIGEgc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBkb2Vzbid0IGhhbmRsZSBVUkxFbmNvZGVkIERhdGFVUklzIC0gc2VlIFNPIGFuc3dlciAjNjg1MDI3NiBmb3IgY29kZSB0aGF0IGRvZXMgdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnl0ZVN0cmluZyA9IGF0b2IoZ2x0ZkJ1ZmZlci51cmkuc3BsaXQoJywnKVsxXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBhIHZpZXcgaW50byB0aGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiaW5hcnlBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ5dGVTdHJpbmcubGVuZ3RoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IHRoZSBieXRlcyBvZiB0aGUgYnVmZmVyIHRvIHRoZSBjb3JyZWN0IHZhbHVlc1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBieXRlU3RyaW5nLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluYXJ5QXJyYXlbal0gPSBieXRlU3RyaW5nLmNoYXJDb2RlQXQoaik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBiaW5hcnlBcnJheSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBodHRwLmdldChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoLmpvaW4odXJsQmFzZSwgZ2x0ZkJ1ZmZlci51cmkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgY2FjaGU6IHRydWUsIHJlc3BvbnNlVHlwZTogJ2FycmF5YnVmZmVyJywgcmV0cnk6IGZhbHNlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKGksIGVyciwgcmVzdWx0KSB7ICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbG9vcC1mdW5jXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgbmV3IFVpbnQ4QXJyYXkocmVzdWx0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQobnVsbCwgaSlcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBnbGIgYnVmZmVyIHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgYmluYXJ5Q2h1bmspO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKG51bGwsIGksIGdsdGZCdWZmZXIpKTtcbiAgICB9XG59O1xuXG4vLyBwYXJzZSB0aGUgZ2x0ZiBjaHVuaywgcmV0dXJucyB0aGUgZ2x0ZiBqc29uXG5jb25zdCBwYXJzZUdsdGYgPSBmdW5jdGlvbiAoZ2x0ZkNodW5rLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGRlY29kZUJpbmFyeVV0ZjggPSBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBUZXh0RGVjb2RlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoYXJyYXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHN0ciA9ICcnO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShhcnJheVtpXSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KGVzY2FwZShzdHIpKTtcbiAgICB9O1xuXG4gICAgY29uc3QgZ2x0ZiA9IEpTT04ucGFyc2UoZGVjb2RlQmluYXJ5VXRmOChnbHRmQ2h1bmspKTtcblxuICAgIC8vIGNoZWNrIGdsdGYgdmVyc2lvblxuICAgIGlmIChnbHRmLmFzc2V0ICYmIGdsdGYuYXNzZXQudmVyc2lvbiAmJiBwYXJzZUZsb2F0KGdsdGYuYXNzZXQudmVyc2lvbikgPCAyKSB7XG4gICAgICAgIGNhbGxiYWNrKGBJbnZhbGlkIGdsdGYgdmVyc2lvbi4gRXhwZWN0ZWQgdmVyc2lvbiAyLjAgb3IgYWJvdmUgYnV0IGZvdW5kIHZlcnNpb24gJyR7Z2x0Zi5hc3NldC52ZXJzaW9ufScuYCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBjaGVjayByZXF1aXJlZCBleHRlbnNpb25zXG4gICAgY29uc3QgZXh0ZW5zaW9uc1JlcXVpcmVkID0gZ2x0Zj8uZXh0ZW5zaW9uc1JlcXVpcmVkIHx8IFtdO1xuICAgIGlmICghZHJhY29EZWNvZGVySW5zdGFuY2UgJiYgIWdldEdsb2JhbERyYWNvRGVjb2Rlck1vZHVsZSgpICYmIGV4dGVuc2lvbnNSZXF1aXJlZC5pbmRleE9mKCdLSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbicpICE9PSAtMSkge1xuICAgICAgICBXYXNtTW9kdWxlLmdldEluc3RhbmNlKCdEcmFjb0RlY29kZXJNb2R1bGUnLCAoaW5zdGFuY2UpID0+IHtcbiAgICAgICAgICAgIGRyYWNvRGVjb2Rlckluc3RhbmNlID0gaW5zdGFuY2U7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBnbHRmKTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgZ2x0Zik7XG4gICAgfVxufTtcblxuLy8gcGFyc2UgZ2xiIGRhdGEsIHJldHVybnMgdGhlIGdsdGYgYW5kIGJpbmFyeSBjaHVua1xuY29uc3QgcGFyc2VHbGIgPSBmdW5jdGlvbiAoZ2xiRGF0YSwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBkYXRhID0gKGdsYkRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikgPyBuZXcgRGF0YVZpZXcoZ2xiRGF0YSkgOiBuZXcgRGF0YVZpZXcoZ2xiRGF0YS5idWZmZXIsIGdsYkRhdGEuYnl0ZU9mZnNldCwgZ2xiRGF0YS5ieXRlTGVuZ3RoKTtcblxuICAgIC8vIHJlYWQgaGVhZGVyXG4gICAgY29uc3QgbWFnaWMgPSBkYXRhLmdldFVpbnQzMigwLCB0cnVlKTtcbiAgICBjb25zdCB2ZXJzaW9uID0gZGF0YS5nZXRVaW50MzIoNCwgdHJ1ZSk7XG4gICAgY29uc3QgbGVuZ3RoID0gZGF0YS5nZXRVaW50MzIoOCwgdHJ1ZSk7XG5cbiAgICBpZiAobWFnaWMgIT09IDB4NDY1NDZDNjcpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbWFnaWMgbnVtYmVyIGZvdW5kIGluIGdsYiBoZWFkZXIuIEV4cGVjdGVkIDB4NDY1NDZDNjcsIGZvdW5kIDB4JyArIG1hZ2ljLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodmVyc2lvbiAhPT0gMikge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCB2ZXJzaW9uIG51bWJlciBmb3VuZCBpbiBnbGIgaGVhZGVyLiBFeHBlY3RlZCAyLCBmb3VuZCAnICsgdmVyc2lvbik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGVuZ3RoIDw9IDAgfHwgbGVuZ3RoID4gZGF0YS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGxlbmd0aCBmb3VuZCBpbiBnbGIgaGVhZGVyLiBGb3VuZCAnICsgbGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHJlYWQgY2h1bmtzXG4gICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgbGV0IG9mZnNldCA9IDEyO1xuICAgIHdoaWxlIChvZmZzZXQgPCBsZW5ndGgpIHtcbiAgICAgICAgY29uc3QgY2h1bmtMZW5ndGggPSBkYXRhLmdldFVpbnQzMihvZmZzZXQsIHRydWUpO1xuICAgICAgICBpZiAob2Zmc2V0ICsgY2h1bmtMZW5ndGggKyA4ID4gZGF0YS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY2h1bmsgbGVuZ3RoIGZvdW5kIGluIGdsYi4gRm91bmQgJyArIGNodW5rTGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaHVua1R5cGUgPSBkYXRhLmdldFVpbnQzMihvZmZzZXQgKyA0LCB0cnVlKTtcbiAgICAgICAgY29uc3QgY2h1bmtEYXRhID0gbmV3IFVpbnQ4QXJyYXkoZGF0YS5idWZmZXIsIGRhdGEuYnl0ZU9mZnNldCArIG9mZnNldCArIDgsIGNodW5rTGVuZ3RoKTtcbiAgICAgICAgY2h1bmtzLnB1c2goeyBsZW5ndGg6IGNodW5rTGVuZ3RoLCB0eXBlOiBjaHVua1R5cGUsIGRhdGE6IGNodW5rRGF0YSB9KTtcbiAgICAgICAgb2Zmc2V0ICs9IGNodW5rTGVuZ3RoICsgODtcbiAgICB9XG5cbiAgICBpZiAoY2h1bmtzLmxlbmd0aCAhPT0gMSAmJiBjaHVua3MubGVuZ3RoICE9PSAyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIG51bWJlciBvZiBjaHVua3MgZm91bmQgaW4gZ2xiIGZpbGUuJyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoY2h1bmtzWzBdLnR5cGUgIT09IDB4NEU0RjUzNEEpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgY2h1bmsgdHlwZSBmb3VuZCBpbiBnbGIgZmlsZS4gRXhwZWN0ZWQgMHg0RTRGNTM0QSwgZm91bmQgMHgnICsgY2h1bmtzWzBdLnR5cGUudG9TdHJpbmcoMTYpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaHVua3MubGVuZ3RoID4gMSAmJiBjaHVua3NbMV0udHlwZSAhPT0gMHgwMDRFNDk0Mikge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBjaHVuayB0eXBlIGZvdW5kIGluIGdsYiBmaWxlLiBFeHBlY3RlZCAweDAwNEU0OTQyLCBmb3VuZCAweCcgKyBjaHVua3NbMV0udHlwZS50b1N0cmluZygxNikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY2FsbGJhY2sobnVsbCwge1xuICAgICAgICBnbHRmQ2h1bms6IGNodW5rc1swXS5kYXRhLFxuICAgICAgICBiaW5hcnlDaHVuazogY2h1bmtzLmxlbmd0aCA9PT0gMiA/IGNodW5rc1sxXS5kYXRhIDogbnVsbFxuICAgIH0pO1xufTtcblxuLy8gcGFyc2UgdGhlIGNodW5rIG9mIGRhdGEsIHdoaWNoIGNhbiBiZSBnbGIgb3IgZ2x0ZlxuY29uc3QgcGFyc2VDaHVuayA9IGZ1bmN0aW9uIChmaWxlbmFtZSwgZGF0YSwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBoYXNHbGJIZWFkZXIgPSAoKSA9PiB7XG4gICAgICAgIC8vIGdsYiBmb3JtYXQgc3RhcnRzIHdpdGggJ2dsVEYnXG4gICAgICAgIGNvbnN0IHU4ID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG4gICAgICAgIHJldHVybiB1OFswXSA9PT0gMTAzICYmIHU4WzFdID09PSAxMDggJiYgdThbMl0gPT09IDg0ICYmIHU4WzNdID09PSA3MDtcbiAgICB9O1xuXG4gICAgaWYgKChmaWxlbmFtZSAmJiBmaWxlbmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcuZ2xiJykpIHx8IGhhc0dsYkhlYWRlcigpKSB7XG4gICAgICAgIHBhcnNlR2xiKGRhdGEsIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgICAgICBnbHRmQ2h1bms6IGRhdGEsXG4gICAgICAgICAgICBiaW5hcnlDaHVuazogbnVsbFxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG4vLyBjcmVhdGUgYnVmZmVyIHZpZXdzXG5jb25zdCBwYXJzZUJ1ZmZlclZpZXdzQXN5bmMgPSBmdW5jdGlvbiAoZ2x0ZiwgYnVmZmVycywgb3B0aW9ucywgY2FsbGJhY2spIHtcblxuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3NBc3luYyA9IChvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyVmlldyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcucHJvY2Vzc0FzeW5jKSB8fCBmdW5jdGlvbiAoZ2x0ZkJ1ZmZlclZpZXcsIGJ1ZmZlcnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgIH07XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyVmlldyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcucG9zdHByb2Nlc3M7XG5cbiAgICBsZXQgcmVtYWluaW5nID0gZ2x0Zi5idWZmZXJWaWV3cyA/IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoIDogMDtcblxuICAgIC8vIGhhbmRsZSBjYXNlIG9mIG5vIGJ1ZmZlcnNcbiAgICBpZiAoIXJlbWFpbmluZykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uIChpbmRleCwgYnVmZmVyVmlldykge1xuICAgICAgICBjb25zdCBnbHRmQnVmZmVyVmlldyA9IGdsdGYuYnVmZmVyVmlld3NbaW5kZXhdO1xuICAgICAgICBpZiAoZ2x0ZkJ1ZmZlclZpZXcuaGFzT3duUHJvcGVydHkoJ2J5dGVTdHJpZGUnKSkge1xuICAgICAgICAgICAgYnVmZmVyVmlldy5ieXRlU3RyaWRlID0gZ2x0ZkJ1ZmZlclZpZXcuYnl0ZVN0cmlkZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBidWZmZXJWaWV3O1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZCdWZmZXJWaWV3LCBidWZmZXJWaWV3KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoLS1yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbHRmLmJ1ZmZlclZpZXdzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGdsdGZCdWZmZXJWaWV3ID0gZ2x0Zi5idWZmZXJWaWV3c1tpXTtcblxuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQnVmZmVyVmlldyk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzQXN5bmMoZ2x0ZkJ1ZmZlclZpZXcsIGJ1ZmZlcnMsIGZ1bmN0aW9uIChpLCBnbHRmQnVmZmVyVmlldywgZXJyLCByZXN1bHQpIHsgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBvbkxvYWQoaSwgcmVzdWx0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gYnVmZmVyc1tnbHRmQnVmZmVyVmlldy5idWZmZXJdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHR5cGVkQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXIuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXIuYnl0ZU9mZnNldCArIChnbHRmQnVmZmVyVmlldy5ieXRlT2Zmc2V0IHx8IDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbHRmQnVmZmVyVmlldy5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBvbkxvYWQoaSwgdHlwZWRBcnJheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZChudWxsLCBpLCBnbHRmQnVmZmVyVmlldykpO1xuICAgIH1cbn07XG5cbi8vIC0tIEdsYlBhcnNlclxuY2xhc3MgR2xiUGFyc2VyIHtcbiAgICAvLyBwYXJzZSB0aGUgZ2x0ZiBvciBnbGIgZGF0YSBhc3luY2hyb25vdXNseSwgbG9hZGluZyBleHRlcm5hbCByZXNvdXJjZXNcbiAgICBzdGF0aWMgcGFyc2VBc3luYyhmaWxlbmFtZSwgdXJsQmFzZSwgZGF0YSwgZGV2aWNlLCByZWdpc3RyeSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgLy8gcGFyc2UgdGhlIGRhdGFcbiAgICAgICAgcGFyc2VDaHVuayhmaWxlbmFtZSwgZGF0YSwgZnVuY3Rpb24gKGVyciwgY2h1bmtzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHBhcnNlIGdsdGZcbiAgICAgICAgICAgIHBhcnNlR2x0ZihjaHVua3MuZ2x0ZkNodW5rLCBmdW5jdGlvbiAoZXJyLCBnbHRmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYXN5bmMgbG9hZCBleHRlcm5hbCBidWZmZXJzXG4gICAgICAgICAgICAgICAgbG9hZEJ1ZmZlcnNBc3luYyhnbHRmLCBjaHVua3MuYmluYXJ5Q2h1bmssIHVybEJhc2UsIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzeW5jIGxvYWQgYnVmZmVyIHZpZXdzXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlQnVmZmVyVmlld3NBc3luYyhnbHRmLCBidWZmZXJzLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCBidWZmZXJWaWV3cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3luYyBsb2FkIGltYWdlc1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9hZFRleHR1cmVzQXN5bmMoZ2x0ZiwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCB0ZXh0dXJlQXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlUmVzb3VyY2VzKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIHRleHR1cmVBc3NldHMsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBwYXJzZSB0aGUgZ2x0ZiBvciBnbGIgZGF0YSBzeW5jaHJvbm91c2x5LiBleHRlcm5hbCByZXNvdXJjZXMgKGJ1ZmZlcnMgYW5kIGltYWdlcykgYXJlIGlnbm9yZWQuXG4gICAgc3RhdGljIHBhcnNlKGZpbGVuYW1lLCBkYXRhLCBkZXZpY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG5cbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgeyB9O1xuXG4gICAgICAgIC8vIHBhcnNlIHRoZSBkYXRhXG4gICAgICAgIHBhcnNlQ2h1bmsoZmlsZW5hbWUsIGRhdGEsIGZ1bmN0aW9uIChlcnIsIGNodW5rcykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gcGFyc2UgZ2x0ZlxuICAgICAgICAgICAgICAgIHBhcnNlR2x0ZihjaHVua3MuZ2x0ZkNodW5rLCBmdW5jdGlvbiAoZXJyLCBnbHRmKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhcnNlIGJ1ZmZlciB2aWV3c1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VCdWZmZXJWaWV3c0FzeW5jKGdsdGYsIFtjaHVua3MuYmluYXJ5Q2h1bmtdLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCBidWZmZXJWaWV3cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSByZXNvdXJjZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlUmVzb3VyY2VzKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIFtdLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCByZXN1bHRfKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSByZXN1bHRfO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgYXNzZXRzLCBtYXhSZXRyaWVzKSB7XG4gICAgICAgIHRoaXMuX2RldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5fYXNzZXRzID0gYXNzZXRzO1xuICAgICAgICB0aGlzLl9kZWZhdWx0TWF0ZXJpYWwgPSBjcmVhdGVNYXRlcmlhbCh7XG4gICAgICAgICAgICBuYW1lOiAnZGVmYXVsdEdsYk1hdGVyaWFsJ1xuICAgICAgICB9LCBbXSk7XG4gICAgICAgIHRoaXMubWF4UmV0cmllcyA9IG1heFJldHJpZXM7XG4gICAgfVxuXG4gICAgX2dldFVybFdpdGhvdXRQYXJhbXModXJsKSB7XG4gICAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID49IDAgPyB1cmwuc3BsaXQoJz8nKVswXSA6IHVybDtcbiAgICB9XG5cbiAgICBsb2FkKHVybCwgY2FsbGJhY2ssIGFzc2V0KSB7XG4gICAgICAgIEFzc2V0LmZldGNoQXJyYXlCdWZmZXIodXJsLmxvYWQsIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIEdsYlBhcnNlci5wYXJzZUFzeW5jKFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nZXRVcmxXaXRob3V0UGFyYW1zKHVybC5vcmlnaW5hbCksXG4gICAgICAgICAgICAgICAgICAgIHBhdGguZXh0cmFjdFBhdGgodXJsLmxvYWQpLFxuICAgICAgICAgICAgICAgICAgICByZXN1bHQsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RldmljZSxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQucmVnaXN0cnksXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0Lm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJldHVybiBldmVyeXRoaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbmV3IEdsYkNvbnRhaW5lclJlc291cmNlKHJlc3VsdCwgYXNzZXQsIHRoaXMuX2Fzc2V0cywgdGhpcy5fZGVmYXVsdE1hdGVyaWFsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCBhc3NldCwgdGhpcy5tYXhSZXRyaWVzKTtcbiAgICB9XG5cbiAgICBvcGVuKHVybCwgZGF0YSwgYXNzZXQpIHtcbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuXG4gICAgcGF0Y2goYXNzZXQsIGFzc2V0cykge1xuXG4gICAgfVxufVxuXG5leHBvcnQgeyBHbGJQYXJzZXIgfTtcbiJdLCJuYW1lcyI6WyJkcmFjb0RlY29kZXJJbnN0YW5jZSIsImdldEdsb2JhbERyYWNvRGVjb2Rlck1vZHVsZSIsIndpbmRvdyIsIkRyYWNvRGVjb2Rlck1vZHVsZSIsIkdsYlJlc291cmNlcyIsImNvbnN0cnVjdG9yIiwiZ2x0ZiIsIm5vZGVzIiwic2NlbmVzIiwiYW5pbWF0aW9ucyIsInRleHR1cmVzIiwibWF0ZXJpYWxzIiwidmFyaWFudHMiLCJtZXNoVmFyaWFudHMiLCJtZXNoRGVmYXVsdE1hdGVyaWFscyIsInJlbmRlcnMiLCJza2lucyIsImxpZ2h0cyIsImNhbWVyYXMiLCJkZXN0cm95IiwiZm9yRWFjaCIsInJlbmRlciIsIm1lc2hlcyIsImlzRGF0YVVSSSIsInVyaSIsInRlc3QiLCJnZXREYXRhVVJJTWltZVR5cGUiLCJzdWJzdHJpbmciLCJpbmRleE9mIiwiZ2V0TnVtQ29tcG9uZW50cyIsImFjY2Vzc29yVHlwZSIsImdldENvbXBvbmVudFR5cGUiLCJjb21wb25lbnRUeXBlIiwiVFlQRV9JTlQ4IiwiVFlQRV9VSU5UOCIsIlRZUEVfSU5UMTYiLCJUWVBFX1VJTlQxNiIsIlRZUEVfSU5UMzIiLCJUWVBFX1VJTlQzMiIsIlRZUEVfRkxPQVQzMiIsImdldENvbXBvbmVudFNpemVJbkJ5dGVzIiwiZ2V0Q29tcG9uZW50RGF0YVR5cGUiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiSW50MTZBcnJheSIsIlVpbnQxNkFycmF5IiwiSW50MzJBcnJheSIsIlVpbnQzMkFycmF5IiwiRmxvYXQzMkFycmF5IiwiZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAiLCJTRU1BTlRJQ19QT1NJVElPTiIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX1RBTkdFTlQiLCJTRU1BTlRJQ19DT0xPUiIsIlNFTUFOVElDX0JMRU5ESU5ESUNFUyIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwiU0VNQU5USUNfVEVYQ09PUkQxIiwiU0VNQU5USUNfVEVYQ09PUkQyIiwiU0VNQU5USUNfVEVYQ09PUkQzIiwiU0VNQU5USUNfVEVYQ09PUkQ0IiwiU0VNQU5USUNfVEVYQ09PUkQ1IiwiU0VNQU5USUNfVEVYQ09PUkQ2IiwiU0VNQU5USUNfVEVYQ09PUkQ3IiwiZ2V0RGVxdWFudGl6ZUZ1bmMiLCJzcmNUeXBlIiwieCIsIk1hdGgiLCJtYXgiLCJkZXF1YW50aXplQXJyYXkiLCJkc3RBcnJheSIsInNyY0FycmF5IiwiY29udkZ1bmMiLCJsZW4iLCJsZW5ndGgiLCJpIiwiZ2V0QWNjZXNzb3JEYXRhIiwiZ2x0ZkFjY2Vzc29yIiwiYnVmZmVyVmlld3MiLCJmbGF0dGVuIiwibnVtQ29tcG9uZW50cyIsInR5cGUiLCJkYXRhVHlwZSIsImJ1ZmZlclZpZXciLCJyZXN1bHQiLCJzcGFyc2UiLCJpbmRpY2VzQWNjZXNzb3IiLCJjb3VudCIsImluZGljZXMiLCJPYmplY3QiLCJhc3NpZ24iLCJ2YWx1ZXNBY2Nlc3NvciIsInNjYWxhciIsInZhbHVlcyIsImhhc093blByb3BlcnR5IiwiYmFzZUFjY2Vzc29yIiwiYnl0ZU9mZnNldCIsInNsaWNlIiwidGFyZ2V0SW5kZXgiLCJqIiwiYnl0ZXNQZXJFbGVtZW50IiwiQllURVNfUEVSX0VMRU1FTlQiLCJzdG9yYWdlIiwiQXJyYXlCdWZmZXIiLCJ0bXBBcnJheSIsImRzdE9mZnNldCIsInNyY09mZnNldCIsImJ5dGVTdHJpZGUiLCJiIiwiYnVmZmVyIiwiZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMiIsImRhdGEiLCJub3JtYWxpemVkIiwiZmxvYXQzMkRhdGEiLCJnZXRBY2Nlc3NvckJvdW5kaW5nQm94IiwibWluIiwiY3R5cGUiLCJCb3VuZGluZ0JveCIsIlZlYzMiLCJnZXRQcmltaXRpdmVUeXBlIiwicHJpbWl0aXZlIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsIm1vZGUiLCJQUklNSVRJVkVfUE9JTlRTIiwiUFJJTUlUSVZFX0xJTkVTIiwiUFJJTUlUSVZFX0xJTkVMT09QIiwiUFJJTUlUSVZFX0xJTkVTVFJJUCIsIlBSSU1JVElWRV9UUklTVFJJUCIsIlBSSU1JVElWRV9UUklGQU4iLCJnZW5lcmF0ZUluZGljZXMiLCJudW1WZXJ0aWNlcyIsImR1bW15SW5kaWNlcyIsImdlbmVyYXRlTm9ybWFscyIsInNvdXJjZURlc2MiLCJwIiwiY29tcG9uZW50cyIsInBvc2l0aW9ucyIsInNpemUiLCJzdHJpZGUiLCJzcmNTdHJpZGUiLCJ0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZSIsInNyYyIsInR5cGVkQXJyYXlUeXBlcyIsIm9mZnNldCIsIm5vcm1hbHNUZW1wIiwiY2FsY3VsYXRlTm9ybWFscyIsIm5vcm1hbHMiLCJzZXQiLCJmbGlwVGV4Q29vcmRWcyIsInZlcnRleEJ1ZmZlciIsImZsb2F0T2Zmc2V0cyIsInNob3J0T2Zmc2V0cyIsImJ5dGVPZmZzZXRzIiwiZm9ybWF0IiwiZWxlbWVudHMiLCJlbGVtZW50IiwibmFtZSIsInB1c2giLCJmbGlwIiwib2Zmc2V0cyIsIm9uZSIsInR5cGVkQXJyYXkiLCJpbmRleCIsImNsb25lVGV4dHVyZSIsInRleHR1cmUiLCJzaGFsbG93Q29weUxldmVscyIsIm1pcCIsIl9sZXZlbHMiLCJsZXZlbCIsImN1YmVtYXAiLCJmYWNlIiwiVGV4dHVyZSIsImRldmljZSIsImNsb25lVGV4dHVyZUFzc2V0IiwiQXNzZXQiLCJmaWxlIiwib3B0aW9ucyIsImxvYWRlZCIsInJlc291cmNlIiwicmVnaXN0cnkiLCJhZGQiLCJjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbCIsImZsaXBWIiwicG9zaXRpb25EZXNjIiwidmVydGV4RGVzYyIsInNlbWFudGljIiwibm9ybWFsaXplIiwiZWxlbWVudE9yZGVyIiwic29ydCIsImxocyIsInJocyIsImxoc09yZGVyIiwicmhzT3JkZXIiLCJrIiwic291cmNlIiwidGFyZ2V0Iiwic291cmNlT2Zmc2V0IiwidmVydGV4Rm9ybWF0IiwiVmVydGV4Rm9ybWF0IiwiaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCIsIlZlcnRleEJ1ZmZlciIsIkJVRkZFUl9TVEFUSUMiLCJ2ZXJ0ZXhEYXRhIiwibG9jayIsInRhcmdldEFycmF5Iiwic291cmNlQXJyYXkiLCJ0YXJnZXRTdHJpZGUiLCJzb3VyY2VTdHJpZGUiLCJkc3QiLCJrZW5kIiwiZmxvb3IiLCJ1bmxvY2siLCJjcmVhdGVWZXJ0ZXhCdWZmZXIiLCJhdHRyaWJ1dGVzIiwiYWNjZXNzb3JzIiwidmVydGV4QnVmZmVyRGljdCIsInVzZUF0dHJpYnV0ZXMiLCJhdHRyaWJJZHMiLCJhdHRyaWIiLCJ2YktleSIsImpvaW4iLCJ2YiIsImFjY2Vzc29yIiwiYWNjZXNzb3JEYXRhIiwiY3JlYXRlVmVydGV4QnVmZmVyRHJhY28iLCJvdXRwdXRHZW9tZXRyeSIsImV4dERyYWNvIiwiZGVjb2RlciIsImRlY29kZXJNb2R1bGUiLCJudW1Qb2ludHMiLCJudW1fcG9pbnRzIiwiZXh0cmFjdERyYWNvQXR0cmlidXRlSW5mbyIsInVuaXF1ZUlkIiwiYXR0cmlidXRlIiwiR2V0QXR0cmlidXRlQnlVbmlxdWVJZCIsIm51bVZhbHVlcyIsIm51bV9jb21wb25lbnRzIiwiZHJhY29Gb3JtYXQiLCJkYXRhX3R5cGUiLCJwdHIiLCJjb21wb25lbnRTaXplSW5CeXRlcyIsInN0b3JhZ2VUeXBlIiwiRFRfVUlOVDgiLCJfbWFsbG9jIiwiR2V0QXR0cmlidXRlRGF0YUFycmF5Rm9yQWxsUG9pbnRzIiwiSEVBUFU4IiwiRFRfVUlOVDE2IiwiSEVBUFUxNiIsIkRUX0ZMT0FUMzIiLCJIRUFQRjMyIiwiX2ZyZWUiLCJhdHRyaWJ1dGVJbmZvIiwiY3JlYXRlU2tpbiIsImdsdGZTa2luIiwiZ2xiU2tpbnMiLCJiaW5kTWF0cml4Iiwiam9pbnRzIiwibnVtSm9pbnRzIiwiaWJwIiwiaW52ZXJzZUJpbmRNYXRyaWNlcyIsImlibURhdGEiLCJpYm1WYWx1ZXMiLCJNYXQ0IiwiYm9uZU5hbWVzIiwia2V5Iiwic2tpbiIsImdldCIsIlNraW4iLCJ0ZW1wTWF0IiwidGVtcFZlYyIsImNyZWF0ZU1lc2giLCJnbHRmTWVzaCIsImNhbGxiYWNrIiwiYXNzZXRPcHRpb25zIiwicHJpbWl0aXZlcyIsInByaW1pdGl2ZVR5cGUiLCJudW1JbmRpY2VzIiwiY2FuVXNlTW9ycGgiLCJleHRlbnNpb25zIiwiS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb24iLCJ1aW50OEJ1ZmZlciIsIkRlY29kZXJCdWZmZXIiLCJJbml0IiwiRGVjb2RlciIsImdlb21ldHJ5VHlwZSIsIkdldEVuY29kZWRHZW9tZXRyeVR5cGUiLCJzdGF0dXMiLCJQT0lOVF9DTE9VRCIsIlBvaW50Q2xvdWQiLCJEZWNvZGVCdWZmZXJUb1BvaW50Q2xvdWQiLCJUUklBTkdVTEFSX01FU0giLCJNZXNoIiwiRGVjb2RlQnVmZmVyVG9NZXNoIiwiSU5WQUxJRF9HRU9NRVRSWV9UWVBFIiwib2siLCJlcnJvcl9tc2ciLCJudW1GYWNlcyIsIm51bV9mYWNlcyIsImJpdDMyIiwiZGF0YVNpemUiLCJHZXRUcmlhbmdsZXNVSW50MzJBcnJheSIsIkhFQVBVMzIiLCJHZXRUcmlhbmdsZXNVSW50MTZBcnJheSIsIkRlYnVnIiwid2FybiIsIm1lc2giLCJiYXNlIiwiaW5kZXhlZCIsImluZGV4Rm9ybWF0IiwiSU5ERVhGT1JNQVRfVUlOVDgiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJleHRVaW50RWxlbWVudCIsImNvbnNvbGUiLCJpbmRleEJ1ZmZlciIsIkluZGV4QnVmZmVyIiwiS0hSX21hdGVyaWFsc192YXJpYW50cyIsInRlbXBNYXBwaW5nIiwibWFwcGluZ3MiLCJtYXBwaW5nIiwidmFyaWFudCIsIm1hdGVyaWFsIiwiaWQiLCJQT1NJVElPTiIsImFhYmIiLCJ0YXJnZXRzIiwiZGVsdGFQb3NpdGlvbnMiLCJkZWx0YVBvc2l0aW9uc1R5cGUiLCJOT1JNQUwiLCJkZWx0YU5vcm1hbHMiLCJkZWx0YU5vcm1hbHNUeXBlIiwiZXh0cmFzIiwidGFyZ2V0TmFtZXMiLCJ0b1N0cmluZyIsImRlZmF1bHRXZWlnaHQiLCJ3ZWlnaHRzIiwicHJlc2VydmVEYXRhIiwibW9ycGhQcmVzZXJ2ZURhdGEiLCJNb3JwaFRhcmdldCIsIm1vcnBoIiwiTW9ycGgiLCJleHRyYWN0VGV4dHVyZVRyYW5zZm9ybSIsIm1hcHMiLCJtYXAiLCJ0ZXhDb29yZCIsInplcm9zIiwib25lcyIsInRleHR1cmVUcmFuc2Zvcm0iLCJLSFJfdGV4dHVyZV90cmFuc2Zvcm0iLCJzY2FsZSIsInJvdGF0aW9uIiwibWF0aCIsIlJBRF9UT19ERUciLCJ0aWxpbmdWZWMiLCJWZWMyIiwib2Zmc2V0VmVjIiwiZXh0ZW5zaW9uUGJyU3BlY0dsb3NzaW5lc3MiLCJjb2xvciIsImRpZmZ1c2VGYWN0b3IiLCJkaWZmdXNlIiwicG93Iiwib3BhY2l0eSIsImRpZmZ1c2VUZXh0dXJlIiwiZGlmZnVzZU1hcCIsImRpZmZ1c2VNYXBDaGFubmVsIiwib3BhY2l0eU1hcCIsIm9wYWNpdHlNYXBDaGFubmVsIiwidXNlTWV0YWxuZXNzIiwic3BlY3VsYXJGYWN0b3IiLCJzcGVjdWxhciIsInNoaW5pbmVzcyIsImdsb3NzaW5lc3NGYWN0b3IiLCJzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlIiwic3BlY3VsYXJFbmNvZGluZyIsInNwZWN1bGFyTWFwIiwiZ2xvc3NNYXAiLCJzcGVjdWxhck1hcENoYW5uZWwiLCJnbG9zc01hcENoYW5uZWwiLCJleHRlbnNpb25DbGVhckNvYXQiLCJjbGVhckNvYXQiLCJjbGVhcmNvYXRGYWN0b3IiLCJjbGVhcmNvYXRUZXh0dXJlIiwiY2xlYXJDb2F0TWFwIiwiY2xlYXJDb2F0TWFwQ2hhbm5lbCIsImNsZWFyQ29hdEdsb3NzaW5lc3MiLCJjbGVhcmNvYXRSb3VnaG5lc3NGYWN0b3IiLCJjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlIiwiY2xlYXJDb2F0R2xvc3NNYXAiLCJjbGVhckNvYXRHbG9zc01hcENoYW5uZWwiLCJjbGVhcmNvYXROb3JtYWxUZXh0dXJlIiwiY2xlYXJDb2F0Tm9ybWFsTWFwIiwiY2xlYXJDb2F0QnVtcGluZXNzIiwiY2xlYXJDb2F0R2xvc3NDaHVuayIsImNodW5rcyIsImNsZWFyQ29hdEdsb3NzUFMiLCJleHRlbnNpb25VbmxpdCIsInVzZUxpZ2h0aW5nIiwiZW1pc3NpdmUiLCJjb3B5IiwiZW1pc3NpdmVUaW50IiwiZGlmZnVzZVRpbnQiLCJlbWlzc2l2ZU1hcCIsImVtaXNzaXZlTWFwVXYiLCJkaWZmdXNlTWFwVXYiLCJlbWlzc2l2ZU1hcFRpbGluZyIsImRpZmZ1c2VNYXBUaWxpbmciLCJlbWlzc2l2ZU1hcE9mZnNldCIsImRpZmZ1c2VNYXBPZmZzZXQiLCJlbWlzc2l2ZU1hcFJvdGF0aW9uIiwiZGlmZnVzZU1hcFJvdGF0aW9uIiwiZW1pc3NpdmVNYXBDaGFubmVsIiwiZW1pc3NpdmVWZXJ0ZXhDb2xvciIsImRpZmZ1c2VWZXJ0ZXhDb2xvciIsImVtaXNzaXZlVmVydGV4Q29sb3JDaGFubmVsIiwiZGlmZnVzZVZlcnRleENvbG9yQ2hhbm5lbCIsImV4dGVuc2lvblNwZWN1bGFyIiwidXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciIsInNwZWN1bGFyQ29sb3JUZXh0dXJlIiwic3BlY3VsYXJDb2xvckZhY3RvciIsInNwZWN1bGFyaXR5RmFjdG9yIiwic3BlY3VsYXJpdHlGYWN0b3JNYXBDaGFubmVsIiwic3BlY3VsYXJpdHlGYWN0b3JNYXAiLCJzcGVjdWxhclRleHR1cmUiLCJleHRlbnNpb25Jb3IiLCJyZWZyYWN0aW9uSW5kZXgiLCJpb3IiLCJleHRlbnNpb25UcmFuc21pc3Npb24iLCJibGVuZFR5cGUiLCJCTEVORF9OT1JNQUwiLCJ1c2VEeW5hbWljUmVmcmFjdGlvbiIsInJlZnJhY3Rpb24iLCJ0cmFuc21pc3Npb25GYWN0b3IiLCJyZWZyYWN0aW9uTWFwQ2hhbm5lbCIsInJlZnJhY3Rpb25NYXAiLCJ0cmFuc21pc3Npb25UZXh0dXJlIiwiZXh0ZW5zaW9uU2hlZW4iLCJ1c2VTaGVlbiIsInNoZWVuQ29sb3JGYWN0b3IiLCJzaGVlbiIsInNoZWVuTWFwIiwic2hlZW5Db2xvclRleHR1cmUiLCJzaGVlbkVuY29kaW5nIiwic2hlZW5HbG9zc2luZXNzIiwic2hlZW5Sb3VnaG5lc3NGYWN0b3IiLCJzaGVlbkdsb3NzaW5lc3NNYXAiLCJzaGVlblJvdWdobmVzc1RleHR1cmUiLCJzaGVlbkdsb3NzaW5lc3NNYXBDaGFubmVsIiwic2hlZW5HbG9zc0NodW5rIiwic2hlZW5HbG9zc1BTIiwiZXh0ZW5zaW9uVm9sdW1lIiwidGhpY2tuZXNzIiwidGhpY2tuZXNzRmFjdG9yIiwidGhpY2tuZXNzTWFwIiwidGhpY2tuZXNzVGV4dHVyZSIsImF0dGVudWF0aW9uRGlzdGFuY2UiLCJhdHRlbnVhdGlvbkNvbG9yIiwiYXR0ZW51YXRpb24iLCJleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoIiwiZW1pc3NpdmVJbnRlbnNpdHkiLCJlbWlzc2l2ZVN0cmVuZ3RoIiwiZXh0ZW5zaW9uSXJpZGVzY2VuY2UiLCJ1c2VJcmlkZXNjZW5jZSIsImlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2VGYWN0b3IiLCJpcmlkZXNjZW5jZU1hcENoYW5uZWwiLCJpcmlkZXNjZW5jZU1hcCIsImlyaWRlc2NlbmNlVGV4dHVyZSIsImlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4IiwiaXJpZGVzY2VuY2VJb3IiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01pbiIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bSIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4IiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXhpbXVtIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXAiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUiLCJjcmVhdGVNYXRlcmlhbCIsImdsdGZNYXRlcmlhbCIsImdsb3NzQ2h1bmsiLCJTdGFuZGFyZE1hdGVyaWFsIiwib2NjbHVkZVNwZWN1bGFyIiwiU1BFQ09DQ19BTyIsInNwZWN1bGFyVGludCIsInNwZWN1bGFyVmVydGV4Q29sb3IiLCJBUElWZXJzaW9uIiwiQ0hVTktBUElfMV81OCIsInBickRhdGEiLCJwYnJNZXRhbGxpY1JvdWdobmVzcyIsImJhc2VDb2xvckZhY3RvciIsImJhc2VDb2xvclRleHR1cmUiLCJtZXRhbG5lc3MiLCJtZXRhbGxpY0ZhY3RvciIsInJvdWdobmVzc0ZhY3RvciIsIm1ldGFsbGljUm91Z2huZXNzVGV4dHVyZSIsIm1ldGFsbmVzc01hcCIsIm1ldGFsbmVzc01hcENoYW5uZWwiLCJnbG9zc1BTIiwibm9ybWFsVGV4dHVyZSIsIm5vcm1hbE1hcCIsImJ1bXBpbmVzcyIsIm9jY2x1c2lvblRleHR1cmUiLCJhb01hcCIsImFvTWFwQ2hhbm5lbCIsImVtaXNzaXZlRmFjdG9yIiwiZW1pc3NpdmVUZXh0dXJlIiwiYWxwaGFNb2RlIiwiQkxFTkRfTk9ORSIsImFscGhhVGVzdCIsImFscGhhQ3V0b2ZmIiwiZGVwdGhXcml0ZSIsInR3b1NpZGVkTGlnaHRpbmciLCJkb3VibGVTaWRlZCIsImN1bGwiLCJDVUxMRkFDRV9OT05FIiwiQ1VMTEZBQ0VfQkFDSyIsImV4dGVuc2lvbkZ1bmMiLCJ1bmRlZmluZWQiLCJ1cGRhdGUiLCJjcmVhdGVBbmltYXRpb24iLCJnbHRmQW5pbWF0aW9uIiwiYW5pbWF0aW9uSW5kZXgiLCJnbHRmQWNjZXNzb3JzIiwiY3JlYXRlQW5pbURhdGEiLCJBbmltRGF0YSIsImludGVycE1hcCIsIklOVEVSUE9MQVRJT05fU1RFUCIsIklOVEVSUE9MQVRJT05fTElORUFSIiwiSU5URVJQT0xBVElPTl9DVUJJQyIsImlucHV0TWFwIiwib3V0cHV0TWFwIiwiY3VydmVNYXAiLCJvdXRwdXRDb3VudGVyIiwic2FtcGxlcnMiLCJzYW1wbGVyIiwiaW5wdXQiLCJvdXRwdXQiLCJpbnRlcnBvbGF0aW9uIiwiY3VydmUiLCJwYXRocyIsInF1YXRBcnJheXMiLCJ0cmFuc2Zvcm1TY2hlbWEiLCJjb25zdHJ1Y3ROb2RlUGF0aCIsIm5vZGUiLCJwYXRoIiwidW5zaGlmdCIsInBhcmVudCIsInJldHJpZXZlV2VpZ2h0TmFtZSIsIm5vZGVOYW1lIiwid2VpZ2h0SW5kZXgiLCJjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyIsImVudGl0eVBhdGgiLCJtb3JwaFRhcmdldENvdW50Iiwia2V5ZnJhbWVDb3VudCIsIm1vcnBoVGFyZ2V0T3V0cHV0IiwibW9ycGhDdXJ2ZSIsImNvbXBvbmVudCIsInByb3BlcnR5UGF0aCIsImNoYW5uZWxzIiwiY2hhbm5lbCIsInN0YXJ0c1dpdGgiLCJpbnB1dHMiLCJvdXRwdXRzIiwiY3VydmVzIiwiaW5wdXRLZXkiLCJvdXRwdXRLZXkiLCJjdXJ2ZUtleSIsImN1cnZlRGF0YSIsIkFuaW1DdXJ2ZSIsInByZXZJbmRleCIsImQiLCJkcCIsImR1cmF0aW9uIiwiX2RhdGEiLCJBbmltVHJhY2siLCJjcmVhdGVOb2RlIiwiZ2x0Zk5vZGUiLCJub2RlSW5kZXgiLCJlbnRpdHkiLCJHcmFwaE5vZGUiLCJtYXRyaXgiLCJnZXRUcmFuc2xhdGlvbiIsInNldExvY2FsUG9zaXRpb24iLCJnZXRFdWxlckFuZ2xlcyIsInNldExvY2FsRXVsZXJBbmdsZXMiLCJnZXRTY2FsZSIsInNldExvY2FsU2NhbGUiLCJyIiwic2V0TG9jYWxSb3RhdGlvbiIsInQiLCJ0cmFuc2xhdGlvbiIsInMiLCJjcmVhdGVDYW1lcmEiLCJnbHRmQ2FtZXJhIiwicHJvamVjdGlvbiIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsImdsdGZQcm9wZXJ0aWVzIiwib3J0aG9ncmFwaGljIiwicGVyc3BlY3RpdmUiLCJjb21wb25lbnREYXRhIiwiZW5hYmxlZCIsIm5lYXJDbGlwIiwiem5lYXIiLCJhc3BlY3RSYXRpb01vZGUiLCJBU1BFQ1RfQVVUTyIsInpmYXIiLCJmYXJDbGlwIiwib3J0aG9IZWlnaHQiLCJ5bWFnIiwiQVNQRUNUX01BTlVBTCIsImFzcGVjdFJhdGlvIiwieG1hZyIsImZvdiIsInlmb3YiLCJjYW1lcmFFbnRpdHkiLCJFbnRpdHkiLCJhZGRDb21wb25lbnQiLCJjcmVhdGVMaWdodCIsImdsdGZMaWdodCIsImxpZ2h0UHJvcHMiLCJDb2xvciIsIldISVRFIiwicmFuZ2UiLCJmYWxsb2ZmTW9kZSIsIkxJR0hURkFMTE9GRl9JTlZFUlNFU1FVQVJFRCIsImludGVuc2l0eSIsImNsYW1wIiwiaW5uZXJDb25lQW5nbGUiLCJzcG90Iiwib3V0ZXJDb25lQW5nbGUiLCJQSSIsImx1bWluYW5jZSIsIkxpZ2h0IiwiZ2V0TGlnaHRVbml0Q29udmVyc2lvbiIsImxpZ2h0VHlwZXMiLCJsaWdodEVudGl0eSIsInJvdGF0ZUxvY2FsIiwiY3JlYXRlU2tpbnMiLCJNYXAiLCJjcmVhdGVNZXNoZXMiLCJjcmVhdGVNYXRlcmlhbHMiLCJwcmVwcm9jZXNzIiwicHJvY2VzcyIsInBvc3Rwcm9jZXNzIiwiY3JlYXRlVmFyaWFudHMiLCJjcmVhdGVBbmltYXRpb25zIiwiYW5pbWF0aW9uIiwiY3JlYXRlTm9kZXMiLCJ1bmlxdWVOYW1lcyIsImNoaWxkcmVuIiwiY2hpbGQiLCJhZGRDaGlsZCIsImNyZWF0ZVNjZW5lcyIsInNjZW5lIiwic2NlbmVSb290IiwibiIsImNoaWxkTm9kZSIsImNyZWF0ZUNhbWVyYXMiLCJjYW1lcmEiLCJjcmVhdGVMaWdodHMiLCJLSFJfbGlnaHRzX3B1bmN0dWFsIiwiZ2x0ZkxpZ2h0cyIsImxpZ2h0IiwibGlnaHRJbmRleCIsImxpbmtTa2lucyIsIm1lc2hHcm91cCIsImNyZWF0ZVJlc291cmNlcyIsInRleHR1cmVBc3NldHMiLCJnbG9iYWwiLCJhc3NldCIsImdlbmVyYXRvciIsInRleHR1cmVBc3NldCIsIlJlbmRlciIsImFwcGx5U2FtcGxlciIsImdsdGZTYW1wbGVyIiwiZ2V0RmlsdGVyIiwiZmlsdGVyIiwiZGVmYXVsdFZhbHVlIiwiRklMVEVSX05FQVJFU1QiLCJGSUxURVJfTElORUFSIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsImdldFdyYXAiLCJ3cmFwIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19NSVJST1JFRF9SRVBFQVQiLCJBRERSRVNTX1JFUEVBVCIsIm1pbkZpbHRlciIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwid3JhcFMiLCJhZGRyZXNzViIsIndyYXBUIiwiZ2x0ZlRleHR1cmVVbmlxdWVJZCIsImxvYWRJbWFnZUFzeW5jIiwiZ2x0ZkltYWdlIiwidXJsQmFzZSIsImltYWdlIiwicHJvY2Vzc0FzeW5jIiwib25Mb2FkIiwibWltZVR5cGVGaWxlRXh0ZW5zaW9ucyIsImxvYWRUZXh0dXJlIiwidXJsIiwibWltZVR5cGUiLCJjb250ZW50cyIsImV4dGVuc2lvbiIsImZpbGVuYW1lIiwib24iLCJsb2FkIiwiZXJyIiwiY3Jvc3NPcmlnaW4iLCJsb2FkVGV4dHVyZXNBc3luYyIsImltYWdlcyIsImdsdGZUZXh0dXJlIiwiZ2x0ZkltYWdlcyIsImFzc2V0cyIsInJlbWFpbmluZyIsInRleHR1cmVJbmRleCIsImltYWdlSW5kZXgiLCJ0ZXh0dXJlTGlzdCIsImdsdGZJbWFnZUluZGV4IiwiS0hSX3RleHR1cmVfYmFzaXN1IiwiYmluZCIsImxvYWRCdWZmZXJzQXN5bmMiLCJiaW5hcnlDaHVuayIsImJ1ZmZlcnMiLCJnbHRmQnVmZmVyIiwiYXJyYXlCdWZmZXIiLCJieXRlU3RyaW5nIiwiYXRvYiIsInNwbGl0IiwiYmluYXJ5QXJyYXkiLCJjaGFyQ29kZUF0IiwiaHR0cCIsImNhY2hlIiwicmVzcG9uc2VUeXBlIiwicmV0cnkiLCJwYXJzZUdsdGYiLCJnbHRmQ2h1bmsiLCJkZWNvZGVCaW5hcnlVdGY4IiwiYXJyYXkiLCJUZXh0RGVjb2RlciIsImRlY29kZSIsInN0ciIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImRlY29kZVVSSUNvbXBvbmVudCIsImVzY2FwZSIsIkpTT04iLCJwYXJzZSIsInZlcnNpb24iLCJwYXJzZUZsb2F0IiwiZXh0ZW5zaW9uc1JlcXVpcmVkIiwiV2FzbU1vZHVsZSIsImdldEluc3RhbmNlIiwiaW5zdGFuY2UiLCJwYXJzZUdsYiIsImdsYkRhdGEiLCJEYXRhVmlldyIsImJ5dGVMZW5ndGgiLCJtYWdpYyIsImdldFVpbnQzMiIsImNodW5rTGVuZ3RoIiwiRXJyb3IiLCJjaHVua1R5cGUiLCJjaHVua0RhdGEiLCJwYXJzZUNodW5rIiwiaGFzR2xiSGVhZGVyIiwidTgiLCJ0b0xvd2VyQ2FzZSIsImVuZHNXaXRoIiwicGFyc2VCdWZmZXJWaWV3c0FzeW5jIiwiZ2x0ZkJ1ZmZlclZpZXciLCJHbGJQYXJzZXIiLCJwYXJzZUFzeW5jIiwiZXJyb3IiLCJyZXN1bHRfIiwibWF4UmV0cmllcyIsIl9kZXZpY2UiLCJfYXNzZXRzIiwiX2RlZmF1bHRNYXRlcmlhbCIsIl9nZXRVcmxXaXRob3V0UGFyYW1zIiwiZmV0Y2hBcnJheUJ1ZmZlciIsIm9yaWdpbmFsIiwiZXh0cmFjdFBhdGgiLCJHbGJDb250YWluZXJSZXNvdXJjZSIsIm9wZW4iLCJwYXRjaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvREEsSUFBSUEsb0JBQW9CLEdBQUcsSUFBSSxDQUFBO0FBRS9CLE1BQU1DLDJCQUEyQixHQUFHLE1BQU07QUFDdEMsRUFBQSxPQUFPLE9BQU9DLE1BQU0sS0FBSyxXQUFXLElBQUlBLE1BQU0sQ0FBQ0Msa0JBQWtCLENBQUE7QUFDckUsQ0FBQyxDQUFBOztBQUdELE1BQU1DLFlBQVksQ0FBQztFQUNmQyxXQUFXLENBQUNDLElBQUksRUFBRTtJQUNkLElBQUksQ0FBQ0EsSUFBSSxHQUFHQSxJQUFJLENBQUE7SUFDaEIsSUFBSSxDQUFDQyxLQUFLLEdBQUcsSUFBSSxDQUFBO0lBQ2pCLElBQUksQ0FBQ0MsTUFBTSxHQUFHLElBQUksQ0FBQTtJQUNsQixJQUFJLENBQUNDLFVBQVUsR0FBRyxJQUFJLENBQUE7SUFDdEIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsU0FBUyxHQUFHLElBQUksQ0FBQTtJQUNyQixJQUFJLENBQUNDLFFBQVEsR0FBRyxJQUFJLENBQUE7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
