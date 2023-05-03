import '../../core/tracing.js';
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
const dequantizeArray = (dstArray, srcArray, srcType) => {
	const convFunc = getDequantizeFunc(srcType);
	const len = srcArray.length;
	for (let i = 0; i < len; ++i) {
		dstArray[i] = convFunc(srcArray[i]);
	}
	return dstArray;
};
const getAccessorData = (gltfAccessor, bufferViews, flatten = false) => {
	const numComponents = getNumComponents(gltfAccessor.type);
	const dataType = getComponentDataType(gltfAccessor.componentType);
	if (!dataType) {
		return null;
	}
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
			type: gltfAccessor.type,
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
	} else {
		if (gltfAccessor.hasOwnProperty("bufferView")) {
			const bufferView = bufferViews[gltfAccessor.bufferView];
			if (flatten && bufferView.hasOwnProperty('byteStride')) {
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
		} else {
			result = new dataType(gltfAccessor.count * numComponents);
		}
	}
	return result;
};
const getAccessorDataFloat32 = (gltfAccessor, bufferViews) => {
	const data = getAccessorData(gltfAccessor, bufferViews, true);
	if (data instanceof Float32Array || !gltfAccessor.normalized) {
		return data;
	}
	const float32Data = new Float32Array(data.length);
	dequantizeArray(float32Data, data, getComponentType(gltfAccessor.componentType));
	return float32Data;
};
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
	const result = new Texture(texture.device, texture);
	result._levels = shallowCopyLevels(texture);
	return result;
};
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
	vertexDesc.sort((lhs, rhs) => {
		return attributeOrder[lhs.semantic] - attributeOrder[rhs.semantic];
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
const createVertexBuffer = (device, attributes, indices, accessors, bufferViews, flipV, vertexBufferDict) => {
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
		if (!sourceDesc.hasOwnProperty(SEMANTIC_NORMAL)) {
			generateNormals(sourceDesc, indices);
		}
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
	const key = boneNames.join('#');
	let skin = glbSkins.get(key);
	if (!skin) {
		skin = new Skin(device, ibp, boneNames);
		glbSkins.set(key, skin);
	}
	return skin;
};
const createDracoMesh = (device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises) => {
	var _primitive$attributes, _primitive$extensions;
	const result = new Mesh(device);
	result.aabb = getAccessorBoundingBox(accessors[primitive.attributes.POSITION]);
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
	if (!(primitive != null && (_primitive$attributes = primitive.attributes) != null && _primitive$attributes.NORMAL)) {
		vertexDesc.push({
			semantic: 'NORMAL',
			components: 3,
			type: TYPE_FLOAT32
		});
	}
	vertexDesc.sort((lhs, rhs) => {
		return attributeOrder[lhs.semantic] - attributeOrder[rhs.semantic];
	});
	const vertexFormat = new VertexFormat(device, vertexDesc);
	promises.push(new Promise((resolve, reject) => {
		const dracoExt = primitive.extensions.KHR_draco_mesh_compression;
		dracoDecode(bufferViews[dracoExt.bufferView].slice().buffer, (err, decompressedData) => {
			if (err) {
				console.log(err);
				reject(err);
			} else {
				const numVertices = decompressedData.vertices.byteLength / vertexFormat.size;
				const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, BUFFER_STATIC, decompressedData.vertices);
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
			meshes.push(createDracoMesh(device, primitive, accessors, bufferViews, meshVariants, meshDefaultMaterials, promises));
		} else {
			let indices = primitive.hasOwnProperty('indices') ? getAccessorData(accessors[primitive.indices], bufferViews, true) : null;
			const vertexBuffer = createVertexBuffer(device, primitive.attributes, indices, accessors, bufferViews, flipV, vertexBufferDict);
			const primitiveType = getPrimitiveType(primitive);
			const mesh = new Mesh(device);
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
					indexFormat = INDEXFORMAT_UINT16;
					indices = new Uint16Array(indices);
				}
				if (indexFormat === INDEXFORMAT_UINT8 && device.isWebGPU) {
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
const createAnimation = (gltfAnimation, animationIndex, gltfAccessors, bufferViews, nodes, meshes, gltfNodes) => {
	const createAnimData = gltfAccessor => {
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
	const createMorphTargetCurves = (curve, gltfNode, entityPath) => {
		const out = outputMap[curve.output];
		if (!out) {
			return;
		}
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
		const singleBufferSize = keyframeCount * 4;
		const buffer = new ArrayBuffer(singleBufferSize * morphTargetCount);
		for (let j = 0; j < morphTargetCount; j++) {
			var _targetNames;
			const morphTargetOutput = new Float32Array(buffer, singleBufferSize * j, keyframeCount);
			for (let k = 0; k < keyframeCount; k++) {
				morphTargetOutput[k] = outData[k * morphTargetCount + j];
			}
			const output = new AnimData(1, morphTargetOutput);
			const weightName = (_targetNames = targetNames) != null && _targetNames[j] ? `name.${targetNames[j]}` : j;
			outputMap[-outputCounter] = output;
			const morphCurve = {
				paths: [{
					entityPath: entityPath,
					component: 'graph',
					propertyPath: [`weight.${weightName}`]
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
		const gltfNode = gltfNodes[target.node];
		const entityPath = constructNodePath(node);
		if (target.path.startsWith('weights')) {
			createMorphTargetCurves(curve, gltfNode, entityPath);
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
const tempMat = new Mat4();
const tempVec = new Vec3();
const createNode = (gltfNode, nodeIndex) => {
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
const createLight = (gltfLight, node) => {
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
const createSkins = (device, gltf, nodes, bufferViews) => {
	if (!gltf.hasOwnProperty('skins') || gltf.skins.length === 0) {
		return [];
	}
	const glbSkins = new Map();
	return gltf.skins.map(gltfSkin => {
		return createSkin(device, gltfSkin, gltf.accessors, bufferViews, nodes, glbSkins);
	});
};
const createMeshes = (device, gltf, bufferViews, flipV, options) => {
	var _gltf$meshes, _gltf$accessors, _gltf$bufferViews;
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
const createResources = async (device, gltf, bufferViews, textures, options) => {
	var _options$global, _options$global2;
	const preprocess = options == null ? void 0 : (_options$global = options.global) == null ? void 0 : _options$global.preprocess;
	const postprocess = options == null ? void 0 : (_options$global2 = options.global) == null ? void 0 : _options$global2.postprocess;
	if (preprocess) {
		preprocess(gltf);
	}
	const flipV = gltf.asset && gltf.asset.generator === 'PlayCanvas';
	const nodes = createNodes(gltf, options);
	const scenes = createScenes(gltf, nodes);
	const lights = createLights(gltf, nodes, options);
	const cameras = createCameras(gltf, nodes, options);
	const variants = createVariants(gltf);
	const bufferViewData = await Promise.all(bufferViews);
	const {
		meshes,
		meshVariants,
		meshDefaultMaterials,
		promises
	} = createMeshes(device, gltf, bufferViewData, flipV, options);
	const animations = createAnimations(gltf, nodes, bufferViewData, options);
	const textureAssets = await Promise.all(textures);
	const textureInstances = textureAssets.map(t => t.resource);
	const materials = createMaterials(gltf, textureInstances, options, flipV);
	const skins = createSkins(device, gltf, nodes, bufferViewData);
	const renders = [];
	for (let i = 0; i < meshes.length; i++) {
		renders[i] = new Render();
		renders[i].meshes = meshes[i];
	}
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
				if (isDataURI(gltfImage.uri)) {
					return loadTexture(gltfImage, gltfImage.uri, null, getDataURIMimeType(gltfImage.uri), null);
				}
				return loadTexture(gltfImage, ABSOLUTE_URL.test(gltfImage.uri) ? gltfImage.uri : path.join(urlBase, gltfImage.uri), null, null, {
					crossOrigin: 'anonymous'
				});
			} else if (gltfImage.hasOwnProperty('bufferView') && gltfImage.hasOwnProperty('mimeType')) {
				return loadTexture(gltfImage, null, bufferViews[gltfImage.bufferView], gltfImage.mimeType, null);
			}
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
					const byteString = atob(gltfBuffer.uri.split(',')[1]);
					const binaryArray = new Uint8Array(byteString.length);
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
						if (err) reject(err);else resolve(new Uint8Array(result));
					});
				});
			}
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
	if (gltf.asset && gltf.asset.version && parseFloat(gltf.asset.version) < 2) {
		callback(`Invalid gltf version. Expected version 2.0 or above but found version '${gltf.asset.version}'.`);
		return;
	}
	callback(null, gltf);
};
const parseGlb = (glbData, callback) => {
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
const parseChunk = (filename, data, callback) => {
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
const createBufferViews = (gltf, buffers, options) => {
	var _options$bufferView, _options$bufferView2, _options$bufferView3, _gltf$bufferViews2;
	const result = [];
	const preprocess = options == null ? void 0 : (_options$bufferView = options.bufferView) == null ? void 0 : _options$bufferView.preprocess;
	const processAsync = options == null ? void 0 : (_options$bufferView2 = options.bufferView) == null ? void 0 : _options$bufferView2.processAsync;
	const postprocess = options == null ? void 0 : (_options$bufferView3 = options.bufferView) == null ? void 0 : _options$bufferView3.postprocess;
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
			return buffers[gltfBufferView.buffer].then(buffer => {
				return new Uint8Array(buffer.buffer, buffer.byteOffset + (gltfBufferView.byteOffset || 0), gltfBufferView.byteLength);
			});
		});
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
	static parse(filename, urlBase, data, device, registry, options, callback) {
		parseChunk(filename, data, (err, chunks) => {
			if (err) {
				callback(err);
				return;
			}
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
