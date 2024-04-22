import { FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';

const _colorUniformNames = ['uSceneColorMap', 'texture_grabPass'];
class RenderPassColorGrab extends RenderPass {
  constructor(...args) {
    super(...args);
    this.colorRenderTarget = null;
    this.source = null;
  }
  destroy() {
    super.destroy();
    this.releaseRenderTarget(this.colorRenderTarget);
  }
  shouldReallocate(targetRT, sourceTexture, sourceFormat) {
    const targetFormat = targetRT == null ? void 0 : targetRT.colorBuffer.format;
    if (targetFormat !== sourceFormat) return true;
    const width = (sourceTexture == null ? void 0 : sourceTexture.width) || this.device.width;
    const height = (sourceTexture == null ? void 0 : sourceTexture.height) || this.device.height;
    return !targetRT || width !== targetRT.width || height !== targetRT.height;
  }
  allocateRenderTarget(renderTarget, sourceRenderTarget, device, format) {
    const mipmaps = device.isWebGL2;
    const texture = new Texture(device, {
      name: _colorUniformNames[0],
      format,
      width: sourceRenderTarget ? sourceRenderTarget.colorBuffer.width : device.width,
      height: sourceRenderTarget ? sourceRenderTarget.colorBuffer.height : device.height,
      mipmaps,
      minFilter: mipmaps ? FILTER_LINEAR_MIPMAP_LINEAR : FILTER_LINEAR,
      magFilter: FILTER_LINEAR,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    if (renderTarget) {
      renderTarget.destroyFrameBuffers();
      renderTarget._colorBuffer = texture;
      renderTarget._colorBuffers = [texture];
    } else {
      renderTarget = new RenderTarget({
        name: 'ColorGrabRT',
        colorBuffer: texture,
        depth: false,
        stencil: false,
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
  frameUpdate() {
    var _sourceRt$colorBuffer;
    const device = this.device;
    const sourceRt = this.source;
    const sourceFormat = (_sourceRt$colorBuffer = sourceRt == null ? void 0 : sourceRt.colorBuffer.format) != null ? _sourceRt$colorBuffer : this.device.backBufferFormat;
    if (this.shouldReallocate(this.colorRenderTarget, sourceRt == null ? void 0 : sourceRt.colorBuffer, sourceFormat)) {
      this.releaseRenderTarget(this.colorRenderTarget);
      this.colorRenderTarget = this.allocateRenderTarget(this.colorRenderTarget, sourceRt, device, sourceFormat);
    }
    const colorBuffer = this.colorRenderTarget.colorBuffer;
    _colorUniformNames.forEach(name => device.scope.resolve(name).setValue(colorBuffer));
  }
  execute() {
    const device = this.device;
    const sourceRt = this.source;
    const colorBuffer = this.colorRenderTarget.colorBuffer;
    if (device.isWebGPU) {
      device.copyRenderTarget(sourceRt, this.colorRenderTarget, true, false);
      device.mipmapRenderer.generate(this.colorRenderTarget.colorBuffer.impl);
    } else if (device.isWebGL2) {
      device.copyRenderTarget(sourceRt, this.colorRenderTarget, true, false);
      device.activeTexture(device.maxCombinedTextures - 1);
      device.bindTexture(colorBuffer);
      device.gl.generateMipmap(colorBuffer.impl._glTarget);
    } else {
      if (!colorBuffer.impl._glTexture) {
        colorBuffer.impl.initialize(device, colorBuffer);
      }
      device.bindTexture(colorBuffer);
      const gl = device.gl;
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, colorBuffer.impl._glFormat, 0, 0, colorBuffer.width, colorBuffer.height, 0);
      colorBuffer._needsUpload = false;
      colorBuffer._needsMipmapsUpload = false;
    }
  }
}

export { RenderPassColorGrab };
