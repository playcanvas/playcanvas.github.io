import '../../core/debug.js';
import { hashCode } from '../../core/hash.js';
import { math } from '../../core/math/math.js';
import { typedArrayTypesByteSize, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_COLOR, SEMANTIC_TANGENT, SEMANTIC_ATTR12, TYPE_FLOAT32, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15 } from './constants.js';

class VertexFormat {
	constructor(graphicsDevice, description, vertexCount) {
		this.device = graphicsDevice;
		this._elements = [];
		this.hasUv0 = false;
		this.hasUv1 = false;
		this.hasColor = false;
		this.hasTangents = false;
		this.verticesByteSize = 0;
		this.vertexCount = vertexCount;
		this.interleaved = vertexCount === undefined;
		this.instancing = false;
		this.size = description.reduce((total, desc) => {
			return total + Math.ceil(desc.components * typedArrayTypesByteSize[desc.type] / 4) * 4;
		}, 0);
		let offset = 0,
			elementSize;
		for (let i = 0, len = description.length; i < len; i++) {
			var _elementDesc$normaliz;
			const elementDesc = description[i];
			elementSize = elementDesc.components * typedArrayTypesByteSize[elementDesc.type];
			if (vertexCount) {
				offset = math.roundUp(offset, elementSize);
			}
			const element = {
				name: elementDesc.semantic,
				offset: vertexCount ? offset : elementDesc.hasOwnProperty('offset') ? elementDesc.offset : offset,
				stride: vertexCount ? elementSize : elementDesc.hasOwnProperty('stride') ? elementDesc.stride : this.size,
				dataType: elementDesc.type,
				numComponents: elementDesc.components,
				normalize: (_elementDesc$normaliz = elementDesc.normalize) != null ? _elementDesc$normaliz : false,
				size: elementSize
			};
			this._elements.push(element);
			if (vertexCount) {
				offset += elementSize * vertexCount;
			} else {
				offset += Math.ceil(elementSize / 4) * 4;
			}
			if (elementDesc.semantic === SEMANTIC_TEXCOORD0) {
				this.hasUv0 = true;
			} else if (elementDesc.semantic === SEMANTIC_TEXCOORD1) {
				this.hasUv1 = true;
			} else if (elementDesc.semantic === SEMANTIC_COLOR) {
				this.hasColor = true;
			} else if (elementDesc.semantic === SEMANTIC_TANGENT) {
				this.hasTangents = true;
			}
		}
		if (vertexCount) {
			this.verticesByteSize = offset;
		}
		this._evaluateHash();
	}
	get elements() {
		return this._elements;
	}
	static getDefaultInstancingFormat(graphicsDevice) {
		if (!VertexFormat._defaultInstancingFormat) {
			VertexFormat._defaultInstancingFormat = new VertexFormat(graphicsDevice, [{
				semantic: SEMANTIC_ATTR12,
				components: 4,
				type: TYPE_FLOAT32
			}, {
				semantic: SEMANTIC_ATTR13,
				components: 4,
				type: TYPE_FLOAT32
			}, {
				semantic: SEMANTIC_ATTR14,
				components: 4,
				type: TYPE_FLOAT32
			}, {
				semantic: SEMANTIC_ATTR15,
				components: 4,
				type: TYPE_FLOAT32
			}]);
		}
		return VertexFormat._defaultInstancingFormat;
	}
	update() {
		this._evaluateHash();
	}
	_evaluateHash() {
		let stringElementBatch;
		const stringElementsBatch = [];
		let stringElementRender;
		const stringElementsRender = [];
		const len = this._elements.length;
		for (let i = 0; i < len; i++) {
			const element = this._elements[i];
			stringElementBatch = element.name;
			stringElementBatch += element.dataType;
			stringElementBatch += element.numComponents;
			stringElementBatch += element.normalize;
			stringElementsBatch.push(stringElementBatch);
			stringElementRender = stringElementBatch;
			stringElementRender += element.offset;
			stringElementRender += element.stride;
			stringElementRender += element.size;
			stringElementsRender.push(stringElementRender);
		}
		stringElementsBatch.sort();
		this.batchingHash = hashCode(stringElementsBatch.join());
		this.renderingHashString = stringElementsRender.join('_');
		this.renderingHash = hashCode(this.renderingHashString);
	}
}
VertexFormat._defaultInstancingFormat = null;

export { VertexFormat };
