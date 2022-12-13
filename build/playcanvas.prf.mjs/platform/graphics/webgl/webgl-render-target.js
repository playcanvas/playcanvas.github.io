/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../../../core/tracing.js';

class WebglRenderTarget {
  constructor() {
    this._glFrameBuffer = null;
    this._glDepthBuffer = null;
    this._glResolveFrameBuffer = null;
    this._glMsaaColorBuffer = null;
    this._glMsaaDepthBuffer = null;
  }
  destroy(device) {
    const gl = device.gl;
    if (this._glFrameBuffer) {
      gl.deleteFramebuffer(this._glFrameBuffer);
      this._glFrameBuffer = null;
    }
    if (this._glDepthBuffer) {
      gl.deleteRenderbuffer(this._glDepthBuffer);
      this._glDepthBuffer = null;
    }
    if (this._glResolveFrameBuffer) {
      gl.deleteFramebuffer(this._glResolveFrameBuffer);
      this._glResolveFrameBuffer = null;
    }
    if (this._glMsaaColorBuffer) {
      gl.deleteRenderbuffer(this._glMsaaColorBuffer);
      this._glMsaaColorBuffer = null;
    }
    if (this._glMsaaDepthBuffer) {
      gl.deleteRenderbuffer(this._glMsaaDepthBuffer);
      this._glMsaaDepthBuffer = null;
    }
  }
  get initialized() {
    return this._glFrameBuffer !== null;
  }
  init(device, target) {
    const gl = device.gl;

    this._glFrameBuffer = gl.createFramebuffer();
    device.setFramebuffer(this._glFrameBuffer);

    const colorBuffer = target._colorBuffer;
    if (colorBuffer) {
      if (!colorBuffer.impl._glTexture) {
        colorBuffer._width = Math.min(colorBuffer.width, device.maxRenderBufferSize);
        colorBuffer._height = Math.min(colorBuffer.height, device.maxRenderBufferSize);
        device.setTexture(colorBuffer, 0);
      }
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, colorBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, colorBuffer.impl._glTexture, 0);
    }
    const depthBuffer = target._depthBuffer;
    if (depthBuffer) {
      if (!depthBuffer.impl._glTexture) {
        depthBuffer._width = Math.min(depthBuffer.width, device.maxRenderBufferSize);
        depthBuffer._height = Math.min(depthBuffer.height, device.maxRenderBufferSize);
        device.setTexture(depthBuffer, 0);
      }
      if (target._stencil) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, depthBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, target._depthBuffer.impl._glTexture, 0);
      } else {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, depthBuffer._cubemap ? gl.TEXTURE_CUBE_MAP_POSITIVE_X + target._face : gl.TEXTURE_2D, target._depthBuffer.impl._glTexture, 0);
      }
    } else if (target._depth) {
      const willRenderMsaa = target._samples > 1 && device.webgl2;
      if (!willRenderMsaa) {
        if (!this._glDepthBuffer) {
          this._glDepthBuffer = gl.createRenderbuffer();
        }
        gl.bindRenderbuffer(gl.RENDERBUFFER, this._glDepthBuffer);
        if (target._stencil) {
          gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, target.width, target.height);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._glDepthBuffer);
        } else {
          const depthFormat = device.webgl2 ? gl.DEPTH_COMPONENT32F : gl.DEPTH_COMPONENT16;
          gl.renderbufferStorage(gl.RENDERBUFFER, depthFormat, target.width, target.height);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._glDepthBuffer);
        }
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      }
    }

    if (device.webgl2 && target._samples > 1) {
      this._glResolveFrameBuffer = this._glFrameBuffer;

      this._glFrameBuffer = gl.createFramebuffer();
      device.setFramebuffer(this._glFrameBuffer);

      if (colorBuffer) {
        if (!this._glMsaaColorBuffer) {
          this._glMsaaColorBuffer = gl.createRenderbuffer();
        }
        gl.bindRenderbuffer(gl.RENDERBUFFER, this._glMsaaColorBuffer);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, colorBuffer.impl._glInternalFormat, target.width, target.height);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this._glMsaaColorBuffer);
      }

      if (target._depth) {
        if (!this._glMsaaDepthBuffer) {
          this._glMsaaDepthBuffer = gl.createRenderbuffer();
        }
        gl.bindRenderbuffer(gl.RENDERBUFFER, this._glMsaaDepthBuffer);
        if (target._stencil) {
          gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH24_STENCIL8, target.width, target.height);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this._glMsaaDepthBuffer);
        } else {
          gl.renderbufferStorageMultisample(gl.RENDERBUFFER, target._samples, gl.DEPTH_COMPONENT32F, target.width, target.height);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this._glMsaaDepthBuffer);
        }
      }
    }
  }

  _checkFbo(device, target, type = '') {
    const gl = device.gl;
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    switch (status) {
      case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
        break;
      case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
        break;
      case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
        break;
      case gl.FRAMEBUFFER_UNSUPPORTED:
        break;
    }
  }
  loseContext() {
    this._glFrameBuffer = null;
    this._glDepthBuffer = null;
    this._glResolveFrameBuffer = null;
    this._glMsaaColorBuffer = null;
    this._glMsaaDepthBuffer = null;
  }
  resolve(device, target, color, depth) {
    if (device.webgl2) {
      const gl = device.gl;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this._glFrameBuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this._glResolveFrameBuffer);
      gl.blitFramebuffer(0, 0, target.width, target.height, 0, 0, target.width, target.height, (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0), gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._glFrameBuffer);
    }
  }
}

export { WebglRenderTarget };
