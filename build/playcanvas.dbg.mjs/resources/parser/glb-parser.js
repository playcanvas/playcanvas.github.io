/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
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
import { Light, lightTypes } from '../../scene/light.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3Jlc291cmNlcy9wYXJzZXIvZ2xiLXBhcnNlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9wYXRoLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi8uLi9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHsgQm91bmRpbmdCb3ggfSBmcm9tICcuLi8uLi9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUsXG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDVUxMRkFDRV9OT05FLCBDVUxMRkFDRV9CQUNLLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQUklNSVRJVkVfTElORUxPT1AsIFBSSU1JVElWRV9MSU5FU1RSSVAsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX1BPSU5UUywgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIFNFTUFOVElDX1RFWENPT1JEMCwgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19URVhDT09SRDIsIFNFTUFOVElDX1RFWENPT1JEMywgU0VNQU5USUNfVEVYQ09PUkQ0LCBTRU1BTlRJQ19URVhDT09SRDUsIFNFTUFOVElDX1RFWENPT1JENiwgU0VNQU5USUNfVEVYQ09PUkQ3LFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzIsIENIVU5LQVBJXzFfNTdcbn0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5cbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSwgQkxFTkRfTk9STUFMLCBMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQsXG4gICAgUFJPSkVDVElPTl9PUlRIT0dSQVBISUMsIFBST0pFQ1RJT05fUEVSU1BFQ1RJVkUsXG4gICAgQVNQRUNUX01BTlVBTCwgQVNQRUNUX0FVVE8sIFNQRUNPQ0NfQU9cbn0gZnJvbSAnLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgY2FsY3VsYXRlTm9ybWFscyB9IGZyb20gJy4uLy4uL3NjZW5lL3Byb2NlZHVyYWwuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBMaWdodCwgbGlnaHRUeXBlcyB9IGZyb20gJy4uLy4uL3NjZW5lL2xpZ2h0LmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IE1vcnBoIH0gZnJvbSAnLi4vLi4vc2NlbmUvbW9ycGguanMnO1xuaW1wb3J0IHsgTW9ycGhUYXJnZXQgfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uLy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBSZW5kZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9yZW5kZXIuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuLi8uLi9mcmFtZXdvcmsvZW50aXR5LmpzJztcblxuaW1wb3J0IHsgQW5pbUN1cnZlIH0gZnJvbSAnLi4vLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBBbmltRGF0YSB9IGZyb20gJy4uLy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyc7XG5pbXBvcnQgeyBBbmltVHJhY2sgfSBmcm9tICcuLi8uLi9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzJztcblxuaW1wb3J0IHsgSU5URVJQT0xBVElPTl9DVUJJQywgSU5URVJQT0xBVElPTl9MSU5FQVIsIElOVEVSUE9MQVRJT05fU1RFUCB9IGZyb20gJy4uLy4uL2FuaW0vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IEdsYkNvbnRhaW5lclJlc291cmNlIH0gZnJvbSAnLi9nbGItY29udGFpbmVyLXJlc291cmNlLmpzJztcblxuaW1wb3J0IHsgV2FzbU1vZHVsZSB9IGZyb20gJy4uLy4uL2NvcmUvd2FzbS1tb2R1bGUuanMnO1xuXG4vLyBpbnN0YW5jZSBvZiB0aGUgZHJhY28gZGVjb2RlclxubGV0IGRyYWNvRGVjb2Rlckluc3RhbmNlID0gbnVsbDtcblxuY29uc3QgZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlID0gKCkgPT4ge1xuICAgIHJldHVybiB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuRHJhY29EZWNvZGVyTW9kdWxlO1xufTtcblxuLy8gcmVzb3VyY2VzIGxvYWRlZCBmcm9tIEdMQiBmaWxlIHRoYXQgdGhlIHBhcnNlciByZXR1cm5zXG5jbGFzcyBHbGJSZXNvdXJjZXMge1xuICAgIGNvbnN0cnVjdG9yKGdsdGYpIHtcbiAgICAgICAgdGhpcy5nbHRmID0gZ2x0ZjtcbiAgICAgICAgdGhpcy5ub2RlcyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2NlbmVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5hbmltYXRpb25zID0gbnVsbDtcbiAgICAgICAgdGhpcy50ZXh0dXJlcyA9IG51bGw7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy52YXJpYW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaFZhcmlhbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5tZXNoRGVmYXVsdE1hdGVyaWFscyA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVycyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2tpbnMgPSBudWxsO1xuICAgICAgICB0aGlzLmxpZ2h0cyA9IG51bGw7XG4gICAgICAgIHRoaXMuY2FtZXJhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gcmVuZGVyIG5lZWRzIHRvIGRlYyByZWYgbWVzaGVzXG4gICAgICAgIGlmICh0aGlzLnJlbmRlcnMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVycy5mb3JFYWNoKChyZW5kZXIpID0+IHtcbiAgICAgICAgICAgICAgICByZW5kZXIubWVzaGVzID0gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBpc0RhdGFVUkkgPSBmdW5jdGlvbiAodXJpKSB7XG4gICAgcmV0dXJuIC9eZGF0YTouKiwuKiQvaS50ZXN0KHVyaSk7XG59O1xuXG5jb25zdCBnZXREYXRhVVJJTWltZVR5cGUgPSBmdW5jdGlvbiAodXJpKSB7XG4gICAgcmV0dXJuIHVyaS5zdWJzdHJpbmcodXJpLmluZGV4T2YoJzonKSArIDEsIHVyaS5pbmRleE9mKCc7JykpO1xufTtcblxuY29uc3QgZ2V0TnVtQ29tcG9uZW50cyA9IGZ1bmN0aW9uIChhY2Nlc3NvclR5cGUpIHtcbiAgICBzd2l0Y2ggKGFjY2Vzc29yVHlwZSkge1xuICAgICAgICBjYXNlICdTQ0FMQVInOiByZXR1cm4gMTtcbiAgICAgICAgY2FzZSAnVkVDMic6IHJldHVybiAyO1xuICAgICAgICBjYXNlICdWRUMzJzogcmV0dXJuIDM7XG4gICAgICAgIGNhc2UgJ1ZFQzQnOiByZXR1cm4gNDtcbiAgICAgICAgY2FzZSAnTUFUMic6IHJldHVybiA0O1xuICAgICAgICBjYXNlICdNQVQzJzogcmV0dXJuIDk7XG4gICAgICAgIGNhc2UgJ01BVDQnOiByZXR1cm4gMTY7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAzO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudFR5cGUgPSBmdW5jdGlvbiAoY29tcG9uZW50VHlwZSkge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiBUWVBFX0lOVDg7XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIFRZUEVfVUlOVDg7XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIFRZUEVfSU5UMTY7XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIFRZUEVfVUlOVDE2O1xuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiBUWVBFX0lOVDMyO1xuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiBUWVBFX1VJTlQzMjtcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gVFlQRV9GTE9BVDMyO1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gMDtcbiAgICB9XG59O1xuXG5jb25zdCBnZXRDb21wb25lbnRTaXplSW5CeXRlcyA9IGZ1bmN0aW9uIChjb21wb25lbnRUeXBlKSB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIDE7ICAgIC8vIGludDhcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gMTsgICAgLy8gdWludDhcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gMjsgICAgLy8gaW50MTZcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gMjsgICAgLy8gdWludDE2XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIDQ7ICAgIC8vIGludDMyXG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIDQ7ICAgIC8vIHVpbnQzMlxuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiA0OyAgICAvLyBmbG9hdDMyXG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAwO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudERhdGFUeXBlID0gZnVuY3Rpb24gKGNvbXBvbmVudFR5cGUpIHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gSW50OEFycmF5O1xuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiBVaW50OEFycmF5O1xuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiBJbnQxNkFycmF5O1xuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiBVaW50MTZBcnJheTtcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gSW50MzJBcnJheTtcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gVWludDMyQXJyYXk7XG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIEZsb2F0MzJBcnJheTtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuY29uc3QgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAgPSB7XG4gICAgJ1BPU0lUSU9OJzogU0VNQU5USUNfUE9TSVRJT04sXG4gICAgJ05PUk1BTCc6IFNFTUFOVElDX05PUk1BTCxcbiAgICAnVEFOR0VOVCc6IFNFTUFOVElDX1RBTkdFTlQsXG4gICAgJ0NPTE9SXzAnOiBTRU1BTlRJQ19DT0xPUixcbiAgICAnSk9JTlRTXzAnOiBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgJ1dFSUdIVFNfMCc6IFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgICdURVhDT09SRF8wJzogU0VNQU5USUNfVEVYQ09PUkQwLFxuICAgICdURVhDT09SRF8xJzogU0VNQU5USUNfVEVYQ09PUkQxLFxuICAgICdURVhDT09SRF8yJzogU0VNQU5USUNfVEVYQ09PUkQyLFxuICAgICdURVhDT09SRF8zJzogU0VNQU5USUNfVEVYQ09PUkQzLFxuICAgICdURVhDT09SRF80JzogU0VNQU5USUNfVEVYQ09PUkQ0LFxuICAgICdURVhDT09SRF81JzogU0VNQU5USUNfVEVYQ09PUkQ1LFxuICAgICdURVhDT09SRF82JzogU0VNQU5USUNfVEVYQ09PUkQ2LFxuICAgICdURVhDT09SRF83JzogU0VNQU5USUNfVEVYQ09PUkQ3XG59O1xuXG4vLyByZXR1cm5zIGEgZnVuY3Rpb24gZm9yIGRlcXVhbnRpemluZyB0aGUgZGF0YSB0eXBlXG5jb25zdCBnZXREZXF1YW50aXplRnVuYyA9IChzcmNUeXBlKSA9PiB7XG4gICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9LaHJvbm9zR3JvdXAvZ2xURi90cmVlL21hc3Rlci9leHRlbnNpb25zLzIuMC9LaHJvbm9zL0tIUl9tZXNoX3F1YW50aXphdGlvbiNlbmNvZGluZy1xdWFudGl6ZWQtZGF0YVxuICAgIHN3aXRjaCAoc3JjVHlwZSkge1xuICAgICAgICBjYXNlIFRZUEVfSU5UODogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDEyNy4wLCAtMS4wKTtcbiAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OiByZXR1cm4geCA9PiB4IC8gMjU1LjA7XG4gICAgICAgIGNhc2UgVFlQRV9JTlQxNjogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDMyNzY3LjAsIC0xLjApO1xuICAgICAgICBjYXNlIFRZUEVfVUlOVDE2OiByZXR1cm4geCA9PiB4IC8gNjU1MzUuMDtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIHggPT4geDtcbiAgICB9XG59O1xuXG4vLyBkZXF1YW50aXplIGFuIGFycmF5IG9mIGRhdGFcbmNvbnN0IGRlcXVhbnRpemVBcnJheSA9IGZ1bmN0aW9uIChkc3RBcnJheSwgc3JjQXJyYXksIHNyY1R5cGUpIHtcbiAgICBjb25zdCBjb252RnVuYyA9IGdldERlcXVhbnRpemVGdW5jKHNyY1R5cGUpO1xuICAgIGNvbnN0IGxlbiA9IHNyY0FycmF5Lmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIGRzdEFycmF5W2ldID0gY29udkZ1bmMoc3JjQXJyYXlbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gZHN0QXJyYXk7XG59O1xuXG4vLyBnZXQgYWNjZXNzb3IgZGF0YSwgbWFraW5nIGEgY29weSBhbmQgcGF0Y2hpbmcgaW4gdGhlIGNhc2Ugb2YgYSBzcGFyc2UgYWNjZXNzb3JcbmNvbnN0IGdldEFjY2Vzc29yRGF0YSA9IGZ1bmN0aW9uIChnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCBmbGF0dGVuID0gZmFsc2UpIHtcbiAgICBjb25zdCBudW1Db21wb25lbnRzID0gZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSk7XG4gICAgY29uc3QgZGF0YVR5cGUgPSBnZXRDb21wb25lbnREYXRhVHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgaWYgKCFkYXRhVHlwZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBidWZmZXJWaWV3ID0gYnVmZmVyVmlld3NbZ2x0ZkFjY2Vzc29yLmJ1ZmZlclZpZXddO1xuICAgIGxldCByZXN1bHQ7XG5cbiAgICBpZiAoZ2x0ZkFjY2Vzc29yLnNwYXJzZSkge1xuICAgICAgICAvLyBoYW5kbGUgc3BhcnNlIGRhdGFcbiAgICAgICAgY29uc3Qgc3BhcnNlID0gZ2x0ZkFjY2Vzc29yLnNwYXJzZTtcblxuICAgICAgICAvLyBnZXQgaW5kaWNlcyBkYXRhXG4gICAgICAgIGNvbnN0IGluZGljZXNBY2Nlc3NvciA9IHtcbiAgICAgICAgICAgIGNvdW50OiBzcGFyc2UuY291bnQsXG4gICAgICAgICAgICB0eXBlOiAnU0NBTEFSJ1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBpbmRpY2VzID0gZ2V0QWNjZXNzb3JEYXRhKE9iamVjdC5hc3NpZ24oaW5kaWNlc0FjY2Vzc29yLCBzcGFyc2UuaW5kaWNlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBkYXRhIHZhbHVlcyBkYXRhXG4gICAgICAgIGNvbnN0IHZhbHVlc0FjY2Vzc29yID0ge1xuICAgICAgICAgICAgY291bnQ6IHNwYXJzZS5jb3VudCxcbiAgICAgICAgICAgIHR5cGU6IGdsdGZBY2Nlc3Nvci5zY2FsYXIsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiBnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbih2YWx1ZXNBY2Nlc3Nvciwgc3BhcnNlLnZhbHVlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBnZXQgYmFzZSBkYXRhXG4gICAgICAgIGlmIChnbHRmQWNjZXNzb3IuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUFjY2Vzc29yID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXc6IGdsdGZBY2Nlc3Nvci5idWZmZXJWaWV3LFxuICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXQ6IGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgIGNvdW50OiBnbHRmQWNjZXNzb3IuY291bnQsXG4gICAgICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYmFzZSBkYXRhIHNpbmNlIHdlJ2xsIHBhdGNoIHRoZSB2YWx1ZXNcbiAgICAgICAgICAgIHJlc3VsdCA9IGdldEFjY2Vzc29yRGF0YShiYXNlQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKS5zbGljZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gYmFzZSBkYXRhLCBjcmVhdGUgZW1wdHkgMCdkIG91dCBkYXRhXG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvdW50ICogbnVtQ29tcG9uZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwYXJzZS5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRJbmRleCA9IGluZGljZXNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bUNvbXBvbmVudHM7ICsraikge1xuICAgICAgICAgICAgICAgIHJlc3VsdFt0YXJnZXRJbmRleCAqIG51bUNvbXBvbmVudHMgKyBqXSA9IHZhbHVlc1tpICogbnVtQ29tcG9uZW50cyArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChmbGF0dGVuICYmIGJ1ZmZlclZpZXcuaGFzT3duUHJvcGVydHkoJ2J5dGVTdHJpZGUnKSkge1xuICAgICAgICAvLyBmbGF0dGVuIHN0cmlkZGVuIGRhdGFcbiAgICAgICAgY29uc3QgYnl0ZXNQZXJFbGVtZW50ID0gbnVtQ29tcG9uZW50cyAqIGRhdGFUeXBlLkJZVEVTX1BFUl9FTEVNRU5UO1xuICAgICAgICBjb25zdCBzdG9yYWdlID0gbmV3IEFycmF5QnVmZmVyKGdsdGZBY2Nlc3Nvci5jb3VudCAqIGJ5dGVzUGVyRWxlbWVudCk7XG4gICAgICAgIGNvbnN0IHRtcEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoc3RvcmFnZSk7XG5cbiAgICAgICAgbGV0IGRzdE9mZnNldCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0ZkFjY2Vzc29yLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gYWRkIGJ1ZmZlclZpZXcuYnl0ZU9mZnNldCBiZWNhdXNlIGFjY2Vzc29yIHRha2VzIHRoaXMgaW50byBhY2NvdW50XG4gICAgICAgICAgICBsZXQgc3JjT2Zmc2V0ID0gKGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0IHx8IDApICsgaSAqIGJ1ZmZlclZpZXcuYnl0ZVN0cmlkZTtcbiAgICAgICAgICAgIGZvciAobGV0IGIgPSAwOyBiIDwgYnl0ZXNQZXJFbGVtZW50OyArK2IpIHtcbiAgICAgICAgICAgICAgICB0bXBBcnJheVtkc3RPZmZzZXQrK10gPSBidWZmZXJWaWV3W3NyY09mZnNldCsrXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlc3VsdCA9IG5ldyBkYXRhVHlwZShzdG9yYWdlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoYnVmZmVyVmlldy5idWZmZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVPZmZzZXQgKyAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbHRmQWNjZXNzb3IuY291bnQgKiBudW1Db21wb25lbnRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLy8gZ2V0IGFjY2Vzc29yIGRhdGEgYXMgKHVubm9ybWFsaXplZCwgdW5xdWFudGl6ZWQpIEZsb2F0MzIgZGF0YVxuY29uc3QgZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMiA9IGZ1bmN0aW9uIChnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzKSB7XG4gICAgY29uc3QgZGF0YSA9IGdldEFjY2Vzc29yRGF0YShnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKTtcbiAgICBpZiAoZGF0YSBpbnN0YW5jZW9mIEZsb2F0MzJBcnJheSB8fCAhZ2x0ZkFjY2Vzc29yLm5vcm1hbGl6ZWQpIHtcbiAgICAgICAgLy8gaWYgdGhlIHNvdXJjZSBkYXRhIGlzIHF1YW50aXplZCAoc2F5IHRvIGludDE2KSwgYnV0IG5vdCBub3JtYWxpemVkXG4gICAgICAgIC8vIHRoZW4gcmVhZGluZyB0aGUgdmFsdWVzIG9mIHRoZSBhcnJheSBpcyB0aGUgc2FtZSB3aGV0aGVyIHRoZSB2YWx1ZXNcbiAgICAgICAgLy8gYXJlIHN0b3JlZCBhcyBmbG9hdDMyIG9yIGludDE2LiBzbyBwcm9iYWJseSBubyBuZWVkIHRvIGNvbnZlcnQgdG9cbiAgICAgICAgLy8gZmxvYXQzMi5cbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuXG4gICAgY29uc3QgZmxvYXQzMkRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KGRhdGEubGVuZ3RoKTtcbiAgICBkZXF1YW50aXplQXJyYXkoZmxvYXQzMkRhdGEsIGRhdGEsIGdldENvbXBvbmVudFR5cGUoZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUpKTtcbiAgICByZXR1cm4gZmxvYXQzMkRhdGE7XG59O1xuXG4vLyByZXR1cm5zIGEgZGVxdWFudGl6ZWQgYm91bmRpbmcgYm94IGZvciB0aGUgYWNjZXNzb3JcbmNvbnN0IGdldEFjY2Vzc29yQm91bmRpbmdCb3ggPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yKSB7XG4gICAgbGV0IG1pbiA9IGdsdGZBY2Nlc3Nvci5taW47XG4gICAgbGV0IG1heCA9IGdsdGZBY2Nlc3Nvci5tYXg7XG4gICAgaWYgKCFtaW4gfHwgIW1heCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoZ2x0ZkFjY2Vzc29yLm5vcm1hbGl6ZWQpIHtcbiAgICAgICAgY29uc3QgY3R5cGUgPSBnZXRDb21wb25lbnRUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgbWluID0gZGVxdWFudGl6ZUFycmF5KFtdLCBtaW4sIGN0eXBlKTtcbiAgICAgICAgbWF4ID0gZGVxdWFudGl6ZUFycmF5KFtdLCBtYXgsIGN0eXBlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEJvdW5kaW5nQm94KFxuICAgICAgICBuZXcgVmVjMygobWF4WzBdICsgbWluWzBdKSAqIDAuNSwgKG1heFsxXSArIG1pblsxXSkgKiAwLjUsIChtYXhbMl0gKyBtaW5bMl0pICogMC41KSxcbiAgICAgICAgbmV3IFZlYzMoKG1heFswXSAtIG1pblswXSkgKiAwLjUsIChtYXhbMV0gLSBtaW5bMV0pICogMC41LCAobWF4WzJdIC0gbWluWzJdKSAqIDAuNSlcbiAgICApO1xufTtcblxuY29uc3QgZ2V0UHJpbWl0aXZlVHlwZSA9IGZ1bmN0aW9uIChwcmltaXRpdmUpIHtcbiAgICBpZiAoIXByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgnbW9kZScpKSB7XG4gICAgICAgIHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgIH1cblxuICAgIHN3aXRjaCAocHJpbWl0aXZlLm1vZGUpIHtcbiAgICAgICAgY2FzZSAwOiByZXR1cm4gUFJJTUlUSVZFX1BPSU5UUztcbiAgICAgICAgY2FzZSAxOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVTO1xuICAgICAgICBjYXNlIDI6IHJldHVybiBQUklNSVRJVkVfTElORUxPT1A7XG4gICAgICAgIGNhc2UgMzogcmV0dXJuIFBSSU1JVElWRV9MSU5FU1RSSVA7XG4gICAgICAgIGNhc2UgNDogcmV0dXJuIFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgICAgIGNhc2UgNTogcmV0dXJuIFBSSU1JVElWRV9UUklTVFJJUDtcbiAgICAgICAgY2FzZSA2OiByZXR1cm4gUFJJTUlUSVZFX1RSSUZBTjtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgfVxufTtcblxuY29uc3QgZ2VuZXJhdGVJbmRpY2VzID0gZnVuY3Rpb24gKG51bVZlcnRpY2VzKSB7XG4gICAgY29uc3QgZHVtbXlJbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KG51bVZlcnRpY2VzKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bVZlcnRpY2VzOyBpKyspIHtcbiAgICAgICAgZHVtbXlJbmRpY2VzW2ldID0gaTtcbiAgICB9XG4gICAgcmV0dXJuIGR1bW15SW5kaWNlcztcbn07XG5cbmNvbnN0IGdlbmVyYXRlTm9ybWFscyA9IGZ1bmN0aW9uIChzb3VyY2VEZXNjLCBpbmRpY2VzKSB7XG4gICAgLy8gZ2V0IHBvc2l0aW9uc1xuICAgIGNvbnN0IHAgPSBzb3VyY2VEZXNjW1NFTUFOVElDX1BPU0lUSU9OXTtcbiAgICBpZiAoIXAgfHwgcC5jb21wb25lbnRzICE9PSAzKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgcG9zaXRpb25zO1xuICAgIGlmIChwLnNpemUgIT09IHAuc3RyaWRlKSB7XG4gICAgICAgIC8vIGV4dHJhY3QgcG9zaXRpb25zIHdoaWNoIGFyZW4ndCB0aWdodGx5IHBhY2tlZFxuICAgICAgICBjb25zdCBzcmNTdHJpZGUgPSBwLnN0cmlkZSAvIHR5cGVkQXJyYXlUeXBlc0J5dGVTaXplW3AudHlwZV07XG4gICAgICAgIGNvbnN0IHNyYyA9IG5ldyB0eXBlZEFycmF5VHlwZXNbcC50eXBlXShwLmJ1ZmZlciwgcC5vZmZzZXQsIHAuY291bnQgKiBzcmNTdHJpZGUpO1xuICAgICAgICBwb3NpdGlvbnMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5jb3VudCAqIDMpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHAuY291bnQ7ICsraSkge1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAzICsgMF0gPSBzcmNbaSAqIHNyY1N0cmlkZSArIDBdO1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAzICsgMV0gPSBzcmNbaSAqIHNyY1N0cmlkZSArIDFdO1xuICAgICAgICAgICAgcG9zaXRpb25zW2kgKiAzICsgMl0gPSBzcmNbaSAqIHNyY1N0cmlkZSArIDJdO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gcG9zaXRpb24gZGF0YSBpcyB0aWdodGx5IHBhY2tlZCBzbyB3ZSBjYW4gdXNlIGl0IGRpcmVjdGx5XG4gICAgICAgIHBvc2l0aW9ucyA9IG5ldyB0eXBlZEFycmF5VHlwZXNbcC50eXBlXShwLmJ1ZmZlciwgcC5vZmZzZXQsIHAuY291bnQgKiAzKTtcbiAgICB9XG5cbiAgICBjb25zdCBudW1WZXJ0aWNlcyA9IHAuY291bnQ7XG5cbiAgICAvLyBnZW5lcmF0ZSBpbmRpY2VzIGlmIG5lY2Vzc2FyeVxuICAgIGlmICghaW5kaWNlcykge1xuICAgICAgICBpbmRpY2VzID0gZ2VuZXJhdGVJbmRpY2VzKG51bVZlcnRpY2VzKTtcbiAgICB9XG5cbiAgICAvLyBnZW5lcmF0ZSBub3JtYWxzXG4gICAgY29uc3Qgbm9ybWFsc1RlbXAgPSBjYWxjdWxhdGVOb3JtYWxzKHBvc2l0aW9ucywgaW5kaWNlcyk7XG4gICAgY29uc3Qgbm9ybWFscyA9IG5ldyBGbG9hdDMyQXJyYXkobm9ybWFsc1RlbXAubGVuZ3RoKTtcbiAgICBub3JtYWxzLnNldChub3JtYWxzVGVtcCk7XG5cbiAgICBzb3VyY2VEZXNjW1NFTUFOVElDX05PUk1BTF0gPSB7XG4gICAgICAgIGJ1ZmZlcjogbm9ybWFscy5idWZmZXIsXG4gICAgICAgIHNpemU6IDEyLFxuICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgIHN0cmlkZTogMTIsXG4gICAgICAgIGNvdW50OiBudW1WZXJ0aWNlcyxcbiAgICAgICAgY29tcG9uZW50czogMyxcbiAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgfTtcbn07XG5cbmNvbnN0IGZsaXBUZXhDb29yZFZzID0gZnVuY3Rpb24gKHZlcnRleEJ1ZmZlcikge1xuICAgIGxldCBpLCBqO1xuXG4gICAgY29uc3QgZmxvYXRPZmZzZXRzID0gW107XG4gICAgY29uc3Qgc2hvcnRPZmZzZXRzID0gW107XG4gICAgY29uc3QgYnl0ZU9mZnNldHMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgaWYgKGVsZW1lbnQubmFtZSA9PT0gU0VNQU5USUNfVEVYQ09PUkQwIHx8XG4gICAgICAgICAgICBlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMSkge1xuICAgICAgICAgICAgc3dpdGNoIChlbGVtZW50LmRhdGFUeXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX0ZMT0FUMzI6XG4gICAgICAgICAgICAgICAgICAgIGZsb2F0T2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCAvIDQgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIC8gNCB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQxNjpcbiAgICAgICAgICAgICAgICAgICAgc2hvcnRPZmZzZXRzLnB1c2goeyBvZmZzZXQ6IGVsZW1lbnQub2Zmc2V0IC8gMiArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgLyAyIH0pO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFRZUEVfVUlOVDg6XG4gICAgICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXRzLnB1c2goeyBvZmZzZXQ6IGVsZW1lbnQub2Zmc2V0ICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBmbGlwID0gZnVuY3Rpb24gKG9mZnNldHMsIHR5cGUsIG9uZSkge1xuICAgICAgICBjb25zdCB0eXBlZEFycmF5ID0gbmV3IHR5cGUodmVydGV4QnVmZmVyLnN0b3JhZ2UpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgb2Zmc2V0cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gb2Zmc2V0c1tpXS5vZmZzZXQ7XG4gICAgICAgICAgICBjb25zdCBzdHJpZGUgPSBvZmZzZXRzW2ldLnN0cmlkZTtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCB2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7ICsraikge1xuICAgICAgICAgICAgICAgIHR5cGVkQXJyYXlbaW5kZXhdID0gb25lIC0gdHlwZWRBcnJheVtpbmRleF07XG4gICAgICAgICAgICAgICAgaW5kZXggKz0gc3RyaWRlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIGlmIChmbG9hdE9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKGZsb2F0T2Zmc2V0cywgRmxvYXQzMkFycmF5LCAxLjApO1xuICAgIH1cbiAgICBpZiAoc2hvcnRPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChzaG9ydE9mZnNldHMsIFVpbnQxNkFycmF5LCA2NTUzNSk7XG4gICAgfVxuICAgIGlmIChieXRlT2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoYnl0ZU9mZnNldHMsIFVpbnQ4QXJyYXksIDI1NSk7XG4gICAgfVxufTtcblxuLy8gZ2l2ZW4gYSB0ZXh0dXJlLCBjbG9uZSBpdFxuLy8gTk9URTogQ1BVLXNpZGUgdGV4dHVyZSBkYXRhIHdpbGwgYmUgc2hhcmVkIGJ1dCBHUFUgbWVtb3J5IHdpbGwgYmUgZHVwbGljYXRlZFxuY29uc3QgY2xvbmVUZXh0dXJlID0gZnVuY3Rpb24gKHRleHR1cmUpIHtcbiAgICBjb25zdCBzaGFsbG93Q29weUxldmVscyA9IGZ1bmN0aW9uICh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgICAgICBmb3IgKGxldCBtaXAgPSAwOyBtaXAgPCB0ZXh0dXJlLl9sZXZlbHMubGVuZ3RoOyArK21pcCkge1xuICAgICAgICAgICAgbGV0IGxldmVsID0gW107XG4gICAgICAgICAgICBpZiAodGV4dHVyZS5jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyArK2ZhY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV2ZWwucHVzaCh0ZXh0dXJlLl9sZXZlbHNbbWlwXVtmYWNlXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXZlbCA9IHRleHR1cmUuX2xldmVsc1ttaXBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzdWx0LnB1c2gobGV2ZWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBUZXh0dXJlKHRleHR1cmUuZGV2aWNlLCB0ZXh0dXJlKTsgICAvLyBkdXBsaWNhdGUgdGV4dHVyZVxuICAgIHJlc3VsdC5fbGV2ZWxzID0gc2hhbGxvd0NvcHlMZXZlbHModGV4dHVyZSk7ICAgICAgICAgICAgLy8gc2hhbGxvdyBjb3B5IHRoZSBsZXZlbHMgc3RydWN0dXJlXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdpdmVuIGEgdGV4dHVyZSBhc3NldCwgY2xvbmUgaXRcbmNvbnN0IGNsb25lVGV4dHVyZUFzc2V0ID0gZnVuY3Rpb24gKHNyYykge1xuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBBc3NldChzcmMubmFtZSArICdfY2xvbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLmZpbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5kYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMub3B0aW9ucyk7XG4gICAgcmVzdWx0LmxvYWRlZCA9IHRydWU7XG4gICAgcmVzdWx0LnJlc291cmNlID0gY2xvbmVUZXh0dXJlKHNyYy5yZXNvdXJjZSk7XG4gICAgc3JjLnJlZ2lzdHJ5LmFkZChyZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbCA9IGZ1bmN0aW9uIChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKSB7XG4gICAgY29uc3QgcG9zaXRpb25EZXNjID0gc291cmNlRGVzY1tTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgaWYgKCFwb3NpdGlvbkRlc2MpIHtcbiAgICAgICAgLy8gaWdub3JlIG1lc2hlcyB3aXRob3V0IHBvc2l0aW9uc1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgbnVtVmVydGljZXMgPSBwb3NpdGlvbkRlc2MuY291bnQ7XG5cbiAgICAvLyBnZW5lcmF0ZSB2ZXJ0ZXhEZXNjIGVsZW1lbnRzXG4gICAgY29uc3QgdmVydGV4RGVzYyA9IFtdO1xuICAgIGZvciAoY29uc3Qgc2VtYW50aWMgaW4gc291cmNlRGVzYykge1xuICAgICAgICBpZiAoc291cmNlRGVzYy5oYXNPd25Qcm9wZXJ0eShzZW1hbnRpYykpIHtcbiAgICAgICAgICAgIHZlcnRleERlc2MucHVzaCh7XG4gICAgICAgICAgICAgICAgc2VtYW50aWM6IHNlbWFudGljLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IHNvdXJjZURlc2Nbc2VtYW50aWNdLmNvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgdHlwZTogc291cmNlRGVzY1tzZW1hbnRpY10udHlwZSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6ICEhc291cmNlRGVzY1tzZW1hbnRpY10ubm9ybWFsaXplXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIG9yZGVyIHZlcnRleERlc2MgdG8gbWF0Y2ggdGhlIHJlc3Qgb2YgdGhlIGVuZ2luZVxuICAgIGNvbnN0IGVsZW1lbnRPcmRlciA9IFtcbiAgICAgICAgU0VNQU5USUNfUE9TSVRJT04sXG4gICAgICAgIFNFTUFOVElDX05PUk1BTCxcbiAgICAgICAgU0VNQU5USUNfVEFOR0VOVCxcbiAgICAgICAgU0VNQU5USUNfQ09MT1IsXG4gICAgICAgIFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICAgICAgU0VNQU5USUNfQkxFTkRXRUlHSFQsXG4gICAgICAgIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICAgICAgU0VNQU5USUNfVEVYQ09PUkQxXG4gICAgXTtcblxuICAgIC8vIHNvcnQgdmVydGV4IGVsZW1lbnRzIGJ5IGVuZ2luZS1pZGVhbCBvcmRlclxuICAgIHZlcnRleERlc2Muc29ydChmdW5jdGlvbiAobGhzLCByaHMpIHtcbiAgICAgICAgY29uc3QgbGhzT3JkZXIgPSBlbGVtZW50T3JkZXIuaW5kZXhPZihsaHMuc2VtYW50aWMpO1xuICAgICAgICBjb25zdCByaHNPcmRlciA9IGVsZW1lbnRPcmRlci5pbmRleE9mKHJocy5zZW1hbnRpYyk7XG4gICAgICAgIHJldHVybiAobGhzT3JkZXIgPCByaHNPcmRlcikgPyAtMSA6IChyaHNPcmRlciA8IGxoc09yZGVyID8gMSA6IDApO1xuICAgIH0pO1xuXG4gICAgbGV0IGksIGosIGs7XG4gICAgbGV0IHNvdXJjZSwgdGFyZ2V0LCBzb3VyY2VPZmZzZXQ7XG5cbiAgICBjb25zdCB2ZXJ0ZXhGb3JtYXQgPSBuZXcgVmVydGV4Rm9ybWF0KGRldmljZSwgdmVydGV4RGVzYyk7XG5cbiAgICAvLyBjaGVjayB3aGV0aGVyIHNvdXJjZSBkYXRhIGlzIGNvcnJlY3RseSBpbnRlcmxlYXZlZFxuICAgIGxldCBpc0NvcnJlY3RseUludGVybGVhdmVkID0gdHJ1ZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4Rm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHRhcmdldCA9IHZlcnRleEZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgc291cmNlID0gc291cmNlRGVzY1t0YXJnZXQubmFtZV07XG4gICAgICAgIHNvdXJjZU9mZnNldCA9IHNvdXJjZS5vZmZzZXQgLSBwb3NpdGlvbkRlc2Mub2Zmc2V0O1xuICAgICAgICBpZiAoKHNvdXJjZS5idWZmZXIgIT09IHBvc2l0aW9uRGVzYy5idWZmZXIpIHx8XG4gICAgICAgICAgICAoc291cmNlLnN0cmlkZSAhPT0gdGFyZ2V0LnN0cmlkZSkgfHxcbiAgICAgICAgICAgIChzb3VyY2Uuc2l6ZSAhPT0gdGFyZ2V0LnNpemUpIHx8XG4gICAgICAgICAgICAoc291cmNlT2Zmc2V0ICE9PSB0YXJnZXQub2Zmc2V0KSkge1xuICAgICAgICAgICAgaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgdmVydGV4IGJ1ZmZlclxuICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIoZGV2aWNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVydGV4Rm9ybWF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmVydGljZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBCVUZGRVJfU1RBVElDKTtcblxuICAgIGNvbnN0IHZlcnRleERhdGEgPSB2ZXJ0ZXhCdWZmZXIubG9jaygpO1xuICAgIGNvbnN0IHRhcmdldEFycmF5ID0gbmV3IFVpbnQzMkFycmF5KHZlcnRleERhdGEpO1xuICAgIGxldCBzb3VyY2VBcnJheTtcblxuICAgIGlmIChpc0NvcnJlY3RseUludGVybGVhdmVkKSB7XG4gICAgICAgIC8vIGNvcHkgZGF0YVxuICAgICAgICBzb3VyY2VBcnJheSA9IG5ldyBVaW50MzJBcnJheShwb3NpdGlvbkRlc2MuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbkRlc2Mub2Zmc2V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1WZXJ0aWNlcyAqIHZlcnRleEJ1ZmZlci5mb3JtYXQuc2l6ZSAvIDQpO1xuICAgICAgICB0YXJnZXRBcnJheS5zZXQoc291cmNlQXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCB0YXJnZXRTdHJpZGUsIHNvdXJjZVN0cmlkZTtcbiAgICAgICAgLy8gY29weSBkYXRhIGFuZCBpbnRlcmxlYXZlXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB0YXJnZXQgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzW2ldO1xuICAgICAgICAgICAgdGFyZ2V0U3RyaWRlID0gdGFyZ2V0LnN0cmlkZSAvIDQ7XG5cbiAgICAgICAgICAgIHNvdXJjZSA9IHNvdXJjZURlc2NbdGFyZ2V0Lm5hbWVdO1xuICAgICAgICAgICAgc291cmNlU3RyaWRlID0gc291cmNlLnN0cmlkZSAvIDQ7XG4gICAgICAgICAgICAvLyBlbnN1cmUgd2UgZG9uJ3QgZ28gYmV5b25kIHRoZSBlbmQgb2YgdGhlIGFycmF5YnVmZmVyIHdoZW4gZGVhbGluZyB3aXRoXG4gICAgICAgICAgICAvLyBpbnRlcmxhY2VkIHZlcnRleCBmb3JtYXRzXG4gICAgICAgICAgICBzb3VyY2VBcnJheSA9IG5ldyBVaW50MzJBcnJheShzb3VyY2UuYnVmZmVyLCBzb3VyY2Uub2Zmc2V0LCAoc291cmNlLmNvdW50IC0gMSkgKiBzb3VyY2VTdHJpZGUgKyAoc291cmNlLnNpemUgKyAzKSAvIDQpO1xuXG4gICAgICAgICAgICBsZXQgc3JjID0gMDtcbiAgICAgICAgICAgIGxldCBkc3QgPSB0YXJnZXQub2Zmc2V0IC8gNDtcbiAgICAgICAgICAgIGNvbnN0IGtlbmQgPSBNYXRoLmZsb29yKChzb3VyY2Uuc2l6ZSArIDMpIC8gNCk7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgbnVtVmVydGljZXM7ICsraikge1xuICAgICAgICAgICAgICAgIGZvciAoayA9IDA7IGsgPCBrZW5kOyArK2spIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0QXJyYXlbZHN0ICsga10gPSBzb3VyY2VBcnJheVtzcmMgKyBrXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3JjICs9IHNvdXJjZVN0cmlkZTtcbiAgICAgICAgICAgICAgICBkc3QgKz0gdGFyZ2V0U3RyaWRlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIGZsaXBUZXhDb29yZFZzKHZlcnRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgdmVydGV4QnVmZmVyLnVubG9jaygpO1xuXG4gICAgcmV0dXJuIHZlcnRleEJ1ZmZlcjtcbn07XG5cbmNvbnN0IGNyZWF0ZVZlcnRleEJ1ZmZlciA9IGZ1bmN0aW9uIChkZXZpY2UsIGF0dHJpYnV0ZXMsIGluZGljZXMsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0KSB7XG5cbiAgICAvLyBleHRyYWN0IGxpc3Qgb2YgYXR0cmlidXRlcyB0byB1c2VcbiAgICBjb25zdCB1c2VBdHRyaWJ1dGVzID0ge307XG4gICAgY29uc3QgYXR0cmliSWRzID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHJpYikgJiYgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAuaGFzT3duUHJvcGVydHkoYXR0cmliKSkge1xuICAgICAgICAgICAgdXNlQXR0cmlidXRlc1thdHRyaWJdID0gYXR0cmlidXRlc1thdHRyaWJdO1xuXG4gICAgICAgICAgICAvLyBidWlsZCB1bmlxdWUgaWQgZm9yIGVhY2ggYXR0cmlidXRlIGluIGZvcm1hdDogU2VtYW50aWM6YWNjZXNzb3JJbmRleFxuICAgICAgICAgICAgYXR0cmliSWRzLnB1c2goYXR0cmliICsgJzonICsgYXR0cmlidXRlc1thdHRyaWJdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdW5pcXVlIGlkcyBhbmQgY3JlYXRlIHVuaXF1ZSB2ZXJ0ZXggYnVmZmVyIElEXG4gICAgYXR0cmliSWRzLnNvcnQoKTtcbiAgICBjb25zdCB2YktleSA9IGF0dHJpYklkcy5qb2luKCk7XG5cbiAgICAvLyByZXR1cm4gYWxyZWFkeSBjcmVhdGVkIHZlcnRleCBidWZmZXIgaWYgaWRlbnRpY2FsXG4gICAgbGV0IHZiID0gdmVydGV4QnVmZmVyRGljdFt2YktleV07XG4gICAgaWYgKCF2Yikge1xuICAgICAgICAvLyBidWlsZCB2ZXJ0ZXggYnVmZmVyIGZvcm1hdCBkZXNjIGFuZCBzb3VyY2VcbiAgICAgICAgY29uc3Qgc291cmNlRGVzYyA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiB1c2VBdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NvciA9IGFjY2Vzc29yc1thdHRyaWJ1dGVzW2F0dHJpYl1dO1xuICAgICAgICAgICAgY29uc3QgYWNjZXNzb3JEYXRhID0gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yLCBidWZmZXJWaWV3cyk7XG4gICAgICAgICAgICBjb25zdCBidWZmZXJWaWV3ID0gYnVmZmVyVmlld3NbYWNjZXNzb3IuYnVmZmVyVmlld107XG4gICAgICAgICAgICBjb25zdCBzZW1hbnRpYyA9IGdsdGZUb0VuZ2luZVNlbWFudGljTWFwW2F0dHJpYl07XG4gICAgICAgICAgICBjb25zdCBzaXplID0gZ2V0TnVtQ29tcG9uZW50cyhhY2Nlc3Nvci50eXBlKSAqIGdldENvbXBvbmVudFNpemVJbkJ5dGVzKGFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gYnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpID8gYnVmZmVyVmlldy5ieXRlU3RyaWRlIDogc2l6ZTtcbiAgICAgICAgICAgIHNvdXJjZURlc2Nbc2VtYW50aWNdID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYWNjZXNzb3JEYXRhLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgICAgIG9mZnNldDogYWNjZXNzb3JEYXRhLmJ5dGVPZmZzZXQsXG4gICAgICAgICAgICAgICAgc3RyaWRlOiBzdHJpZGUsXG4gICAgICAgICAgICAgICAgY291bnQ6IGFjY2Vzc29yLmNvdW50LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSksXG4gICAgICAgICAgICAgICAgdHlwZTogZ2V0Q29tcG9uZW50VHlwZShhY2Nlc3Nvci5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6IGFjY2Vzc29yLm5vcm1hbGl6ZWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBnZW5lcmF0ZSBub3JtYWxzIGlmIHRoZXkncmUgbWlzc2luZyAodGhpcyBzaG91bGQgcHJvYmFibHkgYmUgYSB1c2VyIG9wdGlvbilcbiAgICAgICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgICAgIGdlbmVyYXRlTm9ybWFscyhzb3VyY2VEZXNjLCBpbmRpY2VzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgc3RvcmUgaXQgaW4gdGhlIGRpY3Rpb25hcnlcbiAgICAgICAgdmIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbiAgICAgICAgdmVydGV4QnVmZmVyRGljdFt2YktleV0gPSB2YjtcbiAgICB9XG5cbiAgICByZXR1cm4gdmI7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXJEcmFjbyA9IGZ1bmN0aW9uIChkZXZpY2UsIG91dHB1dEdlb21ldHJ5LCBleHREcmFjbywgZGVjb2RlciwgZGVjb2Rlck1vZHVsZSwgaW5kaWNlcywgZmxpcFYpIHtcblxuICAgIGNvbnN0IG51bVBvaW50cyA9IG91dHB1dEdlb21ldHJ5Lm51bV9wb2ludHMoKTtcblxuICAgIC8vIGhlbHBlciBmdW5jdGlvbiB0byBkZWNvZGUgZGF0YSBzdHJlYW0gd2l0aCBpZCB0byBUeXBlZEFycmF5IG9mIGFwcHJvcHJpYXRlIHR5cGVcbiAgICBjb25zdCBleHRyYWN0RHJhY29BdHRyaWJ1dGVJbmZvID0gZnVuY3Rpb24gKHVuaXF1ZUlkLCBzZW1hbnRpYykge1xuICAgICAgICBjb25zdCBhdHRyaWJ1dGUgPSBkZWNvZGVyLkdldEF0dHJpYnV0ZUJ5VW5pcXVlSWQob3V0cHV0R2VvbWV0cnksIHVuaXF1ZUlkKTtcbiAgICAgICAgY29uc3QgbnVtVmFsdWVzID0gbnVtUG9pbnRzICogYXR0cmlidXRlLm51bV9jb21wb25lbnRzKCk7XG4gICAgICAgIGNvbnN0IGRyYWNvRm9ybWF0ID0gYXR0cmlidXRlLmRhdGFfdHlwZSgpO1xuICAgICAgICBsZXQgcHRyLCB2YWx1ZXMsIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBzdG9yYWdlVHlwZTtcblxuICAgICAgICAvLyBzdG9yYWdlIGZvcm1hdCBpcyBiYXNlZCBvbiBkcmFjbyBhdHRyaWJ1dGUgZGF0YSB0eXBlXG4gICAgICAgIHN3aXRjaCAoZHJhY29Gb3JtYXQpIHtcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX1VJTlQ4OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9VSU5UODtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRTaXplSW5CeXRlcyA9IDE7XG4gICAgICAgICAgICAgICAgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzKTtcbiAgICAgICAgICAgICAgICBkZWNvZGVyLkdldEF0dHJpYnV0ZURhdGFBcnJheUZvckFsbFBvaW50cyhvdXRwdXRHZW9tZXRyeSwgYXR0cmlidXRlLCBkZWNvZGVyTW9kdWxlLkRUX1VJTlQ4LCBudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcywgcHRyKTtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBuZXcgVWludDhBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVOC5idWZmZXIsIHB0ciwgbnVtVmFsdWVzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuRFRfVUlOVDE2OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9VSU5UMTY7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50U2l6ZUluQnl0ZXMgPSAyO1xuICAgICAgICAgICAgICAgIHB0ciA9IGRlY29kZXJNb2R1bGUuX21hbGxvYyhudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcyk7XG4gICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMob3V0cHV0R2VvbWV0cnksIGF0dHJpYnV0ZSwgZGVjb2Rlck1vZHVsZS5EVF9VSU5UMTYsIG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBwdHIpO1xuICAgICAgICAgICAgICAgIHZhbHVlcyA9IG5ldyBVaW50MTZBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMTYuYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX0ZMT0FUMzI6XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzID0gNDtcbiAgICAgICAgICAgICAgICBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MobnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMpO1xuICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0QXR0cmlidXRlRGF0YUFycmF5Rm9yQWxsUG9pbnRzKG91dHB1dEdlb21ldHJ5LCBhdHRyaWJ1dGUsIGRlY29kZXJNb2R1bGUuRFRfRkxPQVQzMiwgbnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMsIHB0cik7XG4gICAgICAgICAgICAgICAgdmFsdWVzID0gbmV3IEZsb2F0MzJBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBGMzIuYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGRlY29kZXJNb2R1bGUuX2ZyZWUocHRyKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWVzOiB2YWx1ZXMsXG4gICAgICAgICAgICBudW1Db21wb25lbnRzOiBhdHRyaWJ1dGUubnVtX2NvbXBvbmVudHMoKSxcbiAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzOiBjb21wb25lbnRTaXplSW5CeXRlcyxcbiAgICAgICAgICAgIHN0b3JhZ2VUeXBlOiBzdG9yYWdlVHlwZSxcblxuICAgICAgICAgICAgLy8gdGhlcmUgYXJlIGdsYiBmaWxlcyBhcm91bmQgd2hlcmUgOGJpdCBjb2xvcnMgYXJlIG1pc3Npbmcgbm9ybWFsaXplZCBmbGFnXG4gICAgICAgICAgICBub3JtYWxpemVkOiAoc2VtYW50aWMgPT09IFNFTUFOVElDX0NPTE9SICYmIHN0b3JhZ2VUeXBlID09PSBUWVBFX1VJTlQ4KSA/IHRydWUgOiBhdHRyaWJ1dGUubm9ybWFsaXplZCgpXG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIC8vIGJ1aWxkIHZlcnRleCBidWZmZXIgZm9ybWF0IGRlc2MgYW5kIHNvdXJjZVxuICAgIGNvbnN0IHNvdXJjZURlc2MgPSB7fTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzID0gZXh0RHJhY28uYXR0cmlidXRlcztcbiAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHJpYikgJiYgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAuaGFzT3duUHJvcGVydHkoYXR0cmliKSkge1xuICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFthdHRyaWJdO1xuICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlSW5mbyA9IGV4dHJhY3REcmFjb0F0dHJpYnV0ZUluZm8oYXR0cmlidXRlc1thdHRyaWJdLCBzZW1hbnRpYyk7XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBpbmZvIHdlJ2xsIG5lZWQgdG8gY29weSB0aGlzIGRhdGEgaW50byB0aGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGF0dHJpYnV0ZUluZm8ubnVtQ29tcG9uZW50cyAqIGF0dHJpYnV0ZUluZm8uY29tcG9uZW50U2l6ZUluQnl0ZXM7XG4gICAgICAgICAgICBzb3VyY2VEZXNjW3NlbWFudGljXSA9IHtcbiAgICAgICAgICAgICAgICB2YWx1ZXM6IGF0dHJpYnV0ZUluZm8udmFsdWVzLFxuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYXR0cmlidXRlSW5mby52YWx1ZXMuYnVmZmVyLFxuICAgICAgICAgICAgICAgIHNpemU6IHNpemUsXG4gICAgICAgICAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICAgICAgICAgIHN0cmlkZTogc2l6ZSxcbiAgICAgICAgICAgICAgICBjb3VudDogbnVtUG9pbnRzLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGF0dHJpYnV0ZUluZm8ubnVtQ29tcG9uZW50cyxcbiAgICAgICAgICAgICAgICB0eXBlOiBhdHRyaWJ1dGVJbmZvLnN0b3JhZ2VUeXBlLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZTogYXR0cmlidXRlSW5mby5ub3JtYWxpemVkXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFscyBpZiB0aGV5J3JlIG1pc3NpbmcgKHRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIGEgdXNlciBvcHRpb24pXG4gICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgZ2VuZXJhdGVOb3JtYWxzKHNvdXJjZURlc2MsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbn07XG5cbmNvbnN0IGNyZWF0ZVNraW4gPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmU2tpbiwgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsYlNraW5zKSB7XG4gICAgbGV0IGksIGosIGJpbmRNYXRyaXg7XG4gICAgY29uc3Qgam9pbnRzID0gZ2x0ZlNraW4uam9pbnRzO1xuICAgIGNvbnN0IG51bUpvaW50cyA9IGpvaW50cy5sZW5ndGg7XG4gICAgY29uc3QgaWJwID0gW107XG4gICAgaWYgKGdsdGZTa2luLmhhc093blByb3BlcnR5KCdpbnZlcnNlQmluZE1hdHJpY2VzJykpIHtcbiAgICAgICAgY29uc3QgaW52ZXJzZUJpbmRNYXRyaWNlcyA9IGdsdGZTa2luLmludmVyc2VCaW5kTWF0cmljZXM7XG4gICAgICAgIGNvbnN0IGlibURhdGEgPSBnZXRBY2Nlc3NvckRhdGEoYWNjZXNzb3JzW2ludmVyc2VCaW5kTWF0cmljZXNdLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IGlibVZhbHVlcyA9IFtdO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBudW1Kb2ludHM7IGkrKykge1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IDE2OyBqKyspIHtcbiAgICAgICAgICAgICAgICBpYm1WYWx1ZXNbal0gPSBpYm1EYXRhW2kgKiAxNiArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYmluZE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgICAgICBiaW5kTWF0cml4LnNldChpYm1WYWx1ZXMpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGJpbmRNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBib25lTmFtZXMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgYm9uZU5hbWVzW2ldID0gbm9kZXNbam9pbnRzW2ldXS5uYW1lO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZSBhIGNhY2hlIGtleSBmcm9tIGJvbmUgbmFtZXMgYW5kIHNlZSBpZiB3ZSBoYXZlIG1hdGNoaW5nIHNraW5cbiAgICBjb25zdCBrZXkgPSBib25lTmFtZXMuam9pbignIycpO1xuICAgIGxldCBza2luID0gZ2xiU2tpbnMuZ2V0KGtleSk7XG4gICAgaWYgKCFza2luKSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSBza2luIGFuZCBhZGQgaXQgdG8gdGhlIGNhY2hlXG4gICAgICAgIHNraW4gPSBuZXcgU2tpbihkZXZpY2UsIGlicCwgYm9uZU5hbWVzKTtcbiAgICAgICAgZ2xiU2tpbnMuc2V0KGtleSwgc2tpbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNraW47XG59O1xuXG5jb25zdCB0ZW1wTWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRlbXBWZWMgPSBuZXcgVmVjMygpO1xuXG5jb25zdCBjcmVhdGVNZXNoID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0Zk1lc2gsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgYXNzZXRPcHRpb25zKSB7XG4gICAgY29uc3QgbWVzaGVzID0gW107XG5cbiAgICBnbHRmTWVzaC5wcmltaXRpdmVzLmZvckVhY2goZnVuY3Rpb24gKHByaW1pdGl2ZSkge1xuXG4gICAgICAgIGxldCBwcmltaXRpdmVUeXBlLCB2ZXJ0ZXhCdWZmZXIsIG51bUluZGljZXM7XG4gICAgICAgIGxldCBpbmRpY2VzID0gbnVsbDtcbiAgICAgICAgbGV0IGNhblVzZU1vcnBoID0gdHJ1ZTtcblxuICAgICAgICAvLyB0cnkgYW5kIGdldCBkcmFjbyBjb21wcmVzc2VkIGRhdGEgZmlyc3RcbiAgICAgICAgaWYgKHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgnZXh0ZW5zaW9ucycpKSB7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb25zID0gcHJpbWl0aXZlLmV4dGVuc2lvbnM7XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb24nKSkge1xuXG4gICAgICAgICAgICAgICAgLy8gYWNjZXNzIERyYWNvRGVjb2Rlck1vZHVsZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRlY29kZXJNb2R1bGUgPSBkcmFjb0RlY29kZXJJbnN0YW5jZSB8fCBnZXRHbG9iYWxEcmFjb0RlY29kZXJNb2R1bGUoKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVjb2Rlck1vZHVsZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHREcmFjbyA9IGV4dGVuc2lvbnMuS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb247XG4gICAgICAgICAgICAgICAgICAgIGlmIChleHREcmFjby5oYXNPd25Qcm9wZXJ0eSgnYXR0cmlidXRlcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1aW50OEJ1ZmZlciA9IGJ1ZmZlclZpZXdzW2V4dERyYWNvLmJ1ZmZlclZpZXddO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IGRlY29kZXJNb2R1bGUuRGVjb2RlckJ1ZmZlcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyLkluaXQodWludDhCdWZmZXIsIHVpbnQ4QnVmZmVyLmxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlY29kZXIgPSBuZXcgZGVjb2Rlck1vZHVsZS5EZWNvZGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBnZW9tZXRyeVR5cGUgPSBkZWNvZGVyLkdldEVuY29kZWRHZW9tZXRyeVR5cGUoYnVmZmVyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG91dHB1dEdlb21ldHJ5LCBzdGF0dXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGdlb21ldHJ5VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5QT0lOVF9DTE9VRDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVHlwZSA9IFBSSU1JVElWRV9QT0lOVFM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dEdlb21ldHJ5ID0gbmV3IGRlY29kZXJNb2R1bGUuUG9pbnRDbG91ZCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMgPSBkZWNvZGVyLkRlY29kZUJ1ZmZlclRvUG9pbnRDbG91ZChidWZmZXIsIG91dHB1dEdlb21ldHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLlRSSUFOR1VMQVJfTUVTSDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVHlwZSA9IFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dEdlb21ldHJ5ID0gbmV3IGRlY29kZXJNb2R1bGUuTWVzaCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMgPSBkZWNvZGVyLkRlY29kZUJ1ZmZlclRvTWVzaChidWZmZXIsIG91dHB1dEdlb21ldHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLklOVkFMSURfR0VPTUVUUllfVFlQRTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzdGF0dXMgfHwgIXN0YXR1cy5vaygpIHx8IG91dHB1dEdlb21ldHJ5LnB0ciA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCdGYWlsZWQgdG8gZGVjb2RlIGRyYWNvIGNvbXByZXNzZWQgYXNzZXQ6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzdGF0dXMgPyBzdGF0dXMuZXJyb3JfbXNnKCkgOiAoJ01lc2ggYXNzZXQgLSBpbnZhbGlkIGRyYWNvIGNvbXByZXNzZWQgZ2VvbWV0cnkgdHlwZTogJyArIGdlb21ldHJ5VHlwZSkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluZGljZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG51bUZhY2VzID0gb3V0cHV0R2VvbWV0cnkubnVtX2ZhY2VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZ2VvbWV0cnlUeXBlID09PSBkZWNvZGVyTW9kdWxlLlRSSUFOR1VMQVJfTUVTSCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpdDMyID0gb3V0cHV0R2VvbWV0cnkubnVtX3BvaW50cygpID4gNjU1MzU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1JbmRpY2VzID0gbnVtRmFjZXMgKiAzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGFTaXplID0gbnVtSW5kaWNlcyAqIChiaXQzMiA/IDQgOiAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MoZGF0YVNpemUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJpdDMyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0VHJpYW5nbGVzVUludDMyQXJyYXkob3V0cHV0R2VvbWV0cnksIGRhdGFTaXplLCBwdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQzMkFycmF5KGRlY29kZXJNb2R1bGUuSEVBUFUzMi5idWZmZXIsIHB0ciwgbnVtSW5kaWNlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyLkdldFRyaWFuZ2xlc1VJbnQxNkFycmF5KG91dHB1dEdlb21ldHJ5LCBkYXRhU2l6ZSwgcHRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMTYuYnVmZmVyLCBwdHIsIG51bUluZGljZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5fZnJlZShwdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB2ZXJ0aWNlc1xuICAgICAgICAgICAgICAgICAgICAgICAgdmVydGV4QnVmZmVyID0gY3JlYXRlVmVydGV4QnVmZmVyRHJhY28oZGV2aWNlLCBvdXRwdXRHZW9tZXRyeSwgZXh0RHJhY28sIGRlY29kZXIsIGRlY29kZXJNb2R1bGUsIGluZGljZXMsIGZsaXBWKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYW4gdXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXJNb2R1bGUuZGVzdHJveShvdXRwdXRHZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLmRlc3Ryb3koZGVjb2Rlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLmRlc3Ryb3koYnVmZmVyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbW9ycGggc3RyZWFtcyBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCBkcmFjbyBjb21wcmVzc2lvbiwgZGlzYWJsZSBtb3JwaGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FuVXNlTW9ycGggPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0ZpbGUgY29udGFpbnMgZHJhY28gY29tcHJlc3NlZCBkYXRhLCBidXQgRHJhY29EZWNvZGVyTW9kdWxlIGlzIG5vdCBjb25maWd1cmVkLicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIG1lc2ggd2FzIG5vdCBjb25zdHJ1Y3RlZCBmcm9tIGRyYWNvIGRhdGEsIHVzZSB1bmNvbXByZXNzZWRcbiAgICAgICAgaWYgKCF2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIGluZGljZXMgPSBwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ2luZGljZXMnKSA/IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvcnNbcHJpbWl0aXZlLmluZGljZXNdLCBidWZmZXJWaWV3cywgdHJ1ZSkgOiBudWxsO1xuICAgICAgICAgICAgdmVydGV4QnVmZmVyID0gY3JlYXRlVmVydGV4QnVmZmVyKGRldmljZSwgcHJpbWl0aXZlLmF0dHJpYnV0ZXMsIGluZGljZXMsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0KTtcbiAgICAgICAgICAgIHByaW1pdGl2ZVR5cGUgPSBnZXRQcmltaXRpdmVUeXBlKHByaW1pdGl2ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbWVzaCA9IG51bGw7XG4gICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIGJ1aWxkIHRoZSBtZXNoXG4gICAgICAgICAgICBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICAgICAgICAgIG1lc2gudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0udHlwZSA9IHByaW1pdGl2ZVR5cGU7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5iYXNlID0gMDtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSAoaW5kaWNlcyAhPT0gbnVsbCk7XG5cbiAgICAgICAgICAgIC8vIGluZGV4IGJ1ZmZlclxuICAgICAgICAgICAgaWYgKGluZGljZXMgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXhGb3JtYXQ7XG4gICAgICAgICAgICAgICAgaWYgKGluZGljZXMgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDg7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpbmRpY2VzIGluc3RhbmNlb2YgVWludDE2QXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMTY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMzI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gMzJiaXQgaW5kZXggYnVmZmVyIGlzIHVzZWQgYnV0IG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhGb3JtYXQgPT09IElOREVYRk9STUFUX1VJTlQzMiAmJiAhZGV2aWNlLmV4dFVpbnRFbGVtZW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgICAgICBpZiAodmVydGV4QnVmZmVyLm51bVZlcnRpY2VzID4gMHhGRkZGKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0dsYiBmaWxlIGNvbnRhaW5zIDMyYml0IGluZGV4IGJ1ZmZlciBidXQgdGhlc2UgYXJlIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBkZXZpY2UgLSBpdCBtYXkgYmUgcmVuZGVyZWQgaW5jb3JyZWN0bHkuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29udmVydCB0byAxNmJpdFxuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShpbmRpY2VzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBpbmRleEJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcihkZXZpY2UsIGluZGV4Rm9ybWF0LCBpbmRpY2VzLmxlbmd0aCwgQlVGRkVSX1NUQVRJQywgaW5kaWNlcyk7XG4gICAgICAgICAgICAgICAgbWVzaC5pbmRleEJ1ZmZlclswXSA9IGluZGV4QnVmZmVyO1xuICAgICAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID0gaW5kaWNlcy5sZW5ndGg7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID0gdmVydGV4QnVmZmVyLm51bVZlcnRpY2VzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocHJpbWl0aXZlLmhhc093blByb3BlcnR5KFwiZXh0ZW5zaW9uc1wiKSAmJiBwcmltaXRpdmUuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eShcIktIUl9tYXRlcmlhbHNfdmFyaWFudHNcIikpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YXJpYW50cyA9IHByaW1pdGl2ZS5leHRlbnNpb25zLktIUl9tYXRlcmlhbHNfdmFyaWFudHM7XG4gICAgICAgICAgICAgICAgY29uc3QgdGVtcE1hcHBpbmcgPSB7fTtcbiAgICAgICAgICAgICAgICB2YXJpYW50cy5tYXBwaW5ncy5mb3JFYWNoKChtYXBwaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIG1hcHBpbmcudmFyaWFudHMuZm9yRWFjaCgodmFyaWFudCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcE1hcHBpbmdbdmFyaWFudF0gPSBtYXBwaW5nLm1hdGVyaWFsO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBtZXNoVmFyaWFudHNbbWVzaC5pZF0gPSB0ZW1wTWFwcGluZztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbWVzaERlZmF1bHRNYXRlcmlhbHNbbWVzaC5pZF0gPSBwcmltaXRpdmUubWF0ZXJpYWw7XG5cbiAgICAgICAgICAgIGxldCBhY2Nlc3NvciA9IGFjY2Vzc29yc1twcmltaXRpdmUuYXR0cmlidXRlcy5QT1NJVElPTl07XG4gICAgICAgICAgICBtZXNoLmFhYmIgPSBnZXRBY2Nlc3NvckJvdW5kaW5nQm94KGFjY2Vzc29yKTtcblxuICAgICAgICAgICAgLy8gbW9ycGggdGFyZ2V0c1xuICAgICAgICAgICAgaWYgKGNhblVzZU1vcnBoICYmIHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgndGFyZ2V0cycpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0cyA9IFtdO1xuXG4gICAgICAgICAgICAgICAgcHJpbWl0aXZlLnRhcmdldHMuZm9yRWFjaChmdW5jdGlvbiAodGFyZ2V0LCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0ge307XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldC5oYXNPd25Qcm9wZXJ0eSgnUE9TSVRJT04nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbdGFyZ2V0LlBPU0lUSU9OXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFQb3NpdGlvbnMgPSBnZXRBY2Nlc3NvckRhdGFGbG9hdDMyKGFjY2Vzc29yLCBidWZmZXJWaWV3cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhUG9zaXRpb25zVHlwZSA9IFRZUEVfRkxPQVQzMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuYWFiYiA9IGdldEFjY2Vzc29yQm91bmRpbmdCb3goYWNjZXNzb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldC5oYXNPd25Qcm9wZXJ0eSgnTk9STUFMJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2Vzc29yID0gYWNjZXNzb3JzW3RhcmdldC5OT1JNQUxdO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gTk9URTogdGhlIG1vcnBoIHRhcmdldHMgY2FuJ3QgY3VycmVudGx5IGFjY2VwdCBxdWFudGl6ZWQgbm9ybWFsc1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YU5vcm1hbHMgPSBnZXRBY2Nlc3NvckRhdGFGbG9hdDMyKGFjY2Vzc29yLCBidWZmZXJWaWV3cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhTm9ybWFsc1R5cGUgPSBUWVBFX0ZMT0FUMzI7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBuYW1lIGlmIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0Zk1lc2guaGFzT3duUHJvcGVydHkoJ2V4dHJhcycpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICBnbHRmTWVzaC5leHRyYXMuaGFzT3duUHJvcGVydHkoJ3RhcmdldE5hbWVzJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubmFtZSA9IGdsdGZNZXNoLmV4dHJhcy50YXJnZXROYW1lc1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLm5hbWUgPSBpbmRleC50b1N0cmluZygxMCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBkZWZhdWx0IHdlaWdodCBpZiBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZNZXNoLmhhc093blByb3BlcnR5KCd3ZWlnaHRzJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVmYXVsdFdlaWdodCA9IGdsdGZNZXNoLndlaWdodHNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5wcmVzZXJ2ZURhdGEgPSBhc3NldE9wdGlvbnMubW9ycGhQcmVzZXJ2ZURhdGE7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldHMucHVzaChuZXcgTW9ycGhUYXJnZXQob3B0aW9ucykpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgbWVzaC5tb3JwaCA9IG5ldyBNb3JwaCh0YXJnZXRzLCBkZXZpY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbWVzaGVzLnB1c2gobWVzaCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWVzaGVzO1xufTtcblxuY29uc3QgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0gPSBmdW5jdGlvbiAoc291cmNlLCBtYXRlcmlhbCwgbWFwcykge1xuICAgIGxldCBtYXA7XG5cbiAgICBjb25zdCB0ZXhDb29yZCA9IHNvdXJjZS50ZXhDb29yZDtcbiAgICBpZiAodGV4Q29vcmQpIHtcbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW21hcHNbbWFwXSArICdNYXBVdiddID0gdGV4Q29vcmQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB6ZXJvcyA9IFswLCAwXTtcbiAgICBjb25zdCBvbmVzID0gWzEsIDFdO1xuICAgIGNvbnN0IHRleHR1cmVUcmFuc2Zvcm0gPSBzb3VyY2UuZXh0ZW5zaW9ucz8uS0hSX3RleHR1cmVfdHJhbnNmb3JtO1xuICAgIGlmICh0ZXh0dXJlVHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IHRleHR1cmVUcmFuc2Zvcm0ub2Zmc2V0IHx8IHplcm9zO1xuICAgICAgICBjb25zdCBzY2FsZSA9IHRleHR1cmVUcmFuc2Zvcm0uc2NhbGUgfHwgb25lcztcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSB0ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uID8gKC10ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uICogbWF0aC5SQURfVE9fREVHKSA6IDA7XG5cbiAgICAgICAgY29uc3QgdGlsaW5nVmVjID0gbmV3IFZlYzIoc2NhbGVbMF0sIHNjYWxlWzFdKTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0VmVjID0gbmV3IFZlYzIob2Zmc2V0WzBdLCAxLjAgLSBzY2FsZVsxXSAtIG9mZnNldFsxXSk7XG5cbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBUaWxpbmdgXSA9IHRpbGluZ1ZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBPZmZzZXRgXSA9IG9mZnNldFZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBSb3RhdGlvbmBdID0gcm90YXRpb247XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBsZXQgY29sb3IsIHRleHR1cmU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2RpZmZ1c2VGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuZGlmZnVzZUZhY3RvcjtcbiAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gY29sb3JbM107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZGlmZnVzZVRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBkaWZmdXNlVGV4dHVyZSA9IGRhdGEuZGlmZnVzZVRleHR1cmU7XG4gICAgICAgIHRleHR1cmUgPSB0ZXh0dXJlc1tkaWZmdXNlVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IHRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkaWZmdXNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZGlmZnVzZScsICdvcGFjaXR5J10pO1xuICAgIH1cbiAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3MgPSBmYWxzZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZ2xvc3NpbmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoaW5pbmVzcyA9IDEwMCAqIGRhdGEuZ2xvc3NpbmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zaGluaW5lc3MgPSAxMDA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZSA9IGRhdGEuc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJFbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSBtYXRlcmlhbC5nbG9zc01hcCA9IHRleHR1cmVzW3NwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgbWF0ZXJpYWwuZ2xvc3NNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKHNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2dsb3NzJywgJ21ldGFsbmVzcyddKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25DbGVhckNvYXQgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdEZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdCA9IGRhdGEuY2xlYXJjb2F0RmFjdG9yICogMC4yNTsgLy8gVE9ETzogcmVtb3ZlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciByZXBsaWNhdGluZyBnbFRGIGNsZWFyLWNvYXQgdmlzdWFsc1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdCA9IDA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgY2xlYXJjb2F0VGV4dHVyZSA9IGRhdGEuY2xlYXJjb2F0VGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0TWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0VGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdE1hcENoYW5uZWwgPSAncic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0VGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0J10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NpbmVzcyA9IGRhdGEuY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzaW5lc3MgPSAwO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUgPSBkYXRhLmNsZWFyY29hdFJvdWdobmVzc1RleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwQ2hhbm5lbCA9ICdnJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXRHbG9zcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdE5vcm1hbFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXROb3JtYWxUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXROb3JtYWxUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXROb3JtYWxNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXROb3JtYWxUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXROb3JtYWxUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXROb3JtYWwnXSk7XG5cbiAgICAgICAgaWYgKGNsZWFyY29hdE5vcm1hbFRleHR1cmUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEJ1bXBpbmVzcyA9IGNsZWFyY29hdE5vcm1hbFRleHR1cmUuc2NhbGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjbGVhckNvYXRHbG9zc0NodW5rID0gLyogZ2xzbCAqL2BcbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgIHVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfY2xlYXJDb2F0R2xvc3NpbmVzcztcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICB2b2lkIGdldENsZWFyQ29hdEdsb3NzaW5lc3MoKSB7XG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgPSAxLjA7XG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyAqPSBtYXRlcmlhbF9jbGVhckNvYXRHbG9zc2luZXNzO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBURVhUVVJFXG4gICAgICAgICAgICBjY0dsb3NzaW5lc3MgKj0gdGV4dHVyZTJEQmlhcygkU0FNUExFUiwgJFVWLCB0ZXh0dXJlQmlhcykuJENIO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgICNpZmRlZiBNQVBWRVJURVhcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyAqPSBzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKTtcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAgICAgY2NHbG9zc2luZXNzID0gMS4wIC0gY2NHbG9zc2luZXNzO1xuICAgICAgICBcbiAgICAgICAgICAgIGNjR2xvc3NpbmVzcyArPSAwLjAwMDAwMDE7XG4gICAgICAgIH1cbiAgICAgICAgYDtcbiAgICBtYXRlcmlhbC5jaHVua3MuY2xlYXJDb2F0R2xvc3NQUyA9IGNsZWFyQ29hdEdsb3NzQ2h1bms7XG59O1xuXG5jb25zdCBleHRlbnNpb25VbmxpdCA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC51c2VMaWdodGluZyA9IGZhbHNlO1xuXG4gICAgLy8gY29weSBkaWZmdXNlIGludG8gZW1pc3NpdmVcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZS5jb3B5KG1hdGVyaWFsLmRpZmZ1c2UpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IG1hdGVyaWFsLmRpZmZ1c2VUaW50O1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwID0gbWF0ZXJpYWwuZGlmZnVzZU1hcDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFV2ID0gbWF0ZXJpYWwuZGlmZnVzZU1hcFV2O1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwVGlsaW5nLmNvcHkobWF0ZXJpYWwuZGlmZnVzZU1hcFRpbGluZyk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBPZmZzZXQuY29weShtYXRlcmlhbC5kaWZmdXNlTWFwT2Zmc2V0KTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFJvdGF0aW9uID0gbWF0ZXJpYWwuZGlmZnVzZU1hcFJvdGF0aW9uO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwQ2hhbm5lbCA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVmVydGV4Q29sb3IgPSBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3I7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVWZXJ0ZXhDb2xvckNoYW5uZWwgPSBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsO1xuXG4gICAgLy8gYmxhbmsgZGlmZnVzZVxuICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDAsIDAsIDApO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VUaW50ID0gZmFsc2U7XG4gICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IG51bGw7XG4gICAgbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yID0gZmFsc2U7XG59O1xuXG5jb25zdCBleHRlbnNpb25TcGVjdWxhciA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3NTcGVjdWxhckNvbG9yID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJDb2xvclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhckVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcCA9IHRleHR1cmVzW2RhdGEuc3BlY3VsYXJDb2xvclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcENoYW5uZWwgPSAncmdiJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNwZWN1bGFyQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydzcGVjdWxhciddKTtcblxuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJDb2xvckZhY3RvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5zcGVjdWxhckNvbG9yRmFjdG9yO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgIH1cblxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyaXR5RmFjdG9yID0gZGF0YS5zcGVjdWxhckZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3RvciA9IDE7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3Rvck1hcENoYW5uZWwgPSAnYSc7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyaXR5RmFjdG9yTWFwID0gdGV4dHVyZXNbZGF0YS5zcGVjdWxhclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNwZWN1bGFyVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc3BlY3VsYXJpdHlGYWN0b3InXSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uSW9yID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpb3InKSkge1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uSW5kZXggPSAxLjAgLyBkYXRhLmlvcjtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25UcmFuc21pc3Npb24gPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9STUFMO1xuICAgIG1hdGVyaWFsLnVzZUR5bmFtaWNSZWZyYWN0aW9uID0gdHJ1ZTtcblxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0cmFuc21pc3Npb25GYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uID0gZGF0YS50cmFuc21pc3Npb25GYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0cmFuc21pc3Npb25UZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbk1hcENoYW5uZWwgPSAncic7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25NYXAgPSB0ZXh0dXJlc1tkYXRhLnRyYW5zbWlzc2lvblRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnRyYW5zbWlzc2lvblRleHR1cmUsIG1hdGVyaWFsLCBbJ3JlZnJhY3Rpb24nXSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uU2hlZW4gPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwudXNlU2hlZW4gPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlbkNvbG9yRmFjdG9yJykpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSBkYXRhLnNoZWVuQ29sb3JGYWN0b3I7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbi5zZXQoMSwgMSwgMSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlbkNvbG9yVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuTWFwID0gdGV4dHVyZXNbZGF0YS5zaGVlbkNvbG9yVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuRW5jb2RpbmcgPSAnc3JnYic7XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc2hlZW5Db2xvclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NoZWVuJ10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Sb3VnaG5lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzaW5lc3MgPSBkYXRhLnNoZWVuUm91Z2huZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NpbmVzcyA9IDAuMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NpbmVzc01hcCA9IHRleHR1cmVzW2RhdGEuc2hlZW5Sb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zc2luZXNzTWFwQ2hhbm5lbCA9ICdhJztcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zaGVlblJvdWdobmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ3NoZWVuR2xvc3NpbmVzcyddKTtcbiAgICB9XG5cbiAgICBjb25zdCBzaGVlbkdsb3NzQ2h1bmsgPSBgXG4gICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgdW5pZm9ybSBmbG9hdCBtYXRlcmlhbF9zaGVlbkdsb3NzaW5lc3M7XG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgTUFQVEVYVFVSRVxuICAgIHVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmVfc2hlZW5HbG9zc2luZXNzTWFwO1xuICAgICNlbmRpZlxuXG4gICAgdm9pZCBnZXRTaGVlbkdsb3NzaW5lc3MoKSB7XG4gICAgICAgIGZsb2F0IHNoZWVuR2xvc3NpbmVzcyA9IDEuMDtcblxuICAgICAgICAjaWZkZWYgTUFQRkxPQVRcbiAgICAgICAgc2hlZW5HbG9zc2luZXNzICo9IG1hdGVyaWFsX3NoZWVuR2xvc3NpbmVzcztcbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICAgICAgc2hlZW5HbG9zc2luZXNzICo9IHRleHR1cmUyREJpYXModGV4dHVyZV9zaGVlbkdsb3NzaW5lc3NNYXAsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgI2lmZGVmIE1BUFZFUlRFWFxuICAgICAgICBzaGVlbkdsb3NzaW5lc3MgKj0gc2F0dXJhdGUodlZlcnRleENvbG9yLiRWQyk7XG4gICAgICAgICNlbmRpZlxuXG4gICAgICAgIHNoZWVuR2xvc3NpbmVzcyA9IDEuMCAtIHNoZWVuR2xvc3NpbmVzcztcbiAgICAgICAgc2hlZW5HbG9zc2luZXNzICs9IDAuMDAwMDAwMTtcbiAgICAgICAgc0dsb3NzaW5lc3MgPSBzaGVlbkdsb3NzaW5lc3M7XG4gICAgfVxuICAgIGA7XG4gICAgbWF0ZXJpYWwuY2h1bmtzLnNoZWVuR2xvc3NQUyA9IHNoZWVuR2xvc3NDaHVuaztcbn07XG5cbmNvbnN0IGV4dGVuc2lvblZvbHVtZSA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgbWF0ZXJpYWwudXNlRHluYW1pY1JlZnJhY3Rpb24gPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0aGlja25lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3MgPSBkYXRhLnRoaWNrbmVzc0ZhY3RvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnRoaWNrbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ3RoaWNrbmVzcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2F0dGVudWF0aW9uRGlzdGFuY2UnKSkge1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbkRpc3RhbmNlID0gZGF0YS5hdHRlbnVhdGlvbkRpc3RhbmNlO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXR0ZW51YXRpb25Db2xvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5hdHRlbnVhdGlvbkNvbG9yO1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uRW1pc3NpdmVTdHJlbmd0aCA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVTdHJlbmd0aCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlSW50ZW5zaXR5ID0gZGF0YS5lbWlzc2l2ZVN0cmVuZ3RoO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklyaWRlc2NlbmNlID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZUlyaWRlc2NlbmNlID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZSA9IGRhdGEuaXJpZGVzY2VuY2VGYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZU1hcENoYW5uZWwgPSAncic7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2UnXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlSW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXggPSBkYXRhLmlyaWRlc2NlbmNlSW9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNaW4gPSBkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzTWF4aW11bScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4ID0gZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW07XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01hcENoYW5uZWwgPSAnZyc7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2VUaGlja25lc3MnXSk7XG4gICAgfVxufTtcblxuY29uc3QgY3JlYXRlTWF0ZXJpYWwgPSBmdW5jdGlvbiAoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpIHtcbiAgICAvLyBUT0RPOiBpbnRlZ3JhdGUgdGhlc2Ugc2hhZGVyIGNodW5rcyBpbnRvIHRoZSBuYXRpdmUgZW5naW5lXG4gICAgY29uc3QgZ2xvc3NDaHVuayA9IGBcbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgIHVuaWZvcm0gZmxvYXQgbWF0ZXJpYWxfc2hpbmluZXNzO1xuICAgICAgICAjZW5kaWZcbiAgICAgICAgXG4gICAgICAgIHZvaWQgZ2V0R2xvc3NpbmVzcygpIHtcbiAgICAgICAgICAgIGRHbG9zc2luZXNzID0gMS4wO1xuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUEZMT0FUXG4gICAgICAgICAgICBkR2xvc3NpbmVzcyAqPSBtYXRlcmlhbF9zaGluaW5lc3M7XG4gICAgICAgICNlbmRpZlxuICAgICAgICBcbiAgICAgICAgI2lmZGVmIE1BUFRFWFRVUkVcbiAgICAgICAgICAgIGRHbG9zc2luZXNzICo9IHRleHR1cmUyREJpYXMoJFNBTVBMRVIsICRVViwgdGV4dHVyZUJpYXMpLiRDSDtcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAjaWZkZWYgTUFQVkVSVEVYXG4gICAgICAgICAgICBkR2xvc3NpbmVzcyAqPSBzYXR1cmF0ZSh2VmVydGV4Q29sb3IuJFZDKTtcbiAgICAgICAgI2VuZGlmXG4gICAgICAgIFxuICAgICAgICAgICAgZEdsb3NzaW5lc3MgPSAxLjAgLSBkR2xvc3NpbmVzcztcbiAgICAgICAgXG4gICAgICAgICAgICBkR2xvc3NpbmVzcyArPSAwLjAwMDAwMDE7XG4gICAgICAgIH1cbiAgICAgICAgYDtcblxuXG4gICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuXG4gICAgLy8gZ2xURiBkb2Vzbid0IGRlZmluZSBob3cgdG8gb2NjbHVkZSBzcGVjdWxhclxuICAgIG1hdGVyaWFsLm9jY2x1ZGVTcGVjdWxhciA9IFNQRUNPQ0NfQU87XG5cbiAgICBtYXRlcmlhbC5kaWZmdXNlVGludCA9IHRydWU7XG4gICAgbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yID0gdHJ1ZTtcblxuICAgIG1hdGVyaWFsLnNwZWN1bGFyVGludCA9IHRydWU7XG4gICAgbWF0ZXJpYWwuc3BlY3VsYXJWZXJ0ZXhDb2xvciA9IHRydWU7XG5cbiAgICBtYXRlcmlhbC5jaHVua3MuQVBJVmVyc2lvbiA9IENIVU5LQVBJXzFfNTc7XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCduYW1lJykpIHtcbiAgICAgICAgbWF0ZXJpYWwubmFtZSA9IGdsdGZNYXRlcmlhbC5uYW1lO1xuICAgIH1cblxuICAgIGxldCBjb2xvciwgdGV4dHVyZTtcbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdwYnJNZXRhbGxpY1JvdWdobmVzcycpKSB7XG4gICAgICAgIGNvbnN0IHBickRhdGEgPSBnbHRmTWF0ZXJpYWwucGJyTWV0YWxsaWNSb3VnaG5lc3M7XG5cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ2Jhc2VDb2xvckZhY3RvcicpKSB7XG4gICAgICAgICAgICBjb2xvciA9IHBickRhdGEuYmFzZUNvbG9yRmFjdG9yO1xuICAgICAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSBjb2xvclszXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDEsIDEsIDEpO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ2Jhc2VDb2xvclRleHR1cmUnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUNvbG9yVGV4dHVyZSA9IHBickRhdGEuYmFzZUNvbG9yVGV4dHVyZTtcbiAgICAgICAgICAgIHRleHR1cmUgPSB0ZXh0dXJlc1tiYXNlQ29sb3JUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IHRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcCA9IHRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oYmFzZUNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZGlmZnVzZScsICdvcGFjaXR5J10pO1xuICAgICAgICB9XG4gICAgICAgIG1hdGVyaWFsLnVzZU1ldGFsbmVzcyA9IHRydWU7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ21ldGFsbGljRmFjdG9yJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzcyA9IHBickRhdGEubWV0YWxsaWNGYWN0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3MgPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdyb3VnaG5lc3NGYWN0b3InKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2hpbmluZXNzID0gMTAwICogcGJyRGF0YS5yb3VnaG5lc3NGYWN0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5zaGluaW5lc3MgPSAxMDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ21ldGFsbGljUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUgPSBwYnJEYXRhLm1ldGFsbGljUm91Z2huZXNzVGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcCA9IG1hdGVyaWFsLmdsb3NzTWFwID0gdGV4dHVyZXNbbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcENoYW5uZWwgPSAnYic7XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zc01hcENoYW5uZWwgPSAnZyc7XG5cbiAgICAgICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG1ldGFsbGljUm91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZ2xvc3MnLCAnbWV0YWxuZXNzJ10pO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF0ZXJpYWwuY2h1bmtzLmdsb3NzUFMgPSBnbG9zc0NodW5rO1xuICAgIH1cblxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ25vcm1hbFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBub3JtYWxUZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLm5vcm1hbFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLm5vcm1hbE1hcCA9IHRleHR1cmVzW25vcm1hbFRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG5vcm1hbFRleHR1cmUsIG1hdGVyaWFsLCBbJ25vcm1hbCddKTtcblxuICAgICAgICBpZiAobm9ybWFsVGV4dHVyZS5oYXNPd25Qcm9wZXJ0eSgnc2NhbGUnKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuYnVtcGluZXNzID0gbm9ybWFsVGV4dHVyZS5zY2FsZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdvY2NsdXNpb25UZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgb2NjbHVzaW9uVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5vY2NsdXNpb25UZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5hb01hcCA9IHRleHR1cmVzW29jY2x1c2lvblRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5hb01hcENoYW5uZWwgPSAncic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0ob2NjbHVzaW9uVGV4dHVyZSwgbWF0ZXJpYWwsIFsnYW8nXSk7XG4gICAgICAgIC8vIFRPRE86IHN1cHBvcnQgJ3N0cmVuZ3RoJ1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdlbWlzc2l2ZUZhY3RvcicpKSB7XG4gICAgICAgIGNvbG9yID0gZ2x0Zk1hdGVyaWFsLmVtaXNzaXZlRmFjdG9yO1xuICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmUuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldCgwLCAwLCAwKTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gZmFsc2U7XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGVtaXNzaXZlVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5lbWlzc2l2ZVRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwID0gdGV4dHVyZXNbZW1pc3NpdmVUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShlbWlzc2l2ZVRleHR1cmUsIG1hdGVyaWFsLCBbJ2VtaXNzaXZlJ10pO1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdhbHBoYU1vZGUnKSkge1xuICAgICAgICBzd2l0Y2ggKGdsdGZNYXRlcmlhbC5hbHBoYU1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ01BU0snOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnYWxwaGFDdXRvZmYnKSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbHBoYVRlc3QgPSBnbHRmTWF0ZXJpYWwuYWxwaGFDdXRvZmY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuYWxwaGFUZXN0ID0gMC41O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ0JMRU5EJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgICAgICAgICAgICAgLy8gbm90ZTogYnkgZGVmYXVsdCBkb24ndCB3cml0ZSBkZXB0aCBvbiBzZW1pdHJhbnNwYXJlbnQgbWF0ZXJpYWxzXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuZGVwdGhXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGNhc2UgJ09QQVFVRSc6XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2RvdWJsZVNpZGVkJykpIHtcbiAgICAgICAgbWF0ZXJpYWwudHdvU2lkZWRMaWdodGluZyA9IGdsdGZNYXRlcmlhbC5kb3VibGVTaWRlZDtcbiAgICAgICAgbWF0ZXJpYWwuY3VsbCA9IGdsdGZNYXRlcmlhbC5kb3VibGVTaWRlZCA/IENVTExGQUNFX05PTkUgOiBDVUxMRkFDRV9CQUNLO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnR3b1NpZGVkTGlnaHRpbmcgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwuY3VsbCA9IENVTExGQUNFX0JBQ0s7XG4gICAgfVxuXG4gICAgLy8gUHJvdmlkZSBsaXN0IG9mIHN1cHBvcnRlZCBleHRlbnNpb25zIGFuZCB0aGVpciBmdW5jdGlvbnNcbiAgICBjb25zdCBleHRlbnNpb25zID0ge1xuICAgICAgICBcIktIUl9tYXRlcmlhbHNfY2xlYXJjb2F0XCI6IGV4dGVuc2lvbkNsZWFyQ29hdCxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2VtaXNzaXZlX3N0cmVuZ3RoXCI6IGV4dGVuc2lvbkVtaXNzaXZlU3RyZW5ndGgsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19pb3JcIjogZXh0ZW5zaW9uSW9yLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfaXJpZGVzY2VuY2VcIjogZXh0ZW5zaW9uSXJpZGVzY2VuY2UsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19wYnJTcGVjdWxhckdsb3NzaW5lc3NcIjogZXh0ZW5zaW9uUGJyU3BlY0dsb3NzaW5lc3MsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19zaGVlblwiOiBleHRlbnNpb25TaGVlbixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3NwZWN1bGFyXCI6IGV4dGVuc2lvblNwZWN1bGFyLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfdHJhbnNtaXNzaW9uXCI6IGV4dGVuc2lvblRyYW5zbWlzc2lvbixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3VubGl0XCI6IGV4dGVuc2lvblVubGl0LFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfdm9sdW1lXCI6IGV4dGVuc2lvblZvbHVtZVxuICAgIH07XG5cbiAgICAvLyBIYW5kbGUgZXh0ZW5zaW9uc1xuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBnbHRmTWF0ZXJpYWwuZXh0ZW5zaW9ucykge1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uRnVuYyA9IGV4dGVuc2lvbnNba2V5XTtcbiAgICAgICAgICAgIGlmIChleHRlbnNpb25GdW5jICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBleHRlbnNpb25GdW5jKGdsdGZNYXRlcmlhbC5leHRlbnNpb25zW2tleV0sIG1hdGVyaWFsLCB0ZXh0dXJlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtYXRlcmlhbC51cGRhdGUoKTtcblxuICAgIHJldHVybiBtYXRlcmlhbDtcbn07XG5cbi8vIGNyZWF0ZSB0aGUgYW5pbSBzdHJ1Y3R1cmVcbmNvbnN0IGNyZWF0ZUFuaW1hdGlvbiA9IGZ1bmN0aW9uIChnbHRmQW5pbWF0aW9uLCBhbmltYXRpb25JbmRleCwgZ2x0ZkFjY2Vzc29ycywgYnVmZmVyVmlld3MsIG5vZGVzLCBtZXNoZXMpIHtcblxuICAgIC8vIGNyZWF0ZSBhbmltYXRpb24gZGF0YSBibG9jayBmb3IgdGhlIGFjY2Vzc29yXG4gICAgY29uc3QgY3JlYXRlQW5pbURhdGEgPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yKSB7XG4gICAgICAgIHJldHVybiBuZXcgQW5pbURhdGEoZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSksIGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykpO1xuICAgIH07XG5cbiAgICBjb25zdCBpbnRlcnBNYXAgPSB7XG4gICAgICAgICdTVEVQJzogSU5URVJQT0xBVElPTl9TVEVQLFxuICAgICAgICAnTElORUFSJzogSU5URVJQT0xBVElPTl9MSU5FQVIsXG4gICAgICAgICdDVUJJQ1NQTElORSc6IElOVEVSUE9MQVRJT05fQ1VCSUNcbiAgICB9O1xuXG4gICAgLy8gSW5wdXQgYW5kIG91dHB1dCBtYXBzIHJlZmVyZW5jZSBkYXRhIGJ5IHNhbXBsZXIgaW5wdXQvb3V0cHV0IGtleS5cbiAgICBjb25zdCBpbnB1dE1hcCA9IHsgfTtcbiAgICBjb25zdCBvdXRwdXRNYXAgPSB7IH07XG4gICAgLy8gVGhlIGN1cnZlIG1hcCBzdG9yZXMgdGVtcG9yYXJ5IGN1cnZlIGRhdGEgYnkgc2FtcGxlciBpbmRleC4gRWFjaCBjdXJ2ZXMgaW5wdXQvb3V0cHV0IHZhbHVlIHdpbGwgYmUgcmVzb2x2ZWQgdG8gYW4gaW5wdXRzL291dHB1dHMgYXJyYXkgaW5kZXggYWZ0ZXIgYWxsIHNhbXBsZXJzIGhhdmUgYmVlbiBwcm9jZXNzZWQuXG4gICAgLy8gQ3VydmVzIGFuZCBvdXRwdXRzIHRoYXQgYXJlIGRlbGV0ZWQgZnJvbSB0aGVpciBtYXBzIHdpbGwgbm90IGJlIGluY2x1ZGVkIGluIHRoZSBmaW5hbCBBbmltVHJhY2tcbiAgICBjb25zdCBjdXJ2ZU1hcCA9IHsgfTtcbiAgICBsZXQgb3V0cHV0Q291bnRlciA9IDE7XG5cbiAgICBsZXQgaTtcblxuICAgIC8vIGNvbnZlcnQgc2FtcGxlcnNcbiAgICBmb3IgKGkgPSAwOyBpIDwgZ2x0ZkFuaW1hdGlvbi5zYW1wbGVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBzYW1wbGVyID0gZ2x0ZkFuaW1hdGlvbi5zYW1wbGVyc1tpXTtcblxuICAgICAgICAvLyBnZXQgaW5wdXQgZGF0YVxuICAgICAgICBpZiAoIWlucHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIuaW5wdXQpKSB7XG4gICAgICAgICAgICBpbnB1dE1hcFtzYW1wbGVyLmlucHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5pbnB1dF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG91dHB1dCBkYXRhXG4gICAgICAgIGlmICghb3V0cHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIub3V0cHV0KSkge1xuICAgICAgICAgICAgb3V0cHV0TWFwW3NhbXBsZXIub3V0cHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5vdXRwdXRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGludGVycG9sYXRpb24gPVxuICAgICAgICAgICAgc2FtcGxlci5oYXNPd25Qcm9wZXJ0eSgnaW50ZXJwb2xhdGlvbicpICYmXG4gICAgICAgICAgICBpbnRlcnBNYXAuaGFzT3duUHJvcGVydHkoc2FtcGxlci5pbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgaW50ZXJwTWFwW3NhbXBsZXIuaW50ZXJwb2xhdGlvbl0gOiBJTlRFUlBPTEFUSU9OX0xJTkVBUjtcblxuICAgICAgICAvLyBjcmVhdGUgY3VydmVcbiAgICAgICAgY29uc3QgY3VydmUgPSB7XG4gICAgICAgICAgICBwYXRoczogW10sXG4gICAgICAgICAgICBpbnB1dDogc2FtcGxlci5pbnB1dCxcbiAgICAgICAgICAgIG91dHB1dDogc2FtcGxlci5vdXRwdXQsXG4gICAgICAgICAgICBpbnRlcnBvbGF0aW9uOiBpbnRlcnBvbGF0aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgY3VydmVNYXBbaV0gPSBjdXJ2ZTtcbiAgICB9XG5cbiAgICBjb25zdCBxdWF0QXJyYXlzID0gW107XG5cbiAgICBjb25zdCB0cmFuc2Zvcm1TY2hlbWEgPSB7XG4gICAgICAgICd0cmFuc2xhdGlvbic6ICdsb2NhbFBvc2l0aW9uJyxcbiAgICAgICAgJ3JvdGF0aW9uJzogJ2xvY2FsUm90YXRpb24nLFxuICAgICAgICAnc2NhbGUnOiAnbG9jYWxTY2FsZSdcbiAgICB9O1xuXG4gICAgY29uc3QgY29uc3RydWN0Tm9kZVBhdGggPSAobm9kZSkgPT4ge1xuICAgICAgICBjb25zdCBwYXRoID0gW107XG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBwYXRoLnVuc2hpZnQobm9kZS5uYW1lKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnBhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICB9O1xuXG4gICAgY29uc3QgcmV0cmlldmVXZWlnaHROYW1lID0gKG5vZGVOYW1lLCB3ZWlnaHRJbmRleCkgPT4ge1xuICAgICAgICBpZiAoIW1lc2hlcykgcmV0dXJuIHdlaWdodEluZGV4O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hlc1tpXTtcbiAgICAgICAgICAgIGlmIChtZXNoLm5hbWUgPT09IG5vZGVOYW1lICYmIG1lc2guaGFzT3duUHJvcGVydHkoJ2V4dHJhcycpICYmIG1lc2guZXh0cmFzLmhhc093blByb3BlcnR5KCd0YXJnZXROYW1lcycpICYmIG1lc2guZXh0cmFzLnRhcmdldE5hbWVzW3dlaWdodEluZGV4XSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBgbmFtZS4ke21lc2guZXh0cmFzLnRhcmdldE5hbWVzW3dlaWdodEluZGV4XX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB3ZWlnaHRJbmRleDtcbiAgICB9O1xuXG4gICAgLy8gQWxsIG1vcnBoIHRhcmdldHMgYXJlIGluY2x1ZGVkIGluIGEgc2luZ2xlIGNoYW5uZWwgb2YgdGhlIGFuaW1hdGlvbiwgd2l0aCBhbGwgdGFyZ2V0cyBvdXRwdXQgZGF0YSBpbnRlcmxlYXZlZCB3aXRoIGVhY2ggb3RoZXIuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzcGxpdHMgZWFjaCBtb3JwaCB0YXJnZXQgb3V0IGludG8gaXQgYSBjdXJ2ZSB3aXRoIGl0cyBvd24gb3V0cHV0IGRhdGEsIGFsbG93aW5nIHVzIHRvIGFuaW1hdGUgZWFjaCBtb3JwaCB0YXJnZXQgaW5kZXBlbmRlbnRseSBieSBuYW1lLlxuICAgIGNvbnN0IGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzID0gKGN1cnZlLCBub2RlLCBlbnRpdHlQYXRoKSA9PiB7XG4gICAgICAgIGlmICghb3V0cHV0TWFwW2N1cnZlLm91dHB1dF0pIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGdsYi1wYXJzZXI6IE5vIG91dHB1dCBkYXRhIGlzIGF2YWlsYWJsZSBmb3IgdGhlIG1vcnBoIHRhcmdldCBjdXJ2ZSAoJHtlbnRpdHlQYXRofS9ncmFwaC93ZWlnaHRzKS4gU2tpcHBpbmcuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRDb3VudCA9IG91dHB1dE1hcFtjdXJ2ZS5vdXRwdXRdLmRhdGEubGVuZ3RoIC8gaW5wdXRNYXBbY3VydmUuaW5wdXRdLmRhdGEubGVuZ3RoO1xuICAgICAgICBjb25zdCBrZXlmcmFtZUNvdW50ID0gb3V0cHV0TWFwW2N1cnZlLm91dHB1dF0uZGF0YS5sZW5ndGggLyBtb3JwaFRhcmdldENvdW50O1xuXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbW9ycGhUYXJnZXRDb3VudDsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCBtb3JwaFRhcmdldE91dHB1dCA9IG5ldyBGbG9hdDMyQXJyYXkoa2V5ZnJhbWVDb3VudCk7XG4gICAgICAgICAgICAvLyB0aGUgb3V0cHV0IGRhdGEgZm9yIGFsbCBtb3JwaCB0YXJnZXRzIGluIGEgc2luZ2xlIGN1cnZlIGlzIGludGVybGVhdmVkLiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBrZXlmcmFtZSBvdXRwdXQgZGF0YSBmb3IgYSBzaW5nbGUgbW9ycGggdGFyZ2V0XG4gICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGtleWZyYW1lQ291bnQ7IGsrKykge1xuICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0T3V0cHV0W2tdID0gb3V0cHV0TWFwW2N1cnZlLm91dHB1dF0uZGF0YVtrICogbW9ycGhUYXJnZXRDb3VudCArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gbmV3IEFuaW1EYXRhKDEsIG1vcnBoVGFyZ2V0T3V0cHV0KTtcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgaW5kaXZpZHVhbCBtb3JwaCB0YXJnZXQgb3V0cHV0IGRhdGEgdG8gdGhlIG91dHB1dE1hcCB1c2luZyBhIG5lZ2F0aXZlIHZhbHVlIGtleSAoc28gYXMgbm90IHRvIGNsYXNoIHdpdGggc2FtcGxlci5vdXRwdXQgdmFsdWVzKVxuICAgICAgICAgICAgb3V0cHV0TWFwWy1vdXRwdXRDb3VudGVyXSA9IG91dHB1dDtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoQ3VydmUgPSB7XG4gICAgICAgICAgICAgICAgcGF0aHM6IFt7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eVBhdGg6IGVudGl0eVBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudDogJ2dyYXBoJyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoOiBbYHdlaWdodC4ke3JldHJpZXZlV2VpZ2h0TmFtZShub2RlLm5hbWUsIGopfWBdXG4gICAgICAgICAgICAgICAgfV0sXG4gICAgICAgICAgICAgICAgLy8gZWFjaCBtb3JwaCB0YXJnZXQgY3VydmUgaW5wdXQgY2FuIHVzZSB0aGUgc2FtZSBzYW1wbGVyLmlucHV0IGZyb20gdGhlIGNoYW5uZWwgdGhleSB3ZXJlIGFsbCBpblxuICAgICAgICAgICAgICAgIGlucHV0OiBjdXJ2ZS5pbnB1dCxcbiAgICAgICAgICAgICAgICAvLyBidXQgZWFjaCBtb3JwaCB0YXJnZXQgY3VydmUgc2hvdWxkIHJlZmVyZW5jZSBpdHMgaW5kaXZpZHVhbCBvdXRwdXQgdGhhdCB3YXMganVzdCBjcmVhdGVkXG4gICAgICAgICAgICAgICAgb3V0cHV0OiAtb3V0cHV0Q291bnRlcixcbiAgICAgICAgICAgICAgICBpbnRlcnBvbGF0aW9uOiBjdXJ2ZS5pbnRlcnBvbGF0aW9uXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgb3V0cHV0Q291bnRlcisrO1xuICAgICAgICAgICAgLy8gYWRkIHRoZSBtb3JwaCB0YXJnZXQgY3VydmUgdG8gdGhlIGN1cnZlTWFwXG4gICAgICAgICAgICBjdXJ2ZU1hcFtgbW9ycGhDdXJ2ZS0ke2l9LSR7an1gXSA9IG1vcnBoQ3VydmU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gY29udmVydCBhbmltIGNoYW5uZWxzXG4gICAgZm9yIChpID0gMDsgaSA8IGdsdGZBbmltYXRpb24uY2hhbm5lbHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgY2hhbm5lbCA9IGdsdGZBbmltYXRpb24uY2hhbm5lbHNbaV07XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGNoYW5uZWwudGFyZ2V0O1xuICAgICAgICBjb25zdCBjdXJ2ZSA9IGN1cnZlTWFwW2NoYW5uZWwuc2FtcGxlcl07XG5cbiAgICAgICAgY29uc3Qgbm9kZSA9IG5vZGVzW3RhcmdldC5ub2RlXTtcbiAgICAgICAgY29uc3QgZW50aXR5UGF0aCA9IGNvbnN0cnVjdE5vZGVQYXRoKG5vZGUpO1xuXG4gICAgICAgIGlmICh0YXJnZXQucGF0aC5zdGFydHNXaXRoKCd3ZWlnaHRzJykpIHtcbiAgICAgICAgICAgIGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzKGN1cnZlLCBub2RlLCBlbnRpdHlQYXRoKTtcbiAgICAgICAgICAgIC8vIGFmdGVyIGFsbCBtb3JwaCB0YXJnZXRzIGluIHRoaXMgY3VydmUgaGF2ZSBiZWVuIGluY2x1ZGVkIGluIHRoZSBjdXJ2ZU1hcCwgdGhpcyBjdXJ2ZSBhbmQgaXRzIG91dHB1dCBkYXRhIGNhbiBiZSBkZWxldGVkXG4gICAgICAgICAgICBkZWxldGUgY3VydmVNYXBbY2hhbm5lbC5zYW1wbGVyXTtcbiAgICAgICAgICAgIGRlbGV0ZSBvdXRwdXRNYXBbY3VydmUub3V0cHV0XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGN1cnZlLnBhdGhzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVudGl0eVBhdGg6IGVudGl0eVBhdGgsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiAnZ3JhcGgnLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogW3RyYW5zZm9ybVNjaGVtYVt0YXJnZXQucGF0aF1dXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgY29uc3QgaW5wdXRzID0gW107XG4gICAgY29uc3Qgb3V0cHV0cyA9IFtdO1xuICAgIGNvbnN0IGN1cnZlcyA9IFtdO1xuXG4gICAgLy8gQWRkIGVhY2ggaW5wdXQgaW4gdGhlIG1hcCB0byB0aGUgZmluYWwgaW5wdXRzIGFycmF5LiBUaGUgaW5wdXRNYXAgc2hvdWxkIG5vdyByZWZlcmVuY2UgdGhlIGluZGV4IG9mIGlucHV0IGluIHRoZSBpbnB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgaW5wdXQgaXRzZWxmLlxuICAgIGZvciAoY29uc3QgaW5wdXRLZXkgaW4gaW5wdXRNYXApIHtcbiAgICAgICAgaW5wdXRzLnB1c2goaW5wdXRNYXBbaW5wdXRLZXldKTtcbiAgICAgICAgaW5wdXRNYXBbaW5wdXRLZXldID0gaW5wdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIEFkZCBlYWNoIG91dHB1dCBpbiB0aGUgbWFwIHRvIHRoZSBmaW5hbCBvdXRwdXRzIGFycmF5LiBUaGUgb3V0cHV0TWFwIHNob3VsZCBub3cgcmVmZXJlbmNlIHRoZSBpbmRleCBvZiBvdXRwdXQgaW4gdGhlIG91dHB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgb3V0cHV0IGl0c2VsZi5cbiAgICBmb3IgKGNvbnN0IG91dHB1dEtleSBpbiBvdXRwdXRNYXApIHtcbiAgICAgICAgb3V0cHV0cy5wdXNoKG91dHB1dE1hcFtvdXRwdXRLZXldKTtcbiAgICAgICAgb3V0cHV0TWFwW291dHB1dEtleV0gPSBvdXRwdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIENyZWF0ZSBhbiBBbmltQ3VydmUgZm9yIGVhY2ggY3VydmUgb2JqZWN0IGluIHRoZSBjdXJ2ZU1hcC4gRWFjaCBjdXJ2ZSBvYmplY3QncyBpbnB1dCB2YWx1ZSBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gdGhlIGluZGV4IG9mIHRoZSBpbnB1dCBpbiB0aGVcbiAgICAvLyBpbnB1dHMgYXJyYXlzIHVzaW5nIHRoZSBpbnB1dE1hcC4gTGlrZXdpc2UgZm9yIG91dHB1dCB2YWx1ZXMuXG4gICAgZm9yIChjb25zdCBjdXJ2ZUtleSBpbiBjdXJ2ZU1hcCkge1xuICAgICAgICBjb25zdCBjdXJ2ZURhdGEgPSBjdXJ2ZU1hcFtjdXJ2ZUtleV07XG4gICAgICAgIGN1cnZlcy5wdXNoKG5ldyBBbmltQ3VydmUoXG4gICAgICAgICAgICBjdXJ2ZURhdGEucGF0aHMsXG4gICAgICAgICAgICBpbnB1dE1hcFtjdXJ2ZURhdGEuaW5wdXRdLFxuICAgICAgICAgICAgb3V0cHV0TWFwW2N1cnZlRGF0YS5vdXRwdXRdLFxuICAgICAgICAgICAgY3VydmVEYXRhLmludGVycG9sYXRpb25cbiAgICAgICAgKSk7XG5cbiAgICAgICAgLy8gaWYgdGhpcyB0YXJnZXQgaXMgYSBzZXQgb2YgcXVhdGVybmlvbiBrZXlzLCBtYWtlIG5vdGUgb2YgaXRzIGluZGV4IHNvIHdlIGNhbiBwZXJmb3JtXG4gICAgICAgIC8vIHF1YXRlcm5pb24tc3BlY2lmaWMgcHJvY2Vzc2luZyBvbiBpdC5cbiAgICAgICAgaWYgKGN1cnZlRGF0YS5wYXRocy5sZW5ndGggPiAwICYmIGN1cnZlRGF0YS5wYXRoc1swXS5wcm9wZXJ0eVBhdGhbMF0gPT09ICdsb2NhbFJvdGF0aW9uJyAmJiBjdXJ2ZURhdGEuaW50ZXJwb2xhdGlvbiAhPT0gSU5URVJQT0xBVElPTl9DVUJJQykge1xuICAgICAgICAgICAgcXVhdEFycmF5cy5wdXNoKGN1cnZlc1tjdXJ2ZXMubGVuZ3RoIC0gMV0ub3V0cHV0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdGhlIGxpc3Qgb2YgYXJyYXkgaW5kZXhlcyBzbyB3ZSBjYW4gc2tpcCBkdXBzXG4gICAgcXVhdEFycmF5cy5zb3J0KCk7XG5cbiAgICAvLyBydW4gdGhyb3VnaCB0aGUgcXVhdGVybmlvbiBkYXRhIGFycmF5cyBmbGlwcGluZyBxdWF0ZXJuaW9uIGtleXNcbiAgICAvLyB0aGF0IGRvbid0IGZhbGwgaW4gdGhlIHNhbWUgd2luZGluZyBvcmRlci5cbiAgICBsZXQgcHJldkluZGV4ID0gbnVsbDtcbiAgICBsZXQgZGF0YTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcXVhdEFycmF5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHF1YXRBcnJheXNbaV07XG4gICAgICAgIC8vIHNraXAgb3ZlciBkdXBsaWNhdGUgYXJyYXkgaW5kaWNlc1xuICAgICAgICBpZiAoaSA9PT0gMCB8fCBpbmRleCAhPT0gcHJldkluZGV4KSB7XG4gICAgICAgICAgICBkYXRhID0gb3V0cHV0c1tpbmRleF07XG4gICAgICAgICAgICBpZiAoZGF0YS5jb21wb25lbnRzID09PSA0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZCA9IGRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICBjb25zdCBsZW4gPSBkLmxlbmd0aCAtIDQ7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGogKz0gNCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkcCA9IGRbaiArIDBdICogZFtqICsgNF0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAxXSAqIGRbaiArIDVdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgMl0gKiBkW2ogKyA2XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDNdICogZFtqICsgN107XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRwIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNF0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA1XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDZdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgN10gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmV2SW5kZXggPSBpbmRleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSBkdXJhdGlvbiBvZiB0aGUgYW5pbWF0aW9uIGFzIG1heGltdW0gdGltZSB2YWx1ZVxuICAgIGxldCBkdXJhdGlvbiA9IDA7XG4gICAgZm9yIChpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkYXRhICA9IGlucHV0c1tpXS5fZGF0YTtcbiAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1heChkdXJhdGlvbiwgZGF0YS5sZW5ndGggPT09IDAgPyAwIDogZGF0YVtkYXRhLmxlbmd0aCAtIDFdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFuaW1UcmFjayhcbiAgICAgICAgZ2x0ZkFuaW1hdGlvbi5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpID8gZ2x0ZkFuaW1hdGlvbi5uYW1lIDogKCdhbmltYXRpb25fJyArIGFuaW1hdGlvbkluZGV4KSxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICAgICAgY3VydmVzKTtcbn07XG5cbmNvbnN0IGNyZWF0ZU5vZGUgPSBmdW5jdGlvbiAoZ2x0Zk5vZGUsIG5vZGVJbmRleCkge1xuICAgIGNvbnN0IGVudGl0eSA9IG5ldyBHcmFwaE5vZGUoKTtcblxuICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpICYmIGdsdGZOb2RlLm5hbWUubGVuZ3RoID4gMCkge1xuICAgICAgICBlbnRpdHkubmFtZSA9IGdsdGZOb2RlLm5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW50aXR5Lm5hbWUgPSAnbm9kZV8nICsgbm9kZUluZGV4O1xuICAgIH1cblxuICAgIC8vIFBhcnNlIHRyYW5zZm9ybWF0aW9uIHByb3BlcnRpZXNcbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ21hdHJpeCcpKSB7XG4gICAgICAgIHRlbXBNYXQuZGF0YS5zZXQoZ2x0Zk5vZGUubWF0cml4KTtcbiAgICAgICAgdGVtcE1hdC5nZXRUcmFuc2xhdGlvbih0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUG9zaXRpb24odGVtcFZlYyk7XG4gICAgICAgIHRlbXBNYXQuZ2V0RXVsZXJBbmdsZXModGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbEV1bGVyQW5nbGVzKHRlbXBWZWMpO1xuICAgICAgICB0ZW1wTWF0LmdldFNjYWxlKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZSh0ZW1wVmVjKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3JvdGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgciA9IGdsdGZOb2RlLnJvdGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxSb3RhdGlvbihyWzBdLCByWzFdLCByWzJdLCByWzNdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3RyYW5zbGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgdCA9IGdsdGZOb2RlLnRyYW5zbGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxQb3NpdGlvbih0WzBdLCB0WzFdLCB0WzJdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgY29uc3QgcyA9IGdsdGZOb2RlLnNjYWxlO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZShzWzBdLCBzWzFdLCBzWzJdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW50aXR5O1xufTtcblxuLy8gY3JlYXRlcyBhIGNhbWVyYSBjb21wb25lbnQgb24gdGhlIHN1cHBsaWVkIG5vZGUsIGFuZCByZXR1cm5zIGl0XG5jb25zdCBjcmVhdGVDYW1lcmEgPSBmdW5jdGlvbiAoZ2x0ZkNhbWVyYSwgbm9kZSkge1xuXG4gICAgY29uc3QgcHJvamVjdGlvbiA9IGdsdGZDYW1lcmEudHlwZSA9PT0gJ29ydGhvZ3JhcGhpYycgPyBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA6IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkU7XG4gICAgY29uc3QgZ2x0ZlByb3BlcnRpZXMgPSBwcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA/IGdsdGZDYW1lcmEub3J0aG9ncmFwaGljIDogZ2x0ZkNhbWVyYS5wZXJzcGVjdGl2ZTtcblxuICAgIGNvbnN0IGNvbXBvbmVudERhdGEgPSB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICBwcm9qZWN0aW9uOiBwcm9qZWN0aW9uLFxuICAgICAgICBuZWFyQ2xpcDogZ2x0ZlByb3BlcnRpZXMuem5lYXIsXG4gICAgICAgIGFzcGVjdFJhdGlvTW9kZTogQVNQRUNUX0FVVE9cbiAgICB9O1xuXG4gICAgaWYgKGdsdGZQcm9wZXJ0aWVzLnpmYXIpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5mYXJDbGlwID0gZ2x0ZlByb3BlcnRpZXMuemZhcjtcbiAgICB9XG5cbiAgICBpZiAocHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5vcnRob0hlaWdodCA9IDAuNSAqIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy55bWFnKSB7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvTW9kZSA9IEFTUEVDVF9NQU5VQUw7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvID0gZ2x0ZlByb3BlcnRpZXMueG1hZyAvIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBjb21wb25lbnREYXRhLmZvdiA9IGdsdGZQcm9wZXJ0aWVzLnlmb3YgKiBtYXRoLlJBRF9UT19ERUc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy5hc3BlY3RSYXRpbykge1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfTUFOVUFMO1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpbyA9IGdsdGZQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY2FtZXJhRW50aXR5ID0gbmV3IEVudGl0eShnbHRmQ2FtZXJhLm5hbWUpO1xuICAgIGNhbWVyYUVudGl0eS5hZGRDb21wb25lbnQoJ2NhbWVyYScsIGNvbXBvbmVudERhdGEpO1xuICAgIHJldHVybiBjYW1lcmFFbnRpdHk7XG59O1xuXG4vLyBjcmVhdGVzIGxpZ2h0IGNvbXBvbmVudCwgYWRkcyBpdCB0byB0aGUgbm9kZSBhbmQgcmV0dXJucyB0aGUgY3JlYXRlZCBsaWdodCBjb21wb25lbnRcbmNvbnN0IGNyZWF0ZUxpZ2h0ID0gZnVuY3Rpb24gKGdsdGZMaWdodCwgbm9kZSkge1xuXG4gICAgY29uc3QgbGlnaHRQcm9wcyA9IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHR5cGU6IGdsdGZMaWdodC50eXBlID09PSAncG9pbnQnID8gJ29tbmknIDogZ2x0ZkxpZ2h0LnR5cGUsXG4gICAgICAgIGNvbG9yOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ2NvbG9yJykgPyBuZXcgQ29sb3IoZ2x0ZkxpZ2h0LmNvbG9yKSA6IENvbG9yLldISVRFLFxuXG4gICAgICAgIC8vIHdoZW4gcmFuZ2UgaXMgbm90IGRlZmluZWQsIGluZmluaXR5IHNob3VsZCBiZSB1c2VkIC0gYnV0IHRoYXQgaXMgY2F1c2luZyBpbmZpbml0eSBpbiBib3VuZHMgY2FsY3VsYXRpb25zXG4gICAgICAgIHJhbmdlOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3JhbmdlJykgPyBnbHRmTGlnaHQucmFuZ2UgOiA5OTk5LFxuXG4gICAgICAgIGZhbGxvZmZNb2RlOiBMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQsXG5cbiAgICAgICAgLy8gVE9ETzogKGVuZ2luZSBpc3N1ZSAjMzI1MikgU2V0IGludGVuc2l0eSB0byBtYXRjaCBnbFRGIHNwZWNpZmljYXRpb24sIHdoaWNoIHVzZXMgcGh5c2ljYWxseSBiYXNlZCB2YWx1ZXM6XG4gICAgICAgIC8vIC0gT21uaSBhbmQgc3BvdCBsaWdodHMgdXNlIGx1bWlub3VzIGludGVuc2l0eSBpbiBjYW5kZWxhIChsbS9zcilcbiAgICAgICAgLy8gLSBEaXJlY3Rpb25hbCBsaWdodHMgdXNlIGlsbHVtaW5hbmNlIGluIGx1eCAobG0vbTIpLlxuICAgICAgICAvLyBDdXJyZW50IGltcGxlbWVudGF0aW9uOiBjbGFwbXMgc3BlY2lmaWVkIGludGVuc2l0eSB0byAwLi4yIHJhbmdlXG4gICAgICAgIGludGVuc2l0eTogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdpbnRlbnNpdHknKSA/IG1hdGguY2xhbXAoZ2x0ZkxpZ2h0LmludGVuc2l0eSwgMCwgMikgOiAxXG4gICAgfTtcblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3Nwb3QnKSkge1xuICAgICAgICBsaWdodFByb3BzLmlubmVyQ29uZUFuZ2xlID0gZ2x0ZkxpZ2h0LnNwb3QuaGFzT3duUHJvcGVydHkoJ2lubmVyQ29uZUFuZ2xlJykgPyBnbHRmTGlnaHQuc3BvdC5pbm5lckNvbmVBbmdsZSAqIG1hdGguUkFEX1RPX0RFRyA6IDA7XG4gICAgICAgIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUgPSBnbHRmTGlnaHQuc3BvdC5oYXNPd25Qcm9wZXJ0eSgnb3V0ZXJDb25lQW5nbGUnKSA/IGdsdGZMaWdodC5zcG90Lm91dGVyQ29uZUFuZ2xlICogbWF0aC5SQURfVE9fREVHIDogTWF0aC5QSSAvIDQ7XG4gICAgfVxuXG4gICAgLy8gZ2xURiBzdG9yZXMgbGlnaHQgYWxyZWFkeSBpbiBlbmVyZ3kvYXJlYSwgYnV0IHdlIG5lZWQgdG8gcHJvdmlkZSB0aGUgbGlnaHQgd2l0aCBvbmx5IHRoZSBlbmVyZ3kgcGFyYW1ldGVyLFxuICAgIC8vIHNvIHdlIG5lZWQgdGhlIGludGVuc2l0aWVzIGluIGNhbmRlbGEgYmFjayB0byBsdW1lblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoXCJpbnRlbnNpdHlcIikpIHtcbiAgICAgICAgbGlnaHRQcm9wcy5sdW1pbmFuY2UgPSBnbHRmTGlnaHQuaW50ZW5zaXR5ICogTGlnaHQuZ2V0TGlnaHRVbml0Q29udmVyc2lvbihsaWdodFR5cGVzW2xpZ2h0UHJvcHMudHlwZV0sIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUsIGxpZ2h0UHJvcHMuaW5uZXJDb25lQW5nbGUpO1xuICAgIH1cblxuICAgIC8vIFJvdGF0ZSB0byBtYXRjaCBsaWdodCBvcmllbnRhdGlvbiBpbiBnbFRGIHNwZWNpZmljYXRpb25cbiAgICAvLyBOb3RlIHRoYXQgdGhpcyBhZGRzIGEgbmV3IGVudGl0eSBub2RlIGludG8gdGhlIGhpZXJhcmNoeSB0aGF0IGRvZXMgbm90IGV4aXN0IGluIHRoZSBnbHRmIGhpZXJhcmNoeVxuICAgIGNvbnN0IGxpZ2h0RW50aXR5ID0gbmV3IEVudGl0eShub2RlLm5hbWUpO1xuICAgIGxpZ2h0RW50aXR5LnJvdGF0ZUxvY2FsKDkwLCAwLCAwKTtcblxuICAgIC8vIGFkZCBjb21wb25lbnRcbiAgICBsaWdodEVudGl0eS5hZGRDb21wb25lbnQoJ2xpZ2h0JywgbGlnaHRQcm9wcyk7XG4gICAgcmV0dXJuIGxpZ2h0RW50aXR5O1xufTtcblxuY29uc3QgY3JlYXRlU2tpbnMgPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld3MpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ3NraW5zJykgfHwgZ2x0Zi5za2lucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8vIGNhY2hlIGZvciBza2lucyB0byBmaWx0ZXIgb3V0IGR1cGxpY2F0ZXNcbiAgICBjb25zdCBnbGJTa2lucyA9IG5ldyBNYXAoKTtcblxuICAgIHJldHVybiBnbHRmLnNraW5zLm1hcChmdW5jdGlvbiAoZ2x0ZlNraW4pIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVNraW4oZGV2aWNlLCBnbHRmU2tpbiwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2xiU2tpbnMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlTWVzaGVzID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgb3B0aW9ucykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnbWVzaGVzJykgfHwgZ2x0Zi5tZXNoZXMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICFnbHRmLmhhc093blByb3BlcnR5KCdhY2Nlc3NvcnMnKSB8fCBnbHRmLmFjY2Vzc29ycy5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgIWdsdGYuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXdzJykgfHwgZ2x0Zi5idWZmZXJWaWV3cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8vIGRpY3Rpb25hcnkgb2YgdmVydGV4IGJ1ZmZlcnMgdG8gYXZvaWQgZHVwbGljYXRlc1xuICAgIGNvbnN0IHZlcnRleEJ1ZmZlckRpY3QgPSB7fTtcblxuICAgIHJldHVybiBnbHRmLm1lc2hlcy5tYXAoZnVuY3Rpb24gKGdsdGZNZXNoKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgZ2x0Zk1lc2gsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgY2FsbGJhY2ssIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0LCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBvcHRpb25zKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZU1hdGVyaWFscyA9IGZ1bmN0aW9uIChnbHRmLCB0ZXh0dXJlcywgb3B0aW9ucywgZmxpcFYpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ21hdGVyaWFscycpIHx8IGdsdGYubWF0ZXJpYWxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5tYXRlcmlhbCAmJiBvcHRpb25zLm1hdGVyaWFsLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5tYXRlcmlhbCAmJiBvcHRpb25zLm1hdGVyaWFsLnByb2Nlc3MgfHwgY3JlYXRlTWF0ZXJpYWw7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubWF0ZXJpYWwgJiYgb3B0aW9ucy5tYXRlcmlhbC5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLm1hdGVyaWFscy5tYXAoZnVuY3Rpb24gKGdsdGZNYXRlcmlhbCkge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTWF0ZXJpYWwpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gcHJvY2VzcyhnbHRmTWF0ZXJpYWwsIHRleHR1cmVzLCBmbGlwVik7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zk1hdGVyaWFsLCBtYXRlcmlhbCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlVmFyaWFudHMgPSBmdW5jdGlvbiAoZ2x0Zikge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eShcImV4dGVuc2lvbnNcIikgfHwgIWdsdGYuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eShcIktIUl9tYXRlcmlhbHNfdmFyaWFudHNcIikpXG4gICAgICAgIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgZGF0YSA9IGdsdGYuZXh0ZW5zaW9ucy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzLnZhcmlhbnRzO1xuICAgIGNvbnN0IHZhcmlhbnRzID0ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhcmlhbnRzW2RhdGFbaV0ubmFtZV0gPSBpO1xuICAgIH1cbiAgICByZXR1cm4gdmFyaWFudHM7XG59O1xuXG5jb25zdCBjcmVhdGVBbmltYXRpb25zID0gZnVuY3Rpb24gKGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3cywgb3B0aW9ucykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnYW5pbWF0aW9ucycpIHx8IGdsdGYuYW5pbWF0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLnBvc3Rwcm9jZXNzO1xuXG4gICAgcmV0dXJuIGdsdGYuYW5pbWF0aW9ucy5tYXAoZnVuY3Rpb24gKGdsdGZBbmltYXRpb24sIGluZGV4KSB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZBbmltYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFuaW1hdGlvbiA9IGNyZWF0ZUFuaW1hdGlvbihnbHRmQW5pbWF0aW9uLCBpbmRleCwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2x0Zi5tZXNoZXMpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZBbmltYXRpb24sIGFuaW1hdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFuaW1hdGlvbjtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZU5vZGVzID0gZnVuY3Rpb24gKGdsdGYsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ25vZGVzJykgfHwgZ2x0Zi5ub2Rlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubm9kZSAmJiBvcHRpb25zLm5vZGUucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm5vZGUgJiYgb3B0aW9ucy5ub2RlLnByb2Nlc3MgfHwgY3JlYXRlTm9kZTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5ub2RlICYmIG9wdGlvbnMubm9kZS5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IG5vZGVzID0gZ2x0Zi5ub2Rlcy5tYXAoZnVuY3Rpb24gKGdsdGZOb2RlLCBpbmRleCkge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgbm9kZSA9IHByb2Nlc3MoZ2x0Zk5vZGUsIGluZGV4KTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTm9kZSwgbm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfSk7XG5cbiAgICAvLyBidWlsZCBub2RlIGhpZXJhcmNoeVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0Zi5ub2Rlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmTm9kZSA9IGdsdGYubm9kZXNbaV07XG4gICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnY2hpbGRyZW4nKSkge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gbm9kZXNbaV07XG4gICAgICAgICAgICBjb25zdCB1bmlxdWVOYW1lcyA9IHsgfTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZ2x0Zk5vZGUuY2hpbGRyZW4ubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IG5vZGVzW2dsdGZOb2RlLmNoaWxkcmVuW2pdXTtcbiAgICAgICAgICAgICAgICBpZiAoIWNoaWxkLnBhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodW5pcXVlTmFtZXMuaGFzT3duUHJvcGVydHkoY2hpbGQubmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoaWxkLm5hbWUgKz0gdW5pcXVlTmFtZXNbY2hpbGQubmFtZV0rKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaXF1ZU5hbWVzW2NoaWxkLm5hbWVdID0gMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQuYWRkQ2hpbGQoY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2Rlcztcbn07XG5cbmNvbnN0IGNyZWF0ZVNjZW5lcyA9IGZ1bmN0aW9uIChnbHRmLCBub2Rlcykge1xuICAgIGNvbnN0IHNjZW5lcyA9IFtdO1xuICAgIGNvbnN0IGNvdW50ID0gZ2x0Zi5zY2VuZXMubGVuZ3RoO1xuXG4gICAgLy8gaWYgdGhlcmUncyBhIHNpbmdsZSBzY2VuZSB3aXRoIGEgc2luZ2xlIG5vZGUgaW4gaXQsIGRvbid0IGNyZWF0ZSB3cmFwcGVyIG5vZGVzXG4gICAgaWYgKGNvdW50ID09PSAxICYmIGdsdGYuc2NlbmVzWzBdLm5vZGVzPy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgY29uc3Qgbm9kZUluZGV4ID0gZ2x0Zi5zY2VuZXNbMF0ubm9kZXNbMF07XG4gICAgICAgIHNjZW5lcy5wdXNoKG5vZGVzW25vZGVJbmRleF0pO1xuICAgIH0gZWxzZSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIHJvb3Qgbm9kZSBwZXIgc2NlbmVcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGdsdGYuc2NlbmVzW2ldO1xuICAgICAgICAgICAgaWYgKHNjZW5lLm5vZGVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NlbmVSb290ID0gbmV3IEdyYXBoTm9kZShzY2VuZS5uYW1lKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IHNjZW5lLm5vZGVzLmxlbmd0aDsgbisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkTm9kZSA9IG5vZGVzW3NjZW5lLm5vZGVzW25dXTtcbiAgICAgICAgICAgICAgICAgICAgc2NlbmVSb290LmFkZENoaWxkKGNoaWxkTm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNjZW5lcy5wdXNoKHNjZW5lUm9vdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc2NlbmVzO1xufTtcblxuY29uc3QgY3JlYXRlQ2FtZXJhcyA9IGZ1bmN0aW9uIChnbHRmLCBub2Rlcywgb3B0aW9ucykge1xuXG4gICAgbGV0IGNhbWVyYXMgPSBudWxsO1xuXG4gICAgaWYgKGdsdGYuaGFzT3duUHJvcGVydHkoJ25vZGVzJykgJiYgZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnY2FtZXJhcycpICYmIGdsdGYuY2FtZXJhcy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jYW1lcmEgJiYgb3B0aW9ucy5jYW1lcmEucHJlcHJvY2VzcztcbiAgICAgICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jYW1lcmEgJiYgb3B0aW9ucy5jYW1lcmEucHJvY2VzcyB8fCBjcmVhdGVDYW1lcmE7XG4gICAgICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhbWVyYSAmJiBvcHRpb25zLmNhbWVyYS5wb3N0cHJvY2VzcztcblxuICAgICAgICBnbHRmLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICAgICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnY2FtZXJhJykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBnbHRmQ2FtZXJhID0gZ2x0Zi5jYW1lcmFzW2dsdGZOb2RlLmNhbWVyYV07XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZDYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZkNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gcHJvY2VzcyhnbHRmQ2FtZXJhLCBub2Rlc1tub2RlSW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQ2FtZXJhLCBjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBjYW1lcmEgdG8gbm9kZS0+Y2FtZXJhIG1hcFxuICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWNhbWVyYXMpIGNhbWVyYXMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFzLnNldChnbHRmTm9kZSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNhbWVyYXM7XG59O1xuXG5jb25zdCBjcmVhdGVMaWdodHMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpIHtcblxuICAgIGxldCBsaWdodHMgPSBudWxsO1xuXG4gICAgaWYgKGdsdGYuaGFzT3duUHJvcGVydHkoJ25vZGVzJykgJiYgZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnZXh0ZW5zaW9ucycpICYmXG4gICAgICAgIGdsdGYuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2xpZ2h0c19wdW5jdHVhbCcpICYmIGdsdGYuZXh0ZW5zaW9ucy5LSFJfbGlnaHRzX3B1bmN0dWFsLmhhc093blByb3BlcnR5KCdsaWdodHMnKSkge1xuXG4gICAgICAgIGNvbnN0IGdsdGZMaWdodHMgPSBnbHRmLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5saWdodHM7XG4gICAgICAgIGlmIChnbHRmTGlnaHRzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpZ2h0ICYmIG9wdGlvbnMubGlnaHQucHJlcHJvY2VzcztcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubGlnaHQgJiYgb3B0aW9ucy5saWdodC5wcm9jZXNzIHx8IGNyZWF0ZUxpZ2h0O1xuICAgICAgICAgICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubGlnaHQgJiYgb3B0aW9ucy5saWdodC5wb3N0cHJvY2VzcztcblxuICAgICAgICAgICAgLy8gaGFuZGxlIG5vZGVzIHdpdGggbGlnaHRzXG4gICAgICAgICAgICBnbHRmLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSAmJlxuICAgICAgICAgICAgICAgICAgICBnbHRmTm9kZS5leHRlbnNpb25zLmhhc093blByb3BlcnR5KCdLSFJfbGlnaHRzX3B1bmN0dWFsJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5LSFJfbGlnaHRzX3B1bmN0dWFsLmhhc093blByb3BlcnR5KCdsaWdodCcpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRJbmRleCA9IGdsdGZOb2RlLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5saWdodDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkxpZ2h0ID0gZ2x0ZkxpZ2h0c1tsaWdodEluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZMaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZMaWdodCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IHByb2Nlc3MoZ2x0ZkxpZ2h0LCBub2Rlc1tub2RlSW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZMaWdodCwgbGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdGhlIGxpZ2h0IHRvIG5vZGUtPmxpZ2h0IG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFsaWdodHMpIGxpZ2h0cyA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaWdodHMuc2V0KGdsdGZOb2RlLCBsaWdodCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBsaWdodHM7XG59O1xuXG4vLyBsaW5rIHNraW5zIHRvIHRoZSBtZXNoZXNcbmNvbnN0IGxpbmtTa2lucyA9IGZ1bmN0aW9uIChnbHRmLCByZW5kZXJzLCBza2lucykge1xuICAgIGdsdGYubm9kZXMuZm9yRWFjaCgoZ2x0Zk5vZGUpID0+IHtcbiAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdtZXNoJykgJiYgZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3NraW4nKSkge1xuICAgICAgICAgICAgY29uc3QgbWVzaEdyb3VwID0gcmVuZGVyc1tnbHRmTm9kZS5tZXNoXS5tZXNoZXM7XG4gICAgICAgICAgICBtZXNoR3JvdXAuZm9yRWFjaCgobWVzaCkgPT4ge1xuICAgICAgICAgICAgICAgIG1lc2guc2tpbiA9IHNraW5zW2dsdGZOb2RlLnNraW5dO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8vIGNyZWF0ZSBlbmdpbmUgcmVzb3VyY2VzIGZyb20gdGhlIGRvd25sb2FkZWQgR0xCIGRhdGFcbmNvbnN0IGNyZWF0ZVJlc291cmNlcyA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCB0ZXh0dXJlQXNzZXRzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuZ2xvYmFsICYmIG9wdGlvbnMuZ2xvYmFsLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuZ2xvYmFsICYmIG9wdGlvbnMuZ2xvYmFsLnBvc3Rwcm9jZXNzO1xuXG4gICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgcHJlcHJvY2VzcyhnbHRmKTtcbiAgICB9XG5cbiAgICAvLyBUaGUgb3JpZ2luYWwgdmVyc2lvbiBvZiBGQUNUIGdlbmVyYXRlZCBpbmNvcnJlY3RseSBmbGlwcGVkIFYgdGV4dHVyZVxuICAgIC8vIGNvb3JkaW5hdGVzLiBXZSBtdXN0IGNvbXBlbnNhdGUgYnkgZmxpcHBpbmcgViBpbiB0aGlzIGNhc2UuIE9uY2VcbiAgICAvLyBhbGwgbW9kZWxzIGhhdmUgYmVlbiByZS1leHBvcnRlZCB3ZSBjYW4gcmVtb3ZlIHRoaXMgZmxhZy5cbiAgICBjb25zdCBmbGlwViA9IGdsdGYuYXNzZXQgJiYgZ2x0Zi5hc3NldC5nZW5lcmF0b3IgPT09ICdQbGF5Q2FudmFzJztcblxuICAgIC8vIFdlJ2QgbGlrZSB0byByZW1vdmUgdGhlIGZsaXBWIGNvZGUgYXQgc29tZSBwb2ludC5cbiAgICBpZiAoZmxpcFYpIHtcbiAgICAgICAgRGVidWcud2FybignZ2xURiBtb2RlbCBtYXkgaGF2ZSBmbGlwcGVkIFVWcy4gUGxlYXNlIHJlY29udmVydC4nKTtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlcyA9IGNyZWF0ZU5vZGVzKGdsdGYsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHNjZW5lcyA9IGNyZWF0ZVNjZW5lcyhnbHRmLCBub2Rlcyk7XG4gICAgY29uc3QgbGlnaHRzID0gY3JlYXRlTGlnaHRzKGdsdGYsIG5vZGVzLCBvcHRpb25zKTtcbiAgICBjb25zdCBjYW1lcmFzID0gY3JlYXRlQ2FtZXJhcyhnbHRmLCBub2Rlcywgb3B0aW9ucyk7XG4gICAgY29uc3QgYW5pbWF0aW9ucyA9IGNyZWF0ZUFuaW1hdGlvbnMoZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzLCBvcHRpb25zKTtcbiAgICBjb25zdCBtYXRlcmlhbHMgPSBjcmVhdGVNYXRlcmlhbHMoZ2x0ZiwgdGV4dHVyZUFzc2V0cy5tYXAoZnVuY3Rpb24gKHRleHR1cmVBc3NldCkge1xuICAgICAgICByZXR1cm4gdGV4dHVyZUFzc2V0LnJlc291cmNlO1xuICAgIH0pLCBvcHRpb25zLCBmbGlwVik7XG4gICAgY29uc3QgdmFyaWFudHMgPSBjcmVhdGVWYXJpYW50cyhnbHRmKTtcbiAgICBjb25zdCBtZXNoVmFyaWFudHMgPSB7fTtcbiAgICBjb25zdCBtZXNoRGVmYXVsdE1hdGVyaWFscyA9IHt9O1xuICAgIGNvbnN0IG1lc2hlcyA9IGNyZWF0ZU1lc2hlcyhkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCBjYWxsYmFjaywgZmxpcFYsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHNraW5zID0gY3JlYXRlU2tpbnMoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld3MpO1xuXG4gICAgLy8gY3JlYXRlIHJlbmRlcnMgdG8gd3JhcCBtZXNoZXNcbiAgICBjb25zdCByZW5kZXJzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVuZGVyc1tpXSA9IG5ldyBSZW5kZXIoKTtcbiAgICAgICAgcmVuZGVyc1tpXS5tZXNoZXMgPSBtZXNoZXNbaV07XG4gICAgfVxuXG4gICAgLy8gbGluayBza2lucyB0byBtZXNoZXNcbiAgICBsaW5rU2tpbnMoZ2x0ZiwgcmVuZGVycywgc2tpbnMpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IEdsYlJlc291cmNlcyhnbHRmKTtcbiAgICByZXN1bHQubm9kZXMgPSBub2RlcztcbiAgICByZXN1bHQuc2NlbmVzID0gc2NlbmVzO1xuICAgIHJlc3VsdC5hbmltYXRpb25zID0gYW5pbWF0aW9ucztcbiAgICByZXN1bHQudGV4dHVyZXMgPSB0ZXh0dXJlQXNzZXRzO1xuICAgIHJlc3VsdC5tYXRlcmlhbHMgPSBtYXRlcmlhbHM7XG4gICAgcmVzdWx0LnZhcmlhbnRzID0gdmFyaWFudHM7XG4gICAgcmVzdWx0Lm1lc2hWYXJpYW50cyA9IG1lc2hWYXJpYW50cztcbiAgICByZXN1bHQubWVzaERlZmF1bHRNYXRlcmlhbHMgPSBtZXNoRGVmYXVsdE1hdGVyaWFscztcbiAgICByZXN1bHQucmVuZGVycyA9IHJlbmRlcnM7XG4gICAgcmVzdWx0LnNraW5zID0gc2tpbnM7XG4gICAgcmVzdWx0LmxpZ2h0cyA9IGxpZ2h0cztcbiAgICByZXN1bHQuY2FtZXJhcyA9IGNhbWVyYXM7XG5cbiAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZiwgcmVzdWx0KTtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xufTtcblxuY29uc3QgYXBwbHlTYW1wbGVyID0gZnVuY3Rpb24gKHRleHR1cmUsIGdsdGZTYW1wbGVyKSB7XG4gICAgY29uc3QgZ2V0RmlsdGVyID0gZnVuY3Rpb24gKGZpbHRlciwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgIHN3aXRjaCAoZmlsdGVyKSB7XG4gICAgICAgICAgICBjYXNlIDk3Mjg6IHJldHVybiBGSUxURVJfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTcyOTogcmV0dXJuIEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICBjYXNlIDk5ODQ6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTk4NTogcmV0dXJuIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk5ODY6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgY2FzZSA5OTg3OiByZXR1cm4gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgZGVmYXVsdDogICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGdldFdyYXAgPSBmdW5jdGlvbiAod3JhcCwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgIHN3aXRjaCAod3JhcCkge1xuICAgICAgICAgICAgY2FzZSAzMzA3MTogcmV0dXJuIEFERFJFU1NfQ0xBTVBfVE9fRURHRTtcbiAgICAgICAgICAgIGNhc2UgMzM2NDg6IHJldHVybiBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDtcbiAgICAgICAgICAgIGNhc2UgMTA0OTc6IHJldHVybiBBRERSRVNTX1JFUEVBVDtcbiAgICAgICAgICAgIGRlZmF1bHQ6ICAgIHJldHVybiBkZWZhdWx0VmFsdWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHRleHR1cmUpIHtcbiAgICAgICAgZ2x0ZlNhbXBsZXIgPSBnbHRmU2FtcGxlciB8fCB7IH07XG4gICAgICAgIHRleHR1cmUubWluRmlsdGVyID0gZ2V0RmlsdGVyKGdsdGZTYW1wbGVyLm1pbkZpbHRlciwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5tYWdGaWx0ZXIgPSBnZXRGaWx0ZXIoZ2x0ZlNhbXBsZXIubWFnRmlsdGVyLCBGSUxURVJfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzVSA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFMsIEFERFJFU1NfUkVQRUFUKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzViA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFQsIEFERFJFU1NfUkVQRUFUKTtcbiAgICB9XG59O1xuXG5sZXQgZ2x0ZlRleHR1cmVVbmlxdWVJZCA9IDA7XG5cbi8vIGxvYWQgYW4gaW1hZ2VcbmNvbnN0IGxvYWRJbWFnZUFzeW5jID0gZnVuY3Rpb24gKGdsdGZJbWFnZSwgaW5kZXgsIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmltYWdlICYmIG9wdGlvbnMuaW1hZ2UucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLmltYWdlICYmIG9wdGlvbnMuaW1hZ2UucHJvY2Vzc0FzeW5jKSB8fCBmdW5jdGlvbiAoZ2x0ZkltYWdlLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmltYWdlICYmIG9wdGlvbnMuaW1hZ2UucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkltYWdlLCB0ZXh0dXJlQXNzZXQpO1xuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHRleHR1cmVBc3NldCk7XG4gICAgfTtcblxuICAgIGNvbnN0IG1pbWVUeXBlRmlsZUV4dGVuc2lvbnMgPSB7XG4gICAgICAgICdpbWFnZS9wbmcnOiAncG5nJyxcbiAgICAgICAgJ2ltYWdlL2pwZWcnOiAnanBnJyxcbiAgICAgICAgJ2ltYWdlL2Jhc2lzJzogJ2Jhc2lzJyxcbiAgICAgICAgJ2ltYWdlL2t0eCc6ICdrdHgnLFxuICAgICAgICAnaW1hZ2Uva3R4Mic6ICdrdHgyJyxcbiAgICAgICAgJ2ltYWdlL3ZuZC1tcy5kZHMnOiAnZGRzJ1xuICAgIH07XG5cbiAgICBjb25zdCBsb2FkVGV4dHVyZSA9IGZ1bmN0aW9uICh1cmwsIGJ1ZmZlclZpZXcsIG1pbWVUeXBlLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSAoZ2x0ZkltYWdlLm5hbWUgfHwgJ2dsdGYtdGV4dHVyZScpICsgJy0nICsgZ2x0ZlRleHR1cmVVbmlxdWVJZCsrO1xuXG4gICAgICAgIC8vIGNvbnN0cnVjdCB0aGUgYXNzZXQgZmlsZVxuICAgICAgICBjb25zdCBmaWxlID0ge1xuICAgICAgICAgICAgdXJsOiB1cmwgfHwgbmFtZVxuICAgICAgICB9O1xuICAgICAgICBpZiAoYnVmZmVyVmlldykge1xuICAgICAgICAgICAgZmlsZS5jb250ZW50cyA9IGJ1ZmZlclZpZXcuc2xpY2UoMCkuYnVmZmVyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtaW1lVHlwZSkge1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gbWltZVR5cGVGaWxlRXh0ZW5zaW9uc1ttaW1lVHlwZV07XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uKSB7XG4gICAgICAgICAgICAgICAgZmlsZS5maWxlbmFtZSA9IGZpbGUudXJsICsgJy4nICsgZXh0ZW5zaW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCBsb2FkIHRoZSBhc3NldFxuICAgICAgICBjb25zdCBhc3NldCA9IG5ldyBBc3NldChuYW1lLCAndGV4dHVyZScsIGZpbGUsIG51bGwsIG9wdGlvbnMpO1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIG9uTG9hZCk7XG4gICAgICAgIGFzc2V0Lm9uKCdlcnJvcicsIGNhbGxiYWNrKTtcbiAgICAgICAgcmVnaXN0cnkuYWRkKGFzc2V0KTtcbiAgICAgICAgcmVnaXN0cnkubG9hZChhc3NldCk7XG4gICAgfTtcblxuICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgIHByZXByb2Nlc3MoZ2x0ZkltYWdlKTtcbiAgICB9XG5cbiAgICBwcm9jZXNzQXN5bmMoZ2x0ZkltYWdlLCBmdW5jdGlvbiAoZXJyLCB0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfSBlbHNlIGlmICh0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgIG9uTG9hZCh0ZXh0dXJlQXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgndXJpJykpIHtcbiAgICAgICAgICAgICAgICAvLyB1cmkgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgaWYgKGlzRGF0YVVSSShnbHRmSW1hZ2UudXJpKSkge1xuICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZShnbHRmSW1hZ2UudXJpLCBudWxsLCBnZXREYXRhVVJJTWltZVR5cGUoZ2x0ZkltYWdlLnVyaSksIG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRUZXh0dXJlKHBhdGguam9pbih1cmxCYXNlLCBnbHRmSW1hZ2UudXJpKSwgbnVsbCwgbnVsbCwgeyBjcm9zc09yaWdpbjogJ2Fub255bW91cycgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChnbHRmSW1hZ2UuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSAmJiBnbHRmSW1hZ2UuaGFzT3duUHJvcGVydHkoJ21pbWVUeXBlJykpIHtcbiAgICAgICAgICAgICAgICAvLyBidWZmZXJ2aWV3XG4gICAgICAgICAgICAgICAgbG9hZFRleHR1cmUobnVsbCwgYnVmZmVyVmlld3NbZ2x0ZkltYWdlLmJ1ZmZlclZpZXddLCBnbHRmSW1hZ2UubWltZVR5cGUsIG51bGwpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBmYWlsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgaW1hZ2UgZm91bmQgaW4gZ2x0ZiAobmVpdGhlciB1cmkgb3IgYnVmZmVyVmlldyBmb3VuZCkuIGluZGV4PScgKyBpbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8vIGxvYWQgdGV4dHVyZXMgdXNpbmcgdGhlIGFzc2V0IHN5c3RlbVxuY29uc3QgbG9hZFRleHR1cmVzQXN5bmMgPSBmdW5jdGlvbiAoZ2x0ZiwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnaW1hZ2VzJykgfHwgZ2x0Zi5pbWFnZXMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICFnbHRmLmhhc093blByb3BlcnR5KCd0ZXh0dXJlcycpIHx8IGdsdGYudGV4dHVyZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIFtdKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMudGV4dHVyZSAmJiBvcHRpb25zLnRleHR1cmUucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLnRleHR1cmUgJiYgb3B0aW9ucy50ZXh0dXJlLnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZUZXh0dXJlLCBnbHRmSW1hZ2VzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLnRleHR1cmUgJiYgb3B0aW9ucy50ZXh0dXJlLnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3QgYXNzZXRzID0gW107ICAgICAgICAvLyBvbmUgcGVyIGltYWdlXG4gICAgY29uc3QgdGV4dHVyZXMgPSBbXTsgICAgICAvLyBsaXN0IHBlciBpbWFnZVxuXG4gICAgbGV0IHJlbWFpbmluZyA9IGdsdGYudGV4dHVyZXMubGVuZ3RoO1xuICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uICh0ZXh0dXJlSW5kZXgsIGltYWdlSW5kZXgpIHtcbiAgICAgICAgaWYgKCF0ZXh0dXJlc1tpbWFnZUluZGV4XSkge1xuICAgICAgICAgICAgdGV4dHVyZXNbaW1hZ2VJbmRleF0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0ZXh0dXJlc1tpbWFnZUluZGV4XS5wdXNoKHRleHR1cmVJbmRleCk7XG5cbiAgICAgICAgaWYgKC0tcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgIHRleHR1cmVzLmZvckVhY2goZnVuY3Rpb24gKHRleHR1cmVMaXN0LCBpbWFnZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZUxpc3QuZm9yRWFjaChmdW5jdGlvbiAodGV4dHVyZUluZGV4LCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXh0dXJlQXNzZXQgPSAoaW5kZXggPT09IDApID8gYXNzZXRzW2ltYWdlSW5kZXhdIDogY2xvbmVUZXh0dXJlQXNzZXQoYXNzZXRzW2ltYWdlSW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgYXBwbHlTYW1wbGVyKHRleHR1cmVBc3NldC5yZXNvdXJjZSwgKGdsdGYuc2FtcGxlcnMgfHwgW10pW2dsdGYudGV4dHVyZXNbdGV4dHVyZUluZGV4XS5zYW1wbGVyXSk7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdFt0ZXh0dXJlSW5kZXhdID0gdGV4dHVyZUFzc2V0O1xuICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGYudGV4dHVyZXNbdGV4dHVyZUluZGV4XSwgdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0Zi50ZXh0dXJlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmVGV4dHVyZSA9IGdsdGYudGV4dHVyZXNbaV07XG5cbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZlRleHR1cmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZUZXh0dXJlLCBnbHRmLmltYWdlcywgZnVuY3Rpb24gKGksIGdsdGZUZXh0dXJlLCBlcnIsIGdsdGZJbWFnZUluZGV4KSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZJbWFnZUluZGV4ID09PSB1bmRlZmluZWQgfHwgZ2x0ZkltYWdlSW5kZXggPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2x0ZkltYWdlSW5kZXggPSBnbHRmVGV4dHVyZT8uZXh0ZW5zaW9ucz8uS0hSX3RleHR1cmVfYmFzaXN1Py5zb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmSW1hZ2VJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbHRmSW1hZ2VJbmRleCA9IGdsdGZUZXh0dXJlLnNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhc3NldHNbZ2x0ZkltYWdlSW5kZXhdKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGltYWdlIGhhcyBhbHJlYWR5IGJlZW4gbG9hZGVkXG4gICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBnbHRmSW1hZ2VJbmRleCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZmlyc3Qgb2NjY3VycmVuY2UsIGxvYWQgaXRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkltYWdlID0gZ2x0Zi5pbWFnZXNbZ2x0ZkltYWdlSW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBsb2FkSW1hZ2VBc3luYyhnbHRmSW1hZ2UsIGksIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2dsdGZJbWFnZUluZGV4XSA9IHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgZ2x0ZkltYWdlSW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZChudWxsLCBpLCBnbHRmVGV4dHVyZSkpO1xuICAgIH1cbn07XG5cbi8vIGxvYWQgZ2x0ZiBidWZmZXJzIGFzeW5jaHJvbm91c2x5LCByZXR1cm5pbmcgdGhlbSBpbiB0aGUgY2FsbGJhY2tcbmNvbnN0IGxvYWRCdWZmZXJzQXN5bmMgPSBmdW5jdGlvbiAoZ2x0ZiwgYmluYXJ5Q2h1bmssIHVybEJhc2UsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBpZiAoIWdsdGYuYnVmZmVycyB8fCBnbHRmLmJ1ZmZlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlciAmJiBvcHRpb25zLmJ1ZmZlci5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3NBc3luYyA9IChvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyICYmIG9wdGlvbnMuYnVmZmVyLnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZCdWZmZXIsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgIH07XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyICYmIG9wdGlvbnMuYnVmZmVyLnBvc3Rwcm9jZXNzO1xuXG4gICAgbGV0IHJlbWFpbmluZyA9IGdsdGYuYnVmZmVycy5sZW5ndGg7XG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKGluZGV4LCBidWZmZXIpIHtcbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IGJ1ZmZlcjtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmLmJ1ZmZlcnNbaW5kZXhdLCBidWZmZXIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYuYnVmZmVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmQnVmZmVyID0gZ2x0Zi5idWZmZXJzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZCdWZmZXIsIGZ1bmN0aW9uIChpLCBnbHRmQnVmZmVyLCBlcnIsIGFycmF5QnVmZmVyKSB7ICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWxvb3AtZnVuY1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgb25Mb2FkKGksIG5ldyBVaW50OEFycmF5KGFycmF5QnVmZmVyKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChnbHRmQnVmZmVyLmhhc093blByb3BlcnR5KCd1cmknKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNEYXRhVVJJKGdsdGZCdWZmZXIudXJpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29udmVydCBiYXNlNjQgdG8gcmF3IGJpbmFyeSBkYXRhIGhlbGQgaW4gYSBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGRvZXNuJ3QgaGFuZGxlIFVSTEVuY29kZWQgRGF0YVVSSXMgLSBzZWUgU08gYW5zd2VyICM2ODUwMjc2IGZvciBjb2RlIHRoYXQgZG9lcyB0aGlzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBieXRlU3RyaW5nID0gYXRvYihnbHRmQnVmZmVyLnVyaS5zcGxpdCgnLCcpWzFdKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIGEgdmlldyBpbnRvIHRoZSBidWZmZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpbmFyeUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZVN0cmluZy5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIGJ5dGVzIG9mIHRoZSBidWZmZXIgdG8gdGhlIGNvcnJlY3QgdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJ5dGVTdHJpbmcubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5hcnlBcnJheVtqXSA9IGJ5dGVTdHJpbmcuY2hhckNvZGVBdChqKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgb25Mb2FkKGksIGJpbmFyeUFycmF5KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGh0dHAuZ2V0KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGguam9pbih1cmxCYXNlLCBnbHRmQnVmZmVyLnVyaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBjYWNoZTogdHJ1ZSwgcmVzcG9uc2VUeXBlOiAnYXJyYXlidWZmZXInLCByZXRyeTogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAoaSwgZXJyLCByZXN1bHQpIHsgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBuZXcgVWludDhBcnJheShyZXN1bHQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0uYmluZChudWxsLCBpKVxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGdsYiBidWZmZXIgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBiaW5hcnlDaHVuayk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQobnVsbCwgaSwgZ2x0ZkJ1ZmZlcikpO1xuICAgIH1cbn07XG5cbi8vIHBhcnNlIHRoZSBnbHRmIGNodW5rLCByZXR1cm5zIHRoZSBnbHRmIGpzb25cbmNvbnN0IHBhcnNlR2x0ZiA9IGZ1bmN0aW9uIChnbHRmQ2h1bmssIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgZGVjb2RlQmluYXJ5VXRmOCA9IGZ1bmN0aW9uIChhcnJheSkge1xuICAgICAgICBpZiAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShhcnJheSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RyID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGFycmF5W2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKHN0cikpO1xuICAgIH07XG5cbiAgICBjb25zdCBnbHRmID0gSlNPTi5wYXJzZShkZWNvZGVCaW5hcnlVdGY4KGdsdGZDaHVuaykpO1xuXG4gICAgLy8gY2hlY2sgZ2x0ZiB2ZXJzaW9uXG4gICAgaWYgKGdsdGYuYXNzZXQgJiYgZ2x0Zi5hc3NldC52ZXJzaW9uICYmIHBhcnNlRmxvYXQoZ2x0Zi5hc3NldC52ZXJzaW9uKSA8IDIpIHtcbiAgICAgICAgY2FsbGJhY2soYEludmFsaWQgZ2x0ZiB2ZXJzaW9uLiBFeHBlY3RlZCB2ZXJzaW9uIDIuMCBvciBhYm92ZSBidXQgZm91bmQgdmVyc2lvbiAnJHtnbHRmLmFzc2V0LnZlcnNpb259Jy5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGNoZWNrIHJlcXVpcmVkIGV4dGVuc2lvbnNcbiAgICBjb25zdCBleHRlbnNpb25zUmVxdWlyZWQgPSBnbHRmPy5leHRlbnNpb25zUmVxdWlyZWQgfHwgW107XG4gICAgaWYgKCFkcmFjb0RlY29kZXJJbnN0YW5jZSAmJiAhZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlKCkgJiYgZXh0ZW5zaW9uc1JlcXVpcmVkLmluZGV4T2YoJ0tIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uJykgIT09IC0xKSB7XG4gICAgICAgIFdhc21Nb2R1bGUuZ2V0SW5zdGFuY2UoJ0RyYWNvRGVjb2Rlck1vZHVsZScsIChpbnN0YW5jZSkgPT4ge1xuICAgICAgICAgICAgZHJhY29EZWNvZGVySW5zdGFuY2UgPSBpbnN0YW5jZTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGdsdGYpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBnbHRmKTtcbiAgICB9XG59O1xuXG4vLyBwYXJzZSBnbGIgZGF0YSwgcmV0dXJucyB0aGUgZ2x0ZiBhbmQgYmluYXJ5IGNodW5rXG5jb25zdCBwYXJzZUdsYiA9IGZ1bmN0aW9uIChnbGJEYXRhLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGRhdGEgPSAoZ2xiRGF0YSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSA/IG5ldyBEYXRhVmlldyhnbGJEYXRhKSA6IG5ldyBEYXRhVmlldyhnbGJEYXRhLmJ1ZmZlciwgZ2xiRGF0YS5ieXRlT2Zmc2V0LCBnbGJEYXRhLmJ5dGVMZW5ndGgpO1xuXG4gICAgLy8gcmVhZCBoZWFkZXJcbiAgICBjb25zdCBtYWdpYyA9IGRhdGEuZ2V0VWludDMyKDAsIHRydWUpO1xuICAgIGNvbnN0IHZlcnNpb24gPSBkYXRhLmdldFVpbnQzMig0LCB0cnVlKTtcbiAgICBjb25zdCBsZW5ndGggPSBkYXRhLmdldFVpbnQzMig4LCB0cnVlKTtcblxuICAgIGlmIChtYWdpYyAhPT0gMHg0NjU0NkM2Nykge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBtYWdpYyBudW1iZXIgZm91bmQgaW4gZ2xiIGhlYWRlci4gRXhwZWN0ZWQgMHg0NjU0NkM2NywgZm91bmQgMHgnICsgbWFnaWMudG9TdHJpbmcoMTYpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh2ZXJzaW9uICE9PSAyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIHZlcnNpb24gbnVtYmVyIGZvdW5kIGluIGdsYiBoZWFkZXIuIEV4cGVjdGVkIDIsIGZvdW5kICcgKyB2ZXJzaW9uKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChsZW5ndGggPD0gMCB8fCBsZW5ndGggPiBkYXRhLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbGVuZ3RoIGZvdW5kIGluIGdsYiBoZWFkZXIuIEZvdW5kICcgKyBsZW5ndGgpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gcmVhZCBjaHVua3NcbiAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICBsZXQgb2Zmc2V0ID0gMTI7XG4gICAgd2hpbGUgKG9mZnNldCA8IGxlbmd0aCkge1xuICAgICAgICBjb25zdCBjaHVua0xlbmd0aCA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCwgdHJ1ZSk7XG4gICAgICAgIGlmIChvZmZzZXQgKyBjaHVua0xlbmd0aCArIDggPiBkYXRhLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjaHVuayBsZW5ndGggZm91bmQgaW4gZ2xiLiBGb3VuZCAnICsgY2h1bmtMZW5ndGgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNodW5rVHlwZSA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCArIDQsIHRydWUpO1xuICAgICAgICBjb25zdCBjaHVua0RhdGEgPSBuZXcgVWludDhBcnJheShkYXRhLmJ1ZmZlciwgZGF0YS5ieXRlT2Zmc2V0ICsgb2Zmc2V0ICsgOCwgY2h1bmtMZW5ndGgpO1xuICAgICAgICBjaHVua3MucHVzaCh7IGxlbmd0aDogY2h1bmtMZW5ndGgsIHR5cGU6IGNodW5rVHlwZSwgZGF0YTogY2h1bmtEYXRhIH0pO1xuICAgICAgICBvZmZzZXQgKz0gY2h1bmtMZW5ndGggKyA4O1xuICAgIH1cblxuICAgIGlmIChjaHVua3MubGVuZ3RoICE9PSAxICYmIGNodW5rcy5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbnVtYmVyIG9mIGNodW5rcyBmb3VuZCBpbiBnbGIgZmlsZS4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaHVua3NbMF0udHlwZSAhPT0gMHg0RTRGNTM0QSkge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBjaHVuayB0eXBlIGZvdW5kIGluIGdsYiBmaWxlLiBFeHBlY3RlZCAweDRFNEY1MzRBLCBmb3VuZCAweCcgKyBjaHVua3NbMF0udHlwZS50b1N0cmluZygxNikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNodW5rcy5sZW5ndGggPiAxICYmIGNodW5rc1sxXS50eXBlICE9PSAweDAwNEU0OTQyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGNodW5rIHR5cGUgZm91bmQgaW4gZ2xiIGZpbGUuIEV4cGVjdGVkIDB4MDA0RTQ5NDIsIGZvdW5kIDB4JyArIGNodW5rc1sxXS50eXBlLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgIGdsdGZDaHVuazogY2h1bmtzWzBdLmRhdGEsXG4gICAgICAgIGJpbmFyeUNodW5rOiBjaHVua3MubGVuZ3RoID09PSAyID8gY2h1bmtzWzFdLmRhdGEgOiBudWxsXG4gICAgfSk7XG59O1xuXG4vLyBwYXJzZSB0aGUgY2h1bmsgb2YgZGF0YSwgd2hpY2ggY2FuIGJlIGdsYiBvciBnbHRmXG5jb25zdCBwYXJzZUNodW5rID0gZnVuY3Rpb24gKGZpbGVuYW1lLCBkYXRhLCBjYWxsYmFjaykge1xuICAgIGlmIChmaWxlbmFtZSAmJiBmaWxlbmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcuZ2xiJykpIHtcbiAgICAgICAgcGFyc2VHbGIoZGF0YSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgICAgIGdsdGZDaHVuazogZGF0YSxcbiAgICAgICAgICAgIGJpbmFyeUNodW5rOiBudWxsXG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8vIGNyZWF0ZSBidWZmZXIgdmlld3NcbmNvbnN0IHBhcnNlQnVmZmVyVmlld3NBc3luYyA9IGZ1bmN0aW9uIChnbHRmLCBidWZmZXJzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcgJiYgb3B0aW9ucy5idWZmZXJWaWV3LnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmQnVmZmVyVmlldywgYnVmZmVycywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wb3N0cHJvY2VzcztcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLmJ1ZmZlclZpZXdzID8gZ2x0Zi5idWZmZXJWaWV3cy5sZW5ndGggOiAwO1xuXG4gICAgLy8gaGFuZGxlIGNhc2Ugb2Ygbm8gYnVmZmVyc1xuICAgIGlmICghcmVtYWluaW5nKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKGluZGV4LCBidWZmZXJWaWV3KSB7XG4gICAgICAgIGNvbnN0IGdsdGZCdWZmZXJWaWV3ID0gZ2x0Zi5idWZmZXJWaWV3c1tpbmRleF07XG4gICAgICAgIGlmIChnbHRmQnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpKSB7XG4gICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVTdHJpZGUgPSBnbHRmQnVmZmVyVmlldy5ieXRlU3RyaWRlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IGJ1ZmZlclZpZXc7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkJ1ZmZlclZpZXcsIGJ1ZmZlclZpZXcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlclZpZXcgPSBnbHRmLmJ1ZmZlclZpZXdzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXJWaWV3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyVmlldywgYnVmZmVycywgZnVuY3Rpb24gKGksIGdsdGZCdWZmZXJWaWV3LCBlcnIsIHJlc3VsdCkgeyAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWxvb3AtZnVuY1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCByZXN1bHQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBidWZmZXJzW2dsdGZCdWZmZXJWaWV3LmJ1ZmZlcl07XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlci5idWZmZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5ieXRlT2Zmc2V0ICsgKGdsdGZCdWZmZXJWaWV3LmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZCdWZmZXJWaWV3LmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCB0eXBlZEFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKG51bGwsIGksIGdsdGZCdWZmZXJWaWV3KSk7XG4gICAgfVxufTtcblxuLy8gLS0gR2xiUGFyc2VyXG5jbGFzcyBHbGJQYXJzZXIge1xuICAgIC8vIHBhcnNlIHRoZSBnbHRmIG9yIGdsYiBkYXRhIGFzeW5jaHJvbm91c2x5LCBsb2FkaW5nIGV4dGVybmFsIHJlc291cmNlc1xuICAgIHN0YXRpYyBwYXJzZUFzeW5jKGZpbGVuYW1lLCB1cmxCYXNlLCBkYXRhLCBkZXZpY2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICAvLyBwYXJzZSB0aGUgZGF0YVxuICAgICAgICBwYXJzZUNodW5rKGZpbGVuYW1lLCBkYXRhLCBmdW5jdGlvbiAoZXJyLCBjaHVua3MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcGFyc2UgZ2x0ZlxuICAgICAgICAgICAgcGFyc2VHbHRmKGNodW5rcy5nbHRmQ2h1bmssIGZ1bmN0aW9uIChlcnIsIGdsdGYpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBhc3luYyBsb2FkIGV4dGVybmFsIGJ1ZmZlcnNcbiAgICAgICAgICAgICAgICBsb2FkQnVmZmVyc0FzeW5jKGdsdGYsIGNodW5rcy5iaW5hcnlDaHVuaywgdXJsQmFzZSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgYnVmZmVycykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXN5bmMgbG9hZCBidWZmZXIgdmlld3NcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VCdWZmZXJWaWV3c0FzeW5jKGdsdGYsIGJ1ZmZlcnMsIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlclZpZXdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzeW5jIGxvYWQgaW1hZ2VzXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZXNBc3luYyhnbHRmLCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHRleHR1cmVBc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVSZXNvdXJjZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZUFzc2V0cywgb3B0aW9ucywgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHBhcnNlIHRoZSBnbHRmIG9yIGdsYiBkYXRhIHN5bmNocm9ub3VzbHkuIGV4dGVybmFsIHJlc291cmNlcyAoYnVmZmVycyBhbmQgaW1hZ2VzKSBhcmUgaWdub3JlZC5cbiAgICBzdGF0aWMgcGFyc2UoZmlsZW5hbWUsIGRhdGEsIGRldmljZSwgb3B0aW9ucykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gbnVsbDtcblxuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7IH07XG5cbiAgICAgICAgLy8gcGFyc2UgdGhlIGRhdGFcbiAgICAgICAgcGFyc2VDaHVuayhmaWxlbmFtZSwgZGF0YSwgZnVuY3Rpb24gKGVyciwgY2h1bmtzKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBwYXJzZSBnbHRmXG4gICAgICAgICAgICAgICAgcGFyc2VHbHRmKGNodW5rcy5nbHRmQ2h1bmssIGZ1bmN0aW9uIChlcnIsIGdsdGYpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGFyc2UgYnVmZmVyIHZpZXdzXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZUJ1ZmZlclZpZXdzQXN5bmMoZ2x0ZiwgW2NodW5rcy5iaW5hcnlDaHVua10sIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlclZpZXdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIHJlc291cmNlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVSZXNvdXJjZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgW10sIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHJlc3VsdF8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdF87XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBhc3NldHMsIG1heFJldHJpZXMpIHtcbiAgICAgICAgdGhpcy5fZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLl9hc3NldHMgPSBhc3NldHM7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRNYXRlcmlhbCA9IGNyZWF0ZU1hdGVyaWFsKHtcbiAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0R2xiTWF0ZXJpYWwnXG4gICAgICAgIH0sIFtdKTtcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gbWF4UmV0cmllcztcbiAgICB9XG5cbiAgICBfZ2V0VXJsV2l0aG91dFBhcmFtcyh1cmwpIHtcbiAgICAgICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPj0gMCA/IHVybC5zcGxpdCgnPycpWzBdIDogdXJsO1xuICAgIH1cblxuICAgIGxvYWQodXJsLCBjYWxsYmFjaywgYXNzZXQpIHtcbiAgICAgICAgQXNzZXQuZmV0Y2hBcnJheUJ1ZmZlcih1cmwubG9hZCwgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgR2xiUGFyc2VyLnBhcnNlQXN5bmMoXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2dldFVybFdpdGhvdXRQYXJhbXModXJsLm9yaWdpbmFsKSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aC5leHRyYWN0UGF0aCh1cmwubG9hZCksXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGV2aWNlLFxuICAgICAgICAgICAgICAgICAgICBhc3NldC5yZWdpc3RyeSxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQub3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gcmV0dXJuIGV2ZXJ5dGhpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBuZXcgR2xiQ29udGFpbmVyUmVzb3VyY2UocmVzdWx0LCBhc3NldCwgdGhpcy5fYXNzZXRzLCB0aGlzLl9kZWZhdWx0TWF0ZXJpYWwpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGFzc2V0LCB0aGlzLm1heFJldHJpZXMpO1xuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhLCBhc3NldCkge1xuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG5cbiAgICBwYXRjaChhc3NldCwgYXNzZXRzKSB7XG5cbiAgICB9XG59XG5cbmV4cG9ydCB7IEdsYlBhcnNlciB9O1xuIl0sIm5hbWVzIjpbImRyYWNvRGVjb2Rlckluc3RhbmNlIiwiZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlIiwid2luZG93IiwiRHJhY29EZWNvZGVyTW9kdWxlIiwiR2xiUmVzb3VyY2VzIiwiY29uc3RydWN0b3IiLCJnbHRmIiwibm9kZXMiLCJzY2VuZXMiLCJhbmltYXRpb25zIiwidGV4dHVyZXMiLCJtYXRlcmlhbHMiLCJ2YXJpYW50cyIsIm1lc2hWYXJpYW50cyIsIm1lc2hEZWZhdWx0TWF0ZXJpYWxzIiwicmVuZGVycyIsInNraW5zIiwibGlnaHRzIiwiY2FtZXJhcyIsImRlc3Ryb3kiLCJmb3JFYWNoIiwicmVuZGVyIiwibWVzaGVzIiwiaXNEYXRhVVJJIiwidXJpIiwidGVzdCIsImdldERhdGFVUklNaW1lVHlwZSIsInN1YnN0cmluZyIsImluZGV4T2YiLCJnZXROdW1Db21wb25lbnRzIiwiYWNjZXNzb3JUeXBlIiwiZ2V0Q29tcG9uZW50VHlwZSIsImNvbXBvbmVudFR5cGUiLCJUWVBFX0lOVDgiLCJUWVBFX1VJTlQ4IiwiVFlQRV9JTlQxNiIsIlRZUEVfVUlOVDE2IiwiVFlQRV9JTlQzMiIsIlRZUEVfVUlOVDMyIiwiVFlQRV9GTE9BVDMyIiwiZ2V0Q29tcG9uZW50U2l6ZUluQnl0ZXMiLCJnZXRDb21wb25lbnREYXRhVHlwZSIsIkludDhBcnJheSIsIlVpbnQ4QXJyYXkiLCJJbnQxNkFycmF5IiwiVWludDE2QXJyYXkiLCJJbnQzMkFycmF5IiwiVWludDMyQXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJnbHRmVG9FbmdpbmVTZW1hbnRpY01hcCIsIlNFTUFOVElDX1BPU0lUSU9OIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEFOR0VOVCIsIlNFTUFOVElDX0NPTE9SIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJTRU1BTlRJQ19URVhDT09SRDAiLCJTRU1BTlRJQ19URVhDT09SRDEiLCJTRU1BTlRJQ19URVhDT09SRDIiLCJTRU1BTlRJQ19URVhDT09SRDMiLCJTRU1BTlRJQ19URVhDT09SRDQiLCJTRU1BTlRJQ19URVhDT09SRDUiLCJTRU1BTlRJQ19URVhDT09SRDYiLCJTRU1BTlRJQ19URVhDT09SRDciLCJnZXREZXF1YW50aXplRnVuYyIsInNyY1R5cGUiLCJ4IiwiTWF0aCIsIm1heCIsImRlcXVhbnRpemVBcnJheSIsImRzdEFycmF5Iiwic3JjQXJyYXkiLCJjb252RnVuYyIsImxlbiIsImxlbmd0aCIsImkiLCJnZXRBY2Nlc3NvckRhdGEiLCJnbHRmQWNjZXNzb3IiLCJidWZmZXJWaWV3cyIsImZsYXR0ZW4iLCJudW1Db21wb25lbnRzIiwidHlwZSIsImRhdGFUeXBlIiwiYnVmZmVyVmlldyIsInJlc3VsdCIsInNwYXJzZSIsImluZGljZXNBY2Nlc3NvciIsImNvdW50IiwiaW5kaWNlcyIsIk9iamVjdCIsImFzc2lnbiIsInZhbHVlc0FjY2Vzc29yIiwic2NhbGFyIiwidmFsdWVzIiwiaGFzT3duUHJvcGVydHkiLCJiYXNlQWNjZXNzb3IiLCJieXRlT2Zmc2V0Iiwic2xpY2UiLCJ0YXJnZXRJbmRleCIsImoiLCJieXRlc1BlckVsZW1lbnQiLCJCWVRFU19QRVJfRUxFTUVOVCIsInN0b3JhZ2UiLCJBcnJheUJ1ZmZlciIsInRtcEFycmF5IiwiZHN0T2Zmc2V0Iiwic3JjT2Zmc2V0IiwiYnl0ZVN0cmlkZSIsImIiLCJidWZmZXIiLCJnZXRBY2Nlc3NvckRhdGFGbG9hdDMyIiwiZGF0YSIsIm5vcm1hbGl6ZWQiLCJmbG9hdDMyRGF0YSIsImdldEFjY2Vzc29yQm91bmRpbmdCb3giLCJtaW4iLCJjdHlwZSIsIkJvdW5kaW5nQm94IiwiVmVjMyIsImdldFByaW1pdGl2ZVR5cGUiLCJwcmltaXRpdmUiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwibW9kZSIsIlBSSU1JVElWRV9QT0lOVFMiLCJQUklNSVRJVkVfTElORVMiLCJQUklNSVRJVkVfTElORUxPT1AiLCJQUklNSVRJVkVfTElORVNUUklQIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiUFJJTUlUSVZFX1RSSUZBTiIsImdlbmVyYXRlSW5kaWNlcyIsIm51bVZlcnRpY2VzIiwiZHVtbXlJbmRpY2VzIiwiZ2VuZXJhdGVOb3JtYWxzIiwic291cmNlRGVzYyIsInAiLCJjb21wb25lbnRzIiwicG9zaXRpb25zIiwic2l6ZSIsInN0cmlkZSIsInNyY1N0cmlkZSIsInR5cGVkQXJyYXlUeXBlc0J5dGVTaXplIiwic3JjIiwidHlwZWRBcnJheVR5cGVzIiwib2Zmc2V0Iiwibm9ybWFsc1RlbXAiLCJjYWxjdWxhdGVOb3JtYWxzIiwibm9ybWFscyIsInNldCIsImZsaXBUZXhDb29yZFZzIiwidmVydGV4QnVmZmVyIiwiZmxvYXRPZmZzZXRzIiwic2hvcnRPZmZzZXRzIiwiYnl0ZU9mZnNldHMiLCJmb3JtYXQiLCJlbGVtZW50cyIsImVsZW1lbnQiLCJuYW1lIiwicHVzaCIsImZsaXAiLCJvZmZzZXRzIiwib25lIiwidHlwZWRBcnJheSIsImluZGV4IiwiY2xvbmVUZXh0dXJlIiwidGV4dHVyZSIsInNoYWxsb3dDb3B5TGV2ZWxzIiwibWlwIiwiX2xldmVscyIsImxldmVsIiwiY3ViZW1hcCIsImZhY2UiLCJUZXh0dXJlIiwiZGV2aWNlIiwiY2xvbmVUZXh0dXJlQXNzZXQiLCJBc3NldCIsImZpbGUiLCJvcHRpb25zIiwibG9hZGVkIiwicmVzb3VyY2UiLCJyZWdpc3RyeSIsImFkZCIsImNyZWF0ZVZlcnRleEJ1ZmZlckludGVybmFsIiwiZmxpcFYiLCJwb3NpdGlvbkRlc2MiLCJ2ZXJ0ZXhEZXNjIiwic2VtYW50aWMiLCJub3JtYWxpemUiLCJlbGVtZW50T3JkZXIiLCJzb3J0IiwibGhzIiwicmhzIiwibGhzT3JkZXIiLCJyaHNPcmRlciIsImsiLCJzb3VyY2UiLCJ0YXJnZXQiLCJzb3VyY2VPZmZzZXQiLCJ2ZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhGb3JtYXQiLCJpc0NvcnJlY3RseUludGVybGVhdmVkIiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX1NUQVRJQyIsInZlcnRleERhdGEiLCJsb2NrIiwidGFyZ2V0QXJyYXkiLCJzb3VyY2VBcnJheSIsInRhcmdldFN0cmlkZSIsInNvdXJjZVN0cmlkZSIsImRzdCIsImtlbmQiLCJmbG9vciIsInVubG9jayIsImNyZWF0ZVZlcnRleEJ1ZmZlciIsImF0dHJpYnV0ZXMiLCJhY2Nlc3NvcnMiLCJ2ZXJ0ZXhCdWZmZXJEaWN0IiwidXNlQXR0cmlidXRlcyIsImF0dHJpYklkcyIsImF0dHJpYiIsInZiS2V5Iiwiam9pbiIsInZiIiwiYWNjZXNzb3IiLCJhY2Nlc3NvckRhdGEiLCJjcmVhdGVWZXJ0ZXhCdWZmZXJEcmFjbyIsIm91dHB1dEdlb21ldHJ5IiwiZXh0RHJhY28iLCJkZWNvZGVyIiwiZGVjb2Rlck1vZHVsZSIsIm51bVBvaW50cyIsIm51bV9wb2ludHMiLCJleHRyYWN0RHJhY29BdHRyaWJ1dGVJbmZvIiwidW5pcXVlSWQiLCJhdHRyaWJ1dGUiLCJHZXRBdHRyaWJ1dGVCeVVuaXF1ZUlkIiwibnVtVmFsdWVzIiwibnVtX2NvbXBvbmVudHMiLCJkcmFjb0Zvcm1hdCIsImRhdGFfdHlwZSIsInB0ciIsImNvbXBvbmVudFNpemVJbkJ5dGVzIiwic3RvcmFnZVR5cGUiLCJEVF9VSU5UOCIsIl9tYWxsb2MiLCJHZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMiLCJIRUFQVTgiLCJEVF9VSU5UMTYiLCJIRUFQVTE2IiwiRFRfRkxPQVQzMiIsIkhFQVBGMzIiLCJfZnJlZSIsImF0dHJpYnV0ZUluZm8iLCJjcmVhdGVTa2luIiwiZ2x0ZlNraW4iLCJnbGJTa2lucyIsImJpbmRNYXRyaXgiLCJqb2ludHMiLCJudW1Kb2ludHMiLCJpYnAiLCJpbnZlcnNlQmluZE1hdHJpY2VzIiwiaWJtRGF0YSIsImlibVZhbHVlcyIsIk1hdDQiLCJib25lTmFtZXMiLCJrZXkiLCJza2luIiwiZ2V0IiwiU2tpbiIsInRlbXBNYXQiLCJ0ZW1wVmVjIiwiY3JlYXRlTWVzaCIsImdsdGZNZXNoIiwiY2FsbGJhY2siLCJhc3NldE9wdGlvbnMiLCJwcmltaXRpdmVzIiwicHJpbWl0aXZlVHlwZSIsIm51bUluZGljZXMiLCJjYW5Vc2VNb3JwaCIsImV4dGVuc2lvbnMiLCJLSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbiIsInVpbnQ4QnVmZmVyIiwiRGVjb2RlckJ1ZmZlciIsIkluaXQiLCJEZWNvZGVyIiwiZ2VvbWV0cnlUeXBlIiwiR2V0RW5jb2RlZEdlb21ldHJ5VHlwZSIsInN0YXR1cyIsIlBPSU5UX0NMT1VEIiwiUG9pbnRDbG91ZCIsIkRlY29kZUJ1ZmZlclRvUG9pbnRDbG91ZCIsIlRSSUFOR1VMQVJfTUVTSCIsIk1lc2giLCJEZWNvZGVCdWZmZXJUb01lc2giLCJJTlZBTElEX0dFT01FVFJZX1RZUEUiLCJvayIsImVycm9yX21zZyIsIm51bUZhY2VzIiwibnVtX2ZhY2VzIiwiYml0MzIiLCJkYXRhU2l6ZSIsIkdldFRyaWFuZ2xlc1VJbnQzMkFycmF5IiwiSEVBUFUzMiIsIkdldFRyaWFuZ2xlc1VJbnQxNkFycmF5IiwiRGVidWciLCJ3YXJuIiwibWVzaCIsImJhc2UiLCJpbmRleGVkIiwiaW5kZXhGb3JtYXQiLCJJTkRFWEZPUk1BVF9VSU5UOCIsIklOREVYRk9STUFUX1VJTlQxNiIsIklOREVYRk9STUFUX1VJTlQzMiIsImV4dFVpbnRFbGVtZW50IiwiY29uc29sZSIsImluZGV4QnVmZmVyIiwiSW5kZXhCdWZmZXIiLCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzIiwidGVtcE1hcHBpbmciLCJtYXBwaW5ncyIsIm1hcHBpbmciLCJ2YXJpYW50IiwibWF0ZXJpYWwiLCJpZCIsIlBPU0lUSU9OIiwiYWFiYiIsInRhcmdldHMiLCJkZWx0YVBvc2l0aW9ucyIsImRlbHRhUG9zaXRpb25zVHlwZSIsIk5PUk1BTCIsImRlbHRhTm9ybWFscyIsImRlbHRhTm9ybWFsc1R5cGUiLCJleHRyYXMiLCJ0YXJnZXROYW1lcyIsInRvU3RyaW5nIiwiZGVmYXVsdFdlaWdodCIsIndlaWdodHMiLCJwcmVzZXJ2ZURhdGEiLCJtb3JwaFByZXNlcnZlRGF0YSIsIk1vcnBoVGFyZ2V0IiwibW9ycGgiLCJNb3JwaCIsImV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtIiwibWFwcyIsIm1hcCIsInRleENvb3JkIiwiemVyb3MiLCJvbmVzIiwidGV4dHVyZVRyYW5zZm9ybSIsIktIUl90ZXh0dXJlX3RyYW5zZm9ybSIsInNjYWxlIiwicm90YXRpb24iLCJtYXRoIiwiUkFEX1RPX0RFRyIsInRpbGluZ1ZlYyIsIlZlYzIiLCJvZmZzZXRWZWMiLCJleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyIsImNvbG9yIiwiZGlmZnVzZUZhY3RvciIsImRpZmZ1c2UiLCJwb3ciLCJvcGFjaXR5IiwiZGlmZnVzZVRleHR1cmUiLCJkaWZmdXNlTWFwIiwiZGlmZnVzZU1hcENoYW5uZWwiLCJvcGFjaXR5TWFwIiwib3BhY2l0eU1hcENoYW5uZWwiLCJ1c2VNZXRhbG5lc3MiLCJzcGVjdWxhckZhY3RvciIsInNwZWN1bGFyIiwic2hpbmluZXNzIiwiZ2xvc3NpbmVzc0ZhY3RvciIsInNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUiLCJzcGVjdWxhckVuY29kaW5nIiwic3BlY3VsYXJNYXAiLCJnbG9zc01hcCIsInNwZWN1bGFyTWFwQ2hhbm5lbCIsImdsb3NzTWFwQ2hhbm5lbCIsImV4dGVuc2lvbkNsZWFyQ29hdCIsImNsZWFyQ29hdCIsImNsZWFyY29hdEZhY3RvciIsImNsZWFyY29hdFRleHR1cmUiLCJjbGVhckNvYXRNYXAiLCJjbGVhckNvYXRNYXBDaGFubmVsIiwiY2xlYXJDb2F0R2xvc3NpbmVzcyIsImNsZWFyY29hdFJvdWdobmVzc0ZhY3RvciIsImNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUiLCJjbGVhckNvYXRHbG9zc01hcCIsImNsZWFyQ29hdEdsb3NzTWFwQ2hhbm5lbCIsImNsZWFyY29hdE5vcm1hbFRleHR1cmUiLCJjbGVhckNvYXROb3JtYWxNYXAiLCJjbGVhckNvYXRCdW1waW5lc3MiLCJjbGVhckNvYXRHbG9zc0NodW5rIiwiY2h1bmtzIiwiY2xlYXJDb2F0R2xvc3NQUyIsImV4dGVuc2lvblVubGl0IiwidXNlTGlnaHRpbmciLCJlbWlzc2l2ZSIsImNvcHkiLCJlbWlzc2l2ZVRpbnQiLCJkaWZmdXNlVGludCIsImVtaXNzaXZlTWFwIiwiZW1pc3NpdmVNYXBVdiIsImRpZmZ1c2VNYXBVdiIsImVtaXNzaXZlTWFwVGlsaW5nIiwiZGlmZnVzZU1hcFRpbGluZyIsImVtaXNzaXZlTWFwT2Zmc2V0IiwiZGlmZnVzZU1hcE9mZnNldCIsImVtaXNzaXZlTWFwUm90YXRpb24iLCJkaWZmdXNlTWFwUm90YXRpb24iLCJlbWlzc2l2ZU1hcENoYW5uZWwiLCJlbWlzc2l2ZVZlcnRleENvbG9yIiwiZGlmZnVzZVZlcnRleENvbG9yIiwiZW1pc3NpdmVWZXJ0ZXhDb2xvckNoYW5uZWwiLCJkaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsIiwiZXh0ZW5zaW9uU3BlY3VsYXIiLCJ1c2VNZXRhbG5lc3NTcGVjdWxhckNvbG9yIiwic3BlY3VsYXJDb2xvclRleHR1cmUiLCJzcGVjdWxhckNvbG9yRmFjdG9yIiwic3BlY3VsYXJpdHlGYWN0b3IiLCJzcGVjdWxhcml0eUZhY3Rvck1hcENoYW5uZWwiLCJzcGVjdWxhcml0eUZhY3Rvck1hcCIsInNwZWN1bGFyVGV4dHVyZSIsImV4dGVuc2lvbklvciIsInJlZnJhY3Rpb25JbmRleCIsImlvciIsImV4dGVuc2lvblRyYW5zbWlzc2lvbiIsImJsZW5kVHlwZSIsIkJMRU5EX05PUk1BTCIsInVzZUR5bmFtaWNSZWZyYWN0aW9uIiwicmVmcmFjdGlvbiIsInRyYW5zbWlzc2lvbkZhY3RvciIsInJlZnJhY3Rpb25NYXBDaGFubmVsIiwicmVmcmFjdGlvbk1hcCIsInRyYW5zbWlzc2lvblRleHR1cmUiLCJleHRlbnNpb25TaGVlbiIsInVzZVNoZWVuIiwic2hlZW5Db2xvckZhY3RvciIsInNoZWVuIiwic2hlZW5NYXAiLCJzaGVlbkNvbG9yVGV4dHVyZSIsInNoZWVuRW5jb2RpbmciLCJzaGVlbkdsb3NzaW5lc3MiLCJzaGVlblJvdWdobmVzc0ZhY3RvciIsInNoZWVuR2xvc3NpbmVzc01hcCIsInNoZWVuUm91Z2huZXNzVGV4dHVyZSIsInNoZWVuR2xvc3NpbmVzc01hcENoYW5uZWwiLCJzaGVlbkdsb3NzQ2h1bmsiLCJzaGVlbkdsb3NzUFMiLCJleHRlbnNpb25Wb2x1bWUiLCJ0aGlja25lc3MiLCJ0aGlja25lc3NGYWN0b3IiLCJ0aGlja25lc3NNYXAiLCJ0aGlja25lc3NUZXh0dXJlIiwiYXR0ZW51YXRpb25EaXN0YW5jZSIsImF0dGVudWF0aW9uQ29sb3IiLCJhdHRlbnVhdGlvbiIsImV4dGVuc2lvbkVtaXNzaXZlU3RyZW5ndGgiLCJlbWlzc2l2ZUludGVuc2l0eSIsImVtaXNzaXZlU3RyZW5ndGgiLCJleHRlbnNpb25JcmlkZXNjZW5jZSIsInVzZUlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2UiLCJpcmlkZXNjZW5jZUZhY3RvciIsImlyaWRlc2NlbmNlTWFwQ2hhbm5lbCIsImlyaWRlc2NlbmNlTWFwIiwiaXJpZGVzY2VuY2VUZXh0dXJlIiwiaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXgiLCJpcmlkZXNjZW5jZUlvciIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXgiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW0iLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01hcENoYW5uZWwiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01hcCIsImlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZSIsImNyZWF0ZU1hdGVyaWFsIiwiZ2x0Zk1hdGVyaWFsIiwiZ2xvc3NDaHVuayIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJvY2NsdWRlU3BlY3VsYXIiLCJTUEVDT0NDX0FPIiwic3BlY3VsYXJUaW50Iiwic3BlY3VsYXJWZXJ0ZXhDb2xvciIsIkFQSVZlcnNpb24iLCJDSFVOS0FQSV8xXzU3IiwicGJyRGF0YSIsInBick1ldGFsbGljUm91Z2huZXNzIiwiYmFzZUNvbG9yRmFjdG9yIiwiYmFzZUNvbG9yVGV4dHVyZSIsIm1ldGFsbmVzcyIsIm1ldGFsbGljRmFjdG9yIiwicm91Z2huZXNzRmFjdG9yIiwibWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlIiwibWV0YWxuZXNzTWFwIiwibWV0YWxuZXNzTWFwQ2hhbm5lbCIsImdsb3NzUFMiLCJub3JtYWxUZXh0dXJlIiwibm9ybWFsTWFwIiwiYnVtcGluZXNzIiwib2NjbHVzaW9uVGV4dHVyZSIsImFvTWFwIiwiYW9NYXBDaGFubmVsIiwiZW1pc3NpdmVGYWN0b3IiLCJlbWlzc2l2ZVRleHR1cmUiLCJhbHBoYU1vZGUiLCJCTEVORF9OT05FIiwiYWxwaGFUZXN0IiwiYWxwaGFDdXRvZmYiLCJkZXB0aFdyaXRlIiwidHdvU2lkZWRMaWdodGluZyIsImRvdWJsZVNpZGVkIiwiY3VsbCIsIkNVTExGQUNFX05PTkUiLCJDVUxMRkFDRV9CQUNLIiwiZXh0ZW5zaW9uRnVuYyIsInVuZGVmaW5lZCIsInVwZGF0ZSIsImNyZWF0ZUFuaW1hdGlvbiIsImdsdGZBbmltYXRpb24iLCJhbmltYXRpb25JbmRleCIsImdsdGZBY2Nlc3NvcnMiLCJjcmVhdGVBbmltRGF0YSIsIkFuaW1EYXRhIiwiaW50ZXJwTWFwIiwiSU5URVJQT0xBVElPTl9TVEVQIiwiSU5URVJQT0xBVElPTl9MSU5FQVIiLCJJTlRFUlBPTEFUSU9OX0NVQklDIiwiaW5wdXRNYXAiLCJvdXRwdXRNYXAiLCJjdXJ2ZU1hcCIsIm91dHB1dENvdW50ZXIiLCJzYW1wbGVycyIsInNhbXBsZXIiLCJpbnB1dCIsIm91dHB1dCIsImludGVycG9sYXRpb24iLCJjdXJ2ZSIsInBhdGhzIiwicXVhdEFycmF5cyIsInRyYW5zZm9ybVNjaGVtYSIsImNvbnN0cnVjdE5vZGVQYXRoIiwibm9kZSIsInBhdGgiLCJ1bnNoaWZ0IiwicGFyZW50IiwicmV0cmlldmVXZWlnaHROYW1lIiwibm9kZU5hbWUiLCJ3ZWlnaHRJbmRleCIsImNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzIiwiZW50aXR5UGF0aCIsIm1vcnBoVGFyZ2V0Q291bnQiLCJrZXlmcmFtZUNvdW50IiwibW9ycGhUYXJnZXRPdXRwdXQiLCJtb3JwaEN1cnZlIiwiY29tcG9uZW50IiwicHJvcGVydHlQYXRoIiwiY2hhbm5lbHMiLCJjaGFubmVsIiwic3RhcnRzV2l0aCIsImlucHV0cyIsIm91dHB1dHMiLCJjdXJ2ZXMiLCJpbnB1dEtleSIsIm91dHB1dEtleSIsImN1cnZlS2V5IiwiY3VydmVEYXRhIiwiQW5pbUN1cnZlIiwicHJldkluZGV4IiwiZCIsImRwIiwiZHVyYXRpb24iLCJfZGF0YSIsIkFuaW1UcmFjayIsImNyZWF0ZU5vZGUiLCJnbHRmTm9kZSIsIm5vZGVJbmRleCIsImVudGl0eSIsIkdyYXBoTm9kZSIsIm1hdHJpeCIsImdldFRyYW5zbGF0aW9uIiwic2V0TG9jYWxQb3NpdGlvbiIsImdldEV1bGVyQW5nbGVzIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsImdldFNjYWxlIiwic2V0TG9jYWxTY2FsZSIsInIiLCJzZXRMb2NhbFJvdGF0aW9uIiwidCIsInRyYW5zbGF0aW9uIiwicyIsImNyZWF0ZUNhbWVyYSIsImdsdGZDYW1lcmEiLCJwcm9qZWN0aW9uIiwiUFJPSkVDVElPTl9PUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiZ2x0ZlByb3BlcnRpZXMiLCJvcnRob2dyYXBoaWMiLCJwZXJzcGVjdGl2ZSIsImNvbXBvbmVudERhdGEiLCJlbmFibGVkIiwibmVhckNsaXAiLCJ6bmVhciIsImFzcGVjdFJhdGlvTW9kZSIsIkFTUEVDVF9BVVRPIiwiemZhciIsImZhckNsaXAiLCJvcnRob0hlaWdodCIsInltYWciLCJBU1BFQ1RfTUFOVUFMIiwiYXNwZWN0UmF0aW8iLCJ4bWFnIiwiZm92IiwieWZvdiIsImNhbWVyYUVudGl0eSIsIkVudGl0eSIsImFkZENvbXBvbmVudCIsImNyZWF0ZUxpZ2h0IiwiZ2x0ZkxpZ2h0IiwibGlnaHRQcm9wcyIsIkNvbG9yIiwiV0hJVEUiLCJyYW5nZSIsImZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVEIiwiaW50ZW5zaXR5IiwiY2xhbXAiLCJpbm5lckNvbmVBbmdsZSIsInNwb3QiLCJvdXRlckNvbmVBbmdsZSIsIlBJIiwibHVtaW5hbmNlIiwiTGlnaHQiLCJnZXRMaWdodFVuaXRDb252ZXJzaW9uIiwibGlnaHRUeXBlcyIsImxpZ2h0RW50aXR5Iiwicm90YXRlTG9jYWwiLCJjcmVhdGVTa2lucyIsIk1hcCIsImNyZWF0ZU1lc2hlcyIsImNyZWF0ZU1hdGVyaWFscyIsInByZXByb2Nlc3MiLCJwcm9jZXNzIiwicG9zdHByb2Nlc3MiLCJjcmVhdGVWYXJpYW50cyIsImNyZWF0ZUFuaW1hdGlvbnMiLCJhbmltYXRpb24iLCJjcmVhdGVOb2RlcyIsInVuaXF1ZU5hbWVzIiwiY2hpbGRyZW4iLCJjaGlsZCIsImFkZENoaWxkIiwiY3JlYXRlU2NlbmVzIiwic2NlbmUiLCJzY2VuZVJvb3QiLCJuIiwiY2hpbGROb2RlIiwiY3JlYXRlQ2FtZXJhcyIsImNhbWVyYSIsImNyZWF0ZUxpZ2h0cyIsIktIUl9saWdodHNfcHVuY3R1YWwiLCJnbHRmTGlnaHRzIiwibGlnaHQiLCJsaWdodEluZGV4IiwibGlua1NraW5zIiwibWVzaEdyb3VwIiwiY3JlYXRlUmVzb3VyY2VzIiwidGV4dHVyZUFzc2V0cyIsImdsb2JhbCIsImFzc2V0IiwiZ2VuZXJhdG9yIiwidGV4dHVyZUFzc2V0IiwiUmVuZGVyIiwiYXBwbHlTYW1wbGVyIiwiZ2x0ZlNhbXBsZXIiLCJnZXRGaWx0ZXIiLCJmaWx0ZXIiLCJkZWZhdWx0VmFsdWUiLCJGSUxURVJfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVIiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiZ2V0V3JhcCIsIndyYXAiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJBRERSRVNTX01JUlJPUkVEX1JFUEVBVCIsIkFERFJFU1NfUkVQRUFUIiwibWluRmlsdGVyIiwibWFnRmlsdGVyIiwiYWRkcmVzc1UiLCJ3cmFwUyIsImFkZHJlc3NWIiwid3JhcFQiLCJnbHRmVGV4dHVyZVVuaXF1ZUlkIiwibG9hZEltYWdlQXN5bmMiLCJnbHRmSW1hZ2UiLCJ1cmxCYXNlIiwiaW1hZ2UiLCJwcm9jZXNzQXN5bmMiLCJvbkxvYWQiLCJtaW1lVHlwZUZpbGVFeHRlbnNpb25zIiwibG9hZFRleHR1cmUiLCJ1cmwiLCJtaW1lVHlwZSIsImNvbnRlbnRzIiwiZXh0ZW5zaW9uIiwiZmlsZW5hbWUiLCJvbiIsImxvYWQiLCJlcnIiLCJjcm9zc09yaWdpbiIsImxvYWRUZXh0dXJlc0FzeW5jIiwiaW1hZ2VzIiwiZ2x0ZlRleHR1cmUiLCJnbHRmSW1hZ2VzIiwiYXNzZXRzIiwicmVtYWluaW5nIiwidGV4dHVyZUluZGV4IiwiaW1hZ2VJbmRleCIsInRleHR1cmVMaXN0IiwiZ2x0ZkltYWdlSW5kZXgiLCJLSFJfdGV4dHVyZV9iYXNpc3UiLCJiaW5kIiwibG9hZEJ1ZmZlcnNBc3luYyIsImJpbmFyeUNodW5rIiwiYnVmZmVycyIsImdsdGZCdWZmZXIiLCJhcnJheUJ1ZmZlciIsImJ5dGVTdHJpbmciLCJhdG9iIiwic3BsaXQiLCJiaW5hcnlBcnJheSIsImNoYXJDb2RlQXQiLCJodHRwIiwiY2FjaGUiLCJyZXNwb25zZVR5cGUiLCJyZXRyeSIsInBhcnNlR2x0ZiIsImdsdGZDaHVuayIsImRlY29kZUJpbmFyeVV0ZjgiLCJhcnJheSIsIlRleHREZWNvZGVyIiwiZGVjb2RlIiwic3RyIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiZGVjb2RlVVJJQ29tcG9uZW50IiwiZXNjYXBlIiwiSlNPTiIsInBhcnNlIiwidmVyc2lvbiIsInBhcnNlRmxvYXQiLCJleHRlbnNpb25zUmVxdWlyZWQiLCJXYXNtTW9kdWxlIiwiZ2V0SW5zdGFuY2UiLCJpbnN0YW5jZSIsInBhcnNlR2xiIiwiZ2xiRGF0YSIsIkRhdGFWaWV3IiwiYnl0ZUxlbmd0aCIsIm1hZ2ljIiwiZ2V0VWludDMyIiwiY2h1bmtMZW5ndGgiLCJFcnJvciIsImNodW5rVHlwZSIsImNodW5rRGF0YSIsInBhcnNlQ2h1bmsiLCJ0b0xvd2VyQ2FzZSIsImVuZHNXaXRoIiwicGFyc2VCdWZmZXJWaWV3c0FzeW5jIiwiZ2x0ZkJ1ZmZlclZpZXciLCJHbGJQYXJzZXIiLCJwYXJzZUFzeW5jIiwiZXJyb3IiLCJyZXN1bHRfIiwibWF4UmV0cmllcyIsIl9kZXZpY2UiLCJfYXNzZXRzIiwiX2RlZmF1bHRNYXRlcmlhbCIsIl9nZXRVcmxXaXRob3V0UGFyYW1zIiwiZmV0Y2hBcnJheUJ1ZmZlciIsIm9yaWdpbmFsIiwiZXh0cmFjdFBhdGgiLCJHbGJDb250YWluZXJSZXNvdXJjZSIsIm9wZW4iLCJwYXRjaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE2REEsSUFBSUEsb0JBQW9CLEdBQUcsSUFBM0IsQ0FBQTs7QUFFQSxNQUFNQywyQkFBMkIsR0FBRyxNQUFNO0FBQ3RDLEVBQUEsT0FBTyxP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
