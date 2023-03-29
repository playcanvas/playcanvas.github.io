/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { setupVertexArrayObject } from '../../../polyfill/OESVertexArrayObject.js';
import { Debug } from '../../../core/debug.js';
import { platform } from '../../../core/platform.js';
import { Color } from '../../../core/math/color.js';
import { DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1, PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, CULLFACE_BACK, FUNC_ALWAYS, STENCILOP_KEEP, ADDRESS_CLAMP_TO_EDGE, semanticToLocation, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_NONE, PRIMITIVE_TRISTRIP, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
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
import { BlendState } from '../blend-state.js';
import { DepthState } from '../depth-state.js';

const invalidateAttachments = [];
const _fullScreenQuadVS = /* glsl */`
attribute vec2 vertex_position;
varying vec2 vUv0;
void main(void)
{
    gl_Position = vec4(vertex_position, 0.5, 1.0);
    vUv0 = vertex_position.xy*0.5+0.5;
}
`;
const _precisionTest1PS = /* glsl */`
void main(void) { 
    gl_FragColor = vec4(2147483648.0);
}
`;
const _precisionTest2PS = /* glsl */`
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
const _outputTexture2D = /* glsl */`
varying vec2 vUv0;
uniform sampler2D source;
void main(void) {
    gl_FragColor = texture2D(source, vUv0);
}
`;
function quadWithShader(device, target, shader) {
  DebugGraphics.pushGpuMarker(device, "QuadWithShader");
  const oldRt = device.renderTarget;
  device.setRenderTarget(target);
  device.updateBegin();
  device.setCullMode(CULLFACE_NONE);
  device.setBlendState(BlendState.DEFAULT);
  device.setDepthState(DepthState.NODEPTH);
  device.setVertexBuffer(device.quadVertexBuffer, 0);
  device.setShader(shader);
  device.draw({
    type: PRIMITIVE_TRISTRIP,
    base: 0,
    count: 4,
    indexed: false
  });
  device.updateEnd();
  device.setRenderTarget(oldRt);
  device.updateBegin();
  DebugGraphics.popGpuMarker(device);
}
function testRenderable(gl, pixelFormat) {
  let result = true;

  // Create a 2x2 texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, pixelFormat, null);

  // Try to use this texture as a render target
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  // It is legal for a WebGL implementation exposing the OES_texture_float extension to
  // support floating-point textures but not as attachments to framebuffer objects.
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    result = false;
  }

  // Clean up
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.deleteTexture(texture);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(framebuffer);
  return result;
}
function testTextureHalfFloatUpdatable(gl, pixelFormat) {
  let result = true;

  // Create a 2x2 texture
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // upload some data - on iOS prior to about November 2019, passing data to half texture would fail here
  // see details here: https://bugs.webkit.org/show_bug.cgi?id=169999
  // note that if not supported, this prints an error to console, the error can be safely ignored as it's handled
  const data = new Uint16Array(4 * 2 * 2);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, pixelFormat, data);
  if (gl.getError() !== gl.NO_ERROR) {
    result = false;
    console.log("Above error related to HALF_FLOAT_OES can be ignored, it was triggered by testing half float texture support");
  }

  // Clean up
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
  quadWithShader(device, targ1, shader1);
  textureOptions.format = PIXELFORMAT_RGBA8;
  const tex2 = new Texture(device, textureOptions);
  const targ2 = new RenderTarget({
    colorBuffer: tex2,
    depth: false
  });
  device.constantTexSource.setValue(tex1);
  quadWithShader(device, targ2, shader2);
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

// ImageBitmap current state (Sep 2022):
// - Lastest Chrome and Firefox browsers appear to support the ImageBitmap API fine (though
//   there are likely still issues with older versions of both).
// - Safari supports the API, but completely destroys some pngs. For example the cubemaps in
//   steampunk slots https://playcanvas.com/editor/scene/524858. See the webkit issue
//   https://bugs.webkit.org/show_bug.cgi?id=182424 for status.
// - Some applications assume that PNGs loaded by the engine use HTMLImageBitmap interface and
//   fail when using ImageBitmap. For example, Space Base project fails because it uses engine
//   texture assets on the dom https://playcanvas.com/editor/scene/446278.

// This function tests whether the current browser destroys PNG data or not.
function testImageBitmap(device) {
  // 1x1 png image containing rgba(1, 2, 3, 63)
  const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 100, 100, 98, 182, 7, 0, 0, 89, 0, 71, 67, 133, 148, 237, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
  return createImageBitmap(new Blob([pngBytes], {
    type: 'image/png'
  }), {
    premultiplyAlpha: 'none'
  }).then(image => {
    // create the texture
    const texture = new Texture(device, {
      width: 1,
      height: 1,
      format: PIXELFORMAT_RGBA8,
      mipmaps: false,
      levels: [image]
    });

    // read pixels
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

/**
 * The graphics device manages the underlying graphics context. It is responsible for submitting
 * render state changes and graphics primitives to the hardware. A graphics device is tied to a
 * specific canvas HTML element. It is valid to have more than one canvas element per page and
 * create a new graphics device against each.
 *
 * @augments GraphicsDevice
 */
class WebglGraphicsDevice extends GraphicsDevice {
  /**
   * The WebGL context managed by the graphics device. The type could also technically be
   * `WebGLRenderingContext` if WebGL 2.0 is not available. But in order for IntelliSense to be
   * able to function for all WebGL calls in the codebase, we specify `WebGL2RenderingContext`
   * here instead.
   *
   * @type {WebGL2RenderingContext}
   * @ignore
   */

  /**
   * True if the WebGL context of this device is using the WebGL 2.0 API. If false, WebGL 1.0 is
   * being used.
   *
   * @type {boolean}
   * @ignore
   */

  /**
   * Creates a new WebglGraphicsDevice instance.
   *
   * @param {HTMLCanvasElement} canvas - The canvas to which the graphics device will render.
   * @param {object} [options] - Options passed when creating the WebGL context.
   * @param {boolean} [options.alpha=true] - Boolean that indicates if the canvas contains an
   * alpha buffer.
   * @param {boolean} [options.depth=true] - Boolean that indicates that the drawing buffer is
   * requested to have a depth buffer of at least 16 bits.
   * @param {boolean} [options.stencil=false] - Boolean that indicates that the drawing buffer is
   * requested to have a stencil buffer of at least 8 bits.
   * @param {boolean} [options.antialias=true] - Boolean that indicates whether or not to perform
   * anti-aliasing if possible.
   * @param {boolean} [options.premultipliedAlpha=true] - Boolean that indicates that the page
   * compositor will assume the drawing buffer contains colors with pre-multiplied alpha.
   * @param {boolean} [options.preserveDrawingBuffer=false] - If the value is true the buffers
   * will not be cleared and will preserve their values until cleared or overwritten by the
   * author.
   * @param {'default'|'high-performance'|'low-power'} [options.powerPreference='default'] - A
   * hint to the user agent indicating what configuration of GPU is suitable for the WebGL
   * context. Possible values are:
   *
   * - 'default': Let the user agent decide which GPU configuration is most suitable. This is the
   * default value.
   * - 'high-performance': Prioritizes rendering performance over power consumption.
   * - 'low-power': Prioritizes power saving over rendering performance.
   *
   * @param {boolean} [options.failIfMajorPerformanceCaveat=false] - Boolean that indicates if a
   * context will be created if the system performance is low or if no hardware GPU is available.
   * @param {boolean} [options.preferWebGl2=true] - Boolean that indicates if a WebGl2 context
   * should be preferred.
   * @param {boolean} [options.desynchronized=false] - Boolean that hints the user agent to
   * reduce the latency by desynchronizing the canvas paint cycle from the event loop.
   * @param {boolean} [options.xrCompatible] - Boolean that hints to the user agent to use a
   * compatible graphics adapter for an immersive XR device.
   */
  constructor(canvas, options = {}) {
    super(canvas);
    this.gl = void 0;
    this.webgl2 = void 0;
    this.defaultFramebuffer = null;
    this.updateClientRect();

    // Add handlers for when the WebGL context is lost or restored
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

    // options defaults
    options.stencil = true;
    if (!options.powerPreference) {
      options.powerPreference = 'high-performance';
    }

    // #4136 - turn off antialiasing on AppleWebKit browsers 15.4
    const ua = typeof navigator !== 'undefined' && navigator.userAgent;
    this.forceDisableMultisampling = ua && ua.includes('AppleWebKit') && (ua.includes('15.4') || ua.includes('15_4'));
    if (this.forceDisableMultisampling) {
      options.antialias = false;
      Debug.log("Antialiasing has been turned off due to rendering issues on AppleWebKit 15.4");
    }

    // Retrieve the WebGL context
    const preferWebGl2 = options.preferWebGl2 !== undefined ? options.preferWebGl2 : true;
    const names = preferWebGl2 ? ["webgl2", "webgl", "experimental-webgl"] : ["webgl", "experimental-webgl"];
    let gl = null;
    for (let i = 0; i < names.length; i++) {
      gl = canvas.getContext(names[i], options);
      if (gl) {
        this.webgl2 = names[i] === DEVICETYPE_WEBGL2;
        this._deviceType = this.webgl2 ? DEVICETYPE_WEBGL2 : DEVICETYPE_WEBGL1;
        break;
      }
    }
    this.gl = gl;
    if (!gl) {
      throw new Error("WebGL not supported");
    }

    // pixel format of the framebuffer
    const alphaBits = gl.getParameter(gl.ALPHA_BITS);
    this.framebufferFormat = alphaBits ? PIXELFORMAT_RGBA8 : PIXELFORMAT_RGB8;
    const isChrome = platform.browser && !!window.chrome;
    const isMac = platform.browser && navigator.appVersion.indexOf("Mac") !== -1;

    // enable temporary texture unit workaround on desktop safari
    this._tempEnableSafariTextureUnitWorkaround = platform.browser && !!window.safari;

    // enable temporary workaround for glBlitFramebuffer failing on Mac Chrome (#2504)
    this._tempMacChromeBlitFramebufferWorkaround = isMac && isChrome && !options.alpha;

    // init polyfill for VAOs under webgl1
    if (!this.webgl2) {
      setupVertexArrayObject(gl);
    }
    canvas.addEventListener("webglcontextlost", this._contextLostHandler, false);
    canvas.addEventListener("webglcontextrestored", this._contextRestoredHandler, false);
    this.initializeExtensions();
    this.initializeCapabilities();
    this.initializeRenderState();
    this.initializeContextCaches();

    // start async image bitmap test
    this.supportsImageBitmap = null;
    if (typeof ImageBitmap !== 'undefined') {
      testImageBitmap(this).then(result => {
        this.supportsImageBitmap = result;
      });
    }
    this.glAddress = [gl.REPEAT, gl.CLAMP_TO_EDGE, gl.MIRRORED_REPEAT];
    this.glBlendEquation = [gl.FUNC_ADD, gl.FUNC_SUBTRACT, gl.FUNC_REVERSE_SUBTRACT, this.webgl2 ? gl.MIN : this.extBlendMinmax ? this.extBlendMinmax.MIN_EXT : gl.FUNC_ADD, this.webgl2 ? gl.MAX : this.extBlendMinmax ? this.extBlendMinmax.MAX_EXT : gl.FUNC_ADD];
    this.glBlendFunctionColor = [gl.ZERO, gl.ONE, gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR, gl.DST_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA, gl.SRC_ALPHA_SATURATE, gl.ONE_MINUS_SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.CONSTANT_COLOR, gl.ONE_MINUS_CONSTANT_COLOR];
    this.glBlendFunctionAlpha = [gl.ZERO, gl.ONE, gl.SRC_COLOR, gl.ONE_MINUS_SRC_COLOR, gl.DST_COLOR, gl.ONE_MINUS_DST_COLOR, gl.SRC_ALPHA, gl.SRC_ALPHA_SATURATE, gl.ONE_MINUS_SRC_ALPHA, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA];
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

    // Define the uniform commit functions
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

    // Calculate an estimate of the maximum number of bones that can be uploaded to the GPU
    // based on the number of available uniforms and the number of uniforms required for non-
    // bone data.  This is based off of the Standard shader.  A user defined shader may have
    // even less space available for bones so this calculated value can be overridden via
    // pc.GraphicsDevice.setBoneLimit.
    let numUniforms = this.vertexUniformsCount;
    numUniforms -= 4 * 4; // Model, view, projection and shadow matrices
    numUniforms -= 8; // 8 lights max, each specifying a position vector
    numUniforms -= 1; // Eye position
    numUniforms -= 4 * 4; // Up to 4 texture transforms
    this.boneLimit = Math.floor(numUniforms / 3); // each bone uses 3 uniforms

    // Put a limit on the number of supported bones before skin partitioning must be performed
    // Some GPUs have demonstrated performance issues if the number of vectors allocated to the
    // skin matrix palette is left unbounded
    this.boneLimit = Math.min(this.boneLimit, 128);
    if (this.unmaskedRenderer === 'Mali-450 MP') {
      this.boneLimit = 34;
    }
    this.constantTexSource = this.scope.resolve("source");
    if (this.extTextureFloat) {
      if (this.webgl2) {
        // In WebGL2 float texture renderability is dictated by the EXT_color_buffer_float extension
        this.textureFloatRenderable = !!this.extColorBufferFloat;
      } else {
        // In WebGL1 we should just try rendering into a float texture
        this.textureFloatRenderable = testRenderable(gl, gl.FLOAT);
      }
    } else {
      this.textureFloatRenderable = false;
    }

    // two extensions allow us to render to half float buffers
    if (this.extColorBufferHalfFloat) {
      this.textureHalfFloatRenderable = !!this.extColorBufferHalfFloat;
    } else if (this.extTextureHalfFloat) {
      if (this.webgl2) {
        // EXT_color_buffer_float should affect both float and halffloat formats
        this.textureHalfFloatRenderable = !!this.extColorBufferFloat;
      } else {
        // Manual render check for half float
        this.textureHalfFloatRenderable = testRenderable(gl, this.extTextureHalfFloat.HALF_FLOAT_OES);
      }
    } else {
      this.textureHalfFloatRenderable = false;
    }
    this.supportsMorphTargetTexturesCore = this.maxPrecision === "highp" && this.maxVertexTextures >= 2;
    this.supportsDepthShadow = this.webgl2;
    this._textureFloatHighPrecision = undefined;
    this._textureHalfFloatUpdatable = undefined;

    // area light LUT format - order of preference: half, float, 8bit
    this.areaLightLutFormat = PIXELFORMAT_RGBA8;
    if (this.extTextureHalfFloat && this.textureHalfFloatUpdatable && this.extTextureHalfFloatLinear) {
      this.areaLightLutFormat = PIXELFORMAT_RGBA16F;
    } else if (this.extTextureFloat && this.extTextureFloatLinear) {
      this.areaLightLutFormat = PIXELFORMAT_RGBA32F;
    }
    this.postInit();
  }

  /**
   * Destroy the graphics device.
   */
  destroy() {
    super.destroy();
    const gl = this.gl;
    if (this.webgl2 && this.feedback) {
      gl.deleteTransformFeedback(this.feedback);
    }
    this.clearVertexArrayObjectCache();
    this.canvas.removeEventListener('webglcontextlost', this._contextLostHandler, false);
    this.canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler, false);
    this._contextLostHandler = null;
    this._contextRestoredHandler = null;
    this.gl = null;
    super.postDestroy();
  }

  // provide webgl implementation for the vertex buffer
  createVertexBufferImpl(vertexBuffer, format) {
    return new WebglVertexBuffer();
  }

  // provide webgl implementation for the index buffer
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
  pushMarker(name) {
    if (window.spector) {
      const label = DebugGraphics.toString();
      window.spector.setMarker(`${label} #`);
    }
  }
  popMarker() {
    if (window.spector) {
      const label = DebugGraphics.toString();
      if (label.length) window.spector.setMarker(`${label} #`);else window.spector.clearMarker();
    }
  }

  /**
   * Query the precision supported by ints and floats in vertex and fragment shaders. Note that
   * getShaderPrecisionFormat is not guaranteed to be present (such as some instances of the
   * default Android browser). In this case, assume highp is available.
   *
   * @returns {string} "highp", "mediump" or "lowp"
   * @ignore
   */
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
  getExtension() {
    for (let i = 0; i < arguments.length; i++) {
      if (this.supportedExtensions.indexOf(arguments[i]) !== -1) {
        return this.gl.getExtension(arguments[i]);
      }
    }
    return null;
  }
  get extDisjointTimerQuery() {
    // lazy evaluation as this is not typically used
    if (!this._extDisjointTimerQuery) {
      if (this.webgl2) {
        // Note that Firefox exposes EXT_disjoint_timer_query under WebGL2 rather than EXT_disjoint_timer_query_webgl2
        this._extDisjointTimerQuery = this.getExtension('EXT_disjoint_timer_query_webgl2', 'EXT_disjoint_timer_query');
      }
    }
    return this._extDisjointTimerQuery;
  }

  /**
   * Initialize the extensions provided by the WebGL context.
   *
   * @ignore
   */
  initializeExtensions() {
    const gl = this.gl;
    const supportedExtensions = gl.getSupportedExtensions();
    this.supportedExtensions = supportedExtensions;
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
      this.extColorBufferFloat = this.getExtension('EXT_color_buffer_float');
      this.extDepthTexture = true;
    } else {
      this.extBlendMinmax = this.getExtension("EXT_blend_minmax");
      this.extDrawBuffers = this.getExtension('EXT_draw_buffers');
      this.extInstancing = this.getExtension("ANGLE_instanced_arrays");
      if (this.extInstancing) {
        // Install the WebGL 2 Instancing API for WebGL 1.0
        const ext = this.extInstancing;
        gl.drawArraysInstanced = ext.drawArraysInstancedANGLE.bind(ext);
        gl.drawElementsInstanced = ext.drawElementsInstancedANGLE.bind(ext);
        gl.vertexAttribDivisor = ext.vertexAttribDivisorANGLE.bind(ext);
      }
      this.extStandardDerivatives = this.getExtension("OES_standard_derivatives");
      this.extTextureFloat = this.getExtension("OES_texture_float");
      this.extTextureHalfFloat = this.getExtension("OES_texture_half_float");
      this.extTextureLod = this.getExtension('EXT_shader_texture_lod');
      this.extUintElement = this.getExtension("OES_element_index_uint");
      this.extVertexArrayObject = this.getExtension("OES_vertex_array_object");
      if (this.extVertexArrayObject) {
        // Install the WebGL 2 VAO API for WebGL 1.0
        const ext = this.extVertexArrayObject;
        gl.createVertexArray = ext.createVertexArrayOES.bind(ext);
        gl.deleteVertexArray = ext.deleteVertexArrayOES.bind(ext);
        gl.isVertexArray = ext.isVertexArrayOES.bind(ext);
        gl.bindVertexArray = ext.bindVertexArrayOES.bind(ext);
      }
      this.extColorBufferFloat = null;
      this.extDepthTexture = gl.getExtension('WEBGL_depth_texture');
    }
    this.extDebugRendererInfo = this.getExtension('WEBGL_debug_renderer_info');
    this.extTextureFloatLinear = this.getExtension("OES_texture_float_linear");
    this.extTextureHalfFloatLinear = this.getExtension("OES_texture_half_float_linear");
    this.extFloatBlend = this.getExtension("EXT_float_blend");
    this.extTextureFilterAnisotropic = this.getExtension('EXT_texture_filter_anisotropic', 'WEBKIT_EXT_texture_filter_anisotropic');
    this.extCompressedTextureETC1 = this.getExtension('WEBGL_compressed_texture_etc1');
    this.extCompressedTextureETC = this.getExtension('WEBGL_compressed_texture_etc');
    this.extCompressedTexturePVRTC = this.getExtension('WEBGL_compressed_texture_pvrtc', 'WEBKIT_WEBGL_compressed_texture_pvrtc');
    this.extCompressedTextureS3TC = this.getExtension('WEBGL_compressed_texture_s3tc', 'WEBKIT_WEBGL_compressed_texture_s3tc');
    this.extCompressedTextureATC = this.getExtension('WEBGL_compressed_texture_atc');
    this.extCompressedTextureASTC = this.getExtension('WEBGL_compressed_texture_astc');
    this.extParallelShaderCompile = this.getExtension('KHR_parallel_shader_compile');

    // iOS exposes this for half precision render targets on both Webgl1 and 2 from iOS v 14.5beta
    this.extColorBufferHalfFloat = this.getExtension("EXT_color_buffer_half_float");
  }

  /**
   * Query the capabilities of the WebGL context.
   *
   * @ignore
   */
  initializeCapabilities() {
    const gl = this.gl;
    let ext;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : "";
    this.maxPrecision = this.precision = this.getPrecision();
    const contextAttribs = gl.getContextAttributes();
    this.supportsMsaa = contextAttribs.antialias;
    this.supportsStencil = contextAttribs.stencil;
    this.supportsInstancing = !!this.extInstancing;

    // Query parameter values from the WebGL context
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

    // Check if we support GPU particles. At the moment, Samsung devices with Exynos (ARM) either crash or render
    // incorrectly when using GPU for particles. See:
    // https://github.com/playcanvas/engine/issues/3967
    // https://github.com/playcanvas/engine/issues/3415
    // https://github.com/playcanvas/engine/issues/4514
    // Example UA matches: Starting 'SM' and any combination of letters or numbers:
    // Mozilla/5.0 (Linux, Android 12; SM-G970F Build/SP1A.210812.016; wv)
    // Mozilla/5.0 (Linux, Android 12; SM-G970F)
    const samsungModelRegex = /SM-[a-zA-Z0-9]+/;
    this.supportsGpuParticles = !(this.unmaskedVendor === 'ARM' && userAgent.match(samsungModelRegex));
    ext = this.extTextureFilterAnisotropic;
    this.maxAnisotropy = ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
    this.samples = gl.getParameter(gl.SAMPLES);
    this.maxSamples = this.webgl2 && !this.forceDisableMultisampling ? gl.getParameter(gl.MAX_SAMPLES) : 1;

    // Don't allow area lights on old android devices, they often fail to compile the shader, run it incorrectly or are very slow.
    this.supportsAreaLights = this.webgl2 || !platform.android;

    // supports texture fetch instruction
    this.supportsTextureFetch = this.webgl2;

    // Also do not allow them when we only have small number of texture units
    if (this.maxTextures <= 8) {
      this.supportsAreaLights = false;
    }
  }

  /**
   * Set the initial render state on the WebGL context.
   *
   * @ignore
   */
  initializeRenderState() {
    super.initializeRenderState();
    const gl = this.gl;

    // Initialize render state to a known start state

    // default blend state
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ZERO);
    gl.blendEquation(gl.FUNC_ADD);
    gl.colorMask(true, true, true, true);
    this.blendColor = new Color(0, 0, 0, 0);
    gl.blendColor(0, 0, 0, 0);
    this.cullMode = CULLFACE_BACK;
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // default depth state
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
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

    // cache of VAOs
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

  /**
   * Called when the WebGL context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    // release shaders
    for (const shader of this.shaders) {
      shader.loseContext();
    }

    // release textures
    for (const texture of this.textures) {
      texture.loseContext();
    }

    // release vertex and index buffers
    for (const buffer of this.buffers) {
      buffer.loseContext();
    }

    // Reset all render targets so they'll be recreated as required.
    // TODO: a solution for the case where a render target contains something
    // that was previously generated that needs to be re-rendered.
    for (const target of this.targets) {
      target.loseContext();
    }
  }

  /**
   * Called when the WebGL context is restored. It reinitializes all context related resources.
   *
   * @ignore
   */
  restoreContext() {
    this.initializeExtensions();
    this.initializeCapabilities();
    this.initializeRenderState();
    this.initializeContextCaches();

    // Recompile all shaders (they'll be linked when they're next actually used)
    for (const shader of this.shaders) {
      shader.restoreContext();
    }

    // Recreate buffer objects and reupload buffer data to the GPU
    for (const buffer of this.buffers) {
      buffer.unlock();
    }
  }

  /**
   * Called after a batch of shaders was created, to guide in their optimal preparation for rendering.
   *
   * @ignore
   */
  endShaderBatch() {
    WebglShader.endShaderBatch(this);
  }

  /**
   * Set the active rectangle for rendering on the specified device.
   *
   * @param {number} x - The pixel space x-coordinate of the bottom left corner of the viewport.
   * @param {number} y - The pixel space y-coordinate of the bottom left corner of the viewport.
   * @param {number} w - The width of the viewport in pixels.
   * @param {number} h - The height of the viewport in pixels.
   */
  setViewport(x, y, w, h) {
    if (this.vx !== x || this.vy !== y || this.vw !== w || this.vh !== h) {
      this.gl.viewport(x, y, w, h);
      this.vx = x;
      this.vy = y;
      this.vw = w;
      this.vh = h;
    }
  }

  /**
   * Set the active scissor rectangle on the specified device.
   *
   * @param {number} x - The pixel space x-coordinate of the bottom left corner of the scissor rectangle.
   * @param {number} y - The pixel space y-coordinate of the bottom left corner of the scissor rectangle.
   * @param {number} w - The width of the scissor rectangle in pixels.
   * @param {number} h - The height of the scissor rectangle in pixels.
   */
  setScissor(x, y, w, h) {
    if (this.sx !== x || this.sy !== y || this.sw !== w || this.sh !== h) {
      this.gl.scissor(x, y, w, h);
      this.sx = x;
      this.sy = y;
      this.sw = w;
      this.sh = h;
    }
  }

  /**
   * Binds the specified framebuffer object.
   *
   * @param {WebGLFramebuffer | null} fb - The framebuffer to bind.
   * @ignore
   */
  setFramebuffer(fb) {
    if (this.activeFramebuffer !== fb) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      this.activeFramebuffer = fb;
    }
  }

  /**
   * Copies source render target into destination render target. Mostly used by post-effects.
   *
   * @param {RenderTarget} [source] - The source render target. Defaults to frame buffer.
   * @param {RenderTarget} [dest] - The destination render target. Defaults to frame buffer.
   * @param {boolean} [color] - If true will copy the color buffer. Defaults to false.
   * @param {boolean} [depth] - If true will copy the depth buffer. Defaults to false.
   * @returns {boolean} True if the copy was successful, false otherwise.
   */
  copyRenderTarget(source, dest, color, depth) {
    const gl = this.gl;
    if (!this.webgl2 && depth) {
      Debug.error("Depth is not copyable on WebGL 1.0");
      return false;
    }
    if (color) {
      if (!dest) {
        // copying to backbuffer
        if (!source._colorBuffer) {
          Debug.error("Can't copy empty color buffer to backbuffer");
          return false;
        }
      } else if (source) {
        // copying to render target
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
        // when depth is automatic, we cannot test the buffer nor its format
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
      quadWithShader(this, dest, shader);
    }
    DebugGraphics.popGpuMarker(this);
    return true;
  }

  /**
   * Get copy shader for efficient rendering of fullscreen-quad with texture.
   *
   * @returns {Shader} The copy shader (based on `fullscreenQuadVS` and `outputTex2DPS` in
   * `shaderChunks`).
   * @ignore
   */
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

  /**
   * Start a render pass.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to start.
   * @ignore
   */
  startPass(renderPass) {
    DebugGraphics.pushGpuMarker(this, `START-PASS`);

    // set up render target
    this.setRenderTarget(renderPass.renderTarget);
    this.updateBegin();

    // clear the render target
    const colorOps = renderPass.colorOps;
    const depthStencilOps = renderPass.depthStencilOps;
    if (colorOps.clear || depthStencilOps.clearDepth || depthStencilOps.clearStencil) {
      // the pass always clears full target
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

      // clear it
      clearOptions.flags = clearFlags;
      this.clear(clearOptions);
    }
    Debug.call(() => {
      if (this.insideRenderPass) {
        Debug.errorOnce('RenderPass cannot be started while inside another render pass.');
      }
    });
    this.insideRenderPass = true;
    DebugGraphics.popGpuMarker(this);
  }

  /**
   * End a render pass.
   *
   * @param {import('../render-pass.js').RenderPass} renderPass - The render pass to end.
   * @ignore
   */
  endPass(renderPass) {
    DebugGraphics.pushGpuMarker(this, `END-PASS`);
    this.unbindVertexArray();
    const target = this.renderTarget;
    if (target) {
      // invalidate buffers to stop them being written to on tiled architextures
      if (this.webgl2) {
        invalidateAttachments.length = 0;
        const gl = this.gl;

        // invalidate color only if we don't need to resolve it
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
          // invalidate the whole buffer
          // TODO: we could handle viewport invalidation as well
          if (renderPass.fullSizeClearRect) {
            gl.invalidateFramebuffer(gl.DRAW_FRAMEBUFFER, invalidateAttachments);
          }
        }
      }

      // resolve the color buffer
      if (renderPass.colorOps.resolve) {
        if (this.webgl2 && renderPass.samples > 1 && target.autoResolve) {
          target.resolve(true, false);
        }
      }

      // generate mipmaps
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

  /**
   * Marks the beginning of a block of rendering. Internally, this function binds the render
   * target currently set on the device. This function should be matched with a call to
   * {@link GraphicsDevice#updateEnd}. Calls to {@link GraphicsDevice#updateBegin} and
   * {@link GraphicsDevice#updateEnd} must not be nested.
   *
   * @ignore
   */
  updateBegin() {
    DebugGraphics.pushGpuMarker(this, 'UPDATE-BEGIN');
    this.boundVao = null;

    // clear texture units once a frame on desktop safari
    if (this._tempEnableSafariTextureUnitWorkaround) {
      for (let unit = 0; unit < this.textureUnits.length; ++unit) {
        for (let slot = 0; slot < 3; ++slot) {
          this.textureUnits[unit][slot] = null;
        }
      }
    }

    // Set the render target
    const target = this.renderTarget;
    if (target) {
      // Create a new WebGL frame buffer object
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

  /**
   * Marks the end of a block of rendering. This function should be called after a matching call
   * to {@link GraphicsDevice#updateBegin}. Calls to {@link GraphicsDevice#updateBegin} and
   * {@link GraphicsDevice#updateEnd} must not be nested.
   *
   * @ignore
   */
  updateEnd() {
    DebugGraphics.pushGpuMarker(this, `UPDATE-END`);
    this.unbindVertexArray();

    // Unset the render target
    const target = this.renderTarget;
    if (target) {
      // Resolve MSAA if needed
      if (this.webgl2 && target._samples > 1 && target.autoResolve) {
        target.resolve();
      }

      // If the active render target is auto-mipmapped, generate its mip chain
      const colorBuffer = target._colorBuffer;
      if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps && (colorBuffer.pot || this.webgl2)) {
        // FIXME: if colorBuffer is a cubemap currently we're re-generating mipmaps after
        // updating each face!
        this.activeTexture(this.maxCombinedTextures - 1);
        this.bindTexture(colorBuffer);
        this.gl.generateMipmap(colorBuffer.impl._glTarget);
      }
    }
    DebugGraphics.popGpuMarker(this);
  }

  /**
   * Updates a texture's vertical flip.
   *
   * @param {boolean} flipY - True to flip the texture vertically.
   * @ignore
   */
  setUnpackFlipY(flipY) {
    if (this.unpackFlipY !== flipY) {
      this.unpackFlipY = flipY;

      // Note: the WebGL spec states that UNPACK_FLIP_Y_WEBGL only affects
      // texImage2D and texSubImage2D, not compressedTexImage2D
      const gl = this.gl;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
    }
  }

  /**
   * Updates a texture to have its RGB channels premultiplied by its alpha channel or not.
   *
   * @param {boolean} premultiplyAlpha - True to premultiply the alpha channel against the RGB
   * channels.
   * @ignore
   */
  setUnpackPremultiplyAlpha(premultiplyAlpha) {
    if (this.unpackPremultiplyAlpha !== premultiplyAlpha) {
      this.unpackPremultiplyAlpha = premultiplyAlpha;

      // Note: the WebGL spec states that UNPACK_PREMULTIPLY_ALPHA_WEBGL only affects
      // texImage2D and texSubImage2D, not compressedTexImage2D
      const gl = this.gl;
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
    }
  }

  /**
   * Activate the specified texture unit.
   *
   * @param {number} textureUnit - The texture unit to activate.
   * @ignore
   */
  activeTexture(textureUnit) {
    if (this.textureUnit !== textureUnit) {
      this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
      this.textureUnit = textureUnit;
    }
  }

  /**
   * If the texture is not already bound on the currently active texture unit, bind it.
   *
   * @param {Texture} texture - The texture to bind.
   * @ignore
   */
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

  /**
   * If the texture is not bound on the specified texture unit, active the texture unit and bind
   * the texture to it.
   *
   * @param {Texture} texture - The texture to bind.
   * @param {number} textureUnit - The texture unit to activate and bind the texture to.
   * @ignore
   */
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

  /**
   * Update the texture parameters for a given texture if they have changed.
   *
   * @param {Texture} texture - The texture to update.
   * @ignore
   */
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
        // WebGL1 doesn't support all addressing modes with NPOT textures
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.glAddress[texture.pot ? texture._addressU : ADDRESS_CLAMP_TO_EDGE]);
      }
    }
    if (flags & 8) {
      if (this.webgl2) {
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.glAddress[texture._addressV]);
      } else {
        // WebGL1 doesn't support all addressing modes with NPOT textures
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

  /**
   * Sets the specified texture on the specified texture unit.
   *
   * @param {Texture} texture - The texture to set.
   * @param {number} textureUnit - The texture unit to set the texture on.
   * @ignore
   */
  setTexture(texture, textureUnit) {
    if (!texture.impl._glTexture) texture.impl.initialize(this, texture);
    if (texture._parameterFlags > 0 || texture._needsUpload || texture._needsMipmapsUpload) {
      // Ensure the specified texture unit is active
      this.activeTexture(textureUnit);

      // Ensure the texture is bound on correct target of the specified texture unit
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
      // Ensure the texture is currently bound to the correct target on the specified texture unit.
      // If the texture is already bound to the correct target on the specified unit, there's no need
      // to actually make the specified texture unit active because the texture itself does not need
      // to be updated.
      this.bindTextureOnUnit(texture, textureUnit);
    }
  }

  // function creates VertexArrayObject from list of vertex buffers
  createVertexArray(vertexBuffers) {
    let key, vao;

    // only use cache when more than 1 vertex buffer, otherwise it's unique
    const useCache = vertexBuffers.length > 1;
    if (useCache) {
      // generate unique key for the vertex buffers
      key = "";
      for (let i = 0; i < vertexBuffers.length; i++) {
        const vertexBuffer = vertexBuffers[i];
        key += vertexBuffer.id + vertexBuffer.format.renderingHash;
      }

      // try to get VAO from cache
      vao = this._vaoMap.get(key);
    }

    // need to create new vao
    if (!vao) {
      // create VA object
      const gl = this.gl;
      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      // don't capture index buffer in VAO
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      let locZero = false;
      for (let i = 0; i < vertexBuffers.length; i++) {
        // bind buffer
        const vertexBuffer = vertexBuffers[i];
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.impl.bufferId);

        // for each attribute
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

      // end of VA object
      gl.bindVertexArray(null);

      // unbind any array buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      // add it to cache
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
    // unbind VAO from device to protect it from being changed
    if (this.boundVao) {
      this.boundVao = null;
      this.gl.bindVertexArray(null);
    }
  }
  setBuffers() {
    const gl = this.gl;
    let vao;

    // create VAO for specified vertex buffers
    if (this.vertexBuffers.length === 1) {
      // single VB keeps its VAO
      const vertexBuffer = this.vertexBuffers[0];
      Debug.assert(vertexBuffer.device === this, "The VertexBuffer was not created using current GraphicsDevice");
      if (!vertexBuffer.impl.vao) {
        vertexBuffer.impl.vao = this.createVertexArray(this.vertexBuffers);
      }
      vao = vertexBuffer.impl.vao;
    } else {
      // obtain temporary VAO for multiple vertex buffers
      vao = this.createVertexArray(this.vertexBuffers);
    }

    // set active VAO
    if (this.boundVao !== vao) {
      this.boundVao = vao;
      gl.bindVertexArray(vao);
    }

    // empty array of vertex buffers
    this.vertexBuffers.length = 0;

    // Set the active index buffer object
    // Note: we don't cache this state and set it only when it changes, as VAO captures last bind buffer in it
    // and so we don't know what VAO sets it to.
    const bufferId = this.indexBuffer ? this.indexBuffer.impl.bufferId : null;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufferId);
  }

  /**
   * Submits a graphical primitive to the hardware for immediate rendering.
   *
   * @param {object} primitive - Primitive object describing how to submit current vertex/index
   * buffers.
   * @param {number} primitive.type - The type of primitive to render. Can be:
   *
   * - {@link PRIMITIVE_POINTS}
   * - {@link PRIMITIVE_LINES}
   * - {@link PRIMITIVE_LINELOOP}
   * - {@link PRIMITIVE_LINESTRIP}
   * - {@link PRIMITIVE_TRIANGLES}
   * - {@link PRIMITIVE_TRISTRIP}
   * - {@link PRIMITIVE_TRIFAN}
   *
   * @param {number} primitive.base - The offset of the first index or vertex to dispatch in the
   * draw call.
   * @param {number} primitive.count - The number of indices or vertices to dispatch in the draw
   * call.
   * @param {boolean} [primitive.indexed] - True to interpret the primitive as indexed, thereby
   * using the currently set index buffer and false otherwise.
   * @param {number} [numInstances=1] - The number of instances to render when using
   * ANGLE_instanced_arrays. Defaults to 1.
   * @param {boolean} [keepBuffers] - Optionally keep the current set of vertex / index buffers /
   * VAO. This is used when rendering of multiple views, for example under WebXR.
   * @example
   * // Render a single, unindexed triangle
   * device.draw({
   *     type: pc.PRIMITIVE_TRIANGLES,
   *     base: 0,
   *     count: 3,
   *     indexed: false
   * });
   */
  draw(primitive, numInstances, keepBuffers) {
    const gl = this.gl;
    let sampler, samplerValue, texture, numTextures; // Samplers
    let uniform, scopeId, uniformVersion, programVersion; // Uniforms
    const shader = this.shader;
    if (!shader) return;
    const samplers = shader.impl.samplers;
    const uniforms = shader.impl.uniforms;

    // vertex buffers
    if (!keepBuffers) {
      this.setBuffers();
    }

    // Commit the shader program variables
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
        Debug.errorOnce(`Shader [${shader.label}] requires texture sampler [${samplerName}] which has not been set, while rendering [${DebugGraphics.toString()}]`);

        // skip this draw call to avoid incorrect rendering / webgl errors
        return;
      }
      if (samplerValue instanceof Texture) {
        texture = samplerValue;
        this.setTexture(texture, textureUnit);
        if (this.renderTarget) {
          // Set breakpoint here to debug "Source and destination textures of the draw are the same" errors
          if (this.renderTarget._samples < 2) {
            if (this.renderTarget.colorBuffer && this.renderTarget.colorBuffer === texture) {
              Debug.error("Trying to bind current color buffer as a texture", {
                renderTarget: this.renderTarget,
                texture
              });
            } else if (this.renderTarget.depthBuffer && this.renderTarget.depthBuffer === texture) {
              Debug.error("Trying to bind current depth buffer as a texture", {
                texture
              });
            }
          }
        }
        if (sampler.slot !== textureUnit) {
          gl.uniform1i(sampler.locationId, textureUnit);
          sampler.slot = textureUnit;
        }
        textureUnit++;
      } else {
        // Array
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

    // Commit any updated uniforms
    for (let i = 0, len = uniforms.length; i < len; i++) {
      uniform = uniforms[i];
      scopeId = uniform.scopeId;
      uniformVersion = uniform.version;
      programVersion = scopeId.versionObject.version;

      // Check the value is valid
      if (uniformVersion.globalId !== programVersion.globalId || uniformVersion.revision !== programVersion.revision) {
        uniformVersion.globalId = programVersion.globalId;
        uniformVersion.revision = programVersion.revision;

        // Call the function to commit the uniform value
        if (scopeId.value !== null) {
          this.commitFunction[uniform.dataType](uniform, scopeId.value);
        }
      }
    }
    if (this.webgl2 && this.transformFeedbackBuffer) {
      // Enable TF, start writing to out buffer
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
      // disable TF
      gl.endTransformFeedback();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    }
    this._drawCallsPerFrame++;
    this._primsPerFrame[primitive.type] += primitive.count * (numInstances > 1 ? numInstances : 1);
  }

  /**
   * Clears the frame buffer of the currently set render target.
   *
   * @param {object} [options] - Optional options object that controls the behavior of the clear
   * operation defined as follows:
   * @param {number[]} [options.color] - The color to clear the color buffer to in the range 0.0
   * to 1.0 for each component.
   * @param {number} [options.depth=1] - The depth value to clear the depth buffer to in the
   * range 0.0 to 1.0.
   * @param {number} [options.flags] - The buffers to clear (the types being color, depth and
   * stencil). Can be any bitwise combination of:
   *
   * - {@link CLEARFLAG_COLOR}
   * - {@link CLEARFLAG_DEPTH}
   * - {@link CLEARFLAG_STENCIL}
   *
   * @param {number} [options.stencil=0] - The stencil value to clear the stencil buffer to. Defaults to 0.
   * @example
   * // Clear color buffer to black and depth buffer to 1.0
   * device.clear();
   *
   * // Clear just the color buffer to red
   * device.clear({
   *     color: [1, 0, 0, 1],
   *     flags: pc.CLEARFLAG_COLOR
   * });
   *
   * // Clear color buffer to yellow and depth to 1.0
   * device.clear({
   *     color: [1, 1, 0, 1],
   *     depth: 1,
   *     flags: pc.CLEARFLAG_COLOR | pc.CLEARFLAG_DEPTH
   * });
   */
  clear(options) {
    var _options$flags;
    const defaultOptions = this.defaultClearOptions;
    options = options || defaultOptions;
    const flags = (_options$flags = options.flags) != null ? _options$flags : defaultOptions.flags;
    if (flags !== 0) {
      const gl = this.gl;

      // Set the clear color
      if (flags & CLEARFLAG_COLOR) {
        var _options$color;
        const color = (_options$color = options.color) != null ? _options$color : defaultOptions.color;
        const r = color[0];
        const g = color[1];
        const b = color[2];
        const a = color[3];
        const c = this.clearColor;
        if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
          this.gl.clearColor(r, g, b, a);
          this.clearColor.set(r, g, b, a);
        }
        this.setBlendState(BlendState.DEFAULT);
      }
      if (flags & CLEARFLAG_DEPTH) {
        var _options$depth;
        // Set the clear depth
        const depth = (_options$depth = options.depth) != null ? _options$depth : defaultOptions.depth;
        if (depth !== this.clearDepth) {
          this.gl.clearDepth(depth);
          this.clearDepth = depth;
        }
        this.setDepthState(DepthState.WRITEDEPTH);
      }
      if (flags & CLEARFLAG_STENCIL) {
        var _options$stencil;
        // Set the clear stencil
        const stencil = (_options$stencil = options.stencil) != null ? _options$stencil : defaultOptions.stencil;
        if (stencil !== this.clearStencil) {
          this.gl.clearStencil(stencil);
          this.clearStencil = stencil;
        }
      }

      // Clear the frame buffer
      gl.clear(this.glClearFlag[flags]);
    }
  }

  /**
   * Reads a block of pixels from a specified rectangle of the current color framebuffer into an
   * ArrayBufferView object.
   *
   * @param {number} x - The x-coordinate of the rectangle's lower-left corner.
   * @param {number} y - The y-coordinate of the rectangle's lower-left corner.
   * @param {number} w - The width of the rectangle, in pixels.
   * @param {number} h - The height of the rectangle, in pixels.
   * @param {ArrayBufferView} pixels - The ArrayBufferView object that holds the returned pixel
   * data.
   * @ignore
   */
  readPixels(x, y, w, h, pixels) {
    const gl = this.gl;
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  }

  /**
   * Enables or disables alpha to coverage (WebGL2 only).
   *
   * @param {boolean} state - True to enable alpha to coverage and false to disable it.
   * @ignore
   */
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

  /**
   * Sets the output vertex buffer. It will be written to by a shader with transform feedback
   * varyings.
   *
   * @param {import('../vertex-buffer.js').VertexBuffer} tf - The output vertex buffer.
   * @ignore
   */
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

  /**
   * Toggles the rasterization render state. Useful with transform feedback, when you only need
   * to process the data without drawing.
   *
   * @param {boolean} on - True to enable rasterization and false to disable it.
   * @ignore
   */
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

  /**
   * Toggles the polygon offset render state.
   *
   * @param {boolean} on - True to enable polygon offset and false to disable it.
   * @ignore
   */
  setDepthBias(on) {
    if (this.depthBiasEnabled === on) return;
    this.depthBiasEnabled = on;
    if (on) {
      this.gl.enable(this.gl.POLYGON_OFFSET_FILL);
    } else {
      this.gl.disable(this.gl.POLYGON_OFFSET_FILL);
    }
  }

  /**
   * Specifies the scale factor and units to calculate depth values. The offset is added before
   * the depth test is performed and before the value is written into the depth buffer.
   *
   * @param {number} constBias - The multiplier by which an implementation-specific value is
   * multiplied with to create a constant depth offset.
   * @param {number} slopeBias - The scale factor for the variable depth offset for each polygon.
   * @ignore
   */
  setDepthBiasValues(constBias, slopeBias) {
    this.gl.polygonOffset(slopeBias, constBias);
  }

  /**
   * Enables or disables stencil test.
   *
   * @param {boolean} enable - True to enable stencil test and false to disable it.
   */
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

  /**
   * Configures stencil test for both front and back faces.
   *
   * @param {number} func - A comparison function that decides if the pixel should be written,
   * based on the current stencil buffer value, reference value, and mask value. Can be:
   *
   * - {@link FUNC_NEVER}: never pass
   * - {@link FUNC_LESS}: pass if (ref & mask) < (stencil & mask)
   * - {@link FUNC_EQUAL}: pass if (ref & mask) == (stencil & mask)
   * - {@link FUNC_LESSEQUAL}: pass if (ref & mask) <= (stencil & mask)
   * - {@link FUNC_GREATER}: pass if (ref & mask) > (stencil & mask)
   * - {@link FUNC_NOTEQUAL}: pass if (ref & mask) != (stencil & mask)
   * - {@link FUNC_GREATEREQUAL}: pass if (ref & mask) >= (stencil & mask)
   * - {@link FUNC_ALWAYS}: always pass
   *
   * @param {number} ref - Reference value used in comparison.
   * @param {number} mask - Mask applied to stencil buffer value and reference value before
   * comparison.
   */
  setStencilFunc(func, ref, mask) {
    if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask || this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
      const gl = this.gl;
      gl.stencilFunc(this.glComparison[func], ref, mask);
      this.stencilFuncFront = this.stencilFuncBack = func;
      this.stencilRefFront = this.stencilRefBack = ref;
      this.stencilMaskFront = this.stencilMaskBack = mask;
    }
  }

  /**
   * Configures stencil test for front faces.
   *
   * @param {number} func - A comparison function that decides if the pixel should be written,
   * based on the current stencil buffer value, reference value, and mask value. Can be:
   *
   * - {@link FUNC_NEVER}: never pass
   * - {@link FUNC_LESS}: pass if (ref & mask) < (stencil & mask)
   * - {@link FUNC_EQUAL}: pass if (ref & mask) == (stencil & mask)
   * - {@link FUNC_LESSEQUAL}: pass if (ref & mask) <= (stencil & mask)
   * - {@link FUNC_GREATER}: pass if (ref & mask) > (stencil & mask)
   * - {@link FUNC_NOTEQUAL}: pass if (ref & mask) != (stencil & mask)
   * - {@link FUNC_GREATEREQUAL}: pass if (ref & mask) >= (stencil & mask)
   * - {@link FUNC_ALWAYS}: always pass
   *
   * @param {number} ref - Reference value used in comparison.
   * @param {number} mask - Mask applied to stencil buffer value and reference value before comparison.
   */
  setStencilFuncFront(func, ref, mask) {
    if (this.stencilFuncFront !== func || this.stencilRefFront !== ref || this.stencilMaskFront !== mask) {
      const gl = this.gl;
      gl.stencilFuncSeparate(gl.FRONT, this.glComparison[func], ref, mask);
      this.stencilFuncFront = func;
      this.stencilRefFront = ref;
      this.stencilMaskFront = mask;
    }
  }

  /**
   * Configures stencil test for back faces.
   *
   * @param {number} func - A comparison function that decides if the pixel should be written,
   * based on the current stencil buffer value, reference value, and mask value. Can be:
   *
   * - {@link FUNC_NEVER}: never pass
   * - {@link FUNC_LESS}: pass if (ref & mask) < (stencil & mask)
   * - {@link FUNC_EQUAL}: pass if (ref & mask) == (stencil & mask)
   * - {@link FUNC_LESSEQUAL}: pass if (ref & mask) <= (stencil & mask)
   * - {@link FUNC_GREATER}: pass if (ref & mask) > (stencil & mask)
   * - {@link FUNC_NOTEQUAL}: pass if (ref & mask) != (stencil & mask)
   * - {@link FUNC_GREATEREQUAL}: pass if (ref & mask) >= (stencil & mask)
   * - {@link FUNC_ALWAYS}: always pass
   *
   * @param {number} ref - Reference value used in comparison.
   * @param {number} mask - Mask applied to stencil buffer value and reference value before comparison.
   */
  setStencilFuncBack(func, ref, mask) {
    if (this.stencilFuncBack !== func || this.stencilRefBack !== ref || this.stencilMaskBack !== mask) {
      const gl = this.gl;
      gl.stencilFuncSeparate(gl.BACK, this.glComparison[func], ref, mask);
      this.stencilFuncBack = func;
      this.stencilRefBack = ref;
      this.stencilMaskBack = mask;
    }
  }

  /**
   * Configures how stencil buffer values should be modified based on the result of depth/stencil
   * tests. Works for both front and back faces.
   *
   * @param {number} fail - Action to take if stencil test is failed. Can be:
   *
   * - {@link STENCILOP_KEEP}: don't change the stencil buffer value
   * - {@link STENCILOP_ZERO}: set value to zero
   * - {@link STENCILOP_REPLACE}: replace value with the reference value (see {@link GraphicsDevice#setStencilFunc})
   * - {@link STENCILOP_INCREMENT}: increment the value
   * - {@link STENCILOP_INCREMENTWRAP}: increment the value, but wrap it to zero when it's larger
   * than a maximum representable value
   * - {@link STENCILOP_DECREMENT}: decrement the value
   * - {@link STENCILOP_DECREMENTWRAP}: decrement the value, but wrap it to a maximum
   * representable value, if the current value is 0
   * - {@link STENCILOP_INVERT}: invert the value bitwise
   *
   * @param {number} zfail - Action to take if depth test is failed.  Accepts the same values as
   * `fail`.
   * @param {number} zpass - Action to take if both depth and stencil test are passed. Accepts
   * the same values as `fail`.
   * @param {number} writeMask - A bit mask applied to the reference value, when written.
   */
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

  /**
   * Configures how stencil buffer values should be modified based on the result of depth/stencil
   * tests. Works for front faces.
   *
   * @param {number} fail - Action to take if stencil test is failed. Can be:
   *
   * - {@link STENCILOP_KEEP}: don't change the stencil buffer value
   * - {@link STENCILOP_ZERO}: set value to zero
   * - {@link STENCILOP_REPLACE}: replace value with the reference value (see {@link GraphicsDevice#setStencilFunc})
   * - {@link STENCILOP_INCREMENT}: increment the value
   * - {@link STENCILOP_INCREMENTWRAP}: increment the value, but wrap it to zero when it's larger
   * than a maximum representable value
   * - {@link STENCILOP_DECREMENT}: decrement the value
   * - {@link STENCILOP_DECREMENTWRAP}: decrement the value, but wrap it to a maximum
   * representable value, if the current value is 0
   * - {@link STENCILOP_INVERT}: invert the value bitwise
   *
   * @param {number} zfail - Action to take if depth test is failed.  Accepts the same values as
   * `fail`.
   * @param {number} zpass - Action to take if both depth and stencil test are passed.  Accepts
   * the same values as `fail`.
   * @param {number} writeMask - A bit mask applied to the reference value, when written.
   */
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

  /**
   * Configures how stencil buffer values should be modified based on the result of depth/stencil
   * tests. Works for back faces.
   *
   * @param {number} fail - Action to take if stencil test is failed. Can be:
   *
   * - {@link STENCILOP_KEEP}: don't change the stencil buffer value
   * - {@link STENCILOP_ZERO}: set value to zero
   * - {@link STENCILOP_REPLACE}: replace value with the reference value (see {@link GraphicsDevice#setStencilFunc})
   * - {@link STENCILOP_INCREMENT}: increment the value
   * - {@link STENCILOP_INCREMENTWRAP}: increment the value, but wrap it to zero when it's larger
   * than a maximum representable value
   * - {@link STENCILOP_DECREMENT}: decrement the value
   * - {@link STENCILOP_DECREMENTWRAP}: decrement the value, but wrap it to a maximum
   * representable value, if the current value is 0
   * - {@link STENCILOP_INVERT}: invert the value bitwise
   *
   * @param {number} zfail - Action to take if depth test is failed. Accepts the same values as
   * `fail`.
   * @param {number} zpass - Action to take if both depth and stencil test are passed. Accepts
   * the same values as `fail`.
   * @param {number} writeMask - A bit mask applied to the reference value, when written.
   */
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
  setBlendState(blendState) {
    const currentBlendState = this.blendState;
    if (!currentBlendState.equals(blendState)) {
      const gl = this.gl;

      // state values to set
      const {
        blend,
        colorOp,
        alphaOp,
        colorSrcFactor,
        colorDstFactor,
        alphaSrcFactor,
        alphaDstFactor
      } = blendState;

      // enable blend
      if (currentBlendState.blend !== blend) {
        if (blend) {
          gl.enable(gl.BLEND);
        } else {
          gl.disable(gl.BLEND);
        }
      }

      // blend ops
      if (currentBlendState.colorOp !== colorOp || currentBlendState.alphaOp !== alphaOp) {
        const glBlendEquation = this.glBlendEquation;
        gl.blendEquationSeparate(glBlendEquation[colorOp], glBlendEquation[alphaOp]);
      }

      // blend factors
      if (currentBlendState.colorSrcFactor !== colorSrcFactor || currentBlendState.colorDstFactor !== colorDstFactor || currentBlendState.alphaSrcFactor !== alphaSrcFactor || currentBlendState.alphaDstFactor !== alphaDstFactor) {
        gl.blendFuncSeparate(this.glBlendFunctionColor[colorSrcFactor], this.glBlendFunctionColor[colorDstFactor], this.glBlendFunctionAlpha[alphaSrcFactor], this.glBlendFunctionAlpha[alphaDstFactor]);
      }

      // color write
      if (currentBlendState.allWrite !== blendState.allWrite) {
        this.gl.colorMask(blendState.redWrite, blendState.greenWrite, blendState.blueWrite, blendState.alphaWrite);
      }

      // update internal state
      currentBlendState.copy(blendState);
    }
  }

  /**
   * Set the source and destination blending factors.
   *
   * @param {number} r - The red component in the range of 0 to 1. Default value is 0.
   * @param {number} g - The green component in the range of 0 to 1. Default value is 0.
   * @param {number} b - The blue component in the range of 0 to 1. Default value is 0.
   * @param {number} a - The alpha component in the range of 0 to 1. Default value is 0.
   * @ignore
   */
  setBlendColor(r, g, b, a) {
    const c = this.blendColor;
    if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
      this.gl.blendColor(r, g, b, a);
      c.set(r, g, b, a);
    }
  }
  setDepthState(depthState) {
    const currentDepthState = this.depthState;
    if (!currentDepthState.equals(depthState)) {
      const gl = this.gl;

      // write
      const write = depthState.write;
      if (currentDepthState.write !== write) {
        gl.depthMask(write);
      }

      // handle case where depth testing is off, but depth write is on => enable always test to depth write
      // Note on WebGL API behavior: When depth testing is disabled, writes to the depth buffer are also disabled.
      let {
        func,
        test
      } = depthState;
      if (!test && write) {
        test = true;
        func = FUNC_ALWAYS;
      }
      if (currentDepthState.func !== func) {
        gl.depthFunc(this.glComparison[func]);
      }
      if (currentDepthState.test !== test) {
        if (test) {
          gl.enable(gl.DEPTH_TEST);
        } else {
          gl.disable(gl.DEPTH_TEST);
        }
      }

      // update internal state
      currentDepthState.copy(depthState);
    }
  }

  /**
   * Controls how triangles are culled based on their face direction. The default cull mode is
   * {@link CULLFACE_BACK}.
   *
   * @param {number} cullMode - The cull mode to set. Can be:
   *
   * - {@link CULLFACE_NONE}
   * - {@link CULLFACE_BACK}
   * - {@link CULLFACE_FRONT}
   * - {@link CULLFACE_FRONTANDBACK}
   */
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

  /**
   * Gets the current cull mode.
   *
   * @returns {number} The current cull mode.
   * @ignore
   */
  getCullMode() {
    return this.cullMode;
  }

  /**
   * Sets the active shader to be used during subsequent draw calls.
   *
   * @param {Shader} shader - The shader to set to assign to the device.
   * @returns {boolean} True if the shader was successfully set, false otherwise.
   */
  setShader(shader) {
    if (shader !== this.shader) {
      if (shader.failed) {
        return false;
      } else if (!shader.ready && !shader.impl.finalize(this, shader)) {
        shader.failed = true;
        return false;
      }
      this.shader = shader;

      // Set the active shader
      this.gl.useProgram(shader.impl.glProgram);
      this._shaderSwitchesPerFrame++;
      this.attributesInvalidated = true;
    }
    return true;
  }

  /**
   * Get a supported HDR pixel format given a set of hardware support requirements.
   *
   * @param {boolean} preferLargest - If true, prefer the highest precision format. Otherwise prefer the lowest precision format.
   * @param {boolean} renderable - If true, only include pixel formats that can be used as render targets.
   * @param {boolean} updatable - If true, only include formats that can be updated by the CPU.
   * @param {boolean} filterable - If true, only include formats that support texture filtering.
   *
   * @returns {number} The HDR pixel format or null if there are none.
   * @ignore
   */
  getHdrFormat(preferLargest, renderable, updatable, filterable) {
    // Note that for WebGL2, PIXELFORMAT_RGB16F and PIXELFORMAT_RGB32F are not renderable according to this:
    // https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float
    // For WebGL1, only PIXELFORMAT_RGBA16F and PIXELFORMAT_RGBA32F are tested for being renderable.
    const f16Valid = this.extTextureHalfFloat && (!renderable || this.textureHalfFloatRenderable) && (!updatable || this.textureHalfFloatUpdatable) && (!filterable || this.extTextureHalfFloatLinear);
    const f32Valid = this.extTextureFloat && (!renderable || this.textureFloatRenderable) && (!filterable || this.extTextureFloatLinear);
    if (f16Valid && f32Valid) {
      return preferLargest ? PIXELFORMAT_RGBA32F : PIXELFORMAT_RGBA16F;
    } else if (f16Valid) {
      return PIXELFORMAT_RGBA16F;
    } else if (f32Valid) {
      return PIXELFORMAT_RGBA32F;
    } /* else */
    return null;
  }

  /**
   * Frees memory from all vertex array objects ever allocated with this device.
   *
   * @ignore
   */
  clearVertexArrayObjectCache() {
    const gl = this.gl;
    this._vaoMap.forEach((item, key, mapObj) => {
      gl.deleteVertexArray(item);
    });
    this._vaoMap.clear();
  }
  resizeCanvas(width, height) {
    this._width = width;
    this._height = height;
    const ratio = Math.min(this._maxPixelRatio, platform.browser ? window.devicePixelRatio : 1);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.fire(GraphicsDevice.EVENT_RESIZE, width, height);
    }
  }

  /**
   * Width of the back buffer in pixels.
   *
   * @type {number}
   */
  get width() {
    return this.gl.drawingBufferWidth || this.canvas.width;
  }

  /**
   * Height of the back buffer in pixels.
   *
   * @type {number}
   */
  get height() {
    return this.gl.drawingBufferHeight || this.canvas.height;
  }

  /**
   * Fullscreen mode.
   *
   * @type {boolean}
   */
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

  /**
   * Check if high precision floating-point textures are supported.
   *
   * @type {boolean}
   */
  get textureFloatHighPrecision() {
    if (this._textureFloatHighPrecision === undefined) {
      this._textureFloatHighPrecision = testTextureFloatHighPrecision(this);
    }
    return this._textureFloatHighPrecision;
  }

  /**
   * Check if texture with half float format can be updated with data.
   *
   * @type {boolean}
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNldHVwVmVydGV4QXJyYXlPYmplY3QgfSBmcm9tICcuLi8uLi8uLi9wb2x5ZmlsbC9PRVNWZXJ0ZXhBcnJheU9iamVjdC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgQ0xFQVJGTEFHX0NPTE9SLCBDTEVBUkZMQUdfREVQVEgsIENMRUFSRkxBR19TVEVOQ0lMLFxuICAgIENVTExGQUNFX0JBQ0ssIENVTExGQUNFX05PTkUsXG4gICAgRklMVEVSX05FQVJFU1QsIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNULCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBGVU5DX0FMV0FZUyxcbiAgICBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBTVEVOQ0lMT1BfS0VFUCxcbiAgICBVTklGT1JNVFlQRV9CT09MLCBVTklGT1JNVFlQRV9JTlQsIFVOSUZPUk1UWVBFX0ZMT0FULCBVTklGT1JNVFlQRV9WRUMyLCBVTklGT1JNVFlQRV9WRUMzLFxuICAgIFVOSUZPUk1UWVBFX1ZFQzQsIFVOSUZPUk1UWVBFX0lWRUMyLCBVTklGT1JNVFlQRV9JVkVDMywgVU5JRk9STVRZUEVfSVZFQzQsIFVOSUZPUk1UWVBFX0JWRUMyLFxuICAgIFVOSUZPUk1UWVBFX0JWRUMzLCBVTklGT1JNVFlQRV9CVkVDNCwgVU5JRk9STVRZUEVfTUFUMiwgVU5JRk9STVRZUEVfTUFUMywgVU5JRk9STVRZUEVfTUFUNCxcbiAgICBVTklGT1JNVFlQRV9URVhUVVJFMkQsIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFLCBVTklGT1JNVFlQRV9GTE9BVEFSUkFZLCBVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XLFxuICAgIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVywgVU5JRk9STVRZUEVfVEVYVFVSRTNELCBVTklGT1JNVFlQRV9WRUMyQVJSQVksIFVOSUZPUk1UWVBFX1ZFQzNBUlJBWSwgVU5JRk9STVRZUEVfVkVDNEFSUkFZLFxuICAgIHNlbWFudGljVG9Mb2NhdGlvbixcbiAgICBQUklNSVRJVkVfVFJJU1RSSVAsXG4gICAgREVWSUNFVFlQRV9XRUJHTDIsXG4gICAgREVWSUNFVFlQRV9XRUJHTDFcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgR3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuLi9ncmFwaGljcy1kZXZpY2UuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vZGVidWctZ3JhcGhpY3MuanMnO1xuXG5pbXBvcnQgeyBXZWJnbFZlcnRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ2wtdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJnbEluZGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJnbC1pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xTaGFkZXIgfSBmcm9tICcuL3dlYmdsLXNoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJnbFRleHR1cmUgfSBmcm9tICcuL3dlYmdsLXRleHR1cmUuanMnO1xuaW1wb3J0IHsgV2ViZ2xSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3dlYmdsLXJlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2hhZGVyVXRpbHMgfSBmcm9tICcuLi9zaGFkZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSAnLi4vc2hhZGVyLmpzJztcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tICcuLi9ibGVuZC1zdGF0ZS5qcyc7XG5pbXBvcnQgeyBEZXB0aFN0YXRlIH0gZnJvbSAnLi4vZGVwdGgtc3RhdGUuanMnO1xuXG5jb25zdCBpbnZhbGlkYXRlQXR0YWNobWVudHMgPSBbXTtcblxuY29uc3QgX2Z1bGxTY3JlZW5RdWFkVlMgPSAvKiBnbHNsICovYFxuYXR0cmlidXRlIHZlYzIgdmVydGV4X3Bvc2l0aW9uO1xudmFyeWluZyB2ZWMyIHZVdjA7XG52b2lkIG1haW4odm9pZClcbntcbiAgICBnbF9Qb3NpdGlvbiA9IHZlYzQodmVydGV4X3Bvc2l0aW9uLCAwLjUsIDEuMCk7XG4gICAgdlV2MCA9IHZlcnRleF9wb3NpdGlvbi54eSowLjUrMC41O1xufVxuYDtcblxuY29uc3QgX3ByZWNpc2lvblRlc3QxUFMgPSAvKiBnbHNsICovYFxudm9pZCBtYWluKHZvaWQpIHsgXG4gICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgyMTQ3NDgzNjQ4LjApO1xufVxuYDtcblxuY29uc3QgX3ByZWNpc2lvblRlc3QyUFMgPSAvKiBnbHNsICovYFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xudmVjNCBwYWNrRmxvYXQoZmxvYXQgZGVwdGgpIHtcbiAgICBjb25zdCB2ZWM0IGJpdF9zaGlmdCA9IHZlYzQoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wLCAyNTYuMCAqIDI1Ni4wLCAyNTYuMCwgMS4wKTtcbiAgICBjb25zdCB2ZWM0IGJpdF9tYXNrICA9IHZlYzQoMC4wLCAxLjAgLyAyNTYuMCwgMS4wIC8gMjU2LjAsIDEuMCAvIDI1Ni4wKTtcbiAgICB2ZWM0IHJlcyA9IG1vZChkZXB0aCAqIGJpdF9zaGlmdCAqIHZlYzQoMjU1KSwgdmVjNCgyNTYpICkgLyB2ZWM0KDI1NSk7XG4gICAgcmVzIC09IHJlcy54eHl6ICogYml0X21hc2s7XG4gICAgcmV0dXJuIHJlcztcbn1cbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgZmxvYXQgYyA9IHRleHR1cmUyRChzb3VyY2UsIHZlYzIoMC4wKSkucjtcbiAgICBmbG9hdCBkaWZmID0gYWJzKGMgLSAyMTQ3NDgzNjQ4LjApIC8gMjE0NzQ4MzY0OC4wO1xuICAgIGdsX0ZyYWdDb2xvciA9IHBhY2tGbG9hdChkaWZmKTtcbn1cbmA7XG5cbmNvbnN0IF9vdXRwdXRUZXh0dXJlMkQgPSAvKiBnbHNsICovYFxudmFyeWluZyB2ZWMyIHZVdjA7XG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XG52b2lkIG1haW4odm9pZCkge1xuICAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRChzb3VyY2UsIHZVdjApO1xufVxuYDtcblxuZnVuY3Rpb24gcXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0YXJnZXQsIHNoYWRlcikge1xuXG4gICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgXCJRdWFkV2l0aFNoYWRlclwiKTtcblxuICAgIGNvbnN0IG9sZFJ0ID0gZGV2aWNlLnJlbmRlclRhcmdldDtcbiAgICBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHRhcmdldCk7XG4gICAgZGV2aWNlLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICBkZXZpY2Uuc2V0Q3VsbE1vZGUoQ1VMTEZBQ0VfTk9ORSk7XG4gICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5ERUZBVUxUKTtcbiAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShEZXB0aFN0YXRlLk5PREVQVEgpO1xuXG4gICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihkZXZpY2UucXVhZFZlcnRleEJ1ZmZlciwgMCk7XG4gICAgZGV2aWNlLnNldFNoYWRlcihzaGFkZXIpO1xuXG4gICAgZGV2aWNlLmRyYXcoe1xuICAgICAgICB0eXBlOiBQUklNSVRJVkVfVFJJU1RSSVAsXG4gICAgICAgIGJhc2U6IDAsXG4gICAgICAgIGNvdW50OiA0LFxuICAgICAgICBpbmRleGVkOiBmYWxzZVxuICAgIH0pO1xuXG4gICAgZGV2aWNlLnVwZGF0ZUVuZCgpO1xuXG4gICAgZGV2aWNlLnNldFJlbmRlclRhcmdldChvbGRSdCk7XG4gICAgZGV2aWNlLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xufVxuXG5mdW5jdGlvbiB0ZXN0UmVuZGVyYWJsZShnbCwgcGl4ZWxGb3JtYXQpIHtcbiAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIC8vIENyZWF0ZSBhIDJ4MiB0ZXh0dXJlXG4gICAgY29uc3QgdGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgMiwgMiwgMCwgZ2wuUkdCQSwgcGl4ZWxGb3JtYXQsIG51bGwpO1xuXG4gICAgLy8gVHJ5IHRvIHVzZSB0aGlzIHRleHR1cmUgYXMgYSByZW5kZXIgdGFyZ2V0XG4gICAgY29uc3QgZnJhbWVidWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZnJhbWVidWZmZXIpO1xuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSwgMCk7XG5cbiAgICAvLyBJdCBpcyBsZWdhbCBmb3IgYSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBleHBvc2luZyB0aGUgT0VTX3RleHR1cmVfZmxvYXQgZXh0ZW5zaW9uIHRvXG4gICAgLy8gc3VwcG9ydCBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBidXQgbm90IGFzIGF0dGFjaG1lbnRzIHRvIGZyYW1lYnVmZmVyIG9iamVjdHMuXG4gICAgaWYgKGdsLmNoZWNrRnJhbWVidWZmZXJTdGF0dXMoZ2wuRlJBTUVCVUZGRVIpICE9PSBnbC5GUkFNRUJVRkZFUl9DT01QTEVURSkge1xuICAgICAgICByZXN1bHQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDbGVhbiB1cFxuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xuICAgIGdsLmRlbGV0ZVRleHR1cmUodGV4dHVyZSk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcbiAgICBnbC5kZWxldGVGcmFtZWJ1ZmZlcihmcmFtZWJ1ZmZlcik7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiB0ZXN0VGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZShnbCwgcGl4ZWxGb3JtYXQpIHtcbiAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIC8vIENyZWF0ZSBhIDJ4MiB0ZXh0dXJlXG4gICAgY29uc3QgdGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuXG4gICAgLy8gdXBsb2FkIHNvbWUgZGF0YSAtIG9uIGlPUyBwcmlvciB0byBhYm91dCBOb3ZlbWJlciAyMDE5LCBwYXNzaW5nIGRhdGEgdG8gaGFsZiB0ZXh0dXJlIHdvdWxkIGZhaWwgaGVyZVxuICAgIC8vIHNlZSBkZXRhaWxzIGhlcmU6IGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNjk5OTlcbiAgICAvLyBub3RlIHRoYXQgaWYgbm90IHN1cHBvcnRlZCwgdGhpcyBwcmludHMgYW4gZXJyb3IgdG8gY29uc29sZSwgdGhlIGVycm9yIGNhbiBiZSBzYWZlbHkgaWdub3JlZCBhcyBpdCdzIGhhbmRsZWRcbiAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQxNkFycmF5KDQgKiAyICogMik7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAyLCAyLCAwLCBnbC5SR0JBLCBwaXhlbEZvcm1hdCwgZGF0YSk7XG5cbiAgICBpZiAoZ2wuZ2V0RXJyb3IoKSAhPT0gZ2wuTk9fRVJST1IpIHtcbiAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQWJvdmUgZXJyb3IgcmVsYXRlZCB0byBIQUxGX0ZMT0FUX09FUyBjYW4gYmUgaWdub3JlZCwgaXQgd2FzIHRyaWdnZXJlZCBieSB0ZXN0aW5nIGhhbGYgZmxvYXQgdGV4dHVyZSBzdXBwb3J0XCIpO1xuICAgIH1cblxuICAgIC8vIENsZWFuIHVwXG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gICAgZ2wuZGVsZXRlVGV4dHVyZSh0ZXh0dXJlKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRlc3RUZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKGRldmljZSkge1xuICAgIGlmICghZGV2aWNlLnRleHR1cmVGbG9hdFJlbmRlcmFibGUpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHNoYWRlcjEgPSBuZXcgU2hhZGVyKGRldmljZSwgU2hhZGVyVXRpbHMuY3JlYXRlRGVmaW5pdGlvbihkZXZpY2UsIHtcbiAgICAgICAgbmFtZTogJ3B0ZXN0MScsXG4gICAgICAgIHZlcnRleENvZGU6IF9mdWxsU2NyZWVuUXVhZFZTLFxuICAgICAgICBmcmFnbWVudENvZGU6IF9wcmVjaXNpb25UZXN0MVBTXG4gICAgfSkpO1xuXG4gICAgY29uc3Qgc2hhZGVyMiA9IG5ldyBTaGFkZXIoZGV2aWNlLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKGRldmljZSwge1xuICAgICAgICBuYW1lOiAncHRlc3QyJyxcbiAgICAgICAgdmVydGV4Q29kZTogX2Z1bGxTY3JlZW5RdWFkVlMsXG4gICAgICAgIGZyYWdtZW50Q29kZTogX3ByZWNpc2lvblRlc3QyUFNcbiAgICB9KSk7XG5cbiAgICBjb25zdCB0ZXh0dXJlT3B0aW9ucyA9IHtcbiAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBMzJGLFxuICAgICAgICB3aWR0aDogMSxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbmFtZTogJ3Rlc3RGSFAnXG4gICAgfTtcbiAgICBjb25zdCB0ZXgxID0gbmV3IFRleHR1cmUoZGV2aWNlLCB0ZXh0dXJlT3B0aW9ucyk7XG4gICAgY29uc3QgdGFyZzEgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgY29sb3JCdWZmZXI6IHRleDEsXG4gICAgICAgIGRlcHRoOiBmYWxzZVxuICAgIH0pO1xuICAgIHF1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZzEsIHNoYWRlcjEpO1xuXG4gICAgdGV4dHVyZU9wdGlvbnMuZm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgY29uc3QgdGV4MiA9IG5ldyBUZXh0dXJlKGRldmljZSwgdGV4dHVyZU9wdGlvbnMpO1xuICAgIGNvbnN0IHRhcmcyID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgyLFxuICAgICAgICBkZXB0aDogZmFsc2VcbiAgICB9KTtcbiAgICBkZXZpY2UuY29uc3RhbnRUZXhTb3VyY2Uuc2V0VmFsdWUodGV4MSk7XG4gICAgcXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0YXJnMiwgc2hhZGVyMik7XG5cbiAgICBjb25zdCBwcmV2RnJhbWVidWZmZXIgPSBkZXZpY2UuYWN0aXZlRnJhbWVidWZmZXI7XG4gICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHRhcmcyLmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuXG4gICAgY29uc3QgcGl4ZWxzID0gbmV3IFVpbnQ4QXJyYXkoNCk7XG4gICAgZGV2aWNlLnJlYWRQaXhlbHMoMCwgMCwgMSwgMSwgcGl4ZWxzKTtcblxuICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcihwcmV2RnJhbWVidWZmZXIpO1xuXG4gICAgY29uc3QgeCA9IHBpeGVsc1swXSAvIDI1NTtcbiAgICBjb25zdCB5ID0gcGl4ZWxzWzFdIC8gMjU1O1xuICAgIGNvbnN0IHogPSBwaXhlbHNbMl0gLyAyNTU7XG4gICAgY29uc3QgdyA9IHBpeGVsc1szXSAvIDI1NTtcbiAgICBjb25zdCBmID0geCAvICgyNTYgKiAyNTYgKiAyNTYpICsgeSAvICgyNTYgKiAyNTYpICsgeiAvIDI1NiArIHc7XG5cbiAgICB0ZXgxLmRlc3Ryb3koKTtcbiAgICB0YXJnMS5kZXN0cm95KCk7XG4gICAgdGV4Mi5kZXN0cm95KCk7XG4gICAgdGFyZzIuZGVzdHJveSgpO1xuICAgIHNoYWRlcjEuZGVzdHJveSgpO1xuICAgIHNoYWRlcjIuZGVzdHJveSgpO1xuXG4gICAgcmV0dXJuIGYgPT09IDA7XG59XG5cbi8vIEltYWdlQml0bWFwIGN1cnJlbnQgc3RhdGUgKFNlcCAyMDIyKTpcbi8vIC0gTGFzdGVzdCBDaHJvbWUgYW5kIEZpcmVmb3ggYnJvd3NlcnMgYXBwZWFyIHRvIHN1cHBvcnQgdGhlIEltYWdlQml0bWFwIEFQSSBmaW5lICh0aG91Z2hcbi8vICAgdGhlcmUgYXJlIGxpa2VseSBzdGlsbCBpc3N1ZXMgd2l0aCBvbGRlciB2ZXJzaW9ucyBvZiBib3RoKS5cbi8vIC0gU2FmYXJpIHN1cHBvcnRzIHRoZSBBUEksIGJ1dCBjb21wbGV0ZWx5IGRlc3Ryb3lzIHNvbWUgcG5ncy4gRm9yIGV4YW1wbGUgdGhlIGN1YmVtYXBzIGluXG4vLyAgIHN0ZWFtcHVuayBzbG90cyBodHRwczovL3BsYXljYW52YXMuY29tL2VkaXRvci9zY2VuZS81MjQ4NTguIFNlZSB0aGUgd2Via2l0IGlzc3VlXG4vLyAgIGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xODI0MjQgZm9yIHN0YXR1cy5cbi8vIC0gU29tZSBhcHBsaWNhdGlvbnMgYXNzdW1lIHRoYXQgUE5HcyBsb2FkZWQgYnkgdGhlIGVuZ2luZSB1c2UgSFRNTEltYWdlQml0bWFwIGludGVyZmFjZSBhbmRcbi8vICAgZmFpbCB3aGVuIHVzaW5nIEltYWdlQml0bWFwLiBGb3IgZXhhbXBsZSwgU3BhY2UgQmFzZSBwcm9qZWN0IGZhaWxzIGJlY2F1c2UgaXQgdXNlcyBlbmdpbmVcbi8vICAgdGV4dHVyZSBhc3NldHMgb24gdGhlIGRvbSBodHRwczovL3BsYXljYW52YXMuY29tL2VkaXRvci9zY2VuZS80NDYyNzguXG5cbi8vIFRoaXMgZnVuY3Rpb24gdGVzdHMgd2hldGhlciB0aGUgY3VycmVudCBicm93c2VyIGRlc3Ryb3lzIFBORyBkYXRhIG9yIG5vdC5cbmZ1bmN0aW9uIHRlc3RJbWFnZUJpdG1hcChkZXZpY2UpIHtcbiAgICAvLyAxeDEgcG5nIGltYWdlIGNvbnRhaW5pbmcgcmdiYSgxLCAyLCAzLCA2MylcbiAgICBjb25zdCBwbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMTM3LCA4MCwgNzgsIDcxLCAxMywgMTAsIDI2LCAxMCwgMCwgMCwgMCwgMTMsIDczLCA3MiwgNjgsIDgyLCAwLCAwLCAwLCAxLCAwLCAwLCAwLCAxLCA4LCA2LCAwLCAwLCAwLCAzMSwgMjEsXG4gICAgICAgIDE5NiwgMTM3LCAwLCAwLCAwLCAxMywgNzMsIDY4LCA2NSwgODQsIDEyMCwgMjE4LCA5OSwgMTAwLCAxMDAsIDk4LCAxODIsIDcsIDAsIDAsIDg5LCAwLCA3MSwgNjcsIDEzMywgMTQ4LCAyMzcsXG4gICAgICAgIDAsIDAsIDAsIDAsIDczLCA2OSwgNzgsIDY4LCAxNzQsIDY2LCA5NiwgMTMwXG4gICAgXSk7XG5cbiAgICByZXR1cm4gY3JlYXRlSW1hZ2VCaXRtYXAobmV3IEJsb2IoW3BuZ0J5dGVzXSwgeyB0eXBlOiAnaW1hZ2UvcG5nJyB9KSwgeyBwcmVtdWx0aXBseUFscGhhOiAnbm9uZScgfSlcbiAgICAgICAgLnRoZW4oKGltYWdlKSA9PiB7XG4gICAgICAgICAgICAvLyBjcmVhdGUgdGhlIHRleHR1cmVcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgICAgICB3aWR0aDogMSxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IDEsXG4gICAgICAgICAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICAgICAgICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBsZXZlbHM6IFtpbWFnZV1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyByZWFkIHBpeGVsc1xuICAgICAgICAgICAgY29uc3QgcnQgPSBuZXcgUmVuZGVyVGFyZ2V0KHsgY29sb3JCdWZmZXI6IHRleHR1cmUsIGRlcHRoOiBmYWxzZSB9KTtcbiAgICAgICAgICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcihydC5pbXBsLl9nbEZyYW1lQnVmZmVyKTtcbiAgICAgICAgICAgIGRldmljZS5pbml0UmVuZGVyVGFyZ2V0KHJ0KTtcblxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBVaW50OENsYW1wZWRBcnJheSg0KTtcbiAgICAgICAgICAgIGRldmljZS5nbC5yZWFkUGl4ZWxzKDAsIDAsIDEsIDEsIGRldmljZS5nbC5SR0JBLCBkZXZpY2UuZ2wuVU5TSUdORURfQllURSwgZGF0YSk7XG5cbiAgICAgICAgICAgIHJ0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRleHR1cmUuZGVzdHJveSgpO1xuXG4gICAgICAgICAgICByZXR1cm4gZGF0YVswXSA9PT0gMSAmJiBkYXRhWzFdID09PSAyICYmIGRhdGFbMl0gPT09IDMgJiYgZGF0YVszXSA9PT0gNjM7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlID0+IGZhbHNlKTtcbn1cblxuLyoqXG4gKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIG1hbmFnZXMgdGhlIHVuZGVybHlpbmcgZ3JhcGhpY3MgY29udGV4dC4gSXQgaXMgcmVzcG9uc2libGUgZm9yIHN1Ym1pdHRpbmdcbiAqIHJlbmRlciBzdGF0ZSBjaGFuZ2VzIGFuZCBncmFwaGljcyBwcmltaXRpdmVzIHRvIHRoZSBoYXJkd2FyZS4gQSBncmFwaGljcyBkZXZpY2UgaXMgdGllZCB0byBhXG4gKiBzcGVjaWZpYyBjYW52YXMgSFRNTCBlbGVtZW50LiBJdCBpcyB2YWxpZCB0byBoYXZlIG1vcmUgdGhhbiBvbmUgY2FudmFzIGVsZW1lbnQgcGVyIHBhZ2UgYW5kXG4gKiBjcmVhdGUgYSBuZXcgZ3JhcGhpY3MgZGV2aWNlIGFnYWluc3QgZWFjaC5cbiAqXG4gKiBAYXVnbWVudHMgR3JhcGhpY3NEZXZpY2VcbiAqL1xuY2xhc3MgV2ViZ2xHcmFwaGljc0RldmljZSBleHRlbmRzIEdyYXBoaWNzRGV2aWNlIHtcbiAgICAvKipcbiAgICAgKiBUaGUgV2ViR0wgY29udGV4dCBtYW5hZ2VkIGJ5IHRoZSBncmFwaGljcyBkZXZpY2UuIFRoZSB0eXBlIGNvdWxkIGFsc28gdGVjaG5pY2FsbHkgYmVcbiAgICAgKiBgV2ViR0xSZW5kZXJpbmdDb250ZXh0YCBpZiBXZWJHTCAyLjAgaXMgbm90IGF2YWlsYWJsZS4gQnV0IGluIG9yZGVyIGZvciBJbnRlbGxpU2Vuc2UgdG8gYmVcbiAgICAgKiBhYmxlIHRvIGZ1bmN0aW9uIGZvciBhbGwgV2ViR0wgY2FsbHMgaW4gdGhlIGNvZGViYXNlLCB3ZSBzcGVjaWZ5IGBXZWJHTDJSZW5kZXJpbmdDb250ZXh0YFxuICAgICAqIGhlcmUgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtXZWJHTDJSZW5kZXJpbmdDb250ZXh0fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnbDtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIFdlYkdMIGNvbnRleHQgb2YgdGhpcyBkZXZpY2UgaXMgdXNpbmcgdGhlIFdlYkdMIDIuMCBBUEkuIElmIGZhbHNlLCBXZWJHTCAxLjAgaXNcbiAgICAgKiBiZWluZyB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHdlYmdsMjtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgV2ViZ2xHcmFwaGljc0RldmljZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR9IGNhbnZhcyAtIFRoZSBjYW52YXMgdG8gd2hpY2ggdGhlIGdyYXBoaWNzIGRldmljZSB3aWxsIHJlbmRlci5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9ucyBwYXNzZWQgd2hlbiBjcmVhdGluZyB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFscGhhPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyBpZiB0aGUgY2FudmFzIGNvbnRhaW5zIGFuXG4gICAgICogYWxwaGEgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGVwdGg9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhlIGRyYXdpbmcgYnVmZmVyIGlzXG4gICAgICogcmVxdWVzdGVkIHRvIGhhdmUgYSBkZXB0aCBidWZmZXIgb2YgYXQgbGVhc3QgMTYgYml0cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN0ZW5jaWw9ZmFsc2VdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBkcmF3aW5nIGJ1ZmZlciBpc1xuICAgICAqIHJlcXVlc3RlZCB0byBoYXZlIGEgc3RlbmNpbCBidWZmZXIgb2YgYXQgbGVhc3QgOCBiaXRzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYW50aWFsaWFzPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB3aGV0aGVyIG9yIG5vdCB0byBwZXJmb3JtXG4gICAgICogYW50aS1hbGlhc2luZyBpZiBwb3NzaWJsZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZW11bHRpcGxpZWRBbHBoYT10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGUgcGFnZVxuICAgICAqIGNvbXBvc2l0b3Igd2lsbCBhc3N1bWUgdGhlIGRyYXdpbmcgYnVmZmVyIGNvbnRhaW5zIGNvbG9ycyB3aXRoIHByZS1tdWx0aXBsaWVkIGFscGhhLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlc2VydmVEcmF3aW5nQnVmZmVyPWZhbHNlXSAtIElmIHRoZSB2YWx1ZSBpcyB0cnVlIHRoZSBidWZmZXJzXG4gICAgICogd2lsbCBub3QgYmUgY2xlYXJlZCBhbmQgd2lsbCBwcmVzZXJ2ZSB0aGVpciB2YWx1ZXMgdW50aWwgY2xlYXJlZCBvciBvdmVyd3JpdHRlbiBieSB0aGVcbiAgICAgKiBhdXRob3IuXG4gICAgICogQHBhcmFtIHsnZGVmYXVsdCd8J2hpZ2gtcGVyZm9ybWFuY2UnfCdsb3ctcG93ZXInfSBbb3B0aW9ucy5wb3dlclByZWZlcmVuY2U9J2RlZmF1bHQnXSAtIEFcbiAgICAgKiBoaW50IHRvIHRoZSB1c2VyIGFnZW50IGluZGljYXRpbmcgd2hhdCBjb25maWd1cmF0aW9uIG9mIEdQVSBpcyBzdWl0YWJsZSBmb3IgdGhlIFdlYkdMXG4gICAgICogY29udGV4dC4gUG9zc2libGUgdmFsdWVzIGFyZTpcbiAgICAgKlxuICAgICAqIC0gJ2RlZmF1bHQnOiBMZXQgdGhlIHVzZXIgYWdlbnQgZGVjaWRlIHdoaWNoIEdQVSBjb25maWd1cmF0aW9uIGlzIG1vc3Qgc3VpdGFibGUuIFRoaXMgaXMgdGhlXG4gICAgICogZGVmYXVsdCB2YWx1ZS5cbiAgICAgKiAtICdoaWdoLXBlcmZvcm1hbmNlJzogUHJpb3JpdGl6ZXMgcmVuZGVyaW5nIHBlcmZvcm1hbmNlIG92ZXIgcG93ZXIgY29uc3VtcHRpb24uXG4gICAgICogLSAnbG93LXBvd2VyJzogUHJpb3JpdGl6ZXMgcG93ZXIgc2F2aW5nIG92ZXIgcmVuZGVyaW5nIHBlcmZvcm1hbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mYWlsSWZNYWpvclBlcmZvcm1hbmNlQ2F2ZWF0PWZhbHNlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgaWYgYVxuICAgICAqIGNvbnRleHQgd2lsbCBiZSBjcmVhdGVkIGlmIHRoZSBzeXN0ZW0gcGVyZm9ybWFuY2UgaXMgbG93IG9yIGlmIG5vIGhhcmR3YXJlIEdQVSBpcyBhdmFpbGFibGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcmVmZXJXZWJHbDI9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIGlmIGEgV2ViR2wyIGNvbnRleHRcbiAgICAgKiBzaG91bGQgYmUgcHJlZmVycmVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGVzeW5jaHJvbml6ZWQ9ZmFsc2VdIC0gQm9vbGVhbiB0aGF0IGhpbnRzIHRoZSB1c2VyIGFnZW50IHRvXG4gICAgICogcmVkdWNlIHRoZSBsYXRlbmN5IGJ5IGRlc3luY2hyb25pemluZyB0aGUgY2FudmFzIHBhaW50IGN5Y2xlIGZyb20gdGhlIGV2ZW50IGxvb3AuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy54ckNvbXBhdGlibGVdIC0gQm9vbGVhbiB0aGF0IGhpbnRzIHRvIHRoZSB1c2VyIGFnZW50IHRvIHVzZSBhXG4gICAgICogY29tcGF0aWJsZSBncmFwaGljcyBhZGFwdGVyIGZvciBhbiBpbW1lcnNpdmUgWFIgZGV2aWNlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNhbnZhcywgb3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIHN1cGVyKGNhbnZhcyk7XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0RnJhbWVidWZmZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudXBkYXRlQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIC8vIEFkZCBoYW5kbGVycyBmb3Igd2hlbiB0aGUgV2ViR0wgY29udGV4dCBpcyBsb3N0IG9yIHJlc3RvcmVkXG4gICAgICAgIHRoaXMuY29udGV4dExvc3QgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHRMb3N0ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMubG9zZUNvbnRleHQoKTtcbiAgICAgICAgICAgIERlYnVnLmxvZygncGMuR3JhcGhpY3NEZXZpY2U6IFdlYkdMIGNvbnRleHQgbG9zdC4nKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZGV2aWNlbG9zdCcpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coJ3BjLkdyYXBoaWNzRGV2aWNlOiBXZWJHTCBjb250ZXh0IHJlc3RvcmVkLicpO1xuICAgICAgICAgICAgdGhpcy5yZXN0b3JlQ29udGV4dCgpO1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0TG9zdCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdkZXZpY2VyZXN0b3JlZCcpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIG9wdGlvbnMgZGVmYXVsdHNcbiAgICAgICAgb3B0aW9ucy5zdGVuY2lsID0gdHJ1ZTtcbiAgICAgICAgaWYgKCFvcHRpb25zLnBvd2VyUHJlZmVyZW5jZSkge1xuICAgICAgICAgICAgb3B0aW9ucy5wb3dlclByZWZlcmVuY2UgPSAnaGlnaC1wZXJmb3JtYW5jZSc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjNDEzNiAtIHR1cm4gb2ZmIGFudGlhbGlhc2luZyBvbiBBcHBsZVdlYktpdCBicm93c2VycyAxNS40XG4gICAgICAgIGNvbnN0IHVhID0gKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnKSAmJiBuYXZpZ2F0b3IudXNlckFnZW50O1xuICAgICAgICB0aGlzLmZvcmNlRGlzYWJsZU11bHRpc2FtcGxpbmcgPSB1YSAmJiB1YS5pbmNsdWRlcygnQXBwbGVXZWJLaXQnKSAmJiAodWEuaW5jbHVkZXMoJzE1LjQnKSB8fCB1YS5pbmNsdWRlcygnMTVfNCcpKTtcbiAgICAgICAgaWYgKHRoaXMuZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZykge1xuICAgICAgICAgICAgb3B0aW9ucy5hbnRpYWxpYXMgPSBmYWxzZTtcbiAgICAgICAgICAgIERlYnVnLmxvZyhcIkFudGlhbGlhc2luZyBoYXMgYmVlbiB0dXJuZWQgb2ZmIGR1ZSB0byByZW5kZXJpbmcgaXNzdWVzIG9uIEFwcGxlV2ViS2l0IDE1LjRcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXRyaWV2ZSB0aGUgV2ViR0wgY29udGV4dFxuICAgICAgICBjb25zdCBwcmVmZXJXZWJHbDIgPSAob3B0aW9ucy5wcmVmZXJXZWJHbDIgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLnByZWZlcldlYkdsMiA6IHRydWU7XG5cbiAgICAgICAgY29uc3QgbmFtZXMgPSBwcmVmZXJXZWJHbDIgPyBbXCJ3ZWJnbDJcIiwgXCJ3ZWJnbFwiLCBcImV4cGVyaW1lbnRhbC13ZWJnbFwiXSA6IFtcIndlYmdsXCIsIFwiZXhwZXJpbWVudGFsLXdlYmdsXCJdO1xuICAgICAgICBsZXQgZ2wgPSBudWxsO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBnbCA9IGNhbnZhcy5nZXRDb250ZXh0KG5hbWVzW2ldLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgaWYgKGdsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53ZWJnbDIgPSAobmFtZXNbaV0gPT09IERFVklDRVRZUEVfV0VCR0wyKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXZpY2VUeXBlID0gdGhpcy53ZWJnbDIgPyBERVZJQ0VUWVBFX1dFQkdMMiA6IERFVklDRVRZUEVfV0VCR0wxO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMuZ2wgPSBnbDtcblxuICAgICAgICBpZiAoIWdsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJXZWJHTCBub3Qgc3VwcG9ydGVkXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcGl4ZWwgZm9ybWF0IG9mIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICBjb25zdCBhbHBoYUJpdHMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuQUxQSEFfQklUUyk7XG4gICAgICAgIHRoaXMuZnJhbWVidWZmZXJGb3JtYXQgPSBhbHBoYUJpdHMgPyBQSVhFTEZPUk1BVF9SR0JBOCA6IFBJWEVMRk9STUFUX1JHQjg7XG5cbiAgICAgICAgY29uc3QgaXNDaHJvbWUgPSBwbGF0Zm9ybS5icm93c2VyICYmICEhd2luZG93LmNocm9tZTtcbiAgICAgICAgY29uc3QgaXNNYWMgPSBwbGF0Zm9ybS5icm93c2VyICYmIG5hdmlnYXRvci5hcHBWZXJzaW9uLmluZGV4T2YoXCJNYWNcIikgIT09IC0xO1xuXG4gICAgICAgIC8vIGVuYWJsZSB0ZW1wb3JhcnkgdGV4dHVyZSB1bml0IHdvcmthcm91bmQgb24gZGVza3RvcCBzYWZhcmlcbiAgICAgICAgdGhpcy5fdGVtcEVuYWJsZVNhZmFyaVRleHR1cmVVbml0V29ya2Fyb3VuZCA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgISF3aW5kb3cuc2FmYXJpO1xuXG4gICAgICAgIC8vIGVuYWJsZSB0ZW1wb3Jhcnkgd29ya2Fyb3VuZCBmb3IgZ2xCbGl0RnJhbWVidWZmZXIgZmFpbGluZyBvbiBNYWMgQ2hyb21lICgjMjUwNClcbiAgICAgICAgdGhpcy5fdGVtcE1hY0Nocm9tZUJsaXRGcmFtZWJ1ZmZlcldvcmthcm91bmQgPSBpc01hYyAmJiBpc0Nocm9tZSAmJiAhb3B0aW9ucy5hbHBoYTtcblxuICAgICAgICAvLyBpbml0IHBvbHlmaWxsIGZvciBWQU9zIHVuZGVyIHdlYmdsMVxuICAgICAgICBpZiAoIXRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICBzZXR1cFZlcnRleEFycmF5T2JqZWN0KGdsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwid2ViZ2xjb250ZXh0bG9zdFwiLCB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRyZXN0b3JlZFwiLCB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5pbml0aWFsaXplRXh0ZW5zaW9ucygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVDYXBhYmlsaXRpZXMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplUmVuZGVyU3RhdGUoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuXG4gICAgICAgIC8vIHN0YXJ0IGFzeW5jIGltYWdlIGJpdG1hcCB0ZXN0XG4gICAgICAgIHRoaXMuc3VwcG9ydHNJbWFnZUJpdG1hcCA9IG51bGw7XG4gICAgICAgIGlmICh0eXBlb2YgSW1hZ2VCaXRtYXAgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICB0ZXN0SW1hZ2VCaXRtYXAodGhpcykudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5zdXBwb3J0c0ltYWdlQml0bWFwID0gcmVzdWx0O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmdsQWRkcmVzcyA9IFtcbiAgICAgICAgICAgIGdsLlJFUEVBVCxcbiAgICAgICAgICAgIGdsLkNMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBnbC5NSVJST1JFRF9SRVBFQVRcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQmxlbmRFcXVhdGlvbiA9IFtcbiAgICAgICAgICAgIGdsLkZVTkNfQURELFxuICAgICAgICAgICAgZ2wuRlVOQ19TVUJUUkFDVCxcbiAgICAgICAgICAgIGdsLkZVTkNfUkVWRVJTRV9TVUJUUkFDVCxcbiAgICAgICAgICAgIHRoaXMud2ViZ2wyID8gZ2wuTUlOIDogdGhpcy5leHRCbGVuZE1pbm1heCA/IHRoaXMuZXh0QmxlbmRNaW5tYXguTUlOX0VYVCA6IGdsLkZVTkNfQURELFxuICAgICAgICAgICAgdGhpcy53ZWJnbDIgPyBnbC5NQVggOiB0aGlzLmV4dEJsZW5kTWlubWF4ID8gdGhpcy5leHRCbGVuZE1pbm1heC5NQVhfRVhUIDogZ2wuRlVOQ19BRERcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQmxlbmRGdW5jdGlvbkNvbG9yID0gW1xuICAgICAgICAgICAgZ2wuWkVSTyxcbiAgICAgICAgICAgIGdsLk9ORSxcbiAgICAgICAgICAgIGdsLlNSQ19DT0xPUixcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19TUkNfQ09MT1IsXG4gICAgICAgICAgICBnbC5EU1RfQ09MT1IsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfRFNUX0NPTE9SLFxuICAgICAgICAgICAgZ2wuU1JDX0FMUEhBLFxuICAgICAgICAgICAgZ2wuU1JDX0FMUEhBX1NBVFVSQVRFLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX1NSQ19BTFBIQSxcbiAgICAgICAgICAgIGdsLkRTVF9BTFBIQSxcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19EU1RfQUxQSEEsXG4gICAgICAgICAgICBnbC5DT05TVEFOVF9DT0xPUixcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19DT05TVEFOVF9DT0xPUlxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uQWxwaGEgPSBbXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuT05FLFxuICAgICAgICAgICAgZ2wuU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICAgICAgICAgIGdsLkRTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19EU1RfQ09MT1IsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEFfU0FUVVJBVEUsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBLFxuICAgICAgICAgICAgZ2wuRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICAgICAgICAgIGdsLkNPTlNUQU5UX0FMUEhBLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0NPTlNUQU5UX0FMUEhBXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbENvbXBhcmlzb24gPSBbXG4gICAgICAgICAgICBnbC5ORVZFUixcbiAgICAgICAgICAgIGdsLkxFU1MsXG4gICAgICAgICAgICBnbC5FUVVBTCxcbiAgICAgICAgICAgIGdsLkxFUVVBTCxcbiAgICAgICAgICAgIGdsLkdSRUFURVIsXG4gICAgICAgICAgICBnbC5OT1RFUVVBTCxcbiAgICAgICAgICAgIGdsLkdFUVVBTCxcbiAgICAgICAgICAgIGdsLkFMV0FZU1xuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xTdGVuY2lsT3AgPSBbXG4gICAgICAgICAgICBnbC5LRUVQLFxuICAgICAgICAgICAgZ2wuWkVSTyxcbiAgICAgICAgICAgIGdsLlJFUExBQ0UsXG4gICAgICAgICAgICBnbC5JTkNSLFxuICAgICAgICAgICAgZ2wuSU5DUl9XUkFQLFxuICAgICAgICAgICAgZ2wuREVDUixcbiAgICAgICAgICAgIGdsLkRFQ1JfV1JBUCxcbiAgICAgICAgICAgIGdsLklOVkVSVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xDbGVhckZsYWcgPSBbXG4gICAgICAgICAgICAwLFxuICAgICAgICAgICAgZ2wuQ09MT1JfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLkRFUFRIX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLlNURU5DSUxfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLlNURU5DSUxfQlVGRkVSX0JJVCB8IGdsLkNPTE9SX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5TVEVOQ0lMX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklUIHwgZ2wuQ09MT1JfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVRcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQ3VsbCA9IFtcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBnbC5CQUNLLFxuICAgICAgICAgICAgZ2wuRlJPTlQsXG4gICAgICAgICAgICBnbC5GUk9OVF9BTkRfQkFDS1xuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xGaWx0ZXIgPSBbXG4gICAgICAgICAgICBnbC5ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTElORUFSLFxuICAgICAgICAgICAgZ2wuTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCxcbiAgICAgICAgICAgIGdsLk5FQVJFU1RfTUlQTUFQX0xJTkVBUixcbiAgICAgICAgICAgIGdsLkxJTkVBUl9NSVBNQVBfTkVBUkVTVCxcbiAgICAgICAgICAgIGdsLkxJTkVBUl9NSVBNQVBfTElORUFSXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbFByaW1pdGl2ZSA9IFtcbiAgICAgICAgICAgIGdsLlBPSU5UUyxcbiAgICAgICAgICAgIGdsLkxJTkVTLFxuICAgICAgICAgICAgZ2wuTElORV9MT09QLFxuICAgICAgICAgICAgZ2wuTElORV9TVFJJUCxcbiAgICAgICAgICAgIGdsLlRSSUFOR0xFUyxcbiAgICAgICAgICAgIGdsLlRSSUFOR0xFX1NUUklQLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVfRkFOXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbFR5cGUgPSBbXG4gICAgICAgICAgICBnbC5CWVRFLFxuICAgICAgICAgICAgZ2wuVU5TSUdORURfQllURSxcbiAgICAgICAgICAgIGdsLlNIT1JULFxuICAgICAgICAgICAgZ2wuVU5TSUdORURfU0hPUlQsXG4gICAgICAgICAgICBnbC5JTlQsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9JTlQsXG4gICAgICAgICAgICBnbC5GTE9BVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZSA9IHt9O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuQk9PTF0gICAgICAgICA9IFVOSUZPUk1UWVBFX0JPT0w7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRdICAgICAgICAgID0gVU5JRk9STVRZUEVfSU5UO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRdICAgICAgICA9IFVOSUZPUk1UWVBFX0ZMT0FUO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfVkVDMl0gICA9IFVOSUZPUk1UWVBFX1ZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9WRUMzXSAgID0gVU5JRk9STVRZUEVfVkVDMztcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX1ZFQzRdICAgPSBVTklGT1JNVFlQRV9WRUM0O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuSU5UX1ZFQzJdICAgICA9IFVOSUZPUk1UWVBFX0lWRUMyO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuSU5UX1ZFQzNdICAgICA9IFVOSUZPUk1UWVBFX0lWRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuSU5UX1ZFQzRdICAgICA9IFVOSUZPUk1UWVBFX0lWRUM0O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuQk9PTF9WRUMyXSAgICA9IFVOSUZPUk1UWVBFX0JWRUMyO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuQk9PTF9WRUMzXSAgICA9IFVOSUZPUk1UWVBFX0JWRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuQk9PTF9WRUM0XSAgICA9IFVOSUZPUk1UWVBFX0JWRUM0O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfTUFUMl0gICA9IFVOSUZPUk1UWVBFX01BVDI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9NQVQzXSAgID0gVU5JRk9STVRZUEVfTUFUMztcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX01BVDRdICAgPSBVTklGT1JNVFlQRV9NQVQ0O1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8yRF0gICA9IFVOSUZPUk1UWVBFX1RFWFRVUkUyRDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLlNBTVBMRVJfQ1VCRV0gPSBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRTtcbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8yRF9TSEFET1ddICAgPSBVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XO1xuICAgICAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLlNBTVBMRVJfQ1VCRV9TSEFET1ddID0gVU5JRk9STVRZUEVfVEVYVFVSRUNVQkVfU0hBRE9XO1xuICAgICAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLlNBTVBMRVJfM0RdICAgICAgICAgID0gVU5JRk9STVRZUEVfVEVYVFVSRTNEO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50YXJnZXRUb1Nsb3QgPSB7fTtcbiAgICAgICAgdGhpcy50YXJnZXRUb1Nsb3RbZ2wuVEVYVFVSRV8yRF0gPSAwO1xuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdFtnbC5URVhUVVJFX0NVQkVfTUFQXSA9IDE7XG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90W2dsLlRFWFRVUkVfM0RdID0gMjtcblxuICAgICAgICAvLyBEZWZpbmUgdGhlIHVuaWZvcm0gY29tbWl0IGZ1bmN0aW9uc1xuICAgICAgICBsZXQgc2NvcGVYLCBzY29wZVksIHNjb3BlWiwgc2NvcGVXO1xuICAgICAgICBsZXQgdW5pZm9ybVZhbHVlO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uID0gW107XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQk9PTF0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtLnZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xaSh1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLnZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSU5UXSA9IHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQk9PTF07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfRkxPQVRdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodW5pZm9ybS52YWx1ZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMWYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzJdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMmZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDM10gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIHNjb3BlWiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTNmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUM0XSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBzY29wZVcgPSB2YWx1ZVszXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSB8fCB1bmlmb3JtVmFsdWVbMl0gIT09IHNjb3BlWiB8fCB1bmlmb3JtVmFsdWVbM10gIT09IHNjb3BlVykge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm00ZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMl0gPSBzY29wZVo7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzNdID0gc2NvcGVXO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMyXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMml2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQlZFQzJdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDMl07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzNdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIHNjb3BlWiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTNpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CVkVDM10gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMzXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDNF0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBzY29wZVcgPSB2YWx1ZVszXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSB8fCB1bmlmb3JtVmFsdWVbMl0gIT09IHNjb3BlWiB8fCB1bmlmb3JtVmFsdWVbM10gIT09IHNjb3BlVykge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm00aXYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMl0gPSBzY29wZVo7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzNdID0gc2NvcGVXO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUM0XSA9IHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzRdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX01BVDJdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDJmdih1bmlmb3JtLmxvY2F0aW9uSWQsIGZhbHNlLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfTUFUM10gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtTWF0cml4M2Z2KHVuaWZvcm0ubG9jYXRpb25JZCwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9NQVQ0XSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm1NYXRyaXg0ZnYodW5pZm9ybS5sb2NhdGlvbklkLCBmYWxzZSwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0ZMT0FUQVJSQVldID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtMWZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzJBUlJBWV0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtMmZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzNBUlJBWV0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtM2Z2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzRBUlJBWV0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtNGZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuc3VwcG9ydHNCb25lVGV4dHVyZXMgPSB0aGlzLmV4dFRleHR1cmVGbG9hdCAmJiB0aGlzLm1heFZlcnRleFRleHR1cmVzID4gMDtcblxuICAgICAgICAvLyBDYWxjdWxhdGUgYW4gZXN0aW1hdGUgb2YgdGhlIG1heGltdW0gbnVtYmVyIG9mIGJvbmVzIHRoYXQgY2FuIGJlIHVwbG9hZGVkIHRvIHRoZSBHUFVcbiAgICAgICAgLy8gYmFzZWQgb24gdGhlIG51bWJlciBvZiBhdmFpbGFibGUgdW5pZm9ybXMgYW5kIHRoZSBudW1iZXIgb2YgdW5pZm9ybXMgcmVxdWlyZWQgZm9yIG5vbi1cbiAgICAgICAgLy8gYm9uZSBkYXRhLiAgVGhpcyBpcyBiYXNlZCBvZmYgb2YgdGhlIFN0YW5kYXJkIHNoYWRlci4gIEEgdXNlciBkZWZpbmVkIHNoYWRlciBtYXkgaGF2ZVxuICAgICAgICAvLyBldmVuIGxlc3Mgc3BhY2UgYXZhaWxhYmxlIGZvciBib25lcyBzbyB0aGlzIGNhbGN1bGF0ZWQgdmFsdWUgY2FuIGJlIG92ZXJyaWRkZW4gdmlhXG4gICAgICAgIC8vIHBjLkdyYXBoaWNzRGV2aWNlLnNldEJvbmVMaW1pdC5cbiAgICAgICAgbGV0IG51bVVuaWZvcm1zID0gdGhpcy52ZXJ0ZXhVbmlmb3Jtc0NvdW50O1xuICAgICAgICBudW1Vbmlmb3JtcyAtPSA0ICogNDsgLy8gTW9kZWwsIHZpZXcsIHByb2plY3Rpb24gYW5kIHNoYWRvdyBtYXRyaWNlc1xuICAgICAgICBudW1Vbmlmb3JtcyAtPSA4OyAgICAgLy8gOCBsaWdodHMgbWF4LCBlYWNoIHNwZWNpZnlpbmcgYSBwb3NpdGlvbiB2ZWN0b3JcbiAgICAgICAgbnVtVW5pZm9ybXMgLT0gMTsgICAgIC8vIEV5ZSBwb3NpdGlvblxuICAgICAgICBudW1Vbmlmb3JtcyAtPSA0ICogNDsgLy8gVXAgdG8gNCB0ZXh0dXJlIHRyYW5zZm9ybXNcbiAgICAgICAgdGhpcy5ib25lTGltaXQgPSBNYXRoLmZsb29yKG51bVVuaWZvcm1zIC8gMyk7ICAgLy8gZWFjaCBib25lIHVzZXMgMyB1bmlmb3Jtc1xuXG4gICAgICAgIC8vIFB1dCBhIGxpbWl0IG9uIHRoZSBudW1iZXIgb2Ygc3VwcG9ydGVkIGJvbmVzIGJlZm9yZSBza2luIHBhcnRpdGlvbmluZyBtdXN0IGJlIHBlcmZvcm1lZFxuICAgICAgICAvLyBTb21lIEdQVXMgaGF2ZSBkZW1vbnN0cmF0ZWQgcGVyZm9ybWFuY2UgaXNzdWVzIGlmIHRoZSBudW1iZXIgb2YgdmVjdG9ycyBhbGxvY2F0ZWQgdG8gdGhlXG4gICAgICAgIC8vIHNraW4gbWF0cml4IHBhbGV0dGUgaXMgbGVmdCB1bmJvdW5kZWRcbiAgICAgICAgdGhpcy5ib25lTGltaXQgPSBNYXRoLm1pbih0aGlzLmJvbmVMaW1pdCwgMTI4KTtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tlZFJlbmRlcmVyID09PSAnTWFsaS00NTAgTVAnKSB7XG4gICAgICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IDM0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jb25zdGFudFRleFNvdXJjZSA9IHRoaXMuc2NvcGUucmVzb2x2ZShcInNvdXJjZVwiKTtcblxuICAgICAgICBpZiAodGhpcy5leHRUZXh0dXJlRmxvYXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIC8vIEluIFdlYkdMMiBmbG9hdCB0ZXh0dXJlIHJlbmRlcmFiaWxpdHkgaXMgZGljdGF0ZWQgYnkgdGhlIEVYVF9jb2xvcl9idWZmZXJfZmxvYXQgZXh0ZW5zaW9uXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlID0gISF0aGlzLmV4dENvbG9yQnVmZmVyRmxvYXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEluIFdlYkdMMSB3ZSBzaG91bGQganVzdCB0cnkgcmVuZGVyaW5nIGludG8gYSBmbG9hdCB0ZXh0dXJlXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlID0gdGVzdFJlbmRlcmFibGUoZ2wsIGdsLkZMT0FUKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdHdvIGV4dGVuc2lvbnMgYWxsb3cgdXMgdG8gcmVuZGVyIHRvIGhhbGYgZmxvYXQgYnVmZmVyc1xuICAgICAgICBpZiAodGhpcy5leHRDb2xvckJ1ZmZlckhhbGZGbG9hdCkge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9ICEhdGhpcy5leHRDb2xvckJ1ZmZlckhhbGZGbG9hdDtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIC8vIEVYVF9jb2xvcl9idWZmZXJfZmxvYXQgc2hvdWxkIGFmZmVjdCBib3RoIGZsb2F0IGFuZCBoYWxmZmxvYXQgZm9ybWF0c1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUgPSAhIXRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTWFudWFsIHJlbmRlciBjaGVjayBmb3IgaGFsZiBmbG9hdFxuICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUgPSB0ZXN0UmVuZGVyYWJsZShnbCwgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0LkhBTEZfRkxPQVRfT0VTKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3VwcG9ydHNNb3JwaFRhcmdldFRleHR1cmVzQ29yZSA9ICh0aGlzLm1heFByZWNpc2lvbiA9PT0gXCJoaWdocFwiICYmIHRoaXMubWF4VmVydGV4VGV4dHVyZXMgPj0gMik7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNEZXB0aFNoYWRvdyA9IHRoaXMud2ViZ2wyO1xuXG4gICAgICAgIHRoaXMuX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24gPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgLy8gYXJlYSBsaWdodCBMVVQgZm9ybWF0IC0gb3JkZXIgb2YgcHJlZmVyZW5jZTogaGFsZiwgZmxvYXQsIDhiaXRcbiAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBODtcbiAgICAgICAgaWYgKHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCAmJiB0aGlzLnRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUgJiYgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyKSB7XG4gICAgICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkExNkY7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5leHRUZXh0dXJlRmxvYXQgJiYgdGhpcy5leHRUZXh0dXJlRmxvYXRMaW5lYXIpIHtcbiAgICAgICAgICAgIHRoaXMuYXJlYUxpZ2h0THV0Rm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTMyRjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucG9zdEluaXQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95IHRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgc3VwZXIuZGVzdHJveSgpO1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyICYmIHRoaXMuZmVlZGJhY2spIHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVRyYW5zZm9ybUZlZWRiYWNrKHRoaXMuZmVlZGJhY2spO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jbGVhclZlcnRleEFycmF5T2JqZWN0Q2FjaGUoKTtcblxuICAgICAgICB0aGlzLmNhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCd3ZWJnbGNvbnRleHRsb3N0JywgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIHRoaXMuY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmdsY29udGV4dHJlc3RvcmVkJywgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciwgZmFsc2UpO1xuXG4gICAgICAgIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciA9IG51bGw7XG4gICAgICAgIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuZ2wgPSBudWxsO1xuXG4gICAgICAgIHN1cGVyLnBvc3REZXN0cm95KCk7XG4gICAgfVxuXG4gICAgLy8gcHJvdmlkZSB3ZWJnbCBpbXBsZW1lbnRhdGlvbiBmb3IgdGhlIHZlcnRleCBidWZmZXJcbiAgICBjcmVhdGVWZXJ0ZXhCdWZmZXJJbXBsKHZlcnRleEJ1ZmZlciwgZm9ybWF0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xWZXJ0ZXhCdWZmZXIoKTtcbiAgICB9XG5cbiAgICAvLyBwcm92aWRlIHdlYmdsIGltcGxlbWVudGF0aW9uIGZvciB0aGUgaW5kZXggYnVmZmVyXG4gICAgY3JlYXRlSW5kZXhCdWZmZXJJbXBsKGluZGV4QnVmZmVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xJbmRleEJ1ZmZlcihpbmRleEJ1ZmZlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlU2hhZGVySW1wbChzaGFkZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbFNoYWRlcihzaGFkZXIpO1xuICAgIH1cblxuICAgIGNyZWF0ZVRleHR1cmVJbXBsKHRleHR1cmUpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbFRleHR1cmUoKTtcbiAgICB9XG5cbiAgICBjcmVhdGVSZW5kZXJUYXJnZXRJbXBsKHJlbmRlclRhcmdldCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsUmVuZGVyVGFyZ2V0KCk7XG4gICAgfVxuXG4gICAgLy8gI2lmIF9ERUJVR1xuICAgIHB1c2hNYXJrZXIobmFtZSkge1xuICAgICAgICBpZiAod2luZG93LnNwZWN0b3IpIHtcbiAgICAgICAgICAgIGNvbnN0IGxhYmVsID0gRGVidWdHcmFwaGljcy50b1N0cmluZygpO1xuICAgICAgICAgICAgd2luZG93LnNwZWN0b3Iuc2V0TWFya2VyKGAke2xhYmVsfSAjYCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwb3BNYXJrZXIoKSB7XG4gICAgICAgIGlmICh3aW5kb3cuc3BlY3Rvcikge1xuICAgICAgICAgICAgY29uc3QgbGFiZWwgPSBEZWJ1Z0dyYXBoaWNzLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICBpZiAobGFiZWwubGVuZ3RoKVxuICAgICAgICAgICAgICAgIHdpbmRvdy5zcGVjdG9yLnNldE1hcmtlcihgJHtsYWJlbH0gI2ApO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHdpbmRvdy5zcGVjdG9yLmNsZWFyTWFya2VyKCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gI2VuZGlmXG5cbiAgICAvKipcbiAgICAgKiBRdWVyeSB0aGUgcHJlY2lzaW9uIHN1cHBvcnRlZCBieSBpbnRzIGFuZCBmbG9hdHMgaW4gdmVydGV4IGFuZCBmcmFnbWVudCBzaGFkZXJzLiBOb3RlIHRoYXRcbiAgICAgKiBnZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQgaXMgbm90IGd1YXJhbnRlZWQgdG8gYmUgcHJlc2VudCAoc3VjaCBhcyBzb21lIGluc3RhbmNlcyBvZiB0aGVcbiAgICAgKiBkZWZhdWx0IEFuZHJvaWQgYnJvd3NlcikuIEluIHRoaXMgY2FzZSwgYXNzdW1lIGhpZ2hwIGlzIGF2YWlsYWJsZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFwiaGlnaHBcIiwgXCJtZWRpdW1wXCIgb3IgXCJsb3dwXCJcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0UHJlY2lzaW9uKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCBwcmVjaXNpb24gPSBcImhpZ2hwXCI7XG5cbiAgICAgICAgaWYgKGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdCkge1xuICAgICAgICAgICAgY29uc3QgdmVydGV4U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5WRVJURVhfU0hBREVSLCBnbC5ISUdIX0ZMT0FUKTtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5WRVJURVhfU0hBREVSLCBnbC5NRURJVU1fRkxPQVQpO1xuXG4gICAgICAgICAgICBjb25zdCBmcmFnbWVudFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuRlJBR01FTlRfU0hBREVSLCBnbC5ISUdIX0ZMT0FUKTtcbiAgICAgICAgICAgIGNvbnN0IGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLkZSQUdNRU5UX1NIQURFUiwgZ2wuTUVESVVNX0ZMT0FUKTtcblxuICAgICAgICAgICAgY29uc3QgaGlnaHBBdmFpbGFibGUgPSB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0LnByZWNpc2lvbiA+IDAgJiYgZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0LnByZWNpc2lvbiA+IDA7XG4gICAgICAgICAgICBjb25zdCBtZWRpdW1wQXZhaWxhYmxlID0gdmVydGV4U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0LnByZWNpc2lvbiA+IDAgJiYgZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQucHJlY2lzaW9uID4gMDtcblxuICAgICAgICAgICAgaWYgKCFoaWdocEF2YWlsYWJsZSkge1xuICAgICAgICAgICAgICAgIGlmIChtZWRpdW1wQXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHByZWNpc2lvbiA9IFwibWVkaXVtcFwiO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKFwiV0FSTklORzogaGlnaHAgbm90IHN1cHBvcnRlZCwgdXNpbmcgbWVkaXVtcFwiKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSBcImxvd3BcIjtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2FybihcIldBUk5JTkc6IGhpZ2hwIGFuZCBtZWRpdW1wIG5vdCBzdXBwb3J0ZWQsIHVzaW5nIGxvd3BcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByZWNpc2lvbjtcbiAgICB9XG5cbiAgICBnZXRFeHRlbnNpb24oKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zdXBwb3J0ZWRFeHRlbnNpb25zLmluZGV4T2YoYXJndW1lbnRzW2ldKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5nbC5nZXRFeHRlbnNpb24oYXJndW1lbnRzW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBnZXQgZXh0RGlzam9pbnRUaW1lclF1ZXJ5KCkge1xuICAgICAgICAvLyBsYXp5IGV2YWx1YXRpb24gYXMgdGhpcyBpcyBub3QgdHlwaWNhbGx5IHVzZWRcbiAgICAgICAgaWYgKCF0aGlzLl9leHREaXNqb2ludFRpbWVyUXVlcnkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIC8vIE5vdGUgdGhhdCBGaXJlZm94IGV4cG9zZXMgRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5IHVuZGVyIFdlYkdMMiByYXRoZXIgdGhhbiBFWFRfZGlzam9pbnRfdGltZXJfcXVlcnlfd2ViZ2wyXG4gICAgICAgICAgICAgICAgdGhpcy5fZXh0RGlzam9pbnRUaW1lclF1ZXJ5ID0gdGhpcy5nZXRFeHRlbnNpb24oJ0VYVF9kaXNqb2ludF90aW1lcl9xdWVyeV93ZWJnbDInLCAnRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2V4dERpc2pvaW50VGltZXJRdWVyeTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHRoZSBleHRlbnNpb25zIHByb3ZpZGVkIGJ5IHRoZSBXZWJHTCBjb250ZXh0LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGluaXRpYWxpemVFeHRlbnNpb25zKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGNvbnN0IHN1cHBvcnRlZEV4dGVuc2lvbnMgPSBnbC5nZXRTdXBwb3J0ZWRFeHRlbnNpb25zKCk7XG4gICAgICAgIHRoaXMuc3VwcG9ydGVkRXh0ZW5zaW9ucyA9IHN1cHBvcnRlZEV4dGVuc2lvbnM7XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRJbnN0YW5jaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlTG9kID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRWZXJ0ZXhBcnJheU9iamVjdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dENvbG9yQnVmZmVyRmxvYXQgPSB0aGlzLmdldEV4dGVuc2lvbignRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCcpO1xuICAgICAgICAgICAgdGhpcy5leHREZXB0aFRleHR1cmUgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5leHRCbGVuZE1pbm1heCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiRVhUX2JsZW5kX21pbm1heFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSB0aGlzLmdldEV4dGVuc2lvbignRVhUX2RyYXdfYnVmZmVycycpO1xuICAgICAgICAgICAgdGhpcy5leHRJbnN0YW5jaW5nID0gdGhpcy5nZXRFeHRlbnNpb24oXCJBTkdMRV9pbnN0YW5jZWRfYXJyYXlzXCIpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0SW5zdGFuY2luZykge1xuICAgICAgICAgICAgICAgIC8vIEluc3RhbGwgdGhlIFdlYkdMIDIgSW5zdGFuY2luZyBBUEkgZm9yIFdlYkdMIDEuMFxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0SW5zdGFuY2luZztcbiAgICAgICAgICAgICAgICBnbC5kcmF3QXJyYXlzSW5zdGFuY2VkID0gZXh0LmRyYXdBcnJheXNJbnN0YW5jZWRBTkdMRS5iaW5kKGV4dCk7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0VsZW1lbnRzSW5zdGFuY2VkID0gZXh0LmRyYXdFbGVtZW50c0luc3RhbmNlZEFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJEaXZpc29yID0gZXh0LnZlcnRleEF0dHJpYkRpdmlzb3JBTkdMRS5iaW5kKGV4dCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX3N0YW5kYXJkX2Rlcml2YXRpdmVzXCIpO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXQgPSB0aGlzLmdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2Zsb2F0XCIpO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0ID0gdGhpcy5nZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9oYWxmX2Zsb2F0XCIpO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlTG9kID0gdGhpcy5nZXRFeHRlbnNpb24oJ0VYVF9zaGFkZXJfdGV4dHVyZV9sb2QnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSB0aGlzLmdldEV4dGVuc2lvbihcIk9FU19lbGVtZW50X2luZGV4X3VpbnRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFZlcnRleEFycmF5T2JqZWN0ID0gdGhpcy5nZXRFeHRlbnNpb24oXCJPRVNfdmVydGV4X2FycmF5X29iamVjdFwiKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4dFZlcnRleEFycmF5T2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zdGFsbCB0aGUgV2ViR0wgMiBWQU8gQVBJIGZvciBXZWJHTCAxLjBcbiAgICAgICAgICAgICAgICBjb25zdCBleHQgPSB0aGlzLmV4dFZlcnRleEFycmF5T2JqZWN0O1xuICAgICAgICAgICAgICAgIGdsLmNyZWF0ZVZlcnRleEFycmF5ID0gZXh0LmNyZWF0ZVZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5kZWxldGVWZXJ0ZXhBcnJheSA9IGV4dC5kZWxldGVWZXJ0ZXhBcnJheU9FUy5iaW5kKGV4dCk7XG4gICAgICAgICAgICAgICAgZ2wuaXNWZXJ0ZXhBcnJheSA9IGV4dC5pc1ZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkgPSBleHQuYmluZFZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmV4dERlcHRoVGV4dHVyZSA9IGdsLmdldEV4dGVuc2lvbignV0VCR0xfZGVwdGhfdGV4dHVyZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5leHREZWJ1Z1JlbmRlcmVySW5mbyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZWJ1Z19yZW5kZXJlcl9pbmZvJyk7XG4gICAgICAgIHRoaXMuZXh0VGV4dHVyZUZsb2F0TGluZWFyID0gdGhpcy5nZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9mbG9hdF9saW5lYXJcIik7XG4gICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdExpbmVhciA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfaGFsZl9mbG9hdF9saW5lYXJcIik7XG4gICAgICAgIHRoaXMuZXh0RmxvYXRCbGVuZCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiRVhUX2Zsb2F0X2JsZW5kXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdFWFRfdGV4dHVyZV9maWx0ZXJfYW5pc290cm9waWMnLCAnV0VCS0lUX0VYVF90ZXh0dXJlX2ZpbHRlcl9hbmlzb3Ryb3BpYycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDMSA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfZXRjMScpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlRVRDID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9wdnJ0YycsICdXRUJLSVRfV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3B2cnRjJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9zM3RjJywgJ1dFQktJVF9XRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfczN0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlQVRDID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hdGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUFTVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX2FzdGMnKTtcbiAgICAgICAgdGhpcy5leHRQYXJhbGxlbFNoYWRlckNvbXBpbGUgPSB0aGlzLmdldEV4dGVuc2lvbignS0hSX3BhcmFsbGVsX3NoYWRlcl9jb21waWxlJyk7XG5cbiAgICAgICAgLy8gaU9TIGV4cG9zZXMgdGhpcyBmb3IgaGFsZiBwcmVjaXNpb24gcmVuZGVyIHRhcmdldHMgb24gYm90aCBXZWJnbDEgYW5kIDIgZnJvbSBpT1MgdiAxNC41YmV0YVxuICAgICAgICB0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0ID0gdGhpcy5nZXRFeHRlbnNpb24oXCJFWFRfY29sb3JfYnVmZmVyX2hhbGZfZmxvYXRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIGNhcGFiaWxpdGllcyBvZiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplQ2FwYWJpbGl0aWVzKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCBleHQ7XG5cbiAgICAgICAgY29uc3QgdXNlckFnZW50ID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgPyBuYXZpZ2F0b3IudXNlckFnZW50IDogXCJcIjtcblxuICAgICAgICB0aGlzLm1heFByZWNpc2lvbiA9IHRoaXMucHJlY2lzaW9uID0gdGhpcy5nZXRQcmVjaXNpb24oKTtcblxuICAgICAgICBjb25zdCBjb250ZXh0QXR0cmlicyA9IGdsLmdldENvbnRleHRBdHRyaWJ1dGVzKCk7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNc2FhID0gY29udGV4dEF0dHJpYnMuYW50aWFsaWFzO1xuICAgICAgICB0aGlzLnN1cHBvcnRzU3RlbmNpbCA9IGNvbnRleHRBdHRyaWJzLnN0ZW5jaWw7XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0luc3RhbmNpbmcgPSAhIXRoaXMuZXh0SW5zdGFuY2luZztcblxuICAgICAgICAvLyBRdWVyeSBwYXJhbWV0ZXIgdmFsdWVzIGZyb20gdGhlIFdlYkdMIGNvbnRleHRcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhDdWJlTWFwU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhSZW5kZXJCdWZmZXJTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9SRU5ERVJCVUZGRVJfU0laRSk7XG4gICAgICAgIHRoaXMubWF4VGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heENvbWJpbmVkVGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heFZlcnRleFRleHR1cmVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9WRVJURVhfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMudmVydGV4VW5pZm9ybXNDb3VudCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRVbmlmb3Jtc0NvdW50ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMpO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMubWF4RHJhd0J1ZmZlcnMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0RSQVdfQlVGRkVSUyk7XG4gICAgICAgICAgICB0aGlzLm1heENvbG9yQXR0YWNobWVudHMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTE9SX0FUVEFDSE1FTlRTKTtcbiAgICAgICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfM0RfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dCA9IHRoaXMuZXh0RHJhd0J1ZmZlcnM7XG4gICAgICAgICAgICB0aGlzLm1heERyYXdCdWZmZXJzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfRFJBV19CVUZGRVJTX0VYVCkgOiAxO1xuICAgICAgICAgICAgdGhpcy5tYXhDb2xvckF0dGFjaG1lbnRzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfQ09MT1JfQVRUQUNITUVOVFNfRVhUKSA6IDE7XG4gICAgICAgICAgICB0aGlzLm1heFZvbHVtZVNpemUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHREZWJ1Z1JlbmRlcmVySW5mbztcbiAgICAgICAgdGhpcy51bm1hc2tlZFJlbmRlcmVyID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5VTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCkgOiAnJztcbiAgICAgICAgdGhpcy51bm1hc2tlZFZlbmRvciA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuVU5NQVNLRURfVkVORE9SX1dFQkdMKSA6ICcnO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIHdlIHN1cHBvcnQgR1BVIHBhcnRpY2xlcy4gQXQgdGhlIG1vbWVudCwgU2Ftc3VuZyBkZXZpY2VzIHdpdGggRXh5bm9zIChBUk0pIGVpdGhlciBjcmFzaCBvciByZW5kZXJcbiAgICAgICAgLy8gaW5jb3JyZWN0bHkgd2hlbiB1c2luZyBHUFUgZm9yIHBhcnRpY2xlcy4gU2VlOlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGxheWNhbnZhcy9lbmdpbmUvaXNzdWVzLzM5NjdcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BsYXljYW52YXMvZW5naW5lL2lzc3Vlcy8zNDE1XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wbGF5Y2FudmFzL2VuZ2luZS9pc3N1ZXMvNDUxNFxuICAgICAgICAvLyBFeGFtcGxlIFVBIG1hdGNoZXM6IFN0YXJ0aW5nICdTTScgYW5kIGFueSBjb21iaW5hdGlvbiBvZiBsZXR0ZXJzIG9yIG51bWJlcnM6XG4gICAgICAgIC8vIE1vemlsbGEvNS4wIChMaW51eCwgQW5kcm9pZCAxMjsgU00tRzk3MEYgQnVpbGQvU1AxQS4yMTA4MTIuMDE2OyB3dilcbiAgICAgICAgLy8gTW96aWxsYS81LjAgKExpbnV4LCBBbmRyb2lkIDEyOyBTTS1HOTcwRilcbiAgICAgICAgY29uc3Qgc2Ftc3VuZ01vZGVsUmVnZXggPSAvU00tW2EtekEtWjAtOV0rLztcbiAgICAgICAgdGhpcy5zdXBwb3J0c0dwdVBhcnRpY2xlcyA9ICEodGhpcy51bm1hc2tlZFZlbmRvciA9PT0gJ0FSTScgJiYgdXNlckFnZW50Lm1hdGNoKHNhbXN1bmdNb2RlbFJlZ2V4KSk7XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWM7XG4gICAgICAgIHRoaXMubWF4QW5pc290cm9weSA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuTUFYX1RFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUKSA6IDE7XG5cbiAgICAgICAgdGhpcy5zYW1wbGVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLlNBTVBMRVMpO1xuICAgICAgICB0aGlzLm1heFNhbXBsZXMgPSB0aGlzLndlYmdsMiAmJiAhdGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nID8gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9TQU1QTEVTKSA6IDE7XG5cbiAgICAgICAgLy8gRG9uJ3QgYWxsb3cgYXJlYSBsaWdodHMgb24gb2xkIGFuZHJvaWQgZGV2aWNlcywgdGhleSBvZnRlbiBmYWlsIHRvIGNvbXBpbGUgdGhlIHNoYWRlciwgcnVuIGl0IGluY29ycmVjdGx5IG9yIGFyZSB2ZXJ5IHNsb3cuXG4gICAgICAgIHRoaXMuc3VwcG9ydHNBcmVhTGlnaHRzID0gdGhpcy53ZWJnbDIgfHwgIXBsYXRmb3JtLmFuZHJvaWQ7XG5cbiAgICAgICAgLy8gc3VwcG9ydHMgdGV4dHVyZSBmZXRjaCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnN1cHBvcnRzVGV4dHVyZUZldGNoID0gdGhpcy53ZWJnbDI7XG5cbiAgICAgICAgLy8gQWxzbyBkbyBub3QgYWxsb3cgdGhlbSB3aGVuIHdlIG9ubHkgaGF2ZSBzbWFsbCBudW1iZXIgb2YgdGV4dHVyZSB1bml0c1xuICAgICAgICBpZiAodGhpcy5tYXhUZXh0dXJlcyA8PSA4KSB7XG4gICAgICAgICAgICB0aGlzLnN1cHBvcnRzQXJlYUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBpbml0aWFsIHJlbmRlciBzdGF0ZSBvbiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplUmVuZGVyU3RhdGUoKSB7XG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVSZW5kZXJTdGF0ZSgpO1xuXG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHJlbmRlciBzdGF0ZSB0byBhIGtub3duIHN0YXJ0IHN0YXRlXG5cbiAgICAgICAgLy8gZGVmYXVsdCBibGVuZCBzdGF0ZVxuICAgICAgICBnbC5kaXNhYmxlKGdsLkJMRU5EKTtcbiAgICAgICAgZ2wuYmxlbmRGdW5jKGdsLk9ORSwgZ2wuWkVSTyk7XG4gICAgICAgIGdsLmJsZW5kRXF1YXRpb24oZ2wuRlVOQ19BREQpO1xuICAgICAgICBnbC5jb2xvck1hc2sodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5ibGVuZENvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDApO1xuICAgICAgICBnbC5ibGVuZENvbG9yKDAsIDAsIDAsIDApO1xuXG4gICAgICAgIHRoaXMuY3VsbE1vZGUgPSBDVUxMRkFDRV9CQUNLO1xuICAgICAgICBnbC5lbmFibGUoZ2wuQ1VMTF9GQUNFKTtcbiAgICAgICAgZ2wuY3VsbEZhY2UoZ2wuQkFDSyk7XG5cbiAgICAgICAgLy8gZGVmYXVsdCBkZXB0aCBzdGF0ZVxuICAgICAgICBnbC5lbmFibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgICAgIGdsLmRlcHRoRnVuYyhnbC5MRVFVQUwpO1xuICAgICAgICBnbC5kZXB0aE1hc2sodHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5zdGVuY2lsID0gZmFsc2U7XG4gICAgICAgIGdsLmRpc2FibGUoZ2wuU1RFTkNJTF9URVNUKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgPSB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IEZVTkNfQUxXQVlTO1xuICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHRoaXMuc3RlbmNpbFJlZkJhY2sgPSAwO1xuICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgPSB0aGlzLnN0ZW5jaWxNYXNrQmFjayA9IDB4RkY7XG4gICAgICAgIGdsLnN0ZW5jaWxGdW5jKGdsLkFMV0FZUywgMCwgMHhGRik7XG5cbiAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEZyb250ID0gdGhpcy5zdGVuY2lsRmFpbEJhY2sgPSBTVEVOQ0lMT1BfS0VFUDtcbiAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxGcm9udCA9IHRoaXMuc3RlbmNpbFpmYWlsQmFjayA9IFNURU5DSUxPUF9LRUVQO1xuICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ID0gdGhpcy5zdGVuY2lsWnBhc3NCYWNrID0gU1RFTkNJTE9QX0tFRVA7XG4gICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ID0gMHhGRjtcbiAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayA9IDB4RkY7XG4gICAgICAgIGdsLnN0ZW5jaWxPcChnbC5LRUVQLCBnbC5LRUVQLCBnbC5LRUVQKTtcbiAgICAgICAgZ2wuc3RlbmNpbE1hc2soMHhGRik7XG5cbiAgICAgICAgdGhpcy5hbHBoYVRvQ292ZXJhZ2UgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5yYXN0ZXIgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuU0FNUExFX0FMUEhBX1RPX0NPVkVSQUdFKTtcbiAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuUkFTVEVSSVpFUl9ESVNDQVJEKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGVwdGhCaWFzRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICBnbC5kaXNhYmxlKGdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xuXG4gICAgICAgIHRoaXMuY2xlYXJEZXB0aCA9IDE7XG4gICAgICAgIGdsLmNsZWFyRGVwdGgoMSk7XG5cbiAgICAgICAgdGhpcy5jbGVhckNvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDApO1xuICAgICAgICBnbC5jbGVhckNvbG9yKDAsIDAsIDAsIDApO1xuXG4gICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsID0gMDtcbiAgICAgICAgZ2wuY2xlYXJTdGVuY2lsKDApO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgZ2wuaGludChnbC5GUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5ULCBnbC5OSUNFU1QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykge1xuICAgICAgICAgICAgICAgIGdsLmhpbnQodGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzLkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlRfT0VTLCBnbC5OSUNFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZ2wuZW5hYmxlKGdsLlNDSVNTT1JfVEVTVCk7XG5cbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTl9XRUJHTCwgZ2wuTk9ORSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZhbHNlO1xuICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gZmFsc2U7XG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgZmFsc2UpO1xuXG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19BTElHTk1FTlQsIDEpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCkge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuXG4gICAgICAgIC8vIGNhY2hlIG9mIFZBT3NcbiAgICAgICAgdGhpcy5fdmFvTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuICAgICAgICB0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5mZWVkYmFjayA9IG51bGw7XG4gICAgICAgIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudGV4dHVyZVVuaXQgPSAwO1xuICAgICAgICB0aGlzLnRleHR1cmVVbml0cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWF4Q29tYmluZWRUZXh0dXJlczsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0cy5wdXNoKFtudWxsLCBudWxsLCBudWxsXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgV2ViR0wgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIC8vIHJlbGVhc2Ugc2hhZGVyc1xuICAgICAgICBmb3IgKGNvbnN0IHNoYWRlciBvZiB0aGlzLnNoYWRlcnMpIHtcbiAgICAgICAgICAgIHNoYWRlci5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGNvbnN0IHRleHR1cmUgb2YgdGhpcy50ZXh0dXJlcykge1xuICAgICAgICAgICAgdGV4dHVyZS5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB2ZXJ0ZXggYW5kIGluZGV4IGJ1ZmZlcnNcbiAgICAgICAgZm9yIChjb25zdCBidWZmZXIgb2YgdGhpcy5idWZmZXJzKSB7XG4gICAgICAgICAgICBidWZmZXIubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc2V0IGFsbCByZW5kZXIgdGFyZ2V0cyBzbyB0aGV5J2xsIGJlIHJlY3JlYXRlZCBhcyByZXF1aXJlZC5cbiAgICAgICAgLy8gVE9ETzogYSBzb2x1dGlvbiBmb3IgdGhlIGNhc2Ugd2hlcmUgYSByZW5kZXIgdGFyZ2V0IGNvbnRhaW5zIHNvbWV0aGluZ1xuICAgICAgICAvLyB0aGF0IHdhcyBwcmV2aW91c2x5IGdlbmVyYXRlZCB0aGF0IG5lZWRzIHRvIGJlIHJlLXJlbmRlcmVkLlxuICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldHMpIHtcbiAgICAgICAgICAgIHRhcmdldC5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgaXMgcmVzdG9yZWQuIEl0IHJlaW5pdGlhbGl6ZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVzdG9yZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ2FwYWJpbGl0aWVzKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKTtcblxuICAgICAgICAvLyBSZWNvbXBpbGUgYWxsIHNoYWRlcnMgKHRoZXknbGwgYmUgbGlua2VkIHdoZW4gdGhleSdyZSBuZXh0IGFjdHVhbGx5IHVzZWQpXG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyIG9mIHRoaXMuc2hhZGVycykge1xuICAgICAgICAgICAgc2hhZGVyLnJlc3RvcmVDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNyZWF0ZSBidWZmZXIgb2JqZWN0cyBhbmQgcmV1cGxvYWQgYnVmZmVyIGRhdGEgdG8gdGhlIEdQVVxuICAgICAgICBmb3IgKGNvbnN0IGJ1ZmZlciBvZiB0aGlzLmJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIGJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBhZnRlciBhIGJhdGNoIG9mIHNoYWRlcnMgd2FzIGNyZWF0ZWQsIHRvIGd1aWRlIGluIHRoZWlyIG9wdGltYWwgcHJlcGFyYXRpb24gZm9yIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBlbmRTaGFkZXJCYXRjaCgpIHtcbiAgICAgICAgV2ViZ2xTaGFkZXIuZW5kU2hhZGVyQmF0Y2godGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBhY3RpdmUgcmVjdGFuZ2xlIGZvciByZW5kZXJpbmcgb24gdGhlIHNwZWNpZmllZCBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSBwaXhlbCBzcGFjZSB4LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgdmlld3BvcnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgcGl4ZWwgc3BhY2UgeS1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHZpZXdwb3J0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSB2aWV3cG9ydCBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSB2aWV3cG9ydCBpbiBwaXhlbHMuXG4gICAgICovXG4gICAgc2V0Vmlld3BvcnQoeCwgeSwgdywgaCkge1xuICAgICAgICBpZiAoKHRoaXMudnggIT09IHgpIHx8ICh0aGlzLnZ5ICE9PSB5KSB8fCAodGhpcy52dyAhPT0gdykgfHwgKHRoaXMudmggIT09IGgpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnZpZXdwb3J0KHgsIHksIHcsIGgpO1xuICAgICAgICAgICAgdGhpcy52eCA9IHg7XG4gICAgICAgICAgICB0aGlzLnZ5ID0geTtcbiAgICAgICAgICAgIHRoaXMudncgPSB3O1xuICAgICAgICAgICAgdGhpcy52aCA9IGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGFjdGl2ZSBzY2lzc29yIHJlY3RhbmdsZSBvbiB0aGUgc3BlY2lmaWVkIGRldmljZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHBpeGVsIHNwYWNlIHgtY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSBwaXhlbCBzcGFjZSB5LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgd2lkdGggb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBoZWlnaHQgb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlIGluIHBpeGVscy5cbiAgICAgKi9cbiAgICBzZXRTY2lzc29yKHgsIHksIHcsIGgpIHtcbiAgICAgICAgaWYgKCh0aGlzLnN4ICE9PSB4KSB8fCAodGhpcy5zeSAhPT0geSkgfHwgKHRoaXMuc3cgIT09IHcpIHx8ICh0aGlzLnNoICE9PSBoKSkge1xuICAgICAgICAgICAgdGhpcy5nbC5zY2lzc29yKHgsIHksIHcsIGgpO1xuICAgICAgICAgICAgdGhpcy5zeCA9IHg7XG4gICAgICAgICAgICB0aGlzLnN5ID0geTtcbiAgICAgICAgICAgIHRoaXMuc3cgPSB3O1xuICAgICAgICAgICAgdGhpcy5zaCA9IGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBCaW5kcyB0aGUgc3BlY2lmaWVkIGZyYW1lYnVmZmVyIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7V2ViR0xGcmFtZWJ1ZmZlciB8IG51bGx9IGZiIC0gVGhlIGZyYW1lYnVmZmVyIHRvIGJpbmQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEZyYW1lYnVmZmVyKGZiKSB7XG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyICE9PSBmYikge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBmYik7XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyID0gZmI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgc291cmNlIHJlbmRlciB0YXJnZXQgaW50byBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBNb3N0bHkgdXNlZCBieSBwb3N0LWVmZmVjdHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW3NvdXJjZV0gLSBUaGUgc291cmNlIHJlbmRlciB0YXJnZXQuIERlZmF1bHRzIHRvIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW2Rlc3RdIC0gVGhlIGRlc3RpbmF0aW9uIHJlbmRlciB0YXJnZXQuIERlZmF1bHRzIHRvIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjb2xvcl0gLSBJZiB0cnVlIHdpbGwgY29weSB0aGUgY29sb3IgYnVmZmVyLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aF0gLSBJZiB0cnVlIHdpbGwgY29weSB0aGUgZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgY29weSB3YXMgc3VjY2Vzc2Z1bCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGNvcHlSZW5kZXJUYXJnZXQoc291cmNlLCBkZXN0LCBjb2xvciwgZGVwdGgpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGlmICghdGhpcy53ZWJnbDIgJiYgZGVwdGgpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKFwiRGVwdGggaXMgbm90IGNvcHlhYmxlIG9uIFdlYkdMIDEuMFwiKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgICAgIGlmICghZGVzdCkge1xuICAgICAgICAgICAgICAgIC8vIGNvcHlpbmcgdG8gYmFja2J1ZmZlclxuICAgICAgICAgICAgICAgIGlmICghc291cmNlLl9jb2xvckJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgZW1wdHkgY29sb3IgYnVmZmVyIHRvIGJhY2tidWZmZXJcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZSkge1xuICAgICAgICAgICAgICAgIC8vIGNvcHlpbmcgdG8gcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgICAgIGlmICghc291cmNlLl9jb2xvckJ1ZmZlciB8fCAhZGVzdC5fY29sb3JCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IGNvbG9yIGJ1ZmZlciwgYmVjYXVzZSBvbmUgb2YgdGhlIHJlbmRlciB0YXJnZXRzIGRvZXNuJ3QgaGF2ZSBpdFwiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc291cmNlLl9jb2xvckJ1ZmZlci5fZm9ybWF0ICE9PSBkZXN0Ll9jb2xvckJ1ZmZlci5fZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSByZW5kZXIgdGFyZ2V0cyBvZiBkaWZmZXJlbnQgY29sb3IgZm9ybWF0c1wiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZGVwdGggJiYgc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoIXNvdXJjZS5fZGVwdGgpIHsgICAvLyB3aGVuIGRlcHRoIGlzIGF1dG9tYXRpYywgd2UgY2Fubm90IHRlc3QgdGhlIGJ1ZmZlciBub3IgaXRzIGZvcm1hdFxuICAgICAgICAgICAgICAgIGlmICghc291cmNlLl9kZXB0aEJ1ZmZlciB8fCAhZGVzdC5fZGVwdGhCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IGRlcHRoIGJ1ZmZlciwgYmVjYXVzZSBvbmUgb2YgdGhlIHJlbmRlciB0YXJnZXRzIGRvZXNuJ3QgaGF2ZSBpdFwiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc291cmNlLl9kZXB0aEJ1ZmZlci5fZm9ybWF0ICE9PSBkZXN0Ll9kZXB0aEJ1ZmZlci5fZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSByZW5kZXIgdGFyZ2V0cyBvZiBkaWZmZXJlbnQgZGVwdGggZm9ybWF0c1wiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCAnQ09QWS1SVCcpO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiBkZXN0KSB7XG4gICAgICAgICAgICBjb25zdCBwcmV2UnQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gZGVzdDtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlQmVnaW4oKTtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5SRUFEX0ZSQU1FQlVGRkVSLCBzb3VyY2UgPyBzb3VyY2UuaW1wbC5fZ2xGcmFtZUJ1ZmZlciA6IG51bGwpO1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIGRlc3QuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG4gICAgICAgICAgICBjb25zdCB3ID0gc291cmNlID8gc291cmNlLndpZHRoIDogZGVzdC53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IGggPSBzb3VyY2UgPyBzb3VyY2UuaGVpZ2h0IDogZGVzdC5oZWlnaHQ7XG4gICAgICAgICAgICBnbC5ibGl0RnJhbWVidWZmZXIoMCwgMCwgdywgaCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAwLCB3LCBoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjb2xvciA/IGdsLkNPTE9SX0JVRkZFUl9CSVQgOiAwKSB8IChkZXB0aCA/IGdsLkRFUFRIX0JVRkZFUl9CSVQgOiAwKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5ORUFSRVNUKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gcHJldlJ0O1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBwcmV2UnQgPyBwcmV2UnQuaW1wbC5fZ2xGcmFtZUJ1ZmZlciA6IG51bGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc2hhZGVyID0gdGhpcy5nZXRDb3B5U2hhZGVyKCk7XG4gICAgICAgICAgICB0aGlzLmNvbnN0YW50VGV4U291cmNlLnNldFZhbHVlKHNvdXJjZS5fY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgcXVhZFdpdGhTaGFkZXIodGhpcywgZGVzdCwgc2hhZGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBjb3B5IHNoYWRlciBmb3IgZWZmaWNpZW50IHJlbmRlcmluZyBvZiBmdWxsc2NyZWVuLXF1YWQgd2l0aCB0ZXh0dXJlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1NoYWRlcn0gVGhlIGNvcHkgc2hhZGVyIChiYXNlZCBvbiBgZnVsbHNjcmVlblF1YWRWU2AgYW5kIGBvdXRwdXRUZXgyRFBTYCBpblxuICAgICAqIGBzaGFkZXJDaHVua3NgKS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0Q29weVNoYWRlcigpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb3B5U2hhZGVyKSB7XG4gICAgICAgICAgICB0aGlzLl9jb3B5U2hhZGVyID0gbmV3IFNoYWRlcih0aGlzLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKHRoaXMsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3V0cHV0VGV4MkQnLFxuICAgICAgICAgICAgICAgIHZlcnRleENvZGU6IF9mdWxsU2NyZWVuUXVhZFZTLFxuICAgICAgICAgICAgICAgIGZyYWdtZW50Q29kZTogX291dHB1dFRleHR1cmUyRFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jb3B5U2hhZGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIHN0YXJ0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGFydFBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgU1RBUlQtUEFTU2ApO1xuXG4gICAgICAgIC8vIHNldCB1cCByZW5kZXIgdGFyZ2V0XG4gICAgICAgIHRoaXMuc2V0UmVuZGVyVGFyZ2V0KHJlbmRlclBhc3MucmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgdGhpcy51cGRhdGVCZWdpbigpO1xuXG4gICAgICAgIC8vIGNsZWFyIHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IGNvbG9yT3BzID0gcmVuZGVyUGFzcy5jb2xvck9wcztcbiAgICAgICAgY29uc3QgZGVwdGhTdGVuY2lsT3BzID0gcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHM7XG4gICAgICAgIGlmIChjb2xvck9wcy5jbGVhciB8fCBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aCB8fCBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsKSB7XG5cbiAgICAgICAgICAgIC8vIHRoZSBwYXNzIGFsd2F5cyBjbGVhcnMgZnVsbCB0YXJnZXRcbiAgICAgICAgICAgIGNvbnN0IHJ0ID0gcmVuZGVyUGFzcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICBjb25zdCB3aWR0aCA9IHJ0ID8gcnQud2lkdGggOiB0aGlzLndpZHRoO1xuICAgICAgICAgICAgY29uc3QgaGVpZ2h0ID0gcnQgPyBydC5oZWlnaHQgOiB0aGlzLmhlaWdodDtcbiAgICAgICAgICAgIHRoaXMuc2V0Vmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgICAgICB0aGlzLnNldFNjaXNzb3IoMCwgMCwgd2lkdGgsIGhlaWdodCk7XG5cbiAgICAgICAgICAgIGxldCBjbGVhckZsYWdzID0gMDtcbiAgICAgICAgICAgIGNvbnN0IGNsZWFyT3B0aW9ucyA9IHt9O1xuXG4gICAgICAgICAgICBpZiAoY29sb3JPcHMuY2xlYXIpIHtcbiAgICAgICAgICAgICAgICBjbGVhckZsYWdzIHw9IENMRUFSRkxBR19DT0xPUjtcbiAgICAgICAgICAgICAgICBjbGVhck9wdGlvbnMuY29sb3IgPSBbY29sb3JPcHMuY2xlYXJWYWx1ZS5yLCBjb2xvck9wcy5jbGVhclZhbHVlLmcsIGNvbG9yT3BzLmNsZWFyVmFsdWUuYiwgY29sb3JPcHMuY2xlYXJWYWx1ZS5hXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJGbGFncyB8PSBDTEVBUkZMQUdfREVQVEg7XG4gICAgICAgICAgICAgICAgY2xlYXJPcHRpb25zLmRlcHRoID0gZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGhWYWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICBjbGVhckZsYWdzIHw9IENMRUFSRkxBR19TVEVOQ0lMO1xuICAgICAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5zdGVuY2lsID0gZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbFZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjbGVhciBpdFxuICAgICAgICAgICAgY2xlYXJPcHRpb25zLmZsYWdzID0gY2xlYXJGbGFncztcbiAgICAgICAgICAgIHRoaXMuY2xlYXIoY2xlYXJPcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHRoaXMuaW5zaWRlUmVuZGVyUGFzcykge1xuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yT25jZSgnUmVuZGVyUGFzcyBjYW5ub3QgYmUgc3RhcnRlZCB3aGlsZSBpbnNpZGUgYW5vdGhlciByZW5kZXIgcGFzcy4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IHRydWU7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5kIGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIGVuZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZW5kUGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBFTkQtUEFTU2ApO1xuXG4gICAgICAgIHRoaXMudW5iaW5kVmVydGV4QXJyYXkoKTtcblxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKHRhcmdldCkge1xuXG4gICAgICAgICAgICAvLyBpbnZhbGlkYXRlIGJ1ZmZlcnMgdG8gc3RvcCB0aGVtIGJlaW5nIHdyaXR0ZW4gdG8gb24gdGlsZWQgYXJjaGl0ZXh0dXJlc1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSBjb2xvciBvbmx5IGlmIHdlIGRvbid0IG5lZWQgdG8gcmVzb2x2ZSBpdFxuICAgICAgICAgICAgICAgIGlmICghKHJlbmRlclBhc3MuY29sb3JPcHMuc3RvcmUgfHwgcmVuZGVyUGFzcy5jb2xvck9wcy5yZXNvbHZlKSkge1xuICAgICAgICAgICAgICAgICAgICBpbnZhbGlkYXRlQXR0YWNobWVudHMucHVzaChnbC5DT0xPUl9BVFRBQ0hNRU5UMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVEZXB0aCkge1xuICAgICAgICAgICAgICAgICAgICBpbnZhbGlkYXRlQXR0YWNobWVudHMucHVzaChnbC5ERVBUSF9BVFRBQ0hNRU5UKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFyZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcy5zdG9yZVN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuU1RFTkNJTF9BVFRBQ0hNRU5UKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoaW52YWxpZGF0ZUF0dGFjaG1lbnRzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBpbnZhbGlkYXRlIHRoZSB3aG9sZSBidWZmZXJcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogd2UgY291bGQgaGFuZGxlIHZpZXdwb3J0IGludmFsaWRhdGlvbiBhcyB3ZWxsXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZW5kZXJQYXNzLmZ1bGxTaXplQ2xlYXJSZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5pbnZhbGlkYXRlRnJhbWVidWZmZXIoZ2wuRFJBV19GUkFNRUJVRkZFUiwgaW52YWxpZGF0ZUF0dGFjaG1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVzb2x2ZSB0aGUgY29sb3IgYnVmZmVyXG4gICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5jb2xvck9wcy5yZXNvbHZlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyICYmIHJlbmRlclBhc3Muc2FtcGxlcyA+IDEgJiYgdGFyZ2V0LmF1dG9SZXNvbHZlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldC5yZXNvbHZlKHRydWUsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdlbmVyYXRlIG1pcG1hcHNcbiAgICAgICAgICAgIGlmIChyZW5kZXJQYXNzLmNvbG9yT3BzLm1pcG1hcHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xvckJ1ZmZlciA9IHRhcmdldC5fY29sb3JCdWZmZXI7XG4gICAgICAgICAgICAgICAgaWYgKGNvbG9yQnVmZmVyICYmIGNvbG9yQnVmZmVyLmltcGwuX2dsVGV4dHVyZSAmJiBjb2xvckJ1ZmZlci5taXBtYXBzICYmIChjb2xvckJ1ZmZlci5wb3QgfHwgdGhpcy53ZWJnbDIpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWN0aXZlVGV4dHVyZSh0aGlzLm1heENvbWJpbmVkVGV4dHVyZXMgLSAxKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZShjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuZ2VuZXJhdGVNaXBtYXAoY29sb3JCdWZmZXIuaW1wbC5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaW5zaWRlUmVuZGVyUGFzcyA9IGZhbHNlO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBiZWdpbm5pbmcgb2YgYSBibG9jayBvZiByZW5kZXJpbmcuIEludGVybmFsbHksIHRoaXMgZnVuY3Rpb24gYmluZHMgdGhlIHJlbmRlclxuICAgICAqIHRhcmdldCBjdXJyZW50bHkgc2V0IG9uIHRoZSBkZXZpY2UuIFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIG1hdGNoZWQgd2l0aCBhIGNhbGwgdG9cbiAgICAgKiB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlRW5kfS4gQ2FsbHMgdG8ge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUJlZ2lufSBhbmRcbiAgICAgKiB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlRW5kfSBtdXN0IG5vdCBiZSBuZXN0ZWQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlQmVnaW4oKSB7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCAnVVBEQVRFLUJFR0lOJyk7XG5cbiAgICAgICAgdGhpcy5ib3VuZFZhbyA9IG51bGw7XG5cbiAgICAgICAgLy8gY2xlYXIgdGV4dHVyZSB1bml0cyBvbmNlIGEgZnJhbWUgb24gZGVza3RvcCBzYWZhcmlcbiAgICAgICAgaWYgKHRoaXMuX3RlbXBFbmFibGVTYWZhcmlUZXh0dXJlVW5pdFdvcmthcm91bmQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IHVuaXQgPSAwOyB1bml0IDwgdGhpcy50ZXh0dXJlVW5pdHMubGVuZ3RoOyArK3VuaXQpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBzbG90ID0gMDsgc2xvdCA8IDM7ICsrc2xvdCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t1bml0XVtzbG90XSA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2V0IHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBuZXcgV2ViR0wgZnJhbWUgYnVmZmVyIG9iamVjdFxuICAgICAgICAgICAgaWYgKCF0YXJnZXQuaW1wbC5pbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5pdFJlbmRlclRhcmdldCh0YXJnZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldEZyYW1lYnVmZmVyKHRhcmdldC5pbXBsLl9nbEZyYW1lQnVmZmVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2V0RnJhbWVidWZmZXIodGhpcy5kZWZhdWx0RnJhbWVidWZmZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFya3MgdGhlIGVuZCBvZiBhIGJsb2NrIG9mIHJlbmRlcmluZy4gVGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgY2FsbGVkIGFmdGVyIGEgbWF0Y2hpbmcgY2FsbFxuICAgICAqIHRvIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVCZWdpbn0uIENhbGxzIHRvIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVCZWdpbn0gYW5kXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0gbXVzdCBub3QgYmUgbmVzdGVkLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUVuZCgpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgYFVQREFURS1FTkRgKTtcblxuICAgICAgICB0aGlzLnVuYmluZFZlcnRleEFycmF5KCk7XG5cbiAgICAgICAgLy8gVW5zZXQgdGhlIHJlbmRlciB0YXJnZXRcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGlmICh0YXJnZXQpIHtcbiAgICAgICAgICAgIC8vIFJlc29sdmUgTVNBQSBpZiBuZWVkZWRcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiB0YXJnZXQuX3NhbXBsZXMgPiAxICYmIHRhcmdldC5hdXRvUmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgIHRhcmdldC5yZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIElmIHRoZSBhY3RpdmUgcmVuZGVyIHRhcmdldCBpcyBhdXRvLW1pcG1hcHBlZCwgZ2VuZXJhdGUgaXRzIG1pcCBjaGFpblxuICAgICAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSB0YXJnZXQuX2NvbG9yQnVmZmVyO1xuICAgICAgICAgICAgaWYgKGNvbG9yQnVmZmVyICYmIGNvbG9yQnVmZmVyLmltcGwuX2dsVGV4dHVyZSAmJiBjb2xvckJ1ZmZlci5taXBtYXBzICYmIChjb2xvckJ1ZmZlci5wb3QgfHwgdGhpcy53ZWJnbDIpKSB7XG4gICAgICAgICAgICAgICAgLy8gRklYTUU6IGlmIGNvbG9yQnVmZmVyIGlzIGEgY3ViZW1hcCBjdXJyZW50bHkgd2UncmUgcmUtZ2VuZXJhdGluZyBtaXBtYXBzIGFmdGVyXG4gICAgICAgICAgICAgICAgLy8gdXBkYXRpbmcgZWFjaCBmYWNlIVxuICAgICAgICAgICAgICAgIHRoaXMuYWN0aXZlVGV4dHVyZSh0aGlzLm1heENvbWJpbmVkVGV4dHVyZXMgLSAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLmJpbmRUZXh0dXJlKGNvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmdlbmVyYXRlTWlwbWFwKGNvbG9yQnVmZmVyLmltcGwuX2dsVGFyZ2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgYSB0ZXh0dXJlJ3MgdmVydGljYWwgZmxpcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZmxpcFkgLSBUcnVlIHRvIGZsaXAgdGhlIHRleHR1cmUgdmVydGljYWxseS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VW5wYWNrRmxpcFkoZmxpcFkpIHtcbiAgICAgICAgaWYgKHRoaXMudW5wYWNrRmxpcFkgIT09IGZsaXBZKSB7XG4gICAgICAgICAgICB0aGlzLnVucGFja0ZsaXBZID0gZmxpcFk7XG5cbiAgICAgICAgICAgIC8vIE5vdGU6IHRoZSBXZWJHTCBzcGVjIHN0YXRlcyB0aGF0IFVOUEFDS19GTElQX1lfV0VCR0wgb25seSBhZmZlY3RzXG4gICAgICAgICAgICAvLyB0ZXhJbWFnZTJEIGFuZCB0ZXhTdWJJbWFnZTJELCBub3QgY29tcHJlc3NlZFRleEltYWdlMkRcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19GTElQX1lfV0VCR0wsIGZsaXBZKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgYSB0ZXh0dXJlIHRvIGhhdmUgaXRzIFJHQiBjaGFubmVscyBwcmVtdWx0aXBsaWVkIGJ5IGl0cyBhbHBoYSBjaGFubmVsIG9yIG5vdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJlbXVsdGlwbHlBbHBoYSAtIFRydWUgdG8gcHJlbXVsdGlwbHkgdGhlIGFscGhhIGNoYW5uZWwgYWdhaW5zdCB0aGUgUkdCXG4gICAgICogY2hhbm5lbHMuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFVucGFja1ByZW11bHRpcGx5QWxwaGEocHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICBpZiAodGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhICE9PSBwcmVtdWx0aXBseUFscGhhKSB7XG4gICAgICAgICAgICB0aGlzLnVucGFja1ByZW11bHRpcGx5QWxwaGEgPSBwcmVtdWx0aXBseUFscGhhO1xuXG4gICAgICAgICAgICAvLyBOb3RlOiB0aGUgV2ViR0wgc3BlYyBzdGF0ZXMgdGhhdCBVTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wgb25seSBhZmZlY3RzXG4gICAgICAgICAgICAvLyB0ZXhJbWFnZTJEIGFuZCB0ZXhTdWJJbWFnZTJELCBub3QgY29tcHJlc3NlZFRleEltYWdlMkRcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgcHJlbXVsdGlwbHlBbHBoYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBY3RpdmF0ZSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0ZXh0dXJlVW5pdCAtIFRoZSB0ZXh0dXJlIHVuaXQgdG8gYWN0aXZhdGUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFjdGl2ZVRleHR1cmUodGV4dHVyZVVuaXQpIHtcbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZVVuaXQgIT09IHRleHR1cmVVbml0KSB7XG4gICAgICAgICAgICB0aGlzLmdsLmFjdGl2ZVRleHR1cmUodGhpcy5nbC5URVhUVVJFMCArIHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZVVuaXQgPSB0ZXh0dXJlVW5pdDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRoZSB0ZXh0dXJlIGlzIG5vdCBhbHJlYWR5IGJvdW5kIG9uIHRoZSBjdXJyZW50bHkgYWN0aXZlIHRleHR1cmUgdW5pdCwgYmluZCBpdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIGJpbmQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGJpbmRUZXh0dXJlKHRleHR1cmUpIHtcbiAgICAgICAgY29uc3QgaW1wbCA9IHRleHR1cmUuaW1wbDtcbiAgICAgICAgY29uc3QgdGV4dHVyZVRhcmdldCA9IGltcGwuX2dsVGFyZ2V0O1xuICAgICAgICBjb25zdCB0ZXh0dXJlT2JqZWN0ID0gaW1wbC5fZ2xUZXh0dXJlO1xuICAgICAgICBjb25zdCB0ZXh0dXJlVW5pdCA9IHRoaXMudGV4dHVyZVVuaXQ7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnRhcmdldFRvU2xvdFt0ZXh0dXJlVGFyZ2V0XTtcbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSAhPT0gdGV4dHVyZU9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5nbC5iaW5kVGV4dHVyZSh0ZXh0dXJlVGFyZ2V0LCB0ZXh0dXJlT2JqZWN0KTtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSA9IHRleHR1cmVPYmplY3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgdGV4dHVyZSBpcyBub3QgYm91bmQgb24gdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQsIGFjdGl2ZSB0aGUgdGV4dHVyZSB1bml0IGFuZCBiaW5kXG4gICAgICogdGhlIHRleHR1cmUgdG8gaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byBiaW5kLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0ZXh0dXJlVW5pdCAtIFRoZSB0ZXh0dXJlIHVuaXQgdG8gYWN0aXZhdGUgYW5kIGJpbmQgdGhlIHRleHR1cmUgdG8uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGJpbmRUZXh0dXJlT25Vbml0KHRleHR1cmUsIHRleHR1cmVVbml0KSB7XG4gICAgICAgIGNvbnN0IGltcGwgPSB0ZXh0dXJlLmltcGw7XG4gICAgICAgIGNvbnN0IHRleHR1cmVUYXJnZXQgPSBpbXBsLl9nbFRhcmdldDtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9iamVjdCA9IGltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMudGFyZ2V0VG9TbG90W3RleHR1cmVUYXJnZXRdO1xuICAgICAgICBpZiAodGhpcy50ZXh0dXJlVW5pdHNbdGV4dHVyZVVuaXRdW3Nsb3RdICE9PSB0ZXh0dXJlT2JqZWN0KSB7XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGV4dHVyZVVuaXQpO1xuICAgICAgICAgICAgdGhpcy5nbC5iaW5kVGV4dHVyZSh0ZXh0dXJlVGFyZ2V0LCB0ZXh0dXJlT2JqZWN0KTtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSA9IHRleHR1cmVPYmplY3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIHRleHR1cmUgcGFyYW1ldGVycyBmb3IgYSBnaXZlbiB0ZXh0dXJlIGlmIHRoZXkgaGF2ZSBjaGFuZ2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gdXBkYXRlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUZXh0dXJlUGFyYW1ldGVycyh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgY29uc3QgZmxhZ3MgPSB0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncztcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGV4dHVyZS5pbXBsLl9nbFRhcmdldDtcblxuICAgICAgICBpZiAoZmxhZ3MgJiAxKSB7XG4gICAgICAgICAgICBsZXQgZmlsdGVyID0gdGV4dHVyZS5fbWluRmlsdGVyO1xuICAgICAgICAgICAgaWYgKCghdGV4dHVyZS5wb3QgJiYgIXRoaXMud2ViZ2wyKSB8fCAhdGV4dHVyZS5fbWlwbWFwcyB8fCAodGV4dHVyZS5fY29tcHJlc3NlZCAmJiB0ZXh0dXJlLl9sZXZlbHMubGVuZ3RoID09PSAxKSkge1xuICAgICAgICAgICAgICAgIGlmIChmaWx0ZXIgPT09IEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIHx8IGZpbHRlciA9PT0gRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUikge1xuICAgICAgICAgICAgICAgICAgICBmaWx0ZXIgPSBGSUxURVJfTkVBUkVTVDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGZpbHRlciA9PT0gRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCB8fCBmaWx0ZXIgPT09IEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUikge1xuICAgICAgICAgICAgICAgICAgICBmaWx0ZXIgPSBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX01JTl9GSUxURVIsIHRoaXMuZ2xGaWx0ZXJbZmlsdGVyXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgMikge1xuICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgdGhpcy5nbEZpbHRlclt0ZXh0dXJlLl9tYWdGaWx0ZXJdKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiA0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1MsIHRoaXMuZ2xBZGRyZXNzW3RleHR1cmUuX2FkZHJlc3NVXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFdlYkdMMSBkb2Vzbid0IHN1cHBvcnQgYWxsIGFkZHJlc3NpbmcgbW9kZXMgd2l0aCBOUE9UIHRleHR1cmVzXG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9TLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLnBvdCA/IHRleHR1cmUuX2FkZHJlc3NVIDogQUREUkVTU19DTEFNUF9UT19FREdFXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgOCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9ULCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzVl0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBXZWJHTDEgZG9lc24ndCBzdXBwb3J0IGFsbCBhZGRyZXNzaW5nIG1vZGVzIHdpdGggTlBPVCB0ZXh0dXJlc1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfVCwgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5wb3QgPyB0ZXh0dXJlLl9hZGRyZXNzViA6IEFERFJFU1NfQ0xBTVBfVE9fRURHRV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDE2KSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1IsIHRoaXMuZ2xBZGRyZXNzW3RleHR1cmUuX2FkZHJlc3NXXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgMzIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX0NPTVBBUkVfTU9ERSwgdGV4dHVyZS5fY29tcGFyZU9uUmVhZCA/IGdsLkNPTVBBUkVfUkVGX1RPX1RFWFRVUkUgOiBnbC5OT05FKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiA2NCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfQ09NUEFSRV9GVU5DLCB0aGlzLmdsQ29tcGFyaXNvblt0ZXh0dXJlLl9jb21wYXJlRnVuY10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDEyOCkge1xuICAgICAgICAgICAgY29uc3QgZXh0ID0gdGhpcy5leHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWM7XG4gICAgICAgICAgICBpZiAoZXh0KSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyZih0YXJnZXQsIGV4dC5URVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCwgTWF0aC5tYXgoMSwgTWF0aC5taW4oTWF0aC5yb3VuZCh0ZXh0dXJlLl9hbmlzb3Ryb3B5KSwgdGhpcy5tYXhBbmlzb3Ryb3B5KSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc3BlY2lmaWVkIHRleHR1cmUgb24gdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHRleHR1cmVVbml0IC0gVGhlIHRleHR1cmUgdW5pdCB0byBzZXQgdGhlIHRleHR1cmUgb24uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFRleHR1cmUodGV4dHVyZSwgdGV4dHVyZVVuaXQpIHtcblxuICAgICAgICBpZiAoIXRleHR1cmUuaW1wbC5fZ2xUZXh0dXJlKVxuICAgICAgICAgICAgdGV4dHVyZS5pbXBsLmluaXRpYWxpemUodGhpcywgdGV4dHVyZSk7XG5cbiAgICAgICAgaWYgKHRleHR1cmUuX3BhcmFtZXRlckZsYWdzID4gMCB8fCB0ZXh0dXJlLl9uZWVkc1VwbG9hZCB8fCB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQpIHtcblxuICAgICAgICAgICAgLy8gRW5zdXJlIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0IGlzIGFjdGl2ZVxuICAgICAgICAgICAgdGhpcy5hY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KTtcblxuICAgICAgICAgICAgLy8gRW5zdXJlIHRoZSB0ZXh0dXJlIGlzIGJvdW5kIG9uIGNvcnJlY3QgdGFyZ2V0IG9mIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0XG4gICAgICAgICAgICB0aGlzLmJpbmRUZXh0dXJlKHRleHR1cmUpO1xuXG4gICAgICAgICAgICBpZiAodGV4dHVyZS5fcGFyYW1ldGVyRmxhZ3MpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFRleHR1cmVQYXJhbWV0ZXJzKHRleHR1cmUpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX3BhcmFtZXRlckZsYWdzID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRleHR1cmUuX25lZWRzVXBsb2FkIHx8IHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCkge1xuICAgICAgICAgICAgICAgIHRleHR1cmUuaW1wbC51cGxvYWQodGhpcywgdGV4dHVyZSk7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5fbmVlZHNVcGxvYWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgdGV4dHVyZSBpcyBjdXJyZW50bHkgYm91bmQgdG8gdGhlIGNvcnJlY3QgdGFyZ2V0IG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LlxuICAgICAgICAgICAgLy8gSWYgdGhlIHRleHR1cmUgaXMgYWxyZWFkeSBib3VuZCB0byB0aGUgY29ycmVjdCB0YXJnZXQgb24gdGhlIHNwZWNpZmllZCB1bml0LCB0aGVyZSdzIG5vIG5lZWRcbiAgICAgICAgICAgIC8vIHRvIGFjdHVhbGx5IG1ha2UgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQgYWN0aXZlIGJlY2F1c2UgdGhlIHRleHR1cmUgaXRzZWxmIGRvZXMgbm90IG5lZWRcbiAgICAgICAgICAgIC8vIHRvIGJlIHVwZGF0ZWQuXG4gICAgICAgICAgICB0aGlzLmJpbmRUZXh0dXJlT25Vbml0KHRleHR1cmUsIHRleHR1cmVVbml0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZ1bmN0aW9uIGNyZWF0ZXMgVmVydGV4QXJyYXlPYmplY3QgZnJvbSBsaXN0IG9mIHZlcnRleCBidWZmZXJzXG4gICAgY3JlYXRlVmVydGV4QXJyYXkodmVydGV4QnVmZmVycykge1xuXG4gICAgICAgIGxldCBrZXksIHZhbztcblxuICAgICAgICAvLyBvbmx5IHVzZSBjYWNoZSB3aGVuIG1vcmUgdGhhbiAxIHZlcnRleCBidWZmZXIsIG90aGVyd2lzZSBpdCdzIHVuaXF1ZVxuICAgICAgICBjb25zdCB1c2VDYWNoZSA9IHZlcnRleEJ1ZmZlcnMubGVuZ3RoID4gMTtcbiAgICAgICAgaWYgKHVzZUNhY2hlKSB7XG5cbiAgICAgICAgICAgIC8vIGdlbmVyYXRlIHVuaXF1ZSBrZXkgZm9yIHRoZSB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICAgICAga2V5ID0gXCJcIjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4QnVmZmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcnNbaV07XG4gICAgICAgICAgICAgICAga2V5ICs9IHZlcnRleEJ1ZmZlci5pZCArIHZlcnRleEJ1ZmZlci5mb3JtYXQucmVuZGVyaW5nSGFzaDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdHJ5IHRvIGdldCBWQU8gZnJvbSBjYWNoZVxuICAgICAgICAgICAgdmFvID0gdGhpcy5fdmFvTWFwLmdldChrZXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbmVlZCB0byBjcmVhdGUgbmV3IHZhb1xuICAgICAgICBpZiAoIXZhbykge1xuXG4gICAgICAgICAgICAvLyBjcmVhdGUgVkEgb2JqZWN0XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICB2YW8gPSBnbC5jcmVhdGVWZXJ0ZXhBcnJheSgpO1xuICAgICAgICAgICAgZ2wuYmluZFZlcnRleEFycmF5KHZhbyk7XG5cbiAgICAgICAgICAgIC8vIGRvbid0IGNhcHR1cmUgaW5kZXggYnVmZmVyIGluIFZBT1xuICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgbnVsbCk7XG5cbiAgICAgICAgICAgIGxldCBsb2NaZXJvID0gZmFsc2U7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRleEJ1ZmZlcnMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIC8vIGJpbmQgYnVmZmVyXG4gICAgICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyc1tpXTtcbiAgICAgICAgICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdmVydGV4QnVmZmVyLmltcGwuYnVmZmVySWQpO1xuXG4gICAgICAgICAgICAgICAgLy8gZm9yIGVhY2ggYXR0cmlidXRlXG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudHMgPSB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LmVsZW1lbnRzO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZWxlbWVudHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZSA9IGVsZW1lbnRzW2pdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2MgPSBzZW1hbnRpY1RvTG9jYXRpb25bZS5uYW1lXTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAobG9jID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NaZXJvID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIobG9jLCBlLm51bUNvbXBvbmVudHMsIHRoaXMuZ2xUeXBlW2UuZGF0YVR5cGVdLCBlLm5vcm1hbGl6ZSwgZS5zdHJpZGUsIGUub2Zmc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkobG9jKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodmVydGV4QnVmZmVyLmZvcm1hdC5pbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJEaXZpc29yKGxvYywgMSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGVuZCBvZiBWQSBvYmplY3RcbiAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheShudWxsKTtcblxuICAgICAgICAgICAgLy8gdW5iaW5kIGFueSBhcnJheSBidWZmZXJcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBudWxsKTtcblxuICAgICAgICAgICAgLy8gYWRkIGl0IHRvIGNhY2hlXG4gICAgICAgICAgICBpZiAodXNlQ2FjaGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl92YW9NYXAuc2V0KGtleSwgdmFvKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFsb2NaZXJvKSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybihcIk5vIHZlcnRleCBhdHRyaWJ1dGUgaXMgbWFwcGVkIHRvIGxvY2F0aW9uIDAsIHdoaWNoIG1pZ2h0IGNhdXNlIGNvbXBhdGliaWxpdHkgaXNzdWVzIG9uIFNhZmFyaSBvbiBNYWNPUyAtIHBsZWFzZSB1c2UgYXR0cmlidXRlIFNFTUFOVElDX1BPU0lUSU9OIG9yIFNFTUFOVElDX0FUVFIxNVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YW87XG4gICAgfVxuXG4gICAgdW5iaW5kVmVydGV4QXJyYXkoKSB7XG4gICAgICAgIC8vIHVuYmluZCBWQU8gZnJvbSBkZXZpY2UgdG8gcHJvdGVjdCBpdCBmcm9tIGJlaW5nIGNoYW5nZWRcbiAgICAgICAgaWYgKHRoaXMuYm91bmRWYW8pIHtcbiAgICAgICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5nbC5iaW5kVmVydGV4QXJyYXkobnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRCdWZmZXJzKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCB2YW87XG5cbiAgICAgICAgLy8gY3JlYXRlIFZBTyBmb3Igc3BlY2lmaWVkIHZlcnRleCBidWZmZXJzXG4gICAgICAgIGlmICh0aGlzLnZlcnRleEJ1ZmZlcnMubGVuZ3RoID09PSAxKSB7XG5cbiAgICAgICAgICAgIC8vIHNpbmdsZSBWQiBrZWVwcyBpdHMgVkFPXG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB0aGlzLnZlcnRleEJ1ZmZlcnNbMF07XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodmVydGV4QnVmZmVyLmRldmljZSA9PT0gdGhpcywgXCJUaGUgVmVydGV4QnVmZmVyIHdhcyBub3QgY3JlYXRlZCB1c2luZyBjdXJyZW50IEdyYXBoaWNzRGV2aWNlXCIpO1xuICAgICAgICAgICAgaWYgKCF2ZXJ0ZXhCdWZmZXIuaW1wbC52YW8pIHtcbiAgICAgICAgICAgICAgICB2ZXJ0ZXhCdWZmZXIuaW1wbC52YW8gPSB0aGlzLmNyZWF0ZVZlcnRleEFycmF5KHRoaXMudmVydGV4QnVmZmVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YW8gPSB2ZXJ0ZXhCdWZmZXIuaW1wbC52YW87XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBvYnRhaW4gdGVtcG9yYXJ5IFZBTyBmb3IgbXVsdGlwbGUgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIHZhbyA9IHRoaXMuY3JlYXRlVmVydGV4QXJyYXkodGhpcy52ZXJ0ZXhCdWZmZXJzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBhY3RpdmUgVkFPXG4gICAgICAgIGlmICh0aGlzLmJvdW5kVmFvICE9PSB2YW8pIHtcbiAgICAgICAgICAgIHRoaXMuYm91bmRWYW8gPSB2YW87XG4gICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkodmFvKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVtcHR5IGFycmF5IG9mIHZlcnRleCBidWZmZXJzXG4gICAgICAgIHRoaXMudmVydGV4QnVmZmVycy5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vIFNldCB0aGUgYWN0aXZlIGluZGV4IGJ1ZmZlciBvYmplY3RcbiAgICAgICAgLy8gTm90ZTogd2UgZG9uJ3QgY2FjaGUgdGhpcyBzdGF0ZSBhbmQgc2V0IGl0IG9ubHkgd2hlbiBpdCBjaGFuZ2VzLCBhcyBWQU8gY2FwdHVyZXMgbGFzdCBiaW5kIGJ1ZmZlciBpbiBpdFxuICAgICAgICAvLyBhbmQgc28gd2UgZG9uJ3Qga25vdyB3aGF0IFZBTyBzZXRzIGl0IHRvLlxuICAgICAgICBjb25zdCBidWZmZXJJZCA9IHRoaXMuaW5kZXhCdWZmZXIgPyB0aGlzLmluZGV4QnVmZmVyLmltcGwuYnVmZmVySWQgOiBudWxsO1xuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBidWZmZXJJZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3VibWl0cyBhIGdyYXBoaWNhbCBwcmltaXRpdmUgdG8gdGhlIGhhcmR3YXJlIGZvciBpbW1lZGlhdGUgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHByaW1pdGl2ZSAtIFByaW1pdGl2ZSBvYmplY3QgZGVzY3JpYmluZyBob3cgdG8gc3VibWl0IGN1cnJlbnQgdmVydGV4L2luZGV4XG4gICAgICogYnVmZmVycy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcHJpbWl0aXZlLnR5cGUgLSBUaGUgdHlwZSBvZiBwcmltaXRpdmUgdG8gcmVuZGVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfUE9JTlRTfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORUxPT1B9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVTVFJJUH1cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJQU5HTEVTfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9UUklTVFJJUH1cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJRkFOfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS5iYXNlIC0gVGhlIG9mZnNldCBvZiB0aGUgZmlyc3QgaW5kZXggb3IgdmVydGV4IHRvIGRpc3BhdGNoIGluIHRoZVxuICAgICAqIGRyYXcgY2FsbC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcHJpbWl0aXZlLmNvdW50IC0gVGhlIG51bWJlciBvZiBpbmRpY2VzIG9yIHZlcnRpY2VzIHRvIGRpc3BhdGNoIGluIHRoZSBkcmF3XG4gICAgICogY2FsbC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtwcmltaXRpdmUuaW5kZXhlZF0gLSBUcnVlIHRvIGludGVycHJldCB0aGUgcHJpbWl0aXZlIGFzIGluZGV4ZWQsIHRoZXJlYnlcbiAgICAgKiB1c2luZyB0aGUgY3VycmVudGx5IHNldCBpbmRleCBidWZmZXIgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW251bUluc3RhbmNlcz0xXSAtIFRoZSBudW1iZXIgb2YgaW5zdGFuY2VzIHRvIHJlbmRlciB3aGVuIHVzaW5nXG4gICAgICogQU5HTEVfaW5zdGFuY2VkX2FycmF5cy4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtrZWVwQnVmZmVyc10gLSBPcHRpb25hbGx5IGtlZXAgdGhlIGN1cnJlbnQgc2V0IG9mIHZlcnRleCAvIGluZGV4IGJ1ZmZlcnMgL1xuICAgICAqIFZBTy4gVGhpcyBpcyB1c2VkIHdoZW4gcmVuZGVyaW5nIG9mIG11bHRpcGxlIHZpZXdzLCBmb3IgZXhhbXBsZSB1bmRlciBXZWJYUi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIHNpbmdsZSwgdW5pbmRleGVkIHRyaWFuZ2xlXG4gICAgICogZGV2aWNlLmRyYXcoe1xuICAgICAqICAgICB0eXBlOiBwYy5QUklNSVRJVkVfVFJJQU5HTEVTLFxuICAgICAqICAgICBiYXNlOiAwLFxuICAgICAqICAgICBjb3VudDogMyxcbiAgICAgKiAgICAgaW5kZXhlZDogZmFsc2VcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBkcmF3KHByaW1pdGl2ZSwgbnVtSW5zdGFuY2VzLCBrZWVwQnVmZmVycykge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgbGV0IHNhbXBsZXIsIHNhbXBsZXJWYWx1ZSwgdGV4dHVyZSwgbnVtVGV4dHVyZXM7IC8vIFNhbXBsZXJzXG4gICAgICAgIGxldCB1bmlmb3JtLCBzY29wZUlkLCB1bmlmb3JtVmVyc2lvbiwgcHJvZ3JhbVZlcnNpb247IC8vIFVuaWZvcm1zXG4gICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuc2hhZGVyO1xuICAgICAgICBpZiAoIXNoYWRlcilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgY29uc3Qgc2FtcGxlcnMgPSBzaGFkZXIuaW1wbC5zYW1wbGVycztcbiAgICAgICAgY29uc3QgdW5pZm9ybXMgPSBzaGFkZXIuaW1wbC51bmlmb3JtcztcblxuICAgICAgICAvLyB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICBpZiAoIWtlZXBCdWZmZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnNldEJ1ZmZlcnMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbW1pdCB0aGUgc2hhZGVyIHByb2dyYW0gdmFyaWFibGVzXG4gICAgICAgIGxldCB0ZXh0dXJlVW5pdCA9IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHNhbXBsZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBzYW1wbGVyID0gc2FtcGxlcnNbaV07XG4gICAgICAgICAgICBzYW1wbGVyVmFsdWUgPSBzYW1wbGVyLnNjb3BlSWQudmFsdWU7XG4gICAgICAgICAgICBpZiAoIXNhbXBsZXJWYWx1ZSkge1xuXG4gICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgIGNvbnN0IHNhbXBsZXJOYW1lID0gc2FtcGxlci5zY29wZUlkLm5hbWU7XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXJOYW1lID09PSAndVNjZW5lRGVwdGhNYXAnIHx8IHNhbXBsZXJOYW1lID09PSAndURlcHRoTWFwJykge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuT25jZShgQSBzYW1wbGVyICR7c2FtcGxlck5hbWV9IGlzIHVzZWQgYnkgdGhlIHNoYWRlciBidXQgYSBzY2VuZSBkZXB0aCB0ZXh0dXJlIGlzIG5vdCBhdmFpbGFibGUuIFVzZSBDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lRGVwdGhNYXAgdG8gZW5hYmxlIGl0LmApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc2FtcGxlck5hbWUgPT09ICd1U2NlbmVDb2xvck1hcCcgfHwgc2FtcGxlck5hbWUgPT09ICd0ZXh0dXJlX2dyYWJQYXNzJykge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuT25jZShgQSBzYW1wbGVyICR7c2FtcGxlck5hbWV9IGlzIHVzZWQgYnkgdGhlIHNoYWRlciBidXQgYSBzY2VuZSBkZXB0aCB0ZXh0dXJlIGlzIG5vdCBhdmFpbGFibGUuIFVzZSBDYW1lcmFDb21wb25lbnQucmVxdWVzdFNjZW5lQ29sb3JNYXAgdG8gZW5hYmxlIGl0LmApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgIERlYnVnLmVycm9yT25jZShgU2hhZGVyIFske3NoYWRlci5sYWJlbH1dIHJlcXVpcmVzIHRleHR1cmUgc2FtcGxlciBbJHtzYW1wbGVyTmFtZX1dIHdoaWNoIGhhcyBub3QgYmVlbiBzZXQsIHdoaWxlIHJlbmRlcmluZyBbJHtEZWJ1Z0dyYXBoaWNzLnRvU3RyaW5nKCl9XWApO1xuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCB0aGlzIGRyYXcgY2FsbCB0byBhdm9pZCBpbmNvcnJlY3QgcmVuZGVyaW5nIC8gd2ViZ2wgZXJyb3JzXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2FtcGxlclZhbHVlIGluc3RhbmNlb2YgVGV4dHVyZSkge1xuICAgICAgICAgICAgICAgIHRleHR1cmUgPSBzYW1wbGVyVmFsdWU7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KTtcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gU2V0IGJyZWFrcG9pbnQgaGVyZSB0byBkZWJ1ZyBcIlNvdXJjZSBhbmQgZGVzdGluYXRpb24gdGV4dHVyZXMgb2YgdGhlIGRyYXcgYXJlIHRoZSBzYW1lXCIgZXJyb3JzXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlbmRlclRhcmdldC5fc2FtcGxlcyA8IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlbmRlclRhcmdldC5jb2xvckJ1ZmZlciAmJiB0aGlzLnJlbmRlclRhcmdldC5jb2xvckJ1ZmZlciA9PT0gdGV4dHVyZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiVHJ5aW5nIHRvIGJpbmQgY3VycmVudCBjb2xvciBidWZmZXIgYXMgYSB0ZXh0dXJlXCIsIHsgcmVuZGVyVGFyZ2V0OiB0aGlzLnJlbmRlclRhcmdldCwgdGV4dHVyZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5yZW5kZXJUYXJnZXQuZGVwdGhCdWZmZXIgJiYgdGhpcy5yZW5kZXJUYXJnZXQuZGVwdGhCdWZmZXIgPT09IHRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIlRyeWluZyB0byBiaW5kIGN1cnJlbnQgZGVwdGggYnVmZmVyIGFzIGEgdGV4dHVyZVwiLCB7IHRleHR1cmUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBpZiAoc2FtcGxlci5zbG90ICE9PSB0ZXh0dXJlVW5pdCkge1xuICAgICAgICAgICAgICAgICAgICBnbC51bmlmb3JtMWkoc2FtcGxlci5sb2NhdGlvbklkLCB0ZXh0dXJlVW5pdCk7XG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXIuc2xvdCA9IHRleHR1cmVVbml0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0ZXh0dXJlVW5pdCsrO1xuICAgICAgICAgICAgfSBlbHNlIHsgLy8gQXJyYXlcbiAgICAgICAgICAgICAgICBzYW1wbGVyLmFycmF5Lmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgbnVtVGV4dHVyZXMgPSBzYW1wbGVyVmFsdWUubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbnVtVGV4dHVyZXM7IGorKykge1xuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlID0gc2FtcGxlclZhbHVlW2pdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFRleHR1cmUodGV4dHVyZSwgdGV4dHVyZVVuaXQpO1xuXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXIuYXJyYXlbal0gPSB0ZXh0dXJlVW5pdDtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZVVuaXQrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFpdihzYW1wbGVyLmxvY2F0aW9uSWQsIHNhbXBsZXIuYXJyYXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29tbWl0IGFueSB1cGRhdGVkIHVuaWZvcm1zXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB1bmlmb3Jtcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdW5pZm9ybSA9IHVuaWZvcm1zW2ldO1xuICAgICAgICAgICAgc2NvcGVJZCA9IHVuaWZvcm0uc2NvcGVJZDtcbiAgICAgICAgICAgIHVuaWZvcm1WZXJzaW9uID0gdW5pZm9ybS52ZXJzaW9uO1xuICAgICAgICAgICAgcHJvZ3JhbVZlcnNpb24gPSBzY29wZUlkLnZlcnNpb25PYmplY3QudmVyc2lvbjtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgdGhlIHZhbHVlIGlzIHZhbGlkXG4gICAgICAgICAgICBpZiAodW5pZm9ybVZlcnNpb24uZ2xvYmFsSWQgIT09IHByb2dyYW1WZXJzaW9uLmdsb2JhbElkIHx8IHVuaWZvcm1WZXJzaW9uLnJldmlzaW9uICE9PSBwcm9ncmFtVmVyc2lvbi5yZXZpc2lvbikge1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WZXJzaW9uLmdsb2JhbElkID0gcHJvZ3JhbVZlcnNpb24uZ2xvYmFsSWQ7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZlcnNpb24ucmV2aXNpb24gPSBwcm9ncmFtVmVyc2lvbi5yZXZpc2lvbjtcblxuICAgICAgICAgICAgICAgIC8vIENhbGwgdGhlIGZ1bmN0aW9uIHRvIGNvbW1pdCB0aGUgdW5pZm9ybSB2YWx1ZVxuICAgICAgICAgICAgICAgIGlmIChzY29wZUlkLnZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bdW5pZm9ybS5kYXRhVHlwZV0odW5pZm9ybSwgc2NvcGVJZC52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29tbWVudGVkIG91dCB0aWxsIGVuZ2luZSBpc3N1ZSAjNDk3MSBpcyBzb3J0ZWQgb3V0XG4gICAgICAgICAgICAgICAgICAgIC8vIERlYnVnLndhcm5PbmNlKGBTaGFkZXIgWyR7c2hhZGVyLmxhYmVsfV0gcmVxdWlyZXMgdW5pZm9ybSBbJHt1bmlmb3JtLnNjb3BlSWQubmFtZX1dIHdoaWNoIGhhcyBub3QgYmVlbiBzZXQsIHdoaWxlIHJlbmRlcmluZyBbJHtEZWJ1Z0dyYXBoaWNzLnRvU3RyaW5nKCl9XWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBFbmFibGUgVEYsIHN0YXJ0IHdyaXRpbmcgdG8gb3V0IGJ1ZmZlclxuICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlckJhc2UoZ2wuVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiwgMCwgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlci5pbXBsLmJ1ZmZlcklkKTtcbiAgICAgICAgICAgIGdsLmJlZ2luVHJhbnNmb3JtRmVlZGJhY2soZ2wuUE9JTlRTKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1vZGUgPSB0aGlzLmdsUHJpbWl0aXZlW3ByaW1pdGl2ZS50eXBlXTtcbiAgICAgICAgY29uc3QgY291bnQgPSBwcmltaXRpdmUuY291bnQ7XG5cbiAgICAgICAgaWYgKHByaW1pdGl2ZS5pbmRleGVkKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleEJ1ZmZlciA9IHRoaXMuaW5kZXhCdWZmZXI7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoaW5kZXhCdWZmZXIuZGV2aWNlID09PSB0aGlzLCBcIlRoZSBJbmRleEJ1ZmZlciB3YXMgbm90IGNyZWF0ZWQgdXNpbmcgY3VycmVudCBHcmFwaGljc0RldmljZVwiKTtcblxuICAgICAgICAgICAgY29uc3QgZm9ybWF0ID0gaW5kZXhCdWZmZXIuaW1wbC5nbEZvcm1hdDtcbiAgICAgICAgICAgIGNvbnN0IG9mZnNldCA9IHByaW1pdGl2ZS5iYXNlICogaW5kZXhCdWZmZXIuYnl0ZXNQZXJJbmRleDtcblxuICAgICAgICAgICAgaWYgKG51bUluc3RhbmNlcyA+IDApIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQobW9kZSwgY291bnQsIGZvcm1hdCwgb2Zmc2V0LCBudW1JbnN0YW5jZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHMobW9kZSwgY291bnQsIGZvcm1hdCwgb2Zmc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0ID0gcHJpbWl0aXZlLmJhc2U7XG5cbiAgICAgICAgICAgIGlmIChudW1JbnN0YW5jZXMgPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0FycmF5c0luc3RhbmNlZChtb2RlLCBmaXJzdCwgY291bnQsIG51bUluc3RhbmNlcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXMobW9kZSwgZmlyc3QsIGNvdW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyKSB7XG4gICAgICAgICAgICAvLyBkaXNhYmxlIFRGXG4gICAgICAgICAgICBnbC5lbmRUcmFuc2Zvcm1GZWVkYmFjaygpO1xuICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlckJhc2UoZ2wuVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiwgMCwgbnVsbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kcmF3Q2FsbHNQZXJGcmFtZSsrO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5fcHJpbXNQZXJGcmFtZVtwcmltaXRpdmUudHlwZV0gKz0gcHJpbWl0aXZlLmNvdW50ICogKG51bUluc3RhbmNlcyA+IDEgPyBudW1JbnN0YW5jZXMgOiAxKTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xlYXJzIHRoZSBmcmFtZSBidWZmZXIgb2YgdGhlIGN1cnJlbnRseSBzZXQgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGNvbnRyb2xzIHRoZSBiZWhhdmlvciBvZiB0aGUgY2xlYXJcbiAgICAgKiBvcGVyYXRpb24gZGVmaW5lZCBhcyBmb2xsb3dzOlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IFtvcHRpb25zLmNvbG9yXSAtIFRoZSBjb2xvciB0byBjbGVhciB0aGUgY29sb3IgYnVmZmVyIHRvIGluIHRoZSByYW5nZSAwLjBcbiAgICAgKiB0byAxLjAgZm9yIGVhY2ggY29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5kZXB0aD0xXSAtIFRoZSBkZXB0aCB2YWx1ZSB0byBjbGVhciB0aGUgZGVwdGggYnVmZmVyIHRvIGluIHRoZVxuICAgICAqIHJhbmdlIDAuMCB0byAxLjAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZsYWdzXSAtIFRoZSBidWZmZXJzIHRvIGNsZWFyICh0aGUgdHlwZXMgYmVpbmcgY29sb3IsIGRlcHRoIGFuZFxuICAgICAqIHN0ZW5jaWwpLiBDYW4gYmUgYW55IGJpdHdpc2UgY29tYmluYXRpb24gb2Y6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBDTEVBUkZMQUdfQ09MT1J9XG4gICAgICogLSB7QGxpbmsgQ0xFQVJGTEFHX0RFUFRIfVxuICAgICAqIC0ge0BsaW5rIENMRUFSRkxBR19TVEVOQ0lMfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0ZW5jaWw9MF0gLSBUaGUgc3RlbmNpbCB2YWx1ZSB0byBjbGVhciB0aGUgc3RlbmNpbCBidWZmZXIgdG8uIERlZmF1bHRzIHRvIDAuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDbGVhciBjb2xvciBidWZmZXIgdG8gYmxhY2sgYW5kIGRlcHRoIGJ1ZmZlciB0byAxLjBcbiAgICAgKiBkZXZpY2UuY2xlYXIoKTtcbiAgICAgKlxuICAgICAqIC8vIENsZWFyIGp1c3QgdGhlIGNvbG9yIGJ1ZmZlciB0byByZWRcbiAgICAgKiBkZXZpY2UuY2xlYXIoe1xuICAgICAqICAgICBjb2xvcjogWzEsIDAsIDAsIDFdLFxuICAgICAqICAgICBmbGFnczogcGMuQ0xFQVJGTEFHX0NPTE9SXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBDbGVhciBjb2xvciBidWZmZXIgdG8geWVsbG93IGFuZCBkZXB0aCB0byAxLjBcbiAgICAgKiBkZXZpY2UuY2xlYXIoe1xuICAgICAqICAgICBjb2xvcjogWzEsIDEsIDAsIDFdLFxuICAgICAqICAgICBkZXB0aDogMSxcbiAgICAgKiAgICAgZmxhZ3M6IHBjLkNMRUFSRkxBR19DT0xPUiB8IHBjLkNMRUFSRkxBR19ERVBUSFxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGNsZWFyKG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB0aGlzLmRlZmF1bHRDbGVhck9wdGlvbnM7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IGRlZmF1bHRPcHRpb25zO1xuXG4gICAgICAgIGNvbnN0IGZsYWdzID0gb3B0aW9ucy5mbGFncyA/PyBkZWZhdWx0T3B0aW9ucy5mbGFncztcbiAgICAgICAgaWYgKGZsYWdzICE9PSAwKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgICAgIC8vIFNldCB0aGUgY2xlYXIgY29sb3JcbiAgICAgICAgICAgIGlmIChmbGFncyAmIENMRUFSRkxBR19DT0xPUikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9yID0gb3B0aW9ucy5jb2xvciA/PyBkZWZhdWx0T3B0aW9ucy5jb2xvcjtcbiAgICAgICAgICAgICAgICBjb25zdCByID0gY29sb3JbMF07XG4gICAgICAgICAgICAgICAgY29uc3QgZyA9IGNvbG9yWzFdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGIgPSBjb2xvclsyXTtcbiAgICAgICAgICAgICAgICBjb25zdCBhID0gY29sb3JbM107XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjID0gdGhpcy5jbGVhckNvbG9yO1xuICAgICAgICAgICAgICAgIGlmICgociAhPT0gYy5yKSB8fCAoZyAhPT0gYy5nKSB8fCAoYiAhPT0gYy5iKSB8fCAoYSAhPT0gYy5hKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmNsZWFyQ29sb3IociwgZywgYiwgYSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJDb2xvci5zZXQociwgZywgYiwgYSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRCbGVuZFN0YXRlKEJsZW5kU3RhdGUuREVGQVVMVCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGFncyAmIENMRUFSRkxBR19ERVBUSCkge1xuICAgICAgICAgICAgICAgIC8vIFNldCB0aGUgY2xlYXIgZGVwdGhcbiAgICAgICAgICAgICAgICBjb25zdCBkZXB0aCA9IG9wdGlvbnMuZGVwdGggPz8gZGVmYXVsdE9wdGlvbnMuZGVwdGg7XG5cbiAgICAgICAgICAgICAgICBpZiAoZGVwdGggIT09IHRoaXMuY2xlYXJEZXB0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmNsZWFyRGVwdGgoZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsZWFyRGVwdGggPSBkZXB0aDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNldERlcHRoU3RhdGUoRGVwdGhTdGF0ZS5XUklURURFUFRIKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX1NURU5DSUwpIHtcbiAgICAgICAgICAgICAgICAvLyBTZXQgdGhlIGNsZWFyIHN0ZW5jaWxcbiAgICAgICAgICAgICAgICBjb25zdCBzdGVuY2lsID0gb3B0aW9ucy5zdGVuY2lsID8/IGRlZmF1bHRPcHRpb25zLnN0ZW5jaWw7XG4gICAgICAgICAgICAgICAgaWYgKHN0ZW5jaWwgIT09IHRoaXMuY2xlYXJTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuY2xlYXJTdGVuY2lsKHN0ZW5jaWwpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsZWFyU3RlbmNpbCA9IHN0ZW5jaWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDbGVhciB0aGUgZnJhbWUgYnVmZmVyXG4gICAgICAgICAgICBnbC5jbGVhcih0aGlzLmdsQ2xlYXJGbGFnW2ZsYWdzXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWFkcyBhIGJsb2NrIG9mIHBpeGVscyBmcm9tIGEgc3BlY2lmaWVkIHJlY3RhbmdsZSBvZiB0aGUgY3VycmVudCBjb2xvciBmcmFtZWJ1ZmZlciBpbnRvIGFuXG4gICAgICogQXJyYXlCdWZmZXJWaWV3IG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHgtY29vcmRpbmF0ZSBvZiB0aGUgcmVjdGFuZ2xlJ3MgbG93ZXItbGVmdCBjb3JuZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeS1jb29yZGluYXRlIG9mIHRoZSByZWN0YW5nbGUncyBsb3dlci1sZWZ0IGNvcm5lci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlLCBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUsIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge0FycmF5QnVmZmVyVmlld30gcGl4ZWxzIC0gVGhlIEFycmF5QnVmZmVyVmlldyBvYmplY3QgdGhhdCBob2xkcyB0aGUgcmV0dXJuZWQgcGl4ZWxcbiAgICAgKiBkYXRhLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZWFkUGl4ZWxzKHgsIHksIHcsIGgsIHBpeGVscykge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGdsLnJlYWRQaXhlbHMoeCwgeSwgdywgaCwgZ2wuUkdCQSwgZ2wuVU5TSUdORURfQllURSwgcGl4ZWxzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIGFscGhhIHRvIGNvdmVyYWdlIChXZWJHTDIgb25seSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHN0YXRlIC0gVHJ1ZSB0byBlbmFibGUgYWxwaGEgdG8gY292ZXJhZ2UgYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEFscGhhVG9Db3ZlcmFnZShzdGF0ZSkge1xuICAgICAgICBpZiAoIXRoaXMud2ViZ2wyKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLmFscGhhVG9Db3ZlcmFnZSA9PT0gc3RhdGUpIHJldHVybjtcbiAgICAgICAgdGhpcy5hbHBoYVRvQ292ZXJhZ2UgPSBzdGF0ZTtcblxuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuU0FNUExFX0FMUEhBX1RPX0NPVkVSQUdFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBvdXRwdXQgdmVydGV4IGJ1ZmZlci4gSXQgd2lsbCBiZSB3cml0dGVuIHRvIGJ5IGEgc2hhZGVyIHdpdGggdHJhbnNmb3JtIGZlZWRiYWNrXG4gICAgICogdmFyeWluZ3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vdmVydGV4LWJ1ZmZlci5qcycpLlZlcnRleEJ1ZmZlcn0gdGYgLSBUaGUgb3V0cHV0IHZlcnRleCBidWZmZXIuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyKHRmKSB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyID09PSB0ZilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyID0gdGY7XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBpZiAodGYpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZmVlZGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5mZWVkYmFjayA9IGdsLmNyZWF0ZVRyYW5zZm9ybUZlZWRiYWNrKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdsLmJpbmRUcmFuc2Zvcm1GZWVkYmFjayhnbC5UUkFOU0ZPUk1fRkVFREJBQ0ssIHRoaXMuZmVlZGJhY2spO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5iaW5kVHJhbnNmb3JtRmVlZGJhY2soZ2wuVFJBTlNGT1JNX0ZFRURCQUNLLCBudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRvZ2dsZXMgdGhlIHJhc3Rlcml6YXRpb24gcmVuZGVyIHN0YXRlLiBVc2VmdWwgd2l0aCB0cmFuc2Zvcm0gZmVlZGJhY2ssIHdoZW4geW91IG9ubHkgbmVlZFxuICAgICAqIHRvIHByb2Nlc3MgdGhlIGRhdGEgd2l0aG91dCBkcmF3aW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvbiAtIFRydWUgdG8gZW5hYmxlIHJhc3Rlcml6YXRpb24gYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFJhc3Rlcihvbikge1xuICAgICAgICBpZiAodGhpcy5yYXN0ZXIgPT09IG9uKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5yYXN0ZXIgPSBvbjtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIGlmIChvbikge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlJBU1RFUklaRVJfRElTQ0FSRCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuUkFTVEVSSVpFUl9ESVNDQVJEKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRvZ2dsZXMgdGhlIHBvbHlnb24gb2Zmc2V0IHJlbmRlciBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb24gLSBUcnVlIHRvIGVuYWJsZSBwb2x5Z29uIG9mZnNldCBhbmQgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0RGVwdGhCaWFzKG9uKSB7XG4gICAgICAgIGlmICh0aGlzLmRlcHRoQmlhc0VuYWJsZWQgPT09IG9uKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5kZXB0aEJpYXNFbmFibGVkID0gb247XG5cbiAgICAgICAgaWYgKG9uKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5nbC5kaXNhYmxlKHRoaXMuZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTcGVjaWZpZXMgdGhlIHNjYWxlIGZhY3RvciBhbmQgdW5pdHMgdG8gY2FsY3VsYXRlIGRlcHRoIHZhbHVlcy4gVGhlIG9mZnNldCBpcyBhZGRlZCBiZWZvcmVcbiAgICAgKiB0aGUgZGVwdGggdGVzdCBpcyBwZXJmb3JtZWQgYW5kIGJlZm9yZSB0aGUgdmFsdWUgaXMgd3JpdHRlbiBpbnRvIHRoZSBkZXB0aCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY29uc3RCaWFzIC0gVGhlIG11bHRpcGxpZXIgYnkgd2hpY2ggYW4gaW1wbGVtZW50YXRpb24tc3BlY2lmaWMgdmFsdWUgaXNcbiAgICAgKiBtdWx0aXBsaWVkIHdpdGggdG8gY3JlYXRlIGEgY29uc3RhbnQgZGVwdGggb2Zmc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzbG9wZUJpYXMgLSBUaGUgc2NhbGUgZmFjdG9yIGZvciB0aGUgdmFyaWFibGUgZGVwdGggb2Zmc2V0IGZvciBlYWNoIHBvbHlnb24uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldERlcHRoQmlhc1ZhbHVlcyhjb25zdEJpYXMsIHNsb3BlQmlhcykge1xuICAgICAgICB0aGlzLmdsLnBvbHlnb25PZmZzZXQoc2xvcGVCaWFzLCBjb25zdEJpYXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgb3IgZGlzYWJsZXMgc3RlbmNpbCB0ZXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBlbmFibGUgLSBUcnVlIHRvIGVuYWJsZSBzdGVuY2lsIHRlc3QgYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICovXG4gICAgc2V0U3RlbmNpbFRlc3QoZW5hYmxlKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWwgIT09IGVuYWJsZSkge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgaWYgKGVuYWJsZSkge1xuICAgICAgICAgICAgICAgIGdsLmVuYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kaXNhYmxlKGdsLlNURU5DSUxfVEVTVCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWwgPSBlbmFibGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHN0ZW5jaWwgdGVzdCBmb3IgYm90aCBmcm9udCBhbmQgYmFjayBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmdW5jIC0gQSBjb21wYXJpc29uIGZ1bmN0aW9uIHRoYXQgZGVjaWRlcyBpZiB0aGUgcGl4ZWwgc2hvdWxkIGJlIHdyaXR0ZW4sXG4gICAgICogYmFzZWQgb24gdGhlIGN1cnJlbnQgc3RlbmNpbCBidWZmZXIgdmFsdWUsIHJlZmVyZW5jZSB2YWx1ZSwgYW5kIG1hc2sgdmFsdWUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTkVWRVJ9OiBuZXZlciBwYXNzXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfTogcGFzcyBpZiAocmVmICYgbWFzaykgPCAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID09IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spIDw9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgIT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPj0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfQUxXQVlTfTogYWx3YXlzIHBhc3NcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByZWYgLSBSZWZlcmVuY2UgdmFsdWUgdXNlZCBpbiBjb21wYXJpc29uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXNrIC0gTWFzayBhcHBsaWVkIHRvIHN0ZW5jaWwgYnVmZmVyIHZhbHVlIGFuZCByZWZlcmVuY2UgdmFsdWUgYmVmb3JlXG4gICAgICogY29tcGFyaXNvbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsRnVuYyhmdW5jLCByZWYsIG1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZ1bmNGcm9udCAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZGcm9udCAhPT0gcmVmIHx8IHRoaXMuc3RlbmNpbE1hc2tGcm9udCAhPT0gbWFzayB8fFxuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRnVuY0JhY2sgIT09IGZ1bmMgfHwgdGhpcy5zdGVuY2lsUmVmQmFjayAhPT0gcmVmIHx8IHRoaXMuc3RlbmNpbE1hc2tCYWNrICE9PSBtYXNrKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5zdGVuY2lsRnVuYyh0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSwgcmVmLCBtYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IHRoaXMuc3RlbmNpbEZ1bmNCYWNrID0gZnVuYztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFJlZkZyb250ID0gdGhpcy5zdGVuY2lsUmVmQmFjayA9IHJlZjtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IHRoaXMuc3RlbmNpbE1hc2tCYWNrID0gbWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgc3RlbmNpbCB0ZXN0IGZvciBmcm9udCBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmdW5jIC0gQSBjb21wYXJpc29uIGZ1bmN0aW9uIHRoYXQgZGVjaWRlcyBpZiB0aGUgcGl4ZWwgc2hvdWxkIGJlIHdyaXR0ZW4sXG4gICAgICogYmFzZWQgb24gdGhlIGN1cnJlbnQgc3RlbmNpbCBidWZmZXIgdmFsdWUsIHJlZmVyZW5jZSB2YWx1ZSwgYW5kIG1hc2sgdmFsdWUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTkVWRVJ9OiBuZXZlciBwYXNzXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfTogcGFzcyBpZiAocmVmICYgbWFzaykgPCAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID09IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spIDw9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgIT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPj0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfQUxXQVlTfTogYWx3YXlzIHBhc3NcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByZWYgLSBSZWZlcmVuY2UgdmFsdWUgdXNlZCBpbiBjb21wYXJpc29uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXNrIC0gTWFzayBhcHBsaWVkIHRvIHN0ZW5jaWwgYnVmZmVyIHZhbHVlIGFuZCByZWZlcmVuY2UgdmFsdWUgYmVmb3JlIGNvbXBhcmlzb24uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbEZ1bmNGcm9udChmdW5jLCByZWYsIG1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZ1bmNGcm9udCAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZGcm9udCAhPT0gcmVmIHx8IHRoaXMuc3RlbmNpbE1hc2tGcm9udCAhPT0gbWFzaykge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmNTZXBhcmF0ZShnbC5GUk9OVCwgdGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgPSBmdW5jO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsUmVmRnJvbnQgPSByZWY7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgPSBtYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBzdGVuY2lsIHRlc3QgZm9yIGJhY2sgZmFjZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZnVuYyAtIEEgY29tcGFyaXNvbiBmdW5jdGlvbiB0aGF0IGRlY2lkZXMgaWYgdGhlIHBpeGVsIHNob3VsZCBiZSB3cml0dGVuLFxuICAgICAqIGJhc2VkIG9uIHRoZSBjdXJyZW50IHN0ZW5jaWwgYnVmZmVyIHZhbHVlLCByZWZlcmVuY2UgdmFsdWUsIGFuZCBtYXNrIHZhbHVlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX05FVkVSfTogbmV2ZXIgcGFzc1xuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU306IHBhc3MgaWYgKHJlZiAmIG1hc2spIDwgKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA9PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfTogcGFzcyBpZiAocmVmICYgbWFzaykgPiAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spICE9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID49IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0FMV0FZU306IGFsd2F5cyBwYXNzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmVmIC0gUmVmZXJlbmNlIHZhbHVlIHVzZWQgaW4gY29tcGFyaXNvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFzayAtIE1hc2sgYXBwbGllZCB0byBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSBhbmQgcmVmZXJlbmNlIHZhbHVlIGJlZm9yZSBjb21wYXJpc29uLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxGdW5jQmFjayhmdW5jLCByZWYsIG1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZ1bmNCYWNrICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkJhY2sgIT09IHJlZiB8fCB0aGlzLnN0ZW5jaWxNYXNrQmFjayAhPT0gbWFzaykge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wuc3RlbmNpbEZ1bmNTZXBhcmF0ZShnbC5CQUNLLCB0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSwgcmVmLCBtYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNCYWNrID0gZnVuYztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFJlZkJhY2sgPSByZWY7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrQmFjayA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGhvdyBzdGVuY2lsIGJ1ZmZlciB2YWx1ZXMgc2hvdWxkIGJlIG1vZGlmaWVkIGJhc2VkIG9uIHRoZSByZXN1bHQgb2YgZGVwdGgvc3RlbmNpbFxuICAgICAqIHRlc3RzLiBXb3JrcyBmb3IgYm90aCBmcm9udCBhbmQgYmFjayBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgc3RlbmNpbCB0ZXN0IGlzIGZhaWxlZC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0tFRVB9OiBkb24ndCBjaGFuZ2UgdGhlIHN0ZW5jaWwgYnVmZmVyIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX1pFUk99OiBzZXQgdmFsdWUgdG8gemVyb1xuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9SRVBMQUNFfTogcmVwbGFjZSB2YWx1ZSB3aXRoIHRoZSByZWZlcmVuY2UgdmFsdWUgKHNlZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0U3RlbmNpbEZ1bmN9KVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlR9OiBpbmNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVFdSQVB9OiBpbmNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byB6ZXJvIHdoZW4gaXQncyBsYXJnZXJcbiAgICAgKiB0aGFuIGEgbWF4aW11bSByZXByZXNlbnRhYmxlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVH06IGRlY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUH06IGRlY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIGEgbWF4aW11bVxuICAgICAqIHJlcHJlc2VudGFibGUgdmFsdWUsIGlmIHRoZSBjdXJyZW50IHZhbHVlIGlzIDBcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5WRVJUfTogaW52ZXJ0IHRoZSB2YWx1ZSBiaXR3aXNlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gemZhaWwgLSBBY3Rpb24gdG8gdGFrZSBpZiBkZXB0aCB0ZXN0IGlzIGZhaWxlZC4gIEFjY2VwdHMgdGhlIHNhbWUgdmFsdWVzIGFzXG4gICAgICogYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6cGFzcyAtIEFjdGlvbiB0byB0YWtlIGlmIGJvdGggZGVwdGggYW5kIHN0ZW5jaWwgdGVzdCBhcmUgcGFzc2VkLiBBY2NlcHRzXG4gICAgICogdGhlIHNhbWUgdmFsdWVzIGFzIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd3JpdGVNYXNrIC0gQSBiaXQgbWFzayBhcHBsaWVkIHRvIHRoZSByZWZlcmVuY2UgdmFsdWUsIHdoZW4gd3JpdHRlbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsT3BlcmF0aW9uKGZhaWwsIHpmYWlsLCB6cGFzcywgd3JpdGVNYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgIT09IGZhaWwgfHwgdGhpcy5zdGVuY2lsWmZhaWxGcm9udCAhPT0gemZhaWwgfHwgdGhpcy5zdGVuY2lsWnBhc3NGcm9udCAhPT0genBhc3MgfHxcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZhaWxCYWNrICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsQmFjayAhPT0gemZhaWwgfHwgdGhpcy5zdGVuY2lsWnBhc3NCYWNrICE9PSB6cGFzcykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsT3AodGhpcy5nbFN0ZW5jaWxPcFtmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6ZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbenBhc3NdKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZhaWxGcm9udCA9IHRoaXMuc3RlbmNpbEZhaWxCYWNrID0gZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgPSB6ZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgIT09IHdyaXRlTWFzayB8fCB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrICE9PSB3cml0ZU1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE1hc2sod3JpdGVNYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ID0gd3JpdGVNYXNrO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgaG93IHN0ZW5jaWwgYnVmZmVyIHZhbHVlcyBzaG91bGQgYmUgbW9kaWZpZWQgYmFzZWQgb24gdGhlIHJlc3VsdCBvZiBkZXB0aC9zdGVuY2lsXG4gICAgICogdGVzdHMuIFdvcmtzIGZvciBmcm9udCBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgc3RlbmNpbCB0ZXN0IGlzIGZhaWxlZC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0tFRVB9OiBkb24ndCBjaGFuZ2UgdGhlIHN0ZW5jaWwgYnVmZmVyIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX1pFUk99OiBzZXQgdmFsdWUgdG8gemVyb1xuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9SRVBMQUNFfTogcmVwbGFjZSB2YWx1ZSB3aXRoIHRoZSByZWZlcmVuY2UgdmFsdWUgKHNlZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0U3RlbmNpbEZ1bmN9KVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlR9OiBpbmNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVFdSQVB9OiBpbmNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byB6ZXJvIHdoZW4gaXQncyBsYXJnZXJcbiAgICAgKiB0aGFuIGEgbWF4aW11bSByZXByZXNlbnRhYmxlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVH06IGRlY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUH06IGRlY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIGEgbWF4aW11bVxuICAgICAqIHJlcHJlc2VudGFibGUgdmFsdWUsIGlmIHRoZSBjdXJyZW50IHZhbHVlIGlzIDBcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5WRVJUfTogaW52ZXJ0IHRoZSB2YWx1ZSBiaXR3aXNlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gemZhaWwgLSBBY3Rpb24gdG8gdGFrZSBpZiBkZXB0aCB0ZXN0IGlzIGZhaWxlZC4gIEFjY2VwdHMgdGhlIHNhbWUgdmFsdWVzIGFzXG4gICAgICogYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6cGFzcyAtIEFjdGlvbiB0byB0YWtlIGlmIGJvdGggZGVwdGggYW5kIHN0ZW5jaWwgdGVzdCBhcmUgcGFzc2VkLiAgQWNjZXB0c1xuICAgICAqIHRoZSBzYW1lIHZhbHVlcyBhcyBgZmFpbGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdyaXRlTWFzayAtIEEgYml0IG1hc2sgYXBwbGllZCB0byB0aGUgcmVmZXJlbmNlIHZhbHVlLCB3aGVuIHdyaXR0ZW4uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbE9wZXJhdGlvbkZyb250KGZhaWwsIHpmYWlsLCB6cGFzcywgd3JpdGVNYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgIT09IGZhaWwgfHwgdGhpcy5zdGVuY2lsWmZhaWxGcm9udCAhPT0gemZhaWwgfHwgdGhpcy5zdGVuY2lsWnBhc3NGcm9udCAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wU2VwYXJhdGUodGhpcy5nbC5GUk9OVCwgdGhpcy5nbFN0ZW5jaWxPcFtmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6ZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbenBhc3NdKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZhaWxGcm9udCA9IGZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ID0genBhc3M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ICE9PSB3cml0ZU1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE1hc2tTZXBhcmF0ZSh0aGlzLmdsLkZST05ULCB3cml0ZU1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgPSB3cml0ZU1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIGhvdyBzdGVuY2lsIGJ1ZmZlciB2YWx1ZXMgc2hvdWxkIGJlIG1vZGlmaWVkIGJhc2VkIG9uIHRoZSByZXN1bHQgb2YgZGVwdGgvc3RlbmNpbFxuICAgICAqIHRlc3RzLiBXb3JrcyBmb3IgYmFjayBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmYWlsIC0gQWN0aW9uIHRvIHRha2UgaWYgc3RlbmNpbCB0ZXN0IGlzIGZhaWxlZC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0tFRVB9OiBkb24ndCBjaGFuZ2UgdGhlIHN0ZW5jaWwgYnVmZmVyIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX1pFUk99OiBzZXQgdmFsdWUgdG8gemVyb1xuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9SRVBMQUNFfTogcmVwbGFjZSB2YWx1ZSB3aXRoIHRoZSByZWZlcmVuY2UgdmFsdWUgKHNlZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0U3RlbmNpbEZ1bmN9KVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlR9OiBpbmNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVFdSQVB9OiBpbmNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byB6ZXJvIHdoZW4gaXQncyBsYXJnZXJcbiAgICAgKiB0aGFuIGEgbWF4aW11bSByZXByZXNlbnRhYmxlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVH06IGRlY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUH06IGRlY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIGEgbWF4aW11bVxuICAgICAqIHJlcHJlc2VudGFibGUgdmFsdWUsIGlmIHRoZSBjdXJyZW50IHZhbHVlIGlzIDBcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5WRVJUfTogaW52ZXJ0IHRoZSB2YWx1ZSBiaXR3aXNlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gemZhaWwgLSBBY3Rpb24gdG8gdGFrZSBpZiBkZXB0aCB0ZXN0IGlzIGZhaWxlZC4gQWNjZXB0cyB0aGUgc2FtZSB2YWx1ZXMgYXNcbiAgICAgKiBgZmFpbGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpwYXNzIC0gQWN0aW9uIHRvIHRha2UgaWYgYm90aCBkZXB0aCBhbmQgc3RlbmNpbCB0ZXN0IGFyZSBwYXNzZWQuIEFjY2VwdHNcbiAgICAgKiB0aGUgc2FtZSB2YWx1ZXMgYXMgYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3cml0ZU1hc2sgLSBBIGJpdCBtYXNrIGFwcGxpZWQgdG8gdGhlIHJlZmVyZW5jZSB2YWx1ZSwgd2hlbiB3cml0dGVuLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxPcGVyYXRpb25CYWNrKGZhaWwsIHpmYWlsLCB6cGFzcywgd3JpdGVNYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEJhY2sgPSBmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB3cml0ZU1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEJsZW5kU3RhdGUoYmxlbmRTdGF0ZSkge1xuICAgICAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICAgICAgaWYgKCFjdXJyZW50QmxlbmRTdGF0ZS5lcXVhbHMoYmxlbmRTdGF0ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gc3RhdGUgdmFsdWVzIHRvIHNldFxuICAgICAgICAgICAgY29uc3QgeyBibGVuZCwgY29sb3JPcCwgYWxwaGFPcCwgY29sb3JTcmNGYWN0b3IsIGNvbG9yRHN0RmFjdG9yLCBhbHBoYVNyY0ZhY3RvciwgYWxwaGFEc3RGYWN0b3IgfSA9IGJsZW5kU3RhdGU7XG5cbiAgICAgICAgICAgIC8vIGVuYWJsZSBibGVuZFxuICAgICAgICAgICAgaWYgKGN1cnJlbnRCbGVuZFN0YXRlLmJsZW5kICE9PSBibGVuZCkge1xuICAgICAgICAgICAgICAgIGlmIChibGVuZCkge1xuICAgICAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYmxlbmQgb3BzXG4gICAgICAgICAgICBpZiAoY3VycmVudEJsZW5kU3RhdGUuY29sb3JPcCAhPT0gY29sb3JPcCB8fCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYU9wICE9PSBhbHBoYU9wKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2xCbGVuZEVxdWF0aW9uID0gdGhpcy5nbEJsZW5kRXF1YXRpb247XG4gICAgICAgICAgICAgICAgZ2wuYmxlbmRFcXVhdGlvblNlcGFyYXRlKGdsQmxlbmRFcXVhdGlvbltjb2xvck9wXSwgZ2xCbGVuZEVxdWF0aW9uW2FscGhhT3BdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYmxlbmQgZmFjdG9yc1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yU3JjRmFjdG9yICE9PSBjb2xvclNyY0ZhY3RvciB8fCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvckRzdEZhY3RvciAhPT0gY29sb3JEc3RGYWN0b3IgfHxcbiAgICAgICAgICAgICAgICBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYVNyY0ZhY3RvciAhPT0gYWxwaGFTcmNGYWN0b3IgfHwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFEc3RGYWN0b3IgIT09IGFscGhhRHN0RmFjdG9yKSB7XG5cbiAgICAgICAgICAgICAgICBnbC5ibGVuZEZ1bmNTZXBhcmF0ZSh0aGlzLmdsQmxlbmRGdW5jdGlvbkNvbG9yW2NvbG9yU3JjRmFjdG9yXSwgdGhpcy5nbEJsZW5kRnVuY3Rpb25Db2xvcltjb2xvckRzdEZhY3Rvcl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb25BbHBoYVthbHBoYVNyY0ZhY3Rvcl0sIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uQWxwaGFbYWxwaGFEc3RGYWN0b3JdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY29sb3Igd3JpdGVcbiAgICAgICAgICAgIGlmIChjdXJyZW50QmxlbmRTdGF0ZS5hbGxXcml0ZSAhPT0gYmxlbmRTdGF0ZS5hbGxXcml0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuY29sb3JNYXNrKGJsZW5kU3RhdGUucmVkV3JpdGUsIGJsZW5kU3RhdGUuZ3JlZW5Xcml0ZSwgYmxlbmRTdGF0ZS5ibHVlV3JpdGUsIGJsZW5kU3RhdGUuYWxwaGFXcml0ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBpbnRlcm5hbCBzdGF0ZVxuICAgICAgICAgICAgY3VycmVudEJsZW5kU3RhdGUuY29weShibGVuZFN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBibGVuZGluZyBmYWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBUaGUgcmVkIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBUaGUgZ3JlZW4gY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIFRoZSBibHVlIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBUaGUgYWxwaGEgY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0QmxlbmRDb2xvcihyLCBnLCBiLCBhKSB7XG4gICAgICAgIGNvbnN0IGMgPSB0aGlzLmJsZW5kQ29sb3I7XG4gICAgICAgIGlmICgociAhPT0gYy5yKSB8fCAoZyAhPT0gYy5nKSB8fCAoYiAhPT0gYy5iKSB8fCAoYSAhPT0gYy5hKSkge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZENvbG9yKHIsIGcsIGIsIGEpO1xuICAgICAgICAgICAgYy5zZXQociwgZywgYiwgYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXREZXB0aFN0YXRlKGRlcHRoU3RhdGUpIHtcbiAgICAgICAgY29uc3QgY3VycmVudERlcHRoU3RhdGUgPSB0aGlzLmRlcHRoU3RhdGU7XG4gICAgICAgIGlmICghY3VycmVudERlcHRoU3RhdGUuZXF1YWxzKGRlcHRoU3RhdGUpKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgICAgIC8vIHdyaXRlXG4gICAgICAgICAgICBjb25zdCB3cml0ZSA9IGRlcHRoU3RhdGUud3JpdGU7XG4gICAgICAgICAgICBpZiAoY3VycmVudERlcHRoU3RhdGUud3JpdGUgIT09IHdyaXRlKSB7XG4gICAgICAgICAgICAgICAgZ2wuZGVwdGhNYXNrKHdyaXRlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaGFuZGxlIGNhc2Ugd2hlcmUgZGVwdGggdGVzdGluZyBpcyBvZmYsIGJ1dCBkZXB0aCB3cml0ZSBpcyBvbiA9PiBlbmFibGUgYWx3YXlzIHRlc3QgdG8gZGVwdGggd3JpdGVcbiAgICAgICAgICAgIC8vIE5vdGUgb24gV2ViR0wgQVBJIGJlaGF2aW9yOiBXaGVuIGRlcHRoIHRlc3RpbmcgaXMgZGlzYWJsZWQsIHdyaXRlcyB0byB0aGUgZGVwdGggYnVmZmVyIGFyZSBhbHNvIGRpc2FibGVkLlxuICAgICAgICAgICAgbGV0IHsgZnVuYywgdGVzdCB9ID0gZGVwdGhTdGF0ZTtcbiAgICAgICAgICAgIGlmICghdGVzdCAmJiB3cml0ZSkge1xuICAgICAgICAgICAgICAgIHRlc3QgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGZ1bmMgPSBGVU5DX0FMV0FZUztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGN1cnJlbnREZXB0aFN0YXRlLmZ1bmMgIT09IGZ1bmMpIHtcbiAgICAgICAgICAgICAgICBnbC5kZXB0aEZ1bmModGhpcy5nbENvbXBhcmlzb25bZnVuY10pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY3VycmVudERlcHRoU3RhdGUudGVzdCAhPT0gdGVzdCkge1xuICAgICAgICAgICAgICAgIGlmICh0ZXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmVuYWJsZShnbC5ERVBUSF9URVNUKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBnbC5kaXNhYmxlKGdsLkRFUFRIX1RFU1QpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIGludGVybmFsIHN0YXRlXG4gICAgICAgICAgICBjdXJyZW50RGVwdGhTdGF0ZS5jb3B5KGRlcHRoU3RhdGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgaG93IHRyaWFuZ2xlcyBhcmUgY3VsbGVkIGJhc2VkIG9uIHRoZWlyIGZhY2UgZGlyZWN0aW9uLiBUaGUgZGVmYXVsdCBjdWxsIG1vZGUgaXNcbiAgICAgKiB7QGxpbmsgQ1VMTEZBQ0VfQkFDS30uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY3VsbE1vZGUgLSBUaGUgY3VsbCBtb2RlIHRvIHNldC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfTk9ORX1cbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9CQUNLfVxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX0ZST05UfVxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX0ZST05UQU5EQkFDS31cbiAgICAgKi9cbiAgICBzZXRDdWxsTW9kZShjdWxsTW9kZSkge1xuICAgICAgICBpZiAodGhpcy5jdWxsTW9kZSAhPT0gY3VsbE1vZGUpIHtcbiAgICAgICAgICAgIGlmIChjdWxsTW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLkNVTExfRkFDRSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1bGxNb2RlID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuQ1VMTF9GQUNFKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlID0gdGhpcy5nbEN1bGxbY3VsbE1vZGVdO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1bGxGYWNlICE9PSBtb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuY3VsbEZhY2UobW9kZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VsbEZhY2UgPSBtb2RlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VsbE1vZGUgPSBjdWxsTW9kZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGN1cnJlbnQgY3VsbCBtb2RlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGN1cnJlbnQgY3VsbCBtb2RlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRDdWxsTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VsbE1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgYWN0aXZlIHNoYWRlciB0byBiZSB1c2VkIGR1cmluZyBzdWJzZXF1ZW50IGRyYXcgY2FsbHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBzZXQgdG8gYXNzaWduIHRvIHRoZSBkZXZpY2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNoYWRlciB3YXMgc3VjY2Vzc2Z1bGx5IHNldCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHNldFNoYWRlcihzaGFkZXIpIHtcbiAgICAgICAgaWYgKHNoYWRlciAhPT0gdGhpcy5zaGFkZXIpIHtcbiAgICAgICAgICAgIGlmIChzaGFkZXIuZmFpbGVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghc2hhZGVyLnJlYWR5ICYmICFzaGFkZXIuaW1wbC5maW5hbGl6ZSh0aGlzLCBzaGFkZXIpKSB7XG4gICAgICAgICAgICAgICAgc2hhZGVyLmZhaWxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNoYWRlciA9IHNoYWRlcjtcblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBhY3RpdmUgc2hhZGVyXG4gICAgICAgICAgICB0aGlzLmdsLnVzZVByb2dyYW0oc2hhZGVyLmltcGwuZ2xQcm9ncmFtKTtcblxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgdGhpcy5fc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSsrO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIHRoaXMuYXR0cmlidXRlc0ludmFsaWRhdGVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYSBzdXBwb3J0ZWQgSERSIHBpeGVsIGZvcm1hdCBnaXZlbiBhIHNldCBvZiBoYXJkd2FyZSBzdXBwb3J0IHJlcXVpcmVtZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJlZmVyTGFyZ2VzdCAtIElmIHRydWUsIHByZWZlciB0aGUgaGlnaGVzdCBwcmVjaXNpb24gZm9ybWF0LiBPdGhlcndpc2UgcHJlZmVyIHRoZSBsb3dlc3QgcHJlY2lzaW9uIGZvcm1hdC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHJlbmRlcmFibGUgLSBJZiB0cnVlLCBvbmx5IGluY2x1ZGUgcGl4ZWwgZm9ybWF0cyB0aGF0IGNhbiBiZSB1c2VkIGFzIHJlbmRlciB0YXJnZXRzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdXBkYXRhYmxlIC0gSWYgdHJ1ZSwgb25seSBpbmNsdWRlIGZvcm1hdHMgdGhhdCBjYW4gYmUgdXBkYXRlZCBieSB0aGUgQ1BVLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZmlsdGVyYWJsZSAtIElmIHRydWUsIG9ubHkgaW5jbHVkZSBmb3JtYXRzIHRoYXQgc3VwcG9ydCB0ZXh0dXJlIGZpbHRlcmluZy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBIRFIgcGl4ZWwgZm9ybWF0IG9yIG51bGwgaWYgdGhlcmUgYXJlIG5vbmUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEhkckZvcm1hdChwcmVmZXJMYXJnZXN0LCByZW5kZXJhYmxlLCB1cGRhdGFibGUsIGZpbHRlcmFibGUpIHtcbiAgICAgICAgLy8gTm90ZSB0aGF0IGZvciBXZWJHTDIsIFBJWEVMRk9STUFUX1JHQjE2RiBhbmQgUElYRUxGT1JNQVRfUkdCMzJGIGFyZSBub3QgcmVuZGVyYWJsZSBhY2NvcmRpbmcgdG8gdGhpczpcbiAgICAgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0VYVF9jb2xvcl9idWZmZXJfZmxvYXRcbiAgICAgICAgLy8gRm9yIFdlYkdMMSwgb25seSBQSVhFTEZPUk1BVF9SR0JBMTZGIGFuZCBQSVhFTEZPUk1BVF9SR0JBMzJGIGFyZSB0ZXN0ZWQgZm9yIGJlaW5nIHJlbmRlcmFibGUuXG4gICAgICAgIGNvbnN0IGYxNlZhbGlkID0gdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0ICYmXG4gICAgICAgICAgICAoIXJlbmRlcmFibGUgfHwgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSkgJiZcbiAgICAgICAgICAgICghdXBkYXRhYmxlIHx8IHRoaXMudGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSkgJiZcbiAgICAgICAgICAgICghZmlsdGVyYWJsZSB8fCB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIpO1xuICAgICAgICBjb25zdCBmMzJWYWxpZCA9IHRoaXMuZXh0VGV4dHVyZUZsb2F0ICYmXG4gICAgICAgICAgICAoIXJlbmRlcmFibGUgfHwgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlKSAmJlxuICAgICAgICAgICAgKCFmaWx0ZXJhYmxlIHx8IHRoaXMuZXh0VGV4dHVyZUZsb2F0TGluZWFyKTtcblxuICAgICAgICBpZiAoZjE2VmFsaWQgJiYgZjMyVmFsaWQpIHtcbiAgICAgICAgICAgIHJldHVybiBwcmVmZXJMYXJnZXN0ID8gUElYRUxGT1JNQVRfUkdCQTMyRiA6IFBJWEVMRk9STUFUX1JHQkExNkY7XG4gICAgICAgIH0gZWxzZSBpZiAoZjE2VmFsaWQpIHtcbiAgICAgICAgICAgIHJldHVybiBQSVhFTEZPUk1BVF9SR0JBMTZGO1xuICAgICAgICB9IGVsc2UgaWYgKGYzMlZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gUElYRUxGT1JNQVRfUkdCQTMyRjtcbiAgICAgICAgfSAvKiBlbHNlICovXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWVzIG1lbW9yeSBmcm9tIGFsbCB2ZXJ0ZXggYXJyYXkgb2JqZWN0cyBldmVyIGFsbG9jYXRlZCB3aXRoIHRoaXMgZGV2aWNlLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSgpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICB0aGlzLl92YW9NYXAuZm9yRWFjaCgoaXRlbSwga2V5LCBtYXBPYmopID0+IHtcbiAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5KGl0ZW0pO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl92YW9NYXAuY2xlYXIoKTtcbiAgICB9XG5cbiAgICByZXNpemVDYW52YXMod2lkdGgsIGhlaWdodCkge1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcblxuICAgICAgICBjb25zdCByYXRpbyA9IE1hdGgubWluKHRoaXMuX21heFBpeGVsUmF0aW8sIHBsYXRmb3JtLmJyb3dzZXIgPyB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbyA6IDEpO1xuICAgICAgICB3aWR0aCA9IE1hdGguZmxvb3Iod2lkdGggKiByYXRpbyk7XG4gICAgICAgIGhlaWdodCA9IE1hdGguZmxvb3IoaGVpZ2h0ICogcmF0aW8pO1xuXG4gICAgICAgIGlmICh0aGlzLmNhbnZhcy53aWR0aCAhPT0gd2lkdGggfHwgdGhpcy5jYW52YXMuaGVpZ2h0ICE9PSBoZWlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuY2FudmFzLndpZHRoID0gd2lkdGg7XG4gICAgICAgICAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICB0aGlzLmZpcmUoR3JhcGhpY3NEZXZpY2UuRVZFTlRfUkVTSVpFLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdpZHRoIG9mIHRoZSBiYWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2wuZHJhd2luZ0J1ZmZlcldpZHRoIHx8IHRoaXMuY2FudmFzLndpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlaWdodCBvZiB0aGUgYmFjayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nbC5kcmF3aW5nQnVmZmVySGVpZ2h0IHx8IHRoaXMuY2FudmFzLmhlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdWxsc2NyZWVuIG1vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZnVsbHNjcmVlbihmdWxsc2NyZWVuKSB7XG4gICAgICAgIGlmIChmdWxsc2NyZWVuKSB7XG4gICAgICAgICAgICBjb25zdCBjYW52YXMgPSB0aGlzLmdsLmNhbnZhcztcbiAgICAgICAgICAgIGNhbnZhcy5yZXF1ZXN0RnVsbHNjcmVlbigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9jdW1lbnQuZXhpdEZ1bGxzY3JlZW4oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmdWxsc2NyZWVuKCkge1xuICAgICAgICByZXR1cm4gISFkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBoaWdoIHByZWNpc2lvbiBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBhcmUgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24gPSB0ZXN0VGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbih0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiB0ZXh0dXJlIHdpdGggaGFsZiBmbG9hdCBmb3JtYXQgY2FuIGJlIHVwZGF0ZWQgd2l0aCBkYXRhLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdGVzdFRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUodGhpcy5nbCwgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0LkhBTEZfRkxPQVRfT0VTKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdsR3JhcGhpY3NEZXZpY2UgfTtcbiJdLCJuYW1lcyI6WyJpbnZhbGlkYXRlQXR0YWNobWVudHMiLCJfZnVsbFNjcmVlblF1YWRWUyIsIl9wcmVjaXNpb25UZXN0MVBTIiwiX3ByZWNpc2lvblRlc3QyUFMiLCJfb3V0cHV0VGV4dHVyZTJEIiwicXVhZFdpdGhTaGFkZXIiLCJkZXZpY2UiLCJ0YXJnZXQiLCJzaGFkZXIiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsIm9sZFJ0IiwicmVuZGVyVGFyZ2V0Iiwic2V0UmVuZGVyVGFyZ2V0IiwidXBkYXRlQmVnaW4iLCJzZXRDdWxsTW9kZSIsIkNVTExGQUNFX05PTkUiLCJzZXRCbGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsIkRFRkFVTFQiLCJzZXREZXB0aFN0YXRlIiwiRGVwdGhTdGF0ZSIsIk5PREVQVEgiLCJzZXRWZXJ0ZXhCdWZmZXIiLCJxdWFkVmVydGV4QnVmZmVyIiwic2V0U2hhZGVyIiwiZHJhdyIsInR5cGUiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJiYXNlIiwiY291bnQiLCJpbmRleGVkIiwidXBkYXRlRW5kIiwicG9wR3B1TWFya2VyIiwidGVzdFJlbmRlcmFibGUiLCJnbCIsInBpeGVsRm9ybWF0IiwicmVzdWx0IiwidGV4dHVyZSIsImNyZWF0ZVRleHR1cmUiLCJiaW5kVGV4dHVyZSIsIlRFWFRVUkVfMkQiLCJ0ZXhQYXJhbWV0ZXJpIiwiVEVYVFVSRV9NSU5fRklMVEVSIiwiTkVBUkVTVCIsIlRFWFRVUkVfTUFHX0ZJTFRFUiIsIlRFWFRVUkVfV1JBUF9TIiwiQ0xBTVBfVE9fRURHRSIsIlRFWFRVUkVfV1JBUF9UIiwidGV4SW1hZ2UyRCIsIlJHQkEiLCJmcmFtZWJ1ZmZlciIsImNyZWF0ZUZyYW1lYnVmZmVyIiwiYmluZEZyYW1lYnVmZmVyIiwiRlJBTUVCVUZGRVIiLCJmcmFtZWJ1ZmZlclRleHR1cmUyRCIsIkNPTE9SX0FUVEFDSE1FTlQwIiwiY2hlY2tGcmFtZWJ1ZmZlclN0YXR1cyIsIkZSQU1FQlVGRkVSX0NPTVBMRVRFIiwiZGVsZXRlVGV4dHVyZSIsImRlbGV0ZUZyYW1lYnVmZmVyIiwidGVzdFRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJkYXRhIiwiVWludDE2QXJyYXkiLCJnZXRFcnJvciIsIk5PX0VSUk9SIiwiY29uc29sZSIsImxvZyIsInRlc3RUZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uIiwidGV4dHVyZUZsb2F0UmVuZGVyYWJsZSIsInNoYWRlcjEiLCJTaGFkZXIiLCJTaGFkZXJVdGlscyIsImNyZWF0ZURlZmluaXRpb24iLCJuYW1lIiwidmVydGV4Q29kZSIsImZyYWdtZW50Q29kZSIsInNoYWRlcjIiLCJ0ZXh0dXJlT3B0aW9ucyIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJ3aWR0aCIsImhlaWdodCIsIm1pcG1hcHMiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIm1hZ0ZpbHRlciIsInRleDEiLCJUZXh0dXJlIiwidGFyZzEiLCJSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsImRlcHRoIiwiUElYRUxGT1JNQVRfUkdCQTgiLCJ0ZXgyIiwidGFyZzIiLCJjb25zdGFudFRleFNvdXJjZSIsInNldFZhbHVlIiwicHJldkZyYW1lYnVmZmVyIiwiYWN0aXZlRnJhbWVidWZmZXIiLCJzZXRGcmFtZWJ1ZmZlciIsImltcGwiLCJfZ2xGcmFtZUJ1ZmZlciIsInBpeGVscyIsIlVpbnQ4QXJyYXkiLCJyZWFkUGl4ZWxzIiwieCIsInkiLCJ6IiwidyIsImYiLCJkZXN0cm95IiwidGVzdEltYWdlQml0bWFwIiwicG5nQnl0ZXMiLCJjcmVhdGVJbWFnZUJpdG1hcCIsIkJsb2IiLCJwcmVtdWx0aXBseUFscGhhIiwidGhlbiIsImltYWdlIiwibGV2ZWxzIiwicnQiLCJpbml0UmVuZGVyVGFyZ2V0IiwiVWludDhDbGFtcGVkQXJyYXkiLCJVTlNJR05FRF9CWVRFIiwiY2F0Y2giLCJlIiwiV2ViZ2xHcmFwaGljc0RldmljZSIsIkdyYXBoaWNzRGV2aWNlIiwiY29uc3RydWN0b3IiLCJjYW52YXMiLCJvcHRpb25zIiwid2ViZ2wyIiwiZGVmYXVsdEZyYW1lYnVmZmVyIiwidXBkYXRlQ2xpZW50UmVjdCIsImNvbnRleHRMb3N0IiwiX2NvbnRleHRMb3N0SGFuZGxlciIsImV2ZW50IiwicHJldmVudERlZmF1bHQiLCJsb3NlQ29udGV4dCIsIkRlYnVnIiwiZmlyZSIsIl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyIiwicmVzdG9yZUNvbnRleHQiLCJzdGVuY2lsIiwicG93ZXJQcmVmZXJlbmNlIiwidWEiLCJuYXZpZ2F0b3IiLCJ1c2VyQWdlbnQiLCJmb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nIiwiaW5jbHVkZXMiLCJhbnRpYWxpYXMiLCJwcmVmZXJXZWJHbDIiLCJ1bmRlZmluZWQiLCJuYW1lcyIsImkiLCJsZW5ndGgiLCJnZXRDb250ZXh0IiwiREVWSUNFVFlQRV9XRUJHTDIiLCJfZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR0wxIiwiRXJyb3IiLCJhbHBoYUJpdHMiLCJnZXRQYXJhbWV0ZXIiLCJBTFBIQV9CSVRTIiwiZnJhbWVidWZmZXJGb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0I4IiwiaXNDaHJvbWUiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJ3aW5kb3ciLCJjaHJvbWUiLCJpc01hYyIsImFwcFZlcnNpb24iLCJpbmRleE9mIiwiX3RlbXBFbmFibGVTYWZhcmlUZXh0dXJlVW5pdFdvcmthcm91bmQiLCJzYWZhcmkiLCJfdGVtcE1hY0Nocm9tZUJsaXRGcmFtZWJ1ZmZlcldvcmthcm91bmQiLCJhbHBoYSIsInNldHVwVmVydGV4QXJyYXlPYmplY3QiLCJhZGRFdmVudExpc3RlbmVyIiwiaW5pdGlhbGl6ZUV4dGVuc2lvbnMiLCJpbml0aWFsaXplQ2FwYWJpbGl0aWVzIiwiaW5pdGlhbGl6ZVJlbmRlclN0YXRlIiwiaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMiLCJzdXBwb3J0c0ltYWdlQml0bWFwIiwiSW1hZ2VCaXRtYXAiLCJnbEFkZHJlc3MiLCJSRVBFQVQiLCJNSVJST1JFRF9SRVBFQVQiLCJnbEJsZW5kRXF1YXRpb24iLCJGVU5DX0FERCIsIkZVTkNfU1VCVFJBQ1QiLCJGVU5DX1JFVkVSU0VfU1VCVFJBQ1QiLCJNSU4iLCJleHRCbGVuZE1pbm1heCIsIk1JTl9FWFQiLCJNQVgiLCJNQVhfRVhUIiwiZ2xCbGVuZEZ1bmN0aW9uQ29sb3IiLCJaRVJPIiwiT05FIiwiU1JDX0NPTE9SIiwiT05FX01JTlVTX1NSQ19DT0xPUiIsIkRTVF9DT0xPUiIsIk9ORV9NSU5VU19EU1RfQ09MT1IiLCJTUkNfQUxQSEEiLCJTUkNfQUxQSEFfU0FUVVJBVEUiLCJPTkVfTUlOVVNfU1JDX0FMUEhBIiwiRFNUX0FMUEhBIiwiT05FX01JTlVTX0RTVF9BTFBIQSIsIkNPTlNUQU5UX0NPTE9SIiwiT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SIiwiZ2xCbGVuZEZ1bmN0aW9uQWxwaGEiLCJDT05TVEFOVF9BTFBIQSIsIk9ORV9NSU5VU19DT05TVEFOVF9BTFBIQSIsImdsQ29tcGFyaXNvbiIsIk5FVkVSIiwiTEVTUyIsIkVRVUFMIiwiTEVRVUFMIiwiR1JFQVRFUiIsIk5PVEVRVUFMIiwiR0VRVUFMIiwiQUxXQVlTIiwiZ2xTdGVuY2lsT3AiLCJLRUVQIiwiUkVQTEFDRSIsIklOQ1IiLCJJTkNSX1dSQVAiLCJERUNSIiwiREVDUl9XUkFQIiwiSU5WRVJUIiwiZ2xDbGVhckZsYWciLCJDT0xPUl9CVUZGRVJfQklUIiwiREVQVEhfQlVGRkVSX0JJVCIsIlNURU5DSUxfQlVGRkVSX0JJVCIsImdsQ3VsbCIsIkJBQ0siLCJGUk9OVCIsIkZST05UX0FORF9CQUNLIiwiZ2xGaWx0ZXIiLCJMSU5FQVIiLCJORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiTElORUFSX01JUE1BUF9ORUFSRVNUIiwiTElORUFSX01JUE1BUF9MSU5FQVIiLCJnbFByaW1pdGl2ZSIsIlBPSU5UUyIsIkxJTkVTIiwiTElORV9MT09QIiwiTElORV9TVFJJUCIsIlRSSUFOR0xFUyIsIlRSSUFOR0xFX1NUUklQIiwiVFJJQU5HTEVfRkFOIiwiZ2xUeXBlIiwiQllURSIsIlNIT1JUIiwiVU5TSUdORURfU0hPUlQiLCJJTlQiLCJVTlNJR05FRF9JTlQiLCJGTE9BVCIsInBjVW5pZm9ybVR5cGUiLCJCT09MIiwiVU5JRk9STVRZUEVfQk9PTCIsIlVOSUZPUk1UWVBFX0lOVCIsIlVOSUZPUk1UWVBFX0ZMT0FUIiwiRkxPQVRfVkVDMiIsIlVOSUZPUk1UWVBFX1ZFQzIiLCJGTE9BVF9WRUMzIiwiVU5JRk9STVRZUEVfVkVDMyIsIkZMT0FUX1ZFQzQiLCJVTklGT1JNVFlQRV9WRUM0IiwiSU5UX1ZFQzIiLCJVTklGT1JNVFlQRV9JVkVDMiIsIklOVF9WRUMzIiwiVU5JRk9STVRZUEVfSVZFQzMiLCJJTlRfVkVDNCIsIlVOSUZPUk1UWVBFX0lWRUM0IiwiQk9PTF9WRUMyIiwiVU5JRk9STVRZUEVfQlZFQzIiLCJCT09MX1ZFQzMiLCJVTklGT1JNVFlQRV9CVkVDMyIsIkJPT0xfVkVDNCIsIlVOSUZPUk1UWVBFX0JWRUM0IiwiRkxPQVRfTUFUMiIsIlVOSUZPUk1UWVBFX01BVDIiLCJGTE9BVF9NQVQzIiwiVU5JRk9STVRZUEVfTUFUMyIsIkZMT0FUX01BVDQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiU0FNUExFUl8yRCIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRCIsIlNBTVBMRVJfQ1VCRSIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFIiwiU0FNUExFUl8yRF9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XIiwiU0FNUExFUl9DVUJFX1NIQURPVyIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVyIsIlNBTVBMRVJfM0QiLCJVTklGT1JNVFlQRV9URVhUVVJFM0QiLCJ0YXJnZXRUb1Nsb3QiLCJURVhUVVJFX0NVQkVfTUFQIiwiVEVYVFVSRV8zRCIsInNjb3BlWCIsInNjb3BlWSIsInNjb3BlWiIsInNjb3BlVyIsInVuaWZvcm1WYWx1ZSIsImNvbW1pdEZ1bmN0aW9uIiwidW5pZm9ybSIsInZhbHVlIiwidW5pZm9ybTFpIiwibG9jYXRpb25JZCIsInVuaWZvcm0xZiIsInVuaWZvcm0yZnYiLCJ1bmlmb3JtM2Z2IiwidW5pZm9ybTRmdiIsInVuaWZvcm0yaXYiLCJ1bmlmb3JtM2l2IiwidW5pZm9ybTRpdiIsInVuaWZvcm1NYXRyaXgyZnYiLCJ1bmlmb3JtTWF0cml4M2Z2IiwidW5pZm9ybU1hdHJpeDRmdiIsIlVOSUZPUk1UWVBFX0ZMT0FUQVJSQVkiLCJ1bmlmb3JtMWZ2IiwiVU5JRk9STVRZUEVfVkVDMkFSUkFZIiwiVU5JRk9STVRZUEVfVkVDM0FSUkFZIiwiVU5JRk9STVRZUEVfVkVDNEFSUkFZIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJleHRUZXh0dXJlRmxvYXQiLCJtYXhWZXJ0ZXhUZXh0dXJlcyIsIm51bVVuaWZvcm1zIiwidmVydGV4VW5pZm9ybXNDb3VudCIsImJvbmVMaW1pdCIsIk1hdGgiLCJmbG9vciIsIm1pbiIsInVubWFza2VkUmVuZGVyZXIiLCJzY29wZSIsInJlc29sdmUiLCJleHRDb2xvckJ1ZmZlckZsb2F0IiwiZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsImV4dFRleHR1cmVIYWxmRmxvYXQiLCJIQUxGX0ZMT0FUX09FUyIsInN1cHBvcnRzTW9ycGhUYXJnZXRUZXh0dXJlc0NvcmUiLCJtYXhQcmVjaXNpb24iLCJzdXBwb3J0c0RlcHRoU2hhZG93IiwiX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iLCJfdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImFyZWFMaWdodEx1dEZvcm1hdCIsInRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJleHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsImV4dFRleHR1cmVGbG9hdExpbmVhciIsInBvc3RJbml0IiwiZmVlZGJhY2siLCJkZWxldGVUcmFuc2Zvcm1GZWVkYmFjayIsImNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJwb3N0RGVzdHJveSIsImNyZWF0ZVZlcnRleEJ1ZmZlckltcGwiLCJ2ZXJ0ZXhCdWZmZXIiLCJXZWJnbFZlcnRleEJ1ZmZlciIsImNyZWF0ZUluZGV4QnVmZmVySW1wbCIsImluZGV4QnVmZmVyIiwiV2ViZ2xJbmRleEJ1ZmZlciIsImNyZWF0ZVNoYWRlckltcGwiLCJXZWJnbFNoYWRlciIsImNyZWF0ZVRleHR1cmVJbXBsIiwiV2ViZ2xUZXh0dXJlIiwiY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbCIsIldlYmdsUmVuZGVyVGFyZ2V0IiwicHVzaE1hcmtlciIsInNwZWN0b3IiLCJsYWJlbCIsInRvU3RyaW5nIiwic2V0TWFya2VyIiwicG9wTWFya2VyIiwiY2xlYXJNYXJrZXIiLCJnZXRQcmVjaXNpb24iLCJwcmVjaXNpb24iLCJnZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQiLCJ2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0IiwiVkVSVEVYX1NIQURFUiIsIkhJR0hfRkxPQVQiLCJ2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQiLCJNRURJVU1fRkxPQVQiLCJmcmFnbWVudFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQiLCJGUkFHTUVOVF9TSEFERVIiLCJmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCIsImhpZ2hwQXZhaWxhYmxlIiwibWVkaXVtcEF2YWlsYWJsZSIsIndhcm4iLCJnZXRFeHRlbnNpb24iLCJhcmd1bWVudHMiLCJzdXBwb3J0ZWRFeHRlbnNpb25zIiwiZXh0RGlzam9pbnRUaW1lclF1ZXJ5IiwiX2V4dERpc2pvaW50VGltZXJRdWVyeSIsImdldFN1cHBvcnRlZEV4dGVuc2lvbnMiLCJleHREcmF3QnVmZmVycyIsImV4dEluc3RhbmNpbmciLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwiZXh0VGV4dHVyZUxvZCIsImV4dFVpbnRFbGVtZW50IiwiZXh0VmVydGV4QXJyYXlPYmplY3QiLCJleHREZXB0aFRleHR1cmUiLCJleHQiLCJkcmF3QXJyYXlzSW5zdGFuY2VkIiwiZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFIiwiYmluZCIsImRyYXdFbGVtZW50c0luc3RhbmNlZCIsImRyYXdFbGVtZW50c0luc3RhbmNlZEFOR0xFIiwidmVydGV4QXR0cmliRGl2aXNvciIsInZlcnRleEF0dHJpYkRpdmlzb3JBTkdMRSIsImNyZWF0ZVZlcnRleEFycmF5IiwiY3JlYXRlVmVydGV4QXJyYXlPRVMiLCJkZWxldGVWZXJ0ZXhBcnJheSIsImRlbGV0ZVZlcnRleEFycmF5T0VTIiwiaXNWZXJ0ZXhBcnJheSIsImlzVmVydGV4QXJyYXlPRVMiLCJiaW5kVmVydGV4QXJyYXkiLCJiaW5kVmVydGV4QXJyYXlPRVMiLCJleHREZWJ1Z1JlbmRlcmVySW5mbyIsImV4dEZsb2F0QmxlbmQiLCJleHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQzEiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZVMzVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyIsImV4dFBhcmFsbGVsU2hhZGVyQ29tcGlsZSIsImNvbnRleHRBdHRyaWJzIiwiZ2V0Q29udGV4dEF0dHJpYnV0ZXMiLCJzdXBwb3J0c01zYWEiLCJzdXBwb3J0c1N0ZW5jaWwiLCJzdXBwb3J0c0luc3RhbmNpbmciLCJtYXhUZXh0dXJlU2l6ZSIsIk1BWF9URVhUVVJFX1NJWkUiLCJtYXhDdWJlTWFwU2l6ZSIsIk1BWF9DVUJFX01BUF9URVhUVVJFX1NJWkUiLCJtYXhSZW5kZXJCdWZmZXJTaXplIiwiTUFYX1JFTkRFUkJVRkZFUl9TSVpFIiwibWF4VGV4dHVyZXMiLCJNQVhfVEVYVFVSRV9JTUFHRV9VTklUUyIsIm1heENvbWJpbmVkVGV4dHVyZXMiLCJNQVhfQ09NQklORURfVEVYVFVSRV9JTUFHRV9VTklUUyIsIk1BWF9WRVJURVhfVEVYVFVSRV9JTUFHRV9VTklUUyIsIk1BWF9WRVJURVhfVU5JRk9STV9WRUNUT1JTIiwiZnJhZ21lbnRVbmlmb3Jtc0NvdW50IiwiTUFYX0ZSQUdNRU5UX1VOSUZPUk1fVkVDVE9SUyIsIm1heERyYXdCdWZmZXJzIiwiTUFYX0RSQVdfQlVGRkVSUyIsIm1heENvbG9yQXR0YWNobWVudHMiLCJNQVhfQ09MT1JfQVRUQUNITUVOVFMiLCJtYXhWb2x1bWVTaXplIiwiTUFYXzNEX1RFWFRVUkVfU0laRSIsIk1BWF9EUkFXX0JVRkZFUlNfRVhUIiwiTUFYX0NPTE9SX0FUVEFDSE1FTlRTX0VYVCIsIlVOTUFTS0VEX1JFTkRFUkVSX1dFQkdMIiwidW5tYXNrZWRWZW5kb3IiLCJVTk1BU0tFRF9WRU5ET1JfV0VCR0wiLCJzYW1zdW5nTW9kZWxSZWdleCIsInN1cHBvcnRzR3B1UGFydGljbGVzIiwibWF0Y2giLCJtYXhBbmlzb3Ryb3B5IiwiTUFYX1RFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUIiwic2FtcGxlcyIsIlNBTVBMRVMiLCJtYXhTYW1wbGVzIiwiTUFYX1NBTVBMRVMiLCJzdXBwb3J0c0FyZWFMaWdodHMiLCJhbmRyb2lkIiwic3VwcG9ydHNUZXh0dXJlRmV0Y2giLCJkaXNhYmxlIiwiQkxFTkQiLCJibGVuZEZ1bmMiLCJibGVuZEVxdWF0aW9uIiwiY29sb3JNYXNrIiwiYmxlbmRDb2xvciIsIkNvbG9yIiwiY3VsbE1vZGUiLCJDVUxMRkFDRV9CQUNLIiwiZW5hYmxlIiwiQ1VMTF9GQUNFIiwiY3VsbEZhY2UiLCJERVBUSF9URVNUIiwiZGVwdGhGdW5jIiwiZGVwdGhNYXNrIiwiU1RFTkNJTF9URVNUIiwic3RlbmNpbEZ1bmNGcm9udCIsInN0ZW5jaWxGdW5jQmFjayIsIkZVTkNfQUxXQVlTIiwic3RlbmNpbFJlZkZyb250Iiwic3RlbmNpbFJlZkJhY2siLCJzdGVuY2lsTWFza0Zyb250Iiwic3RlbmNpbE1hc2tCYWNrIiwic3RlbmNpbEZ1bmMiLCJzdGVuY2lsRmFpbEZyb250Iiwic3RlbmNpbEZhaWxCYWNrIiwiU1RFTkNJTE9QX0tFRVAiLCJzdGVuY2lsWmZhaWxGcm9udCIsInN0ZW5jaWxaZmFpbEJhY2siLCJzdGVuY2lsWnBhc3NGcm9udCIsInN0ZW5jaWxacGFzc0JhY2siLCJzdGVuY2lsV3JpdGVNYXNrRnJvbnQiLCJzdGVuY2lsV3JpdGVNYXNrQmFjayIsInN0ZW5jaWxPcCIsInN0ZW5jaWxNYXNrIiwiYWxwaGFUb0NvdmVyYWdlIiwicmFzdGVyIiwiU0FNUExFX0FMUEhBX1RPX0NPVkVSQUdFIiwiUkFTVEVSSVpFUl9ESVNDQVJEIiwiZGVwdGhCaWFzRW5hYmxlZCIsIlBPTFlHT05fT0ZGU0VUX0ZJTEwiLCJjbGVhckRlcHRoIiwiY2xlYXJDb2xvciIsImNsZWFyU3RlbmNpbCIsImhpbnQiLCJGUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5UIiwiTklDRVNUIiwiRlJBR01FTlRfU0hBREVSX0RFUklWQVRJVkVfSElOVF9PRVMiLCJTQ0lTU09SX1RFU1QiLCJwaXhlbFN0b3JlaSIsIlVOUEFDS19DT0xPUlNQQUNFX0NPTlZFUlNJT05fV0VCR0wiLCJOT05FIiwidW5wYWNrRmxpcFkiLCJVTlBBQ0tfRkxJUF9ZX1dFQkdMIiwidW5wYWNrUHJlbXVsdGlwbHlBbHBoYSIsIlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCIsIlVOUEFDS19BTElHTk1FTlQiLCJfdmFvTWFwIiwiTWFwIiwiYm91bmRWYW8iLCJ0cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciIsInRleHR1cmVVbml0IiwidGV4dHVyZVVuaXRzIiwicHVzaCIsInNoYWRlcnMiLCJ0ZXh0dXJlcyIsImJ1ZmZlciIsImJ1ZmZlcnMiLCJ0YXJnZXRzIiwidW5sb2NrIiwiZW5kU2hhZGVyQmF0Y2giLCJzZXRWaWV3cG9ydCIsImgiLCJ2eCIsInZ5IiwidnciLCJ2aCIsInZpZXdwb3J0Iiwic2V0U2Npc3NvciIsInN4Iiwic3kiLCJzdyIsInNoIiwic2Npc3NvciIsImZiIiwiY29weVJlbmRlclRhcmdldCIsInNvdXJjZSIsImRlc3QiLCJjb2xvciIsImVycm9yIiwiX2NvbG9yQnVmZmVyIiwiX2Zvcm1hdCIsIl9kZXB0aCIsIl9kZXB0aEJ1ZmZlciIsInByZXZSdCIsIlJFQURfRlJBTUVCVUZGRVIiLCJEUkFXX0ZSQU1FQlVGRkVSIiwiYmxpdEZyYW1lYnVmZmVyIiwiZ2V0Q29weVNoYWRlciIsIl9jb3B5U2hhZGVyIiwic3RhcnRQYXNzIiwicmVuZGVyUGFzcyIsImNvbG9yT3BzIiwiZGVwdGhTdGVuY2lsT3BzIiwiY2xlYXIiLCJjbGVhckZsYWdzIiwiY2xlYXJPcHRpb25zIiwiQ0xFQVJGTEFHX0NPTE9SIiwiY2xlYXJWYWx1ZSIsInIiLCJnIiwiYiIsImEiLCJDTEVBUkZMQUdfREVQVEgiLCJjbGVhckRlcHRoVmFsdWUiLCJDTEVBUkZMQUdfU1RFTkNJTCIsImNsZWFyU3RlbmNpbFZhbHVlIiwiZmxhZ3MiLCJjYWxsIiwiaW5zaWRlUmVuZGVyUGFzcyIsImVycm9yT25jZSIsImVuZFBhc3MiLCJ1bmJpbmRWZXJ0ZXhBcnJheSIsInN0b3JlIiwic3RvcmVEZXB0aCIsIkRFUFRIX0FUVEFDSE1FTlQiLCJzdG9yZVN0ZW5jaWwiLCJTVEVOQ0lMX0FUVEFDSE1FTlQiLCJmdWxsU2l6ZUNsZWFyUmVjdCIsImludmFsaWRhdGVGcmFtZWJ1ZmZlciIsImF1dG9SZXNvbHZlIiwiX2dsVGV4dHVyZSIsInBvdCIsImFjdGl2ZVRleHR1cmUiLCJnZW5lcmF0ZU1pcG1hcCIsIl9nbFRhcmdldCIsInVuaXQiLCJzbG90IiwiaW5pdGlhbGl6ZWQiLCJfc2FtcGxlcyIsInNldFVucGFja0ZsaXBZIiwiZmxpcFkiLCJzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhIiwiVEVYVFVSRTAiLCJ0ZXh0dXJlVGFyZ2V0IiwidGV4dHVyZU9iamVjdCIsImJpbmRUZXh0dXJlT25Vbml0Iiwic2V0VGV4dHVyZVBhcmFtZXRlcnMiLCJfcGFyYW1ldGVyRmxhZ3MiLCJmaWx0ZXIiLCJfbWluRmlsdGVyIiwiX21pcG1hcHMiLCJfY29tcHJlc3NlZCIsIl9sZXZlbHMiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUiIsIl9tYWdGaWx0ZXIiLCJfYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJfYWRkcmVzc1YiLCJURVhUVVJFX1dSQVBfUiIsIl9hZGRyZXNzVyIsIlRFWFRVUkVfQ09NUEFSRV9NT0RFIiwiX2NvbXBhcmVPblJlYWQiLCJDT01QQVJFX1JFRl9UT19URVhUVVJFIiwiVEVYVFVSRV9DT01QQVJFX0ZVTkMiLCJfY29tcGFyZUZ1bmMiLCJ0ZXhQYXJhbWV0ZXJmIiwiVEVYVFVSRV9NQVhfQU5JU09UUk9QWV9FWFQiLCJtYXgiLCJyb3VuZCIsIl9hbmlzb3Ryb3B5Iiwic2V0VGV4dHVyZSIsImluaXRpYWxpemUiLCJfbmVlZHNVcGxvYWQiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwidXBsb2FkIiwidmVydGV4QnVmZmVycyIsImtleSIsInZhbyIsInVzZUNhY2hlIiwiaWQiLCJyZW5kZXJpbmdIYXNoIiwiZ2V0IiwiYmluZEJ1ZmZlciIsIkVMRU1FTlRfQVJSQVlfQlVGRkVSIiwibG9jWmVybyIsIkFSUkFZX0JVRkZFUiIsImJ1ZmZlcklkIiwiZWxlbWVudHMiLCJqIiwibG9jIiwic2VtYW50aWNUb0xvY2F0aW9uIiwidmVydGV4QXR0cmliUG9pbnRlciIsIm51bUNvbXBvbmVudHMiLCJkYXRhVHlwZSIsIm5vcm1hbGl6ZSIsInN0cmlkZSIsIm9mZnNldCIsImVuYWJsZVZlcnRleEF0dHJpYkFycmF5IiwiaW5zdGFuY2luZyIsInNldCIsInNldEJ1ZmZlcnMiLCJhc3NlcnQiLCJwcmltaXRpdmUiLCJudW1JbnN0YW5jZXMiLCJrZWVwQnVmZmVycyIsInNhbXBsZXIiLCJzYW1wbGVyVmFsdWUiLCJudW1UZXh0dXJlcyIsInNjb3BlSWQiLCJ1bmlmb3JtVmVyc2lvbiIsInByb2dyYW1WZXJzaW9uIiwic2FtcGxlcnMiLCJ1bmlmb3JtcyIsImxlbiIsInNhbXBsZXJOYW1lIiwid2Fybk9uY2UiLCJkZXB0aEJ1ZmZlciIsImFycmF5IiwidW5pZm9ybTFpdiIsInZlcnNpb24iLCJ2ZXJzaW9uT2JqZWN0IiwiZ2xvYmFsSWQiLCJyZXZpc2lvbiIsImJpbmRCdWZmZXJCYXNlIiwiVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiIsImJlZ2luVHJhbnNmb3JtRmVlZGJhY2siLCJtb2RlIiwiZ2xGb3JtYXQiLCJieXRlc1BlckluZGV4IiwiZHJhd0VsZW1lbnRzIiwiZmlyc3QiLCJkcmF3QXJyYXlzIiwiZW5kVHJhbnNmb3JtRmVlZGJhY2siLCJfZHJhd0NhbGxzUGVyRnJhbWUiLCJfcHJpbXNQZXJGcmFtZSIsImRlZmF1bHRPcHRpb25zIiwiZGVmYXVsdENsZWFyT3B0aW9ucyIsImMiLCJXUklURURFUFRIIiwic2V0QWxwaGFUb0NvdmVyYWdlIiwic3RhdGUiLCJzZXRUcmFuc2Zvcm1GZWVkYmFja0J1ZmZlciIsInRmIiwiY3JlYXRlVHJhbnNmb3JtRmVlZGJhY2siLCJiaW5kVHJhbnNmb3JtRmVlZGJhY2siLCJUUkFOU0ZPUk1fRkVFREJBQ0siLCJzZXRSYXN0ZXIiLCJvbiIsInNldERlcHRoQmlhcyIsInNldERlcHRoQmlhc1ZhbHVlcyIsImNvbnN0QmlhcyIsInNsb3BlQmlhcyIsInBvbHlnb25PZmZzZXQiLCJzZXRTdGVuY2lsVGVzdCIsInNldFN0ZW5jaWxGdW5jIiwiZnVuYyIsInJlZiIsIm1hc2siLCJzZXRTdGVuY2lsRnVuY0Zyb250Iiwic3RlbmNpbEZ1bmNTZXBhcmF0ZSIsInNldFN0ZW5jaWxGdW5jQmFjayIsInNldFN0ZW5jaWxPcGVyYXRpb24iLCJmYWlsIiwiemZhaWwiLCJ6cGFzcyIsIndyaXRlTWFzayIsInNldFN0ZW5jaWxPcGVyYXRpb25Gcm9udCIsInN0ZW5jaWxPcFNlcGFyYXRlIiwic3RlbmNpbE1hc2tTZXBhcmF0ZSIsInNldFN0ZW5jaWxPcGVyYXRpb25CYWNrIiwiYmxlbmRTdGF0ZSIsImN1cnJlbnRCbGVuZFN0YXRlIiwiZXF1YWxzIiwiYmxlbmQiLCJjb2xvck9wIiwiYWxwaGFPcCIsImNvbG9yU3JjRmFjdG9yIiwiY29sb3JEc3RGYWN0b3IiLCJhbHBoYVNyY0ZhY3RvciIsImFscGhhRHN0RmFjdG9yIiwiYmxlbmRFcXVhdGlvblNlcGFyYXRlIiwiYmxlbmRGdW5jU2VwYXJhdGUiLCJhbGxXcml0ZSIsInJlZFdyaXRlIiwiZ3JlZW5Xcml0ZSIsImJsdWVXcml0ZSIsImFscGhhV3JpdGUiLCJjb3B5Iiwic2V0QmxlbmRDb2xvciIsImRlcHRoU3RhdGUiLCJjdXJyZW50RGVwdGhTdGF0ZSIsIndyaXRlIiwidGVzdCIsImdldEN1bGxNb2RlIiwiZmFpbGVkIiwicmVhZHkiLCJmaW5hbGl6ZSIsInVzZVByb2dyYW0iLCJnbFByb2dyYW0iLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsImF0dHJpYnV0ZXNJbnZhbGlkYXRlZCIsImdldEhkckZvcm1hdCIsInByZWZlckxhcmdlc3QiLCJyZW5kZXJhYmxlIiwidXBkYXRhYmxlIiwiZmlsdGVyYWJsZSIsImYxNlZhbGlkIiwiZjMyVmFsaWQiLCJmb3JFYWNoIiwiaXRlbSIsIm1hcE9iaiIsInJlc2l6ZUNhbnZhcyIsIl93aWR0aCIsIl9oZWlnaHQiLCJyYXRpbyIsIl9tYXhQaXhlbFJhdGlvIiwiZGV2aWNlUGl4ZWxSYXRpbyIsIkVWRU5UX1JFU0laRSIsImRyYXdpbmdCdWZmZXJXaWR0aCIsImRyYXdpbmdCdWZmZXJIZWlnaHQiLCJmdWxsc2NyZWVuIiwicmVxdWVzdEZ1bGxzY3JlZW4iLCJkb2N1bWVudCIsImV4aXRGdWxsc2NyZWVuIiwiZnVsbHNjcmVlbkVsZW1lbnQiLCJ0ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3Q0EsTUFBTUEscUJBQXFCLEdBQUcsRUFBRSxDQUFBO0FBRWhDLE1BQU1DLGlCQUFpQixhQUFjLENBQUE7QUFDckM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLENBQUE7QUFFRCxNQUFNQyxpQkFBaUIsYUFBYyxDQUFBO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FBQTtBQUVELE1BQU1DLGlCQUFpQixhQUFjLENBQUE7QUFDckM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLENBQUE7QUFFRCxNQUFNQyxnQkFBZ0IsYUFBYyxDQUFBO0FBQ3BDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLENBQUE7QUFFRCxTQUFTQyxjQUFjLENBQUNDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxNQUFNLEVBQUU7QUFFNUNDLEVBQUFBLGFBQWEsQ0FBQ0MsYUFBYSxDQUFDSixNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQTtBQUVyRCxFQUFBLE1BQU1LLEtBQUssR0FBR0wsTUFBTSxDQUFDTSxZQUFZLENBQUE7QUFDakNOLEVBQUFBLE1BQU0sQ0FBQ08sZUFBZSxDQUFDTixNQUFNLENBQUMsQ0FBQTtFQUM5QkQsTUFBTSxDQUFDUSxXQUFXLEVBQUUsQ0FBQTtBQUVwQlIsRUFBQUEsTUFBTSxDQUFDUyxXQUFXLENBQUNDLGFBQWEsQ0FBQyxDQUFBO0FBQ2pDVixFQUFBQSxNQUFNLENBQUNXLGFBQWEsQ0FBQ0MsVUFBVSxDQUFDQyxPQUFPLENBQUMsQ0FBQTtBQUN4Q2IsRUFBQUEsTUFBTSxDQUFDYyxhQUFhLENBQUNDLFVBQVUsQ0FB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QUFDeUMsT0FBTyxFQUFFLENBQUE7RUFDakJsQyxPQUFPLENBQUNrQyxPQUFPLEVBQUUsQ0FBQTtFQUVqQixPQUFPRCxDQUFDLEtBQUssQ0FBQyxDQUFBO0FBQ2xCLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EsU0FBU0UsZUFBZSxDQUFDMUcsTUFBTSxFQUFFO0FBQzdCO0FBQ0EsRUFBQSxNQUFNMkcsUUFBUSxHQUFHLElBQUlULFVBQVUsQ0FBQyxDQUM1QixHQUFHLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQzNHLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUM3RyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFF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
