/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, SEMANTIC_COLOR, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT } from './constants.js';
import gles2PS from './shader-chunks/frag/gles2.js';
import gles3PS from './shader-chunks/frag/gles3.js';
import gles3VS from './shader-chunks/vert/gles3.js';
import webgpuPS from './shader-chunks/frag/webgpu.js';
import webgpuVS from './shader-chunks/vert/webgpu.js';
import sharedFS from './shader-chunks/frag/shared.js';

const _attrib2Semantic = {
	vertex_position: SEMANTIC_POSITION,
	vertex_normal: SEMANTIC_NORMAL,
	vertex_tangent: SEMANTIC_TANGENT,
	vertex_texCoord0: SEMANTIC_TEXCOORD0,
	vertex_texCoord1: SEMANTIC_TEXCOORD1,
	vertex_texCoord2: SEMANTIC_TEXCOORD2,
	vertex_texCoord3: SEMANTIC_TEXCOORD3,
	vertex_texCoord4: SEMANTIC_TEXCOORD4,
	vertex_texCoord5: SEMANTIC_TEXCOORD5,
	vertex_texCoord6: SEMANTIC_TEXCOORD6,
	vertex_texCoord7: SEMANTIC_TEXCOORD7,
	vertex_color: SEMANTIC_COLOR,
	vertex_boneIndices: SEMANTIC_BLENDINDICES,
	vertex_boneWeights: SEMANTIC_BLENDWEIGHT
};
class ShaderUtils {
	static createDefinition(device, options) {
		var _options$name, _options$attributes;
		const getDefines = (gpu, gl2, gl1, isVertex) => {
			return device.isWebGPU ? gpu : device.webgl2 ? gl2 : ShaderUtils.gl1Extensions(device, options) + gl1;
		};
		const name = (_options$name = options.name) != null ? _options$name : 'Untitled';
		const vertDefines = options.vertexDefines || getDefines(webgpuVS, gles3VS, '');
		const vertCode = ShaderUtils.versionCode(device) + vertDefines + sharedFS + ShaderUtils.getShaderNameCode(name) + options.vertexCode;
		const fragDefines = options.fragmentDefines || getDefines(webgpuPS, gles3PS, gles2PS);
		const fragCode = (options.fragmentPreamble || '') + ShaderUtils.versionCode(device) + ShaderUtils.precisionCode(device) + '\n' + fragDefines + sharedFS + ShaderUtils.getShaderNameCode(name) + (options.fragmentCode || ShaderUtils.dummyFragmentCode());
		const attribs = (_options$attributes = options.attributes) != null ? _options$attributes : ShaderUtils.collectAttributes(options.vertexCode);
		return {
			name: name,
			attributes: attribs,
			vshader: vertCode,
			fshader: fragCode,
			useTransformFeedback: options.useTransformFeedback
		};
	}
	static getShaderNameCode(name) {
		return `#define SHADER_NAME ${name}\n`;
	}
	static gl1Extensions(device, options, isVertex) {
		let code;
		if (isVertex) {
			code = options.vertexExtensions ? `${options.vertexExtensions}\n` : '';
		} else {
			code = options.fragmentExtensions ? `${options.fragmentExtensions}\n` : '';
			if (device.extStandardDerivatives) {
				code += "#extension GL_OES_standard_derivatives : enable\n";
			}
			if (device.extTextureLod) {
				code += "#extension GL_EXT_shader_texture_lod : enable\n";
				code += "#define SUPPORTS_TEXLOD\n";
			}
		}
		return code;
	}
	static dummyFragmentCode() {
		return "void main(void) {gl_FragColor = vec4(0.0);}";
	}
	static versionCode(device) {
		if (device.isWebGPU) {
			return '#version 450\n';
		}
		return device.webgl2 ? "#version 300 es\n" : "";
	}
	static precisionCode(device, forcePrecision) {
		let code = '';
		if (forcePrecision && forcePrecision !== 'highp' && forcePrecision !== 'mediump' && forcePrecision !== 'lowp') {
			forcePrecision = null;
		}
		if (forcePrecision) {
			if (forcePrecision === 'highp' && device.maxPrecision !== 'highp') {
				forcePrecision = 'mediump';
			}
			if (forcePrecision === 'mediump' && device.maxPrecision === 'lowp') {
				forcePrecision = 'lowp';
			}
		}
		const precision = forcePrecision ? forcePrecision : device.precision;
		if (!device.isWebGPU) {
			code = `precision ${precision} float;\n`;
			if (device.webgl2) {
				code += `precision ${precision} sampler2DShadow;\n`;
			}
		} else {
			code = `precision ${precision} float;\nprecision ${precision} int;\n`;
		}
		return code;
	}
	static collectAttributes(vsCode) {
		const attribs = {};
		let attrs = 0;
		let found = vsCode.indexOf("attribute");
		while (found >= 0) {
			if (found > 0 && vsCode[found - 1] === "/") break;
			const endOfLine = vsCode.indexOf(';', found);
			const startOfAttribName = vsCode.lastIndexOf(' ', endOfLine);
			const attribName = vsCode.substring(startOfAttribName + 1, endOfLine);
			const semantic = _attrib2Semantic[attribName];
			if (semantic !== undefined) {
				attribs[attribName] = semantic;
			} else {
				attribs[attribName] = "ATTR" + attrs;
				attrs++;
			}
			found = vsCode.indexOf("attribute", found + 1);
		}
		return attribs;
	}
}

export { ShaderUtils };
