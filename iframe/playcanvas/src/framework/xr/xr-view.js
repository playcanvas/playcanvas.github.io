import { EventHandler } from '../../core/event-handler.js';
import { Texture } from '../../platform/graphics/texture.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { PIXELFORMAT_RGB8, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR } from '../../platform/graphics/constants.js';

class XrView extends EventHandler {
  constructor(manager, xrView, viewsCount) {
    super();
    this._manager = void 0;
    this._xrView = void 0;
    this._positionData = new Float32Array(3);
    this._viewport = new Vec4();
    this._projMat = new Mat4();
    this._projViewOffMat = new Mat4();
    this._viewMat = new Mat4();
    this._viewOffMat = new Mat4();
    this._viewMat3 = new Mat3();
    this._viewInvMat = new Mat4();
    this._viewInvOffMat = new Mat4();
    this._xrCamera = null;
    this._textureColor = null;
    this._textureDepth = null;
    this._depthInfo = null;
    this._emptyDepthBuffer = new Uint8Array(32);
    this._depthMatrix = new Mat4();
    this._manager = manager;
    this._xrView = xrView;
    const device = this._manager.app.graphicsDevice;
    if (this._manager.views.supportedColor) {
      this._xrCamera = this._xrView.camera;
      if (this._manager.views.availableColor && this._xrCamera) {
        this._textureColor = new Texture(device, {
          format: PIXELFORMAT_RGB8,
          mipmaps: false,
          addressU: ADDRESS_CLAMP_TO_EDGE,
          addressV: ADDRESS_CLAMP_TO_EDGE,
          minFilter: FILTER_LINEAR,
          magFilter: FILTER_LINEAR,
          width: this._xrCamera.width,
          height: this._xrCamera.height,
          name: `XrView-${this._xrView.eye}-Color`
        });
      }
    }
    if (this._manager.views.supportedDepth && this._manager.views.availableDepth) {
      this._textureDepth = new Texture(device, {
        format: this._manager.views.depthPixelFormat,
        arrayLength: viewsCount === 1 ? 0 : viewsCount,
        mipmaps: false,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        width: 4,
        height: 4,
        name: `XrView-${this._xrView.eye}-Depth`
      });
      for (let i = 0; i < this._textureDepth._levels.length; i++) {
        this._textureDepth._levels[i] = this._emptyDepthBuffer;
      }
    }
    if (this._textureColor || this._textureDepth) device.on('devicelost', this._onDeviceLost, this);
  }
  get textureColor() {
    return this._textureColor;
  }
  get textureDepth() {
    return this._textureDepth;
  }
  get depthUvMatrix() {
    return this._depthMatrix;
  }
  get depthValueToMeters() {
    var _this$_depthInfo;
    return ((_this$_depthInfo = this._depthInfo) == null ? void 0 : _this$_depthInfo.rawValueToMeters) || 0;
  }
  get eye() {
    return this._xrView.eye;
  }
  get viewport() {
    return this._viewport;
  }
  get projMat() {
    return this._projMat;
  }
  get projViewOffMat() {
    return this._projViewOffMat;
  }
  get viewOffMat() {
    return this._viewOffMat;
  }
  get viewInvOffMat() {
    return this._viewInvOffMat;
  }
  get viewMat3() {
    return this._viewMat3;
  }
  get positionData() {
    return this._positionData;
  }
  update(frame, xrView) {
    this._xrView = xrView;
    if (this._manager.views.availableColor) this._xrCamera = this._xrView.camera;
    const layer = frame.session.renderState.baseLayer;
    const viewport = layer.getViewport(this._xrView);
    this._viewport.x = viewport.x;
    this._viewport.y = viewport.y;
    this._viewport.z = viewport.width;
    this._viewport.w = viewport.height;
    this._projMat.set(this._xrView.projectionMatrix);
    this._viewMat.set(this._xrView.transform.inverse.matrix);
    this._viewInvMat.set(this._xrView.transform.matrix);
    this._updateTextureColor();
    this._updateDepth(frame);
  }
  _updateTextureColor() {
    if (!this._manager.views.availableColor || !this._xrCamera || !this._textureColor) return;
    const binding = this._manager.webglBinding;
    if (!binding) return;
    const texture = binding.getCameraImage(this._xrCamera);
    if (!texture) return;
    const device = this._manager.app.graphicsDevice;
    const gl = device.gl;
    if (!this._frameBufferSource) {
      this._frameBufferSource = gl.createFramebuffer();
      this._frameBuffer = gl.createFramebuffer();
    } else {
      var _device$extDrawBuffer, _device$extDrawBuffer2;
      const attachmentBaseConstant = device.isWebGL2 ? gl.COLOR_ATTACHMENT0 : (_device$extDrawBuffer = (_device$extDrawBuffer2 = device.extDrawBuffers) == null ? void 0 : _device$extDrawBuffer2.COLOR_ATTACHMENT0_WEBGL) != null ? _device$extDrawBuffer : gl.COLOR_ATTACHMENT0;
      const width = this._xrCamera.width;
      const height = this._xrCamera.height;
      device.setFramebuffer(this._frameBufferSource);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentBaseConstant, gl.TEXTURE_2D, texture, 0);
      device.setFramebuffer(this._frameBuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentBaseConstant, gl.TEXTURE_2D, this._textureColor.impl._glTexture, 0);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._frameBufferSource);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._frameBuffer);
      gl.blitFramebuffer(0, height, width, 0, 0, 0, width, height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
  }
  _updateDepth(frame) {
    var _this$_depthInfo2, _this$_depthInfo3;
    if (!this._manager.views.availableDepth || !this._textureDepth) return;
    const gpu = this._manager.views.depthGpuOptimized;
    const infoSource = gpu ? this._manager.webglBinding : frame;
    if (!infoSource) {
      this._depthInfo = null;
      return;
    }
    const depthInfo = infoSource.getDepthInformation(this._xrView);
    if (!depthInfo) {
      this._depthInfo = null;
      return;
    }
    let matrixDirty = !this._depthInfo !== !depthInfo;
    this._depthInfo = depthInfo;
    const width = ((_this$_depthInfo2 = this._depthInfo) == null ? void 0 : _this$_depthInfo2.width) || 4;
    const height = ((_this$_depthInfo3 = this._depthInfo) == null ? void 0 : _this$_depthInfo3.height) || 4;
    let resized = false;
    if (this._textureDepth.width !== width || this._textureDepth.height !== height) {
      this._textureDepth._width = width;
      this._textureDepth._height = height;
      matrixDirty = true;
      resized = true;
    }
    if (matrixDirty) {
      if (this._depthInfo) {
        this._depthMatrix.data.set(this._depthInfo.normDepthBufferFromNormView.matrix);
      } else {
        this._depthMatrix.setIdentity();
      }
    }
    if (this._depthInfo) {
      if (gpu) {
        if (this._depthInfo.texture) {
          this._textureDepth.impl._glTexture = this._depthInfo.texture;
        }
      } else {
        this._textureDepth._levels[0] = new Uint8Array(this._depthInfo.data);
        this._textureDepth.upload();
      }
    } else {
      this._textureDepth._levels[0] = this._emptyDepthBuffer;
      this._textureDepth.upload();
    }
    if (resized) this.fire('depth:resize', width, height);
  }
  updateTransforms(transform) {
    if (transform) {
      this._viewInvOffMat.mul2(transform, this._viewInvMat);
      this.viewOffMat.copy(this._viewInvOffMat).invert();
    } else {
      this._viewInvOffMat.copy(this._viewInvMat);
      this.viewOffMat.copy(this._viewMat);
    }
    this._viewMat3.setFromMat4(this._viewOffMat);
    this._projViewOffMat.mul2(this._projMat, this._viewOffMat);
    this._positionData[0] = this._viewInvOffMat.data[12];
    this._positionData[1] = this._viewInvOffMat.data[13];
    this._positionData[2] = this._viewInvOffMat.data[14];
  }
  _onDeviceLost() {
    this._frameBufferSource = null;
    this._frameBuffer = null;
    this._depthInfo = null;
  }
  getDepth(u, v) {
    var _this$_depthInfo$getD, _this$_depthInfo4;
    if (this._manager.views.depthGpuOptimized) return null;
    return (_this$_depthInfo$getD = (_this$_depthInfo4 = this._depthInfo) == null ? void 0 : _this$_depthInfo4.getDepthInMeters(u, v)) != null ? _this$_depthInfo$getD : null;
  }
  destroy() {
    this._depthInfo = null;
    if (this._textureColor) {
      this._textureColor.destroy();
      this._textureColor = null;
    }
    if (this._textureDepth) {
      this._textureDepth.destroy();
      this._textureDepth = null;
    }
    if (this._frameBufferSource) {
      const gl = this._manager.app.graphicsDevice.gl;
      gl.deleteFramebuffer(this._frameBufferSource);
      this._frameBufferSource = null;
      gl.deleteFramebuffer(this._frameBuffer);
      this._frameBuffer = null;
    }
  }
}
XrView.EVENT_DEPTHRESIZE = 'depth:resize';

export { XrView };
