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
class Morph extends RefCountedObject {
	constructor(targets, graphicsDevice) {
		super();
		this.device = graphicsDevice || GraphicsDeviceAccess.get();
		targets.forEach(target => void 0);
		this._targets = targets.slice();
		if (this.device.supportsMorphTargetTexturesCore) {
			if (this.device.extTextureHalfFloat && this.device.textureHalfFloatRenderable) {
				this._renderTextureFormat = PIXELFORMAT_RGBA16F;
			} else if (this.device.extTextureFloat && this.device.textureFloatRenderable) {
				this._renderTextureFormat = PIXELFORMAT_RGBA32F;
			}
			if (this.device.extTextureHalfFloat && this.device.textureHalfFloatUpdatable) {
				this._textureFormat = PIXELFORMAT_RGBA16F;
			} else if (this.device.extTextureFloat) {
				this._textureFormat = PIXELFORMAT_RGB32F;
			}
			if (this._renderTextureFormat !== undefined && this._textureFormat !== undefined) {
				this._useTextureMorph = true;
			}
		}
		this._init();
		this._updateMorphFlags();
		this._calculateAabb();
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
		for (let i = 0; i < deltaArrays.length; i++) {
			const data = deltaArrays[i];
			const texture = this._createTexture('MorphTarget', this._textureFormat);
			const packedDeltas = texture.lock();
			for (let v = 0; v < usedDataIndices.length; v++) {
				const index = usedDataIndices[v];
				if (halfFloat) {
					packedDeltas[v * numComponents + numComponents] = float2Half(data[index * 3]);
					packedDeltas[v * numComponents + numComponents + 1] = float2Half(data[index * 3 + 1]);
					packedDeltas[v * numComponents + numComponents + 2] = float2Half(data[index * 3 + 2]);
				} else {
					packedDeltas[v * numComponents + numComponents] = data[index * 3];
					packedDeltas[v * numComponents + numComponents + 1] = data[index * 3 + 1];
					packedDeltas[v * numComponents + numComponents + 2] = data[index * 3 + 2];
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
	_calculateAabb() {
		const min = new Vec3();
		const max = new Vec3();
		for (let i = 0; i < this._targets.length; i++) {
			const targetAabb = this._targets[i].aabb;
			min.min(targetAabb.getMin());
			max.max(targetAabb.getMax());
		}
		this.aabb = new BoundingBox();
		this.aabb.setMinMax(min, max);
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
