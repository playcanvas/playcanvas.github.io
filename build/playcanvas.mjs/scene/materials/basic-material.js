import '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { SHADERDEF_SKIN, SHADERDEF_SCREENSPACE, SHADERDEF_INSTANCING, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED } from '../constants.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { basic } from '../shader-lib/programs/basic.js';
import { Material } from './material.js';

class BasicMaterial extends Material {
	constructor() {
		super();
		this.color = new Color(1, 1, 1, 1);
		this.colorUniform = new Float32Array(4);
		this.colorMap = null;
		this.vertexColors = false;
	}
	copy(source) {
		super.copy(source);
		this.color.copy(source.color);
		this.colorMap = source.colorMap;
		this.vertexColors = source.vertexColors;
		return this;
	}
	updateUniforms(device, scene) {
		this.clearParameters();
		this.colorUniform[0] = this.color.r;
		this.colorUniform[1] = this.color.g;
		this.colorUniform[2] = this.color.b;
		this.colorUniform[3] = this.color.a;
		this.setParameter('uColor', this.colorUniform);
		if (this.colorMap) {
			this.setParameter('texture_diffuseMap', this.colorMap);
		}
	}
	getShaderVariant(device, scene, objDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {
		if (this.updateShader) {
			this.updateShader(device, scene, objDefs, staticLightList, pass, sortedLights);
			return this.shader;
		}
		const options = {
			skin: objDefs && (objDefs & SHADERDEF_SKIN) !== 0,
			screenSpace: objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0,
			useInstancing: objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0,
			useMorphPosition: objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0,
			useMorphNormal: objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0,
			useMorphTextureBased: objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0,
			alphaTest: this.alphaTest > 0,
			vertexColors: this.vertexColors,
			diffuseMap: !!this.colorMap,
			pass: pass
		};
		const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);
		const library = getProgramLibrary(device);
		library.register('basic', basic);
		return library.getProgram('basic', options, processingOptions);
	}
}

export { BasicMaterial };
