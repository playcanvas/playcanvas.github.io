import { QuadRender } from './quad-render.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { CULLFACE_NONE, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { createShaderFromCode } from '../shader-lib/utils.js';

class RenderPassShaderQuad extends RenderPass {
  constructor(...args) {
    super(...args);
    this._shader = null;
    this.quadRender = null;
    this.cullMode = CULLFACE_NONE;
    this.blendState = BlendState.NOBLEND;
    this.depthState = DepthState.NODEPTH;
    this.stencilFront = null;
    this.stencilBack = null;
  }
  set shader(shader) {
    var _this$quadRender, _this$_shader;
    (_this$quadRender = this.quadRender) == null || _this$quadRender.destroy();
    this.quadRender = null;
    (_this$_shader = this._shader) == null || _this$_shader.destroy();
    this._shader = shader;
    if (shader) this.quadRender = new QuadRender(shader);
  }
  get shader() {
    return this._shader;
  }
  createQuadShader(name, fs, shaderDefinitionOptions = {}) {
    return createShaderFromCode(this.device, RenderPassShaderQuad.quadVertexShader, fs, name, {
      aPosition: SEMANTIC_POSITION
    }, shaderDefinitionOptions);
  }
  destroy() {
    var _this$shader;
    (_this$shader = this.shader) == null || _this$shader.destroy();
    this.shader = null;
  }
  execute() {
    const device = this.device;
    device.setBlendState(this.blendState);
    device.setCullMode(this.cullMode);
    device.setDepthState(this.depthState);
    device.setStencilState(this.stencilFront, this.stencilBack);
    this.quadRender.render();
  }
}
RenderPassShaderQuad.quadVertexShader = `
        attribute vec2 aPosition;
        varying vec2 uv0;
        void main(void)
        {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            uv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);
        }
    `;

export { RenderPassShaderQuad };
