/**
 * @license
 * PlayCanvas Engine v1.57.0-dev revision 5c6738c12 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../../core/path.js';
import { Debug } from '../../../core/debug.js';
import { http } from '../../../net/http.js';
import { math } from '../../../math/math.js';
import { Mat4 } from '../../../math/mat4.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';
import { Color } from '../../../math/color.js';
import { BoundingBox } from '../../../shape/bounding-box.js';
import { CULLFACE_NONE, CULLFACE_BACK, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, BUFFER_STATIC, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_POINTS, SEMANTIC_NORMAL, INDEXFORMAT_UINT8, TYPE_FLOAT32, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE, TYPE_UINT32, TYPE_INT32, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, typedArrayTypesByteSize, typedArrayTypes } from '../../../graphics/constants.js';
import { IndexBuffer } from '../../../graphics/index-buffer.js';
import { Texture } from '../../../graphics/texture.js';
import { VertexBuffer } from '../../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../../graphics/vertex-format.js';
import { SPECOCC_AO, BLEND_NONE, BLEND_NORMAL, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE, ASPECT_AUTO, LIGHTFALLOFF_INVERSESQUARED, ASPECT_MANUAL } from '../../../scene/constants.js';
import { calculateNormals } from '../../../scene/procedural.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Mesh } from '../../../scene/mesh.js';
import { Morph } from '../../../scene/morph.js';
import { MorphTarget } from '../../../scene/morph-target.js';
import { Skin } from '../../../scene/skin.js';
import { StandardMaterial } from '../../../scene/materials/standard-material.js';
import { Render } from '../../../scene/render.js';
import { Entity } from '../../../framework/entity.js';
import { AnimCurve } from '../../../anim/evaluator/anim-curve.js';
import { AnimData } from '../../../anim/evaluator/anim-data.js';
import { AnimTrack } from '../../../anim/evaluator/anim-track.js';
import { INTERPOLATION_LINEAR, INTERPOLATION_CUBIC, INTERPOLATION_STEP } from '../../../anim/constants.js';
import { Asset } from '../../../asset/asset.js';
import { GlbContainerResource } from './glb-container-resource.js';
import { WasmModule } from '../../../core/wasm-module.js';

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

const createMesh = function createMesh(device, gltfMesh, accessors, bufferViews, callback, flipV, vertexBufferDict, meshVariants, meshDefaultMaterials) {
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
        
        #ifdef MAPTEXTURE
        uniform sampler2D texture_clearCoatGlossMap;
        #endif
        
        void getClearCoatGlossiness() {
            ccGlossiness = 1.0;
        
        #ifdef MAPFLOAT
            ccGlossiness *= material_clearCoatGlossiness;
        #endif
        
        #ifdef MAPTEXTURE
            ccGlossiness *= texture2DBias(texture_clearCoatGlossMap, $UV, textureBias).$CH;
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

const extensionIridescense = function extensionIridescense(data, material, textures) {};

const createMaterial = function createMaterial(gltfMaterial, textures, flipV) {
  const glossChunk = `
        #ifdef MAPFLOAT
        uniform float material_shininess;
        #endif
        
        #ifdef MAPTEXTURE
        uniform sampler2D texture_glossMap;
        #endif
        
        void getGlossiness() {
            dGlossiness = 1.0;
        
        #ifdef MAPFLOAT
            dGlossiness *= material_shininess;
        #endif
        
        #ifdef MAPTEXTURE
            dGlossiness *= texture2DBias(texture_glossMap, $UV, textureBias).$CH;
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
    "KHR_materials_pbrSpecularGlossiness": extensionPbrSpecGlossiness,
    "KHR_materials_sheen": extensionSheen,
    "KHR_materials_specular": extensionSpecular,
    "KHR_materials_transmission": extensionTransmission,
    "KHR_materials_unlit": extensionUnlit,
    "KHR_materials_volume": extensionVolume,
    "KHR_materials_iridescense": extensionIridescense
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

    if (curveData.paths[0].propertyPath[0] === 'localRotation' && curveData.interpolation !== INTERPOLATION_CUBIC) {
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

  if (gltfLight.hasOwnProperty('intensity')) {
    if (gltfLight.type === 'point' || gltfLight.type === 'omni') {
      lightProps.luminance = gltfLight.intensity * (4 * Math.PI);
    } else if (gltfLight.type === 'spot') {
      if (gltfLight.hasOwnProperty('spot') && gltfLight.spot.hasOwnProperty('outerConeAngle')) {
        lightProps.luminance = gltfLight.intensity * (2 * Math.PI * (1 - Math.cos(gltfLight.spot.outerConeAngle / 2.0)));
      } else {
        lightProps.luminance = gltfLight.intensity * (4 * Math.PI);
      }
    } else {
      lightProps.luminance = gltfLight.intensity;
    }
  }

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

const createMeshes = function createMeshes(device, gltf, bufferViews, callback, flipV, meshVariants, meshDefaultMaterials) {
  if (!gltf.hasOwnProperty('meshes') || gltf.meshes.length === 0 || !gltf.hasOwnProperty('accessors') || gltf.accessors.length === 0 || !gltf.hasOwnProperty('bufferViews') || gltf.bufferViews.length === 0) {
    return [];
  }

  const vertexBufferDict = {};
  return gltf.meshes.map(function (gltfMesh) {
    return createMesh(device, gltfMesh, gltf.accessors, bufferViews, callback, flipV, vertexBufferDict, meshVariants, meshDefaultMaterials);
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
  const meshes = createMeshes(device, gltf, bufferViews, callback, flipV, meshVariants, meshDefaultMaterials);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3Jlc291cmNlcy9wYXJzZXIvZ2xiL2dsYi1wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vLi4vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi8uLi9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC9jb2xvci5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vLi4vc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHtcbiAgICB0eXBlZEFycmF5VHlwZXMsIHR5cGVkQXJyYXlUeXBlc0J5dGVTaXplLFxuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSwgQUREUkVTU19NSVJST1JFRF9SRVBFQVQsIEFERFJFU1NfUkVQRUFULFxuICAgIEJVRkZFUl9TVEFUSUMsXG4gICAgQ1VMTEZBQ0VfTk9ORSwgQ1VMTEZBQ0VfQkFDSyxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBJTkRFWEZPUk1BVF9VSU5UOCwgSU5ERVhGT1JNQVRfVUlOVDE2LCBJTkRFWEZPUk1BVF9VSU5UMzIsXG4gICAgUFJJTUlUSVZFX0xJTkVMT09QLCBQUklNSVRJVkVfTElORVNUUklQLCBQUklNSVRJVkVfTElORVMsIFBSSU1JVElWRV9QT0lOVFMsIFBSSU1JVElWRV9UUklBTkdMRVMsIFBSSU1JVElWRV9UUklGQU4sIFBSSU1JVElWRV9UUklTVFJJUCxcbiAgICBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19UQU5HRU5ULCBTRU1BTlRJQ19DT0xPUiwgU0VNQU5USUNfQkxFTkRJTkRJQ0VTLCBTRU1BTlRJQ19CTEVORFdFSUdIVCxcbiAgICBTRU1BTlRJQ19URVhDT09SRDAsIFNFTUFOVElDX1RFWENPT1JEMSwgU0VNQU5USUNfVEVYQ09PUkQyLCBTRU1BTlRJQ19URVhDT09SRDMsIFNFTUFOVElDX1RFWENPT1JENCwgU0VNQU5USUNfVEVYQ09PUkQ1LCBTRU1BTlRJQ19URVhDT09SRDYsIFNFTUFOVElDX1RFWENPT1JENyxcbiAgICBUWVBFX0lOVDgsIFRZUEVfVUlOVDgsIFRZUEVfSU5UMTYsIFRZUEVfVUlOVDE2LCBUWVBFX0lOVDMyLCBUWVBFX1VJTlQzMiwgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uLy4uLy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJbmRleEJ1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2dyYXBoaWNzL2luZGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vLi4vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4uLy4uLy4uL2dyYXBoaWNzL3ZlcnRleC1mb3JtYXQuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEJMRU5EX05PUk1BTCwgTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuICAgIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIEFTUEVDVF9NQU5VQUwsIEFTUEVDVF9BVVRPLCBTUEVDT0NDX0FPXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBjYWxjdWxhdGVOb3JtYWxzIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IE1vcnBoIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9ycGguanMnO1xuaW1wb3J0IHsgTW9ycGhUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tb3JwaC10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBSZW5kZXIgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9yZW5kZXIuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuLi8uLi8uLi9mcmFtZXdvcmsvZW50aXR5LmpzJztcblxuaW1wb3J0IHsgQW5pbUN1cnZlIH0gZnJvbSAnLi4vLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBBbmltRGF0YSB9IGZyb20gJy4uLy4uLy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyc7XG5pbXBvcnQgeyBBbmltVHJhY2sgfSBmcm9tICcuLi8uLi8uLi9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzJztcblxuaW1wb3J0IHsgSU5URVJQT0xBVElPTl9DVUJJQywgSU5URVJQT0xBVElPTl9MSU5FQVIsIElOVEVSUE9MQVRJT05fU1RFUCB9IGZyb20gJy4uLy4uLy4uL2FuaW0vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IEdsYkNvbnRhaW5lclJlc291cmNlIH0gZnJvbSAnLi9nbGItY29udGFpbmVyLXJlc291cmNlLmpzJztcblxuaW1wb3J0IHsgV2FzbU1vZHVsZSB9IGZyb20gJy4uLy4uLy4uL2NvcmUvd2FzbS1tb2R1bGUuanMnO1xuXG4vLyBpbnN0YW5jZSBvZiB0aGUgZHJhY28gZGVjb2RlclxubGV0IGRyYWNvRGVjb2Rlckluc3RhbmNlID0gbnVsbDtcblxuY29uc3QgZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlID0gKCkgPT4ge1xuICAgIHJldHVybiB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuRHJhY29EZWNvZGVyTW9kdWxlO1xufTtcblxuLy8gcmVzb3VyY2VzIGxvYWRlZCBmcm9tIEdMQiBmaWxlIHRoYXQgdGhlIHBhcnNlciByZXR1cm5zXG5jbGFzcyBHbGJSZXNvdXJjZXMge1xuICAgIGNvbnN0cnVjdG9yKGdsdGYpIHtcbiAgICAgICAgdGhpcy5nbHRmID0gZ2x0ZjtcbiAgICAgICAgdGhpcy5ub2RlcyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2NlbmVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5hbmltYXRpb25zID0gbnVsbDtcbiAgICAgICAgdGhpcy50ZXh0dXJlcyA9IG51bGw7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy52YXJpYW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaFZhcmlhbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5tZXNoRGVmYXVsdE1hdGVyaWFscyA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVycyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2tpbnMgPSBudWxsO1xuICAgICAgICB0aGlzLmxpZ2h0cyA9IG51bGw7XG4gICAgICAgIHRoaXMuY2FtZXJhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gcmVuZGVyIG5lZWRzIHRvIGRlYyByZWYgbWVzaGVzXG4gICAgICAgIGlmICh0aGlzLnJlbmRlcnMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVycy5mb3JFYWNoKChyZW5kZXIpID0+IHtcbiAgICAgICAgICAgICAgICByZW5kZXIubWVzaGVzID0gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBpc0RhdGFVUkkgPSBmdW5jdGlvbiAodXJpKSB7XG4gICAgcmV0dXJuIC9eZGF0YTouKiwuKiQvaS50ZXN0KHVyaSk7XG59O1xuXG5jb25zdCBnZXREYXRhVVJJTWltZVR5cGUgPSBmdW5jdGlvbiAodXJpKSB7XG4gICAgcmV0dXJuIHVyaS5zdWJzdHJpbmcodXJpLmluZGV4T2YoJzonKSArIDEsIHVyaS5pbmRleE9mKCc7JykpO1xufTtcblxuY29uc3QgZ2V0TnVtQ29tcG9uZW50cyA9IGZ1bmN0aW9uIChhY2Nlc3NvclR5cGUpIHtcbiAgICBzd2l0Y2ggKGFjY2Vzc29yVHlwZSkge1xuICAgICAgICBjYXNlICdTQ0FMQVInOiByZXR1cm4gMTtcbiAgICAgICAgY2FzZSAnVkVDMic6IHJldHVybiAyO1xuICAgICAgICBjYXNlICdWRUMzJzogcmV0dXJuIDM7XG4gICAgICAgIGNhc2UgJ1ZFQzQnOiByZXR1cm4gNDtcbiAgICAgICAgY2FzZSAnTUFUMic6IHJldHVybiA0O1xuICAgICAgICBjYXNlICdNQVQzJzogcmV0dXJuIDk7XG4gICAgICAgIGNhc2UgJ01BVDQnOiByZXR1cm4gMTY7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAzO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudFR5cGUgPSBmdW5jdGlvbiAoY29tcG9uZW50VHlwZSkge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiBUWVBFX0lOVDg7XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIFRZUEVfVUlOVDg7XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIFRZUEVfSU5UMTY7XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIFRZUEVfVUlOVDE2O1xuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiBUWVBFX0lOVDMyO1xuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiBUWVBFX1VJTlQzMjtcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gVFlQRV9GTE9BVDMyO1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gMDtcbiAgICB9XG59O1xuXG5jb25zdCBnZXRDb21wb25lbnRTaXplSW5CeXRlcyA9IGZ1bmN0aW9uIChjb21wb25lbnRUeXBlKSB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIDE7ICAgIC8vIGludDhcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gMTsgICAgLy8gdWludDhcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gMjsgICAgLy8gaW50MTZcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gMjsgICAgLy8gdWludDE2XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIDQ7ICAgIC8vIGludDMyXG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIDQ7ICAgIC8vIHVpbnQzMlxuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiA0OyAgICAvLyBmbG9hdDMyXG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAwO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudERhdGFUeXBlID0gZnVuY3Rpb24gKGNvbXBvbmVudFR5cGUpIHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gSW50OEFycmF5O1xuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiBVaW50OEFycmF5O1xuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiBJbnQxNkFycmF5O1xuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiBVaW50MTZBcnJheTtcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gSW50MzJBcnJheTtcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gVWludDMyQXJyYXk7XG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIEZsb2F0MzJBcnJheTtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuY29uc3QgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAgPSB7XG4gICAgJ1BPU0lUSU9OJzogU0VNQU5USUNfUE9TSVRJT04sXG4gICAgJ05PUk1BTCc6IFNFTUFOVElDX05PUk1BTCxcbiAgICAnVEFOR0VOVCc6IFNFTUFOVElDX1RBTkdFTlQsXG4gICAgJ0NPTE9SXzAnOiBTRU1BTlRJQ19DT0xPUixcbiAgICAnSk9JTlRTXzAnOiBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgJ1dFSUdIVFNfMCc6IFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgICdURVhDT09SRF8wJzogU0VNQU5USUNfVEVYQ09PUkQwLFxuICAgICdURVhDT09SRF8xJzogU0VNQU5USUNfVEVYQ09PUkQxLFxuICAgICdURVhDT09SRF8yJzogU0VNQU5USUNfVEVYQ09PUkQyLFxuICAgICdURVhDT09SRF8zJzogU0VNQU5USUNfVEVYQ09PUkQzLFxuICAgICdURVhDT09SRF80JzogU0VNQU5USUNfVEVYQ09PUkQ0LFxuICAgICdURVhDT09SRF81JzogU0VNQU5USUNfVEVYQ09PUkQ1LFxuICAgICdURVhDT09SRF82JzogU0VNQU5USUNfVEVYQ09PUkQ2LFxuICAgICdURVhDT09SRF83JzogU0VNQU5USUNfVEVYQ09PUkQ3XG59O1xuXG4vLyByZXR1cm5zIGEgZnVuY3Rpb24gZm9yIGRlcXVhbnRpemluZyB0aGUgZGF0YSB0eXBlXG5jb25zdCBnZXREZXF1YW50aXplRnVuYyA9IChzcmNUeXBlKSA9PiB7XG4gICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9LaHJvbm9zR3JvdXAvZ2xURi90cmVlL21hc3Rlci9leHRlbnNpb25zLzIuMC9LaHJvbm9zL0tIUl9tZXNoX3F1YW50aXphdGlvbiNlbmNvZGluZy1xdWFudGl6ZWQtZGF0YVxuICAgIHN3aXRjaCAoc3JjVHlwZSkge1xuICAgICAgICBjYXNlIFRZUEVfSU5UODogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDEyNy4wLCAtMS4wKTtcbiAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OiByZXR1cm4geCA9PiB4IC8gMjU1LjA7XG4gICAgICAgIGNhc2UgVFlQRV9JTlQxNjogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDMyNzY3LjAsIC0xLjApO1xuICAgICAgICBjYXNlIFRZUEVfVUlOVDE2OiByZXR1cm4geCA9PiB4IC8gNjU1MzUuMDtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIHggPT4geDtcbiAgICB9XG59O1xuXG4vLyBkZXF1YW50aXplIGFuIGFycmF5IG9mIGRhdGFcbmNvbnN0IGRlcXVhbnRpemVBcnJheSA9IGZ1bmN0aW9uIChkc3RBcnJheSwgc3JjQXJyYXksIHNyY1R5cGUpIHtcbiAgICBjb25zdCBjb252RnVuYyA9IGdldERlcXVhbnRpemVGdW5jKHNyY1R5cGUpO1xuICAgIGNvbnN0IGxlbiA9IHNyY0FycmF5Lmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIGRzdEFycmF5W2ldID0gY29udkZ1bmMoc3JjQXJyYXlbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gZHN0QXJyYXk7XG59O1xuXG4vLyBnZXQgYWNjZXNzb3IgZGF0YSwgbWFraW5nIGEgY29weSBhbmQgcGF0Y2hpbmcgaW4gdGhlIGNhc2Ugb2YgYSBzcGFyc2UgYWNjZXNzb3JcbmNvbnN0IGdldEFjY2Vzc29yRGF0YSA9IGZ1bmN0aW9uIChnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCBmbGF0dGVuID0gZmFsc2UpIHtcbiAgICBjb25zdCBudW1Db21wb25lbnRzID0gZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSk7XG4gICAgY29uc3QgZGF0YVR5cGUgPSBnZXRDb21wb25lbnREYXRhVHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgaWYgKCFkYXRhVHlwZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBidWZmZXJWaWV3ID0gYnVmZmVyVmlld3NbZ2x0ZkFjY2Vzc29yLmJ1ZmZlclZpZXddO1xuICAgIGxldCByZXN1bHQ7XG5cbiAgICBpZiAoZ2x0ZkFjY2Vzc29yLnNwYXJzZSkge1xuICAgICAgICAvLyBoYW5kbGUgc3BhcnNlIGRhdGFcbiAgICAgICAgY29uc3Qgc3BhcnNlID0gZ2x0ZkFjY2Vzc29yLnNwYXJzZTtcblxuICAgICAgICAvLyBnZXQgaW5kaWNlcyBkYXRhXG4gICAgICAgIGNvbnN0IGluZGljZXNBY2Nlc3NvciA9IHtcbiAgICAgICAgICAgIGNvdW50OiBzcGFyc2UuY291bnQsXG4gICAgICAgICAgICB0eXBlOiAnU0NBTEFSJ1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBpbmRpY2VzID0gZ2V0QWNjZXNzb3JEYXRhKE9iamVjdC5hc3NpZ24oaW5kaWNlc0FjY2Vzc29yLCBzcGFyc2UuaW5kaWNlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBkYXRhIHZhbHVlcyBkYXRhXG4gICAgICAgIGNvbnN0IHZhbHVlc0FjY2Vzc29yID0ge1xuICAgICAgICAgICAgY291bnQ6IHNwYXJzZS5jb3VudCxcbiAgICAgICAgICAgIHR5cGU6IGdsdGZBY2Nlc3Nvci5zY2FsYXIsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiBnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbih2YWx1ZXNBY2Nlc3Nvciwgc3BhcnNlLnZhbHVlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBnZXQgYmFzZSBkYXRhXG4gICAgICAgIGlmIChnbHRmQWNjZXNzb3IuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUFjY2Vzc29yID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXc6IGdsdGZBY2Nlc3Nvci5idWZmZXJWaWV3LFxuICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXQ6IGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgIGNvdW50OiBnbHRmQWNjZXNzb3IuY291bnQsXG4gICAgICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYmFzZSBkYXRhIHNpbmNlIHdlJ2xsIHBhdGNoIHRoZSB2YWx1ZXNcbiAgICAgICAgICAgIHJlc3VsdCA9IGdldEFjY2Vzc29yRGF0YShiYXNlQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKS5zbGljZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gYmFzZSBkYXRhLCBjcmVhdGUgZW1wdHkgMCdkIG91dCBkYXRhXG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvdW50ICogbnVtQ29tcG9uZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwYXJzZS5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRJbmRleCA9IGluZGljZXNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bUNvbXBvbmVudHM7ICsraikge1xuICAgICAgICAgICAgICAgIHJlc3VsdFt0YXJnZXRJbmRleCAqIG51bUNvbXBvbmVudHMgKyBqXSA9IHZhbHVlc1tpICogbnVtQ29tcG9uZW50cyArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChmbGF0dGVuICYmIGJ1ZmZlclZpZXcuaGFzT3duUHJvcGVydHkoJ2J5dGVTdHJpZGUnKSkge1xuICAgICAgICAvLyBmbGF0dGVuIHN0cmlkZGVuIGRhdGFcbiAgICAgICAgY29uc3QgYnl0ZXNQZXJFbGVtZW50ID0gbnVtQ29tcG9uZW50cyAqIGRhdGFUeXBlLkJZVEVTX1BFUl9FTEVNRU5UO1xuICAgICAgICBjb25zdCBzdG9yYWdlID0gbmV3IEFycmF5QnVmZmVyKGdsdGZBY2Nlc3Nvci5jb3VudCAqIGJ5dGVzUGVyRWxlbWVudCk7XG4gICAgICAgIGNvbnN0IHRtcEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoc3RvcmFnZSk7XG5cbiAgICAgICAgbGV0IGRzdE9mZnNldCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0ZkFjY2Vzc29yLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gYWRkIGJ1ZmZlclZpZXcuYnl0ZU9mZnNldCBiZWNhdXNlIGFjY2Vzc29yIHRha2VzIHRoaXMgaW50byBhY2NvdW50XG4gICAgICAgICAgICBsZXQgc3JjT2Zmc2V0ID0gKGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0IHx8IDApICsgaSAqIGJ1ZmZlclZpZXcuYnl0ZVN0cmlkZTtcbiAgICAgICAgICAgIGZvciAobGV0IGIgPSAwOyBiIDwgYnl0ZXNQZXJFbGVtZW50OyArK2IpIHtcbiAgICAgICAgICAgICAgICB0bXBBcnJheVtkc3RPZmZzZXQrK10gPSBidWZmZXJWaWV3W3NyY09mZnNldCsrXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdCA9IG5ldyBkYXRhVHlwZShzdG9yYWdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoYnVmZmVyVmlldy5idWZmZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVPZmZzZXQgKyAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbHRmQWNjZXNzb3IuY291bnQgKiBudW1Db21wb25lbnRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gZ2V0IGFjY2Vzc29yIGRhdGEgYXMgKHVubm9ybWFsaXplZCwgdW5xdWFudGl6ZWQpIEZsb2F0MzIgZGF0YVxuY29uc3QgZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMiA9IGZ1bmN0aW9uIChnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzKSB7XG4gICAgY29uc3QgZGF0YSA9IGdldEFjY2Vzc29yRGF0YShnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKTtcbiAgICBpZiAoZGF0YSBpbnN0YW5jZW9mIEZsb2F0MzJBcnJheSB8fCAhZ2x0ZkFjY2Vzc29yLm5vcm1hbGl6ZWQpIHtcbiAgICAgICAgLy8gaWYgdGhlIHNvdXJjZSBkYXRhIGlzIHF1YW50aXplZCAoc2F5IHRvIGludDE2KSwgYnV0IG5vdCBub3JtYWxpemVkXG4gICAgICAgIC8vIHRoZW4gcmVhZGluZyB0aGUgdmFsdWVzIG9mIHRoZSBhcnJheSBpcyB0aGUgc2FtZSB3aGV0aGVyIHRoZSB2YWx1ZXNcbiAgICAgICAgLy8gYXJlIHN0b3JlZCBhcyBmbG9hdDMyIG9yIGludDE2LiBzbyBwcm9iYWJseSBubyBuZWVkIHRvIGNvbnZlcnQgdG9cbiAgICAgICAgLy8gZmxvYXQzMi5cbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuXG4gICAgY29uc3QgZmxvYXQzMkRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KGRhdGEubGVuZ3RoKTtcbiAgICBkZXF1YW50aXplQXJyYXkoZmxvYXQzMkRhdGEsIGRhdGEsIGdldENvbXBvbmVudFR5cGUoZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUpKTtcbiAgICByZXR1cm4gZmxvYXQzMkRhdGE7XG59O1xuXG4vLyByZXR1cm5zIGEgZGVxdWFudGl6ZWQgYm91bmRpbmcgYm94IGZvciB0aGUgYWNjZXNzb3JcbmNvbnN0IGdldEFjY2Vzc29yQm91bmRpbmdCb3ggPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yKSB7XG4gICAgbGV0IG1pbiA9IGdsdGZBY2Nlc3Nvci5taW47XG4gICAgbGV0IG1heCA9IGdsdGZBY2Nlc3Nvci5tYXg7XG4gICAgaWYgKCFtaW4gfHwgIW1heCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoZ2x0ZkFjY2Vzc29yLm5vcm1hbGl6ZWQpIHtcbiAgICAgICAgY29uc3QgY3R5cGUgPSBnZXRDb21wb25lbnRUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgbWluID0gZGVxdWFudGl6ZUFycmF5KFtdLCBtaW4sIGN0eXBlKTtcbiAgICAgICAgbWF4ID0gZGVxdWFudGl6ZUFycmF5KFtdLCBtYXgsIGN0eXBlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEJvdW5kaW5nQm94KFxuICAgICAgICBuZXcgVmVjMygobWF4WzBdICsgbWluWzBdKSAqIDAuNSwgKG1heFsxXSArIG1pblsxXSkgKiAwLjUsIChtYXhbMl0gKyBtaW5bMl0pICogMC41KSxcbiAgICAgICAgbmV3IFZlYzMoKG1heFswXSAtIG1pblswXSkgKiAwLjUsIChtYXhbMV0gLSBtaW5bMV0pICogMC41LCAobWF4WzJdIC0gbWluWzJdKSAqIDAuNSlcbiAgICApO1xufTtcblxuY29uc3QgZ2V0UHJpbWl0aXZlVHlwZSA9IGZ1bmN0aW9uIChwcmltaXRpdmUpIHtcbiAgICBpZiAoIXByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgnbW9kZScpKSB7XG4gICAgICAgIHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgIH1cblxuICAgIHN3aXRjaCAocHJpbWl0aXZlLm1vZGUpIHtcbiAgICAgICAgY2FzZSAwOiByZXR1cm4gUFJJTUlUSVZFX1BPSU5UUztcbiAgICAgICAgY2FzZSAxOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVTO1xuICAgICAgICBjYXNlIDI6IHJldHVybiBQUklNSVRJVkVfTElORUxPT1A7XG4gICAgICAgIGNhc2UgMzogcmV0dXJuIFBSSU1JVElWRV9MSU5FU1RSSVA7XG4gICAgICAgIGNhc2UgNDogcmV0dXJuIFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgICAgIGNhc2UgNTogcmV0dXJuIFBSSU1JVElWRV9UUklTVFJJUDtcbiAgICAgICAgY2FzZSA2OiByZXR1cm4gUFJJTUlUSVZFX1RSSUZBTjtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgfVxufTtcblxuY29uc3QgZ2VuZXJhdGVJbmRpY2VzID0gZnVuY3Rpb24gKG51bVZlcnRpY2VzKSB7XG4gICAgY29uc3QgZHVtbXlJbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KG51bVZlcnRpY2VzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVZlcnRpY2VzOyBpKyspIHtcbiAgICAgICAgZHVtbXlJbmRpY2VzW2ldID0gaTtcbiAgICB9XG4gICAgcmV0dXJuIGR1bW15SW5kaWNlcztcbn07XG5cbmNvbnN0IGdlbmVyYXRlTm9ybWFscyA9IGZ1bmN0aW9uIChzb3VyY2VEZXNjLCBpbmRpY2VzKSB7XG4gICAgLy8gZ2V0IHBvc2l0aW9uc1xuICAgIGNvbnN0IHAgPSBzb3VyY2VEZXNjW1NFTUFOVElDX1BPU0lUSU9OXTtcbiAgICBpZiAoIXAgfHwgcC5jb21wb25lbnRzICE9PSAzKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgcG9zaXRpb25zO1xuICAgIGlmIChwLnNpemUgIT09IHAuc3RyaWRlKSB7XG4gICAgICAgIC8vIGV4dHJhY3QgcG9zaXRpb25zIHdoaWNoIGFyZW4ndCB0aWdodGx5IHBhY2tlZFxuICAgICAgICBjb25zdCBzcmNTdHJpZGUgPSBwLnN0cmlkZSAvIHR5cGVkQXJyYXlUeXBlc0J5dGVTaXplW3AudHlwZV07XG4gICAgICAgIGNvbnN0IHNyYyA9IG5ldyB0eXBlZEFycmF5VHlwZXNbcC50eXBlXShwLmJ1ZmZlciwgcC5vZmZzZXQsIHAuY291bnQgKiBzcmNTdHJpZGUpO1xuICAgICAgICBwb3NpdGlvbnMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5jb3VudCAqIDMpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHAuY291bnQ7ICsraSkge1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAzICsgMF0gPSBzcmNbaSAqIHNyY1N0cmlkZSArIDBdO1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAzICsgMV0gPSBzcmNbaSAqIHNyY1N0cmlkZSArIDFdO1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAzICsgMl0gPSBzcmNbaSAqIHNyY1N0cmlkZSArIDJdO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gcG9zaXRpb24gZGF0YSBpcyB0aWdodGx5IHBhY2tlZCBzbyB3ZSBjYW4gdXNlIGl0IGRpcmVjdGx5XG4gICAgICAgIHBvc2l0aW9ucyA9IG5ldyB0eXBlZEFycmF5VHlwZXNbcC50eXBlXShwLmJ1ZmZlciwgcC5vZmZzZXQsIHAuY291bnQgKiAzKTtcbiAgICB9XG5cbiAgICBjb25zdCBudW1WZXJ0aWNlcyA9IHAuY291bnQ7XG5cbiAgICAvLyBnZW5lcmF0ZSBpbmRpY2VzIGlmIG5lY2Vzc2FyeVxuICAgIGlmICghaW5kaWNlcykge1xuICAgICAgICBpbmRpY2VzID0gZ2VuZXJhdGVJbmRpY2VzKG51bVZlcnRpY2VzKTtcbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZSBub3JtYWxzXG4gICAgY29uc3Qgbm9ybWFsc1RlbXAgPSBjYWxjdWxhdGVOb3JtYWxzKHBvc2l0aW9ucywgaW5kaWNlcyk7XG4gICAgY29uc3Qgbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkobm9ybWFsc1RlbXAubGVuZ3RoKTtcbiAgICBub3JtYWxzLnNldChub3JtYWxzVGVtcCk7XG5cbiAgICBzb3VyY2VEZXNjW1NFTUFOVElDX05PUk1BTF0gPSB7XG4gICAgICAgIGJ1ZmZlcjogbm9ybWFscy5idWZmZXIsXG4gICAgICAgIHNpemU6IDEyLFxuICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgIHN0cmlkZTogMTIsXG4gICAgICAgIGNvdW50OiBudW1WZXJ0aWNlcyxcbiAgICAgICAgY29tcG9uZW50czogMyxcbiAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgfTtcbn07XG5cbmNvbnN0IGZsaXBUZXhDb29yZFZzID0gZnVuY3Rpb24gKHZlcnRleEJ1ZmZlcikge1xuICAgIGxldCBpLCBqO1xuXG4gICAgY29uc3QgZmxvYXRPZmZzZXRzID0gW107XG4gICAgY29uc3Qgc2hvcnRPZmZzZXRzID0gW107XG4gICAgY29uc3QgYnl0ZU9mZnNldHMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgaWYgKGVsZW1lbnQubmFtZSA9PT0gU0VNQU5USUNfVEVYQ09PUkQwIHx8XG4gICAgICAgICAgICBlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMSkge1xuICAgICAgICAgICAgc3dpdGNoIChlbGVtZW50LmRhdGFUeXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX0ZMT0FUMzI6XG4gICAgICAgICAgICAgICAgICAgIGZsb2F0T2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCAvIDQgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIC8gNCB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQxNjpcbiAgICAgICAgICAgICAgICAgICAgc2hvcnRPZmZzZXRzLnB1c2goeyBvZmZzZXQ6IGVsZW1lbnQub2Zmc2V0IC8gMiArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgLyAyIH0pO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFRZUEVfVUlOVDg6XG4gICAgICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXRzLnB1c2goeyBvZmZzZXQ6IGVsZW1lbnQub2Zmc2V0ICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBmbGlwID0gZnVuY3Rpb24gKG9mZnNldHMsIHR5cGUsIG9uZSkge1xuICAgICAgICBjb25zdCB0eXBlZEFycmF5ID0gbmV3IHR5cGUodmVydGV4QnVmZmVyLnN0b3JhZ2UpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2Zmc2V0cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gb2Zmc2V0c1tpXS5vZmZzZXQ7XG4gICAgICAgICAgICBjb25zdCBzdHJpZGUgPSBvZmZzZXRzW2ldLnN0cmlkZTtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCB2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7ICsraikge1xuICAgICAgICAgICAgICAgIHR5cGVkQXJyYXlbaW5kZXhdID0gb25lIC0gdHlwZWRBcnJheVtpbmRleF07XG4gICAgICAgICAgICAgICAgaW5kZXggKz0gc3RyaWRlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGlmIChmbG9hdE9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKGZsb2F0T2Zmc2V0cywgRmxvYXQzMkFycmF5LCAxLjApO1xuICAgIH1cbiAgICBpZiAoc2hvcnRPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChzaG9ydE9mZnNldHMsIFVpbnQxNkFycmF5LCA2NTUzNSk7XG4gICAgfVxuICAgIGlmIChieXRlT2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoYnl0ZU9mZnNldHMsIFVpbnQ4QXJyYXksIDI1NSk7XG4gICAgfVxufTtcblxuLy8gZ2l2ZW4gYSB0ZXh0dXJlLCBjbG9uZSBpdFxuLy8gTk9URTogQ1BVLXNpZGUgdGV4dHVyZSBkYXRhIHdpbGwgYmUgc2hhcmVkIGJ1dCBHUFUgbWVtb3J5IHdpbGwgYmUgZHVwbGljYXRlZFxuY29uc3QgY2xvbmVUZXh0dXJlID0gZnVuY3Rpb24gKHRleHR1cmUpIHtcbiAgICBjb25zdCBzaGFsbG93Q29weUxldmVscyA9IGZ1bmN0aW9uICh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBtaXAgPSAwOyBtaXAgPCB0ZXh0dXJlLl9sZXZlbHMubGVuZ3RoOyArK21pcCkge1xuICAgICAgICAgICAgbGV0IGxldmVsID0gW107XG4gICAgICAgICAgICBpZiAodGV4dHVyZS5jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyArK2ZhY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWwucHVzaCh0ZXh0dXJlLl9sZXZlbHNbbWlwXVtmYWNlXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXZlbCA9IHRleHR1cmUuX2xldmVsc1ttaXBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnB1c2gobGV2ZWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBUZXh0dXJlKHRleHR1cmUuZGV2aWNlLCB0ZXh0dXJlKTsgICAvLyBkdXBsaWNhdGUgdGV4dHVyZVxuICAgIHJlc3VsdC5fbGV2ZWxzID0gc2hhbGxvd0NvcHlMZXZlbHModGV4dHVyZSk7ICAgICAgICAgICAgLy8gc2hhbGxvdyBjb3B5IHRoZSBsZXZlbHMgc3RydWN0dXJlXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdpdmVuIGEgdGV4dHVyZSBhc3NldCwgY2xvbmUgaXRcbmNvbnN0IGNsb25lVGV4dHVyZUFzc2V0ID0gZnVuY3Rpb24gKHNyYykge1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBBc3NldChzcmMubmFtZSArICdfY2xvbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLmZpbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5kYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMub3B0aW9ucyk7XG4gICAgcmVzdWx0LmxvYWRlZCA9IHRydWU7XG4gICAgcmVzdWx0LnJlc291cmNlID0gY2xvbmVUZXh0dXJlKHNyYy5yZXNvdXJjZSk7XG4gICAgc3JjLnJlZ2lzdHJ5LmFkZChyZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbCA9IGZ1bmN0aW9uIChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKSB7XG4gICAgY29uc3QgcG9zaXRpb25EZXNjID0gc291cmNlRGVzY1tTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgaWYgKCFwb3NpdGlvbkRlc2MpIHtcbiAgICAgICAgLy8gaWdub3JlIG1lc2hlcyB3aXRob3V0IHBvc2l0aW9uc1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgbnVtVmVydGljZXMgPSBwb3NpdGlvbkRlc2MuY291bnQ7XG5cbiAgICAvLyBnZW5lcmF0ZSB2ZXJ0ZXhEZXNjIGVsZW1lbnRzXG4gICAgY29uc3QgdmVydGV4RGVzYyA9IFtdO1xuICAgIGZvciAoY29uc3Qgc2VtYW50aWMgaW4gc291cmNlRGVzYykge1xuICAgICAgICBpZiAoc291cmNlRGVzYy5oYXNPd25Qcm9wZXJ0eShzZW1hbnRpYykpIHtcbiAgICAgICAgICAgIHZlcnRleERlc2MucHVzaCh7XG4gICAgICAgICAgICAgICAgc2VtYW50aWM6IHNlbWFudGljLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IHNvdXJjZURlc2Nbc2VtYW50aWNdLmNvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgdHlwZTogc291cmNlRGVzY1tzZW1hbnRpY10udHlwZSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6ICEhc291cmNlRGVzY1tzZW1hbnRpY10ubm9ybWFsaXplXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIG9yZGVyIHZlcnRleERlc2MgdG8gbWF0Y2ggdGhlIHJlc3Qgb2YgdGhlIGVuZ2luZVxuICAgIGNvbnN0IGVsZW1lbnRPcmRlciA9IFtcbiAgICAgICAgU0VNQU5USUNfUE9TSVRJT04sXG4gICAgICAgIFNFTUFOVElDX05PUk1BTCxcbiAgICAgICAgU0VNQU5USUNfVEFOR0VOVCxcbiAgICAgICAgU0VNQU5USUNfQ09MT1IsXG4gICAgICAgIFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICAgICAgU0VNQU5USUNfQkxFTkRXRUlHSFQsXG4gICAgICAgIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICAgICAgU0VNQU5USUNfVEVYQ09PUkQxXG4gICAgXTtcblxuICAgIC8vIHNvcnQgdmVydGV4IGVsZW1lbnRzIGJ5IGVuZ2luZS1pZGVhbCBvcmRlclxuICAgIHZlcnRleERlc2Muc29ydChmdW5jdGlvbiAobGhzLCByaHMpIHtcbiAgICAgICAgY29uc3QgbGhzT3JkZXIgPSBlbGVtZW50T3JkZXIuaW5kZXhPZihsaHMuc2VtYW50aWMpO1xuICAgICAgICBjb25zdCByaHNPcmRlciA9IGVsZW1lbnRPcmRlci5pbmRleE9mKHJocy5zZW1hbnRpYyk7XG4gICAgICAgIHJldHVybiAobGhzT3JkZXIgPCByaHNPcmRlcikgPyAtMSA6IChyaHNPcmRlciA8IGxoc09yZGVyID8gMSA6IDApO1xuICAgIH0pO1xuXG4gICAgbGV0IGksIGosIGs7XG4gICAgbGV0IHNvdXJjZSwgdGFyZ2V0LCBzb3VyY2VPZmZzZXQ7XG5cbiAgICBjb25zdCB2ZXJ0ZXhGb3JtYXQgPSBuZXcgVmVydGV4Rm9ybWF0KGRldmljZSwgdmVydGV4RGVzYyk7XG5cbiAgICAvLyBjaGVjayB3aGV0aGVyIHNvdXJjZSBkYXRhIGlzIGNvcnJlY3RseSBpbnRlcmxlYXZlZFxuICAgIGxldCBpc0NvcnJlY3RseUludGVybGVhdmVkID0gdHJ1ZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4Rm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHRhcmdldCA9IHZlcnRleEZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgc291cmNlID0gc291cmNlRGVzY1t0YXJnZXQubmFtZV07XG4gICAgICAgIHNvdXJjZU9mZnNldCA9IHNvdXJjZS5vZmZzZXQgLSBwb3NpdGlvbkRlc2Mub2Zmc2V0O1xuICAgICAgICBpZiAoKHNvdXJjZS5idWZmZXIgIT09IHBvc2l0aW9uRGVzYy5idWZmZXIpIHx8XG4gICAgICAgICAgICAoc291cmNlLnN0cmlkZSAhPT0gdGFyZ2V0LnN0cmlkZSkgfHxcbiAgICAgICAgICAgIChzb3VyY2Uuc2l6ZSAhPT0gdGFyZ2V0LnNpemUpIHx8XG4gICAgICAgICAgICAoc291cmNlT2Zmc2V0ICE9PSB0YXJnZXQub2Zmc2V0KSkge1xuICAgICAgICAgICAgaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgdmVydGV4IGJ1ZmZlclxuICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIoZGV2aWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVydGV4Rm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmVydGljZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBCVUZGRVJfU1RBVElDKTtcblxuICAgIGNvbnN0IHZlcnRleERhdGEgPSB2ZXJ0ZXhCdWZmZXIubG9jaygpO1xuICAgIGNvbnN0IHRhcmdldEFycmF5ID0gbmV3IFVpbnQzMkFycmF5KHZlcnRleERhdGEpO1xuICAgIGxldCBzb3VyY2VBcnJheTtcblxuICAgIGlmIChpc0NvcnJlY3RseUludGVybGVhdmVkKSB7XG4gICAgICAgIC8vIGNvcHkgZGF0YVxuICAgICAgICBzb3VyY2VBcnJheSA9IG5ldyBVaW50MzJBcnJheShwb3NpdGlvbkRlc2MuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbkRlc2Mub2Zmc2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1WZXJ0aWNlcyAqIHZlcnRleEJ1ZmZlci5mb3JtYXQuc2l6ZSAvIDQpO1xuICAgICAgICB0YXJnZXRBcnJheS5zZXQoc291cmNlQXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCB0YXJnZXRTdHJpZGUsIHNvdXJjZVN0cmlkZTtcbiAgICAgICAgLy8gY29weSBkYXRhIGFuZCBpbnRlcmxlYXZlXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB0YXJnZXQgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgdGFyZ2V0U3RyaWRlID0gdGFyZ2V0LnN0cmlkZSAvIDQ7XG5cbiAgICAgICAgICAgIHNvdXJjZSA9IHNvdXJjZURlc2NbdGFyZ2V0Lm5hbWVdO1xuICAgICAgICAgICAgc291cmNlU3RyaWRlID0gc291cmNlLnN0cmlkZSAvIDQ7XG4gICAgICAgICAgICAvLyBlbnN1cmUgd2UgZG9uJ3QgZ28gYmV5b25kIHRoZSBlbmQgb2YgdGhlIGFycmF5YnVmZmVyIHdoZW4gZGVhbGluZyB3aXRoXG4gICAgICAgICAgICAvLyBpbnRlcmxhY2VkIHZlcnRleCBmb3JtYXRzXG4gICAgICAgICAgICBzb3VyY2VBcnJheSA9IG5ldyBVaW50MzJBcnJheShzb3VyY2UuYnVmZmVyLCBzb3VyY2Uub2Zmc2V0LCAoc291cmNlLmNvdW50IC0gMSkgKiBzb3VyY2VTdHJpZGUgKyAoc291cmNlLnNpemUgKyAzKSAvIDQpO1xuXG4gICAgICAgICAgICBsZXQgc3JjID0gMDtcbiAgICAgICAgICAgIGxldCBkc3QgPSB0YXJnZXQub2Zmc2V0IC8gNDtcbiAgICAgICAgICAgIGNvbnN0IGtlbmQgPSBNYXRoLmZsb29yKChzb3VyY2Uuc2l6ZSArIDMpIC8gNCk7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgbnVtVmVydGljZXM7ICsraikge1xuICAgICAgICAgICAgICAgIGZvciAoayA9IDA7IGsgPCBrZW5kOyArK2spIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0QXJyYXlbZHN0ICsga10gPSBzb3VyY2VBcnJheVtzcmMgKyBrXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3JjICs9IHNvdXJjZVN0cmlkZTtcbiAgICAgICAgICAgICAgICBkc3QgKz0gdGFyZ2V0U3RyaWRlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIGZsaXBUZXhDb29yZFZzKHZlcnRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgdmVydGV4QnVmZmVyLnVubG9jaygpO1xuXG4gICAgcmV0dXJuIHZlcnRleEJ1ZmZlcjtcbn07XG5cbmNvbnN0IGNyZWF0ZVZlcnRleEJ1ZmZlciA9IGZ1bmN0aW9uIChkZXZpY2UsIGF0dHJpYnV0ZXMsIGluZGljZXMsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0KSB7XG5cbiAgICAvLyBleHRyYWN0IGxpc3Qgb2YgYXR0cmlidXRlcyB0byB1c2VcbiAgICBjb25zdCB1c2VBdHRyaWJ1dGVzID0ge307XG4gICAgY29uc3QgYXR0cmliSWRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHJpYikgJiYgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAuaGFzT3duUHJvcGVydHkoYXR0cmliKSkge1xuICAgICAgICAgICAgdXNlQXR0cmlidXRlc1thdHRyaWJdID0gYXR0cmlidXRlc1thdHRyaWJdO1xuXG4gICAgICAgICAgICAvLyBidWlsZCB1bmlxdWUgaWQgZm9yIGVhY2ggYXR0cmlidXRlIGluIGZvcm1hdDogU2VtYW50aWM6YWNjZXNzb3JJbmRleFxuICAgICAgICAgICAgYXR0cmliSWRzLnB1c2goYXR0cmliICsgJzonICsgYXR0cmlidXRlc1thdHRyaWJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdW5pcXVlIGlkcyBhbmQgY3JlYXRlIHVuaXF1ZSB2ZXJ0ZXggYnVmZmVyIElEXG4gICAgYXR0cmliSWRzLnNvcnQoKTtcbiAgICBjb25zdCB2YktleSA9IGF0dHJpYklkcy5qb2luKCk7XG5cbiAgICAvLyByZXR1cm4gYWxyZWFkeSBjcmVhdGVkIHZlcnRleCBidWZmZXIgaWYgaWRlbnRpY2FsXG4gICAgbGV0IHZiID0gdmVydGV4QnVmZmVyRGljdFt2YktleV07XG4gICAgaWYgKCF2Yikge1xuICAgICAgICAvLyBidWlsZCB2ZXJ0ZXggYnVmZmVyIGZvcm1hdCBkZXNjIGFuZCBzb3VyY2VcbiAgICAgICAgY29uc3Qgc291cmNlRGVzYyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiB1c2VBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NvciA9IGFjY2Vzc29yc1thdHRyaWJ1dGVzW2F0dHJpYl1dO1xuICAgICAgICAgICAgY29uc3QgYWNjZXNzb3JEYXRhID0gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yLCBidWZmZXJWaWV3cyk7XG4gICAgICAgICAgICBjb25zdCBidWZmZXJWaWV3ID0gYnVmZmVyVmlld3NbYWNjZXNzb3IuYnVmZmVyVmlld107XG4gICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGdsdGZUb0VuZ2luZVNlbWFudGljTWFwW2F0dHJpYl07XG4gICAgICAgICAgICBjb25zdCBzaXplID0gZ2V0TnVtQ29tcG9uZW50cyhhY2Nlc3Nvci50eXBlKSAqIGdldENvbXBvbmVudFNpemVJbkJ5dGVzKGFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gYnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpID8gYnVmZmVyVmlldy5ieXRlU3RyaWRlIDogc2l6ZTtcbiAgICAgICAgICAgIHNvdXJjZURlc2Nbc2VtYW50aWNdID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYWNjZXNzb3JEYXRhLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgICAgIG9mZnNldDogYWNjZXNzb3JEYXRhLmJ5dGVPZmZzZXQsXG4gICAgICAgICAgICAgICAgc3RyaWRlOiBzdHJpZGUsXG4gICAgICAgICAgICAgICAgY291bnQ6IGFjY2Vzc29yLmNvdW50LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSksXG4gICAgICAgICAgICAgICAgdHlwZTogZ2V0Q29tcG9uZW50VHlwZShhY2Nlc3Nvci5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6IGFjY2Vzc29yLm5vcm1hbGl6ZWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBnZW5lcmF0ZSBub3JtYWxzIGlmIHRoZXkncmUgbWlzc2luZyAodGhpcyBzaG91bGQgcHJvYmFibHkgYmUgYSB1c2VyIG9wdGlvbilcbiAgICAgICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgICAgIGdlbmVyYXRlTm9ybWFscyhzb3VyY2VEZXNjLCBpbmRpY2VzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgc3RvcmUgaXQgaW4gdGhlIGRpY3Rpb25hcnlcbiAgICAgICAgdmIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbiAgICAgICAgdmVydGV4QnVmZmVyRGljdFt2YktleV0gPSB2YjtcbiAgICB9XG5cbiAgICByZXR1cm4gdmI7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXJEcmFjbyA9IGZ1bmN0aW9uIChkZXZpY2UsIG91dHB1dEdlb21ldHJ5LCBleHREcmFjbywgZGVjb2RlciwgZGVjb2Rlck1vZHVsZSwgaW5kaWNlcywgZmxpcFYpIHtcblxuICAgIGNvbnN0IG51bVBvaW50cyA9IG91dHB1dEdlb21ldHJ5Lm51bV9wb2ludHMoKTtcblxuICAgIC8vIGhlbHBlciBmdW5jdGlvbiB0byBkZWNvZGUgZGF0YSBzdHJlYW0gd2l0aCBpZCB0byBUeXBlZEFycmF5IG9mIGFwcHJvcHJpYXRlIHR5cGVcbiAgICBjb25zdCBleHRyYWN0RHJhY29BdHRyaWJ1dGVJbmZvID0gZnVuY3Rpb24gKHVuaXF1ZUlkLCBzZW1hbnRpYykge1xuICAgICAgICBjb25zdCBhdHRyaWJ1dGUgPSBkZWNvZGVyLkdldEF0dHJpYnV0ZUJ5VW5pcXVlSWQob3V0cHV0R2VvbWV0cnksIHVuaXF1ZUlkKTtcbiAgICAgICAgY29uc3QgbnVtVmFsdWVzID0gbnVtUG9pbnRzICogYXR0cmlidXRlLm51bV9jb21wb25lbnRzKCk7XG4gICAgICAgIGNvbnN0IGRyYWNvRm9ybWF0ID0gYXR0cmlidXRlLmRhdGFfdHlwZSgpO1xuICAgICAgICBsZXQgcHRyLCB2YWx1ZXMsIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBzdG9yYWdlVHlwZTtcblxuICAgICAgICAvLyBzdG9yYWdlIGZvcm1hdCBpcyBiYXNlZCBvbiBkcmFjbyBhdHRyaWJ1dGUgZGF0YSB0eXBlXG4gICAgICAgIHN3aXRjaCAoZHJhY29Gb3JtYXQpIHtcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX1VJTlQ4OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9VSU5UODtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRTaXplSW5CeXRlcyA9IDE7XG4gICAgICAgICAgICAgICAgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzKTtcbiAgICAgICAgICAgICAgICBkZWNvZGVyLkdldEF0dHJpYnV0ZURhdGFBcnJheUZvckFsbFBvaW50cyhvdXRwdXRHZW9tZXRyeSwgYXR0cmlidXRlLCBkZWNvZGVyTW9kdWxlLkRUX1VJTlQ4LCBudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcywgcHRyKTtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBuZXcgVWludDhBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVOC5idWZmZXIsIHB0ciwgbnVtVmFsdWVzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuRFRfVUlOVDE2OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9VSU5UMTY7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50U2l6ZUluQnl0ZXMgPSAyO1xuICAgICAgICAgICAgICAgIHB0ciA9IGRlY29kZXJNb2R1bGUuX21hbGxvYyhudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcyk7XG4gICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMob3V0cHV0R2VvbWV0cnksIGF0dHJpYnV0ZSwgZGVjb2Rlck1vZHVsZS5EVF9VSU5UMTYsIG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBwdHIpO1xuICAgICAgICAgICAgICAgIHZhbHVlcyA9IG5ldyBVaW50MTZBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMTYuYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX0ZMT0FUMzI6XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzID0gNDtcbiAgICAgICAgICAgICAgICBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MobnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMpO1xuICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0QXR0cmlidXRlRGF0YUFycmF5Rm9yQWxsUG9pbnRzKG91dHB1dEdlb21ldHJ5LCBhdHRyaWJ1dGUsIGRlY29kZXJNb2R1bGUuRFRfRkxPQVQzMiwgbnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMsIHB0cik7XG4gICAgICAgICAgICAgICAgdmFsdWVzID0gbmV3IEZsb2F0MzJBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBGMzIuYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGRlY29kZXJNb2R1bGUuX2ZyZWUocHRyKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWVzOiB2YWx1ZXMsXG4gICAgICAgICAgICBudW1Db21wb25lbnRzOiBhdHRyaWJ1dGUubnVtX2NvbXBvbmVudHMoKSxcbiAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzOiBjb21wb25lbnRTaXplSW5CeXRlcyxcbiAgICAgICAgICAgIHN0b3JhZ2VUeXBlOiBzdG9yYWdlVHlwZSxcblxuICAgICAgICAgICAgLy8gdGhlcmUgYXJlIGdsYiBmaWxlcyBhcm91bmQgd2hlcmUgOGJpdCBjb2xvcnMgYXJlIG1pc3Npbmcgbm9ybWFsaXplZCBmbGFnXG4gICAgICAgICAgICBub3JtYWxpemVkOiAoc2VtYW50aWMgPT09IFNFTUFOVElDX0NPTE9SICYmIHN0b3JhZ2VUeXBlID09PSBUWVBFX1VJTlQ4KSA/IHRydWUgOiBhdHRyaWJ1dGUubm9ybWFsaXplZCgpXG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIC8vIGJ1aWxkIHZlcnRleCBidWZmZXIgZm9ybWF0IGRlc2MgYW5kIHNvdXJjZVxuICAgIGNvbnN0IHNvdXJjZURlc2MgPSB7fTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzID0gZXh0RHJhY28uYXR0cmlidXRlcztcbiAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHJpYikgJiYgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAuaGFzT3duUHJvcGVydHkoYXR0cmliKSkge1xuICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFthdHRyaWJdO1xuICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlSW5mbyA9IGV4dHJhY3REcmFjb0F0dHJpYnV0ZUluZm8oYXR0cmlidXRlc1thdHRyaWJdLCBzZW1hbnRpYyk7XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBpbmZvIHdlJ2xsIG5lZWQgdG8gY29weSB0aGlzIGRhdGEgaW50byB0aGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGF0dHJpYnV0ZUluZm8ubnVtQ29tcG9uZW50cyAqIGF0dHJpYnV0ZUluZm8uY29tcG9uZW50U2l6ZUluQnl0ZXM7XG4gICAgICAgICAgICBzb3VyY2VEZXNjW3NlbWFudGljXSA9IHtcbiAgICAgICAgICAgICAgICB2YWx1ZXM6IGF0dHJpYnV0ZUluZm8udmFsdWVzLFxuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYXR0cmlidXRlSW5mby52YWx1ZXMuYnVmZmVyLFxuICAgICAgICAgICAgICAgIHNpemU6IHNpemUsXG4gICAgICAgICAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICAgICAgICAgIHN0cmlkZTogc2l6ZSxcbiAgICAgICAgICAgICAgICBjb3VudDogbnVtUG9pbnRzLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGF0dHJpYnV0ZUluZm8ubnVtQ29tcG9uZW50cyxcbiAgICAgICAgICAgICAgICB0eXBlOiBhdHRyaWJ1dGVJbmZvLnN0b3JhZ2VUeXBlLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZTogYXR0cmlidXRlSW5mby5ub3JtYWxpemVkXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFscyBpZiB0aGV5J3JlIG1pc3NpbmcgKHRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIGEgdXNlciBvcHRpb24pXG4gICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgZ2VuZXJhdGVOb3JtYWxzKHNvdXJjZURlc2MsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbn07XG5cbmNvbnN0IGNyZWF0ZVNraW4gPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmU2tpbiwgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsYlNraW5zKSB7XG4gICAgbGV0IGksIGosIGJpbmRNYXRyaXg7XG4gICAgY29uc3Qgam9pbnRzID0gZ2x0ZlNraW4uam9pbnRzO1xuICAgIGNvbnN0IG51bUpvaW50cyA9IGpvaW50cy5sZW5ndGg7XG4gICAgY29uc3QgaWJwID0gW107XG4gICAgaWYgKGdsdGZTa2luLmhhc093blByb3BlcnR5KCdpbnZlcnNlQmluZE1hdHJpY2VzJykpIHtcbiAgICAgICAgY29uc3QgaW52ZXJzZUJpbmRNYXRyaWNlcyA9IGdsdGZTa2luLmludmVyc2VCaW5kTWF0cmljZXM7XG4gICAgICAgIGNvbnN0IGlibURhdGEgPSBnZXRBY2Nlc3NvckRhdGEoYWNjZXNzb3JzW2ludmVyc2VCaW5kTWF0cmljZXNdLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IGlibVZhbHVlcyA9IFtdO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBudW1Kb2ludHM7IGkrKykge1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IDE2OyBqKyspIHtcbiAgICAgICAgICAgICAgICBpYm1WYWx1ZXNbal0gPSBpYm1EYXRhW2kgKiAxNiArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYmluZE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgICAgICBiaW5kTWF0cml4LnNldChpYm1WYWx1ZXMpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGJpbmRNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBib25lTmFtZXMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgYm9uZU5hbWVzW2ldID0gbm9kZXNbam9pbnRzW2ldXS5uYW1lO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZSBhIGNhY2hlIGtleSBmcm9tIGJvbmUgbmFtZXMgYW5kIHNlZSBpZiB3ZSBoYXZlIG1hdGNoaW5nIHNraW5cbiAgICBjb25zdCBrZXkgPSBib25lTmFtZXMuam9pbignIycpO1xuICAgIGxldCBza2luID0gZ2xiU2tpbnMuZ2V0KGtleSk7XG4gICAgaWYgKCFza2luKSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSBza2luIGFuZCBhZGQgaXQgdG8gdGhlIGNhY2hlXG4gICAgICAgIHNraW4gPSBuZXcgU2tpbihkZXZpY2UsIGlicCwgYm9uZU5hbWVzKTtcbiAgICAgICAgZ2xiU2tpbnMuc2V0KGtleSwgc2tpbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNraW47XG59O1xuXG5jb25zdCB0ZW1wTWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRlbXBWZWMgPSBuZXcgVmVjMygpO1xuXG5jb25zdCBjcmVhdGVNZXNoID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0Zk1lc2gsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscykge1xuICAgIGNvbnN0IG1lc2hlcyA9IFtdO1xuXG4gICAgZ2x0Zk1lc2gucHJpbWl0aXZlcy5mb3JFYWNoKGZ1bmN0aW9uIChwcmltaXRpdmUpIHtcblxuICAgICAgICBsZXQgcHJpbWl0aXZlVHlwZSwgdmVydGV4QnVmZmVyLCBudW1JbmRpY2VzO1xuICAgICAgICBsZXQgaW5kaWNlcyA9IG51bGw7XG4gICAgICAgIGxldCBjYW5Vc2VNb3JwaCA9IHRydWU7XG5cbiAgICAgICAgLy8gdHJ5IGFuZCBnZXQgZHJhY28gY29tcHJlc3NlZCBkYXRhIGZpcnN0XG4gICAgICAgIGlmIChwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSkge1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9ucyA9IHByaW1pdGl2ZS5leHRlbnNpb25zO1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uJykpIHtcblxuICAgICAgICAgICAgICAgIC8vIGFjY2VzcyBEcmFjb0RlY29kZXJNb2R1bGVcbiAgICAgICAgICAgICAgICBjb25zdCBkZWNvZGVyTW9kdWxlID0gZHJhY29EZWNvZGVySW5zdGFuY2UgfHwgZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlKCk7XG4gICAgICAgICAgICAgICAgaWYgKGRlY29kZXJNb2R1bGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0RHJhY28gPSBleHRlbnNpb25zLktIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0RHJhY28uaGFzT3duUHJvcGVydHkoJ2F0dHJpYnV0ZXMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdWludDhCdWZmZXIgPSBidWZmZXJWaWV3c1tleHREcmFjby5idWZmZXJWaWV3XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBkZWNvZGVyTW9kdWxlLkRlY29kZXJCdWZmZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5Jbml0KHVpbnQ4QnVmZmVyLCB1aW50OEJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWNvZGVyID0gbmV3IGRlY29kZXJNb2R1bGUuRGVjb2RlcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2VvbWV0cnlUeXBlID0gZGVjb2Rlci5HZXRFbmNvZGVkR2VvbWV0cnlUeXBlKGJ1ZmZlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBvdXRwdXRHZW9tZXRyeSwgc3RhdHVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChnZW9tZXRyeVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuUE9JTlRfQ0xPVUQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW1pdGl2ZVR5cGUgPSBQUklNSVRJVkVfUE9JTlRTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRHZW9tZXRyeSA9IG5ldyBkZWNvZGVyTW9kdWxlLlBvaW50Q2xvdWQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzID0gZGVjb2Rlci5EZWNvZGVCdWZmZXJUb1BvaW50Q2xvdWQoYnVmZmVyLCBvdXRwdXRHZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5UUklBTkdVTEFSX01FU0g6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW1pdGl2ZVR5cGUgPSBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRHZW9tZXRyeSA9IG5ldyBkZWNvZGVyTW9kdWxlLk1lc2goKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzID0gZGVjb2Rlci5EZWNvZGVCdWZmZXJUb01lc2goYnVmZmVyLCBvdXRwdXRHZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5JTlZBTElEX0dFT01FVFJZX1RZUEU6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc3RhdHVzIHx8ICFzdGF0dXMub2soKSB8fCBvdXRwdXRHZW9tZXRyeS5wdHIgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygnRmFpbGVkIHRvIGRlY29kZSBkcmFjbyBjb21wcmVzc2VkIGFzc2V0OiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoc3RhdHVzID8gc3RhdHVzLmVycm9yX21zZygpIDogKCdNZXNoIGFzc2V0IC0gaW52YWxpZCBkcmFjbyBjb21wcmVzc2VkIGdlb21ldHJ5IHR5cGU6ICcgKyBnZW9tZXRyeVR5cGUpKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpbmRpY2VzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBudW1GYWNlcyA9IG91dHB1dEdlb21ldHJ5Lm51bV9mYWNlcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdlb21ldHJ5VHlwZSA9PT0gZGVjb2Rlck1vZHVsZS5UUklBTkdVTEFSX01FU0gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiaXQzMiA9IG91dHB1dEdlb21ldHJ5Lm51bV9wb2ludHMoKSA+IDY1NTM1O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtSW5kaWNlcyA9IG51bUZhY2VzICogMztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhU2l6ZSA9IG51bUluZGljZXMgKiAoYml0MzIgPyA0IDogMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKGRhdGFTaXplKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiaXQzMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyLkdldFRyaWFuZ2xlc1VJbnQzMkFycmF5KG91dHB1dEdlb21ldHJ5LCBkYXRhU2l6ZSwgcHRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MzJBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMzIuYnVmZmVyLCBwdHIsIG51bUluZGljZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRUcmlhbmdsZXNVSW50MTZBcnJheShvdXRwdXRHZW9tZXRyeSwgZGF0YVNpemUsIHB0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGljZXMgPSBuZXcgVWludDE2QXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQVTE2LmJ1ZmZlciwgcHRyLCBudW1JbmRpY2VzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXJNb2R1bGUuX2ZyZWUocHRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmVydGljZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcnRleEJ1ZmZlciA9IGNyZWF0ZVZlcnRleEJ1ZmZlckRyYWNvKGRldmljZSwgb3V0cHV0R2VvbWV0cnksIGV4dERyYWNvLCBkZWNvZGVyLCBkZWNvZGVyTW9kdWxlLCBpbmRpY2VzLCBmbGlwVik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNsZWFuIHVwXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLmRlc3Ryb3kob3V0cHV0R2VvbWV0cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5kZXN0cm95KGRlY29kZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5kZXN0cm95KGJ1ZmZlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1vcnBoIHN0cmVhbXMgYXJlIG5vdCBjb21wYXRpYmxlIHdpdGggZHJhY28gY29tcHJlc3Npb24sIGRpc2FibGUgbW9ycGhpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhblVzZU1vcnBoID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdGaWxlIGNvbnRhaW5zIGRyYWNvIGNvbXByZXNzZWQgZGF0YSwgYnV0IERyYWNvRGVjb2Rlck1vZHVsZSBpcyBub3QgY29uZmlndXJlZC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBtZXNoIHdhcyBub3QgY29uc3RydWN0ZWQgZnJvbSBkcmFjbyBkYXRhLCB1c2UgdW5jb21wcmVzc2VkXG4gICAgICAgIGlmICghdmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICBpbmRpY2VzID0gcHJpbWl0aXZlLmhhc093blByb3BlcnR5KCdpbmRpY2VzJykgPyBnZXRBY2Nlc3NvckRhdGEoYWNjZXNzb3JzW3ByaW1pdGl2ZS5pbmRpY2VzXSwgYnVmZmVyVmlld3MsIHRydWUpIDogbnVsbDtcbiAgICAgICAgICAgIHZlcnRleEJ1ZmZlciA9IGNyZWF0ZVZlcnRleEJ1ZmZlcihkZXZpY2UsIHByaW1pdGl2ZS5hdHRyaWJ1dGVzLCBpbmRpY2VzLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCk7XG4gICAgICAgICAgICBwcmltaXRpdmVUeXBlID0gZ2V0UHJpbWl0aXZlVHlwZShwcmltaXRpdmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG1lc2ggPSBudWxsO1xuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBidWlsZCB0aGUgbWVzaFxuICAgICAgICAgICAgbWVzaCA9IG5ldyBNZXNoKGRldmljZSk7XG4gICAgICAgICAgICBtZXNoLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLnR5cGUgPSBwcmltaXRpdmVUeXBlO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uYmFzZSA9IDA7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkID0gKGluZGljZXMgIT09IG51bGwpO1xuXG4gICAgICAgICAgICAvLyBpbmRleCBidWZmZXJcbiAgICAgICAgICAgIGlmIChpbmRpY2VzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbGV0IGluZGV4Rm9ybWF0O1xuICAgICAgICAgICAgICAgIGlmIChpbmRpY2VzIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQ4O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5kaWNlcyBpbnN0YW5jZW9mIFVpbnQxNkFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDMyO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIDMyYml0IGluZGV4IGJ1ZmZlciBpcyB1c2VkIGJ1dCBub3Qgc3VwcG9ydGVkXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4Rm9ybWF0ID09PSBJTkRFWEZPUk1BVF9VSU5UMzIgJiYgIWRldmljZS5leHRVaW50RWxlbWVudCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcyA+IDB4RkZGRikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdHbGIgZmlsZSBjb250YWlucyAzMmJpdCBpbmRleCBidWZmZXIgYnV0IHRoZXNlIGFyZSBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgZGV2aWNlIC0gaXQgbWF5IGJlIHJlbmRlcmVkIGluY29ycmVjdGx5LicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgdG8gMTZiaXRcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMTY7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMgPSBuZXcgVWludDE2QXJyYXkoaW5kaWNlcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIoZGV2aWNlLCBpbmRleEZvcm1hdCwgaW5kaWNlcy5sZW5ndGgsIEJVRkZFUl9TVEFUSUMsIGluZGljZXMpO1xuICAgICAgICAgICAgICAgIG1lc2guaW5kZXhCdWZmZXJbMF0gPSBpbmRleEJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IGluZGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eShcImV4dGVuc2lvbnNcIikgJiYgcHJpbWl0aXZlLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudHMgPSBwcmltaXRpdmUuZXh0ZW5zaW9ucy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBNYXBwaW5nID0ge307XG4gICAgICAgICAgICAgICAgdmFyaWFudHMubWFwcGluZ3MuZm9yRWFjaCgobWFwcGluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLnZhcmlhbnRzLmZvckVhY2goKHZhcmlhbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBNYXBwaW5nW3ZhcmlhbnRdID0gbWFwcGluZy5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbWVzaFZhcmlhbnRzW21lc2guaWRdID0gdGVtcE1hcHBpbmc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1lc2hEZWZhdWx0TWF0ZXJpYWxzW21lc2guaWRdID0gcHJpbWl0aXZlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICBsZXQgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbcHJpbWl0aXZlLmF0dHJpYnV0ZXMuUE9TSVRJT05dO1xuICAgICAgICAgICAgbWVzaC5hYWJiID0gZ2V0QWNjZXNzb3JCb3VuZGluZ0JveChhY2Nlc3Nvcik7XG5cbiAgICAgICAgICAgIC8vIG1vcnBoIHRhcmdldHNcbiAgICAgICAgICAgIGlmIChjYW5Vc2VNb3JwaCAmJiBwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ3RhcmdldHMnKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHByaW1pdGl2ZS50YXJnZXRzLmZvckVhY2goZnVuY3Rpb24gKHRhcmdldCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHt9O1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ1BPU0lUSU9OJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2Vzc29yID0gYWNjZXNzb3JzW3RhcmdldC5QT1NJVElPTl07XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhUG9zaXRpb25zID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YVBvc2l0aW9uc1R5cGUgPSBUWVBFX0ZMT0FUMzI7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmFhYmIgPSBnZXRBY2Nlc3NvckJvdW5kaW5nQm94KGFjY2Vzc29yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ05PUk1BTCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2Nlc3NvciA9IGFjY2Vzc29yc1t0YXJnZXQuTk9STUFMXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IHRoZSBtb3JwaCB0YXJnZXRzIGNhbid0IGN1cnJlbnRseSBhY2NlcHQgcXVhbnRpemVkIG5vcm1hbHNcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFOb3JtYWxzID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YU5vcm1hbHNUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbmFtZSBpZiBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZNZXNoLmhhc093blByb3BlcnR5KCdleHRyYXMnKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgZ2x0Zk1lc2guZXh0cmFzLmhhc093blByb3BlcnR5KCd0YXJnZXROYW1lcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLm5hbWUgPSBnbHRmTWVzaC5leHRyYXMudGFyZ2V0TmFtZXNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uYW1lID0gaW5kZXgudG9TdHJpbmcoMTApO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCB3ZWlnaHQgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTWVzaC5oYXNPd25Qcm9wZXJ0eSgnd2VpZ2h0cycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlZmF1bHRXZWlnaHQgPSBnbHRmTWVzaC53ZWlnaHRzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldHMucHVzaChuZXcgTW9ycGhUYXJnZXQob3B0aW9ucykpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgbWVzaC5tb3JwaCA9IG5ldyBNb3JwaCh0YXJnZXRzLCBkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbWVzaGVzLnB1c2gobWVzaCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWVzaGVzO1xufTtcblxuY29uc3QgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0gPSBmdW5jdGlvbiAoc291cmNlLCBtYXRlcmlhbCwgbWFwcykge1xuICAgIGxldCBtYXA7XG5cbiAgICBjb25zdCB0ZXhDb29yZCA9IHNvdXJjZS50ZXhDb29yZDtcbiAgICBpZiAodGV4Q29vcmQpIHtcbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW21hcHNbbWFwXSArICdNYXBVdiddID0gdGV4Q29vcmQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB6ZXJvcyA9IFswLCAwXTtcbiAgICBjb25zdCBvbmVzID0gWzEsIDFdO1xuICAgIGNvbnN0IHRleHR1cmVUcmFuc2Zvcm0gPSBzb3VyY2UuZXh0ZW5zaW9ucz8uS0hSX3RleHR1cmVfdHJhbnNmb3JtO1xuICAgIGlmICh0ZXh0dXJlVHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IHRleHR1cmVUcmFuc2Zvcm0ub2Zmc2V0IHx8IHplcm9zO1xuICAgICAgICBjb25zdCBzY2FsZSA9IHRleHR1cmVUcmFuc2Zvcm0uc2NhbGUgfHwgb25lcztcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSB0ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uID8gKC10ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uICogbWF0aC5SQURfVE9fREVHKSA6IDA7XG5cbiAgICAgICAgY29uc3QgdGlsaW5nVmVjID0gbmV3IFZlYzIoc2NhbGVbMF0sIHNjYWxlWzFdKTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0VmVjID0gbmV3IFZlYzIob2Zmc2V0WzBdLCAxLjAgLSBzY2FsZVsxXSAtIG9mZnNldFsxXSk7XG5cbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBUaWxpbmdgXSA9IHRpbGluZ1ZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBPZmZzZXRgXSA9IG9mZnNldFZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBSb3RhdGlvbmBdID0gcm90YXRpb247XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBsZXQgY29sb3IsIHRleHR1cmU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2RpZmZ1c2VGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuZGlmZnVzZUZhY3RvcjtcbiAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gY29sb3JbM107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZGlmZnVzZVRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBkaWZmdXNlVGV4dHVyZSA9IGRhdGEuZGlmZnVzZVRleHR1cmU7XG4gICAgICAgIHRleHR1cmUgPSB0ZXh0dXJlc1tkaWZmdXNlVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IHRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkaWZmdXNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZGlmZnVzZScsICdvcGFjaXR5J10pO1xuICAgIH1cbiAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3MgPSBmYWxzZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZ2xvc3NpbmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoaW5pbmVzcyA9IDEwMCAqIGRhdGEuZ2xvc3NpbmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zaGluaW5lc3MgPSAxMDA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZSA9IGRhdGEuc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJFbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSBtYXRlcmlhbC5nbG9zc01hcCA9IHRleHR1cmVzW3NwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgbWF0ZXJpYWwuZ2xvc3NNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKHNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2dsb3NzJywgJ21ldGFsbmVzcyddKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25DbGVhckNvYXQgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdEZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdCA9IGRhdGEuY2xlYXJjb2F0RmFjdG9yICogMC4yNTsgLy8gVE9ETzogcmVtb3ZlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciByZXBsaWNhdGluZyBnbFRGIGNsZWFyLWNvYXQgdmlzdWFsc1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdCA9IDA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgY2xlYXJjb2F0VGV4dHVyZSA9IGRhdGEuY2xlYXJjb2F0VGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0TWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0VGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdE1hcENoYW5uZWwgPSAncic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0VGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0J10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NpbmVzcyA9IGRhdGEuY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzaW5lc3MgPSAwO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUgPSBkYXRhLmNsZWFyY29hdFJvdWdobmVzc1RleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwQ2hhbm5lbCA9ICdnJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXRHbG9zcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdE5vcm1hbFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXROb3JtYWxUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXROb3JtYWxUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXROb3JtYWxNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXROb3JtYWxUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXROb3JtYWxUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXROb3JtYWwnXSk7XG5cbiAgICAgICAgaWYgKGNsZWFyY29hdE5vcm1hbFRleHR1cmUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEJ1bXBpbmVzcyA9IGNsZWFyY29hdE5vcm1hbFRleHR1cmUuc2NhbGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjbGVhckNvYXRHbG9zc0NodW5rID0gLyogZ2xzbCAqL2BcbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgIHVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfY2xlYXJDb2F0R2xvc3NpbmVzcztcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgICAgICB1bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX2NsZWFyQ29hdEdsb3NzTWFwO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgIHZvaWQgZ2V0Q2xlYXJDb2F0R2xvc3NpbmVzcygpIHtcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyA9IDEuMDtcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBGTE9BVFxuICAgICAgICAgICAgY2NHbG9zc2luZXNzICo9IG1hdGVyaWFsX2NsZWFyQ29hdEdsb3NzaW5lc3M7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyAqPSB0ZXh0dXJlMkRCaWFzKHRleHR1cmVfY2xlYXJDb2F0R2xvc3NNYXAsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgKj0gc2F0dXJhdGUodlZlcnRleENvbG9yLiRWQyk7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyA9IDEuMCAtIGNjR2xvc3NpbmVzcztcbiAgICAgICAgXG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgKz0gMC4wMDAwMDAxO1xuICAgICAgICB9XG4gICAgICAgIGA7XG4gICAgbWF0ZXJpYWwuY2h1bmtzLmNsZWFyQ29hdEdsb3NzUFMgPSBjbGVhckNvYXRHbG9zc0NodW5rO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uVW5saXQgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwudXNlTGlnaHRpbmcgPSBmYWxzZTtcblxuICAgIC8vIGNvcHkgZGlmZnVzZSBpbnRvIGVtaXNzaXZlXG4gICAgbWF0ZXJpYWwuZW1pc3NpdmUuY29weShtYXRlcmlhbC5kaWZmdXNlKTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSBtYXRlcmlhbC5kaWZmdXNlVGludDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcCA9IG1hdGVyaWFsLmRpZmZ1c2VNYXA7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBVdiA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBVdjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFRpbGluZy5jb3B5KG1hdGVyaWFsLmRpZmZ1c2VNYXBUaWxpbmcpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwT2Zmc2V0LmNvcHkobWF0ZXJpYWwuZGlmZnVzZU1hcE9mZnNldCk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBSb3RhdGlvbiA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBSb3RhdGlvbjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcENoYW5uZWwgPSBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVZlcnRleENvbG9yID0gbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVmVydGV4Q29sb3JDaGFubmVsID0gbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yQ2hhbm5lbDtcblxuICAgIC8vIGJsYW5rIGRpZmZ1c2VcbiAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgwLCAwLCAwKTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVGludCA9IGZhbHNlO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSBudWxsO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvciA9IGZhbHNlO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uU3BlY3VsYXIgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJFbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSB0ZXh0dXJlc1tkYXRhLnNwZWN1bGFyQ29sb3JUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXBDaGFubmVsID0gJ3JnYic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhckNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc3BlY3VsYXInXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JGYWN0b3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuc3BlY3VsYXJDb2xvckZhY3RvcjtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3RvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3IgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3JNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3Rvck1hcCA9IHRleHR1cmVzW2RhdGEuc3BlY3VsYXJUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NwZWN1bGFyaXR5RmFjdG9yJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklvciA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbkluZGV4ID0gMS4wIC8gZGF0YS5pb3I7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uVHJhbnNtaXNzaW9uID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICBtYXRlcmlhbC51c2VEeW5hbWljUmVmcmFjdGlvbiA9IHRydWU7XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbiA9IGRhdGEudHJhbnNtaXNzaW9uRmFjdG9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25NYXBDaGFubmVsID0gJ3InO1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uTWFwID0gdGV4dHVyZXNbZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLCBtYXRlcmlhbCwgWydyZWZyYWN0aW9uJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvblNoZWVuID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZVNoZWVuID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvckZhY3RvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5zaGVlbkNvbG9yRmFjdG9yO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW4uc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbk1hcCA9IHRleHR1cmVzW2RhdGEuc2hlZW5Db2xvclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNoZWVuQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydzaGVlbiddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zc2luZXNzID0gZGF0YS5zaGVlblJvdWdobmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzaW5lc3MgPSAwLjA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlblJvdWdobmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzaW5lc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnNoZWVuUm91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NpbmVzc01hcENoYW5uZWwgPSAnYSc7XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc2hlZW5Sb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydzaGVlbkdsb3NzaW5lc3MnXSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2hlZW5HbG9zc0NodW5rID0gYFxuICAgICNpZmRlZiBNQVBGTE9BVFxuICAgIHVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfc2hlZW5HbG9zc2luZXNzO1xuICAgICNlbmRpZlxuXG4gICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICB1bmlmb3JtIHNhbXBsZXIyRCB0ZXh0dXJlX3NoZWVuR2xvc3NpbmVzc01hcDtcbiAgICAjZW5kaWZcblxuICAgIHZvaWQgZ2V0U2hlZW5HbG9zc2luZXNzKCkge1xuICAgICAgICBmbG9hdCBzaGVlbkdsb3NzaW5lc3MgPSAxLjA7XG5cbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgIHNoZWVuR2xvc3NpbmVzcyAqPSBtYXRlcmlhbF9zaGVlbkdsb3NzaW5lc3M7XG4gICAgICAgICNlbmRpZlxuXG4gICAgICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgICAgIHNoZWVuR2xvc3NpbmVzcyAqPSB0ZXh0dXJlMkRCaWFzKHRleHR1cmVfc2hlZW5HbG9zc2luZXNzTWFwLCAkVVYsIHRleHR1cmVCaWFzKS4kQ0g7XG4gICAgICAgICNlbmRpZlxuXG4gICAgICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICAgICAgc2hlZW5HbG9zc2luZXNzICo9IHNhdHVyYXRlKHZWZXJ0ZXhDb2xvci4kVkMpO1xuICAgICAgICAjZW5kaWZcblxuICAgICAgICBzaGVlbkdsb3NzaW5lc3MgPSAxLjAgLSBzaGVlbkdsb3NzaW5lc3M7XG4gICAgICAgIHNoZWVuR2xvc3NpbmVzcyArPSAwLjAwMDAwMDE7XG4gICAgICAgIHNHbG9zc2luZXNzID0gc2hlZW5HbG9zc2luZXNzO1xuICAgIH1cbiAgICBgO1xuICAgIG1hdGVyaWFsLmNodW5rcy5zaGVlbkdsb3NzUFMgPSBzaGVlbkdsb3NzQ2h1bms7XG59O1xuXG5jb25zdCBleHRlbnNpb25Wb2x1bWUgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9STUFMO1xuICAgIG1hdGVyaWFsLnVzZUR5bmFtaWNSZWZyYWN0aW9uID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndGhpY2tuZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwudGhpY2tuZXNzID0gZGF0YS50aGlja25lc3NGYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0aGlja25lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwudGhpY2tuZXNzTWFwID0gdGV4dHVyZXNbZGF0YS50aGlja25lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS50aGlja25lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWyd0aGlja25lc3MnXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdhdHRlbnVhdGlvbkRpc3RhbmNlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuYXR0ZW51YXRpb25EaXN0YW5jZSA9IGRhdGEuYXR0ZW51YXRpb25EaXN0YW5jZTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2F0dGVudWF0aW9uQ29sb3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuYXR0ZW51YXRpb25Db2xvcjtcbiAgICAgICAgbWF0ZXJpYWwuYXR0ZW51YXRpb24uc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbkVtaXNzaXZlU3RyZW5ndGggPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlU3RyZW5ndGgnKSkge1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZUludGVuc2l0eSA9IGRhdGEuZW1pc3NpdmVTdHJlbmd0aDtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25JcmlkZXNjZW5zZSA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICAvL2RpZiBcbn1cblxuY29uc3QgY3JlYXRlTWF0ZXJpYWwgPSBmdW5jdGlvbiAoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpIHtcbiAgICAvLyBUT0RPOiBpbnRlZ3JhdGUgdGhlc2Ugc2hhZGVyIGNodW5rcyBpbnRvIHRoZSBuYXRpdmUgZW5naW5lXG4gICAgY29uc3QgZ2xvc3NDaHVuayA9IGBcbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgIHVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfc2hpbmluZXNzO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgICAgIHVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfZ2xvc3NNYXA7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgdm9pZCBnZXRHbG9zc2luZXNzKCkge1xuICAgICAgICAgICAgZEdsb3NzaW5lc3MgPSAxLjA7XG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICAgICAgICAgIGRHbG9zc2luZXNzICo9IG1hdGVyaWFsX3NoaW5pbmVzcztcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgICAgICAgICAgZEdsb3NzaW5lc3MgKj0gdGV4dHVyZTJEQmlhcyh0ZXh0dXJlX2dsb3NzTWFwLCAkVVYsIHRleHR1cmVCaWFzKS4kQ0g7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUFZFUlRFWFxuICAgICAgICAgICAgZEdsb3NzaW5lc3MgKj0gc2F0dXJhdGUodlZlcnRleENvbG9yLiRWQyk7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgICAgIGRHbG9zc2luZXNzID0gMS4wIC0gZEdsb3NzaW5lc3M7XG4gICAgICAgIFxuICAgICAgICAgICAgZEdsb3NzaW5lc3MgKz0gMC4wMDAwMDAxO1xuICAgICAgICB9XG4gICAgICAgIGA7XG5cblxuICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFN0YW5kYXJkTWF0ZXJpYWwoKTtcblxuICAgIC8vIGdsVEYgZG9lc24ndCBkZWZpbmUgaG93IHRvIG9jY2x1ZGUgc3BlY3VsYXJcbiAgICBtYXRlcmlhbC5vY2NsdWRlU3BlY3VsYXIgPSBTUEVDT0NDX0FPO1xuXG4gICAgbWF0ZXJpYWwuZGlmZnVzZVRpbnQgPSB0cnVlO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvciA9IHRydWU7XG5cbiAgICBtYXRlcmlhbC5zcGVjdWxhclRpbnQgPSB0cnVlO1xuICAgIG1hdGVyaWFsLnNwZWN1bGFyVmVydGV4Q29sb3IgPSB0cnVlO1xuXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSBnbHRmTWF0ZXJpYWwubmFtZTtcbiAgICB9XG5cbiAgICBsZXQgY29sb3IsIHRleHR1cmU7XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgncGJyTWV0YWxsaWNSb3VnaG5lc3MnKSkge1xuICAgICAgICBjb25zdCBwYnJEYXRhID0gZ2x0Zk1hdGVyaWFsLnBick1ldGFsbGljUm91Z2huZXNzO1xuXG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdiYXNlQ29sb3JGYWN0b3InKSkge1xuICAgICAgICAgICAgY29sb3IgPSBwYnJEYXRhLmJhc2VDb2xvckZhY3RvcjtcbiAgICAgICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gY29sb3JbM107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgxLCAxLCAxKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdiYXNlQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2VDb2xvclRleHR1cmUgPSBwYnJEYXRhLmJhc2VDb2xvclRleHR1cmU7XG4gICAgICAgICAgICB0ZXh0dXJlID0gdGV4dHVyZXNbYmFzZUNvbG9yVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSB0ZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWwgPSAnYSc7XG5cbiAgICAgICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGJhc2VDb2xvclRleHR1cmUsIG1hdGVyaWFsLCBbJ2RpZmZ1c2UnLCAnb3BhY2l0eSddKTtcbiAgICAgICAgfVxuICAgICAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3MgPSB0cnVlO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdtZXRhbGxpY0ZhY3RvcicpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3MgPSBwYnJEYXRhLm1ldGFsbGljRmFjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzID0gMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgncm91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNoaW5pbmVzcyA9IDEwMCAqIHBickRhdGEucm91Z2huZXNzRmFjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2hpbmluZXNzID0gMTAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUnKSkge1xuICAgICAgICAgICAgY29uc3QgbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlID0gcGJyRGF0YS5tZXRhbGxpY1JvdWdobmVzc1RleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3NNYXAgPSBtYXRlcmlhbC5nbG9zc01hcCA9IHRleHR1cmVzW21ldGFsbGljUm91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3NNYXBDaGFubmVsID0gJ2InO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZ2xvc3NNYXBDaGFubmVsID0gJ2cnO1xuXG4gICAgICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2dsb3NzJywgJ21ldGFsbmVzcyddKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1hdGVyaWFsLmNodW5rcy5nbG9zc1BTID0gZ2xvc3NDaHVuaztcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdub3JtYWxUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgbm9ybWFsVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5ub3JtYWxUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5ub3JtYWxNYXAgPSB0ZXh0dXJlc1tub3JtYWxUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShub3JtYWxUZXh0dXJlLCBtYXRlcmlhbCwgWydub3JtYWwnXSk7XG5cbiAgICAgICAgaWYgKG5vcm1hbFRleHR1cmUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmJ1bXBpbmVzcyA9IG5vcm1hbFRleHR1cmUuc2NhbGU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnb2NjbHVzaW9uVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IG9jY2x1c2lvblRleHR1cmUgPSBnbHRmTWF0ZXJpYWwub2NjbHVzaW9uVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuYW9NYXAgPSB0ZXh0dXJlc1tvY2NsdXNpb25UZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuYW9NYXBDaGFubmVsID0gJ3InO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG9jY2x1c2lvblRleHR1cmUsIG1hdGVyaWFsLCBbJ2FvJ10pO1xuICAgICAgICAvLyBUT0RPOiBzdXBwb3J0ICdzdHJlbmd0aCdcbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGdsdGZNYXRlcmlhbC5lbWlzc2l2ZUZhY3RvcjtcbiAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoMCwgMCwgMCk7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdlbWlzc2l2ZVRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBlbWlzc2l2ZVRleHR1cmUgPSBnbHRmTWF0ZXJpYWwuZW1pc3NpdmVUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcCA9IHRleHR1cmVzW2VtaXNzaXZlVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZW1pc3NpdmVUZXh0dXJlLCBtYXRlcmlhbCwgWydlbWlzc2l2ZSddKTtcbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnYWxwaGFNb2RlJykpIHtcbiAgICAgICAgc3dpdGNoIChnbHRmTWF0ZXJpYWwuYWxwaGFNb2RlKSB7XG4gICAgICAgICAgICBjYXNlICdNQVNLJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT05FO1xuICAgICAgICAgICAgICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2FscGhhQ3V0b2ZmJykpIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuYWxwaGFUZXN0ID0gZ2x0Zk1hdGVyaWFsLmFscGhhQ3V0b2ZmO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFscGhhVGVzdCA9IDAuNTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdCTEVORCc6XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9STUFMO1xuICAgICAgICAgICAgICAgIC8vIG5vdGU6IGJ5IGRlZmF1bHQgZG9uJ3Qgd3JpdGUgZGVwdGggb24gc2VtaXRyYW5zcGFyZW50IG1hdGVyaWFsc1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmRlcHRoV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBjYXNlICdPUEFRVUUnOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT05FO1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdkb3VibGVTaWRlZCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLnR3b1NpZGVkTGlnaHRpbmcgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQ7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQgPyBDVUxMRkFDRV9OT05FIDogQ1VMTEZBQ0VfQkFDSztcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC50d29TaWRlZExpZ2h0aW5nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9CQUNLO1xuICAgIH1cblxuICAgIC8vIFByb3ZpZGUgbGlzdCBvZiBzdXBwb3J0ZWQgZXh0ZW5zaW9ucyBhbmQgdGhlaXIgZnVuY3Rpb25zXG4gICAgY29uc3QgZXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2NsZWFyY29hdFwiOiBleHRlbnNpb25DbGVhckNvYXQsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19lbWlzc2l2ZV9zdHJlbmd0aFwiOiBleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfaW9yXCI6IGV4dGVuc2lvbklvcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3BiclNwZWN1bGFyR2xvc3NpbmVzc1wiOiBleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3NoZWVuXCI6IGV4dGVuc2lvblNoZWVuLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfc3BlY3VsYXJcIjogZXh0ZW5zaW9uU3BlY3VsYXIsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc190cmFuc21pc3Npb25cIjogZXh0ZW5zaW9uVHJhbnNtaXNzaW9uLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfdW5saXRcIjogZXh0ZW5zaW9uVW5saXQsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc192b2x1bWVcIjogZXh0ZW5zaW9uVm9sdW1lLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfaXJpZGVzY2Vuc2VcIjogZXh0ZW5zaW9uSXJpZGVzY2Vuc2VcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIGV4dGVuc2lvbnNcbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZ2x0Zk1hdGVyaWFsLmV4dGVuc2lvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbkZ1bmMgPSBleHRlbnNpb25zW2tleV07XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uRnVuYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZXh0ZW5zaW9uRnVuYyhnbHRmTWF0ZXJpYWwuZXh0ZW5zaW9uc1trZXldLCBtYXRlcmlhbCwgdGV4dHVyZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICByZXR1cm4gbWF0ZXJpYWw7XG59O1xuXG4vLyBjcmVhdGUgdGhlIGFuaW0gc3RydWN0dXJlXG5jb25zdCBjcmVhdGVBbmltYXRpb24gPSBmdW5jdGlvbiAoZ2x0ZkFuaW1hdGlvbiwgYW5pbWF0aW9uSW5kZXgsIGdsdGZBY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgbWVzaGVzKSB7XG5cbiAgICAvLyBjcmVhdGUgYW5pbWF0aW9uIGRhdGEgYmxvY2sgZm9yIHRoZSBhY2Nlc3NvclxuICAgIGNvbnN0IGNyZWF0ZUFuaW1EYXRhID0gZnVuY3Rpb24gKGdsdGZBY2Nlc3Nvcikge1xuICAgICAgICByZXR1cm4gbmV3IEFuaW1EYXRhKGdldE51bUNvbXBvbmVudHMoZ2x0ZkFjY2Vzc29yLnR5cGUpLCBnZXRBY2Nlc3NvckRhdGFGbG9hdDMyKGdsdGZBY2Nlc3NvciwgYnVmZmVyVmlld3MpKTtcbiAgICB9O1xuXG4gICAgY29uc3QgaW50ZXJwTWFwID0ge1xuICAgICAgICAnU1RFUCc6IElOVEVSUE9MQVRJT05fU1RFUCxcbiAgICAgICAgJ0xJTkVBUic6IElOVEVSUE9MQVRJT05fTElORUFSLFxuICAgICAgICAnQ1VCSUNTUExJTkUnOiBJTlRFUlBPTEFUSU9OX0NVQklDXG4gICAgfTtcblxuICAgIC8vIElucHV0IGFuZCBvdXRwdXQgbWFwcyByZWZlcmVuY2UgZGF0YSBieSBzYW1wbGVyIGlucHV0L291dHB1dCBrZXkuXG4gICAgY29uc3QgaW5wdXRNYXAgPSB7IH07XG4gICAgY29uc3Qgb3V0cHV0TWFwID0geyB9O1xuICAgIC8vIFRoZSBjdXJ2ZSBtYXAgc3RvcmVzIHRlbXBvcmFyeSBjdXJ2ZSBkYXRhIGJ5IHNhbXBsZXIgaW5kZXguIEVhY2ggY3VydmVzIGlucHV0L291dHB1dCB2YWx1ZSB3aWxsIGJlIHJlc29sdmVkIHRvIGFuIGlucHV0cy9vdXRwdXRzIGFycmF5IGluZGV4IGFmdGVyIGFsbCBzYW1wbGVycyBoYXZlIGJlZW4gcHJvY2Vzc2VkLlxuICAgIC8vIEN1cnZlcyBhbmQgb3V0cHV0cyB0aGF0IGFyZSBkZWxldGVkIGZyb20gdGhlaXIgbWFwcyB3aWxsIG5vdCBiZSBpbmNsdWRlZCBpbiB0aGUgZmluYWwgQW5pbVRyYWNrXG4gICAgY29uc3QgY3VydmVNYXAgPSB7IH07XG4gICAgbGV0IG91dHB1dENvdW50ZXIgPSAxO1xuXG4gICAgbGV0IGk7XG5cbiAgICAvLyBjb252ZXJ0IHNhbXBsZXJzXG4gICAgZm9yIChpID0gMDsgaSA8IGdsdGZBbmltYXRpb24uc2FtcGxlcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3Qgc2FtcGxlciA9IGdsdGZBbmltYXRpb24uc2FtcGxlcnNbaV07XG5cbiAgICAgICAgLy8gZ2V0IGlucHV0IGRhdGFcbiAgICAgICAgaWYgKCFpbnB1dE1hcC5oYXNPd25Qcm9wZXJ0eShzYW1wbGVyLmlucHV0KSkge1xuICAgICAgICAgICAgaW5wdXRNYXBbc2FtcGxlci5pbnB1dF0gPSBjcmVhdGVBbmltRGF0YShnbHRmQWNjZXNzb3JzW3NhbXBsZXIuaW5wdXRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGdldCBvdXRwdXQgZGF0YVxuICAgICAgICBpZiAoIW91dHB1dE1hcC5oYXNPd25Qcm9wZXJ0eShzYW1wbGVyLm91dHB1dCkpIHtcbiAgICAgICAgICAgIG91dHB1dE1hcFtzYW1wbGVyLm91dHB1dF0gPSBjcmVhdGVBbmltRGF0YShnbHRmQWNjZXNzb3JzW3NhbXBsZXIub3V0cHV0XSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnRlcnBvbGF0aW9uID1cbiAgICAgICAgICAgIHNhbXBsZXIuaGFzT3duUHJvcGVydHkoJ2ludGVycG9sYXRpb24nKSAmJlxuICAgICAgICAgICAgaW50ZXJwTWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIuaW50ZXJwb2xhdGlvbikgP1xuICAgICAgICAgICAgICAgIGludGVycE1hcFtzYW1wbGVyLmludGVycG9sYXRpb25dIDogSU5URVJQT0xBVElPTl9MSU5FQVI7XG5cbiAgICAgICAgLy8gY3JlYXRlIGN1cnZlXG4gICAgICAgIGNvbnN0IGN1cnZlID0ge1xuICAgICAgICAgICAgcGF0aHM6IFtdLFxuICAgICAgICAgICAgaW5wdXQ6IHNhbXBsZXIuaW5wdXQsXG4gICAgICAgICAgICBvdXRwdXQ6IHNhbXBsZXIub3V0cHV0LFxuICAgICAgICAgICAgaW50ZXJwb2xhdGlvbjogaW50ZXJwb2xhdGlvblxuICAgICAgICB9O1xuXG4gICAgICAgIGN1cnZlTWFwW2ldID0gY3VydmU7XG4gICAgfVxuXG4gICAgY29uc3QgcXVhdEFycmF5cyA9IFtdO1xuXG4gICAgY29uc3QgdHJhbnNmb3JtU2NoZW1hID0ge1xuICAgICAgICAndHJhbnNsYXRpb24nOiAnbG9jYWxQb3NpdGlvbicsXG4gICAgICAgICdyb3RhdGlvbic6ICdsb2NhbFJvdGF0aW9uJyxcbiAgICAgICAgJ3NjYWxlJzogJ2xvY2FsU2NhbGUnXG4gICAgfTtcblxuICAgIGNvbnN0IGNvbnN0cnVjdE5vZGVQYXRoID0gKG5vZGUpID0+IHtcbiAgICAgICAgY29uc3QgcGF0aCA9IFtdO1xuICAgICAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICAgICAgcGF0aC51bnNoaWZ0KG5vZGUubmFtZSk7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfTtcblxuICAgIGNvbnN0IHJldHJpZXZlV2VpZ2h0TmFtZSA9IChub2RlTmFtZSwgd2VpZ2h0SW5kZXgpID0+IHtcbiAgICAgICAgaWYgKCFtZXNoZXMpIHJldHVybiB3ZWlnaHRJbmRleDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoZXNbaV07XG4gICAgICAgICAgICBpZiAobWVzaC5uYW1lID09PSBub2RlTmFtZSAmJiBtZXNoLmhhc093blByb3BlcnR5KCdleHRyYXMnKSAmJiBtZXNoLmV4dHJhcy5oYXNPd25Qcm9wZXJ0eSgndGFyZ2V0TmFtZXMnKSAmJiBtZXNoLmV4dHJhcy50YXJnZXROYW1lc1t3ZWlnaHRJbmRleF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYG5hbWUuJHttZXNoLmV4dHJhcy50YXJnZXROYW1lc1t3ZWlnaHRJbmRleF19YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gd2VpZ2h0SW5kZXg7XG4gICAgfTtcblxuICAgIC8vIEFsbCBtb3JwaCB0YXJnZXRzIGFyZSBpbmNsdWRlZCBpbiBhIHNpbmdsZSBjaGFubmVsIG9mIHRoZSBhbmltYXRpb24sIHdpdGggYWxsIHRhcmdldHMgb3V0cHV0IGRhdGEgaW50ZXJsZWF2ZWQgd2l0aCBlYWNoIG90aGVyLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gc3BsaXRzIGVhY2ggbW9ycGggdGFyZ2V0IG91dCBpbnRvIGl0IGEgY3VydmUgd2l0aCBpdHMgb3duIG91dHB1dCBkYXRhLCBhbGxvd2luZyB1cyB0byBhbmltYXRlIGVhY2ggbW9ycGggdGFyZ2V0IGluZGVwZW5kZW50bHkgYnkgbmFtZS5cbiAgICBjb25zdCBjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyA9IChjdXJ2ZSwgbm9kZSwgZW50aXR5UGF0aCkgPT4ge1xuICAgICAgICBpZiAoIW91dHB1dE1hcFtjdXJ2ZS5vdXRwdXRdKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBnbGItcGFyc2VyOiBObyBvdXRwdXQgZGF0YSBpcyBhdmFpbGFibGUgZm9yIHRoZSBtb3JwaCB0YXJnZXQgY3VydmUgKCR7ZW50aXR5UGF0aH0vZ3JhcGgvd2VpZ2h0cykuIFNraXBwaW5nLmApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0Q291bnQgPSBvdXRwdXRNYXBbY3VydmUub3V0cHV0XS5kYXRhLmxlbmd0aCAvIGlucHV0TWFwW2N1cnZlLmlucHV0XS5kYXRhLmxlbmd0aDtcbiAgICAgICAgY29uc3Qga2V5ZnJhbWVDb3VudCA9IG91dHB1dE1hcFtjdXJ2ZS5vdXRwdXRdLmRhdGEubGVuZ3RoIC8gbW9ycGhUYXJnZXRDb3VudDtcblxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1vcnBoVGFyZ2V0Q291bnQ7IGorKykge1xuICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRPdXRwdXQgPSBuZXcgRmxvYXQzMkFycmF5KGtleWZyYW1lQ291bnQpO1xuICAgICAgICAgICAgLy8gdGhlIG91dHB1dCBkYXRhIGZvciBhbGwgbW9ycGggdGFyZ2V0cyBpbiBhIHNpbmdsZSBjdXJ2ZSBpcyBpbnRlcmxlYXZlZC4gV2UgbmVlZCB0byByZXRyaWV2ZSB0aGUga2V5ZnJhbWUgb3V0cHV0IGRhdGEgZm9yIGEgc2luZ2xlIG1vcnBoIHRhcmdldFxuICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBrZXlmcmFtZUNvdW50OyBrKyspIHtcbiAgICAgICAgICAgICAgICBtb3JwaFRhcmdldE91dHB1dFtrXSA9IG91dHB1dE1hcFtjdXJ2ZS5vdXRwdXRdLmRhdGFbayAqIG1vcnBoVGFyZ2V0Q291bnQgKyBqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG91dHB1dCA9IG5ldyBBbmltRGF0YSgxLCBtb3JwaFRhcmdldE91dHB1dCk7XG4gICAgICAgICAgICAvLyBhZGQgdGhlIGluZGl2aWR1YWwgbW9ycGggdGFyZ2V0IG91dHB1dCBkYXRhIHRvIHRoZSBvdXRwdXRNYXAgdXNpbmcgYSBuZWdhdGl2ZSB2YWx1ZSBrZXkgKHNvIGFzIG5vdCB0byBjbGFzaCB3aXRoIHNhbXBsZXIub3V0cHV0IHZhbHVlcylcbiAgICAgICAgICAgIG91dHB1dE1hcFstb3V0cHV0Q291bnRlcl0gPSBvdXRwdXQ7XG4gICAgICAgICAgICBjb25zdCBtb3JwaEN1cnZlID0ge1xuICAgICAgICAgICAgICAgIHBhdGhzOiBbe1xuICAgICAgICAgICAgICAgICAgICBlbnRpdHlQYXRoOiBlbnRpdHlQYXRoLFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQ6ICdncmFwaCcsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogW2B3ZWlnaHQuJHtyZXRyaWV2ZVdlaWdodE5hbWUobm9kZS5uYW1lLCBqKX1gXVxuICAgICAgICAgICAgICAgIH1dLFxuICAgICAgICAgICAgICAgIC8vIGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIGlucHV0IGNhbiB1c2UgdGhlIHNhbWUgc2FtcGxlci5pbnB1dCBmcm9tIHRoZSBjaGFubmVsIHRoZXkgd2VyZSBhbGwgaW5cbiAgICAgICAgICAgICAgICBpbnB1dDogY3VydmUuaW5wdXQsXG4gICAgICAgICAgICAgICAgLy8gYnV0IGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIHNob3VsZCByZWZlcmVuY2UgaXRzIGluZGl2aWR1YWwgb3V0cHV0IHRoYXQgd2FzIGp1c3QgY3JlYXRlZFxuICAgICAgICAgICAgICAgIG91dHB1dDogLW91dHB1dENvdW50ZXIsXG4gICAgICAgICAgICAgICAgaW50ZXJwb2xhdGlvbjogY3VydmUuaW50ZXJwb2xhdGlvblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG91dHB1dENvdW50ZXIrKztcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgbW9ycGggdGFyZ2V0IGN1cnZlIHRvIHRoZSBjdXJ2ZU1hcFxuICAgICAgICAgICAgY3VydmVNYXBbYG1vcnBoQ3VydmUtJHtpfS0ke2p9YF0gPSBtb3JwaEN1cnZlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGNvbnZlcnQgYW5pbSBjaGFubmVsc1xuICAgIGZvciAoaSA9IDA7IGkgPCBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzW2ldO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBjaGFubmVsLnRhcmdldDtcbiAgICAgICAgY29uc3QgY3VydmUgPSBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdO1xuXG4gICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1t0YXJnZXQubm9kZV07XG4gICAgICAgIGNvbnN0IGVudGl0eVBhdGggPSBjb25zdHJ1Y3ROb2RlUGF0aChub2RlKTtcblxuICAgICAgICBpZiAodGFyZ2V0LnBhdGguc3RhcnRzV2l0aCgnd2VpZ2h0cycpKSB7XG4gICAgICAgICAgICBjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyhjdXJ2ZSwgbm9kZSwgZW50aXR5UGF0aCk7XG4gICAgICAgICAgICAvLyBhZnRlciBhbGwgbW9ycGggdGFyZ2V0cyBpbiB0aGlzIGN1cnZlIGhhdmUgYmVlbiBpbmNsdWRlZCBpbiB0aGUgY3VydmVNYXAsIHRoaXMgY3VydmUgYW5kIGl0cyBvdXRwdXQgZGF0YSBjYW4gYmUgZGVsZXRlZFxuICAgICAgICAgICAgZGVsZXRlIGN1cnZlTWFwW2NoYW5uZWwuc2FtcGxlcl07XG4gICAgICAgICAgICBkZWxldGUgb3V0cHV0TWFwW2N1cnZlLm91dHB1dF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjdXJ2ZS5wYXRocy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlbnRpdHlQYXRoOiBlbnRpdHlQYXRoLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudDogJ2dyYXBoJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6IFt0cmFuc2Zvcm1TY2hlbWFbdGFyZ2V0LnBhdGhdXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGNvbnN0IGlucHV0cyA9IFtdO1xuICAgIGNvbnN0IG91dHB1dHMgPSBbXTtcbiAgICBjb25zdCBjdXJ2ZXMgPSBbXTtcblxuICAgIC8vIEFkZCBlYWNoIGlucHV0IGluIHRoZSBtYXAgdG8gdGhlIGZpbmFsIGlucHV0cyBhcnJheS4gVGhlIGlucHV0TWFwIHNob3VsZCBub3cgcmVmZXJlbmNlIHRoZSBpbmRleCBvZiBpbnB1dCBpbiB0aGUgaW5wdXRzIGFycmF5IGluc3RlYWQgb2YgdGhlIGlucHV0IGl0c2VsZi5cbiAgICBmb3IgKGNvbnN0IGlucHV0S2V5IGluIGlucHV0TWFwKSB7XG4gICAgICAgIGlucHV0cy5wdXNoKGlucHV0TWFwW2lucHV0S2V5XSk7XG4gICAgICAgIGlucHV0TWFwW2lucHV0S2V5XSA9IGlucHV0cy5sZW5ndGggLSAxO1xuICAgIH1cbiAgICAvLyBBZGQgZWFjaCBvdXRwdXQgaW4gdGhlIG1hcCB0byB0aGUgZmluYWwgb3V0cHV0cyBhcnJheS4gVGhlIG91dHB1dE1hcCBzaG91bGQgbm93IHJlZmVyZW5jZSB0aGUgaW5kZXggb2Ygb3V0cHV0IGluIHRoZSBvdXRwdXRzIGFycmF5IGluc3RlYWQgb2YgdGhlIG91dHB1dCBpdHNlbGYuXG4gICAgZm9yIChjb25zdCBvdXRwdXRLZXkgaW4gb3V0cHV0TWFwKSB7XG4gICAgICAgIG91dHB1dHMucHVzaChvdXRwdXRNYXBbb3V0cHV0S2V5XSk7XG4gICAgICAgIG91dHB1dE1hcFtvdXRwdXRLZXldID0gb3V0cHV0cy5sZW5ndGggLSAxO1xuICAgIH1cbiAgICAvLyBDcmVhdGUgYW4gQW5pbUN1cnZlIGZvciBlYWNoIGN1cnZlIG9iamVjdCBpbiB0aGUgY3VydmVNYXAuIEVhY2ggY3VydmUgb2JqZWN0J3MgaW5wdXQgdmFsdWUgc2hvdWxkIGJlIHJlc29sdmVkIHRvIHRoZSBpbmRleCBvZiB0aGUgaW5wdXQgaW4gdGhlXG4gICAgLy8gaW5wdXRzIGFycmF5cyB1c2luZyB0aGUgaW5wdXRNYXAuIExpa2V3aXNlIGZvciBvdXRwdXQgdmFsdWVzLlxuICAgIGZvciAoY29uc3QgY3VydmVLZXkgaW4gY3VydmVNYXApIHtcbiAgICAgICAgY29uc3QgY3VydmVEYXRhID0gY3VydmVNYXBbY3VydmVLZXldO1xuICAgICAgICBjdXJ2ZXMucHVzaChuZXcgQW5pbUN1cnZlKFxuICAgICAgICAgICAgY3VydmVEYXRhLnBhdGhzLFxuICAgICAgICAgICAgaW5wdXRNYXBbY3VydmVEYXRhLmlucHV0XSxcbiAgICAgICAgICAgIG91dHB1dE1hcFtjdXJ2ZURhdGEub3V0cHV0XSxcbiAgICAgICAgICAgIGN1cnZlRGF0YS5pbnRlcnBvbGF0aW9uXG4gICAgICAgICkpO1xuXG4gICAgICAgIC8vIGlmIHRoaXMgdGFyZ2V0IGlzIGEgc2V0IG9mIHF1YXRlcm5pb24ga2V5cywgbWFrZSBub3RlIG9mIGl0cyBpbmRleCBzbyB3ZSBjYW4gcGVyZm9ybVxuICAgICAgICAvLyBxdWF0ZXJuaW9uLXNwZWNpZmljIHByb2Nlc3Npbmcgb24gaXQuXG4gICAgICAgIGlmIChjdXJ2ZURhdGEucGF0aHNbMF0ucHJvcGVydHlQYXRoWzBdID09PSAnbG9jYWxSb3RhdGlvbicgJiYgY3VydmVEYXRhLmludGVycG9sYXRpb24gIT09IElOVEVSUE9MQVRJT05fQ1VCSUMpIHtcbiAgICAgICAgICAgIHF1YXRBcnJheXMucHVzaChjdXJ2ZXNbY3VydmVzLmxlbmd0aCAtIDFdLm91dHB1dCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHRoZSBsaXN0IG9mIGFycmF5IGluZGV4ZXMgc28gd2UgY2FuIHNraXAgZHVwc1xuICAgIHF1YXRBcnJheXMuc29ydCgpO1xuXG4gICAgLy8gcnVuIHRocm91Z2ggdGhlIHF1YXRlcm5pb24gZGF0YSBhcnJheXMgZmxpcHBpbmcgcXVhdGVybmlvbiBrZXlzXG4gICAgLy8gdGhhdCBkb24ndCBmYWxsIGluIHRoZSBzYW1lIHdpbmRpbmcgb3JkZXIuXG4gICAgbGV0IHByZXZJbmRleCA9IG51bGw7XG4gICAgbGV0IGRhdGE7XG4gICAgZm9yIChpID0gMDsgaSA8IHF1YXRBcnJheXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBxdWF0QXJyYXlzW2ldO1xuICAgICAgICAvLyBza2lwIG92ZXIgZHVwbGljYXRlIGFycmF5IGluZGljZXNcbiAgICAgICAgaWYgKGkgPT09IDAgfHwgaW5kZXggIT09IHByZXZJbmRleCkge1xuICAgICAgICAgICAgZGF0YSA9IG91dHB1dHNbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKGRhdGEuY29tcG9uZW50cyA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGQgPSBkYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVuID0gZC5sZW5ndGggLSA0O1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqICs9IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHAgPSBkW2ogKyAwXSAqIGRbaiArIDRdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgMV0gKiBkW2ogKyA1XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDJdICogZFtqICsgNl0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAzXSAqIGRbaiArIDddO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChkcCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDRdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNV0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA2XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDddICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJldkluZGV4ID0gaW5kZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjYWxjdWxhdGUgZHVyYXRpb24gb2YgdGhlIGFuaW1hdGlvbiBhcyBtYXhpbXVtIHRpbWUgdmFsdWVcbiAgICBsZXQgZHVyYXRpb24gPSAwO1xuICAgIGZvciAoaSA9IDA7IGkgPCBpbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZGF0YSAgPSBpbnB1dHNbaV0uX2RhdGE7XG4gICAgICAgIGR1cmF0aW9uID0gTWF0aC5tYXgoZHVyYXRpb24sIGRhdGEubGVuZ3RoID09PSAwID8gMCA6IGRhdGFbZGF0YS5sZW5ndGggLSAxXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBBbmltVHJhY2soXG4gICAgICAgIGdsdGZBbmltYXRpb24uaGFzT3duUHJvcGVydHkoJ25hbWUnKSA/IGdsdGZBbmltYXRpb24ubmFtZSA6ICgnYW5pbWF0aW9uXycgKyBhbmltYXRpb25JbmRleCksXG4gICAgICAgIGR1cmF0aW9uLFxuICAgICAgICBpbnB1dHMsXG4gICAgICAgIG91dHB1dHMsXG4gICAgICAgIGN1cnZlcyk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlID0gZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICBjb25zdCBlbnRpdHkgPSBuZXcgR3JhcGhOb2RlKCk7XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ25hbWUnKSAmJiBnbHRmTm9kZS5uYW1lLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZW50aXR5Lm5hbWUgPSBnbHRmTm9kZS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVudGl0eS5uYW1lID0gJ25vZGVfJyArIG5vZGVJbmRleDtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSB0cmFuc2Zvcm1hdGlvbiBwcm9wZXJ0aWVzXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdtYXRyaXgnKSkge1xuICAgICAgICB0ZW1wTWF0LmRhdGEuc2V0KGdsdGZOb2RlLm1hdHJpeCk7XG4gICAgICAgIHRlbXBNYXQuZ2V0VHJhbnNsYXRpb24odGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHRlbXBWZWMpO1xuICAgICAgICB0ZW1wTWF0LmdldEV1bGVyQW5nbGVzKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyh0ZW1wVmVjKTtcbiAgICAgICAgdGVtcE1hdC5nZXRTY2FsZSh0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsU2NhbGUodGVtcFZlYyk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdyb3RhdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHIgPSBnbHRmTm9kZS5yb3RhdGlvbjtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUm90YXRpb24oclswXSwgclsxXSwgclsyXSwgclszXSk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCd0cmFuc2xhdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHQgPSBnbHRmTm9kZS50cmFuc2xhdGlvbjtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUG9zaXRpb24odFswXSwgdFsxXSwgdFsyXSk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgIGNvbnN0IHMgPSBnbHRmTm9kZS5zY2FsZTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsU2NhbGUoc1swXSwgc1sxXSwgc1syXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudGl0eTtcbn07XG5cbi8vIGNyZWF0ZXMgYSBjYW1lcmEgY29tcG9uZW50IG9uIHRoZSBzdXBwbGllZCBub2RlLCBhbmQgcmV0dXJucyBpdFxuY29uc3QgY3JlYXRlQ2FtZXJhID0gZnVuY3Rpb24gKGdsdGZDYW1lcmEsIG5vZGUpIHtcblxuICAgIGNvbnN0IHByb2plY3Rpb24gPSBnbHRmQ2FtZXJhLnR5cGUgPT09ICdvcnRob2dyYXBoaWMnID8gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgOiBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFO1xuICAgIGNvbnN0IGdsdGZQcm9wZXJ0aWVzID0gcHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgPyBnbHRmQ2FtZXJhLm9ydGhvZ3JhcGhpYyA6IGdsdGZDYW1lcmEucGVyc3BlY3RpdmU7XG5cbiAgICBjb25zdCBjb21wb25lbnREYXRhID0ge1xuICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgICAgcHJvamVjdGlvbjogcHJvamVjdGlvbixcbiAgICAgICAgbmVhckNsaXA6IGdsdGZQcm9wZXJ0aWVzLnpuZWFyLFxuICAgICAgICBhc3BlY3RSYXRpb01vZGU6IEFTUEVDVF9BVVRPXG4gICAgfTtcblxuICAgIGlmIChnbHRmUHJvcGVydGllcy56ZmFyKSB7XG4gICAgICAgIGNvbXBvbmVudERhdGEuZmFyQ2xpcCA9IGdsdGZQcm9wZXJ0aWVzLnpmYXI7XG4gICAgfVxuXG4gICAgaWYgKHByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDKSB7XG4gICAgICAgIGNvbXBvbmVudERhdGEub3J0aG9IZWlnaHQgPSAwLjUgKiBnbHRmUHJvcGVydGllcy55bWFnO1xuICAgICAgICBpZiAoZ2x0ZlByb3BlcnRpZXMueW1hZykge1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfTUFOVUFMO1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpbyA9IGdsdGZQcm9wZXJ0aWVzLnhtYWcgLyBnbHRmUHJvcGVydGllcy55bWFnO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5mb3YgPSBnbHRmUHJvcGVydGllcy55Zm92ICogbWF0aC5SQURfVE9fREVHO1xuICAgICAgICBpZiAoZ2x0ZlByb3BlcnRpZXMuYXNwZWN0UmF0aW8pIHtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW9Nb2RlID0gQVNQRUNUX01BTlVBTDtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW8gPSBnbHRmUHJvcGVydGllcy5hc3BlY3RSYXRpbztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNhbWVyYUVudGl0eSA9IG5ldyBFbnRpdHkoZ2x0ZkNhbWVyYS5uYW1lKTtcbiAgICBjYW1lcmFFbnRpdHkuYWRkQ29tcG9uZW50KCdjYW1lcmEnLCBjb21wb25lbnREYXRhKTtcbiAgICByZXR1cm4gY2FtZXJhRW50aXR5O1xufTtcblxuLy8gY3JlYXRlcyBsaWdodCBjb21wb25lbnQsIGFkZHMgaXQgdG8gdGhlIG5vZGUgYW5kIHJldHVybnMgdGhlIGNyZWF0ZWQgbGlnaHQgY29tcG9uZW50XG5jb25zdCBjcmVhdGVMaWdodCA9IGZ1bmN0aW9uIChnbHRmTGlnaHQsIG5vZGUpIHtcblxuICAgIGNvbnN0IGxpZ2h0UHJvcHMgPSB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICB0eXBlOiBnbHRmTGlnaHQudHlwZSA9PT0gJ3BvaW50JyA/ICdvbW5pJyA6IGdsdGZMaWdodC50eXBlLFxuICAgICAgICBjb2xvcjogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdjb2xvcicpID8gbmV3IENvbG9yKGdsdGZMaWdodC5jb2xvcikgOiBDb2xvci5XSElURSxcblxuICAgICAgICAvLyB3aGVuIHJhbmdlIGlzIG5vdCBkZWZpbmVkLCBpbmZpbml0eSBzaG91bGQgYmUgdXNlZCAtIGJ1dCB0aGF0IGlzIGNhdXNpbmcgaW5maW5pdHkgaW4gYm91bmRzIGNhbGN1bGF0aW9uc1xuICAgICAgICByYW5nZTogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdyYW5nZScpID8gZ2x0ZkxpZ2h0LnJhbmdlIDogOTk5OSxcblxuICAgICAgICBmYWxsb2ZmTW9kZTogTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuXG4gICAgICAgIC8vIFRPRE86IChlbmdpbmUgaXNzdWUgIzMyNTIpIFNldCBpbnRlbnNpdHkgdG8gbWF0Y2ggZ2xURiBzcGVjaWZpY2F0aW9uLCB3aGljaCB1c2VzIHBoeXNpY2FsbHkgYmFzZWQgdmFsdWVzOlxuICAgICAgICAvLyAtIE9tbmkgYW5kIHNwb3QgbGlnaHRzIHVzZSBsdW1pbm91cyBpbnRlbnNpdHkgaW4gY2FuZGVsYSAobG0vc3IpXG4gICAgICAgIC8vIC0gRGlyZWN0aW9uYWwgbGlnaHRzIHVzZSBpbGx1bWluYW5jZSBpbiBsdXggKGxtL20yKS5cbiAgICAgICAgLy8gQ3VycmVudCBpbXBsZW1lbnRhdGlvbjogY2xhcG1zIHNwZWNpZmllZCBpbnRlbnNpdHkgdG8gMC4uMiByYW5nZVxuICAgICAgICBpbnRlbnNpdHk6IGdsdGZMaWdodC5oYXNPd25Qcm9wZXJ0eSgnaW50ZW5zaXR5JykgPyBtYXRoLmNsYW1wKGdsdGZMaWdodC5pbnRlbnNpdHksIDAsIDIpIDogMVxuICAgIH07XG5cbiAgICBpZiAoZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdpbnRlbnNpdHknKSkge1xuICAgICAgICBpZiAoZ2x0ZkxpZ2h0LnR5cGUgPT09ICdwb2ludCcgfHwgZ2x0ZkxpZ2h0LnR5cGUgPT09ICdvbW5pJykge1xuICAgICAgICAgICAgbGlnaHRQcm9wcy5sdW1pbmFuY2UgPSBnbHRmTGlnaHQuaW50ZW5zaXR5ICogKDQgKiBNYXRoLlBJKTtcbiAgICAgICAgfSBlbHNlIGlmIChnbHRmTGlnaHQudHlwZSA9PT0gJ3Nwb3QnKSB7XG4gICAgICAgICAgICBpZiAoZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdzcG90JykgJiYgZ2x0ZkxpZ2h0LnNwb3QuaGFzT3duUHJvcGVydHkoJ291dGVyQ29uZUFuZ2xlJykpIHtcbiAgICAgICAgICAgICAgICBsaWdodFByb3BzLmx1bWluYW5jZSA9IGdsdGZMaWdodC5pbnRlbnNpdHkgKiAoMiAqIE1hdGguUEkgKiAoMSAtIE1hdGguY29zKGdsdGZMaWdodC5zcG90Lm91dGVyQ29uZUFuZ2xlIC8gMi4wKSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsaWdodFByb3BzLmx1bWluYW5jZSA9IGdsdGZMaWdodC5pbnRlbnNpdHkgKiAoNCAqIE1hdGguUEkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGlnaHRQcm9wcy5sdW1pbmFuY2UgPSBnbHRmTGlnaHQuaW50ZW5zaXR5O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGdsdGZMaWdodC5oYXNPd25Qcm9wZXJ0eSgnc3BvdCcpKSB7XG4gICAgICAgIGxpZ2h0UHJvcHMuaW5uZXJDb25lQW5nbGUgPSBnbHRmTGlnaHQuc3BvdC5oYXNPd25Qcm9wZXJ0eSgnaW5uZXJDb25lQW5nbGUnKSA/IGdsdGZMaWdodC5zcG90LmlubmVyQ29uZUFuZ2xlICogbWF0aC5SQURfVE9fREVHIDogMDtcbiAgICAgICAgbGlnaHRQcm9wcy5vdXRlckNvbmVBbmdsZSA9IGdsdGZMaWdodC5zcG90Lmhhc093blByb3BlcnR5KCdvdXRlckNvbmVBbmdsZScpID8gZ2x0ZkxpZ2h0LnNwb3Qub3V0ZXJDb25lQW5nbGUgKiBtYXRoLlJBRF9UT19ERUcgOiBNYXRoLlBJIC8gNDtcbiAgICB9XG5cbiAgICAvLyBSb3RhdGUgdG8gbWF0Y2ggbGlnaHQgb3JpZW50YXRpb24gaW4gZ2xURiBzcGVjaWZpY2F0aW9uXG4gICAgLy8gTm90ZSB0aGF0IHRoaXMgYWRkcyBhIG5ldyBlbnRpdHkgbm9kZSBpbnRvIHRoZSBoaWVyYXJjaHkgdGhhdCBkb2VzIG5vdCBleGlzdCBpbiB0aGUgZ2x0ZiBoaWVyYXJjaHlcbiAgICBjb25zdCBsaWdodEVudGl0eSA9IG5ldyBFbnRpdHkobm9kZS5uYW1lKTtcbiAgICBsaWdodEVudGl0eS5yb3RhdGVMb2NhbCg5MCwgMCwgMCk7XG5cbiAgICAvLyBhZGQgY29tcG9uZW50XG4gICAgbGlnaHRFbnRpdHkuYWRkQ29tcG9uZW50KCdsaWdodCcsIGxpZ2h0UHJvcHMpO1xuICAgIHJldHVybiBsaWdodEVudGl0eTtcbn07XG5cbmNvbnN0IGNyZWF0ZVNraW5zID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdza2lucycpIHx8IGdsdGYuc2tpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICAvLyBjYWNoZSBmb3Igc2tpbnMgdG8gZmlsdGVyIG91dCBkdXBsaWNhdGVzXG4gICAgY29uc3QgZ2xiU2tpbnMgPSBuZXcgTWFwKCk7XG5cbiAgICByZXR1cm4gZ2x0Zi5za2lucy5tYXAoZnVuY3Rpb24gKGdsdGZTa2luKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVTa2luKGRldmljZSwgZ2x0ZlNraW4sIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsYlNraW5zKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZU1lc2hlcyA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCBjYWxsYmFjaywgZmxpcFYsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ21lc2hlcycpIHx8IGdsdGYubWVzaGVzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAhZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnYWNjZXNzb3JzJykgfHwgZ2x0Zi5hY2Nlc3NvcnMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICFnbHRmLmhhc093blByb3BlcnR5KCdidWZmZXJWaWV3cycpIHx8IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICAvLyBkaWN0aW9uYXJ5IG9mIHZlcnRleCBidWZmZXJzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICBjb25zdCB2ZXJ0ZXhCdWZmZXJEaWN0ID0ge307XG5cbiAgICByZXR1cm4gZ2x0Zi5tZXNoZXMubWFwKGZ1bmN0aW9uIChnbHRmTWVzaCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIGdsdGZNZXNoLCBnbHRmLmFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscyk7XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVNYXRlcmlhbHMgPSBmdW5jdGlvbiAoZ2x0ZiwgdGV4dHVyZXMsIG9wdGlvbnMsIGZsaXBWKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdtYXRlcmlhbHMnKSB8fCBnbHRmLm1hdGVyaWFscy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubWF0ZXJpYWwgJiYgb3B0aW9ucy5tYXRlcmlhbC5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubWF0ZXJpYWwgJiYgb3B0aW9ucy5tYXRlcmlhbC5wcm9jZXNzIHx8IGNyZWF0ZU1hdGVyaWFsO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm1hdGVyaWFsICYmIG9wdGlvbnMubWF0ZXJpYWwucG9zdHByb2Nlc3M7XG5cbiAgICByZXR1cm4gZ2x0Zi5tYXRlcmlhbHMubWFwKGZ1bmN0aW9uIChnbHRmTWF0ZXJpYWwpIHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk1hdGVyaWFsKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHByb2Nlc3MoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZNYXRlcmlhbCwgbWF0ZXJpYWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZVZhcmlhbnRzID0gZnVuY3Rpb24gKGdsdGYpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoXCJleHRlbnNpb25zXCIpIHx8ICFnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKVxuICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGRhdGEgPSBnbHRmLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cy52YXJpYW50cztcbiAgICBjb25zdCB2YXJpYW50cyA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXJpYW50c1tkYXRhW2ldLm5hbWVdID0gaTtcbiAgICB9XG4gICAgcmV0dXJuIHZhcmlhbnRzO1xufTtcblxuY29uc3QgY3JlYXRlQW5pbWF0aW9ucyA9IGZ1bmN0aW9uIChnbHRmLCBub2RlcywgYnVmZmVyVmlld3MsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ2FuaW1hdGlvbnMnKSB8fCBnbHRmLmFuaW1hdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLmFuaW1hdGlvbnMubWFwKGZ1bmN0aW9uIChnbHRmQW5pbWF0aW9uLCBpbmRleCkge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQW5pbWF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbmltYXRpb24gPSBjcmVhdGVBbmltYXRpb24oZ2x0ZkFuaW1hdGlvbiwgaW5kZXgsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsdGYubWVzaGVzKTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQW5pbWF0aW9uLCBhbmltYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhbmltYXRpb247XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlcyA9IGZ1bmN0aW9uIChnbHRmLCBvcHRpb25zKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpIHx8IGdsdGYubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm5vZGUgJiYgb3B0aW9ucy5ub2RlLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5ub2RlICYmIG9wdGlvbnMubm9kZS5wcm9jZXNzIHx8IGNyZWF0ZU5vZGU7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubm9kZSAmJiBvcHRpb25zLm5vZGUucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBub2RlcyA9IGdsdGYubm9kZXMubWFwKGZ1bmN0aW9uIChnbHRmTm9kZSwgaW5kZXgpIHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5vZGUgPSBwcm9jZXNzKGdsdGZOb2RlLCBpbmRleCk7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zk5vZGUsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH0pO1xuXG4gICAgLy8gYnVpbGQgbm9kZSBoaWVyYXJjaHlcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYubm9kZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0Zk5vZGUgPSBnbHRmLm5vZGVzW2ldO1xuICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NoaWxkcmVuJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgdW5pcXVlTmFtZXMgPSB7IH07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGdsdGZOb2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBub2Rlc1tnbHRmTm9kZS5jaGlsZHJlbltqXV07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZC5wYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVuaXF1ZU5hbWVzLmhhc093blByb3BlcnR5KGNoaWxkLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5uYW1lICs9IHVuaXF1ZU5hbWVzW2NoaWxkLm5hbWVdKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlxdWVOYW1lc1tjaGlsZC5uYW1lXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZXM7XG59O1xuXG5jb25zdCBjcmVhdGVTY2VuZXMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMpIHtcbiAgICBjb25zdCBzY2VuZXMgPSBbXTtcbiAgICBjb25zdCBjb3VudCA9IGdsdGYuc2NlbmVzLmxlbmd0aDtcblxuICAgIC8vIGlmIHRoZXJlJ3MgYSBzaW5nbGUgc2NlbmUgd2l0aCBhIHNpbmdsZSBub2RlIGluIGl0LCBkb24ndCBjcmVhdGUgd3JhcHBlciBub2Rlc1xuICAgIGlmIChjb3VudCA9PT0gMSAmJiBnbHRmLnNjZW5lc1swXS5ub2Rlcz8ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IGdsdGYuc2NlbmVzWzBdLm5vZGVzWzBdO1xuICAgICAgICBzY2VuZXMucHVzaChub2Rlc1tub2RlSW5kZXhdKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIC8vIGNyZWF0ZSByb290IG5vZGUgcGVyIHNjZW5lXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lc1tpXTtcbiAgICAgICAgICAgIGlmIChzY2VuZS5ub2Rlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lUm9vdCA9IG5ldyBHcmFwaE5vZGUoc2NlbmUubmFtZSk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbiA9IDA7IG4gPCBzY2VuZS5ub2Rlcy5sZW5ndGg7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZE5vZGUgPSBub2Rlc1tzY2VuZS5ub2Rlc1tuXV07XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lUm9vdC5hZGRDaGlsZChjaGlsZE5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzY2VuZXMucHVzaChzY2VuZVJvb3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjZW5lcztcbn07XG5cbmNvbnN0IGNyZWF0ZUNhbWVyYXMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpIHtcblxuICAgIGxldCBjYW1lcmFzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2NhbWVyYXMnKSAmJiBnbHRmLmNhbWVyYXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuY2FtZXJhICYmIG9wdGlvbnMuY2FtZXJhLnByZXByb2Nlc3M7XG4gICAgICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuY2FtZXJhICYmIG9wdGlvbnMuY2FtZXJhLnByb2Nlc3MgfHwgY3JlYXRlQ2FtZXJhO1xuICAgICAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jYW1lcmEgJiYgb3B0aW9ucy5jYW1lcmEucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChnbHRmTm9kZSwgbm9kZUluZGV4KSB7XG4gICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NhbWVyYScpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkNhbWVyYSA9IGdsdGYuY2FtZXJhc1tnbHRmTm9kZS5jYW1lcmFdO1xuICAgICAgICAgICAgICAgIGlmIChnbHRmQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZDYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHByb2Nlc3MoZ2x0ZkNhbWVyYSwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkNhbWVyYSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgY2FtZXJhIHRvIG5vZGUtPmNhbWVyYSBtYXBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYW1lcmFzKSBjYW1lcmFzID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhcy5zZXQoZ2x0Zk5vZGUsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjYW1lcmFzO1xufTtcblxuY29uc3QgY3JlYXRlTGlnaHRzID0gZnVuY3Rpb24gKGdsdGYsIG5vZGVzLCBvcHRpb25zKSB7XG5cbiAgICBsZXQgbGlnaHRzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSAmJlxuICAgICAgICBnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9saWdodHNfcHVuY3R1YWwnKSAmJiBnbHRmLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHRzJykpIHtcblxuICAgICAgICBjb25zdCBnbHRmTGlnaHRzID0gZ2x0Zi5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHRzO1xuICAgICAgICBpZiAoZ2x0ZkxpZ2h0cy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5saWdodCAmJiBvcHRpb25zLmxpZ2h0LnByZXByb2Nlc3M7XG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpZ2h0ICYmIG9wdGlvbnMubGlnaHQucHJvY2VzcyB8fCBjcmVhdGVMaWdodDtcbiAgICAgICAgICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpZ2h0ICYmIG9wdGlvbnMubGlnaHQucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBub2RlcyB3aXRoIGxpZ2h0c1xuICAgICAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChnbHRmTm9kZSwgbm9kZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2xpZ2h0c19wdW5jdHVhbCcpICYmXG4gICAgICAgICAgICAgICAgICAgIGdsdGZOb2RlLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHQnKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0SW5kZXggPSBnbHRmTm9kZS5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZMaWdodCA9IGdsdGZMaWdodHNbbGlnaHRJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBwcm9jZXNzKGdsdGZMaWdodCwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTGlnaHQsIGxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBsaWdodCB0byBub2RlLT5saWdodCBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRzKSBsaWdodHMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRzLnNldChnbHRmTm9kZSwgbGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlnaHRzO1xufTtcblxuLy8gbGluayBza2lucyB0byB0aGUgbWVzaGVzXG5jb25zdCBsaW5rU2tpbnMgPSBmdW5jdGlvbiAoZ2x0ZiwgcmVuZGVycywgc2tpbnMpIHtcbiAgICBnbHRmLm5vZGVzLmZvckVhY2goKGdsdGZOb2RlKSA9PiB7XG4gICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbWVzaCcpICYmIGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdza2luJykpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hHcm91cCA9IHJlbmRlcnNbZ2x0Zk5vZGUubWVzaF0ubWVzaGVzO1xuICAgICAgICAgICAgbWVzaEdyb3VwLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgICAgICAgICBtZXNoLnNraW4gPSBza2luc1tnbHRmTm9kZS5za2luXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBjcmVhdGUgZW5naW5lIHJlc291cmNlcyBmcm9tIHRoZSBkb3dubG9hZGVkIEdMQiBkYXRhXG5jb25zdCBjcmVhdGVSZXNvdXJjZXMgPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZUFzc2V0cywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmdsb2JhbCAmJiBvcHRpb25zLmdsb2JhbC5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmdsb2JhbCAmJiBvcHRpb25zLmdsb2JhbC5wb3N0cHJvY2VzcztcblxuICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgIHByZXByb2Nlc3MoZ2x0Zik7XG4gICAgfVxuXG4gICAgLy8gVGhlIG9yaWdpbmFsIHZlcnNpb24gb2YgRkFDVCBnZW5lcmF0ZWQgaW5jb3JyZWN0bHkgZmxpcHBlZCBWIHRleHR1cmVcbiAgICAvLyBjb29yZGluYXRlcy4gV2UgbXVzdCBjb21wZW5zYXRlIGJ5IGZsaXBwaW5nIFYgaW4gdGhpcyBjYXNlLiBPbmNlXG4gICAgLy8gYWxsIG1vZGVscyBoYXZlIGJlZW4gcmUtZXhwb3J0ZWQgd2UgY2FuIHJlbW92ZSB0aGlzIGZsYWcuXG4gICAgY29uc3QgZmxpcFYgPSBnbHRmLmFzc2V0ICYmIGdsdGYuYXNzZXQuZ2VuZXJhdG9yID09PSAnUGxheUNhbnZhcyc7XG5cbiAgICAvLyBXZSdkIGxpa2UgdG8gcmVtb3ZlIHRoZSBmbGlwViBjb2RlIGF0IHNvbWUgcG9pbnQuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ2dsVEYgbW9kZWwgbWF5IGhhdmUgZmxpcHBlZCBVVnMuIFBsZWFzZSByZWNvbnZlcnQuJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZXMgPSBjcmVhdGVOb2RlcyhnbHRmLCBvcHRpb25zKTtcbiAgICBjb25zdCBzY2VuZXMgPSBjcmVhdGVTY2VuZXMoZ2x0Ziwgbm9kZXMpO1xuICAgIGNvbnN0IGxpZ2h0cyA9IGNyZWF0ZUxpZ2h0cyhnbHRmLCBub2Rlcywgb3B0aW9ucyk7XG4gICAgY29uc3QgY2FtZXJhcyA9IGNyZWF0ZUNhbWVyYXMoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IGFuaW1hdGlvbnMgPSBjcmVhdGVBbmltYXRpb25zKGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3cywgb3B0aW9ucyk7XG4gICAgY29uc3QgbWF0ZXJpYWxzID0gY3JlYXRlTWF0ZXJpYWxzKGdsdGYsIHRleHR1cmVBc3NldHMubWFwKGZ1bmN0aW9uICh0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgcmV0dXJuIHRleHR1cmVBc3NldC5yZXNvdXJjZTtcbiAgICB9KSwgb3B0aW9ucywgZmxpcFYpO1xuICAgIGNvbnN0IHZhcmlhbnRzID0gY3JlYXRlVmFyaWFudHMoZ2x0Zik7XG4gICAgY29uc3QgbWVzaFZhcmlhbnRzID0ge307XG4gICAgY29uc3QgbWVzaERlZmF1bHRNYXRlcmlhbHMgPSB7fTtcbiAgICBjb25zdCBtZXNoZXMgPSBjcmVhdGVNZXNoZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgY2FsbGJhY2ssIGZsaXBWLCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzKTtcbiAgICBjb25zdCBza2lucyA9IGNyZWF0ZVNraW5zKGRldmljZSwgZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzKTtcblxuICAgIC8vIGNyZWF0ZSByZW5kZXJzIHRvIHdyYXAgbWVzaGVzXG4gICAgY29uc3QgcmVuZGVycyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlbmRlcnNbaV0gPSBuZXcgUmVuZGVyKCk7XG4gICAgICAgIHJlbmRlcnNbaV0ubWVzaGVzID0gbWVzaGVzW2ldO1xuICAgIH1cblxuICAgIC8vIGxpbmsgc2tpbnMgdG8gbWVzaGVzXG4gICAgbGlua1NraW5zKGdsdGYsIHJlbmRlcnMsIHNraW5zKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBHbGJSZXNvdXJjZXMoZ2x0Zik7XG4gICAgcmVzdWx0Lm5vZGVzID0gbm9kZXM7XG4gICAgcmVzdWx0LnNjZW5lcyA9IHNjZW5lcztcbiAgICByZXN1bHQuYW5pbWF0aW9ucyA9IGFuaW1hdGlvbnM7XG4gICAgcmVzdWx0LnRleHR1cmVzID0gdGV4dHVyZUFzc2V0cztcbiAgICByZXN1bHQubWF0ZXJpYWxzID0gbWF0ZXJpYWxzO1xuICAgIHJlc3VsdC52YXJpYW50cyA9IHZhcmlhbnRzO1xuICAgIHJlc3VsdC5tZXNoVmFyaWFudHMgPSBtZXNoVmFyaWFudHM7XG4gICAgcmVzdWx0Lm1lc2hEZWZhdWx0TWF0ZXJpYWxzID0gbWVzaERlZmF1bHRNYXRlcmlhbHM7XG4gICAgcmVzdWx0LnJlbmRlcnMgPSByZW5kZXJzO1xuICAgIHJlc3VsdC5za2lucyA9IHNraW5zO1xuICAgIHJlc3VsdC5saWdodHMgPSBsaWdodHM7XG4gICAgcmVzdWx0LmNhbWVyYXMgPSBjYW1lcmFzO1xuXG4gICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgIHBvc3Rwcm9jZXNzKGdsdGYsIHJlc3VsdCk7XG4gICAgfVxuXG4gICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbn07XG5cbmNvbnN0IGFwcGx5U2FtcGxlciA9IGZ1bmN0aW9uICh0ZXh0dXJlLCBnbHRmU2FtcGxlcikge1xuICAgIGNvbnN0IGdldEZpbHRlciA9IGZ1bmN0aW9uIChmaWx0ZXIsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICBzd2l0Y2ggKGZpbHRlcikge1xuICAgICAgICAgICAgY2FzZSA5NzI4OiByZXR1cm4gRklMVEVSX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk3Mjk6IHJldHVybiBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgY2FzZSA5OTg0OiByZXR1cm4gRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk5ODU6IHJldHVybiBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUO1xuICAgICAgICAgICAgY2FzZSA5OTg2OiByZXR1cm4gRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUjtcbiAgICAgICAgICAgIGNhc2UgOTk4NzogcmV0dXJuIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUjtcbiAgICAgICAgICAgIGRlZmF1bHQ6ICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBnZXRXcmFwID0gZnVuY3Rpb24gKHdyYXAsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICBzd2l0Y2ggKHdyYXApIHtcbiAgICAgICAgICAgIGNhc2UgMzMwNzE6IHJldHVybiBBRERSRVNTX0NMQU1QX1RPX0VER0U7XG4gICAgICAgICAgICBjYXNlIDMzNjQ4OiByZXR1cm4gQUREUkVTU19NSVJST1JFRF9SRVBFQVQ7XG4gICAgICAgICAgICBjYXNlIDEwNDk3OiByZXR1cm4gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgICAgICBkZWZhdWx0OiAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGlmICh0ZXh0dXJlKSB7XG4gICAgICAgIGdsdGZTYW1wbGVyID0gZ2x0ZlNhbXBsZXIgfHwgeyB9O1xuICAgICAgICB0ZXh0dXJlLm1pbkZpbHRlciA9IGdldEZpbHRlcihnbHRmU2FtcGxlci5taW5GaWx0ZXIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUik7XG4gICAgICAgIHRleHR1cmUubWFnRmlsdGVyID0gZ2V0RmlsdGVyKGdsdGZTYW1wbGVyLm1hZ0ZpbHRlciwgRklMVEVSX0xJTkVBUik7XG4gICAgICAgIHRleHR1cmUuYWRkcmVzc1UgPSBnZXRXcmFwKGdsdGZTYW1wbGVyLndyYXBTLCBBRERSRVNTX1JFUEVBVCk7XG4gICAgICAgIHRleHR1cmUuYWRkcmVzc1YgPSBnZXRXcmFwKGdsdGZTYW1wbGVyLndyYXBULCBBRERSRVNTX1JFUEVBVCk7XG4gICAgfVxufTtcblxubGV0IGdsdGZUZXh0dXJlVW5pcXVlSWQgPSAwO1xuXG4vLyBsb2FkIGFuIGltYWdlXG5jb25zdCBsb2FkSW1hZ2VBc3luYyA9IGZ1bmN0aW9uIChnbHRmSW1hZ2UsIGluZGV4LCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5pbWFnZSAmJiBvcHRpb25zLmltYWdlLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5pbWFnZSAmJiBvcHRpb25zLmltYWdlLnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZJbWFnZSwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5pbWFnZSAmJiBvcHRpb25zLmltYWdlLnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKHRleHR1cmVBc3NldCkge1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZJbWFnZSwgdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlQXNzZXQpO1xuICAgIH07XG5cbiAgICBjb25zdCBtaW1lVHlwZUZpbGVFeHRlbnNpb25zID0ge1xuICAgICAgICAnaW1hZ2UvcG5nJzogJ3BuZycsXG4gICAgICAgICdpbWFnZS9qcGVnJzogJ2pwZycsXG4gICAgICAgICdpbWFnZS9iYXNpcyc6ICdiYXNpcycsXG4gICAgICAgICdpbWFnZS9rdHgnOiAna3R4JyxcbiAgICAgICAgJ2ltYWdlL2t0eDInOiAna3R4MicsXG4gICAgICAgICdpbWFnZS92bmQtbXMuZGRzJzogJ2RkcydcbiAgICB9O1xuXG4gICAgY29uc3QgbG9hZFRleHR1cmUgPSBmdW5jdGlvbiAodXJsLCBidWZmZXJWaWV3LCBtaW1lVHlwZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBuYW1lID0gKGdsdGZJbWFnZS5uYW1lIHx8ICdnbHRmLXRleHR1cmUnKSArICctJyArIGdsdGZUZXh0dXJlVW5pcXVlSWQrKztcblxuICAgICAgICAvLyBjb25zdHJ1Y3QgdGhlIGFzc2V0IGZpbGVcbiAgICAgICAgY29uc3QgZmlsZSA9IHtcbiAgICAgICAgICAgIHVybDogdXJsIHx8IG5hbWVcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGJ1ZmZlclZpZXcpIHtcbiAgICAgICAgICAgIGZpbGUuY29udGVudHMgPSBidWZmZXJWaWV3LnNsaWNlKDApLmJ1ZmZlcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWltZVR5cGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IG1pbWVUeXBlRmlsZUV4dGVuc2lvbnNbbWltZVR5cGVdO1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbikge1xuICAgICAgICAgICAgICAgIGZpbGUuZmlsZW5hbWUgPSBmaWxlLnVybCArICcuJyArIGV4dGVuc2lvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgbG9hZCB0aGUgYXNzZXRcbiAgICAgICAgY29uc3QgYXNzZXQgPSBuZXcgQXNzZXQobmFtZSwgJ3RleHR1cmUnLCBmaWxlLCBudWxsLCBvcHRpb25zKTtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCBvbkxvYWQpO1xuICAgICAgICBhc3NldC5vbignZXJyb3InLCBjYWxsYmFjayk7XG4gICAgICAgIHJlZ2lzdHJ5LmFkZChhc3NldCk7XG4gICAgICAgIHJlZ2lzdHJ5LmxvYWQoYXNzZXQpO1xuICAgIH07XG5cbiAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICBwcmVwcm9jZXNzKGdsdGZJbWFnZSk7XG4gICAgfVxuXG4gICAgcHJvY2Vzc0FzeW5jKGdsdGZJbWFnZSwgZnVuY3Rpb24gKGVyciwgdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0gZWxzZSBpZiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICBvbkxvYWQodGV4dHVyZUFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChnbHRmSW1hZ2UuaGFzT3duUHJvcGVydHkoJ3VyaScpKSB7XG4gICAgICAgICAgICAgICAgLy8gdXJpIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgIGlmIChpc0RhdGFVUkkoZ2x0ZkltYWdlLnVyaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9hZFRleHR1cmUoZ2x0ZkltYWdlLnVyaSwgbnVsbCwgZ2V0RGF0YVVSSU1pbWVUeXBlKGdsdGZJbWFnZS51cmkpLCBudWxsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZShwYXRoLmpvaW4odXJsQmFzZSwgZ2x0ZkltYWdlLnVyaSksIG51bGwsIG51bGwsIHsgY3Jvc3NPcmlnaW46ICdhbm9ueW1vdXMnIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCdidWZmZXJWaWV3JykgJiYgZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCdtaW1lVHlwZScpKSB7XG4gICAgICAgICAgICAgICAgLy8gYnVmZmVydmlld1xuICAgICAgICAgICAgICAgIGxvYWRUZXh0dXJlKG51bGwsIGJ1ZmZlclZpZXdzW2dsdGZJbWFnZS5idWZmZXJWaWV3XSwgZ2x0ZkltYWdlLm1pbWVUeXBlLCBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gZmFpbFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGltYWdlIGZvdW5kIGluIGdsdGYgKG5laXRoZXIgdXJpIG9yIGJ1ZmZlclZpZXcgZm91bmQpLiBpbmRleD0nICsgaW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBsb2FkIHRleHR1cmVzIHVzaW5nIHRoZSBhc3NldCBzeXN0ZW1cbmNvbnN0IGxvYWRUZXh0dXJlc0FzeW5jID0gZnVuY3Rpb24gKGdsdGYsIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ2ltYWdlcycpIHx8IGdsdGYuaW1hZ2VzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAhZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgndGV4dHVyZXMnKSB8fCBnbHRmLnRleHR1cmVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBbXSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLnRleHR1cmUgJiYgb3B0aW9ucy50ZXh0dXJlLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy50ZXh0dXJlICYmIG9wdGlvbnMudGV4dHVyZS5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmVGV4dHVyZSwgZ2x0ZkltYWdlcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy50ZXh0dXJlICYmIG9wdGlvbnMudGV4dHVyZS5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IGFzc2V0cyA9IFtdOyAgICAgICAgLy8gb25lIHBlciBpbWFnZVxuICAgIGNvbnN0IHRleHR1cmVzID0gW107ICAgICAgLy8gbGlzdCBwZXIgaW1hZ2VcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLnRleHR1cmVzLmxlbmd0aDtcbiAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAodGV4dHVyZUluZGV4LCBpbWFnZUluZGV4KSB7XG4gICAgICAgIGlmICghdGV4dHVyZXNbaW1hZ2VJbmRleF0pIHtcbiAgICAgICAgICAgIHRleHR1cmVzW2ltYWdlSW5kZXhdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGV4dHVyZXNbaW1hZ2VJbmRleF0ucHVzaCh0ZXh0dXJlSW5kZXgpO1xuXG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgICAgICAgICB0ZXh0dXJlcy5mb3JFYWNoKGZ1bmN0aW9uICh0ZXh0dXJlTGlzdCwgaW1hZ2VJbmRleCkge1xuICAgICAgICAgICAgICAgIHRleHR1cmVMaXN0LmZvckVhY2goZnVuY3Rpb24gKHRleHR1cmVJbmRleCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4dHVyZUFzc2V0ID0gKGluZGV4ID09PSAwKSA/IGFzc2V0c1tpbWFnZUluZGV4XSA6IGNsb25lVGV4dHVyZUFzc2V0KGFzc2V0c1tpbWFnZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIGFwcGx5U2FtcGxlcih0ZXh0dXJlQXNzZXQucmVzb3VyY2UsIChnbHRmLnNhbXBsZXJzIHx8IFtdKVtnbHRmLnRleHR1cmVzW3RleHR1cmVJbmRleF0uc2FtcGxlcl0pO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbdGV4dHVyZUluZGV4XSA9IHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmLnRleHR1cmVzW3RleHR1cmVJbmRleF0sIHRleHR1cmVBc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYudGV4dHVyZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZlRleHR1cmUgPSBnbHRmLnRleHR1cmVzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZUZXh0dXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmVGV4dHVyZSwgZ2x0Zi5pbWFnZXMsIGZ1bmN0aW9uIChpLCBnbHRmVGV4dHVyZSwgZXJyLCBnbHRmSW1hZ2VJbmRleCkge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChnbHRmSW1hZ2VJbmRleCA9PT0gdW5kZWZpbmVkIHx8IGdsdGZJbWFnZUluZGV4ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGdsdGZJbWFnZUluZGV4ID0gZ2x0ZlRleHR1cmU/LmV4dGVuc2lvbnM/LktIUl90ZXh0dXJlX2Jhc2lzdT8uc291cmNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0ZkltYWdlSW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZkltYWdlSW5kZXggPSBnbHRmVGV4dHVyZS5zb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRzW2dsdGZJbWFnZUluZGV4XSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpbWFnZSBoYXMgYWxyZWFkeSBiZWVuIGxvYWRlZFxuICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgZ2x0ZkltYWdlSW5kZXgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcnN0IG9jY2N1cnJlbmNlLCBsb2FkIGl0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZJbWFnZSA9IGdsdGYuaW1hZ2VzW2dsdGZJbWFnZUluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgbG9hZEltYWdlQXN5bmMoZ2x0ZkltYWdlLCBpLCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHRleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0c1tnbHRmSW1hZ2VJbmRleF0gPSB0ZXh0dXJlQXNzZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25Mb2FkKGksIGdsdGZJbWFnZUluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQobnVsbCwgaSwgZ2x0ZlRleHR1cmUpKTtcbiAgICB9XG59O1xuXG4vLyBsb2FkIGdsdGYgYnVmZmVycyBhc3luY2hyb25vdXNseSwgcmV0dXJuaW5nIHRoZW0gaW4gdGhlIGNhbGxiYWNrXG5jb25zdCBsb2FkQnVmZmVyc0FzeW5jID0gZnVuY3Rpb24gKGdsdGYsIGJpbmFyeUNodW5rLCB1cmxCYXNlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgaWYgKCFnbHRmLmJ1ZmZlcnMgfHwgZ2x0Zi5idWZmZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXIgJiYgb3B0aW9ucy5idWZmZXIucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlciAmJiBvcHRpb25zLmJ1ZmZlci5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmQnVmZmVyLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlciAmJiBvcHRpb25zLmJ1ZmZlci5wb3N0cHJvY2VzcztcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLmJ1ZmZlcnMubGVuZ3RoO1xuICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uIChpbmRleCwgYnVmZmVyKSB7XG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBidWZmZXI7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zi5idWZmZXJzW2luZGV4XSwgYnVmZmVyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoLS1yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbHRmLmJ1ZmZlcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlciA9IGdsdGYuYnVmZmVyc1tpXTtcblxuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyLCBmdW5jdGlvbiAoaSwgZ2x0ZkJ1ZmZlciwgZXJyLCBhcnJheUJ1ZmZlcikgeyAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhcnJheUJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCBuZXcgVWludDhBcnJheShhcnJheUJ1ZmZlcikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0ZkJ1ZmZlci5oYXNPd25Qcm9wZXJ0eSgndXJpJykpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzRGF0YVVSSShnbHRmQnVmZmVyLnVyaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgYmFzZTY0IHRvIHJhdyBiaW5hcnkgZGF0YSBoZWxkIGluIGEgc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBkb2Vzbid0IGhhbmRsZSBVUkxFbmNvZGVkIERhdGFVUklzIC0gc2VlIFNPIGFuc3dlciAjNjg1MDI3NiBmb3IgY29kZSB0aGF0IGRvZXMgdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnl0ZVN0cmluZyA9IGF0b2IoZ2x0ZkJ1ZmZlci51cmkuc3BsaXQoJywnKVsxXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBhIHZpZXcgaW50byB0aGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiaW5hcnlBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ5dGVTdHJpbmcubGVuZ3RoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IHRoZSBieXRlcyBvZiB0aGUgYnVmZmVyIHRvIHRoZSBjb3JyZWN0IHZhbHVlc1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBieXRlU3RyaW5nLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluYXJ5QXJyYXlbal0gPSBieXRlU3RyaW5nLmNoYXJDb2RlQXQoaik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBiaW5hcnlBcnJheSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBodHRwLmdldChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoLmpvaW4odXJsQmFzZSwgZ2x0ZkJ1ZmZlci51cmkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgY2FjaGU6IHRydWUsIHJlc3BvbnNlVHlwZTogJ2FycmF5YnVmZmVyJywgcmV0cnk6IGZhbHNlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKGksIGVyciwgcmVzdWx0KSB7ICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbG9vcC1mdW5jXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgbmV3IFVpbnQ4QXJyYXkocmVzdWx0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LmJpbmQobnVsbCwgaSlcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBnbGIgYnVmZmVyIHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgYmluYXJ5Q2h1bmspO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKG51bGwsIGksIGdsdGZCdWZmZXIpKTtcbiAgICB9XG59O1xuXG4vLyBwYXJzZSB0aGUgZ2x0ZiBjaHVuaywgcmV0dXJucyB0aGUgZ2x0ZiBqc29uXG5jb25zdCBwYXJzZUdsdGYgPSBmdW5jdGlvbiAoZ2x0ZkNodW5rLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGRlY29kZUJpbmFyeVV0ZjggPSBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBUZXh0RGVjb2RlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoYXJyYXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHN0ciA9ICcnO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShhcnJheVtpXSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KGVzY2FwZShzdHIpKTtcbiAgICB9O1xuXG4gICAgY29uc3QgZ2x0ZiA9IEpTT04ucGFyc2UoZGVjb2RlQmluYXJ5VXRmOChnbHRmQ2h1bmspKTtcblxuICAgIC8vIGNoZWNrIGdsdGYgdmVyc2lvblxuICAgIGlmIChnbHRmLmFzc2V0ICYmIGdsdGYuYXNzZXQudmVyc2lvbiAmJiBwYXJzZUZsb2F0KGdsdGYuYXNzZXQudmVyc2lvbikgPCAyKSB7XG4gICAgICAgIGNhbGxiYWNrKGBJbnZhbGlkIGdsdGYgdmVyc2lvbi4gRXhwZWN0ZWQgdmVyc2lvbiAyLjAgb3IgYWJvdmUgYnV0IGZvdW5kIHZlcnNpb24gJyR7Z2x0Zi5hc3NldC52ZXJzaW9ufScuYCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBjaGVjayByZXF1aXJlZCBleHRlbnNpb25zXG4gICAgY29uc3QgZXh0ZW5zaW9uc1JlcXVpcmVkID0gZ2x0Zj8uZXh0ZW5zaW9uc1JlcXVpcmVkIHx8IFtdO1xuICAgIGlmICghZHJhY29EZWNvZGVySW5zdGFuY2UgJiYgIWdldEdsb2JhbERyYWNvRGVjb2Rlck1vZHVsZSgpICYmIGV4dGVuc2lvbnNSZXF1aXJlZC5pbmRleE9mKCdLSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbicpICE9PSAtMSkge1xuICAgICAgICBXYXNtTW9kdWxlLmdldEluc3RhbmNlKCdEcmFjb0RlY29kZXJNb2R1bGUnLCAoaW5zdGFuY2UpID0+IHtcbiAgICAgICAgICAgIGRyYWNvRGVjb2Rlckluc3RhbmNlID0gaW5zdGFuY2U7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBnbHRmKTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgZ2x0Zik7XG4gICAgfVxufTtcblxuLy8gcGFyc2UgZ2xiIGRhdGEsIHJldHVybnMgdGhlIGdsdGYgYW5kIGJpbmFyeSBjaHVua1xuY29uc3QgcGFyc2VHbGIgPSBmdW5jdGlvbiAoZ2xiRGF0YSwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBkYXRhID0gKGdsYkRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikgPyBuZXcgRGF0YVZpZXcoZ2xiRGF0YSkgOiBuZXcgRGF0YVZpZXcoZ2xiRGF0YS5idWZmZXIsIGdsYkRhdGEuYnl0ZU9mZnNldCwgZ2xiRGF0YS5ieXRlTGVuZ3RoKTtcblxuICAgIC8vIHJlYWQgaGVhZGVyXG4gICAgY29uc3QgbWFnaWMgPSBkYXRhLmdldFVpbnQzMigwLCB0cnVlKTtcbiAgICBjb25zdCB2ZXJzaW9uID0gZGF0YS5nZXRVaW50MzIoNCwgdHJ1ZSk7XG4gICAgY29uc3QgbGVuZ3RoID0gZGF0YS5nZXRVaW50MzIoOCwgdHJ1ZSk7XG5cbiAgICBpZiAobWFnaWMgIT09IDB4NDY1NDZDNjcpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbWFnaWMgbnVtYmVyIGZvdW5kIGluIGdsYiBoZWFkZXIuIEV4cGVjdGVkIDB4NDY1NDZDNjcsIGZvdW5kIDB4JyArIG1hZ2ljLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodmVyc2lvbiAhPT0gMikge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCB2ZXJzaW9uIG51bWJlciBmb3VuZCBpbiBnbGIgaGVhZGVyLiBFeHBlY3RlZCAyLCBmb3VuZCAnICsgdmVyc2lvbik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGVuZ3RoIDw9IDAgfHwgbGVuZ3RoID4gZGF0YS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGxlbmd0aCBmb3VuZCBpbiBnbGIgaGVhZGVyLiBGb3VuZCAnICsgbGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHJlYWQgY2h1bmtzXG4gICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgbGV0IG9mZnNldCA9IDEyO1xuICAgIHdoaWxlIChvZmZzZXQgPCBsZW5ndGgpIHtcbiAgICAgICAgY29uc3QgY2h1bmtMZW5ndGggPSBkYXRhLmdldFVpbnQzMihvZmZzZXQsIHRydWUpO1xuICAgICAgICBpZiAob2Zmc2V0ICsgY2h1bmtMZW5ndGggKyA4ID4gZGF0YS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY2h1bmsgbGVuZ3RoIGZvdW5kIGluIGdsYi4gRm91bmQgJyArIGNodW5rTGVuZ3RoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaHVua1R5cGUgPSBkYXRhLmdldFVpbnQzMihvZmZzZXQgKyA0LCB0cnVlKTtcbiAgICAgICAgY29uc3QgY2h1bmtEYXRhID0gbmV3IFVpbnQ4QXJyYXkoZGF0YS5idWZmZXIsIGRhdGEuYnl0ZU9mZnNldCArIG9mZnNldCArIDgsIGNodW5rTGVuZ3RoKTtcbiAgICAgICAgY2h1bmtzLnB1c2goeyBsZW5ndGg6IGNodW5rTGVuZ3RoLCB0eXBlOiBjaHVua1R5cGUsIGRhdGE6IGNodW5rRGF0YSB9KTtcbiAgICAgICAgb2Zmc2V0ICs9IGNodW5rTGVuZ3RoICsgODtcbiAgICB9XG5cbiAgICBpZiAoY2h1bmtzLmxlbmd0aCAhPT0gMSAmJiBjaHVua3MubGVuZ3RoICE9PSAyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIG51bWJlciBvZiBjaHVua3MgZm91bmQgaW4gZ2xiIGZpbGUuJyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoY2h1bmtzWzBdLnR5cGUgIT09IDB4NEU0RjUzNEEpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgY2h1bmsgdHlwZSBmb3VuZCBpbiBnbGIgZmlsZS4gRXhwZWN0ZWQgMHg0RTRGNTM0QSwgZm91bmQgMHgnICsgY2h1bmtzWzBdLnR5cGUudG9TdHJpbmcoMTYpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaHVua3MubGVuZ3RoID4gMSAmJiBjaHVua3NbMV0udHlwZSAhPT0gMHgwMDRFNDk0Mikge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBjaHVuayB0eXBlIGZvdW5kIGluIGdsYiBmaWxlLiBFeHBlY3RlZCAweDAwNEU0OTQyLCBmb3VuZCAweCcgKyBjaHVua3NbMV0udHlwZS50b1N0cmluZygxNikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY2FsbGJhY2sobnVsbCwge1xuICAgICAgICBnbHRmQ2h1bms6IGNodW5rc1swXS5kYXRhLFxuICAgICAgICBiaW5hcnlDaHVuazogY2h1bmtzLmxlbmd0aCA9PT0gMiA/IGNodW5rc1sxXS5kYXRhIDogbnVsbFxuICAgIH0pO1xufTtcblxuLy8gcGFyc2UgdGhlIGNodW5rIG9mIGRhdGEsIHdoaWNoIGNhbiBiZSBnbGIgb3IgZ2x0ZlxuY29uc3QgcGFyc2VDaHVuayA9IGZ1bmN0aW9uIChmaWxlbmFtZSwgZGF0YSwgY2FsbGJhY2spIHtcbiAgICBpZiAoZmlsZW5hbWUgJiYgZmlsZW5hbWUudG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgnLmdsYicpKSB7XG4gICAgICAgIHBhcnNlR2xiKGRhdGEsIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgICAgICBnbHRmQ2h1bms6IGRhdGEsXG4gICAgICAgICAgICBiaW5hcnlDaHVuazogbnVsbFxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG4vLyBjcmVhdGUgYnVmZmVyIHZpZXdzXG5jb25zdCBwYXJzZUJ1ZmZlclZpZXdzQXN5bmMgPSBmdW5jdGlvbiAoZ2x0ZiwgYnVmZmVycywgb3B0aW9ucywgY2FsbGJhY2spIHtcblxuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3NBc3luYyA9IChvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyVmlldyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcucHJvY2Vzc0FzeW5jKSB8fCBmdW5jdGlvbiAoZ2x0ZkJ1ZmZlclZpZXcsIGJ1ZmZlcnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgIH07XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyVmlldyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcucG9zdHByb2Nlc3M7XG5cbiAgICBsZXQgcmVtYWluaW5nID0gZ2x0Zi5idWZmZXJWaWV3cyA/IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoIDogMDtcblxuICAgIC8vIGhhbmRsZSBjYXNlIG9mIG5vIGJ1ZmZlcnNcbiAgICBpZiAoIXJlbWFpbmluZykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uIChpbmRleCwgYnVmZmVyVmlldykge1xuICAgICAgICBjb25zdCBnbHRmQnVmZmVyVmlldyA9IGdsdGYuYnVmZmVyVmlld3NbaW5kZXhdO1xuICAgICAgICBpZiAoZ2x0ZkJ1ZmZlclZpZXcuaGFzT3duUHJvcGVydHkoJ2J5dGVTdHJpZGUnKSkge1xuICAgICAgICAgICAgYnVmZmVyVmlldy5ieXRlU3RyaWRlID0gZ2x0ZkJ1ZmZlclZpZXcuYnl0ZVN0cmlkZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBidWZmZXJWaWV3O1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZCdWZmZXJWaWV3LCBidWZmZXJWaWV3KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoLS1yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbHRmLmJ1ZmZlclZpZXdzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGdsdGZCdWZmZXJWaWV3ID0gZ2x0Zi5idWZmZXJWaWV3c1tpXTtcblxuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQnVmZmVyVmlldyk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzQXN5bmMoZ2x0ZkJ1ZmZlclZpZXcsIGJ1ZmZlcnMsIGZ1bmN0aW9uIChpLCBnbHRmQnVmZmVyVmlldywgZXJyLCByZXN1bHQpIHsgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBvbkxvYWQoaSwgcmVzdWx0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gYnVmZmVyc1tnbHRmQnVmZmVyVmlldy5idWZmZXJdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHR5cGVkQXJyYXkgPSBuZXcgVWludDhBcnJheShidWZmZXIuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXIuYnl0ZU9mZnNldCArIChnbHRmQnVmZmVyVmlldy5ieXRlT2Zmc2V0IHx8IDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbHRmQnVmZmVyVmlldy5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBvbkxvYWQoaSwgdHlwZWRBcnJheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZChudWxsLCBpLCBnbHRmQnVmZmVyVmlldykpO1xuICAgIH1cbn07XG5cbi8vIC0tIEdsYlBhcnNlclxuY2xhc3MgR2xiUGFyc2VyIHtcbiAgICAvLyBwYXJzZSB0aGUgZ2x0ZiBvciBnbGIgZGF0YSBhc3luY2hyb25vdXNseSwgbG9hZGluZyBleHRlcm5hbCByZXNvdXJjZXNcbiAgICBzdGF0aWMgcGFyc2VBc3luYyhmaWxlbmFtZSwgdXJsQmFzZSwgZGF0YSwgZGV2aWNlLCByZWdpc3RyeSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgLy8gcGFyc2UgdGhlIGRhdGFcbiAgICAgICAgcGFyc2VDaHVuayhmaWxlbmFtZSwgZGF0YSwgZnVuY3Rpb24gKGVyciwgY2h1bmtzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHBhcnNlIGdsdGZcbiAgICAgICAgICAgIHBhcnNlR2x0ZihjaHVua3MuZ2x0ZkNodW5rLCBmdW5jdGlvbiAoZXJyLCBnbHRmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYXN5bmMgbG9hZCBleHRlcm5hbCBidWZmZXJzXG4gICAgICAgICAgICAgICAgbG9hZEJ1ZmZlcnNBc3luYyhnbHRmLCBjaHVua3MuYmluYXJ5Q2h1bmssIHVybEJhc2UsIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzeW5jIGxvYWQgYnVmZmVyIHZpZXdzXG4gICAgICAgICAgICAgICAgICAgIHBhcnNlQnVmZmVyVmlld3NBc3luYyhnbHRmLCBidWZmZXJzLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCBidWZmZXJWaWV3cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3luYyBsb2FkIGltYWdlc1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9hZFRleHR1cmVzQXN5bmMoZ2x0ZiwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCB0ZXh0dXJlQXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlUmVzb3VyY2VzKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIHRleHR1cmVBc3NldHMsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBwYXJzZSB0aGUgZ2x0ZiBvciBnbGIgZGF0YSBzeW5jaHJvbm91c2x5LiBleHRlcm5hbCByZXNvdXJjZXMgKGJ1ZmZlcnMgYW5kIGltYWdlcykgYXJlIGlnbm9yZWQuXG4gICAgc3RhdGljIHBhcnNlKGZpbGVuYW1lLCBkYXRhLCBkZXZpY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG5cbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgeyB9O1xuXG4gICAgICAgIC8vIHBhcnNlIHRoZSBkYXRhXG4gICAgICAgIHBhcnNlQ2h1bmsoZmlsZW5hbWUsIGRhdGEsIGZ1bmN0aW9uIChlcnIsIGNodW5rcykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gcGFyc2UgZ2x0ZlxuICAgICAgICAgICAgICAgIHBhcnNlR2x0ZihjaHVua3MuZ2x0ZkNodW5rLCBmdW5jdGlvbiAoZXJyLCBnbHRmKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBhcnNlIGJ1ZmZlciB2aWV3c1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VCdWZmZXJWaWV3c0FzeW5jKGdsdGYsIFtjaHVua3MuYmluYXJ5Q2h1bmtdLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCBidWZmZXJWaWV3cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSByZXNvdXJjZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlUmVzb3VyY2VzKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIFtdLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCByZXN1bHRfKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSByZXN1bHRfO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgYXNzZXRzLCBtYXhSZXRyaWVzKSB7XG4gICAgICAgIHRoaXMuX2RldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5fYXNzZXRzID0gYXNzZXRzO1xuICAgICAgICB0aGlzLl9kZWZhdWx0TWF0ZXJpYWwgPSBjcmVhdGVNYXRlcmlhbCh7XG4gICAgICAgICAgICBuYW1lOiAnZGVmYXVsdEdsYk1hdGVyaWFsJ1xuICAgICAgICB9LCBbXSk7XG4gICAgICAgIHRoaXMubWF4UmV0cmllcyA9IG1heFJldHJpZXM7XG4gICAgfVxuXG4gICAgX2dldFVybFdpdGhvdXRQYXJhbXModXJsKSB7XG4gICAgICAgIHJldHVybiB1cmwuaW5kZXhPZignPycpID49IDAgPyB1cmwuc3BsaXQoJz8nKVswXSA6IHVybDtcbiAgICB9XG5cbiAgICBsb2FkKHVybCwgY2FsbGJhY2ssIGFzc2V0KSB7XG4gICAgICAgIEFzc2V0LmZldGNoQXJyYXlCdWZmZXIodXJsLmxvYWQsIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIEdsYlBhcnNlci5wYXJzZUFzeW5jKFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9nZXRVcmxXaXRob3V0UGFyYW1zKHVybC5vcmlnaW5hbCksXG4gICAgICAgICAgICAgICAgICAgIHBhdGguZXh0cmFjdFBhdGgodXJsLmxvYWQpLFxuICAgICAgICAgICAgICAgICAgICByZXN1bHQsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RldmljZSxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQucmVnaXN0cnksXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0Lm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJldHVybiBldmVyeXRoaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbmV3IEdsYkNvbnRhaW5lclJlc291cmNlKHJlc3VsdCwgYXNzZXQsIHRoaXMuX2Fzc2V0cywgdGhpcy5fZGVmYXVsdE1hdGVyaWFsKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCBhc3NldCwgdGhpcy5tYXhSZXRyaWVzKTtcbiAgICB9XG5cbiAgICBvcGVuKHVybCwgZGF0YSwgYXNzZXQpIHtcbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuXG4gICAgcGF0Y2goYXNzZXQsIGFzc2V0cykge1xuXG4gICAgfVxufVxuXG5leHBvcnQgeyBHbGJQYXJzZXIgfTtcbiJdLCJuYW1lcyI6WyJkcmFjb0RlY29kZXJJbnN0YW5jZSIsImdldEdsb2JhbERyYWNvRGVjb2Rlck1vZHVsZSIsIndpbmRvdyIsIkRyYWNvRGVjb2Rlck1vZHVsZSIsIkdsYlJlc291cmNlcyIsImNvbnN0cnVjdG9yIiwiZ2x0ZiIsIm5vZGVzIiwic2NlbmVzIiwiYW5pbWF0aW9ucyIsInRleHR1cmVzIiwibWF0ZXJpYWxzIiwidmFyaWFudHMiLCJtZXNoVmFyaWFudHMiLCJtZXNoRGVmYXVsdE1hdGVyaWFscyIsInJlbmRlcnMiLCJza2lucyIsImxpZ2h0cyIsImNhbWVyYXMiLCJkZXN0cm95IiwiZm9yRWFjaCIsInJlbmRlciIsIm1lc2hlcyIsImlzRGF0YVVSSSIsInVyaSIsInRlc3QiLCJnZXREYXRhVVJJTWltZVR5cGUiLCJzdWJzdHJpbmciLCJpbmRleE9mIiwiZ2V0TnVtQ29tcG9uZW50cyIsImFjY2Vzc29yVHlwZSIsImdldENvbXBvbmVudFR5cGUiLCJjb21wb25lbnRUeXBlIiwiVFlQRV9JTlQ4IiwiVFlQRV9VSU5UOCIsIlRZUEVfSU5UMTYiLCJUWVBFX1VJTlQxNiIsIlRZUEVfSU5UMzIiLCJUWVBFX1VJTlQzMiIsIlRZUEVfRkxPQVQzMiIsImdldENvbXBvbmVudFNpemVJbkJ5dGVzIiwiZ2V0Q29tcG9uZW50RGF0YVR5cGUiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiSW50MTZBcnJheSIsIlVpbnQxNkFycmF5IiwiSW50MzJBcnJheSIsIlVpbnQzMkFycmF5IiwiRmxvYXQzMkFycmF5IiwiZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAiLCJTRU1BTlRJQ19QT1NJVElPTiIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX1RBTkdFTlQiLCJTRU1BTlRJQ19DT0xPUiIsIlNFTUFOVElDX0JMRU5ESU5ESUNFUyIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwiU0VNQU5USUNfVEVYQ09PUkQxIiwiU0VNQU5USUNfVEVYQ09PUkQyIiwiU0VNQU5USUNfVEVYQ09PUkQzIiwiU0VNQU5USUNfVEVYQ09PUkQ0IiwiU0VNQU5USUNfVEVYQ09PUkQ1IiwiU0VNQU5USUNfVEVYQ09PUkQ2IiwiU0VNQU5USUNfVEVYQ09PUkQ3IiwiZ2V0RGVxdWFudGl6ZUZ1bmMiLCJzcmNUeXBlIiwieCIsIk1hdGgiLCJtYXgiLCJkZXF1YW50aXplQXJyYXkiLCJkc3RBcnJheSIsInNyY0FycmF5IiwiY29udkZ1bmMiLCJsZW4iLCJsZW5ndGgiLCJpIiwiZ2V0QWNjZXNzb3JEYXRhIiwiZ2x0ZkFjY2Vzc29yIiwiYnVmZmVyVmlld3MiLCJmbGF0dGVuIiwibnVtQ29tcG9uZW50cyIsInR5cGUiLCJkYXRhVHlwZSIsImJ1ZmZlclZpZXciLCJyZXN1bHQiLCJzcGFyc2UiLCJpbmRpY2VzQWNjZXNzb3IiLCJjb3VudCIsImluZGljZXMiLCJPYmplY3QiLCJhc3NpZ24iLCJ2YWx1ZXNBY2Nlc3NvciIsInNjYWxhciIsInZhbHVlcyIsImhhc093blByb3BlcnR5IiwiYmFzZUFjY2Vzc29yIiwiYnl0ZU9mZnNldCIsInNsaWNlIiwidGFyZ2V0SW5kZXgiLCJqIiwiYnl0ZXNQZXJFbGVtZW50IiwiQllURVNfUEVSX0VMRU1FTlQiLCJzdG9yYWdlIiwiQXJyYXlCdWZmZXIiLCJ0bXBBcnJheSIsImRzdE9mZnNldCIsInNyY09mZnNldCIsImJ5dGVTdHJpZGUiLCJiIiwiYnVmZmVyIiwiZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMiIsImRhdGEiLCJub3JtYWxpemVkIiwiZmxvYXQzMkRhdGEiLCJnZXRBY2Nlc3NvckJvdW5kaW5nQm94IiwibWluIiwiY3R5cGUiLCJCb3VuZGluZ0JveCIsIlZlYzMiLCJnZXRQcmltaXRpdmVUeXBlIiwicHJpbWl0aXZlIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsIm1vZGUiLCJQUklNSVRJVkVfUE9JTlRTIiwiUFJJTUlUSVZFX0xJTkVTIiwiUFJJTUlUSVZFX0xJTkVMT09QIiwiUFJJTUlUSVZFX0xJTkVTVFJJUCIsIlBSSU1JVElWRV9UUklTVFJJUCIsIlBSSU1JVElWRV9UUklGQU4iLCJnZW5lcmF0ZUluZGljZXMiLCJudW1WZXJ0aWNlcyIsImR1bW15SW5kaWNlcyIsImdlbmVyYXRlTm9ybWFscyIsInNvdXJjZURlc2MiLCJwIiwiY29tcG9uZW50cyIsInBvc2l0aW9ucyIsInNpemUiLCJzdHJpZGUiLCJzcmNTdHJpZGUiLCJ0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZSIsInNyYyIsInR5cGVkQXJyYXlUeXBlcyIsIm9mZnNldCIsIm5vcm1hbHNUZW1wIiwiY2FsY3VsYXRlTm9ybWFscyIsIm5vcm1hbHMiLCJzZXQiLCJmbGlwVGV4Q29vcmRWcyIsInZlcnRleEJ1ZmZlciIsImZsb2F0T2Zmc2V0cyIsInNob3J0T2Zmc2V0cyIsImJ5dGVPZmZzZXRzIiwiZm9ybWF0IiwiZWxlbWVudHMiLCJlbGVtZW50IiwibmFtZSIsInB1c2giLCJmbGlwIiwib2Zmc2V0cyIsIm9uZSIsInR5cGVkQXJyYXkiLCJpbmRleCIsImNsb25lVGV4dHVyZSIsInRleHR1cmUiLCJzaGFsbG93Q29weUxldmVscyIsIm1pcCIsIl9sZXZlbHMiLCJsZXZlbCIsImN1YmVtYXAiLCJmYWNlIiwiVGV4dHVyZSIsImRldmljZSIsImNsb25lVGV4dHVyZUFzc2V0IiwiQXNzZXQiLCJmaWxlIiwib3B0aW9ucyIsImxvYWRlZCIsInJlc291cmNlIiwicmVnaXN0cnkiLCJhZGQiLCJjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbCIsImZsaXBWIiwicG9zaXRpb25EZXNjIiwidmVydGV4RGVzYyIsInNlbWFudGljIiwibm9ybWFsaXplIiwiZWxlbWVudE9yZGVyIiwic29ydCIsImxocyIsInJocyIsImxoc09yZGVyIiwicmhzT3JkZXIiLCJrIiwic291cmNlIiwidGFyZ2V0Iiwic291cmNlT2Zmc2V0IiwidmVydGV4Rm9ybWF0IiwiVmVydGV4Rm9ybWF0IiwiaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCIsIlZlcnRleEJ1ZmZlciIsIkJVRkZFUl9TVEFUSUMiLCJ2ZXJ0ZXhEYXRhIiwibG9jayIsInRhcmdldEFycmF5Iiwic291cmNlQXJyYXkiLCJ0YXJnZXRTdHJpZGUiLCJzb3VyY2VTdHJpZGUiLCJkc3QiLCJrZW5kIiwiZmxvb3IiLCJ1bmxvY2siLCJjcmVhdGVWZXJ0ZXhCdWZmZXIiLCJhdHRyaWJ1dGVzIiwiYWNjZXNzb3JzIiwidmVydGV4QnVmZmVyRGljdCIsInVzZUF0dHJpYnV0ZXMiLCJhdHRyaWJJZHMiLCJhdHRyaWIiLCJ2YktleSIsImpvaW4iLCJ2YiIsImFjY2Vzc29yIiwiYWNjZXNzb3JEYXRhIiwiY3JlYXRlVmVydGV4QnVmZmVyRHJhY28iLCJvdXRwdXRHZW9tZXRyeSIsImV4dERyYWNvIiwiZGVjb2RlciIsImRlY29kZXJNb2R1bGUiLCJudW1Qb2ludHMiLCJudW1fcG9pbnRzIiwiZXh0cmFjdERyYWNvQXR0cmlidXRlSW5mbyIsInVuaXF1ZUlkIiwiYXR0cmlidXRlIiwiR2V0QXR0cmlidXRlQnlVbmlxdWVJZCIsIm51bVZhbHVlcyIsIm51bV9jb21wb25lbnRzIiwiZHJhY29Gb3JtYXQiLCJkYXRhX3R5cGUiLCJwdHIiLCJjb21wb25lbnRTaXplSW5CeXRlcyIsInN0b3JhZ2VUeXBlIiwiRFRfVUlOVDgiLCJfbWFsbG9jIiwiR2V0QXR0cmlidXRlRGF0YUFycmF5Rm9yQWxsUG9pbnRzIiwiSEVBUFU4IiwiRFRfVUlOVDE2IiwiSEVBUFUxNiIsIkRUX0ZMT0FUMzIiLCJIRUFQRjMyIiwiX2ZyZWUiLCJhdHRyaWJ1dGVJbmZvIiwiY3JlYXRlU2tpbiIsImdsdGZTa2luIiwiZ2xiU2tpbnMiLCJiaW5kTWF0cml4Iiwiam9pbnRzIiwibnVtSm9pbnRzIiwiaWJwIiwiaW52ZXJzZUJpbmRNYXRyaWNlcyIsImlibURhdGEiLCJpYm1WYWx1ZXMiLCJNYXQ0IiwiYm9uZU5hbWVzIiwia2V5Iiwic2tpbiIsImdldCIsIlNraW4iLCJ0ZW1wTWF0IiwidGVtcFZlYyIsImNyZWF0ZU1lc2giLCJnbHRmTWVzaCIsImNhbGxiYWNrIiwicHJpbWl0aXZlcyIsInByaW1pdGl2ZVR5cGUiLCJudW1JbmRpY2VzIiwiY2FuVXNlTW9ycGgiLCJleHRlbnNpb25zIiwiS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb24iLCJ1aW50OEJ1ZmZlciIsIkRlY29kZXJCdWZmZXIiLCJJbml0IiwiRGVjb2RlciIsImdlb21ldHJ5VHlwZSIsIkdldEVuY29kZWRHZW9tZXRyeVR5cGUiLCJzdGF0dXMiLCJQT0lOVF9DTE9VRCIsIlBvaW50Q2xvdWQiLCJEZWNvZGVCdWZmZXJUb1BvaW50Q2xvdWQiLCJUUklBTkdVTEFSX01FU0giLCJNZXNoIiwiRGVjb2RlQnVmZmVyVG9NZXNoIiwiSU5WQUxJRF9HRU9NRVRSWV9UWVBFIiwib2siLCJlcnJvcl9tc2ciLCJudW1GYWNlcyIsIm51bV9mYWNlcyIsImJpdDMyIiwiZGF0YVNpemUiLCJHZXRUcmlhbmdsZXNVSW50MzJBcnJheSIsIkhFQVBVMzIiLCJHZXRUcmlhbmdsZXNVSW50MTZBcnJheSIsIkRlYnVnIiwid2FybiIsIm1lc2giLCJiYXNlIiwiaW5kZXhlZCIsImluZGV4Rm9ybWF0IiwiSU5ERVhGT1JNQVRfVUlOVDgiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJleHRVaW50RWxlbWVudCIsImNvbnNvbGUiLCJpbmRleEJ1ZmZlciIsIkluZGV4QnVmZmVyIiwiS0hSX21hdGVyaWFsc192YXJpYW50cyIsInRlbXBNYXBwaW5nIiwibWFwcGluZ3MiLCJtYXBwaW5nIiwidmFyaWFudCIsIm1hdGVyaWFsIiwiaWQiLCJQT1NJVElPTiIsImFhYmIiLCJ0YXJnZXRzIiwiZGVsdGFQb3NpdGlvbnMiLCJkZWx0YVBvc2l0aW9uc1R5cGUiLCJOT1JNQUwiLCJkZWx0YU5vcm1hbHMiLCJkZWx0YU5vcm1hbHNUeXBlIiwiZXh0cmFzIiwidGFyZ2V0TmFtZXMiLCJ0b1N0cmluZyIsImRlZmF1bHRXZWlnaHQiLCJ3ZWlnaHRzIiwiTW9ycGhUYXJnZXQiLCJtb3JwaCIsIk1vcnBoIiwiZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0iLCJtYXBzIiwibWFwIiwidGV4Q29vcmQiLCJ6ZXJvcyIsIm9uZXMiLCJ0ZXh0dXJlVHJhbnNmb3JtIiwiS0hSX3RleHR1cmVfdHJhbnNmb3JtIiwic2NhbGUiLCJyb3RhdGlvbiIsIm1hdGgiLCJSQURfVE9fREVHIiwidGlsaW5nVmVjIiwiVmVjMiIsIm9mZnNldFZlYyIsImV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzIiwiY29sb3IiLCJkaWZmdXNlRmFjdG9yIiwiZGlmZnVzZSIsInBvdyIsIm9wYWNpdHkiLCJkaWZmdXNlVGV4dHVyZSIsImRpZmZ1c2VNYXAiLCJkaWZmdXNlTWFwQ2hhbm5lbCIsIm9wYWNpdHlNYXAiLCJvcGFjaXR5TWFwQ2hhbm5lbCIsInVzZU1ldGFsbmVzcyIsInNwZWN1bGFyRmFjdG9yIiwic3BlY3VsYXIiLCJzaGluaW5lc3MiLCJnbG9zc2luZXNzRmFjdG9yIiwic3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZSIsInNwZWN1bGFyRW5jb2RpbmciLCJzcGVjdWxhck1hcCIsImdsb3NzTWFwIiwic3BlY3VsYXJNYXBDaGFubmVsIiwiZ2xvc3NNYXBDaGFubmVsIiwiZXh0ZW5zaW9uQ2xlYXJDb2F0IiwiY2xlYXJDb2F0IiwiY2xlYXJjb2F0RmFjdG9yIiwiY2xlYXJjb2F0VGV4dHVyZSIsImNsZWFyQ29hdE1hcCIsImNsZWFyQ29hdE1hcENoYW5uZWwiLCJjbGVhckNvYXRHbG9zc2luZXNzIiwiY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yIiwiY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSIsImNsZWFyQ29hdEdsb3NzTWFwIiwiY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsIiwiY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSIsImNsZWFyQ29hdE5vcm1hbE1hcCIsImNsZWFyQ29hdEJ1bXBpbmVzcyIsImNsZWFyQ29hdEdsb3NzQ2h1bmsiLCJjaHVua3MiLCJjbGVhckNvYXRHbG9zc1BTIiwiZXh0ZW5zaW9uVW5saXQiLCJ1c2VMaWdodGluZyIsImVtaXNzaXZlIiwiY29weSIsImVtaXNzaXZlVGludCIsImRpZmZ1c2VUaW50IiwiZW1pc3NpdmVNYXAiLCJlbWlzc2l2ZU1hcFV2IiwiZGlmZnVzZU1hcFV2IiwiZW1pc3NpdmVNYXBUaWxpbmciLCJkaWZmdXNlTWFwVGlsaW5nIiwiZW1pc3NpdmVNYXBPZmZzZXQiLCJkaWZmdXNlTWFwT2Zmc2V0IiwiZW1pc3NpdmVNYXBSb3RhdGlvbiIsImRpZmZ1c2VNYXBSb3RhdGlvbiIsImVtaXNzaXZlTWFwQ2hhbm5lbCIsImVtaXNzaXZlVmVydGV4Q29sb3IiLCJkaWZmdXNlVmVydGV4Q29sb3IiLCJlbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCIsImRpZmZ1c2VWZXJ0ZXhDb2xvckNoYW5uZWwiLCJleHRlbnNpb25TcGVjdWxhciIsInVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IiLCJzcGVjdWxhckNvbG9yVGV4dHVyZSIsInNwZWN1bGFyQ29sb3JGYWN0b3IiLCJzcGVjdWxhcml0eUZhY3RvciIsInNwZWN1bGFyaXR5RmFjdG9yTWFwQ2hhbm5lbCIsInNwZWN1bGFyaXR5RmFjdG9yTWFwIiwic3BlY3VsYXJUZXh0dXJlIiwiZXh0ZW5zaW9uSW9yIiwicmVmcmFjdGlvbkluZGV4IiwiaW9yIiwiZXh0ZW5zaW9uVHJhbnNtaXNzaW9uIiwiYmxlbmRUeXBlIiwiQkxFTkRfTk9STUFMIiwidXNlRHluYW1pY1JlZnJhY3Rpb24iLCJyZWZyYWN0aW9uIiwidHJhbnNtaXNzaW9uRmFjdG9yIiwicmVmcmFjdGlvbk1hcENoYW5uZWwiLCJyZWZyYWN0aW9uTWFwIiwidHJhbnNtaXNzaW9uVGV4dHVyZSIsImV4dGVuc2lvblNoZWVuIiwidXNlU2hlZW4iLCJzaGVlbkNvbG9yRmFjdG9yIiwic2hlZW4iLCJzaGVlbk1hcCIsInNoZWVuQ29sb3JUZXh0dXJlIiwic2hlZW5HbG9zc2luZXNzIiwic2hlZW5Sb3VnaG5lc3NGYWN0b3IiLCJzaGVlbkdsb3NzaW5lc3NNYXAiLCJzaGVlblJvdWdobmVzc1RleHR1cmUiLCJzaGVlbkdsb3NzaW5lc3NNYXBDaGFubmVsIiwic2hlZW5HbG9zc0NodW5rIiwic2hlZW5HbG9zc1BTIiwiZXh0ZW5zaW9uVm9sdW1lIiwidGhpY2tuZXNzIiwidGhpY2tuZXNzRmFjdG9yIiwidGhpY2tuZXNzTWFwIiwidGhpY2tuZXNzVGV4dHVyZSIsImF0dGVudWF0aW9uRGlzdGFuY2UiLCJhdHRlbnVhdGlvbkNvbG9yIiwiYXR0ZW51YXRpb24iLCJleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoIiwiZW1pc3NpdmVJbnRlbnNpdHkiLCJlbWlzc2l2ZVN0cmVuZ3RoIiwiZXh0ZW5zaW9uSXJpZGVzY2Vuc2UiLCJjcmVhdGVNYXRlcmlhbCIsImdsdGZNYXRlcmlhbCIsImdsb3NzQ2h1bmsiLCJTdGFuZGFyZE1hdGVyaWFsIiwib2NjbHVkZVNwZWN1bGFyIiwiU1BFQ09DQ19BTyIsInNwZWN1bGFyVGludCIsInNwZWN1bGFyVmVydGV4Q29sb3IiLCJwYnJEYXRhIiwicGJyTWV0YWxsaWNSb3VnaG5lc3MiLCJiYXNlQ29sb3JGYWN0b3IiLCJiYXNlQ29sb3JUZXh0dXJlIiwibWV0YWxuZXNzIiwibWV0YWxsaWNGYWN0b3IiLCJyb3VnaG5lc3NGYWN0b3IiLCJtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUiLCJtZXRhbG5lc3NNYXAiLCJtZXRhbG5lc3NNYXBDaGFubmVsIiwiZ2xvc3NQUyIsIm5vcm1hbFRleHR1cmUiLCJub3JtYWxNYXAiLCJidW1waW5lc3MiLCJvY2NsdXNpb25UZXh0dXJlIiwiYW9NYXAiLCJhb01hcENoYW5uZWwiLCJlbWlzc2l2ZUZhY3RvciIsImVtaXNzaXZlVGV4dHVyZSIsImFscGhhTW9kZSIsIkJMRU5EX05PTkUiLCJhbHBoYVRlc3QiLCJhbHBoYUN1dG9mZiIsImRlcHRoV3JpdGUiLCJ0d29TaWRlZExpZ2h0aW5nIiwiZG91YmxlU2lkZWQiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsIkNVTExGQUNFX0JBQ0siLCJleHRlbnNpb25GdW5jIiwidW5kZWZpbmVkIiwidXBkYXRlIiwiY3JlYXRlQW5pbWF0aW9uIiwiZ2x0ZkFuaW1hdGlvbiIsImFuaW1hdGlvbkluZGV4IiwiZ2x0ZkFjY2Vzc29ycyIsImNyZWF0ZUFuaW1EYXRhIiwiQW5pbURhdGEiLCJpbnRlcnBNYXAiLCJJTlRFUlBPTEFUSU9OX1NURVAiLCJJTlRFUlBPTEFUSU9OX0xJTkVBUiIsIklOVEVSUE9MQVRJT05fQ1VCSUMiLCJpbnB1dE1hcCIsIm91dHB1dE1hcCIsImN1cnZlTWFwIiwib3V0cHV0Q291bnRlciIsInNhbXBsZXJzIiwic2FtcGxlciIsImlucHV0Iiwib3V0cHV0IiwiaW50ZXJwb2xhdGlvbiIsImN1cnZlIiwicGF0aHMiLCJxdWF0QXJyYXlzIiwidHJhbnNmb3JtU2NoZW1hIiwiY29uc3RydWN0Tm9kZVBhdGgiLCJub2RlIiwicGF0aCIsInVuc2hpZnQiLCJwYXJlbnQiLCJyZXRyaWV2ZVdlaWdodE5hbWUiLCJub2RlTmFtZSIsIndlaWdodEluZGV4IiwiY3JlYXRlTW9ycGhUYXJnZXRDdXJ2ZXMiLCJlbnRpdHlQYXRoIiwibW9ycGhUYXJnZXRDb3VudCIsImtleWZyYW1lQ291bnQiLCJtb3JwaFRhcmdldE91dHB1dCIsIm1vcnBoQ3VydmUiLCJjb21wb25lbnQiLCJwcm9wZXJ0eVBhdGgiLCJjaGFubmVscyIsImNoYW5uZWwiLCJzdGFydHNXaXRoIiwiaW5wdXRzIiwib3V0cHV0cyIsImN1cnZlcyIsImlucHV0S2V5Iiwib3V0cHV0S2V5IiwiY3VydmVLZXkiLCJjdXJ2ZURhdGEiLCJBbmltQ3VydmUiLCJwcmV2SW5kZXgiLCJkIiwiZHAiLCJkdXJhdGlvbiIsIl9kYXRhIiwiQW5pbVRyYWNrIiwiY3JlYXRlTm9kZSIsImdsdGZOb2RlIiwibm9kZUluZGV4IiwiZW50aXR5IiwiR3JhcGhOb2RlIiwibWF0cml4IiwiZ2V0VHJhbnNsYXRpb24iLCJzZXRMb2NhbFBvc2l0aW9uIiwiZ2V0RXVsZXJBbmdsZXMiLCJzZXRMb2NhbEV1bGVyQW5nbGVzIiwiZ2V0U2NhbGUiLCJzZXRMb2NhbFNjYWxlIiwiciIsInNldExvY2FsUm90YXRpb24iLCJ0IiwidHJhbnNsYXRpb24iLCJzIiwiY3JlYXRlQ2FtZXJhIiwiZ2x0ZkNhbWVyYSIsInByb2plY3Rpb24iLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsIlBST0pFQ1RJT05fUEVSU1BFQ1RJVkUiLCJnbHRmUHJvcGVydGllcyIsIm9ydGhvZ3JhcGhpYyIsInBlcnNwZWN0aXZlIiwiY29tcG9uZW50RGF0YSIsImVuYWJsZWQiLCJuZWFyQ2xpcCIsInpuZWFyIiwiYXNwZWN0UmF0aW9Nb2RlIiwiQVNQRUNUX0FVVE8iLCJ6ZmFyIiwiZmFyQ2xpcCIsIm9ydGhvSGVpZ2h0IiwieW1hZyIsIkFTUEVDVF9NQU5VQUwiLCJhc3BlY3RSYXRpbyIsInhtYWciLCJmb3YiLCJ5Zm92IiwiY2FtZXJhRW50aXR5IiwiRW50aXR5IiwiYWRkQ29tcG9uZW50IiwiY3JlYXRlTGlnaHQiLCJnbHRmTGlnaHQiLCJsaWdodFByb3BzIiwiQ29sb3IiLCJXSElURSIsInJhbmdlIiwiZmFsbG9mZk1vZGUiLCJMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQiLCJpbnRlbnNpdHkiLCJjbGFtcCIsImx1bWluYW5jZSIsIlBJIiwic3BvdCIsImNvcyIsIm91dGVyQ29uZUFuZ2xlIiwiaW5uZXJDb25lQW5nbGUiLCJsaWdodEVudGl0eSIsInJvdGF0ZUxvY2FsIiwiY3JlYXRlU2tpbnMiLCJNYXAiLCJjcmVhdGVNZXNoZXMiLCJjcmVhdGVNYXRlcmlhbHMiLCJwcmVwcm9jZXNzIiwicHJvY2VzcyIsInBvc3Rwcm9jZXNzIiwiY3JlYXRlVmFyaWFudHMiLCJjcmVhdGVBbmltYXRpb25zIiwiYW5pbWF0aW9uIiwiY3JlYXRlTm9kZXMiLCJ1bmlxdWVOYW1lcyIsImNoaWxkcmVuIiwiY2hpbGQiLCJhZGRDaGlsZCIsImNyZWF0ZVNjZW5lcyIsInNjZW5lIiwic2NlbmVSb290IiwibiIsImNoaWxkTm9kZSIsImNyZWF0ZUNhbWVyYXMiLCJjYW1lcmEiLCJjcmVhdGVMaWdodHMiLCJLSFJfbGlnaHRzX3B1bmN0dWFsIiwiZ2x0ZkxpZ2h0cyIsImxpZ2h0IiwibGlnaHRJbmRleCIsImxpbmtTa2lucyIsIm1lc2hHcm91cCIsImNyZWF0ZVJlc291cmNlcyIsInRleHR1cmVBc3NldHMiLCJnbG9iYWwiLCJhc3NldCIsImdlbmVyYXRvciIsInRleHR1cmVBc3NldCIsIlJlbmRlciIsImFwcGx5U2FtcGxlciIsImdsdGZTYW1wbGVyIiwiZ2V0RmlsdGVyIiwiZmlsdGVyIiwiZGVmYXVsdFZhbHVlIiwiRklMVEVSX05FQVJFU1QiLCJGSUxURVJfTElORUFSIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsImdldFdyYXAiLCJ3cmFwIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19NSVJST1JFRF9SRVBFQVQiLCJBRERSRVNTX1JFUEVBVCIsIm1pbkZpbHRlciIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwid3JhcFMiLCJhZGRyZXNzViIsIndyYXBUIiwiZ2x0ZlRleHR1cmVVbmlxdWVJZCIsImxvYWRJbWFnZUFzeW5jIiwiZ2x0ZkltYWdlIiwidXJsQmFzZSIsImltYWdlIiwicHJvY2Vzc0FzeW5jIiwib25Mb2FkIiwibWltZVR5cGVGaWxlRXh0ZW5zaW9ucyIsImxvYWRUZXh0dXJlIiwidXJsIiwibWltZVR5cGUiLCJjb250ZW50cyIsImV4dGVuc2lvbiIsImZpbGVuYW1lIiwib24iLCJsb2FkIiwiZXJyIiwiY3Jvc3NPcmlnaW4iLCJsb2FkVGV4dHVyZXNBc3luYyIsImltYWdlcyIsImdsdGZUZXh0dXJlIiwiZ2x0ZkltYWdlcyIsImFzc2V0cyIsInJlbWFpbmluZyIsInRleHR1cmVJbmRleCIsImltYWdlSW5kZXgiLCJ0ZXh0dXJlTGlzdCIsImdsdGZJbWFnZUluZGV4IiwiS0hSX3RleHR1cmVfYmFzaXN1IiwiYmluZCIsImxvYWRCdWZmZXJzQXN5bmMiLCJiaW5hcnlDaHVuayIsImJ1ZmZlcnMiLCJnbHRmQnVmZmVyIiwiYXJyYXlCdWZmZXIiLCJieXRlU3RyaW5nIiwiYXRvYiIsInNwbGl0IiwiYmluYXJ5QXJyYXkiLCJjaGFyQ29kZUF0IiwiaHR0cCIsImNhY2hlIiwicmVzcG9uc2VUeXBlIiwicmV0cnkiLCJwYXJzZUdsdGYiLCJnbHRmQ2h1bmsiLCJkZWNvZGVCaW5hcnlVdGY4IiwiYXJyYXkiLCJUZXh0RGVjb2RlciIsImRlY29kZSIsInN0ciIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImRlY29kZVVSSUNvbXBvbmVudCIsImVzY2FwZSIsIkpTT04iLCJwYXJzZSIsInZlcnNpb24iLCJwYXJzZUZsb2F0IiwiZXh0ZW5zaW9uc1JlcXVpcmVkIiwiV2FzbU1vZHVsZSIsImdldEluc3RhbmNlIiwiaW5zdGFuY2UiLCJwYXJzZUdsYiIsImdsYkRhdGEiLCJEYXRhVmlldyIsImJ5dGVMZW5ndGgiLCJtYWdpYyIsImdldFVpbnQzMiIsImNodW5rTGVuZ3RoIiwiRXJyb3IiLCJjaHVua1R5cGUiLCJjaHVua0RhdGEiLCJwYXJzZUNodW5rIiwidG9Mb3dlckNhc2UiLCJlbmRzV2l0aCIsInBhcnNlQnVmZmVyVmlld3NBc3luYyIsImdsdGZCdWZmZXJWaWV3IiwiR2xiUGFyc2VyIiwicGFyc2VBc3luYyIsImVycm9yIiwicmVzdWx0XyIsIm1heFJldHJpZXMiLCJfZGV2aWNlIiwiX2Fzc2V0cyIsIl9kZWZhdWx0TWF0ZXJpYWwiLCJfZ2V0VXJsV2l0aG91dFBhcmFtcyIsImZldGNoQXJyYXlCdWZmZXIiLCJvcmlnaW5hbCIsImV4dHJhY3RQYXRoIiwiR2xiQ29udGFpbmVyUmVzb3VyY2UiLCJvcGVuIiwicGF0Y2giXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUEyREEsSUFBSUEsb0JBQW9CLEdBQUcsSUFBM0IsQ0FBQTs7QUFFQSxNQUFNQywyQkFBMkIsR0FBRyxNQUFNO0FBQ3RDLEVBQUEsT0FBTyxPQUFPQyxNQUFQLEtBQWtCLFdBQWxCLElBQWlDQSxNQUFNLENBQUNDLGtCQUEvQyxDQUFBO0FBQ0gsQ0FGRCxDQUFBOztBQUtBLE1BQU1DLFlBQU4sQ0FBbUI7RUFDZkMsV0FBVyxDQUFDQyxJQUFELEVBQU87SUFDZCxJQUFLQSxDQUFBQSxJQUFMLEdBQVlBLElBQVosQ0FBQTtJQUNBLElBQUtDLENBQUFBLEtBQUwsR0FBYSxJQUFiLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxNQUFMLEdBQWMsSUFBZCxDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsVUFBTCxHQUFrQixJQUFsQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsUUFBTCxHQUFnQixJQUFoQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsU0FBTCxHQUFpQixJQUFqQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsUUFBTCxHQUFnQixJQUFoQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsWUFBTCxHQUFvQixJQUFwQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsb0JBQUwsR0FBNEIsSUFBNUIs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
