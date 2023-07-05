import '../core/debug.js';
import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../core/math/vec3.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { SEMANTIC_POSITION, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, TYPE_UINT16, TYPE_INT16, TYPE_UINT8, TYPE_INT8, BUFFER_STATIC, BUFFER_DYNAMIC, TYPE_FLOAT32, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD, SEMANTIC_COLOR, PRIMITIVE_TRIANGLES, INDEXFORMAT_UINT32, INDEXFORMAT_UINT16, PRIMITIVE_POINTS, typedArrayIndexFormats, PRIMITIVE_LINES } from '../platform/graphics/constants.js';
import { IndexBuffer } from '../platform/graphics/index-buffer.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { VertexIterator } from '../platform/graphics/vertex-iterator.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { RENDERSTYLE_WIREFRAME, RENDERSTYLE_POINTS, RENDERSTYLE_SOLID } from './constants.js';

let id = 0;
class GeometryData {
	constructor() {
		this.initDefaults();
	}
	initDefaults() {
		this.recreate = false;
		this.verticesUsage = BUFFER_STATIC;
		this.indicesUsage = BUFFER_STATIC;
		this.maxVertices = 0;
		this.maxIndices = 0;
		this.vertexCount = 0;
		this.indexCount = 0;
		this.vertexStreamsUpdated = false;
		this.indexStreamUpdated = false;
		this.vertexStreamDictionary = {};
		this.indices = null;
	}
	_changeVertexCount(count, semantic) {
		if (!this.vertexCount) {
			this.vertexCount = count;
		}
	}
}
GeometryData.DEFAULT_COMPONENTS_POSITION = 3;
GeometryData.DEFAULT_COMPONENTS_NORMAL = 3;
GeometryData.DEFAULT_COMPONENTS_UV = 2;
GeometryData.DEFAULT_COMPONENTS_COLORS = 4;
class GeometryVertexStream {
	constructor(data, componentCount, dataType, dataTypeNormalize) {
		this.data = data;
		this.componentCount = componentCount;
		this.dataType = dataType;
		this.dataTypeNormalize = dataTypeNormalize;
	}
}
class Mesh extends RefCountedObject {
	constructor(graphicsDevice) {
		super();
		this.id = id++;
		this.device = graphicsDevice || GraphicsDeviceAccess.get();
		this.vertexBuffer = null;
		this.indexBuffer = [null];
		this.primitive = [{
			type: 0,
			base: 0,
			count: 0
		}];
		this.skin = null;
		this._morph = null;
		this._geometryData = null;
		this._aabb = new BoundingBox();
		this.boneAabb = null;
	}
	set morph(morph) {
		if (morph !== this._morph) {
			if (this._morph) {
				this._morph.decRefCount();
			}
			this._morph = morph;
			if (morph) {
				morph.incRefCount();
			}
		}
	}
	get morph() {
		return this._morph;
	}
	set aabb(aabb) {
		this._aabb = aabb;
	}
	get aabb() {
		return this._aabb;
	}
	destroy() {
		const morph = this.morph;
		if (morph) {
			this.morph = null;
			if (morph.refCount < 1) {
				morph.destroy();
			}
		}
		if (this.vertexBuffer) {
			this.vertexBuffer.destroy();
			this.vertexBuffer = null;
		}
		for (let j = 0; j < this.indexBuffer.length; j++) {
			this._destroyIndexBuffer(j);
		}
		this.indexBuffer.length = 0;
		this._geometryData = null;
	}
	_destroyIndexBuffer(index) {
		if (this.indexBuffer[index]) {
			this.indexBuffer[index].destroy();
			this.indexBuffer[index] = null;
		}
	}
	_initBoneAabbs(morphTargets) {
		this.boneAabb = [];
		this.boneUsed = [];
		let x, y, z;
		let bMax, bMin;
		const boneMin = [];
		const boneMax = [];
		const boneUsed = this.boneUsed;
		const numBones = this.skin.boneNames.length;
		let maxMorphX, maxMorphY, maxMorphZ;
		for (let i = 0; i < numBones; i++) {
			boneMin[i] = new Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
			boneMax[i] = new Vec3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
		}
		const iterator = new VertexIterator(this.vertexBuffer);
		const posElement = iterator.element[SEMANTIC_POSITION];
		const weightsElement = iterator.element[SEMANTIC_BLENDWEIGHT];
		const indicesElement = iterator.element[SEMANTIC_BLENDINDICES];
		const numVerts = this.vertexBuffer.numVertices;
		for (let j = 0; j < numVerts; j++) {
			for (let k = 0; k < 4; k++) {
				const boneWeight = weightsElement.array[weightsElement.index + k];
				if (boneWeight > 0) {
					const boneIndex = indicesElement.array[indicesElement.index + k];
					boneUsed[boneIndex] = true;
					x = posElement.array[posElement.index];
					y = posElement.array[posElement.index + 1];
					z = posElement.array[posElement.index + 2];
					bMax = boneMax[boneIndex];
					bMin = boneMin[boneIndex];
					if (bMin.x > x) bMin.x = x;
					if (bMin.y > y) bMin.y = y;
					if (bMin.z > z) bMin.z = z;
					if (bMax.x < x) bMax.x = x;
					if (bMax.y < y) bMax.y = y;
					if (bMax.z < z) bMax.z = z;
					if (morphTargets) {
						let minMorphX = maxMorphX = x;
						let minMorphY = maxMorphY = y;
						let minMorphZ = maxMorphZ = z;
						for (let l = 0; l < morphTargets.length; l++) {
							const target = morphTargets[l];
							const dx = target.deltaPositions[j * 3];
							const dy = target.deltaPositions[j * 3 + 1];
							const dz = target.deltaPositions[j * 3 + 2];
							if (dx < 0) {
								minMorphX += dx;
							} else {
								maxMorphX += dx;
							}
							if (dy < 0) {
								minMorphY += dy;
							} else {
								maxMorphY += dy;
							}
							if (dz < 0) {
								minMorphZ += dz;
							} else {
								maxMorphZ += dz;
							}
						}
						if (bMin.x > minMorphX) bMin.x = minMorphX;
						if (bMin.y > minMorphY) bMin.y = minMorphY;
						if (bMin.z > minMorphZ) bMin.z = minMorphZ;
						if (bMax.x < maxMorphX) bMax.x = maxMorphX;
						if (bMax.y < maxMorphY) bMax.y = maxMorphY;
						if (bMax.z < maxMorphZ) bMax.z = maxMorphZ;
					}
				}
			}
			iterator.next();
		}
		const positionElement = this.vertexBuffer.getFormat().elements.find(e => e.name === SEMANTIC_POSITION);
		if (positionElement && positionElement.normalize) {
			const func = (() => {
				switch (positionElement.dataType) {
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
			})();
			for (let i = 0; i < numBones; i++) {
				if (boneUsed[i]) {
					const min = boneMin[i];
					const max = boneMax[i];
					min.set(func(min.x), func(min.y), func(min.z));
					max.set(func(max.x), func(max.y), func(max.z));
				}
			}
		}
		for (let i = 0; i < numBones; i++) {
			const aabb = new BoundingBox();
			aabb.setMinMax(boneMin[i], boneMax[i]);
			this.boneAabb.push(aabb);
		}
	}
	_initGeometryData() {
		if (!this._geometryData) {
			this._geometryData = new GeometryData();
			if (this.vertexBuffer) {
				this._geometryData.vertexCount = this.vertexBuffer.numVertices;
				this._geometryData.maxVertices = this.vertexBuffer.numVertices;
			}
			if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
				this._geometryData.indexCount = this.indexBuffer[0].numIndices;
				this._geometryData.maxIndices = this.indexBuffer[0].numIndices;
			}
		}
	}
	clear(verticesDynamic, indicesDynamic, maxVertices = 0, maxIndices = 0) {
		this._initGeometryData();
		this._geometryData.initDefaults();
		this._geometryData.recreate = true;
		this._geometryData.maxVertices = maxVertices;
		this._geometryData.maxIndices = maxIndices;
		this._geometryData.verticesUsage = verticesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
		this._geometryData.indicesUsage = indicesDynamic ? BUFFER_STATIC : BUFFER_DYNAMIC;
	}
	setVertexStream(semantic, data, componentCount, numVertices, dataType = TYPE_FLOAT32, dataTypeNormalize = false) {
		this._initGeometryData();
		const vertexCount = numVertices || data.length / componentCount;
		this._geometryData._changeVertexCount(vertexCount, semantic);
		this._geometryData.vertexStreamsUpdated = true;
		this._geometryData.vertexStreamDictionary[semantic] = new GeometryVertexStream(data, componentCount, dataType, dataTypeNormalize);
	}
	getVertexStream(semantic, data) {
		let count = 0;
		let done = false;
		if (this._geometryData) {
			const stream = this._geometryData.vertexStreamDictionary[semantic];
			if (stream) {
				done = true;
				count = this._geometryData.vertexCount;
				if (ArrayBuffer.isView(data)) {
					data.set(stream.data);
				} else {
					data.length = 0;
					data.push(stream.data);
				}
			}
		}
		if (!done) {
			if (this.vertexBuffer) {
				const iterator = new VertexIterator(this.vertexBuffer);
				count = iterator.readData(semantic, data);
			}
		}
		return count;
	}
	setPositions(positions, componentCount = GeometryData.DEFAULT_COMPONENTS_POSITION, numVertices) {
		this.setVertexStream(SEMANTIC_POSITION, positions, componentCount, numVertices, TYPE_FLOAT32, false);
	}
	setNormals(normals, componentCount = GeometryData.DEFAULT_COMPONENTS_NORMAL, numVertices) {
		this.setVertexStream(SEMANTIC_NORMAL, normals, componentCount, numVertices, TYPE_FLOAT32, false);
	}
	setUvs(channel, uvs, componentCount = GeometryData.DEFAULT_COMPONENTS_UV, numVertices) {
		this.setVertexStream(SEMANTIC_TEXCOORD + channel, uvs, componentCount, numVertices, TYPE_FLOAT32, false);
	}
	setColors(colors, componentCount = GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices) {
		this.setVertexStream(SEMANTIC_COLOR, colors, componentCount, numVertices, TYPE_FLOAT32, false);
	}
	setColors32(colors, numVertices) {
		this.setVertexStream(SEMANTIC_COLOR, colors, GeometryData.DEFAULT_COMPONENTS_COLORS, numVertices, TYPE_UINT8, true);
	}
	setIndices(indices, numIndices) {
		this._initGeometryData();
		this._geometryData.indexStreamUpdated = true;
		this._geometryData.indices = indices;
		this._geometryData.indexCount = numIndices || indices.length;
	}
	getPositions(positions) {
		return this.getVertexStream(SEMANTIC_POSITION, positions);
	}
	getNormals(normals) {
		return this.getVertexStream(SEMANTIC_NORMAL, normals);
	}
	getUvs(channel, uvs) {
		return this.getVertexStream(SEMANTIC_TEXCOORD + channel, uvs);
	}
	getColors(colors) {
		return this.getVertexStream(SEMANTIC_COLOR, colors);
	}
	getIndices(indices) {
		let count = 0;
		if (this._geometryData && this._geometryData.indices) {
			const streamIndices = this._geometryData.indices;
			count = this._geometryData.indexCount;
			if (ArrayBuffer.isView(indices)) {
				indices.set(streamIndices);
			} else {
				indices.length = 0;
				indices.push(streamIndices);
			}
		} else {
			if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
				const indexBuffer = this.indexBuffer[0];
				count = indexBuffer.readData(indices);
			}
		}
		return count;
	}
	update(primitiveType = PRIMITIVE_TRIANGLES, updateBoundingBox = true) {
		if (this._geometryData) {
			if (updateBoundingBox) {
				const stream = this._geometryData.vertexStreamDictionary[SEMANTIC_POSITION];
				if (stream) {
					if (stream.componentCount === 3) {
						this._aabb.compute(stream.data, this._geometryData.vertexCount);
					}
				}
			}
			let destroyVB = this._geometryData.recreate;
			if (this._geometryData.vertexCount > this._geometryData.maxVertices) {
				destroyVB = true;
				this._geometryData.maxVertices = this._geometryData.vertexCount;
			}
			if (destroyVB) {
				if (this.vertexBuffer) {
					this.vertexBuffer.destroy();
					this.vertexBuffer = null;
				}
			}
			let destroyIB = this._geometryData.recreate;
			if (this._geometryData.indexCount > this._geometryData.maxIndices) {
				destroyIB = true;
				this._geometryData.maxIndices = this._geometryData.indexCount;
			}
			if (destroyIB) {
				if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
					this.indexBuffer[0].destroy();
					this.indexBuffer[0] = null;
				}
			}
			if (this._geometryData.vertexStreamsUpdated) {
				this._updateVertexBuffer();
			}
			if (this._geometryData.indexStreamUpdated) {
				this._updateIndexBuffer();
			}
			this.primitive[0].type = primitiveType;
			if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
				if (this._geometryData.indexStreamUpdated) {
					this.primitive[0].count = this._geometryData.indexCount;
					this.primitive[0].indexed = true;
				}
			} else {
				if (this._geometryData.vertexStreamsUpdated) {
					this.primitive[0].count = this._geometryData.vertexCount;
					this.primitive[0].indexed = false;
				}
			}
			this._geometryData.vertexCount = 0;
			this._geometryData.indexCount = 0;
			this._geometryData.vertexStreamsUpdated = false;
			this._geometryData.indexStreamUpdated = false;
			this._geometryData.recreate = false;
			this.updateRenderStates();
		}
	}
	_buildVertexFormat(vertexCount) {
		const vertexDesc = [];
		for (const semantic in this._geometryData.vertexStreamDictionary) {
			const stream = this._geometryData.vertexStreamDictionary[semantic];
			vertexDesc.push({
				semantic: semantic,
				components: stream.componentCount,
				type: stream.dataType,
				normalize: stream.dataTypeNormalize
			});
		}
		return new VertexFormat(this.device, vertexDesc, vertexCount);
	}
	_updateVertexBuffer() {
		if (!this.vertexBuffer) {
			const allocateVertexCount = this._geometryData.maxVertices;
			const format = this._buildVertexFormat(allocateVertexCount);
			this.vertexBuffer = new VertexBuffer(this.device, format, allocateVertexCount, this._geometryData.verticesUsage);
		}
		const iterator = new VertexIterator(this.vertexBuffer);
		const numVertices = this._geometryData.vertexCount;
		for (const semantic in this._geometryData.vertexStreamDictionary) {
			const stream = this._geometryData.vertexStreamDictionary[semantic];
			iterator.writeData(semantic, stream.data, numVertices);
			delete this._geometryData.vertexStreamDictionary[semantic];
		}
		iterator.end();
	}
	_updateIndexBuffer() {
		if (this.indexBuffer.length <= 0 || !this.indexBuffer[0]) {
			const createFormat = this._geometryData.maxVertices > 0xffff ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
			this.indexBuffer[0] = new IndexBuffer(this.device, createFormat, this._geometryData.maxIndices, this._geometryData.indicesUsage);
		}
		const srcIndices = this._geometryData.indices;
		if (srcIndices) {
			const indexBuffer = this.indexBuffer[0];
			indexBuffer.writeData(srcIndices, this._geometryData.indexCount);
			this._geometryData.indices = null;
		}
	}
	prepareRenderState(renderStyle) {
		if (renderStyle === RENDERSTYLE_WIREFRAME) {
			this.generateWireframe();
		} else if (renderStyle === RENDERSTYLE_POINTS) {
			this.primitive[RENDERSTYLE_POINTS] = {
				type: PRIMITIVE_POINTS,
				base: 0,
				count: this.vertexBuffer ? this.vertexBuffer.numVertices : 0,
				indexed: false
			};
		}
	}
	updateRenderStates() {
		if (this.primitive[RENDERSTYLE_POINTS]) {
			this.prepareRenderState(RENDERSTYLE_POINTS);
		}
		if (this.primitive[RENDERSTYLE_WIREFRAME]) {
			this.prepareRenderState(RENDERSTYLE_WIREFRAME);
		}
	}
	generateWireframe() {
		this._destroyIndexBuffer(RENDERSTYLE_WIREFRAME);
		const numVertices = this.vertexBuffer.numVertices;
		const lines = [];
		let format;
		if (this.indexBuffer.length > 0 && this.indexBuffer[0]) {
			const offsets = [[0, 1], [1, 2], [2, 0]];
			const base = this.primitive[RENDERSTYLE_SOLID].base;
			const count = this.primitive[RENDERSTYLE_SOLID].count;
			const indexBuffer = this.indexBuffer[RENDERSTYLE_SOLID];
			const srcIndices = new typedArrayIndexFormats[indexBuffer.format](indexBuffer.storage);
			const seen = new Set();
			for (let j = base; j < base + count; j += 3) {
				for (let k = 0; k < 3; k++) {
					const i1 = srcIndices[j + offsets[k][0]];
					const i2 = srcIndices[j + offsets[k][1]];
					const hash = i1 > i2 ? i2 * numVertices + i1 : i1 * numVertices + i2;
					if (!seen.has(hash)) {
						seen.add(hash);
						lines.push(i1, i2);
					}
				}
			}
			format = indexBuffer.format;
		} else {
			for (let i = 0; i < numVertices; i += 3) {
				lines.push(i, i + 1, i + 1, i + 2, i + 2, i);
			}
			format = lines.length > 65535 ? INDEXFORMAT_UINT32 : INDEXFORMAT_UINT16;
		}
		const wireBuffer = new IndexBuffer(this.vertexBuffer.device, format, lines.length);
		const dstIndices = new typedArrayIndexFormats[wireBuffer.format](wireBuffer.storage);
		dstIndices.set(lines);
		wireBuffer.unlock();
		this.primitive[RENDERSTYLE_WIREFRAME] = {
			type: PRIMITIVE_LINES,
			base: 0,
			count: lines.length,
			indexed: true
		};
		this.indexBuffer[RENDERSTYLE_WIREFRAME] = wireBuffer;
	}
}

export { Mesh };
