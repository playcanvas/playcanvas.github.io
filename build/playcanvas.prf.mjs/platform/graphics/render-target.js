import '../../core/tracing.js';
import { PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL } from './constants.js';
import { GraphicsDevice } from './graphics-device.js';

let id = 0;
class RenderTarget {
	constructor(options = {}) {
		var _options$face, _this$_colorBuffer, _this$_depthBuffer, _options$samples, _options$autoResolve, _options$flipY;
		this.id = id++;
		const _arg2 = arguments[1];
		const _arg3 = arguments[2];
		if (options instanceof GraphicsDevice) {
			this._colorBuffer = _arg2;
			options = _arg3;
		} else {
			this._colorBuffer = options.colorBuffer;
		}
		if (this._colorBuffer) {
			this._colorBuffer._isRenderTarget = true;
		}
		this._depthBuffer = options.depthBuffer;
		this._face = (_options$face = options.face) != null ? _options$face : 0;
		if (this._depthBuffer) {
			const format = this._depthBuffer._format;
			if (format === PIXELFORMAT_DEPTH) {
				this._depth = true;
				this._stencil = false;
			} else if (format === PIXELFORMAT_DEPTHSTENCIL) {
				this._depth = true;
				this._stencil = true;
			} else {
				this._depth = false;
				this._stencil = false;
			}
		} else {
			var _options$depth, _options$stencil;
			this._depth = (_options$depth = options.depth) != null ? _options$depth : true;
			this._stencil = (_options$stencil = options.stencil) != null ? _options$stencil : false;
		}
		const device = ((_this$_colorBuffer = this._colorBuffer) == null ? void 0 : _this$_colorBuffer.device) || ((_this$_depthBuffer = this._depthBuffer) == null ? void 0 : _this$_depthBuffer.device) || options.graphicsDevice;
		this._device = device;
		const {
			maxSamples
		} = this._device;
		this._samples = Math.min((_options$samples = options.samples) != null ? _options$samples : 1, maxSamples);
		if (device.isWebGPU) {
			this._samples = this._samples > 1 ? maxSamples : 1;
		}
		this.autoResolve = (_options$autoResolve = options.autoResolve) != null ? _options$autoResolve : true;
		this.name = options.name;
		if (!this.name) {
			var _this$_colorBuffer2;
			this.name = (_this$_colorBuffer2 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer2.name;
		}
		if (!this.name) {
			var _this$_depthBuffer2;
			this.name = (_this$_depthBuffer2 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer2.name;
		}
		if (!this.name) {
			this.name = "Untitled";
		}
		this.flipY = (_options$flipY = options.flipY) != null ? _options$flipY : false;
		this.impl = device.createRenderTargetImpl(this);
	}
	destroy() {
		const device = this._device;
		if (device) {
			const idx = device.targets.indexOf(this);
			if (idx !== -1) {
				device.targets.splice(idx, 1);
			}
			if (device.renderTarget === this) {
				device.setRenderTarget(null);
			}
			this.destroyFrameBuffers();
		}
	}
	destroyFrameBuffers() {
		const device = this._device;
		if (device) {
			this.impl.destroy(device);
		}
	}
	destroyTextureBuffers() {
		if (this._depthBuffer) {
			this._depthBuffer.destroy();
			this._depthBuffer = null;
		}
		if (this._colorBuffer) {
			this._colorBuffer.destroy();
			this._colorBuffer = null;
		}
	}
	init() {
		this.impl.init(this._device, this);
	}
	get initialized() {
		return this.impl.initialized;
	}
	loseContext() {
		this.impl.loseContext();
	}
	resolve(color = true, depth = !!this._depthBuffer) {
		if (this._device && this._samples > 1) {
			this.impl.resolve(this._device, this, color, depth);
		}
	}
	copy(source, color, depth) {
		if (!this._device) {
			if (source._device) {
				this._device = source._device;
			} else {
				return false;
			}
		}
		const success = this._device.copyRenderTarget(source, this, color, depth);
		return success;
	}
	get samples() {
		return this._samples;
	}
	get depth() {
		return this._depth;
	}
	get stencil() {
		return this._stencil;
	}
	get colorBuffer() {
		return this._colorBuffer;
	}
	get depthBuffer() {
		return this._depthBuffer;
	}
	get face() {
		return this._face;
	}
	get width() {
		var _this$_colorBuffer3, _this$_depthBuffer3;
		return ((_this$_colorBuffer3 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer3.width) || ((_this$_depthBuffer3 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer3.width) || this._device.width;
	}
	get height() {
		var _this$_colorBuffer4, _this$_depthBuffer4;
		return ((_this$_colorBuffer4 = this._colorBuffer) == null ? void 0 : _this$_colorBuffer4.height) || ((_this$_depthBuffer4 = this._depthBuffer) == null ? void 0 : _this$_depthBuffer4.height) || this._device.height;
	}
}

export { RenderTarget };
