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
