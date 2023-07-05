import '../core/debug.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { BUFFER_STATIC, TYPE_FLOAT32, SEMANTIC_ATTR0 } from '../platform/graphics/constants.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';

class MorphTarget {
	constructor(options) {
		this.used = false;
		if (arguments.length === 2) {
			options = arguments[1];
		}
		this.options = options;
		this._name = options.name;
		this._defaultWeight = options.defaultWeight || 0;
		this._aabb = options.aabb;
		this.deltaPositions = options.deltaPositions;
	}
	destroy() {
		var _this$_vertexBufferPo, _this$_vertexBufferNo, _this$texturePosition, _this$textureNormals;
		(_this$_vertexBufferPo = this._vertexBufferPositions) == null ? void 0 : _this$_vertexBufferPo.destroy();
		this._vertexBufferPositions = null;
		(_this$_vertexBufferNo = this._vertexBufferNormals) == null ? void 0 : _this$_vertexBufferNo.destroy();
		this._vertexBufferNormals = null;
		(_this$texturePosition = this.texturePositions) == null ? void 0 : _this$texturePosition.destroy();
		this.texturePositions = null;
		(_this$textureNormals = this.textureNormals) == null ? void 0 : _this$textureNormals.destroy();
		this.textureNormals = null;
	}
	get name() {
		return this._name;
	}
	get defaultWeight() {
		return this._defaultWeight;
	}
	get aabb() {
		if (!this._aabb) {
			this._aabb = new BoundingBox();
			if (this.deltaPositions) this._aabb.compute(this.deltaPositions);
		}
		return this._aabb;
	}
	get morphPositions() {
		return !!this._vertexBufferPositions || !!this.texturePositions;
	}
	get morphNormals() {
		return !!this._vertexBufferNormals || !!this.textureNormals;
	}
	clone() {
		return new MorphTarget(this.options);
	}
	_postInit() {
		if (!this.options.preserveData) {
			this.options = null;
		}
		this.used = true;
	}
	_initVertexBuffers(graphicsDevice) {
		const options = this.options;
		this._vertexBufferPositions = this._createVertexBuffer(graphicsDevice, options.deltaPositions, options.deltaPositionsType);
		this._vertexBufferNormals = this._createVertexBuffer(graphicsDevice, options.deltaNormals, options.deltaNormalsType);
		if (this._vertexBufferPositions) {
			this.deltaPositions = this._vertexBufferPositions.lock();
		}
	}
	_createVertexBuffer(device, data, dataType = TYPE_FLOAT32) {
		if (data) {
			const formatDesc = [{
				semantic: SEMANTIC_ATTR0,
				components: 3,
				type: dataType
			}];
			return new VertexBuffer(device, new VertexFormat(device, formatDesc), data.length / 3, BUFFER_STATIC, data);
		}
		return null;
	}
	_setTexture(name, texture) {
		this[name] = texture;
	}
}

export { MorphTarget };
