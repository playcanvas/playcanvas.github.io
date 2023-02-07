/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
import { CULLFACE_NONE, CULLFACE_BACK, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, BUFFER_STATIC, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_POINTS, SEMANTIC_NORMAL, INDEXFORMAT_UINT8, TYPE_FLOAT32, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE, TYPE_UINT32, TYPE_INT32, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, typedArrayTypesByteSize, typedArrayTypes } from '../../platform/graphics/constants.js';
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

// instance of the draco decoder
let dracoDecoderInstance = null;
const getGlobalDracoDecoderModule = () => {
  return typeof window !== 'undefined' && window.DracoDecoderModule;
};

// resources loaded from GLB file that the parser returns
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
    // render needs to dec ref meshes
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
    // int8
    case 5121:
      return 1;
    // uint8
    case 5122:
      return 2;
    // int16
    case 5123:
      return 2;
    // uint16
    case 5124:
      return 4;
    // int32
    case 5125:
      return 4;
    // uint32
    case 5126:
      return 4;
    // float32
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

// returns a function for dequantizing the data type
const getDequantizeFunc = srcType => {
  // see https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data
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

// dequantize an array of data
const dequantizeArray = function dequantizeArray(dstArray, srcArray, srcType) {
  const convFunc = getDequantizeFunc(srcType);
  const len = srcArray.length;
  for (let i = 0; i < len; ++i) {
    dstArray[i] = convFunc(srcArray[i]);
  }
  return dstArray;
};

// get accessor data, making a copy and patching in the case of a sparse accessor
const getAccessorData = function getAccessorData(gltfAccessor, bufferViews, flatten = false) {
  const numComponents = getNumComponents(gltfAccessor.type);
  const dataType = getComponentDataType(gltfAccessor.componentType);
  if (!dataType) {
    return null;
  }
  const bufferView = bufferViews[gltfAccessor.bufferView];
  let result;
  if (gltfAccessor.sparse) {
    // handle sparse data
    const sparse = gltfAccessor.sparse;

    // get indices data
    const indicesAccessor = {
      count: sparse.count,
      type: 'SCALAR'
    };
    const indices = getAccessorData(Object.assign(indicesAccessor, sparse.indices), bufferViews, true);

    // data values data
    const valuesAccessor = {
      count: sparse.count,
      type: gltfAccessor.type,
      componentType: gltfAccessor.componentType
    };
    const values = getAccessorData(Object.assign(valuesAccessor, sparse.values), bufferViews, true);

    // get base data
    if (gltfAccessor.hasOwnProperty('bufferView')) {
      const baseAccessor = {
        bufferView: gltfAccessor.bufferView,
        byteOffset: gltfAccessor.byteOffset,
        componentType: gltfAccessor.componentType,
        count: gltfAccessor.count,
        type: gltfAccessor.type
      };
      // make a copy of the base data since we'll patch the values
      result = getAccessorData(baseAccessor, bufferViews, true).slice();
    } else {
      // there is no base data, create empty 0'd out data
      result = new dataType(gltfAccessor.count * numComponents);
    }
    for (let i = 0; i < sparse.count; ++i) {
      const targetIndex = indices[i];
      for (let j = 0; j < numComponents; ++j) {
        result[targetIndex * numComponents + j] = values[i * numComponents + j];
      }
    }
  } else if (flatten && bufferView.hasOwnProperty('byteStride')) {
    // flatten stridden data
    const bytesPerElement = numComponents * dataType.BYTES_PER_ELEMENT;
    const storage = new ArrayBuffer(gltfAccessor.count * bytesPerElement);
    const tmpArray = new Uint8Array(storage);
    let dstOffset = 0;
    for (let i = 0; i < gltfAccessor.count; ++i) {
      // no need to add bufferView.byteOffset because accessor takes this into account
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

// get accessor data as (unnormalized, unquantized) Float32 data
const getAccessorDataFloat32 = function getAccessorDataFloat32(gltfAccessor, bufferViews) {
  const data = getAccessorData(gltfAccessor, bufferViews, true);
  if (data instanceof Float32Array || !gltfAccessor.normalized) {
    // if the source data is quantized (say to int16), but not normalized
    // then reading the values of the array is the same whether the values
    // are stored as float32 or int16. so probably no need to convert to
    // float32.
    return data;
  }
  const float32Data = new Float32Array(data.length);
  dequantizeArray(float32Data, data, getComponentType(gltfAccessor.componentType));
  return float32Data;
};

// returns a dequantized bounding box for the accessor
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
  // get positions
  const p = sourceDesc[SEMANTIC_POSITION];
  if (!p || p.components !== 3) {
    return;
  }
  let positions;
  if (p.size !== p.stride) {
    // extract positions which aren't tightly packed
    const srcStride = p.stride / typedArrayTypesByteSize[p.type];
    const src = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * srcStride);
    positions = new typedArrayTypes[p.type](p.count * 3);
    for (let i = 0; i < p.count; ++i) {
      positions[i * 3 + 0] = src[i * srcStride + 0];
      positions[i * 3 + 1] = src[i * srcStride + 1];
      positions[i * 3 + 2] = src[i * srcStride + 2];
    }
  } else {
    // position data is tightly packed so we can use it directly
    positions = new typedArrayTypes[p.type](p.buffer, p.offset, p.count * 3);
  }
  const numVertices = p.count;

  // generate indices if necessary
  if (!indices) {
    indices = generateIndices(numVertices);
  }

  // generate normals
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

// given a texture, clone it
// NOTE: CPU-side texture data will be shared but GPU memory will be duplicated
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
  const result = new Texture(texture.device, texture); // duplicate texture
  result._levels = shallowCopyLevels(texture); // shallow copy the levels structure
  return result;
};

// given a texture asset, clone it
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
    // ignore meshes without positions
    return null;
  }
  const numVertices = positionDesc.count;

  // generate vertexDesc elements
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

  // order vertexDesc to match the rest of the engine
  const elementOrder = [SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1];

  // sort vertex elements by engine-ideal order
  vertexDesc.sort(function (lhs, rhs) {
    const lhsOrder = elementOrder.indexOf(lhs.semantic);
    const rhsOrder = elementOrder.indexOf(rhs.semantic);
    return lhsOrder < rhsOrder ? -1 : rhsOrder < lhsOrder ? 1 : 0;
  });
  let i, j, k;
  let source, target, sourceOffset;
  const vertexFormat = new VertexFormat(device, vertexDesc);

  // check whether source data is correctly interleaved
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

  // create vertex buffer
  const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, BUFFER_STATIC);
  const vertexData = vertexBuffer.lock();
  const targetArray = new Uint32Array(vertexData);
  let sourceArray;
  if (isCorrectlyInterleaved) {
    // copy data
    sourceArray = new Uint32Array(positionDesc.buffer, positionDesc.offset, numVertices * vertexBuffer.format.size / 4);
    targetArray.set(sourceArray);
  } else {
    let targetStride, sourceStride;
    // copy data and interleave
    for (i = 0; i < vertexBuffer.format.elements.length; ++i) {
      target = vertexBuffer.format.elements[i];
      targetStride = target.stride / 4;
      source = sourceDesc[target.name];
      sourceStride = source.stride / 4;
      // ensure we don't go beyond the end of the arraybuffer when dealing with
      // interlaced vertex formats
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
  // extract list of attributes to use
  const useAttributes = {};
  const attribIds = [];
  for (const attrib in attributes) {
    if (attributes.hasOwnProperty(attrib) && gltfToEngineSemanticMap.hasOwnProperty(attrib)) {
      useAttributes[attrib] = attributes[attrib];

      // build unique id for each attribute in format: Semantic:accessorIndex
      attribIds.push(attrib + ':' + attributes[attrib]);
    }
  }

  // sort unique ids and create unique vertex buffer ID
  attribIds.sort();
  const vbKey = attribIds.join();

  // return already created vertex buffer if identical
  let vb = vertexBufferDict[vbKey];
  if (!vb) {
    // build vertex buffer format desc and source
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

    // generate normals if they're missing (this should probably be a user option)
    if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
      generateNormals(sourceDesc, indices);
    }

    // create and store it in the dictionary
    vb = createVertexBufferInternal(device, sourceDesc, flipV);
    vertexBufferDict[vbKey] = vb;
  }
  return vb;
};
const createVertexBufferDraco = function createVertexBufferDraco(device, outputGeometry, extDraco, decoder, decoderModule, indices, flipV) {
  const numPoints = outputGeometry.num_points();

  // helper function to decode data stream with id to TypedArray of appropriate type
  const extractDracoAttributeInfo = function extractDracoAttributeInfo(uniqueId, semantic) {
    const attribute = decoder.GetAttributeByUniqueId(outputGeometry, uniqueId);
    const numValues = numPoints * attribute.num_components();
    const dracoFormat = attribute.data_type();
    let ptr, values, componentSizeInBytes, storageType;

    // storage format is based on draco attribute data type
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
      // there are glb files around where 8bit colors are missing normalized flag
      normalized: semantic === SEMANTIC_COLOR && (storageType === TYPE_UINT8 || storageType === TYPE_UINT16) ? true : attribute.normalized()
    };
  };

  // build vertex buffer format desc and source
  const sourceDesc = {};
  const attributes = extDraco.attributes;
  for (const attrib in attributes) {
    if (attributes.hasOwnProperty(attrib) && gltfToEngineSemanticMap.hasOwnProperty(attrib)) {
      const semantic = gltfToEngineSemanticMap[attrib];
      const attributeInfo = extractDracoAttributeInfo(attributes[attrib], semantic);

      // store the info we'll need to copy this data into the vertex buffer
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

  // generate normals if they're missing (this should probably be a user option)
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

  // create a cache key from bone names and see if we have matching skin
  const key = boneNames.join('#');
  let skin = glbSkins.get(key);
  if (!skin) {
    // create the skin and add it to the cache
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

    // try and get draco compressed data first
    if (primitive.hasOwnProperty('extensions')) {
      const extensions = primitive.extensions;
      if (extensions.hasOwnProperty('KHR_draco_mesh_compression')) {
        // access DracoDecoderModule
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

            // indices
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

            // vertices
            vertexBuffer = createVertexBufferDraco(device, outputGeometry, extDraco, decoder, decoderModule, indices, flipV);

            // clean up
            decoderModule.destroy(outputGeometry);
            decoderModule.destroy(decoder);
            decoderModule.destroy(buffer);

            // morph streams are not compatible with draco compression, disable morphing
            canUseMorph = false;
          }
        } else {
          Debug.warn('File contains draco compressed data, but DracoDecoderModule is not configured.');
        }
      }
    }

    // if mesh was not constructed from draco data, use uncompressed
    if (!vertexBuffer) {
      indices = primitive.hasOwnProperty('indices') ? getAccessorData(accessors[primitive.indices], bufferViews, true) : null;
      vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, flipV, vertexBufferDict);
      primitiveType = getPrimitiveType(primitive);
    }
    let mesh = null;
    if (vertexBuffer) {
      // build the mesh
      mesh = new Mesh(device);
      mesh.vertexBuffer = vertexBuffer;
      mesh.primitive[0].type = primitiveType;
      mesh.primitive[0].base = 0;
      mesh.primitive[0].indexed = indices !== null;

      // index buffer
      if (indices !== null) {
        let indexFormat;
        if (indices instanceof Uint8Array) {
          indexFormat = INDEXFORMAT_UINT8;
        } else if (indices instanceof Uint16Array) {
          indexFormat = INDEXFORMAT_UINT16;
        } else {
          indexFormat = INDEXFORMAT_UINT32;
        }

        // 32bit index buffer is used but not supported
        if (indexFormat === INDEXFORMAT_UINT32 && !device.extUintElement) {
          if (vertexBuffer.numVertices > 0xFFFF) {
            console.warn('Glb file contains 32bit index buffer but these are not supported by this device - it may be rendered incorrectly.');
          }

          // convert to 16bit
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

      // morph targets
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
            // NOTE: the morph targets can't currently accept quantized normals
            options.deltaNormals = getAccessorDataFloat32(accessor, bufferViews);
            options.deltaNormalsType = TYPE_FLOAT32;
          }

          // name if specified
          if (gltfMesh.hasOwnProperty('extras') && gltfMesh.extras.hasOwnProperty('targetNames')) {
            options.name = gltfMesh.extras.targetNames[index];
          } else {
            options.name = index.toString(10);
          }

          // default weight if specified
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
    // Convert from linear space to sRGB space
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
    // Convert from linear space to sRGB space
    material.specular.set(Math.pow(color[0], 1 / 2.2), Math.pow(color[1], 1 / 2.2), Math.pow(color[2], 1 / 2.2));
  } else {
    material.specular.set(1, 1, 1);
  }
  if (data.hasOwnProperty('glossinessFactor')) {
    material.gloss = data.glossinessFactor;
  } else {
    material.gloss = 1.0;
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
    material.clearCoat = data.clearcoatFactor * 0.25; // TODO: remove temporary workaround for replicating glTF clear-coat visuals
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
    material.clearCoatGloss = data.clearcoatRoughnessFactor;
  } else {
    material.clearCoatGloss = 0;
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
  material.clearCoatGlossInvert = true;
};
const extensionUnlit = function extensionUnlit(data, material, textures) {
  material.useLighting = false;

  // copy diffuse into emissive
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

  // blank diffuse
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
    material.sheenGloss = data.sheenRoughnessFactor;
  } else {
    material.sheenGloss = 0.0;
  }
  if (data.hasOwnProperty('sheenRoughnessTexture')) {
    material.sheenGlossMap = textures[data.sheenRoughnessTexture.index];
    material.sheenGlossMapChannel = 'a';
    extractTextureTransform(data.sheenRoughnessTexture, material, ['sheenGloss']);
  }
  material.sheenGlossInvert = true;
};
const extensionVolume = function extensionVolume(data, material, textures) {
  material.blendType = BLEND_NORMAL;
  material.useDynamicRefraction = true;
  if (data.hasOwnProperty('thicknessFactor')) {
    material.thickness = data.thicknessFactor;
  }
  if (data.hasOwnProperty('thicknessTexture')) {
    material.thicknessMap = textures[data.thicknessTexture.index];
    material.thicknessMapChannel = 'g';
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
  const material = new StandardMaterial();

  // glTF doesn't define how to occlude specular
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
      // Convert from linear space to sRGB space
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
      material.gloss = pbrData.roughnessFactor;
    } else {
      material.gloss = 1;
    }
    material.glossInvert = true;
    if (pbrData.hasOwnProperty('metallicRoughnessTexture')) {
      const metallicRoughnessTexture = pbrData.metallicRoughnessTexture;
      material.metalnessMap = material.glossMap = textures[metallicRoughnessTexture.index];
      material.metalnessMapChannel = 'b';
      material.glossMapChannel = 'g';
      extractTextureTransform(metallicRoughnessTexture, material, ['gloss', 'metalness']);
    }
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
    // TODO: support 'strength'
  }

  if (gltfMaterial.hasOwnProperty('emissiveFactor')) {
    color = gltfMaterial.emissiveFactor;
    // Convert from linear space to sRGB space
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
        // note: by default don't write depth on semitransparent materials
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

  // Provide list of supported extensions and their functions
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

  // Handle extensions
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

// create the anim structure
const createAnimation = function createAnimation(gltfAnimation, animationIndex, gltfAccessors, bufferViews, nodes, meshes, gltfNodes) {
  // create animation data block for the accessor
  const createAnimData = function createAnimData(gltfAccessor) {
    return new AnimData(getNumComponents(gltfAccessor.type), getAccessorDataFloat32(gltfAccessor, bufferViews));
  };
  const interpMap = {
    'STEP': INTERPOLATION_STEP,
    'LINEAR': INTERPOLATION_LINEAR,
    'CUBICSPLINE': INTERPOLATION_CUBIC
  };

  // Input and output maps reference data by sampler input/output key.
  const inputMap = {};
  const outputMap = {};
  // The curve map stores temporary curve data by sampler index. Each curves input/output value will be resolved to an inputs/outputs array index after all samplers have been processed.
  // Curves and outputs that are deleted from their maps will not be included in the final AnimTrack
  const curveMap = {};
  let outputCounter = 1;
  let i;

  // convert samplers
  for (i = 0; i < gltfAnimation.samplers.length; ++i) {
    const sampler = gltfAnimation.samplers[i];

    // get input data
    if (!inputMap.hasOwnProperty(sampler.input)) {
      inputMap[sampler.input] = createAnimData(gltfAccessors[sampler.input]);
    }

    // get output data
    if (!outputMap.hasOwnProperty(sampler.output)) {
      outputMap[sampler.output] = createAnimData(gltfAccessors[sampler.output]);
    }
    const interpolation = sampler.hasOwnProperty('interpolation') && interpMap.hasOwnProperty(sampler.interpolation) ? interpMap[sampler.interpolation] : INTERPOLATION_LINEAR;

    // create curve
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
  const retrieveWeightName = (gltfNode, weightIndex) => {
    if (meshes && meshes[gltfNode.mesh]) {
      const mesh = meshes[gltfNode.mesh];
      if (mesh.hasOwnProperty('extras') && mesh.extras.hasOwnProperty('targetNames') && mesh.extras.targetNames[weightIndex]) {
        return `name.${mesh.extras.targetNames[weightIndex]}`;
      }
    }
    return weightIndex;
  };

  // All morph targets are included in a single channel of the animation, with all targets output data interleaved with each other.
  // This function splits each morph target out into it a curve with its own output data, allowing us to animate each morph target independently by name.
  const createMorphTargetCurves = (curve, gltfNode, entityPath) => {
    const out = outputMap[curve.output];
    if (!out) {
      Debug.warn(`glb-parser: No output data is available for the morph target curve (${entityPath}/graph/weights). Skipping.`);
      return;
    }
    const outData = out.data;
    const morphTargetCount = outData.length / inputMap[curve.input].data.length;
    const keyframeCount = outData.length / morphTargetCount;
    for (let j = 0; j < morphTargetCount; j++) {
      const morphTargetOutput = new Float32Array(keyframeCount);
      // the output data for all morph targets in a single curve is interleaved. We need to retrieve the keyframe output data for a single morph target
      for (let k = 0; k < keyframeCount; k++) {
        morphTargetOutput[k] = outData[k * morphTargetCount + j];
      }
      const output = new AnimData(1, morphTargetOutput);
      // add the individual morph target output data to the outputMap using a negative value key (so as not to clash with sampler.output values)
      outputMap[-outputCounter] = output;
      const morphCurve = {
        paths: [{
          entityPath: entityPath,
          component: 'graph',
          propertyPath: [`weight.${retrieveWeightName(gltfNode, j)}`]
        }],
        // each morph target curve input can use the same sampler.input from the channel they were all in
        input: curve.input,
        // but each morph target curve should reference its individual output that was just created
        output: -outputCounter,
        interpolation: curve.interpolation
      };
      outputCounter++;
      // add the morph target curve to the curveMap
      curveMap[`morphCurve-${i}-${j}`] = morphCurve;
    }
  };

  // convert anim channels
  for (i = 0; i < gltfAnimation.channels.length; ++i) {
    const channel = gltfAnimation.channels[i];
    const target = channel.target;
    const curve = curveMap[channel.sampler];
    const node = nodes[target.node];
    const gltfNode = gltfNodes[target.node];
    const entityPath = constructNodePath(node);
    if (target.path.startsWith('weights')) {
      createMorphTargetCurves(curve, gltfNode, entityPath);
      // as all individual morph targets in this morph curve have their own curve now, this morph curve should be flagged
      // so it's not included in the final output
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

  // Add each input in the map to the final inputs array. The inputMap should now reference the index of input in the inputs array instead of the input itself.
  for (const inputKey in inputMap) {
    inputs.push(inputMap[inputKey]);
    inputMap[inputKey] = inputs.length - 1;
  }
  // Add each output in the map to the final outputs array. The outputMap should now reference the index of output in the outputs array instead of the output itself.
  for (const outputKey in outputMap) {
    outputs.push(outputMap[outputKey]);
    outputMap[outputKey] = outputs.length - 1;
  }
  // Create an AnimCurve for each curve object in the curveMap. Each curve object's input value should be resolved to the index of the input in the
  // inputs arrays using the inputMap. Likewise for output values.
  for (const curveKey in curveMap) {
    const curveData = curveMap[curveKey];
    // if the curveData contains a morph curve then do not add it to the final curve list as the individual morph target curves are included instead
    if (curveData.morphCurve) {
      continue;
    }
    curves.push(new AnimCurve(curveData.paths, inputMap[curveData.input], outputMap[curveData.output], curveData.interpolation));

    // if this target is a set of quaternion keys, make note of its index so we can perform
    // quaternion-specific processing on it.
    if (curveData.paths.length > 0 && curveData.paths[0].propertyPath[0] === 'localRotation' && curveData.interpolation !== INTERPOLATION_CUBIC) {
      quatArrays.push(curves[curves.length - 1].output);
    }
  }

  // sort the list of array indexes so we can skip dups
  quatArrays.sort();

  // run through the quaternion data arrays flipping quaternion keys
  // that don't fall in the same winding order.
  let prevIndex = null;
  let data;
  for (i = 0; i < quatArrays.length; ++i) {
    const index = quatArrays[i];
    // skip over duplicate array indices
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

  // calculate duration of the animation as maximum time value
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

  // Parse transformation properties
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

// creates a camera component on the supplied node, and returns it
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

// creates light component, adds it to the node and returns the created light component
const createLight = function createLight(gltfLight, node) {
  const lightProps = {
    enabled: false,
    type: gltfLight.type === 'point' ? 'omni' : gltfLight.type,
    color: gltfLight.hasOwnProperty('color') ? new Color(gltfLight.color) : Color.WHITE,
    // when range is not defined, infinity should be used - but that is causing infinity in bounds calculations
    range: gltfLight.hasOwnProperty('range') ? gltfLight.range : 9999,
    falloffMode: LIGHTFALLOFF_INVERSESQUARED,
    // TODO: (engine issue #3252) Set intensity to match glTF specification, which uses physically based values:
    // - Omni and spot lights use luminous intensity in candela (lm/sr)
    // - Directional lights use illuminance in lux (lm/m2).
    // Current implementation: clapms specified intensity to 0..2 range
    intensity: gltfLight.hasOwnProperty('intensity') ? math.clamp(gltfLight.intensity, 0, 2) : 1
  };
  if (gltfLight.hasOwnProperty('spot')) {
    lightProps.innerConeAngle = gltfLight.spot.hasOwnProperty('innerConeAngle') ? gltfLight.spot.innerConeAngle * math.RAD_TO_DEG : 0;
    lightProps.outerConeAngle = gltfLight.spot.hasOwnProperty('outerConeAngle') ? gltfLight.spot.outerConeAngle * math.RAD_TO_DEG : Math.PI / 4;
  }

  // glTF stores light already in energy/area, but we need to provide the light with only the energy parameter,
  // so we need the intensities in candela back to lumen
  if (gltfLight.hasOwnProperty("intensity")) {
    lightProps.luminance = gltfLight.intensity * Light.getLightUnitConversion(lightTypes[lightProps.type], lightProps.outerConeAngle, lightProps.innerConeAngle);
  }

  // Rotate to match light orientation in glTF specification
  // Note that this adds a new entity node into the hierarchy that does not exist in the gltf hierarchy
  const lightEntity = new Entity(node.name);
  lightEntity.rotateLocal(90, 0, 0);

  // add component
  lightEntity.addComponent('light', lightProps);
  return lightEntity;
};
const createSkins = function createSkins(device, gltf, nodes, bufferViews) {
  if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
    return [];
  }

  // cache for skins to filter out duplicates
  const glbSkins = new Map();
  return gltf.skins.map(function (gltfSkin) {
    return createSkin(device, gltfSkin, gltf.accessors, bufferViews, nodes, glbSkins);
  });
};
const createMeshes = function createMeshes(device, gltf, bufferViews, callback, flipV, meshVariants, meshDefaultMaterials, options) {
  if (!gltf.hasOwnProperty('meshes') || gltf.meshes.length === 0 || !gltf.hasOwnProperty('accessors') || gltf.accessors.length === 0 || !gltf.hasOwnProperty('bufferViews') || gltf.bufferViews.length === 0) {
    return [];
  }
  if (options.skipMeshes) {
    return [];
  }

  // dictionary of vertex buffers to avoid duplicates
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
    const animation = createAnimation(gltfAnimation, index, gltf.accessors, bufferViews, nodes, gltf.meshes, gltf.nodes);
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

  // build node hierarchy
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

  // if there's a single scene with a single node in it, don't create wrapper nodes
  if (count === 1 && ((_gltf$scenes$0$nodes = gltf.scenes[0].nodes) == null ? void 0 : _gltf$scenes$0$nodes.length) === 1) {
    const nodeIndex = gltf.scenes[0].nodes[0];
    scenes.push(nodes[nodeIndex]);
  } else {
    // create root node per scene
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

          // add the camera to node->camera map
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

      // handle nodes with lights
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

            // add the light to node->light map
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

// link skins to the meshes
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

// create engine resources from the downloaded GLB data
const createResources = function createResources(device, gltf, bufferViews, textureAssets, options, callback) {
  const preprocess = options && options.global && options.global.preprocess;
  const postprocess = options && options.global && options.global.postprocess;
  if (preprocess) {
    preprocess(gltf);
  }

  // The original version of FACT generated incorrectly flipped V texture
  // coordinates. We must compensate by flipping V in this case. Once
  // all models have been re-exported we can remove this flag.
  const flipV = gltf.asset && gltf.asset.generator === 'PlayCanvas';

  // We'd like to remove the flipV code at some point.
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

  // create renders to wrap meshes
  const renders = [];
  for (let i = 0; i < meshes.length; i++) {
    renders[i] = new Render();
    renders[i].meshes = meshes[i];
  }

  // link skins to meshes
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

// load an image
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

    // construct the asset file
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

    // create and load the asset
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
        // uri specified
        if (isDataURI(gltfImage.uri)) {
          loadTexture(gltfImage.uri, null, getDataURIMimeType(gltfImage.uri), null);
        } else {
          loadTexture(path.join(urlBase, gltfImage.uri), null, null, {
            crossOrigin: 'anonymous'
          });
        }
      } else if (gltfImage.hasOwnProperty('bufferView') && gltfImage.hasOwnProperty('mimeType')) {
        // bufferview
        loadTexture(null, bufferViews[gltfImage.bufferView], gltfImage.mimeType, null);
      } else {
        // fail
        callback('Invalid image found in gltf (neither uri or bufferView found). index=' + index);
      }
    }
  });
};

// load textures using the asset system
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
  const assets = []; // one per image
  const textures = []; // list per image

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
          // image has already been loaded
          onLoad(i, gltfImageIndex);
        } else {
          // first occcurrence, load it
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

// load gltf buffers asynchronously, returning them in the callback
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
      // eslint-disable-line no-loop-func
      if (err) {
        callback(err);
      } else if (arrayBuffer) {
        onLoad(i, new Uint8Array(arrayBuffer));
      } else {
        if (gltfBuffer.hasOwnProperty('uri')) {
          if (isDataURI(gltfBuffer.uri)) {
            // convert base64 to raw binary data held in a string
            // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
            const byteString = atob(gltfBuffer.uri.split(',')[1]);

            // create a view into the buffer
            const binaryArray = new Uint8Array(byteString.length);

            // set the bytes of the buffer to the correct values
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
              // eslint-disable-line no-loop-func
              if (err) {
                callback(err);
              } else {
                onLoad(i, new Uint8Array(result));
              }
            }.bind(null, i));
          }
        } else {
          // glb buffer reference
          onLoad(i, binaryChunk);
        }
      }
    }.bind(null, i, gltfBuffer));
  }
};

// parse the gltf chunk, returns the gltf json
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

  // check gltf version
  if (gltf.asset && gltf.asset.version && parseFloat(gltf.asset.version) < 2) {
    callback(`Invalid gltf version. Expected version 2.0 or above but found version '${gltf.asset.version}'.`);
    return;
  }

  // check required extensions
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

// parse glb data, returns the gltf and binary chunk
const parseGlb = function parseGlb(glbData, callback) {
  const data = glbData instanceof ArrayBuffer ? new DataView(glbData) : new DataView(glbData.buffer, glbData.byteOffset, glbData.byteLength);

  // read header
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

  // read chunks
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

// parse the chunk of data, which can be glb or gltf
const parseChunk = function parseChunk(filename, data, callback) {
  const hasGlbHeader = () => {
    // glb format starts with 'glTF'
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

// create buffer views
const parseBufferViewsAsync = function parseBufferViewsAsync(gltf, buffers, options, callback) {
  const result = [];
  const preprocess = options && options.bufferView && options.bufferView.preprocess;
  const processAsync = options && options.bufferView && options.bufferView.processAsync || function (gltfBufferView, buffers, callback) {
    callback(null, null);
  };
  const postprocess = options && options.bufferView && options.bufferView.postprocess;
  let remaining = gltf.bufferViews ? gltf.bufferViews.length : 0;

  // handle case of no buffers
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
      // eslint-disable-line no-loop-func
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

// -- GlbParser
class GlbParser {
  // parse the gltf or glb data asynchronously, loading external resources
  static parseAsync(filename, urlBase, data, device, registry, options, callback) {
    // parse the data
    parseChunk(filename, data, function (err, chunks) {
      if (err) {
        callback(err);
        return;
      }

      // parse gltf
      parseGltf(chunks.gltfChunk, function (err, gltf) {
        if (err) {
          callback(err);
          return;
        }

        // async load external buffers
        loadBuffersAsync(gltf, chunks.binaryChunk, urlBase, options, function (err, buffers) {
          if (err) {
            callback(err);
            return;
          }

          // async load buffer views
          parseBufferViewsAsync(gltf, buffers, options, function (err, bufferViews) {
            if (err) {
              callback(err);
              return;
            }

            // async load images
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

  // parse the gltf or glb data synchronously. external resources (buffers and images) are ignored.
  static parse(filename, data, device, options) {
    let result = null;
    options = options || {};

    // parse the data
    parseChunk(filename, data, function (err, chunks) {
      if (err) {
        console.error(err);
      } else {
        // parse gltf
        parseGltf(chunks.gltfChunk, function (err, gltf) {
          if (err) {
            console.error(err);
          } else {
            // parse buffer views
            parseBufferViewsAsync(gltf, [chunks.binaryChunk], options, function (err, bufferViews) {
              if (err) {
                console.error(err);
              } else {
                // create resources
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
            // return everything
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9wYXJzZXJzL2dsYi1wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi8uLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgV2FzbU1vZHVsZSB9IGZyb20gJy4uLy4uL2NvcmUvd2FzbS1tb2R1bGUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUsXG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDVUxMRkFDRV9OT05FLCBDVUxMRkFDRV9CQUNLLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQUklNSVRJVkVfTElORUxPT1AsIFBSSU1JVElWRV9MSU5FU1RSSVAsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX1BPSU5UUywgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIFNFTUFOVElDX1RFWENPT1JEMCwgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19URVhDT09SRDIsIFNFTUFOVElDX1RFWENPT1JEMywgU0VNQU5USUNfVEVYQ09PUkQ0LCBTRU1BTlRJQ19URVhDT09SRDUsIFNFTUFOVElDX1RFWENPT1JENiwgU0VNQU5USUNfVEVYQ09PUkQ3LFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEJMRU5EX05PUk1BTCwgTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuICAgIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIEFTUEVDVF9NQU5VQUwsIEFTUEVDVF9BVVRPLCBTUEVDT0NDX0FPXG59IGZyb20gJy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IExpZ2h0LCBsaWdodFR5cGVzIH0gZnJvbSAnLi4vLi4vc2NlbmUvbGlnaHQuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNb3JwaFRhcmdldCB9IGZyb20gJy4uLy4uL3NjZW5lL21vcnBoLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBjYWxjdWxhdGVOb3JtYWxzIH0gZnJvbSAnLi4vLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBSZW5kZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9yZW5kZXIuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uLy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBJTlRFUlBPTEFUSU9OX0NVQklDLCBJTlRFUlBPTEFUSU9OX0xJTkVBUiwgSU5URVJQT0xBVElPTl9TVEVQIH0gZnJvbSAnLi4vYW5pbS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQW5pbUN1cnZlIH0gZnJvbSAnLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBBbmltRGF0YSB9IGZyb20gJy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyc7XG5pbXBvcnQgeyBBbmltVHJhY2sgfSBmcm9tICcuLi9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vYXNzZXQvYXNzZXQuanMnO1xuaW1wb3J0IHsgR2xiQ29udGFpbmVyUmVzb3VyY2UgfSBmcm9tICcuL2dsYi1jb250YWluZXItcmVzb3VyY2UuanMnO1xuXG4vLyBpbnN0YW5jZSBvZiB0aGUgZHJhY28gZGVjb2RlclxubGV0IGRyYWNvRGVjb2Rlckluc3RhbmNlID0gbnVsbDtcblxuY29uc3QgZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlID0gKCkgPT4ge1xuICAgIHJldHVybiB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuRHJhY29EZWNvZGVyTW9kdWxlO1xufTtcblxuLy8gcmVzb3VyY2VzIGxvYWRlZCBmcm9tIEdMQiBmaWxlIHRoYXQgdGhlIHBhcnNlciByZXR1cm5zXG5jbGFzcyBHbGJSZXNvdXJjZXMge1xuICAgIGNvbnN0cnVjdG9yKGdsdGYpIHtcbiAgICAgICAgdGhpcy5nbHRmID0gZ2x0ZjtcbiAgICAgICAgdGhpcy5ub2RlcyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2NlbmVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5hbmltYXRpb25zID0gbnVsbDtcbiAgICAgICAgdGhpcy50ZXh0dXJlcyA9IG51bGw7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy52YXJpYW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaFZhcmlhbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5tZXNoRGVmYXVsdE1hdGVyaWFscyA9IG51bGw7XG4gICAgICAgIHRoaXMucmVuZGVycyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2tpbnMgPSBudWxsO1xuICAgICAgICB0aGlzLmxpZ2h0cyA9IG51bGw7XG4gICAgICAgIHRoaXMuY2FtZXJhcyA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gcmVuZGVyIG5lZWRzIHRvIGRlYyByZWYgbWVzaGVzXG4gICAgICAgIGlmICh0aGlzLnJlbmRlcnMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVycy5mb3JFYWNoKChyZW5kZXIpID0+IHtcbiAgICAgICAgICAgICAgICByZW5kZXIubWVzaGVzID0gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBpc0RhdGFVUkkgPSBmdW5jdGlvbiAodXJpKSB7XG4gICAgcmV0dXJuIC9eZGF0YTouKiwuKiQvaS50ZXN0KHVyaSk7XG59O1xuXG5jb25zdCBnZXREYXRhVVJJTWltZVR5cGUgPSBmdW5jdGlvbiAodXJpKSB7XG4gICAgcmV0dXJuIHVyaS5zdWJzdHJpbmcodXJpLmluZGV4T2YoJzonKSArIDEsIHVyaS5pbmRleE9mKCc7JykpO1xufTtcblxuY29uc3QgZ2V0TnVtQ29tcG9uZW50cyA9IGZ1bmN0aW9uIChhY2Nlc3NvclR5cGUpIHtcbiAgICBzd2l0Y2ggKGFjY2Vzc29yVHlwZSkge1xuICAgICAgICBjYXNlICdTQ0FMQVInOiByZXR1cm4gMTtcbiAgICAgICAgY2FzZSAnVkVDMic6IHJldHVybiAyO1xuICAgICAgICBjYXNlICdWRUMzJzogcmV0dXJuIDM7XG4gICAgICAgIGNhc2UgJ1ZFQzQnOiByZXR1cm4gNDtcbiAgICAgICAgY2FzZSAnTUFUMic6IHJldHVybiA0O1xuICAgICAgICBjYXNlICdNQVQzJzogcmV0dXJuIDk7XG4gICAgICAgIGNhc2UgJ01BVDQnOiByZXR1cm4gMTY7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAzO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudFR5cGUgPSBmdW5jdGlvbiAoY29tcG9uZW50VHlwZSkge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiBUWVBFX0lOVDg7XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIFRZUEVfVUlOVDg7XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIFRZUEVfSU5UMTY7XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIFRZUEVfVUlOVDE2O1xuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiBUWVBFX0lOVDMyO1xuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiBUWVBFX1VJTlQzMjtcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gVFlQRV9GTE9BVDMyO1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gMDtcbiAgICB9XG59O1xuXG5jb25zdCBnZXRDb21wb25lbnRTaXplSW5CeXRlcyA9IGZ1bmN0aW9uIChjb21wb25lbnRUeXBlKSB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIDE7ICAgIC8vIGludDhcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gMTsgICAgLy8gdWludDhcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gMjsgICAgLy8gaW50MTZcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gMjsgICAgLy8gdWludDE2XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIDQ7ICAgIC8vIGludDMyXG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIDQ7ICAgIC8vIHVpbnQzMlxuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiA0OyAgICAvLyBmbG9hdDMyXG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAwO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudERhdGFUeXBlID0gZnVuY3Rpb24gKGNvbXBvbmVudFR5cGUpIHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gSW50OEFycmF5O1xuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiBVaW50OEFycmF5O1xuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiBJbnQxNkFycmF5O1xuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiBVaW50MTZBcnJheTtcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gSW50MzJBcnJheTtcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gVWludDMyQXJyYXk7XG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIEZsb2F0MzJBcnJheTtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxuY29uc3QgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAgPSB7XG4gICAgJ1BPU0lUSU9OJzogU0VNQU5USUNfUE9TSVRJT04sXG4gICAgJ05PUk1BTCc6IFNFTUFOVElDX05PUk1BTCxcbiAgICAnVEFOR0VOVCc6IFNFTUFOVElDX1RBTkdFTlQsXG4gICAgJ0NPTE9SXzAnOiBTRU1BTlRJQ19DT0xPUixcbiAgICAnSk9JTlRTXzAnOiBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgJ1dFSUdIVFNfMCc6IFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgICdURVhDT09SRF8wJzogU0VNQU5USUNfVEVYQ09PUkQwLFxuICAgICdURVhDT09SRF8xJzogU0VNQU5USUNfVEVYQ09PUkQxLFxuICAgICdURVhDT09SRF8yJzogU0VNQU5USUNfVEVYQ09PUkQyLFxuICAgICdURVhDT09SRF8zJzogU0VNQU5USUNfVEVYQ09PUkQzLFxuICAgICdURVhDT09SRF80JzogU0VNQU5USUNfVEVYQ09PUkQ0LFxuICAgICdURVhDT09SRF81JzogU0VNQU5USUNfVEVYQ09PUkQ1LFxuICAgICdURVhDT09SRF82JzogU0VNQU5USUNfVEVYQ09PUkQ2LFxuICAgICdURVhDT09SRF83JzogU0VNQU5USUNfVEVYQ09PUkQ3XG59O1xuXG4vLyByZXR1cm5zIGEgZnVuY3Rpb24gZm9yIGRlcXVhbnRpemluZyB0aGUgZGF0YSB0eXBlXG5jb25zdCBnZXREZXF1YW50aXplRnVuYyA9IChzcmNUeXBlKSA9PiB7XG4gICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9LaHJvbm9zR3JvdXAvZ2xURi90cmVlL21hc3Rlci9leHRlbnNpb25zLzIuMC9LaHJvbm9zL0tIUl9tZXNoX3F1YW50aXphdGlvbiNlbmNvZGluZy1xdWFudGl6ZWQtZGF0YVxuICAgIHN3aXRjaCAoc3JjVHlwZSkge1xuICAgICAgICBjYXNlIFRZUEVfSU5UODogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDEyNy4wLCAtMS4wKTtcbiAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OiByZXR1cm4geCA9PiB4IC8gMjU1LjA7XG4gICAgICAgIGNhc2UgVFlQRV9JTlQxNjogcmV0dXJuIHggPT4gTWF0aC5tYXgoeCAvIDMyNzY3LjAsIC0xLjApO1xuICAgICAgICBjYXNlIFRZUEVfVUlOVDE2OiByZXR1cm4geCA9PiB4IC8gNjU1MzUuMDtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIHggPT4geDtcbiAgICB9XG59O1xuXG4vLyBkZXF1YW50aXplIGFuIGFycmF5IG9mIGRhdGFcbmNvbnN0IGRlcXVhbnRpemVBcnJheSA9IGZ1bmN0aW9uIChkc3RBcnJheSwgc3JjQXJyYXksIHNyY1R5cGUpIHtcbiAgICBjb25zdCBjb252RnVuYyA9IGdldERlcXVhbnRpemVGdW5jKHNyY1R5cGUpO1xuICAgIGNvbnN0IGxlbiA9IHNyY0FycmF5Lmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgIGRzdEFycmF5W2ldID0gY29udkZ1bmMoc3JjQXJyYXlbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gZHN0QXJyYXk7XG59O1xuXG4vLyBnZXQgYWNjZXNzb3IgZGF0YSwgbWFraW5nIGEgY29weSBhbmQgcGF0Y2hpbmcgaW4gdGhlIGNhc2Ugb2YgYSBzcGFyc2UgYWNjZXNzb3JcbmNvbnN0IGdldEFjY2Vzc29yRGF0YSA9IGZ1bmN0aW9uIChnbHRmQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCBmbGF0dGVuID0gZmFsc2UpIHtcbiAgICBjb25zdCBudW1Db21wb25lbnRzID0gZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSk7XG4gICAgY29uc3QgZGF0YVR5cGUgPSBnZXRDb21wb25lbnREYXRhVHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgaWYgKCFkYXRhVHlwZSkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBidWZmZXJWaWV3ID0gYnVmZmVyVmlld3NbZ2x0ZkFjY2Vzc29yLmJ1ZmZlclZpZXddO1xuICAgIGxldCByZXN1bHQ7XG5cbiAgICBpZiAoZ2x0ZkFjY2Vzc29yLnNwYXJzZSkge1xuICAgICAgICAvLyBoYW5kbGUgc3BhcnNlIGRhdGFcbiAgICAgICAgY29uc3Qgc3BhcnNlID0gZ2x0ZkFjY2Vzc29yLnNwYXJzZTtcblxuICAgICAgICAvLyBnZXQgaW5kaWNlcyBkYXRhXG4gICAgICAgIGNvbnN0IGluZGljZXNBY2Nlc3NvciA9IHtcbiAgICAgICAgICAgIGNvdW50OiBzcGFyc2UuY291bnQsXG4gICAgICAgICAgICB0eXBlOiAnU0NBTEFSJ1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBpbmRpY2VzID0gZ2V0QWNjZXNzb3JEYXRhKE9iamVjdC5hc3NpZ24oaW5kaWNlc0FjY2Vzc29yLCBzcGFyc2UuaW5kaWNlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBkYXRhIHZhbHVlcyBkYXRhXG4gICAgICAgIGNvbnN0IHZhbHVlc0FjY2Vzc29yID0ge1xuICAgICAgICAgICAgY291bnQ6IHNwYXJzZS5jb3VudCxcbiAgICAgICAgICAgIHR5cGU6IGdsdGZBY2Nlc3Nvci50eXBlLFxuICAgICAgICAgICAgY29tcG9uZW50VHlwZTogZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGVcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgdmFsdWVzID0gZ2V0QWNjZXNzb3JEYXRhKE9iamVjdC5hc3NpZ24odmFsdWVzQWNjZXNzb3IsIHNwYXJzZS52YWx1ZXMpLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG5cbiAgICAgICAgLy8gZ2V0IGJhc2UgZGF0YVxuICAgICAgICBpZiAoZ2x0ZkFjY2Vzc29yLmhhc093blByb3BlcnR5KCdidWZmZXJWaWV3JykpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2VBY2Nlc3NvciA9IHtcbiAgICAgICAgICAgICAgICBidWZmZXJWaWV3OiBnbHRmQWNjZXNzb3IuYnVmZmVyVmlldyxcbiAgICAgICAgICAgICAgICBieXRlT2Zmc2V0OiBnbHRmQWNjZXNzb3IuYnl0ZU9mZnNldCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlOiBnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgICAgICBjb3VudDogZ2x0ZkFjY2Vzc29yLmNvdW50LFxuICAgICAgICAgICAgICAgIHR5cGU6IGdsdGZBY2Nlc3Nvci50eXBlXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgLy8gbWFrZSBhIGNvcHkgb2YgdGhlIGJhc2UgZGF0YSBzaW5jZSB3ZSdsbCBwYXRjaCB0aGUgdmFsdWVzXG4gICAgICAgICAgICByZXN1bHQgPSBnZXRBY2Nlc3NvckRhdGEoYmFzZUFjY2Vzc29yLCBidWZmZXJWaWV3cywgdHJ1ZSkuc2xpY2UoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRoZXJlIGlzIG5vIGJhc2UgZGF0YSwgY3JlYXRlIGVtcHR5IDAnZCBvdXQgZGF0YVxuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzcGFyc2UuY291bnQ7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0SW5kZXggPSBpbmRpY2VzW2ldO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1Db21wb25lbnRzOyArK2opIHtcbiAgICAgICAgICAgICAgICByZXN1bHRbdGFyZ2V0SW5kZXggKiBudW1Db21wb25lbnRzICsgal0gPSB2YWx1ZXNbaSAqIG51bUNvbXBvbmVudHMgKyBqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZmxhdHRlbiAmJiBidWZmZXJWaWV3Lmhhc093blByb3BlcnR5KCdieXRlU3RyaWRlJykpIHtcbiAgICAgICAgLy8gZmxhdHRlbiBzdHJpZGRlbiBkYXRhXG4gICAgICAgIGNvbnN0IGJ5dGVzUGVyRWxlbWVudCA9IG51bUNvbXBvbmVudHMgKiBkYXRhVHlwZS5CWVRFU19QRVJfRUxFTUVOVDtcbiAgICAgICAgY29uc3Qgc3RvcmFnZSA9IG5ldyBBcnJheUJ1ZmZlcihnbHRmQWNjZXNzb3IuY291bnQgKiBieXRlc1BlckVsZW1lbnQpO1xuICAgICAgICBjb25zdCB0bXBBcnJheSA9IG5ldyBVaW50OEFycmF5KHN0b3JhZ2UpO1xuXG4gICAgICAgIGxldCBkc3RPZmZzZXQgPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGZBY2Nlc3Nvci5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICAvLyBubyBuZWVkIHRvIGFkZCBidWZmZXJWaWV3LmJ5dGVPZmZzZXQgYmVjYXVzZSBhY2Nlc3NvciB0YWtlcyB0aGlzIGludG8gYWNjb3VudFxuICAgICAgICAgICAgbGV0IHNyY09mZnNldCA9IChnbHRmQWNjZXNzb3IuYnl0ZU9mZnNldCB8fCAwKSArIGkgKiBidWZmZXJWaWV3LmJ5dGVTdHJpZGU7XG4gICAgICAgICAgICBmb3IgKGxldCBiID0gMDsgYiA8IGJ5dGVzUGVyRWxlbWVudDsgKytiKSB7XG4gICAgICAgICAgICAgICAgdG1wQXJyYXlbZHN0T2Zmc2V0KytdID0gYnVmZmVyVmlld1tzcmNPZmZzZXQrK107XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoc3RvcmFnZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGJ1ZmZlclZpZXcuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyVmlldy5ieXRlT2Zmc2V0ICsgKGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0IHx8IDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZkFjY2Vzc29yLmNvdW50ICogbnVtQ29tcG9uZW50cyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdldCBhY2Nlc3NvciBkYXRhIGFzICh1bm5vcm1hbGl6ZWQsIHVucXVhbnRpemVkKSBGbG9hdDMyIGRhdGFcbmNvbnN0IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIgPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykge1xuICAgIGNvbnN0IGRhdGEgPSBnZXRBY2Nlc3NvckRhdGEoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgaWYgKGRhdGEgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgfHwgIWdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIC8vIGlmIHRoZSBzb3VyY2UgZGF0YSBpcyBxdWFudGl6ZWQgKHNheSB0byBpbnQxNiksIGJ1dCBub3Qgbm9ybWFsaXplZFxuICAgICAgICAvLyB0aGVuIHJlYWRpbmcgdGhlIHZhbHVlcyBvZiB0aGUgYXJyYXkgaXMgdGhlIHNhbWUgd2hldGhlciB0aGUgdmFsdWVzXG4gICAgICAgIC8vIGFyZSBzdG9yZWQgYXMgZmxvYXQzMiBvciBpbnQxNi4gc28gcHJvYmFibHkgbm8gbmVlZCB0byBjb252ZXJ0IHRvXG4gICAgICAgIC8vIGZsb2F0MzIuXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIGNvbnN0IGZsb2F0MzJEYXRhID0gbmV3IEZsb2F0MzJBcnJheShkYXRhLmxlbmd0aCk7XG4gICAgZGVxdWFudGl6ZUFycmF5KGZsb2F0MzJEYXRhLCBkYXRhLCBnZXRDb21wb25lbnRUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKSk7XG4gICAgcmV0dXJuIGZsb2F0MzJEYXRhO1xufTtcblxuLy8gcmV0dXJucyBhIGRlcXVhbnRpemVkIGJvdW5kaW5nIGJveCBmb3IgdGhlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckJvdW5kaW5nQm94ID0gZnVuY3Rpb24gKGdsdGZBY2Nlc3Nvcikge1xuICAgIGxldCBtaW4gPSBnbHRmQWNjZXNzb3IubWluO1xuICAgIGxldCBtYXggPSBnbHRmQWNjZXNzb3IubWF4O1xuICAgIGlmICghbWluIHx8ICFtYXgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIGNvbnN0IGN0eXBlID0gZ2V0Q29tcG9uZW50VHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgICAgIG1pbiA9IGRlcXVhbnRpemVBcnJheShbXSwgbWluLCBjdHlwZSk7XG4gICAgICAgIG1heCA9IGRlcXVhbnRpemVBcnJheShbXSwgbWF4LCBjdHlwZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCb3VuZGluZ0JveChcbiAgICAgICAgbmV3IFZlYzMoKG1heFswXSArIG1pblswXSkgKiAwLjUsIChtYXhbMV0gKyBtaW5bMV0pICogMC41LCAobWF4WzJdICsgbWluWzJdKSAqIDAuNSksXG4gICAgICAgIG5ldyBWZWMzKChtYXhbMF0gLSBtaW5bMF0pICogMC41LCAobWF4WzFdIC0gbWluWzFdKSAqIDAuNSwgKG1heFsyXSAtIG1pblsyXSkgKiAwLjUpXG4gICAgKTtcbn07XG5cbmNvbnN0IGdldFByaW1pdGl2ZVR5cGUgPSBmdW5jdGlvbiAocHJpbWl0aXZlKSB7XG4gICAgaWYgKCFwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ21vZGUnKSkge1xuICAgICAgICByZXR1cm4gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHByaW1pdGl2ZS5tb2RlKSB7XG4gICAgICAgIGNhc2UgMDogcmV0dXJuIFBSSU1JVElWRV9QT0lOVFM7XG4gICAgICAgIGNhc2UgMTogcmV0dXJuIFBSSU1JVElWRV9MSU5FUztcbiAgICAgICAgY2FzZSAyOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVMT09QO1xuICAgICAgICBjYXNlIDM6IHJldHVybiBQUklNSVRJVkVfTElORVNUUklQO1xuICAgICAgICBjYXNlIDQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgICAgICBjYXNlIDU6IHJldHVybiBQUklNSVRJVkVfVFJJU1RSSVA7XG4gICAgICAgIGNhc2UgNjogcmV0dXJuIFBSSU1JVElWRV9UUklGQU47XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgIH1cbn07XG5cbmNvbnN0IGdlbmVyYXRlSW5kaWNlcyA9IGZ1bmN0aW9uIChudW1WZXJ0aWNlcykge1xuICAgIGNvbnN0IGR1bW15SW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShudW1WZXJ0aWNlcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1WZXJ0aWNlczsgaSsrKSB7XG4gICAgICAgIGR1bW15SW5kaWNlc1tpXSA9IGk7XG4gICAgfVxuICAgIHJldHVybiBkdW1teUluZGljZXM7XG59O1xuXG5jb25zdCBnZW5lcmF0ZU5vcm1hbHMgPSBmdW5jdGlvbiAoc291cmNlRGVzYywgaW5kaWNlcykge1xuICAgIC8vIGdldCBwb3NpdGlvbnNcbiAgICBjb25zdCBwID0gc291cmNlRGVzY1tTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgaWYgKCFwIHx8IHAuY29tcG9uZW50cyAhPT0gMykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHBvc2l0aW9ucztcbiAgICBpZiAocC5zaXplICE9PSBwLnN0cmlkZSkge1xuICAgICAgICAvLyBleHRyYWN0IHBvc2l0aW9ucyB3aGljaCBhcmVuJ3QgdGlnaHRseSBwYWNrZWRcbiAgICAgICAgY29uc3Qgc3JjU3RyaWRlID0gcC5zdHJpZGUgLyB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVtwLnR5cGVdO1xuICAgICAgICBjb25zdCBzcmMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogc3JjU3RyaWRlKTtcbiAgICAgICAgcG9zaXRpb25zID0gbmV3IHR5cGVkQXJyYXlUeXBlc1twLnR5cGVdKHAuY291bnQgKiAzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDBdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAwXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDFdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAxXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDJdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAyXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBvc2l0aW9uIGRhdGEgaXMgdGlnaHRseSBwYWNrZWQgc28gd2UgY2FuIHVzZSBpdCBkaXJlY3RseVxuICAgICAgICBwb3NpdGlvbnMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogMyk7XG4gICAgfVxuXG4gICAgY29uc3QgbnVtVmVydGljZXMgPSBwLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgaW5kaWNlcyBpZiBuZWNlc3NhcnlcbiAgICBpZiAoIWluZGljZXMpIHtcbiAgICAgICAgaW5kaWNlcyA9IGdlbmVyYXRlSW5kaWNlcyhudW1WZXJ0aWNlcyk7XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFsc1xuICAgIGNvbnN0IG5vcm1hbHNUZW1wID0gY2FsY3VsYXRlTm9ybWFscyhwb3NpdGlvbnMsIGluZGljZXMpO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KG5vcm1hbHNUZW1wLmxlbmd0aCk7XG4gICAgbm9ybWFscy5zZXQobm9ybWFsc1RlbXApO1xuXG4gICAgc291cmNlRGVzY1tTRU1BTlRJQ19OT1JNQUxdID0ge1xuICAgICAgICBidWZmZXI6IG5vcm1hbHMuYnVmZmVyLFxuICAgICAgICBzaXplOiAxMixcbiAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICBzdHJpZGU6IDEyLFxuICAgICAgICBjb3VudDogbnVtVmVydGljZXMsXG4gICAgICAgIGNvbXBvbmVudHM6IDMsXG4gICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgIH07XG59O1xuXG5jb25zdCBmbGlwVGV4Q29vcmRWcyA9IGZ1bmN0aW9uICh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICBsZXQgaSwgajtcblxuICAgIGNvbnN0IGZsb2F0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IHNob3J0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IGJ5dGVPZmZzZXRzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIGlmIChlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMCB8fFxuICAgICAgICAgICAgZWxlbWVudC5uYW1lID09PSBTRU1BTlRJQ19URVhDT09SRDEpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoZWxlbWVudC5kYXRhVHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9GTE9BVDMyOlxuICAgICAgICAgICAgICAgICAgICBmbG9hdE9mZnNldHMucHVzaCh7IG9mZnNldDogZWxlbWVudC5vZmZzZXQgLyA0ICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSAvIDQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMTY6XG4gICAgICAgICAgICAgICAgICAgIHNob3J0T2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCAvIDIgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIC8gMiB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OlxuICAgICAgICAgICAgICAgICAgICBieXRlT2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZmxpcCA9IGZ1bmN0aW9uIChvZmZzZXRzLCB0eXBlLCBvbmUpIHtcbiAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyB0eXBlKHZlcnRleEJ1ZmZlci5zdG9yYWdlKTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG9mZnNldHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IG9mZnNldHNbaV0ub2Zmc2V0O1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gb2Zmc2V0c1tpXS5zdHJpZGU7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgdmVydGV4QnVmZmVyLm51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICB0eXBlZEFycmF5W2luZGV4XSA9IG9uZSAtIHR5cGVkQXJyYXlbaW5kZXhdO1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IHN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoZmxvYXRPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChmbG9hdE9mZnNldHMsIEZsb2F0MzJBcnJheSwgMS4wKTtcbiAgICB9XG4gICAgaWYgKHNob3J0T2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoc2hvcnRPZmZzZXRzLCBVaW50MTZBcnJheSwgNjU1MzUpO1xuICAgIH1cbiAgICBpZiAoYnl0ZU9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKGJ5dGVPZmZzZXRzLCBVaW50OEFycmF5LCAyNTUpO1xuICAgIH1cbn07XG5cbi8vIGdpdmVuIGEgdGV4dHVyZSwgY2xvbmUgaXRcbi8vIE5PVEU6IENQVS1zaWRlIHRleHR1cmUgZGF0YSB3aWxsIGJlIHNoYXJlZCBidXQgR1BVIG1lbW9yeSB3aWxsIGJlIGR1cGxpY2F0ZWRcbmNvbnN0IGNsb25lVGV4dHVyZSA9IGZ1bmN0aW9uICh0ZXh0dXJlKSB7XG4gICAgY29uc3Qgc2hhbGxvd0NvcHlMZXZlbHMgPSBmdW5jdGlvbiAodGV4dHVyZSkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgbWlwID0gMDsgbWlwIDwgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aDsgKyttaXApIHtcbiAgICAgICAgICAgIGxldCBsZXZlbCA9IFtdO1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgKytmYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsLnB1c2godGV4dHVyZS5fbGV2ZWxzW21pcF1bZmFjZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwgPSB0ZXh0dXJlLl9sZXZlbHNbbWlwXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgVGV4dHVyZSh0ZXh0dXJlLmRldmljZSwgdGV4dHVyZSk7ICAgLy8gZHVwbGljYXRlIHRleHR1cmVcbiAgICByZXN1bHQuX2xldmVscyA9IHNoYWxsb3dDb3B5TGV2ZWxzKHRleHR1cmUpOyAgICAgICAgICAgIC8vIHNoYWxsb3cgY29weSB0aGUgbGV2ZWxzIHN0cnVjdHVyZVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnaXZlbiBhIHRleHR1cmUgYXNzZXQsIGNsb25lIGl0XG5jb25zdCBjbG9uZVRleHR1cmVBc3NldCA9IGZ1bmN0aW9uIChzcmMpIHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgQXNzZXQoc3JjLm5hbWUgKyAnX2Nsb25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5maWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMuZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLm9wdGlvbnMpO1xuICAgIHJlc3VsdC5sb2FkZWQgPSB0cnVlO1xuICAgIHJlc3VsdC5yZXNvdXJjZSA9IGNsb25lVGV4dHVyZShzcmMucmVzb3VyY2UpO1xuICAgIHNyYy5yZWdpc3RyeS5hZGQocmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwgPSBmdW5jdGlvbiAoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVikge1xuICAgIGNvbnN0IHBvc2l0aW9uRGVzYyA9IHNvdXJjZURlc2NbU0VNQU5USUNfUE9TSVRJT05dO1xuICAgIGlmICghcG9zaXRpb25EZXNjKSB7XG4gICAgICAgIC8vIGlnbm9yZSBtZXNoZXMgd2l0aG91dCBwb3NpdGlvbnNcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IG51bVZlcnRpY2VzID0gcG9zaXRpb25EZXNjLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgdmVydGV4RGVzYyBlbGVtZW50c1xuICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHNlbWFudGljIGluIHNvdXJjZURlc2MpIHtcbiAgICAgICAgaWYgKHNvdXJjZURlc2MuaGFzT3duUHJvcGVydHkoc2VtYW50aWMpKSB7XG4gICAgICAgICAgICB2ZXJ0ZXhEZXNjLnB1c2goe1xuICAgICAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBzb3VyY2VEZXNjW3NlbWFudGljXS5jb21wb25lbnRzLFxuICAgICAgICAgICAgICAgIHR5cGU6IHNvdXJjZURlc2Nbc2VtYW50aWNdLnR5cGUsXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiAhIXNvdXJjZURlc2Nbc2VtYW50aWNdLm5vcm1hbGl6ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBvcmRlciB2ZXJ0ZXhEZXNjIHRvIG1hdGNoIHRoZSByZXN0IG9mIHRoZSBlbmdpbmVcbiAgICBjb25zdCBlbGVtZW50T3JkZXIgPSBbXG4gICAgICAgIFNFTUFOVElDX1BPU0lUSU9OLFxuICAgICAgICBTRU1BTlRJQ19OT1JNQUwsXG4gICAgICAgIFNFTUFOVElDX1RBTkdFTlQsXG4gICAgICAgIFNFTUFOVElDX0NPTE9SLFxuICAgICAgICBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgICAgIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgICAgICBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgICAgIFNFTUFOVElDX1RFWENPT1JEMVxuICAgIF07XG5cbiAgICAvLyBzb3J0IHZlcnRleCBlbGVtZW50cyBieSBlbmdpbmUtaWRlYWwgb3JkZXJcbiAgICB2ZXJ0ZXhEZXNjLnNvcnQoZnVuY3Rpb24gKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IGxoc09yZGVyID0gZWxlbWVudE9yZGVyLmluZGV4T2YobGhzLnNlbWFudGljKTtcbiAgICAgICAgY29uc3QgcmhzT3JkZXIgPSBlbGVtZW50T3JkZXIuaW5kZXhPZihyaHMuc2VtYW50aWMpO1xuICAgICAgICByZXR1cm4gKGxoc09yZGVyIDwgcmhzT3JkZXIpID8gLTEgOiAocmhzT3JkZXIgPCBsaHNPcmRlciA/IDEgOiAwKTtcbiAgICB9KTtcblxuICAgIGxldCBpLCBqLCBrO1xuICAgIGxldCBzb3VyY2UsIHRhcmdldCwgc291cmNlT2Zmc2V0O1xuXG4gICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdChkZXZpY2UsIHZlcnRleERlc2MpO1xuXG4gICAgLy8gY2hlY2sgd2hldGhlciBzb3VyY2UgZGF0YSBpcyBjb3JyZWN0bHkgaW50ZXJsZWF2ZWRcbiAgICBsZXQgaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCA9IHRydWU7XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB0YXJnZXQgPSB2ZXJ0ZXhGb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIHNvdXJjZSA9IHNvdXJjZURlc2NbdGFyZ2V0Lm5hbWVdO1xuICAgICAgICBzb3VyY2VPZmZzZXQgPSBzb3VyY2Uub2Zmc2V0IC0gcG9zaXRpb25EZXNjLm9mZnNldDtcbiAgICAgICAgaWYgKChzb3VyY2UuYnVmZmVyICE9PSBwb3NpdGlvbkRlc2MuYnVmZmVyKSB8fFxuICAgICAgICAgICAgKHNvdXJjZS5zdHJpZGUgIT09IHRhcmdldC5zdHJpZGUpIHx8XG4gICAgICAgICAgICAoc291cmNlLnNpemUgIT09IHRhcmdldC5zaXplKSB8fFxuICAgICAgICAgICAgKHNvdXJjZU9mZnNldCAhPT0gdGFyZ2V0Lm9mZnNldCkpIHtcbiAgICAgICAgICAgIGlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlIHZlcnRleCBidWZmZXJcbiAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKGRldmljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnRleEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bVZlcnRpY2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQlVGRkVSX1NUQVRJQyk7XG5cbiAgICBjb25zdCB2ZXJ0ZXhEYXRhID0gdmVydGV4QnVmZmVyLmxvY2soKTtcbiAgICBjb25zdCB0YXJnZXRBcnJheSA9IG5ldyBVaW50MzJBcnJheSh2ZXJ0ZXhEYXRhKTtcbiAgICBsZXQgc291cmNlQXJyYXk7XG5cbiAgICBpZiAoaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCkge1xuICAgICAgICAvLyBjb3B5IGRhdGFcbiAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkocG9zaXRpb25EZXNjLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25EZXNjLm9mZnNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmVydGljZXMgKiB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnNpemUgLyA0KTtcbiAgICAgICAgdGFyZ2V0QXJyYXkuc2V0KHNvdXJjZUFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgdGFyZ2V0U3RyaWRlLCBzb3VyY2VTdHJpZGU7XG4gICAgICAgIC8vIGNvcHkgZGF0YSBhbmQgaW50ZXJsZWF2ZVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgICAgIHRhcmdldFN0cmlkZSA9IHRhcmdldC5zdHJpZGUgLyA0O1xuXG4gICAgICAgICAgICBzb3VyY2UgPSBzb3VyY2VEZXNjW3RhcmdldC5uYW1lXTtcbiAgICAgICAgICAgIHNvdXJjZVN0cmlkZSA9IHNvdXJjZS5zdHJpZGUgLyA0O1xuICAgICAgICAgICAgLy8gZW5zdXJlIHdlIGRvbid0IGdvIGJleW9uZCB0aGUgZW5kIG9mIHRoZSBhcnJheWJ1ZmZlciB3aGVuIGRlYWxpbmcgd2l0aFxuICAgICAgICAgICAgLy8gaW50ZXJsYWNlZCB2ZXJ0ZXggZm9ybWF0c1xuICAgICAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkoc291cmNlLmJ1ZmZlciwgc291cmNlLm9mZnNldCwgKHNvdXJjZS5jb3VudCAtIDEpICogc291cmNlU3RyaWRlICsgKHNvdXJjZS5zaXplICsgMykgLyA0KTtcblxuICAgICAgICAgICAgbGV0IHNyYyA9IDA7XG4gICAgICAgICAgICBsZXQgZHN0ID0gdGFyZ2V0Lm9mZnNldCAvIDQ7XG4gICAgICAgICAgICBjb25zdCBrZW5kID0gTWF0aC5mbG9vcigoc291cmNlLnNpemUgKyAzKSAvIDQpO1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IG51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwga2VuZDsgKytrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldEFycmF5W2RzdCArIGtdID0gc291cmNlQXJyYXlbc3JjICsga107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNyYyArPSBzb3VyY2VTdHJpZGU7XG4gICAgICAgICAgICAgICAgZHN0ICs9IHRhcmdldFN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmbGlwVikge1xuICAgICAgICBmbGlwVGV4Q29vcmRWcyh2ZXJ0ZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIHZlcnRleEJ1ZmZlci51bmxvY2soKTtcblxuICAgIHJldHVybiB2ZXJ0ZXhCdWZmZXI7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXIgPSBmdW5jdGlvbiAoZGV2aWNlLCBhdHRyaWJ1dGVzLCBpbmRpY2VzLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCkge1xuXG4gICAgLy8gZXh0cmFjdCBsaXN0IG9mIGF0dHJpYnV0ZXMgdG8gdXNlXG4gICAgY29uc3QgdXNlQXR0cmlidXRlcyA9IHt9O1xuICAgIGNvbnN0IGF0dHJpYklkcyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBhdHRyaWIgaW4gYXR0cmlidXRlcykge1xuICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShhdHRyaWIpICYmIGdsdGZUb0VuZ2luZVNlbWFudGljTWFwLmhhc093blByb3BlcnR5KGF0dHJpYikpIHtcbiAgICAgICAgICAgIHVzZUF0dHJpYnV0ZXNbYXR0cmliXSA9IGF0dHJpYnV0ZXNbYXR0cmliXTtcblxuICAgICAgICAgICAgLy8gYnVpbGQgdW5pcXVlIGlkIGZvciBlYWNoIGF0dHJpYnV0ZSBpbiBmb3JtYXQ6IFNlbWFudGljOmFjY2Vzc29ySW5kZXhcbiAgICAgICAgICAgIGF0dHJpYklkcy5wdXNoKGF0dHJpYiArICc6JyArIGF0dHJpYnV0ZXNbYXR0cmliXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHVuaXF1ZSBpZHMgYW5kIGNyZWF0ZSB1bmlxdWUgdmVydGV4IGJ1ZmZlciBJRFxuICAgIGF0dHJpYklkcy5zb3J0KCk7XG4gICAgY29uc3QgdmJLZXkgPSBhdHRyaWJJZHMuam9pbigpO1xuXG4gICAgLy8gcmV0dXJuIGFscmVhZHkgY3JlYXRlZCB2ZXJ0ZXggYnVmZmVyIGlmIGlkZW50aWNhbFxuICAgIGxldCB2YiA9IHZlcnRleEJ1ZmZlckRpY3RbdmJLZXldO1xuICAgIGlmICghdmIpIHtcbiAgICAgICAgLy8gYnVpbGQgdmVydGV4IGJ1ZmZlciBmb3JtYXQgZGVzYyBhbmQgc291cmNlXG4gICAgICAgIGNvbnN0IHNvdXJjZURlc2MgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyaWIgaW4gdXNlQXR0cmlidXRlcykge1xuICAgICAgICAgICAgY29uc3QgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbYXR0cmlidXRlc1thdHRyaWJdXTtcbiAgICAgICAgICAgIGNvbnN0IGFjY2Vzc29yRGF0YSA9IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyVmlldyA9IGJ1ZmZlclZpZXdzW2FjY2Vzc29yLmJ1ZmZlclZpZXddO1xuICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFthdHRyaWJdO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSkgKiBnZXRDb21wb25lbnRTaXplSW5CeXRlcyhhY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgIGNvbnN0IHN0cmlkZSA9IGJ1ZmZlclZpZXcuaGFzT3duUHJvcGVydHkoJ2J5dGVTdHJpZGUnKSA/IGJ1ZmZlclZpZXcuYnl0ZVN0cmlkZSA6IHNpemU7XG4gICAgICAgICAgICBzb3VyY2VEZXNjW3NlbWFudGljXSA9IHtcbiAgICAgICAgICAgICAgICBidWZmZXI6IGFjY2Vzc29yRGF0YS5idWZmZXIsXG4gICAgICAgICAgICAgICAgc2l6ZTogc2l6ZSxcbiAgICAgICAgICAgICAgICBvZmZzZXQ6IGFjY2Vzc29yRGF0YS5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgICAgIHN0cmlkZTogc3RyaWRlLFxuICAgICAgICAgICAgICAgIGNvdW50OiBhY2Nlc3Nvci5jb3VudCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBnZXROdW1Db21wb25lbnRzKGFjY2Vzc29yLnR5cGUpLFxuICAgICAgICAgICAgICAgIHR5cGU6IGdldENvbXBvbmVudFR5cGUoYWNjZXNzb3IuY29tcG9uZW50VHlwZSksXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiBhY2Nlc3Nvci5ub3JtYWxpemVkXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2VuZXJhdGUgbm9ybWFscyBpZiB0aGV5J3JlIG1pc3NpbmcgKHRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIGEgdXNlciBvcHRpb24pXG4gICAgICAgIGlmICghc291cmNlRGVzYy5oYXNPd25Qcm9wZXJ0eShTRU1BTlRJQ19OT1JNQUwpKSB7XG4gICAgICAgICAgICBnZW5lcmF0ZU5vcm1hbHMoc291cmNlRGVzYywgaW5kaWNlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgYW5kIHN0b3JlIGl0IGluIHRoZSBkaWN0aW9uYXJ5XG4gICAgICAgIHZiID0gY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVik7XG4gICAgICAgIHZlcnRleEJ1ZmZlckRpY3RbdmJLZXldID0gdmI7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZiO1xufTtcblxuY29uc3QgY3JlYXRlVmVydGV4QnVmZmVyRHJhY28gPSBmdW5jdGlvbiAoZGV2aWNlLCBvdXRwdXRHZW9tZXRyeSwgZXh0RHJhY28sIGRlY29kZXIsIGRlY29kZXJNb2R1bGUsIGluZGljZXMsIGZsaXBWKSB7XG5cbiAgICBjb25zdCBudW1Qb2ludHMgPSBvdXRwdXRHZW9tZXRyeS5udW1fcG9pbnRzKCk7XG5cbiAgICAvLyBoZWxwZXIgZnVuY3Rpb24gdG8gZGVjb2RlIGRhdGEgc3RyZWFtIHdpdGggaWQgdG8gVHlwZWRBcnJheSBvZiBhcHByb3ByaWF0ZSB0eXBlXG4gICAgY29uc3QgZXh0cmFjdERyYWNvQXR0cmlidXRlSW5mbyA9IGZ1bmN0aW9uICh1bmlxdWVJZCwgc2VtYW50aWMpIHtcbiAgICAgICAgY29uc3QgYXR0cmlidXRlID0gZGVjb2Rlci5HZXRBdHRyaWJ1dGVCeVVuaXF1ZUlkKG91dHB1dEdlb21ldHJ5LCB1bmlxdWVJZCk7XG4gICAgICAgIGNvbnN0IG51bVZhbHVlcyA9IG51bVBvaW50cyAqIGF0dHJpYnV0ZS5udW1fY29tcG9uZW50cygpO1xuICAgICAgICBjb25zdCBkcmFjb0Zvcm1hdCA9IGF0dHJpYnV0ZS5kYXRhX3R5cGUoKTtcbiAgICAgICAgbGV0IHB0ciwgdmFsdWVzLCBjb21wb25lbnRTaXplSW5CeXRlcywgc3RvcmFnZVR5cGU7XG5cbiAgICAgICAgLy8gc3RvcmFnZSBmb3JtYXQgaXMgYmFzZWQgb24gZHJhY28gYXR0cmlidXRlIGRhdGEgdHlwZVxuICAgICAgICBzd2l0Y2ggKGRyYWNvRm9ybWF0KSB7XG5cbiAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5EVF9VSU5UODpcbiAgICAgICAgICAgICAgICBzdG9yYWdlVHlwZSA9IFRZUEVfVUlOVDg7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50U2l6ZUluQnl0ZXMgPSAxO1xuICAgICAgICAgICAgICAgIHB0ciA9IGRlY29kZXJNb2R1bGUuX21hbGxvYyhudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcyk7XG4gICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMob3V0cHV0R2VvbWV0cnksIGF0dHJpYnV0ZSwgZGVjb2Rlck1vZHVsZS5EVF9VSU5UOCwgbnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMsIHB0cik7XG4gICAgICAgICAgICAgICAgdmFsdWVzID0gbmV3IFVpbnQ4QXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQVTguYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX1VJTlQxNjpcbiAgICAgICAgICAgICAgICBzdG9yYWdlVHlwZSA9IFRZUEVfVUlOVDE2O1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzID0gMjtcbiAgICAgICAgICAgICAgICBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MobnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMpO1xuICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0QXR0cmlidXRlRGF0YUFycmF5Rm9yQWxsUG9pbnRzKG91dHB1dEdlb21ldHJ5LCBhdHRyaWJ1dGUsIGRlY29kZXJNb2R1bGUuRFRfVUlOVDE2LCBudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcywgcHRyKTtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBuZXcgVWludDE2QXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQVTE2LmJ1ZmZlciwgcHRyLCBudW1WYWx1ZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5EVF9GTE9BVDMyOlxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBzdG9yYWdlVHlwZSA9IFRZUEVfRkxPQVQzMjtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRTaXplSW5CeXRlcyA9IDQ7XG4gICAgICAgICAgICAgICAgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzKTtcbiAgICAgICAgICAgICAgICBkZWNvZGVyLkdldEF0dHJpYnV0ZURhdGFBcnJheUZvckFsbFBvaW50cyhvdXRwdXRHZW9tZXRyeSwgYXR0cmlidXRlLCBkZWNvZGVyTW9kdWxlLkRUX0ZMT0FUMzIsIG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBwdHIpO1xuICAgICAgICAgICAgICAgIHZhbHVlcyA9IG5ldyBGbG9hdDMyQXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQRjMyLmJ1ZmZlciwgcHRyLCBudW1WYWx1ZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICBkZWNvZGVyTW9kdWxlLl9mcmVlKHB0cik7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHZhbHVlczogdmFsdWVzLFxuICAgICAgICAgICAgbnVtQ29tcG9uZW50czogYXR0cmlidXRlLm51bV9jb21wb25lbnRzKCksXG4gICAgICAgICAgICBjb21wb25lbnRTaXplSW5CeXRlczogY29tcG9uZW50U2l6ZUluQnl0ZXMsXG4gICAgICAgICAgICBzdG9yYWdlVHlwZTogc3RvcmFnZVR5cGUsXG5cbiAgICAgICAgICAgIC8vIHRoZXJlIGFyZSBnbGIgZmlsZXMgYXJvdW5kIHdoZXJlIDhiaXQgY29sb3JzIGFyZSBtaXNzaW5nIG5vcm1hbGl6ZWQgZmxhZ1xuICAgICAgICAgICAgbm9ybWFsaXplZDogKHNlbWFudGljID09PSBTRU1BTlRJQ19DT0xPUiAmJiAoc3RvcmFnZVR5cGUgPT09IFRZUEVfVUlOVDggfHwgc3RvcmFnZVR5cGUgPT09IFRZUEVfVUlOVDE2KSkgPyB0cnVlIDogYXR0cmlidXRlLm5vcm1hbGl6ZWQoKVxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICAvLyBidWlsZCB2ZXJ0ZXggYnVmZmVyIGZvcm1hdCBkZXNjIGFuZCBzb3VyY2VcbiAgICBjb25zdCBzb3VyY2VEZXNjID0ge307XG4gICAgY29uc3QgYXR0cmlidXRlcyA9IGV4dERyYWNvLmF0dHJpYnV0ZXM7XG4gICAgZm9yIChjb25zdCBhdHRyaWIgaW4gYXR0cmlidXRlcykge1xuICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShhdHRyaWIpICYmIGdsdGZUb0VuZ2luZVNlbWFudGljTWFwLmhhc093blByb3BlcnR5KGF0dHJpYikpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlbWFudGljID0gZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXBbYXR0cmliXTtcbiAgICAgICAgICAgIGNvbnN0IGF0dHJpYnV0ZUluZm8gPSBleHRyYWN0RHJhY29BdHRyaWJ1dGVJbmZvKGF0dHJpYnV0ZXNbYXR0cmliXSwgc2VtYW50aWMpO1xuXG4gICAgICAgICAgICAvLyBzdG9yZSB0aGUgaW5mbyB3ZSdsbCBuZWVkIHRvIGNvcHkgdGhpcyBkYXRhIGludG8gdGhlIHZlcnRleCBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IHNpemUgPSBhdHRyaWJ1dGVJbmZvLm51bUNvbXBvbmVudHMgKiBhdHRyaWJ1dGVJbmZvLmNvbXBvbmVudFNpemVJbkJ5dGVzO1xuICAgICAgICAgICAgc291cmNlRGVzY1tzZW1hbnRpY10gPSB7XG4gICAgICAgICAgICAgICAgdmFsdWVzOiBhdHRyaWJ1dGVJbmZvLnZhbHVlcyxcbiAgICAgICAgICAgICAgICBidWZmZXI6IGF0dHJpYnV0ZUluZm8udmFsdWVzLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgICAgIG9mZnNldDogMCxcbiAgICAgICAgICAgICAgICBzdHJpZGU6IHNpemUsXG4gICAgICAgICAgICAgICAgY291bnQ6IG51bVBvaW50cyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBhdHRyaWJ1dGVJbmZvLm51bUNvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgdHlwZTogYXR0cmlidXRlSW5mby5zdG9yYWdlVHlwZSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6IGF0dHJpYnV0ZUluZm8ubm9ybWFsaXplZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGdlbmVyYXRlIG5vcm1hbHMgaWYgdGhleSdyZSBtaXNzaW5nICh0aGlzIHNob3VsZCBwcm9iYWJseSBiZSBhIHVzZXIgb3B0aW9uKVxuICAgIGlmICghc291cmNlRGVzYy5oYXNPd25Qcm9wZXJ0eShTRU1BTlRJQ19OT1JNQUwpKSB7XG4gICAgICAgIGdlbmVyYXRlTm9ybWFscyhzb3VyY2VEZXNjLCBpbmRpY2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVik7XG59O1xuXG5jb25zdCBjcmVhdGVTa2luID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0ZlNraW4sIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIG5vZGVzLCBnbGJTa2lucykge1xuICAgIGxldCBpLCBqLCBiaW5kTWF0cml4O1xuICAgIGNvbnN0IGpvaW50cyA9IGdsdGZTa2luLmpvaW50cztcbiAgICBjb25zdCBudW1Kb2ludHMgPSBqb2ludHMubGVuZ3RoO1xuICAgIGNvbnN0IGlicCA9IFtdO1xuICAgIGlmIChnbHRmU2tpbi5oYXNPd25Qcm9wZXJ0eSgnaW52ZXJzZUJpbmRNYXRyaWNlcycpKSB7XG4gICAgICAgIGNvbnN0IGludmVyc2VCaW5kTWF0cmljZXMgPSBnbHRmU2tpbi5pbnZlcnNlQmluZE1hdHJpY2VzO1xuICAgICAgICBjb25zdCBpYm1EYXRhID0gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yc1tpbnZlcnNlQmluZE1hdHJpY2VzXSwgYnVmZmVyVmlld3MsIHRydWUpO1xuICAgICAgICBjb25zdCBpYm1WYWx1ZXMgPSBbXTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCAxNjsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWJtVmFsdWVzW2pdID0gaWJtRGF0YVtpICogMTYgKyBqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJpbmRNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgYmluZE1hdHJpeC5zZXQoaWJtVmFsdWVzKTtcbiAgICAgICAgICAgIGlicC5wdXNoKGJpbmRNYXRyaXgpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG51bUpvaW50czsgaSsrKSB7XG4gICAgICAgICAgICBiaW5kTWF0cml4ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgICAgIGlicC5wdXNoKGJpbmRNYXRyaXgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYm9uZU5hbWVzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IG51bUpvaW50czsgaSsrKSB7XG4gICAgICAgIGJvbmVOYW1lc1tpXSA9IG5vZGVzW2pvaW50c1tpXV0ubmFtZTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgYSBjYWNoZSBrZXkgZnJvbSBib25lIG5hbWVzIGFuZCBzZWUgaWYgd2UgaGF2ZSBtYXRjaGluZyBza2luXG4gICAgY29uc3Qga2V5ID0gYm9uZU5hbWVzLmpvaW4oJyMnKTtcbiAgICBsZXQgc2tpbiA9IGdsYlNraW5zLmdldChrZXkpO1xuICAgIGlmICghc2tpbikge1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgc2tpbiBhbmQgYWRkIGl0IHRvIHRoZSBjYWNoZVxuICAgICAgICBza2luID0gbmV3IFNraW4oZGV2aWNlLCBpYnAsIGJvbmVOYW1lcyk7XG4gICAgICAgIGdsYlNraW5zLnNldChrZXksIHNraW4pO1xuICAgIH1cblxuICAgIHJldHVybiBza2luO1xufTtcblxuY29uc3QgdGVtcE1hdCA9IG5ldyBNYXQ0KCk7XG5jb25zdCB0ZW1wVmVjID0gbmV3IFZlYzMoKTtcblxuY29uc3QgY3JlYXRlTWVzaCA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGZNZXNoLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBjYWxsYmFjaywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIGFzc2V0T3B0aW9ucykge1xuICAgIGNvbnN0IG1lc2hlcyA9IFtdO1xuXG4gICAgZ2x0Zk1lc2gucHJpbWl0aXZlcy5mb3JFYWNoKGZ1bmN0aW9uIChwcmltaXRpdmUpIHtcblxuICAgICAgICBsZXQgcHJpbWl0aXZlVHlwZSwgdmVydGV4QnVmZmVyLCBudW1JbmRpY2VzO1xuICAgICAgICBsZXQgaW5kaWNlcyA9IG51bGw7XG4gICAgICAgIGxldCBjYW5Vc2VNb3JwaCA9IHRydWU7XG5cbiAgICAgICAgLy8gdHJ5IGFuZCBnZXQgZHJhY28gY29tcHJlc3NlZCBkYXRhIGZpcnN0XG4gICAgICAgIGlmIChwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSkge1xuICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9ucyA9IHByaW1pdGl2ZS5leHRlbnNpb25zO1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uJykpIHtcblxuICAgICAgICAgICAgICAgIC8vIGFjY2VzcyBEcmFjb0RlY29kZXJNb2R1bGVcbiAgICAgICAgICAgICAgICBjb25zdCBkZWNvZGVyTW9kdWxlID0gZHJhY29EZWNvZGVySW5zdGFuY2UgfHwgZ2V0R2xvYmFsRHJhY29EZWNvZGVyTW9kdWxlKCk7XG4gICAgICAgICAgICAgICAgaWYgKGRlY29kZXJNb2R1bGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXh0RHJhY28gPSBleHRlbnNpb25zLktIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0RHJhY28uaGFzT3duUHJvcGVydHkoJ2F0dHJpYnV0ZXMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdWludDhCdWZmZXIgPSBidWZmZXJWaWV3c1tleHREcmFjby5idWZmZXJWaWV3XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBkZWNvZGVyTW9kdWxlLkRlY29kZXJCdWZmZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5Jbml0KHVpbnQ4QnVmZmVyLCB1aW50OEJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZWNvZGVyID0gbmV3IGRlY29kZXJNb2R1bGUuRGVjb2RlcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2VvbWV0cnlUeXBlID0gZGVjb2Rlci5HZXRFbmNvZGVkR2VvbWV0cnlUeXBlKGJ1ZmZlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBvdXRwdXRHZW9tZXRyeSwgc3RhdHVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgc3dpdGNoIChnZW9tZXRyeVR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuUE9JTlRfQ0xPVUQ6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW1pdGl2ZVR5cGUgPSBQUklNSVRJVkVfUE9JTlRTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRHZW9tZXRyeSA9IG5ldyBkZWNvZGVyTW9kdWxlLlBvaW50Q2xvdWQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzID0gZGVjb2Rlci5EZWNvZGVCdWZmZXJUb1BvaW50Q2xvdWQoYnVmZmVyLCBvdXRwdXRHZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5UUklBTkdVTEFSX01FU0g6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW1pdGl2ZVR5cGUgPSBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRHZW9tZXRyeSA9IG5ldyBkZWNvZGVyTW9kdWxlLk1lc2goKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzID0gZGVjb2Rlci5EZWNvZGVCdWZmZXJUb01lc2goYnVmZmVyLCBvdXRwdXRHZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5JTlZBTElEX0dFT01FVFJZX1RZUEU6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghc3RhdHVzIHx8ICFzdGF0dXMub2soKSB8fCBvdXRwdXRHZW9tZXRyeS5wdHIgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygnRmFpbGVkIHRvIGRlY29kZSBkcmFjbyBjb21wcmVzc2VkIGFzc2V0OiAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAoc3RhdHVzID8gc3RhdHVzLmVycm9yX21zZygpIDogKCdNZXNoIGFzc2V0IC0gaW52YWxpZCBkcmFjbyBjb21wcmVzc2VkIGdlb21ldHJ5IHR5cGU6ICcgKyBnZW9tZXRyeVR5cGUpKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpbmRpY2VzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBudW1GYWNlcyA9IG91dHB1dEdlb21ldHJ5Lm51bV9mYWNlcygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGdlb21ldHJ5VHlwZSA9PT0gZGVjb2Rlck1vZHVsZS5UUklBTkdVTEFSX01FU0gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiaXQzMiA9IG91dHB1dEdlb21ldHJ5Lm51bV9wb2ludHMoKSA+IDY1NTM1O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtSW5kaWNlcyA9IG51bUZhY2VzICogMztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhU2l6ZSA9IG51bUluZGljZXMgKiAoYml0MzIgPyA0IDogMik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKGRhdGFTaXplKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiaXQzMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyLkdldFRyaWFuZ2xlc1VJbnQzMkFycmF5KG91dHB1dEdlb21ldHJ5LCBkYXRhU2l6ZSwgcHRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MzJBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMzIuYnVmZmVyLCBwdHIsIG51bUluZGljZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRUcmlhbmdsZXNVSW50MTZBcnJheShvdXRwdXRHZW9tZXRyeSwgZGF0YVNpemUsIHB0cik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZGljZXMgPSBuZXcgVWludDE2QXJyYXkoZGVjb2Rlck1vZHVsZS5IRUFQVTE2LmJ1ZmZlciwgcHRyLCBudW1JbmRpY2VzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXJNb2R1bGUuX2ZyZWUocHRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdmVydGljZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcnRleEJ1ZmZlciA9IGNyZWF0ZVZlcnRleEJ1ZmZlckRyYWNvKGRldmljZSwgb3V0cHV0R2VvbWV0cnksIGV4dERyYWNvLCBkZWNvZGVyLCBkZWNvZGVyTW9kdWxlLCBpbmRpY2VzLCBmbGlwVik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNsZWFuIHVwXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLmRlc3Ryb3kob3V0cHV0R2VvbWV0cnkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5kZXN0cm95KGRlY29kZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5kZXN0cm95KGJ1ZmZlcik7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1vcnBoIHN0cmVhbXMgYXJlIG5vdCBjb21wYXRpYmxlIHdpdGggZHJhY28gY29tcHJlc3Npb24sIGRpc2FibGUgbW9ycGhpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhblVzZU1vcnBoID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdGaWxlIGNvbnRhaW5zIGRyYWNvIGNvbXByZXNzZWQgZGF0YSwgYnV0IERyYWNvRGVjb2Rlck1vZHVsZSBpcyBub3QgY29uZmlndXJlZC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBtZXNoIHdhcyBub3QgY29uc3RydWN0ZWQgZnJvbSBkcmFjbyBkYXRhLCB1c2UgdW5jb21wcmVzc2VkXG4gICAgICAgIGlmICghdmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICBpbmRpY2VzID0gcHJpbWl0aXZlLmhhc093blByb3BlcnR5KCdpbmRpY2VzJykgPyBnZXRBY2Nlc3NvckRhdGEoYWNjZXNzb3JzW3ByaW1pdGl2ZS5pbmRpY2VzXSwgYnVmZmVyVmlld3MsIHRydWUpIDogbnVsbDtcbiAgICAgICAgICAgIHZlcnRleEJ1ZmZlciA9IGNyZWF0ZVZlcnRleEJ1ZmZlcihkZXZpY2UsIHByaW1pdGl2ZS5hdHRyaWJ1dGVzLCBpbmRpY2VzLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCk7XG4gICAgICAgICAgICBwcmltaXRpdmVUeXBlID0gZ2V0UHJpbWl0aXZlVHlwZShwcmltaXRpdmUpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG1lc2ggPSBudWxsO1xuICAgICAgICBpZiAodmVydGV4QnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBidWlsZCB0aGUgbWVzaFxuICAgICAgICAgICAgbWVzaCA9IG5ldyBNZXNoKGRldmljZSk7XG4gICAgICAgICAgICBtZXNoLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLnR5cGUgPSBwcmltaXRpdmVUeXBlO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uYmFzZSA9IDA7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkID0gKGluZGljZXMgIT09IG51bGwpO1xuXG4gICAgICAgICAgICAvLyBpbmRleCBidWZmZXJcbiAgICAgICAgICAgIGlmIChpbmRpY2VzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbGV0IGluZGV4Rm9ybWF0O1xuICAgICAgICAgICAgICAgIGlmIChpbmRpY2VzIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQ4O1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5kaWNlcyBpbnN0YW5jZW9mIFVpbnQxNkFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDMyO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIDMyYml0IGluZGV4IGJ1ZmZlciBpcyB1c2VkIGJ1dCBub3Qgc3VwcG9ydGVkXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4Rm9ybWF0ID09PSBJTkRFWEZPUk1BVF9VSU5UMzIgJiYgIWRldmljZS5leHRVaW50RWxlbWVudCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcyA+IDB4RkZGRikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdHbGIgZmlsZSBjb250YWlucyAzMmJpdCBpbmRleCBidWZmZXIgYnV0IHRoZXNlIGFyZSBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgZGV2aWNlIC0gaXQgbWF5IGJlIHJlbmRlcmVkIGluY29ycmVjdGx5LicpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgdG8gMTZiaXRcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMTY7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMgPSBuZXcgVWludDE2QXJyYXkoaW5kaWNlcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIoZGV2aWNlLCBpbmRleEZvcm1hdCwgaW5kaWNlcy5sZW5ndGgsIEJVRkZFUl9TVEFUSUMsIGluZGljZXMpO1xuICAgICAgICAgICAgICAgIG1lc2guaW5kZXhCdWZmZXJbMF0gPSBpbmRleEJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IGluZGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eShcImV4dGVuc2lvbnNcIikgJiYgcHJpbWl0aXZlLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudHMgPSBwcmltaXRpdmUuZXh0ZW5zaW9ucy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBNYXBwaW5nID0ge307XG4gICAgICAgICAgICAgICAgdmFyaWFudHMubWFwcGluZ3MuZm9yRWFjaCgobWFwcGluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLnZhcmlhbnRzLmZvckVhY2goKHZhcmlhbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBNYXBwaW5nW3ZhcmlhbnRdID0gbWFwcGluZy5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbWVzaFZhcmlhbnRzW21lc2guaWRdID0gdGVtcE1hcHBpbmc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1lc2hEZWZhdWx0TWF0ZXJpYWxzW21lc2guaWRdID0gcHJpbWl0aXZlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICBsZXQgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbcHJpbWl0aXZlLmF0dHJpYnV0ZXMuUE9TSVRJT05dO1xuICAgICAgICAgICAgbWVzaC5hYWJiID0gZ2V0QWNjZXNzb3JCb3VuZGluZ0JveChhY2Nlc3Nvcik7XG5cbiAgICAgICAgICAgIC8vIG1vcnBoIHRhcmdldHNcbiAgICAgICAgICAgIGlmIChjYW5Vc2VNb3JwaCAmJiBwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ3RhcmdldHMnKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHByaW1pdGl2ZS50YXJnZXRzLmZvckVhY2goZnVuY3Rpb24gKHRhcmdldCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHt9O1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ1BPU0lUSU9OJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2Vzc29yID0gYWNjZXNzb3JzW3RhcmdldC5QT1NJVElPTl07XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhUG9zaXRpb25zID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YVBvc2l0aW9uc1R5cGUgPSBUWVBFX0ZMT0FUMzI7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmFhYmIgPSBnZXRBY2Nlc3NvckJvdW5kaW5nQm94KGFjY2Vzc29yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ05PUk1BTCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2Nlc3NvciA9IGFjY2Vzc29yc1t0YXJnZXQuTk9STUFMXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IHRoZSBtb3JwaCB0YXJnZXRzIGNhbid0IGN1cnJlbnRseSBhY2NlcHQgcXVhbnRpemVkIG5vcm1hbHNcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFOb3JtYWxzID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YU5vcm1hbHNUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbmFtZSBpZiBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZNZXNoLmhhc093blByb3BlcnR5KCdleHRyYXMnKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgZ2x0Zk1lc2guZXh0cmFzLmhhc093blByb3BlcnR5KCd0YXJnZXROYW1lcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLm5hbWUgPSBnbHRmTWVzaC5leHRyYXMudGFyZ2V0TmFtZXNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uYW1lID0gaW5kZXgudG9TdHJpbmcoMTApO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCB3ZWlnaHQgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTWVzaC5oYXNPd25Qcm9wZXJ0eSgnd2VpZ2h0cycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlZmF1bHRXZWlnaHQgPSBnbHRmTWVzaC53ZWlnaHRzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMucHJlc2VydmVEYXRhID0gYXNzZXRPcHRpb25zLm1vcnBoUHJlc2VydmVEYXRhO1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRzLnB1c2gobmV3IE1vcnBoVGFyZ2V0KG9wdGlvbnMpKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIG1lc2gubW9ycGggPSBuZXcgTW9ycGgodGFyZ2V0cywgZGV2aWNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG1lc2hlcy5wdXNoKG1lc2gpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1lc2hlcztcbn07XG5cbmNvbnN0IGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtID0gZnVuY3Rpb24gKHNvdXJjZSwgbWF0ZXJpYWwsIG1hcHMpIHtcbiAgICBsZXQgbWFwO1xuXG4gICAgY29uc3QgdGV4Q29vcmQgPSBzb3VyY2UudGV4Q29vcmQ7XG4gICAgaWYgKHRleENvb3JkKSB7XG4gICAgICAgIGZvciAobWFwID0gMDsgbWFwIDwgbWFwcy5sZW5ndGg7ICsrbWFwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbFttYXBzW21hcF0gKyAnTWFwVXYnXSA9IHRleENvb3JkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgemVyb3MgPSBbMCwgMF07XG4gICAgY29uc3Qgb25lcyA9IFsxLCAxXTtcbiAgICBjb25zdCB0ZXh0dXJlVHJhbnNmb3JtID0gc291cmNlLmV4dGVuc2lvbnM/LktIUl90ZXh0dXJlX3RyYW5zZm9ybTtcbiAgICBpZiAodGV4dHVyZVRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSB0ZXh0dXJlVHJhbnNmb3JtLm9mZnNldCB8fCB6ZXJvcztcbiAgICAgICAgY29uc3Qgc2NhbGUgPSB0ZXh0dXJlVHJhbnNmb3JtLnNjYWxlIHx8IG9uZXM7XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gdGV4dHVyZVRyYW5zZm9ybS5yb3RhdGlvbiA/ICgtdGV4dHVyZVRyYW5zZm9ybS5yb3RhdGlvbiAqIG1hdGguUkFEX1RPX0RFRykgOiAwO1xuXG4gICAgICAgIGNvbnN0IHRpbGluZ1ZlYyA9IG5ldyBWZWMyKHNjYWxlWzBdLCBzY2FsZVsxXSk7XG4gICAgICAgIGNvbnN0IG9mZnNldFZlYyA9IG5ldyBWZWMyKG9mZnNldFswXSwgMS4wIC0gc2NhbGVbMV0gLSBvZmZzZXRbMV0pO1xuXG4gICAgICAgIGZvciAobWFwID0gMDsgbWFwIDwgbWFwcy5sZW5ndGg7ICsrbWFwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbFtgJHttYXBzW21hcF19TWFwVGlsaW5nYF0gPSB0aWxpbmdWZWM7XG4gICAgICAgICAgICBtYXRlcmlhbFtgJHttYXBzW21hcF19TWFwT2Zmc2V0YF0gPSBvZmZzZXRWZWM7XG4gICAgICAgICAgICBtYXRlcmlhbFtgJHttYXBzW21hcF19TWFwUm90YXRpb25gXSA9IHJvdGF0aW9uO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uUGJyU3BlY0dsb3NzaW5lc3MgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbGV0IGNvbG9yLCB0ZXh0dXJlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdkaWZmdXNlRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBkYXRhLmRpZmZ1c2VGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IGNvbG9yWzNdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDEsIDEsIDEpO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gMTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2RpZmZ1c2VUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgZGlmZnVzZVRleHR1cmUgPSBkYXRhLmRpZmZ1c2VUZXh0dXJlO1xuICAgICAgICB0ZXh0dXJlID0gdGV4dHVyZXNbZGlmZnVzZVRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSB0ZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwID0gdGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWwgPSAnYSc7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGlmZnVzZVRleHR1cmUsIG1hdGVyaWFsLCBbJ2RpZmZ1c2UnLCAnb3BhY2l0eSddKTtcbiAgICB9XG4gICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzID0gZmFsc2U7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBkYXRhLnNwZWN1bGFyRmFjdG9yO1xuICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2dsb3NzaW5lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5nbG9zcyA9IGRhdGEuZ2xvc3NpbmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5nbG9zcyA9IDEuMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlID0gZGF0YS5zcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhckVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcCA9IG1hdGVyaWFsLmdsb3NzTWFwID0gdGV4dHVyZXNbc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICBtYXRlcmlhbC5nbG9zc01hcENoYW5uZWwgPSAnYSc7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZ2xvc3MnLCAnbWV0YWxuZXNzJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbkNsZWFyQ29hdCA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0RmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0ID0gZGF0YS5jbGVhcmNvYXRGYWN0b3IgKiAwLjI1OyAvLyBUT0RPOiByZW1vdmUgdGVtcG9yYXJ5IHdvcmthcm91bmQgZm9yIHJlcGxpY2F0aW5nIGdsVEYgY2xlYXItY29hdCB2aXN1YWxzXG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0ID0gMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXRUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXRUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXRUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0TWFwQ2hhbm5lbCA9ICdyJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXRUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXQnXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRSb3VnaG5lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zcyA9IGRhdGEuY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzID0gMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdFJvdWdobmVzc1RleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc01hcCA9IHRleHR1cmVzW2NsZWFyY29hdFJvdWdobmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc01hcENoYW5uZWwgPSAnZyc7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0R2xvc3MnXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXROb3JtYWxUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSA9IGRhdGEuY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0Tm9ybWFsTWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0Tm9ybWFsJ10pO1xuXG4gICAgICAgIGlmIChjbGVhcmNvYXROb3JtYWxUZXh0dXJlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRCdW1waW5lc3MgPSBjbGVhcmNvYXROb3JtYWxUZXh0dXJlLnNjYWxlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NJbnZlcnQgPSB0cnVlO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uVW5saXQgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwudXNlTGlnaHRpbmcgPSBmYWxzZTtcblxuICAgIC8vIGNvcHkgZGlmZnVzZSBpbnRvIGVtaXNzaXZlXG4gICAgbWF0ZXJpYWwuZW1pc3NpdmUuY29weShtYXRlcmlhbC5kaWZmdXNlKTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSBtYXRlcmlhbC5kaWZmdXNlVGludDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcCA9IG1hdGVyaWFsLmRpZmZ1c2VNYXA7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBVdiA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBVdjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFRpbGluZy5jb3B5KG1hdGVyaWFsLmRpZmZ1c2VNYXBUaWxpbmcpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwT2Zmc2V0LmNvcHkobWF0ZXJpYWwuZGlmZnVzZU1hcE9mZnNldCk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBSb3RhdGlvbiA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBSb3RhdGlvbjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcENoYW5uZWwgPSBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVZlcnRleENvbG9yID0gbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVmVydGV4Q29sb3JDaGFubmVsID0gbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yQ2hhbm5lbDtcblxuICAgIC8vIGJsYW5rIGRpZmZ1c2VcbiAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgwLCAwLCAwKTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVGludCA9IGZhbHNlO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSBudWxsO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvciA9IGZhbHNlO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uU3BlY3VsYXIgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJFbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSB0ZXh0dXJlc1tkYXRhLnNwZWN1bGFyQ29sb3JUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXBDaGFubmVsID0gJ3JnYic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhckNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc3BlY3VsYXInXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JGYWN0b3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuc3BlY3VsYXJDb2xvckZhY3RvcjtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3RvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3IgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3JNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3Rvck1hcCA9IHRleHR1cmVzW2RhdGEuc3BlY3VsYXJUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NwZWN1bGFyaXR5RmFjdG9yJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklvciA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbkluZGV4ID0gMS4wIC8gZGF0YS5pb3I7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uVHJhbnNtaXNzaW9uID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICBtYXRlcmlhbC51c2VEeW5hbWljUmVmcmFjdGlvbiA9IHRydWU7XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbiA9IGRhdGEudHJhbnNtaXNzaW9uRmFjdG9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25NYXBDaGFubmVsID0gJ3InO1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uTWFwID0gdGV4dHVyZXNbZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLCBtYXRlcmlhbCwgWydyZWZyYWN0aW9uJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvblNoZWVuID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZVNoZWVuID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvckZhY3RvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5zaGVlbkNvbG9yRmFjdG9yO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW4uc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbk1hcCA9IHRleHR1cmVzW2RhdGEuc2hlZW5Db2xvclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNoZWVuQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydzaGVlbiddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zcyA9IGRhdGEuc2hlZW5Sb3VnaG5lc3NGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zcyA9IDAuMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnNoZWVuUm91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNoZWVuUm91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc2hlZW5HbG9zcyddKTtcbiAgICB9XG5cbiAgICBtYXRlcmlhbC5zaGVlbkdsb3NzSW52ZXJ0ID0gdHJ1ZTtcbn07XG5cbmNvbnN0IGV4dGVuc2lvblZvbHVtZSA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgbWF0ZXJpYWwudXNlRHluYW1pY1JlZnJhY3Rpb24gPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0aGlja25lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3MgPSBkYXRhLnRoaWNrbmVzc0ZhY3RvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3NNYXBDaGFubmVsID0gJ2cnO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnRoaWNrbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ3RoaWNrbmVzcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2F0dGVudWF0aW9uRGlzdGFuY2UnKSkge1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbkRpc3RhbmNlID0gZGF0YS5hdHRlbnVhdGlvbkRpc3RhbmNlO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXR0ZW51YXRpb25Db2xvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5hdHRlbnVhdGlvbkNvbG9yO1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uRW1pc3NpdmVTdHJlbmd0aCA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVTdHJlbmd0aCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlSW50ZW5zaXR5ID0gZGF0YS5lbWlzc2l2ZVN0cmVuZ3RoO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklyaWRlc2NlbmNlID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZUlyaWRlc2NlbmNlID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZSA9IGRhdGEuaXJpZGVzY2VuY2VGYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZU1hcENoYW5uZWwgPSAncic7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2UnXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlSW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXggPSBkYXRhLmlyaWRlc2NlbmNlSW9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNaW4gPSBkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzTWF4aW11bScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4ID0gZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW07XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01hcENoYW5uZWwgPSAnZyc7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2VUaGlja25lc3MnXSk7XG4gICAgfVxufTtcblxuY29uc3QgY3JlYXRlTWF0ZXJpYWwgPSBmdW5jdGlvbiAoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpIHtcbiAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG5cbiAgICAvLyBnbFRGIGRvZXNuJ3QgZGVmaW5lIGhvdyB0byBvY2NsdWRlIHNwZWN1bGFyXG4gICAgbWF0ZXJpYWwub2NjbHVkZVNwZWN1bGFyID0gU1BFQ09DQ19BTztcblxuICAgIG1hdGVyaWFsLmRpZmZ1c2VUaW50ID0gdHJ1ZTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3IgPSB0cnVlO1xuXG4gICAgbWF0ZXJpYWwuc3BlY3VsYXJUaW50ID0gdHJ1ZTtcbiAgICBtYXRlcmlhbC5zcGVjdWxhclZlcnRleENvbG9yID0gdHJ1ZTtcblxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ25hbWUnKSkge1xuICAgICAgICBtYXRlcmlhbC5uYW1lID0gZ2x0Zk1hdGVyaWFsLm5hbWU7XG4gICAgfVxuXG4gICAgbGV0IGNvbG9yLCB0ZXh0dXJlO1xuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ3Bick1ldGFsbGljUm91Z2huZXNzJykpIHtcbiAgICAgICAgY29uc3QgcGJyRGF0YSA9IGdsdGZNYXRlcmlhbC5wYnJNZXRhbGxpY1JvdWdobmVzcztcblxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnYmFzZUNvbG9yRmFjdG9yJykpIHtcbiAgICAgICAgICAgIGNvbG9yID0gcGJyRGF0YS5iYXNlQ29sb3JGYWN0b3I7XG4gICAgICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IGNvbG9yWzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnYmFzZUNvbG9yVGV4dHVyZScpKSB7XG4gICAgICAgICAgICBjb25zdCBiYXNlQ29sb3JUZXh0dXJlID0gcGJyRGF0YS5iYXNlQ29sb3JUZXh0dXJlO1xuICAgICAgICAgICAgdGV4dHVyZSA9IHRleHR1cmVzW2Jhc2VDb2xvclRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwID0gdGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwID0gdGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShiYXNlQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydkaWZmdXNlJywgJ29wYWNpdHknXSk7XG4gICAgICAgIH1cbiAgICAgICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnbWV0YWxsaWNGYWN0b3InKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzID0gcGJyRGF0YS5tZXRhbGxpY0ZhY3RvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzcyA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ3JvdWdobmVzc0ZhY3RvcicpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zcyA9IHBickRhdGEucm91Z2huZXNzRmFjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuZ2xvc3MgPSAxO1xuICAgICAgICB9XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzSW52ZXJ0ID0gdHJ1ZTtcbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ21ldGFsbGljUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUgPSBwYnJEYXRhLm1ldGFsbGljUm91Z2huZXNzVGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcCA9IG1hdGVyaWFsLmdsb3NzTWFwID0gdGV4dHVyZXNbbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcENoYW5uZWwgPSAnYic7XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zc01hcENoYW5uZWwgPSAnZyc7XG5cbiAgICAgICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG1ldGFsbGljUm91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZ2xvc3MnLCAnbWV0YWxuZXNzJ10pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnbm9ybWFsVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IG5vcm1hbFRleHR1cmUgPSBnbHRmTWF0ZXJpYWwubm9ybWFsVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwubm9ybWFsTWFwID0gdGV4dHVyZXNbbm9ybWFsVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0obm9ybWFsVGV4dHVyZSwgbWF0ZXJpYWwsIFsnbm9ybWFsJ10pO1xuXG4gICAgICAgIGlmIChub3JtYWxUZXh0dXJlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5idW1waW5lc3MgPSBub3JtYWxUZXh0dXJlLnNjYWxlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ29jY2x1c2lvblRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBvY2NsdXNpb25UZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLm9jY2x1c2lvblRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmFvTWFwID0gdGV4dHVyZXNbb2NjbHVzaW9uVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmFvTWFwQ2hhbm5lbCA9ICdyJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShvY2NsdXNpb25UZXh0dXJlLCBtYXRlcmlhbCwgWydhbyddKTtcbiAgICAgICAgLy8gVE9ETzogc3VwcG9ydCAnc3RyZW5ndGgnXG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBnbHRmTWF0ZXJpYWwuZW1pc3NpdmVGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmUuc2V0KDAsIDAsIDApO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgZW1pc3NpdmVUZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLmVtaXNzaXZlVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSB0ZXh0dXJlc1tlbWlzc2l2ZVRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGVtaXNzaXZlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZW1pc3NpdmUnXSk7XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2FscGhhTW9kZScpKSB7XG4gICAgICAgIHN3aXRjaCAoZ2x0Zk1hdGVyaWFsLmFscGhhTW9kZSkge1xuICAgICAgICAgICAgY2FzZSAnTUFTSyc6XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdhbHBoYUN1dG9mZicpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFscGhhVGVzdCA9IGdsdGZNYXRlcmlhbC5hbHBoYUN1dG9mZjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbHBoYVRlc3QgPSAwLjU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnQkxFTkQnOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICAgICAgICAgICAgICAvLyBub3RlOiBieSBkZWZhdWx0IGRvbid0IHdyaXRlIGRlcHRoIG9uIHNlbWl0cmFuc3BhcmVudCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5kZXB0aFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgY2FzZSAnT1BBUVVFJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT05FO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdkb3VibGVTaWRlZCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLnR3b1NpZGVkTGlnaHRpbmcgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQ7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQgPyBDVUxMRkFDRV9OT05FIDogQ1VMTEZBQ0VfQkFDSztcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC50d29TaWRlZExpZ2h0aW5nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9CQUNLO1xuICAgIH1cblxuICAgIC8vIFByb3ZpZGUgbGlzdCBvZiBzdXBwb3J0ZWQgZXh0ZW5zaW9ucyBhbmQgdGhlaXIgZnVuY3Rpb25zXG4gICAgY29uc3QgZXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2NsZWFyY29hdFwiOiBleHRlbnNpb25DbGVhckNvYXQsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19lbWlzc2l2ZV9zdHJlbmd0aFwiOiBleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfaW9yXCI6IGV4dGVuc2lvbklvcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2lyaWRlc2NlbmNlXCI6IGV4dGVuc2lvbklyaWRlc2NlbmNlLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfcGJyU3BlY3VsYXJHbG9zc2luZXNzXCI6IGV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfc2hlZW5cIjogZXh0ZW5zaW9uU2hlZW4sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19zcGVjdWxhclwiOiBleHRlbnNpb25TcGVjdWxhcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3RyYW5zbWlzc2lvblwiOiBleHRlbnNpb25UcmFuc21pc3Npb24sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc191bmxpdFwiOiBleHRlbnNpb25VbmxpdCxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3ZvbHVtZVwiOiBleHRlbnNpb25Wb2x1bWVcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIGV4dGVuc2lvbnNcbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZ2x0Zk1hdGVyaWFsLmV4dGVuc2lvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbkZ1bmMgPSBleHRlbnNpb25zW2tleV07XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uRnVuYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZXh0ZW5zaW9uRnVuYyhnbHRmTWF0ZXJpYWwuZXh0ZW5zaW9uc1trZXldLCBtYXRlcmlhbCwgdGV4dHVyZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICByZXR1cm4gbWF0ZXJpYWw7XG59O1xuXG4vLyBjcmVhdGUgdGhlIGFuaW0gc3RydWN0dXJlXG5jb25zdCBjcmVhdGVBbmltYXRpb24gPSBmdW5jdGlvbiAoZ2x0ZkFuaW1hdGlvbiwgYW5pbWF0aW9uSW5kZXgsIGdsdGZBY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgbWVzaGVzLCBnbHRmTm9kZXMpIHtcblxuICAgIC8vIGNyZWF0ZSBhbmltYXRpb24gZGF0YSBibG9jayBmb3IgdGhlIGFjY2Vzc29yXG4gICAgY29uc3QgY3JlYXRlQW5pbURhdGEgPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yKSB7XG4gICAgICAgIHJldHVybiBuZXcgQW5pbURhdGEoZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSksIGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykpO1xuICAgIH07XG5cbiAgICBjb25zdCBpbnRlcnBNYXAgPSB7XG4gICAgICAgICdTVEVQJzogSU5URVJQT0xBVElPTl9TVEVQLFxuICAgICAgICAnTElORUFSJzogSU5URVJQT0xBVElPTl9MSU5FQVIsXG4gICAgICAgICdDVUJJQ1NQTElORSc6IElOVEVSUE9MQVRJT05fQ1VCSUNcbiAgICB9O1xuXG4gICAgLy8gSW5wdXQgYW5kIG91dHB1dCBtYXBzIHJlZmVyZW5jZSBkYXRhIGJ5IHNhbXBsZXIgaW5wdXQvb3V0cHV0IGtleS5cbiAgICBjb25zdCBpbnB1dE1hcCA9IHsgfTtcbiAgICBjb25zdCBvdXRwdXRNYXAgPSB7IH07XG4gICAgLy8gVGhlIGN1cnZlIG1hcCBzdG9yZXMgdGVtcG9yYXJ5IGN1cnZlIGRhdGEgYnkgc2FtcGxlciBpbmRleC4gRWFjaCBjdXJ2ZXMgaW5wdXQvb3V0cHV0IHZhbHVlIHdpbGwgYmUgcmVzb2x2ZWQgdG8gYW4gaW5wdXRzL291dHB1dHMgYXJyYXkgaW5kZXggYWZ0ZXIgYWxsIHNhbXBsZXJzIGhhdmUgYmVlbiBwcm9jZXNzZWQuXG4gICAgLy8gQ3VydmVzIGFuZCBvdXRwdXRzIHRoYXQgYXJlIGRlbGV0ZWQgZnJvbSB0aGVpciBtYXBzIHdpbGwgbm90IGJlIGluY2x1ZGVkIGluIHRoZSBmaW5hbCBBbmltVHJhY2tcbiAgICBjb25zdCBjdXJ2ZU1hcCA9IHsgfTtcbiAgICBsZXQgb3V0cHV0Q291bnRlciA9IDE7XG5cbiAgICBsZXQgaTtcblxuICAgIC8vIGNvbnZlcnQgc2FtcGxlcnNcbiAgICBmb3IgKGkgPSAwOyBpIDwgZ2x0ZkFuaW1hdGlvbi5zYW1wbGVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBzYW1wbGVyID0gZ2x0ZkFuaW1hdGlvbi5zYW1wbGVyc1tpXTtcblxuICAgICAgICAvLyBnZXQgaW5wdXQgZGF0YVxuICAgICAgICBpZiAoIWlucHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIuaW5wdXQpKSB7XG4gICAgICAgICAgICBpbnB1dE1hcFtzYW1wbGVyLmlucHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5pbnB1dF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG91dHB1dCBkYXRhXG4gICAgICAgIGlmICghb3V0cHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIub3V0cHV0KSkge1xuICAgICAgICAgICAgb3V0cHV0TWFwW3NhbXBsZXIub3V0cHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5vdXRwdXRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGludGVycG9sYXRpb24gPVxuICAgICAgICAgICAgc2FtcGxlci5oYXNPd25Qcm9wZXJ0eSgnaW50ZXJwb2xhdGlvbicpICYmXG4gICAgICAgICAgICBpbnRlcnBNYXAuaGFzT3duUHJvcGVydHkoc2FtcGxlci5pbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgaW50ZXJwTWFwW3NhbXBsZXIuaW50ZXJwb2xhdGlvbl0gOiBJTlRFUlBPTEFUSU9OX0xJTkVBUjtcblxuICAgICAgICAvLyBjcmVhdGUgY3VydmVcbiAgICAgICAgY29uc3QgY3VydmUgPSB7XG4gICAgICAgICAgICBwYXRoczogW10sXG4gICAgICAgICAgICBpbnB1dDogc2FtcGxlci5pbnB1dCxcbiAgICAgICAgICAgIG91dHB1dDogc2FtcGxlci5vdXRwdXQsXG4gICAgICAgICAgICBpbnRlcnBvbGF0aW9uOiBpbnRlcnBvbGF0aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgY3VydmVNYXBbaV0gPSBjdXJ2ZTtcbiAgICB9XG5cbiAgICBjb25zdCBxdWF0QXJyYXlzID0gW107XG5cbiAgICBjb25zdCB0cmFuc2Zvcm1TY2hlbWEgPSB7XG4gICAgICAgICd0cmFuc2xhdGlvbic6ICdsb2NhbFBvc2l0aW9uJyxcbiAgICAgICAgJ3JvdGF0aW9uJzogJ2xvY2FsUm90YXRpb24nLFxuICAgICAgICAnc2NhbGUnOiAnbG9jYWxTY2FsZSdcbiAgICB9O1xuXG4gICAgY29uc3QgY29uc3RydWN0Tm9kZVBhdGggPSAobm9kZSkgPT4ge1xuICAgICAgICBjb25zdCBwYXRoID0gW107XG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBwYXRoLnVuc2hpZnQobm9kZS5uYW1lKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnBhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICB9O1xuXG4gICAgY29uc3QgcmV0cmlldmVXZWlnaHROYW1lID0gKGdsdGZOb2RlLCB3ZWlnaHRJbmRleCkgPT4ge1xuICAgICAgICBpZiAobWVzaGVzICYmIG1lc2hlc1tnbHRmTm9kZS5tZXNoXSkge1xuICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hlc1tnbHRmTm9kZS5tZXNoXTtcbiAgICAgICAgICAgIGlmIChtZXNoLmhhc093blByb3BlcnR5KCdleHRyYXMnKSAmJiBtZXNoLmV4dHJhcy5oYXNPd25Qcm9wZXJ0eSgndGFyZ2V0TmFtZXMnKSAmJiBtZXNoLmV4dHJhcy50YXJnZXROYW1lc1t3ZWlnaHRJbmRleF0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYG5hbWUuJHttZXNoLmV4dHJhcy50YXJnZXROYW1lc1t3ZWlnaHRJbmRleF19YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB3ZWlnaHRJbmRleDtcbiAgICB9O1xuXG4gICAgLy8gQWxsIG1vcnBoIHRhcmdldHMgYXJlIGluY2x1ZGVkIGluIGEgc2luZ2xlIGNoYW5uZWwgb2YgdGhlIGFuaW1hdGlvbiwgd2l0aCBhbGwgdGFyZ2V0cyBvdXRwdXQgZGF0YSBpbnRlcmxlYXZlZCB3aXRoIGVhY2ggb3RoZXIuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzcGxpdHMgZWFjaCBtb3JwaCB0YXJnZXQgb3V0IGludG8gaXQgYSBjdXJ2ZSB3aXRoIGl0cyBvd24gb3V0cHV0IGRhdGEsIGFsbG93aW5nIHVzIHRvIGFuaW1hdGUgZWFjaCBtb3JwaCB0YXJnZXQgaW5kZXBlbmRlbnRseSBieSBuYW1lLlxuICAgIGNvbnN0IGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzID0gKGN1cnZlLCBnbHRmTm9kZSwgZW50aXR5UGF0aCkgPT4ge1xuICAgICAgICBjb25zdCBvdXQgPSBvdXRwdXRNYXBbY3VydmUub3V0cHV0XTtcbiAgICAgICAgaWYgKCFvdXQpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGdsYi1wYXJzZXI6IE5vIG91dHB1dCBkYXRhIGlzIGF2YWlsYWJsZSBmb3IgdGhlIG1vcnBoIHRhcmdldCBjdXJ2ZSAoJHtlbnRpdHlQYXRofS9ncmFwaC93ZWlnaHRzKS4gU2tpcHBpbmcuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb3V0RGF0YSA9IG91dC5kYXRhO1xuICAgICAgICBjb25zdCBtb3JwaFRhcmdldENvdW50ID0gb3V0RGF0YS5sZW5ndGggLyBpbnB1dE1hcFtjdXJ2ZS5pbnB1dF0uZGF0YS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGtleWZyYW1lQ291bnQgPSBvdXREYXRhLmxlbmd0aCAvIG1vcnBoVGFyZ2V0Q291bnQ7XG5cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBtb3JwaFRhcmdldENvdW50OyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0T3V0cHV0ID0gbmV3IEZsb2F0MzJBcnJheShrZXlmcmFtZUNvdW50KTtcbiAgICAgICAgICAgIC8vIHRoZSBvdXRwdXQgZGF0YSBmb3IgYWxsIG1vcnBoIHRhcmdldHMgaW4gYSBzaW5nbGUgY3VydmUgaXMgaW50ZXJsZWF2ZWQuIFdlIG5lZWQgdG8gcmV0cmlldmUgdGhlIGtleWZyYW1lIG91dHB1dCBkYXRhIGZvciBhIHNpbmdsZSBtb3JwaCB0YXJnZXRcbiAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwga2V5ZnJhbWVDb3VudDsgaysrKSB7XG4gICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRPdXRwdXRba10gPSBvdXREYXRhW2sgKiBtb3JwaFRhcmdldENvdW50ICsgal07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBvdXRwdXQgPSBuZXcgQW5pbURhdGEoMSwgbW9ycGhUYXJnZXRPdXRwdXQpO1xuICAgICAgICAgICAgLy8gYWRkIHRoZSBpbmRpdmlkdWFsIG1vcnBoIHRhcmdldCBvdXRwdXQgZGF0YSB0byB0aGUgb3V0cHV0TWFwIHVzaW5nIGEgbmVnYXRpdmUgdmFsdWUga2V5IChzbyBhcyBub3QgdG8gY2xhc2ggd2l0aCBzYW1wbGVyLm91dHB1dCB2YWx1ZXMpXG4gICAgICAgICAgICBvdXRwdXRNYXBbLW91dHB1dENvdW50ZXJdID0gb3V0cHV0O1xuICAgICAgICAgICAgY29uc3QgbW9ycGhDdXJ2ZSA9IHtcbiAgICAgICAgICAgICAgICBwYXRoczogW3tcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5UGF0aDogZW50aXR5UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50OiAnZ3JhcGgnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6IFtgd2VpZ2h0LiR7cmV0cmlldmVXZWlnaHROYW1lKGdsdGZOb2RlLCBqKX1gXVxuICAgICAgICAgICAgICAgIH1dLFxuICAgICAgICAgICAgICAgIC8vIGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIGlucHV0IGNhbiB1c2UgdGhlIHNhbWUgc2FtcGxlci5pbnB1dCBmcm9tIHRoZSBjaGFubmVsIHRoZXkgd2VyZSBhbGwgaW5cbiAgICAgICAgICAgICAgICBpbnB1dDogY3VydmUuaW5wdXQsXG4gICAgICAgICAgICAgICAgLy8gYnV0IGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIHNob3VsZCByZWZlcmVuY2UgaXRzIGluZGl2aWR1YWwgb3V0cHV0IHRoYXQgd2FzIGp1c3QgY3JlYXRlZFxuICAgICAgICAgICAgICAgIG91dHB1dDogLW91dHB1dENvdW50ZXIsXG4gICAgICAgICAgICAgICAgaW50ZXJwb2xhdGlvbjogY3VydmUuaW50ZXJwb2xhdGlvblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG91dHB1dENvdW50ZXIrKztcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgbW9ycGggdGFyZ2V0IGN1cnZlIHRvIHRoZSBjdXJ2ZU1hcFxuICAgICAgICAgICAgY3VydmVNYXBbYG1vcnBoQ3VydmUtJHtpfS0ke2p9YF0gPSBtb3JwaEN1cnZlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGNvbnZlcnQgYW5pbSBjaGFubmVsc1xuICAgIGZvciAoaSA9IDA7IGkgPCBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzW2ldO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBjaGFubmVsLnRhcmdldDtcbiAgICAgICAgY29uc3QgY3VydmUgPSBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdO1xuXG4gICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1t0YXJnZXQubm9kZV07XG4gICAgICAgIGNvbnN0IGdsdGZOb2RlID0gZ2x0Zk5vZGVzW3RhcmdldC5ub2RlXTtcbiAgICAgICAgY29uc3QgZW50aXR5UGF0aCA9IGNvbnN0cnVjdE5vZGVQYXRoKG5vZGUpO1xuXG4gICAgICAgIGlmICh0YXJnZXQucGF0aC5zdGFydHNXaXRoKCd3ZWlnaHRzJykpIHtcbiAgICAgICAgICAgIGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzKGN1cnZlLCBnbHRmTm9kZSwgZW50aXR5UGF0aCk7XG4gICAgICAgICAgICAvLyBhcyBhbGwgaW5kaXZpZHVhbCBtb3JwaCB0YXJnZXRzIGluIHRoaXMgbW9ycGggY3VydmUgaGF2ZSB0aGVpciBvd24gY3VydmUgbm93LCB0aGlzIG1vcnBoIGN1cnZlIHNob3VsZCBiZSBmbGFnZ2VkXG4gICAgICAgICAgICAvLyBzbyBpdCdzIG5vdCBpbmNsdWRlZCBpbiB0aGUgZmluYWwgb3V0cHV0XG4gICAgICAgICAgICBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdLm1vcnBoQ3VydmUgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3VydmUucGF0aHMucHVzaCh7XG4gICAgICAgICAgICAgICAgZW50aXR5UGF0aDogZW50aXR5UGF0aCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnQ6ICdncmFwaCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoOiBbdHJhbnNmb3JtU2NoZW1hW3RhcmdldC5wYXRoXV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBjb25zdCBpbnB1dHMgPSBbXTtcbiAgICBjb25zdCBvdXRwdXRzID0gW107XG4gICAgY29uc3QgY3VydmVzID0gW107XG5cbiAgICAvLyBBZGQgZWFjaCBpbnB1dCBpbiB0aGUgbWFwIHRvIHRoZSBmaW5hbCBpbnB1dHMgYXJyYXkuIFRoZSBpbnB1dE1hcCBzaG91bGQgbm93IHJlZmVyZW5jZSB0aGUgaW5kZXggb2YgaW5wdXQgaW4gdGhlIGlucHV0cyBhcnJheSBpbnN0ZWFkIG9mIHRoZSBpbnB1dCBpdHNlbGYuXG4gICAgZm9yIChjb25zdCBpbnB1dEtleSBpbiBpbnB1dE1hcCkge1xuICAgICAgICBpbnB1dHMucHVzaChpbnB1dE1hcFtpbnB1dEtleV0pO1xuICAgICAgICBpbnB1dE1hcFtpbnB1dEtleV0gPSBpbnB1dHMubGVuZ3RoIC0gMTtcbiAgICB9XG4gICAgLy8gQWRkIGVhY2ggb3V0cHV0IGluIHRoZSBtYXAgdG8gdGhlIGZpbmFsIG91dHB1dHMgYXJyYXkuIFRoZSBvdXRwdXRNYXAgc2hvdWxkIG5vdyByZWZlcmVuY2UgdGhlIGluZGV4IG9mIG91dHB1dCBpbiB0aGUgb3V0cHV0cyBhcnJheSBpbnN0ZWFkIG9mIHRoZSBvdXRwdXQgaXRzZWxmLlxuICAgIGZvciAoY29uc3Qgb3V0cHV0S2V5IGluIG91dHB1dE1hcCkge1xuICAgICAgICBvdXRwdXRzLnB1c2gob3V0cHV0TWFwW291dHB1dEtleV0pO1xuICAgICAgICBvdXRwdXRNYXBbb3V0cHV0S2V5XSA9IG91dHB1dHMubGVuZ3RoIC0gMTtcbiAgICB9XG4gICAgLy8gQ3JlYXRlIGFuIEFuaW1DdXJ2ZSBmb3IgZWFjaCBjdXJ2ZSBvYmplY3QgaW4gdGhlIGN1cnZlTWFwLiBFYWNoIGN1cnZlIG9iamVjdCdzIGlucHV0IHZhbHVlIHNob3VsZCBiZSByZXNvbHZlZCB0byB0aGUgaW5kZXggb2YgdGhlIGlucHV0IGluIHRoZVxuICAgIC8vIGlucHV0cyBhcnJheXMgdXNpbmcgdGhlIGlucHV0TWFwLiBMaWtld2lzZSBmb3Igb3V0cHV0IHZhbHVlcy5cbiAgICBmb3IgKGNvbnN0IGN1cnZlS2V5IGluIGN1cnZlTWFwKSB7XG4gICAgICAgIGNvbnN0IGN1cnZlRGF0YSA9IGN1cnZlTWFwW2N1cnZlS2V5XTtcbiAgICAgICAgLy8gaWYgdGhlIGN1cnZlRGF0YSBjb250YWlucyBhIG1vcnBoIGN1cnZlIHRoZW4gZG8gbm90IGFkZCBpdCB0byB0aGUgZmluYWwgY3VydmUgbGlzdCBhcyB0aGUgaW5kaXZpZHVhbCBtb3JwaCB0YXJnZXQgY3VydmVzIGFyZSBpbmNsdWRlZCBpbnN0ZWFkXG4gICAgICAgIGlmIChjdXJ2ZURhdGEubW9ycGhDdXJ2ZSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgY3VydmVzLnB1c2gobmV3IEFuaW1DdXJ2ZShcbiAgICAgICAgICAgIGN1cnZlRGF0YS5wYXRocyxcbiAgICAgICAgICAgIGlucHV0TWFwW2N1cnZlRGF0YS5pbnB1dF0sXG4gICAgICAgICAgICBvdXRwdXRNYXBbY3VydmVEYXRhLm91dHB1dF0sXG4gICAgICAgICAgICBjdXJ2ZURhdGEuaW50ZXJwb2xhdGlvblxuICAgICAgICApKTtcblxuICAgICAgICAvLyBpZiB0aGlzIHRhcmdldCBpcyBhIHNldCBvZiBxdWF0ZXJuaW9uIGtleXMsIG1ha2Ugbm90ZSBvZiBpdHMgaW5kZXggc28gd2UgY2FuIHBlcmZvcm1cbiAgICAgICAgLy8gcXVhdGVybmlvbi1zcGVjaWZpYyBwcm9jZXNzaW5nIG9uIGl0LlxuICAgICAgICBpZiAoY3VydmVEYXRhLnBhdGhzLmxlbmd0aCA+IDAgJiYgY3VydmVEYXRhLnBhdGhzWzBdLnByb3BlcnR5UGF0aFswXSA9PT0gJ2xvY2FsUm90YXRpb24nICYmIGN1cnZlRGF0YS5pbnRlcnBvbGF0aW9uICE9PSBJTlRFUlBPTEFUSU9OX0NVQklDKSB7XG4gICAgICAgICAgICBxdWF0QXJyYXlzLnB1c2goY3VydmVzW2N1cnZlcy5sZW5ndGggLSAxXS5vdXRwdXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc29ydCB0aGUgbGlzdCBvZiBhcnJheSBpbmRleGVzIHNvIHdlIGNhbiBza2lwIGR1cHNcbiAgICBxdWF0QXJyYXlzLnNvcnQoKTtcblxuICAgIC8vIHJ1biB0aHJvdWdoIHRoZSBxdWF0ZXJuaW9uIGRhdGEgYXJyYXlzIGZsaXBwaW5nIHF1YXRlcm5pb24ga2V5c1xuICAgIC8vIHRoYXQgZG9uJ3QgZmFsbCBpbiB0aGUgc2FtZSB3aW5kaW5nIG9yZGVyLlxuICAgIGxldCBwcmV2SW5kZXggPSBudWxsO1xuICAgIGxldCBkYXRhO1xuICAgIGZvciAoaSA9IDA7IGkgPCBxdWF0QXJyYXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gcXVhdEFycmF5c1tpXTtcbiAgICAgICAgLy8gc2tpcCBvdmVyIGR1cGxpY2F0ZSBhcnJheSBpbmRpY2VzXG4gICAgICAgIGlmIChpID09PSAwIHx8IGluZGV4ICE9PSBwcmV2SW5kZXgpIHtcbiAgICAgICAgICAgIGRhdGEgPSBvdXRwdXRzW2luZGV4XTtcbiAgICAgICAgICAgIGlmIChkYXRhLmNvbXBvbmVudHMgPT09IDQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkID0gZGF0YS5kYXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxlbiA9IGQubGVuZ3RoIC0gNDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaiArPSA0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRwID0gZFtqICsgMF0gKiBkW2ogKyA0XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDFdICogZFtqICsgNV0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAyXSAqIGRbaiArIDZdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgM10gKiBkW2ogKyA3XTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoZHAgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA0XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDVdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNl0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA3XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByZXZJbmRleCA9IGluZGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY2FsY3VsYXRlIGR1cmF0aW9uIG9mIHRoZSBhbmltYXRpb24gYXMgbWF4aW11bSB0aW1lIHZhbHVlXG4gICAgbGV0IGR1cmF0aW9uID0gMDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgaW5wdXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRhdGEgID0gaW5wdXRzW2ldLl9kYXRhO1xuICAgICAgICBkdXJhdGlvbiA9IE1hdGgubWF4KGR1cmF0aW9uLCBkYXRhLmxlbmd0aCA9PT0gMCA/IDAgOiBkYXRhW2RhdGEubGVuZ3RoIC0gMV0pO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgQW5pbVRyYWNrKFxuICAgICAgICBnbHRmQW5pbWF0aW9uLmhhc093blByb3BlcnR5KCduYW1lJykgPyBnbHRmQW5pbWF0aW9uLm5hbWUgOiAoJ2FuaW1hdGlvbl8nICsgYW5pbWF0aW9uSW5kZXgpLFxuICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgaW5wdXRzLFxuICAgICAgICBvdXRwdXRzLFxuICAgICAgICBjdXJ2ZXMpO1xufTtcblxuY29uc3QgY3JlYXRlTm9kZSA9IGZ1bmN0aW9uIChnbHRmTm9kZSwgbm9kZUluZGV4KSB7XG4gICAgY29uc3QgZW50aXR5ID0gbmV3IEdyYXBoTm9kZSgpO1xuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCduYW1lJykgJiYgZ2x0Zk5vZGUubmFtZS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVudGl0eS5uYW1lID0gZ2x0Zk5vZGUubmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlbnRpdHkubmFtZSA9ICdub2RlXycgKyBub2RlSW5kZXg7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgdHJhbnNmb3JtYXRpb24gcHJvcGVydGllc1xuICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbWF0cml4JykpIHtcbiAgICAgICAgdGVtcE1hdC5kYXRhLnNldChnbHRmTm9kZS5tYXRyaXgpO1xuICAgICAgICB0ZW1wTWF0LmdldFRyYW5zbGF0aW9uKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxQb3NpdGlvbih0ZW1wVmVjKTtcbiAgICAgICAgdGVtcE1hdC5nZXRFdWxlckFuZ2xlcyh0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXModGVtcFZlYyk7XG4gICAgICAgIHRlbXBNYXQuZ2V0U2NhbGUodGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbFNjYWxlKHRlbXBWZWMpO1xuICAgIH1cblxuICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgncm90YXRpb24nKSkge1xuICAgICAgICBjb25zdCByID0gZ2x0Zk5vZGUucm90YXRpb247XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbFJvdGF0aW9uKHJbMF0sIHJbMV0sIHJbMl0sIHJbM10pO1xuICAgIH1cblxuICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNsYXRpb24nKSkge1xuICAgICAgICBjb25zdCB0ID0gZ2x0Zk5vZGUudHJhbnNsYXRpb247XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHRbMF0sIHRbMV0sIHRbMl0pO1xuICAgIH1cblxuICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnc2NhbGUnKSkge1xuICAgICAgICBjb25zdCBzID0gZ2x0Zk5vZGUuc2NhbGU7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbFNjYWxlKHNbMF0sIHNbMV0sIHNbMl0pO1xuICAgIH1cblxuICAgIHJldHVybiBlbnRpdHk7XG59O1xuXG4vLyBjcmVhdGVzIGEgY2FtZXJhIGNvbXBvbmVudCBvbiB0aGUgc3VwcGxpZWQgbm9kZSwgYW5kIHJldHVybnMgaXRcbmNvbnN0IGNyZWF0ZUNhbWVyYSA9IGZ1bmN0aW9uIChnbHRmQ2FtZXJhLCBub2RlKSB7XG5cbiAgICBjb25zdCBwcm9qZWN0aW9uID0gZ2x0ZkNhbWVyYS50eXBlID09PSAnb3J0aG9ncmFwaGljJyA/IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDIDogUFJPSkVDVElPTl9QRVJTUEVDVElWRTtcbiAgICBjb25zdCBnbHRmUHJvcGVydGllcyA9IHByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDID8gZ2x0ZkNhbWVyYS5vcnRob2dyYXBoaWMgOiBnbHRmQ2FtZXJhLnBlcnNwZWN0aXZlO1xuXG4gICAgY29uc3QgY29tcG9uZW50RGF0YSA9IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHByb2plY3Rpb246IHByb2plY3Rpb24sXG4gICAgICAgIG5lYXJDbGlwOiBnbHRmUHJvcGVydGllcy56bmVhcixcbiAgICAgICAgYXNwZWN0UmF0aW9Nb2RlOiBBU1BFQ1RfQVVUT1xuICAgIH07XG5cbiAgICBpZiAoZ2x0ZlByb3BlcnRpZXMuemZhcikge1xuICAgICAgICBjb21wb25lbnREYXRhLmZhckNsaXAgPSBnbHRmUHJvcGVydGllcy56ZmFyO1xuICAgIH1cblxuICAgIGlmIChwcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQykge1xuICAgICAgICBjb21wb25lbnREYXRhLm9ydGhvSGVpZ2h0ID0gMC41ICogZ2x0ZlByb3BlcnRpZXMueW1hZztcbiAgICAgICAgaWYgKGdsdGZQcm9wZXJ0aWVzLnltYWcpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW9Nb2RlID0gQVNQRUNUX01BTlVBTDtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW8gPSBnbHRmUHJvcGVydGllcy54bWFnIC8gZ2x0ZlByb3BlcnRpZXMueW1hZztcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbXBvbmVudERhdGEuZm92ID0gZ2x0ZlByb3BlcnRpZXMueWZvdiAqIG1hdGguUkFEX1RPX0RFRztcbiAgICAgICAgaWYgKGdsdGZQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvKSB7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvTW9kZSA9IEFTUEVDVF9NQU5VQUw7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvID0gZ2x0ZlByb3BlcnRpZXMuYXNwZWN0UmF0aW87XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBjYW1lcmFFbnRpdHkgPSBuZXcgRW50aXR5KGdsdGZDYW1lcmEubmFtZSk7XG4gICAgY2FtZXJhRW50aXR5LmFkZENvbXBvbmVudCgnY2FtZXJhJywgY29tcG9uZW50RGF0YSk7XG4gICAgcmV0dXJuIGNhbWVyYUVudGl0eTtcbn07XG5cbi8vIGNyZWF0ZXMgbGlnaHQgY29tcG9uZW50LCBhZGRzIGl0IHRvIHRoZSBub2RlIGFuZCByZXR1cm5zIHRoZSBjcmVhdGVkIGxpZ2h0IGNvbXBvbmVudFxuY29uc3QgY3JlYXRlTGlnaHQgPSBmdW5jdGlvbiAoZ2x0ZkxpZ2h0LCBub2RlKSB7XG5cbiAgICBjb25zdCBsaWdodFByb3BzID0ge1xuICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgICAgdHlwZTogZ2x0ZkxpZ2h0LnR5cGUgPT09ICdwb2ludCcgPyAnb21uaScgOiBnbHRmTGlnaHQudHlwZSxcbiAgICAgICAgY29sb3I6IGdsdGZMaWdodC5oYXNPd25Qcm9wZXJ0eSgnY29sb3InKSA/IG5ldyBDb2xvcihnbHRmTGlnaHQuY29sb3IpIDogQ29sb3IuV0hJVEUsXG5cbiAgICAgICAgLy8gd2hlbiByYW5nZSBpcyBub3QgZGVmaW5lZCwgaW5maW5pdHkgc2hvdWxkIGJlIHVzZWQgLSBidXQgdGhhdCBpcyBjYXVzaW5nIGluZmluaXR5IGluIGJvdW5kcyBjYWxjdWxhdGlvbnNcbiAgICAgICAgcmFuZ2U6IGdsdGZMaWdodC5oYXNPd25Qcm9wZXJ0eSgncmFuZ2UnKSA/IGdsdGZMaWdodC5yYW5nZSA6IDk5OTksXG5cbiAgICAgICAgZmFsbG9mZk1vZGU6IExJR0hURkFMTE9GRl9JTlZFUlNFU1FVQVJFRCxcblxuICAgICAgICAvLyBUT0RPOiAoZW5naW5lIGlzc3VlICMzMjUyKSBTZXQgaW50ZW5zaXR5IHRvIG1hdGNoIGdsVEYgc3BlY2lmaWNhdGlvbiwgd2hpY2ggdXNlcyBwaHlzaWNhbGx5IGJhc2VkIHZhbHVlczpcbiAgICAgICAgLy8gLSBPbW5pIGFuZCBzcG90IGxpZ2h0cyB1c2UgbHVtaW5vdXMgaW50ZW5zaXR5IGluIGNhbmRlbGEgKGxtL3NyKVxuICAgICAgICAvLyAtIERpcmVjdGlvbmFsIGxpZ2h0cyB1c2UgaWxsdW1pbmFuY2UgaW4gbHV4IChsbS9tMikuXG4gICAgICAgIC8vIEN1cnJlbnQgaW1wbGVtZW50YXRpb246IGNsYXBtcyBzcGVjaWZpZWQgaW50ZW5zaXR5IHRvIDAuLjIgcmFuZ2VcbiAgICAgICAgaW50ZW5zaXR5OiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ2ludGVuc2l0eScpID8gbWF0aC5jbGFtcChnbHRmTGlnaHQuaW50ZW5zaXR5LCAwLCAyKSA6IDFcbiAgICB9O1xuXG4gICAgaWYgKGdsdGZMaWdodC5oYXNPd25Qcm9wZXJ0eSgnc3BvdCcpKSB7XG4gICAgICAgIGxpZ2h0UHJvcHMuaW5uZXJDb25lQW5nbGUgPSBnbHRmTGlnaHQuc3BvdC5oYXNPd25Qcm9wZXJ0eSgnaW5uZXJDb25lQW5nbGUnKSA/IGdsdGZMaWdodC5zcG90LmlubmVyQ29uZUFuZ2xlICogbWF0aC5SQURfVE9fREVHIDogMDtcbiAgICAgICAgbGlnaHRQcm9wcy5vdXRlckNvbmVBbmdsZSA9IGdsdGZMaWdodC5zcG90Lmhhc093blByb3BlcnR5KCdvdXRlckNvbmVBbmdsZScpID8gZ2x0ZkxpZ2h0LnNwb3Qub3V0ZXJDb25lQW5nbGUgKiBtYXRoLlJBRF9UT19ERUcgOiBNYXRoLlBJIC8gNDtcbiAgICB9XG5cbiAgICAvLyBnbFRGIHN0b3JlcyBsaWdodCBhbHJlYWR5IGluIGVuZXJneS9hcmVhLCBidXQgd2UgbmVlZCB0byBwcm92aWRlIHRoZSBsaWdodCB3aXRoIG9ubHkgdGhlIGVuZXJneSBwYXJhbWV0ZXIsXG4gICAgLy8gc28gd2UgbmVlZCB0aGUgaW50ZW5zaXRpZXMgaW4gY2FuZGVsYSBiYWNrIHRvIGx1bWVuXG4gICAgaWYgKGdsdGZMaWdodC5oYXNPd25Qcm9wZXJ0eShcImludGVuc2l0eVwiKSkge1xuICAgICAgICBsaWdodFByb3BzLmx1bWluYW5jZSA9IGdsdGZMaWdodC5pbnRlbnNpdHkgKiBMaWdodC5nZXRMaWdodFVuaXRDb252ZXJzaW9uKGxpZ2h0VHlwZXNbbGlnaHRQcm9wcy50eXBlXSwgbGlnaHRQcm9wcy5vdXRlckNvbmVBbmdsZSwgbGlnaHRQcm9wcy5pbm5lckNvbmVBbmdsZSk7XG4gICAgfVxuXG4gICAgLy8gUm90YXRlIHRvIG1hdGNoIGxpZ2h0IG9yaWVudGF0aW9uIGluIGdsVEYgc3BlY2lmaWNhdGlvblxuICAgIC8vIE5vdGUgdGhhdCB0aGlzIGFkZHMgYSBuZXcgZW50aXR5IG5vZGUgaW50byB0aGUgaGllcmFyY2h5IHRoYXQgZG9lcyBub3QgZXhpc3QgaW4gdGhlIGdsdGYgaGllcmFyY2h5XG4gICAgY29uc3QgbGlnaHRFbnRpdHkgPSBuZXcgRW50aXR5KG5vZGUubmFtZSk7XG4gICAgbGlnaHRFbnRpdHkucm90YXRlTG9jYWwoOTAsIDAsIDApO1xuXG4gICAgLy8gYWRkIGNvbXBvbmVudFxuICAgIGxpZ2h0RW50aXR5LmFkZENvbXBvbmVudCgnbGlnaHQnLCBsaWdodFByb3BzKTtcbiAgICByZXR1cm4gbGlnaHRFbnRpdHk7XG59O1xuXG5jb25zdCBjcmVhdGVTa2lucyA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3cykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnc2tpbnMnKSB8fCBnbHRmLnNraW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgLy8gY2FjaGUgZm9yIHNraW5zIHRvIGZpbHRlciBvdXQgZHVwbGljYXRlc1xuICAgIGNvbnN0IGdsYlNraW5zID0gbmV3IE1hcCgpO1xuXG4gICAgcmV0dXJuIGdsdGYuc2tpbnMubWFwKGZ1bmN0aW9uIChnbHRmU2tpbikge1xuICAgICAgICByZXR1cm4gY3JlYXRlU2tpbihkZXZpY2UsIGdsdGZTa2luLCBnbHRmLmFjY2Vzc29ycywgYnVmZmVyVmlld3MsIG5vZGVzLCBnbGJTa2lucyk7XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVNZXNoZXMgPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgY2FsbGJhY2ssIGZsaXBWLCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBvcHRpb25zKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdtZXNoZXMnKSB8fCBnbHRmLm1lc2hlcy5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgIWdsdGYuaGFzT3duUHJvcGVydHkoJ2FjY2Vzc29ycycpIHx8IGdsdGYuYWNjZXNzb3JzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAhZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnYnVmZmVyVmlld3MnKSB8fCBnbHRmLmJ1ZmZlclZpZXdzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuc2tpcE1lc2hlcykge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgLy8gZGljdGlvbmFyeSBvZiB2ZXJ0ZXggYnVmZmVycyB0byBhdm9pZCBkdXBsaWNhdGVzXG4gICAgY29uc3QgdmVydGV4QnVmZmVyRGljdCA9IHt9O1xuXG4gICAgcmV0dXJuIGdsdGYubWVzaGVzLm1hcChmdW5jdGlvbiAoZ2x0Zk1lc2gpIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1lc2goZGV2aWNlLCBnbHRmTWVzaCwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBjYWxsYmFjaywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIG9wdGlvbnMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlTWF0ZXJpYWxzID0gZnVuY3Rpb24gKGdsdGYsIHRleHR1cmVzLCBvcHRpb25zLCBmbGlwVikge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnbWF0ZXJpYWxzJykgfHwgZ2x0Zi5tYXRlcmlhbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm1hdGVyaWFsICYmIG9wdGlvbnMubWF0ZXJpYWwucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm1hdGVyaWFsICYmIG9wdGlvbnMubWF0ZXJpYWwucHJvY2VzcyB8fCBjcmVhdGVNYXRlcmlhbDtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5tYXRlcmlhbCAmJiBvcHRpb25zLm1hdGVyaWFsLnBvc3Rwcm9jZXNzO1xuXG4gICAgcmV0dXJuIGdsdGYubWF0ZXJpYWxzLm1hcChmdW5jdGlvbiAoZ2x0Zk1hdGVyaWFsKSB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZNYXRlcmlhbCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBwcm9jZXNzKGdsdGZNYXRlcmlhbCwgdGV4dHVyZXMsIGZsaXBWKTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTWF0ZXJpYWwsIG1hdGVyaWFsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF0ZXJpYWw7XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVWYXJpYW50cyA9IGZ1bmN0aW9uIChnbHRmKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KFwiZXh0ZW5zaW9uc1wiKSB8fCAhZ2x0Zi5leHRlbnNpb25zLmhhc093blByb3BlcnR5KFwiS0hSX21hdGVyaWFsc192YXJpYW50c1wiKSlcbiAgICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBkYXRhID0gZ2x0Zi5leHRlbnNpb25zLktIUl9tYXRlcmlhbHNfdmFyaWFudHMudmFyaWFudHM7XG4gICAgY29uc3QgdmFyaWFudHMgPSB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyaWFudHNbZGF0YVtpXS5uYW1lXSA9IGk7XG4gICAgfVxuICAgIHJldHVybiB2YXJpYW50cztcbn07XG5cbmNvbnN0IGNyZWF0ZUFuaW1hdGlvbnMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzLCBvcHRpb25zKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdhbmltYXRpb25zJykgfHwgZ2x0Zi5hbmltYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5hbmltYXRpb24gJiYgb3B0aW9ucy5hbmltYXRpb24ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5hbmltYXRpb24gJiYgb3B0aW9ucy5hbmltYXRpb24ucG9zdHByb2Nlc3M7XG5cbiAgICByZXR1cm4gZ2x0Zi5hbmltYXRpb25zLm1hcChmdW5jdGlvbiAoZ2x0ZkFuaW1hdGlvbiwgaW5kZXgpIHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZkFuaW1hdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYW5pbWF0aW9uID0gY3JlYXRlQW5pbWF0aW9uKGdsdGZBbmltYXRpb24sIGluZGV4LCBnbHRmLmFjY2Vzc29ycywgYnVmZmVyVmlld3MsIG5vZGVzLCBnbHRmLm1lc2hlcywgZ2x0Zi5ub2Rlcyk7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkFuaW1hdGlvbiwgYW5pbWF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYW5pbWF0aW9uO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlTm9kZXMgPSBmdW5jdGlvbiAoZ2x0Ziwgb3B0aW9ucykge1xuICAgIGlmICghZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnbm9kZXMnKSB8fCBnbHRmLm5vZGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5ub2RlICYmIG9wdGlvbnMubm9kZS5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubm9kZSAmJiBvcHRpb25zLm5vZGUucHJvY2VzcyB8fCBjcmVhdGVOb2RlO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm5vZGUgJiYgb3B0aW9ucy5ub2RlLnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3Qgbm9kZXMgPSBnbHRmLm5vZGVzLm1hcChmdW5jdGlvbiAoZ2x0Zk5vZGUsIGluZGV4KSB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZOb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBub2RlID0gcHJvY2VzcyhnbHRmTm9kZSwgaW5kZXgpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZOb2RlLCBub2RlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICB9KTtcblxuICAgIC8vIGJ1aWxkIG5vZGUgaGllcmFyY2h5XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbHRmLm5vZGVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGdsdGZOb2RlID0gZ2x0Zi5ub2Rlc1tpXTtcbiAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdjaGlsZHJlbicpKSB7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBub2Rlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHVuaXF1ZU5hbWVzID0geyB9O1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBnbHRmTm9kZS5jaGlsZHJlbi5sZW5ndGg7ICsraikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gbm9kZXNbZ2x0Zk5vZGUuY2hpbGRyZW5bal1dO1xuICAgICAgICAgICAgICAgIGlmICghY2hpbGQucGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh1bmlxdWVOYW1lcy5oYXNPd25Qcm9wZXJ0eShjaGlsZC5uYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGQubmFtZSArPSB1bmlxdWVOYW1lc1tjaGlsZC5uYW1lXSsrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgdW5pcXVlTmFtZXNbY2hpbGQubmFtZV0gPSAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudC5hZGRDaGlsZChjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGVzO1xufTtcblxuY29uc3QgY3JlYXRlU2NlbmVzID0gZnVuY3Rpb24gKGdsdGYsIG5vZGVzKSB7XG4gICAgY29uc3Qgc2NlbmVzID0gW107XG4gICAgY29uc3QgY291bnQgPSBnbHRmLnNjZW5lcy5sZW5ndGg7XG5cbiAgICAvLyBpZiB0aGVyZSdzIGEgc2luZ2xlIHNjZW5lIHdpdGggYSBzaW5nbGUgbm9kZSBpbiBpdCwgZG9uJ3QgY3JlYXRlIHdyYXBwZXIgbm9kZXNcbiAgICBpZiAoY291bnQgPT09IDEgJiYgZ2x0Zi5zY2VuZXNbMF0ubm9kZXM/Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICBjb25zdCBub2RlSW5kZXggPSBnbHRmLnNjZW5lc1swXS5ub2Rlc1swXTtcbiAgICAgICAgc2NlbmVzLnB1c2gobm9kZXNbbm9kZUluZGV4XSk7XG4gICAgfSBlbHNlIHtcblxuICAgICAgICAvLyBjcmVhdGUgcm9vdCBub2RlIHBlciBzY2VuZVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZ2x0Zi5zY2VuZXNbaV07XG4gICAgICAgICAgICBpZiAoc2NlbmUubm9kZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzY2VuZVJvb3QgPSBuZXcgR3JhcGhOb2RlKHNjZW5lLm5hbWUpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IG4gPSAwOyBuIDwgc2NlbmUubm9kZXMubGVuZ3RoOyBuKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2hpbGROb2RlID0gbm9kZXNbc2NlbmUubm9kZXNbbl1dO1xuICAgICAgICAgICAgICAgICAgICBzY2VuZVJvb3QuYWRkQ2hpbGQoY2hpbGROb2RlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2NlbmVzLnB1c2goc2NlbmVSb290KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBzY2VuZXM7XG59O1xuXG5jb25zdCBjcmVhdGVDYW1lcmFzID0gZnVuY3Rpb24gKGdsdGYsIG5vZGVzLCBvcHRpb25zKSB7XG5cbiAgICBsZXQgY2FtZXJhcyA9IG51bGw7XG5cbiAgICBpZiAoZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnbm9kZXMnKSAmJiBnbHRmLmhhc093blByb3BlcnR5KCdjYW1lcmFzJykgJiYgZ2x0Zi5jYW1lcmFzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhbWVyYSAmJiBvcHRpb25zLmNhbWVyYS5wcmVwcm9jZXNzO1xuICAgICAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmNhbWVyYSAmJiBvcHRpb25zLmNhbWVyYS5wcm9jZXNzIHx8IGNyZWF0ZUNhbWVyYTtcbiAgICAgICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuY2FtZXJhICYmIG9wdGlvbnMuY2FtZXJhLnBvc3Rwcm9jZXNzO1xuXG4gICAgICAgIGdsdGYubm9kZXMuZm9yRWFjaChmdW5jdGlvbiAoZ2x0Zk5vZGUsIG5vZGVJbmRleCkge1xuICAgICAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdjYW1lcmEnKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZDYW1lcmEgPSBnbHRmLmNhbWVyYXNbZ2x0Zk5vZGUuY2FtZXJhXTtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0ZkNhbWVyYSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQ2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBwcm9jZXNzKGdsdGZDYW1lcmEsIG5vZGVzW25vZGVJbmRleF0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZDYW1lcmEsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBhZGQgdGhlIGNhbWVyYSB0byBub2RlLT5jYW1lcmEgbWFwXG4gICAgICAgICAgICAgICAgICAgIGlmIChjYW1lcmEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghY2FtZXJhcykgY2FtZXJhcyA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbWVyYXMuc2V0KGdsdGZOb2RlLCBjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gY2FtZXJhcztcbn07XG5cbmNvbnN0IGNyZWF0ZUxpZ2h0cyA9IGZ1bmN0aW9uIChnbHRmLCBub2Rlcywgb3B0aW9ucykge1xuXG4gICAgbGV0IGxpZ2h0cyA9IG51bGw7XG5cbiAgICBpZiAoZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnbm9kZXMnKSAmJiBnbHRmLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykgJiZcbiAgICAgICAgZ2x0Zi5leHRlbnNpb25zLmhhc093blByb3BlcnR5KCdLSFJfbGlnaHRzX3B1bmN0dWFsJykgJiYgZ2x0Zi5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwuaGFzT3duUHJvcGVydHkoJ2xpZ2h0cycpKSB7XG5cbiAgICAgICAgY29uc3QgZ2x0ZkxpZ2h0cyA9IGdsdGYuZXh0ZW5zaW9ucy5LSFJfbGlnaHRzX3B1bmN0dWFsLmxpZ2h0cztcbiAgICAgICAgaWYgKGdsdGZMaWdodHMubGVuZ3RoKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubGlnaHQgJiYgb3B0aW9ucy5saWdodC5wcmVwcm9jZXNzO1xuICAgICAgICAgICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5saWdodCAmJiBvcHRpb25zLmxpZ2h0LnByb2Nlc3MgfHwgY3JlYXRlTGlnaHQ7XG4gICAgICAgICAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5saWdodCAmJiBvcHRpb25zLmxpZ2h0LnBvc3Rwcm9jZXNzO1xuXG4gICAgICAgICAgICAvLyBoYW5kbGUgbm9kZXMgd2l0aCBsaWdodHNcbiAgICAgICAgICAgIGdsdGYubm9kZXMuZm9yRWFjaChmdW5jdGlvbiAoZ2x0Zk5vZGUsIG5vZGVJbmRleCkge1xuICAgICAgICAgICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnZXh0ZW5zaW9ucycpICYmXG4gICAgICAgICAgICAgICAgICAgIGdsdGZOb2RlLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9saWdodHNfcHVuY3R1YWwnKSAmJlxuICAgICAgICAgICAgICAgICAgICBnbHRmTm9kZS5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwuaGFzT3duUHJvcGVydHkoJ2xpZ2h0JykpIHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodEluZGV4ID0gZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5LSFJfbGlnaHRzX3B1bmN0dWFsLmxpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBnbHRmTGlnaHQgPSBnbHRmTGlnaHRzW2xpZ2h0SW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0ZkxpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZkxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gcHJvY2VzcyhnbHRmTGlnaHQsIG5vZGVzW25vZGVJbmRleF0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkxpZ2h0LCBsaWdodCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgbGlnaHQgdG8gbm9kZS0+bGlnaHQgbWFwXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWxpZ2h0cykgbGlnaHRzID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0cy5zZXQoZ2x0Zk5vZGUsIGxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGxpZ2h0cztcbn07XG5cbi8vIGxpbmsgc2tpbnMgdG8gdGhlIG1lc2hlc1xuY29uc3QgbGlua1NraW5zID0gZnVuY3Rpb24gKGdsdGYsIHJlbmRlcnMsIHNraW5zKSB7XG4gICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKChnbHRmTm9kZSkgPT4ge1xuICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ21lc2gnKSAmJiBnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnc2tpbicpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoR3JvdXAgPSByZW5kZXJzW2dsdGZOb2RlLm1lc2hdLm1lc2hlcztcbiAgICAgICAgICAgIG1lc2hHcm91cC5mb3JFYWNoKChtZXNoKSA9PiB7XG4gICAgICAgICAgICAgICAgbWVzaC5za2luID0gc2tpbnNbZ2x0Zk5vZGUuc2tpbl07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLy8gY3JlYXRlIGVuZ2luZSByZXNvdXJjZXMgZnJvbSB0aGUgZG93bmxvYWRlZCBHTEIgZGF0YVxuY29uc3QgY3JlYXRlUmVzb3VyY2VzID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIHRleHR1cmVBc3NldHMsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5nbG9iYWwgJiYgb3B0aW9ucy5nbG9iYWwucHJlcHJvY2VzcztcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5nbG9iYWwgJiYgb3B0aW9ucy5nbG9iYWwucG9zdHByb2Nlc3M7XG5cbiAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICBwcmVwcm9jZXNzKGdsdGYpO1xuICAgIH1cblxuICAgIC8vIFRoZSBvcmlnaW5hbCB2ZXJzaW9uIG9mIEZBQ1QgZ2VuZXJhdGVkIGluY29ycmVjdGx5IGZsaXBwZWQgViB0ZXh0dXJlXG4gICAgLy8gY29vcmRpbmF0ZXMuIFdlIG11c3QgY29tcGVuc2F0ZSBieSBmbGlwcGluZyBWIGluIHRoaXMgY2FzZS4gT25jZVxuICAgIC8vIGFsbCBtb2RlbHMgaGF2ZSBiZWVuIHJlLWV4cG9ydGVkIHdlIGNhbiByZW1vdmUgdGhpcyBmbGFnLlxuICAgIGNvbnN0IGZsaXBWID0gZ2x0Zi5hc3NldCAmJiBnbHRmLmFzc2V0LmdlbmVyYXRvciA9PT0gJ1BsYXlDYW52YXMnO1xuXG4gICAgLy8gV2UnZCBsaWtlIHRvIHJlbW92ZSB0aGUgZmxpcFYgY29kZSBhdCBzb21lIHBvaW50LlxuICAgIGlmIChmbGlwVikge1xuICAgICAgICBEZWJ1Zy53YXJuKCdnbFRGIG1vZGVsIG1heSBoYXZlIGZsaXBwZWQgVVZzLiBQbGVhc2UgcmVjb252ZXJ0LicpO1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVzID0gY3JlYXRlTm9kZXMoZ2x0Ziwgb3B0aW9ucyk7XG4gICAgY29uc3Qgc2NlbmVzID0gY3JlYXRlU2NlbmVzKGdsdGYsIG5vZGVzKTtcbiAgICBjb25zdCBsaWdodHMgPSBjcmVhdGVMaWdodHMoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IGNhbWVyYXMgPSBjcmVhdGVDYW1lcmFzKGdsdGYsIG5vZGVzLCBvcHRpb25zKTtcbiAgICBjb25zdCBhbmltYXRpb25zID0gY3JlYXRlQW5pbWF0aW9ucyhnbHRmLCBub2RlcywgYnVmZmVyVmlld3MsIG9wdGlvbnMpO1xuICAgIGNvbnN0IG1hdGVyaWFscyA9IGNyZWF0ZU1hdGVyaWFscyhnbHRmLCB0ZXh0dXJlQXNzZXRzLm1hcChmdW5jdGlvbiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgIHJldHVybiB0ZXh0dXJlQXNzZXQucmVzb3VyY2U7XG4gICAgfSksIG9wdGlvbnMsIGZsaXBWKTtcbiAgICBjb25zdCB2YXJpYW50cyA9IGNyZWF0ZVZhcmlhbnRzKGdsdGYpO1xuICAgIGNvbnN0IG1lc2hWYXJpYW50cyA9IHt9O1xuICAgIGNvbnN0IG1lc2hEZWZhdWx0TWF0ZXJpYWxzID0ge307XG4gICAgY29uc3QgbWVzaGVzID0gY3JlYXRlTWVzaGVzKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgb3B0aW9ucyk7XG4gICAgY29uc3Qgc2tpbnMgPSBjcmVhdGVTa2lucyhkZXZpY2UsIGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3cyk7XG5cbiAgICAvLyBjcmVhdGUgcmVuZGVycyB0byB3cmFwIG1lc2hlc1xuICAgIGNvbnN0IHJlbmRlcnMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1lc2hlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICByZW5kZXJzW2ldID0gbmV3IFJlbmRlcigpO1xuICAgICAgICByZW5kZXJzW2ldLm1lc2hlcyA9IG1lc2hlc1tpXTtcbiAgICB9XG5cbiAgICAvLyBsaW5rIHNraW5zIHRvIG1lc2hlc1xuICAgIGxpbmtTa2lucyhnbHRmLCByZW5kZXJzLCBza2lucyk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgR2xiUmVzb3VyY2VzKGdsdGYpO1xuICAgIHJlc3VsdC5ub2RlcyA9IG5vZGVzO1xuICAgIHJlc3VsdC5zY2VuZXMgPSBzY2VuZXM7XG4gICAgcmVzdWx0LmFuaW1hdGlvbnMgPSBhbmltYXRpb25zO1xuICAgIHJlc3VsdC50ZXh0dXJlcyA9IHRleHR1cmVBc3NldHM7XG4gICAgcmVzdWx0Lm1hdGVyaWFscyA9IG1hdGVyaWFscztcbiAgICByZXN1bHQudmFyaWFudHMgPSB2YXJpYW50cztcbiAgICByZXN1bHQubWVzaFZhcmlhbnRzID0gbWVzaFZhcmlhbnRzO1xuICAgIHJlc3VsdC5tZXNoRGVmYXVsdE1hdGVyaWFscyA9IG1lc2hEZWZhdWx0TWF0ZXJpYWxzO1xuICAgIHJlc3VsdC5yZW5kZXJzID0gcmVuZGVycztcbiAgICByZXN1bHQuc2tpbnMgPSBza2lucztcbiAgICByZXN1bHQubGlnaHRzID0gbGlnaHRzO1xuICAgIHJlc3VsdC5jYW1lcmFzID0gY2FtZXJhcztcblxuICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICBwb3N0cHJvY2VzcyhnbHRmLCByZXN1bHQpO1xuICAgIH1cblxuICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG59O1xuXG5jb25zdCBhcHBseVNhbXBsZXIgPSBmdW5jdGlvbiAodGV4dHVyZSwgZ2x0ZlNhbXBsZXIpIHtcbiAgICBjb25zdCBnZXRGaWx0ZXIgPSBmdW5jdGlvbiAoZmlsdGVyLCBkZWZhdWx0VmFsdWUpIHtcbiAgICAgICAgc3dpdGNoIChmaWx0ZXIpIHtcbiAgICAgICAgICAgIGNhc2UgOTcyODogcmV0dXJuIEZJTFRFUl9ORUFSRVNUO1xuICAgICAgICAgICAgY2FzZSA5NzI5OiByZXR1cm4gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgIGNhc2UgOTk4NDogcmV0dXJuIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUO1xuICAgICAgICAgICAgY2FzZSA5OTg1OiByZXR1cm4gRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTk4NjogcmV0dXJuIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVI7XG4gICAgICAgICAgICBjYXNlIDk5ODc6IHJldHVybiBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVI7XG4gICAgICAgICAgICBkZWZhdWx0OiAgIHJldHVybiBkZWZhdWx0VmFsdWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgZ2V0V3JhcCA9IGZ1bmN0aW9uICh3cmFwLCBkZWZhdWx0VmFsdWUpIHtcbiAgICAgICAgc3dpdGNoICh3cmFwKSB7XG4gICAgICAgICAgICBjYXNlIDMzMDcxOiByZXR1cm4gQUREUkVTU19DTEFNUF9UT19FREdFO1xuICAgICAgICAgICAgY2FzZSAzMzY0ODogcmV0dXJuIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUO1xuICAgICAgICAgICAgY2FzZSAxMDQ5NzogcmV0dXJuIEFERFJFU1NfUkVQRUFUO1xuICAgICAgICAgICAgZGVmYXVsdDogICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAodGV4dHVyZSkge1xuICAgICAgICBnbHRmU2FtcGxlciA9IGdsdGZTYW1wbGVyIHx8IHsgfTtcbiAgICAgICAgdGV4dHVyZS5taW5GaWx0ZXIgPSBnZXRGaWx0ZXIoZ2x0ZlNhbXBsZXIubWluRmlsdGVyLCBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIpO1xuICAgICAgICB0ZXh0dXJlLm1hZ0ZpbHRlciA9IGdldEZpbHRlcihnbHRmU2FtcGxlci5tYWdGaWx0ZXIsIEZJTFRFUl9MSU5FQVIpO1xuICAgICAgICB0ZXh0dXJlLmFkZHJlc3NVID0gZ2V0V3JhcChnbHRmU2FtcGxlci53cmFwUywgQUREUkVTU19SRVBFQVQpO1xuICAgICAgICB0ZXh0dXJlLmFkZHJlc3NWID0gZ2V0V3JhcChnbHRmU2FtcGxlci53cmFwVCwgQUREUkVTU19SRVBFQVQpO1xuICAgIH1cbn07XG5cbmxldCBnbHRmVGV4dHVyZVVuaXF1ZUlkID0gMDtcblxuLy8gbG9hZCBhbiBpbWFnZVxuY29uc3QgbG9hZEltYWdlQXN5bmMgPSBmdW5jdGlvbiAoZ2x0ZkltYWdlLCBpbmRleCwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuaW1hZ2UgJiYgb3B0aW9ucy5pbWFnZS5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3NBc3luYyA9IChvcHRpb25zICYmIG9wdGlvbnMuaW1hZ2UgJiYgb3B0aW9ucy5pbWFnZS5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmSW1hZ2UsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgIH07XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuaW1hZ2UgJiYgb3B0aW9ucy5pbWFnZS5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uICh0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmSW1hZ2UsIHRleHR1cmVBc3NldCk7XG4gICAgICAgIH1cbiAgICAgICAgY2FsbGJhY2sobnVsbCwgdGV4dHVyZUFzc2V0KTtcbiAgICB9O1xuXG4gICAgY29uc3QgbWltZVR5cGVGaWxlRXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgJ2ltYWdlL3BuZyc6ICdwbmcnLFxuICAgICAgICAnaW1hZ2UvanBlZyc6ICdqcGcnLFxuICAgICAgICAnaW1hZ2UvYmFzaXMnOiAnYmFzaXMnLFxuICAgICAgICAnaW1hZ2Uva3R4JzogJ2t0eCcsXG4gICAgICAgICdpbWFnZS9rdHgyJzogJ2t0eDInLFxuICAgICAgICAnaW1hZ2Uvdm5kLW1zLmRkcyc6ICdkZHMnXG4gICAgfTtcblxuICAgIGNvbnN0IGxvYWRUZXh0dXJlID0gZnVuY3Rpb24gKHVybCwgYnVmZmVyVmlldywgbWltZVR5cGUsIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IChnbHRmSW1hZ2UubmFtZSB8fCAnZ2x0Zi10ZXh0dXJlJykgKyAnLScgKyBnbHRmVGV4dHVyZVVuaXF1ZUlkKys7XG5cbiAgICAgICAgLy8gY29uc3RydWN0IHRoZSBhc3NldCBmaWxlXG4gICAgICAgIGNvbnN0IGZpbGUgPSB7XG4gICAgICAgICAgICB1cmw6IHVybCB8fCBuYW1lXG4gICAgICAgIH07XG4gICAgICAgIGlmIChidWZmZXJWaWV3KSB7XG4gICAgICAgICAgICBmaWxlLmNvbnRlbnRzID0gYnVmZmVyVmlldy5zbGljZSgwKS5idWZmZXI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1pbWVUeXBlKSB7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSBtaW1lVHlwZUZpbGVFeHRlbnNpb25zW21pbWVUeXBlXTtcbiAgICAgICAgICAgIGlmIChleHRlbnNpb24pIHtcbiAgICAgICAgICAgICAgICBmaWxlLmZpbGVuYW1lID0gZmlsZS51cmwgKyAnLicgKyBleHRlbnNpb247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgYW5kIGxvYWQgdGhlIGFzc2V0XG4gICAgICAgIGNvbnN0IGFzc2V0ID0gbmV3IEFzc2V0KG5hbWUsICd0ZXh0dXJlJywgZmlsZSwgbnVsbCwgb3B0aW9ucyk7XG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgb25Mb2FkKTtcbiAgICAgICAgYXNzZXQub24oJ2Vycm9yJywgY2FsbGJhY2spO1xuICAgICAgICByZWdpc3RyeS5hZGQoYXNzZXQpO1xuICAgICAgICByZWdpc3RyeS5sb2FkKGFzc2V0KTtcbiAgICB9O1xuXG4gICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgcHJlcHJvY2VzcyhnbHRmSW1hZ2UpO1xuICAgIH1cblxuICAgIHByb2Nlc3NBc3luYyhnbHRmSW1hZ2UsIGZ1bmN0aW9uIChlcnIsIHRleHR1cmVBc3NldCkge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICB9IGVsc2UgaWYgKHRleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgb25Mb2FkKHRleHR1cmVBc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCd1cmknKSkge1xuICAgICAgICAgICAgICAgIC8vIHVyaSBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICBpZiAoaXNEYXRhVVJJKGdsdGZJbWFnZS51cmkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxvYWRUZXh0dXJlKGdsdGZJbWFnZS51cmksIG51bGwsIGdldERhdGFVUklNaW1lVHlwZShnbHRmSW1hZ2UudXJpKSwgbnVsbCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbG9hZFRleHR1cmUocGF0aC5qb2luKHVybEJhc2UsIGdsdGZJbWFnZS51cmkpLCBudWxsLCBudWxsLCB7IGNyb3NzT3JpZ2luOiAnYW5vbnltb3VzJyB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgnYnVmZmVyVmlldycpICYmIGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgnbWltZVR5cGUnKSkge1xuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlcnZpZXdcbiAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZShudWxsLCBidWZmZXJWaWV3c1tnbHRmSW1hZ2UuYnVmZmVyVmlld10sIGdsdGZJbWFnZS5taW1lVHlwZSwgbnVsbCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGZhaWxcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBpbWFnZSBmb3VuZCBpbiBnbHRmIChuZWl0aGVyIHVyaSBvciBidWZmZXJWaWV3IGZvdW5kKS4gaW5kZXg9JyArIGluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuLy8gbG9hZCB0ZXh0dXJlcyB1c2luZyB0aGUgYXNzZXQgc3lzdGVtXG5jb25zdCBsb2FkVGV4dHVyZXNBc3luYyA9IGZ1bmN0aW9uIChnbHRmLCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdpbWFnZXMnKSB8fCBnbHRmLmltYWdlcy5sZW5ndGggPT09IDAgfHxcbiAgICAgICAgIWdsdGYuaGFzT3duUHJvcGVydHkoJ3RleHR1cmVzJykgfHwgZ2x0Zi50ZXh0dXJlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgW10pO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy50ZXh0dXJlICYmIG9wdGlvbnMudGV4dHVyZS5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3NBc3luYyA9IChvcHRpb25zICYmIG9wdGlvbnMudGV4dHVyZSAmJiBvcHRpb25zLnRleHR1cmUucHJvY2Vzc0FzeW5jKSB8fCBmdW5jdGlvbiAoZ2x0ZlRleHR1cmUsIGdsdGZJbWFnZXMsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgIH07XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMudGV4dHVyZSAmJiBvcHRpb25zLnRleHR1cmUucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBhc3NldHMgPSBbXTsgICAgICAgIC8vIG9uZSBwZXIgaW1hZ2VcbiAgICBjb25zdCB0ZXh0dXJlcyA9IFtdOyAgICAgIC8vIGxpc3QgcGVyIGltYWdlXG5cbiAgICBsZXQgcmVtYWluaW5nID0gZ2x0Zi50ZXh0dXJlcy5sZW5ndGg7XG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKHRleHR1cmVJbmRleCwgaW1hZ2VJbmRleCkge1xuICAgICAgICBpZiAoIXRleHR1cmVzW2ltYWdlSW5kZXhdKSB7XG4gICAgICAgICAgICB0ZXh0dXJlc1tpbWFnZUluZGV4XSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHRleHR1cmVzW2ltYWdlSW5kZXhdLnB1c2godGV4dHVyZUluZGV4KTtcblxuICAgICAgICBpZiAoLS1yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgICAgICAgICAgdGV4dHVyZXMuZm9yRWFjaChmdW5jdGlvbiAodGV4dHVyZUxpc3QsIGltYWdlSW5kZXgpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlTGlzdC5mb3JFYWNoKGZ1bmN0aW9uICh0ZXh0dXJlSW5kZXgsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleHR1cmVBc3NldCA9IChpbmRleCA9PT0gMCkgPyBhc3NldHNbaW1hZ2VJbmRleF0gOiBjbG9uZVRleHR1cmVBc3NldChhc3NldHNbaW1hZ2VJbmRleF0pO1xuICAgICAgICAgICAgICAgICAgICBhcHBseVNhbXBsZXIodGV4dHVyZUFzc2V0LnJlc291cmNlLCAoZ2x0Zi5zYW1wbGVycyB8fCBbXSlbZ2x0Zi50ZXh0dXJlc1t0ZXh0dXJlSW5kZXhdLnNhbXBsZXJdKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W3RleHR1cmVJbmRleF0gPSB0ZXh0dXJlQXNzZXQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zi50ZXh0dXJlc1t0ZXh0dXJlSW5kZXhdLCB0ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbHRmLnRleHR1cmVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGdsdGZUZXh0dXJlID0gZ2x0Zi50ZXh0dXJlc1tpXTtcblxuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmVGV4dHVyZSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzQXN5bmMoZ2x0ZlRleHR1cmUsIGdsdGYuaW1hZ2VzLCBmdW5jdGlvbiAoaSwgZ2x0ZlRleHR1cmUsIGVyciwgZ2x0ZkltYWdlSW5kZXgpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0ZkltYWdlSW5kZXggPT09IHVuZGVmaW5lZCB8fCBnbHRmSW1hZ2VJbmRleCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBnbHRmSW1hZ2VJbmRleCA9IGdsdGZUZXh0dXJlPy5leHRlbnNpb25zPy5LSFJfdGV4dHVyZV9iYXNpc3U/LnNvdXJjZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZJbWFnZUluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZJbWFnZUluZGV4ID0gZ2x0ZlRleHR1cmUuc291cmNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0c1tnbHRmSW1hZ2VJbmRleF0pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaW1hZ2UgaGFzIGFscmVhZHkgYmVlbiBsb2FkZWRcbiAgICAgICAgICAgICAgICAgICAgb25Mb2FkKGksIGdsdGZJbWFnZUluZGV4KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBmaXJzdCBvY2NjdXJyZW5jZSwgbG9hZCBpdFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBnbHRmSW1hZ2UgPSBnbHRmLmltYWdlc1tnbHRmSW1hZ2VJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGxvYWRJbWFnZUFzeW5jKGdsdGZJbWFnZSwgaSwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCB0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NldHNbZ2x0ZkltYWdlSW5kZXhdID0gdGV4dHVyZUFzc2V0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBnbHRmSW1hZ2VJbmRleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKG51bGwsIGksIGdsdGZUZXh0dXJlKSk7XG4gICAgfVxufTtcblxuLy8gbG9hZCBnbHRmIGJ1ZmZlcnMgYXN5bmNocm9ub3VzbHksIHJldHVybmluZyB0aGVtIGluIHRoZSBjYWxsYmFja1xuY29uc3QgbG9hZEJ1ZmZlcnNBc3luYyA9IGZ1bmN0aW9uIChnbHRmLCBiaW5hcnlDaHVuaywgdXJsQmFzZSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIGlmICghZ2x0Zi5idWZmZXJzIHx8IGdsdGYuYnVmZmVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyICYmIG9wdGlvbnMuYnVmZmVyLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXIgJiYgb3B0aW9ucy5idWZmZXIucHJvY2Vzc0FzeW5jKSB8fCBmdW5jdGlvbiAoZ2x0ZkJ1ZmZlciwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXIgJiYgb3B0aW9ucy5idWZmZXIucG9zdHByb2Nlc3M7XG5cbiAgICBsZXQgcmVtYWluaW5nID0gZ2x0Zi5idWZmZXJzLmxlbmd0aDtcbiAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAoaW5kZXgsIGJ1ZmZlcikge1xuICAgICAgICByZXN1bHRbaW5kZXhdID0gYnVmZmVyO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGYuYnVmZmVyc1tpbmRleF0sIGJ1ZmZlcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKC0tcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0Zi5idWZmZXJzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGdsdGZCdWZmZXIgPSBnbHRmLmJ1ZmZlcnNbaV07XG5cbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZkJ1ZmZlcik7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9jZXNzQXN5bmMoZ2x0ZkJ1ZmZlciwgZnVuY3Rpb24gKGksIGdsdGZCdWZmZXIsIGVyciwgYXJyYXlCdWZmZXIpIHsgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbG9vcC1mdW5jXG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXJyYXlCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICBvbkxvYWQoaSwgbmV3IFVpbnQ4QXJyYXkoYXJyYXlCdWZmZXIpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZCdWZmZXIuaGFzT3duUHJvcGVydHkoJ3VyaScpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0RhdGFVUkkoZ2x0ZkJ1ZmZlci51cmkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb252ZXJ0IGJhc2U2NCB0byByYXcgYmluYXJ5IGRhdGEgaGVsZCBpbiBhIHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZG9lc24ndCBoYW5kbGUgVVJMRW5jb2RlZCBEYXRhVVJJcyAtIHNlZSBTTyBhbnN3ZXIgIzY4NTAyNzYgZm9yIGNvZGUgdGhhdCBkb2VzIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ5dGVTdHJpbmcgPSBhdG9iKGdsdGZCdWZmZXIudXJpLnNwbGl0KCcsJylbMV0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYSB2aWV3IGludG8gdGhlIGJ1ZmZlclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYmluYXJ5QXJyYXkgPSBuZXcgVWludDhBcnJheShieXRlU3RyaW5nLmxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNldCB0aGUgYnl0ZXMgb2YgdGhlIGJ1ZmZlciB0byB0aGUgY29ycmVjdCB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYnl0ZVN0cmluZy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmFyeUFycmF5W2pdID0gYnl0ZVN0cmluZy5jaGFyQ29kZUF0KGopO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgYmluYXJ5QXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgaHR0cC5nZXQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aC5qb2luKHVybEJhc2UsIGdsdGZCdWZmZXIudXJpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGNhY2hlOiB0cnVlLCByZXNwb25zZVR5cGU6ICdhcnJheWJ1ZmZlcicsIHJldHJ5OiBmYWxzZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChpLCBlcnIsIHJlc3VsdCkgeyAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWxvb3AtZnVuY1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25Mb2FkKGksIG5ldyBVaW50OEFycmF5KHJlc3VsdCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfS5iaW5kKG51bGwsIGkpXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gZ2xiIGJ1ZmZlciByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICAgICAgb25Mb2FkKGksIGJpbmFyeUNodW5rKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0uYmluZChudWxsLCBpLCBnbHRmQnVmZmVyKSk7XG4gICAgfVxufTtcblxuLy8gcGFyc2UgdGhlIGdsdGYgY2h1bmssIHJldHVybnMgdGhlIGdsdGYganNvblxuY29uc3QgcGFyc2VHbHRmID0gZnVuY3Rpb24gKGdsdGZDaHVuaywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBkZWNvZGVCaW5hcnlVdGY4ID0gZnVuY3Rpb24gKGFycmF5KSB7XG4gICAgICAgIGlmICh0eXBlb2YgVGV4dERlY29kZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGFycmF5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdHIgPSAnJztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYXJyYXlbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChlc2NhcGUoc3RyKSk7XG4gICAgfTtcblxuICAgIGNvbnN0IGdsdGYgPSBKU09OLnBhcnNlKGRlY29kZUJpbmFyeVV0ZjgoZ2x0ZkNodW5rKSk7XG5cbiAgICAvLyBjaGVjayBnbHRmIHZlcnNpb25cbiAgICBpZiAoZ2x0Zi5hc3NldCAmJiBnbHRmLmFzc2V0LnZlcnNpb24gJiYgcGFyc2VGbG9hdChnbHRmLmFzc2V0LnZlcnNpb24pIDwgMikge1xuICAgICAgICBjYWxsYmFjayhgSW52YWxpZCBnbHRmIHZlcnNpb24uIEV4cGVjdGVkIHZlcnNpb24gMi4wIG9yIGFib3ZlIGJ1dCBmb3VuZCB2ZXJzaW9uICcke2dsdGYuYXNzZXQudmVyc2lvbn0nLmApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gY2hlY2sgcmVxdWlyZWQgZXh0ZW5zaW9uc1xuICAgIGNvbnN0IGV4dGVuc2lvbnNSZXF1aXJlZCA9IGdsdGY/LmV4dGVuc2lvbnNSZXF1aXJlZCB8fCBbXTtcbiAgICBpZiAoIWRyYWNvRGVjb2Rlckluc3RhbmNlICYmICFnZXRHbG9iYWxEcmFjb0RlY29kZXJNb2R1bGUoKSAmJiBleHRlbnNpb25zUmVxdWlyZWQuaW5kZXhPZignS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb24nKSAhPT0gLTEpIHtcbiAgICAgICAgV2FzbU1vZHVsZS5nZXRJbnN0YW5jZSgnRHJhY29EZWNvZGVyTW9kdWxlJywgKGluc3RhbmNlKSA9PiB7XG4gICAgICAgICAgICBkcmFjb0RlY29kZXJJbnN0YW5jZSA9IGluc3RhbmNlO1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgZ2x0Zik7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIGdsdGYpO1xuICAgIH1cbn07XG5cbi8vIHBhcnNlIGdsYiBkYXRhLCByZXR1cm5zIHRoZSBnbHRmIGFuZCBiaW5hcnkgY2h1bmtcbmNvbnN0IHBhcnNlR2xiID0gZnVuY3Rpb24gKGdsYkRhdGEsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgZGF0YSA9IChnbGJEYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpID8gbmV3IERhdGFWaWV3KGdsYkRhdGEpIDogbmV3IERhdGFWaWV3KGdsYkRhdGEuYnVmZmVyLCBnbGJEYXRhLmJ5dGVPZmZzZXQsIGdsYkRhdGEuYnl0ZUxlbmd0aCk7XG5cbiAgICAvLyByZWFkIGhlYWRlclxuICAgIGNvbnN0IG1hZ2ljID0gZGF0YS5nZXRVaW50MzIoMCwgdHJ1ZSk7XG4gICAgY29uc3QgdmVyc2lvbiA9IGRhdGEuZ2V0VWludDMyKDQsIHRydWUpO1xuICAgIGNvbnN0IGxlbmd0aCA9IGRhdGEuZ2V0VWludDMyKDgsIHRydWUpO1xuXG4gICAgaWYgKG1hZ2ljICE9PSAweDQ2NTQ2QzY3KSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIG1hZ2ljIG51bWJlciBmb3VuZCBpbiBnbGIgaGVhZGVyLiBFeHBlY3RlZCAweDQ2NTQ2QzY3LCBmb3VuZCAweCcgKyBtYWdpYy50b1N0cmluZygxNikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHZlcnNpb24gIT09IDIpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgdmVyc2lvbiBudW1iZXIgZm91bmQgaW4gZ2xiIGhlYWRlci4gRXhwZWN0ZWQgMiwgZm91bmQgJyArIHZlcnNpb24pO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGxlbmd0aCA8PSAwIHx8IGxlbmd0aCA+IGRhdGEuYnl0ZUxlbmd0aCkge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBsZW5ndGggZm91bmQgaW4gZ2xiIGhlYWRlci4gRm91bmQgJyArIGxlbmd0aCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyByZWFkIGNodW5rc1xuICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgIGxldCBvZmZzZXQgPSAxMjtcbiAgICB3aGlsZSAob2Zmc2V0IDwgbGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGNodW5rTGVuZ3RoID0gZGF0YS5nZXRVaW50MzIob2Zmc2V0LCB0cnVlKTtcbiAgICAgICAgaWYgKG9mZnNldCArIGNodW5rTGVuZ3RoICsgOCA+IGRhdGEuYnl0ZUxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNodW5rIGxlbmd0aCBmb3VuZCBpbiBnbGIuIEZvdW5kICcgKyBjaHVua0xlbmd0aCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2h1bmtUeXBlID0gZGF0YS5nZXRVaW50MzIob2Zmc2V0ICsgNCwgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IGNodW5rRGF0YSA9IG5ldyBVaW50OEFycmF5KGRhdGEuYnVmZmVyLCBkYXRhLmJ5dGVPZmZzZXQgKyBvZmZzZXQgKyA4LCBjaHVua0xlbmd0aCk7XG4gICAgICAgIGNodW5rcy5wdXNoKHsgbGVuZ3RoOiBjaHVua0xlbmd0aCwgdHlwZTogY2h1bmtUeXBlLCBkYXRhOiBjaHVua0RhdGEgfSk7XG4gICAgICAgIG9mZnNldCArPSBjaHVua0xlbmd0aCArIDg7XG4gICAgfVxuXG4gICAgaWYgKGNodW5rcy5sZW5ndGggIT09IDEgJiYgY2h1bmtzLmxlbmd0aCAhPT0gMikge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBudW1iZXIgb2YgY2h1bmtzIGZvdW5kIGluIGdsYiBmaWxlLicpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNodW5rc1swXS50eXBlICE9PSAweDRFNEY1MzRBKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGNodW5rIHR5cGUgZm91bmQgaW4gZ2xiIGZpbGUuIEV4cGVjdGVkIDB4NEU0RjUzNEEsIGZvdW5kIDB4JyArIGNodW5rc1swXS50eXBlLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoY2h1bmtzLmxlbmd0aCA+IDEgJiYgY2h1bmtzWzFdLnR5cGUgIT09IDB4MDA0RTQ5NDIpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgY2h1bmsgdHlwZSBmb3VuZCBpbiBnbGIgZmlsZS4gRXhwZWN0ZWQgMHgwMDRFNDk0MiwgZm91bmQgMHgnICsgY2h1bmtzWzFdLnR5cGUudG9TdHJpbmcoMTYpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgZ2x0ZkNodW5rOiBjaHVua3NbMF0uZGF0YSxcbiAgICAgICAgYmluYXJ5Q2h1bms6IGNodW5rcy5sZW5ndGggPT09IDIgPyBjaHVua3NbMV0uZGF0YSA6IG51bGxcbiAgICB9KTtcbn07XG5cbi8vIHBhcnNlIHRoZSBjaHVuayBvZiBkYXRhLCB3aGljaCBjYW4gYmUgZ2xiIG9yIGdsdGZcbmNvbnN0IHBhcnNlQ2h1bmsgPSBmdW5jdGlvbiAoZmlsZW5hbWUsIGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaGFzR2xiSGVhZGVyID0gKCkgPT4ge1xuICAgICAgICAvLyBnbGIgZm9ybWF0IHN0YXJ0cyB3aXRoICdnbFRGJ1xuICAgICAgICBjb25zdCB1OCA9IG5ldyBVaW50OEFycmF5KGRhdGEpO1xuICAgICAgICByZXR1cm4gdThbMF0gPT09IDEwMyAmJiB1OFsxXSA9PT0gMTA4ICYmIHU4WzJdID09PSA4NCAmJiB1OFszXSA9PT0gNzA7XG4gICAgfTtcblxuICAgIGlmICgoZmlsZW5hbWUgJiYgZmlsZW5hbWUudG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgnLmdsYicpKSB8fCBoYXNHbGJIZWFkZXIoKSkge1xuICAgICAgICBwYXJzZUdsYihkYXRhLCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwge1xuICAgICAgICAgICAgZ2x0ZkNodW5rOiBkYXRhLFxuICAgICAgICAgICAgYmluYXJ5Q2h1bms6IG51bGxcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuLy8gY3JlYXRlIGJ1ZmZlciB2aWV3c1xuY29uc3QgcGFyc2VCdWZmZXJWaWV3c0FzeW5jID0gZnVuY3Rpb24gKGdsdGYsIGJ1ZmZlcnMsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG5cbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuYnVmZmVyVmlldyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcgJiYgb3B0aW9ucy5idWZmZXJWaWV3LnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZCdWZmZXJWaWV3LCBidWZmZXJzLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcgJiYgb3B0aW9ucy5idWZmZXJWaWV3LnBvc3Rwcm9jZXNzO1xuXG4gICAgbGV0IHJlbWFpbmluZyA9IGdsdGYuYnVmZmVyVmlld3MgPyBnbHRmLmJ1ZmZlclZpZXdzLmxlbmd0aCA6IDA7XG5cbiAgICAvLyBoYW5kbGUgY2FzZSBvZiBubyBidWZmZXJzXG4gICAgaWYgKCFyZW1haW5pbmcpIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAoaW5kZXgsIGJ1ZmZlclZpZXcpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlclZpZXcgPSBnbHRmLmJ1ZmZlclZpZXdzW2luZGV4XTtcbiAgICAgICAgaWYgKGdsdGZCdWZmZXJWaWV3Lmhhc093blByb3BlcnR5KCdieXRlU3RyaWRlJykpIHtcbiAgICAgICAgICAgIGJ1ZmZlclZpZXcuYnl0ZVN0cmlkZSA9IGdsdGZCdWZmZXJWaWV3LmJ5dGVTdHJpZGU7XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHRbaW5kZXhdID0gYnVmZmVyVmlldztcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQnVmZmVyVmlldywgYnVmZmVyVmlldyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKC0tcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZ2x0Zi5idWZmZXJWaWV3cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBnbHRmQnVmZmVyVmlldyA9IGdsdGYuYnVmZmVyVmlld3NbaV07XG5cbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZkJ1ZmZlclZpZXcpO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZCdWZmZXJWaWV3LCBidWZmZXJzLCBmdW5jdGlvbiAoaSwgZ2x0ZkJ1ZmZlclZpZXcsIGVyciwgcmVzdWx0KSB7ICAgICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbG9vcC1mdW5jXG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgb25Mb2FkKGksIHJlc3VsdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlciA9IGJ1ZmZlcnNbZ2x0ZkJ1ZmZlclZpZXcuYnVmZmVyXTtcbiAgICAgICAgICAgICAgICBjb25zdCB0eXBlZEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyLmJ5dGVPZmZzZXQgKyAoZ2x0ZkJ1ZmZlclZpZXcuYnl0ZU9mZnNldCB8fCAwKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZkJ1ZmZlclZpZXcuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgb25Mb2FkKGksIHR5cGVkQXJyYXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQobnVsbCwgaSwgZ2x0ZkJ1ZmZlclZpZXcpKTtcbiAgICB9XG59O1xuXG4vLyAtLSBHbGJQYXJzZXJcbmNsYXNzIEdsYlBhcnNlciB7XG4gICAgLy8gcGFyc2UgdGhlIGdsdGYgb3IgZ2xiIGRhdGEgYXN5bmNocm9ub3VzbHksIGxvYWRpbmcgZXh0ZXJuYWwgcmVzb3VyY2VzXG4gICAgc3RhdGljIHBhcnNlQXN5bmMoZmlsZW5hbWUsIHVybEJhc2UsIGRhdGEsIGRldmljZSwgcmVnaXN0cnksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIC8vIHBhcnNlIHRoZSBkYXRhXG4gICAgICAgIHBhcnNlQ2h1bmsoZmlsZW5hbWUsIGRhdGEsIGZ1bmN0aW9uIChlcnIsIGNodW5rcykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBwYXJzZSBnbHRmXG4gICAgICAgICAgICBwYXJzZUdsdGYoY2h1bmtzLmdsdGZDaHVuaywgZnVuY3Rpb24gKGVyciwgZ2x0Zikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGFzeW5jIGxvYWQgZXh0ZXJuYWwgYnVmZmVyc1xuICAgICAgICAgICAgICAgIGxvYWRCdWZmZXJzQXN5bmMoZ2x0ZiwgY2h1bmtzLmJpbmFyeUNodW5rLCB1cmxCYXNlLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCBidWZmZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBhc3luYyBsb2FkIGJ1ZmZlciB2aWV3c1xuICAgICAgICAgICAgICAgICAgICBwYXJzZUJ1ZmZlclZpZXdzQXN5bmMoZ2x0ZiwgYnVmZmVycywgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgYnVmZmVyVmlld3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYXN5bmMgbG9hZCBpbWFnZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvYWRUZXh0dXJlc0FzeW5jKGdsdGYsIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgdGV4dHVyZUFzc2V0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZVJlc291cmNlcyhkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCB0ZXh0dXJlQXNzZXRzLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gcGFyc2UgdGhlIGdsdGYgb3IgZ2xiIGRhdGEgc3luY2hyb25vdXNseS4gZXh0ZXJuYWwgcmVzb3VyY2VzIChidWZmZXJzIGFuZCBpbWFnZXMpIGFyZSBpZ25vcmVkLlxuICAgIHN0YXRpYyBwYXJzZShmaWxlbmFtZSwgZGF0YSwgZGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSBudWxsO1xuXG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHsgfTtcblxuICAgICAgICAvLyBwYXJzZSB0aGUgZGF0YVxuICAgICAgICBwYXJzZUNodW5rKGZpbGVuYW1lLCBkYXRhLCBmdW5jdGlvbiAoZXJyLCBjaHVua3MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHBhcnNlIGdsdGZcbiAgICAgICAgICAgICAgICBwYXJzZUdsdGYoY2h1bmtzLmdsdGZDaHVuaywgZnVuY3Rpb24gKGVyciwgZ2x0Zikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBwYXJzZSBidWZmZXIgdmlld3NcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlQnVmZmVyVmlld3NBc3luYyhnbHRmLCBbY2h1bmtzLmJpbmFyeUNodW5rXSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgYnVmZmVyVmlld3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgcmVzb3VyY2VzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZVJlc291cmNlcyhkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCBbXSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgcmVzdWx0Xykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0XztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIGFzc2V0cywgbWF4UmV0cmllcykge1xuICAgICAgICB0aGlzLl9kZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIHRoaXMuX2Fzc2V0cyA9IGFzc2V0cztcbiAgICAgICAgdGhpcy5fZGVmYXVsdE1hdGVyaWFsID0gY3JlYXRlTWF0ZXJpYWwoe1xuICAgICAgICAgICAgbmFtZTogJ2RlZmF1bHRHbGJNYXRlcmlhbCdcbiAgICAgICAgfSwgW10pO1xuICAgICAgICB0aGlzLm1heFJldHJpZXMgPSBtYXhSZXRyaWVzO1xuICAgIH1cblxuICAgIF9nZXRVcmxXaXRob3V0UGFyYW1zKHVybCkge1xuICAgICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA+PSAwID8gdXJsLnNwbGl0KCc/JylbMF0gOiB1cmw7XG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICBBc3NldC5mZXRjaEFycmF5QnVmZmVyKHVybC5sb2FkLCAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBHbGJQYXJzZXIucGFyc2VBc3luYyhcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2V0VXJsV2l0aG91dFBhcmFtcyh1cmwub3JpZ2luYWwpLFxuICAgICAgICAgICAgICAgICAgICBwYXRoLmV4dHJhY3RQYXRoKHVybC5sb2FkKSxcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZXZpY2UsXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0LnJlZ2lzdHJ5LFxuICAgICAgICAgICAgICAgICAgICBhc3NldC5vcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZXR1cm4gZXZlcnl0aGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG5ldyBHbGJDb250YWluZXJSZXNvdXJjZShyZXN1bHQsIGFzc2V0LCB0aGlzLl9hc3NldHMsIHRoaXMuX2RlZmF1bHRNYXRlcmlhbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgYXNzZXQsIHRoaXMubWF4UmV0cmllcyk7XG4gICAgfVxuXG4gICAgb3Blbih1cmwsIGRhdGEsIGFzc2V0KSB7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIHBhdGNoKGFzc2V0LCBhc3NldHMpIHtcblxuICAgIH1cbn1cblxuZXhwb3J0IHsgR2xiUGFyc2VyIH07XG4iXSwibmFtZXMiOlsiZHJhY29EZWNvZGVySW5zdGFuY2UiLCJnZXRHbG9iYWxEcmFjb0RlY29kZXJNb2R1bGUiLCJ3aW5kb3ciLCJEcmFjb0RlY29kZXJNb2R1bGUiLCJHbGJSZXNvdXJjZXMiLCJjb25zdHJ1Y3RvciIsImdsdGYiLCJub2RlcyIsInNjZW5lcyIsImFuaW1hdGlvbnMiLCJ0ZXh0dXJlcyIsIm1hdGVyaWFscyIsInZhcmlhbnRzIiwibWVzaFZhcmlhbnRzIiwibWVzaERlZmF1bHRNYXRlcmlhbHMiLCJyZW5kZXJzIiwic2tpbnMiLCJsaWdodHMiLCJjYW1lcmFzIiwiZGVzdHJveSIsImZvckVhY2giLCJyZW5kZXIiLCJtZXNoZXMiLCJpc0RhdGFVUkkiLCJ1cmkiLCJ0ZXN0IiwiZ2V0RGF0YVVSSU1pbWVUeXBlIiwic3Vic3RyaW5nIiwiaW5kZXhPZiIsImdldE51bUNvbXBvbmVudHMiLCJhY2Nlc3NvclR5cGUiLCJnZXRDb21wb25lbnRUeXBlIiwiY29tcG9uZW50VHlwZSIsIlRZUEVfSU5UOCIsIlRZUEVfVUlOVDgiLCJUWVBFX0lOVDE2IiwiVFlQRV9VSU5UMTYiLCJUWVBFX0lOVDMyIiwiVFlQRV9VSU5UMzIiLCJUWVBFX0ZMT0FUMzIiLCJnZXRDb21wb25lbnRTaXplSW5CeXRlcyIsImdldENvbXBvbmVudERhdGFUeXBlIiwiSW50OEFycmF5IiwiVWludDhBcnJheSIsIkludDE2QXJyYXkiLCJVaW50MTZBcnJheSIsIkludDMyQXJyYXkiLCJVaW50MzJBcnJheSIsIkZsb2F0MzJBcnJheSIsImdsdGZUb0VuZ2luZVNlbWFudGljTWFwIiwiU0VNQU5USUNfUE9TSVRJT04iLCJTRU1BTlRJQ19OT1JNQUwiLCJTRU1BTlRJQ19UQU5HRU5UIiwiU0VNQU5USUNfQ09MT1IiLCJTRU1BTlRJQ19CTEVORElORElDRVMiLCJTRU1BTlRJQ19CTEVORFdFSUdIVCIsIlNFTUFOVElDX1RFWENPT1JEMCIsIlNFTUFOVElDX1RFWENPT1JEMSIsIlNFTUFOVElDX1RFWENPT1JEMiIsIlNFTUFOVElDX1RFWENPT1JEMyIsIlNFTUFOVElDX1RFWENPT1JENCIsIlNFTUFOVElDX1RFWENPT1JENSIsIlNFTUFOVElDX1RFWENPT1JENiIsIlNFTUFOVElDX1RFWENPT1JENyIsImdldERlcXVhbnRpemVGdW5jIiwic3JjVHlwZSIsIngiLCJNYXRoIiwibWF4IiwiZGVxdWFudGl6ZUFycmF5IiwiZHN0QXJyYXkiLCJzcmNBcnJheSIsImNvbnZGdW5jIiwibGVuIiwibGVuZ3RoIiwiaSIsImdldEFjY2Vzc29yRGF0YSIsImdsdGZBY2Nlc3NvciIsImJ1ZmZlclZpZXdzIiwiZmxhdHRlbiIsIm51bUNvbXBvbmVudHMiLCJ0eXBlIiwiZGF0YVR5cGUiLCJidWZmZXJWaWV3IiwicmVzdWx0Iiwic3BhcnNlIiwiaW5kaWNlc0FjY2Vzc29yIiwiY291bnQiLCJpbmRpY2VzIiwiT2JqZWN0IiwiYXNzaWduIiwidmFsdWVzQWNjZXNzb3IiLCJ2YWx1ZXMiLCJoYXNPd25Qcm9wZXJ0eSIsImJhc2VBY2Nlc3NvciIsImJ5dGVPZmZzZXQiLCJzbGljZSIsInRhcmdldEluZGV4IiwiaiIsImJ5dGVzUGVyRWxlbWVudCIsIkJZVEVTX1BFUl9FTEVNRU5UIiwic3RvcmFnZSIsIkFycmF5QnVmZmVyIiwidG1wQXJyYXkiLCJkc3RPZmZzZXQiLCJzcmNPZmZzZXQiLCJieXRlU3RyaWRlIiwiYiIsImJ1ZmZlciIsImdldEFjY2Vzc29yRGF0YUZsb2F0MzIiLCJkYXRhIiwibm9ybWFsaXplZCIsImZsb2F0MzJEYXRhIiwiZ2V0QWNjZXNzb3JCb3VuZGluZ0JveCIsIm1pbiIsImN0eXBlIiwiQm91bmRpbmdCb3giLCJWZWMzIiwiZ2V0UHJpbWl0aXZlVHlwZSIsInByaW1pdGl2ZSIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJtb2RlIiwiUFJJTUlUSVZFX1BPSU5UUyIsIlBSSU1JVElWRV9MSU5FUyIsIlBSSU1JVElWRV9MSU5FTE9PUCIsIlBSSU1JVElWRV9MSU5FU1RSSVAiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiZ2VuZXJhdGVJbmRpY2VzIiwibnVtVmVydGljZXMiLCJkdW1teUluZGljZXMiLCJnZW5lcmF0ZU5vcm1hbHMiLCJzb3VyY2VEZXNjIiwicCIsImNvbXBvbmVudHMiLCJwb3NpdGlvbnMiLCJzaXplIiwic3RyaWRlIiwic3JjU3RyaWRlIiwidHlwZWRBcnJheVR5cGVzQnl0ZVNpemUiLCJzcmMiLCJ0eXBlZEFycmF5VHlwZXMiLCJvZmZzZXQiLCJub3JtYWxzVGVtcCIsImNhbGN1bGF0ZU5vcm1hbHMiLCJub3JtYWxzIiwic2V0IiwiZmxpcFRleENvb3JkVnMiLCJ2ZXJ0ZXhCdWZmZXIiLCJmbG9hdE9mZnNldHMiLCJzaG9ydE9mZnNldHMiLCJieXRlT2Zmc2V0cyIsImZvcm1hdCIsImVsZW1lbnRzIiwiZWxlbWVudCIsIm5hbWUiLCJwdXNoIiwiZmxpcCIsIm9mZnNldHMiLCJvbmUiLCJ0eXBlZEFycmF5IiwiaW5kZXgiLCJjbG9uZVRleHR1cmUiLCJ0ZXh0dXJlIiwic2hhbGxvd0NvcHlMZXZlbHMiLCJtaXAiLCJfbGV2ZWxzIiwibGV2ZWwiLCJjdWJlbWFwIiwiZmFjZSIsIlRleHR1cmUiLCJkZXZpY2UiLCJjbG9uZVRleHR1cmVBc3NldCIsIkFzc2V0IiwiZmlsZSIsIm9wdGlvbnMiLCJsb2FkZWQiLCJyZXNvdXJjZSIsInJlZ2lzdHJ5IiwiYWRkIiwiY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwiLCJmbGlwViIsInBvc2l0aW9uRGVzYyIsInZlcnRleERlc2MiLCJzZW1hbnRpYyIsIm5vcm1hbGl6ZSIsImVsZW1lbnRPcmRlciIsInNvcnQiLCJsaHMiLCJyaHMiLCJsaHNPcmRlciIsInJoc09yZGVyIiwiayIsInNvdXJjZSIsInRhcmdldCIsInNvdXJjZU9mZnNldCIsInZlcnRleEZvcm1hdCIsIlZlcnRleEZvcm1hdCIsImlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQiLCJWZXJ0ZXhCdWZmZXIiLCJCVUZGRVJfU1RBVElDIiwidmVydGV4RGF0YSIsImxvY2siLCJ0YXJnZXRBcnJheSIsInNvdXJjZUFycmF5IiwidGFyZ2V0U3RyaWRlIiwic291cmNlU3RyaWRlIiwiZHN0Iiwia2VuZCIsImZsb29yIiwidW5sb2NrIiwiY3JlYXRlVmVydGV4QnVmZmVyIiwiYXR0cmlidXRlcyIsImFjY2Vzc29ycyIsInZlcnRleEJ1ZmZlckRpY3QiLCJ1c2VBdHRyaWJ1dGVzIiwiYXR0cmliSWRzIiwiYXR0cmliIiwidmJLZXkiLCJqb2luIiwidmIiLCJhY2Nlc3NvciIsImFjY2Vzc29yRGF0YSIsImNyZWF0ZVZlcnRleEJ1ZmZlckRyYWNvIiwib3V0cHV0R2VvbWV0cnkiLCJleHREcmFjbyIsImRlY29kZXIiLCJkZWNvZGVyTW9kdWxlIiwibnVtUG9pbnRzIiwibnVtX3BvaW50cyIsImV4dHJhY3REcmFjb0F0dHJpYnV0ZUluZm8iLCJ1bmlxdWVJZCIsImF0dHJpYnV0ZSIsIkdldEF0dHJpYnV0ZUJ5VW5pcXVlSWQiLCJudW1WYWx1ZXMiLCJudW1fY29tcG9uZW50cyIsImRyYWNvRm9ybWF0IiwiZGF0YV90eXBlIiwicHRyIiwiY29tcG9uZW50U2l6ZUluQnl0ZXMiLCJzdG9yYWdlVHlwZSIsIkRUX1VJTlQ4IiwiX21hbGxvYyIsIkdldEF0dHJpYnV0ZURhdGFBcnJheUZvckFsbFBvaW50cyIsIkhFQVBVOCIsIkRUX1VJTlQxNiIsIkhFQVBVMTYiLCJEVF9GTE9BVDMyIiwiSEVBUEYzMiIsIl9mcmVlIiwiYXR0cmlidXRlSW5mbyIsImNyZWF0ZVNraW4iLCJnbHRmU2tpbiIsImdsYlNraW5zIiwiYmluZE1hdHJpeCIsImpvaW50cyIsIm51bUpvaW50cyIsImlicCIsImludmVyc2VCaW5kTWF0cmljZXMiLCJpYm1EYXRhIiwiaWJtVmFsdWVzIiwiTWF0NCIsImJvbmVOYW1lcyIsImtleSIsInNraW4iLCJnZXQiLCJTa2luIiwidGVtcE1hdCIsInRlbXBWZWMiLCJjcmVhdGVNZXNoIiwiZ2x0Zk1lc2giLCJjYWxsYmFjayIsImFzc2V0T3B0aW9ucyIsInByaW1pdGl2ZXMiLCJwcmltaXRpdmVUeXBlIiwibnVtSW5kaWNlcyIsImNhblVzZU1vcnBoIiwiZXh0ZW5zaW9ucyIsIktIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uIiwidWludDhCdWZmZXIiLCJEZWNvZGVyQnVmZmVyIiwiSW5pdCIsIkRlY29kZXIiLCJnZW9tZXRyeVR5cGUiLCJHZXRFbmNvZGVkR2VvbWV0cnlUeXBlIiwic3RhdHVzIiwiUE9JTlRfQ0xPVUQiLCJQb2ludENsb3VkIiwiRGVjb2RlQnVmZmVyVG9Qb2ludENsb3VkIiwiVFJJQU5HVUxBUl9NRVNIIiwiTWVzaCIsIkRlY29kZUJ1ZmZlclRvTWVzaCIsIklOVkFMSURfR0VPTUVUUllfVFlQRSIsIm9rIiwiZXJyb3JfbXNnIiwibnVtRmFjZXMiLCJudW1fZmFjZXMiLCJiaXQzMiIsImRhdGFTaXplIiwiR2V0VHJpYW5nbGVzVUludDMyQXJyYXkiLCJIRUFQVTMyIiwiR2V0VHJpYW5nbGVzVUludDE2QXJyYXkiLCJEZWJ1ZyIsIndhcm4iLCJtZXNoIiwiYmFzZSIsImluZGV4ZWQiLCJpbmRleEZvcm1hdCIsIklOREVYRk9STUFUX1VJTlQ4IiwiSU5ERVhGT1JNQVRfVUlOVDE2IiwiSU5ERVhGT1JNQVRfVUlOVDMyIiwiZXh0VWludEVsZW1lbnQiLCJjb25zb2xlIiwiaW5kZXhCdWZmZXIiLCJJbmRleEJ1ZmZlciIsIktIUl9tYXRlcmlhbHNfdmFyaWFudHMiLCJ0ZW1wTWFwcGluZyIsIm1hcHBpbmdzIiwibWFwcGluZyIsInZhcmlhbnQiLCJtYXRlcmlhbCIsImlkIiwiUE9TSVRJT04iLCJhYWJiIiwidGFyZ2V0cyIsImRlbHRhUG9zaXRpb25zIiwiZGVsdGFQb3NpdGlvbnNUeXBlIiwiTk9STUFMIiwiZGVsdGFOb3JtYWxzIiwiZGVsdGFOb3JtYWxzVHlwZSIsImV4dHJhcyIsInRhcmdldE5hbWVzIiwidG9TdHJpbmciLCJkZWZhdWx0V2VpZ2h0Iiwid2VpZ2h0cyIsInByZXNlcnZlRGF0YSIsIm1vcnBoUHJlc2VydmVEYXRhIiwiTW9ycGhUYXJnZXQiLCJtb3JwaCIsIk1vcnBoIiwiZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0iLCJtYXBzIiwibWFwIiwidGV4Q29vcmQiLCJ6ZXJvcyIsIm9uZXMiLCJ0ZXh0dXJlVHJhbnNmb3JtIiwiS0hSX3RleHR1cmVfdHJhbnNmb3JtIiwic2NhbGUiLCJyb3RhdGlvbiIsIm1hdGgiLCJSQURfVE9fREVHIiwidGlsaW5nVmVjIiwiVmVjMiIsIm9mZnNldFZlYyIsImV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzIiwiY29sb3IiLCJkaWZmdXNlRmFjdG9yIiwiZGlmZnVzZSIsInBvdyIsIm9wYWNpdHkiLCJkaWZmdXNlVGV4dHVyZSIsImRpZmZ1c2VNYXAiLCJkaWZmdXNlTWFwQ2hhbm5lbCIsIm9wYWNpdHlNYXAiLCJvcGFjaXR5TWFwQ2hhbm5lbCIsInVzZU1ldGFsbmVzcyIsInNwZWN1bGFyRmFjdG9yIiwic3BlY3VsYXIiLCJnbG9zcyIsImdsb3NzaW5lc3NGYWN0b3IiLCJzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlIiwic3BlY3VsYXJFbmNvZGluZyIsInNwZWN1bGFyTWFwIiwiZ2xvc3NNYXAiLCJzcGVjdWxhck1hcENoYW5uZWwiLCJnbG9zc01hcENoYW5uZWwiLCJleHRlbnNpb25DbGVhckNvYXQiLCJjbGVhckNvYXQiLCJjbGVhcmNvYXRGYWN0b3IiLCJjbGVhcmNvYXRUZXh0dXJlIiwiY2xlYXJDb2F0TWFwIiwiY2xlYXJDb2F0TWFwQ2hhbm5lbCIsImNsZWFyQ29hdEdsb3NzIiwiY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yIiwiY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSIsImNsZWFyQ29hdEdsb3NzTWFwIiwiY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsIiwiY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSIsImNsZWFyQ29hdE5vcm1hbE1hcCIsImNsZWFyQ29hdEJ1bXBpbmVzcyIsImNsZWFyQ29hdEdsb3NzSW52ZXJ0IiwiZXh0ZW5zaW9uVW5saXQiLCJ1c2VMaWdodGluZyIsImVtaXNzaXZlIiwiY29weSIsImVtaXNzaXZlVGludCIsImRpZmZ1c2VUaW50IiwiZW1pc3NpdmVNYXAiLCJlbWlzc2l2ZU1hcFV2IiwiZGlmZnVzZU1hcFV2IiwiZW1pc3NpdmVNYXBUaWxpbmciLCJkaWZmdXNlTWFwVGlsaW5nIiwiZW1pc3NpdmVNYXBPZmZzZXQiLCJkaWZmdXNlTWFwT2Zmc2V0IiwiZW1pc3NpdmVNYXBSb3RhdGlvbiIsImRpZmZ1c2VNYXBSb3RhdGlvbiIsImVtaXNzaXZlTWFwQ2hhbm5lbCIsImVtaXNzaXZlVmVydGV4Q29sb3IiLCJkaWZmdXNlVmVydGV4Q29sb3IiLCJlbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCIsImRpZmZ1c2VWZXJ0ZXhDb2xvckNoYW5uZWwiLCJleHRlbnNpb25TcGVjdWxhciIsInVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IiLCJzcGVjdWxhckNvbG9yVGV4dHVyZSIsInNwZWN1bGFyQ29sb3JGYWN0b3IiLCJzcGVjdWxhcml0eUZhY3RvciIsInNwZWN1bGFyaXR5RmFjdG9yTWFwQ2hhbm5lbCIsInNwZWN1bGFyaXR5RmFjdG9yTWFwIiwic3BlY3VsYXJUZXh0dXJlIiwiZXh0ZW5zaW9uSW9yIiwicmVmcmFjdGlvbkluZGV4IiwiaW9yIiwiZXh0ZW5zaW9uVHJhbnNtaXNzaW9uIiwiYmxlbmRUeXBlIiwiQkxFTkRfTk9STUFMIiwidXNlRHluYW1pY1JlZnJhY3Rpb24iLCJyZWZyYWN0aW9uIiwidHJhbnNtaXNzaW9uRmFjdG9yIiwicmVmcmFjdGlvbk1hcENoYW5uZWwiLCJyZWZyYWN0aW9uTWFwIiwidHJhbnNtaXNzaW9uVGV4dHVyZSIsImV4dGVuc2lvblNoZWVuIiwidXNlU2hlZW4iLCJzaGVlbkNvbG9yRmFjdG9yIiwic2hlZW4iLCJzaGVlbk1hcCIsInNoZWVuQ29sb3JUZXh0dXJlIiwic2hlZW5FbmNvZGluZyIsInNoZWVuR2xvc3MiLCJzaGVlblJvdWdobmVzc0ZhY3RvciIsInNoZWVuR2xvc3NNYXAiLCJzaGVlblJvdWdobmVzc1RleHR1cmUiLCJzaGVlbkdsb3NzTWFwQ2hhbm5lbCIsInNoZWVuR2xvc3NJbnZlcnQiLCJleHRlbnNpb25Wb2x1bWUiLCJ0aGlja25lc3MiLCJ0aGlja25lc3NGYWN0b3IiLCJ0aGlja25lc3NNYXAiLCJ0aGlja25lc3NUZXh0dXJlIiwidGhpY2tuZXNzTWFwQ2hhbm5lbCIsImF0dGVudWF0aW9uRGlzdGFuY2UiLCJhdHRlbnVhdGlvbkNvbG9yIiwiYXR0ZW51YXRpb24iLCJleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoIiwiZW1pc3NpdmVJbnRlbnNpdHkiLCJlbWlzc2l2ZVN0cmVuZ3RoIiwiZXh0ZW5zaW9uSXJpZGVzY2VuY2UiLCJ1c2VJcmlkZXNjZW5jZSIsImlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2VGYWN0b3IiLCJpcmlkZXNjZW5jZU1hcENoYW5uZWwiLCJpcmlkZXNjZW5jZU1hcCIsImlyaWRlc2NlbmNlVGV4dHVyZSIsImlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4IiwiaXJpZGVzY2VuY2VJb3IiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01pbiIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bSIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4IiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXhpbXVtIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXAiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUiLCJjcmVhdGVNYXRlcmlhbCIsImdsdGZNYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJvY2NsdWRlU3BlY3VsYXIiLCJTUEVDT0NDX0FPIiwic3BlY3VsYXJUaW50Iiwic3BlY3VsYXJWZXJ0ZXhDb2xvciIsInBickRhdGEiLCJwYnJNZXRhbGxpY1JvdWdobmVzcyIsImJhc2VDb2xvckZhY3RvciIsImJhc2VDb2xvclRleHR1cmUiLCJtZXRhbG5lc3MiLCJtZXRhbGxpY0ZhY3RvciIsInJvdWdobmVzc0ZhY3RvciIsImdsb3NzSW52ZXJ0IiwibWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlIiwibWV0YWxuZXNzTWFwIiwibWV0YWxuZXNzTWFwQ2hhbm5lbCIsIm5vcm1hbFRleHR1cmUiLCJub3JtYWxNYXAiLCJidW1waW5lc3MiLCJvY2NsdXNpb25UZXh0dXJlIiwiYW9NYXAiLCJhb01hcENoYW5uZWwiLCJlbWlzc2l2ZUZhY3RvciIsImVtaXNzaXZlVGV4dHVyZSIsImFscGhhTW9kZSIsIkJMRU5EX05PTkUiLCJhbHBoYVRlc3QiLCJhbHBoYUN1dG9mZiIsImRlcHRoV3JpdGUiLCJ0d29TaWRlZExpZ2h0aW5nIiwiZG91YmxlU2lkZWQiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsIkNVTExGQUNFX0JBQ0siLCJleHRlbnNpb25GdW5jIiwidW5kZWZpbmVkIiwidXBkYXRlIiwiY3JlYXRlQW5pbWF0aW9uIiwiZ2x0ZkFuaW1hdGlvbiIsImFuaW1hdGlvbkluZGV4IiwiZ2x0ZkFjY2Vzc29ycyIsImdsdGZOb2RlcyIsImNyZWF0ZUFuaW1EYXRhIiwiQW5pbURhdGEiLCJpbnRlcnBNYXAiLCJJTlRFUlBPTEFUSU9OX1NURVAiLCJJTlRFUlBPTEFUSU9OX0xJTkVBUiIsIklOVEVSUE9MQVRJT05fQ1VCSUMiLCJpbnB1dE1hcCIsIm91dHB1dE1hcCIsImN1cnZlTWFwIiwib3V0cHV0Q291bnRlciIsInNhbXBsZXJzIiwic2FtcGxlciIsImlucHV0Iiwib3V0cHV0IiwiaW50ZXJwb2xhdGlvbiIsImN1cnZlIiwicGF0aHMiLCJxdWF0QXJyYXlzIiwidHJhbnNmb3JtU2NoZW1hIiwiY29uc3RydWN0Tm9kZVBhdGgiLCJub2RlIiwicGF0aCIsInVuc2hpZnQiLCJwYXJlbnQiLCJyZXRyaWV2ZVdlaWdodE5hbWUiLCJnbHRmTm9kZSIsIndlaWdodEluZGV4IiwiY3JlYXRlTW9ycGhUYXJnZXRDdXJ2ZXMiLCJlbnRpdHlQYXRoIiwib3V0Iiwib3V0RGF0YSIsIm1vcnBoVGFyZ2V0Q291bnQiLCJrZXlmcmFtZUNvdW50IiwibW9ycGhUYXJnZXRPdXRwdXQiLCJtb3JwaEN1cnZlIiwiY29tcG9uZW50IiwicHJvcGVydHlQYXRoIiwiY2hhbm5lbHMiLCJjaGFubmVsIiwic3RhcnRzV2l0aCIsImlucHV0cyIsIm91dHB1dHMiLCJjdXJ2ZXMiLCJpbnB1dEtleSIsIm91dHB1dEtleSIsImN1cnZlS2V5IiwiY3VydmVEYXRhIiwiQW5pbUN1cnZlIiwicHJldkluZGV4IiwiZCIsImRwIiwiZHVyYXRpb24iLCJfZGF0YSIsIkFuaW1UcmFjayIsImNyZWF0ZU5vZGUiLCJub2RlSW5kZXgiLCJlbnRpdHkiLCJHcmFwaE5vZGUiLCJtYXRyaXgiLCJnZXRUcmFuc2xhdGlvbiIsInNldExvY2FsUG9zaXRpb24iLCJnZXRFdWxlckFuZ2xlcyIsInNldExvY2FsRXVsZXJBbmdsZXMiLCJnZXRTY2FsZSIsInNldExvY2FsU2NhbGUiLCJyIiwic2V0TG9jYWxSb3RhdGlvbiIsInQiLCJ0cmFuc2xhdGlvbiIsInMiLCJjcmVhdGVDYW1lcmEiLCJnbHRmQ2FtZXJhIiwicHJvamVjdGlvbiIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsImdsdGZQcm9wZXJ0aWVzIiwib3J0aG9ncmFwaGljIiwicGVyc3BlY3RpdmUiLCJjb21wb25lbnREYXRhIiwiZW5hYmxlZCIsIm5lYXJDbGlwIiwiem5lYXIiLCJhc3BlY3RSYXRpb01vZGUiLCJBU1BFQ1RfQVVUTyIsInpmYXIiLCJmYXJDbGlwIiwib3J0aG9IZWlnaHQiLCJ5bWFnIiwiQVNQRUNUX01BTlVBTCIsImFzcGVjdFJhdGlvIiwieG1hZyIsImZvdiIsInlmb3YiLCJjYW1lcmFFbnRpdHkiLCJFbnRpdHkiLCJhZGRDb21wb25lbnQiLCJjcmVhdGVMaWdodCIsImdsdGZMaWdodCIsImxpZ2h0UHJvcHMiLCJDb2xvciIsIldISVRFIiwicmFuZ2UiLCJmYWxsb2ZmTW9kZSIsIkxJR0hURkFMTE9GRl9JTlZFUlNFU1FVQVJFRCIsImludGVuc2l0eSIsImNsYW1wIiwiaW5uZXJDb25lQW5nbGUiLCJzcG90Iiwib3V0ZXJDb25lQW5nbGUiLCJQSSIsImx1bWluYW5jZSIsIkxpZ2h0IiwiZ2V0TGlnaHRVbml0Q29udmVyc2lvbiIsImxpZ2h0VHlwZXMiLCJsaWdodEVudGl0eSIsInJvdGF0ZUxvY2FsIiwiY3JlYXRlU2tpbnMiLCJNYXAiLCJjcmVhdGVNZXNoZXMiLCJza2lwTWVzaGVzIiwiY3JlYXRlTWF0ZXJpYWxzIiwicHJlcHJvY2VzcyIsInByb2Nlc3MiLCJwb3N0cHJvY2VzcyIsImNyZWF0ZVZhcmlhbnRzIiwiY3JlYXRlQW5pbWF0aW9ucyIsImFuaW1hdGlvbiIsImNyZWF0ZU5vZGVzIiwidW5pcXVlTmFtZXMiLCJjaGlsZHJlbiIsImNoaWxkIiwiYWRkQ2hpbGQiLCJjcmVhdGVTY2VuZXMiLCJzY2VuZSIsInNjZW5lUm9vdCIsIm4iLCJjaGlsZE5vZGUiLCJjcmVhdGVDYW1lcmFzIiwiY2FtZXJhIiwiY3JlYXRlTGlnaHRzIiwiS0hSX2xpZ2h0c19wdW5jdHVhbCIsImdsdGZMaWdodHMiLCJsaWdodCIsImxpZ2h0SW5kZXgiLCJsaW5rU2tpbnMiLCJtZXNoR3JvdXAiLCJjcmVhdGVSZXNvdXJjZXMiLCJ0ZXh0dXJlQXNzZXRzIiwiZ2xvYmFsIiwiYXNzZXQiLCJnZW5lcmF0b3IiLCJ0ZXh0dXJlQXNzZXQiLCJSZW5kZXIiLCJhcHBseVNhbXBsZXIiLCJnbHRmU2FtcGxlciIsImdldEZpbHRlciIsImZpbHRlciIsImRlZmF1bHRWYWx1ZSIsIkZJTFRFUl9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUiIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJnZXRXcmFwIiwid3JhcCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiQUREUkVTU19SRVBFQVQiLCJtaW5GaWx0ZXIiLCJtYWdGaWx0ZXIiLCJhZGRyZXNzVSIsIndyYXBTIiwiYWRkcmVzc1YiLCJ3cmFwVCIsImdsdGZUZXh0dXJlVW5pcXVlSWQiLCJsb2FkSW1hZ2VBc3luYyIsImdsdGZJbWFnZSIsInVybEJhc2UiLCJpbWFnZSIsInByb2Nlc3NBc3luYyIsIm9uTG9hZCIsIm1pbWVUeXBlRmlsZUV4dGVuc2lvbnMiLCJsb2FkVGV4dHVyZSIsInVybCIsIm1pbWVUeXBlIiwiY29udGVudHMiLCJleHRlbnNpb24iLCJmaWxlbmFtZSIsIm9uIiwibG9hZCIsImVyciIsImNyb3NzT3JpZ2luIiwibG9hZFRleHR1cmVzQXN5bmMiLCJpbWFnZXMiLCJnbHRmVGV4dHVyZSIsImdsdGZJbWFnZXMiLCJhc3NldHMiLCJyZW1haW5pbmciLCJ0ZXh0dXJlSW5kZXgiLCJpbWFnZUluZGV4IiwidGV4dHVyZUxpc3QiLCJnbHRmSW1hZ2VJbmRleCIsIktIUl90ZXh0dXJlX2Jhc2lzdSIsImJpbmQiLCJsb2FkQnVmZmVyc0FzeW5jIiwiYmluYXJ5Q2h1bmsiLCJidWZmZXJzIiwiZ2x0ZkJ1ZmZlciIsImFycmF5QnVmZmVyIiwiYnl0ZVN0cmluZyIsImF0b2IiLCJzcGxpdCIsImJpbmFyeUFycmF5IiwiY2hhckNvZGVBdCIsImh0dHAiLCJjYWNoZSIsInJlc3BvbnNlVHlwZSIsInJldHJ5IiwicGFyc2VHbHRmIiwiZ2x0ZkNodW5rIiwiZGVjb2RlQmluYXJ5VXRmOCIsImFycmF5IiwiVGV4dERlY29kZXIiLCJkZWNvZGUiLCJzdHIiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJkZWNvZGVVUklDb21wb25lbnQiLCJlc2NhcGUiLCJKU09OIiwicGFyc2UiLCJ2ZXJzaW9uIiwicGFyc2VGbG9hdCIsImV4dGVuc2lvbnNSZXF1aXJlZCIsIldhc21Nb2R1bGUiLCJnZXRJbnN0YW5jZSIsImluc3RhbmNlIiwicGFyc2VHbGIiLCJnbGJEYXRhIiwiRGF0YVZpZXciLCJieXRlTGVuZ3RoIiwibWFnaWMiLCJnZXRVaW50MzIiLCJjaHVua3MiLCJjaHVua0xlbmd0aCIsIkVycm9yIiwiY2h1bmtUeXBlIiwiY2h1bmtEYXRhIiwicGFyc2VDaHVuayIsImhhc0dsYkhlYWRlciIsInU4IiwidG9Mb3dlckNhc2UiLCJlbmRzV2l0aCIsInBhcnNlQnVmZmVyVmlld3NBc3luYyIsImdsdGZCdWZmZXJWaWV3IiwiR2xiUGFyc2VyIiwicGFyc2VBc3luYyIsImVycm9yIiwicmVzdWx0XyIsIm1heFJldHJpZXMiLCJfZGV2aWNlIiwiX2Fzc2V0cyIsIl9kZWZhdWx0TWF0ZXJpYWwiLCJfZ2V0VXJsV2l0aG91dFBhcmFtcyIsImZldGNoQXJyYXlCdWZmZXIiLCJvcmlnaW5hbCIsImV4dHJhY3RQYXRoIiwiR2xiQ29udGFpbmVyUmVzb3VyY2UiLCJvcGVuIiwicGF0Y2giXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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
