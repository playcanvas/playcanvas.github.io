import '../../../core/debug.js';
import './webgpu-debug.js';

class ColorAttachment {
	constructor() {
		this.format = void 0;
		this.multisampledBuffer = void 0;
	}
	destroy() {
		var _this$multisampledBuf;
		(_this$multisampledBuf = this.multisampledBuffer) == null ? void 0 : _this$multisampledBuf.destroy();
		this.multisampledBuffer = null;
	}
}
class WebgpuRenderTarget {
	constructor(renderTarget) {
		this.initialized = false;
		this.key = void 0;
		this.colorAttachments = [];
		this.depthFormat = void 0;
		this.hasStencil = void 0;
		this.depthTexture = null;
		this.depthTextureInternal = false;
		this.assignedColorTexture = null;
		this.renderPassDescriptor = {};
		this.renderTarget = renderTarget;
		if (renderTarget._colorBuffers) {
			renderTarget._colorBuffers.forEach((colorBuffer, index) => {
				this.setColorAttachment(index, undefined, colorBuffer.impl.format);
			});
		}
		this.updateKey();
	}
	destroy(device) {
		this.initialized = false;
		if (this.depthTextureInternal) {
			var _this$depthTexture;
			(_this$depthTexture = this.depthTexture) == null ? void 0 : _this$depthTexture.destroy();
			this.depthTexture = null;
		}
		this.assignedColorTexture = null;
		this.colorAttachments.forEach(colorAttachment => {
			colorAttachment.destroy();
		});
		this.colorAttachments.length = 0;
	}
	updateKey() {
		const rt = this.renderTarget;
		this.key = '';
		this.colorAttachments.forEach((colorAttachment, index) => {
			this.key += `${index}:${colorAttachment.format}-`;
		});
		this.key += `${rt.depth ? this.depthFormat : ''}-${rt.samples}`;
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
		this.setColorAttachment(0, undefined, gpuTexture.format);
		this.updateKey();
	}
	setColorAttachment(index, multisampledBuffer, format) {
		if (!this.colorAttachments[index]) {
			this.colorAttachments[index] = new ColorAttachment();
		}
		if (multisampledBuffer) {
			this.colorAttachments[index].multisampledBuffer = multisampledBuffer;
		}
		if (format) {
			this.colorAttachments[index].format = format;
		}
	}
	init(device, renderTarget) {
		var _renderTarget$_colorB, _renderTarget$_colorB2;
		const wgpu = device.wgpu;
		this.initDepthStencil(wgpu, renderTarget);
		this.renderPassDescriptor.colorAttachments = [];
		const count = (_renderTarget$_colorB = (_renderTarget$_colorB2 = renderTarget._colorBuffers) == null ? void 0 : _renderTarget$_colorB2.length) != null ? _renderTarget$_colorB : 1;
		for (let i = 0; i < count; ++i) {
			var _this$colorAttachment;
			const colorAttachment = this.initColor(wgpu, renderTarget, i);
			const isDefaultFramebuffer = i === 0 && ((_this$colorAttachment = this.colorAttachments[0]) == null ? void 0 : _this$colorAttachment.format);
			if (colorAttachment.view || isDefaultFramebuffer) {
				this.renderPassDescriptor.colorAttachments.push(colorAttachment);
			}
		}
		this.initialized = true;
	}
	initDepthStencil(wgpu, renderTarget) {
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
	}
	initColor(wgpu, renderTarget, index) {
		const colorAttachment = {};
		const {
			samples,
			width,
			height
		} = renderTarget;
		const colorBuffer = renderTarget.getColorBuffer(index);
		let colorView = null;
		if (colorBuffer) {
			const mipLevelCount = 1;
			if (colorBuffer.cubemap) {
				colorView = colorBuffer.impl.createView({
					dimension: '2d',
					baseArrayLayer: renderTarget.face,
					arrayLayerCount: 1,
					mipLevelCount
				});
			} else {
				colorView = colorBuffer.impl.createView({
					mipLevelCount
				});
			}
		}
		if (samples > 1) {
			var _this$colorAttachment2, _this$colorAttachment3;
			const multisampledTextureDesc = {
				size: [width, height, 1],
				dimension: '2d',
				sampleCount: samples,
				format: (_this$colorAttachment2 = (_this$colorAttachment3 = this.colorAttachments[index]) == null ? void 0 : _this$colorAttachment3.format) != null ? _this$colorAttachment2 : colorBuffer.impl.format,
				usage: GPUTextureUsage.RENDER_ATTACHMENT
			};
			const multisampledColorBuffer = wgpu.createTexture(multisampledTextureDesc);
			this.setColorAttachment(index, multisampledColorBuffer);
			colorAttachment.view = multisampledColorBuffer.createView();
			colorAttachment.resolveTarget = colorView;
		} else {
			colorAttachment.view = colorView;
		}
		return colorAttachment;
	}
	setupForRenderPass(renderPass) {
		var _this$renderPassDescr, _this$renderPassDescr2;
		const count = (_this$renderPassDescr = (_this$renderPassDescr2 = this.renderPassDescriptor.colorAttachments) == null ? void 0 : _this$renderPassDescr2.length) != null ? _this$renderPassDescr : 0;
		for (let i = 0; i < count; ++i) {
			const colorAttachment = this.renderPassDescriptor.colorAttachments[i];
			const colorOps = renderPass.colorArrayOps[i];
			colorAttachment.clearValue = colorOps.clearValue;
			colorAttachment.loadOp = colorOps.clear ? 'clear' : 'load';
			colorAttachment.storeOp = colorOps.store ? 'store' : 'discard';
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
