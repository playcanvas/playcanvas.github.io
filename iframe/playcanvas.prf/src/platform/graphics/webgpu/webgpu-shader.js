import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { ShaderProcessor } from '../shader-processor.js';

class WebgpuShader {
  constructor(shader) {
    this._vertexCode = null;
    this._fragmentCode = null;
    this._computeCode = null;
    this.vertexEntryPoint = 'main';
    this.fragmentEntryPoint = 'main';
    this.computeEntryPoint = 'main';
    this.shader = shader;
    const definition = shader.definition;
    if (definition.shaderLanguage === SHADERLANGUAGE_WGSL) {
      var _definition$vshader, _definition$fshader, _definition$cshader;
      this._vertexCode = (_definition$vshader = definition.vshader) != null ? _definition$vshader : null;
      this._fragmentCode = (_definition$fshader = definition.fshader) != null ? _definition$fshader : null;
      this._computeCode = (_definition$cshader = definition.cshader) != null ? _definition$cshader : null;
      this.meshUniformBufferFormat = definition.meshUniformBufferFormat;
      this.meshBindGroupFormat = definition.meshBindGroupFormat;
      this.computeUniformBufferFormats = definition.computeUniformBufferFormats;
      this.computeBindGroupFormat = definition.computeBindGroupFormat;
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
  getComputeShaderModule() {
    return this.createShaderModule(this._computeCode, 'Compute');
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
      console.error(`Failed to transpile webgl ${shaderType} shader [${this.shader.label}] to WebGPU: [${err.message}] while rendering ${void 0}`, {
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
