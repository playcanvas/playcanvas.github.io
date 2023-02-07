/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, SHADERSTAGE_COMPUTE } from '../constants.js';

class WebgpuUtils {
	static shaderStage(stage) {
		let ret = 0;
		if (stage & SHADERSTAGE_VERTEX) ret |= GPUShaderStage.VERTEX;
		if (stage & SHADERSTAGE_FRAGMENT) ret |= GPUShaderStage.FRAGMENT;
		if (stage & SHADERSTAGE_COMPUTE) ret |= GPUShaderStage.COMPUTE;
		return ret;
	}
}

export { WebgpuUtils };
