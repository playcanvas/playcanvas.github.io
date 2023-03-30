/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
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
import { CULLFACE_NONE, CULLFACE_BACK, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, INDEXFORMAT_UINT8, BUFFER_STATIC, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_POINTS, SEMANTIC_NORMAL, TYPE_FLOAT32, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE, TYPE_UINT32, TYPE_INT32, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, typedArrayTypesByteSize, typedArrayTypes } from '../../platform/graphics/constants.js';
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
import { ABSOLUTE_URL } from '../asset/constants.js';

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
  } else {
    if (gltfAccessor.hasOwnProperty("bufferView")) {
      const bufferView = bufferViews[gltfAccessor.bufferView];
      if (flatten && bufferView.hasOwnProperty('byteStride')) {
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
    } else {
      result = new dataType(gltfAccessor.count * numComponents);
    }
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
      const stride = bufferView && bufferView.hasOwnProperty('byteStride') ? bufferView.byteStride : size;
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
        if (indexFormat === INDEXFORMAT_UINT8 && device.isWebGPU) {
          Debug.warn('Glb file contains 8bit index buffer but these are not supported by WebGPU - converting to 16bit.');

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
        mesh.morph = new Morph(targets, device, {
          preferHighPrecision: assetOptions.morphPreferHighPrecision
        });
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

  // All morph targets are included in a single channel of the animation, with all targets output data interleaved with each other.
  // This function splits each morph target out into it a curve with its own output data, allowing us to animate each morph target independently by name.
  const createMorphTargetCurves = (curve, gltfNode, entityPath) => {
    const out = outputMap[curve.output];
    if (!out) {
      Debug.warn(`glb-parser: No output data is available for the morph target curve (${entityPath}/graph/weights). Skipping.`);
      return;
    }

    // names of morph targets
    let targetNames;
    if (meshes && meshes[gltfNode.mesh]) {
      const mesh = meshes[gltfNode.mesh];
      if (mesh.hasOwnProperty('extras') && mesh.extras.hasOwnProperty('targetNames')) {
        targetNames = mesh.extras.targetNames;
      }
    }
    const outData = out.data;
    const morphTargetCount = outData.length / inputMap[curve.input].data.length;
    const keyframeCount = outData.length / morphTargetCount;

    // single array buffer for all keys, 4 bytes per entry
    const singleBufferSize = keyframeCount * 4;
    const buffer = new ArrayBuffer(singleBufferSize * morphTargetCount);
    for (let j = 0; j < morphTargetCount; j++) {
      var _targetNames;
      const morphTargetOutput = new Float32Array(buffer, singleBufferSize * j, keyframeCount);

      // the output data for all morph targets in a single curve is interleaved. We need to retrieve the keyframe output data for a single morph target
      for (let k = 0; k < keyframeCount; k++) {
        morphTargetOutput[k] = outData[k * morphTargetCount + j];
      }
      const output = new AnimData(1, morphTargetOutput);
      const weightName = (_targetNames = targetNames) != null && _targetNames[j] ? `name.${targetNames[j]}` : j;

      // add the individual morph target output data to the outputMap using a negative value key (so as not to clash with sampler.output values)
      outputMap[-outputCounter] = output;
      const morphCurve = {
        paths: [{
          entityPath: entityPath,
          component: 'graph',
          propertyPath: [`weight.${weightName}`]
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
          loadTexture(ABSOLUTE_URL.test(gltfImage.uri) ? gltfImage.uri : path.join(urlBase, gltfImage.uri), null, null, {
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
            http.get(ABSOLUTE_URL.test(gltfBuffer.uri) ? gltfBuffer.uri : path.join(urlBase, gltfBuffer.uri), {
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
  const extensionsUsed = (gltf == null ? void 0 : gltf.extensionsUsed) || [];
  if (!dracoDecoderInstance && !getGlobalDracoDecoderModule() && extensionsUsed.indexOf('KHR_draco_mesh_compression') !== -1) {
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
  static parse(filename, data, device, options, callback) {
    options = options || {};

    // parse the data
    parseChunk(filename, data, function (err, chunks) {
      if (err) {
        callback(err);
      } else {
        // parse gltf
        parseGltf(chunks.gltfChunk, function (err, gltf) {
          if (err) {
            callback(err);
          } else {
            // parse buffer views
            parseBufferViewsAsync(gltf, [chunks.binaryChunk], options, function (err, bufferViews) {
              if (err) {
                callback(err);
              } else {
                // create resources
                createResources(device, gltf, bufferViews, [], options, function (err, result) {
                  if (err) {
                    callback(err);
                  } else {
                    callback(null, result);
                  }
                });
              }
            });
          }
        });
      }
    });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9wYXJzZXJzL2dsYi1wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi8uLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgV2FzbU1vZHVsZSB9IGZyb20gJy4uLy4uL2NvcmUvd2FzbS1tb2R1bGUuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUsXG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDVUxMRkFDRV9OT05FLCBDVUxMRkFDRV9CQUNLLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQUklNSVRJVkVfTElORUxPT1AsIFBSSU1JVElWRV9MSU5FU1RSSVAsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX1BPSU5UUywgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIFNFTUFOVElDX1RFWENPT1JEMCwgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19URVhDT09SRDIsIFNFTUFOVElDX1RFWENPT1JEMywgU0VNQU5USUNfVEVYQ09PUkQ0LCBTRU1BTlRJQ19URVhDT09SRDUsIFNFTUFOVElDX1RFWENPT1JENiwgU0VNQU5USUNfVEVYQ09PUkQ3LFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEJMRU5EX05PUk1BTCwgTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuICAgIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIEFTUEVDVF9NQU5VQUwsIEFTUEVDVF9BVVRPLCBTUEVDT0NDX0FPXG59IGZyb20gJy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IExpZ2h0LCBsaWdodFR5cGVzIH0gZnJvbSAnLi4vLi4vc2NlbmUvbGlnaHQuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNb3JwaFRhcmdldCB9IGZyb20gJy4uLy4uL3NjZW5lL21vcnBoLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBjYWxjdWxhdGVOb3JtYWxzIH0gZnJvbSAnLi4vLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBSZW5kZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9yZW5kZXIuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uLy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBJTlRFUlBPTEFUSU9OX0NVQklDLCBJTlRFUlBPTEFUSU9OX0xJTkVBUiwgSU5URVJQT0xBVElPTl9TVEVQIH0gZnJvbSAnLi4vYW5pbS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQW5pbUN1cnZlIH0gZnJvbSAnLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBBbmltRGF0YSB9IGZyb20gJy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyc7XG5pbXBvcnQgeyBBbmltVHJhY2sgfSBmcm9tICcuLi9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vYXNzZXQvYXNzZXQuanMnO1xuaW1wb3J0IHsgR2xiQ29udGFpbmVyUmVzb3VyY2UgfSBmcm9tICcuL2dsYi1jb250YWluZXItcmVzb3VyY2UuanMnO1xuaW1wb3J0IHsgQUJTT0xVVEVfVVJMIH0gZnJvbSAnLi4vYXNzZXQvY29uc3RhbnRzLmpzJztcblxuLy8gaW5zdGFuY2Ugb2YgdGhlIGRyYWNvIGRlY29kZXJcbmxldCBkcmFjb0RlY29kZXJJbnN0YW5jZSA9IG51bGw7XG5cbmNvbnN0IGdldEdsb2JhbERyYWNvRGVjb2Rlck1vZHVsZSA9ICgpID0+IHtcbiAgICByZXR1cm4gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LkRyYWNvRGVjb2Rlck1vZHVsZTtcbn07XG5cbi8vIHJlc291cmNlcyBsb2FkZWQgZnJvbSBHTEIgZmlsZSB0aGF0IHRoZSBwYXJzZXIgcmV0dXJuc1xuY2xhc3MgR2xiUmVzb3VyY2VzIHtcbiAgICBjb25zdHJ1Y3RvcihnbHRmKSB7XG4gICAgICAgIHRoaXMuZ2x0ZiA9IGdsdGY7XG4gICAgICAgIHRoaXMubm9kZXMgPSBudWxsO1xuICAgICAgICB0aGlzLnNjZW5lcyA9IG51bGw7XG4gICAgICAgIHRoaXMuYW5pbWF0aW9ucyA9IG51bGw7XG4gICAgICAgIHRoaXMudGV4dHVyZXMgPSBudWxsO1xuICAgICAgICB0aGlzLm1hdGVyaWFscyA9IG51bGw7XG4gICAgICAgIHRoaXMudmFyaWFudHMgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hWYXJpYW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaERlZmF1bHRNYXRlcmlhbHMgPSBudWxsO1xuICAgICAgICB0aGlzLnJlbmRlcnMgPSBudWxsO1xuICAgICAgICB0aGlzLnNraW5zID0gbnVsbDtcbiAgICAgICAgdGhpcy5saWdodHMgPSBudWxsO1xuICAgICAgICB0aGlzLmNhbWVyYXMgPSBudWxsO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIHJlbmRlciBuZWVkcyB0byBkZWMgcmVmIG1lc2hlc1xuICAgICAgICBpZiAodGhpcy5yZW5kZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlcnMuZm9yRWFjaCgocmVuZGVyKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVuZGVyLm1lc2hlcyA9IG51bGw7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgaXNEYXRhVVJJID0gZnVuY3Rpb24gKHVyaSkge1xuICAgIHJldHVybiAvXmRhdGE6LiosLiokL2kudGVzdCh1cmkpO1xufTtcblxuY29uc3QgZ2V0RGF0YVVSSU1pbWVUeXBlID0gZnVuY3Rpb24gKHVyaSkge1xuICAgIHJldHVybiB1cmkuc3Vic3RyaW5nKHVyaS5pbmRleE9mKCc6JykgKyAxLCB1cmkuaW5kZXhPZignOycpKTtcbn07XG5cbmNvbnN0IGdldE51bUNvbXBvbmVudHMgPSBmdW5jdGlvbiAoYWNjZXNzb3JUeXBlKSB7XG4gICAgc3dpdGNoIChhY2Nlc3NvclR5cGUpIHtcbiAgICAgICAgY2FzZSAnU0NBTEFSJzogcmV0dXJuIDE7XG4gICAgICAgIGNhc2UgJ1ZFQzInOiByZXR1cm4gMjtcbiAgICAgICAgY2FzZSAnVkVDMyc6IHJldHVybiAzO1xuICAgICAgICBjYXNlICdWRUM0JzogcmV0dXJuIDQ7XG4gICAgICAgIGNhc2UgJ01BVDInOiByZXR1cm4gNDtcbiAgICAgICAgY2FzZSAnTUFUMyc6IHJldHVybiA5O1xuICAgICAgICBjYXNlICdNQVQ0JzogcmV0dXJuIDE2O1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gMztcbiAgICB9XG59O1xuXG5jb25zdCBnZXRDb21wb25lbnRUeXBlID0gZnVuY3Rpb24gKGNvbXBvbmVudFR5cGUpIHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gVFlQRV9JTlQ4O1xuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiBUWVBFX1VJTlQ4O1xuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiBUWVBFX0lOVDE2O1xuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiBUWVBFX1VJTlQxNjtcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gVFlQRV9JTlQzMjtcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gVFlQRV9VSU5UMzI7XG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIFRZUEVfRkxPQVQzMjtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDA7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50U2l6ZUluQnl0ZXMgPSBmdW5jdGlvbiAoY29tcG9uZW50VHlwZSkge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiAxOyAgICAvLyBpbnQ4XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIDE7ICAgIC8vIHVpbnQ4XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIDI7ICAgIC8vIGludDE2XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIDI7ICAgIC8vIHVpbnQxNlxuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiA0OyAgICAvLyBpbnQzMlxuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiA0OyAgICAvLyB1aW50MzJcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gNDsgICAgLy8gZmxvYXQzMlxuICAgICAgICBkZWZhdWx0OiByZXR1cm4gMDtcbiAgICB9XG59O1xuXG5jb25zdCBnZXRDb21wb25lbnREYXRhVHlwZSA9IGZ1bmN0aW9uIChjb21wb25lbnRUeXBlKSB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIEludDhBcnJheTtcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gVWludDhBcnJheTtcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gSW50MTZBcnJheTtcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gVWludDE2QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIEludDMyQXJyYXk7XG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIFVpbnQzMkFycmF5O1xuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiBGbG9hdDMyQXJyYXk7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiBudWxsO1xuICAgIH1cbn07XG5cbmNvbnN0IGdsdGZUb0VuZ2luZVNlbWFudGljTWFwID0ge1xuICAgICdQT1NJVElPTic6IFNFTUFOVElDX1BPU0lUSU9OLFxuICAgICdOT1JNQUwnOiBTRU1BTlRJQ19OT1JNQUwsXG4gICAgJ1RBTkdFTlQnOiBTRU1BTlRJQ19UQU5HRU5ULFxuICAgICdDT0xPUl8wJzogU0VNQU5USUNfQ09MT1IsXG4gICAgJ0pPSU5UU18wJzogU0VNQU5USUNfQkxFTkRJTkRJQ0VTLFxuICAgICdXRUlHSFRTXzAnOiBTRU1BTlRJQ19CTEVORFdFSUdIVCxcbiAgICAnVEVYQ09PUkRfMCc6IFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICAnVEVYQ09PUkRfMSc6IFNFTUFOVElDX1RFWENPT1JEMSxcbiAgICAnVEVYQ09PUkRfMic6IFNFTUFOVElDX1RFWENPT1JEMixcbiAgICAnVEVYQ09PUkRfMyc6IFNFTUFOVElDX1RFWENPT1JEMyxcbiAgICAnVEVYQ09PUkRfNCc6IFNFTUFOVElDX1RFWENPT1JENCxcbiAgICAnVEVYQ09PUkRfNSc6IFNFTUFOVElDX1RFWENPT1JENSxcbiAgICAnVEVYQ09PUkRfNic6IFNFTUFOVElDX1RFWENPT1JENixcbiAgICAnVEVYQ09PUkRfNyc6IFNFTUFOVElDX1RFWENPT1JEN1xufTtcblxuLy8gcmV0dXJucyBhIGZ1bmN0aW9uIGZvciBkZXF1YW50aXppbmcgdGhlIGRhdGEgdHlwZVxuY29uc3QgZ2V0RGVxdWFudGl6ZUZ1bmMgPSAoc3JjVHlwZSkgPT4ge1xuICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vS2hyb25vc0dyb3VwL2dsVEYvdHJlZS9tYXN0ZXIvZXh0ZW5zaW9ucy8yLjAvS2hyb25vcy9LSFJfbWVzaF9xdWFudGl6YXRpb24jZW5jb2RpbmctcXVhbnRpemVkLWRhdGFcbiAgICBzd2l0Y2ggKHNyY1R5cGUpIHtcbiAgICAgICAgY2FzZSBUWVBFX0lOVDg6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAxMjcuMCwgLTEuMCk7XG4gICAgICAgIGNhc2UgVFlQRV9VSU5UODogcmV0dXJuIHggPT4geCAvIDI1NS4wO1xuICAgICAgICBjYXNlIFRZUEVfSU5UMTY6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAzMjc2Ny4wLCAtMS4wKTtcbiAgICAgICAgY2FzZSBUWVBFX1VJTlQxNjogcmV0dXJuIHggPT4geCAvIDY1NTM1LjA7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiB4ID0+IHg7XG4gICAgfVxufTtcblxuLy8gZGVxdWFudGl6ZSBhbiBhcnJheSBvZiBkYXRhXG5jb25zdCBkZXF1YW50aXplQXJyYXkgPSBmdW5jdGlvbiAoZHN0QXJyYXksIHNyY0FycmF5LCBzcmNUeXBlKSB7XG4gICAgY29uc3QgY29udkZ1bmMgPSBnZXREZXF1YW50aXplRnVuYyhzcmNUeXBlKTtcbiAgICBjb25zdCBsZW4gPSBzcmNBcnJheS5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBkc3RBcnJheVtpXSA9IGNvbnZGdW5jKHNyY0FycmF5W2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIGRzdEFycmF5O1xufTtcblxuLy8gZ2V0IGFjY2Vzc29yIGRhdGEsIG1ha2luZyBhIGNvcHkgYW5kIHBhdGNoaW5nIGluIHRoZSBjYXNlIG9mIGEgc3BhcnNlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckRhdGEgPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgZmxhdHRlbiA9IGZhbHNlKSB7XG4gICAgY29uc3QgbnVtQ29tcG9uZW50cyA9IGdldE51bUNvbXBvbmVudHMoZ2x0ZkFjY2Vzc29yLnR5cGUpO1xuICAgIGNvbnN0IGRhdGFUeXBlID0gZ2V0Q29tcG9uZW50RGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgIGlmICghZGF0YVR5cGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdDtcblxuICAgIGlmIChnbHRmQWNjZXNzb3Iuc3BhcnNlKSB7XG4gICAgICAgIC8vIGhhbmRsZSBzcGFyc2UgZGF0YVxuICAgICAgICBjb25zdCBzcGFyc2UgPSBnbHRmQWNjZXNzb3Iuc3BhcnNlO1xuXG4gICAgICAgIC8vIGdldCBpbmRpY2VzIGRhdGFcbiAgICAgICAgY29uc3QgaW5kaWNlc0FjY2Vzc29yID0ge1xuICAgICAgICAgICAgY291bnQ6IHNwYXJzZS5jb3VudCxcbiAgICAgICAgICAgIHR5cGU6ICdTQ0FMQVInXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGluZGljZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbihpbmRpY2VzQWNjZXNzb3IsIHNwYXJzZS5pbmRpY2VzKSwgYnVmZmVyVmlld3MsIHRydWUpO1xuXG4gICAgICAgIC8vIGRhdGEgdmFsdWVzIGRhdGFcbiAgICAgICAgY29uc3QgdmFsdWVzQWNjZXNzb3IgPSB7XG4gICAgICAgICAgICBjb3VudDogc3BhcnNlLmNvdW50LFxuICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGUsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiBnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbih2YWx1ZXNBY2Nlc3Nvciwgc3BhcnNlLnZhbHVlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBnZXQgYmFzZSBkYXRhXG4gICAgICAgIGlmIChnbHRmQWNjZXNzb3IuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUFjY2Vzc29yID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXc6IGdsdGZBY2Nlc3Nvci5idWZmZXJWaWV3LFxuICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXQ6IGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgIGNvdW50OiBnbHRmQWNjZXNzb3IuY291bnQsXG4gICAgICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYmFzZSBkYXRhIHNpbmNlIHdlJ2xsIHBhdGNoIHRoZSB2YWx1ZXNcbiAgICAgICAgICAgIHJlc3VsdCA9IGdldEFjY2Vzc29yRGF0YShiYXNlQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKS5zbGljZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gYmFzZSBkYXRhLCBjcmVhdGUgZW1wdHkgMCdkIG91dCBkYXRhXG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvdW50ICogbnVtQ29tcG9uZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwYXJzZS5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRJbmRleCA9IGluZGljZXNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bUNvbXBvbmVudHM7ICsraikge1xuICAgICAgICAgICAgICAgIHJlc3VsdFt0YXJnZXRJbmRleCAqIG51bUNvbXBvbmVudHMgKyBqXSA9IHZhbHVlc1tpICogbnVtQ29tcG9uZW50cyArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGdsdGZBY2Nlc3Nvci5oYXNPd25Qcm9wZXJ0eShcImJ1ZmZlclZpZXdcIikpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlclZpZXcgPSBidWZmZXJWaWV3c1tnbHRmQWNjZXNzb3IuYnVmZmVyVmlld107XG4gICAgICAgICAgICBpZiAoZmxhdHRlbiAmJiBidWZmZXJWaWV3Lmhhc093blByb3BlcnR5KCdieXRlU3RyaWRlJykpIHtcbiAgICAgICAgICAgICAgICAvLyBmbGF0dGVuIHN0cmlkZGVuIGRhdGFcbiAgICAgICAgICAgICAgICBjb25zdCBieXRlc1BlckVsZW1lbnQgPSBudW1Db21wb25lbnRzICogZGF0YVR5cGUuQllURVNfUEVSX0VMRU1FTlQ7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmFnZSA9IG5ldyBBcnJheUJ1ZmZlcihnbHRmQWNjZXNzb3IuY291bnQgKiBieXRlc1BlckVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRtcEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoc3RvcmFnZSk7XG5cbiAgICAgICAgICAgICAgICBsZXQgZHN0T2Zmc2V0ID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGZBY2Nlc3Nvci5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gYWRkIGJ1ZmZlclZpZXcuYnl0ZU9mZnNldCBiZWNhdXNlIGFjY2Vzc29yIHRha2VzIHRoaXMgaW50byBhY2NvdW50XG4gICAgICAgICAgICAgICAgICAgIGxldCBzcmNPZmZzZXQgPSAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCkgKyBpICogYnVmZmVyVmlldy5ieXRlU3RyaWRlO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBiID0gMDsgYiA8IGJ5dGVzUGVyRWxlbWVudDsgKytiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0bXBBcnJheVtkc3RPZmZzZXQrK10gPSBidWZmZXJWaWV3W3NyY09mZnNldCsrXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBkYXRhVHlwZShzdG9yYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGJ1ZmZlclZpZXcuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVPZmZzZXQgKyAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdldCBhY2Nlc3NvciBkYXRhIGFzICh1bm5vcm1hbGl6ZWQsIHVucXVhbnRpemVkKSBGbG9hdDMyIGRhdGFcbmNvbnN0IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIgPSBmdW5jdGlvbiAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykge1xuICAgIGNvbnN0IGRhdGEgPSBnZXRBY2Nlc3NvckRhdGEoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgaWYgKGRhdGEgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgfHwgIWdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIC8vIGlmIHRoZSBzb3VyY2UgZGF0YSBpcyBxdWFudGl6ZWQgKHNheSB0byBpbnQxNiksIGJ1dCBub3Qgbm9ybWFsaXplZFxuICAgICAgICAvLyB0aGVuIHJlYWRpbmcgdGhlIHZhbHVlcyBvZiB0aGUgYXJyYXkgaXMgdGhlIHNhbWUgd2hldGhlciB0aGUgdmFsdWVzXG4gICAgICAgIC8vIGFyZSBzdG9yZWQgYXMgZmxvYXQzMiBvciBpbnQxNi4gc28gcHJvYmFibHkgbm8gbmVlZCB0byBjb252ZXJ0IHRvXG4gICAgICAgIC8vIGZsb2F0MzIuXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIGNvbnN0IGZsb2F0MzJEYXRhID0gbmV3IEZsb2F0MzJBcnJheShkYXRhLmxlbmd0aCk7XG4gICAgZGVxdWFudGl6ZUFycmF5KGZsb2F0MzJEYXRhLCBkYXRhLCBnZXRDb21wb25lbnRUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKSk7XG4gICAgcmV0dXJuIGZsb2F0MzJEYXRhO1xufTtcblxuLy8gcmV0dXJucyBhIGRlcXVhbnRpemVkIGJvdW5kaW5nIGJveCBmb3IgdGhlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckJvdW5kaW5nQm94ID0gZnVuY3Rpb24gKGdsdGZBY2Nlc3Nvcikge1xuICAgIGxldCBtaW4gPSBnbHRmQWNjZXNzb3IubWluO1xuICAgIGxldCBtYXggPSBnbHRmQWNjZXNzb3IubWF4O1xuICAgIGlmICghbWluIHx8ICFtYXgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIGNvbnN0IGN0eXBlID0gZ2V0Q29tcG9uZW50VHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgICAgIG1pbiA9IGRlcXVhbnRpemVBcnJheShbXSwgbWluLCBjdHlwZSk7XG4gICAgICAgIG1heCA9IGRlcXVhbnRpemVBcnJheShbXSwgbWF4LCBjdHlwZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCb3VuZGluZ0JveChcbiAgICAgICAgbmV3IFZlYzMoKG1heFswXSArIG1pblswXSkgKiAwLjUsIChtYXhbMV0gKyBtaW5bMV0pICogMC41LCAobWF4WzJdICsgbWluWzJdKSAqIDAuNSksXG4gICAgICAgIG5ldyBWZWMzKChtYXhbMF0gLSBtaW5bMF0pICogMC41LCAobWF4WzFdIC0gbWluWzFdKSAqIDAuNSwgKG1heFsyXSAtIG1pblsyXSkgKiAwLjUpXG4gICAgKTtcbn07XG5cbmNvbnN0IGdldFByaW1pdGl2ZVR5cGUgPSBmdW5jdGlvbiAocHJpbWl0aXZlKSB7XG4gICAgaWYgKCFwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ21vZGUnKSkge1xuICAgICAgICByZXR1cm4gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHByaW1pdGl2ZS5tb2RlKSB7XG4gICAgICAgIGNhc2UgMDogcmV0dXJuIFBSSU1JVElWRV9QT0lOVFM7XG4gICAgICAgIGNhc2UgMTogcmV0dXJuIFBSSU1JVElWRV9MSU5FUztcbiAgICAgICAgY2FzZSAyOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVMT09QO1xuICAgICAgICBjYXNlIDM6IHJldHVybiBQUklNSVRJVkVfTElORVNUUklQO1xuICAgICAgICBjYXNlIDQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgICAgICBjYXNlIDU6IHJldHVybiBQUklNSVRJVkVfVFJJU1RSSVA7XG4gICAgICAgIGNhc2UgNjogcmV0dXJuIFBSSU1JVElWRV9UUklGQU47XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgIH1cbn07XG5cbmNvbnN0IGdlbmVyYXRlSW5kaWNlcyA9IGZ1bmN0aW9uIChudW1WZXJ0aWNlcykge1xuICAgIGNvbnN0IGR1bW15SW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShudW1WZXJ0aWNlcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1WZXJ0aWNlczsgaSsrKSB7XG4gICAgICAgIGR1bW15SW5kaWNlc1tpXSA9IGk7XG4gICAgfVxuICAgIHJldHVybiBkdW1teUluZGljZXM7XG59O1xuXG5jb25zdCBnZW5lcmF0ZU5vcm1hbHMgPSBmdW5jdGlvbiAoc291cmNlRGVzYywgaW5kaWNlcykge1xuICAgIC8vIGdldCBwb3NpdGlvbnNcbiAgICBjb25zdCBwID0gc291cmNlRGVzY1tTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgaWYgKCFwIHx8IHAuY29tcG9uZW50cyAhPT0gMykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHBvc2l0aW9ucztcbiAgICBpZiAocC5zaXplICE9PSBwLnN0cmlkZSkge1xuICAgICAgICAvLyBleHRyYWN0IHBvc2l0aW9ucyB3aGljaCBhcmVuJ3QgdGlnaHRseSBwYWNrZWRcbiAgICAgICAgY29uc3Qgc3JjU3RyaWRlID0gcC5zdHJpZGUgLyB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVtwLnR5cGVdO1xuICAgICAgICBjb25zdCBzcmMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogc3JjU3RyaWRlKTtcbiAgICAgICAgcG9zaXRpb25zID0gbmV3IHR5cGVkQXJyYXlUeXBlc1twLnR5cGVdKHAuY291bnQgKiAzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDBdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAwXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDFdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAxXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDJdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAyXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBvc2l0aW9uIGRhdGEgaXMgdGlnaHRseSBwYWNrZWQgc28gd2UgY2FuIHVzZSBpdCBkaXJlY3RseVxuICAgICAgICBwb3NpdGlvbnMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogMyk7XG4gICAgfVxuXG4gICAgY29uc3QgbnVtVmVydGljZXMgPSBwLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgaW5kaWNlcyBpZiBuZWNlc3NhcnlcbiAgICBpZiAoIWluZGljZXMpIHtcbiAgICAgICAgaW5kaWNlcyA9IGdlbmVyYXRlSW5kaWNlcyhudW1WZXJ0aWNlcyk7XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFsc1xuICAgIGNvbnN0IG5vcm1hbHNUZW1wID0gY2FsY3VsYXRlTm9ybWFscyhwb3NpdGlvbnMsIGluZGljZXMpO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KG5vcm1hbHNUZW1wLmxlbmd0aCk7XG4gICAgbm9ybWFscy5zZXQobm9ybWFsc1RlbXApO1xuXG4gICAgc291cmNlRGVzY1tTRU1BTlRJQ19OT1JNQUxdID0ge1xuICAgICAgICBidWZmZXI6IG5vcm1hbHMuYnVmZmVyLFxuICAgICAgICBzaXplOiAxMixcbiAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICBzdHJpZGU6IDEyLFxuICAgICAgICBjb3VudDogbnVtVmVydGljZXMsXG4gICAgICAgIGNvbXBvbmVudHM6IDMsXG4gICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgIH07XG59O1xuXG5jb25zdCBmbGlwVGV4Q29vcmRWcyA9IGZ1bmN0aW9uICh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICBsZXQgaSwgajtcblxuICAgIGNvbnN0IGZsb2F0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IHNob3J0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IGJ5dGVPZmZzZXRzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIGlmIChlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMCB8fFxuICAgICAgICAgICAgZWxlbWVudC5uYW1lID09PSBTRU1BTlRJQ19URVhDT09SRDEpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoZWxlbWVudC5kYXRhVHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9GTE9BVDMyOlxuICAgICAgICAgICAgICAgICAgICBmbG9hdE9mZnNldHMucHVzaCh7IG9mZnNldDogZWxlbWVudC5vZmZzZXQgLyA0ICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSAvIDQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMTY6XG4gICAgICAgICAgICAgICAgICAgIHNob3J0T2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCAvIDIgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIC8gMiB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OlxuICAgICAgICAgICAgICAgICAgICBieXRlT2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZmxpcCA9IGZ1bmN0aW9uIChvZmZzZXRzLCB0eXBlLCBvbmUpIHtcbiAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyB0eXBlKHZlcnRleEJ1ZmZlci5zdG9yYWdlKTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG9mZnNldHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IG9mZnNldHNbaV0ub2Zmc2V0O1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gb2Zmc2V0c1tpXS5zdHJpZGU7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgdmVydGV4QnVmZmVyLm51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICB0eXBlZEFycmF5W2luZGV4XSA9IG9uZSAtIHR5cGVkQXJyYXlbaW5kZXhdO1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IHN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoZmxvYXRPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChmbG9hdE9mZnNldHMsIEZsb2F0MzJBcnJheSwgMS4wKTtcbiAgICB9XG4gICAgaWYgKHNob3J0T2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoc2hvcnRPZmZzZXRzLCBVaW50MTZBcnJheSwgNjU1MzUpO1xuICAgIH1cbiAgICBpZiAoYnl0ZU9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKGJ5dGVPZmZzZXRzLCBVaW50OEFycmF5LCAyNTUpO1xuICAgIH1cbn07XG5cbi8vIGdpdmVuIGEgdGV4dHVyZSwgY2xvbmUgaXRcbi8vIE5PVEU6IENQVS1zaWRlIHRleHR1cmUgZGF0YSB3aWxsIGJlIHNoYXJlZCBidXQgR1BVIG1lbW9yeSB3aWxsIGJlIGR1cGxpY2F0ZWRcbmNvbnN0IGNsb25lVGV4dHVyZSA9IGZ1bmN0aW9uICh0ZXh0dXJlKSB7XG4gICAgY29uc3Qgc2hhbGxvd0NvcHlMZXZlbHMgPSBmdW5jdGlvbiAodGV4dHVyZSkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgbWlwID0gMDsgbWlwIDwgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aDsgKyttaXApIHtcbiAgICAgICAgICAgIGxldCBsZXZlbCA9IFtdO1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgKytmYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsLnB1c2godGV4dHVyZS5fbGV2ZWxzW21pcF1bZmFjZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwgPSB0ZXh0dXJlLl9sZXZlbHNbbWlwXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgVGV4dHVyZSh0ZXh0dXJlLmRldmljZSwgdGV4dHVyZSk7ICAgLy8gZHVwbGljYXRlIHRleHR1cmVcbiAgICByZXN1bHQuX2xldmVscyA9IHNoYWxsb3dDb3B5TGV2ZWxzKHRleHR1cmUpOyAgICAgICAgICAgIC8vIHNoYWxsb3cgY29weSB0aGUgbGV2ZWxzIHN0cnVjdHVyZVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnaXZlbiBhIHRleHR1cmUgYXNzZXQsIGNsb25lIGl0XG5jb25zdCBjbG9uZVRleHR1cmVBc3NldCA9IGZ1bmN0aW9uIChzcmMpIHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgQXNzZXQoc3JjLm5hbWUgKyAnX2Nsb25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5maWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMuZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLm9wdGlvbnMpO1xuICAgIHJlc3VsdC5sb2FkZWQgPSB0cnVlO1xuICAgIHJlc3VsdC5yZXNvdXJjZSA9IGNsb25lVGV4dHVyZShzcmMucmVzb3VyY2UpO1xuICAgIHNyYy5yZWdpc3RyeS5hZGQocmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwgPSBmdW5jdGlvbiAoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVikge1xuICAgIGNvbnN0IHBvc2l0aW9uRGVzYyA9IHNvdXJjZURlc2NbU0VNQU5USUNfUE9TSVRJT05dO1xuICAgIGlmICghcG9zaXRpb25EZXNjKSB7XG4gICAgICAgIC8vIGlnbm9yZSBtZXNoZXMgd2l0aG91dCBwb3NpdGlvbnNcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IG51bVZlcnRpY2VzID0gcG9zaXRpb25EZXNjLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgdmVydGV4RGVzYyBlbGVtZW50c1xuICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHNlbWFudGljIGluIHNvdXJjZURlc2MpIHtcbiAgICAgICAgaWYgKHNvdXJjZURlc2MuaGFzT3duUHJvcGVydHkoc2VtYW50aWMpKSB7XG4gICAgICAgICAgICB2ZXJ0ZXhEZXNjLnB1c2goe1xuICAgICAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBzb3VyY2VEZXNjW3NlbWFudGljXS5jb21wb25lbnRzLFxuICAgICAgICAgICAgICAgIHR5cGU6IHNvdXJjZURlc2Nbc2VtYW50aWNdLnR5cGUsXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiAhIXNvdXJjZURlc2Nbc2VtYW50aWNdLm5vcm1hbGl6ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBvcmRlciB2ZXJ0ZXhEZXNjIHRvIG1hdGNoIHRoZSByZXN0IG9mIHRoZSBlbmdpbmVcbiAgICBjb25zdCBlbGVtZW50T3JkZXIgPSBbXG4gICAgICAgIFNFTUFOVElDX1BPU0lUSU9OLFxuICAgICAgICBTRU1BTlRJQ19OT1JNQUwsXG4gICAgICAgIFNFTUFOVElDX1RBTkdFTlQsXG4gICAgICAgIFNFTUFOVElDX0NPTE9SLFxuICAgICAgICBTRU1BTlRJQ19CTEVORElORElDRVMsXG4gICAgICAgIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgICAgICBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgICAgIFNFTUFOVElDX1RFWENPT1JEMVxuICAgIF07XG5cbiAgICAvLyBzb3J0IHZlcnRleCBlbGVtZW50cyBieSBlbmdpbmUtaWRlYWwgb3JkZXJcbiAgICB2ZXJ0ZXhEZXNjLnNvcnQoZnVuY3Rpb24gKGxocywgcmhzKSB7XG4gICAgICAgIGNvbnN0IGxoc09yZGVyID0gZWxlbWVudE9yZGVyLmluZGV4T2YobGhzLnNlbWFudGljKTtcbiAgICAgICAgY29uc3QgcmhzT3JkZXIgPSBlbGVtZW50T3JkZXIuaW5kZXhPZihyaHMuc2VtYW50aWMpO1xuICAgICAgICByZXR1cm4gKGxoc09yZGVyIDwgcmhzT3JkZXIpID8gLTEgOiAocmhzT3JkZXIgPCBsaHNPcmRlciA/IDEgOiAwKTtcbiAgICB9KTtcblxuICAgIGxldCBpLCBqLCBrO1xuICAgIGxldCBzb3VyY2UsIHRhcmdldCwgc291cmNlT2Zmc2V0O1xuXG4gICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdChkZXZpY2UsIHZlcnRleERlc2MpO1xuXG4gICAgLy8gY2hlY2sgd2hldGhlciBzb3VyY2UgZGF0YSBpcyBjb3JyZWN0bHkgaW50ZXJsZWF2ZWRcbiAgICBsZXQgaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCA9IHRydWU7XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB0YXJnZXQgPSB2ZXJ0ZXhGb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIHNvdXJjZSA9IHNvdXJjZURlc2NbdGFyZ2V0Lm5hbWVdO1xuICAgICAgICBzb3VyY2VPZmZzZXQgPSBzb3VyY2Uub2Zmc2V0IC0gcG9zaXRpb25EZXNjLm9mZnNldDtcbiAgICAgICAgaWYgKChzb3VyY2UuYnVmZmVyICE9PSBwb3NpdGlvbkRlc2MuYnVmZmVyKSB8fFxuICAgICAgICAgICAgKHNvdXJjZS5zdHJpZGUgIT09IHRhcmdldC5zdHJpZGUpIHx8XG4gICAgICAgICAgICAoc291cmNlLnNpemUgIT09IHRhcmdldC5zaXplKSB8fFxuICAgICAgICAgICAgKHNvdXJjZU9mZnNldCAhPT0gdGFyZ2V0Lm9mZnNldCkpIHtcbiAgICAgICAgICAgIGlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlIHZlcnRleCBidWZmZXJcbiAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKGRldmljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnRleEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bVZlcnRpY2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQlVGRkVSX1NUQVRJQyk7XG5cbiAgICBjb25zdCB2ZXJ0ZXhEYXRhID0gdmVydGV4QnVmZmVyLmxvY2soKTtcbiAgICBjb25zdCB0YXJnZXRBcnJheSA9IG5ldyBVaW50MzJBcnJheSh2ZXJ0ZXhEYXRhKTtcbiAgICBsZXQgc291cmNlQXJyYXk7XG5cbiAgICBpZiAoaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCkge1xuICAgICAgICAvLyBjb3B5IGRhdGFcbiAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkocG9zaXRpb25EZXNjLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25EZXNjLm9mZnNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmVydGljZXMgKiB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnNpemUgLyA0KTtcbiAgICAgICAgdGFyZ2V0QXJyYXkuc2V0KHNvdXJjZUFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgdGFyZ2V0U3RyaWRlLCBzb3VyY2VTdHJpZGU7XG4gICAgICAgIC8vIGNvcHkgZGF0YSBhbmQgaW50ZXJsZWF2ZVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgICAgIHRhcmdldFN0cmlkZSA9IHRhcmdldC5zdHJpZGUgLyA0O1xuXG4gICAgICAgICAgICBzb3VyY2UgPSBzb3VyY2VEZXNjW3RhcmdldC5uYW1lXTtcbiAgICAgICAgICAgIHNvdXJjZVN0cmlkZSA9IHNvdXJjZS5zdHJpZGUgLyA0O1xuICAgICAgICAgICAgLy8gZW5zdXJlIHdlIGRvbid0IGdvIGJleW9uZCB0aGUgZW5kIG9mIHRoZSBhcnJheWJ1ZmZlciB3aGVuIGRlYWxpbmcgd2l0aFxuICAgICAgICAgICAgLy8gaW50ZXJsYWNlZCB2ZXJ0ZXggZm9ybWF0c1xuICAgICAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkoc291cmNlLmJ1ZmZlciwgc291cmNlLm9mZnNldCwgKHNvdXJjZS5jb3VudCAtIDEpICogc291cmNlU3RyaWRlICsgKHNvdXJjZS5zaXplICsgMykgLyA0KTtcblxuICAgICAgICAgICAgbGV0IHNyYyA9IDA7XG4gICAgICAgICAgICBsZXQgZHN0ID0gdGFyZ2V0Lm9mZnNldCAvIDQ7XG4gICAgICAgICAgICBjb25zdCBrZW5kID0gTWF0aC5mbG9vcigoc291cmNlLnNpemUgKyAzKSAvIDQpO1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IG51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwga2VuZDsgKytrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldEFycmF5W2RzdCArIGtdID0gc291cmNlQXJyYXlbc3JjICsga107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNyYyArPSBzb3VyY2VTdHJpZGU7XG4gICAgICAgICAgICAgICAgZHN0ICs9IHRhcmdldFN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmbGlwVikge1xuICAgICAgICBmbGlwVGV4Q29vcmRWcyh2ZXJ0ZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIHZlcnRleEJ1ZmZlci51bmxvY2soKTtcblxuICAgIHJldHVybiB2ZXJ0ZXhCdWZmZXI7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXIgPSBmdW5jdGlvbiAoZGV2aWNlLCBhdHRyaWJ1dGVzLCBpbmRpY2VzLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCkge1xuXG4gICAgLy8gZXh0cmFjdCBsaXN0IG9mIGF0dHJpYnV0ZXMgdG8gdXNlXG4gICAgY29uc3QgdXNlQXR0cmlidXRlcyA9IHt9O1xuICAgIGNvbnN0IGF0dHJpYklkcyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBhdHRyaWIgaW4gYXR0cmlidXRlcykge1xuICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShhdHRyaWIpICYmIGdsdGZUb0VuZ2luZVNlbWFudGljTWFwLmhhc093blByb3BlcnR5KGF0dHJpYikpIHtcbiAgICAgICAgICAgIHVzZUF0dHJpYnV0ZXNbYXR0cmliXSA9IGF0dHJpYnV0ZXNbYXR0cmliXTtcblxuICAgICAgICAgICAgLy8gYnVpbGQgdW5pcXVlIGlkIGZvciBlYWNoIGF0dHJpYnV0ZSBpbiBmb3JtYXQ6IFNlbWFudGljOmFjY2Vzc29ySW5kZXhcbiAgICAgICAgICAgIGF0dHJpYklkcy5wdXNoKGF0dHJpYiArICc6JyArIGF0dHJpYnV0ZXNbYXR0cmliXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHVuaXF1ZSBpZHMgYW5kIGNyZWF0ZSB1bmlxdWUgdmVydGV4IGJ1ZmZlciBJRFxuICAgIGF0dHJpYklkcy5zb3J0KCk7XG4gICAgY29uc3QgdmJLZXkgPSBhdHRyaWJJZHMuam9pbigpO1xuXG4gICAgLy8gcmV0dXJuIGFscmVhZHkgY3JlYXRlZCB2ZXJ0ZXggYnVmZmVyIGlmIGlkZW50aWNhbFxuICAgIGxldCB2YiA9IHZlcnRleEJ1ZmZlckRpY3RbdmJLZXldO1xuICAgIGlmICghdmIpIHtcbiAgICAgICAgLy8gYnVpbGQgdmVydGV4IGJ1ZmZlciBmb3JtYXQgZGVzYyBhbmQgc291cmNlXG4gICAgICAgIGNvbnN0IHNvdXJjZURlc2MgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyaWIgaW4gdXNlQXR0cmlidXRlcykge1xuICAgICAgICAgICAgY29uc3QgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbYXR0cmlidXRlc1thdHRyaWJdXTtcbiAgICAgICAgICAgIGNvbnN0IGFjY2Vzc29yRGF0YSA9IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyVmlldyA9IGJ1ZmZlclZpZXdzW2FjY2Vzc29yLmJ1ZmZlclZpZXddO1xuICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFthdHRyaWJdO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSkgKiBnZXRDb21wb25lbnRTaXplSW5CeXRlcyhhY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgIGNvbnN0IHN0cmlkZSA9IGJ1ZmZlclZpZXcgJiYgYnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpID8gYnVmZmVyVmlldy5ieXRlU3RyaWRlIDogc2l6ZTtcbiAgICAgICAgICAgIHNvdXJjZURlc2Nbc2VtYW50aWNdID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYWNjZXNzb3JEYXRhLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgICAgIG9mZnNldDogYWNjZXNzb3JEYXRhLmJ5dGVPZmZzZXQsXG4gICAgICAgICAgICAgICAgc3RyaWRlOiBzdHJpZGUsXG4gICAgICAgICAgICAgICAgY291bnQ6IGFjY2Vzc29yLmNvdW50LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSksXG4gICAgICAgICAgICAgICAgdHlwZTogZ2V0Q29tcG9uZW50VHlwZShhY2Nlc3Nvci5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6IGFjY2Vzc29yLm5vcm1hbGl6ZWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBnZW5lcmF0ZSBub3JtYWxzIGlmIHRoZXkncmUgbWlzc2luZyAodGhpcyBzaG91bGQgcHJvYmFibHkgYmUgYSB1c2VyIG9wdGlvbilcbiAgICAgICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgICAgIGdlbmVyYXRlTm9ybWFscyhzb3VyY2VEZXNjLCBpbmRpY2VzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgc3RvcmUgaXQgaW4gdGhlIGRpY3Rpb25hcnlcbiAgICAgICAgdmIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbiAgICAgICAgdmVydGV4QnVmZmVyRGljdFt2YktleV0gPSB2YjtcbiAgICB9XG5cbiAgICByZXR1cm4gdmI7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXJEcmFjbyA9IGZ1bmN0aW9uIChkZXZpY2UsIG91dHB1dEdlb21ldHJ5LCBleHREcmFjbywgZGVjb2RlciwgZGVjb2Rlck1vZHVsZSwgaW5kaWNlcywgZmxpcFYpIHtcblxuICAgIGNvbnN0IG51bVBvaW50cyA9IG91dHB1dEdlb21ldHJ5Lm51bV9wb2ludHMoKTtcblxuICAgIC8vIGhlbHBlciBmdW5jdGlvbiB0byBkZWNvZGUgZGF0YSBzdHJlYW0gd2l0aCBpZCB0byBUeXBlZEFycmF5IG9mIGFwcHJvcHJpYXRlIHR5cGVcbiAgICBjb25zdCBleHRyYWN0RHJhY29BdHRyaWJ1dGVJbmZvID0gZnVuY3Rpb24gKHVuaXF1ZUlkLCBzZW1hbnRpYykge1xuICAgICAgICBjb25zdCBhdHRyaWJ1dGUgPSBkZWNvZGVyLkdldEF0dHJpYnV0ZUJ5VW5pcXVlSWQob3V0cHV0R2VvbWV0cnksIHVuaXF1ZUlkKTtcbiAgICAgICAgY29uc3QgbnVtVmFsdWVzID0gbnVtUG9pbnRzICogYXR0cmlidXRlLm51bV9jb21wb25lbnRzKCk7XG4gICAgICAgIGNvbnN0IGRyYWNvRm9ybWF0ID0gYXR0cmlidXRlLmRhdGFfdHlwZSgpO1xuICAgICAgICBsZXQgcHRyLCB2YWx1ZXMsIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBzdG9yYWdlVHlwZTtcblxuICAgICAgICAvLyBzdG9yYWdlIGZvcm1hdCBpcyBiYXNlZCBvbiBkcmFjbyBhdHRyaWJ1dGUgZGF0YSB0eXBlXG4gICAgICAgIHN3aXRjaCAoZHJhY29Gb3JtYXQpIHtcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX1VJTlQ4OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9VSU5UODtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRTaXplSW5CeXRlcyA9IDE7XG4gICAgICAgICAgICAgICAgcHRyID0gZGVjb2Rlck1vZHVsZS5fbWFsbG9jKG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzKTtcbiAgICAgICAgICAgICAgICBkZWNvZGVyLkdldEF0dHJpYnV0ZURhdGFBcnJheUZvckFsbFBvaW50cyhvdXRwdXRHZW9tZXRyeSwgYXR0cmlidXRlLCBkZWNvZGVyTW9kdWxlLkRUX1VJTlQ4LCBudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcywgcHRyKTtcbiAgICAgICAgICAgICAgICB2YWx1ZXMgPSBuZXcgVWludDhBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVOC5idWZmZXIsIHB0ciwgbnVtVmFsdWVzKS5zbGljZSgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIGRlY29kZXJNb2R1bGUuRFRfVUlOVDE2OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9VSU5UMTY7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50U2l6ZUluQnl0ZXMgPSAyO1xuICAgICAgICAgICAgICAgIHB0ciA9IGRlY29kZXJNb2R1bGUuX21hbGxvYyhudW1WYWx1ZXMgKiBjb21wb25lbnRTaXplSW5CeXRlcyk7XG4gICAgICAgICAgICAgICAgZGVjb2Rlci5HZXRBdHRyaWJ1dGVEYXRhQXJyYXlGb3JBbGxQb2ludHMob3V0cHV0R2VvbWV0cnksIGF0dHJpYnV0ZSwgZGVjb2Rlck1vZHVsZS5EVF9VSU5UMTYsIG51bVZhbHVlcyAqIGNvbXBvbmVudFNpemVJbkJ5dGVzLCBwdHIpO1xuICAgICAgICAgICAgICAgIHZhbHVlcyA9IG5ldyBVaW50MTZBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMTYuYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLkRUX0ZMT0FUMzI6XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzID0gNDtcbiAgICAgICAgICAgICAgICBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MobnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMpO1xuICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0QXR0cmlidXRlRGF0YUFycmF5Rm9yQWxsUG9pbnRzKG91dHB1dEdlb21ldHJ5LCBhdHRyaWJ1dGUsIGRlY29kZXJNb2R1bGUuRFRfRkxPQVQzMiwgbnVtVmFsdWVzICogY29tcG9uZW50U2l6ZUluQnl0ZXMsIHB0cik7XG4gICAgICAgICAgICAgICAgdmFsdWVzID0gbmV3IEZsb2F0MzJBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBGMzIuYnVmZmVyLCBwdHIsIG51bVZhbHVlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIGRlY29kZXJNb2R1bGUuX2ZyZWUocHRyKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWVzOiB2YWx1ZXMsXG4gICAgICAgICAgICBudW1Db21wb25lbnRzOiBhdHRyaWJ1dGUubnVtX2NvbXBvbmVudHMoKSxcbiAgICAgICAgICAgIGNvbXBvbmVudFNpemVJbkJ5dGVzOiBjb21wb25lbnRTaXplSW5CeXRlcyxcbiAgICAgICAgICAgIHN0b3JhZ2VUeXBlOiBzdG9yYWdlVHlwZSxcblxuICAgICAgICAgICAgLy8gdGhlcmUgYXJlIGdsYiBmaWxlcyBhcm91bmQgd2hlcmUgOGJpdCBjb2xvcnMgYXJlIG1pc3Npbmcgbm9ybWFsaXplZCBmbGFnXG4gICAgICAgICAgICBub3JtYWxpemVkOiAoc2VtYW50aWMgPT09IFNFTUFOVElDX0NPTE9SICYmIChzdG9yYWdlVHlwZSA9PT0gVFlQRV9VSU5UOCB8fCBzdG9yYWdlVHlwZSA9PT0gVFlQRV9VSU5UMTYpKSA/IHRydWUgOiBhdHRyaWJ1dGUubm9ybWFsaXplZCgpXG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIC8vIGJ1aWxkIHZlcnRleCBidWZmZXIgZm9ybWF0IGRlc2MgYW5kIHNvdXJjZVxuICAgIGNvbnN0IHNvdXJjZURlc2MgPSB7fTtcbiAgICBjb25zdCBhdHRyaWJ1dGVzID0gZXh0RHJhY28uYXR0cmlidXRlcztcbiAgICBmb3IgKGNvbnN0IGF0dHJpYiBpbiBhdHRyaWJ1dGVzKSB7XG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmhhc093blByb3BlcnR5KGF0dHJpYikgJiYgZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAuaGFzT3duUHJvcGVydHkoYXR0cmliKSkge1xuICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFthdHRyaWJdO1xuICAgICAgICAgICAgY29uc3QgYXR0cmlidXRlSW5mbyA9IGV4dHJhY3REcmFjb0F0dHJpYnV0ZUluZm8oYXR0cmlidXRlc1thdHRyaWJdLCBzZW1hbnRpYyk7XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBpbmZvIHdlJ2xsIG5lZWQgdG8gY29weSB0aGlzIGRhdGEgaW50byB0aGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGF0dHJpYnV0ZUluZm8ubnVtQ29tcG9uZW50cyAqIGF0dHJpYnV0ZUluZm8uY29tcG9uZW50U2l6ZUluQnl0ZXM7XG4gICAgICAgICAgICBzb3VyY2VEZXNjW3NlbWFudGljXSA9IHtcbiAgICAgICAgICAgICAgICB2YWx1ZXM6IGF0dHJpYnV0ZUluZm8udmFsdWVzLFxuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYXR0cmlidXRlSW5mby52YWx1ZXMuYnVmZmVyLFxuICAgICAgICAgICAgICAgIHNpemU6IHNpemUsXG4gICAgICAgICAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICAgICAgICAgIHN0cmlkZTogc2l6ZSxcbiAgICAgICAgICAgICAgICBjb3VudDogbnVtUG9pbnRzLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGF0dHJpYnV0ZUluZm8ubnVtQ29tcG9uZW50cyxcbiAgICAgICAgICAgICAgICB0eXBlOiBhdHRyaWJ1dGVJbmZvLnN0b3JhZ2VUeXBlLFxuICAgICAgICAgICAgICAgIG5vcm1hbGl6ZTogYXR0cmlidXRlSW5mby5ub3JtYWxpemVkXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFscyBpZiB0aGV5J3JlIG1pc3NpbmcgKHRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIGEgdXNlciBvcHRpb24pXG4gICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgZ2VuZXJhdGVOb3JtYWxzKHNvdXJjZURlc2MsIGluZGljZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbn07XG5cbmNvbnN0IGNyZWF0ZVNraW4gPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmU2tpbiwgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsYlNraW5zKSB7XG4gICAgbGV0IGksIGosIGJpbmRNYXRyaXg7XG4gICAgY29uc3Qgam9pbnRzID0gZ2x0ZlNraW4uam9pbnRzO1xuICAgIGNvbnN0IG51bUpvaW50cyA9IGpvaW50cy5sZW5ndGg7XG4gICAgY29uc3QgaWJwID0gW107XG4gICAgaWYgKGdsdGZTa2luLmhhc093blByb3BlcnR5KCdpbnZlcnNlQmluZE1hdHJpY2VzJykpIHtcbiAgICAgICAgY29uc3QgaW52ZXJzZUJpbmRNYXRyaWNlcyA9IGdsdGZTa2luLmludmVyc2VCaW5kTWF0cmljZXM7XG4gICAgICAgIGNvbnN0IGlibURhdGEgPSBnZXRBY2Nlc3NvckRhdGEoYWNjZXNzb3JzW2ludmVyc2VCaW5kTWF0cmljZXNdLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IGlibVZhbHVlcyA9IFtdO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBudW1Kb2ludHM7IGkrKykge1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IDE2OyBqKyspIHtcbiAgICAgICAgICAgICAgICBpYm1WYWx1ZXNbal0gPSBpYm1EYXRhW2kgKiAxNiArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYmluZE1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgICAgICBiaW5kTWF0cml4LnNldChpYm1WYWx1ZXMpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGJpbmRNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgaWJwLnB1c2goYmluZE1hdHJpeCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBib25lTmFtZXMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgYm9uZU5hbWVzW2ldID0gbm9kZXNbam9pbnRzW2ldXS5uYW1lO1xuICAgIH1cblxuICAgIC8vIGNyZWF0ZSBhIGNhY2hlIGtleSBmcm9tIGJvbmUgbmFtZXMgYW5kIHNlZSBpZiB3ZSBoYXZlIG1hdGNoaW5nIHNraW5cbiAgICBjb25zdCBrZXkgPSBib25lTmFtZXMuam9pbignIycpO1xuICAgIGxldCBza2luID0gZ2xiU2tpbnMuZ2V0KGtleSk7XG4gICAgaWYgKCFza2luKSB7XG5cbiAgICAgICAgLy8gY3JlYXRlIHRoZSBza2luIGFuZCBhZGQgaXQgdG8gdGhlIGNhY2hlXG4gICAgICAgIHNraW4gPSBuZXcgU2tpbihkZXZpY2UsIGlicCwgYm9uZU5hbWVzKTtcbiAgICAgICAgZ2xiU2tpbnMuc2V0KGtleSwgc2tpbik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNraW47XG59O1xuXG5jb25zdCB0ZW1wTWF0ID0gbmV3IE1hdDQoKTtcbmNvbnN0IHRlbXBWZWMgPSBuZXcgVmVjMygpO1xuXG5jb25zdCBjcmVhdGVNZXNoID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0Zk1lc2gsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgYXNzZXRPcHRpb25zKSB7XG4gICAgY29uc3QgbWVzaGVzID0gW107XG5cbiAgICBnbHRmTWVzaC5wcmltaXRpdmVzLmZvckVhY2goZnVuY3Rpb24gKHByaW1pdGl2ZSkge1xuXG4gICAgICAgIGxldCBwcmltaXRpdmVUeXBlLCB2ZXJ0ZXhCdWZmZXIsIG51bUluZGljZXM7XG4gICAgICAgIGxldCBpbmRpY2VzID0gbnVsbDtcbiAgICAgICAgbGV0IGNhblVzZU1vcnBoID0gdHJ1ZTtcblxuICAgICAgICAvLyB0cnkgYW5kIGdldCBkcmFjbyBjb21wcmVzc2VkIGRhdGEgZmlyc3RcbiAgICAgICAgaWYgKHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgnZXh0ZW5zaW9ucycpKSB7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb25zID0gcHJpbWl0aXZlLmV4dGVuc2lvbnM7XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb24nKSkge1xuXG4gICAgICAgICAgICAgICAgLy8gYWNjZXNzIERyYWNvRGVjb2Rlck1vZHVsZVxuICAgICAgICAgICAgICAgIGNvbnN0IGRlY29kZXJNb2R1bGUgPSBkcmFjb0RlY29kZXJJbnN0YW5jZSB8fCBnZXRHbG9iYWxEcmFjb0RlY29kZXJNb2R1bGUoKTtcbiAgICAgICAgICAgICAgICBpZiAoZGVjb2Rlck1vZHVsZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBleHREcmFjbyA9IGV4dGVuc2lvbnMuS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb247XG4gICAgICAgICAgICAgICAgICAgIGlmIChleHREcmFjby5oYXNPd25Qcm9wZXJ0eSgnYXR0cmlidXRlcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB1aW50OEJ1ZmZlciA9IGJ1ZmZlclZpZXdzW2V4dERyYWNvLmJ1ZmZlclZpZXddO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IGRlY29kZXJNb2R1bGUuRGVjb2RlckJ1ZmZlcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyLkluaXQodWludDhCdWZmZXIsIHVpbnQ4QnVmZmVyLmxlbmd0aCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlY29kZXIgPSBuZXcgZGVjb2Rlck1vZHVsZS5EZWNvZGVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBnZW9tZXRyeVR5cGUgPSBkZWNvZGVyLkdldEVuY29kZWRHZW9tZXRyeVR5cGUoYnVmZmVyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IG91dHB1dEdlb21ldHJ5LCBzdGF0dXM7XG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGdlb21ldHJ5VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgZGVjb2Rlck1vZHVsZS5QT0lOVF9DTE9VRDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVHlwZSA9IFBSSU1JVElWRV9QT0lOVFM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dEdlb21ldHJ5ID0gbmV3IGRlY29kZXJNb2R1bGUuUG9pbnRDbG91ZCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMgPSBkZWNvZGVyLkRlY29kZUJ1ZmZlclRvUG9pbnRDbG91ZChidWZmZXIsIG91dHB1dEdlb21ldHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLlRSSUFOR1VMQVJfTUVTSDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpbWl0aXZlVHlwZSA9IFBSSU1JVElWRV9UUklBTkdMRVM7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG91dHB1dEdlb21ldHJ5ID0gbmV3IGRlY29kZXJNb2R1bGUuTWVzaCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXMgPSBkZWNvZGVyLkRlY29kZUJ1ZmZlclRvTWVzaChidWZmZXIsIG91dHB1dEdlb21ldHJ5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSBkZWNvZGVyTW9kdWxlLklOVkFMSURfR0VPTUVUUllfVFlQRTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzdGF0dXMgfHwgIXN0YXR1cy5vaygpIHx8IG91dHB1dEdlb21ldHJ5LnB0ciA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCdGYWlsZWQgdG8gZGVjb2RlIGRyYWNvIGNvbXByZXNzZWQgYXNzZXQ6ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzdGF0dXMgPyBzdGF0dXMuZXJyb3JfbXNnKCkgOiAoJ01lc2ggYXNzZXQgLSBpbnZhbGlkIGRyYWNvIGNvbXByZXNzZWQgZ2VvbWV0cnkgdHlwZTogJyArIGdlb21ldHJ5VHlwZSkpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluZGljZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG51bUZhY2VzID0gb3V0cHV0R2VvbWV0cnkubnVtX2ZhY2VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZ2VvbWV0cnlUeXBlID09PSBkZWNvZGVyTW9kdWxlLlRSSUFOR1VMQVJfTUVTSCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpdDMyID0gb3V0cHV0R2VvbWV0cnkubnVtX3BvaW50cygpID4gNjU1MzU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1JbmRpY2VzID0gbnVtRmFjZXMgKiAzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGFTaXplID0gbnVtSW5kaWNlcyAqIChiaXQzMiA/IDQgOiAyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwdHIgPSBkZWNvZGVyTW9kdWxlLl9tYWxsb2MoZGF0YVNpemUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGJpdDMyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXIuR2V0VHJpYW5nbGVzVUludDMyQXJyYXkob3V0cHV0R2VvbWV0cnksIGRhdGFTaXplLCBwdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQzMkFycmF5KGRlY29kZXJNb2R1bGUuSEVBUFUzMi5idWZmZXIsIHB0ciwgbnVtSW5kaWNlcykuc2xpY2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyLkdldFRyaWFuZ2xlc1VJbnQxNkFycmF5KG91dHB1dEdlb21ldHJ5LCBkYXRhU2l6ZSwgcHRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShkZWNvZGVyTW9kdWxlLkhFQVBVMTYuYnVmZmVyLCBwdHIsIG51bUluZGljZXMpLnNsaWNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVjb2Rlck1vZHVsZS5fZnJlZShwdHIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB2ZXJ0aWNlc1xuICAgICAgICAgICAgICAgICAgICAgICAgdmVydGV4QnVmZmVyID0gY3JlYXRlVmVydGV4QnVmZmVyRHJhY28oZGV2aWNlLCBvdXRwdXRHZW9tZXRyeSwgZXh0RHJhY28sIGRlY29kZXIsIGRlY29kZXJNb2R1bGUsIGluZGljZXMsIGZsaXBWKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xlYW4gdXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlY29kZXJNb2R1bGUuZGVzdHJveShvdXRwdXRHZW9tZXRyeSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLmRlc3Ryb3koZGVjb2Rlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWNvZGVyTW9kdWxlLmRlc3Ryb3koYnVmZmVyKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbW9ycGggc3RyZWFtcyBhcmUgbm90IGNvbXBhdGlibGUgd2l0aCBkcmFjbyBjb21wcmVzc2lvbiwgZGlzYWJsZSBtb3JwaGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FuVXNlTW9ycGggPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0ZpbGUgY29udGFpbnMgZHJhY28gY29tcHJlc3NlZCBkYXRhLCBidXQgRHJhY29EZWNvZGVyTW9kdWxlIGlzIG5vdCBjb25maWd1cmVkLicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIG1lc2ggd2FzIG5vdCBjb25zdHJ1Y3RlZCBmcm9tIGRyYWNvIGRhdGEsIHVzZSB1bmNvbXByZXNzZWRcbiAgICAgICAgaWYgKCF2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIGluZGljZXMgPSBwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ2luZGljZXMnKSA/IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvcnNbcHJpbWl0aXZlLmluZGljZXNdLCBidWZmZXJWaWV3cywgdHJ1ZSkgOiBudWxsO1xuICAgICAgICAgICAgdmVydGV4QnVmZmVyID0gY3JlYXRlVmVydGV4QnVmZmVyKGRldmljZSwgcHJpbWl0aXZlLmF0dHJpYnV0ZXMsIGluZGljZXMsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0KTtcbiAgICAgICAgICAgIHByaW1pdGl2ZVR5cGUgPSBnZXRQcmltaXRpdmVUeXBlKHByaW1pdGl2ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbWVzaCA9IG51bGw7XG4gICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIGJ1aWxkIHRoZSBtZXNoXG4gICAgICAgICAgICBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICAgICAgICAgIG1lc2gudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0udHlwZSA9IHByaW1pdGl2ZVR5cGU7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5iYXNlID0gMDtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSAoaW5kaWNlcyAhPT0gbnVsbCk7XG5cbiAgICAgICAgICAgIC8vIGluZGV4IGJ1ZmZlclxuICAgICAgICAgICAgaWYgKGluZGljZXMgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXhGb3JtYXQ7XG4gICAgICAgICAgICAgICAgaWYgKGluZGljZXMgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDg7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpbmRpY2VzIGluc3RhbmNlb2YgVWludDE2QXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMTY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMzI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gMzJiaXQgaW5kZXggYnVmZmVyIGlzIHVzZWQgYnV0IG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhGb3JtYXQgPT09IElOREVYRk9STUFUX1VJTlQzMiAmJiAhZGV2aWNlLmV4dFVpbnRFbGVtZW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgICAgICBpZiAodmVydGV4QnVmZmVyLm51bVZlcnRpY2VzID4gMHhGRkZGKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0dsYiBmaWxlIGNvbnRhaW5zIDMyYml0IGluZGV4IGJ1ZmZlciBidXQgdGhlc2UgYXJlIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBkZXZpY2UgLSBpdCBtYXkgYmUgcmVuZGVyZWQgaW5jb3JyZWN0bHkuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29udmVydCB0byAxNmJpdFxuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShpbmRpY2VzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhGb3JtYXQgPT09IElOREVYRk9STUFUX1VJTlQ4ICYmIGRldmljZS5pc1dlYkdQVSkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdHbGIgZmlsZSBjb250YWlucyA4Yml0IGluZGV4IGJ1ZmZlciBidXQgdGhlc2UgYXJlIG5vdCBzdXBwb3J0ZWQgYnkgV2ViR1BVIC0gY29udmVydGluZyB0byAxNmJpdC4nKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjb252ZXJ0IHRvIDE2Yml0XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KGluZGljZXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gbmV3IEluZGV4QnVmZmVyKGRldmljZSwgaW5kZXhGb3JtYXQsIGluZGljZXMubGVuZ3RoLCBCVUZGRVJfU1RBVElDLCBpbmRpY2VzKTtcbiAgICAgICAgICAgICAgICBtZXNoLmluZGV4QnVmZmVyWzBdID0gaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPSBpbmRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPSB2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoXCJleHRlbnNpb25zXCIpICYmIHByaW1pdGl2ZS5leHRlbnNpb25zLmhhc093blByb3BlcnR5KFwiS0hSX21hdGVyaWFsc192YXJpYW50c1wiKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhcmlhbnRzID0gcHJpbWl0aXZlLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cztcbiAgICAgICAgICAgICAgICBjb25zdCB0ZW1wTWFwcGluZyA9IHt9O1xuICAgICAgICAgICAgICAgIHZhcmlhbnRzLm1hcHBpbmdzLmZvckVhY2goKG1hcHBpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZy52YXJpYW50cy5mb3JFYWNoKCh2YXJpYW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wTWFwcGluZ1t2YXJpYW50XSA9IG1hcHBpbmcubWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIG1lc2hWYXJpYW50c1ttZXNoLmlkXSA9IHRlbXBNYXBwaW5nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtZXNoRGVmYXVsdE1hdGVyaWFsc1ttZXNoLmlkXSA9IHByaW1pdGl2ZS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgbGV0IGFjY2Vzc29yID0gYWNjZXNzb3JzW3ByaW1pdGl2ZS5hdHRyaWJ1dGVzLlBPU0lUSU9OXTtcbiAgICAgICAgICAgIG1lc2guYWFiYiA9IGdldEFjY2Vzc29yQm91bmRpbmdCb3goYWNjZXNzb3IpO1xuXG4gICAgICAgICAgICAvLyBtb3JwaCB0YXJnZXRzXG4gICAgICAgICAgICBpZiAoY2FuVXNlTW9ycGggJiYgcHJpbWl0aXZlLmhhc093blByb3BlcnR5KCd0YXJnZXRzJykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRzID0gW107XG5cbiAgICAgICAgICAgICAgICBwcmltaXRpdmUudGFyZ2V0cy5mb3JFYWNoKGZ1bmN0aW9uICh0YXJnZXQsIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7fTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Lmhhc093blByb3BlcnR5KCdQT1NJVElPTicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2Nlc3NvciA9IGFjY2Vzc29yc1t0YXJnZXQuUE9TSVRJT05dO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YVBvc2l0aW9ucyA9IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoYWNjZXNzb3IsIGJ1ZmZlclZpZXdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFQb3NpdGlvbnNUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5hYWJiID0gZ2V0QWNjZXNzb3JCb3VuZGluZ0JveChhY2Nlc3Nvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Lmhhc093blByb3BlcnR5KCdOT1JNQUwnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbdGFyZ2V0Lk5PUk1BTF07XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOT1RFOiB0aGUgbW9ycGggdGFyZ2V0cyBjYW4ndCBjdXJyZW50bHkgYWNjZXB0IHF1YW50aXplZCBub3JtYWxzXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhTm9ybWFscyA9IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoYWNjZXNzb3IsIGJ1ZmZlclZpZXdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFOb3JtYWxzVHlwZSA9IFRZUEVfRkxPQVQzMjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIG5hbWUgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTWVzaC5oYXNPd25Qcm9wZXJ0eSgnZXh0cmFzJykgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZNZXNoLmV4dHJhcy5oYXNPd25Qcm9wZXJ0eSgndGFyZ2V0TmFtZXMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uYW1lID0gZ2x0Zk1lc2guZXh0cmFzLnRhcmdldE5hbWVzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubmFtZSA9IGluZGV4LnRvU3RyaW5nKDEwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgd2VpZ2h0IGlmIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0Zk1lc2guaGFzT3duUHJvcGVydHkoJ3dlaWdodHMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWZhdWx0V2VpZ2h0ID0gZ2x0Zk1lc2gud2VpZ2h0c1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnByZXNlcnZlRGF0YSA9IGFzc2V0T3B0aW9ucy5tb3JwaFByZXNlcnZlRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0cy5wdXNoKG5ldyBNb3JwaFRhcmdldChvcHRpb25zKSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBtZXNoLm1vcnBoID0gbmV3IE1vcnBoKHRhcmdldHMsIGRldmljZSwge1xuICAgICAgICAgICAgICAgICAgICBwcmVmZXJIaWdoUHJlY2lzaW9uOiBhc3NldE9wdGlvbnMubW9ycGhQcmVmZXJIaWdoUHJlY2lzaW9uXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBtZXNoZXMucHVzaChtZXNoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBtZXNoZXM7XG59O1xuXG5jb25zdCBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybSA9IGZ1bmN0aW9uIChzb3VyY2UsIG1hdGVyaWFsLCBtYXBzKSB7XG4gICAgbGV0IG1hcDtcblxuICAgIGNvbnN0IHRleENvb3JkID0gc291cmNlLnRleENvb3JkO1xuICAgIGlmICh0ZXhDb29yZCkge1xuICAgICAgICBmb3IgKG1hcCA9IDA7IG1hcCA8IG1hcHMubGVuZ3RoOyArK21hcCkge1xuICAgICAgICAgICAgbWF0ZXJpYWxbbWFwc1ttYXBdICsgJ01hcFV2J10gPSB0ZXhDb29yZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHplcm9zID0gWzAsIDBdO1xuICAgIGNvbnN0IG9uZXMgPSBbMSwgMV07XG4gICAgY29uc3QgdGV4dHVyZVRyYW5zZm9ybSA9IHNvdXJjZS5leHRlbnNpb25zPy5LSFJfdGV4dHVyZV90cmFuc2Zvcm07XG4gICAgaWYgKHRleHR1cmVUcmFuc2Zvcm0pIHtcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdGV4dHVyZVRyYW5zZm9ybS5vZmZzZXQgfHwgemVyb3M7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gdGV4dHVyZVRyYW5zZm9ybS5zY2FsZSB8fCBvbmVzO1xuICAgICAgICBjb25zdCByb3RhdGlvbiA9IHRleHR1cmVUcmFuc2Zvcm0ucm90YXRpb24gPyAoLXRleHR1cmVUcmFuc2Zvcm0ucm90YXRpb24gKiBtYXRoLlJBRF9UT19ERUcpIDogMDtcblxuICAgICAgICBjb25zdCB0aWxpbmdWZWMgPSBuZXcgVmVjMihzY2FsZVswXSwgc2NhbGVbMV0pO1xuICAgICAgICBjb25zdCBvZmZzZXRWZWMgPSBuZXcgVmVjMihvZmZzZXRbMF0sIDEuMCAtIHNjYWxlWzFdIC0gb2Zmc2V0WzFdKTtcblxuICAgICAgICBmb3IgKG1hcCA9IDA7IG1hcCA8IG1hcHMubGVuZ3RoOyArK21hcCkge1xuICAgICAgICAgICAgbWF0ZXJpYWxbYCR7bWFwc1ttYXBdfU1hcFRpbGluZ2BdID0gdGlsaW5nVmVjO1xuICAgICAgICAgICAgbWF0ZXJpYWxbYCR7bWFwc1ttYXBdfU1hcE9mZnNldGBdID0gb2Zmc2V0VmVjO1xuICAgICAgICAgICAgbWF0ZXJpYWxbYCR7bWFwc1ttYXBdfU1hcFJvdGF0aW9uYF0gPSByb3RhdGlvbjtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIGxldCBjb2xvciwgdGV4dHVyZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZGlmZnVzZUZhY3RvcicpKSB7XG4gICAgICAgIGNvbG9yID0gZGF0YS5kaWZmdXNlRmFjdG9yO1xuICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSBjb2xvclszXTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgxLCAxLCAxKTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IDE7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdkaWZmdXNlVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGRpZmZ1c2VUZXh0dXJlID0gZGF0YS5kaWZmdXNlVGV4dHVyZTtcbiAgICAgICAgdGV4dHVyZSA9IHRleHR1cmVzW2RpZmZ1c2VUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwID0gdGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcCA9IHRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRpZmZ1c2VUZXh0dXJlLCBtYXRlcmlhbCwgWydkaWZmdXNlJywgJ29wYWNpdHknXSk7XG4gICAgfVxuICAgIG1hdGVyaWFsLnVzZU1ldGFsbmVzcyA9IGZhbHNlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckZhY3RvcicpKSB7XG4gICAgICAgIGNvbG9yID0gZGF0YS5zcGVjdWxhckZhY3RvcjtcbiAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdnbG9zc2luZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuZ2xvc3MgPSBkYXRhLmdsb3NzaW5lc3NGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZ2xvc3MgPSAxLjA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZSA9IGRhdGEuc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJFbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSBtYXRlcmlhbC5nbG9zc01hcCA9IHRleHR1cmVzW3NwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcENoYW5uZWwgPSAncmdiJztcbiAgICAgICAgbWF0ZXJpYWwuZ2xvc3NNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKHNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2dsb3NzJywgJ21ldGFsbmVzcyddKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25DbGVhckNvYXQgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdEZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdCA9IGRhdGEuY2xlYXJjb2F0RmFjdG9yICogMC4yNTsgLy8gVE9ETzogcmVtb3ZlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciByZXBsaWNhdGluZyBnbFRGIGNsZWFyLWNvYXQgdmlzdWFsc1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdCA9IDA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgY2xlYXJjb2F0VGV4dHVyZSA9IGRhdGEuY2xlYXJjb2F0VGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0TWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0VGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdE1hcENoYW5uZWwgPSAncic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0VGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0J10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3MgPSBkYXRhLmNsZWFyY29hdFJvdWdobmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zcyA9IDA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSA9IGRhdGEuY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsID0gJ2cnO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2NsZWFyQ29hdEdsb3NzJ10pO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdE5vcm1hbFRleHR1cmUgPSBkYXRhLmNsZWFyY29hdE5vcm1hbFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdE5vcm1hbE1hcCA9IHRleHR1cmVzW2NsZWFyY29hdE5vcm1hbFRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGNsZWFyY29hdE5vcm1hbFRleHR1cmUsIG1hdGVyaWFsLCBbJ2NsZWFyQ29hdE5vcm1hbCddKTtcblxuICAgICAgICBpZiAoY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZS5oYXNPd25Qcm9wZXJ0eSgnc2NhbGUnKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0QnVtcGluZXNzID0gY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZS5zY2FsZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzSW52ZXJ0ID0gdHJ1ZTtcbn07XG5cbmNvbnN0IGV4dGVuc2lvblVubGl0ID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZUxpZ2h0aW5nID0gZmFsc2U7XG5cbiAgICAvLyBjb3B5IGRpZmZ1c2UgaW50byBlbWlzc2l2ZVxuICAgIG1hdGVyaWFsLmVtaXNzaXZlLmNvcHkobWF0ZXJpYWwuZGlmZnVzZSk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gbWF0ZXJpYWwuZGlmZnVzZVRpbnQ7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSBtYXRlcmlhbC5kaWZmdXNlTWFwO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwVXYgPSBtYXRlcmlhbC5kaWZmdXNlTWFwVXY7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBUaWxpbmcuY29weShtYXRlcmlhbC5kaWZmdXNlTWFwVGlsaW5nKTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcE9mZnNldC5jb3B5KG1hdGVyaWFsLmRpZmZ1c2VNYXBPZmZzZXQpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwUm90YXRpb24gPSBtYXRlcmlhbC5kaWZmdXNlTWFwUm90YXRpb247XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBDaGFubmVsID0gbWF0ZXJpYWwuZGlmZnVzZU1hcENoYW5uZWw7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVWZXJ0ZXhDb2xvciA9IG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvcjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCA9IG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvckNoYW5uZWw7XG5cbiAgICAvLyBibGFuayBkaWZmdXNlXG4gICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMCwgMCwgMCk7XG4gICAgbWF0ZXJpYWwuZGlmZnVzZVRpbnQgPSBmYWxzZTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlTWFwID0gbnVsbDtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3IgPSBmYWxzZTtcbn07XG5cbmNvbnN0IGV4dGVuc2lvblNwZWN1bGFyID0gZnVuY3Rpb24gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykge1xuICAgIG1hdGVyaWFsLnVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IgPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckNvbG9yVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyRW5jb2RpbmcgPSAnc3JnYic7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwID0gdGV4dHVyZXNbZGF0YS5zcGVjdWxhckNvbG9yVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwQ2hhbm5lbCA9ICdyZ2InO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc3BlY3VsYXJDb2xvclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NwZWN1bGFyJ10pO1xuXG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzcGVjdWxhckNvbG9yRmFjdG9yJykpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSBkYXRhLnNwZWN1bGFyQ29sb3JGYWN0b3I7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgfVxuXG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3IgPSBkYXRhLnNwZWN1bGFyRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyaXR5RmFjdG9yID0gMTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyaXR5RmFjdG9yTWFwQ2hhbm5lbCA9ICdhJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3JNYXAgPSB0ZXh0dXJlc1tkYXRhLnNwZWN1bGFyVGV4dHVyZS5pbmRleF07XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEuc3BlY3VsYXJUZXh0dXJlLCBtYXRlcmlhbCwgWydzcGVjdWxhcml0eUZhY3RvciddKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25Jb3IgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25JbmRleCA9IDEuMCAvIGRhdGEuaW9yO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvblRyYW5zbWlzc2lvbiA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgbWF0ZXJpYWwudXNlRHluYW1pY1JlZnJhY3Rpb24gPSB0cnVlO1xuXG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RyYW5zbWlzc2lvbkZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb24gPSBkYXRhLnRyYW5zbWlzc2lvbkZhY3RvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RyYW5zbWlzc2lvblRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uTWFwQ2hhbm5lbCA9ICdyJztcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbk1hcCA9IHRleHR1cmVzW2RhdGEudHJhbnNtaXNzaW9uVGV4dHVyZS5pbmRleF07XG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGRhdGEudHJhbnNtaXNzaW9uVGV4dHVyZSwgbWF0ZXJpYWwsIFsncmVmcmFjdGlvbiddKTtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25TaGVlbiA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC51c2VTaGVlbiA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuQ29sb3JGYWN0b3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuc2hlZW5Db2xvckZhY3RvcjtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW4uc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuLnNldCgxLCAxLCAxKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5NYXAgPSB0ZXh0dXJlc1tkYXRhLnNoZWVuQ29sb3JUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5FbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zaGVlbkNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc2hlZW4nXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlblJvdWdobmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3MgPSBkYXRhLnNoZWVuUm91Z2huZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3MgPSAwLjA7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdzaGVlblJvdWdobmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzTWFwID0gdGV4dHVyZXNbZGF0YS5zaGVlblJvdWdobmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkdsb3NzTWFwQ2hhbm5lbCA9ICdhJztcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zaGVlblJvdWdobmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ3NoZWVuR2xvc3MnXSk7XG4gICAgfVxuXG4gICAgbWF0ZXJpYWwuc2hlZW5HbG9zc0ludmVydCA9IHRydWU7XG59O1xuXG5jb25zdCBleHRlbnNpb25Wb2x1bWUgPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9STUFMO1xuICAgIG1hdGVyaWFsLnVzZUR5bmFtaWNSZWZyYWN0aW9uID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndGhpY2tuZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwudGhpY2tuZXNzID0gZGF0YS50aGlja25lc3NGYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0aGlja25lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwudGhpY2tuZXNzTWFwID0gdGV4dHVyZXNbZGF0YS50aGlja25lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwudGhpY2tuZXNzTWFwQ2hhbm5lbCA9ICdnJztcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS50aGlja25lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWyd0aGlja25lc3MnXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdhdHRlbnVhdGlvbkRpc3RhbmNlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuYXR0ZW51YXRpb25EaXN0YW5jZSA9IGRhdGEuYXR0ZW51YXRpb25EaXN0YW5jZTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2F0dGVudWF0aW9uQ29sb3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuYXR0ZW51YXRpb25Db2xvcjtcbiAgICAgICAgbWF0ZXJpYWwuYXR0ZW51YXRpb24uc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbkVtaXNzaXZlU3RyZW5ndGggPSBmdW5jdGlvbiAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSB7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlU3RyZW5ndGgnKSkge1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZUludGVuc2l0eSA9IGRhdGEuZW1pc3NpdmVTdHJlbmd0aDtcbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25JcmlkZXNjZW5jZSA9IGZ1bmN0aW9uIChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpIHtcbiAgICBtYXRlcmlhbC51c2VJcmlkZXNjZW5jZSA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2UgPSBkYXRhLmlyaWRlc2NlbmNlRmFjdG9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VNYXBDaGFubmVsID0gJ3InO1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZU1hcCA9IHRleHR1cmVzW2RhdGEuaXJpZGVzY2VuY2VUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5pcmlkZXNjZW5jZVRleHR1cmUsIG1hdGVyaWFsLCBbJ2lyaWRlc2NlbmNlJ10pO1xuXG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZUlvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4ID0gZGF0YS5pcmlkZXNjZW5jZUlvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWluID0gZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc01pbmltdW07XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW0nKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01heCA9IGRhdGEuaXJpZGVzY2VuY2VUaGlja25lc3NNYXhpbXVtO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUaGlja25lc3NUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsID0gJ2cnO1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01hcCA9IHRleHR1cmVzW2RhdGEuaXJpZGVzY2VuY2VUaGlja25lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2lyaWRlc2NlbmNlVGhpY2tuZXNzJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGNyZWF0ZU1hdGVyaWFsID0gZnVuY3Rpb24gKGdsdGZNYXRlcmlhbCwgdGV4dHVyZXMsIGZsaXBWKSB7XG4gICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuXG4gICAgLy8gZ2xURiBkb2Vzbid0IGRlZmluZSBob3cgdG8gb2NjbHVkZSBzcGVjdWxhclxuICAgIG1hdGVyaWFsLm9jY2x1ZGVTcGVjdWxhciA9IFNQRUNPQ0NfQU87XG5cbiAgICBtYXRlcmlhbC5kaWZmdXNlVGludCA9IHRydWU7XG4gICAgbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yID0gdHJ1ZTtcblxuICAgIG1hdGVyaWFsLnNwZWN1bGFyVGludCA9IHRydWU7XG4gICAgbWF0ZXJpYWwuc3BlY3VsYXJWZXJ0ZXhDb2xvciA9IHRydWU7XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCduYW1lJykpIHtcbiAgICAgICAgbWF0ZXJpYWwubmFtZSA9IGdsdGZNYXRlcmlhbC5uYW1lO1xuICAgIH1cblxuICAgIGxldCBjb2xvciwgdGV4dHVyZTtcbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdwYnJNZXRhbGxpY1JvdWdobmVzcycpKSB7XG4gICAgICAgIGNvbnN0IHBickRhdGEgPSBnbHRmTWF0ZXJpYWwucGJyTWV0YWxsaWNSb3VnaG5lc3M7XG5cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ2Jhc2VDb2xvckZhY3RvcicpKSB7XG4gICAgICAgICAgICBjb2xvciA9IHBickRhdGEuYmFzZUNvbG9yRmFjdG9yO1xuICAgICAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSBjb2xvclszXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDEsIDEsIDEpO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ2Jhc2VDb2xvclRleHR1cmUnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUNvbG9yVGV4dHVyZSA9IHBickRhdGEuYmFzZUNvbG9yVGV4dHVyZTtcbiAgICAgICAgICAgIHRleHR1cmUgPSB0ZXh0dXJlc1tiYXNlQ29sb3JUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IHRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcCA9IHRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oYmFzZUNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZGlmZnVzZScsICdvcGFjaXR5J10pO1xuICAgICAgICB9XG4gICAgICAgIG1hdGVyaWFsLnVzZU1ldGFsbmVzcyA9IHRydWU7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ21ldGFsbGljRmFjdG9yJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzcyA9IHBickRhdGEubWV0YWxsaWNGYWN0b3I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3MgPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdyb3VnaG5lc3NGYWN0b3InKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuZ2xvc3MgPSBwYnJEYXRhLnJvdWdobmVzc0ZhY3RvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmdsb3NzID0gMTtcbiAgICAgICAgfVxuICAgICAgICBtYXRlcmlhbC5nbG9zc0ludmVydCA9IHRydWU7XG4gICAgICAgIGlmIChwYnJEYXRhLmhhc093blByb3BlcnR5KCdtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUnKSkge1xuICAgICAgICAgICAgY29uc3QgbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlID0gcGJyRGF0YS5tZXRhbGxpY1JvdWdobmVzc1RleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3NNYXAgPSBtYXRlcmlhbC5nbG9zc01hcCA9IHRleHR1cmVzW21ldGFsbGljUm91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgICAgICBtYXRlcmlhbC5tZXRhbG5lc3NNYXBDaGFubmVsID0gJ2InO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZ2xvc3NNYXBDaGFubmVsID0gJ2cnO1xuXG4gICAgICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ2dsb3NzJywgJ21ldGFsbmVzcyddKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ25vcm1hbFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBub3JtYWxUZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLm5vcm1hbFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLm5vcm1hbE1hcCA9IHRleHR1cmVzW25vcm1hbFRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG5vcm1hbFRleHR1cmUsIG1hdGVyaWFsLCBbJ25vcm1hbCddKTtcblxuICAgICAgICBpZiAobm9ybWFsVGV4dHVyZS5oYXNPd25Qcm9wZXJ0eSgnc2NhbGUnKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwuYnVtcGluZXNzID0gbm9ybWFsVGV4dHVyZS5zY2FsZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdvY2NsdXNpb25UZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3Qgb2NjbHVzaW9uVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5vY2NsdXNpb25UZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5hb01hcCA9IHRleHR1cmVzW29jY2x1c2lvblRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5hb01hcENoYW5uZWwgPSAncic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0ob2NjbHVzaW9uVGV4dHVyZSwgbWF0ZXJpYWwsIFsnYW8nXSk7XG4gICAgICAgIC8vIFRPRE86IHN1cHBvcnQgJ3N0cmVuZ3RoJ1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdlbWlzc2l2ZUZhY3RvcicpKSB7XG4gICAgICAgIGNvbG9yID0gZ2x0Zk1hdGVyaWFsLmVtaXNzaXZlRmFjdG9yO1xuICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmUuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldCgwLCAwLCAwKTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gZmFsc2U7XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGVtaXNzaXZlVGV4dHVyZSA9IGdsdGZNYXRlcmlhbC5lbWlzc2l2ZVRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwID0gdGV4dHVyZXNbZW1pc3NpdmVUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShlbWlzc2l2ZVRleHR1cmUsIG1hdGVyaWFsLCBbJ2VtaXNzaXZlJ10pO1xuICAgIH1cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdhbHBoYU1vZGUnKSkge1xuICAgICAgICBzd2l0Y2ggKGdsdGZNYXRlcmlhbC5hbHBoYU1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgJ01BU0snOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnYWxwaGFDdXRvZmYnKSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbHBoYVRlc3QgPSBnbHRmTWF0ZXJpYWwuYWxwaGFDdXRvZmY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwuYWxwaGFUZXN0ID0gMC41O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ0JMRU5EJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgICAgICAgICAgICAgLy8gbm90ZTogYnkgZGVmYXVsdCBkb24ndCB3cml0ZSBkZXB0aCBvbiBzZW1pdHJhbnNwYXJlbnQgbWF0ZXJpYWxzXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuZGVwdGhXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGNhc2UgJ09QQVFVRSc6XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PTkU7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZG91YmxlU2lkZWQnKSkge1xuICAgICAgICBtYXRlcmlhbC50d29TaWRlZExpZ2h0aW5nID0gZ2x0Zk1hdGVyaWFsLmRvdWJsZVNpZGVkO1xuICAgICAgICBtYXRlcmlhbC5jdWxsID0gZ2x0Zk1hdGVyaWFsLmRvdWJsZVNpZGVkID8gQ1VMTEZBQ0VfTk9ORSA6IENVTExGQUNFX0JBQ0s7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwudHdvU2lkZWRMaWdodGluZyA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfQkFDSztcbiAgICB9XG5cbiAgICAvLyBQcm92aWRlIGxpc3Qgb2Ygc3VwcG9ydGVkIGV4dGVuc2lvbnMgYW5kIHRoZWlyIGZ1bmN0aW9uc1xuICAgIGNvbnN0IGV4dGVuc2lvbnMgPSB7XG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19jbGVhcmNvYXRcIjogZXh0ZW5zaW9uQ2xlYXJDb2F0LFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfZW1pc3NpdmVfc3RyZW5ndGhcIjogZXh0ZW5zaW9uRW1pc3NpdmVTdHJlbmd0aCxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2lvclwiOiBleHRlbnNpb25Jb3IsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19pcmlkZXNjZW5jZVwiOiBleHRlbnNpb25JcmlkZXNjZW5jZSxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3BiclNwZWN1bGFyR2xvc3NpbmVzc1wiOiBleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3NoZWVuXCI6IGV4dGVuc2lvblNoZWVuLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfc3BlY3VsYXJcIjogZXh0ZW5zaW9uU3BlY3VsYXIsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc190cmFuc21pc3Npb25cIjogZXh0ZW5zaW9uVHJhbnNtaXNzaW9uLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfdW5saXRcIjogZXh0ZW5zaW9uVW5saXQsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc192b2x1bWVcIjogZXh0ZW5zaW9uVm9sdW1lXG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSBleHRlbnNpb25zXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZXh0ZW5zaW9ucycpKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGdsdGZNYXRlcmlhbC5leHRlbnNpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBleHRlbnNpb25GdW5jID0gZXh0ZW5zaW9uc1trZXldO1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbkZ1bmMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGV4dGVuc2lvbkZ1bmMoZ2x0Zk1hdGVyaWFsLmV4dGVuc2lvbnNba2V5XSwgbWF0ZXJpYWwsIHRleHR1cmVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgcmV0dXJuIG1hdGVyaWFsO1xufTtcblxuLy8gY3JlYXRlIHRoZSBhbmltIHN0cnVjdHVyZVxuY29uc3QgY3JlYXRlQW5pbWF0aW9uID0gZnVuY3Rpb24gKGdsdGZBbmltYXRpb24sIGFuaW1hdGlvbkluZGV4LCBnbHRmQWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIG1lc2hlcywgZ2x0Zk5vZGVzKSB7XG5cbiAgICAvLyBjcmVhdGUgYW5pbWF0aW9uIGRhdGEgYmxvY2sgZm9yIHRoZSBhY2Nlc3NvclxuICAgIGNvbnN0IGNyZWF0ZUFuaW1EYXRhID0gZnVuY3Rpb24gKGdsdGZBY2Nlc3Nvcikge1xuICAgICAgICByZXR1cm4gbmV3IEFuaW1EYXRhKGdldE51bUNvbXBvbmVudHMoZ2x0ZkFjY2Vzc29yLnR5cGUpLCBnZXRBY2Nlc3NvckRhdGFGbG9hdDMyKGdsdGZBY2Nlc3NvciwgYnVmZmVyVmlld3MpKTtcbiAgICB9O1xuXG4gICAgY29uc3QgaW50ZXJwTWFwID0ge1xuICAgICAgICAnU1RFUCc6IElOVEVSUE9MQVRJT05fU1RFUCxcbiAgICAgICAgJ0xJTkVBUic6IElOVEVSUE9MQVRJT05fTElORUFSLFxuICAgICAgICAnQ1VCSUNTUExJTkUnOiBJTlRFUlBPTEFUSU9OX0NVQklDXG4gICAgfTtcblxuICAgIC8vIElucHV0IGFuZCBvdXRwdXQgbWFwcyByZWZlcmVuY2UgZGF0YSBieSBzYW1wbGVyIGlucHV0L291dHB1dCBrZXkuXG4gICAgY29uc3QgaW5wdXRNYXAgPSB7IH07XG4gICAgY29uc3Qgb3V0cHV0TWFwID0geyB9O1xuICAgIC8vIFRoZSBjdXJ2ZSBtYXAgc3RvcmVzIHRlbXBvcmFyeSBjdXJ2ZSBkYXRhIGJ5IHNhbXBsZXIgaW5kZXguIEVhY2ggY3VydmVzIGlucHV0L291dHB1dCB2YWx1ZSB3aWxsIGJlIHJlc29sdmVkIHRvIGFuIGlucHV0cy9vdXRwdXRzIGFycmF5IGluZGV4IGFmdGVyIGFsbCBzYW1wbGVycyBoYXZlIGJlZW4gcHJvY2Vzc2VkLlxuICAgIC8vIEN1cnZlcyBhbmQgb3V0cHV0cyB0aGF0IGFyZSBkZWxldGVkIGZyb20gdGhlaXIgbWFwcyB3aWxsIG5vdCBiZSBpbmNsdWRlZCBpbiB0aGUgZmluYWwgQW5pbVRyYWNrXG4gICAgY29uc3QgY3VydmVNYXAgPSB7IH07XG4gICAgbGV0IG91dHB1dENvdW50ZXIgPSAxO1xuXG4gICAgbGV0IGk7XG5cbiAgICAvLyBjb252ZXJ0IHNhbXBsZXJzXG4gICAgZm9yIChpID0gMDsgaSA8IGdsdGZBbmltYXRpb24uc2FtcGxlcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3Qgc2FtcGxlciA9IGdsdGZBbmltYXRpb24uc2FtcGxlcnNbaV07XG5cbiAgICAgICAgLy8gZ2V0IGlucHV0IGRhdGFcbiAgICAgICAgaWYgKCFpbnB1dE1hcC5oYXNPd25Qcm9wZXJ0eShzYW1wbGVyLmlucHV0KSkge1xuICAgICAgICAgICAgaW5wdXRNYXBbc2FtcGxlci5pbnB1dF0gPSBjcmVhdGVBbmltRGF0YShnbHRmQWNjZXNzb3JzW3NhbXBsZXIuaW5wdXRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGdldCBvdXRwdXQgZGF0YVxuICAgICAgICBpZiAoIW91dHB1dE1hcC5oYXNPd25Qcm9wZXJ0eShzYW1wbGVyLm91dHB1dCkpIHtcbiAgICAgICAgICAgIG91dHB1dE1hcFtzYW1wbGVyLm91dHB1dF0gPSBjcmVhdGVBbmltRGF0YShnbHRmQWNjZXNzb3JzW3NhbXBsZXIub3V0cHV0XSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnRlcnBvbGF0aW9uID1cbiAgICAgICAgICAgIHNhbXBsZXIuaGFzT3duUHJvcGVydHkoJ2ludGVycG9sYXRpb24nKSAmJlxuICAgICAgICAgICAgaW50ZXJwTWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIuaW50ZXJwb2xhdGlvbikgP1xuICAgICAgICAgICAgICAgIGludGVycE1hcFtzYW1wbGVyLmludGVycG9sYXRpb25dIDogSU5URVJQT0xBVElPTl9MSU5FQVI7XG5cbiAgICAgICAgLy8gY3JlYXRlIGN1cnZlXG4gICAgICAgIGNvbnN0IGN1cnZlID0ge1xuICAgICAgICAgICAgcGF0aHM6IFtdLFxuICAgICAgICAgICAgaW5wdXQ6IHNhbXBsZXIuaW5wdXQsXG4gICAgICAgICAgICBvdXRwdXQ6IHNhbXBsZXIub3V0cHV0LFxuICAgICAgICAgICAgaW50ZXJwb2xhdGlvbjogaW50ZXJwb2xhdGlvblxuICAgICAgICB9O1xuXG4gICAgICAgIGN1cnZlTWFwW2ldID0gY3VydmU7XG4gICAgfVxuXG4gICAgY29uc3QgcXVhdEFycmF5cyA9IFtdO1xuXG4gICAgY29uc3QgdHJhbnNmb3JtU2NoZW1hID0ge1xuICAgICAgICAndHJhbnNsYXRpb24nOiAnbG9jYWxQb3NpdGlvbicsXG4gICAgICAgICdyb3RhdGlvbic6ICdsb2NhbFJvdGF0aW9uJyxcbiAgICAgICAgJ3NjYWxlJzogJ2xvY2FsU2NhbGUnXG4gICAgfTtcblxuICAgIGNvbnN0IGNvbnN0cnVjdE5vZGVQYXRoID0gKG5vZGUpID0+IHtcbiAgICAgICAgY29uc3QgcGF0aCA9IFtdO1xuICAgICAgICB3aGlsZSAobm9kZSkge1xuICAgICAgICAgICAgcGF0aC51bnNoaWZ0KG5vZGUubmFtZSk7XG4gICAgICAgICAgICBub2RlID0gbm9kZS5wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgfTtcblxuICAgIC8vIEFsbCBtb3JwaCB0YXJnZXRzIGFyZSBpbmNsdWRlZCBpbiBhIHNpbmdsZSBjaGFubmVsIG9mIHRoZSBhbmltYXRpb24sIHdpdGggYWxsIHRhcmdldHMgb3V0cHV0IGRhdGEgaW50ZXJsZWF2ZWQgd2l0aCBlYWNoIG90aGVyLlxuICAgIC8vIFRoaXMgZnVuY3Rpb24gc3BsaXRzIGVhY2ggbW9ycGggdGFyZ2V0IG91dCBpbnRvIGl0IGEgY3VydmUgd2l0aCBpdHMgb3duIG91dHB1dCBkYXRhLCBhbGxvd2luZyB1cyB0byBhbmltYXRlIGVhY2ggbW9ycGggdGFyZ2V0IGluZGVwZW5kZW50bHkgYnkgbmFtZS5cbiAgICBjb25zdCBjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyA9IChjdXJ2ZSwgZ2x0Zk5vZGUsIGVudGl0eVBhdGgpID0+IHtcbiAgICAgICAgY29uc3Qgb3V0ID0gb3V0cHV0TWFwW2N1cnZlLm91dHB1dF07XG4gICAgICAgIGlmICghb3V0KSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBnbGItcGFyc2VyOiBObyBvdXRwdXQgZGF0YSBpcyBhdmFpbGFibGUgZm9yIHRoZSBtb3JwaCB0YXJnZXQgY3VydmUgKCR7ZW50aXR5UGF0aH0vZ3JhcGgvd2VpZ2h0cykuIFNraXBwaW5nLmApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbmFtZXMgb2YgbW9ycGggdGFyZ2V0c1xuICAgICAgICBsZXQgdGFyZ2V0TmFtZXM7XG4gICAgICAgIGlmIChtZXNoZXMgJiYgbWVzaGVzW2dsdGZOb2RlLm1lc2hdKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoID0gbWVzaGVzW2dsdGZOb2RlLm1lc2hdO1xuICAgICAgICAgICAgaWYgKG1lc2guaGFzT3duUHJvcGVydHkoJ2V4dHJhcycpICYmIG1lc2guZXh0cmFzLmhhc093blByb3BlcnR5KCd0YXJnZXROYW1lcycpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0TmFtZXMgPSBtZXNoLmV4dHJhcy50YXJnZXROYW1lcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG91dERhdGEgPSBvdXQuZGF0YTtcbiAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRDb3VudCA9IG91dERhdGEubGVuZ3RoIC8gaW5wdXRNYXBbY3VydmUuaW5wdXRdLmRhdGEubGVuZ3RoO1xuICAgICAgICBjb25zdCBrZXlmcmFtZUNvdW50ID0gb3V0RGF0YS5sZW5ndGggLyBtb3JwaFRhcmdldENvdW50O1xuXG4gICAgICAgIC8vIHNpbmdsZSBhcnJheSBidWZmZXIgZm9yIGFsbCBrZXlzLCA0IGJ5dGVzIHBlciBlbnRyeVxuICAgICAgICBjb25zdCBzaW5nbGVCdWZmZXJTaXplID0ga2V5ZnJhbWVDb3VudCAqIDQ7XG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihzaW5nbGVCdWZmZXJTaXplICogbW9ycGhUYXJnZXRDb3VudCk7XG5cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBtb3JwaFRhcmdldENvdW50OyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0T3V0cHV0ID0gbmV3IEZsb2F0MzJBcnJheShidWZmZXIsIHNpbmdsZUJ1ZmZlclNpemUgKiBqLCBrZXlmcmFtZUNvdW50KTtcblxuICAgICAgICAgICAgLy8gdGhlIG91dHB1dCBkYXRhIGZvciBhbGwgbW9ycGggdGFyZ2V0cyBpbiBhIHNpbmdsZSBjdXJ2ZSBpcyBpbnRlcmxlYXZlZC4gV2UgbmVlZCB0byByZXRyaWV2ZSB0aGUga2V5ZnJhbWUgb3V0cHV0IGRhdGEgZm9yIGEgc2luZ2xlIG1vcnBoIHRhcmdldFxuICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBrZXlmcmFtZUNvdW50OyBrKyspIHtcbiAgICAgICAgICAgICAgICBtb3JwaFRhcmdldE91dHB1dFtrXSA9IG91dERhdGFbayAqIG1vcnBoVGFyZ2V0Q291bnQgKyBqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG91dHB1dCA9IG5ldyBBbmltRGF0YSgxLCBtb3JwaFRhcmdldE91dHB1dCk7XG4gICAgICAgICAgICBjb25zdCB3ZWlnaHROYW1lID0gdGFyZ2V0TmFtZXM/LltqXSA/IGBuYW1lLiR7dGFyZ2V0TmFtZXNbal19YCA6IGo7XG5cbiAgICAgICAgICAgIC8vIGFkZCB0aGUgaW5kaXZpZHVhbCBtb3JwaCB0YXJnZXQgb3V0cHV0IGRhdGEgdG8gdGhlIG91dHB1dE1hcCB1c2luZyBhIG5lZ2F0aXZlIHZhbHVlIGtleSAoc28gYXMgbm90IHRvIGNsYXNoIHdpdGggc2FtcGxlci5vdXRwdXQgdmFsdWVzKVxuICAgICAgICAgICAgb3V0cHV0TWFwWy1vdXRwdXRDb3VudGVyXSA9IG91dHB1dDtcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoQ3VydmUgPSB7XG4gICAgICAgICAgICAgICAgcGF0aHM6IFt7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eVBhdGg6IGVudGl0eVBhdGgsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudDogJ2dyYXBoJyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoOiBbYHdlaWdodC4ke3dlaWdodE5hbWV9YF1cbiAgICAgICAgICAgICAgICB9XSxcbiAgICAgICAgICAgICAgICAvLyBlYWNoIG1vcnBoIHRhcmdldCBjdXJ2ZSBpbnB1dCBjYW4gdXNlIHRoZSBzYW1lIHNhbXBsZXIuaW5wdXQgZnJvbSB0aGUgY2hhbm5lbCB0aGV5IHdlcmUgYWxsIGluXG4gICAgICAgICAgICAgICAgaW5wdXQ6IGN1cnZlLmlucHV0LFxuICAgICAgICAgICAgICAgIC8vIGJ1dCBlYWNoIG1vcnBoIHRhcmdldCBjdXJ2ZSBzaG91bGQgcmVmZXJlbmNlIGl0cyBpbmRpdmlkdWFsIG91dHB1dCB0aGF0IHdhcyBqdXN0IGNyZWF0ZWRcbiAgICAgICAgICAgICAgICBvdXRwdXQ6IC1vdXRwdXRDb3VudGVyLFxuICAgICAgICAgICAgICAgIGludGVycG9sYXRpb246IGN1cnZlLmludGVycG9sYXRpb25cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBvdXRwdXRDb3VudGVyKys7XG4gICAgICAgICAgICAvLyBhZGQgdGhlIG1vcnBoIHRhcmdldCBjdXJ2ZSB0byB0aGUgY3VydmVNYXBcbiAgICAgICAgICAgIGN1cnZlTWFwW2Btb3JwaEN1cnZlLSR7aX0tJHtqfWBdID0gbW9ycGhDdXJ2ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBjb252ZXJ0IGFuaW0gY2hhbm5lbHNcbiAgICBmb3IgKGkgPSAwOyBpIDwgZ2x0ZkFuaW1hdGlvbi5jaGFubmVscy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBjaGFubmVsID0gZ2x0ZkFuaW1hdGlvbi5jaGFubmVsc1tpXTtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gY2hhbm5lbC50YXJnZXQ7XG4gICAgICAgIGNvbnN0IGN1cnZlID0gY3VydmVNYXBbY2hhbm5lbC5zYW1wbGVyXTtcblxuICAgICAgICBjb25zdCBub2RlID0gbm9kZXNbdGFyZ2V0Lm5vZGVdO1xuICAgICAgICBjb25zdCBnbHRmTm9kZSA9IGdsdGZOb2Rlc1t0YXJnZXQubm9kZV07XG4gICAgICAgIGNvbnN0IGVudGl0eVBhdGggPSBjb25zdHJ1Y3ROb2RlUGF0aChub2RlKTtcblxuICAgICAgICBpZiAodGFyZ2V0LnBhdGguc3RhcnRzV2l0aCgnd2VpZ2h0cycpKSB7XG4gICAgICAgICAgICBjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyhjdXJ2ZSwgZ2x0Zk5vZGUsIGVudGl0eVBhdGgpO1xuICAgICAgICAgICAgLy8gYXMgYWxsIGluZGl2aWR1YWwgbW9ycGggdGFyZ2V0cyBpbiB0aGlzIG1vcnBoIGN1cnZlIGhhdmUgdGhlaXIgb3duIGN1cnZlIG5vdywgdGhpcyBtb3JwaCBjdXJ2ZSBzaG91bGQgYmUgZmxhZ2dlZFxuICAgICAgICAgICAgLy8gc28gaXQncyBub3QgaW5jbHVkZWQgaW4gdGhlIGZpbmFsIG91dHB1dFxuICAgICAgICAgICAgY3VydmVNYXBbY2hhbm5lbC5zYW1wbGVyXS5tb3JwaEN1cnZlID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGN1cnZlLnBhdGhzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVudGl0eVBhdGg6IGVudGl0eVBhdGgsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiAnZ3JhcGgnLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5UGF0aDogW3RyYW5zZm9ybVNjaGVtYVt0YXJnZXQucGF0aF1dXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGlucHV0cyA9IFtdO1xuICAgIGNvbnN0IG91dHB1dHMgPSBbXTtcbiAgICBjb25zdCBjdXJ2ZXMgPSBbXTtcblxuICAgIC8vIEFkZCBlYWNoIGlucHV0IGluIHRoZSBtYXAgdG8gdGhlIGZpbmFsIGlucHV0cyBhcnJheS4gVGhlIGlucHV0TWFwIHNob3VsZCBub3cgcmVmZXJlbmNlIHRoZSBpbmRleCBvZiBpbnB1dCBpbiB0aGUgaW5wdXRzIGFycmF5IGluc3RlYWQgb2YgdGhlIGlucHV0IGl0c2VsZi5cbiAgICBmb3IgKGNvbnN0IGlucHV0S2V5IGluIGlucHV0TWFwKSB7XG4gICAgICAgIGlucHV0cy5wdXNoKGlucHV0TWFwW2lucHV0S2V5XSk7XG4gICAgICAgIGlucHV0TWFwW2lucHV0S2V5XSA9IGlucHV0cy5sZW5ndGggLSAxO1xuICAgIH1cbiAgICAvLyBBZGQgZWFjaCBvdXRwdXQgaW4gdGhlIG1hcCB0byB0aGUgZmluYWwgb3V0cHV0cyBhcnJheS4gVGhlIG91dHB1dE1hcCBzaG91bGQgbm93IHJlZmVyZW5jZSB0aGUgaW5kZXggb2Ygb3V0cHV0IGluIHRoZSBvdXRwdXRzIGFycmF5IGluc3RlYWQgb2YgdGhlIG91dHB1dCBpdHNlbGYuXG4gICAgZm9yIChjb25zdCBvdXRwdXRLZXkgaW4gb3V0cHV0TWFwKSB7XG4gICAgICAgIG91dHB1dHMucHVzaChvdXRwdXRNYXBbb3V0cHV0S2V5XSk7XG4gICAgICAgIG91dHB1dE1hcFtvdXRwdXRLZXldID0gb3V0cHV0cy5sZW5ndGggLSAxO1xuICAgIH1cbiAgICAvLyBDcmVhdGUgYW4gQW5pbUN1cnZlIGZvciBlYWNoIGN1cnZlIG9iamVjdCBpbiB0aGUgY3VydmVNYXAuIEVhY2ggY3VydmUgb2JqZWN0J3MgaW5wdXQgdmFsdWUgc2hvdWxkIGJlIHJlc29sdmVkIHRvIHRoZSBpbmRleCBvZiB0aGUgaW5wdXQgaW4gdGhlXG4gICAgLy8gaW5wdXRzIGFycmF5cyB1c2luZyB0aGUgaW5wdXRNYXAuIExpa2V3aXNlIGZvciBvdXRwdXQgdmFsdWVzLlxuICAgIGZvciAoY29uc3QgY3VydmVLZXkgaW4gY3VydmVNYXApIHtcbiAgICAgICAgY29uc3QgY3VydmVEYXRhID0gY3VydmVNYXBbY3VydmVLZXldO1xuICAgICAgICAvLyBpZiB0aGUgY3VydmVEYXRhIGNvbnRhaW5zIGEgbW9ycGggY3VydmUgdGhlbiBkbyBub3QgYWRkIGl0IHRvIHRoZSBmaW5hbCBjdXJ2ZSBsaXN0IGFzIHRoZSBpbmRpdmlkdWFsIG1vcnBoIHRhcmdldCBjdXJ2ZXMgYXJlIGluY2x1ZGVkIGluc3RlYWRcbiAgICAgICAgaWYgKGN1cnZlRGF0YS5tb3JwaEN1cnZlKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBjdXJ2ZXMucHVzaChuZXcgQW5pbUN1cnZlKFxuICAgICAgICAgICAgY3VydmVEYXRhLnBhdGhzLFxuICAgICAgICAgICAgaW5wdXRNYXBbY3VydmVEYXRhLmlucHV0XSxcbiAgICAgICAgICAgIG91dHB1dE1hcFtjdXJ2ZURhdGEub3V0cHV0XSxcbiAgICAgICAgICAgIGN1cnZlRGF0YS5pbnRlcnBvbGF0aW9uXG4gICAgICAgICkpO1xuXG4gICAgICAgIC8vIGlmIHRoaXMgdGFyZ2V0IGlzIGEgc2V0IG9mIHF1YXRlcm5pb24ga2V5cywgbWFrZSBub3RlIG9mIGl0cyBpbmRleCBzbyB3ZSBjYW4gcGVyZm9ybVxuICAgICAgICAvLyBxdWF0ZXJuaW9uLXNwZWNpZmljIHByb2Nlc3Npbmcgb24gaXQuXG4gICAgICAgIGlmIChjdXJ2ZURhdGEucGF0aHMubGVuZ3RoID4gMCAmJiBjdXJ2ZURhdGEucGF0aHNbMF0ucHJvcGVydHlQYXRoWzBdID09PSAnbG9jYWxSb3RhdGlvbicgJiYgY3VydmVEYXRhLmludGVycG9sYXRpb24gIT09IElOVEVSUE9MQVRJT05fQ1VCSUMpIHtcbiAgICAgICAgICAgIHF1YXRBcnJheXMucHVzaChjdXJ2ZXNbY3VydmVzLmxlbmd0aCAtIDFdLm91dHB1dCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHRoZSBsaXN0IG9mIGFycmF5IGluZGV4ZXMgc28gd2UgY2FuIHNraXAgZHVwc1xuICAgIHF1YXRBcnJheXMuc29ydCgpO1xuXG4gICAgLy8gcnVuIHRocm91Z2ggdGhlIHF1YXRlcm5pb24gZGF0YSBhcnJheXMgZmxpcHBpbmcgcXVhdGVybmlvbiBrZXlzXG4gICAgLy8gdGhhdCBkb24ndCBmYWxsIGluIHRoZSBzYW1lIHdpbmRpbmcgb3JkZXIuXG4gICAgbGV0IHByZXZJbmRleCA9IG51bGw7XG4gICAgbGV0IGRhdGE7XG4gICAgZm9yIChpID0gMDsgaSA8IHF1YXRBcnJheXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSBxdWF0QXJyYXlzW2ldO1xuICAgICAgICAvLyBza2lwIG92ZXIgZHVwbGljYXRlIGFycmF5IGluZGljZXNcbiAgICAgICAgaWYgKGkgPT09IDAgfHwgaW5kZXggIT09IHByZXZJbmRleCkge1xuICAgICAgICAgICAgZGF0YSA9IG91dHB1dHNbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKGRhdGEuY29tcG9uZW50cyA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGQgPSBkYXRhLmRhdGE7XG4gICAgICAgICAgICAgICAgY29uc3QgbGVuID0gZC5sZW5ndGggLSA0O1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqICs9IDQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZHAgPSBkW2ogKyAwXSAqIGRbaiArIDRdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgMV0gKiBkW2ogKyA1XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDJdICogZFtqICsgNl0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAzXSAqIGRbaiArIDddO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChkcCA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDRdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNV0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA2XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDddICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJldkluZGV4ID0gaW5kZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjYWxjdWxhdGUgZHVyYXRpb24gb2YgdGhlIGFuaW1hdGlvbiBhcyBtYXhpbXVtIHRpbWUgdmFsdWVcbiAgICBsZXQgZHVyYXRpb24gPSAwO1xuICAgIGZvciAoaSA9IDA7IGkgPCBpbnB1dHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZGF0YSAgPSBpbnB1dHNbaV0uX2RhdGE7XG4gICAgICAgIGR1cmF0aW9uID0gTWF0aC5tYXgoZHVyYXRpb24sIGRhdGEubGVuZ3RoID09PSAwID8gMCA6IGRhdGFbZGF0YS5sZW5ndGggLSAxXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBBbmltVHJhY2soXG4gICAgICAgIGdsdGZBbmltYXRpb24uaGFzT3duUHJvcGVydHkoJ25hbWUnKSA/IGdsdGZBbmltYXRpb24ubmFtZSA6ICgnYW5pbWF0aW9uXycgKyBhbmltYXRpb25JbmRleCksXG4gICAgICAgIGR1cmF0aW9uLFxuICAgICAgICBpbnB1dHMsXG4gICAgICAgIG91dHB1dHMsXG4gICAgICAgIGN1cnZlcyk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlID0gZnVuY3Rpb24gKGdsdGZOb2RlLCBub2RlSW5kZXgpIHtcbiAgICBjb25zdCBlbnRpdHkgPSBuZXcgR3JhcGhOb2RlKCk7XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ25hbWUnKSAmJiBnbHRmTm9kZS5uYW1lLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZW50aXR5Lm5hbWUgPSBnbHRmTm9kZS5uYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVudGl0eS5uYW1lID0gJ25vZGVfJyArIG5vZGVJbmRleDtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSB0cmFuc2Zvcm1hdGlvbiBwcm9wZXJ0aWVzXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdtYXRyaXgnKSkge1xuICAgICAgICB0ZW1wTWF0LmRhdGEuc2V0KGdsdGZOb2RlLm1hdHJpeCk7XG4gICAgICAgIHRlbXBNYXQuZ2V0VHJhbnNsYXRpb24odGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHRlbXBWZWMpO1xuICAgICAgICB0ZW1wTWF0LmdldEV1bGVyQW5nbGVzKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxFdWxlckFuZ2xlcyh0ZW1wVmVjKTtcbiAgICAgICAgdGVtcE1hdC5nZXRTY2FsZSh0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsU2NhbGUodGVtcFZlYyk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdyb3RhdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHIgPSBnbHRmTm9kZS5yb3RhdGlvbjtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUm90YXRpb24oclswXSwgclsxXSwgclsyXSwgclszXSk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCd0cmFuc2xhdGlvbicpKSB7XG4gICAgICAgIGNvbnN0IHQgPSBnbHRmTm9kZS50cmFuc2xhdGlvbjtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUG9zaXRpb24odFswXSwgdFsxXSwgdFsyXSk7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgIGNvbnN0IHMgPSBnbHRmTm9kZS5zY2FsZTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsU2NhbGUoc1swXSwgc1sxXSwgc1syXSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudGl0eTtcbn07XG5cbi8vIGNyZWF0ZXMgYSBjYW1lcmEgY29tcG9uZW50IG9uIHRoZSBzdXBwbGllZCBub2RlLCBhbmQgcmV0dXJucyBpdFxuY29uc3QgY3JlYXRlQ2FtZXJhID0gZnVuY3Rpb24gKGdsdGZDYW1lcmEsIG5vZGUpIHtcblxuICAgIGNvbnN0IHByb2plY3Rpb24gPSBnbHRmQ2FtZXJhLnR5cGUgPT09ICdvcnRob2dyYXBoaWMnID8gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgOiBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFO1xuICAgIGNvbnN0IGdsdGZQcm9wZXJ0aWVzID0gcHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMgPyBnbHRmQ2FtZXJhLm9ydGhvZ3JhcGhpYyA6IGdsdGZDYW1lcmEucGVyc3BlY3RpdmU7XG5cbiAgICBjb25zdCBjb21wb25lbnREYXRhID0ge1xuICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgICAgcHJvamVjdGlvbjogcHJvamVjdGlvbixcbiAgICAgICAgbmVhckNsaXA6IGdsdGZQcm9wZXJ0aWVzLnpuZWFyLFxuICAgICAgICBhc3BlY3RSYXRpb01vZGU6IEFTUEVDVF9BVVRPXG4gICAgfTtcblxuICAgIGlmIChnbHRmUHJvcGVydGllcy56ZmFyKSB7XG4gICAgICAgIGNvbXBvbmVudERhdGEuZmFyQ2xpcCA9IGdsdGZQcm9wZXJ0aWVzLnpmYXI7XG4gICAgfVxuXG4gICAgaWYgKHByb2plY3Rpb24gPT09IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDKSB7XG4gICAgICAgIGNvbXBvbmVudERhdGEub3J0aG9IZWlnaHQgPSAwLjUgKiBnbHRmUHJvcGVydGllcy55bWFnO1xuICAgICAgICBpZiAoZ2x0ZlByb3BlcnRpZXMueW1hZykge1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfTUFOVUFMO1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpbyA9IGdsdGZQcm9wZXJ0aWVzLnhtYWcgLyBnbHRmUHJvcGVydGllcy55bWFnO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5mb3YgPSBnbHRmUHJvcGVydGllcy55Zm92ICogbWF0aC5SQURfVE9fREVHO1xuICAgICAgICBpZiAoZ2x0ZlByb3BlcnRpZXMuYXNwZWN0UmF0aW8pIHtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW9Nb2RlID0gQVNQRUNUX01BTlVBTDtcbiAgICAgICAgICAgIGNvbXBvbmVudERhdGEuYXNwZWN0UmF0aW8gPSBnbHRmUHJvcGVydGllcy5hc3BlY3RSYXRpbztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNhbWVyYUVudGl0eSA9IG5ldyBFbnRpdHkoZ2x0ZkNhbWVyYS5uYW1lKTtcbiAgICBjYW1lcmFFbnRpdHkuYWRkQ29tcG9uZW50KCdjYW1lcmEnLCBjb21wb25lbnREYXRhKTtcbiAgICByZXR1cm4gY2FtZXJhRW50aXR5O1xufTtcblxuLy8gY3JlYXRlcyBsaWdodCBjb21wb25lbnQsIGFkZHMgaXQgdG8gdGhlIG5vZGUgYW5kIHJldHVybnMgdGhlIGNyZWF0ZWQgbGlnaHQgY29tcG9uZW50XG5jb25zdCBjcmVhdGVMaWdodCA9IGZ1bmN0aW9uIChnbHRmTGlnaHQsIG5vZGUpIHtcblxuICAgIGNvbnN0IGxpZ2h0UHJvcHMgPSB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICB0eXBlOiBnbHRmTGlnaHQudHlwZSA9PT0gJ3BvaW50JyA/ICdvbW5pJyA6IGdsdGZMaWdodC50eXBlLFxuICAgICAgICBjb2xvcjogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdjb2xvcicpID8gbmV3IENvbG9yKGdsdGZMaWdodC5jb2xvcikgOiBDb2xvci5XSElURSxcblxuICAgICAgICAvLyB3aGVuIHJhbmdlIGlzIG5vdCBkZWZpbmVkLCBpbmZpbml0eSBzaG91bGQgYmUgdXNlZCAtIGJ1dCB0aGF0IGlzIGNhdXNpbmcgaW5maW5pdHkgaW4gYm91bmRzIGNhbGN1bGF0aW9uc1xuICAgICAgICByYW5nZTogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdyYW5nZScpID8gZ2x0ZkxpZ2h0LnJhbmdlIDogOTk5OSxcblxuICAgICAgICBmYWxsb2ZmTW9kZTogTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuXG4gICAgICAgIC8vIFRPRE86IChlbmdpbmUgaXNzdWUgIzMyNTIpIFNldCBpbnRlbnNpdHkgdG8gbWF0Y2ggZ2xURiBzcGVjaWZpY2F0aW9uLCB3aGljaCB1c2VzIHBoeXNpY2FsbHkgYmFzZWQgdmFsdWVzOlxuICAgICAgICAvLyAtIE9tbmkgYW5kIHNwb3QgbGlnaHRzIHVzZSBsdW1pbm91cyBpbnRlbnNpdHkgaW4gY2FuZGVsYSAobG0vc3IpXG4gICAgICAgIC8vIC0gRGlyZWN0aW9uYWwgbGlnaHRzIHVzZSBpbGx1bWluYW5jZSBpbiBsdXggKGxtL20yKS5cbiAgICAgICAgLy8gQ3VycmVudCBpbXBsZW1lbnRhdGlvbjogY2xhcG1zIHNwZWNpZmllZCBpbnRlbnNpdHkgdG8gMC4uMiByYW5nZVxuICAgICAgICBpbnRlbnNpdHk6IGdsdGZMaWdodC5oYXNPd25Qcm9wZXJ0eSgnaW50ZW5zaXR5JykgPyBtYXRoLmNsYW1wKGdsdGZMaWdodC5pbnRlbnNpdHksIDAsIDIpIDogMVxuICAgIH07XG5cbiAgICBpZiAoZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdzcG90JykpIHtcbiAgICAgICAgbGlnaHRQcm9wcy5pbm5lckNvbmVBbmdsZSA9IGdsdGZMaWdodC5zcG90Lmhhc093blByb3BlcnR5KCdpbm5lckNvbmVBbmdsZScpID8gZ2x0ZkxpZ2h0LnNwb3QuaW5uZXJDb25lQW5nbGUgKiBtYXRoLlJBRF9UT19ERUcgOiAwO1xuICAgICAgICBsaWdodFByb3BzLm91dGVyQ29uZUFuZ2xlID0gZ2x0ZkxpZ2h0LnNwb3QuaGFzT3duUHJvcGVydHkoJ291dGVyQ29uZUFuZ2xlJykgPyBnbHRmTGlnaHQuc3BvdC5vdXRlckNvbmVBbmdsZSAqIG1hdGguUkFEX1RPX0RFRyA6IE1hdGguUEkgLyA0O1xuICAgIH1cblxuICAgIC8vIGdsVEYgc3RvcmVzIGxpZ2h0IGFscmVhZHkgaW4gZW5lcmd5L2FyZWEsIGJ1dCB3ZSBuZWVkIHRvIHByb3ZpZGUgdGhlIGxpZ2h0IHdpdGggb25seSB0aGUgZW5lcmd5IHBhcmFtZXRlcixcbiAgICAvLyBzbyB3ZSBuZWVkIHRoZSBpbnRlbnNpdGllcyBpbiBjYW5kZWxhIGJhY2sgdG8gbHVtZW5cbiAgICBpZiAoZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KFwiaW50ZW5zaXR5XCIpKSB7XG4gICAgICAgIGxpZ2h0UHJvcHMubHVtaW5hbmNlID0gZ2x0ZkxpZ2h0LmludGVuc2l0eSAqIExpZ2h0LmdldExpZ2h0VW5pdENvbnZlcnNpb24obGlnaHRUeXBlc1tsaWdodFByb3BzLnR5cGVdLCBsaWdodFByb3BzLm91dGVyQ29uZUFuZ2xlLCBsaWdodFByb3BzLmlubmVyQ29uZUFuZ2xlKTtcbiAgICB9XG5cbiAgICAvLyBSb3RhdGUgdG8gbWF0Y2ggbGlnaHQgb3JpZW50YXRpb24gaW4gZ2xURiBzcGVjaWZpY2F0aW9uXG4gICAgLy8gTm90ZSB0aGF0IHRoaXMgYWRkcyBhIG5ldyBlbnRpdHkgbm9kZSBpbnRvIHRoZSBoaWVyYXJjaHkgdGhhdCBkb2VzIG5vdCBleGlzdCBpbiB0aGUgZ2x0ZiBoaWVyYXJjaHlcbiAgICBjb25zdCBsaWdodEVudGl0eSA9IG5ldyBFbnRpdHkobm9kZS5uYW1lKTtcbiAgICBsaWdodEVudGl0eS5yb3RhdGVMb2NhbCg5MCwgMCwgMCk7XG5cbiAgICAvLyBhZGQgY29tcG9uZW50XG4gICAgbGlnaHRFbnRpdHkuYWRkQ29tcG9uZW50KCdsaWdodCcsIGxpZ2h0UHJvcHMpO1xuICAgIHJldHVybiBsaWdodEVudGl0eTtcbn07XG5cbmNvbnN0IGNyZWF0ZVNraW5zID0gZnVuY3Rpb24gKGRldmljZSwgZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdza2lucycpIHx8IGdsdGYuc2tpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICAvLyBjYWNoZSBmb3Igc2tpbnMgdG8gZmlsdGVyIG91dCBkdXBsaWNhdGVzXG4gICAgY29uc3QgZ2xiU2tpbnMgPSBuZXcgTWFwKCk7XG5cbiAgICByZXR1cm4gZ2x0Zi5za2lucy5tYXAoZnVuY3Rpb24gKGdsdGZTa2luKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVTa2luKGRldmljZSwgZ2x0ZlNraW4sIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsYlNraW5zKTtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZU1lc2hlcyA9IGZ1bmN0aW9uIChkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCBjYWxsYmFjaywgZmxpcFYsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ21lc2hlcycpIHx8IGdsdGYubWVzaGVzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAhZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgnYWNjZXNzb3JzJykgfHwgZ2x0Zi5hY2Nlc3NvcnMubGVuZ3RoID09PSAwIHx8XG4gICAgICAgICFnbHRmLmhhc093blByb3BlcnR5KCdidWZmZXJWaWV3cycpIHx8IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBpZiAob3B0aW9ucy5za2lwTWVzaGVzKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICAvLyBkaWN0aW9uYXJ5IG9mIHZlcnRleCBidWZmZXJzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcbiAgICBjb25zdCB2ZXJ0ZXhCdWZmZXJEaWN0ID0ge307XG5cbiAgICByZXR1cm4gZ2x0Zi5tZXNoZXMubWFwKGZ1bmN0aW9uIChnbHRmTWVzaCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlTWVzaChkZXZpY2UsIGdsdGZNZXNoLCBnbHRmLmFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGNhbGxiYWNrLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCwgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgb3B0aW9ucyk7XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVNYXRlcmlhbHMgPSBmdW5jdGlvbiAoZ2x0ZiwgdGV4dHVyZXMsIG9wdGlvbnMsIGZsaXBWKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdtYXRlcmlhbHMnKSB8fCBnbHRmLm1hdGVyaWFscy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubWF0ZXJpYWwgJiYgb3B0aW9ucy5tYXRlcmlhbC5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubWF0ZXJpYWwgJiYgb3B0aW9ucy5tYXRlcmlhbC5wcm9jZXNzIHx8IGNyZWF0ZU1hdGVyaWFsO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm1hdGVyaWFsICYmIG9wdGlvbnMubWF0ZXJpYWwucG9zdHByb2Nlc3M7XG5cbiAgICByZXR1cm4gZ2x0Zi5tYXRlcmlhbHMubWFwKGZ1bmN0aW9uIChnbHRmTWF0ZXJpYWwpIHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk1hdGVyaWFsKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHByb2Nlc3MoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZNYXRlcmlhbCwgbWF0ZXJpYWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZVZhcmlhbnRzID0gZnVuY3Rpb24gKGdsdGYpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoXCJleHRlbnNpb25zXCIpIHx8ICFnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKVxuICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGRhdGEgPSBnbHRmLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cy52YXJpYW50cztcbiAgICBjb25zdCB2YXJpYW50cyA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXJpYW50c1tkYXRhW2ldLm5hbWVdID0gaTtcbiAgICB9XG4gICAgcmV0dXJuIHZhcmlhbnRzO1xufTtcblxuY29uc3QgY3JlYXRlQW5pbWF0aW9ucyA9IGZ1bmN0aW9uIChnbHRmLCBub2RlcywgYnVmZmVyVmlld3MsIG9wdGlvbnMpIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ2FuaW1hdGlvbnMnKSB8fCBnbHRmLmFuaW1hdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLmFuaW1hdGlvbnMubWFwKGZ1bmN0aW9uIChnbHRmQW5pbWF0aW9uLCBpbmRleCkge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQW5pbWF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbmltYXRpb24gPSBjcmVhdGVBbmltYXRpb24oZ2x0ZkFuaW1hdGlvbiwgaW5kZXgsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsdGYubWVzaGVzLCBnbHRmLm5vZGVzKTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQW5pbWF0aW9uLCBhbmltYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhbmltYXRpb247XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlcyA9IGZ1bmN0aW9uIChnbHRmLCBvcHRpb25zKSB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpIHx8IGdsdGYubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLm5vZGUgJiYgb3B0aW9ucy5ub2RlLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5ub2RlICYmIG9wdGlvbnMubm9kZS5wcm9jZXNzIHx8IGNyZWF0ZU5vZGU7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMubm9kZSAmJiBvcHRpb25zLm5vZGUucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBub2RlcyA9IGdsdGYubm9kZXMubWFwKGZ1bmN0aW9uIChnbHRmTm9kZSwgaW5kZXgpIHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5vZGUgPSBwcm9jZXNzKGdsdGZOb2RlLCBpbmRleCk7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zk5vZGUsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH0pO1xuXG4gICAgLy8gYnVpbGQgbm9kZSBoaWVyYXJjaHlcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYubm9kZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0Zk5vZGUgPSBnbHRmLm5vZGVzW2ldO1xuICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NoaWxkcmVuJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgdW5pcXVlTmFtZXMgPSB7IH07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGdsdGZOb2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBub2Rlc1tnbHRmTm9kZS5jaGlsZHJlbltqXV07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZC5wYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVuaXF1ZU5hbWVzLmhhc093blByb3BlcnR5KGNoaWxkLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5uYW1lICs9IHVuaXF1ZU5hbWVzW2NoaWxkLm5hbWVdKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlxdWVOYW1lc1tjaGlsZC5uYW1lXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZXM7XG59O1xuXG5jb25zdCBjcmVhdGVTY2VuZXMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMpIHtcbiAgICBjb25zdCBzY2VuZXMgPSBbXTtcbiAgICBjb25zdCBjb3VudCA9IGdsdGYuc2NlbmVzLmxlbmd0aDtcblxuICAgIC8vIGlmIHRoZXJlJ3MgYSBzaW5nbGUgc2NlbmUgd2l0aCBhIHNpbmdsZSBub2RlIGluIGl0LCBkb24ndCBjcmVhdGUgd3JhcHBlciBub2Rlc1xuICAgIGlmIChjb3VudCA9PT0gMSAmJiBnbHRmLnNjZW5lc1swXS5ub2Rlcz8ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IGdsdGYuc2NlbmVzWzBdLm5vZGVzWzBdO1xuICAgICAgICBzY2VuZXMucHVzaChub2Rlc1tub2RlSW5kZXhdKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIC8vIGNyZWF0ZSByb290IG5vZGUgcGVyIHNjZW5lXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lc1tpXTtcbiAgICAgICAgICAgIGlmIChzY2VuZS5ub2Rlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lUm9vdCA9IG5ldyBHcmFwaE5vZGUoc2NlbmUubmFtZSk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbiA9IDA7IG4gPCBzY2VuZS5ub2Rlcy5sZW5ndGg7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZE5vZGUgPSBub2Rlc1tzY2VuZS5ub2Rlc1tuXV07XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lUm9vdC5hZGRDaGlsZChjaGlsZE5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzY2VuZXMucHVzaChzY2VuZVJvb3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjZW5lcztcbn07XG5cbmNvbnN0IGNyZWF0ZUNhbWVyYXMgPSBmdW5jdGlvbiAoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpIHtcblxuICAgIGxldCBjYW1lcmFzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2NhbWVyYXMnKSAmJiBnbHRmLmNhbWVyYXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuY2FtZXJhICYmIG9wdGlvbnMuY2FtZXJhLnByZXByb2Nlc3M7XG4gICAgICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zICYmIG9wdGlvbnMuY2FtZXJhICYmIG9wdGlvbnMuY2FtZXJhLnByb2Nlc3MgfHwgY3JlYXRlQ2FtZXJhO1xuICAgICAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5jYW1lcmEgJiYgb3B0aW9ucy5jYW1lcmEucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChnbHRmTm9kZSwgbm9kZUluZGV4KSB7XG4gICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NhbWVyYScpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkNhbWVyYSA9IGdsdGYuY2FtZXJhc1tnbHRmTm9kZS5jYW1lcmFdO1xuICAgICAgICAgICAgICAgIGlmIChnbHRmQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZDYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHByb2Nlc3MoZ2x0ZkNhbWVyYSwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkNhbWVyYSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgY2FtZXJhIHRvIG5vZGUtPmNhbWVyYSBtYXBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYW1lcmFzKSBjYW1lcmFzID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhcy5zZXQoZ2x0Zk5vZGUsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjYW1lcmFzO1xufTtcblxuY29uc3QgY3JlYXRlTGlnaHRzID0gZnVuY3Rpb24gKGdsdGYsIG5vZGVzLCBvcHRpb25zKSB7XG5cbiAgICBsZXQgbGlnaHRzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSAmJlxuICAgICAgICBnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9saWdodHNfcHVuY3R1YWwnKSAmJiBnbHRmLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHRzJykpIHtcblxuICAgICAgICBjb25zdCBnbHRmTGlnaHRzID0gZ2x0Zi5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHRzO1xuICAgICAgICBpZiAoZ2x0ZkxpZ2h0cy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5saWdodCAmJiBvcHRpb25zLmxpZ2h0LnByZXByb2Nlc3M7XG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpZ2h0ICYmIG9wdGlvbnMubGlnaHQucHJvY2VzcyB8fCBjcmVhdGVMaWdodDtcbiAgICAgICAgICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmxpZ2h0ICYmIG9wdGlvbnMubGlnaHQucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBub2RlcyB3aXRoIGxpZ2h0c1xuICAgICAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChnbHRmTm9kZSwgbm9kZUluZGV4KSB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2xpZ2h0c19wdW5jdHVhbCcpICYmXG4gICAgICAgICAgICAgICAgICAgIGdsdGZOb2RlLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHQnKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0SW5kZXggPSBnbHRmTm9kZS5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZMaWdodCA9IGdsdGZMaWdodHNbbGlnaHRJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBwcm9jZXNzKGdsdGZMaWdodCwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTGlnaHQsIGxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBsaWdodCB0byBub2RlLT5saWdodCBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRzKSBsaWdodHMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRzLnNldChnbHRmTm9kZSwgbGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlnaHRzO1xufTtcblxuLy8gbGluayBza2lucyB0byB0aGUgbWVzaGVzXG5jb25zdCBsaW5rU2tpbnMgPSBmdW5jdGlvbiAoZ2x0ZiwgcmVuZGVycywgc2tpbnMpIHtcbiAgICBnbHRmLm5vZGVzLmZvckVhY2goKGdsdGZOb2RlKSA9PiB7XG4gICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbWVzaCcpICYmIGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdza2luJykpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hHcm91cCA9IHJlbmRlcnNbZ2x0Zk5vZGUubWVzaF0ubWVzaGVzO1xuICAgICAgICAgICAgbWVzaEdyb3VwLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgICAgICAgICBtZXNoLnNraW4gPSBza2luc1tnbHRmTm9kZS5za2luXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBjcmVhdGUgZW5naW5lIHJlc291cmNlcyBmcm9tIHRoZSBkb3dubG9hZGVkIEdMQiBkYXRhXG5jb25zdCBjcmVhdGVSZXNvdXJjZXMgPSBmdW5jdGlvbiAoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZUFzc2V0cywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmdsb2JhbCAmJiBvcHRpb25zLmdsb2JhbC5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmdsb2JhbCAmJiBvcHRpb25zLmdsb2JhbC5wb3N0cHJvY2VzcztcblxuICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgIHByZXByb2Nlc3MoZ2x0Zik7XG4gICAgfVxuXG4gICAgLy8gVGhlIG9yaWdpbmFsIHZlcnNpb24gb2YgRkFDVCBnZW5lcmF0ZWQgaW5jb3JyZWN0bHkgZmxpcHBlZCBWIHRleHR1cmVcbiAgICAvLyBjb29yZGluYXRlcy4gV2UgbXVzdCBjb21wZW5zYXRlIGJ5IGZsaXBwaW5nIFYgaW4gdGhpcyBjYXNlLiBPbmNlXG4gICAgLy8gYWxsIG1vZGVscyBoYXZlIGJlZW4gcmUtZXhwb3J0ZWQgd2UgY2FuIHJlbW92ZSB0aGlzIGZsYWcuXG4gICAgY29uc3QgZmxpcFYgPSBnbHRmLmFzc2V0ICYmIGdsdGYuYXNzZXQuZ2VuZXJhdG9yID09PSAnUGxheUNhbnZhcyc7XG5cbiAgICAvLyBXZSdkIGxpa2UgdG8gcmVtb3ZlIHRoZSBmbGlwViBjb2RlIGF0IHNvbWUgcG9pbnQuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ2dsVEYgbW9kZWwgbWF5IGhhdmUgZmxpcHBlZCBVVnMuIFBsZWFzZSByZWNvbnZlcnQuJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZXMgPSBjcmVhdGVOb2RlcyhnbHRmLCBvcHRpb25zKTtcbiAgICBjb25zdCBzY2VuZXMgPSBjcmVhdGVTY2VuZXMoZ2x0Ziwgbm9kZXMpO1xuICAgIGNvbnN0IGxpZ2h0cyA9IGNyZWF0ZUxpZ2h0cyhnbHRmLCBub2Rlcywgb3B0aW9ucyk7XG4gICAgY29uc3QgY2FtZXJhcyA9IGNyZWF0ZUNhbWVyYXMoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IGFuaW1hdGlvbnMgPSBjcmVhdGVBbmltYXRpb25zKGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3cywgb3B0aW9ucyk7XG4gICAgY29uc3QgbWF0ZXJpYWxzID0gY3JlYXRlTWF0ZXJpYWxzKGdsdGYsIHRleHR1cmVBc3NldHMubWFwKGZ1bmN0aW9uICh0ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgcmV0dXJuIHRleHR1cmVBc3NldC5yZXNvdXJjZTtcbiAgICB9KSwgb3B0aW9ucywgZmxpcFYpO1xuICAgIGNvbnN0IHZhcmlhbnRzID0gY3JlYXRlVmFyaWFudHMoZ2x0Zik7XG4gICAgY29uc3QgbWVzaFZhcmlhbnRzID0ge307XG4gICAgY29uc3QgbWVzaERlZmF1bHRNYXRlcmlhbHMgPSB7fTtcbiAgICBjb25zdCBtZXNoZXMgPSBjcmVhdGVNZXNoZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgY2FsbGJhY2ssIGZsaXBWLCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBvcHRpb25zKTtcbiAgICBjb25zdCBza2lucyA9IGNyZWF0ZVNraW5zKGRldmljZSwgZ2x0Ziwgbm9kZXMsIGJ1ZmZlclZpZXdzKTtcblxuICAgIC8vIGNyZWF0ZSByZW5kZXJzIHRvIHdyYXAgbWVzaGVzXG4gICAgY29uc3QgcmVuZGVycyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlbmRlcnNbaV0gPSBuZXcgUmVuZGVyKCk7XG4gICAgICAgIHJlbmRlcnNbaV0ubWVzaGVzID0gbWVzaGVzW2ldO1xuICAgIH1cblxuICAgIC8vIGxpbmsgc2tpbnMgdG8gbWVzaGVzXG4gICAgbGlua1NraW5zKGdsdGYsIHJlbmRlcnMsIHNraW5zKTtcblxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBHbGJSZXNvdXJjZXMoZ2x0Zik7XG4gICAgcmVzdWx0Lm5vZGVzID0gbm9kZXM7XG4gICAgcmVzdWx0LnNjZW5lcyA9IHNjZW5lcztcbiAgICByZXN1bHQuYW5pbWF0aW9ucyA9IGFuaW1hdGlvbnM7XG4gICAgcmVzdWx0LnRleHR1cmVzID0gdGV4dHVyZUFzc2V0cztcbiAgICByZXN1bHQubWF0ZXJpYWxzID0gbWF0ZXJpYWxzO1xuICAgIHJlc3VsdC52YXJpYW50cyA9IHZhcmlhbnRzO1xuICAgIHJlc3VsdC5tZXNoVmFyaWFudHMgPSBtZXNoVmFyaWFudHM7XG4gICAgcmVzdWx0Lm1lc2hEZWZhdWx0TWF0ZXJpYWxzID0gbWVzaERlZmF1bHRNYXRlcmlhbHM7XG4gICAgcmVzdWx0LnJlbmRlcnMgPSByZW5kZXJzO1xuICAgIHJlc3VsdC5za2lucyA9IHNraW5zO1xuICAgIHJlc3VsdC5saWdodHMgPSBsaWdodHM7XG4gICAgcmVzdWx0LmNhbWVyYXMgPSBjYW1lcmFzO1xuXG4gICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgIHBvc3Rwcm9jZXNzKGdsdGYsIHJlc3VsdCk7XG4gICAgfVxuXG4gICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbn07XG5cbmNvbnN0IGFwcGx5U2FtcGxlciA9IGZ1bmN0aW9uICh0ZXh0dXJlLCBnbHRmU2FtcGxlcikge1xuICAgIGNvbnN0IGdldEZpbHRlciA9IGZ1bmN0aW9uIChmaWx0ZXIsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICBzd2l0Y2ggKGZpbHRlcikge1xuICAgICAgICAgICAgY2FzZSA5NzI4OiByZXR1cm4gRklMVEVSX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk3Mjk6IHJldHVybiBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgY2FzZSA5OTg0OiByZXR1cm4gRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk5ODU6IHJldHVybiBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUO1xuICAgICAgICAgICAgY2FzZSA5OTg2OiByZXR1cm4gRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUjtcbiAgICAgICAgICAgIGNhc2UgOTk4NzogcmV0dXJuIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUjtcbiAgICAgICAgICAgIGRlZmF1bHQ6ICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBnZXRXcmFwID0gZnVuY3Rpb24gKHdyYXAsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICBzd2l0Y2ggKHdyYXApIHtcbiAgICAgICAgICAgIGNhc2UgMzMwNzE6IHJldHVybiBBRERSRVNTX0NMQU1QX1RPX0VER0U7XG4gICAgICAgICAgICBjYXNlIDMzNjQ4OiByZXR1cm4gQUREUkVTU19NSVJST1JFRF9SRVBFQVQ7XG4gICAgICAgICAgICBjYXNlIDEwNDk3OiByZXR1cm4gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgICAgICBkZWZhdWx0OiAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGlmICh0ZXh0dXJlKSB7XG4gICAgICAgIGdsdGZTYW1wbGVyID0gZ2x0ZlNhbXBsZXIgfHwgeyB9O1xuICAgICAgICB0ZXh0dXJlLm1pbkZpbHRlciA9IGdldEZpbHRlcihnbHRmU2FtcGxlci5taW5GaWx0ZXIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUik7XG4gICAgICAgIHRleHR1cmUubWFnRmlsdGVyID0gZ2V0RmlsdGVyKGdsdGZTYW1wbGVyLm1hZ0ZpbHRlciwgRklMVEVSX0xJTkVBUik7XG4gICAgICAgIHRleHR1cmUuYWRkcmVzc1UgPSBnZXRXcmFwKGdsdGZTYW1wbGVyLndyYXBTLCBBRERSRVNTX1JFUEVBVCk7XG4gICAgICAgIHRleHR1cmUuYWRkcmVzc1YgPSBnZXRXcmFwKGdsdGZTYW1wbGVyLndyYXBULCBBRERSRVNTX1JFUEVBVCk7XG4gICAgfVxufTtcblxubGV0IGdsdGZUZXh0dXJlVW5pcXVlSWQgPSAwO1xuXG4vLyBsb2FkIGFuIGltYWdlXG5jb25zdCBsb2FkSW1hZ2VBc3luYyA9IGZ1bmN0aW9uIChnbHRmSW1hZ2UsIGluZGV4LCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5pbWFnZSAmJiBvcHRpb25zLmltYWdlLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5pbWFnZSAmJiBvcHRpb25zLmltYWdlLnByb2Nlc3NBc3luYykgfHwgZnVuY3Rpb24gKGdsdGZJbWFnZSwgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5pbWFnZSAmJiBvcHRpb25zLmltYWdlLnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKHRleHR1cmVBc3NldCkge1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZJbWFnZSwgdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlQXNzZXQpO1xuICAgIH07XG5cbiAgICBjb25zdCBtaW1lVHlwZUZpbGVFeHRlbnNpb25zID0ge1xuICAgICAgICAnaW1hZ2UvcG5nJzogJ3BuZycsXG4gICAgICAgICdpbWFnZS9qcGVnJzogJ2pwZycsXG4gICAgICAgICdpbWFnZS9iYXNpcyc6ICdiYXNpcycsXG4gICAgICAgICdpbWFnZS9rdHgnOiAna3R4JyxcbiAgICAgICAgJ2ltYWdlL2t0eDInOiAna3R4MicsXG4gICAgICAgICdpbWFnZS92bmQtbXMuZGRzJzogJ2RkcydcbiAgICB9O1xuXG4gICAgY29uc3QgbG9hZFRleHR1cmUgPSBmdW5jdGlvbiAodXJsLCBidWZmZXJWaWV3LCBtaW1lVHlwZSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBuYW1lID0gKGdsdGZJbWFnZS5uYW1lIHx8ICdnbHRmLXRleHR1cmUnKSArICctJyArIGdsdGZUZXh0dXJlVW5pcXVlSWQrKztcblxuICAgICAgICAvLyBjb25zdHJ1Y3QgdGhlIGFzc2V0IGZpbGVcbiAgICAgICAgY29uc3QgZmlsZSA9IHtcbiAgICAgICAgICAgIHVybDogdXJsIHx8IG5hbWVcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGJ1ZmZlclZpZXcpIHtcbiAgICAgICAgICAgIGZpbGUuY29udGVudHMgPSBidWZmZXJWaWV3LnNsaWNlKDApLmJ1ZmZlcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWltZVR5cGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IG1pbWVUeXBlRmlsZUV4dGVuc2lvbnNbbWltZVR5cGVdO1xuICAgICAgICAgICAgaWYgKGV4dGVuc2lvbikge1xuICAgICAgICAgICAgICAgIGZpbGUuZmlsZW5hbWUgPSBmaWxlLnVybCArICcuJyArIGV4dGVuc2lvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgbG9hZCB0aGUgYXNzZXRcbiAgICAgICAgY29uc3QgYXNzZXQgPSBuZXcgQXNzZXQobmFtZSwgJ3RleHR1cmUnLCBmaWxlLCBudWxsLCBvcHRpb25zKTtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCBvbkxvYWQpO1xuICAgICAgICBhc3NldC5vbignZXJyb3InLCBjYWxsYmFjayk7XG4gICAgICAgIHJlZ2lzdHJ5LmFkZChhc3NldCk7XG4gICAgICAgIHJlZ2lzdHJ5LmxvYWQoYXNzZXQpO1xuICAgIH07XG5cbiAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICBwcmVwcm9jZXNzKGdsdGZJbWFnZSk7XG4gICAgfVxuXG4gICAgcHJvY2Vzc0FzeW5jKGdsdGZJbWFnZSwgZnVuY3Rpb24gKGVyciwgdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgIH0gZWxzZSBpZiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICBvbkxvYWQodGV4dHVyZUFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChnbHRmSW1hZ2UuaGFzT3duUHJvcGVydHkoJ3VyaScpKSB7XG4gICAgICAgICAgICAgICAgLy8gdXJpIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgIGlmIChpc0RhdGFVUkkoZ2x0ZkltYWdlLnVyaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9hZFRleHR1cmUoZ2x0ZkltYWdlLnVyaSwgbnVsbCwgZ2V0RGF0YVVSSU1pbWVUeXBlKGdsdGZJbWFnZS51cmkpLCBudWxsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZShBQlNPTFVURV9VUkwudGVzdChnbHRmSW1hZ2UudXJpKSA/IGdsdGZJbWFnZS51cmkgOiBwYXRoLmpvaW4odXJsQmFzZSwgZ2x0ZkltYWdlLnVyaSksIG51bGwsIG51bGwsIHsgY3Jvc3NPcmlnaW46ICdhbm9ueW1vdXMnIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCdidWZmZXJWaWV3JykgJiYgZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCdtaW1lVHlwZScpKSB7XG4gICAgICAgICAgICAgICAgLy8gYnVmZmVydmlld1xuICAgICAgICAgICAgICAgIGxvYWRUZXh0dXJlKG51bGwsIGJ1ZmZlclZpZXdzW2dsdGZJbWFnZS5idWZmZXJWaWV3XSwgZ2x0ZkltYWdlLm1pbWVUeXBlLCBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gZmFpbFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGltYWdlIGZvdW5kIGluIGdsdGYgKG5laXRoZXIgdXJpIG9yIGJ1ZmZlclZpZXcgZm91bmQpLiBpbmRleD0nICsgaW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBsb2FkIHRleHR1cmVzIHVzaW5nIHRoZSBhc3NldCBzeXN0ZW1cbmNvbnN0IGxvYWRUZXh0dXJlc0FzeW5jID0gZnVuY3Rpb24gKGdsdGYsIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ2ltYWdlcycpIHx8IGdsdGYuaW1hZ2VzLmxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAhZ2x0Zi5oYXNPd25Qcm9wZXJ0eSgndGV4dHVyZXMnKSB8fCBnbHRmLnRleHR1cmVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBbXSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLnRleHR1cmUgJiYgb3B0aW9ucy50ZXh0dXJlLnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy50ZXh0dXJlICYmIG9wdGlvbnMudGV4dHVyZS5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmVGV4dHVyZSwgZ2x0ZkltYWdlcywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy50ZXh0dXJlICYmIG9wdGlvbnMudGV4dHVyZS5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IGFzc2V0cyA9IFtdOyAgICAgICAgLy8gb25lIHBlciBpbWFnZVxuICAgIGNvbnN0IHRleHR1cmVzID0gW107ICAgICAgLy8gbGlzdCBwZXIgaW1hZ2VcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLnRleHR1cmVzLmxlbmd0aDtcbiAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAodGV4dHVyZUluZGV4LCBpbWFnZUluZGV4KSB7XG4gICAgICAgIGlmICghdGV4dHVyZXNbaW1hZ2VJbmRleF0pIHtcbiAgICAgICAgICAgIHRleHR1cmVzW2ltYWdlSW5kZXhdID0gW107XG4gICAgICAgIH1cbiAgICAgICAgdGV4dHVyZXNbaW1hZ2VJbmRleF0ucHVzaCh0ZXh0dXJlSW5kZXgpO1xuXG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgICAgICAgICB0ZXh0dXJlcy5mb3JFYWNoKGZ1bmN0aW9uICh0ZXh0dXJlTGlzdCwgaW1hZ2VJbmRleCkge1xuICAgICAgICAgICAgICAgIHRleHR1cmVMaXN0LmZvckVhY2goZnVuY3Rpb24gKHRleHR1cmVJbmRleCwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGV4dHVyZUFzc2V0ID0gKGluZGV4ID09PSAwKSA/IGFzc2V0c1tpbWFnZUluZGV4XSA6IGNsb25lVGV4dHVyZUFzc2V0KGFzc2V0c1tpbWFnZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIGFwcGx5U2FtcGxlcih0ZXh0dXJlQXNzZXQucmVzb3VyY2UsIChnbHRmLnNhbXBsZXJzIHx8IFtdKVtnbHRmLnRleHR1cmVzW3RleHR1cmVJbmRleF0uc2FtcGxlcl0pO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRbdGV4dHVyZUluZGV4XSA9IHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmLnRleHR1cmVzW3RleHR1cmVJbmRleF0sIHRleHR1cmVBc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYudGV4dHVyZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZlRleHR1cmUgPSBnbHRmLnRleHR1cmVzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZUZXh0dXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmVGV4dHVyZSwgZ2x0Zi5pbWFnZXMsIGZ1bmN0aW9uIChpLCBnbHRmVGV4dHVyZSwgZXJyLCBnbHRmSW1hZ2VJbmRleCkge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChnbHRmSW1hZ2VJbmRleCA9PT0gdW5kZWZpbmVkIHx8IGdsdGZJbWFnZUluZGV4ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGdsdGZJbWFnZUluZGV4ID0gZ2x0ZlRleHR1cmU/LmV4dGVuc2lvbnM/LktIUl90ZXh0dXJlX2Jhc2lzdT8uc291cmNlO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0ZkltYWdlSW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZkltYWdlSW5kZXggPSBnbHRmVGV4dHVyZS5zb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRzW2dsdGZJbWFnZUluZGV4XSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBpbWFnZSBoYXMgYWxyZWFkeSBiZWVuIGxvYWRlZFxuICAgICAgICAgICAgICAgICAgICBvbkxvYWQoaSwgZ2x0ZkltYWdlSW5kZXgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGZpcnN0IG9jY2N1cnJlbmNlLCBsb2FkIGl0XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZJbWFnZSA9IGdsdGYuaW1hZ2VzW2dsdGZJbWFnZUluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgbG9hZEltYWdlQXN5bmMoZ2x0ZkltYWdlLCBpLCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHRleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0c1tnbHRmSW1hZ2VJbmRleF0gPSB0ZXh0dXJlQXNzZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25Mb2FkKGksIGdsdGZJbWFnZUluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQobnVsbCwgaSwgZ2x0ZlRleHR1cmUpKTtcbiAgICB9XG59O1xuXG4vLyBsb2FkIGdsdGYgYnVmZmVycyBhc3luY2hyb25vdXNseSwgcmV0dXJuaW5nIHRoZW0gaW4gdGhlIGNhbGxiYWNrXG5jb25zdCBsb2FkQnVmZmVyc0FzeW5jID0gZnVuY3Rpb24gKGdsdGYsIGJpbmFyeUNodW5rLCB1cmxCYXNlLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgaWYgKCFnbHRmLmJ1ZmZlcnMgfHwgZ2x0Zi5idWZmZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXIgJiYgb3B0aW9ucy5idWZmZXIucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSAob3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlciAmJiBvcHRpb25zLmJ1ZmZlci5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmQnVmZmVyLCBjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBudWxsKTtcbiAgICB9O1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlciAmJiBvcHRpb25zLmJ1ZmZlci5wb3N0cHJvY2VzcztcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLmJ1ZmZlcnMubGVuZ3RoO1xuICAgIGNvbnN0IG9uTG9hZCA9IGZ1bmN0aW9uIChpbmRleCwgYnVmZmVyKSB7XG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBidWZmZXI7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zi5idWZmZXJzW2luZGV4XSwgYnVmZmVyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoLS1yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbHRmLmJ1ZmZlcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlciA9IGdsdGYuYnVmZmVyc1tpXTtcblxuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyLCBmdW5jdGlvbiAoaSwgZ2x0ZkJ1ZmZlciwgZXJyLCBhcnJheUJ1ZmZlcikgeyAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhcnJheUJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCBuZXcgVWludDhBcnJheShhcnJheUJ1ZmZlcikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0ZkJ1ZmZlci5oYXNPd25Qcm9wZXJ0eSgndXJpJykpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzRGF0YVVSSShnbHRmQnVmZmVyLnVyaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgYmFzZTY0IHRvIHJhdyBiaW5hcnkgZGF0YSBoZWxkIGluIGEgc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBkb2Vzbid0IGhhbmRsZSBVUkxFbmNvZGVkIERhdGFVUklzIC0gc2VlIFNPIGFuc3dlciAjNjg1MDI3NiBmb3IgY29kZSB0aGF0IGRvZXMgdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnl0ZVN0cmluZyA9IGF0b2IoZ2x0ZkJ1ZmZlci51cmkuc3BsaXQoJywnKVsxXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBhIHZpZXcgaW50byB0aGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiaW5hcnlBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ5dGVTdHJpbmcubGVuZ3RoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc2V0IHRoZSBieXRlcyBvZiB0aGUgYnVmZmVyIHRvIHRoZSBjb3JyZWN0IHZhbHVlc1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBieXRlU3RyaW5nLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluYXJ5QXJyYXlbal0gPSBieXRlU3RyaW5nLmNoYXJDb2RlQXQoaik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBiaW5hcnlBcnJheSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBodHRwLmdldChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBBQlNPTFVURV9VUkwudGVzdChnbHRmQnVmZmVyLnVyaSkgPyBnbHRmQnVmZmVyLnVyaSA6IHBhdGguam9pbih1cmxCYXNlLCBnbHRmQnVmZmVyLnVyaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBjYWNoZTogdHJ1ZSwgcmVzcG9uc2VUeXBlOiAnYXJyYXlidWZmZXInLCByZXRyeTogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAoaSwgZXJyLCByZXN1bHQpIHsgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBuZXcgVWludDhBcnJheShyZXN1bHQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0uYmluZChudWxsLCBpKVxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGdsYiBidWZmZXIgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgICAgIG9uTG9hZChpLCBiaW5hcnlDaHVuayk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LmJpbmQobnVsbCwgaSwgZ2x0ZkJ1ZmZlcikpO1xuICAgIH1cbn07XG5cbi8vIHBhcnNlIHRoZSBnbHRmIGNodW5rLCByZXR1cm5zIHRoZSBnbHRmIGpzb25cbmNvbnN0IHBhcnNlR2x0ZiA9IGZ1bmN0aW9uIChnbHRmQ2h1bmssIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgZGVjb2RlQmluYXJ5VXRmOCA9IGZ1bmN0aW9uIChhcnJheSkge1xuICAgICAgICBpZiAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShhcnJheSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RyID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGFycmF5W2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKHN0cikpO1xuICAgIH07XG5cbiAgICBjb25zdCBnbHRmID0gSlNPTi5wYXJzZShkZWNvZGVCaW5hcnlVdGY4KGdsdGZDaHVuaykpO1xuXG4gICAgLy8gY2hlY2sgZ2x0ZiB2ZXJzaW9uXG4gICAgaWYgKGdsdGYuYXNzZXQgJiYgZ2x0Zi5hc3NldC52ZXJzaW9uICYmIHBhcnNlRmxvYXQoZ2x0Zi5hc3NldC52ZXJzaW9uKSA8IDIpIHtcbiAgICAgICAgY2FsbGJhY2soYEludmFsaWQgZ2x0ZiB2ZXJzaW9uLiBFeHBlY3RlZCB2ZXJzaW9uIDIuMCBvciBhYm92ZSBidXQgZm91bmQgdmVyc2lvbiAnJHtnbHRmLmFzc2V0LnZlcnNpb259Jy5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGNoZWNrIHJlcXVpcmVkIGV4dGVuc2lvbnNcbiAgICBjb25zdCBleHRlbnNpb25zVXNlZCA9IGdsdGY/LmV4dGVuc2lvbnNVc2VkIHx8IFtdO1xuICAgIGlmICghZHJhY29EZWNvZGVySW5zdGFuY2UgJiYgIWdldEdsb2JhbERyYWNvRGVjb2Rlck1vZHVsZSgpICYmIGV4dGVuc2lvbnNVc2VkLmluZGV4T2YoJ0tIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uJykgIT09IC0xKSB7XG4gICAgICAgIFdhc21Nb2R1bGUuZ2V0SW5zdGFuY2UoJ0RyYWNvRGVjb2Rlck1vZHVsZScsIChpbnN0YW5jZSkgPT4ge1xuICAgICAgICAgICAgZHJhY29EZWNvZGVySW5zdGFuY2UgPSBpbnN0YW5jZTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGdsdGYpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBnbHRmKTtcbiAgICB9XG59O1xuXG4vLyBwYXJzZSBnbGIgZGF0YSwgcmV0dXJucyB0aGUgZ2x0ZiBhbmQgYmluYXJ5IGNodW5rXG5jb25zdCBwYXJzZUdsYiA9IGZ1bmN0aW9uIChnbGJEYXRhLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGRhdGEgPSAoZ2xiRGF0YSBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSA/IG5ldyBEYXRhVmlldyhnbGJEYXRhKSA6IG5ldyBEYXRhVmlldyhnbGJEYXRhLmJ1ZmZlciwgZ2xiRGF0YS5ieXRlT2Zmc2V0LCBnbGJEYXRhLmJ5dGVMZW5ndGgpO1xuXG4gICAgLy8gcmVhZCBoZWFkZXJcbiAgICBjb25zdCBtYWdpYyA9IGRhdGEuZ2V0VWludDMyKDAsIHRydWUpO1xuICAgIGNvbnN0IHZlcnNpb24gPSBkYXRhLmdldFVpbnQzMig0LCB0cnVlKTtcbiAgICBjb25zdCBsZW5ndGggPSBkYXRhLmdldFVpbnQzMig4LCB0cnVlKTtcblxuICAgIGlmIChtYWdpYyAhPT0gMHg0NjU0NkM2Nykge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBtYWdpYyBudW1iZXIgZm91bmQgaW4gZ2xiIGhlYWRlci4gRXhwZWN0ZWQgMHg0NjU0NkM2NywgZm91bmQgMHgnICsgbWFnaWMudG9TdHJpbmcoMTYpKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh2ZXJzaW9uICE9PSAyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIHZlcnNpb24gbnVtYmVyIGZvdW5kIGluIGdsYiBoZWFkZXIuIEV4cGVjdGVkIDIsIGZvdW5kICcgKyB2ZXJzaW9uKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChsZW5ndGggPD0gMCB8fCBsZW5ndGggPiBkYXRhLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbGVuZ3RoIGZvdW5kIGluIGdsYiBoZWFkZXIuIEZvdW5kICcgKyBsZW5ndGgpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gcmVhZCBjaHVua3NcbiAgICBjb25zdCBjaHVua3MgPSBbXTtcbiAgICBsZXQgb2Zmc2V0ID0gMTI7XG4gICAgd2hpbGUgKG9mZnNldCA8IGxlbmd0aCkge1xuICAgICAgICBjb25zdCBjaHVua0xlbmd0aCA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCwgdHJ1ZSk7XG4gICAgICAgIGlmIChvZmZzZXQgKyBjaHVua0xlbmd0aCArIDggPiBkYXRhLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjaHVuayBsZW5ndGggZm91bmQgaW4gZ2xiLiBGb3VuZCAnICsgY2h1bmtMZW5ndGgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNodW5rVHlwZSA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCArIDQsIHRydWUpO1xuICAgICAgICBjb25zdCBjaHVua0RhdGEgPSBuZXcgVWludDhBcnJheShkYXRhLmJ1ZmZlciwgZGF0YS5ieXRlT2Zmc2V0ICsgb2Zmc2V0ICsgOCwgY2h1bmtMZW5ndGgpO1xuICAgICAgICBjaHVua3MucHVzaCh7IGxlbmd0aDogY2h1bmtMZW5ndGgsIHR5cGU6IGNodW5rVHlwZSwgZGF0YTogY2h1bmtEYXRhIH0pO1xuICAgICAgICBvZmZzZXQgKz0gY2h1bmtMZW5ndGggKyA4O1xuICAgIH1cblxuICAgIGlmIChjaHVua3MubGVuZ3RoICE9PSAxICYmIGNodW5rcy5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbnVtYmVyIG9mIGNodW5rcyBmb3VuZCBpbiBnbGIgZmlsZS4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaHVua3NbMF0udHlwZSAhPT0gMHg0RTRGNTM0QSkge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBjaHVuayB0eXBlIGZvdW5kIGluIGdsYiBmaWxlLiBFeHBlY3RlZCAweDRFNEY1MzRBLCBmb3VuZCAweCcgKyBjaHVua3NbMF0udHlwZS50b1N0cmluZygxNikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNodW5rcy5sZW5ndGggPiAxICYmIGNodW5rc1sxXS50eXBlICE9PSAweDAwNEU0OTQyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGNodW5rIHR5cGUgZm91bmQgaW4gZ2xiIGZpbGUuIEV4cGVjdGVkIDB4MDA0RTQ5NDIsIGZvdW5kIDB4JyArIGNodW5rc1sxXS50eXBlLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgIGdsdGZDaHVuazogY2h1bmtzWzBdLmRhdGEsXG4gICAgICAgIGJpbmFyeUNodW5rOiBjaHVua3MubGVuZ3RoID09PSAyID8gY2h1bmtzWzFdLmRhdGEgOiBudWxsXG4gICAgfSk7XG59O1xuXG4vLyBwYXJzZSB0aGUgY2h1bmsgb2YgZGF0YSwgd2hpY2ggY2FuIGJlIGdsYiBvciBnbHRmXG5jb25zdCBwYXJzZUNodW5rID0gZnVuY3Rpb24gKGZpbGVuYW1lLCBkYXRhLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IGhhc0dsYkhlYWRlciA9ICgpID0+IHtcbiAgICAgICAgLy8gZ2xiIGZvcm1hdCBzdGFydHMgd2l0aCAnZ2xURidcbiAgICAgICAgY29uc3QgdTggPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgICAgICAgcmV0dXJuIHU4WzBdID09PSAxMDMgJiYgdThbMV0gPT09IDEwOCAmJiB1OFsyXSA9PT0gODQgJiYgdThbM10gPT09IDcwO1xuICAgIH07XG5cbiAgICBpZiAoKGZpbGVuYW1lICYmIGZpbGVuYW1lLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoJy5nbGInKSkgfHwgaGFzR2xiSGVhZGVyKCkpIHtcbiAgICAgICAgcGFyc2VHbGIoZGF0YSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgICAgIGdsdGZDaHVuazogZGF0YSxcbiAgICAgICAgICAgIGJpbmFyeUNodW5rOiBudWxsXG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8vIGNyZWF0ZSBidWZmZXIgdmlld3NcbmNvbnN0IHBhcnNlQnVmZmVyVmlld3NBc3luYyA9IGZ1bmN0aW9uIChnbHRmLCBidWZmZXJzLCBvcHRpb25zLCBjYWxsYmFjaykge1xuXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucyAmJiBvcHRpb25zLmJ1ZmZlclZpZXcgJiYgb3B0aW9ucy5idWZmZXJWaWV3LnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wcm9jZXNzQXN5bmMpIHx8IGZ1bmN0aW9uIChnbHRmQnVmZmVyVmlldywgYnVmZmVycywgY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgbnVsbCk7XG4gICAgfTtcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5idWZmZXJWaWV3ICYmIG9wdGlvbnMuYnVmZmVyVmlldy5wb3N0cHJvY2VzcztcblxuICAgIGxldCByZW1haW5pbmcgPSBnbHRmLmJ1ZmZlclZpZXdzID8gZ2x0Zi5idWZmZXJWaWV3cy5sZW5ndGggOiAwO1xuXG4gICAgLy8gaGFuZGxlIGNhc2Ugb2Ygbm8gYnVmZmVyc1xuICAgIGlmICghcmVtYWluaW5nKSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIG51bGwpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgb25Mb2FkID0gZnVuY3Rpb24gKGluZGV4LCBidWZmZXJWaWV3KSB7XG4gICAgICAgIGNvbnN0IGdsdGZCdWZmZXJWaWV3ID0gZ2x0Zi5idWZmZXJWaWV3c1tpbmRleF07XG4gICAgICAgIGlmIChnbHRmQnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpKSB7XG4gICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVTdHJpZGUgPSBnbHRmQnVmZmVyVmlldy5ieXRlU3RyaWRlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IGJ1ZmZlclZpZXc7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkJ1ZmZlclZpZXcsIGJ1ZmZlclZpZXcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICgtLXJlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlclZpZXcgPSBnbHRmLmJ1ZmZlclZpZXdzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXJWaWV3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyVmlldywgYnVmZmVycywgZnVuY3Rpb24gKGksIGdsdGZCdWZmZXJWaWV3LCBlcnIsIHJlc3VsdCkgeyAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWxvb3AtZnVuY1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCByZXN1bHQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBidWZmZXJzW2dsdGZCdWZmZXJWaWV3LmJ1ZmZlcl07XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ1ZmZlci5idWZmZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJ1ZmZlci5ieXRlT2Zmc2V0ICsgKGdsdGZCdWZmZXJWaWV3LmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZCdWZmZXJWaWV3LmJ5dGVMZW5ndGgpO1xuICAgICAgICAgICAgICAgIG9uTG9hZChpLCB0eXBlZEFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfS5iaW5kKG51bGwsIGksIGdsdGZCdWZmZXJWaWV3KSk7XG4gICAgfVxufTtcblxuLy8gLS0gR2xiUGFyc2VyXG5jbGFzcyBHbGJQYXJzZXIge1xuICAgIC8vIHBhcnNlIHRoZSBnbHRmIG9yIGdsYiBkYXRhIGFzeW5jaHJvbm91c2x5LCBsb2FkaW5nIGV4dGVybmFsIHJlc291cmNlc1xuICAgIHN0YXRpYyBwYXJzZUFzeW5jKGZpbGVuYW1lLCB1cmxCYXNlLCBkYXRhLCBkZXZpY2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICAvLyBwYXJzZSB0aGUgZGF0YVxuICAgICAgICBwYXJzZUNodW5rKGZpbGVuYW1lLCBkYXRhLCBmdW5jdGlvbiAoZXJyLCBjaHVua3MpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcGFyc2UgZ2x0ZlxuICAgICAgICAgICAgcGFyc2VHbHRmKGNodW5rcy5nbHRmQ2h1bmssIGZ1bmN0aW9uIChlcnIsIGdsdGYpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBhc3luYyBsb2FkIGV4dGVybmFsIGJ1ZmZlcnNcbiAgICAgICAgICAgICAgICBsb2FkQnVmZmVyc0FzeW5jKGdsdGYsIGNodW5rcy5iaW5hcnlDaHVuaywgdXJsQmFzZSwgb3B0aW9ucywgZnVuY3Rpb24gKGVyciwgYnVmZmVycykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXN5bmMgbG9hZCBidWZmZXIgdmlld3NcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VCdWZmZXJWaWV3c0FzeW5jKGdsdGYsIGJ1ZmZlcnMsIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlclZpZXdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFzeW5jIGxvYWQgaW1hZ2VzXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkVGV4dHVyZXNBc3luYyhnbHRmLCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIHRleHR1cmVBc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVSZXNvdXJjZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZUFzc2V0cywgb3B0aW9ucywgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHBhcnNlIHRoZSBnbHRmIG9yIGdsYiBkYXRhIHN5bmNocm9ub3VzbHkuIGV4dGVybmFsIHJlc291cmNlcyAoYnVmZmVycyBhbmQgaW1hZ2VzKSBhcmUgaWdub3JlZC5cbiAgICBzdGF0aWMgcGFyc2UoZmlsZW5hbWUsIGRhdGEsIGRldmljZSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgeyB9O1xuXG4gICAgICAgIC8vIHBhcnNlIHRoZSBkYXRhXG4gICAgICAgIHBhcnNlQ2h1bmsoZmlsZW5hbWUsIGRhdGEsIGZ1bmN0aW9uIChlcnIsIGNodW5rcykge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHBhcnNlIGdsdGZcbiAgICAgICAgICAgICAgICBwYXJzZUdsdGYoY2h1bmtzLmdsdGZDaHVuaywgZnVuY3Rpb24gKGVyciwgZ2x0Zikge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGFyc2UgYnVmZmVyIHZpZXdzXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJzZUJ1ZmZlclZpZXdzQXN5bmMoZ2x0ZiwgW2NodW5rcy5iaW5hcnlDaHVua10sIG9wdGlvbnMsIGZ1bmN0aW9uIChlcnIsIGJ1ZmZlclZpZXdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSByZXNvdXJjZXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlUmVzb3VyY2VzKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIFtdLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIGFzc2V0cywgbWF4UmV0cmllcykge1xuICAgICAgICB0aGlzLl9kZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIHRoaXMuX2Fzc2V0cyA9IGFzc2V0cztcbiAgICAgICAgdGhpcy5fZGVmYXVsdE1hdGVyaWFsID0gY3JlYXRlTWF0ZXJpYWwoe1xuICAgICAgICAgICAgbmFtZTogJ2RlZmF1bHRHbGJNYXRlcmlhbCdcbiAgICAgICAgfSwgW10pO1xuICAgICAgICB0aGlzLm1heFJldHJpZXMgPSBtYXhSZXRyaWVzO1xuICAgIH1cblxuICAgIF9nZXRVcmxXaXRob3V0UGFyYW1zKHVybCkge1xuICAgICAgICByZXR1cm4gdXJsLmluZGV4T2YoJz8nKSA+PSAwID8gdXJsLnNwbGl0KCc/JylbMF0gOiB1cmw7XG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICBBc3NldC5mZXRjaEFycmF5QnVmZmVyKHVybC5sb2FkLCAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBHbGJQYXJzZXIucGFyc2VBc3luYyhcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZ2V0VXJsV2l0aG91dFBhcmFtcyh1cmwub3JpZ2luYWwpLFxuICAgICAgICAgICAgICAgICAgICBwYXRoLmV4dHJhY3RQYXRoKHVybC5sb2FkKSxcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kZXZpY2UsXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0LnJlZ2lzdHJ5LFxuICAgICAgICAgICAgICAgICAgICBhc3NldC5vcHRpb25zLFxuICAgICAgICAgICAgICAgICAgICAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyByZXR1cm4gZXZlcnl0aGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG5ldyBHbGJDb250YWluZXJSZXNvdXJjZShyZXN1bHQsIGFzc2V0LCB0aGlzLl9hc3NldHMsIHRoaXMuX2RlZmF1bHRNYXRlcmlhbCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgYXNzZXQsIHRoaXMubWF4UmV0cmllcyk7XG4gICAgfVxuXG4gICAgb3Blbih1cmwsIGRhdGEsIGFzc2V0KSB7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIHBhdGNoKGFzc2V0LCBhc3NldHMpIHtcblxuICAgIH1cbn1cblxuZXhwb3J0IHsgR2xiUGFyc2VyIH07XG4iXSwibmFtZXMiOlsiZHJhY29EZWNvZGVySW5zdGFuY2UiLCJnZXRHbG9iYWxEcmFjb0RlY29kZXJNb2R1bGUiLCJ3aW5kb3ciLCJEcmFjb0RlY29kZXJNb2R1bGUiLCJHbGJSZXNvdXJjZXMiLCJjb25zdHJ1Y3RvciIsImdsdGYiLCJub2RlcyIsInNjZW5lcyIsImFuaW1hdGlvbnMiLCJ0ZXh0dXJlcyIsIm1hdGVyaWFscyIsInZhcmlhbnRzIiwibWVzaFZhcmlhbnRzIiwibWVzaERlZmF1bHRNYXRlcmlhbHMiLCJyZW5kZXJzIiwic2tpbnMiLCJsaWdodHMiLCJjYW1lcmFzIiwiZGVzdHJveSIsImZvckVhY2giLCJyZW5kZXIiLCJtZXNoZXMiLCJpc0RhdGFVUkkiLCJ1cmkiLCJ0ZXN0IiwiZ2V0RGF0YVVSSU1pbWVUeXBlIiwic3Vic3RyaW5nIiwiaW5kZXhPZiIsImdldE51bUNvbXBvbmVudHMiLCJhY2Nlc3NvclR5cGUiLCJnZXRDb21wb25lbnRUeXBlIiwiY29tcG9uZW50VHlwZSIsIlRZUEVfSU5UOCIsIlRZUEVfVUlOVDgiLCJUWVBFX0lOVDE2IiwiVFlQRV9VSU5UMTYiLCJUWVBFX0lOVDMyIiwiVFlQRV9VSU5UMzIiLCJUWVBFX0ZMT0FUMzIiLCJnZXRDb21wb25lbnRTaXplSW5CeXRlcyIsImdldENvbXBvbmVudERhdGFUeXBlIiwiSW50OEFycmF5IiwiVWludDhBcnJheSIsIkludDE2QXJyYXkiLCJVaW50MTZBcnJheSIsIkludDMyQXJyYXkiLCJVaW50MzJBcnJheSIsIkZsb2F0MzJBcnJheSIsImdsdGZUb0VuZ2luZVNlbWFudGljTWFwIiwiU0VNQU5USUNfUE9TSVRJT04iLCJTRU1BTlRJQ19OT1JNQUwiLCJTRU1BTlRJQ19UQU5HRU5UIiwiU0VNQU5USUNfQ09MT1IiLCJTRU1BTlRJQ19CTEVORElORElDRVMiLCJTRU1BTlRJQ19CTEVORFdFSUdIVCIsIlNFTUFOVElDX1RFWENPT1JEMCIsIlNFTUFOVElDX1RFWENPT1JEMSIsIlNFTUFOVElDX1RFWENPT1JEMiIsIlNFTUFOVElDX1RFWENPT1JEMyIsIlNFTUFOVElDX1RFWENPT1JENCIsIlNFTUFOVElDX1RFWENPT1JENSIsIlNFTUFOVElDX1RFWENPT1JENiIsIlNFTUFOVElDX1RFWENPT1JENyIsImdldERlcXVhbnRpemVGdW5jIiwic3JjVHlwZSIsIngiLCJNYXRoIiwibWF4IiwiZGVxdWFudGl6ZUFycmF5IiwiZHN0QXJyYXkiLCJzcmNBcnJheSIsImNvbnZGdW5jIiwibGVuIiwibGVuZ3RoIiwiaSIsImdldEFjY2Vzc29yRGF0YSIsImdsdGZBY2Nlc3NvciIsImJ1ZmZlclZpZXdzIiwiZmxhdHRlbiIsIm51bUNvbXBvbmVudHMiLCJ0eXBlIiwiZGF0YVR5cGUiLCJyZXN1bHQiLCJzcGFyc2UiLCJpbmRpY2VzQWNjZXNzb3IiLCJjb3VudCIsImluZGljZXMiLCJPYmplY3QiLCJhc3NpZ24iLCJ2YWx1ZXNBY2Nlc3NvciIsInZhbHVlcyIsImhhc093blByb3BlcnR5IiwiYmFzZUFjY2Vzc29yIiwiYnVmZmVyVmlldyIsImJ5dGVPZmZzZXQiLCJzbGljZSIsInRhcmdldEluZGV4IiwiaiIsImJ5dGVzUGVyRWxlbWVudCIsIkJZVEVTX1BFUl9FTEVNRU5UIiwic3RvcmFnZSIsIkFycmF5QnVmZmVyIiwidG1wQXJyYXkiLCJkc3RPZmZzZXQiLCJzcmNPZmZzZXQiLCJieXRlU3RyaWRlIiwiYiIsImJ1ZmZlciIsImdldEFjY2Vzc29yRGF0YUZsb2F0MzIiLCJkYXRhIiwibm9ybWFsaXplZCIsImZsb2F0MzJEYXRhIiwiZ2V0QWNjZXNzb3JCb3VuZGluZ0JveCIsIm1pbiIsImN0eXBlIiwiQm91bmRpbmdCb3giLCJWZWMzIiwiZ2V0UHJpbWl0aXZlVHlwZSIsInByaW1pdGl2ZSIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJtb2RlIiwiUFJJTUlUSVZFX1BPSU5UUyIsIlBSSU1JVElWRV9MSU5FUyIsIlBSSU1JVElWRV9MSU5FTE9PUCIsIlBSSU1JVElWRV9MSU5FU1RSSVAiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiZ2VuZXJhdGVJbmRpY2VzIiwibnVtVmVydGljZXMiLCJkdW1teUluZGljZXMiLCJnZW5lcmF0ZU5vcm1hbHMiLCJzb3VyY2VEZXNjIiwicCIsImNvbXBvbmVudHMiLCJwb3NpdGlvbnMiLCJzaXplIiwic3RyaWRlIiwic3JjU3RyaWRlIiwidHlwZWRBcnJheVR5cGVzQnl0ZVNpemUiLCJzcmMiLCJ0eXBlZEFycmF5VHlwZXMiLCJvZmZzZXQiLCJub3JtYWxzVGVtcCIsImNhbGN1bGF0ZU5vcm1hbHMiLCJub3JtYWxzIiwic2V0IiwiZmxpcFRleENvb3JkVnMiLCJ2ZXJ0ZXhCdWZmZXIiLCJmbG9hdE9mZnNldHMiLCJzaG9ydE9mZnNldHMiLCJieXRlT2Zmc2V0cyIsImZvcm1hdCIsImVsZW1lbnRzIiwiZWxlbWVudCIsIm5hbWUiLCJwdXNoIiwiZmxpcCIsIm9mZnNldHMiLCJvbmUiLCJ0eXBlZEFycmF5IiwiaW5kZXgiLCJjbG9uZVRleHR1cmUiLCJ0ZXh0dXJlIiwic2hhbGxvd0NvcHlMZXZlbHMiLCJtaXAiLCJfbGV2ZWxzIiwibGV2ZWwiLCJjdWJlbWFwIiwiZmFjZSIsIlRleHR1cmUiLCJkZXZpY2UiLCJjbG9uZVRleHR1cmVBc3NldCIsIkFzc2V0IiwiZmlsZSIsIm9wdGlvbnMiLCJsb2FkZWQiLCJyZXNvdXJjZSIsInJlZ2lzdHJ5IiwiYWRkIiwiY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwiLCJmbGlwViIsInBvc2l0aW9uRGVzYyIsInZlcnRleERlc2MiLCJzZW1hbnRpYyIsIm5vcm1hbGl6ZSIsImVsZW1lbnRPcmRlciIsInNvcnQiLCJsaHMiLCJyaHMiLCJsaHNPcmRlciIsInJoc09yZGVyIiwiayIsInNvdXJjZSIsInRhcmdldCIsInNvdXJjZU9mZnNldCIsInZlcnRleEZvcm1hdCIsIlZlcnRleEZvcm1hdCIsImlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQiLCJWZXJ0ZXhCdWZmZXIiLCJCVUZGRVJfU1RBVElDIiwidmVydGV4RGF0YSIsImxvY2siLCJ0YXJnZXRBcnJheSIsInNvdXJjZUFycmF5IiwidGFyZ2V0U3RyaWRlIiwic291cmNlU3RyaWRlIiwiZHN0Iiwia2VuZCIsImZsb29yIiwidW5sb2NrIiwiY3JlYXRlVmVydGV4QnVmZmVyIiwiYXR0cmlidXRlcyIsImFjY2Vzc29ycyIsInZlcnRleEJ1ZmZlckRpY3QiLCJ1c2VBdHRyaWJ1dGVzIiwiYXR0cmliSWRzIiwiYXR0cmliIiwidmJLZXkiLCJqb2luIiwidmIiLCJhY2Nlc3NvciIsImFjY2Vzc29yRGF0YSIsImNyZWF0ZVZlcnRleEJ1ZmZlckRyYWNvIiwib3V0cHV0R2VvbWV0cnkiLCJleHREcmFjbyIsImRlY29kZXIiLCJkZWNvZGVyTW9kdWxlIiwibnVtUG9pbnRzIiwibnVtX3BvaW50cyIsImV4dHJhY3REcmFjb0F0dHJpYnV0ZUluZm8iLCJ1bmlxdWVJZCIsImF0dHJpYnV0ZSIsIkdldEF0dHJpYnV0ZUJ5VW5pcXVlSWQiLCJudW1WYWx1ZXMiLCJudW1fY29tcG9uZW50cyIsImRyYWNvRm9ybWF0IiwiZGF0YV90eXBlIiwicHRyIiwiY29tcG9uZW50U2l6ZUluQnl0ZXMiLCJzdG9yYWdlVHlwZSIsIkRUX1VJTlQ4IiwiX21hbGxvYyIsIkdldEF0dHJpYnV0ZURhdGFBcnJheUZvckFsbFBvaW50cyIsIkhFQVBVOCIsIkRUX1VJTlQxNiIsIkhFQVBVMTYiLCJEVF9GTE9BVDMyIiwiSEVBUEYzMiIsIl9mcmVlIiwiYXR0cmlidXRlSW5mbyIsImNyZWF0ZVNraW4iLCJnbHRmU2tpbiIsImdsYlNraW5zIiwiYmluZE1hdHJpeCIsImpvaW50cyIsIm51bUpvaW50cyIsImlicCIsImludmVyc2VCaW5kTWF0cmljZXMiLCJpYm1EYXRhIiwiaWJtVmFsdWVzIiwiTWF0NCIsImJvbmVOYW1lcyIsImtleSIsInNraW4iLCJnZXQiLCJTa2luIiwidGVtcE1hdCIsInRlbXBWZWMiLCJjcmVhdGVNZXNoIiwiZ2x0Zk1lc2giLCJjYWxsYmFjayIsImFzc2V0T3B0aW9ucyIsInByaW1pdGl2ZXMiLCJwcmltaXRpdmVUeXBlIiwibnVtSW5kaWNlcyIsImNhblVzZU1vcnBoIiwiZXh0ZW5zaW9ucyIsIktIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uIiwidWludDhCdWZmZXIiLCJEZWNvZGVyQnVmZmVyIiwiSW5pdCIsIkRlY29kZXIiLCJnZW9tZXRyeVR5cGUiLCJHZXRFbmNvZGVkR2VvbWV0cnlUeXBlIiwic3RhdHVzIiwiUE9JTlRfQ0xPVUQiLCJQb2ludENsb3VkIiwiRGVjb2RlQnVmZmVyVG9Qb2ludENsb3VkIiwiVFJJQU5HVUxBUl9NRVNIIiwiTWVzaCIsIkRlY29kZUJ1ZmZlclRvTWVzaCIsIklOVkFMSURfR0VPTUVUUllfVFlQRSIsIm9rIiwiZXJyb3JfbXNnIiwibnVtRmFjZXMiLCJudW1fZmFjZXMiLCJiaXQzMiIsImRhdGFTaXplIiwiR2V0VHJpYW5nbGVzVUludDMyQXJyYXkiLCJIRUFQVTMyIiwiR2V0VHJpYW5nbGVzVUludDE2QXJyYXkiLCJEZWJ1ZyIsIndhcm4iLCJtZXNoIiwiYmFzZSIsImluZGV4ZWQiLCJpbmRleEZvcm1hdCIsIklOREVYRk9STUFUX1VJTlQ4IiwiSU5ERVhGT1JNQVRfVUlOVDE2IiwiSU5ERVhGT1JNQVRfVUlOVDMyIiwiZXh0VWludEVsZW1lbnQiLCJjb25zb2xlIiwiaXNXZWJHUFUiLCJpbmRleEJ1ZmZlciIsIkluZGV4QnVmZmVyIiwiS0hSX21hdGVyaWFsc192YXJpYW50cyIsInRlbXBNYXBwaW5nIiwibWFwcGluZ3MiLCJtYXBwaW5nIiwidmFyaWFudCIsIm1hdGVyaWFsIiwiaWQiLCJQT1NJVElPTiIsImFhYmIiLCJ0YXJnZXRzIiwiZGVsdGFQb3NpdGlvbnMiLCJkZWx0YVBvc2l0aW9uc1R5cGUiLCJOT1JNQUwiLCJkZWx0YU5vcm1hbHMiLCJkZWx0YU5vcm1hbHNUeXBlIiwiZXh0cmFzIiwidGFyZ2V0TmFtZXMiLCJ0b1N0cmluZyIsImRlZmF1bHRXZWlnaHQiLCJ3ZWlnaHRzIiwicHJlc2VydmVEYXRhIiwibW9ycGhQcmVzZXJ2ZURhdGEiLCJNb3JwaFRhcmdldCIsIm1vcnBoIiwiTW9ycGgiLCJwcmVmZXJIaWdoUHJlY2lzaW9uIiwibW9ycGhQcmVmZXJIaWdoUHJlY2lzaW9uIiwiZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0iLCJtYXBzIiwiX3NvdXJjZSRleHRlbnNpb25zIiwibWFwIiwidGV4Q29vcmQiLCJ6ZXJvcyIsIm9uZXMiLCJ0ZXh0dXJlVHJhbnNmb3JtIiwiS0hSX3RleHR1cmVfdHJhbnNmb3JtIiwic2NhbGUiLCJyb3RhdGlvbiIsIm1hdGgiLCJSQURfVE9fREVHIiwidGlsaW5nVmVjIiwiVmVjMiIsIm9mZnNldFZlYyIsImV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzIiwiY29sb3IiLCJkaWZmdXNlRmFjdG9yIiwiZGlmZnVzZSIsInBvdyIsIm9wYWNpdHkiLCJkaWZmdXNlVGV4dHVyZSIsImRpZmZ1c2VNYXAiLCJkaWZmdXNlTWFwQ2hhbm5lbCIsIm9wYWNpdHlNYXAiLCJvcGFjaXR5TWFwQ2hhbm5lbCIsInVzZU1ldGFsbmVzcyIsInNwZWN1bGFyRmFjdG9yIiwic3BlY3VsYXIiLCJnbG9zcyIsImdsb3NzaW5lc3NGYWN0b3IiLCJzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlIiwic3BlY3VsYXJFbmNvZGluZyIsInNwZWN1bGFyTWFwIiwiZ2xvc3NNYXAiLCJzcGVjdWxhck1hcENoYW5uZWwiLCJnbG9zc01hcENoYW5uZWwiLCJleHRlbnNpb25DbGVhckNvYXQiLCJjbGVhckNvYXQiLCJjbGVhcmNvYXRGYWN0b3IiLCJjbGVhcmNvYXRUZXh0dXJlIiwiY2xlYXJDb2F0TWFwIiwiY2xlYXJDb2F0TWFwQ2hhbm5lbCIsImNsZWFyQ29hdEdsb3NzIiwiY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yIiwiY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSIsImNsZWFyQ29hdEdsb3NzTWFwIiwiY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsIiwiY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSIsImNsZWFyQ29hdE5vcm1hbE1hcCIsImNsZWFyQ29hdEJ1bXBpbmVzcyIsImNsZWFyQ29hdEdsb3NzSW52ZXJ0IiwiZXh0ZW5zaW9uVW5saXQiLCJ1c2VMaWdodGluZyIsImVtaXNzaXZlIiwiY29weSIsImVtaXNzaXZlVGludCIsImRpZmZ1c2VUaW50IiwiZW1pc3NpdmVNYXAiLCJlbWlzc2l2ZU1hcFV2IiwiZGlmZnVzZU1hcFV2IiwiZW1pc3NpdmVNYXBUaWxpbmciLCJkaWZmdXNlTWFwVGlsaW5nIiwiZW1pc3NpdmVNYXBPZmZzZXQiLCJkaWZmdXNlTWFwT2Zmc2V0IiwiZW1pc3NpdmVNYXBSb3RhdGlvbiIsImRpZmZ1c2VNYXBSb3RhdGlvbiIsImVtaXNzaXZlTWFwQ2hhbm5lbCIsImVtaXNzaXZlVmVydGV4Q29sb3IiLCJkaWZmdXNlVmVydGV4Q29sb3IiLCJlbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCIsImRpZmZ1c2VWZXJ0ZXhDb2xvckNoYW5uZWwiLCJleHRlbnNpb25TcGVjdWxhciIsInVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IiLCJzcGVjdWxhckNvbG9yVGV4dHVyZSIsInNwZWN1bGFyQ29sb3JGYWN0b3IiLCJzcGVjdWxhcml0eUZhY3RvciIsInNwZWN1bGFyaXR5RmFjdG9yTWFwQ2hhbm5lbCIsInNwZWN1bGFyaXR5RmFjdG9yTWFwIiwic3BlY3VsYXJUZXh0dXJlIiwiZXh0ZW5zaW9uSW9yIiwicmVmcmFjdGlvbkluZGV4IiwiaW9yIiwiZXh0ZW5zaW9uVHJhbnNtaXNzaW9uIiwiYmxlbmRUeXBlIiwiQkxFTkRfTk9STUFMIiwidXNlRHluYW1pY1JlZnJhY3Rpb24iLCJyZWZyYWN0aW9uIiwidHJhbnNtaXNzaW9uRmFjdG9yIiwicmVmcmFjdGlvbk1hcENoYW5uZWwiLCJyZWZyYWN0aW9uTWFwIiwidHJhbnNtaXNzaW9uVGV4dHVyZSIsImV4dGVuc2lvblNoZWVuIiwidXNlU2hlZW4iLCJzaGVlbkNvbG9yRmFjdG9yIiwic2hlZW4iLCJzaGVlbk1hcCIsInNoZWVuQ29sb3JUZXh0dXJlIiwic2hlZW5FbmNvZGluZyIsInNoZWVuR2xvc3MiLCJzaGVlblJvdWdobmVzc0ZhY3RvciIsInNoZWVuR2xvc3NNYXAiLCJzaGVlblJvdWdobmVzc1RleHR1cmUiLCJzaGVlbkdsb3NzTWFwQ2hhbm5lbCIsInNoZWVuR2xvc3NJbnZlcnQiLCJleHRlbnNpb25Wb2x1bWUiLCJ0aGlja25lc3MiLCJ0aGlja25lc3NGYWN0b3IiLCJ0aGlja25lc3NNYXAiLCJ0aGlja25lc3NUZXh0dXJlIiwidGhpY2tuZXNzTWFwQ2hhbm5lbCIsImF0dGVudWF0aW9uRGlzdGFuY2UiLCJhdHRlbnVhdGlvbkNvbG9yIiwiYXR0ZW51YXRpb24iLCJleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoIiwiZW1pc3NpdmVJbnRlbnNpdHkiLCJlbWlzc2l2ZVN0cmVuZ3RoIiwiZXh0ZW5zaW9uSXJpZGVzY2VuY2UiLCJ1c2VJcmlkZXNjZW5jZSIsImlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2VGYWN0b3IiLCJpcmlkZXNjZW5jZU1hcENoYW5uZWwiLCJpcmlkZXNjZW5jZU1hcCIsImlyaWRlc2NlbmNlVGV4dHVyZSIsImlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4IiwiaXJpZGVzY2VuY2VJb3IiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01pbiIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bSIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4IiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXhpbXVtIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXAiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUiLCJjcmVhdGVNYXRlcmlhbCIsImdsdGZNYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJvY2NsdWRlU3BlY3VsYXIiLCJTUEVDT0NDX0FPIiwic3BlY3VsYXJUaW50Iiwic3BlY3VsYXJWZXJ0ZXhDb2xvciIsInBickRhdGEiLCJwYnJNZXRhbGxpY1JvdWdobmVzcyIsImJhc2VDb2xvckZhY3RvciIsImJhc2VDb2xvclRleHR1cmUiLCJtZXRhbG5lc3MiLCJtZXRhbGxpY0ZhY3RvciIsInJvdWdobmVzc0ZhY3RvciIsImdsb3NzSW52ZXJ0IiwibWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlIiwibWV0YWxuZXNzTWFwIiwibWV0YWxuZXNzTWFwQ2hhbm5lbCIsIm5vcm1hbFRleHR1cmUiLCJub3JtYWxNYXAiLCJidW1waW5lc3MiLCJvY2NsdXNpb25UZXh0dXJlIiwiYW9NYXAiLCJhb01hcENoYW5uZWwiLCJlbWlzc2l2ZUZhY3RvciIsImVtaXNzaXZlVGV4dHVyZSIsImFscGhhTW9kZSIsIkJMRU5EX05PTkUiLCJhbHBoYVRlc3QiLCJhbHBoYUN1dG9mZiIsImRlcHRoV3JpdGUiLCJ0d29TaWRlZExpZ2h0aW5nIiwiZG91YmxlU2lkZWQiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsIkNVTExGQUNFX0JBQ0siLCJleHRlbnNpb25GdW5jIiwidW5kZWZpbmVkIiwidXBkYXRlIiwiY3JlYXRlQW5pbWF0aW9uIiwiZ2x0ZkFuaW1hdGlvbiIsImFuaW1hdGlvbkluZGV4IiwiZ2x0ZkFjY2Vzc29ycyIsImdsdGZOb2RlcyIsImNyZWF0ZUFuaW1EYXRhIiwiQW5pbURhdGEiLCJpbnRlcnBNYXAiLCJJTlRFUlBPTEFUSU9OX1NURVAiLCJJTlRFUlBPTEFUSU9OX0xJTkVBUiIsIklOVEVSUE9MQVRJT05fQ1VCSUMiLCJpbnB1dE1hcCIsIm91dHB1dE1hcCIsImN1cnZlTWFwIiwib3V0cHV0Q291bnRlciIsInNhbXBsZXJzIiwic2FtcGxlciIsImlucHV0Iiwib3V0cHV0IiwiaW50ZXJwb2xhdGlvbiIsImN1cnZlIiwicGF0aHMiLCJxdWF0QXJyYXlzIiwidHJhbnNmb3JtU2NoZW1hIiwiY29uc3RydWN0Tm9kZVBhdGgiLCJub2RlIiwicGF0aCIsInVuc2hpZnQiLCJwYXJlbnQiLCJjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyIsImdsdGZOb2RlIiwiZW50aXR5UGF0aCIsIm91dCIsIm91dERhdGEiLCJtb3JwaFRhcmdldENvdW50Iiwia2V5ZnJhbWVDb3VudCIsInNpbmdsZUJ1ZmZlclNpemUiLCJfdGFyZ2V0TmFtZXMiLCJtb3JwaFRhcmdldE91dHB1dCIsIndlaWdodE5hbWUiLCJtb3JwaEN1cnZlIiwiY29tcG9uZW50IiwicHJvcGVydHlQYXRoIiwiY2hhbm5lbHMiLCJjaGFubmVsIiwic3RhcnRzV2l0aCIsImlucHV0cyIsIm91dHB1dHMiLCJjdXJ2ZXMiLCJpbnB1dEtleSIsIm91dHB1dEtleSIsImN1cnZlS2V5IiwiY3VydmVEYXRhIiwiQW5pbUN1cnZlIiwicHJldkluZGV4IiwiZCIsImRwIiwiZHVyYXRpb24iLCJfZGF0YSIsIkFuaW1UcmFjayIsImNyZWF0ZU5vZGUiLCJub2RlSW5kZXgiLCJlbnRpdHkiLCJHcmFwaE5vZGUiLCJtYXRyaXgiLCJnZXRUcmFuc2xhdGlvbiIsInNldExvY2FsUG9zaXRpb24iLCJnZXRFdWxlckFuZ2xlcyIsInNldExvY2FsRXVsZXJBbmdsZXMiLCJnZXRTY2FsZSIsInNldExvY2FsU2NhbGUiLCJyIiwic2V0TG9jYWxSb3RhdGlvbiIsInQiLCJ0cmFuc2xhdGlvbiIsInMiLCJjcmVhdGVDYW1lcmEiLCJnbHRmQ2FtZXJhIiwicHJvamVjdGlvbiIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsImdsdGZQcm9wZXJ0aWVzIiwib3J0aG9ncmFwaGljIiwicGVyc3BlY3RpdmUiLCJjb21wb25lbnREYXRhIiwiZW5hYmxlZCIsIm5lYXJDbGlwIiwiem5lYXIiLCJhc3BlY3RSYXRpb01vZGUiLCJBU1BFQ1RfQVVUTyIsInpmYXIiLCJmYXJDbGlwIiwib3J0aG9IZWlnaHQiLCJ5bWFnIiwiQVNQRUNUX01BTlVBTCIsImFzcGVjdFJhdGlvIiwieG1hZyIsImZvdiIsInlmb3YiLCJjYW1lcmFFbnRpdHkiLCJFbnRpdHkiLCJhZGRDb21wb25lbnQiLCJjcmVhdGVMaWdodCIsImdsdGZMaWdodCIsImxpZ2h0UHJvcHMiLCJDb2xvciIsIldISVRFIiwicmFuZ2UiLCJmYWxsb2ZmTW9kZSIsIkxJR0hURkFMTE9GRl9JTlZFUlNFU1FVQVJFRCIsImludGVuc2l0eSIsImNsYW1wIiwiaW5uZXJDb25lQW5nbGUiLCJzcG90Iiwib3V0ZXJDb25lQW5nbGUiLCJQSSIsImx1bWluYW5jZSIsIkxpZ2h0IiwiZ2V0TGlnaHRVbml0Q29udmVyc2lvbiIsImxpZ2h0VHlwZXMiLCJsaWdodEVudGl0eSIsInJvdGF0ZUxvY2FsIiwiY3JlYXRlU2tpbnMiLCJNYXAiLCJjcmVhdGVNZXNoZXMiLCJza2lwTWVzaGVzIiwiY3JlYXRlTWF0ZXJpYWxzIiwicHJlcHJvY2VzcyIsInByb2Nlc3MiLCJwb3N0cHJvY2VzcyIsImNyZWF0ZVZhcmlhbnRzIiwiY3JlYXRlQW5pbWF0aW9ucyIsImFuaW1hdGlvbiIsImNyZWF0ZU5vZGVzIiwidW5pcXVlTmFtZXMiLCJjaGlsZHJlbiIsImNoaWxkIiwiYWRkQ2hpbGQiLCJjcmVhdGVTY2VuZXMiLCJfZ2x0ZiRzY2VuZXMkMCRub2RlcyIsInNjZW5lIiwic2NlbmVSb290IiwibiIsImNoaWxkTm9kZSIsImNyZWF0ZUNhbWVyYXMiLCJjYW1lcmEiLCJjcmVhdGVMaWdodHMiLCJLSFJfbGlnaHRzX3B1bmN0dWFsIiwiZ2x0ZkxpZ2h0cyIsImxpZ2h0IiwibGlnaHRJbmRleCIsImxpbmtTa2lucyIsIm1lc2hHcm91cCIsImNyZWF0ZVJlc291cmNlcyIsInRleHR1cmVBc3NldHMiLCJnbG9iYWwiLCJhc3NldCIsImdlbmVyYXRvciIsInRleHR1cmVBc3NldCIsIlJlbmRlciIsImFwcGx5U2FtcGxlciIsImdsdGZTYW1wbGVyIiwiZ2V0RmlsdGVyIiwiZmlsdGVyIiwiZGVmYXVsdFZhbHVlIiwiRklMVEVSX05FQVJFU1QiLCJGSUxURVJfTElORUFSIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsImdldFdyYXAiLCJ3cmFwIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19NSVJST1JFRF9SRVBFQVQiLCJBRERSRVNTX1JFUEVBVCIsIm1pbkZpbHRlciIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwid3JhcFMiLCJhZGRyZXNzViIsIndyYXBUIiwiZ2x0ZlRleHR1cmVVbmlxdWVJZCIsImxvYWRJbWFnZUFzeW5jIiwiZ2x0ZkltYWdlIiwidXJsQmFzZSIsImltYWdlIiwicHJvY2Vzc0FzeW5jIiwib25Mb2FkIiwibWltZVR5cGVGaWxlRXh0ZW5zaW9ucyIsImxvYWRUZXh0dXJlIiwidXJsIiwibWltZVR5cGUiLCJjb250ZW50cyIsImV4dGVuc2lvbiIsImZpbGVuYW1lIiwib24iLCJsb2FkIiwiZXJyIiwiQUJTT0xVVEVfVVJMIiwiY3Jvc3NPcmlnaW4iLCJsb2FkVGV4dHVyZXNBc3luYyIsImltYWdlcyIsImdsdGZUZXh0dXJlIiwiZ2x0ZkltYWdlcyIsImFzc2V0cyIsInJlbWFpbmluZyIsInRleHR1cmVJbmRleCIsImltYWdlSW5kZXgiLCJ0ZXh0dXJlTGlzdCIsImdsdGZJbWFnZUluZGV4IiwiX2dsdGZUZXh0dXJlJGV4dGVuc2lvIiwiX2dsdGZUZXh0dXJlJGV4dGVuc2lvMiIsIktIUl90ZXh0dXJlX2Jhc2lzdSIsImJpbmQiLCJsb2FkQnVmZmVyc0FzeW5jIiwiYmluYXJ5Q2h1bmsiLCJidWZmZXJzIiwiZ2x0ZkJ1ZmZlciIsImFycmF5QnVmZmVyIiwiYnl0ZVN0cmluZyIsImF0b2IiLCJzcGxpdCIsImJpbmFyeUFycmF5IiwiY2hhckNvZGVBdCIsImh0dHAiLCJjYWNoZSIsInJlc3BvbnNlVHlwZSIsInJldHJ5IiwicGFyc2VHbHRmIiwiZ2x0ZkNodW5rIiwiZGVjb2RlQmluYXJ5VXRmOCIsImFycmF5IiwiVGV4dERlY29kZXIiLCJkZWNvZGUiLCJzdHIiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJkZWNvZGVVUklDb21wb25lbnQiLCJlc2NhcGUiLCJKU09OIiwicGFyc2UiLCJ2ZXJzaW9uIiwicGFyc2VGbG9hdCIsImV4dGVuc2lvbnNVc2VkIiwiV2FzbU1vZHVsZSIsImdldEluc3RhbmNlIiwiaW5zdGFuY2UiLCJwYXJzZUdsYiIsImdsYkRhdGEiLCJEYXRhVmlldyIsImJ5dGVMZW5ndGgiLCJtYWdpYyIsImdldFVpbnQzMiIsImNodW5rcyIsImNodW5rTGVuZ3RoIiwiRXJyb3IiLCJjaHVua1R5cGUiLCJjaHVua0RhdGEiLCJwYXJzZUNodW5rIiwiaGFzR2xiSGVhZGVyIiwidTgiLCJ0b0xvd2VyQ2FzZSIsImVuZHNXaXRoIiwicGFyc2VCdWZmZXJWaWV3c0FzeW5jIiwiZ2x0ZkJ1ZmZlclZpZXciLCJHbGJQYXJzZXIiLCJwYXJzZUFzeW5jIiwibWF4UmV0cmllcyIsIl9kZXZpY2UiLCJfYXNzZXRzIiwiX2RlZmF1bHRNYXRlcmlhbCIsIl9nZXRVcmxXaXRob3V0UGFyYW1zIiwiZmV0Y2hBcnJheUJ1ZmZlciIsIm9yaWdpbmFsIiwiZXh0cmFjdFBhdGgiLCJHbGJDb250YWluZXJSZXNvdXJjZSIsIm9wZW4iLCJwYXRjaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0RBO0FBQ0EsSUFBSUEsb0JBQW9CLEdBQUcsSUFBSSxDQUFBO0FBRS9CLE1BQU1DLDJCQUEyQixHQUFHQSxNQUFNO0FBQ3RDLEVBQUEsT0FBTyxPQUFPQyxNQUFNLEtBQUssV0FBVyxJQUFJQSxNQUFNLENBQUNDLGtCQUFrQixDQUFBO0FBQ3JFLENBQUMsQ0FBQTs7QUFFRDtBQUNBLE1BQU1DLFlBQVksQ0FBQztFQUNmQyxXQUFXQSxDQUFDQyxJQUFJLEVBQUU7SUFDZCxJQUFJLENBQUNBLElBQUksR0FBR0EsSUFBSSxDQUFBO0lBQ2hCLElBQUksQ0FBQ0MsS0FBSyxHQUFHLElBQUksQ0FBQTtJQUNqQixJQUFJLENBQUNDLE1BQU0sR0FBRyxJQUFJLENBQUE7SUFDbEIsSUFBSSxDQUFDQyxVQUFVLEdBQUcsSUFBSSxDQUFBO0lBQ3RCLElBQUksQ0FBQ0MsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNwQixJQUFJLENBQUNDLFNBQVMsR0FBRyxJQUFJLENBQUE7SUFDckIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsSUFBSSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsWUFBWSxHQUFHLElBQUksQ0FBQTtJQUN4QixJQUFJ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
