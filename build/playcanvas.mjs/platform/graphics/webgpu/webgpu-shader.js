import '../../../core/debug.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { ShaderProcessor } from '../shader-processor.js';
import './webgpu-debug.js';

class WebgpuShader {
	constructor(shader) {
		this._vertexCode = void 0;
		this._fragmentCode = void 0;
		this.vertexEntryPoint = 'main';
		this.fragmentEntryPoint = 'main';
		this.shader = shader;
		const definition = shader.definition;
		if (definition.shaderLanguage === SHADERLANGUAGE_WGSL) {
			this._vertexCode = definition.vshader;
			this._fragmentCode = definition.fshader;
			this.vertexEntryPoint = 'vertexMain';
			this.fragmentEntryPoint = 'fragmentMain';
			shader.ready = true;
		} else {
			if (definition.processingOptions) {
				this.process();
			}
		}
	}
	destroy(shader) {
		this._vertexCode = null;
		this._fragmentCode = null;
	}
	createShaderModule(code, shaderType) {
		const device = this.shader.device;
		const wgpu = device.wgpu;
		const shaderModule = wgpu.createShaderModule({
			code: code
		});
		return shaderModule;
	}
	getVertexShaderModule() {
		return this.createShaderModule(this._vertexCode, 'Vertex');
	}
	getFragmentShaderModule() {
		return this.createShaderModule(this._fragmentCode, 'Fragment');
	}
	process() {
		const shader = this.shader;
		const processed = ShaderProcessor.run(shader.device, shader.definition, shader);
		this._vertexCode = this.transpile(processed.vshader, 'vertex', shader.definition.vshader);
		this._fragmentCode = this.transpile(processed.fshader, 'fragment', shader.definition.fshader);
		if (!(this._vertexCode && this._fragmentCode)) {
			shader.failed = true;
		} else {
			shader.ready = true;
		}
		shader.meshUniformBufferFormat = processed.meshUniformBufferFormat;
		shader.meshBindGroupFormat = processed.meshBindGroupFormat;
	}
	transpile(src, shaderType, originalSrc) {
		try {
			const spirv = this.shader.device.glslang.compileGLSL(src, shaderType);
			return this.shader.device.twgsl.convertSpirV2WGSL(spirv);
		} catch (err) {
			console.error(`Failed to transpile webgl ${shaderType} shader [${this.shader.label}] to WebGPU: [${err.message}]`, {
				processed: src,
				original: originalSrc,
				shader: this.shader
			});
		}
	}
	get vertexCode() {
		return this._vertexCode;
	}
	get fragmentCode() {
		return this._fragmentCode;
	}
	loseContext() {}
	restoreContext(device, shader) {}
}

export { WebgpuShader };
