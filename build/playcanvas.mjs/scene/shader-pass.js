import '../core/tracing.js';
import { SHADER_SHADOW, SHADOW_COUNT, LIGHTTYPE_COUNT, SHADERTYPE_SHADOW, SHADERTYPE_FORWARD, SHADER_PICK, SHADERTYPE_PICK, SHADER_DEPTH, SHADERTYPE_DEPTH, SHADER_FORWARDHDR, SHADER_FORWARD } from './constants.js';

class ShaderPass {
	static getType(shaderPass) {
		switch (shaderPass) {
			case SHADER_FORWARD:
			case SHADER_FORWARDHDR:
				return SHADERTYPE_FORWARD;
			case SHADER_DEPTH:
				return SHADERTYPE_DEPTH;
			case SHADER_PICK:
				return SHADERTYPE_PICK;
			default:
				return shaderPass >= SHADER_SHADOW && shaderPass < SHADER_SHADOW + SHADOW_COUNT * LIGHTTYPE_COUNT ? SHADERTYPE_SHADOW : SHADERTYPE_FORWARD;
		}
	}
	static isForward(pass) {
		return this.getType(pass) === SHADERTYPE_FORWARD;
	}
	static isShadow(pass) {
		return this.getType(pass) === SHADERTYPE_SHADOW;
	}
	static toLightType(pass) {
		const shadowMode = pass - SHADER_SHADOW;
		return Math.floor(shadowMode / SHADOW_COUNT);
	}
	static toShadowType(pass) {
		const shadowMode = pass - SHADER_SHADOW;
		const lightType = Math.floor(shadowMode / SHADOW_COUNT);
		return shadowMode - lightType * SHADOW_COUNT;
	}
	static getShadow(lightType, shadowType) {
		const shadowMode = shadowType + lightType * SHADOW_COUNT;
		const pass = SHADER_SHADOW + shadowMode;
		return pass;
	}
	static getPassShaderDefine(pass) {
		if (pass === SHADER_PICK) {
			return '#define PICK_PASS\n';
		} else if (pass === SHADER_DEPTH) {
			return '#define DEPTH_PASS\n';
		} else if (ShaderPass.isShadow(pass)) {
			return '#define SHADOW_PASS\n';
		}
		return '';
	}
}

export { ShaderPass };
