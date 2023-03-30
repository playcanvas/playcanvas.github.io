/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 2cac980a5 (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { BLENDMODE_ONE, BLENDMODE_ZERO, BLENDEQUATION_ADD } from '../constants.js';

class WebgpuRenderState {
	constructor() {
		this.reset();
	}
	reset() {
		this.blendStateDirty = true;
		this.blendStateKey = '';
		this.blending = false;
		this.blendSrcColor = BLENDMODE_ONE;
		this.blendDstColor = BLENDMODE_ZERO;
		this.blendEquationColor = BLENDEQUATION_ADD;
		this.blendEquationAlpha = BLENDEQUATION_ADD;
		this.blendSrcAlpha = BLENDMODE_ONE;
		this.blendDstAlpha = BLENDMODE_ZERO;
		this.writeRed = true;
		this.writeGreen = true;
		this.writeBlue = true;
		this.writeAlpha = true;
	}
	get blendKey() {
		if (this.blendStateDirty) {
			this.blendStateDirty = false;
			this.blendStateKey = `${this.blending}_${this.blendSrcColor}_${this.blendSrcAlpha}`;
			this.blendStateKey += `_${this.blendDstColor}_${this.blendDstAlpha}`;
			this.blendStateKey += `_${this.blendEquationColor}_${this.blendEquationAlpha}`;
		}
		return this.blendStateKey;
	}
	setBlending(blending) {
		if (this.blending !== blending) {
			this.blending = blending;
			this.blendStateDirty = true;
		}
	}
	setBlendFunction(blendSrc, blendDst) {
		if (this.blendSrcColor !== blendSrc || this.blendDstColor !== blendDst || this.blendSrcAlpha !== blendSrc || this.blendDstAlpha !== blendDst) {
			this.blendSrcColor = blendSrc;
			this.blendSrcAlpha = blendSrc;
			this.blendDstColor = blendDst;
			this.blendDstAlpha = blendDst;
			this.blendStateDirty = true;
		}
	}
	setBlendEquation(blendEquation) {
		if (this.blendEquationColor !== blendEquation || this.blendEquationAlpha !== blendEquation) {
			this.blendEquationColor = blendEquation;
			this.blendEquationAlpha = blendEquation;
			this.blendStateDirty = true;
		}
	}
}

export { WebgpuRenderState };
