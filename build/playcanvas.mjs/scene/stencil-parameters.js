import { FUNC_ALWAYS, STENCILOP_KEEP } from '../platform/graphics/constants.js';

class StencilParameters {
	constructor(options) {
		var _options$func, _options$ref, _options$readMask, _options$writeMask, _options$fail, _options$zfail, _options$zpass;
		this.func = void 0;
		this.ref = void 0;
		this.fail = void 0;
		this.zfail = void 0;
		this.zpass = void 0;
		this.readMask = void 0;
		this.writeMask = void 0;
		this.func = (_options$func = options.func) != null ? _options$func : FUNC_ALWAYS;
		this.ref = (_options$ref = options.ref) != null ? _options$ref : 0;
		this.readMask = (_options$readMask = options.readMask) != null ? _options$readMask : 0xFF;
		this.writeMask = (_options$writeMask = options.writeMask) != null ? _options$writeMask : 0xFF;
		this.fail = (_options$fail = options.fail) != null ? _options$fail : STENCILOP_KEEP;
		this.zfail = (_options$zfail = options.zfail) != null ? _options$zfail : STENCILOP_KEEP;
		this.zpass = (_options$zpass = options.zpass) != null ? _options$zpass : STENCILOP_KEEP;
	}
	clone() {
		return new StencilParameters({
			func: this.func,
			ref: this.ref,
			readMask: this.readMask,
			writeMask: this.writeMask,
			fail: this.fail,
			zfail: this.zfail,
			zpass: this.zpass
		});
	}
}

export { StencilParameters };
