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
  promises.push(new Promise((resolve, reject) => {
    // decode draco data
    const dracoExt = primitive.extensions.KHR_draco_mesh_compression;
    dracoDecode(bufferViews[dracoExt.bufferView].slice().buffer, (err, decompressedData) => {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        // worker reports order of attributes as array of attribute unique_id
        const order = {};
        for (const [name, index] of Object.entries(dracoExt.attributes)) {
          order[gltfToEngineSemanticMap[name]] = decompressedData.attributes.indexOf(index);
        }

        // order vertexDesc
        vertexDesc.sort((a, b) => {
          return order[a.semantic] - order[b.semantic];
        });
        const vertexFormat = new VertexFormat(device, vertexDesc);

        // create vertex buffer
        const numVertices = decompressedData.vertices.byteLength / vertexFormat.size;
        const indexFormat = numVertices <= 65535 ? INDEXFORMAT_UINT16 : INDEXFORMAT_UINT32;
        const numIndices = decompressedData.indices.byteLength / (numVertices <= 65535 ? 2 : 4);
        Debug.call(() => {
          if (numVertices !== accessors[primitive.attributes.POSITION].count) {
            Debug.warn('mesh has invalid vertex count');
          }
          if (numIndices !== accessors[primitive.indices].count) {
            Debug.warn('mesh has invalid index count');
          }
        });
        const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, BUFFER_STATIC, decompressedData.vertices);
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

  // disable lighting and skybox
  material.useLighting = false;
  material.useSkybox = false;

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
      var _ref, _ref2, _gltfImageIndex, _gltfTexture$extensio, _gltfTexture$extensio2, _gltfTexture$extensio3, _gltfTexture$extensio4;
      // resolve image index
      gltfImageIndex = (_ref = (_ref2 = (_gltfImageIndex = gltfImageIndex) != null ? _gltfImageIndex : gltfTexture == null ? void 0 : (_gltfTexture$extensio = gltfTexture.extensions) == null ? void 0 : (_gltfTexture$extensio2 = _gltfTexture$extensio.KHR_texture_basisu) == null ? void 0 : _gltfTexture$extensio2.source) != null ? _ref2 : gltfTexture == null ? void 0 : (_gltfTexture$extensio3 = gltfTexture.extensions) == null ? void 0 : (_gltfTexture$extensio4 = _gltfTexture$extensio3.EXT_texture_webp) == null ? void 0 : _gltfTexture$extensio4.source) != null ? _ref : gltfTexture.source;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLXBhcnNlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9wYXJzZXJzL2dsYi1wYXJzZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi8uLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQge1xuICAgIHR5cGVkQXJyYXlUeXBlcywgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUsXG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBDVUxMRkFDRV9OT05FLCBDVUxMRkFDRV9CQUNLLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQUklNSVRJVkVfTElORUxPT1AsIFBSSU1JVElWRV9MSU5FU1RSSVAsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX1BPSU5UUywgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RBTkdFTlQsIFNFTUFOVElDX0NPTE9SLCBTRU1BTlRJQ19CTEVORElORElDRVMsIFNFTUFOVElDX0JMRU5EV0VJR0hULFxuICAgIFNFTUFOVElDX1RFWENPT1JEMCwgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19URVhDT09SRDIsIFNFTUFOVElDX1RFWENPT1JEMywgU0VNQU5USUNfVEVYQ09PUkQ0LCBTRU1BTlRJQ19URVhDT09SRDUsIFNFTUFOVElDX1RFWENPT1JENiwgU0VNQU5USUNfVEVYQ09PUkQ3LFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMRU5EX05PTkUsIEJMRU5EX05PUk1BTCwgTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVELFxuICAgIFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLFxuICAgIEFTUEVDVF9NQU5VQUwsIEFTUEVDVF9BVVRPLCBTUEVDT0NDX0FPXG59IGZyb20gJy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IExpZ2h0LCBsaWdodFR5cGVzIH0gZnJvbSAnLi4vLi4vc2NlbmUvbGlnaHQuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uLy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNb3JwaFRhcmdldCB9IGZyb20gJy4uLy4uL3NjZW5lL21vcnBoLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBjYWxjdWxhdGVOb3JtYWxzIH0gZnJvbSAnLi4vLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBSZW5kZXIgfSBmcm9tICcuLi8uLi9zY2VuZS9yZW5kZXIuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uLy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBJTlRFUlBPTEFUSU9OX0NVQklDLCBJTlRFUlBPTEFUSU9OX0xJTkVBUiwgSU5URVJQT0xBVElPTl9TVEVQIH0gZnJvbSAnLi4vYW5pbS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQW5pbUN1cnZlIH0gZnJvbSAnLi4vYW5pbS9ldmFsdWF0b3IvYW5pbS1jdXJ2ZS5qcyc7XG5pbXBvcnQgeyBBbmltRGF0YSB9IGZyb20gJy4uL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyc7XG5pbXBvcnQgeyBBbmltVHJhY2sgfSBmcm9tICcuLi9hbmltL2V2YWx1YXRvci9hbmltLXRyYWNrLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vYXNzZXQvYXNzZXQuanMnO1xuaW1wb3J0IHsgQUJTT0xVVEVfVVJMIH0gZnJvbSAnLi4vYXNzZXQvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgZHJhY29EZWNvZGUgfSBmcm9tICcuL2RyYWNvLWRlY29kZXIuanMnO1xuXG4vLyByZXNvdXJjZXMgbG9hZGVkIGZyb20gR0xCIGZpbGUgdGhhdCB0aGUgcGFyc2VyIHJldHVybnNcbmNsYXNzIEdsYlJlc291cmNlcyB7XG4gICAgZ2x0ZjtcblxuICAgIG5vZGVzO1xuXG4gICAgc2NlbmVzO1xuXG4gICAgYW5pbWF0aW9ucztcblxuICAgIHRleHR1cmVzO1xuXG4gICAgbWF0ZXJpYWxzO1xuXG4gICAgdmFyaWFudHM7XG5cbiAgICBtZXNoVmFyaWFudHM7XG5cbiAgICBtZXNoRGVmYXVsdE1hdGVyaWFscztcblxuICAgIHJlbmRlcnM7XG5cbiAgICBza2lucztcblxuICAgIGxpZ2h0cztcblxuICAgIGNhbWVyYXM7XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyByZW5kZXIgbmVlZHMgdG8gZGVjIHJlZiBtZXNoZXNcbiAgICAgICAgaWYgKHRoaXMucmVuZGVycykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJzLmZvckVhY2goKHJlbmRlcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlbmRlci5tZXNoZXMgPSBudWxsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNvbnN0IGlzRGF0YVVSSSA9ICh1cmkpID0+IHtcbiAgICByZXR1cm4gL15kYXRhOi4qLC4qJC9pLnRlc3QodXJpKTtcbn07XG5cbmNvbnN0IGdldERhdGFVUklNaW1lVHlwZSA9ICh1cmkpID0+IHtcbiAgICByZXR1cm4gdXJpLnN1YnN0cmluZyh1cmkuaW5kZXhPZignOicpICsgMSwgdXJpLmluZGV4T2YoJzsnKSk7XG59O1xuXG5jb25zdCBnZXROdW1Db21wb25lbnRzID0gKGFjY2Vzc29yVHlwZSkgPT4ge1xuICAgIHN3aXRjaCAoYWNjZXNzb3JUeXBlKSB7XG4gICAgICAgIGNhc2UgJ1NDQUxBUic6IHJldHVybiAxO1xuICAgICAgICBjYXNlICdWRUMyJzogcmV0dXJuIDI7XG4gICAgICAgIGNhc2UgJ1ZFQzMnOiByZXR1cm4gMztcbiAgICAgICAgY2FzZSAnVkVDNCc6IHJldHVybiA0O1xuICAgICAgICBjYXNlICdNQVQyJzogcmV0dXJuIDQ7XG4gICAgICAgIGNhc2UgJ01BVDMnOiByZXR1cm4gOTtcbiAgICAgICAgY2FzZSAnTUFUNCc6IHJldHVybiAxNjtcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDM7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50VHlwZSA9IChjb21wb25lbnRUeXBlKSA9PiB7XG4gICAgc3dpdGNoIChjb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgNTEyMDogcmV0dXJuIFRZUEVfSU5UODtcbiAgICAgICAgY2FzZSA1MTIxOiByZXR1cm4gVFlQRV9VSU5UODtcbiAgICAgICAgY2FzZSA1MTIyOiByZXR1cm4gVFlQRV9JTlQxNjtcbiAgICAgICAgY2FzZSA1MTIzOiByZXR1cm4gVFlQRV9VSU5UMTY7XG4gICAgICAgIGNhc2UgNTEyNDogcmV0dXJuIFRZUEVfSU5UMzI7XG4gICAgICAgIGNhc2UgNTEyNTogcmV0dXJuIFRZUEVfVUlOVDMyO1xuICAgICAgICBjYXNlIDUxMjY6IHJldHVybiBUWVBFX0ZMT0FUMzI7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiAwO1xuICAgIH1cbn07XG5cbmNvbnN0IGdldENvbXBvbmVudFNpemVJbkJ5dGVzID0gKGNvbXBvbmVudFR5cGUpID0+IHtcbiAgICBzd2l0Y2ggKGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY2FzZSA1MTIwOiByZXR1cm4gMTsgICAgLy8gaW50OFxuICAgICAgICBjYXNlIDUxMjE6IHJldHVybiAxOyAgICAvLyB1aW50OFxuICAgICAgICBjYXNlIDUxMjI6IHJldHVybiAyOyAgICAvLyBpbnQxNlxuICAgICAgICBjYXNlIDUxMjM6IHJldHVybiAyOyAgICAvLyB1aW50MTZcbiAgICAgICAgY2FzZSA1MTI0OiByZXR1cm4gNDsgICAgLy8gaW50MzJcbiAgICAgICAgY2FzZSA1MTI1OiByZXR1cm4gNDsgICAgLy8gdWludDMyXG4gICAgICAgIGNhc2UgNTEyNjogcmV0dXJuIDQ7ICAgIC8vIGZsb2F0MzJcbiAgICAgICAgZGVmYXVsdDogcmV0dXJuIDA7XG4gICAgfVxufTtcblxuY29uc3QgZ2V0Q29tcG9uZW50RGF0YVR5cGUgPSAoY29tcG9uZW50VHlwZSkgPT4ge1xuICAgIHN3aXRjaCAoY29tcG9uZW50VHlwZSkge1xuICAgICAgICBjYXNlIDUxMjA6IHJldHVybiBJbnQ4QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMTogcmV0dXJuIFVpbnQ4QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMjogcmV0dXJuIEludDE2QXJyYXk7XG4gICAgICAgIGNhc2UgNTEyMzogcmV0dXJuIFVpbnQxNkFycmF5O1xuICAgICAgICBjYXNlIDUxMjQ6IHJldHVybiBJbnQzMkFycmF5O1xuICAgICAgICBjYXNlIDUxMjU6IHJldHVybiBVaW50MzJBcnJheTtcbiAgICAgICAgY2FzZSA1MTI2OiByZXR1cm4gRmxvYXQzMkFycmF5O1xuICAgICAgICBkZWZhdWx0OiByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xuXG5jb25zdCBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcCA9IHtcbiAgICAnUE9TSVRJT04nOiBTRU1BTlRJQ19QT1NJVElPTixcbiAgICAnTk9STUFMJzogU0VNQU5USUNfTk9STUFMLFxuICAgICdUQU5HRU5UJzogU0VNQU5USUNfVEFOR0VOVCxcbiAgICAnQ09MT1JfMCc6IFNFTUFOVElDX0NPTE9SLFxuICAgICdKT0lOVFNfMCc6IFNFTUFOVElDX0JMRU5ESU5ESUNFUyxcbiAgICAnV0VJR0hUU18wJzogU0VNQU5USUNfQkxFTkRXRUlHSFQsXG4gICAgJ1RFWENPT1JEXzAnOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgJ1RFWENPT1JEXzEnOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgJ1RFWENPT1JEXzInOiBTRU1BTlRJQ19URVhDT09SRDIsXG4gICAgJ1RFWENPT1JEXzMnOiBTRU1BTlRJQ19URVhDT09SRDMsXG4gICAgJ1RFWENPT1JEXzQnOiBTRU1BTlRJQ19URVhDT09SRDQsXG4gICAgJ1RFWENPT1JEXzUnOiBTRU1BTlRJQ19URVhDT09SRDUsXG4gICAgJ1RFWENPT1JEXzYnOiBTRU1BTlRJQ19URVhDT09SRDYsXG4gICAgJ1RFWENPT1JEXzcnOiBTRU1BTlRJQ19URVhDT09SRDdcbn07XG5cbi8vIG9yZGVyIHZlcnRleERlc2MgdG8gbWF0Y2ggdGhlIHJlc3Qgb2YgdGhlIGVuZ2luZVxuY29uc3QgYXR0cmlidXRlT3JkZXIgPSB7XG4gICAgW1NFTUFOVElDX1BPU0lUSU9OXTogMCxcbiAgICBbU0VNQU5USUNfTk9STUFMXTogMSxcbiAgICBbU0VNQU5USUNfVEFOR0VOVF06IDIsXG4gICAgW1NFTUFOVElDX0NPTE9SXTogMyxcbiAgICBbU0VNQU5USUNfQkxFTkRJTkRJQ0VTXTogNCxcbiAgICBbU0VNQU5USUNfQkxFTkRXRUlHSFRdOiA1LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDBdOiA2LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDFdOiA3LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDJdOiA4LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDNdOiA5LFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDRdOiAxMCxcbiAgICBbU0VNQU5USUNfVEVYQ09PUkQ1XTogMTEsXG4gICAgW1NFTUFOVElDX1RFWENPT1JENl06IDEyLFxuICAgIFtTRU1BTlRJQ19URVhDT09SRDddOiAxM1xufTtcblxuLy8gcmV0dXJucyBhIGZ1bmN0aW9uIGZvciBkZXF1YW50aXppbmcgdGhlIGRhdGEgdHlwZVxuY29uc3QgZ2V0RGVxdWFudGl6ZUZ1bmMgPSAoc3JjVHlwZSkgPT4ge1xuICAgIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vS2hyb25vc0dyb3VwL2dsVEYvdHJlZS9tYXN0ZXIvZXh0ZW5zaW9ucy8yLjAvS2hyb25vcy9LSFJfbWVzaF9xdWFudGl6YXRpb24jZW5jb2RpbmctcXVhbnRpemVkLWRhdGFcbiAgICBzd2l0Y2ggKHNyY1R5cGUpIHtcbiAgICAgICAgY2FzZSBUWVBFX0lOVDg6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAxMjcuMCwgLTEuMCk7XG4gICAgICAgIGNhc2UgVFlQRV9VSU5UODogcmV0dXJuIHggPT4geCAvIDI1NS4wO1xuICAgICAgICBjYXNlIFRZUEVfSU5UMTY6IHJldHVybiB4ID0+IE1hdGgubWF4KHggLyAzMjc2Ny4wLCAtMS4wKTtcbiAgICAgICAgY2FzZSBUWVBFX1VJTlQxNjogcmV0dXJuIHggPT4geCAvIDY1NTM1LjA7XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiB4ID0+IHg7XG4gICAgfVxufTtcblxuLy8gZGVxdWFudGl6ZSBhbiBhcnJheSBvZiBkYXRhXG5jb25zdCBkZXF1YW50aXplQXJyYXkgPSAoZHN0QXJyYXksIHNyY0FycmF5LCBzcmNUeXBlKSA9PiB7XG4gICAgY29uc3QgY29udkZ1bmMgPSBnZXREZXF1YW50aXplRnVuYyhzcmNUeXBlKTtcbiAgICBjb25zdCBsZW4gPSBzcmNBcnJheS5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICBkc3RBcnJheVtpXSA9IGNvbnZGdW5jKHNyY0FycmF5W2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIGRzdEFycmF5O1xufTtcblxuLy8gZ2V0IGFjY2Vzc29yIGRhdGEsIG1ha2luZyBhIGNvcHkgYW5kIHBhdGNoaW5nIGluIHRoZSBjYXNlIG9mIGEgc3BhcnNlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckRhdGEgPSAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgZmxhdHRlbiA9IGZhbHNlKSA9PiB7XG4gICAgY29uc3QgbnVtQ29tcG9uZW50cyA9IGdldE51bUNvbXBvbmVudHMoZ2x0ZkFjY2Vzc29yLnR5cGUpO1xuICAgIGNvbnN0IGRhdGFUeXBlID0gZ2V0Q29tcG9uZW50RGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvbXBvbmVudFR5cGUpO1xuICAgIGlmICghZGF0YVR5cGUpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IHJlc3VsdDtcblxuICAgIGlmIChnbHRmQWNjZXNzb3Iuc3BhcnNlKSB7XG4gICAgICAgIC8vIGhhbmRsZSBzcGFyc2UgZGF0YVxuICAgICAgICBjb25zdCBzcGFyc2UgPSBnbHRmQWNjZXNzb3Iuc3BhcnNlO1xuXG4gICAgICAgIC8vIGdldCBpbmRpY2VzIGRhdGFcbiAgICAgICAgY29uc3QgaW5kaWNlc0FjY2Vzc29yID0ge1xuICAgICAgICAgICAgY291bnQ6IHNwYXJzZS5jb3VudCxcbiAgICAgICAgICAgIHR5cGU6ICdTQ0FMQVInXG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGluZGljZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbihpbmRpY2VzQWNjZXNzb3IsIHNwYXJzZS5pbmRpY2VzKSwgYnVmZmVyVmlld3MsIHRydWUpO1xuXG4gICAgICAgIC8vIGRhdGEgdmFsdWVzIGRhdGFcbiAgICAgICAgY29uc3QgdmFsdWVzQWNjZXNzb3IgPSB7XG4gICAgICAgICAgICBjb3VudDogc3BhcnNlLmNvdW50LFxuICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGUsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiBnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZVxuICAgICAgICB9O1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBnZXRBY2Nlc3NvckRhdGEoT2JqZWN0LmFzc2lnbih2YWx1ZXNBY2Nlc3Nvciwgc3BhcnNlLnZhbHVlcyksIGJ1ZmZlclZpZXdzLCB0cnVlKTtcblxuICAgICAgICAvLyBnZXQgYmFzZSBkYXRhXG4gICAgICAgIGlmIChnbHRmQWNjZXNzb3IuaGFzT3duUHJvcGVydHkoJ2J1ZmZlclZpZXcnKSkge1xuICAgICAgICAgICAgY29uc3QgYmFzZUFjY2Vzc29yID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXc6IGdsdGZBY2Nlc3Nvci5idWZmZXJWaWV3LFxuICAgICAgICAgICAgICAgIGJ5dGVPZmZzZXQ6IGdsdGZBY2Nlc3Nvci5ieXRlT2Zmc2V0LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgIGNvdW50OiBnbHRmQWNjZXNzb3IuY291bnQsXG4gICAgICAgICAgICAgICAgdHlwZTogZ2x0ZkFjY2Vzc29yLnR5cGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICAvLyBtYWtlIGEgY29weSBvZiB0aGUgYmFzZSBkYXRhIHNpbmNlIHdlJ2xsIHBhdGNoIHRoZSB2YWx1ZXNcbiAgICAgICAgICAgIHJlc3VsdCA9IGdldEFjY2Vzc29yRGF0YShiYXNlQWNjZXNzb3IsIGJ1ZmZlclZpZXdzLCB0cnVlKS5zbGljZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdGhlcmUgaXMgbm8gYmFzZSBkYXRhLCBjcmVhdGUgZW1wdHkgMCdkIG91dCBkYXRhXG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgZGF0YVR5cGUoZ2x0ZkFjY2Vzc29yLmNvdW50ICogbnVtQ29tcG9uZW50cyk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwYXJzZS5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRJbmRleCA9IGluZGljZXNbaV07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bUNvbXBvbmVudHM7ICsraikge1xuICAgICAgICAgICAgICAgIHJlc3VsdFt0YXJnZXRJbmRleCAqIG51bUNvbXBvbmVudHMgKyBqXSA9IHZhbHVlc1tpICogbnVtQ29tcG9uZW50cyArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGdsdGZBY2Nlc3Nvci5oYXNPd25Qcm9wZXJ0eShcImJ1ZmZlclZpZXdcIikpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZmZlclZpZXcgPSBidWZmZXJWaWV3c1tnbHRmQWNjZXNzb3IuYnVmZmVyVmlld107XG4gICAgICAgICAgICBpZiAoZmxhdHRlbiAmJiBidWZmZXJWaWV3Lmhhc093blByb3BlcnR5KCdieXRlU3RyaWRlJykpIHtcbiAgICAgICAgICAgICAgICAvLyBmbGF0dGVuIHN0cmlkZGVuIGRhdGFcbiAgICAgICAgICAgICAgICBjb25zdCBieXRlc1BlckVsZW1lbnQgPSBudW1Db21wb25lbnRzICogZGF0YVR5cGUuQllURVNfUEVSX0VMRU1FTlQ7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RvcmFnZSA9IG5ldyBBcnJheUJ1ZmZlcihnbHRmQWNjZXNzb3IuY291bnQgKiBieXRlc1BlckVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRtcEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoc3RvcmFnZSk7XG5cbiAgICAgICAgICAgICAgICBsZXQgZHN0T2Zmc2V0ID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGZBY2Nlc3Nvci5jb3VudDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gYWRkIGJ1ZmZlclZpZXcuYnl0ZU9mZnNldCBiZWNhdXNlIGFjY2Vzc29yIHRha2VzIHRoaXMgaW50byBhY2NvdW50XG4gICAgICAgICAgICAgICAgICAgIGxldCBzcmNPZmZzZXQgPSAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCkgKyBpICogYnVmZmVyVmlldy5ieXRlU3RyaWRlO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBiID0gMDsgYiA8IGJ5dGVzUGVyRWxlbWVudDsgKytiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0bXBBcnJheVtkc3RPZmZzZXQrK10gPSBidWZmZXJWaWV3W3NyY09mZnNldCsrXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG5ldyBkYXRhVHlwZShzdG9yYWdlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGJ1ZmZlclZpZXcuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXJWaWV3LmJ5dGVPZmZzZXQgKyAoZ2x0ZkFjY2Vzc29yLmJ5dGVPZmZzZXQgfHwgMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGRhdGFUeXBlKGdsdGZBY2Nlc3Nvci5jb3VudCAqIG51bUNvbXBvbmVudHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIGdldCBhY2Nlc3NvciBkYXRhIGFzICh1bm5vcm1hbGl6ZWQsIHVucXVhbnRpemVkKSBGbG9hdDMyIGRhdGFcbmNvbnN0IGdldEFjY2Vzc29yRGF0YUZsb2F0MzIgPSAoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBnZXRBY2Nlc3NvckRhdGEoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cywgdHJ1ZSk7XG4gICAgaWYgKGRhdGEgaW5zdGFuY2VvZiBGbG9hdDMyQXJyYXkgfHwgIWdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIC8vIGlmIHRoZSBzb3VyY2UgZGF0YSBpcyBxdWFudGl6ZWQgKHNheSB0byBpbnQxNiksIGJ1dCBub3Qgbm9ybWFsaXplZFxuICAgICAgICAvLyB0aGVuIHJlYWRpbmcgdGhlIHZhbHVlcyBvZiB0aGUgYXJyYXkgaXMgdGhlIHNhbWUgd2hldGhlciB0aGUgdmFsdWVzXG4gICAgICAgIC8vIGFyZSBzdG9yZWQgYXMgZmxvYXQzMiBvciBpbnQxNi4gc28gcHJvYmFibHkgbm8gbmVlZCB0byBjb252ZXJ0IHRvXG4gICAgICAgIC8vIGZsb2F0MzIuXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIGNvbnN0IGZsb2F0MzJEYXRhID0gbmV3IEZsb2F0MzJBcnJheShkYXRhLmxlbmd0aCk7XG4gICAgZGVxdWFudGl6ZUFycmF5KGZsb2F0MzJEYXRhLCBkYXRhLCBnZXRDb21wb25lbnRUeXBlKGdsdGZBY2Nlc3Nvci5jb21wb25lbnRUeXBlKSk7XG4gICAgcmV0dXJuIGZsb2F0MzJEYXRhO1xufTtcblxuLy8gcmV0dXJucyBhIGRlcXVhbnRpemVkIGJvdW5kaW5nIGJveCBmb3IgdGhlIGFjY2Vzc29yXG5jb25zdCBnZXRBY2Nlc3NvckJvdW5kaW5nQm94ID0gKGdsdGZBY2Nlc3NvcikgPT4ge1xuICAgIGxldCBtaW4gPSBnbHRmQWNjZXNzb3IubWluO1xuICAgIGxldCBtYXggPSBnbHRmQWNjZXNzb3IubWF4O1xuICAgIGlmICghbWluIHx8ICFtYXgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgaWYgKGdsdGZBY2Nlc3Nvci5ub3JtYWxpemVkKSB7XG4gICAgICAgIGNvbnN0IGN0eXBlID0gZ2V0Q29tcG9uZW50VHlwZShnbHRmQWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG4gICAgICAgIG1pbiA9IGRlcXVhbnRpemVBcnJheShbXSwgbWluLCBjdHlwZSk7XG4gICAgICAgIG1heCA9IGRlcXVhbnRpemVBcnJheShbXSwgbWF4LCBjdHlwZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBCb3VuZGluZ0JveChcbiAgICAgICAgbmV3IFZlYzMoKG1heFswXSArIG1pblswXSkgKiAwLjUsIChtYXhbMV0gKyBtaW5bMV0pICogMC41LCAobWF4WzJdICsgbWluWzJdKSAqIDAuNSksXG4gICAgICAgIG5ldyBWZWMzKChtYXhbMF0gLSBtaW5bMF0pICogMC41LCAobWF4WzFdIC0gbWluWzFdKSAqIDAuNSwgKG1heFsyXSAtIG1pblsyXSkgKiAwLjUpXG4gICAgKTtcbn07XG5cbmNvbnN0IGdldFByaW1pdGl2ZVR5cGUgPSAocHJpbWl0aXZlKSA9PiB7XG4gICAgaWYgKCFwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ21vZGUnKSkge1xuICAgICAgICByZXR1cm4gUFJJTUlUSVZFX1RSSUFOR0xFUztcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHByaW1pdGl2ZS5tb2RlKSB7XG4gICAgICAgIGNhc2UgMDogcmV0dXJuIFBSSU1JVElWRV9QT0lOVFM7XG4gICAgICAgIGNhc2UgMTogcmV0dXJuIFBSSU1JVElWRV9MSU5FUztcbiAgICAgICAgY2FzZSAyOiByZXR1cm4gUFJJTUlUSVZFX0xJTkVMT09QO1xuICAgICAgICBjYXNlIDM6IHJldHVybiBQUklNSVRJVkVfTElORVNUUklQO1xuICAgICAgICBjYXNlIDQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgICAgICBjYXNlIDU6IHJldHVybiBQUklNSVRJVkVfVFJJU1RSSVA7XG4gICAgICAgIGNhc2UgNjogcmV0dXJuIFBSSU1JVElWRV9UUklGQU47XG4gICAgICAgIGRlZmF1bHQ6IHJldHVybiBQUklNSVRJVkVfVFJJQU5HTEVTO1xuICAgIH1cbn07XG5cbmNvbnN0IGdlbmVyYXRlSW5kaWNlcyA9IChudW1WZXJ0aWNlcykgPT4ge1xuICAgIGNvbnN0IGR1bW15SW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShudW1WZXJ0aWNlcyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBudW1WZXJ0aWNlczsgaSsrKSB7XG4gICAgICAgIGR1bW15SW5kaWNlc1tpXSA9IGk7XG4gICAgfVxuICAgIHJldHVybiBkdW1teUluZGljZXM7XG59O1xuXG5jb25zdCBnZW5lcmF0ZU5vcm1hbHMgPSAoc291cmNlRGVzYywgaW5kaWNlcykgPT4ge1xuICAgIC8vIGdldCBwb3NpdGlvbnNcbiAgICBjb25zdCBwID0gc291cmNlRGVzY1tTRU1BTlRJQ19QT1NJVElPTl07XG4gICAgaWYgKCFwIHx8IHAuY29tcG9uZW50cyAhPT0gMykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IHBvc2l0aW9ucztcbiAgICBpZiAocC5zaXplICE9PSBwLnN0cmlkZSkge1xuICAgICAgICAvLyBleHRyYWN0IHBvc2l0aW9ucyB3aGljaCBhcmVuJ3QgdGlnaHRseSBwYWNrZWRcbiAgICAgICAgY29uc3Qgc3JjU3RyaWRlID0gcC5zdHJpZGUgLyB0eXBlZEFycmF5VHlwZXNCeXRlU2l6ZVtwLnR5cGVdO1xuICAgICAgICBjb25zdCBzcmMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogc3JjU3RyaWRlKTtcbiAgICAgICAgcG9zaXRpb25zID0gbmV3IHR5cGVkQXJyYXlUeXBlc1twLnR5cGVdKHAuY291bnQgKiAzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwLmNvdW50OyArK2kpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDBdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAwXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDFdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAxXTtcbiAgICAgICAgICAgIHBvc2l0aW9uc1tpICogMyArIDJdID0gc3JjW2kgKiBzcmNTdHJpZGUgKyAyXTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBvc2l0aW9uIGRhdGEgaXMgdGlnaHRseSBwYWNrZWQgc28gd2UgY2FuIHVzZSBpdCBkaXJlY3RseVxuICAgICAgICBwb3NpdGlvbnMgPSBuZXcgdHlwZWRBcnJheVR5cGVzW3AudHlwZV0ocC5idWZmZXIsIHAub2Zmc2V0LCBwLmNvdW50ICogMyk7XG4gICAgfVxuXG4gICAgY29uc3QgbnVtVmVydGljZXMgPSBwLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgaW5kaWNlcyBpZiBuZWNlc3NhcnlcbiAgICBpZiAoIWluZGljZXMpIHtcbiAgICAgICAgaW5kaWNlcyA9IGdlbmVyYXRlSW5kaWNlcyhudW1WZXJ0aWNlcyk7XG4gICAgfVxuXG4gICAgLy8gZ2VuZXJhdGUgbm9ybWFsc1xuICAgIGNvbnN0IG5vcm1hbHNUZW1wID0gY2FsY3VsYXRlTm9ybWFscyhwb3NpdGlvbnMsIGluZGljZXMpO1xuICAgIGNvbnN0IG5vcm1hbHMgPSBuZXcgRmxvYXQzMkFycmF5KG5vcm1hbHNUZW1wLmxlbmd0aCk7XG4gICAgbm9ybWFscy5zZXQobm9ybWFsc1RlbXApO1xuXG4gICAgc291cmNlRGVzY1tTRU1BTlRJQ19OT1JNQUxdID0ge1xuICAgICAgICBidWZmZXI6IG5vcm1hbHMuYnVmZmVyLFxuICAgICAgICBzaXplOiAxMixcbiAgICAgICAgb2Zmc2V0OiAwLFxuICAgICAgICBzdHJpZGU6IDEyLFxuICAgICAgICBjb3VudDogbnVtVmVydGljZXMsXG4gICAgICAgIGNvbXBvbmVudHM6IDMsXG4gICAgICAgIHR5cGU6IFRZUEVfRkxPQVQzMlxuICAgIH07XG59O1xuXG5jb25zdCBmbGlwVGV4Q29vcmRWcyA9ICh2ZXJ0ZXhCdWZmZXIpID0+IHtcbiAgICBsZXQgaSwgajtcblxuICAgIGNvbnN0IGZsb2F0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IHNob3J0T2Zmc2V0cyA9IFtdO1xuICAgIGNvbnN0IGJ5dGVPZmZzZXRzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIGlmIChlbGVtZW50Lm5hbWUgPT09IFNFTUFOVElDX1RFWENPT1JEMCB8fFxuICAgICAgICAgICAgZWxlbWVudC5uYW1lID09PSBTRU1BTlRJQ19URVhDT09SRDEpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoZWxlbWVudC5kYXRhVHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9GTE9BVDMyOlxuICAgICAgICAgICAgICAgICAgICBmbG9hdE9mZnNldHMucHVzaCh7IG9mZnNldDogZWxlbWVudC5vZmZzZXQgLyA0ICsgMSwgc3RyaWRlOiBlbGVtZW50LnN0cmlkZSAvIDQgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgVFlQRV9VSU5UMTY6XG4gICAgICAgICAgICAgICAgICAgIHNob3J0T2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCAvIDIgKyAxLCBzdHJpZGU6IGVsZW1lbnQuc3RyaWRlIC8gMiB9KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBUWVBFX1VJTlQ4OlxuICAgICAgICAgICAgICAgICAgICBieXRlT2Zmc2V0cy5wdXNoKHsgb2Zmc2V0OiBlbGVtZW50Lm9mZnNldCArIDEsIHN0cmlkZTogZWxlbWVudC5zdHJpZGUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZmxpcCA9IChvZmZzZXRzLCB0eXBlLCBvbmUpID0+IHtcbiAgICAgICAgY29uc3QgdHlwZWRBcnJheSA9IG5ldyB0eXBlKHZlcnRleEJ1ZmZlci5zdG9yYWdlKTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG9mZnNldHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGxldCBpbmRleCA9IG9mZnNldHNbaV0ub2Zmc2V0O1xuICAgICAgICAgICAgY29uc3Qgc3RyaWRlID0gb2Zmc2V0c1tpXS5zdHJpZGU7XG4gICAgICAgICAgICBmb3IgKGogPSAwOyBqIDwgdmVydGV4QnVmZmVyLm51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICB0eXBlZEFycmF5W2luZGV4XSA9IG9uZSAtIHR5cGVkQXJyYXlbaW5kZXhdO1xuICAgICAgICAgICAgICAgIGluZGV4ICs9IHN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBpZiAoZmxvYXRPZmZzZXRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZmxpcChmbG9hdE9mZnNldHMsIEZsb2F0MzJBcnJheSwgMS4wKTtcbiAgICB9XG4gICAgaWYgKHNob3J0T2Zmc2V0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZsaXAoc2hvcnRPZmZzZXRzLCBVaW50MTZBcnJheSwgNjU1MzUpO1xuICAgIH1cbiAgICBpZiAoYnl0ZU9mZnNldHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmbGlwKGJ5dGVPZmZzZXRzLCBVaW50OEFycmF5LCAyNTUpO1xuICAgIH1cbn07XG5cbi8vIGdpdmVuIGEgdGV4dHVyZSwgY2xvbmUgaXRcbi8vIE5PVEU6IENQVS1zaWRlIHRleHR1cmUgZGF0YSB3aWxsIGJlIHNoYXJlZCBidXQgR1BVIG1lbW9yeSB3aWxsIGJlIGR1cGxpY2F0ZWRcbmNvbnN0IGNsb25lVGV4dHVyZSA9ICh0ZXh0dXJlKSA9PiB7XG4gICAgY29uc3Qgc2hhbGxvd0NvcHlMZXZlbHMgPSAodGV4dHVyZSkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgbWlwID0gMDsgbWlwIDwgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aDsgKyttaXApIHtcbiAgICAgICAgICAgIGxldCBsZXZlbCA9IFtdO1xuICAgICAgICAgICAgaWYgKHRleHR1cmUuY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgKytmYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldmVsLnB1c2godGV4dHVyZS5fbGV2ZWxzW21pcF1bZmFjZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV2ZWwgPSB0ZXh0dXJlLl9sZXZlbHNbbWlwXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgVGV4dHVyZSh0ZXh0dXJlLmRldmljZSwgdGV4dHVyZSk7ICAgLy8gZHVwbGljYXRlIHRleHR1cmVcbiAgICByZXN1bHQuX2xldmVscyA9IHNoYWxsb3dDb3B5TGV2ZWxzKHRleHR1cmUpOyAgICAgICAgICAgIC8vIHNoYWxsb3cgY29weSB0aGUgbGV2ZWxzIHN0cnVjdHVyZVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBnaXZlbiBhIHRleHR1cmUgYXNzZXQsIGNsb25lIGl0XG5jb25zdCBjbG9uZVRleHR1cmVBc3NldCA9IChzcmMpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBuZXcgQXNzZXQoc3JjLm5hbWUgKyAnX2Nsb25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNyYy5maWxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMuZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3JjLm9wdGlvbnMpO1xuICAgIHJlc3VsdC5sb2FkZWQgPSB0cnVlO1xuICAgIHJlc3VsdC5yZXNvdXJjZSA9IGNsb25lVGV4dHVyZShzcmMucmVzb3VyY2UpO1xuICAgIHNyYy5yZWdpc3RyeS5hZGQocmVzdWx0KTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwgPSAoZGV2aWNlLCBzb3VyY2VEZXNjLCBmbGlwVikgPT4ge1xuICAgIGNvbnN0IHBvc2l0aW9uRGVzYyA9IHNvdXJjZURlc2NbU0VNQU5USUNfUE9TSVRJT05dO1xuICAgIGlmICghcG9zaXRpb25EZXNjKSB7XG4gICAgICAgIC8vIGlnbm9yZSBtZXNoZXMgd2l0aG91dCBwb3NpdGlvbnNcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IG51bVZlcnRpY2VzID0gcG9zaXRpb25EZXNjLmNvdW50O1xuXG4gICAgLy8gZ2VuZXJhdGUgdmVydGV4RGVzYyBlbGVtZW50c1xuICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcbiAgICBmb3IgKGNvbnN0IHNlbWFudGljIGluIHNvdXJjZURlc2MpIHtcbiAgICAgICAgaWYgKHNvdXJjZURlc2MuaGFzT3duUHJvcGVydHkoc2VtYW50aWMpKSB7XG4gICAgICAgICAgICB2ZXJ0ZXhEZXNjLnB1c2goe1xuICAgICAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBzb3VyY2VEZXNjW3NlbWFudGljXS5jb21wb25lbnRzLFxuICAgICAgICAgICAgICAgIHR5cGU6IHNvdXJjZURlc2Nbc2VtYW50aWNdLnR5cGUsXG4gICAgICAgICAgICAgICAgbm9ybWFsaXplOiAhIXNvdXJjZURlc2Nbc2VtYW50aWNdLm5vcm1hbGl6ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHZlcnRleCBlbGVtZW50cyBieSBlbmdpbmUtaWRlYWwgb3JkZXJcbiAgICB2ZXJ0ZXhEZXNjLnNvcnQoKGxocywgcmhzKSA9PiB7XG4gICAgICAgIHJldHVybiBhdHRyaWJ1dGVPcmRlcltsaHMuc2VtYW50aWNdIC0gYXR0cmlidXRlT3JkZXJbcmhzLnNlbWFudGljXTtcbiAgICB9KTtcblxuICAgIGxldCBpLCBqLCBrO1xuICAgIGxldCBzb3VyY2UsIHRhcmdldCwgc291cmNlT2Zmc2V0O1xuXG4gICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdChkZXZpY2UsIHZlcnRleERlc2MpO1xuXG4gICAgLy8gY2hlY2sgd2hldGhlciBzb3VyY2UgZGF0YSBpcyBjb3JyZWN0bHkgaW50ZXJsZWF2ZWRcbiAgICBsZXQgaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCA9IHRydWU7XG4gICAgZm9yIChpID0gMDsgaSA8IHZlcnRleEZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICB0YXJnZXQgPSB2ZXJ0ZXhGb3JtYXQuZWxlbWVudHNbaV07XG4gICAgICAgIHNvdXJjZSA9IHNvdXJjZURlc2NbdGFyZ2V0Lm5hbWVdO1xuICAgICAgICBzb3VyY2VPZmZzZXQgPSBzb3VyY2Uub2Zmc2V0IC0gcG9zaXRpb25EZXNjLm9mZnNldDtcbiAgICAgICAgaWYgKChzb3VyY2UuYnVmZmVyICE9PSBwb3NpdGlvbkRlc2MuYnVmZmVyKSB8fFxuICAgICAgICAgICAgKHNvdXJjZS5zdHJpZGUgIT09IHRhcmdldC5zdHJpZGUpIHx8XG4gICAgICAgICAgICAoc291cmNlLnNpemUgIT09IHRhcmdldC5zaXplKSB8fFxuICAgICAgICAgICAgKHNvdXJjZU9mZnNldCAhPT0gdGFyZ2V0Lm9mZnNldCkpIHtcbiAgICAgICAgICAgIGlzQ29ycmVjdGx5SW50ZXJsZWF2ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY3JlYXRlIHZlcnRleCBidWZmZXJcbiAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKGRldmljZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnRleEZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bVZlcnRpY2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQlVGRkVSX1NUQVRJQyk7XG5cbiAgICBjb25zdCB2ZXJ0ZXhEYXRhID0gdmVydGV4QnVmZmVyLmxvY2soKTtcbiAgICBjb25zdCB0YXJnZXRBcnJheSA9IG5ldyBVaW50MzJBcnJheSh2ZXJ0ZXhEYXRhKTtcbiAgICBsZXQgc291cmNlQXJyYXk7XG5cbiAgICBpZiAoaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCkge1xuICAgICAgICAvLyBjb3B5IGRhdGFcbiAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkocG9zaXRpb25EZXNjLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25EZXNjLm9mZnNldCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbnVtVmVydGljZXMgKiB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnNpemUgLyA0KTtcbiAgICAgICAgdGFyZ2V0QXJyYXkuc2V0KHNvdXJjZUFycmF5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgdGFyZ2V0U3RyaWRlLCBzb3VyY2VTdHJpZGU7XG4gICAgICAgIC8vIGNvcHkgZGF0YSBhbmQgaW50ZXJsZWF2ZVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50c1tpXTtcbiAgICAgICAgICAgIHRhcmdldFN0cmlkZSA9IHRhcmdldC5zdHJpZGUgLyA0O1xuXG4gICAgICAgICAgICBzb3VyY2UgPSBzb3VyY2VEZXNjW3RhcmdldC5uYW1lXTtcbiAgICAgICAgICAgIHNvdXJjZVN0cmlkZSA9IHNvdXJjZS5zdHJpZGUgLyA0O1xuICAgICAgICAgICAgLy8gZW5zdXJlIHdlIGRvbid0IGdvIGJleW9uZCB0aGUgZW5kIG9mIHRoZSBhcnJheWJ1ZmZlciB3aGVuIGRlYWxpbmcgd2l0aFxuICAgICAgICAgICAgLy8gaW50ZXJsYWNlZCB2ZXJ0ZXggZm9ybWF0c1xuICAgICAgICAgICAgc291cmNlQXJyYXkgPSBuZXcgVWludDMyQXJyYXkoc291cmNlLmJ1ZmZlciwgc291cmNlLm9mZnNldCwgKHNvdXJjZS5jb3VudCAtIDEpICogc291cmNlU3RyaWRlICsgKHNvdXJjZS5zaXplICsgMykgLyA0KTtcblxuICAgICAgICAgICAgbGV0IHNyYyA9IDA7XG4gICAgICAgICAgICBsZXQgZHN0ID0gdGFyZ2V0Lm9mZnNldCAvIDQ7XG4gICAgICAgICAgICBjb25zdCBrZW5kID0gTWF0aC5mbG9vcigoc291cmNlLnNpemUgKyAzKSAvIDQpO1xuICAgICAgICAgICAgZm9yIChqID0gMDsgaiA8IG51bVZlcnRpY2VzOyArK2opIHtcbiAgICAgICAgICAgICAgICBmb3IgKGsgPSAwOyBrIDwga2VuZDsgKytrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldEFycmF5W2RzdCArIGtdID0gc291cmNlQXJyYXlbc3JjICsga107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNyYyArPSBzb3VyY2VTdHJpZGU7XG4gICAgICAgICAgICAgICAgZHN0ICs9IHRhcmdldFN0cmlkZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChmbGlwVikge1xuICAgICAgICBmbGlwVGV4Q29vcmRWcyh2ZXJ0ZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIHZlcnRleEJ1ZmZlci51bmxvY2soKTtcblxuICAgIHJldHVybiB2ZXJ0ZXhCdWZmZXI7XG59O1xuXG5jb25zdCBjcmVhdGVWZXJ0ZXhCdWZmZXIgPSAoZGV2aWNlLCBhdHRyaWJ1dGVzLCBpbmRpY2VzLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBmbGlwViwgdmVydGV4QnVmZmVyRGljdCkgPT4ge1xuXG4gICAgLy8gZXh0cmFjdCBsaXN0IG9mIGF0dHJpYnV0ZXMgdG8gdXNlXG4gICAgY29uc3QgdXNlQXR0cmlidXRlcyA9IHt9O1xuICAgIGNvbnN0IGF0dHJpYklkcyA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBhdHRyaWIgaW4gYXR0cmlidXRlcykge1xuICAgICAgICBpZiAoYXR0cmlidXRlcy5oYXNPd25Qcm9wZXJ0eShhdHRyaWIpICYmIGdsdGZUb0VuZ2luZVNlbWFudGljTWFwLmhhc093blByb3BlcnR5KGF0dHJpYikpIHtcbiAgICAgICAgICAgIHVzZUF0dHJpYnV0ZXNbYXR0cmliXSA9IGF0dHJpYnV0ZXNbYXR0cmliXTtcblxuICAgICAgICAgICAgLy8gYnVpbGQgdW5pcXVlIGlkIGZvciBlYWNoIGF0dHJpYnV0ZSBpbiBmb3JtYXQ6IFNlbWFudGljOmFjY2Vzc29ySW5kZXhcbiAgICAgICAgICAgIGF0dHJpYklkcy5wdXNoKGF0dHJpYiArICc6JyArIGF0dHJpYnV0ZXNbYXR0cmliXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzb3J0IHVuaXF1ZSBpZHMgYW5kIGNyZWF0ZSB1bmlxdWUgdmVydGV4IGJ1ZmZlciBJRFxuICAgIGF0dHJpYklkcy5zb3J0KCk7XG4gICAgY29uc3QgdmJLZXkgPSBhdHRyaWJJZHMuam9pbigpO1xuXG4gICAgLy8gcmV0dXJuIGFscmVhZHkgY3JlYXRlZCB2ZXJ0ZXggYnVmZmVyIGlmIGlkZW50aWNhbFxuICAgIGxldCB2YiA9IHZlcnRleEJ1ZmZlckRpY3RbdmJLZXldO1xuICAgIGlmICghdmIpIHtcbiAgICAgICAgLy8gYnVpbGQgdmVydGV4IGJ1ZmZlciBmb3JtYXQgZGVzYyBhbmQgc291cmNlXG4gICAgICAgIGNvbnN0IHNvdXJjZURlc2MgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBhdHRyaWIgaW4gdXNlQXR0cmlidXRlcykge1xuICAgICAgICAgICAgY29uc3QgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbYXR0cmlidXRlc1thdHRyaWJdXTtcbiAgICAgICAgICAgIGNvbnN0IGFjY2Vzc29yRGF0YSA9IGdldEFjY2Vzc29yRGF0YShhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyVmlldyA9IGJ1ZmZlclZpZXdzW2FjY2Vzc29yLmJ1ZmZlclZpZXddO1xuICAgICAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFthdHRyaWJdO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSkgKiBnZXRDb21wb25lbnRTaXplSW5CeXRlcyhhY2Nlc3Nvci5jb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgIGNvbnN0IHN0cmlkZSA9IGJ1ZmZlclZpZXcgJiYgYnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpID8gYnVmZmVyVmlldy5ieXRlU3RyaWRlIDogc2l6ZTtcbiAgICAgICAgICAgIHNvdXJjZURlc2Nbc2VtYW50aWNdID0ge1xuICAgICAgICAgICAgICAgIGJ1ZmZlcjogYWNjZXNzb3JEYXRhLmJ1ZmZlcixcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplLFxuICAgICAgICAgICAgICAgIG9mZnNldDogYWNjZXNzb3JEYXRhLmJ5dGVPZmZzZXQsXG4gICAgICAgICAgICAgICAgc3RyaWRlOiBzdHJpZGUsXG4gICAgICAgICAgICAgICAgY291bnQ6IGFjY2Vzc29yLmNvdW50LFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSksXG4gICAgICAgICAgICAgICAgdHlwZTogZ2V0Q29tcG9uZW50VHlwZShhY2Nlc3Nvci5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgICAgICAgICBub3JtYWxpemU6IGFjY2Vzc29yLm5vcm1hbGl6ZWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBnZW5lcmF0ZSBub3JtYWxzIGlmIHRoZXkncmUgbWlzc2luZyAodGhpcyBzaG91bGQgcHJvYmFibHkgYmUgYSB1c2VyIG9wdGlvbilcbiAgICAgICAgaWYgKCFzb3VyY2VEZXNjLmhhc093blByb3BlcnR5KFNFTUFOVElDX05PUk1BTCkpIHtcbiAgICAgICAgICAgIGdlbmVyYXRlTm9ybWFscyhzb3VyY2VEZXNjLCBpbmRpY2VzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgc3RvcmUgaXQgaW4gdGhlIGRpY3Rpb25hcnlcbiAgICAgICAgdmIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXJJbnRlcm5hbChkZXZpY2UsIHNvdXJjZURlc2MsIGZsaXBWKTtcbiAgICAgICAgdmVydGV4QnVmZmVyRGljdFt2YktleV0gPSB2YjtcbiAgICB9XG5cbiAgICByZXR1cm4gdmI7XG59O1xuXG5jb25zdCBjcmVhdGVTa2luID0gKGRldmljZSwgZ2x0ZlNraW4sIGFjY2Vzc29ycywgYnVmZmVyVmlld3MsIG5vZGVzLCBnbGJTa2lucykgPT4ge1xuICAgIGxldCBpLCBqLCBiaW5kTWF0cml4O1xuICAgIGNvbnN0IGpvaW50cyA9IGdsdGZTa2luLmpvaW50cztcbiAgICBjb25zdCBudW1Kb2ludHMgPSBqb2ludHMubGVuZ3RoO1xuICAgIGNvbnN0IGlicCA9IFtdO1xuICAgIGlmIChnbHRmU2tpbi5oYXNPd25Qcm9wZXJ0eSgnaW52ZXJzZUJpbmRNYXRyaWNlcycpKSB7XG4gICAgICAgIGNvbnN0IGludmVyc2VCaW5kTWF0cmljZXMgPSBnbHRmU2tpbi5pbnZlcnNlQmluZE1hdHJpY2VzO1xuICAgICAgICBjb25zdCBpYm1EYXRhID0gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yc1tpbnZlcnNlQmluZE1hdHJpY2VzXSwgYnVmZmVyVmlld3MsIHRydWUpO1xuICAgICAgICBjb25zdCBpYm1WYWx1ZXMgPSBbXTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbnVtSm9pbnRzOyBpKyspIHtcbiAgICAgICAgICAgIGZvciAoaiA9IDA7IGogPCAxNjsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWJtVmFsdWVzW2pdID0gaWJtRGF0YVtpICogMTYgKyBqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJpbmRNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICAgICAgYmluZE1hdHJpeC5zZXQoaWJtVmFsdWVzKTtcbiAgICAgICAgICAgIGlicC5wdXNoKGJpbmRNYXRyaXgpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IG51bUpvaW50czsgaSsrKSB7XG4gICAgICAgICAgICBiaW5kTWF0cml4ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgICAgIGlicC5wdXNoKGJpbmRNYXRyaXgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgYm9uZU5hbWVzID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IG51bUpvaW50czsgaSsrKSB7XG4gICAgICAgIGJvbmVOYW1lc1tpXSA9IG5vZGVzW2pvaW50c1tpXV0ubmFtZTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgYSBjYWNoZSBrZXkgZnJvbSBib25lIG5hbWVzIGFuZCBzZWUgaWYgd2UgaGF2ZSBtYXRjaGluZyBza2luXG4gICAgY29uc3Qga2V5ID0gYm9uZU5hbWVzLmpvaW4oJyMnKTtcbiAgICBsZXQgc2tpbiA9IGdsYlNraW5zLmdldChrZXkpO1xuICAgIGlmICghc2tpbikge1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0aGUgc2tpbiBhbmQgYWRkIGl0IHRvIHRoZSBjYWNoZVxuICAgICAgICBza2luID0gbmV3IFNraW4oZGV2aWNlLCBpYnAsIGJvbmVOYW1lcyk7XG4gICAgICAgIGdsYlNraW5zLnNldChrZXksIHNraW4pO1xuICAgIH1cblxuICAgIHJldHVybiBza2luO1xufTtcblxuY29uc3QgY3JlYXRlRHJhY29NZXNoID0gKGRldmljZSwgcHJpbWl0aXZlLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBwcm9taXNlcykgPT4ge1xuICAgIC8vIGNyZWF0ZSB0aGUgbWVzaFxuICAgIGNvbnN0IHJlc3VsdCA9IG5ldyBNZXNoKGRldmljZSk7XG4gICAgcmVzdWx0LmFhYmIgPSBnZXRBY2Nlc3NvckJvdW5kaW5nQm94KGFjY2Vzc29yc1twcmltaXRpdmUuYXR0cmlidXRlcy5QT1NJVElPTl0pO1xuXG4gICAgLy8gY3JlYXRlIHZlcnRleCBkZXNjcmlwdGlvblxuICAgIGNvbnN0IHZlcnRleERlc2MgPSBbXTtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBpbmRleF0gb2YgT2JqZWN0LmVudHJpZXMocHJpbWl0aXZlLmF0dHJpYnV0ZXMpKSB7XG4gICAgICAgIGNvbnN0IGFjY2Vzc29yID0gYWNjZXNzb3JzW2luZGV4XTtcbiAgICAgICAgY29uc3Qgc2VtYW50aWMgPSBnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFtuYW1lXTtcbiAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IGdldENvbXBvbmVudFR5cGUoYWNjZXNzb3IuY29tcG9uZW50VHlwZSk7XG5cbiAgICAgICAgdmVydGV4RGVzYy5wdXNoKHtcbiAgICAgICAgICAgIHNlbWFudGljOiBzZW1hbnRpYyxcbiAgICAgICAgICAgIGNvbXBvbmVudHM6IGdldE51bUNvbXBvbmVudHMoYWNjZXNzb3IudHlwZSksXG4gICAgICAgICAgICB0eXBlOiBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgbm9ybWFsaXplOiBhY2Nlc3Nvci5ub3JtYWxpemVkID8/IChzZW1hbnRpYyA9PT0gU0VNQU5USUNfQ09MT1IgJiYgKGNvbXBvbmVudFR5cGUgPT09IFRZUEVfVUlOVDggfHwgY29tcG9uZW50VHlwZSA9PT0gVFlQRV9VSU5UMTYpKVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBkcmFjbyBkZWNvbXByZXNzb3Igd2lsbCBnZW5lcmF0ZSBub3JtYWxzIGlmIHRoZXkgYXJlIG1pc3NpbmdcbiAgICBpZiAoIXByaW1pdGl2ZT8uYXR0cmlidXRlcz8uTk9STUFMKSB7XG4gICAgICAgIHZlcnRleERlc2MucHVzaCh7XG4gICAgICAgICAgICBzZW1hbnRpYzogJ05PUk1BTCcsXG4gICAgICAgICAgICBjb21wb25lbnRzOiAzLFxuICAgICAgICAgICAgdHlwZTogVFlQRV9GTE9BVDMyXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByb21pc2VzLnB1c2gobmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyBkZWNvZGUgZHJhY28gZGF0YVxuICAgICAgICBjb25zdCBkcmFjb0V4dCA9IHByaW1pdGl2ZS5leHRlbnNpb25zLktIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uO1xuICAgICAgICBkcmFjb0RlY29kZShidWZmZXJWaWV3c1tkcmFjb0V4dC5idWZmZXJWaWV3XS5zbGljZSgpLmJ1ZmZlciwgKGVyciwgZGVjb21wcmVzc2VkRGF0YSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHdvcmtlciByZXBvcnRzIG9yZGVyIG9mIGF0dHJpYnV0ZXMgYXMgYXJyYXkgb2YgYXR0cmlidXRlIHVuaXF1ZV9pZFxuICAgICAgICAgICAgICAgIGNvbnN0IG9yZGVyID0geyB9O1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW25hbWUsIGluZGV4XSBvZiBPYmplY3QuZW50cmllcyhkcmFjb0V4dC5hdHRyaWJ1dGVzKSkge1xuICAgICAgICAgICAgICAgICAgICBvcmRlcltnbHRmVG9FbmdpbmVTZW1hbnRpY01hcFtuYW1lXV0gPSBkZWNvbXByZXNzZWREYXRhLmF0dHJpYnV0ZXMuaW5kZXhPZihpbmRleCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gb3JkZXIgdmVydGV4RGVzY1xuICAgICAgICAgICAgICAgIHZlcnRleERlc2Muc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3JkZXJbYS5zZW1hbnRpY10gLSBvcmRlcltiLnNlbWFudGljXTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleEZvcm1hdCA9IG5ldyBWZXJ0ZXhGb3JtYXQoZGV2aWNlLCB2ZXJ0ZXhEZXNjKTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSB2ZXJ0ZXggYnVmZmVyXG4gICAgICAgICAgICAgICAgY29uc3QgbnVtVmVydGljZXMgPSBkZWNvbXByZXNzZWREYXRhLnZlcnRpY2VzLmJ5dGVMZW5ndGggLyB2ZXJ0ZXhGb3JtYXQuc2l6ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRleEZvcm1hdCA9IG51bVZlcnRpY2VzIDw9IDY1NTM1ID8gSU5ERVhGT1JNQVRfVUlOVDE2IDogSU5ERVhGT1JNQVRfVUlOVDMyO1xuICAgICAgICAgICAgICAgIGNvbnN0IG51bUluZGljZXMgPSBkZWNvbXByZXNzZWREYXRhLmluZGljZXMuYnl0ZUxlbmd0aCAvIChudW1WZXJ0aWNlcyA8PSA2NTUzNSA/IDIgOiA0KTtcblxuICAgICAgICAgICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobnVtVmVydGljZXMgIT09IGFjY2Vzc29yc1twcmltaXRpdmUuYXR0cmlidXRlcy5QT1NJVElPTl0uY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ21lc2ggaGFzIGludmFsaWQgdmVydGV4IGNvdW50Jyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKG51bUluZGljZXMgIT09IGFjY2Vzc29yc1twcmltaXRpdmUuaW5kaWNlc10uY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ21lc2ggaGFzIGludmFsaWQgaW5kZXggY291bnQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gbmV3IFZlcnRleEJ1ZmZlcihkZXZpY2UsIHZlcnRleEZvcm1hdCwgbnVtVmVydGljZXMsIEJVRkZFUl9TVEFUSUMsIGRlY29tcHJlc3NlZERhdGEudmVydGljZXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gbmV3IEluZGV4QnVmZmVyKGRldmljZSwgaW5kZXhGb3JtYXQsIG51bUluZGljZXMsIEJVRkZFUl9TVEFUSUMsIGRlY29tcHJlc3NlZERhdGEuaW5kaWNlcyk7XG5cbiAgICAgICAgICAgICAgICByZXN1bHQudmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5pbmRleEJ1ZmZlclswXSA9IGluZGV4QnVmZmVyO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wcmltaXRpdmVbMF0udHlwZSA9IGdldFByaW1pdGl2ZVR5cGUocHJpbWl0aXZlKTtcbiAgICAgICAgICAgICAgICByZXN1bHQucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wcmltaXRpdmVbMF0uY291bnQgPSBpbmRleEJ1ZmZlciA/IG51bUluZGljZXMgOiBudW1WZXJ0aWNlcztcbiAgICAgICAgICAgICAgICByZXN1bHQucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSAhIWluZGV4QnVmZmVyO1xuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9KSk7XG5cbiAgICAvLyBoYW5kbGUgbWF0ZXJpYWwgdmFyaWFudHNcbiAgICBpZiAocHJpbWl0aXZlPy5leHRlbnNpb25zPy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzKSB7XG4gICAgICAgIGNvbnN0IHZhcmlhbnRzID0gcHJpbWl0aXZlLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cztcbiAgICAgICAgY29uc3QgdGVtcE1hcHBpbmcgPSB7fTtcbiAgICAgICAgdmFyaWFudHMubWFwcGluZ3MuZm9yRWFjaCgobWFwcGluZykgPT4ge1xuICAgICAgICAgICAgbWFwcGluZy52YXJpYW50cy5mb3JFYWNoKCh2YXJpYW50KSA9PiB7XG4gICAgICAgICAgICAgICAgdGVtcE1hcHBpbmdbdmFyaWFudF0gPSBtYXBwaW5nLm1hdGVyaWFsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBtZXNoVmFyaWFudHNbcmVzdWx0LmlkXSA9IHRlbXBNYXBwaW5nO1xuICAgIH1cbiAgICBtZXNoRGVmYXVsdE1hdGVyaWFsc1tyZXN1bHQuaWRdID0gcHJpbWl0aXZlLm1hdGVyaWFsO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbmNvbnN0IGNyZWF0ZU1lc2ggPSAoZGV2aWNlLCBnbHRmTWVzaCwgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIGFzc2V0T3B0aW9ucywgcHJvbWlzZXMpID0+IHtcbiAgICBjb25zdCBtZXNoZXMgPSBbXTtcblxuICAgIGdsdGZNZXNoLnByaW1pdGl2ZXMuZm9yRWFjaCgocHJpbWl0aXZlKSA9PiB7XG5cbiAgICAgICAgaWYgKHByaW1pdGl2ZS5leHRlbnNpb25zPy5LSFJfZHJhY29fbWVzaF9jb21wcmVzc2lvbikge1xuICAgICAgICAgICAgLy8gaGFuZGxlIGRyYWNvIGNvbXByZXNzZWQgbWVzaFxuICAgICAgICAgICAgbWVzaGVzLnB1c2goY3JlYXRlRHJhY29NZXNoKGRldmljZSwgcHJpbWl0aXZlLCBhY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBtZXNoVmFyaWFudHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBwcm9taXNlcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gaGFuZGxlIHVuY29tcHJlc3NlZCBtZXNoXG4gICAgICAgICAgICBsZXQgaW5kaWNlcyA9IHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eSgnaW5kaWNlcycpID8gZ2V0QWNjZXNzb3JEYXRhKGFjY2Vzc29yc1twcmltaXRpdmUuaW5kaWNlc10sIGJ1ZmZlclZpZXdzLCB0cnVlKSA6IG51bGw7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBjcmVhdGVWZXJ0ZXhCdWZmZXIoZGV2aWNlLCBwcmltaXRpdmUuYXR0cmlidXRlcywgaW5kaWNlcywgYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QpO1xuICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlVHlwZSA9IGdldFByaW1pdGl2ZVR5cGUocHJpbWl0aXZlKTtcblxuICAgICAgICAgICAgLy8gYnVpbGQgdGhlIG1lc2hcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBuZXcgTWVzaChkZXZpY2UpO1xuICAgICAgICAgICAgbWVzaC52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG4gICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS50eXBlID0gcHJpbWl0aXZlVHlwZTtcbiAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uaW5kZXhlZCA9IChpbmRpY2VzICE9PSBudWxsKTtcblxuICAgICAgICAgICAgLy8gaW5kZXggYnVmZmVyXG4gICAgICAgICAgICBpZiAoaW5kaWNlcyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGxldCBpbmRleEZvcm1hdDtcbiAgICAgICAgICAgICAgICBpZiAoaW5kaWNlcyBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UODtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGluZGljZXMgaW5zdGFuY2VvZiBVaW50MTZBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQxNjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpbmRleEZvcm1hdCA9IElOREVYRk9STUFUX1VJTlQzMjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyAzMmJpdCBpbmRleCBidWZmZXIgaXMgdXNlZCBidXQgbm90IHN1cHBvcnRlZFxuICAgICAgICAgICAgICAgIGlmIChpbmRleEZvcm1hdCA9PT0gSU5ERVhGT1JNQVRfVUlOVDMyICYmICFkZXZpY2UuZXh0VWludEVsZW1lbnQpIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIubnVtVmVydGljZXMgPiAweEZGRkYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignR2xiIGZpbGUgY29udGFpbnMgMzJiaXQgaW5kZXggYnVmZmVyIGJ1dCB0aGVzZSBhcmUgbm90IHN1cHBvcnRlZCBieSB0aGlzIGRldmljZSAtIGl0IG1heSBiZSByZW5kZXJlZCBpbmNvcnJlY3RseS4nKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgICAgICAvLyBjb252ZXJ0IHRvIDE2Yml0XG4gICAgICAgICAgICAgICAgICAgIGluZGV4Rm9ybWF0ID0gSU5ERVhGT1JNQVRfVUlOVDE2O1xuICAgICAgICAgICAgICAgICAgICBpbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KGluZGljZXMpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChpbmRleEZvcm1hdCA9PT0gSU5ERVhGT1JNQVRfVUlOVDggJiYgZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0dsYiBmaWxlIGNvbnRhaW5zIDhiaXQgaW5kZXggYnVmZmVyIGJ1dCB0aGVzZSBhcmUgbm90IHN1cHBvcnRlZCBieSBXZWJHUFUgLSBjb252ZXJ0aW5nIHRvIDE2Yml0LicpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgdG8gMTZiaXRcbiAgICAgICAgICAgICAgICAgICAgaW5kZXhGb3JtYXQgPSBJTkRFWEZPUk1BVF9VSU5UMTY7XG4gICAgICAgICAgICAgICAgICAgIGluZGljZXMgPSBuZXcgVWludDE2QXJyYXkoaW5kaWNlcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSBuZXcgSW5kZXhCdWZmZXIoZGV2aWNlLCBpbmRleEZvcm1hdCwgaW5kaWNlcy5sZW5ndGgsIEJVRkZFUl9TVEFUSUMsIGluZGljZXMpO1xuICAgICAgICAgICAgICAgIG1lc2guaW5kZXhCdWZmZXJbMF0gPSBpbmRleEJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IGluZGljZXMubGVuZ3RoO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IHZlcnRleEJ1ZmZlci5udW1WZXJ0aWNlcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHByaW1pdGl2ZS5oYXNPd25Qcm9wZXJ0eShcImV4dGVuc2lvbnNcIikgJiYgcHJpbWl0aXZlLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudHMgPSBwcmltaXRpdmUuZXh0ZW5zaW9ucy5LSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRlbXBNYXBwaW5nID0ge307XG4gICAgICAgICAgICAgICAgdmFyaWFudHMubWFwcGluZ3MuZm9yRWFjaCgobWFwcGluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBtYXBwaW5nLnZhcmlhbnRzLmZvckVhY2goKHZhcmlhbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBNYXBwaW5nW3ZhcmlhbnRdID0gbWFwcGluZy5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgbWVzaFZhcmlhbnRzW21lc2guaWRdID0gdGVtcE1hcHBpbmc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG1lc2hEZWZhdWx0TWF0ZXJpYWxzW21lc2guaWRdID0gcHJpbWl0aXZlLm1hdGVyaWFsO1xuXG4gICAgICAgICAgICBsZXQgYWNjZXNzb3IgPSBhY2Nlc3NvcnNbcHJpbWl0aXZlLmF0dHJpYnV0ZXMuUE9TSVRJT05dO1xuICAgICAgICAgICAgbWVzaC5hYWJiID0gZ2V0QWNjZXNzb3JCb3VuZGluZ0JveChhY2Nlc3Nvcik7XG5cbiAgICAgICAgICAgIC8vIG1vcnBoIHRhcmdldHNcbiAgICAgICAgICAgIGlmIChwcmltaXRpdmUuaGFzT3duUHJvcGVydHkoJ3RhcmdldHMnKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldHMgPSBbXTtcblxuICAgICAgICAgICAgICAgIHByaW1pdGl2ZS50YXJnZXRzLmZvckVhY2goKHRhcmdldCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHt9O1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ1BPU0lUSU9OJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjY2Vzc29yID0gYWNjZXNzb3JzW3RhcmdldC5QT1NJVElPTl07XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlbHRhUG9zaXRpb25zID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YVBvc2l0aW9uc1R5cGUgPSBUWVBFX0ZMT0FUMzI7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmFhYmIgPSBnZXRBY2Nlc3NvckJvdW5kaW5nQm94KGFjY2Vzc29yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXQuaGFzT3duUHJvcGVydHkoJ05PUk1BTCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhY2Nlc3NvciA9IGFjY2Vzc29yc1t0YXJnZXQuTk9STUFMXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5PVEU6IHRoZSBtb3JwaCB0YXJnZXRzIGNhbid0IGN1cnJlbnRseSBhY2NlcHQgcXVhbnRpemVkIG5vcm1hbHNcbiAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGVsdGFOb3JtYWxzID0gZ2V0QWNjZXNzb3JEYXRhRmxvYXQzMihhY2Nlc3NvciwgYnVmZmVyVmlld3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5kZWx0YU5vcm1hbHNUeXBlID0gVFlQRV9GTE9BVDMyO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbmFtZSBpZiBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGdsdGZNZXNoLmhhc093blByb3BlcnR5KCdleHRyYXMnKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgZ2x0Zk1lc2guZXh0cmFzLmhhc093blByb3BlcnR5KCd0YXJnZXROYW1lcycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLm5hbWUgPSBnbHRmTWVzaC5leHRyYXMudGFyZ2V0TmFtZXNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5uYW1lID0gaW5kZXgudG9TdHJpbmcoMTApO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdCB3ZWlnaHQgaWYgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTWVzaC5oYXNPd25Qcm9wZXJ0eSgnd2VpZ2h0cycpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmRlZmF1bHRXZWlnaHQgPSBnbHRmTWVzaC53ZWlnaHRzW2luZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMucHJlc2VydmVEYXRhID0gYXNzZXRPcHRpb25zLm1vcnBoUHJlc2VydmVEYXRhO1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRzLnB1c2gobmV3IE1vcnBoVGFyZ2V0KG9wdGlvbnMpKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIG1lc2gubW9ycGggPSBuZXcgTW9ycGgodGFyZ2V0cywgZGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgICAgIHByZWZlckhpZ2hQcmVjaXNpb246IGFzc2V0T3B0aW9ucy5tb3JwaFByZWZlckhpZ2hQcmVjaXNpb25cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG1lc2hlcy5wdXNoKG1lc2gpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbWVzaGVzO1xufTtcblxuY29uc3QgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0gPSAoc291cmNlLCBtYXRlcmlhbCwgbWFwcykgPT4ge1xuICAgIGxldCBtYXA7XG5cbiAgICBjb25zdCB0ZXhDb29yZCA9IHNvdXJjZS50ZXhDb29yZDtcbiAgICBpZiAodGV4Q29vcmQpIHtcbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW21hcHNbbWFwXSArICdNYXBVdiddID0gdGV4Q29vcmQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB6ZXJvcyA9IFswLCAwXTtcbiAgICBjb25zdCBvbmVzID0gWzEsIDFdO1xuICAgIGNvbnN0IHRleHR1cmVUcmFuc2Zvcm0gPSBzb3VyY2UuZXh0ZW5zaW9ucz8uS0hSX3RleHR1cmVfdHJhbnNmb3JtO1xuICAgIGlmICh0ZXh0dXJlVHJhbnNmb3JtKSB7XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IHRleHR1cmVUcmFuc2Zvcm0ub2Zmc2V0IHx8IHplcm9zO1xuICAgICAgICBjb25zdCBzY2FsZSA9IHRleHR1cmVUcmFuc2Zvcm0uc2NhbGUgfHwgb25lcztcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSB0ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uID8gKC10ZXh0dXJlVHJhbnNmb3JtLnJvdGF0aW9uICogbWF0aC5SQURfVE9fREVHKSA6IDA7XG5cbiAgICAgICAgY29uc3QgdGlsaW5nVmVjID0gbmV3IFZlYzIoc2NhbGVbMF0sIHNjYWxlWzFdKTtcbiAgICAgICAgY29uc3Qgb2Zmc2V0VmVjID0gbmV3IFZlYzIob2Zmc2V0WzBdLCAxLjAgLSBzY2FsZVsxXSAtIG9mZnNldFsxXSk7XG5cbiAgICAgICAgZm9yIChtYXAgPSAwOyBtYXAgPCBtYXBzLmxlbmd0aDsgKyttYXApIHtcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBUaWxpbmdgXSA9IHRpbGluZ1ZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBPZmZzZXRgXSA9IG9mZnNldFZlYztcbiAgICAgICAgICAgIG1hdGVyaWFsW2Ake21hcHNbbWFwXX1NYXBSb3RhdGlvbmBdID0gcm90YXRpb247XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5jb25zdCBleHRlbnNpb25QYnJTcGVjR2xvc3NpbmVzcyA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBsZXQgY29sb3IsIHRleHR1cmU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2RpZmZ1c2VGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuZGlmZnVzZUZhY3RvcjtcbiAgICAgICAgLy8gQ29udmVydCBmcm9tIGxpbmVhciBzcGFjZSB0byBzUkdCIHNwYWNlXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gY29sb3JbM107XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZGlmZnVzZVRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBkaWZmdXNlVGV4dHVyZSA9IGRhdGEuZGlmZnVzZVRleHR1cmU7XG4gICAgICAgIHRleHR1cmUgPSB0ZXh0dXJlc1tkaWZmdXNlVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZU1hcCA9IHRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkaWZmdXNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZGlmZnVzZScsICdvcGFjaXR5J10pO1xuICAgIH1cbiAgICBtYXRlcmlhbC51c2VNZXRhbG5lc3MgPSBmYWxzZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBjb2xvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhci5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZ2xvc3NpbmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzID0gZGF0YS5nbG9zc2luZXNzRmFjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzID0gMS4wO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJHbG9zc2luZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IHNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmUgPSBkYXRhLnNwZWN1bGFyR2xvc3NpbmVzc1RleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyRW5jb2RpbmcgPSAnc3JnYic7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyTWFwID0gbWF0ZXJpYWwuZ2xvc3NNYXAgPSB0ZXh0dXJlc1tzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzTWFwQ2hhbm5lbCA9ICdhJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydnbG9zcycsICdtZXRhbG5lc3MnXSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uQ2xlYXJDb2F0ID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdjbGVhcmNvYXRGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXQgPSBkYXRhLmNsZWFyY29hdEZhY3RvciAqIDAuMjU7IC8vIFRPRE86IHJlbW92ZSB0ZW1wb3Jhcnkgd29ya2Fyb3VuZCBmb3IgcmVwbGljYXRpbmcgZ2xURiBjbGVhci1jb2F0IHZpc3VhbHNcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXQgPSAwO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0VGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdFRleHR1cmUgPSBkYXRhLmNsZWFyY29hdFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdE1hcCA9IHRleHR1cmVzW2NsZWFyY29hdFRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXRNYXBDaGFubmVsID0gJ3InO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGNsZWFyY29hdFRleHR1cmUsIG1hdGVyaWFsLCBbJ2NsZWFyQ29hdCddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdFJvdWdobmVzc0ZhY3RvcicpKSB7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzID0gZGF0YS5jbGVhcmNvYXRSb3VnaG5lc3NGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuY2xlYXJDb2F0R2xvc3MgPSAwO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IGNsZWFyY29hdFJvdWdobmVzc1RleHR1cmUgPSBkYXRhLmNsZWFyY29hdFJvdWdobmVzc1RleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwID0gdGV4dHVyZXNbY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEdsb3NzTWFwQ2hhbm5lbCA9ICdnJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXRSb3VnaG5lc3NUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXRHbG9zcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2NsZWFyY29hdE5vcm1hbFRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBjbGVhcmNvYXROb3JtYWxUZXh0dXJlID0gZGF0YS5jbGVhcmNvYXROb3JtYWxUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5jbGVhckNvYXROb3JtYWxNYXAgPSB0ZXh0dXJlc1tjbGVhcmNvYXROb3JtYWxUZXh0dXJlLmluZGV4XTtcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShjbGVhcmNvYXROb3JtYWxUZXh0dXJlLCBtYXRlcmlhbCwgWydjbGVhckNvYXROb3JtYWwnXSk7XG5cbiAgICAgICAgaWYgKGNsZWFyY29hdE5vcm1hbFRleHR1cmUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLmNsZWFyQ29hdEJ1bXBpbmVzcyA9IGNsZWFyY29hdE5vcm1hbFRleHR1cmUuc2NhbGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBtYXRlcmlhbC5jbGVhckNvYXRHbG9zc0ludmVydCA9IHRydWU7XG59O1xuXG5jb25zdCBleHRlbnNpb25VbmxpdCA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBtYXRlcmlhbC51c2VMaWdodGluZyA9IGZhbHNlO1xuXG4gICAgLy8gY29weSBkaWZmdXNlIGludG8gZW1pc3NpdmVcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZS5jb3B5KG1hdGVyaWFsLmRpZmZ1c2UpO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IG1hdGVyaWFsLmRpZmZ1c2VUaW50O1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwID0gbWF0ZXJpYWwuZGlmZnVzZU1hcDtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFV2ID0gbWF0ZXJpYWwuZGlmZnVzZU1hcFV2O1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwVGlsaW5nLmNvcHkobWF0ZXJpYWwuZGlmZnVzZU1hcFRpbGluZyk7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXBPZmZzZXQuY29weShtYXRlcmlhbC5kaWZmdXNlTWFwT2Zmc2V0KTtcbiAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcFJvdGF0aW9uID0gbWF0ZXJpYWwuZGlmZnVzZU1hcFJvdGF0aW9uO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwQ2hhbm5lbCA9IG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsO1xuICAgIG1hdGVyaWFsLmVtaXNzaXZlVmVydGV4Q29sb3IgPSBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3I7XG4gICAgbWF0ZXJpYWwuZW1pc3NpdmVWZXJ0ZXhDb2xvckNoYW5uZWwgPSBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3JDaGFubmVsO1xuXG4gICAgLy8gZGlzYWJsZSBsaWdodGluZyBhbmQgc2t5Ym94XG4gICAgbWF0ZXJpYWwudXNlTGlnaHRpbmcgPSBmYWxzZTtcbiAgICBtYXRlcmlhbC51c2VTa3lib3ggPSBmYWxzZTtcblxuICAgIC8vIGJsYW5rIGRpZmZ1c2VcbiAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgwLCAwLCAwKTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVGludCA9IGZhbHNlO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXAgPSBudWxsO1xuICAgIG1hdGVyaWFsLmRpZmZ1c2VWZXJ0ZXhDb2xvciA9IGZhbHNlO1xufTtcblxuY29uc3QgZXh0ZW5zaW9uU3BlY3VsYXIgPSAoZGF0YSwgbWF0ZXJpYWwsIHRleHR1cmVzKSA9PiB7XG4gICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciA9IHRydWU7XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJFbmNvZGluZyA9ICdzcmdiJztcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXAgPSB0ZXh0dXJlc1tkYXRhLnNwZWN1bGFyQ29sb3JUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJNYXBDaGFubmVsID0gJ3JnYic7XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhckNvbG9yVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc3BlY3VsYXInXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NwZWN1bGFyQ29sb3JGYWN0b3InKSkge1xuICAgICAgICBjb25zdCBjb2xvciA9IGRhdGEuc3BlY3VsYXJDb2xvckZhY3RvcjtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG1hdGVyaWFsLnNwZWN1bGFyLnNldCgxLCAxLCAxKTtcbiAgICB9XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3RvciA9IGRhdGEuc3BlY3VsYXJGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3IgPSAxO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc3BlY3VsYXJUZXh0dXJlJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXJpdHlGYWN0b3JNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICBtYXRlcmlhbC5zcGVjdWxhcml0eUZhY3Rvck1hcCA9IHRleHR1cmVzW2RhdGEuc3BlY3VsYXJUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS5zcGVjdWxhclRleHR1cmUsIG1hdGVyaWFsLCBbJ3NwZWN1bGFyaXR5RmFjdG9yJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklvciA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbkluZGV4ID0gMS4wIC8gZGF0YS5pb3I7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uVHJhbnNtaXNzaW9uID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICBtYXRlcmlhbC51c2VEeW5hbWljUmVmcmFjdGlvbiA9IHRydWU7XG5cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwucmVmcmFjdGlvbiA9IGRhdGEudHJhbnNtaXNzaW9uRmFjdG9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgndHJhbnNtaXNzaW9uVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnJlZnJhY3Rpb25NYXBDaGFubmVsID0gJ3InO1xuICAgICAgICBtYXRlcmlhbC5yZWZyYWN0aW9uTWFwID0gdGV4dHVyZXNbZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLmluZGV4XTtcbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0oZGF0YS50cmFuc21pc3Npb25UZXh0dXJlLCBtYXRlcmlhbCwgWydyZWZyYWN0aW9uJ10pO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvblNoZWVuID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIG1hdGVyaWFsLnVzZVNoZWVuID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvckZhY3RvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5zaGVlbkNvbG9yRmFjdG9yO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW4uc2V0KDEsIDEsIDEpO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnc2hlZW5Db2xvclRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5zaGVlbk1hcCA9IHRleHR1cmVzW2RhdGEuc2hlZW5Db2xvclRleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC5zaGVlbkVuY29kaW5nID0gJ3NyZ2InO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNoZWVuQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydzaGVlbiddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzRmFjdG9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zcyA9IGRhdGEuc2hlZW5Sb3VnaG5lc3NGYWN0b3I7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuc2hlZW5HbG9zcyA9IDAuMDtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3NoZWVuUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnNoZWVuUm91Z2huZXNzVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLnNoZWVuR2xvc3NNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnNoZWVuUm91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnc2hlZW5HbG9zcyddKTtcbiAgICB9XG5cbiAgICBtYXRlcmlhbC5zaGVlbkdsb3NzSW52ZXJ0ID0gdHJ1ZTtcbn07XG5cbmNvbnN0IGV4dGVuc2lvblZvbHVtZSA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT1JNQUw7XG4gICAgbWF0ZXJpYWwudXNlRHluYW1pY1JlZnJhY3Rpb24gPSB0cnVlO1xuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCd0aGlja25lc3NGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3MgPSBkYXRhLnRoaWNrbmVzc0ZhY3RvcjtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ3RoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3NNYXAgPSB0ZXh0dXJlc1tkYXRhLnRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBtYXRlcmlhbC50aGlja25lc3NNYXBDaGFubmVsID0gJ2cnO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLnRoaWNrbmVzc1RleHR1cmUsIG1hdGVyaWFsLCBbJ3RoaWNrbmVzcyddKTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2F0dGVudWF0aW9uRGlzdGFuY2UnKSkge1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbkRpc3RhbmNlID0gZGF0YS5hdHRlbnVhdGlvbkRpc3RhbmNlO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnYXR0ZW51YXRpb25Db2xvcicpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YS5hdHRlbnVhdGlvbkNvbG9yO1xuICAgICAgICBtYXRlcmlhbC5hdHRlbnVhdGlvbi5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgfVxufTtcblxuY29uc3QgZXh0ZW5zaW9uRW1pc3NpdmVTdHJlbmd0aCA9IChkYXRhLCBtYXRlcmlhbCwgdGV4dHVyZXMpID0+IHtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVTdHJlbmd0aCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlSW50ZW5zaXR5ID0gZGF0YS5lbWlzc2l2ZVN0cmVuZ3RoO1xuICAgIH1cbn07XG5cbmNvbnN0IGV4dGVuc2lvbklyaWRlc2NlbmNlID0gKGRhdGEsIG1hdGVyaWFsLCB0ZXh0dXJlcykgPT4ge1xuICAgIG1hdGVyaWFsLnVzZUlyaWRlc2NlbmNlID0gdHJ1ZTtcbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VGYWN0b3InKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZSA9IGRhdGEuaXJpZGVzY2VuY2VGYWN0b3I7XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZU1hcENoYW5uZWwgPSAncic7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2UnXSk7XG5cbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlSW9yJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXggPSBkYXRhLmlyaWRlc2NlbmNlSW9yO1xuICAgIH1cbiAgICBpZiAoZGF0YS5oYXNPd25Qcm9wZXJ0eSgnaXJpZGVzY2VuY2VUaGlja25lc3NNaW5pbXVtJykpIHtcbiAgICAgICAgbWF0ZXJpYWwuaXJpZGVzY2VuY2VUaGlja25lc3NNaW4gPSBkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bTtcbiAgICB9XG4gICAgaWYgKGRhdGEuaGFzT3duUHJvcGVydHkoJ2lyaWRlc2NlbmNlVGhpY2tuZXNzTWF4aW11bScpKSB7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4ID0gZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc01heGltdW07XG4gICAgfVxuICAgIGlmIChkYXRhLmhhc093blByb3BlcnR5KCdpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUnKSkge1xuICAgICAgICBtYXRlcmlhbC5pcmlkZXNjZW5jZVRoaWNrbmVzc01hcENoYW5uZWwgPSAnZyc7XG4gICAgICAgIG1hdGVyaWFsLmlyaWRlc2NlbmNlVGhpY2tuZXNzTWFwID0gdGV4dHVyZXNbZGF0YS5pcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUuaW5kZXhdO1xuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShkYXRhLmlyaWRlc2NlbmNlVGhpY2tuZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnaXJpZGVzY2VuY2VUaGlja25lc3MnXSk7XG4gICAgfVxufTtcblxuY29uc3QgY3JlYXRlTWF0ZXJpYWwgPSAoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpID0+IHtcbiAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG5cbiAgICAvLyBnbFRGIGRvZXNuJ3QgZGVmaW5lIGhvdyB0byBvY2NsdWRlIHNwZWN1bGFyXG4gICAgbWF0ZXJpYWwub2NjbHVkZVNwZWN1bGFyID0gU1BFQ09DQ19BTztcblxuICAgIG1hdGVyaWFsLmRpZmZ1c2VUaW50ID0gdHJ1ZTtcbiAgICBtYXRlcmlhbC5kaWZmdXNlVmVydGV4Q29sb3IgPSB0cnVlO1xuXG4gICAgbWF0ZXJpYWwuc3BlY3VsYXJUaW50ID0gdHJ1ZTtcbiAgICBtYXRlcmlhbC5zcGVjdWxhclZlcnRleENvbG9yID0gdHJ1ZTtcblxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ25hbWUnKSkge1xuICAgICAgICBtYXRlcmlhbC5uYW1lID0gZ2x0Zk1hdGVyaWFsLm5hbWU7XG4gICAgfVxuXG4gICAgbGV0IGNvbG9yLCB0ZXh0dXJlO1xuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ3Bick1ldGFsbGljUm91Z2huZXNzJykpIHtcbiAgICAgICAgY29uc3QgcGJyRGF0YSA9IGdsdGZNYXRlcmlhbC5wYnJNZXRhbGxpY1JvdWdobmVzcztcblxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnYmFzZUNvbG9yRmFjdG9yJykpIHtcbiAgICAgICAgICAgIGNvbG9yID0gcGJyRGF0YS5iYXNlQ29sb3JGYWN0b3I7XG4gICAgICAgICAgICAvLyBDb252ZXJ0IGZyb20gbGluZWFyIHNwYWNlIHRvIHNSR0Igc3BhY2VcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KE1hdGgucG93KGNvbG9yWzBdLCAxIC8gMi4yKSwgTWF0aC5wb3coY29sb3JbMV0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsyXSwgMSAvIDIuMikpO1xuICAgICAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IGNvbG9yWzNdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnYmFzZUNvbG9yVGV4dHVyZScpKSB7XG4gICAgICAgICAgICBjb25zdCBiYXNlQ29sb3JUZXh0dXJlID0gcGJyRGF0YS5iYXNlQ29sb3JUZXh0dXJlO1xuICAgICAgICAgICAgdGV4dHVyZSA9IHRleHR1cmVzW2Jhc2VDb2xvclRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgICAgICBtYXRlcmlhbC5kaWZmdXNlTWFwID0gdGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLmRpZmZ1c2VNYXBDaGFubmVsID0gJ3JnYic7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwID0gdGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsID0gJ2EnO1xuXG4gICAgICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShiYXNlQ29sb3JUZXh0dXJlLCBtYXRlcmlhbCwgWydkaWZmdXNlJywgJ29wYWNpdHknXSk7XG4gICAgICAgIH1cbiAgICAgICAgbWF0ZXJpYWwudXNlTWV0YWxuZXNzID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwuc3BlY3VsYXIuc2V0KDEsIDEsIDEpO1xuICAgICAgICBpZiAocGJyRGF0YS5oYXNPd25Qcm9wZXJ0eSgnbWV0YWxsaWNGYWN0b3InKSkge1xuICAgICAgICAgICAgbWF0ZXJpYWwubWV0YWxuZXNzID0gcGJyRGF0YS5tZXRhbGxpY0ZhY3RvcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzcyA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ3JvdWdobmVzc0ZhY3RvcicpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zcyA9IHBickRhdGEucm91Z2huZXNzRmFjdG9yO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF0ZXJpYWwuZ2xvc3MgPSAxO1xuICAgICAgICB9XG4gICAgICAgIG1hdGVyaWFsLmdsb3NzSW52ZXJ0ID0gdHJ1ZTtcbiAgICAgICAgaWYgKHBickRhdGEuaGFzT3duUHJvcGVydHkoJ21ldGFsbGljUm91Z2huZXNzVGV4dHVyZScpKSB7XG4gICAgICAgICAgICBjb25zdCBtZXRhbGxpY1JvdWdobmVzc1RleHR1cmUgPSBwYnJEYXRhLm1ldGFsbGljUm91Z2huZXNzVGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcCA9IG1hdGVyaWFsLmdsb3NzTWFwID0gdGV4dHVyZXNbbWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlLmluZGV4XTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1ldGFsbmVzc01hcENoYW5uZWwgPSAnYic7XG4gICAgICAgICAgICBtYXRlcmlhbC5nbG9zc01hcENoYW5uZWwgPSAnZyc7XG5cbiAgICAgICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKG1ldGFsbGljUm91Z2huZXNzVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZ2xvc3MnLCAnbWV0YWxuZXNzJ10pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnbm9ybWFsVGV4dHVyZScpKSB7XG4gICAgICAgIGNvbnN0IG5vcm1hbFRleHR1cmUgPSBnbHRmTWF0ZXJpYWwubm9ybWFsVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwubm9ybWFsTWFwID0gdGV4dHVyZXNbbm9ybWFsVGV4dHVyZS5pbmRleF07XG5cbiAgICAgICAgZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0obm9ybWFsVGV4dHVyZSwgbWF0ZXJpYWwsIFsnbm9ybWFsJ10pO1xuXG4gICAgICAgIGlmIChub3JtYWxUZXh0dXJlLmhhc093blByb3BlcnR5KCdzY2FsZScpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5idW1waW5lc3MgPSBub3JtYWxUZXh0dXJlLnNjYWxlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ29jY2x1c2lvblRleHR1cmUnKSkge1xuICAgICAgICBjb25zdCBvY2NsdXNpb25UZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLm9jY2x1c2lvblRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmFvTWFwID0gdGV4dHVyZXNbb2NjbHVzaW9uVGV4dHVyZS5pbmRleF07XG4gICAgICAgIG1hdGVyaWFsLmFvTWFwQ2hhbm5lbCA9ICdyJztcblxuICAgICAgICBleHRyYWN0VGV4dHVyZVRyYW5zZm9ybShvY2NsdXNpb25UZXh0dXJlLCBtYXRlcmlhbCwgWydhbyddKTtcbiAgICAgICAgLy8gVE9ETzogc3VwcG9ydCAnc3RyZW5ndGgnXG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2VtaXNzaXZlRmFjdG9yJykpIHtcbiAgICAgICAgY29sb3IgPSBnbHRmTWF0ZXJpYWwuZW1pc3NpdmVGYWN0b3I7XG4gICAgICAgIC8vIENvbnZlcnQgZnJvbSBsaW5lYXIgc3BhY2UgdG8gc1JHQiBzcGFjZVxuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoTWF0aC5wb3coY29sb3JbMF0sIDEgLyAyLjIpLCBNYXRoLnBvdyhjb2xvclsxXSwgMSAvIDIuMiksIE1hdGgucG93KGNvbG9yWzJdLCAxIC8gMi4yKSk7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmUuc2V0KDAsIDAsIDApO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVRpbnQgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGdsdGZNYXRlcmlhbC5oYXNPd25Qcm9wZXJ0eSgnZW1pc3NpdmVUZXh0dXJlJykpIHtcbiAgICAgICAgY29uc3QgZW1pc3NpdmVUZXh0dXJlID0gZ2x0Zk1hdGVyaWFsLmVtaXNzaXZlVGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSB0ZXh0dXJlc1tlbWlzc2l2ZVRleHR1cmUuaW5kZXhdO1xuXG4gICAgICAgIGV4dHJhY3RUZXh0dXJlVHJhbnNmb3JtKGVtaXNzaXZlVGV4dHVyZSwgbWF0ZXJpYWwsIFsnZW1pc3NpdmUnXSk7XG4gICAgfVxuICAgIGlmIChnbHRmTWF0ZXJpYWwuaGFzT3duUHJvcGVydHkoJ2FscGhhTW9kZScpKSB7XG4gICAgICAgIHN3aXRjaCAoZ2x0Zk1hdGVyaWFsLmFscGhhTW9kZSkge1xuICAgICAgICAgICAgY2FzZSAnTUFTSyc6XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICAgICAgICAgICAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdhbHBoYUN1dG9mZicpKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLmFscGhhVGVzdCA9IGdsdGZNYXRlcmlhbC5hbHBoYUN1dG9mZjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbC5hbHBoYVRlc3QgPSAwLjU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnQkxFTkQnOlxuICAgICAgICAgICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX05PUk1BTDtcbiAgICAgICAgICAgICAgICAvLyBub3RlOiBieSBkZWZhdWx0IGRvbid0IHdyaXRlIGRlcHRoIG9uIHNlbWl0cmFuc3BhcmVudCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5kZXB0aFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgY2FzZSAnT1BBUVVFJzpcbiAgICAgICAgICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9OT05FO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfTk9ORTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdkb3VibGVTaWRlZCcpKSB7XG4gICAgICAgIG1hdGVyaWFsLnR3b1NpZGVkTGlnaHRpbmcgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQ7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBnbHRmTWF0ZXJpYWwuZG91YmxlU2lkZWQgPyBDVUxMRkFDRV9OT05FIDogQ1VMTEZBQ0VfQkFDSztcbiAgICB9IGVsc2Uge1xuICAgICAgICBtYXRlcmlhbC50d29TaWRlZExpZ2h0aW5nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLmN1bGwgPSBDVUxMRkFDRV9CQUNLO1xuICAgIH1cblxuICAgIC8vIFByb3ZpZGUgbGlzdCBvZiBzdXBwb3J0ZWQgZXh0ZW5zaW9ucyBhbmQgdGhlaXIgZnVuY3Rpb25zXG4gICAgY29uc3QgZXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2NsZWFyY29hdFwiOiBleHRlbnNpb25DbGVhckNvYXQsXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19lbWlzc2l2ZV9zdHJlbmd0aFwiOiBleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfaW9yXCI6IGV4dGVuc2lvbklvcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX2lyaWRlc2NlbmNlXCI6IGV4dGVuc2lvbklyaWRlc2NlbmNlLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfcGJyU3BlY3VsYXJHbG9zc2luZXNzXCI6IGV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzLFxuICAgICAgICBcIktIUl9tYXRlcmlhbHNfc2hlZW5cIjogZXh0ZW5zaW9uU2hlZW4sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc19zcGVjdWxhclwiOiBleHRlbnNpb25TcGVjdWxhcixcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3RyYW5zbWlzc2lvblwiOiBleHRlbnNpb25UcmFuc21pc3Npb24sXG4gICAgICAgIFwiS0hSX21hdGVyaWFsc191bmxpdFwiOiBleHRlbnNpb25VbmxpdCxcbiAgICAgICAgXCJLSFJfbWF0ZXJpYWxzX3ZvbHVtZVwiOiBleHRlbnNpb25Wb2x1bWVcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIGV4dGVuc2lvbnNcbiAgICBpZiAoZ2x0Zk1hdGVyaWFsLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykpIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZ2x0Zk1hdGVyaWFsLmV4dGVuc2lvbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbkZ1bmMgPSBleHRlbnNpb25zW2tleV07XG4gICAgICAgICAgICBpZiAoZXh0ZW5zaW9uRnVuYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgZXh0ZW5zaW9uRnVuYyhnbHRmTWF0ZXJpYWwuZXh0ZW5zaW9uc1trZXldLCBtYXRlcmlhbCwgdGV4dHVyZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICByZXR1cm4gbWF0ZXJpYWw7XG59O1xuXG4vLyBjcmVhdGUgdGhlIGFuaW0gc3RydWN0dXJlXG5jb25zdCBjcmVhdGVBbmltYXRpb24gPSAoZ2x0ZkFuaW1hdGlvbiwgYW5pbWF0aW9uSW5kZXgsIGdsdGZBY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgbWVzaGVzLCBnbHRmTm9kZXMpID0+IHtcblxuICAgIC8vIGNyZWF0ZSBhbmltYXRpb24gZGF0YSBibG9jayBmb3IgdGhlIGFjY2Vzc29yXG4gICAgY29uc3QgY3JlYXRlQW5pbURhdGEgPSAoZ2x0ZkFjY2Vzc29yKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXcgQW5pbURhdGEoZ2V0TnVtQ29tcG9uZW50cyhnbHRmQWNjZXNzb3IudHlwZSksIGdldEFjY2Vzc29yRGF0YUZsb2F0MzIoZ2x0ZkFjY2Vzc29yLCBidWZmZXJWaWV3cykpO1xuICAgIH07XG5cbiAgICBjb25zdCBpbnRlcnBNYXAgPSB7XG4gICAgICAgICdTVEVQJzogSU5URVJQT0xBVElPTl9TVEVQLFxuICAgICAgICAnTElORUFSJzogSU5URVJQT0xBVElPTl9MSU5FQVIsXG4gICAgICAgICdDVUJJQ1NQTElORSc6IElOVEVSUE9MQVRJT05fQ1VCSUNcbiAgICB9O1xuXG4gICAgLy8gSW5wdXQgYW5kIG91dHB1dCBtYXBzIHJlZmVyZW5jZSBkYXRhIGJ5IHNhbXBsZXIgaW5wdXQvb3V0cHV0IGtleS5cbiAgICBjb25zdCBpbnB1dE1hcCA9IHsgfTtcbiAgICBjb25zdCBvdXRwdXRNYXAgPSB7IH07XG4gICAgLy8gVGhlIGN1cnZlIG1hcCBzdG9yZXMgdGVtcG9yYXJ5IGN1cnZlIGRhdGEgYnkgc2FtcGxlciBpbmRleC4gRWFjaCBjdXJ2ZXMgaW5wdXQvb3V0cHV0IHZhbHVlIHdpbGwgYmUgcmVzb2x2ZWQgdG8gYW4gaW5wdXRzL291dHB1dHMgYXJyYXkgaW5kZXggYWZ0ZXIgYWxsIHNhbXBsZXJzIGhhdmUgYmVlbiBwcm9jZXNzZWQuXG4gICAgLy8gQ3VydmVzIGFuZCBvdXRwdXRzIHRoYXQgYXJlIGRlbGV0ZWQgZnJvbSB0aGVpciBtYXBzIHdpbGwgbm90IGJlIGluY2x1ZGVkIGluIHRoZSBmaW5hbCBBbmltVHJhY2tcbiAgICBjb25zdCBjdXJ2ZU1hcCA9IHsgfTtcbiAgICBsZXQgb3V0cHV0Q291bnRlciA9IDE7XG5cbiAgICBsZXQgaTtcblxuICAgIC8vIGNvbnZlcnQgc2FtcGxlcnNcbiAgICBmb3IgKGkgPSAwOyBpIDwgZ2x0ZkFuaW1hdGlvbi5zYW1wbGVycy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBzYW1wbGVyID0gZ2x0ZkFuaW1hdGlvbi5zYW1wbGVyc1tpXTtcblxuICAgICAgICAvLyBnZXQgaW5wdXQgZGF0YVxuICAgICAgICBpZiAoIWlucHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIuaW5wdXQpKSB7XG4gICAgICAgICAgICBpbnB1dE1hcFtzYW1wbGVyLmlucHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5pbnB1dF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZ2V0IG91dHB1dCBkYXRhXG4gICAgICAgIGlmICghb3V0cHV0TWFwLmhhc093blByb3BlcnR5KHNhbXBsZXIub3V0cHV0KSkge1xuICAgICAgICAgICAgb3V0cHV0TWFwW3NhbXBsZXIub3V0cHV0XSA9IGNyZWF0ZUFuaW1EYXRhKGdsdGZBY2Nlc3NvcnNbc2FtcGxlci5vdXRwdXRdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGludGVycG9sYXRpb24gPVxuICAgICAgICAgICAgc2FtcGxlci5oYXNPd25Qcm9wZXJ0eSgnaW50ZXJwb2xhdGlvbicpICYmXG4gICAgICAgICAgICBpbnRlcnBNYXAuaGFzT3duUHJvcGVydHkoc2FtcGxlci5pbnRlcnBvbGF0aW9uKSA/XG4gICAgICAgICAgICAgICAgaW50ZXJwTWFwW3NhbXBsZXIuaW50ZXJwb2xhdGlvbl0gOiBJTlRFUlBPTEFUSU9OX0xJTkVBUjtcblxuICAgICAgICAvLyBjcmVhdGUgY3VydmVcbiAgICAgICAgY29uc3QgY3VydmUgPSB7XG4gICAgICAgICAgICBwYXRoczogW10sXG4gICAgICAgICAgICBpbnB1dDogc2FtcGxlci5pbnB1dCxcbiAgICAgICAgICAgIG91dHB1dDogc2FtcGxlci5vdXRwdXQsXG4gICAgICAgICAgICBpbnRlcnBvbGF0aW9uOiBpbnRlcnBvbGF0aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgY3VydmVNYXBbaV0gPSBjdXJ2ZTtcbiAgICB9XG5cbiAgICBjb25zdCBxdWF0QXJyYXlzID0gW107XG5cbiAgICBjb25zdCB0cmFuc2Zvcm1TY2hlbWEgPSB7XG4gICAgICAgICd0cmFuc2xhdGlvbic6ICdsb2NhbFBvc2l0aW9uJyxcbiAgICAgICAgJ3JvdGF0aW9uJzogJ2xvY2FsUm90YXRpb24nLFxuICAgICAgICAnc2NhbGUnOiAnbG9jYWxTY2FsZSdcbiAgICB9O1xuXG4gICAgY29uc3QgY29uc3RydWN0Tm9kZVBhdGggPSAobm9kZSkgPT4ge1xuICAgICAgICBjb25zdCBwYXRoID0gW107XG4gICAgICAgIHdoaWxlIChub2RlKSB7XG4gICAgICAgICAgICBwYXRoLnVuc2hpZnQobm9kZS5uYW1lKTtcbiAgICAgICAgICAgIG5vZGUgPSBub2RlLnBhcmVudDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcGF0aDtcbiAgICB9O1xuXG4gICAgLy8gQWxsIG1vcnBoIHRhcmdldHMgYXJlIGluY2x1ZGVkIGluIGEgc2luZ2xlIGNoYW5uZWwgb2YgdGhlIGFuaW1hdGlvbiwgd2l0aCBhbGwgdGFyZ2V0cyBvdXRwdXQgZGF0YSBpbnRlcmxlYXZlZCB3aXRoIGVhY2ggb3RoZXIuXG4gICAgLy8gVGhpcyBmdW5jdGlvbiBzcGxpdHMgZWFjaCBtb3JwaCB0YXJnZXQgb3V0IGludG8gaXQgYSBjdXJ2ZSB3aXRoIGl0cyBvd24gb3V0cHV0IGRhdGEsIGFsbG93aW5nIHVzIHRvIGFuaW1hdGUgZWFjaCBtb3JwaCB0YXJnZXQgaW5kZXBlbmRlbnRseSBieSBuYW1lLlxuICAgIGNvbnN0IGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzID0gKGN1cnZlLCBnbHRmTm9kZSwgZW50aXR5UGF0aCkgPT4ge1xuICAgICAgICBjb25zdCBvdXQgPSBvdXRwdXRNYXBbY3VydmUub3V0cHV0XTtcbiAgICAgICAgaWYgKCFvdXQpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYGdsYi1wYXJzZXI6IE5vIG91dHB1dCBkYXRhIGlzIGF2YWlsYWJsZSBmb3IgdGhlIG1vcnBoIHRhcmdldCBjdXJ2ZSAoJHtlbnRpdHlQYXRofS9ncmFwaC93ZWlnaHRzKS4gU2tpcHBpbmcuYCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBuYW1lcyBvZiBtb3JwaCB0YXJnZXRzXG4gICAgICAgIGxldCB0YXJnZXROYW1lcztcbiAgICAgICAgaWYgKG1lc2hlcyAmJiBtZXNoZXNbZ2x0Zk5vZGUubWVzaF0pIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoZXNbZ2x0Zk5vZGUubWVzaF07XG4gICAgICAgICAgICBpZiAobWVzaC5oYXNPd25Qcm9wZXJ0eSgnZXh0cmFzJykgJiYgbWVzaC5leHRyYXMuaGFzT3duUHJvcGVydHkoJ3RhcmdldE5hbWVzJykpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXROYW1lcyA9IG1lc2guZXh0cmFzLnRhcmdldE5hbWVzO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb3V0RGF0YSA9IG91dC5kYXRhO1xuICAgICAgICBjb25zdCBtb3JwaFRhcmdldENvdW50ID0gb3V0RGF0YS5sZW5ndGggLyBpbnB1dE1hcFtjdXJ2ZS5pbnB1dF0uZGF0YS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGtleWZyYW1lQ291bnQgPSBvdXREYXRhLmxlbmd0aCAvIG1vcnBoVGFyZ2V0Q291bnQ7XG5cbiAgICAgICAgLy8gc2luZ2xlIGFycmF5IGJ1ZmZlciBmb3IgYWxsIGtleXMsIDQgYnl0ZXMgcGVyIGVudHJ5XG4gICAgICAgIGNvbnN0IHNpbmdsZUJ1ZmZlclNpemUgPSBrZXlmcmFtZUNvdW50ICogNDtcbiAgICAgICAgY29uc3QgYnVmZmVyID0gbmV3IEFycmF5QnVmZmVyKHNpbmdsZUJ1ZmZlclNpemUgKiBtb3JwaFRhcmdldENvdW50KTtcblxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1vcnBoVGFyZ2V0Q291bnQ7IGorKykge1xuICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRPdXRwdXQgPSBuZXcgRmxvYXQzMkFycmF5KGJ1ZmZlciwgc2luZ2xlQnVmZmVyU2l6ZSAqIGosIGtleWZyYW1lQ291bnQpO1xuXG4gICAgICAgICAgICAvLyB0aGUgb3V0cHV0IGRhdGEgZm9yIGFsbCBtb3JwaCB0YXJnZXRzIGluIGEgc2luZ2xlIGN1cnZlIGlzIGludGVybGVhdmVkLiBXZSBuZWVkIHRvIHJldHJpZXZlIHRoZSBrZXlmcmFtZSBvdXRwdXQgZGF0YSBmb3IgYSBzaW5nbGUgbW9ycGggdGFyZ2V0XG4gICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGtleWZyYW1lQ291bnQ7IGsrKykge1xuICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0T3V0cHV0W2tdID0gb3V0RGF0YVtrICogbW9ycGhUYXJnZXRDb3VudCArIGpdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgb3V0cHV0ID0gbmV3IEFuaW1EYXRhKDEsIG1vcnBoVGFyZ2V0T3V0cHV0KTtcbiAgICAgICAgICAgIGNvbnN0IHdlaWdodE5hbWUgPSB0YXJnZXROYW1lcz8uW2pdID8gYG5hbWUuJHt0YXJnZXROYW1lc1tqXX1gIDogajtcblxuICAgICAgICAgICAgLy8gYWRkIHRoZSBpbmRpdmlkdWFsIG1vcnBoIHRhcmdldCBvdXRwdXQgZGF0YSB0byB0aGUgb3V0cHV0TWFwIHVzaW5nIGEgbmVnYXRpdmUgdmFsdWUga2V5IChzbyBhcyBub3QgdG8gY2xhc2ggd2l0aCBzYW1wbGVyLm91dHB1dCB2YWx1ZXMpXG4gICAgICAgICAgICBvdXRwdXRNYXBbLW91dHB1dENvdW50ZXJdID0gb3V0cHV0O1xuICAgICAgICAgICAgY29uc3QgbW9ycGhDdXJ2ZSA9IHtcbiAgICAgICAgICAgICAgICBwYXRoczogW3tcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5UGF0aDogZW50aXR5UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50OiAnZ3JhcGgnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVBhdGg6IFtgd2VpZ2h0LiR7d2VpZ2h0TmFtZX1gXVxuICAgICAgICAgICAgICAgIH1dLFxuICAgICAgICAgICAgICAgIC8vIGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIGlucHV0IGNhbiB1c2UgdGhlIHNhbWUgc2FtcGxlci5pbnB1dCBmcm9tIHRoZSBjaGFubmVsIHRoZXkgd2VyZSBhbGwgaW5cbiAgICAgICAgICAgICAgICBpbnB1dDogY3VydmUuaW5wdXQsXG4gICAgICAgICAgICAgICAgLy8gYnV0IGVhY2ggbW9ycGggdGFyZ2V0IGN1cnZlIHNob3VsZCByZWZlcmVuY2UgaXRzIGluZGl2aWR1YWwgb3V0cHV0IHRoYXQgd2FzIGp1c3QgY3JlYXRlZFxuICAgICAgICAgICAgICAgIG91dHB1dDogLW91dHB1dENvdW50ZXIsXG4gICAgICAgICAgICAgICAgaW50ZXJwb2xhdGlvbjogY3VydmUuaW50ZXJwb2xhdGlvblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIG91dHB1dENvdW50ZXIrKztcbiAgICAgICAgICAgIC8vIGFkZCB0aGUgbW9ycGggdGFyZ2V0IGN1cnZlIHRvIHRoZSBjdXJ2ZU1hcFxuICAgICAgICAgICAgY3VydmVNYXBbYG1vcnBoQ3VydmUtJHtpfS0ke2p9YF0gPSBtb3JwaEN1cnZlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGNvbnZlcnQgYW5pbSBjaGFubmVsc1xuICAgIGZvciAoaSA9IDA7IGkgPCBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGNoYW5uZWwgPSBnbHRmQW5pbWF0aW9uLmNoYW5uZWxzW2ldO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBjaGFubmVsLnRhcmdldDtcbiAgICAgICAgY29uc3QgY3VydmUgPSBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdO1xuXG4gICAgICAgIGNvbnN0IG5vZGUgPSBub2Rlc1t0YXJnZXQubm9kZV07XG4gICAgICAgIGNvbnN0IGdsdGZOb2RlID0gZ2x0Zk5vZGVzW3RhcmdldC5ub2RlXTtcbiAgICAgICAgY29uc3QgZW50aXR5UGF0aCA9IGNvbnN0cnVjdE5vZGVQYXRoKG5vZGUpO1xuXG4gICAgICAgIGlmICh0YXJnZXQucGF0aC5zdGFydHNXaXRoKCd3ZWlnaHRzJykpIHtcbiAgICAgICAgICAgIGNyZWF0ZU1vcnBoVGFyZ2V0Q3VydmVzKGN1cnZlLCBnbHRmTm9kZSwgZW50aXR5UGF0aCk7XG4gICAgICAgICAgICAvLyBhcyBhbGwgaW5kaXZpZHVhbCBtb3JwaCB0YXJnZXRzIGluIHRoaXMgbW9ycGggY3VydmUgaGF2ZSB0aGVpciBvd24gY3VydmUgbm93LCB0aGlzIG1vcnBoIGN1cnZlIHNob3VsZCBiZSBmbGFnZ2VkXG4gICAgICAgICAgICAvLyBzbyBpdCdzIG5vdCBpbmNsdWRlZCBpbiB0aGUgZmluYWwgb3V0cHV0XG4gICAgICAgICAgICBjdXJ2ZU1hcFtjaGFubmVsLnNhbXBsZXJdLm1vcnBoQ3VydmUgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3VydmUucGF0aHMucHVzaCh7XG4gICAgICAgICAgICAgICAgZW50aXR5UGF0aDogZW50aXR5UGF0aCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnQ6ICdncmFwaCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoOiBbdHJhbnNmb3JtU2NoZW1hW3RhcmdldC5wYXRoXV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaW5wdXRzID0gW107XG4gICAgY29uc3Qgb3V0cHV0cyA9IFtdO1xuICAgIGNvbnN0IGN1cnZlcyA9IFtdO1xuXG4gICAgLy8gQWRkIGVhY2ggaW5wdXQgaW4gdGhlIG1hcCB0byB0aGUgZmluYWwgaW5wdXRzIGFycmF5LiBUaGUgaW5wdXRNYXAgc2hvdWxkIG5vdyByZWZlcmVuY2UgdGhlIGluZGV4IG9mIGlucHV0IGluIHRoZSBpbnB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgaW5wdXQgaXRzZWxmLlxuICAgIGZvciAoY29uc3QgaW5wdXRLZXkgaW4gaW5wdXRNYXApIHtcbiAgICAgICAgaW5wdXRzLnB1c2goaW5wdXRNYXBbaW5wdXRLZXldKTtcbiAgICAgICAgaW5wdXRNYXBbaW5wdXRLZXldID0gaW5wdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIEFkZCBlYWNoIG91dHB1dCBpbiB0aGUgbWFwIHRvIHRoZSBmaW5hbCBvdXRwdXRzIGFycmF5LiBUaGUgb3V0cHV0TWFwIHNob3VsZCBub3cgcmVmZXJlbmNlIHRoZSBpbmRleCBvZiBvdXRwdXQgaW4gdGhlIG91dHB1dHMgYXJyYXkgaW5zdGVhZCBvZiB0aGUgb3V0cHV0IGl0c2VsZi5cbiAgICBmb3IgKGNvbnN0IG91dHB1dEtleSBpbiBvdXRwdXRNYXApIHtcbiAgICAgICAgb3V0cHV0cy5wdXNoKG91dHB1dE1hcFtvdXRwdXRLZXldKTtcbiAgICAgICAgb3V0cHV0TWFwW291dHB1dEtleV0gPSBvdXRwdXRzLmxlbmd0aCAtIDE7XG4gICAgfVxuICAgIC8vIENyZWF0ZSBhbiBBbmltQ3VydmUgZm9yIGVhY2ggY3VydmUgb2JqZWN0IGluIHRoZSBjdXJ2ZU1hcC4gRWFjaCBjdXJ2ZSBvYmplY3QncyBpbnB1dCB2YWx1ZSBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gdGhlIGluZGV4IG9mIHRoZSBpbnB1dCBpbiB0aGVcbiAgICAvLyBpbnB1dHMgYXJyYXlzIHVzaW5nIHRoZSBpbnB1dE1hcC4gTGlrZXdpc2UgZm9yIG91dHB1dCB2YWx1ZXMuXG4gICAgZm9yIChjb25zdCBjdXJ2ZUtleSBpbiBjdXJ2ZU1hcCkge1xuICAgICAgICBjb25zdCBjdXJ2ZURhdGEgPSBjdXJ2ZU1hcFtjdXJ2ZUtleV07XG4gICAgICAgIC8vIGlmIHRoZSBjdXJ2ZURhdGEgY29udGFpbnMgYSBtb3JwaCBjdXJ2ZSB0aGVuIGRvIG5vdCBhZGQgaXQgdG8gdGhlIGZpbmFsIGN1cnZlIGxpc3QgYXMgdGhlIGluZGl2aWR1YWwgbW9ycGggdGFyZ2V0IGN1cnZlcyBhcmUgaW5jbHVkZWQgaW5zdGVhZFxuICAgICAgICBpZiAoY3VydmVEYXRhLm1vcnBoQ3VydmUpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGN1cnZlcy5wdXNoKG5ldyBBbmltQ3VydmUoXG4gICAgICAgICAgICBjdXJ2ZURhdGEucGF0aHMsXG4gICAgICAgICAgICBpbnB1dE1hcFtjdXJ2ZURhdGEuaW5wdXRdLFxuICAgICAgICAgICAgb3V0cHV0TWFwW2N1cnZlRGF0YS5vdXRwdXRdLFxuICAgICAgICAgICAgY3VydmVEYXRhLmludGVycG9sYXRpb25cbiAgICAgICAgKSk7XG5cbiAgICAgICAgLy8gaWYgdGhpcyB0YXJnZXQgaXMgYSBzZXQgb2YgcXVhdGVybmlvbiBrZXlzLCBtYWtlIG5vdGUgb2YgaXRzIGluZGV4IHNvIHdlIGNhbiBwZXJmb3JtXG4gICAgICAgIC8vIHF1YXRlcm5pb24tc3BlY2lmaWMgcHJvY2Vzc2luZyBvbiBpdC5cbiAgICAgICAgaWYgKGN1cnZlRGF0YS5wYXRocy5sZW5ndGggPiAwICYmIGN1cnZlRGF0YS5wYXRoc1swXS5wcm9wZXJ0eVBhdGhbMF0gPT09ICdsb2NhbFJvdGF0aW9uJyAmJiBjdXJ2ZURhdGEuaW50ZXJwb2xhdGlvbiAhPT0gSU5URVJQT0xBVElPTl9DVUJJQykge1xuICAgICAgICAgICAgcXVhdEFycmF5cy5wdXNoKGN1cnZlc1tjdXJ2ZXMubGVuZ3RoIC0gMV0ub3V0cHV0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNvcnQgdGhlIGxpc3Qgb2YgYXJyYXkgaW5kZXhlcyBzbyB3ZSBjYW4gc2tpcCBkdXBzXG4gICAgcXVhdEFycmF5cy5zb3J0KCk7XG5cbiAgICAvLyBydW4gdGhyb3VnaCB0aGUgcXVhdGVybmlvbiBkYXRhIGFycmF5cyBmbGlwcGluZyBxdWF0ZXJuaW9uIGtleXNcbiAgICAvLyB0aGF0IGRvbid0IGZhbGwgaW4gdGhlIHNhbWUgd2luZGluZyBvcmRlci5cbiAgICBsZXQgcHJldkluZGV4ID0gbnVsbDtcbiAgICBsZXQgZGF0YTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcXVhdEFycmF5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHF1YXRBcnJheXNbaV07XG4gICAgICAgIC8vIHNraXAgb3ZlciBkdXBsaWNhdGUgYXJyYXkgaW5kaWNlc1xuICAgICAgICBpZiAoaSA9PT0gMCB8fCBpbmRleCAhPT0gcHJldkluZGV4KSB7XG4gICAgICAgICAgICBkYXRhID0gb3V0cHV0c1tpbmRleF07XG4gICAgICAgICAgICBpZiAoZGF0YS5jb21wb25lbnRzID09PSA0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZCA9IGRhdGEuZGF0YTtcbiAgICAgICAgICAgICAgICBjb25zdCBsZW4gPSBkLmxlbmd0aCAtIDQ7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGogKz0gNCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkcCA9IGRbaiArIDBdICogZFtqICsgNF0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyAxXSAqIGRbaiArIDVdICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgMl0gKiBkW2ogKyA2XSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDNdICogZFtqICsgN107XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRwIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgNF0gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICBkW2ogKyA1XSAqPSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRbaiArIDZdICo9IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgZFtqICsgN10gKj0gLTE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmV2SW5kZXggPSBpbmRleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSBkdXJhdGlvbiBvZiB0aGUgYW5pbWF0aW9uIGFzIG1heGltdW0gdGltZSB2YWx1ZVxuICAgIGxldCBkdXJhdGlvbiA9IDA7XG4gICAgZm9yIChpID0gMDsgaSA8IGlucHV0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBkYXRhICA9IGlucHV0c1tpXS5fZGF0YTtcbiAgICAgICAgZHVyYXRpb24gPSBNYXRoLm1heChkdXJhdGlvbiwgZGF0YS5sZW5ndGggPT09IDAgPyAwIDogZGF0YVtkYXRhLmxlbmd0aCAtIDFdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFuaW1UcmFjayhcbiAgICAgICAgZ2x0ZkFuaW1hdGlvbi5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpID8gZ2x0ZkFuaW1hdGlvbi5uYW1lIDogKCdhbmltYXRpb25fJyArIGFuaW1hdGlvbkluZGV4KSxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICAgICAgY3VydmVzKTtcbn07XG5cbmNvbnN0IHRlbXBNYXQgPSBuZXcgTWF0NCgpO1xuY29uc3QgdGVtcFZlYyA9IG5ldyBWZWMzKCk7XG5cbmNvbnN0IGNyZWF0ZU5vZGUgPSAoZ2x0Zk5vZGUsIG5vZGVJbmRleCkgPT4ge1xuICAgIGNvbnN0IGVudGl0eSA9IG5ldyBHcmFwaE5vZGUoKTtcblxuICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpICYmIGdsdGZOb2RlLm5hbWUubGVuZ3RoID4gMCkge1xuICAgICAgICBlbnRpdHkubmFtZSA9IGdsdGZOb2RlLm5hbWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZW50aXR5Lm5hbWUgPSAnbm9kZV8nICsgbm9kZUluZGV4O1xuICAgIH1cblxuICAgIC8vIFBhcnNlIHRyYW5zZm9ybWF0aW9uIHByb3BlcnRpZXNcbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ21hdHJpeCcpKSB7XG4gICAgICAgIHRlbXBNYXQuZGF0YS5zZXQoZ2x0Zk5vZGUubWF0cml4KTtcbiAgICAgICAgdGVtcE1hdC5nZXRUcmFuc2xhdGlvbih0ZW1wVmVjKTtcbiAgICAgICAgZW50aXR5LnNldExvY2FsUG9zaXRpb24odGVtcFZlYyk7XG4gICAgICAgIHRlbXBNYXQuZ2V0RXVsZXJBbmdsZXModGVtcFZlYyk7XG4gICAgICAgIGVudGl0eS5zZXRMb2NhbEV1bGVyQW5nbGVzKHRlbXBWZWMpO1xuICAgICAgICB0ZW1wTWF0LmdldFNjYWxlKHRlbXBWZWMpO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZSh0ZW1wVmVjKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3JvdGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgciA9IGdsdGZOb2RlLnJvdGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxSb3RhdGlvbihyWzBdLCByWzFdLCByWzJdLCByWzNdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3RyYW5zbGF0aW9uJykpIHtcbiAgICAgICAgY29uc3QgdCA9IGdsdGZOb2RlLnRyYW5zbGF0aW9uO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxQb3NpdGlvbih0WzBdLCB0WzFdLCB0WzJdKTtcbiAgICB9XG5cbiAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3NjYWxlJykpIHtcbiAgICAgICAgY29uc3QgcyA9IGdsdGZOb2RlLnNjYWxlO1xuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZShzWzBdLCBzWzFdLCBzWzJdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZW50aXR5O1xufTtcblxuLy8gY3JlYXRlcyBhIGNhbWVyYSBjb21wb25lbnQgb24gdGhlIHN1cHBsaWVkIG5vZGUsIGFuZCByZXR1cm5zIGl0XG5jb25zdCBjcmVhdGVDYW1lcmEgPSAoZ2x0ZkNhbWVyYSwgbm9kZSkgPT4ge1xuXG4gICAgY29uc3QgcHJvamVjdGlvbiA9IGdsdGZDYW1lcmEudHlwZSA9PT0gJ29ydGhvZ3JhcGhpYycgPyBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA6IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkU7XG4gICAgY29uc3QgZ2x0ZlByb3BlcnRpZXMgPSBwcm9qZWN0aW9uID09PSBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyA/IGdsdGZDYW1lcmEub3J0aG9ncmFwaGljIDogZ2x0ZkNhbWVyYS5wZXJzcGVjdGl2ZTtcblxuICAgIGNvbnN0IGNvbXBvbmVudERhdGEgPSB7XG4gICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICBwcm9qZWN0aW9uOiBwcm9qZWN0aW9uLFxuICAgICAgICBuZWFyQ2xpcDogZ2x0ZlByb3BlcnRpZXMuem5lYXIsXG4gICAgICAgIGFzcGVjdFJhdGlvTW9kZTogQVNQRUNUX0FVVE9cbiAgICB9O1xuXG4gICAgaWYgKGdsdGZQcm9wZXJ0aWVzLnpmYXIpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5mYXJDbGlwID0gZ2x0ZlByb3BlcnRpZXMuemZhcjtcbiAgICB9XG5cbiAgICBpZiAocHJvamVjdGlvbiA9PT0gUFJPSkVDVElPTl9PUlRIT0dSQVBISUMpIHtcbiAgICAgICAgY29tcG9uZW50RGF0YS5vcnRob0hlaWdodCA9IDAuNSAqIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy55bWFnKSB7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvTW9kZSA9IEFTUEVDVF9NQU5VQUw7XG4gICAgICAgICAgICBjb21wb25lbnREYXRhLmFzcGVjdFJhdGlvID0gZ2x0ZlByb3BlcnRpZXMueG1hZyAvIGdsdGZQcm9wZXJ0aWVzLnltYWc7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBjb21wb25lbnREYXRhLmZvdiA9IGdsdGZQcm9wZXJ0aWVzLnlmb3YgKiBtYXRoLlJBRF9UT19ERUc7XG4gICAgICAgIGlmIChnbHRmUHJvcGVydGllcy5hc3BlY3RSYXRpbykge1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpb01vZGUgPSBBU1BFQ1RfTUFOVUFMO1xuICAgICAgICAgICAgY29tcG9uZW50RGF0YS5hc3BlY3RSYXRpbyA9IGdsdGZQcm9wZXJ0aWVzLmFzcGVjdFJhdGlvO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgY2FtZXJhRW50aXR5ID0gbmV3IEVudGl0eShnbHRmQ2FtZXJhLm5hbWUpO1xuICAgIGNhbWVyYUVudGl0eS5hZGRDb21wb25lbnQoJ2NhbWVyYScsIGNvbXBvbmVudERhdGEpO1xuICAgIHJldHVybiBjYW1lcmFFbnRpdHk7XG59O1xuXG4vLyBjcmVhdGVzIGxpZ2h0IGNvbXBvbmVudCwgYWRkcyBpdCB0byB0aGUgbm9kZSBhbmQgcmV0dXJucyB0aGUgY3JlYXRlZCBsaWdodCBjb21wb25lbnRcbmNvbnN0IGNyZWF0ZUxpZ2h0ID0gKGdsdGZMaWdodCwgbm9kZSkgPT4ge1xuXG4gICAgY29uc3QgbGlnaHRQcm9wcyA9IHtcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgIHR5cGU6IGdsdGZMaWdodC50eXBlID09PSAncG9pbnQnID8gJ29tbmknIDogZ2x0ZkxpZ2h0LnR5cGUsXG4gICAgICAgIGNvbG9yOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ2NvbG9yJykgPyBuZXcgQ29sb3IoZ2x0ZkxpZ2h0LmNvbG9yKSA6IENvbG9yLldISVRFLFxuXG4gICAgICAgIC8vIHdoZW4gcmFuZ2UgaXMgbm90IGRlZmluZWQsIGluZmluaXR5IHNob3VsZCBiZSB1c2VkIC0gYnV0IHRoYXQgaXMgY2F1c2luZyBpbmZpbml0eSBpbiBib3VuZHMgY2FsY3VsYXRpb25zXG4gICAgICAgIHJhbmdlOiBnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3JhbmdlJykgPyBnbHRmTGlnaHQucmFuZ2UgOiA5OTk5LFxuXG4gICAgICAgIGZhbGxvZmZNb2RlOiBMSUdIVEZBTExPRkZfSU5WRVJTRVNRVUFSRUQsXG5cbiAgICAgICAgLy8gVE9ETzogKGVuZ2luZSBpc3N1ZSAjMzI1MikgU2V0IGludGVuc2l0eSB0byBtYXRjaCBnbFRGIHNwZWNpZmljYXRpb24sIHdoaWNoIHVzZXMgcGh5c2ljYWxseSBiYXNlZCB2YWx1ZXM6XG4gICAgICAgIC8vIC0gT21uaSBhbmQgc3BvdCBsaWdodHMgdXNlIGx1bWlub3VzIGludGVuc2l0eSBpbiBjYW5kZWxhIChsbS9zcilcbiAgICAgICAgLy8gLSBEaXJlY3Rpb25hbCBsaWdodHMgdXNlIGlsbHVtaW5hbmNlIGluIGx1eCAobG0vbTIpLlxuICAgICAgICAvLyBDdXJyZW50IGltcGxlbWVudGF0aW9uOiBjbGFwbXMgc3BlY2lmaWVkIGludGVuc2l0eSB0byAwLi4yIHJhbmdlXG4gICAgICAgIGludGVuc2l0eTogZ2x0ZkxpZ2h0Lmhhc093blByb3BlcnR5KCdpbnRlbnNpdHknKSA/IG1hdGguY2xhbXAoZ2x0ZkxpZ2h0LmludGVuc2l0eSwgMCwgMikgOiAxXG4gICAgfTtcblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoJ3Nwb3QnKSkge1xuICAgICAgICBsaWdodFByb3BzLmlubmVyQ29uZUFuZ2xlID0gZ2x0ZkxpZ2h0LnNwb3QuaGFzT3duUHJvcGVydHkoJ2lubmVyQ29uZUFuZ2xlJykgPyBnbHRmTGlnaHQuc3BvdC5pbm5lckNvbmVBbmdsZSAqIG1hdGguUkFEX1RPX0RFRyA6IDA7XG4gICAgICAgIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUgPSBnbHRmTGlnaHQuc3BvdC5oYXNPd25Qcm9wZXJ0eSgnb3V0ZXJDb25lQW5nbGUnKSA/IGdsdGZMaWdodC5zcG90Lm91dGVyQ29uZUFuZ2xlICogbWF0aC5SQURfVE9fREVHIDogTWF0aC5QSSAvIDQ7XG4gICAgfVxuXG4gICAgLy8gZ2xURiBzdG9yZXMgbGlnaHQgYWxyZWFkeSBpbiBlbmVyZ3kvYXJlYSwgYnV0IHdlIG5lZWQgdG8gcHJvdmlkZSB0aGUgbGlnaHQgd2l0aCBvbmx5IHRoZSBlbmVyZ3kgcGFyYW1ldGVyLFxuICAgIC8vIHNvIHdlIG5lZWQgdGhlIGludGVuc2l0aWVzIGluIGNhbmRlbGEgYmFjayB0byBsdW1lblxuICAgIGlmIChnbHRmTGlnaHQuaGFzT3duUHJvcGVydHkoXCJpbnRlbnNpdHlcIikpIHtcbiAgICAgICAgbGlnaHRQcm9wcy5sdW1pbmFuY2UgPSBnbHRmTGlnaHQuaW50ZW5zaXR5ICogTGlnaHQuZ2V0TGlnaHRVbml0Q29udmVyc2lvbihsaWdodFR5cGVzW2xpZ2h0UHJvcHMudHlwZV0sIGxpZ2h0UHJvcHMub3V0ZXJDb25lQW5nbGUsIGxpZ2h0UHJvcHMuaW5uZXJDb25lQW5nbGUpO1xuICAgIH1cblxuICAgIC8vIFJvdGF0ZSB0byBtYXRjaCBsaWdodCBvcmllbnRhdGlvbiBpbiBnbFRGIHNwZWNpZmljYXRpb25cbiAgICAvLyBOb3RlIHRoYXQgdGhpcyBhZGRzIGEgbmV3IGVudGl0eSBub2RlIGludG8gdGhlIGhpZXJhcmNoeSB0aGF0IGRvZXMgbm90IGV4aXN0IGluIHRoZSBnbHRmIGhpZXJhcmNoeVxuICAgIGNvbnN0IGxpZ2h0RW50aXR5ID0gbmV3IEVudGl0eShub2RlLm5hbWUpO1xuICAgIGxpZ2h0RW50aXR5LnJvdGF0ZUxvY2FsKDkwLCAwLCAwKTtcblxuICAgIC8vIGFkZCBjb21wb25lbnRcbiAgICBsaWdodEVudGl0eS5hZGRDb21wb25lbnQoJ2xpZ2h0JywgbGlnaHRQcm9wcyk7XG4gICAgcmV0dXJuIGxpZ2h0RW50aXR5O1xufTtcblxuY29uc3QgY3JlYXRlU2tpbnMgPSAoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld3MpID0+IHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ3NraW5zJykgfHwgZ2x0Zi5za2lucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIC8vIGNhY2hlIGZvciBza2lucyB0byBmaWx0ZXIgb3V0IGR1cGxpY2F0ZXNcbiAgICBjb25zdCBnbGJTa2lucyA9IG5ldyBNYXAoKTtcblxuICAgIHJldHVybiBnbHRmLnNraW5zLm1hcCgoZ2x0ZlNraW4pID0+IHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVNraW4oZGV2aWNlLCBnbHRmU2tpbiwgZ2x0Zi5hY2Nlc3NvcnMsIGJ1ZmZlclZpZXdzLCBub2RlcywgZ2xiU2tpbnMpO1xuICAgIH0pO1xufTtcblxuY29uc3QgY3JlYXRlTWVzaGVzID0gKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIGZsaXBWLCBvcHRpb25zKSA9PiB7XG4gICAgLy8gZGljdGlvbmFyeSBvZiB2ZXJ0ZXggYnVmZmVycyB0byBhdm9pZCBkdXBsaWNhdGVzXG4gICAgY29uc3QgdmVydGV4QnVmZmVyRGljdCA9IHt9O1xuICAgIGNvbnN0IG1lc2hWYXJpYW50cyA9IHt9O1xuICAgIGNvbnN0IG1lc2hEZWZhdWx0TWF0ZXJpYWxzID0ge307XG4gICAgY29uc3QgcHJvbWlzZXMgPSBbXTtcblxuICAgIGNvbnN0IHZhbGlkID0gKCFvcHRpb25zLnNraXBNZXNoZXMgJiYgZ2x0Zj8ubWVzaGVzPy5sZW5ndGggJiYgZ2x0Zj8uYWNjZXNzb3JzPy5sZW5ndGggJiYgZ2x0Zj8uYnVmZmVyVmlld3M/Lmxlbmd0aCk7XG4gICAgY29uc3QgbWVzaGVzID0gdmFsaWQgPyBnbHRmLm1lc2hlcy5tYXAoKGdsdGZNZXNoKSA9PiB7XG4gICAgICAgIHJldHVybiBjcmVhdGVNZXNoKGRldmljZSwgZ2x0Zk1lc2gsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgZmxpcFYsIHZlcnRleEJ1ZmZlckRpY3QsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIG9wdGlvbnMsIHByb21pc2VzKTtcbiAgICB9KSA6IFtdO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgbWVzaGVzLFxuICAgICAgICBtZXNoVmFyaWFudHMsXG4gICAgICAgIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLFxuICAgICAgICBwcm9taXNlc1xuICAgIH07XG59O1xuXG5jb25zdCBjcmVhdGVNYXRlcmlhbHMgPSAoZ2x0ZiwgdGV4dHVyZXMsIG9wdGlvbnMsIGZsaXBWKSA9PiB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdtYXRlcmlhbHMnKSB8fCBnbHRmLm1hdGVyaWFscy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5tYXRlcmlhbD8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucz8ubWF0ZXJpYWw/LnByb2Nlc3MgPz8gY3JlYXRlTWF0ZXJpYWw7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy5tYXRlcmlhbD8ucG9zdHByb2Nlc3M7XG5cbiAgICByZXR1cm4gZ2x0Zi5tYXRlcmlhbHMubWFwKChnbHRmTWF0ZXJpYWwpID0+IHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk1hdGVyaWFsKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHByb2Nlc3MoZ2x0Zk1hdGVyaWFsLCB0ZXh0dXJlcywgZmxpcFYpO1xuICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgIHBvc3Rwcm9jZXNzKGdsdGZNYXRlcmlhbCwgbWF0ZXJpYWwpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICB9KTtcbn07XG5cbmNvbnN0IGNyZWF0ZVZhcmlhbnRzID0gKGdsdGYpID0+IHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoXCJleHRlbnNpb25zXCIpIHx8ICFnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoXCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzXCIpKVxuICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IGRhdGEgPSBnbHRmLmV4dGVuc2lvbnMuS0hSX21hdGVyaWFsc192YXJpYW50cy52YXJpYW50cztcbiAgICBjb25zdCB2YXJpYW50cyA9IHt9O1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXJpYW50c1tkYXRhW2ldLm5hbWVdID0gaTtcbiAgICB9XG4gICAgcmV0dXJuIHZhcmlhbnRzO1xufTtcblxuY29uc3QgY3JlYXRlQW5pbWF0aW9ucyA9IChnbHRmLCBub2RlcywgYnVmZmVyVmlld3MsIG9wdGlvbnMpID0+IHtcbiAgICBpZiAoIWdsdGYuaGFzT3duUHJvcGVydHkoJ2FuaW1hdGlvbnMnKSB8fCBnbHRmLmFuaW1hdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8uYW5pbWF0aW9uPy5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uYW5pbWF0aW9uPy5wb3N0cHJvY2VzcztcblxuICAgIHJldHVybiBnbHRmLmFuaW1hdGlvbnMubWFwKChnbHRmQW5pbWF0aW9uLCBpbmRleCkgPT4ge1xuICAgICAgICBpZiAocHJlcHJvY2Vzcykge1xuICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmQW5pbWF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbmltYXRpb24gPSBjcmVhdGVBbmltYXRpb24oZ2x0ZkFuaW1hdGlvbiwgaW5kZXgsIGdsdGYuYWNjZXNzb3JzLCBidWZmZXJWaWV3cywgbm9kZXMsIGdsdGYubWVzaGVzLCBnbHRmLm5vZGVzKTtcbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmQW5pbWF0aW9uLCBhbmltYXRpb24pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhbmltYXRpb247XG4gICAgfSk7XG59O1xuXG5jb25zdCBjcmVhdGVOb2RlcyA9IChnbHRmLCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKCFnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpIHx8IGdsdGYubm9kZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8ubm9kZT8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzID0gb3B0aW9ucz8ubm9kZT8ucHJvY2VzcyA/PyBjcmVhdGVOb2RlO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8ubm9kZT8ucG9zdHByb2Nlc3M7XG5cbiAgICBjb25zdCBub2RlcyA9IGdsdGYubm9kZXMubWFwKChnbHRmTm9kZSwgaW5kZXgpID0+IHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0Zk5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5vZGUgPSBwcm9jZXNzKGdsdGZOb2RlLCBpbmRleCk7XG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zk5vZGUsIG5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH0pO1xuXG4gICAgLy8gYnVpbGQgbm9kZSBoaWVyYXJjaHlcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYubm9kZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0Zk5vZGUgPSBnbHRmLm5vZGVzW2ldO1xuICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NoaWxkcmVuJykpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IG5vZGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgdW5pcXVlTmFtZXMgPSB7IH07XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGdsdGZOb2RlLmNoaWxkcmVuLmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBub2Rlc1tnbHRmTm9kZS5jaGlsZHJlbltqXV07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZC5wYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVuaXF1ZU5hbWVzLmhhc093blByb3BlcnR5KGNoaWxkLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGlsZC5uYW1lICs9IHVuaXF1ZU5hbWVzW2NoaWxkLm5hbWVdKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1bmlxdWVOYW1lc1tjaGlsZC5uYW1lXSA9IDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcGFyZW50LmFkZENoaWxkKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZXM7XG59O1xuXG5jb25zdCBjcmVhdGVTY2VuZXMgPSAoZ2x0Ziwgbm9kZXMpID0+IHtcbiAgICBjb25zdCBzY2VuZXMgPSBbXTtcbiAgICBjb25zdCBjb3VudCA9IGdsdGYuc2NlbmVzLmxlbmd0aDtcblxuICAgIC8vIGlmIHRoZXJlJ3MgYSBzaW5nbGUgc2NlbmUgd2l0aCBhIHNpbmdsZSBub2RlIGluIGl0LCBkb24ndCBjcmVhdGUgd3JhcHBlciBub2Rlc1xuICAgIGlmIChjb3VudCA9PT0gMSAmJiBnbHRmLnNjZW5lc1swXS5ub2Rlcz8ubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IGdsdGYuc2NlbmVzWzBdLm5vZGVzWzBdO1xuICAgICAgICBzY2VuZXMucHVzaChub2Rlc1tub2RlSW5kZXhdKTtcbiAgICB9IGVsc2Uge1xuXG4gICAgICAgIC8vIGNyZWF0ZSByb290IG5vZGUgcGVyIHNjZW5lXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lc1tpXTtcbiAgICAgICAgICAgIGlmIChzY2VuZS5ub2Rlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lUm9vdCA9IG5ldyBHcmFwaE5vZGUoc2NlbmUubmFtZSk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbiA9IDA7IG4gPCBzY2VuZS5ub2Rlcy5sZW5ndGg7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZE5vZGUgPSBub2Rlc1tzY2VuZS5ub2Rlc1tuXV07XG4gICAgICAgICAgICAgICAgICAgIHNjZW5lUm9vdC5hZGRDaGlsZChjaGlsZE5vZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzY2VuZXMucHVzaChzY2VuZVJvb3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjZW5lcztcbn07XG5cbmNvbnN0IGNyZWF0ZUNhbWVyYXMgPSAoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpID0+IHtcblxuICAgIGxldCBjYW1lcmFzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2NhbWVyYXMnKSAmJiBnbHRmLmNhbWVyYXMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5jYW1lcmE/LnByZXByb2Nlc3M7XG4gICAgICAgIGNvbnN0IHByb2Nlc3MgPSBvcHRpb25zPy5jYW1lcmE/LnByb2Nlc3MgPz8gY3JlYXRlQ2FtZXJhO1xuICAgICAgICBjb25zdCBwb3N0cHJvY2VzcyA9IG9wdGlvbnM/LmNhbWVyYT8ucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKChnbHRmTm9kZSwgbm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ2NhbWVyYScpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2x0ZkNhbWVyYSA9IGdsdGYuY2FtZXJhc1tnbHRmTm9kZS5jYW1lcmFdO1xuICAgICAgICAgICAgICAgIGlmIChnbHRmQ2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZDYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHByb2Nlc3MoZ2x0ZkNhbWVyYSwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkNhbWVyYSwgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZCB0aGUgY2FtZXJhIHRvIG5vZGUtPmNhbWVyYSBtYXBcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbWVyYSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFjYW1lcmFzKSBjYW1lcmFzID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhcy5zZXQoZ2x0Zk5vZGUsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjYW1lcmFzO1xufTtcblxuY29uc3QgY3JlYXRlTGlnaHRzID0gKGdsdGYsIG5vZGVzLCBvcHRpb25zKSA9PiB7XG5cbiAgICBsZXQgbGlnaHRzID0gbnVsbDtcblxuICAgIGlmIChnbHRmLmhhc093blByb3BlcnR5KCdub2RlcycpICYmIGdsdGYuaGFzT3duUHJvcGVydHkoJ2V4dGVuc2lvbnMnKSAmJlxuICAgICAgICBnbHRmLmV4dGVuc2lvbnMuaGFzT3duUHJvcGVydHkoJ0tIUl9saWdodHNfcHVuY3R1YWwnKSAmJiBnbHRmLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHRzJykpIHtcblxuICAgICAgICBjb25zdCBnbHRmTGlnaHRzID0gZ2x0Zi5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHRzO1xuICAgICAgICBpZiAoZ2x0ZkxpZ2h0cy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnM/LmxpZ2h0Py5wcmVwcm9jZXNzO1xuICAgICAgICAgICAgY29uc3QgcHJvY2VzcyA9IG9wdGlvbnM/LmxpZ2h0Py5wcm9jZXNzID8/IGNyZWF0ZUxpZ2h0O1xuICAgICAgICAgICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy5saWdodD8ucG9zdHByb2Nlc3M7XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBub2RlcyB3aXRoIGxpZ2h0c1xuICAgICAgICAgICAgZ2x0Zi5ub2Rlcy5mb3JFYWNoKChnbHRmTm9kZSwgbm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdleHRlbnNpb25zJykgJiZcbiAgICAgICAgICAgICAgICAgICAgZ2x0Zk5vZGUuZXh0ZW5zaW9ucy5oYXNPd25Qcm9wZXJ0eSgnS0hSX2xpZ2h0c19wdW5jdHVhbCcpICYmXG4gICAgICAgICAgICAgICAgICAgIGdsdGZOb2RlLmV4dGVuc2lvbnMuS0hSX2xpZ2h0c19wdW5jdHVhbC5oYXNPd25Qcm9wZXJ0eSgnbGlnaHQnKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0SW5kZXggPSBnbHRmTm9kZS5leHRlbnNpb25zLktIUl9saWdodHNfcHVuY3R1YWwubGlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZMaWdodCA9IGdsdGZMaWdodHNbbGlnaHRJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChnbHRmTGlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJlcHJvY2VzcyhnbHRmTGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBwcm9jZXNzKGdsdGZMaWdodCwgbm9kZXNbbm9kZUluZGV4XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmTGlnaHQsIGxpZ2h0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWRkIHRoZSBsaWdodCB0byBub2RlLT5saWdodCBtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghbGlnaHRzKSBsaWdodHMgPSBuZXcgTWFwKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRzLnNldChnbHRmTm9kZSwgbGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbGlnaHRzO1xufTtcblxuLy8gbGluayBza2lucyB0byB0aGUgbWVzaGVzXG5jb25zdCBsaW5rU2tpbnMgPSAoZ2x0ZiwgcmVuZGVycywgc2tpbnMpID0+IHtcbiAgICBnbHRmLm5vZGVzLmZvckVhY2goKGdsdGZOb2RlKSA9PiB7XG4gICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnbWVzaCcpICYmIGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdza2luJykpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hHcm91cCA9IHJlbmRlcnNbZ2x0Zk5vZGUubWVzaF0ubWVzaGVzO1xuICAgICAgICAgICAgbWVzaEdyb3VwLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgICAgICAgICBtZXNoLnNraW4gPSBza2luc1tnbHRmTm9kZS5za2luXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vLyBjcmVhdGUgZW5naW5lIHJlc291cmNlcyBmcm9tIHRoZSBkb3dubG9hZGVkIEdMQiBkYXRhXG5jb25zdCBjcmVhdGVSZXNvdXJjZXMgPSBhc3luYyAoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3cywgdGV4dHVyZXMsIG9wdGlvbnMpID0+IHtcbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8uZ2xvYmFsPy5wcmVwcm9jZXNzO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uZ2xvYmFsPy5wb3N0cHJvY2VzcztcblxuICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgIHByZXByb2Nlc3MoZ2x0Zik7XG4gICAgfVxuXG4gICAgLy8gVGhlIG9yaWdpbmFsIHZlcnNpb24gb2YgRkFDVCBnZW5lcmF0ZWQgaW5jb3JyZWN0bHkgZmxpcHBlZCBWIHRleHR1cmVcbiAgICAvLyBjb29yZGluYXRlcy4gV2UgbXVzdCBjb21wZW5zYXRlIGJ5IGZsaXBwaW5nIFYgaW4gdGhpcyBjYXNlLiBPbmNlXG4gICAgLy8gYWxsIG1vZGVscyBoYXZlIGJlZW4gcmUtZXhwb3J0ZWQgd2UgY2FuIHJlbW92ZSB0aGlzIGZsYWcuXG4gICAgY29uc3QgZmxpcFYgPSBnbHRmLmFzc2V0ICYmIGdsdGYuYXNzZXQuZ2VuZXJhdG9yID09PSAnUGxheUNhbnZhcyc7XG5cbiAgICAvLyBXZSdkIGxpa2UgdG8gcmVtb3ZlIHRoZSBmbGlwViBjb2RlIGF0IHNvbWUgcG9pbnQuXG4gICAgaWYgKGZsaXBWKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ2dsVEYgbW9kZWwgbWF5IGhhdmUgZmxpcHBlZCBVVnMuIFBsZWFzZSByZWNvbnZlcnQuJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZXMgPSBjcmVhdGVOb2RlcyhnbHRmLCBvcHRpb25zKTtcbiAgICBjb25zdCBzY2VuZXMgPSBjcmVhdGVTY2VuZXMoZ2x0Ziwgbm9kZXMpO1xuICAgIGNvbnN0IGxpZ2h0cyA9IGNyZWF0ZUxpZ2h0cyhnbHRmLCBub2Rlcywgb3B0aW9ucyk7XG4gICAgY29uc3QgY2FtZXJhcyA9IGNyZWF0ZUNhbWVyYXMoZ2x0Ziwgbm9kZXMsIG9wdGlvbnMpO1xuICAgIGNvbnN0IHZhcmlhbnRzID0gY3JlYXRlVmFyaWFudHMoZ2x0Zik7XG5cbiAgICAvLyBidWZmZXIgZGF0YSBtdXN0IGhhdmUgZmluaXNoZWQgbG9hZGluZyBpbiBvcmRlciB0byBjcmVhdGUgbWVzaGVzIGFuZCBhbmltYXRpb25zXG4gICAgY29uc3QgYnVmZmVyVmlld0RhdGEgPSBhd2FpdCBQcm9taXNlLmFsbChidWZmZXJWaWV3cyk7XG4gICAgY29uc3QgeyBtZXNoZXMsIG1lc2hWYXJpYW50cywgbWVzaERlZmF1bHRNYXRlcmlhbHMsIHByb21pc2VzIH0gPSBjcmVhdGVNZXNoZXMoZGV2aWNlLCBnbHRmLCBidWZmZXJWaWV3RGF0YSwgZmxpcFYsIG9wdGlvbnMpO1xuICAgIGNvbnN0IGFuaW1hdGlvbnMgPSBjcmVhdGVBbmltYXRpb25zKGdsdGYsIG5vZGVzLCBidWZmZXJWaWV3RGF0YSwgb3B0aW9ucyk7XG5cbiAgICAvLyB0ZXh0dXJlcyBtdXN0IGhhdmUgZmluaXNoZWQgbG9hZGluZyBpbiBvcmRlciB0byBjcmVhdGUgbWF0ZXJpYWxzXG4gICAgY29uc3QgdGV4dHVyZUFzc2V0cyA9IGF3YWl0IFByb21pc2UuYWxsKHRleHR1cmVzKTtcbiAgICBjb25zdCB0ZXh0dXJlSW5zdGFuY2VzID0gdGV4dHVyZUFzc2V0cy5tYXAodCA9PiB0LnJlc291cmNlKTtcbiAgICBjb25zdCBtYXRlcmlhbHMgPSBjcmVhdGVNYXRlcmlhbHMoZ2x0ZiwgdGV4dHVyZUluc3RhbmNlcywgb3B0aW9ucywgZmxpcFYpO1xuICAgIGNvbnN0IHNraW5zID0gY3JlYXRlU2tpbnMoZGV2aWNlLCBnbHRmLCBub2RlcywgYnVmZmVyVmlld0RhdGEpO1xuXG4gICAgLy8gY3JlYXRlIHJlbmRlcnMgdG8gd3JhcCBtZXNoZXNcbiAgICBjb25zdCByZW5kZXJzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcmVuZGVyc1tpXSA9IG5ldyBSZW5kZXIoKTtcbiAgICAgICAgcmVuZGVyc1tpXS5tZXNoZXMgPSBtZXNoZXNbaV07XG4gICAgfVxuXG4gICAgLy8gbGluayBza2lucyB0byBtZXNoZXNcbiAgICBsaW5rU2tpbnMoZ2x0ZiwgcmVuZGVycywgc2tpbnMpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IEdsYlJlc291cmNlcygpO1xuICAgIHJlc3VsdC5nbHRmID0gZ2x0ZjtcbiAgICByZXN1bHQubm9kZXMgPSBub2RlcztcbiAgICByZXN1bHQuc2NlbmVzID0gc2NlbmVzO1xuICAgIHJlc3VsdC5hbmltYXRpb25zID0gYW5pbWF0aW9ucztcbiAgICByZXN1bHQudGV4dHVyZXMgPSB0ZXh0dXJlQXNzZXRzO1xuICAgIHJlc3VsdC5tYXRlcmlhbHMgPSBtYXRlcmlhbHM7XG4gICAgcmVzdWx0LnZhcmlhbnRzID0gdmFyaWFudHM7XG4gICAgcmVzdWx0Lm1lc2hWYXJpYW50cyA9IG1lc2hWYXJpYW50cztcbiAgICByZXN1bHQubWVzaERlZmF1bHRNYXRlcmlhbHMgPSBtZXNoRGVmYXVsdE1hdGVyaWFscztcbiAgICByZXN1bHQucmVuZGVycyA9IHJlbmRlcnM7XG4gICAgcmVzdWx0LnNraW5zID0gc2tpbnM7XG4gICAgcmVzdWx0LmxpZ2h0cyA9IGxpZ2h0cztcbiAgICByZXN1bHQuY2FtZXJhcyA9IGNhbWVyYXM7XG5cbiAgICBpZiAocG9zdHByb2Nlc3MpIHtcbiAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZiwgcmVzdWx0KTtcbiAgICB9XG5cbiAgICAvLyB3YWl0IGZvciBkcmFjbyBtZXNoZXMgdG8gY29tcGxldGUgZGVjb2RpbmdcbiAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY29uc3QgYXBwbHlTYW1wbGVyID0gKHRleHR1cmUsIGdsdGZTYW1wbGVyKSA9PiB7XG4gICAgY29uc3QgZ2V0RmlsdGVyID0gKGZpbHRlciwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICAgIHN3aXRjaCAoZmlsdGVyKSB7XG4gICAgICAgICAgICBjYXNlIDk3Mjg6IHJldHVybiBGSUxURVJfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTcyOTogcmV0dXJuIEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICBjYXNlIDk5ODQ6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVDtcbiAgICAgICAgICAgIGNhc2UgOTk4NTogcmV0dXJuIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q7XG4gICAgICAgICAgICBjYXNlIDk5ODY6IHJldHVybiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgY2FzZSA5OTg3OiByZXR1cm4gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSO1xuICAgICAgICAgICAgZGVmYXVsdDogICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IGdldFdyYXAgPSAod3JhcCwgZGVmYXVsdFZhbHVlKSA9PiB7XG4gICAgICAgIHN3aXRjaCAod3JhcCkge1xuICAgICAgICAgICAgY2FzZSAzMzA3MTogcmV0dXJuIEFERFJFU1NfQ0xBTVBfVE9fRURHRTtcbiAgICAgICAgICAgIGNhc2UgMzM2NDg6IHJldHVybiBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDtcbiAgICAgICAgICAgIGNhc2UgMTA0OTc6IHJldHVybiBBRERSRVNTX1JFUEVBVDtcbiAgICAgICAgICAgIGRlZmF1bHQ6ICAgIHJldHVybiBkZWZhdWx0VmFsdWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHRleHR1cmUpIHtcbiAgICAgICAgZ2x0ZlNhbXBsZXIgPSBnbHRmU2FtcGxlciA/PyB7IH07XG4gICAgICAgIHRleHR1cmUubWluRmlsdGVyID0gZ2V0RmlsdGVyKGdsdGZTYW1wbGVyLm1pbkZpbHRlciwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5tYWdGaWx0ZXIgPSBnZXRGaWx0ZXIoZ2x0ZlNhbXBsZXIubWFnRmlsdGVyLCBGSUxURVJfTElORUFSKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzVSA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFMsIEFERFJFU1NfUkVQRUFUKTtcbiAgICAgICAgdGV4dHVyZS5hZGRyZXNzViA9IGdldFdyYXAoZ2x0ZlNhbXBsZXIud3JhcFQsIEFERFJFU1NfUkVQRUFUKTtcbiAgICB9XG59O1xuXG5sZXQgZ2x0ZlRleHR1cmVVbmlxdWVJZCA9IDA7XG5cbi8vIGNyZWF0ZSBnbHRmIGltYWdlcy4gcmV0dXJucyBhbiBhcnJheSBvZiBwcm9taXNlcyB0aGF0IHJlc29sdmUgdG8gdGV4dHVyZSBhc3NldHMuXG5jb25zdCBjcmVhdGVJbWFnZXMgPSAoZ2x0ZiwgYnVmZmVyVmlld3MsIHVybEJhc2UsIHJlZ2lzdHJ5LCBvcHRpb25zKSA9PiB7XG4gICAgaWYgKCFnbHRmLmltYWdlcyB8fCBnbHRmLmltYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5pbWFnZT8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSBvcHRpb25zPy5pbWFnZT8ucHJvY2Vzc0FzeW5jO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uaW1hZ2U/LnBvc3Rwcm9jZXNzO1xuXG4gICAgY29uc3QgbWltZVR5cGVGaWxlRXh0ZW5zaW9ucyA9IHtcbiAgICAgICAgJ2ltYWdlL3BuZyc6ICdwbmcnLFxuICAgICAgICAnaW1hZ2UvanBlZyc6ICdqcGcnLFxuICAgICAgICAnaW1hZ2UvYmFzaXMnOiAnYmFzaXMnLFxuICAgICAgICAnaW1hZ2Uva3R4JzogJ2t0eCcsXG4gICAgICAgICdpbWFnZS9rdHgyJzogJ2t0eDInLFxuICAgICAgICAnaW1hZ2Uvdm5kLW1zLmRkcyc6ICdkZHMnXG4gICAgfTtcblxuICAgIGNvbnN0IGxvYWRUZXh0dXJlID0gKGdsdGZJbWFnZSwgdXJsLCBidWZmZXJWaWV3LCBtaW1lVHlwZSwgb3B0aW9ucykgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgY29udGludWF0aW9uID0gKGJ1ZmZlclZpZXdEYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZSA9IChnbHRmSW1hZ2UubmFtZSB8fCAnZ2x0Zi10ZXh0dXJlJykgKyAnLScgKyBnbHRmVGV4dHVyZVVuaXF1ZUlkKys7XG5cbiAgICAgICAgICAgICAgICAvLyBjb25zdHJ1Y3QgdGhlIGFzc2V0IGZpbGVcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0ge1xuICAgICAgICAgICAgICAgICAgICB1cmw6IHVybCB8fCBuYW1lXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAoYnVmZmVyVmlld0RhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZS5jb250ZW50cyA9IGJ1ZmZlclZpZXdEYXRhLnNsaWNlKDApLmJ1ZmZlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG1pbWVUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IG1pbWVUeXBlRmlsZUV4dGVuc2lvbnNbbWltZVR5cGVdO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0ZW5zaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlLmZpbGVuYW1lID0gZmlsZS51cmwgKyAnLicgKyBleHRlbnNpb247XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgYW5kIGxvYWQgdGhlIGFzc2V0XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBuZXcgQXNzZXQobmFtZSwgJ3RleHR1cmUnLCBmaWxlLCBudWxsLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICBhc3NldC5vbignbG9hZCcsIGFzc2V0ID0+IHJlc29sdmUoYXNzZXQpKTtcbiAgICAgICAgICAgICAgICBhc3NldC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpO1xuICAgICAgICAgICAgICAgIHJlZ2lzdHJ5LmFkZChhc3NldCk7XG4gICAgICAgICAgICAgICAgcmVnaXN0cnkubG9hZChhc3NldCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoYnVmZmVyVmlldykge1xuICAgICAgICAgICAgICAgIGJ1ZmZlclZpZXcudGhlbihidWZmZXJWaWV3RGF0YSA9PiBjb250aW51YXRpb24oYnVmZmVyVmlld0RhdGEpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udGludWF0aW9uKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGdsdGYuaW1hZ2VzLm1hcCgoZ2x0ZkltYWdlLCBpKSA9PiB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZJbWFnZSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJvbWlzZTtcblxuICAgICAgICBpZiAocHJvY2Vzc0FzeW5jKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NBc3luYyhnbHRmSW1hZ2UsIChlcnIsIHRleHR1cmVBc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUodGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigodGV4dHVyZUFzc2V0KSA9PiB7XG4gICAgICAgICAgICBpZiAodGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRleHR1cmVBc3NldDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZ2x0ZkltYWdlLmhhc093blByb3BlcnR5KCd1cmknKSkge1xuICAgICAgICAgICAgICAgIC8vIHVyaSBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICBpZiAoaXNEYXRhVVJJKGdsdGZJbWFnZS51cmkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBsb2FkVGV4dHVyZShnbHRmSW1hZ2UsIGdsdGZJbWFnZS51cmksIG51bGwsIGdldERhdGFVUklNaW1lVHlwZShnbHRmSW1hZ2UudXJpKSwgbnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBsb2FkVGV4dHVyZShnbHRmSW1hZ2UsIEFCU09MVVRFX1VSTC50ZXN0KGdsdGZJbWFnZS51cmkpID8gZ2x0ZkltYWdlLnVyaSA6IHBhdGguam9pbih1cmxCYXNlLCBnbHRmSW1hZ2UudXJpKSwgbnVsbCwgbnVsbCwgeyBjcm9zc09yaWdpbjogJ2Fub255bW91cycgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgnYnVmZmVyVmlldycpICYmIGdsdGZJbWFnZS5oYXNPd25Qcm9wZXJ0eSgnbWltZVR5cGUnKSkge1xuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlcnZpZXdcbiAgICAgICAgICAgICAgICByZXR1cm4gbG9hZFRleHR1cmUoZ2x0ZkltYWdlLCBudWxsLCBidWZmZXJWaWV3c1tnbHRmSW1hZ2UuYnVmZmVyVmlld10sIGdsdGZJbWFnZS5taW1lVHlwZSwgbnVsbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGZhaWxcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoYEludmFsaWQgaW1hZ2UgZm91bmQgaW4gZ2x0ZiAobmVpdGhlciB1cmkgb3IgYnVmZmVyVmlldyBmb3VuZCkuIGluZGV4PSR7aX1gKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigodGV4dHVyZUFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkltYWdlLCB0ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZXh0dXJlQXNzZXQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH0pO1xufTtcblxuLy8gY3JlYXRlIGdsdGYgdGV4dHVyZXMuIHJldHVybnMgYW4gYXJyYXkgb2YgcHJvbWlzZXMgdGhhdCByZXNvbHZlIHRvIHRleHR1cmUgYXNzZXRzLlxuY29uc3QgY3JlYXRlVGV4dHVyZXMgPSAoZ2x0ZiwgaW1hZ2VzLCBvcHRpb25zKSA9PiB7XG5cbiAgICBpZiAoIWdsdGY/LmltYWdlcz8ubGVuZ3RoIHx8ICFnbHRmPy50ZXh0dXJlcz8ubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBwcmVwcm9jZXNzID0gb3B0aW9ucz8udGV4dHVyZT8ucHJlcHJvY2VzcztcbiAgICBjb25zdCBwcm9jZXNzQXN5bmMgPSBvcHRpb25zPy50ZXh0dXJlPy5wcm9jZXNzQXN5bmM7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy50ZXh0dXJlPy5wb3N0cHJvY2VzcztcblxuICAgIGNvbnN0IHNlZW5JbWFnZXMgPSBuZXcgU2V0KCk7XG5cbiAgICByZXR1cm4gZ2x0Zi50ZXh0dXJlcy5tYXAoKGdsdGZUZXh0dXJlKSA9PiB7XG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZUZXh0dXJlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBwcm9taXNlO1xuXG4gICAgICAgIGlmIChwcm9jZXNzQXN5bmMpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZUZXh0dXJlLCBnbHRmLmltYWdlcywgKGVyciwgZ2x0ZkltYWdlSW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGdsdGZJbWFnZUluZGV4KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShudWxsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigoZ2x0ZkltYWdlSW5kZXgpID0+IHtcbiAgICAgICAgICAgIC8vIHJlc29sdmUgaW1hZ2UgaW5kZXhcbiAgICAgICAgICAgIGdsdGZJbWFnZUluZGV4ID0gZ2x0ZkltYWdlSW5kZXggPz9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZlRleHR1cmU/LmV4dGVuc2lvbnM/LktIUl90ZXh0dXJlX2Jhc2lzdT8uc291cmNlID8/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsdGZUZXh0dXJlPy5leHRlbnNpb25zPy5FWFRfdGV4dHVyZV93ZWJwPy5zb3VyY2UgPz9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2x0ZlRleHR1cmUuc291cmNlO1xuXG4gICAgICAgICAgICBjb25zdCBjbG9uZUFzc2V0ID0gc2VlbkltYWdlcy5oYXMoZ2x0ZkltYWdlSW5kZXgpO1xuICAgICAgICAgICAgc2VlbkltYWdlcy5hZGQoZ2x0ZkltYWdlSW5kZXgpO1xuXG4gICAgICAgICAgICByZXR1cm4gaW1hZ2VzW2dsdGZJbWFnZUluZGV4XS50aGVuKChpbWFnZUFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBjbG9uZUFzc2V0ID8gY2xvbmVUZXh0dXJlQXNzZXQoaW1hZ2VBc3NldCkgOiBpbWFnZUFzc2V0O1xuICAgICAgICAgICAgICAgIGFwcGx5U2FtcGxlcihhc3NldC5yZXNvdXJjZSwgKGdsdGYuc2FtcGxlcnMgPz8gW10pW2dsdGZUZXh0dXJlLnNhbXBsZXJdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXNzZXQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKCh0ZXh0dXJlQXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBwb3N0cHJvY2VzcyhnbHRmVGV4dHVyZSwgdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGV4dHVyZUFzc2V0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9KTtcbn07XG5cbi8vIGxvYWQgZ2x0ZiBidWZmZXJzLiByZXR1cm5zIGFuIGFycmF5IG9mIHByb21pc2VzIHRoYXQgcmVzb2x2ZSB0byB0eXBlZCBhcnJheXMuXG5jb25zdCBsb2FkQnVmZmVycyA9IChnbHRmLCBiaW5hcnlDaHVuaywgdXJsQmFzZSwgb3B0aW9ucykgPT4ge1xuICAgIGlmICghZ2x0Zi5idWZmZXJzIHx8IGdsdGYuYnVmZmVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHByZXByb2Nlc3MgPSBvcHRpb25zPy5idWZmZXI/LnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gb3B0aW9ucz8uYnVmZmVyPy5wcm9jZXNzQXN5bmM7XG4gICAgY29uc3QgcG9zdHByb2Nlc3MgPSBvcHRpb25zPy5idWZmZXI/LnBvc3Rwcm9jZXNzO1xuXG4gICAgcmV0dXJuIGdsdGYuYnVmZmVycy5tYXAoKGdsdGZCdWZmZXIsIGkpID0+IHtcbiAgICAgICAgaWYgKHByZXByb2Nlc3MpIHtcbiAgICAgICAgICAgIHByZXByb2Nlc3MoZ2x0ZkJ1ZmZlcik7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJvbWlzZTtcblxuICAgICAgICBpZiAocHJvY2Vzc0FzeW5jKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2Nlc3NBc3luYyhnbHRmQnVmZmVyLCAoZXJyLCBhcnJheUJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoYXJyYXlCdWZmZXIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKG51bGwpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKChhcnJheUJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgaWYgKGFycmF5QnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFycmF5QnVmZmVyO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChnbHRmQnVmZmVyLmhhc093blByb3BlcnR5KCd1cmknKSkge1xuICAgICAgICAgICAgICAgIGlmIChpc0RhdGFVUkkoZ2x0ZkJ1ZmZlci51cmkpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnZlcnQgYmFzZTY0IHRvIHJhdyBiaW5hcnkgZGF0YSBoZWxkIGluIGEgc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgIC8vIGRvZXNuJ3QgaGFuZGxlIFVSTEVuY29kZWQgRGF0YVVSSXMgLSBzZWUgU08gYW5zd2VyICM2ODUwMjc2IGZvciBjb2RlIHRoYXQgZG9lcyB0aGlzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ5dGVTdHJpbmcgPSBhdG9iKGdsdGZCdWZmZXIudXJpLnNwbGl0KCcsJylbMV0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBhIHZpZXcgaW50byB0aGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJpbmFyeUFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZVN0cmluZy5sZW5ndGgpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNldCB0aGUgYnl0ZXMgb2YgdGhlIGJ1ZmZlciB0byB0aGUgY29ycmVjdCB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBieXRlU3RyaW5nLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5hcnlBcnJheVtqXSA9IGJ5dGVTdHJpbmcuY2hhckNvZGVBdChqKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBiaW5hcnlBcnJheTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBodHRwLmdldChcbiAgICAgICAgICAgICAgICAgICAgICAgIEFCU09MVVRFX1VSTC50ZXN0KGdsdGZCdWZmZXIudXJpKSA/IGdsdGZCdWZmZXIudXJpIDogcGF0aC5qb2luKHVybEJhc2UsIGdsdGZCdWZmZXIudXJpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgY2FjaGU6IHRydWUsIHJlc3BvbnNlVHlwZTogJ2FycmF5YnVmZmVyJywgcmV0cnk6IGZhbHNlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAoZXJyLCByZXN1bHQpID0+IHsgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1sb29wLWZ1bmNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUobmV3IFVpbnQ4QXJyYXkocmVzdWx0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdsYiBidWZmZXIgcmVmZXJlbmNlXG4gICAgICAgICAgICByZXR1cm4gYmluYXJ5Q2h1bms7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChwb3N0cHJvY2Vzcykge1xuICAgICAgICAgICAgcHJvbWlzZSA9IHByb21pc2UudGhlbigoYnVmZmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0Zi5idWZmZXJzW2ldLCBidWZmZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXI7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH0pO1xufTtcblxuLy8gcGFyc2UgdGhlIGdsdGYgY2h1bmssIHJldHVybnMgdGhlIGdsdGYganNvblxuY29uc3QgcGFyc2VHbHRmID0gKGdsdGZDaHVuaywgY2FsbGJhY2spID0+IHtcbiAgICBjb25zdCBkZWNvZGVCaW5hcnlVdGY4ID0gKGFycmF5KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgVGV4dERlY29kZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGFycmF5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzdHIgPSAnJztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc3RyICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYXJyYXlbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChlc2NhcGUoc3RyKSk7XG4gICAgfTtcblxuICAgIGNvbnN0IGdsdGYgPSBKU09OLnBhcnNlKGRlY29kZUJpbmFyeVV0ZjgoZ2x0ZkNodW5rKSk7XG5cbiAgICAvLyBjaGVjayBnbHRmIHZlcnNpb25cbiAgICBpZiAoZ2x0Zi5hc3NldCAmJiBnbHRmLmFzc2V0LnZlcnNpb24gJiYgcGFyc2VGbG9hdChnbHRmLmFzc2V0LnZlcnNpb24pIDwgMikge1xuICAgICAgICBjYWxsYmFjayhgSW52YWxpZCBnbHRmIHZlcnNpb24uIEV4cGVjdGVkIHZlcnNpb24gMi4wIG9yIGFib3ZlIGJ1dCBmb3VuZCB2ZXJzaW9uICcke2dsdGYuYXNzZXQudmVyc2lvbn0nLmApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gY2hlY2sgcmVxdWlyZWQgZXh0ZW5zaW9uc1xuICAgIGNhbGxiYWNrKG51bGwsIGdsdGYpO1xufTtcblxuLy8gcGFyc2UgZ2xiIGRhdGEsIHJldHVybnMgdGhlIGdsdGYgYW5kIGJpbmFyeSBjaHVua1xuY29uc3QgcGFyc2VHbGIgPSAoZ2xiRGF0YSwgY2FsbGJhY2spID0+IHtcbiAgICBjb25zdCBkYXRhID0gKGdsYkRhdGEgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikgPyBuZXcgRGF0YVZpZXcoZ2xiRGF0YSkgOiBuZXcgRGF0YVZpZXcoZ2xiRGF0YS5idWZmZXIsIGdsYkRhdGEuYnl0ZU9mZnNldCwgZ2xiRGF0YS5ieXRlTGVuZ3RoKTtcblxuICAgIC8vIHJlYWQgaGVhZGVyXG4gICAgY29uc3QgbWFnaWMgPSBkYXRhLmdldFVpbnQzMigwLCB0cnVlKTtcbiAgICBjb25zdCB2ZXJzaW9uID0gZGF0YS5nZXRVaW50MzIoNCwgdHJ1ZSk7XG4gICAgY29uc3QgbGVuZ3RoID0gZGF0YS5nZXRVaW50MzIoOCwgdHJ1ZSk7XG5cbiAgICBpZiAobWFnaWMgIT09IDB4NDY1NDZDNjcpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbWFnaWMgbnVtYmVyIGZvdW5kIGluIGdsYiBoZWFkZXIuIEV4cGVjdGVkIDB4NDY1NDZDNjcsIGZvdW5kIDB4JyArIG1hZ2ljLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodmVyc2lvbiAhPT0gMikge1xuICAgICAgICBjYWxsYmFjaygnSW52YWxpZCB2ZXJzaW9uIG51bWJlciBmb3VuZCBpbiBnbGIgaGVhZGVyLiBFeHBlY3RlZCAyLCBmb3VuZCAnICsgdmVyc2lvbik7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAobGVuZ3RoIDw9IDAgfHwgbGVuZ3RoID4gZGF0YS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrKCdJbnZhbGlkIGxlbmd0aCBmb3VuZCBpbiBnbGIgaGVhZGVyLiBGb3VuZCAnICsgbGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHJlYWQgY2h1bmtzXG4gICAgY29uc3QgY2h1bmtzID0gW107XG4gICAgbGV0IG9mZnNldCA9IDEyO1xuICAgIHdoaWxlIChvZmZzZXQgPCBsZW5ndGgpIHtcbiAgICAgICAgY29uc3QgY2h1bmtMZW5ndGggPSBkYXRhLmdldFVpbnQzMihvZmZzZXQsIHRydWUpO1xuICAgICAgICBpZiAob2Zmc2V0ICsgY2h1bmtMZW5ndGggKyA4ID4gZGF0YS5ieXRlTGVuZ3RoKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhgSW52YWxpZCBjaHVuayBsZW5ndGggZm91bmQgaW4gZ2xiLiBGb3VuZCAke2NodW5rTGVuZ3RofWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNodW5rVHlwZSA9IGRhdGEuZ2V0VWludDMyKG9mZnNldCArIDQsIHRydWUpO1xuICAgICAgICBjb25zdCBjaHVua0RhdGEgPSBuZXcgVWludDhBcnJheShkYXRhLmJ1ZmZlciwgZGF0YS5ieXRlT2Zmc2V0ICsgb2Zmc2V0ICsgOCwgY2h1bmtMZW5ndGgpO1xuICAgICAgICBjaHVua3MucHVzaCh7IGxlbmd0aDogY2h1bmtMZW5ndGgsIHR5cGU6IGNodW5rVHlwZSwgZGF0YTogY2h1bmtEYXRhIH0pO1xuICAgICAgICBvZmZzZXQgKz0gY2h1bmtMZW5ndGggKyA4O1xuICAgIH1cblxuICAgIGlmIChjaHVua3MubGVuZ3RoICE9PSAxICYmIGNodW5rcy5sZW5ndGggIT09IDIpIHtcbiAgICAgICAgY2FsbGJhY2soJ0ludmFsaWQgbnVtYmVyIG9mIGNodW5rcyBmb3VuZCBpbiBnbGIgZmlsZS4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChjaHVua3NbMF0udHlwZSAhPT0gMHg0RTRGNTM0QSkge1xuICAgICAgICBjYWxsYmFjayhgSW52YWxpZCBjaHVuayB0eXBlIGZvdW5kIGluIGdsYiBmaWxlLiBFeHBlY3RlZCAweDRFNEY1MzRBLCBmb3VuZCAweCR7Y2h1bmtzWzBdLnR5cGUudG9TdHJpbmcoMTYpfWApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGNodW5rcy5sZW5ndGggPiAxICYmIGNodW5rc1sxXS50eXBlICE9PSAweDAwNEU0OTQyKSB7XG4gICAgICAgIGNhbGxiYWNrKGBJbnZhbGlkIGNodW5rIHR5cGUgZm91bmQgaW4gZ2xiIGZpbGUuIEV4cGVjdGVkIDB4MDA0RTQ5NDIsIGZvdW5kIDB4JHtjaHVua3NbMV0udHlwZS50b1N0cmluZygxNil9YCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjYWxsYmFjayhudWxsLCB7XG4gICAgICAgIGdsdGZDaHVuazogY2h1bmtzWzBdLmRhdGEsXG4gICAgICAgIGJpbmFyeUNodW5rOiBjaHVua3MubGVuZ3RoID09PSAyID8gY2h1bmtzWzFdLmRhdGEgOiBudWxsXG4gICAgfSk7XG59O1xuXG4vLyBwYXJzZSB0aGUgY2h1bmsgb2YgZGF0YSwgd2hpY2ggY2FuIGJlIGdsYiBvciBnbHRmXG5jb25zdCBwYXJzZUNodW5rID0gKGZpbGVuYW1lLCBkYXRhLCBjYWxsYmFjaykgPT4ge1xuICAgIGNvbnN0IGhhc0dsYkhlYWRlciA9ICgpID0+IHtcbiAgICAgICAgLy8gZ2xiIGZvcm1hdCBzdGFydHMgd2l0aCAnZ2xURidcbiAgICAgICAgY29uc3QgdTggPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgICAgICAgcmV0dXJuIHU4WzBdID09PSAxMDMgJiYgdThbMV0gPT09IDEwOCAmJiB1OFsyXSA9PT0gODQgJiYgdThbM10gPT09IDcwO1xuICAgIH07XG5cbiAgICBpZiAoKGZpbGVuYW1lICYmIGZpbGVuYW1lLnRvTG93ZXJDYXNlKCkuZW5kc1dpdGgoJy5nbGInKSkgfHwgaGFzR2xiSGVhZGVyKCkpIHtcbiAgICAgICAgcGFyc2VHbGIoZGF0YSwgY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtcbiAgICAgICAgICAgIGdsdGZDaHVuazogZGF0YSxcbiAgICAgICAgICAgIGJpbmFyeUNodW5rOiBudWxsXG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbi8vIGNyZWF0ZSBidWZmZXIgdmlld3NcbmNvbnN0IGNyZWF0ZUJ1ZmZlclZpZXdzID0gKGdsdGYsIGJ1ZmZlcnMsIG9wdGlvbnMpID0+IHtcblxuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgY29uc3QgcHJlcHJvY2VzcyA9IG9wdGlvbnM/LmJ1ZmZlclZpZXc/LnByZXByb2Nlc3M7XG4gICAgY29uc3QgcHJvY2Vzc0FzeW5jID0gb3B0aW9ucz8uYnVmZmVyVmlldz8ucHJvY2Vzc0FzeW5jO1xuICAgIGNvbnN0IHBvc3Rwcm9jZXNzID0gb3B0aW9ucz8uYnVmZmVyVmlldz8ucG9zdHByb2Nlc3M7XG5cbiAgICAvLyBoYW5kbGUgY2FzZSBvZiBubyBidWZmZXJzXG4gICAgaWYgKCFnbHRmLmJ1ZmZlclZpZXdzPy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGdsdGYuYnVmZmVyVmlld3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgZ2x0ZkJ1ZmZlclZpZXcgPSBnbHRmLmJ1ZmZlclZpZXdzW2ldO1xuXG4gICAgICAgIGlmIChwcmVwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcmVwcm9jZXNzKGdsdGZCdWZmZXJWaWV3KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBwcm9taXNlO1xuXG4gICAgICAgIGlmIChwcm9jZXNzQXN5bmMpIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzc0FzeW5jKGdsdGZCdWZmZXJWaWV3LCBidWZmZXJzLCAoZXJyLCByZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUobnVsbCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb21pc2UgPSBwcm9taXNlLnRoZW4oKGJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNvbnZlcnQgYnVmZmVyIHRvIHR5cGVkIGFycmF5XG4gICAgICAgICAgICByZXR1cm4gYnVmZmVyc1tnbHRmQnVmZmVyVmlldy5idWZmZXJdLnRoZW4oKGJ1ZmZlcikgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIuYnVmZmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidWZmZXIuYnl0ZU9mZnNldCArIChnbHRmQnVmZmVyVmlldy5ieXRlT2Zmc2V0IHx8IDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbHRmQnVmZmVyVmlldy5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBhZGQgYSAnYnl0ZVN0cmlkZScgbWVtYmVyIHRvIHRoZSB0eXBlZCBhcnJheSBzbyB3ZSBoYXZlIGVhc3kgYWNjZXNzIHRvIGl0IGxhdGVyXG4gICAgICAgIGlmIChnbHRmQnVmZmVyVmlldy5oYXNPd25Qcm9wZXJ0eSgnYnl0ZVN0cmlkZScpKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKCh0eXBlZEFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgdHlwZWRBcnJheS5ieXRlU3RyaWRlID0gZ2x0ZkJ1ZmZlclZpZXcuYnl0ZVN0cmlkZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHlwZWRBcnJheTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBvc3Rwcm9jZXNzKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKCh0eXBlZEFycmF5KSA9PiB7XG4gICAgICAgICAgICAgICAgcG9zdHByb2Nlc3MoZ2x0ZkJ1ZmZlclZpZXcsIHR5cGVkQXJyYXkpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0eXBlZEFycmF5O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXN1bHQucHVzaChwcm9taXNlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuY2xhc3MgR2xiUGFyc2VyIHtcbiAgICAvLyBwYXJzZSB0aGUgZ2x0ZiBvciBnbGIgZGF0YSBhc3luY2hyb25vdXNseSwgbG9hZGluZyBleHRlcm5hbCByZXNvdXJjZXNcbiAgICBzdGF0aWMgcGFyc2UoZmlsZW5hbWUsIHVybEJhc2UsIGRhdGEsIGRldmljZSwgcmVnaXN0cnksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIC8vIHBhcnNlIHRoZSBkYXRhXG4gICAgICAgIHBhcnNlQ2h1bmsoZmlsZW5hbWUsIGRhdGEsIChlcnIsIGNodW5rcykgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBwYXJzZSBnbHRmXG4gICAgICAgICAgICBwYXJzZUdsdGYoY2h1bmtzLmdsdGZDaHVuaywgKGVyciwgZ2x0ZikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlcnMgPSBsb2FkQnVmZmVycyhnbHRmLCBjaHVua3MuYmluYXJ5Q2h1bmssIHVybEJhc2UsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJ1ZmZlclZpZXdzID0gY3JlYXRlQnVmZmVyVmlld3MoZ2x0ZiwgYnVmZmVycywgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgY29uc3QgaW1hZ2VzID0gY3JlYXRlSW1hZ2VzKGdsdGYsIGJ1ZmZlclZpZXdzLCB1cmxCYXNlLCByZWdpc3RyeSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgY29uc3QgdGV4dHVyZXMgPSBjcmVhdGVUZXh0dXJlcyhnbHRmLCBpbWFnZXMsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgY3JlYXRlUmVzb3VyY2VzKGRldmljZSwgZ2x0ZiwgYnVmZmVyVmlld3MsIHRleHR1cmVzLCBvcHRpb25zKVxuICAgICAgICAgICAgICAgICAgICAudGhlbihyZXN1bHQgPT4gY2FsbGJhY2sobnVsbCwgcmVzdWx0KSlcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKGVyciA9PiBjYWxsYmFjayhlcnIpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBzdGF0aWMgY3JlYXRlRGVmYXVsdE1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gY3JlYXRlTWF0ZXJpYWwoe1xuICAgICAgICAgICAgbmFtZTogJ2RlZmF1bHRHbGJNYXRlcmlhbCdcbiAgICAgICAgfSwgW10pO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgR2xiUGFyc2VyIH07XG4iXSwibmFtZXMiOlsiR2xiUmVzb3VyY2VzIiwiY29uc3RydWN0b3IiLCJnbHRmIiwibm9kZXMiLCJzY2VuZXMiLCJhbmltYXRpb25zIiwidGV4dHVyZXMiLCJtYXRlcmlhbHMiLCJ2YXJpYW50cyIsIm1lc2hWYXJpYW50cyIsIm1lc2hEZWZhdWx0TWF0ZXJpYWxzIiwicmVuZGVycyIsInNraW5zIiwibGlnaHRzIiwiY2FtZXJhcyIsImRlc3Ryb3kiLCJmb3JFYWNoIiwicmVuZGVyIiwibWVzaGVzIiwiaXNEYXRhVVJJIiwidXJpIiwidGVzdCIsImdldERhdGFVUklNaW1lVHlwZSIsInN1YnN0cmluZyIsImluZGV4T2YiLCJnZXROdW1Db21wb25lbnRzIiwiYWNjZXNzb3JUeXBlIiwiZ2V0Q29tcG9uZW50VHlwZSIsImNvbXBvbmVudFR5cGUiLCJUWVBFX0lOVDgiLCJUWVBFX1VJTlQ4IiwiVFlQRV9JTlQxNiIsIlRZUEVfVUlOVDE2IiwiVFlQRV9JTlQzMiIsIlRZUEVfVUlOVDMyIiwiVFlQRV9GTE9BVDMyIiwiZ2V0Q29tcG9uZW50U2l6ZUluQnl0ZXMiLCJnZXRDb21wb25lbnREYXRhVHlwZSIsIkludDhBcnJheSIsIlVpbnQ4QXJyYXkiLCJJbnQxNkFycmF5IiwiVWludDE2QXJyYXkiLCJJbnQzMkFycmF5IiwiVWludDMyQXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJnbHRmVG9FbmdpbmVTZW1hbnRpY01hcCIsIlNFTUFOVElDX1BPU0lUSU9OIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEFOR0VOVCIsIlNFTUFOVElDX0NPTE9SIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJTRU1BTlRJQ19URVhDT09SRDAiLCJTRU1BTlRJQ19URVhDT09SRDEiLCJTRU1BTlRJQ19URVhDT09SRDIiLCJTRU1BTlRJQ19URVhDT09SRDMiLCJTRU1BTlRJQ19URVhDT09SRDQiLCJTRU1BTlRJQ19URVhDT09SRDUiLCJTRU1BTlRJQ19URVhDT09SRDYiLCJTRU1BTlRJQ19URVhDT09SRDciLCJhdHRyaWJ1dGVPcmRlciIsImdldERlcXVhbnRpemVGdW5jIiwic3JjVHlwZSIsIngiLCJNYXRoIiwibWF4IiwiZGVxdWFudGl6ZUFycmF5IiwiZHN0QXJyYXkiLCJzcmNBcnJheSIsImNvbnZGdW5jIiwibGVuIiwibGVuZ3RoIiwiaSIsImdldEFjY2Vzc29yRGF0YSIsImdsdGZBY2Nlc3NvciIsImJ1ZmZlclZpZXdzIiwiZmxhdHRlbiIsIm51bUNvbXBvbmVudHMiLCJ0eXBlIiwiZGF0YVR5cGUiLCJyZXN1bHQiLCJzcGFyc2UiLCJpbmRpY2VzQWNjZXNzb3IiLCJjb3VudCIsImluZGljZXMiLCJPYmplY3QiLCJhc3NpZ24iLCJ2YWx1ZXNBY2Nlc3NvciIsInZhbHVlcyIsImhhc093blByb3BlcnR5IiwiYmFzZUFjY2Vzc29yIiwiYnVmZmVyVmlldyIsImJ5dGVPZmZzZXQiLCJzbGljZSIsInRhcmdldEluZGV4IiwiaiIsImJ5dGVzUGVyRWxlbWVudCIsIkJZVEVTX1BFUl9FTEVNRU5UIiwic3RvcmFnZSIsIkFycmF5QnVmZmVyIiwidG1wQXJyYXkiLCJkc3RPZmZzZXQiLCJzcmNPZmZzZXQiLCJieXRlU3RyaWRlIiwiYiIsImJ1ZmZlciIsImdldEFjY2Vzc29yRGF0YUZsb2F0MzIiLCJkYXRhIiwibm9ybWFsaXplZCIsImZsb2F0MzJEYXRhIiwiZ2V0QWNjZXNzb3JCb3VuZGluZ0JveCIsIm1pbiIsImN0eXBlIiwiQm91bmRpbmdCb3giLCJWZWMzIiwiZ2V0UHJpbWl0aXZlVHlwZSIsInByaW1pdGl2ZSIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJtb2RlIiwiUFJJTUlUSVZFX1BPSU5UUyIsIlBSSU1JVElWRV9MSU5FUyIsIlBSSU1JVElWRV9MSU5FTE9PUCIsIlBSSU1JVElWRV9MSU5FU1RSSVAiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiZ2VuZXJhdGVJbmRpY2VzIiwibnVtVmVydGljZXMiLCJkdW1teUluZGljZXMiLCJnZW5lcmF0ZU5vcm1hbHMiLCJzb3VyY2VEZXNjIiwicCIsImNvbXBvbmVudHMiLCJwb3NpdGlvbnMiLCJzaXplIiwic3RyaWRlIiwic3JjU3RyaWRlIiwidHlwZWRBcnJheVR5cGVzQnl0ZVNpemUiLCJzcmMiLCJ0eXBlZEFycmF5VHlwZXMiLCJvZmZzZXQiLCJub3JtYWxzVGVtcCIsImNhbGN1bGF0ZU5vcm1hbHMiLCJub3JtYWxzIiwic2V0IiwiZmxpcFRleENvb3JkVnMiLCJ2ZXJ0ZXhCdWZmZXIiLCJmbG9hdE9mZnNldHMiLCJzaG9ydE9mZnNldHMiLCJieXRlT2Zmc2V0cyIsImZvcm1hdCIsImVsZW1lbnRzIiwiZWxlbWVudCIsIm5hbWUiLCJwdXNoIiwiZmxpcCIsIm9mZnNldHMiLCJvbmUiLCJ0eXBlZEFycmF5IiwiaW5kZXgiLCJjbG9uZVRleHR1cmUiLCJ0ZXh0dXJlIiwic2hhbGxvd0NvcHlMZXZlbHMiLCJtaXAiLCJfbGV2ZWxzIiwibGV2ZWwiLCJjdWJlbWFwIiwiZmFjZSIsIlRleHR1cmUiLCJkZXZpY2UiLCJjbG9uZVRleHR1cmVBc3NldCIsIkFzc2V0IiwiZmlsZSIsIm9wdGlvbnMiLCJsb2FkZWQiLCJyZXNvdXJjZSIsInJlZ2lzdHJ5IiwiYWRkIiwiY3JlYXRlVmVydGV4QnVmZmVySW50ZXJuYWwiLCJmbGlwViIsInBvc2l0aW9uRGVzYyIsInZlcnRleERlc2MiLCJzZW1hbnRpYyIsIm5vcm1hbGl6ZSIsInNvcnQiLCJsaHMiLCJyaHMiLCJrIiwic291cmNlIiwidGFyZ2V0Iiwic291cmNlT2Zmc2V0IiwidmVydGV4Rm9ybWF0IiwiVmVydGV4Rm9ybWF0IiwiaXNDb3JyZWN0bHlJbnRlcmxlYXZlZCIsIlZlcnRleEJ1ZmZlciIsIkJVRkZFUl9TVEFUSUMiLCJ2ZXJ0ZXhEYXRhIiwibG9jayIsInRhcmdldEFycmF5Iiwic291cmNlQXJyYXkiLCJ0YXJnZXRTdHJpZGUiLCJzb3VyY2VTdHJpZGUiLCJkc3QiLCJrZW5kIiwiZmxvb3IiLCJ1bmxvY2siLCJjcmVhdGVWZXJ0ZXhCdWZmZXIiLCJhdHRyaWJ1dGVzIiwiYWNjZXNzb3JzIiwidmVydGV4QnVmZmVyRGljdCIsInVzZUF0dHJpYnV0ZXMiLCJhdHRyaWJJZHMiLCJhdHRyaWIiLCJ2YktleSIsImpvaW4iLCJ2YiIsImFjY2Vzc29yIiwiYWNjZXNzb3JEYXRhIiwiY3JlYXRlU2tpbiIsImdsdGZTa2luIiwiZ2xiU2tpbnMiLCJiaW5kTWF0cml4Iiwiam9pbnRzIiwibnVtSm9pbnRzIiwiaWJwIiwiaW52ZXJzZUJpbmRNYXRyaWNlcyIsImlibURhdGEiLCJpYm1WYWx1ZXMiLCJNYXQ0IiwiYm9uZU5hbWVzIiwia2V5Iiwic2tpbiIsImdldCIsIlNraW4iLCJjcmVhdGVEcmFjb01lc2giLCJwcm9taXNlcyIsIl9wcmltaXRpdmUkYXR0cmlidXRlcyIsIl9wcmltaXRpdmUkZXh0ZW5zaW9ucyIsIk1lc2giLCJhYWJiIiwiUE9TSVRJT04iLCJlbnRyaWVzIiwiX2FjY2Vzc29yJG5vcm1hbGl6ZWQiLCJOT1JNQUwiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsImRyYWNvRXh0IiwiZXh0ZW5zaW9ucyIsIktIUl9kcmFjb19tZXNoX2NvbXByZXNzaW9uIiwiZHJhY29EZWNvZGUiLCJlcnIiLCJkZWNvbXByZXNzZWREYXRhIiwiY29uc29sZSIsImxvZyIsIm9yZGVyIiwiYSIsInZlcnRpY2VzIiwiYnl0ZUxlbmd0aCIsImluZGV4Rm9ybWF0IiwiSU5ERVhGT1JNQVRfVUlOVDE2IiwiSU5ERVhGT1JNQVRfVUlOVDMyIiwibnVtSW5kaWNlcyIsIkRlYnVnIiwiY2FsbCIsIndhcm4iLCJpbmRleEJ1ZmZlciIsIkluZGV4QnVmZmVyIiwiYmFzZSIsImluZGV4ZWQiLCJLSFJfbWF0ZXJpYWxzX3ZhcmlhbnRzIiwidGVtcE1hcHBpbmciLCJtYXBwaW5ncyIsIm1hcHBpbmciLCJ2YXJpYW50IiwibWF0ZXJpYWwiLCJpZCIsImNyZWF0ZU1lc2giLCJnbHRmTWVzaCIsImFzc2V0T3B0aW9ucyIsInByaW1pdGl2ZXMiLCJfcHJpbWl0aXZlJGV4dGVuc2lvbnMyIiwicHJpbWl0aXZlVHlwZSIsIm1lc2giLCJJTkRFWEZPUk1BVF9VSU5UOCIsImV4dFVpbnRFbGVtZW50IiwiaXNXZWJHUFUiLCJ0YXJnZXRzIiwiZGVsdGFQb3NpdGlvbnMiLCJkZWx0YVBvc2l0aW9uc1R5cGUiLCJkZWx0YU5vcm1hbHMiLCJkZWx0YU5vcm1hbHNUeXBlIiwiZXh0cmFzIiwidGFyZ2V0TmFtZXMiLCJ0b1N0cmluZyIsImRlZmF1bHRXZWlnaHQiLCJ3ZWlnaHRzIiwicHJlc2VydmVEYXRhIiwibW9ycGhQcmVzZXJ2ZURhdGEiLCJNb3JwaFRhcmdldCIsIm1vcnBoIiwiTW9ycGgiLCJwcmVmZXJIaWdoUHJlY2lzaW9uIiwibW9ycGhQcmVmZXJIaWdoUHJlY2lzaW9uIiwiZXh0cmFjdFRleHR1cmVUcmFuc2Zvcm0iLCJtYXBzIiwiX3NvdXJjZSRleHRlbnNpb25zIiwibWFwIiwidGV4Q29vcmQiLCJ6ZXJvcyIsIm9uZXMiLCJ0ZXh0dXJlVHJhbnNmb3JtIiwiS0hSX3RleHR1cmVfdHJhbnNmb3JtIiwic2NhbGUiLCJyb3RhdGlvbiIsIm1hdGgiLCJSQURfVE9fREVHIiwidGlsaW5nVmVjIiwiVmVjMiIsIm9mZnNldFZlYyIsImV4dGVuc2lvblBiclNwZWNHbG9zc2luZXNzIiwiY29sb3IiLCJkaWZmdXNlRmFjdG9yIiwiZGlmZnVzZSIsInBvdyIsIm9wYWNpdHkiLCJkaWZmdXNlVGV4dHVyZSIsImRpZmZ1c2VNYXAiLCJkaWZmdXNlTWFwQ2hhbm5lbCIsIm9wYWNpdHlNYXAiLCJvcGFjaXR5TWFwQ2hhbm5lbCIsInVzZU1ldGFsbmVzcyIsInNwZWN1bGFyRmFjdG9yIiwic3BlY3VsYXIiLCJnbG9zcyIsImdsb3NzaW5lc3NGYWN0b3IiLCJzcGVjdWxhckdsb3NzaW5lc3NUZXh0dXJlIiwic3BlY3VsYXJFbmNvZGluZyIsInNwZWN1bGFyTWFwIiwiZ2xvc3NNYXAiLCJzcGVjdWxhck1hcENoYW5uZWwiLCJnbG9zc01hcENoYW5uZWwiLCJleHRlbnNpb25DbGVhckNvYXQiLCJjbGVhckNvYXQiLCJjbGVhcmNvYXRGYWN0b3IiLCJjbGVhcmNvYXRUZXh0dXJlIiwiY2xlYXJDb2F0TWFwIiwiY2xlYXJDb2F0TWFwQ2hhbm5lbCIsImNsZWFyQ29hdEdsb3NzIiwiY2xlYXJjb2F0Um91Z2huZXNzRmFjdG9yIiwiY2xlYXJjb2F0Um91Z2huZXNzVGV4dHVyZSIsImNsZWFyQ29hdEdsb3NzTWFwIiwiY2xlYXJDb2F0R2xvc3NNYXBDaGFubmVsIiwiY2xlYXJjb2F0Tm9ybWFsVGV4dHVyZSIsImNsZWFyQ29hdE5vcm1hbE1hcCIsImNsZWFyQ29hdEJ1bXBpbmVzcyIsImNsZWFyQ29hdEdsb3NzSW52ZXJ0IiwiZXh0ZW5zaW9uVW5saXQiLCJ1c2VMaWdodGluZyIsImVtaXNzaXZlIiwiY29weSIsImVtaXNzaXZlVGludCIsImRpZmZ1c2VUaW50IiwiZW1pc3NpdmVNYXAiLCJlbWlzc2l2ZU1hcFV2IiwiZGlmZnVzZU1hcFV2IiwiZW1pc3NpdmVNYXBUaWxpbmciLCJkaWZmdXNlTWFwVGlsaW5nIiwiZW1pc3NpdmVNYXBPZmZzZXQiLCJkaWZmdXNlTWFwT2Zmc2V0IiwiZW1pc3NpdmVNYXBSb3RhdGlvbiIsImRpZmZ1c2VNYXBSb3RhdGlvbiIsImVtaXNzaXZlTWFwQ2hhbm5lbCIsImVtaXNzaXZlVmVydGV4Q29sb3IiLCJkaWZmdXNlVmVydGV4Q29sb3IiLCJlbWlzc2l2ZVZlcnRleENvbG9yQ2hhbm5lbCIsImRpZmZ1c2VWZXJ0ZXhDb2xvckNoYW5uZWwiLCJ1c2VTa3lib3giLCJleHRlbnNpb25TcGVjdWxhciIsInVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IiLCJzcGVjdWxhckNvbG9yVGV4dHVyZSIsInNwZWN1bGFyQ29sb3JGYWN0b3IiLCJzcGVjdWxhcml0eUZhY3RvciIsInNwZWN1bGFyaXR5RmFjdG9yTWFwQ2hhbm5lbCIsInNwZWN1bGFyaXR5RmFjdG9yTWFwIiwic3BlY3VsYXJUZXh0dXJlIiwiZXh0ZW5zaW9uSW9yIiwicmVmcmFjdGlvbkluZGV4IiwiaW9yIiwiZXh0ZW5zaW9uVHJhbnNtaXNzaW9uIiwiYmxlbmRUeXBlIiwiQkxFTkRfTk9STUFMIiwidXNlRHluYW1pY1JlZnJhY3Rpb24iLCJyZWZyYWN0aW9uIiwidHJhbnNtaXNzaW9uRmFjdG9yIiwicmVmcmFjdGlvbk1hcENoYW5uZWwiLCJyZWZyYWN0aW9uTWFwIiwidHJhbnNtaXNzaW9uVGV4dHVyZSIsImV4dGVuc2lvblNoZWVuIiwidXNlU2hlZW4iLCJzaGVlbkNvbG9yRmFjdG9yIiwic2hlZW4iLCJzaGVlbk1hcCIsInNoZWVuQ29sb3JUZXh0dXJlIiwic2hlZW5FbmNvZGluZyIsInNoZWVuR2xvc3MiLCJzaGVlblJvdWdobmVzc0ZhY3RvciIsInNoZWVuR2xvc3NNYXAiLCJzaGVlblJvdWdobmVzc1RleHR1cmUiLCJzaGVlbkdsb3NzTWFwQ2hhbm5lbCIsInNoZWVuR2xvc3NJbnZlcnQiLCJleHRlbnNpb25Wb2x1bWUiLCJ0aGlja25lc3MiLCJ0aGlja25lc3NGYWN0b3IiLCJ0aGlja25lc3NNYXAiLCJ0aGlja25lc3NUZXh0dXJlIiwidGhpY2tuZXNzTWFwQ2hhbm5lbCIsImF0dGVudWF0aW9uRGlzdGFuY2UiLCJhdHRlbnVhdGlvbkNvbG9yIiwiYXR0ZW51YXRpb24iLCJleHRlbnNpb25FbWlzc2l2ZVN0cmVuZ3RoIiwiZW1pc3NpdmVJbnRlbnNpdHkiLCJlbWlzc2l2ZVN0cmVuZ3RoIiwiZXh0ZW5zaW9uSXJpZGVzY2VuY2UiLCJ1c2VJcmlkZXNjZW5jZSIsImlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2VGYWN0b3IiLCJpcmlkZXNjZW5jZU1hcENoYW5uZWwiLCJpcmlkZXNjZW5jZU1hcCIsImlyaWRlc2NlbmNlVGV4dHVyZSIsImlyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4IiwiaXJpZGVzY2VuY2VJb3IiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01pbiIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWluaW11bSIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4IiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXhpbXVtIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXBDaGFubmVsIiwiaXJpZGVzY2VuY2VUaGlja25lc3NNYXAiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc1RleHR1cmUiLCJjcmVhdGVNYXRlcmlhbCIsImdsdGZNYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJvY2NsdWRlU3BlY3VsYXIiLCJTUEVDT0NDX0FPIiwic3BlY3VsYXJUaW50Iiwic3BlY3VsYXJWZXJ0ZXhDb2xvciIsInBickRhdGEiLCJwYnJNZXRhbGxpY1JvdWdobmVzcyIsImJhc2VDb2xvckZhY3RvciIsImJhc2VDb2xvclRleHR1cmUiLCJtZXRhbG5lc3MiLCJtZXRhbGxpY0ZhY3RvciIsInJvdWdobmVzc0ZhY3RvciIsImdsb3NzSW52ZXJ0IiwibWV0YWxsaWNSb3VnaG5lc3NUZXh0dXJlIiwibWV0YWxuZXNzTWFwIiwibWV0YWxuZXNzTWFwQ2hhbm5lbCIsIm5vcm1hbFRleHR1cmUiLCJub3JtYWxNYXAiLCJidW1waW5lc3MiLCJvY2NsdXNpb25UZXh0dXJlIiwiYW9NYXAiLCJhb01hcENoYW5uZWwiLCJlbWlzc2l2ZUZhY3RvciIsImVtaXNzaXZlVGV4dHVyZSIsImFscGhhTW9kZSIsIkJMRU5EX05PTkUiLCJhbHBoYVRlc3QiLCJhbHBoYUN1dG9mZiIsImRlcHRoV3JpdGUiLCJ0d29TaWRlZExpZ2h0aW5nIiwiZG91YmxlU2lkZWQiLCJjdWxsIiwiQ1VMTEZBQ0VfTk9ORSIsIkNVTExGQUNFX0JBQ0siLCJleHRlbnNpb25GdW5jIiwidW5kZWZpbmVkIiwidXBkYXRlIiwiY3JlYXRlQW5pbWF0aW9uIiwiZ2x0ZkFuaW1hdGlvbiIsImFuaW1hdGlvbkluZGV4IiwiZ2x0ZkFjY2Vzc29ycyIsImdsdGZOb2RlcyIsImNyZWF0ZUFuaW1EYXRhIiwiQW5pbURhdGEiLCJpbnRlcnBNYXAiLCJJTlRFUlBPTEFUSU9OX1NURVAiLCJJTlRFUlBPTEFUSU9OX0xJTkVBUiIsIklOVEVSUE9MQVRJT05fQ1VCSUMiLCJpbnB1dE1hcCIsIm91dHB1dE1hcCIsImN1cnZlTWFwIiwib3V0cHV0Q291bnRlciIsInNhbXBsZXJzIiwic2FtcGxlciIsImlucHV0Iiwib3V0cHV0IiwiaW50ZXJwb2xhdGlvbiIsImN1cnZlIiwicGF0aHMiLCJxdWF0QXJyYXlzIiwidHJhbnNmb3JtU2NoZW1hIiwiY29uc3RydWN0Tm9kZVBhdGgiLCJub2RlIiwicGF0aCIsInVuc2hpZnQiLCJwYXJlbnQiLCJjcmVhdGVNb3JwaFRhcmdldEN1cnZlcyIsImdsdGZOb2RlIiwiZW50aXR5UGF0aCIsIm91dCIsIm91dERhdGEiLCJtb3JwaFRhcmdldENvdW50Iiwia2V5ZnJhbWVDb3VudCIsInNpbmdsZUJ1ZmZlclNpemUiLCJfdGFyZ2V0TmFtZXMiLCJtb3JwaFRhcmdldE91dHB1dCIsIndlaWdodE5hbWUiLCJtb3JwaEN1cnZlIiwiY29tcG9uZW50IiwicHJvcGVydHlQYXRoIiwiY2hhbm5lbHMiLCJjaGFubmVsIiwic3RhcnRzV2l0aCIsImlucHV0cyIsIm91dHB1dHMiLCJjdXJ2ZXMiLCJpbnB1dEtleSIsIm91dHB1dEtleSIsImN1cnZlS2V5IiwiY3VydmVEYXRhIiwiQW5pbUN1cnZlIiwicHJldkluZGV4IiwiZCIsImRwIiwiZHVyYXRpb24iLCJfZGF0YSIsIkFuaW1UcmFjayIsInRlbXBNYXQiLCJ0ZW1wVmVjIiwiY3JlYXRlTm9kZSIsIm5vZGVJbmRleCIsImVudGl0eSIsIkdyYXBoTm9kZSIsIm1hdHJpeCIsImdldFRyYW5zbGF0aW9uIiwic2V0TG9jYWxQb3NpdGlvbiIsImdldEV1bGVyQW5nbGVzIiwic2V0TG9jYWxFdWxlckFuZ2xlcyIsImdldFNjYWxlIiwic2V0TG9jYWxTY2FsZSIsInIiLCJzZXRMb2NhbFJvdGF0aW9uIiwidCIsInRyYW5zbGF0aW9uIiwicyIsImNyZWF0ZUNhbWVyYSIsImdsdGZDYW1lcmEiLCJwcm9qZWN0aW9uIiwiUFJPSkVDVElPTl9PUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiZ2x0ZlByb3BlcnRpZXMiLCJvcnRob2dyYXBoaWMiLCJwZXJzcGVjdGl2ZSIsImNvbXBvbmVudERhdGEiLCJlbmFibGVkIiwibmVhckNsaXAiLCJ6bmVhciIsImFzcGVjdFJhdGlvTW9kZSIsIkFTUEVDVF9BVVRPIiwiemZhciIsImZhckNsaXAiLCJvcnRob0hlaWdodCIsInltYWciLCJBU1BFQ1RfTUFOVUFMIiwiYXNwZWN0UmF0aW8iLCJ4bWFnIiwiZm92IiwieWZvdiIsImNhbWVyYUVudGl0eSIsIkVudGl0eSIsImFkZENvbXBvbmVudCIsImNyZWF0ZUxpZ2h0IiwiZ2x0ZkxpZ2h0IiwibGlnaHRQcm9wcyIsIkNvbG9yIiwiV0hJVEUiLCJyYW5nZSIsImZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0lOVkVSU0VTUVVBUkVEIiwiaW50ZW5zaXR5IiwiY2xhbXAiLCJpbm5lckNvbmVBbmdsZSIsInNwb3QiLCJvdXRlckNvbmVBbmdsZSIsIlBJIiwibHVtaW5hbmNlIiwiTGlnaHQiLCJnZXRMaWdodFVuaXRDb252ZXJzaW9uIiwibGlnaHRUeXBlcyIsImxpZ2h0RW50aXR5Iiwicm90YXRlTG9jYWwiLCJjcmVhdGVTa2lucyIsIk1hcCIsImNyZWF0ZU1lc2hlcyIsIl9nbHRmJG1lc2hlcyIsIl9nbHRmJGFjY2Vzc29ycyIsIl9nbHRmJGJ1ZmZlclZpZXdzIiwidmFsaWQiLCJza2lwTWVzaGVzIiwiY3JlYXRlTWF0ZXJpYWxzIiwiX29wdGlvbnMkbWF0ZXJpYWwiLCJfb3B0aW9ucyRtYXRlcmlhbCRwcm8iLCJfb3B0aW9ucyRtYXRlcmlhbDIiLCJfb3B0aW9ucyRtYXRlcmlhbDMiLCJwcmVwcm9jZXNzIiwicHJvY2VzcyIsInBvc3Rwcm9jZXNzIiwiY3JlYXRlVmFyaWFudHMiLCJjcmVhdGVBbmltYXRpb25zIiwiX29wdGlvbnMkYW5pbWF0aW9uIiwiX29wdGlvbnMkYW5pbWF0aW9uMiIsImFuaW1hdGlvbiIsImNyZWF0ZU5vZGVzIiwiX29wdGlvbnMkbm9kZSIsIl9vcHRpb25zJG5vZGUkcHJvY2VzcyIsIl9vcHRpb25zJG5vZGUyIiwiX29wdGlvbnMkbm9kZTMiLCJ1bmlxdWVOYW1lcyIsImNoaWxkcmVuIiwiY2hpbGQiLCJhZGRDaGlsZCIsImNyZWF0ZVNjZW5lcyIsIl9nbHRmJHNjZW5lcyQwJG5vZGVzIiwic2NlbmUiLCJzY2VuZVJvb3QiLCJuIiwiY2hpbGROb2RlIiwiY3JlYXRlQ2FtZXJhcyIsIl9vcHRpb25zJGNhbWVyYSIsIl9vcHRpb25zJGNhbWVyYSRwcm9jZSIsIl9vcHRpb25zJGNhbWVyYTIiLCJfb3B0aW9ucyRjYW1lcmEzIiwiY2FtZXJhIiwiY3JlYXRlTGlnaHRzIiwiS0hSX2xpZ2h0c19wdW5jdHVhbCIsImdsdGZMaWdodHMiLCJfb3B0aW9ucyRsaWdodCIsIl9vcHRpb25zJGxpZ2h0JHByb2NlcyIsIl9vcHRpb25zJGxpZ2h0MiIsIl9vcHRpb25zJGxpZ2h0MyIsImxpZ2h0IiwibGlnaHRJbmRleCIsImxpbmtTa2lucyIsIm1lc2hHcm91cCIsImNyZWF0ZVJlc291cmNlcyIsIl9vcHRpb25zJGdsb2JhbCIsIl9vcHRpb25zJGdsb2JhbDIiLCJnbG9iYWwiLCJhc3NldCIsImdlbmVyYXRvciIsImJ1ZmZlclZpZXdEYXRhIiwiYWxsIiwidGV4dHVyZUFzc2V0cyIsInRleHR1cmVJbnN0YW5jZXMiLCJSZW5kZXIiLCJhcHBseVNhbXBsZXIiLCJnbHRmU2FtcGxlciIsImdldEZpbHRlciIsImZpbHRlciIsImRlZmF1bHRWYWx1ZSIsIkZJTFRFUl9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUiIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJnZXRXcmFwIiwid3JhcCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiQUREUkVTU19SRVBFQVQiLCJfZ2x0ZlNhbXBsZXIiLCJtaW5GaWx0ZXIiLCJtYWdGaWx0ZXIiLCJhZGRyZXNzVSIsIndyYXBTIiwiYWRkcmVzc1YiLCJ3cmFwVCIsImdsdGZUZXh0dXJlVW5pcXVlSWQiLCJjcmVhdGVJbWFnZXMiLCJ1cmxCYXNlIiwiX29wdGlvbnMkaW1hZ2UiLCJfb3B0aW9ucyRpbWFnZTIiLCJfb3B0aW9ucyRpbWFnZTMiLCJpbWFnZXMiLCJpbWFnZSIsInByb2Nlc3NBc3luYyIsIm1pbWVUeXBlRmlsZUV4dGVuc2lvbnMiLCJsb2FkVGV4dHVyZSIsImdsdGZJbWFnZSIsInVybCIsIm1pbWVUeXBlIiwiY29udGludWF0aW9uIiwiY29udGVudHMiLCJleHRlbnNpb24iLCJmaWxlbmFtZSIsIm9uIiwibG9hZCIsInRoZW4iLCJwcm9taXNlIiwidGV4dHVyZUFzc2V0IiwiQUJTT0xVVEVfVVJMIiwiY3Jvc3NPcmlnaW4iLCJFcnJvciIsImNyZWF0ZVRleHR1cmVzIiwiX2dsdGYkaW1hZ2VzIiwiX2dsdGYkdGV4dHVyZXMiLCJfb3B0aW9ucyR0ZXh0dXJlIiwiX29wdGlvbnMkdGV4dHVyZTIiLCJfb3B0aW9ucyR0ZXh0dXJlMyIsInNlZW5JbWFnZXMiLCJTZXQiLCJnbHRmVGV4dHVyZSIsImdsdGZJbWFnZUluZGV4IiwiX3JlZiIsIl9yZWYyIiwiX2dsdGZJbWFnZUluZGV4IiwiX2dsdGZUZXh0dXJlJGV4dGVuc2lvIiwiX2dsdGZUZXh0dXJlJGV4dGVuc2lvMiIsIl9nbHRmVGV4dHVyZSRleHRlbnNpbzMiLCJfZ2x0ZlRleHR1cmUkZXh0ZW5zaW80IiwiS0hSX3RleHR1cmVfYmFzaXN1IiwiRVhUX3RleHR1cmVfd2VicCIsImNsb25lQXNzZXQiLCJoYXMiLCJpbWFnZUFzc2V0IiwiX2dsdGYkc2FtcGxlcnMiLCJsb2FkQnVmZmVycyIsImJpbmFyeUNodW5rIiwiX29wdGlvbnMkYnVmZmVyIiwiX29wdGlvbnMkYnVmZmVyMiIsIl9vcHRpb25zJGJ1ZmZlcjMiLCJidWZmZXJzIiwiZ2x0ZkJ1ZmZlciIsImFycmF5QnVmZmVyIiwiYnl0ZVN0cmluZyIsImF0b2IiLCJzcGxpdCIsImJpbmFyeUFycmF5IiwiY2hhckNvZGVBdCIsImh0dHAiLCJjYWNoZSIsInJlc3BvbnNlVHlwZSIsInJldHJ5IiwicGFyc2VHbHRmIiwiZ2x0ZkNodW5rIiwiY2FsbGJhY2siLCJkZWNvZGVCaW5hcnlVdGY4IiwiYXJyYXkiLCJUZXh0RGVjb2RlciIsImRlY29kZSIsInN0ciIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImRlY29kZVVSSUNvbXBvbmVudCIsImVzY2FwZSIsIkpTT04iLCJwYXJzZSIsInZlcnNpb24iLCJwYXJzZUZsb2F0IiwicGFyc2VHbGIiLCJnbGJEYXRhIiwiRGF0YVZpZXciLCJtYWdpYyIsImdldFVpbnQzMiIsImNodW5rcyIsImNodW5rTGVuZ3RoIiwiY2h1bmtUeXBlIiwiY2h1bmtEYXRhIiwicGFyc2VDaHVuayIsImhhc0dsYkhlYWRlciIsInU4IiwidG9Mb3dlckNhc2UiLCJlbmRzV2l0aCIsImNyZWF0ZUJ1ZmZlclZpZXdzIiwiX29wdGlvbnMkYnVmZmVyVmlldyIsIl9vcHRpb25zJGJ1ZmZlclZpZXcyIiwiX29wdGlvbnMkYnVmZmVyVmlldzMiLCJfZ2x0ZiRidWZmZXJWaWV3czIiLCJnbHRmQnVmZmVyVmlldyIsIkdsYlBhcnNlciIsImNhdGNoIiwiY3JlYXRlRGVmYXVsdE1hdGVyaWFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvREE7QUFDQSxNQUFNQSxZQUFZLENBQUM7RUFBQUMsV0FBQSxHQUFBO0FBQUEsSUFBQSxJQUFBLENBQ2ZDLElBQUksR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQUVKQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FFTEMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFB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
