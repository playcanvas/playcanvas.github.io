import '../../../core/tracing.js';
import { WebgpuVertexBufferLayout } from './webgpu-vertex-buffer-layout.js';

const _primitiveTopology = ['point-list', 'line-list', undefined, 'line-strip', 'triangle-list', 'triangle-strip', undefined];
const _blendOperation = ['add', 'subtract', 'reverse-subtract', 'min', 'max'];
const _blendFactor = ['zero', 'one', 'src', 'one-minus-src', 'dst', 'one-minus-dst', 'src-alpha', 'src-alpha-saturated', 'one-minus-src-alpha', 'dst-alpha', 'one-minus-dst-alpha', 'constant', 'one-minus-constant'];
const _depthCompareFunction = ['never', 'less', 'equal', 'less-equal', 'greater', 'not-equal', 'greater-equal', 'always'];
const _bindGroupLayouts = [];
class WebgpuRenderPipeline {
	constructor(device) {
		this.device = device;
		this.vertexBufferLayout = new WebgpuVertexBufferLayout();
		this.cache = new Map();
	}
	get(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, blendState, depthState) {
		const key = this.getKey(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, blendState, depthState);
		let pipeline = this.cache.get(key);
		if (!pipeline) {
			const primitiveTopology = _primitiveTopology[primitive.type];
			const pipelineLayout = this.getPipelineLayout(bindGroupFormats);
			const vertexBufferLayout = this.vertexBufferLayout.get(vertexFormat0, vertexFormat1);
			pipeline = this.create(primitiveTopology, shader, renderTarget, pipelineLayout, blendState, depthState, vertexBufferLayout);
			this.cache.set(key, pipeline);
		}
		return pipeline;
	}
	getKey(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, blendState, depthState) {
		let bindGroupKey = '';
		for (let i = 0; i < bindGroupFormats.length; i++) {
			bindGroupKey += bindGroupFormats[i].key;
		}
		const vertexBufferLayoutKey = this.vertexBufferLayout.getKey(vertexFormat0, vertexFormat1);
		const renderTargetKey = renderTarget.impl.key;
		return vertexBufferLayoutKey + shader.impl.vertexCode + shader.impl.fragmentCode + renderTargetKey + primitive.type + bindGroupKey + blendState.key + depthState.key;
	}
	getPipelineLayout(bindGroupFormats) {
		bindGroupFormats.forEach(format => {
			_bindGroupLayouts.push(format.bindGroupLayout);
		});
		const descr = {
			bindGroupLayouts: _bindGroupLayouts
		};
		const pipelineLayout = this.device.wgpu.createPipelineLayout(descr);
		_bindGroupLayouts.length = 0;
		return pipelineLayout;
	}
	getBlend(blendState) {
		let blend;
		if (blendState.blend) {
			blend = {
				color: {
					operation: _blendOperation[blendState.colorOp],
					srcFactor: _blendFactor[blendState.colorSrcFactor],
					dstFactor: _blendFactor[blendState.colorDstFactor]
				},
				alpha: {
					operation: _blendOperation[blendState.alphaOp],
					srcFactor: _blendFactor[blendState.alphaSrcFactor],
					dstFactor: _blendFactor[blendState.alphaDstFactor]
				}
			};
		}
		return blend;
	}
	getDepthStencil(depthState, renderTarget) {
		let depthStencil;
		const {
			depth,
			stencil
		} = renderTarget;
		if (depth || stencil) {
			depthStencil = {
				format: renderTarget.impl.depthFormat
			};
			if (depth) {
				depthStencil.depthWriteEnabled = depthState.write;
				depthStencil.depthCompare = _depthCompareFunction[depthState.func];
			} else {
				depthStencil.depthWriteEnabled = false;
				depthStencil.depthCompare = 'always';
			}
		}
		return depthStencil;
	}
	create(primitiveTopology, shader, renderTarget, pipelineLayout, blendState, depthState, vertexBufferLayout) {
		const wgpu = this.device.wgpu;
		const webgpuShader = shader.impl;
		const descr = {
			vertex: {
				module: webgpuShader.getVertexShaderModule(),
				entryPoint: webgpuShader.vertexEntryPoint,
				buffers: vertexBufferLayout
			},
			primitive: {
				topology: primitiveTopology,
				cullMode: "none"
			},
			depthStencil: this.getDepthStencil(depthState, renderTarget),
			multisample: {
				count: renderTarget.samples
			},
			layout: pipelineLayout
		};
		const colorFormat = renderTarget.impl.colorFormat;
		if (colorFormat) {
			let writeMask = 0;
			if (blendState.redWrite) writeMask |= GPUColorWrite.RED;
			if (blendState.greenWrite) writeMask |= GPUColorWrite.GREEN;
			if (blendState.blueWrite) writeMask |= GPUColorWrite.BLUE;
			if (blendState.alphaWrite) writeMask |= GPUColorWrite.ALPHA;
			descr.fragment = {
				module: webgpuShader.getFragmentShaderModule(),
				entryPoint: webgpuShader.fragmentEntryPoint,
				targets: [{
					format: renderTarget.impl.colorFormat,
					writeMask: writeMask,
					blend: this.getBlend(blendState)
				}]
			};
		}
		const pipeline = wgpu.createRenderPipeline(descr);
		return pipeline;
	}
}

export { WebgpuRenderPipeline };
