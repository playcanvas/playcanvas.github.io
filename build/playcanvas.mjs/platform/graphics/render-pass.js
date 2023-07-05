import '../../core/debug.js';
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
	get colorOps() {
		return this.colorArrayOps[0];
	}
	constructor(graphicsDevice, execute) {
		this.name = void 0;
		this.renderTarget = void 0;
		this.samples = 0;
		this.colorArrayOps = [];
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
		var _renderTarget$_colorB;
		this.renderTarget = renderTarget || null;
		this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);
		this.depthStencilOps = new DepthStencilAttachmentOps();
		const numColorOps = renderTarget ? (_renderTarget$_colorB = renderTarget._colorBuffers) == null ? void 0 : _renderTarget$_colorB.length : 1;
		for (let i = 0; i < numColorOps; i++) {
			var _this$renderTarget, _this$renderTarget$_c;
			const colorOps = new ColorAttachmentOps();
			this.colorArrayOps[i] = colorOps;
			if (this.samples === 1) {
				colorOps.store = true;
				colorOps.resolve = false;
			}
			if ((_this$renderTarget = this.renderTarget) != null && (_this$renderTarget$_c = _this$renderTarget._colorBuffers) != null && _this$renderTarget$_c[i].mipmaps) {
				colorOps.mipmaps = true;
			}
		}
	}
	setClearColor(color) {
		const count = this.colorArrayOps.length;
		for (let i = 0; i < count; i++) {
			const colorOps = this.colorArrayOps[i];
			colorOps.clearValue.copy(color);
			colorOps.clear = true;
		}
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
