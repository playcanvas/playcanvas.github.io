import { Vec4 } from '../../core/math/vec4.js';
import { Mat4 } from '../../core/math/mat4.js';
import { CULLFACE_NONE } from '../../platform/graphics/constants.js';
import { LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI } from '../constants.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { QuadRender } from '../graphics/quad-render.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

const textureBlitVertexShader = `
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
        #ifndef WEBGPU
            uv0.y = 1.0 - uv0.y;
        #endif
    }`;
const textureBlitFragmentShader = `
    varying vec2 uv0;
    uniform sampler2D blitTexture;
    void main(void) {
        gl_FragColor = texture2D(blitTexture, uv0);
    }`;
const textureCubeBlitFragmentShader = `
    varying vec2 uv0;
    uniform samplerCube blitTexture;
    uniform mat4 invViewProj;
    void main(void) {
        vec4 projPos = vec4(uv0 * 2.0 - 1.0, 0.5, 1.0);
        vec4 worldPos = invViewProj * projPos;
        gl_FragColor = textureCube(blitTexture, worldPos.xyz);
    }`;
const _viewport = new Vec4();
const _invViewProjMatrices = [];
class RenderPassCookieRenderer extends RenderPass {
  constructor(device, cubeSlotsOffsets) {
    super(device);
    this._quadRenderer2D = null;
    this._quadRendererCube = null;
    this._filteredLights = [];
    this._cubeSlotsOffsets = cubeSlotsOffsets;
    this.requiresCubemaps = false;
    this.blitTextureId = device.scope.resolve('blitTexture');
    this.invViewProjId = device.scope.resolve('invViewProj');
  }
  destroy() {
    var _this$_quadRenderer2D, _this$_quadRendererCu;
    (_this$_quadRenderer2D = this._quadRenderer2D) == null || _this$_quadRenderer2D.destroy();
    this._quadRenderer2D = null;
    (_this$_quadRendererCu = this._quadRendererCube) == null || _this$_quadRendererCu.destroy();
    this._quadRendererCube = null;
  }
  static create(renderTarget, cubeSlotsOffsets) {
    const renderPass = new RenderPassCookieRenderer(renderTarget.device, cubeSlotsOffsets);
    renderPass.init(renderTarget);
    renderPass.colorOps.clear = false;
    renderPass.depthStencilOps.clearDepth = false;
    return renderPass;
  }
  update(lights) {
    const filteredLights = this._filteredLights;
    this.filter(lights, filteredLights);
    this.executeEnabled = filteredLights.length > 0;
  }
  filter(lights, filteredLights) {
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      if (light._type === LIGHTTYPE_DIRECTIONAL) continue;
      if (!light.atlasViewportAllocated) continue;
      if (!light.atlasSlotUpdated) continue;
      if (light.enabled && light.cookie && light.visibleThisFrame) {
        filteredLights.push(light);
      }
    }
  }
  initInvViewProjMatrices() {
    if (!_invViewProjMatrices.length) {
      for (let face = 0; face < 6; face++) {
        const camera = LightCamera.create(null, LIGHTTYPE_OMNI, face);
        const projMat = camera.projectionMatrix;
        const viewMat = camera.node.getLocalTransform().clone().invert();
        _invViewProjMatrices[face] = new Mat4().mul2(projMat, viewMat).invert();
      }
    }
  }
  get quadRenderer2D() {
    if (!this._quadRenderer2D) {
      const shader = createShaderFromCode(this.device, textureBlitVertexShader, textureBlitFragmentShader, `cookieRenderer2d`);
      this._quadRenderer2D = new QuadRender(shader);
    }
    return this._quadRenderer2D;
  }
  get quadRendererCube() {
    if (!this._quadRendererCube) {
      const shader = createShaderFromCode(this.device, textureBlitVertexShader, textureCubeBlitFragmentShader, `cookieRendererCube`);
      this._quadRendererCube = new QuadRender(shader);
    }
    return this._quadRendererCube;
  }
  execute() {
    const device = this.device;
    device.setBlendState(BlendState.NOBLEND);
    device.setCullMode(CULLFACE_NONE);
    device.setDepthState(DepthState.NODEPTH);
    device.setStencilState();
    const renderTargetWidth = this.renderTarget.colorBuffer.width;
    const cubeSlotsOffsets = this._cubeSlotsOffsets;
    const filteredLights = this._filteredLights;
    for (let i = 0; i < filteredLights.length; i++) {
      const light = filteredLights[i];
      const faceCount = light.numShadowFaces;
      const quad = faceCount > 1 ? this.quadRendererCube : this.quadRenderer2D;
      if (faceCount > 1) {
        this.initInvViewProjMatrices();
      }
      this.blitTextureId.setValue(light.cookie);
      for (let face = 0; face < faceCount; face++) {
        _viewport.copy(light.atlasViewport);
        if (faceCount > 1) {
          const smallSize = _viewport.z / 3;
          const offset = cubeSlotsOffsets[face];
          _viewport.x += smallSize * offset.x;
          _viewport.y += smallSize * offset.y;
          _viewport.z = smallSize;
          _viewport.w = smallSize;
          this.invViewProjId.setValue(_invViewProjMatrices[face].data);
        }
        _viewport.mulScalar(renderTargetWidth);
        quad.render(_viewport);
      }
    }
    filteredLights.length = 0;
  }
}

export { RenderPassCookieRenderer };
