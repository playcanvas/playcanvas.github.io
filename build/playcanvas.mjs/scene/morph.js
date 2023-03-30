import '../core/tracing.js';
import { RefCountedObject } from '../core/ref-counted-object.js';
import { Vec3 } from '../core/math/vec3.js';
import { FloatPacking } from '../core/math/float-packing.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { Texture } from '../platform/graphics/texture.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGB32F, BUFFER_STATIC, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, SEMANTIC_ATTR15, TYPE_FLOAT32 } from '../platform/graphics/constants.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';

const _floatRounding = 0.2;
const defaultOptions = {
	preferHighPrecision: false
};
class Morph extends RefCountedObject {
	constructor(targets, graphicsDevice, options = defaultOptions) {
		super();
		this._aabb = void 0;
		this.preferHighPrecision = void 0;
		this.device = graphicsDevice || GraphicsDeviceAccess.get();
		this.preferHighPrecision = options.preferHighPrecision;
		targets.forEach(target => void 0);
		this._targets = targets.slice();
		const device = this.device;
		if (device.supportsMorphTargetTexturesCore) {
			const renderableHalf = device.extTextureHalfFloat && device.textureHalfFloatRenderable ? PIXELFORMAT_RGBA16F : undefined;
			const renderableFloat = device.extTextureFloat && device.textureFloatRenderable ? PIXELFORMAT_RGBA32F : undefined;
			this._renderTextureFormat = this.preferHighPrecision ? renderableFloat != null ? renderableFloat : renderableHalf : renderableHalf != null ? renderableHalf : renderableFloat;
			const textureHalf = device.extTextureHalfFloat && device.textureHalfFloatUpdatable ? PIXELFORMAT_RGBA16F : undefined;
			const textureFloat = device.extTextureFloat ? PIXELFORMAT_RGB32F : undefined;
			this._textureFormat = this.preferHighPrecision ? textureFloat != null ? textureFloat : textureHalf : textureHalf != null ? textureHalf : textureFloat;
			if (this._renderTextureFormat !== undefined && this._textureFormat !== undefined) {
				this._useTextureMorph = true;
			}
		}
		this._init();
		this._updateMorphFlags();
	}
	get aabb() {
		if (!this._aabb) {
			const min = new Vec3();
			const max = new Vec3();
			for (let i = 0; i < this._targets.length; i++) {
				const targetAabb = this._targets[i].aabb;
				min.min(targetAabb.getMin());
				max.max(targetAabb.getMax());
			}
			this._aabb = new BoundingBox();
			this._aabb.setMinMax(min, max);
		}
		return this._aabb;
	}
	get morphPositions() {
		return this._morphPositions;
	}
	get morphNormals() {
		return this._morphNormals;
	}
	get maxActiveTargets() {
		if (this._useTextureMorph) return this._targets.length;
		return this._morphPositions && this._morphNormals ? 4 : 8;
	}
	get useTextureMorph() {
		return this._useTextureMorph;
	}
	_init() {
		if (this._useTextureMorph) {
			this._useTextureMorph = this._initTextureBased();
		}
		if (!this._useTextureMorph) {
			for (let i = 0; i < this._targets.length; i++) {
				this._targets[i]._initVertexBuffers(this.device);
			}
		}
		for (let i = 0; i < this._targets.length; i++) {
			this._targets[i]._postInit();
		}
	}
	_findSparseSet(deltaArrays, ids, usedDataIndices) {
		let freeIndex = 1;
		const dataCount = deltaArrays[0].length;
		for (let v = 0; v < dataCount; v += 3) {
			let vertexUsed = false;
			for (let i = 0; i < deltaArrays.length; i++) {
				const data = deltaArrays[i];
				if (data[v] !== 0 || data[v + 1] !== 0 || data[v + 2] !== 0) {
					vertexUsed = true;
					break;
				}
			}
			if (vertexUsed) {
				ids.push(freeIndex + _floatRounding);
				usedDataIndices.push(v / 3);
				freeIndex++;
			} else {
				ids.push(0 + _floatRounding);
			}
		}
		return freeIndex;
	}
	_initTextureBased() {
		const deltaArrays = [],
			deltaInfos = [];
		for (let i = 0; i < this._targets.length; i++) {
			const target = this._targets[i];
			if (target.options.deltaPositions) {
				deltaArrays.push(target.options.deltaPositions);
				deltaInfos.push({
					target: target,
					name: 'texturePositions'
				});
			}
			if (target.options.deltaNormals) {
				deltaArrays.push(target.options.deltaNormals);
				deltaInfos.push({
					target: target,
					name: 'textureNormals'
				});
			}
		}
		const ids = [],
			usedDataIndices = [];
		const freeIndex = this._findSparseSet(deltaArrays, ids, usedDataIndices);
		const maxTextureSize = Math.min(this.device.maxTextureSize, 4096);
		let morphTextureWidth = Math.ceil(Math.sqrt(freeIndex));
		morphTextureWidth = Math.min(morphTextureWidth, maxTextureSize);
		const morphTextureHeight = Math.ceil(freeIndex / morphTextureWidth);
		if (morphTextureHeight > maxTextureSize) {
			return false;
		}
		this.morphTextureWidth = morphTextureWidth;
		this.morphTextureHeight = morphTextureHeight;
		let halfFloat = false;
		let numComponents = 3;
		const float2Half = FloatPacking.float2Half;
		if (this._textureFormat === PIXELFORMAT_RGBA16F) {
			halfFloat = true;
			numComponents = 4;
		}
		const textures = [];
		for (let i = 0; i < deltaArrays.length; i++) {
			textures.push(this._createTexture('MorphTarget', this._textureFormat));
		}
		for (let i = 0; i < deltaArrays.length; i++) {
			const data = deltaArrays[i];
			const texture = textures[i];
			const textureData = texture.lock();
			if (halfFloat) {
				for (let v = 0; v < usedDataIndices.length; v++) {
					const index = usedDataIndices[v] * 3;
					const dstIndex = v * numComponents + numComponents;
					textureData[dstIndex] = float2Half(data[index]);
					textureData[dstIndex + 1] = float2Half(data[index + 1]);
					textureData[dstIndex + 2] = float2Half(data[index + 2]);
				}
			} else {
				for (let v = 0; v < usedDataIndices.length; v++) {
					const index = usedDataIndices[v] * 3;
					const dstIndex = v * numComponents + numComponents;
					textureData[dstIndex] = data[index];
					textureData[dstIndex + 1] = data[index + 1];
					textureData[dstIndex + 2] = data[index + 2];
				}
			}
			texture.unlock();
			const target = deltaInfos[i].target;
			target._setTexture(deltaInfos[i].name, texture);
		}
		const formatDesc = [{
			semantic: SEMANTIC_ATTR15,
			components: 1,
			type: TYPE_FLOAT32
		}];
		this.vertexBufferIds = new VertexBuffer(this.device, new VertexFormat(this.device, formatDesc), ids.length, BUFFER_STATIC, new Float32Array(ids));
		return true;
	}
	destroy() {
		var _this$vertexBufferIds;
		(_this$vertexBufferIds = this.vertexBufferIds) == null ? void 0 : _this$vertexBufferIds.destroy();
		this.vertexBufferIds = null;
		for (let i = 0; i < this._targets.length; i++) {
			this._targets[i].destroy();
		}
		this._targets.length = 0;
	}
	get targets() {
		return this._targets;
	}
	_updateMorphFlags() {
		this._morphPositions = false;
		this._morphNormals = false;
		for (let i = 0; i < this._targets.length; i++) {
			const target = this._targets[i];
			if (target.morphPositions) {
				this._morphPositions = true;
			}
			if (target.morphNormals) {
				this._morphNormals = true;
			}
		}
	}
	_createTexture(name, format) {
		return new Texture(this.device, {
			width: this.morphTextureWidth,
			height: this.morphTextureHeight,
			format: format,
			cubemap: false,
			mipmaps: false,
			minFilter: FILTER_NEAREST,
			magFilter: FILTER_NEAREST,
			addressU: ADDRESS_CLAMP_TO_EDGE,
			addressV: ADDRESS_CLAMP_TO_EDGE,
			name: name
		});
	}
}

export { Morph };
