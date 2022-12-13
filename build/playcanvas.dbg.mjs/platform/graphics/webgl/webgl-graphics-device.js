/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { setupVertexArrayObject } from '../../../polyfill/OESVertexArrayObject.js';
import { Debug } from '../../../core/debug.js';
import { platform } from '../../../core/platform.js';
import { Color } from '../../../core/math/color.js';
import { DEVICETYPE_WEBGL, PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, BLENDMODE_ONE, BLENDMODE_ZERO, BLENDEQUATION_ADD, CULLFACE_BACK, FUNC_LESSEQUAL, FUNC_ALWAYS, STENCILOP_KEEP, ADDRESS_CLAMP_TO_EDGE, semanticToLocation, CLEARFLAG_STENCIL, CULLFACE_NONE, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { drawQuadWithShader } from '../simple-post-effect.js';
import { RenderTarget } from '../render-target.js';
import { Texture } from '../texture.js';
import { DebugGraphics } from '../debug-graphics.js';
import { WebglVertexBuffer } from './webgl-vertex-buffer.js';
import { WebglIndexBuffer } from './webgl-index-buffer.js';
import { WebglShader } from './webgl-shader.js';
import { WebglTexture } from './webgl-texture.js';
import { WebglRenderTarget } from './webgl-render-target.js';
import { ShaderUtils } from '../shader-utils.js';
import { Shader } from '../shader.js';

const invalidateAttachments = [];
const _fullScreenQuadVS = `
attribute vec2 vertex_position;
varying vec2 vUv0;
void main(void)
{
    gl_Position = vec4(vertex_position, 0.5, 1.0);
    vUv0 = vertex_position.xy*0.5+0.5;
}
`;
const _precisionTest1PS = `
void main(void) { 
    gl_FragColor = vec4(2147483648.0);
}
`;
const _precisionTest2PS = `
uniform sampler2D source;
vec4 packFloat(float depth) {
    const vec4 bit_shift = vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
    const vec4 bit_mask  = vec4(0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0);
    vec4 res = mod(depth * bit_shift * vec4(255), vec4(256) ) / vec4(255);
    res -= res.xxyz * bit_mask;
    return res;
}
void main(void) {
    float c = texture2D(source, vec2(0.0)).r;
    float diff = abs(c - 2147483648.0) / 2147483648.0;
    gl_FragColor = packFloat(diff);
}
`;
const _outputTexture2D = `
varying vec2 vUv0;
uniform sampler2D source;
void main(void) {
    gl_FragColor = texture2D(source, vUv0);
}
`;
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
  const shader1 = new Shader(device, ShaderUtils.createDefinition(device, {
    name: 'ptest1',
    vertexCode: _fullScreenQuadVS,
    fragmentCode: _precisionTest1PS
  }));
  const shader2 = new Shader(device, ShaderUtils.createDefinition(device, {
    name: 'ptest2',
    vertexCode: _fullScreenQuadVS,
    fragmentCode: _precisionTest2PS
  }));
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
  drawQuadWithShader(device, targ1, shader1);
  textureOptions.format = PIXELFORMAT_RGBA8;
  const tex2 = new Texture(device, textureOptions);
  const targ2 = new RenderTarget({
    colorBuffer: tex2,
    depth: false
  });
  device.constantTexSource.setValue(tex1);
  drawQuadWithShader(device, targ2, shader2);
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
  shader1.destroy();
  shader2.destroy();
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
      format: PIXELFORMAT_RGBA8,
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
    this.gl = gl;
    if (!gl) {
      throw new Error("WebGL not supported");
    }

    const alphaBits = gl.getParameter(gl.ALPHA_BITS);
    this.framebufferFormat = alphaBits ? PIXELFORMAT_RGBA8 : PIXELFORMAT_RGB8;
    const isChrome = platform.browser && !!window.chrome;
    const isMac = platform.browser && navigator.appVersion.indexOf("Mac") !== -1;

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

    this.areaLightLutFormat = PIXELFORMAT_RGBA8;
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

    this.supportsTextureFetch = this.webgl2;

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
      this._copyShader = new Shader(this, ShaderUtils.createDefinition(this, {
        name: 'outputTex2D',
        vertexCode: _fullScreenQuadVS,
        fragmentCode: _outputTexture2D
      }));
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
          if (vertexBuffer.format.instancing) {
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

  getHdrFormat(preferLargest, renderable, updatable, filterable) {
    const f16Valid = this.extTextureHalfFloat && (!renderable || this.textureHalfFloatRenderable) && (!updatable || this.textureHalfFloatUpdatable) && (!filterable || this.extTextureHalfFloatLinear);
    const f32Valid = this.extTextureFloat && (!renderable || this.textureFloatRenderable) && (!filterable || this.extTextureFloatLinear);
    if (f16Valid && f32Valid) {
      return preferLargest ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA16F;
    } else if (f16Valid) {
      return PIXELFORMAT_RGBA16F;
    } else if (f32Valid) {
      return PIXELFORMAT_RGBA32F;
    }
    return null;
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
  }

  clearVertexArrayObjectCache() {
    const gl = this.gl;
    this._vaoMap.forEach((item, key, mapObj) => {
      gl.deleteVertexArray(item);
    });
    this._vaoMap.clear();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNldHVwVmVydGV4QXJyYXlPYmplY3QgfSBmcm9tICcuLi8uLi8uLi9wb2x5ZmlsbC9PRVNWZXJ0ZXhBcnJheU9iamVjdC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHtcbiAgICBERVZJQ0VUWVBFX1dFQkdMLFxuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBCTEVOREVRVUFUSU9OX0FERCxcbiAgICBCTEVORE1PREVfWkVSTywgQkxFTkRNT0RFX09ORSxcbiAgICBDTEVBUkZMQUdfQ09MT1IsIENMRUFSRkxBR19ERVBUSCwgQ0xFQVJGTEFHX1NURU5DSUwsXG4gICAgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfTk9ORSxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIEZVTkNfQUxXQVlTLCBGVU5DX0xFU1NFUVVBTCxcbiAgICBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBTVEVOQ0lMT1BfS0VFUCxcbiAgICBVTklGT1JNVFlQRV9CT09MLCBVTklGT1JNVFlQRV9JTlQsIFVOSUZPUk1UWVBFX0ZMT0FULCBVTklGT1JNVFlQRV9WRUMyLCBVTklGT1JNVFlQRV9WRUMzLFxuICAgIFVOSUZPUk1UWVBFX1ZFQzQsIFVOSUZPUk1UWVBFX0lWRUMyLCBVTklGT1JNVFlQRV9JVkVDMywgVU5JRk9STVRZUEVfSVZFQzQsIFVOSUZPUk1UWVBFX0JWRUMyLFxuICAgIFVOSUZPUk1UWVBFX0JWRUMzLCBVTklGT1JNVFlQRV9CVkVDNCwgVU5JRk9STVRZUEVfTUFUMiwgVU5JRk9STVRZUEVfTUFUMywgVU5JRk9STVRZUEVfTUFUNCxcbiAgICBVTklGT1JNVFlQRV9URVhUVVJFMkQsIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFLCBVTklGT1JNVFlQRV9GTE9BVEFSUkFZLCBVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XLFxuICAgIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVywgVU5JRk9STVRZUEVfVEVYVFVSRTNELCBVTklGT1JNVFlQRV9WRUMyQVJSQVksIFVOSUZPUk1UWVBFX1ZFQzNBUlJBWSwgVU5JRk9STVRZUEVfVkVDNEFSUkFZLFxuICAgIHNlbWFudGljVG9Mb2NhdGlvblxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBkcmF3UXVhZFdpdGhTaGFkZXIgfSBmcm9tICcuLi9zaW1wbGUtcG9zdC1lZmZlY3QuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vZGVidWctZ3JhcGhpY3MuanMnO1xuXG5pbXBvcnQgeyBXZWJnbFZlcnRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ2wtdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJnbEluZGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJnbC1pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xTaGFkZXIgfSBmcm9tICcuL3dlYmdsLXNoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJnbFRleHR1cmUgfSBmcm9tICcuL3dlYmdsLXRleHR1cmUuanMnO1xuaW1wb3J0IHsgV2ViZ2xSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3dlYmdsLXJlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2hhZGVyVXRpbHMgfSBmcm9tICcuLi9zaGFkZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSAnLi4vc2hhZGVyLmpzJztcblxuY29uc3QgaW52YWxpZGF0ZUF0dGFjaG1lbnRzID0gW107XG5cbmNvbnN0IF9mdWxsU2NyZWVuUXVhZFZTID0gLyogZ2xzbCAqL2BcbmF0dHJpYnV0ZSB2ZWMyIHZlcnRleF9wb3NpdGlvbjtcbnZhcnlpbmcgdmVjMiB2VXYwO1xudm9pZCBtYWluKHZvaWQpXG57XG4gICAgZ2xfUG9zaXRpb24gPSB2ZWM0KHZlcnRleF9wb3NpdGlvbiwgMC41LCAxLjApO1xuICAgIHZVdjAgPSB2ZXJ0ZXhfcG9zaXRpb24ueHkqMC41KzAuNTtcbn1cbmA7XG5cbmNvbnN0IF9wcmVjaXNpb25UZXN0MVBTID0gLyogZ2xzbCAqL2BcbnZvaWQgbWFpbih2b2lkKSB7IFxuICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMjE0NzQ4MzY0OC4wKTtcbn1cbmA7XG5cbmNvbnN0IF9wcmVjaXNpb25UZXN0MlBTID0gLyogZ2xzbCAqL2BcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcbnZlYzQgcGFja0Zsb2F0KGZsb2F0IGRlcHRoKSB7XG4gICAgY29uc3QgdmVjNCBiaXRfc2hpZnQgPSB2ZWM0KDI1Ni4wICogMjU2LjAgKiAyNTYuMCwgMjU2LjAgKiAyNTYuMCwgMjU2LjAsIDEuMCk7XG4gICAgY29uc3QgdmVjNCBiaXRfbWFzayAgPSB2ZWM0KDAuMCwgMS4wIC8gMjU2LjAsIDEuMCAvIDI1Ni4wLCAxLjAgLyAyNTYuMCk7XG4gICAgdmVjNCByZXMgPSBtb2QoZGVwdGggKiBiaXRfc2hpZnQgKiB2ZWM0KDI1NSksIHZlYzQoMjU2KSApIC8gdmVjNCgyNTUpO1xuICAgIHJlcyAtPSByZXMueHh5eiAqIGJpdF9tYXNrO1xuICAgIHJldHVybiByZXM7XG59XG52b2lkIG1haW4odm9pZCkge1xuICAgIGZsb2F0IGMgPSB0ZXh0dXJlMkQoc291cmNlLCB2ZWMyKDAuMCkpLnI7XG4gICAgZmxvYXQgZGlmZiA9IGFicyhjIC0gMjE0NzQ4MzY0OC4wKSAvIDIxNDc0ODM2NDguMDtcbiAgICBnbF9GcmFnQ29sb3IgPSBwYWNrRmxvYXQoZGlmZik7XG59XG5gO1xuXG5jb25zdCBfb3V0cHV0VGV4dHVyZTJEID0gLyogZ2xzbCAqL2BcbnZhcnlpbmcgdmVjMiB2VXYwO1xudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xudm9pZCBtYWluKHZvaWQpIHtcbiAgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCB2VXYwKTtcbn1cbmA7XG5cbmZ1bmN0aW9uIHRlc3RSZW5kZXJhYmxlKGdsLCBwaXhlbEZvcm1hdCkge1xuICAgIGxldCByZXN1bHQgPSB0cnVlO1xuXG4gICAgLy8gQ3JlYXRlIGEgMngyIHRleHR1cmVcbiAgICBjb25zdCB0ZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRleHR1cmUpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAyLCAyLCAwLCBnbC5SR0JBLCBwaXhlbEZvcm1hdCwgbnVsbCk7XG5cbiAgICAvLyBUcnkgdG8gdXNlIHRoaXMgdGV4dHVyZSBhcyBhIHJlbmRlciB0YXJnZXRcbiAgICBjb25zdCBmcmFtZWJ1ZmZlciA9IGdsLmNyZWF0ZUZyYW1lYnVmZmVyKCk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBmcmFtZWJ1ZmZlcik7XG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCB0ZXh0dXJlLCAwKTtcblxuICAgIC8vIEl0IGlzIGxlZ2FsIGZvciBhIFdlYkdMIGltcGxlbWVudGF0aW9uIGV4cG9zaW5nIHRoZSBPRVNfdGV4dHVyZV9mbG9hdCBleHRlbnNpb24gdG9cbiAgICAvLyBzdXBwb3J0IGZsb2F0aW5nLXBvaW50IHRleHR1cmVzIGJ1dCBub3QgYXMgYXR0YWNobWVudHMgdG8gZnJhbWVidWZmZXIgb2JqZWN0cy5cbiAgICBpZiAoZ2wuY2hlY2tGcmFtZWJ1ZmZlclN0YXR1cyhnbC5GUkFNRUJVRkZFUikgIT09IGdsLkZSQU1FQlVGRkVSX0NPTVBMRVRFKSB7XG4gICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIENsZWFuIHVwXG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gICAgZ2wuZGVsZXRlVGV4dHVyZSh0ZXh0dXJlKTtcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIG51bGwpO1xuICAgIGdsLmRlbGV0ZUZyYW1lYnVmZmVyKGZyYW1lYnVmZmVyKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRlc3RUZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlKGdsLCBwaXhlbEZvcm1hdCkge1xuICAgIGxldCByZXN1bHQgPSB0cnVlO1xuXG4gICAgLy8gQ3JlYXRlIGEgMngyIHRleHR1cmVcbiAgICBjb25zdCB0ZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRleHR1cmUpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG5cbiAgICAvLyB1cGxvYWQgc29tZSBkYXRhIC0gb24gaU9TIHByaW9yIHRvIGFib3V0IE5vdmVtYmVyIDIwMTksIHBhc3NpbmcgZGF0YSB0byBoYWxmIHRleHR1cmUgd291bGQgZmFpbCBoZXJlXG4gICAgLy8gc2VlIGRldGFpbHMgaGVyZTogaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE2OTk5OVxuICAgIC8vIG5vdGUgdGhhdCBpZiBub3Qgc3VwcG9ydGVkLCB0aGlzIHByaW50cyBhbiBlcnJvciB0byBjb25zb2xlLCB0aGUgZXJyb3IgY2FuIGJlIHNhZmVseSBpZ25vcmVkIGFzIGl0J3MgaGFuZGxlZFxuICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDE2QXJyYXkoNCAqIDIgKiAyKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIDIsIDIsIDAsIGdsLlJHQkEsIHBpeGVsRm9ybWF0LCBkYXRhKTtcblxuICAgIGlmIChnbC5nZXRFcnJvcigpICE9PSBnbC5OT19FUlJPUikge1xuICAgICAgICByZXN1bHQgPSBmYWxzZTtcbiAgICAgICAgY29uc29sZS5sb2coXCJBYm92ZSBlcnJvciByZWxhdGVkIHRvIEhBTEZfRkxPQVRfT0VTIGNhbiBiZSBpZ25vcmVkLCBpdCB3YXMgdHJpZ2dlcmVkIGJ5IHRlc3RpbmcgaGFsZiBmbG9hdCB0ZXh0dXJlIHN1cHBvcnRcIik7XG4gICAgfVxuXG4gICAgLy8gQ2xlYW4gdXBcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBudWxsKTtcbiAgICBnbC5kZWxldGVUZXh0dXJlKHRleHR1cmUpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gdGVzdFRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24oZGV2aWNlKSB7XG4gICAgaWYgKCFkZXZpY2UudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3Qgc2hhZGVyMSA9IG5ldyBTaGFkZXIoZGV2aWNlLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKGRldmljZSwge1xuICAgICAgICBuYW1lOiAncHRlc3QxJyxcbiAgICAgICAgdmVydGV4Q29kZTogX2Z1bGxTY3JlZW5RdWFkVlMsXG4gICAgICAgIGZyYWdtZW50Q29kZTogX3ByZWNpc2lvblRlc3QxUFNcbiAgICB9KSk7XG5cbiAgICBjb25zdCBzaGFkZXIyID0gbmV3IFNoYWRlcihkZXZpY2UsIFNoYWRlclV0aWxzLmNyZWF0ZURlZmluaXRpb24oZGV2aWNlLCB7XG4gICAgICAgIG5hbWU6ICdwdGVzdDInLFxuICAgICAgICB2ZXJ0ZXhDb2RlOiBfZnVsbFNjcmVlblF1YWRWUyxcbiAgICAgICAgZnJhZ21lbnRDb2RlOiBfcHJlY2lzaW9uVGVzdDJQU1xuICAgIH0pKTtcblxuICAgIGNvbnN0IHRleHR1cmVPcHRpb25zID0ge1xuICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1JHQkEzMkYsXG4gICAgICAgIHdpZHRoOiAxLFxuICAgICAgICBoZWlnaHQ6IDEsXG4gICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICBuYW1lOiAndGVzdEZIUCdcbiAgICB9O1xuICAgIGNvbnN0IHRleDEgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHRleHR1cmVPcHRpb25zKTtcbiAgICBjb25zdCB0YXJnMSA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICBjb2xvckJ1ZmZlcjogdGV4MSxcbiAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgfSk7XG4gICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZzEsIHNoYWRlcjEpO1xuXG4gICAgdGV4dHVyZU9wdGlvbnMuZm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgY29uc3QgdGV4MiA9IG5ldyBUZXh0dXJlKGRldmljZSwgdGV4dHVyZU9wdGlvbnMpO1xuICAgIGNvbnN0IHRhcmcyID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgyLFxuICAgICAgICBkZXB0aDogZmFsc2VcbiAgICB9KTtcbiAgICBkZXZpY2UuY29uc3RhbnRUZXhTb3VyY2Uuc2V0VmFsdWUodGV4MSk7XG4gICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZzIsIHNoYWRlcjIpO1xuXG4gICAgY29uc3QgcHJldkZyYW1lYnVmZmVyID0gZGV2aWNlLmFjdGl2ZUZyYW1lYnVmZmVyO1xuICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcih0YXJnMi5pbXBsLl9nbEZyYW1lQnVmZmVyKTtcblxuICAgIGNvbnN0IHBpeGVscyA9IG5ldyBVaW50OEFycmF5KDQpO1xuICAgIGRldmljZS5yZWFkUGl4ZWxzKDAsIDAsIDEsIDEsIHBpeGVscyk7XG5cbiAgICBkZXZpY2Uuc2V0RnJhbWVidWZmZXIocHJldkZyYW1lYnVmZmVyKTtcblxuICAgIGNvbnN0IHggPSBwaXhlbHNbMF0gLyAyNTU7XG4gICAgY29uc3QgeSA9IHBpeGVsc1sxXSAvIDI1NTtcbiAgICBjb25zdCB6ID0gcGl4ZWxzWzJdIC8gMjU1O1xuICAgIGNvbnN0IHcgPSBwaXhlbHNbM10gLyAyNTU7XG4gICAgY29uc3QgZiA9IHggLyAoMjU2ICogMjU2ICogMjU2KSArIHkgLyAoMjU2ICogMjU2KSArIHogLyAyNTYgKyB3O1xuXG4gICAgdGV4MS5kZXN0cm95KCk7XG4gICAgdGFyZzEuZGVzdHJveSgpO1xuICAgIHRleDIuZGVzdHJveSgpO1xuICAgIHRhcmcyLmRlc3Ryb3koKTtcbiAgICBzaGFkZXIxLmRlc3Ryb3koKTtcbiAgICBzaGFkZXIyLmRlc3Ryb3koKTtcblxuICAgIHJldHVybiBmID09PSAwO1xufVxuXG4vLyBJbWFnZUJpdG1hcCBjdXJyZW50IHN0YXRlIChTZXAgMjAyMik6XG4vLyAtIExhc3Rlc3QgQ2hyb21lIGFuZCBGaXJlZm94IGJyb3dzZXJzIGFwcGVhciB0byBzdXBwb3J0IHRoZSBJbWFnZUJpdG1hcCBBUEkgZmluZSAodGhvdWdoXG4vLyAgIHRoZXJlIGFyZSBsaWtlbHkgc3RpbGwgaXNzdWVzIHdpdGggb2xkZXIgdmVyc2lvbnMgb2YgYm90aCkuXG4vLyAtIFNhZmFyaSBzdXBwb3J0cyB0aGUgQVBJLCBidXQgY29tcGxldGVseSBkZXN0cm95cyBzb21lIHBuZ3MuIEZvciBleGFtcGxlIHRoZSBjdWJlbWFwcyBpblxuLy8gICBzdGVhbXB1bmsgc2xvdHMgaHR0cHM6Ly9wbGF5Y2FudmFzLmNvbS9lZGl0b3Ivc2NlbmUvNTI0ODU4LiBTZWUgdGhlIHdlYmtpdCBpc3N1ZVxuLy8gICBodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93X2J1Zy5jZ2k/aWQ9MTgyNDI0IGZvciBzdGF0dXMuXG4vLyAtIFNvbWUgYXBwbGljYXRpb25zIGFzc3VtZSB0aGF0IFBOR3MgbG9hZGVkIGJ5IHRoZSBlbmdpbmUgdXNlIEhUTUxJbWFnZUJpdG1hcCBpbnRlcmZhY2UgYW5kXG4vLyAgIGZhaWwgd2hlbiB1c2luZyBJbWFnZUJpdG1hcC4gRm9yIGV4YW1wbGUsIFNwYWNlIEJhc2UgcHJvamVjdCBmYWlscyBiZWNhdXNlIGl0IHVzZXMgZW5naW5lXG4vLyAgIHRleHR1cmUgYXNzZXRzIG9uIHRoZSBkb20gaHR0cHM6Ly9wbGF5Y2FudmFzLmNvbS9lZGl0b3Ivc2NlbmUvNDQ2Mjc4LlxuXG4vLyBUaGlzIGZ1bmN0aW9uIHRlc3RzIHdoZXRoZXIgdGhlIGN1cnJlbnQgYnJvd3NlciBkZXN0cm95cyBQTkcgZGF0YSBvciBub3QuXG5mdW5jdGlvbiB0ZXN0SW1hZ2VCaXRtYXAoZGV2aWNlKSB7XG4gICAgLy8gMXgxIHBuZyBpbWFnZSBjb250YWluaW5nIHJnYmEoMSwgMiwgMywgNjMpXG4gICAgY29uc3QgcG5nQnl0ZXMgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDEzNywgODAsIDc4LCA3MSwgMTMsIDEwLCAyNiwgMTAsIDAsIDAsIDAsIDEzLCA3MywgNzIsIDY4LCA4MiwgMCwgMCwgMCwgMSwgMCwgMCwgMCwgMSwgOCwgNiwgMCwgMCwgMCwgMzEsIDIxLFxuICAgICAgICAxOTYsIDEzNywgMCwgMCwgMCwgMTMsIDczLCA2OCwgNjUsIDg0LCAxMjAsIDIxOCwgOTksIDEwMCwgMTAwLCA5OCwgMTgyLCA3LCAwLCAwLCA4OSwgMCwgNzEsIDY3LCAxMzMsIDE0OCwgMjM3LFxuICAgICAgICAwLCAwLCAwLCAwLCA3MywgNjksIDc4LCA2OCwgMTc0LCA2NiwgOTYsIDEzMFxuICAgIF0pO1xuXG4gICAgcmV0dXJuIGNyZWF0ZUltYWdlQml0bWFwKG5ldyBCbG9iKFtwbmdCeXRlc10sIHsgdHlwZTogJ2ltYWdlL3BuZycgfSksIHsgcHJlbXVsdGlwbHlBbHBoYTogJ25vbmUnIH0pXG4gICAgICAgIC50aGVuKChpbWFnZSkgPT4ge1xuICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSB0ZXh0dXJlXG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgICAgICAgICAgd2lkdGg6IDEsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgICAgICAgICAgICAgbWlwbWFwczogZmFsc2UsXG4gICAgICAgICAgICAgICAgbGV2ZWxzOiBbaW1hZ2VdXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gcmVhZCBwaXhlbHNcbiAgICAgICAgICAgIGNvbnN0IHJ0ID0gbmV3IFJlbmRlclRhcmdldCh7IGNvbG9yQnVmZmVyOiB0ZXh0dXJlLCBkZXB0aDogZmFsc2UgfSk7XG4gICAgICAgICAgICBkZXZpY2Uuc2V0RnJhbWVidWZmZXIocnQuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG4gICAgICAgICAgICBkZXZpY2UuaW5pdFJlbmRlclRhcmdldChydCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDhDbGFtcGVkQXJyYXkoNCk7XG4gICAgICAgICAgICBkZXZpY2UuZ2wucmVhZFBpeGVscygwLCAwLCAxLCAxLCBkZXZpY2UuZ2wuUkdCQSwgZGV2aWNlLmdsLlVOU0lHTkVEX0JZVEUsIGRhdGEpO1xuXG4gICAgICAgICAgICBydC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0ZXh0dXJlLmRlc3Ryb3koKTtcblxuICAgICAgICAgICAgcmV0dXJuIGRhdGFbMF0gPT09IDEgJiYgZGF0YVsxXSA9PT0gMiAmJiBkYXRhWzJdID09PSAzICYmIGRhdGFbM10gPT09IDYzO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZSA9PiBmYWxzZSk7XG59XG5cbi8qKlxuICogVGhlIGdyYXBoaWNzIGRldmljZSBtYW5hZ2VzIHRoZSB1bmRlcmx5aW5nIGdyYXBoaWNzIGNvbnRleHQuIEl0IGlzIHJlc3BvbnNpYmxlIGZvciBzdWJtaXR0aW5nXG4gKiByZW5kZXIgc3RhdGUgY2hhbmdlcyBhbmQgZ3JhcGhpY3MgcHJpbWl0aXZlcyB0byB0aGUgaGFyZHdhcmUuIEEgZ3JhcGhpY3MgZGV2aWNlIGlzIHRpZWQgdG8gYVxuICogc3BlY2lmaWMgY2FudmFzIEhUTUwgZWxlbWVudC4gSXQgaXMgdmFsaWQgdG8gaGF2ZSBtb3JlIHRoYW4gb25lIGNhbnZhcyBlbGVtZW50IHBlciBwYWdlIGFuZFxuICogY3JlYXRlIGEgbmV3IGdyYXBoaWNzIGRldmljZSBhZ2FpbnN0IGVhY2guXG4gKlxuICogQGF1Z21lbnRzIEdyYXBoaWNzRGV2aWNlXG4gKi9cbmNsYXNzIFdlYmdsR3JhcGhpY3NEZXZpY2UgZXh0ZW5kcyBHcmFwaGljc0RldmljZSB7XG4gICAgLyoqXG4gICAgICogVGhlIFdlYkdMIGNvbnRleHQgbWFuYWdlZCBieSB0aGUgZ3JhcGhpY3MgZGV2aWNlLiBUaGUgdHlwZSBjb3VsZCBhbHNvIHRlY2huaWNhbGx5IGJlXG4gICAgICogYFdlYkdMUmVuZGVyaW5nQ29udGV4dGAgaWYgV2ViR0wgMi4wIGlzIG5vdCBhdmFpbGFibGUuIEJ1dCBpbiBvcmRlciBmb3IgSW50ZWxsaVNlbnNlIHRvIGJlXG4gICAgICogYWJsZSB0byBmdW5jdGlvbiBmb3IgYWxsIFdlYkdMIGNhbGxzIGluIHRoZSBjb2RlYmFzZSwgd2Ugc3BlY2lmeSBgV2ViR0wyUmVuZGVyaW5nQ29udGV4dGBcbiAgICAgKiBoZXJlIGluc3RlYWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7V2ViR0wyUmVuZGVyaW5nQ29udGV4dH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2w7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBXZWJHTCBjb250ZXh0IG9mIHRoaXMgZGV2aWNlIGlzIHVzaW5nIHRoZSBXZWJHTCAyLjAgQVBJLiBJZiBmYWxzZSwgV2ViR0wgMS4wIGlzXG4gICAgICogYmVpbmcgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB3ZWJnbDI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFdlYmdsR3JhcGhpY3NEZXZpY2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxDYW52YXNFbGVtZW50fSBjYW52YXMgLSBUaGUgY2FudmFzIHRvIHdoaWNoIHRoZSBncmFwaGljcyBkZXZpY2Ugd2lsbCByZW5kZXIuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbnMgcGFzc2VkIHdoZW4gY3JlYXRpbmcgdGhlIFdlYkdMIGNvbnRleHQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbHBoYT10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgaWYgdGhlIGNhbnZhcyBjb250YWlucyBhblxuICAgICAqIGFscGhhIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmRlcHRoPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBkcmF3aW5nIGJ1ZmZlciBpc1xuICAgICAqIHJlcXVlc3RlZCB0byBoYXZlIGEgZGVwdGggYnVmZmVyIG9mIGF0IGxlYXN0IDE2IGJpdHMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zdGVuY2lsPWZhbHNlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGUgZHJhd2luZyBidWZmZXIgaXNcbiAgICAgKiByZXF1ZXN0ZWQgdG8gaGF2ZSBhIHN0ZW5jaWwgYnVmZmVyIG9mIGF0IGxlYXN0IDggYml0cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFudGlhbGlhcz10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgd2hldGhlciBvciBub3QgdG8gcGVyZm9ybVxuICAgICAqIGFudGktYWxpYXNpbmcgaWYgcG9zc2libGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcmVtdWx0aXBsaWVkQWxwaGE9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhlIHBhZ2VcbiAgICAgKiBjb21wb3NpdG9yIHdpbGwgYXNzdW1lIHRoZSBkcmF3aW5nIGJ1ZmZlciBjb250YWlucyBjb2xvcnMgd2l0aCBwcmUtbXVsdGlwbGllZCBhbHBoYS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZXNlcnZlRHJhd2luZ0J1ZmZlcj1mYWxzZV0gLSBJZiB0aGUgdmFsdWUgaXMgdHJ1ZSB0aGUgYnVmZmVyc1xuICAgICAqIHdpbGwgbm90IGJlIGNsZWFyZWQgYW5kIHdpbGwgcHJlc2VydmUgdGhlaXIgdmFsdWVzIHVudGlsIGNsZWFyZWQgb3Igb3ZlcndyaXR0ZW4gYnkgdGhlXG4gICAgICogYXV0aG9yLlxuICAgICAqIEBwYXJhbSB7J2RlZmF1bHQnfCdoaWdoLXBlcmZvcm1hbmNlJ3wnbG93LXBvd2VyJ30gW29wdGlvbnMucG93ZXJQcmVmZXJlbmNlPSdkZWZhdWx0J10gLSBBXG4gICAgICogaGludCB0byB0aGUgdXNlciBhZ2VudCBpbmRpY2F0aW5nIHdoYXQgY29uZmlndXJhdGlvbiBvZiBHUFUgaXMgc3VpdGFibGUgZm9yIHRoZSBXZWJHTFxuICAgICAqIGNvbnRleHQuIFBvc3NpYmxlIHZhbHVlcyBhcmU6XG4gICAgICpcbiAgICAgKiAtICdkZWZhdWx0JzogTGV0IHRoZSB1c2VyIGFnZW50IGRlY2lkZSB3aGljaCBHUFUgY29uZmlndXJhdGlvbiBpcyBtb3N0IHN1aXRhYmxlLiBUaGlzIGlzIHRoZVxuICAgICAqIGRlZmF1bHQgdmFsdWUuXG4gICAgICogLSAnaGlnaC1wZXJmb3JtYW5jZSc6IFByaW9yaXRpemVzIHJlbmRlcmluZyBwZXJmb3JtYW5jZSBvdmVyIHBvd2VyIGNvbnN1bXB0aW9uLlxuICAgICAqIC0gJ2xvdy1wb3dlcic6IFByaW9yaXRpemVzIHBvd2VyIHNhdmluZyBvdmVyIHJlbmRlcmluZyBwZXJmb3JtYW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZmFpbElmTWFqb3JQZXJmb3JtYW5jZUNhdmVhdD1mYWxzZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIGlmIGFcbiAgICAgKiBjb250ZXh0IHdpbGwgYmUgY3JlYXRlZCBpZiB0aGUgc3lzdGVtIHBlcmZvcm1hbmNlIGlzIGxvdyBvciBpZiBubyBoYXJkd2FyZSBHUFUgaXMgYXZhaWxhYmxlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlZmVyV2ViR2wyPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyBpZiBhIFdlYkdsMiBjb250ZXh0XG4gICAgICogc2hvdWxkIGJlIHByZWZlcnJlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmRlc3luY2hyb25pemVkPWZhbHNlXSAtIEJvb2xlYW4gdGhhdCBoaW50cyB0aGUgdXNlciBhZ2VudCB0b1xuICAgICAqIHJlZHVjZSB0aGUgbGF0ZW5jeSBieSBkZXN5bmNocm9uaXppbmcgdGhlIGNhbnZhcyBwYWludCBjeWNsZSBmcm9tIHRoZSBldmVudCBsb29wLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMueHJDb21wYXRpYmxlXSAtIEJvb2xlYW4gdGhhdCBoaW50cyB0byB0aGUgdXNlciBhZ2VudCB0byB1c2UgYVxuICAgICAqIGNvbXBhdGlibGUgZ3JhcGhpY3MgYWRhcHRlciBmb3IgYW4gaW1tZXJzaXZlIFhSIGRldmljZS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihjYW52YXMsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcihjYW52YXMpO1xuICAgICAgICB0aGlzLmRldmljZVR5cGUgPSBERVZJQ0VUWVBFX1dFQkdMO1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdEZyYW1lYnVmZmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnVwZGF0ZUNsaWVudFJlY3QoKTtcblxuICAgICAgICAvLyBBZGQgaGFuZGxlcnMgZm9yIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgaXMgbG9zdCBvciByZXN0b3JlZFxuICAgICAgICB0aGlzLmNvbnRleHRMb3N0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0TG9zdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmxvc2VDb250ZXh0KCk7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coJ3BjLkdyYXBoaWNzRGV2aWNlOiBXZWJHTCBjb250ZXh0IGxvc3QuJyk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2RldmljZWxvc3QnKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgRGVidWcubG9nKCdwYy5HcmFwaGljc0RldmljZTogV2ViR0wgY29udGV4dCByZXN0b3JlZC4nKTtcbiAgICAgICAgICAgIHRoaXMucmVzdG9yZUNvbnRleHQoKTtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dExvc3QgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZGV2aWNlcmVzdG9yZWQnKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBvcHRpb25zIGRlZmF1bHRzXG4gICAgICAgIG9wdGlvbnMuc3RlbmNpbCA9IHRydWU7XG4gICAgICAgIGlmICghb3B0aW9ucy5wb3dlclByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgIG9wdGlvbnMucG93ZXJQcmVmZXJlbmNlID0gJ2hpZ2gtcGVyZm9ybWFuY2UnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gIzQxMzYgLSB0dXJuIG9mZiBhbnRpYWxpYXNpbmcgb24gQXBwbGVXZWJLaXQgYnJvd3NlcnMgMTUuNFxuICAgICAgICBjb25zdCB1YSA9ICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJykgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudDtcbiAgICAgICAgdGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nID0gdWEgJiYgdWEuaW5jbHVkZXMoJ0FwcGxlV2ViS2l0JykgJiYgKHVhLmluY2x1ZGVzKCcxNS40JykgfHwgdWEuaW5jbHVkZXMoJzE1XzQnKSk7XG4gICAgICAgIGlmICh0aGlzLmZvcmNlRGlzYWJsZU11bHRpc2FtcGxpbmcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuYW50aWFsaWFzID0gZmFsc2U7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coXCJBbnRpYWxpYXNpbmcgaGFzIGJlZW4gdHVybmVkIG9mZiBkdWUgdG8gcmVuZGVyaW5nIGlzc3VlcyBvbiBBcHBsZVdlYktpdCAxNS40XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmV0cmlldmUgdGhlIFdlYkdMIGNvbnRleHRcbiAgICAgICAgY29uc3QgcHJlZmVyV2ViR2wyID0gKG9wdGlvbnMucHJlZmVyV2ViR2wyICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5wcmVmZXJXZWJHbDIgOiB0cnVlO1xuXG4gICAgICAgIGNvbnN0IG5hbWVzID0gcHJlZmVyV2ViR2wyID8gW1wid2ViZ2wyXCIsIFwid2ViZ2xcIiwgXCJleHBlcmltZW50YWwtd2ViZ2xcIl0gOiBbXCJ3ZWJnbFwiLCBcImV4cGVyaW1lbnRhbC13ZWJnbFwiXTtcbiAgICAgICAgbGV0IGdsID0gbnVsbDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dChuYW1lc1tpXSwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgIGlmIChnbCkge1xuICAgICAgICAgICAgICAgIHRoaXMud2ViZ2wyID0gKG5hbWVzW2ldID09PSAnd2ViZ2wyJyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5nbCA9IGdsO1xuXG4gICAgICAgIGlmICghZ2wpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIldlYkdMIG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwaXhlbCBmb3JtYXQgb2YgdGhlIGZyYW1lYnVmZmVyXG4gICAgICAgIGNvbnN0IGFscGhhQml0cyA9IGdsLmdldFBhcmFtZXRlcihnbC5BTFBIQV9CSVRTKTtcbiAgICAgICAgdGhpcy5mcmFtZWJ1ZmZlckZvcm1hdCA9IGFscGhhQml0cyA/IFBJWEVMRk9STUFUX1JHQkE4IDogUElYRUxGT1JNQVRfUkdCODtcblxuICAgICAgICBjb25zdCBpc0Nocm9tZSA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgISF3aW5kb3cuY2hyb21lO1xuICAgICAgICBjb25zdCBpc01hYyA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIk1hY1wiKSAhPT0gLTE7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB0ZXh0dXJlIHVuaXQgd29ya2Fyb3VuZCBvbiBkZXNrdG9wIHNhZmFyaVxuICAgICAgICB0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIXdpbmRvdy5zYWZhcmk7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciBnbEJsaXRGcmFtZWJ1ZmZlciBmYWlsaW5nIG9uIE1hYyBDaHJvbWUgKCMyNTA0KVxuICAgICAgICB0aGlzLl90ZW1wTWFjQ2hyb21lQmxpdEZyYW1lYnVmZmVyV29ya2Fyb3VuZCA9IGlzTWFjICYmIGlzQ2hyb21lICYmICFvcHRpb25zLmFscGhhO1xuXG4gICAgICAgIC8vIGluaXQgcG9seWZpbGwgZm9yIFZBT3MgdW5kZXIgd2ViZ2wxXG4gICAgICAgIGlmICghdGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHNldHVwVmVydGV4QXJyYXlPYmplY3QoZ2wpO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRsb3N0XCIsIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciwgZmFsc2UpO1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dHJlc3RvcmVkXCIsIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVFeHRlbnNpb25zKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNhcGFiaWxpdGllcygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVSZW5kZXJTdGF0ZSgpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gc3RhcnQgYXN5bmMgaW1hZ2UgYml0bWFwIHRlc3RcbiAgICAgICAgdGhpcy5zdXBwb3J0c0ltYWdlQml0bWFwID0gbnVsbDtcbiAgICAgICAgaWYgKHR5cGVvZiBJbWFnZUJpdG1hcCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRlc3RJbWFnZUJpdG1hcCh0aGlzKS50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnN1cHBvcnRzSW1hZ2VCaXRtYXAgPSByZXN1bHQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGVmYXVsdENsZWFyT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGNvbG9yOiBbMCwgMCwgMCwgMV0sXG4gICAgICAgICAgICBkZXB0aDogMSxcbiAgICAgICAgICAgIHN0ZW5jaWw6IDAsXG4gICAgICAgICAgICBmbGFnczogQ0xFQVJGTEFHX0NPTE9SIHwgQ0xFQVJGTEFHX0RFUFRIXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nbEFkZHJlc3MgPSBbXG4gICAgICAgICAgICBnbC5SRVBFQVQsXG4gICAgICAgICAgICBnbC5DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgZ2wuTUlSUk9SRURfUkVQRUFUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRXF1YXRpb24gPSBbXG4gICAgICAgICAgICBnbC5GVU5DX0FERCxcbiAgICAgICAgICAgIGdsLkZVTkNfU1VCVFJBQ1QsXG4gICAgICAgICAgICBnbC5GVU5DX1JFVkVSU0VfU1VCVFJBQ1QsXG4gICAgICAgICAgICB0aGlzLndlYmdsMiA/IGdsLk1JTiA6IHRoaXMuZXh0QmxlbmRNaW5tYXggPyB0aGlzLmV4dEJsZW5kTWlubWF4Lk1JTl9FWFQgOiBnbC5GVU5DX0FERCxcbiAgICAgICAgICAgIHRoaXMud2ViZ2wyID8gZ2wuTUFYIDogdGhpcy5leHRCbGVuZE1pbm1heCA/IHRoaXMuZXh0QmxlbmRNaW5tYXguTUFYX0VYVCA6IGdsLkZVTkNfQUREXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb24gPSBbXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuT05FLFxuICAgICAgICAgICAgZ2wuU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICAgICAgICAgIGdsLkRTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19EU1RfQ09MT1IsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEFfU0FUVVJBVEUsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBLFxuICAgICAgICAgICAgZ2wuRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICAgICAgICAgIGdsLkNPTlNUQU5UX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SLFxuICAgICAgICAgICAgZ2wuQ09OU1RBTlRfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEFcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQ29tcGFyaXNvbiA9IFtcbiAgICAgICAgICAgIGdsLk5FVkVSLFxuICAgICAgICAgICAgZ2wuTEVTUyxcbiAgICAgICAgICAgIGdsLkVRVUFMLFxuICAgICAgICAgICAgZ2wuTEVRVUFMLFxuICAgICAgICAgICAgZ2wuR1JFQVRFUixcbiAgICAgICAgICAgIGdsLk5PVEVRVUFMLFxuICAgICAgICAgICAgZ2wuR0VRVUFMLFxuICAgICAgICAgICAgZ2wuQUxXQVlTXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbFN0ZW5jaWxPcCA9IFtcbiAgICAgICAgICAgIGdsLktFRVAsXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuUkVQTEFDRSxcbiAgICAgICAgICAgIGdsLklOQ1IsXG4gICAgICAgICAgICBnbC5JTkNSX1dSQVAsXG4gICAgICAgICAgICBnbC5ERUNSLFxuICAgICAgICAgICAgZ2wuREVDUl9XUkFQLFxuICAgICAgICAgICAgZ2wuSU5WRVJUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbENsZWFyRmxhZyA9IFtcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBnbC5DT0xPUl9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuREVQVEhfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklUIHwgZ2wuQ09MT1JfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLlNURU5DSUxfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5TVEVOQ0lMX0JVRkZFUl9CSVQgfCBnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xDdWxsID0gW1xuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIGdsLkJBQ0ssXG4gICAgICAgICAgICBnbC5GUk9OVCxcbiAgICAgICAgICAgIGdsLkZST05UX0FORF9CQUNLXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEZpbHRlciA9IFtcbiAgICAgICAgICAgIGdsLk5FQVJFU1QsXG4gICAgICAgICAgICBnbC5MSU5FQVIsXG4gICAgICAgICAgICBnbC5ORUFSRVNUX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9MSU5FQVJcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsUHJpbWl0aXZlID0gW1xuICAgICAgICAgICAgZ2wuUE9JTlRTLFxuICAgICAgICAgICAgZ2wuTElORVMsXG4gICAgICAgICAgICBnbC5MSU5FX0xPT1AsXG4gICAgICAgICAgICBnbC5MSU5FX1NUUklQLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVTLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVfU1RSSVAsXG4gICAgICAgICAgICBnbC5UUklBTkdMRV9GQU5cbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsVHlwZSA9IFtcbiAgICAgICAgICAgIGdsLkJZVEUsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9CWVRFLFxuICAgICAgICAgICAgZ2wuU0hPUlQsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9TSE9SVCxcbiAgICAgICAgICAgIGdsLklOVCxcbiAgICAgICAgICAgIGdsLlVOU0lHTkVEX0lOVCxcbiAgICAgICAgICAgIGdsLkZMT0FUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlID0ge307XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MXSAgICAgICAgID0gVU5JRk9STVRZUEVfQk9PTDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9JTlQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF0gICAgICAgID0gVU5JRk9STVRZUEVfRkxPQVQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9WRUMyXSAgID0gVU5JRk9STVRZUEVfVkVDMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX1ZFQzNdICAgPSBVTklGT1JNVFlQRV9WRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfVkVDNF0gICA9IFVOSUZPUk1UWVBFX1ZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDMl0gICAgID0gVU5JRk9STVRZUEVfSVZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDM10gICAgID0gVU5JRk9STVRZUEVfSVZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDNF0gICAgID0gVU5JRk9STVRZUEVfSVZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzJdICAgID0gVU5JRk9STVRZUEVfQlZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzNdICAgID0gVU5JRk9STVRZUEVfQlZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzRdICAgID0gVU5JRk9STVRZUEVfQlZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9NQVQyXSAgID0gVU5JRk9STVRZUEVfTUFUMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX01BVDNdICAgPSBVTklGT1JNVFlQRV9NQVQzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfTUFUNF0gICA9IFVOSUZPUk1UWVBFX01BVDQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEXSAgID0gVU5JRk9STVRZUEVfVEVYVFVSRTJEO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFXSA9IFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEX1NIQURPV10gICA9IFVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFX1NIQURPV10gPSBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8zRF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9URVhUVVJFM0Q7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdCA9IHt9O1xuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdFtnbC5URVhUVVJFXzJEXSA9IDA7XG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90W2dsLlRFWFRVUkVfQ1VCRV9NQVBdID0gMTtcbiAgICAgICAgdGhpcy50YXJnZXRUb1Nsb3RbZ2wuVEVYVFVSRV8zRF0gPSAyO1xuXG4gICAgICAgIC8vIERlZmluZSB0aGUgdW5pZm9ybSBjb21taXQgZnVuY3Rpb25zXG4gICAgICAgIGxldCBzY29wZVgsIHNjb3BlWSwgc2NvcGVaLCBzY29wZVc7XG4gICAgICAgIGxldCB1bmlmb3JtVmFsdWU7XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb24gPSBbXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0udmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFpKHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JTlRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9GTE9BVF0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtLnZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xZih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLnZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2Z2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzJdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yaXYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CVkVDMl0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMyXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDM10gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2l2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUMzXSA9IHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzNdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUM0XSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQlZFQzRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDNF07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfTUFUMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtTWF0cml4MmZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9NQVQzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm1NYXRyaXgzZnYodW5pZm9ybS5sb2NhdGlvbklkLCBmYWxzZSwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX01BVDRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIGZhbHNlLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfRkxPQVRBUlJBWV0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0xZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMkFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDM0FSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0zZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDNEFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm00ZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0JvbmVUZXh0dXJlcyA9IHRoaXMuZXh0VGV4dHVyZUZsb2F0ICYmIHRoaXMubWF4VmVydGV4VGV4dHVyZXMgPiAwO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBhbiBlc3RpbWF0ZSBvZiB0aGUgbWF4aW11bSBudW1iZXIgb2YgYm9uZXMgdGhhdCBjYW4gYmUgdXBsb2FkZWQgdG8gdGhlIEdQVVxuICAgICAgICAvLyBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGF2YWlsYWJsZSB1bmlmb3JtcyBhbmQgdGhlIG51bWJlciBvZiB1bmlmb3JtcyByZXF1aXJlZCBmb3Igbm9uLVxuICAgICAgICAvLyBib25lIGRhdGEuICBUaGlzIGlzIGJhc2VkIG9mZiBvZiB0aGUgU3RhbmRhcmQgc2hhZGVyLiAgQSB1c2VyIGRlZmluZWQgc2hhZGVyIG1heSBoYXZlXG4gICAgICAgIC8vIGV2ZW4gbGVzcyBzcGFjZSBhdmFpbGFibGUgZm9yIGJvbmVzIHNvIHRoaXMgY2FsY3VsYXRlZCB2YWx1ZSBjYW4gYmUgb3ZlcnJpZGRlbiB2aWFcbiAgICAgICAgLy8gcGMuR3JhcGhpY3NEZXZpY2Uuc2V0Qm9uZUxpbWl0LlxuICAgICAgICBsZXQgbnVtVW5pZm9ybXMgPSB0aGlzLnZlcnRleFVuaWZvcm1zQ291bnQ7XG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBNb2RlbCwgdmlldywgcHJvamVjdGlvbiBhbmQgc2hhZG93IG1hdHJpY2VzXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDg7ICAgICAvLyA4IGxpZ2h0cyBtYXgsIGVhY2ggc3BlY2lmeWluZyBhIHBvc2l0aW9uIHZlY3RvclxuICAgICAgICBudW1Vbmlmb3JtcyAtPSAxOyAgICAgLy8gRXllIHBvc2l0aW9uXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBVcCB0byA0IHRleHR1cmUgdHJhbnNmb3Jtc1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGguZmxvb3IobnVtVW5pZm9ybXMgLyAzKTsgICAvLyBlYWNoIGJvbmUgdXNlcyAzIHVuaWZvcm1zXG5cbiAgICAgICAgLy8gUHV0IGEgbGltaXQgb24gdGhlIG51bWJlciBvZiBzdXBwb3J0ZWQgYm9uZXMgYmVmb3JlIHNraW4gcGFydGl0aW9uaW5nIG11c3QgYmUgcGVyZm9ybWVkXG4gICAgICAgIC8vIFNvbWUgR1BVcyBoYXZlIGRlbW9uc3RyYXRlZCBwZXJmb3JtYW5jZSBpc3N1ZXMgaWYgdGhlIG51bWJlciBvZiB2ZWN0b3JzIGFsbG9jYXRlZCB0byB0aGVcbiAgICAgICAgLy8gc2tpbiBtYXRyaXggcGFsZXR0ZSBpcyBsZWZ0IHVuYm91bmRlZFxuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGgubWluKHRoaXMuYm9uZUxpbWl0LCAxMjgpO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza2VkUmVuZGVyZXIgPT09ICdNYWxpLTQ1MCBNUCcpIHtcbiAgICAgICAgICAgIHRoaXMuYm9uZUxpbWl0ID0gMzQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnN0YW50VGV4U291cmNlID0gdGhpcy5zY29wZS5yZXNvbHZlKFwic291cmNlXCIpO1xuXG4gICAgICAgIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wyIGZsb2F0IHRleHR1cmUgcmVuZGVyYWJpbGl0eSBpcyBkaWN0YXRlZCBieSB0aGUgRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBleHRlbnNpb25cbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSAhIXRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wxIHdlIHNob3VsZCBqdXN0IHRyeSByZW5kZXJpbmcgaW50byBhIGZsb2F0IHRleHR1cmVcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSB0ZXN0UmVuZGVyYWJsZShnbCwgZ2wuRkxPQVQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0d28gZXh0ZW5zaW9ucyBhbGxvdyB1cyB0byByZW5kZXIgdG8gaGFsZiBmbG9hdCBidWZmZXJzXG4gICAgICAgIGlmICh0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0KSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gISF0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0O1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBzaG91bGQgYWZmZWN0IGJvdGggZmxvYXQgYW5kIGhhbGZmbG9hdCBmb3JtYXRzXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9ICEhdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBNYW51YWwgcmVuZGVyIGNoZWNrIGZvciBoYWxmIGZsb2F0XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IHRlc3RSZW5kZXJhYmxlKGdsLCB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlID0gKHRoaXMubWF4UHJlY2lzaW9uID09PSBcImhpZ2hwXCIgJiYgdGhpcy5tYXhWZXJ0ZXhUZXh0dXJlcyA+PSAyKTtcblxuICAgICAgICB0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgdGhpcy5fc3BlY3Rvck1hcmtlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5fc3BlY3RvckN1cnJlbnRNYXJrZXIgPSBcIlwiO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBhcmVhIGxpZ2h0IExVVCBmb3JtYXQgLSBvcmRlciBvZiBwcmVmZXJlbmNlOiBoYWxmLCBmbG9hdCwgOGJpdFxuICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkE4O1xuICAgICAgICBpZiAodGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0ICYmIHRoaXMudGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSAmJiB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIpIHtcbiAgICAgICAgICAgIHRoaXMuYXJlYUxpZ2h0THV0Rm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCAmJiB0aGlzLmV4dFRleHR1cmVGbG9hdExpbmVhcikge1xuICAgICAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBMzJGO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSB0aGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiB0aGlzLmZlZWRiYWNrKSB7XG4gICAgICAgICAgICBnbC5kZWxldGVUcmFuc2Zvcm1GZWVkYmFjayh0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2xlYXJTaGFkZXJDYWNoZSgpO1xuICAgICAgICB0aGlzLmNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSgpO1xuXG4gICAgICAgIHRoaXMuY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmdsY29udGV4dGxvc3QnLCB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0cmVzdG9yZWQnLCB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5nbCA9IG51bGw7XG5cbiAgICAgICAgc3VwZXIucG9zdERlc3Ryb3koKTtcbiAgICB9XG5cbiAgICAvLyBwcm92aWRlIHdlYmdsIGltcGxlbWVudGF0aW9uIGZvciB0aGUgdmVydGV4IGJ1ZmZlclxuICAgIGNyZWF0ZVZlcnRleEJ1ZmZlckltcGwodmVydGV4QnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbFZlcnRleEJ1ZmZlcigpO1xuICAgIH1cblxuICAgIC8vIHByb3ZpZGUgd2ViZ2wgaW1wbGVtZW50YXRpb24gZm9yIHRoZSBpbmRleCBidWZmZXJcbiAgICBjcmVhdGVJbmRleEJ1ZmZlckltcGwoaW5kZXhCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbEluZGV4QnVmZmVyKGluZGV4QnVmZmVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVTaGFkZXJJbXBsKHNoYWRlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsU2hhZGVyKHNoYWRlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZUltcGwodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsVGV4dHVyZSgpO1xuICAgIH1cblxuICAgIGNyZWF0ZVJlbmRlclRhcmdldEltcGwocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xSZW5kZXJUYXJnZXQoKTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgdXBkYXRlTWFya2VyKCkge1xuICAgICAgICB0aGlzLl9zcGVjdG9yQ3VycmVudE1hcmtlciA9IHRoaXMuX3NwZWN0b3JNYXJrZXJzLmpvaW4oXCIgfCBcIikgKyBcIiAjIFwiO1xuICAgIH1cblxuICAgIHB1c2hNYXJrZXIobmFtZSkge1xuICAgICAgICBpZiAod2luZG93LnNwZWN0b3IpIHtcbiAgICAgICAgICAgIHRoaXMuX3NwZWN0b3JNYXJrZXJzLnB1c2gobmFtZSk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZU1hcmtlcigpO1xuICAgICAgICAgICAgd2luZG93LnNwZWN0b3Iuc2V0TWFya2VyKHRoaXMuX3NwZWN0b3JDdXJyZW50TWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBvcE1hcmtlcigpIHtcbiAgICAgICAgaWYgKHdpbmRvdy5zcGVjdG9yKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3BlY3Rvck1hcmtlcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3BlY3Rvck1hcmtlcnMucG9wKCk7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNYXJrZXIoKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zcGVjdG9yTWFya2Vycy5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zcGVjdG9yLnNldE1hcmtlcih0aGlzLl9zcGVjdG9yQ3VycmVudE1hcmtlcik7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuc3BlY3Rvci5jbGVhck1hcmtlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vICNlbmRpZlxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIHByZWNpc2lvbiBzdXBwb3J0ZWQgYnkgaW50cyBhbmQgZmxvYXRzIGluIHZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycy4gTm90ZSB0aGF0XG4gICAgICogZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0IGlzIG5vdCBndWFyYW50ZWVkIHRvIGJlIHByZXNlbnQgKHN1Y2ggYXMgc29tZSBpbnN0YW5jZXMgb2YgdGhlXG4gICAgICogZGVmYXVsdCBBbmRyb2lkIGJyb3dzZXIpLiBJbiB0aGlzIGNhc2UsIGFzc3VtZSBoaWdocCBpcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBcImhpZ2hwXCIsIFwibWVkaXVtcFwiIG9yIFwibG93cFwiXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldFByZWNpc2lvbigpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBsZXQgcHJlY2lzaW9uID0gXCJoaWdocFwiO1xuXG4gICAgICAgIGlmIChnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuVkVSVEVYX1NIQURFUiwgZ2wuSElHSF9GTE9BVCk7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuVkVSVEVYX1NIQURFUiwgZ2wuTUVESVVNX0ZMT0FUKTtcblxuICAgICAgICAgICAgY29uc3QgZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLkZSQUdNRU5UX1NIQURFUiwgZ2wuSElHSF9GTE9BVCk7XG4gICAgICAgICAgICBjb25zdCBmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5GUkFHTUVOVF9TSEFERVIsIGdsLk1FRElVTV9GTE9BVCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGhpZ2hwQXZhaWxhYmxlID0gdmVydGV4U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdC5wcmVjaXNpb24gPiAwICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdC5wcmVjaXNpb24gPiAwO1xuICAgICAgICAgICAgY29uc3QgbWVkaXVtcEF2YWlsYWJsZSA9IHZlcnRleFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdC5wcmVjaXNpb24gPiAwICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0LnByZWNpc2lvbiA+IDA7XG5cbiAgICAgICAgICAgIGlmICghaGlnaHBBdmFpbGFibGUpIHtcbiAgICAgICAgICAgICAgICBpZiAobWVkaXVtcEF2YWlsYWJsZSkge1xuICAgICAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSBcIm1lZGl1bXBcIjtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2FybihcIldBUk5JTkc6IGhpZ2hwIG5vdCBzdXBwb3J0ZWQsIHVzaW5nIG1lZGl1bXBcIik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gXCJsb3dwXCI7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJXQVJOSU5HOiBoaWdocCBhbmQgbWVkaXVtcCBub3Qgc3VwcG9ydGVkLCB1c2luZyBsb3dwXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcmVjaXNpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgZXh0ZW5zaW9ucyBwcm92aWRlZCBieSB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplRXh0ZW5zaW9ucygpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBjb25zdCBzdXBwb3J0ZWRFeHRlbnNpb25zID0gZ2wuZ2V0U3VwcG9ydGVkRXh0ZW5zaW9ucygpO1xuXG4gICAgICAgIGNvbnN0IGdldEV4dGVuc2lvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN1cHBvcnRlZEV4dGVuc2lvbnMuaW5kZXhPZihhcmd1bWVudHNbaV0pICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2wuZ2V0RXh0ZW5zaW9uKGFyZ3VtZW50c1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRJbnN0YW5jaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlTG9kID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRWZXJ0ZXhBcnJheU9iamVjdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dENvbG9yQnVmZmVyRmxvYXQgPSBnZXRFeHRlbnNpb24oJ0VYVF9jb2xvcl9idWZmZXJfZmxvYXQnKTtcbiAgICAgICAgICAgIC8vIE5vdGUgdGhhdCBGaXJlZm94IGV4cG9zZXMgRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5IHVuZGVyIFdlYkdMMiByYXRoZXIgdGhhblxuICAgICAgICAgICAgLy8gRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5X3dlYmdsMlxuICAgICAgICAgICAgdGhpcy5leHREaXNqb2ludFRpbWVyUXVlcnkgPSBnZXRFeHRlbnNpb24oJ0VYVF9kaXNqb2ludF90aW1lcl9xdWVyeV93ZWJnbDInLCAnRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5Jyk7XG4gICAgICAgICAgICB0aGlzLmV4dERlcHRoVGV4dHVyZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gZ2V0RXh0ZW5zaW9uKFwiRVhUX2JsZW5kX21pbm1heFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSBnZXRFeHRlbnNpb24oJ0VYVF9kcmF3X2J1ZmZlcnMnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0SW5zdGFuY2luZyA9IGdldEV4dGVuc2lvbihcIkFOR0xFX2luc3RhbmNlZF9hcnJheXNcIik7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zdGFsbCB0aGUgV2ViR0wgMiBJbnN0YW5jaW5nIEFQSSBmb3IgV2ViR0wgMS4wXG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ID0gdGhpcy5leHRJbnN0YW5jaW5nO1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQgPSBleHQuZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQgPSBleHQuZHJhd0VsZW1lbnRzSW5zdGFuY2VkQU5HTEUuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLnZlcnRleEF0dHJpYkRpdmlzb3IgPSBleHQudmVydGV4QXR0cmliRGl2aXNvckFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzID0gZ2V0RXh0ZW5zaW9uKFwiT0VTX3N0YW5kYXJkX2Rlcml2YXRpdmVzXCIpO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXQgPSBnZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9mbG9hdFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCA9IGdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2hhbGZfZmxvYXRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSBnZXRFeHRlbnNpb24oJ0VYVF9zaGFkZXJfdGV4dHVyZV9sb2QnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSBnZXRFeHRlbnNpb24oXCJPRVNfZWxlbWVudF9pbmRleF91aW50XCIpO1xuICAgICAgICAgICAgdGhpcy5leHRWZXJ0ZXhBcnJheU9iamVjdCA9IGdldEV4dGVuc2lvbihcIk9FU192ZXJ0ZXhfYXJyYXlfb2JqZWN0XCIpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAvLyBJbnN0YWxsIHRoZSBXZWJHTCAyIFZBTyBBUEkgZm9yIFdlYkdMIDEuMFxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3Q7XG4gICAgICAgICAgICAgICAgZ2wuY3JlYXRlVmVydGV4QXJyYXkgPSBleHQuY3JlYXRlVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5ID0gZXh0LmRlbGV0ZVZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5pc1ZlcnRleEFycmF5ID0gZXh0LmlzVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSA9IGV4dC5iaW5kVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGlzam9pbnRUaW1lclF1ZXJ5ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGVwdGhUZXh0dXJlID0gZ2wuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZXB0aF90ZXh0dXJlJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4dERlYnVnUmVuZGVyZXJJbmZvID0gZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZWJ1Z19yZW5kZXJlcl9pbmZvJyk7XG4gICAgICAgIHRoaXMuZXh0VGV4dHVyZUZsb2F0TGluZWFyID0gZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfZmxvYXRfbGluZWFyXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIgPSBnZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9oYWxmX2Zsb2F0X2xpbmVhclwiKTtcbiAgICAgICAgdGhpcy5leHRGbG9hdEJsZW5kID0gZ2V0RXh0ZW5zaW9uKFwiRVhUX2Zsb2F0X2JsZW5kXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYyA9IGdldEV4dGVuc2lvbignRVhUX3RleHR1cmVfZmlsdGVyX2FuaXNvdHJvcGljJywgJ1dFQktJVF9FWFRfdGV4dHVyZV9maWx0ZXJfYW5pc290cm9waWMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUVUQzEgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMxJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDID0gZ2V0RXh0ZW5zaW9uKCdXRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfcHZydGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9wdnJ0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyA9IGdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3MzdGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9zM3RjJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hdGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUFTVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hc3RjJyk7XG4gICAgICAgIHRoaXMuZXh0UGFyYWxsZWxTaGFkZXJDb21waWxlID0gZ2V0RXh0ZW5zaW9uKCdLSFJfcGFyYWxsZWxfc2hhZGVyX2NvbXBpbGUnKTtcblxuICAgICAgICAvLyBpT1MgZXhwb3NlcyB0aGlzIGZvciBoYWxmIHByZWNpc2lvbiByZW5kZXIgdGFyZ2V0cyBvbiBib3RoIFdlYmdsMSBhbmQgMiBmcm9tIGlPUyB2IDE0LjViZXRhXG4gICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQgPSBnZXRFeHRlbnNpb24oXCJFWFRfY29sb3JfYnVmZmVyX2hhbGZfZmxvYXRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIGNhcGFiaWxpdGllcyBvZiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplQ2FwYWJpbGl0aWVzKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCBleHQ7XG5cbiAgICAgICAgY29uc3QgdXNlckFnZW50ID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgPyBuYXZpZ2F0b3IudXNlckFnZW50IDogXCJcIjtcblxuICAgICAgICB0aGlzLm1heFByZWNpc2lvbiA9IHRoaXMucHJlY2lzaW9uID0gdGhpcy5nZXRQcmVjaXNpb24oKTtcblxuICAgICAgICBjb25zdCBjb250ZXh0QXR0cmlicyA9IGdsLmdldENvbnRleHRBdHRyaWJ1dGVzKCk7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNc2FhID0gY29udGV4dEF0dHJpYnMuYW50aWFsaWFzO1xuICAgICAgICB0aGlzLnN1cHBvcnRzU3RlbmNpbCA9IGNvbnRleHRBdHRyaWJzLnN0ZW5jaWw7XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0luc3RhbmNpbmcgPSAhIXRoaXMuZXh0SW5zdGFuY2luZztcblxuICAgICAgICAvLyBRdWVyeSBwYXJhbWV0ZXIgdmFsdWVzIGZyb20gdGhlIFdlYkdMIGNvbnRleHRcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhDdWJlTWFwU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhSZW5kZXJCdWZmZXJTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9SRU5ERVJCVUZGRVJfU0laRSk7XG4gICAgICAgIHRoaXMubWF4VGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heENvbWJpbmVkVGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heFZlcnRleFRleHR1cmVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9WRVJURVhfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMudmVydGV4VW5pZm9ybXNDb3VudCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRVbmlmb3Jtc0NvdW50ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMpO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMubWF4RHJhd0J1ZmZlcnMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0RSQVdfQlVGRkVSUyk7XG4gICAgICAgICAgICB0aGlzLm1heENvbG9yQXR0YWNobWVudHMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTE9SX0FUVEFDSE1FTlRTKTtcbiAgICAgICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfM0RfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dCA9IHRoaXMuZXh0RHJhd0J1ZmZlcnM7XG4gICAgICAgICAgICB0aGlzLm1heERyYXdCdWZmZXJzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfRFJBV19CVUZGRVJTX0VYVCkgOiAxO1xuICAgICAgICAgICAgdGhpcy5tYXhDb2xvckF0dGFjaG1lbnRzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfQ09MT1JfQVRUQUNITUVOVFNfRVhUKSA6IDE7XG4gICAgICAgICAgICB0aGlzLm1heFZvbHVtZVNpemUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHREZWJ1Z1JlbmRlcmVySW5mbztcbiAgICAgICAgdGhpcy51bm1hc2tlZFJlbmRlcmVyID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5VTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCkgOiAnJztcbiAgICAgICAgdGhpcy51bm1hc2tlZFZlbmRvciA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuVU5NQVNLRURfVkVORE9SX1dFQkdMKSA6ICcnO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIHdlIHN1cHBvcnQgR1BVIHBhcnRpY2xlcy4gQXQgdGhlIG1vbWVudCwgU2Ftc3VuZyBkZXZpY2VzIHdpdGggRXh5bm9zIChBUk0pIGVpdGhlciBjcmFzaCBvciByZW5kZXJcbiAgICAgICAgLy8gaW5jb3JyZWN0bHkgd2hlbiB1c2luZyBHUFUgZm9yIHBhcnRpY2xlcy4gU2VlOlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGxheWNhbnZhcy9lbmdpbmUvaXNzdWVzLzM5NjdcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BsYXljYW52YXMvZW5naW5lL2lzc3Vlcy8zNDE1XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wbGF5Y2FudmFzL2VuZ2luZS9pc3N1ZXMvNDUxNFxuICAgICAgICAvLyBFeGFtcGxlIFVBIG1hdGNoZXM6IFN0YXJ0aW5nICdTTScgYW5kIGFueSBjb21iaW5hdGlvbiBvZiBsZXR0ZXJzIG9yIG51bWJlcnM6XG4gICAgICAgIC8vIE1vemlsbGEvNS4wIChMaW51eCwgQW5kcm9pZCAxMjsgU00tRzk3MEYgQnVpbGQvU1AxQS4yMTA4MTIuMDE2OyB3dilcbiAgICAgICAgLy8gTW96aWxsYS81LjAgKExpbnV4LCBBbmRyb2lkIDEyOyBTTS1HOTcwRilcbiAgICAgICAgY29uc3Qgc2Ftc3VuZ01vZGVsUmVnZXggPSAvU00tW2EtekEtWjAtOV0rLztcbiAgICAgICAgdGhpcy5zdXBwb3J0c0dwdVBhcnRpY2xlcyA9ICEodGhpcy51bm1hc2tlZFZlbmRvciA9PT0gJ0FSTScgJiYgdXNlckFnZW50Lm1hdGNoKHNhbXN1bmdNb2RlbFJlZ2V4KSk7XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWM7XG4gICAgICAgIHRoaXMubWF4QW5pc290cm9weSA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuTUFYX1RFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUKSA6IDE7XG5cbiAgICAgICAgdGhpcy5zYW1wbGVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLlNBTVBMRVMpO1xuICAgICAgICB0aGlzLm1heFNhbXBsZXMgPSB0aGlzLndlYmdsMiAmJiAhdGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nID8gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9TQU1QTEVTKSA6IDE7XG5cbiAgICAgICAgLy8gRG9uJ3QgYWxsb3cgYXJlYSBsaWdodHMgb24gb2xkIGFuZHJvaWQgZGV2aWNlcywgdGhleSBvZnRlbiBmYWlsIHRvIGNvbXBpbGUgdGhlIHNoYWRlciwgcnVuIGl0IGluY29ycmVjdGx5IG9yIGFyZSB2ZXJ5IHNsb3cuXG4gICAgICAgIHRoaXMuc3VwcG9ydHNBcmVhTGlnaHRzID0gdGhpcy53ZWJnbDIgfHwgIXBsYXRmb3JtLmFuZHJvaWQ7XG5cbiAgICAgICAgLy8gc3VwcG9ydHMgdGV4dHVyZSBmZXRjaCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnN1cHBvcnRzVGV4dHVyZUZldGNoID0gdGhpcy53ZWJnbDI7XG5cbiAgICAgICAgLy8gQWxzbyBkbyBub3QgYWxsb3cgdGhlbSB3aGVuIHdlIG9ubHkgaGF2ZSBzbWFsbCBudW1iZXIgb2YgdGV4dHVyZSB1bml0c1xuICAgICAgICBpZiAodGhpcy5tYXhUZXh0dXJlcyA8PSA4KSB7XG4gICAgICAgICAgICB0aGlzLnN1cHBvcnRzQXJlYUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBpbml0aWFsIHJlbmRlciBzdGF0ZSBvbiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplUmVuZGVyU3RhdGUoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHJlbmRlciBzdGF0ZSB0byBhIGtub3duIHN0YXJ0IHN0YXRlXG4gICAgICAgIHRoaXMuYmxlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG5cbiAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgIHRoaXMuYmxlbmREc3QgPSBCTEVORE1PREVfWkVSTztcbiAgICAgICAgdGhpcy5ibGVuZFNyY0FscGhhID0gQkxFTkRNT0RFX09ORTtcbiAgICAgICAgdGhpcy5ibGVuZERzdEFscGhhID0gQkxFTkRNT0RFX1pFUk87XG4gICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUJsZW5kID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYmxlbmRFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICB0aGlzLmJsZW5kQWxwaGFFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICB0aGlzLnNlcGFyYXRlQWxwaGFFcXVhdGlvbiA9IGZhbHNlO1xuICAgICAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5aRVJPKTtcbiAgICAgICAgZ2wuYmxlbmRFcXVhdGlvbihnbC5GVU5DX0FERCk7XG5cbiAgICAgICAgdGhpcy5ibGVuZENvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDApO1xuICAgICAgICBnbC5ibGVuZENvbG9yKDAsIDAsIDAsIDApO1xuXG4gICAgICAgIHRoaXMud3JpdGVSZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlR3JlZW4gPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlQmx1ZSA9IHRydWU7XG4gICAgICAgIHRoaXMud3JpdGVBbHBoYSA9IHRydWU7XG4gICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuICAgICAgICB0aGlzLmN1bGxNb2RlID0gQ1VMTEZBQ0VfQkFDSztcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkNVTExfRkFDRSk7XG4gICAgICAgIGdsLmN1bGxGYWNlKGdsLkJBQ0spO1xuXG4gICAgICAgIHRoaXMuZGVwdGhUZXN0ID0gdHJ1ZTtcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuXG4gICAgICAgIHRoaXMuZGVwdGhGdW5jID0gRlVOQ19MRVNTRVFVQUw7XG4gICAgICAgIGdsLmRlcHRoRnVuYyhnbC5MRVFVQUwpO1xuXG4gICAgICAgIHRoaXMuZGVwdGhXcml0ZSA9IHRydWU7XG4gICAgICAgIGdsLmRlcHRoTWFzayh0cnVlKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWwgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuXG4gICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IHRoaXMuc3RlbmNpbEZ1bmNCYWNrID0gRlVOQ19BTFdBWVM7XG4gICAgICAgIHRoaXMuc3RlbmNpbFJlZkZyb250ID0gdGhpcy5zdGVuY2lsUmVmQmFjayA9IDA7XG4gICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IHRoaXMuc3RlbmNpbE1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbEZ1bmMoZ2wuQUxXQVlTLCAwLCAweEZGKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IFNURU5DSUxPUF9LRUVQO1xuICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gU1RFTkNJTE9QX0tFRVA7XG4gICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSBTVEVOQ0lMT1BfS0VFUDtcbiAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgPSAweEZGO1xuICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbE9wKGdsLktFRVAsIGdsLktFRVAsIGdsLktFRVApO1xuICAgICAgICBnbC5zdGVuY2lsTWFzaygweEZGKTtcblxuICAgICAgICB0aGlzLmFscGhhVG9Db3ZlcmFnZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnJhc3RlciA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5TQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UpO1xuICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5SQVNURVJJWkVSX0RJU0NBUkQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kZXB0aEJpYXNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIGdsLmRpc2FibGUoZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XG5cbiAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gMTtcbiAgICAgICAgZ2wuY2xlYXJEZXB0aCgxKTtcblxuICAgICAgICB0aGlzLmNsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMCk7XG4gICAgICAgIGdsLmNsZWFyQ29sb3IoMCwgMCwgMCwgMCk7XG5cbiAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWwgPSAwO1xuICAgICAgICBnbC5jbGVhclN0ZW5jaWwoMCk7XG5cbiAgICAgICAgLy8gQ2FjaGVkIHZpZXdwb3J0IGFuZCBzY2lzc29yIGRpbWVuc2lvbnNcbiAgICAgICAgdGhpcy52eCA9IHRoaXMudnkgPSB0aGlzLnZ3ID0gdGhpcy52aCA9IDA7XG4gICAgICAgIHRoaXMuc3ggPSB0aGlzLnN5ID0gdGhpcy5zdyA9IHRoaXMuc2ggPSAwO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgZ2wuaGludChnbC5GUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5ULCBnbC5OSUNFU1QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykge1xuICAgICAgICAgICAgICAgIGdsLmhpbnQodGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzLkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlRfT0VTLCBnbC5OSUNFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZ2wuZW5hYmxlKGdsLlNDSVNTT1JfVEVTVCk7XG5cbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTl9XRUJHTCwgZ2wuTk9ORSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZhbHNlO1xuICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gZmFsc2U7XG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgZmFsc2UpO1xuXG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19BTElHTk1FTlQsIDEpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCkge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuXG4gICAgICAgIC8vIFNoYWRlciBjb2RlIHRvIFdlYkdMIHNoYWRlciBjYWNoZVxuICAgICAgICB0aGlzLnZlcnRleFNoYWRlckNhY2hlID0ge307XG4gICAgICAgIHRoaXMuZnJhZ21lbnRTaGFkZXJDYWNoZSA9IHt9O1xuXG4gICAgICAgIC8vIGNhY2hlIG9mIFZBT3NcbiAgICAgICAgdGhpcy5fdmFvTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuICAgICAgICB0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5mZWVkYmFjayA9IG51bGw7XG4gICAgICAgIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudGV4dHVyZVVuaXQgPSAwO1xuICAgICAgICB0aGlzLnRleHR1cmVVbml0cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWF4Q29tYmluZWRUZXh0dXJlczsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0cy5wdXNoKFtudWxsLCBudWxsLCBudWxsXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgV2ViR0wgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIC8vIHJlbGVhc2Ugc2hhZGVyc1xuICAgICAgICBmb3IgKGNvbnN0IHNoYWRlciBvZiB0aGlzLnNoYWRlcnMpIHtcbiAgICAgICAgICAgIHNoYWRlci5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGNvbnN0IHRleHR1cmUgb2YgdGhpcy50ZXh0dXJlcykge1xuICAgICAgICAgICAgdGV4dHVyZS5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB2ZXJ0ZXggYW5kIGluZGV4IGJ1ZmZlcnNcbiAgICAgICAgZm9yIChjb25zdCBidWZmZXIgb2YgdGhpcy5idWZmZXJzKSB7XG4gICAgICAgICAgICBidWZmZXIubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc2V0IGFsbCByZW5kZXIgdGFyZ2V0cyBzbyB0aGV5J2xsIGJlIHJlY3JlYXRlZCBhcyByZXF1aXJlZC5cbiAgICAgICAgLy8gVE9ETzogYSBzb2x1dGlvbiBmb3IgdGhlIGNhc2Ugd2hlcmUgYSByZW5kZXIgdGFyZ2V0IGNvbnRhaW5zIHNvbWV0aGluZ1xuICAgICAgICAvLyB0aGF0IHdhcyBwcmV2aW91c2x5IGdlbmVyYXRlZCB0aGF0IG5lZWRzIHRvIGJlIHJlLXJlbmRlcmVkLlxuICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldHMpIHtcbiAgICAgICAgICAgIHRhcmdldC5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgaXMgcmVzdG9yZWQuIEl0IHJlaW5pdGlhbGl6ZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVzdG9yZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ2FwYWJpbGl0aWVzKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKTtcblxuICAgICAgICAvLyBSZWNvbXBpbGUgYWxsIHNoYWRlcnMgKHRoZXknbGwgYmUgbGlua2VkIHdoZW4gdGhleSdyZSBuZXh0IGFjdHVhbGx5IHVzZWQpXG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyIG9mIHRoaXMuc2hhZGVycykge1xuICAgICAgICAgICAgc2hhZGVyLnJlc3RvcmVDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNyZWF0ZSBidWZmZXIgb2JqZWN0cyBhbmQgcmV1cGxvYWQgYnVmZmVyIGRhdGEgdG8gdGhlIEdQVVxuICAgICAgICBmb3IgKGNvbnN0IGJ1ZmZlciBvZiB0aGlzLmJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIGJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgYWN0aXZlIHJlY3RhbmdsZSBmb3IgcmVuZGVyaW5nIG9uIHRoZSBzcGVjaWZpZWQgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgcGl4ZWwgc3BhY2UgeC1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHZpZXdwb3J0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHBpeGVsIHNwYWNlIHktY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSB2aWV3cG9ydC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3aWR0aCBvZiB0aGUgdmlld3BvcnQgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIGhlaWdodCBvZiB0aGUgdmlld3BvcnQgaW4gcGl4ZWxzLlxuICAgICAqL1xuICAgIHNldFZpZXdwb3J0KHgsIHksIHcsIGgpIHtcbiAgICAgICAgaWYgKCh0aGlzLnZ4ICE9PSB4KSB8fCAodGhpcy52eSAhPT0geSkgfHwgKHRoaXMudncgIT09IHcpIHx8ICh0aGlzLnZoICE9PSBoKSkge1xuICAgICAgICAgICAgdGhpcy5nbC52aWV3cG9ydCh4LCB5LCB3LCBoKTtcbiAgICAgICAgICAgIHRoaXMudnggPSB4O1xuICAgICAgICAgICAgdGhpcy52eSA9IHk7XG4gICAgICAgICAgICB0aGlzLnZ3ID0gdztcbiAgICAgICAgICAgIHRoaXMudmggPSBoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBhY3RpdmUgc2Npc3NvciByZWN0YW5nbGUgb24gdGhlIHNwZWNpZmllZCBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSBwaXhlbCBzcGFjZSB4LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgcGl4ZWwgc3BhY2UgeS1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZSBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZSBpbiBwaXhlbHMuXG4gICAgICovXG4gICAgc2V0U2Npc3Nvcih4LCB5LCB3LCBoKSB7XG4gICAgICAgIGlmICgodGhpcy5zeCAhPT0geCkgfHwgKHRoaXMuc3kgIT09IHkpIHx8ICh0aGlzLnN3ICE9PSB3KSB8fCAodGhpcy5zaCAhPT0gaCkpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc2Npc3Nvcih4LCB5LCB3LCBoKTtcbiAgICAgICAgICAgIHRoaXMuc3ggPSB4O1xuICAgICAgICAgICAgdGhpcy5zeSA9IHk7XG4gICAgICAgICAgICB0aGlzLnN3ID0gdztcbiAgICAgICAgICAgIHRoaXMuc2ggPSBoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQmluZHMgdGhlIHNwZWNpZmllZCBmcmFtZWJ1ZmZlciBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1dlYkdMRnJhbWVidWZmZXIgfCBudWxsfSBmYiAtIFRoZSBmcmFtZWJ1ZmZlciB0byBiaW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRGcmFtZWJ1ZmZlcihmYikge1xuICAgICAgICBpZiAodGhpcy5hY3RpdmVGcmFtZWJ1ZmZlciAhPT0gZmIpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZmIpO1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVGcmFtZWJ1ZmZlciA9IGZiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHNvdXJjZSByZW5kZXIgdGFyZ2V0IGludG8gZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldC4gTW9zdGx5IHVzZWQgYnkgcG9zdC1lZmZlY3RzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtzb3VyY2VdIC0gVGhlIHNvdXJjZSByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtkZXN0XSAtIFRoZSBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvcHkgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBjb3B5UmVuZGVyVGFyZ2V0KHNvdXJjZSwgZGVzdCwgY29sb3IsIGRlcHRoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICBpZiAoIXRoaXMud2ViZ2wyICYmIGRlcHRoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkRlcHRoIGlzIG5vdCBjb3B5YWJsZSBvbiBXZWJHTCAxLjBcIik7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgICAgICBpZiAoIWRlc3QpIHtcbiAgICAgICAgICAgICAgICAvLyBjb3B5aW5nIHRvIGJhY2tidWZmZXJcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fY29sb3JCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IGVtcHR5IGNvbG9yIGJ1ZmZlciB0byBiYWNrYnVmZmVyXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAvLyBjb3B5aW5nIHRvIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fY29sb3JCdWZmZXIgfHwgIWRlc3QuX2NvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBjb2xvciBidWZmZXIsIGJlY2F1c2Ugb25lIG9mIHRoZSByZW5kZXIgdGFyZ2V0cyBkb2Vzbid0IGhhdmUgaXRcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZS5fY29sb3JCdWZmZXIuX2Zvcm1hdCAhPT0gZGVzdC5fY29sb3JCdWZmZXIuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgcmVuZGVyIHRhcmdldHMgb2YgZGlmZmVyZW50IGNvbG9yIGZvcm1hdHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlcHRoICYmIHNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2RlcHRoKSB7ICAgLy8gd2hlbiBkZXB0aCBpcyBhdXRvbWF0aWMsIHdlIGNhbm5vdCB0ZXN0IHRoZSBidWZmZXIgbm9yIGl0cyBmb3JtYXRcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fZGVwdGhCdWZmZXIgfHwgIWRlc3QuX2RlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBkZXB0aCBidWZmZXIsIGJlY2F1c2Ugb25lIG9mIHRoZSByZW5kZXIgdGFyZ2V0cyBkb2Vzbid0IGhhdmUgaXRcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZS5fZGVwdGhCdWZmZXIuX2Zvcm1hdCAhPT0gZGVzdC5fZGVwdGhCdWZmZXIuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgcmVuZGVyIHRhcmdldHMgb2YgZGlmZmVyZW50IGRlcHRoIGZvcm1hdHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ0NPUFktUlQnKTtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgZGVzdCkge1xuICAgICAgICAgICAgY29uc3QgcHJldlJ0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IGRlc3Q7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUJlZ2luKCk7XG4gICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuUkVBRF9GUkFNRUJVRkZFUiwgc291cmNlID8gc291cmNlLmltcGwuX2dsRnJhbWVCdWZmZXIgOiBudWxsKTtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5EUkFXX0ZSQU1FQlVGRkVSLCBkZXN0LmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuICAgICAgICAgICAgY29uc3QgdyA9IHNvdXJjZSA/IHNvdXJjZS53aWR0aCA6IGRlc3Qud2lkdGg7XG4gICAgICAgICAgICBjb25zdCBoID0gc291cmNlID8gc291cmNlLmhlaWdodCA6IGRlc3QuaGVpZ2h0O1xuICAgICAgICAgICAgZ2wuYmxpdEZyYW1lYnVmZmVyKDAsIDAsIHcsIGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwgMCwgdywgaCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY29sb3IgPyBnbC5DT0xPUl9CVUZGRVJfQklUIDogMCkgfCAoZGVwdGggPyBnbC5ERVBUSF9CVUZGRVJfQklUIDogMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuTkVBUkVTVCk7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHByZXZSdDtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgcHJldlJ0ID8gcHJldlJ0LmltcGwuX2dsRnJhbWVCdWZmZXIgOiBudWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuZ2V0Q29weVNoYWRlcigpO1xuICAgICAgICAgICAgdGhpcy5jb25zdGFudFRleFNvdXJjZS5zZXRWYWx1ZShzb3VyY2UuX2NvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcih0aGlzLCBkZXN0LCBzaGFkZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGNvcHkgc2hhZGVyIGZvciBlZmZpY2llbnQgcmVuZGVyaW5nIG9mIGZ1bGxzY3JlZW4tcXVhZCB3aXRoIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U2hhZGVyfSBUaGUgY29weSBzaGFkZXIgKGJhc2VkIG9uIGBmdWxsc2NyZWVuUXVhZFZTYCBhbmQgYG91dHB1dFRleDJEUFNgIGluXG4gICAgICogYHNoYWRlckNodW5rc2ApLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRDb3B5U2hhZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2NvcHlTaGFkZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvcHlTaGFkZXIgPSBuZXcgU2hhZGVyKHRoaXMsIFNoYWRlclV0aWxzLmNyZWF0ZURlZmluaXRpb24odGhpcywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdvdXRwdXRUZXgyRCcsXG4gICAgICAgICAgICAgICAgdmVydGV4Q29kZTogX2Z1bGxTY3JlZW5RdWFkVlMsXG4gICAgICAgICAgICAgICAgZnJhZ21lbnRDb2RlOiBfb3V0cHV0VGV4dHVyZTJEXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvcHlTaGFkZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgYSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9yZW5kZXItcGFzcy5qcycpLlJlbmRlclBhc3N9IHJlbmRlclBhc3MgLSBUaGUgcmVuZGVyIHBhc3MgdG8gc3RhcnQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXJ0UGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBTVEFSVC1QQVNTYCk7XG5cbiAgICAgICAgLy8gc2V0IHVwIHJlbmRlciB0YXJnZXRcbiAgICAgICAgdGhpcy5zZXRSZW5kZXJUYXJnZXQocmVuZGVyUGFzcy5yZW5kZXJUYXJnZXQpO1xuICAgICAgICB0aGlzLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICAgICAgLy8gY2xlYXIgdGhlIHJlbmRlciB0YXJnZXRcbiAgICAgICAgY29uc3QgY29sb3JPcHMgPSByZW5kZXJQYXNzLmNvbG9yT3BzO1xuICAgICAgICBjb25zdCBkZXB0aFN0ZW5jaWxPcHMgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcztcbiAgICAgICAgaWYgKGNvbG9yT3BzLmNsZWFyIHx8IGRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoIHx8IGRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWwpIHtcblxuICAgICAgICAgICAgLy8gdGhlIHBhc3MgYWx3YXlzIGNsZWFycyBmdWxsIHRhcmdldFxuICAgICAgICAgICAgY29uc3QgcnQgPSByZW5kZXJQYXNzLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIGNvbnN0IHdpZHRoID0gcnQgPyBydC53aWR0aCA6IHRoaXMud2lkdGg7XG4gICAgICAgICAgICBjb25zdCBoZWlnaHQgPSBydCA/IHJ0LmhlaWdodCA6IHRoaXMuaGVpZ2h0O1xuICAgICAgICAgICAgdGhpcy5zZXRWaWV3cG9ydCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgICAgIHRoaXMuc2V0U2Npc3NvcigwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblxuICAgICAgICAgICAgbGV0IGNsZWFyRmxhZ3MgPSAwO1xuICAgICAgICAgICAgY29uc3QgY2xlYXJPcHRpb25zID0ge307XG5cbiAgICAgICAgICAgIGlmIChjb2xvck9wcy5jbGVhcikge1xuICAgICAgICAgICAgICAgIGNsZWFyRmxhZ3MgfD0gQ0xFQVJGTEFHX0NPTE9SO1xuICAgICAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5jb2xvciA9IFtjb2xvck9wcy5jbGVhclZhbHVlLnIsIGNvbG9yT3BzLmNsZWFyVmFsdWUuZywgY29sb3JPcHMuY2xlYXJWYWx1ZS5iLCBjb2xvck9wcy5jbGVhclZhbHVlLmFdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGgpIHtcbiAgICAgICAgICAgICAgICBjbGVhckZsYWdzIHw9IENMRUFSRkxBR19ERVBUSDtcbiAgICAgICAgICAgICAgICBjbGVhck9wdGlvbnMuZGVwdGggPSBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aFZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgIGNsZWFyRmxhZ3MgfD0gQ0xFQVJGTEFHX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgY2xlYXJPcHRpb25zLnN0ZW5jaWwgPSBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsVmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIGl0XG4gICAgICAgICAgICBjbGVhck9wdGlvbnMuZmxhZ3MgPSBjbGVhckZsYWdzO1xuICAgICAgICAgICAgdGhpcy5jbGVhcihjbGVhck9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLmluc2lkZVJlbmRlclBhc3MpO1xuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSB0cnVlO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuZCBhIHJlbmRlciBwYXNzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBlbmQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGVuZFBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgRU5ELVBBU1NgKTtcblxuICAgICAgICB0aGlzLnVuYmluZFZlcnRleEFycmF5KCk7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGlmICh0YXJnZXQpIHtcblxuICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSBidWZmZXJzIHRvIHN0b3AgdGhlbSBiZWluZyB3cml0dGVuIHRvIG9uIHRpbGVkIGFyY2hpdGV4dHVyZXNcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgICAgIC8vIGludmFsaWRhdGUgY29sb3Igb25seSBpZiB3ZSBkb24ndCBuZWVkIHRvIHJlc29sdmUgaXRcbiAgICAgICAgICAgICAgICBpZiAoIShyZW5kZXJQYXNzLmNvbG9yT3BzLnN0b3JlIHx8IHJlbmRlclBhc3MuY29sb3JPcHMucmVzb2x2ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuQ09MT1JfQVRUQUNITUVOVDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuREVQVEhfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5wdXNoKGdsLlNURU5DSUxfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGludmFsaWRhdGVBdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSB0aGUgd2hvbGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IHdlIGNvdWxkIGhhbmRsZSB2aWV3cG9ydCBpbnZhbGlkYXRpb24gYXMgd2VsbFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuaW52YWxpZGF0ZUZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIGludmFsaWRhdGVBdHRhY2htZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlc29sdmUgdGhlIGNvbG9yIGJ1ZmZlclxuICAgICAgICAgICAgaWYgKHJlbmRlclBhc3MuY29sb3JPcHMucmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiByZW5kZXJQYXNzLnNhbXBsZXMgPiAxICYmIHRhcmdldC5hdXRvUmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSh0cnVlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSBtaXBtYXBzXG4gICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5jb2xvck9wcy5taXBtYXBzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSB0YXJnZXQuX2NvbG9yQnVmZmVyO1xuICAgICAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYmluZFRleHR1cmUoY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmdlbmVyYXRlTWlwbWFwKGNvbG9yQnVmZmVyLmltcGwuX2dsVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrcyB0aGUgYmVnaW5uaW5nIG9mIGEgYmxvY2sgb2YgcmVuZGVyaW5nLiBJbnRlcm5hbGx5LCB0aGlzIGZ1bmN0aW9uIGJpbmRzIHRoZSByZW5kZXJcbiAgICAgKiB0YXJnZXQgY3VycmVudGx5IHNldCBvbiB0aGUgZGV2aWNlLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBtYXRjaGVkIHdpdGggYSBjYWxsIHRvXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0uIENhbGxzIHRvIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVCZWdpbn0gYW5kXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0gbXVzdCBub3QgYmUgbmVzdGVkLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUJlZ2luKCkge1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ1VQREFURS1CRUdJTicpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuXG4gICAgICAgIC8vIGNsZWFyIHRleHR1cmUgdW5pdHMgb25jZSBhIGZyYW1lIG9uIGRlc2t0b3Agc2FmYXJpXG4gICAgICAgIGlmICh0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kKSB7XG4gICAgICAgICAgICBmb3IgKGxldCB1bml0ID0gMDsgdW5pdCA8IHRoaXMudGV4dHVyZVVuaXRzLmxlbmd0aDsgKyt1bml0KSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgc2xvdCA9IDA7IHNsb3QgPCAzOyArK3Nsb3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlVW5pdHNbdW5pdF1bc2xvdF0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IFdlYkdMIGZyYW1lIGJ1ZmZlciBvYmplY3RcbiAgICAgICAgICAgIGlmICghdGFyZ2V0LmltcGwuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQodGFyZ2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRGcmFtZWJ1ZmZlcih0YXJnZXQuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldEZyYW1lYnVmZmVyKHRoaXMuZGVmYXVsdEZyYW1lYnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBlbmQgb2YgYSBibG9jayBvZiByZW5kZXJpbmcuIFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNhbGxlZCBhZnRlciBhIG1hdGNoaW5nIGNhbGxcbiAgICAgKiB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59LiBDYWxscyB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59IGFuZFxuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVFbmR9IG11c3Qgbm90IGJlIG5lc3RlZC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVFbmQoKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBVUERBVEUtRU5EYCk7XG5cbiAgICAgICAgdGhpcy51bmJpbmRWZXJ0ZXhBcnJheSgpO1xuXG4gICAgICAgIC8vIFVuc2V0IHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgICAvLyBSZXNvbHZlIE1TQUEgaWYgbmVlZGVkXG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGFyZ2V0Ll9zYW1wbGVzID4gMSAmJiB0YXJnZXQuYXV0b1Jlc29sdmUpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgYWN0aXZlIHJlbmRlciB0YXJnZXQgaXMgYXV0by1taXBtYXBwZWQsIGdlbmVyYXRlIGl0cyBtaXAgY2hhaW5cbiAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGFyZ2V0Ll9jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgIC8vIEZJWE1FOiBpZiBjb2xvckJ1ZmZlciBpcyBhIGN1YmVtYXAgY3VycmVudGx5IHdlJ3JlIHJlLWdlbmVyYXRpbmcgbWlwbWFwcyBhZnRlclxuICAgICAgICAgICAgICAgIC8vIHVwZGF0aW5nIGVhY2ggZmFjZSFcbiAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZShjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5nbC5nZW5lcmF0ZU1pcG1hcChjb2xvckJ1ZmZlci5pbXBsLl9nbFRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSdzIHZlcnRpY2FsIGZsaXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZsaXBZIC0gVHJ1ZSB0byBmbGlwIHRoZSB0ZXh0dXJlIHZlcnRpY2FsbHkuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFVucGFja0ZsaXBZKGZsaXBZKSB7XG4gICAgICAgIGlmICh0aGlzLnVucGFja0ZsaXBZICE9PSBmbGlwWSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZsaXBZO1xuXG4gICAgICAgICAgICAvLyBOb3RlOiB0aGUgV2ViR0wgc3BlYyBzdGF0ZXMgdGhhdCBVTlBBQ0tfRkxJUF9ZX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmbGlwWSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSB0byBoYXZlIGl0cyBSR0IgY2hhbm5lbHMgcHJlbXVsdGlwbGllZCBieSBpdHMgYWxwaGEgY2hhbm5lbCBvciBub3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByZW11bHRpcGx5QWxwaGEgLSBUcnVlIHRvIHByZW11bHRpcGx5IHRoZSBhbHBoYSBjaGFubmVsIGFnYWluc3QgdGhlIFJHQlxuICAgICAqIGNoYW5uZWxzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgaWYgKHRoaXMudW5wYWNrUHJlbXVsdGlwbHlBbHBoYSAhPT0gcHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gcHJlbXVsdGlwbHlBbHBoYTtcblxuICAgICAgICAgICAgLy8gTm90ZTogdGhlIFdlYkdMIHNwZWMgc3RhdGVzIHRoYXQgVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIHByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWN0aXZhdGUgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KSB7XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0ICE9PSB0ZXh0dXJlVW5pdCkge1xuICAgICAgICAgICAgdGhpcy5nbC5hY3RpdmVUZXh0dXJlKHRoaXMuZ2wuVEVYVFVSRTAgKyB0ZXh0dXJlVW5pdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0ID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgdGV4dHVyZSBpcyBub3QgYWxyZWFkeSBib3VuZCBvbiB0aGUgY3VycmVudGx5IGFjdGl2ZSB0ZXh0dXJlIHVuaXQsIGJpbmQgaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byBiaW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZSh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IGltcGwgPSB0ZXh0dXJlLmltcGw7XG4gICAgICAgIGNvbnN0IHRleHR1cmVUYXJnZXQgPSBpbXBsLl9nbFRhcmdldDtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9iamVjdCA9IGltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgY29uc3QgdGV4dHVyZVVuaXQgPSB0aGlzLnRleHR1cmVVbml0O1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy50YXJnZXRUb1Nsb3RbdGV4dHVyZVRhcmdldF07XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gIT09IHRleHR1cmVPYmplY3QpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIHRleHR1cmUgaXMgbm90IGJvdW5kIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LCBhY3RpdmUgdGhlIHRleHR1cmUgdW5pdCBhbmQgYmluZFxuICAgICAqIHRoZSB0ZXh0dXJlIHRvIGl0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gYmluZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlIGFuZCBiaW5kIHRoZSB0ZXh0dXJlIHRvLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCkge1xuICAgICAgICBjb25zdCBpbXBsID0gdGV4dHVyZS5pbXBsO1xuICAgICAgICBjb25zdCB0ZXh0dXJlVGFyZ2V0ID0gaW1wbC5fZ2xUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHRleHR1cmVPYmplY3QgPSBpbXBsLl9nbFRleHR1cmU7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnRhcmdldFRvU2xvdFt0ZXh0dXJlVGFyZ2V0XTtcbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSAhPT0gdGV4dHVyZU9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSB0ZXh0dXJlIHBhcmFtZXRlcnMgZm9yIGEgZ2l2ZW4gdGV4dHVyZSBpZiB0aGV5IGhhdmUgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHVwZGF0ZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VGV4dHVyZVBhcmFtZXRlcnModGV4dHVyZSkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGNvbnN0IGZsYWdzID0gdGV4dHVyZS5fcGFyYW1ldGVyRmxhZ3M7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRleHR1cmUuaW1wbC5fZ2xUYXJnZXQ7XG5cbiAgICAgICAgaWYgKGZsYWdzICYgMSkge1xuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHRleHR1cmUuX21pbkZpbHRlcjtcbiAgICAgICAgICAgIGlmICgoIXRleHR1cmUucG90ICYmICF0aGlzLndlYmdsMikgfHwgIXRleHR1cmUuX21pcG1hcHMgfHwgKHRleHR1cmUuX2NvbXByZXNzZWQgJiYgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aCA9PT0gMSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmlsdGVyID09PSBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCB8fCBmaWx0ZXIgPT09IEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX05FQVJFU1Q7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmaWx0ZXIgPT09IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QgfHwgZmlsdGVyID09PSBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCB0aGlzLmdsRmlsdGVyW2ZpbHRlcl0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDIpIHtcbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX01BR19GSUxURVIsIHRoaXMuZ2xGaWx0ZXJbdGV4dHVyZS5fbWFnRmlsdGVyXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9TLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzVV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBXZWJHTDEgZG9lc24ndCBzdXBwb3J0IGFsbCBhZGRyZXNzaW5nIG1vZGVzIHdpdGggTlBPVCB0ZXh0dXJlc1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUywgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5wb3QgPyB0ZXh0dXJlLl9hZGRyZXNzVSA6IEFERFJFU1NfQ0xBTVBfVE9fRURHRV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfVCwgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5fYWRkcmVzc1ZdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gV2ViR0wxIGRvZXNuJ3Qgc3VwcG9ydCBhbGwgYWRkcmVzc2luZyBtb2RlcyB3aXRoIE5QT1QgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1QsIHRoaXMuZ2xBZGRyZXNzW3RleHR1cmUucG90ID8gdGV4dHVyZS5fYWRkcmVzc1YgOiBBRERSRVNTX0NMQU1QX1RPX0VER0VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxNikge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9SLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzV10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDMyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9DT01QQVJFX01PREUsIHRleHR1cmUuX2NvbXBhcmVPblJlYWQgPyBnbC5DT01QQVJFX1JFRl9UT19URVhUVVJFIDogZ2wuTk9ORSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNjQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX0NPTVBBUkVfRlVOQywgdGhpcy5nbENvbXBhcmlzb25bdGV4dHVyZS5fY29tcGFyZUZ1bmNdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxMjgpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljO1xuICAgICAgICAgICAgaWYgKGV4dCkge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmYodGFyZ2V0LCBleHQuVEVYVFVSRV9NQVhfQU5JU09UUk9QWV9FWFQsIE1hdGgubWF4KDEsIE1hdGgubWluKE1hdGgucm91bmQodGV4dHVyZS5fYW5pc290cm9weSksIHRoaXMubWF4QW5pc290cm9weSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0ZXh0dXJlVW5pdCAtIFRoZSB0ZXh0dXJlIHVuaXQgdG8gc2V0IHRoZSB0ZXh0dXJlIG9uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KSB7XG5cbiAgICAgICAgaWYgKCF0ZXh0dXJlLmltcGwuX2dsVGV4dHVyZSlcbiAgICAgICAgICAgIHRleHR1cmUuaW1wbC5pbml0aWFsaXplKHRoaXMsIHRleHR1cmUpO1xuXG4gICAgICAgIGlmICh0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncyA+IDAgfHwgdGV4dHVyZS5fbmVlZHNVcGxvYWQgfHwgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkKSB7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdCBpcyBhY3RpdmVcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlVGV4dHVyZSh0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgdGV4dHVyZSBpcyBib3VuZCBvbiBjb3JyZWN0IHRhcmdldCBvZiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdFxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZSh0ZXh0dXJlKTtcblxuICAgICAgICAgICAgaWYgKHRleHR1cmUuX3BhcmFtZXRlckZsYWdzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlUGFyYW1ldGVycyh0ZXh0dXJlKTtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncyA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9uZWVkc1VwbG9hZCB8fCB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLmltcGwudXBsb2FkKHRoaXMsIHRleHR1cmUpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX25lZWRzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIHRleHR1cmUgaXMgY3VycmVudGx5IGJvdW5kIHRvIHRoZSBjb3JyZWN0IHRhcmdldCBvbiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdC5cbiAgICAgICAgICAgIC8vIElmIHRoZSB0ZXh0dXJlIGlzIGFscmVhZHkgYm91bmQgdG8gdGhlIGNvcnJlY3QgdGFyZ2V0IG9uIHRoZSBzcGVjaWZpZWQgdW5pdCwgdGhlcmUncyBubyBuZWVkXG4gICAgICAgICAgICAvLyB0byBhY3R1YWxseSBtYWtlIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0IGFjdGl2ZSBiZWNhdXNlIHRoZSB0ZXh0dXJlIGl0c2VsZiBkb2VzIG5vdCBuZWVkXG4gICAgICAgICAgICAvLyB0byBiZSB1cGRhdGVkLlxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBjcmVhdGVzIFZlcnRleEFycmF5T2JqZWN0IGZyb20gbGlzdCBvZiB2ZXJ0ZXggYnVmZmVyc1xuICAgIGNyZWF0ZVZlcnRleEFycmF5KHZlcnRleEJ1ZmZlcnMpIHtcblxuICAgICAgICBsZXQga2V5LCB2YW87XG5cbiAgICAgICAgLy8gb25seSB1c2UgY2FjaGUgd2hlbiBtb3JlIHRoYW4gMSB2ZXJ0ZXggYnVmZmVyLCBvdGhlcndpc2UgaXQncyB1bmlxdWVcbiAgICAgICAgY29uc3QgdXNlQ2FjaGUgPSB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA+IDE7XG4gICAgICAgIGlmICh1c2VDYWNoZSkge1xuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSB1bmlxdWUga2V5IGZvciB0aGUgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIGtleSA9IFwiXCI7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRleEJ1ZmZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXJzW2ldO1xuICAgICAgICAgICAgICAgIGtleSArPSB2ZXJ0ZXhCdWZmZXIuaWQgKyB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnJlbmRlcmluZ2luZ0hhc2g7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRyeSB0byBnZXQgVkFPIGZyb20gY2FjaGVcbiAgICAgICAgICAgIHZhbyA9IHRoaXMuX3Zhb01hcC5nZXQoa2V5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5lZWQgdG8gY3JlYXRlIG5ldyB2YW9cbiAgICAgICAgaWYgKCF2YW8pIHtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIFZBIG9iamVjdFxuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgdmFvID0gZ2wuY3JlYXRlVmVydGV4QXJyYXkoKTtcbiAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSh2YW8pO1xuXG4gICAgICAgICAgICAvLyBkb24ndCBjYXB0dXJlIGluZGV4IGJ1ZmZlciBpbiBWQU9cbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIG51bGwpO1xuXG4gICAgICAgICAgICBsZXQgbG9jWmVybyA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBiaW5kIGJ1ZmZlclxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcnNbaV07XG4gICAgICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZlcnRleEJ1ZmZlci5pbXBsLmJ1ZmZlcklkKTtcblxuICAgICAgICAgICAgICAgIC8vIGZvciBlYWNoIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGVsZW1lbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUgPSBlbGVtZW50c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9jID0gc2VtYW50aWNUb0xvY2F0aW9uW2UubmFtZV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvYyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jWmVybyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvYywgZS5udW1Db21wb25lbnRzLCB0aGlzLmdsVHlwZVtlLmRhdGFUeXBlXSwgZS5ub3JtYWxpemUsIGUuc3RyaWRlLCBlLm9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvYyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHZlcnRleEJ1ZmZlci5mb3JtYXQuaW5zdGFuY2luZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wudmVydGV4QXR0cmliRGl2aXNvcihsb2MsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbmQgb2YgVkEgb2JqZWN0XG4gICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkobnVsbCk7XG5cbiAgICAgICAgICAgIC8vIHVuYmluZCBhbnkgYXJyYXkgYnVmZmVyXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgbnVsbCk7XG5cbiAgICAgICAgICAgIC8vIGFkZCBpdCB0byBjYWNoZVxuICAgICAgICAgICAgaWYgKHVzZUNhY2hlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdmFvTWFwLnNldChrZXksIHZhbyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghbG9jWmVybykge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJObyB2ZXJ0ZXggYXR0cmlidXRlIGlzIG1hcHBlZCB0byBsb2NhdGlvbiAwLCB3aGljaCBtaWdodCBjYXVzZSBjb21wYXRpYmlsaXR5IGlzc3VlcyBvbiBTYWZhcmkgb24gTWFjT1MgLSBwbGVhc2UgdXNlIGF0dHJpYnV0ZSBTRU1BTlRJQ19QT1NJVElPTiBvciBTRU1BTlRJQ19BVFRSMTVcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFvO1xuICAgIH1cblxuICAgIHVuYmluZFZlcnRleEFycmF5KCkge1xuICAgICAgICAvLyB1bmJpbmQgVkFPIGZyb20gZGV2aWNlIHRvIHByb3RlY3QgaXQgZnJvbSBiZWluZyBjaGFuZ2VkXG4gICAgICAgIGlmICh0aGlzLmJvdW5kVmFvKSB7XG4gICAgICAgICAgICB0aGlzLmJvdW5kVmFvID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFZlcnRleEFycmF5KG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0QnVmZmVycygpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBsZXQgdmFvO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBWQU8gZm9yIHNwZWNpZmllZCB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICBpZiAodGhpcy52ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA9PT0gMSkge1xuXG4gICAgICAgICAgICAvLyBzaW5nbGUgVkIga2VlcHMgaXRzIFZBT1xuICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gdGhpcy52ZXJ0ZXhCdWZmZXJzWzBdO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZlcnRleEJ1ZmZlci5kZXZpY2UgPT09IHRoaXMsIFwiVGhlIFZlcnRleEJ1ZmZlciB3YXMgbm90IGNyZWF0ZWQgdXNpbmcgY3VycmVudCBHcmFwaGljc0RldmljZVwiKTtcbiAgICAgICAgICAgIGlmICghdmVydGV4QnVmZmVyLmltcGwudmFvKSB7XG4gICAgICAgICAgICAgICAgdmVydGV4QnVmZmVyLmltcGwudmFvID0gdGhpcy5jcmVhdGVWZXJ0ZXhBcnJheSh0aGlzLnZlcnRleEJ1ZmZlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFvID0gdmVydGV4QnVmZmVyLmltcGwudmFvO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gb2J0YWluIHRlbXBvcmFyeSBWQU8gZm9yIG11bHRpcGxlIHZlcnRleCBidWZmZXJzXG4gICAgICAgICAgICB2YW8gPSB0aGlzLmNyZWF0ZVZlcnRleEFycmF5KHRoaXMudmVydGV4QnVmZmVycyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgYWN0aXZlIFZBT1xuICAgICAgICBpZiAodGhpcy5ib3VuZFZhbyAhPT0gdmFvKSB7XG4gICAgICAgICAgICB0aGlzLmJvdW5kVmFvID0gdmFvO1xuICAgICAgICAgICAgZ2wuYmluZFZlcnRleEFycmF5KHZhbyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbXB0eSBhcnJheSBvZiB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlcnMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBTZXQgdGhlIGFjdGl2ZSBpbmRleCBidWZmZXIgb2JqZWN0XG4gICAgICAgIC8vIE5vdGU6IHdlIGRvbid0IGNhY2hlIHRoaXMgc3RhdGUgYW5kIHNldCBpdCBvbmx5IHdoZW4gaXQgY2hhbmdlcywgYXMgVkFPIGNhcHR1cmVzIGxhc3QgYmluZCBidWZmZXIgaW4gaXRcbiAgICAgICAgLy8gYW5kIHNvIHdlIGRvbid0IGtub3cgd2hhdCBWQU8gc2V0cyBpdCB0by5cbiAgICAgICAgY29uc3QgYnVmZmVySWQgPSB0aGlzLmluZGV4QnVmZmVyID8gdGhpcy5pbmRleEJ1ZmZlci5pbXBsLmJ1ZmZlcklkIDogbnVsbDtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgYnVmZmVySWQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1Ym1pdHMgYSBncmFwaGljYWwgcHJpbWl0aXZlIHRvIHRoZSBoYXJkd2FyZSBmb3IgaW1tZWRpYXRlIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwcmltaXRpdmUgLSBQcmltaXRpdmUgb2JqZWN0IGRlc2NyaWJpbmcgaG93IHRvIHN1Ym1pdCBjdXJyZW50IHZlcnRleC9pbmRleFxuICAgICAqIGJ1ZmZlcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS50eXBlIC0gVGhlIHR5cGUgb2YgcHJpbWl0aXZlIHRvIHJlbmRlci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1BPSU5UU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORVN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVMT09QfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUFOR0xFU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUZBTn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwcmltaXRpdmUuYmFzZSAtIFRoZSBvZmZzZXQgb2YgdGhlIGZpcnN0IGluZGV4IG9yIHZlcnRleCB0byBkaXNwYXRjaCBpbiB0aGVcbiAgICAgKiBkcmF3IGNhbGwuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS5jb3VudCAtIFRoZSBudW1iZXIgb2YgaW5kaWNlcyBvciB2ZXJ0aWNlcyB0byBkaXNwYXRjaCBpbiB0aGUgZHJhd1xuICAgICAqIGNhbGwuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbcHJpbWl0aXZlLmluZGV4ZWRdIC0gVHJ1ZSB0byBpbnRlcnByZXQgdGhlIHByaW1pdGl2ZSBhcyBpbmRleGVkLCB0aGVyZWJ5XG4gICAgICogdXNpbmcgdGhlIGN1cnJlbnRseSBzZXQgaW5kZXggYnVmZmVyIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1JbnN0YW5jZXM9MV0gLSBUaGUgbnVtYmVyIG9mIGluc3RhbmNlcyB0byByZW5kZXIgd2hlbiB1c2luZ1xuICAgICAqIEFOR0xFX2luc3RhbmNlZF9hcnJheXMuIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBba2VlcEJ1ZmZlcnNdIC0gT3B0aW9uYWxseSBrZWVwIHRoZSBjdXJyZW50IHNldCBvZiB2ZXJ0ZXggLyBpbmRleCBidWZmZXJzIC9cbiAgICAgKiBWQU8uIFRoaXMgaXMgdXNlZCB3aGVuIHJlbmRlcmluZyBvZiBtdWx0aXBsZSB2aWV3cywgZm9yIGV4YW1wbGUgdW5kZXIgV2ViWFIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSBzaW5nbGUsIHVuaW5kZXhlZCB0cmlhbmdsZVxuICAgICAqIGRldmljZS5kcmF3KHtcbiAgICAgKiAgICAgdHlwZTogcGMuUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICAgKiAgICAgYmFzZTogMCxcbiAgICAgKiAgICAgY291bnQ6IDMsXG4gICAgICogICAgIGluZGV4ZWQ6IGZhbHNlXG4gICAgICogfSk7XG4gICAgICovXG4gICAgZHJhdyhwcmltaXRpdmUsIG51bUluc3RhbmNlcywga2VlcEJ1ZmZlcnMpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGxldCBzYW1wbGVyLCBzYW1wbGVyVmFsdWUsIHRleHR1cmUsIG51bVRleHR1cmVzOyAvLyBTYW1wbGVyc1xuICAgICAgICBsZXQgdW5pZm9ybSwgc2NvcGVJZCwgdW5pZm9ybVZlcnNpb24sIHByb2dyYW1WZXJzaW9uOyAvLyBVbmlmb3Jtc1xuICAgICAgICBjb25zdCBzaGFkZXIgPSB0aGlzLnNoYWRlcjtcbiAgICAgICAgaWYgKCFzaGFkZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IHNhbXBsZXJzID0gc2hhZGVyLmltcGwuc2FtcGxlcnM7XG4gICAgICAgIGNvbnN0IHVuaWZvcm1zID0gc2hhZGVyLmltcGwudW5pZm9ybXM7XG5cbiAgICAgICAgLy8gdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgaWYgKCFrZWVwQnVmZmVycykge1xuICAgICAgICAgICAgdGhpcy5zZXRCdWZmZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21taXQgdGhlIHNoYWRlciBwcm9ncmFtIHZhcmlhYmxlc1xuICAgICAgICBsZXQgdGV4dHVyZVVuaXQgPSAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzYW1wbGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgc2FtcGxlciA9IHNhbXBsZXJzW2ldO1xuICAgICAgICAgICAgc2FtcGxlclZhbHVlID0gc2FtcGxlci5zY29wZUlkLnZhbHVlO1xuICAgICAgICAgICAgaWYgKCFzYW1wbGVyVmFsdWUpIHtcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBjb25zdCBzYW1wbGVyTmFtZSA9IHNhbXBsZXIuc2NvcGVJZC5uYW1lO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyTmFtZSA9PT0gJ3VTY2VuZURlcHRoTWFwJyB8fCBzYW1wbGVyTmFtZSA9PT0gJ3VEZXB0aE1hcCcpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgZGVwdGggdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZURlcHRoTWFwIHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXJOYW1lID09PSAndVNjZW5lQ29sb3JNYXAnIHx8IHNhbXBsZXJOYW1lID09PSAndGV4dHVyZV9ncmFiUGFzcycpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgZGVwdGggdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZUNvbG9yTWFwIHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBjb250aW51ZTsgLy8gQmVjYXVzZSB1bnNldCBjb25zdGFudHMgc2hvdWxkbid0IHJhaXNlIHJhbmRvbSBlcnJvcnNcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNhbXBsZXJWYWx1ZSBpbnN0YW5jZW9mIFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlID0gc2FtcGxlclZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNldCBicmVha3BvaW50IGhlcmUgdG8gZGVidWcgXCJTb3VyY2UgYW5kIGRlc3RpbmF0aW9uIHRleHR1cmVzIG9mIHRoZSBkcmF3IGFyZSB0aGUgc2FtZVwiIGVycm9yc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuX3NhbXBsZXMgPCAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgJiYgdGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgPT09IHRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIlRyeWluZyB0byBiaW5kIGN1cnJlbnQgY29sb3IgYnVmZmVyIGFzIGEgdGV4dHVyZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5yZW5kZXJUYXJnZXQuZGVwdGhCdWZmZXIgJiYgdGhpcy5yZW5kZXJUYXJnZXQuZGVwdGhCdWZmZXIgPT09IHRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIlRyeWluZyB0byBiaW5kIGN1cnJlbnQgZGVwdGggYnVmZmVyIGFzIGEgdGV4dHVyZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyLnNsb3QgIT09IHRleHR1cmVVbml0KSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xaShzYW1wbGVyLmxvY2F0aW9uSWQsIHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlci5zbG90ID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRleHR1cmVVbml0Kys7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBBcnJheVxuICAgICAgICAgICAgICAgIHNhbXBsZXIuYXJyYXkubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICBudW1UZXh0dXJlcyA9IHNhbXBsZXJWYWx1ZS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1UZXh0dXJlczsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmUgPSBzYW1wbGVyVmFsdWVbal07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlci5hcnJheVtqXSA9IHRleHR1cmVVbml0O1xuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlVW5pdCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMWl2KHNhbXBsZXIubG9jYXRpb25JZCwgc2FtcGxlci5hcnJheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21taXQgYW55IHVwZGF0ZWQgdW5pZm9ybXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHVuaWZvcm1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB1bmlmb3JtID0gdW5pZm9ybXNbaV07XG4gICAgICAgICAgICBzY29wZUlkID0gdW5pZm9ybS5zY29wZUlkO1xuICAgICAgICAgICAgdW5pZm9ybVZlcnNpb24gPSB1bmlmb3JtLnZlcnNpb247XG4gICAgICAgICAgICBwcm9ncmFtVmVyc2lvbiA9IHNjb3BlSWQudmVyc2lvbk9iamVjdC52ZXJzaW9uO1xuXG4gICAgICAgICAgICAvLyBDaGVjayB0aGUgdmFsdWUgaXMgdmFsaWRcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmVyc2lvbi5nbG9iYWxJZCAhPT0gcHJvZ3JhbVZlcnNpb24uZ2xvYmFsSWQgfHwgdW5pZm9ybVZlcnNpb24ucmV2aXNpb24gIT09IHByb2dyYW1WZXJzaW9uLnJldmlzaW9uKSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZlcnNpb24uZ2xvYmFsSWQgPSBwcm9ncmFtVmVyc2lvbi5nbG9iYWxJZDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmVyc2lvbi5yZXZpc2lvbiA9IHByb2dyYW1WZXJzaW9uLnJldmlzaW9uO1xuXG4gICAgICAgICAgICAgICAgLy8gQ2FsbCB0aGUgZnVuY3Rpb24gdG8gY29tbWl0IHRoZSB1bmlmb3JtIHZhbHVlXG4gICAgICAgICAgICAgICAgaWYgKHNjb3BlSWQudmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvblt1bmlmb3JtLmRhdGFUeXBlXSh1bmlmb3JtLCBzY29wZUlkLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlcikge1xuICAgICAgICAgICAgLy8gRW5hYmxlIFRGLCBzdGFydCB3cml0aW5nIHRvIG91dCBidWZmZXJcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXJCYXNlKGdsLlRSQU5TRk9STV9GRUVEQkFDS19CVUZGRVIsIDAsIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIuaW1wbC5idWZmZXJJZCk7XG4gICAgICAgICAgICBnbC5iZWdpblRyYW5zZm9ybUZlZWRiYWNrKGdsLlBPSU5UUyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtb2RlID0gdGhpcy5nbFByaW1pdGl2ZVtwcmltaXRpdmUudHlwZV07XG4gICAgICAgIGNvbnN0IGNvdW50ID0gcHJpbWl0aXZlLmNvdW50O1xuXG4gICAgICAgIGlmIChwcmltaXRpdmUuaW5kZXhlZCkge1xuICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSB0aGlzLmluZGV4QnVmZmVyO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGluZGV4QnVmZmVyLmRldmljZSA9PT0gdGhpcywgXCJUaGUgSW5kZXhCdWZmZXIgd2FzIG5vdCBjcmVhdGVkIHVzaW5nIGN1cnJlbnQgR3JhcGhpY3NEZXZpY2VcIik7XG5cbiAgICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IGluZGV4QnVmZmVyLmltcGwuZ2xGb3JtYXQ7XG4gICAgICAgICAgICBjb25zdCBvZmZzZXQgPSBwcmltaXRpdmUuYmFzZSAqIGluZGV4QnVmZmVyLmJ5dGVzUGVySW5kZXg7XG5cbiAgICAgICAgICAgIGlmIChudW1JbnN0YW5jZXMgPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0VsZW1lbnRzSW5zdGFuY2VkKG1vZGUsIGNvdW50LCBmb3JtYXQsIG9mZnNldCwgbnVtSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0VsZW1lbnRzKG1vZGUsIGNvdW50LCBmb3JtYXQsIG9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBmaXJzdCA9IHByaW1pdGl2ZS5iYXNlO1xuXG4gICAgICAgICAgICBpZiAobnVtSW5zdGFuY2VzID4gMCkge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQobW9kZSwgZmlyc3QsIGNvdW50LCBudW1JbnN0YW5jZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3QXJyYXlzKG1vZGUsIGZpcnN0LCBjb3VudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlcikge1xuICAgICAgICAgICAgLy8gZGlzYWJsZSBURlxuICAgICAgICAgICAgZ2wuZW5kVHJhbnNmb3JtRmVlZGJhY2soKTtcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXJCYXNlKGdsLlRSQU5TRk9STV9GRUVEQkFDS19CVUZGRVIsIDAsIG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZHJhd0NhbGxzUGVyRnJhbWUrKztcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3ByaW1zUGVyRnJhbWVbcHJpbWl0aXZlLnR5cGVdICs9IHByaW1pdGl2ZS5jb3VudCAqIChudW1JbnN0YW5jZXMgPiAxID8gbnVtSW5zdGFuY2VzIDogMSk7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFycyB0aGUgZnJhbWUgYnVmZmVyIG9mIHRoZSBjdXJyZW50bHkgc2V0IHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QgdGhhdCBjb250cm9scyB0aGUgYmVoYXZpb3Igb2YgdGhlIGNsZWFyXG4gICAgICogb3BlcmF0aW9uIGRlZmluZWQgYXMgZm9sbG93czpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBbb3B0aW9ucy5jb2xvcl0gLSBUaGUgY29sb3IgdG8gY2xlYXIgdGhlIGNvbG9yIGJ1ZmZlciB0byBpbiB0aGUgcmFuZ2UgMC4wXG4gICAgICogdG8gMS4wIGZvciBlYWNoIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZGVwdGg9MV0gLSBUaGUgZGVwdGggdmFsdWUgdG8gY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlciB0byBpbiB0aGVcbiAgICAgKiByYW5nZSAwLjAgdG8gMS4wLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mbGFnc10gLSBUaGUgYnVmZmVycyB0byBjbGVhciAodGhlIHR5cGVzIGJlaW5nIGNvbG9yLCBkZXB0aCBhbmRcbiAgICAgKiBzdGVuY2lsKS4gQ2FuIGJlIGFueSBiaXR3aXNlIGNvbWJpbmF0aW9uIG9mOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ0xFQVJGTEFHX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIENMRUFSRkxBR19ERVBUSH1cbiAgICAgKiAtIHtAbGluayBDTEVBUkZMQUdfU1RFTkNJTH1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdGVuY2lsPTBdIC0gVGhlIHN0ZW5jaWwgdmFsdWUgdG8gY2xlYXIgdGhlIHN0ZW5jaWwgYnVmZmVyIHRvLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ2xlYXIgY29sb3IgYnVmZmVyIHRvIGJsYWNrIGFuZCBkZXB0aCBidWZmZXIgdG8gMS4wXG4gICAgICogZGV2aWNlLmNsZWFyKCk7XG4gICAgICpcbiAgICAgKiAvLyBDbGVhciBqdXN0IHRoZSBjb2xvciBidWZmZXIgdG8gcmVkXG4gICAgICogZGV2aWNlLmNsZWFyKHtcbiAgICAgKiAgICAgY29sb3I6IFsxLCAwLCAwLCAxXSxcbiAgICAgKiAgICAgZmxhZ3M6IHBjLkNMRUFSRkxBR19DT0xPUlxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gQ2xlYXIgY29sb3IgYnVmZmVyIHRvIHllbGxvdyBhbmQgZGVwdGggdG8gMS4wXG4gICAgICogZGV2aWNlLmNsZWFyKHtcbiAgICAgKiAgICAgY29sb3I6IFsxLCAxLCAwLCAxXSxcbiAgICAgKiAgICAgZGVwdGg6IDEsXG4gICAgICogICAgIGZsYWdzOiBwYy5DTEVBUkZMQUdfQ09MT1IgfCBwYy5DTEVBUkZMQUdfREVQVEhcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBjbGVhcihvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0gdGhpcy5kZWZhdWx0Q2xlYXJPcHRpb25zO1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBkZWZhdWx0T3B0aW9ucztcblxuICAgICAgICBjb25zdCBmbGFncyA9IChvcHRpb25zLmZsYWdzID09PSB1bmRlZmluZWQpID8gZGVmYXVsdE9wdGlvbnMuZmxhZ3MgOiBvcHRpb25zLmZsYWdzO1xuICAgICAgICBpZiAoZmxhZ3MgIT09IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBjb2xvclxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX0NPTE9SKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3IgPSAob3B0aW9ucy5jb2xvciA9PT0gdW5kZWZpbmVkKSA/IGRlZmF1bHRPcHRpb25zLmNvbG9yIDogb3B0aW9ucy5jb2xvcjtcbiAgICAgICAgICAgICAgICB0aGlzLnNldENsZWFyQ29sb3IoY29sb3JbMF0sIGNvbG9yWzFdLCBjb2xvclsyXSwgY29sb3JbM10pO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q29sb3JXcml0ZSh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBkZXB0aFxuICAgICAgICAgICAgICAgIGNvbnN0IGRlcHRoID0gKG9wdGlvbnMuZGVwdGggPT09IHVuZGVmaW5lZCkgPyBkZWZhdWx0T3B0aW9ucy5kZXB0aCA6IG9wdGlvbnMuZGVwdGg7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRDbGVhckRlcHRoKGRlcHRoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldERlcHRoV3JpdGUodHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGFncyAmIENMRUFSRkxBR19TVEVOQ0lMKSB7XG4gICAgICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBzdGVuY2lsXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RlbmNpbCA9IChvcHRpb25zLnN0ZW5jaWwgPT09IHVuZGVmaW5lZCkgPyBkZWZhdWx0T3B0aW9ucy5zdGVuY2lsIDogb3B0aW9ucy5zdGVuY2lsO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q2xlYXJTdGVuY2lsKHN0ZW5jaWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDbGVhciB0aGUgZnJhbWUgYnVmZmVyXG4gICAgICAgICAgICBnbC5jbGVhcih0aGlzLmdsQ2xlYXJGbGFnW2ZsYWdzXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWFkcyBhIGJsb2NrIG9mIHBpeGVscyBmcm9tIGEgc3BlY2lmaWVkIHJlY3RhbmdsZSBvZiB0aGUgY3VycmVudCBjb2xvciBmcmFtZWJ1ZmZlciBpbnRvIGFuXG4gICAgICogQXJyYXlCdWZmZXJWaWV3IG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHgtY29vcmRpbmF0ZSBvZiB0aGUgcmVjdGFuZ2xlJ3MgbG93ZXItbGVmdCBjb3JuZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeS1jb29yZGluYXRlIG9mIHRoZSByZWN0YW5nbGUncyBsb3dlci1sZWZ0IGNvcm5lci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlLCBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUsIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gcGl4ZWxzIC0gVGhlIEFycmF5QnVmZmVyVmlldyBvYmplY3QgdGhhdCBob2xkcyB0aGUgcmV0dXJuZWQgcGl4ZWxcbiAgICAgKiBkYXRhLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZWFkUGl4ZWxzKHgsIHksIHcsIGgsIHBpeGVscykge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGdsLnJlYWRQaXhlbHMoeCwgeSwgdywgaCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgcGl4ZWxzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGRlcHRoIHZhbHVlIHVzZWQgd2hlbiB0aGUgZGVwdGggYnVmZmVyIGlzIGNsZWFyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVwdGggLSBUaGUgZGVwdGggdmFsdWUgdG8gY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlciB0byBpbiB0aGUgcmFuZ2UgMC4wXG4gICAgICogdG8gMS4wLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRDbGVhckRlcHRoKGRlcHRoKSB7XG4gICAgICAgIGlmIChkZXB0aCAhPT0gdGhpcy5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmNsZWFyRGVwdGgoZGVwdGgpO1xuICAgICAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gZGVwdGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGNsZWFyIGNvbG9yIHVzZWQgd2hlbiB0aGUgZnJhbWUgYnVmZmVyIGlzIGNsZWFyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gciAtIFRoZSByZWQgY29tcG9uZW50IG9mIHRoZSBjb2xvciBpbiB0aGUgcmFuZ2UgMC4wIHRvIDEuMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZyAtIFRoZSBncmVlbiBjb21wb25lbnQgb2YgdGhlIGNvbG9yIGluIHRoZSByYW5nZSAwLjAgdG8gMS4wLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gVGhlIGJsdWUgY29tcG9uZW50IG9mIHRoZSBjb2xvciBpbiB0aGUgcmFuZ2UgMC4wIHRvIDEuMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYSAtIFRoZSBhbHBoYSBjb21wb25lbnQgb2YgdGhlIGNvbG9yIGluIHRoZSByYW5nZSAwLjAgdG8gMS4wLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRDbGVhckNvbG9yKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgY29uc3QgYyA9IHRoaXMuY2xlYXJDb2xvcjtcbiAgICAgICAgaWYgKChyICE9PSBjLnIpIHx8IChnICE9PSBjLmcpIHx8IChiICE9PSBjLmIpIHx8IChhICE9PSBjLmEpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmNsZWFyQ29sb3IociwgZywgYiwgYSk7XG4gICAgICAgICAgICB0aGlzLmNsZWFyQ29sb3Iuc2V0KHIsIGcsIGIsIGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzdGVuY2lsIGNsZWFyIHZhbHVlIHVzZWQgd2hlbiB0aGUgc3RlbmNpbCBidWZmZXIgaXMgY2xlYXJlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBzdGVuY2lsIHZhbHVlIHRvIGNsZWFyIHRoZSBzdGVuY2lsIGJ1ZmZlciB0by5cbiAgICAgKi9cbiAgICBzZXRDbGVhclN0ZW5jaWwodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLmNsZWFyU3RlbmNpbCkge1xuICAgICAgICAgICAgdGhpcy5nbC5jbGVhclN0ZW5jaWwodmFsdWUpO1xuICAgICAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWwgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgd2hldGhlciBkZXB0aCB0ZXN0aW5nIGlzIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBkZXB0aCB0ZXN0aW5nIGlzIGVuYWJsZWQgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBkZXB0aFRlc3QgPSBkZXZpY2UuZ2V0RGVwdGhUZXN0KCk7XG4gICAgICogY29uc29sZS5sb2coJ0RlcHRoIHRlc3RpbmcgaXMgJyArIGRlcHRoVGVzdCA/ICdlbmFibGVkJyA6ICdkaXNhYmxlZCcpO1xuICAgICAqL1xuICAgIGdldERlcHRoVGVzdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVwdGhUZXN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgZGVwdGggdGVzdGluZyBvZiBmcmFnbWVudHMuIE9uY2UgdGhpcyBzdGF0ZSBpcyBzZXQsIGl0IHBlcnNpc3RzIHVudGlsIGl0XG4gICAgICogaXMgY2hhbmdlZC4gQnkgZGVmYXVsdCwgZGVwdGggdGVzdGluZyBpcyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBkZXB0aFRlc3QgLSBUcnVlIHRvIGVuYWJsZSBkZXB0aCB0ZXN0aW5nIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBkZXZpY2Uuc2V0RGVwdGhUZXN0KHRydWUpO1xuICAgICAqL1xuICAgIHNldERlcHRoVGVzdChkZXB0aFRlc3QpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVwdGhUZXN0ICE9PSBkZXB0aFRlc3QpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGlmIChkZXB0aFRlc3QpIHtcbiAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmRlcHRoVGVzdCA9IGRlcHRoVGVzdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgdGhlIGRlcHRoIHRlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZnVuYyAtIEEgZnVuY3Rpb24gdG8gY29tcGFyZSBhIG5ldyBkZXB0aCB2YWx1ZSB3aXRoIGFuIGV4aXN0aW5nIHotYnVmZmVyXG4gICAgICogdmFsdWUgYW5kIGRlY2lkZSBpZiB0byB3cml0ZSBhIHBpeGVsLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX05FVkVSfTogZG9uJ3QgZHJhd1xuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU306IGRyYXcgaWYgbmV3IGRlcHRoIDwgZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH06IGRyYXcgaWYgbmV3IGRlcHRoID09IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggPD0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfTogZHJhdyBpZiBuZXcgZGVwdGggPiBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggIT0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCA+PSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0FMV0FZU306IGFsd2F5cyBkcmF3XG4gICAgICovXG4gICAgc2V0RGVwdGhGdW5jKGZ1bmMpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVwdGhGdW5jID09PSBmdW5jKSByZXR1cm47XG4gICAgICAgIHRoaXMuZ2wuZGVwdGhGdW5jKHRoaXMuZ2xDb21wYXJpc29uW2Z1bmNdKTtcbiAgICAgICAgdGhpcy5kZXB0aEZ1bmMgPSBmdW5jO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgd2hldGhlciB3cml0ZXMgdG8gdGhlIGRlcHRoIGJ1ZmZlciBhcmUgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGRlcHRoIHdyaXRpbmcgaXMgZW5hYmxlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGRlcHRoV3JpdGUgPSBkZXZpY2UuZ2V0RGVwdGhXcml0ZSgpO1xuICAgICAqIGNvbnNvbGUubG9nKCdEZXB0aCB3cml0aW5nIGlzICcgKyBkZXB0aFdyaXRlID8gJ2VuYWJsZWQnIDogJ2Rpc2FibGVkJyk7XG4gICAgICovXG4gICAgZ2V0RGVwdGhXcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVwdGhXcml0ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIHdyaXRlcyB0byB0aGUgZGVwdGggYnVmZmVyLiBPbmNlIHRoaXMgc3RhdGUgaXMgc2V0LCBpdCBwZXJzaXN0cyB1bnRpbCBpdFxuICAgICAqIGlzIGNoYW5nZWQuIEJ5IGRlZmF1bHQsIGRlcHRoIHdyaXRlcyBhcmUgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gd3JpdGVEZXB0aCAtIFRydWUgdG8gZW5hYmxlIGRlcHRoIHdyaXRpbmcgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGRldmljZS5zZXREZXB0aFdyaXRlKHRydWUpO1xuICAgICAqL1xuICAgIHNldERlcHRoV3JpdGUod3JpdGVEZXB0aCkge1xuICAgICAgICBpZiAodGhpcy5kZXB0aFdyaXRlICE9PSB3cml0ZURlcHRoKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmRlcHRoTWFzayh3cml0ZURlcHRoKTtcbiAgICAgICAgICAgIHRoaXMuZGVwdGhXcml0ZSA9IHdyaXRlRGVwdGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIHdyaXRlcyB0byB0aGUgY29sb3IgYnVmZmVyLiBPbmNlIHRoaXMgc3RhdGUgaXMgc2V0LCBpdCBwZXJzaXN0cyB1bnRpbCBpdFxuICAgICAqIGlzIGNoYW5nZWQuIEJ5IGRlZmF1bHQsIGNvbG9yIHdyaXRlcyBhcmUgZW5hYmxlZCBmb3IgYWxsIGNvbG9yIGNoYW5uZWxzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSB3cml0ZVJlZCAtIFRydWUgdG8gZW5hYmxlIHdyaXRpbmcgb2YgdGhlIHJlZCBjaGFubmVsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB3cml0ZUdyZWVuIC0gVHJ1ZSB0byBlbmFibGUgd3JpdGluZyBvZiB0aGUgZ3JlZW4gY2hhbm5lbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gd3JpdGVCbHVlIC0gVHJ1ZSB0byBlbmFibGUgd3JpdGluZyBvZiB0aGUgYmx1ZSBjaGFubmVsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB3cml0ZUFscGhhIC0gVHJ1ZSB0byBlbmFibGUgd3JpdGluZyBvZiB0aGUgYWxwaGEgY2hhbm5lbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gSnVzdCB3cml0ZSBhbHBoYSBpbnRvIHRoZSBmcmFtZSBidWZmZXJcbiAgICAgKiBkZXZpY2Uuc2V0Q29sb3JXcml0ZShmYWxzZSwgZmFsc2UsIGZhbHNlLCB0cnVlKTtcbiAgICAgKi9cbiAgICBzZXRDb2xvcldyaXRlKHdyaXRlUmVkLCB3cml0ZUdyZWVuLCB3cml0ZUJsdWUsIHdyaXRlQWxwaGEpIHtcbiAgICAgICAgaWYgKCh0aGlzLndyaXRlUmVkICE9PSB3cml0ZVJlZCkgfHxcbiAgICAgICAgICAgICh0aGlzLndyaXRlR3JlZW4gIT09IHdyaXRlR3JlZW4pIHx8XG4gICAgICAgICAgICAodGhpcy53cml0ZUJsdWUgIT09IHdyaXRlQmx1ZSkgfHxcbiAgICAgICAgICAgICh0aGlzLndyaXRlQWxwaGEgIT09IHdyaXRlQWxwaGEpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmNvbG9yTWFzayh3cml0ZVJlZCwgd3JpdGVHcmVlbiwgd3JpdGVCbHVlLCB3cml0ZUFscGhhKTtcbiAgICAgICAgICAgIHRoaXMud3JpdGVSZWQgPSB3cml0ZVJlZDtcbiAgICAgICAgICAgIHRoaXMud3JpdGVHcmVlbiA9IHdyaXRlR3JlZW47XG4gICAgICAgICAgICB0aGlzLndyaXRlQmx1ZSA9IHdyaXRlQmx1ZTtcbiAgICAgICAgICAgIHRoaXMud3JpdGVBbHBoYSA9IHdyaXRlQWxwaGE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIGFscGhhIHRvIGNvdmVyYWdlIChXZWJHTDIgb25seSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHN0YXRlIC0gVHJ1ZSB0byBlbmFibGUgYWxwaGEgdG8gY292ZXJhZ2UgYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEFscGhhVG9Db3ZlcmFnZShzdGF0ZSkge1xuICAgICAgICBpZiAoIXRoaXMud2ViZ2wyKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLmFscGhhVG9Db3ZlcmFnZSA9PT0gc3RhdGUpIHJldHVybjtcbiAgICAgICAgdGhpcy5hbHBoYVRvQ292ZXJhZ2UgPSBzdGF0ZTtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuU0FNUExFX0FMUEhBX1RPX0NPVkVSQUdFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBvdXRwdXQgdmVydGV4IGJ1ZmZlci4gSXQgd2lsbCBiZSB3cml0dGVuIHRvIGJ5IGEgc2hhZGVyIHdpdGggdHJhbnNmb3JtIGZlZWRiYWNrXG4gICAgICogdmFyeWluZ3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcn0gdGYgLSBUaGUgb3V0cHV0IHZlcnRleCBidWZmZXIuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyKHRmKSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyID09PSB0ZilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyID0gdGY7XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBpZiAodGYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZmVlZGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mZWVkYmFjayA9IGdsLmNyZWF0ZVRyYW5zZm9ybUZlZWRiYWNrKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdsLmJpbmRUcmFuc2Zvcm1GZWVkYmFjayhnbC5UUkFOU0ZPUk1fRkVFREJBQ0ssIHRoaXMuZmVlZGJhY2spO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5iaW5kVHJhbnNmb3JtRmVlZGJhY2soZ2wuVFJBTlNGT1JNX0ZFRURCQUNLLCBudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRvZ2dsZXMgdGhlIHJhc3Rlcml6YXRpb24gcmVuZGVyIHN0YXRlLiBVc2VmdWwgd2l0aCB0cmFuc2Zvcm0gZmVlZGJhY2ssIHdoZW4geW91IG9ubHkgbmVlZFxuICAgICAqIHRvIHByb2Nlc3MgdGhlIGRhdGEgd2l0aG91dCBkcmF3aW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvbiAtIFRydWUgdG8gZW5hYmxlIHJhc3Rlcml6YXRpb24gYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFJhc3Rlcihvbikge1xuICAgICAgICBpZiAodGhpcy5yYXN0ZXIgPT09IG9uKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5yYXN0ZXIgPSBvbjtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIGlmIChvbikge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlJBU1RFUklaRVJfRElTQ0FSRCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuUkFTVEVSSVpFUl9ESVNDQVJEKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRvZ2dsZXMgdGhlIHBvbHlnb24gb2Zmc2V0IHJlbmRlciBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb24gLSBUcnVlIHRvIGVuYWJsZSBwb2x5Z29uIG9mZnNldCBhbmQgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0RGVwdGhCaWFzKG9uKSB7XG4gICAgICAgIGlmICh0aGlzLmRlcHRoQmlhc0VuYWJsZWQgPT09IG9uKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5kZXB0aEJpYXNFbmFibGVkID0gb247XG5cbiAgICAgICAgaWYgKG9uKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5nbC5kaXNhYmxlKHRoaXMuZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTcGVjaWZpZXMgdGhlIHNjYWxlIGZhY3RvciBhbmQgdW5pdHMgdG8gY2FsY3VsYXRlIGRlcHRoIHZhbHVlcy4gVGhlIG9mZnNldCBpcyBhZGRlZCBiZWZvcmVcbiAgICAgKiB0aGUgZGVwdGggdGVzdCBpcyBwZXJmb3JtZWQgYW5kIGJlZm9yZSB0aGUgdmFsdWUgaXMgd3JpdHRlbiBpbnRvIHRoZSBkZXB0aCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY29uc3RCaWFzIC0gVGhlIG11bHRpcGxpZXIgYnkgd2hpY2ggYW4gaW1wbGVtZW50YXRpb24tc3BlY2lmaWMgdmFsdWUgaXNcbiAgICAgKiBtdWx0aXBsaWVkIHdpdGggdG8gY3JlYXRlIGEgY29uc3RhbnQgZGVwdGggb2Zmc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzbG9wZUJpYXMgLSBUaGUgc2NhbGUgZmFjdG9yIGZvciB0aGUgdmFyaWFibGUgZGVwdGggb2Zmc2V0IGZvciBlYWNoIHBvbHlnb24uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldERlcHRoQmlhc1ZhbHVlcyhjb25zdEJpYXMsIHNsb3BlQmlhcykge1xuICAgICAgICB0aGlzLmdsLnBvbHlnb25PZmZzZXQoc2xvcGVCaWFzLCBjb25zdEJpYXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgd2hldGhlciBibGVuZGluZyBpcyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgYmxlbmRpbmcgaXMgZW5hYmxlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGdldEJsZW5kaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ibGVuZGluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIGJsZW5kaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBibGVuZGluZyAtIFRydWUgdG8gZW5hYmxlIGJsZW5kaW5nIGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqL1xuICAgIHNldEJsZW5kaW5nKGJsZW5kaW5nKSB7XG4gICAgICAgIGlmICh0aGlzLmJsZW5kaW5nICE9PSBibGVuZGluZykge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgaWYgKGJsZW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLkJMRU5EKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmJsZW5kaW5nID0gYmxlbmRpbmc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIHN0ZW5jaWwgdGVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlIC0gVHJ1ZSB0byBlbmFibGUgc3RlbmNpbCB0ZXN0IGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxUZXN0KGVuYWJsZSkge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsICE9PSBlbmFibGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGlmIChlbmFibGUpIHtcbiAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuU1RFTkNJTF9URVNUKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zdGVuY2lsID0gZW5hYmxlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBzdGVuY2lsIHRlc3QgZm9yIGJvdGggZnJvbnQgYW5kIGJhY2sgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZnVuYyAtIEEgY29tcGFyaXNvbiBmdW5jdGlvbiB0aGF0IGRlY2lkZXMgaWYgdGhlIHBpeGVsIHNob3VsZCBiZSB3cml0dGVuLFxuICAgICAqIGJhc2VkIG9uIHRoZSBjdXJyZW50IHN0ZW5jaWwgYnVmZmVyIHZhbHVlLCByZWZlcmVuY2UgdmFsdWUsIGFuZCBtYXNrIHZhbHVlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX05FVkVSfTogbmV2ZXIgcGFzc1xuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU306IHBhc3MgaWYgKHJlZiAmIG1hc2spIDwgKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA9PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfTogcGFzcyBpZiAocmVmICYgbWFzaykgPiAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spICE9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID49IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0FMV0FZU306IGFsd2F5cyBwYXNzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmVmIC0gUmVmZXJlbmNlIHZhbHVlIHVzZWQgaW4gY29tcGFyaXNvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFzayAtIE1hc2sgYXBwbGllZCB0byBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSBhbmQgcmVmZXJlbmNlIHZhbHVlIGJlZm9yZVxuICAgICAqIGNvbXBhcmlzb24uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbEZ1bmMoZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgIT09IGZ1bmMgfHwgdGhpcy5zdGVuY2lsUmVmRnJvbnQgIT09IHJlZiB8fCB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgIT09IG1hc2sgfHxcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNCYWNrICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkJhY2sgIT09IHJlZiB8fCB0aGlzLnN0ZW5jaWxNYXNrQmFjayAhPT0gbWFzaykge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmModGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgPSB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHRoaXMuc3RlbmNpbFJlZkJhY2sgPSByZWY7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgPSB0aGlzLnN0ZW5jaWxNYXNrQmFjayA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHN0ZW5jaWwgdGVzdCBmb3IgZnJvbnQgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZnVuYyAtIEEgY29tcGFyaXNvbiBmdW5jdGlvbiB0aGF0IGRlY2lkZXMgaWYgdGhlIHBpeGVsIHNob3VsZCBiZSB3cml0dGVuLFxuICAgICAqIGJhc2VkIG9uIHRoZSBjdXJyZW50IHN0ZW5jaWwgYnVmZmVyIHZhbHVlLCByZWZlcmVuY2UgdmFsdWUsIGFuZCBtYXNrIHZhbHVlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX05FVkVSfTogbmV2ZXIgcGFzc1xuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU306IHBhc3MgaWYgKHJlZiAmIG1hc2spIDwgKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA9PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfTogcGFzcyBpZiAocmVmICYgbWFzaykgPiAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spICE9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID49IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0FMV0FZU306IGFsd2F5cyBwYXNzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmVmIC0gUmVmZXJlbmNlIHZhbHVlIHVzZWQgaW4gY29tcGFyaXNvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFzayAtIE1hc2sgYXBwbGllZCB0byBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSBhbmQgcmVmZXJlbmNlIHZhbHVlIGJlZm9yZSBjb21wYXJpc29uLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxGdW5jRnJvbnQoZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgIT09IGZ1bmMgfHwgdGhpcy5zdGVuY2lsUmVmRnJvbnQgIT09IHJlZiB8fCB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgIT09IG1hc2spIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jU2VwYXJhdGUoZ2wuRlJPTlQsIHRoaXMuZ2xDb21wYXJpc29uW2Z1bmNdLCByZWYsIG1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRnVuY0Zyb250ID0gZnVuYztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFJlZkZyb250ID0gcmVmO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsTWFza0Zyb250ID0gbWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgc3RlbmNpbCB0ZXN0IGZvciBiYWNrIGZhY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZ1bmMgLSBBIGNvbXBhcmlzb24gZnVuY3Rpb24gdGhhdCBkZWNpZGVzIGlmIHRoZSBwaXhlbCBzaG91bGQgYmUgd3JpdHRlbixcbiAgICAgKiBiYXNlZCBvbiB0aGUgY3VycmVudCBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSwgcmVmZXJlbmNlIHZhbHVlLCBhbmQgbWFzayB2YWx1ZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19ORVZFUn06IG5ldmVyIHBhc3NcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPD0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn06IHBhc3MgaWYgKHJlZiAmIG1hc2spID4gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSAhPSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19BTFdBWVN9OiBhbHdheXMgcGFzc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJlZiAtIFJlZmVyZW5jZSB2YWx1ZSB1c2VkIGluIGNvbXBhcmlzb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1hc2sgLSBNYXNrIGFwcGxpZWQgdG8gc3RlbmNpbCBidWZmZXIgdmFsdWUgYW5kIHJlZmVyZW5jZSB2YWx1ZSBiZWZvcmUgY29tcGFyaXNvbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsRnVuY0JhY2soZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGdW5jQmFjayAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZCYWNrICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0JhY2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jU2VwYXJhdGUoZ2wuQkFDSywgdGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZCYWNrID0gcmVmO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsTWFza0JhY2sgPSBtYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBob3cgc3RlbmNpbCBidWZmZXIgdmFsdWVzIHNob3VsZCBiZSBtb2RpZmllZCBiYXNlZCBvbiB0aGUgcmVzdWx0IG9mIGRlcHRoL3N0ZW5jaWxcbiAgICAgKiB0ZXN0cy4gV29ya3MgZm9yIGJvdGggZnJvbnQgYW5kIGJhY2sgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZmFpbCAtIEFjdGlvbiB0byB0YWtlIGlmIHN0ZW5jaWwgdGVzdCBpcyBmYWlsZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9LRUVQfTogZG9uJ3QgY2hhbmdlIHRoZSBzdGVuY2lsIGJ1ZmZlciB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9aRVJPfTogc2V0IHZhbHVlIHRvIHplcm9cbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfUkVQTEFDRX06IHJlcGxhY2UgdmFsdWUgd2l0aCB0aGUgcmVmZXJlbmNlIHZhbHVlIChzZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxGdW5jfSlcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5DUkVNRU5UfTogaW5jcmVtZW50IHRoZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlRXUkFQfTogaW5jcmVtZW50IHRoZSB2YWx1ZSwgYnV0IHdyYXAgaXQgdG8gemVybyB3aGVuIGl0J3MgbGFyZ2VyXG4gICAgICogdGhhbiBhIG1heGltdW0gcmVwcmVzZW50YWJsZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9ERUNSRU1FTlR9OiBkZWNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVFdSQVB9OiBkZWNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byBhIG1heGltdW1cbiAgICAgKiByZXByZXNlbnRhYmxlIHZhbHVlLCBpZiB0aGUgY3VycmVudCB2YWx1ZSBpcyAwXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOVkVSVH06IGludmVydCB0aGUgdmFsdWUgYml0d2lzZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgZGVwdGggdGVzdCBpcyBmYWlsZWQuICBBY2NlcHRzIHRoZSBzYW1lIHZhbHVlcyBhc1xuICAgICAqIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0genBhc3MgLSBBY3Rpb24gdG8gdGFrZSBpZiBib3RoIGRlcHRoIGFuZCBzdGVuY2lsIHRlc3QgYXJlIHBhc3NlZC4gQWNjZXB0c1xuICAgICAqIHRoZSBzYW1lIHZhbHVlcyBhcyBgZmFpbGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdyaXRlTWFzayAtIEEgYml0IG1hc2sgYXBwbGllZCB0byB0aGUgcmVmZXJlbmNlIHZhbHVlLCB3aGVuIHdyaXR0ZW4uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbE9wZXJhdGlvbihmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRmFpbEZyb250ICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgIT09IHpwYXNzIHx8XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wKHRoaXMuZ2xTdGVuY2lsT3BbZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbemZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pwYXNzXSk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IGZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ID0gdGhpcy5zdGVuY2lsWnBhc3NCYWNrID0genBhc3M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ICE9PSB3cml0ZU1hc2sgfHwgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrKHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IHdyaXRlTWFzaztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgPSB3cml0ZU1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGhvdyBzdGVuY2lsIGJ1ZmZlciB2YWx1ZXMgc2hvdWxkIGJlIG1vZGlmaWVkIGJhc2VkIG9uIHRoZSByZXN1bHQgb2YgZGVwdGgvc3RlbmNpbFxuICAgICAqIHRlc3RzLiBXb3JrcyBmb3IgZnJvbnQgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZmFpbCAtIEFjdGlvbiB0byB0YWtlIGlmIHN0ZW5jaWwgdGVzdCBpcyBmYWlsZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9LRUVQfTogZG9uJ3QgY2hhbmdlIHRoZSBzdGVuY2lsIGJ1ZmZlciB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9aRVJPfTogc2V0IHZhbHVlIHRvIHplcm9cbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfUkVQTEFDRX06IHJlcGxhY2UgdmFsdWUgd2l0aCB0aGUgcmVmZXJlbmNlIHZhbHVlIChzZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxGdW5jfSlcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5DUkVNRU5UfTogaW5jcmVtZW50IHRoZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlRXUkFQfTogaW5jcmVtZW50IHRoZSB2YWx1ZSwgYnV0IHdyYXAgaXQgdG8gemVybyB3aGVuIGl0J3MgbGFyZ2VyXG4gICAgICogdGhhbiBhIG1heGltdW0gcmVwcmVzZW50YWJsZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9ERUNSRU1FTlR9OiBkZWNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVFdSQVB9OiBkZWNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byBhIG1heGltdW1cbiAgICAgKiByZXByZXNlbnRhYmxlIHZhbHVlLCBpZiB0aGUgY3VycmVudCB2YWx1ZSBpcyAwXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOVkVSVH06IGludmVydCB0aGUgdmFsdWUgYml0d2lzZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgZGVwdGggdGVzdCBpcyBmYWlsZWQuICBBY2NlcHRzIHRoZSBzYW1lIHZhbHVlcyBhc1xuICAgICAqIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0genBhc3MgLSBBY3Rpb24gdG8gdGFrZSBpZiBib3RoIGRlcHRoIGFuZCBzdGVuY2lsIHRlc3QgYXJlIHBhc3NlZC4gIEFjY2VwdHNcbiAgICAgKiB0aGUgc2FtZSB2YWx1ZXMgYXMgYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3cml0ZU1hc2sgLSBBIGJpdCBtYXNrIGFwcGxpZWQgdG8gdGhlIHJlZmVyZW5jZSB2YWx1ZSwgd2hlbiB3cml0dGVuLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxPcGVyYXRpb25Gcm9udChmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRmFpbEZyb250ICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgIT09IHpwYXNzKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxPcFNlcGFyYXRlKHRoaXMuZ2wuRlJPTlQsIHRoaXMuZ2xTdGVuY2lsT3BbZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbemZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pwYXNzXSk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSBmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxGcm9udCA9IHpmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWnBhc3NGcm9udCA9IHpwYXNzO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrU2VwYXJhdGUodGhpcy5nbC5GUk9OVCwgd3JpdGVNYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ID0gd3JpdGVNYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBob3cgc3RlbmNpbCBidWZmZXIgdmFsdWVzIHNob3VsZCBiZSBtb2RpZmllZCBiYXNlZCBvbiB0aGUgcmVzdWx0IG9mIGRlcHRoL3N0ZW5jaWxcbiAgICAgKiB0ZXN0cy4gV29ya3MgZm9yIGJhY2sgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZmFpbCAtIEFjdGlvbiB0byB0YWtlIGlmIHN0ZW5jaWwgdGVzdCBpcyBmYWlsZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9LRUVQfTogZG9uJ3QgY2hhbmdlIHRoZSBzdGVuY2lsIGJ1ZmZlciB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9aRVJPfTogc2V0IHZhbHVlIHRvIHplcm9cbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfUkVQTEFDRX06IHJlcGxhY2UgdmFsdWUgd2l0aCB0aGUgcmVmZXJlbmNlIHZhbHVlIChzZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxGdW5jfSlcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5DUkVNRU5UfTogaW5jcmVtZW50IHRoZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlRXUkFQfTogaW5jcmVtZW50IHRoZSB2YWx1ZSwgYnV0IHdyYXAgaXQgdG8gemVybyB3aGVuIGl0J3MgbGFyZ2VyXG4gICAgICogdGhhbiBhIG1heGltdW0gcmVwcmVzZW50YWJsZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9ERUNSRU1FTlR9OiBkZWNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVFdSQVB9OiBkZWNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byBhIG1heGltdW1cbiAgICAgKiByZXByZXNlbnRhYmxlIHZhbHVlLCBpZiB0aGUgY3VycmVudCB2YWx1ZSBpcyAwXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOVkVSVH06IGludmVydCB0aGUgdmFsdWUgYml0d2lzZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgZGVwdGggdGVzdCBpcyBmYWlsZWQuIEFjY2VwdHMgdGhlIHNhbWUgdmFsdWVzIGFzXG4gICAgICogYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6cGFzcyAtIEFjdGlvbiB0byB0YWtlIGlmIGJvdGggZGVwdGggYW5kIHN0ZW5jaWwgdGVzdCBhcmUgcGFzc2VkLiBBY2NlcHRzXG4gICAgICogdGhlIHNhbWUgdmFsdWVzIGFzIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd3JpdGVNYXNrIC0gQSBiaXQgbWFzayBhcHBsaWVkIHRvIHRoZSByZWZlcmVuY2UgdmFsdWUsIHdoZW4gd3JpdHRlbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsT3BlcmF0aW9uQmFjayhmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRmFpbEJhY2sgIT09IGZhaWwgfHwgdGhpcy5zdGVuY2lsWmZhaWxCYWNrICE9PSB6ZmFpbCB8fCB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgIT09IHpwYXNzKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxPcFNlcGFyYXRlKHRoaXMuZ2wuQkFDSywgdGhpcy5nbFN0ZW5jaWxPcFtmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6ZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbenBhc3NdKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZhaWxCYWNrID0gZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpmYWlsQmFjayA9IHpmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWnBhc3NCYWNrID0genBhc3M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgIT09IHdyaXRlTWFzaykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsTWFza1NlcGFyYXRlKHRoaXMuZ2wuQkFDSywgd3JpdGVNYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgPSB3cml0ZU1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGJsZW5kaW5nIG9wZXJhdGlvbnMuIEJvdGggc291cmNlIGFuZCBkZXN0aW5hdGlvbiBibGVuZCBtb2RlcyBjYW4gdGFrZSB0aGVcbiAgICAgKiBmb2xsb3dpbmcgdmFsdWVzOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1pFUk99XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9EU1RfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9EU1RfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX0NPTlNUQU5UX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX0NPTlNUQU5UX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEF9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRTcmMgLSBUaGUgc291cmNlIGJsZW5kIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZERzdCAtIFRoZSBkZXN0aW5hdGlvbiBibGVuZCBmdW5jdGlvbi5cbiAgICAgKi9cbiAgICBzZXRCbGVuZEZ1bmN0aW9uKGJsZW5kU3JjLCBibGVuZERzdCkge1xuICAgICAgICBpZiAodGhpcy5ibGVuZFNyYyAhPT0gYmxlbmRTcmMgfHwgdGhpcy5ibGVuZERzdCAhPT0gYmxlbmREc3QgfHwgdGhpcy5zZXBhcmF0ZUFscGhhQmxlbmQpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmxlbmRGdW5jKHRoaXMuZ2xCbGVuZEZ1bmN0aW9uW2JsZW5kU3JjXSwgdGhpcy5nbEJsZW5kRnVuY3Rpb25bYmxlbmREc3RdKTtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRTcmMgPSBibGVuZFNyYztcbiAgICAgICAgICAgIHRoaXMuYmxlbmREc3QgPSBibGVuZERzdDtcbiAgICAgICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUJsZW5kID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGJsZW5kaW5nIG9wZXJhdGlvbnMuIEJvdGggc291cmNlIGFuZCBkZXN0aW5hdGlvbiBibGVuZCBtb2RlcyBjYW4gdGFrZSB0aGVcbiAgICAgKiBmb2xsb3dpbmcgdmFsdWVzOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1pFUk99XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9EU1RfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9EU1RfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEF9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRTcmMgLSBUaGUgc291cmNlIGJsZW5kIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZERzdCAtIFRoZSBkZXN0aW5hdGlvbiBibGVuZCBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRTcmNBbHBoYSAtIFRoZSBzZXBhcmF0ZSBzb3VyY2UgYmxlbmQgZnVuY3Rpb24gZm9yIHRoZSBhbHBoYSBjaGFubmVsLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZERzdEFscGhhIC0gVGhlIHNlcGFyYXRlIGRlc3RpbmF0aW9uIGJsZW5kIGZ1bmN0aW9uIGZvciB0aGUgYWxwaGEgY2hhbm5lbC5cbiAgICAgKi9cbiAgICBzZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUoYmxlbmRTcmMsIGJsZW5kRHN0LCBibGVuZFNyY0FscGhhLCBibGVuZERzdEFscGhhKSB7XG4gICAgICAgIGlmICh0aGlzLmJsZW5kU3JjICE9PSBibGVuZFNyYyB8fCB0aGlzLmJsZW5kRHN0ICE9PSBibGVuZERzdCB8fCB0aGlzLmJsZW5kU3JjQWxwaGEgIT09IGJsZW5kU3JjQWxwaGEgfHwgdGhpcy5ibGVuZERzdEFscGhhICE9PSBibGVuZERzdEFscGhhIHx8ICF0aGlzLnNlcGFyYXRlQWxwaGFCbGVuZCkge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZEZ1bmNTZXBhcmF0ZSh0aGlzLmdsQmxlbmRGdW5jdGlvbltibGVuZFNyY10sIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uW2JsZW5kRHN0XSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb25bYmxlbmRTcmNBbHBoYV0sIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uW2JsZW5kRHN0QWxwaGFdKTtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRTcmMgPSBibGVuZFNyYztcbiAgICAgICAgICAgIHRoaXMuYmxlbmREc3QgPSBibGVuZERzdDtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRTcmNBbHBoYSA9IGJsZW5kU3JjQWxwaGE7XG4gICAgICAgICAgICB0aGlzLmJsZW5kRHN0QWxwaGEgPSBibGVuZERzdEFscGhhO1xuICAgICAgICAgICAgdGhpcy5zZXBhcmF0ZUFscGhhQmxlbmQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyB0aGUgYmxlbmRpbmcgZXF1YXRpb24uIFRoZSBkZWZhdWx0IGJsZW5kIGVxdWF0aW9uIGlzIHtAbGluayBCTEVOREVRVUFUSU9OX0FERH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRFcXVhdGlvbiAtIFRoZSBibGVuZCBlcXVhdGlvbi4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9BRER9XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9TVUJUUkFDVH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX1JFVkVSU0VfU1VCVFJBQ1R9XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9NSU59XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9NQVh9XG4gICAgICpcbiAgICAgKiBOb3RlIHRoYXQgTUlOIGFuZCBNQVggbW9kZXMgcmVxdWlyZSBlaXRoZXIgRVhUX2JsZW5kX21pbm1heCBvciBXZWJHTDIgdG8gd29yayAoY2hlY2tcbiAgICAgKiBkZXZpY2UuZXh0QmxlbmRNaW5tYXgpLlxuICAgICAqL1xuICAgIHNldEJsZW5kRXF1YXRpb24oYmxlbmRFcXVhdGlvbikge1xuICAgICAgICBpZiAodGhpcy5ibGVuZEVxdWF0aW9uICE9PSBibGVuZEVxdWF0aW9uIHx8IHRoaXMuc2VwYXJhdGVBbHBoYUVxdWF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmJsZW5kRXF1YXRpb24odGhpcy5nbEJsZW5kRXF1YXRpb25bYmxlbmRFcXVhdGlvbl0pO1xuICAgICAgICAgICAgdGhpcy5ibGVuZEVxdWF0aW9uID0gYmxlbmRFcXVhdGlvbjtcbiAgICAgICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUVxdWF0aW9uID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHRoZSBibGVuZGluZyBlcXVhdGlvbi4gVGhlIGRlZmF1bHQgYmxlbmQgZXF1YXRpb24gaXMge0BsaW5rIEJMRU5ERVFVQVRJT05fQUREfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZEVxdWF0aW9uIC0gVGhlIGJsZW5kIGVxdWF0aW9uLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX0FERH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX1NVQlRSQUNUfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fUkVWRVJTRV9TVUJUUkFDVH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX01JTn1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX01BWH1cbiAgICAgKlxuICAgICAqIE5vdGUgdGhhdCBNSU4gYW5kIE1BWCBtb2RlcyByZXF1aXJlIGVpdGhlciBFWFRfYmxlbmRfbWlubWF4IG9yIFdlYkdMMiB0byB3b3JrIChjaGVja1xuICAgICAqIGRldmljZS5leHRCbGVuZE1pbm1heCkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kQWxwaGFFcXVhdGlvbiAtIEEgc2VwYXJhdGUgYmxlbmQgZXF1YXRpb24gZm9yIHRoZSBhbHBoYSBjaGFubmVsLlxuICAgICAqIEFjY2VwdHMgc2FtZSB2YWx1ZXMgYXMgYGJsZW5kRXF1YXRpb25gLlxuICAgICAqL1xuICAgIHNldEJsZW5kRXF1YXRpb25TZXBhcmF0ZShibGVuZEVxdWF0aW9uLCBibGVuZEFscGhhRXF1YXRpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuYmxlbmRFcXVhdGlvbiAhPT0gYmxlbmRFcXVhdGlvbiB8fCB0aGlzLmJsZW5kQWxwaGFFcXVhdGlvbiAhPT0gYmxlbmRBbHBoYUVxdWF0aW9uIHx8ICF0aGlzLnNlcGFyYXRlQWxwaGFFcXVhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZEVxdWF0aW9uU2VwYXJhdGUodGhpcy5nbEJsZW5kRXF1YXRpb25bYmxlbmRFcXVhdGlvbl0sIHRoaXMuZ2xCbGVuZEVxdWF0aW9uW2JsZW5kQWxwaGFFcXVhdGlvbl0pO1xuICAgICAgICAgICAgdGhpcy5ibGVuZEVxdWF0aW9uID0gYmxlbmRFcXVhdGlvbjtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRBbHBoYUVxdWF0aW9uID0gYmxlbmRBbHBoYUVxdWF0aW9uO1xuICAgICAgICAgICAgdGhpcy5zZXBhcmF0ZUFscGhhRXF1YXRpb24gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGJsZW5kaW5nIGZhY3RvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gciAtIFRoZSByZWQgY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZyAtIFRoZSBncmVlbiBjb21wb25lbnQgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gRGVmYXVsdCB2YWx1ZSBpcyAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gVGhlIGJsdWUgY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYSAtIFRoZSBhbHBoYSBjb21wb25lbnQgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gRGVmYXVsdCB2YWx1ZSBpcyAwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRCbGVuZENvbG9yKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgY29uc3QgYyA9IHRoaXMuYmxlbmRDb2xvcjtcbiAgICAgICAgaWYgKChyICE9PSBjLnIpIHx8IChnICE9PSBjLmcpIHx8IChiICE9PSBjLmIpIHx8IChhICE9PSBjLmEpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmJsZW5kQ29sb3IociwgZywgYiwgYSk7XG4gICAgICAgICAgICBjLnNldChyLCBnLCBiLCBhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyB0cmlhbmdsZXMgYXJlIGN1bGxlZCBiYXNlZCBvbiB0aGVpciBmYWNlIGRpcmVjdGlvbi4gVGhlIGRlZmF1bHQgY3VsbCBtb2RlIGlzXG4gICAgICoge0BsaW5rIENVTExGQUNFX0JBQ0t9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGN1bGxNb2RlIC0gVGhlIGN1bGwgbW9kZSB0byBzZXQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX05PTkV9XG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfQkFDS31cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9GUk9OVH1cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9GUk9OVEFOREJBQ0t9XG4gICAgICovXG4gICAgc2V0Q3VsbE1vZGUoY3VsbE1vZGUpIHtcbiAgICAgICAgaWYgKHRoaXMuY3VsbE1vZGUgIT09IGN1bGxNb2RlKSB7XG4gICAgICAgICAgICBpZiAoY3VsbE1vZGUgPT09IENVTExGQUNFX05PTkUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5DVUxMX0ZBQ0UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdWxsTW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLkNVTExfRkFDRSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZSA9IHRoaXMuZ2xDdWxsW2N1bGxNb2RlXTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdWxsRmFjZSAhPT0gbW9kZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmN1bGxGYWNlKG1vZGUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1bGxGYWNlID0gbW9kZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1bGxNb2RlID0gY3VsbE1vZGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBjdXJyZW50IGN1bGwgbW9kZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBjdXJyZW50IGN1bGwgbW9kZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0Q3VsbE1vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmN1bGxNb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGFjdGl2ZSBzaGFkZXIgdG8gYmUgdXNlZCBkdXJpbmcgc3Vic2VxdWVudCBkcmF3IGNhbGxzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gc2V0IHRvIGFzc2lnbiB0byB0aGUgZGV2aWNlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzaGFkZXIgd2FzIHN1Y2Nlc3NmdWxseSBzZXQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZXRTaGFkZXIoc2hhZGVyKSB7XG4gICAgICAgIGlmIChzaGFkZXIgIT09IHRoaXMuc2hhZGVyKSB7XG4gICAgICAgICAgICBpZiAoc2hhZGVyLmZhaWxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXNoYWRlci5yZWFkeSAmJiAhc2hhZGVyLmltcGwucG9zdExpbmsodGhpcywgc2hhZGVyKSkge1xuICAgICAgICAgICAgICAgIHNoYWRlci5mYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zaGFkZXIgPSBzaGFkZXI7XG5cbiAgICAgICAgICAgIC8vIFNldCB0aGUgYWN0aXZlIHNoYWRlclxuICAgICAgICAgICAgdGhpcy5nbC51c2VQcm9ncmFtKHNoYWRlci5pbXBsLmdsUHJvZ3JhbSk7XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUrKztcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNJbnZhbGlkYXRlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgc3VwcG9ydGVkIEhEUiBwaXhlbCBmb3JtYXQgZ2l2ZW4gYSBzZXQgb2YgaGFyZHdhcmUgc3VwcG9ydCByZXF1aXJlbWVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByZWZlckxhcmdlc3QgLSBJZiB0cnVlLCBwcmVmZXIgdGhlIGhpZ2hlc3QgcHJlY2lzaW9uIGZvcm1hdC4gT3RoZXJ3aXNlIHByZWZlciB0aGUgbG93ZXN0IHByZWNpc2lvbiBmb3JtYXQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSByZW5kZXJhYmxlIC0gSWYgdHJ1ZSwgb25seSBpbmNsdWRlIHBpeGVsIGZvcm1hdHMgdGhhdCBjYW4gYmUgdXNlZCBhcyByZW5kZXIgdGFyZ2V0cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHVwZGF0YWJsZSAtIElmIHRydWUsIG9ubHkgaW5jbHVkZSBmb3JtYXRzIHRoYXQgY2FuIGJlIHVwZGF0ZWQgYnkgdGhlIENQVS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZpbHRlcmFibGUgLSBJZiB0cnVlLCBvbmx5IGluY2x1ZGUgZm9ybWF0cyB0aGF0IHN1cHBvcnQgdGV4dHVyZSBmaWx0ZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgSERSIHBpeGVsIGZvcm1hdCBvciBudWxsIGlmIHRoZXJlIGFyZSBub25lLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRIZHJGb3JtYXQocHJlZmVyTGFyZ2VzdCwgcmVuZGVyYWJsZSwgdXBkYXRhYmxlLCBmaWx0ZXJhYmxlKSB7XG4gICAgICAgIC8vIE5vdGUgdGhhdCBmb3IgV2ViR0wyLCBQSVhFTEZPUk1BVF9SR0IxNkYgYW5kIFBJWEVMRk9STUFUX1JHQjMyRiBhcmUgbm90IHJlbmRlcmFibGUgYWNjb3JkaW5nIHRvIHRoaXM6XG4gICAgICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9FWFRfY29sb3JfYnVmZmVyX2Zsb2F0XG4gICAgICAgIC8vIEZvciBXZWJHTDEsIG9ubHkgUElYRUxGT1JNQVRfUkdCQTE2RiBhbmQgUElYRUxGT1JNQVRfUkdCQTMyRiBhcmUgdGVzdGVkIGZvciBiZWluZyByZW5kZXJhYmxlLlxuICAgICAgICBjb25zdCBmMTZWYWxpZCA9IHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCAmJlxuICAgICAgICAgICAgKCFyZW5kZXJhYmxlIHx8IHRoaXMudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUpICYmXG4gICAgICAgICAgICAoIXVwZGF0YWJsZSB8fCB0aGlzLnRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUpICYmXG4gICAgICAgICAgICAoIWZpbHRlcmFibGUgfHwgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyKTtcbiAgICAgICAgY29uc3QgZjMyVmFsaWQgPSB0aGlzLmV4dFRleHR1cmVGbG9hdCAmJlxuICAgICAgICAgICAgKCFyZW5kZXJhYmxlIHx8IHRoaXMudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSkgJiZcbiAgICAgICAgICAgICghZmlsdGVyYWJsZSB8fCB0aGlzLmV4dFRleHR1cmVGbG9hdExpbmVhcik7XG5cbiAgICAgICAgaWYgKGYxNlZhbGlkICYmIGYzMlZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZmVyTGFyZ2VzdCA/IFBJWEVMRk9STUFUX1JHQkEzMkYgOiBQSVhFTEZPUk1BVF9SR0JBMTZGO1xuICAgICAgICB9IGVsc2UgaWYgKGYxNlZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmIChmMzJWYWxpZCkge1xuICAgICAgICAgICAgcmV0dXJuIFBJWEVMRk9STUFUX1JHQkEzMkY7XG4gICAgICAgIH0gLyogZWxzZSAqL1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyBtZW1vcnkgZnJvbSBhbGwgc2hhZGVycyBldmVyIGFsbG9jYXRlZCB3aXRoIHRoaXMgZGV2aWNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNsZWFyU2hhZGVyQ2FjaGUoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgZm9yIChjb25zdCBzaGFkZXJTcmMgaW4gdGhpcy5mcmFnbWVudFNoYWRlckNhY2hlKSB7XG4gICAgICAgICAgICBnbC5kZWxldGVTaGFkZXIodGhpcy5mcmFnbWVudFNoYWRlckNhY2hlW3NoYWRlclNyY10pO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuZnJhZ21lbnRTaGFkZXJDYWNoZVtzaGFkZXJTcmNdO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyU3JjIGluIHRoaXMudmVydGV4U2hhZGVyQ2FjaGUpIHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVNoYWRlcih0aGlzLnZlcnRleFNoYWRlckNhY2hlW3NoYWRlclNyY10pO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMudmVydGV4U2hhZGVyQ2FjaGVbc2hhZGVyU3JjXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWVzIG1lbW9yeSBmcm9tIGFsbCB2ZXJ0ZXggYXJyYXkgb2JqZWN0cyBldmVyIGFsbG9jYXRlZCB3aXRoIHRoaXMgZGV2aWNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSgpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICB0aGlzLl92YW9NYXAuZm9yRWFjaCgoaXRlbSwga2V5LCBtYXBPYmopID0+IHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5KGl0ZW0pO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl92YW9NYXAuY2xlYXIoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaWR0aCBvZiB0aGUgYmFjayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdsLmRyYXdpbmdCdWZmZXJXaWR0aCB8fCB0aGlzLmNhbnZhcy53aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIZWlnaHQgb2YgdGhlIGJhY2sgYnVmZmVyIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGhlaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2wuZHJhd2luZ0J1ZmZlckhlaWdodCB8fCB0aGlzLmNhbnZhcy5oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnVsbHNjcmVlbiBtb2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZ1bGxzY3JlZW4oZnVsbHNjcmVlbikge1xuICAgICAgICBpZiAoZnVsbHNjcmVlbikge1xuICAgICAgICAgICAgY29uc3QgY2FudmFzID0gdGhpcy5nbC5jYW52YXM7XG4gICAgICAgICAgICBjYW52YXMucmVxdWVzdEZ1bGxzY3JlZW4oKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmV4aXRGdWxsc2NyZWVuKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZnVsbHNjcmVlbigpIHtcbiAgICAgICAgcmV0dXJuICEhZG9jdW1lbnQuZnVsbHNjcmVlbkVsZW1lbnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgaGlnaCBwcmVjaXNpb24gZmxvYXRpbmctcG9pbnQgdGV4dHVyZXMgYXJlIHN1cHBvcnRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB0ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID0gdGVzdFRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24odGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgdGV4dHVyZSB3aXRoIGhhbGYgZmxvYXQgZm9ybWF0IGNhbiBiZSB1cGRhdGVkIHdpdGggZGF0YS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB0ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlKCkge1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9IHRlc3RUZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlKHRoaXMuZ2wsIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdC5IQUxGX0ZMT0FUX09FUyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJnbEdyYXBoaWNzRGV2aWNlIH07XG4iXSwibmFtZXMiOlsiaW52YWxpZGF0ZUF0dGFjaG1lbnRzIiwiX2Z1bGxTY3JlZW5RdWFkVlMiLCJfcHJlY2lzaW9uVGVzdDFQUyIsIl9wcmVjaXNpb25UZXN0MlBTIiwiX291dHB1dFRleHR1cmUyRCIsInRlc3RSZW5kZXJhYmxlIiwiZ2wiLCJwaXhlbEZvcm1hdCIsInJlc3VsdCIsInRleHR1cmUiLCJjcmVhdGVUZXh0dXJlIiwiYmluZFRleHR1cmUiLCJURVhUVVJFXzJEIiwidGV4UGFyYW1ldGVyaSIsIlRFWFRVUkVfTUlOX0ZJTFRFUiIsIk5FQVJFU1QiLCJURVhUVVJFX01BR19GSUxURVIiLCJURVhUVVJFX1dSQVBfUyIsIkNMQU1QX1RPX0VER0UiLCJURVhUVVJFX1dSQVBfVCIsInRleEltYWdlMkQiLCJSR0JBIiwiZnJhbWVidWZmZXIiLCJjcmVhdGVGcmFtZWJ1ZmZlciIsImJpbmRGcmFtZWJ1ZmZlciIsIkZSQU1FQlVGRkVSIiwiZnJhbWVidWZmZXJUZXh0dXJlMkQiLCJDT0xPUl9BVFRBQ0hNRU5UMCIsImNoZWNrRnJhbWVidWZmZXJTdGF0dXMiLCJGUkFNRUJVRkZFUl9DT01QTEVURSIsImRlbGV0ZVRleHR1cmUiLCJkZWxldGVGcmFtZWJ1ZmZlciIsInRlc3RUZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlIiwiZGF0YSIsIlVpbnQxNkFycmF5IiwiZ2V0RXJyb3IiLCJOT19FUlJPUiIsImNvbnNvbGUiLCJsb2ciLCJ0ZXN0VGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiIsImRldmljZSIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJzaGFkZXIxIiwiU2hhZGVyIiwiU2hhZGVyVXRpbHMiLCJjcmVhdGVEZWZpbml0aW9uIiwibmFtZSIsInZlcnRleENvZGUiLCJmcmFnbWVudENvZGUiLCJzaGFkZXIyIiwidGV4dHVyZU9wdGlvbnMiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwid2lkdGgiLCJoZWlnaHQiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJ0ZXgxIiwiVGV4dHVyZSIsInRhcmcxIiwiUmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJkZXB0aCIsImRyYXdRdWFkV2l0aFNoYWRlciIsIlBJWEVMRk9STUFUX1JHQkE4IiwidGV4MiIsInRhcmcyIiwiY29uc3RhbnRUZXhTb3VyY2UiLCJzZXRWYWx1ZSIsInByZXZGcmFtZWJ1ZmZlciIsImFjdGl2ZUZyYW1lYnVmZmVyIiwic2V0RnJhbWVidWZmZXIiLCJpbXBsIiwiX2dsRnJhbWVCdWZmZXIiLCJwaXhlbHMiLCJVaW50OEFycmF5IiwicmVhZFBpeGVscyIsIngiLCJ5IiwieiIsInciLCJmIiwiZGVzdHJveSIsInRlc3RJbWFnZUJpdG1hcCIsInBuZ0J5dGVzIiwiY3JlYXRlSW1hZ2VCaXRtYXAiLCJCbG9iIiwidHlwZSIsInByZW11bHRpcGx5QWxwaGEiLCJ0aGVuIiwiaW1hZ2UiLCJsZXZlbHMiLCJydCIsImluaXRSZW5kZXJUYXJnZXQiLCJVaW50OENsYW1wZWRBcnJheSIsIlVOU0lHTkVEX0JZVEUiLCJjYXRjaCIsImUiLCJXZWJnbEdyYXBoaWNzRGV2aWNlIiwiR3JhcGhpY3NEZXZpY2UiLCJjb25zdHJ1Y3RvciIsImNhbnZhcyIsIm9wdGlvbnMiLCJ3ZWJnbDIiLCJkZXZpY2VUeXBlIiwiREVWSUNFVFlQRV9XRUJHTCIsImRlZmF1bHRGcmFtZWJ1ZmZlciIsInVwZGF0ZUNsaWVudFJlY3QiLCJjb250ZXh0TG9zdCIsIl9jb250ZXh0TG9zdEhhbmRsZXIiLCJldmVudCIsInByZXZlbnREZWZhdWx0IiwibG9zZUNvbnRleHQiLCJEZWJ1ZyIsImZpcmUiLCJfY29udGV4dFJlc3RvcmVkSGFuZGxlciIsInJlc3RvcmVDb250ZXh0Iiwic3RlbmNpbCIsInBvd2VyUHJlZmVyZW5jZSIsInVhIiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZyIsImluY2x1ZGVzIiwiYW50aWFsaWFzIiwicHJlZmVyV2ViR2wyIiwidW5kZWZpbmVkIiwibmFtZXMiLCJpIiwibGVuZ3RoIiwiZ2V0Q29udGV4dCIsIkVycm9yIiwiYWxwaGFCaXRzIiwiZ2V0UGFyYW1ldGVyIiwiQUxQSEFfQklUUyIsImZyYW1lYnVmZmVyRm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCOCIsImlzQ2hyb21lIiwicGxhdGZvcm0iLCJicm93c2VyIiwid2luZG93IiwiY2hyb21lIiwiaXNNYWMiLCJhcHBWZXJzaW9uIiwiaW5kZXhPZiIsIl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kIiwic2FmYXJpIiwiX3RlbXBNYWNDaHJvbWVCbGl0RnJhbWVidWZmZXJXb3JrYXJvdW5kIiwiYWxwaGEiLCJzZXR1cFZlcnRleEFycmF5T2JqZWN0IiwiYWRkRXZlbnRMaXN0ZW5lciIsImluaXRpYWxpemVFeHRlbnNpb25zIiwiaW5pdGlhbGl6ZUNhcGFiaWxpdGllcyIsImluaXRpYWxpemVSZW5kZXJTdGF0ZSIsImluaXRpYWxpemVDb250ZXh0Q2FjaGVzIiwic3VwcG9ydHNJbWFnZUJpdG1hcCIsIkltYWdlQml0bWFwIiwiZGVmYXVsdENsZWFyT3B0aW9ucyIsImNvbG9yIiwiZmxhZ3MiLCJDTEVBUkZMQUdfQ09MT1IiLCJDTEVBUkZMQUdfREVQVEgiLCJnbEFkZHJlc3MiLCJSRVBFQVQiLCJNSVJST1JFRF9SRVBFQVQiLCJnbEJsZW5kRXF1YXRpb24iLCJGVU5DX0FERCIsIkZVTkNfU1VCVFJBQ1QiLCJGVU5DX1JFVkVSU0VfU1VCVFJBQ1QiLCJNSU4iLCJleHRCbGVuZE1pbm1heCIsIk1JTl9FWFQiLCJNQVgiLCJNQVhfRVhUIiwiZ2xCbGVuZEZ1bmN0aW9uIiwiWkVSTyIsIk9ORSIsIlNSQ19DT0xPUiIsIk9ORV9NSU5VU19TUkNfQ09MT1IiLCJEU1RfQ09MT1IiLCJPTkVfTUlOVVNfRFNUX0NPTE9SIiwiU1JDX0FMUEhBIiwiU1JDX0FMUEhBX1NBVFVSQVRFIiwiT05FX01JTlVTX1NSQ19BTFBIQSIsIkRTVF9BTFBIQSIsIk9ORV9NSU5VU19EU1RfQUxQSEEiLCJDT05TVEFOVF9DT0xPUiIsIk9ORV9NSU5VU19DT05TVEFOVF9DT0xPUiIsIkNPTlNUQU5UX0FMUEhBIiwiT05FX01JTlVTX0NPTlNUQU5UX0FMUEhBIiwiZ2xDb21wYXJpc29uIiwiTkVWRVIiLCJMRVNTIiwiRVFVQUwiLCJMRVFVQUwiLCJHUkVBVEVSIiwiTk9URVFVQUwiLCJHRVFVQUwiLCJBTFdBWVMiLCJnbFN0ZW5jaWxPcCIsIktFRVAiLCJSRVBMQUNFIiwiSU5DUiIsIklOQ1JfV1JBUCIsIkRFQ1IiLCJERUNSX1dSQVAiLCJJTlZFUlQiLCJnbENsZWFyRmxhZyIsIkNPTE9SX0JVRkZFUl9CSVQiLCJERVBUSF9CVUZGRVJfQklUIiwiU1RFTkNJTF9CVUZGRVJfQklUIiwiZ2xDdWxsIiwiQkFDSyIsIkZST05UIiwiRlJPTlRfQU5EX0JBQ0siLCJnbEZpbHRlciIsIkxJTkVBUiIsIk5FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJMSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJMSU5FQVJfTUlQTUFQX0xJTkVBUiIsImdsUHJpbWl0aXZlIiwiUE9JTlRTIiwiTElORVMiLCJMSU5FX0xPT1AiLCJMSU5FX1NUUklQIiwiVFJJQU5HTEVTIiwiVFJJQU5HTEVfU1RSSVAiLCJUUklBTkdMRV9GQU4iLCJnbFR5cGUiLCJCWVRFIiwiU0hPUlQiLCJVTlNJR05FRF9TSE9SVCIsIklOVCIsIlVOU0lHTkVEX0lOVCIsIkZMT0FUIiwicGNVbmlmb3JtVHlwZSIsIkJPT0wiLCJVTklGT1JNVFlQRV9CT09MIiwiVU5JRk9STVRZUEVfSU5UIiwiVU5JRk9STVRZUEVfRkxPQVQiLCJGTE9BVF9WRUMyIiwiVU5JRk9STVRZUEVfVkVDMiIsIkZMT0FUX1ZFQzMiLCJVTklGT1JNVFlQRV9WRUMzIiwiRkxPQVRfVkVDNCIsIlVOSUZPUk1UWVBFX1ZFQzQiLCJJTlRfVkVDMiIsIlVOSUZPUk1UWVBFX0lWRUMyIiwiSU5UX1ZFQzMiLCJVTklGT1JNVFlQRV9JVkVDMyIsIklOVF9WRUM0IiwiVU5JRk9STVRZUEVfSVZFQzQiLCJCT09MX1ZFQzIiLCJVTklGT1JNVFlQRV9CVkVDMiIsIkJPT0xfVkVDMyIsIlVOSUZPUk1UWVBFX0JWRUMzIiwiQk9PTF9WRUM0IiwiVU5JRk9STVRZUEVfQlZFQzQiLCJGTE9BVF9NQVQyIiwiVU5JRk9STVRZUEVfTUFUMiIsIkZMT0FUX01BVDMiLCJVTklGT1JNVFlQRV9NQVQzIiwiRkxPQVRfTUFUNCIsIlVOSUZPUk1UWVBFX01BVDQiLCJTQU1QTEVSXzJEIiwiVU5JRk9STVRZUEVfVEVYVFVSRTJEIiwiU0FNUExFUl9DVUJFIiwiVU5JRk9STVRZUEVfVEVYVFVSRUNVQkUiLCJTQU1QTEVSXzJEX1NIQURPVyIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1ciLCJTQU1QTEVSX0NVQkVfU0hBRE9XIiwiVU5JRk9STVRZUEVfVEVYVFVSRUNVQkVfU0hBRE9XIiwiU0FNUExFUl8zRCIsIlVOSUZPUk1UWVBFX1RFWFRVUkUzRCIsInRhcmdldFRvU2xvdCIsIlRFWFRVUkVfQ1VCRV9NQVAiLCJURVhUVVJFXzNEIiwic2NvcGVYIiwic2NvcGVZIiwic2NvcGVaIiwic2NvcGVXIiwidW5pZm9ybVZhbHVlIiwiY29tbWl0RnVuY3Rpb24iLCJ1bmlmb3JtIiwidmFsdWUiLCJ1bmlmb3JtMWkiLCJsb2NhdGlvbklkIiwidW5pZm9ybTFmIiwidW5pZm9ybTJmdiIsInVuaWZvcm0zZnYiLCJ1bmlmb3JtNGZ2IiwidW5pZm9ybTJpdiIsInVuaWZvcm0zaXYiLCJ1bmlmb3JtNGl2IiwidW5pZm9ybU1hdHJpeDJmdiIsInVuaWZvcm1NYXRyaXgzZnYiLCJ1bmlmb3JtTWF0cml4NGZ2IiwiVU5JRk9STVRZUEVfRkxPQVRBUlJBWSIsInVuaWZvcm0xZnYiLCJVTklGT1JNVFlQRV9WRUMyQVJSQVkiLCJVTklGT1JNVFlQRV9WRUMzQVJSQVkiLCJVTklGT1JNVFlQRV9WRUM0QVJSQVkiLCJzdXBwb3J0c0JvbmVUZXh0dXJlcyIsImV4dFRleHR1cmVGbG9hdCIsIm1heFZlcnRleFRleHR1cmVzIiwibnVtVW5pZm9ybXMiLCJ2ZXJ0ZXhVbmlmb3Jtc0NvdW50IiwiYm9uZUxpbWl0IiwiTWF0aCIsImZsb29yIiwibWluIiwidW5tYXNrZWRSZW5kZXJlciIsInNjb3BlIiwicmVzb2x2ZSIsImV4dENvbG9yQnVmZmVyRmxvYXQiLCJleHRDb2xvckJ1ZmZlckhhbGZGbG9hdCIsInRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlIiwiZXh0VGV4dHVyZUhhbGZGbG9hdCIsIkhBTEZfRkxPQVRfT0VTIiwic3VwcG9ydHNNb3JwaFRhcmdldFRleHR1cmVzQ29yZSIsIm1heFByZWNpc2lvbiIsIl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uIiwiX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJfc3BlY3Rvck1hcmtlcnMiLCJfc3BlY3RvckN1cnJlbnRNYXJrZXIiLCJhcmVhTGlnaHRMdXRGb3JtYXQiLCJ0ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlIiwiZXh0VGV4dHVyZUhhbGZGbG9hdExpbmVhciIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJleHRUZXh0dXJlRmxvYXRMaW5lYXIiLCJmZWVkYmFjayIsImRlbGV0ZVRyYW5zZm9ybUZlZWRiYWNrIiwiY2xlYXJTaGFkZXJDYWNoZSIsImNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJwb3N0RGVzdHJveSIsImNyZWF0ZVZlcnRleEJ1ZmZlckltcGwiLCJ2ZXJ0ZXhCdWZmZXIiLCJXZWJnbFZlcnRleEJ1ZmZlciIsImNyZWF0ZUluZGV4QnVmZmVySW1wbCIsImluZGV4QnVmZmVyIiwiV2ViZ2xJbmRleEJ1ZmZlciIsImNyZWF0ZVNoYWRlckltcGwiLCJzaGFkZXIiLCJXZWJnbFNoYWRlciIsImNyZWF0ZVRleHR1cmVJbXBsIiwiV2ViZ2xUZXh0dXJlIiwiY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbCIsInJlbmRlclRhcmdldCIsIldlYmdsUmVuZGVyVGFyZ2V0IiwidXBkYXRlTWFya2VyIiwiam9pbiIsInB1c2hNYXJrZXIiLCJzcGVjdG9yIiwicHVzaCIsInNldE1hcmtlciIsInBvcE1hcmtlciIsInBvcCIsImNsZWFyTWFya2VyIiwiZ2V0UHJlY2lzaW9uIiwicHJlY2lzaW9uIiwiZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0IiwidmVydGV4U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdCIsIlZFUlRFWF9TSEFERVIiLCJISUdIX0ZMT0FUIiwidmVydGV4U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0IiwiTUVESVVNX0ZMT0FUIiwiZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0IiwiRlJBR01FTlRfU0hBREVSIiwiZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQiLCJoaWdocEF2YWlsYWJsZSIsIm1lZGl1bXBBdmFpbGFibGUiLCJ3YXJuIiwic3VwcG9ydGVkRXh0ZW5zaW9ucyIsImdldFN1cHBvcnRlZEV4dGVuc2lvbnMiLCJnZXRFeHRlbnNpb24iLCJhcmd1bWVudHMiLCJleHREcmF3QnVmZmVycyIsImV4dEluc3RhbmNpbmciLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwiZXh0VGV4dHVyZUxvZCIsImV4dFVpbnRFbGVtZW50IiwiZXh0VmVydGV4QXJyYXlPYmplY3QiLCJleHREaXNqb2ludFRpbWVyUXVlcnkiLCJleHREZXB0aFRleHR1cmUiLCJleHQiLCJkcmF3QXJyYXlzSW5zdGFuY2VkIiwiZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFIiwiYmluZCIsImRyYXdFbGVtZW50c0luc3RhbmNlZCIsImRyYXdFbGVtZW50c0luc3RhbmNlZEFOR0xFIiwidmVydGV4QXR0cmliRGl2aXNvciIsInZlcnRleEF0dHJpYkRpdmlzb3JBTkdMRSIsImNyZWF0ZVZlcnRleEFycmF5IiwiY3JlYXRlVmVydGV4QXJyYXlPRVMiLCJkZWxldGVWZXJ0ZXhBcnJheSIsImRlbGV0ZVZlcnRleEFycmF5T0VTIiwiaXNWZXJ0ZXhBcnJheSIsImlzVmVydGV4QXJyYXlPRVMiLCJiaW5kVmVydGV4QXJyYXkiLCJiaW5kVmVydGV4QXJyYXlPRVMiLCJleHREZWJ1Z1JlbmRlcmVySW5mbyIsImV4dEZsb2F0QmxlbmQiLCJleHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQzEiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZVMzVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyIsImV4dFBhcmFsbGVsU2hhZGVyQ29tcGlsZSIsImNvbnRleHRBdHRyaWJzIiwiZ2V0Q29udGV4dEF0dHJpYnV0ZXMiLCJzdXBwb3J0c01zYWEiLCJzdXBwb3J0c1N0ZW5jaWwiLCJzdXBwb3J0c0luc3RhbmNpbmciLCJtYXhUZXh0dXJlU2l6ZSIsIk1BWF9URVhUVVJFX1NJWkUiLCJtYXhDdWJlTWFwU2l6ZSIsIk1BWF9DVUJFX01BUF9URVhUVVJFX1NJWkUiLCJtYXhSZW5kZXJCdWZmZXJTaXplIiwiTUFYX1JFTkRFUkJVRkZFUl9TSVpFIiwibWF4VGV4dHVyZXMiLCJNQVhfVEVYVFVSRV9JTUFHRV9VTklUUyIsIm1heENvbWJpbmVkVGV4dHVyZXMiLCJNQVhfQ09NQklORURfVEVYVFVSRV9JTUFHRV9VTklUUyIsIk1BWF9WRVJURVhfVEVYVFVSRV9JTUFHRV9VTklUUyIsIk1BWF9WRVJURVhfVU5JRk9STV9WRUNUT1JTIiwiZnJhZ21lbnRVbmlmb3Jtc0NvdW50IiwiTUFYX0ZSQUdNRU5UX1VOSUZPUk1fVkVDVE9SUyIsIm1heERyYXdCdWZmZXJzIiwiTUFYX0RSQVdfQlVGRkVSUyIsIm1heENvbG9yQXR0YWNobWVudHMiLCJNQVhfQ09MT1JfQVRUQUNITUVOVFMiLCJtYXhWb2x1bWVTaXplIiwiTUFYXzNEX1RFWFRVUkVfU0laRSIsIk1BWF9EUkFXX0JVRkZFUlNfRVhUIiwiTUFYX0NPTE9SX0FUVEFDSE1FTlRTX0VYVCIsIlVOTUFTS0VEX1JFTkRFUkVSX1dFQkdMIiwidW5tYXNrZWRWZW5kb3IiLCJVTk1BU0tFRF9WRU5ET1JfV0VCR0wiLCJzYW1zdW5nTW9kZWxSZWdleCIsInN1cHBvcnRzR3B1UGFydGljbGVzIiwibWF0Y2giLCJtYXhBbmlzb3Ryb3B5IiwiTUFYX1RFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUIiwic2FtcGxlcyIsIlNBTVBMRVMiLCJtYXhTYW1wbGVzIiwiTUFYX1NBTVBMRVMiLCJzdXBwb3J0c0FyZWFMaWdodHMiLCJhbmRyb2lkIiwic3VwcG9ydHNUZXh0dXJlRmV0Y2giLCJibGVuZGluZyIsImRpc2FibGUiLCJCTEVORCIsImJsZW5kU3JjIiwiQkxFTkRNT0RFX09ORSIsImJsZW5kRHN0IiwiQkxFTkRNT0RFX1pFUk8iLCJibGVuZFNyY0FscGhhIiwiYmxlbmREc3RBbHBoYSIsInNlcGFyYXRlQWxwaGFCbGVuZCIsImJsZW5kRXF1YXRpb24iLCJCTEVOREVRVUFUSU9OX0FERCIsImJsZW5kQWxwaGFFcXVhdGlvbiIsInNlcGFyYXRlQWxwaGFFcXVhdGlvbiIsImJsZW5kRnVuYyIsImJsZW5kQ29sb3IiLCJDb2xvciIsIndyaXRlUmVkIiwid3JpdGVHcmVlbiIsIndyaXRlQmx1ZSIsIndyaXRlQWxwaGEiLCJjb2xvck1hc2siLCJjdWxsTW9kZSIsIkNVTExGQUNFX0JBQ0siLCJlbmFibGUiLCJDVUxMX0ZBQ0UiLCJjdWxsRmFjZSIsImRlcHRoVGVzdCIsIkRFUFRIX1RFU1QiLCJkZXB0aEZ1bmMiLCJGVU5DX0xFU1NFUVVBTCIsImRlcHRoV3JpdGUiLCJkZXB0aE1hc2siLCJTVEVOQ0lMX1RFU1QiLCJzdGVuY2lsRnVuY0Zyb250Iiwic3RlbmNpbEZ1bmNCYWNrIiwiRlVOQ19BTFdBWVMiLCJzdGVuY2lsUmVmRnJvbnQiLCJzdGVuY2lsUmVmQmFjayIsInN0ZW5jaWxNYXNrRnJvbnQiLCJzdGVuY2lsTWFza0JhY2siLCJzdGVuY2lsRnVuYyIsInN0ZW5jaWxGYWlsRnJvbnQiLCJzdGVuY2lsRmFpbEJhY2siLCJTVEVOQ0lMT1BfS0VFUCIsInN0ZW5jaWxaZmFpbEZyb250Iiwic3RlbmNpbFpmYWlsQmFjayIsInN0ZW5jaWxacGFzc0Zyb250Iiwic3RlbmNpbFpwYXNzQmFjayIsInN0ZW5jaWxXcml0ZU1hc2tGcm9udCIsInN0ZW5jaWxXcml0ZU1hc2tCYWNrIiwic3RlbmNpbE9wIiwic3RlbmNpbE1hc2siLCJhbHBoYVRvQ292ZXJhZ2UiLCJyYXN0ZXIiLCJTQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UiLCJSQVNURVJJWkVSX0RJU0NBUkQiLCJkZXB0aEJpYXNFbmFibGVkIiwiUE9MWUdPTl9PRkZTRVRfRklMTCIsImNsZWFyRGVwdGgiLCJjbGVhckNvbG9yIiwiY2xlYXJTdGVuY2lsIiwidngiLCJ2eSIsInZ3IiwidmgiLCJzeCIsInN5Iiwic3ciLCJzaCIsImhpbnQiLCJGUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5UIiwiTklDRVNUIiwiRlJBR01FTlRfU0hBREVSX0RFUklWQVRJVkVfSElOVF9PRVMiLCJTQ0lTU09SX1RFU1QiLCJwaXhlbFN0b3JlaSIsIlVOUEFDS19DT0xPUlNQQUNFX0NPTlZFUlNJT05fV0VCR0wiLCJOT05FIiwidW5wYWNrRmxpcFkiLCJVTlBBQ0tfRkxJUF9ZX1dFQkdMIiwidW5wYWNrUHJlbXVsdGlwbHlBbHBoYSIsIlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCIsIlVOUEFDS19BTElHTk1FTlQiLCJ2ZXJ0ZXhTaGFkZXJDYWNoZSIsImZyYWdtZW50U2hhZGVyQ2FjaGUiLCJfdmFvTWFwIiwiTWFwIiwiYm91bmRWYW8iLCJ0cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciIsInRleHR1cmVVbml0IiwidGV4dHVyZVVuaXRzIiwic2hhZGVycyIsInRleHR1cmVzIiwiYnVmZmVyIiwiYnVmZmVycyIsInRhcmdldCIsInRhcmdldHMiLCJ1bmxvY2siLCJzZXRWaWV3cG9ydCIsImgiLCJ2aWV3cG9ydCIsInNldFNjaXNzb3IiLCJzY2lzc29yIiwiZmIiLCJjb3B5UmVuZGVyVGFyZ2V0Iiwic291cmNlIiwiZGVzdCIsImVycm9yIiwiX2NvbG9yQnVmZmVyIiwiX2Zvcm1hdCIsIl9kZXB0aCIsIl9kZXB0aEJ1ZmZlciIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwicHJldlJ0IiwidXBkYXRlQmVnaW4iLCJSRUFEX0ZSQU1FQlVGRkVSIiwiRFJBV19GUkFNRUJVRkZFUiIsImJsaXRGcmFtZWJ1ZmZlciIsImdldENvcHlTaGFkZXIiLCJwb3BHcHVNYXJrZXIiLCJfY29weVNoYWRlciIsInN0YXJ0UGFzcyIsInJlbmRlclBhc3MiLCJzZXRSZW5kZXJUYXJnZXQiLCJjb2xvck9wcyIsImRlcHRoU3RlbmNpbE9wcyIsImNsZWFyIiwiY2xlYXJGbGFncyIsImNsZWFyT3B0aW9ucyIsImNsZWFyVmFsdWUiLCJyIiwiZyIsImIiLCJhIiwiY2xlYXJEZXB0aFZhbHVlIiwiQ0xFQVJGTEFHX1NURU5DSUwiLCJjbGVhclN0ZW5jaWxWYWx1ZSIsImFzc2VydCIsImluc2lkZVJlbmRlclBhc3MiLCJlbmRQYXNzIiwidW5iaW5kVmVydGV4QXJyYXkiLCJzdG9yZSIsInN0b3JlRGVwdGgiLCJERVBUSF9BVFRBQ0hNRU5UIiwic3RvcmVTdGVuY2lsIiwiU1RFTkNJTF9BVFRBQ0hNRU5UIiwiZnVsbFNpemVDbGVhclJlY3QiLCJpbnZhbGlkYXRlRnJhbWVidWZmZXIiLCJhdXRvUmVzb2x2ZSIsIl9nbFRleHR1cmUiLCJwb3QiLCJhY3RpdmVUZXh0dXJlIiwiZ2VuZXJhdGVNaXBtYXAiLCJfZ2xUYXJnZXQiLCJ1bml0Iiwic2xvdCIsImluaXRpYWxpemVkIiwidXBkYXRlRW5kIiwiX3NhbXBsZXMiLCJzZXRVbnBhY2tGbGlwWSIsImZsaXBZIiwic2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSIsIlRFWFRVUkUwIiwidGV4dHVyZVRhcmdldCIsInRleHR1cmVPYmplY3QiLCJiaW5kVGV4dHVyZU9uVW5pdCIsInNldFRleHR1cmVQYXJhbWV0ZXJzIiwiX3BhcmFtZXRlckZsYWdzIiwiZmlsdGVyIiwiX21pbkZpbHRlciIsIl9taXBtYXBzIiwiX2NvbXByZXNzZWQiLCJfbGV2ZWxzIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVIiLCJfbWFnRmlsdGVyIiwiX2FkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiX2FkZHJlc3NWIiwiVEVYVFVSRV9XUkFQX1IiLCJfYWRkcmVzc1ciLCJURVhUVVJFX0NPTVBBUkVfTU9ERSIsIl9jb21wYXJlT25SZWFkIiwiQ09NUEFSRV9SRUZfVE9fVEVYVFVSRSIsIlRFWFRVUkVfQ09NUEFSRV9GVU5DIiwiX2NvbXBhcmVGdW5jIiwidGV4UGFyYW1ldGVyZiIsIlRFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUIiwibWF4Iiwicm91bmQiLCJfYW5pc290cm9weSIsInNldFRleHR1cmUiLCJpbml0aWFsaXplIiwiX25lZWRzVXBsb2FkIiwiX25lZWRzTWlwbWFwc1VwbG9hZCIsInVwbG9hZCIsInZlcnRleEJ1ZmZlcnMiLCJrZXkiLCJ2YW8iLCJ1c2VDYWNoZSIsImlkIiwicmVuZGVyaW5naW5nSGFzaCIsImdldCIsImJpbmRCdWZmZXIiLCJFTEVNRU5UX0FSUkFZX0JVRkZFUiIsImxvY1plcm8iLCJBUlJBWV9CVUZGRVIiLCJidWZmZXJJZCIsImVsZW1lbnRzIiwiaiIsImxvYyIsInNlbWFudGljVG9Mb2NhdGlvbiIsInZlcnRleEF0dHJpYlBvaW50ZXIiLCJudW1Db21wb25lbnRzIiwiZGF0YVR5cGUiLCJub3JtYWxpemUiLCJzdHJpZGUiLCJvZmZzZXQiLCJlbmFibGVWZXJ0ZXhBdHRyaWJBcnJheSIsImluc3RhbmNpbmciLCJzZXQiLCJzZXRCdWZmZXJzIiwiZHJhdyIsInByaW1pdGl2ZSIsIm51bUluc3RhbmNlcyIsImtlZXBCdWZmZXJzIiwic2FtcGxlciIsInNhbXBsZXJWYWx1ZSIsIm51bVRleHR1cmVzIiwic2NvcGVJZCIsInVuaWZvcm1WZXJzaW9uIiwicHJvZ3JhbVZlcnNpb24iLCJzYW1wbGVycyIsInVuaWZvcm1zIiwibGVuIiwic2FtcGxlck5hbWUiLCJ3YXJuT25jZSIsImRlcHRoQnVmZmVyIiwiYXJyYXkiLCJ1bmlmb3JtMWl2IiwidmVyc2lvbiIsInZlcnNpb25PYmplY3QiLCJnbG9iYWxJZCIsInJldmlzaW9uIiwiYmluZEJ1ZmZlckJhc2UiLCJUUkFOU0ZPUk1fRkVFREJBQ0tfQlVGRkVSIiwiYmVnaW5UcmFuc2Zvcm1GZWVkYmFjayIsIm1vZGUiLCJjb3VudCIsImluZGV4ZWQiLCJnbEZvcm1hdCIsImJhc2UiLCJieXRlc1BlckluZGV4IiwiZHJhd0VsZW1lbnRzIiwiZmlyc3QiLCJkcmF3QXJyYXlzIiwiZW5kVHJhbnNmb3JtRmVlZGJhY2siLCJfZHJhd0NhbGxzUGVyRnJhbWUiLCJfcHJpbXNQZXJGcmFtZSIsImRlZmF1bHRPcHRpb25zIiwic2V0Q2xlYXJDb2xvciIsInNldENvbG9yV3JpdGUiLCJzZXRDbGVhckRlcHRoIiwic2V0RGVwdGhXcml0ZSIsInNldENsZWFyU3RlbmNpbCIsImMiLCJnZXREZXB0aFRlc3QiLCJzZXREZXB0aFRlc3QiLCJzZXREZXB0aEZ1bmMiLCJmdW5jIiwiZ2V0RGVwdGhXcml0ZSIsIndyaXRlRGVwdGgiLCJzZXRBbHBoYVRvQ292ZXJhZ2UiLCJzdGF0ZSIsInNldFRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyIiwidGYiLCJjcmVhdGVUcmFuc2Zvcm1GZWVkYmFjayIsImJpbmRUcmFuc2Zvcm1GZWVkYmFjayIsIlRSQU5TRk9STV9GRUVEQkFDSyIsInNldFJhc3RlciIsIm9uIiwic2V0RGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwiY29uc3RCaWFzIiwic2xvcGVCaWFzIiwicG9seWdvbk9mZnNldCIsImdldEJsZW5kaW5nIiwic2V0QmxlbmRpbmciLCJzZXRTdGVuY2lsVGVzdCIsInNldFN0ZW5jaWxGdW5jIiwicmVmIiwibWFzayIsInNldFN0ZW5jaWxGdW5jRnJvbnQiLCJzdGVuY2lsRnVuY1NlcGFyYXRlIiwic2V0U3RlbmNpbEZ1bmNCYWNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbiIsImZhaWwiLCJ6ZmFpbCIsInpwYXNzIiwid3JpdGVNYXNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbkZyb250Iiwic3RlbmNpbE9wU2VwYXJhdGUiLCJzdGVuY2lsTWFza1NlcGFyYXRlIiwic2V0U3RlbmNpbE9wZXJhdGlvbkJhY2siLCJzZXRCbGVuZEZ1bmN0aW9uIiwic2V0QmxlbmRGdW5jdGlvblNlcGFyYXRlIiwiYmxlbmRGdW5jU2VwYXJhdGUiLCJzZXRCbGVuZEVxdWF0aW9uIiwic2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlIiwiYmxlbmRFcXVhdGlvblNlcGFyYXRlIiwic2V0QmxlbmRDb2xvciIsInNldEN1bGxNb2RlIiwiQ1VMTEZBQ0VfTk9ORSIsImdldEN1bGxNb2RlIiwic2V0U2hhZGVyIiwiZmFpbGVkIiwicmVhZHkiLCJwb3N0TGluayIsInVzZVByb2dyYW0iLCJnbFByb2dyYW0iLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsImF0dHJpYnV0ZXNJbnZhbGlkYXRlZCIsImdldEhkckZvcm1hdCIsInByZWZlckxhcmdlc3QiLCJyZW5kZXJhYmxlIiwidXBkYXRhYmxlIiwiZmlsdGVyYWJsZSIsImYxNlZhbGlkIiwiZjMyVmFsaWQiLCJzaGFkZXJTcmMiLCJkZWxldGVTaGFkZXIiLCJmb3JFYWNoIiwiaXRlbSIsIm1hcE9iaiIsImRyYXdpbmdCdWZmZXJXaWR0aCIsImRyYXdpbmdCdWZmZXJIZWlnaHQiLCJmdWxsc2NyZWVuIiwicmVxdWVzdEZ1bGxzY3JlZW4iLCJkb2N1bWVudCIsImV4aXRGdWxsc2NyZWVuIiwiZnVsbHNjcmVlbkVsZW1lbnQiLCJ0ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXVDQSxNQUFNQSxxQkFBcUIsR0FBRyxFQUFFLENBQUE7QUFFaEMsTUFBTUMsaUJBQWlCLEdBQWMsQ0FBQTtBQUNyQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FBQTtBQUVELE1BQU1DLGlCQUFpQixHQUFjLENBQUE7QUFDckM7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsaUJBQWlCLEdBQWMsQ0FBQTtBQUNyQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FBQTtBQUVELE1BQU1DLGdCQUFnQixHQUFjLENBQUE7QUFDcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FB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
