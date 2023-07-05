/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { http } from '../../net/http.js';
import { math } from '../../math/math.js';
import { Mat4 } from '../../math/mat4.js';
import { Vec2 } from '../../math/vec2.js';
import { Vec3 } from '../../math/vec3.js';
import { Color } from '../../math/color.js';
import { BoundingBox } from '../../shape/bounding-box.js';
import { CHUNKAPI_1_57, CULLFACE_NONE, CULLFACE_BACK, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, BUFFER_STATIC, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_POINTS, SEMANTIC_NORMAL, INDEXFORMAT_UINT8, TYPE_FLOAT32, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE, TYPE_UINT32, TYPE_INT32, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, typedArrayTypesByteSize, typedArrayTypes } from '../../graphics/constants.js';
import { IndexBuffer } from '../../graphics/index-buffer.js';
import { Texture } from '../../graphics/texture.js';
import { VertexBuffer } from '../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../graphics/vertex-format.js';
import { SPECOCC_AO, BLEND_NONE, BLEND_NORMAL, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, ASPECT_AUTO, LIGHTFALLOFF_INVERSESQUARED, ASPECT_MANUAL } from '../../scene/constants.js';
import { calculateNormals } from '../../scene/procedural.js';
import { GraphNode } from '../../scene/graph-node.js';
import { Mesh } from '../../scene/mesh.js';
import { Morph } from '../../scene/morph.js';
import { MorphTarget } from '../../scene/morph-target.js';
import { Skin } from '../../scene/skin.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { Render } from '../../scene/render.js';
import { Entity } from '../../framework/entity.js';
import { AnimCurve } from '../../anim/evaluator/anim-curve.js';
import { AnimData } from '../../anim/evaluator/anim-data.js';
import { AnimTrack } from '../../anim/evaluator/anim-track.js';
import { INTERPOLATION_LINEAR, INTERPOLATION_CUBIC, INTERPOLATION_STEP } from '../../anim/constants.js';
import { Asset } from '../../asset/asset.js';
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
      delete curveMap[channel.sampler];
      delete outputMap[curve.output];
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
  if (filename && filename.toLowerCase().endsWith('.glb')) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3Jlc291cmNlcy9wYXJzZXIvZ2xiLXBhcnNlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9wYXRoLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi8uLi9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHsgQm91bmRpbmdCb3ggfSBmcm9tICcuLi8uLi9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUsXG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDVUxMRkFDRV9OT05FLCBDVUxMRkFDRV9CQUNLLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQUklNSVRJVkVfTElORUxPT1AsIFBSSU1JVElWRV9MSU5FU1RSSVAsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX1BPSU5UUywgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIFNFTUFOVElDX1RFWENPT1JEMCwgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19URVhDT09SRDIsIFNFTUFOVElDX1RFWENPT1JEMywgU0VNQU5USUNfVEVYQ09PUkQ0LCBTRU1BTlRJQ19URVhDT09SRDUsIFNFTUFOVElDX1RFWENPT1JENiwgU0VNQU5USUNfVEVYQ09PUkQ3LFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzIsIENIVU5LQVBJXzFfNTdcbn0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgQkxFTkRfTk9STUFMLCBMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQsXG4gICAgUFJPSkVDVElPTl9PUlRIT0dSQVBISUMsIFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUsXG4gICAgQVNQRUNUX01BTlVBTCwgQVNQRUNUX0FVVE8sIFNQRUNPQ0NfQU9cbn0gZnJvbSAnLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgY2FsY3VsYXRlTm9ybWFscyB9IGZyb20gJy4uLy4uL3NjZW5lL3Byb2NlZHVyYWwuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vLi4vc2NlbmUvbWVzaC5qcyc7XG5pbXBvcnQgeyBNb3JwaCB9IGZyb20gJy4uLy4uL3NjZW5lL21vcnBoLmpzJztcbmltcG9ydCB7IE1vcnBoVGFyZ2V0IH0gZnJvbSAnLi4vLi4vc2NlbmUvbW9ycGgtdGFyZ2V0LmpzJztcbmltcG9ydCB7IFNraW4gfSBmcm9tICcuLi8uLi9zY2VuZS9za2luLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWwgfSBmcm9tICcuLi8uLi9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgUmVuZGVyIH0gZnJvbSAnLi4vLi4vc2NlbmUvcmVuZGVyLmpzJztcblxuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZnJhbWV3b3JrL2VudGl0eS5qcyc7XG5cbmltcG9ydCB7IEFuaW1DdXJ2ZSB9IGZyb20gJy4uLy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tY3VydmUuanMnO1xuaW1wb3J0IHsgQW5pbURhdGEgfSBmcm9tICcuLi8uLi9hbmltL2V2YWx1YXRvci9hbmltLWRhdGEuanMnO1xuaW1wb3J0IHsgQW5pbVRyYWNrIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS10cmFjay5qcyc7XG5cbmltcG9ydCB7IElOVEVSUE9MQVRJT05fQ1VCSUMsIElOVEVSUE9MQVRJT05fTElORUFSLCBJTlRFUlBPTEFUSU9OX1NURVAgfSBmcm9tICcuLi8uLi9hbmltL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuXG5pbXBvcnQgeyBHbGJDb250YWluZXJSZXNvdXJjZSB9IGZyb20gJy4vZ2xiLWNvbnRhaW5lci1yZXNvdXJjZS5qcyc7XG5cbmltcG9ydCB7IFdhc21Nb2R1bGUgfSBmcm9tICcuLi8uLi9jb3JlL3dhc20tbW9kdWxlLmpzJztcblxuLy8gaW5zdGFuY2Ugb2YgdGhlIGRyYWNvIGRlY29kZXJcbmxldCBkcmFjb0RlY29kZXJJbnN0YW5jZSA9IG51bGw7XG5cbmNvbnN0IGdldEdsb2JhbERyYWNvRGVjb2Rlck1vZHVsZSA9ICgpID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LkRyYWNvRGVjb2Rlck1vZHVsZTtcbn07XG5cbi8vIHJlc291cmNlcyBsb2FkZWQgZnJvbSBHTEIgZmlsZSB0aGF0IHRoZSBwYXJzZXIgcmV0dXJuc1xuY2xhc3MgR2xiUmVzb3VyY2VzIHtcbiAgICBjb25zdHJ1Y3RvcihnbHRmKSB7XG4gICAgICAgIHRoaXMuZ2x0ZiA9IGdsdGY7XG4gICAgICAgIHRoaXMubm9kZXMgPSBudWxsO1xuICAgICAgICB0aGlzLnNjZW5lcyA9IG51bGw7XG4gICAgICAgIHRoaXMuYW5pbWF0aW9ucyA9IG51bGw7XG4gICAgICAgIHRoaXMudGV4dHVyZXMgPSBudWxsO1xuICAgICAgICB0aGlzLm1hdGVyaWFscyA9IG51bGw7XG4gICAgICAgIHRoaXMudmFyaWFudHMgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hWYXJpYW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaERlZmF1bHRNYXRlcmlhbHMgPSBudWxsO1xuICAgICAgICB0aGlzLnJlbmRlcnMgPSBudWxsO1xuICAgICAgICB0aGlzLnNraW5zID0gbnVsbDtcbiAgICAgICAgdGhpcy5saWdodHMgPSBudWxsO1xuICAgICAgICB0aGlzLmNhbWVyYXMgPSBudWxsO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIHJlbmRlciBuZWVkcyB0byBkZWMgcmVmIG1lc2hlc1xuICAgICAgICBpZiAodGhpcy5yZW5kZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcnMuZm9yRWFjaCgocmVuZGVyKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVuZGVyLm1lc2hlcyA9IG51bGw7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgaXNEYXRhVVJJID0gZnVuY3Rpb24gKHVyaSkge1xuICAgIHJldHVybiAvXmRhdGE6LiosLiokL2kudGVzdCh1cmkpO1xufTtcblxuY29uc3QgZ2V0RGF0YVVSSU1pbWVUeXBlID0gZnVuY3Rpb24gKHVyaSkge1xuICAgIHJldHVybiB1cmkuc3Vic3RyaW5nKHVyaS5pbmRleE9mKCc6JykgKyAxLCB1cmkuaW5kZXhPZignOycpKTtcbn07XG5cbmNvbnN0IGdldE51bUNvbXBvbmVudHMgPSBmdW5jdGlvbiAoYWNjZXNzb3JUeXBlKSB7XG4gICAgc3dpdGNoIChhY2Nlc3NvclR5cGUpIHtcbiAgICAgICAgY2FzZSAnU0NBTEFSJzogcmV0dXJuIDE7XG4gICAgICAgIGNhc2UgJ1ZFQzInOiByZXR1cm4gMjtcbiAgICAgICAgY2FzZSAnVkVDMyc6IHJldHVybiAzO1xuICAgICAgICBjYXNlICdWRUM0JzogcmV0dXJuIDQ7XG4gICAgICAgIGNhc2UgJ01BVDInOiByZXR1cm4gNDtcbiAgICAgICAgY2FzZSAnTUFUMyc6IHJldHVybiA5O1xuICAgICAgICBjYXNlICdNQVQ0JzogcmV0dXJuIDE2O1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gMztcbiAgICB9XG59O1xuXG5jb25zdCBnZXRDb21wb25lbnRUeXBlID0gZnVuY3Rpb24gKGNvbXBvbmVudFR5cGUpIHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gVFlQRV9JTlQ4O1xuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiBUWVBFX1VJTlQ4O1xuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiBUWVBFX0lOVDE2O1xuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiBUWVBFX1VJTlQxNjtcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gVFlQRV9JTlQzMjtcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gVFlQRV9VSU5UMzI7XG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIFRZUEVfRkxPQVQzMjtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDA7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50U2l6ZUluQnl0ZXMgPSBmdW5jdGlvbiAoY29tcG9uZW50VHlwZSkge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiAxOyAgICAvLyBpbnQ4XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIDE7ICAgIC8vIHVpbnQ4XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIDI7ICAgIC8vIGludDE2XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIDI7ICAgIC8vIHVpbnQxNlxuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiA0OyAgICAvLyBpbnQzMlxuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiA0OyAgICAvLyB1aW50MzJcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gNDsgICAgLy8gZmxvYXQzMlxuICAgICAgICBkZWZhdWx0OiByZXR1cm4gMDtcbiAgICB9XG59O1xuXG5jb25zdCBnZXRDb21wb25lbnREYXRhVHlwZSA9IGZ1bmN0aW9uIChjb21wb25lbnRUeXBlKSB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIEludDhBcnJheTtcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gVWludDhBcnJheTtcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gSW50MTZBcnJheTtcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gVWludDE2QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIEludDMyQXJyYXk7XG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIFVpbnQzMkFycmF5O1xuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiBGbG9hdDMyQXJyYXk7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiBudWxsO1xuICAgIH1cbn07XG5cbmNvbnN0IGdsdGZUb0VuZ2luZVNlbWFudGljTWFwID0ge1xuICAgICdQT1NJVElPTic6IFNFTUFOVElDX1BPU0lUSU9OLFxuICAgICdOT1JNQUwnOiBTRU1BTlRJQ19OT1JNQUwsXG4gICAgJ1RBTkdFTlQnOiBTRU1BTlRJQ19UQU5HRU5ULFxuICAgICdDT0xPUl8wJzogU0VNQU5USUNfQ09MT1IsXG4gICAgJ0pPSU5UU18wJzogU0VNQU5USUNfQkxFTkRJTkRJQ0VTLFxuICAgICdXRUlHSFRTXzAnOiBTRU1BTlRJQ19CTEVORFdFSUdIVCxcbiAgICAnVEVYQ09PUkRfMCc6IFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICAnVEVYQ09PUkRfMSc6IFNFTUFOVElDX1RFWENPT1JEMSxcbiAgICAnVEVYQ09PUkRfMic6IFNFTUFOVElDX1RFWENPT1JEMixcbiAgICAnVEVYQ09PUkRfMyc6IFNFTUFOVElDX1RFWENPT1JEMyxcbiAgICAnVEVYQ09PUkRfNCc6IFNFTUFOVElDX1RFWENPT1JENCxcbiAgICAnVEVYQ09PUkRfNSc6IFNFTUFOVElDX1RFWENPT1JENSxcbiAgICAnVEVYQ09PUkRfNic6IFNFTUFOVElDX1RFWENPT1JENixcbiAgICAnVEVYQ09PUkRfNyc6IFNFTUFOVElDX1RFWENPT1JEN1xufTtcblxuLy8gcmV0dXJucyBhIGZ1bmN0aW9uIGZvciBkZXF1YW50aXppbmcgdGhlIGRhdGEgdHlwZVxuY29uc3QgZ2V0RGVxdWFudGl6ZUZ1bmMgPSAoc3JjVHlwZSkgPT4ge1xuICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vS2hyb25vc0dyb3VwL2dsVEYvdHJlZS9tYXN0ZXIvZXh0ZW5zaW9ucy8yLjAvS2hyb25vcy9LSFJfbWVzaF9xdWFudGl6YXRpb24jZW5jb2RpbmctcXVhbnRpemVkLWRhdGFcbiAgICBzd2l0Y2ggKHNyY1R5cGUpIHtcbiAgICAgICAgY2FzZSBUWVBFX0lOVDg6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAxMjcuMCwgLTEuMCk7XG4gICAgICAgIGNhc2UgVFlQRV9VSU5UODogcmV0dXJuIHggPT4geCAvIDI1NS4wO1xuICAgICAgICBjYXNlIFRZUEVfSU5UMTY6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAzMjc2Ny4wLCAtMS4wKTtcbiAgICAgICAgY2FzZSBUWVBFX1VJTlQxNjogcmV0dXJuIHggPT4geCAvIDY1NTM1LjA7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiB4ID0+IHg7XG4gICAgfVxufTtcblxuLy8gZGVxdWFudGl6ZSBhbiBhcnJheSBvZiBkYXRhXG5jb25zdCBkZXF1YW50aXplQXJyYXkgPSBmdW5jdGlvbiAoZHN0QXJyYXksIHNyY0FycmF5LCBzcmNUeXBlKSB7XG4gICAgY29uc3QgY29udkZ1bmMgPSBnZXREZXF1YW50aXplRnVuYyhzcmNUeXBlKTtcbiAgICBjb25zdCBsZW4gPSBzcmNBcnJheS5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBkc3RBcnJheVtpXSA9IGNvbnZGdW5jKHNyY0FycmF5W2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIGRzdEFycmF5O1xufTtcblxuLy8gZ2V0IGFjY2Vzc29yIGRhdGEsIG1ha2luZyBhIGNvcHkgYW5kIHBhdGNoaW5nIGluIHRoZSBjYXNlIG9mIGEgc3BhcnNlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckRhdGEgPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgZmxhdHRlbiA9IGZhbHNlKSB7XG4gICAgY29uc3QgbnVtQ29tcG9uZW50cyA9IGdldE51bUNvbXBvbmVudHMoZ2x0ZkFjY2Vzc29yLnR5cGUpO1xuICAgIGNvbnN0IGRhdGFUeXBlID0gZ2V0Q29tcG9uZW50RGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgIGlmICghZGF0YVR5cGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgYnVmZmVyVmlldyA9IGJ1ZmZlclZpZXdzW2dsdGZBY2Nlc3Nvci5idWZmZXJWaWV3XTtcbiAgICBsZXQgcmVzdWx0O1xuXG4gICAgaWYgKGdsdGZBY2Nlc3Nvci5zcGFyc2UpIHtcbiAgICAgICAgLy8gaGFuZGxlIHNwYXJzZSBkYXRhXG4gICAgICAgIGNvbnN0IHNwYXJzZSA9IGdsdGZBY2Nlc3Nvci5zcGFyc2U7XG5cbiAgICAgICAgLy8gZ2V0IGluZGljZXMgZGF0YVxuICAgICAgICBjb25zdCBpbmRpY2VzQWNjZXNzb3IgPSB7XG4gICAgICAgICAgICBjb3VudDogc3BhcnNlLmNvdW50LFxuICAgICAgICAgICAgdHlwZTogJ1NDQUxBUidcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgaW5kaWNlcyA9IGdldEFjY2Vzc29yRGF0YShPYmplY3QuYXNzaWduKGluZGljZXNBY2Nlc3Nvciwgc3BhcnNlLmluZGljZXMpLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG5cbiAgICAgICAgLy8gZGF0YSB2YWx1ZXMgZGF0YVxuICAgICAgICBjb25zdCB2YWx1ZXNBY2Nlc3NvciA9IHtcbiAgICAgICAgICAgIGNvdW50OiBzcGFyc2UuY291bnQsXG4gICAgICAgICAgICB0eXBlOiBnbHRmQWNjZXNzb3Iuc2NhbGFyLFxuICAgICAgICAgICAgY29tcG9uZW50VHlwZTogZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGVcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgdmFsdWVzID0gZ2V0QWNjZXNzb3JEYXRhKE9iamVjdC5hc3NpZ24odmFsdWVzQWNjZXNzb3IsIHNwYXJzZS52YWx1ZXMpLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG5cbiAgICAgICAgLy8gZ2V0IGJhc2UgZGF0YVxuICAgICAgICBpZiAoZ2x0ZkFjY2Vzc29yLmhhc093blByb3BlcnR5KCdidWZmZXJWaWV3JykpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2VBY2Nlc3NvciA9IHtcbiAgICAgICAgICAgICAgICBidWZmZXJWaWV3OiBnbHRmQWNjZXNzb3IuYnVmZmVyVmlldyxcbiAgICAgICAgICAgICAgICBieXRlT2Zmc2V0OiBnbHRmQWNjZXNzb3IuYnl0ZU9mZnNldCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiBnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgICAgICBjb3VudDogZ2x0ZkFjY2Vzc29yLmNvdW50LFxuICAgICAgICAgICAgICAgIHR5cGU6IGdsdGZBY2Nlc3Nvci50eXBlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8gbWFrZSBhIGNvcHkgb2YgdGhlIGJhc2UgZGF0YSBzaW5jZSB3ZSdsbCBwYXRjaCB0aGUgdmFsdWVzXG4gICAgICAgICAgICByZXN1bHQgPSBnZXRBY2Nlc3NvckRhdGEoYmFzZUFjY2Vzc29yLCBidWZmZXJWaWV3cywgdHJ1ZSkuc2xpY2UoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRoZXJlIGlzIG5vIGJhc2UgZGF0YSwgY3JlYXRlIGVtcHR5IDAnZCBvdXQgZGF0YVxuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcGFyc2UuY291bnQ7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0SW5kZXggPSBpbmRpY2VzW2ldO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1Db21wb25lbnRzOyArK2opIHtcbiAgICAgICAgICAgICAgICByZXN1bHRbdGFyZ2V0SW5kZXggKiBudW1Db21wb25lbnRzICsgal0gPSB2YWx1ZXNbaSAqIG51bUNvbXBvbmVudHMgKyBqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZmxhdHRlbiAmJiBidWZmZXJWaWV3Lmhhc093blByb3BlcnR5KCdieXRlU3RyaWRlJykpIHtcbiAgICAgICAgLy8gZmxhdHRlbiBzdHJpZGRlbiBkYXRhXG4gICAgICAgIGNvbnN0IGJ5dGVzUGVyRWxlbWVudCA9IG51bUNvbXBvbmVudHMgKiBkYXRhVHlwZS5CWVRFU19QRVJfRUxFTUVOVDtcbiAgICAgICAgY29uc3Qgc3RvcmFnZSA9IG5ldyBBcnJheUJ1ZmZlcihnbHRmQWNjZXNzb3IuY291bnQgKiBieXRlc1BlckVsZW1lbnQpO1xuICAgICAgICBjb25zdCB0bXBBcnJheSA9IG5ldyBVaW50OEFycmF5KHN0b3JhZ2UpO1xuXG4gICAgICAgIGxldCBkc3RPZmZzZXQgPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGZBY2Nlc3Nvci5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICAvLyBubyBuZWVkIHRvIGFkZCBidWZmZXJWaWV3LmJ5dGVPZmZzZXQgYmVjYXVzZSBhY2Nlc3NvciB0YWtlcyB0aGlzIGludG8gYWNjb3VudFxuICAgICAgICAgICAgbGV0IHNyY09mZnNldCA9IChnbHRmQWNjZXNzb3IuYnl0ZU9mZnNldCB8fCAwKSArIGkgKiBidWZmZXJWaWV3LmJ5dGVTdHJpZGU7XG4gICAgICAgICAgICBmb3IgKGxldCBiID0gMDsgYiA8IGJ5dGVzUGVyRWxlbWVudDsgKytiKSB7XG4gICAgICAgICAgICAgICAgdG1wQXJyYXlbZHN0T2Zmc2V0KytdID0gYnVmZmVyVmlld1tzcmNPZmZzZXQrK107XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoc3RvcmFnZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGJ1ZmZlclZpZXcuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyVmlldy5ieXRlT2Zmc2V0ICsgKGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0IHx8IDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZkFjY2Vzc29yLmNvdW50ICogbnVtQ29tcG9uZW50cyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdldCBhY2Nlc3NvciBkYXRhIGFzICh1bm5vcm1hbGl6ZWQsIHVucXVhbnRpemVkKSBGbG9hdDMyIGRhdGFcbmNvbnN0IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIgPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykge1xuICAgIGNvbnN0IGRhdGEgPSBnZXRBY2Nlc3NvckRhdGEoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgaWYgKGRhdGEgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgfHwgIWdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIC8vIGlmIHRoZSBzb3VyY2UgZGF0YSBpcyBxdWFudGl6ZWQgKHNheSB0byBpbnQxNiksIGJ1dCBub3Qgbm9ybWFsaXplZFxuICAgICAgICAvLyB0aGVuIHJlYWRpbmcgdGhlIHZhbHVlcyBvZiB0aGUgYXJyYXkgaXMgdGhlIHNhbWUgd2hldGhlciB0aGUgdmFsdWVzXG4gICAgICAgIC8vIGFyZSBzdG9yZWQgYXMgZmxvYXQzMiBvciBpbnQxNi4gc28gcHJvYmFibHkgbm8gbmVlZCB0byBjb252ZXJ0IHRvXG4gICAgICAgIC8vIGZsb2F0MzIuXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIGNvbnN0IGZsb2F0MzJEYXRhID0gbmV3IEZsb2F0MzJBcnJheShkYXRhLmxlbmd0aCk7XG4gICAgZGVxdWFudGl6ZUFycmF5KGZsb2F0MzJEYXRhLCBkYXRhLCBnZXRDb21wb25lbnRUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKSk7XG4gICAgcmV0dXJuIGZsb2F0MzJEYXRhO1xufTtcblxuLy8gcmV0dXJucyBhIGRlcXVhbnRpemVkIGJvdW5kaW5nIGJveCBmb3IgdGhlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckJvdW5kaW5nQm94ID0gZnVuY3Rpb24gKGdsdGZBY2Nlc3Nvcikge1xuICAgIGxldCBtaW4gPSBnbHRmQWNjZXNzb3IubWluO1xuICAgIGxldCBtYXggPSBnbHRmQWNjZXNzb3IubWF4O1xuICAgIGlmICghbWluIHx8ICFtYXgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIGNvbnN0IGN0eXBlID0gZ2V0Q29tcG9uZW50VHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgICAgIG1pbiA9IGRlcXVhbnRpemVBcnJheShbXSwgbWluLCBjdHlwZSk7XG4gICAgICAgIG1heCA9IGRlcXVhbnRpemVBcnJheShbXSwgbWF4LCBjdHlwZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCb3VuZGluZ0JveChcbiAgICAgICAgbmV3IFZlYzMoKG1heFswXSArIG1pblswXSkgKiAwLjUsIChtYXhbMV0gKyBtaW5bMV0pICogMC41LCAobWF4WzJdICsgbWluWzJdKSAqIDAuNSksXG4gICAgICAgIG5ldyBWZWMzKChtYXhbMF0gLSBtaW5bMF0pICogMC41LCAobWF4WzFdIC0gbWluWzFdKSAqIDAuNSwgKG1heFsyXSAtIG1pblsyXSkgKiAwLjUpXG4gICAgKTtcbn07XG5cbmNvbnN0IGdldFByaW1pdGl2ZVR5cGUgPSBmdW5jdGlvbiAocHJpbWl0aXZlKSB7XG4gICAgaWYgKCFwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ21vZGUnKSkge1xuICAgICAgICByZXR1cm4gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHByaW1pdGl2ZS5tb2RlKSB7XG4gICAgICAgIGNhc2UgMDogcmV0dXJuIFBSSU1JVElWRV9QT0lOVFM7XG4gICAgICAgIGNhc2UgMTogcmV0dXJuIFBSSU1JVElWRV9MSU5FUztcbiAgICAgICAgY2FzZSAyOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVMT09QO1xuICAgICAgICBjYXNlIDM6IHJldHVybiBQUklNSVRJVkVfTElORVNUUklQO1xuICAgICAgICBjYXNlIDQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgICAgICBjYXNlIDU6IHJldHVybiBQUklNSVRJVkVfVFJJU1RSSVA7XG4gICAgICAgIGNhc2UgNjogcmV0dXJuIFBSSU1JVElWRV9UUklGQU47XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgIH1cbn07XG5cbmNvbnN0IGdlbmVyYXRlSW5kaWNlcyA9IGZ1bmN0aW9uIChudW1WZXJ0aWNlcykge1xuICAgIGNvbnN0IGR1bW15SW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShudW1WZXJ0aWNlcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1WZXJ0aWNlczsgaSsrKSB7XG4gICAgICAgIGR1bW15SW5kaWNlc1tpXSA9IGk7XG4gICAgfVxuICAgIHJldHVybiBkdW1teUluZGljZXM7XG59O1xuXG5jb25zdCBnZW5lcmF0ZU5vcm1hbHMgPSBmdW5jdGlvbiAoc291cmNlRGVzYywgaW5kaWNlcykge1xuICAgIC8vIGdldCBwb3NpdGlvbnNcbiAgICBjb25zdCBwID0gc291cmNlRGVzY1tTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgaWYgKCFwIHx8IHAuY29tcG9uZW50cyAhPT0gMykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHBvc2l0aW9ucztcbiAgICBpZiAocC5zaXplICE9PSBwLnN0cmlkZSkge1xuICAgICAgICAvLyBleHRyYWN0IHBvc2l0aW9ucyB3aGljaCBhcmVuJ3QgdGlnaHRseSBwYWNrZWRcbiAgICAgICAgY29uc3Qgc3JjU3RyaWRlID0gcC5zdHJpZGUgLyB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVtwLnR5cGVdO1xuICAgICAgICBjb25zdCBzcmMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogc3JjU3RyaWRlKTtcbiAgICAgICAgcG9zaXRpb25zID0gbmV3IHR5cGVkQXJyYXlUeXBlc1twLnR5cGVdKHAuY291bnQgKiAzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDBdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAwXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDFdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAxXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDJdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAyXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBvc2l0aW9uIGRhdGEgaXMgdGlnaHRseSBwYWNrZWQgc28gd2UgY2FuIHVzZSBpdCBkaXJlY3RseVxuICAgICAgICBwb3NpdGlvbnMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogMyk7XG4gICAgfVxuXG4gICAgY29uc3QgbnVtVmVydGljZXMgPSBwLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgaW5kaWNlcyBpZiBuZWNlc3NhcnlcbiAgICBpZiAoIWluZGljZXMpIHtcbiAgICAgICAgaW5kaWNlcyA9IGdlbmVyYXRlSW5kaWNlcyhudW1WZXJ0aWNlcyk7XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFsc1xuICAgIGNvbnN0IG5vcm1hbHNUZW1wID0gY2FsY3VsYXRlTm9ybWFscyhwb3NpdGlvbnMsIGluZGljZXMpO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KG5vcm1hbHNUZW1wLmxlbmd0aCk7XG4gICAgbm9ybWFscy5zZXQobm9ybWFsc1RlbXApO1xuXG4gICAgc291cmNlRGVzY1tTRU1BTlRJQ19OT1JNQUxdID0ge1xuICAgICAgICBidWZmZXI6IG5vcm1hbHMuYnVmZmVyLFxuICAgICAgICBzaXplOiAxMixcbiAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICBzdHJpZGU6IDEyLFxuICAgICAgICBjb3VudDogbnVtVmVydGljZXMsXG4gICAgICAgIGNvbXBvbmVudHM6IDMsXG4gICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgIH07XG59O1xuXG5jb25zdCBmbGlwVGV4Q29vcmRWcyA9IGZ1bmN0aW9uICh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICBsZXQgaSwgajtcblxuICAgIGNvbnN0IGZsb2F0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IHNob3J0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IGJ5dGVPZmZzZXRzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIGlmIChlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMCB8fFxuICAgICAgICAgICAgZWxlbWVudC5uYW1lID09PSBTRU1BTlRJQ19URVhDT09SRDEpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoZWxlbWVudC5kYXRhVHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9GTE9BVDMyOlxuICAgICAgICAgICAgICAgICAgICBmbG9hdE9mZnNldHMucHVzaCh7IG9mZnNldDogZWxlbWVudC5vZmZzZXQgLyA0ICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSAvIDQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMTY6XG4gICAgICAgICAgICAgICAgICAgIHNob3J0T2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCAvIDIgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIC8gMiB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OlxuICAgICAgICAgICAgICAgICAgICBieXRlT2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZmxpcCA9IGZ1bmN0aW9uIChvZmZzZXRzLCB0eXBlLCBvbmUpIHtcbiAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyB0eXBlKHZlcnRleEJ1ZmZlci5zdG9yYWdlKTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG9mZnNldHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IG9mZnNldHNbaV0ub2Zmc2V0O1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gb2Zmc2V0c1tpXS5zdHJpZGU7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgdmVydGV4QnVmZmVyLm51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICB0eXBlZEFycmF5W2luZGV4XSA9IG9uZSAtIHR5cGVkQXJyYXlbaW5kZXhdO1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IHN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoZmxvYXRPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChmbG9hdE9mZnNldHMsIEZsb2F0MzJBcnJheSwgMS4wKTtcbiAgICB9XG4gICAgaWYgKHNob3J0T2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoc2hvcnRPZmZzZXRzLCBVaW50MTZBcnJheSwgNjU1MzUpO1xuICAgIH1cbiAgICBpZiAoYnl0ZU9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKGJ5dGVPZmZzZXRzLCBVaW50OEFycmF5LCAyNTUpO1xuICAgIH1cbn07XG5cbi8vIGdpdmVuIGEgdGV4dHVyZSwgY2xvbmUgaXRcbi8vIE5PVEU6IENQVS1zaWRlIHRleHR1cmUgZGF0YSB3aWxsIGJlIHNoYXJlZCBidXQgR1BVIG1lbW9yeSB3aWxsIGJlIGR1cGxpY2F0ZWRcbmNvbnN0IGNsb25lVGV4dHVyZSA9IGZ1bmN0aW9uICh0ZXh0dXJlKSB7XG4gICAgY29uc3Qgc2hhbGxvd0NvcHlMZXZlbHMgPSBmdW5jdGlvbiAodGV4dHVyZSkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgbWlwID0gMDsgbWlwIDwgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aDsgKyttaXApIHtcbiAgICAgICAgICAgIGxldCBsZXZlbCA9IFtdO1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgKytmYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsLnB1c2godGV4dHVyZS5fbGV2ZWxzW21pcF1bZmFjZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwgPSB0ZXh0dXJlLl9sZXZlbHNbbWlwXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgVGV4dHVyZSh0ZXh0dXJlLmRldmljZSwgdGV4dHVyZSk7ICAgLy8gZHVwbGljYXRlIHRleHR1cmVcbiAgICByZXN1bHQuX2xldmVscyA9IHNoYWxsb3dDb3B5TGV2ZWxzKHRleHR1cmUpOyAgICAgICAgICAgIC8vIHNoYWxsb3cgY29weSB0aGUgbGV2ZWxzIHN0cnVjdHVyZVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnaXZlbiBhIHRleHR1cmUgYXNzZXQsIGNsb25lIGl0XG5jb25zdCBjbG9uZVRleHR1cmVBc3NldCA9IGZ1bmN0aW9uIChzcmMpIHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgQXNzZXQoc3JjLm5hbWUgKyAnX2Nsb25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5maWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMuZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLm9wdGlvbnMpO1xuICAgIHJlc3VsdC5sb2FkZWQgPSB0cnVlO1xuICAgIHJlc3VsdC5yZXNvdXJjZSA9IGNsb25lVGV4dHVyZShzcmMucmVzb3VyY2UpO1xuICAgIHNyYy5yZWdpc3RyeS5hZGQocmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwgPSBmdW5jdGlvbiAoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVikge1xuICAgIGNvbnN0IHBvc2l0aW9uRGVzYyA9IHNvdXJjZURlc2NbU0VNQU5USUNfUE9TSVRJT05dO1xuICAgIGlmICghcG9zaXRpb25EZXNjKSB7XG4gICAgICAgIC8vIGlnbm9yZSBtZXNoZXMgd2l0aG91dCBwb3NpdGlvbnNcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IG51bVZlcnRpY2VzID0gcG9zaXRpb25EZXNjLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgdmVydGV4RGVzYyBlbGVtZW50c1xuICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHNlbWFudGljIGluIHNvdXJjZURlc2MpIHtcbiAgICAgICAgaWYgKHNvdXJjZURlc2MuaGFzT3duUHJvcGVydHkoc2VtYW50aWMpKSB7XG4gICAgICAgICAgICB2ZXJ0ZXhEZXNjLnB1c2goe1xuICAgICAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBzb3VyY2VEZXNjW3NlbWFudGljXS5jb21wb25lbnRzLFxuICAgICAgICAgICAgICAgIHR5cGU6IHNvdXJjZURlc2Nbc2VtYW50aWNdLnR5cGUsXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiAhIXNvdXJjZURlc2Nbc2VtYW50aWNdLm5vcm1hbGl6ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBvcmRlciB2ZXJ0ZXhEZXNjIHRvIG1hdGNoIHRoZSByZXN0IG9mIHRoZSBlbmdpbmVcbiAgICBjb25zdCBlbGVtZW50T3JkZXIgPSBbXG4gICAgICAgIFNFTUFOVElDX1BPU0lUSU9OLFxuICAgICAgICBTRU1BTlRJQ19OT1JNQUwsXG4gICAgICAgIFNFTUFOVElDX1RBTkdFTlQsXG4gICAgICAgIFNFTUFOVElDX0NPTE9SLFxuICAgICAgICBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgICAgIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgICAgICBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgICAgIFNFTUFOVElDX1RFWENPT1JEMVxuICAgIF07XG5cbiAgICAvLyBzb3J0IHZlcnRleCBlbGVtZW50cyBieSBlbmdpbmUtaWRlYWwgb3JkZXJcbiAgICB2ZXJ0ZXhEZXNjLnNvcnQoZnVuY3Rpb24gKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IGxoc09yZGVyID0gZWxlbWVudE9yZGVyLmluZGV4T2YobGhzLnNlbWFudGljKTtcbiAgICAgICAgY29uc3QgcmhzT3JkZXIgPSBlbGVtZW50T3JkZXIuaW5kZXhPZihyaHMuc2VtYW50aWMpO1xuICAgICAgICByZXR1cm4gKGxoc09yZGVyIDwgcmhzT3JkZXIpID8gLTEgOiAocmhzT3JkZXIgPCBsaHNPcmRlciA/IDEgOiAwKTtcbiAgICB9KTtcblxuICAgIGxldCBpLCBqLCBrO1xuICAgIGxldCBzb3VyY2UsIHRhcmdldCwgc291cmNlT2Zmc2V0O1xuXG4gICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdChkZXZpY2UsIHZlcnRleERlc2MpO1xuXG4gICAgLy8gY2hlY2sgd2hldGhlciBzb3VyY2UgZGF0YSBpcyBjb3JyZWN0bHkgaW50ZXJsZWF2ZWRcbiAgICBsZXQgaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCA9IHRydWU7XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB0YXJnZXQgPSB2ZXJ0ZXhGb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIHNvdXJjZSA9IHNvdXJjZURlc2NbdGFyZ2V0Lm5hbWVdO1xuICAgICAgICBzb3VyY2VPZmZzZXQgPSBzb3VyY2Uub2Zmc2V0IC0gcG9zaXRpb25EZXNjLm9mZnNldDtcbiAgICAgICAgaWYgKChzb3VyY2UuYnVmZmVyICE9PSBwb3NpdGlvbkRlc2MuYnVmZmVyKSB8fFxuICAgICAgICAgICAgKHNvdXJjZS5zdHJpZGUgIT09IHRhcmdldC5zdHJpZGUpIHx8XG4gICAgICAgICAgICAoc291cmNlLnNpemUgIT09IHRhcmdldC5zaXplKSB8fFxuICAgICAgICAgICAgKHNvdXJjZU9mZnNldCAhPT0gdGFyZ2V0Lm9mZnNldCkpIHtcbiAgICAgICAgICAgIGlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlIHZlcnRleCBidWZmZXJcbiAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKGRldmljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnRleEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bVZlcnRpY2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQlVGRkVSX1NUQVRJQyk7XG5cbiAgICBjb25zdCB2ZXJ0ZXhEYXRhID0gdmVydGV4QnVmZmVyLmxvY2soKTtcbiAgICBjb25zdCB0YXJnZXRBcnJheSA9IG5ldyBVaW50MzJBcnJheSh2ZXJ0ZXhEYXRhKTtcbiAgICBsZXQgc291cmNlQXJyYXk7XG5cbiAgICBpZiAoaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCkge1xuICAgICAgICAvLyBjb3B5IGRhdGFcbiAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkocG9zaXRpb25EZXNjLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25EZXNjLm9mZnNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmVydGljZXMgKiB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnNpemUgLyA0KTtcbiAgICAgICAgdGFyZ2V0QXJyYXkuc2V0KHNvdXJjZUFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgdGFyZ2V0U3RyaWRlLCBzb3VyY2VTdHJpZGU7XG4gICAgICAgIC8vIGNvcHkgZGF0YSBhbmQgaW50ZXJsZWF2ZVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgICAgIHRhcmdldFN0cmlkZSA9IHRhcmdldC5zdHJpZGUgLyA0O1xuXG4gICAgICAgICAgICBzb3VyY2UgPSBzb3VyY2VEZXNjW3RhcmdldC5uYW1lXTtcbiAgICAgICAgICAgIHNvdXJjZVN0cmlkZSA9IHNvdXJjZS5zdHJpZGUgLyA0O1xuICAgICAgICAgICAgLy8gZW5zdXJlIHdlIGRvbid0IGdvIGJleW9uZCB0aGUgZW5kIG9mIHRoZSBhcnJheWJ1ZmZlciB3aGVuIGRlYWxpbmcgd2l0aFxuICAgICAgICAgICAgLy8gaW50ZXJsYWNlZCB2ZXJ0ZXggZm9ybWF0c1xuICAgICAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkoc291cmNlLmJ1ZmZlciwgc291cmNlLm9mZnNldCwgKHNvdXJjZS5jb3VudCAtIDEpICogc291cmNlU3RyaWRlICsgKHNvdXJjZS5zaXplICsgMykgLyA0KTtcblxuICAgICAgICAgICAgbGV0IHNyYyA9IDA7XG4gICAgICAgICAgICBsZXQgZHN0ID0gdGFyZ2V0Lm9mZnNldCAvIDQ7XG4gICAgICAgICAgICBjb25zdCBrZW5kID0gTWF0aC5mbG9vcigoc291cmNlLnNpemUgKyAzKSAvIDQpO1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IG51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwga2VuZDsgKytrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldEFycmF5W2RzdCArIGtdID0gc291cmNlQXJyYXlbc3JjICsga107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNyYyArPSBzb3VyY2VTdHJpZGU7XG4gICAgICAgICAgICAgICAgZHN0ICs9IHRhcmdldFN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmbGlwVikge1xuICAgICAgICBmbGlwVGV4Q29vcmRWcyh2ZXJ0ZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIHZlcnRleEJ1ZmZlci51bmxvY2soKTtcblxuICAgIHJldHVybiB2ZXJ0ZXhCdWZmZXI7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXIgPSBmdW5jdGlvbiAoZGV2aWNlLCBhdHRyaWJ1dGVzLCBpbmRpY2VzLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCkge1xuXG4gICAgLy8gZXh0cmFjdCBsaXN0IG9mIGF0dHJpYnV0ZXMgdG8gdXNlXG4gICAgY29uc3QgdXNlQXR0cmlidXRlcyA9IHt9O1xuICAgIGNvbnN0IGF0dHJpYklkcyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBhdHRyaWIgaW4gYXR0cmlidXRlcykge1xuICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShhdHRyaWIpICYmIGdsdGZUb0VuZ2luZVNlbWFudGljTWFwLmhhc093blByb3BlcnR5KGF0dHJpYikpIHtcbiAgICAgICAgICAgIHVzZUF0dHJpYnV0ZXNbYXR0cmliXSA9IGF0dHJpYnV0ZXNbYXR0cmliXTtcblxuICAgICAgICAgICAgLy8gYnVpbGQgdW5pcXVlIGlkIGZvciBlYWNoIGF0dHJpYnV0ZSBpbiBmb3JtYXQ6IFNlbWFudGljOmFjY2Vzc29ySW5kZXhcbiAgICAgICAgICAgIGF0dHJpYklkcy5wdXNoKGF0dHJpYiArICc6JyArIGF0dHJpYnV0ZXNbYXR0cmliXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHVuaXF1ZSBpZHMgYW5kIGNyZWF0ZSB1bmlxdWUgdmVydGV4IGJ1ZmZlciBJRFxuICAgIGF0dHJpYklkcy5zb3J0KCk7XG4gICAgY29uc3QgdmJLZXkgPSBhdHRyaWJJZHMuam9pbigpO1xuXG4gICAgLy8gcmV0dXJuIGFscmVhZHkgY3JlYXRlZCB2ZXJ0ZXggYnVmZmVyIGlmIGlkZW50aWNhbFxuICAgIGxldCB2YiA9IHZlcnRleEJ1ZmZlckRpY3RbdmJLZXldO1xuICAgIGlmICghdmIpIHtcbiAgICAgICAgLy8gYnVpbGQgdmVydGV4IGJ1ZmZlciBmb3JtYXQgZGVzYyBhbmQgc291cmNlXG4gICAgICAgIGNvbnN0IHNvdXJjZURlc2MgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyaWIgaW4gdXNlQXR0cmlidXRlcykge1xuICAgICAgICAgICAgY29uc3QgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbYXR0cmlidXRlc1thdHRyaWJdXTtcbiAgICAgICAgICAgIGNvbnN0IGFjY2Vzc29yRGF0YSA9IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyVmlldyA9IGJ1ZmZlclZpZXdzW2FjY2Vzc29yLmJ1ZmZlclZpZXddO1xuICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFthdHRyaWJdO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSkgKiBnZXRDb21wb25lbnRTaXplSW5CeXRlcyhhY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgIGNvbnN0IHN0cmlkZSA9IGJ1ZmZlclZpZXcuaGFzT3duUHJvcGVydHkoJ2J5dGVTdHJpZGUnKSA/IGJ1ZmZlclZpZXcuYnl0ZVN0cmlkZSA6IHNpemU7XG4gICAgICAgICAgICBzb3VyY2VEZXNjW3NlbWFudGljXSA9IHtcbiAgICAgICAgICAgICAgICBidWZmZXI6IGFjY2Vzc29yRGF0YS5idWZmZXIsXG4gICAgICAgICAgICAgICAgc2l6ZTogc2l6ZSxcbiAgICAgICAgICAgICAgICBvZmZzZXQ6IGFjY2Vzc29yRGF0YS5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgICAgIHN0cmlkZTogc3RyaWRlLFxuICAgICAgICAgICAgICAgIGNvdW50OiBhY2Nlc3Nvci5jb3VudCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBnZXROdW1Db21wb25lbnRzKGFjY2Vzc29yLnR5cGUpLFxuICAgICAgICAgICAgICAgIHR5cGU6IGdldENvbXBvbmVudFR5cGUoYWNjZXNzb3IuY29tcG9uZW50VHlwZSksXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiBhY2Nlc3Nvci5ub3JtYWxpemVkXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgbm9ybWFscyBpZiB0aGV5J3JlIG1pc3NpbmcgKHRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIGEgdXNlciBvcHRpb24pXG4gICAgICAgIGlmICghc291cmNlRGVzYy5oYXNPd25Qcm9wZXJ0eShTRU1BTlRJQ19OT1JNQUwpKSB7XG4gICAgICAgICAgICBnZW5lcmF0ZU5vcm1hbHMoc291cmNlRGVzYywgaW5kaWNlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgYW5kIHN0b3JlIGl0IGluIHRoZSBkaWN0aW9uYXJ5XG4gICAgICAgIHZiID0gY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVik7XG4gICAgICAgIHZlcnRleEJ1ZmZlckRpY3RbdmJLZXldID0gdmI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZiO1xufTtcblxuY29uc3QgY3JlYXRlVmVydGV4QnVmZmVyRHJhY28gPSBmdW5jdGlvbiAoZGV2aWNlLCBvdXRwdXRHZW9tZXRyeSwgZXh0RHJhY28sIGRlY29kZXIsIGRlY29kZXJNb2R1bGUsIGluZGljZXMsIGZsaXBWKSB7XG5cbiAgICBjb25zdCBudW1Qb2ludHMgPSBvdXRwdXRHZW9tZXRyeS5udW1fcG9pbnRzKCk7XG5cbiAgICAvLyBoZWxwZXIgZnVuY3Rpb24gdG8gZGVjb2RlIGRhdGEgc3RyZWFtIHdpdGggaWQgdG8gVHlwZWRBcnJheSBvZiBhcHByb3ByaWF0ZSB0eXBlXG4gICAgY29uc3QgZXh0cmFjdERyYWNvQXR0cmlidXRlSW5mbyA9IGZ1bmN0aW9uICh1bmlxdWVJZCwgc2VtYW50aWMpIHtcbiAgICAgICAgY29uc3QgYXR0cmlidXRlID0gZGVjb2Rlci5HZXRBdHRyaWJ1dGVCeVVuaXF1ZUlkKG91dHB1dEdlb21ldHJ5LCB1bmlxdWVJZCk7XG4gICAgICAgIGNvbnN0IG51bVZhbHVlcyA9IG51bVBvaW50cyAqIGF0dHJpYnV0ZS5udW1fY29tcG9uZW50cygpO1xuICAgICAgICBjb25zdCBkcmFjb0Zvcm1hdCA9IGF0dHJpYnV0ZS5kYXRhX3R5cGUoKTtcbiAgICAgICAgbGV0IHB0ciwgdmFsdWVzLCBjb21wb25lbnRTaXplSW5CeXRlcywgc3RvcmFnZVR5cGU7XG5cbiAgICAgICAgLy8gc3RvcmFnZSBmb3JtYXQgaXMgYmFzZWQgb24gZHJhY28gYXR0cmlidXRlIGRhdGEgdHlwZVxuICAgICAgICBzd2l0Y2ggKGRyYWNvRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5EVF9VSU5UODpcbiAgICAgICAgICAgICAgICBzdG9yYWdlVHlwZSA9IFRZUEVfVUlOVDg7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50U2l6ZUluQnl0ZXMgPSAxO1xuICAgICAgICAgICAgICAgIHB0ciA9IGRlY29kZXJNb2R1bGUuX21hbGxvYyhudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcyk7XG4gICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMob3V0cHV0R2VvbWV0cnksIGF0dHJpYnV0ZSwgZGVjb2Rlck1vZHVsZS5EVF9VSU5UOCwgbnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMsIHB0cik7XG4gICAgICAgICAgICAgICAgdmFsdWVzID0gbmV3IFVpbnQ4QXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQVTguYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX1VJTlQxNjpcbiAgICAgICAgICAgICAgICBzdG9yYWdlVHlwZSA9IFRZUEVfVUlOVDE2O1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzID0gMjtcbiAgICAgICAgICAgICAgICBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MobnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMpO1xuICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0QXR0cmlidXRlRGF0YUFycmF5Rm9yQWxsUG9pbnRzKG91dHB1dEdlb21ldHJ5LCBhdHRyaWJ1dGUsIGRlY29kZXJNb2R1bGUuRFRfVUlOVDE2LCBudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcywgcHRyKTtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBuZXcgVWludDE2QXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQVTE2LmJ1ZmZlciwgcHRyLCBudW1WYWx1ZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5EVF9GTE9BVDMyOlxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBzdG9yYWdlVHlwZSA9IFRZUEVfRkxPQVQzMjtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRTaXplSW5CeXRlcyA9IDQ7XG4gICAgICAgICAgICAgICAgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzKTtcbiAgICAgICAgICAgICAgICBkZWNvZGVyLkdldEF0dHJpYnV0ZURhdGFBcnJheUZvckFsbFBvaW50cyhvdXRwdXRHZW9tZXRyeSwgYXR0cmlidXRlLCBkZWNvZGVyTW9kdWxlLkRUX0ZMT0FUMzIsIG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBwdHIpO1xuICAgICAgICAgICAgICAgIHZhbHVlcyA9IG5ldyBGbG9hdDMyQXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQRjMyLmJ1ZmZlciwgcHRyLCBudW1WYWx1ZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBkZWNvZGVyTW9kdWxlLl9mcmVlKHB0cik7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHZhbHVlczogdmFsdWVzLFxuICAgICAgICAgICAgbnVtQ29tcG9uZW50czogYXR0cmlidXRlLm51bV9jb21wb25lbnRzKCksXG4gICAgICAgICAgICBjb21wb25lbnRTaXplSW5CeXRlczogY29tcG9uZW50U2l6ZUluQnl0ZXMsXG4gICAgICAgICAgICBzdG9yYWdlVHlwZTogc3RvcmFnZVR5cGUsXG5cbiAgICAgICAgICAgIC8vIHRoZXJlIGFyZSBnbGIgZmlsZXMgYXJvdW5kIHdoZXJlIDhiaXQgY29sb3JzIGFyZSBtaXNzaW5nIG5vcm1hbGl6ZWQgZmxhZ1xuICAgICAgICAgICAgbm9ybWFsaXplZDogKHNlbWFudGljID09PSBTRU1BTlRJQ19DT0xPUiAmJiBzdG9yYWdlVHlwZSA9PT0gVFlQRV9VSU5UOCkgPyB0cnVlIDogYXR0cmlidXRlLm5vcm1hbGl6ZWQoKVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICAvLyBidWlsZCB2ZXJ0ZXggYnVmZmVyIGZvcm1hdCBkZXNjIGFuZCBzb3VyY2VcbiAgICBjb25zdCBzb3VyY2VEZXNjID0ge307XG4gICAgY29uc3QgYXR0cmlidXRlcyA9IGV4dERyYWNvLmF0dHJpYnV0ZXM7XG4gICAgZm9yIChjb25zdCBhdHRyaWIgaW4gYXR0cmlidXRlcykge1xuICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShhdHRyaWIpICYmIGdsdGZUb0VuZ2luZVNlbWFudGljTWFwLmhhc093blByb3BlcnR5KGF0dHJpYikpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlbWFudGljID0gZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXBbYXR0cmliXTtcbiAgICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZUluZm8gPSBleHRyYWN0RHJhY29BdHRyaWJ1dGVJbmZvKGF0dHJpYnV0ZXNbYXR0cmliXSwgc2VtYW50aWMpO1xuXG4gICAgICAgICAgICAvLyBzdG9yZSB0aGUgaW5mbyB3ZSdsbCBuZWVkIHRvIGNvcHkgdGhpcyBkYXRhIGludG8gdGhlIHZlcnRleCBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IHNpemUgPSBhdHRyaWJ1dGVJbmZvLm51bUNvbXBvbmVudHMgKiBhdHRyaWJ1dGVJbmZvLmNvbXBvbmVudFNpemVJbkJ5dGVzO1xuICAgICAgICAgICAgc291cmNlRGVzY1tzZW1hbnRpY10gPSB7XG4gICAgICAgICAgICAgICAgdmFsdWVzOiBhdHRyaWJ1dGVJbmZvLnZhbHVlcyxcbiAgICAgICAgICAgICAgICBidWZmZXI6IGF0dHJpYnV0ZUluZm8udmFsdWVzLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgICAgIG9mZnNldDogMCxcbiAgICAgICAgICAgICAgICBzdHJpZGU6IHNpemUsXG4gICAgICAgICAgICAgICAgY291bnQ6IG51bVBvaW50cyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBhdHRyaWJ1dGVJbmZvLm51bUNvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgdHlwZTogYXR0cmlidXRlSW5mby5zdG9yYWdlVHlwZSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6IGF0dHJpYnV0ZUluZm8ubm9ybWFsaXplZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGdlbmVyYXRlIG5vcm1hbHMgaWYgdGhleSdyZSBtaXNzaW5nICh0aGlzIHNob3VsZCBwcm9iYWJseSBiZSBhIHVzZXIgb3B0aW9uKVxuICAgIGlmICghc291cmNlRGVzYy5oYXNPd25Qcm9wZXJ0eShTRU1BTlRJQ19OT1JNQUwpKSB7XG4gICAgICAgIGdlbmVyYXRlTm9ybWFscyhzb3VyY2VEZXNjLCBpbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVik7XG59O1xuXG5jb25zdCBjcmVhdGVTa2luID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0ZlNraW4sIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIG5vZGVzLCBnbGJTa2lucykge1xuICAgIGxldCBpLCBqLCBiaW5kTWF0cml4O1xuICAgIGNvbnN0IGpvaW50cyA9IGdsdGZTa2luLmpvaW50cztcbiAgICBjb25zdCBudW1Kb2ludHMgPSBqb2ludHMubGVuZ3RoO1xuICAgIGNvbnN0IGlicCA9IFtdO1xuICAgIGlmIChnbHRmU2tpbi5oYXNPd25Qcm9wZXJ0eSgnaW52ZXJzZUJpbmRNYXRyaWNlcycpKSB7XG4gICAgICAgIGNvbnN0IGludmVyc2VCaW5kTWF0cmljZXMgPSBnbHRmU2tpbi5pbnZlcnNlQmluZE1hdHJpY2VzO1xuICAgICAgICBjb25zdCBpYm1EYXRhID0gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yc1tpbnZlcnNlQmluZE1hdHJpY2VzXSwgYnVmZmVyVmlld3MsIHRydWUpO1xuICAgICAgICBjb25zdCBpYm1WYWx1ZXMgPSBbXTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCAxNjsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWJtVmFsdWVzW2pdID0gaWJtRGF0YVtpICogMTYgKyBqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJpbmRNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgYmluZE1hdHJpeC5zZXQoaWJtVmFsdWVzKTtcbiAgICAgICAgICAgIGlicC5wdXNoKGJpbmRNYXRyaXgpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG51bUpvaW50czsgaSsrKSB7XG4gICAgICAgICAgICBiaW5kTWF0cml4ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgICAgIGlicC5wdXNoKGJpbmRNYXRyaXgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYm9uZU5hbWVzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IG51bUpvaW50czsgaSsrKSB7XG4gICAgICAgIGJvbmVOYW1lc1tpXSA9IG5vZGVzW2pvaW50c1tpXV0ubmFtZTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgYSBjYWNoZSBrZXkgZnJvbSBib25lIG5hbWVzIGFuZCBzZWUgaWYgd2UgaGF2ZSBtYXRjaGluZyBza2luXG4gICAgY29uc3Qga2V5ID0gYm9uZU5hbWVzLmpvaW4oJyMnKTtcbiAgICBsZXQgc2tpbiA9IGdsYlNraW5zLmdldChrZXkpO1xuICAgIGlmICghc2tpbikge1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgc2tpbiBhbmQgYWRkIGl0IHRvIHRoZSBjYWNoZVxuICAgICAgICBza2luID0gbmV3IFNraW4oZGV2aWNlLCBpYnAsIGJvbmVOYW1lcyk7XG4gICAgICAgIGdsYlNraW5zLnNldChrZXksIHNraW4pO1xuICAgIH1cblxuICAgIHJldHVybiBza2luO1xufTtcblxuY29uc3QgdGVtcE1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB0ZW1wVmVjID0gbmV3IFZlYzMoKTtcblxuY29uc3QgY3JlYXRlTWVzaCA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGZNZXNoLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBjYWxsYmFjaywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIGFzc2V0T3B0aW9ucykge1xuICAgIGNvbnN0IG1lc2hlcyA9IFtdO1xuXG4gICAgZ2x0Zk1lc2gucHJpbWl0aXZlcy5mb3JFYWNoKGZ1bmN0aW9uIChwcmltaXRpdmUpIHtcblxuICAgICAgICBsZXQgcHJpbWl0aXZlVHlwZSwgdmVydGV4QnVmZmVyLCBudW1JbmRpY2VzO1xuICAgICAgICBsZXQgaW5kaWNlcyA9IG51bGw7XG4gICAgICAgIGxldCBjYW5Vc2VNb3JwaCA9IHRydWU7XG5cbiAgICAgICAgLy8gdHJ5IGFuZCBnZXQgZHJhY28gY29tcHJlc3NlZCBkYXRhIGZpcnN0XG4gICAgICAgIGlmIChwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSkge1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9ucyA9IHByaW1pdGl2ZS5leHRlbnNpb25zO1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uJykpIHtcblxuICAgICAgICAgICAgICAgIC8vIGFjY2VzcyBEcmFjb0RlY29kZXJNb2R1bGVcbiAgICAgICAgICAgICAgICBjb25zdCBkZWNvZGVyTW9kdWxlID0gZHJhY29EZWNvZGVySW5zdGFuY2UgfHwgZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlKCk7XG4gICAgICAgICAgICAgICAgaWYgKGRlY29kZXJNb2R1bGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0RHJhY28gPSBleHRlbnNpb25zLktIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0RHJhY28uaGFzT3duUHJvcGVydHkoJ2F0dHJpYnV0ZXMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdWludDhCdWZmZXIgPSBidWZmZXJWaWV3c1tleHREcmFjby5idWZmZXJWaWV3XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBkZWNvZGVyTW9kdWxlLkRlY29kZXJCdWZmZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5Jbml0KHVpbnQ4QnVmZmVyLCB1aW50OEJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWNvZGVyID0gbmV3IGRlY29kZXJNb2R1bGUuRGVjb2RlcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2VvbWV0cnlUeXBlID0gZGVjb2Rlci5HZXRFbmNvZGVkR2VvbWV0cnlUeXBlKGJ1ZmZlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBvdXRwdXRHZW9tZXRyeSwgc3RhdHVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChnZW9tZXRyeVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuUE9JTlRfQ0xPVUQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW1pdGl2ZVR5cGUgPSBQUklNSVRJVkVfUE9JTlRTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRHZW9tZXRyeSA9IG5ldyBkZWNvZGVyTW9kdWxlLlBvaW50Q2xvdWQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzID0gZGVjb2Rlci5EZWNvZGVCdWZmZXJUb1BvaW50Q2xvdWQoYnVmZmVyLCBvdXRwdXRHZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5UUklBTkdVTEFSX01FU0g6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW1pdGl2ZVR5cGUgPSBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRHZW9tZXRyeSA9IG5ldyBkZWNvZGVyTW9kdWxlLk1lc2goKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzID0gZGVjb2Rlci5EZWNvZGVCdWZmZXJUb01lc2goYnVmZmVyLCBvdXRwdXRHZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5JTlZBTElEX0dFT01FVFJZX1RZUEU6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc3RhdHVzIHx8ICFzdGF0dXMub2soKSB8fCBvdXRwdXRHZW9tZXRyeS5wdHIgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygnRmFpbGVkIHRvIGRlY29kZSBkcmFjbyBjb21wcmVzc2VkIGFzc2V0OiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoc3RhdHVzID8gc3RhdHVzLmVycm9yX21zZygpIDogKCdNZXNoIGFzc2V0IC0gaW52YWxpZCBkcmFjbyBjb21wcmVzc2VkIGdlb21ldHJ5IHR5cGU6ICcgKyBnZW9tZXRyeVR5cGUpKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpbmRpY2VzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBudW1GYWNlcyA9IG91dHB1dEdlb21ldHJ5Lm51bV9mYWNlcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdlb21ldHJ5VHlwZSA9PT0gZGVjb2Rlck1vZHVsZS5UUklBTkdVTEFSX01FU0gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiaXQzMiA9IG91dHB1dEdlb21ldHJ5Lm51bV9wb2ludHMoKSA+IDY1NTM1O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtSW5kaWNlcyA9IG51bUZhY2VzICogMztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhU2l6ZSA9IG51bUluZGljZXMgKiAoYml0MzIgPyA0IDogMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKGRhdGFTaXplKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiaXQzMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyLkdldFRyaWFuZ2xlc1VJbnQzMkFycmF5KG91dHB1dEdlb21ldHJ5LCBkYXRhU2l6ZSwgcHRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MzJBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMzIuYnVmZmVyLCBwdHIsIG51bUluZGljZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRUcmlhbmdsZXNVSW50MTZBcnJheShvdXRwdXRHZW9tZXRyeSwgZGF0YVNpemUsIHB0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGljZXMgPSBuZXcgVWludDE2QXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQVTE2LmJ1ZmZlciwgcHRyLCBudW1JbmRpY2VzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXJNb2R1bGUuX2ZyZWUocHRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmVydGljZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcnRleEJ1ZmZlciA9IGNyZWF0ZVZlcnRleEJ1ZmZlckRyYWNvKGRldmljZSwgb3V0cHV0R2VvbWV0cnksIGV4dERyYWNvLCBkZWNvZGVyLCBkZWNvZGVyTW9kdWxlLCBpbmRpY2VzLCBmbGlwVik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNsZWFuIHVwXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLmRlc3Ryb3kob3V0cHV0R2VvbWV0cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5kZXN0cm95KGRlY29kZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5kZXN0cm95KGJ1ZmZlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1vcnBoIHN0cmVhbXMgYXJlIG5vdCBjb21wYXRpYmxlIHdpdGggZHJhY28gY29tcHJlc3Npb24sIGRpc2FibGUgbW9ycGhpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhblVzZU1vcnBoID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdGaWxlIGNvbnRhaW5zIGRyYWNvIGNvbXByZXNzZWQgZGF0YSwgYnV0IERyYWNvRGVjb2Rlck1vZHVsZSBpcyBub3QgY29uZmlndXJlZC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBtZXNoIHdhcyBub3QgY29uc3RydWN0ZWQgZnJvbSBkcmFjbyBkYXRhLCB1c2UgdW5jb21wcmVzc2VkXG4gICAgICAgIGlmICghdmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICBpbmRpY2VzID0gcHJpbWl0aXZlLmhhc093blByb3BlcnR5KCdpbmRpY2VzJykgPyBnZXRBY2Nlc3NvckRhdGEoYWNjZXNzb3JzW3ByaW1pdGl2ZS5pbmRpY2VzXSwgYnVmZmVyVmlld3MsIHRydWUpIDogbnVsbDtcbiAgICAgICAgICAgIHZlcnRleEJ1ZmZlciA9IGNyZWF0ZVZlcnRleEJ1ZmZlcihkZXZpY2UsIHByaW1pdGl2ZS5hdHRyaWJ1dGVzLCBpbmRpY2VzLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCk7XG4gICAgICAgICAgICBwcmltaXRpdmVUeXBlID0gZ2V0UHJpbWl0aXZlVHlwZShwcmltaXRpdmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG1lc2ggPSBudWxsO1xuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBidWlsZCB0aGUgbWVzaFxuICAgICAgICAgICAgbWVzaCA9IG5ldyBNZXNoKGRldmljZSk7XG4gICAgICAgICAgICBtZXNoLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLnR5cGUgPSBwcmltaXRpdmVUeXBlO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uYmFzZSA9IDA7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkID0gKGluZGljZXMgIT09IG51bGwpO1xuXG4gICAgICAgICAgICAvLyBpbmRleCBidWZmZXJcbiAgICAgICAgICAgIGlmIChpbmRpY2VzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbGV0IGluZGV4Rm9ybWF0O1xuICAgICAgICAgICAgICAgIGlmIChpbmRpY2VzIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQ4O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5kaWNlcyBpbnN0YW5jZW9mIFVpbnQxNkFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDMyO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIDMyYml0IGluZGV4IGJ1ZmZlciBpcyB1c2VkIGJ1dCBub3Qgc3VwcG9ydGVkXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4Rm9ybWF0ID09PSBJTkRFWEZPUk1BVF9VSU5UMzIgJiYgIWRldmljZS5leHRVaW50RWxlbWVudCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcyA+IDB4RkZGRikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdHbGIgZmlsZSBjb250YWlucyAzMmJpdCBpbmRleCBidWZmZXIgYnV0IHRoZXNlIGFyZSBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgZGV2aWNlIC0gaXQgbWF5IGJlIHJlbmRlcmVkIGluY29ycmVjdGx5LicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgdG8gMTZiaXRcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMTY7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMgPSBuZXcgVWludDE2QXJyYXkoaW5kaWNlcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIoZGV2aWNlLCBpbmRleEZvcm1hdCwgaW5kaWNlcy5sZW5ndGgsIEJVRkZFUl9TVEFUSUMsIGluZGljZXMpO1xuICAgICAgICAgICAgICAgIG1lc2guaW5kZXhCdWZmZXJbMF0gPSBpbmRleEJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IGluZGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eShcImV4dGVuc2lvbnNcIikgJiYgcHJpbWl0aXZlLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudHMgPSBwcmltaXRpdmUuZXh0ZW5zaW9ucy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBNYXBwaW5nID0ge307XG4gICAgICAgICAgICAgICAgdmFyaWFudHMubWFwcGluZ3MuZm9yRWFjaCgobWFwcGluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLnZhcmlhbnRzLmZvckVhY2goKHZhcmlhbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBNYXBwaW5nW3ZhcmlhbnRdID0gbWFwcGluZy5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbWVzaFZhcmlhbnRzW21lc2guaWRdID0gdGVtcE1hcHBpbmc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1lc2hEZWZhdWx0TWF0ZXJpYWxzW21lc2guaWRdID0gcHJpbWl0aXZlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICBsZXQgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbcHJpbWl0aXZlLmF0dHJpYnV0ZXMuUE9TSVRJT05dO1xuICAgICAgICAgICAgbWVzaC5hYWJiID0gZ2V0QWNjZXNzb3JCb3VuZGluZ0JveChhY2Nlc3Nvcik7XG5cbiAgICAgICAgICAgIC8vIG1vcnBoIHRhcmdldHNcbiAgICAgICAgICAgIGlmIChjYW5Vc2VNb3JwaCAmJiBwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ3RhcmdldHMnKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHByaW1pdGl2ZS50YXJnZXRzLmZvckVhY2goZnVuY3Rpb24gKHRhcmdldCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHt9O1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ1BPU0lUSU9OJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2Vzc29yID0gYWNjZXNzb3JzW3RhcmdldC5QT1NJVElPTl07XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhUG9zaXRpb25zID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YVBvc2l0aW9uc1R5cGUgPSBUWVBFX0ZMT0FUMzI7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmFhYmIgPSBnZXRBY2Nlc3NvckJvdW5kaW5nQm94KGFjY2Vzc29yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ05PUk1BTCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2Nlc3NvciA9IGFjY2Vzc29yc1t0YXJnZXQuTk9STUFMXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IHRoZSBtb3JwaCB0YXJnZXRzIGNhbid0IGN1cnJlbnRseSBhY2NlcHQgcXVhbnRpemVkIG5vcm1hbHNcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFOb3JtYWxzID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YU5vcm1hbHNUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbmFtZSBpZiBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZNZXNoLmhhc093blByb3BlcnR5KCdleHRyYXMnKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgZ2x0Zk1lc2guZXh0cmFzLmhhc093blByb3BlcnR5KCd0YXJnZXROYW1lcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLm5hbWUgPSBnbHRmTWVzaC5leHRyYXMudGFyZ2V0TmFtZXNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uYW1lID0gaW5kZXgudG9TdHJpbmcoMTApO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCB3ZWlnaHQgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTWVzaC5oYXNPd25Qcm9wZXJ0eSgnd2VpZ2h0cycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlZmF1bHRXZWlnaHQgPSBnbHRmTWVzaC53ZWlnaHRzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMucHJlc2VydmVEYXRhID0gYXNzZXRPcHRpb25zLm1vcnBoUHJlc2VydmVEYXRhO1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRzLnB1c2gobmV3IE1vcnBoVGFyZ2V0KG9wdGlvbnMpKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIG1lc2gubW9ycGggPSBuZXcgTW9ycGgodGFyZ2V0cywgZGV2aWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG1lc2hlcy5wdXNoKG1lc2gpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1lc2hlcztcbn07XG5cbmNvbnN0IGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtID0gZnVuY3Rpb24gKHNvdXJjZSwgbWF0ZXJpYWwsIG1hcHMpIHtcbiAgICBsZXQgbWFwO1xuXG4gICAgY29uc3QgdGV4Q29vcmQgPSBzb3VyY2UudGV4Q29vcmQ7XG4gICAgaWYgKHRleENvb3JkKSB7XG4gICAgICAgIGZvciAobWFwID0gMDsgbWFwIDwgbWFwcy5sZW5ndGg7ICsrbWFwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbFttYXBzW21hcF0gKyAnTWFwVXYnXSA9IHRleENvb3JkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgemVyb3MgPSBbMCwgMF07XG4gICAgY29uc3Qgb25lcyA9IFsxLCAxXTtcbiAgICBjb25zdCB0ZXh0dXJlVHJhbnNmb3JtID0gc291cmNlLmV4dGVuc2lvbnM/LktIUl90ZXh0dXJlX3RyYW5zZm9ybTtcbiAgICBpZiAodGV4dHVyZVRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSB0ZXh0dXJlVHJhbnNmb3JtLm9mZnNldCB8fCB6ZXJvcztcbiAgICAgICAgY29uc3Qgc2NhbGUgPSB0ZXh0dXJlVHJhbnNmb3JtLnNjYWxlIHx8IG9uZXM7XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gdGV4dHVyZVRyYW5zZm9ybS5yb3RhdGlvbiA/ICgtdGV4dHVyZVRyYW5zZm9ybS5yb3RhdGlvbiAqIG1hdGguUkFEX1RPX0RFRykgOiAwO1xuXG4gICAgICAgIGNvbnN0IHRpbGluZ1ZlYyA9IG5ldyBWZWMyKHNjYWxlWzBdLCBzY2FsZVsxXSk7XG4gICAgICAgIGNvbnN0IG9mZnNldFZlYyA9IG5ldyBWZWMyKG9mZnNldFswXSwgMS4wIC0gc2NhbGVbMV0gLSBvZmZzZXRbMV0pO1xuXG4gICAgICAgIGZvciAobWFwID0gMDsgbWFwIDwgbWFwcy5sZW5ndGg7ICsrbWFwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbFtgJHttYXBzW21hcF19TWFwVGlsaW5nYF0gPSB0aWxpbmdWZWM7XG4gICAgICAgICAgICBtYXRlcmlhbFtgJHttYXBzW21hcF19TWFwT2Zmc2V0YF0gPSBvZmZzZXRWZWM7XG4gICAgICAgICAgICBtYXRlcmlhbFtgJHttYXBzW21hcF19TWFwUm90YXRpb25gXSA9IHJvdGF0aW9uO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uUGJyU3BlY0dsb3NzaW5lc3MgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbGV0IGNvbG9yLCB0ZXh0dXJlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdkaWZmdXNlRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBkYXRhLmRpZmZ1c2VGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IGNvbG9yWzNdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDEsIDEsIDEpO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gMTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2RpZmZ1c2VUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgZGlmZnVzZVRleHR1cmUgPSBkYXRhLmRpZmZ1c2VUZXh0dXJlO1xuICAgICAgICB0ZXh0dXJlID0gdGV4dHVyZXNbZGlmZnVzZVRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSB0ZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwID0gdGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWwgPSAnYSc7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGlmZnVzZVRleHR1cmUsIG1hdGVyaWFsLCBbJ2RpZmZ1c2UnLCAnb3BhY2l0eSddKTtcbiAgICB9XG4gICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzID0gZmFsc2U7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBkYXRhLnNwZWN1bGFyRmFjdG9yO1xuICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2dsb3NzaW5lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGluaW5lc3MgPSAxMDAgKiBkYXRhLmdsb3NzaW5lc3NGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hpbmluZXNzID0gMTAwO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IHNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUgPSBkYXRhLnNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyRW5jb2RpbmcgPSAnc3JnYic7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwID0gbWF0ZXJpYWwuZ2xvc3NNYXAgPSB0ZXh0dXJlc1tzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzTWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydnbG9zcycsICdtZXRhbG5lc3MnXSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uQ2xlYXJDb2F0ID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXQgPSBkYXRhLmNsZWFyY29hdEZhY3RvciAqIDAuMjU7IC8vIFRPRE86IHJlbW92ZSB0ZW1wb3Jhcnkgd29ya2Fyb3VuZCBmb3IgcmVwbGljYXRpbmcgZ2xURiBjbGVhci1jb2F0IHZpc3VhbHNcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXQgPSAwO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0VGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdFRleHR1cmUgPSBkYXRhLmNsZWFyY29hdFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdE1hcCA9IHRleHR1cmVzW2NsZWFyY29hdFRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRNYXBDaGFubmVsID0gJ3InO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGNsZWFyY29hdFRleHR1cmUsIG1hdGVyaWFsLCBbJ2NsZWFyQ29hdCddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdFJvdWdobmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzaW5lc3MgPSBkYXRhLmNsZWFyY29hdFJvdWdobmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc2luZXNzID0gMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdFJvdWdobmVzc1RleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc01hcCA9IHRleHR1cmVzW2NsZWFyY29hdFJvdWdobmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc01hcENoYW5uZWwgPSAnZyc7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0R2xvc3MnXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXROb3JtYWxUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSA9IGRhdGEuY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0Tm9ybWFsTWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0Tm9ybWFsJ10pO1xuXG4gICAgICAgIGlmIChjbGVhcmNvYXROb3JtYWxUZXh0dXJlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRCdW1waW5lc3MgPSBjbGVhcmNvYXROb3JtYWxUZXh0dXJlLnNjYWxlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY2xlYXJDb2F0R2xvc3NDaHVuayA9IC8qIGdsc2wgKi9gXG4gICAgICAgICNpZmRlZiBNQVBGTE9BVFxuICAgICAgICB1bmlmb3JtIGZsb2F0IG1hdGVyaWFsX2NsZWFyQ29hdEdsb3NzaW5lc3M7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgdm9pZCBnZXRDbGVhckNvYXRHbG9zc2luZXNzKCkge1xuICAgICAgICAgICAgY2NHbG9zc2luZXNzID0gMS4wO1xuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgKj0gbWF0ZXJpYWxfY2xlYXJDb2F0R2xvc3NpbmVzcztcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgICAgICAgICAgY2NHbG9zc2luZXNzICo9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgKj0gc2F0dXJhdGUodlZlcnRleENvbG9yLiRWQyk7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyA9IDEuMCAtIGNjR2xvc3NpbmVzcztcbiAgICAgICAgXG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgKz0gMC4wMDAwMDAxO1xuICAgICAgICB9XG4gICAgICAgIGA7XG4gICAgbWF0ZXJpYWwuY2h1bmtzLmNsZWFyQ29hdEdsb3NzUFMgPSBjbGVhckNvYXRHbG9zc0NodW5rO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uVW5saXQgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwudXNlTGlnaHRpbmcgPSBmYWxzZTtcblxuICAgIC8vIGNvcHkgZGlmZnVzZSBpbnRvIGVtaXNzaXZlXG4gICAgbWF0ZXJpYWwuZW1pc3NpdmUuY29weShtYXRlcmlhbC5kaWZmdXNlKTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSBtYXRlcmlhbC5kaWZmdXNlVGludDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcCA9IG1hdGVyaWFsLmRpZmZ1c2VNYXA7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBVdiA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBVdjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFRpbGluZy5jb3B5KG1hdGVyaWFsLmRpZmZ1c2VNYXBUaWxpbmcpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwT2Zmc2V0LmNvcHkobWF0ZXJpYWwuZGlmZnVzZU1hcE9mZnNldCk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBSb3RhdGlvbiA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBSb3RhdGlvbjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcENoYW5uZWwgPSBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVZlcnRleENvbG9yID0gbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVmVydGV4Q29sb3JDaGFubmVsID0gbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yQ2hhbm5lbDtcblxuICAgIC8vIGJsYW5rIGRpZmZ1c2VcbiAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgwLCAwLCAwKTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVGludCA9IGZhbHNlO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSBudWxsO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvciA9IGZhbHNlO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uU3BlY3VsYXIgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJFbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSB0ZXh0dXJlc1tkYXRhLnNwZWN1bGFyQ29sb3JUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXBDaGFubmVsID0gJ3JnYic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhckNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc3BlY3VsYXInXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JGYWN0b3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuc3BlY3VsYXJDb2xvckZhY3RvcjtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3RvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3IgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3JNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3Rvck1hcCA9IHRleHR1cmVzW2RhdGEuc3BlY3VsYXJUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NwZWN1bGFyaXR5RmFjdG9yJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklvciA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbkluZGV4ID0gMS4wIC8gZGF0YS5pb3I7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uVHJhbnNtaXNzaW9uID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICBtYXRlcmlhbC51c2VEeW5hbWljUmVmcmFjdGlvbiA9IHRydWU7XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbiA9IGRhdGEudHJhbnNtaXNzaW9uRmFjdG9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25NYXBDaGFubmVsID0gJ3InO1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uTWFwID0gdGV4dHVyZXNbZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLCBtYXRlcmlhbCwgWydyZWZyYWN0aW9uJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvblNoZWVuID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZVNoZWVuID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvckZhY3RvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5zaGVlbkNvbG9yRmFjdG9yO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW4uc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbk1hcCA9IHRleHR1cmVzW2RhdGEuc2hlZW5Db2xvclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNoZWVuQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydzaGVlbiddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zc2luZXNzID0gZGF0YS5zaGVlblJvdWdobmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzaW5lc3MgPSAwLjA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlblJvdWdobmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzaW5lc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnNoZWVuUm91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NpbmVzc01hcENoYW5uZWwgPSAnYSc7XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc2hlZW5Sb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydzaGVlbkdsb3NzaW5lc3MnXSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2hlZW5HbG9zc0NodW5rID0gYFxuICAgICNpZmRlZiBNQVBGTE9BVFxuICAgIHVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfc2hlZW5HbG9zc2luZXNzO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICB1bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX3NoZWVuR2xvc3NpbmVzc01hcDtcbiAgICAjZW5kaWZcblxuICAgIHZvaWQgZ2V0U2hlZW5HbG9zc2luZXNzKCkge1xuICAgICAgICBmbG9hdCBzaGVlbkdsb3NzaW5lc3MgPSAxLjA7XG5cbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgIHNoZWVuR2xvc3NpbmVzcyAqPSBtYXRlcmlhbF9zaGVlbkdsb3NzaW5lc3M7XG4gICAgICAgICNlbmRpZlxuXG4gICAgICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgICAgIHNoZWVuR2xvc3NpbmVzcyAqPSB0ZXh0dXJlMkRCaWFzKHRleHR1cmVfc2hlZW5HbG9zc2luZXNzTWFwLCAkVVYsIHRleHR1cmVCaWFzKS4kQ0g7XG4gICAgICAgICNlbmRpZlxuXG4gICAgICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICAgICAgc2hlZW5HbG9zc2luZXNzICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICAgICAjZW5kaWZcblxuICAgICAgICBzaGVlbkdsb3NzaW5lc3MgPSAxLjAgLSBzaGVlbkdsb3NzaW5lc3M7XG4gICAgICAgIHNoZWVuR2xvc3NpbmVzcyArPSAwLjAwMDAwMDE7XG4gICAgICAgIHNHbG9zc2luZXNzID0gc2hlZW5HbG9zc2luZXNzO1xuICAgIH1cbiAgICBgO1xuICAgIG1hdGVyaWFsLmNodW5rcy5zaGVlbkdsb3NzUFMgPSBzaGVlbkdsb3NzQ2h1bms7XG59O1xuXG5jb25zdCBleHRlbnNpb25Wb2x1bWUgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9STUFMO1xuICAgIG1hdGVyaWFsLnVzZUR5bmFtaWNSZWZyYWN0aW9uID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndGhpY2tuZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwudGhpY2tuZXNzID0gZGF0YS50aGlja25lc3NGYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0aGlja25lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwudGhpY2tuZXNzTWFwID0gdGV4dHVyZXNbZGF0YS50aGlja25lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS50aGlja25lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWyd0aGlja25lc3MnXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdhdHRlbnVhdGlvbkRpc3RhbmNlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuYXR0ZW51YXRpb25EaXN0YW5jZSA9IGRhdGEuYXR0ZW51YXRpb25EaXN0YW5jZTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2F0dGVudWF0aW9uQ29sb3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuYXR0ZW51YXRpb25Db2xvcjtcbiAgICAgICAgbWF0ZXJpYWwuYXR0ZW51YXRpb24uc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbkVtaXNzaXZlU3RyZW5ndGggPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlU3RyZW5ndGgnKSkge1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZUludGVuc2l0eSA9IGRhdGEuZW1pc3NpdmVTdHJlbmd0aDtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25JcmlkZXNjZW5jZSA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC51c2VJcmlkZXNjZW5jZSA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2UgPSBkYXRhLmlyaWRlc2NlbmNlRmFjdG9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VNYXBDaGFubmVsID0gJ3InO1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZU1hcCA9IHRleHR1cmVzW2RhdGEuaXJpZGVzY2VuY2VUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5pcmlkZXNjZW5jZVRleHR1cmUsIG1hdGVyaWFsLCBbJ2lyaWRlc2NlbmNlJ10pO1xuXG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZUlvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4ID0gZGF0YS5pcmlkZXNjZW5jZUlvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWluID0gZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc01pbmltdW07XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW0nKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01heCA9IGRhdGEuaXJpZGVzY2VuY2VUaGlja25lc3NNYXhpbXVtO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUaGlja25lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsID0gJ2cnO1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01hcCA9IHRleHR1cmVzW2RhdGEuaXJpZGVzY2VuY2VUaGlja25lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2lyaWRlc2NlbmNlVGhpY2tuZXNzJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGNyZWF0ZU1hdGVyaWFsID0gZnVuY3Rpb24gKGdsdGZNYXRlcmlhbCwgdGV4dHVyZXMsIGZsaXBWKSB7XG4gICAgLy8gVE9ETzogaW50ZWdyYXRlIHRoZXNlIHNoYWRlciBjaHVua3MgaW50byB0aGUgbmF0aXZlIGVuZ2luZVxuICAgIGNvbnN0IGdsb3NzQ2h1bmsgPSBgXG4gICAgICAgICNpZmRlZiBNQVBGTE9BVFxuICAgICAgICB1bmlmb3JtIGZsb2F0IG1hdGVyaWFsX3NoaW5pbmVzcztcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICB2b2lkIGdldEdsb3NzaW5lc3MoKSB7XG4gICAgICAgICAgICBkR2xvc3NpbmVzcyA9IDEuMDtcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBGTE9BVFxuICAgICAgICAgICAgZEdsb3NzaW5lc3MgKj0gbWF0ZXJpYWxfc2hpbmluZXNzO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgICAgICAgICBkR2xvc3NpbmVzcyAqPSB0ZXh0dXJlMkRCaWFzKCRTQU1QTEVSLCAkVVYsIHRleHR1cmVCaWFzKS4kQ0g7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUFZFUlRFWFxuICAgICAgICAgICAgZEdsb3NzaW5lc3MgKj0gc2F0dXJhdGUodlZlcnRleENvbG9yLiRWQyk7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgICAgIGRHbG9zc2luZXNzID0gMS4wIC0gZEdsb3NzaW5lc3M7XG4gICAgICAgIFxuICAgICAgICAgICAgZEdsb3NzaW5lc3MgKz0gMC4wMDAwMDAxO1xuICAgICAgICB9XG4gICAgICAgIGA7XG5cblxuICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFN0YW5kYXJkTWF0ZXJpYWwoKTtcblxuICAgIC8vIGdsVEYgZG9lc24ndCBkZWZpbmUgaG93IHRvIG9jY2x1ZGUgc3BlY3VsYXJcbiAgICBtYXRlcmlhbC5vY2NsdWRlU3BlY3VsYXIgPSBTUEVDT0NDX0FPO1xuXG4gICAgbWF0ZXJpYWwuZGlmZnVzZVRpbnQgPSB0cnVlO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvciA9IHRydWU7XG5cbiAgICBtYXRlcmlhbC5zcGVjdWxhclRpbnQgPSB0cnVlO1xuICAgIG1hdGVyaWFsLnNwZWN1bGFyVmVydGV4Q29sb3IgPSB0cnVlO1xuXG4gICAgbWF0ZXJpYWwuY2h1bmtzLkFQSVZlcnNpb24gPSBDSFVOS0FQSV8xXzU3O1xuXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSBnbHRmTWF0ZXJpYWwubmFtZTtcbiAgICB9XG5cbiAgICBsZXQgY29sb3IsIHRleHR1cmU7XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgncGJyTWV0YWxsaWNSb3VnaG5lc3MnKSkge1xuICAgICAgICBjb25zdCBwYnJEYXRhID0gZ2x0Zk1hdGVyaWFsLnBick1ldGFsbGljUm91Z2huZXNzO1xuXG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdiYXNlQ29sb3JGYWN0b3InKSkge1xuICAgICAgICAgICAgY29sb3IgPSBwYnJEYXRhLmJhc2VDb2xvckZhY3RvcjtcbiAgICAgICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gY29sb3JbM107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgxLCAxLCAxKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdiYXNlQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2VDb2xvclRleHR1cmUgPSBwYnJEYXRhLmJhc2VDb2xvclRleHR1cmU7XG4gICAgICAgICAgICB0ZXh0dXJlID0gdGV4dHVyZXNbYmFzZUNvbG9yVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSB0ZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWwgPSAnYSc7XG5cbiAgICAgICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGJhc2VDb2xvclRleHR1cmUsIG1hdGVyaWFsLCBbJ2RpZmZ1c2UnLCAnb3BhY2l0eSddKTtcbiAgICAgICAgfVxuICAgICAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3MgPSB0cnVlO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdtZXRhbGxpY0ZhY3RvcicpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3MgPSBwYnJEYXRhLm1ldGFsbGljRmFjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzID0gMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgncm91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNoaW5pbmVzcyA9IDEwMCAqIHBickRhdGEucm91Z2huZXNzRmFjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2hpbmluZXNzID0gMTAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUnKSkge1xuICAgICAgICAgICAgY29uc3QgbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlID0gcGJyRGF0YS5tZXRhbGxpY1JvdWdobmVzc1RleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3NNYXAgPSBtYXRlcmlhbC5nbG9zc01hcCA9IHRleHR1cmVzW21ldGFsbGljUm91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3NNYXBDaGFubmVsID0gJ2InO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZ2xvc3NNYXBDaGFubmVsID0gJ2cnO1xuXG4gICAgICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2dsb3NzJywgJ21ldGFsbmVzcyddKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5nbG9zc1BTID0gZ2xvc3NDaHVuaztcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdub3JtYWxUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgbm9ybWFsVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5ub3JtYWxUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5ub3JtYWxNYXAgPSB0ZXh0dXJlc1tub3JtYWxUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShub3JtYWxUZXh0dXJlLCBtYXRlcmlhbCwgWydub3JtYWwnXSk7XG5cbiAgICAgICAgaWYgKG5vcm1hbFRleHR1cmUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmJ1bXBpbmVzcyA9IG5vcm1hbFRleHR1cmUuc2NhbGU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnb2NjbHVzaW9uVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IG9jY2x1c2lvblRleHR1cmUgPSBnbHRmTWF0ZXJpYWwub2NjbHVzaW9uVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuYW9NYXAgPSB0ZXh0dXJlc1tvY2NsdXNpb25UZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuYW9NYXBDaGFubmVsID0gJ3InO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG9jY2x1c2lvblRleHR1cmUsIG1hdGVyaWFsLCBbJ2FvJ10pO1xuICAgICAgICAvLyBUT0RPOiBzdXBwb3J0ICdzdHJlbmd0aCdcbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGdsdGZNYXRlcmlhbC5lbWlzc2l2ZUZhY3RvcjtcbiAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoMCwgMCwgMCk7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdlbWlzc2l2ZVRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBlbWlzc2l2ZVRleHR1cmUgPSBnbHRmTWF0ZXJpYWwuZW1pc3NpdmVUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcCA9IHRleHR1cmVzW2VtaXNzaXZlVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZW1pc3NpdmVUZXh0dXJlLCBtYXRlcmlhbCwgWydlbWlzc2l2ZSddKTtcbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnYWxwaGFNb2RlJykpIHtcbiAgICAgICAgc3dpdGNoIChnbHRmTWF0ZXJpYWwuYWxwaGFNb2RlKSB7XG4gICAgICAgICAgICBjYXNlICdNQVNLJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT05FO1xuICAgICAgICAgICAgICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2FscGhhQ3V0b2ZmJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuYWxwaGFUZXN0ID0gZ2x0Zk1hdGVyaWFsLmFscGhhQ3V0b2ZmO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFscGhhVGVzdCA9IDAuNTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdCTEVORCc6XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9STUFMO1xuICAgICAgICAgICAgICAgIC8vIG5vdGU6IGJ5IGRlZmF1bHQgZG9uJ3Qgd3JpdGUgZGVwdGggb24gc2VtaXRyYW5zcGFyZW50IG1hdGVyaWFsc1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRlcHRoV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBjYXNlICdPUEFRVUUnOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT05FO1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdkb3VibGVTaWRlZCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLnR3b1NpZGVkTGlnaHRpbmcgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQ7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQgPyBDVUxMRkFDRV9OT05FIDogQ1VMTEZBQ0VfQkFDSztcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC50d29TaWRlZExpZ2h0aW5nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9CQUNLO1xuICAgIH1cblxuICAgIC8vIFByb3ZpZGUgbGlzdCBvZiBzdXBwb3J0ZWQgZXh0ZW5zaW9ucyBhbmQgdGhlaXIgZnVuY3Rpb25zXG4gICAgY29uc3QgZXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2NsZWFyY29hdFwiOiBleHRlbnNpb25DbGVhckNvYXQsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19lbWlzc2l2ZV9zdHJlbmd0aFwiOiBleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfaW9yXCI6IGV4dGVuc2lvbklvcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2lyaWRlc2NlbmNlXCI6IGV4dGVuc2lvbklyaWRlc2NlbmNlLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfcGJyU3BlY3VsYXJHbG9zc2luZXNzXCI6IGV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfc2hlZW5cIjogZXh0ZW5zaW9uU2hlZW4sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19zcGVjdWxhclwiOiBleHRlbnNpb25TcGVjdWxhcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3RyYW5zbWlzc2lvblwiOiBleHRlbnNpb25UcmFuc21pc3Npb24sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc191bmxpdFwiOiBleHRlbnNpb25VbmxpdCxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3ZvbHVtZVwiOiBleHRlbnNpb25Wb2x1bWVcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIGV4dGVuc2lvbnNcbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZ2x0Zk1hdGVyaWFsLmV4dGVuc2lvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbkZ1bmMgPSBleHRlbnNpb25zW2tleV07XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uRnVuYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZXh0ZW5zaW9uRnVuYyhnbHRmTWF0ZXJpYWwuZXh0ZW5zaW9uc1trZXldLCBtYXRlcmlhbCwgdGV4dHVyZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICByZXR1cm4gbWF0ZXJpYWw7XG59O1xuXG4vLyBjcmVhdGUgdGhlIGFuaW0gc3RydWN0dXJlXG5jb25zdCBjcmVhdGVBbmltYXRpb24gPSBmdW5jdGlvbiAoZ2x0ZkFuaW1hdGlvbiwgYW5pbWF0aW9uSW5kZXgsIGdsdGZBY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgbWVzaGVzKSB7XG5cbiAgICAvLyBjcmVhdGUgYW5pbWF0aW9uIGRhdGEgYmxvY2sgZm9yIHRoZSBhY2Nlc3NvclxuICAgIGNvbnN0IGNyZWF0ZUFuaW1EYXRhID0gZnVuY3Rpb24gKGdsdGZBY2Nlc3Nvcikge1xuICAgICAgICByZXR1cm4gbmV3IEFuaW1EYXRhKGdldE51bUNvbXBvbmVudHMoZ2x0ZkFjY2Vzc29yLnR5cGUpLCBnZXRBY2Nlc3NvckRhdGFGbG9hdDMyKGdsdGZBY2Nlc3NvciwgYnVmZmVyVmlld3MpKTtcbiAgICB9O1xuXG4gICAgY29uc3QgaW50ZXJwTWFwID0ge1xuICAgICAgICAnU1RFUCc6IElOVEVSUE9MQVRJT05fU1RFUCxcbiAgICAgICAgJ0xJTkVBUic6IElOVEVSUE9MQVRJT05fTElORUFSLFxuICAgICAgICAnQ1VCSUNTUExJTkUnOiBJTlRFUlBPTEFUSU9OX0NVQklDXG4gICAgfTtcblxuICAgIC8vIElucHV0IGFuZCBvdXRwdXQgbWFwcyByZWZlcmVuY2UgZGF0YSBieSBzYW1wbGVyIGlucHV0L291dHB1dCBrZXkuXG4gICAgY29uc3QgaW5wdXRNYXAgPSB7IH07XG4gICAgY29uc3Qgb3V0cHV0TWFwID0geyB9O1xuICAgIC8vIFRoZSBjdXJ2ZSBtYXAgc3RvcmVzIHRlbXBvcmFyeSBjdXJ2ZSBkYXRhIGJ5IHNhbXBsZXIgaW5kZXguIEVhY2ggY3VydmVzIGlucHV0L291dHB1dCB2YWx1ZSB3aWxsIGJlIHJlc29sdmVkIHRvIGFuIGlucHV0cy9vdXRwdXRzIGFycmF5IGluZGV4IGFmdGVyIGFsbCBzYW1wbGVycyBoYXZlIGJlZW4gcHJvY2Vzc2VkLlxuICAgIC8vIEN1cnZlcyBhbmQgb3V0cHV0cyB0aGF0IGFyZSBkZWxldGVkIGZyb20gdGhlaXIgbWFwcyB3aWxsIG5vdCBiZSBpbmNsdWRlZCBpbiB0aGUgZmluYWwgQW5pbVRyYWNrXG4gICAgY29uc3QgY3VydmVNYXAgPSB7IH07XG4gICAgbGV0IG91dHB1dENvdW50ZXIgPSAxO1xuXG4gICAgbGV0IGk7XG5cbiAgICAvLyBjb252ZXJ0IHNhbXBsZXJzXG4gICAgZm9yIChpID0gMDsgaSA8IGdsdGZBbmltYXRpb24uc2FtcGxlcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3Qgc2FtcGxlciA9IGdsdGZBbmltYXRpb24uc2FtcGxlcnNbaV07XG5cbiAgICAgICAgLy8gZ2V0IGlucHV0IGRhdGFcbiAgICAgICAgaWYgKCFpbnB1dE1hcC5oYXNPd25Qcm9wZXJ0eShzYW1wbGVyLmlucHV0KSkge1xuICAgICAgICAgICAgaW5wdXRNYXBbc2FtcGxlci5pbnB1dF0gPSBjcmVhdGVBbmltRGF0YShnbHRmQWNjZXNzb3JzW3NhbXBsZXIuaW5wdXRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGdldCBvdXRwdXQgZGF0YVxuICAgICAgICBpZiAoIW91dHB1dE1hcC5oYXNPd25Qcm9wZXJ0eShzYW1wbGVyLm91dHB1dCkpIHtcbiAgICAgICAgICAgIG91dHB1dE1hcFtzYW1wbGVyLm91dHB1dF0gPSBjcmVhdGVBbmltRGF0YShnbHRmQWNjZXNzb3JzW3NhbXBsZXIub3V0cHV0XSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnRlcnBvbGF0aW9uID1cbiAgICAgICAgICAgIHNhbXBsZXIuaGFzT3duUHJvcGVydHkoJ2ludGVycG9sYXRpb24nKSAmJlxuICAgICAgICAgICAgaW50ZXJwTWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIuaW50ZXJwb2xhdGlvbikgP1xuICAgICAgICAgICAgICAgIGludGVycE1hcFtzYW1wbGVyLmludGVycG9sYXRpb25dIDogSU5URVJQT0xBVElPTl9MSU5FQVI7XG5cbiAgICAgICAgLy8gY3JlYXRlIGN1cnZlXG4gICAgICAgIGNvbnN0IGN1cnZlID0ge1xuICAgICAgICAgICAgcGF0aHM6IFtdLFxuICAgICAgICAgICAgaW5wdXQ6IHNhbXBsZXIuaW5wdXQsXG4gICAgICAgICAgICBvdXRwdXQ6IHNhbXBsZXIub3V0cHV0LFxuICAgICAgICAgICAgaW50ZXJwb2xhdGlvbjogaW50ZXJwb2xhdGlvblxuICAgICAgICB9O1xuXG4gICAgICAgIGN1cnZlTWFwW2ldID0gY3VydmU7XG4gICAgfVxuXG4gICAgY29uc3QgcXVhdEFycmF5cyA9IFtdO1xuXG4gICAgY29uc3QgdHJhbnNmb3JtU2NoZW1hID0ge1xuICAgICAgICAndHJhbnNsYXRpb24nOiAnbG9jYWxQb3NpdGlvbicsXG4gICAgICAgICdyb3RhdGlvbic6ICdsb2NhbFJvdGF0aW9uJyxcbiAgICAgICAgJ3NjYWxlJzogJ2xvY2FsU2NhbGUnXG4gICAgfTtcblxuICAgIGNvbnN0IGNvbnN0cnVjdE5vZGVQYXRoID0gKG5vZGUpID0+IHtcbiAgICAgICAgY29uc3QgcGF0aCA9IFtdO1xuICAgICAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICAgICAgcGF0aC51bnNoaWZ0KG5vZGUubmFtZSk7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfTtcblxuICAgIGNvbnN0IHJldHJpZXZlV2VpZ2h0TmFtZSA9IChub2RlTmFtZSwgd2VpZ2h0SW5kZXgpID0+IHtcbiAgICAgICAgaWYgKCFtZXNoZXMpIHJldHVybiB3ZWlnaHRJbmRleDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoZXNbaV07XG4gICAgICAgICAgICBpZiAobWVzaC5uYW1lID09PSBub2RlTmFtZSAmJiBtZXNoLmhhc093blByb3BlcnR5KCdleHRyYXMnKSAmJiBtZXNoLmV4dHJhcy5oYXNPd25Qcm9wZXJ0eSgndGFyZ2V0TmFtZXMnKSAmJiBtZXNoLmV4dHJhcy50YXJnZXROYW1lc1t3ZWlnaHRJbmRleF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYG5hbWUuJHttZXNoLmV4dHJhcy50YXJnZXROYW1lc1t3ZWlnaHRJbmRleF19YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gd2VpZ2h0SW5kZXg7XG4gICAgfTtcblxuICAgIC8vIEFsbCBtb3JwaCB0YXJnZXRzIGFyZSBpbmNsdWRlZCBpbiBhIHNpbmdsZSBjaGFubmVsIG9mIHRoZSBhbmltYXRpb24sIHdpdGggYWxsIHRhcmdldHMgb3V0cHV0IGRhdGEgaW50ZXJsZWF2ZWQgd2l0aCBlYWNoIG90aGVyLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gc3BsaXRzIGVhY2ggbW9ycGggdGFyZ2V0IG91dCBpbnRvIGl0IGEgY3VydmUgd2l0aCBpdHMgb3duIG91dHB1dCBkYXRhLCBhbGxvd2luZyB1cyB0byBhbmltYXRlIGVhY2ggbW9ycGggdGFyZ2V0IGluZGVwZW5kZW50bHkgYnkgbmFtZS5cbiAgICBjb25zdCBjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyA9IChjdXJ2ZSwgbm9kZSwgZW50aXR5UGF0aCkgPT4ge1xuICAgICAgICBpZiAoIW91dHB1dE1hcFtjdXJ2ZS5vdXRwdXRdKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBnbGItcGFyc2VyOiBObyBvdXRwdXQgZGF0YSBpcyBhdmFpbGFibGUgZm9yIHRoZSBtb3JwaCB0YXJnZXQgY3VydmUgKCR7ZW50aXR5UGF0aH0vZ3JhcGgvd2VpZ2h0cykuIFNraXBwaW5nLmApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0Q291bnQgPSBvdXRwdXRNYXBbY3VydmUub3V0cHV0XS5kYXRhLmxlbmd0aCAvIGlucHV0TWFwW2N1cnZlLmlucHV0XS5kYXRhLmxlbmd0aDtcbiAgICAgICAgY29uc3Qga2V5ZnJhbWVDb3VudCA9IG91dHB1dE1hcFtjdXJ2ZS5vdXRwdXRdLmRhdGEubGVuZ3RoIC8gbW9ycGhUYXJnZXRDb3VudDtcblxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1vcnBoVGFyZ2V0Q291bnQ7IGorKykge1xuICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRPdXRwdXQgPSBuZXcgRmxvYXQzMkFycmF5KGtleWZyYW1lQ291bnQpO1xuICAgICAgICAgICAgLy8gdGhlIG91dHB1dCBkYXRhIGZvciBhbGwgbW9ycGggdGFyZ2V0cyBpbiBhIHNpbmdsZSBjdXJ2ZSBpcyBpbnRlcmxlYXZlZC4gV2UgbmVlZCB0byByZXRyaWV2ZSB0aGUga2V5ZnJhbWUgb3V0cHV0IGRhdGEgZm9yIGEgc2luZ2xlIG1vcnBoIHRhcmdldFxuICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBrZXlmcmFtZUNvdW50OyBrKyspIHtcbiAgICAgICAgICAgICAgICBtb3JwaFRhcmdldE91dHB1dFtrXSA9IG91dHB1dE1hcFtjdXJ2ZS5vdXRwdXRdLmRhdGFbayAqIG1vcnBoVGFyZ2V0Q291bnQgKyBqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG91dHB1dCA9IG5ldyBBbmltRGF0YSgxLCBtb3JwaFRhcmdldE91dHB1dCk7XG4gICAgICAgICAgICAvLyBhZGQgdGhlIGluZGl2aWR1YWwgbW9ycGggdGFyZ2V0IG91dHB1dCBkYXRhIHRvIHRoZSBvdXRwdXRNYXAgdXNpbmcgYSBuZWdhdGl2ZSB2YWx1ZSBrZXkgKHNvIGFzIG5vdCB0byBjbGFzaCB3aXRoIHNhbXBsZXIub3V0cHV0IHZhbHVlcylcbiAgICAgICAgICAgIG91dHB1dE1hcFstb3V0cHV0Q291bnRlcl0gPSBvdXRwdXQ7XG4gICAgICAgICAgICBjb25zdCBtb3JwaEN1cnZlID0ge1xuICAgICAgICAgICAgICAgIHBhdGhzOiBbe1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHlQYXRoOiBlbnRpdHlQYXRoLFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQ6ICdncmFwaCcsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogW2B3ZWlnaHQuJHtyZXRyaWV2ZVdlaWdodE5hbWUobm9kZS5uYW1lLCBqKX1gXVxuICAgICAgICAgICAgICAgIH1dLFxuICAgICAgICAgICAgICAgIC8vIGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIGlucHV0IGNhbiB1c2UgdGhlIHNhbWUgc2FtcGxlci5pbnB1dCBmcm9tIHRoZSBjaGFubmVsIHRoZXkgd2VyZSBhbGwgaW5cbiAgICAgICAgICAgICAgICBpbnB1dDogY3VydmUuaW5wdXQsXG4gICAgICAgICAgICAgICAgLy8gYnV0IGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIHNob3VsZCByZWZlcmVuY2UgaXRzIGluZGl2aWR1YWwgb3V0cHV0IHRoYXQgd2FzIGp1c3QgY3JlYXRlZFxuICAgICAgICAgICAgICAgIG91dHB1dDogLW91dHB1dENvdW50ZXIsXG4gICAgICAgICAgICAgICAgaW50ZXJwb2xhdGlvbjogY3VydmUuaW50ZXJwb2xhdGlvblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG91dHB1dENvdW50ZXIrKztcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgbW9ycGggdGFyZ2V0IGN1cnZlIHRvIHRoZSBjdXJ2ZU1hcFxuICAgICAgICAgICAgY3VydmVNYXBbYG1vcnBoQ3VydmUtJHtpfS0ke2p9YF0gPSBtb3JwaEN1cnZlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGNvbnZlcnQgYW5pbSBjaGFubmVsc1xuICAgIGZvciAoaSA9IDA7IGkgPCBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzW2ldO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBjaGFubmVsLnRhcmdldDtcbiAgICAgICAgY29uc3QgY3VydmUgPSBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdO1xuXG4gICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1t0YXJnZXQubm9kZV07XG4gICAgICAgIGNvbnN0IGVudGl0eVBhdGggPSBjb25zdHJ1Y3ROb2RlUGF0aChub2RlKTtcblxuICAgICAgICBpZiAodGFyZ2V0LnBhdGguc3RhcnRzV2l0aCgnd2VpZ2h0cycpKSB7XG4gICAgICAgICAgICBjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyhjdXJ2ZSwgbm9kZSwgZW50aXR5UGF0aCk7XG4gICAgICAgICAgICAvLyBhZnRlciBhbGwgbW9ycGggdGFyZ2V0cyBpbiB0aGlzIGN1cnZlIGhhdmUgYmVlbiBpbmNsdWRlZCBpbiB0aGUgY3VydmVNYXAsIHRoaXMgY3VydmUgYW5kIGl0cyBvdXRwdXQgZGF0YSBjYW4gYmUgZGVsZXRlZFxuICAgICAgICAgICAgZGVsZXRlIGN1cnZlTWFwW2NoYW5uZWwuc2FtcGxlcl07XG4gICAgICAgICAgICBkZWxldGUgb3V0cHV0TWFwW2N1cnZlLm91dHB1dF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjdXJ2ZS5wYXRocy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlbnRpdHlQYXRoOiBlbnRpdHlQYXRoLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudDogJ2dyYXBoJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6IFt0cmFuc2Zvcm1TY2hlbWFbdGFyZ2V0LnBhdGhdXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGNvbnN0IGlucHV0cyA9IFtdO1xuICAgIGNvbnN0IG91dHB1dHMgPSBbXTtcbiAgICBjb25zdCBjdXJ2ZXMgPSBbXTtcblxuICAgIC8vIEFkZCBlYWNoIGlucHV0IGluIHRoZSBtYXAgdG8gdGhlIGZpbmFsIGlucHV0cyBhcnJheS4gVGhlIGlucHV0TWFwIHNob3VsZCBub3cgcmVmZXJlbmNlIHRoZSBpbmRleCBvZiBpbnB1dCBpbiB0aGUgaW5wdXRzIGFycmF5IGluc3RlYWQgb2YgdGhlIGlucHV0IGl0c2VsZi5cbiAgICBmb3IgKGNvbnN0IGlucHV0S2V5IGluIGlucHV0TWFwKSB7XG4gICAgICAgIGlucHV0cy5wdXNoKGlucHV0TWFwW2lucHV0S2V5XSk7XG4gICAgICAgIGlucHV0TWFwW2lucHV0S2V5XSA9IGlucHV0cy5sZW5ndGggLSAxO1xuICAgIH1cbiAgICAvLyBBZGQgZWFjaCBvdXRwdXQgaW4gdGhlIG1hcCB0byB0aGUgZmluYWwgb3V0cHV0cyBhcnJheS4gVGhlIG91dHB1dE1hcCBzaG91bGQgbm93IHJlZmVyZW5jZSB0aGUgaW5kZXggb2Ygb3V0cHV0IGluIHRoZSBvdXRwdXRzIGFycmF5IGluc3RlYWQgb2YgdGhlIG91dHB1dCBpdHNlbGYuXG4gICAgZm9yIChjb25zdCBvdXRwdXRLZXkgaW4gb3V0cHV0TWFwKSB7XG4gICAgICAgIG91dHB1dHMucHVzaChvdXRwdXRNYXBbb3V0cHV0S2V5XSk7XG4gICAgICAgIG91dHB1dE1hcFtvdXRwdXRLZXldID0gb3V0cHV0cy5sZW5ndGggLSAxO1xuICAgIH1cbiAgICAvLyBDcmVhdGUgYW4gQW5pbUN1cnZlIGZvciBlYWNoIGN1cnZlIG9iamVjdCBpbiB0aGUgY3VydmVNYXAuIEVhY2ggY3VydmUgb2JqZWN0J3MgaW5wdXQgdmFsdWUgc2hvdWxkIGJlIHJlc29sdmVkIHRvIHRoZSBpbmRleCBvZiB0aGUgaW5wdXQgaW4gdGhlXG4gICAgLy8gaW5wdXRzIGFycmF5cyB1c2luZyB0aGUgaW5wdXRNYXAuIExpa2V3aXNlIGZvciBvdXRwdXQgdmFsdWVzLlxuICAgIGZvciAoY29uc3QgY3VydmVLZXkgaW4gY3VydmVNYXApIHtcbiAgICAgICAgY29uc3QgY3VydmVEYXRhID0gY3VydmVNYXBbY3VydmVLZXldO1xuICAgICAgICBjdXJ2ZXMucHVzaChuZXcgQW5pbUN1cnZlKFxuICAgICAgICAgICAgY3VydmVEYXRhLnBhdGhzLFxuICAgICAgICAgICAgaW5wdXRNYXBbY3VydmVEYXRhLmlucHV0XSxcbiAgICAgICAgICAgIG91dHB1dE1hcFtjdXJ2ZURhdGEub3V0cHV0XSxcbiAgICAgICAgICAgIGN1cnZlRGF0YS5pbnRlcnBvbGF0aW9uXG4gICAgICAgICkpO1xuXG4gICAgICAgIC8vIGlmIHRoaXMgdGFyZ2V0IGlzIGEgc2V0IG9mIHF1YXRlcm5pb24ga2V5cywgbWFrZSBub3RlIG9mIGl0cyBpbmRleCBzbyB3ZSBjYW4gcGVyZm9ybVxuICAgICAgICAvLyBxdWF0ZXJuaW9uLXNwZWNpZmljIHByb2Nlc3Npbmcgb24gaXQuXG4gICAgICAgIGlmIChjdXJ2ZURhdGEucGF0aHMubGVuZ3RoID4gMCAmJiBjdXJ2ZURhdGEucGF0aHNbMF0ucHJvcGVydHlQYXRoWzBdID09PSAnbG9jYWxSb3RhdGlvbicgJiYgY3VydmVEYXRhLmludGVycG9sYXRpb24gIT09IElOVEVSUE9MQVRJT05fQ1VCSUMpIHtcbiAgICAgICAgICAgIHF1YXRBcnJheXMucHVzaChjdXJ2ZXNbY3VydmVzLmxlbmd0aCAtIDFdLm91dHB1dCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHRoZSBsaXN0IG9mIGFycmF5IGluZGV4ZXMgc28gd2UgY2FuIHNraXAgZHVwc1xuICAgIHF1YXRBcnJheXMuc29ydCgpO1xuXG4gICAgLy8gcnVuIHRocm91Z2ggdGhlIHF1YXRlcm5pb24gZGF0YSBhcnJheXMgZmxpcHBpbmcgcXVhdGVybmlvbiBrZXlzXG4gICAgLy8gdGhhdCBkb24ndCBmYWxsIGluIHRoZSBzYW1lIHdpbmRpbmcgb3JkZXIuXG4gICAgbGV0IHByZXZJbmRleCA9IG51bGw7XG4gICAgbGV0IGRhdGE7XG4gICAgZm9yIChpID0gMDsgaSA8IHF1YXRBcnJheXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBxdWF0QXJyYXlzW2ldO1xuICAgICAgICAvLyBza2lwIG92ZXIgZHVwbGljYXRlIGFycmF5IGluZGljZXNcbiAgICAgICAgaWYgKGkgPT09IDAgfHwgaW5kZXggIT09IHByZXZJbmRleCkge1xuICAgICAgICAgICAgZGF0YSA9IG91dHB1dHNbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKGRhdGEuY29tcG9uZW50cyA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGQgPSBkYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVuID0gZC5sZW5ndGggLSA0O1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqICs9IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHAgPSBkW2ogKyAwXSAqIGRbaiArIDRdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgMV0gKiBkW2ogKyA1XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDJdICogZFtqICsgNl0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAzXSAqIGRbaiArIDddO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChkcCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDRdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNV0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA2XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDddICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJldkluZGV4ID0gaW5kZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjYWxjdWxhdGUgZHVyYXRpb24gb2YgdGhlIGFuaW1hdGlvbiBhcyBtYXhpbXVtIHRpbWUgdmFsdWVcbiAgICBsZXQgZHVyYXRpb24gPSAwO1xuICAgIGZvciAoaSA9IDA7IGkgPCBpbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZGF0YSAgPSBpbnB1dHNbaV0uX2RhdGE7XG4gICAgICAgIGR1cmF0aW9uID0gTWF0aC5tYXgoZHVyYXRpb24sIGRhdGEubGVuZ3RoID09PSAwID8gMCA6IGRhdGFbZGF0YS5sZW5ndGggLSAxXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBBbmltVHJhY2soXG4gICAgICAgIGdsdGZBbmltYXRpb24uaGFzT3duUHJvcGVydHkoJ25hbWUnKSA/IGdsdGZBbmltYXRpb24ubmFtZSA6ICgnYW5pbWF0aW9uXycgKyBhbmltYXRpb25JbmRleCksXG4gICAgICAgIGR1cmF0aW9uLFxuICAgICAgICBpbnB1dHMsXG4gICAgICAgIG91dHB1dHMsXG4gICAgICAgIGN1cnZlcyk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlID0gZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICBjb25zdCBlbnRpdHkgPSBuZXcgR3JhcGhOb2RlKCk7XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ25hbWUnKSAmJiBnbHRmTm9kZS5uYW1lLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZW50aXR5Lm5hbWUgPSBnbHRmTm9kZS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVudGl0eS5uYW1lID0gJ25vZGVfJyArIG5vZGVJbmRleDtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSB0cmFuc2Zvcm1hdGlvbiBwcm9wZXJ0aWVzXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdtYXRyaXgnKSkge1xuICAgICAgICB0ZW1wTWF0LmRhdGEuc2V0KGdsdGZOb2RlLm1hdHJpeCk7XG4gICAgICAgIHRlbXBNYXQuZ2V0VHJhbnNsYXRpb24odGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHRlbXBWZWMpO1xuICAgICAgICB0ZW1wTWF0LmdldEV1bGVyQW5nbGVzKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyh0ZW1wVmVjKTtcbiAgICAgICAgdGVtcE1hdC5nZXRTY2FsZSh0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsU2NhbGUodGVtcFZlYyk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdyb3RhdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHIgPSBnbHRmTm9kZS5yb3RhdGlvbjtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUm90YXRpb24oclswXSwgclsxXSwgclsyXSwgclszXSk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCd0cmFuc2xhdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHQgPSBnbHRmTm9kZS50cmFuc2xhdGlvbjtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUG9zaXRpb24odFswXSwgdFsxXSwgdFsyXSk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgIGNvbnN0IHMgPSBnbHRmTm9kZS5zY2FsZTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsU2NhbGUoc1swXSwgc1sxXSwgc1syXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudGl0eTtcbn07XG5cbi8vIGNyZWF0ZXMgYSBjYW1lcmEgY29tcG9uZW50IG9uIHRoZSBzdXBwbGllZCBub2RlLCBhbmQgcmV0dXJucyBpdFxuY29uc3QgY3JlYXRlQ2FtZXJhID0gZnVuY3Rpb24gKGdsdGZDYW1lcmEsIG5vZGUpIHtcblxuICAgIGNvbnN0IHByb2plY3Rpb24gPSBnbHRmQ2FtZXJhLnR5cGUgPT09ICdvcnRob2dyYXBoaWMnID8gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgOiBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFO1xuICAgIGNvbnN0IGdsdGZQcm9wZXJ0aWVzID0gcHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgPyBnbHRmQ2FtZXJhLm9ydGhvZ3JhcGhpYyA6IGdsdGZDYW1lcmEucGVyc3BlY3RpdmU7XG5cbiAgICBjb25zdCBjb21wb25lbnREYXRhID0ge1xuICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgICAgcHJvamVjdGlvbjogcHJvamVjdGlvbixcbiAgICAgICAgbmVhckNsaXA6IGdsdGZQcm9wZXJ0aWVzLnpuZWFyLFxuICAgICAgICBhc3BlY3RSYXRpb01vZGU6IEFTUEVDVF9BVVRPXG4gICAgfTtcblxuICAgIGlmIChnbHRmUHJvcGVydGllcy56ZmFyKSB7XG4gICAgICAgIGNvbXBvbmVudERhdGEuZmFyQ2xpcCA9IGdsdGZQcm9wZXJ0aWVzLnpmYXI7XG4gICAgfVxuXG4gICAgaWYgKHByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDKSB7XG4gICAgICAgIGNvbXBvbmVudERhdGEub3J0aG9IZWlnaHQgPSAwLjUgKiBnbHRmUHJvcGVydGllcy55bWFnO1xuICAgICAgICBpZiAoZ2x0ZlByb3BlcnRpZXMueW1hZykge1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfTUFOVUFMO1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpbyA9IGdsdGZQcm9wZXJ0aWVzLnhtYWcgLyBnbHRmUHJvcGVydGllcy55bWFnO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5mb3YgPSBnbHRmUHJvcGVydGllcy55Zm92ICogbWF0aC5SQURfVE9fREVHO1xuICAgICAgICBpZiAoZ2x0ZlByb3BlcnRpZXMuYXNwZWN0UmF0aW8pIHtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW9Nb2RlID0gQVNQRUNUX01BTlVBTDtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW8gPSBnbHRmUHJvcGVydGllcy5hc3BlY3RSYXRpbztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNhbWVyYUVudGl0eSA9IG5ldyBFbnRpdHkoZ2x0ZkNhbWVyYS5uYW1lKTtcbiAgICBjYW1lcmFFbnRpdHkuYWRkQ29tcG9uZW50KCdjYW1lcmEnLCBjb21wb25lbnREYXRhKTtcbiAgICByZXR1cm4gY2FtZXJhRW50aXR5O1xufTtcblxuLy8gY3JlYXRlcyBsaWdodCBjb21wb25lbnQsIGFkZHMgaXQgdG8gdGhlIG5vZGUgYW5kIHJldHVybnMgdGhlIGNyZWF0ZWQgbGlnaHQgY29tcG9uZW50XG5jb25zdCBjcmVhdGVMaWdodCA9IGZ1bmN0aW9uIChnbHRmTGlnaHQsIG5vZGUpIHtcblxuICAgIGNvbnN0IGxpZ2h0UHJvcHMgPSB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICB0eXBlOiBnbHRmTGlnaHQudHlwZSA9PT0gJ3BvaW50JyA/ICdvbW5pJyA6IGdsdGZMaWdodC50eXBlLFxuICAgICAgICBjb2xvcjogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdjb2xvcicpID8gbmV3IENvbG9yKGdsdGZMaWdodC5jb2xvcikgOiBDb2xvci5XSElURSxcblxuICAgICAgICAvLyB3aGVuIHJhbmdlIGlzIG5vdCBkZWZpbmVkLCBpbmZpbml0eSBzaG91bGQgYmUgdXNlZCAtIGJ1dCB0aGF0IGlzIGNhdXNpbmcgaW5maW5pdHkgaW4gYm91bmRzIGNhbGN1bGF0aW9uc1xuICAgICAgICByYW5nZTogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdyYW5nZScpID8gZ2x0ZkxpZ2h0LnJhbmdlIDogOTk5OSxcblxuICAgICAgICBmYWxsb2ZmTW9kZTogTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuXG4gICAgICAgIC8vIFRPRE86IChlbmdpbmUgaXNzdWUgIzMyNTIpIFNldCBpbnRlbnNpdHkgdG8gbWF0Y2ggZ2xURiBzcGVjaWZpY2F0aW9uLCB3aGljaCB1c2VzIHBoeXNpY2FsbHkgYmFzZWQgdmFsdWVzOlxuICAgICAgICAvLyAtIE9tbmkgYW5kIHNwb3QgbGlnaHRzIHVzZSBsdW1pbm91cyBpbnRlbnNpdHkgaW4gY2FuZGVsYSAobG0vc3IpXG4gICAgICAgIC8vIC0gRGlyZWN0aW9uYWwgbGlnaHRzIHVzZSBpbGx1bWluYW5jZSBpbiBsdXggKGxtL20yKS5cbiAgICAgICAgLy8gQ3VycmVudCBpbXBsZW1lbnRhdGlvbjogY2xhcG1zIHNwZWNpZmllZCBpbnRlbnNpdHkgdG8gMC4uMiByYW5nZVxuICAgICAgICBpbnRlbnNpdHk6IGdsdGZMaWdodC5oYXNPd25Qcm9wZXJ0eSgnaW50ZW5zaXR5JykgPyBtYXRoLmNsYW1wKGdsdGZMaWdodC5pbnRlbnNpdHksIDAsIDIpIDogMVxuICAgIH07XG5cbiAgICBpZiAoZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdzcG90JykpIHtcbiAgICAgICAgbGlnaHRQcm9wcy5pbm5lckNvbmVBbmdsZSA9IGdsdGZMaWdodC5zcG90Lmhhc093blByb3BlcnR5KCdpbm5lckNvbmVBbmdsZScpID8gZ2x0ZkxpZ2h0LnNwb3QuaW5uZXJDb25lQW5nbGUgKiBtYXRoLlJBRF9UT19ERUcgOiAwO1xuICAgICAgICBsaWdodFByb3BzLm91dGVyQ29uZUFuZ2xlID0gZ2x0ZkxpZ2h0LnNwb3QuaGFzT3duUHJvcGVydHkoJ291dGVyQ29uZUFuZ2xlJykgPyBnbHRmTGlnaHQuc3BvdC5vdXRlckNvbmVBbmdsZSAqIG1hdGguUkFEX1RPX0RFRyA6IE1hdGguUEkgLyA0O1xuICAgIH1cblxuICAgIC8vIFJvdGF0ZSB0byBtYXRjaCBsaWdodCBvcmllbnRhdGlvbiBpbiBnbFRGIHNwZWNpZmljYXRpb25cbiAgICAvLyBOb3RlIHRoYXQgdGhpcyBhZGRzIGEgbmV3IGVudGl0eSBub2RlIGludG8gdGhlIGhpZXJhcmNoeSB0aGF0IGRvZXMgbm90IGV4aXN0IGluIHRoZSBnbHRmIGhpZXJhcmNoeVxuICAgIGNvbnN0IGxpZ2h0RW50aXR5ID0gbmV3IEVudGl0eShub2RlLm5hbWUpO1xuICAgIGxpZ2h0RW50aXR5LnJvdGF0ZUxvY2FsKDkwLCAwLCAwKTtcblxuICAgIC8vIGFkZCBjb21wb25lbnRcbiAgICBsaWdodEVudGl0eS5hZGRDb21wb25lbnQoJ2xpZ2h0JywgbGlnaHRQcm9wcyk7XG4gICAgcmV0dXJuIGxpZ2h0RW50aXR5O1xufTtcblxuY29uc3QgY3JlYXRlU2tpbnMgPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld3MpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ3NraW5zJykgfHwgZ2x0Zi5za2lucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8vIGNhY2hlIGZvciBza2lucyB0byBmaWx0ZXIgb3V0IGR1cGxpY2F0ZXNcbiAgICBjb25zdCBnbGJTa2lucyA9IG5ldyBNYXAoKTtcblxuICAgIHJldHVybiBnbHRmLnNraW5zLm1hcChmdW5jdGlvbiAoZ2x0ZlNraW4pIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVNraW4oZGV2aWNlLCBnbHRmU2tpbiwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2xiU2tpbnMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlTWVzaGVzID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgb3B0aW9ucykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnbWVzaGVzJykgfHwgZ2x0Zi5tZXNoZXMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICFnbHRmLmhhc093blByb3BlcnR5KCdhY2Nlc3NvcnMnKSB8fCBnbHRmLmFjY2Vzc29ycy5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgIWdsdGYuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXdzJykgfHwgZ2x0Zi5idWZmZXJWaWV3cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8vIGRpY3Rpb25hcnkgb2YgdmVydGV4IGJ1ZmZlcnMgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgIGNvbnN0IHZlcnRleEJ1ZmZlckRpY3QgPSB7fTtcblxuICAgIHJldHVybiBnbHRmLm1lc2hlcy5tYXAoZnVuY3Rpb24gKGdsdGZNZXNoKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgZ2x0Zk1lc2gsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgY2FsbGJhY2ssIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0LCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBvcHRpb25zKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZU1hdGVyaWFscyA9IGZ1bmN0aW9uIChnbHRmLCB0ZXh0dXJlcywgb3B0aW9ucywgZmxpcFYpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ21hdGVyaWFscycpIHx8IGdsdGYubWF0ZXJpYWxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5tYXRlcmlhbCAmJiBvcHRpb25zLm1hdGVyaWFsLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5tYXRlcmlhbCAmJiBvcHRpb25zLm1hdGVyaWFsLnByb2Nlc3MgfHwgY3JlYXRlTWF0ZXJpYWw7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubWF0ZXJpYWwgJiYgb3B0aW9ucy5tYXRlcmlhbC5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLm1hdGVyaWFscy5tYXAoZnVuY3Rpb24gKGdsdGZNYXRlcmlhbCkge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTWF0ZXJpYWwpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gcHJvY2VzcyhnbHRmTWF0ZXJpYWwsIHRleHR1cmVzLCBmbGlwVik7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zk1hdGVyaWFsLCBtYXRlcmlhbCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlVmFyaWFudHMgPSBmdW5jdGlvbiAoZ2x0Zikge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eShcImV4dGVuc2lvbnNcIikgfHwgIWdsdGYuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eShcIktIUl9tYXRlcmlhbHNfdmFyaWFudHNcIikpXG4gICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZGF0YSA9IGdsdGYuZXh0ZW5zaW9ucy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzLnZhcmlhbnRzO1xuICAgIGNvbnN0IHZhcmlhbnRzID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhcmlhbnRzW2RhdGFbaV0ubmFtZV0gPSBpO1xuICAgIH1cbiAgICByZXR1cm4gdmFyaWFudHM7XG59O1xuXG5jb25zdCBjcmVhdGVBbmltYXRpb25zID0gZnVuY3Rpb24gKGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3cywgb3B0aW9ucykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnYW5pbWF0aW9ucycpIHx8IGdsdGYuYW5pbWF0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLnBvc3Rwcm9jZXNzO1xuXG4gICAgcmV0dXJuIGdsdGYuYW5pbWF0aW9ucy5tYXAoZnVuY3Rpb24gKGdsdGZBbmltYXRpb24sIGluZGV4KSB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZBbmltYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFuaW1hdGlvbiA9IGNyZWF0ZUFuaW1hdGlvbihnbHRmQW5pbWF0aW9uLCBpbmRleCwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2x0Zi5tZXNoZXMpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZBbmltYXRpb24sIGFuaW1hdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFuaW1hdGlvbjtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZU5vZGVzID0gZnVuY3Rpb24gKGdsdGYsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ25vZGVzJykgfHwgZ2x0Zi5ub2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubm9kZSAmJiBvcHRpb25zLm5vZGUucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm5vZGUgJiYgb3B0aW9ucy5ub2RlLnByb2Nlc3MgfHwgY3JlYXRlTm9kZTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5ub2RlICYmIG9wdGlvbnMubm9kZS5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IG5vZGVzID0gZ2x0Zi5ub2Rlcy5tYXAoZnVuY3Rpb24gKGdsdGZOb2RlLCBpbmRleCkge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgbm9kZSA9IHByb2Nlc3MoZ2x0Zk5vZGUsIGluZGV4KTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTm9kZSwgbm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfSk7XG5cbiAgICAvLyBidWlsZCBub2RlIGhpZXJhcmNoeVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0Zi5ub2Rlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmTm9kZSA9IGdsdGYubm9kZXNbaV07XG4gICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnY2hpbGRyZW4nKSkge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gbm9kZXNbaV07XG4gICAgICAgICAgICBjb25zdCB1bmlxdWVOYW1lcyA9IHsgfTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZ2x0Zk5vZGUuY2hpbGRyZW4ubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IG5vZGVzW2dsdGZOb2RlLmNoaWxkcmVuW2pdXTtcbiAgICAgICAgICAgICAgICBpZiAoIWNoaWxkLnBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodW5pcXVlTmFtZXMuaGFzT3duUHJvcGVydHkoY2hpbGQubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkLm5hbWUgKz0gdW5pcXVlTmFtZXNbY2hpbGQubmFtZV0rKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaXF1ZU5hbWVzW2NoaWxkLm5hbWVdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQuYWRkQ2hpbGQoY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2Rlcztcbn07XG5cbmNvbnN0IGNyZWF0ZVNjZW5lcyA9IGZ1bmN0aW9uIChnbHRmLCBub2Rlcykge1xuICAgIGNvbnN0IHNjZW5lcyA9IFtdO1xuICAgIGNvbnN0IGNvdW50ID0gZ2x0Zi5zY2VuZXMubGVuZ3RoO1xuXG4gICAgLy8gaWYgdGhlcmUncyBhIHNpbmdsZSBzY2VuZSB3aXRoIGEgc2luZ2xlIG5vZGUgaW4gaXQsIGRvbid0IGNyZWF0ZSB3cmFwcGVyIG5vZGVzXG4gICAgaWYgKGNvdW50ID09PSAxICYmIGdsdGYuc2NlbmVzWzBdLm5vZGVzPy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgY29uc3Qgbm9kZUluZGV4ID0gZ2x0Zi5zY2VuZXNbMF0ubm9kZXNbMF07XG4gICAgICAgIHNjZW5lcy5wdXNoKG5vZGVzW25vZGVJbmRleF0pO1xuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIHJvb3Qgbm9kZSBwZXIgc2NlbmVcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGdsdGYuc2NlbmVzW2ldO1xuICAgICAgICAgICAgaWYgKHNjZW5lLm5vZGVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NlbmVSb290ID0gbmV3IEdyYXBoTm9kZShzY2VuZS5uYW1lKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IHNjZW5lLm5vZGVzLmxlbmd0aDsgbisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkTm9kZSA9IG5vZGVzW3NjZW5lLm5vZGVzW25dXTtcbiAgICAgICAgICAgICAgICAgICAgc2NlbmVSb290LmFkZENoaWxkKGNoaWxkTm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNjZW5lcy5wdXNoKHNjZW5lUm9vdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc2NlbmVzO1xufTtcblxuY29uc3QgY3JlYXRlQ2FtZXJhcyA9IGZ1bmN0aW9uIChnbHRmLCBub2Rlcywgb3B0aW9ucykge1xuXG4gICAgbGV0IGNhbWVyYXMgPSBudWxsO1xuXG4gICAgaWYgKGdsdGYuaGFzT3duUHJvcGVydHkoJ25vZGVzJykgJiYgZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnY2FtZXJhcycpICYmIGdsdGYuY2FtZXJhcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jYW1lcmEgJiYgb3B0aW9ucy5jYW1lcmEucHJlcHJvY2VzcztcbiAgICAgICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jYW1lcmEgJiYgb3B0aW9ucy5jYW1lcmEucHJvY2VzcyB8fCBjcmVhdGVDYW1lcmE7XG4gICAgICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhbWVyYSAmJiBvcHRpb25zLmNhbWVyYS5wb3N0cHJvY2VzcztcblxuICAgICAgICBnbHRmLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICAgICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnY2FtZXJhJykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBnbHRmQ2FtZXJhID0gZ2x0Zi5jYW1lcmFzW2dsdGZOb2RlLmNhbWVyYV07XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZkNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gcHJvY2VzcyhnbHRmQ2FtZXJhLCBub2Rlc1tub2RlSW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQ2FtZXJhLCBjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBjYW1lcmEgdG8gbm9kZS0+Y2FtZXJhIG1hcFxuICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNhbWVyYXMpIGNhbWVyYXMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFzLnNldChnbHRmTm9kZSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNhbWVyYXM7XG59O1xuXG5jb25zdCBjcmVhdGVMaWdodHMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpIHtcblxuICAgIGxldCBsaWdodHMgPSBudWxsO1xuXG4gICAgaWYgKGdsdGYuaGFzT3duUHJvcGVydHkoJ25vZGVzJykgJiYgZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnZXh0ZW5zaW9ucycpICYmXG4gICAgICAgIGdsdGYuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2xpZ2h0c19wdW5jdHVhbCcpICYmIGdsdGYuZXh0ZW5zaW9ucy5LSFJfbGlnaHRzX3B1bmN0dWFsLmhhc093blByb3BlcnR5KCdsaWdodHMnKSkge1xuXG4gICAgICAgIGNvbnN0IGdsdGZMaWdodHMgPSBnbHRmLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5saWdodHM7XG4gICAgICAgIGlmIChnbHRmTGlnaHRzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpZ2h0ICYmIG9wdGlvbnMubGlnaHQucHJlcHJvY2VzcztcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubGlnaHQgJiYgb3B0aW9ucy5saWdodC5wcm9jZXNzIHx8IGNyZWF0ZUxpZ2h0O1xuICAgICAgICAgICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubGlnaHQgJiYgb3B0aW9ucy5saWdodC5wb3N0cHJvY2VzcztcblxuICAgICAgICAgICAgLy8gaGFuZGxlIG5vZGVzIHdpdGggbGlnaHRzXG4gICAgICAgICAgICBnbHRmLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSAmJlxuICAgICAgICAgICAgICAgICAgICBnbHRmTm9kZS5leHRlbnNpb25zLmhhc093blByb3BlcnR5KCdLSFJfbGlnaHRzX3B1bmN0dWFsJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5LSFJfbGlnaHRzX3B1bmN0dWFsLmhhc093blByb3BlcnR5KCdsaWdodCcpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRJbmRleCA9IGdsdGZOb2RlLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5saWdodDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkxpZ2h0ID0gZ2x0ZkxpZ2h0c1tsaWdodEluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZMaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZMaWdodCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IHByb2Nlc3MoZ2x0ZkxpZ2h0LCBub2Rlc1tub2RlSW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZMaWdodCwgbGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdGhlIGxpZ2h0IHRvIG5vZGUtPmxpZ2h0IG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodHMpIGxpZ2h0cyA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaWdodHMuc2V0KGdsdGZOb2RlLCBsaWdodCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsaWdodHM7XG59O1xuXG4vLyBsaW5rIHNraW5zIHRvIHRoZSBtZXNoZXNcbmNvbnN0IGxpbmtTa2lucyA9IGZ1bmN0aW9uIChnbHRmLCByZW5kZXJzLCBza2lucykge1xuICAgIGdsdGYubm9kZXMuZm9yRWFjaCgoZ2x0Zk5vZGUpID0+IHtcbiAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdtZXNoJykgJiYgZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3NraW4nKSkge1xuICAgICAgICAgICAgY29uc3QgbWVzaEdyb3VwID0gcmVuZGVyc1tnbHRmTm9kZS5tZXNoXS5tZXNoZXM7XG4gICAgICAgICAgICBtZXNoR3JvdXAuZm9yRWFjaCgobWVzaCkgPT4ge1xuICAgICAgICAgICAgICAgIG1lc2guc2tpbiA9IHNraW5zW2dsdGZOb2RlLnNraW5dO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8vIGNyZWF0ZSBlbmdpbmUgcmVzb3VyY2VzIGZyb20gdGhlIGRvd25sb2FkZWQgR0xCIGRhdGFcbmNvbnN0IGNyZWF0ZVJlc291cmNlcyA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCB0ZXh0dXJlQXNzZXRzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuZ2xvYmFsICYmIG9wdGlvbnMuZ2xvYmFsLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuZ2xvYmFsICYmIG9wdGlvbnMuZ2xvYmFsLnBvc3Rwcm9jZXNzO1xuXG4gICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgcHJlcHJvY2VzcyhnbHRmKTtcbiAgICB9XG5cbiAgICAvLyBUaGUgb3JpZ2luYWwgdmVyc2lvbiBvZiBGQUNUIGdlbmVyYXRlZCBpbmNvcnJlY3RseSBmbGlwcGVkIFYgdGV4dHVyZVxuICAgIC8vIGNvb3JkaW5hdGVzLiBXZSBtdXN0IGNvbXBlbnNhdGUgYnkgZmxpcHBpbmcgViBpbiB0aGlzIGNhc2UuIE9uY2VcbiAgICAvLyBhbGwgbW9kZWxzIGhhdmUgYmVlbiByZS1leHBvcnRlZCB3ZSBjYW4gcmVtb3ZlIHRoaXMgZmxhZy5cbiAgICBjb25zdCBmbGlwViA9IGdsdGYuYXNzZXQgJiYgZ2x0Zi5hc3NldC5nZW5lcmF0b3IgPT09ICdQbGF5Q2FudmFzJztcblxuICAgIC8vIFdlJ2QgbGlrZSB0byByZW1vdmUgdGhlIGZsaXBWIGNvZGUgYXQgc29tZSBwb2ludC5cbiAgICBpZiAoZmxpcFYpIHtcbiAgICAgICAgRGVidWcud2FybignZ2xURiBtb2RlbCBtYXkgaGF2ZSBmbGlwcGVkIFVWcy4gUGxlYXNlIHJlY29udmVydC4nKTtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlcyA9IGNyZWF0ZU5vZGVzKGdsdGYsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHNjZW5lcyA9IGNyZWF0ZVNjZW5lcyhnbHRmLCBub2Rlcyk7XG4gICAgY29uc3QgbGlnaHRzID0gY3JlYXRlTGlnaHRzKGdsdGYsIG5vZGVzLCBvcHRpb25zKTtcbiAgICBjb25zdCBjYW1lcmFzID0gY3JlYXRlQ2FtZXJhcyhnbHRmLCBub2Rlcywgb3B0aW9ucyk7XG4gICAgY29uc3QgYW5pbWF0aW9ucyA9IGNyZWF0ZUFuaW1hdGlvbnMoZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzLCBvcHRpb25zKTtcbiAgICBjb25zdCBtYXRlcmlhbHMgPSBjcmVhdGVNYXRlcmlhbHMoZ2x0ZiwgdGV4dHVyZUFzc2V0cy5tYXAoZnVuY3Rpb24gKHRleHR1cmVBc3NldCkge1xuICAgICAgICByZXR1cm4gdGV4dHVyZUFzc2V0LnJlc291cmNlO1xuICAgIH0pLCBvcHRpb25zLCBmbGlwVik7XG4gICAgY29uc3QgdmFyaWFudHMgPSBjcmVhdGVWYXJpYW50cyhnbHRmKTtcbiAgICBjb25zdCBtZXNoVmFyaWFudHMgPSB7fTtcbiAgICBjb25zdCBtZXNoRGVmYXVsdE1hdGVyaWFscyA9IHt9O1xuICAgIGNvbnN0IG1lc2hlcyA9IGNyZWF0ZU1lc2hlcyhkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCBjYWxsYmFjaywgZmxpcFYsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHNraW5zID0gY3JlYXRlU2tpbnMoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld3MpO1xuXG4gICAgLy8gY3JlYXRlIHJlbmRlcnMgdG8gd3JhcCBtZXNoZXNcbiAgICBjb25zdCByZW5kZXJzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVuZGVyc1tpXSA9IG5ldyBSZW5kZXIoKTtcbiAgICAgICAgcmVuZGVyc1tpXS5tZXNoZXMgPSBtZXNoZXNbaV07XG4gICAgfVxuXG4gICAgLy8gbGluayBza2lucyB0byBtZXNoZXNcbiAgICBsaW5rU2tpbnMoZ2x0ZiwgcmVuZGVycywgc2tpbnMpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IEdsYlJlc291cmNlcyhnbHRmKTtcbiAgICByZXN1bHQubm9kZXMgPSBub2RlcztcbiAgICByZXN1bHQuc2NlbmVzID0gc2NlbmVzO1xuICAgIHJlc3VsdC5hbmltYXRpb25zID0gYW5pbWF0aW9ucztcbiAgICByZXN1bHQudGV4dHVyZXMgPSB0ZXh0dXJlQXNzZXRzO1xuICAgIHJlc3VsdC5tYXRlcmlhbHMgPSBtYXRlcmlhbHM7XG4gICAgcmVzdWx0LnZhcmlhbnRzID0gdmFyaWFudHM7XG4gICAgcmVzdWx0Lm1lc2hWYXJpYW50cyA9IG1lc2hWYXJpYW50cztcbiAgICByZXN1bHQubWVzaERlZmF1bHRNYXRlcmlhbHMgPSBtZXNoRGVmYXVsdE1hdGVyaWFscztcbiAgICByZXN1bHQucmVuZGVycyA9IHJlbmRlcnM7XG4gICAgcmVzdWx0LnNraW5zID0gc2tpbnM7XG4gICAgcmVzdWx0LmxpZ2h0cyA9IGxpZ2h0cztcbiAgICByZXN1bHQuY2FtZXJhcyA9IGNhbWVyYXM7XG5cbiAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZiwgcmVzdWx0KTtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xufTtcblxuY29uc3QgYXBwbHlTYW1wbGVyID0gZnVuY3Rpb24gKHRleHR1cmUsIGdsdGZTYW1wbGVyKSB7XG4gICAgY29uc3QgZ2V0RmlsdGVyID0gZnVuY3Rpb24gKGZpbHRlciwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgIHN3aXRjaCAoZmlsdGVyKSB7XG4gICAgICAgICAgICBjYXNlIDk3Mjg6IHJldHVybiBGSUxURVJfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTcyOTogcmV0dXJuIEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICBjYXNlIDk5ODQ6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTk4NTogcmV0dXJuIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk5ODY6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgY2FzZSA5OTg3OiByZXR1cm4gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgZGVmYXVsdDogICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGdldFdyYXAgPSBmdW5jdGlvbiAod3JhcCwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgIHN3aXRjaCAod3JhcCkge1xuICAgICAgICAgICAgY2FzZSAzMzA3MTogcmV0dXJuIEFERFJFU1NfQ0xBTVBfVE9fRURHRTtcbiAgICAgICAgICAgIGNhc2UgMzM2NDg6IHJldHVybiBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDtcbiAgICAgICAgICAgIGNhc2UgMTA0OTc6IHJldHVybiBBRERSRVNTX1JFUEVBVDtcbiAgICAgICAgICAgIGRlZmF1bHQ6ICAgIHJldHVybiBkZWZhdWx0VmFsdWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHRleHR1cmUpIHtcbiAgICAgICAgZ2x0ZlNhbXBsZXIgPSBnbHRmU2FtcGxlciB8fCB7IH07XG4gICAgICAgIHRleHR1cmUubWluRmlsdGVyID0gZ2V0RmlsdGVyKGdsdGZTYW1wbGVyLm1pbkZpbHRlciwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5tYWdGaWx0ZXIgPSBnZXRGaWx0ZXIoZ2x0ZlNhbXBsZXIubWFnRmlsdGVyLCBGSUxURVJfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzVSA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFMsIEFERFJFU1NfUkVQRUFUKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzViA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFQsIEFERFJFU1NfUkVQRUFUKTtcbiAgICB9XG59O1xuXG5sZXQgZ2x0ZlRleHR1cmVVbmlxdWVJZCA9IDA7XG5cbi8vIGxvYWQgYW4gaW1hZ2VcbmNvbnN0IGxvYWRJbWFnZUFzeW5jID0gZnVuY3Rpb24gKGdsdGZJbWFnZSwgaW5kZXgsIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmltYWdlICYmIG9wdGlvbnMuaW1hZ2UucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLmltYWdlICYmIG9wdGlvbnMuaW1hZ2UucHJvY2Vzc0FzeW5jKSB8fCBmdW5jdGlvbiAoZ2x0ZkltYWdlLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmltYWdlICYmIG9wdGlvbnMuaW1hZ2UucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkltYWdlLCB0ZXh0dXJlQXNzZXQpO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRleHR1cmVBc3NldCk7XG4gICAgfTtcblxuICAgIGNvbnN0IG1pbWVUeXBlRmlsZUV4dGVuc2lvbnMgPSB7XG4gICAgICAgICdpbWFnZS9wbmcnOiAncG5nJyxcbiAgICAgICAgJ2ltYWdlL2pwZWcnOiAnanBnJyxcbiAgICAgICAgJ2ltYWdlL2Jhc2lzJzogJ2Jhc2lzJyxcbiAgICAgICAgJ2ltYWdlL2t0eCc6ICdrdHgnLFxuICAgICAgICAnaW1hZ2Uva3R4Mic6ICdrdHgyJyxcbiAgICAgICAgJ2ltYWdlL3ZuZC1tcy5kZHMnOiAnZGRzJ1xuICAgIH07XG5cbiAgICBjb25zdCBsb2FkVGV4dHVyZSA9IGZ1bmN0aW9uICh1cmwsIGJ1ZmZlclZpZXcsIG1pbWVUeXBlLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSAoZ2x0ZkltYWdlLm5hbWUgfHwgJ2dsdGYtdGV4dHVyZScpICsgJy0nICsgZ2x0ZlRleHR1cmVVbmlxdWVJZCsrO1xuXG4gICAgICAgIC8vIGNvbnN0cnVjdCB0aGUgYXNzZXQgZmlsZVxuICAgICAgICBjb25zdCBmaWxlID0ge1xuICAgICAgICAgICAgdXJsOiB1cmwgfHwgbmFtZVxuICAgICAgICB9O1xuICAgICAgICBpZiAoYnVmZmVyVmlldykge1xuICAgICAgICAgICAgZmlsZS5jb250ZW50cyA9IGJ1ZmZlclZpZXcuc2xpY2UoMCkuYnVmZmVyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtaW1lVHlwZSkge1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gbWltZVR5cGVGaWxlRXh0ZW5zaW9uc1ttaW1lVHlwZV07XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uKSB7XG4gICAgICAgICAgICAgICAgZmlsZS5maWxlbmFtZSA9IGZpbGUudXJsICsgJy4nICsgZXh0ZW5zaW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCBsb2FkIHRoZSBhc3NldFxuICAgICAgICBjb25zdCBhc3NldCA9IG5ldyBBc3NldChuYW1lLCAndGV4dHVyZScsIGZpbGUsIG51bGwsIG9wdGlvbnMpO1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIG9uTG9hZCk7XG4gICAgICAgIGFzc2V0Lm9uKCdlcnJvcicsIGNhbGxiYWNrKTtcbiAgICAgICAgcmVnaXN0cnkuYWRkKGFzc2V0KTtcbiAgICAgICAgcmVnaXN0cnkubG9hZChhc3NldCk7XG4gICAgfTtcblxuICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgIHByZXByb2Nlc3MoZ2x0ZkltYWdlKTtcbiAgICB9XG5cbiAgICBwcm9jZXNzQXN5bmMoZ2x0ZkltYWdlLCBmdW5jdGlvbiAoZXJyLCB0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSBlbHNlIGlmICh0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgIG9uTG9hZCh0ZXh0dXJlQXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgndXJpJykpIHtcbiAgICAgICAgICAgICAgICAvLyB1cmkgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgaWYgKGlzRGF0YVVSSShnbHRmSW1hZ2UudXJpKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZShnbHRmSW1hZ2UudXJpLCBudWxsLCBnZXREYXRhVVJJTWltZVR5cGUoZ2x0ZkltYWdlLnVyaSksIG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRUZXh0dXJlKHBhdGguam9pbih1cmxCYXNlLCBnbHRmSW1hZ2UudXJpKSwgbnVsbCwgbnVsbCwgeyBjcm9zc09yaWdpbjogJ2Fub255bW91cycgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChnbHRmSW1hZ2UuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSAmJiBnbHRmSW1hZ2UuaGFzT3duUHJvcGVydHkoJ21pbWVUeXBlJykpIHtcbiAgICAgICAgICAgICAgICAvLyBidWZmZXJ2aWV3XG4gICAgICAgICAgICAgICAgbG9hZFRleHR1cmUobnVsbCwgYnVmZmVyVmlld3NbZ2x0ZkltYWdlLmJ1ZmZlclZpZXddLCBnbHRmSW1hZ2UubWltZVR5cGUsIG51bGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBmYWlsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgaW1hZ2UgZm91bmQgaW4gZ2x0ZiAobmVpdGhlciB1cmkgb3IgYnVmZmVyVmlldyBmb3VuZCkuIGluZGV4PScgKyBpbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8vIGxvYWQgdGV4dHVyZXMgdXNpbmcgdGhlIGFzc2V0IHN5c3RlbVxuY29uc3QgbG9hZFRleHR1cmVzQXN5bmMgPSBmdW5jdGlvbiAoZ2x0ZiwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnaW1hZ2VzJykgfHwgZ2x0Zi5pbWFnZXMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICFnbHRmLmhhc093blByb3BlcnR5KCd0ZXh0dXJlcycpIHx8IGdsdGYudGV4dHVyZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIFtdKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMudGV4dHVyZSAmJiBvcHRpb25zLnRleHR1cmUucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLnRleHR1cmUgJiYgb3B0aW9ucy50ZXh0dXJlLnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZUZXh0dXJlLCBnbHRmSW1hZ2VzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLnRleHR1cmUgJiYgb3B0aW9ucy50ZXh0dXJlLnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3QgYXNzZXRzID0gW107ICAgICAgICAvLyBvbmUgcGVyIGltYWdlXG4gICAgY29uc3QgdGV4dHVyZXMgPSBbXTsgICAgICAvLyBsaXN0IHBlciBpbWFnZVxuXG4gICAgbGV0IHJlbWFpbmluZyA9IGdsdGYudGV4dHVyZXMubGVuZ3RoO1xuICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uICh0ZXh0dXJlSW5kZXgsIGltYWdlSW5kZXgpIHtcbiAgICAgICAgaWYgKCF0ZXh0dXJlc1tpbWFnZUluZGV4XSkge1xuICAgICAgICAgICAgdGV4dHVyZXNbaW1hZ2VJbmRleF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0ZXh0dXJlc1tpbWFnZUluZGV4XS5wdXNoKHRleHR1cmVJbmRleCk7XG5cbiAgICAgICAgaWYgKC0tcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgIHRleHR1cmVzLmZvckVhY2goZnVuY3Rpb24gKHRleHR1cmVMaXN0LCBpbWFnZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZUxpc3QuZm9yRWFjaChmdW5jdGlvbiAodGV4dHVyZUluZGV4LCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXh0dXJlQXNzZXQgPSAoaW5kZXggPT09IDApID8gYXNzZXRzW2ltYWdlSW5kZXhdIDogY2xvbmVUZXh0dXJlQXNzZXQoYXNzZXRzW2ltYWdlSW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgYXBwbHlTYW1wbGVyKHRleHR1cmVBc3NldC5yZXNvdXJjZSwgKGdsdGYuc2FtcGxlcnMgfHwgW10pW2dsdGYudGV4dHVyZXNbdGV4dHVyZUluZGV4XS5zYW1wbGVyXSk7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFt0ZXh0dXJlSW5kZXhdID0gdGV4dHVyZUFzc2V0O1xuICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGYudGV4dHVyZXNbdGV4dHVyZUluZGV4XSwgdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0Zi50ZXh0dXJlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmVGV4dHVyZSA9IGdsdGYudGV4dHVyZXNbaV07XG5cbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZlRleHR1cmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZUZXh0dXJlLCBnbHRmLmltYWdlcywgZnVuY3Rpb24gKGksIGdsdGZUZXh0dXJlLCBlcnIsIGdsdGZJbWFnZUluZGV4KSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZJbWFnZUluZGV4ID09PSB1bmRlZmluZWQgfHwgZ2x0ZkltYWdlSW5kZXggPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2x0ZkltYWdlSW5kZXggPSBnbHRmVGV4dHVyZT8uZXh0ZW5zaW9ucz8uS0hSX3RleHR1cmVfYmFzaXN1Py5zb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmSW1hZ2VJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbHRmSW1hZ2VJbmRleCA9IGdsdGZUZXh0dXJlLnNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhc3NldHNbZ2x0ZkltYWdlSW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGltYWdlIGhhcyBhbHJlYWR5IGJlZW4gbG9hZGVkXG4gICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBnbHRmSW1hZ2VJbmRleCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZmlyc3Qgb2NjY3VycmVuY2UsIGxvYWQgaXRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkltYWdlID0gZ2x0Zi5pbWFnZXNbZ2x0ZkltYWdlSW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBsb2FkSW1hZ2VBc3luYyhnbHRmSW1hZ2UsIGksIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2dsdGZJbWFnZUluZGV4XSA9IHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgZ2x0ZkltYWdlSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZChudWxsLCBpLCBnbHRmVGV4dHVyZSkpO1xuICAgIH1cbn07XG5cbi8vIGxvYWQgZ2x0ZiBidWZmZXJzIGFzeW5jaHJvbm91c2x5LCByZXR1cm5pbmcgdGhlbSBpbiB0aGUgY2FsbGJhY2tcbmNvbnN0IGxvYWRCdWZmZXJzQXN5bmMgPSBmdW5jdGlvbiAoZ2x0ZiwgYmluYXJ5Q2h1bmssIHVybEJhc2UsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBpZiAoIWdsdGYuYnVmZmVycyB8fCBnbHRmLmJ1ZmZlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlciAmJiBvcHRpb25zLmJ1ZmZlci5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3NBc3luYyA9IChvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyICYmIG9wdGlvbnMuYnVmZmVyLnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZCdWZmZXIsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgIH07XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyICYmIG9wdGlvbnMuYnVmZmVyLnBvc3Rwcm9jZXNzO1xuXG4gICAgbGV0IHJlbWFpbmluZyA9IGdsdGYuYnVmZmVycy5sZW5ndGg7XG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKGluZGV4LCBidWZmZXIpIHtcbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IGJ1ZmZlcjtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmLmJ1ZmZlcnNbaW5kZXhdLCBidWZmZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYuYnVmZmVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmQnVmZmVyID0gZ2x0Zi5idWZmZXJzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZCdWZmZXIsIGZ1bmN0aW9uIChpLCBnbHRmQnVmZmVyLCBlcnIsIGFycmF5QnVmZmVyKSB7ICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWxvb3AtZnVuY1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgb25Mb2FkKGksIG5ldyBVaW50OEFycmF5KGFycmF5QnVmZmVyKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChnbHRmQnVmZmVyLmhhc093blByb3BlcnR5KCd1cmknKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNEYXRhVVJJKGdsdGZCdWZmZXIudXJpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29udmVydCBiYXNlNjQgdG8gcmF3IGJpbmFyeSBkYXRhIGhlbGQgaW4gYSBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRvZXNuJ3QgaGFuZGxlIFVSTEVuY29kZWQgRGF0YVVSSXMgLSBzZWUgU08gYW5zd2VyICM2ODUwMjc2IGZvciBjb2RlIHRoYXQgZG9lcyB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBieXRlU3RyaW5nID0gYXRvYihnbHRmQnVmZmVyLnVyaS5zcGxpdCgnLCcpWzFdKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIGEgdmlldyBpbnRvIHRoZSBidWZmZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpbmFyeUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZVN0cmluZy5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIGJ5dGVzIG9mIHRoZSBidWZmZXIgdG8gdGhlIGNvcnJlY3QgdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJ5dGVTdHJpbmcubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5hcnlBcnJheVtqXSA9IGJ5dGVTdHJpbmcuY2hhckNvZGVBdChqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgb25Mb2FkKGksIGJpbmFyeUFycmF5KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGh0dHAuZ2V0KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGguam9pbih1cmxCYXNlLCBnbHRmQnVmZmVyLnVyaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBjYWNoZTogdHJ1ZSwgcmVzcG9uc2VUeXBlOiAnYXJyYXlidWZmZXInLCByZXRyeTogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAoaSwgZXJyLCByZXN1bHQpIHsgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBuZXcgVWludDhBcnJheShyZXN1bHQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0uYmluZChudWxsLCBpKVxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGdsYiBidWZmZXIgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBiaW5hcnlDaHVuayk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQobnVsbCwgaSwgZ2x0ZkJ1ZmZlcikpO1xuICAgIH1cbn07XG5cbi8vIHBhcnNlIHRoZSBnbHRmIGNodW5rLCByZXR1cm5zIHRoZSBnbHRmIGpzb25cbmNvbnN0IHBhcnNlR2x0ZiA9IGZ1bmN0aW9uIChnbHRmQ2h1bmssIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgZGVjb2RlQmluYXJ5VXRmOCA9IGZ1bmN0aW9uIChhcnJheSkge1xuICAgICAgICBpZiAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShhcnJheSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RyID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGFycmF5W2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKHN0cikpO1xuICAgIH07XG5cbiAgICBjb25zdCBnbHRmID0gSlNPTi5wYXJzZShkZWNvZGVCaW5hcnlVdGY4KGdsdGZDaHVuaykpO1xuXG4gICAgLy8gY2hlY2sgZ2x0ZiB2ZXJzaW9uXG4gICAgaWYgKGdsdGYuYXNzZXQgJiYgZ2x0Zi5hc3NldC52ZXJzaW9uICYmIHBhcnNlRmxvYXQoZ2x0Zi5hc3NldC52ZXJzaW9uKSA8IDIpIHtcbiAgICAgICAgY2FsbGJhY2soYEludmFsaWQgZ2x0ZiB2ZXJzaW9uLiBFeHBlY3RlZCB2ZXJzaW9uIDIuMCBvciBhYm92ZSBidXQgZm91bmQgdmVyc2lvbiAnJHtnbHRmLmFzc2V0LnZlcnNpb259Jy5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGNoZWNrIHJlcXVpcmVkIGV4dGVuc2lvbnNcbiAgICBjb25zdCBleHRlbnNpb25zUmVxdWlyZWQgPSBnbHRmPy5leHRlbnNpb25zUmVxdWlyZWQgfHwgW107XG4gICAgaWYgKCFkcmFjb0RlY29kZXJJbnN0YW5jZSAmJiAhZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlKCkgJiYgZXh0ZW5zaW9uc1JlcXVpcmVkLmluZGV4T2YoJ0tIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uJykgIT09IC0xKSB7XG4gICAgICAgIFdhc21Nb2R1bGUuZ2V0SW5zdGFuY2UoJ0RyYWNvRGVjb2Rlck1vZHVsZScsIChpbnN0YW5jZSkgPT4ge1xuICAgICAgICAgICAgZHJhY29EZWNvZGVySW5zdGFuY2UgPSBpbnN0YW5jZTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGdsdGYpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBnbHRmKTtcbiAgICB9XG59O1xuXG4vLyBwYXJzZSBnbGIgZGF0YSwgcmV0dXJucyB0aGUgZ2x0ZiBhbmQgYmluYXJ5IGNodW5rXG5jb25zdCBwYXJzZUdsYiA9IGZ1bmN0aW9uIChnbGJEYXRhLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGRhdGEgPSAoZ2xiRGF0YSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSA/IG5ldyBEYXRhVmlldyhnbGJEYXRhKSA6IG5ldyBEYXRhVmlldyhnbGJEYXRhLmJ1ZmZlciwgZ2xiRGF0YS5ieXRlT2Zmc2V0LCBnbGJEYXRhLmJ5dGVMZW5ndGgpO1xuXG4gICAgLy8gcmVhZCBoZWFkZXJcbiAgICBjb25zdCBtYWdpYyA9IGRhdGEuZ2V0VWludDMyKDAsIHRydWUpO1xuICAgIGNvbnN0IHZlcnNpb24gPSBkYXRhLmdldFVpbnQzMig0LCB0cnVlKTtcbiAgICBjb25zdCBsZW5ndGggPSBkYXRhLmdldFVpbnQzMig4LCB0cnVlKTtcblxuICAgIGlmIChtYWdpYyAhPT0gMHg0NjU0NkM2Nykge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBtYWdpYyBudW1iZXIgZm91bmQgaW4gZ2xiIGhlYWRlci4gRXhwZWN0ZWQgMHg0NjU0NkM2NywgZm91bmQgMHgnICsgbWFnaWMudG9TdHJpbmcoMTYpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh2ZXJzaW9uICE9PSAyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIHZlcnNpb24gbnVtYmVyIGZvdW5kIGluIGdsYiBoZWFkZXIuIEV4cGVjdGVkIDIsIGZvdW5kICcgKyB2ZXJzaW9uKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChsZW5ndGggPD0gMCB8fCBsZW5ndGggPiBkYXRhLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbGVuZ3RoIGZvdW5kIGluIGdsYiBoZWFkZXIuIEZvdW5kICcgKyBsZW5ndGgpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gcmVhZCBjaHVua3NcbiAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICBsZXQgb2Zmc2V0ID0gMTI7XG4gICAgd2hpbGUgKG9mZnNldCA8IGxlbmd0aCkge1xuICAgICAgICBjb25zdCBjaHVua0xlbmd0aCA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCwgdHJ1ZSk7XG4gICAgICAgIGlmIChvZmZzZXQgKyBjaHVua0xlbmd0aCArIDggPiBkYXRhLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjaHVuayBsZW5ndGggZm91bmQgaW4gZ2xiLiBGb3VuZCAnICsgY2h1bmtMZW5ndGgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNodW5rVHlwZSA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCArIDQsIHRydWUpO1xuICAgICAgICBjb25zdCBjaHVua0RhdGEgPSBuZXcgVWludDhBcnJheShkYXRhLmJ1ZmZlciwgZGF0YS5ieXRlT2Zmc2V0ICsgb2Zmc2V0ICsgOCwgY2h1bmtMZW5ndGgpO1xuICAgICAgICBjaHVua3MucHVzaCh7IGxlbmd0aDogY2h1bmtMZW5ndGgsIHR5cGU6IGNodW5rVHlwZSwgZGF0YTogY2h1bmtEYXRhIH0pO1xuICAgICAgICBvZmZzZXQgKz0gY2h1bmtMZW5ndGggKyA4O1xuICAgIH1cblxuICAgIGlmIChjaHVua3MubGVuZ3RoICE9PSAxICYmIGNodW5rcy5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbnVtYmVyIG9mIGNodW5rcyBmb3VuZCBpbiBnbGIgZmlsZS4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaHVua3NbMF0udHlwZSAhPT0gMHg0RTRGNTM0QSkge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBjaHVuayB0eXBlIGZvdW5kIGluIGdsYiBmaWxlLiBFeHBlY3RlZCAweDRFNEY1MzRBLCBmb3VuZCAweCcgKyBjaHVua3NbMF0udHlwZS50b1N0cmluZygxNikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNodW5rcy5sZW5ndGggPiAxICYmIGNodW5rc1sxXS50eXBlICE9PSAweDAwNEU0OTQyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGNodW5rIHR5cGUgZm91bmQgaW4gZ2xiIGZpbGUuIEV4cGVjdGVkIDB4MDA0RTQ5NDIsIGZvdW5kIDB4JyArIGNodW5rc1sxXS50eXBlLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgIGdsdGZDaHVuazogY2h1bmtzWzBdLmRhdGEsXG4gICAgICAgIGJpbmFyeUNodW5rOiBjaHVua3MubGVuZ3RoID09PSAyID8gY2h1bmtzWzFdLmRhdGEgOiBudWxsXG4gICAgfSk7XG59O1xuXG4vLyBwYXJzZSB0aGUgY2h1bmsgb2YgZGF0YSwgd2hpY2ggY2FuIGJlIGdsYiBvciBnbHRmXG5jb25zdCBwYXJzZUNodW5rID0gZnVuY3Rpb24gKGZpbGVuYW1lLCBkYXRhLCBjYWxsYmFjaykge1xuICAgIGlmIChmaWxlbmFtZSAmJiBmaWxlbmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcuZ2xiJykpIHtcbiAgICAgICAgcGFyc2VHbGIoZGF0YSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgICAgIGdsdGZDaHVuazogZGF0YSxcbiAgICAgICAgICAgIGJpbmFyeUNodW5rOiBudWxsXG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8vIGNyZWF0ZSBidWZmZXIgdmlld3NcbmNvbnN0IHBhcnNlQnVmZmVyVmlld3NBc3luYyA9IGZ1bmN0aW9uIChnbHRmLCBidWZmZXJzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcgJiYgb3B0aW9ucy5idWZmZXJWaWV3LnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmQnVmZmVyVmlldywgYnVmZmVycywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wb3N0cHJvY2VzcztcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLmJ1ZmZlclZpZXdzID8gZ2x0Zi5idWZmZXJWaWV3cy5sZW5ndGggOiAwO1xuXG4gICAgLy8gaGFuZGxlIGNhc2Ugb2Ygbm8gYnVmZmVyc1xuICAgIGlmICghcmVtYWluaW5nKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKGluZGV4LCBidWZmZXJWaWV3KSB7XG4gICAgICAgIGNvbnN0IGdsdGZCdWZmZXJWaWV3ID0gZ2x0Zi5idWZmZXJWaWV3c1tpbmRleF07XG4gICAgICAgIGlmIChnbHRmQnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpKSB7XG4gICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVTdHJpZGUgPSBnbHRmQnVmZmVyVmlldy5ieXRlU3RyaWRlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IGJ1ZmZlclZpZXc7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkJ1ZmZlclZpZXcsIGJ1ZmZlclZpZXcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlclZpZXcgPSBnbHRmLmJ1ZmZlclZpZXdzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXJWaWV3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyVmlldywgYnVmZmVycywgZnVuY3Rpb24gKGksIGdsdGZCdWZmZXJWaWV3LCBlcnIsIHJlc3VsdCkgeyAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWxvb3AtZnVuY1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCByZXN1bHQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBidWZmZXJzW2dsdGZCdWZmZXJWaWV3LmJ1ZmZlcl07XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlci5idWZmZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5ieXRlT2Zmc2V0ICsgKGdsdGZCdWZmZXJWaWV3LmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZCdWZmZXJWaWV3LmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCB0eXBlZEFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKG51bGwsIGksIGdsdGZCdWZmZXJWaWV3KSk7XG4gICAgfVxufTtcblxuLy8gLS0gR2xiUGFyc2VyXG5jbGFzcyBHbGJQYXJzZXIge1xuICAgIC8vIHBhcnNlIHRoZSBnbHRmIG9yIGdsYiBkYXRhIGFzeW5jaHJvbm91c2x5LCBsb2FkaW5nIGV4dGVybmFsIHJlc291cmNlc1xuICAgIHN0YXRpYyBwYXJzZUFzeW5jKGZpbGVuYW1lLCB1cmxCYXNlLCBkYXRhLCBkZXZpY2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICAvLyBwYXJzZSB0aGUgZGF0YVxuICAgICAgICBwYXJzZUNodW5rKGZpbGVuYW1lLCBkYXRhLCBmdW5jdGlvbiAoZXJyLCBjaHVua3MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcGFyc2UgZ2x0ZlxuICAgICAgICAgICAgcGFyc2VHbHRmKGNodW5rcy5nbHRmQ2h1bmssIGZ1bmN0aW9uIChlcnIsIGdsdGYpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBhc3luYyBsb2FkIGV4dGVybmFsIGJ1ZmZlcnNcbiAgICAgICAgICAgICAgICBsb2FkQnVmZmVyc0FzeW5jKGdsdGYsIGNodW5rcy5iaW5hcnlDaHVuaywgdXJsQmFzZSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgYnVmZmVycykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXN5bmMgbG9hZCBidWZmZXIgdmlld3NcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VCdWZmZXJWaWV3c0FzeW5jKGdsdGYsIGJ1ZmZlcnMsIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlclZpZXdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzeW5jIGxvYWQgaW1hZ2VzXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZXNBc3luYyhnbHRmLCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHRleHR1cmVBc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVSZXNvdXJjZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZUFzc2V0cywgb3B0aW9ucywgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHBhcnNlIHRoZSBnbHRmIG9yIGdsYiBkYXRhIHN5bmNocm9ub3VzbHkuIGV4dGVybmFsIHJlc291cmNlcyAoYnVmZmVycyBhbmQgaW1hZ2VzKSBhcmUgaWdub3JlZC5cbiAgICBzdGF0aWMgcGFyc2UoZmlsZW5hbWUsIGRhdGEsIGRldmljZSwgb3B0aW9ucykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gbnVsbDtcblxuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7IH07XG5cbiAgICAgICAgLy8gcGFyc2UgdGhlIGRhdGFcbiAgICAgICAgcGFyc2VDaHVuayhmaWxlbmFtZSwgZGF0YSwgZnVuY3Rpb24gKGVyciwgY2h1bmtzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJzZSBnbHRmXG4gICAgICAgICAgICAgICAgcGFyc2VHbHRmKGNodW5rcy5nbHRmQ2h1bmssIGZ1bmN0aW9uIChlcnIsIGdsdGYpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGFyc2UgYnVmZmVyIHZpZXdzXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZUJ1ZmZlclZpZXdzQXN5bmMoZ2x0ZiwgW2NodW5rcy5iaW5hcnlDaHVua10sIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlclZpZXdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIHJlc291cmNlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVSZXNvdXJjZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgW10sIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHJlc3VsdF8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdF87XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBhc3NldHMsIG1heFJldHJpZXMpIHtcbiAgICAgICAgdGhpcy5fZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLl9hc3NldHMgPSBhc3NldHM7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRNYXRlcmlhbCA9IGNyZWF0ZU1hdGVyaWFsKHtcbiAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0R2xiTWF0ZXJpYWwnXG4gICAgICAgIH0sIFtdKTtcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gbWF4UmV0cmllcztcbiAgICB9XG5cbiAgICBfZ2V0VXJsV2l0aG91dFBhcmFtcyh1cmwpIHtcbiAgICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPj0gMCA/IHVybC5zcGxpdCgnPycpWzBdIDogdXJsO1xuICAgIH1cblxuICAgIGxvYWQodXJsLCBjYWxsYmFjaywgYXNzZXQpIHtcbiAgICAgICAgQXNzZXQuZmV0Y2hBcnJheUJ1ZmZlcih1cmwubG9hZCwgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgR2xiUGFyc2VyLnBhcnNlQXN5bmMoXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dldFVybFdpdGhvdXRQYXJhbXModXJsLm9yaWdpbmFsKSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aC5leHRyYWN0UGF0aCh1cmwubG9hZCksXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGV2aWNlLFxuICAgICAgICAgICAgICAgICAgICBhc3NldC5yZWdpc3RyeSxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQub3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmV0dXJuIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBuZXcgR2xiQ29udGFpbmVyUmVzb3VyY2UocmVzdWx0LCBhc3NldCwgdGhpcy5fYXNzZXRzLCB0aGlzLl9kZWZhdWx0TWF0ZXJpYWwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGFzc2V0LCB0aGlzLm1heFJldHJpZXMpO1xuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhLCBhc3NldCkge1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG5cbiAgICBwYXRjaChhc3NldCwgYXNzZXRzKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCB7IEdsYlBhcnNlciB9O1xuIl0sIm5hbWVzIjpbImRyYWNvRGVjb2Rlckluc3RhbmNlIiwiZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlIiwid2luZG93IiwiRHJhY29EZWNvZGVyTW9kdWxlIiwiR2xiUmVzb3VyY2VzIiwiY29uc3RydWN0b3IiLCJnbHRmIiwibm9kZXMiLCJzY2VuZXMiLCJhbmltYXRpb25zIiwidGV4dHVyZXMiLCJtYXRlcmlhbHMiLCJ2YXJpYW50cyIsIm1lc2hWYXJpYW50cyIsIm1lc2hEZWZhdWx0TWF0ZXJpYWxzIiwicmVuZGVycyIsInNraW5zIiwibGlnaHRzIiwiY2FtZXJhcyIsImRlc3Ryb3kiLCJmb3JFYWNoIiwicmVuZGVyIiwibWVzaGVzIiwiaXNEYXRhVVJJIiwidXJpIiwidGVzdCIsImdldERhdGFVUklNaW1lVHlwZSIsInN1YnN0cmluZyIsImluZGV4T2YiLCJnZXROdW1Db21wb25lbnRzIiwiYWNjZXNzb3JUeXBlIiwiZ2V0Q29tcG9uZW50VHlwZSIsImNvbXBvbmVudFR5cGUiLCJUWVBFX0lOVDgiLCJUWVBFX1VJTlQ4IiwiVFlQRV9JTlQxNiIsIlRZUEVfVUlOVDE2IiwiVFlQRV9JTlQzMiIsIlRZUEVfVUlOVDMyIiwiVFlQRV9GTE9BVDMyIiwiZ2V0Q29tcG9uZW50U2l6ZUluQnl0ZXMiLCJnZXRDb21wb25lbnREYXRhVHlwZSIsIkludDhBcnJheSIsIlVpbnQ4QXJyYXkiLCJJbnQxNkFycmF5IiwiVWludDE2QXJyYXkiLCJJbnQzMkFycmF5IiwiVWludDMyQXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJnbHRmVG9FbmdpbmVTZW1hbnRpY01hcCIsIlNFTUFOVElDX1BPU0lUSU9OIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEFOR0VOVCIsIlNFTUFOVElDX0NPTE9SIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJTRU1BTlRJQ19URVhDT09SRDAiLCJTRU1BTlRJQ19URVhDT09SRDEiLCJTRU1BTlRJQ19URVhDT09SRDIiLCJTRU1BTlRJQ19URVhDT09SRDMiLCJTRU1BTlRJQ19URVhDT09SRDQiLCJTRU1BTlRJQ19URVhDT09SRDUiLCJTRU1BTlRJQ19URVhDT09SRDYiLCJTRU1BTlRJQ19URVhDT09SRDciLCJnZXREZXF1YW50aXplRnVuYyIsInNyY1R5cGUiLCJ4IiwiTWF0aCIsIm1heCIsImRlcXVhbnRpemVBcnJheSIsImRzdEFycmF5Iiwic3JjQXJyYXkiLCJjb252RnVuYyIsImxlbiIsImxlbmd0aCIsImkiLCJnZXRBY2Nlc3NvckRhdGEiLCJnbHRmQWNjZXNzb3IiLCJidWZmZXJWaWV3cyIsImZsYXR0ZW4iLCJudW1Db21wb25lbnRzIiwidHlwZSIsImRhdGFUeXBlIiwiYnVmZmVyVmlldyIsInJlc3VsdCIsInNwYXJzZSIsImluZGljZXNBY2Nlc3NvciIsImNvdW50IiwiaW5kaWNlcyIsIk9iamVjdCIsImFzc2lnbiIsInZhbHVlc0FjY2Vzc29yIiwic2NhbGFyIiwidmFsdWVzIiwiaGFzT3duUHJvcGVydHkiLCJiYXNlQWNjZXNzb3IiLCJieXRlT2Zmc2V0Iiwic2xpY2UiLCJ0YXJnZXRJbmRleCIsImoiLCJieXRlc1BlckVsZW1lbnQiLCJCWVRFU19QRVJfRUxFTUVOVCIsInN0b3JhZ2UiLCJBcnJheUJ1ZmZlciIsInRtcEFycmF5IiwiZHN0T2Zmc2V0Iiwic3JjT2Zmc2V0IiwiYnl0ZVN0cmlkZSIsImIiLCJidWZmZXIiLCJnZXRBY2Nlc3NvckRhdGFGbG9hdDMyIiwiZGF0YSIsIm5vcm1hbGl6ZWQiLCJmbG9hdDMyRGF0YSIsImdldEFjY2Vzc29yQm91bmRpbmdCb3giLCJtaW4iLCJjdHlwZSIsIkJvdW5kaW5nQm94IiwiVmVjMyIsImdldFByaW1pdGl2ZVR5cGUiLCJwcmltaXRpdmUiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwibW9kZSIsIlBSSU1JVElWRV9QT0lOVFMiLCJQUklNSVRJVkVfTElORVMiLCJQUklNSVRJVkVfTElORUxPT1AiLCJQUklNSVRJVkVfTElORVNUUklQIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiUFJJTUlUSVZFX1RSSUZBTiIsImdlbmVyYXRlSW5kaWNlcyIsIm51bVZlcnRpY2VzIiwiZHVtbXlJbmRpY2VzIiwiZ2VuZXJhdGVOb3JtYWxzIiwic291cmNlRGVzYyIsInAiLCJjb21wb25lbnRzIiwicG9zaXRpb25zIiwic2l6ZSIsInN0cmlkZSIsInNyY1N0cmlkZSIsInR5cGVkQXJyYXlUeXBlc0J5dGVTaXplIiwic3JjIiwidHlwZWRBcnJheVR5cGVzIiwib2Zmc2V0Iiwibm9ybWFsc1RlbXAiLCJjYWxjdWxhdGVOb3JtYWxzIiwibm9ybWFscyIsInNldCIsImZsaXBUZXhDb29yZFZzIiwidmVydGV4QnVmZmVyIiwiZmxvYXRPZmZzZXRzIiwic2hvcnRPZmZzZXRzIiwiYnl0ZU9mZnNldHMiLCJmb3JtYXQiLCJlbGVtZW50cyIsImVsZW1lbnQiLCJuYW1lIiwicHVzaCIsImZsaXAiLCJvZmZzZXRzIiwib25lIiwidHlwZWRBcnJheSIsImluZGV4IiwiY2xvbmVUZXh0dXJlIiwidGV4dHVyZSIsInNoYWxsb3dDb3B5TGV2ZWxzIiwibWlwIiwiX2xldmVscyIsImxldmVsIiwiY3ViZW1hcCIsImZhY2UiLCJUZXh0dXJlIiwiZGV2aWNlIiwiY2xvbmVUZXh0dXJlQXNzZXQiLCJBc3NldCIsImZpbGUiLCJvcHRpb25zIiwibG9hZGVkIiwicmVzb3VyY2UiLCJyZWdpc3RyeSIsImFkZCIsImNyZWF0ZVZlcnRleEJ1ZmZlckludGVybmFsIiwiZmxpcFYiLCJwb3NpdGlvbkRlc2MiLCJ2ZXJ0ZXhEZXNjIiwic2VtYW50aWMiLCJub3JtYWxpemUiLCJlbGVtZW50T3JkZXIiLCJzb3J0IiwibGhzIiwicmhzIiwibGhzT3JkZXIiLCJyaHNPcmRlciIsImsiLCJzb3VyY2UiLCJ0YXJnZXQiLCJzb3VyY2VPZmZzZXQiLCJ2ZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhGb3JtYXQiLCJpc0NvcnJlY3RseUludGVybGVhdmVkIiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX1NUQVRJQyIsInZlcnRleERhdGEiLCJsb2NrIiwidGFyZ2V0QXJyYXkiLCJzb3VyY2VBcnJheSIsInRhcmdldFN0cmlkZSIsInNvdXJjZVN0cmlkZSIsImRzdCIsImtlbmQiLCJmbG9vciIsInVubG9jayIsImNyZWF0ZVZlcnRleEJ1ZmZlciIsImF0dHJpYnV0ZXMiLCJhY2Nlc3NvcnMiLCJ2ZXJ0ZXhCdWZmZXJEaWN0IiwidXNlQXR0cmlidXRlcyIsImF0dHJpYklkcyIsImF0dHJpYiIsInZiS2V5Iiwiam9pbiIsInZiIiwiYWNjZXNzb3IiLCJhY2Nlc3NvckRhdGEiLCJjcmVhdGVWZXJ0ZXhCdWZmZXJEcmFjbyIsIm91dHB1dEdlb21ldHJ5IiwiZXh0RHJhY28iLCJkZWNvZGVyIiwiZGVjb2Rlck1vZHVsZSIsIm51bVBvaW50cyIsIm51bV9wb2ludHMiLCJleHRyYWN0RHJhY29BdHRyaWJ1dGVJbmZvIiwidW5pcXVlSWQiLCJhdHRyaWJ1dGUiLCJHZXRBdHRyaWJ1dGVCeVVuaXF1ZUlkIiwibnVtVmFsdWVzIiwibnVtX2NvbXBvbmVudHMiLCJkcmFjb0Zvcm1hdCIsImRhdGFfdHlwZSIsInB0ciIsImNvbXBvbmVudFNpemVJbkJ5dGVzIiwic3RvcmFnZVR5cGUiLCJEVF9VSU5UOCIsIl9tYWxsb2MiLCJHZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMiLCJIRUFQVTgiLCJEVF9VSU5UMTYiLCJIRUFQVTE2IiwiRFRfRkxPQVQzMiIsIkhFQVBGMzIiLCJfZnJlZSIsImF0dHJpYnV0ZUluZm8iLCJjcmVhdGVTa2luIiwiZ2x0ZlNraW4iLCJnbGJTa2lucyIsImJpbmRNYXRyaXgiLCJqb2ludHMiLCJudW1Kb2ludHMiLCJpYnAiLCJpbnZlcnNlQmluZE1hdHJpY2VzIiwiaWJtRGF0YSIsImlibVZhbHVlcyIsIk1hdDQiLCJib25lTmFtZXMiLCJrZXkiLCJza2luIiwiZ2V0IiwiU2tpbiIsInRlbXBNYXQiLCJ0ZW1wVmVjIiwiY3JlYXRlTWVzaCIsImdsdGZNZXNoIiwiY2FsbGJhY2siLCJhc3NldE9wdGlvbnMiLCJwcmltaXRpdmVzIiwicHJpbWl0aXZlVHlwZSIsIm51bUluZGljZXMiLCJjYW5Vc2VNb3JwaCIsImV4dGVuc2lvbnMiLCJLSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbiIsInVpbnQ4QnVmZmVyIiwiRGVjb2RlckJ1ZmZlciIsIkluaXQiLCJEZWNvZGVyIiwiZ2VvbWV0cnlUeXBlIiwiR2V0RW5jb2RlZEdlb21ldHJ5VHlwZSIsInN0YXR1cyIsIlBPSU5UX0NMT1VEIiwiUG9pbnRDbG91ZCIsIkRlY29kZUJ1ZmZlclRvUG9pbnRDbG91ZCIsIlRSSUFOR1VMQVJfTUVTSCIsIk1lc2giLCJEZWNvZGVCdWZmZXJUb01lc2giLCJJTlZBTElEX0dFT01FVFJZX1RZUEUiLCJvayIsImVycm9yX21zZyIsIm51bUZhY2VzIiwibnVtX2ZhY2VzIiwiYml0MzIiLCJkYXRhU2l6ZSIsIkdldFRyaWFuZ2xlc1VJbnQzMkFycmF5IiwiSEVBUFUzMiIsIkdldFRyaWFuZ2xlc1VJbnQxNkFycmF5IiwiRGVidWciLCJ3YXJuIiwibWVzaCIsImJhc2UiLCJpbmRleGVkIiwiaW5kZXhGb3JtYXQiLCJJTkRFWEZPUk1BVF9VSU5UOCIsIklOREVYRk9STUFUX1VJTlQxNiIsIklOREVYRk9STUFUX1VJTlQzMiIsImV4dFVpbnRFbGVtZW50IiwiY29uc29sZSIsImluZGV4QnVmZmVyIiwiSW5kZXhCdWZmZXIiLCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzIiwidGVtcE1hcHBpbmciLCJtYXBwaW5ncyIsIm1hcHBpbmciLCJ2YXJpYW50IiwibWF0ZXJpYWwiLCJpZCIsIlBPU0lUSU9OIiwiYWFiYiIsInRhcmdldHMiLCJkZWx0YVBvc2l0aW9ucyIsImRlbHRhUG9zaXRpb25zVHlwZSIsIk5PUk1BTCIsImRlbHRhTm9ybWFscyIsImRlbHRhTm9ybWFsc1R5cGUiLCJleHRyYXMiLCJ0YXJnZXROYW1lcyIsInRvU3RyaW5nIiwiZGVmYXVsdFdlaWdodCIsIndlaWdodHMiLCJwcmVzZXJ2ZURhdGEiLCJtb3JwaFByZXNlcnZlRGF0YSIsIk1vcnBoVGFyZ2V0IiwibW9ycGgiLCJNb3JwaCIsImV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtIiwibWFwcyIsIm1hcCIsInRleENvb3JkIiwiemVyb3MiLCJvbmVzIiwidGV4dHVyZVRyYW5zZm9ybSIsIktIUl90ZXh0dXJlX3RyYW5zZm9ybSIsInNjYWxlIiwicm90YXRpb24iLCJtYXRoIiwiUkFEX1RPX0RFRyIsInRpbGluZ1ZlYyIsIlZlYzIiLCJvZmZzZXRWZWMiLCJleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyIsImNvbG9yIiwiZGlmZnVzZUZhY3RvciIsImRpZmZ1c2UiLCJwb3ciLCJvcGFjaXR5IiwiZGlmZnVzZVRleHR1cmUiLCJkaWZmdXNlTWFwIiwiZGlmZnVzZU1hcENoYW5uZWwiLCJvcGFjaXR5TWFwIiwib3BhY2l0eU1hcENoYW5uZWwiLCJ1c2VNZXRhbG5lc3MiLCJzcGVjdWxhckZhY3RvciIsInNwZWN1bGFyIiwic2hpbmluZXNzIiwiZ2xvc3NpbmVzc0ZhY3RvciIsInNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUiLCJzcGVjdWxhckVuY29kaW5nIiwic3BlY3VsYXJNYXAiLCJnbG9zc01hcCIsInNwZWN1bGFyTWFwQ2hhbm5lbCIsImdsb3NzTWFwQ2hhbm5lbCIsImV4dGVuc2lvbkNsZWFyQ29hdCIsImNsZWFyQ29hdCIsImNsZWFyY29hdEZhY3RvciIsImNsZWFyY29hdFRleHR1cmUiLCJjbGVhckNvYXRNYXAiLCJjbGVhckNvYXRNYXBDaGFubmVsIiwiY2xlYXJDb2F0R2xvc3NpbmVzcyIsImNsZWFyY29hdFJvdWdobmVzc0ZhY3RvciIsImNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUiLCJjbGVhckNvYXRHbG9zc01hcCIsImNsZWFyQ29hdEdsb3NzTWFwQ2hhbm5lbCIsImNsZWFyY29hdE5vcm1hbFRleHR1cmUiLCJjbGVhckNvYXROb3JtYWxNYXAiLCJjbGVhckNvYXRCdW1waW5lc3MiLCJjbGVhckNvYXRHbG9zc0NodW5rIiwiY2h1bmtzIiwiY2xlYXJDb2F0R2xvc3NQUyIsImV4dGVuc2lvblVubGl0IiwidXNlTGlnaHRpbmciLCJlbWlzc2l2ZSIsImNvcHkiLCJlbWlzc2l2ZVRpbnQiLCJkaWZmdXNlVGludCIsImVtaXNzaXZlTWFwIiwiZW1pc3NpdmVNYXBVdiIsImRpZmZ1c2VNYXBVdiIsImVtaXNzaXZlTWFwVGlsaW5nIiwiZGlmZnVzZU1hcFRpbGluZyIsImVtaXNzaXZlTWFwT2Zmc2V0IiwiZGlmZnVzZU1hcE9mZnNldCIsImVtaXNzaXZlTWFwUm90YXRpb24iLCJkaWZmdXNlTWFwUm90YXRpb24iLCJlbWlzc2l2ZU1hcENoYW5uZWwiLCJlbWlzc2l2ZVZlcnRleENvbG9yIiwiZGlmZnVzZVZlcnRleENvbG9yIiwiZW1pc3NpdmVWZXJ0ZXhDb2xvckNoYW5uZWwiLCJkaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsIiwiZXh0ZW5zaW9uU3BlY3VsYXIiLCJ1c2VNZXRhbG5lc3NTcGVjdWxhckNvbG9yIiwic3BlY3VsYXJDb2xvclRleHR1cmUiLCJzcGVjdWxhckNvbG9yRmFjdG9yIiwic3BlY3VsYXJpdHlGYWN0b3IiLCJzcGVjdWxhcml0eUZhY3Rvck1hcENoYW5uZWwiLCJzcGVjdWxhcml0eUZhY3Rvck1hcCIsInNwZWN1bGFyVGV4dHVyZSIsImV4dGVuc2lvbklvciIsInJlZnJhY3Rpb25JbmRleCIsImlvciIsImV4dGVuc2lvblRyYW5zbWlzc2lvbiIsImJsZW5kVHlwZSIsIkJMRU5EX05PUk1BTCIsInVzZUR5bmFtaWNSZWZyYWN0aW9uIiwicmVmcmFjdGlvbiIsInRyYW5zbWlzc2lvbkZhY3RvciIsInJlZnJhY3Rpb25NYXBDaGFubmVsIiwicmVmcmFjdGlvbk1hcCIsInRyYW5zbWlzc2lvblRleHR1cmUiLCJleHRlbnNpb25TaGVlbiIsInVzZVNoZWVuIiwic2hlZW5Db2xvckZhY3RvciIsInNoZWVuIiwic2hlZW5NYXAiLCJzaGVlbkNvbG9yVGV4dHVyZSIsInNoZWVuRW5jb2RpbmciLCJzaGVlbkdsb3NzaW5lc3MiLCJzaGVlblJvdWdobmVzc0ZhY3RvciIsInNoZWVuR2xvc3NpbmVzc01hcCIsInNoZWVuUm91Z2huZXNzVGV4dHVyZSIsInNoZWVuR2xvc3NpbmVzc01hcENoYW5uZWwiLCJzaGVlbkdsb3NzQ2h1bmsiLCJzaGVlbkdsb3NzUFMiLCJleHRlbnNpb25Wb2x1bWUiLCJ0aGlja25lc3MiLCJ0aGlja25lc3NGYWN0b3IiLCJ0aGlja25lc3NNYXAiLCJ0aGlja25lc3NUZXh0dXJlIiwiYXR0ZW51YXRpb25EaXN0YW5jZSIsImF0dGVudWF0aW9uQ29sb3IiLCJhdHRlbnVhdGlvbiIsImV4dGVuc2lvbkVtaXNzaXZlU3RyZW5ndGgiLCJlbWlzc2l2ZUludGVuc2l0eSIsImVtaXNzaXZlU3RyZW5ndGgiLCJleHRlbnNpb25JcmlkZXNjZW5jZSIsInVzZUlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2UiLCJpcmlkZXNjZW5jZUZhY3RvciIsImlyaWRlc2NlbmNlTWFwQ2hhbm5lbCIsImlyaWRlc2NlbmNlTWFwIiwiaXJpZGVzY2VuY2VUZXh0dXJlIiwiaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXgiLCJpcmlkZXNjZW5jZUlvciIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXgiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW0iLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01hcENoYW5uZWwiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01hcCIsImlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZSIsImNyZWF0ZU1hdGVyaWFsIiwiZ2x0Zk1hdGVyaWFsIiwiZ2xvc3NDaHVuayIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJvY2NsdWRlU3BlY3VsYXIiLCJTUEVDT0NDX0FPIiwic3BlY3VsYXJUaW50Iiwic3BlY3VsYXJWZXJ0ZXhDb2xvciIsIkFQSVZlcnNpb24iLCJDSFVOS0FQSV8xXzU3IiwicGJyRGF0YSIsInBick1ldGFsbGljUm91Z2huZXNzIiwiYmFzZUNvbG9yRmFjdG9yIiwiYmFzZUNvbG9yVGV4dHVyZSIsIm1ldGFsbmVzcyIsIm1ldGFsbGljRmFjdG9yIiwicm91Z2huZXNzRmFjdG9yIiwibWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlIiwibWV0YWxuZXNzTWFwIiwibWV0YWxuZXNzTWFwQ2hhbm5lbCIsImdsb3NzUFMiLCJub3JtYWxUZXh0dXJlIiwibm9ybWFsTWFwIiwiYnVtcGluZXNzIiwib2NjbHVzaW9uVGV4dHVyZSIsImFvTWFwIiwiYW9NYXBDaGFubmVsIiwiZW1pc3NpdmVGYWN0b3IiLCJlbWlzc2l2ZVRleHR1cmUiLCJhbHBoYU1vZGUiLCJCTEVORF9OT05FIiwiYWxwaGFUZXN0IiwiYWxwaGFDdXRvZmYiLCJkZXB0aFdyaXRlIiwidHdvU2lkZWRMaWdodGluZyIsImRvdWJsZVNpZGVkIiwiY3VsbCIsIkNVTExGQUNFX05PTkUiLCJDVUxMRkFDRV9CQUNLIiwiZXh0ZW5zaW9uRnVuYyIsInVuZGVmaW5lZCIsInVwZGF0ZSIsImNyZWF0ZUFuaW1hdGlvbiIsImdsdGZBbmltYXRpb24iLCJhbmltYXRpb25JbmRleCIsImdsdGZBY2Nlc3NvcnMiLCJjcmVhdGVBbmltRGF0YSIsIkFuaW1EYXRhIiwiaW50ZXJwTWFwIiwiSU5URVJQT0xBVElPTl9TVEVQIiwiSU5URVJQT0xBVElPTl9MSU5FQVIiLCJJTlRFUlBPTEFUSU9OX0NVQklDIiwiaW5wdXRNYXAiLCJvdXRwdXRNYXAiLCJjdXJ2ZU1hcCIsIm91dHB1dENvdW50ZXIiLCJzYW1wbGVycyIsInNhbXBsZXIiLCJpbnB1dCIsIm91dHB1dCIsImludGVycG9sYXRpb24iLCJjdXJ2ZSIsInBhdGhzIiwicXVhdEFycmF5cyIsInRyYW5zZm9ybVNjaGVtYSIsImNvbnN0cnVjdE5vZGVQYXRoIiwibm9kZSIsInBhdGgiLCJ1bnNoaWZ0IiwicGFyZW50IiwicmV0cmlldmVXZWlnaHROYW1lIiwibm9kZU5hbWUiLCJ3ZWlnaHRJbmRleCIsImNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzIiwiZW50aXR5UGF0aCIsIm1vcnBoVGFyZ2V0Q291bnQiLCJrZXlmcmFtZUNvdW50IiwibW9ycGhUYXJnZXRPdXRwdXQiLCJtb3JwaEN1cnZlIiwiY29tcG9uZW50IiwicHJvcGVydHlQYXRoIiwiY2hhbm5lbHMiLCJjaGFubmVsIiwic3RhcnRzV2l0aCIsImlucHV0cyIsIm91dHB1dHMiLCJjdXJ2ZXMiLCJpbnB1dEtleSIsIm91dHB1dEtleSIsImN1cnZlS2V5IiwiY3VydmVEYXRhIiwiQW5pbUN1cnZlIiwicHJldkluZGV4IiwiZCIsImRwIiwiZHVyYXRpb24iLCJfZGF0YSIsIkFuaW1UcmFjayIsImNyZWF0ZU5vZGUiLCJnbHRmTm9kZSIsIm5vZGVJbmRleCIsImVudGl0eSIsIkdyYXBoTm9kZSIsIm1hdHJpeCIsImdldFRyYW5zbGF0aW9uIiwic2V0TG9jYWxQb3NpdGlvbiIsImdldEV1bGVyQW5nbGVzIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsImdldFNjYWxlIiwic2V0TG9jYWxTY2FsZSIsInIiLCJzZXRMb2NhbFJvdGF0aW9uIiwidCIsInRyYW5zbGF0aW9uIiwicyIsImNyZWF0ZUNhbWVyYSIsImdsdGZDYW1lcmEiLCJwcm9qZWN0aW9uIiwiUFJPSkVDVElPTl9PUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiZ2x0ZlByb3BlcnRpZXMiLCJvcnRob2dyYXBoaWMiLCJwZXJzcGVjdGl2ZSIsImNvbXBvbmVudERhdGEiLCJlbmFibGVkIiwibmVhckNsaXAiLCJ6bmVhciIsImFzcGVjdFJhdGlvTW9kZSIsIkFTUEVDVF9BVVRPIiwiemZhciIsImZhckNsaXAiLCJvcnRob0hlaWdodCIsInltYWciLCJBU1BFQ1RfTUFOVUFMIiwiYXNwZWN0UmF0aW8iLCJ4bWFnIiwiZm92IiwieWZvdiIsImNhbWVyYUVudGl0eSIsIkVudGl0eSIsImFkZENvbXBvbmVudCIsImNyZWF0ZUxpZ2h0IiwiZ2x0ZkxpZ2h0IiwibGlnaHRQcm9wcyIsIkNvbG9yIiwiV0hJVEUiLCJyYW5nZSIsImZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVEIiwiaW50ZW5zaXR5IiwiY2xhbXAiLCJpbm5lckNvbmVBbmdsZSIsInNwb3QiLCJvdXRlckNvbmVBbmdsZSIsIlBJIiwibGlnaHRFbnRpdHkiLCJyb3RhdGVMb2NhbCIsImNyZWF0ZVNraW5zIiwiTWFwIiwiY3JlYXRlTWVzaGVzIiwiY3JlYXRlTWF0ZXJpYWxzIiwicHJlcHJvY2VzcyIsInByb2Nlc3MiLCJwb3N0cHJvY2VzcyIsImNyZWF0ZVZhcmlhbnRzIiwiY3JlYXRlQW5pbWF0aW9ucyIsImFuaW1hdGlvbiIsImNyZWF0ZU5vZGVzIiwidW5pcXVlTmFtZXMiLCJjaGlsZHJlbiIsImNoaWxkIiwiYWRkQ2hpbGQiLCJjcmVhdGVTY2VuZXMiLCJzY2VuZSIsInNjZW5lUm9vdCIsIm4iLCJjaGlsZE5vZGUiLCJjcmVhdGVDYW1lcmFzIiwiY2FtZXJhIiwiY3JlYXRlTGlnaHRzIiwiS0hSX2xpZ2h0c19wdW5jdHVhbCIsImdsdGZMaWdodHMiLCJsaWdodCIsImxpZ2h0SW5kZXgiLCJsaW5rU2tpbnMiLCJtZXNoR3JvdXAiLCJjcmVhdGVSZXNvdXJjZXMiLCJ0ZXh0dXJlQXNzZXRzIiwiZ2xvYmFsIiwiYXNzZXQiLCJnZW5lcmF0b3IiLCJ0ZXh0dXJlQXNzZXQiLCJSZW5kZXIiLCJhcHBseVNhbXBsZXIiLCJnbHRmU2FtcGxlciIsImdldEZpbHRlciIsImZpbHRlciIsImRlZmF1bHRWYWx1ZSIsIkZJTFRFUl9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUiIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJnZXRXcmFwIiwid3JhcCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiQUREUkVTU19SRVBFQVQiLCJtaW5GaWx0ZXIiLCJtYWdGaWx0ZXIiLCJhZGRyZXNzVSIsIndyYXBTIiwiYWRkcmVzc1YiLCJ3cmFwVCIsImdsdGZUZXh0dXJlVW5pcXVlSWQiLCJsb2FkSW1hZ2VBc3luYyIsImdsdGZJbWFnZSIsInVybEJhc2UiLCJpbWFnZSIsInByb2Nlc3NBc3luYyIsIm9uTG9hZCIsIm1pbWVUeXBlRmlsZUV4dGVuc2lvbnMiLCJsb2FkVGV4dHVyZSIsInVybCIsIm1pbWVUeXBlIiwiY29udGVudHMiLCJleHRlbnNpb24iLCJmaWxlbmFtZSIsIm9uIiwibG9hZCIsImVyciIsImNyb3NzT3JpZ2luIiwibG9hZFRleHR1cmVzQXN5bmMiLCJpbWFnZXMiLCJnbHRmVGV4dHVyZSIsImdsdGZJbWFnZXMiLCJhc3NldHMiLCJyZW1haW5pbmciLCJ0ZXh0dXJlSW5kZXgiLCJpbWFnZUluZGV4IiwidGV4dHVyZUxpc3QiLCJnbHRmSW1hZ2VJbmRleCIsIktIUl90ZXh0dXJlX2Jhc2lzdSIsImJpbmQiLCJsb2FkQnVmZmVyc0FzeW5jIiwiYmluYXJ5Q2h1bmsiLCJidWZmZXJzIiwiZ2x0ZkJ1ZmZlciIsImFycmF5QnVmZmVyIiwiYnl0ZVN0cmluZyIsImF0b2IiLCJzcGxpdCIsImJpbmFyeUFycmF5IiwiY2hhckNvZGVBdCIsImh0dHAiLCJjYWNoZSIsInJlc3BvbnNlVHlwZSIsInJldHJ5IiwicGFyc2VHbHRmIiwiZ2x0ZkNodW5rIiwiZGVjb2RlQmluYXJ5VXRmOCIsImFycmF5IiwiVGV4dERlY29kZXIiLCJkZWNvZGUiLCJzdHIiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJkZWNvZGVVUklDb21wb25lbnQiLCJlc2NhcGUiLCJKU09OIiwicGFyc2UiLCJ2ZXJzaW9uIiwicGFyc2VGbG9hdCIsImV4dGVuc2lvbnNSZXF1aXJlZCIsIldhc21Nb2R1bGUiLCJnZXRJbnN0YW5jZSIsImluc3RhbmNlIiwicGFyc2VHbGIiLCJnbGJEYXRhIiwiRGF0YVZpZXciLCJieXRlTGVuZ3RoIiwibWFnaWMiLCJnZXRVaW50MzIiLCJjaHVua0xlbmd0aCIsIkVycm9yIiwiY2h1bmtUeXBlIiwiY2h1bmtEYXRhIiwicGFyc2VDaHVuayIsInRvTG93ZXJDYXNlIiwiZW5kc1dpdGgiLCJwYXJzZUJ1ZmZlclZpZXdzQXN5bmMiLCJnbHRmQnVmZmVyVmlldyIsIkdsYlBhcnNlciIsInBhcnNlQXN5bmMiLCJlcnJvciIsInJlc3VsdF8iLCJtYXhSZXRyaWVzIiwiX2RldmljZSIsIl9hc3NldHMiLCJfZGVmYXVsdE1hdGVyaWFsIiwiX2dldFVybFdpdGhvdXRQYXJhbXMiLCJmZXRjaEFycmF5QnVmZmVyIiwib3JpZ2luYWwiLCJleHRyYWN0UGF0aCIsIkdsYkNvbnRhaW5lclJlc291cmNlIiwib3BlbiIsInBhdGNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNERBLElBQUlBLG9CQUFvQixHQUFHLElBQTNCLENBQUE7O0FBRUEsTUFBTUMsMkJBQTJCLEdBQUcsTUFBTTtBQUN0QyxFQUFBLE9BQU8sT0FBT0MsTUFBUCxLQUFrQixXQUFsQixJQUFpQ0EsTUFBTSxDQUFDQyxrQkFBL0MsQ0FBQTtBQUNILENBRkQsQ0FBQTs7QUFLQSxNQUFNQyxZQUFOLENBQW1CO0VBQ2ZDLFdBQVcsQ0FBQ0MsSUFBRCxFQUFPO0lBQ2QsSUFBS0EsQ0FBQUEsSUFBTCxHQUFZQSxJQUFaLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxLQUFMLEdBQWEsSUFBYixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsTUFBTCxHQUFjLElBQWQsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFVBQUwsR0FBa0IsSUFBbEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFFBQUwsR0FBZ0IsSUFBaEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFNBQUwsR0FBaUIsSUFBakIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFFBQUwsR0FBZ0IsSUFBaEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLFlBQUwsR0FBb0IsSUFBcEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLG9CQUFMLEdBQTRCLElBQTVCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxPQUFMLEdBQWUsSUFBZixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsS0FB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
