import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Mat4 } from '../../core/math/mat4.js';
import { PIXELFORMAT_LA8, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGUSAGE_GPU } from './constants.js';

class XrDepthSensing extends EventHandler {
	constructor(manager) {
		super();
		this._manager = void 0;
		this._available = false;
		this._depthInfoCpu = null;
		this._depthInfoGpu = null;
		this._usage = null;
		this._dataFormat = null;
		this._matrixDirty = false;
		this._matrix = new Mat4();
		this._emptyBuffer = new Uint8Array(32);
		this._depthBuffer = null;
		this._texture = void 0;
		this._manager = manager;
		this._texture = new Texture(this._manager.app.graphicsDevice, {
			format: PIXELFORMAT_LA8,
			mipmaps: false,
			addressU: ADDRESS_CLAMP_TO_EDGE,
			addressV: ADDRESS_CLAMP_TO_EDGE,
			minFilter: FILTER_LINEAR,
			magFilter: FILTER_LINEAR,
			name: 'XRDepthSensing'
		});
		if (this.supported) {
			this._manager.on('start', this._onSessionStart, this);
			this._manager.on('end', this._onSessionEnd, this);
		}
	}
	destroy() {
		this._texture.destroy();
		this._texture = null;
	}
	_onSessionStart() {
		const session = this._manager.session;
		try {
			this._usage = session.depthUsage;
			this._dataFormat = session.depthDataFormat;
		} catch (ex) {
			this._usage = null;
			this._dataFormat = null;
			this._available = false;
			this.fire('error', ex);
		}
	}
	_onSessionEnd() {
		this._depthInfoCpu = null;
		this._depthInfoGpu = null;
		this._usage = null;
		this._dataFormat = null;
		if (this._available) {
			this._available = false;
			this.fire('unavailable');
		}
		this._depthBuffer = null;
		this._texture._width = 4;
		this._texture._height = 4;
		this._texture._levels[0] = this._emptyBuffer;
		this._texture.upload();
	}
	_updateTexture() {
		const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
		if (depthInfo) {
			let resized = false;
			if (depthInfo.width !== this._texture.width || depthInfo.height !== this._texture.height) {
				this._texture._width = depthInfo.width;
				this._texture._height = depthInfo.height;
				this._matrixDirty = true;
				resized = true;
			}
			if (this._depthInfoCpu) {
				const dataBuffer = this._depthInfoCpu.data;
				this._depthBuffer = new Uint8Array(dataBuffer);
				this._texture._levels[0] = this._depthBuffer;
				this._texture.upload();
			} else if (this._depthInfoGpu) {
				this._texture._levels[0] = this._depthInfoGpu.texture;
				this._texture.upload();
			}
			if (resized) this.fire('resize', depthInfo.width, depthInfo.height);
		} else if (this._depthBuffer) {
			this._depthBuffer = null;
			this._texture._width = 4;
			this._texture._height = 4;
			this._texture._levels[0] = this._emptyBuffer;
			this._texture.upload();
		}
	}
	update(frame, view) {
		if (!this._usage) return;
		let depthInfoCpu = null;
		let depthInfoGpu = null;
		if (this._usage === XRDEPTHSENSINGUSAGE_CPU && view) {
			depthInfoCpu = frame.getDepthInformation(view);
		} else if (this._usage === XRDEPTHSENSINGUSAGE_GPU && view) {
			depthInfoGpu = frame.getDepthInformation(view);
		}
		if (this._depthInfoCpu && !depthInfoCpu || !this._depthInfoCpu && depthInfoCpu || this.depthInfoGpu && !depthInfoGpu || !this._depthInfoGpu && depthInfoGpu) {
			this._matrixDirty = true;
		}
		this._depthInfoCpu = depthInfoCpu;
		this._depthInfoGpu = depthInfoGpu;
		this._updateTexture();
		if (this._matrixDirty) {
			this._matrixDirty = false;
			const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
			if (depthInfo) {
				this._matrix.data.set(depthInfo.normDepthBufferFromNormView.matrix);
			} else {
				this._matrix.setIdentity();
			}
		}
		if ((this._depthInfoCpu || this._depthInfoGpu) && !this._available) {
			this._available = true;
			this.fire('available');
		} else if (!this._depthInfoCpu && !this._depthInfoGpu && this._available) {
			this._available = false;
			this.fire('unavailable');
		}
	}
	getDepth(u, v) {
		if (!this._depthInfoCpu) return null;
		return this._depthInfoCpu.getDepthInMeters(u, v);
	}
	get supported() {
		return platform.browser && !!window.XRDepthInformation;
	}
	get available() {
		return this._available;
	}
	get usage() {
		return this._usage;
	}
	get dataFormat() {
		return this._dataFormat;
	}
	get width() {
		const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
		return depthInfo && depthInfo.width || 0;
	}
	get height() {
		const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
		return depthInfo && depthInfo.height || 0;
	}
	get texture() {
		return this._texture;
	}
	get uvMatrix() {
		return this._matrix;
	}
	get rawValueToMeters() {
		const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
		return depthInfo && depthInfo.rawValueToMeters || 0;
	}
}

export { XrDepthSensing };
