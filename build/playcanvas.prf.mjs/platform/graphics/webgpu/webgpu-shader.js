/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../../core/tracing.js';
import { ShaderProcessor } from '../shader-processor.js';

class WebgpuShader {
	constructor(shader) {
		this._vertexCode = void 0;
		this._fragmentCode = void 0;
		this.shader = shader;
		const definition = shader.definition;
		if (definition.processingOptions) {
			this.process();
		}
	}
	destroy(shader) {
		this._vertexCode = null;
		this._fragmentCode = null;
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
