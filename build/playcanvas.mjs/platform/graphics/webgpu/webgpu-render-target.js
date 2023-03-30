import '../../../core/tracing.js';

class WebgpuRenderTarget {
	constructor(renderTarget) {
		this.initialized = false;
		this.colorFormat = void 0;
		this.key = void 0;
		this.depthFormat = void 0;
		this.hasStencil = void 0;
		this.multisampledColorBuffer = void 0;
		this.depthTexture = null;
		this.depthTextureInternal = false;
		this.assignedColorTexture = null;
		this.renderPassDescriptor = {};
		this.renderTarget = renderTarget;
		if (renderTarget.colorBuffer) {
			this.colorFormat = renderTarget.colorBuffer.impl.format;
		}
		this.updateKey();
	}
	destroy(device) {
		var _this$multisampledCol;
		this.initialized = false;
		if (this.depthTextureInternal) {
			var _this$depthTexture;
			(_this$depthTexture = this.depthTexture) == null ? void 0 : _this$depthTexture.destroy();
			this.depthTexture = null;
		}
		this.assignedColorTexture = null;
		(_this$multisampledCol = this.multisampledColorBuffer) == null ? void 0 : _this$multisampledCol.destroy();
		this.multisampledColorBuffer = null;
	}
	updateKey() {
		const rt = this.renderTarget;
		this.key = `${this.colorFormat}-${rt.depth ? this.depthFormat : ''}-${rt.samples}`;
	}
	setDepthFormat(depthFormat) {
		this.depthFormat = depthFormat;
		this.hasStencil = depthFormat === 'depth24plus-stencil8';
	}
	assignColorTexture(gpuTexture) {
		this.assignedColorTexture = gpuTexture;
		const view = gpuTexture.createView();
		const colorAttachment = this.renderPassDescriptor.colorAttachments[0];
		const samples = this.renderTarget.samples;
		if (samples > 1) {
			colorAttachment.resolveTarget = view;
		} else {
			colorAttachment.view = view;
		}
		this.colorFormat = gpuTexture.format;
		this.updateKey();
	}
	init(device, renderTarget) {
		const wgpu = device.wgpu;
		const {
			samples,
			width,
			height,
			depth,
			depthBuffer
		} = renderTarget;
		if (depth || depthBuffer) {
			if (!depthBuffer) {
				this.setDepthFormat('depth24plus-stencil8');
				const depthTextureDesc = {
					size: [width, height, 1],
					dimension: '2d',
					sampleCount: samples,
					format: this.depthFormat,
					usage: GPUTextureUsage.RENDER_ATTACHMENT
				};
				if (samples <= 1) {
					depthTextureDesc.usage |= GPUTextureUsage.COPY_SRC;
				}
				this.depthTexture = wgpu.createTexture(depthTextureDesc);
				this.depthTextureInternal = true;
			} else {
				this.depthTexture = depthBuffer.impl.gpuTexture;
				this.setDepthFormat(depthBuffer.impl.format);
			}
			this.renderPassDescriptor.depthStencilAttachment = {
				view: this.depthTexture.createView()
			};
		}
		const colorAttachment = {};
		this.renderPassDescriptor.colorAttachments = [];
		const colorBuffer = renderTarget.colorBuffer;
		let colorView = null;
		if (colorBuffer) {
			colorView = colorBuffer.impl.getView(device);
			if (colorBuffer.cubemap) {
				colorView = colorBuffer.impl.createView({
					dimension: '2d',
					baseArrayLayer: renderTarget.face,
					arrayLayerCount: 1
				});
			}
		}
		if (samples > 1) {
			const multisampledTextureDesc = {
				size: [width, height, 1],
				dimension: '2d',
				sampleCount: samples,
				format: this.colorFormat,
				usage: GPUTextureUsage.RENDER_ATTACHMENT
			};
			this.multisampledColorBuffer = wgpu.createTexture(multisampledTextureDesc);
			colorAttachment.view = this.multisampledColorBuffer.createView();
			colorAttachment.resolveTarget = colorView;
		} else {
			colorAttachment.view = colorView;
		}
		if (colorAttachment.view || this.colorFormat) {
			this.renderPassDescriptor.colorAttachments.push(colorAttachment);
		}
		this.initialized = true;
	}
	setupForRenderPass(renderPass) {
		var _this$renderPassDescr;
		const colorAttachment = (_this$renderPassDescr = this.renderPassDescriptor.colorAttachments) == null ? void 0 : _this$renderPassDescr[0];
		if (colorAttachment) {
			colorAttachment.clearValue = renderPass.colorOps.clearValue;
			colorAttachment.loadOp = renderPass.colorOps.clear ? 'clear' : 'load';
			colorAttachment.storeOp = renderPass.colorOps.store ? 'store' : 'discard';
		}
		const depthAttachment = this.renderPassDescriptor.depthStencilAttachment;
		if (depthAttachment) {
			depthAttachment.depthClearValue = renderPass.depthStencilOps.clearDepthValue;
			depthAttachment.depthLoadOp = renderPass.depthStencilOps.clearDepth ? 'clear' : 'load';
			depthAttachment.depthStoreOp = renderPass.depthStencilOps.storeDepth ? 'store' : 'discard';
			depthAttachment.depthReadOnly = false;
			if (this.hasStencil) {
				depthAttachment.stencilClearValue = renderPass.depthStencilOps.clearStencilValue;
				depthAttachment.stencilLoadOp = renderPass.depthStencilOps.clearStencil ? 'clear' : 'load';
				depthAttachment.stencilStoreOp = renderPass.depthStencilOps.storeStencil ? 'store' : 'discard';
				depthAttachment.stencilReadOnly = false;
			}
		}
	}
	loseContext() {
		this.initialized = false;
	}
	resolve(device, target, color, depth) {}
}

export { WebgpuRenderTarget };
