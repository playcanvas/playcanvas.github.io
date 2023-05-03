import { Debug } from '../../core/debug.js';
import { path } from '../../core/path.js';
import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { CULLFACE_NONE, CULLFACE_BACK, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, INDEXFORMAT_UINT8, BUFFER_STATIC, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR, FILTER_NEAREST, ADDRESS_REPEAT, ADDRESS_MIRRORED_REPEAT, ADDRESS_CLAMP_TO_EDGE, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, PRIMITIVE_LINESTRIP, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_POINTS, SEMANTIC_NORMAL, SEMANTIC_COLOR, TYPE_UINT8, TYPE_UINT16, TYPE_FLOAT32, TYPE_UINT32, TYPE_INT32, TYPE_INT16, TYPE_INT8, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, typedArrayTypesByteSize, typedArrayTypes } from '../../platform/graphics/constants.js';
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
import { ABSOLUTE_URL } from '../asset/constants.js';
import { dracoDecode } from './draco-decoder.js';

// resources loaded from GLB file that the parser returns
class GlbResources {
  constructor() {
    this.gltf = void 0;
    this.nodes = void 0;
    this.scenes = void 0;
    this.animations = void 0;
    this.textures = void 0;
    this.materials = void 0;
    this.variants = void 0;
    this.meshVariants = void 0;
    this.meshDefaultMaterials = void 0;
    this.renders = void 0;
    this.skins = void 0;
    this.lights = void 0;
    this.cameras = void 0;
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
const isDataURI = uri => {
  return /^data:.*,.*$/i.test(uri);
};
const getDataURIMimeType = uri => {
  return uri.substring(uri.indexOf(':') + 1, uri.indexOf(';'));
};
const getNumComponents = accessorType => {
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
const getComponentType = componentType => {
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
const getComponentSizeInBytes = componentType => {
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
const getComponentDataType = componentType => {
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

// order vertexDesc to match the rest of the engine
const attributeOrder = {
  [SEMANTIC_POSITION]: 0,
  [SEMANTIC_NORMAL]: 1,
  [SEMANTIC_TANGENT]: 2,
  [SEMANTIC_COLOR]: 3,
  [SEMANTIC_BLENDINDICES]: 4,
  [SEMANTIC_BLENDWEIGHT]: 5,
  [SEMANTIC_TEXCOORD0]: 6,
  [SEMANTIC_TEXCOORD1]: 7,
  [SEMANTIC_TEXCOORD2]: 8,
  [SEMANTIC_TEXCOORD3]: 9,
  [SEMANTIC_TEXCOORD4]: 10,
  [SEMANTIC_TEXCOORD5]: 11,
  [SEMANTIC_TEXCOORD6]: 12,
  [SEMANTIC_TEXCOORD7]: 13
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
const dequantizeArray = (dstArray, srcArray, srcType) => {
  const convFunc = getDequantizeFunc(srcType);
  const len = srcArray.length;
  for (let i = 0; i < len; ++i) {
    dstArray[i] = convFunc(srcArray[i]);
  }
  return dstArray;
};

// get accessor data, making a copy and patching in the case of a sparse accessor
const getAccessorData = (gltfAccessor, bufferViews, flatten = false) => {
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
const getAccessorDataFloat32 = (gltfAccessor, bufferViews) => {
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
const getAccessorBoundingBox = gltfAccessor => {
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
const getPrimitiveType = primitive => {
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
const generateIndices = numVertices => {
  const dummyIndices = new Uint16Array(numVertices);
  for (let i = 0; i < numVertices; i++) {
    dummyIndices[i] = i;
  }
  return dummyIndices;
};
const generateNormals = (sourceDesc, indices) => {
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
const flipTexCoordVs = vertexBuffer => {
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
  const flip = (offsets, type, one) => {
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
const cloneTexture = texture => {
  const shallowCopyLevels = texture => {
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
const cloneTextureAsset = src => {
  const result = new Asset(src.name + '_clone', src.type, src.file, src.data, src.options);
  result.loaded = true;
  result.resource = cloneTexture(src.resource);
  src.registry.add(result);
  return result;
};
const createVertexBufferInternal = (device, sourceDesc, flipV) => {
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

  // sort vertex elements by engine-ideal order
  vertexDesc.sort((lhs, rhs) => {
    return attributeOrder[lhs.semantic] - attributeOrder[rhs.semantic];
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
const createVertexBuffer = (device, attributes, indices, accessors, bufferViews, flipV, vertexBufferDict) => {
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
const createSkin = (device, gltfSkin, accessors, bufferViews, nodes, glbSkins) => {
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
const createDracoMesh = (device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises) => {
  var _primitive$attributes, _primitive$extensions;
  // create the mesh
  const result = new Mesh(device);
  result.aabb = getAccessorBoundingBox(accessors[primitive.attributes.POSITION]);

  // create vertex description
  const vertexDesc = [];
  for (const [name, index] of Object.entries(primitive.attributes)) {
    var _accessor$normalized;
    const accessor = accessors[index];
    const semantic = gltfToEngineSemanticMap[name];
    const componentType = getComponentType(accessor.componentType);
    vertexDesc.push({
      semantic: semantic,
      components: getNumComponents(accessor.type),
      type: componentType,
      normalize: (_accessor$normalized = accessor.normalized) != null ? _accessor$normalized : semantic === SEMANTIC_COLOR && (componentType === TYPE_UINT8 || componentType === TYPE_UINT16)
    });
  }

  // draco decompressor will generate normals if they are missing
  if (!(primitive != null && (_primitive$attributes = primitive.attributes) != null && _primitive$attributes.NORMAL)) {
    vertexDesc.push({
      semantic: 'NORMAL',
      components: 3,
      type: TYPE_FLOAT32
    });
  }

  // sort vertex elements by engine-ideal order
  vertexDesc.sort((lhs, rhs) => {
    return attributeOrder[lhs.semantic] - attributeOrder[rhs.semantic];
  });
  const vertexFormat = new VertexFormat(device, vertexDesc);
  promises.push(new Promise((resolve, reject) => {
    // decode draco data
    const dracoExt = primitive.extensions.KHR_draco_mesh_compression;
    dracoDecode(bufferViews[dracoExt.bufferView].slice().buffer, (err, decompressedData) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        // create vertex buffer
        const numVertices = decompressedData.vertices.byteLength / vertexFormat.size;
        Debug.assert(numVertices === accessors[primitive.attributes.POSITION].count, 'mesh has invalid draco sizes');
        const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, BUFFER_STATIC, decompressedData.vertices);

        // create index buffer
        const numIndices = accessors[primitive.indices].count;
        const indexFormat = numVertices <= 65535 ? INDEXFORMAT_UINT16 : INDEXFORMAT_UINT32;
        const indexBuffer = new IndexBuffer(device, indexFormat, numIndices, BUFFER_STATIC, decompressedData.indices);
        result.vertexBuffer = vertexBuffer;
        result.indexBuffer[0] = indexBuffer;
        result.primitive[0].type = getPrimitiveType(primitive);
        result.primitive[0].base = 0;
        result.primitive[0].count = indexBuffer ? numIndices : numVertices;
        result.primitive[0].indexed = !!indexBuffer;
        resolve();
      }
    });
  }));

  // handle material variants
  if (primitive != null && (_primitive$extensions = primitive.extensions) != null && _primitive$extensions.KHR_materials_variants) {
    const variants = primitive.extensions.KHR_materials_variants;
    const tempMapping = {};
    variants.mappings.forEach(mapping => {
      mapping.variants.forEach(variant => {
        tempMapping[variant] = mapping.material;
      });
    });
    meshVariants[result.id] = tempMapping;
  }
  meshDefaultMaterials[result.id] = primitive.material;
  return result;
};
const createMesh = (device, gltfMesh, accessors, bufferViews, flipV, vertexBufferDict, meshVariants, meshDefaultMaterials, assetOptions, promises) => {
  const meshes = [];
  gltfMesh.primitives.forEach(primitive => {
    var _primitive$extensions2;
    if ((_primitive$extensions2 = primitive.extensions) != null && _primitive$extensions2.KHR_draco_mesh_compression) {
      // handle draco compressed mesh
      meshes.push(createDracoMesh(device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises));
    } else {
      // handle uncompressed mesh
      let indices = primitive.hasOwnProperty('indices') ? getAccessorData(accessors[primitive.indices], bufferViews, true) : null;
      const vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, flipV, vertexBufferDict);
      const primitiveType = getPrimitiveType(primitive);

      // build the mesh
      const mesh = new Mesh(device);
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
      if (primitive.hasOwnProperty('targets')) {
        const targets = [];
        primitive.targets.forEach((target, index) => {
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
      meshes.push(mesh);
    }
  });
  return meshes;
};
const extractTextureTransform = (source, material, maps) => {
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
const extensionPbrSpecGlossiness = (data, material, textures) => {
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
const extensionClearCoat = (data, material, textures) => {
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
const extensionUnlit = (data, material, textures) => {
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
const extensionSpecular = (data, material, textures) => {
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
const extensionIor = (data, material, textures) => {
  if (data.hasOwnProperty('ior')) {
    material.refractionIndex = 1.0 / data.ior;
  }
};
const extensionTransmission = (data, material, textures) => {
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
const extensionSheen = (data, material, textures) => {
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
const extensionVolume = (data, material, textures) => {
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
const extensionEmissiveStrength = (data, material, textures) => {
  if (data.hasOwnProperty('emissiveStrength')) {
    material.emissiveIntensity = data.emissiveStrength;
  }
};
const extensionIridescence = (data, material, textures) => {
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
const createMaterial = (gltfMaterial, textures, flipV) => {
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
const createAnimation = (gltfAnimation, animationIndex, gltfAccessors, bufferViews, nodes, meshes, gltfNodes) => {
  // create animation data block for the accessor
  const createAnimData = gltfAccessor => {
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
const tempMat = new Mat4();
const tempVec = new Vec3();
const createNode = (gltfNode, nodeIndex) => {
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
const createCamera = (gltfCamera, node) => {
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
const createLight = (gltfLight, node) => {
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
const createSkins = (device, gltf, nodes, bufferViews) => {
  if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
    return [];
  }

  // cache for skins to filter out duplicates
  const glbSkins = new Map();
  return gltf.skins.map(gltfSkin => {
    return createSkin(device, gltfSkin, gltf.accessors, bufferViews, nodes, glbSkins);
  });
};
const createMeshes = (device, gltf, bufferViews, flipV, options) => {
  var _gltf$meshes, _gltf$accessors, _gltf$bufferViews;
  // dictionary of vertex buffers to avoid duplicates
  const vertexBufferDict = {};
  const meshVariants = {};
  const meshDefaultMaterials = {};
  const promises = [];
  const valid = !options.skipMeshes && (gltf == null ? void 0 : (_gltf$meshes = gltf.meshes) == null ? void 0 : _gltf$meshes.length) && (gltf == null ? void 0 : (_gltf$accessors = gltf.accessors) == null ? void 0 : _gltf$accessors.length) && (gltf == null ? void 0 : (_gltf$bufferViews = gltf.bufferViews) == null ? void 0 : _gltf$bufferViews.length);
  const meshes = valid ? gltf.meshes.map(gltfMesh => {
    return createMesh(device, gltfMesh, gltf.accessors, bufferViews, flipV, vertexBufferDict, meshVariants, meshDefaultMaterials, options, promises);
  }) : [];
  return {
    meshes,
    meshVariants,
    meshDefaultMaterials,
    promises
  };
};
const createMaterials = (gltf, textures, options, flipV) => {
  var _options$material, _options$material$pro, _options$material2, _options$material3;
  if (!gltf.hasOwnProperty('materials') || gltf.materials.length === 0) {
    return [];
  }
  const preprocess = options == null ? void 0 : (_options$material = options.material) == null ? void 0 : _options$material.preprocess;
  const process = (_options$material$pro = options == null ? void 0 : (_options$material2 = options.material) == null ? void 0 : _options$material2.process) != null ? _options$material$pro : createMaterial;
  const postprocess = options == null ? void 0 : (_options$material3 = options.material) == null ? void 0 : _options$material3.postprocess;
  return gltf.materials.map(gltfMaterial => {
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
const createVariants = gltf => {
  if (!gltf.hasOwnProperty("extensions") || !gltf.extensions.hasOwnProperty("KHR_materials_variants")) return null;
  const data = gltf.extensions.KHR_materials_variants.variants;
  const variants = {};
  for (let i = 0; i < data.length; i++) {
    variants[data[i].name] = i;
  }
  return variants;
};
const createAnimations = (gltf, nodes, bufferViews, options) => {
  var _options$animation, _options$animation2;
  if (!gltf.hasOwnProperty('animations') || gltf.animations.length === 0) {
    return [];
  }
  const preprocess = options == null ? void 0 : (_options$animation = options.animation) == null ? void 0 : _options$animation.preprocess;
  const postprocess = options == null ? void 0 : (_options$animation2 = options.animation) == null ? void 0 : _options$animation2.postprocess;
  return gltf.animations.map((gltfAnimation, index) => {
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
const createNodes = (gltf, options) => {
  var _options$node, _options$node$process, _options$node2, _options$node3;
  if (!gltf.hasOwnProperty('nodes') || gltf.nodes.length === 0) {
    return [];
  }
  const preprocess = options == null ? void 0 : (_options$node = options.node) == null ? void 0 : _options$node.preprocess;
  const process = (_options$node$process = options == null ? void 0 : (_options$node2 = options.node) == null ? void 0 : _options$node2.process) != null ? _options$node$process : createNode;
  const postprocess = options == null ? void 0 : (_options$node3 = options.node) == null ? void 0 : _options$node3.postprocess;
  const nodes = gltf.nodes.map((gltfNode, index) => {
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
const createScenes = (gltf, nodes) => {
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
const createCameras = (gltf, nodes, options) => {
  let cameras = null;
  if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('cameras') && gltf.cameras.length > 0) {
    var _options$camera, _options$camera$proce, _options$camera2, _options$camera3;
    const preprocess = options == null ? void 0 : (_options$camera = options.camera) == null ? void 0 : _options$camera.preprocess;
    const process = (_options$camera$proce = options == null ? void 0 : (_options$camera2 = options.camera) == null ? void 0 : _options$camera2.process) != null ? _options$camera$proce : createCamera;
    const postprocess = options == null ? void 0 : (_options$camera3 = options.camera) == null ? void 0 : _options$camera3.postprocess;
    gltf.nodes.forEach((gltfNode, nodeIndex) => {
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
const createLights = (gltf, nodes, options) => {
  let lights = null;
  if (gltf.hasOwnProperty('nodes') && gltf.hasOwnProperty('extensions') && gltf.extensions.hasOwnProperty('KHR_lights_punctual') && gltf.extensions.KHR_lights_punctual.hasOwnProperty('lights')) {
    const gltfLights = gltf.extensions.KHR_lights_punctual.lights;
    if (gltfLights.length) {
      var _options$light, _options$light$proces, _options$light2, _options$light3;
      const preprocess = options == null ? void 0 : (_options$light = options.light) == null ? void 0 : _options$light.preprocess;
      const process = (_options$light$proces = options == null ? void 0 : (_options$light2 = options.light) == null ? void 0 : _options$light2.process) != null ? _options$light$proces : createLight;
      const postprocess = options == null ? void 0 : (_options$light3 = options.light) == null ? void 0 : _options$light3.postprocess;

      // handle nodes with lights
      gltf.nodes.forEach((gltfNode, nodeIndex) => {
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
const linkSkins = (gltf, renders, skins) => {
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
const createResources = async (device, gltf, bufferViews, textures, options) => {
  var _options$global, _options$global2;
  const preprocess = options == null ? void 0 : (_options$global = options.global) == null ? void 0 : _options$global.preprocess;
  const postprocess = options == null ? void 0 : (_options$global2 = options.global) == null ? void 0 : _options$global2.postprocess;
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
  const variants = createVariants(gltf);

  // buffer data must have finished loading in order to create meshes and animations
  const bufferViewData = await Promise.all(bufferViews);
  const {
    meshes,
    meshVariants,
    meshDefaultMaterials,
    promises
  } = createMeshes(device, gltf, bufferViewData, flipV, options);
  const animations = createAnimations(gltf, nodes, bufferViewData, options);

  // textures must have finished loading in order to create materials
  const textureAssets = await Promise.all(textures);
  const textureInstances = textureAssets.map(t => t.resource);
  const materials = createMaterials(gltf, textureInstances, options, flipV);
  const skins = createSkins(device, gltf, nodes, bufferViewData);

  // create renders to wrap meshes
  const renders = [];
  for (let i = 0; i < meshes.length; i++) {
    renders[i] = new Render();
    renders[i].meshes = meshes[i];
  }

  // link skins to meshes
  linkSkins(gltf, renders, skins);
  const result = new GlbResources();
  result.gltf = gltf;
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

  // wait for draco meshes to complete decoding
  await Promise.all(promises);
  return result;
};
const applySampler = (texture, gltfSampler) => {
  const getFilter = (filter, defaultValue) => {
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
  const getWrap = (wrap, defaultValue) => {
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
    var _gltfSampler;
    gltfSampler = (_gltfSampler = gltfSampler) != null ? _gltfSampler : {};
    texture.minFilter = getFilter(gltfSampler.minFilter, FILTER_LINEAR_MIPMAP_LINEAR);
    texture.magFilter = getFilter(gltfSampler.magFilter, FILTER_LINEAR);
    texture.addressU = getWrap(gltfSampler.wrapS, ADDRESS_REPEAT);
    texture.addressV = getWrap(gltfSampler.wrapT, ADDRESS_REPEAT);
  }
};
let gltfTextureUniqueId = 0;

// create gltf images. returns an array of promises that resolve to texture assets.
const createImages = (gltf, bufferViews, urlBase, registry, options) => {
  var _options$image, _options$image2, _options$image3;
  if (!gltf.images || gltf.images.length === 0) {
    return [];
  }
  const preprocess = options == null ? void 0 : (_options$image = options.image) == null ? void 0 : _options$image.preprocess;
  const processAsync = options == null ? void 0 : (_options$image2 = options.image) == null ? void 0 : _options$image2.processAsync;
  const postprocess = options == null ? void 0 : (_options$image3 = options.image) == null ? void 0 : _options$image3.postprocess;
  const mimeTypeFileExtensions = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/basis': 'basis',
    'image/ktx': 'ktx',
    'image/ktx2': 'ktx2',
    'image/vnd-ms.dds': 'dds'
  };
  const loadTexture = (gltfImage, url, bufferView, mimeType, options) => {
    return new Promise((resolve, reject) => {
      const continuation = bufferViewData => {
        const name = (gltfImage.name || 'gltf-texture') + '-' + gltfTextureUniqueId++;

        // construct the asset file
        const file = {
          url: url || name
        };
        if (bufferViewData) {
          file.contents = bufferViewData.slice(0).buffer;
        }
        if (mimeType) {
          const extension = mimeTypeFileExtensions[mimeType];
          if (extension) {
            file.filename = file.url + '.' + extension;
          }
        }

        // create and load the asset
        const asset = new Asset(name, 'texture', file, null, options);
        asset.on('load', asset => resolve(asset));
        asset.on('error', err => reject(err));
        registry.add(asset);
        registry.load(asset);
      };
      if (bufferView) {
        bufferView.then(bufferViewData => continuation(bufferViewData));
      } else {
        continuation(null);
      }
    });
  };
  return gltf.images.map((gltfImage, i) => {
    if (preprocess) {
      preprocess(gltfImage);
    }
    let promise;
    if (processAsync) {
      promise = new Promise((resolve, reject) => {
        processAsync(gltfImage, (err, textureAsset) => {
          if (err) reject(err);else resolve(textureAsset);
        });
      });
    } else {
      promise = new Promise(resolve => {
        resolve(null);
      });
    }
    promise = promise.then(textureAsset => {
      if (textureAsset) {
        return textureAsset;
      } else if (gltfImage.hasOwnProperty('uri')) {
        // uri specified
        if (isDataURI(gltfImage.uri)) {
          return loadTexture(gltfImage, gltfImage.uri, null, getDataURIMimeType(gltfImage.uri), null);
        }
        return loadTexture(gltfImage, ABSOLUTE_URL.test(gltfImage.uri) ? gltfImage.uri : path.join(urlBase, gltfImage.uri), null, null, {
          crossOrigin: 'anonymous'
        });
      } else if (gltfImage.hasOwnProperty('bufferView') && gltfImage.hasOwnProperty('mimeType')) {
        // bufferview
        return loadTexture(gltfImage, null, bufferViews[gltfImage.bufferView], gltfImage.mimeType, null);
      }

      // fail
      return Promise.reject(new Error(`Invalid image found in gltf (neither uri or bufferView found). index=${i}`));
    });
    if (postprocess) {
      promise = promise.then(textureAsset => {
        postprocess(gltfImage, textureAsset);
        return textureAsset;
      });
    }
    return promise;
  });
};

// create gltf textures. returns an array of promises that resolve to texture assets.
const createTextures = (gltf, images, options) => {
  var _gltf$images, _gltf$textures, _options$texture, _options$texture2, _options$texture3;
  if (!(gltf != null && (_gltf$images = gltf.images) != null && _gltf$images.length) || !(gltf != null && (_gltf$textures = gltf.textures) != null && _gltf$textures.length)) {
    return [];
  }
  const preprocess = options == null ? void 0 : (_options$texture = options.texture) == null ? void 0 : _options$texture.preprocess;
  const processAsync = options == null ? void 0 : (_options$texture2 = options.texture) == null ? void 0 : _options$texture2.processAsync;
  const postprocess = options == null ? void 0 : (_options$texture3 = options.texture) == null ? void 0 : _options$texture3.postprocess;
  const seenImages = new Set();
  return gltf.textures.map(gltfTexture => {
    if (preprocess) {
      preprocess(gltfTexture);
    }
    let promise;
    if (processAsync) {
      promise = new Promise((resolve, reject) => {
        processAsync(gltfTexture, gltf.images, (err, gltfImageIndex) => {
          if (err) reject(err);else resolve(gltfImageIndex);
        });
      });
    } else {
      promise = new Promise(resolve => {
        resolve(null);
      });
    }
    promise = promise.then(gltfImageIndex => {
      var _ref, _gltfImageIndex, _gltfTexture$extensio, _gltfTexture$extensio2;
      // resolve image index
      gltfImageIndex = (_ref = (_gltfImageIndex = gltfImageIndex) != null ? _gltfImageIndex : gltfTexture == null ? void 0 : (_gltfTexture$extensio = gltfTexture.extensions) == null ? void 0 : (_gltfTexture$extensio2 = _gltfTexture$extensio.KHR_texture_basisu) == null ? void 0 : _gltfTexture$extensio2.source) != null ? _ref : gltfTexture.source;
      const cloneAsset = seenImages.has(gltfImageIndex);
      seenImages.add(gltfImageIndex);
      return images[gltfImageIndex].then(imageAsset => {
        var _gltf$samplers;
        const asset = cloneAsset ? cloneTextureAsset(imageAsset) : imageAsset;
        applySampler(asset.resource, ((_gltf$samplers = gltf.samplers) != null ? _gltf$samplers : [])[gltfTexture.sampler]);
        return asset;
      });
    });
    if (postprocess) {
      promise = promise.then(textureAsset => {
        postprocess(gltfTexture, textureAsset);
        return textureAsset;
      });
    }
    return promise;
  });
};

// load gltf buffers. returns an array of promises that resolve to typed arrays.
const loadBuffers = (gltf, binaryChunk, urlBase, options) => {
  var _options$buffer, _options$buffer2, _options$buffer3;
  if (!gltf.buffers || gltf.buffers.length === 0) {
    return [];
  }
  const preprocess = options == null ? void 0 : (_options$buffer = options.buffer) == null ? void 0 : _options$buffer.preprocess;
  const processAsync = options == null ? void 0 : (_options$buffer2 = options.buffer) == null ? void 0 : _options$buffer2.processAsync;
  const postprocess = options == null ? void 0 : (_options$buffer3 = options.buffer) == null ? void 0 : _options$buffer3.postprocess;
  return gltf.buffers.map((gltfBuffer, i) => {
    if (preprocess) {
      preprocess(gltfBuffer);
    }
    let promise;
    if (processAsync) {
      promise = new Promise((resolve, reject) => {
        processAsync(gltfBuffer, (err, arrayBuffer) => {
          if (err) reject(err);else resolve(arrayBuffer);
        });
      });
    } else {
      promise = new Promise(resolve => {
        resolve(null);
      });
    }
    promise = promise.then(arrayBuffer => {
      if (arrayBuffer) {
        return arrayBuffer;
      } else if (gltfBuffer.hasOwnProperty('uri')) {
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
          return binaryArray;
        }
        return new Promise((resolve, reject) => {
          http.get(ABSOLUTE_URL.test(gltfBuffer.uri) ? gltfBuffer.uri : path.join(urlBase, gltfBuffer.uri), {
            cache: true,
            responseType: 'arraybuffer',
            retry: false
          }, (err, result) => {
            // eslint-disable-line no-loop-func
            if (err) reject(err);else resolve(new Uint8Array(result));
          });
        });
      }

      // glb buffer reference
      return binaryChunk;
    });
    if (postprocess) {
      promise = promise.then(buffer => {
        postprocess(gltf.buffers[i], buffer);
        return buffer;
      });
    }
    return promise;
  });
};

// parse the gltf chunk, returns the gltf json
const parseGltf = (gltfChunk, callback) => {
  const decodeBinaryUtf8 = array => {
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
  callback(null, gltf);
};

// parse glb data, returns the gltf and binary chunk
const parseGlb = (glbData, callback) => {
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
      callback(`Invalid chunk length found in glb. Found ${chunkLength}`);
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
    callback(`Invalid chunk type found in glb file. Expected 0x4E4F534A, found 0x${chunks[0].type.toString(16)}`);
    return;
  }
  if (chunks.length > 1 && chunks[1].type !== 0x004E4942) {
    callback(`Invalid chunk type found in glb file. Expected 0x004E4942, found 0x${chunks[1].type.toString(16)}`);
    return;
  }
  callback(null, {
    gltfChunk: chunks[0].data,
    binaryChunk: chunks.length === 2 ? chunks[1].data : null
  });
};

// parse the chunk of data, which can be glb or gltf
const parseChunk = (filename, data, callback) => {
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
const createBufferViews = (gltf, buffers, options) => {
  var _options$bufferView, _options$bufferView2, _options$bufferView3, _gltf$bufferViews2;
  const result = [];
  const preprocess = options == null ? void 0 : (_options$bufferView = options.bufferView) == null ? void 0 : _options$bufferView.preprocess;
  const processAsync = options == null ? void 0 : (_options$bufferView2 = options.bufferView) == null ? void 0 : _options$bufferView2.processAsync;
  const postprocess = options == null ? void 0 : (_options$bufferView3 = options.bufferView) == null ? void 0 : _options$bufferView3.postprocess;

  // handle case of no buffers
  if (!((_gltf$bufferViews2 = gltf.bufferViews) != null && _gltf$bufferViews2.length)) {
    return result;
  }
  for (let i = 0; i < gltf.bufferViews.length; ++i) {
    const gltfBufferView = gltf.bufferViews[i];
    if (preprocess) {
      preprocess(gltfBufferView);
    }
    let promise;
    if (processAsync) {
      promise = new Promise((resolve, reject) => {
        processAsync(gltfBufferView, buffers, (err, result) => {
          if (err) reject(err);else resolve(result);
        });
      });
    } else {
      promise = new Promise(resolve => {
        resolve(null);
      });
    }
    promise = promise.then(buffer => {
      if (buffer) {
        return buffer;
      }

      // convert buffer to typed array
      return buffers[gltfBufferView.buffer].then(buffer => {
        return new Uint8Array(buffer.buffer, buffer.byteOffset + (gltfBufferView.byteOffset || 0), gltfBufferView.byteLength);
      });
    });

    // add a 'byteStride' member to the typed array so we have easy access to it later
    if (gltfBufferView.hasOwnProperty('byteStride')) {
      promise = promise.then(typedArray => {
        typedArray.byteStride = gltfBufferView.byteStride;
        return typedArray;
      });
    }
    if (postprocess) {
      promise = promise.then(typedArray => {
        postprocess(gltfBufferView, typedArray);
        return typedArray;
      });
    }
    result.push(promise);
  }
  return result;
};
class GlbParser {
  // parse the gltf or glb data asynchronously, loading external resources
  static parse(filename, urlBase, data, device, registry, options, callback) {
    // parse the data
    parseChunk(filename, data, (err, chunks) => {
      if (err) {
        callback(err);
        return;
      }

      // parse gltf
      parseGltf(chunks.gltfChunk, (err, gltf) => {
        if (err) {
          callback(err);
          return;
        }
        const buffers = loadBuffers(gltf, chunks.binaryChunk, urlBase, options);
        const bufferViews = createBufferViews(gltf, buffers, options);
        const images = createImages(gltf, bufferViews, urlBase, registry, options);
        const textures = createTextures(gltf, images, options);
        createResources(device, gltf, bufferViews, textures, options).then(result => callback(null, result)).catch(err => callback(err));
      });
    });
  }
  static createDefaultMaterial() {
    return createMaterial({
      name: 'defaultGlbMaterial'
    }, []);
  }
}

export { GlbParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9wYXJzZXJzL2dsYi1wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi8uLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUsXG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDVUxMRkFDRV9OT05FLCBDVUxMRkFDRV9CQUNLLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQUklNSVRJVkVfTElORUxPT1AsIFBSSU1JVElWRV9MSU5FU1RSSVAsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX1BPSU5UUywgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIFNFTUFOVElDX1RFWENPT1JEMCwgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19URVhDT09SRDIsIFNFTUFOVElDX1RFWENPT1JEMywgU0VNQU5USUNfVEVYQ09PUkQ0LCBTRU1BTlRJQ19URVhDT09SRDUsIFNFTUFOVElDX1RFWENPT1JENiwgU0VNQU5USUNfVEVYQ09PUkQ3LFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEJMRU5EX05PUk1BTCwgTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuICAgIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIEFTUEVDVF9NQU5VQUwsIEFTUEVDVF9BVVRPLCBTUEVDT0NDX0FPXG59IGZyb20gJy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IExpZ2h0LCBsaWdodFR5cGVzIH0gZnJvbSAnLi4vLi4vc2NlbmUvbGlnaHQuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNb3JwaFRhcmdldCB9IGZyb20gJy4uLy4uL3NjZW5lL21vcnBoLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBjYWxjdWxhdGVOb3JtYWxzIH0gZnJvbSAnLi4vLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBSZW5kZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9yZW5kZXIuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uLy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBJTlRFUlBPTEFUSU9OX0NVQklDLCBJTlRFUlBPTEFUSU9OX0xJTkVBUiwgSU5URVJQT0xBVElPTl9TVEVQIH0gZnJvbSAnLi4vYW5pbS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQW5pbUN1cnZlIH0gZnJvbSAnLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBBbmltRGF0YSB9IGZyb20gJy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyc7XG5pbXBvcnQgeyBBbmltVHJhY2sgfSBmcm9tICcuLi9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vYXNzZXQvYXNzZXQuanMnO1xuaW1wb3J0IHsgQUJTT0xVVEVfVVJMIH0gZnJvbSAnLi4vYXNzZXQvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgZHJhY29EZWNvZGUgfSBmcm9tICcuL2RyYWNvLWRlY29kZXIuanMnO1xuXG4vLyByZXNvdXJjZXMgbG9hZGVkIGZyb20gR0xCIGZpbGUgdGhhdCB0aGUgcGFyc2VyIHJldHVybnNcbmNsYXNzIEdsYlJlc291cmNlcyB7XG4gICAgZ2x0ZjtcblxuICAgIG5vZGVzO1xuXG4gICAgc2NlbmVzO1xuXG4gICAgYW5pbWF0aW9ucztcblxuICAgIHRleHR1cmVzO1xuXG4gICAgbWF0ZXJpYWxzO1xuXG4gICAgdmFyaWFudHM7XG5cbiAgICBtZXNoVmFyaWFudHM7XG5cbiAgICBtZXNoRGVmYXVsdE1hdGVyaWFscztcblxuICAgIHJlbmRlcnM7XG5cbiAgICBza2lucztcblxuICAgIGxpZ2h0cztcblxuICAgIGNhbWVyYXM7XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyByZW5kZXIgbmVlZHMgdG8gZGVjIHJlZiBtZXNoZXNcbiAgICAgICAgaWYgKHRoaXMucmVuZGVycykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJzLmZvckVhY2goKHJlbmRlcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlbmRlci5tZXNoZXMgPSBudWxsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNvbnN0IGlzRGF0YVVSSSA9ICh1cmkpID0+IHtcbiAgICByZXR1cm4gL15kYXRhOi4qLC4qJC9pLnRlc3QodXJpKTtcbn07XG5cbmNvbnN0IGdldERhdGFVUklNaW1lVHlwZSA9ICh1cmkpID0+IHtcbiAgICByZXR1cm4gdXJpLnN1YnN0cmluZyh1cmkuaW5kZXhPZignOicpICsgMSwgdXJpLmluZGV4T2YoJzsnKSk7XG59O1xuXG5jb25zdCBnZXROdW1Db21wb25lbnRzID0gKGFjY2Vzc29yVHlwZSkgPT4ge1xuICAgIHN3aXRjaCAoYWNjZXNzb3JUeXBlKSB7XG4gICAgICAgIGNhc2UgJ1NDQUxBUic6IHJldHVybiAxO1xuICAgICAgICBjYXNlICdWRUMyJzogcmV0dXJuIDI7XG4gICAgICAgIGNhc2UgJ1ZFQzMnOiByZXR1cm4gMztcbiAgICAgICAgY2FzZSAnVkVDNCc6IHJldHVybiA0O1xuICAgICAgICBjYXNlICdNQVQyJzogcmV0dXJuIDQ7XG4gICAgICAgIGNhc2UgJ01BVDMnOiByZXR1cm4gOTtcbiAgICAgICAgY2FzZSAnTUFUNCc6IHJldHVybiAxNjtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDM7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50VHlwZSA9IChjb21wb25lbnRUeXBlKSA9PiB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIFRZUEVfSU5UODtcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gVFlQRV9VSU5UODtcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gVFlQRV9JTlQxNjtcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gVFlQRV9VSU5UMTY7XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIFRZUEVfSU5UMzI7XG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIFRZUEVfVUlOVDMyO1xuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiBUWVBFX0ZMT0FUMzI7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAwO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudFNpemVJbkJ5dGVzID0gKGNvbXBvbmVudFR5cGUpID0+IHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gMTsgICAgLy8gaW50OFxuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiAxOyAgICAvLyB1aW50OFxuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiAyOyAgICAvLyBpbnQxNlxuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiAyOyAgICAvLyB1aW50MTZcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gNDsgICAgLy8gaW50MzJcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gNDsgICAgLy8gdWludDMyXG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIDQ7ICAgIC8vIGZsb2F0MzJcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDA7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50RGF0YVR5cGUgPSAoY29tcG9uZW50VHlwZSkgPT4ge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiBJbnQ4QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIFVpbnQ4QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIEludDE2QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIFVpbnQxNkFycmF5O1xuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiBJbnQzMkFycmF5O1xuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiBVaW50MzJBcnJheTtcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gRmxvYXQzMkFycmF5O1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG5jb25zdCBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcCA9IHtcbiAgICAnUE9TSVRJT04nOiBTRU1BTlRJQ19QT1NJVElPTixcbiAgICAnTk9STUFMJzogU0VNQU5USUNfTk9STUFMLFxuICAgICdUQU5HRU5UJzogU0VNQU5USUNfVEFOR0VOVCxcbiAgICAnQ09MT1JfMCc6IFNFTUFOVElDX0NPTE9SLFxuICAgICdKT0lOVFNfMCc6IFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICAnV0VJR0hUU18wJzogU0VNQU5USUNfQkxFTkRXRUlHSFQsXG4gICAgJ1RFWENPT1JEXzAnOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgJ1RFWENPT1JEXzEnOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgJ1RFWENPT1JEXzInOiBTRU1BTlRJQ19URVhDT09SRDIsXG4gICAgJ1RFWENPT1JEXzMnOiBTRU1BTlRJQ19URVhDT09SRDMsXG4gICAgJ1RFWENPT1JEXzQnOiBTRU1BTlRJQ19URVhDT09SRDQsXG4gICAgJ1RFWENPT1JEXzUnOiBTRU1BTlRJQ19URVhDT09SRDUsXG4gICAgJ1RFWENPT1JEXzYnOiBTRU1BTlRJQ19URVhDT09SRDYsXG4gICAgJ1RFWENPT1JEXzcnOiBTRU1BTlRJQ19URVhDT09SRDdcbn07XG5cbi8vIG9yZGVyIHZlcnRleERlc2MgdG8gbWF0Y2ggdGhlIHJlc3Qgb2YgdGhlIGVuZ2luZVxuY29uc3QgYXR0cmlidXRlT3JkZXIgPSB7XG4gICAgW1NFTUFOVElDX1BPU0lUSU9OXTogMCxcbiAgICBbU0VNQU5USUNfTk9STUFMXTogMSxcbiAgICBbU0VNQU5USUNfVEFOR0VOVF06IDIsXG4gICAgW1NFTUFOVElDX0NPTE9SXTogMyxcbiAgICBbU0VNQU5USUNfQkxFTkRJTkRJQ0VTXTogNCxcbiAgICBbU0VNQU5USUNfQkxFTkRXRUlHSFRdOiA1LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDBdOiA2LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDFdOiA3LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDJdOiA4LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDNdOiA5LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDRdOiAxMCxcbiAgICBbU0VNQU5USUNfVEVYQ09PUkQ1XTogMTEsXG4gICAgW1NFTUFOVElDX1RFWENPT1JENl06IDEyLFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDddOiAxM1xufTtcblxuLy8gcmV0dXJucyBhIGZ1bmN0aW9uIGZvciBkZXF1YW50aXppbmcgdGhlIGRhdGEgdHlwZVxuY29uc3QgZ2V0RGVxdWFudGl6ZUZ1bmMgPSAoc3JjVHlwZSkgPT4ge1xuICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vS2hyb25vc0dyb3VwL2dsVEYvdHJlZS9tYXN0ZXIvZXh0ZW5zaW9ucy8yLjAvS2hyb25vcy9LSFJfbWVzaF9xdWFudGl6YXRpb24jZW5jb2RpbmctcXVhbnRpemVkLWRhdGFcbiAgICBzd2l0Y2ggKHNyY1R5cGUpIHtcbiAgICAgICAgY2FzZSBUWVBFX0lOVDg6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAxMjcuMCwgLTEuMCk7XG4gICAgICAgIGNhc2UgVFlQRV9VSU5UODogcmV0dXJuIHggPT4geCAvIDI1NS4wO1xuICAgICAgICBjYXNlIFRZUEVfSU5UMTY6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAzMjc2Ny4wLCAtMS4wKTtcbiAgICAgICAgY2FzZSBUWVBFX1VJTlQxNjogcmV0dXJuIHggPT4geCAvIDY1NTM1LjA7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiB4ID0+IHg7XG4gICAgfVxufTtcblxuLy8gZGVxdWFudGl6ZSBhbiBhcnJheSBvZiBkYXRhXG5jb25zdCBkZXF1YW50aXplQXJyYXkgPSAoZHN0QXJyYXksIHNyY0FycmF5LCBzcmNUeXBlKSA9PiB7XG4gICAgY29uc3QgY29udkZ1bmMgPSBnZXREZXF1YW50aXplRnVuYyhzcmNUeXBlKTtcbiAgICBjb25zdCBsZW4gPSBzcmNBcnJheS5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBkc3RBcnJheVtpXSA9IGNvbnZGdW5jKHNyY0FycmF5W2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIGRzdEFycmF5O1xufTtcblxuLy8gZ2V0IGFjY2Vzc29yIGRhdGEsIG1ha2luZyBhIGNvcHkgYW5kIHBhdGNoaW5nIGluIHRoZSBjYXNlIG9mIGEgc3BhcnNlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckRhdGEgPSAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgZmxhdHRlbiA9IGZhbHNlKSA9PiB7XG4gICAgY29uc3QgbnVtQ29tcG9uZW50cyA9IGdldE51bUNvbXBvbmVudHMoZ2x0ZkFjY2Vzc29yLnR5cGUpO1xuICAgIGNvbnN0IGRhdGFUeXBlID0gZ2V0Q29tcG9uZW50RGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgIGlmICghZGF0YVR5cGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdDtcblxuICAgIGlmIChnbHRmQWNjZXNzb3Iuc3BhcnNlKSB7XG4gICAgICAgIC8vIGhhbmRsZSBzcGFyc2UgZGF0YVxuICAgICAgICBjb25zdCBzcGFyc2UgPSBnbHRmQWNjZXNzb3Iuc3BhcnNlO1xuXG4gICAgICAgIC8vIGdldCBpbmRpY2VzIGRhdGFcbiAgICAgICAgY29uc3QgaW5kaWNlc0FjY2Vzc29yID0ge1xuICAgICAgICAgICAgY291bnQ6IHNwYXJzZS5jb3VudCxcbiAgICAgICAgICAgIHR5cGU6ICdTQ0FMQVInXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGluZGljZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbihpbmRpY2VzQWNjZXNzb3IsIHNwYXJzZS5pbmRpY2VzKSwgYnVmZmVyVmlld3MsIHRydWUpO1xuXG4gICAgICAgIC8vIGRhdGEgdmFsdWVzIGRhdGFcbiAgICAgICAgY29uc3QgdmFsdWVzQWNjZXNzb3IgPSB7XG4gICAgICAgICAgICBjb3VudDogc3BhcnNlLmNvdW50LFxuICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGUsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiBnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbih2YWx1ZXNBY2Nlc3Nvciwgc3BhcnNlLnZhbHVlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBnZXQgYmFzZSBkYXRhXG4gICAgICAgIGlmIChnbHRmQWNjZXNzb3IuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUFjY2Vzc29yID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXc6IGdsdGZBY2Nlc3Nvci5idWZmZXJWaWV3LFxuICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXQ6IGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgIGNvdW50OiBnbHRmQWNjZXNzb3IuY291bnQsXG4gICAgICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYmFzZSBkYXRhIHNpbmNlIHdlJ2xsIHBhdGNoIHRoZSB2YWx1ZXNcbiAgICAgICAgICAgIHJlc3VsdCA9IGdldEFjY2Vzc29yRGF0YShiYXNlQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKS5zbGljZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gYmFzZSBkYXRhLCBjcmVhdGUgZW1wdHkgMCdkIG91dCBkYXRhXG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvdW50ICogbnVtQ29tcG9uZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwYXJzZS5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRJbmRleCA9IGluZGljZXNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bUNvbXBvbmVudHM7ICsraikge1xuICAgICAgICAgICAgICAgIHJlc3VsdFt0YXJnZXRJbmRleCAqIG51bUNvbXBvbmVudHMgKyBqXSA9IHZhbHVlc1tpICogbnVtQ29tcG9uZW50cyArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGdsdGZBY2Nlc3Nvci5oYXNPd25Qcm9wZXJ0eShcImJ1ZmZlclZpZXdcIikpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlclZpZXcgPSBidWZmZXJWaWV3c1tnbHRmQWNjZXNzb3IuYnVmZmVyVmlld107XG4gICAgICAgICAgICBpZiAoZmxhdHRlbiAmJiBidWZmZXJWaWV3Lmhhc093blByb3BlcnR5KCdieXRlU3RyaWRlJykpIHtcbiAgICAgICAgICAgICAgICAvLyBmbGF0dGVuIHN0cmlkZGVuIGRhdGFcbiAgICAgICAgICAgICAgICBjb25zdCBieXRlc1BlckVsZW1lbnQgPSBudW1Db21wb25lbnRzICogZGF0YVR5cGUuQllURVNfUEVSX0VMRU1FTlQ7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmFnZSA9IG5ldyBBcnJheUJ1ZmZlcihnbHRmQWNjZXNzb3IuY291bnQgKiBieXRlc1BlckVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRtcEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoc3RvcmFnZSk7XG5cbiAgICAgICAgICAgICAgICBsZXQgZHN0T2Zmc2V0ID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGZBY2Nlc3Nvci5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gYWRkIGJ1ZmZlclZpZXcuYnl0ZU9mZnNldCBiZWNhdXNlIGFjY2Vzc29yIHRha2VzIHRoaXMgaW50byBhY2NvdW50XG4gICAgICAgICAgICAgICAgICAgIGxldCBzcmNPZmZzZXQgPSAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCkgKyBpICogYnVmZmVyVmlldy5ieXRlU3RyaWRlO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBiID0gMDsgYiA8IGJ5dGVzUGVyRWxlbWVudDsgKytiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0bXBBcnJheVtkc3RPZmZzZXQrK10gPSBidWZmZXJWaWV3W3NyY09mZnNldCsrXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBkYXRhVHlwZShzdG9yYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGJ1ZmZlclZpZXcuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVPZmZzZXQgKyAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdldCBhY2Nlc3NvciBkYXRhIGFzICh1bm5vcm1hbGl6ZWQsIHVucXVhbnRpemVkKSBGbG9hdDMyIGRhdGFcbmNvbnN0IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIgPSAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBnZXRBY2Nlc3NvckRhdGEoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgaWYgKGRhdGEgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgfHwgIWdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIC8vIGlmIHRoZSBzb3VyY2UgZGF0YSBpcyBxdWFudGl6ZWQgKHNheSB0byBpbnQxNiksIGJ1dCBub3Qgbm9ybWFsaXplZFxuICAgICAgICAvLyB0aGVuIHJlYWRpbmcgdGhlIHZhbHVlcyBvZiB0aGUgYXJyYXkgaXMgdGhlIHNhbWUgd2hldGhlciB0aGUgdmFsdWVzXG4gICAgICAgIC8vIGFyZSBzdG9yZWQgYXMgZmxvYXQzMiBvciBpbnQxNi4gc28gcHJvYmFibHkgbm8gbmVlZCB0byBjb252ZXJ0IHRvXG4gICAgICAgIC8vIGZsb2F0MzIuXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIGNvbnN0IGZsb2F0MzJEYXRhID0gbmV3IEZsb2F0MzJBcnJheShkYXRhLmxlbmd0aCk7XG4gICAgZGVxdWFudGl6ZUFycmF5KGZsb2F0MzJEYXRhLCBkYXRhLCBnZXRDb21wb25lbnRUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKSk7XG4gICAgcmV0dXJuIGZsb2F0MzJEYXRhO1xufTtcblxuLy8gcmV0dXJucyBhIGRlcXVhbnRpemVkIGJvdW5kaW5nIGJveCBmb3IgdGhlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckJvdW5kaW5nQm94ID0gKGdsdGZBY2Nlc3NvcikgPT4ge1xuICAgIGxldCBtaW4gPSBnbHRmQWNjZXNzb3IubWluO1xuICAgIGxldCBtYXggPSBnbHRmQWNjZXNzb3IubWF4O1xuICAgIGlmICghbWluIHx8ICFtYXgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIGNvbnN0IGN0eXBlID0gZ2V0Q29tcG9uZW50VHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgICAgIG1pbiA9IGRlcXVhbnRpemVBcnJheShbXSwgbWluLCBjdHlwZSk7XG4gICAgICAgIG1heCA9IGRlcXVhbnRpemVBcnJheShbXSwgbWF4LCBjdHlwZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCb3VuZGluZ0JveChcbiAgICAgICAgbmV3IFZlYzMoKG1heFswXSArIG1pblswXSkgKiAwLjUsIChtYXhbMV0gKyBtaW5bMV0pICogMC41LCAobWF4WzJdICsgbWluWzJdKSAqIDAuNSksXG4gICAgICAgIG5ldyBWZWMzKChtYXhbMF0gLSBtaW5bMF0pICogMC41LCAobWF4WzFdIC0gbWluWzFdKSAqIDAuNSwgKG1heFsyXSAtIG1pblsyXSkgKiAwLjUpXG4gICAgKTtcbn07XG5cbmNvbnN0IGdldFByaW1pdGl2ZVR5cGUgPSAocHJpbWl0aXZlKSA9PiB7XG4gICAgaWYgKCFwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ21vZGUnKSkge1xuICAgICAgICByZXR1cm4gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHByaW1pdGl2ZS5tb2RlKSB7XG4gICAgICAgIGNhc2UgMDogcmV0dXJuIFBSSU1JVElWRV9QT0lOVFM7XG4gICAgICAgIGNhc2UgMTogcmV0dXJuIFBSSU1JVElWRV9MSU5FUztcbiAgICAgICAgY2FzZSAyOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVMT09QO1xuICAgICAgICBjYXNlIDM6IHJldHVybiBQUklNSVRJVkVfTElORVNUUklQO1xuICAgICAgICBjYXNlIDQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgICAgICBjYXNlIDU6IHJldHVybiBQUklNSVRJVkVfVFJJU1RSSVA7XG4gICAgICAgIGNhc2UgNjogcmV0dXJuIFBSSU1JVElWRV9UUklGQU47XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgIH1cbn07XG5cbmNvbnN0IGdlbmVyYXRlSW5kaWNlcyA9IChudW1WZXJ0aWNlcykgPT4ge1xuICAgIGNvbnN0IGR1bW15SW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShudW1WZXJ0aWNlcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1WZXJ0aWNlczsgaSsrKSB7XG4gICAgICAgIGR1bW15SW5kaWNlc1tpXSA9IGk7XG4gICAgfVxuICAgIHJldHVybiBkdW1teUluZGljZXM7XG59O1xuXG5jb25zdCBnZW5lcmF0ZU5vcm1hbHMgPSAoc291cmNlRGVzYywgaW5kaWNlcykgPT4ge1xuICAgIC8vIGdldCBwb3NpdGlvbnNcbiAgICBjb25zdCBwID0gc291cmNlRGVzY1tTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgaWYgKCFwIHx8IHAuY29tcG9uZW50cyAhPT0gMykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHBvc2l0aW9ucztcbiAgICBpZiAocC5zaXplICE9PSBwLnN0cmlkZSkge1xuICAgICAgICAvLyBleHRyYWN0IHBvc2l0aW9ucyB3aGljaCBhcmVuJ3QgdGlnaHRseSBwYWNrZWRcbiAgICAgICAgY29uc3Qgc3JjU3RyaWRlID0gcC5zdHJpZGUgLyB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVtwLnR5cGVdO1xuICAgICAgICBjb25zdCBzcmMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogc3JjU3RyaWRlKTtcbiAgICAgICAgcG9zaXRpb25zID0gbmV3IHR5cGVkQXJyYXlUeXBlc1twLnR5cGVdKHAuY291bnQgKiAzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDBdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAwXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDFdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAxXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDJdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAyXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBvc2l0aW9uIGRhdGEgaXMgdGlnaHRseSBwYWNrZWQgc28gd2UgY2FuIHVzZSBpdCBkaXJlY3RseVxuICAgICAgICBwb3NpdGlvbnMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogMyk7XG4gICAgfVxuXG4gICAgY29uc3QgbnVtVmVydGljZXMgPSBwLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgaW5kaWNlcyBpZiBuZWNlc3NhcnlcbiAgICBpZiAoIWluZGljZXMpIHtcbiAgICAgICAgaW5kaWNlcyA9IGdlbmVyYXRlSW5kaWNlcyhudW1WZXJ0aWNlcyk7XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFsc1xuICAgIGNvbnN0IG5vcm1hbHNUZW1wID0gY2FsY3VsYXRlTm9ybWFscyhwb3NpdGlvbnMsIGluZGljZXMpO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KG5vcm1hbHNUZW1wLmxlbmd0aCk7XG4gICAgbm9ybWFscy5zZXQobm9ybWFsc1RlbXApO1xuXG4gICAgc291cmNlRGVzY1tTRU1BTlRJQ19OT1JNQUxdID0ge1xuICAgICAgICBidWZmZXI6IG5vcm1hbHMuYnVmZmVyLFxuICAgICAgICBzaXplOiAxMixcbiAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICBzdHJpZGU6IDEyLFxuICAgICAgICBjb3VudDogbnVtVmVydGljZXMsXG4gICAgICAgIGNvbXBvbmVudHM6IDMsXG4gICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgIH07XG59O1xuXG5jb25zdCBmbGlwVGV4Q29vcmRWcyA9ICh2ZXJ0ZXhCdWZmZXIpID0+IHtcbiAgICBsZXQgaSwgajtcblxuICAgIGNvbnN0IGZsb2F0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IHNob3J0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IGJ5dGVPZmZzZXRzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIGlmIChlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMCB8fFxuICAgICAgICAgICAgZWxlbWVudC5uYW1lID09PSBTRU1BTlRJQ19URVhDT09SRDEpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoZWxlbWVudC5kYXRhVHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9GTE9BVDMyOlxuICAgICAgICAgICAgICAgICAgICBmbG9hdE9mZnNldHMucHVzaCh7IG9mZnNldDogZWxlbWVudC5vZmZzZXQgLyA0ICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSAvIDQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMTY6XG4gICAgICAgICAgICAgICAgICAgIHNob3J0T2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCAvIDIgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIC8gMiB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OlxuICAgICAgICAgICAgICAgICAgICBieXRlT2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZmxpcCA9IChvZmZzZXRzLCB0eXBlLCBvbmUpID0+IHtcbiAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyB0eXBlKHZlcnRleEJ1ZmZlci5zdG9yYWdlKTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG9mZnNldHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IG9mZnNldHNbaV0ub2Zmc2V0O1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gb2Zmc2V0c1tpXS5zdHJpZGU7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgdmVydGV4QnVmZmVyLm51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICB0eXBlZEFycmF5W2luZGV4XSA9IG9uZSAtIHR5cGVkQXJyYXlbaW5kZXhdO1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IHN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoZmxvYXRPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChmbG9hdE9mZnNldHMsIEZsb2F0MzJBcnJheSwgMS4wKTtcbiAgICB9XG4gICAgaWYgKHNob3J0T2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoc2hvcnRPZmZzZXRzLCBVaW50MTZBcnJheSwgNjU1MzUpO1xuICAgIH1cbiAgICBpZiAoYnl0ZU9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKGJ5dGVPZmZzZXRzLCBVaW50OEFycmF5LCAyNTUpO1xuICAgIH1cbn07XG5cbi8vIGdpdmVuIGEgdGV4dHVyZSwgY2xvbmUgaXRcbi8vIE5PVEU6IENQVS1zaWRlIHRleHR1cmUgZGF0YSB3aWxsIGJlIHNoYXJlZCBidXQgR1BVIG1lbW9yeSB3aWxsIGJlIGR1cGxpY2F0ZWRcbmNvbnN0IGNsb25lVGV4dHVyZSA9ICh0ZXh0dXJlKSA9PiB7XG4gICAgY29uc3Qgc2hhbGxvd0NvcHlMZXZlbHMgPSAodGV4dHVyZSkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgbWlwID0gMDsgbWlwIDwgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aDsgKyttaXApIHtcbiAgICAgICAgICAgIGxldCBsZXZlbCA9IFtdO1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgKytmYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsLnB1c2godGV4dHVyZS5fbGV2ZWxzW21pcF1bZmFjZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwgPSB0ZXh0dXJlLl9sZXZlbHNbbWlwXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgVGV4dHVyZSh0ZXh0dXJlLmRldmljZSwgdGV4dHVyZSk7ICAgLy8gZHVwbGljYXRlIHRleHR1cmVcbiAgICByZXN1bHQuX2xldmVscyA9IHNoYWxsb3dDb3B5TGV2ZWxzKHRleHR1cmUpOyAgICAgICAgICAgIC8vIHNoYWxsb3cgY29weSB0aGUgbGV2ZWxzIHN0cnVjdHVyZVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnaXZlbiBhIHRleHR1cmUgYXNzZXQsIGNsb25lIGl0XG5jb25zdCBjbG9uZVRleHR1cmVBc3NldCA9IChzcmMpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgQXNzZXQoc3JjLm5hbWUgKyAnX2Nsb25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5maWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMuZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLm9wdGlvbnMpO1xuICAgIHJlc3VsdC5sb2FkZWQgPSB0cnVlO1xuICAgIHJlc3VsdC5yZXNvdXJjZSA9IGNsb25lVGV4dHVyZShzcmMucmVzb3VyY2UpO1xuICAgIHNyYy5yZWdpc3RyeS5hZGQocmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwgPSAoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVikgPT4ge1xuICAgIGNvbnN0IHBvc2l0aW9uRGVzYyA9IHNvdXJjZURlc2NbU0VNQU5USUNfUE9TSVRJT05dO1xuICAgIGlmICghcG9zaXRpb25EZXNjKSB7XG4gICAgICAgIC8vIGlnbm9yZSBtZXNoZXMgd2l0aG91dCBwb3NpdGlvbnNcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IG51bVZlcnRpY2VzID0gcG9zaXRpb25EZXNjLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgdmVydGV4RGVzYyBlbGVtZW50c1xuICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHNlbWFudGljIGluIHNvdXJjZURlc2MpIHtcbiAgICAgICAgaWYgKHNvdXJjZURlc2MuaGFzT3duUHJvcGVydHkoc2VtYW50aWMpKSB7XG4gICAgICAgICAgICB2ZXJ0ZXhEZXNjLnB1c2goe1xuICAgICAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBzb3VyY2VEZXNjW3NlbWFudGljXS5jb21wb25lbnRzLFxuICAgICAgICAgICAgICAgIHR5cGU6IHNvdXJjZURlc2Nbc2VtYW50aWNdLnR5cGUsXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiAhIXNvdXJjZURlc2Nbc2VtYW50aWNdLm5vcm1hbGl6ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHZlcnRleCBlbGVtZW50cyBieSBlbmdpbmUtaWRlYWwgb3JkZXJcbiAgICB2ZXJ0ZXhEZXNjLnNvcnQoKGxocywgcmhzKSA9PiB7XG4gICAgICAgIHJldHVybiBhdHRyaWJ1dGVPcmRlcltsaHMuc2VtYW50aWNdIC0gYXR0cmlidXRlT3JkZXJbcmhzLnNlbWFudGljXTtcbiAgICB9KTtcblxuICAgIGxldCBpLCBqLCBrO1xuICAgIGxldCBzb3VyY2UsIHRhcmdldCwgc291cmNlT2Zmc2V0O1xuXG4gICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdChkZXZpY2UsIHZlcnRleERlc2MpO1xuXG4gICAgLy8gY2hlY2sgd2hldGhlciBzb3VyY2UgZGF0YSBpcyBjb3JyZWN0bHkgaW50ZXJsZWF2ZWRcbiAgICBsZXQgaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCA9IHRydWU7XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB0YXJnZXQgPSB2ZXJ0ZXhGb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIHNvdXJjZSA9IHNvdXJjZURlc2NbdGFyZ2V0Lm5hbWVdO1xuICAgICAgICBzb3VyY2VPZmZzZXQgPSBzb3VyY2Uub2Zmc2V0IC0gcG9zaXRpb25EZXNjLm9mZnNldDtcbiAgICAgICAgaWYgKChzb3VyY2UuYnVmZmVyICE9PSBwb3NpdGlvbkRlc2MuYnVmZmVyKSB8fFxuICAgICAgICAgICAgKHNvdXJjZS5zdHJpZGUgIT09IHRhcmdldC5zdHJpZGUpIHx8XG4gICAgICAgICAgICAoc291cmNlLnNpemUgIT09IHRhcmdldC5zaXplKSB8fFxuICAgICAgICAgICAgKHNvdXJjZU9mZnNldCAhPT0gdGFyZ2V0Lm9mZnNldCkpIHtcbiAgICAgICAgICAgIGlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlIHZlcnRleCBidWZmZXJcbiAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKGRldmljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnRleEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bVZlcnRpY2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQlVGRkVSX1NUQVRJQyk7XG5cbiAgICBjb25zdCB2ZXJ0ZXhEYXRhID0gdmVydGV4QnVmZmVyLmxvY2soKTtcbiAgICBjb25zdCB0YXJnZXRBcnJheSA9IG5ldyBVaW50MzJBcnJheSh2ZXJ0ZXhEYXRhKTtcbiAgICBsZXQgc291cmNlQXJyYXk7XG5cbiAgICBpZiAoaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCkge1xuICAgICAgICAvLyBjb3B5IGRhdGFcbiAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkocG9zaXRpb25EZXNjLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25EZXNjLm9mZnNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmVydGljZXMgKiB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnNpemUgLyA0KTtcbiAgICAgICAgdGFyZ2V0QXJyYXkuc2V0KHNvdXJjZUFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgdGFyZ2V0U3RyaWRlLCBzb3VyY2VTdHJpZGU7XG4gICAgICAgIC8vIGNvcHkgZGF0YSBhbmQgaW50ZXJsZWF2ZVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgICAgIHRhcmdldFN0cmlkZSA9IHRhcmdldC5zdHJpZGUgLyA0O1xuXG4gICAgICAgICAgICBzb3VyY2UgPSBzb3VyY2VEZXNjW3RhcmdldC5uYW1lXTtcbiAgICAgICAgICAgIHNvdXJjZVN0cmlkZSA9IHNvdXJjZS5zdHJpZGUgLyA0O1xuICAgICAgICAgICAgLy8gZW5zdXJlIHdlIGRvbid0IGdvIGJleW9uZCB0aGUgZW5kIG9mIHRoZSBhcnJheWJ1ZmZlciB3aGVuIGRlYWxpbmcgd2l0aFxuICAgICAgICAgICAgLy8gaW50ZXJsYWNlZCB2ZXJ0ZXggZm9ybWF0c1xuICAgICAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkoc291cmNlLmJ1ZmZlciwgc291cmNlLm9mZnNldCwgKHNvdXJjZS5jb3VudCAtIDEpICogc291cmNlU3RyaWRlICsgKHNvdXJjZS5zaXplICsgMykgLyA0KTtcblxuICAgICAgICAgICAgbGV0IHNyYyA9IDA7XG4gICAgICAgICAgICBsZXQgZHN0ID0gdGFyZ2V0Lm9mZnNldCAvIDQ7XG4gICAgICAgICAgICBjb25zdCBrZW5kID0gTWF0aC5mbG9vcigoc291cmNlLnNpemUgKyAzKSAvIDQpO1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IG51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwga2VuZDsgKytrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldEFycmF5W2RzdCArIGtdID0gc291cmNlQXJyYXlbc3JjICsga107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNyYyArPSBzb3VyY2VTdHJpZGU7XG4gICAgICAgICAgICAgICAgZHN0ICs9IHRhcmdldFN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmbGlwVikge1xuICAgICAgICBmbGlwVGV4Q29vcmRWcyh2ZXJ0ZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIHZlcnRleEJ1ZmZlci51bmxvY2soKTtcblxuICAgIHJldHVybiB2ZXJ0ZXhCdWZmZXI7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXIgPSAoZGV2aWNlLCBhdHRyaWJ1dGVzLCBpbmRpY2VzLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCkgPT4ge1xuXG4gICAgLy8gZXh0cmFjdCBsaXN0IG9mIGF0dHJpYnV0ZXMgdG8gdXNlXG4gICAgY29uc3QgdXNlQXR0cmlidXRlcyA9IHt9O1xuICAgIGNvbnN0IGF0dHJpYklkcyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBhdHRyaWIgaW4gYXR0cmlidXRlcykge1xuICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShhdHRyaWIpICYmIGdsdGZUb0VuZ2luZVNlbWFudGljTWFwLmhhc093blByb3BlcnR5KGF0dHJpYikpIHtcbiAgICAgICAgICAgIHVzZUF0dHJpYnV0ZXNbYXR0cmliXSA9IGF0dHJpYnV0ZXNbYXR0cmliXTtcblxuICAgICAgICAgICAgLy8gYnVpbGQgdW5pcXVlIGlkIGZvciBlYWNoIGF0dHJpYnV0ZSBpbiBmb3JtYXQ6IFNlbWFudGljOmFjY2Vzc29ySW5kZXhcbiAgICAgICAgICAgIGF0dHJpYklkcy5wdXNoKGF0dHJpYiArICc6JyArIGF0dHJpYnV0ZXNbYXR0cmliXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHVuaXF1ZSBpZHMgYW5kIGNyZWF0ZSB1bmlxdWUgdmVydGV4IGJ1ZmZlciBJRFxuICAgIGF0dHJpYklkcy5zb3J0KCk7XG4gICAgY29uc3QgdmJLZXkgPSBhdHRyaWJJZHMuam9pbigpO1xuXG4gICAgLy8gcmV0dXJuIGFscmVhZHkgY3JlYXRlZCB2ZXJ0ZXggYnVmZmVyIGlmIGlkZW50aWNhbFxuICAgIGxldCB2YiA9IHZlcnRleEJ1ZmZlckRpY3RbdmJLZXldO1xuICAgIGlmICghdmIpIHtcbiAgICAgICAgLy8gYnVpbGQgdmVydGV4IGJ1ZmZlciBmb3JtYXQgZGVzYyBhbmQgc291cmNlXG4gICAgICAgIGNvbnN0IHNvdXJjZURlc2MgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyaWIgaW4gdXNlQXR0cmlidXRlcykge1xuICAgICAgICAgICAgY29uc3QgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbYXR0cmlidXRlc1thdHRyaWJdXTtcbiAgICAgICAgICAgIGNvbnN0IGFjY2Vzc29yRGF0YSA9IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyVmlldyA9IGJ1ZmZlclZpZXdzW2FjY2Vzc29yLmJ1ZmZlclZpZXddO1xuICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFthdHRyaWJdO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSkgKiBnZXRDb21wb25lbnRTaXplSW5CeXRlcyhhY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgIGNvbnN0IHN0cmlkZSA9IGJ1ZmZlclZpZXcgJiYgYnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpID8gYnVmZmVyVmlldy5ieXRlU3RyaWRlIDogc2l6ZTtcbiAgICAgICAgICAgIHNvdXJjZURlc2Nbc2VtYW50aWNdID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYWNjZXNzb3JEYXRhLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgICAgIG9mZnNldDogYWNjZXNzb3JEYXRhLmJ5dGVPZmZzZXQsXG4gICAgICAgICAgICAgICAgc3RyaWRlOiBzdHJpZGUsXG4gICAgICAgICAgICAgICAgY291bnQ6IGFjY2Vzc29yLmNvdW50LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSksXG4gICAgICAgICAgICAgICAgdHlwZTogZ2V0Q29tcG9uZW50VHlwZShhY2Nlc3Nvci5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6IGFjY2Vzc29yLm5vcm1hbGl6ZWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBnZW5lcmF0ZSBub3JtYWxzIGlmIHRoZXkncmUgbWlzc2luZyAodGhpcyBzaG91bGQgcHJvYmFibHkgYmUgYSB1c2VyIG9wdGlvbilcbiAgICAgICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgICAgIGdlbmVyYXRlTm9ybWFscyhzb3VyY2VEZXNjLCBpbmRpY2VzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgc3RvcmUgaXQgaW4gdGhlIGRpY3Rpb25hcnlcbiAgICAgICAgdmIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbiAgICAgICAgdmVydGV4QnVmZmVyRGljdFt2YktleV0gPSB2YjtcbiAgICB9XG5cbiAgICByZXR1cm4gdmI7XG59O1xuXG5jb25zdCBjcmVhdGVTa2luID0gKGRldmljZSwgZ2x0ZlNraW4sIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIG5vZGVzLCBnbGJTa2lucykgPT4ge1xuICAgIGxldCBpLCBqLCBiaW5kTWF0cml4O1xuICAgIGNvbnN0IGpvaW50cyA9IGdsdGZTa2luLmpvaW50cztcbiAgICBjb25zdCBudW1Kb2ludHMgPSBqb2ludHMubGVuZ3RoO1xuICAgIGNvbnN0IGlicCA9IFtdO1xuICAgIGlmIChnbHRmU2tpbi5oYXNPd25Qcm9wZXJ0eSgnaW52ZXJzZUJpbmRNYXRyaWNlcycpKSB7XG4gICAgICAgIGNvbnN0IGludmVyc2VCaW5kTWF0cmljZXMgPSBnbHRmU2tpbi5pbnZlcnNlQmluZE1hdHJpY2VzO1xuICAgICAgICBjb25zdCBpYm1EYXRhID0gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yc1tpbnZlcnNlQmluZE1hdHJpY2VzXSwgYnVmZmVyVmlld3MsIHRydWUpO1xuICAgICAgICBjb25zdCBpYm1WYWx1ZXMgPSBbXTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCAxNjsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWJtVmFsdWVzW2pdID0gaWJtRGF0YVtpICogMTYgKyBqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJpbmRNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgYmluZE1hdHJpeC5zZXQoaWJtVmFsdWVzKTtcbiAgICAgICAgICAgIGlicC5wdXNoKGJpbmRNYXRyaXgpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG51bUpvaW50czsgaSsrKSB7XG4gICAgICAgICAgICBiaW5kTWF0cml4ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgICAgIGlicC5wdXNoKGJpbmRNYXRyaXgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYm9uZU5hbWVzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IG51bUpvaW50czsgaSsrKSB7XG4gICAgICAgIGJvbmVOYW1lc1tpXSA9IG5vZGVzW2pvaW50c1tpXV0ubmFtZTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgYSBjYWNoZSBrZXkgZnJvbSBib25lIG5hbWVzIGFuZCBzZWUgaWYgd2UgaGF2ZSBtYXRjaGluZyBza2luXG4gICAgY29uc3Qga2V5ID0gYm9uZU5hbWVzLmpvaW4oJyMnKTtcbiAgICBsZXQgc2tpbiA9IGdsYlNraW5zLmdldChrZXkpO1xuICAgIGlmICghc2tpbikge1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgc2tpbiBhbmQgYWRkIGl0IHRvIHRoZSBjYWNoZVxuICAgICAgICBza2luID0gbmV3IFNraW4oZGV2aWNlLCBpYnAsIGJvbmVOYW1lcyk7XG4gICAgICAgIGdsYlNraW5zLnNldChrZXksIHNraW4pO1xuICAgIH1cblxuICAgIHJldHVybiBza2luO1xufTtcblxuY29uc3QgY3JlYXRlRHJhY29NZXNoID0gKGRldmljZSwgcHJpbWl0aXZlLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBwcm9taXNlcykgPT4ge1xuICAgIC8vIGNyZWF0ZSB0aGUgbWVzaFxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBNZXNoKGRldmljZSk7XG4gICAgcmVzdWx0LmFhYmIgPSBnZXRBY2Nlc3NvckJvdW5kaW5nQm94KGFjY2Vzc29yc1twcmltaXRpdmUuYXR0cmlidXRlcy5QT1NJVElPTl0pO1xuXG4gICAgLy8gY3JlYXRlIHZlcnRleCBkZXNjcmlwdGlvblxuICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBpbmRleF0gb2YgT2JqZWN0LmVudHJpZXMocHJpbWl0aXZlLmF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIGNvbnN0IGFjY2Vzc29yID0gYWNjZXNzb3JzW2luZGV4XTtcbiAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFtuYW1lXTtcbiAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IGdldENvbXBvbmVudFR5cGUoYWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG5cbiAgICAgICAgdmVydGV4RGVzYy5wdXNoKHtcbiAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgIGNvbXBvbmVudHM6IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSksXG4gICAgICAgICAgICB0eXBlOiBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgbm9ybWFsaXplOiBhY2Nlc3Nvci5ub3JtYWxpemVkID8/IChzZW1hbnRpYyA9PT0gU0VNQU5USUNfQ09MT1IgJiYgKGNvbXBvbmVudFR5cGUgPT09IFRZUEVfVUlOVDggfHwgY29tcG9uZW50VHlwZSA9PT0gVFlQRV9VSU5UMTYpKVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBkcmFjbyBkZWNvbXByZXNzb3Igd2lsbCBnZW5lcmF0ZSBub3JtYWxzIGlmIHRoZXkgYXJlIG1pc3NpbmdcbiAgICBpZiAoIXByaW1pdGl2ZT8uYXR0cmlidXRlcz8uTk9STUFMKSB7XG4gICAgICAgIHZlcnRleERlc2MucHVzaCh7XG4gICAgICAgICAgICBzZW1hbnRpYzogJ05PUk1BTCcsXG4gICAgICAgICAgICBjb21wb25lbnRzOiAzLFxuICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIHNvcnQgdmVydGV4IGVsZW1lbnRzIGJ5IGVuZ2luZS1pZGVhbCBvcmRlclxuICAgIHZlcnRleERlc2Muc29ydCgobGhzLCByaHMpID0+IHtcbiAgICAgICAgcmV0dXJuIGF0dHJpYnV0ZU9yZGVyW2xocy5zZW1hbnRpY10gLSBhdHRyaWJ1dGVPcmRlcltyaHMuc2VtYW50aWNdO1xuICAgIH0pO1xuXG4gICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdChkZXZpY2UsIHZlcnRleERlc2MpO1xuXG4gICAgcHJvbWlzZXMucHVzaChuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIC8vIGRlY29kZSBkcmFjbyBkYXRhXG4gICAgICAgIGNvbnN0IGRyYWNvRXh0ID0gcHJpbWl0aXZlLmV4dGVuc2lvbnMuS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb247XG4gICAgICAgIGRyYWNvRGVjb2RlKGJ1ZmZlclZpZXdzW2RyYWNvRXh0LmJ1ZmZlclZpZXddLnNsaWNlKCkuYnVmZmVyLCAoZXJyLCBkZWNvbXByZXNzZWREYXRhKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIHZlcnRleCBidWZmZXJcbiAgICAgICAgICAgICAgICBjb25zdCBudW1WZXJ0aWNlcyA9IGRlY29tcHJlc3NlZERhdGEudmVydGljZXMuYnl0ZUxlbmd0aCAvIHZlcnRleEZvcm1hdC5zaXplO1xuICAgICAgICAgICAgICAgIERlYnVnLmFzc2VydChudW1WZXJ0aWNlcyA9PT0gYWNjZXNzb3JzW3ByaW1pdGl2ZS5hdHRyaWJ1dGVzLlBPU0lUSU9OXS5jb3VudCwgJ21lc2ggaGFzIGludmFsaWQgZHJhY28gc2l6ZXMnKTtcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKGRldmljZSwgdmVydGV4Rm9ybWF0LCBudW1WZXJ0aWNlcywgQlVGRkVSX1NUQVRJQywgZGVjb21wcmVzc2VkRGF0YS52ZXJ0aWNlcyk7XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgaW5kZXggYnVmZmVyXG4gICAgICAgICAgICAgICAgY29uc3QgbnVtSW5kaWNlcyA9IGFjY2Vzc29yc1twcmltaXRpdmUuaW5kaWNlc10uY291bnQ7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhGb3JtYXQgPSBudW1WZXJ0aWNlcyA8PSA2NTUzNSA/IElOREVYRk9STUFUX1VJTlQxNiA6IElOREVYRk9STUFUX1VJTlQzMjtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRleEJ1ZmZlciA9IG5ldyBJbmRleEJ1ZmZlcihkZXZpY2UsIGluZGV4Rm9ybWF0LCBudW1JbmRpY2VzLCBCVUZGRVJfU1RBVElDLCBkZWNvbXByZXNzZWREYXRhLmluZGljZXMpO1xuXG4gICAgICAgICAgICAgICAgcmVzdWx0LnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcbiAgICAgICAgICAgICAgICByZXN1bHQuaW5kZXhCdWZmZXJbMF0gPSBpbmRleEJ1ZmZlcjtcbiAgICAgICAgICAgICAgICByZXN1bHQucHJpbWl0aXZlWzBdLnR5cGUgPSBnZXRQcmltaXRpdmVUeXBlKHByaW1pdGl2ZSk7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnByaW1pdGl2ZVswXS5iYXNlID0gMDtcbiAgICAgICAgICAgICAgICByZXN1bHQucHJpbWl0aXZlWzBdLmNvdW50ID0gaW5kZXhCdWZmZXIgPyBudW1JbmRpY2VzIDogbnVtVmVydGljZXM7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnByaW1pdGl2ZVswXS5pbmRleGVkID0gISFpbmRleEJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfSkpO1xuXG4gICAgLy8gaGFuZGxlIG1hdGVyaWFsIHZhcmlhbnRzXG4gICAgaWYgKHByaW1pdGl2ZT8uZXh0ZW5zaW9ucz8uS0hSX21hdGVyaWFsc192YXJpYW50cykge1xuICAgICAgICBjb25zdCB2YXJpYW50cyA9IHByaW1pdGl2ZS5leHRlbnNpb25zLktIUl9tYXRlcmlhbHNfdmFyaWFudHM7XG4gICAgICAgIGNvbnN0IHRlbXBNYXBwaW5nID0ge307XG4gICAgICAgIHZhcmlhbnRzLm1hcHBpbmdzLmZvckVhY2goKG1hcHBpbmcpID0+IHtcbiAgICAgICAgICAgIG1hcHBpbmcudmFyaWFudHMuZm9yRWFjaCgodmFyaWFudCkgPT4ge1xuICAgICAgICAgICAgICAgIHRlbXBNYXBwaW5nW3ZhcmlhbnRdID0gbWFwcGluZy5tYXRlcmlhbDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgbWVzaFZhcmlhbnRzW3Jlc3VsdC5pZF0gPSB0ZW1wTWFwcGluZztcbiAgICB9XG4gICAgbWVzaERlZmF1bHRNYXRlcmlhbHNbcmVzdWx0LmlkXSA9IHByaW1pdGl2ZS5tYXRlcmlhbDtcblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5jb25zdCBjcmVhdGVNZXNoID0gKGRldmljZSwgZ2x0Zk1lc2gsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0LCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBhc3NldE9wdGlvbnMsIHByb21pc2VzKSA9PiB7XG4gICAgY29uc3QgbWVzaGVzID0gW107XG5cbiAgICBnbHRmTWVzaC5wcmltaXRpdmVzLmZvckVhY2goKHByaW1pdGl2ZSkgPT4ge1xuXG4gICAgICAgIGlmIChwcmltaXRpdmUuZXh0ZW5zaW9ucz8uS0hSX2RyYWNvX21lc2hfY29tcHJlc3Npb24pIHtcbiAgICAgICAgICAgIC8vIGhhbmRsZSBkcmFjbyBjb21wcmVzc2VkIG1lc2hcbiAgICAgICAgICAgIG1lc2hlcy5wdXNoKGNyZWF0ZURyYWNvTWVzaChkZXZpY2UsIHByaW1pdGl2ZSwgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbWVzaFZhcmlhbnRzLCBtZXNoRGVmYXVsdE1hdGVyaWFscywgcHJvbWlzZXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGhhbmRsZSB1bmNvbXByZXNzZWQgbWVzaFxuICAgICAgICAgICAgbGV0IGluZGljZXMgPSBwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ2luZGljZXMnKSA/IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvcnNbcHJpbWl0aXZlLmluZGljZXNdLCBidWZmZXJWaWV3cywgdHJ1ZSkgOiBudWxsO1xuICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gY3JlYXRlVmVydGV4QnVmZmVyKGRldmljZSwgcHJpbWl0aXZlLmF0dHJpYnV0ZXMsIGluZGljZXMsIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIGZsaXBWLCB2ZXJ0ZXhCdWZmZXJEaWN0KTtcbiAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZVR5cGUgPSBnZXRQcmltaXRpdmVUeXBlKHByaW1pdGl2ZSk7XG5cbiAgICAgICAgICAgIC8vIGJ1aWxkIHRoZSBtZXNoXG4gICAgICAgICAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICAgICAgICAgIG1lc2gudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0udHlwZSA9IHByaW1pdGl2ZVR5cGU7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5iYXNlID0gMDtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSAoaW5kaWNlcyAhPT0gbnVsbCk7XG5cbiAgICAgICAgICAgIC8vIGluZGV4IGJ1ZmZlclxuICAgICAgICAgICAgaWYgKGluZGljZXMgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBsZXQgaW5kZXhGb3JtYXQ7XG4gICAgICAgICAgICAgICAgaWYgKGluZGljZXMgaW5zdGFuY2VvZiBVaW50OEFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDg7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpbmRpY2VzIGluc3RhbmNlb2YgVWludDE2QXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMTY7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMzI7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gMzJiaXQgaW5kZXggYnVmZmVyIGlzIHVzZWQgYnV0IG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhGb3JtYXQgPT09IElOREVYRk9STUFUX1VJTlQzMiAmJiAhZGV2aWNlLmV4dFVpbnRFbGVtZW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgICAgICBpZiAodmVydGV4QnVmZmVyLm51bVZlcnRpY2VzID4gMHhGRkZGKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0dsYiBmaWxlIGNvbnRhaW5zIDMyYml0IGluZGV4IGJ1ZmZlciBidXQgdGhlc2UgYXJlIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBkZXZpY2UgLSBpdCBtYXkgYmUgcmVuZGVyZWQgaW5jb3JyZWN0bHkuJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29udmVydCB0byAxNmJpdFxuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgICAgICAgICAgICAgaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShpbmRpY2VzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhGb3JtYXQgPT09IElOREVYRk9STUFUX1VJTlQ4ICYmIGRldmljZS5pc1dlYkdQVSkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdHbGIgZmlsZSBjb250YWlucyA4Yml0IGluZGV4IGJ1ZmZlciBidXQgdGhlc2UgYXJlIG5vdCBzdXBwb3J0ZWQgYnkgV2ViR1BVIC0gY29udmVydGluZyB0byAxNmJpdC4nKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjb252ZXJ0IHRvIDE2Yml0XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KGluZGljZXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gbmV3IEluZGV4QnVmZmVyKGRldmljZSwgaW5kZXhGb3JtYXQsIGluZGljZXMubGVuZ3RoLCBCVUZGRVJfU1RBVElDLCBpbmRpY2VzKTtcbiAgICAgICAgICAgICAgICBtZXNoLmluZGV4QnVmZmVyWzBdID0gaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPSBpbmRpY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPSB2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoXCJleHRlbnNpb25zXCIpICYmIHByaW1pdGl2ZS5leHRlbnNpb25zLmhhc093blByb3BlcnR5KFwiS0hSX21hdGVyaWFsc192YXJpYW50c1wiKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhcmlhbnRzID0gcHJpbWl0aXZlLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cztcbiAgICAgICAgICAgICAgICBjb25zdCB0ZW1wTWFwcGluZyA9IHt9O1xuICAgICAgICAgICAgICAgIHZhcmlhbnRzLm1hcHBpbmdzLmZvckVhY2goKG1hcHBpbmcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbWFwcGluZy52YXJpYW50cy5mb3JFYWNoKCh2YXJpYW50KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wTWFwcGluZ1t2YXJpYW50XSA9IG1hcHBpbmcubWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIG1lc2hWYXJpYW50c1ttZXNoLmlkXSA9IHRlbXBNYXBwaW5nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtZXNoRGVmYXVsdE1hdGVyaWFsc1ttZXNoLmlkXSA9IHByaW1pdGl2ZS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgbGV0IGFjY2Vzc29yID0gYWNjZXNzb3JzW3ByaW1pdGl2ZS5hdHRyaWJ1dGVzLlBPU0lUSU9OXTtcbiAgICAgICAgICAgIG1lc2guYWFiYiA9IGdldEFjY2Vzc29yQm91bmRpbmdCb3goYWNjZXNzb3IpO1xuXG4gICAgICAgICAgICAvLyBtb3JwaCB0YXJnZXRzXG4gICAgICAgICAgICBpZiAocHJpbWl0aXZlLmhhc093blByb3BlcnR5KCd0YXJnZXRzJykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRzID0gW107XG5cbiAgICAgICAgICAgICAgICBwcmltaXRpdmUudGFyZ2V0cy5mb3JFYWNoKCh0YXJnZXQsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7fTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Lmhhc093blByb3BlcnR5KCdQT1NJVElPTicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2Nlc3NvciA9IGFjY2Vzc29yc1t0YXJnZXQuUE9TSVRJT05dO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YVBvc2l0aW9ucyA9IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoYWNjZXNzb3IsIGJ1ZmZlclZpZXdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFQb3NpdGlvbnNUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5hYWJiID0gZ2V0QWNjZXNzb3JCb3VuZGluZ0JveChhY2Nlc3Nvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Lmhhc093blByb3BlcnR5KCdOT1JNQUwnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbdGFyZ2V0Lk5PUk1BTF07XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOT1RFOiB0aGUgbW9ycGggdGFyZ2V0cyBjYW4ndCBjdXJyZW50bHkgYWNjZXB0IHF1YW50aXplZCBub3JtYWxzXG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhTm9ybWFscyA9IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoYWNjZXNzb3IsIGJ1ZmZlclZpZXdzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFOb3JtYWxzVHlwZSA9IFRZUEVfRkxPQVQzMjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIG5hbWUgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTWVzaC5oYXNPd25Qcm9wZXJ0eSgnZXh0cmFzJykgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZNZXNoLmV4dHJhcy5oYXNPd25Qcm9wZXJ0eSgndGFyZ2V0TmFtZXMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uYW1lID0gZ2x0Zk1lc2guZXh0cmFzLnRhcmdldE5hbWVzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMubmFtZSA9IGluZGV4LnRvU3RyaW5nKDEwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHQgd2VpZ2h0IGlmIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0Zk1lc2guaGFzT3duUHJvcGVydHkoJ3dlaWdodHMnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWZhdWx0V2VpZ2h0ID0gZ2x0Zk1lc2gud2VpZ2h0c1tpbmRleF07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnByZXNlcnZlRGF0YSA9IGFzc2V0T3B0aW9ucy5tb3JwaFByZXNlcnZlRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0cy5wdXNoKG5ldyBNb3JwaFRhcmdldChvcHRpb25zKSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBtZXNoLm1vcnBoID0gbmV3IE1vcnBoKHRhcmdldHMsIGRldmljZSwge1xuICAgICAgICAgICAgICAgICAgICBwcmVmZXJIaWdoUHJlY2lzaW9uOiBhc3NldE9wdGlvbnMubW9ycGhQcmVmZXJIaWdoUHJlY2lzaW9uXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBtZXNoZXMucHVzaChtZXNoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1lc2hlcztcbn07XG5cbmNvbnN0IGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtID0gKHNvdXJjZSwgbWF0ZXJpYWwsIG1hcHMpID0+IHtcbiAgICBsZXQgbWFwO1xuXG4gICAgY29uc3QgdGV4Q29vcmQgPSBzb3VyY2UudGV4Q29vcmQ7XG4gICAgaWYgKHRleENvb3JkKSB7XG4gICAgICAgIGZvciAobWFwID0gMDsgbWFwIDwgbWFwcy5sZW5ndGg7ICsrbWFwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbFttYXBzW21hcF0gKyAnTWFwVXYnXSA9IHRleENvb3JkO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgemVyb3MgPSBbMCwgMF07XG4gICAgY29uc3Qgb25lcyA9IFsxLCAxXTtcbiAgICBjb25zdCB0ZXh0dXJlVHJhbnNmb3JtID0gc291cmNlLmV4dGVuc2lvbnM/LktIUl90ZXh0dXJlX3RyYW5zZm9ybTtcbiAgICBpZiAodGV4dHVyZVRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBvZmZzZXQgPSB0ZXh0dXJlVHJhbnNmb3JtLm9mZnNldCB8fCB6ZXJvcztcbiAgICAgICAgY29uc3Qgc2NhbGUgPSB0ZXh0dXJlVHJhbnNmb3JtLnNjYWxlIHx8IG9uZXM7XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gdGV4dHVyZVRyYW5zZm9ybS5yb3RhdGlvbiA/ICgtdGV4dHVyZVRyYW5zZm9ybS5yb3RhdGlvbiAqIG1hdGguUkFEX1RPX0RFRykgOiAwO1xuXG4gICAgICAgIGNvbnN0IHRpbGluZ1ZlYyA9IG5ldyBWZWMyKHNjYWxlWzBdLCBzY2FsZVsxXSk7XG4gICAgICAgIGNvbnN0IG9mZnNldFZlYyA9IG5ldyBWZWMyKG9mZnNldFswXSwgMS4wIC0gc2NhbGVbMV0gLSBvZmZzZXRbMV0pO1xuXG4gICAgICAgIGZvciAobWFwID0gMDsgbWFwIDwgbWFwcy5sZW5ndGg7ICsrbWFwKSB7XG4gICAgICAgICAgICBtYXRlcmlhbFtgJHttYXBzW21hcF19TWFwVGlsaW5nYF0gPSB0aWxpbmdWZWM7XG4gICAgICAgICAgICBtYXRlcmlhbFtgJHttYXBzW21hcF19TWFwT2Zmc2V0YF0gPSBvZmZzZXRWZWM7XG4gICAgICAgICAgICBtYXRlcmlhbFtgJHttYXBzW21hcF19TWFwUm90YXRpb25gXSA9IHJvdGF0aW9uO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uUGJyU3BlY0dsb3NzaW5lc3MgPSAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSA9PiB7XG4gICAgbGV0IGNvbG9yLCB0ZXh0dXJlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdkaWZmdXNlRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBkYXRhLmRpZmZ1c2VGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldChNYXRoLnBvdyhjb2xvclswXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzFdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMl0sIDEgLyAyLjIpKTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IGNvbG9yWzNdO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDEsIDEsIDEpO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gMTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2RpZmZ1c2VUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgZGlmZnVzZVRleHR1cmUgPSBkYXRhLmRpZmZ1c2VUZXh0dXJlO1xuICAgICAgICB0ZXh0dXJlID0gdGV4dHVyZXNbZGlmZnVzZVRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSB0ZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwID0gdGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWwgPSAnYSc7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGlmZnVzZVRleHR1cmUsIG1hdGVyaWFsLCBbJ2RpZmZ1c2UnLCAnb3BhY2l0eSddKTtcbiAgICB9XG4gICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzID0gZmFsc2U7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBkYXRhLnNwZWN1bGFyRmFjdG9yO1xuICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2dsb3NzaW5lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5nbG9zcyA9IGRhdGEuZ2xvc3NpbmVzc0ZhY3RvcjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5nbG9zcyA9IDEuMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlID0gZGF0YS5zcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhckVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhck1hcCA9IG1hdGVyaWFsLmdsb3NzTWFwID0gdGV4dHVyZXNbc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICBtYXRlcmlhbC5nbG9zc01hcENoYW5uZWwgPSAnYSc7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZ2xvc3MnLCAnbWV0YWxuZXNzJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbkNsZWFyQ29hdCA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0RmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0ID0gZGF0YS5jbGVhcmNvYXRGYWN0b3IgKiAwLjI1OyAvLyBUT0RPOiByZW1vdmUgdGVtcG9yYXJ5IHdvcmthcm91bmQgZm9yIHJlcGxpY2F0aW5nIGdsVEYgY2xlYXItY29hdCB2aXN1YWxzXG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0ID0gMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXRUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXRUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXRUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0TWFwQ2hhbm5lbCA9ICdyJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXRUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXQnXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRSb3VnaG5lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zcyA9IGRhdGEuY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzID0gMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdFJvdWdobmVzc1RleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc01hcCA9IHRleHR1cmVzW2NsZWFyY29hdFJvdWdobmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc01hcENoYW5uZWwgPSAnZyc7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0R2xvc3MnXSk7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXROb3JtYWxUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSA9IGRhdGEuY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0Tm9ybWFsTWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSwgbWF0ZXJpYWwsIFsnY2xlYXJDb2F0Tm9ybWFsJ10pO1xuXG4gICAgICAgIGlmIChjbGVhcmNvYXROb3JtYWxUZXh0dXJlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRCdW1waW5lc3MgPSBjbGVhcmNvYXROb3JtYWxUZXh0dXJlLnNjYWxlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3NJbnZlcnQgPSB0cnVlO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uVW5saXQgPSAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSA9PiB7XG4gICAgbWF0ZXJpYWwudXNlTGlnaHRpbmcgPSBmYWxzZTtcblxuICAgIC8vIGNvcHkgZGlmZnVzZSBpbnRvIGVtaXNzaXZlXG4gICAgbWF0ZXJpYWwuZW1pc3NpdmUuY29weShtYXRlcmlhbC5kaWZmdXNlKTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSBtYXRlcmlhbC5kaWZmdXNlVGludDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcCA9IG1hdGVyaWFsLmRpZmZ1c2VNYXA7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBVdiA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBVdjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFRpbGluZy5jb3B5KG1hdGVyaWFsLmRpZmZ1c2VNYXBUaWxpbmcpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwT2Zmc2V0LmNvcHkobWF0ZXJpYWwuZGlmZnVzZU1hcE9mZnNldCk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBSb3RhdGlvbiA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBSb3RhdGlvbjtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcENoYW5uZWwgPSBtYXRlcmlhbC5kaWZmdXNlTWFwQ2hhbm5lbDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZVZlcnRleENvbG9yID0gbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVmVydGV4Q29sb3JDaGFubmVsID0gbWF0ZXJpYWwuZGlmZnVzZVZlcnRleENvbG9yQ2hhbm5lbDtcblxuICAgIC8vIGJsYW5rIGRpZmZ1c2VcbiAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgwLCAwLCAwKTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVGludCA9IGZhbHNlO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSBudWxsO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvciA9IGZhbHNlO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uU3BlY3VsYXIgPSAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSA9PiB7XG4gICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJFbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSB0ZXh0dXJlc1tkYXRhLnNwZWN1bGFyQ29sb3JUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXBDaGFubmVsID0gJ3JnYic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhckNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc3BlY3VsYXInXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JGYWN0b3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuc3BlY3VsYXJDb2xvckZhY3RvcjtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3RvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3IgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3JNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3Rvck1hcCA9IHRleHR1cmVzW2RhdGEuc3BlY3VsYXJUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NwZWN1bGFyaXR5RmFjdG9yJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklvciA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbkluZGV4ID0gMS4wIC8gZGF0YS5pb3I7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uVHJhbnNtaXNzaW9uID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICBtYXRlcmlhbC51c2VEeW5hbWljUmVmcmFjdGlvbiA9IHRydWU7XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbiA9IGRhdGEudHJhbnNtaXNzaW9uRmFjdG9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25NYXBDaGFubmVsID0gJ3InO1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uTWFwID0gdGV4dHVyZXNbZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLCBtYXRlcmlhbCwgWydyZWZyYWN0aW9uJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvblNoZWVuID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIG1hdGVyaWFsLnVzZVNoZWVuID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvckZhY3RvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5zaGVlbkNvbG9yRmFjdG9yO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW4uc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbk1hcCA9IHRleHR1cmVzW2RhdGEuc2hlZW5Db2xvclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNoZWVuQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydzaGVlbiddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zcyA9IGRhdGEuc2hlZW5Sb3VnaG5lc3NGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zcyA9IDAuMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnNoZWVuUm91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNoZWVuUm91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc2hlZW5HbG9zcyddKTtcbiAgICB9XG5cbiAgICBtYXRlcmlhbC5zaGVlbkdsb3NzSW52ZXJ0ID0gdHJ1ZTtcbn07XG5cbmNvbnN0IGV4dGVuc2lvblZvbHVtZSA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgbWF0ZXJpYWwudXNlRHluYW1pY1JlZnJhY3Rpb24gPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0aGlja25lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3MgPSBkYXRhLnRoaWNrbmVzc0ZhY3RvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3NNYXBDaGFubmVsID0gJ2cnO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnRoaWNrbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ3RoaWNrbmVzcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2F0dGVudWF0aW9uRGlzdGFuY2UnKSkge1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbkRpc3RhbmNlID0gZGF0YS5hdHRlbnVhdGlvbkRpc3RhbmNlO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXR0ZW51YXRpb25Db2xvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5hdHRlbnVhdGlvbkNvbG9yO1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uRW1pc3NpdmVTdHJlbmd0aCA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVTdHJlbmd0aCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlSW50ZW5zaXR5ID0gZGF0YS5lbWlzc2l2ZVN0cmVuZ3RoO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklyaWRlc2NlbmNlID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIG1hdGVyaWFsLnVzZUlyaWRlc2NlbmNlID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZSA9IGRhdGEuaXJpZGVzY2VuY2VGYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZU1hcENoYW5uZWwgPSAncic7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2UnXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlSW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXggPSBkYXRhLmlyaWRlc2NlbmNlSW9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNaW4gPSBkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzTWF4aW11bScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4ID0gZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW07XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01hcENoYW5uZWwgPSAnZyc7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2VUaGlja25lc3MnXSk7XG4gICAgfVxufTtcblxuY29uc3QgY3JlYXRlTWF0ZXJpYWwgPSAoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpID0+IHtcbiAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG5cbiAgICAvLyBnbFRGIGRvZXNuJ3QgZGVmaW5lIGhvdyB0byBvY2NsdWRlIHNwZWN1bGFyXG4gICAgbWF0ZXJpYWwub2NjbHVkZVNwZWN1bGFyID0gU1BFQ09DQ19BTztcblxuICAgIG1hdGVyaWFsLmRpZmZ1c2VUaW50ID0gdHJ1ZTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3IgPSB0cnVlO1xuXG4gICAgbWF0ZXJpYWwuc3BlY3VsYXJUaW50ID0gdHJ1ZTtcbiAgICBtYXRlcmlhbC5zcGVjdWxhclZlcnRleENvbG9yID0gdHJ1ZTtcblxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ25hbWUnKSkge1xuICAgICAgICBtYXRlcmlhbC5uYW1lID0gZ2x0Zk1hdGVyaWFsLm5hbWU7XG4gICAgfVxuXG4gICAgbGV0IGNvbG9yLCB0ZXh0dXJlO1xuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ3Bick1ldGFsbGljUm91Z2huZXNzJykpIHtcbiAgICAgICAgY29uc3QgcGJyRGF0YSA9IGdsdGZNYXRlcmlhbC5wYnJNZXRhbGxpY1JvdWdobmVzcztcblxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnYmFzZUNvbG9yRmFjdG9yJykpIHtcbiAgICAgICAgICAgIGNvbG9yID0gcGJyRGF0YS5iYXNlQ29sb3JGYWN0b3I7XG4gICAgICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IGNvbG9yWzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnYmFzZUNvbG9yVGV4dHVyZScpKSB7XG4gICAgICAgICAgICBjb25zdCBiYXNlQ29sb3JUZXh0dXJlID0gcGJyRGF0YS5iYXNlQ29sb3JUZXh0dXJlO1xuICAgICAgICAgICAgdGV4dHVyZSA9IHRleHR1cmVzW2Jhc2VDb2xvclRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwID0gdGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwID0gdGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShiYXNlQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydkaWZmdXNlJywgJ29wYWNpdHknXSk7XG4gICAgICAgIH1cbiAgICAgICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnbWV0YWxsaWNGYWN0b3InKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzID0gcGJyRGF0YS5tZXRhbGxpY0ZhY3RvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzcyA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ3JvdWdobmVzc0ZhY3RvcicpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zcyA9IHBickRhdGEucm91Z2huZXNzRmFjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuZ2xvc3MgPSAxO1xuICAgICAgICB9XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzSW52ZXJ0ID0gdHJ1ZTtcbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ21ldGFsbGljUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUgPSBwYnJEYXRhLm1ldGFsbGljUm91Z2huZXNzVGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcCA9IG1hdGVyaWFsLmdsb3NzTWFwID0gdGV4dHVyZXNbbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcENoYW5uZWwgPSAnYic7XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zc01hcENoYW5uZWwgPSAnZyc7XG5cbiAgICAgICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG1ldGFsbGljUm91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZ2xvc3MnLCAnbWV0YWxuZXNzJ10pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnbm9ybWFsVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IG5vcm1hbFRleHR1cmUgPSBnbHRmTWF0ZXJpYWwubm9ybWFsVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwubm9ybWFsTWFwID0gdGV4dHVyZXNbbm9ybWFsVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0obm9ybWFsVGV4dHVyZSwgbWF0ZXJpYWwsIFsnbm9ybWFsJ10pO1xuXG4gICAgICAgIGlmIChub3JtYWxUZXh0dXJlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5idW1waW5lc3MgPSBub3JtYWxUZXh0dXJlLnNjYWxlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ29jY2x1c2lvblRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBvY2NsdXNpb25UZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLm9jY2x1c2lvblRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmFvTWFwID0gdGV4dHVyZXNbb2NjbHVzaW9uVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmFvTWFwQ2hhbm5lbCA9ICdyJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShvY2NsdXNpb25UZXh0dXJlLCBtYXRlcmlhbCwgWydhbyddKTtcbiAgICAgICAgLy8gVE9ETzogc3VwcG9ydCAnc3RyZW5ndGgnXG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBnbHRmTWF0ZXJpYWwuZW1pc3NpdmVGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmUuc2V0KDAsIDAsIDApO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgZW1pc3NpdmVUZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLmVtaXNzaXZlVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSB0ZXh0dXJlc1tlbWlzc2l2ZVRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGVtaXNzaXZlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZW1pc3NpdmUnXSk7XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2FscGhhTW9kZScpKSB7XG4gICAgICAgIHN3aXRjaCAoZ2x0Zk1hdGVyaWFsLmFscGhhTW9kZSkge1xuICAgICAgICAgICAgY2FzZSAnTUFTSyc6XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdhbHBoYUN1dG9mZicpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFscGhhVGVzdCA9IGdsdGZNYXRlcmlhbC5hbHBoYUN1dG9mZjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbHBoYVRlc3QgPSAwLjU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnQkxFTkQnOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICAgICAgICAgICAgICAvLyBub3RlOiBieSBkZWZhdWx0IGRvbid0IHdyaXRlIGRlcHRoIG9uIHNlbWl0cmFuc3BhcmVudCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5kZXB0aFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgY2FzZSAnT1BBUVVFJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT05FO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdkb3VibGVTaWRlZCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLnR3b1NpZGVkTGlnaHRpbmcgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQ7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQgPyBDVUxMRkFDRV9OT05FIDogQ1VMTEZBQ0VfQkFDSztcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC50d29TaWRlZExpZ2h0aW5nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9CQUNLO1xuICAgIH1cblxuICAgIC8vIFByb3ZpZGUgbGlzdCBvZiBzdXBwb3J0ZWQgZXh0ZW5zaW9ucyBhbmQgdGhlaXIgZnVuY3Rpb25zXG4gICAgY29uc3QgZXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2NsZWFyY29hdFwiOiBleHRlbnNpb25DbGVhckNvYXQsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19lbWlzc2l2ZV9zdHJlbmd0aFwiOiBleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfaW9yXCI6IGV4dGVuc2lvbklvcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2lyaWRlc2NlbmNlXCI6IGV4dGVuc2lvbklyaWRlc2NlbmNlLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfcGJyU3BlY3VsYXJHbG9zc2luZXNzXCI6IGV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfc2hlZW5cIjogZXh0ZW5zaW9uU2hlZW4sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19zcGVjdWxhclwiOiBleHRlbnNpb25TcGVjdWxhcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3RyYW5zbWlzc2lvblwiOiBleHRlbnNpb25UcmFuc21pc3Npb24sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc191bmxpdFwiOiBleHRlbnNpb25VbmxpdCxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3ZvbHVtZVwiOiBleHRlbnNpb25Wb2x1bWVcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIGV4dGVuc2lvbnNcbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZ2x0Zk1hdGVyaWFsLmV4dGVuc2lvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbkZ1bmMgPSBleHRlbnNpb25zW2tleV07XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uRnVuYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZXh0ZW5zaW9uRnVuYyhnbHRmTWF0ZXJpYWwuZXh0ZW5zaW9uc1trZXldLCBtYXRlcmlhbCwgdGV4dHVyZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICByZXR1cm4gbWF0ZXJpYWw7XG59O1xuXG4vLyBjcmVhdGUgdGhlIGFuaW0gc3RydWN0dXJlXG5jb25zdCBjcmVhdGVBbmltYXRpb24gPSAoZ2x0ZkFuaW1hdGlvbiwgYW5pbWF0aW9uSW5kZXgsIGdsdGZBY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgbWVzaGVzLCBnbHRmTm9kZXMpID0+IHtcblxuICAgIC8vIGNyZWF0ZSBhbmltYXRpb24gZGF0YSBibG9jayBmb3IgdGhlIGFjY2Vzc29yXG4gICAgY29uc3QgY3JlYXRlQW5pbURhdGEgPSAoZ2x0ZkFjY2Vzc29yKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgQW5pbURhdGEoZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSksIGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykpO1xuICAgIH07XG5cbiAgICBjb25zdCBpbnRlcnBNYXAgPSB7XG4gICAgICAgICdTVEVQJzogSU5URVJQT0xBVElPTl9TVEVQLFxuICAgICAgICAnTElORUFSJzogSU5URVJQT0xBVElPTl9MSU5FQVIsXG4gICAgICAgICdDVUJJQ1NQTElORSc6IElOVEVSUE9MQVRJT05fQ1VCSUNcbiAgICB9O1xuXG4gICAgLy8gSW5wdXQgYW5kIG91dHB1dCBtYXBzIHJlZmVyZW5jZSBkYXRhIGJ5IHNhbXBsZXIgaW5wdXQvb3V0cHV0IGtleS5cbiAgICBjb25zdCBpbnB1dE1hcCA9IHsgfTtcbiAgICBjb25zdCBvdXRwdXRNYXAgPSB7IH07XG4gICAgLy8gVGhlIGN1cnZlIG1hcCBzdG9yZXMgdGVtcG9yYXJ5IGN1cnZlIGRhdGEgYnkgc2FtcGxlciBpbmRleC4gRWFjaCBjdXJ2ZXMgaW5wdXQvb3V0cHV0IHZhbHVlIHdpbGwgYmUgcmVzb2x2ZWQgdG8gYW4gaW5wdXRzL291dHB1dHMgYXJyYXkgaW5kZXggYWZ0ZXIgYWxsIHNhbXBsZXJzIGhhdmUgYmVlbiBwcm9jZXNzZWQuXG4gICAgLy8gQ3VydmVzIGFuZCBvdXRwdXRzIHRoYXQgYXJlIGRlbGV0ZWQgZnJvbSB0aGVpciBtYXBzIHdpbGwgbm90IGJlIGluY2x1ZGVkIGluIHRoZSBmaW5hbCBBbmltVHJhY2tcbiAgICBjb25zdCBjdXJ2ZU1hcCA9IHsgfTtcbiAgICBsZXQgb3V0cHV0Q291bnRlciA9IDE7XG5cbiAgICBsZXQgaTtcblxuICAgIC8vIGNvbnZlcnQgc2FtcGxlcnNcbiAgICBmb3IgKGkgPSAwOyBpIDwgZ2x0ZkFuaW1hdGlvbi5zYW1wbGVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBzYW1wbGVyID0gZ2x0ZkFuaW1hdGlvbi5zYW1wbGVyc1tpXTtcblxuICAgICAgICAvLyBnZXQgaW5wdXQgZGF0YVxuICAgICAgICBpZiAoIWlucHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIuaW5wdXQpKSB7XG4gICAgICAgICAgICBpbnB1dE1hcFtzYW1wbGVyLmlucHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5pbnB1dF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG91dHB1dCBkYXRhXG4gICAgICAgIGlmICghb3V0cHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIub3V0cHV0KSkge1xuICAgICAgICAgICAgb3V0cHV0TWFwW3NhbXBsZXIub3V0cHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5vdXRwdXRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGludGVycG9sYXRpb24gPVxuICAgICAgICAgICAgc2FtcGxlci5oYXNPd25Qcm9wZXJ0eSgnaW50ZXJwb2xhdGlvbicpICYmXG4gICAgICAgICAgICBpbnRlcnBNYXAuaGFzT3duUHJvcGVydHkoc2FtcGxlci5pbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgaW50ZXJwTWFwW3NhbXBsZXIuaW50ZXJwb2xhdGlvbl0gOiBJTlRFUlBPTEFUSU9OX0xJTkVBUjtcblxuICAgICAgICAvLyBjcmVhdGUgY3VydmVcbiAgICAgICAgY29uc3QgY3VydmUgPSB7XG4gICAgICAgICAgICBwYXRoczogW10sXG4gICAgICAgICAgICBpbnB1dDogc2FtcGxlci5pbnB1dCxcbiAgICAgICAgICAgIG91dHB1dDogc2FtcGxlci5vdXRwdXQsXG4gICAgICAgICAgICBpbnRlcnBvbGF0aW9uOiBpbnRlcnBvbGF0aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgY3VydmVNYXBbaV0gPSBjdXJ2ZTtcbiAgICB9XG5cbiAgICBjb25zdCBxdWF0QXJyYXlzID0gW107XG5cbiAgICBjb25zdCB0cmFuc2Zvcm1TY2hlbWEgPSB7XG4gICAgICAgICd0cmFuc2xhdGlvbic6ICdsb2NhbFBvc2l0aW9uJyxcbiAgICAgICAgJ3JvdGF0aW9uJzogJ2xvY2FsUm90YXRpb24nLFxuICAgICAgICAnc2NhbGUnOiAnbG9jYWxTY2FsZSdcbiAgICB9O1xuXG4gICAgY29uc3QgY29uc3RydWN0Tm9kZVBhdGggPSAobm9kZSkgPT4ge1xuICAgICAgICBjb25zdCBwYXRoID0gW107XG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBwYXRoLnVuc2hpZnQobm9kZS5uYW1lKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnBhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICB9O1xuXG4gICAgLy8gQWxsIG1vcnBoIHRhcmdldHMgYXJlIGluY2x1ZGVkIGluIGEgc2luZ2xlIGNoYW5uZWwgb2YgdGhlIGFuaW1hdGlvbiwgd2l0aCBhbGwgdGFyZ2V0cyBvdXRwdXQgZGF0YSBpbnRlcmxlYXZlZCB3aXRoIGVhY2ggb3RoZXIuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzcGxpdHMgZWFjaCBtb3JwaCB0YXJnZXQgb3V0IGludG8gaXQgYSBjdXJ2ZSB3aXRoIGl0cyBvd24gb3V0cHV0IGRhdGEsIGFsbG93aW5nIHVzIHRvIGFuaW1hdGUgZWFjaCBtb3JwaCB0YXJnZXQgaW5kZXBlbmRlbnRseSBieSBuYW1lLlxuICAgIGNvbnN0IGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzID0gKGN1cnZlLCBnbHRmTm9kZSwgZW50aXR5UGF0aCkgPT4ge1xuICAgICAgICBjb25zdCBvdXQgPSBvdXRwdXRNYXBbY3VydmUub3V0cHV0XTtcbiAgICAgICAgaWYgKCFvdXQpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGdsYi1wYXJzZXI6IE5vIG91dHB1dCBkYXRhIGlzIGF2YWlsYWJsZSBmb3IgdGhlIG1vcnBoIHRhcmdldCBjdXJ2ZSAoJHtlbnRpdHlQYXRofS9ncmFwaC93ZWlnaHRzKS4gU2tpcHBpbmcuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBuYW1lcyBvZiBtb3JwaCB0YXJnZXRzXG4gICAgICAgIGxldCB0YXJnZXROYW1lcztcbiAgICAgICAgaWYgKG1lc2hlcyAmJiBtZXNoZXNbZ2x0Zk5vZGUubWVzaF0pIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoZXNbZ2x0Zk5vZGUubWVzaF07XG4gICAgICAgICAgICBpZiAobWVzaC5oYXNPd25Qcm9wZXJ0eSgnZXh0cmFzJykgJiYgbWVzaC5leHRyYXMuaGFzT3duUHJvcGVydHkoJ3RhcmdldE5hbWVzJykpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXROYW1lcyA9IG1lc2guZXh0cmFzLnRhcmdldE5hbWVzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb3V0RGF0YSA9IG91dC5kYXRhO1xuICAgICAgICBjb25zdCBtb3JwaFRhcmdldENvdW50ID0gb3V0RGF0YS5sZW5ndGggLyBpbnB1dE1hcFtjdXJ2ZS5pbnB1dF0uZGF0YS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGtleWZyYW1lQ291bnQgPSBvdXREYXRhLmxlbmd0aCAvIG1vcnBoVGFyZ2V0Q291bnQ7XG5cbiAgICAgICAgLy8gc2luZ2xlIGFycmF5IGJ1ZmZlciBmb3IgYWxsIGtleXMsIDQgYnl0ZXMgcGVyIGVudHJ5XG4gICAgICAgIGNvbnN0IHNpbmdsZUJ1ZmZlclNpemUgPSBrZXlmcmFtZUNvdW50ICogNDtcbiAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKHNpbmdsZUJ1ZmZlclNpemUgKiBtb3JwaFRhcmdldENvdW50KTtcblxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1vcnBoVGFyZ2V0Q291bnQ7IGorKykge1xuICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRPdXRwdXQgPSBuZXcgRmxvYXQzMkFycmF5KGJ1ZmZlciwgc2luZ2xlQnVmZmVyU2l6ZSAqIGosIGtleWZyYW1lQ291bnQpO1xuXG4gICAgICAgICAgICAvLyB0aGUgb3V0cHV0IGRhdGEgZm9yIGFsbCBtb3JwaCB0YXJnZXRzIGluIGEgc2luZ2xlIGN1cnZlIGlzIGludGVybGVhdmVkLiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBrZXlmcmFtZSBvdXRwdXQgZGF0YSBmb3IgYSBzaW5nbGUgbW9ycGggdGFyZ2V0XG4gICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGtleWZyYW1lQ291bnQ7IGsrKykge1xuICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0T3V0cHV0W2tdID0gb3V0RGF0YVtrICogbW9ycGhUYXJnZXRDb3VudCArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gbmV3IEFuaW1EYXRhKDEsIG1vcnBoVGFyZ2V0T3V0cHV0KTtcbiAgICAgICAgICAgIGNvbnN0IHdlaWdodE5hbWUgPSB0YXJnZXROYW1lcz8uW2pdID8gYG5hbWUuJHt0YXJnZXROYW1lc1tqXX1gIDogajtcblxuICAgICAgICAgICAgLy8gYWRkIHRoZSBpbmRpdmlkdWFsIG1vcnBoIHRhcmdldCBvdXRwdXQgZGF0YSB0byB0aGUgb3V0cHV0TWFwIHVzaW5nIGEgbmVnYXRpdmUgdmFsdWUga2V5IChzbyBhcyBub3QgdG8gY2xhc2ggd2l0aCBzYW1wbGVyLm91dHB1dCB2YWx1ZXMpXG4gICAgICAgICAgICBvdXRwdXRNYXBbLW91dHB1dENvdW50ZXJdID0gb3V0cHV0O1xuICAgICAgICAgICAgY29uc3QgbW9ycGhDdXJ2ZSA9IHtcbiAgICAgICAgICAgICAgICBwYXRoczogW3tcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5UGF0aDogZW50aXR5UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50OiAnZ3JhcGgnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6IFtgd2VpZ2h0LiR7d2VpZ2h0TmFtZX1gXVxuICAgICAgICAgICAgICAgIH1dLFxuICAgICAgICAgICAgICAgIC8vIGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIGlucHV0IGNhbiB1c2UgdGhlIHNhbWUgc2FtcGxlci5pbnB1dCBmcm9tIHRoZSBjaGFubmVsIHRoZXkgd2VyZSBhbGwgaW5cbiAgICAgICAgICAgICAgICBpbnB1dDogY3VydmUuaW5wdXQsXG4gICAgICAgICAgICAgICAgLy8gYnV0IGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIHNob3VsZCByZWZlcmVuY2UgaXRzIGluZGl2aWR1YWwgb3V0cHV0IHRoYXQgd2FzIGp1c3QgY3JlYXRlZFxuICAgICAgICAgICAgICAgIG91dHB1dDogLW91dHB1dENvdW50ZXIsXG4gICAgICAgICAgICAgICAgaW50ZXJwb2xhdGlvbjogY3VydmUuaW50ZXJwb2xhdGlvblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG91dHB1dENvdW50ZXIrKztcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgbW9ycGggdGFyZ2V0IGN1cnZlIHRvIHRoZSBjdXJ2ZU1hcFxuICAgICAgICAgICAgY3VydmVNYXBbYG1vcnBoQ3VydmUtJHtpfS0ke2p9YF0gPSBtb3JwaEN1cnZlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGNvbnZlcnQgYW5pbSBjaGFubmVsc1xuICAgIGZvciAoaSA9IDA7IGkgPCBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzW2ldO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBjaGFubmVsLnRhcmdldDtcbiAgICAgICAgY29uc3QgY3VydmUgPSBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdO1xuXG4gICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1t0YXJnZXQubm9kZV07XG4gICAgICAgIGNvbnN0IGdsdGZOb2RlID0gZ2x0Zk5vZGVzW3RhcmdldC5ub2RlXTtcbiAgICAgICAgY29uc3QgZW50aXR5UGF0aCA9IGNvbnN0cnVjdE5vZGVQYXRoKG5vZGUpO1xuXG4gICAgICAgIGlmICh0YXJnZXQucGF0aC5zdGFydHNXaXRoKCd3ZWlnaHRzJykpIHtcbiAgICAgICAgICAgIGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzKGN1cnZlLCBnbHRmTm9kZSwgZW50aXR5UGF0aCk7XG4gICAgICAgICAgICAvLyBhcyBhbGwgaW5kaXZpZHVhbCBtb3JwaCB0YXJnZXRzIGluIHRoaXMgbW9ycGggY3VydmUgaGF2ZSB0aGVpciBvd24gY3VydmUgbm93LCB0aGlzIG1vcnBoIGN1cnZlIHNob3VsZCBiZSBmbGFnZ2VkXG4gICAgICAgICAgICAvLyBzbyBpdCdzIG5vdCBpbmNsdWRlZCBpbiB0aGUgZmluYWwgb3V0cHV0XG4gICAgICAgICAgICBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdLm1vcnBoQ3VydmUgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3VydmUucGF0aHMucHVzaCh7XG4gICAgICAgICAgICAgICAgZW50aXR5UGF0aDogZW50aXR5UGF0aCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnQ6ICdncmFwaCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoOiBbdHJhbnNmb3JtU2NoZW1hW3RhcmdldC5wYXRoXV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaW5wdXRzID0gW107XG4gICAgY29uc3Qgb3V0cHV0cyA9IFtdO1xuICAgIGNvbnN0IGN1cnZlcyA9IFtdO1xuXG4gICAgLy8gQWRkIGVhY2ggaW5wdXQgaW4gdGhlIG1hcCB0byB0aGUgZmluYWwgaW5wdXRzIGFycmF5LiBUaGUgaW5wdXRNYXAgc2hvdWxkIG5vdyByZWZlcmVuY2UgdGhlIGluZGV4IG9mIGlucHV0IGluIHRoZSBpbnB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgaW5wdXQgaXRzZWxmLlxuICAgIGZvciAoY29uc3QgaW5wdXRLZXkgaW4gaW5wdXRNYXApIHtcbiAgICAgICAgaW5wdXRzLnB1c2goaW5wdXRNYXBbaW5wdXRLZXldKTtcbiAgICAgICAgaW5wdXRNYXBbaW5wdXRLZXldID0gaW5wdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIEFkZCBlYWNoIG91dHB1dCBpbiB0aGUgbWFwIHRvIHRoZSBmaW5hbCBvdXRwdXRzIGFycmF5LiBUaGUgb3V0cHV0TWFwIHNob3VsZCBub3cgcmVmZXJlbmNlIHRoZSBpbmRleCBvZiBvdXRwdXQgaW4gdGhlIG91dHB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgb3V0cHV0IGl0c2VsZi5cbiAgICBmb3IgKGNvbnN0IG91dHB1dEtleSBpbiBvdXRwdXRNYXApIHtcbiAgICAgICAgb3V0cHV0cy5wdXNoKG91dHB1dE1hcFtvdXRwdXRLZXldKTtcbiAgICAgICAgb3V0cHV0TWFwW291dHB1dEtleV0gPSBvdXRwdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIENyZWF0ZSBhbiBBbmltQ3VydmUgZm9yIGVhY2ggY3VydmUgb2JqZWN0IGluIHRoZSBjdXJ2ZU1hcC4gRWFjaCBjdXJ2ZSBvYmplY3QncyBpbnB1dCB2YWx1ZSBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gdGhlIGluZGV4IG9mIHRoZSBpbnB1dCBpbiB0aGVcbiAgICAvLyBpbnB1dHMgYXJyYXlzIHVzaW5nIHRoZSBpbnB1dE1hcC4gTGlrZXdpc2UgZm9yIG91dHB1dCB2YWx1ZXMuXG4gICAgZm9yIChjb25zdCBjdXJ2ZUtleSBpbiBjdXJ2ZU1hcCkge1xuICAgICAgICBjb25zdCBjdXJ2ZURhdGEgPSBjdXJ2ZU1hcFtjdXJ2ZUtleV07XG4gICAgICAgIC8vIGlmIHRoZSBjdXJ2ZURhdGEgY29udGFpbnMgYSBtb3JwaCBjdXJ2ZSB0aGVuIGRvIG5vdCBhZGQgaXQgdG8gdGhlIGZpbmFsIGN1cnZlIGxpc3QgYXMgdGhlIGluZGl2aWR1YWwgbW9ycGggdGFyZ2V0IGN1cnZlcyBhcmUgaW5jbHVkZWQgaW5zdGVhZFxuICAgICAgICBpZiAoY3VydmVEYXRhLm1vcnBoQ3VydmUpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGN1cnZlcy5wdXNoKG5ldyBBbmltQ3VydmUoXG4gICAgICAgICAgICBjdXJ2ZURhdGEucGF0aHMsXG4gICAgICAgICAgICBpbnB1dE1hcFtjdXJ2ZURhdGEuaW5wdXRdLFxuICAgICAgICAgICAgb3V0cHV0TWFwW2N1cnZlRGF0YS5vdXRwdXRdLFxuICAgICAgICAgICAgY3VydmVEYXRhLmludGVycG9sYXRpb25cbiAgICAgICAgKSk7XG5cbiAgICAgICAgLy8gaWYgdGhpcyB0YXJnZXQgaXMgYSBzZXQgb2YgcXVhdGVybmlvbiBrZXlzLCBtYWtlIG5vdGUgb2YgaXRzIGluZGV4IHNvIHdlIGNhbiBwZXJmb3JtXG4gICAgICAgIC8vIHF1YXRlcm5pb24tc3BlY2lmaWMgcHJvY2Vzc2luZyBvbiBpdC5cbiAgICAgICAgaWYgKGN1cnZlRGF0YS5wYXRocy5sZW5ndGggPiAwICYmIGN1cnZlRGF0YS5wYXRoc1swXS5wcm9wZXJ0eVBhdGhbMF0gPT09ICdsb2NhbFJvdGF0aW9uJyAmJiBjdXJ2ZURhdGEuaW50ZXJwb2xhdGlvbiAhPT0gSU5URVJQT0xBVElPTl9DVUJJQykge1xuICAgICAgICAgICAgcXVhdEFycmF5cy5wdXNoKGN1cnZlc1tjdXJ2ZXMubGVuZ3RoIC0gMV0ub3V0cHV0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdGhlIGxpc3Qgb2YgYXJyYXkgaW5kZXhlcyBzbyB3ZSBjYW4gc2tpcCBkdXBzXG4gICAgcXVhdEFycmF5cy5zb3J0KCk7XG5cbiAgICAvLyBydW4gdGhyb3VnaCB0aGUgcXVhdGVybmlvbiBkYXRhIGFycmF5cyBmbGlwcGluZyBxdWF0ZXJuaW9uIGtleXNcbiAgICAvLyB0aGF0IGRvbid0IGZhbGwgaW4gdGhlIHNhbWUgd2luZGluZyBvcmRlci5cbiAgICBsZXQgcHJldkluZGV4ID0gbnVsbDtcbiAgICBsZXQgZGF0YTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcXVhdEFycmF5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHF1YXRBcnJheXNbaV07XG4gICAgICAgIC8vIHNraXAgb3ZlciBkdXBsaWNhdGUgYXJyYXkgaW5kaWNlc1xuICAgICAgICBpZiAoaSA9PT0gMCB8fCBpbmRleCAhPT0gcHJldkluZGV4KSB7XG4gICAgICAgICAgICBkYXRhID0gb3V0cHV0c1tpbmRleF07XG4gICAgICAgICAgICBpZiAoZGF0YS5jb21wb25lbnRzID09PSA0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZCA9IGRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICBjb25zdCBsZW4gPSBkLmxlbmd0aCAtIDQ7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGogKz0gNCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkcCA9IGRbaiArIDBdICogZFtqICsgNF0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAxXSAqIGRbaiArIDVdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgMl0gKiBkW2ogKyA2XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDNdICogZFtqICsgN107XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRwIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNF0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA1XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDZdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgN10gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmV2SW5kZXggPSBpbmRleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSBkdXJhdGlvbiBvZiB0aGUgYW5pbWF0aW9uIGFzIG1heGltdW0gdGltZSB2YWx1ZVxuICAgIGxldCBkdXJhdGlvbiA9IDA7XG4gICAgZm9yIChpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkYXRhICA9IGlucHV0c1tpXS5fZGF0YTtcbiAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1heChkdXJhdGlvbiwgZGF0YS5sZW5ndGggPT09IDAgPyAwIDogZGF0YVtkYXRhLmxlbmd0aCAtIDFdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFuaW1UcmFjayhcbiAgICAgICAgZ2x0ZkFuaW1hdGlvbi5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpID8gZ2x0ZkFuaW1hdGlvbi5uYW1lIDogKCdhbmltYXRpb25fJyArIGFuaW1hdGlvbkluZGV4KSxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICAgICAgY3VydmVzKTtcbn07XG5cbmNvbnN0IHRlbXBNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3QgdGVtcFZlYyA9IG5ldyBWZWMzKCk7XG5cbmNvbnN0IGNyZWF0ZU5vZGUgPSAoZ2x0Zk5vZGUsIG5vZGVJbmRleCkgPT4ge1xuICAgIGNvbnN0IGVudGl0eSA9IG5ldyBHcmFwaE5vZGUoKTtcblxuICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpICYmIGdsdGZOb2RlLm5hbWUubGVuZ3RoID4gMCkge1xuICAgICAgICBlbnRpdHkubmFtZSA9IGdsdGZOb2RlLm5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW50aXR5Lm5hbWUgPSAnbm9kZV8nICsgbm9kZUluZGV4O1xuICAgIH1cblxuICAgIC8vIFBhcnNlIHRyYW5zZm9ybWF0aW9uIHByb3BlcnRpZXNcbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ21hdHJpeCcpKSB7XG4gICAgICAgIHRlbXBNYXQuZGF0YS5zZXQoZ2x0Zk5vZGUubWF0cml4KTtcbiAgICAgICAgdGVtcE1hdC5nZXRUcmFuc2xhdGlvbih0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUG9zaXRpb24odGVtcFZlYyk7XG4gICAgICAgIHRlbXBNYXQuZ2V0RXVsZXJBbmdsZXModGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbEV1bGVyQW5nbGVzKHRlbXBWZWMpO1xuICAgICAgICB0ZW1wTWF0LmdldFNjYWxlKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZSh0ZW1wVmVjKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3JvdGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgciA9IGdsdGZOb2RlLnJvdGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxSb3RhdGlvbihyWzBdLCByWzFdLCByWzJdLCByWzNdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3RyYW5zbGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgdCA9IGdsdGZOb2RlLnRyYW5zbGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxQb3NpdGlvbih0WzBdLCB0WzFdLCB0WzJdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgY29uc3QgcyA9IGdsdGZOb2RlLnNjYWxlO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZShzWzBdLCBzWzFdLCBzWzJdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW50aXR5O1xufTtcblxuLy8gY3JlYXRlcyBhIGNhbWVyYSBjb21wb25lbnQgb24gdGhlIHN1cHBsaWVkIG5vZGUsIGFuZCByZXR1cm5zIGl0XG5jb25zdCBjcmVhdGVDYW1lcmEgPSAoZ2x0ZkNhbWVyYSwgbm9kZSkgPT4ge1xuXG4gICAgY29uc3QgcHJvamVjdGlvbiA9IGdsdGZDYW1lcmEudHlwZSA9PT0gJ29ydGhvZ3JhcGhpYycgPyBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA6IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkU7XG4gICAgY29uc3QgZ2x0ZlByb3BlcnRpZXMgPSBwcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA/IGdsdGZDYW1lcmEub3J0aG9ncmFwaGljIDogZ2x0ZkNhbWVyYS5wZXJzcGVjdGl2ZTtcblxuICAgIGNvbnN0IGNvbXBvbmVudERhdGEgPSB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICBwcm9qZWN0aW9uOiBwcm9qZWN0aW9uLFxuICAgICAgICBuZWFyQ2xpcDogZ2x0ZlByb3BlcnRpZXMuem5lYXIsXG4gICAgICAgIGFzcGVjdFJhdGlvTW9kZTogQVNQRUNUX0FVVE9cbiAgICB9O1xuXG4gICAgaWYgKGdsdGZQcm9wZXJ0aWVzLnpmYXIpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5mYXJDbGlwID0gZ2x0ZlByb3BlcnRpZXMuemZhcjtcbiAgICB9XG5cbiAgICBpZiAocHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5vcnRob0hlaWdodCA9IDAuNSAqIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy55bWFnKSB7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvTW9kZSA9IEFTUEVDVF9NQU5VQUw7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvID0gZ2x0ZlByb3BlcnRpZXMueG1hZyAvIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBjb21wb25lbnREYXRhLmZvdiA9IGdsdGZQcm9wZXJ0aWVzLnlmb3YgKiBtYXRoLlJBRF9UT19ERUc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy5hc3BlY3RSYXRpbykge1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfTUFOVUFMO1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpbyA9IGdsdGZQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY2FtZXJhRW50aXR5ID0gbmV3IEVudGl0eShnbHRmQ2FtZXJhLm5hbWUpO1xuICAgIGNhbWVyYUVudGl0eS5hZGRDb21wb25lbnQoJ2NhbWVyYScsIGNvbXBvbmVudERhdGEpO1xuICAgIHJldHVybiBjYW1lcmFFbnRpdHk7XG59O1xuXG4vLyBjcmVhdGVzIGxpZ2h0IGNvbXBvbmVudCwgYWRkcyBpdCB0byB0aGUgbm9kZSBhbmQgcmV0dXJucyB0aGUgY3JlYXRlZCBsaWdodCBjb21wb25lbnRcbmNvbnN0IGNyZWF0ZUxpZ2h0ID0gKGdsdGZMaWdodCwgbm9kZSkgPT4ge1xuXG4gICAgY29uc3QgbGlnaHRQcm9wcyA9IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHR5cGU6IGdsdGZMaWdodC50eXBlID09PSAncG9pbnQnID8gJ29tbmknIDogZ2x0ZkxpZ2h0LnR5cGUsXG4gICAgICAgIGNvbG9yOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ2NvbG9yJykgPyBuZXcgQ29sb3IoZ2x0ZkxpZ2h0LmNvbG9yKSA6IENvbG9yLldISVRFLFxuXG4gICAgICAgIC8vIHdoZW4gcmFuZ2UgaXMgbm90IGRlZmluZWQsIGluZmluaXR5IHNob3VsZCBiZSB1c2VkIC0gYnV0IHRoYXQgaXMgY2F1c2luZyBpbmZpbml0eSBpbiBib3VuZHMgY2FsY3VsYXRpb25zXG4gICAgICAgIHJhbmdlOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3JhbmdlJykgPyBnbHRmTGlnaHQucmFuZ2UgOiA5OTk5LFxuXG4gICAgICAgIGZhbGxvZmZNb2RlOiBMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQsXG5cbiAgICAgICAgLy8gVE9ETzogKGVuZ2luZSBpc3N1ZSAjMzI1MikgU2V0IGludGVuc2l0eSB0byBtYXRjaCBnbFRGIHNwZWNpZmljYXRpb24sIHdoaWNoIHVzZXMgcGh5c2ljYWxseSBiYXNlZCB2YWx1ZXM6XG4gICAgICAgIC8vIC0gT21uaSBhbmQgc3BvdCBsaWdodHMgdXNlIGx1bWlub3VzIGludGVuc2l0eSBpbiBjYW5kZWxhIChsbS9zcilcbiAgICAgICAgLy8gLSBEaXJlY3Rpb25hbCBsaWdodHMgdXNlIGlsbHVtaW5hbmNlIGluIGx1eCAobG0vbTIpLlxuICAgICAgICAvLyBDdXJyZW50IGltcGxlbWVudGF0aW9uOiBjbGFwbXMgc3BlY2lmaWVkIGludGVuc2l0eSB0byAwLi4yIHJhbmdlXG4gICAgICAgIGludGVuc2l0eTogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdpbnRlbnNpdHknKSA/IG1hdGguY2xhbXAoZ2x0ZkxpZ2h0LmludGVuc2l0eSwgMCwgMikgOiAxXG4gICAgfTtcblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3Nwb3QnKSkge1xuICAgICAgICBsaWdodFByb3BzLmlubmVyQ29uZUFuZ2xlID0gZ2x0ZkxpZ2h0LnNwb3QuaGFzT3duUHJvcGVydHkoJ2lubmVyQ29uZUFuZ2xlJykgPyBnbHRmTGlnaHQuc3BvdC5pbm5lckNvbmVBbmdsZSAqIG1hdGguUkFEX1RPX0RFRyA6IDA7XG4gICAgICAgIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUgPSBnbHRmTGlnaHQuc3BvdC5oYXNPd25Qcm9wZXJ0eSgnb3V0ZXJDb25lQW5nbGUnKSA/IGdsdGZMaWdodC5zcG90Lm91dGVyQ29uZUFuZ2xlICogbWF0aC5SQURfVE9fREVHIDogTWF0aC5QSSAvIDQ7XG4gICAgfVxuXG4gICAgLy8gZ2xURiBzdG9yZXMgbGlnaHQgYWxyZWFkeSBpbiBlbmVyZ3kvYXJlYSwgYnV0IHdlIG5lZWQgdG8gcHJvdmlkZSB0aGUgbGlnaHQgd2l0aCBvbmx5IHRoZSBlbmVyZ3kgcGFyYW1ldGVyLFxuICAgIC8vIHNvIHdlIG5lZWQgdGhlIGludGVuc2l0aWVzIGluIGNhbmRlbGEgYmFjayB0byBsdW1lblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoXCJpbnRlbnNpdHlcIikpIHtcbiAgICAgICAgbGlnaHRQcm9wcy5sdW1pbmFuY2UgPSBnbHRmTGlnaHQuaW50ZW5zaXR5ICogTGlnaHQuZ2V0TGlnaHRVbml0Q29udmVyc2lvbihsaWdodFR5cGVzW2xpZ2h0UHJvcHMudHlwZV0sIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUsIGxpZ2h0UHJvcHMuaW5uZXJDb25lQW5nbGUpO1xuICAgIH1cblxuICAgIC8vIFJvdGF0ZSB0byBtYXRjaCBsaWdodCBvcmllbnRhdGlvbiBpbiBnbFRGIHNwZWNpZmljYXRpb25cbiAgICAvLyBOb3RlIHRoYXQgdGhpcyBhZGRzIGEgbmV3IGVudGl0eSBub2RlIGludG8gdGhlIGhpZXJhcmNoeSB0aGF0IGRvZXMgbm90IGV4aXN0IGluIHRoZSBnbHRmIGhpZXJhcmNoeVxuICAgIGNvbnN0IGxpZ2h0RW50aXR5ID0gbmV3IEVudGl0eShub2RlLm5hbWUpO1xuICAgIGxpZ2h0RW50aXR5LnJvdGF0ZUxvY2FsKDkwLCAwLCAwKTtcblxuICAgIC8vIGFkZCBjb21wb25lbnRcbiAgICBsaWdodEVudGl0eS5hZGRDb21wb25lbnQoJ2xpZ2h0JywgbGlnaHRQcm9wcyk7XG4gICAgcmV0dXJuIGxpZ2h0RW50aXR5O1xufTtcblxuY29uc3QgY3JlYXRlU2tpbnMgPSAoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld3MpID0+IHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ3NraW5zJykgfHwgZ2x0Zi5za2lucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8vIGNhY2hlIGZvciBza2lucyB0byBmaWx0ZXIgb3V0IGR1cGxpY2F0ZXNcbiAgICBjb25zdCBnbGJTa2lucyA9IG5ldyBNYXAoKTtcblxuICAgIHJldHVybiBnbHRmLnNraW5zLm1hcCgoZ2x0ZlNraW4pID0+IHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVNraW4oZGV2aWNlLCBnbHRmU2tpbiwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2xiU2tpbnMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlTWVzaGVzID0gKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIGZsaXBWLCBvcHRpb25zKSA9PiB7XG4gICAgLy8gZGljdGlvbmFyeSBvZiB2ZXJ0ZXggYnVmZmVycyB0byBhdm9pZCBkdXBsaWNhdGVzXG4gICAgY29uc3QgdmVydGV4QnVmZmVyRGljdCA9IHt9O1xuICAgIGNvbnN0IG1lc2hWYXJpYW50cyA9IHt9O1xuICAgIGNvbnN0IG1lc2hEZWZhdWx0TWF0ZXJpYWxzID0ge307XG4gICAgY29uc3QgcHJvbWlzZXMgPSBbXTtcblxuICAgIGNvbnN0IHZhbGlkID0gKCFvcHRpb25zLnNraXBNZXNoZXMgJiYgZ2x0Zj8ubWVzaGVzPy5sZW5ndGggJiYgZ2x0Zj8uYWNjZXNzb3JzPy5sZW5ndGggJiYgZ2x0Zj8uYnVmZmVyVmlld3M/Lmxlbmd0aCk7XG4gICAgY29uc3QgbWVzaGVzID0gdmFsaWQgPyBnbHRmLm1lc2hlcy5tYXAoKGdsdGZNZXNoKSA9PiB7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgZ2x0Zk1lc2gsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIG9wdGlvbnMsIHByb21pc2VzKTtcbiAgICB9KSA6IFtdO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbWVzaGVzLFxuICAgICAgICBtZXNoVmFyaWFudHMsXG4gICAgICAgIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLFxuICAgICAgICBwcm9taXNlc1xuICAgIH07XG59O1xuXG5jb25zdCBjcmVhdGVNYXRlcmlhbHMgPSAoZ2x0ZiwgdGV4dHVyZXMsIG9wdGlvbnMsIGZsaXBWKSA9PiB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdtYXRlcmlhbHMnKSB8fCBnbHRmLm1hdGVyaWFscy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5tYXRlcmlhbD8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucz8ubWF0ZXJpYWw/LnByb2Nlc3MgPz8gY3JlYXRlTWF0ZXJpYWw7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy5tYXRlcmlhbD8ucG9zdHByb2Nlc3M7XG5cbiAgICByZXR1cm4gZ2x0Zi5tYXRlcmlhbHMubWFwKChnbHRmTWF0ZXJpYWwpID0+IHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk1hdGVyaWFsKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHByb2Nlc3MoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZNYXRlcmlhbCwgbWF0ZXJpYWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZVZhcmlhbnRzID0gKGdsdGYpID0+IHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoXCJleHRlbnNpb25zXCIpIHx8ICFnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKVxuICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGRhdGEgPSBnbHRmLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cy52YXJpYW50cztcbiAgICBjb25zdCB2YXJpYW50cyA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXJpYW50c1tkYXRhW2ldLm5hbWVdID0gaTtcbiAgICB9XG4gICAgcmV0dXJuIHZhcmlhbnRzO1xufTtcblxuY29uc3QgY3JlYXRlQW5pbWF0aW9ucyA9IChnbHRmLCBub2RlcywgYnVmZmVyVmlld3MsIG9wdGlvbnMpID0+IHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ2FuaW1hdGlvbnMnKSB8fCBnbHRmLmFuaW1hdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8uYW5pbWF0aW9uPy5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uYW5pbWF0aW9uPy5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLmFuaW1hdGlvbnMubWFwKChnbHRmQW5pbWF0aW9uLCBpbmRleCkgPT4ge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQW5pbWF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbmltYXRpb24gPSBjcmVhdGVBbmltYXRpb24oZ2x0ZkFuaW1hdGlvbiwgaW5kZXgsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsdGYubWVzaGVzLCBnbHRmLm5vZGVzKTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQW5pbWF0aW9uLCBhbmltYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhbmltYXRpb247XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlcyA9IChnbHRmLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpIHx8IGdsdGYubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8ubm9kZT8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucz8ubm9kZT8ucHJvY2VzcyA/PyBjcmVhdGVOb2RlO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8ubm9kZT8ucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBub2RlcyA9IGdsdGYubm9kZXMubWFwKChnbHRmTm9kZSwgaW5kZXgpID0+IHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5vZGUgPSBwcm9jZXNzKGdsdGZOb2RlLCBpbmRleCk7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zk5vZGUsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH0pO1xuXG4gICAgLy8gYnVpbGQgbm9kZSBoaWVyYXJjaHlcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYubm9kZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0Zk5vZGUgPSBnbHRmLm5vZGVzW2ldO1xuICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NoaWxkcmVuJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgdW5pcXVlTmFtZXMgPSB7IH07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGdsdGZOb2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBub2Rlc1tnbHRmTm9kZS5jaGlsZHJlbltqXV07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZC5wYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVuaXF1ZU5hbWVzLmhhc093blByb3BlcnR5KGNoaWxkLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5uYW1lICs9IHVuaXF1ZU5hbWVzW2NoaWxkLm5hbWVdKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlxdWVOYW1lc1tjaGlsZC5uYW1lXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZXM7XG59O1xuXG5jb25zdCBjcmVhdGVTY2VuZXMgPSAoZ2x0Ziwgbm9kZXMpID0+IHtcbiAgICBjb25zdCBzY2VuZXMgPSBbXTtcbiAgICBjb25zdCBjb3VudCA9IGdsdGYuc2NlbmVzLmxlbmd0aDtcblxuICAgIC8vIGlmIHRoZXJlJ3MgYSBzaW5nbGUgc2NlbmUgd2l0aCBhIHNpbmdsZSBub2RlIGluIGl0LCBkb24ndCBjcmVhdGUgd3JhcHBlciBub2Rlc1xuICAgIGlmIChjb3VudCA9PT0gMSAmJiBnbHRmLnNjZW5lc1swXS5ub2Rlcz8ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IGdsdGYuc2NlbmVzWzBdLm5vZGVzWzBdO1xuICAgICAgICBzY2VuZXMucHVzaChub2Rlc1tub2RlSW5kZXhdKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIC8vIGNyZWF0ZSByb290IG5vZGUgcGVyIHNjZW5lXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lc1tpXTtcbiAgICAgICAgICAgIGlmIChzY2VuZS5ub2Rlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lUm9vdCA9IG5ldyBHcmFwaE5vZGUoc2NlbmUubmFtZSk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbiA9IDA7IG4gPCBzY2VuZS5ub2Rlcy5sZW5ndGg7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZE5vZGUgPSBub2Rlc1tzY2VuZS5ub2Rlc1tuXV07XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lUm9vdC5hZGRDaGlsZChjaGlsZE5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzY2VuZXMucHVzaChzY2VuZVJvb3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjZW5lcztcbn07XG5cbmNvbnN0IGNyZWF0ZUNhbWVyYXMgPSAoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpID0+IHtcblxuICAgIGxldCBjYW1lcmFzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2NhbWVyYXMnKSAmJiBnbHRmLmNhbWVyYXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5jYW1lcmE/LnByZXByb2Nlc3M7XG4gICAgICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zPy5jYW1lcmE/LnByb2Nlc3MgPz8gY3JlYXRlQ2FtZXJhO1xuICAgICAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnM/LmNhbWVyYT8ucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKChnbHRmTm9kZSwgbm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NhbWVyYScpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkNhbWVyYSA9IGdsdGYuY2FtZXJhc1tnbHRmTm9kZS5jYW1lcmFdO1xuICAgICAgICAgICAgICAgIGlmIChnbHRmQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZDYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHByb2Nlc3MoZ2x0ZkNhbWVyYSwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkNhbWVyYSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgY2FtZXJhIHRvIG5vZGUtPmNhbWVyYSBtYXBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYW1lcmFzKSBjYW1lcmFzID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhcy5zZXQoZ2x0Zk5vZGUsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjYW1lcmFzO1xufTtcblxuY29uc3QgY3JlYXRlTGlnaHRzID0gKGdsdGYsIG5vZGVzLCBvcHRpb25zKSA9PiB7XG5cbiAgICBsZXQgbGlnaHRzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSAmJlxuICAgICAgICBnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9saWdodHNfcHVuY3R1YWwnKSAmJiBnbHRmLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHRzJykpIHtcblxuICAgICAgICBjb25zdCBnbHRmTGlnaHRzID0gZ2x0Zi5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHRzO1xuICAgICAgICBpZiAoZ2x0ZkxpZ2h0cy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnM/LmxpZ2h0Py5wcmVwcm9jZXNzO1xuICAgICAgICAgICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnM/LmxpZ2h0Py5wcm9jZXNzID8/IGNyZWF0ZUxpZ2h0O1xuICAgICAgICAgICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy5saWdodD8ucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBub2RlcyB3aXRoIGxpZ2h0c1xuICAgICAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKChnbHRmTm9kZSwgbm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2xpZ2h0c19wdW5jdHVhbCcpICYmXG4gICAgICAgICAgICAgICAgICAgIGdsdGZOb2RlLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHQnKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0SW5kZXggPSBnbHRmTm9kZS5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZMaWdodCA9IGdsdGZMaWdodHNbbGlnaHRJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBwcm9jZXNzKGdsdGZMaWdodCwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTGlnaHQsIGxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBsaWdodCB0byBub2RlLT5saWdodCBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRzKSBsaWdodHMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRzLnNldChnbHRmTm9kZSwgbGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlnaHRzO1xufTtcblxuLy8gbGluayBza2lucyB0byB0aGUgbWVzaGVzXG5jb25zdCBsaW5rU2tpbnMgPSAoZ2x0ZiwgcmVuZGVycywgc2tpbnMpID0+IHtcbiAgICBnbHRmLm5vZGVzLmZvckVhY2goKGdsdGZOb2RlKSA9PiB7XG4gICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbWVzaCcpICYmIGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdza2luJykpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hHcm91cCA9IHJlbmRlcnNbZ2x0Zk5vZGUubWVzaF0ubWVzaGVzO1xuICAgICAgICAgICAgbWVzaEdyb3VwLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgICAgICAgICBtZXNoLnNraW4gPSBza2luc1tnbHRmTm9kZS5za2luXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBjcmVhdGUgZW5naW5lIHJlc291cmNlcyBmcm9tIHRoZSBkb3dubG9hZGVkIEdMQiBkYXRhXG5jb25zdCBjcmVhdGVSZXNvdXJjZXMgPSBhc3luYyAoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZXMsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8uZ2xvYmFsPy5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uZ2xvYmFsPy5wb3N0cHJvY2VzcztcblxuICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgIHByZXByb2Nlc3MoZ2x0Zik7XG4gICAgfVxuXG4gICAgLy8gVGhlIG9yaWdpbmFsIHZlcnNpb24gb2YgRkFDVCBnZW5lcmF0ZWQgaW5jb3JyZWN0bHkgZmxpcHBlZCBWIHRleHR1cmVcbiAgICAvLyBjb29yZGluYXRlcy4gV2UgbXVzdCBjb21wZW5zYXRlIGJ5IGZsaXBwaW5nIFYgaW4gdGhpcyBjYXNlLiBPbmNlXG4gICAgLy8gYWxsIG1vZGVscyBoYXZlIGJlZW4gcmUtZXhwb3J0ZWQgd2UgY2FuIHJlbW92ZSB0aGlzIGZsYWcuXG4gICAgY29uc3QgZmxpcFYgPSBnbHRmLmFzc2V0ICYmIGdsdGYuYXNzZXQuZ2VuZXJhdG9yID09PSAnUGxheUNhbnZhcyc7XG5cbiAgICAvLyBXZSdkIGxpa2UgdG8gcmVtb3ZlIHRoZSBmbGlwViBjb2RlIGF0IHNvbWUgcG9pbnQuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ2dsVEYgbW9kZWwgbWF5IGhhdmUgZmxpcHBlZCBVVnMuIFBsZWFzZSByZWNvbnZlcnQuJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZXMgPSBjcmVhdGVOb2RlcyhnbHRmLCBvcHRpb25zKTtcbiAgICBjb25zdCBzY2VuZXMgPSBjcmVhdGVTY2VuZXMoZ2x0Ziwgbm9kZXMpO1xuICAgIGNvbnN0IGxpZ2h0cyA9IGNyZWF0ZUxpZ2h0cyhnbHRmLCBub2Rlcywgb3B0aW9ucyk7XG4gICAgY29uc3QgY2FtZXJhcyA9IGNyZWF0ZUNhbWVyYXMoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHZhcmlhbnRzID0gY3JlYXRlVmFyaWFudHMoZ2x0Zik7XG5cbiAgICAvLyBidWZmZXIgZGF0YSBtdXN0IGhhdmUgZmluaXNoZWQgbG9hZGluZyBpbiBvcmRlciB0byBjcmVhdGUgbWVzaGVzIGFuZCBhbmltYXRpb25zXG4gICAgY29uc3QgYnVmZmVyVmlld0RhdGEgPSBhd2FpdCBQcm9taXNlLmFsbChidWZmZXJWaWV3cyk7XG4gICAgY29uc3QgeyBtZXNoZXMsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIHByb21pc2VzIH0gPSBjcmVhdGVNZXNoZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3RGF0YSwgZmxpcFYsIG9wdGlvbnMpO1xuICAgIGNvbnN0IGFuaW1hdGlvbnMgPSBjcmVhdGVBbmltYXRpb25zKGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3RGF0YSwgb3B0aW9ucyk7XG5cbiAgICAvLyB0ZXh0dXJlcyBtdXN0IGhhdmUgZmluaXNoZWQgbG9hZGluZyBpbiBvcmRlciB0byBjcmVhdGUgbWF0ZXJpYWxzXG4gICAgY29uc3QgdGV4dHVyZUFzc2V0cyA9IGF3YWl0IFByb21pc2UuYWxsKHRleHR1cmVzKTtcbiAgICBjb25zdCB0ZXh0dXJlSW5zdGFuY2VzID0gdGV4dHVyZUFzc2V0cy5tYXAodCA9PiB0LnJlc291cmNlKTtcbiAgICBjb25zdCBtYXRlcmlhbHMgPSBjcmVhdGVNYXRlcmlhbHMoZ2x0ZiwgdGV4dHVyZUluc3RhbmNlcywgb3B0aW9ucywgZmxpcFYpO1xuICAgIGNvbnN0IHNraW5zID0gY3JlYXRlU2tpbnMoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld0RhdGEpO1xuXG4gICAgLy8gY3JlYXRlIHJlbmRlcnMgdG8gd3JhcCBtZXNoZXNcbiAgICBjb25zdCByZW5kZXJzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVuZGVyc1tpXSA9IG5ldyBSZW5kZXIoKTtcbiAgICAgICAgcmVuZGVyc1tpXS5tZXNoZXMgPSBtZXNoZXNbaV07XG4gICAgfVxuXG4gICAgLy8gbGluayBza2lucyB0byBtZXNoZXNcbiAgICBsaW5rU2tpbnMoZ2x0ZiwgcmVuZGVycywgc2tpbnMpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IEdsYlJlc291cmNlcygpO1xuICAgIHJlc3VsdC5nbHRmID0gZ2x0ZjtcbiAgICByZXN1bHQubm9kZXMgPSBub2RlcztcbiAgICByZXN1bHQuc2NlbmVzID0gc2NlbmVzO1xuICAgIHJlc3VsdC5hbmltYXRpb25zID0gYW5pbWF0aW9ucztcbiAgICByZXN1bHQudGV4dHVyZXMgPSB0ZXh0dXJlQXNzZXRzO1xuICAgIHJlc3VsdC5tYXRlcmlhbHMgPSBtYXRlcmlhbHM7XG4gICAgcmVzdWx0LnZhcmlhbnRzID0gdmFyaWFudHM7XG4gICAgcmVzdWx0Lm1lc2hWYXJpYW50cyA9IG1lc2hWYXJpYW50cztcbiAgICByZXN1bHQubWVzaERlZmF1bHRNYXRlcmlhbHMgPSBtZXNoRGVmYXVsdE1hdGVyaWFscztcbiAgICByZXN1bHQucmVuZGVycyA9IHJlbmRlcnM7XG4gICAgcmVzdWx0LnNraW5zID0gc2tpbnM7XG4gICAgcmVzdWx0LmxpZ2h0cyA9IGxpZ2h0cztcbiAgICByZXN1bHQuY2FtZXJhcyA9IGNhbWVyYXM7XG5cbiAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZiwgcmVzdWx0KTtcbiAgICB9XG5cbiAgICAvLyB3YWl0IGZvciBkcmFjbyBtZXNoZXMgdG8gY29tcGxldGUgZGVjb2RpbmdcbiAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgYXBwbHlTYW1wbGVyID0gKHRleHR1cmUsIGdsdGZTYW1wbGVyKSA9PiB7XG4gICAgY29uc3QgZ2V0RmlsdGVyID0gKGZpbHRlciwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICAgIHN3aXRjaCAoZmlsdGVyKSB7XG4gICAgICAgICAgICBjYXNlIDk3Mjg6IHJldHVybiBGSUxURVJfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTcyOTogcmV0dXJuIEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICBjYXNlIDk5ODQ6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTk4NTogcmV0dXJuIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk5ODY6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgY2FzZSA5OTg3OiByZXR1cm4gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgZGVmYXVsdDogICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGdldFdyYXAgPSAod3JhcCwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICAgIHN3aXRjaCAod3JhcCkge1xuICAgICAgICAgICAgY2FzZSAzMzA3MTogcmV0dXJuIEFERFJFU1NfQ0xBTVBfVE9fRURHRTtcbiAgICAgICAgICAgIGNhc2UgMzM2NDg6IHJldHVybiBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDtcbiAgICAgICAgICAgIGNhc2UgMTA0OTc6IHJldHVybiBBRERSRVNTX1JFUEVBVDtcbiAgICAgICAgICAgIGRlZmF1bHQ6ICAgIHJldHVybiBkZWZhdWx0VmFsdWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHRleHR1cmUpIHtcbiAgICAgICAgZ2x0ZlNhbXBsZXIgPSBnbHRmU2FtcGxlciA/PyB7IH07XG4gICAgICAgIHRleHR1cmUubWluRmlsdGVyID0gZ2V0RmlsdGVyKGdsdGZTYW1wbGVyLm1pbkZpbHRlciwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5tYWdGaWx0ZXIgPSBnZXRGaWx0ZXIoZ2x0ZlNhbXBsZXIubWFnRmlsdGVyLCBGSUxURVJfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzVSA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFMsIEFERFJFU1NfUkVQRUFUKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzViA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFQsIEFERFJFU1NfUkVQRUFUKTtcbiAgICB9XG59O1xuXG5sZXQgZ2x0ZlRleHR1cmVVbmlxdWVJZCA9IDA7XG5cbi8vIGNyZWF0ZSBnbHRmIGltYWdlcy4gcmV0dXJucyBhbiBhcnJheSBvZiBwcm9taXNlcyB0aGF0IHJlc29sdmUgdG8gdGV4dHVyZSBhc3NldHMuXG5jb25zdCBjcmVhdGVJbWFnZXMgPSAoZ2x0ZiwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKCFnbHRmLmltYWdlcyB8fCBnbHRmLmltYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5pbWFnZT8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSBvcHRpb25zPy5pbWFnZT8ucHJvY2Vzc0FzeW5jO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uaW1hZ2U/LnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3QgbWltZVR5cGVGaWxlRXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgJ2ltYWdlL3BuZyc6ICdwbmcnLFxuICAgICAgICAnaW1hZ2UvanBlZyc6ICdqcGcnLFxuICAgICAgICAnaW1hZ2UvYmFzaXMnOiAnYmFzaXMnLFxuICAgICAgICAnaW1hZ2Uva3R4JzogJ2t0eCcsXG4gICAgICAgICdpbWFnZS9rdHgyJzogJ2t0eDInLFxuICAgICAgICAnaW1hZ2Uvdm5kLW1zLmRkcyc6ICdkZHMnXG4gICAgfTtcblxuICAgIGNvbnN0IGxvYWRUZXh0dXJlID0gKGdsdGZJbWFnZSwgdXJsLCBidWZmZXJWaWV3LCBtaW1lVHlwZSwgb3B0aW9ucykgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgY29udGludWF0aW9uID0gKGJ1ZmZlclZpZXdEYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChnbHRmSW1hZ2UubmFtZSB8fCAnZ2x0Zi10ZXh0dXJlJykgKyAnLScgKyBnbHRmVGV4dHVyZVVuaXF1ZUlkKys7XG5cbiAgICAgICAgICAgICAgICAvLyBjb25zdHJ1Y3QgdGhlIGFzc2V0IGZpbGVcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0ge1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHVybCB8fCBuYW1lXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZmVyVmlld0RhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZS5jb250ZW50cyA9IGJ1ZmZlclZpZXdEYXRhLnNsaWNlKDApLmJ1ZmZlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG1pbWVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IG1pbWVUeXBlRmlsZUV4dGVuc2lvbnNbbWltZVR5cGVdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0ZW5zaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlLmZpbGVuYW1lID0gZmlsZS51cmwgKyAnLicgKyBleHRlbnNpb247XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYW5kIGxvYWQgdGhlIGFzc2V0XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBuZXcgQXNzZXQobmFtZSwgJ3RleHR1cmUnLCBmaWxlLCBudWxsLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICBhc3NldC5vbignbG9hZCcsIGFzc2V0ID0+IHJlc29sdmUoYXNzZXQpKTtcbiAgICAgICAgICAgICAgICBhc3NldC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpO1xuICAgICAgICAgICAgICAgIHJlZ2lzdHJ5LmFkZChhc3NldCk7XG4gICAgICAgICAgICAgICAgcmVnaXN0cnkubG9hZChhc3NldCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoYnVmZmVyVmlldykge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXcudGhlbihidWZmZXJWaWV3RGF0YSA9PiBjb250aW51YXRpb24oYnVmZmVyVmlld0RhdGEpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udGludWF0aW9uKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGdsdGYuaW1hZ2VzLm1hcCgoZ2x0ZkltYWdlLCBpKSA9PiB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZJbWFnZSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJvbWlzZTtcblxuICAgICAgICBpZiAocHJvY2Vzc0FzeW5jKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NBc3luYyhnbHRmSW1hZ2UsIChlcnIsIHRleHR1cmVBc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigodGV4dHVyZUFzc2V0KSA9PiB7XG4gICAgICAgICAgICBpZiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCd1cmknKSkge1xuICAgICAgICAgICAgICAgIC8vIHVyaSBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICBpZiAoaXNEYXRhVVJJKGdsdGZJbWFnZS51cmkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsb2FkVGV4dHVyZShnbHRmSW1hZ2UsIGdsdGZJbWFnZS51cmksIG51bGwsIGdldERhdGFVUklNaW1lVHlwZShnbHRmSW1hZ2UudXJpKSwgbnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkVGV4dHVyZShnbHRmSW1hZ2UsIEFCU09MVVRFX1VSTC50ZXN0KGdsdGZJbWFnZS51cmkpID8gZ2x0ZkltYWdlLnVyaSA6IHBhdGguam9pbih1cmxCYXNlLCBnbHRmSW1hZ2UudXJpKSwgbnVsbCwgbnVsbCwgeyBjcm9zc09yaWdpbjogJ2Fub255bW91cycgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgnYnVmZmVyVmlldycpICYmIGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgnbWltZVR5cGUnKSkge1xuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlcnZpZXdcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZFRleHR1cmUoZ2x0ZkltYWdlLCBudWxsLCBidWZmZXJWaWV3c1tnbHRmSW1hZ2UuYnVmZmVyVmlld10sIGdsdGZJbWFnZS5taW1lVHlwZSwgbnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGZhaWxcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoYEludmFsaWQgaW1hZ2UgZm91bmQgaW4gZ2x0ZiAobmVpdGhlciB1cmkgb3IgYnVmZmVyVmlldyBmb3VuZCkuIGluZGV4PSR7aX1gKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigodGV4dHVyZUFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkltYWdlLCB0ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZXh0dXJlQXNzZXQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH0pO1xufTtcblxuLy8gY3JlYXRlIGdsdGYgdGV4dHVyZXMuIHJldHVybnMgYW4gYXJyYXkgb2YgcHJvbWlzZXMgdGhhdCByZXNvbHZlIHRvIHRleHR1cmUgYXNzZXRzLlxuY29uc3QgY3JlYXRlVGV4dHVyZXMgPSAoZ2x0ZiwgaW1hZ2VzLCBvcHRpb25zKSA9PiB7XG5cbiAgICBpZiAoIWdsdGY/LmltYWdlcz8ubGVuZ3RoIHx8ICFnbHRmPy50ZXh0dXJlcz8ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8udGV4dHVyZT8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSBvcHRpb25zPy50ZXh0dXJlPy5wcm9jZXNzQXN5bmM7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy50ZXh0dXJlPy5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IHNlZW5JbWFnZXMgPSBuZXcgU2V0KCk7XG5cbiAgICByZXR1cm4gZ2x0Zi50ZXh0dXJlcy5tYXAoKGdsdGZUZXh0dXJlKSA9PiB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZUZXh0dXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBwcm9taXNlO1xuXG4gICAgICAgIGlmIChwcm9jZXNzQXN5bmMpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZUZXh0dXJlLCBnbHRmLmltYWdlcywgKGVyciwgZ2x0ZkltYWdlSW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGdsdGZJbWFnZUluZGV4KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigoZ2x0ZkltYWdlSW5kZXgpID0+IHtcbiAgICAgICAgICAgIC8vIHJlc29sdmUgaW1hZ2UgaW5kZXhcbiAgICAgICAgICAgIGdsdGZJbWFnZUluZGV4ID0gZ2x0ZkltYWdlSW5kZXggPz9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZlRleHR1cmU/LmV4dGVuc2lvbnM/LktIUl90ZXh0dXJlX2Jhc2lzdT8uc291cmNlID8/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZUZXh0dXJlLnNvdXJjZTtcblxuICAgICAgICAgICAgY29uc3QgY2xvbmVBc3NldCA9IHNlZW5JbWFnZXMuaGFzKGdsdGZJbWFnZUluZGV4KTtcbiAgICAgICAgICAgIHNlZW5JbWFnZXMuYWRkKGdsdGZJbWFnZUluZGV4KTtcblxuICAgICAgICAgICAgcmV0dXJuIGltYWdlc1tnbHRmSW1hZ2VJbmRleF0udGhlbigoaW1hZ2VBc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gY2xvbmVBc3NldCA/IGNsb25lVGV4dHVyZUFzc2V0KGltYWdlQXNzZXQpIDogaW1hZ2VBc3NldDtcbiAgICAgICAgICAgICAgICBhcHBseVNhbXBsZXIoYXNzZXQucmVzb3VyY2UsIChnbHRmLnNhbXBsZXJzID8/IFtdKVtnbHRmVGV4dHVyZS5zYW1wbGVyXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFzc2V0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigodGV4dHVyZUFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZlRleHR1cmUsIHRleHR1cmVBc3NldCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfSk7XG59O1xuXG4vLyBsb2FkIGdsdGYgYnVmZmVycy4gcmV0dXJucyBhbiBhcnJheSBvZiBwcm9taXNlcyB0aGF0IHJlc29sdmUgdG8gdHlwZWQgYXJyYXlzLlxuY29uc3QgbG9hZEJ1ZmZlcnMgPSAoZ2x0ZiwgYmluYXJ5Q2h1bmssIHVybEJhc2UsIG9wdGlvbnMpID0+IHtcbiAgICBpZiAoIWdsdGYuYnVmZmVycyB8fCBnbHRmLmJ1ZmZlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8uYnVmZmVyPy5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3NBc3luYyA9IG9wdGlvbnM/LmJ1ZmZlcj8ucHJvY2Vzc0FzeW5jO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uYnVmZmVyPy5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLmJ1ZmZlcnMubWFwKChnbHRmQnVmZmVyLCBpKSA9PiB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHByb21pc2U7XG5cbiAgICAgICAgaWYgKHByb2Nlc3NBc3luYykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBwcm9jZXNzQXN5bmMoZ2x0ZkJ1ZmZlciwgKGVyciwgYXJyYXlCdWZmZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGFycmF5QnVmZmVyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigoYXJyYXlCdWZmZXIpID0+IHtcbiAgICAgICAgICAgIGlmIChhcnJheUJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBhcnJheUJ1ZmZlcjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2x0ZkJ1ZmZlci5oYXNPd25Qcm9wZXJ0eSgndXJpJykpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNEYXRhVVJJKGdsdGZCdWZmZXIudXJpKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb252ZXJ0IGJhc2U2NCB0byByYXcgYmluYXJ5IGRhdGEgaGVsZCBpbiBhIHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICAvLyBkb2Vzbid0IGhhbmRsZSBVUkxFbmNvZGVkIERhdGFVUklzIC0gc2VlIFNPIGFuc3dlciAjNjg1MDI3NiBmb3IgY29kZSB0aGF0IGRvZXMgdGhpc1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBieXRlU3RyaW5nID0gYXRvYihnbHRmQnVmZmVyLnVyaS5zcGxpdCgnLCcpWzFdKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYSB2aWV3IGludG8gdGhlIGJ1ZmZlclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBiaW5hcnlBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ5dGVTdHJpbmcubGVuZ3RoKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBzZXQgdGhlIGJ5dGVzIG9mIHRoZSBidWZmZXIgdG8gdGhlIGNvcnJlY3QgdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYnl0ZVN0cmluZy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYmluYXJ5QXJyYXlbal0gPSBieXRlU3RyaW5nLmNoYXJDb2RlQXQoaik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYmluYXJ5QXJyYXk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaHR0cC5nZXQoXG4gICAgICAgICAgICAgICAgICAgICAgICBBQlNPTFVURV9VUkwudGVzdChnbHRmQnVmZmVyLnVyaSkgPyBnbHRmQnVmZmVyLnVyaSA6IHBhdGguam9pbih1cmxCYXNlLCBnbHRmQnVmZmVyLnVyaSksXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGNhY2hlOiB0cnVlLCByZXNwb25zZVR5cGU6ICdhcnJheWJ1ZmZlcicsIHJldHJ5OiBmYWxzZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgKGVyciwgcmVzdWx0KSA9PiB7ICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tbG9vcC1mdW5jXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKG5ldyBVaW50OEFycmF5KHJlc3VsdCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBnbGIgYnVmZmVyIHJlZmVyZW5jZVxuICAgICAgICAgICAgcmV0dXJuIGJpbmFyeUNodW5rO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBwcm9taXNlLnRoZW4oKGJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGYuYnVmZmVyc1tpXSwgYnVmZmVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9KTtcbn07XG5cbi8vIHBhcnNlIHRoZSBnbHRmIGNodW5rLCByZXR1cm5zIHRoZSBnbHRmIGpzb25cbmNvbnN0IHBhcnNlR2x0ZiA9IChnbHRmQ2h1bmssIGNhbGxiYWNrKSA9PiB7XG4gICAgY29uc3QgZGVjb2RlQmluYXJ5VXRmOCA9IChhcnJheSkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShhcnJheSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc3RyID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHN0ciArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGFycmF5W2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoZXNjYXBlKHN0cikpO1xuICAgIH07XG5cbiAgICBjb25zdCBnbHRmID0gSlNPTi5wYXJzZShkZWNvZGVCaW5hcnlVdGY4KGdsdGZDaHVuaykpO1xuXG4gICAgLy8gY2hlY2sgZ2x0ZiB2ZXJzaW9uXG4gICAgaWYgKGdsdGYuYXNzZXQgJiYgZ2x0Zi5hc3NldC52ZXJzaW9uICYmIHBhcnNlRmxvYXQoZ2x0Zi5hc3NldC52ZXJzaW9uKSA8IDIpIHtcbiAgICAgICAgY2FsbGJhY2soYEludmFsaWQgZ2x0ZiB2ZXJzaW9uLiBFeHBlY3RlZCB2ZXJzaW9uIDIuMCBvciBhYm92ZSBidXQgZm91bmQgdmVyc2lvbiAnJHtnbHRmLmFzc2V0LnZlcnNpb259Jy5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIGNoZWNrIHJlcXVpcmVkIGV4dGVuc2lvbnNcbiAgICBjYWxsYmFjayhudWxsLCBnbHRmKTtcbn07XG5cbi8vIHBhcnNlIGdsYiBkYXRhLCByZXR1cm5zIHRoZSBnbHRmIGFuZCBiaW5hcnkgY2h1bmtcbmNvbnN0IHBhcnNlR2xiID0gKGdsYkRhdGEsIGNhbGxiYWNrKSA9PiB7XG4gICAgY29uc3QgZGF0YSA9IChnbGJEYXRhIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpID8gbmV3IERhdGFWaWV3KGdsYkRhdGEpIDogbmV3IERhdGFWaWV3KGdsYkRhdGEuYnVmZmVyLCBnbGJEYXRhLmJ5dGVPZmZzZXQsIGdsYkRhdGEuYnl0ZUxlbmd0aCk7XG5cbiAgICAvLyByZWFkIGhlYWRlclxuICAgIGNvbnN0IG1hZ2ljID0gZGF0YS5nZXRVaW50MzIoMCwgdHJ1ZSk7XG4gICAgY29uc3QgdmVyc2lvbiA9IGRhdGEuZ2V0VWludDMyKDQsIHRydWUpO1xuICAgIGNvbnN0IGxlbmd0aCA9IGRhdGEuZ2V0VWludDMyKDgsIHRydWUpO1xuXG4gICAgaWYgKG1hZ2ljICE9PSAweDQ2NTQ2QzY3KSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIG1hZ2ljIG51bWJlciBmb3VuZCBpbiBnbGIgaGVhZGVyLiBFeHBlY3RlZCAweDQ2NTQ2QzY3LCBmb3VuZCAweCcgKyBtYWdpYy50b1N0cmluZygxNikpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHZlcnNpb24gIT09IDIpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgdmVyc2lvbiBudW1iZXIgZm91bmQgaW4gZ2xiIGhlYWRlci4gRXhwZWN0ZWQgMiwgZm91bmQgJyArIHZlcnNpb24pO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGxlbmd0aCA8PSAwIHx8IGxlbmd0aCA+IGRhdGEuYnl0ZUxlbmd0aCkge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCBsZW5ndGggZm91bmQgaW4gZ2xiIGhlYWRlci4gRm91bmQgJyArIGxlbmd0aCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyByZWFkIGNodW5rc1xuICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgIGxldCBvZmZzZXQgPSAxMjtcbiAgICB3aGlsZSAob2Zmc2V0IDwgbGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGNodW5rTGVuZ3RoID0gZGF0YS5nZXRVaW50MzIob2Zmc2V0LCB0cnVlKTtcbiAgICAgICAgaWYgKG9mZnNldCArIGNodW5rTGVuZ3RoICsgOCA+IGRhdGEuYnl0ZUxlbmd0aCkge1xuICAgICAgICAgICAgY2FsbGJhY2soYEludmFsaWQgY2h1bmsgbGVuZ3RoIGZvdW5kIGluIGdsYi4gRm91bmQgJHtjaHVua0xlbmd0aH1gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaHVua1R5cGUgPSBkYXRhLmdldFVpbnQzMihvZmZzZXQgKyA0LCB0cnVlKTtcbiAgICAgICAgY29uc3QgY2h1bmtEYXRhID0gbmV3IFVpbnQ4QXJyYXkoZGF0YS5idWZmZXIsIGRhdGEuYnl0ZU9mZnNldCArIG9mZnNldCArIDgsIGNodW5rTGVuZ3RoKTtcbiAgICAgICAgY2h1bmtzLnB1c2goeyBsZW5ndGg6IGNodW5rTGVuZ3RoLCB0eXBlOiBjaHVua1R5cGUsIGRhdGE6IGNodW5rRGF0YSB9KTtcbiAgICAgICAgb2Zmc2V0ICs9IGNodW5rTGVuZ3RoICsgODtcbiAgICB9XG5cbiAgICBpZiAoY2h1bmtzLmxlbmd0aCAhPT0gMSAmJiBjaHVua3MubGVuZ3RoICE9PSAyKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIG51bWJlciBvZiBjaHVua3MgZm91bmQgaW4gZ2xiIGZpbGUuJyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoY2h1bmtzWzBdLnR5cGUgIT09IDB4NEU0RjUzNEEpIHtcbiAgICAgICAgY2FsbGJhY2soYEludmFsaWQgY2h1bmsgdHlwZSBmb3VuZCBpbiBnbGIgZmlsZS4gRXhwZWN0ZWQgMHg0RTRGNTM0QSwgZm91bmQgMHgke2NodW5rc1swXS50eXBlLnRvU3RyaW5nKDE2KX1gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaHVua3MubGVuZ3RoID4gMSAmJiBjaHVua3NbMV0udHlwZSAhPT0gMHgwMDRFNDk0Mikge1xuICAgICAgICBjYWxsYmFjayhgSW52YWxpZCBjaHVuayB0eXBlIGZvdW5kIGluIGdsYiBmaWxlLiBFeHBlY3RlZCAweDAwNEU0OTQyLCBmb3VuZCAweCR7Y2h1bmtzWzFdLnR5cGUudG9TdHJpbmcoMTYpfWApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY2FsbGJhY2sobnVsbCwge1xuICAgICAgICBnbHRmQ2h1bms6IGNodW5rc1swXS5kYXRhLFxuICAgICAgICBiaW5hcnlDaHVuazogY2h1bmtzLmxlbmd0aCA9PT0gMiA/IGNodW5rc1sxXS5kYXRhIDogbnVsbFxuICAgIH0pO1xufTtcblxuLy8gcGFyc2UgdGhlIGNodW5rIG9mIGRhdGEsIHdoaWNoIGNhbiBiZSBnbGIgb3IgZ2x0ZlxuY29uc3QgcGFyc2VDaHVuayA9IChmaWxlbmFtZSwgZGF0YSwgY2FsbGJhY2spID0+IHtcbiAgICBjb25zdCBoYXNHbGJIZWFkZXIgPSAoKSA9PiB7XG4gICAgICAgIC8vIGdsYiBmb3JtYXQgc3RhcnRzIHdpdGggJ2dsVEYnXG4gICAgICAgIGNvbnN0IHU4ID0gbmV3IFVpbnQ4QXJyYXkoZGF0YSk7XG4gICAgICAgIHJldHVybiB1OFswXSA9PT0gMTAzICYmIHU4WzFdID09PSAxMDggJiYgdThbMl0gPT09IDg0ICYmIHU4WzNdID09PSA3MDtcbiAgICB9O1xuXG4gICAgaWYgKChmaWxlbmFtZSAmJiBmaWxlbmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKCcuZ2xiJykpIHx8IGhhc0dsYkhlYWRlcigpKSB7XG4gICAgICAgIHBhcnNlR2xiKGRhdGEsIGNhbGxiYWNrKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgICAgICBnbHRmQ2h1bms6IGRhdGEsXG4gICAgICAgICAgICBiaW5hcnlDaHVuazogbnVsbFxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG4vLyBjcmVhdGUgYnVmZmVyIHZpZXdzXG5jb25zdCBjcmVhdGVCdWZmZXJWaWV3cyA9IChnbHRmLCBidWZmZXJzLCBvcHRpb25zKSA9PiB7XG5cbiAgICBjb25zdCByZXN1bHQgPSBbXTtcblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5idWZmZXJWaWV3Py5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHByb2Nlc3NBc3luYyA9IG9wdGlvbnM/LmJ1ZmZlclZpZXc/LnByb2Nlc3NBc3luYztcbiAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnM/LmJ1ZmZlclZpZXc/LnBvc3Rwcm9jZXNzO1xuXG4gICAgLy8gaGFuZGxlIGNhc2Ugb2Ygbm8gYnVmZmVyc1xuICAgIGlmICghZ2x0Zi5idWZmZXJWaWV3cz8ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbHRmLmJ1ZmZlclZpZXdzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGdsdGZCdWZmZXJWaWV3ID0gZ2x0Zi5idWZmZXJWaWV3c1tpXTtcblxuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQnVmZmVyVmlldyk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJvbWlzZTtcblxuICAgICAgICBpZiAocHJvY2Vzc0FzeW5jKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyVmlldywgYnVmZmVycywgKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpXG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKChidWZmZXIpID0+IHtcbiAgICAgICAgICAgIGlmIChidWZmZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjb252ZXJ0IGJ1ZmZlciB0byB0eXBlZCBhcnJheVxuICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlcnNbZ2x0ZkJ1ZmZlclZpZXcuYnVmZmVyXS50aGVuKChidWZmZXIpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnVmZmVyLmJ5dGVPZmZzZXQgKyAoZ2x0ZkJ1ZmZlclZpZXcuYnl0ZU9mZnNldCB8fCAwKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZkJ1ZmZlclZpZXcuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gYWRkIGEgJ2J5dGVTdHJpZGUnIG1lbWJlciB0byB0aGUgdHlwZWQgYXJyYXkgc28gd2UgaGF2ZSBlYXN5IGFjY2VzcyB0byBpdCBsYXRlclxuICAgICAgICBpZiAoZ2x0ZkJ1ZmZlclZpZXcuaGFzT3duUHJvcGVydHkoJ2J5dGVTdHJpZGUnKSkge1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigodHlwZWRBcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIHR5cGVkQXJyYXkuYnl0ZVN0cmlkZSA9IGdsdGZCdWZmZXJWaWV3LmJ5dGVTdHJpZGU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHR5cGVkQXJyYXk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigodHlwZWRBcnJheSkgPT4ge1xuICAgICAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZCdWZmZXJWaWV3LCB0eXBlZEFycmF5KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHlwZWRBcnJheTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0LnB1c2gocHJvbWlzZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbmNsYXNzIEdsYlBhcnNlciB7XG4gICAgLy8gcGFyc2UgdGhlIGdsdGYgb3IgZ2xiIGRhdGEgYXN5bmNocm9ub3VzbHksIGxvYWRpbmcgZXh0ZXJuYWwgcmVzb3VyY2VzXG4gICAgc3RhdGljIHBhcnNlKGZpbGVuYW1lLCB1cmxCYXNlLCBkYXRhLCBkZXZpY2UsIHJlZ2lzdHJ5LCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICAvLyBwYXJzZSB0aGUgZGF0YVxuICAgICAgICBwYXJzZUNodW5rKGZpbGVuYW1lLCBkYXRhLCAoZXJyLCBjaHVua3MpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcGFyc2UgZ2x0ZlxuICAgICAgICAgICAgcGFyc2VHbHRmKGNodW5rcy5nbHRmQ2h1bmssIChlcnIsIGdsdGYpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXJzID0gbG9hZEJ1ZmZlcnMoZ2x0ZiwgY2h1bmtzLmJpbmFyeUNodW5rLCB1cmxCYXNlLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXJWaWV3cyA9IGNyZWF0ZUJ1ZmZlclZpZXdzKGdsdGYsIGJ1ZmZlcnMsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGltYWdlcyA9IGNyZWF0ZUltYWdlcyhnbHRmLCBidWZmZXJWaWV3cywgdXJsQmFzZSwgcmVnaXN0cnksIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRleHR1cmVzID0gY3JlYXRlVGV4dHVyZXMoZ2x0ZiwgaW1hZ2VzLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgICAgIGNyZWF0ZVJlc291cmNlcyhkZXZpY2UsIGdsdGYsIGJ1ZmZlclZpZXdzLCB0ZXh0dXJlcywgb3B0aW9ucylcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4ocmVzdWx0ID0+IGNhbGxiYWNrKG51bGwsIHJlc3VsdCkpXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChlcnIgPT4gY2FsbGJhY2soZXJyKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3RhdGljIGNyZWF0ZURlZmF1bHRNYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZU1hdGVyaWFsKHtcbiAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0R2xiTWF0ZXJpYWwnXG4gICAgICAgIH0sIFtdKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEdsYlBhcnNlciB9O1xuIl0sIm5hbWVzIjpbIkdsYlJlc291cmNlcyIsImNvbnN0cnVjdG9yIiwiZ2x0ZiIsIm5vZGVzIiwic2NlbmVzIiwiYW5pbWF0aW9ucyIsInRleHR1cmVzIiwibWF0ZXJpYWxzIiwidmFyaWFudHMiLCJtZXNoVmFyaWFudHMiLCJtZXNoRGVmYXVsdE1hdGVyaWFscyIsInJlbmRlcnMiLCJza2lucyIsImxpZ2h0cyIsImNhbWVyYXMiLCJkZXN0cm95IiwiZm9yRWFjaCIsInJlbmRlciIsIm1lc2hlcyIsImlzRGF0YVVSSSIsInVyaSIsInRlc3QiLCJnZXREYXRhVVJJTWltZVR5cGUiLCJzdWJzdHJpbmciLCJpbmRleE9mIiwiZ2V0TnVtQ29tcG9uZW50cyIsImFjY2Vzc29yVHlwZSIsImdldENvbXBvbmVudFR5cGUiLCJjb21wb25lbnRUeXBlIiwiVFlQRV9JTlQ4IiwiVFlQRV9VSU5UOCIsIlRZUEVfSU5UMTYiLCJUWVBFX1VJTlQxNiIsIlRZUEVfSU5UMzIiLCJUWVBFX1VJTlQzMiIsIlRZUEVfRkxPQVQzMiIsImdldENvbXBvbmVudFNpemVJbkJ5dGVzIiwiZ2V0Q29tcG9uZW50RGF0YVR5cGUiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiSW50MTZBcnJheSIsIlVpbnQxNkFycmF5IiwiSW50MzJBcnJheSIsIlVpbnQzMkFycmF5IiwiRmxvYXQzMkFycmF5IiwiZ2x0ZlRvRW5naW5lU2VtYW50aWNNYXAiLCJTRU1BTlRJQ19QT1NJVElPTiIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX1RBTkdFTlQiLCJTRU1BTlRJQ19DT0xPUiIsIlNFTUFOVElDX0JMRU5ESU5ESUNFUyIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwiU0VNQU5USUNfVEVYQ09PUkQxIiwiU0VNQU5USUNfVEVYQ09PUkQyIiwiU0VNQU5USUNfVEVYQ09PUkQzIiwiU0VNQU5USUNfVEVYQ09PUkQ0IiwiU0VNQU5USUNfVEVYQ09PUkQ1IiwiU0VNQU5USUNfVEVYQ09PUkQ2IiwiU0VNQU5USUNfVEVYQ09PUkQ3IiwiYXR0cmlidXRlT3JkZXIiLCJnZXREZXF1YW50aXplRnVuYyIsInNyY1R5cGUiLCJ4IiwiTWF0aCIsIm1heCIsImRlcXVhbnRpemVBcnJheSIsImRzdEFycmF5Iiwic3JjQXJyYXkiLCJjb252RnVuYyIsImxlbiIsImxlbmd0aCIsImkiLCJnZXRBY2Nlc3NvckRhdGEiLCJnbHRmQWNjZXNzb3IiLCJidWZmZXJWaWV3cyIsImZsYXR0ZW4iLCJudW1Db21wb25lbnRzIiwidHlwZSIsImRhdGFUeXBlIiwicmVzdWx0Iiwic3BhcnNlIiwiaW5kaWNlc0FjY2Vzc29yIiwiY291bnQiLCJpbmRpY2VzIiwiT2JqZWN0IiwiYXNzaWduIiwidmFsdWVzQWNjZXNzb3IiLCJ2YWx1ZXMiLCJoYXNPd25Qcm9wZXJ0eSIsImJhc2VBY2Nlc3NvciIsImJ1ZmZlclZpZXciLCJieXRlT2Zmc2V0Iiwic2xpY2UiLCJ0YXJnZXRJbmRleCIsImoiLCJieXRlc1BlckVsZW1lbnQiLCJCWVRFU19QRVJfRUxFTUVOVCIsInN0b3JhZ2UiLCJBcnJheUJ1ZmZlciIsInRtcEFycmF5IiwiZHN0T2Zmc2V0Iiwic3JjT2Zmc2V0IiwiYnl0ZVN0cmlkZSIsImIiLCJidWZmZXIiLCJnZXRBY2Nlc3NvckRhdGFGbG9hdDMyIiwiZGF0YSIsIm5vcm1hbGl6ZWQiLCJmbG9hdDMyRGF0YSIsImdldEFjY2Vzc29yQm91bmRpbmdCb3giLCJtaW4iLCJjdHlwZSIsIkJvdW5kaW5nQm94IiwiVmVjMyIsImdldFByaW1pdGl2ZVR5cGUiLCJwcmltaXRpdmUiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwibW9kZSIsIlBSSU1JVElWRV9QT0lOVFMiLCJQUklNSVRJVkVfTElORVMiLCJQUklNSVRJVkVfTElORUxPT1AiLCJQUklNSVRJVkVfTElORVNUUklQIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiUFJJTUlUSVZFX1RSSUZBTiIsImdlbmVyYXRlSW5kaWNlcyIsIm51bVZlcnRpY2VzIiwiZHVtbXlJbmRpY2VzIiwiZ2VuZXJhdGVOb3JtYWxzIiwic291cmNlRGVzYyIsInAiLCJjb21wb25lbnRzIiwicG9zaXRpb25zIiwic2l6ZSIsInN0cmlkZSIsInNyY1N0cmlkZSIsInR5cGVkQXJyYXlUeXBlc0J5dGVTaXplIiwic3JjIiwidHlwZWRBcnJheVR5cGVzIiwib2Zmc2V0Iiwibm9ybWFsc1RlbXAiLCJjYWxjdWxhdGVOb3JtYWxzIiwibm9ybWFscyIsInNldCIsImZsaXBUZXhDb29yZFZzIiwidmVydGV4QnVmZmVyIiwiZmxvYXRPZmZzZXRzIiwic2hvcnRPZmZzZXRzIiwiYnl0ZU9mZnNldHMiLCJmb3JtYXQiLCJlbGVtZW50cyIsImVsZW1lbnQiLCJuYW1lIiwicHVzaCIsImZsaXAiLCJvZmZzZXRzIiwib25lIiwidHlwZWRBcnJheSIsImluZGV4IiwiY2xvbmVUZXh0dXJlIiwidGV4dHVyZSIsInNoYWxsb3dDb3B5TGV2ZWxzIiwibWlwIiwiX2xldmVscyIsImxldmVsIiwiY3ViZW1hcCIsImZhY2UiLCJUZXh0dXJlIiwiZGV2aWNlIiwiY2xvbmVUZXh0dXJlQXNzZXQiLCJBc3NldCIsImZpbGUiLCJvcHRpb25zIiwibG9hZGVkIiwicmVzb3VyY2UiLCJyZWdpc3RyeSIsImFkZCIsImNyZWF0ZVZlcnRleEJ1ZmZlckludGVybmFsIiwiZmxpcFYiLCJwb3NpdGlvbkRlc2MiLCJ2ZXJ0ZXhEZXNjIiwic2VtYW50aWMiLCJub3JtYWxpemUiLCJzb3J0IiwibGhzIiwicmhzIiwiayIsInNvdXJjZSIsInRhcmdldCIsInNvdXJjZU9mZnNldCIsInZlcnRleEZvcm1hdCIsIlZlcnRleEZvcm1hdCIsImlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQiLCJWZXJ0ZXhCdWZmZXIiLCJCVUZGRVJfU1RBVElDIiwidmVydGV4RGF0YSIsImxvY2siLCJ0YXJnZXRBcnJheSIsInNvdXJjZUFycmF5IiwidGFyZ2V0U3RyaWRlIiwic291cmNlU3RyaWRlIiwiZHN0Iiwia2VuZCIsImZsb29yIiwidW5sb2NrIiwiY3JlYXRlVmVydGV4QnVmZmVyIiwiYXR0cmlidXRlcyIsImFjY2Vzc29ycyIsInZlcnRleEJ1ZmZlckRpY3QiLCJ1c2VBdHRyaWJ1dGVzIiwiYXR0cmliSWRzIiwiYXR0cmliIiwidmJLZXkiLCJqb2luIiwidmIiLCJhY2Nlc3NvciIsImFjY2Vzc29yRGF0YSIsImNyZWF0ZVNraW4iLCJnbHRmU2tpbiIsImdsYlNraW5zIiwiYmluZE1hdHJpeCIsImpvaW50cyIsIm51bUpvaW50cyIsImlicCIsImludmVyc2VCaW5kTWF0cmljZXMiLCJpYm1EYXRhIiwiaWJtVmFsdWVzIiwiTWF0NCIsImJvbmVOYW1lcyIsImtleSIsInNraW4iLCJnZXQiLCJTa2luIiwiY3JlYXRlRHJhY29NZXNoIiwicHJvbWlzZXMiLCJfcHJpbWl0aXZlJGF0dHJpYnV0ZXMiLCJfcHJpbWl0aXZlJGV4dGVuc2lvbnMiLCJNZXNoIiwiYWFiYiIsIlBPU0lUSU9OIiwiZW50cmllcyIsIl9hY2Nlc3NvciRub3JtYWxpemVkIiwiTk9STUFMIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJkcmFjb0V4dCIsImV4dGVuc2lvbnMiLCJLSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbiIsImRyYWNvRGVjb2RlIiwiZXJyIiwiZGVjb21wcmVzc2VkRGF0YSIsImNvbnNvbGUiLCJsb2ciLCJ2ZXJ0aWNlcyIsImJ5dGVMZW5ndGgiLCJEZWJ1ZyIsImFzc2VydCIsIm51bUluZGljZXMiLCJpbmRleEZvcm1hdCIsIklOREVYRk9STUFUX1VJTlQxNiIsIklOREVYRk9STUFUX1VJTlQzMiIsImluZGV4QnVmZmVyIiwiSW5kZXhCdWZmZXIiLCJiYXNlIiwiaW5kZXhlZCIsIktIUl9tYXRlcmlhbHNfdmFyaWFudHMiLCJ0ZW1wTWFwcGluZyIsIm1hcHBpbmdzIiwibWFwcGluZyIsInZhcmlhbnQiLCJtYXRlcmlhbCIsImlkIiwiY3JlYXRlTWVzaCIsImdsdGZNZXNoIiwiYXNzZXRPcHRpb25zIiwicHJpbWl0aXZlcyIsIl9wcmltaXRpdmUkZXh0ZW5zaW9uczIiLCJwcmltaXRpdmVUeXBlIiwibWVzaCIsIklOREVYRk9STUFUX1VJTlQ4IiwiZXh0VWludEVsZW1lbnQiLCJ3YXJuIiwiaXNXZWJHUFUiLCJ0YXJnZXRzIiwiZGVsdGFQb3NpdGlvbnMiLCJkZWx0YVBvc2l0aW9uc1R5cGUiLCJkZWx0YU5vcm1hbHMiLCJkZWx0YU5vcm1hbHNUeXBlIiwiZXh0cmFzIiwidGFyZ2V0TmFtZXMiLCJ0b1N0cmluZyIsImRlZmF1bHRXZWlnaHQiLCJ3ZWlnaHRzIiwicHJlc2VydmVEYXRhIiwibW9ycGhQcmVzZXJ2ZURhdGEiLCJNb3JwaFRhcmdldCIsIm1vcnBoIiwiTW9ycGgiLCJwcmVmZXJIaWdoUHJlY2lzaW9uIiwibW9ycGhQcmVmZXJIaWdoUHJlY2lzaW9uIiwiZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0iLCJtYXBzIiwiX3NvdXJjZSRleHRlbnNpb25zIiwibWFwIiwidGV4Q29vcmQiLCJ6ZXJvcyIsIm9uZXMiLCJ0ZXh0dXJlVHJhbnNmb3JtIiwiS0hSX3RleHR1cmVfdHJhbnNmb3JtIiwic2NhbGUiLCJyb3RhdGlvbiIsIm1hdGgiLCJSQURfVE9fREVHIiwidGlsaW5nVmVjIiwiVmVjMiIsIm9mZnNldFZlYyIsImV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzIiwiY29sb3IiLCJkaWZmdXNlRmFjdG9yIiwiZGlmZnVzZSIsInBvdyIsIm9wYWNpdHkiLCJkaWZmdXNlVGV4dHVyZSIsImRpZmZ1c2VNYXAiLCJkaWZmdXNlTWFwQ2hhbm5lbCIsIm9wYWNpdHlNYXAiLCJvcGFjaXR5TWFwQ2hhbm5lbCIsInVzZU1ldGFsbmVzcyIsInNwZWN1bGFyRmFjdG9yIiwic3BlY3VsYXIiLCJnbG9zcyIsImdsb3NzaW5lc3NGYWN0b3IiLCJzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlIiwic3BlY3VsYXJFbmNvZGluZyIsInNwZWN1bGFyTWFwIiwiZ2xvc3NNYXAiLCJzcGVjdWxhck1hcENoYW5uZWwiLCJnbG9zc01hcENoYW5uZWwiLCJleHRlbnNpb25DbGVhckNvYXQiLCJjbGVhckNvYXQiLCJjbGVhcmNvYXRGYWN0b3IiLCJjbGVhcmNvYXRUZXh0dXJlIiwiY2xlYXJDb2F0TWFwIiwiY2xlYXJDb2F0TWFwQ2hhbm5lbCIsImNsZWFyQ29hdEdsb3NzIiwiY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yIiwiY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSIsImNsZWFyQ29hdEdsb3NzTWFwIiwiY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsIiwiY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSIsImNsZWFyQ29hdE5vcm1hbE1hcCIsImNsZWFyQ29hdEJ1bXBpbmVzcyIsImNsZWFyQ29hdEdsb3NzSW52ZXJ0IiwiZXh0ZW5zaW9uVW5saXQiLCJ1c2VMaWdodGluZyIsImVtaXNzaXZlIiwiY29weSIsImVtaXNzaXZlVGludCIsImRpZmZ1c2VUaW50IiwiZW1pc3NpdmVNYXAiLCJlbWlzc2l2ZU1hcFV2IiwiZGlmZnVzZU1hcFV2IiwiZW1pc3NpdmVNYXBUaWxpbmciLCJkaWZmdXNlTWFwVGlsaW5nIiwiZW1pc3NpdmVNYXBPZmZzZXQiLCJkaWZmdXNlTWFwT2Zmc2V0IiwiZW1pc3NpdmVNYXBSb3RhdGlvbiIsImRpZmZ1c2VNYXBSb3RhdGlvbiIsImVtaXNzaXZlTWFwQ2hhbm5lbCIsImVtaXNzaXZlVmVydGV4Q29sb3IiLCJkaWZmdXNlVmVydGV4Q29sb3IiLCJlbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCIsImRpZmZ1c2VWZXJ0ZXhDb2xvckNoYW5uZWwiLCJleHRlbnNpb25TcGVjdWxhciIsInVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IiLCJzcGVjdWxhckNvbG9yVGV4dHVyZSIsInNwZWN1bGFyQ29sb3JGYWN0b3IiLCJzcGVjdWxhcml0eUZhY3RvciIsInNwZWN1bGFyaXR5RmFjdG9yTWFwQ2hhbm5lbCIsInNwZWN1bGFyaXR5RmFjdG9yTWFwIiwic3BlY3VsYXJUZXh0dXJlIiwiZXh0ZW5zaW9uSW9yIiwicmVmcmFjdGlvbkluZGV4IiwiaW9yIiwiZXh0ZW5zaW9uVHJhbnNtaXNzaW9uIiwiYmxlbmRUeXBlIiwiQkxFTkRfTk9STUFMIiwidXNlRHluYW1pY1JlZnJhY3Rpb24iLCJyZWZyYWN0aW9uIiwidHJhbnNtaXNzaW9uRmFjdG9yIiwicmVmcmFjdGlvbk1hcENoYW5uZWwiLCJyZWZyYWN0aW9uTWFwIiwidHJhbnNtaXNzaW9uVGV4dHVyZSIsImV4dGVuc2lvblNoZWVuIiwidXNlU2hlZW4iLCJzaGVlbkNvbG9yRmFjdG9yIiwic2hlZW4iLCJzaGVlbk1hcCIsInNoZWVuQ29sb3JUZXh0dXJlIiwic2hlZW5FbmNvZGluZyIsInNoZWVuR2xvc3MiLCJzaGVlblJvdWdobmVzc0ZhY3RvciIsInNoZWVuR2xvc3NNYXAiLCJzaGVlblJvdWdobmVzc1RleHR1cmUiLCJzaGVlbkdsb3NzTWFwQ2hhbm5lbCIsInNoZWVuR2xvc3NJbnZlcnQiLCJleHRlbnNpb25Wb2x1bWUiLCJ0aGlja25lc3MiLCJ0aGlja25lc3NGYWN0b3IiLCJ0aGlja25lc3NNYXAiLCJ0aGlja25lc3NUZXh0dXJlIiwidGhpY2tuZXNzTWFwQ2hhbm5lbCIsImF0dGVudWF0aW9uRGlzdGFuY2UiLCJhdHRlbnVhdGlvbkNvbG9yIiwiYXR0ZW51YXRpb24iLCJleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoIiwiZW1pc3NpdmVJbnRlbnNpdHkiLCJlbWlzc2l2ZVN0cmVuZ3RoIiwiZXh0ZW5zaW9uSXJpZGVzY2VuY2UiLCJ1c2VJcmlkZXNjZW5jZSIsImlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2VGYWN0b3IiLCJpcmlkZXNjZW5jZU1hcENoYW5uZWwiLCJpcmlkZXNjZW5jZU1hcCIsImlyaWRlc2NlbmNlVGV4dHVyZSIsImlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4IiwiaXJpZGVzY2VuY2VJb3IiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01pbiIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bSIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4IiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXhpbXVtIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXAiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUiLCJjcmVhdGVNYXRlcmlhbCIsImdsdGZNYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJvY2NsdWRlU3BlY3VsYXIiLCJTUEVDT0NDX0FPIiwic3BlY3VsYXJUaW50Iiwic3BlY3VsYXJWZXJ0ZXhDb2xvciIsInBickRhdGEiLCJwYnJNZXRhbGxpY1JvdWdobmVzcyIsImJhc2VDb2xvckZhY3RvciIsImJhc2VDb2xvclRleHR1cmUiLCJtZXRhbG5lc3MiLCJtZXRhbGxpY0ZhY3RvciIsInJvdWdobmVzc0ZhY3RvciIsImdsb3NzSW52ZXJ0IiwibWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlIiwibWV0YWxuZXNzTWFwIiwibWV0YWxuZXNzTWFwQ2hhbm5lbCIsIm5vcm1hbFRleHR1cmUiLCJub3JtYWxNYXAiLCJidW1waW5lc3MiLCJvY2NsdXNpb25UZXh0dXJlIiwiYW9NYXAiLCJhb01hcENoYW5uZWwiLCJlbWlzc2l2ZUZhY3RvciIsImVtaXNzaXZlVGV4dHVyZSIsImFscGhhTW9kZSIsIkJMRU5EX05PTkUiLCJhbHBoYVRlc3QiLCJhbHBoYUN1dG9mZiIsImRlcHRoV3JpdGUiLCJ0d29TaWRlZExpZ2h0aW5nIiwiZG91YmxlU2lkZWQiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsIkNVTExGQUNFX0JBQ0siLCJleHRlbnNpb25GdW5jIiwidW5kZWZpbmVkIiwidXBkYXRlIiwiY3JlYXRlQW5pbWF0aW9uIiwiZ2x0ZkFuaW1hdGlvbiIsImFuaW1hdGlvbkluZGV4IiwiZ2x0ZkFjY2Vzc29ycyIsImdsdGZOb2RlcyIsImNyZWF0ZUFuaW1EYXRhIiwiQW5pbURhdGEiLCJpbnRlcnBNYXAiLCJJTlRFUlBPTEFUSU9OX1NURVAiLCJJTlRFUlBPTEFUSU9OX0xJTkVBUiIsIklOVEVSUE9MQVRJT05fQ1VCSUMiLCJpbnB1dE1hcCIsIm91dHB1dE1hcCIsImN1cnZlTWFwIiwib3V0cHV0Q291bnRlciIsInNhbXBsZXJzIiwic2FtcGxlciIsImlucHV0Iiwib3V0cHV0IiwiaW50ZXJwb2xhdGlvbiIsImN1cnZlIiwicGF0aHMiLCJxdWF0QXJyYXlzIiwidHJhbnNmb3JtU2NoZW1hIiwiY29uc3RydWN0Tm9kZVBhdGgiLCJub2RlIiwicGF0aCIsInVuc2hpZnQiLCJwYXJlbnQiLCJjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyIsImdsdGZOb2RlIiwiZW50aXR5UGF0aCIsIm91dCIsIm91dERhdGEiLCJtb3JwaFRhcmdldENvdW50Iiwia2V5ZnJhbWVDb3VudCIsInNpbmdsZUJ1ZmZlclNpemUiLCJfdGFyZ2V0TmFtZXMiLCJtb3JwaFRhcmdldE91dHB1dCIsIndlaWdodE5hbWUiLCJtb3JwaEN1cnZlIiwiY29tcG9uZW50IiwicHJvcGVydHlQYXRoIiwiY2hhbm5lbHMiLCJjaGFubmVsIiwic3RhcnRzV2l0aCIsImlucHV0cyIsIm91dHB1dHMiLCJjdXJ2ZXMiLCJpbnB1dEtleSIsIm91dHB1dEtleSIsImN1cnZlS2V5IiwiY3VydmVEYXRhIiwiQW5pbUN1cnZlIiwicHJldkluZGV4IiwiZCIsImRwIiwiZHVyYXRpb24iLCJfZGF0YSIsIkFuaW1UcmFjayIsInRlbXBNYXQiLCJ0ZW1wVmVjIiwiY3JlYXRlTm9kZSIsIm5vZGVJbmRleCIsImVudGl0eSIsIkdyYXBoTm9kZSIsIm1hdHJpeCIsImdldFRyYW5zbGF0aW9uIiwic2V0TG9jYWxQb3NpdGlvbiIsImdldEV1bGVyQW5nbGVzIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsImdldFNjYWxlIiwic2V0TG9jYWxTY2FsZSIsInIiLCJzZXRMb2NhbFJvdGF0aW9uIiwidCIsInRyYW5zbGF0aW9uIiwicyIsImNyZWF0ZUNhbWVyYSIsImdsdGZDYW1lcmEiLCJwcm9qZWN0aW9uIiwiUFJPSkVDVElPTl9PUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiZ2x0ZlByb3BlcnRpZXMiLCJvcnRob2dyYXBoaWMiLCJwZXJzcGVjdGl2ZSIsImNvbXBvbmVudERhdGEiLCJlbmFibGVkIiwibmVhckNsaXAiLCJ6bmVhciIsImFzcGVjdFJhdGlvTW9kZSIsIkFTUEVDVF9BVVRPIiwiemZhciIsImZhckNsaXAiLCJvcnRob0hlaWdodCIsInltYWciLCJBU1BFQ1RfTUFOVUFMIiwiYXNwZWN0UmF0aW8iLCJ4bWFnIiwiZm92IiwieWZvdiIsImNhbWVyYUVudGl0eSIsIkVudGl0eSIsImFkZENvbXBvbmVudCIsImNyZWF0ZUxpZ2h0IiwiZ2x0ZkxpZ2h0IiwibGlnaHRQcm9wcyIsIkNvbG9yIiwiV0hJVEUiLCJyYW5nZSIsImZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVEIiwiaW50ZW5zaXR5IiwiY2xhbXAiLCJpbm5lckNvbmVBbmdsZSIsInNwb3QiLCJvdXRlckNvbmVBbmdsZSIsIlBJIiwibHVtaW5hbmNlIiwiTGlnaHQiLCJnZXRMaWdodFVuaXRDb252ZXJzaW9uIiwibGlnaHRUeXBlcyIsImxpZ2h0RW50aXR5Iiwicm90YXRlTG9jYWwiLCJjcmVhdGVTa2lucyIsIk1hcCIsImNyZWF0ZU1lc2hlcyIsIl9nbHRmJG1lc2hlcyIsIl9nbHRmJGFjY2Vzc29ycyIsIl9nbHRmJGJ1ZmZlclZpZXdzIiwidmFsaWQiLCJza2lwTWVzaGVzIiwiY3JlYXRlTWF0ZXJpYWxzIiwiX29wdGlvbnMkbWF0ZXJpYWwiLCJfb3B0aW9ucyRtYXRlcmlhbCRwcm8iLCJfb3B0aW9ucyRtYXRlcmlhbDIiLCJfb3B0aW9ucyRtYXRlcmlhbDMiLCJwcmVwcm9jZXNzIiwicHJvY2VzcyIsInBvc3Rwcm9jZXNzIiwiY3JlYXRlVmFyaWFudHMiLCJjcmVhdGVBbmltYXRpb25zIiwiX29wdGlvbnMkYW5pbWF0aW9uIiwiX29wdGlvbnMkYW5pbWF0aW9uMiIsImFuaW1hdGlvbiIsImNyZWF0ZU5vZGVzIiwiX29wdGlvbnMkbm9kZSIsIl9vcHRpb25zJG5vZGUkcHJvY2VzcyIsIl9vcHRpb25zJG5vZGUyIiwiX29wdGlvbnMkbm9kZTMiLCJ1bmlxdWVOYW1lcyIsImNoaWxkcmVuIiwiY2hpbGQiLCJhZGRDaGlsZCIsImNyZWF0ZVNjZW5lcyIsIl9nbHRmJHNjZW5lcyQwJG5vZGVzIiwic2NlbmUiLCJzY2VuZVJvb3QiLCJuIiwiY2hpbGROb2RlIiwiY3JlYXRlQ2FtZXJhcyIsIl9vcHRpb25zJGNhbWVyYSIsIl9vcHRpb25zJGNhbWVyYSRwcm9jZSIsIl9vcHRpb25zJGNhbWVyYTIiLCJfb3B0aW9ucyRjYW1lcmEzIiwiY2FtZXJhIiwiY3JlYXRlTGlnaHRzIiwiS0hSX2xpZ2h0c19wdW5jdHVhbCIsImdsdGZMaWdodHMiLCJfb3B0aW9ucyRsaWdodCIsIl9vcHRpb25zJGxpZ2h0JHByb2NlcyIsIl9vcHRpb25zJGxpZ2h0MiIsIl9vcHRpb25zJGxpZ2h0MyIsImxpZ2h0IiwibGlnaHRJbmRleCIsImxpbmtTa2lucyIsIm1lc2hHcm91cCIsImNyZWF0ZVJlc291cmNlcyIsIl9vcHRpb25zJGdsb2JhbCIsIl9vcHRpb25zJGdsb2JhbDIiLCJnbG9iYWwiLCJhc3NldCIsImdlbmVyYXRvciIsImJ1ZmZlclZpZXdEYXRhIiwiYWxsIiwidGV4dHVyZUFzc2V0cyIsInRleHR1cmVJbnN0YW5jZXMiLCJSZW5kZXIiLCJhcHBseVNhbXBsZXIiLCJnbHRmU2FtcGxlciIsImdldEZpbHRlciIsImZpbHRlciIsImRlZmF1bHRWYWx1ZSIsIkZJTFRFUl9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUiIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJnZXRXcmFwIiwid3JhcCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiQUREUkVTU19SRVBFQVQiLCJfZ2x0ZlNhbXBsZXIiLCJtaW5GaWx0ZXIiLCJtYWdGaWx0ZXIiLCJhZGRyZXNzVSIsIndyYXBTIiwiYWRkcmVzc1YiLCJ3cmFwVCIsImdsdGZUZXh0dXJlVW5pcXVlSWQiLCJjcmVhdGVJbWFnZXMiLCJ1cmxCYXNlIiwiX29wdGlvbnMkaW1hZ2UiLCJfb3B0aW9ucyRpbWFnZTIiLCJfb3B0aW9ucyRpbWFnZTMiLCJpbWFnZXMiLCJpbWFnZSIsInByb2Nlc3NBc3luYyIsIm1pbWVUeXBlRmlsZUV4dGVuc2lvbnMiLCJsb2FkVGV4dHVyZSIsImdsdGZJbWFnZSIsInVybCIsIm1pbWVUeXBlIiwiY29udGludWF0aW9uIiwiY29udGVudHMiLCJleHRlbnNpb24iLCJmaWxlbmFtZSIsIm9uIiwibG9hZCIsInRoZW4iLCJwcm9taXNlIiwidGV4dHVyZUFzc2V0IiwiQUJTT0xVVEVfVVJMIiwiY3Jvc3NPcmlnaW4iLCJFcnJvciIsImNyZWF0ZVRleHR1cmVzIiwiX2dsdGYkaW1hZ2VzIiwiX2dsdGYkdGV4dHVyZXMiLCJfb3B0aW9ucyR0ZXh0dXJlIiwiX29wdGlvbnMkdGV4dHVyZTIiLCJfb3B0aW9ucyR0ZXh0dXJlMyIsInNlZW5JbWFnZXMiLCJTZXQiLCJnbHRmVGV4dHVyZSIsImdsdGZJbWFnZUluZGV4IiwiX3JlZiIsIl9nbHRmSW1hZ2VJbmRleCIsIl9nbHRmVGV4dHVyZSRleHRlbnNpbyIsIl9nbHRmVGV4dHVyZSRleHRlbnNpbzIiLCJLSFJfdGV4dHVyZV9iYXNpc3UiLCJjbG9uZUFzc2V0IiwiaGFzIiwiaW1hZ2VBc3NldCIsIl9nbHRmJHNhbXBsZXJzIiwibG9hZEJ1ZmZlcnMiLCJiaW5hcnlDaHVuayIsIl9vcHRpb25zJGJ1ZmZlciIsIl9vcHRpb25zJGJ1ZmZlcjIiLCJfb3B0aW9ucyRidWZmZXIzIiwiYnVmZmVycyIsImdsdGZCdWZmZXIiLCJhcnJheUJ1ZmZlciIsImJ5dGVTdHJpbmciLCJhdG9iIiwic3BsaXQiLCJiaW5hcnlBcnJheSIsImNoYXJDb2RlQXQiLCJodHRwIiwiY2FjaGUiLCJyZXNwb25zZVR5cGUiLCJyZXRyeSIsInBhcnNlR2x0ZiIsImdsdGZDaHVuayIsImNhbGxiYWNrIiwiZGVjb2RlQmluYXJ5VXRmOCIsImFycmF5IiwiVGV4dERlY29kZXIiLCJkZWNvZGUiLCJzdHIiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJkZWNvZGVVUklDb21wb25lbnQiLCJlc2NhcGUiLCJKU09OIiwicGFyc2UiLCJ2ZXJzaW9uIiwicGFyc2VGbG9hdCIsInBhcnNlR2xiIiwiZ2xiRGF0YSIsIkRhdGFWaWV3IiwibWFnaWMiLCJnZXRVaW50MzIiLCJjaHVua3MiLCJjaHVua0xlbmd0aCIsImNodW5rVHlwZSIsImNodW5rRGF0YSIsInBhcnNlQ2h1bmsiLCJoYXNHbGJIZWFkZXIiLCJ1OCIsInRvTG93ZXJDYXNlIiwiZW5kc1dpdGgiLCJjcmVhdGVCdWZmZXJWaWV3cyIsIl9vcHRpb25zJGJ1ZmZlclZpZXciLCJfb3B0aW9ucyRidWZmZXJWaWV3MiIsIl9vcHRpb25zJGJ1ZmZlclZpZXczIiwiX2dsdGYkYnVmZmVyVmlld3MyIiwiZ2x0ZkJ1ZmZlclZpZXciLCJHbGJQYXJzZXIiLCJjYXRjaCIsImNyZWF0ZURlZmF1bHRNYXRlcmlhbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0RBO0FBQ0EsTUFBTUEsWUFBWSxDQUFDO0VBQUFDLFdBQUEsR0FBQTtBQUFBLElBQUEsSUFBQSxDQUNmQyxJQUFJLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FFSkMsS0FBSyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBRUxDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQUVOQyxV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
