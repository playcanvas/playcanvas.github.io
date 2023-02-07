import '../../../core/tracing.js';
import { WebgpuVertexBufferLayout } from './webgpu-vertex-buffer-layout.js';

const _primitiveTopology = ['point-list', 'line-list', undefined, 'line-strip', 'triangle-list', 'triangle-strip', undefined];
const _blendOperation = ['add', 'subtract', 'reverse-subtract', 'min', 'max'];
const _blendFactor = ['zero', 'one', 'src', 'one-minus-src', 'dst', 'one-minus-dst', 'src-alpha', 'src-alpha-saturated', 'one-minus-src-alpha', 'dst-alpha', 'one-minus-dst-alpha', 'constant', 'one-minus-constant', undefined, undefined];
const _bindGroupLayouts = [];
class WebgpuRenderPipeline {
	constructor(device) {
		this.device = device;
		this.vertexBufferLayout = new WebgpuVertexBufferLayout();
		this.cache = new Map();
	}
	get(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, renderState) {
		const key = this.getKey(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, renderState);
		let pipeline = this.cache.get(key);
		if (!pipeline) {
			const primitiveTopology = _primitiveTopology[primitive.type];
			const pipelineLayout = this.getPipelineLayout(bindGroupFormats);
			const vertexBufferLayout = this.vertexBufferLayout.get(vertexFormat0, vertexFormat1);
			pipeline = this.create(primitiveTopology, shader.impl, renderTarget, pipelineLayout, renderState, vertexBufferLayout);
			this.cache.set(key, pipeline);
		}
		return pipeline;
	}
	getKey(primitive, vertexFormat0, vertexFormat1, shader, renderTarget, bindGroupFormats, renderState) {
		let bindGroupKey = '';
		for (let i = 0; i < bindGroupFormats.length; i++) {
			bindGroupKey += bindGroupFormats[i].key;
		}
		const vertexBufferLayoutKey = this.vertexBufferLayout.getKey(vertexFormat0, vertexFormat1);
		const renderTargetKey = renderTarget.impl.key;
		const renderStateKey = renderState.blendKey;
		return vertexBufferLayoutKey + shader.impl.vertexCode + shader.impl.fragmentCode + renderTargetKey + renderStateKey + primitive.type + bindGroupKey;
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
	getBlend(renderState) {
		let blend;
		if (renderState.blending) {
			blend = {
				color: {
					operation: _blendOperation[renderState.blendEquationColor],
					srcFactor: _blendFactor[renderState.blendSrcColor],
					dstFactor: _blendFactor[renderState.blendDstColor]
				},
				alpha: {
					operation: _blendOperation[renderState.blendEquationAlpha],
					srcFactor: _blendFactor[renderState.blendSrcAlpha],
					dstFactor: _blendFactor[renderState.blendDstAlpha]
				}
			};
		}
		return blend;
	}
	create(primitiveTopology, webgpuShader, renderTarget, pipelineLayout, renderState, vertexBufferLayout) {
		const wgpu = this.device.wgpu;
		const depthStencil = renderTarget.depth ? {
			depthWriteEnabled: true,
			depthCompare: 'less',
			format: renderTarget.impl.depthFormat
		} : undefined;
		const vertexModule = wgpu.createShaderModule({
			code: webgpuShader.vertexCode
		});
		const descr = {
			vertex: {
				module: vertexModule,
				entryPoint: 'main',
				buffers: vertexBufferLayout
			},
			primitive: {
				topology: primitiveTopology,
				cullMode: "none"
			},
			depthStencil,
			multisample: {
				count: renderTarget.samples
			},
			layout: pipelineLayout
		};
		const colorFormat = renderTarget.impl.colorFormat;
		if (colorFormat) {
			const fragmentModule = wgpu.createShaderModule({
				code: webgpuShader.fragmentCode
			});
			descr.fragment = {
				module: fragmentModule,
				entryPoint: 'main',
				targets: [{
					format: renderTarget.impl.colorFormat,
					writeMask: GPUColorWrite.ALL,
					blend: this.getBlend(renderState)
				}]
			};
		}
		const pipeline = wgpu.createRenderPipeline(descr);
		return pipeline;
	}
}

export { WebgpuRenderPipeline };
