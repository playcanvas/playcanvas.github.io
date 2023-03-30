import { semanticToLocation, TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32 } from '../constants.js';

const gpuVertexFormats = [];
gpuVertexFormats[TYPE_INT8] = 'sint8';
gpuVertexFormats[TYPE_UINT8] = 'uint8';
gpuVertexFormats[TYPE_INT16] = 'sint16';
gpuVertexFormats[TYPE_UINT16] = 'uint16';
gpuVertexFormats[TYPE_INT32] = 'sint32';
gpuVertexFormats[TYPE_UINT32] = 'uint32';
gpuVertexFormats[TYPE_FLOAT32] = 'float32';
class WebgpuVertexBufferLayout {
	constructor() {
		this.cache = new Map();
	}
	get(vertexFormat0, vertexFormat1 = null) {
		const key = this.getKey(vertexFormat0, vertexFormat1);
		let layout = this.cache.get(key);
		if (!layout) {
			layout = this.create(vertexFormat0, vertexFormat1);
			this.cache.set(key, layout);
		}
		return layout;
	}
	getKey(vertexFormat0, vertexFormat1 = null) {
		return `VB[${vertexFormat0 == null ? void 0 : vertexFormat0.renderingHashString}, ${vertexFormat1 == null ? void 0 : vertexFormat1.renderingHashString}]`;
	}
	create(vertexFormat0, vertexFormat1) {
		const layout = [];
		const addFormat = format => {
			const interleaved = format.interleaved;
			const stepMode = format.instancing ? 'instance' : 'vertex';
			let attributes = [];
			const elementCount = format.elements.length;
			for (let i = 0; i < elementCount; i++) {
				const element = format.elements[i];
				const location = semanticToLocation[element.name];
				attributes.push({
					shaderLocation: location,
					offset: interleaved ? element.offset : 0,
					format: `${gpuVertexFormats[element.dataType]}${element.numComponents > 1 ? 'x' + element.numComponents : ''}`
				});
				if (!interleaved || i === elementCount - 1) {
					layout.push({
						attributes: attributes,
						arrayStride: element.stride,
						stepMode: stepMode
					});
					attributes = [];
				}
			}
		};
		if (vertexFormat0) addFormat(vertexFormat0);
		if (vertexFormat1) addFormat(vertexFormat1);
		return layout;
	}
}

export { WebgpuVertexBufferLayout };
