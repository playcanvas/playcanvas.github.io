/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { http } from '../../platform/net/http.js';
import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Color } from '../../core/math/color.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { CHUNKAPI_1_57, CULLFACE_NONE, CULLFACE_BACK, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, BUFFER_STATIC, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_POINTS, SEMANTIC_NORMAL, INDEXFORMAT_UINT8, TYPE_FLOAT32, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE, TYPE_UINT32, TYPE_INT32, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, typedArrayTypesByteSize, typedArrayTypes } from '../../platform/graphics/constants.js';
import { IndexBuffer } from '../../platform/graphics/index-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import { VertexBuffer } from '../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../platform/graphics/vertex-format.js';
import { SPECOCC_AO, BLEND_NONE, BLEND_NORMAL, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, ASPECT_AUTO, LIGHTFALLOFF_INVERSESQUARED, ASPECT_MANUAL } from '../../scene/constants.js';
import { calculateNormals } from '../../scene/procedural.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Light, lightTypes } from '../../scene/light.js';
import { Mesh } from '../../scene/mesh.js';
import { Morph } from '../../scene/morph.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { Skin } from '../../scene/skin.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { Render } from '../../scene/render.js';
import { Entity } from '../entity.js';
import { AnimCurve } from '../anim/evaluator/anim-curve.js';
import { AnimData } from '../anim/evaluator/anim-data.js';
import { AnimTrack } from '../anim/evaluator/anim-track.js';
import { INTERPOLATION_LINEAR, INTERPOLATION_CUBIC, INTERPOLATION_STEP } from '../anim/constants.js';
import { Asset } from '../asset/asset.js';
import { GlbContainerResource } from './glb-container-resource.js';
import { WasmModule } from '../../core/wasm-module.js';

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
  material.chunks.APIVersion = CHUNKAPI_1_57;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9wYXJzZXJzL2dsYi1wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHtcbiAgICB0eXBlZEFycmF5VHlwZXMsIHR5cGVkQXJyYXlUeXBlc0J5dGVTaXplLFxuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSwgQUREUkVTU19NSVJST1JFRF9SRVBFQVQsIEFERFJFU1NfUkVQRUFULFxuICAgIEJVRkZFUl9TVEFUSUMsXG4gICAgQ1VMTEZBQ0VfTk9ORSwgQ1VMTEZBQ0VfQkFDSyxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBJTkRFWEZPUk1BVF9VSU5UOCwgSU5ERVhGT1JNQVRfVUlOVDE2LCBJTkRFWEZPUk1BVF9VSU5UMzIsXG4gICAgUFJJTUlUSVZFX0xJTkVMT09QLCBQUklNSVRJVkVfTElORVNUUklQLCBQUklNSVRJVkVfTElORVMsIFBSSU1JVElWRV9QT0lOVFMsIFBSSU1JVElWRV9UUklBTkdMRVMsIFBSSU1JVElWRV9UUklGQU4sIFBSSU1JVElWRV9UUklTVFJJUCxcbiAgICBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19UQU5HRU5ULCBTRU1BTlRJQ19DT0xPUiwgU0VNQU5USUNfQkxFTkRJTkRJQ0VTLCBTRU1BTlRJQ19CTEVORFdFSUdIVCxcbiAgICBTRU1BTlRJQ19URVhDT09SRDAsIFNFTUFOVElDX1RFWENPT1JEMSwgU0VNQU5USUNfVEVYQ09PUkQyLCBTRU1BTlRJQ19URVhDT09SRDMsIFNFTUFOVElDX1RFWENPT1JENCwgU0VNQU5USUNfVEVYQ09PUkQ1LCBTRU1BTlRJQ19URVhDT09SRDYsIFNFTUFOVElDX1RFWENPT1JENyxcbiAgICBUWVBFX0lOVDgsIFRZUEVfVUlOVDgsIFRZUEVfSU5UMTYsIFRZUEVfVUlOVDE2LCBUWVBFX0lOVDMyLCBUWVBFX1VJTlQzMiwgVFlQRV9GTE9BVDMyLCBDSFVOS0FQSV8xXzU3XG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJbmRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2luZGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1mb3JtYXQuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEJMRU5EX05PUk1BTCwgTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuICAgIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIEFTUEVDVF9NQU5VQUwsIEFTUEVDVF9BVVRPLCBTUEVDT0NDX0FPXG59IGZyb20gJy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IGNhbGN1bGF0ZU5vcm1hbHMgfSBmcm9tICcuLi8uLi9zY2VuZS9wcm9jZWR1cmFsLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgTGlnaHQsIGxpZ2h0VHlwZXMgfSBmcm9tICcuLi8uLi9zY2VuZS9saWdodC5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vLi4vc2NlbmUvbWVzaC5qcyc7XG5pbXBvcnQgeyBNb3JwaCB9IGZyb20gJy4uLy4uL3NjZW5lL21vcnBoLmpzJztcbmltcG9ydCB7IE1vcnBoVGFyZ2V0IH0gZnJvbSAnLi4vLi4vc2NlbmUvbW9ycGgtdGFyZ2V0LmpzJztcbmltcG9ydCB7IFNraW4gfSBmcm9tICcuLi8uLi9zY2VuZS9za2luLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWwgfSBmcm9tICcuLi8uLi9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgUmVuZGVyIH0gZnJvbSAnLi4vLi4vc2NlbmUvcmVuZGVyLmpzJztcblxuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZnJhbWV3b3JrL2VudGl0eS5qcyc7XG5cbmltcG9ydCB7IEFuaW1DdXJ2ZSB9IGZyb20gJy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tY3VydmUuanMnO1xuaW1wb3J0IHsgQW5pbURhdGEgfSBmcm9tICcuLi9hbmltL2V2YWx1YXRvci9hbmltLWRhdGEuanMnO1xuaW1wb3J0IHsgQW5pbVRyYWNrIH0gZnJvbSAnLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS10cmFjay5qcyc7XG5cbmltcG9ydCB7IElOVEVSUE9MQVRJT05fQ1VCSUMsIElOVEVSUE9MQVRJT05fTElORUFSLCBJTlRFUlBPTEFUSU9OX1NURVAgfSBmcm9tICcuLi9hbmltL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vZnJhbWV3b3JrL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgR2xiQ29udGFpbmVyUmVzb3VyY2UgfSBmcm9tICcuL2dsYi1jb250YWluZXItcmVzb3VyY2UuanMnO1xuXG5pbXBvcnQgeyBXYXNtTW9kdWxlIH0gZnJvbSAnLi4vLi4vY29yZS93YXNtLW1vZHVsZS5qcyc7XG5cbi8vIGluc3RhbmNlIG9mIHRoZSBkcmFjbyBkZWNvZGVyXG5sZXQgZHJhY29EZWNvZGVySW5zdGFuY2UgPSBudWxsO1xuXG5jb25zdCBnZXRHbG9iYWxEcmFjb0RlY29kZXJNb2R1bGUgPSAoKSA9PiB7XG4gICAgcmV0dXJuIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5EcmFjb0RlY29kZXJNb2R1bGU7XG59O1xuXG4vLyByZXNvdXJjZXMgbG9hZGVkIGZyb20gR0xCIGZpbGUgdGhhdCB0aGUgcGFyc2VyIHJldHVybnNcbmNsYXNzIEdsYlJlc291cmNlcyB7XG4gICAgY29uc3RydWN0b3IoZ2x0Zikge1xuICAgICAgICB0aGlzLmdsdGYgPSBnbHRmO1xuICAgICAgICB0aGlzLm5vZGVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5zY2VuZXMgPSBudWxsO1xuICAgICAgICB0aGlzLmFuaW1hdGlvbnMgPSBudWxsO1xuICAgICAgICB0aGlzLnRleHR1cmVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYXRlcmlhbHMgPSBudWxsO1xuICAgICAgICB0aGlzLnZhcmlhbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5tZXNoVmFyaWFudHMgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hEZWZhdWx0TWF0ZXJpYWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy5yZW5kZXJzID0gbnVsbDtcbiAgICAgICAgdGhpcy5za2lucyA9IG51bGw7XG4gICAgICAgIHRoaXMubGlnaHRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5jYW1lcmFzID0gbnVsbDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyByZW5kZXIgbmVlZHMgdG8gZGVjIHJlZiBtZXNoZXNcbiAgICAgICAgaWYgKHRoaXMucmVuZGVycykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJzLmZvckVhY2goKHJlbmRlcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlbmRlci5tZXNoZXMgPSBudWxsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNvbnN0IGlzRGF0YVVSSSA9IGZ1bmN0aW9uICh1cmkpIHtcbiAgICByZXR1cm4gL15kYXRhOi4qLC4qJC9pLnRlc3QodXJpKTtcbn07XG5cbmNvbnN0IGdldERhdGFVUklNaW1lVHlwZSA9IGZ1bmN0aW9uICh1cmkpIHtcbiAgICByZXR1cm4gdXJpLnN1YnN0cmluZyh1cmkuaW5kZXhPZignOicpICsgMSwgdXJpLmluZGV4T2YoJzsnKSk7XG59O1xuXG5jb25zdCBnZXROdW1Db21wb25lbnRzID0gZnVuY3Rpb24gKGFjY2Vzc29yVHlwZSkge1xuICAgIHN3aXRjaCAoYWNjZXNzb3JUeXBlKSB7XG4gICAgICAgIGNhc2UgJ1NDQUxBUic6IHJldHVybiAxO1xuICAgICAgICBjYXNlICdWRUMyJzogcmV0dXJuIDI7XG4gICAgICAgIGNhc2UgJ1ZFQzMnOiByZXR1cm4gMztcbiAgICAgICAgY2FzZSAnVkVDNCc6IHJldHVybiA0O1xuICAgICAgICBjYXNlICdNQVQyJzogcmV0dXJuIDQ7XG4gICAgICAgIGNhc2UgJ01BVDMnOiByZXR1cm4gOTtcbiAgICAgICAgY2FzZSAnTUFUNCc6IHJldHVybiAxNjtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDM7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50VHlwZSA9IGZ1bmN0aW9uIChjb21wb25lbnRUeXBlKSB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIFRZUEVfSU5UODtcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gVFlQRV9VSU5UODtcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gVFlQRV9JTlQxNjtcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gVFlQRV9VSU5UMTY7XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIFRZUEVfSU5UMzI7XG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIFRZUEVfVUlOVDMyO1xuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiBUWVBFX0ZMT0FUMzI7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAwO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudFNpemVJbkJ5dGVzID0gZnVuY3Rpb24gKGNvbXBvbmVudFR5cGUpIHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gMTsgICAgLy8gaW50OFxuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiAxOyAgICAvLyB1aW50OFxuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiAyOyAgICAvLyBpbnQxNlxuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiAyOyAgICAvLyB1aW50MTZcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gNDsgICAgLy8gaW50MzJcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gNDsgICAgLy8gdWludDMyXG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIDQ7ICAgIC8vIGZsb2F0MzJcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDA7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50RGF0YVR5cGUgPSBmdW5jdGlvbiAoY29tcG9uZW50VHlwZSkge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiBJbnQ4QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIFVpbnQ4QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIEludDE2QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIFVpbnQxNkFycmF5O1xuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiBJbnQzMkFycmF5O1xuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiBVaW50MzJBcnJheTtcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gRmxvYXQzMkFycmF5O1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG5jb25zdCBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcCA9IHtcbiAgICAnUE9TSVRJT04nOiBTRU1BTlRJQ19QT1NJVElPTixcbiAgICAnTk9STUFMJzogU0VNQU5USUNfTk9STUFMLFxuICAgICdUQU5HRU5UJzogU0VNQU5USUNfVEFOR0VOVCxcbiAgICAnQ09MT1JfMCc6IFNFTUFOVElDX0NPTE9SLFxuICAgICdKT0lOVFNfMCc6IFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICAnV0VJR0hUU18wJzogU0VNQU5USUNfQkxFTkRXRUlHSFQsXG4gICAgJ1RFWENPT1JEXzAnOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgJ1RFWENPT1JEXzEnOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgJ1RFWENPT1JEXzInOiBTRU1BTlRJQ19URVhDT09SRDIsXG4gICAgJ1RFWENPT1JEXzMnOiBTRU1BTlRJQ19URVhDT09SRDMsXG4gICAgJ1RFWENPT1JEXzQnOiBTRU1BTlRJQ19URVhDT09SRDQsXG4gICAgJ1RFWENPT1JEXzUnOiBTRU1BTlRJQ19URVhDT09SRDUsXG4gICAgJ1RFWENPT1JEXzYnOiBTRU1BTlRJQ19URVhDT09SRDYsXG4gICAgJ1RFWENPT1JEXzcnOiBTRU1BTlRJQ19URVhDT09SRDdcbn07XG5cbi8vIHJldHVybnMgYSBmdW5jdGlvbiBmb3IgZGVxdWFudGl6aW5nIHRoZSBkYXRhIHR5cGVcbmNvbnN0IGdldERlcXVhbnRpemVGdW5jID0gKHNyY1R5cGUpID0+IHtcbiAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL0tocm9ub3NHcm91cC9nbFRGL3RyZWUvbWFzdGVyL2V4dGVuc2lvbnMvMi4wL0tocm9ub3MvS0hSX21lc2hfcXVhbnRpemF0aW9uI2VuY29kaW5nLXF1YW50aXplZC1kYXRhXG4gICAgc3dpdGNoIChzcmNUeXBlKSB7XG4gICAgICAgIGNhc2UgVFlQRV9JTlQ4OiByZXR1cm4geCA9PiBNYXRoLm1heCh4IC8gMTI3LjAsIC0xLjApO1xuICAgICAgICBjYXNlIFRZUEVfVUlOVDg6IHJldHVybiB4ID0+IHggLyAyNTUuMDtcbiAgICAgICAgY2FzZSBUWVBFX0lOVDE2OiByZXR1cm4geCA9PiBNYXRoLm1heCh4IC8gMzI3NjcuMCwgLTEuMCk7XG4gICAgICAgIGNhc2UgVFlQRV9VSU5UMTY6IHJldHVybiB4ID0+IHggLyA2NTUzNS4wO1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4geCA9PiB4O1xuICAgIH1cbn07XG5cbi8vIGRlcXVhbnRpemUgYW4gYXJyYXkgb2YgZGF0YVxuY29uc3QgZGVxdWFudGl6ZUFycmF5ID0gZnVuY3Rpb24gKGRzdEFycmF5LCBzcmNBcnJheSwgc3JjVHlwZSkge1xuICAgIGNvbnN0IGNvbnZGdW5jID0gZ2V0RGVxdWFudGl6ZUZ1bmMoc3JjVHlwZSk7XG4gICAgY29uc3QgbGVuID0gc3JjQXJyYXkubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgZHN0QXJyYXlbaV0gPSBjb252RnVuYyhzcmNBcnJheVtpXSk7XG4gICAgfVxuICAgIHJldHVybiBkc3RBcnJheTtcbn07XG5cbi8vIGdldCBhY2Nlc3NvciBkYXRhLCBtYWtpbmcgYSBjb3B5IGFuZCBwYXRjaGluZyBpbiB0aGUgY2FzZSBvZiBhIHNwYXJzZSBhY2Nlc3NvclxuY29uc3QgZ2V0QWNjZXNzb3JEYXRhID0gZnVuY3Rpb24gKGdsdGZBY2Nlc3NvciwgYnVmZmVyVmlld3MsIGZsYXR0ZW4gPSBmYWxzZSkge1xuICAgIGNvbnN0IG51bUNvbXBvbmVudHMgPSBnZXROdW1Db21wb25lbnRzKGdsdGZBY2Nlc3Nvci50eXBlKTtcbiAgICBjb25zdCBkYXRhVHlwZSA9IGdldENvbXBvbmVudERhdGFUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcbiAgICBpZiAoIWRhdGFUeXBlKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGJ1ZmZlclZpZXcgPSBidWZmZXJWaWV3c1tnbHRmQWNjZXNzb3IuYnVmZmVyVmlld107XG4gICAgbGV0IHJlc3VsdDtcblxuICAgIGlmIChnbHRmQWNjZXNzb3Iuc3BhcnNlKSB7XG4gICAgICAgIC8vIGhhbmRsZSBzcGFyc2UgZGF0YVxuICAgICAgICBjb25zdCBzcGFyc2UgPSBnbHRmQWNjZXNzb3Iuc3BhcnNlO1xuXG4gICAgICAgIC8vIGdldCBpbmRpY2VzIGRhdGFcbiAgICAgICAgY29uc3QgaW5kaWNlc0FjY2Vzc29yID0ge1xuICAgICAgICAgICAgY291bnQ6IHNwYXJzZS5jb3VudCxcbiAgICAgICAgICAgIHR5cGU6ICdTQ0FMQVInXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGluZGljZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbihpbmRpY2VzQWNjZXNzb3IsIHNwYXJzZS5pbmRpY2VzKSwgYnVmZmVyVmlld3MsIHRydWUpO1xuXG4gICAgICAgIC8vIGRhdGEgdmFsdWVzIGRhdGFcbiAgICAgICAgY29uc3QgdmFsdWVzQWNjZXNzb3IgPSB7XG4gICAgICAgICAgICBjb3VudDogc3BhcnNlLmNvdW50LFxuICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnNjYWxhcixcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IGdldEFjY2Vzc29yRGF0YShPYmplY3QuYXNzaWduKHZhbHVlc0FjY2Vzc29yLCBzcGFyc2UudmFsdWVzKSwgYnVmZmVyVmlld3MsIHRydWUpO1xuXG4gICAgICAgIC8vIGdldCBiYXNlIGRhdGFcbiAgICAgICAgaWYgKGdsdGZBY2Nlc3Nvci5oYXNPd25Qcm9wZXJ0eSgnYnVmZmVyVmlldycpKSB7XG4gICAgICAgICAgICBjb25zdCBiYXNlQWNjZXNzb3IgPSB7XG4gICAgICAgICAgICAgICAgYnVmZmVyVmlldzogZ2x0ZkFjY2Vzc29yLmJ1ZmZlclZpZXcsXG4gICAgICAgICAgICAgICAgYnl0ZU9mZnNldDogZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICAgICAgY291bnQ6IGdsdGZBY2Nlc3Nvci5jb3VudCxcbiAgICAgICAgICAgICAgICB0eXBlOiBnbHRmQWNjZXNzb3IudHlwZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIC8vIG1ha2UgYSBjb3B5IG9mIHRoZSBiYXNlIGRhdGEgc2luY2Ugd2UnbGwgcGF0Y2ggdGhlIHZhbHVlc1xuICAgICAgICAgICAgcmVzdWx0ID0gZ2V0QWNjZXNzb3JEYXRhKGJhc2VBY2Nlc3NvciwgYnVmZmVyVmlld3MsIHRydWUpLnNsaWNlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB0aGVyZSBpcyBubyBiYXNlIGRhdGEsIGNyZWF0ZSBlbXB0eSAwJ2Qgb3V0IGRhdGFcbiAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBkYXRhVHlwZShnbHRmQWNjZXNzb3IuY291bnQgKiBudW1Db21wb25lbnRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3BhcnNlLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldEluZGV4ID0gaW5kaWNlc1tpXTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVtQ29tcG9uZW50czsgKytqKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W3RhcmdldEluZGV4ICogbnVtQ29tcG9uZW50cyArIGpdID0gdmFsdWVzW2kgKiBudW1Db21wb25lbnRzICsgal07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGZsYXR0ZW4gJiYgYnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpKSB7XG4gICAgICAgIC8vIGZsYXR0ZW4gc3RyaWRkZW4gZGF0YVxuICAgICAgICBjb25zdCBieXRlc1BlckVsZW1lbnQgPSBudW1Db21wb25lbnRzICogZGF0YVR5cGUuQllURVNfUEVSX0VMRU1FTlQ7XG4gICAgICAgIGNvbnN0IHN0b3JhZ2UgPSBuZXcgQXJyYXlCdWZmZXIoZ2x0ZkFjY2Vzc29yLmNvdW50ICogYnl0ZXNQZXJFbGVtZW50KTtcbiAgICAgICAgY29uc3QgdG1wQXJyYXkgPSBuZXcgVWludDhBcnJheShzdG9yYWdlKTtcblxuICAgICAgICBsZXQgZHN0T2Zmc2V0ID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbHRmQWNjZXNzb3IuY291bnQ7ICsraSkge1xuICAgICAgICAgICAgLy8gbm8gbmVlZCB0byBhZGQgYnVmZmVyVmlldy5ieXRlT2Zmc2V0IGJlY2F1c2UgYWNjZXNzb3IgdGFrZXMgdGhpcyBpbnRvIGFjY291bnRcbiAgICAgICAgICAgIGxldCBzcmNPZmZzZXQgPSAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCkgKyBpICogYnVmZmVyVmlldy5ieXRlU3RyaWRlO1xuICAgICAgICAgICAgZm9yIChsZXQgYiA9IDA7IGIgPCBieXRlc1BlckVsZW1lbnQ7ICsrYikge1xuICAgICAgICAgICAgICAgIHRtcEFycmF5W2RzdE9mZnNldCsrXSA9IGJ1ZmZlclZpZXdbc3JjT2Zmc2V0KytdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKHN0b3JhZ2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBkYXRhVHlwZShidWZmZXJWaWV3LmJ1ZmZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXcuYnl0ZU9mZnNldCArIChnbHRmQWNjZXNzb3IuYnl0ZU9mZnNldCB8fCAwKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnZXQgYWNjZXNzb3IgZGF0YSBhcyAodW5ub3JtYWxpemVkLCB1bnF1YW50aXplZCkgRmxvYXQzMiBkYXRhXG5jb25zdCBnZXRBY2Nlc3NvckRhdGFGbG9hdDMyID0gZnVuY3Rpb24gKGdsdGZBY2Nlc3NvciwgYnVmZmVyVmlld3MpIHtcbiAgICBjb25zdCBkYXRhID0gZ2V0QWNjZXNzb3JEYXRhKGdsdGZBY2Nlc3NvciwgYnVmZmVyVmlld3MsIHRydWUpO1xuICAgIGlmIChkYXRhIGluc3RhbmNlb2YgRmxvYXQzMkFycmF5IHx8ICFnbHRmQWNjZXNzb3Iubm9ybWFsaXplZCkge1xuICAgICAgICAvLyBpZiB0aGUgc291cmNlIGRhdGEgaXMgcXVhbnRpemVkIChzYXkgdG8gaW50MTYpLCBidXQgbm90IG5vcm1hbGl6ZWRcbiAgICAgICAgLy8gdGhlbiByZWFkaW5nIHRoZSB2YWx1ZXMgb2YgdGhlIGFycmF5IGlzIHRoZSBzYW1lIHdoZXRoZXIgdGhlIHZhbHVlc1xuICAgICAgICAvLyBhcmUgc3RvcmVkIGFzIGZsb2F0MzIgb3IgaW50MTYuIHNvIHByb2JhYmx5IG5vIG5lZWQgdG8gY29udmVydCB0b1xuICAgICAgICAvLyBmbG9hdDMyLlxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG5cbiAgICBjb25zdCBmbG9hdDMyRGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoZGF0YS5sZW5ndGgpO1xuICAgIGRlcXVhbnRpemVBcnJheShmbG9hdDMyRGF0YSwgZGF0YSwgZ2V0Q29tcG9uZW50VHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSkpO1xuICAgIHJldHVybiBmbG9hdDMyRGF0YTtcbn07XG5cbi8vIHJldHVybnMgYSBkZXF1YW50aXplZCBib3VuZGluZyBib3ggZm9yIHRoZSBhY2Nlc3NvclxuY29uc3QgZ2V0QWNjZXNzb3JCb3VuZGluZ0JveCA9IGZ1bmN0aW9uIChnbHRmQWNjZXNzb3IpIHtcbiAgICBsZXQgbWluID0gZ2x0ZkFjY2Vzc29yLm1pbjtcbiAgICBsZXQgbWF4ID0gZ2x0ZkFjY2Vzc29yLm1heDtcbiAgICBpZiAoIW1pbiB8fCAhbWF4KSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChnbHRmQWNjZXNzb3Iubm9ybWFsaXplZCkge1xuICAgICAgICBjb25zdCBjdHlwZSA9IGdldENvbXBvbmVudFR5cGUoZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgICAgICBtaW4gPSBkZXF1YW50aXplQXJyYXkoW10sIG1pbiwgY3R5cGUpO1xuICAgICAgICBtYXggPSBkZXF1YW50aXplQXJyYXkoW10sIG1heCwgY3R5cGUpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgQm91bmRpbmdCb3goXG4gICAgICAgIG5ldyBWZWMzKChtYXhbMF0gKyBtaW5bMF0pICogMC41LCAobWF4WzFdICsgbWluWzFdKSAqIDAuNSwgKG1heFsyXSArIG1pblsyXSkgKiAwLjUpLFxuICAgICAgICBuZXcgVmVjMygobWF4WzBdIC0gbWluWzBdKSAqIDAuNSwgKG1heFsxXSAtIG1pblsxXSkgKiAwLjUsIChtYXhbMl0gLSBtaW5bMl0pICogMC41KVxuICAgICk7XG59O1xuXG5jb25zdCBnZXRQcmltaXRpdmVUeXBlID0gZnVuY3Rpb24gKHByaW1pdGl2ZSkge1xuICAgIGlmICghcHJpbWl0aXZlLmhhc093blByb3BlcnR5KCdtb2RlJykpIHtcbiAgICAgICAgcmV0dXJuIFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgfVxuXG4gICAgc3dpdGNoIChwcmltaXRpdmUubW9kZSkge1xuICAgICAgICBjYXNlIDA6IHJldHVybiBQUklNSVRJVkVfUE9JTlRTO1xuICAgICAgICBjYXNlIDE6IHJldHVybiBQUklNSVRJVkVfTElORVM7XG4gICAgICAgIGNhc2UgMjogcmV0dXJuIFBSSU1JVElWRV9MSU5FTE9PUDtcbiAgICAgICAgY2FzZSAzOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVTVFJJUDtcbiAgICAgICAgY2FzZSA0OiByZXR1cm4gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICAgICAgY2FzZSA1OiByZXR1cm4gUFJJTUlUSVZFX1RSSVNUUklQO1xuICAgICAgICBjYXNlIDY6IHJldHVybiBQUklNSVRJVkVfVFJJRkFOO1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICB9XG59O1xuXG5jb25zdCBnZW5lcmF0ZUluZGljZXMgPSBmdW5jdGlvbiAobnVtVmVydGljZXMpIHtcbiAgICBjb25zdCBkdW1teUluZGljZXMgPSBuZXcgVWludDE2QXJyYXkobnVtVmVydGljZXMpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbnVtVmVydGljZXM7IGkrKykge1xuICAgICAgICBkdW1teUluZGljZXNbaV0gPSBpO1xuICAgIH1cbiAgICByZXR1cm4gZHVtbXlJbmRpY2VzO1xufTtcblxuY29uc3QgZ2VuZXJhdGVOb3JtYWxzID0gZnVuY3Rpb24gKHNvdXJjZURlc2MsIGluZGljZXMpIHtcbiAgICAvLyBnZXQgcG9zaXRpb25zXG4gICAgY29uc3QgcCA9IHNvdXJjZURlc2NbU0VNQU5USUNfUE9TSVRJT05dO1xuICAgIGlmICghcCB8fCBwLmNvbXBvbmVudHMgIT09IDMpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGxldCBwb3NpdGlvbnM7XG4gICAgaWYgKHAuc2l6ZSAhPT0gcC5zdHJpZGUpIHtcbiAgICAgICAgLy8gZXh0cmFjdCBwb3NpdGlvbnMgd2hpY2ggYXJlbid0IHRpZ2h0bHkgcGFja2VkXG4gICAgICAgIGNvbnN0IHNyY1N0cmlkZSA9IHAuc3RyaWRlIC8gdHlwZWRBcnJheVR5cGVzQnl0ZVNpemVbcC50eXBlXTtcbiAgICAgICAgY29uc3Qgc3JjID0gbmV3IHR5cGVkQXJyYXlUeXBlc1twLnR5cGVdKHAuYnVmZmVyLCBwLm9mZnNldCwgcC5jb3VudCAqIHNyY1N0cmlkZSk7XG4gICAgICAgIHBvc2l0aW9ucyA9IG5ldyB0eXBlZEFycmF5VHlwZXNbcC50eXBlXShwLmNvdW50ICogMyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcC5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICBwb3NpdGlvbnNbaSAqIDMgKyAwXSA9IHNyY1tpICogc3JjU3RyaWRlICsgMF07XG4gICAgICAgICAgICBwb3NpdGlvbnNbaSAqIDMgKyAxXSA9IHNyY1tpICogc3JjU3RyaWRlICsgMV07XG4gICAgICAgICAgICBwb3NpdGlvbnNbaSAqIDMgKyAyXSA9IHNyY1tpICogc3JjU3RyaWRlICsgMl07XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBwb3NpdGlvbiBkYXRhIGlzIHRpZ2h0bHkgcGFja2VkIHNvIHdlIGNhbiB1c2UgaXQgZGlyZWN0bHlcbiAgICAgICAgcG9zaXRpb25zID0gbmV3IHR5cGVkQXJyYXlUeXBlc1twLnR5cGVdKHAuYnVmZmVyLCBwLm9mZnNldCwgcC5jb3VudCAqIDMpO1xuICAgIH1cblxuICAgIGNvbnN0IG51bVZlcnRpY2VzID0gcC5jb3VudDtcblxuICAgIC8vIGdlbmVyYXRlIGluZGljZXMgaWYgbmVjZXNzYXJ5XG4gICAgaWYgKCFpbmRpY2VzKSB7XG4gICAgICAgIGluZGljZXMgPSBnZW5lcmF0ZUluZGljZXMobnVtVmVydGljZXMpO1xuICAgIH1cblxuICAgIC8vIGdlbmVyYXRlIG5vcm1hbHNcbiAgICBjb25zdCBub3JtYWxzVGVtcCA9IGNhbGN1bGF0ZU5vcm1hbHMocG9zaXRpb25zLCBpbmRpY2VzKTtcbiAgICBjb25zdCBub3JtYWxzID0gbmV3IEZsb2F0MzJBcnJheShub3JtYWxzVGVtcC5sZW5ndGgpO1xuICAgIG5vcm1hbHMuc2V0KG5vcm1hbHNUZW1wKTtcblxuICAgIHNvdXJjZURlc2NbU0VNQU5USUNfTk9STUFMXSA9IHtcbiAgICAgICAgYnVmZmVyOiBub3JtYWxzLmJ1ZmZlcixcbiAgICAgICAgc2l6ZTogMTIsXG4gICAgICAgIG9mZnNldDogMCxcbiAgICAgICAgc3RyaWRlOiAxMixcbiAgICAgICAgY291bnQ6IG51bVZlcnRpY2VzLFxuICAgICAgICBjb21wb25lbnRzOiAzLFxuICAgICAgICB0eXBlOiBUWVBFX0ZMT0FUMzJcbiAgICB9O1xufTtcblxuY29uc3QgZmxpcFRleENvb3JkVnMgPSBmdW5jdGlvbiAodmVydGV4QnVmZmVyKSB7XG4gICAgbGV0IGksIGo7XG5cbiAgICBjb25zdCBmbG9hdE9mZnNldHMgPSBbXTtcbiAgICBjb25zdCBzaG9ydE9mZnNldHMgPSBbXTtcbiAgICBjb25zdCBieXRlT2Zmc2V0cyA9IFtdO1xuICAgIGZvciAoaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICBpZiAoZWxlbWVudC5uYW1lID09PSBTRU1BTlRJQ19URVhDT09SRDAgfHxcbiAgICAgICAgICAgIGVsZW1lbnQubmFtZSA9PT0gU0VNQU5USUNfVEVYQ09PUkQxKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKGVsZW1lbnQuZGF0YVR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFRZUEVfRkxPQVQzMjpcbiAgICAgICAgICAgICAgICAgICAgZmxvYXRPZmZzZXRzLnB1c2goeyBvZmZzZXQ6IGVsZW1lbnQub2Zmc2V0IC8gNCArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgLyA0IH0pO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFRZUEVfVUlOVDE2OlxuICAgICAgICAgICAgICAgICAgICBzaG9ydE9mZnNldHMucHVzaCh7IG9mZnNldDogZWxlbWVudC5vZmZzZXQgLyAyICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSAvIDIgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UODpcbiAgICAgICAgICAgICAgICAgICAgYnl0ZU9mZnNldHMucHVzaCh7IG9mZnNldDogZWxlbWVudC5vZmZzZXQgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIH0pO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGZsaXAgPSBmdW5jdGlvbiAob2Zmc2V0cywgdHlwZSwgb25lKSB7XG4gICAgICAgIGNvbnN0IHR5cGVkQXJyYXkgPSBuZXcgdHlwZSh2ZXJ0ZXhCdWZmZXIuc3RvcmFnZSk7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBvZmZzZXRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBsZXQgaW5kZXggPSBvZmZzZXRzW2ldLm9mZnNldDtcbiAgICAgICAgICAgIGNvbnN0IHN0cmlkZSA9IG9mZnNldHNbaV0uc3RyaWRlO1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlczsgKytqKSB7XG4gICAgICAgICAgICAgICAgdHlwZWRBcnJheVtpbmRleF0gPSBvbmUgLSB0eXBlZEFycmF5W2luZGV4XTtcbiAgICAgICAgICAgICAgICBpbmRleCArPSBzdHJpZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKGZsb2F0T2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoZmxvYXRPZmZzZXRzLCBGbG9hdDMyQXJyYXksIDEuMCk7XG4gICAgfVxuICAgIGlmIChzaG9ydE9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKHNob3J0T2Zmc2V0cywgVWludDE2QXJyYXksIDY1NTM1KTtcbiAgICB9XG4gICAgaWYgKGJ5dGVPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChieXRlT2Zmc2V0cywgVWludDhBcnJheSwgMjU1KTtcbiAgICB9XG59O1xuXG4vLyBnaXZlbiBhIHRleHR1cmUsIGNsb25lIGl0XG4vLyBOT1RFOiBDUFUtc2lkZSB0ZXh0dXJlIGRhdGEgd2lsbCBiZSBzaGFyZWQgYnV0IEdQVSBtZW1vcnkgd2lsbCBiZSBkdXBsaWNhdGVkXG5jb25zdCBjbG9uZVRleHR1cmUgPSBmdW5jdGlvbiAodGV4dHVyZSkge1xuICAgIGNvbnN0IHNoYWxsb3dDb3B5TGV2ZWxzID0gZnVuY3Rpb24gKHRleHR1cmUpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgICAgIGZvciAobGV0IG1pcCA9IDA7IG1pcCA8IHRleHR1cmUuX2xldmVscy5sZW5ndGg7ICsrbWlwKSB7XG4gICAgICAgICAgICBsZXQgbGV2ZWwgPSBbXTtcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLmN1YmVtYXApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBmYWNlID0gMDsgZmFjZSA8IDY7ICsrZmFjZSkge1xuICAgICAgICAgICAgICAgICAgICBsZXZlbC5wdXNoKHRleHR1cmUuX2xldmVsc1ttaXBdW2ZhY2VdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldmVsID0gdGV4dHVyZS5fbGV2ZWxzW21pcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQucHVzaChsZXZlbCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IFRleHR1cmUodGV4dHVyZS5kZXZpY2UsIHRleHR1cmUpOyAgIC8vIGR1cGxpY2F0ZSB0ZXh0dXJlXG4gICAgcmVzdWx0Ll9sZXZlbHMgPSBzaGFsbG93Q29weUxldmVscyh0ZXh0dXJlKTsgICAgICAgICAgICAvLyBzaGFsbG93IGNvcHkgdGhlIGxldmVscyBzdHJ1Y3R1cmVcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gZ2l2ZW4gYSB0ZXh0dXJlIGFzc2V0LCBjbG9uZSBpdFxuY29uc3QgY2xvbmVUZXh0dXJlQXNzZXQgPSBmdW5jdGlvbiAoc3JjKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IEFzc2V0KHNyYy5uYW1lICsgJ19jbG9uZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy50eXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMuZmlsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLmRhdGEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5vcHRpb25zKTtcbiAgICByZXN1bHQubG9hZGVkID0gdHJ1ZTtcbiAgICByZXN1bHQucmVzb3VyY2UgPSBjbG9uZVRleHR1cmUoc3JjLnJlc291cmNlKTtcbiAgICBzcmMucmVnaXN0cnkuYWRkKHJlc3VsdCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbmNvbnN0IGNyZWF0ZVZlcnRleEJ1ZmZlckludGVybmFsID0gZnVuY3Rpb24gKGRldmljZSwgc291cmNlRGVzYywgZmxpcFYpIHtcbiAgICBjb25zdCBwb3NpdGlvbkRlc2MgPSBzb3VyY2VEZXNjW1NFTUFOVElDX1BPU0lUSU9OXTtcbiAgICBpZiAoIXBvc2l0aW9uRGVzYykge1xuICAgICAgICAvLyBpZ25vcmUgbWVzaGVzIHdpdGhvdXQgcG9zaXRpb25zXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBudW1WZXJ0aWNlcyA9IHBvc2l0aW9uRGVzYy5jb3VudDtcblxuICAgIC8vIGdlbmVyYXRlIHZlcnRleERlc2MgZWxlbWVudHNcbiAgICBjb25zdCB2ZXJ0ZXhEZXNjID0gW107XG4gICAgZm9yIChjb25zdCBzZW1hbnRpYyBpbiBzb3VyY2VEZXNjKSB7XG4gICAgICAgIGlmIChzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KHNlbWFudGljKSkge1xuICAgICAgICAgICAgdmVydGV4RGVzYy5wdXNoKHtcbiAgICAgICAgICAgICAgICBzZW1hbnRpYzogc2VtYW50aWMsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogc291cmNlRGVzY1tzZW1hbnRpY10uY29tcG9uZW50cyxcbiAgICAgICAgICAgICAgICB0eXBlOiBzb3VyY2VEZXNjW3NlbWFudGljXS50eXBlLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZTogISFzb3VyY2VEZXNjW3NlbWFudGljXS5ub3JtYWxpemVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gb3JkZXIgdmVydGV4RGVzYyB0byBtYXRjaCB0aGUgcmVzdCBvZiB0aGUgZW5naW5lXG4gICAgY29uc3QgZWxlbWVudE9yZGVyID0gW1xuICAgICAgICBTRU1BTlRJQ19QT1NJVElPTixcbiAgICAgICAgU0VNQU5USUNfTk9STUFMLFxuICAgICAgICBTRU1BTlRJQ19UQU5HRU5ULFxuICAgICAgICBTRU1BTlRJQ19DT0xPUixcbiAgICAgICAgU0VNQU5USUNfQkxFTkRJTkRJQ0VTLFxuICAgICAgICBTRU1BTlRJQ19CTEVORFdFSUdIVCxcbiAgICAgICAgU0VNQU5USUNfVEVYQ09PUkQwLFxuICAgICAgICBTRU1BTlRJQ19URVhDT09SRDFcbiAgICBdO1xuXG4gICAgLy8gc29ydCB2ZXJ0ZXggZWxlbWVudHMgYnkgZW5naW5lLWlkZWFsIG9yZGVyXG4gICAgdmVydGV4RGVzYy5zb3J0KGZ1bmN0aW9uIChsaHMsIHJocykge1xuICAgICAgICBjb25zdCBsaHNPcmRlciA9IGVsZW1lbnRPcmRlci5pbmRleE9mKGxocy5zZW1hbnRpYyk7XG4gICAgICAgIGNvbnN0IHJoc09yZGVyID0gZWxlbWVudE9yZGVyLmluZGV4T2YocmhzLnNlbWFudGljKTtcbiAgICAgICAgcmV0dXJuIChsaHNPcmRlciA8IHJoc09yZGVyKSA/IC0xIDogKHJoc09yZGVyIDwgbGhzT3JkZXIgPyAxIDogMCk7XG4gICAgfSk7XG5cbiAgICBsZXQgaSwgaiwgaztcbiAgICBsZXQgc291cmNlLCB0YXJnZXQsIHNvdXJjZU9mZnNldDtcblxuICAgIGNvbnN0IHZlcnRleEZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQoZGV2aWNlLCB2ZXJ0ZXhEZXNjKTtcblxuICAgIC8vIGNoZWNrIHdoZXRoZXIgc291cmNlIGRhdGEgaXMgY29ycmVjdGx5IGludGVybGVhdmVkXG4gICAgbGV0IGlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQgPSB0cnVlO1xuICAgIGZvciAoaSA9IDA7IGkgPCB2ZXJ0ZXhGb3JtYXQuZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdGFyZ2V0ID0gdmVydGV4Rm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICBzb3VyY2UgPSBzb3VyY2VEZXNjW3RhcmdldC5uYW1lXTtcbiAgICAgICAgc291cmNlT2Zmc2V0ID0gc291cmNlLm9mZnNldCAtIHBvc2l0aW9uRGVzYy5vZmZzZXQ7XG4gICAgICAgIGlmICgoc291cmNlLmJ1ZmZlciAhPT0gcG9zaXRpb25EZXNjLmJ1ZmZlcikgfHxcbiAgICAgICAgICAgIChzb3VyY2Uuc3RyaWRlICE9PSB0YXJnZXQuc3RyaWRlKSB8fFxuICAgICAgICAgICAgKHNvdXJjZS5zaXplICE9PSB0YXJnZXQuc2l6ZSkgfHxcbiAgICAgICAgICAgIChzb3VyY2VPZmZzZXQgIT09IHRhcmdldC5vZmZzZXQpKSB7XG4gICAgICAgICAgICBpc0NvcnJlY3RseUludGVybGVhdmVkID0gZmFsc2U7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNyZWF0ZSB2ZXJ0ZXggYnVmZmVyXG4gICAgY29uc3QgdmVydGV4QnVmZmVyID0gbmV3IFZlcnRleEJ1ZmZlcihkZXZpY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZXJ0ZXhGb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1WZXJ0aWNlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEJVRkZFUl9TVEFUSUMpO1xuXG4gICAgY29uc3QgdmVydGV4RGF0YSA9IHZlcnRleEJ1ZmZlci5sb2NrKCk7XG4gICAgY29uc3QgdGFyZ2V0QXJyYXkgPSBuZXcgVWludDMyQXJyYXkodmVydGV4RGF0YSk7XG4gICAgbGV0IHNvdXJjZUFycmF5O1xuXG4gICAgaWYgKGlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQpIHtcbiAgICAgICAgLy8gY29weSBkYXRhXG4gICAgICAgIHNvdXJjZUFycmF5ID0gbmV3IFVpbnQzMkFycmF5KHBvc2l0aW9uRGVzYy5idWZmZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uRGVzYy5vZmZzZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bVZlcnRpY2VzICogdmVydGV4QnVmZmVyLmZvcm1hdC5zaXplIC8gNCk7XG4gICAgICAgIHRhcmdldEFycmF5LnNldChzb3VyY2VBcnJheSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IHRhcmdldFN0cmlkZSwgc291cmNlU3RyaWRlO1xuICAgICAgICAvLyBjb3B5IGRhdGEgYW5kIGludGVybGVhdmVcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHRhcmdldCA9IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgICAgICB0YXJnZXRTdHJpZGUgPSB0YXJnZXQuc3RyaWRlIC8gNDtcblxuICAgICAgICAgICAgc291cmNlID0gc291cmNlRGVzY1t0YXJnZXQubmFtZV07XG4gICAgICAgICAgICBzb3VyY2VTdHJpZGUgPSBzb3VyY2Uuc3RyaWRlIC8gNDtcbiAgICAgICAgICAgIC8vIGVuc3VyZSB3ZSBkb24ndCBnbyBiZXlvbmQgdGhlIGVuZCBvZiB0aGUgYXJyYXlidWZmZXIgd2hlbiBkZWFsaW5nIHdpdGhcbiAgICAgICAgICAgIC8vIGludGVybGFjZWQgdmVydGV4IGZvcm1hdHNcbiAgICAgICAgICAgIHNvdXJjZUFycmF5ID0gbmV3IFVpbnQzMkFycmF5KHNvdXJjZS5idWZmZXIsIHNvdXJjZS5vZmZzZXQsIChzb3VyY2UuY291bnQgLSAxKSAqIHNvdXJjZVN0cmlkZSArIChzb3VyY2Uuc2l6ZSArIDMpIC8gNCk7XG5cbiAgICAgICAgICAgIGxldCBzcmMgPSAwO1xuICAgICAgICAgICAgbGV0IGRzdCA9IHRhcmdldC5vZmZzZXQgLyA0O1xuICAgICAgICAgICAgY29uc3Qga2VuZCA9IE1hdGguZmxvb3IoKHNvdXJjZS5zaXplICsgMykgLyA0KTtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCBudW1WZXJ0aWNlczsgKytqKSB7XG4gICAgICAgICAgICAgICAgZm9yIChrID0gMDsgayA8IGtlbmQ7ICsraykge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRBcnJheVtkc3QgKyBrXSA9IHNvdXJjZUFycmF5W3NyYyArIGtdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzcmMgKz0gc291cmNlU3RyaWRlO1xuICAgICAgICAgICAgICAgIGRzdCArPSB0YXJnZXRTdHJpZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoZmxpcFYpIHtcbiAgICAgICAgZmxpcFRleENvb3JkVnModmVydGV4QnVmZmVyKTtcbiAgICB9XG5cbiAgICB2ZXJ0ZXhCdWZmZXIudW5sb2NrKCk7XG5cbiAgICByZXR1cm4gdmVydGV4QnVmZmVyO1xufTtcblxuY29uc3QgY3JlYXRlVmVydGV4QnVmZmVyID0gZnVuY3Rpb24gKGRldmljZSwgYXR0cmlidXRlcywgaW5kaWNlcywgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QpIHtcblxuICAgIC8vIGV4dHJhY3QgbGlzdCBvZiBhdHRyaWJ1dGVzIHRvIHVzZVxuICAgIGNvbnN0IHVzZUF0dHJpYnV0ZXMgPSB7fTtcbiAgICBjb25zdCBhdHRyaWJJZHMgPSBbXTtcblxuICAgIGZvciAoY29uc3QgYXR0cmliIGluIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoYXR0cmliKSAmJiBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcC5oYXNPd25Qcm9wZXJ0eShhdHRyaWIpKSB7XG4gICAgICAgICAgICB1c2VBdHRyaWJ1dGVzW2F0dHJpYl0gPSBhdHRyaWJ1dGVzW2F0dHJpYl07XG5cbiAgICAgICAgICAgIC8vIGJ1aWxkIHVuaXF1ZSBpZCBmb3IgZWFjaCBhdHRyaWJ1dGUgaW4gZm9ybWF0OiBTZW1hbnRpYzphY2Nlc3NvckluZGV4XG4gICAgICAgICAgICBhdHRyaWJJZHMucHVzaChhdHRyaWIgKyAnOicgKyBhdHRyaWJ1dGVzW2F0dHJpYl0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc29ydCB1bmlxdWUgaWRzIGFuZCBjcmVhdGUgdW5pcXVlIHZlcnRleCBidWZmZXIgSURcbiAgICBhdHRyaWJJZHMuc29ydCgpO1xuICAgIGNvbnN0IHZiS2V5ID0gYXR0cmliSWRzLmpvaW4oKTtcblxuICAgIC8vIHJldHVybiBhbHJlYWR5IGNyZWF0ZWQgdmVydGV4IGJ1ZmZlciBpZiBpZGVudGljYWxcbiAgICBsZXQgdmIgPSB2ZXJ0ZXhCdWZmZXJEaWN0W3ZiS2V5XTtcbiAgICBpZiAoIXZiKSB7XG4gICAgICAgIC8vIGJ1aWxkIHZlcnRleCBidWZmZXIgZm9ybWF0IGRlc2MgYW5kIHNvdXJjZVxuICAgICAgICBjb25zdCBzb3VyY2VEZXNjID0ge307XG4gICAgICAgIGZvciAoY29uc3QgYXR0cmliIGluIHVzZUF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGFjY2Vzc29yID0gYWNjZXNzb3JzW2F0dHJpYnV0ZXNbYXR0cmliXV07XG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NvckRhdGEgPSBnZXRBY2Nlc3NvckRhdGEoYWNjZXNzb3IsIGJ1ZmZlclZpZXdzKTtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlclZpZXcgPSBidWZmZXJWaWV3c1thY2Nlc3Nvci5idWZmZXJWaWV3XTtcbiAgICAgICAgICAgIGNvbnN0IHNlbWFudGljID0gZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXBbYXR0cmliXTtcbiAgICAgICAgICAgIGNvbnN0IHNpemUgPSBnZXROdW1Db21wb25lbnRzKGFjY2Vzc29yLnR5cGUpICogZ2V0Q29tcG9uZW50U2l6ZUluQnl0ZXMoYWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICBjb25zdCBzdHJpZGUgPSBidWZmZXJWaWV3Lmhhc093blByb3BlcnR5KCdieXRlU3RyaWRlJykgPyBidWZmZXJWaWV3LmJ5dGVTdHJpZGUgOiBzaXplO1xuICAgICAgICAgICAgc291cmNlRGVzY1tzZW1hbnRpY10gPSB7XG4gICAgICAgICAgICAgICAgYnVmZmVyOiBhY2Nlc3NvckRhdGEuYnVmZmVyLFxuICAgICAgICAgICAgICAgIHNpemU6IHNpemUsXG4gICAgICAgICAgICAgICAgb2Zmc2V0OiBhY2Nlc3NvckRhdGEuYnl0ZU9mZnNldCxcbiAgICAgICAgICAgICAgICBzdHJpZGU6IHN0cmlkZSxcbiAgICAgICAgICAgICAgICBjb3VudDogYWNjZXNzb3IuY291bnQsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogZ2V0TnVtQ29tcG9uZW50cyhhY2Nlc3Nvci50eXBlKSxcbiAgICAgICAgICAgICAgICB0eXBlOiBnZXRDb21wb25lbnRUeXBlKGFjY2Vzc29yLmNvbXBvbmVudFR5cGUpLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZTogYWNjZXNzb3Iubm9ybWFsaXplZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGdlbmVyYXRlIG5vcm1hbHMgaWYgdGhleSdyZSBtaXNzaW5nICh0aGlzIHNob3VsZCBwcm9iYWJseSBiZSBhIHVzZXIgb3B0aW9uKVxuICAgICAgICBpZiAoIXNvdXJjZURlc2MuaGFzT3duUHJvcGVydHkoU0VNQU5USUNfTk9STUFMKSkge1xuICAgICAgICAgICAgZ2VuZXJhdGVOb3JtYWxzKHNvdXJjZURlc2MsIGluZGljZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCBzdG9yZSBpdCBpbiB0aGUgZGljdGlvbmFyeVxuICAgICAgICB2YiA9IGNyZWF0ZVZlcnRleEJ1ZmZlckludGVybmFsKGRldmljZSwgc291cmNlRGVzYywgZmxpcFYpO1xuICAgICAgICB2ZXJ0ZXhCdWZmZXJEaWN0W3ZiS2V5XSA9IHZiO1xuICAgIH1cblxuICAgIHJldHVybiB2Yjtcbn07XG5cbmNvbnN0IGNyZWF0ZVZlcnRleEJ1ZmZlckRyYWNvID0gZnVuY3Rpb24gKGRldmljZSwgb3V0cHV0R2VvbWV0cnksIGV4dERyYWNvLCBkZWNvZGVyLCBkZWNvZGVyTW9kdWxlLCBpbmRpY2VzLCBmbGlwVikge1xuXG4gICAgY29uc3QgbnVtUG9pbnRzID0gb3V0cHV0R2VvbWV0cnkubnVtX3BvaW50cygpO1xuXG4gICAgLy8gaGVscGVyIGZ1bmN0aW9uIHRvIGRlY29kZSBkYXRhIHN0cmVhbSB3aXRoIGlkIHRvIFR5cGVkQXJyYXkgb2YgYXBwcm9wcmlhdGUgdHlwZVxuICAgIGNvbnN0IGV4dHJhY3REcmFjb0F0dHJpYnV0ZUluZm8gPSBmdW5jdGlvbiAodW5pcXVlSWQsIHNlbWFudGljKSB7XG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZSA9IGRlY29kZXIuR2V0QXR0cmlidXRlQnlVbmlxdWVJZChvdXRwdXRHZW9tZXRyeSwgdW5pcXVlSWQpO1xuICAgICAgICBjb25zdCBudW1WYWx1ZXMgPSBudW1Qb2ludHMgKiBhdHRyaWJ1dGUubnVtX2NvbXBvbmVudHMoKTtcbiAgICAgICAgY29uc3QgZHJhY29Gb3JtYXQgPSBhdHRyaWJ1dGUuZGF0YV90eXBlKCk7XG4gICAgICAgIGxldCBwdHIsIHZhbHVlcywgY29tcG9uZW50U2l6ZUluQnl0ZXMsIHN0b3JhZ2VUeXBlO1xuXG4gICAgICAgIC8vIHN0b3JhZ2UgZm9ybWF0IGlzIGJhc2VkIG9uIGRyYWNvIGF0dHJpYnV0ZSBkYXRhIHR5cGVcbiAgICAgICAgc3dpdGNoIChkcmFjb0Zvcm1hdCkge1xuXG4gICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuRFRfVUlOVDg6XG4gICAgICAgICAgICAgICAgc3RvcmFnZVR5cGUgPSBUWVBFX1VJTlQ4O1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzID0gMTtcbiAgICAgICAgICAgICAgICBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MobnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMpO1xuICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0QXR0cmlidXRlRGF0YUFycmF5Rm9yQWxsUG9pbnRzKG91dHB1dEdlb21ldHJ5LCBhdHRyaWJ1dGUsIGRlY29kZXJNb2R1bGUuRFRfVUlOVDgsIG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBwdHIpO1xuICAgICAgICAgICAgICAgIHZhbHVlcyA9IG5ldyBVaW50OEFycmF5KGRlY29kZXJNb2R1bGUuSEVBUFU4LmJ1ZmZlciwgcHRyLCBudW1WYWx1ZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5EVF9VSU5UMTY6XG4gICAgICAgICAgICAgICAgc3RvcmFnZVR5cGUgPSBUWVBFX1VJTlQxNjtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRTaXplSW5CeXRlcyA9IDI7XG4gICAgICAgICAgICAgICAgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzKTtcbiAgICAgICAgICAgICAgICBkZWNvZGVyLkdldEF0dHJpYnV0ZURhdGFBcnJheUZvckFsbFBvaW50cyhvdXRwdXRHZW9tZXRyeSwgYXR0cmlidXRlLCBkZWNvZGVyTW9kdWxlLkRUX1VJTlQxNiwgbnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMsIHB0cik7XG4gICAgICAgICAgICAgICAgdmFsdWVzID0gbmV3IFVpbnQxNkFycmF5KGRlY29kZXJNb2R1bGUuSEVBUFUxNi5idWZmZXIsIHB0ciwgbnVtVmFsdWVzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuRFRfRkxPQVQzMjpcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgc3RvcmFnZVR5cGUgPSBUWVBFX0ZMT0FUMzI7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50U2l6ZUluQnl0ZXMgPSA0O1xuICAgICAgICAgICAgICAgIHB0ciA9IGRlY29kZXJNb2R1bGUuX21hbGxvYyhudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcyk7XG4gICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMob3V0cHV0R2VvbWV0cnksIGF0dHJpYnV0ZSwgZGVjb2Rlck1vZHVsZS5EVF9GTE9BVDMyLCBudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcywgcHRyKTtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBuZXcgRmxvYXQzMkFycmF5KGRlY29kZXJNb2R1bGUuSEVBUEYzMi5idWZmZXIsIHB0ciwgbnVtVmFsdWVzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVjb2Rlck1vZHVsZS5fZnJlZShwdHIpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2YWx1ZXM6IHZhbHVlcyxcbiAgICAgICAgICAgIG51bUNvbXBvbmVudHM6IGF0dHJpYnV0ZS5udW1fY29tcG9uZW50cygpLFxuICAgICAgICAgICAgY29tcG9uZW50U2l6ZUluQnl0ZXM6IGNvbXBvbmVudFNpemVJbkJ5dGVzLFxuICAgICAgICAgICAgc3RvcmFnZVR5cGU6IHN0b3JhZ2VUeXBlLFxuXG4gICAgICAgICAgICAvLyB0aGVyZSBhcmUgZ2xiIGZpbGVzIGFyb3VuZCB3aGVyZSA4Yml0IGNvbG9ycyBhcmUgbWlzc2luZyBub3JtYWxpemVkIGZsYWdcbiAgICAgICAgICAgIG5vcm1hbGl6ZWQ6IChzZW1hbnRpYyA9PT0gU0VNQU5USUNfQ09MT1IgJiYgc3RvcmFnZVR5cGUgPT09IFRZUEVfVUlOVDgpID8gdHJ1ZSA6IGF0dHJpYnV0ZS5ub3JtYWxpemVkKClcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gYnVpbGQgdmVydGV4IGJ1ZmZlciBmb3JtYXQgZGVzYyBhbmQgc291cmNlXG4gICAgY29uc3Qgc291cmNlRGVzYyA9IHt9O1xuICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBleHREcmFjby5hdHRyaWJ1dGVzO1xuICAgIGZvciAoY29uc3QgYXR0cmliIGluIGF0dHJpYnV0ZXMpIHtcbiAgICAgICAgaWYgKGF0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoYXR0cmliKSAmJiBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcC5oYXNPd25Qcm9wZXJ0eShhdHRyaWIpKSB7XG4gICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGdsdGZUb0VuZ2luZVNlbWFudGljTWFwW2F0dHJpYl07XG4gICAgICAgICAgICBjb25zdCBhdHRyaWJ1dGVJbmZvID0gZXh0cmFjdERyYWNvQXR0cmlidXRlSW5mbyhhdHRyaWJ1dGVzW2F0dHJpYl0sIHNlbWFudGljKTtcblxuICAgICAgICAgICAgLy8gc3RvcmUgdGhlIGluZm8gd2UnbGwgbmVlZCB0byBjb3B5IHRoaXMgZGF0YSBpbnRvIHRoZSB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgICAgICBjb25zdCBzaXplID0gYXR0cmlidXRlSW5mby5udW1Db21wb25lbnRzICogYXR0cmlidXRlSW5mby5jb21wb25lbnRTaXplSW5CeXRlcztcbiAgICAgICAgICAgIHNvdXJjZURlc2Nbc2VtYW50aWNdID0ge1xuICAgICAgICAgICAgICAgIHZhbHVlczogYXR0cmlidXRlSW5mby52YWx1ZXMsXG4gICAgICAgICAgICAgICAgYnVmZmVyOiBhdHRyaWJ1dGVJbmZvLnZhbHVlcy5idWZmZXIsXG4gICAgICAgICAgICAgICAgc2l6ZTogc2l6ZSxcbiAgICAgICAgICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgICAgICAgICAgc3RyaWRlOiBzaXplLFxuICAgICAgICAgICAgICAgIGNvdW50OiBudW1Qb2ludHMsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogYXR0cmlidXRlSW5mby5udW1Db21wb25lbnRzLFxuICAgICAgICAgICAgICAgIHR5cGU6IGF0dHJpYnV0ZUluZm8uc3RvcmFnZVR5cGUsXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiBhdHRyaWJ1dGVJbmZvLm5vcm1hbGl6ZWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZSBub3JtYWxzIGlmIHRoZXkncmUgbWlzc2luZyAodGhpcyBzaG91bGQgcHJvYmFibHkgYmUgYSB1c2VyIG9wdGlvbilcbiAgICBpZiAoIXNvdXJjZURlc2MuaGFzT3duUHJvcGVydHkoU0VNQU5USUNfTk9STUFMKSkge1xuICAgICAgICBnZW5lcmF0ZU5vcm1hbHMoc291cmNlRGVzYywgaW5kaWNlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyZWF0ZVZlcnRleEJ1ZmZlckludGVybmFsKGRldmljZSwgc291cmNlRGVzYywgZmxpcFYpO1xufTtcblxuY29uc3QgY3JlYXRlU2tpbiA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGZTa2luLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2xiU2tpbnMpIHtcbiAgICBsZXQgaSwgaiwgYmluZE1hdHJpeDtcbiAgICBjb25zdCBqb2ludHMgPSBnbHRmU2tpbi5qb2ludHM7XG4gICAgY29uc3QgbnVtSm9pbnRzID0gam9pbnRzLmxlbmd0aDtcbiAgICBjb25zdCBpYnAgPSBbXTtcbiAgICBpZiAoZ2x0ZlNraW4uaGFzT3duUHJvcGVydHkoJ2ludmVyc2VCaW5kTWF0cmljZXMnKSkge1xuICAgICAgICBjb25zdCBpbnZlcnNlQmluZE1hdHJpY2VzID0gZ2x0ZlNraW4uaW52ZXJzZUJpbmRNYXRyaWNlcztcbiAgICAgICAgY29uc3QgaWJtRGF0YSA9IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvcnNbaW52ZXJzZUJpbmRNYXRyaWNlc10sIGJ1ZmZlclZpZXdzLCB0cnVlKTtcbiAgICAgICAgY29uc3QgaWJtVmFsdWVzID0gW107XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG51bUpvaW50czsgaSsrKSB7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgMTY7IGorKykge1xuICAgICAgICAgICAgICAgIGlibVZhbHVlc1tqXSA9IGlibURhdGFbaSAqIDE2ICsgal07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBiaW5kTWF0cml4ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgICAgIGJpbmRNYXRyaXguc2V0KGlibVZhbHVlcyk7XG4gICAgICAgICAgICBpYnAucHVzaChiaW5kTWF0cml4KTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBudW1Kb2ludHM7IGkrKykge1xuICAgICAgICAgICAgYmluZE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgICAgICBpYnAucHVzaChiaW5kTWF0cml4KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGJvbmVOYW1lcyA9IFtdO1xuICAgIGZvciAoaSA9IDA7IGkgPCBudW1Kb2ludHM7IGkrKykge1xuICAgICAgICBib25lTmFtZXNbaV0gPSBub2Rlc1tqb2ludHNbaV1dLm5hbWU7XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlIGEgY2FjaGUga2V5IGZyb20gYm9uZSBuYW1lcyBhbmQgc2VlIGlmIHdlIGhhdmUgbWF0Y2hpbmcgc2tpblxuICAgIGNvbnN0IGtleSA9IGJvbmVOYW1lcy5qb2luKCcjJyk7XG4gICAgbGV0IHNraW4gPSBnbGJTa2lucy5nZXQoa2V5KTtcbiAgICBpZiAoIXNraW4pIHtcblxuICAgICAgICAvLyBjcmVhdGUgdGhlIHNraW4gYW5kIGFkZCBpdCB0byB0aGUgY2FjaGVcbiAgICAgICAgc2tpbiA9IG5ldyBTa2luKGRldmljZSwgaWJwLCBib25lTmFtZXMpO1xuICAgICAgICBnbGJTa2lucy5zZXQoa2V5LCBza2luKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2tpbjtcbn07XG5cbmNvbnN0IHRlbXBNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3QgdGVtcFZlYyA9IG5ldyBWZWMzKCk7XG5cbmNvbnN0IGNyZWF0ZU1lc2ggPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmTWVzaCwgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgY2FsbGJhY2ssIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0LCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBhc3NldE9wdGlvbnMpIHtcbiAgICBjb25zdCBtZXNoZXMgPSBbXTtcblxuICAgIGdsdGZNZXNoLnByaW1pdGl2ZXMuZm9yRWFjaChmdW5jdGlvbiAocHJpbWl0aXZlKSB7XG5cbiAgICAgICAgbGV0IHByaW1pdGl2ZVR5cGUsIHZlcnRleEJ1ZmZlciwgbnVtSW5kaWNlcztcbiAgICAgICAgbGV0IGluZGljZXMgPSBudWxsO1xuICAgICAgICBsZXQgY2FuVXNlTW9ycGggPSB0cnVlO1xuXG4gICAgICAgIC8vIHRyeSBhbmQgZ2V0IGRyYWNvIGNvbXByZXNzZWQgZGF0YSBmaXJzdFxuICAgICAgICBpZiAocHJpbWl0aXZlLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbnMgPSBwcmltaXRpdmUuZXh0ZW5zaW9ucztcbiAgICAgICAgICAgIGlmIChleHRlbnNpb25zLmhhc093blByb3BlcnR5KCdLSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbicpKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBhY2Nlc3MgRHJhY29EZWNvZGVyTW9kdWxlXG4gICAgICAgICAgICAgICAgY29uc3QgZGVjb2Rlck1vZHVsZSA9IGRyYWNvRGVjb2Rlckluc3RhbmNlIHx8IGdldEdsb2JhbERyYWNvRGVjb2Rlck1vZHVsZSgpO1xuICAgICAgICAgICAgICAgIGlmIChkZWNvZGVyTW9kdWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dERyYWNvID0gZXh0ZW5zaW9ucy5LSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4dERyYWNvLmhhc093blByb3BlcnR5KCdhdHRyaWJ1dGVzJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVpbnQ4QnVmZmVyID0gYnVmZmVyVmlld3NbZXh0RHJhY28uYnVmZmVyVmlld107XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBuZXcgZGVjb2Rlck1vZHVsZS5EZWNvZGVyQnVmZmVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBidWZmZXIuSW5pdCh1aW50OEJ1ZmZlciwgdWludDhCdWZmZXIubGVuZ3RoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVjb2RlciA9IG5ldyBkZWNvZGVyTW9kdWxlLkRlY29kZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGdlb21ldHJ5VHlwZSA9IGRlY29kZXIuR2V0RW5jb2RlZEdlb21ldHJ5VHlwZShidWZmZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgb3V0cHV0R2VvbWV0cnksIHN0YXR1cztcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZ2VvbWV0cnlUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLlBPSU5UX0NMT1VEOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmltaXRpdmVUeXBlID0gUFJJTUlUSVZFX1BPSU5UUztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0R2VvbWV0cnkgPSBuZXcgZGVjb2Rlck1vZHVsZS5Qb2ludENsb3VkKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1cyA9IGRlY29kZXIuRGVjb2RlQnVmZmVyVG9Qb2ludENsb3VkKGJ1ZmZlciwgb3V0cHV0R2VvbWV0cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuVFJJQU5HVUxBUl9NRVNIOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmltaXRpdmVUeXBlID0gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0cHV0R2VvbWV0cnkgPSBuZXcgZGVjb2Rlck1vZHVsZS5NZXNoKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1cyA9IGRlY29kZXIuRGVjb2RlQnVmZmVyVG9NZXNoKGJ1ZmZlciwgb3V0cHV0R2VvbWV0cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuSU5WQUxJRF9HRU9NRVRSWV9UWVBFOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXN0YXR1cyB8fCAhc3RhdHVzLm9rKCkgfHwgb3V0cHV0R2VvbWV0cnkucHRyID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soJ0ZhaWxlZCB0byBkZWNvZGUgZHJhY28gY29tcHJlc3NlZCBhc3NldDogJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKHN0YXR1cyA/IHN0YXR1cy5lcnJvcl9tc2coKSA6ICgnTWVzaCBhc3NldCAtIGludmFsaWQgZHJhY28gY29tcHJlc3NlZCBnZW9tZXRyeSB0eXBlOiAnICsgZ2VvbWV0cnlUeXBlKSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaW5kaWNlc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbnVtRmFjZXMgPSBvdXRwdXRHZW9tZXRyeS5udW1fZmFjZXMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChnZW9tZXRyeVR5cGUgPT09IGRlY29kZXJNb2R1bGUuVFJJQU5HVUxBUl9NRVNIKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYml0MzIgPSBvdXRwdXRHZW9tZXRyeS5udW1fcG9pbnRzKCkgPiA2NTUzNTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bUluZGljZXMgPSBudW1GYWNlcyAqIDM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGF0YVNpemUgPSBudW1JbmRpY2VzICogKGJpdDMyID8gNCA6IDIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHB0ciA9IGRlY29kZXJNb2R1bGUuX21hbGxvYyhkYXRhU2l6ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYml0MzIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRUcmlhbmdsZXNVSW50MzJBcnJheShvdXRwdXRHZW9tZXRyeSwgZGF0YVNpemUsIHB0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGljZXMgPSBuZXcgVWludDMyQXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQVTMyLmJ1ZmZlciwgcHRyLCBudW1JbmRpY2VzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0VHJpYW5nbGVzVUludDE2QXJyYXkob3V0cHV0R2VvbWV0cnksIGRhdGFTaXplLCBwdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KGRlY29kZXJNb2R1bGUuSEVBUFUxNi5idWZmZXIsIHB0ciwgbnVtSW5kaWNlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLl9mcmVlKHB0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHZlcnRpY2VzXG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXJ0ZXhCdWZmZXIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXJEcmFjbyhkZXZpY2UsIG91dHB1dEdlb21ldHJ5LCBleHREcmFjbywgZGVjb2RlciwgZGVjb2Rlck1vZHVsZSwgaW5kaWNlcywgZmxpcFYpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjbGVhbiB1cFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5kZXN0cm95KG91dHB1dEdlb21ldHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXJNb2R1bGUuZGVzdHJveShkZWNvZGVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXJNb2R1bGUuZGVzdHJveShidWZmZXIpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtb3JwaCBzdHJlYW1zIGFyZSBub3QgY29tcGF0aWJsZSB3aXRoIGRyYWNvIGNvbXByZXNzaW9uLCBkaXNhYmxlIG1vcnBoaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBjYW5Vc2VNb3JwaCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2FybignRmlsZSBjb250YWlucyBkcmFjbyBjb21wcmVzc2VkIGRhdGEsIGJ1dCBEcmFjb0RlY29kZXJNb2R1bGUgaXMgbm90IGNvbmZpZ3VyZWQuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgbWVzaCB3YXMgbm90IGNvbnN0cnVjdGVkIGZyb20gZHJhY28gZGF0YSwgdXNlIHVuY29tcHJlc3NlZFxuICAgICAgICBpZiAoIXZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgaW5kaWNlcyA9IHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgnaW5kaWNlcycpID8gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yc1twcmltaXRpdmUuaW5kaWNlc10sIGJ1ZmZlclZpZXdzLCB0cnVlKSA6IG51bGw7XG4gICAgICAgICAgICB2ZXJ0ZXhCdWZmZXIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXIoZGV2aWNlLCBwcmltaXRpdmUuYXR0cmlidXRlcywgaW5kaWNlcywgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QpO1xuICAgICAgICAgICAgcHJpbWl0aXZlVHlwZSA9IGdldFByaW1pdGl2ZVR5cGUocHJpbWl0aXZlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBtZXNoID0gbnVsbDtcbiAgICAgICAgaWYgKHZlcnRleEJ1ZmZlcikge1xuICAgICAgICAgICAgLy8gYnVpbGQgdGhlIG1lc2hcbiAgICAgICAgICAgIG1lc2ggPSBuZXcgTWVzaChkZXZpY2UpO1xuICAgICAgICAgICAgbWVzaC52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS50eXBlID0gcHJpbWl0aXZlVHlwZTtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uaW5kZXhlZCA9IChpbmRpY2VzICE9PSBudWxsKTtcblxuICAgICAgICAgICAgLy8gaW5kZXggYnVmZmVyXG4gICAgICAgICAgICBpZiAoaW5kaWNlcyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGxldCBpbmRleEZvcm1hdDtcbiAgICAgICAgICAgICAgICBpZiAoaW5kaWNlcyBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UODtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGluZGljZXMgaW5zdGFuY2VvZiBVaW50MTZBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQzMjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyAzMmJpdCBpbmRleCBidWZmZXIgaXMgdXNlZCBidXQgbm90IHN1cHBvcnRlZFxuICAgICAgICAgICAgICAgIGlmIChpbmRleEZvcm1hdCA9PT0gSU5ERVhGT1JNQVRfVUlOVDMyICYmICFkZXZpY2UuZXh0VWludEVsZW1lbnQpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXMgPiAweEZGRkYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignR2xiIGZpbGUgY29udGFpbnMgMzJiaXQgaW5kZXggYnVmZmVyIGJ1dCB0aGVzZSBhcmUgbm90IHN1cHBvcnRlZCBieSB0aGlzIGRldmljZSAtIGl0IG1heSBiZSByZW5kZXJlZCBpbmNvcnJlY3RseS4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgICAgICAvLyBjb252ZXJ0IHRvIDE2Yml0XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KGluZGljZXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gbmV3IEluZGV4QnVmZmVyKGRldmljZSwgaW5kZXhGb3JtYXQsIGluZGljZXMubGVuZ3RoLCBCVUZGRVJfU1RBVElDLCBpbmRpY2VzKTtcbiAgICAgICAgICAgICAgICBtZXNoLmluZGV4QnVmZmVyWzBdID0gaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPSBpbmRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPSB2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoXCJleHRlbnNpb25zXCIpICYmIHByaW1pdGl2ZS5leHRlbnNpb25zLmhhc093blByb3BlcnR5KFwiS0hSX21hdGVyaWFsc192YXJpYW50c1wiKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhcmlhbnRzID0gcHJpbWl0aXZlLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cztcbiAgICAgICAgICAgICAgICBjb25zdCB0ZW1wTWFwcGluZyA9IHt9O1xuICAgICAgICAgICAgICAgIHZhcmlhbnRzLm1hcHBpbmdzLmZvckVhY2goKG1hcHBpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZy52YXJpYW50cy5mb3JFYWNoKCh2YXJpYW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wTWFwcGluZ1t2YXJpYW50XSA9IG1hcHBpbmcubWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIG1lc2hWYXJpYW50c1ttZXNoLmlkXSA9IHRlbXBNYXBwaW5nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtZXNoRGVmYXVsdE1hdGVyaWFsc1ttZXNoLmlkXSA9IHByaW1pdGl2ZS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgbGV0IGFjY2Vzc29yID0gYWNjZXNzb3JzW3ByaW1pdGl2ZS5hdHRyaWJ1dGVzLlBPU0lUSU9OXTtcbiAgICAgICAgICAgIG1lc2guYWFiYiA9IGdldEFjY2Vzc29yQm91bmRpbmdCb3goYWNjZXNzb3IpO1xuXG4gICAgICAgICAgICAvLyBtb3JwaCB0YXJnZXRzXG4gICAgICAgICAgICBpZiAoY2FuVXNlTW9ycGggJiYgcHJpbWl0aXZlLmhhc093blByb3BlcnR5KCd0YXJnZXRzJykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRzID0gW107XG5cbiAgICAgICAgICAgICAgICBwcmltaXRpdmUudGFyZ2V0cy5mb3JFYWNoKGZ1bmN0aW9uICh0YXJnZXQsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7fTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Lmhhc093blByb3BlcnR5KCdQT1NJVElPTicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2Nlc3NvciA9IGFjY2Vzc29yc1t0YXJnZXQuUE9TSVRJT05dO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YVBvc2l0aW9ucyA9IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoYWNjZXNzb3IsIGJ1ZmZlclZpZXdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFQb3NpdGlvbnNUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5hYWJiID0gZ2V0QWNjZXNzb3JCb3VuZGluZ0JveChhY2Nlc3Nvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Lmhhc093blByb3BlcnR5KCdOT1JNQUwnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbdGFyZ2V0Lk5PUk1BTF07XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOT1RFOiB0aGUgbW9ycGggdGFyZ2V0cyBjYW4ndCBjdXJyZW50bHkgYWNjZXB0IHF1YW50aXplZCBub3JtYWxzXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhTm9ybWFscyA9IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoYWNjZXNzb3IsIGJ1ZmZlclZpZXdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFOb3JtYWxzVHlwZSA9IFRZUEVfRkxPQVQzMjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIG5hbWUgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTWVzaC5oYXNPd25Qcm9wZXJ0eSgnZXh0cmFzJykgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZNZXNoLmV4dHJhcy5oYXNPd25Qcm9wZXJ0eSgndGFyZ2V0TmFtZXMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uYW1lID0gZ2x0Zk1lc2guZXh0cmFzLnRhcmdldE5hbWVzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubmFtZSA9IGluZGV4LnRvU3RyaW5nKDEwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgd2VpZ2h0IGlmIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0Zk1lc2guaGFzT3duUHJvcGVydHkoJ3dlaWdodHMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWZhdWx0V2VpZ2h0ID0gZ2x0Zk1lc2gud2VpZ2h0c1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnByZXNlcnZlRGF0YSA9IGFzc2V0T3B0aW9ucy5tb3JwaFByZXNlcnZlRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0cy5wdXNoKG5ldyBNb3JwaFRhcmdldChvcHRpb25zKSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBtZXNoLm1vcnBoID0gbmV3IE1vcnBoKHRhcmdldHMsIGRldmljZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBtZXNoZXMucHVzaChtZXNoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBtZXNoZXM7XG59O1xuXG5jb25zdCBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIChzb3VyY2UsIG1hdGVyaWFsLCBtYXBzKSB7XG4gICAgbGV0IG1hcDtcblxuICAgIGNvbnN0IHRleENvb3JkID0gc291cmNlLnRleENvb3JkO1xuICAgIGlmICh0ZXhDb29yZCkge1xuICAgICAgICBmb3IgKG1hcCA9IDA7IG1hcCA8IG1hcHMubGVuZ3RoOyArK21hcCkge1xuICAgICAgICAgICAgbWF0ZXJpYWxbbWFwc1ttYXBdICsgJ01hcFV2J10gPSB0ZXhDb29yZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHplcm9zID0gWzAsIDBdO1xuICAgIGNvbnN0IG9uZXMgPSBbMSwgMV07XG4gICAgY29uc3QgdGV4dHVyZVRyYW5zZm9ybSA9IHNvdXJjZS5leHRlbnNpb25zPy5LSFJfdGV4dHVyZV90cmFuc2Zvcm07XG4gICAgaWYgKHRleHR1cmVUcmFuc2Zvcm0pIHtcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdGV4dHVyZVRyYW5zZm9ybS5vZmZzZXQgfHwgemVyb3M7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gdGV4dHVyZVRyYW5zZm9ybS5zY2FsZSB8fCBvbmVzO1xuICAgICAgICBjb25zdCByb3RhdGlvbiA9IHRleHR1cmVUcmFuc2Zvcm0ucm90YXRpb24gPyAoLXRleHR1cmVUcmFuc2Zvcm0ucm90YXRpb24gKiBtYXRoLlJBRF9UT19ERUcpIDogMDtcblxuICAgICAgICBjb25zdCB0aWxpbmdWZWMgPSBuZXcgVmVjMihzY2FsZVswXSwgc2NhbGVbMV0pO1xuICAgICAgICBjb25zdCBvZmZzZXRWZWMgPSBuZXcgVmVjMihvZmZzZXRbMF0sIDEuMCAtIHNjYWxlWzFdIC0gb2Zmc2V0WzFdKTtcblxuICAgICAgICBmb3IgKG1hcCA9IDA7IG1hcCA8IG1hcHMubGVuZ3RoOyArK21hcCkge1xuICAgICAgICAgICAgbWF0ZXJpYWxbYCR7bWFwc1ttYXBdfU1hcFRpbGluZ2BdID0gdGlsaW5nVmVjO1xuICAgICAgICAgICAgbWF0ZXJpYWxbYCR7bWFwc1ttYXBdfU1hcE9mZnNldGBdID0gb2Zmc2V0VmVjO1xuICAgICAgICAgICAgbWF0ZXJpYWxbYCR7bWFwc1ttYXBdfU1hcFJvdGF0aW9uYF0gPSByb3RhdGlvbjtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIGxldCBjb2xvciwgdGV4dHVyZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZGlmZnVzZUZhY3RvcicpKSB7XG4gICAgICAgIGNvbG9yID0gZGF0YS5kaWZmdXNlRmFjdG9yO1xuICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSBjb2xvclszXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgxLCAxLCAxKTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IDE7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdkaWZmdXNlVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGRpZmZ1c2VUZXh0dXJlID0gZGF0YS5kaWZmdXNlVGV4dHVyZTtcbiAgICAgICAgdGV4dHVyZSA9IHRleHR1cmVzW2RpZmZ1c2VUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwID0gdGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcCA9IHRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRpZmZ1c2VUZXh0dXJlLCBtYXRlcmlhbCwgWydkaWZmdXNlJywgJ29wYWNpdHknXSk7XG4gICAgfVxuICAgIG1hdGVyaWFsLnVzZU1ldGFsbmVzcyA9IGZhbHNlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckZhY3RvcicpKSB7XG4gICAgICAgIGNvbG9yID0gZGF0YS5zcGVjdWxhckZhY3RvcjtcbiAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdnbG9zc2luZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hpbmluZXNzID0gMTAwICogZGF0YS5nbG9zc2luZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNoaW5pbmVzcyA9IDEwMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlID0gZGF0YS5zcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhckVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcCA9IG1hdGVyaWFsLmdsb3NzTWFwID0gdGV4dHVyZXNbc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICBtYXRlcmlhbC5nbG9zc01hcENoYW5uZWwgPSAnYSc7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZ2xvc3MnLCAnbWV0YWxuZXNzJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbkNsZWFyQ29hdCA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0RmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0ID0gZGF0YS5jbGVhcmNvYXRGYWN0b3IgKiAwLjI1OyAvLyBUT0RPOiByZW1vdmUgdGVtcG9yYXJ5IHdvcmthcm91bmQgZm9yIHJlcGxpY2F0aW5nIGdsVEYgY2xlYXItY29hdCB2aXN1YWxzXG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0ID0gMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXRUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXRUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXRUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0TWFwQ2hhbm5lbCA9ICdyJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXRUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXQnXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRSb3VnaG5lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc2luZXNzID0gZGF0YS5jbGVhcmNvYXRSb3VnaG5lc3NGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NpbmVzcyA9IDA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSA9IGRhdGEuY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsID0gJ2cnO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2NsZWFyQ29hdEdsb3NzJ10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdE5vcm1hbFRleHR1cmUgPSBkYXRhLmNsZWFyY29hdE5vcm1hbFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdE5vcm1hbE1hcCA9IHRleHR1cmVzW2NsZWFyY29hdE5vcm1hbFRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGNsZWFyY29hdE5vcm1hbFRleHR1cmUsIG1hdGVyaWFsLCBbJ2NsZWFyQ29hdE5vcm1hbCddKTtcblxuICAgICAgICBpZiAoY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZS5oYXNPd25Qcm9wZXJ0eSgnc2NhbGUnKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0QnVtcGluZXNzID0gY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZS5zY2FsZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNsZWFyQ29hdEdsb3NzQ2h1bmsgPSAvKiBnbHNsICovYFxuICAgICAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICAgICAgdW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9jbGVhckNvYXRHbG9zc2luZXNzO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgIHZvaWQgZ2V0Q2xlYXJDb2F0R2xvc3NpbmVzcygpIHtcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyA9IDEuMDtcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBGTE9BVFxuICAgICAgICAgICAgY2NHbG9zc2luZXNzICo9IG1hdGVyaWFsX2NsZWFyQ29hdEdsb3NzaW5lc3M7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyAqPSB0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKS4kQ0g7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUFZFUlRFWFxuICAgICAgICAgICAgY2NHbG9zc2luZXNzICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgPSAxLjAgLSBjY0dsb3NzaW5lc3M7XG4gICAgICAgIFxuICAgICAgICAgICAgY2NHbG9zc2luZXNzICs9IDAuMDAwMDAwMTtcbiAgICAgICAgfVxuICAgICAgICBgO1xuICAgIG1hdGVyaWFsLmNodW5rcy5jbGVhckNvYXRHbG9zc1BTID0gY2xlYXJDb2F0R2xvc3NDaHVuaztcbn07XG5cbmNvbnN0IGV4dGVuc2lvblVubGl0ID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZUxpZ2h0aW5nID0gZmFsc2U7XG5cbiAgICAvLyBjb3B5IGRpZmZ1c2UgaW50byBlbWlzc2l2ZVxuICAgIG1hdGVyaWFsLmVtaXNzaXZlLmNvcHkobWF0ZXJpYWwuZGlmZnVzZSk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gbWF0ZXJpYWwuZGlmZnVzZVRpbnQ7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSBtYXRlcmlhbC5kaWZmdXNlTWFwO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwVXYgPSBtYXRlcmlhbC5kaWZmdXNlTWFwVXY7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBUaWxpbmcuY29weShtYXRlcmlhbC5kaWZmdXNlTWFwVGlsaW5nKTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcE9mZnNldC5jb3B5KG1hdGVyaWFsLmRpZmZ1c2VNYXBPZmZzZXQpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwUm90YXRpb24gPSBtYXRlcmlhbC5kaWZmdXNlTWFwUm90YXRpb247XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBDaGFubmVsID0gbWF0ZXJpYWwuZGlmZnVzZU1hcENoYW5uZWw7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVWZXJ0ZXhDb2xvciA9IG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvcjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCA9IG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvckNoYW5uZWw7XG5cbiAgICAvLyBibGFuayBkaWZmdXNlXG4gICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMCwgMCwgMCk7XG4gICAgbWF0ZXJpYWwuZGlmZnVzZVRpbnQgPSBmYWxzZTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlTWFwID0gbnVsbDtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3IgPSBmYWxzZTtcbn07XG5cbmNvbnN0IGV4dGVuc2lvblNwZWN1bGFyID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IgPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckNvbG9yVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyRW5jb2RpbmcgPSAnc3JnYic7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwID0gdGV4dHVyZXNbZGF0YS5zcGVjdWxhckNvbG9yVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwQ2hhbm5lbCA9ICdyZ2InO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc3BlY3VsYXJDb2xvclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NwZWN1bGFyJ10pO1xuXG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckNvbG9yRmFjdG9yJykpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSBkYXRhLnNwZWN1bGFyQ29sb3JGYWN0b3I7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgfVxuXG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3IgPSBkYXRhLnNwZWN1bGFyRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyaXR5RmFjdG9yID0gMTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyaXR5RmFjdG9yTWFwQ2hhbm5lbCA9ICdhJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3JNYXAgPSB0ZXh0dXJlc1tkYXRhLnNwZWN1bGFyVGV4dHVyZS5pbmRleF07XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc3BlY3VsYXJUZXh0dXJlLCBtYXRlcmlhbCwgWydzcGVjdWxhcml0eUZhY3RvciddKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25Jb3IgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25JbmRleCA9IDEuMCAvIGRhdGEuaW9yO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvblRyYW5zbWlzc2lvbiA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgbWF0ZXJpYWwudXNlRHluYW1pY1JlZnJhY3Rpb24gPSB0cnVlO1xuXG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RyYW5zbWlzc2lvbkZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb24gPSBkYXRhLnRyYW5zbWlzc2lvbkZhY3RvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RyYW5zbWlzc2lvblRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uTWFwQ2hhbm5lbCA9ICdyJztcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbk1hcCA9IHRleHR1cmVzW2RhdGEudHJhbnNtaXNzaW9uVGV4dHVyZS5pbmRleF07XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEudHJhbnNtaXNzaW9uVGV4dHVyZSwgbWF0ZXJpYWwsIFsncmVmcmFjdGlvbiddKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25TaGVlbiA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC51c2VTaGVlbiA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuQ29sb3JGYWN0b3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuc2hlZW5Db2xvckZhY3RvcjtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW4uc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuLnNldCgxLCAxLCAxKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5NYXAgPSB0ZXh0dXJlc1tkYXRhLnNoZWVuQ29sb3JUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5FbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zaGVlbkNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc2hlZW4nXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlblJvdWdobmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NpbmVzcyA9IGRhdGEuc2hlZW5Sb3VnaG5lc3NGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zc2luZXNzID0gMC4wO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Sb3VnaG5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zc2luZXNzTWFwID0gdGV4dHVyZXNbZGF0YS5zaGVlblJvdWdobmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzaW5lc3NNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNoZWVuUm91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc2hlZW5HbG9zc2luZXNzJ10pO1xuICAgIH1cblxuICAgIGNvbnN0IHNoZWVuR2xvc3NDaHVuayA9IGBcbiAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICB1bmlmb3JtIGZsb2F0IG1hdGVyaWFsX3NoZWVuR2xvc3NpbmVzcztcbiAgICAjZW5kaWZcblxuICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgdW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9zaGVlbkdsb3NzaW5lc3NNYXA7XG4gICAgI2VuZGlmXG5cbiAgICB2b2lkIGdldFNoZWVuR2xvc3NpbmVzcygpIHtcbiAgICAgICAgZmxvYXQgc2hlZW5HbG9zc2luZXNzID0gMS4wO1xuXG4gICAgICAgICNpZmRlZiBNQVBGTE9BVFxuICAgICAgICBzaGVlbkdsb3NzaW5lc3MgKj0gbWF0ZXJpYWxfc2hlZW5HbG9zc2luZXNzO1xuICAgICAgICAjZW5kaWZcblxuICAgICAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgICAgICBzaGVlbkdsb3NzaW5lc3MgKj0gdGV4dHVyZTJEQmlhcyh0ZXh0dXJlX3NoZWVuR2xvc3NpbmVzc01hcCwgJFVWLCB0ZXh0dXJlQmlhcykuJENIO1xuICAgICAgICAjZW5kaWZcblxuICAgICAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgICAgIHNoZWVuR2xvc3NpbmVzcyAqPSBzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKTtcbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgc2hlZW5HbG9zc2luZXNzID0gMS4wIC0gc2hlZW5HbG9zc2luZXNzO1xuICAgICAgICBzaGVlbkdsb3NzaW5lc3MgKz0gMC4wMDAwMDAxO1xuICAgICAgICBzR2xvc3NpbmVzcyA9IHNoZWVuR2xvc3NpbmVzcztcbiAgICB9XG4gICAgYDtcbiAgICBtYXRlcmlhbC5jaHVua3Muc2hlZW5HbG9zc1BTID0gc2hlZW5HbG9zc0NodW5rO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uVm9sdW1lID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICBtYXRlcmlhbC51c2VEeW5hbWljUmVmcmFjdGlvbiA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RoaWNrbmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnRoaWNrbmVzcyA9IGRhdGEudGhpY2tuZXNzRmFjdG9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndGhpY2tuZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnRoaWNrbmVzc01hcCA9IHRleHR1cmVzW2RhdGEudGhpY2tuZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEudGhpY2tuZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsndGhpY2tuZXNzJ10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXR0ZW51YXRpb25EaXN0YW5jZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmF0dGVudWF0aW9uRGlzdGFuY2UgPSBkYXRhLmF0dGVudWF0aW9uRGlzdGFuY2U7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdhdHRlbnVhdGlvbkNvbG9yJykpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSBkYXRhLmF0dGVudWF0aW9uQ29sb3I7XG4gICAgICAgIG1hdGVyaWFsLmF0dGVudWF0aW9uLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdlbWlzc2l2ZVN0cmVuZ3RoJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVJbnRlbnNpdHkgPSBkYXRhLmVtaXNzaXZlU3RyZW5ndGg7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uSXJpZGVzY2VuY2UgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwudXNlSXJpZGVzY2VuY2UgPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZUZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlID0gZGF0YS5pcmlkZXNjZW5jZUZhY3RvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlTWFwQ2hhbm5lbCA9ICdyJztcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VNYXAgPSB0ZXh0dXJlc1tkYXRhLmlyaWRlc2NlbmNlVGV4dHVyZS5pbmRleF07XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuaXJpZGVzY2VuY2VUZXh0dXJlLCBtYXRlcmlhbCwgWydpcmlkZXNjZW5jZSddKTtcblxuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VJb3InKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCA9IGRhdGEuaXJpZGVzY2VuY2VJb3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRoaWNrbmVzc01pbmltdW0nKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01pbiA9IGRhdGEuaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUaGlja25lc3NNYXhpbXVtJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNYXggPSBkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4aW11bTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwQ2hhbm5lbCA9ICdnJztcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuaXJpZGVzY2VuY2VUaGlja25lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydpcmlkZXNjZW5jZVRoaWNrbmVzcyddKTtcbiAgICB9XG59O1xuXG5jb25zdCBjcmVhdGVNYXRlcmlhbCA9IGZ1bmN0aW9uIChnbHRmTWF0ZXJpYWwsIHRleHR1cmVzLCBmbGlwVikge1xuICAgIC8vIFRPRE86IGludGVncmF0ZSB0aGVzZSBzaGFkZXIgY2h1bmtzIGludG8gdGhlIG5hdGl2ZSBlbmdpbmVcbiAgICBjb25zdCBnbG9zc0NodW5rID0gYFxuICAgICAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICAgICAgdW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9zaGluaW5lc3M7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgdm9pZCBnZXRHbG9zc2luZXNzKCkge1xuICAgICAgICAgICAgZEdsb3NzaW5lc3MgPSAxLjA7XG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICAgICAgICAgIGRHbG9zc2luZXNzICo9IG1hdGVyaWFsX3NoaW5pbmVzcztcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgICAgICAgICAgZEdsb3NzaW5lc3MgKj0gdGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykuJENIO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICAgICAgICAgIGRHbG9zc2luZXNzICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgICAgICBkR2xvc3NpbmVzcyA9IDEuMCAtIGRHbG9zc2luZXNzO1xuICAgICAgICBcbiAgICAgICAgICAgIGRHbG9zc2luZXNzICs9IDAuMDAwMDAwMTtcbiAgICAgICAgfVxuICAgICAgICBgO1xuXG5cbiAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG5cbiAgICAvLyBnbFRGIGRvZXNuJ3QgZGVmaW5lIGhvdyB0byBvY2NsdWRlIHNwZWN1bGFyXG4gICAgbWF0ZXJpYWwub2NjbHVkZVNwZWN1bGFyID0gU1BFQ09DQ19BTztcblxuICAgIG1hdGVyaWFsLmRpZmZ1c2VUaW50ID0gdHJ1ZTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3IgPSB0cnVlO1xuXG4gICAgbWF0ZXJpYWwuc3BlY3VsYXJUaW50ID0gdHJ1ZTtcbiAgICBtYXRlcmlhbC5zcGVjdWxhclZlcnRleENvbG9yID0gdHJ1ZTtcblxuICAgIG1hdGVyaWFsLmNodW5rcy5BUElWZXJzaW9uID0gQ0hVTktBUElfMV81NztcblxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ25hbWUnKSkge1xuICAgICAgICBtYXRlcmlhbC5uYW1lID0gZ2x0Zk1hdGVyaWFsLm5hbWU7XG4gICAgfVxuXG4gICAgbGV0IGNvbG9yLCB0ZXh0dXJlO1xuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ3Bick1ldGFsbGljUm91Z2huZXNzJykpIHtcbiAgICAgICAgY29uc3QgcGJyRGF0YSA9IGdsdGZNYXRlcmlhbC5wYnJNZXRhbGxpY1JvdWdobmVzcztcblxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnYmFzZUNvbG9yRmFjdG9yJykpIHtcbiAgICAgICAgICAgIGNvbG9yID0gcGJyRGF0YS5iYXNlQ29sb3JGYWN0b3I7XG4gICAgICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IGNvbG9yWzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnYmFzZUNvbG9yVGV4dHVyZScpKSB7XG4gICAgICAgICAgICBjb25zdCBiYXNlQ29sb3JUZXh0dXJlID0gcGJyRGF0YS5iYXNlQ29sb3JUZXh0dXJlO1xuICAgICAgICAgICAgdGV4dHVyZSA9IHRleHR1cmVzW2Jhc2VDb2xvclRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwID0gdGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwID0gdGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShiYXNlQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydkaWZmdXNlJywgJ29wYWNpdHknXSk7XG4gICAgICAgIH1cbiAgICAgICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnbWV0YWxsaWNGYWN0b3InKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzID0gcGJyRGF0YS5tZXRhbGxpY0ZhY3RvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzcyA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ3JvdWdobmVzc0ZhY3RvcicpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zaGluaW5lc3MgPSAxMDAgKiBwYnJEYXRhLnJvdWdobmVzc0ZhY3RvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNoaW5pbmVzcyA9IDEwMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgICAgIGNvbnN0IG1ldGFsbGljUm91Z2huZXNzVGV4dHVyZSA9IHBickRhdGEubWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzTWFwID0gbWF0ZXJpYWwuZ2xvc3NNYXAgPSB0ZXh0dXJlc1ttZXRhbGxpY1JvdWdobmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzTWFwQ2hhbm5lbCA9ICdiJztcbiAgICAgICAgICAgIG1hdGVyaWFsLmdsb3NzTWFwQ2hhbm5lbCA9ICdnJztcblxuICAgICAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0obWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydnbG9zcycsICdtZXRhbG5lc3MnXSk7XG4gICAgICAgIH1cblxuICAgICAgICBtYXRlcmlhbC5jaHVua3MuZ2xvc3NQUyA9IGdsb3NzQ2h1bms7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnbm9ybWFsVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IG5vcm1hbFRleHR1cmUgPSBnbHRmTWF0ZXJpYWwubm9ybWFsVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwubm9ybWFsTWFwID0gdGV4dHVyZXNbbm9ybWFsVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0obm9ybWFsVGV4dHVyZSwgbWF0ZXJpYWwsIFsnbm9ybWFsJ10pO1xuXG4gICAgICAgIGlmIChub3JtYWxUZXh0dXJlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5idW1waW5lc3MgPSBub3JtYWxUZXh0dXJlLnNjYWxlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ29jY2x1c2lvblRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBvY2NsdXNpb25UZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLm9jY2x1c2lvblRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmFvTWFwID0gdGV4dHVyZXNbb2NjbHVzaW9uVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmFvTWFwQ2hhbm5lbCA9ICdyJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShvY2NsdXNpb25UZXh0dXJlLCBtYXRlcmlhbCwgWydhbyddKTtcbiAgICAgICAgLy8gVE9ETzogc3VwcG9ydCAnc3RyZW5ndGgnXG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBnbHRmTWF0ZXJpYWwuZW1pc3NpdmVGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmUuc2V0KDAsIDAsIDApO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgZW1pc3NpdmVUZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLmVtaXNzaXZlVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSB0ZXh0dXJlc1tlbWlzc2l2ZVRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGVtaXNzaXZlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZW1pc3NpdmUnXSk7XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2FscGhhTW9kZScpKSB7XG4gICAgICAgIHN3aXRjaCAoZ2x0Zk1hdGVyaWFsLmFscGhhTW9kZSkge1xuICAgICAgICAgICAgY2FzZSAnTUFTSyc6XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdhbHBoYUN1dG9mZicpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFscGhhVGVzdCA9IGdsdGZNYXRlcmlhbC5hbHBoYUN1dG9mZjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbHBoYVRlc3QgPSAwLjU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnQkxFTkQnOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICAgICAgICAgICAgICAvLyBub3RlOiBieSBkZWZhdWx0IGRvbid0IHdyaXRlIGRlcHRoIG9uIHNlbWl0cmFuc3BhcmVudCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5kZXB0aFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgY2FzZSAnT1BBUVVFJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT05FO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZG91YmxlU2lkZWQnKSkge1xuICAgICAgICBtYXRlcmlhbC50d29TaWRlZExpZ2h0aW5nID0gZ2x0Zk1hdGVyaWFsLmRvdWJsZVNpZGVkO1xuICAgICAgICBtYXRlcmlhbC5jdWxsID0gZ2x0Zk1hdGVyaWFsLmRvdWJsZVNpZGVkID8gQ1VMTEZBQ0VfTk9ORSA6IENVTExGQUNFX0JBQ0s7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwudHdvU2lkZWRMaWdodGluZyA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfQkFDSztcbiAgICB9XG5cbiAgICAvLyBQcm92aWRlIGxpc3Qgb2Ygc3VwcG9ydGVkIGV4dGVuc2lvbnMgYW5kIHRoZWlyIGZ1bmN0aW9uc1xuICAgIGNvbnN0IGV4dGVuc2lvbnMgPSB7XG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19jbGVhcmNvYXRcIjogZXh0ZW5zaW9uQ2xlYXJDb2F0LFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfZW1pc3NpdmVfc3RyZW5ndGhcIjogZXh0ZW5zaW9uRW1pc3NpdmVTdHJlbmd0aCxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2lvclwiOiBleHRlbnNpb25Jb3IsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19pcmlkZXNjZW5jZVwiOiBleHRlbnNpb25JcmlkZXNjZW5jZSxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3BiclNwZWN1bGFyR2xvc3NpbmVzc1wiOiBleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3NoZWVuXCI6IGV4dGVuc2lvblNoZWVuLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfc3BlY3VsYXJcIjogZXh0ZW5zaW9uU3BlY3VsYXIsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc190cmFuc21pc3Npb25cIjogZXh0ZW5zaW9uVHJhbnNtaXNzaW9uLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfdW5saXRcIjogZXh0ZW5zaW9uVW5saXQsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc192b2x1bWVcIjogZXh0ZW5zaW9uVm9sdW1lXG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSBleHRlbnNpb25zXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZXh0ZW5zaW9ucycpKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGdsdGZNYXRlcmlhbC5leHRlbnNpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb25GdW5jID0gZXh0ZW5zaW9uc1trZXldO1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbkZ1bmMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGV4dGVuc2lvbkZ1bmMoZ2x0Zk1hdGVyaWFsLmV4dGVuc2lvbnNba2V5XSwgbWF0ZXJpYWwsIHRleHR1cmVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgcmV0dXJuIG1hdGVyaWFsO1xufTtcblxuLy8gY3JlYXRlIHRoZSBhbmltIHN0cnVjdHVyZVxuY29uc3QgY3JlYXRlQW5pbWF0aW9uID0gZnVuY3Rpb24gKGdsdGZBbmltYXRpb24sIGFuaW1hdGlvbkluZGV4LCBnbHRmQWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIG1lc2hlcykge1xuXG4gICAgLy8gY3JlYXRlIGFuaW1hdGlvbiBkYXRhIGJsb2NrIGZvciB0aGUgYWNjZXNzb3JcbiAgICBjb25zdCBjcmVhdGVBbmltRGF0YSA9IGZ1bmN0aW9uIChnbHRmQWNjZXNzb3IpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBBbmltRGF0YShnZXROdW1Db21wb25lbnRzKGdsdGZBY2Nlc3Nvci50eXBlKSwgZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzKSk7XG4gICAgfTtcblxuICAgIGNvbnN0IGludGVycE1hcCA9IHtcbiAgICAgICAgJ1NURVAnOiBJTlRFUlBPTEFUSU9OX1NURVAsXG4gICAgICAgICdMSU5FQVInOiBJTlRFUlBPTEFUSU9OX0xJTkVBUixcbiAgICAgICAgJ0NVQklDU1BMSU5FJzogSU5URVJQT0xBVElPTl9DVUJJQ1xuICAgIH07XG5cbiAgICAvLyBJbnB1dCBhbmQgb3V0cHV0IG1hcHMgcmVmZXJlbmNlIGRhdGEgYnkgc2FtcGxlciBpbnB1dC9vdXRwdXQga2V5LlxuICAgIGNvbnN0IGlucHV0TWFwID0geyB9O1xuICAgIGNvbnN0IG91dHB1dE1hcCA9IHsgfTtcbiAgICAvLyBUaGUgY3VydmUgbWFwIHN0b3JlcyB0ZW1wb3JhcnkgY3VydmUgZGF0YSBieSBzYW1wbGVyIGluZGV4LiBFYWNoIGN1cnZlcyBpbnB1dC9vdXRwdXQgdmFsdWUgd2lsbCBiZSByZXNvbHZlZCB0byBhbiBpbnB1dHMvb3V0cHV0cyBhcnJheSBpbmRleCBhZnRlciBhbGwgc2FtcGxlcnMgaGF2ZSBiZWVuIHByb2Nlc3NlZC5cbiAgICAvLyBDdXJ2ZXMgYW5kIG91dHB1dHMgdGhhdCBhcmUgZGVsZXRlZCBmcm9tIHRoZWlyIG1hcHMgd2lsbCBub3QgYmUgaW5jbHVkZWQgaW4gdGhlIGZpbmFsIEFuaW1UcmFja1xuICAgIGNvbnN0IGN1cnZlTWFwID0geyB9O1xuICAgIGxldCBvdXRwdXRDb3VudGVyID0gMTtcblxuICAgIGxldCBpO1xuXG4gICAgLy8gY29udmVydCBzYW1wbGVyc1xuICAgIGZvciAoaSA9IDA7IGkgPCBnbHRmQW5pbWF0aW9uLnNhbXBsZXJzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IHNhbXBsZXIgPSBnbHRmQW5pbWF0aW9uLnNhbXBsZXJzW2ldO1xuXG4gICAgICAgIC8vIGdldCBpbnB1dCBkYXRhXG4gICAgICAgIGlmICghaW5wdXRNYXAuaGFzT3duUHJvcGVydHkoc2FtcGxlci5pbnB1dCkpIHtcbiAgICAgICAgICAgIGlucHV0TWFwW3NhbXBsZXIuaW5wdXRdID0gY3JlYXRlQW5pbURhdGEoZ2x0ZkFjY2Vzc29yc1tzYW1wbGVyLmlucHV0XSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBnZXQgb3V0cHV0IGRhdGFcbiAgICAgICAgaWYgKCFvdXRwdXRNYXAuaGFzT3duUHJvcGVydHkoc2FtcGxlci5vdXRwdXQpKSB7XG4gICAgICAgICAgICBvdXRwdXRNYXBbc2FtcGxlci5vdXRwdXRdID0gY3JlYXRlQW5pbURhdGEoZ2x0ZkFjY2Vzc29yc1tzYW1wbGVyLm91dHB1dF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW50ZXJwb2xhdGlvbiA9XG4gICAgICAgICAgICBzYW1wbGVyLmhhc093blByb3BlcnR5KCdpbnRlcnBvbGF0aW9uJykgJiZcbiAgICAgICAgICAgIGludGVycE1hcC5oYXNPd25Qcm9wZXJ0eShzYW1wbGVyLmludGVycG9sYXRpb24pID9cbiAgICAgICAgICAgICAgICBpbnRlcnBNYXBbc2FtcGxlci5pbnRlcnBvbGF0aW9uXSA6IElOVEVSUE9MQVRJT05fTElORUFSO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBjdXJ2ZVxuICAgICAgICBjb25zdCBjdXJ2ZSA9IHtcbiAgICAgICAgICAgIHBhdGhzOiBbXSxcbiAgICAgICAgICAgIGlucHV0OiBzYW1wbGVyLmlucHV0LFxuICAgICAgICAgICAgb3V0cHV0OiBzYW1wbGVyLm91dHB1dCxcbiAgICAgICAgICAgIGludGVycG9sYXRpb246IGludGVycG9sYXRpb25cbiAgICAgICAgfTtcblxuICAgICAgICBjdXJ2ZU1hcFtpXSA9IGN1cnZlO1xuICAgIH1cblxuICAgIGNvbnN0IHF1YXRBcnJheXMgPSBbXTtcblxuICAgIGNvbnN0IHRyYW5zZm9ybVNjaGVtYSA9IHtcbiAgICAgICAgJ3RyYW5zbGF0aW9uJzogJ2xvY2FsUG9zaXRpb24nLFxuICAgICAgICAncm90YXRpb24nOiAnbG9jYWxSb3RhdGlvbicsXG4gICAgICAgICdzY2FsZSc6ICdsb2NhbFNjYWxlJ1xuICAgIH07XG5cbiAgICBjb25zdCBjb25zdHJ1Y3ROb2RlUGF0aCA9IChub2RlKSA9PiB7XG4gICAgICAgIGNvbnN0IHBhdGggPSBbXTtcbiAgICAgICAgd2hpbGUgKG5vZGUpIHtcbiAgICAgICAgICAgIHBhdGgudW5zaGlmdChub2RlLm5hbWUpO1xuICAgICAgICAgICAgbm9kZSA9IG5vZGUucGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwYXRoO1xuICAgIH07XG5cbiAgICBjb25zdCByZXRyaWV2ZVdlaWdodE5hbWUgPSAobm9kZU5hbWUsIHdlaWdodEluZGV4KSA9PiB7XG4gICAgICAgIGlmICghbWVzaGVzKSByZXR1cm4gd2VpZ2h0SW5kZXg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoID0gbWVzaGVzW2ldO1xuICAgICAgICAgICAgaWYgKG1lc2gubmFtZSA9PT0gbm9kZU5hbWUgJiYgbWVzaC5oYXNPd25Qcm9wZXJ0eSgnZXh0cmFzJykgJiYgbWVzaC5leHRyYXMuaGFzT3duUHJvcGVydHkoJ3RhcmdldE5hbWVzJykgJiYgbWVzaC5leHRyYXMudGFyZ2V0TmFtZXNbd2VpZ2h0SW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGBuYW1lLiR7bWVzaC5leHRyYXMudGFyZ2V0TmFtZXNbd2VpZ2h0SW5kZXhdfWA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHdlaWdodEluZGV4O1xuICAgIH07XG5cbiAgICAvLyBBbGwgbW9ycGggdGFyZ2V0cyBhcmUgaW5jbHVkZWQgaW4gYSBzaW5nbGUgY2hhbm5lbCBvZiB0aGUgYW5pbWF0aW9uLCB3aXRoIGFsbCB0YXJnZXRzIG91dHB1dCBkYXRhIGludGVybGVhdmVkIHdpdGggZWFjaCBvdGhlci5cbiAgICAvLyBUaGlzIGZ1bmN0aW9uIHNwbGl0cyBlYWNoIG1vcnBoIHRhcmdldCBvdXQgaW50byBpdCBhIGN1cnZlIHdpdGggaXRzIG93biBvdXRwdXQgZGF0YSwgYWxsb3dpbmcgdXMgdG8gYW5pbWF0ZSBlYWNoIG1vcnBoIHRhcmdldCBpbmRlcGVuZGVudGx5IGJ5IG5hbWUuXG4gICAgY29uc3QgY3JlYXRlTW9ycGhUYXJnZXRDdXJ2ZXMgPSAoY3VydmUsIG5vZGUsIGVudGl0eVBhdGgpID0+IHtcbiAgICAgICAgaWYgKCFvdXRwdXRNYXBbY3VydmUub3V0cHV0XSkge1xuICAgICAgICAgICAgRGVidWcud2FybihgZ2xiLXBhcnNlcjogTm8gb3V0cHV0IGRhdGEgaXMgYXZhaWxhYmxlIGZvciB0aGUgbW9ycGggdGFyZ2V0IGN1cnZlICgke2VudGl0eVBhdGh9L2dyYXBoL3dlaWdodHMpLiBTa2lwcGluZy5gKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtb3JwaFRhcmdldENvdW50ID0gb3V0cHV0TWFwW2N1cnZlLm91dHB1dF0uZGF0YS5sZW5ndGggLyBpbnB1dE1hcFtjdXJ2ZS5pbnB1dF0uZGF0YS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGtleWZyYW1lQ291bnQgPSBvdXRwdXRNYXBbY3VydmUub3V0cHV0XS5kYXRhLmxlbmd0aCAvIG1vcnBoVGFyZ2V0Q291bnQ7XG5cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBtb3JwaFRhcmdldENvdW50OyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0T3V0cHV0ID0gbmV3IEZsb2F0MzJBcnJheShrZXlmcmFtZUNvdW50KTtcbiAgICAgICAgICAgIC8vIHRoZSBvdXRwdXQgZGF0YSBmb3IgYWxsIG1vcnBoIHRhcmdldHMgaW4gYSBzaW5nbGUgY3VydmUgaXMgaW50ZXJsZWF2ZWQuIFdlIG5lZWQgdG8gcmV0cmlldmUgdGhlIGtleWZyYW1lIG91dHB1dCBkYXRhIGZvciBhIHNpbmdsZSBtb3JwaCB0YXJnZXRcbiAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwga2V5ZnJhbWVDb3VudDsgaysrKSB7XG4gICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRPdXRwdXRba10gPSBvdXRwdXRNYXBbY3VydmUub3V0cHV0XS5kYXRhW2sgKiBtb3JwaFRhcmdldENvdW50ICsgal07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBuZXcgQW5pbURhdGEoMSwgbW9ycGhUYXJnZXRPdXRwdXQpO1xuICAgICAgICAgICAgLy8gYWRkIHRoZSBpbmRpdmlkdWFsIG1vcnBoIHRhcmdldCBvdXRwdXQgZGF0YSB0byB0aGUgb3V0cHV0TWFwIHVzaW5nIGEgbmVnYXRpdmUgdmFsdWUga2V5IChzbyBhcyBub3QgdG8gY2xhc2ggd2l0aCBzYW1wbGVyLm91dHB1dCB2YWx1ZXMpXG4gICAgICAgICAgICBvdXRwdXRNYXBbLW91dHB1dENvdW50ZXJdID0gb3V0cHV0O1xuICAgICAgICAgICAgY29uc3QgbW9ycGhDdXJ2ZSA9IHtcbiAgICAgICAgICAgICAgICBwYXRoczogW3tcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5UGF0aDogZW50aXR5UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50OiAnZ3JhcGgnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6IFtgd2VpZ2h0LiR7cmV0cmlldmVXZWlnaHROYW1lKG5vZGUubmFtZSwgail9YF1cbiAgICAgICAgICAgICAgICB9XSxcbiAgICAgICAgICAgICAgICAvLyBlYWNoIG1vcnBoIHRhcmdldCBjdXJ2ZSBpbnB1dCBjYW4gdXNlIHRoZSBzYW1lIHNhbXBsZXIuaW5wdXQgZnJvbSB0aGUgY2hhbm5lbCB0aGV5IHdlcmUgYWxsIGluXG4gICAgICAgICAgICAgICAgaW5wdXQ6IGN1cnZlLmlucHV0LFxuICAgICAgICAgICAgICAgIC8vIGJ1dCBlYWNoIG1vcnBoIHRhcmdldCBjdXJ2ZSBzaG91bGQgcmVmZXJlbmNlIGl0cyBpbmRpdmlkdWFsIG91dHB1dCB0aGF0IHdhcyBqdXN0IGNyZWF0ZWRcbiAgICAgICAgICAgICAgICBvdXRwdXQ6IC1vdXRwdXRDb3VudGVyLFxuICAgICAgICAgICAgICAgIGludGVycG9sYXRpb246IGN1cnZlLmludGVycG9sYXRpb25cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBvdXRwdXRDb3VudGVyKys7XG4gICAgICAgICAgICAvLyBhZGQgdGhlIG1vcnBoIHRhcmdldCBjdXJ2ZSB0byB0aGUgY3VydmVNYXBcbiAgICAgICAgICAgIGN1cnZlTWFwW2Btb3JwaEN1cnZlLSR7aX0tJHtqfWBdID0gbW9ycGhDdXJ2ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBjb252ZXJ0IGFuaW0gY2hhbm5lbHNcbiAgICBmb3IgKGkgPSAwOyBpIDwgZ2x0ZkFuaW1hdGlvbi5jaGFubmVscy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBjaGFubmVsID0gZ2x0ZkFuaW1hdGlvbi5jaGFubmVsc1tpXTtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gY2hhbm5lbC50YXJnZXQ7XG4gICAgICAgIGNvbnN0IGN1cnZlID0gY3VydmVNYXBbY2hhbm5lbC5zYW1wbGVyXTtcblxuICAgICAgICBjb25zdCBub2RlID0gbm9kZXNbdGFyZ2V0Lm5vZGVdO1xuICAgICAgICBjb25zdCBlbnRpdHlQYXRoID0gY29uc3RydWN0Tm9kZVBhdGgobm9kZSk7XG5cbiAgICAgICAgaWYgKHRhcmdldC5wYXRoLnN0YXJ0c1dpdGgoJ3dlaWdodHMnKSkge1xuICAgICAgICAgICAgY3JlYXRlTW9ycGhUYXJnZXRDdXJ2ZXMoY3VydmUsIG5vZGUsIGVudGl0eVBhdGgpO1xuICAgICAgICAgICAgLy8gYXMgYWxsIGluZGl2aWR1YWwgbW9ycGggdGFyZ2V0cyBpbiB0aGlzIG1vcnBoIGN1cnZlIGhhdmUgdGhlaXIgb3duIGN1cnZlIG5vdywgdGhpcyBtb3JwaCBjdXJ2ZSBzaG91bGQgYmUgZmxhZ2dlZFxuICAgICAgICAgICAgLy8gc28gaXQncyBub3QgaW5jbHVkZWQgaW4gdGhlIGZpbmFsIG91dHB1dFxuICAgICAgICAgICAgY3VydmVNYXBbY2hhbm5lbC5zYW1wbGVyXS5tb3JwaEN1cnZlID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGN1cnZlLnBhdGhzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVudGl0eVBhdGg6IGVudGl0eVBhdGgsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiAnZ3JhcGgnLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogW3RyYW5zZm9ybVNjaGVtYVt0YXJnZXQucGF0aF1dXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgY29uc3QgaW5wdXRzID0gW107XG4gICAgY29uc3Qgb3V0cHV0cyA9IFtdO1xuICAgIGNvbnN0IGN1cnZlcyA9IFtdO1xuXG4gICAgLy8gQWRkIGVhY2ggaW5wdXQgaW4gdGhlIG1hcCB0byB0aGUgZmluYWwgaW5wdXRzIGFycmF5LiBUaGUgaW5wdXRNYXAgc2hvdWxkIG5vdyByZWZlcmVuY2UgdGhlIGluZGV4IG9mIGlucHV0IGluIHRoZSBpbnB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgaW5wdXQgaXRzZWxmLlxuICAgIGZvciAoY29uc3QgaW5wdXRLZXkgaW4gaW5wdXRNYXApIHtcbiAgICAgICAgaW5wdXRzLnB1c2goaW5wdXRNYXBbaW5wdXRLZXldKTtcbiAgICAgICAgaW5wdXRNYXBbaW5wdXRLZXldID0gaW5wdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIEFkZCBlYWNoIG91dHB1dCBpbiB0aGUgbWFwIHRvIHRoZSBmaW5hbCBvdXRwdXRzIGFycmF5LiBUaGUgb3V0cHV0TWFwIHNob3VsZCBub3cgcmVmZXJlbmNlIHRoZSBpbmRleCBvZiBvdXRwdXQgaW4gdGhlIG91dHB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgb3V0cHV0IGl0c2VsZi5cbiAgICBmb3IgKGNvbnN0IG91dHB1dEtleSBpbiBvdXRwdXRNYXApIHtcbiAgICAgICAgb3V0cHV0cy5wdXNoKG91dHB1dE1hcFtvdXRwdXRLZXldKTtcbiAgICAgICAgb3V0cHV0TWFwW291dHB1dEtleV0gPSBvdXRwdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIENyZWF0ZSBhbiBBbmltQ3VydmUgZm9yIGVhY2ggY3VydmUgb2JqZWN0IGluIHRoZSBjdXJ2ZU1hcC4gRWFjaCBjdXJ2ZSBvYmplY3QncyBpbnB1dCB2YWx1ZSBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gdGhlIGluZGV4IG9mIHRoZSBpbnB1dCBpbiB0aGVcbiAgICAvLyBpbnB1dHMgYXJyYXlzIHVzaW5nIHRoZSBpbnB1dE1hcC4gTGlrZXdpc2UgZm9yIG91dHB1dCB2YWx1ZXMuXG4gICAgZm9yIChjb25zdCBjdXJ2ZUtleSBpbiBjdXJ2ZU1hcCkge1xuICAgICAgICBjb25zdCBjdXJ2ZURhdGEgPSBjdXJ2ZU1hcFtjdXJ2ZUtleV07XG4gICAgICAgIC8vIGlmIHRoZSBjdXJ2ZURhdGEgY29udGFpbnMgYSBtb3JwaCBjdXJ2ZSB0aGVuIGRvIG5vdCBhZGQgaXQgdG8gdGhlIGZpbmFsIGN1cnZlIGxpc3QgYXMgdGhlIGluZGl2aWR1YWwgbW9ycGggdGFyZ2V0IGN1cnZlcyBhcmUgaW5jbHVkZWQgaW5zdGVhZFxuICAgICAgICBpZiAoY3VydmVEYXRhLm1vcnBoQ3VydmUpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGN1cnZlcy5wdXNoKG5ldyBBbmltQ3VydmUoXG4gICAgICAgICAgICBjdXJ2ZURhdGEucGF0aHMsXG4gICAgICAgICAgICBpbnB1dE1hcFtjdXJ2ZURhdGEuaW5wdXRdLFxuICAgICAgICAgICAgb3V0cHV0TWFwW2N1cnZlRGF0YS5vdXRwdXRdLFxuICAgICAgICAgICAgY3VydmVEYXRhLmludGVycG9sYXRpb25cbiAgICAgICAgKSk7XG5cbiAgICAgICAgLy8gaWYgdGhpcyB0YXJnZXQgaXMgYSBzZXQgb2YgcXVhdGVybmlvbiBrZXlzLCBtYWtlIG5vdGUgb2YgaXRzIGluZGV4IHNvIHdlIGNhbiBwZXJmb3JtXG4gICAgICAgIC8vIHF1YXRlcm5pb24tc3BlY2lmaWMgcHJvY2Vzc2luZyBvbiBpdC5cbiAgICAgICAgaWYgKGN1cnZlRGF0YS5wYXRocy5sZW5ndGggPiAwICYmIGN1cnZlRGF0YS5wYXRoc1swXS5wcm9wZXJ0eVBhdGhbMF0gPT09ICdsb2NhbFJvdGF0aW9uJyAmJiBjdXJ2ZURhdGEuaW50ZXJwb2xhdGlvbiAhPT0gSU5URVJQT0xBVElPTl9DVUJJQykge1xuICAgICAgICAgICAgcXVhdEFycmF5cy5wdXNoKGN1cnZlc1tjdXJ2ZXMubGVuZ3RoIC0gMV0ub3V0cHV0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdGhlIGxpc3Qgb2YgYXJyYXkgaW5kZXhlcyBzbyB3ZSBjYW4gc2tpcCBkdXBzXG4gICAgcXVhdEFycmF5cy5zb3J0KCk7XG5cbiAgICAvLyBydW4gdGhyb3VnaCB0aGUgcXVhdGVybmlvbiBkYXRhIGFycmF5cyBmbGlwcGluZyBxdWF0ZXJuaW9uIGtleXNcbiAgICAvLyB0aGF0IGRvbid0IGZhbGwgaW4gdGhlIHNhbWUgd2luZGluZyBvcmRlci5cbiAgICBsZXQgcHJldkluZGV4ID0gbnVsbDtcbiAgICBsZXQgZGF0YTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcXVhdEFycmF5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHF1YXRBcnJheXNbaV07XG4gICAgICAgIC8vIHNraXAgb3ZlciBkdXBsaWNhdGUgYXJyYXkgaW5kaWNlc1xuICAgICAgICBpZiAoaSA9PT0gMCB8fCBpbmRleCAhPT0gcHJldkluZGV4KSB7XG4gICAgICAgICAgICBkYXRhID0gb3V0cHV0c1tpbmRleF07XG4gICAgICAgICAgICBpZiAoZGF0YS5jb21wb25lbnRzID09PSA0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZCA9IGRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICBjb25zdCBsZW4gPSBkLmxlbmd0aCAtIDQ7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGogKz0gNCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkcCA9IGRbaiArIDBdICogZFtqICsgNF0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAxXSAqIGRbaiArIDVdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgMl0gKiBkW2ogKyA2XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDNdICogZFtqICsgN107XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRwIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNF0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA1XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDZdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgN10gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmV2SW5kZXggPSBpbmRleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSBkdXJhdGlvbiBvZiB0aGUgYW5pbWF0aW9uIGFzIG1heGltdW0gdGltZSB2YWx1ZVxuICAgIGxldCBkdXJhdGlvbiA9IDA7XG4gICAgZm9yIChpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkYXRhICA9IGlucHV0c1tpXS5fZGF0YTtcbiAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1heChkdXJhdGlvbiwgZGF0YS5sZW5ndGggPT09IDAgPyAwIDogZGF0YVtkYXRhLmxlbmd0aCAtIDFdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFuaW1UcmFjayhcbiAgICAgICAgZ2x0ZkFuaW1hdGlvbi5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpID8gZ2x0ZkFuaW1hdGlvbi5uYW1lIDogKCdhbmltYXRpb25fJyArIGFuaW1hdGlvbkluZGV4KSxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICAgICAgY3VydmVzKTtcbn07XG5cbmNvbnN0IGNyZWF0ZU5vZGUgPSBmdW5jdGlvbiAoZ2x0Zk5vZGUsIG5vZGVJbmRleCkge1xuICAgIGNvbnN0IGVudGl0eSA9IG5ldyBHcmFwaE5vZGUoKTtcblxuICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpICYmIGdsdGZOb2RlLm5hbWUubGVuZ3RoID4gMCkge1xuICAgICAgICBlbnRpdHkubmFtZSA9IGdsdGZOb2RlLm5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW50aXR5Lm5hbWUgPSAnbm9kZV8nICsgbm9kZUluZGV4O1xuICAgIH1cblxuICAgIC8vIFBhcnNlIHRyYW5zZm9ybWF0aW9uIHByb3BlcnRpZXNcbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ21hdHJpeCcpKSB7XG4gICAgICAgIHRlbXBNYXQuZGF0YS5zZXQoZ2x0Zk5vZGUubWF0cml4KTtcbiAgICAgICAgdGVtcE1hdC5nZXRUcmFuc2xhdGlvbih0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUG9zaXRpb24odGVtcFZlYyk7XG4gICAgICAgIHRlbXBNYXQuZ2V0RXVsZXJBbmdsZXModGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbEV1bGVyQW5nbGVzKHRlbXBWZWMpO1xuICAgICAgICB0ZW1wTWF0LmdldFNjYWxlKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZSh0ZW1wVmVjKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3JvdGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgciA9IGdsdGZOb2RlLnJvdGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxSb3RhdGlvbihyWzBdLCByWzFdLCByWzJdLCByWzNdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3RyYW5zbGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgdCA9IGdsdGZOb2RlLnRyYW5zbGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxQb3NpdGlvbih0WzBdLCB0WzFdLCB0WzJdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgY29uc3QgcyA9IGdsdGZOb2RlLnNjYWxlO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZShzWzBdLCBzWzFdLCBzWzJdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW50aXR5O1xufTtcblxuLy8gY3JlYXRlcyBhIGNhbWVyYSBjb21wb25lbnQgb24gdGhlIHN1cHBsaWVkIG5vZGUsIGFuZCByZXR1cm5zIGl0XG5jb25zdCBjcmVhdGVDYW1lcmEgPSBmdW5jdGlvbiAoZ2x0ZkNhbWVyYSwgbm9kZSkge1xuXG4gICAgY29uc3QgcHJvamVjdGlvbiA9IGdsdGZDYW1lcmEudHlwZSA9PT0gJ29ydGhvZ3JhcGhpYycgPyBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA6IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkU7XG4gICAgY29uc3QgZ2x0ZlByb3BlcnRpZXMgPSBwcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA/IGdsdGZDYW1lcmEub3J0aG9ncmFwaGljIDogZ2x0ZkNhbWVyYS5wZXJzcGVjdGl2ZTtcblxuICAgIGNvbnN0IGNvbXBvbmVudERhdGEgPSB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICBwcm9qZWN0aW9uOiBwcm9qZWN0aW9uLFxuICAgICAgICBuZWFyQ2xpcDogZ2x0ZlByb3BlcnRpZXMuem5lYXIsXG4gICAgICAgIGFzcGVjdFJhdGlvTW9kZTogQVNQRUNUX0FVVE9cbiAgICB9O1xuXG4gICAgaWYgKGdsdGZQcm9wZXJ0aWVzLnpmYXIpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5mYXJDbGlwID0gZ2x0ZlByb3BlcnRpZXMuemZhcjtcbiAgICB9XG5cbiAgICBpZiAocHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5vcnRob0hlaWdodCA9IDAuNSAqIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy55bWFnKSB7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvTW9kZSA9IEFTUEVDVF9NQU5VQUw7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvID0gZ2x0ZlByb3BlcnRpZXMueG1hZyAvIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBjb21wb25lbnREYXRhLmZvdiA9IGdsdGZQcm9wZXJ0aWVzLnlmb3YgKiBtYXRoLlJBRF9UT19ERUc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy5hc3BlY3RSYXRpbykge1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfTUFOVUFMO1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpbyA9IGdsdGZQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY2FtZXJhRW50aXR5ID0gbmV3IEVudGl0eShnbHRmQ2FtZXJhLm5hbWUpO1xuICAgIGNhbWVyYUVudGl0eS5hZGRDb21wb25lbnQoJ2NhbWVyYScsIGNvbXBvbmVudERhdGEpO1xuICAgIHJldHVybiBjYW1lcmFFbnRpdHk7XG59O1xuXG4vLyBjcmVhdGVzIGxpZ2h0IGNvbXBvbmVudCwgYWRkcyBpdCB0byB0aGUgbm9kZSBhbmQgcmV0dXJucyB0aGUgY3JlYXRlZCBsaWdodCBjb21wb25lbnRcbmNvbnN0IGNyZWF0ZUxpZ2h0ID0gZnVuY3Rpb24gKGdsdGZMaWdodCwgbm9kZSkge1xuXG4gICAgY29uc3QgbGlnaHRQcm9wcyA9IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHR5cGU6IGdsdGZMaWdodC50eXBlID09PSAncG9pbnQnID8gJ29tbmknIDogZ2x0ZkxpZ2h0LnR5cGUsXG4gICAgICAgIGNvbG9yOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ2NvbG9yJykgPyBuZXcgQ29sb3IoZ2x0ZkxpZ2h0LmNvbG9yKSA6IENvbG9yLldISVRFLFxuXG4gICAgICAgIC8vIHdoZW4gcmFuZ2UgaXMgbm90IGRlZmluZWQsIGluZmluaXR5IHNob3VsZCBiZSB1c2VkIC0gYnV0IHRoYXQgaXMgY2F1c2luZyBpbmZpbml0eSBpbiBib3VuZHMgY2FsY3VsYXRpb25zXG4gICAgICAgIHJhbmdlOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3JhbmdlJykgPyBnbHRmTGlnaHQucmFuZ2UgOiA5OTk5LFxuXG4gICAgICAgIGZhbGxvZmZNb2RlOiBMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQsXG5cbiAgICAgICAgLy8gVE9ETzogKGVuZ2luZSBpc3N1ZSAjMzI1MikgU2V0IGludGVuc2l0eSB0byBtYXRjaCBnbFRGIHNwZWNpZmljYXRpb24sIHdoaWNoIHVzZXMgcGh5c2ljYWxseSBiYXNlZCB2YWx1ZXM6XG4gICAgICAgIC8vIC0gT21uaSBhbmQgc3BvdCBsaWdodHMgdXNlIGx1bWlub3VzIGludGVuc2l0eSBpbiBjYW5kZWxhIChsbS9zcilcbiAgICAgICAgLy8gLSBEaXJlY3Rpb25hbCBsaWdodHMgdXNlIGlsbHVtaW5hbmNlIGluIGx1eCAobG0vbTIpLlxuICAgICAgICAvLyBDdXJyZW50IGltcGxlbWVudGF0aW9uOiBjbGFwbXMgc3BlY2lmaWVkIGludGVuc2l0eSB0byAwLi4yIHJhbmdlXG4gICAgICAgIGludGVuc2l0eTogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdpbnRlbnNpdHknKSA/IG1hdGguY2xhbXAoZ2x0ZkxpZ2h0LmludGVuc2l0eSwgMCwgMikgOiAxXG4gICAgfTtcblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3Nwb3QnKSkge1xuICAgICAgICBsaWdodFByb3BzLmlubmVyQ29uZUFuZ2xlID0gZ2x0ZkxpZ2h0LnNwb3QuaGFzT3duUHJvcGVydHkoJ2lubmVyQ29uZUFuZ2xlJykgPyBnbHRmTGlnaHQuc3BvdC5pbm5lckNvbmVBbmdsZSAqIG1hdGguUkFEX1RPX0RFRyA6IDA7XG4gICAgICAgIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUgPSBnbHRmTGlnaHQuc3BvdC5oYXNPd25Qcm9wZXJ0eSgnb3V0ZXJDb25lQW5nbGUnKSA/IGdsdGZMaWdodC5zcG90Lm91dGVyQ29uZUFuZ2xlICogbWF0aC5SQURfVE9fREVHIDogTWF0aC5QSSAvIDQ7XG4gICAgfVxuXG4gICAgLy8gZ2xURiBzdG9yZXMgbGlnaHQgYWxyZWFkeSBpbiBlbmVyZ3kvYXJlYSwgYnV0IHdlIG5lZWQgdG8gcHJvdmlkZSB0aGUgbGlnaHQgd2l0aCBvbmx5IHRoZSBlbmVyZ3kgcGFyYW1ldGVyLFxuICAgIC8vIHNvIHdlIG5lZWQgdGhlIGludGVuc2l0aWVzIGluIGNhbmRlbGEgYmFjayB0byBsdW1lblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoXCJpbnRlbnNpdHlcIikpIHtcbiAgICAgICAgbGlnaHRQcm9wcy5sdW1pbmFuY2UgPSBnbHRmTGlnaHQuaW50ZW5zaXR5ICogTGlnaHQuZ2V0TGlnaHRVbml0Q29udmVyc2lvbihsaWdodFR5cGVzW2xpZ2h0UHJvcHMudHlwZV0sIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUsIGxpZ2h0UHJvcHMuaW5uZXJDb25lQW5nbGUpO1xuICAgIH1cblxuICAgIC8vIFJvdGF0ZSB0byBtYXRjaCBsaWdodCBvcmllbnRhdGlvbiBpbiBnbFRGIHNwZWNpZmljYXRpb25cbiAgICAvLyBOb3RlIHRoYXQgdGhpcyBhZGRzIGEgbmV3IGVudGl0eSBub2RlIGludG8gdGhlIGhpZXJhcmNoeSB0aGF0IGRvZXMgbm90IGV4aXN0IGluIHRoZSBnbHRmIGhpZXJhcmNoeVxuICAgIGNvbnN0IGxpZ2h0RW50aXR5ID0gbmV3IEVudGl0eShub2RlLm5hbWUpO1xuICAgIGxpZ2h0RW50aXR5LnJvdGF0ZUxvY2FsKDkwLCAwLCAwKTtcblxuICAgIC8vIGFkZCBjb21wb25lbnRcbiAgICBsaWdodEVudGl0eS5hZGRDb21wb25lbnQoJ2xpZ2h0JywgbGlnaHRQcm9wcyk7XG4gICAgcmV0dXJuIGxpZ2h0RW50aXR5O1xufTtcblxuY29uc3QgY3JlYXRlU2tpbnMgPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld3MpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ3NraW5zJykgfHwgZ2x0Zi5za2lucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8vIGNhY2hlIGZvciBza2lucyB0byBmaWx0ZXIgb3V0IGR1cGxpY2F0ZXNcbiAgICBjb25zdCBnbGJTa2lucyA9IG5ldyBNYXAoKTtcblxuICAgIHJldHVybiBnbHRmLnNraW5zLm1hcChmdW5jdGlvbiAoZ2x0ZlNraW4pIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVNraW4oZGV2aWNlLCBnbHRmU2tpbiwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2xiU2tpbnMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlTWVzaGVzID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgb3B0aW9ucykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnbWVzaGVzJykgfHwgZ2x0Zi5tZXNoZXMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICFnbHRmLmhhc093blByb3BlcnR5KCdhY2Nlc3NvcnMnKSB8fCBnbHRmLmFjY2Vzc29ycy5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgIWdsdGYuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXdzJykgfHwgZ2x0Zi5idWZmZXJWaWV3cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8vIGRpY3Rpb25hcnkgb2YgdmVydGV4IGJ1ZmZlcnMgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgIGNvbnN0IHZlcnRleEJ1ZmZlckRpY3QgPSB7fTtcblxuICAgIHJldHVybiBnbHRmLm1lc2hlcy5tYXAoZnVuY3Rpb24gKGdsdGZNZXNoKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgZ2x0Zk1lc2gsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgY2FsbGJhY2ssIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0LCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBvcHRpb25zKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZU1hdGVyaWFscyA9IGZ1bmN0aW9uIChnbHRmLCB0ZXh0dXJlcywgb3B0aW9ucywgZmxpcFYpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ21hdGVyaWFscycpIHx8IGdsdGYubWF0ZXJpYWxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5tYXRlcmlhbCAmJiBvcHRpb25zLm1hdGVyaWFsLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5tYXRlcmlhbCAmJiBvcHRpb25zLm1hdGVyaWFsLnByb2Nlc3MgfHwgY3JlYXRlTWF0ZXJpYWw7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubWF0ZXJpYWwgJiYgb3B0aW9ucy5tYXRlcmlhbC5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLm1hdGVyaWFscy5tYXAoZnVuY3Rpb24gKGdsdGZNYXRlcmlhbCkge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTWF0ZXJpYWwpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gcHJvY2VzcyhnbHRmTWF0ZXJpYWwsIHRleHR1cmVzLCBmbGlwVik7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zk1hdGVyaWFsLCBtYXRlcmlhbCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlVmFyaWFudHMgPSBmdW5jdGlvbiAoZ2x0Zikge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eShcImV4dGVuc2lvbnNcIikgfHwgIWdsdGYuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eShcIktIUl9tYXRlcmlhbHNfdmFyaWFudHNcIikpXG4gICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZGF0YSA9IGdsdGYuZXh0ZW5zaW9ucy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzLnZhcmlhbnRzO1xuICAgIGNvbnN0IHZhcmlhbnRzID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhcmlhbnRzW2RhdGFbaV0ubmFtZV0gPSBpO1xuICAgIH1cbiAgICByZXR1cm4gdmFyaWFudHM7XG59O1xuXG5jb25zdCBjcmVhdGVBbmltYXRpb25zID0gZnVuY3Rpb24gKGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3cywgb3B0aW9ucykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnYW5pbWF0aW9ucycpIHx8IGdsdGYuYW5pbWF0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLnBvc3Rwcm9jZXNzO1xuXG4gICAgcmV0dXJuIGdsdGYuYW5pbWF0aW9ucy5tYXAoZnVuY3Rpb24gKGdsdGZBbmltYXRpb24sIGluZGV4KSB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZBbmltYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFuaW1hdGlvbiA9IGNyZWF0ZUFuaW1hdGlvbihnbHRmQW5pbWF0aW9uLCBpbmRleCwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2x0Zi5tZXNoZXMpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZBbmltYXRpb24sIGFuaW1hdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFuaW1hdGlvbjtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZU5vZGVzID0gZnVuY3Rpb24gKGdsdGYsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ25vZGVzJykgfHwgZ2x0Zi5ub2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubm9kZSAmJiBvcHRpb25zLm5vZGUucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm5vZGUgJiYgb3B0aW9ucy5ub2RlLnByb2Nlc3MgfHwgY3JlYXRlTm9kZTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5ub2RlICYmIG9wdGlvbnMubm9kZS5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IG5vZGVzID0gZ2x0Zi5ub2Rlcy5tYXAoZnVuY3Rpb24gKGdsdGZOb2RlLCBpbmRleCkge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgbm9kZSA9IHByb2Nlc3MoZ2x0Zk5vZGUsIGluZGV4KTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTm9kZSwgbm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfSk7XG5cbiAgICAvLyBidWlsZCBub2RlIGhpZXJhcmNoeVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0Zi5ub2Rlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmTm9kZSA9IGdsdGYubm9kZXNbaV07XG4gICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnY2hpbGRyZW4nKSkge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gbm9kZXNbaV07XG4gICAgICAgICAgICBjb25zdCB1bmlxdWVOYW1lcyA9IHsgfTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZ2x0Zk5vZGUuY2hpbGRyZW4ubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IG5vZGVzW2dsdGZOb2RlLmNoaWxkcmVuW2pdXTtcbiAgICAgICAgICAgICAgICBpZiAoIWNoaWxkLnBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodW5pcXVlTmFtZXMuaGFzT3duUHJvcGVydHkoY2hpbGQubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkLm5hbWUgKz0gdW5pcXVlTmFtZXNbY2hpbGQubmFtZV0rKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaXF1ZU5hbWVzW2NoaWxkLm5hbWVdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQuYWRkQ2hpbGQoY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2Rlcztcbn07XG5cbmNvbnN0IGNyZWF0ZVNjZW5lcyA9IGZ1bmN0aW9uIChnbHRmLCBub2Rlcykge1xuICAgIGNvbnN0IHNjZW5lcyA9IFtdO1xuICAgIGNvbnN0IGNvdW50ID0gZ2x0Zi5zY2VuZXMubGVuZ3RoO1xuXG4gICAgLy8gaWYgdGhlcmUncyBhIHNpbmdsZSBzY2VuZSB3aXRoIGEgc2luZ2xlIG5vZGUgaW4gaXQsIGRvbid0IGNyZWF0ZSB3cmFwcGVyIG5vZGVzXG4gICAgaWYgKGNvdW50ID09PSAxICYmIGdsdGYuc2NlbmVzWzBdLm5vZGVzPy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgY29uc3Qgbm9kZUluZGV4ID0gZ2x0Zi5zY2VuZXNbMF0ubm9kZXNbMF07XG4gICAgICAgIHNjZW5lcy5wdXNoKG5vZGVzW25vZGVJbmRleF0pO1xuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIHJvb3Qgbm9kZSBwZXIgc2NlbmVcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGdsdGYuc2NlbmVzW2ldO1xuICAgICAgICAgICAgaWYgKHNjZW5lLm5vZGVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NlbmVSb290ID0gbmV3IEdyYXBoTm9kZShzY2VuZS5uYW1lKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IHNjZW5lLm5vZGVzLmxlbmd0aDsgbisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkTm9kZSA9IG5vZGVzW3NjZW5lLm5vZGVzW25dXTtcbiAgICAgICAgICAgICAgICAgICAgc2NlbmVSb290LmFkZENoaWxkKGNoaWxkTm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNjZW5lcy5wdXNoKHNjZW5lUm9vdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc2NlbmVzO1xufTtcblxuY29uc3QgY3JlYXRlQ2FtZXJhcyA9IGZ1bmN0aW9uIChnbHRmLCBub2Rlcywgb3B0aW9ucykge1xuXG4gICAgbGV0IGNhbWVyYXMgPSBudWxsO1xuXG4gICAgaWYgKGdsdGYuaGFzT3duUHJvcGVydHkoJ25vZGVzJykgJiYgZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnY2FtZXJhcycpICYmIGdsdGYuY2FtZXJhcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jYW1lcmEgJiYgb3B0aW9ucy5jYW1lcmEucHJlcHJvY2VzcztcbiAgICAgICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jYW1lcmEgJiYgb3B0aW9ucy5jYW1lcmEucHJvY2VzcyB8fCBjcmVhdGVDYW1lcmE7XG4gICAgICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhbWVyYSAmJiBvcHRpb25zLmNhbWVyYS5wb3N0cHJvY2VzcztcblxuICAgICAgICBnbHRmLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICAgICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnY2FtZXJhJykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBnbHRmQ2FtZXJhID0gZ2x0Zi5jYW1lcmFzW2dsdGZOb2RlLmNhbWVyYV07XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZkNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gcHJvY2VzcyhnbHRmQ2FtZXJhLCBub2Rlc1tub2RlSW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQ2FtZXJhLCBjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBjYW1lcmEgdG8gbm9kZS0+Y2FtZXJhIG1hcFxuICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNhbWVyYXMpIGNhbWVyYXMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFzLnNldChnbHRmTm9kZSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNhbWVyYXM7XG59O1xuXG5jb25zdCBjcmVhdGVMaWdodHMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpIHtcblxuICAgIGxldCBsaWdodHMgPSBudWxsO1xuXG4gICAgaWYgKGdsdGYuaGFzT3duUHJvcGVydHkoJ25vZGVzJykgJiYgZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnZXh0ZW5zaW9ucycpICYmXG4gICAgICAgIGdsdGYuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2xpZ2h0c19wdW5jdHVhbCcpICYmIGdsdGYuZXh0ZW5zaW9ucy5LSFJfbGlnaHRzX3B1bmN0dWFsLmhhc093blByb3BlcnR5KCdsaWdodHMnKSkge1xuXG4gICAgICAgIGNvbnN0IGdsdGZMaWdodHMgPSBnbHRmLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5saWdodHM7XG4gICAgICAgIGlmIChnbHRmTGlnaHRzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpZ2h0ICYmIG9wdGlvbnMubGlnaHQucHJlcHJvY2VzcztcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubGlnaHQgJiYgb3B0aW9ucy5saWdodC5wcm9jZXNzIHx8IGNyZWF0ZUxpZ2h0O1xuICAgICAgICAgICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubGlnaHQgJiYgb3B0aW9ucy5saWdodC5wb3N0cHJvY2VzcztcblxuICAgICAgICAgICAgLy8gaGFuZGxlIG5vZGVzIHdpdGggbGlnaHRzXG4gICAgICAgICAgICBnbHRmLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSAmJlxuICAgICAgICAgICAgICAgICAgICBnbHRmTm9kZS5leHRlbnNpb25zLmhhc093blByb3BlcnR5KCdLSFJfbGlnaHRzX3B1bmN0dWFsJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5LSFJfbGlnaHRzX3B1bmN0dWFsLmhhc093blByb3BlcnR5KCdsaWdodCcpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRJbmRleCA9IGdsdGZOb2RlLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5saWdodDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkxpZ2h0ID0gZ2x0ZkxpZ2h0c1tsaWdodEluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZMaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZMaWdodCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IHByb2Nlc3MoZ2x0ZkxpZ2h0LCBub2Rlc1tub2RlSW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZMaWdodCwgbGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdGhlIGxpZ2h0IHRvIG5vZGUtPmxpZ2h0IG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodHMpIGxpZ2h0cyA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaWdodHMuc2V0KGdsdGZOb2RlLCBsaWdodCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsaWdodHM7XG59O1xuXG4vLyBsaW5rIHNraW5zIHRvIHRoZSBtZXNoZXNcbmNvbnN0IGxpbmtTa2lucyA9IGZ1bmN0aW9uIChnbHRmLCByZW5kZXJzLCBza2lucykge1xuICAgIGdsdGYubm9kZXMuZm9yRWFjaCgoZ2x0Zk5vZGUpID0+IHtcbiAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdtZXNoJykgJiYgZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3NraW4nKSkge1xuICAgICAgICAgICAgY29uc3QgbWVzaEdyb3VwID0gcmVuZGVyc1tnbHRmTm9kZS5tZXNoXS5tZXNoZXM7XG4gICAgICAgICAgICBtZXNoR3JvdXAuZm9yRWFjaCgobWVzaCkgPT4ge1xuICAgICAgICAgICAgICAgIG1lc2guc2tpbiA9IHNraW5zW2dsdGZOb2RlLnNraW5dO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8vIGNyZWF0ZSBlbmdpbmUgcmVzb3VyY2VzIGZyb20gdGhlIGRvd25sb2FkZWQgR0xCIGRhdGFcbmNvbnN0IGNyZWF0ZVJlc291cmNlcyA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCB0ZXh0dXJlQXNzZXRzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuZ2xvYmFsICYmIG9wdGlvbnMuZ2xvYmFsLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuZ2xvYmFsICYmIG9wdGlvbnMuZ2xvYmFsLnBvc3Rwcm9jZXNzO1xuXG4gICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgcHJlcHJvY2VzcyhnbHRmKTtcbiAgICB9XG5cbiAgICAvLyBUaGUgb3JpZ2luYWwgdmVyc2lvbiBvZiBGQUNUIGdlbmVyYXRlZCBpbmNvcnJlY3RseSBmbGlwcGVkIFYgdGV4dHVyZVxuICAgIC8vIGNvb3JkaW5hdGVzLiBXZSBtdXN0IGNvbXBlbnNhdGUgYnkgZmxpcHBpbmcgViBpbiB0aGlzIGNhc2UuIE9uY2VcbiAgICAvLyBhbGwgbW9kZWxzIGhhdmUgYmVlbiByZS1leHBvcnRlZCB3ZSBjYW4gcmVtb3ZlIHRoaXMgZmxhZy5cbiAgICBjb25zdCBmbGlwViA9IGdsdGYuYXNzZXQgJiYgZ2x0Zi5hc3NldC5nZW5lcmF0b3IgPT09ICdQbGF5Q2FudmFzJztcblxuICAgIC8vIFdlJ2QgbGlrZSB0byByZW1vdmUgdGhlIGZsaXBWIGNvZGUgYXQgc29tZSBwb2ludC5cbiAgICBpZiAoZmxpcFYpIHtcbiAgICAgICAgRGVidWcud2FybignZ2xURiBtb2RlbCBtYXkgaGF2ZSBmbGlwcGVkIFVWcy4gUGxlYXNlIHJlY29udmVydC4nKTtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlcyA9IGNyZWF0ZU5vZGVzKGdsdGYsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHNjZW5lcyA9IGNyZWF0ZVNjZW5lcyhnbHRmLCBub2Rlcyk7XG4gICAgY29uc3QgbGlnaHRzID0gY3JlYXRlTGlnaHRzKGdsdGYsIG5vZGVzLCBvcHRpb25zKTtcbiAgICBjb25zdCBjYW1lcmFzID0gY3JlYXRlQ2FtZXJhcyhnbHRmLCBub2Rlcywgb3B0aW9ucyk7XG4gICAgY29uc3QgYW5pbWF0aW9ucyA9IGNyZWF0ZUFuaW1hdGlvbnMoZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzLCBvcHRpb25zKTtcbiAgICBjb25zdCBtYXRlcmlhbHMgPSBjcmVhdGVNYXRlcmlhbHMoZ2x0ZiwgdGV4dHVyZUFzc2V0cy5tYXAoZnVuY3Rpb24gKHRleHR1cmVBc3NldCkge1xuICAgICAgICByZXR1cm4gdGV4dHVyZUFzc2V0LnJlc291cmNlO1xuICAgIH0pLCBvcHRpb25zLCBmbGlwVik7XG4gICAgY29uc3QgdmFyaWFudHMgPSBjcmVhdGVWYXJpYW50cyhnbHRmKTtcbiAgICBjb25zdCBtZXNoVmFyaWFudHMgPSB7fTtcbiAgICBjb25zdCBtZXNoRGVmYXVsdE1hdGVyaWFscyA9IHt9O1xuICAgIGNvbnN0IG1lc2hlcyA9IGNyZWF0ZU1lc2hlcyhkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCBjYWxsYmFjaywgZmxpcFYsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHNraW5zID0gY3JlYXRlU2tpbnMoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld3MpO1xuXG4gICAgLy8gY3JlYXRlIHJlbmRlcnMgdG8gd3JhcCBtZXNoZXNcbiAgICBjb25zdCByZW5kZXJzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVuZGVyc1tpXSA9IG5ldyBSZW5kZXIoKTtcbiAgICAgICAgcmVuZGVyc1tpXS5tZXNoZXMgPSBtZXNoZXNbaV07XG4gICAgfVxuXG4gICAgLy8gbGluayBza2lucyB0byBtZXNoZXNcbiAgICBsaW5rU2tpbnMoZ2x0ZiwgcmVuZGVycywgc2tpbnMpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IEdsYlJlc291cmNlcyhnbHRmKTtcbiAgICByZXN1bHQubm9kZXMgPSBub2RlcztcbiAgICByZXN1bHQuc2NlbmVzID0gc2NlbmVzO1xuICAgIHJlc3VsdC5hbmltYXRpb25zID0gYW5pbWF0aW9ucztcbiAgICByZXN1bHQudGV4dHVyZXMgPSB0ZXh0dXJlQXNzZXRzO1xuICAgIHJlc3VsdC5tYXRlcmlhbHMgPSBtYXRlcmlhbHM7XG4gICAgcmVzdWx0LnZhcmlhbnRzID0gdmFyaWFudHM7XG4gICAgcmVzdWx0Lm1lc2hWYXJpYW50cyA9IG1lc2hWYXJpYW50cztcbiAgICByZXN1bHQubWVzaERlZmF1bHRNYXRlcmlhbHMgPSBtZXNoRGVmYXVsdE1hdGVyaWFscztcbiAgICByZXN1bHQucmVuZGVycyA9IHJlbmRlcnM7XG4gICAgcmVzdWx0LnNraW5zID0gc2tpbnM7XG4gICAgcmVzdWx0LmxpZ2h0cyA9IGxpZ2h0cztcbiAgICByZXN1bHQuY2FtZXJhcyA9IGNhbWVyYXM7XG5cbiAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZiwgcmVzdWx0KTtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xufTtcblxuY29uc3QgYXBwbHlTYW1wbGVyID0gZnVuY3Rpb24gKHRleHR1cmUsIGdsdGZTYW1wbGVyKSB7XG4gICAgY29uc3QgZ2V0RmlsdGVyID0gZnVuY3Rpb24gKGZpbHRlciwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgIHN3aXRjaCAoZmlsdGVyKSB7XG4gICAgICAgICAgICBjYXNlIDk3Mjg6IHJldHVybiBGSUxURVJfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTcyOTogcmV0dXJuIEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICBjYXNlIDk5ODQ6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTk4NTogcmV0dXJuIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk5ODY6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgY2FzZSA5OTg3OiByZXR1cm4gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgZGVmYXVsdDogICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGdldFdyYXAgPSBmdW5jdGlvbiAod3JhcCwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgIHN3aXRjaCAod3JhcCkge1xuICAgICAgICAgICAgY2FzZSAzMzA3MTogcmV0dXJuIEFERFJFU1NfQ0xBTVBfVE9fRURHRTtcbiAgICAgICAgICAgIGNhc2UgMzM2NDg6IHJldHVybiBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDtcbiAgICAgICAgICAgIGNhc2UgMTA0OTc6IHJldHVybiBBRERSRVNTX1JFUEVBVDtcbiAgICAgICAgICAgIGRlZmF1bHQ6ICAgIHJldHVybiBkZWZhdWx0VmFsdWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHRleHR1cmUpIHtcbiAgICAgICAgZ2x0ZlNhbXBsZXIgPSBnbHRmU2FtcGxlciB8fCB7IH07XG4gICAgICAgIHRleHR1cmUubWluRmlsdGVyID0gZ2V0RmlsdGVyKGdsdGZTYW1wbGVyLm1pbkZpbHRlciwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5tYWdGaWx0ZXIgPSBnZXRGaWx0ZXIoZ2x0ZlNhbXBsZXIubWFnRmlsdGVyLCBGSUxURVJfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzVSA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFMsIEFERFJFU1NfUkVQRUFUKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzViA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFQsIEFERFJFU1NfUkVQRUFUKTtcbiAgICB9XG59O1xuXG5sZXQgZ2x0ZlRleHR1cmVVbmlxdWVJZCA9IDA7XG5cbi8vIGxvYWQgYW4gaW1hZ2VcbmNvbnN0IGxvYWRJbWFnZUFzeW5jID0gZnVuY3Rpb24gKGdsdGZJbWFnZSwgaW5kZXgsIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmltYWdlICYmIG9wdGlvbnMuaW1hZ2UucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLmltYWdlICYmIG9wdGlvbnMuaW1hZ2UucHJvY2Vzc0FzeW5jKSB8fCBmdW5jdGlvbiAoZ2x0ZkltYWdlLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmltYWdlICYmIG9wdGlvbnMuaW1hZ2UucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkltYWdlLCB0ZXh0dXJlQXNzZXQpO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRleHR1cmVBc3NldCk7XG4gICAgfTtcblxuICAgIGNvbnN0IG1pbWVUeXBlRmlsZUV4dGVuc2lvbnMgPSB7XG4gICAgICAgICdpbWFnZS9wbmcnOiAncG5nJyxcbiAgICAgICAgJ2ltYWdlL2pwZWcnOiAnanBnJyxcbiAgICAgICAgJ2ltYWdlL2Jhc2lzJzogJ2Jhc2lzJyxcbiAgICAgICAgJ2ltYWdlL2t0eCc6ICdrdHgnLFxuICAgICAgICAnaW1hZ2Uva3R4Mic6ICdrdHgyJyxcbiAgICAgICAgJ2ltYWdlL3ZuZC1tcy5kZHMnOiAnZGRzJ1xuICAgIH07XG5cbiAgICBjb25zdCBsb2FkVGV4dHVyZSA9IGZ1bmN0aW9uICh1cmwsIGJ1ZmZlclZpZXcsIG1pbWVUeXBlLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSAoZ2x0ZkltYWdlLm5hbWUgfHwgJ2dsdGYtdGV4dHVyZScpICsgJy0nICsgZ2x0ZlRleHR1cmVVbmlxdWVJZCsrO1xuXG4gICAgICAgIC8vIGNvbnN0cnVjdCB0aGUgYXNzZXQgZmlsZVxuICAgICAgICBjb25zdCBmaWxlID0ge1xuICAgICAgICAgICAgdXJsOiB1cmwgfHwgbmFtZVxuICAgICAgICB9O1xuICAgICAgICBpZiAoYnVmZmVyVmlldykge1xuICAgICAgICAgICAgZmlsZS5jb250ZW50cyA9IGJ1ZmZlclZpZXcuc2xpY2UoMCkuYnVmZmVyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtaW1lVHlwZSkge1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gbWltZVR5cGVGaWxlRXh0ZW5zaW9uc1ttaW1lVHlwZV07XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uKSB7XG4gICAgICAgICAgICAgICAgZmlsZS5maWxlbmFtZSA9IGZpbGUudXJsICsgJy4nICsgZXh0ZW5zaW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCBsb2FkIHRoZSBhc3NldFxuICAgICAgICBjb25zdCBhc3NldCA9IG5ldyBBc3NldChuYW1lLCAndGV4dHVyZScsIGZpbGUsIG51bGwsIG9wdGlvbnMpO1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIG9uTG9hZCk7XG4gICAgICAgIGFzc2V0Lm9uKCdlcnJvcicsIGNhbGxiYWNrKTtcbiAgICAgICAgcmVnaXN0cnkuYWRkKGFzc2V0KTtcbiAgICAgICAgcmVnaXN0cnkubG9hZChhc3NldCk7XG4gICAgfTtcblxuICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgIHByZXByb2Nlc3MoZ2x0ZkltYWdlKTtcbiAgICB9XG5cbiAgICBwcm9jZXNzQXN5bmMoZ2x0ZkltYWdlLCBmdW5jdGlvbiAoZXJyLCB0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSBlbHNlIGlmICh0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgIG9uTG9hZCh0ZXh0dXJlQXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgndXJpJykpIHtcbiAgICAgICAgICAgICAgICAvLyB1cmkgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgaWYgKGlzRGF0YVVSSShnbHRmSW1hZ2UudXJpKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZShnbHRmSW1hZ2UudXJpLCBudWxsLCBnZXREYXRhVVJJTWltZVR5cGUoZ2x0ZkltYWdlLnVyaSksIG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRUZXh0dXJlKHBhdGguam9pbih1cmxCYXNlLCBnbHRmSW1hZ2UudXJpKSwgbnVsbCwgbnVsbCwgeyBjcm9zc09yaWdpbjogJ2Fub255bW91cycgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChnbHRmSW1hZ2UuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSAmJiBnbHRmSW1hZ2UuaGFzT3duUHJvcGVydHkoJ21pbWVUeXBlJykpIHtcbiAgICAgICAgICAgICAgICAvLyBidWZmZXJ2aWV3XG4gICAgICAgICAgICAgICAgbG9hZFRleHR1cmUobnVsbCwgYnVmZmVyVmlld3NbZ2x0ZkltYWdlLmJ1ZmZlclZpZXddLCBnbHRmSW1hZ2UubWltZVR5cGUsIG51bGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBmYWlsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgaW1hZ2UgZm91bmQgaW4gZ2x0ZiAobmVpdGhlciB1cmkgb3IgYnVmZmVyVmlldyBmb3VuZCkuIGluZGV4PScgKyBpbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8vIGxvYWQgdGV4dHVyZXMgdXNpbmcgdGhlIGFzc2V0IHN5c3RlbVxuY29uc3QgbG9hZFRleHR1cmVzQXN5bmMgPSBmdW5jdGlvbiAoZ2x0ZiwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnaW1hZ2VzJykgfHwgZ2x0Zi5pbWFnZXMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICFnbHRmLmhhc093blByb3BlcnR5KCd0ZXh0dXJlcycpIHx8IGdsdGYudGV4dHVyZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIFtdKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMudGV4dHVyZSAmJiBvcHRpb25zLnRleHR1cmUucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLnRleHR1cmUgJiYgb3B0aW9ucy50ZXh0dXJlLnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZUZXh0dXJlLCBnbHRmSW1hZ2VzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLnRleHR1cmUgJiYgb3B0aW9ucy50ZXh0dXJlLnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3QgYXNzZXRzID0gW107ICAgICAgICAvLyBvbmUgcGVyIGltYWdlXG4gICAgY29uc3QgdGV4dHVyZXMgPSBbXTsgICAgICAvLyBsaXN0IHBlciBpbWFnZVxuXG4gICAgbGV0IHJlbWFpbmluZyA9IGdsdGYudGV4dHVyZXMubGVuZ3RoO1xuICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uICh0ZXh0dXJlSW5kZXgsIGltYWdlSW5kZXgpIHtcbiAgICAgICAgaWYgKCF0ZXh0dXJlc1tpbWFnZUluZGV4XSkge1xuICAgICAgICAgICAgdGV4dHVyZXNbaW1hZ2VJbmRleF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0ZXh0dXJlc1tpbWFnZUluZGV4XS5wdXNoKHRleHR1cmVJbmRleCk7XG5cbiAgICAgICAgaWYgKC0tcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgIHRleHR1cmVzLmZvckVhY2goZnVuY3Rpb24gKHRleHR1cmVMaXN0LCBpbWFnZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZUxpc3QuZm9yRWFjaChmdW5jdGlvbiAodGV4dHVyZUluZGV4LCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXh0dXJlQXNzZXQgPSAoaW5kZXggPT09IDApID8gYXNzZXRzW2ltYWdlSW5kZXhdIDogY2xvbmVUZXh0dXJlQXNzZXQoYXNzZXRzW2ltYWdlSW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgYXBwbHlTYW1wbGVyKHRleHR1cmVBc3NldC5yZXNvdXJjZSwgKGdsdGYuc2FtcGxlcnMgfHwgW10pW2dsdGYudGV4dHVyZXNbdGV4dHVyZUluZGV4XS5zYW1wbGVyXSk7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFt0ZXh0dXJlSW5kZXhdID0gdGV4dHVyZUFzc2V0O1xuICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGYudGV4dHVyZXNbdGV4dHVyZUluZGV4XSwgdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0Zi50ZXh0dXJlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmVGV4dHVyZSA9IGdsdGYudGV4dHVyZXNbaV07XG5cbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZlRleHR1cmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZUZXh0dXJlLCBnbHRmLmltYWdlcywgZnVuY3Rpb24gKGksIGdsdGZUZXh0dXJlLCBlcnIsIGdsdGZJbWFnZUluZGV4KSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZJbWFnZUluZGV4ID09PSB1bmRlZmluZWQgfHwgZ2x0ZkltYWdlSW5kZXggPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2x0ZkltYWdlSW5kZXggPSBnbHRmVGV4dHVyZT8uZXh0ZW5zaW9ucz8uS0hSX3RleHR1cmVfYmFzaXN1Py5zb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmSW1hZ2VJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbHRmSW1hZ2VJbmRleCA9IGdsdGZUZXh0dXJlLnNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhc3NldHNbZ2x0ZkltYWdlSW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGltYWdlIGhhcyBhbHJlYWR5IGJlZW4gbG9hZGVkXG4gICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBnbHRmSW1hZ2VJbmRleCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZmlyc3Qgb2NjY3VycmVuY2UsIGxvYWQgaXRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkltYWdlID0gZ2x0Zi5pbWFnZXNbZ2x0ZkltYWdlSW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBsb2FkSW1hZ2VBc3luYyhnbHRmSW1hZ2UsIGksIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2dsdGZJbWFnZUluZGV4XSA9IHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgZ2x0ZkltYWdlSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZChudWxsLCBpLCBnbHRmVGV4dHVyZSkpO1xuICAgIH1cbn07XG5cbi8vIGxvYWQgZ2x0ZiBidWZmZXJzIGFzeW5jaHJvbm91c2x5LCByZXR1cm5pbmcgdGhlbSBpbiB0aGUgY2FsbGJhY2tcbmNvbnN0IGxvYWRCdWZmZXJzQXN5bmMgPSBmdW5jdGlvbiAoZ2x0ZiwgYmluYXJ5Q2h1bmssIHVybEJhc2UsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBpZiAoIWdsdGYuYnVmZmVycyB8fCBnbHRmLmJ1ZmZlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlciAmJiBvcHRpb25zLmJ1ZmZlci5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3NBc3luYyA9IChvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyICYmIG9wdGlvbnMuYnVmZmVyLnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZCdWZmZXIsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgIH07XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyICYmIG9wdGlvbnMuYnVmZmVyLnBvc3Rwcm9jZXNzO1xuXG4gICAgbGV0IHJlbWFpbmluZyA9IGdsdGYuYnVmZmVycy5sZW5ndGg7XG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKGluZGV4LCBidWZmZXIpIHtcbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IGJ1ZmZlcjtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmLmJ1ZmZlcnNbaW5kZXhdLCBidWZmZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYuYnVmZmVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmQnVmZmVyID0gZ2x0Zi5idWZmZXJzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZCdWZmZXIsIGZ1bmN0aW9uIChpLCBnbHRmQnVmZmVyLCBlcnIsIGFycmF5QnVmZmVyKSB7ICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWxvb3AtZnVuY1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgb25Mb2FkKGksIG5ldyBVaW50OEFycmF5KGFycmF5QnVmZmVyKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChnbHRmQnVmZmVyLmhhc093blByb3BlcnR5KCd1cmknKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNEYXRhVVJJKGdsdGZCdWZmZXIudXJpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29udmVydCBiYXNlNjQgdG8gcmF3IGJpbmFyeSBkYXRhIGhlbGQgaW4gYSBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRvZXNuJ3QgaGFuZGxlIFVSTEVuY29kZWQgRGF0YVVSSXMgLSBzZWUgU08gYW5zd2VyICM2ODUwMjc2IGZvciBjb2RlIHRoYXQgZG9lcyB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBieXRlU3RyaW5nID0gYXRvYihnbHRmQnVmZmVyLnVyaS5zcGxpdCgnLCcpWzFdKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIGEgdmlldyBpbnRvIHRoZSBidWZmZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpbmFyeUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZVN0cmluZy5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIGJ5dGVzIG9mIHRoZSBidWZmZXIgdG8gdGhlIGNvcnJlY3QgdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJ5dGVTdHJpbmcubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5hcnlBcnJheVtqXSA9IGJ5dGVTdHJpbmcuY2hhckNvZGVBdChqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgb25Mb2FkKGksIGJpbmFyeUFycmF5KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGh0dHAuZ2V0KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGguam9pbih1cmxCYXNlLCBnbHRmQnVmZmVyLnVyaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBjYWNoZTogdHJ1ZSwgcmVzcG9uc2VUeXBlOiAnYXJyYXlidWZmZXInLCByZXRyeTogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAoaSwgZXJyLCByZXN1bHQpIHsgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBuZXcgVWludDhBcnJheShyZXN1bHQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0uYmluZChudWxsLCBpKVxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGdsYiBidWZmZXIgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBiaW5hcnlDaHVuayk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQobnVsbCwgaSwgZ2x0ZkJ1ZmZlcikpO1xuICAgIH1cbn07XG5cbi8vIHBhcnNlIHRoZSBnbHRmIGNodW5rLCByZXR1cm5zIHRoZSBnbHRmIGpzb25cbmNvbnN0IHBhcnNlR2x0ZiA9IGZ1bmN0aW9uIChnbHRmQ2h1bmssIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgZGVjb2RlQmluYXJ5VXRmOCA9IGZ1bmN0aW9uIChhcnJheSkge1xuICAgICAgICBpZiAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShhcnJheSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RyID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGFycmF5W2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKHN0cikpO1xuICAgIH07XG5cbiAgICBjb25zdCBnbHRmID0gSlNPTi5wYXJzZShkZWNvZGVCaW5hcnlVdGY4KGdsdGZDaHVuaykpO1xuXG4gICAgLy8gY2hlY2sgZ2x0ZiB2ZXJzaW9uXG4gICAgaWYgKGdsdGYuYXNzZXQgJiYgZ2x0Zi5hc3NldC52ZXJzaW9uICYmIHBhcnNlRmxvYXQoZ2x0Zi5hc3NldC52ZXJzaW9uKSA8IDIpIHtcbiAgICAgICAgY2FsbGJhY2soYEludmFsaWQgZ2x0ZiB2ZXJzaW9uLiBFeHBlY3RlZCB2ZXJzaW9uIDIuMCBvciBhYm92ZSBidXQgZm91bmQgdmVyc2lvbiAnJHtnbHRmLmFzc2V0LnZlcnNpb259Jy5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGNoZWNrIHJlcXVpcmVkIGV4dGVuc2lvbnNcbiAgICBjb25zdCBleHRlbnNpb25zUmVxdWlyZWQgPSBnbHRmPy5leHRlbnNpb25zUmVxdWlyZWQgfHwgW107XG4gICAgaWYgKCFkcmFjb0RlY29kZXJJbnN0YW5jZSAmJiAhZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlKCkgJiYgZXh0ZW5zaW9uc1JlcXVpcmVkLmluZGV4T2YoJ0tIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uJykgIT09IC0xKSB7XG4gICAgICAgIFdhc21Nb2R1bGUuZ2V0SW5zdGFuY2UoJ0RyYWNvRGVjb2Rlck1vZHVsZScsIChpbnN0YW5jZSkgPT4ge1xuICAgICAgICAgICAgZHJhY29EZWNvZGVySW5zdGFuY2UgPSBpbnN0YW5jZTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGdsdGYpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBnbHRmKTtcbiAgICB9XG59O1xuXG4vLyBwYXJzZSBnbGIgZGF0YSwgcmV0dXJucyB0aGUgZ2x0ZiBhbmQgYmluYXJ5IGNodW5rXG5jb25zdCBwYXJzZUdsYiA9IGZ1bmN0aW9uIChnbGJEYXRhLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGRhdGEgPSAoZ2xiRGF0YSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSA/IG5ldyBEYXRhVmlldyhnbGJEYXRhKSA6IG5ldyBEYXRhVmlldyhnbGJEYXRhLmJ1ZmZlciwgZ2xiRGF0YS5ieXRlT2Zmc2V0LCBnbGJEYXRhLmJ5dGVMZW5ndGgpO1xuXG4gICAgLy8gcmVhZCBoZWFkZXJcbiAgICBjb25zdCBtYWdpYyA9IGRhdGEuZ2V0VWludDMyKDAsIHRydWUpO1xuICAgIGNvbnN0IHZlcnNpb24gPSBkYXRhLmdldFVpbnQzMig0LCB0cnVlKTtcbiAgICBjb25zdCBsZW5ndGggPSBkYXRhLmdldFVpbnQzMig4LCB0cnVlKTtcblxuICAgIGlmIChtYWdpYyAhPT0gMHg0NjU0NkM2Nykge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBtYWdpYyBudW1iZXIgZm91bmQgaW4gZ2xiIGhlYWRlci4gRXhwZWN0ZWQgMHg0NjU0NkM2NywgZm91bmQgMHgnICsgbWFnaWMudG9TdHJpbmcoMTYpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh2ZXJzaW9uICE9PSAyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIHZlcnNpb24gbnVtYmVyIGZvdW5kIGluIGdsYiBoZWFkZXIuIEV4cGVjdGVkIDIsIGZvdW5kICcgKyB2ZXJzaW9uKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChsZW5ndGggPD0gMCB8fCBsZW5ndGggPiBkYXRhLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbGVuZ3RoIGZvdW5kIGluIGdsYiBoZWFkZXIuIEZvdW5kICcgKyBsZW5ndGgpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gcmVhZCBjaHVua3NcbiAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICBsZXQgb2Zmc2V0ID0gMTI7XG4gICAgd2hpbGUgKG9mZnNldCA8IGxlbmd0aCkge1xuICAgICAgICBjb25zdCBjaHVua0xlbmd0aCA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCwgdHJ1ZSk7XG4gICAgICAgIGlmIChvZmZzZXQgKyBjaHVua0xlbmd0aCArIDggPiBkYXRhLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjaHVuayBsZW5ndGggZm91bmQgaW4gZ2xiLiBGb3VuZCAnICsgY2h1bmtMZW5ndGgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNodW5rVHlwZSA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCArIDQsIHRydWUpO1xuICAgICAgICBjb25zdCBjaHVua0RhdGEgPSBuZXcgVWludDhBcnJheShkYXRhLmJ1ZmZlciwgZGF0YS5ieXRlT2Zmc2V0ICsgb2Zmc2V0ICsgOCwgY2h1bmtMZW5ndGgpO1xuICAgICAgICBjaHVua3MucHVzaCh7IGxlbmd0aDogY2h1bmtMZW5ndGgsIHR5cGU6IGNodW5rVHlwZSwgZGF0YTogY2h1bmtEYXRhIH0pO1xuICAgICAgICBvZmZzZXQgKz0gY2h1bmtMZW5ndGggKyA4O1xuICAgIH1cblxuICAgIGlmIChjaHVua3MubGVuZ3RoICE9PSAxICYmIGNodW5rcy5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbnVtYmVyIG9mIGNodW5rcyBmb3VuZCBpbiBnbGIgZmlsZS4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaHVua3NbMF0udHlwZSAhPT0gMHg0RTRGNTM0QSkge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBjaHVuayB0eXBlIGZvdW5kIGluIGdsYiBmaWxlLiBFeHBlY3RlZCAweDRFNEY1MzRBLCBmb3VuZCAweCcgKyBjaHVua3NbMF0udHlwZS50b1N0cmluZygxNikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNodW5rcy5sZW5ndGggPiAxICYmIGNodW5rc1sxXS50eXBlICE9PSAweDAwNEU0OTQyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGNodW5rIHR5cGUgZm91bmQgaW4gZ2xiIGZpbGUuIEV4cGVjdGVkIDB4MDA0RTQ5NDIsIGZvdW5kIDB4JyArIGNodW5rc1sxXS50eXBlLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgIGdsdGZDaHVuazogY2h1bmtzWzBdLmRhdGEsXG4gICAgICAgIGJpbmFyeUNodW5rOiBjaHVua3MubGVuZ3RoID09PSAyID8gY2h1bmtzWzFdLmRhdGEgOiBudWxsXG4gICAgfSk7XG59O1xuXG4vLyBwYXJzZSB0aGUgY2h1bmsgb2YgZGF0YSwgd2hpY2ggY2FuIGJlIGdsYiBvciBnbHRmXG5jb25zdCBwYXJzZUNodW5rID0gZnVuY3Rpb24gKGZpbGVuYW1lLCBkYXRhLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGhhc0dsYkhlYWRlciA9ICgpID0+IHtcbiAgICAgICAgLy8gZ2xiIGZvcm1hdCBzdGFydHMgd2l0aCAnZ2xURidcbiAgICAgICAgY29uc3QgdTggPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgICAgICAgcmV0dXJuIHU4WzBdID09PSAxMDMgJiYgdThbMV0gPT09IDEwOCAmJiB1OFsyXSA9PT0gODQgJiYgdThbM10gPT09IDcwO1xuICAgIH07XG5cbiAgICBpZiAoKGZpbGVuYW1lICYmIGZpbGVuYW1lLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoJy5nbGInKSkgfHwgaGFzR2xiSGVhZGVyKCkpIHtcbiAgICAgICAgcGFyc2VHbGIoZGF0YSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgICAgIGdsdGZDaHVuazogZGF0YSxcbiAgICAgICAgICAgIGJpbmFyeUNodW5rOiBudWxsXG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8vIGNyZWF0ZSBidWZmZXIgdmlld3NcbmNvbnN0IHBhcnNlQnVmZmVyVmlld3NBc3luYyA9IGZ1bmN0aW9uIChnbHRmLCBidWZmZXJzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcgJiYgb3B0aW9ucy5idWZmZXJWaWV3LnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmQnVmZmVyVmlldywgYnVmZmVycywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wb3N0cHJvY2VzcztcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLmJ1ZmZlclZpZXdzID8gZ2x0Zi5idWZmZXJWaWV3cy5sZW5ndGggOiAwO1xuXG4gICAgLy8gaGFuZGxlIGNhc2Ugb2Ygbm8gYnVmZmVyc1xuICAgIGlmICghcmVtYWluaW5nKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKGluZGV4LCBidWZmZXJWaWV3KSB7XG4gICAgICAgIGNvbnN0IGdsdGZCdWZmZXJWaWV3ID0gZ2x0Zi5idWZmZXJWaWV3c1tpbmRleF07XG4gICAgICAgIGlmIChnbHRmQnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpKSB7XG4gICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVTdHJpZGUgPSBnbHRmQnVmZmVyVmlldy5ieXRlU3RyaWRlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IGJ1ZmZlclZpZXc7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkJ1ZmZlclZpZXcsIGJ1ZmZlclZpZXcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlclZpZXcgPSBnbHRmLmJ1ZmZlclZpZXdzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXJWaWV3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyVmlldywgYnVmZmVycywgZnVuY3Rpb24gKGksIGdsdGZCdWZmZXJWaWV3LCBlcnIsIHJlc3VsdCkgeyAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWxvb3AtZnVuY1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCByZXN1bHQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBidWZmZXJzW2dsdGZCdWZmZXJWaWV3LmJ1ZmZlcl07XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlci5idWZmZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5ieXRlT2Zmc2V0ICsgKGdsdGZCdWZmZXJWaWV3LmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZCdWZmZXJWaWV3LmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCB0eXBlZEFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKG51bGwsIGksIGdsdGZCdWZmZXJWaWV3KSk7XG4gICAgfVxufTtcblxuLy8gLS0gR2xiUGFyc2VyXG5jbGFzcyBHbGJQYXJzZXIge1xuICAgIC8vIHBhcnNlIHRoZSBnbHRmIG9yIGdsYiBkYXRhIGFzeW5jaHJvbm91c2x5LCBsb2FkaW5nIGV4dGVybmFsIHJlc291cmNlc1xuICAgIHN0YXRpYyBwYXJzZUFzeW5jKGZpbGVuYW1lLCB1cmxCYXNlLCBkYXRhLCBkZXZpY2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICAvLyBwYXJzZSB0aGUgZGF0YVxuICAgICAgICBwYXJzZUNodW5rKGZpbGVuYW1lLCBkYXRhLCBmdW5jdGlvbiAoZXJyLCBjaHVua3MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcGFyc2UgZ2x0ZlxuICAgICAgICAgICAgcGFyc2VHbHRmKGNodW5rcy5nbHRmQ2h1bmssIGZ1bmN0aW9uIChlcnIsIGdsdGYpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBhc3luYyBsb2FkIGV4dGVybmFsIGJ1ZmZlcnNcbiAgICAgICAgICAgICAgICBsb2FkQnVmZmVyc0FzeW5jKGdsdGYsIGNodW5rcy5iaW5hcnlDaHVuaywgdXJsQmFzZSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgYnVmZmVycykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXN5bmMgbG9hZCBidWZmZXIgdmlld3NcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VCdWZmZXJWaWV3c0FzeW5jKGdsdGYsIGJ1ZmZlcnMsIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlclZpZXdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzeW5jIGxvYWQgaW1hZ2VzXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZXNBc3luYyhnbHRmLCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHRleHR1cmVBc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVSZXNvdXJjZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZUFzc2V0cywgb3B0aW9ucywgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHBhcnNlIHRoZSBnbHRmIG9yIGdsYiBkYXRhIHN5bmNocm9ub3VzbHkuIGV4dGVybmFsIHJlc291cmNlcyAoYnVmZmVycyBhbmQgaW1hZ2VzKSBhcmUgaWdub3JlZC5cbiAgICBzdGF0aWMgcGFyc2UoZmlsZW5hbWUsIGRhdGEsIGRldmljZSwgb3B0aW9ucykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gbnVsbDtcblxuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7IH07XG5cbiAgICAgICAgLy8gcGFyc2UgdGhlIGRhdGFcbiAgICAgICAgcGFyc2VDaHVuayhmaWxlbmFtZSwgZGF0YSwgZnVuY3Rpb24gKGVyciwgY2h1bmtzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJzZSBnbHRmXG4gICAgICAgICAgICAgICAgcGFyc2VHbHRmKGNodW5rcy5nbHRmQ2h1bmssIGZ1bmN0aW9uIChlcnIsIGdsdGYpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGFyc2UgYnVmZmVyIHZpZXdzXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZUJ1ZmZlclZpZXdzQXN5bmMoZ2x0ZiwgW2NodW5rcy5iaW5hcnlDaHVua10sIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlclZpZXdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIHJlc291cmNlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVSZXNvdXJjZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgW10sIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHJlc3VsdF8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdF87XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBhc3NldHMsIG1heFJldHJpZXMpIHtcbiAgICAgICAgdGhpcy5fZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLl9hc3NldHMgPSBhc3NldHM7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRNYXRlcmlhbCA9IGNyZWF0ZU1hdGVyaWFsKHtcbiAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0R2xiTWF0ZXJpYWwnXG4gICAgICAgIH0sIFtdKTtcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gbWF4UmV0cmllcztcbiAgICB9XG5cbiAgICBfZ2V0VXJsV2l0aG91dFBhcmFtcyh1cmwpIHtcbiAgICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPj0gMCA/IHVybC5zcGxpdCgnPycpWzBdIDogdXJsO1xuICAgIH1cblxuICAgIGxvYWQodXJsLCBjYWxsYmFjaywgYXNzZXQpIHtcbiAgICAgICAgQXNzZXQuZmV0Y2hBcnJheUJ1ZmZlcih1cmwubG9hZCwgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgR2xiUGFyc2VyLnBhcnNlQXN5bmMoXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dldFVybFdpdGhvdXRQYXJhbXModXJsLm9yaWdpbmFsKSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aC5leHRyYWN0UGF0aCh1cmwubG9hZCksXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGV2aWNlLFxuICAgICAgICAgICAgICAgICAgICBhc3NldC5yZWdpc3RyeSxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQub3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmV0dXJuIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBuZXcgR2xiQ29udGFpbmVyUmVzb3VyY2UocmVzdWx0LCBhc3NldCwgdGhpcy5fYXNzZXRzLCB0aGlzLl9kZWZhdWx0TWF0ZXJpYWwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGFzc2V0LCB0aGlzLm1heFJldHJpZXMpO1xuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhLCBhc3NldCkge1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG5cbiAgICBwYXRjaChhc3NldCwgYXNzZXRzKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCB7IEdsYlBhcnNlciB9O1xuIl0sIm5hbWVzIjpbImRyYWNvRGVjb2Rlckluc3RhbmNlIiwiZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlIiwid2luZG93IiwiRHJhY29EZWNvZGVyTW9kdWxlIiwiR2xiUmVzb3VyY2VzIiwiY29uc3RydWN0b3IiLCJnbHRmIiwibm9kZXMiLCJzY2VuZXMiLCJhbmltYXRpb25zIiwidGV4dHVyZXMiLCJtYXRlcmlhbHMiLCJ2YXJpYW50cyIsIm1lc2hWYXJpYW50cyIsIm1lc2hEZWZhdWx0TWF0ZXJpYWxzIiwicmVuZGVycyIsInNraW5zIiwibGlnaHRzIiwiY2FtZXJhcyIsImRlc3Ryb3kiLCJmb3JFYWNoIiwicmVuZGVyIiwibWVzaGVzIiwiaXNEYXRhVVJJIiwidXJpIiwidGVzdCIsImdldERhdGFVUklNaW1lVHlwZSIsInN1YnN0cmluZyIsImluZGV4T2YiLCJnZXROdW1Db21wb25lbnRzIiwiYWNjZXNzb3JUeXBlIiwiZ2V0Q29tcG9uZW50VHlwZSIsImNvbXBvbmVudFR5cGUiLCJUWVBFX0lOVDgiLCJUWVBFX1VJTlQ4IiwiVFlQRV9JTlQxNiIsIlRZUEVfVUlOVDE2IiwiVFlQRV9JTlQzMiIsIlRZUEVfVUlOVDMyIiwiVFlQRV9GTE9BVDMyIiwiZ2V0Q29tcG9uZW50U2l6ZUluQnl0ZXMiLCJnZXRDb21wb25lbnREYXRhVHlwZSIsIkludDhBcnJheSIsIlVpbnQ4QXJyYXkiLCJJbnQxNkFycmF5IiwiVWludDE2QXJyYXkiLCJJbnQzMkFycmF5IiwiVWludDMyQXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJnbHRmVG9FbmdpbmVTZW1hbnRpY01hcCIsIlNFTUFOVElDX1BPU0lUSU9OIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEFOR0VOVCIsIlNFTUFOVElDX0NPTE9SIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJTRU1BTlRJQ19URVhDT09SRDAiLCJTRU1BTlRJQ19URVhDT09SRDEiLCJTRU1BTlRJQ19URVhDT09SRDIiLCJTRU1BTlRJQ19URVhDT09SRDMiLCJTRU1BTlRJQ19URVhDT09SRDQiLCJTRU1BTlRJQ19URVhDT09SRDUiLCJTRU1BTlRJQ19URVhDT09SRDYiLCJTRU1BTlRJQ19URVhDT09SRDciLCJnZXREZXF1YW50aXplRnVuYyIsInNyY1R5cGUiLCJ4IiwiTWF0aCIsIm1heCIsImRlcXVhbnRpemVBcnJheSIsImRzdEFycmF5Iiwic3JjQXJyYXkiLCJjb252RnVuYyIsImxlbiIsImxlbmd0aCIsImkiLCJnZXRBY2Nlc3NvckRhdGEiLCJnbHRmQWNjZXNzb3IiLCJidWZmZXJWaWV3cyIsImZsYXR0ZW4iLCJudW1Db21wb25lbnRzIiwidHlwZSIsImRhdGFUeXBlIiwiYnVmZmVyVmlldyIsInJlc3VsdCIsInNwYXJzZSIsImluZGljZXNBY2Nlc3NvciIsImNvdW50IiwiaW5kaWNlcyIsIk9iamVjdCIsImFzc2lnbiIsInZhbHVlc0FjY2Vzc29yIiwic2NhbGFyIiwidmFsdWVzIiwiaGFzT3duUHJvcGVydHkiLCJiYXNlQWNjZXNzb3IiLCJieXRlT2Zmc2V0Iiwic2xpY2UiLCJ0YXJnZXRJbmRleCIsImoiLCJieXRlc1BlckVsZW1lbnQiLCJCWVRFU19QRVJfRUxFTUVOVCIsInN0b3JhZ2UiLCJBcnJheUJ1ZmZlciIsInRtcEFycmF5IiwiZHN0T2Zmc2V0Iiwic3JjT2Zmc2V0IiwiYnl0ZVN0cmlkZSIsImIiLCJidWZmZXIiLCJnZXRBY2Nlc3NvckRhdGFGbG9hdDMyIiwiZGF0YSIsIm5vcm1hbGl6ZWQiLCJmbG9hdDMyRGF0YSIsImdldEFjY2Vzc29yQm91bmRpbmdCb3giLCJtaW4iLCJjdHlwZSIsIkJvdW5kaW5nQm94IiwiVmVjMyIsImdldFByaW1pdGl2ZVR5cGUiLCJwcmltaXRpdmUiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwibW9kZSIsIlBSSU1JVElWRV9QT0lOVFMiLCJQUklNSVRJVkVfTElORVMiLCJQUklNSVRJVkVfTElORUxPT1AiLCJQUklNSVRJVkVfTElORVNUUklQIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiUFJJTUlUSVZFX1RSSUZBTiIsImdlbmVyYXRlSW5kaWNlcyIsIm51bVZlcnRpY2VzIiwiZHVtbXlJbmRpY2VzIiwiZ2VuZXJhdGVOb3JtYWxzIiwic291cmNlRGVzYyIsInAiLCJjb21wb25lbnRzIiwicG9zaXRpb25zIiwic2l6ZSIsInN0cmlkZSIsInNyY1N0cmlkZSIsInR5cGVkQXJyYXlUeXBlc0J5dGVTaXplIiwic3JjIiwidHlwZWRBcnJheVR5cGVzIiwib2Zmc2V0Iiwibm9ybWFsc1RlbXAiLCJjYWxjdWxhdGVOb3JtYWxzIiwibm9ybWFscyIsInNldCIsImZsaXBUZXhDb29yZFZzIiwidmVydGV4QnVmZmVyIiwiZmxvYXRPZmZzZXRzIiwic2hvcnRPZmZzZXRzIiwiYnl0ZU9mZnNldHMiLCJmb3JtYXQiLCJlbGVtZW50cyIsImVsZW1lbnQiLCJuYW1lIiwicHVzaCIsImZsaXAiLCJvZmZzZXRzIiwib25lIiwidHlwZWRBcnJheSIsImluZGV4IiwiY2xvbmVUZXh0dXJlIiwidGV4dHVyZSIsInNoYWxsb3dDb3B5TGV2ZWxzIiwibWlwIiwiX2xldmVscyIsImxldmVsIiwiY3ViZW1hcCIsImZhY2UiLCJUZXh0dXJlIiwiZGV2aWNlIiwiY2xvbmVUZXh0dXJlQXNzZXQiLCJBc3NldCIsImZpbGUiLCJvcHRpb25zIiwibG9hZGVkIiwicmVzb3VyY2UiLCJyZWdpc3RyeSIsImFkZCIsImNyZWF0ZVZlcnRleEJ1ZmZlckludGVybmFsIiwiZmxpcFYiLCJwb3NpdGlvbkRlc2MiLCJ2ZXJ0ZXhEZXNjIiwic2VtYW50aWMiLCJub3JtYWxpemUiLCJlbGVtZW50T3JkZXIiLCJzb3J0IiwibGhzIiwicmhzIiwibGhzT3JkZXIiLCJyaHNPcmRlciIsImsiLCJzb3VyY2UiLCJ0YXJnZXQiLCJzb3VyY2VPZmZzZXQiLCJ2ZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhGb3JtYXQiLCJpc0NvcnJlY3RseUludGVybGVhdmVkIiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX1NUQVRJQyIsInZlcnRleERhdGEiLCJsb2NrIiwidGFyZ2V0QXJyYXkiLCJzb3VyY2VBcnJheSIsInRhcmdldFN0cmlkZSIsInNvdXJjZVN0cmlkZSIsImRzdCIsImtlbmQiLCJmbG9vciIsInVubG9jayIsImNyZWF0ZVZlcnRleEJ1ZmZlciIsImF0dHJpYnV0ZXMiLCJhY2Nlc3NvcnMiLCJ2ZXJ0ZXhCdWZmZXJEaWN0IiwidXNlQXR0cmlidXRlcyIsImF0dHJpYklkcyIsImF0dHJpYiIsInZiS2V5Iiwiam9pbiIsInZiIiwiYWNjZXNzb3IiLCJhY2Nlc3NvckRhdGEiLCJjcmVhdGVWZXJ0ZXhCdWZmZXJEcmFjbyIsIm91dHB1dEdlb21ldHJ5IiwiZXh0RHJhY28iLCJkZWNvZGVyIiwiZGVjb2Rlck1vZHVsZSIsIm51bVBvaW50cyIsIm51bV9wb2ludHMiLCJleHRyYWN0RHJhY29BdHRyaWJ1dGVJbmZvIiwidW5pcXVlSWQiLCJhdHRyaWJ1dGUiLCJHZXRBdHRyaWJ1dGVCeVVuaXF1ZUlkIiwibnVtVmFsdWVzIiwibnVtX2NvbXBvbmVudHMiLCJkcmFjb0Zvcm1hdCIsImRhdGFfdHlwZSIsInB0ciIsImNvbXBvbmVudFNpemVJbkJ5dGVzIiwic3RvcmFnZVR5cGUiLCJEVF9VSU5UOCIsIl9tYWxsb2MiLCJHZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMiLCJIRUFQVTgiLCJEVF9VSU5UMTYiLCJIRUFQVTE2IiwiRFRfRkxPQVQzMiIsIkhFQVBGMzIiLCJfZnJlZSIsImF0dHJpYnV0ZUluZm8iLCJjcmVhdGVTa2luIiwiZ2x0ZlNraW4iLCJnbGJTa2lucyIsImJpbmRNYXRyaXgiLCJqb2ludHMiLCJudW1Kb2ludHMiLCJpYnAiLCJpbnZlcnNlQmluZE1hdHJpY2VzIiwiaWJtRGF0YSIsImlibVZhbHVlcyIsIk1hdDQiLCJib25lTmFtZXMiLCJrZXkiLCJza2luIiwiZ2V0IiwiU2tpbiIsInRlbXBNYXQiLCJ0ZW1wVmVjIiwiY3JlYXRlTWVzaCIsImdsdGZNZXNoIiwiY2FsbGJhY2siLCJhc3NldE9wdGlvbnMiLCJwcmltaXRpdmVzIiwicHJpbWl0aXZlVHlwZSIsIm51bUluZGljZXMiLCJjYW5Vc2VNb3JwaCIsImV4dGVuc2lvbnMiLCJLSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbiIsInVpbnQ4QnVmZmVyIiwiRGVjb2RlckJ1ZmZlciIsIkluaXQiLCJEZWNvZGVyIiwiZ2VvbWV0cnlUeXBlIiwiR2V0RW5jb2RlZEdlb21ldHJ5VHlwZSIsInN0YXR1cyIsIlBPSU5UX0NMT1VEIiwiUG9pbnRDbG91ZCIsIkRlY29kZUJ1ZmZlclRvUG9pbnRDbG91ZCIsIlRSSUFOR1VMQVJfTUVTSCIsIk1lc2giLCJEZWNvZGVCdWZmZXJUb01lc2giLCJJTlZBTElEX0dFT01FVFJZX1RZUEUiLCJvayIsImVycm9yX21zZyIsIm51bUZhY2VzIiwibnVtX2ZhY2VzIiwiYml0MzIiLCJkYXRhU2l6ZSIsIkdldFRyaWFuZ2xlc1VJbnQzMkFycmF5IiwiSEVBUFUzMiIsIkdldFRyaWFuZ2xlc1VJbnQxNkFycmF5IiwiRGVidWciLCJ3YXJuIiwibWVzaCIsImJhc2UiLCJpbmRleGVkIiwiaW5kZXhGb3JtYXQiLCJJTkRFWEZPUk1BVF9VSU5UOCIsIklOREVYRk9STUFUX1VJTlQxNiIsIklOREVYRk9STUFUX1VJTlQzMiIsImV4dFVpbnRFbGVtZW50IiwiY29uc29sZSIsImluZGV4QnVmZmVyIiwiSW5kZXhCdWZmZXIiLCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzIiwidGVtcE1hcHBpbmciLCJtYXBwaW5ncyIsIm1hcHBpbmciLCJ2YXJpYW50IiwibWF0ZXJpYWwiLCJpZCIsIlBPU0lUSU9OIiwiYWFiYiIsInRhcmdldHMiLCJkZWx0YVBvc2l0aW9ucyIsImRlbHRhUG9zaXRpb25zVHlwZSIsIk5PUk1BTCIsImRlbHRhTm9ybWFscyIsImRlbHRhTm9ybWFsc1R5cGUiLCJleHRyYXMiLCJ0YXJnZXROYW1lcyIsInRvU3RyaW5nIiwiZGVmYXVsdFdlaWdodCIsIndlaWdodHMiLCJwcmVzZXJ2ZURhdGEiLCJtb3JwaFByZXNlcnZlRGF0YSIsIk1vcnBoVGFyZ2V0IiwibW9ycGgiLCJNb3JwaCIsImV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtIiwibWFwcyIsIm1hcCIsInRleENvb3JkIiwiemVyb3MiLCJvbmVzIiwidGV4dHVyZVRyYW5zZm9ybSIsIktIUl90ZXh0dXJlX3RyYW5zZm9ybSIsInNjYWxlIiwicm90YXRpb24iLCJtYXRoIiwiUkFEX1RPX0RFRyIsInRpbGluZ1ZlYyIsIlZlYzIiLCJvZmZzZXRWZWMiLCJleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyIsImNvbG9yIiwiZGlmZnVzZUZhY3RvciIsImRpZmZ1c2UiLCJwb3ciLCJvcGFjaXR5IiwiZGlmZnVzZVRleHR1cmUiLCJkaWZmdXNlTWFwIiwiZGlmZnVzZU1hcENoYW5uZWwiLCJvcGFjaXR5TWFwIiwib3BhY2l0eU1hcENoYW5uZWwiLCJ1c2VNZXRhbG5lc3MiLCJzcGVjdWxhckZhY3RvciIsInNwZWN1bGFyIiwic2hpbmluZXNzIiwiZ2xvc3NpbmVzc0ZhY3RvciIsInNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUiLCJzcGVjdWxhckVuY29kaW5nIiwic3BlY3VsYXJNYXAiLCJnbG9zc01hcCIsInNwZWN1bGFyTWFwQ2hhbm5lbCIsImdsb3NzTWFwQ2hhbm5lbCIsImV4dGVuc2lvbkNsZWFyQ29hdCIsImNsZWFyQ29hdCIsImNsZWFyY29hdEZhY3RvciIsImNsZWFyY29hdFRleHR1cmUiLCJjbGVhckNvYXRNYXAiLCJjbGVhckNvYXRNYXBDaGFubmVsIiwiY2xlYXJDb2F0R2xvc3NpbmVzcyIsImNsZWFyY29hdFJvdWdobmVzc0ZhY3RvciIsImNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUiLCJjbGVhckNvYXRHbG9zc01hcCIsImNsZWFyQ29hdEdsb3NzTWFwQ2hhbm5lbCIsImNsZWFyY29hdE5vcm1hbFRleHR1cmUiLCJjbGVhckNvYXROb3JtYWxNYXAiLCJjbGVhckNvYXRCdW1waW5lc3MiLCJjbGVhckNvYXRHbG9zc0NodW5rIiwiY2h1bmtzIiwiY2xlYXJDb2F0R2xvc3NQUyIsImV4dGVuc2lvblVubGl0IiwidXNlTGlnaHRpbmciLCJlbWlzc2l2ZSIsImNvcHkiLCJlbWlzc2l2ZVRpbnQiLCJkaWZmdXNlVGludCIsImVtaXNzaXZlTWFwIiwiZW1pc3NpdmVNYXBVdiIsImRpZmZ1c2VNYXBVdiIsImVtaXNzaXZlTWFwVGlsaW5nIiwiZGlmZnVzZU1hcFRpbGluZyIsImVtaXNzaXZlTWFwT2Zmc2V0IiwiZGlmZnVzZU1hcE9mZnNldCIsImVtaXNzaXZlTWFwUm90YXRpb24iLCJkaWZmdXNlTWFwUm90YXRpb24iLCJlbWlzc2l2ZU1hcENoYW5uZWwiLCJlbWlzc2l2ZVZlcnRleENvbG9yIiwiZGlmZnVzZVZlcnRleENvbG9yIiwiZW1pc3NpdmVWZXJ0ZXhDb2xvckNoYW5uZWwiLCJkaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsIiwiZXh0ZW5zaW9uU3BlY3VsYXIiLCJ1c2VNZXRhbG5lc3NTcGVjdWxhckNvbG9yIiwic3BlY3VsYXJDb2xvclRleHR1cmUiLCJzcGVjdWxhckNvbG9yRmFjdG9yIiwic3BlY3VsYXJpdHlGYWN0b3IiLCJzcGVjdWxhcml0eUZhY3Rvck1hcENoYW5uZWwiLCJzcGVjdWxhcml0eUZhY3Rvck1hcCIsInNwZWN1bGFyVGV4dHVyZSIsImV4dGVuc2lvbklvciIsInJlZnJhY3Rpb25JbmRleCIsImlvciIsImV4dGVuc2lvblRyYW5zbWlzc2lvbiIsImJsZW5kVHlwZSIsIkJMRU5EX05PUk1BTCIsInVzZUR5bmFtaWNSZWZyYWN0aW9uIiwicmVmcmFjdGlvbiIsInRyYW5zbWlzc2lvbkZhY3RvciIsInJlZnJhY3Rpb25NYXBDaGFubmVsIiwicmVmcmFjdGlvbk1hcCIsInRyYW5zbWlzc2lvblRleHR1cmUiLCJleHRlbnNpb25TaGVlbiIsInVzZVNoZWVuIiwic2hlZW5Db2xvckZhY3RvciIsInNoZWVuIiwic2hlZW5NYXAiLCJzaGVlbkNvbG9yVGV4dHVyZSIsInNoZWVuRW5jb2RpbmciLCJzaGVlbkdsb3NzaW5lc3MiLCJzaGVlblJvdWdobmVzc0ZhY3RvciIsInNoZWVuR2xvc3NpbmVzc01hcCIsInNoZWVuUm91Z2huZXNzVGV4dHVyZSIsInNoZWVuR2xvc3NpbmVzc01hcENoYW5uZWwiLCJzaGVlbkdsb3NzQ2h1bmsiLCJzaGVlbkdsb3NzUFMiLCJleHRlbnNpb25Wb2x1bWUiLCJ0aGlja25lc3MiLCJ0aGlja25lc3NGYWN0b3IiLCJ0aGlja25lc3NNYXAiLCJ0aGlja25lc3NUZXh0dXJlIiwiYXR0ZW51YXRpb25EaXN0YW5jZSIsImF0dGVudWF0aW9uQ29sb3IiLCJhdHRlbnVhdGlvbiIsImV4dGVuc2lvbkVtaXNzaXZlU3RyZW5ndGgiLCJlbWlzc2l2ZUludGVuc2l0eSIsImVtaXNzaXZlU3RyZW5ndGgiLCJleHRlbnNpb25JcmlkZXNjZW5jZSIsInVzZUlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2UiLCJpcmlkZXNjZW5jZUZhY3RvciIsImlyaWRlc2NlbmNlTWFwQ2hhbm5lbCIsImlyaWRlc2NlbmNlTWFwIiwiaXJpZGVzY2VuY2VUZXh0dXJlIiwiaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXgiLCJpcmlkZXNjZW5jZUlvciIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXgiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW0iLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01hcENoYW5uZWwiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01hcCIsImlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZSIsImNyZWF0ZU1hdGVyaWFsIiwiZ2x0Zk1hdGVyaWFsIiwiZ2xvc3NDaHVuayIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJvY2NsdWRlU3BlY3VsYXIiLCJTUEVDT0NDX0FPIiwic3BlY3VsYXJUaW50Iiwic3BlY3VsYXJWZXJ0ZXhDb2xvciIsIkFQSVZlcnNpb24iLCJDSFVOS0FQSV8xXzU3IiwicGJyRGF0YSIsInBick1ldGFsbGljUm91Z2huZXNzIiwiYmFzZUNvbG9yRmFjdG9yIiwiYmFzZUNvbG9yVGV4dHVyZSIsIm1ldGFsbmVzcyIsIm1ldGFsbGljRmFjdG9yIiwicm91Z2huZXNzRmFjdG9yIiwibWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlIiwibWV0YWxuZXNzTWFwIiwibWV0YWxuZXNzTWFwQ2hhbm5lbCIsImdsb3NzUFMiLCJub3JtYWxUZXh0dXJlIiwibm9ybWFsTWFwIiwiYnVtcGluZXNzIiwib2NjbHVzaW9uVGV4dHVyZSIsImFvTWFwIiwiYW9NYXBDaGFubmVsIiwiZW1pc3NpdmVGYWN0b3IiLCJlbWlzc2l2ZVRleHR1cmUiLCJhbHBoYU1vZGUiLCJCTEVORF9OT05FIiwiYWxwaGFUZXN0IiwiYWxwaGFDdXRvZmYiLCJkZXB0aFdyaXRlIiwidHdvU2lkZWRMaWdodGluZyIsImRvdWJsZVNpZGVkIiwiY3VsbCIsIkNVTExGQUNFX05PTkUiLCJDVUxMRkFDRV9CQUNLIiwiZXh0ZW5zaW9uRnVuYyIsInVuZGVmaW5lZCIsInVwZGF0ZSIsImNyZWF0ZUFuaW1hdGlvbiIsImdsdGZBbmltYXRpb24iLCJhbmltYXRpb25JbmRleCIsImdsdGZBY2Nlc3NvcnMiLCJjcmVhdGVBbmltRGF0YSIsIkFuaW1EYXRhIiwiaW50ZXJwTWFwIiwiSU5URVJQT0xBVElPTl9TVEVQIiwiSU5URVJQT0xBVElPTl9MSU5FQVIiLCJJTlRFUlBPTEFUSU9OX0NVQklDIiwiaW5wdXRNYXAiLCJvdXRwdXRNYXAiLCJjdXJ2ZU1hcCIsIm91dHB1dENvdW50ZXIiLCJzYW1wbGVycyIsInNhbXBsZXIiLCJpbnB1dCIsIm91dHB1dCIsImludGVycG9sYXRpb24iLCJjdXJ2ZSIsInBhdGhzIiwicXVhdEFycmF5cyIsInRyYW5zZm9ybVNjaGVtYSIsImNvbnN0cnVjdE5vZGVQYXRoIiwibm9kZSIsInBhdGgiLCJ1bnNoaWZ0IiwicGFyZW50IiwicmV0cmlldmVXZWlnaHROYW1lIiwibm9kZU5hbWUiLCJ3ZWlnaHRJbmRleCIsImNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzIiwiZW50aXR5UGF0aCIsIm1vcnBoVGFyZ2V0Q291bnQiLCJrZXlmcmFtZUNvdW50IiwibW9ycGhUYXJnZXRPdXRwdXQiLCJtb3JwaEN1cnZlIiwiY29tcG9uZW50IiwicHJvcGVydHlQYXRoIiwiY2hhbm5lbHMiLCJjaGFubmVsIiwic3RhcnRzV2l0aCIsImlucHV0cyIsIm91dHB1dHMiLCJjdXJ2ZXMiLCJpbnB1dEtleSIsIm91dHB1dEtleSIsImN1cnZlS2V5IiwiY3VydmVEYXRhIiwiQW5pbUN1cnZlIiwicHJldkluZGV4IiwiZCIsImRwIiwiZHVyYXRpb24iLCJfZGF0YSIsIkFuaW1UcmFjayIsImNyZWF0ZU5vZGUiLCJnbHRmTm9kZSIsIm5vZGVJbmRleCIsImVudGl0eSIsIkdyYXBoTm9kZSIsIm1hdHJpeCIsImdldFRyYW5zbGF0aW9uIiwic2V0TG9jYWxQb3NpdGlvbiIsImdldEV1bGVyQW5nbGVzIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsImdldFNjYWxlIiwic2V0TG9jYWxTY2FsZSIsInIiLCJzZXRMb2NhbFJvdGF0aW9uIiwidCIsInRyYW5zbGF0aW9uIiwicyIsImNyZWF0ZUNhbWVyYSIsImdsdGZDYW1lcmEiLCJwcm9qZWN0aW9uIiwiUFJPSkVDVElPTl9PUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiZ2x0ZlByb3BlcnRpZXMiLCJvcnRob2dyYXBoaWMiLCJwZXJzcGVjdGl2ZSIsImNvbXBvbmVudERhdGEiLCJlbmFibGVkIiwibmVhckNsaXAiLCJ6bmVhciIsImFzcGVjdFJhdGlvTW9kZSIsIkFTUEVDVF9BVVRPIiwiemZhciIsImZhckNsaXAiLCJvcnRob0hlaWdodCIsInltYWciLCJBU1BFQ1RfTUFOVUFMIiwiYXNwZWN0UmF0aW8iLCJ4bWFnIiwiZm92IiwieWZvdiIsImNhbWVyYUVudGl0eSIsIkVudGl0eSIsImFkZENvbXBvbmVudCIsImNyZWF0ZUxpZ2h0IiwiZ2x0ZkxpZ2h0IiwibGlnaHRQcm9wcyIsIkNvbG9yIiwiV0hJVEUiLCJyYW5nZSIsImZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVEIiwiaW50ZW5zaXR5IiwiY2xhbXAiLCJpbm5lckNvbmVBbmdsZSIsInNwb3QiLCJvdXRlckNvbmVBbmdsZSIsIlBJIiwibHVtaW5hbmNlIiwiTGlnaHQiLCJnZXRMaWdodFVuaXRDb252ZXJzaW9uIiwibGlnaHRUeXBlcyIsImxpZ2h0RW50aXR5Iiwicm90YXRlTG9jYWwiLCJjcmVhdGVTa2lucyIsIk1hcCIsImNyZWF0ZU1lc2hlcyIsImNyZWF0ZU1hdGVyaWFscyIsInByZXByb2Nlc3MiLCJwcm9jZXNzIiwicG9zdHByb2Nlc3MiLCJjcmVhdGVWYXJpYW50cyIsImNyZWF0ZUFuaW1hdGlvbnMiLCJhbmltYXRpb24iLCJjcmVhdGVOb2RlcyIsInVuaXF1ZU5hbWVzIiwiY2hpbGRyZW4iLCJjaGlsZCIsImFkZENoaWxkIiwiY3JlYXRlU2NlbmVzIiwic2NlbmUiLCJzY2VuZVJvb3QiLCJuIiwiY2hpbGROb2RlIiwiY3JlYXRlQ2FtZXJhcyIsImNhbWVyYSIsImNyZWF0ZUxpZ2h0cyIsIktIUl9saWdodHNfcHVuY3R1YWwiLCJnbHRmTGlnaHRzIiwibGlnaHQiLCJsaWdodEluZGV4IiwibGlua1NraW5zIiwibWVzaEdyb3VwIiwiY3JlYXRlUmVzb3VyY2VzIiwidGV4dHVyZUFzc2V0cyIsImdsb2JhbCIsImFzc2V0IiwiZ2VuZXJhdG9yIiwidGV4dHVyZUFzc2V0IiwiUmVuZGVyIiwiYXBwbHlTYW1wbGVyIiwiZ2x0ZlNhbXBsZXIiLCJnZXRGaWx0ZXIiLCJmaWx0ZXIiLCJkZWZhdWx0VmFsdWUiLCJGSUxURVJfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVIiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiZ2V0V3JhcCIsIndyYXAiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJBRERSRVNTX01JUlJPUkVEX1JFUEVBVCIsIkFERFJFU1NfUkVQRUFUIiwibWluRmlsdGVyIiwibWFnRmlsdGVyIiwiYWRkcmVzc1UiLCJ3cmFwUyIsImFkZHJlc3NWIiwid3JhcFQiLCJnbHRmVGV4dHVyZVVuaXF1ZUlkIiwibG9hZEltYWdlQXN5bmMiLCJnbHRmSW1hZ2UiLCJ1cmxCYXNlIiwiaW1hZ2UiLCJwcm9jZXNzQXN5bmMiLCJvbkxvYWQiLCJtaW1lVHlwZUZpbGVFeHRlbnNpb25zIiwibG9hZFRleHR1cmUiLCJ1cmwiLCJtaW1lVHlwZSIsImNvbnRlbnRzIiwiZXh0ZW5zaW9uIiwiZmlsZW5hbWUiLCJvbiIsImxvYWQiLCJlcnIiLCJjcm9zc09yaWdpbiIsImxvYWRUZXh0dXJlc0FzeW5jIiwiaW1hZ2VzIiwiZ2x0ZlRleHR1cmUiLCJnbHRmSW1hZ2VzIiwiYXNzZXRzIiwicmVtYWluaW5nIiwidGV4dHVyZUluZGV4IiwiaW1hZ2VJbmRleCIsInRleHR1cmVMaXN0IiwiZ2x0ZkltYWdlSW5kZXgiLCJLSFJfdGV4dHVyZV9iYXNpc3UiLCJiaW5kIiwibG9hZEJ1ZmZlcnNBc3luYyIsImJpbmFyeUNodW5rIiwiYnVmZmVycyIsImdsdGZCdWZmZXIiLCJhcnJheUJ1ZmZlciIsImJ5dGVTdHJpbmciLCJhdG9iIiwic3BsaXQiLCJiaW5hcnlBcnJheSIsImNoYXJDb2RlQXQiLCJodHRwIiwiY2FjaGUiLCJyZXNwb25zZVR5cGUiLCJyZXRyeSIsInBhcnNlR2x0ZiIsImdsdGZDaHVuayIsImRlY29kZUJpbmFyeVV0ZjgiLCJhcnJheSIsIlRleHREZWNvZGVyIiwiZGVjb2RlIiwic3RyIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiZGVjb2RlVVJJQ29tcG9uZW50IiwiZXNjYXBlIiwiSlNPTiIsInBhcnNlIiwidmVyc2lvbiIsInBhcnNlRmxvYXQiLCJleHRlbnNpb25zUmVxdWlyZWQiLCJXYXNtTW9kdWxlIiwiZ2V0SW5zdGFuY2UiLCJpbnN0YW5jZSIsInBhcnNlR2xiIiwiZ2xiRGF0YSIsIkRhdGFWaWV3IiwiYnl0ZUxlbmd0aCIsIm1hZ2ljIiwiZ2V0VWludDMyIiwiY2h1bmtMZW5ndGgiLCJFcnJvciIsImNodW5rVHlwZSIsImNodW5rRGF0YSIsInBhcnNlQ2h1bmsiLCJoYXNHbGJIZWFkZXIiLCJ1OCIsInRvTG93ZXJDYXNlIiwiZW5kc1dpdGgiLCJwYXJzZUJ1ZmZlclZpZXdzQXN5bmMiLCJnbHRmQnVmZmVyVmlldyIsIkdsYlBhcnNlciIsInBhcnNlQXN5bmMiLCJlcnJvciIsInJlc3VsdF8iLCJtYXhSZXRyaWVzIiwiX2RldmljZSIsIl9hc3NldHMiLCJfZGVmYXVsdE1hdGVyaWFsIiwiX2dldFVybFdpdGhvdXRQYXJhbXMiLCJmZXRjaEFycmF5QnVmZmVyIiwib3JpZ2luYWwiLCJleHRyYWN0UGF0aCIsIkdsYkNvbnRhaW5lclJlc291cmNlIiwib3BlbiIsInBhdGNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTZEQSxJQUFJQSxvQkFBb0IsR0FBRyxJQUFJLENBQUE7QUFFL0IsTUFBTUMsMkJBQTJCLEdBQUcsTUFBTTtBQUN0QyxFQUFBLE9BQU8sT0FBT0MsTUFBTSxLQUFLLFdBQVcsSUFBSUEsTUFBTSxDQUFDQyxrQkFBa0IsQ0FBQTtBQUNyRSxDQUFDLENBQUE7O0FBR0QsTUFBTUMsWUFBWSxDQUFDO0VBQ2ZDLFdBQVcsQ0FBQ0MsSUFBSSxFQUFFO0lBQ2QsSUFBSSxDQUFDQSxJQUFJLEdBQUdBLElBQUksQ0FBQTtJQUNoQixJQUFJLENBQUNDLEtBQUssR0FBRyxJQUFJLENBQUE7SUFDakIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsSUFBSSxDQUFBO0lBQ2xCLElBQUksQ0FBQ0MsVUFBVSxHQUFHLElBQUksQ0FBQTtJQUN0QixJQUFJLENBQUNDLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxTQUFTLEdBQUcsSUFBSSxDQUFBO0lBQ3JCLElBQUksQ0FBQ0MsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNwQixJQUFJLENBQUNDLFlBQVksR0FBRyxJQUFJLENBQUE7SUFDeEIsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxJQUFJLENBQUE7SUFDaEMsSUFBSSxDQUFDQyxPQUFPLEdBQUcsSUFBSSxDQUFBO0lBQ25CLElBQUksQ0FBQ0MsS0FBSyxHQUFHLElBQUksQ0FBQTtJQUNqQixJQUFJLENBQUNDLE1BQU0sR0FBRyxJQUFJLENBQUE7SUFDbEIsSUFBSSxDQUFDQyxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCLEdBQUE7QUFFQUMsRUFBQUEsT0FBTyxHQUFHO0lBRU4sSUFBSSxJQUFJLENBQUNKLE9BQU8sRUFBRTtBQUNkLE1BQUEsSUFBSSxDQUFDQSxPQUFPLENBQUNLLE9BQU8sQ0FBRUMsTUFBTSxJQUFLO1FBQzdCQSxNQUFNLENBQUNDLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFDeEIsT0FBQyxDQUFDLENBQUE7QUFDTixLQUFBO0FBQ0osR0FBQTtBQUNKLENBQUE7QUFFQSxNQUFNQyxTQUFTLEdBQUcsU0FBWkEsU0FBUyxDQUFhQyxHQUFHLEVBQUU7QUFDN0IsRUFBQSxPQUFPLGVBQWUsQ0FBQ0MsSUFBSSxDQUFDRCxHQUFHLENBQUMsQ0FBQTtBQUNwQyxDQUFDLENBQUE7QUFFRCxNQUFNRSxrQkFBa0IsR0FBRyxTQUFyQkEsa0JBQWtCLENBQWFGLEdBQUcsRUFBRTtBQUN0QyxFQUFBLE9BQU9BLEdBQUcsQ0FBQ0csU0FBUyxDQUFDSCxHQUFHLENBQUNJLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUVKLEdBQUcsQ0FBQ0ksT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDaEUsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsZ0JBQWdCLEdBQUcsU0FBbkJBLGdCQUFnQixDQUFhQyxZQUFZLEVBQUU7QUFDN0MsRUFBQSxRQUFRQSxZQUFZO0FBQ2hCLElBQUEsS0FBSyxRQUFRO0FBQUUsTUFBQSxPQUFPLENBQUMsQ0FBQTtBQUN2QixJQUFBLEtBQUssTUFBTTtBQUFFLE1BQUEsT0FBTyxDQUFDLENBQUE7QUFDckIsSUFBQSxLQUFLLE1BQU07QUFBRSxNQUFBLE9BQU8sQ0FBQyxDQUFBO0FBQ3JCLElBQUEsS0FBSyxNQUFNO0FBQUUsTUFBQSxPQUFPLENBQUMsQ0FBQTtBQUNyQixJQUFBLEtBQUssTUFBTTtBQUFFLE1BQUEsT0FBTyxDQUFDLENBQUE7QUFDckIsSUFBQSxLQUFLLE1BQU07QUFBRSxNQUFBLE9BQU8sQ0FBQyxDQUFBO0FBQ3JCLElBQUEsS0FBSyxNQUFNO0FBQUUsTUFBQSxPQUFPLEVBQUUsQ0FBQTtBQUN0QixJQUFBO0FBQVMsTUFBQSxPQUFPLENBQUMsQ0FBQTtBQUFDLEdBQUE7QUFFMUIsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsZ0JBQWdCLEdBQUcsU0FBbkJBLGdCQUFnQixDQUFhQyxhQUFhLEVBQUU7QUFDOUMsRUFBQSxRQUFRQSxhQUFhO0FBQ2pCLElBQUEsS0FBSyxJQUFJO0FBQUUsTUFBQSxPQUFPQyxTQUFTLENBQUE7QUFDM0IsSUFBQSxLQUFLLElBQUk7QUFBRSxNQUFBLE9BQU9DLFVBQVUsQ0FBQTtBQUM1QixJQUFBLEtBQUssSUFBSTtBQUFFLE1BQUEsT0FBT0MsVUFBVSxDQUFBO0FBQzVCLElBQUEsS0FBSyxJQUFJO0FBQUUsTUFBQSxPQUFPQyxXQUFXLENBQUE7QUFDN0IsSUFBQSxLQUFLLElBQUk7QUFBRSxNQUFBLE9BQU9DLFVBQVUsQ0FBQTtBQUM1QixJQUFBLEtBQUssSUFBSTtBQUFFLE1BQUEsT0FBT0MsV0FBVyxDQUFBO0FBQzdCLElBQUEsS0FBSyxJQUFJO0FBQUUsTUFBQSxPQUFPQyxZQUFZLENBQUE7QUFDOUIsSUFBQTtBQUFTLE1BQUEsT0FBTyxDQUFDLENBQUE7QUFBQyxHQUFBO0FBRTFCLENBQUMsQ0FBQTtBQUVELE1BQU1DLHVCQUF1QixHQUFHLFNBQTFCQSx1QkFBdUIsQ0FBYVIsYUFBYSxFQUFFO0FBQ3JELEVBQUEsUUFBUUEsYUFBYTtBQUNqQixJQUFBLEtBQUssSUFBSTtBQUFFLE1BQUEsT0FBTyxDQUFDLENBQUE7QUFDbkIsSUFBQSxLQUFLLElBQUk7QUFBRSxNQUFBLE9BQU8sQ0FBQyxDQUFBO0FBQ25CLElBQUEsS0FBSyxJQUFJO0FBQUUsTUFBQSxPQUFPLENBQUMsQ0FBQTtBQUNuQixJQUFBLEtBQUssSUFBSTtBQUFFLE1BQUEsT0FBTyxDQUFDLENBQUE7QUFDbkIsSUFBQSxLQUFLLElBQUk7QUFBRSxNQUFBLE9BQU8sQ0FBQyxDQUFBO0FBQ25CLElBQUEsS0FBSyxJQUFJO0FBQUUsTUFBQSxPQUFPLENBQUMsQ0FBQTtBQUNuQixJQUFBLEtBQUssSUFBSTtBQUFFLE1BQUEsT0FBTyxDQUFDLENBQUE7QUFDbkIsSUFBQTtBQUFTLE1BQUEsT0FBTyxDQUFDLENBQUE7QUFBQyxHQUFBO0FBRTFCLENBQUMsQ0FBQTtBQUVELE1BQU1TLG9CQUFvQixHQUFHLFNBQXZCQSxvQkFBb0IsQ0FBYVQsYUFBYSxFQUFFO0FBQ2xELEVBQUEsUUFBUUEsYUFBYTtBQUNqQixJQUFBLEtBQUssSUFBSTtBQUFFLE1BQUEsT0FBT1UsU0FBUyxDQUFBO0FBQzNCLElBQUEsS0FBSyxJQUFJO0FBQUUsTUFBQSxPQUFPQyxVQUFVLENBQUE7QUFDNUIsSUFBQSxLQUFLLElBQUk7QUFBRSxNQUFBLE9BQU9DLFVBQVUsQ0FBQTtBQUM1QixJQUFBLEtBQUssSUFBSTtBQUFFLE1BQUEsT0FBT0MsV0FBVyxDQUFBO0FBQzdCLElBQUEsS0FBSyxJQUFJO0FBQUUsTUFBQSxPQUFPQyxVQUFVLENBQUE7QUFDNUIsSUFBQSxLQUFLLElBQUk7QUFBRSxNQUFBLE9BQU9DLFdBQVcsQ0FBQTtBQUM3QixJQUFBLEtBQUssSUFBSTtBQUFFLE1BQUEsT0FBT0MsWUFBWSxDQUFBO0FBQzlCLElBQUE7QUFBUyxNQUFBLE9BQU8sSUFBSSxDQUFBO0FBQUMsR0FBQTtBQUU3QixDQUFDLENBQUE7QUFFRCxNQUFNQyx1QkFBdUIsR0FBRztBQUM1QixFQUFBLFVBQVUsRUFBRUMsaUJBQWlCO0FBQzdCLEVBQUEsUUFBUSxFQUFFQyxlQUFlO0FBQ3pCLEVBQUEsU0FBUyxFQUFFQyxnQkFBZ0I7QUFDM0IsRUFBQSxTQUFTLEVBQUVDLGNBQWM7QUFDekIsRUFBQSxVQUFVLEVBQUVDLHFCQUFxQjtBQUNqQyxFQUFBLFdBQVcsRUFBRUMsb0JBQW9CO0FBQ2pDLEVBQUEsWUFBWSxFQUFFQyxrQkFBa0I7QUFDaEMsRUFBQSxZQUFZLEVBQUVDLGtCQUFrQjtBQUNoQyxFQUFBLFlBQVksRUFBRUMsa0JBQWtCO0FBQ2hDLEVBQUEsWUFBWSxFQUFFQyxrQkFBa0I7QUFDaEMsRUFBQSxZQUFZLEVBQUVDLGtCQUFrQjtBQUNoQyxFQUFBLFlBQVksRUFBRUMsa0JBQWtCO0FBQ2hDLEVBQUEsWUFBWSxFQUFFQyxrQkFBa0I7QUFDaEMsRUFBQSxZQUFZLEVBQUVDLGtCQUFBQTtBQUNsQixDQUFDLENBQUE7O0FBR0QsTUFBTUMsaUJBQWlCLEdBQUlDLE9BQU8sSUFBSztBQUVuQyxFQUFBLFFBQVFBLE9BQU87QUFDWCxJQUFBLEtBQUtoQyxTQUFTO0FBQUUsTUFBQSxPQUFPaUMsQ0FBQyxJQUFJQyxJQUFJLENBQUNDLEdBQUcsQ0FBQ0YsQ0FBQyxHQUFHLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ3JELElBQUEsS0FBS2hDLFVBQVU7QUFBRSxNQUFBLE9BQU9nQyxDQUFDLElBQUlBLENBQUMsR0FBRyxLQUFLLENBQUE7QUFDdEMsSUFBQSxLQUFLL0IsVUFBVTtBQUFFLE1BQUEsT0FBTytCLENBQUMsSUFBSUMsSUFBSSxDQUFDQyxHQUFHLENBQUNGLENBQUMsR0FBRyxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUN4RCxJQUFBLEtBQUs5QixXQUFXO0FBQUUsTUFBQSxPQUFPOEIsQ0FBQyxJQUFJQSxDQUFDLEdBQUcsT0FBTyxDQUFBO0FBQ3pDLElBQUE7TUFBUyxPQUFPQSxDQUFDLElBQUlBLENBQUMsQ0FBQTtBQUFDLEdBQUE7QUFFL0IsQ0FBQyxDQUFBOztBQUdELE1BQU1HLGVBQWUsR0FBRyxTQUFsQkEsZUFBZSxDQUFhQyxRQUFRLEVBQUVDLFFBQVEsRUFBRU4sT0FBTyxFQUFFO0FBQzNELEVBQUEsTUFBTU8sUUFBUSxHQUFHUixpQkFBaUIsQ0FBQ0MsT0FBTyxDQUFDLENBQUE7QUFDM0MsRUFBQSxNQUFNUSxHQUFHLEdBQUdGLFFBQVEsQ0FBQ0csTUFBTSxDQUFBO0VBQzNCLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRixHQUFHLEVBQUUsRUFBRUUsQ0FBQyxFQUFFO0lBQzFCTCxRQUFRLENBQUNLLENBQUMsQ0FBQyxHQUFHSCxRQUFRLENBQUNELFFBQVEsQ0FBQ0ksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN2QyxHQUFBO0FBQ0EsRUFBQSxPQUFPTCxRQUFRLENBQUE7QUFDbkIsQ0FBQyxDQUFBOztBQUdELE1BQU1NLGVBQWUsR0FBRyxTQUFsQkEsZUFBZSxDQUFhQyxZQUFZLEVBQUVDLFdBQVcsRUFBRUMsT0FBTyxHQUFHLEtBQUssRUFBRTtBQUMxRSxFQUFBLE1BQU1DLGFBQWEsR0FBR25ELGdCQUFnQixDQUFDZ0QsWUFBWSxDQUFDSSxJQUFJLENBQUMsQ0FBQTtBQUN6RCxFQUFBLE1BQU1DLFFBQVEsR0FBR3pDLG9CQUFvQixDQUFDb0MsWUFBWSxDQUFDN0MsYUFBYSxDQUFDLENBQUE7RUFDakUsSUFBSSxDQUFDa0QsUUFBUSxFQUFFO0FBQ1gsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7QUFFQSxFQUFBLE1BQU1DLFVBQVUsR0FBR0wsV0FBVyxDQUFDRCxZQUFZLENBQUNNLFVBQVUsQ0FBQyxDQUFBO0FBQ3ZELEVBQUEsSUFBSUMsTUFBTSxDQUFBO0VBRVYsSUFBSVAsWUFBWSxDQUFDUSxNQUFNLEVBQUU7QUFFckIsSUFBQSxNQUFNQSxNQUFNLEdBQUdSLFlBQVksQ0FBQ1EsTUFBTSxDQUFBOztBQUdsQyxJQUFBLE1BQU1DLGVBQWUsR0FBRztNQUNwQkMsS0FBSyxFQUFFRixNQUFNLENBQUNFLEtBQUs7QUFDbkJOLE1BQUFBLElBQUksRUFBRSxRQUFBO0tBQ1QsQ0FBQTtBQUNELElBQUEsTUFBTU8sT0FBTyxHQUFHWixlQUFlLENBQUNhLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDSixlQUFlLEVBQUVELE1BQU0sQ0FBQ0csT0FBTyxDQUFDLEVBQUVWLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQTs7QUFHbEcsSUFBQSxNQUFNYSxjQUFjLEdBQUc7TUFDbkJKLEtBQUssRUFBRUYsTUFBTSxDQUFDRSxLQUFLO01BQ25CTixJQUFJLEVBQUVKLFlBQVksQ0FBQ2UsTUFBTTtNQUN6QjVELGFBQWEsRUFBRTZDLFlBQVksQ0FBQzdDLGFBQUFBO0tBQy9CLENBQUE7QUFDRCxJQUFBLE1BQU02RCxNQUFNLEdBQUdqQixlQUFlLENBQUNhLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDQyxjQUFjLEVBQUVOLE1BQU0sQ0FBQ1EsTUFBTSxDQUFDLEVBQUVmLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQTs7QUFHL0YsSUFBQSxJQUFJRCxZQUFZLENBQUNpQixjQUFjLENBQUMsWUFBWSxDQUFDLEVBQUU7QUFDM0MsTUFBQSxNQUFNQyxZQUFZLEdBQUc7UUFDakJaLFVBQVUsRUFBRU4sWUFBWSxDQUFDTSxVQUFVO1FBQ25DYSxVQUFVLEVBQUVuQixZQUFZLENBQUNtQixVQUFVO1FBQ25DaEUsYUFBYSxFQUFFNkMsWUFBWSxDQUFDN0MsYUFBYTtRQUN6Q3VELEtBQUssRUFBRVYsWUFBWSxDQUFDVSxLQUFLO1FBQ3pCTixJQUFJLEVBQUVKLFlBQVksQ0FBQ0ksSUFBQUE7T0FDdEIsQ0FBQTtNQUVERyxNQUFNLEdBQUdSLGVBQWUsQ0FBQ21CLFlBQVksRUFBRWpCLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQ21CLEtBQUssRUFBRSxDQUFBO0FBQ3JFLEtBQUMsTUFBTTtNQUVIYixNQUFNLEdBQUcsSUFBSUYsUUFBUSxDQUFDTCxZQUFZLENBQUNVLEtBQUssR0FBR1AsYUFBYSxDQUFDLENBQUE7QUFDN0QsS0FBQTtBQUVBLElBQUEsS0FBSyxJQUFJTCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdVLE1BQU0sQ0FBQ0UsS0FBSyxFQUFFLEVBQUVaLENBQUMsRUFBRTtBQUNuQyxNQUFBLE1BQU11QixXQUFXLEdBQUdWLE9BQU8sQ0FBQ2IsQ0FBQyxDQUFDLENBQUE7TUFDOUIsS0FBSyxJQUFJd0IsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHbkIsYUFBYSxFQUFFLEVBQUVtQixDQUFDLEVBQUU7QUFDcENmLFFBQUFBLE1BQU0sQ0FBQ2MsV0FBVyxHQUFHbEIsYUFBYSxHQUFHbUIsQ0FBQyxDQUFDLEdBQUdOLE1BQU0sQ0FBQ2xCLENBQUMsR0FBR0ssYUFBYSxHQUFHbUIsQ0FBQyxDQUFDLENBQUE7QUFDM0UsT0FBQTtBQUNKLEtBQUE7R0FDSCxNQUFNLElBQUlwQixPQUFPLElBQUlJLFVBQVUsQ0FBQ1csY0FBYyxDQUFDLFlBQVksQ0FBQyxFQUFFO0FBRTNELElBQUEsTUFBTU0sZUFBZSxHQUFHcEIsYUFBYSxHQUFHRSxRQUFRLENBQUNtQixpQkFBaUIsQ0FBQTtJQUNsRSxNQUFNQyxPQUFPLEdBQUcsSUFBSUMsV0FBVyxDQUFDMUIsWUFBWSxDQUFDVSxLQUFLLEdBQUdhLGVBQWUsQ0FBQyxDQUFBO0FBQ3JFLElBQUEsTUFBTUksUUFBUSxHQUFHLElBQUk3RCxVQUFVLENBQUMyRCxPQUFPLENBQUMsQ0FBQTtJQUV4QyxJQUFJRyxTQUFTLEdBQUcsQ0FBQyxDQUFBO0FBQ2pCLElBQUEsS0FBSyxJQUFJOUIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRSxZQUFZLENBQUNVLEtBQUssRUFBRSxFQUFFWixDQUFDLEVBQUU7QUFFekMsTUFBQSxJQUFJK0IsU0FBUyxHQUFHLENBQUM3QixZQUFZLENBQUNtQixVQUFVLElBQUksQ0FBQyxJQUFJckIsQ0FBQyxHQUFHUSxVQUFVLENBQUN3QixVQUFVLENBQUE7TUFDMUUsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdSLGVBQWUsRUFBRSxFQUFFUSxDQUFDLEVBQUU7UUFDdENKLFFBQVEsQ0FBQ0MsU0FBUyxFQUFFLENBQUMsR0FBR3RCLFVBQVUsQ0FBQ3VCLFNBQVMsRUFBRSxDQUFDLENBQUE7QUFDbkQsT0FBQTtBQUNKLEtBQUE7QUFFQXRCLElBQUFBLE1BQU0sR0FBRyxJQUFJRixRQUFRLENBQUNvQixPQUFPLENBQUMsQ0FBQTtBQUNsQyxHQUFDLE1BQU07SUFDSGxCLE1BQU0sR0FBRyxJQUFJRixRQUFRLENBQUNDLFVBQVUsQ0FBQzBCLE1BQU0sRUFDakIxQixVQUFVLENBQUNhLFVBQVUsSUFBSW5CLFlBQVksQ0FBQ21CLFVBQVUsSUFBSSxDQUFDLENBQUMsRUFDdERuQixZQUFZLENBQUNVLEtBQUssR0FBR1AsYUFBYSxDQUFDLENBQUE7QUFDN0QsR0FBQTtBQUVBLEVBQUEsT0FBT0ksTUFBTSxDQUFBO0FBQ2pCLENBQUMsQ0FBQTs7QUFHRCxNQUFNMEIsc0JBQXNCLEdBQUcsU0FBekJBLHNCQUFzQixDQUFhakMsWUFBWSxFQUFFQyxXQUFXLEVBQUU7RUFDaEUsTUFBTWlDLElBQUksR0FBR25DLGVBQWUsQ0FBQ0MsWUFBWSxFQUFFQyxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUE7RUFDN0QsSUFBSWlDLElBQUksWUFBWS9ELFlBQVksSUFBSSxDQUFDNkIsWUFBWSxDQUFDbUMsVUFBVSxFQUFFO0FBSzFELElBQUEsT0FBT0QsSUFBSSxDQUFBO0FBQ2YsR0FBQTtFQUVBLE1BQU1FLFdBQVcsR0FBRyxJQUFJakUsWUFBWSxDQUFDK0QsSUFBSSxDQUFDckMsTUFBTSxDQUFDLENBQUE7RUFDakRMLGVBQWUsQ0FBQzRDLFdBQVcsRUFBRUYsSUFBSSxFQUFFaEYsZ0JBQWdCLENBQUM4QyxZQUFZLENBQUM3QyxhQUFhLENBQUMsQ0FBQyxDQUFBO0FBQ2hGLEVBQUEsT0FBT2lGLFdBQVcsQ0FBQTtBQUN0QixDQUFDLENBQUE7O0FBR0QsTUFBTUMsc0JBQXNCLEdBQUcsU0FBekJBLHNCQUFzQixDQUFhckMsWUFBWSxFQUFFO0FBQ25ELEVBQUEsSUFBSXNDLEdBQUcsR0FBR3RDLFlBQVksQ0FBQ3NDLEdBQUcsQ0FBQTtBQUMxQixFQUFBLElBQUkvQyxHQUFHLEdBQUdTLFlBQVksQ0FBQ1QsR0FBRyxDQUFBO0FBQzFCLEVBQUEsSUFBSSxDQUFDK0MsR0FBRyxJQUFJLENBQUMvQyxHQUFHLEVBQUU7QUFDZCxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTtFQUVBLElBQUlTLFlBQVksQ0FBQ21DLFVBQVUsRUFBRTtBQUN6QixJQUFBLE1BQU1JLEtBQUssR0FBR3JGLGdCQUFnQixDQUFDOEMsWUFBWSxDQUFDN0MsYUFBYSxDQUFDLENBQUE7SUFDMURtRixHQUFHLEdBQUc5QyxlQUFlLENBQUMsRUFBRSxFQUFFOEMsR0FBRyxFQUFFQyxLQUFLLENBQUMsQ0FBQTtJQUNyQ2hELEdBQUcsR0FBR0MsZUFBZSxDQUFDLEVBQUUsRUFBRUQsR0FBRyxFQUFFZ0QsS0FBSyxDQUFDLENBQUE7QUFDekMsR0FBQTtBQUVBLEVBQUEsT0FBTyxJQUFJQyxXQUFXLENBQ2xCLElBQUlDLElBQUksQ0FBQyxDQUFDbEQsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHK0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDL0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHK0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDL0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHK0MsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUNuRixJQUFJRyxJQUFJLENBQUMsQ0FBQ2xELEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRytDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQy9DLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRytDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQy9DLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRytDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FDdEYsQ0FBQTtBQUNMLENBQUMsQ0FBQTtBQUVELE1BQU1JLGdCQUFnQixHQUFHLFNBQW5CQSxnQkFBZ0IsQ0FBYUMsU0FBUyxFQUFFO0FBQzFDLEVBQUEsSUFBSSxDQUFDQSxTQUFTLENBQUMxQixjQUFjLENBQUMsTUFBTSxDQUFDLEVBQUU7QUFDbkMsSUFBQSxPQUFPMkIsbUJBQW1CLENBQUE7QUFDOUIsR0FBQTtFQUVBLFFBQVFELFNBQVMsQ0FBQ0UsSUFBSTtBQUNsQixJQUFBLEtBQUssQ0FBQztBQUFFLE1BQUEsT0FBT0MsZ0JBQWdCLENBQUE7QUFDL0IsSUFBQSxLQUFLLENBQUM7QUFBRSxNQUFBLE9BQU9DLGVBQWUsQ0FBQTtBQUM5QixJQUFBLEtBQUssQ0FBQztBQUFFLE1BQUEsT0FBT0Msa0JBQWtCLENBQUE7QUFDakMsSUFBQSxLQUFLLENBQUM7QUFBRSxNQUFBLE9BQU9DLG1CQUFtQixDQUFBO0FBQ2xDLElBQUEsS0FBSyxDQUFDO0FBQUUsTUFBQSxPQUFPTCxtQkFBbUIsQ0FBQTtBQUNsQyxJQUFBLEtBQUssQ0FBQztBQUFFLE1BQUEsT0FBT00sa0JBQWtCLENBQUE7QUFDakMsSUFBQSxLQUFLLENBQUM7QUFBRSxNQUFBLE9BQU9DLGdCQUFnQixDQUFBO0FBQy9CLElBQUE7QUFBUyxNQUFBLE9BQU9QLG1CQUFtQixDQUFBO0FBQUMsR0FBQTtBQUU1QyxDQUFDLENBQUE7QUFFRCxNQUFNUSxlQUFlLEdBQUcsU0FBbEJBLGVBQWUsQ0FBYUMsV0FBVyxFQUFFO0FBQzNDLEVBQUEsTUFBTUMsWUFBWSxHQUFHLElBQUl0RixXQUFXLENBQUNxRixXQUFXLENBQUMsQ0FBQTtFQUNqRCxLQUFLLElBQUl2RCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd1RCxXQUFXLEVBQUV2RCxDQUFDLEVBQUUsRUFBRTtBQUNsQ3dELElBQUFBLFlBQVksQ0FBQ3hELENBQUMsQ0FBQyxHQUFHQSxDQUFDLENBQUE7QUFDdkIsR0FBQTtBQUNBLEVBQUEsT0FBT3dELFlBQVksQ0FBQTtBQUN2QixDQUFDLENBQUE7QUFFRCxNQUFNQyxlQUFlLEdBQUcsU0FBbEJBLGVBQWUsQ0FBYUMsVUFBVSxFQUFFN0MsT0FBTyxFQUFFO0FBRW5ELEVBQUEsTUFBTThDLENBQUMsR0FBR0QsVUFBVSxDQUFDbkYsaUJBQWlCLENBQUMsQ0FBQTtFQUN2QyxJQUFJLENBQUNvRixDQUFDLElBQUlBLENBQUMsQ0FBQ0MsVUFBVSxLQUFLLENBQUMsRUFBRTtBQUMxQixJQUFBLE9BQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJQyxTQUFTLENBQUE7QUFDYixFQUFBLElBQUlGLENBQUMsQ0FBQ0csSUFBSSxLQUFLSCxDQUFDLENBQUNJLE1BQU0sRUFBRTtJQUVyQixNQUFNQyxTQUFTLEdBQUdMLENBQUMsQ0FBQ0ksTUFBTSxHQUFHRSx1QkFBdUIsQ0FBQ04sQ0FBQyxDQUFDckQsSUFBSSxDQUFDLENBQUE7SUFDNUQsTUFBTTRELEdBQUcsR0FBRyxJQUFJQyxlQUFlLENBQUNSLENBQUMsQ0FBQ3JELElBQUksQ0FBQyxDQUFDcUQsQ0FBQyxDQUFDekIsTUFBTSxFQUFFeUIsQ0FBQyxDQUFDUyxNQUFNLEVBQUVULENBQUMsQ0FBQy9DLEtBQUssR0FBR29ELFNBQVMsQ0FBQyxDQUFBO0FBQ2hGSCxJQUFBQSxTQUFTLEdBQUcsSUFBSU0sZUFBZSxDQUFDUixDQUFDLENBQUNyRCxJQUFJLENBQUMsQ0FBQ3FELENBQUMsQ0FBQy9DLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUNwRCxJQUFBLEtBQUssSUFBSVosQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHMkQsQ0FBQyxDQUFDL0MsS0FBSyxFQUFFLEVBQUVaLENBQUMsRUFBRTtBQUM5QjZELE1BQUFBLFNBQVMsQ0FBQzdELENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdrRSxHQUFHLENBQUNsRSxDQUFDLEdBQUdnRSxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDN0NILE1BQUFBLFNBQVMsQ0FBQzdELENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdrRSxHQUFHLENBQUNsRSxDQUFDLEdBQUdnRSxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDN0NILE1BQUFBLFNBQVMsQ0FBQzdELENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdrRSxHQUFHLENBQUNsRSxDQUFDLEdBQUdnRSxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDakQsS0FBQTtBQUNKLEdBQUMsTUFBTTtJQUVISCxTQUFTLEdBQUcsSUFBSU0sZUFBZSxDQUFDUixDQUFDLENBQUNyRCxJQUFJLENBQUMsQ0FBQ3FELENBQUMsQ0FBQ3pCLE1BQU0sRUFBRXlCLENBQUMsQ0FBQ1MsTUFBTSxFQUFFVCxDQUFDLENBQUMvQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDNUUsR0FBQTtBQUVBLEVBQUEsTUFBTTJDLFdBQVcsR0FBR0ksQ0FBQyxDQUFDL0MsS0FBSyxDQUFBOztFQUczQixJQUFJLENBQUNDLE9BQU8sRUFBRTtBQUNWQSxJQUFBQSxPQUFPLEdBQUd5QyxlQUFlLENBQUNDLFdBQVcsQ0FBQyxDQUFBO0FBQzFDLEdBQUE7O0FBR0EsRUFBQSxNQUFNYyxXQUFXLEdBQUdDLGdCQUFnQixDQUFDVCxTQUFTLEVBQUVoRCxPQUFPLENBQUMsQ0FBQTtFQUN4RCxNQUFNMEQsT0FBTyxHQUFHLElBQUlsRyxZQUFZLENBQUNnRyxXQUFXLENBQUN0RSxNQUFNLENBQUMsQ0FBQTtBQUNwRHdFLEVBQUFBLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDSCxXQUFXLENBQUMsQ0FBQTtFQUV4QlgsVUFBVSxDQUFDbEYsZUFBZSxDQUFDLEdBQUc7SUFDMUIwRCxNQUFNLEVBQUVxQyxPQUFPLENBQUNyQyxNQUFNO0FBQ3RCNEIsSUFBQUEsSUFBSSxFQUFFLEVBQUU7QUFDUk0sSUFBQUEsTUFBTSxFQUFFLENBQUM7QUFDVEwsSUFBQUEsTUFBTSxFQUFFLEVBQUU7QUFDVm5ELElBQUFBLEtBQUssRUFBRTJDLFdBQVc7QUFDbEJLLElBQUFBLFVBQVUsRUFBRSxDQUFDO0FBQ2J0RCxJQUFBQSxJQUFJLEVBQUUxQyxZQUFBQTtHQUNULENBQUE7QUFDTCxDQUFDLENBQUE7QUFFRCxNQUFNNkcsY0FBYyxHQUFHLFNBQWpCQSxjQUFjLENBQWFDLFlBQVksRUFBRTtFQUMzQyxJQUFJMUUsQ0FBQyxFQUFFd0IsQ0FBQyxDQUFBO0VBRVIsTUFBTW1ELFlBQVksR0FBRyxFQUFFLENBQUE7RUFDdkIsTUFBTUMsWUFBWSxHQUFHLEVBQUUsQ0FBQTtFQUN2QixNQUFNQyxXQUFXLEdBQUcsRUFBRSxDQUFBO0FBQ3RCLEVBQUEsS0FBSzdFLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzBFLFlBQVksQ0FBQ0ksTUFBTSxDQUFDQyxRQUFRLENBQUNoRixNQUFNLEVBQUUsRUFBRUMsQ0FBQyxFQUFFO0lBQ3RELE1BQU1nRixPQUFPLEdBQUdOLFlBQVksQ0FBQ0ksTUFBTSxDQUFDQyxRQUFRLENBQUMvRSxDQUFDLENBQUMsQ0FBQTtJQUMvQyxJQUFJZ0YsT0FBTyxDQUFDQyxJQUFJLEtBQUtwRyxrQkFBa0IsSUFDbkNtRyxPQUFPLENBQUNDLElBQUksS0FBS25HLGtCQUFrQixFQUFFO01BQ3JDLFFBQVFrRyxPQUFPLENBQUN6RSxRQUFRO0FBQ3BCLFFBQUEsS0FBSzNDLFlBQVk7VUFDYitHLFlBQVksQ0FBQ08sSUFBSSxDQUFDO0FBQUVkLFlBQUFBLE1BQU0sRUFBRVksT0FBTyxDQUFDWixNQUFNLEdBQUcsQ0FBQyxHQUFHLENBQUM7QUFBRUwsWUFBQUEsTUFBTSxFQUFFaUIsT0FBTyxDQUFDakIsTUFBTSxHQUFHLENBQUE7QUFBRSxXQUFDLENBQUMsQ0FBQTtBQUNqRixVQUFBLE1BQUE7QUFDSixRQUFBLEtBQUt0RyxXQUFXO1VBQ1ptSCxZQUFZLENBQUNNLElBQUksQ0FBQztBQUFFZCxZQUFBQSxNQUFNLEVBQUVZLE9BQU8sQ0FBQ1osTUFBTSxHQUFHLENBQUMsR0FBRyxDQUFDO0FBQUVMLFlBQUFBLE1BQU0sRUFBRWlCLE9BQU8sQ0FBQ2pCLE1BQU0sR0FBRyxDQUFBO0FBQUUsV0FBQyxDQUFDLENBQUE7QUFDakYsVUFBQSxNQUFBO0FBQ0osUUFBQSxLQUFLeEcsVUFBVTtVQUNYc0gsV0FBVyxDQUFDSyxJQUFJLENBQUM7QUFBRWQsWUFBQUEsTUFBTSxFQUFFWSxPQUFPLENBQUNaLE1BQU0sR0FBRyxDQUFDO1lBQUVMLE1BQU0sRUFBRWlCLE9BQU8sQ0FBQ2pCLE1BQUFBO0FBQU8sV0FBQyxDQUFDLENBQUE7QUFDeEUsVUFBQSxNQUFBO0FBQU0sT0FBQTtBQUVsQixLQUFBO0FBQ0osR0FBQTtFQUVBLE1BQU1vQixJQUFJLEdBQUcsU0FBUEEsSUFBSSxDQUFhQyxPQUFPLEVBQUU5RSxJQUFJLEVBQUUrRSxHQUFHLEVBQUU7SUFDdkMsTUFBTUMsVUFBVSxHQUFHLElBQUloRixJQUFJLENBQUNvRSxZQUFZLENBQUMvQyxPQUFPLENBQUMsQ0FBQTtBQUNqRCxJQUFBLEtBQUszQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdvRixPQUFPLENBQUNyRixNQUFNLEVBQUUsRUFBRUMsQ0FBQyxFQUFFO0FBQ2pDLE1BQUEsSUFBSXVGLEtBQUssR0FBR0gsT0FBTyxDQUFDcEYsQ0FBQyxDQUFDLENBQUNvRSxNQUFNLENBQUE7QUFDN0IsTUFBQSxNQUFNTCxNQUFNLEdBQUdxQixPQUFPLENBQUNwRixDQUFDLENBQUMsQ0FBQytELE1BQU0sQ0FBQTtBQUNoQyxNQUFBLEtBQUt2QyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdrRCxZQUFZLENBQUNuQixXQUFXLEVBQUUsRUFBRS9CLENBQUMsRUFBRTtRQUMzQzhELFVBQVUsQ0FBQ0MsS0FBSyxDQUFDLEdBQUdGLEdBQUcsR0FBR0MsVUFBVSxDQUFDQyxLQUFLLENBQUMsQ0FBQTtBQUMzQ0EsUUFBQUEsS0FBSyxJQUFJeEIsTUFBTSxDQUFBO0FBQ25CLE9BQUE7QUFDSixLQUFBO0dBQ0gsQ0FBQTtBQUVELEVBQUEsSUFBSVksWUFBWSxDQUFDNUUsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUN6Qm9GLElBQUFBLElBQUksQ0FBQ1IsWUFBWSxFQUFFdEcsWUFBWSxFQUFFLEdBQUcsQ0FBQyxDQUFBO0FBQ3pDLEdBQUE7QUFDQSxFQUFBLElBQUl1RyxZQUFZLENBQUM3RSxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBQ3pCb0YsSUFBQUEsSUFBSSxDQUFDUCxZQUFZLEVBQUUxRyxXQUFXLEVBQUUsS0FBSyxDQUFDLENBQUE7QUFDMUMsR0FBQTtBQUNBLEVBQUEsSUFBSTJHLFdBQVcsQ0FBQzlFLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDeEJvRixJQUFBQSxJQUFJLENBQUNOLFdBQVcsRUFBRTdHLFVBQVUsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUN0QyxHQUFBO0FBQ0osQ0FBQyxDQUFBOztBQUlELE1BQU13SCxZQUFZLEdBQUcsU0FBZkEsWUFBWSxDQUFhQyxPQUFPLEVBQUU7QUFDcEMsRUFBQSxNQUFNQyxpQkFBaUIsR0FBRyxTQUFwQkEsaUJBQWlCLENBQWFELE9BQU8sRUFBRTtJQUN6QyxNQUFNaEYsTUFBTSxHQUFHLEVBQUUsQ0FBQTtBQUNqQixJQUFBLEtBQUssSUFBSWtGLEdBQUcsR0FBRyxDQUFDLEVBQUVBLEdBQUcsR0FBR0YsT0FBTyxDQUFDRyxPQUFPLENBQUM3RixNQUFNLEVBQUUsRUFBRTRGLEdBQUcsRUFBRTtNQUNuRCxJQUFJRSxLQUFLLEdBQUcsRUFBRSxDQUFBO01BQ2QsSUFBSUosT0FBTyxDQUFDSyxPQUFPLEVBQUU7UUFDakIsS0FBSyxJQUFJQyxJQUFJLEdBQUcsQ0FBQyxFQUFFQSxJQUFJLEdBQUcsQ0FBQyxFQUFFLEVBQUVBLElBQUksRUFBRTtBQUNqQ0YsVUFBQUEsS0FBSyxDQUFDWCxJQUFJLENBQUNPLE9BQU8sQ0FBQ0csT0FBTyxDQUFDRCxHQUFHLENBQUMsQ0FBQ0ksSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUMxQyxTQUFBO0FBQ0osT0FBQyxNQUFNO0FBQ0hGLFFBQUFBLEtBQUssR0FBR0osT0FBTyxDQUFDRyxPQUFPLENBQUNELEdBQUcsQ0FBQyxDQUFBO0FBQ2hDLE9BQUE7QUFDQWxGLE1BQUFBLE1BQU0sQ0FBQ3lFLElBQUksQ0FBQ1csS0FBSyxDQUFDLENBQUE7QUFDdEIsS0FBQTtBQUNBLElBQUEsT0FBT3BGLE1BQU0sQ0FBQTtHQUNoQixDQUFBO0VBRUQsTUFBTUEsTUFBTSxHQUFHLElBQUl1RixPQUFPLENBQUNQLE9BQU8sQ0FBQ1EsTUFBTSxFQUFFUixPQUFPLENBQUMsQ0FBQTtBQUNuRGhGLEVBQUFBLE1BQU0sQ0FBQ21GLE9BQU8sR0FBR0YsaUJBQWlCLENBQUNELE9BQU8sQ0FBQyxDQUFBO0FBQzNDLEVBQUEsT0FBT2hGLE1BQU0sQ0FBQTtBQUNqQixDQUFDLENBQUE7O0FBR0QsTUFBTXlGLGlCQUFpQixHQUFHLFNBQXBCQSxpQkFBaUIsQ0FBYWhDLEdBQUcsRUFBRTtFQUNyQyxNQUFNekQsTUFBTSxHQUFHLElBQUkwRixLQUFLLENBQUNqQyxHQUFHLENBQUNlLElBQUksR0FBRyxRQUFRLEVBQ25CZixHQUFHLENBQUM1RCxJQUFJLEVBQ1I0RCxHQUFHLENBQUNrQyxJQUFJLEVBQ1JsQyxHQUFHLENBQUM5QixJQUFJLEVBQ1I4QixHQUFHLENBQUNtQyxPQUFPLENBQUMsQ0FBQTtFQUNyQzVGLE1BQU0sQ0FBQzZGLE1BQU0sR0FBRyxJQUFJLENBQUE7RUFDcEI3RixNQUFNLENBQUM4RixRQUFRLEdBQUdmLFlBQVksQ0FBQ3RCLEdBQUcsQ0FBQ3FDLFFBQVEsQ0FBQyxDQUFBO0FBQzVDckMsRUFBQUEsR0FBRyxDQUFDc0MsUUFBUSxDQUFDQyxHQUFHLENBQUNoRyxNQUFNLENBQUMsQ0FBQTtBQUN4QixFQUFBLE9BQU9BLE1BQU0sQ0FBQTtBQUNqQixDQUFDLENBQUE7QUFFRCxNQUFNaUcsMEJBQTBCLEdBQUcsU0FBN0JBLDBCQUEwQixDQUFhVCxNQUFNLEVBQUV2QyxVQUFVLEVBQUVpRCxLQUFLLEVBQUU7QUFDcEUsRUFBQSxNQUFNQyxZQUFZLEdBQUdsRCxVQUFVLENBQUNuRixpQkFBaUIsQ0FBQyxDQUFBO0VBQ2xELElBQUksQ0FBQ3FJLFlBQVksRUFBRTtBQUVmLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBO0FBQ0EsRUFBQSxNQUFNckQsV0FBVyxHQUFHcUQsWUFBWSxDQUFDaEcsS0FBSyxDQUFBOztFQUd0QyxNQUFNaUcsVUFBVSxHQUFHLEVBQUUsQ0FBQTtBQUNyQixFQUFBLEtBQUssTUFBTUMsUUFBUSxJQUFJcEQsVUFBVSxFQUFFO0FBQy9CLElBQUEsSUFBSUEsVUFBVSxDQUFDdkMsY0FBYyxDQUFDMkYsUUFBUSxDQUFDLEVBQUU7TUFDckNELFVBQVUsQ0FBQzNCLElBQUksQ0FBQztBQUNaNEIsUUFBQUEsUUFBUSxFQUFFQSxRQUFRO0FBQ2xCbEQsUUFBQUEsVUFBVSxFQUFFRixVQUFVLENBQUNvRCxRQUFRLENBQUMsQ0FBQ2xELFVBQVU7QUFDM0N0RCxRQUFBQSxJQUFJLEVBQUVvRCxVQUFVLENBQUNvRCxRQUFRLENBQUMsQ0FBQ3hHLElBQUk7QUFDL0J5RyxRQUFBQSxTQUFTLEVBQUUsQ0FBQyxDQUFDckQsVUFBVSxDQUFDb0QsUUFBUSxDQUFDLENBQUNDLFNBQUFBO0FBQ3RDLE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQTtBQUNKLEdBQUE7O0FBR0EsRUFBQSxNQUFNQyxZQUFZLEdBQUcsQ0FDakJ6SSxpQkFBaUIsRUFDakJDLGVBQWUsRUFDZkMsZ0JBQWdCLEVBQ2hCQyxjQUFjLEVBQ2RDLHFCQUFxQixFQUNyQkMsb0JBQW9CLEVBQ3BCQyxrQkFBa0IsRUFDbEJDLGtCQUFrQixDQUNyQixDQUFBOztBQUdEK0gsRUFBQUEsVUFBVSxDQUFDSSxJQUFJLENBQUMsVUFBVUMsR0FBRyxFQUFFQyxHQUFHLEVBQUU7SUFDaEMsTUFBTUMsUUFBUSxHQUFHSixZQUFZLENBQUMvSixPQUFPLENBQUNpSyxHQUFHLENBQUNKLFFBQVEsQ0FBQyxDQUFBO0lBQ25ELE1BQU1PLFFBQVEsR0FBR0wsWUFBWSxDQUFDL0osT0FBTyxDQUFDa0ssR0FBRyxDQUFDTCxRQUFRLENBQUMsQ0FBQTtBQUNuRCxJQUFBLE9BQVFNLFFBQVEsR0FBR0MsUUFBUSxHQUFJLENBQUMsQ0FBQyxHQUFJQSxRQUFRLEdBQUdELFFBQVEsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFBO0FBQ3JFLEdBQUMsQ0FBQyxDQUFBO0FBRUYsRUFBQSxJQUFJcEgsQ0FBQyxFQUFFd0IsQ0FBQyxFQUFFOEYsQ0FBQyxDQUFBO0FBQ1gsRUFBQSxJQUFJQyxNQUFNLEVBQUVDLE1BQU0sRUFBRUMsWUFBWSxDQUFBO0VBRWhDLE1BQU1DLFlBQVksR0FBRyxJQUFJQyxZQUFZLENBQUMxQixNQUFNLEVBQUVZLFVBQVUsQ0FBQyxDQUFBOztFQUd6RCxJQUFJZSxzQkFBc0IsR0FBRyxJQUFJLENBQUE7QUFDakMsRUFBQSxLQUFLNUgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHMEgsWUFBWSxDQUFDM0MsUUFBUSxDQUFDaEYsTUFBTSxFQUFFLEVBQUVDLENBQUMsRUFBRTtBQUMvQ3dILElBQUFBLE1BQU0sR0FBR0UsWUFBWSxDQUFDM0MsUUFBUSxDQUFDL0UsQ0FBQyxDQUFDLENBQUE7QUFDakN1SCxJQUFBQSxNQUFNLEdBQUc3RCxVQUFVLENBQUM4RCxNQUFNLENBQUN2QyxJQUFJLENBQUMsQ0FBQTtBQUNoQ3dDLElBQUFBLFlBQVksR0FBR0YsTUFBTSxDQUFDbkQsTUFBTSxHQUFHd0MsWUFBWSxDQUFDeEMsTUFBTSxDQUFBO0FBQ2xELElBQUEsSUFBS21ELE1BQU0sQ0FBQ3JGLE1BQU0sS0FBSzBFLFlBQVksQ0FBQzFFLE1BQU0sSUFDckNxRixNQUFNLENBQUN4RCxNQUFNLEtBQUt5RCxNQUFNLENBQUN6RCxNQUFPLElBQ2hDd0QsTUFBTSxDQUFDekQsSUFBSSxLQUFLMEQsTUFBTSxDQUFDMUQsSUFBSyxJQUM1QjJELFlBQVksS0FBS0QsTUFBTSxDQUFDcEQsTUFBTyxFQUFFO0FBQ2xDd0QsTUFBQUEsc0JBQXNCLEdBQUcsS0FBSyxDQUFBO0FBQzlCLE1BQUEsTUFBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUdBLEVBQUEsTUFBTWxELFlBQVksR0FBRyxJQUFJbUQsWUFBWSxDQUFDNUIsTUFBTSxFQUNOeUIsWUFBWSxFQUNabkUsV0FBVyxFQUNYdUUsYUFBYSxDQUFDLENBQUE7QUFFcEQsRUFBQSxNQUFNQyxVQUFVLEdBQUdyRCxZQUFZLENBQUNzRCxJQUFJLEVBQUUsQ0FBQTtBQUN0QyxFQUFBLE1BQU1DLFdBQVcsR0FBRyxJQUFJN0osV0FBVyxDQUFDMkosVUFBVSxDQUFDLENBQUE7QUFDL0MsRUFBQSxJQUFJRyxXQUFXLENBQUE7QUFFZixFQUFBLElBQUlOLHNCQUFzQixFQUFFO0lBRXhCTSxXQUFXLEdBQUcsSUFBSTlKLFdBQVcsQ0FBQ3dJLFlBQVksQ0FBQzFFLE1BQU0sRUFDbkIwRSxZQUFZLENBQUN4QyxNQUFNLEVBQ25CYixXQUFXLEdBQUdtQixZQUFZLENBQUNJLE1BQU0sQ0FBQ2hCLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUN6RW1FLElBQUFBLFdBQVcsQ0FBQ3pELEdBQUcsQ0FBQzBELFdBQVcsQ0FBQyxDQUFBO0FBQ2hDLEdBQUMsTUFBTTtJQUNILElBQUlDLFlBQVksRUFBRUMsWUFBWSxDQUFBO0FBRTlCLElBQUEsS0FBS3BJLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzBFLFlBQVksQ0FBQ0ksTUFBTSxDQUFDQyxRQUFRLENBQUNoRixNQUFNLEVBQUUsRUFBRUMsQ0FBQyxFQUFFO01BQ3REd0gsTUFBTSxHQUFHOUMsWUFBWSxDQUFDSSxNQUFNLENBQUNDLFFBQVEsQ0FBQy9FLENBQUMsQ0FBQyxDQUFBO0FBQ3hDbUksTUFBQUEsWUFBWSxHQUFHWCxNQUFNLENBQUN6RCxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBRWhDd0QsTUFBQUEsTUFBTSxHQUFHN0QsVUFBVSxDQUFDOEQsTUFBTSxDQUFDdkMsSUFBSSxDQUFDLENBQUE7QUFDaENtRCxNQUFBQSxZQUFZLEdBQUdiLE1BQU0sQ0FBQ3hELE1BQU0sR0FBRyxDQUFDLENBQUE7QUFHaENtRSxNQUFBQSxXQUFXLEdBQUcsSUFBSTlKLFdBQVcsQ0FBQ21KLE1BQU0sQ0FBQ3JGLE1BQU0sRUFBRXFGLE1BQU0sQ0FBQ25ELE1BQU0sRUFBRSxDQUFDbUQsTUFBTSxDQUFDM0csS0FBSyxHQUFHLENBQUMsSUFBSXdILFlBQVksR0FBRyxDQUFDYixNQUFNLENBQUN6RCxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO01BRXRILElBQUlJLEdBQUcsR0FBRyxDQUFDLENBQUE7QUFDWCxNQUFBLElBQUltRSxHQUFHLEdBQUdiLE1BQU0sQ0FBQ3BELE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDM0IsTUFBQSxNQUFNa0UsSUFBSSxHQUFHOUksSUFBSSxDQUFDK0ksS0FBSyxDQUFDLENBQUNoQixNQUFNLENBQUN6RCxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO01BQzlDLEtBQUt0QyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcrQixXQUFXLEVBQUUsRUFBRS9CLENBQUMsRUFBRTtRQUM5QixLQUFLOEYsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHZ0IsSUFBSSxFQUFFLEVBQUVoQixDQUFDLEVBQUU7VUFDdkJXLFdBQVcsQ0FBQ0ksR0FBRyxHQUFHZixDQUFDLENBQUMsR0FBR1ksV0FBVyxDQUFDaEUsR0FBRyxHQUFHb0QsQ0FBQyxDQUFDLENBQUE7QUFDL0MsU0FBQTtBQUNBcEQsUUFBQUEsR0FBRyxJQUFJa0UsWUFBWSxDQUFBO0FBQ25CQyxRQUFBQSxHQUFHLElBQUlGLFlBQVksQ0FBQTtBQUN2QixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUl4QixLQUFLLEVBQUU7SUFDUGxDLGNBQWMsQ0FBQ0MsWUFBWSxDQUFDLENBQUE7QUFDaEMsR0FBQTtFQUVBQSxZQUFZLENBQUM4RCxNQUFNLEVBQUUsQ0FBQTtBQUVyQixFQUFBLE9BQU85RCxZQUFZLENBQUE7QUFDdkIsQ0FBQyxDQUFBO0FBRUQsTUFBTStELGtCQUFrQixHQUFHLFNBQXJCQSxrQkFBa0IsQ0FBYXhDLE1BQU0sRUFBRXlDLFVBQVUsRUFBRTdILE9BQU8sRUFBRThILFNBQVMsRUFBRXhJLFdBQVcsRUFBRXdHLEtBQUssRUFBRWlDLGdCQUFnQixFQUFFO0VBRy9HLE1BQU1DLGFBQWEsR0FBRyxFQUFFLENBQUE7RUFDeEIsTUFBTUMsU0FBUyxHQUFHLEVBQUUsQ0FBQTtBQUVwQixFQUFBLEtBQUssTUFBTUMsTUFBTSxJQUFJTCxVQUFVLEVBQUU7QUFDN0IsSUFBQSxJQUFJQSxVQUFVLENBQUN2SCxjQUFjLENBQUM0SCxNQUFNLENBQUMsSUFBSXpLLHVCQUF1QixDQUFDNkMsY0FBYyxDQUFDNEgsTUFBTSxDQUFDLEVBQUU7QUFDckZGLE1BQUFBLGFBQWEsQ0FBQ0UsTUFBTSxDQUFDLEdBQUdMLFVBQVUsQ0FBQ0ssTUFBTSxDQUFDLENBQUE7O01BRzFDRCxTQUFTLENBQUM1RCxJQUFJLENBQUM2RCxNQUFNLEdBQUcsR0FBRyxHQUFHTCxVQUFVLENBQUNLLE1BQU0sQ0FBQyxDQUFDLENBQUE7QUFDckQsS0FBQTtBQUNKLEdBQUE7O0VBR0FELFNBQVMsQ0FBQzdCLElBQUksRUFBRSxDQUFBO0FBQ2hCLEVBQUEsTUFBTStCLEtBQUssR0FBR0YsU0FBUyxDQUFDRyxJQUFJLEVBQUUsQ0FBQTs7QUFHOUIsRUFBQSxJQUFJQyxFQUFFLEdBQUdOLGdCQUFnQixDQUFDSSxLQUFLLENBQUMsQ0FBQTtFQUNoQyxJQUFJLENBQUNFLEVBQUUsRUFBRTtJQUVMLE1BQU14RixVQUFVLEdBQUcsRUFBRSxDQUFBO0FBQ3JCLElBQUEsS0FBSyxNQUFNcUYsTUFBTSxJQUFJRixhQUFhLEVBQUU7TUFDaEMsTUFBTU0sUUFBUSxHQUFHUixTQUFTLENBQUNELFVBQVUsQ0FBQ0ssTUFBTSxDQUFDLENBQUMsQ0FBQTtBQUM5QyxNQUFBLE1BQU1LLFlBQVksR0FBR25KLGVBQWUsQ0FBQ2tKLFFBQVEsRUFBRWhKLFdBQVcsQ0FBQyxDQUFBO0FBQzNELE1BQUEsTUFBTUssVUFBVSxHQUFHTCxXQUFXLENBQUNnSixRQUFRLENBQUMzSSxVQUFVLENBQUMsQ0FBQTtBQUNuRCxNQUFBLE1BQU1zRyxRQUFRLEdBQUd4SSx1QkFBdUIsQ0FBQ3lLLE1BQU0sQ0FBQyxDQUFBO0FBQ2hELE1BQUEsTUFBTWpGLElBQUksR0FBRzVHLGdCQUFnQixDQUFDaU0sUUFBUSxDQUFDN0ksSUFBSSxDQUFDLEdBQUd6Qyx1QkFBdUIsQ0FBQ3NMLFFBQVEsQ0FBQzlMLGFBQWEsQ0FBQyxDQUFBO0FBQzlGLE1BQUEsTUFBTTBHLE1BQU0sR0FBR3ZELFVBQVUsQ0FBQ1csY0FBYyxDQUFDLFlBQVksQ0FBQyxHQUFHWCxVQUFVLENBQUN3QixVQUFVLEdBQUc4QixJQUFJLENBQUE7TUFDckZKLFVBQVUsQ0FBQ29ELFFBQVEsQ0FBQyxHQUFHO1FBQ25CNUUsTUFBTSxFQUFFa0gsWUFBWSxDQUFDbEgsTUFBTTtBQUMzQjRCLFFBQUFBLElBQUksRUFBRUEsSUFBSTtRQUNWTSxNQUFNLEVBQUVnRixZQUFZLENBQUMvSCxVQUFVO0FBQy9CMEMsUUFBQUEsTUFBTSxFQUFFQSxNQUFNO1FBQ2RuRCxLQUFLLEVBQUV1SSxRQUFRLENBQUN2SSxLQUFLO0FBQ3JCZ0QsUUFBQUEsVUFBVSxFQUFFMUcsZ0JBQWdCLENBQUNpTSxRQUFRLENBQUM3SSxJQUFJLENBQUM7QUFDM0NBLFFBQUFBLElBQUksRUFBRWxELGdCQUFnQixDQUFDK0wsUUFBUSxDQUFDOUwsYUFBYSxDQUFDO1FBQzlDMEosU0FBUyxFQUFFb0MsUUFBUSxDQUFDOUcsVUFBQUE7T0FDdkIsQ0FBQTtBQUNMLEtBQUE7O0FBR0EsSUFBQSxJQUFJLENBQUNxQixVQUFVLENBQUN2QyxjQUFjLENBQUMzQyxlQUFlLENBQUMsRUFBRTtBQUM3Q2lGLE1BQUFBLGVBQWUsQ0FBQ0MsVUFBVSxFQUFFN0MsT0FBTyxDQUFDLENBQUE7QUFDeEMsS0FBQTs7SUFHQXFJLEVBQUUsR0FBR3hDLDBCQUEwQixDQUFDVCxNQUFNLEVBQUV2QyxVQUFVLEVBQUVpRCxLQUFLLENBQUMsQ0FBQTtBQUMxRGlDLElBQUFBLGdCQUFnQixDQUFDSSxLQUFLLENBQUMsR0FBR0UsRUFBRSxDQUFBO0FBQ2hDLEdBQUE7QUFFQSxFQUFBLE9BQU9BLEVBQUUsQ0FBQTtBQUNiLENBQUMsQ0FBQTtBQUVELE1BQU1HLHVCQUF1QixHQUFHLFNBQTFCQSx1QkFBdUIsQ0FBYXBELE1BQU0sRUFBRXFELGNBQWMsRUFBRUMsUUFBUSxFQUFFQyxPQUFPLEVBQUVDLGFBQWEsRUFBRTVJLE9BQU8sRUFBRThGLEtBQUssRUFBRTtBQUVoSCxFQUFBLE1BQU0rQyxTQUFTLEdBQUdKLGNBQWMsQ0FBQ0ssVUFBVSxFQUFFLENBQUE7O0VBRzdDLE1BQU1DLHlCQUF5QixHQUFHLFNBQTVCQSx5QkFBeUIsQ0FBYUMsUUFBUSxFQUFFL0MsUUFBUSxFQUFFO0lBQzVELE1BQU1nRCxTQUFTLEdBQUdOLE9BQU8sQ0FBQ08sc0JBQXNCLENBQUNULGNBQWMsRUFBRU8sUUFBUSxDQUFDLENBQUE7QUFDMUUsSUFBQSxNQUFNRyxTQUFTLEdBQUdOLFNBQVMsR0FBR0ksU0FBUyxDQUFDRyxjQUFjLEVBQUUsQ0FBQTtBQUN4RCxJQUFBLE1BQU1DLFdBQVcsR0FBR0osU0FBUyxDQUFDSyxTQUFTLEVBQUUsQ0FBQTtBQUN6QyxJQUFBLElBQUlDLEdBQUcsRUFBRWxKLE1BQU0sRUFBRW1KLG9CQUFvQixFQUFFQyxXQUFXLENBQUE7O0FBR2xELElBQUEsUUFBUUosV0FBVztNQUVmLEtBQUtULGFBQWEsQ0FBQ2MsUUFBUTtBQUN2QkQsUUFBQUEsV0FBVyxHQUFHL00sVUFBVSxDQUFBO0FBQ3hCOE0sUUFBQUEsb0JBQW9CLEdBQUcsQ0FBQyxDQUFBO1FBQ3hCRCxHQUFHLEdBQUdYLGFBQWEsQ0FBQ2UsT0FBTyxDQUFDUixTQUFTLEdBQUdLLG9CQUFvQixDQUFDLENBQUE7QUFDN0RiLFFBQUFBLE9BQU8sQ0FBQ2lCLGlDQUFpQyxDQUFDbkIsY0FBYyxFQUFFUSxTQUFTLEVBQUVMLGFBQWEsQ0FBQ2MsUUFBUSxFQUFFUCxTQUFTLEdBQUdLLG9CQUFvQixFQUFFRCxHQUFHLENBQUMsQ0FBQTtBQUNuSWxKLFFBQUFBLE1BQU0sR0FBRyxJQUFJbEQsVUFBVSxDQUFDeUwsYUFBYSxDQUFDaUIsTUFBTSxDQUFDeEksTUFBTSxFQUFFa0ksR0FBRyxFQUFFSixTQUFTLENBQUMsQ0FBQzFJLEtBQUssRUFBRSxDQUFBO0FBQzVFLFFBQUEsTUFBQTtNQUVKLEtBQUttSSxhQUFhLENBQUNrQixTQUFTO0FBQ3hCTCxRQUFBQSxXQUFXLEdBQUc3TSxXQUFXLENBQUE7QUFDekI0TSxRQUFBQSxvQkFBb0IsR0FBRyxDQUFDLENBQUE7UUFDeEJELEdBQUcsR0FBR1gsYUFBYSxDQUFDZSxPQUFPLENBQUNSLFNBQVMsR0FBR0ssb0JBQW9CLENBQUMsQ0FBQTtBQUM3RGIsUUFBQUEsT0FBTyxDQUFDaUIsaUNBQWlDLENBQUNuQixjQUFjLEVBQUVRLFNBQVMsRUFBRUwsYUFBYSxDQUFDa0IsU0FBUyxFQUFFWCxTQUFTLEdBQUdLLG9CQUFvQixFQUFFRCxHQUFHLENBQUMsQ0FBQTtBQUNwSWxKLFFBQUFBLE1BQU0sR0FBRyxJQUFJaEQsV0FBVyxDQUFDdUwsYUFBYSxDQUFDbUIsT0FBTyxDQUFDMUksTUFBTSxFQUFFa0ksR0FBRyxFQUFFSixTQUFTLENBQUMsQ0FBQzFJLEtBQUssRUFBRSxDQUFBO0FBQzlFLFFBQUEsTUFBQTtNQUVKLEtBQUttSSxhQUFhLENBQUNvQixVQUFVLENBQUE7QUFDN0IsTUFBQTtBQUNJUCxRQUFBQSxXQUFXLEdBQUcxTSxZQUFZLENBQUE7QUFDMUJ5TSxRQUFBQSxvQkFBb0IsR0FBRyxDQUFDLENBQUE7UUFDeEJELEdBQUcsR0FBR1gsYUFBYSxDQUFDZSxPQUFPLENBQUNSLFNBQVMsR0FBR0ssb0JBQW9CLENBQUMsQ0FBQTtBQUM3RGIsUUFBQUEsT0FBTyxDQUFDaUIsaUNBQWlDLENBQUNuQixjQUFjLEVBQUVRLFNBQVMsRUFBRUwsYUFBYSxDQUFDb0IsVUFBVSxFQUFFYixTQUFTLEdBQUdLLG9CQUFvQixFQUFFRCxHQUFHLENBQUMsQ0FBQTtBQUNySWxKLFFBQUFBLE1BQU0sR0FBRyxJQUFJN0MsWUFBWSxDQUFDb0wsYUFBYSxDQUFDcUIsT0FBTyxDQUFDNUksTUFBTSxFQUFFa0ksR0FBRyxFQUFFSixTQUFTLENBQUMsQ0FBQzFJLEtBQUssRUFBRSxDQUFBO0FBQy9FLFFBQUEsTUFBQTtBQUFNLEtBQUE7QUFHZG1JLElBQUFBLGFBQWEsQ0FBQ3NCLEtBQUssQ0FBQ1gsR0FBRyxDQUFDLENBQUE7SUFFeEIsT0FBTztBQUNIbEosTUFBQUEsTUFBTSxFQUFFQSxNQUFNO0FBQ2RiLE1BQUFBLGFBQWEsRUFBRXlKLFNBQVMsQ0FBQ0csY0FBYyxFQUFFO0FBQ3pDSSxNQUFBQSxvQkFBb0IsRUFBRUEsb0JBQW9CO0FBQzFDQyxNQUFBQSxXQUFXLEVBQUVBLFdBQVc7QUFHeEJqSSxNQUFBQSxVQUFVLEVBQUd5RSxRQUFRLEtBQUtwSSxjQUFjLElBQUk0TCxXQUFXLEtBQUsvTSxVQUFVLEdBQUksSUFBSSxHQUFHdU0sU0FBUyxDQUFDekgsVUFBVSxFQUFBO0tBQ3hHLENBQUE7R0FDSixDQUFBOztFQUdELE1BQU1xQixVQUFVLEdBQUcsRUFBRSxDQUFBO0FBQ3JCLEVBQUEsTUFBTWdGLFVBQVUsR0FBR2EsUUFBUSxDQUFDYixVQUFVLENBQUE7QUFDdEMsRUFBQSxLQUFLLE1BQU1LLE1BQU0sSUFBSUwsVUFBVSxFQUFFO0FBQzdCLElBQUEsSUFBSUEsVUFBVSxDQUFDdkgsY0FBYyxDQUFDNEgsTUFBTSxDQUFDLElBQUl6Syx1QkFBdUIsQ0FBQzZDLGNBQWMsQ0FBQzRILE1BQU0sQ0FBQyxFQUFFO0FBQ3JGLE1BQUEsTUFBTWpDLFFBQVEsR0FBR3hJLHVCQUF1QixDQUFDeUssTUFBTSxDQUFDLENBQUE7TUFDaEQsTUFBTWlDLGFBQWEsR0FBR3BCLHlCQUF5QixDQUFDbEIsVUFBVSxDQUFDSyxNQUFNLENBQUMsRUFBRWpDLFFBQVEsQ0FBQyxDQUFBOztNQUc3RSxNQUFNaEQsSUFBSSxHQUFHa0gsYUFBYSxDQUFDM0ssYUFBYSxHQUFHMkssYUFBYSxDQUFDWCxvQkFBb0IsQ0FBQTtNQUM3RTNHLFVBQVUsQ0FBQ29ELFFBQVEsQ0FBQyxHQUFHO1FBQ25CNUYsTUFBTSxFQUFFOEosYUFBYSxDQUFDOUosTUFBTTtBQUM1QmdCLFFBQUFBLE1BQU0sRUFBRThJLGFBQWEsQ0FBQzlKLE1BQU0sQ0FBQ2dCLE1BQU07QUFDbkM0QixRQUFBQSxJQUFJLEVBQUVBLElBQUk7QUFDVk0sUUFBQUEsTUFBTSxFQUFFLENBQUM7QUFDVEwsUUFBQUEsTUFBTSxFQUFFRCxJQUFJO0FBQ1psRCxRQUFBQSxLQUFLLEVBQUU4SSxTQUFTO1FBQ2hCOUYsVUFBVSxFQUFFb0gsYUFBYSxDQUFDM0ssYUFBYTtRQUN2Q0MsSUFBSSxFQUFFMEssYUFBYSxDQUFDVixXQUFXO1FBQy9CdkQsU0FBUyxFQUFFaUUsYUFBYSxDQUFDM0ksVUFBQUE7T0FDNUIsQ0FBQTtBQUNMLEtBQUE7QUFDSixHQUFBOztBQUdBLEVBQUEsSUFBSSxDQUFDcUIsVUFBVSxDQUFDdkMsY0FBYyxDQUFDM0MsZUFBZSxDQUFDLEVBQUU7QUFDN0NpRixJQUFBQSxlQUFlLENBQUNDLFVBQVUsRUFBRTdDLE9BQU8sQ0FBQyxDQUFBO0FBQ3hDLEdBQUE7QUFFQSxFQUFBLE9BQU82RiwwQkFBMEIsQ0FBQ1QsTUFBTSxFQUFFdkMsVUFBVSxFQUFFaUQsS0FBSyxDQUFDLENBQUE7QUFDaEUsQ0FBQyxDQUFBO0FBRUQsTUFBTXNFLFVBQVUsR0FBRyxTQUFiQSxVQUFVLENBQWFoRixNQUFNLEVBQUVpRixRQUFRLEVBQUV2QyxTQUFTLEVBQUV4SSxXQUFXLEVBQUV2RSxLQUFLLEVBQUV1UCxRQUFRLEVBQUU7QUFDcEYsRUFBQSxJQUFJbkwsQ0FBQyxFQUFFd0IsQ0FBQyxFQUFFNEosVUFBVSxDQUFBO0FBQ3BCLEVBQUEsTUFBTUMsTUFBTSxHQUFHSCxRQUFRLENBQUNHLE1BQU0sQ0FBQTtBQUM5QixFQUFBLE1BQU1DLFNBQVMsR0FBR0QsTUFBTSxDQUFDdEwsTUFBTSxDQUFBO0VBQy9CLE1BQU13TCxHQUFHLEdBQUcsRUFBRSxDQUFBO0FBQ2QsRUFBQSxJQUFJTCxRQUFRLENBQUMvSixjQUFjLENBQUMscUJBQXFCLENBQUMsRUFBRTtBQUNoRCxJQUFBLE1BQU1xSyxtQkFBbUIsR0FBR04sUUFBUSxDQUFDTSxtQkFBbUIsQ0FBQTtBQUN4RCxJQUFBLE1BQU1DLE9BQU8sR0FBR3hMLGVBQWUsQ0FBQzBJLFNBQVMsQ0FBQzZDLG1CQUFtQixDQUFDLEVBQUVyTCxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDbEYsTUFBTXVMLFNBQVMsR0FBRyxFQUFFLENBQUE7SUFFcEIsS0FBSzFMLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3NMLFNBQVMsRUFBRXRMLENBQUMsRUFBRSxFQUFFO01BQzVCLEtBQUt3QixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsRUFBRSxFQUFFQSxDQUFDLEVBQUUsRUFBRTtRQUNyQmtLLFNBQVMsQ0FBQ2xLLENBQUMsQ0FBQyxHQUFHaUssT0FBTyxDQUFDekwsQ0FBQyxHQUFHLEVBQUUsR0FBR3dCLENBQUMsQ0FBQyxDQUFBO0FBQ3RDLE9BQUE7TUFDQTRKLFVBQVUsR0FBRyxJQUFJTyxJQUFJLEVBQUUsQ0FBQTtBQUN2QlAsTUFBQUEsVUFBVSxDQUFDNUcsR0FBRyxDQUFDa0gsU0FBUyxDQUFDLENBQUE7QUFDekJILE1BQUFBLEdBQUcsQ0FBQ3JHLElBQUksQ0FBQ2tHLFVBQVUsQ0FBQyxDQUFBO0FBQ3hCLEtBQUE7QUFDSixHQUFDLE1BQU07SUFDSCxLQUFLcEwsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHc0wsU0FBUyxFQUFFdEwsQ0FBQyxFQUFFLEVBQUU7TUFDNUJvTCxVQUFVLEdBQUcsSUFBSU8sSUFBSSxFQUFFLENBQUE7QUFDdkJKLE1BQUFBLEdBQUcsQ0FBQ3JHLElBQUksQ0FBQ2tHLFVBQVUsQ0FBQyxDQUFBO0FBQ3hCLEtBQUE7QUFDSixHQUFBO0VBRUEsTUFBTVEsU0FBUyxHQUFHLEVBQUUsQ0FBQTtFQUNwQixLQUFLNUwsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHc0wsU0FBUyxFQUFFdEwsQ0FBQyxFQUFFLEVBQUU7QUFDNUI0TCxJQUFBQSxTQUFTLENBQUM1TCxDQUFDLENBQUMsR0FBR3BFLEtBQUssQ0FBQ3lQLE1BQU0sQ0FBQ3JMLENBQUMsQ0FBQyxDQUFDLENBQUNpRixJQUFJLENBQUE7QUFDeEMsR0FBQTs7QUFHQSxFQUFBLE1BQU00RyxHQUFHLEdBQUdELFNBQVMsQ0FBQzNDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUMvQixFQUFBLElBQUk2QyxJQUFJLEdBQUdYLFFBQVEsQ0FBQ1ksR0FBRyxDQUFDRixHQUFHLENBQUMsQ0FBQTtFQUM1QixJQUFJLENBQUNDLElBQUksRUFBRTtJQUdQQSxJQUFJLEdBQUcsSUFBSUUsSUFBSSxDQUFDL0YsTUFBTSxFQUFFc0YsR0FBRyxFQUFFSyxTQUFTLENBQUMsQ0FBQTtBQUN2Q1QsSUFBQUEsUUFBUSxDQUFDM0csR0FBRyxDQUFDcUgsR0FBRyxFQUFFQyxJQUFJLENBQUMsQ0FBQTtBQUMzQixHQUFBO0FBRUEsRUFBQSxPQUFPQSxJQUFJLENBQUE7QUFDZixDQUFDLENBQUE7QUFFRCxNQUFNRyxPQUFPLEdBQUcsSUFBSU4sSUFBSSxFQUFFLENBQUE7QUFDMUIsTUFBTU8sT0FBTyxHQUFHLElBQUl2SixJQUFJLEVBQUUsQ0FBQTtBQUUxQixNQUFNd0osVUFBVSxHQUFHLFNBQWJBLFVBQVUsQ0FBYWxHLE1BQU0sRUFBRW1HLFFBQVEsRUFBRXpELFNBQVMsRUFBRXhJLFdBQVcsRUFBRWtNLFFBQVEsRUFBRTFGLEtBQUssRUFBRWlDLGdCQUFnQixFQUFFMU0sWUFBWSxFQUFFQyxvQkFBb0IsRUFBRW1RLFlBQVksRUFBRTtFQUN4SixNQUFNM1AsTUFBTSxHQUFHLEVBQUUsQ0FBQTtBQUVqQnlQLEVBQUFBLFFBQVEsQ0FBQ0csVUFBVSxDQUFDOVAsT0FBTyxDQUFDLFVBQVVvRyxTQUFTLEVBQUU7QUFFN0MsSUFBQSxJQUFJMkosYUFBYSxFQUFFOUgsWUFBWSxFQUFFK0gsVUFBVSxDQUFBO0lBQzNDLElBQUk1TCxPQUFPLEdBQUcsSUFBSSxDQUFBO0lBQ2xCLElBQUk2TCxXQUFXLEdBQUcsSUFBSSxDQUFBOztBQUd0QixJQUFBLElBQUk3SixTQUFTLENBQUMxQixjQUFjLENBQUMsWUFBWSxDQUFDLEVBQUU7QUFDeEMsTUFBQSxNQUFNd0wsVUFBVSxHQUFHOUosU0FBUyxDQUFDOEosVUFBVSxDQUFBO0FBQ3ZDLE1BQUEsSUFBSUEsVUFBVSxDQUFDeEwsY0FBYyxDQUFDLDRCQUE0QixDQUFDLEVBQUU7QUFHekQsUUFBQSxNQUFNc0ksYUFBYSxHQUFHcE8sb0JBQW9CLElBQUlDLDJCQUEyQixFQUFFLENBQUE7QUFDM0UsUUFBQSxJQUFJbU8sYUFBYSxFQUFFO0FBQ2YsVUFBQSxNQUFNRixRQUFRLEdBQUdvRCxVQUFVLENBQUNDLDBCQUEwQixDQUFBO0FBQ3RELFVBQUEsSUFBSXJELFFBQVEsQ0FBQ3BJLGNBQWMsQ0FBQyxZQUFZLENBQUMsRUFBRTtBQUN2QyxZQUFBLE1BQU0wTCxXQUFXLEdBQUcxTSxXQUFXLENBQUNvSixRQUFRLENBQUMvSSxVQUFVLENBQUMsQ0FBQTtBQUNwRCxZQUFBLE1BQU0wQixNQUFNLEdBQUcsSUFBSXVILGFBQWEsQ0FBQ3FELGFBQWEsRUFBRSxDQUFBO1lBQ2hENUssTUFBTSxDQUFDNkssSUFBSSxDQUFDRixXQUFXLEVBQUVBLFdBQVcsQ0FBQzlNLE1BQU0sQ0FBQyxDQUFBO0FBRTVDLFlBQUEsTUFBTXlKLE9BQU8sR0FBRyxJQUFJQyxhQUFhLENBQUN1RCxPQUFPLEVBQUUsQ0FBQTtBQUMzQyxZQUFBLE1BQU1DLFlBQVksR0FBR3pELE9BQU8sQ0FBQzBELHNCQUFzQixDQUFDaEwsTUFBTSxDQUFDLENBQUE7WUFFM0QsSUFBSW9ILGNBQWMsRUFBRTZELE1BQU0sQ0FBQTtBQUMxQixZQUFBLFFBQVFGLFlBQVk7Y0FDaEIsS0FBS3hELGFBQWEsQ0FBQzJELFdBQVc7QUFDMUJaLGdCQUFBQSxhQUFhLEdBQUd4SixnQkFBZ0IsQ0FBQTtBQUNoQ3NHLGdCQUFBQSxjQUFjLEdBQUcsSUFBSUcsYUFBYSxDQUFDNEQsVUFBVSxFQUFFLENBQUE7Z0JBQy9DRixNQUFNLEdBQUczRCxPQUFPLENBQUM4RCx3QkFBd0IsQ0FBQ3BMLE1BQU0sRUFBRW9ILGNBQWMsQ0FBQyxDQUFBO0FBQ2pFLGdCQUFBLE1BQUE7Y0FDSixLQUFLRyxhQUFhLENBQUM4RCxlQUFlO0FBQzlCZixnQkFBQUEsYUFBYSxHQUFHMUosbUJBQW1CLENBQUE7QUFDbkN3RyxnQkFBQUEsY0FBYyxHQUFHLElBQUlHLGFBQWEsQ0FBQytELElBQUksRUFBRSxDQUFBO2dCQUN6Q0wsTUFBTSxHQUFHM0QsT0FBTyxDQUFDaUUsa0JBQWtCLENBQUN2TCxNQUFNLEVBQUVvSCxjQUFjLENBQUMsQ0FBQTtBQUMzRCxnQkFBQSxNQUFBO2NBQ0osS0FBS0csYUFBYSxDQUFDaUUscUJBQXFCLENBQUE7QUFFOUIsYUFBQTtBQUdkLFlBQUEsSUFBSSxDQUFDUCxNQUFNLElBQUksQ0FBQ0EsTUFBTSxDQUFDUSxFQUFFLEVBQUUsSUFBSXJFLGNBQWMsQ0FBQ2MsR0FBRyxLQUFLLENBQUMsRUFBRTtBQUNyRGlDLGNBQUFBLFFBQVEsQ0FBQywyQ0FBMkMsSUFDbkRjLE1BQU0sR0FBR0EsTUFBTSxDQUFDUyxTQUFTLEVBQUUsR0FBSSx1REFBdUQsR0FBR1gsWUFBYSxDQUFDLENBQUMsQ0FBQTtBQUN6RyxjQUFBLE9BQUE7QUFDSixhQUFBOztBQUdBLFlBQUEsTUFBTVksUUFBUSxHQUFHdkUsY0FBYyxDQUFDd0UsU0FBUyxFQUFFLENBQUE7QUFDM0MsWUFBQSxJQUFJYixZQUFZLEtBQUt4RCxhQUFhLENBQUM4RCxlQUFlLEVBQUU7QUFDaEQsY0FBQSxNQUFNUSxLQUFLLEdBQUd6RSxjQUFjLENBQUNLLFVBQVUsRUFBRSxHQUFHLEtBQUssQ0FBQTtjQUVqRDhDLFVBQVUsR0FBR29CLFFBQVEsR0FBRyxDQUFDLENBQUE7Y0FDekIsTUFBTUcsUUFBUSxHQUFHdkIsVUFBVSxJQUFJc0IsS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUM3QyxjQUFBLE1BQU0zRCxHQUFHLEdBQUdYLGFBQWEsQ0FBQ2UsT0FBTyxDQUFDd0QsUUFBUSxDQUFDLENBQUE7QUFFM0MsY0FBQSxJQUFJRCxLQUFLLEVBQUU7Z0JBQ1B2RSxPQUFPLENBQUN5RSx1QkFBdUIsQ0FBQzNFLGNBQWMsRUFBRTBFLFFBQVEsRUFBRTVELEdBQUcsQ0FBQyxDQUFBO0FBQzlEdkosZ0JBQUFBLE9BQU8sR0FBRyxJQUFJekMsV0FBVyxDQUFDcUwsYUFBYSxDQUFDeUUsT0FBTyxDQUFDaE0sTUFBTSxFQUFFa0ksR0FBRyxFQUFFcUMsVUFBVSxDQUFDLENBQUNuTCxLQUFLLEVBQUUsQ0FBQTtBQUNwRixlQUFDLE1BQU07Z0JBQ0hrSSxPQUFPLENBQUMyRSx1QkFBdUIsQ0FBQzdFLGNBQWMsRUFBRTBFLFFBQVEsRUFBRTVELEdBQUcsQ0FBQyxDQUFBO0FBQzlEdkosZ0JBQUFBLE9BQU8sR0FBRyxJQUFJM0MsV0FBVyxDQUFDdUwsYUFBYSxDQUFDbUIsT0FBTyxDQUFDMUksTUFBTSxFQUFFa0ksR0FBRyxFQUFFcUMsVUFBVSxDQUFDLENBQUNuTCxLQUFLLEVBQUUsQ0FBQTtBQUNwRixlQUFBO0FBRUFtSSxjQUFBQSxhQUFhLENBQUNzQixLQUFLLENBQUNYLEdBQUcsQ0FBQyxDQUFBO0FBQzVCLGFBQUE7O0FBR0ExRixZQUFBQSxZQUFZLEdBQUcyRSx1QkFBdUIsQ0FBQ3BELE1BQU0sRUFBRXFELGNBQWMsRUFBRUMsUUFBUSxFQUFFQyxPQUFPLEVBQUVDLGFBQWEsRUFBRTVJLE9BQU8sRUFBRThGLEtBQUssQ0FBQyxDQUFBOztBQUdoSDhDLFlBQUFBLGFBQWEsQ0FBQ2pOLE9BQU8sQ0FBQzhNLGNBQWMsQ0FBQyxDQUFBO0FBQ3JDRyxZQUFBQSxhQUFhLENBQUNqTixPQUFPLENBQUNnTixPQUFPLENBQUMsQ0FBQTtBQUM5QkMsWUFBQUEsYUFBYSxDQUFDak4sT0FBTyxDQUFDMEYsTUFBTSxDQUFDLENBQUE7O0FBRzdCd0ssWUFBQUEsV0FBVyxHQUFHLEtBQUssQ0FBQTtBQUN2QixXQUFBO0FBQ0osU0FBQyxNQUFNO0FBQ0gwQixVQUFBQSxLQUFLLENBQUNDLElBQUksQ0FBQyxnRkFBZ0YsQ0FBQyxDQUFBO0FBQ2hHLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7SUFHQSxJQUFJLENBQUMzSixZQUFZLEVBQUU7TUFDZjdELE9BQU8sR0FBR2dDLFNBQVMsQ0FBQzFCLGNBQWMsQ0FBQyxTQUFTLENBQUMsR0FBR2xCLGVBQWUsQ0FBQzBJLFNBQVMsQ0FBQzlGLFNBQVMsQ0FBQ2hDLE9BQU8sQ0FBQyxFQUFFVixXQUFXLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFBO0FBQ3ZIdUUsTUFBQUEsWUFBWSxHQUFHK0Qsa0JBQWtCLENBQUN4QyxNQUFNLEVBQUVwRCxTQUFTLENBQUM2RixVQUFVLEVBQUU3SCxPQUFPLEVBQUU4SCxTQUFTLEVBQUV4SSxXQUFXLEVBQUV3RyxLQUFLLEVBQUVpQyxnQkFBZ0IsQ0FBQyxDQUFBO0FBQ3pINEQsTUFBQUEsYUFBYSxHQUFHNUosZ0JBQWdCLENBQUNDLFNBQVMsQ0FBQyxDQUFBO0FBQy9DLEtBQUE7SUFFQSxJQUFJeUwsSUFBSSxHQUFHLElBQUksQ0FBQTtBQUNmLElBQUEsSUFBSTVKLFlBQVksRUFBRTtBQUVkNEosTUFBQUEsSUFBSSxHQUFHLElBQUlkLElBQUksQ0FBQ3ZILE1BQU0sQ0FBQyxDQUFBO01BQ3ZCcUksSUFBSSxDQUFDNUosWUFBWSxHQUFHQSxZQUFZLENBQUE7TUFDaEM0SixJQUFJLENBQUN6TCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUN2QyxJQUFJLEdBQUdrTSxhQUFhLENBQUE7TUFDdEM4QixJQUFJLENBQUN6TCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMwTCxJQUFJLEdBQUcsQ0FBQyxDQUFBO01BQzFCRCxJQUFJLENBQUN6TCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMyTCxPQUFPLEdBQUkzTixPQUFPLEtBQUssSUFBSyxDQUFBOztNQUc5QyxJQUFJQSxPQUFPLEtBQUssSUFBSSxFQUFFO0FBQ2xCLFFBQUEsSUFBSTROLFdBQVcsQ0FBQTtRQUNmLElBQUk1TixPQUFPLFlBQVk3QyxVQUFVLEVBQUU7QUFDL0J5USxVQUFBQSxXQUFXLEdBQUdDLGlCQUFpQixDQUFBO0FBQ25DLFNBQUMsTUFBTSxJQUFJN04sT0FBTyxZQUFZM0MsV0FBVyxFQUFFO0FBQ3ZDdVEsVUFBQUEsV0FBVyxHQUFHRSxrQkFBa0IsQ0FBQTtBQUNwQyxTQUFDLE1BQU07QUFDSEYsVUFBQUEsV0FBVyxHQUFHRyxrQkFBa0IsQ0FBQTtBQUNwQyxTQUFBOztRQUdBLElBQUlILFdBQVcsS0FBS0csa0JBQWtCLElBQUksQ0FBQzNJLE1BQU0sQ0FBQzRJLGNBQWMsRUFBRTtBQUc5RCxVQUFBLElBQUluSyxZQUFZLENBQUNuQixXQUFXLEdBQUcsTUFBTSxFQUFFO0FBQ25DdUwsWUFBQUEsT0FBTyxDQUFDVCxJQUFJLENBQUMsbUhBQW1ILENBQUMsQ0FBQTtBQUNySSxXQUFBOztBQUlBSSxVQUFBQSxXQUFXLEdBQUdFLGtCQUFrQixDQUFBO0FBQ2hDOU4sVUFBQUEsT0FBTyxHQUFHLElBQUkzQyxXQUFXLENBQUMyQyxPQUFPLENBQUMsQ0FBQTtBQUN0QyxTQUFBO0FBRUEsUUFBQSxNQUFNa08sV0FBVyxHQUFHLElBQUlDLFdBQVcsQ0FBQy9JLE1BQU0sRUFBRXdJLFdBQVcsRUFBRTVOLE9BQU8sQ0FBQ2QsTUFBTSxFQUFFK0gsYUFBYSxFQUFFakgsT0FBTyxDQUFDLENBQUE7QUFDaEd5TixRQUFBQSxJQUFJLENBQUNTLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBR0EsV0FBVyxDQUFBO1FBQ2pDVCxJQUFJLENBQUN6TCxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUNqQyxLQUFLLEdBQUdDLE9BQU8sQ0FBQ2QsTUFBTSxDQUFBO0FBQzVDLE9BQUMsTUFBTTtRQUNIdU8sSUFBSSxDQUFDekwsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDakMsS0FBSyxHQUFHOEQsWUFBWSxDQUFDbkIsV0FBVyxDQUFBO0FBQ3RELE9BQUE7QUFFQSxNQUFBLElBQUlWLFNBQVMsQ0FBQzFCLGNBQWMsQ0FBQyxZQUFZLENBQUMsSUFBSTBCLFNBQVMsQ0FBQzhKLFVBQVUsQ0FBQ3hMLGNBQWMsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFO0FBQ3pHLFFBQUEsTUFBTWxGLFFBQVEsR0FBRzRHLFNBQVMsQ0FBQzhKLFVBQVUsQ0FBQ3NDLHNCQUFzQixDQUFBO1FBQzVELE1BQU1DLFdBQVcsR0FBRyxFQUFFLENBQUE7QUFDdEJqVCxRQUFBQSxRQUFRLENBQUNrVCxRQUFRLENBQUMxUyxPQUFPLENBQUUyUyxPQUFPLElBQUs7QUFDbkNBLFVBQUFBLE9BQU8sQ0FBQ25ULFFBQVEsQ0FBQ1EsT0FBTyxDQUFFNFMsT0FBTyxJQUFLO0FBQ2xDSCxZQUFBQSxXQUFXLENBQUNHLE9BQU8sQ0FBQyxHQUFHRCxPQUFPLENBQUNFLFFBQVEsQ0FBQTtBQUMzQyxXQUFDLENBQUMsQ0FBQTtBQUNOLFNBQUMsQ0FBQyxDQUFBO0FBQ0ZwVCxRQUFBQSxZQUFZLENBQUNvUyxJQUFJLENBQUNpQixFQUFFLENBQUMsR0FBR0wsV0FBVyxDQUFBO0FBQ3ZDLE9BQUE7TUFFQS9TLG9CQUFvQixDQUFDbVMsSUFBSSxDQUFDaUIsRUFBRSxDQUFDLEdBQUcxTSxTQUFTLENBQUN5TSxRQUFRLENBQUE7TUFFbEQsSUFBSW5HLFFBQVEsR0FBR1IsU0FBUyxDQUFDOUYsU0FBUyxDQUFDNkYsVUFBVSxDQUFDOEcsUUFBUSxDQUFDLENBQUE7QUFDdkRsQixNQUFBQSxJQUFJLENBQUNtQixJQUFJLEdBQUdsTixzQkFBc0IsQ0FBQzRHLFFBQVEsQ0FBQyxDQUFBOztNQUc1QyxJQUFJdUQsV0FBVyxJQUFJN0osU0FBUyxDQUFDMUIsY0FBYyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQ3BELE1BQU11TyxPQUFPLEdBQUcsRUFBRSxDQUFBO1FBRWxCN00sU0FBUyxDQUFDNk0sT0FBTyxDQUFDalQsT0FBTyxDQUFDLFVBQVUrSyxNQUFNLEVBQUVqQyxLQUFLLEVBQUU7VUFDL0MsTUFBTWMsT0FBTyxHQUFHLEVBQUUsQ0FBQTtBQUVsQixVQUFBLElBQUltQixNQUFNLENBQUNyRyxjQUFjLENBQUMsVUFBVSxDQUFDLEVBQUU7QUFDbkNnSSxZQUFBQSxRQUFRLEdBQUdSLFNBQVMsQ0FBQ25CLE1BQU0sQ0FBQ2dJLFFBQVEsQ0FBQyxDQUFBO1lBQ3JDbkosT0FBTyxDQUFDc0osY0FBYyxHQUFHeE4sc0JBQXNCLENBQUNnSCxRQUFRLEVBQUVoSixXQUFXLENBQUMsQ0FBQTtZQUN0RWtHLE9BQU8sQ0FBQ3VKLGtCQUFrQixHQUFHaFMsWUFBWSxDQUFBO0FBQ3pDeUksWUFBQUEsT0FBTyxDQUFDb0osSUFBSSxHQUFHbE4sc0JBQXNCLENBQUM0RyxRQUFRLENBQUMsQ0FBQTtBQUNuRCxXQUFBO0FBRUEsVUFBQSxJQUFJM0IsTUFBTSxDQUFDckcsY0FBYyxDQUFDLFFBQVEsQ0FBQyxFQUFFO0FBQ2pDZ0ksWUFBQUEsUUFBUSxHQUFHUixTQUFTLENBQUNuQixNQUFNLENBQUNxSSxNQUFNLENBQUMsQ0FBQTtZQUVuQ3hKLE9BQU8sQ0FBQ3lKLFlBQVksR0FBRzNOLHNCQUFzQixDQUFDZ0gsUUFBUSxFQUFFaEosV0FBVyxDQUFDLENBQUE7WUFDcEVrRyxPQUFPLENBQUMwSixnQkFBZ0IsR0FBR25TLFlBQVksQ0FBQTtBQUMzQyxXQUFBOztBQUdBLFVBQUEsSUFBSXdPLFFBQVEsQ0FBQ2pMLGNBQWMsQ0FBQyxRQUFRLENBQUMsSUFDakNpTCxRQUFRLENBQUM0RCxNQUFNLENBQUM3TyxjQUFjLENBQUMsYUFBYSxDQUFDLEVBQUU7WUFDL0NrRixPQUFPLENBQUNwQixJQUFJLEdBQUdtSCxRQUFRLENBQUM0RCxNQUFNLENBQUNDLFdBQVcsQ0FBQzFLLEtBQUssQ0FBQyxDQUFBO0FBQ3JELFdBQUMsTUFBTTtZQUNIYyxPQUFPLENBQUNwQixJQUFJLEdBQUdNLEtBQUssQ0FBQzJLLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQTtBQUNyQyxXQUFBOztBQUdBLFVBQUEsSUFBSTlELFFBQVEsQ0FBQ2pMLGNBQWMsQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUNwQ2tGLE9BQU8sQ0FBQzhKLGFBQWEsR0FBRy9ELFFBQVEsQ0FBQ2dFLE9BQU8sQ0FBQzdLLEtBQUssQ0FBQyxDQUFBO0FBQ25ELFdBQUE7QUFFQWMsVUFBQUEsT0FBTyxDQUFDZ0ssWUFBWSxHQUFHL0QsWUFBWSxDQUFDZ0UsaUJBQWlCLENBQUE7VUFDckRaLE9BQU8sQ0FBQ3hLLElBQUksQ0FBQyxJQUFJcUwsV0FBVyxDQUFDbEssT0FBTyxDQUFDLENBQUMsQ0FBQTtBQUMxQyxTQUFDLENBQUMsQ0FBQTtRQUVGaUksSUFBSSxDQUFDa0MsS0FBSyxHQUFHLElBQUlDLEtBQUssQ0FBQ2YsT0FBTyxFQUFFekosTUFBTSxDQUFDLENBQUE7QUFDM0MsT0FBQTtBQUNKLEtBQUE7QUFFQXRKLElBQUFBLE1BQU0sQ0FBQ3VJLElBQUksQ0FBQ29KLElBQUksQ0FBQyxDQUFBO0FBQ3JCLEdBQUMsQ0FBQyxDQUFBO0FBRUYsRUFBQSxPQUFPM1IsTUFBTSxDQUFBO0FBQ2pCLENBQUMsQ0FBQTtBQUVELE1BQU0rVCx1QkFBdUIsR0FBRyxTQUExQkEsdUJBQXVCLENBQWFuSixNQUFNLEVBQUUrSCxRQUFRLEVBQUVxQixJQUFJLEVBQUU7QUFBQSxFQUFBLElBQUEsa0JBQUEsQ0FBQTtBQUM5RCxFQUFBLElBQUlDLEdBQUcsQ0FBQTtBQUVQLEVBQUEsTUFBTUMsUUFBUSxHQUFHdEosTUFBTSxDQUFDc0osUUFBUSxDQUFBO0FBQ2hDLEVBQUEsSUFBSUEsUUFBUSxFQUFFO0FBQ1YsSUFBQSxLQUFLRCxHQUFHLEdBQUcsQ0FBQyxFQUFFQSxHQUFHLEdBQUdELElBQUksQ0FBQzVRLE1BQU0sRUFBRSxFQUFFNlEsR0FBRyxFQUFFO01BQ3BDdEIsUUFBUSxDQUFDcUIsSUFBSSxDQUFDQyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUMsR0FBR0MsUUFBUSxDQUFBO0FBQzVDLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxNQUFNQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDcEIsRUFBQSxNQUFNQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDbkIsRUFBQSxNQUFNQyxnQkFBZ0IsR0FBR3pKLENBQUFBLGtCQUFBQSxHQUFBQSxNQUFNLENBQUNvRixVQUFVLEtBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUFqQixtQkFBbUJzRSxxQkFBcUIsQ0FBQTtBQUNqRSxFQUFBLElBQUlELGdCQUFnQixFQUFFO0FBQ2xCLElBQUEsTUFBTTVNLE1BQU0sR0FBRzRNLGdCQUFnQixDQUFDNU0sTUFBTSxJQUFJME0sS0FBSyxDQUFBO0FBQy9DLElBQUEsTUFBTUksS0FBSyxHQUFHRixnQkFBZ0IsQ0FBQ0UsS0FBSyxJQUFJSCxJQUFJLENBQUE7QUFDNUMsSUFBQSxNQUFNSSxRQUFRLEdBQUdILGdCQUFnQixDQUFDRyxRQUFRLEdBQUksQ0FBQ0gsZ0JBQWdCLENBQUNHLFFBQVEsR0FBR0MsSUFBSSxDQUFDQyxVQUFVLEdBQUksQ0FBQyxDQUFBO0FBRS9GLElBQUEsTUFBTUMsU0FBUyxHQUFHLElBQUlDLElBQUksQ0FBQ0wsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUM5QyxNQUFNTSxTQUFTLEdBQUcsSUFBSUQsSUFBSSxDQUFDbk4sTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsR0FBRzhNLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRzlNLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBRWpFLElBQUEsS0FBS3dNLEdBQUcsR0FBRyxDQUFDLEVBQUVBLEdBQUcsR0FBR0QsSUFBSSxDQUFDNVEsTUFBTSxFQUFFLEVBQUU2USxHQUFHLEVBQUU7TUFDcEN0QixRQUFRLENBQUUsR0FBRXFCLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUEsU0FBQSxDQUFVLENBQUMsR0FBR1UsU0FBUyxDQUFBO01BQzdDaEMsUUFBUSxDQUFFLEdBQUVxQixJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFBLFNBQUEsQ0FBVSxDQUFDLEdBQUdZLFNBQVMsQ0FBQTtNQUM3Q2xDLFFBQVEsQ0FBRSxHQUFFcUIsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQSxXQUFBLENBQVksQ0FBQyxHQUFHTyxRQUFRLENBQUE7QUFDbEQsS0FBQTtBQUNKLEdBQUE7QUFDSixDQUFDLENBQUE7QUFFRCxNQUFNTSwwQkFBMEIsR0FBRyxTQUE3QkEsMEJBQTBCLENBQWFyUCxJQUFJLEVBQUVrTixRQUFRLEVBQUV2VCxRQUFRLEVBQUU7RUFDbkUsSUFBSTJWLEtBQUssRUFBRWpNLE9BQU8sQ0FBQTtBQUNsQixFQUFBLElBQUlyRCxJQUFJLENBQUNqQixjQUFjLENBQUMsZUFBZSxDQUFDLEVBQUU7SUFDdEN1USxLQUFLLEdBQUd0UCxJQUFJLENBQUN1UCxhQUFhLENBQUE7SUFFMUJyQyxRQUFRLENBQUNzQyxPQUFPLENBQUNwTixHQUFHLENBQUNoRixJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUVsUyxJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUVsUyxJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUMzR3BDLElBQUFBLFFBQVEsQ0FBQ3dDLE9BQU8sR0FBR0osS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQy9CLEdBQUMsTUFBTTtJQUNIcEMsUUFBUSxDQUFDc0MsT0FBTyxDQUFDcE4sR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7SUFDN0I4SyxRQUFRLENBQUN3QyxPQUFPLEdBQUcsQ0FBQyxDQUFBO0FBQ3hCLEdBQUE7QUFDQSxFQUFBLElBQUkxUCxJQUFJLENBQUNqQixjQUFjLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtBQUN2QyxJQUFBLE1BQU00USxjQUFjLEdBQUczUCxJQUFJLENBQUMyUCxjQUFjLENBQUE7QUFDMUN0TSxJQUFBQSxPQUFPLEdBQUcxSixRQUFRLENBQUNnVyxjQUFjLENBQUN4TSxLQUFLLENBQUMsQ0FBQTtJQUV4QytKLFFBQVEsQ0FBQzBDLFVBQVUsR0FBR3ZNLE9BQU8sQ0FBQTtJQUM3QjZKLFFBQVEsQ0FBQzJDLGlCQUFpQixHQUFHLEtBQUssQ0FBQTtJQUNsQzNDLFFBQVEsQ0FBQzRDLFVBQVUsR0FBR3pNLE9BQU8sQ0FBQTtJQUM3QjZKLFFBQVEsQ0FBQzZDLGlCQUFpQixHQUFHLEdBQUcsQ0FBQTtJQUVoQ3pCLHVCQUF1QixDQUFDcUIsY0FBYyxFQUFFekMsUUFBUSxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUE7QUFDN0UsR0FBQTtFQUNBQSxRQUFRLENBQUM4QyxZQUFZLEdBQUcsS0FBSyxDQUFBO0FBQzdCLEVBQUEsSUFBSWhRLElBQUksQ0FBQ2pCLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO0lBQ3ZDdVEsS0FBSyxHQUFHdFAsSUFBSSxDQUFDaVEsY0FBYyxDQUFBO0lBRTNCL0MsUUFBUSxDQUFDZ0QsUUFBUSxDQUFDOU4sR0FBRyxDQUFDaEYsSUFBSSxDQUFDcVMsR0FBRyxDQUFDSCxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFbFMsSUFBSSxDQUFDcVMsR0FBRyxDQUFDSCxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFbFMsSUFBSSxDQUFDcVMsR0FBRyxDQUFDSCxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDaEgsR0FBQyxNQUFNO0lBQ0hwQyxRQUFRLENBQUNnRCxRQUFRLENBQUM5TixHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUNsQyxHQUFBO0FBQ0EsRUFBQSxJQUFJcEMsSUFBSSxDQUFDakIsY0FBYyxDQUFDLGtCQUFrQixDQUFDLEVBQUU7QUFDekNtTyxJQUFBQSxRQUFRLENBQUNpRCxTQUFTLEdBQUcsR0FBRyxHQUFHblEsSUFBSSxDQUFDb1EsZ0JBQWdCLENBQUE7QUFDcEQsR0FBQyxNQUFNO0lBQ0hsRCxRQUFRLENBQUNpRCxTQUFTLEdBQUcsR0FBRyxDQUFBO0FBQzVCLEdBQUE7QUFDQSxFQUFBLElBQUluUSxJQUFJLENBQUNqQixjQUFjLENBQUMsMkJBQTJCLENBQUMsRUFBRTtBQUNsRCxJQUFBLE1BQU1zUix5QkFBeUIsR0FBR3JRLElBQUksQ0FBQ3FRLHlCQUF5QixDQUFBO0lBQ2hFbkQsUUFBUSxDQUFDb0QsZ0JBQWdCLEdBQUcsTUFBTSxDQUFBO0FBQ2xDcEQsSUFBQUEsUUFBUSxDQUFDcUQsV0FBVyxHQUFHckQsUUFBUSxDQUFDc0QsUUFBUSxHQUFHN1csUUFBUSxDQUFDMFcseUJBQXlCLENBQUNsTixLQUFLLENBQUMsQ0FBQTtJQUNwRitKLFFBQVEsQ0FBQ3VELGtCQUFrQixHQUFHLEtBQUssQ0FBQTtJQUNuQ3ZELFFBQVEsQ0FBQ3dELGVBQWUsR0FBRyxHQUFHLENBQUE7SUFFOUJwQyx1QkFBdUIsQ0FBQytCLHlCQUF5QixFQUFFbkQsUUFBUSxFQUFFLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUE7QUFDeEYsR0FBQTtBQUNKLENBQUMsQ0FBQTtBQUVELE1BQU15RCxrQkFBa0IsR0FBRyxTQUFyQkEsa0JBQWtCLENBQWEzUSxJQUFJLEVBQUVrTixRQUFRLEVBQUV2VCxRQUFRLEVBQUU7QUFDM0QsRUFBQSxJQUFJcUcsSUFBSSxDQUFDakIsY0FBYyxDQUFDLGlCQUFpQixDQUFDLEVBQUU7QUFDeENtTyxJQUFBQSxRQUFRLENBQUMwRCxTQUFTLEdBQUc1USxJQUFJLENBQUM2USxlQUFlLEdBQUcsSUFBSSxDQUFBO0FBQ3BELEdBQUMsTUFBTTtJQUNIM0QsUUFBUSxDQUFDMEQsU0FBUyxHQUFHLENBQUMsQ0FBQTtBQUMxQixHQUFBO0FBQ0EsRUFBQSxJQUFJNVEsSUFBSSxDQUFDakIsY0FBYyxDQUFDLGtCQUFrQixDQUFDLEVBQUU7QUFDekMsSUFBQSxNQUFNK1IsZ0JBQWdCLEdBQUc5USxJQUFJLENBQUM4USxnQkFBZ0IsQ0FBQTtJQUM5QzVELFFBQVEsQ0FBQzZELFlBQVksR0FBR3BYLFFBQVEsQ0FBQ21YLGdCQUFnQixDQUFDM04sS0FBSyxDQUFDLENBQUE7SUFDeEQrSixRQUFRLENBQUM4RCxtQkFBbUIsR0FBRyxHQUFHLENBQUE7SUFFbEMxQyx1QkFBdUIsQ0FBQ3dDLGdCQUFnQixFQUFFNUQsUUFBUSxFQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQTtBQUN0RSxHQUFBO0FBQ0EsRUFBQSxJQUFJbE4sSUFBSSxDQUFDakIsY0FBYyxDQUFDLDBCQUEwQixDQUFDLEVBQUU7QUFDakRtTyxJQUFBQSxRQUFRLENBQUMrRCxtQkFBbUIsR0FBR2pSLElBQUksQ0FBQ2tSLHdCQUF3QixDQUFBO0FBQ2hFLEdBQUMsTUFBTTtJQUNIaEUsUUFBUSxDQUFDK0QsbUJBQW1CLEdBQUcsQ0FBQyxDQUFBO0FBQ3BDLEdBQUE7QUFDQSxFQUFBLElBQUlqUixJQUFJLENBQUNqQixjQUFjLENBQUMsMkJBQTJCLENBQUMsRUFBRTtBQUNsRCxJQUFBLE1BQU1vUyx5QkFBeUIsR0FBR25SLElBQUksQ0FBQ21SLHlCQUF5QixDQUFBO0lBQ2hFakUsUUFBUSxDQUFDa0UsaUJBQWlCLEdBQUd6WCxRQUFRLENBQUN3WCx5QkFBeUIsQ0FBQ2hPLEtBQUssQ0FBQyxDQUFBO0lBQ3RFK0osUUFBUSxDQUFDbUUsd0JBQXdCLEdBQUcsR0FBRyxDQUFBO0lBRXZDL0MsdUJBQXVCLENBQUM2Qyx5QkFBeUIsRUFBRWpFLFFBQVEsRUFBRSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQTtBQUNwRixHQUFBO0FBQ0EsRUFBQSxJQUFJbE4sSUFBSSxDQUFDakIsY0FBYyxDQUFDLHdCQUF3QixDQUFDLEVBQUU7QUFDL0MsSUFBQSxNQUFNdVMsc0JBQXNCLEdBQUd0UixJQUFJLENBQUNzUixzQkFBc0IsQ0FBQTtJQUMxRHBFLFFBQVEsQ0FBQ3FFLGtCQUFrQixHQUFHNVgsUUFBUSxDQUFDMlgsc0JBQXNCLENBQUNuTyxLQUFLLENBQUMsQ0FBQTtJQUVwRW1MLHVCQUF1QixDQUFDZ0Qsc0JBQXNCLEVBQUVwRSxRQUFRLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUE7QUFFOUUsSUFBQSxJQUFJb0Usc0JBQXNCLENBQUN2UyxjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUU7QUFDaERtTyxNQUFBQSxRQUFRLENBQUNzRSxrQkFBa0IsR0FBR0Ysc0JBQXNCLENBQUN4QyxLQUFLLENBQUE7QUFDOUQsS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLE1BQU0yQyxtQkFBbUIsR0FBYyxDQUFBO0FBQzNDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxRQUFTLENBQUEsQ0FBQTtBQUNMdkUsRUFBQUEsUUFBUSxDQUFDd0UsTUFBTSxDQUFDQyxnQkFBZ0IsR0FBR0YsbUJBQW1CLENBQUE7QUFDMUQsQ0FBQyxDQUFBO0FBRUQsTUFBTUcsY0FBYyxHQUFHLFNBQWpCQSxjQUFjLENBQWE1UixJQUFJLEVBQUVrTixRQUFRLEVBQUV2VCxRQUFRLEVBQUU7RUFDdkR1VCxRQUFRLENBQUMyRSxXQUFXLEdBQUcsS0FBSyxDQUFBOztFQUc1QjNFLFFBQVEsQ0FBQzRFLFFBQVEsQ0FBQ0MsSUFBSSxDQUFDN0UsUUFBUSxDQUFDc0MsT0FBTyxDQUFDLENBQUE7QUFDeEN0QyxFQUFBQSxRQUFRLENBQUM4RSxZQUFZLEdBQUc5RSxRQUFRLENBQUMrRSxXQUFXLENBQUE7QUFDNUMvRSxFQUFBQSxRQUFRLENBQUNnRixXQUFXLEdBQUdoRixRQUFRLENBQUMwQyxVQUFVLENBQUE7QUFDMUMxQyxFQUFBQSxRQUFRLENBQUNpRixhQUFhLEdBQUdqRixRQUFRLENBQUNrRixZQUFZLENBQUE7RUFDOUNsRixRQUFRLENBQUNtRixpQkFBaUIsQ0FBQ04sSUFBSSxDQUFDN0UsUUFBUSxDQUFDb0YsZ0JBQWdCLENBQUMsQ0FBQTtFQUMxRHBGLFFBQVEsQ0FBQ3FGLGlCQUFpQixDQUFDUixJQUFJLENBQUM3RSxRQUFRLENBQUNzRixnQkFBZ0IsQ0FBQyxDQUFBO0FBQzFEdEYsRUFBQUEsUUFBUSxDQUFDdUYsbUJBQW1CLEdBQUd2RixRQUFRLENBQUN3RixrQkFBa0IsQ0FBQTtBQUMxRHhGLEVBQUFBLFFBQVEsQ0FBQ3lGLGtCQUFrQixHQUFHekYsUUFBUSxDQUFDMkMsaUJBQWlCLENBQUE7QUFDeEQzQyxFQUFBQSxRQUFRLENBQUMwRixtQkFBbUIsR0FBRzFGLFFBQVEsQ0FBQzJGLGtCQUFrQixDQUFBO0FBQzFEM0YsRUFBQUEsUUFBUSxDQUFDNEYsMEJBQTBCLEdBQUc1RixRQUFRLENBQUM2Rix5QkFBeUIsQ0FBQTs7RUFHeEU3RixRQUFRLENBQUNzQyxPQUFPLENBQUNwTixHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtFQUM3QjhLLFFBQVEsQ0FBQytFLFdBQVcsR0FBRyxLQUFLLENBQUE7RUFDNUIvRSxRQUFRLENBQUMwQyxVQUFVLEdBQUcsSUFBSSxDQUFBO0VBQzFCMUMsUUFBUSxDQUFDMkYsa0JBQWtCLEdBQUcsS0FBSyxDQUFBO0FBQ3ZDLENBQUMsQ0FBQTtBQUVELE1BQU1HLGlCQUFpQixHQUFHLFNBQXBCQSxpQkFBaUIsQ0FBYWhULElBQUksRUFBRWtOLFFBQVEsRUFBRXZULFFBQVEsRUFBRTtFQUMxRHVULFFBQVEsQ0FBQytGLHlCQUF5QixHQUFHLElBQUksQ0FBQTtBQUN6QyxFQUFBLElBQUlqVCxJQUFJLENBQUNqQixjQUFjLENBQUMsc0JBQXNCLENBQUMsRUFBRTtJQUM3Q21PLFFBQVEsQ0FBQ29ELGdCQUFnQixHQUFHLE1BQU0sQ0FBQTtJQUNsQ3BELFFBQVEsQ0FBQ3FELFdBQVcsR0FBRzVXLFFBQVEsQ0FBQ3FHLElBQUksQ0FBQ2tULG9CQUFvQixDQUFDL1AsS0FBSyxDQUFDLENBQUE7SUFDaEUrSixRQUFRLENBQUN1RCxrQkFBa0IsR0FBRyxLQUFLLENBQUE7SUFFbkNuQyx1QkFBdUIsQ0FBQ3RPLElBQUksQ0FBQ2tULG9CQUFvQixFQUFFaEcsUUFBUSxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQTtBQUU5RSxHQUFBO0FBQ0EsRUFBQSxJQUFJbE4sSUFBSSxDQUFDakIsY0FBYyxDQUFDLHFCQUFxQixDQUFDLEVBQUU7QUFDNUMsSUFBQSxNQUFNdVEsS0FBSyxHQUFHdFAsSUFBSSxDQUFDbVQsbUJBQW1CLENBQUE7SUFDdENqRyxRQUFRLENBQUNnRCxRQUFRLENBQUM5TixHQUFHLENBQUNoRixJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUVsUyxJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUVsUyxJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUNoSCxHQUFDLE1BQU07SUFDSHBDLFFBQVEsQ0FBQ2dELFFBQVEsQ0FBQzlOLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ2xDLEdBQUE7QUFFQSxFQUFBLElBQUlwQyxJQUFJLENBQUNqQixjQUFjLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtBQUN2Q21PLElBQUFBLFFBQVEsQ0FBQ2tHLGlCQUFpQixHQUFHcFQsSUFBSSxDQUFDaVEsY0FBYyxDQUFBO0FBQ3BELEdBQUMsTUFBTTtJQUNIL0MsUUFBUSxDQUFDa0csaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLEdBQUE7QUFDQSxFQUFBLElBQUlwVCxJQUFJLENBQUNqQixjQUFjLENBQUMsaUJBQWlCLENBQUMsRUFBRTtJQUN4Q21PLFFBQVEsQ0FBQ21HLDJCQUEyQixHQUFHLEdBQUcsQ0FBQTtJQUMxQ25HLFFBQVEsQ0FBQ29HLG9CQUFvQixHQUFHM1osUUFBUSxDQUFDcUcsSUFBSSxDQUFDdVQsZUFBZSxDQUFDcFEsS0FBSyxDQUFDLENBQUE7SUFDcEVtTCx1QkFBdUIsQ0FBQ3RPLElBQUksQ0FBQ3VULGVBQWUsRUFBRXJHLFFBQVEsRUFBRSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQTtBQUNsRixHQUFBO0FBQ0osQ0FBQyxDQUFBO0FBRUQsTUFBTXNHLFlBQVksR0FBRyxTQUFmQSxZQUFZLENBQWF4VCxJQUFJLEVBQUVrTixRQUFRLEVBQUV2VCxRQUFRLEVBQUU7QUFDckQsRUFBQSxJQUFJcUcsSUFBSSxDQUFDakIsY0FBYyxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQzVCbU8sSUFBQUEsUUFBUSxDQUFDdUcsZUFBZSxHQUFHLEdBQUcsR0FBR3pULElBQUksQ0FBQzBULEdBQUcsQ0FBQTtBQUM3QyxHQUFBO0FBQ0osQ0FBQyxDQUFBO0FBRUQsTUFBTUMscUJBQXFCLEdBQUcsU0FBeEJBLHFCQUFxQixDQUFhM1QsSUFBSSxFQUFFa04sUUFBUSxFQUFFdlQsUUFBUSxFQUFFO0VBQzlEdVQsUUFBUSxDQUFDMEcsU0FBUyxHQUFHQyxZQUFZLENBQUE7RUFDakMzRyxRQUFRLENBQUM0RyxvQkFBb0IsR0FBRyxJQUFJLENBQUE7QUFFcEMsRUFBQSxJQUFJOVQsSUFBSSxDQUFDakIsY0FBYyxDQUFDLG9CQUFvQixDQUFDLEVBQUU7QUFDM0NtTyxJQUFBQSxRQUFRLENBQUM2RyxVQUFVLEdBQUcvVCxJQUFJLENBQUNnVSxrQkFBa0IsQ0FBQTtBQUNqRCxHQUFBO0FBQ0EsRUFBQSxJQUFJaFUsSUFBSSxDQUFDakIsY0FBYyxDQUFDLHFCQUFxQixDQUFDLEVBQUU7SUFDNUNtTyxRQUFRLENBQUMrRyxvQkFBb0IsR0FBRyxHQUFHLENBQUE7SUFDbkMvRyxRQUFRLENBQUNnSCxhQUFhLEdBQUd2YSxRQUFRLENBQUNxRyxJQUFJLENBQUNtVSxtQkFBbUIsQ0FBQ2hSLEtBQUssQ0FBQyxDQUFBO0lBQ2pFbUwsdUJBQXVCLENBQUN0TyxJQUFJLENBQUNtVSxtQkFBbUIsRUFBRWpILFFBQVEsRUFBRSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUE7QUFDL0UsR0FBQTtBQUNKLENBQUMsQ0FBQTtBQUVELE1BQU1rSCxjQUFjLEdBQUcsU0FBakJBLGNBQWMsQ0FBYXBVLElBQUksRUFBRWtOLFFBQVEsRUFBRXZULFFBQVEsRUFBRTtFQUN2RHVULFFBQVEsQ0FBQ21ILFFBQVEsR0FBRyxJQUFJLENBQUE7QUFDeEIsRUFBQSxJQUFJclUsSUFBSSxDQUFDakIsY0FBYyxDQUFDLGtCQUFrQixDQUFDLEVBQUU7QUFDekMsSUFBQSxNQUFNdVEsS0FBSyxHQUFHdFAsSUFBSSxDQUFDc1UsZ0JBQWdCLENBQUE7SUFDbkNwSCxRQUFRLENBQUNxSCxLQUFLLENBQUNuUyxHQUFHLENBQUNoRixJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUVsUyxJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUVsUyxJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUM3RyxHQUFDLE1BQU07SUFDSHBDLFFBQVEsQ0FBQ3FILEtBQUssQ0FBQ25TLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQy9CLEdBQUE7QUFDQSxFQUFBLElBQUlwQyxJQUFJLENBQUNqQixjQUFjLENBQUMsbUJBQW1CLENBQUMsRUFBRTtJQUMxQ21PLFFBQVEsQ0FBQ3NILFFBQVEsR0FBRzdhLFFBQVEsQ0FBQ3FHLElBQUksQ0FBQ3lVLGlCQUFpQixDQUFDdFIsS0FBSyxDQUFDLENBQUE7SUFDMUQrSixRQUFRLENBQUN3SCxhQUFhLEdBQUcsTUFBTSxDQUFBO0lBQy9CcEcsdUJBQXVCLENBQUN0TyxJQUFJLENBQUN5VSxpQkFBaUIsRUFBRXZILFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUE7QUFDeEUsR0FBQTtBQUNBLEVBQUEsSUFBSWxOLElBQUksQ0FBQ2pCLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFO0FBQzdDbU8sSUFBQUEsUUFBUSxDQUFDeUgsZUFBZSxHQUFHM1UsSUFBSSxDQUFDNFUsb0JBQW9CLENBQUE7QUFDeEQsR0FBQyxNQUFNO0lBQ0gxSCxRQUFRLENBQUN5SCxlQUFlLEdBQUcsR0FBRyxDQUFBO0FBQ2xDLEdBQUE7QUFDQSxFQUFBLElBQUkzVSxJQUFJLENBQUNqQixjQUFjLENBQUMsdUJBQXVCLENBQUMsRUFBRTtJQUM5Q21PLFFBQVEsQ0FBQzJILGtCQUFrQixHQUFHbGIsUUFBUSxDQUFDcUcsSUFBSSxDQUFDOFUscUJBQXFCLENBQUMzUixLQUFLLENBQUMsQ0FBQTtJQUN4RStKLFFBQVEsQ0FBQzZILHlCQUF5QixHQUFHLEdBQUcsQ0FBQTtJQUN4Q3pHLHVCQUF1QixDQUFDdE8sSUFBSSxDQUFDOFUscUJBQXFCLEVBQUU1SCxRQUFRLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUE7QUFDdEYsR0FBQTtBQUVBLEVBQUEsTUFBTThILGVBQWUsR0FBSSxDQUFBO0FBQzdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUssQ0FBQSxDQUFBO0FBQ0Q5SCxFQUFBQSxRQUFRLENBQUN3RSxNQUFNLENBQUN1RCxZQUFZLEdBQUdELGVBQWUsQ0FBQTtBQUNsRCxDQUFDLENBQUE7QUFFRCxNQUFNRSxlQUFlLEdBQUcsU0FBbEJBLGVBQWUsQ0FBYWxWLElBQUksRUFBRWtOLFFBQVEsRUFBRXZULFFBQVEsRUFBRTtFQUN4RHVULFFBQVEsQ0FBQzBHLFNBQVMsR0FBR0MsWUFBWSxDQUFBO0VBQ2pDM0csUUFBUSxDQUFDNEcsb0JBQW9CLEdBQUcsSUFBSSxDQUFBO0FBQ3BDLEVBQUEsSUFBSTlULElBQUksQ0FBQ2pCLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO0FBQ3hDbU8sSUFBQUEsUUFBUSxDQUFDaUksU0FBUyxHQUFHblYsSUFBSSxDQUFDb1YsZUFBZSxDQUFBO0FBQzdDLEdBQUE7QUFDQSxFQUFBLElBQUlwVixJQUFJLENBQUNqQixjQUFjLENBQUMsa0JBQWtCLENBQUMsRUFBRTtJQUN6Q21PLFFBQVEsQ0FBQ21JLFlBQVksR0FBRzFiLFFBQVEsQ0FBQ3FHLElBQUksQ0FBQ3NWLGdCQUFnQixDQUFDblMsS0FBSyxDQUFDLENBQUE7SUFDN0RtTCx1QkFBdUIsQ0FBQ3RPLElBQUksQ0FBQ3NWLGdCQUFnQixFQUFFcEksUUFBUSxFQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQTtBQUMzRSxHQUFBO0FBQ0EsRUFBQSxJQUFJbE4sSUFBSSxDQUFDakIsY0FBYyxDQUFDLHFCQUFxQixDQUFDLEVBQUU7QUFDNUNtTyxJQUFBQSxRQUFRLENBQUNxSSxtQkFBbUIsR0FBR3ZWLElBQUksQ0FBQ3VWLG1CQUFtQixDQUFBO0FBQzNELEdBQUE7QUFDQSxFQUFBLElBQUl2VixJQUFJLENBQUNqQixjQUFjLENBQUMsa0JBQWtCLENBQUMsRUFBRTtBQUN6QyxJQUFBLE1BQU11USxLQUFLLEdBQUd0UCxJQUFJLENBQUN3VixnQkFBZ0IsQ0FBQTtJQUNuQ3RJLFFBQVEsQ0FBQ3VJLFdBQVcsQ0FBQ3JULEdBQUcsQ0FBQ2hGLElBQUksQ0FBQ3FTLEdBQUcsQ0FBQ0gsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRWxTLElBQUksQ0FBQ3FTLEdBQUcsQ0FBQ0gsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRWxTLElBQUksQ0FBQ3FTLEdBQUcsQ0FBQ0gsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ25ILEdBQUE7QUFDSixDQUFDLENBQUE7QUFFRCxNQUFNb0cseUJBQXlCLEdBQUcsU0FBNUJBLHlCQUF5QixDQUFhMVYsSUFBSSxFQUFFa04sUUFBUSxFQUFFdlQsUUFBUSxFQUFFO0FBQ2xFLEVBQUEsSUFBSXFHLElBQUksQ0FBQ2pCLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFO0FBQ3pDbU8sSUFBQUEsUUFBUSxDQUFDeUksaUJBQWlCLEdBQUczVixJQUFJLENBQUM0VixnQkFBZ0IsQ0FBQTtBQUN0RCxHQUFBO0FBQ0osQ0FBQyxDQUFBO0FBRUQsTUFBTUMsb0JBQW9CLEdBQUcsU0FBdkJBLG9CQUFvQixDQUFhN1YsSUFBSSxFQUFFa04sUUFBUSxFQUFFdlQsUUFBUSxFQUFFO0VBQzdEdVQsUUFBUSxDQUFDNEksY0FBYyxHQUFHLElBQUksQ0FBQTtBQUM5QixFQUFBLElBQUk5VixJQUFJLENBQUNqQixjQUFjLENBQUMsbUJBQW1CLENBQUMsRUFBRTtBQUMxQ21PLElBQUFBLFFBQVEsQ0FBQzZJLFdBQVcsR0FBRy9WLElBQUksQ0FBQ2dXLGlCQUFpQixDQUFBO0FBQ2pELEdBQUE7QUFDQSxFQUFBLElBQUloVyxJQUFJLENBQUNqQixjQUFjLENBQUMsb0JBQW9CLENBQUMsRUFBRTtJQUMzQ21PLFFBQVEsQ0FBQytJLHFCQUFxQixHQUFHLEdBQUcsQ0FBQTtJQUNwQy9JLFFBQVEsQ0FBQ2dKLGNBQWMsR0FBR3ZjLFFBQVEsQ0FBQ3FHLElBQUksQ0FBQ21XLGtCQUFrQixDQUFDaFQsS0FBSyxDQUFDLENBQUE7SUFDakVtTCx1QkFBdUIsQ0FBQ3RPLElBQUksQ0FBQ21XLGtCQUFrQixFQUFFakosUUFBUSxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQTtBQUUvRSxHQUFBO0FBQ0EsRUFBQSxJQUFJbE4sSUFBSSxDQUFDakIsY0FBYyxDQUFDLGdCQUFnQixDQUFDLEVBQUU7QUFDdkNtTyxJQUFBQSxRQUFRLENBQUNrSiwwQkFBMEIsR0FBR3BXLElBQUksQ0FBQ3FXLGNBQWMsQ0FBQTtBQUM3RCxHQUFBO0FBQ0EsRUFBQSxJQUFJclcsSUFBSSxDQUFDakIsY0FBYyxDQUFDLDZCQUE2QixDQUFDLEVBQUU7QUFDcERtTyxJQUFBQSxRQUFRLENBQUNvSix1QkFBdUIsR0FBR3RXLElBQUksQ0FBQ3VXLDJCQUEyQixDQUFBO0FBQ3ZFLEdBQUE7QUFDQSxFQUFBLElBQUl2VyxJQUFJLENBQUNqQixjQUFjLENBQUMsNkJBQTZCLENBQUMsRUFBRTtBQUNwRG1PLElBQUFBLFFBQVEsQ0FBQ3NKLHVCQUF1QixHQUFHeFcsSUFBSSxDQUFDeVcsMkJBQTJCLENBQUE7QUFDdkUsR0FBQTtBQUNBLEVBQUEsSUFBSXpXLElBQUksQ0FBQ2pCLGNBQWMsQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFO0lBQ3BEbU8sUUFBUSxDQUFDd0osOEJBQThCLEdBQUcsR0FBRyxDQUFBO0lBQzdDeEosUUFBUSxDQUFDeUosdUJBQXVCLEdBQUdoZCxRQUFRLENBQUNxRyxJQUFJLENBQUM0VywyQkFBMkIsQ0FBQ3pULEtBQUssQ0FBQyxDQUFBO0lBQ25GbUwsdUJBQXVCLENBQUN0TyxJQUFJLENBQUM0VywyQkFBMkIsRUFBRTFKLFFBQVEsRUFBRSxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQTtBQUNqRyxHQUFBO0FBQ0osQ0FBQyxDQUFBO0FBRUQsTUFBTTJKLGNBQWMsR0FBRyxTQUFqQkEsY0FBYyxDQUFhQyxZQUFZLEVBQUVuZCxRQUFRLEVBQUU0SyxLQUFLLEVBQUU7QUFFNUQsRUFBQSxNQUFNd1MsVUFBVSxHQUFJLENBQUE7QUFDeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVMsQ0FBQSxDQUFBO0FBR0wsRUFBQSxNQUFNN0osUUFBUSxHQUFHLElBQUk4SixnQkFBZ0IsRUFBRSxDQUFBOztFQUd2QzlKLFFBQVEsQ0FBQytKLGVBQWUsR0FBR0MsVUFBVSxDQUFBO0VBRXJDaEssUUFBUSxDQUFDK0UsV0FBVyxHQUFHLElBQUksQ0FBQTtFQUMzQi9FLFFBQVEsQ0FBQzJGLGtCQUFrQixHQUFHLElBQUksQ0FBQTtFQUVsQzNGLFFBQVEsQ0FBQ2lLLFlBQVksR0FBRyxJQUFJLENBQUE7RUFDNUJqSyxRQUFRLENBQUNrSyxtQkFBbUIsR0FBRyxJQUFJLENBQUE7QUFFbkNsSyxFQUFBQSxRQUFRLENBQUN3RSxNQUFNLENBQUMyRixVQUFVLEdBQUdDLGFBQWEsQ0FBQTtBQUUxQyxFQUFBLElBQUlSLFlBQVksQ0FBQy9YLGNBQWMsQ0FBQyxNQUFNLENBQUMsRUFBRTtBQUNyQ21PLElBQUFBLFFBQVEsQ0FBQ3JLLElBQUksR0FBR2lVLFlBQVksQ0FBQ2pVLElBQUksQ0FBQTtBQUNyQyxHQUFBO0VBRUEsSUFBSXlNLEtBQUssRUFBRWpNLE9BQU8sQ0FBQTtBQUNsQixFQUFBLElBQUl5VCxZQUFZLENBQUMvWCxjQUFjLENBQUMsc0JBQXNCLENBQUMsRUFBRTtBQUNyRCxJQUFBLE1BQU13WSxPQUFPLEdBQUdULFlBQVksQ0FBQ1Usb0JBQW9CLENBQUE7QUFFakQsSUFBQSxJQUFJRCxPQUFPLENBQUN4WSxjQUFjLENBQUMsaUJBQWlCLENBQUMsRUFBRTtNQUMzQ3VRLEtBQUssR0FBR2lJLE9BQU8sQ0FBQ0UsZUFBZSxDQUFBO01BRS9CdkssUUFBUSxDQUFDc0MsT0FBTyxDQUFDcE4sR0FBRyxDQUFDaEYsSUFBSSxDQUFDcVMsR0FBRyxDQUFDSCxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFbFMsSUFBSSxDQUFDcVMsR0FBRyxDQUFDSCxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFbFMsSUFBSSxDQUFDcVMsR0FBRyxDQUFDSCxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDM0dwQyxNQUFBQSxRQUFRLENBQUN3QyxPQUFPLEdBQUdKLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUMvQixLQUFDLE1BQU07TUFDSHBDLFFBQVEsQ0FBQ3NDLE9BQU8sQ0FBQ3BOLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO01BQzdCOEssUUFBUSxDQUFDd0MsT0FBTyxHQUFHLENBQUMsQ0FBQTtBQUN4QixLQUFBO0FBQ0EsSUFBQSxJQUFJNkgsT0FBTyxDQUFDeFksY0FBYyxDQUFDLGtCQUFrQixDQUFDLEVBQUU7QUFDNUMsTUFBQSxNQUFNMlksZ0JBQWdCLEdBQUdILE9BQU8sQ0FBQ0csZ0JBQWdCLENBQUE7QUFDakRyVSxNQUFBQSxPQUFPLEdBQUcxSixRQUFRLENBQUMrZCxnQkFBZ0IsQ0FBQ3ZVLEtBQUssQ0FBQyxDQUFBO01BRTFDK0osUUFBUSxDQUFDMEMsVUFBVSxHQUFHdk0sT0FBTyxDQUFBO01BQzdCNkosUUFBUSxDQUFDMkMsaUJBQWlCLEdBQUcsS0FBSyxDQUFBO01BQ2xDM0MsUUFBUSxDQUFDNEMsVUFBVSxHQUFHek0sT0FBTyxDQUFBO01BQzdCNkosUUFBUSxDQUFDNkMsaUJBQWlCLEdBQUcsR0FBRyxDQUFBO01BRWhDekIsdUJBQXVCLENBQUNvSixnQkFBZ0IsRUFBRXhLLFFBQVEsRUFBRSxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFBO0FBQy9FLEtBQUE7SUFDQUEsUUFBUSxDQUFDOEMsWUFBWSxHQUFHLElBQUksQ0FBQTtJQUM1QjlDLFFBQVEsQ0FBQ2dELFFBQVEsQ0FBQzlOLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQzlCLElBQUEsSUFBSW1WLE9BQU8sQ0FBQ3hZLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO0FBQzFDbU8sTUFBQUEsUUFBUSxDQUFDeUssU0FBUyxHQUFHSixPQUFPLENBQUNLLGNBQWMsQ0FBQTtBQUMvQyxLQUFDLE1BQU07TUFDSDFLLFFBQVEsQ0FBQ3lLLFNBQVMsR0FBRyxDQUFDLENBQUE7QUFDMUIsS0FBQTtBQUNBLElBQUEsSUFBSUosT0FBTyxDQUFDeFksY0FBYyxDQUFDLGlCQUFpQixDQUFDLEVBQUU7QUFDM0NtTyxNQUFBQSxRQUFRLENBQUNpRCxTQUFTLEdBQUcsR0FBRyxHQUFHb0gsT0FBTyxDQUFDTSxlQUFlLENBQUE7QUFDdEQsS0FBQyxNQUFNO01BQ0gzSyxRQUFRLENBQUNpRCxTQUFTLEdBQUcsR0FBRyxDQUFBO0FBQzVCLEtBQUE7QUFDQSxJQUFBLElBQUlvSCxPQUFPLENBQUN4WSxjQUFjLENBQUMsMEJBQTBCLENBQUMsRUFBRTtBQUNwRCxNQUFBLE1BQU0rWSx3QkFBd0IsR0FBR1AsT0FBTyxDQUFDTyx3QkFBd0IsQ0FBQTtBQUNqRTVLLE1BQUFBLFFBQVEsQ0FBQzZLLFlBQVksR0FBRzdLLFFBQVEsQ0FBQ3NELFFBQVEsR0FBRzdXLFFBQVEsQ0FBQ21lLHdCQUF3QixDQUFDM1UsS0FBSyxDQUFDLENBQUE7TUFDcEYrSixRQUFRLENBQUM4SyxtQkFBbUIsR0FBRyxHQUFHLENBQUE7TUFDbEM5SyxRQUFRLENBQUN3RCxlQUFlLEdBQUcsR0FBRyxDQUFBO01BRTlCcEMsdUJBQXVCLENBQUN3Six3QkFBd0IsRUFBRTVLLFFBQVEsRUFBRSxDQUFDLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFBO0FBQ3ZGLEtBQUE7QUFFQUEsSUFBQUEsUUFBUSxDQUFDd0UsTUFBTSxDQUFDdUcsT0FBTyxHQUFHbEIsVUFBVSxDQUFBO0FBQ3hDLEdBQUE7QUFFQSxFQUFBLElBQUlELFlBQVksQ0FBQy9YLGNBQWMsQ0FBQyxlQUFlLENBQUMsRUFBRTtBQUM5QyxJQUFBLE1BQU1tWixhQUFhLEdBQUdwQixZQUFZLENBQUNvQixhQUFhLENBQUE7SUFDaERoTCxRQUFRLENBQUNpTCxTQUFTLEdBQUd4ZSxRQUFRLENBQUN1ZSxhQUFhLENBQUMvVSxLQUFLLENBQUMsQ0FBQTtJQUVsRG1MLHVCQUF1QixDQUFDNEosYUFBYSxFQUFFaEwsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQTtBQUU1RCxJQUFBLElBQUlnTCxhQUFhLENBQUNuWixjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUU7QUFDdkNtTyxNQUFBQSxRQUFRLENBQUNrTCxTQUFTLEdBQUdGLGFBQWEsQ0FBQ3BKLEtBQUssQ0FBQTtBQUM1QyxLQUFBO0FBQ0osR0FBQTtBQUNBLEVBQUEsSUFBSWdJLFlBQVksQ0FBQy9YLGNBQWMsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFO0FBQ2pELElBQUEsTUFBTXNaLGdCQUFnQixHQUFHdkIsWUFBWSxDQUFDdUIsZ0JBQWdCLENBQUE7SUFDdERuTCxRQUFRLENBQUNvTCxLQUFLLEdBQUczZSxRQUFRLENBQUMwZSxnQkFBZ0IsQ0FBQ2xWLEtBQUssQ0FBQyxDQUFBO0lBQ2pEK0osUUFBUSxDQUFDcUwsWUFBWSxHQUFHLEdBQUcsQ0FBQTtJQUUzQmpLLHVCQUF1QixDQUFDK0osZ0JBQWdCLEVBQUVuTCxRQUFRLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBRS9ELEdBQUE7O0FBQ0EsRUFBQSxJQUFJNEosWUFBWSxDQUFDL1gsY0FBYyxDQUFDLGdCQUFnQixDQUFDLEVBQUU7SUFDL0N1USxLQUFLLEdBQUd3SCxZQUFZLENBQUMwQixjQUFjLENBQUE7SUFFbkN0TCxRQUFRLENBQUM0RSxRQUFRLENBQUMxUCxHQUFHLENBQUNoRixJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUVsUyxJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUVsUyxJQUFJLENBQUNxUyxHQUFHLENBQUNILEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQTtJQUM1R3BDLFFBQVEsQ0FBQzhFLFlBQVksR0FBRyxJQUFJLENBQUE7QUFDaEMsR0FBQyxNQUFNO0lBQ0g5RSxRQUFRLENBQUM0RSxRQUFRLENBQUMxUCxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUM5QjhLLFFBQVEsQ0FBQzhFLFlBQVksR0FBRyxLQUFLLENBQUE7QUFDakMsR0FBQTtBQUNBLEVBQUEsSUFBSThFLFlBQVksQ0FBQy9YLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO0FBQ2hELElBQUEsTUFBTTBaLGVBQWUsR0FBRzNCLFlBQVksQ0FBQzJCLGVBQWUsQ0FBQTtJQUNwRHZMLFFBQVEsQ0FBQ2dGLFdBQVcsR0FBR3ZZLFFBQVEsQ0FBQzhlLGVBQWUsQ0FBQ3RWLEtBQUssQ0FBQyxDQUFBO0lBRXREbUwsdUJBQXVCLENBQUNtSyxlQUFlLEVBQUV2TCxRQUFRLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFBO0FBQ3BFLEdBQUE7QUFDQSxFQUFBLElBQUk0SixZQUFZLENBQUMvWCxjQUFjLENBQUMsV0FBVyxDQUFDLEVBQUU7SUFDMUMsUUFBUStYLFlBQVksQ0FBQzRCLFNBQVM7QUFDMUIsTUFBQSxLQUFLLE1BQU07UUFDUHhMLFFBQVEsQ0FBQzBHLFNBQVMsR0FBRytFLFVBQVUsQ0FBQTtBQUMvQixRQUFBLElBQUk3QixZQUFZLENBQUMvWCxjQUFjLENBQUMsYUFBYSxDQUFDLEVBQUU7QUFDNUNtTyxVQUFBQSxRQUFRLENBQUMwTCxTQUFTLEdBQUc5QixZQUFZLENBQUMrQixXQUFXLENBQUE7QUFDakQsU0FBQyxNQUFNO1VBQ0gzTCxRQUFRLENBQUMwTCxTQUFTLEdBQUcsR0FBRyxDQUFBO0FBQzVCLFNBQUE7QUFDQSxRQUFBLE1BQUE7QUFDSixNQUFBLEtBQUssT0FBTztRQUNSMUwsUUFBUSxDQUFDMEcsU0FBUyxHQUFHQyxZQUFZLENBQUE7UUFFakMzRyxRQUFRLENBQUM0TCxVQUFVLEdBQUcsS0FBSyxDQUFBO0FBQzNCLFFBQUEsTUFBQTtBQUNKLE1BQUEsUUFBQTtBQUNBLE1BQUEsS0FBSyxRQUFRO1FBQ1Q1TCxRQUFRLENBQUMwRyxTQUFTLEdBQUcrRSxVQUFVLENBQUE7QUFDL0IsUUFBQSxNQUFBO0FBQU0sS0FBQTtBQUVsQixHQUFDLE1BQU07SUFDSHpMLFFBQVEsQ0FBQzBHLFNBQVMsR0FBRytFLFVBQVUsQ0FBQTtBQUNuQyxHQUFBO0FBQ0EsRUFBQSxJQUFJN0IsWUFBWSxDQUFDL1gsY0FBYyxDQUFDLGFBQWEsQ0FBQyxFQUFFO0FBQzVDbU8sSUFBQUEsUUFBUSxDQUFDNkwsZ0JBQWdCLEdBQUdqQyxZQUFZLENBQUNrQyxXQUFXLENBQUE7SUFDcEQ5TCxRQUFRLENBQUMrTCxJQUFJLEdBQUduQyxZQUFZLENBQUNrQyxXQUFXLEdBQUdFLGFBQWEsR0FBR0MsYUFBYSxDQUFBO0FBQzVFLEdBQUMsTUFBTTtJQUNIak0sUUFBUSxDQUFDNkwsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0lBQ2pDN0wsUUFBUSxDQUFDK0wsSUFBSSxHQUFHRSxhQUFhLENBQUE7QUFDakMsR0FBQTs7QUFHQSxFQUFBLE1BQU01TyxVQUFVLEdBQUc7QUFDZixJQUFBLHlCQUF5QixFQUFFb0csa0JBQWtCO0FBQzdDLElBQUEsaUNBQWlDLEVBQUUrRSx5QkFBeUI7QUFDNUQsSUFBQSxtQkFBbUIsRUFBRWxDLFlBQVk7QUFDakMsSUFBQSwyQkFBMkIsRUFBRXFDLG9CQUFvQjtBQUNqRCxJQUFBLHFDQUFxQyxFQUFFeEcsMEJBQTBCO0FBQ2pFLElBQUEscUJBQXFCLEVBQUUrRSxjQUFjO0FBQ3JDLElBQUEsd0JBQXdCLEVBQUVwQixpQkFBaUI7QUFDM0MsSUFBQSw0QkFBNEIsRUFBRVcscUJBQXFCO0FBQ25ELElBQUEscUJBQXFCLEVBQUUvQixjQUFjO0FBQ3JDLElBQUEsc0JBQXNCLEVBQUVzRCxlQUFBQTtHQUMzQixDQUFBOztBQUdELEVBQUEsSUFBSTRCLFlBQVksQ0FBQy9YLGNBQWMsQ0FBQyxZQUFZLENBQUMsRUFBRTtBQUMzQyxJQUFBLEtBQUssTUFBTTBLLEdBQUcsSUFBSXFOLFlBQVksQ0FBQ3ZNLFVBQVUsRUFBRTtBQUN2QyxNQUFBLE1BQU02TyxhQUFhLEdBQUc3TyxVQUFVLENBQUNkLEdBQUcsQ0FBQyxDQUFBO01BQ3JDLElBQUkyUCxhQUFhLEtBQUtDLFNBQVMsRUFBRTtRQUM3QkQsYUFBYSxDQUFDdEMsWUFBWSxDQUFDdk0sVUFBVSxDQUFDZCxHQUFHLENBQUMsRUFBRXlELFFBQVEsRUFBRXZULFFBQVEsQ0FBQyxDQUFBO0FBQ25FLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtFQUVBdVQsUUFBUSxDQUFDb00sTUFBTSxFQUFFLENBQUE7QUFFakIsRUFBQSxPQUFPcE0sUUFBUSxDQUFBO0FBQ25CLENBQUMsQ0FBQTs7QUFHRCxNQUFNcU0sZUFBZSxHQUFHLFNBQWxCQSxlQUFlLENBQWFDLGFBQWEsRUFBRUMsY0FBYyxFQUFFQyxhQUFhLEVBQUUzYixXQUFXLEVBQUV2RSxLQUFLLEVBQUVlLE1BQU0sRUFBRTtBQUd4RyxFQUFBLE1BQU1vZixjQUFjLEdBQUcsU0FBakJBLGNBQWMsQ0FBYTdiLFlBQVksRUFBRTtBQUMzQyxJQUFBLE9BQU8sSUFBSThiLFFBQVEsQ0FBQzllLGdCQUFnQixDQUFDZ0QsWUFBWSxDQUFDSSxJQUFJLENBQUMsRUFBRTZCLHNCQUFzQixDQUFDakMsWUFBWSxFQUFFQyxXQUFXLENBQUMsQ0FBQyxDQUFBO0dBQzlHLENBQUE7QUFFRCxFQUFBLE1BQU04YixTQUFTLEdBQUc7QUFDZCxJQUFBLE1BQU0sRUFBRUMsa0JBQWtCO0FBQzFCLElBQUEsUUFBUSxFQUFFQyxvQkFBb0I7QUFDOUIsSUFBQSxhQUFhLEVBQUVDLG1CQUFBQTtHQUNsQixDQUFBOztFQUdELE1BQU1DLFFBQVEsR0FBRyxFQUFHLENBQUE7RUFDcEIsTUFBTUMsU0FBUyxHQUFHLEVBQUcsQ0FBQTtFQUdyQixNQUFNQyxRQUFRLEdBQUcsRUFBRyxDQUFBO0VBQ3BCLElBQUlDLGFBQWEsR0FBRyxDQUFDLENBQUE7QUFFckIsRUFBQSxJQUFJeGMsQ0FBQyxDQUFBOztBQUdMLEVBQUEsS0FBS0EsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHNGIsYUFBYSxDQUFDYSxRQUFRLENBQUMxYyxNQUFNLEVBQUUsRUFBRUMsQ0FBQyxFQUFFO0FBQ2hELElBQUEsTUFBTTBjLE9BQU8sR0FBR2QsYUFBYSxDQUFDYSxRQUFRLENBQUN6YyxDQUFDLENBQUMsQ0FBQTs7SUFHekMsSUFBSSxDQUFDcWMsUUFBUSxDQUFDbGIsY0FBYyxDQUFDdWIsT0FBTyxDQUFDQyxLQUFLLENBQUMsRUFBRTtBQUN6Q04sTUFBQUEsUUFBUSxDQUFDSyxPQUFPLENBQUNDLEtBQUssQ0FBQyxHQUFHWixjQUFjLENBQUNELGFBQWEsQ0FBQ1ksT0FBTyxDQUFDQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0FBQzFFLEtBQUE7O0lBR0EsSUFBSSxDQUFDTCxTQUFTLENBQUNuYixjQUFjLENBQUN1YixPQUFPLENBQUNFLE1BQU0sQ0FBQyxFQUFFO0FBQzNDTixNQUFBQSxTQUFTLENBQUNJLE9BQU8sQ0FBQ0UsTUFBTSxDQUFDLEdBQUdiLGNBQWMsQ0FBQ0QsYUFBYSxDQUFDWSxPQUFPLENBQUNFLE1BQU0sQ0FBQyxDQUFDLENBQUE7QUFDN0UsS0FBQTtJQUVBLE1BQU1DLGFBQWEsR0FDZkgsT0FBTyxDQUFDdmIsY0FBYyxDQUFDLGVBQWUsQ0FBQyxJQUN2QzhhLFNBQVMsQ0FBQzlhLGNBQWMsQ0FBQ3ViLE9BQU8sQ0FBQ0csYUFBYSxDQUFDLEdBQzNDWixTQUFTLENBQUNTLE9BQU8sQ0FBQ0csYUFBYSxDQUFDLEdBQUdWLG9CQUFvQixDQUFBOztBQUcvRCxJQUFBLE1BQU1XLEtBQUssR0FBRztBQUNWQyxNQUFBQSxLQUFLLEVBQUUsRUFBRTtNQUNUSixLQUFLLEVBQUVELE9BQU8sQ0FBQ0MsS0FBSztNQUNwQkMsTUFBTSxFQUFFRixPQUFPLENBQUNFLE1BQU07QUFDdEJDLE1BQUFBLGFBQWEsRUFBRUEsYUFBQUE7S0FDbEIsQ0FBQTtBQUVETixJQUFBQSxRQUFRLENBQUN2YyxDQUFDLENBQUMsR0FBRzhjLEtBQUssQ0FBQTtBQUN2QixHQUFBO0VBRUEsTUFBTUUsVUFBVSxHQUFHLEVBQUUsQ0FBQTtBQUVyQixFQUFBLE1BQU1DLGVBQWUsR0FBRztBQUNwQixJQUFBLGFBQWEsRUFBRSxlQUFlO0FBQzlCLElBQUEsVUFBVSxFQUFFLGVBQWU7QUFDM0IsSUFBQSxPQUFPLEVBQUUsWUFBQTtHQUNaLENBQUE7RUFFRCxNQUFNQyxpQkFBaUIsR0FBSUMsSUFBSSxJQUFLO0lBQ2hDLE1BQU1DLElBQUksR0FBRyxFQUFFLENBQUE7QUFDZixJQUFBLE9BQU9ELElBQUksRUFBRTtBQUNUQyxNQUFBQSxJQUFJLENBQUNDLE9BQU8sQ0FBQ0YsSUFBSSxDQUFDbFksSUFBSSxDQUFDLENBQUE7TUFDdkJrWSxJQUFJLEdBQUdBLElBQUksQ0FBQ0csTUFBTSxDQUFBO0FBQ3RCLEtBQUE7QUFDQSxJQUFBLE9BQU9GLElBQUksQ0FBQTtHQUNkLENBQUE7QUFFRCxFQUFBLE1BQU1HLGtCQUFrQixHQUFHLENBQUNDLFFBQVEsRUFBRUMsV0FBVyxLQUFLO0FBQ2xELElBQUEsSUFBSSxDQUFDOWdCLE1BQU0sRUFBRSxPQUFPOGdCLFdBQVcsQ0FBQTtBQUMvQixJQUFBLEtBQUssSUFBSXpkLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3JELE1BQU0sQ0FBQ29ELE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7QUFDcEMsTUFBQSxNQUFNc08sSUFBSSxHQUFHM1IsTUFBTSxDQUFDcUQsQ0FBQyxDQUFDLENBQUE7QUFDdEIsTUFBQSxJQUFJc08sSUFBSSxDQUFDckosSUFBSSxLQUFLdVksUUFBUSxJQUFJbFAsSUFBSSxDQUFDbk4sY0FBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJbU4sSUFBSSxDQUFDMEIsTUFBTSxDQUFDN08sY0FBYyxDQUFDLGFBQWEsQ0FBQyxJQUFJbU4sSUFBSSxDQUFDMEIsTUFBTSxDQUFDQyxXQUFXLENBQUN3TixXQUFXLENBQUMsRUFBRTtRQUM5SSxPQUFRLENBQUEsS0FBQSxFQUFPblAsSUFBSSxDQUFDMEIsTUFBTSxDQUFDQyxXQUFXLENBQUN3TixXQUFXLENBQUUsQ0FBQyxDQUFBLENBQUE7QUFDekQsT0FBQTtBQUNKLEtBQUE7QUFDQSxJQUFBLE9BQU9BLFdBQVcsQ0FBQTtHQUNyQixDQUFBOztFQUlELE1BQU1DLHVCQUF1QixHQUFHLENBQUNaLEtBQUssRUFBRUssSUFBSSxFQUFFUSxVQUFVLEtBQUs7QUFDekQsSUFBQSxJQUFJLENBQUNyQixTQUFTLENBQUNRLEtBQUssQ0FBQ0YsTUFBTSxDQUFDLEVBQUU7QUFDMUJ4TyxNQUFBQSxLQUFLLENBQUNDLElBQUksQ0FBRSxDQUFzRXNQLG9FQUFBQSxFQUFBQSxVQUFXLDRCQUEyQixDQUFDLENBQUE7QUFDekgsTUFBQSxPQUFBO0FBQ0osS0FBQTtJQUNBLE1BQU1DLGdCQUFnQixHQUFHdEIsU0FBUyxDQUFDUSxLQUFLLENBQUNGLE1BQU0sQ0FBQyxDQUFDeGEsSUFBSSxDQUFDckMsTUFBTSxHQUFHc2MsUUFBUSxDQUFDUyxLQUFLLENBQUNILEtBQUssQ0FBQyxDQUFDdmEsSUFBSSxDQUFDckMsTUFBTSxDQUFBO0FBQ2hHLElBQUEsTUFBTThkLGFBQWEsR0FBR3ZCLFNBQVMsQ0FBQ1EsS0FBSyxDQUFDRixNQUFNLENBQUMsQ0FBQ3hhLElBQUksQ0FBQ3JDLE1BQU0sR0FBRzZkLGdCQUFnQixDQUFBO0lBRTVFLEtBQUssSUFBSXBjLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR29jLGdCQUFnQixFQUFFcGMsQ0FBQyxFQUFFLEVBQUU7QUFDdkMsTUFBQSxNQUFNc2MsaUJBQWlCLEdBQUcsSUFBSXpmLFlBQVksQ0FBQ3dmLGFBQWEsQ0FBQyxDQUFBO01BRXpELEtBQUssSUFBSXZXLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3VXLGFBQWEsRUFBRXZXLENBQUMsRUFBRSxFQUFFO0FBQ3BDd1csUUFBQUEsaUJBQWlCLENBQUN4VyxDQUFDLENBQUMsR0FBR2dWLFNBQVMsQ0FBQ1EsS0FBSyxDQUFDRixNQUFNLENBQUMsQ0FBQ3hhLElBQUksQ0FBQ2tGLENBQUMsR0FBR3NXLGdCQUFnQixHQUFHcGMsQ0FBQyxDQUFDLENBQUE7QUFDakYsT0FBQTtNQUNBLE1BQU1vYixNQUFNLEdBQUcsSUFBSVosUUFBUSxDQUFDLENBQUMsRUFBRThCLGlCQUFpQixDQUFDLENBQUE7QUFFakR4QixNQUFBQSxTQUFTLENBQUMsQ0FBQ0UsYUFBYSxDQUFDLEdBQUdJLE1BQU0sQ0FBQTtBQUNsQyxNQUFBLE1BQU1tQixVQUFVLEdBQUc7QUFDZmhCLFFBQUFBLEtBQUssRUFBRSxDQUFDO0FBQ0pZLFVBQUFBLFVBQVUsRUFBRUEsVUFBVTtBQUN0QkssVUFBQUEsU0FBUyxFQUFFLE9BQU87VUFDbEJDLFlBQVksRUFBRSxDQUFFLENBQUEsT0FBQSxFQUFTVixrQkFBa0IsQ0FBQ0osSUFBSSxDQUFDbFksSUFBSSxFQUFFekQsQ0FBQyxDQUFFLENBQUMsQ0FBQSxDQUFBO0FBQy9ELFNBQUMsQ0FBQztRQUVGbWIsS0FBSyxFQUFFRyxLQUFLLENBQUNILEtBQUs7UUFFbEJDLE1BQU0sRUFBRSxDQUFDSixhQUFhO1FBQ3RCSyxhQUFhLEVBQUVDLEtBQUssQ0FBQ0QsYUFBQUE7T0FDeEIsQ0FBQTtBQUNETCxNQUFBQSxhQUFhLEVBQUUsQ0FBQTtNQUVmRCxRQUFRLENBQUUsY0FBYXZjLENBQUUsQ0FBQSxDQUFBLEVBQUd3QixDQUFFLENBQUMsQ0FBQSxDQUFDLEdBQUd1YyxVQUFVLENBQUE7QUFDakQsS0FBQTtHQUNILENBQUE7O0FBR0QsRUFBQSxLQUFLL2QsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHNGIsYUFBYSxDQUFDc0MsUUFBUSxDQUFDbmUsTUFBTSxFQUFFLEVBQUVDLENBQUMsRUFBRTtBQUNoRCxJQUFBLE1BQU1tZSxPQUFPLEdBQUd2QyxhQUFhLENBQUNzQyxRQUFRLENBQUNsZSxDQUFDLENBQUMsQ0FBQTtBQUN6QyxJQUFBLE1BQU13SCxNQUFNLEdBQUcyVyxPQUFPLENBQUMzVyxNQUFNLENBQUE7QUFDN0IsSUFBQSxNQUFNc1YsS0FBSyxHQUFHUCxRQUFRLENBQUM0QixPQUFPLENBQUN6QixPQUFPLENBQUMsQ0FBQTtBQUV2QyxJQUFBLE1BQU1TLElBQUksR0FBR3ZoQixLQUFLLENBQUM0TCxNQUFNLENBQUMyVixJQUFJLENBQUMsQ0FBQTtBQUMvQixJQUFBLE1BQU1RLFVBQVUsR0FBR1QsaUJBQWlCLENBQUNDLElBQUksQ0FBQyxDQUFBO0lBRTFDLElBQUkzVixNQUFNLENBQUM0VixJQUFJLENBQUNnQixVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUU7QUFDbkNWLE1BQUFBLHVCQUF1QixDQUFDWixLQUFLLEVBQUVLLElBQUksRUFBRVEsVUFBVSxDQUFDLENBQUE7TUFHaERwQixRQUFRLENBQUM0QixPQUFPLENBQUN6QixPQUFPLENBQUMsQ0FBQ3FCLFVBQVUsR0FBRyxJQUFJLENBQUE7QUFDL0MsS0FBQyxNQUFNO0FBQ0hqQixNQUFBQSxLQUFLLENBQUNDLEtBQUssQ0FBQzdYLElBQUksQ0FBQztBQUNieVksUUFBQUEsVUFBVSxFQUFFQSxVQUFVO0FBQ3RCSyxRQUFBQSxTQUFTLEVBQUUsT0FBTztBQUNsQkMsUUFBQUEsWUFBWSxFQUFFLENBQUNoQixlQUFlLENBQUN6VixNQUFNLENBQUM0VixJQUFJLENBQUMsQ0FBQTtBQUMvQyxPQUFDLENBQUMsQ0FBQTtBQUNOLEtBQUE7QUFFSixHQUFBO0VBRUEsTUFBTWlCLE1BQU0sR0FBRyxFQUFFLENBQUE7RUFDakIsTUFBTUMsT0FBTyxHQUFHLEVBQUUsQ0FBQTtFQUNsQixNQUFNQyxNQUFNLEdBQUcsRUFBRSxDQUFBOztBQUdqQixFQUFBLEtBQUssTUFBTUMsUUFBUSxJQUFJbkMsUUFBUSxFQUFFO0FBQzdCZ0MsSUFBQUEsTUFBTSxDQUFDblosSUFBSSxDQUFDbVgsUUFBUSxDQUFDbUMsUUFBUSxDQUFDLENBQUMsQ0FBQTtJQUMvQm5DLFFBQVEsQ0FBQ21DLFFBQVEsQ0FBQyxHQUFHSCxNQUFNLENBQUN0ZSxNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQzFDLEdBQUE7QUFFQSxFQUFBLEtBQUssTUFBTTBlLFNBQVMsSUFBSW5DLFNBQVMsRUFBRTtBQUMvQmdDLElBQUFBLE9BQU8sQ0FBQ3BaLElBQUksQ0FBQ29YLFNBQVMsQ0FBQ21DLFNBQVMsQ0FBQyxDQUFDLENBQUE7SUFDbENuQyxTQUFTLENBQUNtQyxTQUFTLENBQUMsR0FBR0gsT0FBTyxDQUFDdmUsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUM3QyxHQUFBO0FBR0EsRUFBQSxLQUFLLE1BQU0yZSxRQUFRLElBQUluQyxRQUFRLEVBQUU7QUFDN0IsSUFBQSxNQUFNb0MsU0FBUyxHQUFHcEMsUUFBUSxDQUFDbUMsUUFBUSxDQUFDLENBQUE7SUFFcEMsSUFBSUMsU0FBUyxDQUFDWixVQUFVLEVBQUU7QUFDdEIsTUFBQSxTQUFBO0FBQ0osS0FBQTtBQUNBUSxJQUFBQSxNQUFNLENBQUNyWixJQUFJLENBQUMsSUFBSTBaLFNBQVMsQ0FDckJELFNBQVMsQ0FBQzVCLEtBQUssRUFDZlYsUUFBUSxDQUFDc0MsU0FBUyxDQUFDaEMsS0FBSyxDQUFDLEVBQ3pCTCxTQUFTLENBQUNxQyxTQUFTLENBQUMvQixNQUFNLENBQUMsRUFDM0IrQixTQUFTLENBQUM5QixhQUFhLENBQzFCLENBQUMsQ0FBQTs7SUFJRixJQUFJOEIsU0FBUyxDQUFDNUIsS0FBSyxDQUFDaGQsTUFBTSxHQUFHLENBQUMsSUFBSTRlLFNBQVMsQ0FBQzVCLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQ2tCLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBSyxlQUFlLElBQUlVLFNBQVMsQ0FBQzlCLGFBQWEsS0FBS1QsbUJBQW1CLEVBQUU7QUFDeklZLE1BQUFBLFVBQVUsQ0FBQzlYLElBQUksQ0FBQ3FaLE1BQU0sQ0FBQ0EsTUFBTSxDQUFDeGUsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDNmMsTUFBTSxDQUFDLENBQUE7QUFDckQsS0FBQTtBQUNKLEdBQUE7O0VBR0FJLFVBQVUsQ0FBQy9WLElBQUksRUFBRSxDQUFBOztFQUlqQixJQUFJNFgsU0FBUyxHQUFHLElBQUksQ0FBQTtBQUNwQixFQUFBLElBQUl6YyxJQUFJLENBQUE7QUFDUixFQUFBLEtBQUtwQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdnZCxVQUFVLENBQUNqZCxNQUFNLEVBQUUsRUFBRUMsQ0FBQyxFQUFFO0FBQ3BDLElBQUEsTUFBTXVGLEtBQUssR0FBR3lYLFVBQVUsQ0FBQ2hkLENBQUMsQ0FBQyxDQUFBO0FBRTNCLElBQUEsSUFBSUEsQ0FBQyxLQUFLLENBQUMsSUFBSXVGLEtBQUssS0FBS3NaLFNBQVMsRUFBRTtBQUNoQ3pjLE1BQUFBLElBQUksR0FBR2tjLE9BQU8sQ0FBQy9ZLEtBQUssQ0FBQyxDQUFBO0FBQ3JCLE1BQUEsSUFBSW5ELElBQUksQ0FBQ3dCLFVBQVUsS0FBSyxDQUFDLEVBQUU7QUFDdkIsUUFBQSxNQUFNa2IsQ0FBQyxHQUFHMWMsSUFBSSxDQUFDQSxJQUFJLENBQUE7QUFDbkIsUUFBQSxNQUFNdEMsR0FBRyxHQUFHZ2YsQ0FBQyxDQUFDL2UsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUN4QixRQUFBLEtBQUssSUFBSXlCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzFCLEdBQUcsRUFBRTBCLENBQUMsSUFBSSxDQUFDLEVBQUU7VUFDN0IsTUFBTXVkLEVBQUUsR0FBR0QsQ0FBQyxDQUFDdGQsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHc2QsQ0FBQyxDQUFDdGQsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUNyQnNkLENBQUMsQ0FBQ3RkLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBR3NkLENBQUMsQ0FBQ3RkLENBQUMsR0FBRyxDQUFDLENBQUMsR0FDbkJzZCxDQUFDLENBQUN0ZCxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdzZCxDQUFDLENBQUN0ZCxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQ25Cc2QsQ0FBQyxDQUFDdGQsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHc2QsQ0FBQyxDQUFDdGQsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO1VBRTVCLElBQUl1ZCxFQUFFLEdBQUcsQ0FBQyxFQUFFO0FBQ1JELFlBQUFBLENBQUMsQ0FBQ3RkLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUNkc2QsWUFBQUEsQ0FBQyxDQUFDdGQsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQ2RzZCxZQUFBQSxDQUFDLENBQUN0ZCxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUE7QUFDZHNkLFlBQUFBLENBQUMsQ0FBQ3RkLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUNsQixXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDQXFkLE1BQUFBLFNBQVMsR0FBR3RaLEtBQUssQ0FBQTtBQUNyQixLQUFBO0FBQ0osR0FBQTs7RUFHQSxJQUFJeVosUUFBUSxHQUFHLENBQUMsQ0FBQTtBQUNoQixFQUFBLEtBQUtoZixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdxZSxNQUFNLENBQUN0ZSxNQUFNLEVBQUVDLENBQUMsRUFBRSxFQUFFO0FBQ2hDb0MsSUFBQUEsSUFBSSxHQUFJaWMsTUFBTSxDQUFDcmUsQ0FBQyxDQUFDLENBQUNpZixLQUFLLENBQUE7SUFDdkJELFFBQVEsR0FBR3hmLElBQUksQ0FBQ0MsR0FBRyxDQUFDdWYsUUFBUSxFQUFFNWMsSUFBSSxDQUFDckMsTUFBTSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUdxQyxJQUFJLENBQUNBLElBQUksQ0FBQ3JDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2hGLEdBQUE7RUFFQSxPQUFPLElBQUltZixTQUFTLENBQ2hCdEQsYUFBYSxDQUFDemEsY0FBYyxDQUFDLE1BQU0sQ0FBQyxHQUFHeWEsYUFBYSxDQUFDM1csSUFBSSxHQUFJLFlBQVksR0FBRzRXLGNBQWUsRUFDM0ZtRCxRQUFRLEVBQ1JYLE1BQU0sRUFDTkMsT0FBTyxFQUNQQyxNQUFNLENBQUMsQ0FBQTtBQUNmLENBQUMsQ0FBQTtBQUVELE1BQU1ZLFVBQVUsR0FBRyxTQUFiQSxVQUFVLENBQWFDLFFBQVEsRUFBRUMsU0FBUyxFQUFFO0FBQzlDLEVBQUEsTUFBTUMsTUFBTSxHQUFHLElBQUlDLFNBQVMsRUFBRSxDQUFBO0FBRTlCLEVBQUEsSUFBSUgsUUFBUSxDQUFDamUsY0FBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJaWUsUUFBUSxDQUFDbmEsSUFBSSxDQUFDbEYsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUM3RHVmLElBQUFBLE1BQU0sQ0FBQ3JhLElBQUksR0FBR21hLFFBQVEsQ0FBQ25hLElBQUksQ0FBQTtBQUMvQixHQUFDLE1BQU07QUFDSHFhLElBQUFBLE1BQU0sQ0FBQ3JhLElBQUksR0FBRyxPQUFPLEdBQUdvYSxTQUFTLENBQUE7QUFDckMsR0FBQTs7QUFHQSxFQUFBLElBQUlELFFBQVEsQ0FBQ2plLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRTtJQUNuQzhLLE9BQU8sQ0FBQzdKLElBQUksQ0FBQ29DLEdBQUcsQ0FBQzRhLFFBQVEsQ0FBQ0ksTUFBTSxDQUFDLENBQUE7QUFDakN2VCxJQUFBQSxPQUFPLENBQUN3VCxjQUFjLENBQUN2VCxPQUFPLENBQUMsQ0FBQTtBQUMvQm9ULElBQUFBLE1BQU0sQ0FBQ0ksZ0JBQWdCLENBQUN4VCxPQUFPLENBQUMsQ0FBQTtBQUNoQ0QsSUFBQUEsT0FBTyxDQUFDMFQsY0FBYyxDQUFDelQsT0FBTyxDQUFDLENBQUE7QUFDL0JvVCxJQUFBQSxNQUFNLENBQUNNLG1CQUFtQixDQUFDMVQsT0FBTyxDQUFDLENBQUE7QUFDbkNELElBQUFBLE9BQU8sQ0FBQzRULFFBQVEsQ0FBQzNULE9BQU8sQ0FBQyxDQUFBO0FBQ3pCb1QsSUFBQUEsTUFBTSxDQUFDUSxhQUFhLENBQUM1VCxPQUFPLENBQUMsQ0FBQTtBQUNqQyxHQUFBO0FBRUEsRUFBQSxJQUFJa1QsUUFBUSxDQUFDamUsY0FBYyxDQUFDLFVBQVUsQ0FBQyxFQUFFO0FBQ3JDLElBQUEsTUFBTTRlLENBQUMsR0FBR1gsUUFBUSxDQUFDak8sUUFBUSxDQUFBO0lBQzNCbU8sTUFBTSxDQUFDVSxnQkFBZ0IsQ0FBQ0QsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUVBLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbkQsR0FBQTtBQUVBLEVBQUEsSUFBSVgsUUFBUSxDQUFDamUsY0FBYyxDQUFDLGFBQWEsQ0FBQyxFQUFFO0FBQ3hDLElBQUEsTUFBTThlLENBQUMsR0FBR2IsUUFBUSxDQUFDYyxXQUFXLENBQUE7QUFDOUJaLElBQUFBLE1BQU0sQ0FBQ0ksZ0JBQWdCLENBQUNPLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM3QyxHQUFBO0FBRUEsRUFBQSxJQUFJYixRQUFRLENBQUNqZSxjQUFjLENBQUMsT0FBTyxDQUFDLEVBQUU7QUFDbEMsSUFBQSxNQUFNZ2YsQ0FBQyxHQUFHZixRQUFRLENBQUNsTyxLQUFLLENBQUE7QUFDeEJvTyxJQUFBQSxNQUFNLENBQUNRLGFBQWEsQ0FBQ0ssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUVBLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzFDLEdBQUE7QUFFQSxFQUFBLE9BQU9iLE1BQU0sQ0FBQTtBQUNqQixDQUFDLENBQUE7O0FBR0QsTUFBTWMsWUFBWSxHQUFHLFNBQWZBLFlBQVksQ0FBYUMsVUFBVSxFQUFFbEQsSUFBSSxFQUFFO0VBRTdDLE1BQU1tRCxVQUFVLEdBQUdELFVBQVUsQ0FBQy9mLElBQUksS0FBSyxjQUFjLEdBQUdpZ0IsdUJBQXVCLEdBQUdDLHNCQUFzQixDQUFBO0FBQ3hHLEVBQUEsTUFBTUMsY0FBYyxHQUFHSCxVQUFVLEtBQUtDLHVCQUF1QixHQUFHRixVQUFVLENBQUNLLFlBQVksR0FBR0wsVUFBVSxDQUFDTSxXQUFXLENBQUE7QUFFaEgsRUFBQSxNQUFNQyxhQUFhLEdBQUc7QUFDbEJDLElBQUFBLE9BQU8sRUFBRSxLQUFLO0FBQ2RQLElBQUFBLFVBQVUsRUFBRUEsVUFBVTtJQUN0QlEsUUFBUSxFQUFFTCxjQUFjLENBQUNNLEtBQUs7QUFDOUJDLElBQUFBLGVBQWUsRUFBRUMsV0FBQUE7R0FDcEIsQ0FBQTtFQUVELElBQUlSLGNBQWMsQ0FBQ1MsSUFBSSxFQUFFO0FBQ3JCTixJQUFBQSxhQUFhLENBQUNPLE9BQU8sR0FBR1YsY0FBYyxDQUFDUyxJQUFJLENBQUE7QUFDL0MsR0FBQTtFQUVBLElBQUlaLFVBQVUsS0FBS0MsdUJBQXVCLEVBQUU7QUFDeENLLElBQUFBLGFBQWEsQ0FBQ1EsV0FBVyxHQUFHLEdBQUcsR0FBR1gsY0FBYyxDQUFDWSxJQUFJLENBQUE7SUFDckQsSUFBSVosY0FBYyxDQUFDWSxJQUFJLEVBQUU7TUFDckJULGFBQWEsQ0FBQ0ksZUFBZSxHQUFHTSxhQUFhLENBQUE7TUFDN0NWLGFBQWEsQ0FBQ1csV0FBVyxHQUFHZCxjQUFjLENBQUNlLElBQUksR0FBR2YsY0FBYyxDQUFDWSxJQUFJLENBQUE7QUFDekUsS0FBQTtBQUNKLEdBQUMsTUFBTTtJQUNIVCxhQUFhLENBQUNhLEdBQUcsR0FBR2hCLGNBQWMsQ0FBQ2lCLElBQUksR0FBR3RRLElBQUksQ0FBQ0MsVUFBVSxDQUFBO0lBQ3pELElBQUlvUCxjQUFjLENBQUNjLFdBQVcsRUFBRTtNQUM1QlgsYUFBYSxDQUFDSSxlQUFlLEdBQUdNLGFBQWEsQ0FBQTtBQUM3Q1YsTUFBQUEsYUFBYSxDQUFDVyxXQUFXLEdBQUdkLGNBQWMsQ0FBQ2MsV0FBVyxDQUFBO0FBQzFELEtBQUE7QUFDSixHQUFBO0VBRUEsTUFBTUksWUFBWSxHQUFHLElBQUlDLE1BQU0sQ0FBQ3ZCLFVBQVUsQ0FBQ3BiLElBQUksQ0FBQyxDQUFBO0FBQ2hEMGMsRUFBQUEsWUFBWSxDQUFDRSxZQUFZLENBQUMsUUFBUSxFQUFFakIsYUFBYSxDQUFDLENBQUE7QUFDbEQsRUFBQSxPQUFPZSxZQUFZLENBQUE7QUFDdkIsQ0FBQyxDQUFBOztBQUdELE1BQU1HLFdBQVcsR0FBRyxTQUFkQSxXQUFXLENBQWFDLFNBQVMsRUFBRTVFLElBQUksRUFBRTtBQUUzQyxFQUFBLE1BQU02RSxVQUFVLEdBQUc7QUFDZm5CLElBQUFBLE9BQU8sRUFBRSxLQUFLO0lBQ2R2Z0IsSUFBSSxFQUFFeWhCLFNBQVMsQ0FBQ3poQixJQUFJLEtBQUssT0FBTyxHQUFHLE1BQU0sR0FBR3loQixTQUFTLENBQUN6aEIsSUFBSTtBQUMxRG9SLElBQUFBLEtBQUssRUFBRXFRLFNBQVMsQ0FBQzVnQixjQUFjLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSThnQixLQUFLLENBQUNGLFNBQVMsQ0FBQ3JRLEtBQUssQ0FBQyxHQUFHdVEsS0FBSyxDQUFDQyxLQUFLO0FBR25GQyxJQUFBQSxLQUFLLEVBQUVKLFNBQVMsQ0FBQzVnQixjQUFjLENBQUMsT0FBTyxDQUFDLEdBQUc0Z0IsU0FBUyxDQUFDSSxLQUFLLEdBQUcsSUFBSTtBQUVqRUMsSUFBQUEsV0FBVyxFQUFFQywyQkFBMkI7SUFNeENDLFNBQVMsRUFBRVAsU0FBUyxDQUFDNWdCLGNBQWMsQ0FBQyxXQUFXLENBQUMsR0FBR2lRLElBQUksQ0FBQ21SLEtBQUssQ0FBQ1IsU0FBUyxDQUFDTyxTQUFTLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUE7R0FDOUYsQ0FBQTtBQUVELEVBQUEsSUFBSVAsU0FBUyxDQUFDNWdCLGNBQWMsQ0FBQyxNQUFNLENBQUMsRUFBRTtJQUNsQzZnQixVQUFVLENBQUNRLGNBQWMsR0FBR1QsU0FBUyxDQUFDVSxJQUFJLENBQUN0aEIsY0FBYyxDQUFDLGdCQUFnQixDQUFDLEdBQUc0Z0IsU0FBUyxDQUFDVSxJQUFJLENBQUNELGNBQWMsR0FBR3BSLElBQUksQ0FBQ0MsVUFBVSxHQUFHLENBQUMsQ0FBQTtJQUNqSTJRLFVBQVUsQ0FBQ1UsY0FBYyxHQUFHWCxTQUFTLENBQUNVLElBQUksQ0FBQ3RoQixjQUFjLENBQUMsZ0JBQWdCLENBQUMsR0FBRzRnQixTQUFTLENBQUNVLElBQUksQ0FBQ0MsY0FBYyxHQUFHdFIsSUFBSSxDQUFDQyxVQUFVLEdBQUc3UixJQUFJLENBQUNtakIsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUMvSSxHQUFBOztBQUlBLEVBQUEsSUFBSVosU0FBUyxDQUFDNWdCLGNBQWMsQ0FBQyxXQUFXLENBQUMsRUFBRTtJQUN2QzZnQixVQUFVLENBQUNZLFNBQVMsR0FBR2IsU0FBUyxDQUFDTyxTQUFTLEdBQUdPLEtBQUssQ0FBQ0Msc0JBQXNCLENBQUNDLFVBQVUsQ0FBQ2YsVUFBVSxDQUFDMWhCLElBQUksQ0FBQyxFQUFFMGhCLFVBQVUsQ0FBQ1UsY0FBYyxFQUFFVixVQUFVLENBQUNRLGNBQWMsQ0FBQyxDQUFBO0FBQ2hLLEdBQUE7O0VBSUEsTUFBTVEsV0FBVyxHQUFHLElBQUlwQixNQUFNLENBQUN6RSxJQUFJLENBQUNsWSxJQUFJLENBQUMsQ0FBQTtFQUN6QytkLFdBQVcsQ0FBQ0MsV0FBVyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7O0FBR2pDRCxFQUFBQSxXQUFXLENBQUNuQixZQUFZLENBQUMsT0FBTyxFQUFFRyxVQUFVLENBQUMsQ0FBQTtBQUM3QyxFQUFBLE9BQU9nQixXQUFXLENBQUE7QUFDdEIsQ0FBQyxDQUFBO0FBRUQsTUFBTUUsV0FBVyxHQUFHLFNBQWRBLFdBQVcsQ0FBYWpkLE1BQU0sRUFBRXRLLElBQUksRUFBRUMsS0FBSyxFQUFFdUUsV0FBVyxFQUFFO0FBQzVELEVBQUEsSUFBSSxDQUFDeEUsSUFBSSxDQUFDd0YsY0FBYyxDQUFDLE9BQU8sQ0FBQyxJQUFJeEYsSUFBSSxDQUFDVSxLQUFLLENBQUMwRCxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzFELElBQUEsT0FBTyxFQUFFLENBQUE7QUFDYixHQUFBOztBQUdBLEVBQUEsTUFBTW9MLFFBQVEsR0FBRyxJQUFJZ1ksR0FBRyxFQUFFLENBQUE7RUFFMUIsT0FBT3huQixJQUFJLENBQUNVLEtBQUssQ0FBQ3VVLEdBQUcsQ0FBQyxVQUFVMUYsUUFBUSxFQUFFO0FBQ3RDLElBQUEsT0FBT0QsVUFBVSxDQUFDaEYsTUFBTSxFQUFFaUYsUUFBUSxFQUFFdlAsSUFBSSxDQUFDZ04sU0FBUyxFQUFFeEksV0FBVyxFQUFFdkUsS0FBSyxFQUFFdVAsUUFBUSxDQUFDLENBQUE7QUFDckYsR0FBQyxDQUFDLENBQUE7QUFDTixDQUFDLENBQUE7QUFFRCxNQUFNaVksWUFBWSxHQUFHLFNBQWZBLFlBQVksQ0FBYW5kLE1BQU0sRUFBRXRLLElBQUksRUFBRXdFLFdBQVcsRUFBRWtNLFFBQVEsRUFBRTFGLEtBQUssRUFBRXpLLFlBQVksRUFBRUMsb0JBQW9CLEVBQUVrSyxPQUFPLEVBQUU7RUFDcEgsSUFBSSxDQUFDMUssSUFBSSxDQUFDd0YsY0FBYyxDQUFDLFFBQVEsQ0FBQyxJQUFJeEYsSUFBSSxDQUFDZ0IsTUFBTSxDQUFDb0QsTUFBTSxLQUFLLENBQUMsSUFDMUQsQ0FBQ3BFLElBQUksQ0FBQ3dGLGNBQWMsQ0FBQyxXQUFXLENBQUMsSUFBSXhGLElBQUksQ0FBQ2dOLFNBQVMsQ0FBQzVJLE1BQU0sS0FBSyxDQUFDLElBQ2hFLENBQUNwRSxJQUFJLENBQUN3RixjQUFjLENBQUMsYUFBYSxDQUFDLElBQUl4RixJQUFJLENBQUN3RSxXQUFXLENBQUNKLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDdEUsSUFBQSxPQUFPLEVBQUUsQ0FBQTtBQUNiLEdBQUE7O0VBR0EsTUFBTTZJLGdCQUFnQixHQUFHLEVBQUUsQ0FBQTtFQUUzQixPQUFPak4sSUFBSSxDQUFDZ0IsTUFBTSxDQUFDaVUsR0FBRyxDQUFDLFVBQVV4RSxRQUFRLEVBQUU7SUFDdkMsT0FBT0QsVUFBVSxDQUFDbEcsTUFBTSxFQUFFbUcsUUFBUSxFQUFFelEsSUFBSSxDQUFDZ04sU0FBUyxFQUFFeEksV0FBVyxFQUFFa00sUUFBUSxFQUFFMUYsS0FBSyxFQUFFaUMsZ0JBQWdCLEVBQUUxTSxZQUFZLEVBQUVDLG9CQUFvQixFQUFFa0ssT0FBTyxDQUFDLENBQUE7QUFDcEosR0FBQyxDQUFDLENBQUE7QUFDTixDQUFDLENBQUE7QUFFRCxNQUFNZ2QsZUFBZSxHQUFHLFNBQWxCQSxlQUFlLENBQWExbkIsSUFBSSxFQUFFSSxRQUFRLEVBQUVzSyxPQUFPLEVBQUVNLEtBQUssRUFBRTtBQUM5RCxFQUFBLElBQUksQ0FBQ2hMLElBQUksQ0FBQ3dGLGNBQWMsQ0FBQyxXQUFXLENBQUMsSUFBSXhGLElBQUksQ0FBQ0ssU0FBUyxDQUFDK0QsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUNsRSxJQUFBLE9BQU8sRUFBRSxDQUFBO0FBQ2IsR0FBQTtBQUVBLEVBQUEsTUFBTXVqQixVQUFVLEdBQUdqZCxPQUFPLElBQUlBLE9BQU8sQ0FBQ2lKLFFBQVEsSUFBSWpKLE9BQU8sQ0FBQ2lKLFFBQVEsQ0FBQ2dVLFVBQVUsQ0FBQTtBQUM3RSxFQUFBLE1BQU1DLE9BQU8sR0FBR2xkLE9BQU8sSUFBSUEsT0FBTyxDQUFDaUosUUFBUSxJQUFJakosT0FBTyxDQUFDaUosUUFBUSxDQUFDaVUsT0FBTyxJQUFJdEssY0FBYyxDQUFBO0FBQ3pGLEVBQUEsTUFBTXVLLFdBQVcsR0FBR25kLE9BQU8sSUFBSUEsT0FBTyxDQUFDaUosUUFBUSxJQUFJakosT0FBTyxDQUFDaUosUUFBUSxDQUFDa1UsV0FBVyxDQUFBO0VBRS9FLE9BQU83bkIsSUFBSSxDQUFDSyxTQUFTLENBQUM0VSxHQUFHLENBQUMsVUFBVXNJLFlBQVksRUFBRTtBQUM5QyxJQUFBLElBQUlvSyxVQUFVLEVBQUU7TUFDWkEsVUFBVSxDQUFDcEssWUFBWSxDQUFDLENBQUE7QUFDNUIsS0FBQTtJQUNBLE1BQU01SixRQUFRLEdBQUdpVSxPQUFPLENBQUNySyxZQUFZLEVBQUVuZCxRQUFRLEVBQUU0SyxLQUFLLENBQUMsQ0FBQTtBQUN2RCxJQUFBLElBQUk2YyxXQUFXLEVBQUU7QUFDYkEsTUFBQUEsV0FBVyxDQUFDdEssWUFBWSxFQUFFNUosUUFBUSxDQUFDLENBQUE7QUFDdkMsS0FBQTtBQUNBLElBQUEsT0FBT0EsUUFBUSxDQUFBO0FBQ25CLEdBQUMsQ0FBQyxDQUFBO0FBQ04sQ0FBQyxDQUFBO0FBRUQsTUFBTW1VLGNBQWMsR0FBRyxTQUFqQkEsY0FBYyxDQUFhOW5CLElBQUksRUFBRTtBQUNuQyxFQUFBLElBQUksQ0FBQ0EsSUFBSSxDQUFDd0YsY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUN4RixJQUFJLENBQUNnUixVQUFVLENBQUN4TCxjQUFjLENBQUMsd0JBQXdCLENBQUMsRUFDL0YsT0FBTyxJQUFJLENBQUE7RUFFZixNQUFNaUIsSUFBSSxHQUFHekcsSUFBSSxDQUFDZ1IsVUFBVSxDQUFDc0Msc0JBQXNCLENBQUNoVCxRQUFRLENBQUE7RUFDNUQsTUFBTUEsUUFBUSxHQUFHLEVBQUUsQ0FBQTtBQUNuQixFQUFBLEtBQUssSUFBSStELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR29DLElBQUksQ0FBQ3JDLE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7SUFDbEMvRCxRQUFRLENBQUNtRyxJQUFJLENBQUNwQyxDQUFDLENBQUMsQ0FBQ2lGLElBQUksQ0FBQyxHQUFHakYsQ0FBQyxDQUFBO0FBQzlCLEdBQUE7QUFDQSxFQUFBLE9BQU8vRCxRQUFRLENBQUE7QUFDbkIsQ0FBQyxDQUFBO0FBRUQsTUFBTXluQixnQkFBZ0IsR0FBRyxTQUFuQkEsZ0JBQWdCLENBQWEvbkIsSUFBSSxFQUFFQyxLQUFLLEVBQUV1RSxXQUFXLEVBQUVrRyxPQUFPLEVBQUU7QUFDbEUsRUFBQSxJQUFJLENBQUMxSyxJQUFJLENBQUN3RixjQUFjLENBQUMsWUFBWSxDQUFDLElBQUl4RixJQUFJLENBQUNHLFVBQVUsQ0FBQ2lFLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDcEUsSUFBQSxPQUFPLEVBQUUsQ0FBQTtBQUNiLEdBQUE7QUFFQSxFQUFBLE1BQU11akIsVUFBVSxHQUFHamQsT0FBTyxJQUFJQSxPQUFPLENBQUNzZCxTQUFTLElBQUl0ZCxPQUFPLENBQUNzZCxTQUFTLENBQUNMLFVBQVUsQ0FBQTtBQUMvRSxFQUFBLE1BQU1FLFdBQVcsR0FBR25kLE9BQU8sSUFBSUEsT0FBTyxDQUFDc2QsU0FBUyxJQUFJdGQsT0FBTyxDQUFDc2QsU0FBUyxDQUFDSCxXQUFXLENBQUE7RUFFakYsT0FBTzduQixJQUFJLENBQUNHLFVBQVUsQ0FBQzhVLEdBQUcsQ0FBQyxVQUFVZ0wsYUFBYSxFQUFFclcsS0FBSyxFQUFFO0FBQ3ZELElBQUEsSUFBSStkLFVBQVUsRUFBRTtNQUNaQSxVQUFVLENBQUMxSCxhQUFhLENBQUMsQ0FBQTtBQUM3QixLQUFBO0FBQ0EsSUFBQSxNQUFNK0gsU0FBUyxHQUFHaEksZUFBZSxDQUFDQyxhQUFhLEVBQUVyVyxLQUFLLEVBQUU1SixJQUFJLENBQUNnTixTQUFTLEVBQUV4SSxXQUFXLEVBQUV2RSxLQUFLLEVBQUVELElBQUksQ0FBQ2dCLE1BQU0sQ0FBQyxDQUFBO0FBQ3hHLElBQUEsSUFBSTZtQixXQUFXLEVBQUU7QUFDYkEsTUFBQUEsV0FBVyxDQUFDNUgsYUFBYSxFQUFFK0gsU0FBUyxDQUFDLENBQUE7QUFDekMsS0FBQTtBQUNBLElBQUEsT0FBT0EsU0FBUyxDQUFBO0FBQ3BCLEdBQUMsQ0FBQyxDQUFBO0FBQ04sQ0FBQyxDQUFBO0FBRUQsTUFBTUMsV0FBVyxHQUFHLFNBQWRBLFdBQVcsQ0FBYWpvQixJQUFJLEVBQUUwSyxPQUFPLEVBQUU7QUFDekMsRUFBQSxJQUFJLENBQUMxSyxJQUFJLENBQUN3RixjQUFjLENBQUMsT0FBTyxDQUFDLElBQUl4RixJQUFJLENBQUNDLEtBQUssQ0FBQ21FLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDMUQsSUFBQSxPQUFPLEVBQUUsQ0FBQTtBQUNiLEdBQUE7QUFFQSxFQUFBLE1BQU11akIsVUFBVSxHQUFHamQsT0FBTyxJQUFJQSxPQUFPLENBQUM4VyxJQUFJLElBQUk5VyxPQUFPLENBQUM4VyxJQUFJLENBQUNtRyxVQUFVLENBQUE7QUFDckUsRUFBQSxNQUFNQyxPQUFPLEdBQUdsZCxPQUFPLElBQUlBLE9BQU8sQ0FBQzhXLElBQUksSUFBSTlXLE9BQU8sQ0FBQzhXLElBQUksQ0FBQ29HLE9BQU8sSUFBSXBFLFVBQVUsQ0FBQTtBQUM3RSxFQUFBLE1BQU1xRSxXQUFXLEdBQUduZCxPQUFPLElBQUlBLE9BQU8sQ0FBQzhXLElBQUksSUFBSTlXLE9BQU8sQ0FBQzhXLElBQUksQ0FBQ3FHLFdBQVcsQ0FBQTtBQUV2RSxFQUFBLE1BQU01bkIsS0FBSyxHQUFHRCxJQUFJLENBQUNDLEtBQUssQ0FBQ2dWLEdBQUcsQ0FBQyxVQUFVd08sUUFBUSxFQUFFN1osS0FBSyxFQUFFO0FBQ3BELElBQUEsSUFBSStkLFVBQVUsRUFBRTtNQUNaQSxVQUFVLENBQUNsRSxRQUFRLENBQUMsQ0FBQTtBQUN4QixLQUFBO0FBQ0EsSUFBQSxNQUFNakMsSUFBSSxHQUFHb0csT0FBTyxDQUFDbkUsUUFBUSxFQUFFN1osS0FBSyxDQUFDLENBQUE7QUFDckMsSUFBQSxJQUFJaWUsV0FBVyxFQUFFO0FBQ2JBLE1BQUFBLFdBQVcsQ0FBQ3BFLFFBQVEsRUFBRWpDLElBQUksQ0FBQyxDQUFBO0FBQy9CLEtBQUE7QUFDQSxJQUFBLE9BQU9BLElBQUksQ0FBQTtBQUNmLEdBQUMsQ0FBQyxDQUFBOztBQUdGLEVBQUEsS0FBSyxJQUFJbmQsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHckUsSUFBSSxDQUFDQyxLQUFLLENBQUNtRSxNQUFNLEVBQUUsRUFBRUMsQ0FBQyxFQUFFO0FBQ3hDLElBQUEsTUFBTW9mLFFBQVEsR0FBR3pqQixJQUFJLENBQUNDLEtBQUssQ0FBQ29FLENBQUMsQ0FBQyxDQUFBO0FBQzlCLElBQUEsSUFBSW9mLFFBQVEsQ0FBQ2plLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtBQUNyQyxNQUFBLE1BQU1tYyxNQUFNLEdBQUcxaEIsS0FBSyxDQUFDb0UsQ0FBQyxDQUFDLENBQUE7TUFDdkIsTUFBTTZqQixXQUFXLEdBQUcsRUFBRyxDQUFBO0FBQ3ZCLE1BQUEsS0FBSyxJQUFJcmlCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzRkLFFBQVEsQ0FBQzBFLFFBQVEsQ0FBQy9qQixNQUFNLEVBQUUsRUFBRXlCLENBQUMsRUFBRTtRQUMvQyxNQUFNdWlCLEtBQUssR0FBR25vQixLQUFLLENBQUN3akIsUUFBUSxDQUFDMEUsUUFBUSxDQUFDdGlCLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDekMsUUFBQSxJQUFJLENBQUN1aUIsS0FBSyxDQUFDekcsTUFBTSxFQUFFO1VBQ2YsSUFBSXVHLFdBQVcsQ0FBQzFpQixjQUFjLENBQUM0aUIsS0FBSyxDQUFDOWUsSUFBSSxDQUFDLEVBQUU7WUFDeEM4ZSxLQUFLLENBQUM5ZSxJQUFJLElBQUk0ZSxXQUFXLENBQUNFLEtBQUssQ0FBQzllLElBQUksQ0FBQyxFQUFFLENBQUE7QUFDM0MsV0FBQyxNQUFNO0FBQ0g0ZSxZQUFBQSxXQUFXLENBQUNFLEtBQUssQ0FBQzllLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUMvQixXQUFBO0FBQ0FxWSxVQUFBQSxNQUFNLENBQUMwRyxRQUFRLENBQUNELEtBQUssQ0FBQyxDQUFBO0FBQzFCLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLE9BQU9ub0IsS0FBSyxDQUFBO0FBQ2hCLENBQUMsQ0FBQTtBQUVELE1BQU1xb0IsWUFBWSxHQUFHLFNBQWZBLFlBQVksQ0FBYXRvQixJQUFJLEVBQUVDLEtBQUssRUFBRTtBQUFBLEVBQUEsSUFBQSxvQkFBQSxDQUFBO0VBQ3hDLE1BQU1DLE1BQU0sR0FBRyxFQUFFLENBQUE7QUFDakIsRUFBQSxNQUFNK0UsS0FBSyxHQUFHakYsSUFBSSxDQUFDRSxNQUFNLENBQUNrRSxNQUFNLENBQUE7O0FBR2hDLEVBQUEsSUFBSWEsS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFBakYsQ0FBQUEsb0JBQUFBLEdBQUFBLElBQUksQ0FBQ0UsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDRCxLQUFLLEtBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUFwQixxQkFBc0JtRSxNQUFNLE1BQUssQ0FBQyxFQUFFO0FBQ25ELElBQUEsTUFBTXNmLFNBQVMsR0FBRzFqQixJQUFJLENBQUNFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQ0QsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3pDQyxJQUFBQSxNQUFNLENBQUNxSixJQUFJLENBQUN0SixLQUFLLENBQUN5akIsU0FBUyxDQUFDLENBQUMsQ0FBQTtBQUNqQyxHQUFDLE1BQU07SUFHSCxLQUFLLElBQUlyZixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdZLEtBQUssRUFBRVosQ0FBQyxFQUFFLEVBQUU7QUFDNUIsTUFBQSxNQUFNa2tCLEtBQUssR0FBR3ZvQixJQUFJLENBQUNFLE1BQU0sQ0FBQ21FLENBQUMsQ0FBQyxDQUFBO01BQzVCLElBQUlra0IsS0FBSyxDQUFDdG9CLEtBQUssRUFBRTtRQUNiLE1BQU11b0IsU0FBUyxHQUFHLElBQUk1RSxTQUFTLENBQUMyRSxLQUFLLENBQUNqZixJQUFJLENBQUMsQ0FBQTtBQUMzQyxRQUFBLEtBQUssSUFBSW1mLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0YsS0FBSyxDQUFDdG9CLEtBQUssQ0FBQ21FLE1BQU0sRUFBRXFrQixDQUFDLEVBQUUsRUFBRTtVQUN6QyxNQUFNQyxTQUFTLEdBQUd6b0IsS0FBSyxDQUFDc29CLEtBQUssQ0FBQ3RvQixLQUFLLENBQUN3b0IsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN2Q0QsVUFBQUEsU0FBUyxDQUFDSCxRQUFRLENBQUNLLFNBQVMsQ0FBQyxDQUFBO0FBQ2pDLFNBQUE7QUFDQXhvQixRQUFBQSxNQUFNLENBQUNxSixJQUFJLENBQUNpZixTQUFTLENBQUMsQ0FBQTtBQUMxQixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLE9BQU90b0IsTUFBTSxDQUFBO0FBQ2pCLENBQUMsQ0FBQTtBQUVELE1BQU15b0IsYUFBYSxHQUFHLFNBQWhCQSxhQUFhLENBQWEzb0IsSUFBSSxFQUFFQyxLQUFLLEVBQUV5SyxPQUFPLEVBQUU7RUFFbEQsSUFBSTlKLE9BQU8sR0FBRyxJQUFJLENBQUE7RUFFbEIsSUFBSVosSUFBSSxDQUFDd0YsY0FBYyxDQUFDLE9BQU8sQ0FBQyxJQUFJeEYsSUFBSSxDQUFDd0YsY0FBYyxDQUFDLFNBQVMsQ0FBQyxJQUFJeEYsSUFBSSxDQUFDWSxPQUFPLENBQUN3RCxNQUFNLEdBQUcsQ0FBQyxFQUFFO0FBRTNGLElBQUEsTUFBTXVqQixVQUFVLEdBQUdqZCxPQUFPLElBQUlBLE9BQU8sQ0FBQ2tlLE1BQU0sSUFBSWxlLE9BQU8sQ0FBQ2tlLE1BQU0sQ0FBQ2pCLFVBQVUsQ0FBQTtBQUN6RSxJQUFBLE1BQU1DLE9BQU8sR0FBR2xkLE9BQU8sSUFBSUEsT0FBTyxDQUFDa2UsTUFBTSxJQUFJbGUsT0FBTyxDQUFDa2UsTUFBTSxDQUFDaEIsT0FBTyxJQUFJbkQsWUFBWSxDQUFBO0FBQ25GLElBQUEsTUFBTW9ELFdBQVcsR0FBR25kLE9BQU8sSUFBSUEsT0FBTyxDQUFDa2UsTUFBTSxJQUFJbGUsT0FBTyxDQUFDa2UsTUFBTSxDQUFDZixXQUFXLENBQUE7SUFFM0U3bkIsSUFBSSxDQUFDQyxLQUFLLENBQUNhLE9BQU8sQ0FBQyxVQUFVMmlCLFFBQVEsRUFBRUMsU0FBUyxFQUFFO0FBQzlDLE1BQUEsSUFBSUQsUUFBUSxDQUFDamUsY0FBYyxDQUFDLFFBQVEsQ0FBQyxFQUFFO1FBQ25DLE1BQU1rZixVQUFVLEdBQUcxa0IsSUFBSSxDQUFDWSxPQUFPLENBQUM2aUIsUUFBUSxDQUFDbUYsTUFBTSxDQUFDLENBQUE7QUFDaEQsUUFBQSxJQUFJbEUsVUFBVSxFQUFFO0FBQ1osVUFBQSxJQUFJaUQsVUFBVSxFQUFFO1lBQ1pBLFVBQVUsQ0FBQ2pELFVBQVUsQ0FBQyxDQUFBO0FBQzFCLFdBQUE7VUFDQSxNQUFNa0UsTUFBTSxHQUFHaEIsT0FBTyxDQUFDbEQsVUFBVSxFQUFFemtCLEtBQUssQ0FBQ3lqQixTQUFTLENBQUMsQ0FBQyxDQUFBO0FBQ3BELFVBQUEsSUFBSW1FLFdBQVcsRUFBRTtBQUNiQSxZQUFBQSxXQUFXLENBQUNuRCxVQUFVLEVBQUVrRSxNQUFNLENBQUMsQ0FBQTtBQUNuQyxXQUFBOztBQUdBLFVBQUEsSUFBSUEsTUFBTSxFQUFFO0FBQ1IsWUFBQSxJQUFJLENBQUNob0IsT0FBTyxFQUFFQSxPQUFPLEdBQUcsSUFBSTRtQixHQUFHLEVBQUUsQ0FBQTtBQUNqQzVtQixZQUFBQSxPQUFPLENBQUNpSSxHQUFHLENBQUM0YSxRQUFRLEVBQUVtRixNQUFNLENBQUMsQ0FBQTtBQUNqQyxXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7QUFFQSxFQUFBLE9BQU9ob0IsT0FBTyxDQUFBO0FBQ2xCLENBQUMsQ0FBQTtBQUVELE1BQU1pb0IsWUFBWSxHQUFHLFNBQWZBLFlBQVksQ0FBYTdvQixJQUFJLEVBQUVDLEtBQUssRUFBRXlLLE9BQU8sRUFBRTtFQUVqRCxJQUFJL0osTUFBTSxHQUFHLElBQUksQ0FBQTtBQUVqQixFQUFBLElBQUlYLElBQUksQ0FBQ3dGLGNBQWMsQ0FBQyxPQUFPLENBQUMsSUFBSXhGLElBQUksQ0FBQ3dGLGNBQWMsQ0FBQyxZQUFZLENBQUMsSUFDakV4RixJQUFJLENBQUNnUixVQUFVLENBQUN4TCxjQUFjLENBQUMscUJBQXFCLENBQUMsSUFBSXhGLElBQUksQ0FBQ2dSLFVBQVUsQ0FBQzhYLG1CQUFtQixDQUFDdGpCLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRTtJQUV2SCxNQUFNdWpCLFVBQVUsR0FBRy9vQixJQUFJLENBQUNnUixVQUFVLENBQUM4WCxtQkFBbUIsQ0FBQ25vQixNQUFNLENBQUE7SUFDN0QsSUFBSW9vQixVQUFVLENBQUMza0IsTUFBTSxFQUFFO0FBRW5CLE1BQUEsTUFBTXVqQixVQUFVLEdBQUdqZCxPQUFPLElBQUlBLE9BQU8sQ0FBQ3NlLEtBQUssSUFBSXRlLE9BQU8sQ0FBQ3NlLEtBQUssQ0FBQ3JCLFVBQVUsQ0FBQTtBQUN2RSxNQUFBLE1BQU1DLE9BQU8sR0FBR2xkLE9BQU8sSUFBSUEsT0FBTyxDQUFDc2UsS0FBSyxJQUFJdGUsT0FBTyxDQUFDc2UsS0FBSyxDQUFDcEIsT0FBTyxJQUFJekIsV0FBVyxDQUFBO0FBQ2hGLE1BQUEsTUFBTTBCLFdBQVcsR0FBR25kLE9BQU8sSUFBSUEsT0FBTyxDQUFDc2UsS0FBSyxJQUFJdGUsT0FBTyxDQUFDc2UsS0FBSyxDQUFDbkIsV0FBVyxDQUFBOztNQUd6RTduQixJQUFJLENBQUNDLEtBQUssQ0FBQ2EsT0FBTyxDQUFDLFVBQVUyaUIsUUFBUSxFQUFFQyxTQUFTLEVBQUU7UUFDOUMsSUFBSUQsUUFBUSxDQUFDamUsY0FBYyxDQUFDLFlBQVksQ0FBQyxJQUNyQ2llLFFBQVEsQ0FBQ3pTLFVBQVUsQ0FBQ3hMLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQyxJQUN6RGllLFFBQVEsQ0FBQ3pTLFVBQVUsQ0FBQzhYLG1CQUFtQixDQUFDdGpCLGNBQWMsQ0FBQyxPQUFPLENBQUMsRUFBRTtVQUVqRSxNQUFNeWpCLFVBQVUsR0FBR3hGLFFBQVEsQ0FBQ3pTLFVBQVUsQ0FBQzhYLG1CQUFtQixDQUFDRSxLQUFLLENBQUE7QUFDaEUsVUFBQSxNQUFNNUMsU0FBUyxHQUFHMkMsVUFBVSxDQUFDRSxVQUFVLENBQUMsQ0FBQTtBQUN4QyxVQUFBLElBQUk3QyxTQUFTLEVBQUU7QUFDWCxZQUFBLElBQUl1QixVQUFVLEVBQUU7Y0FDWkEsVUFBVSxDQUFDdkIsU0FBUyxDQUFDLENBQUE7QUFDekIsYUFBQTtZQUNBLE1BQU00QyxLQUFLLEdBQUdwQixPQUFPLENBQUN4QixTQUFTLEVBQUVubUIsS0FBSyxDQUFDeWpCLFNBQVMsQ0FBQyxDQUFDLENBQUE7QUFDbEQsWUFBQSxJQUFJbUUsV0FBVyxFQUFFO0FBQ2JBLGNBQUFBLFdBQVcsQ0FBQ3pCLFNBQVMsRUFBRTRDLEtBQUssQ0FBQyxDQUFBO0FBQ2pDLGFBQUE7O0FBR0EsWUFBQSxJQUFJQSxLQUFLLEVBQUU7QUFDUCxjQUFBLElBQUksQ0FBQ3JvQixNQUFNLEVBQUVBLE1BQU0sR0FBRyxJQUFJNm1CLEdBQUcsRUFBRSxDQUFBO0FBQy9CN21CLGNBQUFBLE1BQU0sQ0FBQ2tJLEdBQUcsQ0FBQzRhLFFBQVEsRUFBRXVGLEtBQUssQ0FBQyxDQUFBO0FBQy9CLGFBQUE7QUFDSixXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLE9BQU9yb0IsTUFBTSxDQUFBO0FBQ2pCLENBQUMsQ0FBQTs7QUFHRCxNQUFNdW9CLFNBQVMsR0FBRyxTQUFaQSxTQUFTLENBQWFscEIsSUFBSSxFQUFFUyxPQUFPLEVBQUVDLEtBQUssRUFBRTtBQUM5Q1YsRUFBQUEsSUFBSSxDQUFDQyxLQUFLLENBQUNhLE9BQU8sQ0FBRTJpQixRQUFRLElBQUs7QUFDN0IsSUFBQSxJQUFJQSxRQUFRLENBQUNqZSxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUlpZSxRQUFRLENBQUNqZSxjQUFjLENBQUMsTUFBTSxDQUFDLEVBQUU7TUFDcEUsTUFBTTJqQixTQUFTLEdBQUcxb0IsT0FBTyxDQUFDZ2pCLFFBQVEsQ0FBQzlRLElBQUksQ0FBQyxDQUFDM1IsTUFBTSxDQUFBO0FBQy9DbW9CLE1BQUFBLFNBQVMsQ0FBQ3JvQixPQUFPLENBQUU2UixJQUFJLElBQUs7UUFDeEJBLElBQUksQ0FBQ3hDLElBQUksR0FBR3pQLEtBQUssQ0FBQytpQixRQUFRLENBQUN0VCxJQUFJLENBQUMsQ0FBQTtBQUNwQyxPQUFDLENBQUMsQ0FBQTtBQUNOLEtBQUE7QUFDSixHQUFDLENBQUMsQ0FBQTtBQUNOLENBQUMsQ0FBQTs7QUFHRCxNQUFNaVosZUFBZSxHQUFHLFNBQWxCQSxlQUFlLENBQWE5ZSxNQUFNLEVBQUV0SyxJQUFJLEVBQUV3RSxXQUFXLEVBQUU2a0IsYUFBYSxFQUFFM2UsT0FBTyxFQUFFZ0csUUFBUSxFQUFFO0FBQzNGLEVBQUEsTUFBTWlYLFVBQVUsR0FBR2pkLE9BQU8sSUFBSUEsT0FBTyxDQUFDNGUsTUFBTSxJQUFJNWUsT0FBTyxDQUFDNGUsTUFBTSxDQUFDM0IsVUFBVSxDQUFBO0FBQ3pFLEVBQUEsTUFBTUUsV0FBVyxHQUFHbmQsT0FBTyxJQUFJQSxPQUFPLENBQUM0ZSxNQUFNLElBQUk1ZSxPQUFPLENBQUM0ZSxNQUFNLENBQUN6QixXQUFXLENBQUE7QUFFM0UsRUFBQSxJQUFJRixVQUFVLEVBQUU7SUFDWkEsVUFBVSxDQUFDM25CLElBQUksQ0FBQyxDQUFBO0FBQ3BCLEdBQUE7O0FBS0EsRUFBQSxNQUFNZ0wsS0FBSyxHQUFHaEwsSUFBSSxDQUFDdXBCLEtBQUssSUFBSXZwQixJQUFJLENBQUN1cEIsS0FBSyxDQUFDQyxTQUFTLEtBQUssWUFBWSxDQUFBOztBQUdqRSxFQUFBLElBQUl4ZSxLQUFLLEVBQUU7QUFDUHlILElBQUFBLEtBQUssQ0FBQ0MsSUFBSSxDQUFDLG9EQUFvRCxDQUFDLENBQUE7QUFDcEUsR0FBQTtBQUVBLEVBQUEsTUFBTXpTLEtBQUssR0FBR2dvQixXQUFXLENBQUNqb0IsSUFBSSxFQUFFMEssT0FBTyxDQUFDLENBQUE7QUFDeEMsRUFBQSxNQUFNeEssTUFBTSxHQUFHb29CLFlBQVksQ0FBQ3RvQixJQUFJLEVBQUVDLEtBQUssQ0FBQyxDQUFBO0VBQ3hDLE1BQU1VLE1BQU0sR0FBR2tvQixZQUFZLENBQUM3b0IsSUFBSSxFQUFFQyxLQUFLLEVBQUV5SyxPQUFPLENBQUMsQ0FBQTtFQUNqRCxNQUFNOUosT0FBTyxHQUFHK25CLGFBQWEsQ0FBQzNvQixJQUFJLEVBQUVDLEtBQUssRUFBRXlLLE9BQU8sQ0FBQyxDQUFBO0VBQ25ELE1BQU12SyxVQUFVLEdBQUc0bkIsZ0JBQWdCLENBQUMvbkIsSUFBSSxFQUFFQyxLQUFLLEVBQUV1RSxXQUFXLEVBQUVrRyxPQUFPLENBQUMsQ0FBQTtBQUN0RSxFQUFBLE1BQU1ySyxTQUFTLEdBQUdxbkIsZUFBZSxDQUFDMW5CLElBQUksRUFBRXFwQixhQUFhLENBQUNwVSxHQUFHLENBQUMsVUFBVXdVLFlBQVksRUFBRTtJQUM5RSxPQUFPQSxZQUFZLENBQUM3ZSxRQUFRLENBQUE7QUFDaEMsR0FBQyxDQUFDLEVBQUVGLE9BQU8sRUFBRU0sS0FBSyxDQUFDLENBQUE7QUFDbkIsRUFBQSxNQUFNMUssUUFBUSxHQUFHd25CLGNBQWMsQ0FBQzluQixJQUFJLENBQUMsQ0FBQTtFQUNyQyxNQUFNTyxZQUFZLEdBQUcsRUFBRSxDQUFBO0VBQ3ZCLE1BQU1DLG9CQUFvQixHQUFHLEVBQUUsQ0FBQTtBQUMvQixFQUFBLE1BQU1RLE1BQU0sR0FBR3ltQixZQUFZLENBQUNuZCxNQUFNLEVBQUV0SyxJQUFJLEVBQUV3RSxXQUFXLEVBQUVrTSxRQUFRLEVBQUUxRixLQUFLLEVBQUV6SyxZQUFZLEVBQUVDLG9CQUFvQixFQUFFa0ssT0FBTyxDQUFDLENBQUE7RUFDcEgsTUFBTWhLLEtBQUssR0FBRzZtQixXQUFXLENBQUNqZCxNQUFNLEVBQUV0SyxJQUFJLEVBQUVDLEtBQUssRUFBRXVFLFdBQVcsQ0FBQyxDQUFBOztFQUczRCxNQUFNL0QsT0FBTyxHQUFHLEVBQUUsQ0FBQTtBQUNsQixFQUFBLEtBQUssSUFBSTRELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3JELE1BQU0sQ0FBQ29ELE1BQU0sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7QUFDcEM1RCxJQUFBQSxPQUFPLENBQUM0RCxDQUFDLENBQUMsR0FBRyxJQUFJcWxCLE1BQU0sRUFBRSxDQUFBO0lBQ3pCanBCLE9BQU8sQ0FBQzRELENBQUMsQ0FBQyxDQUFDckQsTUFBTSxHQUFHQSxNQUFNLENBQUNxRCxDQUFDLENBQUMsQ0FBQTtBQUNqQyxHQUFBOztBQUdBNmtCLEVBQUFBLFNBQVMsQ0FBQ2xwQixJQUFJLEVBQUVTLE9BQU8sRUFBRUMsS0FBSyxDQUFDLENBQUE7QUFFL0IsRUFBQSxNQUFNb0UsTUFBTSxHQUFHLElBQUloRixZQUFZLENBQUNFLElBQUksQ0FBQyxDQUFBO0VBQ3JDOEUsTUFBTSxDQUFDN0UsS0FBSyxHQUFHQSxLQUFLLENBQUE7RUFDcEI2RSxNQUFNLENBQUM1RSxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtFQUN0QjRFLE1BQU0sQ0FBQzNFLFVBQVUsR0FBR0EsVUFBVSxDQUFBO0VBQzlCMkUsTUFBTSxDQUFDMUUsUUFBUSxHQUFHaXBCLGFBQWEsQ0FBQTtFQUMvQnZrQixNQUFNLENBQUN6RSxTQUFTLEdBQUdBLFNBQVMsQ0FBQTtFQUM1QnlFLE1BQU0sQ0FBQ3hFLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0VBQzFCd0UsTUFBTSxDQUFDdkUsWUFBWSxHQUFHQSxZQUFZLENBQUE7RUFDbEN1RSxNQUFNLENBQUN0RSxvQkFBb0IsR0FBR0Esb0JBQW9CLENBQUE7RUFDbERzRSxNQUFNLENBQUNyRSxPQUFPLEdBQUdBLE9BQU8sQ0FBQTtFQUN4QnFFLE1BQU0sQ0FBQ3BFLEtBQUssR0FBR0EsS0FBSyxDQUFBO0VBQ3BCb0UsTUFBTSxDQUFDbkUsTUFBTSxHQUFHQSxNQUFNLENBQUE7RUFDdEJtRSxNQUFNLENBQUNsRSxPQUFPLEdBQUdBLE9BQU8sQ0FBQTtBQUV4QixFQUFBLElBQUlpbkIsV0FBVyxFQUFFO0FBQ2JBLElBQUFBLFdBQVcsQ0FBQzduQixJQUFJLEVBQUU4RSxNQUFNLENBQUMsQ0FBQTtBQUM3QixHQUFBO0FBRUE0TCxFQUFBQSxRQUFRLENBQUMsSUFBSSxFQUFFNUwsTUFBTSxDQUFDLENBQUE7QUFDMUIsQ0FBQyxDQUFBO0FBRUQsTUFBTTZrQixZQUFZLEdBQUcsU0FBZkEsWUFBWSxDQUFhN2YsT0FBTyxFQUFFOGYsV0FBVyxFQUFFO0VBQ2pELE1BQU1DLFNBQVMsR0FBRyxTQUFaQSxTQUFTLENBQWFDLE1BQU0sRUFBRUMsWUFBWSxFQUFFO0FBQzlDLElBQUEsUUFBUUQsTUFBTTtBQUNWLE1BQUEsS0FBSyxJQUFJO0FBQUUsUUFBQSxPQUFPRSxjQUFjLENBQUE7QUFDaEMsTUFBQSxLQUFLLElBQUk7QUFBRSxRQUFBLE9BQU9DLGFBQWEsQ0FBQTtBQUMvQixNQUFBLEtBQUssSUFBSTtBQUFFLFFBQUEsT0FBT0MsNkJBQTZCLENBQUE7QUFDL0MsTUFBQSxLQUFLLElBQUk7QUFBRSxRQUFBLE9BQU9DLDRCQUE0QixDQUFBO0FBQzlDLE1BQUEsS0FBSyxJQUFJO0FBQUUsUUFBQSxPQUFPQyw0QkFBNEIsQ0FBQTtBQUM5QyxNQUFBLEtBQUssSUFBSTtBQUFFLFFBQUEsT0FBT0MsMkJBQTJCLENBQUE7QUFDN0MsTUFBQTtBQUFXLFFBQUEsT0FBT04sWUFBWSxDQUFBO0FBQUMsS0FBQTtHQUV0QyxDQUFBO0VBRUQsTUFBTU8sT0FBTyxHQUFHLFNBQVZBLE9BQU8sQ0FBYUMsSUFBSSxFQUFFUixZQUFZLEVBQUU7QUFDMUMsSUFBQSxRQUFRUSxJQUFJO0FBQ1IsTUFBQSxLQUFLLEtBQUs7QUFBRSxRQUFBLE9BQU9DLHFCQUFxQixDQUFBO0FBQ3hDLE1BQUEsS0FBSyxLQUFLO0FBQUUsUUFBQSxPQUFPQyx1QkFBdUIsQ0FBQTtBQUMxQyxNQUFBLEtBQUssS0FBSztBQUFFLFFBQUEsT0FBT0MsY0FBYyxDQUFBO0FBQ2pDLE1BQUE7QUFBWSxRQUFBLE9BQU9YLFlBQVksQ0FBQTtBQUFDLEtBQUE7R0FFdkMsQ0FBQTtBQUVELEVBQUEsSUFBSWpnQixPQUFPLEVBQUU7QUFDVDhmLElBQUFBLFdBQVcsR0FBR0EsV0FBVyxJQUFJLEVBQUcsQ0FBQTtJQUNoQzlmLE9BQU8sQ0FBQzZnQixTQUFTLEdBQUdkLFNBQVMsQ0FBQ0QsV0FBVyxDQUFDZSxTQUFTLEVBQUVOLDJCQUEyQixDQUFDLENBQUE7SUFDakZ2Z0IsT0FBTyxDQUFDOGdCLFNBQVMsR0FBR2YsU0FBUyxDQUFDRCxXQUFXLENBQUNnQixTQUFTLEVBQUVYLGFBQWEsQ0FBQyxDQUFBO0lBQ25FbmdCLE9BQU8sQ0FBQytnQixRQUFRLEdBQUdQLE9BQU8sQ0FBQ1YsV0FBVyxDQUFDa0IsS0FBSyxFQUFFSixjQUFjLENBQUMsQ0FBQTtJQUM3RDVnQixPQUFPLENBQUNpaEIsUUFBUSxHQUFHVCxPQUFPLENBQUNWLFdBQVcsQ0FBQ29CLEtBQUssRUFBRU4sY0FBYyxDQUFDLENBQUE7QUFDakUsR0FBQTtBQUNKLENBQUMsQ0FBQTtBQUVELElBQUlPLG1CQUFtQixHQUFHLENBQUMsQ0FBQTs7QUFHM0IsTUFBTUMsY0FBYyxHQUFHLFNBQWpCQSxjQUFjLENBQWFDLFNBQVMsRUFBRXZoQixLQUFLLEVBQUVwRixXQUFXLEVBQUU0bUIsT0FBTyxFQUFFdmdCLFFBQVEsRUFBRUgsT0FBTyxFQUFFZ0csUUFBUSxFQUFFO0FBQ2xHLEVBQUEsTUFBTWlYLFVBQVUsR0FBR2pkLE9BQU8sSUFBSUEsT0FBTyxDQUFDMmdCLEtBQUssSUFBSTNnQixPQUFPLENBQUMyZ0IsS0FBSyxDQUFDMUQsVUFBVSxDQUFBO0FBQ3ZFLEVBQUEsTUFBTTJELFlBQVksR0FBSTVnQixPQUFPLElBQUlBLE9BQU8sQ0FBQzJnQixLQUFLLElBQUkzZ0IsT0FBTyxDQUFDMmdCLEtBQUssQ0FBQ0MsWUFBWSxJQUFLLFVBQVVILFNBQVMsRUFBRXphLFFBQVEsRUFBRTtBQUM1R0EsSUFBQUEsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtHQUN2QixDQUFBO0FBQ0QsRUFBQSxNQUFNbVgsV0FBVyxHQUFHbmQsT0FBTyxJQUFJQSxPQUFPLENBQUMyZ0IsS0FBSyxJQUFJM2dCLE9BQU8sQ0FBQzJnQixLQUFLLENBQUN4RCxXQUFXLENBQUE7QUFFekUsRUFBQSxNQUFNMEQsTUFBTSxHQUFHLFNBQVRBLE1BQU0sQ0FBYTlCLFlBQVksRUFBRTtBQUNuQyxJQUFBLElBQUk1QixXQUFXLEVBQUU7QUFDYkEsTUFBQUEsV0FBVyxDQUFDc0QsU0FBUyxFQUFFMUIsWUFBWSxDQUFDLENBQUE7QUFDeEMsS0FBQTtBQUNBL1ksSUFBQUEsUUFBUSxDQUFDLElBQUksRUFBRStZLFlBQVksQ0FBQyxDQUFBO0dBQy9CLENBQUE7QUFFRCxFQUFBLE1BQU0rQixzQkFBc0IsR0FBRztBQUMzQixJQUFBLFdBQVcsRUFBRSxLQUFLO0FBQ2xCLElBQUEsWUFBWSxFQUFFLEtBQUs7QUFDbkIsSUFBQSxhQUFhLEVBQUUsT0FBTztBQUN0QixJQUFBLFdBQVcsRUFBRSxLQUFLO0FBQ2xCLElBQUEsWUFBWSxFQUFFLE1BQU07QUFDcEIsSUFBQSxrQkFBa0IsRUFBRSxLQUFBO0dBQ3ZCLENBQUE7QUFFRCxFQUFBLE1BQU1DLFdBQVcsR0FBRyxTQUFkQSxXQUFXLENBQWFDLEdBQUcsRUFBRTdtQixVQUFVLEVBQUU4bUIsUUFBUSxFQUFFamhCLE9BQU8sRUFBRTtBQUM5RCxJQUFBLE1BQU1wQixJQUFJLEdBQUcsQ0FBQzZoQixTQUFTLENBQUM3aEIsSUFBSSxJQUFJLGNBQWMsSUFBSSxHQUFHLEdBQUcyaEIsbUJBQW1CLEVBQUUsQ0FBQTs7QUFHN0UsSUFBQSxNQUFNeGdCLElBQUksR0FBRztNQUNUaWhCLEdBQUcsRUFBRUEsR0FBRyxJQUFJcGlCLElBQUFBO0tBQ2YsQ0FBQTtBQUNELElBQUEsSUFBSXpFLFVBQVUsRUFBRTtNQUNaNEYsSUFBSSxDQUFDbWhCLFFBQVEsR0FBRy9tQixVQUFVLENBQUNjLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQ1ksTUFBTSxDQUFBO0FBQzlDLEtBQUE7QUFDQSxJQUFBLElBQUlvbEIsUUFBUSxFQUFFO0FBQ1YsTUFBQSxNQUFNRSxTQUFTLEdBQUdMLHNCQUFzQixDQUFDRyxRQUFRLENBQUMsQ0FBQTtBQUNsRCxNQUFBLElBQUlFLFNBQVMsRUFBRTtRQUNYcGhCLElBQUksQ0FBQ3FoQixRQUFRLEdBQUdyaEIsSUFBSSxDQUFDaWhCLEdBQUcsR0FBRyxHQUFHLEdBQUdHLFNBQVMsQ0FBQTtBQUM5QyxPQUFBO0FBQ0osS0FBQTs7QUFHQSxJQUFBLE1BQU10QyxLQUFLLEdBQUcsSUFBSS9lLEtBQUssQ0FBQ2xCLElBQUksRUFBRSxTQUFTLEVBQUVtQixJQUFJLEVBQUUsSUFBSSxFQUFFQyxPQUFPLENBQUMsQ0FBQTtBQUM3RDZlLElBQUFBLEtBQUssQ0FBQ3dDLEVBQUUsQ0FBQyxNQUFNLEVBQUVSLE1BQU0sQ0FBQyxDQUFBO0FBQ3hCaEMsSUFBQUEsS0FBSyxDQUFDd0MsRUFBRSxDQUFDLE9BQU8sRUFBRXJiLFFBQVEsQ0FBQyxDQUFBO0FBQzNCN0YsSUFBQUEsUUFBUSxDQUFDQyxHQUFHLENBQUN5ZSxLQUFLLENBQUMsQ0FBQTtBQUNuQjFlLElBQUFBLFFBQVEsQ0FBQ21oQixJQUFJLENBQUN6QyxLQUFLLENBQUMsQ0FBQTtHQUN2QixDQUFBO0FBRUQsRUFBQSxJQUFJNUIsVUFBVSxFQUFFO0lBQ1pBLFVBQVUsQ0FBQ3dELFNBQVMsQ0FBQyxDQUFBO0FBQ3pCLEdBQUE7QUFFQUcsRUFBQUEsWUFBWSxDQUFDSCxTQUFTLEVBQUUsVUFBVWMsR0FBRyxFQUFFeEMsWUFBWSxFQUFFO0FBQ2pELElBQUEsSUFBSXdDLEdBQUcsRUFBRTtNQUNMdmIsUUFBUSxDQUFDdWIsR0FBRyxDQUFDLENBQUE7S0FDaEIsTUFBTSxJQUFJeEMsWUFBWSxFQUFFO01BQ3JCOEIsTUFBTSxDQUFDOUIsWUFBWSxDQUFDLENBQUE7QUFDeEIsS0FBQyxNQUFNO0FBQ0gsTUFBQSxJQUFJMEIsU0FBUyxDQUFDM2xCLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUVqQyxRQUFBLElBQUl2RSxTQUFTLENBQUNrcUIsU0FBUyxDQUFDanFCLEdBQUcsQ0FBQyxFQUFFO0FBQzFCdXFCLFVBQUFBLFdBQVcsQ0FBQ04sU0FBUyxDQUFDanFCLEdBQUcsRUFBRSxJQUFJLEVBQUVFLGtCQUFrQixDQUFDK3BCLFNBQVMsQ0FBQ2pxQixHQUFHLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUM3RSxTQUFDLE1BQU07QUFDSHVxQixVQUFBQSxXQUFXLENBQUNoSyxJQUFJLENBQUNuVSxJQUFJLENBQUM4ZCxPQUFPLEVBQUVELFNBQVMsQ0FBQ2pxQixHQUFHLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO0FBQUVnckIsWUFBQUEsV0FBVyxFQUFFLFdBQUE7QUFBWSxXQUFDLENBQUMsQ0FBQTtBQUM1RixTQUFBO0FBQ0osT0FBQyxNQUFNLElBQUlmLFNBQVMsQ0FBQzNsQixjQUFjLENBQUMsWUFBWSxDQUFDLElBQUkybEIsU0FBUyxDQUFDM2xCLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtBQUV2RmltQixRQUFBQSxXQUFXLENBQUMsSUFBSSxFQUFFam5CLFdBQVcsQ0FBQzJtQixTQUFTLENBQUN0bUIsVUFBVSxDQUFDLEVBQUVzbUIsU0FBUyxDQUFDUSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbEYsT0FBQyxNQUFNO0FBRUhqYixRQUFBQSxRQUFRLENBQUMsdUVBQXVFLEdBQUc5RyxLQUFLLENBQUMsQ0FBQTtBQUM3RixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUMsQ0FBQyxDQUFBO0FBQ04sQ0FBQyxDQUFBOztBQUdELE1BQU11aUIsaUJBQWlCLEdBQUcsU0FBcEJBLGlCQUFpQixDQUFhbnNCLElBQUksRUFBRXdFLFdBQVcsRUFBRTRtQixPQUFPLEVBQUV2Z0IsUUFBUSxFQUFFSCxPQUFPLEVBQUVnRyxRQUFRLEVBQUU7QUFDekYsRUFBQSxJQUFJLENBQUMxUSxJQUFJLENBQUN3RixjQUFjLENBQUMsUUFBUSxDQUFDLElBQUl4RixJQUFJLENBQUNvc0IsTUFBTSxDQUFDaG9CLE1BQU0sS0FBSyxDQUFDLElBQzFELENBQUNwRSxJQUFJLENBQUN3RixjQUFjLENBQUMsVUFBVSxDQUFDLElBQUl4RixJQUFJLENBQUNJLFFBQVEsQ0FBQ2dFLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDaEVzTSxJQUFBQSxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFBO0FBQ2xCLElBQUEsT0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLE1BQU1pWCxVQUFVLEdBQUdqZCxPQUFPLElBQUlBLE9BQU8sQ0FBQ1osT0FBTyxJQUFJWSxPQUFPLENBQUNaLE9BQU8sQ0FBQzZkLFVBQVUsQ0FBQTtFQUMzRSxNQUFNMkQsWUFBWSxHQUFJNWdCLE9BQU8sSUFBSUEsT0FBTyxDQUFDWixPQUFPLElBQUlZLE9BQU8sQ0FBQ1osT0FBTyxDQUFDd2hCLFlBQVksSUFBSyxVQUFVZSxXQUFXLEVBQUVDLFVBQVUsRUFBRTViLFFBQVEsRUFBRTtBQUM5SEEsSUFBQUEsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQTtHQUN2QixDQUFBO0FBQ0QsRUFBQSxNQUFNbVgsV0FBVyxHQUFHbmQsT0FBTyxJQUFJQSxPQUFPLENBQUNaLE9BQU8sSUFBSVksT0FBTyxDQUFDWixPQUFPLENBQUMrZCxXQUFXLENBQUE7RUFFN0UsTUFBTTBFLE1BQU0sR0FBRyxFQUFFLENBQUE7RUFDakIsTUFBTW5zQixRQUFRLEdBQUcsRUFBRSxDQUFBOztBQUVuQixFQUFBLElBQUlvc0IsU0FBUyxHQUFHeHNCLElBQUksQ0FBQ0ksUUFBUSxDQUFDZ0UsTUFBTSxDQUFBO0VBQ3BDLE1BQU1tbkIsTUFBTSxHQUFHLFNBQVRBLE1BQU0sQ0FBYWtCLFlBQVksRUFBRUMsVUFBVSxFQUFFO0FBQy9DLElBQUEsSUFBSSxDQUFDdHNCLFFBQVEsQ0FBQ3NzQixVQUFVLENBQUMsRUFBRTtBQUN2QnRzQixNQUFBQSxRQUFRLENBQUNzc0IsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFBO0FBQzdCLEtBQUE7QUFDQXRzQixJQUFBQSxRQUFRLENBQUNzc0IsVUFBVSxDQUFDLENBQUNuakIsSUFBSSxDQUFDa2pCLFlBQVksQ0FBQyxDQUFBO0FBRXZDLElBQUEsSUFBSSxFQUFFRCxTQUFTLEtBQUssQ0FBQyxFQUFFO01BQ25CLE1BQU0xbkIsTUFBTSxHQUFHLEVBQUUsQ0FBQTtBQUNqQjFFLE1BQUFBLFFBQVEsQ0FBQ1UsT0FBTyxDQUFDLFVBQVU2ckIsV0FBVyxFQUFFRCxVQUFVLEVBQUU7QUFDaERDLFFBQUFBLFdBQVcsQ0FBQzdyQixPQUFPLENBQUMsVUFBVTJyQixZQUFZLEVBQUU3aUIsS0FBSyxFQUFFO0FBQy9DLFVBQUEsTUFBTTZmLFlBQVksR0FBSTdmLEtBQUssS0FBSyxDQUFDLEdBQUkyaUIsTUFBTSxDQUFDRyxVQUFVLENBQUMsR0FBR25pQixpQkFBaUIsQ0FBQ2dpQixNQUFNLENBQUNHLFVBQVUsQ0FBQyxDQUFDLENBQUE7VUFDL0YvQyxZQUFZLENBQUNGLFlBQVksQ0FBQzdlLFFBQVEsRUFBRSxDQUFDNUssSUFBSSxDQUFDOGdCLFFBQVEsSUFBSSxFQUFFLEVBQUU5Z0IsSUFBSSxDQUFDSSxRQUFRLENBQUNxc0IsWUFBWSxDQUFDLENBQUMxTCxPQUFPLENBQUMsQ0FBQyxDQUFBO0FBQy9GamMsVUFBQUEsTUFBTSxDQUFDMm5CLFlBQVksQ0FBQyxHQUFHaEQsWUFBWSxDQUFBO0FBQ25DLFVBQUEsSUFBSTVCLFdBQVcsRUFBRTtZQUNiQSxXQUFXLENBQUM3bkIsSUFBSSxDQUFDSSxRQUFRLENBQUNxc0IsWUFBWSxDQUFDLEVBQUVoRCxZQUFZLENBQUMsQ0FBQTtBQUMxRCxXQUFBO0FBQ0osU0FBQyxDQUFDLENBQUE7QUFDTixPQUFDLENBQUMsQ0FBQTtBQUNGL1ksTUFBQUEsUUFBUSxDQUFDLElBQUksRUFBRTVMLE1BQU0sQ0FBQyxDQUFBO0FBQzFCLEtBQUE7R0FDSCxDQUFBO0FBRUQsRUFBQSxLQUFLLElBQUlULENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3JFLElBQUksQ0FBQ0ksUUFBUSxDQUFDZ0UsTUFBTSxFQUFFLEVBQUVDLENBQUMsRUFBRTtBQUMzQyxJQUFBLE1BQU1nb0IsV0FBVyxHQUFHcnNCLElBQUksQ0FBQ0ksUUFBUSxDQUFDaUUsQ0FBQyxDQUFDLENBQUE7QUFFcEMsSUFBQSxJQUFJc2pCLFVBQVUsRUFBRTtNQUNaQSxVQUFVLENBQUMwRSxXQUFXLENBQUMsQ0FBQTtBQUMzQixLQUFBO0FBRUFmLElBQUFBLFlBQVksQ0FBQ2UsV0FBVyxFQUFFcnNCLElBQUksQ0FBQ29zQixNQUFNLEVBQUUsVUFBVS9uQixDQUFDLEVBQUVnb0IsV0FBVyxFQUFFSixHQUFHLEVBQUVXLGNBQWMsRUFBRTtBQUNsRixNQUFBLElBQUlYLEdBQUcsRUFBRTtRQUNMdmIsUUFBUSxDQUFDdWIsR0FBRyxDQUFDLENBQUE7QUFDakIsT0FBQyxNQUFNO0FBQ0gsUUFBQSxJQUFJVyxjQUFjLEtBQUs5TSxTQUFTLElBQUk4TSxjQUFjLEtBQUssSUFBSSxFQUFFO0FBQUEsVUFBQSxJQUFBLHFCQUFBLEVBQUEsc0JBQUEsQ0FBQTtVQUN6REEsY0FBYyxHQUFHUCxXQUFXLElBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUEscUJBQUEsR0FBWEEsV0FBVyxDQUFFcmIsVUFBVSxLQUFBLElBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBLHNCQUFBLEdBQXZCLHFCQUF5QjZiLENBQUFBLGtCQUFrQixLQUEzQyxJQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsc0JBQUEsQ0FBNkNqaEIsTUFBTSxDQUFBO1VBQ3BFLElBQUlnaEIsY0FBYyxLQUFLOU0sU0FBUyxFQUFFO1lBQzlCOE0sY0FBYyxHQUFHUCxXQUFXLENBQUN6Z0IsTUFBTSxDQUFBO0FBQ3ZDLFdBQUE7QUFDSixTQUFBO0FBRUEsUUFBQSxJQUFJMmdCLE1BQU0sQ0FBQ0ssY0FBYyxDQUFDLEVBQUU7QUFFeEJyQixVQUFBQSxNQUFNLENBQUNsbkIsQ0FBQyxFQUFFdW9CLGNBQWMsQ0FBQyxDQUFBO0FBQzdCLFNBQUMsTUFBTTtBQUVILFVBQUEsTUFBTXpCLFNBQVMsR0FBR25yQixJQUFJLENBQUNvc0IsTUFBTSxDQUFDUSxjQUFjLENBQUMsQ0FBQTtBQUM3QzFCLFVBQUFBLGNBQWMsQ0FBQ0MsU0FBUyxFQUFFOW1CLENBQUMsRUFBRUcsV0FBVyxFQUFFNG1CLE9BQU8sRUFBRXZnQixRQUFRLEVBQUVILE9BQU8sRUFBRSxVQUFVdWhCLEdBQUcsRUFBRXhDLFlBQVksRUFBRTtBQUMvRixZQUFBLElBQUl3QyxHQUFHLEVBQUU7Y0FDTHZiLFFBQVEsQ0FBQ3ViLEdBQUcsQ0FBQyxDQUFBO0FBQ2pCLGFBQUMsTUFBTTtBQUNITSxjQUFBQSxNQUFNLENBQUNLLGNBQWMsQ0FBQyxHQUFHbkQsWUFBWSxDQUFBO0FBQ3JDOEIsY0FBQUEsTUFBTSxDQUFDbG5CLENBQUMsRUFBRXVvQixjQUFjLENBQUMsQ0FBQTtBQUM3QixhQUFBO0FBQ0osV0FBQyxDQUFDLENBQUE7QUFDTixTQUFBO0FBQ0osT0FBQTtLQUNILENBQUNFLElBQUksQ0FBQyxJQUFJLEVBQUV6b0IsQ0FBQyxFQUFFZ29CLFdBQVcsQ0FBQyxDQUFDLENBQUE7QUFDakMsR0FBQTtBQUNKLENBQUMsQ0FBQTs7QUFHRCxNQUFNVSxnQkFBZ0IsR0FBRyxTQUFuQkEsZ0JBQWdCLENBQWEvc0IsSUFBSSxFQUFFZ3RCLFdBQVcsRUFBRTVCLE9BQU8sRUFBRTFnQixPQUFPLEVBQUVnRyxRQUFRLEVBQUU7RUFDOUUsTUFBTTVMLE1BQU0sR0FBRyxFQUFFLENBQUE7QUFFakIsRUFBQSxJQUFJLENBQUM5RSxJQUFJLENBQUNpdEIsT0FBTyxJQUFJanRCLElBQUksQ0FBQ2l0QixPQUFPLENBQUM3b0IsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUM1Q3NNLElBQUFBLFFBQVEsQ0FBQyxJQUFJLEVBQUU1TCxNQUFNLENBQUMsQ0FBQTtBQUN0QixJQUFBLE9BQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxNQUFNNmlCLFVBQVUsR0FBR2pkLE9BQU8sSUFBSUEsT0FBTyxDQUFDbkUsTUFBTSxJQUFJbUUsT0FBTyxDQUFDbkUsTUFBTSxDQUFDb2hCLFVBQVUsQ0FBQTtBQUN6RSxFQUFBLE1BQU0yRCxZQUFZLEdBQUk1Z0IsT0FBTyxJQUFJQSxPQUFPLENBQUNuRSxNQUFNLElBQUltRSxPQUFPLENBQUNuRSxNQUFNLENBQUMra0IsWUFBWSxJQUFLLFVBQVU0QixVQUFVLEVBQUV4YyxRQUFRLEVBQUU7QUFDL0dBLElBQUFBLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7R0FDdkIsQ0FBQTtBQUNELEVBQUEsTUFBTW1YLFdBQVcsR0FBR25kLE9BQU8sSUFBSUEsT0FBTyxDQUFDbkUsTUFBTSxJQUFJbUUsT0FBTyxDQUFDbkUsTUFBTSxDQUFDc2hCLFdBQVcsQ0FBQTtBQUUzRSxFQUFBLElBQUkyRSxTQUFTLEdBQUd4c0IsSUFBSSxDQUFDaXRCLE9BQU8sQ0FBQzdvQixNQUFNLENBQUE7RUFDbkMsTUFBTW1uQixNQUFNLEdBQUcsU0FBVEEsTUFBTSxDQUFhM2hCLEtBQUssRUFBRXJELE1BQU0sRUFBRTtBQUNwQ3pCLElBQUFBLE1BQU0sQ0FBQzhFLEtBQUssQ0FBQyxHQUFHckQsTUFBTSxDQUFBO0FBQ3RCLElBQUEsSUFBSXNoQixXQUFXLEVBQUU7TUFDYkEsV0FBVyxDQUFDN25CLElBQUksQ0FBQ2l0QixPQUFPLENBQUNyakIsS0FBSyxDQUFDLEVBQUVyRCxNQUFNLENBQUMsQ0FBQTtBQUM1QyxLQUFBO0FBQ0EsSUFBQSxJQUFJLEVBQUVpbUIsU0FBUyxLQUFLLENBQUMsRUFBRTtBQUNuQjliLE1BQUFBLFFBQVEsQ0FBQyxJQUFJLEVBQUU1TCxNQUFNLENBQUMsQ0FBQTtBQUMxQixLQUFBO0dBQ0gsQ0FBQTtBQUVELEVBQUEsS0FBSyxJQUFJVCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdyRSxJQUFJLENBQUNpdEIsT0FBTyxDQUFDN29CLE1BQU0sRUFBRSxFQUFFQyxDQUFDLEVBQUU7QUFDMUMsSUFBQSxNQUFNNm9CLFVBQVUsR0FBR2x0QixJQUFJLENBQUNpdEIsT0FBTyxDQUFDNW9CLENBQUMsQ0FBQyxDQUFBO0FBRWxDLElBQUEsSUFBSXNqQixVQUFVLEVBQUU7TUFDWkEsVUFBVSxDQUFDdUYsVUFBVSxDQUFDLENBQUE7QUFDMUIsS0FBQTtJQUVBNUIsWUFBWSxDQUFDNEIsVUFBVSxFQUFFLFVBQVU3b0IsQ0FBQyxFQUFFNm9CLFVBQVUsRUFBRWpCLEdBQUcsRUFBRWtCLFdBQVcsRUFBRTtBQUNoRSxNQUFBLElBQUlsQixHQUFHLEVBQUU7UUFDTHZiLFFBQVEsQ0FBQ3ViLEdBQUcsQ0FBQyxDQUFBO09BQ2hCLE1BQU0sSUFBSWtCLFdBQVcsRUFBRTtRQUNwQjVCLE1BQU0sQ0FBQ2xuQixDQUFDLEVBQUUsSUFBSWhDLFVBQVUsQ0FBQzhxQixXQUFXLENBQUMsQ0FBQyxDQUFBO0FBQzFDLE9BQUMsTUFBTTtBQUNILFFBQUEsSUFBSUQsVUFBVSxDQUFDMW5CLGNBQWMsQ0FBQyxLQUFLLENBQUMsRUFBRTtBQUNsQyxVQUFBLElBQUl2RSxTQUFTLENBQUNpc0IsVUFBVSxDQUFDaHNCLEdBQUcsQ0FBQyxFQUFFO0FBRzNCLFlBQUEsTUFBTWtzQixVQUFVLEdBQUdDLElBQUksQ0FBQ0gsVUFBVSxDQUFDaHNCLEdBQUcsQ0FBQ29zQixLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTs7WUFHckQsTUFBTUMsV0FBVyxHQUFHLElBQUlsckIsVUFBVSxDQUFDK3FCLFVBQVUsQ0FBQ2hwQixNQUFNLENBQUMsQ0FBQTs7QUFHckQsWUFBQSxLQUFLLElBQUl5QixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd1bkIsVUFBVSxDQUFDaHBCLE1BQU0sRUFBRXlCLENBQUMsRUFBRSxFQUFFO2NBQ3hDMG5CLFdBQVcsQ0FBQzFuQixDQUFDLENBQUMsR0FBR3VuQixVQUFVLENBQUNJLFVBQVUsQ0FBQzNuQixDQUFDLENBQUMsQ0FBQTtBQUM3QyxhQUFBO0FBRUEwbEIsWUFBQUEsTUFBTSxDQUFDbG5CLENBQUMsRUFBRWtwQixXQUFXLENBQUMsQ0FBQTtBQUMxQixXQUFDLE1BQU07QUFDSEUsWUFBQUEsSUFBSSxDQUFDcmQsR0FBRyxDQUNKcVIsSUFBSSxDQUFDblUsSUFBSSxDQUFDOGQsT0FBTyxFQUFFOEIsVUFBVSxDQUFDaHNCLEdBQUcsQ0FBQyxFQUNsQztBQUFFd3NCLGNBQUFBLEtBQUssRUFBRSxJQUFJO0FBQUVDLGNBQUFBLFlBQVksRUFBRSxhQUFhO0FBQUVDLGNBQUFBLEtBQUssRUFBRSxLQUFBO0FBQU0sYUFBQyxFQUMxRCxVQUFVdnBCLENBQUMsRUFBRTRuQixHQUFHLEVBQUVubkIsTUFBTSxFQUFFO0FBQ3RCLGNBQUEsSUFBSW1uQixHQUFHLEVBQUU7Z0JBQ0x2YixRQUFRLENBQUN1YixHQUFHLENBQUMsQ0FBQTtBQUNqQixlQUFDLE1BQU07Z0JBQ0hWLE1BQU0sQ0FBQ2xuQixDQUFDLEVBQUUsSUFBSWhDLFVBQVUsQ0FBQ3lDLE1BQU0sQ0FBQyxDQUFDLENBQUE7QUFDckMsZUFBQTtBQUNKLGFBQUMsQ0FBQ2dvQixJQUFJLENBQUMsSUFBSSxFQUFFem9CLENBQUMsQ0FBQyxDQUNsQixDQUFBO0FBQ0wsV0FBQTtBQUNKLFNBQUMsTUFBTTtBQUVIa25CLFVBQUFBLE1BQU0sQ0FBQ2xuQixDQUFDLEVBQUUyb0IsV0FBVyxDQUFDLENBQUE7QUFDMUIsU0FBQTtBQUNKLE9BQUE7S0FDSCxDQUFDRixJQUFJLENBQUMsSUFBSSxFQUFFem9CLENBQUMsRUFBRTZvQixVQUFVLENBQUMsQ0FBQyxDQUFBO0FBQ2hDLEdBQUE7QUFDSixDQUFDLENBQUE7O0FBR0QsTUFBTVcsU0FBUyxHQUFHLFNBQVpBLFNBQVMsQ0FBYUMsU0FBUyxFQUFFcGQsUUFBUSxFQUFFO0FBQzdDLEVBQUEsTUFBTXFkLGdCQUFnQixHQUFHLFNBQW5CQSxnQkFBZ0IsQ0FBYUMsS0FBSyxFQUFFO0FBQ3RDLElBQUEsSUFBSSxPQUFPQyxXQUFXLEtBQUssV0FBVyxFQUFFO0FBQ3BDLE1BQUEsT0FBTyxJQUFJQSxXQUFXLEVBQUUsQ0FBQ0MsTUFBTSxDQUFDRixLQUFLLENBQUMsQ0FBQTtBQUMxQyxLQUFBO0lBRUEsSUFBSUcsR0FBRyxHQUFHLEVBQUUsQ0FBQTtBQUNaLElBQUEsS0FBSyxJQUFJOXBCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRzJwQixLQUFLLENBQUM1cEIsTUFBTSxFQUFFQyxDQUFDLEVBQUUsRUFBRTtNQUNuQzhwQixHQUFHLElBQUlDLE1BQU0sQ0FBQ0MsWUFBWSxDQUFDTCxLQUFLLENBQUMzcEIsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN4QyxLQUFBO0FBRUEsSUFBQSxPQUFPaXFCLGtCQUFrQixDQUFDQyxNQUFNLENBQUNKLEdBQUcsQ0FBQyxDQUFDLENBQUE7R0FDekMsQ0FBQTtFQUVELE1BQU1udUIsSUFBSSxHQUFHd3VCLElBQUksQ0FBQ0MsS0FBSyxDQUFDVixnQkFBZ0IsQ0FBQ0QsU0FBUyxDQUFDLENBQUMsQ0FBQTs7RUFHcEQsSUFBSTl0QixJQUFJLENBQUN1cEIsS0FBSyxJQUFJdnBCLElBQUksQ0FBQ3VwQixLQUFLLENBQUNtRixPQUFPLElBQUlDLFVBQVUsQ0FBQzN1QixJQUFJLENBQUN1cEIsS0FBSyxDQUFDbUYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFO0lBQ3hFaGUsUUFBUSxDQUFFLDBFQUF5RTFRLElBQUksQ0FBQ3VwQixLQUFLLENBQUNtRixPQUFRLElBQUcsQ0FBQyxDQUFBO0FBQzFHLElBQUEsT0FBQTtBQUNKLEdBQUE7O0VBR0EsTUFBTUUsa0JBQWtCLEdBQUcsQ0FBQTV1QixJQUFJLG9CQUFKQSxJQUFJLENBQUU0dUIsa0JBQWtCLEtBQUksRUFBRSxDQUFBO0FBQ3pELEVBQUEsSUFBSSxDQUFDbHZCLG9CQUFvQixJQUFJLENBQUNDLDJCQUEyQixFQUFFLElBQUlpdkIsa0JBQWtCLENBQUN0dEIsT0FBTyxDQUFDLDRCQUE0QixDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7QUFDNUh1dEIsSUFBQUEsVUFBVSxDQUFDQyxXQUFXLENBQUMsb0JBQW9CLEVBQUdDLFFBQVEsSUFBSztBQUN2RHJ2QixNQUFBQSxvQkFBb0IsR0FBR3F2QixRQUFRLENBQUE7QUFDL0JyZSxNQUFBQSxRQUFRLENBQUMsSUFBSSxFQUFFMVEsSUFBSSxDQUFDLENBQUE7QUFDeEIsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFDLE1BQU07QUFDSDBRLElBQUFBLFFBQVEsQ0FBQyxJQUFJLEVBQUUxUSxJQUFJLENBQUMsQ0FBQTtBQUN4QixHQUFBO0FBQ0osQ0FBQyxDQUFBOztBQUdELE1BQU1ndkIsUUFBUSxHQUFHLFNBQVhBLFFBQVEsQ0FBYUMsT0FBTyxFQUFFdmUsUUFBUSxFQUFFO0VBQzFDLE1BQU1qSyxJQUFJLEdBQUl3b0IsT0FBTyxZQUFZaHBCLFdBQVcsR0FBSSxJQUFJaXBCLFFBQVEsQ0FBQ0QsT0FBTyxDQUFDLEdBQUcsSUFBSUMsUUFBUSxDQUFDRCxPQUFPLENBQUMxb0IsTUFBTSxFQUFFMG9CLE9BQU8sQ0FBQ3ZwQixVQUFVLEVBQUV1cEIsT0FBTyxDQUFDRSxVQUFVLENBQUMsQ0FBQTs7RUFHNUksTUFBTUMsS0FBSyxHQUFHM29CLElBQUksQ0FBQzRvQixTQUFTLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFBO0VBQ3JDLE1BQU1YLE9BQU8sR0FBR2pvQixJQUFJLENBQUM0b0IsU0FBUyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtFQUN2QyxNQUFNanJCLE1BQU0sR0FBR3FDLElBQUksQ0FBQzRvQixTQUFTLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFBO0VBRXRDLElBQUlELEtBQUssS0FBSyxVQUFVLEVBQUU7SUFDdEIxZSxRQUFRLENBQUMseUVBQXlFLEdBQUcwZSxLQUFLLENBQUM3YSxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUN4RyxJQUFBLE9BQUE7QUFDSixHQUFBO0VBRUEsSUFBSW1hLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDZmhlLElBQUFBLFFBQVEsQ0FBQyxnRUFBZ0UsR0FBR2dlLE9BQU8sQ0FBQyxDQUFBO0FBQ3BGLElBQUEsT0FBQTtBQUNKLEdBQUE7RUFFQSxJQUFJdHFCLE1BQU0sSUFBSSxDQUFDLElBQUlBLE1BQU0sR0FBR3FDLElBQUksQ0FBQzBvQixVQUFVLEVBQUU7QUFDekN6ZSxJQUFBQSxRQUFRLENBQUMsNENBQTRDLEdBQUd0TSxNQUFNLENBQUMsQ0FBQTtBQUMvRCxJQUFBLE9BQUE7QUFDSixHQUFBOztFQUdBLE1BQU0rVCxNQUFNLEdBQUcsRUFBRSxDQUFBO0VBQ2pCLElBQUkxUCxNQUFNLEdBQUcsRUFBRSxDQUFBO0VBQ2YsT0FBT0EsTUFBTSxHQUFHckUsTUFBTSxFQUFFO0lBQ3BCLE1BQU1rckIsV0FBVyxHQUFHN29CLElBQUksQ0FBQzRvQixTQUFTLENBQUM1bUIsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFBO0lBQ2hELElBQUlBLE1BQU0sR0FBRzZtQixXQUFXLEdBQUcsQ0FBQyxHQUFHN29CLElBQUksQ0FBQzBvQixVQUFVLEVBQUU7QUFDNUMsTUFBQSxNQUFNLElBQUlJLEtBQUssQ0FBQywyQ0FBMkMsR0FBR0QsV0FBVyxDQUFDLENBQUE7QUFDOUUsS0FBQTtJQUNBLE1BQU1FLFNBQVMsR0FBRy9vQixJQUFJLENBQUM0b0IsU0FBUyxDQUFDNW1CLE1BQU0sR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbEQsSUFBQSxNQUFNZ25CLFNBQVMsR0FBRyxJQUFJcHRCLFVBQVUsQ0FBQ29FLElBQUksQ0FBQ0YsTUFBTSxFQUFFRSxJQUFJLENBQUNmLFVBQVUsR0FBRytDLE1BQU0sR0FBRyxDQUFDLEVBQUU2bUIsV0FBVyxDQUFDLENBQUE7SUFDeEZuWCxNQUFNLENBQUM1TyxJQUFJLENBQUM7QUFBRW5GLE1BQUFBLE1BQU0sRUFBRWtyQixXQUFXO0FBQUUzcUIsTUFBQUEsSUFBSSxFQUFFNnFCLFNBQVM7QUFBRS9vQixNQUFBQSxJQUFJLEVBQUVncEIsU0FBQUE7QUFBVSxLQUFDLENBQUMsQ0FBQTtJQUN0RWhuQixNQUFNLElBQUk2bUIsV0FBVyxHQUFHLENBQUMsQ0FBQTtBQUM3QixHQUFBO0VBRUEsSUFBSW5YLE1BQU0sQ0FBQy9ULE1BQU0sS0FBSyxDQUFDLElBQUkrVCxNQUFNLENBQUMvVCxNQUFNLEtBQUssQ0FBQyxFQUFFO0lBQzVDc00sUUFBUSxDQUFDLDZDQUE2QyxDQUFDLENBQUE7QUFDdkQsSUFBQSxPQUFBO0FBQ0osR0FBQTtFQUVBLElBQUl5SCxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUN4VCxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQy9CK0wsSUFBQUEsUUFBUSxDQUFDLHFFQUFxRSxHQUFHeUgsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDeFQsSUFBSSxDQUFDNFAsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDN0csSUFBQSxPQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsSUFBSTRELE1BQU0sQ0FBQy9ULE1BQU0sR0FBRyxDQUFDLElBQUkrVCxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUN4VCxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3BEK0wsSUFBQUEsUUFBUSxDQUFDLHFFQUFxRSxHQUFHeUgsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDeFQsSUFBSSxDQUFDNFAsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDN0csSUFBQSxPQUFBO0FBQ0osR0FBQTtFQUVBN0QsUUFBUSxDQUFDLElBQUksRUFBRTtBQUNYb2QsSUFBQUEsU0FBUyxFQUFFM1YsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDMVIsSUFBSTtBQUN6QnVtQixJQUFBQSxXQUFXLEVBQUU3VSxNQUFNLENBQUMvVCxNQUFNLEtBQUssQ0FBQyxHQUFHK1QsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDMVIsSUFBSSxHQUFHLElBQUE7QUFDeEQsR0FBQyxDQUFDLENBQUE7QUFDTixDQUFDLENBQUE7O0FBR0QsTUFBTWlwQixVQUFVLEdBQUcsU0FBYkEsVUFBVSxDQUFhNUQsUUFBUSxFQUFFcmxCLElBQUksRUFBRWlLLFFBQVEsRUFBRTtFQUNuRCxNQUFNaWYsWUFBWSxHQUFHLE1BQU07QUFFdkIsSUFBQSxNQUFNQyxFQUFFLEdBQUcsSUFBSXZ0QixVQUFVLENBQUNvRSxJQUFJLENBQUMsQ0FBQTtJQUMvQixPQUFPbXBCLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUlBLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUlBLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLElBQUlBLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUE7R0FDeEUsQ0FBQTtBQUVELEVBQUEsSUFBSzlELFFBQVEsSUFBSUEsUUFBUSxDQUFDK0QsV0FBVyxFQUFFLENBQUNDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBS0gsWUFBWSxFQUFFLEVBQUU7QUFDekVYLElBQUFBLFFBQVEsQ0FBQ3ZvQixJQUFJLEVBQUVpSyxRQUFRLENBQUMsQ0FBQTtBQUM1QixHQUFDLE1BQU07SUFDSEEsUUFBUSxDQUFDLElBQUksRUFBRTtBQUNYb2QsTUFBQUEsU0FBUyxFQUFFcm5CLElBQUk7QUFDZnVtQixNQUFBQSxXQUFXLEVBQUUsSUFBQTtBQUNqQixLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7QUFDSixDQUFDLENBQUE7O0FBR0QsTUFBTStDLHFCQUFxQixHQUFHLFNBQXhCQSxxQkFBcUIsQ0FBYS92QixJQUFJLEVBQUVpdEIsT0FBTyxFQUFFdmlCLE9BQU8sRUFBRWdHLFFBQVEsRUFBRTtFQUV0RSxNQUFNNUwsTUFBTSxHQUFHLEVBQUUsQ0FBQTtBQUVqQixFQUFBLE1BQU02aUIsVUFBVSxHQUFHamQsT0FBTyxJQUFJQSxPQUFPLENBQUM3RixVQUFVLElBQUk2RixPQUFPLENBQUM3RixVQUFVLENBQUM4aUIsVUFBVSxDQUFBO0VBQ2pGLE1BQU0yRCxZQUFZLEdBQUk1Z0IsT0FBTyxJQUFJQSxPQUFPLENBQUM3RixVQUFVLElBQUk2RixPQUFPLENBQUM3RixVQUFVLENBQUN5bUIsWUFBWSxJQUFLLFVBQVUwRSxjQUFjLEVBQUUvQyxPQUFPLEVBQUV2YyxRQUFRLEVBQUU7QUFDcElBLElBQUFBLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7R0FDdkIsQ0FBQTtBQUNELEVBQUEsTUFBTW1YLFdBQVcsR0FBR25kLE9BQU8sSUFBSUEsT0FBTyxDQUFDN0YsVUFBVSxJQUFJNkYsT0FBTyxDQUFDN0YsVUFBVSxDQUFDZ2pCLFdBQVcsQ0FBQTtBQUVuRixFQUFBLElBQUkyRSxTQUFTLEdBQUd4c0IsSUFBSSxDQUFDd0UsV0FBVyxHQUFHeEUsSUFBSSxDQUFDd0UsV0FBVyxDQUFDSixNQUFNLEdBQUcsQ0FBQyxDQUFBOztFQUc5RCxJQUFJLENBQUNvb0IsU0FBUyxFQUFFO0FBQ1o5YixJQUFBQSxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3BCLElBQUEsT0FBQTtBQUNKLEdBQUE7RUFFQSxNQUFNNmEsTUFBTSxHQUFHLFNBQVRBLE1BQU0sQ0FBYTNoQixLQUFLLEVBQUUvRSxVQUFVLEVBQUU7QUFDeEMsSUFBQSxNQUFNbXJCLGNBQWMsR0FBR2h3QixJQUFJLENBQUN3RSxXQUFXLENBQUNvRixLQUFLLENBQUMsQ0FBQTtBQUM5QyxJQUFBLElBQUlvbUIsY0FBYyxDQUFDeHFCLGNBQWMsQ0FBQyxZQUFZLENBQUMsRUFBRTtBQUM3Q1gsTUFBQUEsVUFBVSxDQUFDd0IsVUFBVSxHQUFHMnBCLGNBQWMsQ0FBQzNwQixVQUFVLENBQUE7QUFDckQsS0FBQTtBQUVBdkIsSUFBQUEsTUFBTSxDQUFDOEUsS0FBSyxDQUFDLEdBQUcvRSxVQUFVLENBQUE7QUFDMUIsSUFBQSxJQUFJZ2pCLFdBQVcsRUFBRTtBQUNiQSxNQUFBQSxXQUFXLENBQUNtSSxjQUFjLEVBQUVuckIsVUFBVSxDQUFDLENBQUE7QUFDM0MsS0FBQTtBQUNBLElBQUEsSUFBSSxFQUFFMm5CLFNBQVMsS0FBSyxDQUFDLEVBQUU7QUFDbkI5YixNQUFBQSxRQUFRLENBQUMsSUFBSSxFQUFFNUwsTUFBTSxDQUFDLENBQUE7QUFDMUIsS0FBQTtHQUNILENBQUE7QUFFRCxFQUFBLEtBQUssSUFBSVQsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHckUsSUFBSSxDQUFDd0UsV0FBVyxDQUFDSixNQUFNLEVBQUUsRUFBRUMsQ0FBQyxFQUFFO0FBQzlDLElBQUEsTUFBTTJyQixjQUFjLEdBQUdod0IsSUFBSSxDQUFDd0UsV0FBVyxDQUFDSCxDQUFDLENBQUMsQ0FBQTtBQUUxQyxJQUFBLElBQUlzakIsVUFBVSxFQUFFO01BQ1pBLFVBQVUsQ0FBQ3FJLGNBQWMsQ0FBQyxDQUFBO0FBQzlCLEtBQUE7QUFFQTFFLElBQUFBLFlBQVksQ0FBQzBFLGNBQWMsRUFBRS9DLE9BQU8sRUFBRSxVQUFVNW9CLENBQUMsRUFBRTJyQixjQUFjLEVBQUUvRCxHQUFHLEVBQUVubkIsTUFBTSxFQUFFO0FBQzVFLE1BQUEsSUFBSW1uQixHQUFHLEVBQUU7UUFDTHZiLFFBQVEsQ0FBQ3ViLEdBQUcsQ0FBQyxDQUFBO09BQ2hCLE1BQU0sSUFBSW5uQixNQUFNLEVBQUU7QUFDZnltQixRQUFBQSxNQUFNLENBQUNsbkIsQ0FBQyxFQUFFUyxNQUFNLENBQUMsQ0FBQTtBQUNyQixPQUFDLE1BQU07QUFDSCxRQUFBLE1BQU15QixNQUFNLEdBQUcwbUIsT0FBTyxDQUFDK0MsY0FBYyxDQUFDenBCLE1BQU0sQ0FBQyxDQUFBO1FBQzdDLE1BQU1vRCxVQUFVLEdBQUcsSUFBSXRILFVBQVUsQ0FBQ2tFLE1BQU0sQ0FBQ0EsTUFBTSxFQUNiQSxNQUFNLENBQUNiLFVBQVUsSUFBSXNxQixjQUFjLENBQUN0cUIsVUFBVSxJQUFJLENBQUMsQ0FBQyxFQUNwRHNxQixjQUFjLENBQUNiLFVBQVUsQ0FBQyxDQUFBO0FBQzVENUQsUUFBQUEsTUFBTSxDQUFDbG5CLENBQUMsRUFBRXNGLFVBQVUsQ0FBQyxDQUFBO0FBQ3pCLE9BQUE7S0FDSCxDQUFDbWpCLElBQUksQ0FBQyxJQUFJLEVBQUV6b0IsQ0FBQyxFQUFFMnJCLGNBQWMsQ0FBQyxDQUFDLENBQUE7QUFDcEMsR0FBQTtBQUNKLENBQUMsQ0FBQTs7QUFHRCxNQUFNQyxTQUFTLENBQUM7QUFFWixFQUFBLE9BQU9DLFVBQVUsQ0FBQ3BFLFFBQVEsRUFBRVYsT0FBTyxFQUFFM2tCLElBQUksRUFBRTZELE1BQU0sRUFBRU8sUUFBUSxFQUFFSCxPQUFPLEVBQUVnRyxRQUFRLEVBQUU7SUFFNUVnZixVQUFVLENBQUM1RCxRQUFRLEVBQUVybEIsSUFBSSxFQUFFLFVBQVV3bEIsR0FBRyxFQUFFOVQsTUFBTSxFQUFFO0FBQzlDLE1BQUEsSUFBSThULEdBQUcsRUFBRTtRQUNMdmIsUUFBUSxDQUFDdWIsR0FBRyxDQUFDLENBQUE7QUFDYixRQUFBLE9BQUE7QUFDSixPQUFBOztNQUdBNEIsU0FBUyxDQUFDMVYsTUFBTSxDQUFDMlYsU0FBUyxFQUFFLFVBQVU3QixHQUFHLEVBQUVqc0IsSUFBSSxFQUFFO0FBQzdDLFFBQUEsSUFBSWlzQixHQUFHLEVBQUU7VUFDTHZiLFFBQVEsQ0FBQ3ViLEdBQUcsQ0FBQyxDQUFBO0FBQ2IsVUFBQSxPQUFBO0FBQ0osU0FBQTs7QUFHQWMsUUFBQUEsZ0JBQWdCLENBQUMvc0IsSUFBSSxFQUFFbVksTUFBTSxDQUFDNlUsV0FBVyxFQUFFNUIsT0FBTyxFQUFFMWdCLE9BQU8sRUFBRSxVQUFVdWhCLEdBQUcsRUFBRWdCLE9BQU8sRUFBRTtBQUNqRixVQUFBLElBQUloQixHQUFHLEVBQUU7WUFDTHZiLFFBQVEsQ0FBQ3ViLEdBQUcsQ0FBQyxDQUFBO0FBQ2IsWUFBQSxPQUFBO0FBQ0osV0FBQTs7VUFHQThELHFCQUFxQixDQUFDL3ZCLElBQUksRUFBRWl0QixPQUFPLEVBQUV2aUIsT0FBTyxFQUFFLFVBQVV1aEIsR0FBRyxFQUFFem5CLFdBQVcsRUFBRTtBQUN0RSxZQUFBLElBQUl5bkIsR0FBRyxFQUFFO2NBQ0x2YixRQUFRLENBQUN1YixHQUFHLENBQUMsQ0FBQTtBQUNiLGNBQUEsT0FBQTtBQUNKLGFBQUE7O0FBR0FFLFlBQUFBLGlCQUFpQixDQUFDbnNCLElBQUksRUFBRXdFLFdBQVcsRUFBRTRtQixPQUFPLEVBQUV2Z0IsUUFBUSxFQUFFSCxPQUFPLEVBQUUsVUFBVXVoQixHQUFHLEVBQUU1QyxhQUFhLEVBQUU7QUFDM0YsY0FBQSxJQUFJNEMsR0FBRyxFQUFFO2dCQUNMdmIsUUFBUSxDQUFDdWIsR0FBRyxDQUFDLENBQUE7QUFDYixnQkFBQSxPQUFBO0FBQ0osZUFBQTtBQUVBN0MsY0FBQUEsZUFBZSxDQUFDOWUsTUFBTSxFQUFFdEssSUFBSSxFQUFFd0UsV0FBVyxFQUFFNmtCLGFBQWEsRUFBRTNlLE9BQU8sRUFBRWdHLFFBQVEsQ0FBQyxDQUFBO0FBQ2hGLGFBQUMsQ0FBQyxDQUFBO0FBQ04sV0FBQyxDQUFDLENBQUE7QUFDTixTQUFDLENBQUMsQ0FBQTtBQUNOLE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBOztFQUdBLE9BQU8rZCxLQUFLLENBQUMzQyxRQUFRLEVBQUVybEIsSUFBSSxFQUFFNkQsTUFBTSxFQUFFSSxPQUFPLEVBQUU7SUFDMUMsSUFBSTVGLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFFakI0RixJQUFBQSxPQUFPLEdBQUdBLE9BQU8sSUFBSSxFQUFHLENBQUE7O0lBR3hCZ2xCLFVBQVUsQ0FBQzVELFFBQVEsRUFBRXJsQixJQUFJLEVBQUUsVUFBVXdsQixHQUFHLEVBQUU5VCxNQUFNLEVBQUU7QUFDOUMsTUFBQSxJQUFJOFQsR0FBRyxFQUFFO0FBQ0w5WSxRQUFBQSxPQUFPLENBQUNnZCxLQUFLLENBQUNsRSxHQUFHLENBQUMsQ0FBQTtBQUN0QixPQUFDLE1BQU07UUFFSDRCLFNBQVMsQ0FBQzFWLE1BQU0sQ0FBQzJWLFNBQVMsRUFBRSxVQUFVN0IsR0FBRyxFQUFFanNCLElBQUksRUFBRTtBQUM3QyxVQUFBLElBQUlpc0IsR0FBRyxFQUFFO0FBQ0w5WSxZQUFBQSxPQUFPLENBQUNnZCxLQUFLLENBQUNsRSxHQUFHLENBQUMsQ0FBQTtBQUN0QixXQUFDLE1BQU07QUFFSDhELFlBQUFBLHFCQUFxQixDQUFDL3ZCLElBQUksRUFBRSxDQUFDbVksTUFBTSxDQUFDNlUsV0FBVyxDQUFDLEVBQUV0aUIsT0FBTyxFQUFFLFVBQVV1aEIsR0FBRyxFQUFFem5CLFdBQVcsRUFBRTtBQUNuRixjQUFBLElBQUl5bkIsR0FBRyxFQUFFO0FBQ0w5WSxnQkFBQUEsT0FBTyxDQUFDZ2QsS0FBSyxDQUFDbEUsR0FBRyxDQUFDLENBQUE7QUFDdEIsZUFBQyxNQUFNO0FBRUg3QyxnQkFBQUEsZUFBZSxDQUFDOWUsTUFBTSxFQUFFdEssSUFBSSxFQUFFd0UsV0FBVyxFQUFFLEVBQUUsRUFBRWtHLE9BQU8sRUFBRSxVQUFVdWhCLEdBQUcsRUFBRW1FLE9BQU8sRUFBRTtBQUM1RSxrQkFBQSxJQUFJbkUsR0FBRyxFQUFFO0FBQ0w5WSxvQkFBQUEsT0FBTyxDQUFDZ2QsS0FBSyxDQUFDbEUsR0FBRyxDQUFDLENBQUE7QUFDdEIsbUJBQUMsTUFBTTtBQUNIbm5CLG9CQUFBQSxNQUFNLEdBQUdzckIsT0FBTyxDQUFBO0FBQ3BCLG1CQUFBO0FBQ0osaUJBQUMsQ0FBQyxDQUFBO0FBQ04sZUFBQTtBQUNKLGFBQUMsQ0FBQyxDQUFBO0FBQ04sV0FBQTtBQUNKLFNBQUMsQ0FBQyxDQUFBO0FBQ04sT0FBQTtBQUNKLEtBQUMsQ0FBQyxDQUFBO0FBRUYsSUFBQSxPQUFPdHJCLE1BQU0sQ0FBQTtBQUNqQixHQUFBO0FBRUEvRSxFQUFBQSxXQUFXLENBQUN1SyxNQUFNLEVBQUVpaUIsTUFBTSxFQUFFOEQsVUFBVSxFQUFFO0lBQ3BDLElBQUksQ0FBQ0MsT0FBTyxHQUFHaG1CLE1BQU0sQ0FBQTtJQUNyQixJQUFJLENBQUNpbUIsT0FBTyxHQUFHaEUsTUFBTSxDQUFBO0FBQ3JCLElBQUEsSUFBSSxDQUFDaUUsZ0JBQWdCLEdBQUdsVCxjQUFjLENBQUM7QUFDbkNoVSxNQUFBQSxJQUFJLEVBQUUsb0JBQUE7S0FDVCxFQUFFLEVBQUUsQ0FBQyxDQUFBO0lBQ04sSUFBSSxDQUFDK21CLFVBQVUsR0FBR0EsVUFBVSxDQUFBO0FBQ2hDLEdBQUE7RUFFQUksb0JBQW9CLENBQUMvRSxHQUFHLEVBQUU7QUFDdEIsSUFBQSxPQUFPQSxHQUFHLENBQUNwcUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBR29xQixHQUFHLENBQUM0QixLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUc1QixHQUFHLENBQUE7QUFDMUQsR0FBQTtBQUVBTSxFQUFBQSxJQUFJLENBQUNOLEdBQUcsRUFBRWhiLFFBQVEsRUFBRTZZLEtBQUssRUFBRTtJQUN2Qi9lLEtBQUssQ0FBQ2ttQixnQkFBZ0IsQ0FBQ2hGLEdBQUcsQ0FBQ00sSUFBSSxFQUFFLENBQUNDLEdBQUcsRUFBRW5uQixNQUFNLEtBQUs7QUFDOUMsTUFBQSxJQUFJbW5CLEdBQUcsRUFBRTtRQUNMdmIsUUFBUSxDQUFDdWIsR0FBRyxDQUFDLENBQUE7QUFDakIsT0FBQyxNQUFNO0FBQ0hnRSxRQUFBQSxTQUFTLENBQUNDLFVBQVUsQ0FDaEIsSUFBSSxDQUFDTyxvQkFBb0IsQ0FBQy9FLEdBQUcsQ0FBQ2lGLFFBQVEsQ0FBQyxFQUN2Q2xQLElBQUksQ0FBQ21QLFdBQVcsQ0FBQ2xGLEdBQUcsQ0FBQ00sSUFBSSxDQUFDLEVBQzFCbG5CLE1BQU0sRUFDTixJQUFJLENBQUN3ckIsT0FBTyxFQUNaL0csS0FBSyxDQUFDMWUsUUFBUSxFQUNkMGUsS0FBSyxDQUFDN2UsT0FBTyxFQUNiLENBQUN1aEIsR0FBRyxFQUFFbm5CLE1BQU0sS0FBSztBQUNiLFVBQUEsSUFBSW1uQixHQUFHLEVBQUU7WUFDTHZiLFFBQVEsQ0FBQ3ViLEdBQUcsQ0FBQyxDQUFBO0FBQ2pCLFdBQUMsTUFBTTtBQUVIdmIsWUFBQUEsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJbWdCLG9CQUFvQixDQUFDL3JCLE1BQU0sRUFBRXlrQixLQUFLLEVBQUUsSUFBSSxDQUFDZ0gsT0FBTyxFQUFFLElBQUksQ0FBQ0MsZ0JBQWdCLENBQUMsQ0FBQyxDQUFBO0FBQ2hHLFdBQUE7QUFDSixTQUFDLENBQUMsQ0FBQTtBQUNWLE9BQUE7QUFDSixLQUFDLEVBQUVqSCxLQUFLLEVBQUUsSUFBSSxDQUFDOEcsVUFBVSxDQUFDLENBQUE7QUFDOUIsR0FBQTtBQUVBUyxFQUFBQSxJQUFJLENBQUNwRixHQUFHLEVBQUVqbEIsSUFBSSxFQUFFOGlCLEtBQUssRUFBRTtBQUNuQixJQUFBLE9BQU85aUIsSUFBSSxDQUFBO0FBQ2YsR0FBQTtBQUVBc3FCLEVBQUFBLEtBQUssQ0FBQ3hILEtBQUssRUFBRWdELE1BQU0sRUFBRSxFQUVyQjtBQUNKOzs7OyJ9
