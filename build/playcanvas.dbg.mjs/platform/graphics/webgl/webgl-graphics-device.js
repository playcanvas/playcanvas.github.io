/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { setupVertexArrayObject } from '../../../polyfill/OESVertexArrayObject.js';
import { Debug } from '../../../core/debug.js';
import { platform } from '../../../core/platform.js';
import { Color } from '../../../core/math/color.js';
import { DEVICETYPE_WEBGL, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, BLENDMODE_ONE, BLENDMODE_ZERO, BLENDEQUATION_ADD, CULLFACE_BACK, FUNC_LESSEQUAL, FUNC_ALWAYS, STENCILOP_KEEP, ADDRESS_CLAMP_TO_EDGE, semanticToLocation, CLEARFLAG_STENCIL, CULLFACE_NONE, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR } from '../constants.js';
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
  textureOptions.format = PIXELFORMAT_R8_G8_B8_A8;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNldHVwVmVydGV4QXJyYXlPYmplY3QgfSBmcm9tICcuLi8uLi8uLi9wb2x5ZmlsbC9PRVNWZXJ0ZXhBcnJheU9iamVjdC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHtcbiAgICBERVZJQ0VUWVBFX1dFQkdMLFxuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBCTEVOREVRVUFUSU9OX0FERCxcbiAgICBCTEVORE1PREVfWkVSTywgQkxFTkRNT0RFX09ORSxcbiAgICBDTEVBUkZMQUdfQ09MT1IsIENMRUFSRkxBR19ERVBUSCwgQ0xFQVJGTEFHX1NURU5DSUwsXG4gICAgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfTk9ORSxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIEZVTkNfQUxXQVlTLCBGVU5DX0xFU1NFUVVBTCxcbiAgICBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBTVEVOQ0lMT1BfS0VFUCxcbiAgICBVTklGT1JNVFlQRV9CT09MLCBVTklGT1JNVFlQRV9JTlQsIFVOSUZPUk1UWVBFX0ZMT0FULCBVTklGT1JNVFlQRV9WRUMyLCBVTklGT1JNVFlQRV9WRUMzLFxuICAgIFVOSUZPUk1UWVBFX1ZFQzQsIFVOSUZPUk1UWVBFX0lWRUMyLCBVTklGT1JNVFlQRV9JVkVDMywgVU5JRk9STVRZUEVfSVZFQzQsIFVOSUZPUk1UWVBFX0JWRUMyLFxuICAgIFVOSUZPUk1UWVBFX0JWRUMzLCBVTklGT1JNVFlQRV9CVkVDNCwgVU5JRk9STVRZUEVfTUFUMiwgVU5JRk9STVRZUEVfTUFUMywgVU5JRk9STVRZUEVfTUFUNCxcbiAgICBVTklGT1JNVFlQRV9URVhUVVJFMkQsIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFLCBVTklGT1JNVFlQRV9GTE9BVEFSUkFZLCBVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XLFxuICAgIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVywgVU5JRk9STVRZUEVfVEVYVFVSRTNELCBVTklGT1JNVFlQRV9WRUMyQVJSQVksIFVOSUZPUk1UWVBFX1ZFQzNBUlJBWSwgVU5JRk9STVRZUEVfVkVDNEFSUkFZLFxuICAgIHNlbWFudGljVG9Mb2NhdGlvblxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBkcmF3UXVhZFdpdGhTaGFkZXIgfSBmcm9tICcuLi9zaW1wbGUtcG9zdC1lZmZlY3QuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vZGVidWctZ3JhcGhpY3MuanMnO1xuXG5pbXBvcnQgeyBXZWJnbFZlcnRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ2wtdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJnbEluZGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJnbC1pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xTaGFkZXIgfSBmcm9tICcuL3dlYmdsLXNoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJnbFRleHR1cmUgfSBmcm9tICcuL3dlYmdsLXRleHR1cmUuanMnO1xuaW1wb3J0IHsgV2ViZ2xSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3dlYmdsLXJlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2hhZGVyVXRpbHMgfSBmcm9tICcuLi9zaGFkZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSAnLi4vc2hhZGVyLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2luZGV4LWJ1ZmZlci5qcycpLkluZGV4QnVmZmVyfSBJbmRleEJ1ZmZlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3NoYWRlci5qcycpLlNoYWRlcn0gU2hhZGVyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcn0gVmVydGV4QnVmZmVyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSBSZW5kZXJQYXNzICovXG5cbmNvbnN0IGludmFsaWRhdGVBdHRhY2htZW50cyA9IFtdO1xuXG5jb25zdCBfZnVsbFNjcmVlblF1YWRWUyA9IC8qIGdsc2wgKi9gXG5hdHRyaWJ1dGUgdmVjMiB2ZXJ0ZXhfcG9zaXRpb247XG52YXJ5aW5nIHZlYzIgdlV2MDtcbnZvaWQgbWFpbih2b2lkKVxue1xuICAgIGdsX1Bvc2l0aW9uID0gdmVjNCh2ZXJ0ZXhfcG9zaXRpb24sIDAuNSwgMS4wKTtcbiAgICB2VXYwID0gdmVydGV4X3Bvc2l0aW9uLnh5KjAuNSswLjU7XG59XG5gO1xuXG5jb25zdCBfcHJlY2lzaW9uVGVzdDFQUyA9IC8qIGdsc2wgKi9gXG52b2lkIG1haW4odm9pZCkgeyBcbiAgICBnbF9GcmFnQ29sb3IgPSB2ZWM0KDIxNDc0ODM2NDguMCk7XG59XG5gO1xuXG5jb25zdCBfcHJlY2lzaW9uVGVzdDJQUyA9IC8qIGdsc2wgKi9gXG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XG52ZWM0IHBhY2tGbG9hdChmbG9hdCBkZXB0aCkge1xuICAgIGNvbnN0IHZlYzQgYml0X3NoaWZ0ID0gdmVjNCgyNTYuMCAqIDI1Ni4wICogMjU2LjAsIDI1Ni4wICogMjU2LjAsIDI1Ni4wLCAxLjApO1xuICAgIGNvbnN0IHZlYzQgYml0X21hc2sgID0gdmVjNCgwLjAsIDEuMCAvIDI1Ni4wLCAxLjAgLyAyNTYuMCwgMS4wIC8gMjU2LjApO1xuICAgIHZlYzQgcmVzID0gbW9kKGRlcHRoICogYml0X3NoaWZ0ICogdmVjNCgyNTUpLCB2ZWM0KDI1NikgKSAvIHZlYzQoMjU1KTtcbiAgICByZXMgLT0gcmVzLnh4eXogKiBiaXRfbWFzaztcbiAgICByZXR1cm4gcmVzO1xufVxudm9pZCBtYWluKHZvaWQpIHtcbiAgICBmbG9hdCBjID0gdGV4dHVyZTJEKHNvdXJjZSwgdmVjMigwLjApKS5yO1xuICAgIGZsb2F0IGRpZmYgPSBhYnMoYyAtIDIxNDc0ODM2NDguMCkgLyAyMTQ3NDgzNjQ4LjA7XG4gICAgZ2xfRnJhZ0NvbG9yID0gcGFja0Zsb2F0KGRpZmYpO1xufVxuYDtcblxuY29uc3QgX291dHB1dFRleHR1cmUyRCA9IC8qIGdsc2wgKi9gXG52YXJ5aW5nIHZlYzIgdlV2MDtcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHNvdXJjZSwgdlV2MCk7XG59XG5gO1xuXG5mdW5jdGlvbiB0ZXN0UmVuZGVyYWJsZShnbCwgcGl4ZWxGb3JtYXQpIHtcbiAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIC8vIENyZWF0ZSBhIDJ4MiB0ZXh0dXJlXG4gICAgY29uc3QgdGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgMiwgMiwgMCwgZ2wuUkdCQSwgcGl4ZWxGb3JtYXQsIG51bGwpO1xuXG4gICAgLy8gVHJ5IHRvIHVzZSB0aGlzIHRleHR1cmUgYXMgYSByZW5kZXIgdGFyZ2V0XG4gICAgY29uc3QgZnJhbWVidWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZnJhbWVidWZmZXIpO1xuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSwgMCk7XG5cbiAgICAvLyBJdCBpcyBsZWdhbCBmb3IgYSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBleHBvc2luZyB0aGUgT0VTX3RleHR1cmVfZmxvYXQgZXh0ZW5zaW9uIHRvXG4gICAgLy8gc3VwcG9ydCBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBidXQgbm90IGFzIGF0dGFjaG1lbnRzIHRvIGZyYW1lYnVmZmVyIG9iamVjdHMuXG4gICAgaWYgKGdsLmNoZWNrRnJhbWVidWZmZXJTdGF0dXMoZ2wuRlJBTUVCVUZGRVIpICE9PSBnbC5GUkFNRUJVRkZFUl9DT01QTEVURSkge1xuICAgICAgICByZXN1bHQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDbGVhbiB1cFxuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xuICAgIGdsLmRlbGV0ZVRleHR1cmUodGV4dHVyZSk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcbiAgICBnbC5kZWxldGVGcmFtZWJ1ZmZlcihmcmFtZWJ1ZmZlcik7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiB0ZXN0VGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZShnbCwgcGl4ZWxGb3JtYXQpIHtcbiAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIC8vIENyZWF0ZSBhIDJ4MiB0ZXh0dXJlXG4gICAgY29uc3QgdGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuXG4gICAgLy8gdXBsb2FkIHNvbWUgZGF0YSAtIG9uIGlPUyBwcmlvciB0byBhYm91dCBOb3ZlbWJlciAyMDE5LCBwYXNzaW5nIGRhdGEgdG8gaGFsZiB0ZXh0dXJlIHdvdWxkIGZhaWwgaGVyZVxuICAgIC8vIHNlZSBkZXRhaWxzIGhlcmU6IGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNjk5OTlcbiAgICAvLyBub3RlIHRoYXQgaWYgbm90IHN1cHBvcnRlZCwgdGhpcyBwcmludHMgYW4gZXJyb3IgdG8gY29uc29sZSwgdGhlIGVycm9yIGNhbiBiZSBzYWZlbHkgaWdub3JlZCBhcyBpdCdzIGhhbmRsZWRcbiAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQxNkFycmF5KDQgKiAyICogMik7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAyLCAyLCAwLCBnbC5SR0JBLCBwaXhlbEZvcm1hdCwgZGF0YSk7XG5cbiAgICBpZiAoZ2wuZ2V0RXJyb3IoKSAhPT0gZ2wuTk9fRVJST1IpIHtcbiAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQWJvdmUgZXJyb3IgcmVsYXRlZCB0byBIQUxGX0ZMT0FUX09FUyBjYW4gYmUgaWdub3JlZCwgaXQgd2FzIHRyaWdnZXJlZCBieSB0ZXN0aW5nIGhhbGYgZmxvYXQgdGV4dHVyZSBzdXBwb3J0XCIpO1xuICAgIH1cblxuICAgIC8vIENsZWFuIHVwXG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gICAgZ2wuZGVsZXRlVGV4dHVyZSh0ZXh0dXJlKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRlc3RUZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKGRldmljZSkge1xuICAgIGlmICghZGV2aWNlLnRleHR1cmVGbG9hdFJlbmRlcmFibGUpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHNoYWRlcjEgPSBuZXcgU2hhZGVyKGRldmljZSwgU2hhZGVyVXRpbHMuY3JlYXRlRGVmaW5pdGlvbihkZXZpY2UsIHtcbiAgICAgICAgbmFtZTogJ3B0ZXN0MScsXG4gICAgICAgIHZlcnRleENvZGU6IF9mdWxsU2NyZWVuUXVhZFZTLFxuICAgICAgICBmcmFnbWVudENvZGU6IF9wcmVjaXNpb25UZXN0MVBTXG4gICAgfSkpO1xuXG4gICAgY29uc3Qgc2hhZGVyMiA9IG5ldyBTaGFkZXIoZGV2aWNlLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKGRldmljZSwge1xuICAgICAgICBuYW1lOiAncHRlc3QyJyxcbiAgICAgICAgdmVydGV4Q29kZTogX2Z1bGxTY3JlZW5RdWFkVlMsXG4gICAgICAgIGZyYWdtZW50Q29kZTogX3ByZWNpc2lvblRlc3QyUFNcbiAgICB9KSk7XG5cbiAgICBjb25zdCB0ZXh0dXJlT3B0aW9ucyA9IHtcbiAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBMzJGLFxuICAgICAgICB3aWR0aDogMSxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbmFtZTogJ3Rlc3RGSFAnXG4gICAgfTtcbiAgICBjb25zdCB0ZXgxID0gbmV3IFRleHR1cmUoZGV2aWNlLCB0ZXh0dXJlT3B0aW9ucyk7XG4gICAgY29uc3QgdGFyZzEgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgY29sb3JCdWZmZXI6IHRleDEsXG4gICAgICAgIGRlcHRoOiBmYWxzZVxuICAgIH0pO1xuICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRhcmcxLCBzaGFkZXIxKTtcblxuICAgIHRleHR1cmVPcHRpb25zLmZvcm1hdCA9IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4O1xuICAgIGNvbnN0IHRleDIgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHRleHR1cmVPcHRpb25zKTtcbiAgICBjb25zdCB0YXJnMiA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICBjb2xvckJ1ZmZlcjogdGV4MixcbiAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgfSk7XG4gICAgZGV2aWNlLmNvbnN0YW50VGV4U291cmNlLnNldFZhbHVlKHRleDEpO1xuICAgIGRyYXdRdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRhcmcyLCBzaGFkZXIyKTtcblxuICAgIGNvbnN0IHByZXZGcmFtZWJ1ZmZlciA9IGRldmljZS5hY3RpdmVGcmFtZWJ1ZmZlcjtcbiAgICBkZXZpY2Uuc2V0RnJhbWVidWZmZXIodGFyZzIuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG5cbiAgICBjb25zdCBwaXhlbHMgPSBuZXcgVWludDhBcnJheSg0KTtcbiAgICBkZXZpY2UucmVhZFBpeGVscygwLCAwLCAxLCAxLCBwaXhlbHMpO1xuXG4gICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHByZXZGcmFtZWJ1ZmZlcik7XG5cbiAgICBjb25zdCB4ID0gcGl4ZWxzWzBdIC8gMjU1O1xuICAgIGNvbnN0IHkgPSBwaXhlbHNbMV0gLyAyNTU7XG4gICAgY29uc3QgeiA9IHBpeGVsc1syXSAvIDI1NTtcbiAgICBjb25zdCB3ID0gcGl4ZWxzWzNdIC8gMjU1O1xuICAgIGNvbnN0IGYgPSB4IC8gKDI1NiAqIDI1NiAqIDI1NikgKyB5IC8gKDI1NiAqIDI1NikgKyB6IC8gMjU2ICsgdztcblxuICAgIHRleDEuZGVzdHJveSgpO1xuICAgIHRhcmcxLmRlc3Ryb3koKTtcbiAgICB0ZXgyLmRlc3Ryb3koKTtcbiAgICB0YXJnMi5kZXN0cm95KCk7XG4gICAgc2hhZGVyMS5kZXN0cm95KCk7XG4gICAgc2hhZGVyMi5kZXN0cm95KCk7XG5cbiAgICByZXR1cm4gZiA9PT0gMDtcbn1cblxuLy8gSW1hZ2VCaXRtYXAgY3VycmVudCBzdGF0ZSAoU2VwIDIwMjIpOlxuLy8gLSBMYXN0ZXN0IENocm9tZSBhbmQgRmlyZWZveCBicm93c2VycyBhcHBlYXIgdG8gc3VwcG9ydCB0aGUgSW1hZ2VCaXRtYXAgQVBJIGZpbmUgKHRob3VnaFxuLy8gICB0aGVyZSBhcmUgbGlrZWx5IHN0aWxsIGlzc3VlcyB3aXRoIG9sZGVyIHZlcnNpb25zIG9mIGJvdGgpLlxuLy8gLSBTYWZhcmkgc3VwcG9ydHMgdGhlIEFQSSwgYnV0IGNvbXBsZXRlbHkgZGVzdHJveXMgc29tZSBwbmdzLiBGb3IgZXhhbXBsZSB0aGUgY3ViZW1hcHMgaW5cbi8vICAgc3RlYW1wdW5rIHNsb3RzIGh0dHBzOi8vcGxheWNhbnZhcy5jb20vZWRpdG9yL3NjZW5lLzUyNDg1OC4gU2VlIHRoZSB3ZWJraXQgaXNzdWVcbi8vICAgaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE4MjQyNCBmb3Igc3RhdHVzLlxuLy8gLSBTb21lIGFwcGxpY2F0aW9ucyBhc3N1bWUgdGhhdCBQTkdzIGxvYWRlZCBieSB0aGUgZW5naW5lIHVzZSBIVE1MSW1hZ2VCaXRtYXAgaW50ZXJmYWNlIGFuZFxuLy8gICBmYWlsIHdoZW4gdXNpbmcgSW1hZ2VCaXRtYXAuIEZvciBleGFtcGxlLCBTcGFjZSBCYXNlIHByb2plY3QgZmFpbHMgYmVjYXVzZSBpdCB1c2VzIGVuZ2luZVxuLy8gICB0ZXh0dXJlIGFzc2V0cyBvbiB0aGUgZG9tIGh0dHBzOi8vcGxheWNhbnZhcy5jb20vZWRpdG9yL3NjZW5lLzQ0NjI3OC5cblxuLy8gVGhpcyBmdW5jdGlvbiB0ZXN0cyB3aGV0aGVyIHRoZSBjdXJyZW50IGJyb3dzZXIgZGVzdHJveXMgUE5HIGRhdGEgb3Igbm90LlxuZnVuY3Rpb24gdGVzdEltYWdlQml0bWFwKGRldmljZSkge1xuICAgIC8vIDF4MSBwbmcgaW1hZ2UgY29udGFpbmluZyByZ2JhKDEsIDIsIDMsIDYzKVxuICAgIGNvbnN0IHBuZ0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAxMzcsIDgwLCA3OCwgNzEsIDEzLCAxMCwgMjYsIDEwLCAwLCAwLCAwLCAxMywgNzMsIDcyLCA2OCwgODIsIDAsIDAsIDAsIDEsIDAsIDAsIDAsIDEsIDgsIDYsIDAsIDAsIDAsIDMxLCAyMSxcbiAgICAgICAgMTk2LCAxMzcsIDAsIDAsIDAsIDEzLCA3MywgNjgsIDY1LCA4NCwgMTIwLCAyMTgsIDk5LCAxMDAsIDEwMCwgOTgsIDE4MiwgNywgMCwgMCwgODksIDAsIDcxLCA2NywgMTMzLCAxNDgsIDIzNyxcbiAgICAgICAgMCwgMCwgMCwgMCwgNzMsIDY5LCA3OCwgNjgsIDE3NCwgNjYsIDk2LCAxMzBcbiAgICBdKTtcblxuICAgIHJldHVybiBjcmVhdGVJbWFnZUJpdG1hcChuZXcgQmxvYihbcG5nQnl0ZXNdLCB7IHR5cGU6ICdpbWFnZS9wbmcnIH0pLCB7IHByZW11bHRpcGx5QWxwaGE6ICdub25lJyB9KVxuICAgICAgICAudGhlbigoaW1hZ2UpID0+IHtcbiAgICAgICAgICAgIC8vIGNyZWF0ZSB0aGUgdGV4dHVyZVxuICAgICAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICAgICAgICAgIHdpZHRoOiAxLFxuICAgICAgICAgICAgICAgIGhlaWdodDogMSxcbiAgICAgICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LFxuICAgICAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGxldmVsczogW2ltYWdlXVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIHJlYWQgcGl4ZWxzXG4gICAgICAgICAgICBjb25zdCBydCA9IG5ldyBSZW5kZXJUYXJnZXQoeyBjb2xvckJ1ZmZlcjogdGV4dHVyZSwgZGVwdGg6IGZhbHNlIH0pO1xuICAgICAgICAgICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHJ0LmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuICAgICAgICAgICAgZGV2aWNlLmluaXRSZW5kZXJUYXJnZXQocnQpO1xuXG4gICAgICAgICAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQ4Q2xhbXBlZEFycmF5KDQpO1xuICAgICAgICAgICAgZGV2aWNlLmdsLnJlYWRQaXhlbHMoMCwgMCwgMSwgMSwgZGV2aWNlLmdsLlJHQkEsIGRldmljZS5nbC5VTlNJR05FRF9CWVRFLCBkYXRhKTtcblxuICAgICAgICAgICAgcnQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGV4dHVyZS5kZXN0cm95KCk7XG5cbiAgICAgICAgICAgIHJldHVybiBkYXRhWzBdID09PSAxICYmIGRhdGFbMV0gPT09IDIgJiYgZGF0YVsyXSA9PT0gMyAmJiBkYXRhWzNdID09PSA2MztcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGUgPT4gZmFsc2UpO1xufVxuXG4vKipcbiAqIFRoZSBncmFwaGljcyBkZXZpY2UgbWFuYWdlcyB0aGUgdW5kZXJseWluZyBncmFwaGljcyBjb250ZXh0LiBJdCBpcyByZXNwb25zaWJsZSBmb3Igc3VibWl0dGluZ1xuICogcmVuZGVyIHN0YXRlIGNoYW5nZXMgYW5kIGdyYXBoaWNzIHByaW1pdGl2ZXMgdG8gdGhlIGhhcmR3YXJlLiBBIGdyYXBoaWNzIGRldmljZSBpcyB0aWVkIHRvIGFcbiAqIHNwZWNpZmljIGNhbnZhcyBIVE1MIGVsZW1lbnQuIEl0IGlzIHZhbGlkIHRvIGhhdmUgbW9yZSB0aGFuIG9uZSBjYW52YXMgZWxlbWVudCBwZXIgcGFnZSBhbmRcbiAqIGNyZWF0ZSBhIG5ldyBncmFwaGljcyBkZXZpY2UgYWdhaW5zdCBlYWNoLlxuICpcbiAqIEBhdWdtZW50cyBHcmFwaGljc0RldmljZVxuICovXG5jbGFzcyBXZWJnbEdyYXBoaWNzRGV2aWNlIGV4dGVuZHMgR3JhcGhpY3NEZXZpY2Uge1xuICAgIC8qKlxuICAgICAqIFRoZSBXZWJHTCBjb250ZXh0IG1hbmFnZWQgYnkgdGhlIGdyYXBoaWNzIGRldmljZS4gVGhlIHR5cGUgY291bGQgYWxzbyB0ZWNobmljYWxseSBiZVxuICAgICAqIGBXZWJHTFJlbmRlcmluZ0NvbnRleHRgIGlmIFdlYkdMIDIuMCBpcyBub3QgYXZhaWxhYmxlLiBCdXQgaW4gb3JkZXIgZm9yIEludGVsbGlTZW5zZSB0byBiZVxuICAgICAqIGFibGUgdG8gZnVuY3Rpb24gZm9yIGFsbCBXZWJHTCBjYWxscyBpbiB0aGUgY29kZWJhc2UsIHdlIHNwZWNpZnkgYFdlYkdMMlJlbmRlcmluZ0NvbnRleHRgXG4gICAgICogaGVyZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge1dlYkdMMlJlbmRlcmluZ0NvbnRleHR9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdsO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgV2ViR0wgY29udGV4dCBvZiB0aGlzIGRldmljZSBpcyB1c2luZyB0aGUgV2ViR0wgMi4wIEFQSS4gSWYgZmFsc2UsIFdlYkdMIDEuMCBpc1xuICAgICAqIGJlaW5nIHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgd2ViZ2wyO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIG5ldyBXZWJnbEdyYXBoaWNzRGV2aWNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudH0gY2FudmFzIC0gVGhlIGNhbnZhcyB0byB3aGljaCB0aGUgZ3JhcGhpY3MgZGV2aWNlIHdpbGwgcmVuZGVyLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25zIHBhc3NlZCB3aGVuIGNyZWF0aW5nIHRoZSBXZWJHTCBjb250ZXh0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYWxwaGE9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIGlmIHRoZSBjYW52YXMgY29udGFpbnMgYW5cbiAgICAgKiBhbHBoYSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kZXB0aD10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGUgZHJhd2luZyBidWZmZXIgaXNcbiAgICAgKiByZXF1ZXN0ZWQgdG8gaGF2ZSBhIGRlcHRoIGJ1ZmZlciBvZiBhdCBsZWFzdCAxNiBiaXRzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc3RlbmNpbD1mYWxzZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhlIGRyYXdpbmcgYnVmZmVyIGlzXG4gICAgICogcmVxdWVzdGVkIHRvIGhhdmUgYSBzdGVuY2lsIGJ1ZmZlciBvZiBhdCBsZWFzdCA4IGJpdHMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbnRpYWxpYXM9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHdoZXRoZXIgb3Igbm90IHRvIHBlcmZvcm1cbiAgICAgKiBhbnRpLWFsaWFzaW5nIGlmIHBvc3NpYmxlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlbXVsdGlwbGllZEFscGhhPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBwYWdlXG4gICAgICogY29tcG9zaXRvciB3aWxsIGFzc3VtZSB0aGUgZHJhd2luZyBidWZmZXIgY29udGFpbnMgY29sb3JzIHdpdGggcHJlLW11bHRpcGxpZWQgYWxwaGEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcmVzZXJ2ZURyYXdpbmdCdWZmZXI9ZmFsc2VdIC0gSWYgdGhlIHZhbHVlIGlzIHRydWUgdGhlIGJ1ZmZlcnNcbiAgICAgKiB3aWxsIG5vdCBiZSBjbGVhcmVkIGFuZCB3aWxsIHByZXNlcnZlIHRoZWlyIHZhbHVlcyB1bnRpbCBjbGVhcmVkIG9yIG92ZXJ3cml0dGVuIGJ5IHRoZVxuICAgICAqIGF1dGhvci5cbiAgICAgKiBAcGFyYW0geydkZWZhdWx0J3wnaGlnaC1wZXJmb3JtYW5jZSd8J2xvdy1wb3dlcid9IFtvcHRpb25zLnBvd2VyUHJlZmVyZW5jZT0nZGVmYXVsdCddIC0gQVxuICAgICAqIGhpbnQgdG8gdGhlIHVzZXIgYWdlbnQgaW5kaWNhdGluZyB3aGF0IGNvbmZpZ3VyYXRpb24gb2YgR1BVIGlzIHN1aXRhYmxlIGZvciB0aGUgV2ViR0xcbiAgICAgKiBjb250ZXh0LiBQb3NzaWJsZSB2YWx1ZXMgYXJlOlxuICAgICAqXG4gICAgICogLSAnZGVmYXVsdCc6IExldCB0aGUgdXNlciBhZ2VudCBkZWNpZGUgd2hpY2ggR1BVIGNvbmZpZ3VyYXRpb24gaXMgbW9zdCBzdWl0YWJsZS4gVGhpcyBpcyB0aGVcbiAgICAgKiBkZWZhdWx0IHZhbHVlLlxuICAgICAqIC0gJ2hpZ2gtcGVyZm9ybWFuY2UnOiBQcmlvcml0aXplcyByZW5kZXJpbmcgcGVyZm9ybWFuY2Ugb3ZlciBwb3dlciBjb25zdW1wdGlvbi5cbiAgICAgKiAtICdsb3ctcG93ZXInOiBQcmlvcml0aXplcyBwb3dlciBzYXZpbmcgb3ZlciByZW5kZXJpbmcgcGVyZm9ybWFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZhaWxJZk1ham9yUGVyZm9ybWFuY2VDYXZlYXQ9ZmFsc2VdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyBpZiBhXG4gICAgICogY29udGV4dCB3aWxsIGJlIGNyZWF0ZWQgaWYgdGhlIHN5c3RlbSBwZXJmb3JtYW5jZSBpcyBsb3cgb3IgaWYgbm8gaGFyZHdhcmUgR1BVIGlzIGF2YWlsYWJsZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZWZlcldlYkdsMj10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgaWYgYSBXZWJHbDIgY29udGV4dFxuICAgICAqIHNob3VsZCBiZSBwcmVmZXJyZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kZXN5bmNocm9uaXplZD1mYWxzZV0gLSBCb29sZWFuIHRoYXQgaGludHMgdGhlIHVzZXIgYWdlbnQgdG9cbiAgICAgKiByZWR1Y2UgdGhlIGxhdGVuY3kgYnkgZGVzeW5jaHJvbml6aW5nIHRoZSBjYW52YXMgcGFpbnQgY3ljbGUgZnJvbSB0aGUgZXZlbnQgbG9vcC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnhyQ29tcGF0aWJsZV0gLSBCb29sZWFuIHRoYXQgaGludHMgdG8gdGhlIHVzZXIgYWdlbnQgdG8gdXNlIGFcbiAgICAgKiBjb21wYXRpYmxlIGdyYXBoaWNzIGFkYXB0ZXIgZm9yIGFuIGltbWVyc2l2ZSBYUiBkZXZpY2UuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY2FudmFzLCBvcHRpb25zID0ge30pIHtcbiAgICAgICAgc3VwZXIoY2FudmFzKTtcbiAgICAgICAgdGhpcy5kZXZpY2VUeXBlID0gREVWSUNFVFlQRV9XRUJHTDtcblxuICAgICAgICB0aGlzLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgLy8gdHJ1ZSBpZiB0aGUgZGVmYXVsdCBmcmFtZWJ1ZmZlciBoYXMgYWxwaGFcbiAgICAgICAgdGhpcy5kZWZhdWx0RnJhbWVidWZmZXJBbHBoYSA9IG9wdGlvbnMuYWxwaGE7XG5cbiAgICAgICAgdGhpcy51cGRhdGVDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgLy8gQWRkIGhhbmRsZXJzIGZvciB3aGVuIHRoZSBXZWJHTCBjb250ZXh0IGlzIGxvc3Qgb3IgcmVzdG9yZWRcbiAgICAgICAgdGhpcy5jb250ZXh0TG9zdCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dExvc3QgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5sb3NlQ29udGV4dCgpO1xuICAgICAgICAgICAgRGVidWcubG9nKCdwYy5HcmFwaGljc0RldmljZTogV2ViR0wgY29udGV4dCBsb3N0LicpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdkZXZpY2Vsb3N0Jyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIERlYnVnLmxvZygncGMuR3JhcGhpY3NEZXZpY2U6IFdlYkdMIGNvbnRleHQgcmVzdG9yZWQuJyk7XG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVDb250ZXh0KCk7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHRMb3N0ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2RldmljZXJlc3RvcmVkJyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gb3B0aW9ucyBkZWZhdWx0c1xuICAgICAgICBvcHRpb25zLnN0ZW5jaWwgPSB0cnVlO1xuICAgICAgICBpZiAoIW9wdGlvbnMucG93ZXJQcmVmZXJlbmNlKSB7XG4gICAgICAgICAgICBvcHRpb25zLnBvd2VyUHJlZmVyZW5jZSA9ICdoaWdoLXBlcmZvcm1hbmNlJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICM0MTM2IC0gdHVybiBvZmYgYW50aWFsaWFzaW5nIG9uIEFwcGxlV2ViS2l0IGJyb3dzZXJzIDE1LjRcbiAgICAgICAgY29uc3QgdWEgPSAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcpICYmIG5hdmlnYXRvci51c2VyQWdlbnQ7XG4gICAgICAgIHRoaXMuZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZyA9IHVhICYmIHVhLmluY2x1ZGVzKCdBcHBsZVdlYktpdCcpICYmICh1YS5pbmNsdWRlcygnMTUuNCcpIHx8IHVhLmluY2x1ZGVzKCcxNV80JykpO1xuICAgICAgICBpZiAodGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nKSB7XG4gICAgICAgICAgICBvcHRpb25zLmFudGlhbGlhcyA9IGZhbHNlO1xuICAgICAgICAgICAgRGVidWcubG9nKFwiQW50aWFsaWFzaW5nIGhhcyBiZWVuIHR1cm5lZCBvZmYgZHVlIHRvIHJlbmRlcmluZyBpc3N1ZXMgb24gQXBwbGVXZWJLaXQgMTUuNFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJldHJpZXZlIHRoZSBXZWJHTCBjb250ZXh0XG4gICAgICAgIGNvbnN0IHByZWZlcldlYkdsMiA9IChvcHRpb25zLnByZWZlcldlYkdsMiAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMucHJlZmVyV2ViR2wyIDogdHJ1ZTtcblxuICAgICAgICBjb25zdCBuYW1lcyA9IHByZWZlcldlYkdsMiA/IFtcIndlYmdsMlwiLCBcIndlYmdsXCIsIFwiZXhwZXJpbWVudGFsLXdlYmdsXCJdIDogW1wid2ViZ2xcIiwgXCJleHBlcmltZW50YWwtd2ViZ2xcIl07XG4gICAgICAgIGxldCBnbCA9IG51bGw7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGdsID0gY2FudmFzLmdldENvbnRleHQobmFtZXNbaV0sIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICBpZiAoZ2wpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndlYmdsMiA9IChuYW1lc1tpXSA9PT0gJ3dlYmdsMicpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFnbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiV2ViR0wgbm90IHN1cHBvcnRlZFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzQ2hyb21lID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIXdpbmRvdy5jaHJvbWU7XG4gICAgICAgIGNvbnN0IGlzTWFjID0gcGxhdGZvcm0uYnJvd3NlciAmJiBuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMTtcblxuICAgICAgICB0aGlzLmdsID0gZ2w7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB0ZXh0dXJlIHVuaXQgd29ya2Fyb3VuZCBvbiBkZXNrdG9wIHNhZmFyaVxuICAgICAgICB0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIXdpbmRvdy5zYWZhcmk7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciBnbEJsaXRGcmFtZWJ1ZmZlciBmYWlsaW5nIG9uIE1hYyBDaHJvbWUgKCMyNTA0KVxuICAgICAgICB0aGlzLl90ZW1wTWFjQ2hyb21lQmxpdEZyYW1lYnVmZmVyV29ya2Fyb3VuZCA9IGlzTWFjICYmIGlzQ2hyb21lICYmICFvcHRpb25zLmFscGhhO1xuXG4gICAgICAgIC8vIGluaXQgcG9seWZpbGwgZm9yIFZBT3MgdW5kZXIgd2ViZ2wxXG4gICAgICAgIGlmICghdGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHNldHVwVmVydGV4QXJyYXlPYmplY3QoZ2wpO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRsb3N0XCIsIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciwgZmFsc2UpO1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dHJlc3RvcmVkXCIsIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVFeHRlbnNpb25zKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNhcGFiaWxpdGllcygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVSZW5kZXJTdGF0ZSgpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gc3RhcnQgYXN5bmMgaW1hZ2UgYml0bWFwIHRlc3RcbiAgICAgICAgdGhpcy5zdXBwb3J0c0ltYWdlQml0bWFwID0gbnVsbDtcbiAgICAgICAgaWYgKHR5cGVvZiBJbWFnZUJpdG1hcCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHRlc3RJbWFnZUJpdG1hcCh0aGlzKS50aGVuKChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnN1cHBvcnRzSW1hZ2VCaXRtYXAgPSByZXN1bHQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGVmYXVsdENsZWFyT3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGNvbG9yOiBbMCwgMCwgMCwgMV0sXG4gICAgICAgICAgICBkZXB0aDogMSxcbiAgICAgICAgICAgIHN0ZW5jaWw6IDAsXG4gICAgICAgICAgICBmbGFnczogQ0xFQVJGTEFHX0NPTE9SIHwgQ0xFQVJGTEFHX0RFUFRIXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nbEFkZHJlc3MgPSBbXG4gICAgICAgICAgICBnbC5SRVBFQVQsXG4gICAgICAgICAgICBnbC5DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgZ2wuTUlSUk9SRURfUkVQRUFUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRXF1YXRpb24gPSBbXG4gICAgICAgICAgICBnbC5GVU5DX0FERCxcbiAgICAgICAgICAgIGdsLkZVTkNfU1VCVFJBQ1QsXG4gICAgICAgICAgICBnbC5GVU5DX1JFVkVSU0VfU1VCVFJBQ1QsXG4gICAgICAgICAgICB0aGlzLndlYmdsMiA/IGdsLk1JTiA6IHRoaXMuZXh0QmxlbmRNaW5tYXggPyB0aGlzLmV4dEJsZW5kTWlubWF4Lk1JTl9FWFQgOiBnbC5GVU5DX0FERCxcbiAgICAgICAgICAgIHRoaXMud2ViZ2wyID8gZ2wuTUFYIDogdGhpcy5leHRCbGVuZE1pbm1heCA/IHRoaXMuZXh0QmxlbmRNaW5tYXguTUFYX0VYVCA6IGdsLkZVTkNfQUREXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb24gPSBbXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuT05FLFxuICAgICAgICAgICAgZ2wuU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICAgICAgICAgIGdsLkRTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19EU1RfQ09MT1IsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEFfU0FUVVJBVEUsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBLFxuICAgICAgICAgICAgZ2wuRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICAgICAgICAgIGdsLkNPTlNUQU5UX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SLFxuICAgICAgICAgICAgZ2wuQ09OU1RBTlRfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEFcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQ29tcGFyaXNvbiA9IFtcbiAgICAgICAgICAgIGdsLk5FVkVSLFxuICAgICAgICAgICAgZ2wuTEVTUyxcbiAgICAgICAgICAgIGdsLkVRVUFMLFxuICAgICAgICAgICAgZ2wuTEVRVUFMLFxuICAgICAgICAgICAgZ2wuR1JFQVRFUixcbiAgICAgICAgICAgIGdsLk5PVEVRVUFMLFxuICAgICAgICAgICAgZ2wuR0VRVUFMLFxuICAgICAgICAgICAgZ2wuQUxXQVlTXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbFN0ZW5jaWxPcCA9IFtcbiAgICAgICAgICAgIGdsLktFRVAsXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuUkVQTEFDRSxcbiAgICAgICAgICAgIGdsLklOQ1IsXG4gICAgICAgICAgICBnbC5JTkNSX1dSQVAsXG4gICAgICAgICAgICBnbC5ERUNSLFxuICAgICAgICAgICAgZ2wuREVDUl9XUkFQLFxuICAgICAgICAgICAgZ2wuSU5WRVJUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbENsZWFyRmxhZyA9IFtcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBnbC5DT0xPUl9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuREVQVEhfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklUIHwgZ2wuQ09MT1JfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLlNURU5DSUxfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5TVEVOQ0lMX0JVRkZFUl9CSVQgfCBnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xDdWxsID0gW1xuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIGdsLkJBQ0ssXG4gICAgICAgICAgICBnbC5GUk9OVCxcbiAgICAgICAgICAgIGdsLkZST05UX0FORF9CQUNLXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEZpbHRlciA9IFtcbiAgICAgICAgICAgIGdsLk5FQVJFU1QsXG4gICAgICAgICAgICBnbC5MSU5FQVIsXG4gICAgICAgICAgICBnbC5ORUFSRVNUX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9MSU5FQVJcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsUHJpbWl0aXZlID0gW1xuICAgICAgICAgICAgZ2wuUE9JTlRTLFxuICAgICAgICAgICAgZ2wuTElORVMsXG4gICAgICAgICAgICBnbC5MSU5FX0xPT1AsXG4gICAgICAgICAgICBnbC5MSU5FX1NUUklQLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVTLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVfU1RSSVAsXG4gICAgICAgICAgICBnbC5UUklBTkdMRV9GQU5cbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsVHlwZSA9IFtcbiAgICAgICAgICAgIGdsLkJZVEUsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9CWVRFLFxuICAgICAgICAgICAgZ2wuU0hPUlQsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9TSE9SVCxcbiAgICAgICAgICAgIGdsLklOVCxcbiAgICAgICAgICAgIGdsLlVOU0lHTkVEX0lOVCxcbiAgICAgICAgICAgIGdsLkZMT0FUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlID0ge307XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MXSAgICAgICAgID0gVU5JRk9STVRZUEVfQk9PTDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9JTlQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF0gICAgICAgID0gVU5JRk9STVRZUEVfRkxPQVQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9WRUMyXSAgID0gVU5JRk9STVRZUEVfVkVDMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX1ZFQzNdICAgPSBVTklGT1JNVFlQRV9WRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfVkVDNF0gICA9IFVOSUZPUk1UWVBFX1ZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDMl0gICAgID0gVU5JRk9STVRZUEVfSVZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDM10gICAgID0gVU5JRk9STVRZUEVfSVZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDNF0gICAgID0gVU5JRk9STVRZUEVfSVZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzJdICAgID0gVU5JRk9STVRZUEVfQlZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzNdICAgID0gVU5JRk9STVRZUEVfQlZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzRdICAgID0gVU5JRk9STVRZUEVfQlZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9NQVQyXSAgID0gVU5JRk9STVRZUEVfTUFUMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX01BVDNdICAgPSBVTklGT1JNVFlQRV9NQVQzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfTUFUNF0gICA9IFVOSUZPUk1UWVBFX01BVDQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEXSAgID0gVU5JRk9STVRZUEVfVEVYVFVSRTJEO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFXSA9IFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEX1NIQURPV10gICA9IFVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFX1NIQURPV10gPSBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8zRF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9URVhUVVJFM0Q7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdCA9IHt9O1xuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdFtnbC5URVhUVVJFXzJEXSA9IDA7XG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90W2dsLlRFWFRVUkVfQ1VCRV9NQVBdID0gMTtcbiAgICAgICAgdGhpcy50YXJnZXRUb1Nsb3RbZ2wuVEVYVFVSRV8zRF0gPSAyO1xuXG4gICAgICAgIC8vIERlZmluZSB0aGUgdW5pZm9ybSBjb21taXQgZnVuY3Rpb25zXG4gICAgICAgIGxldCBzY29wZVgsIHNjb3BlWSwgc2NvcGVaLCBzY29wZVc7XG4gICAgICAgIGxldCB1bmlmb3JtVmFsdWU7XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb24gPSBbXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0udmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFpKHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JTlRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9GTE9BVF0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtLnZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xZih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLnZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2Z2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzJdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yaXYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CVkVDMl0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMyXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDM10gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2l2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUMzXSA9IHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzNdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUM0XSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQlZFQzRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDNF07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfTUFUMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtTWF0cml4MmZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9NQVQzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm1NYXRyaXgzZnYodW5pZm9ybS5sb2NhdGlvbklkLCBmYWxzZSwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX01BVDRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIGZhbHNlLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfRkxPQVRBUlJBWV0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0xZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMkFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDM0FSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0zZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDNEFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm00ZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0JvbmVUZXh0dXJlcyA9IHRoaXMuZXh0VGV4dHVyZUZsb2F0ICYmIHRoaXMubWF4VmVydGV4VGV4dHVyZXMgPiAwO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBhbiBlc3RpbWF0ZSBvZiB0aGUgbWF4aW11bSBudW1iZXIgb2YgYm9uZXMgdGhhdCBjYW4gYmUgdXBsb2FkZWQgdG8gdGhlIEdQVVxuICAgICAgICAvLyBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGF2YWlsYWJsZSB1bmlmb3JtcyBhbmQgdGhlIG51bWJlciBvZiB1bmlmb3JtcyByZXF1aXJlZCBmb3Igbm9uLVxuICAgICAgICAvLyBib25lIGRhdGEuICBUaGlzIGlzIGJhc2VkIG9mZiBvZiB0aGUgU3RhbmRhcmQgc2hhZGVyLiAgQSB1c2VyIGRlZmluZWQgc2hhZGVyIG1heSBoYXZlXG4gICAgICAgIC8vIGV2ZW4gbGVzcyBzcGFjZSBhdmFpbGFibGUgZm9yIGJvbmVzIHNvIHRoaXMgY2FsY3VsYXRlZCB2YWx1ZSBjYW4gYmUgb3ZlcnJpZGRlbiB2aWFcbiAgICAgICAgLy8gcGMuR3JhcGhpY3NEZXZpY2Uuc2V0Qm9uZUxpbWl0LlxuICAgICAgICBsZXQgbnVtVW5pZm9ybXMgPSB0aGlzLnZlcnRleFVuaWZvcm1zQ291bnQ7XG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBNb2RlbCwgdmlldywgcHJvamVjdGlvbiBhbmQgc2hhZG93IG1hdHJpY2VzXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDg7ICAgICAvLyA4IGxpZ2h0cyBtYXgsIGVhY2ggc3BlY2lmeWluZyBhIHBvc2l0aW9uIHZlY3RvclxuICAgICAgICBudW1Vbmlmb3JtcyAtPSAxOyAgICAgLy8gRXllIHBvc2l0aW9uXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBVcCB0byA0IHRleHR1cmUgdHJhbnNmb3Jtc1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGguZmxvb3IobnVtVW5pZm9ybXMgLyAzKTsgICAvLyBlYWNoIGJvbmUgdXNlcyAzIHVuaWZvcm1zXG5cbiAgICAgICAgLy8gUHV0IGEgbGltaXQgb24gdGhlIG51bWJlciBvZiBzdXBwb3J0ZWQgYm9uZXMgYmVmb3JlIHNraW4gcGFydGl0aW9uaW5nIG11c3QgYmUgcGVyZm9ybWVkXG4gICAgICAgIC8vIFNvbWUgR1BVcyBoYXZlIGRlbW9uc3RyYXRlZCBwZXJmb3JtYW5jZSBpc3N1ZXMgaWYgdGhlIG51bWJlciBvZiB2ZWN0b3JzIGFsbG9jYXRlZCB0byB0aGVcbiAgICAgICAgLy8gc2tpbiBtYXRyaXggcGFsZXR0ZSBpcyBsZWZ0IHVuYm91bmRlZFxuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGgubWluKHRoaXMuYm9uZUxpbWl0LCAxMjgpO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza2VkUmVuZGVyZXIgPT09ICdNYWxpLTQ1MCBNUCcpIHtcbiAgICAgICAgICAgIHRoaXMuYm9uZUxpbWl0ID0gMzQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnN0YW50VGV4U291cmNlID0gdGhpcy5zY29wZS5yZXNvbHZlKFwic291cmNlXCIpO1xuXG4gICAgICAgIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wyIGZsb2F0IHRleHR1cmUgcmVuZGVyYWJpbGl0eSBpcyBkaWN0YXRlZCBieSB0aGUgRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBleHRlbnNpb25cbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSAhIXRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wxIHdlIHNob3VsZCBqdXN0IHRyeSByZW5kZXJpbmcgaW50byBhIGZsb2F0IHRleHR1cmVcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSB0ZXN0UmVuZGVyYWJsZShnbCwgZ2wuRkxPQVQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0d28gZXh0ZW5zaW9ucyBhbGxvdyB1cyB0byByZW5kZXIgdG8gaGFsZiBmbG9hdCBidWZmZXJzXG4gICAgICAgIGlmICh0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0KSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gISF0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0O1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBzaG91bGQgYWZmZWN0IGJvdGggZmxvYXQgYW5kIGhhbGZmbG9hdCBmb3JtYXRzXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9ICEhdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBNYW51YWwgcmVuZGVyIGNoZWNrIGZvciBoYWxmIGZsb2F0XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IHRlc3RSZW5kZXJhYmxlKGdsLCB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlID0gKHRoaXMubWF4UHJlY2lzaW9uID09PSBcImhpZ2hwXCIgJiYgdGhpcy5tYXhWZXJ0ZXhUZXh0dXJlcyA+PSAyKTtcblxuICAgICAgICB0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgdGhpcy5fc3BlY3Rvck1hcmtlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5fc3BlY3RvckN1cnJlbnRNYXJrZXIgPSBcIlwiO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBhcmVhIGxpZ2h0IExVVCBmb3JtYXQgLSBvcmRlciBvZiBwcmVmZXJlbmNlOiBoYWxmLCBmbG9hdCwgOGJpdFxuICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4O1xuICAgICAgICBpZiAodGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0ICYmIHRoaXMudGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSAmJiB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIpIHtcbiAgICAgICAgICAgIHRoaXMuYXJlYUxpZ2h0THV0Rm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCAmJiB0aGlzLmV4dFRleHR1cmVGbG9hdExpbmVhcikge1xuICAgICAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBMzJGO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSB0aGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiB0aGlzLmZlZWRiYWNrKSB7XG4gICAgICAgICAgICBnbC5kZWxldGVUcmFuc2Zvcm1GZWVkYmFjayh0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2xlYXJTaGFkZXJDYWNoZSgpO1xuICAgICAgICB0aGlzLmNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSgpO1xuXG4gICAgICAgIHRoaXMuY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmdsY29udGV4dGxvc3QnLCB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0cmVzdG9yZWQnLCB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5nbCA9IG51bGw7XG5cbiAgICAgICAgc3VwZXIucG9zdERlc3Ryb3koKTtcbiAgICB9XG5cbiAgICAvLyBwcm92aWRlIHdlYmdsIGltcGxlbWVudGF0aW9uIGZvciB0aGUgdmVydGV4IGJ1ZmZlclxuICAgIGNyZWF0ZVZlcnRleEJ1ZmZlckltcGwodmVydGV4QnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbFZlcnRleEJ1ZmZlcigpO1xuICAgIH1cblxuICAgIC8vIHByb3ZpZGUgd2ViZ2wgaW1wbGVtZW50YXRpb24gZm9yIHRoZSBpbmRleCBidWZmZXJcbiAgICBjcmVhdGVJbmRleEJ1ZmZlckltcGwoaW5kZXhCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbEluZGV4QnVmZmVyKGluZGV4QnVmZmVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVTaGFkZXJJbXBsKHNoYWRlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsU2hhZGVyKHNoYWRlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZUltcGwodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsVGV4dHVyZSgpO1xuICAgIH1cblxuICAgIGNyZWF0ZVJlbmRlclRhcmdldEltcGwocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xSZW5kZXJUYXJnZXQoKTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgdXBkYXRlTWFya2VyKCkge1xuICAgICAgICB0aGlzLl9zcGVjdG9yQ3VycmVudE1hcmtlciA9IHRoaXMuX3NwZWN0b3JNYXJrZXJzLmpvaW4oXCIgfCBcIikgKyBcIiAjIFwiO1xuICAgIH1cblxuICAgIHB1c2hNYXJrZXIobmFtZSkge1xuICAgICAgICBpZiAod2luZG93LnNwZWN0b3IpIHtcbiAgICAgICAgICAgIHRoaXMuX3NwZWN0b3JNYXJrZXJzLnB1c2gobmFtZSk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZU1hcmtlcigpO1xuICAgICAgICAgICAgd2luZG93LnNwZWN0b3Iuc2V0TWFya2VyKHRoaXMuX3NwZWN0b3JDdXJyZW50TWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBvcE1hcmtlcigpIHtcbiAgICAgICAgaWYgKHdpbmRvdy5zcGVjdG9yKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3BlY3Rvck1hcmtlcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3BlY3Rvck1hcmtlcnMucG9wKCk7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVNYXJrZXIoKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zcGVjdG9yTWFya2Vycy5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgIHdpbmRvdy5zcGVjdG9yLnNldE1hcmtlcih0aGlzLl9zcGVjdG9yQ3VycmVudE1hcmtlcik7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuc3BlY3Rvci5jbGVhck1hcmtlcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vICNlbmRpZlxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIHByZWNpc2lvbiBzdXBwb3J0ZWQgYnkgaW50cyBhbmQgZmxvYXRzIGluIHZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycy4gTm90ZSB0aGF0XG4gICAgICogZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0IGlzIG5vdCBndWFyYW50ZWVkIHRvIGJlIHByZXNlbnQgKHN1Y2ggYXMgc29tZSBpbnN0YW5jZXMgb2YgdGhlXG4gICAgICogZGVmYXVsdCBBbmRyb2lkIGJyb3dzZXIpLiBJbiB0aGlzIGNhc2UsIGFzc3VtZSBoaWdocCBpcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBcImhpZ2hwXCIsIFwibWVkaXVtcFwiIG9yIFwibG93cFwiXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldFByZWNpc2lvbigpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBsZXQgcHJlY2lzaW9uID0gXCJoaWdocFwiO1xuXG4gICAgICAgIGlmIChnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuVkVSVEVYX1NIQURFUiwgZ2wuSElHSF9GTE9BVCk7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuVkVSVEVYX1NIQURFUiwgZ2wuTUVESVVNX0ZMT0FUKTtcblxuICAgICAgICAgICAgY29uc3QgZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLkZSQUdNRU5UX1NIQURFUiwgZ2wuSElHSF9GTE9BVCk7XG4gICAgICAgICAgICBjb25zdCBmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5GUkFHTUVOVF9TSEFERVIsIGdsLk1FRElVTV9GTE9BVCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGhpZ2hwQXZhaWxhYmxlID0gdmVydGV4U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdC5wcmVjaXNpb24gPiAwICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdC5wcmVjaXNpb24gPiAwO1xuICAgICAgICAgICAgY29uc3QgbWVkaXVtcEF2YWlsYWJsZSA9IHZlcnRleFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdC5wcmVjaXNpb24gPiAwICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0LnByZWNpc2lvbiA+IDA7XG5cbiAgICAgICAgICAgIGlmICghaGlnaHBBdmFpbGFibGUpIHtcbiAgICAgICAgICAgICAgICBpZiAobWVkaXVtcEF2YWlsYWJsZSkge1xuICAgICAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSBcIm1lZGl1bXBcIjtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2FybihcIldBUk5JTkc6IGhpZ2hwIG5vdCBzdXBwb3J0ZWQsIHVzaW5nIG1lZGl1bXBcIik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gXCJsb3dwXCI7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJXQVJOSU5HOiBoaWdocCBhbmQgbWVkaXVtcCBub3Qgc3VwcG9ydGVkLCB1c2luZyBsb3dwXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcmVjaXNpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgZXh0ZW5zaW9ucyBwcm92aWRlZCBieSB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplRXh0ZW5zaW9ucygpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBjb25zdCBzdXBwb3J0ZWRFeHRlbnNpb25zID0gZ2wuZ2V0U3VwcG9ydGVkRXh0ZW5zaW9ucygpO1xuXG4gICAgICAgIGNvbnN0IGdldEV4dGVuc2lvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN1cHBvcnRlZEV4dGVuc2lvbnMuaW5kZXhPZihhcmd1bWVudHNbaV0pICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2wuZ2V0RXh0ZW5zaW9uKGFyZ3VtZW50c1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRJbnN0YW5jaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlTG9kID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRWZXJ0ZXhBcnJheU9iamVjdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dENvbG9yQnVmZmVyRmxvYXQgPSBnZXRFeHRlbnNpb24oJ0VYVF9jb2xvcl9idWZmZXJfZmxvYXQnKTtcbiAgICAgICAgICAgIC8vIE5vdGUgdGhhdCBGaXJlZm94IGV4cG9zZXMgRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5IHVuZGVyIFdlYkdMMiByYXRoZXIgdGhhblxuICAgICAgICAgICAgLy8gRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5X3dlYmdsMlxuICAgICAgICAgICAgdGhpcy5leHREaXNqb2ludFRpbWVyUXVlcnkgPSBnZXRFeHRlbnNpb24oJ0VYVF9kaXNqb2ludF90aW1lcl9xdWVyeV93ZWJnbDInLCAnRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5Jyk7XG4gICAgICAgICAgICB0aGlzLmV4dERlcHRoVGV4dHVyZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gZ2V0RXh0ZW5zaW9uKFwiRVhUX2JsZW5kX21pbm1heFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSBnZXRFeHRlbnNpb24oJ0VYVF9kcmF3X2J1ZmZlcnMnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0SW5zdGFuY2luZyA9IGdldEV4dGVuc2lvbihcIkFOR0xFX2luc3RhbmNlZF9hcnJheXNcIik7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zdGFsbCB0aGUgV2ViR0wgMiBJbnN0YW5jaW5nIEFQSSBmb3IgV2ViR0wgMS4wXG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ID0gdGhpcy5leHRJbnN0YW5jaW5nO1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQgPSBleHQuZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQgPSBleHQuZHJhd0VsZW1lbnRzSW5zdGFuY2VkQU5HTEUuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLnZlcnRleEF0dHJpYkRpdmlzb3IgPSBleHQudmVydGV4QXR0cmliRGl2aXNvckFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzID0gZ2V0RXh0ZW5zaW9uKFwiT0VTX3N0YW5kYXJkX2Rlcml2YXRpdmVzXCIpO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXQgPSBnZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9mbG9hdFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCA9IGdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2hhbGZfZmxvYXRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSBnZXRFeHRlbnNpb24oJ0VYVF9zaGFkZXJfdGV4dHVyZV9sb2QnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSBnZXRFeHRlbnNpb24oXCJPRVNfZWxlbWVudF9pbmRleF91aW50XCIpO1xuICAgICAgICAgICAgdGhpcy5leHRWZXJ0ZXhBcnJheU9iamVjdCA9IGdldEV4dGVuc2lvbihcIk9FU192ZXJ0ZXhfYXJyYXlfb2JqZWN0XCIpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAvLyBJbnN0YWxsIHRoZSBXZWJHTCAyIFZBTyBBUEkgZm9yIFdlYkdMIDEuMFxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3Q7XG4gICAgICAgICAgICAgICAgZ2wuY3JlYXRlVmVydGV4QXJyYXkgPSBleHQuY3JlYXRlVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5ID0gZXh0LmRlbGV0ZVZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5pc1ZlcnRleEFycmF5ID0gZXh0LmlzVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSA9IGV4dC5iaW5kVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGlzam9pbnRUaW1lclF1ZXJ5ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGVwdGhUZXh0dXJlID0gZ2wuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZXB0aF90ZXh0dXJlJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4dERlYnVnUmVuZGVyZXJJbmZvID0gZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZWJ1Z19yZW5kZXJlcl9pbmZvJyk7XG4gICAgICAgIHRoaXMuZXh0VGV4dHVyZUZsb2F0TGluZWFyID0gZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfZmxvYXRfbGluZWFyXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIgPSBnZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9oYWxmX2Zsb2F0X2xpbmVhclwiKTtcbiAgICAgICAgdGhpcy5leHRGbG9hdEJsZW5kID0gZ2V0RXh0ZW5zaW9uKFwiRVhUX2Zsb2F0X2JsZW5kXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYyA9IGdldEV4dGVuc2lvbignRVhUX3RleHR1cmVfZmlsdGVyX2FuaXNvdHJvcGljJywgJ1dFQktJVF9FWFRfdGV4dHVyZV9maWx0ZXJfYW5pc290cm9waWMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUVUQzEgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMxJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDID0gZ2V0RXh0ZW5zaW9uKCdXRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfcHZydGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9wdnJ0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyA9IGdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3MzdGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9zM3RjJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hdGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUFTVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hc3RjJyk7XG4gICAgICAgIHRoaXMuZXh0UGFyYWxsZWxTaGFkZXJDb21waWxlID0gZ2V0RXh0ZW5zaW9uKCdLSFJfcGFyYWxsZWxfc2hhZGVyX2NvbXBpbGUnKTtcblxuICAgICAgICAvLyBpT1MgZXhwb3NlcyB0aGlzIGZvciBoYWxmIHByZWNpc2lvbiByZW5kZXIgdGFyZ2V0cyBvbiBib3RoIFdlYmdsMSBhbmQgMiBmcm9tIGlPUyB2IDE0LjViZXRhXG4gICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQgPSBnZXRFeHRlbnNpb24oXCJFWFRfY29sb3JfYnVmZmVyX2hhbGZfZmxvYXRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIGNhcGFiaWxpdGllcyBvZiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplQ2FwYWJpbGl0aWVzKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCBleHQ7XG5cbiAgICAgICAgY29uc3QgdXNlckFnZW50ID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgPyBuYXZpZ2F0b3IudXNlckFnZW50IDogXCJcIjtcblxuICAgICAgICB0aGlzLm1heFByZWNpc2lvbiA9IHRoaXMucHJlY2lzaW9uID0gdGhpcy5nZXRQcmVjaXNpb24oKTtcblxuICAgICAgICBjb25zdCBjb250ZXh0QXR0cmlicyA9IGdsLmdldENvbnRleHRBdHRyaWJ1dGVzKCk7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNc2FhID0gY29udGV4dEF0dHJpYnMuYW50aWFsaWFzO1xuICAgICAgICB0aGlzLnN1cHBvcnRzU3RlbmNpbCA9IGNvbnRleHRBdHRyaWJzLnN0ZW5jaWw7XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0luc3RhbmNpbmcgPSAhIXRoaXMuZXh0SW5zdGFuY2luZztcblxuICAgICAgICAvLyBRdWVyeSBwYXJhbWV0ZXIgdmFsdWVzIGZyb20gdGhlIFdlYkdMIGNvbnRleHRcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhDdWJlTWFwU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhSZW5kZXJCdWZmZXJTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9SRU5ERVJCVUZGRVJfU0laRSk7XG4gICAgICAgIHRoaXMubWF4VGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heENvbWJpbmVkVGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heFZlcnRleFRleHR1cmVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9WRVJURVhfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMudmVydGV4VW5pZm9ybXNDb3VudCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRVbmlmb3Jtc0NvdW50ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMpO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMubWF4RHJhd0J1ZmZlcnMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0RSQVdfQlVGRkVSUyk7XG4gICAgICAgICAgICB0aGlzLm1heENvbG9yQXR0YWNobWVudHMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTE9SX0FUVEFDSE1FTlRTKTtcbiAgICAgICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfM0RfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dCA9IHRoaXMuZXh0RHJhd0J1ZmZlcnM7XG4gICAgICAgICAgICB0aGlzLm1heERyYXdCdWZmZXJzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfRFJBV19CVUZGRVJTX0VYVCkgOiAxO1xuICAgICAgICAgICAgdGhpcy5tYXhDb2xvckF0dGFjaG1lbnRzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfQ09MT1JfQVRUQUNITUVOVFNfRVhUKSA6IDE7XG4gICAgICAgICAgICB0aGlzLm1heFZvbHVtZVNpemUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHREZWJ1Z1JlbmRlcmVySW5mbztcbiAgICAgICAgdGhpcy51bm1hc2tlZFJlbmRlcmVyID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5VTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCkgOiAnJztcbiAgICAgICAgdGhpcy51bm1hc2tlZFZlbmRvciA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuVU5NQVNLRURfVkVORE9SX1dFQkdMKSA6ICcnO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIHdlIHN1cHBvcnQgR1BVIHBhcnRpY2xlcy4gQXQgdGhlIG1vbWVudCwgU2Ftc3VuZyBkZXZpY2VzIHdpdGggRXh5bm9zIChBUk0pIGVpdGhlciBjcmFzaCBvciByZW5kZXJcbiAgICAgICAgLy8gaW5jb3JyZWN0bHkgd2hlbiB1c2luZyBHUFUgZm9yIHBhcnRpY2xlcy4gU2VlOlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGxheWNhbnZhcy9lbmdpbmUvaXNzdWVzLzM5NjdcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BsYXljYW52YXMvZW5naW5lL2lzc3Vlcy8zNDE1XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wbGF5Y2FudmFzL2VuZ2luZS9pc3N1ZXMvNDUxNFxuICAgICAgICAvLyBFeGFtcGxlIFVBIG1hdGNoZXM6IFN0YXJ0aW5nICdTTScgYW5kIGFueSBjb21iaW5hdGlvbiBvZiBsZXR0ZXJzIG9yIG51bWJlcnM6XG4gICAgICAgIC8vIE1vemlsbGEvNS4wIChMaW51eCwgQW5kcm9pZCAxMjsgU00tRzk3MEYgQnVpbGQvU1AxQS4yMTA4MTIuMDE2OyB3dilcbiAgICAgICAgLy8gTW96aWxsYS81LjAgKExpbnV4LCBBbmRyb2lkIDEyOyBTTS1HOTcwRilcbiAgICAgICAgY29uc3Qgc2Ftc3VuZ01vZGVsUmVnZXggPSAvU00tW2EtekEtWjAtOV0rLztcbiAgICAgICAgdGhpcy5zdXBwb3J0c0dwdVBhcnRpY2xlcyA9ICEodGhpcy51bm1hc2tlZFZlbmRvciA9PT0gJ0FSTScgJiYgdXNlckFnZW50Lm1hdGNoKHNhbXN1bmdNb2RlbFJlZ2V4KSk7XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWM7XG4gICAgICAgIHRoaXMubWF4QW5pc290cm9weSA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuTUFYX1RFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUKSA6IDE7XG5cbiAgICAgICAgdGhpcy5zYW1wbGVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLlNBTVBMRVMpO1xuICAgICAgICB0aGlzLm1heFNhbXBsZXMgPSB0aGlzLndlYmdsMiAmJiAhdGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nID8gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9TQU1QTEVTKSA6IDE7XG5cbiAgICAgICAgLy8gRG9uJ3QgYWxsb3cgYXJlYSBsaWdodHMgb24gb2xkIGFuZHJvaWQgZGV2aWNlcywgdGhleSBvZnRlbiBmYWlsIHRvIGNvbXBpbGUgdGhlIHNoYWRlciwgcnVuIGl0IGluY29ycmVjdGx5IG9yIGFyZSB2ZXJ5IHNsb3cuXG4gICAgICAgIHRoaXMuc3VwcG9ydHNBcmVhTGlnaHRzID0gdGhpcy53ZWJnbDIgfHwgIXBsYXRmb3JtLmFuZHJvaWQ7XG5cbiAgICAgICAgLy8gQWxzbyBkbyBub3QgYWxsb3cgdGhlbSB3aGVuIHdlIG9ubHkgaGF2ZSBzbWFsbCBudW1iZXIgb2YgdGV4dHVyZSB1bml0c1xuICAgICAgICBpZiAodGhpcy5tYXhUZXh0dXJlcyA8PSA4KSB7XG4gICAgICAgICAgICB0aGlzLnN1cHBvcnRzQXJlYUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBpbml0aWFsIHJlbmRlciBzdGF0ZSBvbiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplUmVuZGVyU3RhdGUoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHJlbmRlciBzdGF0ZSB0byBhIGtub3duIHN0YXJ0IHN0YXRlXG4gICAgICAgIHRoaXMuYmxlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG5cbiAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgIHRoaXMuYmxlbmREc3QgPSBCTEVORE1PREVfWkVSTztcbiAgICAgICAgdGhpcy5ibGVuZFNyY0FscGhhID0gQkxFTkRNT0RFX09ORTtcbiAgICAgICAgdGhpcy5ibGVuZERzdEFscGhhID0gQkxFTkRNT0RFX1pFUk87XG4gICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUJsZW5kID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYmxlbmRFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICB0aGlzLmJsZW5kQWxwaGFFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICB0aGlzLnNlcGFyYXRlQWxwaGFFcXVhdGlvbiA9IGZhbHNlO1xuICAgICAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5aRVJPKTtcbiAgICAgICAgZ2wuYmxlbmRFcXVhdGlvbihnbC5GVU5DX0FERCk7XG5cbiAgICAgICAgdGhpcy5ibGVuZENvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDApO1xuICAgICAgICBnbC5ibGVuZENvbG9yKDAsIDAsIDAsIDApO1xuXG4gICAgICAgIHRoaXMud3JpdGVSZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlR3JlZW4gPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlQmx1ZSA9IHRydWU7XG4gICAgICAgIHRoaXMud3JpdGVBbHBoYSA9IHRydWU7XG4gICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuICAgICAgICB0aGlzLmN1bGxNb2RlID0gQ1VMTEZBQ0VfQkFDSztcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkNVTExfRkFDRSk7XG4gICAgICAgIGdsLmN1bGxGYWNlKGdsLkJBQ0spO1xuXG4gICAgICAgIHRoaXMuZGVwdGhUZXN0ID0gdHJ1ZTtcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuXG4gICAgICAgIHRoaXMuZGVwdGhGdW5jID0gRlVOQ19MRVNTRVFVQUw7XG4gICAgICAgIGdsLmRlcHRoRnVuYyhnbC5MRVFVQUwpO1xuXG4gICAgICAgIHRoaXMuZGVwdGhXcml0ZSA9IHRydWU7XG4gICAgICAgIGdsLmRlcHRoTWFzayh0cnVlKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWwgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuXG4gICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IHRoaXMuc3RlbmNpbEZ1bmNCYWNrID0gRlVOQ19BTFdBWVM7XG4gICAgICAgIHRoaXMuc3RlbmNpbFJlZkZyb250ID0gdGhpcy5zdGVuY2lsUmVmQmFjayA9IDA7XG4gICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IHRoaXMuc3RlbmNpbE1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbEZ1bmMoZ2wuQUxXQVlTLCAwLCAweEZGKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IFNURU5DSUxPUF9LRUVQO1xuICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gU1RFTkNJTE9QX0tFRVA7XG4gICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSBTVEVOQ0lMT1BfS0VFUDtcbiAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgPSAweEZGO1xuICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbE9wKGdsLktFRVAsIGdsLktFRVAsIGdsLktFRVApO1xuICAgICAgICBnbC5zdGVuY2lsTWFzaygweEZGKTtcblxuICAgICAgICB0aGlzLmFscGhhVG9Db3ZlcmFnZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnJhc3RlciA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5TQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UpO1xuICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5SQVNURVJJWkVSX0RJU0NBUkQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kZXB0aEJpYXNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIGdsLmRpc2FibGUoZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XG5cbiAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gMTtcbiAgICAgICAgZ2wuY2xlYXJEZXB0aCgxKTtcblxuICAgICAgICB0aGlzLmNsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMCk7XG4gICAgICAgIGdsLmNsZWFyQ29sb3IoMCwgMCwgMCwgMCk7XG5cbiAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWwgPSAwO1xuICAgICAgICBnbC5jbGVhclN0ZW5jaWwoMCk7XG5cbiAgICAgICAgLy8gQ2FjaGVkIHZpZXdwb3J0IGFuZCBzY2lzc29yIGRpbWVuc2lvbnNcbiAgICAgICAgdGhpcy52eCA9IHRoaXMudnkgPSB0aGlzLnZ3ID0gdGhpcy52aCA9IDA7XG4gICAgICAgIHRoaXMuc3ggPSB0aGlzLnN5ID0gdGhpcy5zdyA9IHRoaXMuc2ggPSAwO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgZ2wuaGludChnbC5GUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5ULCBnbC5OSUNFU1QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykge1xuICAgICAgICAgICAgICAgIGdsLmhpbnQodGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzLkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlRfT0VTLCBnbC5OSUNFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZ2wuZW5hYmxlKGdsLlNDSVNTT1JfVEVTVCk7XG5cbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTl9XRUJHTCwgZ2wuTk9ORSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZhbHNlO1xuICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gZmFsc2U7XG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgZmFsc2UpO1xuXG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19BTElHTk1FTlQsIDEpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCkge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuXG4gICAgICAgIC8vIFNoYWRlciBjb2RlIHRvIFdlYkdMIHNoYWRlciBjYWNoZVxuICAgICAgICB0aGlzLnZlcnRleFNoYWRlckNhY2hlID0ge307XG4gICAgICAgIHRoaXMuZnJhZ21lbnRTaGFkZXJDYWNoZSA9IHt9O1xuXG4gICAgICAgIC8vIGNhY2hlIG9mIFZBT3NcbiAgICAgICAgdGhpcy5fdmFvTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuICAgICAgICB0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5mZWVkYmFjayA9IG51bGw7XG4gICAgICAgIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudGV4dHVyZVVuaXQgPSAwO1xuICAgICAgICB0aGlzLnRleHR1cmVVbml0cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWF4Q29tYmluZWRUZXh0dXJlczsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0cy5wdXNoKFtudWxsLCBudWxsLCBudWxsXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgV2ViR0wgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIC8vIHJlbGVhc2Ugc2hhZGVyc1xuICAgICAgICBmb3IgKGNvbnN0IHNoYWRlciBvZiB0aGlzLnNoYWRlcnMpIHtcbiAgICAgICAgICAgIHNoYWRlci5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGNvbnN0IHRleHR1cmUgb2YgdGhpcy50ZXh0dXJlcykge1xuICAgICAgICAgICAgdGV4dHVyZS5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB2ZXJ0ZXggYW5kIGluZGV4IGJ1ZmZlcnNcbiAgICAgICAgZm9yIChjb25zdCBidWZmZXIgb2YgdGhpcy5idWZmZXJzKSB7XG4gICAgICAgICAgICBidWZmZXIubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc2V0IGFsbCByZW5kZXIgdGFyZ2V0cyBzbyB0aGV5J2xsIGJlIHJlY3JlYXRlZCBhcyByZXF1aXJlZC5cbiAgICAgICAgLy8gVE9ETzogYSBzb2x1dGlvbiBmb3IgdGhlIGNhc2Ugd2hlcmUgYSByZW5kZXIgdGFyZ2V0IGNvbnRhaW5zIHNvbWV0aGluZ1xuICAgICAgICAvLyB0aGF0IHdhcyBwcmV2aW91c2x5IGdlbmVyYXRlZCB0aGF0IG5lZWRzIHRvIGJlIHJlLXJlbmRlcmVkLlxuICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldHMpIHtcbiAgICAgICAgICAgIHRhcmdldC5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgaXMgcmVzdG9yZWQuIEl0IHJlaW5pdGlhbGl6ZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVzdG9yZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ2FwYWJpbGl0aWVzKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKTtcblxuICAgICAgICAvLyBSZWNvbXBpbGUgYWxsIHNoYWRlcnMgKHRoZXknbGwgYmUgbGlua2VkIHdoZW4gdGhleSdyZSBuZXh0IGFjdHVhbGx5IHVzZWQpXG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyIG9mIHRoaXMuc2hhZGVycykge1xuICAgICAgICAgICAgc2hhZGVyLnJlc3RvcmVDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNyZWF0ZSBidWZmZXIgb2JqZWN0cyBhbmQgcmV1cGxvYWQgYnVmZmVyIGRhdGEgdG8gdGhlIEdQVVxuICAgICAgICBmb3IgKGNvbnN0IGJ1ZmZlciBvZiB0aGlzLmJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIGJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgYWN0aXZlIHJlY3RhbmdsZSBmb3IgcmVuZGVyaW5nIG9uIHRoZSBzcGVjaWZpZWQgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgcGl4ZWwgc3BhY2UgeC1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHZpZXdwb3J0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHBpeGVsIHNwYWNlIHktY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSB2aWV3cG9ydC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3aWR0aCBvZiB0aGUgdmlld3BvcnQgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIGhlaWdodCBvZiB0aGUgdmlld3BvcnQgaW4gcGl4ZWxzLlxuICAgICAqL1xuICAgIHNldFZpZXdwb3J0KHgsIHksIHcsIGgpIHtcbiAgICAgICAgaWYgKCh0aGlzLnZ4ICE9PSB4KSB8fCAodGhpcy52eSAhPT0geSkgfHwgKHRoaXMudncgIT09IHcpIHx8ICh0aGlzLnZoICE9PSBoKSkge1xuICAgICAgICAgICAgdGhpcy5nbC52aWV3cG9ydCh4LCB5LCB3LCBoKTtcbiAgICAgICAgICAgIHRoaXMudnggPSB4O1xuICAgICAgICAgICAgdGhpcy52eSA9IHk7XG4gICAgICAgICAgICB0aGlzLnZ3ID0gdztcbiAgICAgICAgICAgIHRoaXMudmggPSBoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBhY3RpdmUgc2Npc3NvciByZWN0YW5nbGUgb24gdGhlIHNwZWNpZmllZCBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSBwaXhlbCBzcGFjZSB4LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgcGl4ZWwgc3BhY2UgeS1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZSBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZSBpbiBwaXhlbHMuXG4gICAgICovXG4gICAgc2V0U2Npc3Nvcih4LCB5LCB3LCBoKSB7XG4gICAgICAgIGlmICgodGhpcy5zeCAhPT0geCkgfHwgKHRoaXMuc3kgIT09IHkpIHx8ICh0aGlzLnN3ICE9PSB3KSB8fCAodGhpcy5zaCAhPT0gaCkpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc2Npc3Nvcih4LCB5LCB3LCBoKTtcbiAgICAgICAgICAgIHRoaXMuc3ggPSB4O1xuICAgICAgICAgICAgdGhpcy5zeSA9IHk7XG4gICAgICAgICAgICB0aGlzLnN3ID0gdztcbiAgICAgICAgICAgIHRoaXMuc2ggPSBoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQmluZHMgdGhlIHNwZWNpZmllZCBmcmFtZWJ1ZmZlciBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1dlYkdMRnJhbWVidWZmZXIgfCBudWxsfSBmYiAtIFRoZSBmcmFtZWJ1ZmZlciB0byBiaW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRGcmFtZWJ1ZmZlcihmYikge1xuICAgICAgICBpZiAodGhpcy5hY3RpdmVGcmFtZWJ1ZmZlciAhPT0gZmIpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZmIpO1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVGcmFtZWJ1ZmZlciA9IGZiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHNvdXJjZSByZW5kZXIgdGFyZ2V0IGludG8gZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldC4gTW9zdGx5IHVzZWQgYnkgcG9zdC1lZmZlY3RzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtzb3VyY2VdIC0gVGhlIHNvdXJjZSByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtkZXN0XSAtIFRoZSBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvcHkgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBjb3B5UmVuZGVyVGFyZ2V0KHNvdXJjZSwgZGVzdCwgY29sb3IsIGRlcHRoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICBpZiAoIXRoaXMud2ViZ2wyICYmIGRlcHRoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkRlcHRoIGlzIG5vdCBjb3B5YWJsZSBvbiBXZWJHTCAxLjBcIik7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgICAgICBpZiAoIWRlc3QpIHtcbiAgICAgICAgICAgICAgICAvLyBjb3B5aW5nIHRvIGJhY2tidWZmZXJcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fY29sb3JCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IGVtcHR5IGNvbG9yIGJ1ZmZlciB0byBiYWNrYnVmZmVyXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAvLyBjb3B5aW5nIHRvIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fY29sb3JCdWZmZXIgfHwgIWRlc3QuX2NvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBjb2xvciBidWZmZXIsIGJlY2F1c2Ugb25lIG9mIHRoZSByZW5kZXIgdGFyZ2V0cyBkb2Vzbid0IGhhdmUgaXRcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZS5fY29sb3JCdWZmZXIuX2Zvcm1hdCAhPT0gZGVzdC5fY29sb3JCdWZmZXIuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgcmVuZGVyIHRhcmdldHMgb2YgZGlmZmVyZW50IGNvbG9yIGZvcm1hdHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlcHRoICYmIHNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2RlcHRoKSB7ICAgLy8gd2hlbiBkZXB0aCBpcyBhdXRvbWF0aWMsIHdlIGNhbm5vdCB0ZXN0IHRoZSBidWZmZXIgbm9yIGl0cyBmb3JtYXRcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fZGVwdGhCdWZmZXIgfHwgIWRlc3QuX2RlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBkZXB0aCBidWZmZXIsIGJlY2F1c2Ugb25lIG9mIHRoZSByZW5kZXIgdGFyZ2V0cyBkb2Vzbid0IGhhdmUgaXRcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZS5fZGVwdGhCdWZmZXIuX2Zvcm1hdCAhPT0gZGVzdC5fZGVwdGhCdWZmZXIuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgcmVuZGVyIHRhcmdldHMgb2YgZGlmZmVyZW50IGRlcHRoIGZvcm1hdHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ0NPUFktUlQnKTtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgZGVzdCkge1xuICAgICAgICAgICAgY29uc3QgcHJldlJ0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IGRlc3Q7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUJlZ2luKCk7XG4gICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuUkVBRF9GUkFNRUJVRkZFUiwgc291cmNlID8gc291cmNlLmltcGwuX2dsRnJhbWVCdWZmZXIgOiBudWxsKTtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5EUkFXX0ZSQU1FQlVGRkVSLCBkZXN0LmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuICAgICAgICAgICAgY29uc3QgdyA9IHNvdXJjZSA/IHNvdXJjZS53aWR0aCA6IGRlc3Qud2lkdGg7XG4gICAgICAgICAgICBjb25zdCBoID0gc291cmNlID8gc291cmNlLmhlaWdodCA6IGRlc3QuaGVpZ2h0O1xuICAgICAgICAgICAgZ2wuYmxpdEZyYW1lYnVmZmVyKDAsIDAsIHcsIGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwgMCwgdywgaCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY29sb3IgPyBnbC5DT0xPUl9CVUZGRVJfQklUIDogMCkgfCAoZGVwdGggPyBnbC5ERVBUSF9CVUZGRVJfQklUIDogMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuTkVBUkVTVCk7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHByZXZSdDtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgcHJldlJ0ID8gcHJldlJ0LmltcGwuX2dsRnJhbWVCdWZmZXIgOiBudWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuZ2V0Q29weVNoYWRlcigpO1xuICAgICAgICAgICAgdGhpcy5jb25zdGFudFRleFNvdXJjZS5zZXRWYWx1ZShzb3VyY2UuX2NvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgIGRyYXdRdWFkV2l0aFNoYWRlcih0aGlzLCBkZXN0LCBzaGFkZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGNvcHkgc2hhZGVyIGZvciBlZmZpY2llbnQgcmVuZGVyaW5nIG9mIGZ1bGxzY3JlZW4tcXVhZCB3aXRoIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U2hhZGVyfSBUaGUgY29weSBzaGFkZXIgKGJhc2VkIG9uIGBmdWxsc2NyZWVuUXVhZFZTYCBhbmQgYG91dHB1dFRleDJEUFNgIGluXG4gICAgICogYHNoYWRlckNodW5rc2ApLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRDb3B5U2hhZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2NvcHlTaGFkZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvcHlTaGFkZXIgPSBuZXcgU2hhZGVyKHRoaXMsIFNoYWRlclV0aWxzLmNyZWF0ZURlZmluaXRpb24odGhpcywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdvdXRwdXRUZXgyRCcsXG4gICAgICAgICAgICAgICAgdmVydGV4Q29kZTogX2Z1bGxTY3JlZW5RdWFkVlMsXG4gICAgICAgICAgICAgICAgZnJhZ21lbnRDb2RlOiBfb3V0cHV0VGV4dHVyZTJEXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvcHlTaGFkZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgYSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBzdGFydC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RhcnRQYXNzKHJlbmRlclBhc3MpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgYFNUQVJULVBBU1NgKTtcblxuICAgICAgICAvLyBzZXQgdXAgcmVuZGVyIHRhcmdldFxuICAgICAgICB0aGlzLnNldFJlbmRlclRhcmdldChyZW5kZXJQYXNzLnJlbmRlclRhcmdldCk7XG4gICAgICAgIHRoaXMudXBkYXRlQmVnaW4oKTtcblxuICAgICAgICAvLyBjbGVhciB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCBjb2xvck9wcyA9IHJlbmRlclBhc3MuY29sb3JPcHM7XG4gICAgICAgIGNvbnN0IGRlcHRoU3RlbmNpbE9wcyA9IHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzO1xuICAgICAgICBpZiAoY29sb3JPcHMuY2xlYXIgfHwgZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGggfHwgZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCkge1xuXG4gICAgICAgICAgICAvLyB0aGUgcGFzcyBhbHdheXMgY2xlYXJzIGZ1bGwgdGFyZ2V0XG4gICAgICAgICAgICBjb25zdCBydCA9IHJlbmRlclBhc3MucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgY29uc3Qgd2lkdGggPSBydCA/IHJ0LndpZHRoIDogdGhpcy53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IGhlaWdodCA9IHJ0ID8gcnQuaGVpZ2h0IDogdGhpcy5oZWlnaHQ7XG4gICAgICAgICAgICB0aGlzLnNldFZpZXdwb3J0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICAgICAgdGhpcy5zZXRTY2lzc29yKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuXG4gICAgICAgICAgICBsZXQgY2xlYXJGbGFncyA9IDA7XG4gICAgICAgICAgICBjb25zdCBjbGVhck9wdGlvbnMgPSB7fTtcblxuICAgICAgICAgICAgaWYgKGNvbG9yT3BzLmNsZWFyKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJGbGFncyB8PSBDTEVBUkZMQUdfQ09MT1I7XG4gICAgICAgICAgICAgICAgY2xlYXJPcHRpb25zLmNvbG9yID0gW2NvbG9yT3BzLmNsZWFyVmFsdWUuciwgY29sb3JPcHMuY2xlYXJWYWx1ZS5nLCBjb2xvck9wcy5jbGVhclZhbHVlLmIsIGNvbG9yT3BzLmNsZWFyVmFsdWUuYV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aCkge1xuICAgICAgICAgICAgICAgIGNsZWFyRmxhZ3MgfD0gQ0xFQVJGTEFHX0RFUFRIO1xuICAgICAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5kZXB0aCA9IGRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoVmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJGbGFncyB8PSBDTEVBUkZMQUdfU1RFTkNJTDtcbiAgICAgICAgICAgICAgICBjbGVhck9wdGlvbnMuc3RlbmNpbCA9IGRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWxWYWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2xlYXIgaXRcbiAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5mbGFncyA9IGNsZWFyRmxhZ3M7XG4gICAgICAgICAgICB0aGlzLmNsZWFyKGNsZWFyT3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoIXRoaXMuaW5zaWRlUmVuZGVyUGFzcyk7XG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IHRydWU7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5kIGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlbmRlclBhc3N9IHJlbmRlclBhc3MgLSBUaGUgcmVuZGVyIHBhc3MgdG8gZW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBlbmRQYXNzKHJlbmRlclBhc3MpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgYEVORC1QQVNTYCk7XG5cbiAgICAgICAgdGhpcy51bmJpbmRWZXJ0ZXhBcnJheSgpO1xuXG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG5cbiAgICAgICAgICAgIC8vIGludmFsaWRhdGUgYnVmZmVycyB0byBzdG9wIHRoZW0gYmVpbmcgd3JpdHRlbiB0byBvbiB0aWxlZCBhcmNoaXRleHR1cmVzXG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBpbnZhbGlkYXRlQXR0YWNobWVudHMubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgICAgICAgICAvLyBpbnZhbGlkYXRlIGNvbG9yIG9ubHkgaWYgd2UgZG9uJ3QgbmVlZCB0byByZXNvbHZlIGl0XG4gICAgICAgICAgICAgICAgaWYgKCEocmVuZGVyUGFzcy5jb2xvck9wcy5zdG9yZSB8fCByZW5kZXJQYXNzLmNvbG9yT3BzLnJlc29sdmUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5wdXNoKGdsLkNPTE9SX0FUVEFDSE1FTlQwKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFyZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5zdG9yZURlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5wdXNoKGdsLkRFUFRIX0FUVEFDSE1FTlQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICBpbnZhbGlkYXRlQXR0YWNobWVudHMucHVzaChnbC5TVEVOQ0lMX0FUVEFDSE1FTlQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChpbnZhbGlkYXRlQXR0YWNobWVudHMubGVuZ3RoID4gMCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGludmFsaWRhdGUgdGhlIHdob2xlIGJ1ZmZlclxuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiB3ZSBjb3VsZCBoYW5kbGUgdmlld3BvcnQgaW52YWxpZGF0aW9uIGFzIHdlbGxcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbmRlclBhc3MuZnVsbFNpemVDbGVhclJlY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLmludmFsaWRhdGVGcmFtZWJ1ZmZlcihnbC5EUkFXX0ZSQU1FQlVGRkVSLCBpbnZhbGlkYXRlQXR0YWNobWVudHMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZXNvbHZlIHRoZSBjb2xvciBidWZmZXJcbiAgICAgICAgICAgIGlmIChyZW5kZXJQYXNzLmNvbG9yT3BzLnJlc29sdmUpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgcmVuZGVyUGFzcy5zYW1wbGVzID4gMSAmJiB0YXJnZXQuYXV0b1Jlc29sdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LnJlc29sdmUodHJ1ZSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZ2VuZXJhdGUgbWlwbWFwc1xuICAgICAgICAgICAgaWYgKHJlbmRlclBhc3MuY29sb3JPcHMubWlwbWFwcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGFyZ2V0Ll9jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICBpZiAoY29sb3JCdWZmZXIgJiYgY29sb3JCdWZmZXIuaW1wbC5fZ2xUZXh0dXJlICYmIGNvbG9yQnVmZmVyLm1pcG1hcHMgJiYgKGNvbG9yQnVmZmVyLnBvdCB8fCB0aGlzLndlYmdsMikpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hY3RpdmVUZXh0dXJlKHRoaXMubWF4Q29tYmluZWRUZXh0dXJlcyAtIDEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmJpbmRUZXh0dXJlKGNvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5nbC5nZW5lcmF0ZU1pcG1hcChjb2xvckJ1ZmZlci5pbXBsLl9nbFRhcmdldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5pbnNpZGVSZW5kZXJQYXNzID0gZmFsc2U7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFya3MgdGhlIGJlZ2lubmluZyBvZiBhIGJsb2NrIG9mIHJlbmRlcmluZy4gSW50ZXJuYWxseSwgdGhpcyBmdW5jdGlvbiBiaW5kcyB0aGUgcmVuZGVyXG4gICAgICogdGFyZ2V0IGN1cnJlbnRseSBzZXQgb24gdGhlIGRldmljZS4gVGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgbWF0Y2hlZCB3aXRoIGEgY2FsbCB0b1xuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVFbmR9LiBDYWxscyB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59IGFuZFxuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVFbmR9IG11c3Qgbm90IGJlIG5lc3RlZC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVCZWdpbigpIHtcbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsICdVUERBVEUtQkVHSU4nKTtcblxuICAgICAgICB0aGlzLmJvdW5kVmFvID0gbnVsbDtcblxuICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIHVuaXRzIG9uY2UgYSBmcmFtZSBvbiBkZXNrdG9wIHNhZmFyaVxuICAgICAgICBpZiAodGhpcy5fdGVtcEVuYWJsZVNhZmFyaVRleHR1cmVVbml0V29ya2Fyb3VuZCkge1xuICAgICAgICAgICAgZm9yIChsZXQgdW5pdCA9IDA7IHVuaXQgPCB0aGlzLnRleHR1cmVVbml0cy5sZW5ndGg7ICsrdW5pdCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IHNsb3QgPSAwOyBzbG90IDwgMzsgKytzbG90KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZVVuaXRzW3VuaXRdW3Nsb3RdID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZXQgdGhlIHJlbmRlciB0YXJnZXRcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGlmICh0YXJnZXQpIHtcbiAgICAgICAgICAgIC8vIENyZWF0ZSBhIG5ldyBXZWJHTCBmcmFtZSBidWZmZXIgb2JqZWN0XG4gICAgICAgICAgICBpZiAoIXRhcmdldC5pbXBsLmluaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbml0UmVuZGVyVGFyZ2V0KHRhcmdldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0RnJhbWVidWZmZXIodGFyZ2V0LmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zZXRGcmFtZWJ1ZmZlcih0aGlzLmRlZmF1bHRGcmFtZWJ1ZmZlcik7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrcyB0aGUgZW5kIG9mIGEgYmxvY2sgb2YgcmVuZGVyaW5nLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjYWxsZWQgYWZ0ZXIgYSBtYXRjaGluZyBjYWxsXG4gICAgICogdG8ge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUJlZ2lufS4gQ2FsbHMgdG8ge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUJlZ2lufSBhbmRcbiAgICAgKiB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlRW5kfSBtdXN0IG5vdCBiZSBuZXN0ZWQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlRW5kKCkge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgVVBEQVRFLUVORGApO1xuXG4gICAgICAgIHRoaXMudW5iaW5kVmVydGV4QXJyYXkoKTtcblxuICAgICAgICAvLyBVbnNldCB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICAgICAgLy8gUmVzb2x2ZSBNU0FBIGlmIG5lZWRlZFxuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyICYmIHRhcmdldC5fc2FtcGxlcyA+IDEgJiYgdGFyZ2V0LmF1dG9SZXNvbHZlKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0LnJlc29sdmUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gSWYgdGhlIGFjdGl2ZSByZW5kZXIgdGFyZ2V0IGlzIGF1dG8tbWlwbWFwcGVkLCBnZW5lcmF0ZSBpdHMgbWlwIGNoYWluXG4gICAgICAgICAgICBjb25zdCBjb2xvckJ1ZmZlciA9IHRhcmdldC5fY29sb3JCdWZmZXI7XG4gICAgICAgICAgICBpZiAoY29sb3JCdWZmZXIgJiYgY29sb3JCdWZmZXIuaW1wbC5fZ2xUZXh0dXJlICYmIGNvbG9yQnVmZmVyLm1pcG1hcHMgJiYgKGNvbG9yQnVmZmVyLnBvdCB8fCB0aGlzLndlYmdsMikpIHtcbiAgICAgICAgICAgICAgICAvLyBGSVhNRTogaWYgY29sb3JCdWZmZXIgaXMgYSBjdWJlbWFwIGN1cnJlbnRseSB3ZSdyZSByZS1nZW5lcmF0aW5nIG1pcG1hcHMgYWZ0ZXJcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGluZyBlYWNoIGZhY2UhXG4gICAgICAgICAgICAgICAgdGhpcy5hY3RpdmVUZXh0dXJlKHRoaXMubWF4Q29tYmluZWRUZXh0dXJlcyAtIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuYmluZFRleHR1cmUoY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZ2VuZXJhdGVNaXBtYXAoY29sb3JCdWZmZXIuaW1wbC5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyBhIHRleHR1cmUncyB2ZXJ0aWNhbCBmbGlwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBmbGlwWSAtIFRydWUgdG8gZmxpcCB0aGUgdGV4dHVyZSB2ZXJ0aWNhbGx5LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRVbnBhY2tGbGlwWShmbGlwWSkge1xuICAgICAgICBpZiAodGhpcy51bnBhY2tGbGlwWSAhPT0gZmxpcFkpIHtcbiAgICAgICAgICAgIHRoaXMudW5wYWNrRmxpcFkgPSBmbGlwWTtcblxuICAgICAgICAgICAgLy8gTm90ZTogdGhlIFdlYkdMIHNwZWMgc3RhdGVzIHRoYXQgVU5QQUNLX0ZMSVBfWV9XRUJHTCBvbmx5IGFmZmVjdHNcbiAgICAgICAgICAgIC8vIHRleEltYWdlMkQgYW5kIHRleFN1YkltYWdlMkQsIG5vdCBjb21wcmVzc2VkVGV4SW1hZ2UyRFxuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0ZMSVBfWV9XRUJHTCwgZmxpcFkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyBhIHRleHR1cmUgdG8gaGF2ZSBpdHMgUkdCIGNoYW5uZWxzIHByZW11bHRpcGxpZWQgYnkgaXRzIGFscGhhIGNoYW5uZWwgb3Igbm90LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBwcmVtdWx0aXBseUFscGhhIC0gVHJ1ZSB0byBwcmVtdWx0aXBseSB0aGUgYWxwaGEgY2hhbm5lbCBhZ2FpbnN0IHRoZSBSR0JcbiAgICAgKiBjaGFubmVscy5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYShwcmVtdWx0aXBseUFscGhhKSB7XG4gICAgICAgIGlmICh0aGlzLnVucGFja1ByZW11bHRpcGx5QWxwaGEgIT09IHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgICAgIHRoaXMudW5wYWNrUHJlbXVsdGlwbHlBbHBoYSA9IHByZW11bHRpcGx5QWxwaGE7XG5cbiAgICAgICAgICAgIC8vIE5vdGU6IHRoZSBXZWJHTCBzcGVjIHN0YXRlcyB0aGF0IFVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCBvbmx5IGFmZmVjdHNcbiAgICAgICAgICAgIC8vIHRleEltYWdlMkQgYW5kIHRleFN1YkltYWdlMkQsIG5vdCBjb21wcmVzc2VkVGV4SW1hZ2UyRFxuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLCBwcmVtdWx0aXBseUFscGhhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFjdGl2YXRlIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHRleHR1cmVVbml0IC0gVGhlIHRleHR1cmUgdW5pdCB0byBhY3RpdmF0ZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYWN0aXZlVGV4dHVyZSh0ZXh0dXJlVW5pdCkge1xuICAgICAgICBpZiAodGhpcy50ZXh0dXJlVW5pdCAhPT0gdGV4dHVyZVVuaXQpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYWN0aXZlVGV4dHVyZSh0aGlzLmdsLlRFWFRVUkUwICsgdGV4dHVyZVVuaXQpO1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlVW5pdCA9IHRleHR1cmVVbml0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIHRleHR1cmUgaXMgbm90IGFscmVhZHkgYm91bmQgb24gdGhlIGN1cnJlbnRseSBhY3RpdmUgdGV4dHVyZSB1bml0LCBiaW5kIGl0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gYmluZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYmluZFRleHR1cmUodGV4dHVyZSkge1xuICAgICAgICBjb25zdCBpbXBsID0gdGV4dHVyZS5pbXBsO1xuICAgICAgICBjb25zdCB0ZXh0dXJlVGFyZ2V0ID0gaW1wbC5fZ2xUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHRleHR1cmVPYmplY3QgPSBpbXBsLl9nbFRleHR1cmU7XG4gICAgICAgIGNvbnN0IHRleHR1cmVVbml0ID0gdGhpcy50ZXh0dXJlVW5pdDtcbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMudGFyZ2V0VG9TbG90W3RleHR1cmVUYXJnZXRdO1xuICAgICAgICBpZiAodGhpcy50ZXh0dXJlVW5pdHNbdGV4dHVyZVVuaXRdW3Nsb3RdICE9PSB0ZXh0dXJlT2JqZWN0KSB7XG4gICAgICAgICAgICB0aGlzLmdsLmJpbmRUZXh0dXJlKHRleHR1cmVUYXJnZXQsIHRleHR1cmVPYmplY3QpO1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlVW5pdHNbdGV4dHVyZVVuaXRdW3Nsb3RdID0gdGV4dHVyZU9iamVjdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRoZSB0ZXh0dXJlIGlzIG5vdCBib3VuZCBvbiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdCwgYWN0aXZlIHRoZSB0ZXh0dXJlIHVuaXQgYW5kIGJpbmRcbiAgICAgKiB0aGUgdGV4dHVyZSB0byBpdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIGJpbmQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHRleHR1cmVVbml0IC0gVGhlIHRleHR1cmUgdW5pdCB0byBhY3RpdmF0ZSBhbmQgYmluZCB0aGUgdGV4dHVyZSB0by5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYmluZFRleHR1cmVPblVuaXQodGV4dHVyZSwgdGV4dHVyZVVuaXQpIHtcbiAgICAgICAgY29uc3QgaW1wbCA9IHRleHR1cmUuaW1wbDtcbiAgICAgICAgY29uc3QgdGV4dHVyZVRhcmdldCA9IGltcGwuX2dsVGFyZ2V0O1xuICAgICAgICBjb25zdCB0ZXh0dXJlT2JqZWN0ID0gaW1wbC5fZ2xUZXh0dXJlO1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy50YXJnZXRUb1Nsb3RbdGV4dHVyZVRhcmdldF07XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gIT09IHRleHR1cmVPYmplY3QpIHtcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlVGV4dHVyZSh0ZXh0dXJlVW5pdCk7XG4gICAgICAgICAgICB0aGlzLmdsLmJpbmRUZXh0dXJlKHRleHR1cmVUYXJnZXQsIHRleHR1cmVPYmplY3QpO1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlVW5pdHNbdGV4dHVyZVVuaXRdW3Nsb3RdID0gdGV4dHVyZU9iamVjdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSB0aGUgdGV4dHVyZSBwYXJhbWV0ZXJzIGZvciBhIGdpdmVuIHRleHR1cmUgaWYgdGhleSBoYXZlIGNoYW5nZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byB1cGRhdGUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFRleHR1cmVQYXJhbWV0ZXJzKHRleHR1cmUpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBjb25zdCBmbGFncyA9IHRleHR1cmUuX3BhcmFtZXRlckZsYWdzO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSB0ZXh0dXJlLmltcGwuX2dsVGFyZ2V0O1xuXG4gICAgICAgIGlmIChmbGFncyAmIDEpIHtcbiAgICAgICAgICAgIGxldCBmaWx0ZXIgPSB0ZXh0dXJlLl9taW5GaWx0ZXI7XG4gICAgICAgICAgICBpZiAoKCF0ZXh0dXJlLnBvdCAmJiAhdGhpcy53ZWJnbDIpIHx8ICF0ZXh0dXJlLl9taXBtYXBzIHx8ICh0ZXh0dXJlLl9jb21wcmVzc2VkICYmIHRleHR1cmUuX2xldmVscy5sZW5ndGggPT09IDEpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZpbHRlciA9PT0gRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QgfHwgZmlsdGVyID09PSBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlciA9IEZJTFRFUl9ORUFSRVNUO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlsdGVyID09PSBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIHx8IGZpbHRlciA9PT0gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgdGhpcy5nbEZpbHRlcltmaWx0ZXJdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAyKSB7XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCB0aGlzLmdsRmlsdGVyW3RleHR1cmUuX21hZ0ZpbHRlcl0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUywgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5fYWRkcmVzc1VdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gV2ViR0wxIGRvZXNuJ3Qgc3VwcG9ydCBhbGwgYWRkcmVzc2luZyBtb2RlcyB3aXRoIE5QT1QgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1MsIHRoaXMuZ2xBZGRyZXNzW3RleHR1cmUucG90ID8gdGV4dHVyZS5fYWRkcmVzc1UgOiBBRERSRVNTX0NMQU1QX1RPX0VER0VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiA4KSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1QsIHRoaXMuZ2xBZGRyZXNzW3RleHR1cmUuX2FkZHJlc3NWXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFdlYkdMMSBkb2Vzbid0IHN1cHBvcnQgYWxsIGFkZHJlc3NpbmcgbW9kZXMgd2l0aCBOUE9UIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9ULCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLnBvdCA/IHRleHR1cmUuX2FkZHJlc3NWIDogQUREUkVTU19DTEFNUF9UT19FREdFXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgMTYpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUiwgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5fYWRkcmVzc1ddKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAzMikge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfQ09NUEFSRV9NT0RFLCB0ZXh0dXJlLl9jb21wYXJlT25SZWFkID8gZ2wuQ09NUEFSRV9SRUZfVE9fVEVYVFVSRSA6IGdsLk5PTkUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDY0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9DT01QQVJFX0ZVTkMsIHRoaXMuZ2xDb21wYXJpc29uW3RleHR1cmUuX2NvbXBhcmVGdW5jXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgMTI4KSB7XG4gICAgICAgICAgICBjb25zdCBleHQgPSB0aGlzLmV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYztcbiAgICAgICAgICAgIGlmIChleHQpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJmKHRhcmdldCwgZXh0LlRFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhULCBNYXRoLm1heCgxLCBNYXRoLm1pbihNYXRoLnJvdW5kKHRleHR1cmUuX2FuaXNvdHJvcHkpLCB0aGlzLm1heEFuaXNvdHJvcHkpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSBvbiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIHNldCB0aGUgdGV4dHVyZSBvbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCkge1xuXG4gICAgICAgIGlmICghdGV4dHVyZS5pbXBsLl9nbFRleHR1cmUpXG4gICAgICAgICAgICB0ZXh0dXJlLmltcGwuaW5pdGlhbGl6ZSh0aGlzLCB0ZXh0dXJlKTtcblxuICAgICAgICBpZiAodGV4dHVyZS5fcGFyYW1ldGVyRmxhZ3MgPiAwIHx8IHRleHR1cmUuX25lZWRzVXBsb2FkIHx8IHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCkge1xuXG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQgaXMgYWN0aXZlXG4gICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGV4dHVyZVVuaXQpO1xuXG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIHRleHR1cmUgaXMgYm91bmQgb24gY29ycmVjdCB0YXJnZXQgb2YgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXRcbiAgICAgICAgICAgIHRoaXMuYmluZFRleHR1cmUodGV4dHVyZSk7XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZVBhcmFtZXRlcnModGV4dHVyZSk7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5fcGFyYW1ldGVyRmxhZ3MgPSAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGV4dHVyZS5fbmVlZHNVcGxvYWQgfHwgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkKSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5pbXBsLnVwbG9hZCh0aGlzLCB0ZXh0dXJlKTtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9uZWVkc1VwbG9hZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gRW5zdXJlIHRoZSB0ZXh0dXJlIGlzIGN1cnJlbnRseSBib3VuZCB0byB0aGUgY29ycmVjdCB0YXJnZXQgb24gdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQuXG4gICAgICAgICAgICAvLyBJZiB0aGUgdGV4dHVyZSBpcyBhbHJlYWR5IGJvdW5kIHRvIHRoZSBjb3JyZWN0IHRhcmdldCBvbiB0aGUgc3BlY2lmaWVkIHVuaXQsIHRoZXJlJ3Mgbm8gbmVlZFxuICAgICAgICAgICAgLy8gdG8gYWN0dWFsbHkgbWFrZSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdCBhY3RpdmUgYmVjYXVzZSB0aGUgdGV4dHVyZSBpdHNlbGYgZG9lcyBub3QgbmVlZFxuICAgICAgICAgICAgLy8gdG8gYmUgdXBkYXRlZC5cbiAgICAgICAgICAgIHRoaXMuYmluZFRleHR1cmVPblVuaXQodGV4dHVyZSwgdGV4dHVyZVVuaXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZnVuY3Rpb24gY3JlYXRlcyBWZXJ0ZXhBcnJheU9iamVjdCBmcm9tIGxpc3Qgb2YgdmVydGV4IGJ1ZmZlcnNcbiAgICBjcmVhdGVWZXJ0ZXhBcnJheSh2ZXJ0ZXhCdWZmZXJzKSB7XG5cbiAgICAgICAgbGV0IGtleSwgdmFvO1xuXG4gICAgICAgIC8vIG9ubHkgdXNlIGNhY2hlIHdoZW4gbW9yZSB0aGFuIDEgdmVydGV4IGJ1ZmZlciwgb3RoZXJ3aXNlIGl0J3MgdW5pcXVlXG4gICAgICAgIGNvbnN0IHVzZUNhY2hlID0gdmVydGV4QnVmZmVycy5sZW5ndGggPiAxO1xuICAgICAgICBpZiAodXNlQ2FjaGUpIHtcblxuICAgICAgICAgICAgLy8gZ2VuZXJhdGUgdW5pcXVlIGtleSBmb3IgdGhlIHZlcnRleCBidWZmZXJzXG4gICAgICAgICAgICBrZXkgPSBcIlwiO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyc1tpXTtcbiAgICAgICAgICAgICAgICBrZXkgKz0gdmVydGV4QnVmZmVyLmlkICsgdmVydGV4QnVmZmVyLmZvcm1hdC5yZW5kZXJpbmdpbmdIYXNoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0cnkgdG8gZ2V0IFZBTyBmcm9tIGNhY2hlXG4gICAgICAgICAgICB2YW8gPSB0aGlzLl92YW9NYXAuZ2V0KGtleSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBuZWVkIHRvIGNyZWF0ZSBuZXcgdmFvXG4gICAgICAgIGlmICghdmFvKSB7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBWQSBvYmplY3RcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIHZhbyA9IGdsLmNyZWF0ZVZlcnRleEFycmF5KCk7XG4gICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkodmFvKTtcblxuICAgICAgICAgICAgLy8gZG9uJ3QgY2FwdHVyZSBpbmRleCBidWZmZXIgaW4gVkFPXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBudWxsKTtcblxuICAgICAgICAgICAgbGV0IGxvY1plcm8gPSBmYWxzZTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4QnVmZmVycy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gYmluZCBidWZmZXJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXJzW2ldO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2ZXJ0ZXhCdWZmZXIuaW1wbC5idWZmZXJJZCk7XG5cbiAgICAgICAgICAgICAgICAvLyBmb3IgZWFjaCBhdHRyaWJ1dGVcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBlbGVtZW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlID0gZWxlbWVudHNbal07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYyA9IHNlbWFudGljVG9Mb2NhdGlvbltlLm5hbWVdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2MgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY1plcm8gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihsb2MsIGUubnVtQ29tcG9uZW50cywgdGhpcy5nbFR5cGVbZS5kYXRhVHlwZV0sIGUubm9ybWFsaXplLCBlLnN0cmlkZSwgZS5vZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2MpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIuaW5zdGFuY2luZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wudmVydGV4QXR0cmliRGl2aXNvcihsb2MsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbmQgb2YgVkEgb2JqZWN0XG4gICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkobnVsbCk7XG5cbiAgICAgICAgICAgIC8vIHVuYmluZCBhbnkgYXJyYXkgYnVmZmVyXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgbnVsbCk7XG5cbiAgICAgICAgICAgIC8vIGFkZCBpdCB0byBjYWNoZVxuICAgICAgICAgICAgaWYgKHVzZUNhY2hlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdmFvTWFwLnNldChrZXksIHZhbyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghbG9jWmVybykge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJObyB2ZXJ0ZXggYXR0cmlidXRlIGlzIG1hcHBlZCB0byBsb2NhdGlvbiAwLCB3aGljaCBtaWdodCBjYXVzZSBjb21wYXRpYmlsaXR5IGlzc3VlcyBvbiBTYWZhcmkgb24gTWFjT1MgLSBwbGVhc2UgdXNlIGF0dHJpYnV0ZSBTRU1BTlRJQ19QT1NJVElPTiBvciBTRU1BTlRJQ19BVFRSMTVcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFvO1xuICAgIH1cblxuICAgIHVuYmluZFZlcnRleEFycmF5KCkge1xuICAgICAgICAvLyB1bmJpbmQgVkFPIGZyb20gZGV2aWNlIHRvIHByb3RlY3QgaXQgZnJvbSBiZWluZyBjaGFuZ2VkXG4gICAgICAgIGlmICh0aGlzLmJvdW5kVmFvKSB7XG4gICAgICAgICAgICB0aGlzLmJvdW5kVmFvID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFZlcnRleEFycmF5KG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0QnVmZmVycygpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBsZXQgdmFvO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBWQU8gZm9yIHNwZWNpZmllZCB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICBpZiAodGhpcy52ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA9PT0gMSkge1xuXG4gICAgICAgICAgICAvLyBzaW5nbGUgVkIga2VlcHMgaXRzIFZBT1xuICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gdGhpcy52ZXJ0ZXhCdWZmZXJzWzBdO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZlcnRleEJ1ZmZlci5kZXZpY2UgPT09IHRoaXMsIFwiVGhlIFZlcnRleEJ1ZmZlciB3YXMgbm90IGNyZWF0ZWQgdXNpbmcgY3VycmVudCBHcmFwaGljc0RldmljZVwiKTtcbiAgICAgICAgICAgIGlmICghdmVydGV4QnVmZmVyLmltcGwudmFvKSB7XG4gICAgICAgICAgICAgICAgdmVydGV4QnVmZmVyLmltcGwudmFvID0gdGhpcy5jcmVhdGVWZXJ0ZXhBcnJheSh0aGlzLnZlcnRleEJ1ZmZlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFvID0gdmVydGV4QnVmZmVyLmltcGwudmFvO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gb2J0YWluIHRlbXBvcmFyeSBWQU8gZm9yIG11bHRpcGxlIHZlcnRleCBidWZmZXJzXG4gICAgICAgICAgICB2YW8gPSB0aGlzLmNyZWF0ZVZlcnRleEFycmF5KHRoaXMudmVydGV4QnVmZmVycyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgYWN0aXZlIFZBT1xuICAgICAgICBpZiAodGhpcy5ib3VuZFZhbyAhPT0gdmFvKSB7XG4gICAgICAgICAgICB0aGlzLmJvdW5kVmFvID0gdmFvO1xuICAgICAgICAgICAgZ2wuYmluZFZlcnRleEFycmF5KHZhbyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbXB0eSBhcnJheSBvZiB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlcnMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBTZXQgdGhlIGFjdGl2ZSBpbmRleCBidWZmZXIgb2JqZWN0XG4gICAgICAgIC8vIE5vdGU6IHdlIGRvbid0IGNhY2hlIHRoaXMgc3RhdGUgYW5kIHNldCBpdCBvbmx5IHdoZW4gaXQgY2hhbmdlcywgYXMgVkFPIGNhcHR1cmVzIGxhc3QgYmluZCBidWZmZXIgaW4gaXRcbiAgICAgICAgLy8gYW5kIHNvIHdlIGRvbid0IGtub3cgd2hhdCBWQU8gc2V0cyBpdCB0by5cbiAgICAgICAgY29uc3QgYnVmZmVySWQgPSB0aGlzLmluZGV4QnVmZmVyID8gdGhpcy5pbmRleEJ1ZmZlci5pbXBsLmJ1ZmZlcklkIDogbnVsbDtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgYnVmZmVySWQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1Ym1pdHMgYSBncmFwaGljYWwgcHJpbWl0aXZlIHRvIHRoZSBoYXJkd2FyZSBmb3IgaW1tZWRpYXRlIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwcmltaXRpdmUgLSBQcmltaXRpdmUgb2JqZWN0IGRlc2NyaWJpbmcgaG93IHRvIHN1Ym1pdCBjdXJyZW50IHZlcnRleC9pbmRleFxuICAgICAqIGJ1ZmZlcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS50eXBlIC0gVGhlIHR5cGUgb2YgcHJpbWl0aXZlIHRvIHJlbmRlci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1BPSU5UU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORVN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVMT09QfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUFOR0xFU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUZBTn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwcmltaXRpdmUuYmFzZSAtIFRoZSBvZmZzZXQgb2YgdGhlIGZpcnN0IGluZGV4IG9yIHZlcnRleCB0byBkaXNwYXRjaCBpbiB0aGVcbiAgICAgKiBkcmF3IGNhbGwuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS5jb3VudCAtIFRoZSBudW1iZXIgb2YgaW5kaWNlcyBvciB2ZXJ0aWNlcyB0byBkaXNwYXRjaCBpbiB0aGUgZHJhd1xuICAgICAqIGNhbGwuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbcHJpbWl0aXZlLmluZGV4ZWRdIC0gVHJ1ZSB0byBpbnRlcnByZXQgdGhlIHByaW1pdGl2ZSBhcyBpbmRleGVkLCB0aGVyZWJ5XG4gICAgICogdXNpbmcgdGhlIGN1cnJlbnRseSBzZXQgaW5kZXggYnVmZmVyIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1JbnN0YW5jZXM9MV0gLSBUaGUgbnVtYmVyIG9mIGluc3RhbmNlcyB0byByZW5kZXIgd2hlbiB1c2luZ1xuICAgICAqIEFOR0xFX2luc3RhbmNlZF9hcnJheXMuIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBba2VlcEJ1ZmZlcnNdIC0gT3B0aW9uYWxseSBrZWVwIHRoZSBjdXJyZW50IHNldCBvZiB2ZXJ0ZXggLyBpbmRleCBidWZmZXJzIC9cbiAgICAgKiBWQU8uIFRoaXMgaXMgdXNlZCB3aGVuIHJlbmRlcmluZyBvZiBtdWx0aXBsZSB2aWV3cywgZm9yIGV4YW1wbGUgdW5kZXIgV2ViWFIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSBzaW5nbGUsIHVuaW5kZXhlZCB0cmlhbmdsZVxuICAgICAqIGRldmljZS5kcmF3KHtcbiAgICAgKiAgICAgdHlwZTogcGMuUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICAgKiAgICAgYmFzZTogMCxcbiAgICAgKiAgICAgY291bnQ6IDMsXG4gICAgICogICAgIGluZGV4ZWQ6IGZhbHNlXG4gICAgICogfSk7XG4gICAgICovXG4gICAgZHJhdyhwcmltaXRpdmUsIG51bUluc3RhbmNlcywga2VlcEJ1ZmZlcnMpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGxldCBzYW1wbGVyLCBzYW1wbGVyVmFsdWUsIHRleHR1cmUsIG51bVRleHR1cmVzOyAvLyBTYW1wbGVyc1xuICAgICAgICBsZXQgdW5pZm9ybSwgc2NvcGVJZCwgdW5pZm9ybVZlcnNpb24sIHByb2dyYW1WZXJzaW9uOyAvLyBVbmlmb3Jtc1xuICAgICAgICBjb25zdCBzaGFkZXIgPSB0aGlzLnNoYWRlcjtcbiAgICAgICAgaWYgKCFzaGFkZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IHNhbXBsZXJzID0gc2hhZGVyLmltcGwuc2FtcGxlcnM7XG4gICAgICAgIGNvbnN0IHVuaWZvcm1zID0gc2hhZGVyLmltcGwudW5pZm9ybXM7XG5cbiAgICAgICAgLy8gdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgaWYgKCFrZWVwQnVmZmVycykge1xuICAgICAgICAgICAgdGhpcy5zZXRCdWZmZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21taXQgdGhlIHNoYWRlciBwcm9ncmFtIHZhcmlhYmxlc1xuICAgICAgICBsZXQgdGV4dHVyZVVuaXQgPSAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzYW1wbGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgc2FtcGxlciA9IHNhbXBsZXJzW2ldO1xuICAgICAgICAgICAgc2FtcGxlclZhbHVlID0gc2FtcGxlci5zY29wZUlkLnZhbHVlO1xuICAgICAgICAgICAgaWYgKCFzYW1wbGVyVmFsdWUpIHtcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBjb25zdCBzYW1wbGVyTmFtZSA9IHNhbXBsZXIuc2NvcGVJZC5uYW1lO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyTmFtZSA9PT0gJ3VTY2VuZURlcHRoTWFwJyB8fCBzYW1wbGVyTmFtZSA9PT0gJ3VEZXB0aE1hcCcpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgZGVwdGggdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZURlcHRoTWFwIHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXJOYW1lID09PSAndVNjZW5lQ29sb3JNYXAnIHx8IHNhbXBsZXJOYW1lID09PSAndGV4dHVyZV9ncmFiUGFzcycpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgZGVwdGggdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZUNvbG9yTWFwIHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBjb250aW51ZTsgLy8gQmVjYXVzZSB1bnNldCBjb25zdGFudHMgc2hvdWxkbid0IHJhaXNlIHJhbmRvbSBlcnJvcnNcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNhbXBsZXJWYWx1ZSBpbnN0YW5jZW9mIFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlID0gc2FtcGxlclZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNldCBicmVha3BvaW50IGhlcmUgdG8gZGVidWcgXCJTb3VyY2UgYW5kIGRlc3RpbmF0aW9uIHRleHR1cmVzIG9mIHRoZSBkcmF3IGFyZSB0aGUgc2FtZVwiIGVycm9yc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuX3NhbXBsZXMgPCAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgJiYgdGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgPT09IHRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIlRyeWluZyB0byBiaW5kIGN1cnJlbnQgY29sb3IgYnVmZmVyIGFzIGEgdGV4dHVyZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5yZW5kZXJUYXJnZXQuZGVwdGhCdWZmZXIgJiYgdGhpcy5yZW5kZXJUYXJnZXQuZGVwdGhCdWZmZXIgPT09IHRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIlRyeWluZyB0byBiaW5kIGN1cnJlbnQgZGVwdGggYnVmZmVyIGFzIGEgdGV4dHVyZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyLnNsb3QgIT09IHRleHR1cmVVbml0KSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xaShzYW1wbGVyLmxvY2F0aW9uSWQsIHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlci5zbG90ID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRleHR1cmVVbml0Kys7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBBcnJheVxuICAgICAgICAgICAgICAgIHNhbXBsZXIuYXJyYXkubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICBudW1UZXh0dXJlcyA9IHNhbXBsZXJWYWx1ZS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1UZXh0dXJlczsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmUgPSBzYW1wbGVyVmFsdWVbal07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlci5hcnJheVtqXSA9IHRleHR1cmVVbml0O1xuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlVW5pdCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMWl2KHNhbXBsZXIubG9jYXRpb25JZCwgc2FtcGxlci5hcnJheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21taXQgYW55IHVwZGF0ZWQgdW5pZm9ybXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHVuaWZvcm1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB1bmlmb3JtID0gdW5pZm9ybXNbaV07XG4gICAgICAgICAgICBzY29wZUlkID0gdW5pZm9ybS5zY29wZUlkO1xuICAgICAgICAgICAgdW5pZm9ybVZlcnNpb24gPSB1bmlmb3JtLnZlcnNpb247XG4gICAgICAgICAgICBwcm9ncmFtVmVyc2lvbiA9IHNjb3BlSWQudmVyc2lvbk9iamVjdC52ZXJzaW9uO1xuXG4gICAgICAgICAgICAvLyBDaGVjayB0aGUgdmFsdWUgaXMgdmFsaWRcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmVyc2lvbi5nbG9iYWxJZCAhPT0gcHJvZ3JhbVZlcnNpb24uZ2xvYmFsSWQgfHwgdW5pZm9ybVZlcnNpb24ucmV2aXNpb24gIT09IHByb2dyYW1WZXJzaW9uLnJldmlzaW9uKSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZlcnNpb24uZ2xvYmFsSWQgPSBwcm9ncmFtVmVyc2lvbi5nbG9iYWxJZDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmVyc2lvbi5yZXZpc2lvbiA9IHByb2dyYW1WZXJzaW9uLnJldmlzaW9uO1xuXG4gICAgICAgICAgICAgICAgLy8gQ2FsbCB0aGUgZnVuY3Rpb24gdG8gY29tbWl0IHRoZSB1bmlmb3JtIHZhbHVlXG4gICAgICAgICAgICAgICAgaWYgKHNjb3BlSWQudmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvblt1bmlmb3JtLmRhdGFUeXBlXSh1bmlmb3JtLCBzY29wZUlkLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlcikge1xuICAgICAgICAgICAgLy8gRW5hYmxlIFRGLCBzdGFydCB3cml0aW5nIHRvIG91dCBidWZmZXJcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXJCYXNlKGdsLlRSQU5TRk9STV9GRUVEQkFDS19CVUZGRVIsIDAsIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIuaW1wbC5idWZmZXJJZCk7XG4gICAgICAgICAgICBnbC5iZWdpblRyYW5zZm9ybUZlZWRiYWNrKGdsLlBPSU5UUyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtb2RlID0gdGhpcy5nbFByaW1pdGl2ZVtwcmltaXRpdmUudHlwZV07XG4gICAgICAgIGNvbnN0IGNvdW50ID0gcHJpbWl0aXZlLmNvdW50O1xuXG4gICAgICAgIGlmIChwcmltaXRpdmUuaW5kZXhlZCkge1xuICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSB0aGlzLmluZGV4QnVmZmVyO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGluZGV4QnVmZmVyLmRldmljZSA9PT0gdGhpcywgXCJUaGUgSW5kZXhCdWZmZXIgd2FzIG5vdCBjcmVhdGVkIHVzaW5nIGN1cnJlbnQgR3JhcGhpY3NEZXZpY2VcIik7XG5cbiAgICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IGluZGV4QnVmZmVyLmltcGwuZ2xGb3JtYXQ7XG4gICAgICAgICAgICBjb25zdCBvZmZzZXQgPSBwcmltaXRpdmUuYmFzZSAqIGluZGV4QnVmZmVyLmJ5dGVzUGVySW5kZXg7XG5cbiAgICAgICAgICAgIGlmIChudW1JbnN0YW5jZXMgPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0VsZW1lbnRzSW5zdGFuY2VkKG1vZGUsIGNvdW50LCBmb3JtYXQsIG9mZnNldCwgbnVtSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0VsZW1lbnRzKG1vZGUsIGNvdW50LCBmb3JtYXQsIG9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBmaXJzdCA9IHByaW1pdGl2ZS5iYXNlO1xuXG4gICAgICAgICAgICBpZiAobnVtSW5zdGFuY2VzID4gMCkge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQobW9kZSwgZmlyc3QsIGNvdW50LCBudW1JbnN0YW5jZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3QXJyYXlzKG1vZGUsIGZpcnN0LCBjb3VudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlcikge1xuICAgICAgICAgICAgLy8gZGlzYWJsZSBURlxuICAgICAgICAgICAgZ2wuZW5kVHJhbnNmb3JtRmVlZGJhY2soKTtcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXJCYXNlKGdsLlRSQU5TRk9STV9GRUVEQkFDS19CVUZGRVIsIDAsIG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZHJhd0NhbGxzUGVyRnJhbWUrKztcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3ByaW1zUGVyRnJhbWVbcHJpbWl0aXZlLnR5cGVdICs9IHByaW1pdGl2ZS5jb3VudCAqIChudW1JbnN0YW5jZXMgPiAxID8gbnVtSW5zdGFuY2VzIDogMSk7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFycyB0aGUgZnJhbWUgYnVmZmVyIG9mIHRoZSBjdXJyZW50bHkgc2V0IHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QgdGhhdCBjb250cm9scyB0aGUgYmVoYXZpb3Igb2YgdGhlIGNsZWFyXG4gICAgICogb3BlcmF0aW9uIGRlZmluZWQgYXMgZm9sbG93czpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBbb3B0aW9ucy5jb2xvcl0gLSBUaGUgY29sb3IgdG8gY2xlYXIgdGhlIGNvbG9yIGJ1ZmZlciB0byBpbiB0aGUgcmFuZ2UgMC4wXG4gICAgICogdG8gMS4wIGZvciBlYWNoIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZGVwdGg9MV0gLSBUaGUgZGVwdGggdmFsdWUgdG8gY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlciB0byBpbiB0aGVcbiAgICAgKiByYW5nZSAwLjAgdG8gMS4wLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mbGFnc10gLSBUaGUgYnVmZmVycyB0byBjbGVhciAodGhlIHR5cGVzIGJlaW5nIGNvbG9yLCBkZXB0aCBhbmRcbiAgICAgKiBzdGVuY2lsKS4gQ2FuIGJlIGFueSBiaXR3aXNlIGNvbWJpbmF0aW9uIG9mOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ0xFQVJGTEFHX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIENMRUFSRkxBR19ERVBUSH1cbiAgICAgKiAtIHtAbGluayBDTEVBUkZMQUdfU1RFTkNJTH1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdGVuY2lsPTBdIC0gVGhlIHN0ZW5jaWwgdmFsdWUgdG8gY2xlYXIgdGhlIHN0ZW5jaWwgYnVmZmVyIHRvLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ2xlYXIgY29sb3IgYnVmZmVyIHRvIGJsYWNrIGFuZCBkZXB0aCBidWZmZXIgdG8gMS4wXG4gICAgICogZGV2aWNlLmNsZWFyKCk7XG4gICAgICpcbiAgICAgKiAvLyBDbGVhciBqdXN0IHRoZSBjb2xvciBidWZmZXIgdG8gcmVkXG4gICAgICogZGV2aWNlLmNsZWFyKHtcbiAgICAgKiAgICAgY29sb3I6IFsxLCAwLCAwLCAxXSxcbiAgICAgKiAgICAgZmxhZ3M6IHBjLkNMRUFSRkxBR19DT0xPUlxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gQ2xlYXIgY29sb3IgYnVmZmVyIHRvIHllbGxvdyBhbmQgZGVwdGggdG8gMS4wXG4gICAgICogZGV2aWNlLmNsZWFyKHtcbiAgICAgKiAgICAgY29sb3I6IFsxLCAxLCAwLCAxXSxcbiAgICAgKiAgICAgZGVwdGg6IDEsXG4gICAgICogICAgIGZsYWdzOiBwYy5DTEVBUkZMQUdfQ09MT1IgfCBwYy5DTEVBUkZMQUdfREVQVEhcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBjbGVhcihvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0gdGhpcy5kZWZhdWx0Q2xlYXJPcHRpb25zO1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBkZWZhdWx0T3B0aW9ucztcblxuICAgICAgICBjb25zdCBmbGFncyA9IChvcHRpb25zLmZsYWdzID09PSB1bmRlZmluZWQpID8gZGVmYXVsdE9wdGlvbnMuZmxhZ3MgOiBvcHRpb25zLmZsYWdzO1xuICAgICAgICBpZiAoZmxhZ3MgIT09IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBjb2xvclxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX0NPTE9SKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3IgPSAob3B0aW9ucy5jb2xvciA9PT0gdW5kZWZpbmVkKSA/IGRlZmF1bHRPcHRpb25zLmNvbG9yIDogb3B0aW9ucy5jb2xvcjtcbiAgICAgICAgICAgICAgICB0aGlzLnNldENsZWFyQ29sb3IoY29sb3JbMF0sIGNvbG9yWzFdLCBjb2xvclsyXSwgY29sb3JbM10pO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q29sb3JXcml0ZSh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBkZXB0aFxuICAgICAgICAgICAgICAgIGNvbnN0IGRlcHRoID0gKG9wdGlvbnMuZGVwdGggPT09IHVuZGVmaW5lZCkgPyBkZWZhdWx0T3B0aW9ucy5kZXB0aCA6IG9wdGlvbnMuZGVwdGg7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRDbGVhckRlcHRoKGRlcHRoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldERlcHRoV3JpdGUodHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGFncyAmIENMRUFSRkxBR19TVEVOQ0lMKSB7XG4gICAgICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBzdGVuY2lsXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RlbmNpbCA9IChvcHRpb25zLnN0ZW5jaWwgPT09IHVuZGVmaW5lZCkgPyBkZWZhdWx0T3B0aW9ucy5zdGVuY2lsIDogb3B0aW9ucy5zdGVuY2lsO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q2xlYXJTdGVuY2lsKHN0ZW5jaWwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDbGVhciB0aGUgZnJhbWUgYnVmZmVyXG4gICAgICAgICAgICBnbC5jbGVhcih0aGlzLmdsQ2xlYXJGbGFnW2ZsYWdzXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWFkcyBhIGJsb2NrIG9mIHBpeGVscyBmcm9tIGEgc3BlY2lmaWVkIHJlY3RhbmdsZSBvZiB0aGUgY3VycmVudCBjb2xvciBmcmFtZWJ1ZmZlciBpbnRvIGFuXG4gICAgICogQXJyYXlCdWZmZXJWaWV3IG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHgtY29vcmRpbmF0ZSBvZiB0aGUgcmVjdGFuZ2xlJ3MgbG93ZXItbGVmdCBjb3JuZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeS1jb29yZGluYXRlIG9mIHRoZSByZWN0YW5nbGUncyBsb3dlci1sZWZ0IGNvcm5lci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlLCBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUsIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gcGl4ZWxzIC0gVGhlIEFycmF5QnVmZmVyVmlldyBvYmplY3QgdGhhdCBob2xkcyB0aGUgcmV0dXJuZWQgcGl4ZWxcbiAgICAgKiBkYXRhLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZWFkUGl4ZWxzKHgsIHksIHcsIGgsIHBpeGVscykge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGdsLnJlYWRQaXhlbHMoeCwgeSwgdywgaCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgcGl4ZWxzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGRlcHRoIHZhbHVlIHVzZWQgd2hlbiB0aGUgZGVwdGggYnVmZmVyIGlzIGNsZWFyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVwdGggLSBUaGUgZGVwdGggdmFsdWUgdG8gY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlciB0byBpbiB0aGUgcmFuZ2UgMC4wXG4gICAgICogdG8gMS4wLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRDbGVhckRlcHRoKGRlcHRoKSB7XG4gICAgICAgIGlmIChkZXB0aCAhPT0gdGhpcy5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmNsZWFyRGVwdGgoZGVwdGgpO1xuICAgICAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gZGVwdGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGNsZWFyIGNvbG9yIHVzZWQgd2hlbiB0aGUgZnJhbWUgYnVmZmVyIGlzIGNsZWFyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gciAtIFRoZSByZWQgY29tcG9uZW50IG9mIHRoZSBjb2xvciBpbiB0aGUgcmFuZ2UgMC4wIHRvIDEuMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZyAtIFRoZSBncmVlbiBjb21wb25lbnQgb2YgdGhlIGNvbG9yIGluIHRoZSByYW5nZSAwLjAgdG8gMS4wLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gVGhlIGJsdWUgY29tcG9uZW50IG9mIHRoZSBjb2xvciBpbiB0aGUgcmFuZ2UgMC4wIHRvIDEuMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYSAtIFRoZSBhbHBoYSBjb21wb25lbnQgb2YgdGhlIGNvbG9yIGluIHRoZSByYW5nZSAwLjAgdG8gMS4wLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRDbGVhckNvbG9yKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgY29uc3QgYyA9IHRoaXMuY2xlYXJDb2xvcjtcbiAgICAgICAgaWYgKChyICE9PSBjLnIpIHx8IChnICE9PSBjLmcpIHx8IChiICE9PSBjLmIpIHx8IChhICE9PSBjLmEpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmNsZWFyQ29sb3IociwgZywgYiwgYSk7XG4gICAgICAgICAgICB0aGlzLmNsZWFyQ29sb3Iuc2V0KHIsIGcsIGIsIGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzdGVuY2lsIGNsZWFyIHZhbHVlIHVzZWQgd2hlbiB0aGUgc3RlbmNpbCBidWZmZXIgaXMgY2xlYXJlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBzdGVuY2lsIHZhbHVlIHRvIGNsZWFyIHRoZSBzdGVuY2lsIGJ1ZmZlciB0by5cbiAgICAgKi9cbiAgICBzZXRDbGVhclN0ZW5jaWwodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLmNsZWFyU3RlbmNpbCkge1xuICAgICAgICAgICAgdGhpcy5nbC5jbGVhclN0ZW5jaWwodmFsdWUpO1xuICAgICAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWwgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgd2hldGhlciBkZXB0aCB0ZXN0aW5nIGlzIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBkZXB0aCB0ZXN0aW5nIGlzIGVuYWJsZWQgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBkZXB0aFRlc3QgPSBkZXZpY2UuZ2V0RGVwdGhUZXN0KCk7XG4gICAgICogY29uc29sZS5sb2coJ0RlcHRoIHRlc3RpbmcgaXMgJyArIGRlcHRoVGVzdCA/ICdlbmFibGVkJyA6ICdkaXNhYmxlZCcpO1xuICAgICAqL1xuICAgIGdldERlcHRoVGVzdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVwdGhUZXN0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgZGVwdGggdGVzdGluZyBvZiBmcmFnbWVudHMuIE9uY2UgdGhpcyBzdGF0ZSBpcyBzZXQsIGl0IHBlcnNpc3RzIHVudGlsIGl0XG4gICAgICogaXMgY2hhbmdlZC4gQnkgZGVmYXVsdCwgZGVwdGggdGVzdGluZyBpcyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBkZXB0aFRlc3QgLSBUcnVlIHRvIGVuYWJsZSBkZXB0aCB0ZXN0aW5nIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBkZXZpY2Uuc2V0RGVwdGhUZXN0KHRydWUpO1xuICAgICAqL1xuICAgIHNldERlcHRoVGVzdChkZXB0aFRlc3QpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVwdGhUZXN0ICE9PSBkZXB0aFRlc3QpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGlmIChkZXB0aFRlc3QpIHtcbiAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmRlcHRoVGVzdCA9IGRlcHRoVGVzdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgdGhlIGRlcHRoIHRlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZnVuYyAtIEEgZnVuY3Rpb24gdG8gY29tcGFyZSBhIG5ldyBkZXB0aCB2YWx1ZSB3aXRoIGFuIGV4aXN0aW5nIHotYnVmZmVyXG4gICAgICogdmFsdWUgYW5kIGRlY2lkZSBpZiB0byB3cml0ZSBhIHBpeGVsLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX05FVkVSfTogZG9uJ3QgZHJhd1xuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU306IGRyYXcgaWYgbmV3IGRlcHRoIDwgZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH06IGRyYXcgaWYgbmV3IGRlcHRoID09IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggPD0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfTogZHJhdyBpZiBuZXcgZGVwdGggPiBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggIT0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCA+PSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0FMV0FZU306IGFsd2F5cyBkcmF3XG4gICAgICovXG4gICAgc2V0RGVwdGhGdW5jKGZ1bmMpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVwdGhGdW5jID09PSBmdW5jKSByZXR1cm47XG4gICAgICAgIHRoaXMuZ2wuZGVwdGhGdW5jKHRoaXMuZ2xDb21wYXJpc29uW2Z1bmNdKTtcbiAgICAgICAgdGhpcy5kZXB0aEZ1bmMgPSBmdW5jO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgd2hldGhlciB3cml0ZXMgdG8gdGhlIGRlcHRoIGJ1ZmZlciBhcmUgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGRlcHRoIHdyaXRpbmcgaXMgZW5hYmxlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGRlcHRoV3JpdGUgPSBkZXZpY2UuZ2V0RGVwdGhXcml0ZSgpO1xuICAgICAqIGNvbnNvbGUubG9nKCdEZXB0aCB3cml0aW5nIGlzICcgKyBkZXB0aFdyaXRlID8gJ2VuYWJsZWQnIDogJ2Rpc2FibGVkJyk7XG4gICAgICovXG4gICAgZ2V0RGVwdGhXcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGVwdGhXcml0ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIHdyaXRlcyB0byB0aGUgZGVwdGggYnVmZmVyLiBPbmNlIHRoaXMgc3RhdGUgaXMgc2V0LCBpdCBwZXJzaXN0cyB1bnRpbCBpdFxuICAgICAqIGlzIGNoYW5nZWQuIEJ5IGRlZmF1bHQsIGRlcHRoIHdyaXRlcyBhcmUgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gd3JpdGVEZXB0aCAtIFRydWUgdG8gZW5hYmxlIGRlcHRoIHdyaXRpbmcgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGRldmljZS5zZXREZXB0aFdyaXRlKHRydWUpO1xuICAgICAqL1xuICAgIHNldERlcHRoV3JpdGUod3JpdGVEZXB0aCkge1xuICAgICAgICBpZiAodGhpcy5kZXB0aFdyaXRlICE9PSB3cml0ZURlcHRoKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmRlcHRoTWFzayh3cml0ZURlcHRoKTtcbiAgICAgICAgICAgIHRoaXMuZGVwdGhXcml0ZSA9IHdyaXRlRGVwdGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIHdyaXRlcyB0byB0aGUgY29sb3IgYnVmZmVyLiBPbmNlIHRoaXMgc3RhdGUgaXMgc2V0LCBpdCBwZXJzaXN0cyB1bnRpbCBpdFxuICAgICAqIGlzIGNoYW5nZWQuIEJ5IGRlZmF1bHQsIGNvbG9yIHdyaXRlcyBhcmUgZW5hYmxlZCBmb3IgYWxsIGNvbG9yIGNoYW5uZWxzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSB3cml0ZVJlZCAtIFRydWUgdG8gZW5hYmxlIHdyaXRpbmcgb2YgdGhlIHJlZCBjaGFubmVsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB3cml0ZUdyZWVuIC0gVHJ1ZSB0byBlbmFibGUgd3JpdGluZyBvZiB0aGUgZ3JlZW4gY2hhbm5lbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gd3JpdGVCbHVlIC0gVHJ1ZSB0byBlbmFibGUgd3JpdGluZyBvZiB0aGUgYmx1ZSBjaGFubmVsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB3cml0ZUFscGhhIC0gVHJ1ZSB0byBlbmFibGUgd3JpdGluZyBvZiB0aGUgYWxwaGEgY2hhbm5lbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gSnVzdCB3cml0ZSBhbHBoYSBpbnRvIHRoZSBmcmFtZSBidWZmZXJcbiAgICAgKiBkZXZpY2Uuc2V0Q29sb3JXcml0ZShmYWxzZSwgZmFsc2UsIGZhbHNlLCB0cnVlKTtcbiAgICAgKi9cbiAgICBzZXRDb2xvcldyaXRlKHdyaXRlUmVkLCB3cml0ZUdyZWVuLCB3cml0ZUJsdWUsIHdyaXRlQWxwaGEpIHtcbiAgICAgICAgaWYgKCh0aGlzLndyaXRlUmVkICE9PSB3cml0ZVJlZCkgfHxcbiAgICAgICAgICAgICh0aGlzLndyaXRlR3JlZW4gIT09IHdyaXRlR3JlZW4pIHx8XG4gICAgICAgICAgICAodGhpcy53cml0ZUJsdWUgIT09IHdyaXRlQmx1ZSkgfHxcbiAgICAgICAgICAgICh0aGlzLndyaXRlQWxwaGEgIT09IHdyaXRlQWxwaGEpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmNvbG9yTWFzayh3cml0ZVJlZCwgd3JpdGVHcmVlbiwgd3JpdGVCbHVlLCB3cml0ZUFscGhhKTtcbiAgICAgICAgICAgIHRoaXMud3JpdGVSZWQgPSB3cml0ZVJlZDtcbiAgICAgICAgICAgIHRoaXMud3JpdGVHcmVlbiA9IHdyaXRlR3JlZW47XG4gICAgICAgICAgICB0aGlzLndyaXRlQmx1ZSA9IHdyaXRlQmx1ZTtcbiAgICAgICAgICAgIHRoaXMud3JpdGVBbHBoYSA9IHdyaXRlQWxwaGE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIGFscGhhIHRvIGNvdmVyYWdlIChXZWJHTDIgb25seSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHN0YXRlIC0gVHJ1ZSB0byBlbmFibGUgYWxwaGEgdG8gY292ZXJhZ2UgYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEFscGhhVG9Db3ZlcmFnZShzdGF0ZSkge1xuICAgICAgICBpZiAoIXRoaXMud2ViZ2wyKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLmFscGhhVG9Db3ZlcmFnZSA9PT0gc3RhdGUpIHJldHVybjtcbiAgICAgICAgdGhpcy5hbHBoYVRvQ292ZXJhZ2UgPSBzdGF0ZTtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuU0FNUExFX0FMUEhBX1RPX0NPVkVSQUdFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBvdXRwdXQgdmVydGV4IGJ1ZmZlci4gSXQgd2lsbCBiZSB3cml0dGVuIHRvIGJ5IGEgc2hhZGVyIHdpdGggdHJhbnNmb3JtIGZlZWRiYWNrXG4gICAgICogdmFyeWluZ3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlcnRleEJ1ZmZlcn0gdGYgLSBUaGUgb3V0cHV0IHZlcnRleCBidWZmZXIuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyKHRmKSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyID09PSB0ZilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyID0gdGY7XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBpZiAodGYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZmVlZGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mZWVkYmFjayA9IGdsLmNyZWF0ZVRyYW5zZm9ybUZlZWRiYWNrKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdsLmJpbmRUcmFuc2Zvcm1GZWVkYmFjayhnbC5UUkFOU0ZPUk1fRkVFREJBQ0ssIHRoaXMuZmVlZGJhY2spO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5iaW5kVHJhbnNmb3JtRmVlZGJhY2soZ2wuVFJBTlNGT1JNX0ZFRURCQUNLLCBudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRvZ2dsZXMgdGhlIHJhc3Rlcml6YXRpb24gcmVuZGVyIHN0YXRlLiBVc2VmdWwgd2l0aCB0cmFuc2Zvcm0gZmVlZGJhY2ssIHdoZW4geW91IG9ubHkgbmVlZFxuICAgICAqIHRvIHByb2Nlc3MgdGhlIGRhdGEgd2l0aG91dCBkcmF3aW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvbiAtIFRydWUgdG8gZW5hYmxlIHJhc3Rlcml6YXRpb24gYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFJhc3Rlcihvbikge1xuICAgICAgICBpZiAodGhpcy5yYXN0ZXIgPT09IG9uKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5yYXN0ZXIgPSBvbjtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIGlmIChvbikge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlJBU1RFUklaRVJfRElTQ0FSRCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuUkFTVEVSSVpFUl9ESVNDQVJEKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRvZ2dsZXMgdGhlIHBvbHlnb24gb2Zmc2V0IHJlbmRlciBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb24gLSBUcnVlIHRvIGVuYWJsZSBwb2x5Z29uIG9mZnNldCBhbmQgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0RGVwdGhCaWFzKG9uKSB7XG4gICAgICAgIGlmICh0aGlzLmRlcHRoQmlhc0VuYWJsZWQgPT09IG9uKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5kZXB0aEJpYXNFbmFibGVkID0gb247XG5cbiAgICAgICAgaWYgKG9uKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5nbC5kaXNhYmxlKHRoaXMuZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTcGVjaWZpZXMgdGhlIHNjYWxlIGZhY3RvciBhbmQgdW5pdHMgdG8gY2FsY3VsYXRlIGRlcHRoIHZhbHVlcy4gVGhlIG9mZnNldCBpcyBhZGRlZCBiZWZvcmVcbiAgICAgKiB0aGUgZGVwdGggdGVzdCBpcyBwZXJmb3JtZWQgYW5kIGJlZm9yZSB0aGUgdmFsdWUgaXMgd3JpdHRlbiBpbnRvIHRoZSBkZXB0aCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY29uc3RCaWFzIC0gVGhlIG11bHRpcGxpZXIgYnkgd2hpY2ggYW4gaW1wbGVtZW50YXRpb24tc3BlY2lmaWMgdmFsdWUgaXNcbiAgICAgKiBtdWx0aXBsaWVkIHdpdGggdG8gY3JlYXRlIGEgY29uc3RhbnQgZGVwdGggb2Zmc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzbG9wZUJpYXMgLSBUaGUgc2NhbGUgZmFjdG9yIGZvciB0aGUgdmFyaWFibGUgZGVwdGggb2Zmc2V0IGZvciBlYWNoIHBvbHlnb24uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldERlcHRoQmlhc1ZhbHVlcyhjb25zdEJpYXMsIHNsb3BlQmlhcykge1xuICAgICAgICB0aGlzLmdsLnBvbHlnb25PZmZzZXQoc2xvcGVCaWFzLCBjb25zdEJpYXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgd2hldGhlciBibGVuZGluZyBpcyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgYmxlbmRpbmcgaXMgZW5hYmxlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGdldEJsZW5kaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ibGVuZGluZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIGJsZW5kaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBibGVuZGluZyAtIFRydWUgdG8gZW5hYmxlIGJsZW5kaW5nIGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqL1xuICAgIHNldEJsZW5kaW5nKGJsZW5kaW5nKSB7XG4gICAgICAgIGlmICh0aGlzLmJsZW5kaW5nICE9PSBibGVuZGluZykge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgaWYgKGJsZW5kaW5nKSB7XG4gICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLkJMRU5EKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmJsZW5kaW5nID0gYmxlbmRpbmc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIHN0ZW5jaWwgdGVzdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlIC0gVHJ1ZSB0byBlbmFibGUgc3RlbmNpbCB0ZXN0IGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxUZXN0KGVuYWJsZSkge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsICE9PSBlbmFibGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGlmIChlbmFibGUpIHtcbiAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuU1RFTkNJTF9URVNUKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zdGVuY2lsID0gZW5hYmxlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBzdGVuY2lsIHRlc3QgZm9yIGJvdGggZnJvbnQgYW5kIGJhY2sgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZnVuYyAtIEEgY29tcGFyaXNvbiBmdW5jdGlvbiB0aGF0IGRlY2lkZXMgaWYgdGhlIHBpeGVsIHNob3VsZCBiZSB3cml0dGVuLFxuICAgICAqIGJhc2VkIG9uIHRoZSBjdXJyZW50IHN0ZW5jaWwgYnVmZmVyIHZhbHVlLCByZWZlcmVuY2UgdmFsdWUsIGFuZCBtYXNrIHZhbHVlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX05FVkVSfTogbmV2ZXIgcGFzc1xuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU306IHBhc3MgaWYgKHJlZiAmIG1hc2spIDwgKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA9PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfTogcGFzcyBpZiAocmVmICYgbWFzaykgPiAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spICE9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID49IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0FMV0FZU306IGFsd2F5cyBwYXNzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmVmIC0gUmVmZXJlbmNlIHZhbHVlIHVzZWQgaW4gY29tcGFyaXNvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFzayAtIE1hc2sgYXBwbGllZCB0byBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSBhbmQgcmVmZXJlbmNlIHZhbHVlIGJlZm9yZVxuICAgICAqIGNvbXBhcmlzb24uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbEZ1bmMoZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgIT09IGZ1bmMgfHwgdGhpcy5zdGVuY2lsUmVmRnJvbnQgIT09IHJlZiB8fCB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgIT09IG1hc2sgfHxcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNCYWNrICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkJhY2sgIT09IHJlZiB8fCB0aGlzLnN0ZW5jaWxNYXNrQmFjayAhPT0gbWFzaykge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmModGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgPSB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHRoaXMuc3RlbmNpbFJlZkJhY2sgPSByZWY7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgPSB0aGlzLnN0ZW5jaWxNYXNrQmFjayA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHN0ZW5jaWwgdGVzdCBmb3IgZnJvbnQgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZnVuYyAtIEEgY29tcGFyaXNvbiBmdW5jdGlvbiB0aGF0IGRlY2lkZXMgaWYgdGhlIHBpeGVsIHNob3VsZCBiZSB3cml0dGVuLFxuICAgICAqIGJhc2VkIG9uIHRoZSBjdXJyZW50IHN0ZW5jaWwgYnVmZmVyIHZhbHVlLCByZWZlcmVuY2UgdmFsdWUsIGFuZCBtYXNrIHZhbHVlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX05FVkVSfTogbmV2ZXIgcGFzc1xuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU306IHBhc3MgaWYgKHJlZiAmIG1hc2spIDwgKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA9PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfTogcGFzcyBpZiAocmVmICYgbWFzaykgPiAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spICE9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID49IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0FMV0FZU306IGFsd2F5cyBwYXNzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmVmIC0gUmVmZXJlbmNlIHZhbHVlIHVzZWQgaW4gY29tcGFyaXNvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFzayAtIE1hc2sgYXBwbGllZCB0byBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSBhbmQgcmVmZXJlbmNlIHZhbHVlIGJlZm9yZSBjb21wYXJpc29uLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxGdW5jRnJvbnQoZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgIT09IGZ1bmMgfHwgdGhpcy5zdGVuY2lsUmVmRnJvbnQgIT09IHJlZiB8fCB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgIT09IG1hc2spIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jU2VwYXJhdGUoZ2wuRlJPTlQsIHRoaXMuZ2xDb21wYXJpc29uW2Z1bmNdLCByZWYsIG1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRnVuY0Zyb250ID0gZnVuYztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFJlZkZyb250ID0gcmVmO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsTWFza0Zyb250ID0gbWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgc3RlbmNpbCB0ZXN0IGZvciBiYWNrIGZhY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZ1bmMgLSBBIGNvbXBhcmlzb24gZnVuY3Rpb24gdGhhdCBkZWNpZGVzIGlmIHRoZSBwaXhlbCBzaG91bGQgYmUgd3JpdHRlbixcbiAgICAgKiBiYXNlZCBvbiB0aGUgY3VycmVudCBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSwgcmVmZXJlbmNlIHZhbHVlLCBhbmQgbWFzayB2YWx1ZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19ORVZFUn06IG5ldmVyIHBhc3NcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPD0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn06IHBhc3MgaWYgKHJlZiAmIG1hc2spID4gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSAhPSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19BTFdBWVN9OiBhbHdheXMgcGFzc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJlZiAtIFJlZmVyZW5jZSB2YWx1ZSB1c2VkIGluIGNvbXBhcmlzb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1hc2sgLSBNYXNrIGFwcGxpZWQgdG8gc3RlbmNpbCBidWZmZXIgdmFsdWUgYW5kIHJlZmVyZW5jZSB2YWx1ZSBiZWZvcmUgY29tcGFyaXNvbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsRnVuY0JhY2soZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGdW5jQmFjayAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZCYWNrICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0JhY2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jU2VwYXJhdGUoZ2wuQkFDSywgdGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZCYWNrID0gcmVmO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsTWFza0JhY2sgPSBtYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBob3cgc3RlbmNpbCBidWZmZXIgdmFsdWVzIHNob3VsZCBiZSBtb2RpZmllZCBiYXNlZCBvbiB0aGUgcmVzdWx0IG9mIGRlcHRoL3N0ZW5jaWxcbiAgICAgKiB0ZXN0cy4gV29ya3MgZm9yIGJvdGggZnJvbnQgYW5kIGJhY2sgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZmFpbCAtIEFjdGlvbiB0byB0YWtlIGlmIHN0ZW5jaWwgdGVzdCBpcyBmYWlsZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9LRUVQfTogZG9uJ3QgY2hhbmdlIHRoZSBzdGVuY2lsIGJ1ZmZlciB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9aRVJPfTogc2V0IHZhbHVlIHRvIHplcm9cbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfUkVQTEFDRX06IHJlcGxhY2UgdmFsdWUgd2l0aCB0aGUgcmVmZXJlbmNlIHZhbHVlIChzZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxGdW5jfSlcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5DUkVNRU5UfTogaW5jcmVtZW50IHRoZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlRXUkFQfTogaW5jcmVtZW50IHRoZSB2YWx1ZSwgYnV0IHdyYXAgaXQgdG8gemVybyB3aGVuIGl0J3MgbGFyZ2VyXG4gICAgICogdGhhbiBhIG1heGltdW0gcmVwcmVzZW50YWJsZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9ERUNSRU1FTlR9OiBkZWNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVFdSQVB9OiBkZWNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byBhIG1heGltdW1cbiAgICAgKiByZXByZXNlbnRhYmxlIHZhbHVlLCBpZiB0aGUgY3VycmVudCB2YWx1ZSBpcyAwXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOVkVSVH06IGludmVydCB0aGUgdmFsdWUgYml0d2lzZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgZGVwdGggdGVzdCBpcyBmYWlsZWQuICBBY2NlcHRzIHRoZSBzYW1lIHZhbHVlcyBhc1xuICAgICAqIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0genBhc3MgLSBBY3Rpb24gdG8gdGFrZSBpZiBib3RoIGRlcHRoIGFuZCBzdGVuY2lsIHRlc3QgYXJlIHBhc3NlZC4gQWNjZXB0c1xuICAgICAqIHRoZSBzYW1lIHZhbHVlcyBhcyBgZmFpbGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdyaXRlTWFzayAtIEEgYml0IG1hc2sgYXBwbGllZCB0byB0aGUgcmVmZXJlbmNlIHZhbHVlLCB3aGVuIHdyaXR0ZW4uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbE9wZXJhdGlvbihmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRmFpbEZyb250ICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgIT09IHpwYXNzIHx8XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wKHRoaXMuZ2xTdGVuY2lsT3BbZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbemZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pwYXNzXSk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IGZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ID0gdGhpcy5zdGVuY2lsWnBhc3NCYWNrID0genBhc3M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ICE9PSB3cml0ZU1hc2sgfHwgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrKHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IHdyaXRlTWFzaztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgPSB3cml0ZU1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGhvdyBzdGVuY2lsIGJ1ZmZlciB2YWx1ZXMgc2hvdWxkIGJlIG1vZGlmaWVkIGJhc2VkIG9uIHRoZSByZXN1bHQgb2YgZGVwdGgvc3RlbmNpbFxuICAgICAqIHRlc3RzLiBXb3JrcyBmb3IgZnJvbnQgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZmFpbCAtIEFjdGlvbiB0byB0YWtlIGlmIHN0ZW5jaWwgdGVzdCBpcyBmYWlsZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9LRUVQfTogZG9uJ3QgY2hhbmdlIHRoZSBzdGVuY2lsIGJ1ZmZlciB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9aRVJPfTogc2V0IHZhbHVlIHRvIHplcm9cbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfUkVQTEFDRX06IHJlcGxhY2UgdmFsdWUgd2l0aCB0aGUgcmVmZXJlbmNlIHZhbHVlIChzZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxGdW5jfSlcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5DUkVNRU5UfTogaW5jcmVtZW50IHRoZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlRXUkFQfTogaW5jcmVtZW50IHRoZSB2YWx1ZSwgYnV0IHdyYXAgaXQgdG8gemVybyB3aGVuIGl0J3MgbGFyZ2VyXG4gICAgICogdGhhbiBhIG1heGltdW0gcmVwcmVzZW50YWJsZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9ERUNSRU1FTlR9OiBkZWNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVFdSQVB9OiBkZWNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byBhIG1heGltdW1cbiAgICAgKiByZXByZXNlbnRhYmxlIHZhbHVlLCBpZiB0aGUgY3VycmVudCB2YWx1ZSBpcyAwXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOVkVSVH06IGludmVydCB0aGUgdmFsdWUgYml0d2lzZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgZGVwdGggdGVzdCBpcyBmYWlsZWQuICBBY2NlcHRzIHRoZSBzYW1lIHZhbHVlcyBhc1xuICAgICAqIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0genBhc3MgLSBBY3Rpb24gdG8gdGFrZSBpZiBib3RoIGRlcHRoIGFuZCBzdGVuY2lsIHRlc3QgYXJlIHBhc3NlZC4gIEFjY2VwdHNcbiAgICAgKiB0aGUgc2FtZSB2YWx1ZXMgYXMgYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3cml0ZU1hc2sgLSBBIGJpdCBtYXNrIGFwcGxpZWQgdG8gdGhlIHJlZmVyZW5jZSB2YWx1ZSwgd2hlbiB3cml0dGVuLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxPcGVyYXRpb25Gcm9udChmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRmFpbEZyb250ICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgIT09IHpwYXNzKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxPcFNlcGFyYXRlKHRoaXMuZ2wuRlJPTlQsIHRoaXMuZ2xTdGVuY2lsT3BbZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbemZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pwYXNzXSk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSBmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxGcm9udCA9IHpmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWnBhc3NGcm9udCA9IHpwYXNzO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrU2VwYXJhdGUodGhpcy5nbC5GUk9OVCwgd3JpdGVNYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ID0gd3JpdGVNYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBob3cgc3RlbmNpbCBidWZmZXIgdmFsdWVzIHNob3VsZCBiZSBtb2RpZmllZCBiYXNlZCBvbiB0aGUgcmVzdWx0IG9mIGRlcHRoL3N0ZW5jaWxcbiAgICAgKiB0ZXN0cy4gV29ya3MgZm9yIGJhY2sgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZmFpbCAtIEFjdGlvbiB0byB0YWtlIGlmIHN0ZW5jaWwgdGVzdCBpcyBmYWlsZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9LRUVQfTogZG9uJ3QgY2hhbmdlIHRoZSBzdGVuY2lsIGJ1ZmZlciB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9aRVJPfTogc2V0IHZhbHVlIHRvIHplcm9cbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfUkVQTEFDRX06IHJlcGxhY2UgdmFsdWUgd2l0aCB0aGUgcmVmZXJlbmNlIHZhbHVlIChzZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxGdW5jfSlcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5DUkVNRU5UfTogaW5jcmVtZW50IHRoZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlRXUkFQfTogaW5jcmVtZW50IHRoZSB2YWx1ZSwgYnV0IHdyYXAgaXQgdG8gemVybyB3aGVuIGl0J3MgbGFyZ2VyXG4gICAgICogdGhhbiBhIG1heGltdW0gcmVwcmVzZW50YWJsZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9ERUNSRU1FTlR9OiBkZWNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVFdSQVB9OiBkZWNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byBhIG1heGltdW1cbiAgICAgKiByZXByZXNlbnRhYmxlIHZhbHVlLCBpZiB0aGUgY3VycmVudCB2YWx1ZSBpcyAwXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOVkVSVH06IGludmVydCB0aGUgdmFsdWUgYml0d2lzZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgZGVwdGggdGVzdCBpcyBmYWlsZWQuIEFjY2VwdHMgdGhlIHNhbWUgdmFsdWVzIGFzXG4gICAgICogYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6cGFzcyAtIEFjdGlvbiB0byB0YWtlIGlmIGJvdGggZGVwdGggYW5kIHN0ZW5jaWwgdGVzdCBhcmUgcGFzc2VkLiBBY2NlcHRzXG4gICAgICogdGhlIHNhbWUgdmFsdWVzIGFzIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd3JpdGVNYXNrIC0gQSBiaXQgbWFzayBhcHBsaWVkIHRvIHRoZSByZWZlcmVuY2UgdmFsdWUsIHdoZW4gd3JpdHRlbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsT3BlcmF0aW9uQmFjayhmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRmFpbEJhY2sgIT09IGZhaWwgfHwgdGhpcy5zdGVuY2lsWmZhaWxCYWNrICE9PSB6ZmFpbCB8fCB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgIT09IHpwYXNzKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxPcFNlcGFyYXRlKHRoaXMuZ2wuQkFDSywgdGhpcy5nbFN0ZW5jaWxPcFtmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6ZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbenBhc3NdKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZhaWxCYWNrID0gZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpmYWlsQmFjayA9IHpmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWnBhc3NCYWNrID0genBhc3M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgIT09IHdyaXRlTWFzaykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsTWFza1NlcGFyYXRlKHRoaXMuZ2wuQkFDSywgd3JpdGVNYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgPSB3cml0ZU1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGJsZW5kaW5nIG9wZXJhdGlvbnMuIEJvdGggc291cmNlIGFuZCBkZXN0aW5hdGlvbiBibGVuZCBtb2RlcyBjYW4gdGFrZSB0aGVcbiAgICAgKiBmb2xsb3dpbmcgdmFsdWVzOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1pFUk99XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9EU1RfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9EU1RfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX0NPTlNUQU5UX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX0NPTlNUQU5UX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEF9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRTcmMgLSBUaGUgc291cmNlIGJsZW5kIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZERzdCAtIFRoZSBkZXN0aW5hdGlvbiBibGVuZCBmdW5jdGlvbi5cbiAgICAgKi9cbiAgICBzZXRCbGVuZEZ1bmN0aW9uKGJsZW5kU3JjLCBibGVuZERzdCkge1xuICAgICAgICBpZiAodGhpcy5ibGVuZFNyYyAhPT0gYmxlbmRTcmMgfHwgdGhpcy5ibGVuZERzdCAhPT0gYmxlbmREc3QgfHwgdGhpcy5zZXBhcmF0ZUFscGhhQmxlbmQpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmxlbmRGdW5jKHRoaXMuZ2xCbGVuZEZ1bmN0aW9uW2JsZW5kU3JjXSwgdGhpcy5nbEJsZW5kRnVuY3Rpb25bYmxlbmREc3RdKTtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRTcmMgPSBibGVuZFNyYztcbiAgICAgICAgICAgIHRoaXMuYmxlbmREc3QgPSBibGVuZERzdDtcbiAgICAgICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUJsZW5kID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGJsZW5kaW5nIG9wZXJhdGlvbnMuIEJvdGggc291cmNlIGFuZCBkZXN0aW5hdGlvbiBibGVuZCBtb2RlcyBjYW4gdGFrZSB0aGVcbiAgICAgKiBmb2xsb3dpbmcgdmFsdWVzOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1pFUk99XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9EU1RfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9EU1RfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEF9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRTcmMgLSBUaGUgc291cmNlIGJsZW5kIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZERzdCAtIFRoZSBkZXN0aW5hdGlvbiBibGVuZCBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRTcmNBbHBoYSAtIFRoZSBzZXBhcmF0ZSBzb3VyY2UgYmxlbmQgZnVuY3Rpb24gZm9yIHRoZSBhbHBoYSBjaGFubmVsLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZERzdEFscGhhIC0gVGhlIHNlcGFyYXRlIGRlc3RpbmF0aW9uIGJsZW5kIGZ1bmN0aW9uIGZvciB0aGUgYWxwaGEgY2hhbm5lbC5cbiAgICAgKi9cbiAgICBzZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUoYmxlbmRTcmMsIGJsZW5kRHN0LCBibGVuZFNyY0FscGhhLCBibGVuZERzdEFscGhhKSB7XG4gICAgICAgIGlmICh0aGlzLmJsZW5kU3JjICE9PSBibGVuZFNyYyB8fCB0aGlzLmJsZW5kRHN0ICE9PSBibGVuZERzdCB8fCB0aGlzLmJsZW5kU3JjQWxwaGEgIT09IGJsZW5kU3JjQWxwaGEgfHwgdGhpcy5ibGVuZERzdEFscGhhICE9PSBibGVuZERzdEFscGhhIHx8ICF0aGlzLnNlcGFyYXRlQWxwaGFCbGVuZCkge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZEZ1bmNTZXBhcmF0ZSh0aGlzLmdsQmxlbmRGdW5jdGlvbltibGVuZFNyY10sIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uW2JsZW5kRHN0XSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb25bYmxlbmRTcmNBbHBoYV0sIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uW2JsZW5kRHN0QWxwaGFdKTtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRTcmMgPSBibGVuZFNyYztcbiAgICAgICAgICAgIHRoaXMuYmxlbmREc3QgPSBibGVuZERzdDtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRTcmNBbHBoYSA9IGJsZW5kU3JjQWxwaGE7XG4gICAgICAgICAgICB0aGlzLmJsZW5kRHN0QWxwaGEgPSBibGVuZERzdEFscGhhO1xuICAgICAgICAgICAgdGhpcy5zZXBhcmF0ZUFscGhhQmxlbmQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyB0aGUgYmxlbmRpbmcgZXF1YXRpb24uIFRoZSBkZWZhdWx0IGJsZW5kIGVxdWF0aW9uIGlzIHtAbGluayBCTEVOREVRVUFUSU9OX0FERH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRFcXVhdGlvbiAtIFRoZSBibGVuZCBlcXVhdGlvbi4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9BRER9XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9TVUJUUkFDVH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX1JFVkVSU0VfU1VCVFJBQ1R9XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9NSU59XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9NQVh9XG4gICAgICpcbiAgICAgKiBOb3RlIHRoYXQgTUlOIGFuZCBNQVggbW9kZXMgcmVxdWlyZSBlaXRoZXIgRVhUX2JsZW5kX21pbm1heCBvciBXZWJHTDIgdG8gd29yayAoY2hlY2tcbiAgICAgKiBkZXZpY2UuZXh0QmxlbmRNaW5tYXgpLlxuICAgICAqL1xuICAgIHNldEJsZW5kRXF1YXRpb24oYmxlbmRFcXVhdGlvbikge1xuICAgICAgICBpZiAodGhpcy5ibGVuZEVxdWF0aW9uICE9PSBibGVuZEVxdWF0aW9uIHx8IHRoaXMuc2VwYXJhdGVBbHBoYUVxdWF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmJsZW5kRXF1YXRpb24odGhpcy5nbEJsZW5kRXF1YXRpb25bYmxlbmRFcXVhdGlvbl0pO1xuICAgICAgICAgICAgdGhpcy5ibGVuZEVxdWF0aW9uID0gYmxlbmRFcXVhdGlvbjtcbiAgICAgICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUVxdWF0aW9uID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHRoZSBibGVuZGluZyBlcXVhdGlvbi4gVGhlIGRlZmF1bHQgYmxlbmQgZXF1YXRpb24gaXMge0BsaW5rIEJMRU5ERVFVQVRJT05fQUREfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZEVxdWF0aW9uIC0gVGhlIGJsZW5kIGVxdWF0aW9uLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX0FERH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX1NVQlRSQUNUfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fUkVWRVJTRV9TVUJUUkFDVH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX01JTn1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX01BWH1cbiAgICAgKlxuICAgICAqIE5vdGUgdGhhdCBNSU4gYW5kIE1BWCBtb2RlcyByZXF1aXJlIGVpdGhlciBFWFRfYmxlbmRfbWlubWF4IG9yIFdlYkdMMiB0byB3b3JrIChjaGVja1xuICAgICAqIGRldmljZS5leHRCbGVuZE1pbm1heCkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kQWxwaGFFcXVhdGlvbiAtIEEgc2VwYXJhdGUgYmxlbmQgZXF1YXRpb24gZm9yIHRoZSBhbHBoYSBjaGFubmVsLlxuICAgICAqIEFjY2VwdHMgc2FtZSB2YWx1ZXMgYXMgYGJsZW5kRXF1YXRpb25gLlxuICAgICAqL1xuICAgIHNldEJsZW5kRXF1YXRpb25TZXBhcmF0ZShibGVuZEVxdWF0aW9uLCBibGVuZEFscGhhRXF1YXRpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuYmxlbmRFcXVhdGlvbiAhPT0gYmxlbmRFcXVhdGlvbiB8fCB0aGlzLmJsZW5kQWxwaGFFcXVhdGlvbiAhPT0gYmxlbmRBbHBoYUVxdWF0aW9uIHx8ICF0aGlzLnNlcGFyYXRlQWxwaGFFcXVhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZEVxdWF0aW9uU2VwYXJhdGUodGhpcy5nbEJsZW5kRXF1YXRpb25bYmxlbmRFcXVhdGlvbl0sIHRoaXMuZ2xCbGVuZEVxdWF0aW9uW2JsZW5kQWxwaGFFcXVhdGlvbl0pO1xuICAgICAgICAgICAgdGhpcy5ibGVuZEVxdWF0aW9uID0gYmxlbmRFcXVhdGlvbjtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRBbHBoYUVxdWF0aW9uID0gYmxlbmRBbHBoYUVxdWF0aW9uO1xuICAgICAgICAgICAgdGhpcy5zZXBhcmF0ZUFscGhhRXF1YXRpb24gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGJsZW5kaW5nIGZhY3RvcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gciAtIFRoZSByZWQgY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZyAtIFRoZSBncmVlbiBjb21wb25lbnQgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gRGVmYXVsdCB2YWx1ZSBpcyAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gVGhlIGJsdWUgY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYSAtIFRoZSBhbHBoYSBjb21wb25lbnQgaW4gdGhlIHJhbmdlIG9mIDAgdG8gMS4gRGVmYXVsdCB2YWx1ZSBpcyAwLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRCbGVuZENvbG9yKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgY29uc3QgYyA9IHRoaXMuYmxlbmRDb2xvcjtcbiAgICAgICAgaWYgKChyICE9PSBjLnIpIHx8IChnICE9PSBjLmcpIHx8IChiICE9PSBjLmIpIHx8IChhICE9PSBjLmEpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmJsZW5kQ29sb3IociwgZywgYiwgYSk7XG4gICAgICAgICAgICBjLnNldChyLCBnLCBiLCBhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyB0cmlhbmdsZXMgYXJlIGN1bGxlZCBiYXNlZCBvbiB0aGVpciBmYWNlIGRpcmVjdGlvbi4gVGhlIGRlZmF1bHQgY3VsbCBtb2RlIGlzXG4gICAgICoge0BsaW5rIENVTExGQUNFX0JBQ0t9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGN1bGxNb2RlIC0gVGhlIGN1bGwgbW9kZSB0byBzZXQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX05PTkV9XG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfQkFDS31cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9GUk9OVH1cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9GUk9OVEFOREJBQ0t9XG4gICAgICovXG4gICAgc2V0Q3VsbE1vZGUoY3VsbE1vZGUpIHtcbiAgICAgICAgaWYgKHRoaXMuY3VsbE1vZGUgIT09IGN1bGxNb2RlKSB7XG4gICAgICAgICAgICBpZiAoY3VsbE1vZGUgPT09IENVTExGQUNFX05PTkUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5DVUxMX0ZBQ0UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdWxsTW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLkNVTExfRkFDRSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgbW9kZSA9IHRoaXMuZ2xDdWxsW2N1bGxNb2RlXTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdWxsRmFjZSAhPT0gbW9kZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmN1bGxGYWNlKG1vZGUpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1bGxGYWNlID0gbW9kZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1bGxNb2RlID0gY3VsbE1vZGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBjdXJyZW50IGN1bGwgbW9kZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBjdXJyZW50IGN1bGwgbW9kZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0Q3VsbE1vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmN1bGxNb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGFjdGl2ZSBzaGFkZXIgdG8gYmUgdXNlZCBkdXJpbmcgc3Vic2VxdWVudCBkcmF3IGNhbGxzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gc2V0IHRvIGFzc2lnbiB0byB0aGUgZGV2aWNlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzaGFkZXIgd2FzIHN1Y2Nlc3NmdWxseSBzZXQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZXRTaGFkZXIoc2hhZGVyKSB7XG4gICAgICAgIGlmIChzaGFkZXIgIT09IHRoaXMuc2hhZGVyKSB7XG4gICAgICAgICAgICBpZiAoc2hhZGVyLmZhaWxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXNoYWRlci5yZWFkeSAmJiAhc2hhZGVyLmltcGwucG9zdExpbmsodGhpcywgc2hhZGVyKSkge1xuICAgICAgICAgICAgICAgIHNoYWRlci5mYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zaGFkZXIgPSBzaGFkZXI7XG5cbiAgICAgICAgICAgIC8vIFNldCB0aGUgYWN0aXZlIHNoYWRlclxuICAgICAgICAgICAgdGhpcy5nbC51c2VQcm9ncmFtKHNoYWRlci5pbXBsLmdsUHJvZ3JhbSk7XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUrKztcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNJbnZhbGlkYXRlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBzdXBwb3J0ZWQgSERSIHBpeGVsIGZvcm1hdC5cbiAgICAgKiBOb3RlIHRoYXQgZm9yIFdlYkdMMiwgUElYRUxGT1JNQVRfUkdCMTZGIGFuZCBQSVhFTEZPUk1BVF9SR0IzMkYgYXJlIG5vdCByZW5kZXJhYmxlIGFjY29yZGluZyB0byB0aGlzOlxuICAgICAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9FWFRfY29sb3JfYnVmZmVyX2Zsb2F0XG4gICAgICogRm9yIFdlYkdMMSwgb25seSBQSVhFTEZPUk1BVF9SR0JBMTZGIGFuZCBQSVhFTEZPUk1BVF9SR0JBMzJGIGFyZSB0ZXN0ZWQgZm9yIGJlaW5nIHJlbmRlcmFibGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgSERSIHBpeGVsIGZvcm1hdC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0SGRyRm9ybWF0KCkge1xuICAgICAgICBpZiAodGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSkge1xuICAgICAgICAgICAgcmV0dXJuIFBJWEVMRk9STUFUX1JHQkExNkY7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlKSB7XG4gICAgICAgICAgICByZXR1cm4gUElYRUxGT1JNQVRfUkdCQTMyRjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUElYRUxGT1JNQVRfUjhfRzhfQjhfQTg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgbWVtb3J5IGZyb20gYWxsIHNoYWRlcnMgZXZlciBhbGxvY2F0ZWQgd2l0aCB0aGlzIGRldmljZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjbGVhclNoYWRlckNhY2hlKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyU3JjIGluIHRoaXMuZnJhZ21lbnRTaGFkZXJDYWNoZSkge1xuICAgICAgICAgICAgZ2wuZGVsZXRlU2hhZGVyKHRoaXMuZnJhZ21lbnRTaGFkZXJDYWNoZVtzaGFkZXJTcmNdKTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmZyYWdtZW50U2hhZGVyQ2FjaGVbc2hhZGVyU3JjXTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IHNoYWRlclNyYyBpbiB0aGlzLnZlcnRleFNoYWRlckNhY2hlKSB7XG4gICAgICAgICAgICBnbC5kZWxldGVTaGFkZXIodGhpcy52ZXJ0ZXhTaGFkZXJDYWNoZVtzaGFkZXJTcmNdKTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnZlcnRleFNoYWRlckNhY2hlW3NoYWRlclNyY107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyBtZW1vcnkgZnJvbSBhbGwgdmVydGV4IGFycmF5IG9iamVjdHMgZXZlciBhbGxvY2F0ZWQgd2l0aCB0aGlzIGRldmljZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjbGVhclZlcnRleEFycmF5T2JqZWN0Q2FjaGUoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgdGhpcy5fdmFvTWFwLmZvckVhY2goKGl0ZW0sIGtleSwgbWFwT2JqKSA9PiB7XG4gICAgICAgICAgICBnbC5kZWxldGVWZXJ0ZXhBcnJheShpdGVtKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5fdmFvTWFwLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2lkdGggb2YgdGhlIGJhY2sgYnVmZmVyIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nbC5kcmF3aW5nQnVmZmVyV2lkdGggfHwgdGhpcy5jYW52YXMud2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGVpZ2h0IG9mIHRoZSBiYWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdsLmRyYXdpbmdCdWZmZXJIZWlnaHQgfHwgdGhpcy5jYW52YXMuaGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZ1bGxzY3JlZW4gbW9kZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmdWxsc2NyZWVuKGZ1bGxzY3JlZW4pIHtcbiAgICAgICAgaWYgKGZ1bGxzY3JlZW4pIHtcbiAgICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZ2wuY2FudmFzO1xuICAgICAgICAgICAgY2FudmFzLnJlcXVlc3RGdWxsc2NyZWVuKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkb2N1bWVudC5leGl0RnVsbHNjcmVlbigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZ1bGxzY3JlZW4oKSB7XG4gICAgICAgIHJldHVybiAhIWRvY3VtZW50LmZ1bGxzY3JlZW5FbGVtZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIGhpZ2ggcHJlY2lzaW9uIGZsb2F0aW5nLXBvaW50IHRleHR1cmVzIGFyZSBzdXBwb3J0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiA9IHRlc3RUZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIHRleHR1cmUgd2l0aCBoYWxmIGZsb2F0IGZvcm1hdCBjYW4gYmUgdXBkYXRlZCB3aXRoIGRhdGEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUgPSB0ZXN0VGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSh0aGlzLmdsLCB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ2xHcmFwaGljc0RldmljZSB9O1xuIl0sIm5hbWVzIjpbImludmFsaWRhdGVBdHRhY2htZW50cyIsIl9mdWxsU2NyZWVuUXVhZFZTIiwiX3ByZWNpc2lvblRlc3QxUFMiLCJfcHJlY2lzaW9uVGVzdDJQUyIsIl9vdXRwdXRUZXh0dXJlMkQiLCJ0ZXN0UmVuZGVyYWJsZSIsImdsIiwicGl4ZWxGb3JtYXQiLCJyZXN1bHQiLCJ0ZXh0dXJlIiwiY3JlYXRlVGV4dHVyZSIsImJpbmRUZXh0dXJlIiwiVEVYVFVSRV8yRCIsInRleFBhcmFtZXRlcmkiLCJURVhUVVJFX01JTl9GSUxURVIiLCJORUFSRVNUIiwiVEVYVFVSRV9NQUdfRklMVEVSIiwiVEVYVFVSRV9XUkFQX1MiLCJDTEFNUF9UT19FREdFIiwiVEVYVFVSRV9XUkFQX1QiLCJ0ZXhJbWFnZTJEIiwiUkdCQSIsImZyYW1lYnVmZmVyIiwiY3JlYXRlRnJhbWVidWZmZXIiLCJiaW5kRnJhbWVidWZmZXIiLCJGUkFNRUJVRkZFUiIsImZyYW1lYnVmZmVyVGV4dHVyZTJEIiwiQ09MT1JfQVRUQUNITUVOVDAiLCJjaGVja0ZyYW1lYnVmZmVyU3RhdHVzIiwiRlJBTUVCVUZGRVJfQ09NUExFVEUiLCJkZWxldGVUZXh0dXJlIiwiZGVsZXRlRnJhbWVidWZmZXIiLCJ0ZXN0VGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImRhdGEiLCJVaW50MTZBcnJheSIsImdldEVycm9yIiwiTk9fRVJST1IiLCJjb25zb2xlIiwibG9nIiwidGVzdFRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iLCJkZXZpY2UiLCJ0ZXh0dXJlRmxvYXRSZW5kZXJhYmxlIiwic2hhZGVyMSIsIlNoYWRlciIsIlNoYWRlclV0aWxzIiwiY3JlYXRlRGVmaW5pdGlvbiIsIm5hbWUiLCJ2ZXJ0ZXhDb2RlIiwiZnJhZ21lbnRDb2RlIiwic2hhZGVyMiIsInRleHR1cmVPcHRpb25zIiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIndpZHRoIiwiaGVpZ2h0IiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwidGV4MSIsIlRleHR1cmUiLCJ0YXJnMSIsIlJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiZGVwdGgiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCIsInRleDIiLCJ0YXJnMiIsImNvbnN0YW50VGV4U291cmNlIiwic2V0VmFsdWUiLCJwcmV2RnJhbWVidWZmZXIiLCJhY3RpdmVGcmFtZWJ1ZmZlciIsInNldEZyYW1lYnVmZmVyIiwiaW1wbCIsIl9nbEZyYW1lQnVmZmVyIiwicGl4ZWxzIiwiVWludDhBcnJheSIsInJlYWRQaXhlbHMiLCJ4IiwieSIsInoiLCJ3IiwiZiIsImRlc3Ryb3kiLCJ0ZXN0SW1hZ2VCaXRtYXAiLCJwbmdCeXRlcyIsImNyZWF0ZUltYWdlQml0bWFwIiwiQmxvYiIsInR5cGUiLCJwcmVtdWx0aXBseUFscGhhIiwidGhlbiIsImltYWdlIiwibGV2ZWxzIiwicnQiLCJpbml0UmVuZGVyVGFyZ2V0IiwiVWludDhDbGFtcGVkQXJyYXkiLCJVTlNJR05FRF9CWVRFIiwiY2F0Y2giLCJlIiwiV2ViZ2xHcmFwaGljc0RldmljZSIsIkdyYXBoaWNzRGV2aWNlIiwiY29uc3RydWN0b3IiLCJjYW52YXMiLCJvcHRpb25zIiwid2ViZ2wyIiwiZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR0wiLCJkZWZhdWx0RnJhbWVidWZmZXIiLCJkZWZhdWx0RnJhbWVidWZmZXJBbHBoYSIsImFscGhhIiwidXBkYXRlQ2xpZW50UmVjdCIsImNvbnRleHRMb3N0IiwiX2NvbnRleHRMb3N0SGFuZGxlciIsImV2ZW50IiwicHJldmVudERlZmF1bHQiLCJsb3NlQ29udGV4dCIsIkRlYnVnIiwiZmlyZSIsIl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyIiwicmVzdG9yZUNvbnRleHQiLCJzdGVuY2lsIiwicG93ZXJQcmVmZXJlbmNlIiwidWEiLCJuYXZpZ2F0b3IiLCJ1c2VyQWdlbnQiLCJmb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nIiwiaW5jbHVkZXMiLCJhbnRpYWxpYXMiLCJwcmVmZXJXZWJHbDIiLCJ1bmRlZmluZWQiLCJuYW1lcyIsImkiLCJsZW5ndGgiLCJnZXRDb250ZXh0IiwiRXJyb3IiLCJpc0Nocm9tZSIsInBsYXRmb3JtIiwiYnJvd3NlciIsIndpbmRvdyIsImNocm9tZSIsImlzTWFjIiwiYXBwVmVyc2lvbiIsImluZGV4T2YiLCJfdGVtcEVuYWJsZVNhZmFyaVRleHR1cmVVbml0V29ya2Fyb3VuZCIsInNhZmFyaSIsIl90ZW1wTWFjQ2hyb21lQmxpdEZyYW1lYnVmZmVyV29ya2Fyb3VuZCIsInNldHVwVmVydGV4QXJyYXlPYmplY3QiLCJhZGRFdmVudExpc3RlbmVyIiwiaW5pdGlhbGl6ZUV4dGVuc2lvbnMiLCJpbml0aWFsaXplQ2FwYWJpbGl0aWVzIiwiaW5pdGlhbGl6ZVJlbmRlclN0YXRlIiwiaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMiLCJzdXBwb3J0c0ltYWdlQml0bWFwIiwiSW1hZ2VCaXRtYXAiLCJkZWZhdWx0Q2xlYXJPcHRpb25zIiwiY29sb3IiLCJmbGFncyIsIkNMRUFSRkxBR19DT0xPUiIsIkNMRUFSRkxBR19ERVBUSCIsImdsQWRkcmVzcyIsIlJFUEVBVCIsIk1JUlJPUkVEX1JFUEVBVCIsImdsQmxlbmRFcXVhdGlvbiIsIkZVTkNfQUREIiwiRlVOQ19TVUJUUkFDVCIsIkZVTkNfUkVWRVJTRV9TVUJUUkFDVCIsIk1JTiIsImV4dEJsZW5kTWlubWF4IiwiTUlOX0VYVCIsIk1BWCIsIk1BWF9FWFQiLCJnbEJsZW5kRnVuY3Rpb24iLCJaRVJPIiwiT05FIiwiU1JDX0NPTE9SIiwiT05FX01JTlVTX1NSQ19DT0xPUiIsIkRTVF9DT0xPUiIsIk9ORV9NSU5VU19EU1RfQ09MT1IiLCJTUkNfQUxQSEEiLCJTUkNfQUxQSEFfU0FUVVJBVEUiLCJPTkVfTUlOVVNfU1JDX0FMUEhBIiwiRFNUX0FMUEhBIiwiT05FX01JTlVTX0RTVF9BTFBIQSIsIkNPTlNUQU5UX0NPTE9SIiwiT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SIiwiQ09OU1RBTlRfQUxQSEEiLCJPTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEEiLCJnbENvbXBhcmlzb24iLCJORVZFUiIsIkxFU1MiLCJFUVVBTCIsIkxFUVVBTCIsIkdSRUFURVIiLCJOT1RFUVVBTCIsIkdFUVVBTCIsIkFMV0FZUyIsImdsU3RlbmNpbE9wIiwiS0VFUCIsIlJFUExBQ0UiLCJJTkNSIiwiSU5DUl9XUkFQIiwiREVDUiIsIkRFQ1JfV1JBUCIsIklOVkVSVCIsImdsQ2xlYXJGbGFnIiwiQ09MT1JfQlVGRkVSX0JJVCIsIkRFUFRIX0JVRkZFUl9CSVQiLCJTVEVOQ0lMX0JVRkZFUl9CSVQiLCJnbEN1bGwiLCJCQUNLIiwiRlJPTlQiLCJGUk9OVF9BTkRfQkFDSyIsImdsRmlsdGVyIiwiTElORUFSIiwiTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIk5FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkxJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkxJTkVBUl9NSVBNQVBfTElORUFSIiwiZ2xQcmltaXRpdmUiLCJQT0lOVFMiLCJMSU5FUyIsIkxJTkVfTE9PUCIsIkxJTkVfU1RSSVAiLCJUUklBTkdMRVMiLCJUUklBTkdMRV9TVFJJUCIsIlRSSUFOR0xFX0ZBTiIsImdsVHlwZSIsIkJZVEUiLCJTSE9SVCIsIlVOU0lHTkVEX1NIT1JUIiwiSU5UIiwiVU5TSUdORURfSU5UIiwiRkxPQVQiLCJwY1VuaWZvcm1UeXBlIiwiQk9PTCIsIlVOSUZPUk1UWVBFX0JPT0wiLCJVTklGT1JNVFlQRV9JTlQiLCJVTklGT1JNVFlQRV9GTE9BVCIsIkZMT0FUX1ZFQzIiLCJVTklGT1JNVFlQRV9WRUMyIiwiRkxPQVRfVkVDMyIsIlVOSUZPUk1UWVBFX1ZFQzMiLCJGTE9BVF9WRUM0IiwiVU5JRk9STVRZUEVfVkVDNCIsIklOVF9WRUMyIiwiVU5JRk9STVRZUEVfSVZFQzIiLCJJTlRfVkVDMyIsIlVOSUZPUk1UWVBFX0lWRUMzIiwiSU5UX1ZFQzQiLCJVTklGT1JNVFlQRV9JVkVDNCIsIkJPT0xfVkVDMiIsIlVOSUZPUk1UWVBFX0JWRUMyIiwiQk9PTF9WRUMzIiwiVU5JRk9STVRZUEVfQlZFQzMiLCJCT09MX1ZFQzQiLCJVTklGT1JNVFlQRV9CVkVDNCIsIkZMT0FUX01BVDIiLCJVTklGT1JNVFlQRV9NQVQyIiwiRkxPQVRfTUFUMyIsIlVOSUZPUk1UWVBFX01BVDMiLCJGTE9BVF9NQVQ0IiwiVU5JRk9STVRZUEVfTUFUNCIsIlNBTVBMRVJfMkQiLCJVTklGT1JNVFlQRV9URVhUVVJFMkQiLCJTQU1QTEVSX0NVQkUiLCJVTklGT1JNVFlQRV9URVhUVVJFQ1VCRSIsIlNBTVBMRVJfMkRfU0hBRE9XIiwiVU5JRk9STVRZUEVfVEVYVFVSRTJEX1NIQURPVyIsIlNBTVBMRVJfQ1VCRV9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1ciLCJTQU1QTEVSXzNEIiwiVU5JRk9STVRZUEVfVEVYVFVSRTNEIiwidGFyZ2V0VG9TbG90IiwiVEVYVFVSRV9DVUJFX01BUCIsIlRFWFRVUkVfM0QiLCJzY29wZVgiLCJzY29wZVkiLCJzY29wZVoiLCJzY29wZVciLCJ1bmlmb3JtVmFsdWUiLCJjb21taXRGdW5jdGlvbiIsInVuaWZvcm0iLCJ2YWx1ZSIsInVuaWZvcm0xaSIsImxvY2F0aW9uSWQiLCJ1bmlmb3JtMWYiLCJ1bmlmb3JtMmZ2IiwidW5pZm9ybTNmdiIsInVuaWZvcm00ZnYiLCJ1bmlmb3JtMml2IiwidW5pZm9ybTNpdiIsInVuaWZvcm00aXYiLCJ1bmlmb3JtTWF0cml4MmZ2IiwidW5pZm9ybU1hdHJpeDNmdiIsInVuaWZvcm1NYXRyaXg0ZnYiLCJVTklGT1JNVFlQRV9GTE9BVEFSUkFZIiwidW5pZm9ybTFmdiIsIlVOSUZPUk1UWVBFX1ZFQzJBUlJBWSIsIlVOSUZPUk1UWVBFX1ZFQzNBUlJBWSIsIlVOSUZPUk1UWVBFX1ZFQzRBUlJBWSIsInN1cHBvcnRzQm9uZVRleHR1cmVzIiwiZXh0VGV4dHVyZUZsb2F0IiwibWF4VmVydGV4VGV4dHVyZXMiLCJudW1Vbmlmb3JtcyIsInZlcnRleFVuaWZvcm1zQ291bnQiLCJib25lTGltaXQiLCJNYXRoIiwiZmxvb3IiLCJtaW4iLCJ1bm1hc2tlZFJlbmRlcmVyIiwic2NvcGUiLCJyZXNvbHZlIiwiZXh0Q29sb3JCdWZmZXJGbG9hdCIsImV4dENvbG9yQnVmZmVySGFsZkZsb2F0IiwidGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUiLCJleHRUZXh0dXJlSGFsZkZsb2F0IiwiSEFMRl9GTE9BVF9PRVMiLCJzdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlIiwibWF4UHJlY2lzaW9uIiwiX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iLCJfdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsIl9zcGVjdG9yTWFya2VycyIsIl9zcGVjdG9yQ3VycmVudE1hcmtlciIsImFyZWFMaWdodEx1dEZvcm1hdCIsInRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJleHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsImV4dFRleHR1cmVGbG9hdExpbmVhciIsImZlZWRiYWNrIiwiZGVsZXRlVHJhbnNmb3JtRmVlZGJhY2siLCJjbGVhclNoYWRlckNhY2hlIiwiY2xlYXJWZXJ0ZXhBcnJheU9iamVjdENhY2hlIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInBvc3REZXN0cm95IiwiY3JlYXRlVmVydGV4QnVmZmVySW1wbCIsInZlcnRleEJ1ZmZlciIsIldlYmdsVmVydGV4QnVmZmVyIiwiY3JlYXRlSW5kZXhCdWZmZXJJbXBsIiwiaW5kZXhCdWZmZXIiLCJXZWJnbEluZGV4QnVmZmVyIiwiY3JlYXRlU2hhZGVySW1wbCIsInNoYWRlciIsIldlYmdsU2hhZGVyIiwiY3JlYXRlVGV4dHVyZUltcGwiLCJXZWJnbFRleHR1cmUiLCJjcmVhdGVSZW5kZXJUYXJnZXRJbXBsIiwicmVuZGVyVGFyZ2V0IiwiV2ViZ2xSZW5kZXJUYXJnZXQiLCJ1cGRhdGVNYXJrZXIiLCJqb2luIiwicHVzaE1hcmtlciIsInNwZWN0b3IiLCJwdXNoIiwic2V0TWFya2VyIiwicG9wTWFya2VyIiwicG9wIiwiY2xlYXJNYXJrZXIiLCJnZXRQcmVjaXNpb24iLCJwcmVjaXNpb24iLCJnZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQiLCJ2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0IiwiVkVSVEVYX1NIQURFUiIsIkhJR0hfRkxPQVQiLCJ2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQiLCJNRURJVU1fRkxPQVQiLCJmcmFnbWVudFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQiLCJGUkFHTUVOVF9TSEFERVIiLCJmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCIsImhpZ2hwQXZhaWxhYmxlIiwibWVkaXVtcEF2YWlsYWJsZSIsIndhcm4iLCJzdXBwb3J0ZWRFeHRlbnNpb25zIiwiZ2V0U3VwcG9ydGVkRXh0ZW5zaW9ucyIsImdldEV4dGVuc2lvbiIsImFyZ3VtZW50cyIsImV4dERyYXdCdWZmZXJzIiwiZXh0SW5zdGFuY2luZyIsImV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMiLCJleHRUZXh0dXJlTG9kIiwiZXh0VWludEVsZW1lbnQiLCJleHRWZXJ0ZXhBcnJheU9iamVjdCIsImV4dERpc2pvaW50VGltZXJRdWVyeSIsImV4dERlcHRoVGV4dHVyZSIsImV4dCIsImRyYXdBcnJheXNJbnN0YW5jZWQiLCJkcmF3QXJyYXlzSW5zdGFuY2VkQU5HTEUiLCJiaW5kIiwiZHJhd0VsZW1lbnRzSW5zdGFuY2VkIiwiZHJhd0VsZW1lbnRzSW5zdGFuY2VkQU5HTEUiLCJ2ZXJ0ZXhBdHRyaWJEaXZpc29yIiwidmVydGV4QXR0cmliRGl2aXNvckFOR0xFIiwiY3JlYXRlVmVydGV4QXJyYXkiLCJjcmVhdGVWZXJ0ZXhBcnJheU9FUyIsImRlbGV0ZVZlcnRleEFycmF5IiwiZGVsZXRlVmVydGV4QXJyYXlPRVMiLCJpc1ZlcnRleEFycmF5IiwiaXNWZXJ0ZXhBcnJheU9FUyIsImJpbmRWZXJ0ZXhBcnJheSIsImJpbmRWZXJ0ZXhBcnJheU9FUyIsImV4dERlYnVnUmVuZGVyZXJJbmZvIiwiZXh0RmxvYXRCbGVuZCIsImV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYyIsImV4dENvbXByZXNzZWRUZXh0dXJlRVRDMSIsImV4dENvbXByZXNzZWRUZXh0dXJlRVRDIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVQVlJUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlQVRDIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBU1RDIiwiZXh0UGFyYWxsZWxTaGFkZXJDb21waWxlIiwiY29udGV4dEF0dHJpYnMiLCJnZXRDb250ZXh0QXR0cmlidXRlcyIsInN1cHBvcnRzTXNhYSIsInN1cHBvcnRzU3RlbmNpbCIsInN1cHBvcnRzSW5zdGFuY2luZyIsIm1heFRleHR1cmVTaXplIiwiZ2V0UGFyYW1ldGVyIiwiTUFYX1RFWFRVUkVfU0laRSIsIm1heEN1YmVNYXBTaXplIiwiTUFYX0NVQkVfTUFQX1RFWFRVUkVfU0laRSIsIm1heFJlbmRlckJ1ZmZlclNpemUiLCJNQVhfUkVOREVSQlVGRkVSX1NJWkUiLCJtYXhUZXh0dXJlcyIsIk1BWF9URVhUVVJFX0lNQUdFX1VOSVRTIiwibWF4Q29tYmluZWRUZXh0dXJlcyIsIk1BWF9DT01CSU5FRF9URVhUVVJFX0lNQUdFX1VOSVRTIiwiTUFYX1ZFUlRFWF9URVhUVVJFX0lNQUdFX1VOSVRTIiwiTUFYX1ZFUlRFWF9VTklGT1JNX1ZFQ1RPUlMiLCJmcmFnbWVudFVuaWZvcm1zQ291bnQiLCJNQVhfRlJBR01FTlRfVU5JRk9STV9WRUNUT1JTIiwibWF4RHJhd0J1ZmZlcnMiLCJNQVhfRFJBV19CVUZGRVJTIiwibWF4Q29sb3JBdHRhY2htZW50cyIsIk1BWF9DT0xPUl9BVFRBQ0hNRU5UUyIsIm1heFZvbHVtZVNpemUiLCJNQVhfM0RfVEVYVFVSRV9TSVpFIiwiTUFYX0RSQVdfQlVGRkVSU19FWFQiLCJNQVhfQ09MT1JfQVRUQUNITUVOVFNfRVhUIiwiVU5NQVNLRURfUkVOREVSRVJfV0VCR0wiLCJ1bm1hc2tlZFZlbmRvciIsIlVOTUFTS0VEX1ZFTkRPUl9XRUJHTCIsInNhbXN1bmdNb2RlbFJlZ2V4Iiwic3VwcG9ydHNHcHVQYXJ0aWNsZXMiLCJtYXRjaCIsIm1heEFuaXNvdHJvcHkiLCJNQVhfVEVYVFVSRV9NQVhfQU5JU09UUk9QWV9FWFQiLCJzYW1wbGVzIiwiU0FNUExFUyIsIm1heFNhbXBsZXMiLCJNQVhfU0FNUExFUyIsInN1cHBvcnRzQXJlYUxpZ2h0cyIsImFuZHJvaWQiLCJibGVuZGluZyIsImRpc2FibGUiLCJCTEVORCIsImJsZW5kU3JjIiwiQkxFTkRNT0RFX09ORSIsImJsZW5kRHN0IiwiQkxFTkRNT0RFX1pFUk8iLCJibGVuZFNyY0FscGhhIiwiYmxlbmREc3RBbHBoYSIsInNlcGFyYXRlQWxwaGFCbGVuZCIsImJsZW5kRXF1YXRpb24iLCJCTEVOREVRVUFUSU9OX0FERCIsImJsZW5kQWxwaGFFcXVhdGlvbiIsInNlcGFyYXRlQWxwaGFFcXVhdGlvbiIsImJsZW5kRnVuYyIsImJsZW5kQ29sb3IiLCJDb2xvciIsIndyaXRlUmVkIiwid3JpdGVHcmVlbiIsIndyaXRlQmx1ZSIsIndyaXRlQWxwaGEiLCJjb2xvck1hc2siLCJjdWxsTW9kZSIsIkNVTExGQUNFX0JBQ0siLCJlbmFibGUiLCJDVUxMX0ZBQ0UiLCJjdWxsRmFjZSIsImRlcHRoVGVzdCIsIkRFUFRIX1RFU1QiLCJkZXB0aEZ1bmMiLCJGVU5DX0xFU1NFUVVBTCIsImRlcHRoV3JpdGUiLCJkZXB0aE1hc2siLCJTVEVOQ0lMX1RFU1QiLCJzdGVuY2lsRnVuY0Zyb250Iiwic3RlbmNpbEZ1bmNCYWNrIiwiRlVOQ19BTFdBWVMiLCJzdGVuY2lsUmVmRnJvbnQiLCJzdGVuY2lsUmVmQmFjayIsInN0ZW5jaWxNYXNrRnJvbnQiLCJzdGVuY2lsTWFza0JhY2siLCJzdGVuY2lsRnVuYyIsInN0ZW5jaWxGYWlsRnJvbnQiLCJzdGVuY2lsRmFpbEJhY2siLCJTVEVOQ0lMT1BfS0VFUCIsInN0ZW5jaWxaZmFpbEZyb250Iiwic3RlbmNpbFpmYWlsQmFjayIsInN0ZW5jaWxacGFzc0Zyb250Iiwic3RlbmNpbFpwYXNzQmFjayIsInN0ZW5jaWxXcml0ZU1hc2tGcm9udCIsInN0ZW5jaWxXcml0ZU1hc2tCYWNrIiwic3RlbmNpbE9wIiwic3RlbmNpbE1hc2siLCJhbHBoYVRvQ292ZXJhZ2UiLCJyYXN0ZXIiLCJTQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UiLCJSQVNURVJJWkVSX0RJU0NBUkQiLCJkZXB0aEJpYXNFbmFibGVkIiwiUE9MWUdPTl9PRkZTRVRfRklMTCIsImNsZWFyRGVwdGgiLCJjbGVhckNvbG9yIiwiY2xlYXJTdGVuY2lsIiwidngiLCJ2eSIsInZ3IiwidmgiLCJzeCIsInN5Iiwic3ciLCJzaCIsImhpbnQiLCJGUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5UIiwiTklDRVNUIiwiRlJBR01FTlRfU0hBREVSX0RFUklWQVRJVkVfSElOVF9PRVMiLCJTQ0lTU09SX1RFU1QiLCJwaXhlbFN0b3JlaSIsIlVOUEFDS19DT0xPUlNQQUNFX0NPTlZFUlNJT05fV0VCR0wiLCJOT05FIiwidW5wYWNrRmxpcFkiLCJVTlBBQ0tfRkxJUF9ZX1dFQkdMIiwidW5wYWNrUHJlbXVsdGlwbHlBbHBoYSIsIlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCIsIlVOUEFDS19BTElHTk1FTlQiLCJ2ZXJ0ZXhTaGFkZXJDYWNoZSIsImZyYWdtZW50U2hhZGVyQ2FjaGUiLCJfdmFvTWFwIiwiTWFwIiwiYm91bmRWYW8iLCJ0cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciIsInRleHR1cmVVbml0IiwidGV4dHVyZVVuaXRzIiwic2hhZGVycyIsInRleHR1cmVzIiwiYnVmZmVyIiwiYnVmZmVycyIsInRhcmdldCIsInRhcmdldHMiLCJ1bmxvY2siLCJzZXRWaWV3cG9ydCIsImgiLCJ2aWV3cG9ydCIsInNldFNjaXNzb3IiLCJzY2lzc29yIiwiZmIiLCJjb3B5UmVuZGVyVGFyZ2V0Iiwic291cmNlIiwiZGVzdCIsImVycm9yIiwiX2NvbG9yQnVmZmVyIiwiX2Zvcm1hdCIsIl9kZXB0aCIsIl9kZXB0aEJ1ZmZlciIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwicHJldlJ0IiwidXBkYXRlQmVnaW4iLCJSRUFEX0ZSQU1FQlVGRkVSIiwiRFJBV19GUkFNRUJVRkZFUiIsImJsaXRGcmFtZWJ1ZmZlciIsImdldENvcHlTaGFkZXIiLCJwb3BHcHVNYXJrZXIiLCJfY29weVNoYWRlciIsInN0YXJ0UGFzcyIsInJlbmRlclBhc3MiLCJzZXRSZW5kZXJUYXJnZXQiLCJjb2xvck9wcyIsImRlcHRoU3RlbmNpbE9wcyIsImNsZWFyIiwiY2xlYXJGbGFncyIsImNsZWFyT3B0aW9ucyIsImNsZWFyVmFsdWUiLCJyIiwiZyIsImIiLCJhIiwiY2xlYXJEZXB0aFZhbHVlIiwiQ0xFQVJGTEFHX1NURU5DSUwiLCJjbGVhclN0ZW5jaWxWYWx1ZSIsImFzc2VydCIsImluc2lkZVJlbmRlclBhc3MiLCJlbmRQYXNzIiwidW5iaW5kVmVydGV4QXJyYXkiLCJzdG9yZSIsInN0b3JlRGVwdGgiLCJERVBUSF9BVFRBQ0hNRU5UIiwic3RvcmVTdGVuY2lsIiwiU1RFTkNJTF9BVFRBQ0hNRU5UIiwiZnVsbFNpemVDbGVhclJlY3QiLCJpbnZhbGlkYXRlRnJhbWVidWZmZXIiLCJhdXRvUmVzb2x2ZSIsIl9nbFRleHR1cmUiLCJwb3QiLCJhY3RpdmVUZXh0dXJlIiwiZ2VuZXJhdGVNaXBtYXAiLCJfZ2xUYXJnZXQiLCJ1bml0Iiwic2xvdCIsImluaXRpYWxpemVkIiwidXBkYXRlRW5kIiwiX3NhbXBsZXMiLCJzZXRVbnBhY2tGbGlwWSIsImZsaXBZIiwic2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSIsIlRFWFRVUkUwIiwidGV4dHVyZVRhcmdldCIsInRleHR1cmVPYmplY3QiLCJiaW5kVGV4dHVyZU9uVW5pdCIsInNldFRleHR1cmVQYXJhbWV0ZXJzIiwiX3BhcmFtZXRlckZsYWdzIiwiZmlsdGVyIiwiX21pbkZpbHRlciIsIl9taXBtYXBzIiwiX2NvbXByZXNzZWQiLCJfbGV2ZWxzIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVIiLCJfbWFnRmlsdGVyIiwiX2FkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiX2FkZHJlc3NWIiwiVEVYVFVSRV9XUkFQX1IiLCJfYWRkcmVzc1ciLCJURVhUVVJFX0NPTVBBUkVfTU9ERSIsIl9jb21wYXJlT25SZWFkIiwiQ09NUEFSRV9SRUZfVE9fVEVYVFVSRSIsIlRFWFRVUkVfQ09NUEFSRV9GVU5DIiwiX2NvbXBhcmVGdW5jIiwidGV4UGFyYW1ldGVyZiIsIlRFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUIiwibWF4Iiwicm91bmQiLCJfYW5pc290cm9weSIsInNldFRleHR1cmUiLCJpbml0aWFsaXplIiwiX25lZWRzVXBsb2FkIiwiX25lZWRzTWlwbWFwc1VwbG9hZCIsInVwbG9hZCIsInZlcnRleEJ1ZmZlcnMiLCJrZXkiLCJ2YW8iLCJ1c2VDYWNoZSIsImlkIiwicmVuZGVyaW5naW5nSGFzaCIsImdldCIsImJpbmRCdWZmZXIiLCJFTEVNRU5UX0FSUkFZX0JVRkZFUiIsImxvY1plcm8iLCJBUlJBWV9CVUZGRVIiLCJidWZmZXJJZCIsImVsZW1lbnRzIiwiaiIsImxvYyIsInNlbWFudGljVG9Mb2NhdGlvbiIsInZlcnRleEF0dHJpYlBvaW50ZXIiLCJudW1Db21wb25lbnRzIiwiZGF0YVR5cGUiLCJub3JtYWxpemUiLCJzdHJpZGUiLCJvZmZzZXQiLCJlbmFibGVWZXJ0ZXhBdHRyaWJBcnJheSIsImluc3RhbmNpbmciLCJzZXQiLCJzZXRCdWZmZXJzIiwiZHJhdyIsInByaW1pdGl2ZSIsIm51bUluc3RhbmNlcyIsImtlZXBCdWZmZXJzIiwic2FtcGxlciIsInNhbXBsZXJWYWx1ZSIsIm51bVRleHR1cmVzIiwic2NvcGVJZCIsInVuaWZvcm1WZXJzaW9uIiwicHJvZ3JhbVZlcnNpb24iLCJzYW1wbGVycyIsInVuaWZvcm1zIiwibGVuIiwic2FtcGxlck5hbWUiLCJ3YXJuT25jZSIsImRlcHRoQnVmZmVyIiwiYXJyYXkiLCJ1bmlmb3JtMWl2IiwidmVyc2lvbiIsInZlcnNpb25PYmplY3QiLCJnbG9iYWxJZCIsInJldmlzaW9uIiwiYmluZEJ1ZmZlckJhc2UiLCJUUkFOU0ZPUk1fRkVFREJBQ0tfQlVGRkVSIiwiYmVnaW5UcmFuc2Zvcm1GZWVkYmFjayIsIm1vZGUiLCJjb3VudCIsImluZGV4ZWQiLCJnbEZvcm1hdCIsImJhc2UiLCJieXRlc1BlckluZGV4IiwiZHJhd0VsZW1lbnRzIiwiZmlyc3QiLCJkcmF3QXJyYXlzIiwiZW5kVHJhbnNmb3JtRmVlZGJhY2siLCJfZHJhd0NhbGxzUGVyRnJhbWUiLCJfcHJpbXNQZXJGcmFtZSIsImRlZmF1bHRPcHRpb25zIiwic2V0Q2xlYXJDb2xvciIsInNldENvbG9yV3JpdGUiLCJzZXRDbGVhckRlcHRoIiwic2V0RGVwdGhXcml0ZSIsInNldENsZWFyU3RlbmNpbCIsImMiLCJnZXREZXB0aFRlc3QiLCJzZXREZXB0aFRlc3QiLCJzZXREZXB0aEZ1bmMiLCJmdW5jIiwiZ2V0RGVwdGhXcml0ZSIsIndyaXRlRGVwdGgiLCJzZXRBbHBoYVRvQ292ZXJhZ2UiLCJzdGF0ZSIsInNldFRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyIiwidGYiLCJjcmVhdGVUcmFuc2Zvcm1GZWVkYmFjayIsImJpbmRUcmFuc2Zvcm1GZWVkYmFjayIsIlRSQU5TRk9STV9GRUVEQkFDSyIsInNldFJhc3RlciIsIm9uIiwic2V0RGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwiY29uc3RCaWFzIiwic2xvcGVCaWFzIiwicG9seWdvbk9mZnNldCIsImdldEJsZW5kaW5nIiwic2V0QmxlbmRpbmciLCJzZXRTdGVuY2lsVGVzdCIsInNldFN0ZW5jaWxGdW5jIiwicmVmIiwibWFzayIsInNldFN0ZW5jaWxGdW5jRnJvbnQiLCJzdGVuY2lsRnVuY1NlcGFyYXRlIiwic2V0U3RlbmNpbEZ1bmNCYWNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbiIsImZhaWwiLCJ6ZmFpbCIsInpwYXNzIiwid3JpdGVNYXNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbkZyb250Iiwic3RlbmNpbE9wU2VwYXJhdGUiLCJzdGVuY2lsTWFza1NlcGFyYXRlIiwic2V0U3RlbmNpbE9wZXJhdGlvbkJhY2siLCJzZXRCbGVuZEZ1bmN0aW9uIiwic2V0QmxlbmRGdW5jdGlvblNlcGFyYXRlIiwiYmxlbmRGdW5jU2VwYXJhdGUiLCJzZXRCbGVuZEVxdWF0aW9uIiwic2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlIiwiYmxlbmRFcXVhdGlvblNlcGFyYXRlIiwic2V0QmxlbmRDb2xvciIsInNldEN1bGxNb2RlIiwiQ1VMTEZBQ0VfTk9ORSIsImdldEN1bGxNb2RlIiwic2V0U2hhZGVyIiwiZmFpbGVkIiwicmVhZHkiLCJwb3N0TGluayIsInVzZVByb2dyYW0iLCJnbFByb2dyYW0iLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsImF0dHJpYnV0ZXNJbnZhbGlkYXRlZCIsImdldEhkckZvcm1hdCIsInNoYWRlclNyYyIsImRlbGV0ZVNoYWRlciIsImZvckVhY2giLCJpdGVtIiwibWFwT2JqIiwiZHJhd2luZ0J1ZmZlcldpZHRoIiwiZHJhd2luZ0J1ZmZlckhlaWdodCIsImZ1bGxzY3JlZW4iLCJyZXF1ZXN0RnVsbHNjcmVlbiIsImRvY3VtZW50IiwiZXhpdEZ1bGxzY3JlZW4iLCJmdWxsc2NyZWVuRWxlbWVudCIsInRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNENBLE1BQU1BLHFCQUFxQixHQUFHLEVBQUUsQ0FBQTtBQUVoQyxNQUFNQyxpQkFBaUIsR0FBYyxDQUFBO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsaUJBQWlCLEdBQWMsQ0FBQTtBQUNyQztBQUNBO0FBQ0E7QUFDQSxDQUFDLENBQUE7QUFFRCxNQUFNQyxpQkFBaUIsR0FBYyxDQUFBO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsZ0JBQWdCLEdBQWMsQ0FBQTtBQUNwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxDQUFBO0FBRUQsU0FBU0MsY0FBYyxDQUFDQyxFQUFFLEVBQUVDLFdBQVcsRUFBRTtFQUNyQyxJQUFJQyxNQUFNLEdBQUcsSUFBSSxDQUFBOztBQUdqQixFQUFBLE1BQU1DLE9BQU8sR0FBR0gsRUFBRSxDQUFDSSxhQUFhLEVBQUUsQ0FBQTtFQUNsQ0osRUFBRSxDQUFDSyxXQUFXLENBQUNMLEVBQUUsQ0FBQ00sVUFBVSxFQUFFSCxPQUFPLENBQUMsQ0FBQTtBQUN0Q0gsRUFBQUEsRUFBRSxDQUFDTyxhQUFhLENBQUNQLEVBQUUsQ0FBQ00sVUFBVSxFQUFFTixFQUFFLENBQUNRLGtCQUFrQixFQUFFUixFQUFFLENBQUNTLE9BQU8sQ0FBQyxDQUFBO0FBQ2xFVCxFQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ1AsRUFBRSxDQUFDTSxVQUFVLEVBQUVOLEVBQUUsQ0FBQ1Usa0JBQWtCLEVBQUVWLEVBQUUsQ0FBQ1MsT0FBTyxDQUFDLENBQUE7QUFDbEVULEVBQUFBLEVBQUUsQ0FBQ08sYUFBYSxDQUFDUCxFQUFFLENBQUNNLFVBQVUsRUFBRU4sRUFBRSxDQUFDVyxjQUFjLEVBQUVYLEVBQUUsQ0FBQ1ksYUFBYSxDQUFDLENBQUE7QUFDcEVaLEVBQUFBLEVBQUUsQ0FBQ08sYUFBYSxDQUFDUCxFQUFFLENBQUNNLFVBQVUsRUFBRU4sRUFBRSxDQUFDYSxjQUFjLEVBQUViLEVBQUUsQ0FBQ1ksYUFBYSxDQUFDLENBQUE7RUFDcEVaLEVBQUUsQ0FBQ2MsVUFBVSxDQUFDZCxFQUFFLENBQUNNLFVBQVUsRUFBRSxDQUFDLEVBQUVOLEVBQUUsQ0FBQ2UsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFZixFQUFFLENBQUNlLElBQUksRUFBRWQsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFBOztBQUc3RSxFQUFBLE1BQU1lLFdBQVcsR0FBR2hCLEVBQUUsQ0FBQ2lCLGlCQUFpQixFQUFFLENBQUE7RUFDMUNqQixFQUFFLENBQUNrQixlQUFlLENBQUNsQixFQUFFLENBQUNtQixXQUFXLEVBQUVILFdBQVcsQ0FBQyxDQUFBO0FBQy9DaEIsRUFBQUEsRUFBRSxDQUFDb0Isb0JBQW9CLENBQUNwQixFQUFFLENBQUNtQixXQUFXLEVBQUVuQixFQUFFLENBQUNxQixpQkFBaUIsRUFBRXJCLEVBQUUsQ0FBQ00sVUFBVSxFQUFFSCxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUE7O0FBSXhGLEVBQUEsSUFBSUgsRUFBRSxDQUFDc0Isc0JBQXNCLENBQUN0QixFQUFFLENBQUNtQixXQUFXLENBQUMsS0FBS25CLEVBQUUsQ0FBQ3VCLG9CQUFvQixFQUFFO0FBQ3ZFckIsSUFBQUEsTUFBTSxHQUFHLEtBQUssQ0FBQTtBQUNsQixHQUFBOztFQUdBRixFQUFFLENBQUNLLFdBQVcsQ0FBQ0wsRUFBRSxDQUFDTSxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbkNOLEVBQUFBLEVBQUUsQ0FBQ3dCLGFBQWEsQ0FBQ3JCLE9BQU8sQ0FBQyxDQUFBO0VBQ3pCSCxFQUFFLENBQUNrQixlQUFlLENBQUNsQixFQUFFLENBQUNtQixXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDeENuQixFQUFBQSxFQUFFLENBQUN5QixpQkFBaUIsQ0FBQ1QsV0FBVyxDQUFDLENBQUE7QUFFakMsRUFBQSxPQUFPZCxNQUFNLENBQUE7QUFDakIsQ0FBQTtBQUVBLFNBQVN3Qiw2QkFBNkIsQ0FBQzFCLEVBQUUsRUFBRUMsV0FBVyxFQUFFO0VBQ3BELElBQUlDLE1BQU0sR0FBRyxJQUFJLENBQUE7O0FBR2pCLEVBQUEsTUFBTUMsT0FBTyxHQUFHSCxFQUFFLENBQUNJLGFBQWEsRUFBRSxDQUFBO0VBQ2xDSixFQUFFLENBQUNLLFdBQVcsQ0FBQ0wsRUFBRSxDQUFDTSxVQUFVLEVBQUVILE9BQU8sQ0FBQyxDQUFBO0FBQ3RDSCxFQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ1AsRUFBRSxDQUFDTSxVQUFVLEVBQUVOLEVBQUUsQ0FBQ1Esa0JBQWtCLEVBQUVSLEVBQUUsQ0FBQ1MsT0FBTyxDQUFDLENBQUE7QUFDbEVULEVBQUFBLEVBQUUsQ0FBQ08sYUFBYSxDQUFDUCxFQUFFLENBQUNNLFVBQVUsRUFBRU4sRUFBRSxDQUFDVSxrQkFBa0IsRUFBRVYsRUFBRSxDQUFDUyxPQUFPLENBQUMsQ0FBQTtBQUNsRVQsRUFBQUEsRUFBRSxDQUFDTyxhQUFhLENBQUNQLEVBQUUsQ0FBQ00sVUFBVSxFQUFFTixFQUFFLENBQUNXLGNBQWMsRUFBRVgsRUFBRSxDQUFDWSxhQUFhLENBQUMsQ0FBQTtBQUNwRVosRUFBQUEsRUFBRSxDQUFDTyxhQUFhLENBQUNQLEVBQUUsQ0FBQ00sVUFBVSxFQUFFTixFQUFFLENBQUNhLGNBQWMsRUFBRWIsRUFBRSxDQUFDWSxhQUFhLENBQUMsQ0FBQTs7RUFLcEUsTUFBTWUsSUFBSSxHQUFHLElBQUlDLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO0VBQ3ZDNUIsRUFBRSxDQUFDYyxVQUFVLENBQUNkLEVBQUUsQ0FBQ00sVUFBVSxFQUFFLENBQUMsRUFBRU4sRUFBRSxDQUFDZSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUVmLEVBQUUsQ0FBQ2UsSUFBSSxFQUFFZCxXQUFXLEVBQUUwQixJQUFJLENBQUMsQ0FBQTtFQUU3RSxJQUFJM0IsRUFBRSxDQUFDNkIsUUFBUSxFQUFFLEtBQUs3QixFQUFFLENBQUM4QixRQUFRLEVBQUU7QUFDL0I1QixJQUFBQSxNQUFNLEdBQUcsS0FBSyxDQUFBO0FBQ2Q2QixJQUFBQSxPQUFPLENBQUNDLEdBQUcsQ0FBQyw4R0FBOEcsQ0FBQyxDQUFBO0FBQy9ILEdBQUE7O0VBR0FoQyxFQUFFLENBQUNLLFdBQVcsQ0FBQ0wsRUFBRSxDQUFDTSxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbkNOLEVBQUFBLEVBQUUsQ0FBQ3dCLGFBQWEsQ0FBQ3JCLE9BQU8sQ0FBQyxDQUFBO0FBRXpCLEVBQUEsT0FBT0QsTUFBTSxDQUFBO0FBQ2pCLENBQUE7QUFFQSxTQUFTK0IsNkJBQTZCLENBQUNDLE1BQU0sRUFBRTtBQUMzQyxFQUFBLElBQUksQ0FBQ0EsTUFBTSxDQUFDQyxzQkFBc0IsRUFDOUIsT0FBTyxLQUFLLENBQUE7QUFFaEIsRUFBQSxNQUFNQyxPQUFPLEdBQUcsSUFBSUMsTUFBTSxDQUFDSCxNQUFNLEVBQUVJLFdBQVcsQ0FBQ0MsZ0JBQWdCLENBQUNMLE1BQU0sRUFBRTtBQUNwRU0sSUFBQUEsSUFBSSxFQUFFLFFBQVE7QUFDZEMsSUFBQUEsVUFBVSxFQUFFOUMsaUJBQWlCO0FBQzdCK0MsSUFBQUEsWUFBWSxFQUFFOUMsaUJBQUFBO0FBQ2xCLEdBQUMsQ0FBQyxDQUFDLENBQUE7QUFFSCxFQUFBLE1BQU0rQyxPQUFPLEdBQUcsSUFBSU4sTUFBTSxDQUFDSCxNQUFNLEVBQUVJLFdBQVcsQ0FBQ0MsZ0JBQWdCLENBQUNMLE1BQU0sRUFBRTtBQUNwRU0sSUFBQUEsSUFBSSxFQUFFLFFBQVE7QUFDZEMsSUFBQUEsVUFBVSxFQUFFOUMsaUJBQWlCO0FBQzdCK0MsSUFBQUEsWUFBWSxFQUFFN0MsaUJBQUFBO0FBQ2xCLEdBQUMsQ0FBQyxDQUFDLENBQUE7QUFFSCxFQUFBLE1BQU0rQyxjQUFjLEdBQUc7QUFDbkJDLElBQUFBLE1BQU0sRUFBRUMsbUJBQW1CO0FBQzNCQyxJQUFBQSxLQUFLLEVBQUUsQ0FBQztBQUNSQyxJQUFBQSxNQUFNLEVBQUUsQ0FBQztBQUNUQyxJQUFBQSxPQUFPLEVBQUUsS0FBSztBQUNkQyxJQUFBQSxTQUFTLEVBQUVDLGNBQWM7QUFDekJDLElBQUFBLFNBQVMsRUFBRUQsY0FBYztBQUN6QlgsSUFBQUEsSUFBSSxFQUFFLFNBQUE7R0FDVCxDQUFBO0VBQ0QsTUFBTWEsSUFBSSxHQUFHLElBQUlDLE9BQU8sQ0FBQ3BCLE1BQU0sRUFBRVUsY0FBYyxDQUFDLENBQUE7QUFDaEQsRUFBQSxNQUFNVyxLQUFLLEdBQUcsSUFBSUMsWUFBWSxDQUFDO0FBQzNCQyxJQUFBQSxXQUFXLEVBQUVKLElBQUk7QUFDakJLLElBQUFBLEtBQUssRUFBRSxLQUFBO0FBQ1gsR0FBQyxDQUFDLENBQUE7QUFDRkMsRUFBQUEsa0JBQWtCLENBQUN6QixNQUFNLEVBQUVxQixLQUFLLEVBQUVuQixPQUFPLENBQUMsQ0FBQTtFQUUxQ1EsY0FBYyxDQUFDQyxNQUFNLEdBQUdlLHVCQUF1QixDQUFBO0VBQy9DLE1BQU1DLElBQUksR0FBRyxJQUFJUCxPQUFPLENBQUNwQixNQUFNLEVBQUVVLGNBQWMsQ0FBQyxDQUFBO0FBQ2hELEVBQUEsTUFBTWtCLEtBQUssR0FBRyxJQUFJTixZQUFZLENBQUM7QUFDM0JDLElBQUFBLFdBQVcsRUFBRUksSUFBSTtBQUNqQkgsSUFBQUEsS0FBSyxFQUFFLEtBQUE7QUFDWCxHQUFDLENBQUMsQ0FBQTtBQUNGeEIsRUFBQUEsTUFBTSxDQUFDNkIsaUJBQWlCLENBQUNDLFFBQVEsQ0FBQ1gsSUFBSSxDQUFDLENBQUE7QUFDdkNNLEVBQUFBLGtCQUFrQixDQUFDekIsTUFBTSxFQUFFNEIsS0FBSyxFQUFFbkIsT0FBTyxDQUFDLENBQUE7QUFFMUMsRUFBQSxNQUFNc0IsZUFBZSxHQUFHL0IsTUFBTSxDQUFDZ0MsaUJBQWlCLENBQUE7RUFDaERoQyxNQUFNLENBQUNpQyxjQUFjLENBQUNMLEtBQUssQ0FBQ00sSUFBSSxDQUFDQyxjQUFjLENBQUMsQ0FBQTtBQUVoRCxFQUFBLE1BQU1DLE1BQU0sR0FBRyxJQUFJQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDaENyQyxFQUFBQSxNQUFNLENBQUNzQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFRixNQUFNLENBQUMsQ0FBQTtBQUVyQ3BDLEVBQUFBLE1BQU0sQ0FBQ2lDLGNBQWMsQ0FBQ0YsZUFBZSxDQUFDLENBQUE7QUFFdEMsRUFBQSxNQUFNUSxDQUFDLEdBQUdILE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUE7QUFDekIsRUFBQSxNQUFNSSxDQUFDLEdBQUdKLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUE7QUFDekIsRUFBQSxNQUFNSyxDQUFDLEdBQUdMLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUE7QUFDekIsRUFBQSxNQUFNTSxDQUFDLEdBQUdOLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUE7RUFDekIsTUFBTU8sQ0FBQyxHQUFHSixDQUFDLElBQUksR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBR0MsQ0FBQyxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBR0MsQ0FBQyxHQUFHLEdBQUcsR0FBR0MsQ0FBQyxDQUFBO0VBRS9EdkIsSUFBSSxDQUFDeUIsT0FBTyxFQUFFLENBQUE7RUFDZHZCLEtBQUssQ0FBQ3VCLE9BQU8sRUFBRSxDQUFBO0VBQ2ZqQixJQUFJLENBQUNpQixPQUFPLEVBQUUsQ0FBQTtFQUNkaEIsS0FBSyxDQUFDZ0IsT0FBTyxFQUFFLENBQUE7RUFDZjFDLE9BQU8sQ0FBQzBDLE9BQU8sRUFBRSxDQUFBO0VBQ2pCbkMsT0FBTyxDQUFDbUMsT0FBTyxFQUFFLENBQUE7RUFFakIsT0FBT0QsQ0FBQyxLQUFLLENBQUMsQ0FBQTtBQUNsQixDQUFBOztBQWFBLFNBQVNFLGVBQWUsQ0FBQzdDLE1BQU0sRUFBRTtBQUU3QixFQUFBLE1BQU04QyxRQUFRLEdBQUcsSUFBSVQsVUFBVSxDQUFDLENBQzVCLEdBQUcsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFDM0csR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQzdHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUMvQyxDQUFDLENBQUE7RUFFRixPQUFPVSxpQkFBaUIsQ0FBQyxJQUFJQyxJQUFJLENBQUMsQ0FBQ0YsUUFBUSxDQUFDLEVBQUU7QUFBRUcsSUFBQUEsSUFBSSxFQUFFLFdBQUE7QUFBWSxHQUFDLENBQUMsRUFBRTtBQUFFQyxJQUFBQSxnQkFBZ0IsRUFBRSxNQUFBO0FBQU8sR0FBQyxDQUFDLENBQzlGQyxJQUFJLENBQUVDLEtBQUssSUFBSztBQUViLElBQUEsTUFBTW5GLE9BQU8sR0FBRyxJQUFJbUQsT0FBTyxDQUFDcEIsTUFBTSxFQUFFO0FBQ2hDYSxNQUFBQSxLQUFLLEVBQUUsQ0FBQztBQUNSQyxNQUFBQSxNQUFNLEVBQUUsQ0FBQztBQUNUSCxNQUFBQSxNQUFNLEVBQUVlLHVCQUF1QjtBQUMvQlgsTUFBQUEsT0FBTyxFQUFFLEtBQUs7TUFDZHNDLE1BQU0sRUFBRSxDQUFDRCxLQUFLLENBQUE7QUFDbEIsS0FBQyxDQUFDLENBQUE7O0FBR0YsSUFBQSxNQUFNRSxFQUFFLEdBQUcsSUFBSWhDLFlBQVksQ0FBQztBQUFFQyxNQUFBQSxXQUFXLEVBQUV0RCxPQUFPO0FBQUV1RCxNQUFBQSxLQUFLLEVBQUUsS0FBQTtBQUFNLEtBQUMsQ0FBQyxDQUFBO0lBQ25FeEIsTUFBTSxDQUFDaUMsY0FBYyxDQUFDcUIsRUFBRSxDQUFDcEIsSUFBSSxDQUFDQyxjQUFjLENBQUMsQ0FBQTtBQUM3Q25DLElBQUFBLE1BQU0sQ0FBQ3VELGdCQUFnQixDQUFDRCxFQUFFLENBQUMsQ0FBQTtBQUUzQixJQUFBLE1BQU03RCxJQUFJLEdBQUcsSUFBSStELGlCQUFpQixDQUFDLENBQUMsQ0FBQyxDQUFBO0lBQ3JDeEQsTUFBTSxDQUFDbEMsRUFBRSxDQUFDd0UsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRXRDLE1BQU0sQ0FBQ2xDLEVBQUUsQ0FBQ2UsSUFBSSxFQUFFbUIsTUFBTSxDQUFDbEMsRUFBRSxDQUFDMkYsYUFBYSxFQUFFaEUsSUFBSSxDQUFDLENBQUE7SUFFL0U2RCxFQUFFLENBQUNWLE9BQU8sRUFBRSxDQUFBO0lBQ1ozRSxPQUFPLENBQUMyRSxPQUFPLEVBQUUsQ0FBQTtJQUVqQixPQUFPbkQsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSUEsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSUEsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSUEsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsQ0FBQTtBQUM1RSxHQUFDLENBQUMsQ0FDRGlFLEtBQUssQ0FBQ0MsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFBO0FBQzFCLENBQUE7O0FBVUEsTUFBTUMsbUJBQW1CLFNBQVNDLGNBQWMsQ0FBQzs7QUF5RDdDQyxFQUFBQSxXQUFXLENBQUNDLE1BQU0sRUFBRUMsT0FBTyxHQUFHLEVBQUUsRUFBRTtJQUM5QixLQUFLLENBQUNELE1BQU0sQ0FBQyxDQUFBO0FBQUMsSUFBQSxJQUFBLENBaERsQmpHLEVBQUUsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVNGbUcsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBd0NGLElBQUksQ0FBQ0MsVUFBVSxHQUFHQyxnQkFBZ0IsQ0FBQTtJQUVsQyxJQUFJLENBQUNDLGtCQUFrQixHQUFHLElBQUksQ0FBQTs7QUFHOUIsSUFBQSxJQUFJLENBQUNDLHVCQUF1QixHQUFHTCxPQUFPLENBQUNNLEtBQUssQ0FBQTtJQUU1QyxJQUFJLENBQUNDLGdCQUFnQixFQUFFLENBQUE7O0lBR3ZCLElBQUksQ0FBQ0MsV0FBVyxHQUFHLEtBQUssQ0FBQTtBQUV4QixJQUFBLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUlDLEtBQUssSUFBSztNQUNsQ0EsS0FBSyxDQUFDQyxjQUFjLEVBQUUsQ0FBQTtNQUN0QixJQUFJLENBQUNILFdBQVcsR0FBRyxJQUFJLENBQUE7TUFDdkIsSUFBSSxDQUFDSSxXQUFXLEVBQUUsQ0FBQTtBQUNsQkMsTUFBQUEsS0FBSyxDQUFDL0UsR0FBRyxDQUFDLHdDQUF3QyxDQUFDLENBQUE7QUFDbkQsTUFBQSxJQUFJLENBQUNnRixJQUFJLENBQUMsWUFBWSxDQUFDLENBQUE7S0FDMUIsQ0FBQTtJQUVELElBQUksQ0FBQ0MsdUJBQXVCLEdBQUcsTUFBTTtBQUNqQ0YsTUFBQUEsS0FBSyxDQUFDL0UsR0FBRyxDQUFDLDRDQUE0QyxDQUFDLENBQUE7TUFDdkQsSUFBSSxDQUFDa0YsY0FBYyxFQUFFLENBQUE7TUFDckIsSUFBSSxDQUFDUixXQUFXLEdBQUcsS0FBSyxDQUFBO0FBQ3hCLE1BQUEsSUFBSSxDQUFDTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTtLQUM5QixDQUFBOztJQUdEZCxPQUFPLENBQUNpQixPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3RCLElBQUEsSUFBSSxDQUFDakIsT0FBTyxDQUFDa0IsZUFBZSxFQUFFO01BQzFCbEIsT0FBTyxDQUFDa0IsZUFBZSxHQUFHLGtCQUFrQixDQUFBO0FBQ2hELEtBQUE7O0lBR0EsTUFBTUMsRUFBRSxHQUFJLE9BQU9DLFNBQVMsS0FBSyxXQUFXLElBQUtBLFNBQVMsQ0FBQ0MsU0FBUyxDQUFBO0lBQ3BFLElBQUksQ0FBQ0MseUJBQXlCLEdBQUdILEVBQUUsSUFBSUEsRUFBRSxDQUFDSSxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUtKLEVBQUUsQ0FBQ0ksUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJSixFQUFFLENBQUNJLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFBO0lBQ2pILElBQUksSUFBSSxDQUFDRCx5QkFBeUIsRUFBRTtNQUNoQ3RCLE9BQU8sQ0FBQ3dCLFNBQVMsR0FBRyxLQUFLLENBQUE7QUFDekJYLE1BQUFBLEtBQUssQ0FBQy9FLEdBQUcsQ0FBQyw4RUFBOEUsQ0FBQyxDQUFBO0FBQzdGLEtBQUE7O0FBR0EsSUFBQSxNQUFNMkYsWUFBWSxHQUFJekIsT0FBTyxDQUFDeUIsWUFBWSxLQUFLQyxTQUFTLEdBQUkxQixPQUFPLENBQUN5QixZQUFZLEdBQUcsSUFBSSxDQUFBO0FBRXZGLElBQUEsTUFBTUUsS0FBSyxHQUFHRixZQUFZLEdBQUcsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsb0JBQW9CLENBQUMsQ0FBQTtJQUN4RyxJQUFJM0gsRUFBRSxHQUFHLElBQUksQ0FBQTtBQUNiLElBQUEsS0FBSyxJQUFJOEgsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxLQUFLLENBQUNFLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7TUFDbkM5SCxFQUFFLEdBQUdpRyxNQUFNLENBQUMrQixVQUFVLENBQUNILEtBQUssQ0FBQ0MsQ0FBQyxDQUFDLEVBQUU1QixPQUFPLENBQUMsQ0FBQTtBQUV6QyxNQUFBLElBQUlsRyxFQUFFLEVBQUU7UUFDSixJQUFJLENBQUNtRyxNQUFNLEdBQUkwQixLQUFLLENBQUNDLENBQUMsQ0FBQyxLQUFLLFFBQVMsQ0FBQTtBQUNyQyxRQUFBLE1BQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtJQUVBLElBQUksQ0FBQzlILEVBQUUsRUFBRTtBQUNMLE1BQUEsTUFBTSxJQUFJaUksS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUE7QUFDMUMsS0FBQTtJQUVBLE1BQU1DLFFBQVEsR0FBR0MsUUFBUSxDQUFDQyxPQUFPLElBQUksQ0FBQyxDQUFDQyxNQUFNLENBQUNDLE1BQU0sQ0FBQTtBQUNwRCxJQUFBLE1BQU1DLEtBQUssR0FBR0osUUFBUSxDQUFDQyxPQUFPLElBQUlkLFNBQVMsQ0FBQ2tCLFVBQVUsQ0FBQ0MsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFBO0lBRTVFLElBQUksQ0FBQ3pJLEVBQUUsR0FBR0EsRUFBRSxDQUFBOztJQUdaLElBQUksQ0FBQzBJLHNDQUFzQyxHQUFHUCxRQUFRLENBQUNDLE9BQU8sSUFBSSxDQUFDLENBQUNDLE1BQU0sQ0FBQ00sTUFBTSxDQUFBOztJQUdqRixJQUFJLENBQUNDLHVDQUF1QyxHQUFHTCxLQUFLLElBQUlMLFFBQVEsSUFBSSxDQUFDaEMsT0FBTyxDQUFDTSxLQUFLLENBQUE7O0FBR2xGLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ0wsTUFBTSxFQUFFO01BQ2QwQyxzQkFBc0IsQ0FBQzdJLEVBQUUsQ0FBQyxDQUFBO0FBQzlCLEtBQUE7SUFFQWlHLE1BQU0sQ0FBQzZDLGdCQUFnQixDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQ25DLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxDQUFBO0lBQzVFVixNQUFNLENBQUM2QyxnQkFBZ0IsQ0FBQyxzQkFBc0IsRUFBRSxJQUFJLENBQUM3Qix1QkFBdUIsRUFBRSxLQUFLLENBQUMsQ0FBQTtJQUVwRixJQUFJLENBQUM4QixvQkFBb0IsRUFBRSxDQUFBO0lBQzNCLElBQUksQ0FBQ0Msc0JBQXNCLEVBQUUsQ0FBQTtJQUM3QixJQUFJLENBQUNDLHFCQUFxQixFQUFFLENBQUE7SUFDNUIsSUFBSSxDQUFDQyx1QkFBdUIsRUFBRSxDQUFBOztJQUc5QixJQUFJLENBQUNDLG1CQUFtQixHQUFHLElBQUksQ0FBQTtBQUMvQixJQUFBLElBQUksT0FBT0MsV0FBVyxLQUFLLFdBQVcsRUFBRTtBQUNwQ3JFLE1BQUFBLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQ00sSUFBSSxDQUFFbkYsTUFBTSxJQUFLO1FBQ25DLElBQUksQ0FBQ2lKLG1CQUFtQixHQUFHakosTUFBTSxDQUFBO0FBQ3JDLE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQTtJQUVBLElBQUksQ0FBQ21KLG1CQUFtQixHQUFHO01BQ3ZCQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbkI1RixNQUFBQSxLQUFLLEVBQUUsQ0FBQztBQUNSeUQsTUFBQUEsT0FBTyxFQUFFLENBQUM7TUFDVm9DLEtBQUssRUFBRUMsZUFBZSxHQUFHQyxlQUFBQTtLQUM1QixDQUFBO0FBRUQsSUFBQSxJQUFJLENBQUNDLFNBQVMsR0FBRyxDQUNiMUosRUFBRSxDQUFDMkosTUFBTSxFQUNUM0osRUFBRSxDQUFDWSxhQUFhLEVBQ2hCWixFQUFFLENBQUM0SixlQUFlLENBQ3JCLENBQUE7SUFFRCxJQUFJLENBQUNDLGVBQWUsR0FBRyxDQUNuQjdKLEVBQUUsQ0FBQzhKLFFBQVEsRUFDWDlKLEVBQUUsQ0FBQytKLGFBQWEsRUFDaEIvSixFQUFFLENBQUNnSyxxQkFBcUIsRUFDeEIsSUFBSSxDQUFDN0QsTUFBTSxHQUFHbkcsRUFBRSxDQUFDaUssR0FBRyxHQUFHLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUksQ0FBQ0EsY0FBYyxDQUFDQyxPQUFPLEdBQUduSyxFQUFFLENBQUM4SixRQUFRLEVBQ3RGLElBQUksQ0FBQzNELE1BQU0sR0FBR25HLEVBQUUsQ0FBQ29LLEdBQUcsR0FBRyxJQUFJLENBQUNGLGNBQWMsR0FBRyxJQUFJLENBQUNBLGNBQWMsQ0FBQ0csT0FBTyxHQUFHckssRUFBRSxDQUFDOEosUUFBUSxDQUN6RixDQUFBO0FBRUQsSUFBQSxJQUFJLENBQUNRLGVBQWUsR0FBRyxDQUNuQnRLLEVBQUUsQ0FBQ3VLLElBQUksRUFDUHZLLEVBQUUsQ0FBQ3dLLEdBQUcsRUFDTnhLLEVBQUUsQ0FBQ3lLLFNBQVMsRUFDWnpLLEVBQUUsQ0FBQzBLLG1CQUFtQixFQUN0QjFLLEVBQUUsQ0FBQzJLLFNBQVMsRUFDWjNLLEVBQUUsQ0FBQzRLLG1CQUFtQixFQUN0QjVLLEVBQUUsQ0FBQzZLLFNBQVMsRUFDWjdLLEVBQUUsQ0FBQzhLLGtCQUFrQixFQUNyQjlLLEVBQUUsQ0FBQytLLG1CQUFtQixFQUN0Qi9LLEVBQUUsQ0FBQ2dMLFNBQVMsRUFDWmhMLEVBQUUsQ0FBQ2lMLG1CQUFtQixFQUN0QmpMLEVBQUUsQ0FBQ2tMLGNBQWMsRUFDakJsTCxFQUFFLENBQUNtTCx3QkFBd0IsRUFDM0JuTCxFQUFFLENBQUNvTCxjQUFjLEVBQ2pCcEwsRUFBRSxDQUFDcUwsd0JBQXdCLENBQzlCLENBQUE7QUFFRCxJQUFBLElBQUksQ0FBQ0MsWUFBWSxHQUFHLENBQ2hCdEwsRUFBRSxDQUFDdUwsS0FBSyxFQUNSdkwsRUFBRSxDQUFDd0wsSUFBSSxFQUNQeEwsRUFBRSxDQUFDeUwsS0FBSyxFQUNSekwsRUFBRSxDQUFDMEwsTUFBTSxFQUNUMUwsRUFBRSxDQUFDMkwsT0FBTyxFQUNWM0wsRUFBRSxDQUFDNEwsUUFBUSxFQUNYNUwsRUFBRSxDQUFDNkwsTUFBTSxFQUNUN0wsRUFBRSxDQUFDOEwsTUFBTSxDQUNaLENBQUE7QUFFRCxJQUFBLElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQ2YvTCxFQUFFLENBQUNnTSxJQUFJLEVBQ1BoTSxFQUFFLENBQUN1SyxJQUFJLEVBQ1B2SyxFQUFFLENBQUNpTSxPQUFPLEVBQ1ZqTSxFQUFFLENBQUNrTSxJQUFJLEVBQ1BsTSxFQUFFLENBQUNtTSxTQUFTLEVBQ1puTSxFQUFFLENBQUNvTSxJQUFJLEVBQ1BwTSxFQUFFLENBQUNxTSxTQUFTLEVBQ1pyTSxFQUFFLENBQUNzTSxNQUFNLENBQ1osQ0FBQTtJQUVELElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQ2YsQ0FBQyxFQUNEdk0sRUFBRSxDQUFDd00sZ0JBQWdCLEVBQ25CeE0sRUFBRSxDQUFDeU0sZ0JBQWdCLEVBQ25Cek0sRUFBRSxDQUFDd00sZ0JBQWdCLEdBQUd4TSxFQUFFLENBQUN5TSxnQkFBZ0IsRUFDekN6TSxFQUFFLENBQUMwTSxrQkFBa0IsRUFDckIxTSxFQUFFLENBQUMwTSxrQkFBa0IsR0FBRzFNLEVBQUUsQ0FBQ3dNLGdCQUFnQixFQUMzQ3hNLEVBQUUsQ0FBQzBNLGtCQUFrQixHQUFHMU0sRUFBRSxDQUFDeU0sZ0JBQWdCLEVBQzNDek0sRUFBRSxDQUFDME0sa0JBQWtCLEdBQUcxTSxFQUFFLENBQUN3TSxnQkFBZ0IsR0FBR3hNLEVBQUUsQ0FBQ3lNLGdCQUFnQixDQUNwRSxDQUFBO0FBRUQsSUFBQSxJQUFJLENBQUNFLE1BQU0sR0FBRyxDQUNWLENBQUMsRUFDRDNNLEVBQUUsQ0FBQzRNLElBQUksRUFDUDVNLEVBQUUsQ0FBQzZNLEtBQUssRUFDUjdNLEVBQUUsQ0FBQzhNLGNBQWMsQ0FDcEIsQ0FBQTtJQUVELElBQUksQ0FBQ0MsUUFBUSxHQUFHLENBQ1ovTSxFQUFFLENBQUNTLE9BQU8sRUFDVlQsRUFBRSxDQUFDZ04sTUFBTSxFQUNUaE4sRUFBRSxDQUFDaU4sc0JBQXNCLEVBQ3pCak4sRUFBRSxDQUFDa04scUJBQXFCLEVBQ3hCbE4sRUFBRSxDQUFDbU4scUJBQXFCLEVBQ3hCbk4sRUFBRSxDQUFDb04sb0JBQW9CLENBQzFCLENBQUE7QUFFRCxJQUFBLElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQ2ZyTixFQUFFLENBQUNzTixNQUFNLEVBQ1R0TixFQUFFLENBQUN1TixLQUFLLEVBQ1J2TixFQUFFLENBQUN3TixTQUFTLEVBQ1p4TixFQUFFLENBQUN5TixVQUFVLEVBQ2J6TixFQUFFLENBQUMwTixTQUFTLEVBQ1oxTixFQUFFLENBQUMyTixjQUFjLEVBQ2pCM04sRUFBRSxDQUFDNE4sWUFBWSxDQUNsQixDQUFBO0FBRUQsSUFBQSxJQUFJLENBQUNDLE1BQU0sR0FBRyxDQUNWN04sRUFBRSxDQUFDOE4sSUFBSSxFQUNQOU4sRUFBRSxDQUFDMkYsYUFBYSxFQUNoQjNGLEVBQUUsQ0FBQytOLEtBQUssRUFDUi9OLEVBQUUsQ0FBQ2dPLGNBQWMsRUFDakJoTyxFQUFFLENBQUNpTyxHQUFHLEVBQ05qTyxFQUFFLENBQUNrTyxZQUFZLEVBQ2ZsTyxFQUFFLENBQUNtTyxLQUFLLENBQ1gsQ0FBQTtBQUVELElBQUEsSUFBSSxDQUFDQyxhQUFhLEdBQUcsRUFBRSxDQUFBO0lBQ3ZCLElBQUksQ0FBQ0EsYUFBYSxDQUFDcE8sRUFBRSxDQUFDcU8sSUFBSSxDQUFDLEdBQVdDLGdCQUFnQixDQUFBO0lBQ3RELElBQUksQ0FBQ0YsYUFBYSxDQUFDcE8sRUFBRSxDQUFDaU8sR0FBRyxDQUFDLEdBQVlNLGVBQWUsQ0FBQTtJQUNyRCxJQUFJLENBQUNILGFBQWEsQ0FBQ3BPLEVBQUUsQ0FBQ21PLEtBQUssQ0FBQyxHQUFVSyxpQkFBaUIsQ0FBQTtJQUN2RCxJQUFJLENBQUNKLGFBQWEsQ0FBQ3BPLEVBQUUsQ0FBQ3lPLFVBQVUsQ0FBQyxHQUFLQyxnQkFBZ0IsQ0FBQTtJQUN0RCxJQUFJLENBQUNOLGFBQWEsQ0FBQ3BPLEVBQUUsQ0FBQzJPLFVBQVUsQ0FBQyxHQUFLQyxnQkFBZ0IsQ0FBQTtJQUN0RCxJQUFJLENBQUNSLGFBQWEsQ0FBQ3BPLEVBQUUsQ0FBQzZPLFVBQVUsQ0FBQyxHQUFLQyxnQkFBZ0IsQ0FBQTtJQUN0RCxJQUFJLENBQUNWLGFBQWEsQ0FBQ3BPLEVBQUUsQ0FBQytPLFFBQVEsQ0FBQyxHQUFPQyxpQkFBaUIsQ0FBQTtJQUN2RCxJQUFJLENBQUNaLGFBQWEsQ0FBQ3BPLEVBQUUsQ0FBQ2lQLFFBQVEsQ0FBQyxHQUFPQyxpQkFBaUIsQ0FBQTtJQUN2RCxJQUFJLENBQUNkLGFBQWEsQ0FBQ3BPLEVBQUUsQ0FBQ21QLFFBQVEsQ0FBQyxHQUFPQyxpQkFBaUIsQ0FBQTtJQUN2RCxJQUFJLENBQUNoQixhQUFhLENBQUNwTyxFQUFFLENBQUNxUCxTQUFTLENBQUMsR0FBTUMsaUJBQWlCLENBQUE7SUFDdkQsSUFBSSxDQUFDbEIsYUFBYSxDQUFDcE8sRUFBRSxDQUFDdVAsU0FBUyxDQUFDLEdBQU1DLGlCQUFpQixDQUFBO0lBQ3ZELElBQUksQ0FBQ3BCLGFBQWEsQ0FBQ3BPLEVBQUUsQ0FBQ3lQLFNBQVMsQ0FBQyxHQUFNQyxpQkFBaUIsQ0FBQTtJQUN2RCxJQUFJLENBQUN0QixhQUFhLENBQUNwTyxFQUFFLENBQUMyUCxVQUFVLENBQUMsR0FBS0MsZ0JBQWdCLENBQUE7SUFDdEQsSUFBSSxDQUFDeEIsYUFBYSxDQUFDcE8sRUFBRSxDQUFDNlAsVUFBVSxDQUFDLEdBQUtDLGdCQUFnQixDQUFBO0lBQ3RELElBQUksQ0FBQzFCLGFBQWEsQ0FBQ3BPLEVBQUUsQ0FBQytQLFVBQVUsQ0FBQyxHQUFLQyxnQkFBZ0IsQ0FBQTtJQUN0RCxJQUFJLENBQUM1QixhQUFhLENBQUNwTyxFQUFFLENBQUNpUSxVQUFVLENBQUMsR0FBS0MscUJBQXFCLENBQUE7SUFDM0QsSUFBSSxDQUFDOUIsYUFBYSxDQUFDcE8sRUFBRSxDQUFDbVEsWUFBWSxDQUFDLEdBQUdDLHVCQUF1QixDQUFBO0lBQzdELElBQUksSUFBSSxDQUFDakssTUFBTSxFQUFFO01BQ2IsSUFBSSxDQUFDaUksYUFBYSxDQUFDcE8sRUFBRSxDQUFDcVEsaUJBQWlCLENBQUMsR0FBS0MsNEJBQTRCLENBQUE7TUFDekUsSUFBSSxDQUFDbEMsYUFBYSxDQUFDcE8sRUFBRSxDQUFDdVEsbUJBQW1CLENBQUMsR0FBR0MsOEJBQThCLENBQUE7TUFDM0UsSUFBSSxDQUFDcEMsYUFBYSxDQUFDcE8sRUFBRSxDQUFDeVEsVUFBVSxDQUFDLEdBQVlDLHFCQUFxQixDQUFBO0FBQ3RFLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ0MsWUFBWSxHQUFHLEVBQUUsQ0FBQTtJQUN0QixJQUFJLENBQUNBLFlBQVksQ0FBQzNRLEVBQUUsQ0FBQ00sVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQ3BDLElBQUksQ0FBQ3FRLFlBQVksQ0FBQzNRLEVBQUUsQ0FBQzRRLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQzFDLElBQUksQ0FBQ0QsWUFBWSxDQUFDM1EsRUFBRSxDQUFDNlEsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFBOztBQUdwQyxJQUFBLElBQUlDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxNQUFNLEVBQUVDLE1BQU0sQ0FBQTtBQUNsQyxJQUFBLElBQUlDLFlBQVksQ0FBQTtJQUNoQixJQUFJLENBQUNDLGNBQWMsR0FBRyxFQUFFLENBQUE7SUFDeEIsSUFBSSxDQUFDQSxjQUFjLENBQUM3QyxnQkFBZ0IsQ0FBQyxHQUFHLFVBQVU4QyxPQUFPLEVBQUVDLEtBQUssRUFBRTtBQUM5RCxNQUFBLElBQUlELE9BQU8sQ0FBQ0MsS0FBSyxLQUFLQSxLQUFLLEVBQUU7UUFDekJyUixFQUFFLENBQUNzUixTQUFTLENBQUNGLE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtRQUN2Q0QsT0FBTyxDQUFDQyxLQUFLLEdBQUdBLEtBQUssQ0FBQTtBQUN6QixPQUFBO0tBQ0gsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDNUMsZUFBZSxDQUFDLEdBQUcsSUFBSSxDQUFDNEMsY0FBYyxDQUFDN0MsZ0JBQWdCLENBQUMsQ0FBQTtJQUM1RSxJQUFJLENBQUM2QyxjQUFjLENBQUMzQyxpQkFBaUIsQ0FBQyxHQUFHLFVBQVU0QyxPQUFPLEVBQUVDLEtBQUssRUFBRTtBQUMvRCxNQUFBLElBQUlELE9BQU8sQ0FBQ0MsS0FBSyxLQUFLQSxLQUFLLEVBQUU7UUFDekJyUixFQUFFLENBQUN3UixTQUFTLENBQUNKLE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtRQUN2Q0QsT0FBTyxDQUFDQyxLQUFLLEdBQUdBLEtBQUssQ0FBQTtBQUN6QixPQUFBO0tBQ0gsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDekMsZ0JBQWdCLENBQUMsR0FBSSxVQUFVMEMsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDL0RILFlBQVksR0FBR0UsT0FBTyxDQUFDQyxLQUFLLENBQUE7QUFDNUJQLE1BQUFBLE1BQU0sR0FBR08sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCTixNQUFBQSxNQUFNLEdBQUdNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQixNQUFBLElBQUlILFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0osTUFBTSxJQUFJSSxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtILE1BQU0sRUFBRTtRQUMxRC9RLEVBQUUsQ0FBQ3lSLFVBQVUsQ0FBQ0wsT0FBTyxDQUFDRyxVQUFVLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0FBQ3hDSCxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdKLE1BQU0sQ0FBQTtBQUN4QkksUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSCxNQUFNLENBQUE7QUFDNUIsT0FBQTtLQUNILENBQUE7SUFDRCxJQUFJLENBQUNJLGNBQWMsQ0FBQ3ZDLGdCQUFnQixDQUFDLEdBQUksVUFBVXdDLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQy9ESCxZQUFZLEdBQUdFLE9BQU8sQ0FBQ0MsS0FBSyxDQUFBO0FBQzVCUCxNQUFBQSxNQUFNLEdBQUdPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQk4sTUFBQUEsTUFBTSxHQUFHTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJMLE1BQUFBLE1BQU0sR0FBR0ssS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO01BQ2pCLElBQUlILFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0osTUFBTSxJQUFJSSxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtILE1BQU0sSUFBSUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLRixNQUFNLEVBQUU7UUFDeEZoUixFQUFFLENBQUMwUixVQUFVLENBQUNOLE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtBQUN4Q0gsUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSixNQUFNLENBQUE7QUFDeEJJLFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0gsTUFBTSxDQUFBO0FBQ3hCRyxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdGLE1BQU0sQ0FBQTtBQUM1QixPQUFBO0tBQ0gsQ0FBQTtJQUNELElBQUksQ0FBQ0csY0FBYyxDQUFDckMsZ0JBQWdCLENBQUMsR0FBSSxVQUFVc0MsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDL0RILFlBQVksR0FBR0UsT0FBTyxDQUFDQyxLQUFLLENBQUE7QUFDNUJQLE1BQUFBLE1BQU0sR0FBR08sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCTixNQUFBQSxNQUFNLEdBQUdNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQkwsTUFBQUEsTUFBTSxHQUFHSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJKLE1BQUFBLE1BQU0sR0FBR0ksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO01BQ2pCLElBQUlILFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0osTUFBTSxJQUFJSSxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtILE1BQU0sSUFBSUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLRixNQUFNLElBQUlFLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0QsTUFBTSxFQUFFO1FBQ3RIalIsRUFBRSxDQUFDMlIsVUFBVSxDQUFDUCxPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7QUFDeENILFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0osTUFBTSxDQUFBO0FBQ3hCSSxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdILE1BQU0sQ0FBQTtBQUN4QkcsUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHRixNQUFNLENBQUE7QUFDeEJFLFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0QsTUFBTSxDQUFBO0FBQzVCLE9BQUE7S0FDSCxDQUFBO0lBQ0QsSUFBSSxDQUFDRSxjQUFjLENBQUNuQyxpQkFBaUIsQ0FBQyxHQUFHLFVBQVVvQyxPQUFPLEVBQUVDLEtBQUssRUFBRTtNQUMvREgsWUFBWSxHQUFHRSxPQUFPLENBQUNDLEtBQUssQ0FBQTtBQUM1QlAsTUFBQUEsTUFBTSxHQUFHTyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJOLE1BQUFBLE1BQU0sR0FBR00sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCLE1BQUEsSUFBSUgsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLSixNQUFNLElBQUlJLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0gsTUFBTSxFQUFFO1FBQzFEL1EsRUFBRSxDQUFDNFIsVUFBVSxDQUFDUixPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7QUFDeENILFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0osTUFBTSxDQUFBO0FBQ3hCSSxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdILE1BQU0sQ0FBQTtBQUM1QixPQUFBO0tBQ0gsQ0FBQTtJQUNELElBQUksQ0FBQ0ksY0FBYyxDQUFDN0IsaUJBQWlCLENBQUMsR0FBRyxJQUFJLENBQUM2QixjQUFjLENBQUNuQyxpQkFBaUIsQ0FBQyxDQUFBO0lBQy9FLElBQUksQ0FBQ21DLGNBQWMsQ0FBQ2pDLGlCQUFpQixDQUFDLEdBQUcsVUFBVWtDLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQy9ESCxZQUFZLEdBQUdFLE9BQU8sQ0FBQ0MsS0FBSyxDQUFBO0FBQzVCUCxNQUFBQSxNQUFNLEdBQUdPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQk4sTUFBQUEsTUFBTSxHQUFHTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJMLE1BQUFBLE1BQU0sR0FBR0ssS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO01BQ2pCLElBQUlILFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0osTUFBTSxJQUFJSSxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtILE1BQU0sSUFBSUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLRixNQUFNLEVBQUU7UUFDeEZoUixFQUFFLENBQUM2UixVQUFVLENBQUNULE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtBQUN4Q0gsUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSixNQUFNLENBQUE7QUFDeEJJLFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0gsTUFBTSxDQUFBO0FBQ3hCRyxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdGLE1BQU0sQ0FBQTtBQUM1QixPQUFBO0tBQ0gsQ0FBQTtJQUNELElBQUksQ0FBQ0csY0FBYyxDQUFDM0IsaUJBQWlCLENBQUMsR0FBRyxJQUFJLENBQUMyQixjQUFjLENBQUNqQyxpQkFBaUIsQ0FBQyxDQUFBO0lBQy9FLElBQUksQ0FBQ2lDLGNBQWMsQ0FBQy9CLGlCQUFpQixDQUFDLEdBQUcsVUFBVWdDLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQy9ESCxZQUFZLEdBQUdFLE9BQU8sQ0FBQ0MsS0FBSyxDQUFBO0FBQzVCUCxNQUFBQSxNQUFNLEdBQUdPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNqQk4sTUFBQUEsTUFBTSxHQUFHTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDakJMLE1BQUFBLE1BQU0sR0FBR0ssS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pCSixNQUFBQSxNQUFNLEdBQUdJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQTtNQUNqQixJQUFJSCxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtKLE1BQU0sSUFBSUksWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLSCxNQUFNLElBQUlHLFlBQVksQ0FBQyxDQUFDLENBQUMsS0FBS0YsTUFBTSxJQUFJRSxZQUFZLENBQUMsQ0FBQyxDQUFDLEtBQUtELE1BQU0sRUFBRTtRQUN0SGpSLEVBQUUsQ0FBQzhSLFVBQVUsQ0FBQ1YsT0FBTyxDQUFDRyxVQUFVLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0FBQ3hDSCxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdKLE1BQU0sQ0FBQTtBQUN4QkksUUFBQUEsWUFBWSxDQUFDLENBQUMsQ0FBQyxHQUFHSCxNQUFNLENBQUE7QUFDeEJHLFFBQUFBLFlBQVksQ0FBQyxDQUFDLENBQUMsR0FBR0YsTUFBTSxDQUFBO0FBQ3hCRSxRQUFBQSxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUdELE1BQU0sQ0FBQTtBQUM1QixPQUFBO0tBQ0gsQ0FBQTtJQUNELElBQUksQ0FBQ0UsY0FBYyxDQUFDekIsaUJBQWlCLENBQUMsR0FBRyxJQUFJLENBQUN5QixjQUFjLENBQUMvQixpQkFBaUIsQ0FBQyxDQUFBO0lBQy9FLElBQUksQ0FBQytCLGNBQWMsQ0FBQ3ZCLGdCQUFnQixDQUFDLEdBQUksVUFBVXdCLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQy9EclIsRUFBRSxDQUFDK1IsZ0JBQWdCLENBQUNYLE9BQU8sQ0FBQ0csVUFBVSxFQUFFLEtBQUssRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDeEQsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDckIsZ0JBQWdCLENBQUMsR0FBSSxVQUFVc0IsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDL0RyUixFQUFFLENBQUNnUyxnQkFBZ0IsQ0FBQ1osT0FBTyxDQUFDRyxVQUFVLEVBQUUsS0FBSyxFQUFFRixLQUFLLENBQUMsQ0FBQTtLQUN4RCxDQUFBO0lBQ0QsSUFBSSxDQUFDRixjQUFjLENBQUNuQixnQkFBZ0IsQ0FBQyxHQUFJLFVBQVVvQixPQUFPLEVBQUVDLEtBQUssRUFBRTtNQUMvRHJSLEVBQUUsQ0FBQ2lTLGdCQUFnQixDQUFDYixPQUFPLENBQUNHLFVBQVUsRUFBRSxLQUFLLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0tBQ3hELENBQUE7SUFDRCxJQUFJLENBQUNGLGNBQWMsQ0FBQ2Usc0JBQXNCLENBQUMsR0FBRyxVQUFVZCxPQUFPLEVBQUVDLEtBQUssRUFBRTtNQUNwRXJSLEVBQUUsQ0FBQ21TLFVBQVUsQ0FBQ2YsT0FBTyxDQUFDRyxVQUFVLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0tBQzNDLENBQUE7SUFDRCxJQUFJLENBQUNGLGNBQWMsQ0FBQ2lCLHFCQUFxQixDQUFDLEdBQUksVUFBVWhCLE9BQU8sRUFBRUMsS0FBSyxFQUFFO01BQ3BFclIsRUFBRSxDQUFDeVIsVUFBVSxDQUFDTCxPQUFPLENBQUNHLFVBQVUsRUFBRUYsS0FBSyxDQUFDLENBQUE7S0FDM0MsQ0FBQTtJQUNELElBQUksQ0FBQ0YsY0FBYyxDQUFDa0IscUJBQXFCLENBQUMsR0FBSSxVQUFVakIsT0FBTyxFQUFFQyxLQUFLLEVBQUU7TUFDcEVyUixFQUFFLENBQUMwUixVQUFVLENBQUNOLE9BQU8sQ0FBQ0csVUFBVSxFQUFFRixLQUFLLENBQUMsQ0FBQTtLQUMzQyxDQUFBO0lBQ0QsSUFBSSxDQUFDRixjQUFjLENBQUNtQixxQkFBcUIsQ0FBQyxHQUFJLFVBQVVsQixPQUFPLEVBQUVDLEtBQUssRUFBRTtNQUNwRXJSLEVBQUUsQ0FBQzJSLFVBQVUsQ0FBQ1AsT0FBTyxDQUFDRyxVQUFVLEVBQUVGLEtBQUssQ0FBQyxDQUFBO0tBQzNDLENBQUE7SUFFRCxJQUFJLENBQUNrQixvQkFBb0IsR0FBRyxJQUFJLENBQUNDLGVBQWUsSUFBSSxJQUFJLENBQUNDLGlCQUFpQixHQUFHLENBQUMsQ0FBQTs7QUFPOUUsSUFBQSxJQUFJQyxXQUFXLEdBQUcsSUFBSSxDQUFDQyxtQkFBbUIsQ0FBQTtJQUMxQ0QsV0FBVyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUE7QUFDcEJBLElBQUFBLFdBQVcsSUFBSSxDQUFDLENBQUE7QUFDaEJBLElBQUFBLFdBQVcsSUFBSSxDQUFDLENBQUE7SUFDaEJBLFdBQVcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFBO0lBQ3BCLElBQUksQ0FBQ0UsU0FBUyxHQUFHQyxJQUFJLENBQUNDLEtBQUssQ0FBQ0osV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFBOztBQUs1QyxJQUFBLElBQUksQ0FBQ0UsU0FBUyxHQUFHQyxJQUFJLENBQUNFLEdBQUcsQ0FBQyxJQUFJLENBQUNILFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQTtBQUU5QyxJQUFBLElBQUksSUFBSSxDQUFDSSxnQkFBZ0IsS0FBSyxhQUFhLEVBQUU7TUFDekMsSUFBSSxDQUFDSixTQUFTLEdBQUcsRUFBRSxDQUFBO0FBQ3ZCLEtBQUE7SUFFQSxJQUFJLENBQUM3TyxpQkFBaUIsR0FBRyxJQUFJLENBQUNrUCxLQUFLLENBQUNDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQTtJQUVyRCxJQUFJLElBQUksQ0FBQ1YsZUFBZSxFQUFFO01BQ3RCLElBQUksSUFBSSxDQUFDck0sTUFBTSxFQUFFO0FBRWIsUUFBQSxJQUFJLENBQUNoRSxzQkFBc0IsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDZ1IsbUJBQW1CLENBQUE7QUFDNUQsT0FBQyxNQUFNO1FBRUgsSUFBSSxDQUFDaFIsc0JBQXNCLEdBQUdwQyxjQUFjLENBQUNDLEVBQUUsRUFBRUEsRUFBRSxDQUFDbU8sS0FBSyxDQUFDLENBQUE7QUFDOUQsT0FBQTtBQUNKLEtBQUMsTUFBTTtNQUNILElBQUksQ0FBQ2hNLHNCQUFzQixHQUFHLEtBQUssQ0FBQTtBQUN2QyxLQUFBOztJQUdBLElBQUksSUFBSSxDQUFDaVIsdUJBQXVCLEVBQUU7QUFDOUIsTUFBQSxJQUFJLENBQUNDLDBCQUEwQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUNELHVCQUF1QixDQUFBO0FBQ3BFLEtBQUMsTUFBTSxJQUFJLElBQUksQ0FBQ0UsbUJBQW1CLEVBQUU7TUFDakMsSUFBSSxJQUFJLENBQUNuTixNQUFNLEVBQUU7QUFFYixRQUFBLElBQUksQ0FBQ2tOLDBCQUEwQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUNGLG1CQUFtQixDQUFBO0FBQ2hFLE9BQUMsTUFBTTtBQUVILFFBQUEsSUFBSSxDQUFDRSwwQkFBMEIsR0FBR3RULGNBQWMsQ0FBQ0MsRUFBRSxFQUFFLElBQUksQ0FBQ3NULG1CQUFtQixDQUFDQyxjQUFjLENBQUMsQ0FBQTtBQUNqRyxPQUFBO0FBQ0osS0FBQyxNQUFNO01BQ0gsSUFBSSxDQUFDRiwwQkFBMEIsR0FBRyxLQUFLLENBQUE7QUFDM0MsS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDRywrQkFBK0IsR0FBSSxJQUFJLENBQUNDLFlBQVksS0FBSyxPQUFPLElBQUksSUFBSSxDQUFDaEIsaUJBQWlCLElBQUksQ0FBRSxDQUFBO0lBRXJHLElBQUksQ0FBQ2lCLDBCQUEwQixHQUFHOUwsU0FBUyxDQUFBO0lBQzNDLElBQUksQ0FBQytMLDBCQUEwQixHQUFHL0wsU0FBUyxDQUFBO0lBRzNDLElBQUksQ0FBQ2dNLGVBQWUsR0FBRyxFQUFFLENBQUE7SUFDekIsSUFBSSxDQUFDQyxxQkFBcUIsR0FBRyxFQUFFLENBQUE7O0lBSS9CLElBQUksQ0FBQ0Msa0JBQWtCLEdBQUdsUSx1QkFBdUIsQ0FBQTtJQUNqRCxJQUFJLElBQUksQ0FBQzBQLG1CQUFtQixJQUFJLElBQUksQ0FBQ1MseUJBQXlCLElBQUksSUFBSSxDQUFDQyx5QkFBeUIsRUFBRTtNQUM5RixJQUFJLENBQUNGLGtCQUFrQixHQUFHRyxtQkFBbUIsQ0FBQTtLQUNoRCxNQUFNLElBQUksSUFBSSxDQUFDekIsZUFBZSxJQUFJLElBQUksQ0FBQzBCLHFCQUFxQixFQUFFO01BQzNELElBQUksQ0FBQ0osa0JBQWtCLEdBQUdoUixtQkFBbUIsQ0FBQTtBQUNqRCxLQUFBO0FBQ0osR0FBQTs7QUFLQWdDLEVBQUFBLE9BQU8sR0FBRztJQUNOLEtBQUssQ0FBQ0EsT0FBTyxFQUFFLENBQUE7QUFDZixJQUFBLE1BQU05RSxFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7QUFFbEIsSUFBQSxJQUFJLElBQUksQ0FBQ21HLE1BQU0sSUFBSSxJQUFJLENBQUNnTyxRQUFRLEVBQUU7QUFDOUJuVSxNQUFBQSxFQUFFLENBQUNvVSx1QkFBdUIsQ0FBQyxJQUFJLENBQUNELFFBQVEsQ0FBQyxDQUFBO0FBQzdDLEtBQUE7SUFFQSxJQUFJLENBQUNFLGdCQUFnQixFQUFFLENBQUE7SUFDdkIsSUFBSSxDQUFDQywyQkFBMkIsRUFBRSxDQUFBO0FBRWxDLElBQUEsSUFBSSxDQUFDck8sTUFBTSxDQUFDc08sbUJBQW1CLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDNU4sbUJBQW1CLEVBQUUsS0FBSyxDQUFDLENBQUE7QUFDcEYsSUFBQSxJQUFJLENBQUNWLE1BQU0sQ0FBQ3NPLG1CQUFtQixDQUFDLHNCQUFzQixFQUFFLElBQUksQ0FBQ3ROLHVCQUF1QixFQUFFLEtBQUssQ0FBQyxDQUFBO0lBRTVGLElBQUksQ0FBQ04sbUJBQW1CLEdBQUcsSUFBSSxDQUFBO0lBQy9CLElBQUksQ0FBQ00sdUJBQXVCLEdBQUcsSUFBSSxDQUFBO0lBRW5DLElBQUksQ0FBQ2pILEVBQUUsR0FBRyxJQUFJLENBQUE7SUFFZCxLQUFLLENBQUN3VSxXQUFXLEVBQUUsQ0FBQTtBQUN2QixHQUFBOztBQUdBQyxFQUFBQSxzQkFBc0IsQ0FBQ0MsWUFBWSxFQUFFN1IsTUFBTSxFQUFFO0lBQ3pDLE9BQU8sSUFBSThSLGlCQUFpQixFQUFFLENBQUE7QUFDbEMsR0FBQTs7RUFHQUMscUJBQXFCLENBQUNDLFdBQVcsRUFBRTtBQUMvQixJQUFBLE9BQU8sSUFBSUMsZ0JBQWdCLENBQUNELFdBQVcsQ0FBQyxDQUFBO0FBQzVDLEdBQUE7RUFFQUUsZ0JBQWdCLENBQUNDLE1BQU0sRUFBRTtBQUNyQixJQUFBLE9BQU8sSUFBSUMsV0FBVyxDQUFDRCxNQUFNLENBQUMsQ0FBQTtBQUNsQyxHQUFBO0VBRUFFLGlCQUFpQixDQUFDL1UsT0FBTyxFQUFFO0lBQ3ZCLE9BQU8sSUFBSWdWLFlBQVksRUFBRSxDQUFBO0FBQzdCLEdBQUE7RUFFQUMsc0JBQXNCLENBQUNDLFlBQVksRUFBRTtJQUNqQyxPQUFPLElBQUlDLGlCQUFpQixFQUFFLENBQUE7QUFDbEMsR0FBQTtBQUdBQyxFQUFBQSxZQUFZLEdBQUc7QUFDWCxJQUFBLElBQUksQ0FBQzFCLHFCQUFxQixHQUFHLElBQUksQ0FBQ0QsZUFBZSxDQUFDNEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQTtBQUN6RSxHQUFBO0VBRUFDLFVBQVUsQ0FBQ2pULElBQUksRUFBRTtJQUNiLElBQUk2RixNQUFNLENBQUNxTixPQUFPLEVBQUU7QUFDaEIsTUFBQSxJQUFJLENBQUM5QixlQUFlLENBQUMrQixJQUFJLENBQUNuVCxJQUFJLENBQUMsQ0FBQTtNQUMvQixJQUFJLENBQUMrUyxZQUFZLEVBQUUsQ0FBQTtNQUNuQmxOLE1BQU0sQ0FBQ3FOLE9BQU8sQ0FBQ0UsU0FBUyxDQUFDLElBQUksQ0FBQy9CLHFCQUFxQixDQUFDLENBQUE7QUFDeEQsS0FBQTtBQUNKLEdBQUE7QUFFQWdDLEVBQUFBLFNBQVMsR0FBRztJQUNSLElBQUl4TixNQUFNLENBQUNxTixPQUFPLEVBQUU7QUFDaEIsTUFBQSxJQUFJLElBQUksQ0FBQzlCLGVBQWUsQ0FBQzdMLE1BQU0sRUFBRTtBQUM3QixRQUFBLElBQUksQ0FBQzZMLGVBQWUsQ0FBQ2tDLEdBQUcsRUFBRSxDQUFBO1FBQzFCLElBQUksQ0FBQ1AsWUFBWSxFQUFFLENBQUE7UUFFbkIsSUFBSSxJQUFJLENBQUMzQixlQUFlLENBQUM3TCxNQUFNLEVBQzNCTSxNQUFNLENBQUNxTixPQUFPLENBQUNFLFNBQVMsQ0FBQyxJQUFJLENBQUMvQixxQkFBcUIsQ0FBQyxDQUFDLEtBRXJEeEwsTUFBTSxDQUFDcU4sT0FBTyxDQUFDSyxXQUFXLEVBQUUsQ0FBQTtBQUNwQyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBV0FDLEVBQUFBLFlBQVksR0FBRztBQUNYLElBQUEsTUFBTWhXLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtJQUNsQixJQUFJaVcsU0FBUyxHQUFHLE9BQU8sQ0FBQTtJQUV2QixJQUFJalcsRUFBRSxDQUFDa1csd0JBQXdCLEVBQUU7QUFDN0IsTUFBQSxNQUFNQywrQkFBK0IsR0FBR25XLEVBQUUsQ0FBQ2tXLHdCQUF3QixDQUFDbFcsRUFBRSxDQUFDb1csYUFBYSxFQUFFcFcsRUFBRSxDQUFDcVcsVUFBVSxDQUFDLENBQUE7QUFDcEcsTUFBQSxNQUFNQyxpQ0FBaUMsR0FBR3RXLEVBQUUsQ0FBQ2tXLHdCQUF3QixDQUFDbFcsRUFBRSxDQUFDb1csYUFBYSxFQUFFcFcsRUFBRSxDQUFDdVcsWUFBWSxDQUFDLENBQUE7QUFFeEcsTUFBQSxNQUFNQyxpQ0FBaUMsR0FBR3hXLEVBQUUsQ0FBQ2tXLHdCQUF3QixDQUFDbFcsRUFBRSxDQUFDeVcsZUFBZSxFQUFFelcsRUFBRSxDQUFDcVcsVUFBVSxDQUFDLENBQUE7QUFDeEcsTUFBQSxNQUFNSyxtQ0FBbUMsR0FBRzFXLEVBQUUsQ0FBQ2tXLHdCQUF3QixDQUFDbFcsRUFBRSxDQUFDeVcsZUFBZSxFQUFFelcsRUFBRSxDQUFDdVcsWUFBWSxDQUFDLENBQUE7QUFFNUcsTUFBQSxNQUFNSSxjQUFjLEdBQUdSLCtCQUErQixDQUFDRixTQUFTLEdBQUcsQ0FBQyxJQUFJTyxpQ0FBaUMsQ0FBQ1AsU0FBUyxHQUFHLENBQUMsQ0FBQTtBQUN2SCxNQUFBLE1BQU1XLGdCQUFnQixHQUFHTixpQ0FBaUMsQ0FBQ0wsU0FBUyxHQUFHLENBQUMsSUFBSVMsbUNBQW1DLENBQUNULFNBQVMsR0FBRyxDQUFDLENBQUE7TUFFN0gsSUFBSSxDQUFDVSxjQUFjLEVBQUU7QUFDakIsUUFBQSxJQUFJQyxnQkFBZ0IsRUFBRTtBQUNsQlgsVUFBQUEsU0FBUyxHQUFHLFNBQVMsQ0FBQTtBQUNyQmxQLFVBQUFBLEtBQUssQ0FBQzhQLElBQUksQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFBO0FBQzdELFNBQUMsTUFBTTtBQUNIWixVQUFBQSxTQUFTLEdBQUcsTUFBTSxDQUFBO0FBQ2xCbFAsVUFBQUEsS0FBSyxDQUFDOFAsSUFBSSxDQUFDLHNEQUFzRCxDQUFDLENBQUE7QUFDdEUsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPWixTQUFTLENBQUE7QUFDcEIsR0FBQTs7QUFPQWxOLEVBQUFBLG9CQUFvQixHQUFHO0FBQ25CLElBQUEsTUFBTS9JLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQixJQUFBLE1BQU04VyxtQkFBbUIsR0FBRzlXLEVBQUUsQ0FBQytXLHNCQUFzQixFQUFFLENBQUE7QUFFdkQsSUFBQSxNQUFNQyxZQUFZLEdBQUcsU0FBZkEsWUFBWSxHQUFlO0FBQzdCLE1BQUEsS0FBSyxJQUFJbFAsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHbVAsU0FBUyxDQUFDbFAsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUN2QyxRQUFBLElBQUlnUCxtQkFBbUIsQ0FBQ3JPLE9BQU8sQ0FBQ3dPLFNBQVMsQ0FBQ25QLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7VUFDbEQsT0FBTzlILEVBQUUsQ0FBQ2dYLFlBQVksQ0FBQ0MsU0FBUyxDQUFDblAsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN4QyxTQUFBO0FBQ0osT0FBQTtBQUNBLE1BQUEsT0FBTyxJQUFJLENBQUE7S0FDZCxDQUFBO0lBRUQsSUFBSSxJQUFJLENBQUMzQixNQUFNLEVBQUU7TUFDYixJQUFJLENBQUMrRCxjQUFjLEdBQUcsSUFBSSxDQUFBO01BQzFCLElBQUksQ0FBQ2dOLGNBQWMsR0FBRyxJQUFJLENBQUE7TUFDMUIsSUFBSSxDQUFDQyxhQUFhLEdBQUcsSUFBSSxDQUFBO01BQ3pCLElBQUksQ0FBQ0Msc0JBQXNCLEdBQUcsSUFBSSxDQUFBO01BQ2xDLElBQUksQ0FBQzVFLGVBQWUsR0FBRyxJQUFJLENBQUE7TUFDM0IsSUFBSSxDQUFDYyxtQkFBbUIsR0FBRyxJQUFJLENBQUE7TUFDL0IsSUFBSSxDQUFDK0QsYUFBYSxHQUFHLElBQUksQ0FBQTtNQUN6QixJQUFJLENBQUNDLGNBQWMsR0FBRyxJQUFJLENBQUE7TUFDMUIsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxJQUFJLENBQUE7QUFDaEMsTUFBQSxJQUFJLENBQUNwRSxtQkFBbUIsR0FBRzZELFlBQVksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFBO01BR2pFLElBQUksQ0FBQ1EscUJBQXFCLEdBQUdSLFlBQVksQ0FBQyxpQ0FBaUMsRUFBRSwwQkFBMEIsQ0FBQyxDQUFBO01BQ3hHLElBQUksQ0FBQ1MsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUMvQixLQUFDLE1BQU07QUFDSCxNQUFBLElBQUksQ0FBQ3ZOLGNBQWMsR0FBRzhNLFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFBO0FBQ3RELE1BQUEsSUFBSSxDQUFDRSxjQUFjLEdBQUdGLFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFBO0FBQ3RELE1BQUEsSUFBSSxDQUFDRyxhQUFhLEdBQUdILFlBQVksQ0FBQyx3QkFBd0IsQ0FBQyxDQUFBO01BQzNELElBQUksSUFBSSxDQUFDRyxhQUFhLEVBQUU7QUFFcEIsUUFBQSxNQUFNTyxHQUFHLEdBQUcsSUFBSSxDQUFDUCxhQUFhLENBQUE7UUFDOUJuWCxFQUFFLENBQUMyWCxtQkFBbUIsR0FBR0QsR0FBRyxDQUFDRSx3QkFBd0IsQ0FBQ0MsSUFBSSxDQUFDSCxHQUFHLENBQUMsQ0FBQTtRQUMvRDFYLEVBQUUsQ0FBQzhYLHFCQUFxQixHQUFHSixHQUFHLENBQUNLLDBCQUEwQixDQUFDRixJQUFJLENBQUNILEdBQUcsQ0FBQyxDQUFBO1FBQ25FMVgsRUFBRSxDQUFDZ1ksbUJBQW1CLEdBQUdOLEdBQUcsQ0FBQ08sd0JBQXdCLENBQUNKLElBQUksQ0FBQ0gsR0FBRyxDQUFDLENBQUE7QUFDbkUsT0FBQTtBQUVBLE1BQUEsSUFBSSxDQUFDTixzQkFBc0IsR0FBR0osWUFBWSxDQUFDLDBCQUEwQixDQUFDLENBQUE7QUFDdEUsTUFBQSxJQUFJLENBQUN4RSxlQUFlLEdBQUd3RSxZQUFZLENBQUMsbUJBQW1CLENBQUMsQ0FBQTtBQUN4RCxNQUFBLElBQUksQ0FBQzFELG1CQUFtQixHQUFHMEQsWUFBWSxDQUFDLHdCQUF3QixDQUFDLENBQUE7QUFDakUsTUFBQSxJQUFJLENBQUNLLGFBQWEsR0FBR0wsWUFBWSxDQUFDLHdCQUF3QixDQUFDLENBQUE7QUFDM0QsTUFBQSxJQUFJLENBQUNNLGNBQWMsR0FBR04sWUFBWSxDQUFDLHdCQUF3QixDQUFDLENBQUE7QUFDNUQsTUFBQSxJQUFJLENBQUNPLG9CQUFvQixHQUFHUCxZQUFZLENBQUMseUJBQXlCLENBQUMsQ0FBQTtNQUNuRSxJQUFJLElBQUksQ0FBQ08sb0JBQW9CLEVBQUU7QUFFM0IsUUFBQSxNQUFNRyxHQUFHLEdBQUcsSUFBSSxDQUFDSCxvQkFBb0IsQ0FBQTtRQUNyQ3ZYLEVBQUUsQ0FBQ2tZLGlCQUFpQixHQUFHUixHQUFHLENBQUNTLG9CQUFvQixDQUFDTixJQUFJLENBQUNILEdBQUcsQ0FBQyxDQUFBO1FBQ3pEMVgsRUFBRSxDQUFDb1ksaUJBQWlCLEdBQUdWLEdBQUcsQ0FBQ1csb0JBQW9CLENBQUNSLElBQUksQ0FBQ0gsR0FBRyxDQUFDLENBQUE7UUFDekQxWCxFQUFFLENBQUNzWSxhQUFhLEdBQUdaLEdBQUcsQ0FBQ2EsZ0JBQWdCLENBQUNWLElBQUksQ0FBQ0gsR0FBRyxDQUFDLENBQUE7UUFDakQxWCxFQUFFLENBQUN3WSxlQUFlLEdBQUdkLEdBQUcsQ0FBQ2Usa0JBQWtCLENBQUNaLElBQUksQ0FBQ0gsR0FBRyxDQUFDLENBQUE7QUFDekQsT0FBQTtNQUNBLElBQUksQ0FBQ3ZFLG1CQUFtQixHQUFHLElBQUksQ0FBQTtNQUMvQixJQUFJLENBQUNxRSxxQkFBcUIsR0FBRyxJQUFJLENBQUE7TUFDakMsSUFBSSxDQUFDQyxlQUFlLEdBQUd6WCxFQUFFLENBQUNnWCxZQUFZLENBQUMscUJBQXFCLENBQUMsQ0FBQTtBQUNqRSxLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUMwQixvQkFBb0IsR0FBRzFCLFlBQVksQ0FBQywyQkFBMkIsQ0FBQyxDQUFBO0FBQ3JFLElBQUEsSUFBSSxDQUFDOUMscUJBQXFCLEdBQUc4QyxZQUFZLENBQUMsMEJBQTBCLENBQUMsQ0FBQTtBQUNyRSxJQUFBLElBQUksQ0FBQ2hELHlCQUF5QixHQUFHZ0QsWUFBWSxDQUFDLCtCQUErQixDQUFDLENBQUE7QUFDOUUsSUFBQSxJQUFJLENBQUMyQixhQUFhLEdBQUczQixZQUFZLENBQUMsaUJBQWlCLENBQUMsQ0FBQTtJQUNwRCxJQUFJLENBQUM0QiwyQkFBMkIsR0FBRzVCLFlBQVksQ0FBQyxnQ0FBZ0MsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFBO0FBQzFILElBQUEsSUFBSSxDQUFDNkIsd0JBQXdCLEdBQUc3QixZQUFZLENBQUMsK0JBQStCLENBQUMsQ0FBQTtBQUM3RSxJQUFBLElBQUksQ0FBQzhCLHVCQUF1QixHQUFHOUIsWUFBWSxDQUFDLDhCQUE4QixDQUFDLENBQUE7SUFDM0UsSUFBSSxDQUFDK0IseUJBQXlCLEdBQUcvQixZQUFZLENBQUMsZ0NBQWdDLEVBQUUsdUNBQXVDLENBQUMsQ0FBQTtJQUN4SCxJQUFJLENBQUNnQyx3QkFBd0IsR0FBR2hDLFlBQVksQ0FBQywrQkFBK0IsRUFBRSxzQ0FBc0MsQ0FBQyxDQUFBO0FBQ3JILElBQUEsSUFBSSxDQUFDaUMsdUJBQXVCLEdBQUdqQyxZQUFZLENBQUMsOEJBQThCLENBQUMsQ0FBQTtBQUMzRSxJQUFBLElBQUksQ0FBQ2tDLHdCQUF3QixHQUFHbEMsWUFBWSxDQUFDLCtCQUErQixDQUFDLENBQUE7QUFDN0UsSUFBQSxJQUFJLENBQUNtQyx3QkFBd0IsR0FBR25DLFlBQVksQ0FBQyw2QkFBNkIsQ0FBQyxDQUFBOztBQUczRSxJQUFBLElBQUksQ0FBQzVELHVCQUF1QixHQUFHNEQsWUFBWSxDQUFDLDZCQUE2QixDQUFDLENBQUE7QUFDOUUsR0FBQTs7QUFPQWhPLEVBQUFBLHNCQUFzQixHQUFHO0FBQ3JCLElBQUEsTUFBTWhKLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQixJQUFBLElBQUkwWCxHQUFHLENBQUE7SUFFUCxNQUFNblEsU0FBUyxHQUFHLE9BQU9ELFNBQVMsS0FBSyxXQUFXLEdBQUdBLFNBQVMsQ0FBQ0MsU0FBUyxHQUFHLEVBQUUsQ0FBQTtJQUU3RSxJQUFJLENBQUNrTSxZQUFZLEdBQUcsSUFBSSxDQUFDd0MsU0FBUyxHQUFHLElBQUksQ0FBQ0QsWUFBWSxFQUFFLENBQUE7QUFFeEQsSUFBQSxNQUFNb0QsY0FBYyxHQUFHcFosRUFBRSxDQUFDcVosb0JBQW9CLEVBQUUsQ0FBQTtBQUNoRCxJQUFBLElBQUksQ0FBQ0MsWUFBWSxHQUFHRixjQUFjLENBQUMxUixTQUFTLENBQUE7QUFDNUMsSUFBQSxJQUFJLENBQUM2UixlQUFlLEdBQUdILGNBQWMsQ0FBQ2pTLE9BQU8sQ0FBQTtBQUU3QyxJQUFBLElBQUksQ0FBQ3FTLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUNyQyxhQUFhLENBQUE7O0lBRzlDLElBQUksQ0FBQ3NDLGNBQWMsR0FBR3paLEVBQUUsQ0FBQzBaLFlBQVksQ0FBQzFaLEVBQUUsQ0FBQzJaLGdCQUFnQixDQUFDLENBQUE7SUFDMUQsSUFBSSxDQUFDQyxjQUFjLEdBQUc1WixFQUFFLENBQUMwWixZQUFZLENBQUMxWixFQUFFLENBQUM2Wix5QkFBeUIsQ0FBQyxDQUFBO0lBQ25FLElBQUksQ0FBQ0MsbUJBQW1CLEdBQUc5WixFQUFFLENBQUMwWixZQUFZLENBQUMxWixFQUFFLENBQUMrWixxQkFBcUIsQ0FBQyxDQUFBO0lBQ3BFLElBQUksQ0FBQ0MsV0FBVyxHQUFHaGEsRUFBRSxDQUFDMFosWUFBWSxDQUFDMVosRUFBRSxDQUFDaWEsdUJBQXVCLENBQUMsQ0FBQTtJQUM5RCxJQUFJLENBQUNDLG1CQUFtQixHQUFHbGEsRUFBRSxDQUFDMFosWUFBWSxDQUFDMVosRUFBRSxDQUFDbWEsZ0NBQWdDLENBQUMsQ0FBQTtJQUMvRSxJQUFJLENBQUMxSCxpQkFBaUIsR0FBR3pTLEVBQUUsQ0FBQzBaLFlBQVksQ0FBQzFaLEVBQUUsQ0FBQ29hLDhCQUE4QixDQUFDLENBQUE7SUFDM0UsSUFBSSxDQUFDekgsbUJBQW1CLEdBQUczUyxFQUFFLENBQUMwWixZQUFZLENBQUMxWixFQUFFLENBQUNxYSwwQkFBMEIsQ0FBQyxDQUFBO0lBQ3pFLElBQUksQ0FBQ0MscUJBQXFCLEdBQUd0YSxFQUFFLENBQUMwWixZQUFZLENBQUMxWixFQUFFLENBQUN1YSw0QkFBNEIsQ0FBQyxDQUFBO0lBQzdFLElBQUksSUFBSSxDQUFDcFUsTUFBTSxFQUFFO01BQ2IsSUFBSSxDQUFDcVUsY0FBYyxHQUFHeGEsRUFBRSxDQUFDMFosWUFBWSxDQUFDMVosRUFBRSxDQUFDeWEsZ0JBQWdCLENBQUMsQ0FBQTtNQUMxRCxJQUFJLENBQUNDLG1CQUFtQixHQUFHMWEsRUFBRSxDQUFDMFosWUFBWSxDQUFDMVosRUFBRSxDQUFDMmEscUJBQXFCLENBQUMsQ0FBQTtNQUNwRSxJQUFJLENBQUNDLGFBQWEsR0FBRzVhLEVBQUUsQ0FBQzBaLFlBQVksQ0FBQzFaLEVBQUUsQ0FBQzZhLG1CQUFtQixDQUFDLENBQUE7QUFDaEUsS0FBQyxNQUFNO01BQ0huRCxHQUFHLEdBQUcsSUFBSSxDQUFDUixjQUFjLENBQUE7QUFDekIsTUFBQSxJQUFJLENBQUNzRCxjQUFjLEdBQUc5QyxHQUFHLEdBQUcxWCxFQUFFLENBQUMwWixZQUFZLENBQUNoQyxHQUFHLENBQUNvRCxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUN6RSxNQUFBLElBQUksQ0FBQ0osbUJBQW1CLEdBQUdoRCxHQUFHLEdBQUcxWCxFQUFFLENBQUMwWixZQUFZLENBQUNoQyxHQUFHLENBQUNxRCx5QkFBeUIsQ0FBQyxHQUFHLENBQUMsQ0FBQTtNQUNuRixJQUFJLENBQUNILGFBQWEsR0FBRyxDQUFDLENBQUE7QUFDMUIsS0FBQTtJQUVBbEQsR0FBRyxHQUFHLElBQUksQ0FBQ2dCLG9CQUFvQixDQUFBO0FBQy9CLElBQUEsSUFBSSxDQUFDMUYsZ0JBQWdCLEdBQUcwRSxHQUFHLEdBQUcxWCxFQUFFLENBQUMwWixZQUFZLENBQUNoQyxHQUFHLENBQUNzRCx1QkFBdUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQTtBQUMvRSxJQUFBLElBQUksQ0FBQ0MsY0FBYyxHQUFHdkQsR0FBRyxHQUFHMVgsRUFBRSxDQUFDMFosWUFBWSxDQUFDaEMsR0FBRyxDQUFDd0QscUJBQXFCLENBQUMsR0FBRyxFQUFFLENBQUE7O0lBVTNFLE1BQU1DLGlCQUFpQixHQUFHLGlCQUFpQixDQUFBO0FBQzNDLElBQUEsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxFQUFFLElBQUksQ0FBQ0gsY0FBYyxLQUFLLEtBQUssSUFBSTFULFNBQVMsQ0FBQzhULEtBQUssQ0FBQ0YsaUJBQWlCLENBQUMsQ0FBQyxDQUFBO0lBRWxHekQsR0FBRyxHQUFHLElBQUksQ0FBQ2tCLDJCQUEyQixDQUFBO0FBQ3RDLElBQUEsSUFBSSxDQUFDMEMsYUFBYSxHQUFHNUQsR0FBRyxHQUFHMVgsRUFBRSxDQUFDMFosWUFBWSxDQUFDaEMsR0FBRyxDQUFDNkQsOEJBQThCLENBQUMsR0FBRyxDQUFDLENBQUE7SUFFbEYsSUFBSSxDQUFDQyxPQUFPLEdBQUd4YixFQUFFLENBQUMwWixZQUFZLENBQUMxWixFQUFFLENBQUN5YixPQUFPLENBQUMsQ0FBQTtJQUMxQyxJQUFJLENBQUNDLFVBQVUsR0FBRyxJQUFJLENBQUN2VixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUNxQix5QkFBeUIsR0FBR3hILEVBQUUsQ0FBQzBaLFlBQVksQ0FBQzFaLEVBQUUsQ0FBQzJiLFdBQVcsQ0FBQyxHQUFHLENBQUMsQ0FBQTs7SUFHdEcsSUFBSSxDQUFDQyxrQkFBa0IsR0FBRyxJQUFJLENBQUN6VixNQUFNLElBQUksQ0FBQ2dDLFFBQVEsQ0FBQzBULE9BQU8sQ0FBQTs7QUFHMUQsSUFBQSxJQUFJLElBQUksQ0FBQzdCLFdBQVcsSUFBSSxDQUFDLEVBQUU7TUFDdkIsSUFBSSxDQUFDNEIsa0JBQWtCLEdBQUcsS0FBSyxDQUFBO0FBQ25DLEtBQUE7QUFDSixHQUFBOztBQU9BM1MsRUFBQUEscUJBQXFCLEdBQUc7QUFDcEIsSUFBQSxNQUFNakosRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBOztJQUdsQixJQUFJLENBQUM4YixRQUFRLEdBQUcsS0FBSyxDQUFBO0FBQ3JCOWIsSUFBQUEsRUFBRSxDQUFDK2IsT0FBTyxDQUFDL2IsRUFBRSxDQUFDZ2MsS0FBSyxDQUFDLENBQUE7SUFFcEIsSUFBSSxDQUFDQyxRQUFRLEdBQUdDLGFBQWEsQ0FBQTtJQUM3QixJQUFJLENBQUNDLFFBQVEsR0FBR0MsY0FBYyxDQUFBO0lBQzlCLElBQUksQ0FBQ0MsYUFBYSxHQUFHSCxhQUFhLENBQUE7SUFDbEMsSUFBSSxDQUFDSSxhQUFhLEdBQUdGLGNBQWMsQ0FBQTtJQUNuQyxJQUFJLENBQUNHLGtCQUFrQixHQUFHLEtBQUssQ0FBQTtJQUMvQixJQUFJLENBQUNDLGFBQWEsR0FBR0MsaUJBQWlCLENBQUE7SUFDdEMsSUFBSSxDQUFDQyxrQkFBa0IsR0FBR0QsaUJBQWlCLENBQUE7SUFDM0MsSUFBSSxDQUFDRSxxQkFBcUIsR0FBRyxLQUFLLENBQUE7SUFDbEMzYyxFQUFFLENBQUM0YyxTQUFTLENBQUM1YyxFQUFFLENBQUN3SyxHQUFHLEVBQUV4SyxFQUFFLENBQUN1SyxJQUFJLENBQUMsQ0FBQTtBQUM3QnZLLElBQUFBLEVBQUUsQ0FBQ3djLGFBQWEsQ0FBQ3hjLEVBQUUsQ0FBQzhKLFFBQVEsQ0FBQyxDQUFBO0FBRTdCLElBQUEsSUFBSSxDQUFDK1MsVUFBVSxHQUFHLElBQUlDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUN2QzljLEVBQUUsQ0FBQzZjLFVBQVUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUV6QixJQUFJLENBQUNFLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxVQUFVLEdBQUcsSUFBSSxDQUFBO0lBQ3RCLElBQUksQ0FBQ0MsU0FBUyxHQUFHLElBQUksQ0FBQTtJQUNyQixJQUFJLENBQUNDLFVBQVUsR0FBRyxJQUFJLENBQUE7SUFDdEJsZCxFQUFFLENBQUNtZCxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFFcEMsSUFBSSxDQUFDQyxRQUFRLEdBQUdDLGFBQWEsQ0FBQTtBQUM3QnJkLElBQUFBLEVBQUUsQ0FBQ3NkLE1BQU0sQ0FBQ3RkLEVBQUUsQ0FBQ3VkLFNBQVMsQ0FBQyxDQUFBO0FBQ3ZCdmQsSUFBQUEsRUFBRSxDQUFDd2QsUUFBUSxDQUFDeGQsRUFBRSxDQUFDNE0sSUFBSSxDQUFDLENBQUE7SUFFcEIsSUFBSSxDQUFDNlEsU0FBUyxHQUFHLElBQUksQ0FBQTtBQUNyQnpkLElBQUFBLEVBQUUsQ0FBQ3NkLE1BQU0sQ0FBQ3RkLEVBQUUsQ0FBQzBkLFVBQVUsQ0FBQyxDQUFBO0lBRXhCLElBQUksQ0FBQ0MsU0FBUyxHQUFHQyxjQUFjLENBQUE7QUFDL0I1ZCxJQUFBQSxFQUFFLENBQUMyZCxTQUFTLENBQUMzZCxFQUFFLENBQUMwTCxNQUFNLENBQUMsQ0FBQTtJQUV2QixJQUFJLENBQUNtUyxVQUFVLEdBQUcsSUFBSSxDQUFBO0FBQ3RCN2QsSUFBQUEsRUFBRSxDQUFDOGQsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFBO0lBRWxCLElBQUksQ0FBQzNXLE9BQU8sR0FBRyxLQUFLLENBQUE7QUFDcEJuSCxJQUFBQSxFQUFFLENBQUMrYixPQUFPLENBQUMvYixFQUFFLENBQUMrZCxZQUFZLENBQUMsQ0FBQTtBQUUzQixJQUFBLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDQyxlQUFlLEdBQUdDLFdBQVcsQ0FBQTtBQUMxRCxJQUFBLElBQUksQ0FBQ0MsZUFBZSxHQUFHLElBQUksQ0FBQ0MsY0FBYyxHQUFHLENBQUMsQ0FBQTtBQUM5QyxJQUFBLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDQyxlQUFlLEdBQUcsSUFBSSxDQUFBO0lBQ25EdGUsRUFBRSxDQUFDdWUsV0FBVyxDQUFDdmUsRUFBRSxDQUFDOEwsTUFBTSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUVsQyxJQUFBLElBQUksQ0FBQzBTLGdCQUFnQixHQUFHLElBQUksQ0FBQ0MsZUFBZSxHQUFHQyxjQUFjLENBQUE7QUFDN0QsSUFBQSxJQUFJLENBQUNDLGlCQUFpQixHQUFHLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUdGLGNBQWMsQ0FBQTtBQUMvRCxJQUFBLElBQUksQ0FBQ0csaUJBQWlCLEdBQUcsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBR0osY0FBYyxDQUFBO0lBQy9ELElBQUksQ0FBQ0sscUJBQXFCLEdBQUcsSUFBSSxDQUFBO0lBQ2pDLElBQUksQ0FBQ0Msb0JBQW9CLEdBQUcsSUFBSSxDQUFBO0FBQ2hDaGYsSUFBQUEsRUFBRSxDQUFDaWYsU0FBUyxDQUFDamYsRUFBRSxDQUFDZ00sSUFBSSxFQUFFaE0sRUFBRSxDQUFDZ00sSUFBSSxFQUFFaE0sRUFBRSxDQUFDZ00sSUFBSSxDQUFDLENBQUE7QUFDdkNoTSxJQUFBQSxFQUFFLENBQUNrZixXQUFXLENBQUMsSUFBSSxDQUFDLENBQUE7SUFFcEIsSUFBSSxDQUFDQyxlQUFlLEdBQUcsS0FBSyxDQUFBO0lBQzVCLElBQUksQ0FBQ0MsTUFBTSxHQUFHLElBQUksQ0FBQTtJQUNsQixJQUFJLElBQUksQ0FBQ2paLE1BQU0sRUFBRTtBQUNibkcsTUFBQUEsRUFBRSxDQUFDK2IsT0FBTyxDQUFDL2IsRUFBRSxDQUFDcWYsd0JBQXdCLENBQUMsQ0FBQTtBQUN2Q3JmLE1BQUFBLEVBQUUsQ0FBQytiLE9BQU8sQ0FBQy9iLEVBQUUsQ0FBQ3NmLGtCQUFrQixDQUFDLENBQUE7QUFDckMsS0FBQTtJQUVBLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBQzdCdmYsSUFBQUEsRUFBRSxDQUFDK2IsT0FBTyxDQUFDL2IsRUFBRSxDQUFDd2YsbUJBQW1CLENBQUMsQ0FBQTtJQUVsQyxJQUFJLENBQUNDLFVBQVUsR0FBRyxDQUFDLENBQUE7QUFDbkJ6ZixJQUFBQSxFQUFFLENBQUN5ZixVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFaEIsSUFBQSxJQUFJLENBQUNDLFVBQVUsR0FBRyxJQUFJNUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0lBQ3ZDOWMsRUFBRSxDQUFDMGYsVUFBVSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0lBRXpCLElBQUksQ0FBQ0MsWUFBWSxHQUFHLENBQUMsQ0FBQTtBQUNyQjNmLElBQUFBLEVBQUUsQ0FBQzJmLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQTs7QUFHbEIsSUFBQSxJQUFJLENBQUNDLEVBQUUsR0FBRyxJQUFJLENBQUNDLEVBQUUsR0FBRyxJQUFJLENBQUNDLEVBQUUsR0FBRyxJQUFJLENBQUNDLEVBQUUsR0FBRyxDQUFDLENBQUE7QUFDekMsSUFBQSxJQUFJLENBQUNDLEVBQUUsR0FBRyxJQUFJLENBQUNDLEVBQUUsR0FBRyxJQUFJLENBQUNDLEVBQUUsR0FBRyxJQUFJLENBQUNDLEVBQUUsR0FBRyxDQUFDLENBQUE7SUFFekMsSUFBSSxJQUFJLENBQUNoYSxNQUFNLEVBQUU7TUFDYm5HLEVBQUUsQ0FBQ29nQixJQUFJLENBQUNwZ0IsRUFBRSxDQUFDcWdCLCtCQUErQixFQUFFcmdCLEVBQUUsQ0FBQ3NnQixNQUFNLENBQUMsQ0FBQTtBQUMxRCxLQUFDLE1BQU07TUFDSCxJQUFJLElBQUksQ0FBQ2xKLHNCQUFzQixFQUFFO0FBQzdCcFgsUUFBQUEsRUFBRSxDQUFDb2dCLElBQUksQ0FBQyxJQUFJLENBQUNoSixzQkFBc0IsQ0FBQ21KLG1DQUFtQyxFQUFFdmdCLEVBQUUsQ0FBQ3NnQixNQUFNLENBQUMsQ0FBQTtBQUN2RixPQUFBO0FBQ0osS0FBQTtBQUVBdGdCLElBQUFBLEVBQUUsQ0FBQ3NkLE1BQU0sQ0FBQ3RkLEVBQUUsQ0FBQ3dnQixZQUFZLENBQUMsQ0FBQTtJQUUxQnhnQixFQUFFLENBQUN5Z0IsV0FBVyxDQUFDemdCLEVBQUUsQ0FBQzBnQixrQ0FBa0MsRUFBRTFnQixFQUFFLENBQUMyZ0IsSUFBSSxDQUFDLENBQUE7SUFFOUQsSUFBSSxDQUFDQyxXQUFXLEdBQUcsS0FBSyxDQUFBO0lBQ3hCNWdCLEVBQUUsQ0FBQ3lnQixXQUFXLENBQUN6Z0IsRUFBRSxDQUFDNmdCLG1CQUFtQixFQUFFLEtBQUssQ0FBQyxDQUFBO0lBRTdDLElBQUksQ0FBQ0Msc0JBQXNCLEdBQUcsS0FBSyxDQUFBO0lBQ25DOWdCLEVBQUUsQ0FBQ3lnQixXQUFXLENBQUN6Z0IsRUFBRSxDQUFDK2dCLDhCQUE4QixFQUFFLEtBQUssQ0FBQyxDQUFBO0lBRXhEL2dCLEVBQUUsQ0FBQ3lnQixXQUFXLENBQUN6Z0IsRUFBRSxDQUFDZ2hCLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQzFDLEdBQUE7QUFFQTlYLEVBQUFBLHVCQUF1QixHQUFHO0lBQ3RCLEtBQUssQ0FBQ0EsdUJBQXVCLEVBQUUsQ0FBQTs7QUFHL0IsSUFBQSxJQUFJLENBQUMrWCxpQkFBaUIsR0FBRyxFQUFFLENBQUE7QUFDM0IsSUFBQSxJQUFJLENBQUNDLG1CQUFtQixHQUFHLEVBQUUsQ0FBQTs7QUFHN0IsSUFBQSxJQUFJLENBQUNDLE9BQU8sR0FBRyxJQUFJQyxHQUFHLEVBQUUsQ0FBQTtJQUV4QixJQUFJLENBQUNDLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDcEIsSUFBSSxDQUFDbmQsaUJBQWlCLEdBQUcsSUFBSSxDQUFBO0lBQzdCLElBQUksQ0FBQ2lRLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDcEIsSUFBSSxDQUFDbU4sdUJBQXVCLEdBQUcsSUFBSSxDQUFBO0lBRW5DLElBQUksQ0FBQ0MsV0FBVyxHQUFHLENBQUMsQ0FBQTtJQUNwQixJQUFJLENBQUNDLFlBQVksR0FBRyxFQUFFLENBQUE7QUFDdEIsSUFBQSxLQUFLLElBQUkxWixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDb1MsbUJBQW1CLEVBQUVwUyxDQUFDLEVBQUUsRUFBRTtBQUMvQyxNQUFBLElBQUksQ0FBQzBaLFlBQVksQ0FBQzdMLElBQUksQ0FBQyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQTtBQUM5QyxLQUFBO0FBQ0osR0FBQTs7QUFPQTdPLEVBQUFBLFdBQVcsR0FBRztBQUVWLElBQUEsS0FBSyxNQUFNa08sTUFBTSxJQUFJLElBQUksQ0FBQ3lNLE9BQU8sRUFBRTtNQUMvQnpNLE1BQU0sQ0FBQ2xPLFdBQVcsRUFBRSxDQUFBO0FBQ3hCLEtBQUE7O0FBR0EsSUFBQSxLQUFLLE1BQU0zRyxPQUFPLElBQUksSUFBSSxDQUFDdWhCLFFBQVEsRUFBRTtNQUNqQ3ZoQixPQUFPLENBQUMyRyxXQUFXLEVBQUUsQ0FBQTtBQUN6QixLQUFBOztBQUdBLElBQUEsS0FBSyxNQUFNNmEsTUFBTSxJQUFJLElBQUksQ0FBQ0MsT0FBTyxFQUFFO01BQy9CRCxNQUFNLENBQUM3YSxXQUFXLEVBQUUsQ0FBQTtBQUN4QixLQUFBOztBQUtBLElBQUEsS0FBSyxNQUFNK2EsTUFBTSxJQUFJLElBQUksQ0FBQ0MsT0FBTyxFQUFFO01BQy9CRCxNQUFNLENBQUMvYSxXQUFXLEVBQUUsQ0FBQTtBQUN4QixLQUFBO0FBQ0osR0FBQTs7QUFPQUksRUFBQUEsY0FBYyxHQUFHO0lBQ2IsSUFBSSxDQUFDNkIsb0JBQW9CLEVBQUUsQ0FBQTtJQUMzQixJQUFJLENBQUNDLHNCQUFzQixFQUFFLENBQUE7SUFDN0IsSUFBSSxDQUFDQyxxQkFBcUIsRUFBRSxDQUFBO0lBQzVCLElBQUksQ0FBQ0MsdUJBQXVCLEVBQUUsQ0FBQTs7QUFHOUIsSUFBQSxLQUFLLE1BQU04TCxNQUFNLElBQUksSUFBSSxDQUFDeU0sT0FBTyxFQUFFO01BQy9Cek0sTUFBTSxDQUFDOU4sY0FBYyxFQUFFLENBQUE7QUFDM0IsS0FBQTs7QUFHQSxJQUFBLEtBQUssTUFBTXlhLE1BQU0sSUFBSSxJQUFJLENBQUNDLE9BQU8sRUFBRTtNQUMvQkQsTUFBTSxDQUFDSSxNQUFNLEVBQUUsQ0FBQTtBQUNuQixLQUFBO0FBQ0osR0FBQTs7RUFVQUMsV0FBVyxDQUFDdmQsQ0FBQyxFQUFFQyxDQUFDLEVBQUVFLENBQUMsRUFBRXFkLENBQUMsRUFBRTtJQUNwQixJQUFLLElBQUksQ0FBQ3JDLEVBQUUsS0FBS25iLENBQUMsSUFBTSxJQUFJLENBQUNvYixFQUFFLEtBQUtuYixDQUFFLElBQUssSUFBSSxDQUFDb2IsRUFBRSxLQUFLbGIsQ0FBRSxJQUFLLElBQUksQ0FBQ21iLEVBQUUsS0FBS2tDLENBQUUsRUFBRTtBQUMxRSxNQUFBLElBQUksQ0FBQ2ppQixFQUFFLENBQUNraUIsUUFBUSxDQUFDemQsQ0FBQyxFQUFFQyxDQUFDLEVBQUVFLENBQUMsRUFBRXFkLENBQUMsQ0FBQyxDQUFBO01BQzVCLElBQUksQ0FBQ3JDLEVBQUUsR0FBR25iLENBQUMsQ0FBQTtNQUNYLElBQUksQ0FBQ29iLEVBQUUsR0FBR25iLENBQUMsQ0FBQTtNQUNYLElBQUksQ0FBQ29iLEVBQUUsR0FBR2xiLENBQUMsQ0FBQTtNQUNYLElBQUksQ0FBQ21iLEVBQUUsR0FBR2tDLENBQUMsQ0FBQTtBQUNmLEtBQUE7QUFDSixHQUFBOztFQVVBRSxVQUFVLENBQUMxZCxDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWQsQ0FBQyxFQUFFO0lBQ25CLElBQUssSUFBSSxDQUFDakMsRUFBRSxLQUFLdmIsQ0FBQyxJQUFNLElBQUksQ0FBQ3diLEVBQUUsS0FBS3ZiLENBQUUsSUFBSyxJQUFJLENBQUN3YixFQUFFLEtBQUt0YixDQUFFLElBQUssSUFBSSxDQUFDdWIsRUFBRSxLQUFLOEIsQ0FBRSxFQUFFO0FBQzFFLE1BQUEsSUFBSSxDQUFDamlCLEVBQUUsQ0FBQ29pQixPQUFPLENBQUMzZCxDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWQsQ0FBQyxDQUFDLENBQUE7TUFDM0IsSUFBSSxDQUFDakMsRUFBRSxHQUFHdmIsQ0FBQyxDQUFBO01BQ1gsSUFBSSxDQUFDd2IsRUFBRSxHQUFHdmIsQ0FBQyxDQUFBO01BQ1gsSUFBSSxDQUFDd2IsRUFBRSxHQUFHdGIsQ0FBQyxDQUFBO01BQ1gsSUFBSSxDQUFDdWIsRUFBRSxHQUFHOEIsQ0FBQyxDQUFBO0FBQ2YsS0FBQTtBQUNKLEdBQUE7O0VBUUE5ZCxjQUFjLENBQUNrZSxFQUFFLEVBQUU7QUFDZixJQUFBLElBQUksSUFBSSxDQUFDbmUsaUJBQWlCLEtBQUttZSxFQUFFLEVBQUU7QUFDL0IsTUFBQSxNQUFNcmlCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtNQUNsQkEsRUFBRSxDQUFDa0IsZUFBZSxDQUFDbEIsRUFBRSxDQUFDbUIsV0FBVyxFQUFFa2hCLEVBQUUsQ0FBQyxDQUFBO01BQ3RDLElBQUksQ0FBQ25lLGlCQUFpQixHQUFHbWUsRUFBRSxDQUFBO0FBQy9CLEtBQUE7QUFDSixHQUFBOztFQVdBQyxnQkFBZ0IsQ0FBQ0MsTUFBTSxFQUFFQyxJQUFJLEVBQUVsWixLQUFLLEVBQUU1RixLQUFLLEVBQUU7QUFDekMsSUFBQSxNQUFNMUQsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBO0FBRWxCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ21HLE1BQU0sSUFBSXpDLEtBQUssRUFBRTtBQUN2QnFELE1BQUFBLEtBQUssQ0FBQzBiLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFBO0FBQ2pELE1BQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsS0FBQTtBQUNBLElBQUEsSUFBSW5aLEtBQUssRUFBRTtNQUNQLElBQUksQ0FBQ2taLElBQUksRUFBRTtBQUVQLFFBQUEsSUFBSSxDQUFDRCxNQUFNLENBQUNHLFlBQVksRUFBRTtBQUN0QjNiLFVBQUFBLEtBQUssQ0FBQzBiLEtBQUssQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFBO0FBQzFELFVBQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsU0FBQTtPQUNILE1BQU0sSUFBSUYsTUFBTSxFQUFFO1FBRWYsSUFBSSxDQUFDQSxNQUFNLENBQUNHLFlBQVksSUFBSSxDQUFDRixJQUFJLENBQUNFLFlBQVksRUFBRTtBQUM1QzNiLFVBQUFBLEtBQUssQ0FBQzBiLEtBQUssQ0FBQyw0RUFBNEUsQ0FBQyxDQUFBO0FBQ3pGLFVBQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsU0FBQTtRQUNBLElBQUlGLE1BQU0sQ0FBQ0csWUFBWSxDQUFDQyxPQUFPLEtBQUtILElBQUksQ0FBQ0UsWUFBWSxDQUFDQyxPQUFPLEVBQUU7QUFDM0Q1YixVQUFBQSxLQUFLLENBQUMwYixLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQTtBQUNuRSxVQUFBLE9BQU8sS0FBSyxDQUFBO0FBQ2hCLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtJQUNBLElBQUkvZSxLQUFLLElBQUk2ZSxNQUFNLEVBQUU7QUFDakIsTUFBQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ0ssTUFBTSxFQUFFO1FBQ2hCLElBQUksQ0FBQ0wsTUFBTSxDQUFDTSxZQUFZLElBQUksQ0FBQ0wsSUFBSSxDQUFDSyxZQUFZLEVBQUU7QUFDNUM5YixVQUFBQSxLQUFLLENBQUMwYixLQUFLLENBQUMsNEVBQTRFLENBQUMsQ0FBQTtBQUN6RixVQUFBLE9BQU8sS0FBSyxDQUFBO0FBQ2hCLFNBQUE7UUFDQSxJQUFJRixNQUFNLENBQUNNLFlBQVksQ0FBQ0YsT0FBTyxLQUFLSCxJQUFJLENBQUNLLFlBQVksQ0FBQ0YsT0FBTyxFQUFFO0FBQzNENWIsVUFBQUEsS0FBSyxDQUFDMGIsS0FBSyxDQUFDLHNEQUFzRCxDQUFDLENBQUE7QUFDbkUsVUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFFQUssSUFBQUEsYUFBYSxDQUFDQyxhQUFhLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFBO0FBRTVDLElBQUEsSUFBSSxJQUFJLENBQUM1YyxNQUFNLElBQUlxYyxJQUFJLEVBQUU7QUFDckIsTUFBQSxNQUFNUSxNQUFNLEdBQUcsSUFBSSxDQUFDM04sWUFBWSxDQUFBO01BQ2hDLElBQUksQ0FBQ0EsWUFBWSxHQUFHbU4sSUFBSSxDQUFBO01BQ3hCLElBQUksQ0FBQ1MsV0FBVyxFQUFFLENBQUE7QUFDbEJqakIsTUFBQUEsRUFBRSxDQUFDa0IsZUFBZSxDQUFDbEIsRUFBRSxDQUFDa2pCLGdCQUFnQixFQUFFWCxNQUFNLEdBQUdBLE1BQU0sQ0FBQ25lLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUksQ0FBQyxDQUFBO0FBQ25GckUsTUFBQUEsRUFBRSxDQUFDa0IsZUFBZSxDQUFDbEIsRUFBRSxDQUFDbWpCLGdCQUFnQixFQUFFWCxJQUFJLENBQUNwZSxJQUFJLENBQUNDLGNBQWMsQ0FBQyxDQUFBO01BQ2pFLE1BQU1PLENBQUMsR0FBRzJkLE1BQU0sR0FBR0EsTUFBTSxDQUFDeGYsS0FBSyxHQUFHeWYsSUFBSSxDQUFDemYsS0FBSyxDQUFBO01BQzVDLE1BQU1rZixDQUFDLEdBQUdNLE1BQU0sR0FBR0EsTUFBTSxDQUFDdmYsTUFBTSxHQUFHd2YsSUFBSSxDQUFDeGYsTUFBTSxDQUFBO0FBQzlDaEQsTUFBQUEsRUFBRSxDQUFDb2pCLGVBQWUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFeGUsQ0FBQyxFQUFFcWQsQ0FBQyxFQUNWLENBQUMsRUFBRSxDQUFDLEVBQUVyZCxDQUFDLEVBQUVxZCxDQUFDLEVBQ1YsQ0FBQzNZLEtBQUssR0FBR3RKLEVBQUUsQ0FBQ3dNLGdCQUFnQixHQUFHLENBQUMsS0FBSzlJLEtBQUssR0FBRzFELEVBQUUsQ0FBQ3lNLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxFQUNyRXpNLEVBQUUsQ0FBQ1MsT0FBTyxDQUFDLENBQUE7TUFDOUIsSUFBSSxDQUFDNFUsWUFBWSxHQUFHMk4sTUFBTSxDQUFBO0FBQzFCaGpCLE1BQUFBLEVBQUUsQ0FBQ2tCLGVBQWUsQ0FBQ2xCLEVBQUUsQ0FBQ21CLFdBQVcsRUFBRTZoQixNQUFNLEdBQUdBLE1BQU0sQ0FBQzVlLElBQUksQ0FBQ0MsY0FBYyxHQUFHLElBQUksQ0FBQyxDQUFBO0FBQ2xGLEtBQUMsTUFBTTtBQUNILE1BQUEsTUFBTTJRLE1BQU0sR0FBRyxJQUFJLENBQUNxTyxhQUFhLEVBQUUsQ0FBQTtNQUNuQyxJQUFJLENBQUN0ZixpQkFBaUIsQ0FBQ0MsUUFBUSxDQUFDdWUsTUFBTSxDQUFDRyxZQUFZLENBQUMsQ0FBQTtBQUNwRC9lLE1BQUFBLGtCQUFrQixDQUFDLElBQUksRUFBRTZlLElBQUksRUFBRXhOLE1BQU0sQ0FBQyxDQUFBO0FBQzFDLEtBQUE7QUFFQThOLElBQUFBLGFBQWEsQ0FBQ1EsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBRWhDLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQVNBRCxFQUFBQSxhQUFhLEdBQUc7QUFDWixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNFLFdBQVcsRUFBRTtBQUNuQixNQUFBLElBQUksQ0FBQ0EsV0FBVyxHQUFHLElBQUlsaEIsTUFBTSxDQUFDLElBQUksRUFBRUMsV0FBVyxDQUFDQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7QUFDbkVDLFFBQUFBLElBQUksRUFBRSxhQUFhO0FBQ25CQyxRQUFBQSxVQUFVLEVBQUU5QyxpQkFBaUI7QUFDN0IrQyxRQUFBQSxZQUFZLEVBQUU1QyxnQkFBQUE7QUFDbEIsT0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNQLEtBQUE7SUFDQSxPQUFPLElBQUksQ0FBQ3lqQixXQUFXLENBQUE7QUFDM0IsR0FBQTs7RUFRQUMsU0FBUyxDQUFDQyxVQUFVLEVBQUU7QUFFbEJYLElBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDLElBQUksRUFBRyxZQUFXLENBQUMsQ0FBQTs7QUFHL0MsSUFBQSxJQUFJLENBQUNXLGVBQWUsQ0FBQ0QsVUFBVSxDQUFDcE8sWUFBWSxDQUFDLENBQUE7SUFDN0MsSUFBSSxDQUFDNE4sV0FBVyxFQUFFLENBQUE7O0FBR2xCLElBQUEsTUFBTVUsUUFBUSxHQUFHRixVQUFVLENBQUNFLFFBQVEsQ0FBQTtBQUNwQyxJQUFBLE1BQU1DLGVBQWUsR0FBR0gsVUFBVSxDQUFDRyxlQUFlLENBQUE7SUFDbEQsSUFBSUQsUUFBUSxDQUFDRSxLQUFLLElBQUlELGVBQWUsQ0FBQ25FLFVBQVUsSUFBSW1FLGVBQWUsQ0FBQ2pFLFlBQVksRUFBRTtBQUc5RSxNQUFBLE1BQU1uYSxFQUFFLEdBQUdpZSxVQUFVLENBQUNwTyxZQUFZLENBQUE7TUFDbEMsTUFBTXRTLEtBQUssR0FBR3lDLEVBQUUsR0FBR0EsRUFBRSxDQUFDekMsS0FBSyxHQUFHLElBQUksQ0FBQ0EsS0FBSyxDQUFBO01BQ3hDLE1BQU1DLE1BQU0sR0FBR3dDLEVBQUUsR0FBR0EsRUFBRSxDQUFDeEMsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO01BQzNDLElBQUksQ0FBQ2dmLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFamYsS0FBSyxFQUFFQyxNQUFNLENBQUMsQ0FBQTtNQUNyQyxJQUFJLENBQUNtZixVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRXBmLEtBQUssRUFBRUMsTUFBTSxDQUFDLENBQUE7TUFFcEMsSUFBSThnQixVQUFVLEdBQUcsQ0FBQyxDQUFBO01BQ2xCLE1BQU1DLFlBQVksR0FBRyxFQUFFLENBQUE7TUFFdkIsSUFBSUosUUFBUSxDQUFDRSxLQUFLLEVBQUU7QUFDaEJDLFFBQUFBLFVBQVUsSUFBSXRhLGVBQWUsQ0FBQTtRQUM3QnVhLFlBQVksQ0FBQ3phLEtBQUssR0FBRyxDQUFDcWEsUUFBUSxDQUFDSyxVQUFVLENBQUNDLENBQUMsRUFBRU4sUUFBUSxDQUFDSyxVQUFVLENBQUNFLENBQUMsRUFBRVAsUUFBUSxDQUFDSyxVQUFVLENBQUNHLENBQUMsRUFBRVIsUUFBUSxDQUFDSyxVQUFVLENBQUNJLENBQUMsQ0FBQyxDQUFBO0FBQ3JILE9BQUE7TUFFQSxJQUFJUixlQUFlLENBQUNuRSxVQUFVLEVBQUU7QUFDNUJxRSxRQUFBQSxVQUFVLElBQUlyYSxlQUFlLENBQUE7QUFDN0JzYSxRQUFBQSxZQUFZLENBQUNyZ0IsS0FBSyxHQUFHa2dCLGVBQWUsQ0FBQ1MsZUFBZSxDQUFBO0FBQ3hELE9BQUE7TUFFQSxJQUFJVCxlQUFlLENBQUNqRSxZQUFZLEVBQUU7QUFDOUJtRSxRQUFBQSxVQUFVLElBQUlRLGlCQUFpQixDQUFBO0FBQy9CUCxRQUFBQSxZQUFZLENBQUM1YyxPQUFPLEdBQUd5YyxlQUFlLENBQUNXLGlCQUFpQixDQUFBO0FBQzVELE9BQUE7O01BR0FSLFlBQVksQ0FBQ3hhLEtBQUssR0FBR3VhLFVBQVUsQ0FBQTtBQUMvQixNQUFBLElBQUksQ0FBQ0QsS0FBSyxDQUFDRSxZQUFZLENBQUMsQ0FBQTtBQUM1QixLQUFBO0FBRUFoZCxJQUFBQSxLQUFLLENBQUN5ZCxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUNDLGdCQUFnQixDQUFDLENBQUE7SUFDcEMsSUFBSSxDQUFDQSxnQkFBZ0IsR0FBRyxJQUFJLENBQUE7QUFFNUIzQixJQUFBQSxhQUFhLENBQUNRLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNwQyxHQUFBOztFQVFBb0IsT0FBTyxDQUFDakIsVUFBVSxFQUFFO0FBRWhCWCxJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLEVBQUcsVUFBUyxDQUFDLENBQUE7SUFFN0MsSUFBSSxDQUFDNEIsaUJBQWlCLEVBQUUsQ0FBQTtBQUV4QixJQUFBLE1BQU05QyxNQUFNLEdBQUcsSUFBSSxDQUFDeE0sWUFBWSxDQUFBO0FBQ2hDLElBQUEsSUFBSXdNLE1BQU0sRUFBRTtNQUdSLElBQUksSUFBSSxDQUFDMWIsTUFBTSxFQUFFO1FBQ2J6RyxxQkFBcUIsQ0FBQ3FJLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDaEMsUUFBQSxNQUFNL0gsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBOztBQUdsQixRQUFBLElBQUksRUFBRXlqQixVQUFVLENBQUNFLFFBQVEsQ0FBQ2lCLEtBQUssSUFBSW5CLFVBQVUsQ0FBQ0UsUUFBUSxDQUFDelEsT0FBTyxDQUFDLEVBQUU7QUFDN0R4VCxVQUFBQSxxQkFBcUIsQ0FBQ2lXLElBQUksQ0FBQzNWLEVBQUUsQ0FBQ3FCLGlCQUFpQixDQUFDLENBQUE7QUFDcEQsU0FBQTtBQUNBLFFBQUEsSUFBSSxDQUFDb2lCLFVBQVUsQ0FBQ0csZUFBZSxDQUFDaUIsVUFBVSxFQUFFO0FBQ3hDbmxCLFVBQUFBLHFCQUFxQixDQUFDaVcsSUFBSSxDQUFDM1YsRUFBRSxDQUFDOGtCLGdCQUFnQixDQUFDLENBQUE7QUFDbkQsU0FBQTtBQUNBLFFBQUEsSUFBSSxDQUFDckIsVUFBVSxDQUFDRyxlQUFlLENBQUNtQixZQUFZLEVBQUU7QUFDMUNybEIsVUFBQUEscUJBQXFCLENBQUNpVyxJQUFJLENBQUMzVixFQUFFLENBQUNnbEIsa0JBQWtCLENBQUMsQ0FBQTtBQUNyRCxTQUFBO0FBRUEsUUFBQSxJQUFJdGxCLHFCQUFxQixDQUFDcUksTUFBTSxHQUFHLENBQUMsRUFBRTtVQUlsQyxJQUFJMGIsVUFBVSxDQUFDd0IsaUJBQWlCLEVBQUU7WUFDOUJqbEIsRUFBRSxDQUFDa2xCLHFCQUFxQixDQUFDbGxCLEVBQUUsQ0FBQ21qQixnQkFBZ0IsRUFBRXpqQixxQkFBcUIsQ0FBQyxDQUFBO0FBQ3hFLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTs7QUFHQSxNQUFBLElBQUkrakIsVUFBVSxDQUFDRSxRQUFRLENBQUN6USxPQUFPLEVBQUU7QUFDN0IsUUFBQSxJQUFJLElBQUksQ0FBQy9NLE1BQU0sSUFBSXNkLFVBQVUsQ0FBQ2pJLE9BQU8sR0FBRyxDQUFDLElBQUlxRyxNQUFNLENBQUNzRCxXQUFXLEVBQUU7QUFDN0R0RCxVQUFBQSxNQUFNLENBQUMzTyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFBO0FBQy9CLFNBQUE7QUFDSixPQUFBOztBQUdBLE1BQUEsSUFBSXVRLFVBQVUsQ0FBQ0UsUUFBUSxDQUFDMWdCLE9BQU8sRUFBRTtBQUM3QixRQUFBLE1BQU1RLFdBQVcsR0FBR29lLE1BQU0sQ0FBQ2EsWUFBWSxDQUFBO1FBQ3ZDLElBQUlqZixXQUFXLElBQUlBLFdBQVcsQ0FBQ1csSUFBSSxDQUFDZ2hCLFVBQVUsSUFBSTNoQixXQUFXLENBQUNSLE9BQU8sS0FBS1EsV0FBVyxDQUFDNGhCLEdBQUcsSUFBSSxJQUFJLENBQUNsZixNQUFNLENBQUMsRUFBRTtVQUN2RyxJQUFJLENBQUNtZixhQUFhLENBQUMsSUFBSSxDQUFDcEwsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDaEQsVUFBQSxJQUFJLENBQUM3WixXQUFXLENBQUNvRCxXQUFXLENBQUMsQ0FBQTtVQUM3QixJQUFJLENBQUN6RCxFQUFFLENBQUN1bEIsY0FBYyxDQUFDOWhCLFdBQVcsQ0FBQ1csSUFBSSxDQUFDb2hCLFNBQVMsQ0FBQyxDQUFBO0FBQ3RELFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtJQUVBLElBQUksQ0FBQ2YsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBRTdCM0IsSUFBQUEsYUFBYSxDQUFDUSxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDcEMsR0FBQTs7QUFVQUwsRUFBQUEsV0FBVyxHQUFHO0FBQ1ZILElBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQTtJQUVqRCxJQUFJLENBQUMxQixRQUFRLEdBQUcsSUFBSSxDQUFBOztJQUdwQixJQUFJLElBQUksQ0FBQzNZLHNDQUFzQyxFQUFFO0FBQzdDLE1BQUEsS0FBSyxJQUFJK2MsSUFBSSxHQUFHLENBQUMsRUFBRUEsSUFBSSxHQUFHLElBQUksQ0FBQ2pFLFlBQVksQ0FBQ3paLE1BQU0sRUFBRSxFQUFFMGQsSUFBSSxFQUFFO1FBQ3hELEtBQUssSUFBSUMsSUFBSSxHQUFHLENBQUMsRUFBRUEsSUFBSSxHQUFHLENBQUMsRUFBRSxFQUFFQSxJQUFJLEVBQUU7VUFDakMsSUFBSSxDQUFDbEUsWUFBWSxDQUFDaUUsSUFBSSxDQUFDLENBQUNDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQTtBQUN4QyxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBR0EsSUFBQSxNQUFNN0QsTUFBTSxHQUFHLElBQUksQ0FBQ3hNLFlBQVksQ0FBQTtBQUNoQyxJQUFBLElBQUl3TSxNQUFNLEVBQUU7QUFFUixNQUFBLElBQUksQ0FBQ0EsTUFBTSxDQUFDemQsSUFBSSxDQUFDdWhCLFdBQVcsRUFBRTtBQUMxQixRQUFBLElBQUksQ0FBQ2xnQixnQkFBZ0IsQ0FBQ29jLE1BQU0sQ0FBQyxDQUFBO0FBQ2pDLE9BQUMsTUFBTTtRQUNILElBQUksQ0FBQzFkLGNBQWMsQ0FBQzBkLE1BQU0sQ0FBQ3pkLElBQUksQ0FBQ0MsY0FBYyxDQUFDLENBQUE7QUFDbkQsT0FBQTtBQUNKLEtBQUMsTUFBTTtBQUNILE1BQUEsSUFBSSxDQUFDRixjQUFjLENBQUMsSUFBSSxDQUFDbUMsa0JBQWtCLENBQUMsQ0FBQTtBQUNoRCxLQUFBO0FBRUF3YyxJQUFBQSxhQUFhLENBQUNRLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNwQyxHQUFBOztBQVNBc0MsRUFBQUEsU0FBUyxHQUFHO0FBRVI5QyxJQUFBQSxhQUFhLENBQUNDLGFBQWEsQ0FBQyxJQUFJLEVBQUcsWUFBVyxDQUFDLENBQUE7SUFFL0MsSUFBSSxDQUFDNEIsaUJBQWlCLEVBQUUsQ0FBQTs7QUFHeEIsSUFBQSxNQUFNOUMsTUFBTSxHQUFHLElBQUksQ0FBQ3hNLFlBQVksQ0FBQTtBQUNoQyxJQUFBLElBQUl3TSxNQUFNLEVBQUU7QUFFUixNQUFBLElBQUksSUFBSSxDQUFDMWIsTUFBTSxJQUFJMGIsTUFBTSxDQUFDZ0UsUUFBUSxHQUFHLENBQUMsSUFBSWhFLE1BQU0sQ0FBQ3NELFdBQVcsRUFBRTtRQUMxRHRELE1BQU0sQ0FBQzNPLE9BQU8sRUFBRSxDQUFBO0FBQ3BCLE9BQUE7O0FBR0EsTUFBQSxNQUFNelAsV0FBVyxHQUFHb2UsTUFBTSxDQUFDYSxZQUFZLENBQUE7TUFDdkMsSUFBSWpmLFdBQVcsSUFBSUEsV0FBVyxDQUFDVyxJQUFJLENBQUNnaEIsVUFBVSxJQUFJM2hCLFdBQVcsQ0FBQ1IsT0FBTyxLQUFLUSxXQUFXLENBQUM0aEIsR0FBRyxJQUFJLElBQUksQ0FBQ2xmLE1BQU0sQ0FBQyxFQUFFO1FBR3ZHLElBQUksQ0FBQ21mLGFBQWEsQ0FBQyxJQUFJLENBQUNwTCxtQkFBbUIsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUNoRCxRQUFBLElBQUksQ0FBQzdaLFdBQVcsQ0FBQ29ELFdBQVcsQ0FBQyxDQUFBO1FBQzdCLElBQUksQ0FBQ3pELEVBQUUsQ0FBQ3VsQixjQUFjLENBQUM5aEIsV0FBVyxDQUFDVyxJQUFJLENBQUNvaEIsU0FBUyxDQUFDLENBQUE7QUFDdEQsT0FBQTtBQUNKLEtBQUE7QUFFQTFDLElBQUFBLGFBQWEsQ0FBQ1EsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ3BDLEdBQUE7O0VBUUF3QyxjQUFjLENBQUNDLEtBQUssRUFBRTtBQUNsQixJQUFBLElBQUksSUFBSSxDQUFDbkYsV0FBVyxLQUFLbUYsS0FBSyxFQUFFO01BQzVCLElBQUksQ0FBQ25GLFdBQVcsR0FBR21GLEtBQUssQ0FBQTs7QUFJeEIsTUFBQSxNQUFNL2xCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtNQUNsQkEsRUFBRSxDQUFDeWdCLFdBQVcsQ0FBQ3pnQixFQUFFLENBQUM2Z0IsbUJBQW1CLEVBQUVrRixLQUFLLENBQUMsQ0FBQTtBQUNqRCxLQUFBO0FBQ0osR0FBQTs7RUFTQUMseUJBQXlCLENBQUM1Z0IsZ0JBQWdCLEVBQUU7QUFDeEMsSUFBQSxJQUFJLElBQUksQ0FBQzBiLHNCQUFzQixLQUFLMWIsZ0JBQWdCLEVBQUU7TUFDbEQsSUFBSSxDQUFDMGIsc0JBQXNCLEdBQUcxYixnQkFBZ0IsQ0FBQTs7QUFJOUMsTUFBQSxNQUFNcEYsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBO01BQ2xCQSxFQUFFLENBQUN5Z0IsV0FBVyxDQUFDemdCLEVBQUUsQ0FBQytnQiw4QkFBOEIsRUFBRTNiLGdCQUFnQixDQUFDLENBQUE7QUFDdkUsS0FBQTtBQUNKLEdBQUE7O0VBUUFrZ0IsYUFBYSxDQUFDL0QsV0FBVyxFQUFFO0FBQ3ZCLElBQUEsSUFBSSxJQUFJLENBQUNBLFdBQVcsS0FBS0EsV0FBVyxFQUFFO0FBQ2xDLE1BQUEsSUFBSSxDQUFDdmhCLEVBQUUsQ0FBQ3NsQixhQUFhLENBQUMsSUFBSSxDQUFDdGxCLEVBQUUsQ0FBQ2ltQixRQUFRLEdBQUcxRSxXQUFXLENBQUMsQ0FBQTtNQUNyRCxJQUFJLENBQUNBLFdBQVcsR0FBR0EsV0FBVyxDQUFBO0FBQ2xDLEtBQUE7QUFDSixHQUFBOztFQVFBbGhCLFdBQVcsQ0FBQ0YsT0FBTyxFQUFFO0FBQ2pCLElBQUEsTUFBTWlFLElBQUksR0FBR2pFLE9BQU8sQ0FBQ2lFLElBQUksQ0FBQTtBQUN6QixJQUFBLE1BQU04aEIsYUFBYSxHQUFHOWhCLElBQUksQ0FBQ29oQixTQUFTLENBQUE7QUFDcEMsSUFBQSxNQUFNVyxhQUFhLEdBQUcvaEIsSUFBSSxDQUFDZ2hCLFVBQVUsQ0FBQTtBQUNyQyxJQUFBLE1BQU03RCxXQUFXLEdBQUcsSUFBSSxDQUFDQSxXQUFXLENBQUE7QUFDcEMsSUFBQSxNQUFNbUUsSUFBSSxHQUFHLElBQUksQ0FBQy9VLFlBQVksQ0FBQ3VWLGFBQWEsQ0FBQyxDQUFBO0lBQzdDLElBQUksSUFBSSxDQUFDMUUsWUFBWSxDQUFDRCxXQUFXLENBQUMsQ0FBQ21FLElBQUksQ0FBQyxLQUFLUyxhQUFhLEVBQUU7TUFDeEQsSUFBSSxDQUFDbm1CLEVBQUUsQ0FBQ0ssV0FBVyxDQUFDNmxCLGFBQWEsRUFBRUMsYUFBYSxDQUFDLENBQUE7TUFDakQsSUFBSSxDQUFDM0UsWUFBWSxDQUFDRCxXQUFXLENBQUMsQ0FBQ21FLElBQUksQ0FBQyxHQUFHUyxhQUFhLENBQUE7QUFDeEQsS0FBQTtBQUNKLEdBQUE7O0FBVUFDLEVBQUFBLGlCQUFpQixDQUFDam1CLE9BQU8sRUFBRW9oQixXQUFXLEVBQUU7QUFDcEMsSUFBQSxNQUFNbmQsSUFBSSxHQUFHakUsT0FBTyxDQUFDaUUsSUFBSSxDQUFBO0FBQ3pCLElBQUEsTUFBTThoQixhQUFhLEdBQUc5aEIsSUFBSSxDQUFDb2hCLFNBQVMsQ0FBQTtBQUNwQyxJQUFBLE1BQU1XLGFBQWEsR0FBRy9oQixJQUFJLENBQUNnaEIsVUFBVSxDQUFBO0FBQ3JDLElBQUEsTUFBTU0sSUFBSSxHQUFHLElBQUksQ0FBQy9VLFlBQVksQ0FBQ3VWLGFBQWEsQ0FBQyxDQUFBO0lBQzdDLElBQUksSUFBSSxDQUFDMUUsWUFBWSxDQUFDRCxXQUFXLENBQUMsQ0FBQ21FLElBQUksQ0FBQyxLQUFLUyxhQUFhLEVBQUU7QUFDeEQsTUFBQSxJQUFJLENBQUNiLGFBQWEsQ0FBQy9ELFdBQVcsQ0FBQyxDQUFBO01BQy9CLElBQUksQ0FBQ3ZoQixFQUFFLENBQUNLLFdBQVcsQ0FBQzZsQixhQUFhLEVBQUVDLGFBQWEsQ0FBQyxDQUFBO01BQ2pELElBQUksQ0FBQzNFLFlBQVksQ0FBQ0QsV0FBVyxDQUFDLENBQUNtRSxJQUFJLENBQUMsR0FBR1MsYUFBYSxDQUFBO0FBQ3hELEtBQUE7QUFDSixHQUFBOztFQVFBRSxvQkFBb0IsQ0FBQ2xtQixPQUFPLEVBQUU7QUFDMUIsSUFBQSxNQUFNSCxFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7QUFDbEIsSUFBQSxNQUFNdUosS0FBSyxHQUFHcEosT0FBTyxDQUFDbW1CLGVBQWUsQ0FBQTtBQUNyQyxJQUFBLE1BQU16RSxNQUFNLEdBQUcxaEIsT0FBTyxDQUFDaUUsSUFBSSxDQUFDb2hCLFNBQVMsQ0FBQTtJQUVyQyxJQUFJamMsS0FBSyxHQUFHLENBQUMsRUFBRTtBQUNYLE1BQUEsSUFBSWdkLE1BQU0sR0FBR3BtQixPQUFPLENBQUNxbUIsVUFBVSxDQUFBO01BQy9CLElBQUssQ0FBQ3JtQixPQUFPLENBQUNrbEIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDbGYsTUFBTSxJQUFLLENBQUNoRyxPQUFPLENBQUNzbUIsUUFBUSxJQUFLdG1CLE9BQU8sQ0FBQ3VtQixXQUFXLElBQUl2bUIsT0FBTyxDQUFDd21CLE9BQU8sQ0FBQzVlLE1BQU0sS0FBSyxDQUFFLEVBQUU7QUFDOUcsUUFBQSxJQUFJd2UsTUFBTSxLQUFLSyw2QkFBNkIsSUFBSUwsTUFBTSxLQUFLTSw0QkFBNEIsRUFBRTtBQUNyRk4sVUFBQUEsTUFBTSxHQUFHcGpCLGNBQWMsQ0FBQTtTQUMxQixNQUFNLElBQUlvakIsTUFBTSxLQUFLTyw0QkFBNEIsSUFBSVAsTUFBTSxLQUFLUSwyQkFBMkIsRUFBRTtBQUMxRlIsVUFBQUEsTUFBTSxHQUFHUyxhQUFhLENBQUE7QUFDMUIsU0FBQTtBQUNKLE9BQUE7QUFDQWhuQixNQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ3NoQixNQUFNLEVBQUU3aEIsRUFBRSxDQUFDUSxrQkFBa0IsRUFBRSxJQUFJLENBQUN1TSxRQUFRLENBQUN3WixNQUFNLENBQUMsQ0FBQyxDQUFBO0FBQzFFLEtBQUE7SUFDQSxJQUFJaGQsS0FBSyxHQUFHLENBQUMsRUFBRTtBQUNYdkosTUFBQUEsRUFBRSxDQUFDTyxhQUFhLENBQUNzaEIsTUFBTSxFQUFFN2hCLEVBQUUsQ0FBQ1Usa0JBQWtCLEVBQUUsSUFBSSxDQUFDcU0sUUFBUSxDQUFDNU0sT0FBTyxDQUFDOG1CLFVBQVUsQ0FBQyxDQUFDLENBQUE7QUFDdEYsS0FBQTtJQUNBLElBQUkxZCxLQUFLLEdBQUcsQ0FBQyxFQUFFO01BQ1gsSUFBSSxJQUFJLENBQUNwRCxNQUFNLEVBQUU7QUFDYm5HLFFBQUFBLEVBQUUsQ0FBQ08sYUFBYSxDQUFDc2hCLE1BQU0sRUFBRTdoQixFQUFFLENBQUNXLGNBQWMsRUFBRSxJQUFJLENBQUMrSSxTQUFTLENBQUN2SixPQUFPLENBQUMrbUIsU0FBUyxDQUFDLENBQUMsQ0FBQTtBQUNsRixPQUFDLE1BQU07UUFFSGxuQixFQUFFLENBQUNPLGFBQWEsQ0FBQ3NoQixNQUFNLEVBQUU3aEIsRUFBRSxDQUFDVyxjQUFjLEVBQUUsSUFBSSxDQUFDK0ksU0FBUyxDQUFDdkosT0FBTyxDQUFDa2xCLEdBQUcsR0FBR2xsQixPQUFPLENBQUMrbUIsU0FBUyxHQUFHQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUE7QUFDeEgsT0FBQTtBQUNKLEtBQUE7SUFDQSxJQUFJNWQsS0FBSyxHQUFHLENBQUMsRUFBRTtNQUNYLElBQUksSUFBSSxDQUFDcEQsTUFBTSxFQUFFO0FBQ2JuRyxRQUFBQSxFQUFFLENBQUNPLGFBQWEsQ0FBQ3NoQixNQUFNLEVBQUU3aEIsRUFBRSxDQUFDYSxjQUFjLEVBQUUsSUFBSSxDQUFDNkksU0FBUyxDQUFDdkosT0FBTyxDQUFDaW5CLFNBQVMsQ0FBQyxDQUFDLENBQUE7QUFDbEYsT0FBQyxNQUFNO1FBRUhwbkIsRUFBRSxDQUFDTyxhQUFhLENBQUNzaEIsTUFBTSxFQUFFN2hCLEVBQUUsQ0FBQ2EsY0FBYyxFQUFFLElBQUksQ0FBQzZJLFNBQVMsQ0FBQ3ZKLE9BQU8sQ0FBQ2tsQixHQUFHLEdBQUdsbEIsT0FBTyxDQUFDaW5CLFNBQVMsR0FBR0QscUJBQXFCLENBQUMsQ0FBQyxDQUFBO0FBQ3hILE9BQUE7QUFDSixLQUFBO0lBQ0EsSUFBSTVkLEtBQUssR0FBRyxFQUFFLEVBQUU7TUFDWixJQUFJLElBQUksQ0FBQ3BELE1BQU0sRUFBRTtBQUNibkcsUUFBQUEsRUFBRSxDQUFDTyxhQUFhLENBQUNzaEIsTUFBTSxFQUFFN2hCLEVBQUUsQ0FBQ3FuQixjQUFjLEVBQUUsSUFBSSxDQUFDM2QsU0FBUyxDQUFDdkosT0FBTyxDQUFDbW5CLFNBQVMsQ0FBQyxDQUFDLENBQUE7QUFDbEYsT0FBQTtBQUNKLEtBQUE7SUFDQSxJQUFJL2QsS0FBSyxHQUFHLEVBQUUsRUFBRTtNQUNaLElBQUksSUFBSSxDQUFDcEQsTUFBTSxFQUFFO1FBQ2JuRyxFQUFFLENBQUNPLGFBQWEsQ0FBQ3NoQixNQUFNLEVBQUU3aEIsRUFBRSxDQUFDdW5CLG9CQUFvQixFQUFFcG5CLE9BQU8sQ0FBQ3FuQixjQUFjLEdBQUd4bkIsRUFBRSxDQUFDeW5CLHNCQUFzQixHQUFHem5CLEVBQUUsQ0FBQzJnQixJQUFJLENBQUMsQ0FBQTtBQUNuSCxPQUFBO0FBQ0osS0FBQTtJQUNBLElBQUlwWCxLQUFLLEdBQUcsRUFBRSxFQUFFO01BQ1osSUFBSSxJQUFJLENBQUNwRCxNQUFNLEVBQUU7QUFDYm5HLFFBQUFBLEVBQUUsQ0FBQ08sYUFBYSxDQUFDc2hCLE1BQU0sRUFBRTdoQixFQUFFLENBQUMwbkIsb0JBQW9CLEVBQUUsSUFBSSxDQUFDcGMsWUFBWSxDQUFDbkwsT0FBTyxDQUFDd25CLFlBQVksQ0FBQyxDQUFDLENBQUE7QUFDOUYsT0FBQTtBQUNKLEtBQUE7SUFDQSxJQUFJcGUsS0FBSyxHQUFHLEdBQUcsRUFBRTtBQUNiLE1BQUEsTUFBTW1PLEdBQUcsR0FBRyxJQUFJLENBQUNrQiwyQkFBMkIsQ0FBQTtBQUM1QyxNQUFBLElBQUlsQixHQUFHLEVBQUU7QUFDTDFYLFFBQUFBLEVBQUUsQ0FBQzRuQixhQUFhLENBQUMvRixNQUFNLEVBQUVuSyxHQUFHLENBQUNtUSwwQkFBMEIsRUFBRWhWLElBQUksQ0FBQ2lWLEdBQUcsQ0FBQyxDQUFDLEVBQUVqVixJQUFJLENBQUNFLEdBQUcsQ0FBQ0YsSUFBSSxDQUFDa1YsS0FBSyxDQUFDNW5CLE9BQU8sQ0FBQzZuQixXQUFXLENBQUMsRUFBRSxJQUFJLENBQUMxTSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDeEksT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQVNBMk0sRUFBQUEsVUFBVSxDQUFDOW5CLE9BQU8sRUFBRW9oQixXQUFXLEVBQUU7QUFFN0IsSUFBQSxJQUFJLENBQUNwaEIsT0FBTyxDQUFDaUUsSUFBSSxDQUFDZ2hCLFVBQVUsRUFDeEJqbEIsT0FBTyxDQUFDaUUsSUFBSSxDQUFDOGpCLFVBQVUsQ0FBQyxJQUFJLEVBQUUvbkIsT0FBTyxDQUFDLENBQUE7QUFFMUMsSUFBQSxJQUFJQSxPQUFPLENBQUNtbUIsZUFBZSxHQUFHLENBQUMsSUFBSW5tQixPQUFPLENBQUNnb0IsWUFBWSxJQUFJaG9CLE9BQU8sQ0FBQ2lvQixtQkFBbUIsRUFBRTtBQUdwRixNQUFBLElBQUksQ0FBQzlDLGFBQWEsQ0FBQy9ELFdBQVcsQ0FBQyxDQUFBOztBQUcvQixNQUFBLElBQUksQ0FBQ2xoQixXQUFXLENBQUNGLE9BQU8sQ0FBQyxDQUFBO01BRXpCLElBQUlBLE9BQU8sQ0FBQ21tQixlQUFlLEVBQUU7QUFDekIsUUFBQSxJQUFJLENBQUNELG9CQUFvQixDQUFDbG1CLE9BQU8sQ0FBQyxDQUFBO1FBQ2xDQSxPQUFPLENBQUNtbUIsZUFBZSxHQUFHLENBQUMsQ0FBQTtBQUMvQixPQUFBO0FBRUEsTUFBQSxJQUFJbm1CLE9BQU8sQ0FBQ2dvQixZQUFZLElBQUlob0IsT0FBTyxDQUFDaW9CLG1CQUFtQixFQUFFO1FBQ3JEam9CLE9BQU8sQ0FBQ2lFLElBQUksQ0FBQ2lrQixNQUFNLENBQUMsSUFBSSxFQUFFbG9CLE9BQU8sQ0FBQyxDQUFBO1FBQ2xDQSxPQUFPLENBQUNnb0IsWUFBWSxHQUFHLEtBQUssQ0FBQTtRQUM1QmhvQixPQUFPLENBQUNpb0IsbUJBQW1CLEdBQUcsS0FBSyxDQUFBO0FBQ3ZDLE9BQUE7QUFDSixLQUFDLE1BQU07QUFLSCxNQUFBLElBQUksQ0FBQ2hDLGlCQUFpQixDQUFDam1CLE9BQU8sRUFBRW9oQixXQUFXLENBQUMsQ0FBQTtBQUNoRCxLQUFBO0FBQ0osR0FBQTs7RUFHQXJKLGlCQUFpQixDQUFDb1EsYUFBYSxFQUFFO0lBRTdCLElBQUlDLEdBQUcsRUFBRUMsR0FBRyxDQUFBOztBQUdaLElBQUEsTUFBTUMsUUFBUSxHQUFHSCxhQUFhLENBQUN2Z0IsTUFBTSxHQUFHLENBQUMsQ0FBQTtBQUN6QyxJQUFBLElBQUkwZ0IsUUFBUSxFQUFFO0FBR1ZGLE1BQUFBLEdBQUcsR0FBRyxFQUFFLENBQUE7QUFDUixNQUFBLEtBQUssSUFBSXpnQixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd3Z0IsYUFBYSxDQUFDdmdCLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDM0MsUUFBQSxNQUFNNE0sWUFBWSxHQUFHNFQsYUFBYSxDQUFDeGdCLENBQUMsQ0FBQyxDQUFBO1FBQ3JDeWdCLEdBQUcsSUFBSTdULFlBQVksQ0FBQ2dVLEVBQUUsR0FBR2hVLFlBQVksQ0FBQzdSLE1BQU0sQ0FBQzhsQixnQkFBZ0IsQ0FBQTtBQUNqRSxPQUFBOztNQUdBSCxHQUFHLEdBQUcsSUFBSSxDQUFDckgsT0FBTyxDQUFDeUgsR0FBRyxDQUFDTCxHQUFHLENBQUMsQ0FBQTtBQUMvQixLQUFBOztJQUdBLElBQUksQ0FBQ0MsR0FBRyxFQUFFO0FBR04sTUFBQSxNQUFNeG9CLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQndvQixNQUFBQSxHQUFHLEdBQUd4b0IsRUFBRSxDQUFDa1ksaUJBQWlCLEVBQUUsQ0FBQTtBQUM1QmxZLE1BQUFBLEVBQUUsQ0FBQ3dZLGVBQWUsQ0FBQ2dRLEdBQUcsQ0FBQyxDQUFBOztNQUd2QnhvQixFQUFFLENBQUM2b0IsVUFBVSxDQUFDN29CLEVBQUUsQ0FBQzhvQixvQkFBb0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtNQUU1QyxJQUFJQyxPQUFPLEdBQUcsS0FBSyxDQUFBO0FBQ25CLE1BQUEsS0FBSyxJQUFJamhCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3dnQixhQUFhLENBQUN2Z0IsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUczQyxRQUFBLE1BQU00TSxZQUFZLEdBQUc0VCxhQUFhLENBQUN4Z0IsQ0FBQyxDQUFDLENBQUE7QUFDckM5SCxRQUFBQSxFQUFFLENBQUM2b0IsVUFBVSxDQUFDN29CLEVBQUUsQ0FBQ2dwQixZQUFZLEVBQUV0VSxZQUFZLENBQUN0USxJQUFJLENBQUM2a0IsUUFBUSxDQUFDLENBQUE7O0FBRzFELFFBQUEsTUFBTUMsUUFBUSxHQUFHeFUsWUFBWSxDQUFDN1IsTUFBTSxDQUFDcW1CLFFBQVEsQ0FBQTtBQUM3QyxRQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxRQUFRLENBQUNuaEIsTUFBTSxFQUFFb2hCLENBQUMsRUFBRSxFQUFFO0FBQ3RDLFVBQUEsTUFBTXRqQixDQUFDLEdBQUdxakIsUUFBUSxDQUFDQyxDQUFDLENBQUMsQ0FBQTtBQUNyQixVQUFBLE1BQU1DLEdBQUcsR0FBR0Msa0JBQWtCLENBQUN4akIsQ0FBQyxDQUFDckQsSUFBSSxDQUFDLENBQUE7VUFFdEMsSUFBSTRtQixHQUFHLEtBQUssQ0FBQyxFQUFFO0FBQ1hMLFlBQUFBLE9BQU8sR0FBRyxJQUFJLENBQUE7QUFDbEIsV0FBQTtBQUVBL29CLFVBQUFBLEVBQUUsQ0FBQ3NwQixtQkFBbUIsQ0FBQ0YsR0FBRyxFQUFFdmpCLENBQUMsQ0FBQzBqQixhQUFhLEVBQUUsSUFBSSxDQUFDMWIsTUFBTSxDQUFDaEksQ0FBQyxDQUFDMmpCLFFBQVEsQ0FBQyxFQUFFM2pCLENBQUMsQ0FBQzRqQixTQUFTLEVBQUU1akIsQ0FBQyxDQUFDNmpCLE1BQU0sRUFBRTdqQixDQUFDLENBQUM4akIsTUFBTSxDQUFDLENBQUE7QUFDdEczcEIsVUFBQUEsRUFBRSxDQUFDNHBCLHVCQUF1QixDQUFDUixHQUFHLENBQUMsQ0FBQTtVQUUvQixJQUFJMVUsWUFBWSxDQUFDbVYsVUFBVSxFQUFFO0FBQ3pCN3BCLFlBQUFBLEVBQUUsQ0FBQ2dZLG1CQUFtQixDQUFDb1IsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ2xDLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTs7QUFHQXBwQixNQUFBQSxFQUFFLENBQUN3WSxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUE7O01BR3hCeFksRUFBRSxDQUFDNm9CLFVBQVUsQ0FBQzdvQixFQUFFLENBQUNncEIsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFBOztBQUdwQyxNQUFBLElBQUlQLFFBQVEsRUFBRTtRQUNWLElBQUksQ0FBQ3RILE9BQU8sQ0FBQzJJLEdBQUcsQ0FBQ3ZCLEdBQUcsRUFBRUMsR0FBRyxDQUFDLENBQUE7QUFDOUIsT0FBQTtNQUVBLElBQUksQ0FBQ08sT0FBTyxFQUFFO0FBQ1ZoaUIsUUFBQUEsS0FBSyxDQUFDOFAsSUFBSSxDQUFDLG9LQUFvSyxDQUFDLENBQUE7QUFDcEwsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLE9BQU8yUixHQUFHLENBQUE7QUFDZCxHQUFBO0FBRUE3RCxFQUFBQSxpQkFBaUIsR0FBRztJQUVoQixJQUFJLElBQUksQ0FBQ3RELFFBQVEsRUFBRTtNQUNmLElBQUksQ0FBQ0EsUUFBUSxHQUFHLElBQUksQ0FBQTtBQUNwQixNQUFBLElBQUksQ0FBQ3JoQixFQUFFLENBQUN3WSxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDakMsS0FBQTtBQUNKLEdBQUE7QUFFQXVSLEVBQUFBLFVBQVUsR0FBRztBQUNULElBQUEsTUFBTS9wQixFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7QUFDbEIsSUFBQSxJQUFJd29CLEdBQUcsQ0FBQTs7QUFHUCxJQUFBLElBQUksSUFBSSxDQUFDRixhQUFhLENBQUN2Z0IsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUdqQyxNQUFBLE1BQU0yTSxZQUFZLEdBQUcsSUFBSSxDQUFDNFQsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFBO01BQzFDdmhCLEtBQUssQ0FBQ3lkLE1BQU0sQ0FBQzlQLFlBQVksQ0FBQ3hTLE1BQU0sS0FBSyxJQUFJLEVBQUUsK0RBQStELENBQUMsQ0FBQTtBQUMzRyxNQUFBLElBQUksQ0FBQ3dTLFlBQVksQ0FBQ3RRLElBQUksQ0FBQ29rQixHQUFHLEVBQUU7QUFDeEI5VCxRQUFBQSxZQUFZLENBQUN0USxJQUFJLENBQUNva0IsR0FBRyxHQUFHLElBQUksQ0FBQ3RRLGlCQUFpQixDQUFDLElBQUksQ0FBQ29RLGFBQWEsQ0FBQyxDQUFBO0FBQ3RFLE9BQUE7QUFDQUUsTUFBQUEsR0FBRyxHQUFHOVQsWUFBWSxDQUFDdFEsSUFBSSxDQUFDb2tCLEdBQUcsQ0FBQTtBQUMvQixLQUFDLE1BQU07TUFFSEEsR0FBRyxHQUFHLElBQUksQ0FBQ3RRLGlCQUFpQixDQUFDLElBQUksQ0FBQ29RLGFBQWEsQ0FBQyxDQUFBO0FBQ3BELEtBQUE7O0FBR0EsSUFBQSxJQUFJLElBQUksQ0FBQ2pILFFBQVEsS0FBS21ILEdBQUcsRUFBRTtNQUN2QixJQUFJLENBQUNuSCxRQUFRLEdBQUdtSCxHQUFHLENBQUE7QUFDbkJ4b0IsTUFBQUEsRUFBRSxDQUFDd1ksZUFBZSxDQUFDZ1EsR0FBRyxDQUFDLENBQUE7QUFDM0IsS0FBQTs7QUFHQSxJQUFBLElBQUksQ0FBQ0YsYUFBYSxDQUFDdmdCLE1BQU0sR0FBRyxDQUFDLENBQUE7O0FBSzdCLElBQUEsTUFBTWtoQixRQUFRLEdBQUcsSUFBSSxDQUFDcFUsV0FBVyxHQUFHLElBQUksQ0FBQ0EsV0FBVyxDQUFDelEsSUFBSSxDQUFDNmtCLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDekVqcEIsRUFBRSxDQUFDNm9CLFVBQVUsQ0FBQzdvQixFQUFFLENBQUM4b0Isb0JBQW9CLEVBQUVHLFFBQVEsQ0FBQyxDQUFBO0FBQ3BELEdBQUE7O0FBb0NBZSxFQUFBQSxJQUFJLENBQUNDLFNBQVMsRUFBRUMsWUFBWSxFQUFFQyxXQUFXLEVBQUU7QUFDdkMsSUFBQSxNQUFNbnFCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUVsQixJQUFBLElBQUlvcUIsT0FBTyxFQUFFQyxZQUFZLEVBQUVscUIsT0FBTyxFQUFFbXFCLFdBQVcsQ0FBQTtBQUMvQyxJQUFBLElBQUlsWixPQUFPLEVBQUVtWixPQUFPLEVBQUVDLGNBQWMsRUFBRUMsY0FBYyxDQUFBO0FBQ3BELElBQUEsTUFBTXpWLE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtJQUMxQixJQUFJLENBQUNBLE1BQU0sRUFDUCxPQUFBO0FBQ0osSUFBQSxNQUFNMFYsUUFBUSxHQUFHMVYsTUFBTSxDQUFDNVEsSUFBSSxDQUFDc21CLFFBQVEsQ0FBQTtBQUNyQyxJQUFBLE1BQU1DLFFBQVEsR0FBRzNWLE1BQU0sQ0FBQzVRLElBQUksQ0FBQ3VtQixRQUFRLENBQUE7O0lBR3JDLElBQUksQ0FBQ1IsV0FBVyxFQUFFO01BQ2QsSUFBSSxDQUFDSixVQUFVLEVBQUUsQ0FBQTtBQUNyQixLQUFBOztJQUdBLElBQUl4SSxXQUFXLEdBQUcsQ0FBQyxDQUFBO0FBRW5CLElBQUEsS0FBSyxJQUFJelosQ0FBQyxHQUFHLENBQUMsRUFBRThpQixHQUFHLEdBQUdGLFFBQVEsQ0FBQzNpQixNQUFNLEVBQUVELENBQUMsR0FBRzhpQixHQUFHLEVBQUU5aUIsQ0FBQyxFQUFFLEVBQUU7QUFDakRzaUIsTUFBQUEsT0FBTyxHQUFHTSxRQUFRLENBQUM1aUIsQ0FBQyxDQUFDLENBQUE7QUFDckJ1aUIsTUFBQUEsWUFBWSxHQUFHRCxPQUFPLENBQUNHLE9BQU8sQ0FBQ2xaLEtBQUssQ0FBQTtNQUNwQyxJQUFJLENBQUNnWixZQUFZLEVBQUU7QUFHZixRQUFBLE1BQU1RLFdBQVcsR0FBR1QsT0FBTyxDQUFDRyxPQUFPLENBQUMvbkIsSUFBSSxDQUFBO0FBQ3hDLFFBQUEsSUFBSXFvQixXQUFXLEtBQUssZ0JBQWdCLElBQUlBLFdBQVcsS0FBSyxXQUFXLEVBQUU7QUFDakU5akIsVUFBQUEsS0FBSyxDQUFDK2pCLFFBQVEsQ0FBRSxDQUFZRCxVQUFBQSxFQUFBQSxXQUFZLDJIQUEwSCxDQUFDLENBQUE7QUFDdkssU0FBQTtBQUNBLFFBQUEsSUFBSUEsV0FBVyxLQUFLLGdCQUFnQixJQUFJQSxXQUFXLEtBQUssa0JBQWtCLEVBQUU7QUFDeEU5akIsVUFBQUEsS0FBSyxDQUFDK2pCLFFBQVEsQ0FBRSxDQUFZRCxVQUFBQSxFQUFBQSxXQUFZLDJIQUEwSCxDQUFDLENBQUE7QUFDdkssU0FBQTtBQUdBLFFBQUEsU0FBQTtBQUNKLE9BQUE7O01BRUEsSUFBSVIsWUFBWSxZQUFZL21CLE9BQU8sRUFBRTtBQUNqQ25ELFFBQUFBLE9BQU8sR0FBR2txQixZQUFZLENBQUE7QUFDdEIsUUFBQSxJQUFJLENBQUNwQyxVQUFVLENBQUM5bkIsT0FBTyxFQUFFb2hCLFdBQVcsQ0FBQyxDQUFBO1FBR3JDLElBQUksSUFBSSxDQUFDbE0sWUFBWSxFQUFFO0FBRW5CLFVBQUEsSUFBSSxJQUFJLENBQUNBLFlBQVksQ0FBQ3dRLFFBQVEsR0FBRyxDQUFDLEVBQUU7QUFDaEMsWUFBQSxJQUFJLElBQUksQ0FBQ3hRLFlBQVksQ0FBQzVSLFdBQVcsSUFBSSxJQUFJLENBQUM0UixZQUFZLENBQUM1UixXQUFXLEtBQUt0RCxPQUFPLEVBQUU7QUFDNUU0RyxjQUFBQSxLQUFLLENBQUMwYixLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQTtBQUNuRSxhQUFDLE1BQU0sSUFBSSxJQUFJLENBQUNwTixZQUFZLENBQUMwVixXQUFXLElBQUksSUFBSSxDQUFDMVYsWUFBWSxDQUFDMFYsV0FBVyxLQUFLNXFCLE9BQU8sRUFBRTtBQUNuRjRHLGNBQUFBLEtBQUssQ0FBQzBiLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFBO0FBQ25FLGFBQUE7QUFDSixXQUFBO0FBQ0osU0FBQTtBQUdBLFFBQUEsSUFBSTJILE9BQU8sQ0FBQzFFLElBQUksS0FBS25FLFdBQVcsRUFBRTtVQUM5QnZoQixFQUFFLENBQUNzUixTQUFTLENBQUM4WSxPQUFPLENBQUM3WSxVQUFVLEVBQUVnUSxXQUFXLENBQUMsQ0FBQTtVQUM3QzZJLE9BQU8sQ0FBQzFFLElBQUksR0FBR25FLFdBQVcsQ0FBQTtBQUM5QixTQUFBO0FBQ0FBLFFBQUFBLFdBQVcsRUFBRSxDQUFBO0FBQ2pCLE9BQUMsTUFBTTtBQUNINkksUUFBQUEsT0FBTyxDQUFDWSxLQUFLLENBQUNqakIsTUFBTSxHQUFHLENBQUMsQ0FBQTtRQUN4QnVpQixXQUFXLEdBQUdELFlBQVksQ0FBQ3RpQixNQUFNLENBQUE7UUFDakMsS0FBSyxJQUFJb2hCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR21CLFdBQVcsRUFBRW5CLENBQUMsRUFBRSxFQUFFO0FBQ2xDaHBCLFVBQUFBLE9BQU8sR0FBR2txQixZQUFZLENBQUNsQixDQUFDLENBQUMsQ0FBQTtBQUN6QixVQUFBLElBQUksQ0FBQ2xCLFVBQVUsQ0FBQzluQixPQUFPLEVBQUVvaEIsV0FBVyxDQUFDLENBQUE7QUFFckM2SSxVQUFBQSxPQUFPLENBQUNZLEtBQUssQ0FBQzdCLENBQUMsQ0FBQyxHQUFHNUgsV0FBVyxDQUFBO0FBQzlCQSxVQUFBQSxXQUFXLEVBQUUsQ0FBQTtBQUNqQixTQUFBO1FBQ0F2aEIsRUFBRSxDQUFDaXJCLFVBQVUsQ0FBQ2IsT0FBTyxDQUFDN1ksVUFBVSxFQUFFNlksT0FBTyxDQUFDWSxLQUFLLENBQUMsQ0FBQTtBQUNwRCxPQUFBO0FBQ0osS0FBQTs7QUFHQSxJQUFBLEtBQUssSUFBSWxqQixDQUFDLEdBQUcsQ0FBQyxFQUFFOGlCLEdBQUcsR0FBR0QsUUFBUSxDQUFDNWlCLE1BQU0sRUFBRUQsQ0FBQyxHQUFHOGlCLEdBQUcsRUFBRTlpQixDQUFDLEVBQUUsRUFBRTtBQUNqRHNKLE1BQUFBLE9BQU8sR0FBR3VaLFFBQVEsQ0FBQzdpQixDQUFDLENBQUMsQ0FBQTtNQUNyQnlpQixPQUFPLEdBQUduWixPQUFPLENBQUNtWixPQUFPLENBQUE7TUFDekJDLGNBQWMsR0FBR3BaLE9BQU8sQ0FBQzhaLE9BQU8sQ0FBQTtBQUNoQ1QsTUFBQUEsY0FBYyxHQUFHRixPQUFPLENBQUNZLGFBQWEsQ0FBQ0QsT0FBTyxDQUFBOztBQUc5QyxNQUFBLElBQUlWLGNBQWMsQ0FBQ1ksUUFBUSxLQUFLWCxjQUFjLENBQUNXLFFBQVEsSUFBSVosY0FBYyxDQUFDYSxRQUFRLEtBQUtaLGNBQWMsQ0FBQ1ksUUFBUSxFQUFFO0FBQzVHYixRQUFBQSxjQUFjLENBQUNZLFFBQVEsR0FBR1gsY0FBYyxDQUFDVyxRQUFRLENBQUE7QUFDakRaLFFBQUFBLGNBQWMsQ0FBQ2EsUUFBUSxHQUFHWixjQUFjLENBQUNZLFFBQVEsQ0FBQTs7QUFHakQsUUFBQSxJQUFJZCxPQUFPLENBQUNsWixLQUFLLEtBQUssSUFBSSxFQUFFO0FBQ3hCLFVBQUEsSUFBSSxDQUFDRixjQUFjLENBQUNDLE9BQU8sQ0FBQ29ZLFFBQVEsQ0FBQyxDQUFDcFksT0FBTyxFQUFFbVosT0FBTyxDQUFDbFosS0FBSyxDQUFDLENBQUE7QUFDakUsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxJQUFJLElBQUksQ0FBQ2xMLE1BQU0sSUFBSSxJQUFJLENBQUNtYix1QkFBdUIsRUFBRTtBQUU3Q3RoQixNQUFBQSxFQUFFLENBQUNzckIsY0FBYyxDQUFDdHJCLEVBQUUsQ0FBQ3VyQix5QkFBeUIsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDakssdUJBQXVCLENBQUNsZCxJQUFJLENBQUM2a0IsUUFBUSxDQUFDLENBQUE7QUFDOUZqcEIsTUFBQUEsRUFBRSxDQUFDd3JCLHNCQUFzQixDQUFDeHJCLEVBQUUsQ0FBQ3NOLE1BQU0sQ0FBQyxDQUFBO0FBQ3hDLEtBQUE7SUFFQSxNQUFNbWUsSUFBSSxHQUFHLElBQUksQ0FBQ3BlLFdBQVcsQ0FBQzRjLFNBQVMsQ0FBQzlrQixJQUFJLENBQUMsQ0FBQTtBQUM3QyxJQUFBLE1BQU11bUIsS0FBSyxHQUFHekIsU0FBUyxDQUFDeUIsS0FBSyxDQUFBO0lBRTdCLElBQUl6QixTQUFTLENBQUMwQixPQUFPLEVBQUU7QUFDbkIsTUFBQSxNQUFNOVcsV0FBVyxHQUFHLElBQUksQ0FBQ0EsV0FBVyxDQUFBO01BQ3BDOU4sS0FBSyxDQUFDeWQsTUFBTSxDQUFDM1AsV0FBVyxDQUFDM1MsTUFBTSxLQUFLLElBQUksRUFBRSw4REFBOEQsQ0FBQyxDQUFBO0FBRXpHLE1BQUEsTUFBTVcsTUFBTSxHQUFHZ1MsV0FBVyxDQUFDelEsSUFBSSxDQUFDd25CLFFBQVEsQ0FBQTtNQUN4QyxNQUFNakMsTUFBTSxHQUFHTSxTQUFTLENBQUM0QixJQUFJLEdBQUdoWCxXQUFXLENBQUNpWCxhQUFhLENBQUE7TUFFekQsSUFBSTVCLFlBQVksR0FBRyxDQUFDLEVBQUU7QUFDbEJscUIsUUFBQUEsRUFBRSxDQUFDOFgscUJBQXFCLENBQUMyVCxJQUFJLEVBQUVDLEtBQUssRUFBRTdvQixNQUFNLEVBQUU4bUIsTUFBTSxFQUFFTyxZQUFZLENBQUMsQ0FBQTtBQUN2RSxPQUFDLE1BQU07UUFDSGxxQixFQUFFLENBQUMrckIsWUFBWSxDQUFDTixJQUFJLEVBQUVDLEtBQUssRUFBRTdvQixNQUFNLEVBQUU4bUIsTUFBTSxDQUFDLENBQUE7QUFDaEQsT0FBQTtBQUNKLEtBQUMsTUFBTTtBQUNILE1BQUEsTUFBTXFDLEtBQUssR0FBRy9CLFNBQVMsQ0FBQzRCLElBQUksQ0FBQTtNQUU1QixJQUFJM0IsWUFBWSxHQUFHLENBQUMsRUFBRTtRQUNsQmxxQixFQUFFLENBQUMyWCxtQkFBbUIsQ0FBQzhULElBQUksRUFBRU8sS0FBSyxFQUFFTixLQUFLLEVBQUV4QixZQUFZLENBQUMsQ0FBQTtBQUM1RCxPQUFDLE1BQU07UUFDSGxxQixFQUFFLENBQUNpc0IsVUFBVSxDQUFDUixJQUFJLEVBQUVPLEtBQUssRUFBRU4sS0FBSyxDQUFDLENBQUE7QUFDckMsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLElBQUksSUFBSSxDQUFDdmxCLE1BQU0sSUFBSSxJQUFJLENBQUNtYix1QkFBdUIsRUFBRTtNQUU3Q3RoQixFQUFFLENBQUNrc0Isb0JBQW9CLEVBQUUsQ0FBQTtNQUN6QmxzQixFQUFFLENBQUNzckIsY0FBYyxDQUFDdHJCLEVBQUUsQ0FBQ3VyQix5QkFBeUIsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDNUQsS0FBQTtJQUVBLElBQUksQ0FBQ1ksa0JBQWtCLEVBQUUsQ0FBQTtBQUd6QixJQUFBLElBQUksQ0FBQ0MsY0FBYyxDQUFDbkMsU0FBUyxDQUFDOWtCLElBQUksQ0FBQyxJQUFJOGtCLFNBQVMsQ0FBQ3lCLEtBQUssSUFBSXhCLFlBQVksR0FBRyxDQUFDLEdBQUdBLFlBQVksR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUVsRyxHQUFBOztFQW9DQXJHLEtBQUssQ0FBQzNkLE9BQU8sRUFBRTtBQUNYLElBQUEsTUFBTW1tQixjQUFjLEdBQUcsSUFBSSxDQUFDaGpCLG1CQUFtQixDQUFBO0lBQy9DbkQsT0FBTyxHQUFHQSxPQUFPLElBQUltbUIsY0FBYyxDQUFBO0FBRW5DLElBQUEsTUFBTTlpQixLQUFLLEdBQUlyRCxPQUFPLENBQUNxRCxLQUFLLEtBQUszQixTQUFTLEdBQUl5a0IsY0FBYyxDQUFDOWlCLEtBQUssR0FBR3JELE9BQU8sQ0FBQ3FELEtBQUssQ0FBQTtJQUNsRixJQUFJQSxLQUFLLEtBQUssQ0FBQyxFQUFFO0FBQ2IsTUFBQSxNQUFNdkosRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBOztNQUdsQixJQUFJdUosS0FBSyxHQUFHQyxlQUFlLEVBQUU7QUFDekIsUUFBQSxNQUFNRixLQUFLLEdBQUlwRCxPQUFPLENBQUNvRCxLQUFLLEtBQUsxQixTQUFTLEdBQUl5a0IsY0FBYyxDQUFDL2lCLEtBQUssR0FBR3BELE9BQU8sQ0FBQ29ELEtBQUssQ0FBQTtRQUNsRixJQUFJLENBQUNnakIsYUFBYSxDQUFDaGpCLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRUEsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUVBLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQzFELElBQUksQ0FBQ2lqQixhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDOUMsT0FBQTtNQUVBLElBQUloakIsS0FBSyxHQUFHRSxlQUFlLEVBQUU7QUFFekIsUUFBQSxNQUFNL0YsS0FBSyxHQUFJd0MsT0FBTyxDQUFDeEMsS0FBSyxLQUFLa0UsU0FBUyxHQUFJeWtCLGNBQWMsQ0FBQzNvQixLQUFLLEdBQUd3QyxPQUFPLENBQUN4QyxLQUFLLENBQUE7QUFDbEYsUUFBQSxJQUFJLENBQUM4b0IsYUFBYSxDQUFDOW9CLEtBQUssQ0FBQyxDQUFBO0FBQ3pCLFFBQUEsSUFBSSxDQUFDK29CLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUM1QixPQUFBO01BRUEsSUFBSWxqQixLQUFLLEdBQUcrYSxpQkFBaUIsRUFBRTtBQUUzQixRQUFBLE1BQU1uZCxPQUFPLEdBQUlqQixPQUFPLENBQUNpQixPQUFPLEtBQUtTLFNBQVMsR0FBSXlrQixjQUFjLENBQUNsbEIsT0FBTyxHQUFHakIsT0FBTyxDQUFDaUIsT0FBTyxDQUFBO0FBQzFGLFFBQUEsSUFBSSxDQUFDdWxCLGVBQWUsQ0FBQ3ZsQixPQUFPLENBQUMsQ0FBQTtBQUNqQyxPQUFBOztNQUdBbkgsRUFBRSxDQUFDNmpCLEtBQUssQ0FBQyxJQUFJLENBQUN0WCxXQUFXLENBQUNoRCxLQUFLLENBQUMsQ0FBQyxDQUFBO0FBQ3JDLEtBQUE7QUFDSixHQUFBOztFQWNBL0UsVUFBVSxDQUFDQyxDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWQsQ0FBQyxFQUFFM2QsTUFBTSxFQUFFO0FBQzNCLElBQUEsTUFBTXRFLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtJQUNsQkEsRUFBRSxDQUFDd0UsVUFBVSxDQUFDQyxDQUFDLEVBQUVDLENBQUMsRUFBRUUsQ0FBQyxFQUFFcWQsQ0FBQyxFQUFFamlCLEVBQUUsQ0FBQ2UsSUFBSSxFQUFFZixFQUFFLENBQUMyRixhQUFhLEVBQUVyQixNQUFNLENBQUMsQ0FBQTtBQUNoRSxHQUFBOztFQVNBa29CLGFBQWEsQ0FBQzlvQixLQUFLLEVBQUU7QUFDakIsSUFBQSxJQUFJQSxLQUFLLEtBQUssSUFBSSxDQUFDK2IsVUFBVSxFQUFFO0FBQzNCLE1BQUEsSUFBSSxDQUFDemYsRUFBRSxDQUFDeWYsVUFBVSxDQUFDL2IsS0FBSyxDQUFDLENBQUE7TUFDekIsSUFBSSxDQUFDK2IsVUFBVSxHQUFHL2IsS0FBSyxDQUFBO0FBQzNCLEtBQUE7QUFDSixHQUFBOztFQVdBNG9CLGFBQWEsQ0FBQ3JJLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsRUFBRTtBQUN0QixJQUFBLE1BQU11SSxDQUFDLEdBQUcsSUFBSSxDQUFDak4sVUFBVSxDQUFBO0lBQ3pCLElBQUt1RSxDQUFDLEtBQUswSSxDQUFDLENBQUMxSSxDQUFDLElBQU1DLENBQUMsS0FBS3lJLENBQUMsQ0FBQ3pJLENBQUUsSUFBS0MsQ0FBQyxLQUFLd0ksQ0FBQyxDQUFDeEksQ0FBRSxJQUFLQyxDQUFDLEtBQUt1SSxDQUFDLENBQUN2SSxDQUFFLEVBQUU7QUFDMUQsTUFBQSxJQUFJLENBQUNwa0IsRUFBRSxDQUFDMGYsVUFBVSxDQUFDdUUsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxDQUFDLENBQUE7QUFDOUIsTUFBQSxJQUFJLENBQUMxRSxVQUFVLENBQUNvSyxHQUFHLENBQUM3RixDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLENBQUMsQ0FBQTtBQUNuQyxLQUFBO0FBQ0osR0FBQTs7RUFPQXNJLGVBQWUsQ0FBQ3JiLEtBQUssRUFBRTtBQUNuQixJQUFBLElBQUlBLEtBQUssS0FBSyxJQUFJLENBQUNzTyxZQUFZLEVBQUU7QUFDN0IsTUFBQSxJQUFJLENBQUMzZixFQUFFLENBQUMyZixZQUFZLENBQUN0TyxLQUFLLENBQUMsQ0FBQTtNQUMzQixJQUFJLENBQUNzTyxZQUFZLEdBQUd0TyxLQUFLLENBQUE7QUFDN0IsS0FBQTtBQUNKLEdBQUE7O0FBVUF1YixFQUFBQSxZQUFZLEdBQUc7SUFDWCxPQUFPLElBQUksQ0FBQ25QLFNBQVMsQ0FBQTtBQUN6QixHQUFBOztFQVVBb1AsWUFBWSxDQUFDcFAsU0FBUyxFQUFFO0FBQ3BCLElBQUEsSUFBSSxJQUFJLENBQUNBLFNBQVMsS0FBS0EsU0FBUyxFQUFFO0FBQzlCLE1BQUEsTUFBTXpkLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQixNQUFBLElBQUl5ZCxTQUFTLEVBQUU7QUFDWHpkLFFBQUFBLEVBQUUsQ0FBQ3NkLE1BQU0sQ0FBQ3RkLEVBQUUsQ0FBQzBkLFVBQVUsQ0FBQyxDQUFBO0FBQzVCLE9BQUMsTUFBTTtBQUNIMWQsUUFBQUEsRUFBRSxDQUFDK2IsT0FBTyxDQUFDL2IsRUFBRSxDQUFDMGQsVUFBVSxDQUFDLENBQUE7QUFDN0IsT0FBQTtNQUNBLElBQUksQ0FBQ0QsU0FBUyxHQUFHQSxTQUFTLENBQUE7QUFDOUIsS0FBQTtBQUNKLEdBQUE7O0VBaUJBcVAsWUFBWSxDQUFDQyxJQUFJLEVBQUU7QUFDZixJQUFBLElBQUksSUFBSSxDQUFDcFAsU0FBUyxLQUFLb1AsSUFBSSxFQUFFLE9BQUE7SUFDN0IsSUFBSSxDQUFDL3NCLEVBQUUsQ0FBQzJkLFNBQVMsQ0FBQyxJQUFJLENBQUNyUyxZQUFZLENBQUN5aEIsSUFBSSxDQUFDLENBQUMsQ0FBQTtJQUMxQyxJQUFJLENBQUNwUCxTQUFTLEdBQUdvUCxJQUFJLENBQUE7QUFDekIsR0FBQTs7QUFVQUMsRUFBQUEsYUFBYSxHQUFHO0lBQ1osT0FBTyxJQUFJLENBQUNuUCxVQUFVLENBQUE7QUFDMUIsR0FBQTs7RUFVQTRPLGFBQWEsQ0FBQ1EsVUFBVSxFQUFFO0FBQ3RCLElBQUEsSUFBSSxJQUFJLENBQUNwUCxVQUFVLEtBQUtvUCxVQUFVLEVBQUU7QUFDaEMsTUFBQSxJQUFJLENBQUNqdEIsRUFBRSxDQUFDOGQsU0FBUyxDQUFDbVAsVUFBVSxDQUFDLENBQUE7TUFDN0IsSUFBSSxDQUFDcFAsVUFBVSxHQUFHb1AsVUFBVSxDQUFBO0FBQ2hDLEtBQUE7QUFDSixHQUFBOztFQWNBVixhQUFhLENBQUN4UCxRQUFRLEVBQUVDLFVBQVUsRUFBRUMsU0FBUyxFQUFFQyxVQUFVLEVBQUU7SUFDdkQsSUFBSyxJQUFJLENBQUNILFFBQVEsS0FBS0EsUUFBUSxJQUMxQixJQUFJLENBQUNDLFVBQVUsS0FBS0EsVUFBVyxJQUMvQixJQUFJLENBQUNDLFNBQVMsS0FBS0EsU0FBVSxJQUM3QixJQUFJLENBQUNDLFVBQVUsS0FBS0EsVUFBVyxFQUFFO0FBQ2xDLE1BQUEsSUFBSSxDQUFDbGQsRUFBRSxDQUFDbWQsU0FBUyxDQUFDSixRQUFRLEVBQUVDLFVBQVUsRUFBRUMsU0FBUyxFQUFFQyxVQUFVLENBQUMsQ0FBQTtNQUM5RCxJQUFJLENBQUNILFFBQVEsR0FBR0EsUUFBUSxDQUFBO01BQ3hCLElBQUksQ0FBQ0MsVUFBVSxHQUFHQSxVQUFVLENBQUE7TUFDNUIsSUFBSSxDQUFDQyxTQUFTLEdBQUdBLFNBQVMsQ0FBQTtNQUMxQixJQUFJLENBQUNDLFVBQVUsR0FBR0EsVUFBVSxDQUFBO0FBQ2hDLEtBQUE7QUFDSixHQUFBOztFQVFBZ1Esa0JBQWtCLENBQUNDLEtBQUssRUFBRTtBQUN0QixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNobkIsTUFBTSxFQUFFLE9BQUE7QUFDbEIsSUFBQSxJQUFJLElBQUksQ0FBQ2daLGVBQWUsS0FBS2dPLEtBQUssRUFBRSxPQUFBO0lBQ3BDLElBQUksQ0FBQ2hPLGVBQWUsR0FBR2dPLEtBQUssQ0FBQTtBQUU1QixJQUFBLElBQUlBLEtBQUssRUFBRTtNQUNQLElBQUksQ0FBQ250QixFQUFFLENBQUNzZCxNQUFNLENBQUMsSUFBSSxDQUFDdGQsRUFBRSxDQUFDcWYsd0JBQXdCLENBQUMsQ0FBQTtBQUNwRCxLQUFDLE1BQU07TUFDSCxJQUFJLENBQUNyZixFQUFFLENBQUMrYixPQUFPLENBQUMsSUFBSSxDQUFDL2IsRUFBRSxDQUFDcWYsd0JBQXdCLENBQUMsQ0FBQTtBQUNyRCxLQUFBO0FBQ0osR0FBQTs7RUFTQStOLDBCQUEwQixDQUFDQyxFQUFFLEVBQUU7QUFDM0IsSUFBQSxJQUFJLElBQUksQ0FBQy9MLHVCQUF1QixLQUFLK0wsRUFBRSxFQUNuQyxPQUFBO0lBRUosSUFBSSxDQUFDL0wsdUJBQXVCLEdBQUcrTCxFQUFFLENBQUE7SUFFakMsSUFBSSxJQUFJLENBQUNsbkIsTUFBTSxFQUFFO0FBQ2IsTUFBQSxNQUFNbkcsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBO0FBQ2xCLE1BQUEsSUFBSXF0QixFQUFFLEVBQUU7QUFDSixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUNsWixRQUFRLEVBQUU7QUFDaEIsVUFBQSxJQUFJLENBQUNBLFFBQVEsR0FBR25VLEVBQUUsQ0FBQ3N0Qix1QkFBdUIsRUFBRSxDQUFBO0FBQ2hELFNBQUE7UUFDQXR0QixFQUFFLENBQUN1dEIscUJBQXFCLENBQUN2dEIsRUFBRSxDQUFDd3RCLGtCQUFrQixFQUFFLElBQUksQ0FBQ3JaLFFBQVEsQ0FBQyxDQUFBO0FBQ2xFLE9BQUMsTUFBTTtRQUNIblUsRUFBRSxDQUFDdXRCLHFCQUFxQixDQUFDdnRCLEVBQUUsQ0FBQ3d0QixrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN6RCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0VBU0FDLFNBQVMsQ0FBQ0MsRUFBRSxFQUFFO0FBQ1YsSUFBQSxJQUFJLElBQUksQ0FBQ3RPLE1BQU0sS0FBS3NPLEVBQUUsRUFBRSxPQUFBO0lBRXhCLElBQUksQ0FBQ3RPLE1BQU0sR0FBR3NPLEVBQUUsQ0FBQTtJQUVoQixJQUFJLElBQUksQ0FBQ3ZuQixNQUFNLEVBQUU7QUFDYixNQUFBLElBQUl1bkIsRUFBRSxFQUFFO1FBQ0osSUFBSSxDQUFDMXRCLEVBQUUsQ0FBQytiLE9BQU8sQ0FBQyxJQUFJLENBQUMvYixFQUFFLENBQUNzZixrQkFBa0IsQ0FBQyxDQUFBO0FBQy9DLE9BQUMsTUFBTTtRQUNILElBQUksQ0FBQ3RmLEVBQUUsQ0FBQ3NkLE1BQU0sQ0FBQyxJQUFJLENBQUN0ZCxFQUFFLENBQUNzZixrQkFBa0IsQ0FBQyxDQUFBO0FBQzlDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7RUFRQXFPLFlBQVksQ0FBQ0QsRUFBRSxFQUFFO0FBQ2IsSUFBQSxJQUFJLElBQUksQ0FBQ25PLGdCQUFnQixLQUFLbU8sRUFBRSxFQUFFLE9BQUE7SUFFbEMsSUFBSSxDQUFDbk8sZ0JBQWdCLEdBQUdtTyxFQUFFLENBQUE7QUFFMUIsSUFBQSxJQUFJQSxFQUFFLEVBQUU7TUFDSixJQUFJLENBQUMxdEIsRUFBRSxDQUFDc2QsTUFBTSxDQUFDLElBQUksQ0FBQ3RkLEVBQUUsQ0FBQ3dmLG1CQUFtQixDQUFDLENBQUE7QUFDL0MsS0FBQyxNQUFNO01BQ0gsSUFBSSxDQUFDeGYsRUFBRSxDQUFDK2IsT0FBTyxDQUFDLElBQUksQ0FBQy9iLEVBQUUsQ0FBQ3dmLG1CQUFtQixDQUFDLENBQUE7QUFDaEQsS0FBQTtBQUNKLEdBQUE7O0FBV0FvTyxFQUFBQSxrQkFBa0IsQ0FBQ0MsU0FBUyxFQUFFQyxTQUFTLEVBQUU7SUFDckMsSUFBSSxDQUFDOXRCLEVBQUUsQ0FBQyt0QixhQUFhLENBQUNELFNBQVMsRUFBRUQsU0FBUyxDQUFDLENBQUE7QUFDL0MsR0FBQTs7QUFPQUcsRUFBQUEsV0FBVyxHQUFHO0lBQ1YsT0FBTyxJQUFJLENBQUNsUyxRQUFRLENBQUE7QUFDeEIsR0FBQTs7RUFPQW1TLFdBQVcsQ0FBQ25TLFFBQVEsRUFBRTtBQUNsQixJQUFBLElBQUksSUFBSSxDQUFDQSxRQUFRLEtBQUtBLFFBQVEsRUFBRTtBQUM1QixNQUFBLE1BQU05YixFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7QUFDbEIsTUFBQSxJQUFJOGIsUUFBUSxFQUFFO0FBQ1Y5YixRQUFBQSxFQUFFLENBQUNzZCxNQUFNLENBQUN0ZCxFQUFFLENBQUNnYyxLQUFLLENBQUMsQ0FBQTtBQUN2QixPQUFDLE1BQU07QUFDSGhjLFFBQUFBLEVBQUUsQ0FBQytiLE9BQU8sQ0FBQy9iLEVBQUUsQ0FBQ2djLEtBQUssQ0FBQyxDQUFBO0FBQ3hCLE9BQUE7TUFDQSxJQUFJLENBQUNGLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0FBQzVCLEtBQUE7QUFDSixHQUFBOztFQU9Bb1MsY0FBYyxDQUFDNVEsTUFBTSxFQUFFO0FBQ25CLElBQUEsSUFBSSxJQUFJLENBQUNuVyxPQUFPLEtBQUttVyxNQUFNLEVBQUU7QUFDekIsTUFBQSxNQUFNdGQsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBO0FBQ2xCLE1BQUEsSUFBSXNkLE1BQU0sRUFBRTtBQUNSdGQsUUFBQUEsRUFBRSxDQUFDc2QsTUFBTSxDQUFDdGQsRUFBRSxDQUFDK2QsWUFBWSxDQUFDLENBQUE7QUFDOUIsT0FBQyxNQUFNO0FBQ0gvZCxRQUFBQSxFQUFFLENBQUMrYixPQUFPLENBQUMvYixFQUFFLENBQUMrZCxZQUFZLENBQUMsQ0FBQTtBQUMvQixPQUFBO01BQ0EsSUFBSSxDQUFDNVcsT0FBTyxHQUFHbVcsTUFBTSxDQUFBO0FBQ3pCLEtBQUE7QUFDSixHQUFBOztBQXFCQTZRLEVBQUFBLGNBQWMsQ0FBQ3BCLElBQUksRUFBRXFCLEdBQUcsRUFBRUMsSUFBSSxFQUFFO0FBQzVCLElBQUEsSUFBSSxJQUFJLENBQUNyUSxnQkFBZ0IsS0FBSytPLElBQUksSUFBSSxJQUFJLENBQUM1TyxlQUFlLEtBQUtpUSxHQUFHLElBQUksSUFBSSxDQUFDL1AsZ0JBQWdCLEtBQUtnUSxJQUFJLElBQ2hHLElBQUksQ0FBQ3BRLGVBQWUsS0FBSzhPLElBQUksSUFBSSxJQUFJLENBQUMzTyxjQUFjLEtBQUtnUSxHQUFHLElBQUksSUFBSSxDQUFDOVAsZUFBZSxLQUFLK1AsSUFBSSxFQUFFO0FBQy9GLE1BQUEsTUFBTXJ1QixFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7QUFDbEJBLE1BQUFBLEVBQUUsQ0FBQ3VlLFdBQVcsQ0FBQyxJQUFJLENBQUNqVCxZQUFZLENBQUN5aEIsSUFBSSxDQUFDLEVBQUVxQixHQUFHLEVBQUVDLElBQUksQ0FBQyxDQUFBO0FBQ2xELE1BQUEsSUFBSSxDQUFDclEsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDQyxlQUFlLEdBQUc4TyxJQUFJLENBQUE7QUFDbkQsTUFBQSxJQUFJLENBQUM1TyxlQUFlLEdBQUcsSUFBSSxDQUFDQyxjQUFjLEdBQUdnUSxHQUFHLENBQUE7QUFDaEQsTUFBQSxJQUFJLENBQUMvUCxnQkFBZ0IsR0FBRyxJQUFJLENBQUNDLGVBQWUsR0FBRytQLElBQUksQ0FBQTtBQUN2RCxLQUFBO0FBQ0osR0FBQTs7QUFvQkFDLEVBQUFBLG1CQUFtQixDQUFDdkIsSUFBSSxFQUFFcUIsR0FBRyxFQUFFQyxJQUFJLEVBQUU7QUFDakMsSUFBQSxJQUFJLElBQUksQ0FBQ3JRLGdCQUFnQixLQUFLK08sSUFBSSxJQUFJLElBQUksQ0FBQzVPLGVBQWUsS0FBS2lRLEdBQUcsSUFBSSxJQUFJLENBQUMvUCxnQkFBZ0IsS0FBS2dRLElBQUksRUFBRTtBQUNsRyxNQUFBLE1BQU1ydUIsRUFBRSxHQUFHLElBQUksQ0FBQ0EsRUFBRSxDQUFBO0FBQ2xCQSxNQUFBQSxFQUFFLENBQUN1dUIsbUJBQW1CLENBQUN2dUIsRUFBRSxDQUFDNk0sS0FBSyxFQUFFLElBQUksQ0FBQ3ZCLFlBQVksQ0FBQ3loQixJQUFJLENBQUMsRUFBRXFCLEdBQUcsRUFBRUMsSUFBSSxDQUFDLENBQUE7TUFDcEUsSUFBSSxDQUFDclEsZ0JBQWdCLEdBQUcrTyxJQUFJLENBQUE7TUFDNUIsSUFBSSxDQUFDNU8sZUFBZSxHQUFHaVEsR0FBRyxDQUFBO01BQzFCLElBQUksQ0FBQy9QLGdCQUFnQixHQUFHZ1EsSUFBSSxDQUFBO0FBQ2hDLEtBQUE7QUFDSixHQUFBOztBQW9CQUcsRUFBQUEsa0JBQWtCLENBQUN6QixJQUFJLEVBQUVxQixHQUFHLEVBQUVDLElBQUksRUFBRTtBQUNoQyxJQUFBLElBQUksSUFBSSxDQUFDcFEsZUFBZSxLQUFLOE8sSUFBSSxJQUFJLElBQUksQ0FBQzNPLGNBQWMsS0FBS2dRLEdBQUcsSUFBSSxJQUFJLENBQUM5UCxlQUFlLEtBQUsrUCxJQUFJLEVBQUU7QUFDL0YsTUFBQSxNQUFNcnVCLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQkEsTUFBQUEsRUFBRSxDQUFDdXVCLG1CQUFtQixDQUFDdnVCLEVBQUUsQ0FBQzRNLElBQUksRUFBRSxJQUFJLENBQUN0QixZQUFZLENBQUN5aEIsSUFBSSxDQUFDLEVBQUVxQixHQUFHLEVBQUVDLElBQUksQ0FBQyxDQUFBO01BQ25FLElBQUksQ0FBQ3BRLGVBQWUsR0FBRzhPLElBQUksQ0FBQTtNQUMzQixJQUFJLENBQUMzTyxjQUFjLEdBQUdnUSxHQUFHLENBQUE7TUFDekIsSUFBSSxDQUFDOVAsZUFBZSxHQUFHK1AsSUFBSSxDQUFBO0FBQy9CLEtBQUE7QUFDSixHQUFBOztFQXlCQUksbUJBQW1CLENBQUNDLElBQUksRUFBRUMsS0FBSyxFQUFFQyxLQUFLLEVBQUVDLFNBQVMsRUFBRTtBQUMvQyxJQUFBLElBQUksSUFBSSxDQUFDclEsZ0JBQWdCLEtBQUtrUSxJQUFJLElBQUksSUFBSSxDQUFDL1AsaUJBQWlCLEtBQUtnUSxLQUFLLElBQUksSUFBSSxDQUFDOVAsaUJBQWlCLEtBQUsrUCxLQUFLLElBQ3RHLElBQUksQ0FBQ25RLGVBQWUsS0FBS2lRLElBQUksSUFBSSxJQUFJLENBQUM5UCxnQkFBZ0IsS0FBSytQLEtBQUssSUFBSSxJQUFJLENBQUM3UCxnQkFBZ0IsS0FBSzhQLEtBQUssRUFBRTtNQUNyRyxJQUFJLENBQUM1dUIsRUFBRSxDQUFDaWYsU0FBUyxDQUFDLElBQUksQ0FBQ2xULFdBQVcsQ0FBQzJpQixJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMzaUIsV0FBVyxDQUFDNGlCLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQzVpQixXQUFXLENBQUM2aUIsS0FBSyxDQUFDLENBQUMsQ0FBQTtBQUMzRixNQUFBLElBQUksQ0FBQ3BRLGdCQUFnQixHQUFHLElBQUksQ0FBQ0MsZUFBZSxHQUFHaVEsSUFBSSxDQUFBO0FBQ25ELE1BQUEsSUFBSSxDQUFDL1AsaUJBQWlCLEdBQUcsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRytQLEtBQUssQ0FBQTtBQUN0RCxNQUFBLElBQUksQ0FBQzlQLGlCQUFpQixHQUFHLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUc4UCxLQUFLLENBQUE7QUFDMUQsS0FBQTtJQUNBLElBQUksSUFBSSxDQUFDN1AscUJBQXFCLEtBQUs4UCxTQUFTLElBQUksSUFBSSxDQUFDN1Asb0JBQW9CLEtBQUs2UCxTQUFTLEVBQUU7QUFDckYsTUFBQSxJQUFJLENBQUM3dUIsRUFBRSxDQUFDa2YsV0FBVyxDQUFDMlAsU0FBUyxDQUFDLENBQUE7TUFDOUIsSUFBSSxDQUFDOVAscUJBQXFCLEdBQUc4UCxTQUFTLENBQUE7TUFDdEMsSUFBSSxDQUFDN1Asb0JBQW9CLEdBQUc2UCxTQUFTLENBQUE7QUFDekMsS0FBQTtBQUNKLEdBQUE7O0VBeUJBQyx3QkFBd0IsQ0FBQ0osSUFBSSxFQUFFQyxLQUFLLEVBQUVDLEtBQUssRUFBRUMsU0FBUyxFQUFFO0FBQ3BELElBQUEsSUFBSSxJQUFJLENBQUNyUSxnQkFBZ0IsS0FBS2tRLElBQUksSUFBSSxJQUFJLENBQUMvUCxpQkFBaUIsS0FBS2dRLEtBQUssSUFBSSxJQUFJLENBQUM5UCxpQkFBaUIsS0FBSytQLEtBQUssRUFBRTtBQUN4RyxNQUFBLElBQUksQ0FBQzV1QixFQUFFLENBQUMrdUIsaUJBQWlCLENBQUMsSUFBSSxDQUFDL3VCLEVBQUUsQ0FBQzZNLEtBQUssRUFBRSxJQUFJLENBQUNkLFdBQVcsQ0FBQzJpQixJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMzaUIsV0FBVyxDQUFDNGlCLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQzVpQixXQUFXLENBQUM2aUIsS0FBSyxDQUFDLENBQUMsQ0FBQTtNQUNsSCxJQUFJLENBQUNwUSxnQkFBZ0IsR0FBR2tRLElBQUksQ0FBQTtNQUM1QixJQUFJLENBQUMvUCxpQkFBaUIsR0FBR2dRLEtBQUssQ0FBQTtNQUM5QixJQUFJLENBQUM5UCxpQkFBaUIsR0FBRytQLEtBQUssQ0FBQTtBQUNsQyxLQUFBO0FBQ0EsSUFBQSxJQUFJLElBQUksQ0FBQzdQLHFCQUFxQixLQUFLOFAsU0FBUyxFQUFFO0FBQzFDLE1BQUEsSUFBSSxDQUFDN3VCLEVBQUUsQ0FBQ2d2QixtQkFBbUIsQ0FBQyxJQUFJLENBQUNodkIsRUFBRSxDQUFDNk0sS0FBSyxFQUFFZ2lCLFNBQVMsQ0FBQyxDQUFBO01BQ3JELElBQUksQ0FBQzlQLHFCQUFxQixHQUFHOFAsU0FBUyxDQUFBO0FBQzFDLEtBQUE7QUFDSixHQUFBOztFQXlCQUksdUJBQXVCLENBQUNQLElBQUksRUFBRUMsS0FBSyxFQUFFQyxLQUFLLEVBQUVDLFNBQVMsRUFBRTtBQUNuRCxJQUFBLElBQUksSUFBSSxDQUFDcFEsZUFBZSxLQUFLaVEsSUFBSSxJQUFJLElBQUksQ0FBQzlQLGdCQUFnQixLQUFLK1AsS0FBSyxJQUFJLElBQUksQ0FBQzdQLGdCQUFnQixLQUFLOFAsS0FBSyxFQUFFO0FBQ3JHLE1BQUEsSUFBSSxDQUFDNXVCLEVBQUUsQ0FBQyt1QixpQkFBaUIsQ0FBQyxJQUFJLENBQUMvdUIsRUFBRSxDQUFDNE0sSUFBSSxFQUFFLElBQUksQ0FBQ2IsV0FBVyxDQUFDMmlCLElBQUksQ0FBQyxFQUFFLElBQUksQ0FBQzNpQixXQUFXLENBQUM0aUIsS0FBSyxDQUFDLEVBQUUsSUFBSSxDQUFDNWlCLFdBQVcsQ0FBQzZpQixLQUFLLENBQUMsQ0FBQyxDQUFBO01BQ2pILElBQUksQ0FBQ25RLGVBQWUsR0FBR2lRLElBQUksQ0FBQTtNQUMzQixJQUFJLENBQUM5UCxnQkFBZ0IsR0FBRytQLEtBQUssQ0FBQTtNQUM3QixJQUFJLENBQUM3UCxnQkFBZ0IsR0FBRzhQLEtBQUssQ0FBQTtBQUNqQyxLQUFBO0FBQ0EsSUFBQSxJQUFJLElBQUksQ0FBQzVQLG9CQUFvQixLQUFLNlAsU0FBUyxFQUFFO0FBQ3pDLE1BQUEsSUFBSSxDQUFDN3VCLEVBQUUsQ0FBQ2d2QixtQkFBbUIsQ0FBQyxJQUFJLENBQUNodkIsRUFBRSxDQUFDNE0sSUFBSSxFQUFFaWlCLFNBQVMsQ0FBQyxDQUFBO01BQ3BELElBQUksQ0FBQzdQLG9CQUFvQixHQUFHNlAsU0FBUyxDQUFBO0FBQ3pDLEtBQUE7QUFDSixHQUFBOztBQXlCQUssRUFBQUEsZ0JBQWdCLENBQUNqVCxRQUFRLEVBQUVFLFFBQVEsRUFBRTtBQUNqQyxJQUFBLElBQUksSUFBSSxDQUFDRixRQUFRLEtBQUtBLFFBQVEsSUFBSSxJQUFJLENBQUNFLFFBQVEsS0FBS0EsUUFBUSxJQUFJLElBQUksQ0FBQ0ksa0JBQWtCLEVBQUU7QUFDckYsTUFBQSxJQUFJLENBQUN2YyxFQUFFLENBQUM0YyxTQUFTLENBQUMsSUFBSSxDQUFDdFMsZUFBZSxDQUFDMlIsUUFBUSxDQUFDLEVBQUUsSUFBSSxDQUFDM1IsZUFBZSxDQUFDNlIsUUFBUSxDQUFDLENBQUMsQ0FBQTtNQUNqRixJQUFJLENBQUNGLFFBQVEsR0FBR0EsUUFBUSxDQUFBO01BQ3hCLElBQUksQ0FBQ0UsUUFBUSxHQUFHQSxRQUFRLENBQUE7TUFDeEIsSUFBSSxDQUFDSSxrQkFBa0IsR0FBRyxLQUFLLENBQUE7QUFDbkMsS0FBQTtBQUNKLEdBQUE7O0VBdUJBNFMsd0JBQXdCLENBQUNsVCxRQUFRLEVBQUVFLFFBQVEsRUFBRUUsYUFBYSxFQUFFQyxhQUFhLEVBQUU7QUFDdkUsSUFBQSxJQUFJLElBQUksQ0FBQ0wsUUFBUSxLQUFLQSxRQUFRLElBQUksSUFBSSxDQUFDRSxRQUFRLEtBQUtBLFFBQVEsSUFBSSxJQUFJLENBQUNFLGFBQWEsS0FBS0EsYUFBYSxJQUFJLElBQUksQ0FBQ0MsYUFBYSxLQUFLQSxhQUFhLElBQUksQ0FBQyxJQUFJLENBQUNDLGtCQUFrQixFQUFFO0FBQ3RLLE1BQUEsSUFBSSxDQUFDdmMsRUFBRSxDQUFDb3ZCLGlCQUFpQixDQUFDLElBQUksQ0FBQzlrQixlQUFlLENBQUMyUixRQUFRLENBQUMsRUFBRSxJQUFJLENBQUMzUixlQUFlLENBQUM2UixRQUFRLENBQUMsRUFDOUQsSUFBSSxDQUFDN1IsZUFBZSxDQUFDK1IsYUFBYSxDQUFDLEVBQUUsSUFBSSxDQUFDL1IsZUFBZSxDQUFDZ1MsYUFBYSxDQUFDLENBQUMsQ0FBQTtNQUNuRyxJQUFJLENBQUNMLFFBQVEsR0FBR0EsUUFBUSxDQUFBO01BQ3hCLElBQUksQ0FBQ0UsUUFBUSxHQUFHQSxRQUFRLENBQUE7TUFDeEIsSUFBSSxDQUFDRSxhQUFhLEdBQUdBLGFBQWEsQ0FBQTtNQUNsQyxJQUFJLENBQUNDLGFBQWEsR0FBR0EsYUFBYSxDQUFBO01BQ2xDLElBQUksQ0FBQ0Msa0JBQWtCLEdBQUcsSUFBSSxDQUFBO0FBQ2xDLEtBQUE7QUFDSixHQUFBOztFQWdCQThTLGdCQUFnQixDQUFDN1MsYUFBYSxFQUFFO0lBQzVCLElBQUksSUFBSSxDQUFDQSxhQUFhLEtBQUtBLGFBQWEsSUFBSSxJQUFJLENBQUNHLHFCQUFxQixFQUFFO01BQ3BFLElBQUksQ0FBQzNjLEVBQUUsQ0FBQ3djLGFBQWEsQ0FBQyxJQUFJLENBQUMzUyxlQUFlLENBQUMyUyxhQUFhLENBQUMsQ0FBQyxDQUFBO01BQzFELElBQUksQ0FBQ0EsYUFBYSxHQUFHQSxhQUFhLENBQUE7TUFDbEMsSUFBSSxDQUFDRyxxQkFBcUIsR0FBRyxLQUFLLENBQUE7QUFDdEMsS0FBQTtBQUNKLEdBQUE7O0FBa0JBMlMsRUFBQUEsd0JBQXdCLENBQUM5UyxhQUFhLEVBQUVFLGtCQUFrQixFQUFFO0FBQ3hELElBQUEsSUFBSSxJQUFJLENBQUNGLGFBQWEsS0FBS0EsYUFBYSxJQUFJLElBQUksQ0FBQ0Usa0JBQWtCLEtBQUtBLGtCQUFrQixJQUFJLENBQUMsSUFBSSxDQUFDQyxxQkFBcUIsRUFBRTtBQUN2SCxNQUFBLElBQUksQ0FBQzNjLEVBQUUsQ0FBQ3V2QixxQkFBcUIsQ0FBQyxJQUFJLENBQUMxbEIsZUFBZSxDQUFDMlMsYUFBYSxDQUFDLEVBQUUsSUFBSSxDQUFDM1MsZUFBZSxDQUFDNlMsa0JBQWtCLENBQUMsQ0FBQyxDQUFBO01BQzVHLElBQUksQ0FBQ0YsYUFBYSxHQUFHQSxhQUFhLENBQUE7TUFDbEMsSUFBSSxDQUFDRSxrQkFBa0IsR0FBR0Esa0JBQWtCLENBQUE7TUFDNUMsSUFBSSxDQUFDQyxxQkFBcUIsR0FBRyxJQUFJLENBQUE7QUFDckMsS0FBQTtBQUNKLEdBQUE7O0VBV0E2UyxhQUFhLENBQUN2TCxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7QUFDdEIsSUFBQSxNQUFNdUksQ0FBQyxHQUFHLElBQUksQ0FBQzlQLFVBQVUsQ0FBQTtJQUN6QixJQUFLb0gsQ0FBQyxLQUFLMEksQ0FBQyxDQUFDMUksQ0FBQyxJQUFNQyxDQUFDLEtBQUt5SSxDQUFDLENBQUN6SSxDQUFFLElBQUtDLENBQUMsS0FBS3dJLENBQUMsQ0FBQ3hJLENBQUUsSUFBS0MsQ0FBQyxLQUFLdUksQ0FBQyxDQUFDdkksQ0FBRSxFQUFFO0FBQzFELE1BQUEsSUFBSSxDQUFDcGtCLEVBQUUsQ0FBQzZjLFVBQVUsQ0FBQ29ILENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsQ0FBQyxDQUFBO01BQzlCdUksQ0FBQyxDQUFDN0MsR0FBRyxDQUFDN0YsQ0FBQyxFQUFFQyxDQUFDLEVBQUVDLENBQUMsRUFBRUMsQ0FBQyxDQUFDLENBQUE7QUFDckIsS0FBQTtBQUNKLEdBQUE7O0VBYUFxTCxXQUFXLENBQUNyUyxRQUFRLEVBQUU7QUFDbEIsSUFBQSxJQUFJLElBQUksQ0FBQ0EsUUFBUSxLQUFLQSxRQUFRLEVBQUU7TUFDNUIsSUFBSUEsUUFBUSxLQUFLc1MsYUFBYSxFQUFFO1FBQzVCLElBQUksQ0FBQzF2QixFQUFFLENBQUMrYixPQUFPLENBQUMsSUFBSSxDQUFDL2IsRUFBRSxDQUFDdWQsU0FBUyxDQUFDLENBQUE7QUFDdEMsT0FBQyxNQUFNO0FBQ0gsUUFBQSxJQUFJLElBQUksQ0FBQ0gsUUFBUSxLQUFLc1MsYUFBYSxFQUFFO1VBQ2pDLElBQUksQ0FBQzF2QixFQUFFLENBQUNzZCxNQUFNLENBQUMsSUFBSSxDQUFDdGQsRUFBRSxDQUFDdWQsU0FBUyxDQUFDLENBQUE7QUFDckMsU0FBQTtBQUVBLFFBQUEsTUFBTWtPLElBQUksR0FBRyxJQUFJLENBQUM5ZSxNQUFNLENBQUN5USxRQUFRLENBQUMsQ0FBQTtBQUNsQyxRQUFBLElBQUksSUFBSSxDQUFDSSxRQUFRLEtBQUtpTyxJQUFJLEVBQUU7QUFDeEIsVUFBQSxJQUFJLENBQUN6ckIsRUFBRSxDQUFDd2QsUUFBUSxDQUFDaU8sSUFBSSxDQUFDLENBQUE7VUFDdEIsSUFBSSxDQUFDak8sUUFBUSxHQUFHaU8sSUFBSSxDQUFBO0FBQ3hCLFNBQUE7QUFDSixPQUFBO01BQ0EsSUFBSSxDQUFDck8sUUFBUSxHQUFHQSxRQUFRLENBQUE7QUFDNUIsS0FBQTtBQUNKLEdBQUE7O0FBUUF1UyxFQUFBQSxXQUFXLEdBQUc7SUFDVixPQUFPLElBQUksQ0FBQ3ZTLFFBQVEsQ0FBQTtBQUN4QixHQUFBOztFQVFBd1MsU0FBUyxDQUFDNWEsTUFBTSxFQUFFO0FBQ2QsSUFBQSxJQUFJQSxNQUFNLEtBQUssSUFBSSxDQUFDQSxNQUFNLEVBQUU7TUFDeEIsSUFBSUEsTUFBTSxDQUFDNmEsTUFBTSxFQUFFO0FBQ2YsUUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixPQUFDLE1BQU0sSUFBSSxDQUFDN2EsTUFBTSxDQUFDOGEsS0FBSyxJQUFJLENBQUM5YSxNQUFNLENBQUM1USxJQUFJLENBQUMyckIsUUFBUSxDQUFDLElBQUksRUFBRS9hLE1BQU0sQ0FBQyxFQUFFO1FBQzdEQSxNQUFNLENBQUM2YSxNQUFNLEdBQUcsSUFBSSxDQUFBO0FBQ3BCLFFBQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsT0FBQTtNQUVBLElBQUksQ0FBQzdhLE1BQU0sR0FBR0EsTUFBTSxDQUFBOztNQUdwQixJQUFJLENBQUNoVixFQUFFLENBQUNnd0IsVUFBVSxDQUFDaGIsTUFBTSxDQUFDNVEsSUFBSSxDQUFDNnJCLFNBQVMsQ0FBQyxDQUFBO01BR3pDLElBQUksQ0FBQ0MsdUJBQXVCLEVBQUUsQ0FBQTtNQUc5QixJQUFJLENBQUNDLHFCQUFxQixHQUFHLElBQUksQ0FBQTtBQUNyQyxLQUFBO0FBQ0EsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBV0FDLEVBQUFBLFlBQVksR0FBRztJQUNYLElBQUksSUFBSSxDQUFDL2MsMEJBQTBCLEVBQUU7QUFDakMsTUFBQSxPQUFPWSxtQkFBbUIsQ0FBQTtBQUM5QixLQUFDLE1BQU0sSUFBSSxJQUFJLENBQUM5UixzQkFBc0IsRUFBRTtBQUNwQyxNQUFBLE9BQU9XLG1CQUFtQixDQUFBO0FBQzlCLEtBQUE7QUFDQSxJQUFBLE9BQU9jLHVCQUF1QixDQUFBO0FBQ2xDLEdBQUE7O0FBT0F5USxFQUFBQSxnQkFBZ0IsR0FBRztBQUNmLElBQUEsTUFBTXJVLEVBQUUsR0FBRyxJQUFJLENBQUNBLEVBQUUsQ0FBQTtBQUNsQixJQUFBLEtBQUssTUFBTXF3QixTQUFTLElBQUksSUFBSSxDQUFDblAsbUJBQW1CLEVBQUU7TUFDOUNsaEIsRUFBRSxDQUFDc3dCLFlBQVksQ0FBQyxJQUFJLENBQUNwUCxtQkFBbUIsQ0FBQ21QLFNBQVMsQ0FBQyxDQUFDLENBQUE7QUFDcEQsTUFBQSxPQUFPLElBQUksQ0FBQ25QLG1CQUFtQixDQUFDbVAsU0FBUyxDQUFDLENBQUE7QUFDOUMsS0FBQTtBQUNBLElBQUEsS0FBSyxNQUFNQSxTQUFTLElBQUksSUFBSSxDQUFDcFAsaUJBQWlCLEVBQUU7TUFDNUNqaEIsRUFBRSxDQUFDc3dCLFlBQVksQ0FBQyxJQUFJLENBQUNyUCxpQkFBaUIsQ0FBQ29QLFNBQVMsQ0FBQyxDQUFDLENBQUE7QUFDbEQsTUFBQSxPQUFPLElBQUksQ0FBQ3BQLGlCQUFpQixDQUFDb1AsU0FBUyxDQUFDLENBQUE7QUFDNUMsS0FBQTtBQUNKLEdBQUE7O0FBT0EvYixFQUFBQSwyQkFBMkIsR0FBRztBQUMxQixJQUFBLE1BQU10VSxFQUFFLEdBQUcsSUFBSSxDQUFDQSxFQUFFLENBQUE7SUFDbEIsSUFBSSxDQUFDbWhCLE9BQU8sQ0FBQ29QLE9BQU8sQ0FBQyxDQUFDQyxJQUFJLEVBQUVqSSxHQUFHLEVBQUVrSSxNQUFNLEtBQUs7QUFDeEN6d0IsTUFBQUEsRUFBRSxDQUFDb1ksaUJBQWlCLENBQUNvWSxJQUFJLENBQUMsQ0FBQTtBQUM5QixLQUFDLENBQUMsQ0FBQTtBQUVGLElBQUEsSUFBSSxDQUFDclAsT0FBTyxDQUFDMEMsS0FBSyxFQUFFLENBQUE7QUFDeEIsR0FBQTs7QUFPQSxFQUFBLElBQUk5Z0IsS0FBSyxHQUFHO0lBQ1IsT0FBTyxJQUFJLENBQUMvQyxFQUFFLENBQUMwd0Isa0JBQWtCLElBQUksSUFBSSxDQUFDenFCLE1BQU0sQ0FBQ2xELEtBQUssQ0FBQTtBQUMxRCxHQUFBOztBQU9BLEVBQUEsSUFBSUMsTUFBTSxHQUFHO0lBQ1QsT0FBTyxJQUFJLENBQUNoRCxFQUFFLENBQUMyd0IsbUJBQW1CLElBQUksSUFBSSxDQUFDMXFCLE1BQU0sQ0FBQ2pELE1BQU0sQ0FBQTtBQUM1RCxHQUFBOztFQU9BLElBQUk0dEIsVUFBVSxDQUFDQSxVQUFVLEVBQUU7QUFDdkIsSUFBQSxJQUFJQSxVQUFVLEVBQUU7QUFDWixNQUFBLE1BQU0zcUIsTUFBTSxHQUFHLElBQUksQ0FBQ2pHLEVBQUUsQ0FBQ2lHLE1BQU0sQ0FBQTtNQUM3QkEsTUFBTSxDQUFDNHFCLGlCQUFpQixFQUFFLENBQUE7QUFDOUIsS0FBQyxNQUFNO01BQ0hDLFFBQVEsQ0FBQ0MsY0FBYyxFQUFFLENBQUE7QUFDN0IsS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUlILFVBQVUsR0FBRztBQUNiLElBQUEsT0FBTyxDQUFDLENBQUNFLFFBQVEsQ0FBQ0UsaUJBQWlCLENBQUE7QUFDdkMsR0FBQTs7QUFPQSxFQUFBLElBQUlDLHlCQUF5QixHQUFHO0FBQzVCLElBQUEsSUFBSSxJQUFJLENBQUN2ZCwwQkFBMEIsS0FBSzlMLFNBQVMsRUFBRTtBQUMvQyxNQUFBLElBQUksQ0FBQzhMLDBCQUEwQixHQUFHelIsNkJBQTZCLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDekUsS0FBQTtJQUNBLE9BQU8sSUFBSSxDQUFDeVIsMEJBQTBCLENBQUE7QUFDMUMsR0FBQTs7QUFPQSxFQUFBLElBQUlLLHlCQUF5QixHQUFHO0FBQzVCLElBQUEsSUFBSSxJQUFJLENBQUNKLDBCQUEwQixLQUFLL0wsU0FBUyxFQUFFO01BQy9DLElBQUksSUFBSSxDQUFDekIsTUFBTSxFQUFFO1FBQ2IsSUFBSSxDQUFDd04sMEJBQTBCLEdBQUcsSUFBSSxDQUFBO0FBQzFDLE9BQUMsTUFBTTtBQUNILFFBQUEsSUFBSSxDQUFDQSwwQkFBMEIsR0FBR2pTLDZCQUE2QixDQUFDLElBQUksQ0FBQzFCLEVBQUUsRUFBRSxJQUFJLENBQUNzVCxtQkFBbUIsQ0FBQ0MsY0FBYyxDQUFDLENBQUE7QUFDckgsT0FBQTtBQUNKLEtBQUE7SUFDQSxPQUFPLElBQUksQ0FBQ0ksMEJBQTBCLENBQUE7QUFDMUMsR0FBQTtBQUNKOzs7OyJ9
