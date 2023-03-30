/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { Color } from '../../core/math/color.js';

class ColorAttachmentOps {
	constructor() {
		this.clearValue = new Color(0, 0, 0, 1);
		this.clear = false;
		this.store = false;
		this.resolve = true;
		this.mipmaps = false;
	}
}
class DepthStencilAttachmentOps {
	constructor() {
		this.clearDepthValue = 1;
		this.clearStencilValue = 0;
		this.clearDepth = false;
		this.clearStencil = false;
		this.storeDepth = false;
		this.storeStencil = false;
	}
}
class RenderPass {
	constructor(graphicsDevice, execute) {
		this.name = void 0;
		this.renderTarget = void 0;
		this.samples = 0;
		this.colorOps = void 0;
		this.depthStencilOps = void 0;
		this.requiresCubemaps = true;
		this.fullSizeClearRect = true;
		this.execute = void 0;
		this.before = void 0;
		this.after = void 0;
		this.device = graphicsDevice;
		this.execute = execute;
	}
	init(renderTarget) {
		var _this$renderTarget, _this$renderTarget$co;
		this.renderTarget = renderTarget || null;
		this.colorOps = new ColorAttachmentOps();
		this.depthStencilOps = new DepthStencilAttachmentOps();
		this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);
		if (this.samples === 1) {
			this.colorOps.store = true;
			this.colorOps.resolve = false;
		}
		if ((_this$renderTarget = this.renderTarget) != null && (_this$renderTarget$co = _this$renderTarget.colorBuffer) != null && _this$renderTarget$co.mipmaps) {
			this.colorOps.mipmaps = true;
		}
	}
	setClearColor(color) {
		this.colorOps.clearValue.copy(color);
		this.colorOps.clear = true;
	}
	setClearDepth(depthValue) {
		this.depthStencilOps.clearDepthValue = depthValue;
		this.depthStencilOps.clearDepth = true;
	}
	setClearStencil(stencilValue) {
		this.depthStencilOps.clearStencilValue = stencilValue;
		this.depthStencilOps.clearStencil = true;
	}
	render() {
		var _this$before, _this$execute, _this$after;
		const device = this.device;
		const realPass = this.renderTarget !== undefined;
		(_this$before = this.before) == null ? void 0 : _this$before.call(this);
		if (realPass) {
			device.startPass(this);
		}
		(_this$execute = this.execute) == null ? void 0 : _this$execute.call(this);
		if (realPass) {
			device.endPass(this);
		}
		(_this$after = this.after) == null ? void 0 : _this$after.call(this);
		device.renderPassIndex++;
	}
}

export { ColorAttachmentOps, DepthStencilAttachmentOps, RenderPass };
