import { FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F } from '../../platform/graphics/constants.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';

const _depthUniformNames = ['uSceneDepthMap', 'uDepthMap'];
class RenderPassDepthGrab extends RenderPass {
  constructor(device, camera) {
    super(device);
    this.depthRenderTarget = null;
    this.camera = null;
    this.camera = camera;
  }
  destroy() {
    super.destroy();
    this.releaseRenderTarget(this.depthRenderTarget);
  }
  shouldReallocate(targetRT, sourceTexture) {
    const width = (sourceTexture == null ? void 0 : sourceTexture.width) || this.device.width;
    const height = (sourceTexture == null ? void 0 : sourceTexture.height) || this.device.height;
    return !targetRT || width !== targetRT.width || height !== targetRT.height;
  }
  allocateRenderTarget(renderTarget, sourceRenderTarget, device, format, isDepth) {
    const texture = new Texture(device, {
      name: _depthUniformNames[0],
      format,
      width: sourceRenderTarget ? sourceRenderTarget.colorBuffer.width : device.width,
      height: sourceRenderTarget ? sourceRenderTarget.colorBuffer.height : device.height,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    if (renderTarget) {
      renderTarget.destroyFrameBuffers();
      if (isDepth) {
        renderTarget._depthBuffer = texture;
      } else {
        renderTarget._colorBuffer = texture;
        renderTarget._colorBuffers = [texture];
      }
    } else {
      renderTarget = new RenderTarget({
        name: 'DepthGrabRT',
        colorBuffer: isDepth ? null : texture,
        depthBuffer: isDepth ? texture : null,
        depth: !isDepth,
        stencil: device.supportsStencil,
        autoResolve: false
      });
    }
    return renderTarget;
  }
  releaseRenderTarget(rt) {
    if (rt) {
      rt.destroyTextureBuffers();
      rt.destroy();
    }
  }
  before() {
    var _camera$renderTarget, _camera$renderTarget$, _camera$renderTarget2, _camera$renderTarget3;
    const camera = this.camera;
    const device = this.device;
    const destinationRt = (_camera$renderTarget = camera == null ? void 0 : camera.renderTarget) != null ? _camera$renderTarget : device.backBuffer;
    let useDepthBuffer = true;
    let format = destinationRt.stencil ? PIXELFORMAT_DEPTHSTENCIL : PIXELFORMAT_DEPTH;
    if (device.isWebGPU) {
      const numSamples = destinationRt.samples;
      if (numSamples > 1) {
        format = PIXELFORMAT_R32F;
        useDepthBuffer = false;
      }
    }
    const sourceTexture = (_camera$renderTarget$ = (_camera$renderTarget2 = camera.renderTarget) == null ? void 0 : _camera$renderTarget2.depthBuffer) != null ? _camera$renderTarget$ : (_camera$renderTarget3 = camera.renderTarget) == null ? void 0 : _camera$renderTarget3.colorBuffer;
    if (this.shouldReallocate(this.depthRenderTarget, sourceTexture)) {
      this.releaseRenderTarget(this.depthRenderTarget);
      this.depthRenderTarget = this.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, format, useDepthBuffer);
    }
    const colorBuffer = useDepthBuffer ? this.depthRenderTarget.depthBuffer : this.depthRenderTarget.colorBuffer;
    _depthUniformNames.forEach(name => device.scope.resolve(name).setValue(colorBuffer));
  }
  execute() {
    const device = this.device;
    if (device.isWebGL2 && device.renderTarget.samples > 1) {
      const src = device.renderTarget.impl._glFrameBuffer;
      const dest = this.depthRenderTarget;
      device.renderTarget = dest;
      device.updateBegin();
      this.depthRenderTarget.impl.internalResolve(device, src, dest.impl._glFrameBuffer, this.depthRenderTarget, device.gl.DEPTH_BUFFER_BIT);
    } else {
      device.copyRenderTarget(device.renderTarget, this.depthRenderTarget, false, true);
    }
  }
}

export { RenderPassDepthGrab };
