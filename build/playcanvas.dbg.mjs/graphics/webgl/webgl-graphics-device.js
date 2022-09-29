/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { setupVertexArrayObject } from '../../polyfill/OESVertexArrayObject.js';
import { Debug } from '../../core/debug.js';
import { platform } from '../../core/platform.js';
import { DEVICETYPE_WEBGL, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, BLENDMODE_ONE, BLENDMODE_ZERO, BLENDEQUATION_ADD, CULLFACE_BACK, FUNC_LESSEQUAL, FUNC_ALWAYS, STENCILOP_KEEP, ADDRESS_CLAMP_TO_EDGE, semanticToLocation, CLEARFLAG_STENCIL, CULLFACE_NONE, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { createShaderFromCode } from '../program-lib/utils.js';
import { drawQuadWithShader } from '../simple-post-effect.js';
import { shaderChunks } from '../program-lib/chunks/chunks.js';
import { RenderTarget } from '../render-target.js';
import { Texture } from '../texture.js';
import { DebugGraphics } from '../debug-graphics.js';
import { WebglVertexBuffer } from './webgl-vertex-buffer.js';
import { WebglIndexBuffer } from './webgl-index-buffer.js';
import { WebglShader } from './webgl-shader.js';
import { WebglTexture } from './webgl-texture.js';
import { WebglRenderTarget } from './webgl-render-target.js';
import { Color } from '../../math/color.js';

const invalidateAttachments = [];

function testRenderable(gl, pixelFormat) {
  let result = true;
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, pixelFormat, null);
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    result = false;
  }

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteTexture(texture);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(framebuffer);
  return result;
}

function testTextureHalfFloatUpdatable(gl, pixelFormat) {
  let result = true;
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const data = new Uint16Array(4 * 2 * 2);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, pixelFormat, data);

  if (gl.getError() !== gl.NO_ERROR) {
    result = false;
    console.log("Above error related to HALF_FLOAT_OES can be ignored, it was triggered by testing half float texture support");
  }

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteTexture(texture);
  return result;
}

function testTextureFloatHighPrecision(device) {
  if (!device.textureFloatRenderable) return false;
  const test1 = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunks.precisionTestPS, "ptest1");
  const test2 = createShaderFromCode(device, shaderChunks.fullscreenQuadVS, shaderChunks.precisionTest2PS, "ptest2");
  const textureOptions = {
    format: PIXELFORMAT_RGBA32F,
    width: 1,
    height: 1,
    mipmaps: false,
    minFilter: FILTER_NEAREST,
    magFilter: FILTER_NEAREST,
    name: 'testFHP'
  };
  const tex1 = new Texture(device, textureOptions);
  const targ1 = new RenderTarget({
    colorBuffer: tex1,
    depth: false
  });
  drawQuadWithShader(device, targ1, test1);
  textureOptions.format = PIXELFORMAT_R8_G8_B8_A8;
  const tex2 = new Texture(device, textureOptions);
  const targ2 = new RenderTarget({
    colorBuffer: tex2,
    depth: false
  });
  device.constantTexSource.setValue(tex1);
  drawQuadWithShader(device, targ2, test2);
  const prevFramebuffer = device.activeFramebuffer;
  device.setFramebuffer(targ2.impl._glFrameBuffer);
  const pixels = new Uint8Array(4);
  device.readPixels(0, 0, 1, 1, pixels);
  device.setFramebuffer(prevFramebuffer);
  const x = pixels[0] / 255;
  const y = pixels[1] / 255;
  const z = pixels[2] / 255;
  const w = pixels[3] / 255;
  const f = x / (256 * 256 * 256) + y / (256 * 256) + z / 256 + w;
  tex1.destroy();
  targ1.destroy();
  tex2.destroy();
  targ2.destroy();
  return f === 0;
}

function testImageBitmap(device) {
  const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 100, 100, 98, 182, 7, 0, 0, 89, 0, 71, 67, 133, 148, 237, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  return createImageBitmap(new Blob([pngBytes], {
    type: 'image/png'
  }), {
    premultiplyAlpha: 'none'
  }).then(image => {
    const texture = new Texture(device, {
      width: 1,
      height: 1,
      format: PIXELFORMAT_R8_G8_B8_A8,
      mipmaps: false,
      levels: [image]
    });
    const rt = new RenderTarget({
      colorBuffer: texture,
      depth: false
    });
    device.setFramebuffer(rt.impl._glFrameBuffer);
    device.initRenderTarget(rt);
    const data = new Uint8ClampedArray(4);
    device.gl.readPixels(0, 0, 1, 1, device.gl.RGBA, device.gl.UNSIGNED_BYTE, data);
    rt.destroy();
    texture.destroy();
    return data[0] === 1 && data[1] === 2 && data[2] === 3 && data[3] === 63;
  }).catch(e => false);
}

class WebglGraphicsDevice extends GraphicsDevice {
  constructor(canvas, options = {}) {
    super(canvas);
    this.gl = void 0;
    this.webgl2 = void 0;
    this.deviceType = DEVICETYPE_WEBGL;
    this.defaultFramebuffer = null;
    this.defaultFramebufferAlpha = options.alpha;
    this.updateClientRect();
    this.contextLost = false;

    this._contextLostHandler = event => {
      event.preventDefault();
      this.contextLost = true;
      this.loseContext();
      Debug.log('pc.GraphicsDevice: WebGL context lost.');
      this.fire('devicelost');
    };

    this._contextRestoredHandler = () => {
      Debug.log('pc.GraphicsDevice: WebGL context restored.');
      this.restoreContext();
      this.contextLost = false;
      this.fire('devicerestored');
    };

    options.stencil = true;

    if (!options.powerPreference) {
      options.powerPreference = 'high-performance';
    }

    const ua = typeof navigator !== 'undefined' && navigator.userAgent;
    this.forceDisableMultisampling = ua && ua.includes('AppleWebKit') && (ua.includes('15.4') || ua.includes('15_4'));

    if (this.forceDisableMultisampling) {
      options.antialias = false;
      Debug.log("Antialiasing has been turned off due to rendering issues on AppleWebKit 15.4");
    }

    const preferWebGl2 = options.preferWebGl2 !== undefined ? options.preferWebGl2 : true;
    const names = preferWebGl2 ? ["webgl2", "webgl", "experimental-webgl"] : ["webgl", "experimental-webgl"];
    let gl = null;

    for (let i = 0; i < names.length; i++) {
      gl = canvas.getContext(names[i], options);

      if (gl) {
        this.webgl2 = names[i] === 'webgl2';
        break;
      }
    }

    if (!gl) {
      throw new Error("WebGL not supported");
    }

    const isChrome = platform.browser && !!window.chrome;
    const isMac = platform.browser && navigator.appVersion.indexOf("Mac") !== -1;
    this.gl = gl;
    this._tempEnableSafariTextureUnitWorkaround = platform.browser && !!window.safari;
    this._tempMacChromeBlitFramebufferWorkaround = isMac && isChrome && !options.alpha;

    if (!this.webgl2) {
      setupVertexArrayObject(gl);
    }

    canvas.addEventListener("webglcontextlost", this._contextLostHandler, false);
    canvas.addEventListener("webglcontextrestored", this._contextRestoredHandler, false);
    this.initializeExtensions();
    this.initializeCapabilities();
    this.initializeRenderState();
    this.initializeContextCaches();
    this.supportsImageBitmap = null;

    if (typeof ImageBitmap !== 'undefined') {
      testImageBitmap(this).then(result => {
        this.supportsImageBitmap = result;
      });
    }

    this.defaultClearOptions = {
      color: [0, 0, 0, 1],
      depth: 1,
      stencil: 0,
      flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
    };
    this.glAddress = [gl.REPEAT, gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT];
    this.glBlendEquation = [gl.FUNC_ADD, gl.FUNC_SUBTRACT, gl.FUNC_REVERSE_SUBTRACT, this.webgl2 ? gl.MIN : this.extBlendMinmax ? this.extBlendMinmax.MIN_EXT : gl.FUNC_ADD, this.webgl2 ? gl.MAX : this.extBlendMinmax ? this.extBlendMinmax.MAX_EXT : gl.FUNC_ADD];
    this.glBlendFunction = [gl.ZERO, gl.ONE, gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR, gl.DST_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA, gl.SRC_ALPHA_SATURATE, gl.ONE_MINUS_SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.CONSTANT_COLOR, gl.ONE_MINUS_CONSTANT_COLOR, gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA];
    this.glComparison = [gl.NEVER, gl.LESS, gl.EQUAL, gl.LEQUAL, gl.GREATER, gl.NOTEQUAL, gl.GEQUAL, gl.ALWAYS];
    this.glStencilOp = [gl.KEEP, gl.ZERO, gl.REPLACE, gl.INCR, gl.INCR_WRAP, gl.DECR, gl.DECR_WRAP, gl.INVERT];
    this.glClearFlag = [0, gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.STENCIL_BUFFER_BIT, gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT, gl.STENCIL_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.STENCIL_BUFFER_BIT | gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT];
    this.glCull = [0, gl.BACK, gl.FRONT, gl.FRONT_AND_BACK];
    this.glFilter = [gl.NEAREST, gl.LINEAR, gl.NEAREST_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR, gl.LINEAR_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_LINEAR];
    this.glPrimitive = [gl.POINTS, gl.LINES, gl.LINE_LOOP, gl.LINE_STRIP, gl.TRIANGLES, gl.TRIANGLE_STRIP, gl.TRIANGLE_FAN];
    this.glType = [gl.BYTE, gl.UNSIGNED_BYTE, gl.SHORT, gl.UNSIGNED_SHORT, gl.INT, gl.UNSIGNED_INT, gl.FLOAT];
    this.pcUniformType = {};
    this.pcUniformType[gl.BOOL] = UNIFORMTYPE_BOOL;
    this.pcUniformType[gl.INT] = UNIFORMTYPE_INT;
    this.pcUniformType[gl.FLOAT] = UNIFORMTYPE_FLOAT;
    this.pcUniformType[gl.FLOAT_VEC2] = UNIFORMTYPE_VEC2;
    this.pcUniformType[gl.FLOAT_VEC3] = UNIFORMTYPE_VEC3;
    this.pcUniformType[gl.FLOAT_VEC4] = UNIFORMTYPE_VEC4;
    this.pcUniformType[gl.INT_VEC2] = UNIFORMTYPE_IVEC2;
    this.pcUniformType[gl.INT_VEC3] = UNIFORMTYPE_IVEC3;
    this.pcUniformType[gl.INT_VEC4] = UNIFORMTYPE_IVEC4;
    this.pcUniformType[gl.BOOL_VEC2] = UNIFORMTYPE_BVEC2;
    this.pcUniformType[gl.BOOL_VEC3] = UNIFORMTYPE_BVEC3;
    this.pcUniformType[gl.BOOL_VEC4] = UNIFORMTYPE_BVEC4;
    this.pcUniformType[gl.FLOAT_MAT2] = UNIFORMTYPE_MAT2;
    this.pcUniformType[gl.FLOAT_MAT3] = UNIFORMTYPE_MAT3;
    this.pcUniformType[gl.FLOAT_MAT4] = UNIFORMTYPE_MAT4;
    this.pcUniformType[gl.SAMPLER_2D] = UNIFORMTYPE_TEXTURE2D;
    this.pcUniformType[gl.SAMPLER_CUBE] = UNIFORMTYPE_TEXTURECUBE;

    if (this.webgl2) {
      this.pcUniformType[gl.SAMPLER_2D_SHADOW] = UNIFORMTYPE_TEXTURE2D_SHADOW;
      this.pcUniformType[gl.SAMPLER_CUBE_SHADOW] = UNIFORMTYPE_TEXTURECUBE_SHADOW;
      this.pcUniformType[gl.SAMPLER_3D] = UNIFORMTYPE_TEXTURE3D;
    }

    this.targetToSlot = {};
    this.targetToSlot[gl.TEXTURE_2D] = 0;
    this.targetToSlot[gl.TEXTURE_CUBE_MAP] = 1;
    this.targetToSlot[gl.TEXTURE_3D] = 2;
    let scopeX, scopeY, scopeZ, scopeW;
    let uniformValue;
    this.commitFunction = [];

    this.commitFunction[UNIFORMTYPE_BOOL] = function (uniform, value) {
      if (uniform.value !== value) {
        gl.uniform1i(uniform.locationId, value);
        uniform.value = value;
      }
    };

    this.commitFunction[UNIFORMTYPE_INT] = this.commitFunction[UNIFORMTYPE_BOOL];

    this.commitFunction[UNIFORMTYPE_FLOAT] = function (uniform, value) {
      if (uniform.value !== value) {
        gl.uniform1f(uniform.locationId, value);
        uniform.value = value;
      }
    };

    this.commitFunction[UNIFORMTYPE_VEC2] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];

      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
        gl.uniform2fv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
      }
    };

    this.commitFunction[UNIFORMTYPE_VEC3] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];

      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
        gl.uniform3fv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
      }
    };

    this.commitFunction[UNIFORMTYPE_VEC4] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];
      scopeW = value[3];

      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
        gl.uniform4fv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
        uniformValue[3] = scopeW;
      }
    };

    this.commitFunction[UNIFORMTYPE_IVEC2] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];

      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY) {
        gl.uniform2iv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
      }
    };

    this.commitFunction[UNIFORMTYPE_BVEC2] = this.commitFunction[UNIFORMTYPE_IVEC2];

    this.commitFunction[UNIFORMTYPE_IVEC3] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];

      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ) {
        gl.uniform3iv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
      }
    };

    this.commitFunction[UNIFORMTYPE_BVEC3] = this.commitFunction[UNIFORMTYPE_IVEC3];

    this.commitFunction[UNIFORMTYPE_IVEC4] = function (uniform, value) {
      uniformValue = uniform.value;
      scopeX = value[0];
      scopeY = value[1];
      scopeZ = value[2];
      scopeW = value[3];

      if (uniformValue[0] !== scopeX || uniformValue[1] !== scopeY || uniformValue[2] !== scopeZ || uniformValue[3] !== scopeW) {
        gl.uniform4iv(uniform.locationId, value);
        uniformValue[0] = scopeX;
        uniformValue[1] = scopeY;
        uniformValue[2] = scopeZ;
        uniformValue[3] = scopeW;
      }
    };

    this.commitFunction[UNIFORMTYPE_BVEC4] = this.commitFunction[UNIFORMTYPE_IVEC4];

    this.commitFunction[UNIFORMTYPE_MAT2] = function (uniform, value) {
      gl.uniformMatrix2fv(uniform.locationId, false, value);
    };

    this.commitFunction[UNIFORMTYPE_MAT3] = function (uniform, value) {
      gl.uniformMatrix3fv(uniform.locationId, false, value);
    };

    this.commitFunction[UNIFORMTYPE_MAT4] = function (uniform, value) {
      gl.uniformMatrix4fv(uniform.locationId, false, value);
    };

    this.commitFunction[UNIFORMTYPE_FLOATARRAY] = function (uniform, value) {
      gl.uniform1fv(uniform.locationId, value);
    };

    this.commitFunction[UNIFORMTYPE_VEC2ARRAY] = function (uniform, value) {
      gl.uniform2fv(uniform.locationId, value);
    };

    this.commitFunction[UNIFORMTYPE_VEC3ARRAY] = function (uniform, value) {
      gl.uniform3fv(uniform.locationId, value);
    };

    this.commitFunction[UNIFORMTYPE_VEC4ARRAY] = function (uniform, value) {
      gl.uniform4fv(uniform.locationId, value);
    };

    this.supportsBoneTextures = this.extTextureFloat && this.maxVertexTextures > 0;
    let numUniforms = this.vertexUniformsCount;
    numUniforms -= 4 * 4;
    numUniforms -= 8;
    numUniforms -= 1;
    numUniforms -= 4 * 4;
    this.boneLimit = Math.floor(numUniforms / 3);
    this.boneLimit = Math.min(this.boneLimit, 128);

    if (this.unmaskedRenderer === 'Mali-450 MP') {
      this.boneLimit = 34;
    }

    this.constantTexSource = this.scope.resolve("source");

    if (this.extTextureFloat) {
      if (this.webgl2) {
        this.textureFloatRenderable = !!this.extColorBufferFloat;
      } else {
        this.textureFloatRenderable = testRenderable(gl, gl.FLOAT);
      }
    } else {
      this.textureFloatRenderable = false;
    }

    if (this.extColorBufferHalfFloat) {
      this.textureHalfFloatRenderable = !!this.extColorBufferHalfFloat;
    } else if (this.extTextureHalfFloat) {
      if (this.webgl2) {
        this.textureHalfFloatRenderable = !!this.extColorBufferFloat;
      } else {
        this.textureHalfFloatRenderable = testRenderable(gl, this.extTextureHalfFloat.HALF_FLOAT_OES);
      }
    } else {
      this.textureHalfFloatRenderable = false;
    }

    this.supportsMorphTargetTexturesCore = this.maxPrecision === "highp" && this.maxVertexTextures >= 2;
    this._textureFloatHighPrecision = undefined;
    this._textureHalfFloatUpdatable = undefined;
    this._spectorMarkers = [];
    this._spectorCurrentMarker = "";
    this.areaLightLutFormat = PIXELFORMAT_R8_G8_B8_A8;

    if (this.extTextureHalfFloat && this.textureHalfFloatUpdatable && this.extTextureHalfFloatLinear) {
      this.areaLightLutFormat = PIXELFORMAT_RGBA16F;
    } else if (this.extTextureFloat && this.extTextureFloatLinear) {
      this.areaLightLutFormat = PIXELFORMAT_RGBA32F;
    }
  }

  destroy() {
    super.destroy();
    const gl = this.gl;

    if (this.webgl2 && this.feedback) {
      gl.deleteTransformFeedback(this.feedback);
    }

    this.clearShaderCache();
    this.clearVertexArrayObjectCache();
    this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler, false);
    this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler, false);
    this._contextLostHandler = null;
    this._contextRestoredHandler = null;
    this.gl = null;
    super.postDestroy();
  }

  createVertexBufferImpl(vertexBuffer, format) {
    return new WebglVertexBuffer();
  }

  createIndexBufferImpl(indexBuffer) {
    return new WebglIndexBuffer(indexBuffer);
  }

  createShaderImpl(shader) {
    return new WebglShader(shader);
  }

  createTextureImpl(texture) {
    return new WebglTexture();
  }

  createRenderTargetImpl(renderTarget) {
    return new WebglRenderTarget();
  }

  updateMarker() {
    this._spectorCurrentMarker = this._spectorMarkers.join(" | ") + " # ";
  }

  pushMarker(name) {
    if (window.spector) {
      this._spectorMarkers.push(name);

      this.updateMarker();
      window.spector.setMarker(this._spectorCurrentMarker);
    }
  }

  popMarker() {
    if (window.spector) {
      if (this._spectorMarkers.length) {
        this._spectorMarkers.pop();

        this.updateMarker();
        if (this._spectorMarkers.length) window.spector.setMarker(this._spectorCurrentMarker);else window.spector.clearMarker();
      }
    }
  }

  getPrecision() {
    const gl = this.gl;
    let precision = "highp";

    if (gl.getShaderPrecisionFormat) {
      const vertexShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT);
      const vertexShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT);
      const fragmentShaderPrecisionHighpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      const fragmentShaderPrecisionMediumpFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT);
      const highpAvailable = vertexShaderPrecisionHighpFloat.precision > 0 && fragmentShaderPrecisionHighpFloat.precision > 0;
      const mediumpAvailable = vertexShaderPrecisionMediumpFloat.precision > 0 && fragmentShaderPrecisionMediumpFloat.precision > 0;

      if (!highpAvailable) {
        if (mediumpAvailable) {
          precision = "mediump";
          Debug.warn("WARNING: highp not supported, using mediump");
        } else {
          precision = "lowp";
          Debug.warn("WARNING: highp and mediump not supported, using lowp");
        }
      }
    }

    return precision;
  }

  initializeExtensions() {
    const gl = this.gl;
    const supportedExtensions = gl.getSupportedExtensions();

    const getExtension = function getExtension() {
      for (let i = 0; i < arguments.length; i++) {
        if (supportedExtensions.indexOf(arguments[i]) !== -1) {
          return gl.getExtension(arguments[i]);
        }
      }

      return null;
    };

    if (this.webgl2) {
      this.extBlendMinmax = true;
      this.extDrawBuffers = true;
      this.extInstancing = true;
      this.extStandardDerivatives = true;
      this.extTextureFloat = true;
      this.extTextureHalfFloat = true;
      this.extTextureLod = true;
      this.extUintElement = true;
      this.extVertexArrayObject = true;
      this.extColorBufferFloat = getExtension('EXT_color_buffer_float');
      this.extDisjointTimerQuery = getExtension('EXT_disjoint_timer_query_webgl2', 'EXT_disjoint_timer_query');
      this.extDepthTexture = true;
    } else {
      this.extBlendMinmax = getExtension("EXT_blend_minmax");
      this.extDrawBuffers = getExtension('EXT_draw_buffers');
      this.extInstancing = getExtension("ANGLE_instanced_arrays");

      if (this.extInstancing) {
        const ext = this.extInstancing;
        gl.drawArraysInstanced = ext.drawArraysInstancedANGLE.bind(ext);
        gl.drawElementsInstanced = ext.drawElementsInstancedANGLE.bind(ext);
        gl.vertexAttribDivisor = ext.vertexAttribDivisorANGLE.bind(ext);
      }

      this.extStandardDerivatives = getExtension("OES_standard_derivatives");
      this.extTextureFloat = getExtension("OES_texture_float");
      this.extTextureHalfFloat = getExtension("OES_texture_half_float");
      this.extTextureLod = getExtension('EXT_shader_texture_lod');
      this.extUintElement = getExtension("OES_element_index_uint");
      this.extVertexArrayObject = getExtension("OES_vertex_array_object");

      if (this.extVertexArrayObject) {
        const ext = this.extVertexArrayObject;
        gl.createVertexArray = ext.createVertexArrayOES.bind(ext);
        gl.deleteVertexArray = ext.deleteVertexArrayOES.bind(ext);
        gl.isVertexArray = ext.isVertexArrayOES.bind(ext);
        gl.bindVertexArray = ext.bindVertexArrayOES.bind(ext);
      }

      this.extColorBufferFloat = null;
      this.extDisjointTimerQuery = null;
      this.extDepthTexture = gl.getExtension('WEBGL_depth_texture');
    }

    this.extDebugRendererInfo = getExtension('WEBGL_debug_renderer_info');
    this.extTextureFloatLinear = getExtension("OES_texture_float_linear");
    this.extTextureHalfFloatLinear = getExtension("OES_texture_half_float_linear");
    this.extFloatBlend = getExtension("EXT_float_blend");
    this.extTextureFilterAnisotropic = getExtension('EXT_texture_filter_anisotropic', 'WEBKIT_EXT_texture_filter_anisotropic');
    this.extCompressedTextureETC1 = getExtension('WEBGL_compressed_texture_etc1');
    this.extCompressedTextureETC = getExtension('WEBGL_compressed_texture_etc');
    this.extCompressedTexturePVRTC = getExtension('WEBGL_compressed_texture_pvrtc', 'WEBKIT_WEBGL_compressed_texture_pvrtc');
    this.extCompressedTextureS3TC = getExtension('WEBGL_compressed_texture_s3tc', 'WEBKIT_WEBGL_compressed_texture_s3tc');
    this.extCompressedTextureATC = getExtension('WEBGL_compressed_texture_atc');
    this.extCompressedTextureASTC = getExtension('WEBGL_compressed_texture_astc');
    this.extParallelShaderCompile = getExtension('KHR_parallel_shader_compile');
    this.extColorBufferHalfFloat = getExtension("EXT_color_buffer_half_float");
  }

  initializeCapabilities() {
    const gl = this.gl;
    let ext;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : "";
    this.maxPrecision = this.precision = this.getPrecision();
    const contextAttribs = gl.getContextAttributes();
    this.supportsMsaa = contextAttribs.antialias;
    this.supportsStencil = contextAttribs.stencil;
    this.supportsInstancing = !!this.extInstancing;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.maxCubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
    this.maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    this.maxTextures = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
    this.maxCombinedTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    this.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
    this.vertexUniformsCount = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);
    this.fragmentUniformsCount = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);

    if (this.webgl2) {
      this.maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS);
      this.maxColorAttachments = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
      this.maxVolumeSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);
    } else {
      ext = this.extDrawBuffers;
      this.maxDrawBuffers = ext ? gl.getParameter(ext.MAX_DRAW_BUFFERS_EXT) : 1;
      this.maxColorAttachments = ext ? gl.getParameter(ext.MAX_COLOR_ATTACHMENTS_EXT) : 1;
      this.maxVolumeSize = 1;
    }

    ext = this.extDebugRendererInfo;
    this.unmaskedRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    this.unmaskedVendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';
    const samsungModelRegex = /SM-[a-zA-Z0-9]+/;
    this.supportsGpuParticles = !(this.unmaskedVendor === 'ARM' && userAgent.match(samsungModelRegex));
    ext = this.extTextureFilterAnisotropic;
    this.maxAnisotropy = ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
    this.samples = gl.getParameter(gl.SAMPLES);
    this.maxSamples = this.webgl2 && !this.forceDisableMultisampling ? gl.getParameter(gl.MAX_SAMPLES) : 1;
    this.supportsAreaLights = this.webgl2 || !platform.android;

    if (this.maxTextures <= 8) {
      this.supportsAreaLights = false;
    }
  }

  initializeRenderState() {
    const gl = this.gl;
    this.blending = false;
    gl.disable(gl.BLEND);
    this.blendSrc = BLENDMODE_ONE;
    this.blendDst = BLENDMODE_ZERO;
    this.blendSrcAlpha = BLENDMODE_ONE;
    this.blendDstAlpha = BLENDMODE_ZERO;
    this.separateAlphaBlend = false;
    this.blendEquation = BLENDEQUATION_ADD;
    this.blendAlphaEquation = BLENDEQUATION_ADD;
    this.separateAlphaEquation = false;
    gl.blendFunc(gl.ONE, gl.ZERO);
    gl.blendEquation(gl.FUNC_ADD);
    this.blendColor = new Color(0, 0, 0, 0);
    gl.blendColor(0, 0, 0, 0);
    this.writeRed = true;
    this.writeGreen = true;
    this.writeBlue = true;
    this.writeAlpha = true;
    gl.colorMask(true, true, true, true);
    this.cullMode = CULLFACE_BACK;
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    this.depthTest = true;
    gl.enable(gl.DEPTH_TEST);
    this.depthFunc = FUNC_LESSEQUAL;
    gl.depthFunc(gl.LEQUAL);
    this.depthWrite = true;
    gl.depthMask(true);
    this.stencil = false;
    gl.disable(gl.STENCIL_TEST);
    this.stencilFuncFront = this.stencilFuncBack = FUNC_ALWAYS;
    this.stencilRefFront = this.stencilRefBack = 0;
    this.stencilMaskFront = this.stencilMaskBack = 0xFF;
    gl.stencilFunc(gl.ALWAYS, 0, 0xFF);
    this.stencilFailFront = this.stencilFailBack = STENCILOP_KEEP;
    this.stencilZfailFront = this.stencilZfailBack = STENCILOP_KEEP;
    this.stencilZpassFront = this.stencilZpassBack = STENCILOP_KEEP;
    this.stencilWriteMaskFront = 0xFF;
    this.stencilWriteMaskBack = 0xFF;
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.stencilMask(0xFF);
    this.alphaToCoverage = false;
    this.raster = true;

    if (this.webgl2) {
      gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
      gl.disable(gl.RASTERIZER_DISCARD);
    }

    this.depthBiasEnabled = false;
    gl.disable(gl.POLYGON_OFFSET_FILL);
    this.clearDepth = 1;
    gl.clearDepth(1);
    this.clearColor = new Color(0, 0, 0, 0);
    gl.clearColor(0, 0, 0, 0);
    this.clearStencil = 0;
    gl.clearStencil(0);
    this.vx = this.vy = this.vw = this.vh = 0;
    this.sx = this.sy = this.sw = this.sh = 0;

    if (this.webgl2) {
      gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.NICEST);
    } else {
      if (this.extStandardDerivatives) {
        gl.hint(this.extStandardDerivatives.FRAGMENT_SHADER_DERIVATIVE_HINT_OES, gl.NICEST);
      }
    }

    gl.enable(gl.SCISSOR_TEST);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    this.unpackFlipY = false;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.unpackPremultiplyAlpha = false;
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  initializeContextCaches() {
    super.initializeContextCaches();
    this.vertexShaderCache = {};
    this.fragmentShaderCache = {};
    this._vaoMap = new Map();
    this.boundVao = null;
    this.activeFramebuffer = null;
    this.feedback = null;
    this.transformFeedbackBuffer = null;
    this.textureUnit = 0;
    this.textureUnits = [];

    for (let i = 0; i < this.maxCombinedTextures; i++) {
      this.textureUnits.push([null, null, null]);
    }
  }

  loseContext() {
    for (const shader of this.shaders) {
      shader.loseContext();
    }

    for (const texture of this.textures) {
      texture.loseContext();
    }

    for (const buffer of this.buffers) {
      buffer.loseContext();
    }

    for (const target of this.targets) {
      target.loseContext();
    }
  }

  restoreContext() {
    this.initializeExtensions();
    this.initializeCapabilities();
    this.initializeRenderState();
    this.initializeContextCaches();

    for (const shader of this.shaders) {
      shader.restoreContext();
    }

    for (const buffer of this.buffers) {
      buffer.unlock();
    }
  }

  setViewport(x, y, w, h) {
    if (this.vx !== x || this.vy !== y || this.vw !== w || this.vh !== h) {
      this.gl.viewport(x, y, w, h);
      this.vx = x;
      this.vy = y;
      this.vw = w;
      this.vh = h;
    }
  }

  setScissor(x, y, w, h) {
    if (this.sx !== x || this.sy !== y || this.sw !== w || this.sh !== h) {
      this.gl.scissor(x, y, w, h);
      this.sx = x;
      this.sy = y;
      this.sw = w;
      this.sh = h;
    }
  }

  setFramebuffer(fb) {
    if (this.activeFramebuffer !== fb) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      this.activeFramebuffer = fb;
    }
  }

  copyRenderTarget(source, dest, color, depth) {
    const gl = this.gl;

    if (!this.webgl2 && depth) {
      Debug.error("Depth is not copyable on WebGL 1.0");
      return false;
    }

    if (color) {
      if (!dest) {
        if (!source._colorBuffer) {
          Debug.error("Can't copy empty color buffer to backbuffer");
          return false;
        }
      } else if (source) {
        if (!source._colorBuffer || !dest._colorBuffer) {
          Debug.error("Can't copy color buffer, because one of the render targets doesn't have it");
          return false;
        }

        if (source._colorBuffer._format !== dest._colorBuffer._format) {
          Debug.error("Can't copy render targets of different color formats");
          return false;
        }
      }
    }

    if (depth && source) {
      if (!source._depth) {
        if (!source._depthBuffer || !dest._depthBuffer) {
          Debug.error("Can't copy depth buffer, because one of the render targets doesn't have it");
          return false;
        }

        if (source._depthBuffer._format !== dest._depthBuffer._format) {
          Debug.error("Can't copy render targets of different depth formats");
          return false;
        }
      }
    }

    DebugGraphics.pushGpuMarker(this, 'COPY-RT');

    if (this.webgl2 && dest) {
      const prevRt = this.renderTarget;
      this.renderTarget = dest;
      this.updateBegin();
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source ? source.impl._glFrameBuffer : null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dest.impl._glFrameBuffer);
      const w = source ? source.width : dest.width;
      const h = source ? source.height : dest.height;
      gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, (color ? gl.COLOR_BUFFER_BIT : 0) | (depth ? gl.DEPTH_BUFFER_BIT : 0), gl.NEAREST);
      this.renderTarget = prevRt;
      gl.bindFramebuffer(gl.FRAMEBUFFER, prevRt ? prevRt.impl._glFrameBuffer : null);
    } else {
      const shader = this.getCopyShader();
      this.constantTexSource.setValue(source._colorBuffer);
      drawQuadWithShader(this, dest, shader);
    }

    DebugGraphics.popGpuMarker(this);
    return true;
  }

  getCopyShader() {
    if (!this._copyShader) {
      const vs = shaderChunks.fullscreenQuadVS;
      const fs = shaderChunks.outputTex2DPS;
      this._copyShader = createShaderFromCode(this, vs, fs, "outputTex2D");
    }

    return this._copyShader;
  }

  startPass(renderPass) {
    DebugGraphics.pushGpuMarker(this, `START-PASS`);
    this.setRenderTarget(renderPass.renderTarget);
    this.updateBegin();
    const colorOps = renderPass.colorOps;
    const depthStencilOps = renderPass.depthStencilOps;

    if (colorOps.clear || depthStencilOps.clearDepth || depthStencilOps.clearStencil) {
      const rt = renderPass.renderTarget;
      const width = rt ? rt.width : this.width;
      const height = rt ? rt.height : this.height;
      this.setViewport(0, 0, width, height);
      this.setScissor(0, 0, width, height);
      let clearFlags = 0;
      const clearOptions = {};

      if (colorOps.clear) {
        clearFlags |= CLEARFLAG_COLOR;
        clearOptions.color = [colorOps.clearValue.r, colorOps.clearValue.g, colorOps.clearValue.b, colorOps.clearValue.a];
      }

      if (depthStencilOps.clearDepth) {
        clearFlags |= CLEARFLAG_DEPTH;
        clearOptions.depth = depthStencilOps.clearDepthValue;
      }

      if (depthStencilOps.clearStencil) {
        clearFlags |= CLEARFLAG_STENCIL;
        clearOptions.stencil = depthStencilOps.clearStencilValue;
      }

      clearOptions.flags = clearFlags;
      this.clear(clearOptions);
    }

    Debug.assert(!this.insideRenderPass);
    this.insideRenderPass = true;
    DebugGraphics.popGpuMarker(this);
  }

  endPass(renderPass) {
    DebugGraphics.pushGpuMarker(this, `END-PASS`);
    this.unbindVertexArray();
    const target = this.renderTarget;

    if (target) {
      if (this.webgl2) {
        invalidateAttachments.length = 0;
        const gl = this.gl;

        if (!(renderPass.colorOps.store || renderPass.colorOps.resolve)) {
          invalidateAttachments.push(gl.COLOR_ATTACHMENT0);
        }

        if (!renderPass.depthStencilOps.storeDepth) {
          invalidateAttachments.push(gl.DEPTH_ATTACHMENT);
        }

        if (!renderPass.depthStencilOps.storeStencil) {
          invalidateAttachments.push(gl.STENCIL_ATTACHMENT);
        }

        if (invalidateAttachments.length > 0) {
          if (renderPass.fullSizeClearRect) {
            gl.invalidateFramebuffer(gl.DRAW_FRAMEBUFFER, invalidateAttachments);
          }
        }
      }

      if (renderPass.colorOps.resolve) {
        if (this.webgl2 && renderPass.samples > 1 && target.autoResolve) {
          target.resolve(true, false);
        }
      }

      if (renderPass.colorOps.mipmaps) {
        const colorBuffer = target._colorBuffer;

        if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps && (colorBuffer.pot || this.webgl2)) {
          this.activeTexture(this.maxCombinedTextures - 1);
          this.bindTexture(colorBuffer);
          this.gl.generateMipmap(colorBuffer.impl._glTarget);
        }
      }
    }

    this.insideRenderPass = false;
    DebugGraphics.popGpuMarker(this);
  }

  updateBegin() {
    DebugGraphics.pushGpuMarker(this, 'UPDATE-BEGIN');
    this.boundVao = null;

    if (this._tempEnableSafariTextureUnitWorkaround) {
      for (let unit = 0; unit < this.textureUnits.length; ++unit) {
        for (let slot = 0; slot < 3; ++slot) {
          this.textureUnits[unit][slot] = null;
        }
      }
    }

    const target = this.renderTarget;

    if (target) {
      if (!target.impl.initialized) {
        this.initRenderTarget(target);
      } else {
        this.setFramebuffer(target.impl._glFrameBuffer);
      }
    } else {
      this.setFramebuffer(this.defaultFramebuffer);
    }

    DebugGraphics.popGpuMarker(this);
  }

  updateEnd() {
    DebugGraphics.pushGpuMarker(this, `UPDATE-END`);
    this.unbindVertexArray();
    const target = this.renderTarget;

    if (target) {
      if (this.webgl2 && target._samples > 1 && target.autoResolve) {
        target.resolve();
      }

      const colorBuffer = target._colorBuffer;

      if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps && (colorBuffer.pot || this.webgl2)) {
        this.activeTexture(this.maxCombinedTextures - 1);
        this.bindTexture(colorBuffer);
        this.gl.generateMipmap(colorBuffer.impl._glTarget);
      }
    }

    DebugGraphics.popGpuMarker(this);
  }

  setUnpackFlipY(flipY) {
    if (this.unpackFlipY !== flipY) {
      this.unpackFlipY = flipY;
      const gl = this.gl;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
    }
  }

  setUnpackPremultiplyAlpha(premultiplyAlpha) {
    if (this.unpackPremultiplyAlpha !== premultiplyAlpha) {
      this.unpackPremultiplyAlpha = premultiplyAlpha;
      const gl = this.gl;
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
    }
  }

  activeTexture(textureUnit) {
    if (this.textureUnit !== textureUnit) {
      this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
      this.textureUnit = textureUnit;
    }
  }

  bindTexture(texture) {
    const impl = texture.impl;
    const textureTarget = impl._glTarget;
    const textureObject = impl._glTexture;
    const textureUnit = this.textureUnit;
    const slot = this.targetToSlot[textureTarget];

    if (this.textureUnits[textureUnit][slot] !== textureObject) {
      this.gl.bindTexture(textureTarget, textureObject);
      this.textureUnits[textureUnit][slot] = textureObject;
    }
  }

  bindTextureOnUnit(texture, textureUnit) {
    const impl = texture.impl;
    const textureTarget = impl._glTarget;
    const textureObject = impl._glTexture;
    const slot = this.targetToSlot[textureTarget];

    if (this.textureUnits[textureUnit][slot] !== textureObject) {
      this.activeTexture(textureUnit);
      this.gl.bindTexture(textureTarget, textureObject);
      this.textureUnits[textureUnit][slot] = textureObject;
    }
  }

  setTextureParameters(texture) {
    const gl = this.gl;
    const flags = texture._parameterFlags;
    const target = texture.impl._glTarget;

    if (flags & 1) {
      let filter = texture._minFilter;

      if (!texture.pot && !this.webgl2 || !texture._mipmaps || texture._compressed && texture._levels.length === 1) {
        if (filter === FILTER_NEAREST_MIPMAP_NEAREST || filter === FILTER_NEAREST_MIPMAP_LINEAR) {
          filter = FILTER_NEAREST;
        } else if (filter === FILTER_LINEAR_MIPMAP_NEAREST || filter === FILTER_LINEAR_MIPMAP_LINEAR) {
          filter = FILTER_LINEAR;
        }
      }

      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.glFilter[filter]);
    }

    if (flags & 2) {
      gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.glFilter[texture._magFilter]);
    }

    if (flags & 4) {
      if (this.webgl2) {
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture._addressU]);
      } else {
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture.pot ? texture._addressU : ADDRESS_CLAMP_TO_EDGE]);
      }
    }

    if (flags & 8) {
      if (this.webgl2) {
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture._addressV]);
      } else {
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture.pot ? texture._addressV : ADDRESS_CLAMP_TO_EDGE]);
      }
    }

    if (flags & 16) {
      if (this.webgl2) {
        gl.texParameteri(target, gl.TEXTURE_WRAP_R, this.glAddress[texture._addressW]);
      }
    }

    if (flags & 32) {
      if (this.webgl2) {
        gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, texture._compareOnRead ? gl.COMPARE_REF_TO_TEXTURE : gl.NONE);
      }
    }

    if (flags & 64) {
      if (this.webgl2) {
        gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, this.glComparison[texture._compareFunc]);
      }
    }

    if (flags & 128) {
      const ext = this.extTextureFilterAnisotropic;

      if (ext) {
        gl.texParameterf(target, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.max(1, Math.min(Math.round(texture._anisotropy), this.maxAnisotropy)));
      }
    }
  }

  setTexture(texture, textureUnit) {
    if (!texture.impl._glTexture) texture.impl.initialize(this, texture);

    if (texture._parameterFlags > 0 || texture._needsUpload || texture._needsMipmapsUpload) {
      this.activeTexture(textureUnit);
      this.bindTexture(texture);

      if (texture._parameterFlags) {
        this.setTextureParameters(texture);
        texture._parameterFlags = 0;
      }

      if (texture._needsUpload || texture._needsMipmapsUpload) {
        texture.impl.upload(this, texture);
        texture._needsUpload = false;
        texture._needsMipmapsUpload = false;
      }
    } else {
      this.bindTextureOnUnit(texture, textureUnit);
    }
  }

  createVertexArray(vertexBuffers) {
    let key, vao;
    const useCache = vertexBuffers.length > 1;

    if (useCache) {
      key = "";

      for (let i = 0; i < vertexBuffers.length; i++) {
        const vertexBuffer = vertexBuffers[i];
        key += vertexBuffer.id + vertexBuffer.format.renderingingHash;
      }

      vao = this._vaoMap.get(key);
    }

    if (!vao) {
      const gl = this.gl;
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      let locZero = false;

      for (let i = 0; i < vertexBuffers.length; i++) {
        const vertexBuffer = vertexBuffers[i];
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.impl.bufferId);
        const elements = vertexBuffer.format.elements;

        for (let j = 0; j < elements.length; j++) {
          const e = elements[j];
          const loc = semanticToLocation[e.name];

          if (loc === 0) {
            locZero = true;
          }

          gl.vertexAttribPointer(loc, e.numComponents, this.glType[e.dataType], e.normalize, e.stride, e.offset);
          gl.enableVertexAttribArray(loc);

          if (vertexBuffer.instancing) {
            gl.vertexAttribDivisor(loc, 1);
          }
        }
      }

      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      if (useCache) {
        this._vaoMap.set(key, vao);
      }

      if (!locZero) {
        Debug.warn("No vertex attribute is mapped to location 0, which might cause compatibility issues on Safari on MacOS - please use attribute SEMANTIC_POSITION or SEMANTIC_ATTR15");
      }
    }

    return vao;
  }

  unbindVertexArray() {
    if (this.boundVao) {
      this.boundVao = null;
      this.gl.bindVertexArray(null);
    }
  }

  setBuffers() {
    const gl = this.gl;
    let vao;

    if (this.vertexBuffers.length === 1) {
      const vertexBuffer = this.vertexBuffers[0];
      Debug.assert(vertexBuffer.device === this, "The VertexBuffer was not created using current GraphicsDevice");

      if (!vertexBuffer.impl.vao) {
        vertexBuffer.impl.vao = this.createVertexArray(this.vertexBuffers);
      }

      vao = vertexBuffer.impl.vao;
    } else {
      vao = this.createVertexArray(this.vertexBuffers);
    }

    if (this.boundVao !== vao) {
      this.boundVao = vao;
      gl.bindVertexArray(vao);
    }

    this.vertexBuffers.length = 0;
    const bufferId = this.indexBuffer ? this.indexBuffer.impl.bufferId : null;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
  }

  draw(primitive, numInstances, keepBuffers) {
    const gl = this.gl;
    let sampler, samplerValue, texture, numTextures;
    let uniform, scopeId, uniformVersion, programVersion;
    const shader = this.shader;
    if (!shader) return;
    const samplers = shader.impl.samplers;
    const uniforms = shader.impl.uniforms;

    if (!keepBuffers) {
      this.setBuffers();
    }

    let textureUnit = 0;

    for (let i = 0, len = samplers.length; i < len; i++) {
      sampler = samplers[i];
      samplerValue = sampler.scopeId.value;

      if (!samplerValue) {
        const samplerName = sampler.scopeId.name;

        if (samplerName === 'uSceneDepthMap' || samplerName === 'uDepthMap') {
          Debug.warnOnce(`A sampler ${samplerName} is used by the shader but a scene depth texture is not available. Use CameraComponent.requestSceneDepthMap to enable it.`);
        }

        if (samplerName === 'uSceneColorMap' || samplerName === 'texture_grabPass') {
          Debug.warnOnce(`A sampler ${samplerName} is used by the shader but a scene depth texture is not available. Use CameraComponent.requestSceneColorMap to enable it.`);
        }

        continue;
      }

      if (samplerValue instanceof Texture) {
        texture = samplerValue;
        this.setTexture(texture, textureUnit);

        if (this.renderTarget) {
          if (this.renderTarget._samples < 2) {
            if (this.renderTarget.colorBuffer && this.renderTarget.colorBuffer === texture) {
              Debug.error("Trying to bind current color buffer as a texture");
            } else if (this.renderTarget.depthBuffer && this.renderTarget.depthBuffer === texture) {
              Debug.error("Trying to bind current depth buffer as a texture");
            }
          }
        }

        if (sampler.slot !== textureUnit) {
          gl.uniform1i(sampler.locationId, textureUnit);
          sampler.slot = textureUnit;
        }

        textureUnit++;
      } else {
        sampler.array.length = 0;
        numTextures = samplerValue.length;

        for (let j = 0; j < numTextures; j++) {
          texture = samplerValue[j];
          this.setTexture(texture, textureUnit);
          sampler.array[j] = textureUnit;
          textureUnit++;
        }

        gl.uniform1iv(sampler.locationId, sampler.array);
      }
    }

    for (let i = 0, len = uniforms.length; i < len; i++) {
      uniform = uniforms[i];
      scopeId = uniform.scopeId;
      uniformVersion = uniform.version;
      programVersion = scopeId.versionObject.version;

      if (uniformVersion.globalId !== programVersion.globalId || uniformVersion.revision !== programVersion.revision) {
        uniformVersion.globalId = programVersion.globalId;
        uniformVersion.revision = programVersion.revision;

        if (scopeId.value !== null) {
          this.commitFunction[uniform.dataType](uniform, scopeId.value);
        }
      }
    }

    if (this.webgl2 && this.transformFeedbackBuffer) {
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.transformFeedbackBuffer.impl.bufferId);
      gl.beginTransformFeedback(gl.POINTS);
    }

    const mode = this.glPrimitive[primitive.type];
    const count = primitive.count;

    if (primitive.indexed) {
      const indexBuffer = this.indexBuffer;
      Debug.assert(indexBuffer.device === this, "The IndexBuffer was not created using current GraphicsDevice");
      const format = indexBuffer.impl.glFormat;
      const offset = primitive.base * indexBuffer.bytesPerIndex;

      if (numInstances > 0) {
        gl.drawElementsInstanced(mode, count, format, offset, numInstances);
      } else {
        gl.drawElements(mode, count, format, offset);
      }
    } else {
      const first = primitive.base;

      if (numInstances > 0) {
        gl.drawArraysInstanced(mode, first, count, numInstances);
      } else {
        gl.drawArrays(mode, first, count);
      }
    }

    if (this.webgl2 && this.transformFeedbackBuffer) {
      gl.endTransformFeedback();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    }

    this._drawCallsPerFrame++;
    this._primsPerFrame[primitive.type] += primitive.count * (numInstances > 1 ? numInstances : 1);
  }

  clear(options) {
    const defaultOptions = this.defaultClearOptions;
    options = options || defaultOptions;
    const flags = options.flags === undefined ? defaultOptions.flags : options.flags;

    if (flags !== 0) {
      const gl = this.gl;

      if (flags & CLEARFLAG_COLOR) {
        const color = options.color === undefined ? defaultOptions.color : options.color;
        this.setClearColor(color[0], color[1], color[2], color[3]);
        this.setColorWrite(true, true, true, true);
      }

      if (flags & CLEARFLAG_DEPTH) {
        const depth = options.depth === undefined ? defaultOptions.depth : options.depth;
        this.setClearDepth(depth);
        this.setDepthWrite(true);
      }

      if (flags & CLEARFLAG_STENCIL) {
        const stencil = options.stencil === undefined ? defaultOptions.stencil : options.stencil;
        this.setClearStencil(stencil);
      }

      gl.clear(this.glClearFlag[flags]);
    }
  }

  readPixels(x, y, w, h, pixels) {
    const gl = this.gl;
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  }

  setClearDepth(depth) {
    if (depth !== this.clearDepth) {
      this.gl.clearDepth(depth);
      this.clearDepth = depth;
    }
  }

  setClearColor(r, g, b, a) {
    const c = this.clearColor;

    if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
      this.gl.clearColor(r, g, b, a);
      this.clearColor.set(r, g, b, a);
    }
  }

  setClearStencil(value) {
    if (value !== this.clearStencil) {
      this.gl.clearStencil(value);
      this.clearStencil = value;
    }
  }

  getDepthTest() {
    return this.depthTest;
  }

  setDepthTest(depthTest) {
    if (this.depthTest !== depthTest) {
      const gl = this.gl;

      if (depthTest) {
        gl.enable(gl.DEPTH_TEST);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }

      this.depthTest = depthTest;
    }
  }

  setDepthFunc(func) {
    if (this.depthFunc === func) return;
    this.gl.depthFunc(this.glComparison[func]);
    this.depthFunc = func;
  }

  getDepthWrite() {
    return this.depthWrite;
  }

  setDepthWrite(writeDepth) {
    if (this.depthWrite !== writeDepth) {
      this.gl.depthMask(writeDepth);
      this.depthWrite = writeDepth;
    }
  }

  setColorWrite(writeRed, writeGreen, writeBlue, writeAlpha) {
    if (this.writeRed !== writeRed || this.writeGreen !== writeGreen || this.writeBlue !== writeBlue || this.writeAlpha !== writeAlpha) {
      this.gl.colorMask(writeRed, writeGreen, writeBlue, writeAlpha);
      this.writeRed = writeRed;
      this.writeGreen = writeGreen;
      this.writeBlue = writeBlue;
      this.writeAlpha = writeAlpha;
    }
  }

  setAlphaToCoverage(state) {
    if (!this.webgl2) return;
    if (this.alphaToCoverage === state) return;
    this.alphaToCoverage = state;

    if (state) {
      this.gl.enable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
    } else {
      this.gl.disable(this.gl.SAMPLE_ALPHA_TO_COVERAGE);
    }
  }

  setTransformFeedbackBuffer(tf) {
    if (this.transformFeedbackBuffer === tf) return;
    this.transformFeedbackBuffer = tf;

    if (this.webgl2) {
      const gl = this.gl;

      if (tf) {
        if (!this.feedback) {
          this.feedback = gl.createTransformFeedback();
        }

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.feedback);
      } else {
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      }
    }
  }

  setRaster(on) {
    if (this.raster === on) return;
    this.raster = on;

    if (this.webgl2) {
      if (on) {
        this.gl.disable(this.gl.RASTERIZER_DISCARD);
      } else {
        this.gl.enable(this.gl.RASTERIZER_DISCARD);
      }
    }
  }

  setDepthBias(on) {
    if (this.depthBiasEnabled === on) return;
    this.depthBiasEnabled = on;

    if (on) {
      this.gl.enable(this.gl.POLYGON_OFFSET_FILL);
    } else {
      this.gl.disable(this.gl.POLYGON_OFFSET_FILL);
    }
  }

  setDepthBiasValues(constBias, slopeBias) {
    this.gl.polygonOffset(slopeBias, constBias);
  }

  getBlending() {
    return this.blending;
  }

  setBlending(blending) {
    if (this.blending !== blending) {
      const gl = this.gl;

      if (blending) {
        gl.enable(gl.BLEND);
      } else {
        gl.disable(gl.BLEND);
      }

      this.blending = blending;
    }
  }

  setStencilTest(enable) {
    if (this.stencil !== enable) {
      const gl = this.gl;

      if (enable) {
        gl.enable(gl.STENCIL_TEST);
      } else {
        gl.disable(gl.STENCIL_TEST);
      }

      this.stencil = enable;
    }
  }

  setStencilFunc(func, ref, mask) {
    if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask || this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
      const gl = this.gl;
      gl.stencilFunc(this.glComparison[func], ref, mask);
      this.stencilFuncFront = this.stencilFuncBack = func;
      this.stencilRefFront = this.stencilRefBack = ref;
      this.stencilMaskFront = this.stencilMaskBack = mask;
    }
  }

  setStencilFuncFront(func, ref, mask) {
    if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask) {
      const gl = this.gl;
      gl.stencilFuncSeparate(gl.FRONT, this.glComparison[func], ref, mask);
      this.stencilFuncFront = func;
      this.stencilRefFront = ref;
      this.stencilMaskFront = mask;
    }
  }

  setStencilFuncBack(func, ref, mask) {
    if (this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
      const gl = this.gl;
      gl.stencilFuncSeparate(gl.BACK, this.glComparison[func], ref, mask);
      this.stencilFuncBack = func;
      this.stencilRefBack = ref;
      this.stencilMaskBack = mask;
    }
  }

  setStencilOperation(fail, zfail, zpass, writeMask) {
    if (this.stencilFailFront !== fail || this.stencilZfailFront !== zfail || this.stencilZpassFront !== zpass || this.stencilFailBack !== fail || this.stencilZfailBack !== zfail || this.stencilZpassBack !== zpass) {
      this.gl.stencilOp(this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
      this.stencilFailFront = this.stencilFailBack = fail;
      this.stencilZfailFront = this.stencilZfailBack = zfail;
      this.stencilZpassFront = this.stencilZpassBack = zpass;
    }

    if (this.stencilWriteMaskFront !== writeMask || this.stencilWriteMaskBack !== writeMask) {
      this.gl.stencilMask(writeMask);
      this.stencilWriteMaskFront = writeMask;
      this.stencilWriteMaskBack = writeMask;
    }
  }

  setStencilOperationFront(fail, zfail, zpass, writeMask) {
    if (this.stencilFailFront !== fail || this.stencilZfailFront !== zfail || this.stencilZpassFront !== zpass) {
      this.gl.stencilOpSeparate(this.gl.FRONT, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
      this.stencilFailFront = fail;
      this.stencilZfailFront = zfail;
      this.stencilZpassFront = zpass;
    }

    if (this.stencilWriteMaskFront !== writeMask) {
      this.gl.stencilMaskSeparate(this.gl.FRONT, writeMask);
      this.stencilWriteMaskFront = writeMask;
    }
  }

  setStencilOperationBack(fail, zfail, zpass, writeMask) {
    if (this.stencilFailBack !== fail || this.stencilZfailBack !== zfail || this.stencilZpassBack !== zpass) {
      this.gl.stencilOpSeparate(this.gl.BACK, this.glStencilOp[fail], this.glStencilOp[zfail], this.glStencilOp[zpass]);
      this.stencilFailBack = fail;
      this.stencilZfailBack = zfail;
      this.stencilZpassBack = zpass;
    }

    if (this.stencilWriteMaskBack !== writeMask) {
      this.gl.stencilMaskSeparate(this.gl.BACK, writeMask);
      this.stencilWriteMaskBack = writeMask;
    }
  }

  setBlendFunction(blendSrc, blendDst) {
    if (this.blendSrc !== blendSrc || this.blendDst !== blendDst || this.separateAlphaBlend) {
      this.gl.blendFunc(this.glBlendFunction[blendSrc], this.glBlendFunction[blendDst]);
      this.blendSrc = blendSrc;
      this.blendDst = blendDst;
      this.separateAlphaBlend = false;
    }
  }

  setBlendFunctionSeparate(blendSrc, blendDst, blendSrcAlpha, blendDstAlpha) {
    if (this.blendSrc !== blendSrc || this.blendDst !== blendDst || this.blendSrcAlpha !== blendSrcAlpha || this.blendDstAlpha !== blendDstAlpha || !this.separateAlphaBlend) {
      this.gl.blendFuncSeparate(this.glBlendFunction[blendSrc], this.glBlendFunction[blendDst], this.glBlendFunction[blendSrcAlpha], this.glBlendFunction[blendDstAlpha]);
      this.blendSrc = blendSrc;
      this.blendDst = blendDst;
      this.blendSrcAlpha = blendSrcAlpha;
      this.blendDstAlpha = blendDstAlpha;
      this.separateAlphaBlend = true;
    }
  }

  setBlendEquation(blendEquation) {
    if (this.blendEquation !== blendEquation || this.separateAlphaEquation) {
      this.gl.blendEquation(this.glBlendEquation[blendEquation]);
      this.blendEquation = blendEquation;
      this.separateAlphaEquation = false;
    }
  }

  setBlendEquationSeparate(blendEquation, blendAlphaEquation) {
    if (this.blendEquation !== blendEquation || this.blendAlphaEquation !== blendAlphaEquation || !this.separateAlphaEquation) {
      this.gl.blendEquationSeparate(this.glBlendEquation[blendEquation], this.glBlendEquation[blendAlphaEquation]);
      this.blendEquation = blendEquation;
      this.blendAlphaEquation = blendAlphaEquation;
      this.separateAlphaEquation = true;
    }
  }

  setBlendColor(r, g, b, a) {
    const c = this.blendColor;

    if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
      this.gl.blendColor(r, g, b, a);
      c.set(r, g, b, a);
    }
  }

  setCullMode(cullMode) {
    if (this.cullMode !== cullMode) {
      if (cullMode === CULLFACE_NONE) {
        this.gl.disable(this.gl.CULL_FACE);
      } else {
        if (this.cullMode === CULLFACE_NONE) {
          this.gl.enable(this.gl.CULL_FACE);
        }

        const mode = this.glCull[cullMode];

        if (this.cullFace !== mode) {
          this.gl.cullFace(mode);
          this.cullFace = mode;
        }
      }

      this.cullMode = cullMode;
    }
  }

  getCullMode() {
    return this.cullMode;
  }

  setShader(shader) {
    if (shader !== this.shader) {
      if (shader.failed) {
        return false;
      } else if (!shader.ready && !shader.impl.postLink(this, shader)) {
        shader.failed = true;
        return false;
      }

      this.shader = shader;
      this.gl.useProgram(shader.impl.glProgram);
      this._shaderSwitchesPerFrame++;
      this.attributesInvalidated = true;
    }

    return true;
  }

  getHdrFormat() {
    if (this.textureHalfFloatRenderable) {
      return PIXELFORMAT_RGBA16F;
    } else if (this.textureFloatRenderable) {
      return PIXELFORMAT_RGBA32F;
    }

    return PIXELFORMAT_R8_G8_B8_A8;
  }

  clearShaderCache() {
    const gl = this.gl;

    for (const shaderSrc in this.fragmentShaderCache) {
      gl.deleteShader(this.fragmentShaderCache[shaderSrc]);
      delete this.fragmentShaderCache[shaderSrc];
    }

    for (const shaderSrc in this.vertexShaderCache) {
      gl.deleteShader(this.vertexShaderCache[shaderSrc]);
      delete this.vertexShaderCache[shaderSrc];
    }

    this.programLib.clearCache();
  }

  clearVertexArrayObjectCache() {
    const gl = this.gl;

    this._vaoMap.forEach((item, key, mapObj) => {
      gl.deleteVertexArray(item);
    });

    this._vaoMap.clear();
  }

  removeShaderFromCache(shader) {
    this.programLib.removeFromCache(shader);
  }

  get width() {
    return this.gl.drawingBufferWidth || this.canvas.width;
  }

  get height() {
    return this.gl.drawingBufferHeight || this.canvas.height;
  }

  set fullscreen(fullscreen) {
    if (fullscreen) {
      const canvas = this.gl.canvas;
      canvas.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  get fullscreen() {
    return !!document.fullscreenElement;
  }

  get textureFloatHighPrecision() {
    if (this._textureFloatHighPrecision === undefined) {
      this._textureFloatHighPrecision = testTextureFloatHighPrecision(this);
    }

    return this._textureFloatHighPrecision;
  }

  get textureHalfFloatUpdatable() {
    if (this._textureHalfFloatUpdatable === undefined) {
      if (this.webgl2) {
        this._textureHalfFloatUpdatable = true;
      } else {
        this._textureHalfFloatUpdatable = testTextureHalfFloatUpdatable(this.gl, this.extTextureHalfFloat.HALF_FLOAT_OES);
      }
    }

    return this._textureHalfFloatUpdatable;
  }

}

export { WebglGraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNldHVwVmVydGV4QXJyYXlPYmplY3QgfSBmcm9tICcuLi8uLi9wb2x5ZmlsbC9PRVNWZXJ0ZXhBcnJheU9iamVjdC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcblxuaW1wb3J0IHtcbiAgICBERVZJQ0VUWVBFX1dFQkdMLFxuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBCTEVOREVRVUFUSU9OX0FERCxcbiAgICBCTEVORE1PREVfWkVSTywgQkxFTkRNT0RFX09ORSxcbiAgICBDTEVBUkZMQUdfQ09MT1IsIENMRUFSRkxBR19ERVBUSCwgQ0xFQVJGTEFHX1NURU5DSUwsXG4gICAgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfTk9ORSxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIEZVTkNfQUxXQVlTLCBGVU5DX0xFU1NFUVVBTCxcbiAgICBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBTVEVOQ0lMT1BfS0VFUCxcbiAgICBVTklGT1JNVFlQRV9CT09MLCBVTklGT1JNVFlQRV9JTlQsIFVOSUZPUk1UWVBFX0ZMT0FULCBVTklGT1JNVFlQRV9WRUMyLCBVTklGT1JNVFlQRV9WRUMzLFxuICAgIFVOSUZPUk1UWVBFX1ZFQzQsIFVOSUZPUk1UWVBFX0lWRUMyLCBVTklGT1JNVFlQRV9JVkVDMywgVU5JRk9STVRZUEVfSVZFQzQsIFVOSUZPUk1UWVBFX0JWRUMyLFxuICAgIFVOSUZPUk1UWVBFX0JWRUMzLCBVTklGT1JNVFlQRV9CVkVDNCwgVU5JRk9STVRZUEVfTUFUMiwgVU5JRk9STVRZUEVfTUFUMywgVU5JRk9STVRZUEVfTUFUNCxcbiAgICBVTklGT1JNVFlQRV9URVhUVVJFMkQsIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFLCBVTklGT1JNVFlQRV9GTE9BVEFSUkFZLCBVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XLFxuICAgIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVywgVU5JRk9STVRZUEVfVEVYVFVSRTNELCBVTklGT1JNVFlQRV9WRUMyQVJSQVksIFVOSUZPUk1UWVBFX1ZFQzNBUlJBWSwgVU5JRk9STVRZUEVfVkVDNEFSUkFZLFxuICAgIHNlbWFudGljVG9Mb2NhdGlvblxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaGFkZXJGcm9tQ29kZSB9IGZyb20gJy4uL3Byb2dyYW0tbGliL3V0aWxzLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4uL3NpbXBsZS1wb3N0LWVmZmVjdC5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi9wcm9ncmFtLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL2RlYnVnLWdyYXBoaWNzLmpzJztcblxuaW1wb3J0IHsgV2ViZ2xWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuL3dlYmdsLXZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xJbmRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ2wtaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFdlYmdsU2hhZGVyIH0gZnJvbSAnLi93ZWJnbC1zaGFkZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xUZXh0dXJlIH0gZnJvbSAnLi93ZWJnbC10ZXh0dXJlLmpzJztcbmltcG9ydCB7IFdlYmdsUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi93ZWJnbC1yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vbWF0aC9jb2xvci5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9pbmRleC1idWZmZXIuanMnKS5JbmRleEJ1ZmZlcn0gSW5kZXhCdWZmZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9zaGFkZXIuanMnKS5TaGFkZXJ9IFNoYWRlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3ZlcnRleC1idWZmZXIuanMnKS5WZXJ0ZXhCdWZmZXJ9IFZlcnRleEJ1ZmZlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc30gUmVuZGVyUGFzcyAqL1xuXG5jb25zdCBpbnZhbGlkYXRlQXR0YWNobWVudHMgPSBbXTtcblxuZnVuY3Rpb24gdGVzdFJlbmRlcmFibGUoZ2wsIHBpeGVsRm9ybWF0KSB7XG4gICAgbGV0IHJlc3VsdCA9IHRydWU7XG5cbiAgICAvLyBDcmVhdGUgYSAyeDIgdGV4dHVyZVxuICAgIGNvbnN0IHRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIDIsIDIsIDAsIGdsLlJHQkEsIHBpeGVsRm9ybWF0LCBudWxsKTtcblxuICAgIC8vIFRyeSB0byB1c2UgdGhpcyB0ZXh0dXJlIGFzIGEgcmVuZGVyIHRhcmdldFxuICAgIGNvbnN0IGZyYW1lYnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKTtcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGZyYW1lYnVmZmVyKTtcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHRleHR1cmUsIDApO1xuXG4gICAgLy8gSXQgaXMgbGVnYWwgZm9yIGEgV2ViR0wgaW1wbGVtZW50YXRpb24gZXhwb3NpbmcgdGhlIE9FU190ZXh0dXJlX2Zsb2F0IGV4dGVuc2lvbiB0b1xuICAgIC8vIHN1cHBvcnQgZmxvYXRpbmctcG9pbnQgdGV4dHVyZXMgYnV0IG5vdCBhcyBhdHRhY2htZW50cyB0byBmcmFtZWJ1ZmZlciBvYmplY3RzLlxuICAgIGlmIChnbC5jaGVja0ZyYW1lYnVmZmVyU3RhdHVzKGdsLkZSQU1FQlVGRkVSKSAhPT0gZ2wuRlJBTUVCVUZGRVJfQ09NUExFVEUpIHtcbiAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gQ2xlYW4gdXBcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBudWxsKTtcbiAgICBnbC5kZWxldGVUZXh0dXJlKHRleHR1cmUpO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG4gICAgZ2wuZGVsZXRlRnJhbWVidWZmZXIoZnJhbWVidWZmZXIpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gdGVzdFRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUoZ2wsIHBpeGVsRm9ybWF0KSB7XG4gICAgbGV0IHJlc3VsdCA9IHRydWU7XG5cbiAgICAvLyBDcmVhdGUgYSAyeDIgdGV4dHVyZVxuICAgIGNvbnN0IHRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcblxuICAgIC8vIHVwbG9hZCBzb21lIGRhdGEgLSBvbiBpT1MgcHJpb3IgdG8gYWJvdXQgTm92ZW1iZXIgMjAxOSwgcGFzc2luZyBkYXRhIHRvIGhhbGYgdGV4dHVyZSB3b3VsZCBmYWlsIGhlcmVcbiAgICAvLyBzZWUgZGV0YWlscyBoZXJlOiBodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTY5OTk5XG4gICAgLy8gbm90ZSB0aGF0IGlmIG5vdCBzdXBwb3J0ZWQsIHRoaXMgcHJpbnRzIGFuIGVycm9yIHRvIGNvbnNvbGUsIHRoZSBlcnJvciBjYW4gYmUgc2FmZWx5IGlnbm9yZWQgYXMgaXQncyBoYW5kbGVkXG4gICAgY29uc3QgZGF0YSA9IG5ldyBVaW50MTZBcnJheSg0ICogMiAqIDIpO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgMiwgMiwgMCwgZ2wuUkdCQSwgcGl4ZWxGb3JtYXQsIGRhdGEpO1xuXG4gICAgaWYgKGdsLmdldEVycm9yKCkgIT09IGdsLk5PX0VSUk9SKSB7XG4gICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuICAgICAgICBjb25zb2xlLmxvZyhcIkFib3ZlIGVycm9yIHJlbGF0ZWQgdG8gSEFMRl9GTE9BVF9PRVMgY2FuIGJlIGlnbm9yZWQsIGl0IHdhcyB0cmlnZ2VyZWQgYnkgdGVzdGluZyBoYWxmIGZsb2F0IHRleHR1cmUgc3VwcG9ydFwiKTtcbiAgICB9XG5cbiAgICAvLyBDbGVhbiB1cFxuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xuICAgIGdsLmRlbGV0ZVRleHR1cmUodGV4dHVyZSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiB0ZXN0VGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbihkZXZpY2UpIHtcbiAgICBpZiAoIWRldmljZS50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCB0ZXN0MSA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKGRldmljZSwgc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlMsIHNoYWRlckNodW5rcy5wcmVjaXNpb25UZXN0UFMsIFwicHRlc3QxXCIpO1xuICAgIGNvbnN0IHRlc3QyID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZGV2aWNlLCBzaGFkZXJDaHVua3MuZnVsbHNjcmVlblF1YWRWUywgc2hhZGVyQ2h1bmtzLnByZWNpc2lvblRlc3QyUFMsIFwicHRlc3QyXCIpO1xuXG4gICAgY29uc3QgdGV4dHVyZU9wdGlvbnMgPSB7XG4gICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICAgICAgd2lkdGg6IDEsXG4gICAgICAgIGhlaWdodDogMSxcbiAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgIG1pbkZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgIG5hbWU6ICd0ZXN0RkhQJ1xuICAgIH07XG4gICAgY29uc3QgdGV4MSA9IG5ldyBUZXh0dXJlKGRldmljZSwgdGV4dHVyZU9wdGlvbnMpO1xuICAgIGNvbnN0IHRhcmcxID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgxLFxuICAgICAgICBkZXB0aDogZmFsc2VcbiAgICB9KTtcbiAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0YXJnMSwgdGVzdDEpO1xuXG4gICAgdGV4dHVyZU9wdGlvbnMuZm9ybWF0ID0gUElYRUxGT1JNQVRfUjhfRzhfQjhfQTg7XG4gICAgY29uc3QgdGV4MiA9IG5ldyBUZXh0dXJlKGRldmljZSwgdGV4dHVyZU9wdGlvbnMpO1xuICAgIGNvbnN0IHRhcmcyID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgyLFxuICAgICAgICBkZXB0aDogZmFsc2VcbiAgICB9KTtcbiAgICBkZXZpY2UuY29uc3RhbnRUZXhTb3VyY2Uuc2V0VmFsdWUodGV4MSk7XG4gICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZzIsIHRlc3QyKTtcblxuICAgIGNvbnN0IHByZXZGcmFtZWJ1ZmZlciA9IGRldmljZS5hY3RpdmVGcmFtZWJ1ZmZlcjtcbiAgICBkZXZpY2Uuc2V0RnJhbWVidWZmZXIodGFyZzIuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG5cbiAgICBjb25zdCBwaXhlbHMgPSBuZXcgVWludDhBcnJheSg0KTtcbiAgICBkZXZpY2UucmVhZFBpeGVscygwLCAwLCAxLCAxLCBwaXhlbHMpO1xuXG4gICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHByZXZGcmFtZWJ1ZmZlcik7XG5cbiAgICBjb25zdCB4ID0gcGl4ZWxzWzBdIC8gMjU1O1xuICAgIGNvbnN0IHkgPSBwaXhlbHNbMV0gLyAyNTU7XG4gICAgY29uc3QgeiA9IHBpeGVsc1syXSAvIDI1NTtcbiAgICBjb25zdCB3ID0gcGl4ZWxzWzNdIC8gMjU1O1xuICAgIGNvbnN0IGYgPSB4IC8gKDI1NiAqIDI1NiAqIDI1NikgKyB5IC8gKDI1NiAqIDI1NikgKyB6IC8gMjU2ICsgdztcblxuICAgIHRleDEuZGVzdHJveSgpO1xuICAgIHRhcmcxLmRlc3Ryb3koKTtcbiAgICB0ZXgyLmRlc3Ryb3koKTtcbiAgICB0YXJnMi5kZXN0cm95KCk7XG5cbiAgICByZXR1cm4gZiA9PT0gMDtcbn1cblxuLy8gSW1hZ2VCaXRtYXAgY3VycmVudCBzdGF0ZSAoU2VwIDIwMjIpOlxuLy8gLSBMYXN0ZXN0IENocm9tZSBhbmQgRmlyZWZveCBicm93c2VycyBhcHBlYXIgdG8gc3VwcG9ydCB0aGUgSW1hZ2VCaXRtYXAgQVBJIGZpbmUgKHRob3VnaFxuLy8gICB0aGVyZSBhcmUgbGlrZWx5IHN0aWxsIGlzc3VlcyB3aXRoIG9sZGVyIHZlcnNpb25zIG9mIGJvdGgpLlxuLy8gLSBTYWZhcmkgc3VwcG9ydHMgdGhlIEFQSSwgYnV0IGNvbXBsZXRlbHkgZGVzdHJveXMgc29tZSBwbmdzLiBGb3IgZXhhbXBsZSB0aGUgY3ViZW1hcHMgaW5cbi8vICAgc3RlYW1wdW5rIHNsb3RzIGh0dHBzOi8vcGxheWNhbnZhcy5jb20vZWRpdG9yL3NjZW5lLzUyNDg1OC4gU2VlIHRoZSB3ZWJraXQgaXNzdWVcbi8vICAgaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE4MjQyNCBmb3Igc3RhdHVzLlxuLy8gLSBTb21lIGFwcGxpY2F0aW9ucyBhc3N1bWUgdGhhdCBQTkdzIGxvYWRlZCBieSB0aGUgZW5naW5lIHVzZSBIVE1MSW1hZ2VCaXRtYXAgaW50ZXJmYWNlIGFuZFxuLy8gICBmYWlsIHdoZW4gdXNpbmcgSW1hZ2VCaXRtYXAuIEZvciBleGFtcGxlLCBTcGFjZSBCYXNlIHByb2plY3QgZmFpbHMgYmVjYXVzZSBpdCB1c2VzIGVuZ2luZVxuLy8gICB0ZXh0dXJlIGFzc2V0cyBvbiB0aGUgZG9tIGh0dHBzOi8vcGxheWNhbnZhcy5jb20vZWRpdG9yL3NjZW5lLzQ0NjI3OC5cblxuLy8gVGhpcyBmdW5jdGlvbiB0ZXN0cyB3aGV0aGVyIHRoZSBjdXJyZW50IGJyb3dzZXIgZGVzdHJveXMgUE5HIGRhdGEgb3Igbm90LlxuZnVuY3Rpb24gdGVzdEltYWdlQml0bWFwKGRldmljZSkge1xuICAgIC8vIDF4MSBwbmcgaW1hZ2UgY29udGFpbmluZyByZ2JhKDEsIDIsIDMsIDYzKVxuICAgIGNvbnN0IHBuZ0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAxMzcsIDgwLCA3OCwgNzEsIDEzLCAxMCwgMjYsIDEwLCAwLCAwLCAwLCAxMywgNzMsIDcyLCA2OCwgODIsIDAsIDAsIDAsIDEsIDAsIDAsIDAsIDEsIDgsIDYsIDAsIDAsIDAsIDMxLCAyMSxcbiAgICAgICAgMTk2LCAxMzcsIDAsIDAsIDAsIDEzLCA3MywgNjgsIDY1LCA4NCwgMTIwLCAyMTgsIDk5LCAxMDAsIDEwMCwgOTgsIDE4MiwgNywgMCwgMCwgODksIDAsIDcxLCA2NywgMTMzLCAxNDgsIDIzNyxcbiAgICAgICAgMCwgMCwgMCwgMCwgNzMsIDY5LCA3OCwgNjgsIDE3NCwgNjYsIDk2LCAxMzBcbiAgICBdKTtcblxuICAgIHJldHVybiBjcmVhdGVJbWFnZUJpdG1hcChuZXcgQmxvYihbcG5nQnl0ZXNdLCB7IHR5cGU6ICdpbWFnZS9wbmcnIH0pLCB7IHByZW11bHRpcGx5QWxwaGE6ICdub25lJyB9KVxuICAgICAgICAudGhlbigoaW1hZ2UpID0+IHtcbiAgICAgICAgICAgIC8vIGNyZWF0ZSB0aGUgdGV4dHVyZVxuICAgICAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICAgICAgICAgIHdpZHRoOiAxLFxuICAgICAgICAgICAgICAgIGhlaWdodDogMSxcbiAgICAgICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LFxuICAgICAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGxldmVsczogW2ltYWdlXVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIHJlYWQgcGl4ZWxzXG4gICAgICAgICAgICBjb25zdCBydCA9IG5ldyBSZW5kZXJUYXJnZXQoeyBjb2xvckJ1ZmZlcjogdGV4dHVyZSwgZGVwdGg6IGZhbHNlIH0pO1xuICAgICAgICAgICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHJ0LmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuICAgICAgICAgICAgZGV2aWNlLmluaXRSZW5kZXJUYXJnZXQocnQpO1xuXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KDQpO1xuICAgICAgICAgICAgZGV2aWNlLmdsLnJlYWRQaXhlbHMoMCwgMCwgMSwgMSwgZGV2aWNlLmdsLlJHQkEsIGRldmljZS5nbC5VTlNJR05FRF9CWVRFLCBkYXRhKTtcblxuICAgICAgICAgICAgcnQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGV4dHVyZS5kZXN0cm95KCk7XG5cbiAgICAgICAgICAgIHJldHVybiBkYXRhWzBdID09PSAxICYmIGRhdGFbMV0gPT09IDIgJiYgZGF0YVsyXSA9PT0gMyAmJiBkYXRhWzNdID09PSA2MztcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGUgPT4gZmFsc2UpO1xufVxuXG4vKipcbiAqIFRoZSBncmFwaGljcyBkZXZpY2UgbWFuYWdlcyB0aGUgdW5kZXJseWluZyBncmFwaGljcyBjb250ZXh0LiBJdCBpcyByZXNwb25zaWJsZSBmb3Igc3VibWl0dGluZ1xuICogcmVuZGVyIHN0YXRlIGNoYW5nZXMgYW5kIGdyYXBoaWNzIHByaW1pdGl2ZXMgdG8gdGhlIGhhcmR3YXJlLiBBIGdyYXBoaWNzIGRldmljZSBpcyB0aWVkIHRvIGFcbiAqIHNwZWNpZmljIGNhbnZhcyBIVE1MIGVsZW1lbnQuIEl0IGlzIHZhbGlkIHRvIGhhdmUgbW9yZSB0aGFuIG9uZSBjYW52YXMgZWxlbWVudCBwZXIgcGFnZSBhbmRcbiAqIGNyZWF0ZSBhIG5ldyBncmFwaGljcyBkZXZpY2UgYWdhaW5zdCBlYWNoLlxuICpcbiAqIEBhdWdtZW50cyBHcmFwaGljc0RldmljZVxuICovXG5jbGFzcyBXZWJnbEdyYXBoaWNzRGV2aWNlIGV4dGVuZHMgR3JhcGhpY3NEZXZpY2Uge1xuICAgIC8qKlxuICAgICAqIFRoZSBXZWJHTCBjb250ZXh0IG1hbmFnZWQgYnkgdGhlIGdyYXBoaWNzIGRldmljZS4gVGhlIHR5cGUgY291bGQgYWxzbyB0ZWNobmljYWxseSBiZVxuICAgICAqIGBXZWJHTFJlbmRlcmluZ0NvbnRleHRgIGlmIFdlYkdMIDIuMCBpcyBub3QgYXZhaWxhYmxlLiBCdXQgaW4gb3JkZXIgZm9yIEludGVsbGlTZW5zZSB0byBiZVxuICAgICAqIGFibGUgdG8gZnVuY3Rpb24gZm9yIGFsbCBXZWJHTCBjYWxscyBpbiB0aGUgY29kZWJhc2UsIHdlIHNwZWNpZnkgYFdlYkdMMlJlbmRlcmluZ0NvbnRleHRgXG4gICAgICogaGVyZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge1dlYkdMMlJlbmRlcmluZ0NvbnRleHR9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdsO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgV2ViR0wgY29udGV4dCBvZiB0aGlzIGRldmljZSBpcyB1c2luZyB0aGUgV2ViR0wgMi4wIEFQSS4gSWYgZmFsc2UsIFdlYkdMIDEuMCBpc1xuICAgICAqIGJlaW5nIHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgd2ViZ2wyO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBXZWJnbEdyYXBoaWNzRGV2aWNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudH0gY2FudmFzIC0gVGhlIGNhbnZhcyB0byB3aGljaCB0aGUgZ3JhcGhpY3MgZGV2aWNlIHdpbGwgcmVuZGVyLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25zIHBhc3NlZCB3aGVuIGNyZWF0aW5nIHRoZSBXZWJHTCBjb250ZXh0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYWxwaGE9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIGlmIHRoZSBjYW52YXMgY29udGFpbnMgYW5cbiAgICAgKiBhbHBoYSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kZXB0aD10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGUgZHJhd2luZyBidWZmZXIgaXNcbiAgICAgKiByZXF1ZXN0ZWQgdG8gaGF2ZSBhIGRlcHRoIGJ1ZmZlciBvZiBhdCBsZWFzdCAxNiBiaXRzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc3RlbmNpbD1mYWxzZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhlIGRyYXdpbmcgYnVmZmVyIGlzXG4gICAgICogcmVxdWVzdGVkIHRvIGhhdmUgYSBzdGVuY2lsIGJ1ZmZlciBvZiBhdCBsZWFzdCA4IGJpdHMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbnRpYWxpYXM9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHdoZXRoZXIgb3Igbm90IHRvIHBlcmZvcm1cbiAgICAgKiBhbnRpLWFsaWFzaW5nIGlmIHBvc3NpYmxlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlbXVsdGlwbGllZEFscGhhPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBwYWdlXG4gICAgICogY29tcG9zaXRvciB3aWxsIGFzc3VtZSB0aGUgZHJhd2luZyBidWZmZXIgY29udGFpbnMgY29sb3JzIHdpdGggcHJlLW11bHRpcGxpZWQgYWxwaGEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcmVzZXJ2ZURyYXdpbmdCdWZmZXI9ZmFsc2VdIC0gSWYgdGhlIHZhbHVlIGlzIHRydWUgdGhlIGJ1ZmZlcnNcbiAgICAgKiB3aWxsIG5vdCBiZSBjbGVhcmVkIGFuZCB3aWxsIHByZXNlcnZlIHRoZWlyIHZhbHVlcyB1bnRpbCBjbGVhcmVkIG9yIG92ZXJ3cml0dGVuIGJ5IHRoZVxuICAgICAqIGF1dGhvci5cbiAgICAgKiBAcGFyYW0geydkZWZhdWx0J3wnaGlnaC1wZXJmb3JtYW5jZSd8J2xvdy1wb3dlcid9IFtvcHRpb25zLnBvd2VyUHJlZmVyZW5jZT0nZGVmYXVsdCddIC0gQVxuICAgICAqIGhpbnQgdG8gdGhlIHVzZXIgYWdlbnQgaW5kaWNhdGluZyB3aGF0IGNvbmZpZ3VyYXRpb24gb2YgR1BVIGlzIHN1aXRhYmxlIGZvciB0aGUgV2ViR0xcbiAgICAgKiBjb250ZXh0LiBQb3NzaWJsZSB2YWx1ZXMgYXJlOlxuICAgICAqXG4gICAgICogLSAnZGVmYXVsdCc6IExldCB0aGUgdXNlciBhZ2VudCBkZWNpZGUgd2hpY2ggR1BVIGNvbmZpZ3VyYXRpb24gaXMgbW9zdCBzdWl0YWJsZS4gVGhpcyBpcyB0aGVcbiAgICAgKiBkZWZhdWx0IHZhbHVlLlxuICAgICAqIC0gJ2hpZ2gtcGVyZm9ybWFuY2UnOiBQcmlvcml0aXplcyByZW5kZXJpbmcgcGVyZm9ybWFuY2Ugb3ZlciBwb3dlciBjb25zdW1wdGlvbi5cbiAgICAgKiAtICdsb3ctcG93ZXInOiBQcmlvcml0aXplcyBwb3dlciBzYXZpbmcgb3ZlciByZW5kZXJpbmcgcGVyZm9ybWFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZhaWxJZk1ham9yUGVyZm9ybWFuY2VDYXZlYXQ9ZmFsc2VdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyBpZiBhXG4gICAgICogY29udGV4dCB3aWxsIGJlIGNyZWF0ZWQgaWYgdGhlIHN5c3RlbSBwZXJmb3JtYW5jZSBpcyBsb3cgb3IgaWYgbm8gaGFyZHdhcmUgR1BVIGlzIGF2YWlsYWJsZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZWZlcldlYkdsMj10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgaWYgYSBXZWJHbDIgY29udGV4dFxuICAgICAqIHNob3VsZCBiZSBwcmVmZXJyZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kZXN5bmNocm9uaXplZD1mYWxzZV0gLSBCb29sZWFuIHRoYXQgaGludHMgdGhlIHVzZXIgYWdlbnQgdG9cbiAgICAgKiByZWR1Y2UgdGhlIGxhdGVuY3kgYnkgZGVzeW5jaHJvbml6aW5nIHRoZSBjYW52YXMgcGFpbnQgY3ljbGUgZnJvbSB0aGUgZXZlbnQgbG9vcC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnhyQ29tcGF0aWJsZV0gLSBCb29sZWFuIHRoYXQgaGludHMgdG8gdGhlIHVzZXIgYWdlbnQgdG8gdXNlIGFcbiAgICAgKiBjb21wYXRpYmxlIGdyYXBoaWNzIGFkYXB0ZXIgZm9yIGFuIGltbWVyc2l2ZSBYUiBkZXZpY2UuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY2FudmFzLCBvcHRpb25zID0ge30pIHtcbiAgICAgICAgc3VwZXIoY2FudmFzKTtcbiAgICAgICAgdGhpcy5kZXZpY2VUeXBlID0gREVWSUNFVFlQRV9XRUJHTDtcblxuICAgICAgICB0aGlzLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgLy8gdHJ1ZSBpZiB0aGUgZGVmYXVsdCBmcmFtZWJ1ZmZlciBoYXMgYWxwaGFcbiAgICAgICAgdGhpcy5kZWZhdWx0RnJhbWVidWZmZXJBbHBoYSA9IG9wdGlvbnMuYWxwaGE7XG5cbiAgICAgICAgdGhpcy51cGRhdGVDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgLy8gQWRkIGhhbmRsZXJzIGZvciB3aGVuIHRoZSBXZWJHTCBjb250ZXh0IGlzIGxvc3Qgb3IgcmVzdG9yZWRcbiAgICAgICAgdGhpcy5jb250ZXh0TG9zdCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dExvc3QgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5sb3NlQ29udGV4dCgpO1xuICAgICAgICAgICAgRGVidWcubG9nKCdwYy5HcmFwaGljc0RldmljZTogV2ViR0wgY29udGV4dCBsb3N0LicpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdkZXZpY2Vsb3N0Jyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIERlYnVnLmxvZygncGMuR3JhcGhpY3NEZXZpY2U6IFdlYkdMIGNvbnRleHQgcmVzdG9yZWQuJyk7XG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVDb250ZXh0KCk7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHRMb3N0ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2RldmljZXJlc3RvcmVkJyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gb3B0aW9ucyBkZWZhdWx0c1xuICAgICAgICBvcHRpb25zLnN0ZW5jaWwgPSB0cnVlO1xuICAgICAgICBpZiAoIW9wdGlvbnMucG93ZXJQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgICBvcHRpb25zLnBvd2VyUHJlZmVyZW5jZSA9ICdoaWdoLXBlcmZvcm1hbmNlJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICM0MTM2IC0gdHVybiBvZmYgYW50aWFsaWFzaW5nIG9uIEFwcGxlV2ViS2l0IGJyb3dzZXJzIDE1LjRcbiAgICAgICAgY29uc3QgdWEgPSAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcpICYmIG5hdmlnYXRvci51c2VyQWdlbnQ7XG4gICAgICAgIHRoaXMuZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZyA9IHVhICYmIHVhLmluY2x1ZGVzKCdBcHBsZVdlYktpdCcpICYmICh1YS5pbmNsdWRlcygnMTUuNCcpIHx8IHVhLmluY2x1ZGVzKCcxNV80JykpO1xuICAgICAgICBpZiAodGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nKSB7XG4gICAgICAgICAgICBvcHRpb25zLmFudGlhbGlhcyA9IGZhbHNlO1xuICAgICAgICAgICAgRGVidWcubG9nKFwiQW50aWFsaWFzaW5nIGhhcyBiZWVuIHR1cm5lZCBvZmYgZHVlIHRvIHJlbmRlcmluZyBpc3N1ZXMgb24gQXBwbGVXZWJLaXQgMTUuNFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJldHJpZXZlIHRoZSBXZWJHTCBjb250ZXh0XG4gICAgICAgIGNvbnN0IHByZWZlcldlYkdsMiA9IChvcHRpb25zLnByZWZlcldlYkdsMiAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMucHJlZmVyV2ViR2wyIDogdHJ1ZTtcblxuICAgICAgICBjb25zdCBuYW1lcyA9IHByZWZlcldlYkdsMiA/IFtcIndlYmdsMlwiLCBcIndlYmdsXCIsIFwiZXhwZXJpbWVudGFsLXdlYmdsXCJdIDogW1wid2ViZ2xcIiwgXCJleHBlcmltZW50YWwtd2ViZ2xcIl07XG4gICAgICAgIGxldCBnbCA9IG51bGw7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGdsID0gY2FudmFzLmdldENvbnRleHQobmFtZXNbaV0sIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICBpZiAoZ2wpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndlYmdsMiA9IChuYW1lc1tpXSA9PT0gJ3dlYmdsMicpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFnbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiV2ViR0wgbm90IHN1cHBvcnRlZFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzQ2hyb21lID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIXdpbmRvdy5jaHJvbWU7XG4gICAgICAgIGNvbnN0IGlzTWFjID0gcGxhdGZvcm0uYnJvd3NlciAmJiBuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMTtcblxuICAgICAgICB0aGlzLmdsID0gZ2w7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB0ZXh0dXJlIHVuaXQgd29ya2Fyb3VuZCBvbiBkZXNrdG9wIHNhZmFyaVxuICAgICAgICB0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIXdpbmRvdy5zYWZhcmk7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciBnbEJsaXRGcmFtZWJ1ZmZlciBmYWlsaW5nIG9uIE1hYyBDaHJvbWUgKCMyNTA0KVxuICAgICAgICB0aGlzLl90ZW1wTWFjQ2hyb21lQmxpdEZyYW1lYnVmZmVyV29ya2Fyb3VuZCA9IGlzTWFjICYmIGlzQ2hyb21lICYmICFvcHRpb25zLmFscGhhO1xuXG4gICAgICAgIC8vIGluaXQgcG9seWZpbGwgZm9yIFZBT3MgdW5kZXIgd2ViZ2wxXG4gICAgICAgIGlmICghdGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHNldHVwVmVydGV4QXJyYXlPYmplY3QoZ2wpO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRsb3N0XCIsIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciwgZmFsc2UpO1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dHJlc3RvcmVkXCIsIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVFeHRlbnNpb25zKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNhcGFiaWxpdGllcygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVSZW5kZXJTdGF0ZSgpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gc3RhcnQgYXN5bmMgaW1hZ2UgYml0bWFwIHRlc3RcbiAgICAgICAgdGhpcy5zdXBwb3J0c0ltYWdlQml0bWFwID0gbnVsbDtcbiAgICAgICAgaWYgKHR5cGVvZiBJbWFnZUJpdG1hcCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRlc3RJbWFnZUJpdG1hcCh0aGlzKS50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnN1cHBvcnRzSW1hZ2VCaXRtYXAgPSByZXN1bHQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGVmYXVsdENsZWFyT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGNvbG9yOiBbMCwgMCwgMCwgMV0sXG4gICAgICAgICAgICBkZXB0aDogMSxcbiAgICAgICAgICAgIHN0ZW5jaWw6IDAsXG4gICAgICAgICAgICBmbGFnczogQ0xFQVJGTEFHX0NPTE9SIHwgQ0xFQVJGTEFHX0RFUFRIXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nbEFkZHJlc3MgPSBbXG4gICAgICAgICAgICBnbC5SRVBFQVQsXG4gICAgICAgICAgICBnbC5DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgZ2wuTUlSUk9SRURfUkVQRUFUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRXF1YXRpb24gPSBbXG4gICAgICAgICAgICBnbC5GVU5DX0FERCxcbiAgICAgICAgICAgIGdsLkZVTkNfU1VCVFJBQ1QsXG4gICAgICAgICAgICBnbC5GVU5DX1JFVkVSU0VfU1VCVFJBQ1QsXG4gICAgICAgICAgICB0aGlzLndlYmdsMiA/IGdsLk1JTiA6IHRoaXMuZXh0QmxlbmRNaW5tYXggPyB0aGlzLmV4dEJsZW5kTWlubWF4Lk1JTl9FWFQgOiBnbC5GVU5DX0FERCxcbiAgICAgICAgICAgIHRoaXMud2ViZ2wyID8gZ2wuTUFYIDogdGhpcy5leHRCbGVuZE1pbm1heCA/IHRoaXMuZXh0QmxlbmRNaW5tYXguTUFYX0VYVCA6IGdsLkZVTkNfQUREXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb24gPSBbXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuT05FLFxuICAgICAgICAgICAgZ2wuU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICAgICAgICAgIGdsLkRTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19EU1RfQ09MT1IsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEFfU0FUVVJBVEUsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBLFxuICAgICAgICAgICAgZ2wuRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICAgICAgICAgIGdsLkNPTlNUQU5UX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SLFxuICAgICAgICAgICAgZ2wuQ09OU1RBTlRfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEFcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQ29tcGFyaXNvbiA9IFtcbiAgICAgICAgICAgIGdsLk5FVkVSLFxuICAgICAgICAgICAgZ2wuTEVTUyxcbiAgICAgICAgICAgIGdsLkVRVUFMLFxuICAgICAgICAgICAgZ2wuTEVRVUFMLFxuICAgICAgICAgICAgZ2wuR1JFQVRFUixcbiAgICAgICAgICAgIGdsLk5PVEVRVUFMLFxuICAgICAgICAgICAgZ2wuR0VRVUFMLFxuICAgICAgICAgICAgZ2wuQUxXQVlTXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbFN0ZW5jaWxPcCA9IFtcbiAgICAgICAgICAgIGdsLktFRVAsXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuUkVQTEFDRSxcbiAgICAgICAgICAgIGdsLklOQ1IsXG4gICAgICAgICAgICBnbC5JTkNSX1dSQVAsXG4gICAgICAgICAgICBnbC5ERUNSLFxuICAgICAgICAgICAgZ2wuREVDUl9XUkFQLFxuICAgICAgICAgICAgZ2wuSU5WRVJUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbENsZWFyRmxhZyA9IFtcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBnbC5DT0xPUl9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuREVQVEhfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklUIHwgZ2wuQ09MT1JfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLlNURU5DSUxfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5TVEVOQ0lMX0JVRkZFUl9CSVQgfCBnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xDdWxsID0gW1xuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIGdsLkJBQ0ssXG4gICAgICAgICAgICBnbC5GUk9OVCxcbiAgICAgICAgICAgIGdsLkZST05UX0FORF9CQUNLXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEZpbHRlciA9IFtcbiAgICAgICAgICAgIGdsLk5FQVJFU1QsXG4gICAgICAgICAgICBnbC5MSU5FQVIsXG4gICAgICAgICAgICBnbC5ORUFSRVNUX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9MSU5FQVJcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsUHJpbWl0aXZlID0gW1xuICAgICAgICAgICAgZ2wuUE9JTlRTLFxuICAgICAgICAgICAgZ2wuTElORVMsXG4gICAgICAgICAgICBnbC5MSU5FX0xPT1AsXG4gICAgICAgICAgICBnbC5MSU5FX1NUUklQLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVTLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVfU1RSSVAsXG4gICAgICAgICAgICBnbC5UUklBTkdMRV9GQU5cbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsVHlwZSA9IFtcbiAgICAgICAgICAgIGdsLkJZVEUsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9CWVRFLFxuICAgICAgICAgICAgZ2wuU0hPUlQsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9TSE9SVCxcbiAgICAgICAgICAgIGdsLklOVCxcbiAgICAgICAgICAgIGdsLlVOU0lHTkVEX0lOVCxcbiAgICAgICAgICAgIGdsLkZMT0FUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlID0ge307XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MXSAgICAgICAgID0gVU5JRk9STVRZUEVfQk9PTDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9JTlQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF0gICAgICAgID0gVU5JRk9STVRZUEVfRkxPQVQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9WRUMyXSAgID0gVU5JRk9STVRZUEVfVkVDMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX1ZFQzNdICAgPSBVTklGT1JNVFlQRV9WRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfVkVDNF0gICA9IFVOSUZPUk1UWVBFX1ZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDMl0gICAgID0gVU5JRk9STVRZUEVfSVZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDM10gICAgID0gVU5JRk9STVRZUEVfSVZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDNF0gICAgID0gVU5JRk9STVRZUEVfSVZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzJdICAgID0gVU5JRk9STVRZUEVfQlZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzNdICAgID0gVU5JRk9STVRZUEVfQlZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzRdICAgID0gVU5JRk9STVRZUEVfQlZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9NQVQyXSAgID0gVU5JRk9STVRZUEVfTUFUMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX01BVDNdICAgPSBVTklGT1JNVFlQRV9NQVQzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfTUFUNF0gICA9IFVOSUZPUk1UWVBFX01BVDQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEXSAgID0gVU5JRk9STVRZUEVfVEVYVFVSRTJEO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFXSA9IFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEX1NIQURPV10gICA9IFVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFX1NIQURPV10gPSBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8zRF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9URVhUVVJFM0Q7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdCA9IHt9O1xuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdFtnbC5URVhUVVJFXzJEXSA9IDA7XG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90W2dsLlRFWFRVUkVfQ1VCRV9NQVBdID0gMTtcbiAgICAgICAgdGhpcy50YXJnZXRUb1Nsb3RbZ2wuVEVYVFVSRV8zRF0gPSAyO1xuXG4gICAgICAgIC8vIERlZmluZSB0aGUgdW5pZm9ybSBjb21taXQgZnVuY3Rpb25zXG4gICAgICAgIGxldCBzY29wZVgsIHNjb3BlWSwgc2NvcGVaLCBzY29wZVc7XG4gICAgICAgIGxldCB1bmlmb3JtVmFsdWU7XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb24gPSBbXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0udmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFpKHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JTlRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9GTE9BVF0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtLnZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xZih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLnZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2Z2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzJdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yaXYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CVkVDMl0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMyXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDM10gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2l2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUMzXSA9IHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzNdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUM0XSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQlZFQzRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDNF07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfTUFUMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtTWF0cml4MmZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9NQVQzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm1NYXRyaXgzZnYodW5pZm9ybS5sb2NhdGlvbklkLCBmYWxzZSwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX01BVDRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIGZhbHNlLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfRkxPQVRBUlJBWV0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0xZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMkFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDM0FSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0zZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDNEFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm00ZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0JvbmVUZXh0dXJlcyA9IHRoaXMuZXh0VGV4dHVyZUZsb2F0ICYmIHRoaXMubWF4VmVydGV4VGV4dHVyZXMgPiAwO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBhbiBlc3RpbWF0ZSBvZiB0aGUgbWF4aW11bSBudW1iZXIgb2YgYm9uZXMgdGhhdCBjYW4gYmUgdXBsb2FkZWQgdG8gdGhlIEdQVVxuICAgICAgICAvLyBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGF2YWlsYWJsZSB1bmlmb3JtcyBhbmQgdGhlIG51bWJlciBvZiB1bmlmb3JtcyByZXF1aXJlZCBmb3Igbm9uLVxuICAgICAgICAvLyBib25lIGRhdGEuICBUaGlzIGlzIGJhc2VkIG9mZiBvZiB0aGUgU3RhbmRhcmQgc2hhZGVyLiAgQSB1c2VyIGRlZmluZWQgc2hhZGVyIG1heSBoYXZlXG4gICAgICAgIC8vIGV2ZW4gbGVzcyBzcGFjZSBhdmFpbGFibGUgZm9yIGJvbmVzIHNvIHRoaXMgY2FsY3VsYXRlZCB2YWx1ZSBjYW4gYmUgb3ZlcnJpZGRlbiB2aWFcbiAgICAgICAgLy8gcGMuR3JhcGhpY3NEZXZpY2Uuc2V0Qm9uZUxpbWl0LlxuICAgICAgICBsZXQgbnVtVW5pZm9ybXMgPSB0aGlzLnZlcnRleFVuaWZvcm1zQ291bnQ7XG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBNb2RlbCwgdmlldywgcHJvamVjdGlvbiBhbmQgc2hhZG93IG1hdHJpY2VzXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDg7ICAgICAvLyA4IGxpZ2h0cyBtYXgsIGVhY2ggc3BlY2lmeWluZyBhIHBvc2l0aW9uIHZlY3RvclxuICAgICAgICBudW1Vbmlmb3JtcyAtPSAxOyAgICAgLy8gRXllIHBvc2l0aW9uXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBVcCB0byA0IHRleHR1cmUgdHJhbnNmb3Jtc1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGguZmxvb3IobnVtVW5pZm9ybXMgLyAzKTsgICAvLyBlYWNoIGJvbmUgdXNlcyAzIHVuaWZvcm1zXG5cbiAgICAgICAgLy8gUHV0IGEgbGltaXQgb24gdGhlIG51bWJlciBvZiBzdXBwb3J0ZWQgYm9uZXMgYmVmb3JlIHNraW4gcGFydGl0aW9uaW5nIG11c3QgYmUgcGVyZm9ybWVkXG4gICAgICAgIC8vIFNvbWUgR1BVcyBoYXZlIGRlbW9uc3RyYXRlZCBwZXJmb3JtYW5jZSBpc3N1ZXMgaWYgdGhlIG51bWJlciBvZiB2ZWN0b3JzIGFsbG9jYXRlZCB0byB0aGVcbiAgICAgICAgLy8gc2tpbiBtYXRyaXggcGFsZXR0ZSBpcyBsZWZ0IHVuYm91bmRlZFxuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGgubWluKHRoaXMuYm9uZUxpbWl0LCAxMjgpO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza2VkUmVuZGVyZXIgPT09ICdNYWxpLTQ1MCBNUCcpIHtcbiAgICAgICAgICAgIHRoaXMuYm9uZUxpbWl0ID0gMzQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnN0YW50VGV4U291cmNlID0gdGhpcy5zY29wZS5yZXNvbHZlKFwic291cmNlXCIpO1xuXG4gICAgICAgIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wyIGZsb2F0IHRleHR1cmUgcmVuZGVyYWJpbGl0eSBpcyBkaWN0YXRlZCBieSB0aGUgRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBleHRlbnNpb25cbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSAhIXRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wxIHdlIHNob3VsZCBqdXN0IHRyeSByZW5kZXJpbmcgaW50byBhIGZsb2F0IHRleHR1cmVcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSB0ZXN0UmVuZGVyYWJsZShnbCwgZ2wuRkxPQVQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0d28gZXh0ZW5zaW9ucyBhbGxvdyB1cyB0byByZW5kZXIgdG8gaGFsZiBmbG9hdCBidWZmZXJzXG4gICAgICAgIGlmICh0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0KSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gISF0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0O1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBzaG91bGQgYWZmZWN0IGJvdGggZmxvYXQgYW5kIGhhbGZmbG9hdCBmb3JtYXRzXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9ICEhdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBNYW51YWwgcmVuZGVyIGNoZWNrIGZvciBoYWxmIGZsb2F0XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IHRlc3RSZW5kZXJhYmxlKGdsLCB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlID0gKHRoaXMubWF4UHJlY2lzaW9uID09PSBcImhpZ2hwXCIgJiYgdGhpcy5tYXhWZXJ0ZXhUZXh0dXJlcyA+PSAyKTtcblxuICAgICAgICB0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgdGhpcy5fc3BlY3Rvck1hcmtlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5fc3BlY3RvckN1cnJlbnRNYXJrZXIgPSBcIlwiO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBhcmVhIGxpZ2h0IExVVCBmb3JtYXQgLSBvcmRlciBvZiBwcmVmZXJlbmNlOiBoYWxmLCBmbG9hdCwgOGJpdFxuICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4O1xuICAgICAgICBpZiAodGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0ICYmIHRoaXMudGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSAmJiB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIpIHtcbiAgICAgICAgICAgIHRoaXMuYXJlYUxpZ2h0THV0Rm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCAmJiB0aGlzLmV4dFRleHR1cmVGbG9hdExpbmVhcikge1xuICAgICAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBMzJGO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSB0aGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiB0aGlzLmZlZWRiYWNrKSB7XG4gICAgICAgICAgICBnbC5kZWxldGVUcmFuc2Zvcm1GZWVkYmFjayh0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2xlYXJTaGFkZXJDYWNoZSgpO1xuICAgICAgICB0aGlzLmNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSgpO1xuXG4gICAgICAgIHRoaXMuY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmdsY29udGV4dGxvc3QnLCB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0cmVzdG9yZWQnLCB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5nbCA9IG51bGw7XG5cbiAgICAgICAgc3VwZXIucG9zdERlc3Ryb3koKTtcbiAgICB9XG5cbiAgICAvLyBwcm92aWRlIHdlYmdsIGltcGxlbWVudGF0aW9uIGZvciB0aGUgdmVydGV4IGJ1ZmZlclxuICAgIGNyZWF0ZVZlcnRleEJ1ZmZlckltcGwodmVydGV4QnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbFZlcnRleEJ1ZmZlcigpO1xuICAgIH1cblxuICAgIC8vIHByb3ZpZGUgd2ViZ2wgaW1wbGVtZW50YXRpb24gZm9yIHRoZSBpbmRleCBidWZmZXJcbiAgICBjcmVhdGVJbmRleEJ1ZmZlckltcGwoaW5kZXhCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbEluZGV4QnVmZmVyKGluZGV4QnVmZmVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVTaGFkZXJJbXBsKHNoYWRlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsU2hhZGVyKHNoYWRlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZUltcGwodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsVGV4dHVyZSgpO1xuICAgIH1cblxuICAgIGNyZWF0ZVJlbmRlclRhcmdldEltcGwocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xSZW5kZXJUYXJnZXQoKTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgdXBkYXRlTWFya2VyKCkge1xuICAgICAgICB0aGlzLl9zcGVjdG9yQ3VycmVudE1hcmtlciA9IHRoaXMuX3NwZWN0b3JNYXJrZXJzLmpvaW4oXCIgfCBcIikgKyBcIiAjIFwiO1xuICAgIH1cblxuICAgIHB1c2hNYXJrZXIobmFtZSkge1xuICAgICAgICBpZiAod2luZG93LnNwZWN0b3IpIHtcbiAgICAgICAgICAgIHRoaXMuX3NwZWN0b3JNYXJrZXJzLnB1c2gobmFtZSk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZU1hcmtlcigpO1xuICAgICAgICAgICAgd2luZG93LnNwZWN0b3Iuc2V0TWFya2VyKHRoaXMuX3NwZWN0b3JDdXJyZW50TWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBvcE1hcmtlcigpIHtcbiAgICAgICAgaWYgKHdpbmRvdy5zcGVjdG9yKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3BlY3Rvck1hcmtlcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3BlY3Rvck1hcmtlcnMucG9wKCk7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNYXJrZXIoKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zcGVjdG9yTWFya2Vycy5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zcGVjdG9yLnNldE1hcmtlcih0aGlzLl9zcGVjdG9yQ3VycmVudE1hcmtlcik7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuc3BlY3Rvci5jbGVhck1hcmtlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vICNlbmRpZlxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIHByZWNpc2lvbiBzdXBwb3J0ZWQgYnkgaW50cyBhbmQgZmxvYXRzIGluIHZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycy4gTm90ZSB0aGF0XG4gICAgICogZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0IGlzIG5vdCBndWFyYW50ZWVkIHRvIGJlIHByZXNlbnQgKHN1Y2ggYXMgc29tZSBpbnN0YW5jZXMgb2YgdGhlXG4gICAgICogZGVmYXVsdCBBbmRyb2lkIGJyb3dzZXIpLiBJbiB0aGlzIGNhc2UsIGFzc3VtZSBoaWdocCBpcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBcImhpZ2hwXCIsIFwibWVkaXVtcFwiIG9yIFwibG93cFwiXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldFByZWNpc2lvbigpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBsZXQgcHJlY2lzaW9uID0gXCJoaWdocFwiO1xuXG4gICAgICAgIGlmIChnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuVkVSVEVYX1NIQURFUiwgZ2wuSElHSF9GTE9BVCk7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuVkVSVEVYX1NIQURFUiwgZ2wuTUVESVVNX0ZMT0FUKTtcblxuICAgICAgICAgICAgY29uc3QgZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLkZSQUdNRU5UX1NIQURFUiwgZ2wuSElHSF9GTE9BVCk7XG4gICAgICAgICAgICBjb25zdCBmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5GUkFHTUVOVF9TSEFERVIsIGdsLk1FRElVTV9GTE9BVCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGhpZ2hwQXZhaWxhYmxlID0gdmVydGV4U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdC5wcmVjaXNpb24gPiAwICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdC5wcmVjaXNpb24gPiAwO1xuICAgICAgICAgICAgY29uc3QgbWVkaXVtcEF2YWlsYWJsZSA9IHZlcnRleFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdC5wcmVjaXNpb24gPiAwICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0LnByZWNpc2lvbiA+IDA7XG5cbiAgICAgICAgICAgIGlmICghaGlnaHBBdmFpbGFibGUpIHtcbiAgICAgICAgICAgICAgICBpZiAobWVkaXVtcEF2YWlsYWJsZSkge1xuICAgICAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSBcIm1lZGl1bXBcIjtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2FybihcIldBUk5JTkc6IGhpZ2hwIG5vdCBzdXBwb3J0ZWQsIHVzaW5nIG1lZGl1bXBcIik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gXCJsb3dwXCI7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJXQVJOSU5HOiBoaWdocCBhbmQgbWVkaXVtcCBub3Qgc3VwcG9ydGVkLCB1c2luZyBsb3dwXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcmVjaXNpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgZXh0ZW5zaW9ucyBwcm92aWRlZCBieSB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplRXh0ZW5zaW9ucygpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBjb25zdCBzdXBwb3J0ZWRFeHRlbnNpb25zID0gZ2wuZ2V0U3VwcG9ydGVkRXh0ZW5zaW9ucygpO1xuXG4gICAgICAgIGNvbnN0IGdldEV4dGVuc2lvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN1cHBvcnRlZEV4dGVuc2lvbnMuaW5kZXhPZihhcmd1bWVudHNbaV0pICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2wuZ2V0RXh0ZW5zaW9uKGFyZ3VtZW50c1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRJbnN0YW5jaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlTG9kID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRWZXJ0ZXhBcnJheU9iamVjdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dENvbG9yQnVmZmVyRmxvYXQgPSBnZXRFeHRlbnNpb24oJ0VYVF9jb2xvcl9idWZmZXJfZmxvYXQnKTtcbiAgICAgICAgICAgIC8vIE5vdGUgdGhhdCBGaXJlZm94IGV4cG9zZXMgRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5IHVuZGVyIFdlYkdMMiByYXRoZXIgdGhhblxuICAgICAgICAgICAgLy8gRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5X3dlYmdsMlxuICAgICAgICAgICAgdGhpcy5leHREaXNqb2ludFRpbWVyUXVlcnkgPSBnZXRFeHRlbnNpb24oJ0VYVF9kaXNqb2ludF90aW1lcl9xdWVyeV93ZWJnbDInLCAnRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5Jyk7XG4gICAgICAgICAgICB0aGlzLmV4dERlcHRoVGV4dHVyZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gZ2V0RXh0ZW5zaW9uKFwiRVhUX2JsZW5kX21pbm1heFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSBnZXRFeHRlbnNpb24oJ0VYVF9kcmF3X2J1ZmZlcnMnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0SW5zdGFuY2luZyA9IGdldEV4dGVuc2lvbihcIkFOR0xFX2luc3RhbmNlZF9hcnJheXNcIik7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zdGFsbCB0aGUgV2ViR0wgMiBJbnN0YW5jaW5nIEFQSSBmb3IgV2ViR0wgMS4wXG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ID0gdGhpcy5leHRJbnN0YW5jaW5nO1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQgPSBleHQuZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQgPSBleHQuZHJhd0VsZW1lbnRzSW5zdGFuY2VkQU5HTEUuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLnZlcnRleEF0dHJpYkRpdmlzb3IgPSBleHQudmVydGV4QXR0cmliRGl2aXNvckFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzID0gZ2V0RXh0ZW5zaW9uKFwiT0VTX3N0YW5kYXJkX2Rlcml2YXRpdmVzXCIpO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXQgPSBnZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9mbG9hdFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCA9IGdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2hhbGZfZmxvYXRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSBnZXRFeHRlbnNpb24oJ0VYVF9zaGFkZXJfdGV4dHVyZV9sb2QnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSBnZXRFeHRlbnNpb24oXCJPRVNfZWxlbWVudF9pbmRleF91aW50XCIpO1xuICAgICAgICAgICAgdGhpcy5leHRWZXJ0ZXhBcnJheU9iamVjdCA9IGdldEV4dGVuc2lvbihcIk9FU192ZXJ0ZXhfYXJyYXlfb2JqZWN0XCIpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAvLyBJbnN0YWxsIHRoZSBXZWJHTCAyIFZBTyBBUEkgZm9yIFdlYkdMIDEuMFxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3Q7XG4gICAgICAgICAgICAgICAgZ2wuY3JlYXRlVmVydGV4QXJyYXkgPSBleHQuY3JlYXRlVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5ID0gZXh0LmRlbGV0ZVZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5pc1ZlcnRleEFycmF5ID0gZXh0LmlzVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSA9IGV4dC5iaW5kVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGlzam9pbnRUaW1lclF1ZXJ5ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGVwdGhUZXh0dXJlID0gZ2wuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZXB0aF90ZXh0dXJlJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4dERlYnVnUmVuZGVyZXJJbmZvID0gZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZWJ1Z19yZW5kZXJlcl9pbmZvJyk7XG4gICAgICAgIHRoaXMuZXh0VGV4dHVyZUZsb2F0TGluZWFyID0gZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfZmxvYXRfbGluZWFyXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIgPSBnZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9oYWxmX2Zsb2F0X2xpbmVhclwiKTtcbiAgICAgICAgdGhpcy5leHRGbG9hdEJsZW5kID0gZ2V0RXh0ZW5zaW9uKFwiRVhUX2Zsb2F0X2JsZW5kXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYyA9IGdldEV4dGVuc2lvbignRVhUX3RleHR1cmVfZmlsdGVyX2FuaXNvdHJvcGljJywgJ1dFQktJVF9FWFRfdGV4dHVyZV9maWx0ZXJfYW5pc290cm9waWMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUVUQzEgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMxJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDID0gZ2V0RXh0ZW5zaW9uKCdXRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfcHZydGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9wdnJ0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyA9IGdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3MzdGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9zM3RjJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hdGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUFTVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hc3RjJyk7XG4gICAgICAgIHRoaXMuZXh0UGFyYWxsZWxTaGFkZXJDb21waWxlID0gZ2V0RXh0ZW5zaW9uKCdLSFJfcGFyYWxsZWxfc2hhZGVyX2NvbXBpbGUnKTtcblxuICAgICAgICAvLyBpT1MgZXhwb3NlcyB0aGlzIGZvciBoYWxmIHByZWNpc2lvbiByZW5kZXIgdGFyZ2V0cyBvbiBib3RoIFdlYmdsMSBhbmQgMiBmcm9tIGlPUyB2IDE0LjViZXRhXG4gICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQgPSBnZXRFeHRlbnNpb24oXCJFWFRfY29sb3JfYnVmZmVyX2hhbGZfZmxvYXRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIGNhcGFiaWxpdGllcyBvZiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplQ2FwYWJpbGl0aWVzKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCBleHQ7XG5cbiAgICAgICAgY29uc3QgdXNlckFnZW50ID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgPyBuYXZpZ2F0b3IudXNlckFnZW50IDogXCJcIjtcblxuICAgICAgICB0aGlzLm1heFByZWNpc2lvbiA9IHRoaXMucHJlY2lzaW9uID0gdGhpcy5nZXRQcmVjaXNpb24oKTtcblxuICAgICAgICBjb25zdCBjb250ZXh0QXR0cmlicyA9IGdsLmdldENvbnRleHRBdHRyaWJ1dGVzKCk7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNc2FhID0gY29udGV4dEF0dHJpYnMuYW50aWFsaWFzO1xuICAgICAgICB0aGlzLnN1cHBvcnRzU3RlbmNpbCA9IGNvbnRleHRBdHRyaWJzLnN0ZW5jaWw7XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0luc3RhbmNpbmcgPSAhIXRoaXMuZXh0SW5zdGFuY2luZztcblxuICAgICAgICAvLyBRdWVyeSBwYXJhbWV0ZXIgdmFsdWVzIGZyb20gdGhlIFdlYkdMIGNvbnRleHRcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhDdWJlTWFwU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhSZW5kZXJCdWZmZXJTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9SRU5ERVJCVUZGRVJfU0laRSk7XG4gICAgICAgIHRoaXMubWF4VGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heENvbWJpbmVkVGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heFZlcnRleFRleHR1cmVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9WRVJURVhfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMudmVydGV4VW5pZm9ybXNDb3VudCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRVbmlmb3Jtc0NvdW50ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMpO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMubWF4RHJhd0J1ZmZlcnMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0RSQVdfQlVGRkVSUyk7XG4gICAgICAgICAgICB0aGlzLm1heENvbG9yQXR0YWNobWVudHMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTE9SX0FUVEFDSE1FTlRTKTtcbiAgICAgICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfM0RfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dCA9IHRoaXMuZXh0RHJhd0J1ZmZlcnM7XG4gICAgICAgICAgICB0aGlzLm1heERyYXdCdWZmZXJzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfRFJBV19CVUZGRVJTX0VYVCkgOiAxO1xuICAgICAgICAgICAgdGhpcy5tYXhDb2xvckF0dGFjaG1lbnRzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfQ09MT1JfQVRUQUNITUVOVFNfRVhUKSA6IDE7XG4gICAgICAgICAgICB0aGlzLm1heFZvbHVtZVNpemUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHREZWJ1Z1JlbmRlcmVySW5mbztcbiAgICAgICAgdGhpcy51bm1hc2tlZFJlbmRlcmVyID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5VTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCkgOiAnJztcbiAgICAgICAgdGhpcy51bm1hc2tlZFZlbmRvciA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuVU5NQVNLRURfVkVORE9SX1dFQkdMKSA6ICcnO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIHdlIHN1cHBvcnQgR1BVIHBhcnRpY2xlcy4gQXQgdGhlIG1vbWVudCwgU2Ftc3VuZyBkZXZpY2VzIHdpdGggRXh5bm9zIChBUk0pIGVpdGhlciBjcmFzaCBvciByZW5kZXJcbiAgICAgICAgLy8gaW5jb3JyZWN0bHkgd2hlbiB1c2luZyBHUFUgZm9yIHBhcnRpY2xlcy4gU2VlOlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGxheWNhbnZhcy9lbmdpbmUvaXNzdWVzLzM5NjdcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BsYXljYW52YXMvZW5naW5lL2lzc3Vlcy8zNDE1XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wbGF5Y2FudmFzL2VuZ2luZS9pc3N1ZXMvNDUxNFxuICAgICAgICAvLyBFeGFtcGxlIFVBIG1hdGNoZXM6IFN0YXJ0aW5nICdTTScgYW5kIGFueSBjb21iaW5hdGlvbiBvZiBsZXR0ZXJzIG9yIG51bWJlcnM6XG4gICAgICAgIC8vIE1vemlsbGEvNS4wIChMaW51eCwgQW5kcm9pZCAxMjsgU00tRzk3MEYgQnVpbGQvU1AxQS4yMTA4MTIuMDE2OyB3dilcbiAgICAgICAgLy8gTW96aWxsYS81LjAgKExpbnV4LCBBbmRyb2lkIDEyOyBTTS1HOTcwRilcbiAgICAgICAgY29uc3Qgc2Ftc3VuZ01vZGVsUmVnZXggPSAvU00tW2EtekEtWjAtOV0rLztcbiAgICAgICAgdGhpcy5zdXBwb3J0c0dwdVBhcnRpY2xlcyA9ICEodGhpcy51bm1hc2tlZFZlbmRvciA9PT0gJ0FSTScgJiYgdXNlckFnZW50Lm1hdGNoKHNhbXN1bmdNb2RlbFJlZ2V4KSk7XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWM7XG4gICAgICAgIHRoaXMubWF4QW5pc290cm9weSA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuTUFYX1RFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUKSA6IDE7XG5cbiAgICAgICAgdGhpcy5zYW1wbGVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLlNBTVBMRVMpO1xuICAgICAgICB0aGlzLm1heFNhbXBsZXMgPSB0aGlzLndlYmdsMiAmJiAhdGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nID8gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9TQU1QTEVTKSA6IDE7XG5cbiAgICAgICAgLy8gRG9uJ3QgYWxsb3cgYXJlYSBsaWdodHMgb24gb2xkIGFuZHJvaWQgZGV2aWNlcywgdGhleSBvZnRlbiBmYWlsIHRvIGNvbXBpbGUgdGhlIHNoYWRlciwgcnVuIGl0IGluY29ycmVjdGx5IG9yIGFyZSB2ZXJ5IHNsb3cuXG4gICAgICAgIHRoaXMuc3VwcG9ydHNBcmVhTGlnaHRzID0gdGhpcy53ZWJnbDIgfHwgIXBsYXRmb3JtLmFuZHJvaWQ7XG5cbiAgICAgICAgLy8gQWxzbyBkbyBub3QgYWxsb3cgdGhlbSB3aGVuIHdlIG9ubHkgaGF2ZSBzbWFsbCBudW1iZXIgb2YgdGV4dHVyZSB1bml0c1xuICAgICAgICBpZiAodGhpcy5tYXhUZXh0dXJlcyA8PSA4KSB7XG4gICAgICAgICAgICB0aGlzLnN1cHBvcnRzQXJlYUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBpbml0aWFsIHJlbmRlciBzdGF0ZSBvbiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplUmVuZGVyU3RhdGUoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHJlbmRlciBzdGF0ZSB0byBhIGtub3duIHN0YXJ0IHN0YXRlXG4gICAgICAgIHRoaXMuYmxlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG5cbiAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgIHRoaXMuYmxlbmREc3QgPSBCTEVORE1PREVfWkVSTztcbiAgICAgICAgdGhpcy5ibGVuZFNyY0FscGhhID0gQkxFTkRNT0RFX09ORTtcbiAgICAgICAgdGhpcy5ibGVuZERzdEFscGhhID0gQkxFTkRNT0RFX1pFUk87XG4gICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUJsZW5kID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYmxlbmRFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICB0aGlzLmJsZW5kQWxwaGFFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICB0aGlzLnNlcGFyYXRlQWxwaGFFcXVhdGlvbiA9IGZhbHNlO1xuICAgICAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5aRVJPKTtcbiAgICAgICAgZ2wuYmxlbmRFcXVhdGlvbihnbC5GVU5DX0FERCk7XG5cbiAgICAgICAgdGhpcy5ibGVuZENvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDApO1xuICAgICAgICBnbC5ibGVuZENvbG9yKDAsIDAsIDAsIDApO1xuXG4gICAgICAgIHRoaXMud3JpdGVSZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlR3JlZW4gPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlQmx1ZSA9IHRydWU7XG4gICAgICAgIHRoaXMud3JpdGVBbHBoYSA9IHRydWU7XG4gICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuICAgICAgICB0aGlzLmN1bGxNb2RlID0gQ1VMTEZBQ0VfQkFDSztcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkNVTExfRkFDRSk7XG4gICAgICAgIGdsLmN1bGxGYWNlKGdsLkJBQ0spO1xuXG4gICAgICAgIHRoaXMuZGVwdGhUZXN0ID0gdHJ1ZTtcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuXG4gICAgICAgIHRoaXMuZGVwdGhGdW5jID0gRlVOQ19MRVNTRVFVQUw7XG4gICAgICAgIGdsLmRlcHRoRnVuYyhnbC5MRVFVQUwpO1xuXG4gICAgICAgIHRoaXMuZGVwdGhXcml0ZSA9IHRydWU7XG4gICAgICAgIGdsLmRlcHRoTWFzayh0cnVlKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWwgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuXG4gICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IHRoaXMuc3RlbmNpbEZ1bmNCYWNrID0gRlVOQ19BTFdBWVM7XG4gICAgICAgIHRoaXMuc3RlbmNpbFJlZkZyb250ID0gdGhpcy5zdGVuY2lsUmVmQmFjayA9IDA7XG4gICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IHRoaXMuc3RlbmNpbE1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbEZ1bmMoZ2wuQUxXQVlTLCAwLCAweEZGKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IFNURU5DSUxPUF9LRUVQO1xuICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gU1RFTkNJTE9QX0tFRVA7XG4gICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSBTVEVOQ0lMT1BfS0VFUDtcbiAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgPSAweEZGO1xuICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbE9wKGdsLktFRVAsIGdsLktFRVAsIGdsLktFRVApO1xuICAgICAgICBnbC5zdGVuY2lsTWFzaygweEZGKTtcblxuICAgICAgICB0aGlzLmFscGhhVG9Db3ZlcmFnZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnJhc3RlciA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5TQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UpO1xuICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5SQVNURVJJWkVSX0RJU0NBUkQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kZXB0aEJpYXNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIGdsLmRpc2FibGUoZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XG5cbiAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gMTtcbiAgICAgICAgZ2wuY2xlYXJEZXB0aCgxKTtcblxuICAgICAgICB0aGlzLmNsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMCk7XG4gICAgICAgIGdsLmNsZWFyQ29sb3IoMCwgMCwgMCwgMCk7XG5cbiAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWwgPSAwO1xuICAgICAgICBnbC5jbGVhclN0ZW5jaWwoMCk7XG5cbiAgICAgICAgLy8gQ2FjaGVkIHZpZXdwb3J0IGFuZCBzY2lzc29yIGRpbWVuc2lvbnNcbiAgICAgICAgdGhpcy52eCA9IHRoaXMudnkgPSB0aGlzLnZ3ID0gdGhpcy52aCA9IDA7XG4gICAgICAgIHRoaXMuc3ggPSB0aGlzLnN5ID0gdGhpcy5zdyA9IHRoaXMuc2ggPSAwO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgZ2wuaGludChnbC5GUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5ULCBnbC5OSUNFU1QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykge1xuICAgICAgICAgICAgICAgIGdsLmhpbnQodGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzLkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlRfT0VTLCBnbC5OSUNFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZ2wuZW5hYmxlKGdsLlNDSVNTT1JfVEVTVCk7XG5cbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTl9XRUJHTCwgZ2wuTk9ORSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZhbHNlO1xuICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gZmFsc2U7XG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgZmFsc2UpO1xuXG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19BTElHTk1FTlQsIDEpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCkge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuXG4gICAgICAgIC8vIFNoYWRlciBjb2RlIHRvIFdlYkdMIHNoYWRlciBjYWNoZVxuICAgICAgICB0aGlzLnZlcnRleFNoYWRlckNhY2hlID0ge307XG4gICAgICAgIHRoaXMuZnJhZ21lbnRTaGFkZXJDYWNoZSA9IHt9O1xuXG4gICAgICAgIC8vIGNhY2hlIG9mIFZBT3NcbiAgICAgICAgdGhpcy5fdmFvTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuICAgICAgICB0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5mZWVkYmFjayA9IG51bGw7XG4gICAgICAgIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudGV4dHVyZVVuaXQgPSAwO1xuICAgICAgICB0aGlzLnRleHR1cmVVbml0cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWF4Q29tYmluZWRUZXh0dXJlczsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0cy5wdXNoKFtudWxsLCBudWxsLCBudWxsXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgV2ViR0wgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIC8vIHJlbGVhc2Ugc2hhZGVyc1xuICAgICAgICBmb3IgKGNvbnN0IHNoYWRlciBvZiB0aGlzLnNoYWRlcnMpIHtcbiAgICAgICAgICAgIHNoYWRlci5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGNvbnN0IHRleHR1cmUgb2YgdGhpcy50ZXh0dXJlcykge1xuICAgICAgICAgICAgdGV4dHVyZS5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB2ZXJ0ZXggYW5kIGluZGV4IGJ1ZmZlcnNcbiAgICAgICAgZm9yIChjb25zdCBidWZmZXIgb2YgdGhpcy5idWZmZXJzKSB7XG4gICAgICAgICAgICBidWZmZXIubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc2V0IGFsbCByZW5kZXIgdGFyZ2V0cyBzbyB0aGV5J2xsIGJlIHJlY3JlYXRlZCBhcyByZXF1aXJlZC5cbiAgICAgICAgLy8gVE9ETzogYSBzb2x1dGlvbiBmb3IgdGhlIGNhc2Ugd2hlcmUgYSByZW5kZXIgdGFyZ2V0IGNvbnRhaW5zIHNvbWV0aGluZ1xuICAgICAgICAvLyB0aGF0IHdhcyBwcmV2aW91c2x5IGdlbmVyYXRlZCB0aGF0IG5lZWRzIHRvIGJlIHJlLXJlbmRlcmVkLlxuICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldHMpIHtcbiAgICAgICAgICAgIHRhcmdldC5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgaXMgcmVzdG9yZWQuIEl0IHJlaW5pdGlhbGl6ZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVzdG9yZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ2FwYWJpbGl0aWVzKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKTtcblxuICAgICAgICAvLyBSZWNvbXBpbGUgYWxsIHNoYWRlcnMgKHRoZXknbGwgYmUgbGlua2VkIHdoZW4gdGhleSdyZSBuZXh0IGFjdHVhbGx5IHVzZWQpXG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyIG9mIHRoaXMuc2hhZGVycykge1xuICAgICAgICAgICAgc2hhZGVyLnJlc3RvcmVDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNyZWF0ZSBidWZmZXIgb2JqZWN0cyBhbmQgcmV1cGxvYWQgYnVmZmVyIGRhdGEgdG8gdGhlIEdQVVxuICAgICAgICBmb3IgKGNvbnN0IGJ1ZmZlciBvZiB0aGlzLmJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIGJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgYWN0aXZlIHJlY3RhbmdsZSBmb3IgcmVuZGVyaW5nIG9uIHRoZSBzcGVjaWZpZWQgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgcGl4ZWwgc3BhY2UgeC1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHZpZXdwb3J0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHBpeGVsIHNwYWNlIHktY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSB2aWV3cG9ydC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3aWR0aCBvZiB0aGUgdmlld3BvcnQgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIGhlaWdodCBvZiB0aGUgdmlld3BvcnQgaW4gcGl4ZWxzLlxuICAgICAqL1xuICAgIHNldFZpZXdwb3J0KHgsIHksIHcsIGgpIHtcbiAgICAgICAgaWYgKCh0aGlzLnZ4ICE9PSB4KSB8fCAodGhpcy52eSAhPT0geSkgfHwgKHRoaXMudncgIT09IHcpIHx8ICh0aGlzLnZoICE9PSBoKSkge1xuICAgICAgICAgICAgdGhpcy5nbC52aWV3cG9ydCh4LCB5LCB3LCBoKTtcbiAgICAgICAgICAgIHRoaXMudnggPSB4O1xuICAgICAgICAgICAgdGhpcy52eSA9IHk7XG4gICAgICAgICAgICB0aGlzLnZ3ID0gdztcbiAgICAgICAgICAgIHRoaXMudmggPSBoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBhY3RpdmUgc2Npc3NvciByZWN0YW5nbGUgb24gdGhlIHNwZWNpZmllZCBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSBwaXhlbCBzcGFjZSB4LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgcGl4ZWwgc3BhY2UgeS1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZSBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZSBpbiBwaXhlbHMuXG4gICAgICovXG4gICAgc2V0U2Npc3Nvcih4LCB5LCB3LCBoKSB7XG4gICAgICAgIGlmICgodGhpcy5zeCAhPT0geCkgfHwgKHRoaXMuc3kgIT09IHkpIHx8ICh0aGlzLnN3ICE9PSB3KSB8fCAodGhpcy5zaCAhPT0gaCkpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc2Npc3Nvcih4LCB5LCB3LCBoKTtcbiAgICAgICAgICAgIHRoaXMuc3ggPSB4O1xuICAgICAgICAgICAgdGhpcy5zeSA9IHk7XG4gICAgICAgICAgICB0aGlzLnN3ID0gdztcbiAgICAgICAgICAgIHRoaXMuc2ggPSBoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQmluZHMgdGhlIHNwZWNpZmllZCBmcmFtZWJ1ZmZlciBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1dlYkdMRnJhbWVidWZmZXIgfCBudWxsfSBmYiAtIFRoZSBmcmFtZWJ1ZmZlciB0byBiaW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRGcmFtZWJ1ZmZlcihmYikge1xuICAgICAgICBpZiAodGhpcy5hY3RpdmVGcmFtZWJ1ZmZlciAhPT0gZmIpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZmIpO1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVGcmFtZWJ1ZmZlciA9IGZiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHNvdXJjZSByZW5kZXIgdGFyZ2V0IGludG8gZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldC4gTW9zdGx5IHVzZWQgYnkgcG9zdC1lZmZlY3RzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtzb3VyY2VdIC0gVGhlIHNvdXJjZSByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtkZXN0XSAtIFRoZSBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvcHkgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBjb3B5UmVuZGVyVGFyZ2V0KHNvdXJjZSwgZGVzdCwgY29sb3IsIGRlcHRoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICBpZiAoIXRoaXMud2ViZ2wyICYmIGRlcHRoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkRlcHRoIGlzIG5vdCBjb3B5YWJsZSBvbiBXZWJHTCAxLjBcIik7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgICAgICBpZiAoIWRlc3QpIHtcbiAgICAgICAgICAgICAgICAvLyBjb3B5aW5nIHRvIGJhY2tidWZmZXJcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fY29sb3JCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IGVtcHR5IGNvbG9yIGJ1ZmZlciB0byBiYWNrYnVmZmVyXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAvLyBjb3B5aW5nIHRvIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fY29sb3JCdWZmZXIgfHwgIWRlc3QuX2NvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBjb2xvciBidWZmZXIsIGJlY2F1c2Ugb25lIG9mIHRoZSByZW5kZXIgdGFyZ2V0cyBkb2Vzbid0IGhhdmUgaXRcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZS5fY29sb3JCdWZmZXIuX2Zvcm1hdCAhPT0gZGVzdC5fY29sb3JCdWZmZXIuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgcmVuZGVyIHRhcmdldHMgb2YgZGlmZmVyZW50IGNvbG9yIGZvcm1hdHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlcHRoICYmIHNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2RlcHRoKSB7ICAgLy8gd2hlbiBkZXB0aCBpcyBhdXRvbWF0aWMsIHdlIGNhbm5vdCB0ZXN0IHRoZSBidWZmZXIgbm9yIGl0cyBmb3JtYXRcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fZGVwdGhCdWZmZXIgfHwgIWRlc3QuX2RlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBkZXB0aCBidWZmZXIsIGJlY2F1c2Ugb25lIG9mIHRoZSByZW5kZXIgdGFyZ2V0cyBkb2Vzbid0IGhhdmUgaXRcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZS5fZGVwdGhCdWZmZXIuX2Zvcm1hdCAhPT0gZGVzdC5fZGVwdGhCdWZmZXIuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgcmVuZGVyIHRhcmdldHMgb2YgZGlmZmVyZW50IGRlcHRoIGZvcm1hdHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ0NPUFktUlQnKTtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgZGVzdCkge1xuICAgICAgICAgICAgY29uc3QgcHJldlJ0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IGRlc3Q7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUJlZ2luKCk7XG4gICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuUkVBRF9GUkFNRUJVRkZFUiwgc291cmNlID8gc291cmNlLmltcGwuX2dsRnJhbWVCdWZmZXIgOiBudWxsKTtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5EUkFXX0ZSQU1FQlVGRkVSLCBkZXN0LmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuICAgICAgICAgICAgY29uc3QgdyA9IHNvdXJjZSA/IHNvdXJjZS53aWR0aCA6IGRlc3Qud2lkdGg7XG4gICAgICAgICAgICBjb25zdCBoID0gc291cmNlID8gc291cmNlLmhlaWdodCA6IGRlc3QuaGVpZ2h0O1xuICAgICAgICAgICAgZ2wuYmxpdEZyYW1lYnVmZmVyKDAsIDAsIHcsIGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwgMCwgdywgaCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY29sb3IgPyBnbC5DT0xPUl9CVUZGRVJfQklUIDogMCkgfCAoZGVwdGggPyBnbC5ERVBUSF9CVUZGRVJfQklUIDogMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuTkVBUkVTVCk7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHByZXZSdDtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgcHJldlJ0ID8gcHJldlJ0LmltcGwuX2dsRnJhbWVCdWZmZXIgOiBudWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuZ2V0Q29weVNoYWRlcigpO1xuICAgICAgICAgICAgdGhpcy5jb25zdGFudFRleFNvdXJjZS5zZXRWYWx1ZShzb3VyY2UuX2NvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcih0aGlzLCBkZXN0LCBzaGFkZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGNvcHkgc2hhZGVyIGZvciBlZmZpY2llbnQgcmVuZGVyaW5nIG9mIGZ1bGxzY3JlZW4tcXVhZCB3aXRoIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U2hhZGVyfSBUaGUgY29weSBzaGFkZXIgKGJhc2VkIG9uIGBmdWxsc2NyZWVuUXVhZFZTYCBhbmQgYG91dHB1dFRleDJEUFNgIGluXG4gICAgICogYHNoYWRlckNodW5rc2ApLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRDb3B5U2hhZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2NvcHlTaGFkZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHZzID0gc2hhZGVyQ2h1bmtzLmZ1bGxzY3JlZW5RdWFkVlM7XG4gICAgICAgICAgICBjb25zdCBmcyA9IHNoYWRlckNodW5rcy5vdXRwdXRUZXgyRFBTO1xuICAgICAgICAgICAgdGhpcy5fY29weVNoYWRlciA9IGNyZWF0ZVNoYWRlckZyb21Db2RlKHRoaXMsIHZzLCBmcywgXCJvdXRwdXRUZXgyRFwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY29weVNoYWRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBhIHJlbmRlciBwYXNzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIHN0YXJ0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGFydFBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgU1RBUlQtUEFTU2ApO1xuXG4gICAgICAgIC8vIHNldCB1cCByZW5kZXIgdGFyZ2V0XG4gICAgICAgIHRoaXMuc2V0UmVuZGVyVGFyZ2V0KHJlbmRlclBhc3MucmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgdGhpcy51cGRhdGVCZWdpbigpO1xuXG4gICAgICAgIC8vIGNsZWFyIHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IGNvbG9yT3BzID0gcmVuZGVyUGFzcy5jb2xvck9wcztcbiAgICAgICAgY29uc3QgZGVwdGhTdGVuY2lsT3BzID0gcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHM7XG4gICAgICAgIGlmIChjb2xvck9wcy5jbGVhciB8fCBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aCB8fCBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsKSB7XG5cbiAgICAgICAgICAgIC8vIHRoZSBwYXNzIGFsd2F5cyBjbGVhcnMgZnVsbCB0YXJnZXRcbiAgICAgICAgICAgIGNvbnN0IHJ0ID0gcmVuZGVyUGFzcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICBjb25zdCB3aWR0aCA9IHJ0ID8gcnQud2lkdGggOiB0aGlzLndpZHRoO1xuICAgICAgICAgICAgY29uc3QgaGVpZ2h0ID0gcnQgPyBydC5oZWlnaHQgOiB0aGlzLmhlaWdodDtcbiAgICAgICAgICAgIHRoaXMuc2V0Vmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgICAgICB0aGlzLnNldFNjaXNzb3IoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG5cbiAgICAgICAgICAgIGxldCBjbGVhckZsYWdzID0gMDtcbiAgICAgICAgICAgIGNvbnN0IGNsZWFyT3B0aW9ucyA9IHt9O1xuXG4gICAgICAgICAgICBpZiAoY29sb3JPcHMuY2xlYXIpIHtcbiAgICAgICAgICAgICAgICBjbGVhckZsYWdzIHw9IENMRUFSRkxBR19DT0xPUjtcbiAgICAgICAgICAgICAgICBjbGVhck9wdGlvbnMuY29sb3IgPSBbY29sb3JPcHMuY2xlYXJWYWx1ZS5yLCBjb2xvck9wcy5jbGVhclZhbHVlLmcsIGNvbG9yT3BzLmNsZWFyVmFsdWUuYiwgY29sb3JPcHMuY2xlYXJWYWx1ZS5hXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJGbGFncyB8PSBDTEVBUkZMQUdfREVQVEg7XG4gICAgICAgICAgICAgICAgY2xlYXJPcHRpb25zLmRlcHRoID0gZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGhWYWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICBjbGVhckZsYWdzIHw9IENMRUFSRkxBR19TVEVOQ0lMO1xuICAgICAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5zdGVuY2lsID0gZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbFZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjbGVhciBpdFxuICAgICAgICAgICAgY2xlYXJPcHRpb25zLmZsYWdzID0gY2xlYXJGbGFncztcbiAgICAgICAgICAgIHRoaXMuY2xlYXIoY2xlYXJPcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnLmFzc2VydCghdGhpcy5pbnNpZGVSZW5kZXJQYXNzKTtcbiAgICAgICAgdGhpcy5pbnNpZGVSZW5kZXJQYXNzID0gdHJ1ZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmQgYSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBlbmQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGVuZFBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgRU5ELVBBU1NgKTtcblxuICAgICAgICB0aGlzLnVuYmluZFZlcnRleEFycmF5KCk7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGlmICh0YXJnZXQpIHtcblxuICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSBidWZmZXJzIHRvIHN0b3AgdGhlbSBiZWluZyB3cml0dGVuIHRvIG9uIHRpbGVkIGFyY2hpdGV4dHVyZXNcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgICAgIC8vIGludmFsaWRhdGUgY29sb3Igb25seSBpZiB3ZSBkb24ndCBuZWVkIHRvIHJlc29sdmUgaXRcbiAgICAgICAgICAgICAgICBpZiAoIShyZW5kZXJQYXNzLmNvbG9yT3BzLnN0b3JlIHx8IHJlbmRlclBhc3MuY29sb3JPcHMucmVzb2x2ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuQ09MT1JfQVRUQUNITUVOVDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuREVQVEhfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5wdXNoKGdsLlNURU5DSUxfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGludmFsaWRhdGVBdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSB0aGUgd2hvbGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IHdlIGNvdWxkIGhhbmRsZSB2aWV3cG9ydCBpbnZhbGlkYXRpb24gYXMgd2VsbFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuaW52YWxpZGF0ZUZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIGludmFsaWRhdGVBdHRhY2htZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlc29sdmUgdGhlIGNvbG9yIGJ1ZmZlclxuICAgICAgICAgICAgaWYgKHJlbmRlclBhc3MuY29sb3JPcHMucmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiByZW5kZXJQYXNzLnNhbXBsZXMgPiAxICYmIHRhcmdldC5hdXRvUmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSh0cnVlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSBtaXBtYXBzXG4gICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5jb2xvck9wcy5taXBtYXBzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSB0YXJnZXQuX2NvbG9yQnVmZmVyO1xuICAgICAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYmluZFRleHR1cmUoY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmdlbmVyYXRlTWlwbWFwKGNvbG9yQnVmZmVyLmltcGwuX2dsVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrcyB0aGUgYmVnaW5uaW5nIG9mIGEgYmxvY2sgb2YgcmVuZGVyaW5nLiBJbnRlcm5hbGx5LCB0aGlzIGZ1bmN0aW9uIGJpbmRzIHRoZSByZW5kZXJcbiAgICAgKiB0YXJnZXQgY3VycmVudGx5IHNldCBvbiB0aGUgZGV2aWNlLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBtYXRjaGVkIHdpdGggYSBjYWxsIHRvXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0uIENhbGxzIHRvIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVCZWdpbn0gYW5kXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0gbXVzdCBub3QgYmUgbmVzdGVkLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUJlZ2luKCkge1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ1VQREFURS1CRUdJTicpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuXG4gICAgICAgIC8vIGNsZWFyIHRleHR1cmUgdW5pdHMgb25jZSBhIGZyYW1lIG9uIGRlc2t0b3Agc2FmYXJpXG4gICAgICAgIGlmICh0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kKSB7XG4gICAgICAgICAgICBmb3IgKGxldCB1bml0ID0gMDsgdW5pdCA8IHRoaXMudGV4dHVyZVVuaXRzLmxlbmd0aDsgKyt1bml0KSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgc2xvdCA9IDA7IHNsb3QgPCAzOyArK3Nsb3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlVW5pdHNbdW5pdF1bc2xvdF0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IFdlYkdMIGZyYW1lIGJ1ZmZlciBvYmplY3RcbiAgICAgICAgICAgIGlmICghdGFyZ2V0LmltcGwuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQodGFyZ2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRGcmFtZWJ1ZmZlcih0YXJnZXQuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldEZyYW1lYnVmZmVyKHRoaXMuZGVmYXVsdEZyYW1lYnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBlbmQgb2YgYSBibG9jayBvZiByZW5kZXJpbmcuIFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNhbGxlZCBhZnRlciBhIG1hdGNoaW5nIGNhbGxcbiAgICAgKiB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59LiBDYWxscyB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59IGFuZFxuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVFbmR9IG11c3Qgbm90IGJlIG5lc3RlZC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVFbmQoKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBVUERBVEUtRU5EYCk7XG5cbiAgICAgICAgdGhpcy51bmJpbmRWZXJ0ZXhBcnJheSgpO1xuXG4gICAgICAgIC8vIFVuc2V0IHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgICAvLyBSZXNvbHZlIE1TQUEgaWYgbmVlZGVkXG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGFyZ2V0Ll9zYW1wbGVzID4gMSAmJiB0YXJnZXQuYXV0b1Jlc29sdmUpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgYWN0aXZlIHJlbmRlciB0YXJnZXQgaXMgYXV0by1taXBtYXBwZWQsIGdlbmVyYXRlIGl0cyBtaXAgY2hhaW5cbiAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGFyZ2V0Ll9jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgIC8vIEZJWE1FOiBpZiBjb2xvckJ1ZmZlciBpcyBhIGN1YmVtYXAgY3VycmVudGx5IHdlJ3JlIHJlLWdlbmVyYXRpbmcgbWlwbWFwcyBhZnRlclxuICAgICAgICAgICAgICAgIC8vIHVwZGF0aW5nIGVhY2ggZmFjZSFcbiAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZShjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5nbC5nZW5lcmF0ZU1pcG1hcChjb2xvckJ1ZmZlci5pbXBsLl9nbFRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSdzIHZlcnRpY2FsIGZsaXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZsaXBZIC0gVHJ1ZSB0byBmbGlwIHRoZSB0ZXh0dXJlIHZlcnRpY2FsbHkuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFVucGFja0ZsaXBZKGZsaXBZKSB7XG4gICAgICAgIGlmICh0aGlzLnVucGFja0ZsaXBZICE9PSBmbGlwWSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZsaXBZO1xuXG4gICAgICAgICAgICAvLyBOb3RlOiB0aGUgV2ViR0wgc3BlYyBzdGF0ZXMgdGhhdCBVTlBBQ0tfRkxJUF9ZX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmbGlwWSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSB0byBoYXZlIGl0cyBSR0IgY2hhbm5lbHMgcHJlbXVsdGlwbGllZCBieSBpdHMgYWxwaGEgY2hhbm5lbCBvciBub3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByZW11bHRpcGx5QWxwaGEgLSBUcnVlIHRvIHByZW11bHRpcGx5IHRoZSBhbHBoYSBjaGFubmVsIGFnYWluc3QgdGhlIFJHQlxuICAgICAqIGNoYW5uZWxzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgaWYgKHRoaXMudW5wYWNrUHJlbXVsdGlwbHlBbHBoYSAhPT0gcHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gcHJlbXVsdGlwbHlBbHBoYTtcblxuICAgICAgICAgICAgLy8gTm90ZTogdGhlIFdlYkdMIHNwZWMgc3RhdGVzIHRoYXQgVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIHByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWN0aXZhdGUgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KSB7XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0ICE9PSB0ZXh0dXJlVW5pdCkge1xuICAgICAgICAgICAgdGhpcy5nbC5hY3RpdmVUZXh0dXJlKHRoaXMuZ2wuVEVYVFVSRTAgKyB0ZXh0dXJlVW5pdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0ID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgdGV4dHVyZSBpcyBub3QgYWxyZWFkeSBib3VuZCBvbiB0aGUgY3VycmVudGx5IGFjdGl2ZSB0ZXh0dXJlIHVuaXQsIGJpbmQgaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byBiaW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZSh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IGltcGwgPSB0ZXh0dXJlLmltcGw7XG4gICAgICAgIGNvbnN0IHRleHR1cmVUYXJnZXQgPSBpbXBsLl9nbFRhcmdldDtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9iamVjdCA9IGltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgY29uc3QgdGV4dHVyZVVuaXQgPSB0aGlzLnRleHR1cmVVbml0O1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy50YXJnZXRUb1Nsb3RbdGV4dHVyZVRhcmdldF07XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gIT09IHRleHR1cmVPYmplY3QpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIHRleHR1cmUgaXMgbm90IGJvdW5kIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LCBhY3RpdmUgdGhlIHRleHR1cmUgdW5pdCBhbmQgYmluZFxuICAgICAqIHRoZSB0ZXh0dXJlIHRvIGl0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gYmluZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlIGFuZCBiaW5kIHRoZSB0ZXh0dXJlIHRvLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCkge1xuICAgICAgICBjb25zdCBpbXBsID0gdGV4dHVyZS5pbXBsO1xuICAgICAgICBjb25zdCB0ZXh0dXJlVGFyZ2V0ID0gaW1wbC5fZ2xUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHRleHR1cmVPYmplY3QgPSBpbXBsLl9nbFRleHR1cmU7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnRhcmdldFRvU2xvdFt0ZXh0dXJlVGFyZ2V0XTtcbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSAhPT0gdGV4dHVyZU9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSB0ZXh0dXJlIHBhcmFtZXRlcnMgZm9yIGEgZ2l2ZW4gdGV4dHVyZSBpZiB0aGV5IGhhdmUgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHVwZGF0ZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VGV4dHVyZVBhcmFtZXRlcnModGV4dHVyZSkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGNvbnN0IGZsYWdzID0gdGV4dHVyZS5fcGFyYW1ldGVyRmxhZ3M7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRleHR1cmUuaW1wbC5fZ2xUYXJnZXQ7XG5cbiAgICAgICAgaWYgKGZsYWdzICYgMSkge1xuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHRleHR1cmUuX21pbkZpbHRlcjtcbiAgICAgICAgICAgIGlmICgoIXRleHR1cmUucG90ICYmICF0aGlzLndlYmdsMikgfHwgIXRleHR1cmUuX21pcG1hcHMgfHwgKHRleHR1cmUuX2NvbXByZXNzZWQgJiYgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aCA9PT0gMSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmlsdGVyID09PSBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCB8fCBmaWx0ZXIgPT09IEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX05FQVJFU1Q7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmaWx0ZXIgPT09IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QgfHwgZmlsdGVyID09PSBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCB0aGlzLmdsRmlsdGVyW2ZpbHRlcl0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDIpIHtcbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX01BR19GSUxURVIsIHRoaXMuZ2xGaWx0ZXJbdGV4dHVyZS5fbWFnRmlsdGVyXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9TLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzVV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBXZWJHTDEgZG9lc24ndCBzdXBwb3J0IGFsbCBhZGRyZXNzaW5nIG1vZGVzIHdpdGggTlBPVCB0ZXh0dXJlc1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUywgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5wb3QgPyB0ZXh0dXJlLl9hZGRyZXNzVSA6IEFERFJFU1NfQ0xBTVBfVE9fRURHRV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfVCwgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5fYWRkcmVzc1ZdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gV2ViR0wxIGRvZXNuJ3Qgc3VwcG9ydCBhbGwgYWRkcmVzc2luZyBtb2RlcyB3aXRoIE5QT1QgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1QsIHRoaXMuZ2xBZGRyZXNzW3RleHR1cmUucG90ID8gdGV4dHVyZS5fYWRkcmVzc1YgOiBBRERSRVNTX0NMQU1QX1RPX0VER0VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxNikge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9SLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzV10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDMyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9DT01QQVJFX01PREUsIHRleHR1cmUuX2NvbXBhcmVPblJlYWQgPyBnbC5DT01QQVJFX1JFRl9UT19URVhUVVJFIDogZ2wuTk9ORSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNjQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX0NPTVBBUkVfRlVOQywgdGhpcy5nbENvbXBhcmlzb25bdGV4dHVyZS5fY29tcGFyZUZ1bmNdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxMjgpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljO1xuICAgICAgICAgICAgaWYgKGV4dCkge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmYodGFyZ2V0LCBleHQuVEVYVFVSRV9NQVhfQU5JU09UUk9QWV9FWFQsIE1hdGgubWF4KDEsIE1hdGgubWluKE1hdGgucm91bmQodGV4dHVyZS5fYW5pc290cm9weSksIHRoaXMubWF4QW5pc290cm9weSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0ZXh0dXJlVW5pdCAtIFRoZSB0ZXh0dXJlIHVuaXQgdG8gc2V0IHRoZSB0ZXh0dXJlIG9uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KSB7XG5cbiAgICAgICAgaWYgKCF0ZXh0dXJlLmltcGwuX2dsVGV4dHVyZSlcbiAgICAgICAgICAgIHRleHR1cmUuaW1wbC5pbml0aWFsaXplKHRoaXMsIHRleHR1cmUpO1xuXG4gICAgICAgIGlmICh0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncyA+IDAgfHwgdGV4dHVyZS5fbmVlZHNVcGxvYWQgfHwgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkKSB7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdCBpcyBhY3RpdmVcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlVGV4dHVyZSh0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgdGV4dHVyZSBpcyBib3VuZCBvbiBjb3JyZWN0IHRhcmdldCBvZiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdFxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZSh0ZXh0dXJlKTtcblxuICAgICAgICAgICAgaWYgKHRleHR1cmUuX3BhcmFtZXRlckZsYWdzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlUGFyYW1ldGVycyh0ZXh0dXJlKTtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncyA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9uZWVkc1VwbG9hZCB8fCB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLmltcGwudXBsb2FkKHRoaXMsIHRleHR1cmUpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX25lZWRzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIHRleHR1cmUgaXMgY3VycmVudGx5IGJvdW5kIHRvIHRoZSBjb3JyZWN0IHRhcmdldCBvbiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdC5cbiAgICAgICAgICAgIC8vIElmIHRoZSB0ZXh0dXJlIGlzIGFscmVhZHkgYm91bmQgdG8gdGhlIGNvcnJlY3QgdGFyZ2V0IG9uIHRoZSBzcGVjaWZpZWQgdW5pdCwgdGhlcmUncyBubyBuZWVkXG4gICAgICAgICAgICAvLyB0byBhY3R1YWxseSBtYWtlIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0IGFjdGl2ZSBiZWNhdXNlIHRoZSB0ZXh0dXJlIGl0c2VsZiBkb2VzIG5vdCBuZWVkXG4gICAgICAgICAgICAvLyB0byBiZSB1cGRhdGVkLlxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBjcmVhdGVzIFZlcnRleEFycmF5T2JqZWN0IGZyb20gbGlzdCBvZiB2ZXJ0ZXggYnVmZmVyc1xuICAgIGNyZWF0ZVZlcnRleEFycmF5KHZlcnRleEJ1ZmZlcnMpIHtcblxuICAgICAgICBsZXQga2V5LCB2YW87XG5cbiAgICAgICAgLy8gb25seSB1c2UgY2FjaGUgd2hlbiBtb3JlIHRoYW4gMSB2ZXJ0ZXggYnVmZmVyLCBvdGhlcndpc2UgaXQncyB1bmlxdWVcbiAgICAgICAgY29uc3QgdXNlQ2FjaGUgPSB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA+IDE7XG4gICAgICAgIGlmICh1c2VDYWNoZSkge1xuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSB1bmlxdWUga2V5IGZvciB0aGUgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIGtleSA9IFwiXCI7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRleEJ1ZmZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXJzW2ldO1xuICAgICAgICAgICAgICAgIGtleSArPSB2ZXJ0ZXhCdWZmZXIuaWQgKyB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnJlbmRlcmluZ2luZ0hhc2g7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRyeSB0byBnZXQgVkFPIGZyb20gY2FjaGVcbiAgICAgICAgICAgIHZhbyA9IHRoaXMuX3Zhb01hcC5nZXQoa2V5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5lZWQgdG8gY3JlYXRlIG5ldyB2YW9cbiAgICAgICAgaWYgKCF2YW8pIHtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIFZBIG9iamVjdFxuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgdmFvID0gZ2wuY3JlYXRlVmVydGV4QXJyYXkoKTtcbiAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSh2YW8pO1xuXG4gICAgICAgICAgICAvLyBkb24ndCBjYXB0dXJlIGluZGV4IGJ1ZmZlciBpbiBWQU9cbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIG51bGwpO1xuXG4gICAgICAgICAgICBsZXQgbG9jWmVybyA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBiaW5kIGJ1ZmZlclxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcnNbaV07XG4gICAgICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZlcnRleEJ1ZmZlci5pbXBsLmJ1ZmZlcklkKTtcblxuICAgICAgICAgICAgICAgIC8vIGZvciBlYWNoIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGVsZW1lbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUgPSBlbGVtZW50c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9jID0gc2VtYW50aWNUb0xvY2F0aW9uW2UubmFtZV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvYyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jWmVybyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvYywgZS5udW1Db21wb25lbnRzLCB0aGlzLmdsVHlwZVtlLmRhdGFUeXBlXSwgZS5ub3JtYWxpemUsIGUuc3RyaWRlLCBlLm9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvYyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHZlcnRleEJ1ZmZlci5pbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJEaXZpc29yKGxvYywgMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVuZCBvZiBWQSBvYmplY3RcbiAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheShudWxsKTtcblxuICAgICAgICAgICAgLy8gdW5iaW5kIGFueSBhcnJheSBidWZmZXJcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBudWxsKTtcblxuICAgICAgICAgICAgLy8gYWRkIGl0IHRvIGNhY2hlXG4gICAgICAgICAgICBpZiAodXNlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl92YW9NYXAuc2V0KGtleSwgdmFvKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFsb2NaZXJvKSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybihcIk5vIHZlcnRleCBhdHRyaWJ1dGUgaXMgbWFwcGVkIHRvIGxvY2F0aW9uIDAsIHdoaWNoIG1pZ2h0IGNhdXNlIGNvbXBhdGliaWxpdHkgaXNzdWVzIG9uIFNhZmFyaSBvbiBNYWNPUyAtIHBsZWFzZSB1c2UgYXR0cmlidXRlIFNFTUFOVElDX1BPU0lUSU9OIG9yIFNFTUFOVElDX0FUVFIxNVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YW87XG4gICAgfVxuXG4gICAgdW5iaW5kVmVydGV4QXJyYXkoKSB7XG4gICAgICAgIC8vIHVuYmluZCBWQU8gZnJvbSBkZXZpY2UgdG8gcHJvdGVjdCBpdCBmcm9tIGJlaW5nIGNoYW5nZWRcbiAgICAgICAgaWYgKHRoaXMuYm91bmRWYW8pIHtcbiAgICAgICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5nbC5iaW5kVmVydGV4QXJyYXkobnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRCdWZmZXJzKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCB2YW87XG5cbiAgICAgICAgLy8gY3JlYXRlIFZBTyBmb3Igc3BlY2lmaWVkIHZlcnRleCBidWZmZXJzXG4gICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlcnMubGVuZ3RoID09PSAxKSB7XG5cbiAgICAgICAgICAgIC8vIHNpbmdsZSBWQiBrZWVwcyBpdHMgVkFPXG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB0aGlzLnZlcnRleEJ1ZmZlcnNbMF07XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodmVydGV4QnVmZmVyLmRldmljZSA9PT0gdGhpcywgXCJUaGUgVmVydGV4QnVmZmVyIHdhcyBub3QgY3JlYXRlZCB1c2luZyBjdXJyZW50IEdyYXBoaWNzRGV2aWNlXCIpO1xuICAgICAgICAgICAgaWYgKCF2ZXJ0ZXhCdWZmZXIuaW1wbC52YW8pIHtcbiAgICAgICAgICAgICAgICB2ZXJ0ZXhCdWZmZXIuaW1wbC52YW8gPSB0aGlzLmNyZWF0ZVZlcnRleEFycmF5KHRoaXMudmVydGV4QnVmZmVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YW8gPSB2ZXJ0ZXhCdWZmZXIuaW1wbC52YW87XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBvYnRhaW4gdGVtcG9yYXJ5IFZBTyBmb3IgbXVsdGlwbGUgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIHZhbyA9IHRoaXMuY3JlYXRlVmVydGV4QXJyYXkodGhpcy52ZXJ0ZXhCdWZmZXJzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBhY3RpdmUgVkFPXG4gICAgICAgIGlmICh0aGlzLmJvdW5kVmFvICE9PSB2YW8pIHtcbiAgICAgICAgICAgIHRoaXMuYm91bmRWYW8gPSB2YW87XG4gICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkodmFvKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVtcHR5IGFycmF5IG9mIHZlcnRleCBidWZmZXJzXG4gICAgICAgIHRoaXMudmVydGV4QnVmZmVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vIFNldCB0aGUgYWN0aXZlIGluZGV4IGJ1ZmZlciBvYmplY3RcbiAgICAgICAgLy8gTm90ZTogd2UgZG9uJ3QgY2FjaGUgdGhpcyBzdGF0ZSBhbmQgc2V0IGl0IG9ubHkgd2hlbiBpdCBjaGFuZ2VzLCBhcyBWQU8gY2FwdHVyZXMgbGFzdCBiaW5kIGJ1ZmZlciBpbiBpdFxuICAgICAgICAvLyBhbmQgc28gd2UgZG9uJ3Qga25vdyB3aGF0IFZBTyBzZXRzIGl0IHRvLlxuICAgICAgICBjb25zdCBidWZmZXJJZCA9IHRoaXMuaW5kZXhCdWZmZXIgPyB0aGlzLmluZGV4QnVmZmVyLmltcGwuYnVmZmVySWQgOiBudWxsO1xuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBidWZmZXJJZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VibWl0cyBhIGdyYXBoaWNhbCBwcmltaXRpdmUgdG8gdGhlIGhhcmR3YXJlIGZvciBpbW1lZGlhdGUgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHByaW1pdGl2ZSAtIFByaW1pdGl2ZSBvYmplY3QgZGVzY3JpYmluZyBob3cgdG8gc3VibWl0IGN1cnJlbnQgdmVydGV4L2luZGV4XG4gICAgICogYnVmZmVycy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcHJpbWl0aXZlLnR5cGUgLSBUaGUgdHlwZSBvZiBwcmltaXRpdmUgdG8gcmVuZGVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfUE9JTlRTfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORUxPT1B9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVTVFJJUH1cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJQU5HTEVTfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9UUklTVFJJUH1cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJRkFOfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS5iYXNlIC0gVGhlIG9mZnNldCBvZiB0aGUgZmlyc3QgaW5kZXggb3IgdmVydGV4IHRvIGRpc3BhdGNoIGluIHRoZVxuICAgICAqIGRyYXcgY2FsbC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcHJpbWl0aXZlLmNvdW50IC0gVGhlIG51bWJlciBvZiBpbmRpY2VzIG9yIHZlcnRpY2VzIHRvIGRpc3BhdGNoIGluIHRoZSBkcmF3XG4gICAgICogY2FsbC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtwcmltaXRpdmUuaW5kZXhlZF0gLSBUcnVlIHRvIGludGVycHJldCB0aGUgcHJpbWl0aXZlIGFzIGluZGV4ZWQsIHRoZXJlYnlcbiAgICAgKiB1c2luZyB0aGUgY3VycmVudGx5IHNldCBpbmRleCBidWZmZXIgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bUluc3RhbmNlcz0xXSAtIFRoZSBudW1iZXIgb2YgaW5zdGFuY2VzIHRvIHJlbmRlciB3aGVuIHVzaW5nXG4gICAgICogQU5HTEVfaW5zdGFuY2VkX2FycmF5cy4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtrZWVwQnVmZmVyc10gLSBPcHRpb25hbGx5IGtlZXAgdGhlIGN1cnJlbnQgc2V0IG9mIHZlcnRleCAvIGluZGV4IGJ1ZmZlcnMgL1xuICAgICAqIFZBTy4gVGhpcyBpcyB1c2VkIHdoZW4gcmVuZGVyaW5nIG9mIG11bHRpcGxlIHZpZXdzLCBmb3IgZXhhbXBsZSB1bmRlciBXZWJYUi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIHNpbmdsZSwgdW5pbmRleGVkIHRyaWFuZ2xlXG4gICAgICogZGV2aWNlLmRyYXcoe1xuICAgICAqICAgICB0eXBlOiBwYy5QUklNSVRJVkVfVFJJQU5HTEVTLFxuICAgICAqICAgICBiYXNlOiAwLFxuICAgICAqICAgICBjb3VudDogMyxcbiAgICAgKiAgICAgaW5kZXhlZDogZmFsc2VcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBkcmF3KHByaW1pdGl2ZSwgbnVtSW5zdGFuY2VzLCBrZWVwQnVmZmVycykge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgbGV0IHNhbXBsZXIsIHNhbXBsZXJWYWx1ZSwgdGV4dHVyZSwgbnVtVGV4dHVyZXM7IC8vIFNhbXBsZXJzXG4gICAgICAgIGxldCB1bmlmb3JtLCBzY29wZUlkLCB1bmlmb3JtVmVyc2lvbiwgcHJvZ3JhbVZlcnNpb247IC8vIFVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuc2hhZGVyO1xuICAgICAgICBpZiAoIXNoYWRlcilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3Qgc2FtcGxlcnMgPSBzaGFkZXIuaW1wbC5zYW1wbGVycztcbiAgICAgICAgY29uc3QgdW5pZm9ybXMgPSBzaGFkZXIuaW1wbC51bmlmb3JtcztcblxuICAgICAgICAvLyB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICBpZiAoIWtlZXBCdWZmZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnNldEJ1ZmZlcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbW1pdCB0aGUgc2hhZGVyIHByb2dyYW0gdmFyaWFibGVzXG4gICAgICAgIGxldCB0ZXh0dXJlVW5pdCA9IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHNhbXBsZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBzYW1wbGVyID0gc2FtcGxlcnNbaV07XG4gICAgICAgICAgICBzYW1wbGVyVmFsdWUgPSBzYW1wbGVyLnNjb3BlSWQudmFsdWU7XG4gICAgICAgICAgICBpZiAoIXNhbXBsZXJWYWx1ZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgIGNvbnN0IHNhbXBsZXJOYW1lID0gc2FtcGxlci5zY29wZUlkLm5hbWU7XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXJOYW1lID09PSAndVNjZW5lRGVwdGhNYXAnIHx8IHNhbXBsZXJOYW1lID09PSAndURlcHRoTWFwJykge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuT25jZShgQSBzYW1wbGVyICR7c2FtcGxlck5hbWV9IGlzIHVzZWQgYnkgdGhlIHNoYWRlciBidXQgYSBzY2VuZSBkZXB0aCB0ZXh0dXJlIGlzIG5vdCBhdmFpbGFibGUuIFVzZSBDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lRGVwdGhNYXAgdG8gZW5hYmxlIGl0LmApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2FtcGxlck5hbWUgPT09ICd1U2NlbmVDb2xvck1hcCcgfHwgc2FtcGxlck5hbWUgPT09ICd0ZXh0dXJlX2dyYWJQYXNzJykge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuT25jZShgQSBzYW1wbGVyICR7c2FtcGxlck5hbWV9IGlzIHVzZWQgYnkgdGhlIHNoYWRlciBidXQgYSBzY2VuZSBkZXB0aCB0ZXh0dXJlIGlzIG5vdCBhdmFpbGFibGUuIFVzZSBDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lQ29sb3JNYXAgdG8gZW5hYmxlIGl0LmApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvLyBCZWNhdXNlIHVuc2V0IGNvbnN0YW50cyBzaG91bGRuJ3QgcmFpc2UgcmFuZG9tIGVycm9yc1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2FtcGxlclZhbHVlIGluc3RhbmNlb2YgVGV4dHVyZSkge1xuICAgICAgICAgICAgICAgIHRleHR1cmUgPSBzYW1wbGVyVmFsdWU7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KTtcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU2V0IGJyZWFrcG9pbnQgaGVyZSB0byBkZWJ1ZyBcIlNvdXJjZSBhbmQgZGVzdGluYXRpb24gdGV4dHVyZXMgb2YgdGhlIGRyYXcgYXJlIHRoZSBzYW1lXCIgZXJyb3JzXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlbmRlclRhcmdldC5fc2FtcGxlcyA8IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlbmRlclRhcmdldC5jb2xvckJ1ZmZlciAmJiB0aGlzLnJlbmRlclRhcmdldC5jb2xvckJ1ZmZlciA9PT0gdGV4dHVyZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiVHJ5aW5nIHRvIGJpbmQgY3VycmVudCBjb2xvciBidWZmZXIgYXMgYSB0ZXh0dXJlXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnJlbmRlclRhcmdldC5kZXB0aEJ1ZmZlciAmJiB0aGlzLnJlbmRlclRhcmdldC5kZXB0aEJ1ZmZlciA9PT0gdGV4dHVyZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiVHJ5aW5nIHRvIGJpbmQgY3VycmVudCBkZXB0aCBidWZmZXIgYXMgYSB0ZXh0dXJlXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXIuc2xvdCAhPT0gdGV4dHVyZVVuaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFpKHNhbXBsZXIubG9jYXRpb25JZCwgdGV4dHVyZVVuaXQpO1xuICAgICAgICAgICAgICAgICAgICBzYW1wbGVyLnNsb3QgPSB0ZXh0dXJlVW5pdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGV4dHVyZVVuaXQrKztcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIEFycmF5XG4gICAgICAgICAgICAgICAgc2FtcGxlci5hcnJheS5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIG51bVRleHR1cmVzID0gc2FtcGxlclZhbHVlLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bVRleHR1cmVzOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZSA9IHNhbXBsZXJWYWx1ZVtqXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KTtcblxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVyLmFycmF5W2pdID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmVVbml0Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xaXYoc2FtcGxlci5sb2NhdGlvbklkLCBzYW1wbGVyLmFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbW1pdCBhbnkgdXBkYXRlZCB1bmlmb3Jtc1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdW5pZm9ybXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHVuaWZvcm0gPSB1bmlmb3Jtc1tpXTtcbiAgICAgICAgICAgIHNjb3BlSWQgPSB1bmlmb3JtLnNjb3BlSWQ7XG4gICAgICAgICAgICB1bmlmb3JtVmVyc2lvbiA9IHVuaWZvcm0udmVyc2lvbjtcbiAgICAgICAgICAgIHByb2dyYW1WZXJzaW9uID0gc2NvcGVJZC52ZXJzaW9uT2JqZWN0LnZlcnNpb247XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHRoZSB2YWx1ZSBpcyB2YWxpZFxuICAgICAgICAgICAgaWYgKHVuaWZvcm1WZXJzaW9uLmdsb2JhbElkICE9PSBwcm9ncmFtVmVyc2lvbi5nbG9iYWxJZCB8fCB1bmlmb3JtVmVyc2lvbi5yZXZpc2lvbiAhPT0gcHJvZ3JhbVZlcnNpb24ucmV2aXNpb24pIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmVyc2lvbi5nbG9iYWxJZCA9IHByb2dyYW1WZXJzaW9uLmdsb2JhbElkO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WZXJzaW9uLnJldmlzaW9uID0gcHJvZ3JhbVZlcnNpb24ucmV2aXNpb247XG5cbiAgICAgICAgICAgICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB0byBjb21taXQgdGhlIHVuaWZvcm0gdmFsdWVcbiAgICAgICAgICAgICAgICBpZiAoc2NvcGVJZC52YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW3VuaWZvcm0uZGF0YVR5cGVdKHVuaWZvcm0sIHNjb3BlSWQudmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBFbmFibGUgVEYsIHN0YXJ0IHdyaXRpbmcgdG8gb3V0IGJ1ZmZlclxuICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlckJhc2UoZ2wuVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiwgMCwgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlci5pbXBsLmJ1ZmZlcklkKTtcbiAgICAgICAgICAgIGdsLmJlZ2luVHJhbnNmb3JtRmVlZGJhY2soZ2wuUE9JTlRTKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1vZGUgPSB0aGlzLmdsUHJpbWl0aXZlW3ByaW1pdGl2ZS50eXBlXTtcbiAgICAgICAgY29uc3QgY291bnQgPSBwcmltaXRpdmUuY291bnQ7XG5cbiAgICAgICAgaWYgKHByaW1pdGl2ZS5pbmRleGVkKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleEJ1ZmZlciA9IHRoaXMuaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoaW5kZXhCdWZmZXIuZGV2aWNlID09PSB0aGlzLCBcIlRoZSBJbmRleEJ1ZmZlciB3YXMgbm90IGNyZWF0ZWQgdXNpbmcgY3VycmVudCBHcmFwaGljc0RldmljZVwiKTtcblxuICAgICAgICAgICAgY29uc3QgZm9ybWF0ID0gaW5kZXhCdWZmZXIuaW1wbC5nbEZvcm1hdDtcbiAgICAgICAgICAgIGNvbnN0IG9mZnNldCA9IHByaW1pdGl2ZS5iYXNlICogaW5kZXhCdWZmZXIuYnl0ZXNQZXJJbmRleDtcblxuICAgICAgICAgICAgaWYgKG51bUluc3RhbmNlcyA+IDApIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQobW9kZSwgY291bnQsIGZvcm1hdCwgb2Zmc2V0LCBudW1JbnN0YW5jZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHMobW9kZSwgY291bnQsIGZvcm1hdCwgb2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0ID0gcHJpbWl0aXZlLmJhc2U7XG5cbiAgICAgICAgICAgIGlmIChudW1JbnN0YW5jZXMgPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0FycmF5c0luc3RhbmNlZChtb2RlLCBmaXJzdCwgY291bnQsIG51bUluc3RhbmNlcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXMobW9kZSwgZmlyc3QsIGNvdW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBkaXNhYmxlIFRGXG4gICAgICAgICAgICBnbC5lbmRUcmFuc2Zvcm1GZWVkYmFjaygpO1xuICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlckJhc2UoZ2wuVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiwgMCwgbnVsbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kcmF3Q2FsbHNQZXJGcmFtZSsrO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fcHJpbXNQZXJGcmFtZVtwcmltaXRpdmUudHlwZV0gKz0gcHJpbWl0aXZlLmNvdW50ICogKG51bUluc3RhbmNlcyA+IDEgPyBudW1JbnN0YW5jZXMgOiAxKTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIHRoZSBmcmFtZSBidWZmZXIgb2YgdGhlIGN1cnJlbnRseSBzZXQgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGNvbnRyb2xzIHRoZSBiZWhhdmlvciBvZiB0aGUgY2xlYXJcbiAgICAgKiBvcGVyYXRpb24gZGVmaW5lZCBhcyBmb2xsb3dzOlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRpb25zLmNvbG9yXSAtIFRoZSBjb2xvciB0byBjbGVhciB0aGUgY29sb3IgYnVmZmVyIHRvIGluIHRoZSByYW5nZSAwLjBcbiAgICAgKiB0byAxLjAgZm9yIGVhY2ggY29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5kZXB0aD0xXSAtIFRoZSBkZXB0aCB2YWx1ZSB0byBjbGVhciB0aGUgZGVwdGggYnVmZmVyIHRvIGluIHRoZVxuICAgICAqIHJhbmdlIDAuMCB0byAxLjAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZsYWdzXSAtIFRoZSBidWZmZXJzIHRvIGNsZWFyICh0aGUgdHlwZXMgYmVpbmcgY29sb3IsIGRlcHRoIGFuZFxuICAgICAqIHN0ZW5jaWwpLiBDYW4gYmUgYW55IGJpdHdpc2UgY29tYmluYXRpb24gb2Y6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBDTEVBUkZMQUdfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQ0xFQVJGTEFHX0RFUFRIfVxuICAgICAqIC0ge0BsaW5rIENMRUFSRkxBR19TVEVOQ0lMfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0ZW5jaWw9MF0gLSBUaGUgc3RlbmNpbCB2YWx1ZSB0byBjbGVhciB0aGUgc3RlbmNpbCBidWZmZXIgdG8uIERlZmF1bHRzIHRvIDAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDbGVhciBjb2xvciBidWZmZXIgdG8gYmxhY2sgYW5kIGRlcHRoIGJ1ZmZlciB0byAxLjBcbiAgICAgKiBkZXZpY2UuY2xlYXIoKTtcbiAgICAgKlxuICAgICAqIC8vIENsZWFyIGp1c3QgdGhlIGNvbG9yIGJ1ZmZlciB0byByZWRcbiAgICAgKiBkZXZpY2UuY2xlYXIoe1xuICAgICAqICAgICBjb2xvcjogWzEsIDAsIDAsIDFdLFxuICAgICAqICAgICBmbGFnczogcGMuQ0xFQVJGTEFHX0NPTE9SXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBDbGVhciBjb2xvciBidWZmZXIgdG8geWVsbG93IGFuZCBkZXB0aCB0byAxLjBcbiAgICAgKiBkZXZpY2UuY2xlYXIoe1xuICAgICAqICAgICBjb2xvcjogWzEsIDEsIDAsIDFdLFxuICAgICAqICAgICBkZXB0aDogMSxcbiAgICAgKiAgICAgZmxhZ3M6IHBjLkNMRUFSRkxBR19DT0xPUiB8IHBjLkNMRUFSRkxBR19ERVBUSFxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGNsZWFyKG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB0aGlzLmRlZmF1bHRDbGVhck9wdGlvbnM7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IGRlZmF1bHRPcHRpb25zO1xuXG4gICAgICAgIGNvbnN0IGZsYWdzID0gKG9wdGlvbnMuZmxhZ3MgPT09IHVuZGVmaW5lZCkgPyBkZWZhdWx0T3B0aW9ucy5mbGFncyA6IG9wdGlvbnMuZmxhZ3M7XG4gICAgICAgIGlmIChmbGFncyAhPT0gMCkge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgICAgICAvLyBTZXQgdGhlIGNsZWFyIGNvbG9yXG4gICAgICAgICAgICBpZiAoZmxhZ3MgJiBDTEVBUkZMQUdfQ09MT1IpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xvciA9IChvcHRpb25zLmNvbG9yID09PSB1bmRlZmluZWQpID8gZGVmYXVsdE9wdGlvbnMuY29sb3IgOiBvcHRpb25zLmNvbG9yO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q2xlYXJDb2xvcihjb2xvclswXSwgY29sb3JbMV0sIGNvbG9yWzJdLCBjb2xvclszXSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRDb2xvcldyaXRlKHRydWUsIHRydWUsIHRydWUsIHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmxhZ3MgJiBDTEVBUkZMQUdfREVQVEgpIHtcbiAgICAgICAgICAgICAgICAvLyBTZXQgdGhlIGNsZWFyIGRlcHRoXG4gICAgICAgICAgICAgICAgY29uc3QgZGVwdGggPSAob3B0aW9ucy5kZXB0aCA9PT0gdW5kZWZpbmVkKSA/IGRlZmF1bHRPcHRpb25zLmRlcHRoIDogb3B0aW9ucy5kZXB0aDtcbiAgICAgICAgICAgICAgICB0aGlzLnNldENsZWFyRGVwdGgoZGVwdGgpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0RGVwdGhXcml0ZSh0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX1NURU5DSUwpIHtcbiAgICAgICAgICAgICAgICAvLyBTZXQgdGhlIGNsZWFyIHN0ZW5jaWxcbiAgICAgICAgICAgICAgICBjb25zdCBzdGVuY2lsID0gKG9wdGlvbnMuc3RlbmNpbCA9PT0gdW5kZWZpbmVkKSA/IGRlZmF1bHRPcHRpb25zLnN0ZW5jaWwgOiBvcHRpb25zLnN0ZW5jaWw7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRDbGVhclN0ZW5jaWwoc3RlbmNpbCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENsZWFyIHRoZSBmcmFtZSBidWZmZXJcbiAgICAgICAgICAgIGdsLmNsZWFyKHRoaXMuZ2xDbGVhckZsYWdbZmxhZ3NdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlYWRzIGEgYmxvY2sgb2YgcGl4ZWxzIGZyb20gYSBzcGVjaWZpZWQgcmVjdGFuZ2xlIG9mIHRoZSBjdXJyZW50IGNvbG9yIGZyYW1lYnVmZmVyIGludG8gYW5cbiAgICAgKiBBcnJheUJ1ZmZlclZpZXcgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb29yZGluYXRlIG9mIHRoZSByZWN0YW5nbGUncyBsb3dlci1sZWZ0IGNvcm5lci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5LWNvb3JkaW5hdGUgb2YgdGhlIHJlY3RhbmdsZSdzIGxvd2VyLWxlZnQgY29ybmVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSByZWN0YW5nbGUsIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBoZWlnaHQgb2YgdGhlIHJlY3RhbmdsZSwgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBwaXhlbHMgLSBUaGUgQXJyYXlCdWZmZXJWaWV3IG9iamVjdCB0aGF0IGhvbGRzIHRoZSByZXR1cm5lZCBwaXhlbFxuICAgICAqIGRhdGEuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlYWRQaXhlbHMoeCwgeSwgdywgaCwgcGl4ZWxzKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgZ2wucmVhZFBpeGVscyh4LCB5LCB3LCBoLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBwaXhlbHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgZGVwdGggdmFsdWUgdXNlZCB3aGVuIHRoZSBkZXB0aCBidWZmZXIgaXMgY2xlYXJlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkZXB0aCAtIFRoZSBkZXB0aCB2YWx1ZSB0byBjbGVhciB0aGUgZGVwdGggYnVmZmVyIHRvIGluIHRoZSByYW5nZSAwLjBcbiAgICAgKiB0byAxLjAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldENsZWFyRGVwdGgoZGVwdGgpIHtcbiAgICAgICAgaWYgKGRlcHRoICE9PSB0aGlzLmNsZWFyRGVwdGgpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuY2xlYXJEZXB0aChkZXB0aCk7XG4gICAgICAgICAgICB0aGlzLmNsZWFyRGVwdGggPSBkZXB0aDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgY2xlYXIgY29sb3IgdXNlZCB3aGVuIHRoZSBmcmFtZSBidWZmZXIgaXMgY2xlYXJlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByIC0gVGhlIHJlZCBjb21wb25lbnQgb2YgdGhlIGNvbG9yIGluIHRoZSByYW5nZSAwLjAgdG8gMS4wLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBnIC0gVGhlIGdyZWVuIGNvbXBvbmVudCBvZiB0aGUgY29sb3IgaW4gdGhlIHJhbmdlIDAuMCB0byAxLjAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGIgLSBUaGUgYmx1ZSBjb21wb25lbnQgb2YgdGhlIGNvbG9yIGluIHRoZSByYW5nZSAwLjAgdG8gMS4wLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhIC0gVGhlIGFscGhhIGNvbXBvbmVudCBvZiB0aGUgY29sb3IgaW4gdGhlIHJhbmdlIDAuMCB0byAxLjAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldENsZWFyQ29sb3IociwgZywgYiwgYSkge1xuICAgICAgICBjb25zdCBjID0gdGhpcy5jbGVhckNvbG9yO1xuICAgICAgICBpZiAoKHIgIT09IGMucikgfHwgKGcgIT09IGMuZykgfHwgKGIgIT09IGMuYikgfHwgKGEgIT09IGMuYSkpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuY2xlYXJDb2xvcihyLCBnLCBiLCBhKTtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJDb2xvci5zZXQociwgZywgYiwgYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHN0ZW5jaWwgY2xlYXIgdmFsdWUgdXNlZCB3aGVuIHRoZSBzdGVuY2lsIGJ1ZmZlciBpcyBjbGVhcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIHN0ZW5jaWwgdmFsdWUgdG8gY2xlYXIgdGhlIHN0ZW5jaWwgYnVmZmVyIHRvLlxuICAgICAqL1xuICAgIHNldENsZWFyU3RlbmNpbCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuY2xlYXJTdGVuY2lsKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmNsZWFyU3RlbmNpbCh2YWx1ZSk7XG4gICAgICAgICAgICB0aGlzLmNsZWFyU3RlbmNpbCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB3aGV0aGVyIGRlcHRoIHRlc3RpbmcgaXMgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGRlcHRoIHRlc3RpbmcgaXMgZW5hYmxlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGRlcHRoVGVzdCA9IGRldmljZS5nZXREZXB0aFRlc3QoKTtcbiAgICAgKiBjb25zb2xlLmxvZygnRGVwdGggdGVzdGluZyBpcyAnICsgZGVwdGhUZXN0ID8gJ2VuYWJsZWQnIDogJ2Rpc2FibGVkJyk7XG4gICAgICovXG4gICAgZ2V0RGVwdGhUZXN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kZXB0aFRlc3Q7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvciBkaXNhYmxlcyBkZXB0aCB0ZXN0aW5nIG9mIGZyYWdtZW50cy4gT25jZSB0aGlzIHN0YXRlIGlzIHNldCwgaXQgcGVyc2lzdHMgdW50aWwgaXRcbiAgICAgKiBpcyBjaGFuZ2VkLiBCeSBkZWZhdWx0LCBkZXB0aCB0ZXN0aW5nIGlzIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGRlcHRoVGVzdCAtIFRydWUgdG8gZW5hYmxlIGRlcHRoIHRlc3RpbmcgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGRldmljZS5zZXREZXB0aFRlc3QodHJ1ZSk7XG4gICAgICovXG4gICAgc2V0RGVwdGhUZXN0KGRlcHRoVGVzdCkge1xuICAgICAgICBpZiAodGhpcy5kZXB0aFRlc3QgIT09IGRlcHRoVGVzdCkge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgaWYgKGRlcHRoVGVzdCkge1xuICAgICAgICAgICAgICAgIGdsLmVuYWJsZShnbC5ERVBUSF9URVNUKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5ERVBUSF9URVNUKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZGVwdGhUZXN0ID0gZGVwdGhUZXN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyB0aGUgZGVwdGggdGVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmdW5jIC0gQSBmdW5jdGlvbiB0byBjb21wYXJlIGEgbmV3IGRlcHRoIHZhbHVlIHdpdGggYW4gZXhpc3Rpbmcgei1idWZmZXJcbiAgICAgKiB2YWx1ZSBhbmQgZGVjaWRlIGlmIHRvIHdyaXRlIGEgcGl4ZWwuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTkVWRVJ9OiBkb24ndCBkcmF3XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfTogZHJhdyBpZiBuZXcgZGVwdGggPCBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggPT0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCA8PSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9OiBkcmF3IGlmIG5ldyBkZXB0aCA+IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCAhPSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IGRyYXcgaWYgbmV3IGRlcHRoID49IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfQUxXQVlTfTogYWx3YXlzIGRyYXdcbiAgICAgKi9cbiAgICBzZXREZXB0aEZ1bmMoZnVuYykge1xuICAgICAgICBpZiAodGhpcy5kZXB0aEZ1bmMgPT09IGZ1bmMpIHJldHVybjtcbiAgICAgICAgdGhpcy5nbC5kZXB0aEZ1bmModGhpcy5nbENvbXBhcmlzb25bZnVuY10pO1xuICAgICAgICB0aGlzLmRlcHRoRnVuYyA9IGZ1bmM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB3aGV0aGVyIHdyaXRlcyB0byB0aGUgZGVwdGggYnVmZmVyIGFyZSBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgZGVwdGggd3JpdGluZyBpcyBlbmFibGVkIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgZGVwdGhXcml0ZSA9IGRldmljZS5nZXREZXB0aFdyaXRlKCk7XG4gICAgICogY29uc29sZS5sb2coJ0RlcHRoIHdyaXRpbmcgaXMgJyArIGRlcHRoV3JpdGUgPyAnZW5hYmxlZCcgOiAnZGlzYWJsZWQnKTtcbiAgICAgKi9cbiAgICBnZXREZXB0aFdyaXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kZXB0aFdyaXRlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgd3JpdGVzIHRvIHRoZSBkZXB0aCBidWZmZXIuIE9uY2UgdGhpcyBzdGF0ZSBpcyBzZXQsIGl0IHBlcnNpc3RzIHVudGlsIGl0XG4gICAgICogaXMgY2hhbmdlZC4gQnkgZGVmYXVsdCwgZGVwdGggd3JpdGVzIGFyZSBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSB3cml0ZURlcHRoIC0gVHJ1ZSB0byBlbmFibGUgZGVwdGggd3JpdGluZyBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZGV2aWNlLnNldERlcHRoV3JpdGUodHJ1ZSk7XG4gICAgICovXG4gICAgc2V0RGVwdGhXcml0ZSh3cml0ZURlcHRoKSB7XG4gICAgICAgIGlmICh0aGlzLmRlcHRoV3JpdGUgIT09IHdyaXRlRGVwdGgpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZGVwdGhNYXNrKHdyaXRlRGVwdGgpO1xuICAgICAgICAgICAgdGhpcy5kZXB0aFdyaXRlID0gd3JpdGVEZXB0aDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgd3JpdGVzIHRvIHRoZSBjb2xvciBidWZmZXIuIE9uY2UgdGhpcyBzdGF0ZSBpcyBzZXQsIGl0IHBlcnNpc3RzIHVudGlsIGl0XG4gICAgICogaXMgY2hhbmdlZC4gQnkgZGVmYXVsdCwgY29sb3Igd3JpdGVzIGFyZSBlbmFibGVkIGZvciBhbGwgY29sb3IgY2hhbm5lbHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHdyaXRlUmVkIC0gVHJ1ZSB0byBlbmFibGUgd3JpdGluZyBvZiB0aGUgcmVkIGNoYW5uZWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHdyaXRlR3JlZW4gLSBUcnVlIHRvIGVuYWJsZSB3cml0aW5nIG9mIHRoZSBncmVlbiBjaGFubmVsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB3cml0ZUJsdWUgLSBUcnVlIHRvIGVuYWJsZSB3cml0aW5nIG9mIHRoZSBibHVlIGNoYW5uZWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHdyaXRlQWxwaGEgLSBUcnVlIHRvIGVuYWJsZSB3cml0aW5nIG9mIHRoZSBhbHBoYSBjaGFubmVsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBKdXN0IHdyaXRlIGFscGhhIGludG8gdGhlIGZyYW1lIGJ1ZmZlclxuICAgICAqIGRldmljZS5zZXRDb2xvcldyaXRlKGZhbHNlLCBmYWxzZSwgZmFsc2UsIHRydWUpO1xuICAgICAqL1xuICAgIHNldENvbG9yV3JpdGUod3JpdGVSZWQsIHdyaXRlR3JlZW4sIHdyaXRlQmx1ZSwgd3JpdGVBbHBoYSkge1xuICAgICAgICBpZiAoKHRoaXMud3JpdGVSZWQgIT09IHdyaXRlUmVkKSB8fFxuICAgICAgICAgICAgKHRoaXMud3JpdGVHcmVlbiAhPT0gd3JpdGVHcmVlbikgfHxcbiAgICAgICAgICAgICh0aGlzLndyaXRlQmx1ZSAhPT0gd3JpdGVCbHVlKSB8fFxuICAgICAgICAgICAgKHRoaXMud3JpdGVBbHBoYSAhPT0gd3JpdGVBbHBoYSkpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuY29sb3JNYXNrKHdyaXRlUmVkLCB3cml0ZUdyZWVuLCB3cml0ZUJsdWUsIHdyaXRlQWxwaGEpO1xuICAgICAgICAgICAgdGhpcy53cml0ZVJlZCA9IHdyaXRlUmVkO1xuICAgICAgICAgICAgdGhpcy53cml0ZUdyZWVuID0gd3JpdGVHcmVlbjtcbiAgICAgICAgICAgIHRoaXMud3JpdGVCbHVlID0gd3JpdGVCbHVlO1xuICAgICAgICAgICAgdGhpcy53cml0ZUFscGhhID0gd3JpdGVBbHBoYTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgYWxwaGEgdG8gY292ZXJhZ2UgKFdlYkdMMiBvbmx5KS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc3RhdGUgLSBUcnVlIHRvIGVuYWJsZSBhbHBoYSB0byBjb3ZlcmFnZSBhbmQgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0QWxwaGFUb0NvdmVyYWdlKHN0YXRlKSB7XG4gICAgICAgIGlmICghdGhpcy53ZWJnbDIpIHJldHVybjtcbiAgICAgICAgaWYgKHRoaXMuYWxwaGFUb0NvdmVyYWdlID09PSBzdGF0ZSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmFscGhhVG9Db3ZlcmFnZSA9IHN0YXRlO1xuXG4gICAgICAgIGlmIChzdGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5nbC5lbmFibGUodGhpcy5nbC5TQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5nbC5kaXNhYmxlKHRoaXMuZ2wuU0FNUExFX0FMUEhBX1RPX0NPVkVSQUdFKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIG91dHB1dCB2ZXJ0ZXggYnVmZmVyLiBJdCB3aWxsIGJlIHdyaXR0ZW4gdG8gYnkgYSBzaGFkZXIgd2l0aCB0cmFuc2Zvcm0gZmVlZGJhY2tcbiAgICAgKiB2YXJ5aW5ncy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVydGV4QnVmZmVyfSB0ZiAtIFRoZSBvdXRwdXQgdmVydGV4IGJ1ZmZlci5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIodGYpIHtcbiAgICAgICAgaWYgKHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIgPT09IHRmKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIgPSB0ZjtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGlmICh0Zikge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5mZWVkYmFjaykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZlZWRiYWNrID0gZ2wuY3JlYXRlVHJhbnNmb3JtRmVlZGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZ2wuYmluZFRyYW5zZm9ybUZlZWRiYWNrKGdsLlRSQU5TRk9STV9GRUVEQkFDSywgdGhpcy5mZWVkYmFjayk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmJpbmRUcmFuc2Zvcm1GZWVkYmFjayhnbC5UUkFOU0ZPUk1fRkVFREJBQ0ssIG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVG9nZ2xlcyB0aGUgcmFzdGVyaXphdGlvbiByZW5kZXIgc3RhdGUuIFVzZWZ1bCB3aXRoIHRyYW5zZm9ybSBmZWVkYmFjaywgd2hlbiB5b3Ugb25seSBuZWVkXG4gICAgICogdG8gcHJvY2VzcyB0aGUgZGF0YSB3aXRob3V0IGRyYXdpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9uIC0gVHJ1ZSB0byBlbmFibGUgcmFzdGVyaXphdGlvbiBhbmQgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0UmFzdGVyKG9uKSB7XG4gICAgICAgIGlmICh0aGlzLnJhc3RlciA9PT0gb24pIHJldHVybjtcblxuICAgICAgICB0aGlzLnJhc3RlciA9IG9uO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgaWYgKG9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5nbC5kaXNhYmxlKHRoaXMuZ2wuUkFTVEVSSVpFUl9ESVNDQVJEKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5nbC5lbmFibGUodGhpcy5nbC5SQVNURVJJWkVSX0RJU0NBUkQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVG9nZ2xlcyB0aGUgcG9seWdvbiBvZmZzZXQgcmVuZGVyIHN0YXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvbiAtIFRydWUgdG8gZW5hYmxlIHBvbHlnb24gb2Zmc2V0IGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXREZXB0aEJpYXMob24pIHtcbiAgICAgICAgaWYgKHRoaXMuZGVwdGhCaWFzRW5hYmxlZCA9PT0gb24pIHJldHVybjtcblxuICAgICAgICB0aGlzLmRlcHRoQmlhc0VuYWJsZWQgPSBvbjtcblxuICAgICAgICBpZiAob24pIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5QT0xZR09OX09GRlNFVF9GSUxMKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNwZWNpZmllcyB0aGUgc2NhbGUgZmFjdG9yIGFuZCB1bml0cyB0byBjYWxjdWxhdGUgZGVwdGggdmFsdWVzLiBUaGUgb2Zmc2V0IGlzIGFkZGVkIGJlZm9yZVxuICAgICAqIHRoZSBkZXB0aCB0ZXN0IGlzIHBlcmZvcm1lZCBhbmQgYmVmb3JlIHRoZSB2YWx1ZSBpcyB3cml0dGVuIGludG8gdGhlIGRlcHRoIGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb25zdEJpYXMgLSBUaGUgbXVsdGlwbGllciBieSB3aGljaCBhbiBpbXBsZW1lbnRhdGlvbi1zcGVjaWZpYyB2YWx1ZSBpc1xuICAgICAqIG11bHRpcGxpZWQgd2l0aCB0byBjcmVhdGUgYSBjb25zdGFudCBkZXB0aCBvZmZzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNsb3BlQmlhcyAtIFRoZSBzY2FsZSBmYWN0b3IgZm9yIHRoZSB2YXJpYWJsZSBkZXB0aCBvZmZzZXQgZm9yIGVhY2ggcG9seWdvbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0RGVwdGhCaWFzVmFsdWVzKGNvbnN0Qmlhcywgc2xvcGVCaWFzKSB7XG4gICAgICAgIHRoaXMuZ2wucG9seWdvbk9mZnNldChzbG9wZUJpYXMsIGNvbnN0Qmlhcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB3aGV0aGVyIGJsZW5kaW5nIGlzIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBibGVuZGluZyBpcyBlbmFibGVkIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgZ2V0QmxlbmRpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJsZW5kaW5nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgYmxlbmRpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGJsZW5kaW5nIC0gVHJ1ZSB0byBlbmFibGUgYmxlbmRpbmcgYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICovXG4gICAgc2V0QmxlbmRpbmcoYmxlbmRpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuYmxlbmRpbmcgIT09IGJsZW5kaW5nKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBpZiAoYmxlbmRpbmcpIHtcbiAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kaXNhYmxlKGdsLkJMRU5EKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuYmxlbmRpbmcgPSBibGVuZGluZztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgc3RlbmNpbCB0ZXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGUgLSBUcnVlIHRvIGVuYWJsZSBzdGVuY2lsIHRlc3QgYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICovXG4gICAgc2V0U3RlbmNpbFRlc3QoZW5hYmxlKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWwgIT09IGVuYWJsZSkge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgaWYgKGVuYWJsZSkge1xuICAgICAgICAgICAgICAgIGdsLmVuYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kaXNhYmxlKGdsLlNURU5DSUxfVEVTVCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWwgPSBlbmFibGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHN0ZW5jaWwgdGVzdCBmb3IgYm90aCBmcm9udCBhbmQgYmFjayBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmdW5jIC0gQSBjb21wYXJpc29uIGZ1bmN0aW9uIHRoYXQgZGVjaWRlcyBpZiB0aGUgcGl4ZWwgc2hvdWxkIGJlIHdyaXR0ZW4sXG4gICAgICogYmFzZWQgb24gdGhlIGN1cnJlbnQgc3RlbmNpbCBidWZmZXIgdmFsdWUsIHJlZmVyZW5jZSB2YWx1ZSwgYW5kIG1hc2sgdmFsdWUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTkVWRVJ9OiBuZXZlciBwYXNzXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfTogcGFzcyBpZiAocmVmICYgbWFzaykgPCAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID09IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spIDw9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgIT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPj0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfQUxXQVlTfTogYWx3YXlzIHBhc3NcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByZWYgLSBSZWZlcmVuY2UgdmFsdWUgdXNlZCBpbiBjb21wYXJpc29uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXNrIC0gTWFzayBhcHBsaWVkIHRvIHN0ZW5jaWwgYnVmZmVyIHZhbHVlIGFuZCByZWZlcmVuY2UgdmFsdWUgYmVmb3JlXG4gICAgICogY29tcGFyaXNvbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsRnVuYyhmdW5jLCByZWYsIG1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZ1bmNGcm9udCAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZGcm9udCAhPT0gcmVmIHx8IHRoaXMuc3RlbmNpbE1hc2tGcm9udCAhPT0gbWFzayB8fFxuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRnVuY0JhY2sgIT09IGZ1bmMgfHwgdGhpcy5zdGVuY2lsUmVmQmFjayAhPT0gcmVmIHx8IHRoaXMuc3RlbmNpbE1hc2tCYWNrICE9PSBtYXNrKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5zdGVuY2lsRnVuYyh0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSwgcmVmLCBtYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IHRoaXMuc3RlbmNpbEZ1bmNCYWNrID0gZnVuYztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFJlZkZyb250ID0gdGhpcy5zdGVuY2lsUmVmQmFjayA9IHJlZjtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IHRoaXMuc3RlbmNpbE1hc2tCYWNrID0gbWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgc3RlbmNpbCB0ZXN0IGZvciBmcm9udCBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmdW5jIC0gQSBjb21wYXJpc29uIGZ1bmN0aW9uIHRoYXQgZGVjaWRlcyBpZiB0aGUgcGl4ZWwgc2hvdWxkIGJlIHdyaXR0ZW4sXG4gICAgICogYmFzZWQgb24gdGhlIGN1cnJlbnQgc3RlbmNpbCBidWZmZXIgdmFsdWUsIHJlZmVyZW5jZSB2YWx1ZSwgYW5kIG1hc2sgdmFsdWUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTkVWRVJ9OiBuZXZlciBwYXNzXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfTogcGFzcyBpZiAocmVmICYgbWFzaykgPCAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID09IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spIDw9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgIT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPj0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfQUxXQVlTfTogYWx3YXlzIHBhc3NcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByZWYgLSBSZWZlcmVuY2UgdmFsdWUgdXNlZCBpbiBjb21wYXJpc29uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXNrIC0gTWFzayBhcHBsaWVkIHRvIHN0ZW5jaWwgYnVmZmVyIHZhbHVlIGFuZCByZWZlcmVuY2UgdmFsdWUgYmVmb3JlIGNvbXBhcmlzb24uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbEZ1bmNGcm9udChmdW5jLCByZWYsIG1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZ1bmNGcm9udCAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZGcm9udCAhPT0gcmVmIHx8IHRoaXMuc3RlbmNpbE1hc2tGcm9udCAhPT0gbWFzaykge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmNTZXBhcmF0ZShnbC5GUk9OVCwgdGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgPSBmdW5jO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsUmVmRnJvbnQgPSByZWY7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgPSBtYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBzdGVuY2lsIHRlc3QgZm9yIGJhY2sgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZnVuYyAtIEEgY29tcGFyaXNvbiBmdW5jdGlvbiB0aGF0IGRlY2lkZXMgaWYgdGhlIHBpeGVsIHNob3VsZCBiZSB3cml0dGVuLFxuICAgICAqIGJhc2VkIG9uIHRoZSBjdXJyZW50IHN0ZW5jaWwgYnVmZmVyIHZhbHVlLCByZWZlcmVuY2UgdmFsdWUsIGFuZCBtYXNrIHZhbHVlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX05FVkVSfTogbmV2ZXIgcGFzc1xuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU306IHBhc3MgaWYgKHJlZiAmIG1hc2spIDwgKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA9PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfTogcGFzcyBpZiAocmVmICYgbWFzaykgPiAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spICE9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID49IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0FMV0FZU306IGFsd2F5cyBwYXNzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmVmIC0gUmVmZXJlbmNlIHZhbHVlIHVzZWQgaW4gY29tcGFyaXNvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFzayAtIE1hc2sgYXBwbGllZCB0byBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSBhbmQgcmVmZXJlbmNlIHZhbHVlIGJlZm9yZSBjb21wYXJpc29uLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxGdW5jQmFjayhmdW5jLCByZWYsIG1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZ1bmNCYWNrICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkJhY2sgIT09IHJlZiB8fCB0aGlzLnN0ZW5jaWxNYXNrQmFjayAhPT0gbWFzaykge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmNTZXBhcmF0ZShnbC5CQUNLLCB0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSwgcmVmLCBtYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNCYWNrID0gZnVuYztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFJlZkJhY2sgPSByZWY7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrQmFjayA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGhvdyBzdGVuY2lsIGJ1ZmZlciB2YWx1ZXMgc2hvdWxkIGJlIG1vZGlmaWVkIGJhc2VkIG9uIHRoZSByZXN1bHQgb2YgZGVwdGgvc3RlbmNpbFxuICAgICAqIHRlc3RzLiBXb3JrcyBmb3IgYm90aCBmcm9udCBhbmQgYmFjayBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgc3RlbmNpbCB0ZXN0IGlzIGZhaWxlZC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0tFRVB9OiBkb24ndCBjaGFuZ2UgdGhlIHN0ZW5jaWwgYnVmZmVyIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX1pFUk99OiBzZXQgdmFsdWUgdG8gemVyb1xuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9SRVBMQUNFfTogcmVwbGFjZSB2YWx1ZSB3aXRoIHRoZSByZWZlcmVuY2UgdmFsdWUgKHNlZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0U3RlbmNpbEZ1bmN9KVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlR9OiBpbmNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVFdSQVB9OiBpbmNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byB6ZXJvIHdoZW4gaXQncyBsYXJnZXJcbiAgICAgKiB0aGFuIGEgbWF4aW11bSByZXByZXNlbnRhYmxlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVH06IGRlY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUH06IGRlY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIGEgbWF4aW11bVxuICAgICAqIHJlcHJlc2VudGFibGUgdmFsdWUsIGlmIHRoZSBjdXJyZW50IHZhbHVlIGlzIDBcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5WRVJUfTogaW52ZXJ0IHRoZSB2YWx1ZSBiaXR3aXNlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gemZhaWwgLSBBY3Rpb24gdG8gdGFrZSBpZiBkZXB0aCB0ZXN0IGlzIGZhaWxlZC4gIEFjY2VwdHMgdGhlIHNhbWUgdmFsdWVzIGFzXG4gICAgICogYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6cGFzcyAtIEFjdGlvbiB0byB0YWtlIGlmIGJvdGggZGVwdGggYW5kIHN0ZW5jaWwgdGVzdCBhcmUgcGFzc2VkLiBBY2NlcHRzXG4gICAgICogdGhlIHNhbWUgdmFsdWVzIGFzIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd3JpdGVNYXNrIC0gQSBiaXQgbWFzayBhcHBsaWVkIHRvIHRoZSByZWZlcmVuY2UgdmFsdWUsIHdoZW4gd3JpdHRlbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsT3BlcmF0aW9uKGZhaWwsIHpmYWlsLCB6cGFzcywgd3JpdGVNYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgIT09IGZhaWwgfHwgdGhpcy5zdGVuY2lsWmZhaWxGcm9udCAhPT0gemZhaWwgfHwgdGhpcy5zdGVuY2lsWnBhc3NGcm9udCAhPT0genBhc3MgfHxcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZhaWxCYWNrICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsQmFjayAhPT0gemZhaWwgfHwgdGhpcy5zdGVuY2lsWnBhc3NCYWNrICE9PSB6cGFzcykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsT3AodGhpcy5nbFN0ZW5jaWxPcFtmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6ZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbenBhc3NdKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZhaWxGcm9udCA9IHRoaXMuc3RlbmNpbEZhaWxCYWNrID0gZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgPSB6ZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgIT09IHdyaXRlTWFzayB8fCB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrICE9PSB3cml0ZU1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE1hc2sod3JpdGVNYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ID0gd3JpdGVNYXNrO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgaG93IHN0ZW5jaWwgYnVmZmVyIHZhbHVlcyBzaG91bGQgYmUgbW9kaWZpZWQgYmFzZWQgb24gdGhlIHJlc3VsdCBvZiBkZXB0aC9zdGVuY2lsXG4gICAgICogdGVzdHMuIFdvcmtzIGZvciBmcm9udCBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgc3RlbmNpbCB0ZXN0IGlzIGZhaWxlZC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0tFRVB9OiBkb24ndCBjaGFuZ2UgdGhlIHN0ZW5jaWwgYnVmZmVyIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX1pFUk99OiBzZXQgdmFsdWUgdG8gemVyb1xuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9SRVBMQUNFfTogcmVwbGFjZSB2YWx1ZSB3aXRoIHRoZSByZWZlcmVuY2UgdmFsdWUgKHNlZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0U3RlbmNpbEZ1bmN9KVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlR9OiBpbmNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVFdSQVB9OiBpbmNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byB6ZXJvIHdoZW4gaXQncyBsYXJnZXJcbiAgICAgKiB0aGFuIGEgbWF4aW11bSByZXByZXNlbnRhYmxlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVH06IGRlY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUH06IGRlY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIGEgbWF4aW11bVxuICAgICAqIHJlcHJlc2VudGFibGUgdmFsdWUsIGlmIHRoZSBjdXJyZW50IHZhbHVlIGlzIDBcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5WRVJUfTogaW52ZXJ0IHRoZSB2YWx1ZSBiaXR3aXNlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gemZhaWwgLSBBY3Rpb24gdG8gdGFrZSBpZiBkZXB0aCB0ZXN0IGlzIGZhaWxlZC4gIEFjY2VwdHMgdGhlIHNhbWUgdmFsdWVzIGFzXG4gICAgICogYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6cGFzcyAtIEFjdGlvbiB0byB0YWtlIGlmIGJvdGggZGVwdGggYW5kIHN0ZW5jaWwgdGVzdCBhcmUgcGFzc2VkLiAgQWNjZXB0c1xuICAgICAqIHRoZSBzYW1lIHZhbHVlcyBhcyBgZmFpbGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdyaXRlTWFzayAtIEEgYml0IG1hc2sgYXBwbGllZCB0byB0aGUgcmVmZXJlbmNlIHZhbHVlLCB3aGVuIHdyaXR0ZW4uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbE9wZXJhdGlvbkZyb250KGZhaWwsIHpmYWlsLCB6cGFzcywgd3JpdGVNYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgIT09IGZhaWwgfHwgdGhpcy5zdGVuY2lsWmZhaWxGcm9udCAhPT0gemZhaWwgfHwgdGhpcy5zdGVuY2lsWnBhc3NGcm9udCAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wU2VwYXJhdGUodGhpcy5nbC5GUk9OVCwgdGhpcy5nbFN0ZW5jaWxPcFtmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6ZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbenBhc3NdKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZhaWxGcm9udCA9IGZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ID0genBhc3M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ICE9PSB3cml0ZU1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE1hc2tTZXBhcmF0ZSh0aGlzLmdsLkZST05ULCB3cml0ZU1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgPSB3cml0ZU1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGhvdyBzdGVuY2lsIGJ1ZmZlciB2YWx1ZXMgc2hvdWxkIGJlIG1vZGlmaWVkIGJhc2VkIG9uIHRoZSByZXN1bHQgb2YgZGVwdGgvc3RlbmNpbFxuICAgICAqIHRlc3RzLiBXb3JrcyBmb3IgYmFjayBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgc3RlbmNpbCB0ZXN0IGlzIGZhaWxlZC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0tFRVB9OiBkb24ndCBjaGFuZ2UgdGhlIHN0ZW5jaWwgYnVmZmVyIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX1pFUk99OiBzZXQgdmFsdWUgdG8gemVyb1xuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9SRVBMQUNFfTogcmVwbGFjZSB2YWx1ZSB3aXRoIHRoZSByZWZlcmVuY2UgdmFsdWUgKHNlZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0U3RlbmNpbEZ1bmN9KVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlR9OiBpbmNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVFdSQVB9OiBpbmNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byB6ZXJvIHdoZW4gaXQncyBsYXJnZXJcbiAgICAgKiB0aGFuIGEgbWF4aW11bSByZXByZXNlbnRhYmxlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVH06IGRlY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUH06IGRlY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIGEgbWF4aW11bVxuICAgICAqIHJlcHJlc2VudGFibGUgdmFsdWUsIGlmIHRoZSBjdXJyZW50IHZhbHVlIGlzIDBcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5WRVJUfTogaW52ZXJ0IHRoZSB2YWx1ZSBiaXR3aXNlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gemZhaWwgLSBBY3Rpb24gdG8gdGFrZSBpZiBkZXB0aCB0ZXN0IGlzIGZhaWxlZC4gQWNjZXB0cyB0aGUgc2FtZSB2YWx1ZXMgYXNcbiAgICAgKiBgZmFpbGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpwYXNzIC0gQWN0aW9uIHRvIHRha2UgaWYgYm90aCBkZXB0aCBhbmQgc3RlbmNpbCB0ZXN0IGFyZSBwYXNzZWQuIEFjY2VwdHNcbiAgICAgKiB0aGUgc2FtZSB2YWx1ZXMgYXMgYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3cml0ZU1hc2sgLSBBIGJpdCBtYXNrIGFwcGxpZWQgdG8gdGhlIHJlZmVyZW5jZSB2YWx1ZSwgd2hlbiB3cml0dGVuLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxPcGVyYXRpb25CYWNrKGZhaWwsIHpmYWlsLCB6cGFzcywgd3JpdGVNYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEJhY2sgPSBmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB3cml0ZU1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgYmxlbmRpbmcgb3BlcmF0aW9ucy4gQm90aCBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGJsZW5kIG1vZGVzIGNhbiB0YWtlIHRoZVxuICAgICAqIGZvbGxvd2luZyB2YWx1ZXM6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfWkVST31cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9TUkNfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX0RTVF9DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEV9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX0RTVF9BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfQ09OU1RBTlRfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVF9DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfQ09OU1RBTlRfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVF9BTFBIQX1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZFNyYyAtIFRoZSBzb3VyY2UgYmxlbmQgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kRHN0IC0gVGhlIGRlc3RpbmF0aW9uIGJsZW5kIGZ1bmN0aW9uLlxuICAgICAqL1xuICAgIHNldEJsZW5kRnVuY3Rpb24oYmxlbmRTcmMsIGJsZW5kRHN0KSB7XG4gICAgICAgIGlmICh0aGlzLmJsZW5kU3JjICE9PSBibGVuZFNyYyB8fCB0aGlzLmJsZW5kRHN0ICE9PSBibGVuZERzdCB8fCB0aGlzLnNlcGFyYXRlQWxwaGFCbGVuZCkge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZEZ1bmModGhpcy5nbEJsZW5kRnVuY3Rpb25bYmxlbmRTcmNdLCB0aGlzLmdsQmxlbmRGdW5jdGlvbltibGVuZERzdF0pO1xuICAgICAgICAgICAgdGhpcy5ibGVuZFNyYyA9IGJsZW5kU3JjO1xuICAgICAgICAgICAgdGhpcy5ibGVuZERzdCA9IGJsZW5kRHN0O1xuICAgICAgICAgICAgdGhpcy5zZXBhcmF0ZUFscGhhQmxlbmQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgYmxlbmRpbmcgb3BlcmF0aW9ucy4gQm90aCBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGJsZW5kIG1vZGVzIGNhbiB0YWtlIHRoZVxuICAgICAqIGZvbGxvd2luZyB2YWx1ZXM6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfWkVST31cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9TUkNfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX0RTVF9DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEV9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX0RTVF9BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQX1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZFNyYyAtIFRoZSBzb3VyY2UgYmxlbmQgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kRHN0IC0gVGhlIGRlc3RpbmF0aW9uIGJsZW5kIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZFNyY0FscGhhIC0gVGhlIHNlcGFyYXRlIHNvdXJjZSBibGVuZCBmdW5jdGlvbiBmb3IgdGhlIGFscGhhIGNoYW5uZWwuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kRHN0QWxwaGEgLSBUaGUgc2VwYXJhdGUgZGVzdGluYXRpb24gYmxlbmQgZnVuY3Rpb24gZm9yIHRoZSBhbHBoYSBjaGFubmVsLlxuICAgICAqL1xuICAgIHNldEJsZW5kRnVuY3Rpb25TZXBhcmF0ZShibGVuZFNyYywgYmxlbmREc3QsIGJsZW5kU3JjQWxwaGEsIGJsZW5kRHN0QWxwaGEpIHtcbiAgICAgICAgaWYgKHRoaXMuYmxlbmRTcmMgIT09IGJsZW5kU3JjIHx8IHRoaXMuYmxlbmREc3QgIT09IGJsZW5kRHN0IHx8IHRoaXMuYmxlbmRTcmNBbHBoYSAhPT0gYmxlbmRTcmNBbHBoYSB8fCB0aGlzLmJsZW5kRHN0QWxwaGEgIT09IGJsZW5kRHN0QWxwaGEgfHwgIXRoaXMuc2VwYXJhdGVBbHBoYUJsZW5kKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmJsZW5kRnVuY1NlcGFyYXRlKHRoaXMuZ2xCbGVuZEZ1bmN0aW9uW2JsZW5kU3JjXSwgdGhpcy5nbEJsZW5kRnVuY3Rpb25bYmxlbmREc3RdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdsQmxlbmRGdW5jdGlvbltibGVuZFNyY0FscGhhXSwgdGhpcy5nbEJsZW5kRnVuY3Rpb25bYmxlbmREc3RBbHBoYV0pO1xuICAgICAgICAgICAgdGhpcy5ibGVuZFNyYyA9IGJsZW5kU3JjO1xuICAgICAgICAgICAgdGhpcy5ibGVuZERzdCA9IGJsZW5kRHN0O1xuICAgICAgICAgICAgdGhpcy5ibGVuZFNyY0FscGhhID0gYmxlbmRTcmNBbHBoYTtcbiAgICAgICAgICAgIHRoaXMuYmxlbmREc3RBbHBoYSA9IGJsZW5kRHN0QWxwaGE7XG4gICAgICAgICAgICB0aGlzLnNlcGFyYXRlQWxwaGFCbGVuZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHRoZSBibGVuZGluZyBlcXVhdGlvbi4gVGhlIGRlZmF1bHQgYmxlbmQgZXF1YXRpb24gaXMge0BsaW5rIEJMRU5ERVFVQVRJT05fQUREfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZEVxdWF0aW9uIC0gVGhlIGJsZW5kIGVxdWF0aW9uLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX0FERH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX1NVQlRSQUNUfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fUkVWRVJTRV9TVUJUUkFDVH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX01JTn1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX01BWH1cbiAgICAgKlxuICAgICAqIE5vdGUgdGhhdCBNSU4gYW5kIE1BWCBtb2RlcyByZXF1aXJlIGVpdGhlciBFWFRfYmxlbmRfbWlubWF4IG9yIFdlYkdMMiB0byB3b3JrIChjaGVja1xuICAgICAqIGRldmljZS5leHRCbGVuZE1pbm1heCkuXG4gICAgICovXG4gICAgc2V0QmxlbmRFcXVhdGlvbihibGVuZEVxdWF0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLmJsZW5kRXF1YXRpb24gIT09IGJsZW5kRXF1YXRpb24gfHwgdGhpcy5zZXBhcmF0ZUFscGhhRXF1YXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmxlbmRFcXVhdGlvbih0aGlzLmdsQmxlbmRFcXVhdGlvbltibGVuZEVxdWF0aW9uXSk7XG4gICAgICAgICAgICB0aGlzLmJsZW5kRXF1YXRpb24gPSBibGVuZEVxdWF0aW9uO1xuICAgICAgICAgICAgdGhpcy5zZXBhcmF0ZUFscGhhRXF1YXRpb24gPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgdGhlIGJsZW5kaW5nIGVxdWF0aW9uLiBUaGUgZGVmYXVsdCBibGVuZCBlcXVhdGlvbiBpcyB7QGxpbmsgQkxFTkRFUVVBVElPTl9BRER9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kRXF1YXRpb24gLSBUaGUgYmxlbmQgZXF1YXRpb24uIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fQUREfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fU1VCVFJBQ1R9XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9SRVZFUlNFX1NVQlRSQUNUfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fTUlOfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fTUFYfVxuICAgICAqXG4gICAgICogTm90ZSB0aGF0IE1JTiBhbmQgTUFYIG1vZGVzIHJlcXVpcmUgZWl0aGVyIEVYVF9ibGVuZF9taW5tYXggb3IgV2ViR0wyIHRvIHdvcmsgKGNoZWNrXG4gICAgICogZGV2aWNlLmV4dEJsZW5kTWlubWF4KS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRBbHBoYUVxdWF0aW9uIC0gQSBzZXBhcmF0ZSBibGVuZCBlcXVhdGlvbiBmb3IgdGhlIGFscGhhIGNoYW5uZWwuXG4gICAgICogQWNjZXB0cyBzYW1lIHZhbHVlcyBhcyBgYmxlbmRFcXVhdGlvbmAuXG4gICAgICovXG4gICAgc2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlKGJsZW5kRXF1YXRpb24sIGJsZW5kQWxwaGFFcXVhdGlvbikge1xuICAgICAgICBpZiAodGhpcy5ibGVuZEVxdWF0aW9uICE9PSBibGVuZEVxdWF0aW9uIHx8IHRoaXMuYmxlbmRBbHBoYUVxdWF0aW9uICE9PSBibGVuZEFscGhhRXF1YXRpb24gfHwgIXRoaXMuc2VwYXJhdGVBbHBoYUVxdWF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmJsZW5kRXF1YXRpb25TZXBhcmF0ZSh0aGlzLmdsQmxlbmRFcXVhdGlvbltibGVuZEVxdWF0aW9uXSwgdGhpcy5nbEJsZW5kRXF1YXRpb25bYmxlbmRBbHBoYUVxdWF0aW9uXSk7XG4gICAgICAgICAgICB0aGlzLmJsZW5kRXF1YXRpb24gPSBibGVuZEVxdWF0aW9uO1xuICAgICAgICAgICAgdGhpcy5ibGVuZEFscGhhRXF1YXRpb24gPSBibGVuZEFscGhhRXF1YXRpb247XG4gICAgICAgICAgICB0aGlzLnNlcGFyYXRlQWxwaGFFcXVhdGlvbiA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gYmxlbmRpbmcgZmFjdG9ycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByIC0gVGhlIHJlZCBjb21wb25lbnQgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gRGVmYXVsdCB2YWx1ZSBpcyAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBnIC0gVGhlIGdyZWVuIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGIgLSBUaGUgYmx1ZSBjb21wb25lbnQgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gRGVmYXVsdCB2YWx1ZSBpcyAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhIC0gVGhlIGFscGhhIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEJsZW5kQ29sb3IociwgZywgYiwgYSkge1xuICAgICAgICBjb25zdCBjID0gdGhpcy5ibGVuZENvbG9yO1xuICAgICAgICBpZiAoKHIgIT09IGMucikgfHwgKGcgIT09IGMuZykgfHwgKGIgIT09IGMuYikgfHwgKGEgIT09IGMuYSkpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmxlbmRDb2xvcihyLCBnLCBiLCBhKTtcbiAgICAgICAgICAgIGMuc2V0KHIsIGcsIGIsIGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgaG93IHRyaWFuZ2xlcyBhcmUgY3VsbGVkIGJhc2VkIG9uIHRoZWlyIGZhY2UgZGlyZWN0aW9uLiBUaGUgZGVmYXVsdCBjdWxsIG1vZGUgaXNcbiAgICAgKiB7QGxpbmsgQ1VMTEZBQ0VfQkFDS30uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY3VsbE1vZGUgLSBUaGUgY3VsbCBtb2RlIHRvIHNldC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfTk9ORX1cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9CQUNLfVxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX0ZST05UfVxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX0ZST05UQU5EQkFDS31cbiAgICAgKi9cbiAgICBzZXRDdWxsTW9kZShjdWxsTW9kZSkge1xuICAgICAgICBpZiAodGhpcy5jdWxsTW9kZSAhPT0gY3VsbE1vZGUpIHtcbiAgICAgICAgICAgIGlmIChjdWxsTW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLkNVTExfRkFDRSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1bGxNb2RlID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuQ1VMTF9GQUNFKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlID0gdGhpcy5nbEN1bGxbY3VsbE1vZGVdO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1bGxGYWNlICE9PSBtb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuY3VsbEZhY2UobW9kZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VsbEZhY2UgPSBtb2RlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VsbE1vZGUgPSBjdWxsTW9kZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGN1cnJlbnQgY3VsbCBtb2RlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGN1cnJlbnQgY3VsbCBtb2RlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRDdWxsTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VsbE1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgYWN0aXZlIHNoYWRlciB0byBiZSB1c2VkIGR1cmluZyBzdWJzZXF1ZW50IGRyYXcgY2FsbHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBzZXQgdG8gYXNzaWduIHRvIHRoZSBkZXZpY2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNoYWRlciB3YXMgc3VjY2Vzc2Z1bGx5IHNldCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHNldFNoYWRlcihzaGFkZXIpIHtcbiAgICAgICAgaWYgKHNoYWRlciAhPT0gdGhpcy5zaGFkZXIpIHtcbiAgICAgICAgICAgIGlmIChzaGFkZXIuZmFpbGVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghc2hhZGVyLnJlYWR5ICYmICFzaGFkZXIuaW1wbC5wb3N0TGluayh0aGlzLCBzaGFkZXIpKSB7XG4gICAgICAgICAgICAgICAgc2hhZGVyLmZhaWxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNoYWRlciA9IHNoYWRlcjtcblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBhY3RpdmUgc2hhZGVyXG4gICAgICAgICAgICB0aGlzLmdsLnVzZVByb2dyYW0oc2hhZGVyLmltcGwuZ2xQcm9ncmFtKTtcblxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgdGhpcy5fc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSsrO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlc0ludmFsaWRhdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHN1cHBvcnRlZCBIRFIgcGl4ZWwgZm9ybWF0LlxuICAgICAqIE5vdGUgdGhhdCBmb3IgV2ViR0wyLCBQSVhFTEZPUk1BVF9SR0IxNkYgYW5kIFBJWEVMRk9STUFUX1JHQjMyRiBhcmUgbm90IHJlbmRlcmFibGUgYWNjb3JkaW5nIHRvIHRoaXM6XG4gICAgICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0VYVF9jb2xvcl9idWZmZXJfZmxvYXRcbiAgICAgKiBGb3IgV2ViR0wxLCBvbmx5IFBJWEVMRk9STUFUX1JHQkExNkYgYW5kIFBJWEVMRk9STUFUX1JHQkEzMkYgYXJlIHRlc3RlZCBmb3IgYmVpbmcgcmVuZGVyYWJsZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBIRFIgcGl4ZWwgZm9ybWF0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRIZHJGb3JtYXQoKSB7XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlKSB7XG4gICAgICAgICAgICByZXR1cm4gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUpIHtcbiAgICAgICAgICAgIHJldHVybiBQSVhFTEZPUk1BVF9SR0JBMzJGO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBQSVhFTEZPUk1BVF9SOF9HOF9COF9BODtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyBtZW1vcnkgZnJvbSBhbGwgc2hhZGVycyBldmVyIGFsbG9jYXRlZCB3aXRoIHRoaXMgZGV2aWNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNsZWFyU2hhZGVyQ2FjaGUoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgZm9yIChjb25zdCBzaGFkZXJTcmMgaW4gdGhpcy5mcmFnbWVudFNoYWRlckNhY2hlKSB7XG4gICAgICAgICAgICBnbC5kZWxldGVTaGFkZXIodGhpcy5mcmFnbWVudFNoYWRlckNhY2hlW3NoYWRlclNyY10pO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuZnJhZ21lbnRTaGFkZXJDYWNoZVtzaGFkZXJTcmNdO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyU3JjIGluIHRoaXMudmVydGV4U2hhZGVyQ2FjaGUpIHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVNoYWRlcih0aGlzLnZlcnRleFNoYWRlckNhY2hlW3NoYWRlclNyY10pO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMudmVydGV4U2hhZGVyQ2FjaGVbc2hhZGVyU3JjXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucHJvZ3JhbUxpYi5jbGVhckNhY2hlKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgbWVtb3J5IGZyb20gYWxsIHZlcnRleCBhcnJheSBvYmplY3RzIGV2ZXIgYWxsb2NhdGVkIHdpdGggdGhpcyBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY2xlYXJWZXJ0ZXhBcnJheU9iamVjdENhY2hlKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIHRoaXMuX3Zhb01hcC5mb3JFYWNoKChpdGVtLCBrZXksIG1hcE9iaikgPT4ge1xuICAgICAgICAgICAgZ2wuZGVsZXRlVmVydGV4QXJyYXkoaXRlbSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX3Zhb01hcC5jbGVhcigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYSBzaGFkZXIgZnJvbSB0aGUgY2FjaGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byByZW1vdmUgZnJvbSB0aGUgY2FjaGUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbW92ZVNoYWRlckZyb21DYWNoZShzaGFkZXIpIHtcbiAgICAgICAgdGhpcy5wcm9ncmFtTGliLnJlbW92ZUZyb21DYWNoZShzaGFkZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdpZHRoIG9mIHRoZSBiYWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2wuZHJhd2luZ0J1ZmZlcldpZHRoIHx8IHRoaXMuY2FudmFzLndpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlaWdodCBvZiB0aGUgYmFjayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nbC5kcmF3aW5nQnVmZmVySGVpZ2h0IHx8IHRoaXMuY2FudmFzLmhlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdWxsc2NyZWVuIG1vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZnVsbHNjcmVlbihmdWxsc2NyZWVuKSB7XG4gICAgICAgIGlmIChmdWxsc2NyZWVuKSB7XG4gICAgICAgICAgICBjb25zdCBjYW52YXMgPSB0aGlzLmdsLmNhbnZhcztcbiAgICAgICAgICAgIGNhbnZhcy5yZXF1ZXN0RnVsbHNjcmVlbigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9jdW1lbnQuZXhpdEZ1bGxzY3JlZW4oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmdWxsc2NyZWVuKCkge1xuICAgICAgICByZXR1cm4gISFkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBoaWdoIHByZWNpc2lvbiBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBhcmUgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24gPSB0ZXN0VGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbih0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiB0ZXh0dXJlIHdpdGggaGFsZiBmbG9hdCBmb3JtYXQgY2FuIGJlIHVwZGF0ZWQgd2l0aCBkYXRhLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdGVzdFRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUodGhpcy5nbCwgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0LkhBTEZfRkxPQVRfT0VTKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdsR3JhcGhpY3NEZXZpY2UgfTtcbiJdLCJuYW1lcyI6WyJpbnZhbGlkYXRlQXR0YWNobWVudHMiLCJ0ZXN0UmVuZGVyYWJsZSIsImdsIiwicGl4ZWxGb3JtYXQiLCJyZXN1bHQiLCJ0ZXh0dXJlIiwiY3JlYXRlVGV4dHVyZSIsImJpbmRUZXh0dXJlIiwiVEVYVFVSRV8yRCIsInRleFBhcmFtZXRlcmkiLCJURVhUVVJFX01JTl9GSUxURVIiLCJORUFSRVNUIiwiVEVYVFVSRV9NQUdfRklMVEVSIiwiVEVYVFVSRV9XUkFQX1MiLCJDTEFNUF9UT19FREdFIiwiVEVYVFVSRV9XUkFQX1QiLCJ0ZXhJbWFnZTJEIiwiUkdCQSIsImZyYW1lYnVmZmVyIiwiY3JlYXRlRnJhbWVidWZmZXIiLCJiaW5kRnJhbWVidWZmZXIiLCJGUkFNRUJVRkZFUiIsImZyYW1lYnVmZmVyVGV4dHVyZTJEIiwiQ09MT1JfQVRUQUNITUVOVDAiLCJjaGVja0ZyYW1lYnVmZmVyU3RhdHVzIiwiRlJBTUVCVUZGRVJfQ09NUExFVEUiLCJkZWxldGVUZXh0dXJlIiwiZGVsZXRlRnJhbWVidWZmZXIiLCJ0ZXN0VGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImRhdGEiLCJVaW50MTZBcnJheSIsImdldEVycm9yIiwiTk9fRVJST1IiLCJjb25zb2xlIiwibG9nIiwidGVzdFRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iLCJkZXZpY2UiLCJ0ZXh0dXJlRmxvYXRSZW5kZXJhYmxlIiwidGVzdDEiLCJjcmVhdGVTaGFkZXJGcm9tQ29kZSIsInNoYWRlckNodW5rcyIsImZ1bGxzY3JlZW5RdWFkVlMiLCJwcmVjaXNpb25UZXN0UFMiLCJ0ZXN0MiIsInByZWNpc2lvblRlc3QyUFMiLCJ0ZXh0dXJlT3B0aW9ucyIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJ3aWR0aCIsImhlaWdodCIsIm1pcG1hcHMiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIm1hZ0ZpbHRlciIsIm5hbWUiLCJ0ZXgxIiwiVGV4dHVyZSIsInRhcmcxIiwiUmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJkZXB0aCIsImRyYXdRdWFkV2l0aFNoYWRlciIsIlBJWEVMRk9STUFUX1I4X0c4X0I4X0E4IiwidGV4MiIsInRhcmcyIiwiY29uc3RhbnRUZXhTb3VyY2UiLCJzZXRWYWx1ZSIsInByZXZGcmFtZWJ1ZmZlciIsImFjdGl2ZUZyYW1lYnVmZmVyIiwic2V0RnJhbWVidWZmZXIiLCJpbXBsIiwiX2dsRnJhbWVCdWZmZXIiLCJwaXhlbHMiLCJVaW50OEFycmF5IiwicmVhZFBpeGVscyIsIngiLCJ5IiwieiIsInciLCJmIiwiZGVzdHJveSIsInRlc3RJbWFnZUJpdG1hcCIsInBuZ0J5dGVzIiwiY3JlYXRlSW1hZ2VCaXRtYXAiLCJCbG9iIiwidHlwZSIsInByZW11bHRpcGx5QWxwaGEiLCJ0aGVuIiwiaW1hZ2UiLCJsZXZlbHMiLCJydCIsImluaXRSZW5kZXJUYXJnZXQiLCJVaW50OENsYW1wZWRBcnJheSIsIlVOU0lHTkVEX0JZVEUiLCJjYXRjaCIsImUiLCJXZWJnbEdyYXBoaWNzRGV2aWNlIiwiR3JhcGhpY3NEZXZpY2UiLCJjb25zdHJ1Y3RvciIsImNhbnZhcyIsIm9wdGlvbnMiLCJ3ZWJnbDIiLCJkZXZpY2VUeXBlIiwiREVWSUNFVFlQRV9XRUJHTCIsImRlZmF1bHRGcmFtZWJ1ZmZlciIsImRlZmF1bHRGcmFtZWJ1ZmZlckFscGhhIiwiYWxwaGEiLCJ1cGRhdGVDbGllbnRSZWN0IiwiY29udGV4dExvc3QiLCJfY29udGV4dExvc3RIYW5kbGVyIiwiZXZlbnQiLCJwcmV2ZW50RGVmYXVsdCIsImxvc2VDb250ZXh0IiwiRGVidWciLCJmaXJlIiwiX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIiLCJyZXN0b3JlQ29udGV4dCIsInN0ZW5jaWwiLCJwb3dlclByZWZlcmVuY2UiLCJ1YSIsIm5hdmlnYXRvciIsInVzZXJBZ2VudCIsImZvcmNlRGlzYWJsZU11bHRpc2FtcGxpbmciLCJpbmNsdWRlcyIsImFudGlhbGlhcyIsInByZWZlcldlYkdsMiIsInVuZGVmaW5lZCIsIm5hbWVzIiwiaSIsImxlbmd0aCIsImdldENvbnRleHQiLCJFcnJvciIsImlzQ2hyb21lIiwicGxhdGZvcm0iLCJicm93c2VyIiwid2luZG93IiwiY2hyb21lIiwiaXNNYWMiLCJhcHBWZXJzaW9uIiwiaW5kZXhPZiIsIl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kIiwic2FmYXJpIiwiX3RlbXBNYWNDaHJvbWVCbGl0RnJhbWVidWZmZXJXb3JrYXJvdW5kIiwic2V0dXBWZXJ0ZXhBcnJheU9iamVjdCIsImFkZEV2ZW50TGlzdGVuZXIiLCJpbml0aWFsaXplRXh0ZW5zaW9ucyIsImluaXRpYWxpemVDYXBhYmlsaXRpZXMiLCJpbml0aWFsaXplUmVuZGVyU3RhdGUiLCJpbml0aWFsaXplQ29udGV4dENhY2hlcyIsInN1cHBvcnRzSW1hZ2VCaXRtYXAiLCJJbWFnZUJpdG1hcCIsImRlZmF1bHRDbGVhck9wdGlvbnMiLCJjb2xvciIsImZsYWdzIiwiQ0xFQVJGTEFHX0NPTE9SIiwiQ0xFQVJGTEFHX0RFUFRIIiwiZ2xBZGRyZXNzIiwiUkVQRUFUIiwiTUlSUk9SRURfUkVQRUFUIiwiZ2xCbGVuZEVxdWF0aW9uIiwiRlVOQ19BREQiLCJGVU5DX1NVQlRSQUNUIiwiRlVOQ19SRVZFUlNFX1NVQlRSQUNUIiwiTUlOIiwiZXh0QmxlbmRNaW5tYXgiLCJNSU5fRVhUIiwiTUFYIiwiTUFYX0VYVCIsImdsQmxlbmRGdW5jdGlvbiIsIlpFUk8iLCJPTkUiLCJTUkNfQ09MT1IiLCJPTkVfTUlOVVNfU1JDX0NPTE9SIiwiRFNUX0NPTE9SIiwiT05FX01JTlVTX0RTVF9DT0xPUiIsIlNSQ19BTFBIQSIsIlNSQ19BTFBIQV9TQVRVUkFURSIsIk9ORV9NSU5VU19TUkNfQUxQSEEiLCJEU1RfQUxQSEEiLCJPTkVfTUlOVVNfRFNUX0FMUEhBIiwiQ09OU1RBTlRfQ09MT1IiLCJPTkVfTUlOVVNfQ09OU1RBTlRfQ09MT1IiLCJDT05TVEFOVF9BTFBIQSIsIk9ORV9NSU5VU19DT05TVEFOVF9BTFBIQSIsImdsQ29tcGFyaXNvbiIsIk5FVkVSIiwiTEVTUyIsIkVRVUFMIiwiTEVRVUFMIiwiR1JFQVRFUiIsIk5PVEVRVUFMIiwiR0VRVUFMIiwiQUxXQVlTIiwiZ2xTdGVuY2lsT3AiLCJLRUVQIiwiUkVQTEFDRSIsIklOQ1IiLCJJTkNSX1dSQVAiLCJERUNSIiwiREVDUl9XUkFQIiwiSU5WRVJUIiwiZ2xDbGVhckZsYWciLCJDT0xPUl9CVUZGRVJfQklUIiwiREVQVEhfQlVGRkVSX0JJVCIsIlNURU5DSUxfQlVGRkVSX0JJVCIsImdsQ3VsbCIsIkJBQ0siLCJGUk9OVCIsIkZST05UX0FORF9CQUNLIiwiZ2xGaWx0ZXIiLCJMSU5FQVIiLCJORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiTElORUFSX01JUE1BUF9ORUFSRVNUIiwiTElORUFSX01JUE1BUF9MSU5FQVIiLCJnbFByaW1pdGl2ZSIsIlBPSU5UUyIsIkxJTkVTIiwiTElORV9MT09QIiwiTElORV9TVFJJUCIsIlRSSUFOR0xFUyIsIlRSSUFOR0xFX1NUUklQIiwiVFJJQU5HTEVfRkFOIiwiZ2xUeXBlIiwiQllURSIsIlNIT1JUIiwiVU5TSUdORURfU0hPUlQiLCJJTlQiLCJVTlNJR05FRF9JTlQiLCJGTE9BVCIsInBjVW5pZm9ybVR5cGUiLCJCT09MIiwiVU5JRk9STVRZUEVfQk9PTCIsIlVOSUZPUk1UWVBFX0lOVCIsIlVOSUZPUk1UWVBFX0ZMT0FUIiwiRkxPQVRfVkVDMiIsIlVOSUZPUk1UWVBFX1ZFQzIiLCJGTE9BVF9WRUMzIiwiVU5JRk9STVRZUEVfVkVDMyIsIkZMT0FUX1ZFQzQiLCJVTklGT1JNVFlQRV9WRUM0IiwiSU5UX1ZFQzIiLCJVTklGT1JNVFlQRV9JVkVDMiIsIklOVF9WRUMzIiwiVU5JRk9STVRZUEVfSVZFQzMiLCJJTlRfVkVDNCIsIlVOSUZPUk1UWVBFX0lWRUM0IiwiQk9PTF9WRUMyIiwiVU5JRk9STVRZUEVfQlZFQzIiLCJCT09MX1ZFQzMiLCJVTklGT1JNVFlQRV9CVkVDMyIsIkJPT0xfVkVDNCIsIlVOSUZPUk1UWVBFX0JWRUM0IiwiRkxPQVRfTUFUMiIsIlVOSUZPUk1UWVBFX01BVDIiLCJGTE9BVF9NQVQzIiwiVU5JRk9STVRZUEVfTUFUMyIsIkZMT0FUX01BVDQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiU0FNUExFUl8yRCIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRCIsIlNBTVBMRVJfQ1VCRSIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFIiwiU0FNUExFUl8yRF9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XIiwiU0FNUExFUl9DVUJFX1NIQURPVyIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVyIsIlNBTVBMRVJfM0QiLCJVTklGT1JNVFlQRV9URVhUVVJFM0QiLCJ0YXJnZXRUb1Nsb3QiLCJURVhUVVJFX0NVQkVfTUFQIiwiVEVYVFVSRV8zRCIsInNjb3BlWCIsInNjb3BlWSIsInNjb3BlWiIsInNjb3BlVyIsInVuaWZvcm1WYWx1ZSIsImNvbW1pdEZ1bmN0aW9uIiwidW5pZm9ybSIsInZhbHVlIiwidW5pZm9ybTFpIiwibG9jYXRpb25JZCIsInVuaWZvcm0xZiIsInVuaWZvcm0yZnYiLCJ1bmlmb3JtM2Z2IiwidW5pZm9ybTRmdiIsInVuaWZvcm0yaXYiLCJ1bmlmb3JtM2l2IiwidW5pZm9ybTRpdiIsInVuaWZvcm1NYXRyaXgyZnYiLCJ1bmlmb3JtTWF0cml4M2Z2IiwidW5pZm9ybU1hdHJpeDRmdiIsIlVOSUZPUk1UWVBFX0ZMT0FUQVJSQVkiLCJ1bmlmb3JtMWZ2IiwiVU5JRk9STVRZUEVfVkVDMkFSUkFZIiwiVU5JRk9STVRZUEVfVkVDM0FSUkFZIiwiVU5JRk9STVRZUEVfVkVDNEFSUkFZIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJleHRUZXh0dXJlRmxvYXQiLCJtYXhWZXJ0ZXhUZXh0dXJlcyIsIm51bVVuaWZvcm1zIiwidmVydGV4VW5pZm9ybXNDb3VudCIsImJvbmVMaW1pdCIsIk1hdGgiLCJmbG9vciIsIm1pbiIsInVubWFza2VkUmVuZGVyZXIiLCJzY29wZSIsInJlc29sdmUiLCJleHRDb2xvckJ1ZmZlckZsb2F0IiwiZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsImV4dFRleHR1cmVIYWxmRmxvYXQiLCJIQUxGX0ZMT0FUX09FUyIsInN1cHBvcnRzTW9ycGhUYXJnZXRUZXh0dXJlc0NvcmUiLCJtYXhQcmVjaXNpb24iLCJfdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiIsIl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlIiwiX3NwZWN0b3JNYXJrZXJzIiwiX3NwZWN0b3JDdXJyZW50TWFya2VyIiwiYXJlYUxpZ2h0THV0Rm9ybWF0IiwidGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIiLCJQSVhFTEZPUk1BVF9SR0JBMTZGIiwiZXh0VGV4dHVyZUZsb2F0TGluZWFyIiwiZmVlZGJhY2siLCJkZWxldGVUcmFuc2Zvcm1GZWVkYmFjayIsImNsZWFyU2hhZGVyQ2FjaGUiLCJjbGVhclZlcnRleEFycmF5T2JqZWN0Q2FjaGUiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwicG9zdERlc3Ryb3kiLCJjcmVhdGVWZXJ0ZXhCdWZmZXJJbXBsIiwidmVydGV4QnVmZmVyIiwiV2ViZ2xWZXJ0ZXhCdWZmZXIiLCJjcmVhdGVJbmRleEJ1ZmZlckltcGwiLCJpbmRleEJ1ZmZlciIsIldlYmdsSW5kZXhCdWZmZXIiLCJjcmVhdGVTaGFkZXJJbXBsIiwic2hhZGVyIiwiV2ViZ2xTaGFkZXIiLCJjcmVhdGVUZXh0dXJlSW1wbCIsIldlYmdsVGV4dHVyZSIsImNyZWF0ZVJlbmRlclRhcmdldEltcGwiLCJyZW5kZXJUYXJnZXQiLCJXZWJnbFJlbmRlclRhcmdldCIsInVwZGF0ZU1hcmtlciIsImpvaW4iLCJwdXNoTWFya2VyIiwic3BlY3RvciIsInB1c2giLCJzZXRNYXJrZXIiLCJwb3BNYXJrZXIiLCJwb3AiLCJjbGVhck1hcmtlciIsImdldFByZWNpc2lvbiIsInByZWNpc2lvbiIsImdldFNoYWRlclByZWNpc2lvbkZvcm1hdCIsInZlcnRleFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQiLCJWRVJURVhfU0hBREVSIiwiSElHSF9GTE9BVCIsInZlcnRleFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCIsIk1FRElVTV9GTE9BVCIsImZyYWdtZW50U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdCIsIkZSQUdNRU5UX1NIQURFUiIsImZyYWdtZW50U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0IiwiaGlnaHBBdmFpbGFibGUiLCJtZWRpdW1wQXZhaWxhYmxlIiwid2FybiIsInN1cHBvcnRlZEV4dGVuc2lvbnMiLCJnZXRTdXBwb3J0ZWRFeHRlbnNpb25zIiwiZ2V0RXh0ZW5zaW9uIiwiYXJndW1lbnRzIiwiZXh0RHJhd0J1ZmZlcnMiLCJleHRJbnN0YW5jaW5nIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsImV4dFRleHR1cmVMb2QiLCJleHRVaW50RWxlbWVudCIsImV4dFZlcnRleEFycmF5T2JqZWN0IiwiZXh0RGlzam9pbnRUaW1lclF1ZXJ5IiwiZXh0RGVwdGhUZXh0dXJlIiwiZXh0IiwiZHJhd0FycmF5c0luc3RhbmNlZCIsImRyYXdBcnJheXNJbnN0YW5jZWRBTkdMRSIsImJpbmQiLCJkcmF3RWxlbWVudHNJbnN0YW5jZWQiLCJkcmF3RWxlbWVudHNJbnN0YW5jZWRBTkdMRSIsInZlcnRleEF0dHJpYkRpdmlzb3IiLCJ2ZXJ0ZXhBdHRyaWJEaXZpc29yQU5HTEUiLCJjcmVhdGVWZXJ0ZXhBcnJheSIsImNyZWF0ZVZlcnRleEFycmF5T0VTIiwiZGVsZXRlVmVydGV4QXJyYXkiLCJkZWxldGVWZXJ0ZXhBcnJheU9FUyIsImlzVmVydGV4QXJyYXkiLCJpc1ZlcnRleEFycmF5T0VTIiwiYmluZFZlcnRleEFycmF5IiwiYmluZFZlcnRleEFycmF5T0VTIiwiZXh0RGVidWdSZW5kZXJlckluZm8iLCJleHRGbG9hdEJsZW5kIiwiZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFTVEMiLCJleHRQYXJhbGxlbFNoYWRlckNvbXBpbGUiLCJjb250ZXh0QXR0cmlicyIsImdldENvbnRleHRBdHRyaWJ1dGVzIiwic3VwcG9ydHNNc2FhIiwic3VwcG9ydHNTdGVuY2lsIiwic3VwcG9ydHNJbnN0YW5jaW5nIiwibWF4VGV4dHVyZVNpemUiLCJnZXRQYXJhbWV0ZXIiLCJNQVhfVEVYVFVSRV9TSVpFIiwibWF4Q3ViZU1hcFNpemUiLCJNQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFIiwibWF4UmVuZGVyQnVmZmVyU2l6ZSIsIk1BWF9SRU5ERVJCVUZGRVJfU0laRSIsIm1heFRleHR1cmVzIiwiTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJtYXhDb21iaW5lZFRleHR1cmVzIiwiTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJNQVhfVkVSVEVYX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJNQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyIsImZyYWdtZW50VW5pZm9ybXNDb3VudCIsIk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMiLCJtYXhEcmF3QnVmZmVycyIsIk1BWF9EUkFXX0JVRkZFUlMiLCJtYXhDb2xvckF0dGFjaG1lbnRzIiwiTUFYX0NPTE9SX0FUVEFDSE1FTlRTIiwibWF4Vm9sdW1lU2l6ZSIsIk1BWF8zRF9URVhUVVJFX1NJWkUiLCJNQVhfRFJBV19CVUZGRVJTX0VYVCIsIk1BWF9DT0xPUl9BVFRBQ0hNRU5UU19FWFQiLCJVTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCIsInVubWFza2VkVmVuZG9yIiwiVU5NQVNLRURfVkVORE9SX1dFQkdMIiwic2Ftc3VuZ01vZGVsUmVnZXgiLCJzdXBwb3J0c0dwdVBhcnRpY2xlcyIsIm1hdGNoIiwibWF4QW5pc290cm9weSIsIk1BWF9URVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCIsInNhbXBsZXMiLCJTQU1QTEVTIiwibWF4U2FtcGxlcyIsIk1BWF9TQU1QTEVTIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwiYW5kcm9pZCIsImJsZW5kaW5nIiwiZGlzYWJsZSIsIkJMRU5EIiwiYmxlbmRTcmMiLCJCTEVORE1PREVfT05FIiwiYmxlbmREc3QiLCJCTEVORE1PREVfWkVSTyIsImJsZW5kU3JjQWxwaGEiLCJibGVuZERzdEFscGhhIiwic2VwYXJhdGVBbHBoYUJsZW5kIiwiYmxlbmRFcXVhdGlvbiIsIkJMRU5ERVFVQVRJT05fQUREIiwiYmxlbmRBbHBoYUVxdWF0aW9uIiwic2VwYXJhdGVBbHBoYUVxdWF0aW9uIiwiYmxlbmRGdW5jIiwiYmxlbmRDb2xvciIsIkNvbG9yIiwid3JpdGVSZWQiLCJ3cml0ZUdyZWVuIiwid3JpdGVCbHVlIiwid3JpdGVBbHBoYSIsImNvbG9yTWFzayIsImN1bGxNb2RlIiwiQ1VMTEZBQ0VfQkFDSyIsImVuYWJsZSIsIkNVTExfRkFDRSIsImN1bGxGYWNlIiwiZGVwdGhUZXN0IiwiREVQVEhfVEVTVCIsImRlcHRoRnVuYyIsIkZVTkNfTEVTU0VRVUFMIiwiZGVwdGhXcml0ZSIsImRlcHRoTWFzayIsIlNURU5DSUxfVEVTVCIsInN0ZW5jaWxGdW5jRnJvbnQiLCJzdGVuY2lsRnVuY0JhY2siLCJGVU5DX0FMV0FZUyIsInN0ZW5jaWxSZWZGcm9udCIsInN0ZW5jaWxSZWZCYWNrIiwic3RlbmNpbE1hc2tGcm9udCIsInN0ZW5jaWxNYXNrQmFjayIsInN0ZW5jaWxGdW5jIiwic3RlbmNpbEZhaWxGcm9udCIsInN0ZW5jaWxGYWlsQmFjayIsIlNURU5DSUxPUF9LRUVQIiwic3RlbmNpbFpmYWlsRnJvbnQiLCJzdGVuY2lsWmZhaWxCYWNrIiwic3RlbmNpbFpwYXNzRnJvbnQiLCJzdGVuY2lsWnBhc3NCYWNrIiwic3RlbmNpbFdyaXRlTWFza0Zyb250Iiwic3RlbmNpbFdyaXRlTWFza0JhY2siLCJzdGVuY2lsT3AiLCJzdGVuY2lsTWFzayIsImFscGhhVG9Db3ZlcmFnZSIsInJhc3RlciIsIlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSIsIlJBU1RFUklaRVJfRElTQ0FSRCIsImRlcHRoQmlhc0VuYWJsZWQiLCJQT0xZR09OX09GRlNFVF9GSUxMIiwiY2xlYXJEZXB0aCIsImNsZWFyQ29sb3IiLCJjbGVhclN0ZW5jaWwiLCJ2eCIsInZ5IiwidnciLCJ2aCIsInN4Iiwic3kiLCJzdyIsInNoIiwiaGludCIsIkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlQiLCJOSUNFU1QiLCJGUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5UX09FUyIsIlNDSVNTT1JfVEVTVCIsInBpeGVsU3RvcmVpIiwiVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTl9XRUJHTCIsIk5PTkUiLCJ1bnBhY2tGbGlwWSIsIlVOUEFDS19GTElQX1lfV0VCR0wiLCJ1bnBhY2tQcmVtdWx0aXBseUFscGhhIiwiVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMIiwiVU5QQUNLX0FMSUdOTUVOVCIsInZlcnRleFNoYWRlckNhY2hlIiwiZnJhZ21lbnRTaGFkZXJDYWNoZSIsIl92YW9NYXAiLCJNYXAiLCJib3VuZFZhbyIsInRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyIiwidGV4dHVyZVVuaXQiLCJ0ZXh0dXJlVW5pdHMiLCJzaGFkZXJzIiwidGV4dHVyZXMiLCJidWZmZXIiLCJidWZmZXJzIiwidGFyZ2V0IiwidGFyZ2V0cyIsInVubG9jayIsInNldFZpZXdwb3J0IiwiaCIsInZpZXdwb3J0Iiwic2V0U2Npc3NvciIsInNjaXNzb3IiLCJmYiIsImNvcHlSZW5kZXJUYXJnZXQiLCJzb3VyY2UiLCJkZXN0IiwiZXJyb3IiLCJfY29sb3JCdWZmZXIiLCJfZm9ybWF0IiwiX2RlcHRoIiwiX2RlcHRoQnVmZmVyIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJwcmV2UnQiLCJ1cGRhdGVCZWdpbiIsIlJFQURfRlJBTUVCVUZGRVIiLCJEUkFXX0ZSQU1FQlVGRkVSIiwiYmxpdEZyYW1lYnVmZmVyIiwiZ2V0Q29weVNoYWRlciIsInBvcEdwdU1hcmtlciIsIl9jb3B5U2hhZGVyIiwidnMiLCJmcyIsIm91dHB1dFRleDJEUFMiLCJzdGFydFBhc3MiLCJyZW5kZXJQYXNzIiwic2V0UmVuZGVyVGFyZ2V0IiwiY29sb3JPcHMiLCJkZXB0aFN0ZW5jaWxPcHMiLCJjbGVhciIsImNsZWFyRmxhZ3MiLCJjbGVhck9wdGlvbnMiLCJjbGVhclZhbHVlIiwiciIsImciLCJiIiwiYSIsImNsZWFyRGVwdGhWYWx1ZSIsIkNMRUFSRkxBR19TVEVOQ0lMIiwiY2xlYXJTdGVuY2lsVmFsdWUiLCJhc3NlcnQiLCJpbnNpZGVSZW5kZXJQYXNzIiwiZW5kUGFzcyIsInVuYmluZFZlcnRleEFycmF5Iiwic3RvcmUiLCJzdG9yZURlcHRoIiwiREVQVEhfQVRUQUNITUVOVCIsInN0b3JlU3RlbmNpbCIsIlNURU5DSUxfQVRUQUNITUVOVCIsImZ1bGxTaXplQ2xlYXJSZWN0IiwiaW52YWxpZGF0ZUZyYW1lYnVmZmVyIiwiYXV0b1Jlc29sdmUiLCJfZ2xUZXh0dXJlIiwicG90IiwiYWN0aXZlVGV4dHVyZSIsImdlbmVyYXRlTWlwbWFwIiwiX2dsVGFyZ2V0IiwidW5pdCIsInNsb3QiLCJpbml0aWFsaXplZCIsInVwZGF0ZUVuZCIsIl9zYW1wbGVzIiwic2V0VW5wYWNrRmxpcFkiLCJmbGlwWSIsInNldFVucGFja1ByZW11bHRpcGx5QWxwaGEiLCJURVhUVVJFMCIsInRleHR1cmVUYXJnZXQiLCJ0ZXh0dXJlT2JqZWN0IiwiYmluZFRleHR1cmVPblVuaXQiLCJzZXRUZXh0dXJlUGFyYW1ldGVycyIsIl9wYXJhbWV0ZXJGbGFncyIsImZpbHRlciIsIl9taW5GaWx0ZXIiLCJfbWlwbWFwcyIsIl9jb21wcmVzc2VkIiwiX2xldmVscyIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSIiwiX21hZ0ZpbHRlciIsIl9hZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIl9hZGRyZXNzViIsIlRFWFRVUkVfV1JBUF9SIiwiX2FkZHJlc3NXIiwiVEVYVFVSRV9DT01QQVJFX01PREUiLCJfY29tcGFyZU9uUmVhZCIsIkNPTVBBUkVfUkVGX1RPX1RFWFRVUkUiLCJURVhUVVJFX0NPTVBBUkVfRlVOQyIsIl9jb21wYXJlRnVuYyIsInRleFBhcmFtZXRlcmYiLCJURVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCIsIm1heCIsInJvdW5kIiwiX2FuaXNvdHJvcHkiLCJzZXRUZXh0dXJlIiwiaW5pdGlhbGl6ZSIsIl9uZWVkc1VwbG9hZCIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJ1cGxvYWQiLCJ2ZXJ0ZXhCdWZmZXJzIiwia2V5IiwidmFvIiwidXNlQ2FjaGUiLCJpZCIsInJlbmRlcmluZ2luZ0hhc2giLCJnZXQiLCJiaW5kQnVmZmVyIiwiRUxFTUVOVF9BUlJBWV9CVUZGRVIiLCJsb2NaZXJvIiwiQVJSQVlfQlVGRkVSIiwiYnVmZmVySWQiLCJlbGVtZW50cyIsImoiLCJsb2MiLCJzZW1hbnRpY1RvTG9jYXRpb24iLCJ2ZXJ0ZXhBdHRyaWJQb2ludGVyIiwibnVtQ29tcG9uZW50cyIsImRhdGFUeXBlIiwibm9ybWFsaXplIiwic3RyaWRlIiwib2Zmc2V0IiwiZW5hYmxlVmVydGV4QXR0cmliQXJyYXkiLCJpbnN0YW5jaW5nIiwic2V0Iiwic2V0QnVmZmVycyIsImRyYXciLCJwcmltaXRpdmUiLCJudW1JbnN0YW5jZXMiLCJrZWVwQnVmZmVycyIsInNhbXBsZXIiLCJzYW1wbGVyVmFsdWUiLCJudW1UZXh0dXJlcyIsInNjb3BlSWQiLCJ1bmlmb3JtVmVyc2lvbiIsInByb2dyYW1WZXJzaW9uIiwic2FtcGxlcnMiLCJ1bmlmb3JtcyIsImxlbiIsInNhbXBsZXJOYW1lIiwid2Fybk9uY2UiLCJkZXB0aEJ1ZmZlciIsImFycmF5IiwidW5pZm9ybTFpdiIsInZlcnNpb24iLCJ2ZXJzaW9uT2JqZWN0IiwiZ2xvYmFsSWQiLCJyZXZpc2lvbiIsImJpbmRCdWZmZXJCYXNlIiwiVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiIsImJlZ2luVHJhbnNmb3JtRmVlZGJhY2siLCJtb2RlIiwiY291bnQiLCJpbmRleGVkIiwiZ2xGb3JtYXQiLCJiYXNlIiwiYnl0ZXNQZXJJbmRleCIsImRyYXdFbGVtZW50cyIsImZpcnN0IiwiZHJhd0FycmF5cyIsImVuZFRyYW5zZm9ybUZlZWRiYWNrIiwiX2RyYXdDYWxsc1BlckZyYW1lIiwiX3ByaW1zUGVyRnJhbWUiLCJkZWZhdWx0T3B0aW9ucyIsInNldENsZWFyQ29sb3IiLCJzZXRDb2xvcldyaXRlIiwic2V0Q2xlYXJEZXB0aCIsInNldERlcHRoV3JpdGUiLCJzZXRDbGVhclN0ZW5jaWwiLCJjIiwiZ2V0RGVwdGhUZXN0Iiwic2V0RGVwdGhUZXN0Iiwic2V0RGVwdGhGdW5jIiwiZnVuYyIsImdldERlcHRoV3JpdGUiLCJ3cml0ZURlcHRoIiwic2V0QWxwaGFUb0NvdmVyYWdlIiwic3RhdGUiLCJzZXRUcmFuc2Zvcm1GZWVkYmFja0J1ZmZlciIsInRmIiwiY3JlYXRlVHJhbnNmb3JtRmVlZGJhY2siLCJiaW5kVHJhbnNmb3JtRmVlZGJhY2siLCJUUkFOU0ZPUk1fRkVFREJBQ0siLCJzZXRSYXN0ZXIiLCJvbiIsInNldERlcHRoQmlhcyIsInNldERlcHRoQmlhc1ZhbHVlcyIsImNvbnN0QmlhcyIsInNsb3BlQmlhcyIsInBvbHlnb25PZmZzZXQiLCJnZXRCbGVuZGluZyIsInNldEJsZW5kaW5nIiwic2V0U3RlbmNpbFRlc3QiLCJzZXRTdGVuY2lsRnVuYyIsInJlZiIsIm1hc2siLCJzZXRTdGVuY2lsRnVuY0Zyb250Iiwic3RlbmNpbEZ1bmNTZXBhcmF0ZSIsInNldFN0ZW5jaWxGdW5jQmFjayIsInNldFN0ZW5jaWxPcGVyYXRpb24iLCJmYWlsIiwiemZhaWwiLCJ6cGFzcyIsIndyaXRlTWFzayIsInNldFN0ZW5jaWxPcGVyYXRpb25Gcm9udCIsInN0ZW5jaWxPcFNlcGFyYXRlIiwic3RlbmNpbE1hc2tTZXBhcmF0ZSIsInNldFN0ZW5jaWxPcGVyYXRpb25CYWNrIiwic2V0QmxlbmRGdW5jdGlvbiIsInNldEJsZW5kRnVuY3Rpb25TZXBhcmF0ZSIsImJsZW5kRnVuY1NlcGFyYXRlIiwic2V0QmxlbmRFcXVhdGlvbiIsInNldEJsZW5kRXF1YXRpb25TZXBhcmF0ZSIsImJsZW5kRXF1YXRpb25TZXBhcmF0ZSIsInNldEJsZW5kQ29sb3IiLCJzZXRDdWxsTW9kZSIsIkNVTExGQUNFX05PTkUiLCJnZXRDdWxsTW9kZSIsInNldFNoYWRlciIsImZhaWxlZCIsInJlYWR5IiwicG9zdExpbmsiLCJ1c2VQcm9ncmFtIiwiZ2xQcm9ncmFtIiwiX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUiLCJhdHRyaWJ1dGVzSW52YWxpZGF0ZWQiLCJnZXRIZHJGb3JtYXQiLCJzaGFkZXJTcmMiLCJkZWxldGVTaGFkZXIiLCJwcm9ncmFtTGliIiwiY2xlYXJDYWNoZSIsImZvckVhY2giLCJpdGVtIiwibWFwT2JqIiwicmVtb3ZlU2hhZGVyRnJvbUNhY2hlIiwicmVtb3ZlRnJvbUNhY2hlIiwiZHJhd2luZ0J1ZmZlcldpZHRoIiwiZHJhd2luZ0J1ZmZlckhlaWdodCIsImZ1bGxzY3JlZW4iLCJyZXF1ZXN0RnVsbHNjcmVlbiIsImRvY3VtZW50IiwiZXhpdEZ1bGxzY3JlZW4iLCJmdWxsc2NyZWVuRWxlbWVudCIsInRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNENBLE1BQU1BLHFCQUFxQixHQUFHLEVBQTlCLENBQUE7O0FBRUEsU0FBU0MsY0FBVCxDQUF3QkMsRUFBeEIsRUFBNEJDLFdBQTVCLEVBQXlDO0VBQ3JDLElBQUlDLE1BQU0sR0FBRyxJQUFiLENBQUE7QUFHQSxFQUFBLE1BQU1DLE9BQU8sR0FBR0gsRUFBRSxDQUFDSSxhQUFILEVBQWhCLENBQUE7QUFDQUosRUFBQUEsRUFBRSxDQUFDSyxXQUFILENBQWVMLEVBQUUsQ0FBQ00sVUFBbEIsRUFBOEJILE9BQTlCLENBQUEsQ0FBQTtBQUNBSCxFQUFBQSxFQUFFLENBQUNPLGFBQUgsQ0FBaUJQLEVBQUUsQ0FBQ00sVUFBcEIsRUFBZ0NOLEVBQUUsQ0FBQ1Esa0JBQW5DLEVBQXVEUixFQUFFLENBQUNTLE9BQTFELENBQUEsQ0FBQTtBQUNBVCxFQUFBQSxFQUFFLENBQUNPLGFBQUgsQ0FBaUJQLEVBQUUsQ0FBQ00sVUFBcEIsRUFBZ0NOLEVBQUUsQ0FBQ1Usa0JBQW5DLEVBQXVEVixFQUFFLENBQUNTLE9BQTFELENBQUEsQ0FBQTtBQUNBVCxFQUFBQSxFQUFFLENBQUNPLGFBQUgsQ0FBaUJQLEVBQUUsQ0FBQ00sVUFBcEIsRUFBZ0NOLEVBQUUsQ0FBQ1csY0FBbkMsRUFBbURYLEVBQUUsQ0FBQ1ksYUFBdEQsQ0FBQSxDQUFBO0FBQ0FaLEVBQUFBLEVBQUUsQ0FBQ08sYUFBSCxDQUFpQlAsRUFBRSxDQUFDTSxVQUFwQixFQUFnQ04sRUFBRSxDQUFDYSxjQUFuQyxFQUFtRGIsRUFBRSxDQUFDWSxhQUF0RCxDQUFB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
