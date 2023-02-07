/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { setupVertexArrayObject } from '../../../polyfill/OESVertexArrayObject.js';
import { Debug } from '../../../core/debug.js';
import { platform } from '../../../core/platform.js';
import { Color } from '../../../core/math/color.js';
import { DEVICETYPE_WEBGL, PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, BLENDMODE_ONE, BLENDMODE_ZERO, BLENDEQUATION_ADD, CULLFACE_BACK, FUNC_LESSEQUAL, FUNC_ALWAYS, STENCILOP_KEEP, ADDRESS_CLAMP_TO_EDGE, semanticToLocation, CLEARFLAG_STENCIL, CULLFACE_NONE, PRIMITIVE_TRISTRIP, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR } from '../constants.js';
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
  const oldDepthTest = device.getDepthTest();
  const oldDepthWrite = device.getDepthWrite();
  const oldCullMode = device.getCullMode();
  const oldWR = device.writeRed;
  const oldWG = device.writeGreen;
  const oldWB = device.writeBlue;
  const oldWA = device.writeAlpha;
  device.setDepthTest(false);
  device.setDepthWrite(false);
  device.setCullMode(CULLFACE_NONE);
  device.setColorWrite(true, true, true, true);
  device.setVertexBuffer(device.quadVertexBuffer, 0);
  device.setShader(shader);
  device.draw({
    type: PRIMITIVE_TRISTRIP,
    base: 0,
    count: 4,
    indexed: false
  });
  device.setDepthTest(oldDepthTest);
  device.setDepthWrite(oldDepthWrite);
  device.setCullMode(oldCullMode);
  device.setColorWrite(oldWR, oldWG, oldWB, oldWA);
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
    this.deviceType = DEVICETYPE_WEBGL;
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
        this.webgl2 = names[i] === 'webgl2';
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

  /**
   * Initialize the extensions provided by the WebGL context.
   *
   * @ignore
   */
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
      // Note that Firefox exposes EXT_disjoint_timer_query under WebGL2 rather than
      // EXT_disjoint_timer_query_webgl2
      this.extDisjointTimerQuery = getExtension('EXT_disjoint_timer_query_webgl2', 'EXT_disjoint_timer_query');
      this.extDepthTexture = true;
    } else {
      this.extBlendMinmax = getExtension("EXT_blend_minmax");
      this.extDrawBuffers = getExtension('EXT_draw_buffers');
      this.extInstancing = getExtension("ANGLE_instanced_arrays");
      if (this.extInstancing) {
        // Install the WebGL 2 Instancing API for WebGL 1.0
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
        // Install the WebGL 2 VAO API for WebGL 1.0
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

    // iOS exposes this for half precision render targets on both Webgl1 and 2 from iOS v 14.5beta
    this.extColorBufferHalfFloat = getExtension("EXT_color_buffer_half_float");
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
    Debug.assert(!this.insideRenderPass, 'RenderPass cannot be started while inside another render pass.');
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
        key += vertexBuffer.id + vertexBuffer.format.renderingingHash;
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
    const defaultOptions = this.defaultClearOptions;
    options = options || defaultOptions;
    const flags = options.flags === undefined ? defaultOptions.flags : options.flags;
    if (flags !== 0) {
      const gl = this.gl;

      // Set the clear color
      if (flags & CLEARFLAG_COLOR) {
        const color = options.color === undefined ? defaultOptions.color : options.color;
        this.setClearColor(color[0], color[1], color[2], color[3]);
        this.setColorWrite(true, true, true, true);
      }
      if (flags & CLEARFLAG_DEPTH) {
        // Set the clear depth
        const depth = options.depth === undefined ? defaultOptions.depth : options.depth;
        this.setClearDepth(depth);
        this.setDepthWrite(true);
      }
      if (flags & CLEARFLAG_STENCIL) {
        // Set the clear stencil
        const stencil = options.stencil === undefined ? defaultOptions.stencil : options.stencil;
        this.setClearStencil(stencil);
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
   * Set the depth value used when the depth buffer is cleared.
   *
   * @param {number} depth - The depth value to clear the depth buffer to in the range 0.0
   * to 1.0.
   * @ignore
   */
  setClearDepth(depth) {
    if (depth !== this.clearDepth) {
      this.gl.clearDepth(depth);
      this.clearDepth = depth;
    }
  }

  /**
   * Set the clear color used when the frame buffer is cleared.
   *
   * @param {number} r - The red component of the color in the range 0.0 to 1.0.
   * @param {number} g - The green component of the color in the range 0.0 to 1.0.
   * @param {number} b - The blue component of the color in the range 0.0 to 1.0.
   * @param {number} a - The alpha component of the color in the range 0.0 to 1.0.
   * @ignore
   */
  setClearColor(r, g, b, a) {
    const c = this.clearColor;
    if (r !== c.r || g !== c.g || b !== c.b || a !== c.a) {
      this.gl.clearColor(r, g, b, a);
      this.clearColor.set(r, g, b, a);
    }
  }

  /**
   * Set the stencil clear value used when the stencil buffer is cleared.
   *
   * @param {number} value - The stencil value to clear the stencil buffer to.
   */
  setClearStencil(value) {
    if (value !== this.clearStencil) {
      this.gl.clearStencil(value);
      this.clearStencil = value;
    }
  }

  /**
   * Queries whether depth testing is enabled.
   *
   * @returns {boolean} True if depth testing is enabled and false otherwise.
   * @example
   * var depthTest = device.getDepthTest();
   * console.log('Depth testing is ' + depthTest ? 'enabled' : 'disabled');
   */
  getDepthTest() {
    return this.depthTest;
  }

  /**
   * Enables or disables depth testing of fragments. Once this state is set, it persists until it
   * is changed. By default, depth testing is enabled.
   *
   * @param {boolean} depthTest - True to enable depth testing and false otherwise.
   * @example
   * device.setDepthTest(true);
   */
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

  /**
   * Configures the depth test.
   *
   * @param {number} func - A function to compare a new depth value with an existing z-buffer
   * value and decide if to write a pixel. Can be:
   *
   * - {@link FUNC_NEVER}: don't draw
   * - {@link FUNC_LESS}: draw if new depth < depth buffer
   * - {@link FUNC_EQUAL}: draw if new depth == depth buffer
   * - {@link FUNC_LESSEQUAL}: draw if new depth <= depth buffer
   * - {@link FUNC_GREATER}: draw if new depth > depth buffer
   * - {@link FUNC_NOTEQUAL}: draw if new depth != depth buffer
   * - {@link FUNC_GREATEREQUAL}: draw if new depth >= depth buffer
   * - {@link FUNC_ALWAYS}: always draw
   */
  setDepthFunc(func) {
    if (this.depthFunc === func) return;
    this.gl.depthFunc(this.glComparison[func]);
    this.depthFunc = func;
  }

  /**
   * Queries whether writes to the depth buffer are enabled.
   *
   * @returns {boolean} True if depth writing is enabled and false otherwise.
   * @example
   * var depthWrite = device.getDepthWrite();
   * console.log('Depth writing is ' + depthWrite ? 'enabled' : 'disabled');
   */
  getDepthWrite() {
    return this.depthWrite;
  }

  /**
   * Enables or disables writes to the depth buffer. Once this state is set, it persists until it
   * is changed. By default, depth writes are enabled.
   *
   * @param {boolean} writeDepth - True to enable depth writing and false otherwise.
   * @example
   * device.setDepthWrite(true);
   */
  setDepthWrite(writeDepth) {
    if (this.depthWrite !== writeDepth) {
      this.gl.depthMask(writeDepth);
      this.depthWrite = writeDepth;
    }
  }

  /**
   * Enables or disables writes to the color buffer. Once this state is set, it persists until it
   * is changed. By default, color writes are enabled for all color channels.
   *
   * @param {boolean} writeRed - True to enable writing of the red channel and false otherwise.
   * @param {boolean} writeGreen - True to enable writing of the green channel and false otherwise.
   * @param {boolean} writeBlue - True to enable writing of the blue channel and false otherwise.
   * @param {boolean} writeAlpha - True to enable writing of the alpha channel and false otherwise.
   * @example
   * // Just write alpha into the frame buffer
   * device.setColorWrite(false, false, false, true);
   */
  setColorWrite(writeRed, writeGreen, writeBlue, writeAlpha) {
    if (this.writeRed !== writeRed || this.writeGreen !== writeGreen || this.writeBlue !== writeBlue || this.writeAlpha !== writeAlpha) {
      this.gl.colorMask(writeRed, writeGreen, writeBlue, writeAlpha);
      this.writeRed = writeRed;
      this.writeGreen = writeGreen;
      this.writeBlue = writeBlue;
      this.writeAlpha = writeAlpha;
    }
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
   * Queries whether blending is enabled.
   *
   * @returns {boolean} True if blending is enabled and false otherwise.
   */
  getBlending() {
    return this.blending;
  }

  /**
   * Enables or disables blending.
   *
   * @param {boolean} blending - True to enable blending and false to disable it.
   */
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

  /**
   * Configures blending operations. Both source and destination blend modes can take the
   * following values:
   *
   * - {@link BLENDMODE_ZERO}
   * - {@link BLENDMODE_ONE}
   * - {@link BLENDMODE_SRC_COLOR}
   * - {@link BLENDMODE_ONE_MINUS_SRC_COLOR}
   * - {@link BLENDMODE_DST_COLOR}
   * - {@link BLENDMODE_ONE_MINUS_DST_COLOR}
   * - {@link BLENDMODE_SRC_ALPHA}
   * - {@link BLENDMODE_SRC_ALPHA_SATURATE}
   * - {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}
   * - {@link BLENDMODE_DST_ALPHA}
   * - {@link BLENDMODE_ONE_MINUS_DST_ALPHA}
   * - {@link BLENDMODE_CONSTANT_COLOR}
   * - {@link BLENDMODE_ONE_MINUS_CONSTANT_COLOR}
   * - {@link BLENDMODE_CONSTANT_ALPHA}
   * - {@link BLENDMODE_ONE_MINUS_CONSTANT_ALPHA}
   *
   * @param {number} blendSrc - The source blend function.
   * @param {number} blendDst - The destination blend function.
   */
  setBlendFunction(blendSrc, blendDst) {
    if (this.blendSrc !== blendSrc || this.blendDst !== blendDst || this.separateAlphaBlend) {
      this.gl.blendFunc(this.glBlendFunction[blendSrc], this.glBlendFunction[blendDst]);
      this.blendSrc = blendSrc;
      this.blendDst = blendDst;
      this.separateAlphaBlend = false;
    }
  }

  /**
   * Configures blending operations. Both source and destination blend modes can take the
   * following values:
   *
   * - {@link BLENDMODE_ZERO}
   * - {@link BLENDMODE_ONE}
   * - {@link BLENDMODE_SRC_COLOR}
   * - {@link BLENDMODE_ONE_MINUS_SRC_COLOR}
   * - {@link BLENDMODE_DST_COLOR}
   * - {@link BLENDMODE_ONE_MINUS_DST_COLOR}
   * - {@link BLENDMODE_SRC_ALPHA}
   * - {@link BLENDMODE_SRC_ALPHA_SATURATE}
   * - {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}
   * - {@link BLENDMODE_DST_ALPHA}
   * - {@link BLENDMODE_ONE_MINUS_DST_ALPHA}
   *
   * @param {number} blendSrc - The source blend function.
   * @param {number} blendDst - The destination blend function.
   * @param {number} blendSrcAlpha - The separate source blend function for the alpha channel.
   * @param {number} blendDstAlpha - The separate destination blend function for the alpha channel.
   */
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

  /**
   * Configures the blending equation. The default blend equation is {@link BLENDEQUATION_ADD}.
   *
   * @param {number} blendEquation - The blend equation. Can be:
   *
   * - {@link BLENDEQUATION_ADD}
   * - {@link BLENDEQUATION_SUBTRACT}
   * - {@link BLENDEQUATION_REVERSE_SUBTRACT}
   * - {@link BLENDEQUATION_MIN}
   * - {@link BLENDEQUATION_MAX}
   *
   * Note that MIN and MAX modes require either EXT_blend_minmax or WebGL2 to work (check
   * device.extBlendMinmax).
   */
  setBlendEquation(blendEquation) {
    if (this.blendEquation !== blendEquation || this.separateAlphaEquation) {
      this.gl.blendEquation(this.glBlendEquation[blendEquation]);
      this.blendEquation = blendEquation;
      this.separateAlphaEquation = false;
    }
  }

  /**
   * Configures the blending equation. The default blend equation is {@link BLENDEQUATION_ADD}.
   *
   * @param {number} blendEquation - The blend equation. Can be:
   *
   * - {@link BLENDEQUATION_ADD}
   * - {@link BLENDEQUATION_SUBTRACT}
   * - {@link BLENDEQUATION_REVERSE_SUBTRACT}
   * - {@link BLENDEQUATION_MIN}
   * - {@link BLENDEQUATION_MAX}
   *
   * Note that MIN and MAX modes require either EXT_blend_minmax or WebGL2 to work (check
   * device.extBlendMinmax).
   * @param {number} blendAlphaEquation - A separate blend equation for the alpha channel.
   * Accepts same values as `blendEquation`.
   */
  setBlendEquationSeparate(blendEquation, blendAlphaEquation) {
    if (this.blendEquation !== blendEquation || this.blendAlphaEquation !== blendAlphaEquation || !this.separateAlphaEquation) {
      this.gl.blendEquationSeparate(this.glBlendEquation[blendEquation], this.glBlendEquation[blendAlphaEquation]);
      this.blendEquation = blendEquation;
      this.blendAlphaEquation = blendAlphaEquation;
      this.separateAlphaEquation = true;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNldHVwVmVydGV4QXJyYXlPYmplY3QgfSBmcm9tICcuLi8uLi8uLi9wb2x5ZmlsbC9PRVNWZXJ0ZXhBcnJheU9iamVjdC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHtcbiAgICBERVZJQ0VUWVBFX1dFQkdMLFxuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBCTEVOREVRVUFUSU9OX0FERCxcbiAgICBCTEVORE1PREVfWkVSTywgQkxFTkRNT0RFX09ORSxcbiAgICBDTEVBUkZMQUdfQ09MT1IsIENMRUFSRkxBR19ERVBUSCwgQ0xFQVJGTEFHX1NURU5DSUwsXG4gICAgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfTk9ORSxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIEZVTkNfQUxXQVlTLCBGVU5DX0xFU1NFUVVBTCxcbiAgICBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBTVEVOQ0lMT1BfS0VFUCxcbiAgICBVTklGT1JNVFlQRV9CT09MLCBVTklGT1JNVFlQRV9JTlQsIFVOSUZPUk1UWVBFX0ZMT0FULCBVTklGT1JNVFlQRV9WRUMyLCBVTklGT1JNVFlQRV9WRUMzLFxuICAgIFVOSUZPUk1UWVBFX1ZFQzQsIFVOSUZPUk1UWVBFX0lWRUMyLCBVTklGT1JNVFlQRV9JVkVDMywgVU5JRk9STVRZUEVfSVZFQzQsIFVOSUZPUk1UWVBFX0JWRUMyLFxuICAgIFVOSUZPUk1UWVBFX0JWRUMzLCBVTklGT1JNVFlQRV9CVkVDNCwgVU5JRk9STVRZUEVfTUFUMiwgVU5JRk9STVRZUEVfTUFUMywgVU5JRk9STVRZUEVfTUFUNCxcbiAgICBVTklGT1JNVFlQRV9URVhUVVJFMkQsIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFLCBVTklGT1JNVFlQRV9GTE9BVEFSUkFZLCBVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XLFxuICAgIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVywgVU5JRk9STVRZUEVfVEVYVFVSRTNELCBVTklGT1JNVFlQRV9WRUMyQVJSQVksIFVOSUZPUk1UWVBFX1ZFQzNBUlJBWSwgVU5JRk9STVRZUEVfVkVDNEFSUkFZLFxuICAgIHNlbWFudGljVG9Mb2NhdGlvbixcbiAgICBQUklNSVRJVkVfVFJJU1RSSVBcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgR3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuLi9ncmFwaGljcy1kZXZpY2UuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vZGVidWctZ3JhcGhpY3MuanMnO1xuXG5pbXBvcnQgeyBXZWJnbFZlcnRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ2wtdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJnbEluZGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJnbC1pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xTaGFkZXIgfSBmcm9tICcuL3dlYmdsLXNoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJnbFRleHR1cmUgfSBmcm9tICcuL3dlYmdsLXRleHR1cmUuanMnO1xuaW1wb3J0IHsgV2ViZ2xSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3dlYmdsLXJlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2hhZGVyVXRpbHMgfSBmcm9tICcuLi9zaGFkZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSAnLi4vc2hhZGVyLmpzJztcblxuY29uc3QgaW52YWxpZGF0ZUF0dGFjaG1lbnRzID0gW107XG5cbmNvbnN0IF9mdWxsU2NyZWVuUXVhZFZTID0gLyogZ2xzbCAqL2BcbmF0dHJpYnV0ZSB2ZWMyIHZlcnRleF9wb3NpdGlvbjtcbnZhcnlpbmcgdmVjMiB2VXYwO1xudm9pZCBtYWluKHZvaWQpXG57XG4gICAgZ2xfUG9zaXRpb24gPSB2ZWM0KHZlcnRleF9wb3NpdGlvbiwgMC41LCAxLjApO1xuICAgIHZVdjAgPSB2ZXJ0ZXhfcG9zaXRpb24ueHkqMC41KzAuNTtcbn1cbmA7XG5cbmNvbnN0IF9wcmVjaXNpb25UZXN0MVBTID0gLyogZ2xzbCAqL2BcbnZvaWQgbWFpbih2b2lkKSB7IFxuICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMjE0NzQ4MzY0OC4wKTtcbn1cbmA7XG5cbmNvbnN0IF9wcmVjaXNpb25UZXN0MlBTID0gLyogZ2xzbCAqL2BcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcbnZlYzQgcGFja0Zsb2F0KGZsb2F0IGRlcHRoKSB7XG4gICAgY29uc3QgdmVjNCBiaXRfc2hpZnQgPSB2ZWM0KDI1Ni4wICogMjU2LjAgKiAyNTYuMCwgMjU2LjAgKiAyNTYuMCwgMjU2LjAsIDEuMCk7XG4gICAgY29uc3QgdmVjNCBiaXRfbWFzayAgPSB2ZWM0KDAuMCwgMS4wIC8gMjU2LjAsIDEuMCAvIDI1Ni4wLCAxLjAgLyAyNTYuMCk7XG4gICAgdmVjNCByZXMgPSBtb2QoZGVwdGggKiBiaXRfc2hpZnQgKiB2ZWM0KDI1NSksIHZlYzQoMjU2KSApIC8gdmVjNCgyNTUpO1xuICAgIHJlcyAtPSByZXMueHh5eiAqIGJpdF9tYXNrO1xuICAgIHJldHVybiByZXM7XG59XG52b2lkIG1haW4odm9pZCkge1xuICAgIGZsb2F0IGMgPSB0ZXh0dXJlMkQoc291cmNlLCB2ZWMyKDAuMCkpLnI7XG4gICAgZmxvYXQgZGlmZiA9IGFicyhjIC0gMjE0NzQ4MzY0OC4wKSAvIDIxNDc0ODM2NDguMDtcbiAgICBnbF9GcmFnQ29sb3IgPSBwYWNrRmxvYXQoZGlmZik7XG59XG5gO1xuXG5jb25zdCBfb3V0cHV0VGV4dHVyZTJEID0gLyogZ2xzbCAqL2BcbnZhcnlpbmcgdmVjMiB2VXYwO1xudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xudm9pZCBtYWluKHZvaWQpIHtcbiAgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCB2VXYwKTtcbn1cbmA7XG5cbmZ1bmN0aW9uIHF1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZ2V0LCBzaGFkZXIpIHtcblxuICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIFwiUXVhZFdpdGhTaGFkZXJcIik7XG5cbiAgICBjb25zdCBvbGRSdCA9IGRldmljZS5yZW5kZXJUYXJnZXQ7XG4gICAgZGV2aWNlLnNldFJlbmRlclRhcmdldCh0YXJnZXQpO1xuICAgIGRldmljZS51cGRhdGVCZWdpbigpO1xuXG4gICAgY29uc3Qgb2xkRGVwdGhUZXN0ID0gZGV2aWNlLmdldERlcHRoVGVzdCgpO1xuICAgIGNvbnN0IG9sZERlcHRoV3JpdGUgPSBkZXZpY2UuZ2V0RGVwdGhXcml0ZSgpO1xuICAgIGNvbnN0IG9sZEN1bGxNb2RlID0gZGV2aWNlLmdldEN1bGxNb2RlKCk7XG4gICAgY29uc3Qgb2xkV1IgPSBkZXZpY2Uud3JpdGVSZWQ7XG4gICAgY29uc3Qgb2xkV0cgPSBkZXZpY2Uud3JpdGVHcmVlbjtcbiAgICBjb25zdCBvbGRXQiA9IGRldmljZS53cml0ZUJsdWU7XG4gICAgY29uc3Qgb2xkV0EgPSBkZXZpY2Uud3JpdGVBbHBoYTtcbiAgICBkZXZpY2Uuc2V0RGVwdGhUZXN0KGZhbHNlKTtcbiAgICBkZXZpY2Uuc2V0RGVwdGhXcml0ZShmYWxzZSk7XG4gICAgZGV2aWNlLnNldEN1bGxNb2RlKENVTExGQUNFX05PTkUpO1xuICAgIGRldmljZS5zZXRDb2xvcldyaXRlKHRydWUsIHRydWUsIHRydWUsIHRydWUpO1xuXG4gICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihkZXZpY2UucXVhZFZlcnRleEJ1ZmZlciwgMCk7XG4gICAgZGV2aWNlLnNldFNoYWRlcihzaGFkZXIpO1xuXG4gICAgZGV2aWNlLmRyYXcoe1xuICAgICAgICB0eXBlOiBQUklNSVRJVkVfVFJJU1RSSVAsXG4gICAgICAgIGJhc2U6IDAsXG4gICAgICAgIGNvdW50OiA0LFxuICAgICAgICBpbmRleGVkOiBmYWxzZVxuICAgIH0pO1xuXG4gICAgZGV2aWNlLnNldERlcHRoVGVzdChvbGREZXB0aFRlc3QpO1xuICAgIGRldmljZS5zZXREZXB0aFdyaXRlKG9sZERlcHRoV3JpdGUpO1xuICAgIGRldmljZS5zZXRDdWxsTW9kZShvbGRDdWxsTW9kZSk7XG4gICAgZGV2aWNlLnNldENvbG9yV3JpdGUob2xkV1IsIG9sZFdHLCBvbGRXQiwgb2xkV0EpO1xuXG4gICAgZGV2aWNlLnVwZGF0ZUVuZCgpO1xuXG4gICAgZGV2aWNlLnNldFJlbmRlclRhcmdldChvbGRSdCk7XG4gICAgZGV2aWNlLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xufVxuXG5mdW5jdGlvbiB0ZXN0UmVuZGVyYWJsZShnbCwgcGl4ZWxGb3JtYXQpIHtcbiAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIC8vIENyZWF0ZSBhIDJ4MiB0ZXh0dXJlXG4gICAgY29uc3QgdGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgMiwgMiwgMCwgZ2wuUkdCQSwgcGl4ZWxGb3JtYXQsIG51bGwpO1xuXG4gICAgLy8gVHJ5IHRvIHVzZSB0aGlzIHRleHR1cmUgYXMgYSByZW5kZXIgdGFyZ2V0XG4gICAgY29uc3QgZnJhbWVidWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZnJhbWVidWZmZXIpO1xuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSwgMCk7XG5cbiAgICAvLyBJdCBpcyBsZWdhbCBmb3IgYSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBleHBvc2luZyB0aGUgT0VTX3RleHR1cmVfZmxvYXQgZXh0ZW5zaW9uIHRvXG4gICAgLy8gc3VwcG9ydCBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBidXQgbm90IGFzIGF0dGFjaG1lbnRzIHRvIGZyYW1lYnVmZmVyIG9iamVjdHMuXG4gICAgaWYgKGdsLmNoZWNrRnJhbWVidWZmZXJTdGF0dXMoZ2wuRlJBTUVCVUZGRVIpICE9PSBnbC5GUkFNRUJVRkZFUl9DT01QTEVURSkge1xuICAgICAgICByZXN1bHQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDbGVhbiB1cFxuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xuICAgIGdsLmRlbGV0ZVRleHR1cmUodGV4dHVyZSk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcbiAgICBnbC5kZWxldGVGcmFtZWJ1ZmZlcihmcmFtZWJ1ZmZlcik7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiB0ZXN0VGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZShnbCwgcGl4ZWxGb3JtYXQpIHtcbiAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIC8vIENyZWF0ZSBhIDJ4MiB0ZXh0dXJlXG4gICAgY29uc3QgdGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuXG4gICAgLy8gdXBsb2FkIHNvbWUgZGF0YSAtIG9uIGlPUyBwcmlvciB0byBhYm91dCBOb3ZlbWJlciAyMDE5LCBwYXNzaW5nIGRhdGEgdG8gaGFsZiB0ZXh0dXJlIHdvdWxkIGZhaWwgaGVyZVxuICAgIC8vIHNlZSBkZXRhaWxzIGhlcmU6IGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNjk5OTlcbiAgICAvLyBub3RlIHRoYXQgaWYgbm90IHN1cHBvcnRlZCwgdGhpcyBwcmludHMgYW4gZXJyb3IgdG8gY29uc29sZSwgdGhlIGVycm9yIGNhbiBiZSBzYWZlbHkgaWdub3JlZCBhcyBpdCdzIGhhbmRsZWRcbiAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQxNkFycmF5KDQgKiAyICogMik7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAyLCAyLCAwLCBnbC5SR0JBLCBwaXhlbEZvcm1hdCwgZGF0YSk7XG5cbiAgICBpZiAoZ2wuZ2V0RXJyb3IoKSAhPT0gZ2wuTk9fRVJST1IpIHtcbiAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQWJvdmUgZXJyb3IgcmVsYXRlZCB0byBIQUxGX0ZMT0FUX09FUyBjYW4gYmUgaWdub3JlZCwgaXQgd2FzIHRyaWdnZXJlZCBieSB0ZXN0aW5nIGhhbGYgZmxvYXQgdGV4dHVyZSBzdXBwb3J0XCIpO1xuICAgIH1cblxuICAgIC8vIENsZWFuIHVwXG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gICAgZ2wuZGVsZXRlVGV4dHVyZSh0ZXh0dXJlKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRlc3RUZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKGRldmljZSkge1xuICAgIGlmICghZGV2aWNlLnRleHR1cmVGbG9hdFJlbmRlcmFibGUpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHNoYWRlcjEgPSBuZXcgU2hhZGVyKGRldmljZSwgU2hhZGVyVXRpbHMuY3JlYXRlRGVmaW5pdGlvbihkZXZpY2UsIHtcbiAgICAgICAgbmFtZTogJ3B0ZXN0MScsXG4gICAgICAgIHZlcnRleENvZGU6IF9mdWxsU2NyZWVuUXVhZFZTLFxuICAgICAgICBmcmFnbWVudENvZGU6IF9wcmVjaXNpb25UZXN0MVBTXG4gICAgfSkpO1xuXG4gICAgY29uc3Qgc2hhZGVyMiA9IG5ldyBTaGFkZXIoZGV2aWNlLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKGRldmljZSwge1xuICAgICAgICBuYW1lOiAncHRlc3QyJyxcbiAgICAgICAgdmVydGV4Q29kZTogX2Z1bGxTY3JlZW5RdWFkVlMsXG4gICAgICAgIGZyYWdtZW50Q29kZTogX3ByZWNpc2lvblRlc3QyUFNcbiAgICB9KSk7XG5cbiAgICBjb25zdCB0ZXh0dXJlT3B0aW9ucyA9IHtcbiAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBMzJGLFxuICAgICAgICB3aWR0aDogMSxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbmFtZTogJ3Rlc3RGSFAnXG4gICAgfTtcbiAgICBjb25zdCB0ZXgxID0gbmV3IFRleHR1cmUoZGV2aWNlLCB0ZXh0dXJlT3B0aW9ucyk7XG4gICAgY29uc3QgdGFyZzEgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgY29sb3JCdWZmZXI6IHRleDEsXG4gICAgICAgIGRlcHRoOiBmYWxzZVxuICAgIH0pO1xuICAgIHF1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZzEsIHNoYWRlcjEpO1xuXG4gICAgdGV4dHVyZU9wdGlvbnMuZm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgY29uc3QgdGV4MiA9IG5ldyBUZXh0dXJlKGRldmljZSwgdGV4dHVyZU9wdGlvbnMpO1xuICAgIGNvbnN0IHRhcmcyID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgyLFxuICAgICAgICBkZXB0aDogZmFsc2VcbiAgICB9KTtcbiAgICBkZXZpY2UuY29uc3RhbnRUZXhTb3VyY2Uuc2V0VmFsdWUodGV4MSk7XG4gICAgcXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0YXJnMiwgc2hhZGVyMik7XG5cbiAgICBjb25zdCBwcmV2RnJhbWVidWZmZXIgPSBkZXZpY2UuYWN0aXZlRnJhbWVidWZmZXI7XG4gICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHRhcmcyLmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuXG4gICAgY29uc3QgcGl4ZWxzID0gbmV3IFVpbnQ4QXJyYXkoNCk7XG4gICAgZGV2aWNlLnJlYWRQaXhlbHMoMCwgMCwgMSwgMSwgcGl4ZWxzKTtcblxuICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcihwcmV2RnJhbWVidWZmZXIpO1xuXG4gICAgY29uc3QgeCA9IHBpeGVsc1swXSAvIDI1NTtcbiAgICBjb25zdCB5ID0gcGl4ZWxzWzFdIC8gMjU1O1xuICAgIGNvbnN0IHogPSBwaXhlbHNbMl0gLyAyNTU7XG4gICAgY29uc3QgdyA9IHBpeGVsc1szXSAvIDI1NTtcbiAgICBjb25zdCBmID0geCAvICgyNTYgKiAyNTYgKiAyNTYpICsgeSAvICgyNTYgKiAyNTYpICsgeiAvIDI1NiArIHc7XG5cbiAgICB0ZXgxLmRlc3Ryb3koKTtcbiAgICB0YXJnMS5kZXN0cm95KCk7XG4gICAgdGV4Mi5kZXN0cm95KCk7XG4gICAgdGFyZzIuZGVzdHJveSgpO1xuICAgIHNoYWRlcjEuZGVzdHJveSgpO1xuICAgIHNoYWRlcjIuZGVzdHJveSgpO1xuXG4gICAgcmV0dXJuIGYgPT09IDA7XG59XG5cbi8vIEltYWdlQml0bWFwIGN1cnJlbnQgc3RhdGUgKFNlcCAyMDIyKTpcbi8vIC0gTGFzdGVzdCBDaHJvbWUgYW5kIEZpcmVmb3ggYnJvd3NlcnMgYXBwZWFyIHRvIHN1cHBvcnQgdGhlIEltYWdlQml0bWFwIEFQSSBmaW5lICh0aG91Z2hcbi8vICAgdGhlcmUgYXJlIGxpa2VseSBzdGlsbCBpc3N1ZXMgd2l0aCBvbGRlciB2ZXJzaW9ucyBvZiBib3RoKS5cbi8vIC0gU2FmYXJpIHN1cHBvcnRzIHRoZSBBUEksIGJ1dCBjb21wbGV0ZWx5IGRlc3Ryb3lzIHNvbWUgcG5ncy4gRm9yIGV4YW1wbGUgdGhlIGN1YmVtYXBzIGluXG4vLyAgIHN0ZWFtcHVuayBzbG90cyBodHRwczovL3BsYXljYW52YXMuY29tL2VkaXRvci9zY2VuZS81MjQ4NTguIFNlZSB0aGUgd2Via2l0IGlzc3VlXG4vLyAgIGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xODI0MjQgZm9yIHN0YXR1cy5cbi8vIC0gU29tZSBhcHBsaWNhdGlvbnMgYXNzdW1lIHRoYXQgUE5HcyBsb2FkZWQgYnkgdGhlIGVuZ2luZSB1c2UgSFRNTEltYWdlQml0bWFwIGludGVyZmFjZSBhbmRcbi8vICAgZmFpbCB3aGVuIHVzaW5nIEltYWdlQml0bWFwLiBGb3IgZXhhbXBsZSwgU3BhY2UgQmFzZSBwcm9qZWN0IGZhaWxzIGJlY2F1c2UgaXQgdXNlcyBlbmdpbmVcbi8vICAgdGV4dHVyZSBhc3NldHMgb24gdGhlIGRvbSBodHRwczovL3BsYXljYW52YXMuY29tL2VkaXRvci9zY2VuZS80NDYyNzguXG5cbi8vIFRoaXMgZnVuY3Rpb24gdGVzdHMgd2hldGhlciB0aGUgY3VycmVudCBicm93c2VyIGRlc3Ryb3lzIFBORyBkYXRhIG9yIG5vdC5cbmZ1bmN0aW9uIHRlc3RJbWFnZUJpdG1hcChkZXZpY2UpIHtcbiAgICAvLyAxeDEgcG5nIGltYWdlIGNvbnRhaW5pbmcgcmdiYSgxLCAyLCAzLCA2MylcbiAgICBjb25zdCBwbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgMTM3LCA4MCwgNzgsIDcxLCAxMywgMTAsIDI2LCAxMCwgMCwgMCwgMCwgMTMsIDczLCA3MiwgNjgsIDgyLCAwLCAwLCAwLCAxLCAwLCAwLCAwLCAxLCA4LCA2LCAwLCAwLCAwLCAzMSwgMjEsXG4gICAgICAgIDE5NiwgMTM3LCAwLCAwLCAwLCAxMywgNzMsIDY4LCA2NSwgODQsIDEyMCwgMjE4LCA5OSwgMTAwLCAxMDAsIDk4LCAxODIsIDcsIDAsIDAsIDg5LCAwLCA3MSwgNjcsIDEzMywgMTQ4LCAyMzcsXG4gICAgICAgIDAsIDAsIDAsIDAsIDczLCA2OSwgNzgsIDY4LCAxNzQsIDY2LCA5NiwgMTMwXG4gICAgXSk7XG5cbiAgICByZXR1cm4gY3JlYXRlSW1hZ2VCaXRtYXAobmV3IEJsb2IoW3BuZ0J5dGVzXSwgeyB0eXBlOiAnaW1hZ2UvcG5nJyB9KSwgeyBwcmVtdWx0aXBseUFscGhhOiAnbm9uZScgfSlcbiAgICAgICAgLnRoZW4oKGltYWdlKSA9PiB7XG4gICAgICAgICAgICAvLyBjcmVhdGUgdGhlIHRleHR1cmVcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgICAgICB3aWR0aDogMSxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IDEsXG4gICAgICAgICAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICAgICAgICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBsZXZlbHM6IFtpbWFnZV1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyByZWFkIHBpeGVsc1xuICAgICAgICAgICAgY29uc3QgcnQgPSBuZXcgUmVuZGVyVGFyZ2V0KHsgY29sb3JCdWZmZXI6IHRleHR1cmUsIGRlcHRoOiBmYWxzZSB9KTtcbiAgICAgICAgICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcihydC5pbXBsLl9nbEZyYW1lQnVmZmVyKTtcbiAgICAgICAgICAgIGRldmljZS5pbml0UmVuZGVyVGFyZ2V0KHJ0KTtcblxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBVaW50OENsYW1wZWRBcnJheSg0KTtcbiAgICAgICAgICAgIGRldmljZS5nbC5yZWFkUGl4ZWxzKDAsIDAsIDEsIDEsIGRldmljZS5nbC5SR0JBLCBkZXZpY2UuZ2wuVU5TSUdORURfQllURSwgZGF0YSk7XG5cbiAgICAgICAgICAgIHJ0LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRleHR1cmUuZGVzdHJveSgpO1xuXG4gICAgICAgICAgICByZXR1cm4gZGF0YVswXSA9PT0gMSAmJiBkYXRhWzFdID09PSAyICYmIGRhdGFbMl0gPT09IDMgJiYgZGF0YVszXSA9PT0gNjM7XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaChlID0+IGZhbHNlKTtcbn1cblxuLyoqXG4gKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIG1hbmFnZXMgdGhlIHVuZGVybHlpbmcgZ3JhcGhpY3MgY29udGV4dC4gSXQgaXMgcmVzcG9uc2libGUgZm9yIHN1Ym1pdHRpbmdcbiAqIHJlbmRlciBzdGF0ZSBjaGFuZ2VzIGFuZCBncmFwaGljcyBwcmltaXRpdmVzIHRvIHRoZSBoYXJkd2FyZS4gQSBncmFwaGljcyBkZXZpY2UgaXMgdGllZCB0byBhXG4gKiBzcGVjaWZpYyBjYW52YXMgSFRNTCBlbGVtZW50LiBJdCBpcyB2YWxpZCB0byBoYXZlIG1vcmUgdGhhbiBvbmUgY2FudmFzIGVsZW1lbnQgcGVyIHBhZ2UgYW5kXG4gKiBjcmVhdGUgYSBuZXcgZ3JhcGhpY3MgZGV2aWNlIGFnYWluc3QgZWFjaC5cbiAqXG4gKiBAYXVnbWVudHMgR3JhcGhpY3NEZXZpY2VcbiAqL1xuY2xhc3MgV2ViZ2xHcmFwaGljc0RldmljZSBleHRlbmRzIEdyYXBoaWNzRGV2aWNlIHtcbiAgICAvKipcbiAgICAgKiBUaGUgV2ViR0wgY29udGV4dCBtYW5hZ2VkIGJ5IHRoZSBncmFwaGljcyBkZXZpY2UuIFRoZSB0eXBlIGNvdWxkIGFsc28gdGVjaG5pY2FsbHkgYmVcbiAgICAgKiBgV2ViR0xSZW5kZXJpbmdDb250ZXh0YCBpZiBXZWJHTCAyLjAgaXMgbm90IGF2YWlsYWJsZS4gQnV0IGluIG9yZGVyIGZvciBJbnRlbGxpU2Vuc2UgdG8gYmVcbiAgICAgKiBhYmxlIHRvIGZ1bmN0aW9uIGZvciBhbGwgV2ViR0wgY2FsbHMgaW4gdGhlIGNvZGViYXNlLCB3ZSBzcGVjaWZ5IGBXZWJHTDJSZW5kZXJpbmdDb250ZXh0YFxuICAgICAqIGhlcmUgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtXZWJHTDJSZW5kZXJpbmdDb250ZXh0fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnbDtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIFdlYkdMIGNvbnRleHQgb2YgdGhpcyBkZXZpY2UgaXMgdXNpbmcgdGhlIFdlYkdMIDIuMCBBUEkuIElmIGZhbHNlLCBXZWJHTCAxLjAgaXNcbiAgICAgKiBiZWluZyB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHdlYmdsMjtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgV2ViZ2xHcmFwaGljc0RldmljZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR9IGNhbnZhcyAtIFRoZSBjYW52YXMgdG8gd2hpY2ggdGhlIGdyYXBoaWNzIGRldmljZSB3aWxsIHJlbmRlci5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9ucyBwYXNzZWQgd2hlbiBjcmVhdGluZyB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFscGhhPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyBpZiB0aGUgY2FudmFzIGNvbnRhaW5zIGFuXG4gICAgICogYWxwaGEgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGVwdGg9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhlIGRyYXdpbmcgYnVmZmVyIGlzXG4gICAgICogcmVxdWVzdGVkIHRvIGhhdmUgYSBkZXB0aCBidWZmZXIgb2YgYXQgbGVhc3QgMTYgYml0cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN0ZW5jaWw9ZmFsc2VdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBkcmF3aW5nIGJ1ZmZlciBpc1xuICAgICAqIHJlcXVlc3RlZCB0byBoYXZlIGEgc3RlbmNpbCBidWZmZXIgb2YgYXQgbGVhc3QgOCBiaXRzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYW50aWFsaWFzPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB3aGV0aGVyIG9yIG5vdCB0byBwZXJmb3JtXG4gICAgICogYW50aS1hbGlhc2luZyBpZiBwb3NzaWJsZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZW11bHRpcGxpZWRBbHBoYT10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGUgcGFnZVxuICAgICAqIGNvbXBvc2l0b3Igd2lsbCBhc3N1bWUgdGhlIGRyYXdpbmcgYnVmZmVyIGNvbnRhaW5zIGNvbG9ycyB3aXRoIHByZS1tdWx0aXBsaWVkIGFscGhhLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlc2VydmVEcmF3aW5nQnVmZmVyPWZhbHNlXSAtIElmIHRoZSB2YWx1ZSBpcyB0cnVlIHRoZSBidWZmZXJzXG4gICAgICogd2lsbCBub3QgYmUgY2xlYXJlZCBhbmQgd2lsbCBwcmVzZXJ2ZSB0aGVpciB2YWx1ZXMgdW50aWwgY2xlYXJlZCBvciBvdmVyd3JpdHRlbiBieSB0aGVcbiAgICAgKiBhdXRob3IuXG4gICAgICogQHBhcmFtIHsnZGVmYXVsdCd8J2hpZ2gtcGVyZm9ybWFuY2UnfCdsb3ctcG93ZXInfSBbb3B0aW9ucy5wb3dlclByZWZlcmVuY2U9J2RlZmF1bHQnXSAtIEFcbiAgICAgKiBoaW50IHRvIHRoZSB1c2VyIGFnZW50IGluZGljYXRpbmcgd2hhdCBjb25maWd1cmF0aW9uIG9mIEdQVSBpcyBzdWl0YWJsZSBmb3IgdGhlIFdlYkdMXG4gICAgICogY29udGV4dC4gUG9zc2libGUgdmFsdWVzIGFyZTpcbiAgICAgKlxuICAgICAqIC0gJ2RlZmF1bHQnOiBMZXQgdGhlIHVzZXIgYWdlbnQgZGVjaWRlIHdoaWNoIEdQVSBjb25maWd1cmF0aW9uIGlzIG1vc3Qgc3VpdGFibGUuIFRoaXMgaXMgdGhlXG4gICAgICogZGVmYXVsdCB2YWx1ZS5cbiAgICAgKiAtICdoaWdoLXBlcmZvcm1hbmNlJzogUHJpb3JpdGl6ZXMgcmVuZGVyaW5nIHBlcmZvcm1hbmNlIG92ZXIgcG93ZXIgY29uc3VtcHRpb24uXG4gICAgICogLSAnbG93LXBvd2VyJzogUHJpb3JpdGl6ZXMgcG93ZXIgc2F2aW5nIG92ZXIgcmVuZGVyaW5nIHBlcmZvcm1hbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mYWlsSWZNYWpvclBlcmZvcm1hbmNlQ2F2ZWF0PWZhbHNlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgaWYgYVxuICAgICAqIGNvbnRleHQgd2lsbCBiZSBjcmVhdGVkIGlmIHRoZSBzeXN0ZW0gcGVyZm9ybWFuY2UgaXMgbG93IG9yIGlmIG5vIGhhcmR3YXJlIEdQVSBpcyBhdmFpbGFibGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcmVmZXJXZWJHbDI9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIGlmIGEgV2ViR2wyIGNvbnRleHRcbiAgICAgKiBzaG91bGQgYmUgcHJlZmVycmVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGVzeW5jaHJvbml6ZWQ9ZmFsc2VdIC0gQm9vbGVhbiB0aGF0IGhpbnRzIHRoZSB1c2VyIGFnZW50IHRvXG4gICAgICogcmVkdWNlIHRoZSBsYXRlbmN5IGJ5IGRlc3luY2hyb25pemluZyB0aGUgY2FudmFzIHBhaW50IGN5Y2xlIGZyb20gdGhlIGV2ZW50IGxvb3AuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy54ckNvbXBhdGlibGVdIC0gQm9vbGVhbiB0aGF0IGhpbnRzIHRvIHRoZSB1c2VyIGFnZW50IHRvIHVzZSBhXG4gICAgICogY29tcGF0aWJsZSBncmFwaGljcyBhZGFwdGVyIGZvciBhbiBpbW1lcnNpdmUgWFIgZGV2aWNlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNhbnZhcywgb3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIHN1cGVyKGNhbnZhcyk7XG4gICAgICAgIHRoaXMuZGV2aWNlVHlwZSA9IERFVklDRVRZUEVfV0VCR0w7XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0RnJhbWVidWZmZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudXBkYXRlQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIC8vIEFkZCBoYW5kbGVycyBmb3Igd2hlbiB0aGUgV2ViR0wgY29udGV4dCBpcyBsb3N0IG9yIHJlc3RvcmVkXG4gICAgICAgIHRoaXMuY29udGV4dExvc3QgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIgPSAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHRMb3N0ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMubG9zZUNvbnRleHQoKTtcbiAgICAgICAgICAgIERlYnVnLmxvZygncGMuR3JhcGhpY3NEZXZpY2U6IFdlYkdMIGNvbnRleHQgbG9zdC4nKTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZGV2aWNlbG9zdCcpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coJ3BjLkdyYXBoaWNzRGV2aWNlOiBXZWJHTCBjb250ZXh0IHJlc3RvcmVkLicpO1xuICAgICAgICAgICAgdGhpcy5yZXN0b3JlQ29udGV4dCgpO1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0TG9zdCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdkZXZpY2VyZXN0b3JlZCcpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIG9wdGlvbnMgZGVmYXVsdHNcbiAgICAgICAgb3B0aW9ucy5zdGVuY2lsID0gdHJ1ZTtcbiAgICAgICAgaWYgKCFvcHRpb25zLnBvd2VyUHJlZmVyZW5jZSkge1xuICAgICAgICAgICAgb3B0aW9ucy5wb3dlclByZWZlcmVuY2UgPSAnaGlnaC1wZXJmb3JtYW5jZSc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjNDEzNiAtIHR1cm4gb2ZmIGFudGlhbGlhc2luZyBvbiBBcHBsZVdlYktpdCBicm93c2VycyAxNS40XG4gICAgICAgIGNvbnN0IHVhID0gKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnKSAmJiBuYXZpZ2F0b3IudXNlckFnZW50O1xuICAgICAgICB0aGlzLmZvcmNlRGlzYWJsZU11bHRpc2FtcGxpbmcgPSB1YSAmJiB1YS5pbmNsdWRlcygnQXBwbGVXZWJLaXQnKSAmJiAodWEuaW5jbHVkZXMoJzE1LjQnKSB8fCB1YS5pbmNsdWRlcygnMTVfNCcpKTtcbiAgICAgICAgaWYgKHRoaXMuZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZykge1xuICAgICAgICAgICAgb3B0aW9ucy5hbnRpYWxpYXMgPSBmYWxzZTtcbiAgICAgICAgICAgIERlYnVnLmxvZyhcIkFudGlhbGlhc2luZyBoYXMgYmVlbiB0dXJuZWQgb2ZmIGR1ZSB0byByZW5kZXJpbmcgaXNzdWVzIG9uIEFwcGxlV2ViS2l0IDE1LjRcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXRyaWV2ZSB0aGUgV2ViR0wgY29udGV4dFxuICAgICAgICBjb25zdCBwcmVmZXJXZWJHbDIgPSAob3B0aW9ucy5wcmVmZXJXZWJHbDIgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLnByZWZlcldlYkdsMiA6IHRydWU7XG5cbiAgICAgICAgY29uc3QgbmFtZXMgPSBwcmVmZXJXZWJHbDIgPyBbXCJ3ZWJnbDJcIiwgXCJ3ZWJnbFwiLCBcImV4cGVyaW1lbnRhbC13ZWJnbFwiXSA6IFtcIndlYmdsXCIsIFwiZXhwZXJpbWVudGFsLXdlYmdsXCJdO1xuICAgICAgICBsZXQgZ2wgPSBudWxsO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBnbCA9IGNhbnZhcy5nZXRDb250ZXh0KG5hbWVzW2ldLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgaWYgKGdsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53ZWJnbDIgPSAobmFtZXNbaV0gPT09ICd3ZWJnbDInKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLmdsID0gZ2w7XG5cbiAgICAgICAgaWYgKCFnbCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiV2ViR0wgbm90IHN1cHBvcnRlZFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHBpeGVsIGZvcm1hdCBvZiB0aGUgZnJhbWVidWZmZXJcbiAgICAgICAgY29uc3QgYWxwaGFCaXRzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLkFMUEhBX0JJVFMpO1xuICAgICAgICB0aGlzLmZyYW1lYnVmZmVyRm9ybWF0ID0gYWxwaGFCaXRzID8gUElYRUxGT1JNQVRfUkdCQTggOiBQSVhFTEZPUk1BVF9SR0I4O1xuXG4gICAgICAgIGNvbnN0IGlzQ2hyb21lID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhIXdpbmRvdy5jaHJvbWU7XG4gICAgICAgIGNvbnN0IGlzTWFjID0gcGxhdGZvcm0uYnJvd3NlciAmJiBuYXZpZ2F0b3IuYXBwVmVyc2lvbi5pbmRleE9mKFwiTWFjXCIpICE9PSAtMTtcblxuICAgICAgICAvLyBlbmFibGUgdGVtcG9yYXJ5IHRleHR1cmUgdW5pdCB3b3JrYXJvdW5kIG9uIGRlc2t0b3Agc2FmYXJpXG4gICAgICAgIHRoaXMuX3RlbXBFbmFibGVTYWZhcmlUZXh0dXJlVW5pdFdvcmthcm91bmQgPSBwbGF0Zm9ybS5icm93c2VyICYmICEhd2luZG93LnNhZmFyaTtcblxuICAgICAgICAvLyBlbmFibGUgdGVtcG9yYXJ5IHdvcmthcm91bmQgZm9yIGdsQmxpdEZyYW1lYnVmZmVyIGZhaWxpbmcgb24gTWFjIENocm9tZSAoIzI1MDQpXG4gICAgICAgIHRoaXMuX3RlbXBNYWNDaHJvbWVCbGl0RnJhbWVidWZmZXJXb3JrYXJvdW5kID0gaXNNYWMgJiYgaXNDaHJvbWUgJiYgIW9wdGlvbnMuYWxwaGE7XG5cbiAgICAgICAgLy8gaW5pdCBwb2x5ZmlsbCBmb3IgVkFPcyB1bmRlciB3ZWJnbDFcbiAgICAgICAgaWYgKCF0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgc2V0dXBWZXJ0ZXhBcnJheU9iamVjdChnbCk7XG4gICAgICAgIH1cblxuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dGxvc3RcIiwgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIGNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwid2ViZ2xjb250ZXh0cmVzdG9yZWRcIiwgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciwgZmFsc2UpO1xuXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ2FwYWJpbGl0aWVzKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKTtcblxuICAgICAgICAvLyBzdGFydCBhc3luYyBpbWFnZSBiaXRtYXAgdGVzdFxuICAgICAgICB0aGlzLnN1cHBvcnRzSW1hZ2VCaXRtYXAgPSBudWxsO1xuICAgICAgICBpZiAodHlwZW9mIEltYWdlQml0bWFwICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgdGVzdEltYWdlQml0bWFwKHRoaXMpLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc3VwcG9ydHNJbWFnZUJpdG1hcCA9IHJlc3VsdDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0Q2xlYXJPcHRpb25zID0ge1xuICAgICAgICAgICAgY29sb3I6IFswLCAwLCAwLCAxXSxcbiAgICAgICAgICAgIGRlcHRoOiAxLFxuICAgICAgICAgICAgc3RlbmNpbDogMCxcbiAgICAgICAgICAgIGZsYWdzOiBDTEVBUkZMQUdfQ09MT1IgfCBDTEVBUkZMQUdfREVQVEhcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdsQWRkcmVzcyA9IFtcbiAgICAgICAgICAgIGdsLlJFUEVBVCxcbiAgICAgICAgICAgIGdsLkNMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBnbC5NSVJST1JFRF9SRVBFQVRcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQmxlbmRFcXVhdGlvbiA9IFtcbiAgICAgICAgICAgIGdsLkZVTkNfQURELFxuICAgICAgICAgICAgZ2wuRlVOQ19TVUJUUkFDVCxcbiAgICAgICAgICAgIGdsLkZVTkNfUkVWRVJTRV9TVUJUUkFDVCxcbiAgICAgICAgICAgIHRoaXMud2ViZ2wyID8gZ2wuTUlOIDogdGhpcy5leHRCbGVuZE1pbm1heCA/IHRoaXMuZXh0QmxlbmRNaW5tYXguTUlOX0VYVCA6IGdsLkZVTkNfQURELFxuICAgICAgICAgICAgdGhpcy53ZWJnbDIgPyBnbC5NQVggOiB0aGlzLmV4dEJsZW5kTWlubWF4ID8gdGhpcy5leHRCbGVuZE1pbm1heC5NQVhfRVhUIDogZ2wuRlVOQ19BRERcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQmxlbmRGdW5jdGlvbiA9IFtcbiAgICAgICAgICAgIGdsLlpFUk8sXG4gICAgICAgICAgICBnbC5PTkUsXG4gICAgICAgICAgICBnbC5TUkNfQ09MT1IsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuRFNUX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLlNSQ19BTFBIQSxcbiAgICAgICAgICAgIGdsLlNSQ19BTFBIQV9TQVRVUkFURSxcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5EU1RfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuQ09OU1RBTlRfQ09MT1IsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfQ09OU1RBTlRfQ09MT1IsXG4gICAgICAgICAgICBnbC5DT05TVEFOVF9BTFBIQSxcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19DT05TVEFOVF9BTFBIQVxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xDb21wYXJpc29uID0gW1xuICAgICAgICAgICAgZ2wuTkVWRVIsXG4gICAgICAgICAgICBnbC5MRVNTLFxuICAgICAgICAgICAgZ2wuRVFVQUwsXG4gICAgICAgICAgICBnbC5MRVFVQUwsXG4gICAgICAgICAgICBnbC5HUkVBVEVSLFxuICAgICAgICAgICAgZ2wuTk9URVFVQUwsXG4gICAgICAgICAgICBnbC5HRVFVQUwsXG4gICAgICAgICAgICBnbC5BTFdBWVNcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsU3RlbmNpbE9wID0gW1xuICAgICAgICAgICAgZ2wuS0VFUCxcbiAgICAgICAgICAgIGdsLlpFUk8sXG4gICAgICAgICAgICBnbC5SRVBMQUNFLFxuICAgICAgICAgICAgZ2wuSU5DUixcbiAgICAgICAgICAgIGdsLklOQ1JfV1JBUCxcbiAgICAgICAgICAgIGdsLkRFQ1IsXG4gICAgICAgICAgICBnbC5ERUNSX1dSQVAsXG4gICAgICAgICAgICBnbC5JTlZFUlRcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQ2xlYXJGbGFnID0gW1xuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIGdsLkNPTE9SX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5ERVBUSF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuQ09MT1JfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5TVEVOQ0lMX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5TVEVOQ0lMX0JVRkZFUl9CSVQgfCBnbC5DT0xPUl9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLlNURU5DSUxfQlVGRkVSX0JJVCB8IGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEN1bGwgPSBbXG4gICAgICAgICAgICAwLFxuICAgICAgICAgICAgZ2wuQkFDSyxcbiAgICAgICAgICAgIGdsLkZST05ULFxuICAgICAgICAgICAgZ2wuRlJPTlRfQU5EX0JBQ0tcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsRmlsdGVyID0gW1xuICAgICAgICAgICAgZ2wuTkVBUkVTVCxcbiAgICAgICAgICAgIGdsLkxJTkVBUixcbiAgICAgICAgICAgIGdsLk5FQVJFU1RfTUlQTUFQX05FQVJFU1QsXG4gICAgICAgICAgICBnbC5ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgICAgICAgICBnbC5MSU5FQVJfTUlQTUFQX05FQVJFU1QsXG4gICAgICAgICAgICBnbC5MSU5FQVJfTUlQTUFQX0xJTkVBUlxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xQcmltaXRpdmUgPSBbXG4gICAgICAgICAgICBnbC5QT0lOVFMsXG4gICAgICAgICAgICBnbC5MSU5FUyxcbiAgICAgICAgICAgIGdsLkxJTkVfTE9PUCxcbiAgICAgICAgICAgIGdsLkxJTkVfU1RSSVAsXG4gICAgICAgICAgICBnbC5UUklBTkdMRVMsXG4gICAgICAgICAgICBnbC5UUklBTkdMRV9TVFJJUCxcbiAgICAgICAgICAgIGdsLlRSSUFOR0xFX0ZBTlxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xUeXBlID0gW1xuICAgICAgICAgICAgZ2wuQllURSxcbiAgICAgICAgICAgIGdsLlVOU0lHTkVEX0JZVEUsXG4gICAgICAgICAgICBnbC5TSE9SVCxcbiAgICAgICAgICAgIGdsLlVOU0lHTkVEX1NIT1JULFxuICAgICAgICAgICAgZ2wuSU5ULFxuICAgICAgICAgICAgZ2wuVU5TSUdORURfSU5ULFxuICAgICAgICAgICAgZ2wuRkxPQVRcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGUgPSB7fTtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkJPT0xdICAgICAgICAgPSBVTklGT1JNVFlQRV9CT09MO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuSU5UXSAgICAgICAgICA9IFVOSUZPUk1UWVBFX0lOVDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUXSAgICAgICAgPSBVTklGT1JNVFlQRV9GTE9BVDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX1ZFQzJdICAgPSBVTklGT1JNVFlQRV9WRUMyO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfVkVDM10gICA9IFVOSUZPUk1UWVBFX1ZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9WRUM0XSAgID0gVU5JRk9STVRZUEVfVkVDNDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF9WRUMyXSAgICAgPSBVTklGT1JNVFlQRV9JVkVDMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF9WRUMzXSAgICAgPSBVTklGT1JNVFlQRV9JVkVDMztcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF9WRUM0XSAgICAgPSBVTklGT1JNVFlQRV9JVkVDNDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkJPT0xfVkVDMl0gICAgPSBVTklGT1JNVFlQRV9CVkVDMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkJPT0xfVkVDM10gICAgPSBVTklGT1JNVFlQRV9CVkVDMztcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkJPT0xfVkVDNF0gICAgPSBVTklGT1JNVFlQRV9CVkVDNDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX01BVDJdICAgPSBVTklGT1JNVFlQRV9NQVQyO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfTUFUM10gICA9IFVOSUZPUk1UWVBFX01BVDM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9NQVQ0XSAgID0gVU5JRk9STVRZUEVfTUFUNDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLlNBTVBMRVJfMkRdICAgPSBVTklGT1JNVFlQRV9URVhUVVJFMkQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSX0NVQkVdID0gVU5JRk9STVRZUEVfVEVYVFVSRUNVQkU7XG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLlNBTVBMRVJfMkRfU0hBRE9XXSAgID0gVU5JRk9STVRZUEVfVEVYVFVSRTJEX1NIQURPVztcbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSX0NVQkVfU0hBRE9XXSA9IFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVztcbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzNEXSAgICAgICAgICA9IFVOSUZPUk1UWVBFX1RFWFRVUkUzRDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90ID0ge307XG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90W2dsLlRFWFRVUkVfMkRdID0gMDtcbiAgICAgICAgdGhpcy50YXJnZXRUb1Nsb3RbZ2wuVEVYVFVSRV9DVUJFX01BUF0gPSAxO1xuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdFtnbC5URVhUVVJFXzNEXSA9IDI7XG5cbiAgICAgICAgLy8gRGVmaW5lIHRoZSB1bmlmb3JtIGNvbW1pdCBmdW5jdGlvbnNcbiAgICAgICAgbGV0IHNjb3BlWCwgc2NvcGVZLCBzY29wZVosIHNjb3BlVztcbiAgICAgICAgbGV0IHVuaWZvcm1WYWx1ZTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbiA9IFtdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JPT0xdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodW5pZm9ybS52YWx1ZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMWkodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS52YWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lOVF0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JPT0xdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0ZMT0FUXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0udmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFmKHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMyXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTJmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzNdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSB8fCB1bmlmb3JtVmFsdWVbMl0gIT09IHNjb3BlWikge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0zZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMl0gPSBzY29wZVo7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDNF0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIHNjb3BlWiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgc2NvcGVXID0gdmFsdWVbM107XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVogfHwgdW5pZm9ybVZhbHVlWzNdICE9PSBzY29wZVcpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtNGZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVszXSA9IHNjb3BlVztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDMl0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTJpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUMyXSA9IHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzJdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMzXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSB8fCB1bmlmb3JtVmFsdWVbMl0gIT09IHNjb3BlWikge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0zaXYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMl0gPSBzY29wZVo7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQlZFQzNdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDM107XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzRdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIHNjb3BlWiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgc2NvcGVXID0gdmFsdWVbM107XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVogfHwgdW5pZm9ybVZhbHVlWzNdICE9PSBzY29wZVcpIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtNGl2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVszXSA9IHNjb3BlVztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CVkVDNF0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUM0XTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9NQVQyXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm1NYXRyaXgyZnYodW5pZm9ybS5sb2NhdGlvbklkLCBmYWxzZSwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX01BVDNdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDNmdih1bmlmb3JtLmxvY2F0aW9uSWQsIGZhbHNlLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfTUFUNF0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtTWF0cml4NGZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9GTE9BVEFSUkFZXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTFmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMyQVJSQVldICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTJmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMzQVJSQVldICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTNmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUM0QVJSQVldICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybTRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLnN1cHBvcnRzQm9uZVRleHR1cmVzID0gdGhpcy5leHRUZXh0dXJlRmxvYXQgJiYgdGhpcy5tYXhWZXJ0ZXhUZXh0dXJlcyA+IDA7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIGFuIGVzdGltYXRlIG9mIHRoZSBtYXhpbXVtIG51bWJlciBvZiBib25lcyB0aGF0IGNhbiBiZSB1cGxvYWRlZCB0byB0aGUgR1BVXG4gICAgICAgIC8vIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXZhaWxhYmxlIHVuaWZvcm1zIGFuZCB0aGUgbnVtYmVyIG9mIHVuaWZvcm1zIHJlcXVpcmVkIGZvciBub24tXG4gICAgICAgIC8vIGJvbmUgZGF0YS4gIFRoaXMgaXMgYmFzZWQgb2ZmIG9mIHRoZSBTdGFuZGFyZCBzaGFkZXIuICBBIHVzZXIgZGVmaW5lZCBzaGFkZXIgbWF5IGhhdmVcbiAgICAgICAgLy8gZXZlbiBsZXNzIHNwYWNlIGF2YWlsYWJsZSBmb3IgYm9uZXMgc28gdGhpcyBjYWxjdWxhdGVkIHZhbHVlIGNhbiBiZSBvdmVycmlkZGVuIHZpYVxuICAgICAgICAvLyBwYy5HcmFwaGljc0RldmljZS5zZXRCb25lTGltaXQuXG4gICAgICAgIGxldCBudW1Vbmlmb3JtcyA9IHRoaXMudmVydGV4VW5pZm9ybXNDb3VudDtcbiAgICAgICAgbnVtVW5pZm9ybXMgLT0gNCAqIDQ7IC8vIE1vZGVsLCB2aWV3LCBwcm9qZWN0aW9uIGFuZCBzaGFkb3cgbWF0cmljZXNcbiAgICAgICAgbnVtVW5pZm9ybXMgLT0gODsgICAgIC8vIDggbGlnaHRzIG1heCwgZWFjaCBzcGVjaWZ5aW5nIGEgcG9zaXRpb24gdmVjdG9yXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDE7ICAgICAvLyBFeWUgcG9zaXRpb25cbiAgICAgICAgbnVtVW5pZm9ybXMgLT0gNCAqIDQ7IC8vIFVwIHRvIDQgdGV4dHVyZSB0cmFuc2Zvcm1zXG4gICAgICAgIHRoaXMuYm9uZUxpbWl0ID0gTWF0aC5mbG9vcihudW1Vbmlmb3JtcyAvIDMpOyAgIC8vIGVhY2ggYm9uZSB1c2VzIDMgdW5pZm9ybXNcblxuICAgICAgICAvLyBQdXQgYSBsaW1pdCBvbiB0aGUgbnVtYmVyIG9mIHN1cHBvcnRlZCBib25lcyBiZWZvcmUgc2tpbiBwYXJ0aXRpb25pbmcgbXVzdCBiZSBwZXJmb3JtZWRcbiAgICAgICAgLy8gU29tZSBHUFVzIGhhdmUgZGVtb25zdHJhdGVkIHBlcmZvcm1hbmNlIGlzc3VlcyBpZiB0aGUgbnVtYmVyIG9mIHZlY3RvcnMgYWxsb2NhdGVkIHRvIHRoZVxuICAgICAgICAvLyBza2luIG1hdHJpeCBwYWxldHRlIGlzIGxlZnQgdW5ib3VuZGVkXG4gICAgICAgIHRoaXMuYm9uZUxpbWl0ID0gTWF0aC5taW4odGhpcy5ib25lTGltaXQsIDEyOCk7XG5cbiAgICAgICAgaWYgKHRoaXMudW5tYXNrZWRSZW5kZXJlciA9PT0gJ01hbGktNDUwIE1QJykge1xuICAgICAgICAgICAgdGhpcy5ib25lTGltaXQgPSAzNDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY29uc3RhbnRUZXhTb3VyY2UgPSB0aGlzLnNjb3BlLnJlc29sdmUoXCJzb3VyY2VcIik7XG5cbiAgICAgICAgaWYgKHRoaXMuZXh0VGV4dHVyZUZsb2F0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAvLyBJbiBXZWJHTDIgZmxvYXQgdGV4dHVyZSByZW5kZXJhYmlsaXR5IGlzIGRpY3RhdGVkIGJ5IHRoZSBFWFRfY29sb3JfYnVmZmVyX2Zsb2F0IGV4dGVuc2lvblxuICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSA9ICEhdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBJbiBXZWJHTDEgd2Ugc2hvdWxkIGp1c3QgdHJ5IHJlbmRlcmluZyBpbnRvIGEgZmxvYXQgdGV4dHVyZVxuICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSA9IHRlc3RSZW5kZXJhYmxlKGdsLCBnbC5GTE9BVCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHR3byBleHRlbnNpb25zIGFsbG93IHVzIHRvIHJlbmRlciB0byBoYWxmIGZsb2F0IGJ1ZmZlcnNcbiAgICAgICAgaWYgKHRoaXMuZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQpIHtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUgPSAhIXRoaXMuZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQ7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICAvLyBFWFRfY29sb3JfYnVmZmVyX2Zsb2F0IHNob3VsZCBhZmZlY3QgYm90aCBmbG9hdCBhbmQgaGFsZmZsb2F0IGZvcm1hdHNcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gISF0aGlzLmV4dENvbG9yQnVmZmVyRmxvYXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIE1hbnVhbCByZW5kZXIgY2hlY2sgZm9yIGhhbGYgZmxvYXRcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gdGVzdFJlbmRlcmFibGUoZ2wsIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdC5IQUxGX0ZMT0FUX09FUyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN1cHBvcnRzTW9ycGhUYXJnZXRUZXh0dXJlc0NvcmUgPSAodGhpcy5tYXhQcmVjaXNpb24gPT09IFwiaGlnaHBcIiAmJiB0aGlzLm1heFZlcnRleFRleHR1cmVzID49IDIpO1xuICAgICAgICB0aGlzLnN1cHBvcnRzRGVwdGhTaGFkb3cgPSB0aGlzLndlYmdsMjtcblxuICAgICAgICB0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIC8vIGFyZWEgbGlnaHQgTFVUIGZvcm1hdCAtIG9yZGVyIG9mIHByZWZlcmVuY2U6IGhhbGYsIGZsb2F0LCA4Yml0XG4gICAgICAgIHRoaXMuYXJlYUxpZ2h0THV0Rm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgICAgIGlmICh0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgJiYgdGhpcy50ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlICYmIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdExpbmVhcikge1xuICAgICAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBMTZGO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXh0VGV4dHVyZUZsb2F0ICYmIHRoaXMuZXh0VGV4dHVyZUZsb2F0TGluZWFyKSB7XG4gICAgICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkEzMkY7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBvc3RJbml0KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSB0aGUgZ3JhcGhpY3MgZGV2aWNlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiB0aGlzLmZlZWRiYWNrKSB7XG4gICAgICAgICAgICBnbC5kZWxldGVUcmFuc2Zvcm1GZWVkYmFjayh0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2xlYXJWZXJ0ZXhBcnJheU9iamVjdENhY2hlKCk7XG5cbiAgICAgICAgdGhpcy5jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0bG9zdCcsIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB0aGlzLmNhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCd3ZWJnbGNvbnRleHRyZXN0b3JlZCcsIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIgPSBudWxsO1xuICAgICAgICB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmdsID0gbnVsbDtcblxuICAgICAgICBzdXBlci5wb3N0RGVzdHJveSgpO1xuICAgIH1cblxuICAgIC8vIHByb3ZpZGUgd2ViZ2wgaW1wbGVtZW50YXRpb24gZm9yIHRoZSB2ZXJ0ZXggYnVmZmVyXG4gICAgY3JlYXRlVmVydGV4QnVmZmVySW1wbCh2ZXJ0ZXhCdWZmZXIsIGZvcm1hdCkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsVmVydGV4QnVmZmVyKCk7XG4gICAgfVxuXG4gICAgLy8gcHJvdmlkZSB3ZWJnbCBpbXBsZW1lbnRhdGlvbiBmb3IgdGhlIGluZGV4IGJ1ZmZlclxuICAgIGNyZWF0ZUluZGV4QnVmZmVySW1wbChpbmRleEJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsSW5kZXhCdWZmZXIoaW5kZXhCdWZmZXIpO1xuICAgIH1cblxuICAgIGNyZWF0ZVNoYWRlckltcGwoc2hhZGVyKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xTaGFkZXIoc2hhZGVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVUZXh0dXJlSW1wbCh0ZXh0dXJlKSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xUZXh0dXJlKCk7XG4gICAgfVxuXG4gICAgY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbChyZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbFJlbmRlclRhcmdldCgpO1xuICAgIH1cblxuICAgIC8vICNpZiBfREVCVUdcbiAgICBwdXNoTWFya2VyKG5hbWUpIHtcbiAgICAgICAgaWYgKHdpbmRvdy5zcGVjdG9yKSB7XG4gICAgICAgICAgICBjb25zdCBsYWJlbCA9IERlYnVnR3JhcGhpY3MudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHdpbmRvdy5zcGVjdG9yLnNldE1hcmtlcihgJHtsYWJlbH0gI2ApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcG9wTWFya2VyKCkge1xuICAgICAgICBpZiAod2luZG93LnNwZWN0b3IpIHtcbiAgICAgICAgICAgIGNvbnN0IGxhYmVsID0gRGVidWdHcmFwaGljcy50b1N0cmluZygpO1xuICAgICAgICAgICAgaWYgKGxhYmVsLmxlbmd0aClcbiAgICAgICAgICAgICAgICB3aW5kb3cuc3BlY3Rvci5zZXRNYXJrZXIoYCR7bGFiZWx9ICNgKTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICB3aW5kb3cuc3BlY3Rvci5jbGVhck1hcmtlcigpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8vICNlbmRpZlxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIHByZWNpc2lvbiBzdXBwb3J0ZWQgYnkgaW50cyBhbmQgZmxvYXRzIGluIHZlcnRleCBhbmQgZnJhZ21lbnQgc2hhZGVycy4gTm90ZSB0aGF0XG4gICAgICogZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0IGlzIG5vdCBndWFyYW50ZWVkIHRvIGJlIHByZXNlbnQgKHN1Y2ggYXMgc29tZSBpbnN0YW5jZXMgb2YgdGhlXG4gICAgICogZGVmYXVsdCBBbmRyb2lkIGJyb3dzZXIpLiBJbiB0aGlzIGNhc2UsIGFzc3VtZSBoaWdocCBpcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBcImhpZ2hwXCIsIFwibWVkaXVtcFwiIG9yIFwibG93cFwiXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldFByZWNpc2lvbigpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBsZXQgcHJlY2lzaW9uID0gXCJoaWdocFwiO1xuXG4gICAgICAgIGlmIChnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuVkVSVEVYX1NIQURFUiwgZ2wuSElHSF9GTE9BVCk7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuVkVSVEVYX1NIQURFUiwgZ2wuTUVESVVNX0ZMT0FUKTtcblxuICAgICAgICAgICAgY29uc3QgZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLkZSQUdNRU5UX1NIQURFUiwgZ2wuSElHSF9GTE9BVCk7XG4gICAgICAgICAgICBjb25zdCBmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5GUkFHTUVOVF9TSEFERVIsIGdsLk1FRElVTV9GTE9BVCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGhpZ2hwQXZhaWxhYmxlID0gdmVydGV4U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdC5wcmVjaXNpb24gPiAwICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdC5wcmVjaXNpb24gPiAwO1xuICAgICAgICAgICAgY29uc3QgbWVkaXVtcEF2YWlsYWJsZSA9IHZlcnRleFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdC5wcmVjaXNpb24gPiAwICYmIGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0LnByZWNpc2lvbiA+IDA7XG5cbiAgICAgICAgICAgIGlmICghaGlnaHBBdmFpbGFibGUpIHtcbiAgICAgICAgICAgICAgICBpZiAobWVkaXVtcEF2YWlsYWJsZSkge1xuICAgICAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSBcIm1lZGl1bXBcIjtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2FybihcIldBUk5JTkc6IGhpZ2hwIG5vdCBzdXBwb3J0ZWQsIHVzaW5nIG1lZGl1bXBcIik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gXCJsb3dwXCI7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJXQVJOSU5HOiBoaWdocCBhbmQgbWVkaXVtcCBub3Qgc3VwcG9ydGVkLCB1c2luZyBsb3dwXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwcmVjaXNpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgZXh0ZW5zaW9ucyBwcm92aWRlZCBieSB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplRXh0ZW5zaW9ucygpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBjb25zdCBzdXBwb3J0ZWRFeHRlbnNpb25zID0gZ2wuZ2V0U3VwcG9ydGVkRXh0ZW5zaW9ucygpO1xuXG4gICAgICAgIGNvbnN0IGdldEV4dGVuc2lvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN1cHBvcnRlZEV4dGVuc2lvbnMuaW5kZXhPZihhcmd1bWVudHNbaV0pICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZ2wuZ2V0RXh0ZW5zaW9uKGFyZ3VtZW50c1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRJbnN0YW5jaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlTG9kID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRWZXJ0ZXhBcnJheU9iamVjdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dENvbG9yQnVmZmVyRmxvYXQgPSBnZXRFeHRlbnNpb24oJ0VYVF9jb2xvcl9idWZmZXJfZmxvYXQnKTtcbiAgICAgICAgICAgIC8vIE5vdGUgdGhhdCBGaXJlZm94IGV4cG9zZXMgRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5IHVuZGVyIFdlYkdMMiByYXRoZXIgdGhhblxuICAgICAgICAgICAgLy8gRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5X3dlYmdsMlxuICAgICAgICAgICAgdGhpcy5leHREaXNqb2ludFRpbWVyUXVlcnkgPSBnZXRFeHRlbnNpb24oJ0VYVF9kaXNqb2ludF90aW1lcl9xdWVyeV93ZWJnbDInLCAnRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5Jyk7XG4gICAgICAgICAgICB0aGlzLmV4dERlcHRoVGV4dHVyZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gZ2V0RXh0ZW5zaW9uKFwiRVhUX2JsZW5kX21pbm1heFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0RHJhd0J1ZmZlcnMgPSBnZXRFeHRlbnNpb24oJ0VYVF9kcmF3X2J1ZmZlcnMnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0SW5zdGFuY2luZyA9IGdldEV4dGVuc2lvbihcIkFOR0xFX2luc3RhbmNlZF9hcnJheXNcIik7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zdGFsbCB0aGUgV2ViR0wgMiBJbnN0YW5jaW5nIEFQSSBmb3IgV2ViR0wgMS4wXG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ID0gdGhpcy5leHRJbnN0YW5jaW5nO1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQgPSBleHQuZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQgPSBleHQuZHJhd0VsZW1lbnRzSW5zdGFuY2VkQU5HTEUuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLnZlcnRleEF0dHJpYkRpdmlzb3IgPSBleHQudmVydGV4QXR0cmliRGl2aXNvckFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzID0gZ2V0RXh0ZW5zaW9uKFwiT0VTX3N0YW5kYXJkX2Rlcml2YXRpdmVzXCIpO1xuICAgICAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXQgPSBnZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9mbG9hdFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCA9IGdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2hhbGZfZmxvYXRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSBnZXRFeHRlbnNpb24oJ0VYVF9zaGFkZXJfdGV4dHVyZV9sb2QnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VWludEVsZW1lbnQgPSBnZXRFeHRlbnNpb24oXCJPRVNfZWxlbWVudF9pbmRleF91aW50XCIpO1xuICAgICAgICAgICAgdGhpcy5leHRWZXJ0ZXhBcnJheU9iamVjdCA9IGdldEV4dGVuc2lvbihcIk9FU192ZXJ0ZXhfYXJyYXlfb2JqZWN0XCIpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAvLyBJbnN0YWxsIHRoZSBXZWJHTCAyIFZBTyBBUEkgZm9yIFdlYkdMIDEuMFxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3Q7XG4gICAgICAgICAgICAgICAgZ2wuY3JlYXRlVmVydGV4QXJyYXkgPSBleHQuY3JlYXRlVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5ID0gZXh0LmRlbGV0ZVZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5pc1ZlcnRleEFycmF5ID0gZXh0LmlzVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSA9IGV4dC5iaW5kVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGlzam9pbnRUaW1lclF1ZXJ5ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGVwdGhUZXh0dXJlID0gZ2wuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZXB0aF90ZXh0dXJlJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4dERlYnVnUmVuZGVyZXJJbmZvID0gZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZWJ1Z19yZW5kZXJlcl9pbmZvJyk7XG4gICAgICAgIHRoaXMuZXh0VGV4dHVyZUZsb2F0TGluZWFyID0gZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfZmxvYXRfbGluZWFyXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIgPSBnZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9oYWxmX2Zsb2F0X2xpbmVhclwiKTtcbiAgICAgICAgdGhpcy5leHRGbG9hdEJsZW5kID0gZ2V0RXh0ZW5zaW9uKFwiRVhUX2Zsb2F0X2JsZW5kXCIpO1xuICAgICAgICB0aGlzLmV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYyA9IGdldEV4dGVuc2lvbignRVhUX3RleHR1cmVfZmlsdGVyX2FuaXNvdHJvcGljJywgJ1dFQktJVF9FWFRfdGV4dHVyZV9maWx0ZXJfYW5pc290cm9waWMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUVUQzEgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMxJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDID0gZ2V0RXh0ZW5zaW9uKCdXRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfcHZydGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9wdnJ0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlUzNUQyA9IGdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3MzdGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9zM3RjJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hdGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZUFTVEMgPSBnZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9hc3RjJyk7XG4gICAgICAgIHRoaXMuZXh0UGFyYWxsZWxTaGFkZXJDb21waWxlID0gZ2V0RXh0ZW5zaW9uKCdLSFJfcGFyYWxsZWxfc2hhZGVyX2NvbXBpbGUnKTtcblxuICAgICAgICAvLyBpT1MgZXhwb3NlcyB0aGlzIGZvciBoYWxmIHByZWNpc2lvbiByZW5kZXIgdGFyZ2V0cyBvbiBib3RoIFdlYmdsMSBhbmQgMiBmcm9tIGlPUyB2IDE0LjViZXRhXG4gICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQgPSBnZXRFeHRlbnNpb24oXCJFWFRfY29sb3JfYnVmZmVyX2hhbGZfZmxvYXRcIik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcnkgdGhlIGNhcGFiaWxpdGllcyBvZiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplQ2FwYWJpbGl0aWVzKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGxldCBleHQ7XG5cbiAgICAgICAgY29uc3QgdXNlckFnZW50ID0gdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgPyBuYXZpZ2F0b3IudXNlckFnZW50IDogXCJcIjtcblxuICAgICAgICB0aGlzLm1heFByZWNpc2lvbiA9IHRoaXMucHJlY2lzaW9uID0gdGhpcy5nZXRQcmVjaXNpb24oKTtcblxuICAgICAgICBjb25zdCBjb250ZXh0QXR0cmlicyA9IGdsLmdldENvbnRleHRBdHRyaWJ1dGVzKCk7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNc2FhID0gY29udGV4dEF0dHJpYnMuYW50aWFsaWFzO1xuICAgICAgICB0aGlzLnN1cHBvcnRzU3RlbmNpbCA9IGNvbnRleHRBdHRyaWJzLnN0ZW5jaWw7XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0luc3RhbmNpbmcgPSAhIXRoaXMuZXh0SW5zdGFuY2luZztcblxuICAgICAgICAvLyBRdWVyeSBwYXJhbWV0ZXIgdmFsdWVzIGZyb20gdGhlIFdlYkdMIGNvbnRleHRcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhDdWJlTWFwU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhSZW5kZXJCdWZmZXJTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9SRU5ERVJCVUZGRVJfU0laRSk7XG4gICAgICAgIHRoaXMubWF4VGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heENvbWJpbmVkVGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heFZlcnRleFRleHR1cmVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9WRVJURVhfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMudmVydGV4VW5pZm9ybXNDb3VudCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRVbmlmb3Jtc0NvdW50ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMpO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMubWF4RHJhd0J1ZmZlcnMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0RSQVdfQlVGRkVSUyk7XG4gICAgICAgICAgICB0aGlzLm1heENvbG9yQXR0YWNobWVudHMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTE9SX0FUVEFDSE1FTlRTKTtcbiAgICAgICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfM0RfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dCA9IHRoaXMuZXh0RHJhd0J1ZmZlcnM7XG4gICAgICAgICAgICB0aGlzLm1heERyYXdCdWZmZXJzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfRFJBV19CVUZGRVJTX0VYVCkgOiAxO1xuICAgICAgICAgICAgdGhpcy5tYXhDb2xvckF0dGFjaG1lbnRzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfQ09MT1JfQVRUQUNITUVOVFNfRVhUKSA6IDE7XG4gICAgICAgICAgICB0aGlzLm1heFZvbHVtZVNpemUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHREZWJ1Z1JlbmRlcmVySW5mbztcbiAgICAgICAgdGhpcy51bm1hc2tlZFJlbmRlcmVyID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5VTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCkgOiAnJztcbiAgICAgICAgdGhpcy51bm1hc2tlZFZlbmRvciA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuVU5NQVNLRURfVkVORE9SX1dFQkdMKSA6ICcnO1xuXG4gICAgICAgIC8vIENoZWNrIGlmIHdlIHN1cHBvcnQgR1BVIHBhcnRpY2xlcy4gQXQgdGhlIG1vbWVudCwgU2Ftc3VuZyBkZXZpY2VzIHdpdGggRXh5bm9zIChBUk0pIGVpdGhlciBjcmFzaCBvciByZW5kZXJcbiAgICAgICAgLy8gaW5jb3JyZWN0bHkgd2hlbiB1c2luZyBHUFUgZm9yIHBhcnRpY2xlcy4gU2VlOlxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGxheWNhbnZhcy9lbmdpbmUvaXNzdWVzLzM5NjdcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BsYXljYW52YXMvZW5naW5lL2lzc3Vlcy8zNDE1XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wbGF5Y2FudmFzL2VuZ2luZS9pc3N1ZXMvNDUxNFxuICAgICAgICAvLyBFeGFtcGxlIFVBIG1hdGNoZXM6IFN0YXJ0aW5nICdTTScgYW5kIGFueSBjb21iaW5hdGlvbiBvZiBsZXR0ZXJzIG9yIG51bWJlcnM6XG4gICAgICAgIC8vIE1vemlsbGEvNS4wIChMaW51eCwgQW5kcm9pZCAxMjsgU00tRzk3MEYgQnVpbGQvU1AxQS4yMTA4MTIuMDE2OyB3dilcbiAgICAgICAgLy8gTW96aWxsYS81LjAgKExpbnV4LCBBbmRyb2lkIDEyOyBTTS1HOTcwRilcbiAgICAgICAgY29uc3Qgc2Ftc3VuZ01vZGVsUmVnZXggPSAvU00tW2EtekEtWjAtOV0rLztcbiAgICAgICAgdGhpcy5zdXBwb3J0c0dwdVBhcnRpY2xlcyA9ICEodGhpcy51bm1hc2tlZFZlbmRvciA9PT0gJ0FSTScgJiYgdXNlckFnZW50Lm1hdGNoKHNhbXN1bmdNb2RlbFJlZ2V4KSk7XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWM7XG4gICAgICAgIHRoaXMubWF4QW5pc290cm9weSA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuTUFYX1RFWFRVUkVfTUFYX0FOSVNPVFJPUFlfRVhUKSA6IDE7XG5cbiAgICAgICAgdGhpcy5zYW1wbGVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLlNBTVBMRVMpO1xuICAgICAgICB0aGlzLm1heFNhbXBsZXMgPSB0aGlzLndlYmdsMiAmJiAhdGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nID8gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9TQU1QTEVTKSA6IDE7XG5cbiAgICAgICAgLy8gRG9uJ3QgYWxsb3cgYXJlYSBsaWdodHMgb24gb2xkIGFuZHJvaWQgZGV2aWNlcywgdGhleSBvZnRlbiBmYWlsIHRvIGNvbXBpbGUgdGhlIHNoYWRlciwgcnVuIGl0IGluY29ycmVjdGx5IG9yIGFyZSB2ZXJ5IHNsb3cuXG4gICAgICAgIHRoaXMuc3VwcG9ydHNBcmVhTGlnaHRzID0gdGhpcy53ZWJnbDIgfHwgIXBsYXRmb3JtLmFuZHJvaWQ7XG5cbiAgICAgICAgLy8gc3VwcG9ydHMgdGV4dHVyZSBmZXRjaCBpbnN0cnVjdGlvblxuICAgICAgICB0aGlzLnN1cHBvcnRzVGV4dHVyZUZldGNoID0gdGhpcy53ZWJnbDI7XG5cbiAgICAgICAgLy8gQWxzbyBkbyBub3QgYWxsb3cgdGhlbSB3aGVuIHdlIG9ubHkgaGF2ZSBzbWFsbCBudW1iZXIgb2YgdGV4dHVyZSB1bml0c1xuICAgICAgICBpZiAodGhpcy5tYXhUZXh0dXJlcyA8PSA4KSB7XG4gICAgICAgICAgICB0aGlzLnN1cHBvcnRzQXJlYUxpZ2h0cyA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBpbml0aWFsIHJlbmRlciBzdGF0ZSBvbiB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBpbml0aWFsaXplUmVuZGVyU3RhdGUoKSB7XG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVSZW5kZXJTdGF0ZSgpO1xuXG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAvLyBJbml0aWFsaXplIHJlbmRlciBzdGF0ZSB0byBhIGtub3duIHN0YXJ0IHN0YXRlXG4gICAgICAgIHRoaXMuYmxlbmRpbmcgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG5cbiAgICAgICAgdGhpcy5ibGVuZFNyYyA9IEJMRU5ETU9ERV9PTkU7XG4gICAgICAgIHRoaXMuYmxlbmREc3QgPSBCTEVORE1PREVfWkVSTztcbiAgICAgICAgdGhpcy5ibGVuZFNyY0FscGhhID0gQkxFTkRNT0RFX09ORTtcbiAgICAgICAgdGhpcy5ibGVuZERzdEFscGhhID0gQkxFTkRNT0RFX1pFUk87XG4gICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUJsZW5kID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYmxlbmRFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICB0aGlzLmJsZW5kQWxwaGFFcXVhdGlvbiA9IEJMRU5ERVFVQVRJT05fQUREO1xuICAgICAgICB0aGlzLnNlcGFyYXRlQWxwaGFFcXVhdGlvbiA9IGZhbHNlO1xuICAgICAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5aRVJPKTtcbiAgICAgICAgZ2wuYmxlbmRFcXVhdGlvbihnbC5GVU5DX0FERCk7XG5cbiAgICAgICAgdGhpcy5ibGVuZENvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDApO1xuICAgICAgICBnbC5ibGVuZENvbG9yKDAsIDAsIDAsIDApO1xuXG4gICAgICAgIHRoaXMud3JpdGVSZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlR3JlZW4gPSB0cnVlO1xuICAgICAgICB0aGlzLndyaXRlQmx1ZSA9IHRydWU7XG4gICAgICAgIHRoaXMud3JpdGVBbHBoYSA9IHRydWU7XG4gICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuICAgICAgICB0aGlzLmN1bGxNb2RlID0gQ1VMTEZBQ0VfQkFDSztcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkNVTExfRkFDRSk7XG4gICAgICAgIGdsLmN1bGxGYWNlKGdsLkJBQ0spO1xuXG4gICAgICAgIHRoaXMuZGVwdGhUZXN0ID0gdHJ1ZTtcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuXG4gICAgICAgIHRoaXMuZGVwdGhGdW5jID0gRlVOQ19MRVNTRVFVQUw7XG4gICAgICAgIGdsLmRlcHRoRnVuYyhnbC5MRVFVQUwpO1xuXG4gICAgICAgIHRoaXMuZGVwdGhXcml0ZSA9IHRydWU7XG4gICAgICAgIGdsLmRlcHRoTWFzayh0cnVlKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWwgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5TVEVOQ0lMX1RFU1QpO1xuXG4gICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IHRoaXMuc3RlbmNpbEZ1bmNCYWNrID0gRlVOQ19BTFdBWVM7XG4gICAgICAgIHRoaXMuc3RlbmNpbFJlZkZyb250ID0gdGhpcy5zdGVuY2lsUmVmQmFjayA9IDA7XG4gICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IHRoaXMuc3RlbmNpbE1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbEZ1bmMoZ2wuQUxXQVlTLCAwLCAweEZGKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IFNURU5DSUxPUF9LRUVQO1xuICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gU1RFTkNJTE9QX0tFRVA7XG4gICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSBTVEVOQ0lMT1BfS0VFUDtcbiAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgPSAweEZGO1xuICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrID0gMHhGRjtcbiAgICAgICAgZ2wuc3RlbmNpbE9wKGdsLktFRVAsIGdsLktFRVAsIGdsLktFRVApO1xuICAgICAgICBnbC5zdGVuY2lsTWFzaygweEZGKTtcblxuICAgICAgICB0aGlzLmFscGhhVG9Db3ZlcmFnZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLnJhc3RlciA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5TQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UpO1xuICAgICAgICAgICAgZ2wuZGlzYWJsZShnbC5SQVNURVJJWkVSX0RJU0NBUkQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kZXB0aEJpYXNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIGdsLmRpc2FibGUoZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XG5cbiAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gMTtcbiAgICAgICAgZ2wuY2xlYXJEZXB0aCgxKTtcblxuICAgICAgICB0aGlzLmNsZWFyQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMCk7XG4gICAgICAgIGdsLmNsZWFyQ29sb3IoMCwgMCwgMCwgMCk7XG5cbiAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWwgPSAwO1xuICAgICAgICBnbC5jbGVhclN0ZW5jaWwoMCk7XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICBnbC5oaW50KGdsLkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlQsIGdsLk5JQ0VTVCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB7XG4gICAgICAgICAgICAgICAgZ2wuaGludCh0aGlzLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMuRlJBR01FTlRfU0hBREVSX0RFUklWQVRJVkVfSElOVF9PRVMsIGdsLk5JQ0VTVCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBnbC5lbmFibGUoZ2wuU0NJU1NPUl9URVNUKTtcblxuICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OX1dFQkdMLCBnbC5OT05FKTtcblxuICAgICAgICB0aGlzLnVucGFja0ZsaXBZID0gZmFsc2U7XG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19GTElQX1lfV0VCR0wsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLnVucGFja1ByZW11bHRpcGx5QWxwaGEgPSBmYWxzZTtcbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLCBmYWxzZSk7XG5cbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0FMSUdOTUVOVCwgMSk7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKSB7XG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gY2FjaGUgb2YgVkFPc1xuICAgICAgICB0aGlzLl92YW9NYXAgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgdGhpcy5ib3VuZFZhbyA9IG51bGw7XG4gICAgICAgIHRoaXMuYWN0aXZlRnJhbWVidWZmZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmZlZWRiYWNrID0gbnVsbDtcbiAgICAgICAgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy50ZXh0dXJlVW5pdCA9IDA7XG4gICAgICAgIHRoaXMudGV4dHVyZVVuaXRzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5tYXhDb21iaW5lZFRleHR1cmVzOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZVVuaXRzLnB1c2goW251bGwsIG51bGwsIG51bGxdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSBXZWJHTCBjb250ZXh0IHdhcyBsb3N0LiBJdCByZWxlYXNlcyBhbGwgY29udGV4dCByZWxhdGVkIHJlc291cmNlcy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgLy8gcmVsZWFzZSBzaGFkZXJzXG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyIG9mIHRoaXMuc2hhZGVycykge1xuICAgICAgICAgICAgc2hhZGVyLmxvc2VDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWxlYXNlIHRleHR1cmVzXG4gICAgICAgIGZvciAoY29uc3QgdGV4dHVyZSBvZiB0aGlzLnRleHR1cmVzKSB7XG4gICAgICAgICAgICB0ZXh0dXJlLmxvc2VDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZWxlYXNlIHZlcnRleCBhbmQgaW5kZXggYnVmZmVyc1xuICAgICAgICBmb3IgKGNvbnN0IGJ1ZmZlciBvZiB0aGlzLmJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIGJ1ZmZlci5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzZXQgYWxsIHJlbmRlciB0YXJnZXRzIHNvIHRoZXknbGwgYmUgcmVjcmVhdGVkIGFzIHJlcXVpcmVkLlxuICAgICAgICAvLyBUT0RPOiBhIHNvbHV0aW9uIGZvciB0aGUgY2FzZSB3aGVyZSBhIHJlbmRlciB0YXJnZXQgY29udGFpbnMgc29tZXRoaW5nXG4gICAgICAgIC8vIHRoYXQgd2FzIHByZXZpb3VzbHkgZ2VuZXJhdGVkIHRoYXQgbmVlZHMgdG8gYmUgcmUtcmVuZGVyZWQuXG4gICAgICAgIGZvciAoY29uc3QgdGFyZ2V0IG9mIHRoaXMudGFyZ2V0cykge1xuICAgICAgICAgICAgdGFyZ2V0Lmxvc2VDb250ZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgV2ViR0wgY29udGV4dCBpcyByZXN0b3JlZC4gSXQgcmVpbml0aWFsaXplcyBhbGwgY29udGV4dCByZWxhdGVkIHJlc291cmNlcy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZXN0b3JlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplRXh0ZW5zaW9ucygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVDYXBhYmlsaXRpZXMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplUmVuZGVyU3RhdGUoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuXG4gICAgICAgIC8vIFJlY29tcGlsZSBhbGwgc2hhZGVycyAodGhleSdsbCBiZSBsaW5rZWQgd2hlbiB0aGV5J3JlIG5leHQgYWN0dWFsbHkgdXNlZClcbiAgICAgICAgZm9yIChjb25zdCBzaGFkZXIgb2YgdGhpcy5zaGFkZXJzKSB7XG4gICAgICAgICAgICBzaGFkZXIucmVzdG9yZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlY3JlYXRlIGJ1ZmZlciBvYmplY3RzIGFuZCByZXVwbG9hZCBidWZmZXIgZGF0YSB0byB0aGUgR1BVXG4gICAgICAgIGZvciAoY29uc3QgYnVmZmVyIG9mIHRoaXMuYnVmZmVycykge1xuICAgICAgICAgICAgYnVmZmVyLnVubG9jaygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIGFmdGVyIGEgYmF0Y2ggb2Ygc2hhZGVycyB3YXMgY3JlYXRlZCwgdG8gZ3VpZGUgaW4gdGhlaXIgb3B0aW1hbCBwcmVwYXJhdGlvbiBmb3IgcmVuZGVyaW5nLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGVuZFNoYWRlckJhdGNoKCkge1xuICAgICAgICBXZWJnbFNoYWRlci5lbmRTaGFkZXJCYXRjaCh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGFjdGl2ZSByZWN0YW5nbGUgZm9yIHJlbmRlcmluZyBvbiB0aGUgc3BlY2lmaWVkIGRldmljZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHBpeGVsIHNwYWNlIHgtY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSB2aWV3cG9ydC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSBwaXhlbCBzcGFjZSB5LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgdmlld3BvcnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgd2lkdGggb2YgdGhlIHZpZXdwb3J0IGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBoZWlnaHQgb2YgdGhlIHZpZXdwb3J0IGluIHBpeGVscy5cbiAgICAgKi9cbiAgICBzZXRWaWV3cG9ydCh4LCB5LCB3LCBoKSB7XG4gICAgICAgIGlmICgodGhpcy52eCAhPT0geCkgfHwgKHRoaXMudnkgIT09IHkpIHx8ICh0aGlzLnZ3ICE9PSB3KSB8fCAodGhpcy52aCAhPT0gaCkpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wudmlld3BvcnQoeCwgeSwgdywgaCk7XG4gICAgICAgICAgICB0aGlzLnZ4ID0geDtcbiAgICAgICAgICAgIHRoaXMudnkgPSB5O1xuICAgICAgICAgICAgdGhpcy52dyA9IHc7XG4gICAgICAgICAgICB0aGlzLnZoID0gaDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgYWN0aXZlIHNjaXNzb3IgcmVjdGFuZ2xlIG9uIHRoZSBzcGVjaWZpZWQgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgcGl4ZWwgc3BhY2UgeC1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHBpeGVsIHNwYWNlIHktY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3aWR0aCBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIGhlaWdodCBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUgaW4gcGl4ZWxzLlxuICAgICAqL1xuICAgIHNldFNjaXNzb3IoeCwgeSwgdywgaCkge1xuICAgICAgICBpZiAoKHRoaXMuc3ggIT09IHgpIHx8ICh0aGlzLnN5ICE9PSB5KSB8fCAodGhpcy5zdyAhPT0gdykgfHwgKHRoaXMuc2ggIT09IGgpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnNjaXNzb3IoeCwgeSwgdywgaCk7XG4gICAgICAgICAgICB0aGlzLnN4ID0geDtcbiAgICAgICAgICAgIHRoaXMuc3kgPSB5O1xuICAgICAgICAgICAgdGhpcy5zdyA9IHc7XG4gICAgICAgICAgICB0aGlzLnNoID0gaDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEJpbmRzIHRoZSBzcGVjaWZpZWQgZnJhbWVidWZmZXIgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtXZWJHTEZyYW1lYnVmZmVyIHwgbnVsbH0gZmIgLSBUaGUgZnJhbWVidWZmZXIgdG8gYmluZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0RnJhbWVidWZmZXIoZmIpIHtcbiAgICAgICAgaWYgKHRoaXMuYWN0aXZlRnJhbWVidWZmZXIgIT09IGZiKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIGZiKTtcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlRnJhbWVidWZmZXIgPSBmYjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyBzb3VyY2UgcmVuZGVyIHRhcmdldCBpbnRvIGRlc3RpbmF0aW9uIHJlbmRlciB0YXJnZXQuIE1vc3RseSB1c2VkIGJ5IHBvc3QtZWZmZWN0cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyVGFyZ2V0fSBbc291cmNlXSAtIFRoZSBzb3VyY2UgcmVuZGVyIHRhcmdldC4gRGVmYXVsdHMgdG8gZnJhbWUgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7UmVuZGVyVGFyZ2V0fSBbZGVzdF0gLSBUaGUgZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldC4gRGVmYXVsdHMgdG8gZnJhbWUgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2NvbG9yXSAtIElmIHRydWUgd2lsbCBjb3B5IHRoZSBjb2xvciBidWZmZXIuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoXSAtIElmIHRydWUgd2lsbCBjb3B5IHRoZSBkZXB0aCBidWZmZXIuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBjb3B5IHdhcyBzdWNjZXNzZnVsLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgY29weVJlbmRlclRhcmdldChzb3VyY2UsIGRlc3QsIGNvbG9yLCBkZXB0aCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgaWYgKCF0aGlzLndlYmdsMiAmJiBkZXB0aCkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJEZXB0aCBpcyBub3QgY29weWFibGUgb24gV2ViR0wgMS4wXCIpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xvcikge1xuICAgICAgICAgICAgaWYgKCFkZXN0KSB7XG4gICAgICAgICAgICAgICAgLy8gY29weWluZyB0byBiYWNrYnVmZmVyXG4gICAgICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2NvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBlbXB0eSBjb2xvciBidWZmZXIgdG8gYmFja2J1ZmZlclwiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc291cmNlKSB7XG4gICAgICAgICAgICAgICAgLy8gY29weWluZyB0byByZW5kZXIgdGFyZ2V0XG4gICAgICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2NvbG9yQnVmZmVyIHx8ICFkZXN0Ll9jb2xvckJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgY29sb3IgYnVmZmVyLCBiZWNhdXNlIG9uZSBvZiB0aGUgcmVuZGVyIHRhcmdldHMgZG9lc24ndCBoYXZlIGl0XCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzb3VyY2UuX2NvbG9yQnVmZmVyLl9mb3JtYXQgIT09IGRlc3QuX2NvbG9yQnVmZmVyLl9mb3JtYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IHJlbmRlciB0YXJnZXRzIG9mIGRpZmZlcmVudCBjb2xvciBmb3JtYXRzXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChkZXB0aCAmJiBzb3VyY2UpIHtcbiAgICAgICAgICAgIGlmICghc291cmNlLl9kZXB0aCkgeyAgIC8vIHdoZW4gZGVwdGggaXMgYXV0b21hdGljLCB3ZSBjYW5ub3QgdGVzdCB0aGUgYnVmZmVyIG5vciBpdHMgZm9ybWF0XG4gICAgICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2RlcHRoQnVmZmVyIHx8ICFkZXN0Ll9kZXB0aEJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgZGVwdGggYnVmZmVyLCBiZWNhdXNlIG9uZSBvZiB0aGUgcmVuZGVyIHRhcmdldHMgZG9lc24ndCBoYXZlIGl0XCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzb3VyY2UuX2RlcHRoQnVmZmVyLl9mb3JtYXQgIT09IGRlc3QuX2RlcHRoQnVmZmVyLl9mb3JtYXQpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IHJlbmRlciB0YXJnZXRzIG9mIGRpZmZlcmVudCBkZXB0aCBmb3JtYXRzXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsICdDT1BZLVJUJyk7XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyICYmIGRlc3QpIHtcbiAgICAgICAgICAgIGNvbnN0IHByZXZSdCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSBkZXN0O1xuICAgICAgICAgICAgdGhpcy51cGRhdGVCZWdpbigpO1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLlJFQURfRlJBTUVCVUZGRVIsIHNvdXJjZSA/IHNvdXJjZS5pbXBsLl9nbEZyYW1lQnVmZmVyIDogbnVsbCk7XG4gICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRFJBV19GUkFNRUJVRkZFUiwgZGVzdC5pbXBsLl9nbEZyYW1lQnVmZmVyKTtcbiAgICAgICAgICAgIGNvbnN0IHcgPSBzb3VyY2UgPyBzb3VyY2Uud2lkdGggOiBkZXN0LndpZHRoO1xuICAgICAgICAgICAgY29uc3QgaCA9IHNvdXJjZSA/IHNvdXJjZS5oZWlnaHQgOiBkZXN0LmhlaWdodDtcbiAgICAgICAgICAgIGdsLmJsaXRGcmFtZWJ1ZmZlcigwLCAwLCB3LCBoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAsIDAsIHcsIGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGNvbG9yID8gZ2wuQ09MT1JfQlVGRkVSX0JJVCA6IDApIHwgKGRlcHRoID8gZ2wuREVQVEhfQlVGRkVSX0JJVCA6IDApLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdsLk5FQVJFU1QpO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSBwcmV2UnQ7XG4gICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHByZXZSdCA/IHByZXZSdC5pbXBsLl9nbEZyYW1lQnVmZmVyIDogbnVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzaGFkZXIgPSB0aGlzLmdldENvcHlTaGFkZXIoKTtcbiAgICAgICAgICAgIHRoaXMuY29uc3RhbnRUZXhTb3VyY2Uuc2V0VmFsdWUoc291cmNlLl9jb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICBxdWFkV2l0aFNoYWRlcih0aGlzLCBkZXN0LCBzaGFkZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGNvcHkgc2hhZGVyIGZvciBlZmZpY2llbnQgcmVuZGVyaW5nIG9mIGZ1bGxzY3JlZW4tcXVhZCB3aXRoIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U2hhZGVyfSBUaGUgY29weSBzaGFkZXIgKGJhc2VkIG9uIGBmdWxsc2NyZWVuUXVhZFZTYCBhbmQgYG91dHB1dFRleDJEUFNgIGluXG4gICAgICogYHNoYWRlckNodW5rc2ApLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRDb3B5U2hhZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2NvcHlTaGFkZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvcHlTaGFkZXIgPSBuZXcgU2hhZGVyKHRoaXMsIFNoYWRlclV0aWxzLmNyZWF0ZURlZmluaXRpb24odGhpcywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdvdXRwdXRUZXgyRCcsXG4gICAgICAgICAgICAgICAgdmVydGV4Q29kZTogX2Z1bGxTY3JlZW5RdWFkVlMsXG4gICAgICAgICAgICAgICAgZnJhZ21lbnRDb2RlOiBfb3V0cHV0VGV4dHVyZTJEXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvcHlTaGFkZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgYSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9yZW5kZXItcGFzcy5qcycpLlJlbmRlclBhc3N9IHJlbmRlclBhc3MgLSBUaGUgcmVuZGVyIHBhc3MgdG8gc3RhcnQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXJ0UGFzcyhyZW5kZXJQYXNzKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBTVEFSVC1QQVNTYCk7XG5cbiAgICAgICAgLy8gc2V0IHVwIHJlbmRlciB0YXJnZXRcbiAgICAgICAgdGhpcy5zZXRSZW5kZXJUYXJnZXQocmVuZGVyUGFzcy5yZW5kZXJUYXJnZXQpO1xuICAgICAgICB0aGlzLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICAgICAgLy8gY2xlYXIgdGhlIHJlbmRlciB0YXJnZXRcbiAgICAgICAgY29uc3QgY29sb3JPcHMgPSByZW5kZXJQYXNzLmNvbG9yT3BzO1xuICAgICAgICBjb25zdCBkZXB0aFN0ZW5jaWxPcHMgPSByZW5kZXJQYXNzLmRlcHRoU3RlbmNpbE9wcztcbiAgICAgICAgaWYgKGNvbG9yT3BzLmNsZWFyIHx8IGRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoIHx8IGRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWwpIHtcblxuICAgICAgICAgICAgLy8gdGhlIHBhc3MgYWx3YXlzIGNsZWFycyBmdWxsIHRhcmdldFxuICAgICAgICAgICAgY29uc3QgcnQgPSByZW5kZXJQYXNzLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIGNvbnN0IHdpZHRoID0gcnQgPyBydC53aWR0aCA6IHRoaXMud2lkdGg7XG4gICAgICAgICAgICBjb25zdCBoZWlnaHQgPSBydCA/IHJ0LmhlaWdodCA6IHRoaXMuaGVpZ2h0O1xuICAgICAgICAgICAgdGhpcy5zZXRWaWV3cG9ydCgwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcbiAgICAgICAgICAgIHRoaXMuc2V0U2Npc3NvcigwLCAwLCB3aWR0aCwgaGVpZ2h0KTtcblxuICAgICAgICAgICAgbGV0IGNsZWFyRmxhZ3MgPSAwO1xuICAgICAgICAgICAgY29uc3QgY2xlYXJPcHRpb25zID0ge307XG5cbiAgICAgICAgICAgIGlmIChjb2xvck9wcy5jbGVhcikge1xuICAgICAgICAgICAgICAgIGNsZWFyRmxhZ3MgfD0gQ0xFQVJGTEFHX0NPTE9SO1xuICAgICAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5jb2xvciA9IFtjb2xvck9wcy5jbGVhclZhbHVlLnIsIGNvbG9yT3BzLmNsZWFyVmFsdWUuZywgY29sb3JPcHMuY2xlYXJWYWx1ZS5iLCBjb2xvck9wcy5jbGVhclZhbHVlLmFdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGgpIHtcbiAgICAgICAgICAgICAgICBjbGVhckZsYWdzIHw9IENMRUFSRkxBR19ERVBUSDtcbiAgICAgICAgICAgICAgICBjbGVhck9wdGlvbnMuZGVwdGggPSBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aFZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgIGNsZWFyRmxhZ3MgfD0gQ0xFQVJGTEFHX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgY2xlYXJPcHRpb25zLnN0ZW5jaWwgPSBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsVmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIGl0XG4gICAgICAgICAgICBjbGVhck9wdGlvbnMuZmxhZ3MgPSBjbGVhckZsYWdzO1xuICAgICAgICAgICAgdGhpcy5jbGVhcihjbGVhck9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLmluc2lkZVJlbmRlclBhc3MsICdSZW5kZXJQYXNzIGNhbm5vdCBiZSBzdGFydGVkIHdoaWxlIGluc2lkZSBhbm90aGVyIHJlbmRlciBwYXNzLicpO1xuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSB0cnVlO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuZCBhIHJlbmRlciBwYXNzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBlbmQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGVuZFBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgRU5ELVBBU1NgKTtcblxuICAgICAgICB0aGlzLnVuYmluZFZlcnRleEFycmF5KCk7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGlmICh0YXJnZXQpIHtcblxuICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSBidWZmZXJzIHRvIHN0b3AgdGhlbSBiZWluZyB3cml0dGVuIHRvIG9uIHRpbGVkIGFyY2hpdGV4dHVyZXNcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgICAgIC8vIGludmFsaWRhdGUgY29sb3Igb25seSBpZiB3ZSBkb24ndCBuZWVkIHRvIHJlc29sdmUgaXRcbiAgICAgICAgICAgICAgICBpZiAoIShyZW5kZXJQYXNzLmNvbG9yT3BzLnN0b3JlIHx8IHJlbmRlclBhc3MuY29sb3JPcHMucmVzb2x2ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuQ09MT1JfQVRUQUNITUVOVDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuREVQVEhfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5wdXNoKGdsLlNURU5DSUxfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGludmFsaWRhdGVBdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSB0aGUgd2hvbGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IHdlIGNvdWxkIGhhbmRsZSB2aWV3cG9ydCBpbnZhbGlkYXRpb24gYXMgd2VsbFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuaW52YWxpZGF0ZUZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIGludmFsaWRhdGVBdHRhY2htZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlc29sdmUgdGhlIGNvbG9yIGJ1ZmZlclxuICAgICAgICAgICAgaWYgKHJlbmRlclBhc3MuY29sb3JPcHMucmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiByZW5kZXJQYXNzLnNhbXBsZXMgPiAxICYmIHRhcmdldC5hdXRvUmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSh0cnVlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSBtaXBtYXBzXG4gICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5jb2xvck9wcy5taXBtYXBzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSB0YXJnZXQuX2NvbG9yQnVmZmVyO1xuICAgICAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYmluZFRleHR1cmUoY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmdlbmVyYXRlTWlwbWFwKGNvbG9yQnVmZmVyLmltcGwuX2dsVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrcyB0aGUgYmVnaW5uaW5nIG9mIGEgYmxvY2sgb2YgcmVuZGVyaW5nLiBJbnRlcm5hbGx5LCB0aGlzIGZ1bmN0aW9uIGJpbmRzIHRoZSByZW5kZXJcbiAgICAgKiB0YXJnZXQgY3VycmVudGx5IHNldCBvbiB0aGUgZGV2aWNlLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBtYXRjaGVkIHdpdGggYSBjYWxsIHRvXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0uIENhbGxzIHRvIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVCZWdpbn0gYW5kXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0gbXVzdCBub3QgYmUgbmVzdGVkLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUJlZ2luKCkge1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ1VQREFURS1CRUdJTicpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuXG4gICAgICAgIC8vIGNsZWFyIHRleHR1cmUgdW5pdHMgb25jZSBhIGZyYW1lIG9uIGRlc2t0b3Agc2FmYXJpXG4gICAgICAgIGlmICh0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kKSB7XG4gICAgICAgICAgICBmb3IgKGxldCB1bml0ID0gMDsgdW5pdCA8IHRoaXMudGV4dHVyZVVuaXRzLmxlbmd0aDsgKyt1bml0KSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgc2xvdCA9IDA7IHNsb3QgPCAzOyArK3Nsb3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlVW5pdHNbdW5pdF1bc2xvdF0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IFdlYkdMIGZyYW1lIGJ1ZmZlciBvYmplY3RcbiAgICAgICAgICAgIGlmICghdGFyZ2V0LmltcGwuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQodGFyZ2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRGcmFtZWJ1ZmZlcih0YXJnZXQuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldEZyYW1lYnVmZmVyKHRoaXMuZGVmYXVsdEZyYW1lYnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBlbmQgb2YgYSBibG9jayBvZiByZW5kZXJpbmcuIFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNhbGxlZCBhZnRlciBhIG1hdGNoaW5nIGNhbGxcbiAgICAgKiB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59LiBDYWxscyB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59IGFuZFxuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVFbmR9IG11c3Qgbm90IGJlIG5lc3RlZC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVFbmQoKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBVUERBVEUtRU5EYCk7XG5cbiAgICAgICAgdGhpcy51bmJpbmRWZXJ0ZXhBcnJheSgpO1xuXG4gICAgICAgIC8vIFVuc2V0IHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgICAvLyBSZXNvbHZlIE1TQUEgaWYgbmVlZGVkXG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGFyZ2V0Ll9zYW1wbGVzID4gMSAmJiB0YXJnZXQuYXV0b1Jlc29sdmUpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgYWN0aXZlIHJlbmRlciB0YXJnZXQgaXMgYXV0by1taXBtYXBwZWQsIGdlbmVyYXRlIGl0cyBtaXAgY2hhaW5cbiAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGFyZ2V0Ll9jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgIC8vIEZJWE1FOiBpZiBjb2xvckJ1ZmZlciBpcyBhIGN1YmVtYXAgY3VycmVudGx5IHdlJ3JlIHJlLWdlbmVyYXRpbmcgbWlwbWFwcyBhZnRlclxuICAgICAgICAgICAgICAgIC8vIHVwZGF0aW5nIGVhY2ggZmFjZSFcbiAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZShjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5nbC5nZW5lcmF0ZU1pcG1hcChjb2xvckJ1ZmZlci5pbXBsLl9nbFRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSdzIHZlcnRpY2FsIGZsaXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZsaXBZIC0gVHJ1ZSB0byBmbGlwIHRoZSB0ZXh0dXJlIHZlcnRpY2FsbHkuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFVucGFja0ZsaXBZKGZsaXBZKSB7XG4gICAgICAgIGlmICh0aGlzLnVucGFja0ZsaXBZICE9PSBmbGlwWSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZsaXBZO1xuXG4gICAgICAgICAgICAvLyBOb3RlOiB0aGUgV2ViR0wgc3BlYyBzdGF0ZXMgdGhhdCBVTlBBQ0tfRkxJUF9ZX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmbGlwWSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSB0byBoYXZlIGl0cyBSR0IgY2hhbm5lbHMgcHJlbXVsdGlwbGllZCBieSBpdHMgYWxwaGEgY2hhbm5lbCBvciBub3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByZW11bHRpcGx5QWxwaGEgLSBUcnVlIHRvIHByZW11bHRpcGx5IHRoZSBhbHBoYSBjaGFubmVsIGFnYWluc3QgdGhlIFJHQlxuICAgICAqIGNoYW5uZWxzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgaWYgKHRoaXMudW5wYWNrUHJlbXVsdGlwbHlBbHBoYSAhPT0gcHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gcHJlbXVsdGlwbHlBbHBoYTtcblxuICAgICAgICAgICAgLy8gTm90ZTogdGhlIFdlYkdMIHNwZWMgc3RhdGVzIHRoYXQgVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIHByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWN0aXZhdGUgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KSB7XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0ICE9PSB0ZXh0dXJlVW5pdCkge1xuICAgICAgICAgICAgdGhpcy5nbC5hY3RpdmVUZXh0dXJlKHRoaXMuZ2wuVEVYVFVSRTAgKyB0ZXh0dXJlVW5pdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0ID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgdGV4dHVyZSBpcyBub3QgYWxyZWFkeSBib3VuZCBvbiB0aGUgY3VycmVudGx5IGFjdGl2ZSB0ZXh0dXJlIHVuaXQsIGJpbmQgaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byBiaW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZSh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IGltcGwgPSB0ZXh0dXJlLmltcGw7XG4gICAgICAgIGNvbnN0IHRleHR1cmVUYXJnZXQgPSBpbXBsLl9nbFRhcmdldDtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9iamVjdCA9IGltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgY29uc3QgdGV4dHVyZVVuaXQgPSB0aGlzLnRleHR1cmVVbml0O1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy50YXJnZXRUb1Nsb3RbdGV4dHVyZVRhcmdldF07XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gIT09IHRleHR1cmVPYmplY3QpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIHRleHR1cmUgaXMgbm90IGJvdW5kIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LCBhY3RpdmUgdGhlIHRleHR1cmUgdW5pdCBhbmQgYmluZFxuICAgICAqIHRoZSB0ZXh0dXJlIHRvIGl0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gYmluZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlIGFuZCBiaW5kIHRoZSB0ZXh0dXJlIHRvLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCkge1xuICAgICAgICBjb25zdCBpbXBsID0gdGV4dHVyZS5pbXBsO1xuICAgICAgICBjb25zdCB0ZXh0dXJlVGFyZ2V0ID0gaW1wbC5fZ2xUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHRleHR1cmVPYmplY3QgPSBpbXBsLl9nbFRleHR1cmU7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnRhcmdldFRvU2xvdFt0ZXh0dXJlVGFyZ2V0XTtcbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSAhPT0gdGV4dHVyZU9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSB0ZXh0dXJlIHBhcmFtZXRlcnMgZm9yIGEgZ2l2ZW4gdGV4dHVyZSBpZiB0aGV5IGhhdmUgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHVwZGF0ZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VGV4dHVyZVBhcmFtZXRlcnModGV4dHVyZSkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGNvbnN0IGZsYWdzID0gdGV4dHVyZS5fcGFyYW1ldGVyRmxhZ3M7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRleHR1cmUuaW1wbC5fZ2xUYXJnZXQ7XG5cbiAgICAgICAgaWYgKGZsYWdzICYgMSkge1xuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHRleHR1cmUuX21pbkZpbHRlcjtcbiAgICAgICAgICAgIGlmICgoIXRleHR1cmUucG90ICYmICF0aGlzLndlYmdsMikgfHwgIXRleHR1cmUuX21pcG1hcHMgfHwgKHRleHR1cmUuX2NvbXByZXNzZWQgJiYgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aCA9PT0gMSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmlsdGVyID09PSBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCB8fCBmaWx0ZXIgPT09IEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX05FQVJFU1Q7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmaWx0ZXIgPT09IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QgfHwgZmlsdGVyID09PSBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCB0aGlzLmdsRmlsdGVyW2ZpbHRlcl0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDIpIHtcbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX01BR19GSUxURVIsIHRoaXMuZ2xGaWx0ZXJbdGV4dHVyZS5fbWFnRmlsdGVyXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9TLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzVV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBXZWJHTDEgZG9lc24ndCBzdXBwb3J0IGFsbCBhZGRyZXNzaW5nIG1vZGVzIHdpdGggTlBPVCB0ZXh0dXJlc1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUywgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5wb3QgPyB0ZXh0dXJlLl9hZGRyZXNzVSA6IEFERFJFU1NfQ0xBTVBfVE9fRURHRV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfVCwgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5fYWRkcmVzc1ZdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gV2ViR0wxIGRvZXNuJ3Qgc3VwcG9ydCBhbGwgYWRkcmVzc2luZyBtb2RlcyB3aXRoIE5QT1QgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1QsIHRoaXMuZ2xBZGRyZXNzW3RleHR1cmUucG90ID8gdGV4dHVyZS5fYWRkcmVzc1YgOiBBRERSRVNTX0NMQU1QX1RPX0VER0VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxNikge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9SLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzV10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDMyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9DT01QQVJFX01PREUsIHRleHR1cmUuX2NvbXBhcmVPblJlYWQgPyBnbC5DT01QQVJFX1JFRl9UT19URVhUVVJFIDogZ2wuTk9ORSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNjQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX0NPTVBBUkVfRlVOQywgdGhpcy5nbENvbXBhcmlzb25bdGV4dHVyZS5fY29tcGFyZUZ1bmNdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxMjgpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljO1xuICAgICAgICAgICAgaWYgKGV4dCkge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmYodGFyZ2V0LCBleHQuVEVYVFVSRV9NQVhfQU5JU09UUk9QWV9FWFQsIE1hdGgubWF4KDEsIE1hdGgubWluKE1hdGgucm91bmQodGV4dHVyZS5fYW5pc290cm9weSksIHRoaXMubWF4QW5pc290cm9weSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0ZXh0dXJlVW5pdCAtIFRoZSB0ZXh0dXJlIHVuaXQgdG8gc2V0IHRoZSB0ZXh0dXJlIG9uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KSB7XG5cbiAgICAgICAgaWYgKCF0ZXh0dXJlLmltcGwuX2dsVGV4dHVyZSlcbiAgICAgICAgICAgIHRleHR1cmUuaW1wbC5pbml0aWFsaXplKHRoaXMsIHRleHR1cmUpO1xuXG4gICAgICAgIGlmICh0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncyA+IDAgfHwgdGV4dHVyZS5fbmVlZHNVcGxvYWQgfHwgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkKSB7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdCBpcyBhY3RpdmVcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlVGV4dHVyZSh0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgdGV4dHVyZSBpcyBib3VuZCBvbiBjb3JyZWN0IHRhcmdldCBvZiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdFxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZSh0ZXh0dXJlKTtcblxuICAgICAgICAgICAgaWYgKHRleHR1cmUuX3BhcmFtZXRlckZsYWdzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlUGFyYW1ldGVycyh0ZXh0dXJlKTtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncyA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9uZWVkc1VwbG9hZCB8fCB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLmltcGwudXBsb2FkKHRoaXMsIHRleHR1cmUpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX25lZWRzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIHRleHR1cmUgaXMgY3VycmVudGx5IGJvdW5kIHRvIHRoZSBjb3JyZWN0IHRhcmdldCBvbiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdC5cbiAgICAgICAgICAgIC8vIElmIHRoZSB0ZXh0dXJlIGlzIGFscmVhZHkgYm91bmQgdG8gdGhlIGNvcnJlY3QgdGFyZ2V0IG9uIHRoZSBzcGVjaWZpZWQgdW5pdCwgdGhlcmUncyBubyBuZWVkXG4gICAgICAgICAgICAvLyB0byBhY3R1YWxseSBtYWtlIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0IGFjdGl2ZSBiZWNhdXNlIHRoZSB0ZXh0dXJlIGl0c2VsZiBkb2VzIG5vdCBuZWVkXG4gICAgICAgICAgICAvLyB0byBiZSB1cGRhdGVkLlxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBjcmVhdGVzIFZlcnRleEFycmF5T2JqZWN0IGZyb20gbGlzdCBvZiB2ZXJ0ZXggYnVmZmVyc1xuICAgIGNyZWF0ZVZlcnRleEFycmF5KHZlcnRleEJ1ZmZlcnMpIHtcblxuICAgICAgICBsZXQga2V5LCB2YW87XG5cbiAgICAgICAgLy8gb25seSB1c2UgY2FjaGUgd2hlbiBtb3JlIHRoYW4gMSB2ZXJ0ZXggYnVmZmVyLCBvdGhlcndpc2UgaXQncyB1bmlxdWVcbiAgICAgICAgY29uc3QgdXNlQ2FjaGUgPSB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA+IDE7XG4gICAgICAgIGlmICh1c2VDYWNoZSkge1xuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSB1bmlxdWUga2V5IGZvciB0aGUgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIGtleSA9IFwiXCI7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRleEJ1ZmZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXJzW2ldO1xuICAgICAgICAgICAgICAgIGtleSArPSB2ZXJ0ZXhCdWZmZXIuaWQgKyB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnJlbmRlcmluZ2luZ0hhc2g7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRyeSB0byBnZXQgVkFPIGZyb20gY2FjaGVcbiAgICAgICAgICAgIHZhbyA9IHRoaXMuX3Zhb01hcC5nZXQoa2V5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5lZWQgdG8gY3JlYXRlIG5ldyB2YW9cbiAgICAgICAgaWYgKCF2YW8pIHtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIFZBIG9iamVjdFxuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgdmFvID0gZ2wuY3JlYXRlVmVydGV4QXJyYXkoKTtcbiAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSh2YW8pO1xuXG4gICAgICAgICAgICAvLyBkb24ndCBjYXB0dXJlIGluZGV4IGJ1ZmZlciBpbiBWQU9cbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIG51bGwpO1xuXG4gICAgICAgICAgICBsZXQgbG9jWmVybyA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBiaW5kIGJ1ZmZlclxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcnNbaV07XG4gICAgICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZlcnRleEJ1ZmZlci5pbXBsLmJ1ZmZlcklkKTtcblxuICAgICAgICAgICAgICAgIC8vIGZvciBlYWNoIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGVsZW1lbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUgPSBlbGVtZW50c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9jID0gc2VtYW50aWNUb0xvY2F0aW9uW2UubmFtZV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvYyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jWmVybyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvYywgZS5udW1Db21wb25lbnRzLCB0aGlzLmdsVHlwZVtlLmRhdGFUeXBlXSwgZS5ub3JtYWxpemUsIGUuc3RyaWRlLCBlLm9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvYyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHZlcnRleEJ1ZmZlci5mb3JtYXQuaW5zdGFuY2luZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wudmVydGV4QXR0cmliRGl2aXNvcihsb2MsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbmQgb2YgVkEgb2JqZWN0XG4gICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkobnVsbCk7XG5cbiAgICAgICAgICAgIC8vIHVuYmluZCBhbnkgYXJyYXkgYnVmZmVyXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgbnVsbCk7XG5cbiAgICAgICAgICAgIC8vIGFkZCBpdCB0byBjYWNoZVxuICAgICAgICAgICAgaWYgKHVzZUNhY2hlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdmFvTWFwLnNldChrZXksIHZhbyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghbG9jWmVybykge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJObyB2ZXJ0ZXggYXR0cmlidXRlIGlzIG1hcHBlZCB0byBsb2NhdGlvbiAwLCB3aGljaCBtaWdodCBjYXVzZSBjb21wYXRpYmlsaXR5IGlzc3VlcyBvbiBTYWZhcmkgb24gTWFjT1MgLSBwbGVhc2UgdXNlIGF0dHJpYnV0ZSBTRU1BTlRJQ19QT1NJVElPTiBvciBTRU1BTlRJQ19BVFRSMTVcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFvO1xuICAgIH1cblxuICAgIHVuYmluZFZlcnRleEFycmF5KCkge1xuICAgICAgICAvLyB1bmJpbmQgVkFPIGZyb20gZGV2aWNlIHRvIHByb3RlY3QgaXQgZnJvbSBiZWluZyBjaGFuZ2VkXG4gICAgICAgIGlmICh0aGlzLmJvdW5kVmFvKSB7XG4gICAgICAgICAgICB0aGlzLmJvdW5kVmFvID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFZlcnRleEFycmF5KG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0QnVmZmVycygpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBsZXQgdmFvO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBWQU8gZm9yIHNwZWNpZmllZCB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICBpZiAodGhpcy52ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA9PT0gMSkge1xuXG4gICAgICAgICAgICAvLyBzaW5nbGUgVkIga2VlcHMgaXRzIFZBT1xuICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gdGhpcy52ZXJ0ZXhCdWZmZXJzWzBdO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZlcnRleEJ1ZmZlci5kZXZpY2UgPT09IHRoaXMsIFwiVGhlIFZlcnRleEJ1ZmZlciB3YXMgbm90IGNyZWF0ZWQgdXNpbmcgY3VycmVudCBHcmFwaGljc0RldmljZVwiKTtcbiAgICAgICAgICAgIGlmICghdmVydGV4QnVmZmVyLmltcGwudmFvKSB7XG4gICAgICAgICAgICAgICAgdmVydGV4QnVmZmVyLmltcGwudmFvID0gdGhpcy5jcmVhdGVWZXJ0ZXhBcnJheSh0aGlzLnZlcnRleEJ1ZmZlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFvID0gdmVydGV4QnVmZmVyLmltcGwudmFvO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gb2J0YWluIHRlbXBvcmFyeSBWQU8gZm9yIG11bHRpcGxlIHZlcnRleCBidWZmZXJzXG4gICAgICAgICAgICB2YW8gPSB0aGlzLmNyZWF0ZVZlcnRleEFycmF5KHRoaXMudmVydGV4QnVmZmVycyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgYWN0aXZlIFZBT1xuICAgICAgICBpZiAodGhpcy5ib3VuZFZhbyAhPT0gdmFvKSB7XG4gICAgICAgICAgICB0aGlzLmJvdW5kVmFvID0gdmFvO1xuICAgICAgICAgICAgZ2wuYmluZFZlcnRleEFycmF5KHZhbyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbXB0eSBhcnJheSBvZiB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlcnMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBTZXQgdGhlIGFjdGl2ZSBpbmRleCBidWZmZXIgb2JqZWN0XG4gICAgICAgIC8vIE5vdGU6IHdlIGRvbid0IGNhY2hlIHRoaXMgc3RhdGUgYW5kIHNldCBpdCBvbmx5IHdoZW4gaXQgY2hhbmdlcywgYXMgVkFPIGNhcHR1cmVzIGxhc3QgYmluZCBidWZmZXIgaW4gaXRcbiAgICAgICAgLy8gYW5kIHNvIHdlIGRvbid0IGtub3cgd2hhdCBWQU8gc2V0cyBpdCB0by5cbiAgICAgICAgY29uc3QgYnVmZmVySWQgPSB0aGlzLmluZGV4QnVmZmVyID8gdGhpcy5pbmRleEJ1ZmZlci5pbXBsLmJ1ZmZlcklkIDogbnVsbDtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgYnVmZmVySWQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1Ym1pdHMgYSBncmFwaGljYWwgcHJpbWl0aXZlIHRvIHRoZSBoYXJkd2FyZSBmb3IgaW1tZWRpYXRlIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwcmltaXRpdmUgLSBQcmltaXRpdmUgb2JqZWN0IGRlc2NyaWJpbmcgaG93IHRvIHN1Ym1pdCBjdXJyZW50IHZlcnRleC9pbmRleFxuICAgICAqIGJ1ZmZlcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS50eXBlIC0gVGhlIHR5cGUgb2YgcHJpbWl0aXZlIHRvIHJlbmRlci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1BPSU5UU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORVN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVMT09QfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUFOR0xFU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUZBTn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwcmltaXRpdmUuYmFzZSAtIFRoZSBvZmZzZXQgb2YgdGhlIGZpcnN0IGluZGV4IG9yIHZlcnRleCB0byBkaXNwYXRjaCBpbiB0aGVcbiAgICAgKiBkcmF3IGNhbGwuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS5jb3VudCAtIFRoZSBudW1iZXIgb2YgaW5kaWNlcyBvciB2ZXJ0aWNlcyB0byBkaXNwYXRjaCBpbiB0aGUgZHJhd1xuICAgICAqIGNhbGwuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbcHJpbWl0aXZlLmluZGV4ZWRdIC0gVHJ1ZSB0byBpbnRlcnByZXQgdGhlIHByaW1pdGl2ZSBhcyBpbmRleGVkLCB0aGVyZWJ5XG4gICAgICogdXNpbmcgdGhlIGN1cnJlbnRseSBzZXQgaW5kZXggYnVmZmVyIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1JbnN0YW5jZXM9MV0gLSBUaGUgbnVtYmVyIG9mIGluc3RhbmNlcyB0byByZW5kZXIgd2hlbiB1c2luZ1xuICAgICAqIEFOR0xFX2luc3RhbmNlZF9hcnJheXMuIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBba2VlcEJ1ZmZlcnNdIC0gT3B0aW9uYWxseSBrZWVwIHRoZSBjdXJyZW50IHNldCBvZiB2ZXJ0ZXggLyBpbmRleCBidWZmZXJzIC9cbiAgICAgKiBWQU8uIFRoaXMgaXMgdXNlZCB3aGVuIHJlbmRlcmluZyBvZiBtdWx0aXBsZSB2aWV3cywgZm9yIGV4YW1wbGUgdW5kZXIgV2ViWFIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSBzaW5nbGUsIHVuaW5kZXhlZCB0cmlhbmdsZVxuICAgICAqIGRldmljZS5kcmF3KHtcbiAgICAgKiAgICAgdHlwZTogcGMuUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICAgKiAgICAgYmFzZTogMCxcbiAgICAgKiAgICAgY291bnQ6IDMsXG4gICAgICogICAgIGluZGV4ZWQ6IGZhbHNlXG4gICAgICogfSk7XG4gICAgICovXG4gICAgZHJhdyhwcmltaXRpdmUsIG51bUluc3RhbmNlcywga2VlcEJ1ZmZlcnMpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGxldCBzYW1wbGVyLCBzYW1wbGVyVmFsdWUsIHRleHR1cmUsIG51bVRleHR1cmVzOyAvLyBTYW1wbGVyc1xuICAgICAgICBsZXQgdW5pZm9ybSwgc2NvcGVJZCwgdW5pZm9ybVZlcnNpb24sIHByb2dyYW1WZXJzaW9uOyAvLyBVbmlmb3Jtc1xuICAgICAgICBjb25zdCBzaGFkZXIgPSB0aGlzLnNoYWRlcjtcbiAgICAgICAgaWYgKCFzaGFkZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IHNhbXBsZXJzID0gc2hhZGVyLmltcGwuc2FtcGxlcnM7XG4gICAgICAgIGNvbnN0IHVuaWZvcm1zID0gc2hhZGVyLmltcGwudW5pZm9ybXM7XG5cbiAgICAgICAgLy8gdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgaWYgKCFrZWVwQnVmZmVycykge1xuICAgICAgICAgICAgdGhpcy5zZXRCdWZmZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21taXQgdGhlIHNoYWRlciBwcm9ncmFtIHZhcmlhYmxlc1xuICAgICAgICBsZXQgdGV4dHVyZVVuaXQgPSAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzYW1wbGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgc2FtcGxlciA9IHNhbXBsZXJzW2ldO1xuICAgICAgICAgICAgc2FtcGxlclZhbHVlID0gc2FtcGxlci5zY29wZUlkLnZhbHVlO1xuICAgICAgICAgICAgaWYgKCFzYW1wbGVyVmFsdWUpIHtcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBjb25zdCBzYW1wbGVyTmFtZSA9IHNhbXBsZXIuc2NvcGVJZC5uYW1lO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyTmFtZSA9PT0gJ3VTY2VuZURlcHRoTWFwJyB8fCBzYW1wbGVyTmFtZSA9PT0gJ3VEZXB0aE1hcCcpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgZGVwdGggdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZURlcHRoTWFwIHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXJOYW1lID09PSAndVNjZW5lQ29sb3JNYXAnIHx8IHNhbXBsZXJOYW1lID09PSAndGV4dHVyZV9ncmFiUGFzcycpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgZGVwdGggdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZUNvbG9yTWFwIHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvck9uY2UoYFNoYWRlciBbJHtzaGFkZXIubGFiZWx9XSByZXF1aXJlcyB0ZXh0dXJlIHNhbXBsZXIgWyR7c2FtcGxlck5hbWV9XSB3aGljaCBoYXMgbm90IGJlZW4gc2V0LCB3aGlsZSByZW5kZXJpbmcgWyR7RGVidWdHcmFwaGljcy50b1N0cmluZygpfV1gKTtcblxuICAgICAgICAgICAgICAgIC8vIHNraXAgdGhpcyBkcmF3IGNhbGwgdG8gYXZvaWQgaW5jb3JyZWN0IHJlbmRlcmluZyAvIHdlYmdsIGVycm9yc1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNhbXBsZXJWYWx1ZSBpbnN0YW5jZW9mIFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlID0gc2FtcGxlclZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNldCBicmVha3BvaW50IGhlcmUgdG8gZGVidWcgXCJTb3VyY2UgYW5kIGRlc3RpbmF0aW9uIHRleHR1cmVzIG9mIHRoZSBkcmF3IGFyZSB0aGUgc2FtZVwiIGVycm9yc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuX3NhbXBsZXMgPCAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgJiYgdGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgPT09IHRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIlRyeWluZyB0byBiaW5kIGN1cnJlbnQgY29sb3IgYnVmZmVyIGFzIGEgdGV4dHVyZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5yZW5kZXJUYXJnZXQuZGVwdGhCdWZmZXIgJiYgdGhpcy5yZW5kZXJUYXJnZXQuZGVwdGhCdWZmZXIgPT09IHRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIlRyeWluZyB0byBiaW5kIGN1cnJlbnQgZGVwdGggYnVmZmVyIGFzIGEgdGV4dHVyZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyLnNsb3QgIT09IHRleHR1cmVVbml0KSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xaShzYW1wbGVyLmxvY2F0aW9uSWQsIHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlci5zbG90ID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRleHR1cmVVbml0Kys7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBBcnJheVxuICAgICAgICAgICAgICAgIHNhbXBsZXIuYXJyYXkubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICBudW1UZXh0dXJlcyA9IHNhbXBsZXJWYWx1ZS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1UZXh0dXJlczsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmUgPSBzYW1wbGVyVmFsdWVbal07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlci5hcnJheVtqXSA9IHRleHR1cmVVbml0O1xuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlVW5pdCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMWl2KHNhbXBsZXIubG9jYXRpb25JZCwgc2FtcGxlci5hcnJheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21taXQgYW55IHVwZGF0ZWQgdW5pZm9ybXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHVuaWZvcm1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB1bmlmb3JtID0gdW5pZm9ybXNbaV07XG4gICAgICAgICAgICBzY29wZUlkID0gdW5pZm9ybS5zY29wZUlkO1xuICAgICAgICAgICAgdW5pZm9ybVZlcnNpb24gPSB1bmlmb3JtLnZlcnNpb247XG4gICAgICAgICAgICBwcm9ncmFtVmVyc2lvbiA9IHNjb3BlSWQudmVyc2lvbk9iamVjdC52ZXJzaW9uO1xuXG4gICAgICAgICAgICAvLyBDaGVjayB0aGUgdmFsdWUgaXMgdmFsaWRcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmVyc2lvbi5nbG9iYWxJZCAhPT0gcHJvZ3JhbVZlcnNpb24uZ2xvYmFsSWQgfHwgdW5pZm9ybVZlcnNpb24ucmV2aXNpb24gIT09IHByb2dyYW1WZXJzaW9uLnJldmlzaW9uKSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZlcnNpb24uZ2xvYmFsSWQgPSBwcm9ncmFtVmVyc2lvbi5nbG9iYWxJZDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmVyc2lvbi5yZXZpc2lvbiA9IHByb2dyYW1WZXJzaW9uLnJldmlzaW9uO1xuXG4gICAgICAgICAgICAgICAgLy8gQ2FsbCB0aGUgZnVuY3Rpb24gdG8gY29tbWl0IHRoZSB1bmlmb3JtIHZhbHVlXG4gICAgICAgICAgICAgICAgaWYgKHNjb3BlSWQudmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvblt1bmlmb3JtLmRhdGFUeXBlXSh1bmlmb3JtLCBzY29wZUlkLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb21tZW50ZWQgb3V0IHRpbGwgZW5naW5lIGlzc3VlICM0OTcxIGlzIHNvcnRlZCBvdXRcbiAgICAgICAgICAgICAgICAgICAgLy8gRGVidWcud2Fybk9uY2UoYFNoYWRlciBbJHtzaGFkZXIubGFiZWx9XSByZXF1aXJlcyB1bmlmb3JtIFske3VuaWZvcm0uc2NvcGVJZC5uYW1lfV0gd2hpY2ggaGFzIG5vdCBiZWVuIHNldCwgd2hpbGUgcmVuZGVyaW5nIFske0RlYnVnR3JhcGhpY3MudG9TdHJpbmcoKX1dYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyICYmIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIEVuYWJsZSBURiwgc3RhcnQgd3JpdGluZyB0byBvdXQgYnVmZmVyXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyQmFzZShnbC5UUkFOU0ZPUk1fRkVFREJBQ0tfQlVGRkVSLCAwLCB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyLmltcGwuYnVmZmVySWQpO1xuICAgICAgICAgICAgZ2wuYmVnaW5UcmFuc2Zvcm1GZWVkYmFjayhnbC5QT0lOVFMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbW9kZSA9IHRoaXMuZ2xQcmltaXRpdmVbcHJpbWl0aXZlLnR5cGVdO1xuICAgICAgICBjb25zdCBjb3VudCA9IHByaW1pdGl2ZS5jb3VudDtcblxuICAgICAgICBpZiAocHJpbWl0aXZlLmluZGV4ZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gdGhpcy5pbmRleEJ1ZmZlcjtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChpbmRleEJ1ZmZlci5kZXZpY2UgPT09IHRoaXMsIFwiVGhlIEluZGV4QnVmZmVyIHdhcyBub3QgY3JlYXRlZCB1c2luZyBjdXJyZW50IEdyYXBoaWNzRGV2aWNlXCIpO1xuXG4gICAgICAgICAgICBjb25zdCBmb3JtYXQgPSBpbmRleEJ1ZmZlci5pbXBsLmdsRm9ybWF0O1xuICAgICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gcHJpbWl0aXZlLmJhc2UgKiBpbmRleEJ1ZmZlci5ieXRlc1BlckluZGV4O1xuXG4gICAgICAgICAgICBpZiAobnVtSW5zdGFuY2VzID4gMCkge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdFbGVtZW50c0luc3RhbmNlZChtb2RlLCBjb3VudCwgZm9ybWF0LCBvZmZzZXQsIG51bUluc3RhbmNlcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdFbGVtZW50cyhtb2RlLCBjb3VudCwgZm9ybWF0LCBvZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZmlyc3QgPSBwcmltaXRpdmUuYmFzZTtcblxuICAgICAgICAgICAgaWYgKG51bUluc3RhbmNlcyA+IDApIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3QXJyYXlzSW5zdGFuY2VkKG1vZGUsIGZpcnN0LCBjb3VudCwgbnVtSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0FycmF5cyhtb2RlLCBmaXJzdCwgY291bnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyICYmIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIGRpc2FibGUgVEZcbiAgICAgICAgICAgIGdsLmVuZFRyYW5zZm9ybUZlZWRiYWNrKCk7XG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyQmFzZShnbC5UUkFOU0ZPUk1fRkVFREJBQ0tfQlVGRkVSLCAwLCBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2RyYXdDYWxsc1BlckZyYW1lKys7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9wcmltc1BlckZyYW1lW3ByaW1pdGl2ZS50eXBlXSArPSBwcmltaXRpdmUuY291bnQgKiAobnVtSW5zdGFuY2VzID4gMSA/IG51bUluc3RhbmNlcyA6IDEpO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgdGhlIGZyYW1lIGJ1ZmZlciBvZiB0aGUgY3VycmVudGx5IHNldCByZW5kZXIgdGFyZ2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHRoYXQgY29udHJvbHMgdGhlIGJlaGF2aW9yIG9mIHRoZSBjbGVhclxuICAgICAqIG9wZXJhdGlvbiBkZWZpbmVkIGFzIGZvbGxvd3M6XG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gW29wdGlvbnMuY29sb3JdIC0gVGhlIGNvbG9yIHRvIGNsZWFyIHRoZSBjb2xvciBidWZmZXIgdG8gaW4gdGhlIHJhbmdlIDAuMFxuICAgICAqIHRvIDEuMCBmb3IgZWFjaCBjb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmRlcHRoPTFdIC0gVGhlIGRlcHRoIHZhbHVlIHRvIGNsZWFyIHRoZSBkZXB0aCBidWZmZXIgdG8gaW4gdGhlXG4gICAgICogcmFuZ2UgMC4wIHRvIDEuMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmxhZ3NdIC0gVGhlIGJ1ZmZlcnMgdG8gY2xlYXIgKHRoZSB0eXBlcyBiZWluZyBjb2xvciwgZGVwdGggYW5kXG4gICAgICogc3RlbmNpbCkuIENhbiBiZSBhbnkgYml0d2lzZSBjb21iaW5hdGlvbiBvZjpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIENMRUFSRkxBR19DT0xPUn1cbiAgICAgKiAtIHtAbGluayBDTEVBUkZMQUdfREVQVEh9XG4gICAgICogLSB7QGxpbmsgQ0xFQVJGTEFHX1NURU5DSUx9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3RlbmNpbD0wXSAtIFRoZSBzdGVuY2lsIHZhbHVlIHRvIGNsZWFyIHRoZSBzdGVuY2lsIGJ1ZmZlciB0by4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENsZWFyIGNvbG9yIGJ1ZmZlciB0byBibGFjayBhbmQgZGVwdGggYnVmZmVyIHRvIDEuMFxuICAgICAqIGRldmljZS5jbGVhcigpO1xuICAgICAqXG4gICAgICogLy8gQ2xlYXIganVzdCB0aGUgY29sb3IgYnVmZmVyIHRvIHJlZFxuICAgICAqIGRldmljZS5jbGVhcih7XG4gICAgICogICAgIGNvbG9yOiBbMSwgMCwgMCwgMV0sXG4gICAgICogICAgIGZsYWdzOiBwYy5DTEVBUkZMQUdfQ09MT1JcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIENsZWFyIGNvbG9yIGJ1ZmZlciB0byB5ZWxsb3cgYW5kIGRlcHRoIHRvIDEuMFxuICAgICAqIGRldmljZS5jbGVhcih7XG4gICAgICogICAgIGNvbG9yOiBbMSwgMSwgMCwgMV0sXG4gICAgICogICAgIGRlcHRoOiAxLFxuICAgICAqICAgICBmbGFnczogcGMuQ0xFQVJGTEFHX0NPTE9SIHwgcGMuQ0xFQVJGTEFHX0RFUFRIXG4gICAgICogfSk7XG4gICAgICovXG4gICAgY2xlYXIob3B0aW9ucykge1xuICAgICAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHRoaXMuZGVmYXVsdENsZWFyT3B0aW9ucztcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgZGVmYXVsdE9wdGlvbnM7XG5cbiAgICAgICAgY29uc3QgZmxhZ3MgPSAob3B0aW9ucy5mbGFncyA9PT0gdW5kZWZpbmVkKSA/IGRlZmF1bHRPcHRpb25zLmZsYWdzIDogb3B0aW9ucy5mbGFncztcbiAgICAgICAgaWYgKGZsYWdzICE9PSAwKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgICAgIC8vIFNldCB0aGUgY2xlYXIgY29sb3JcbiAgICAgICAgICAgIGlmIChmbGFncyAmIENMRUFSRkxBR19DT0xPUikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9yID0gKG9wdGlvbnMuY29sb3IgPT09IHVuZGVmaW5lZCkgPyBkZWZhdWx0T3B0aW9ucy5jb2xvciA6IG9wdGlvbnMuY29sb3I7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRDbGVhckNvbG9yKGNvbG9yWzBdLCBjb2xvclsxXSwgY29sb3JbMl0sIGNvbG9yWzNdKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldENvbG9yV3JpdGUodHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGFncyAmIENMRUFSRkxBR19ERVBUSCkge1xuICAgICAgICAgICAgICAgIC8vIFNldCB0aGUgY2xlYXIgZGVwdGhcbiAgICAgICAgICAgICAgICBjb25zdCBkZXB0aCA9IChvcHRpb25zLmRlcHRoID09PSB1bmRlZmluZWQpID8gZGVmYXVsdE9wdGlvbnMuZGVwdGggOiBvcHRpb25zLmRlcHRoO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q2xlYXJEZXB0aChkZXB0aCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXREZXB0aFdyaXRlKHRydWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmxhZ3MgJiBDTEVBUkZMQUdfU1RFTkNJTCkge1xuICAgICAgICAgICAgICAgIC8vIFNldCB0aGUgY2xlYXIgc3RlbmNpbFxuICAgICAgICAgICAgICAgIGNvbnN0IHN0ZW5jaWwgPSAob3B0aW9ucy5zdGVuY2lsID09PSB1bmRlZmluZWQpID8gZGVmYXVsdE9wdGlvbnMuc3RlbmNpbCA6IG9wdGlvbnMuc3RlbmNpbDtcbiAgICAgICAgICAgICAgICB0aGlzLnNldENsZWFyU3RlbmNpbChzdGVuY2lsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2xlYXIgdGhlIGZyYW1lIGJ1ZmZlclxuICAgICAgICAgICAgZ2wuY2xlYXIodGhpcy5nbENsZWFyRmxhZ1tmbGFnc10pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVhZHMgYSBibG9jayBvZiBwaXhlbHMgZnJvbSBhIHNwZWNpZmllZCByZWN0YW5nbGUgb2YgdGhlIGN1cnJlbnQgY29sb3IgZnJhbWVidWZmZXIgaW50byBhblxuICAgICAqIEFycmF5QnVmZmVyVmlldyBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4LWNvb3JkaW5hdGUgb2YgdGhlIHJlY3RhbmdsZSdzIGxvd2VyLWxlZnQgY29ybmVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHktY29vcmRpbmF0ZSBvZiB0aGUgcmVjdGFuZ2xlJ3MgbG93ZXItbGVmdCBjb3JuZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgd2lkdGggb2YgdGhlIHJlY3RhbmdsZSwgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlLCBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IHBpeGVscyAtIFRoZSBBcnJheUJ1ZmZlclZpZXcgb2JqZWN0IHRoYXQgaG9sZHMgdGhlIHJldHVybmVkIHBpeGVsXG4gICAgICogZGF0YS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVhZFBpeGVscyh4LCB5LCB3LCBoLCBwaXhlbHMpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBnbC5yZWFkUGl4ZWxzKHgsIHksIHcsIGgsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIHBpeGVscyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBkZXB0aCB2YWx1ZSB1c2VkIHdoZW4gdGhlIGRlcHRoIGJ1ZmZlciBpcyBjbGVhcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlcHRoIC0gVGhlIGRlcHRoIHZhbHVlIHRvIGNsZWFyIHRoZSBkZXB0aCBidWZmZXIgdG8gaW4gdGhlIHJhbmdlIDAuMFxuICAgICAqIHRvIDEuMC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0Q2xlYXJEZXB0aChkZXB0aCkge1xuICAgICAgICBpZiAoZGVwdGggIT09IHRoaXMuY2xlYXJEZXB0aCkge1xuICAgICAgICAgICAgdGhpcy5nbC5jbGVhckRlcHRoKGRlcHRoKTtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJEZXB0aCA9IGRlcHRoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBjbGVhciBjb2xvciB1c2VkIHdoZW4gdGhlIGZyYW1lIGJ1ZmZlciBpcyBjbGVhcmVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBUaGUgcmVkIGNvbXBvbmVudCBvZiB0aGUgY29sb3IgaW4gdGhlIHJhbmdlIDAuMCB0byAxLjAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBUaGUgZ3JlZW4gY29tcG9uZW50IG9mIHRoZSBjb2xvciBpbiB0aGUgcmFuZ2UgMC4wIHRvIDEuMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIFRoZSBibHVlIGNvbXBvbmVudCBvZiB0aGUgY29sb3IgaW4gdGhlIHJhbmdlIDAuMCB0byAxLjAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBUaGUgYWxwaGEgY29tcG9uZW50IG9mIHRoZSBjb2xvciBpbiB0aGUgcmFuZ2UgMC4wIHRvIDEuMC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0Q2xlYXJDb2xvcihyLCBnLCBiLCBhKSB7XG4gICAgICAgIGNvbnN0IGMgPSB0aGlzLmNsZWFyQ29sb3I7XG4gICAgICAgIGlmICgociAhPT0gYy5yKSB8fCAoZyAhPT0gYy5nKSB8fCAoYiAhPT0gYy5iKSB8fCAoYSAhPT0gYy5hKSkge1xuICAgICAgICAgICAgdGhpcy5nbC5jbGVhckNvbG9yKHIsIGcsIGIsIGEpO1xuICAgICAgICAgICAgdGhpcy5jbGVhckNvbG9yLnNldChyLCBnLCBiLCBhKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc3RlbmNpbCBjbGVhciB2YWx1ZSB1c2VkIHdoZW4gdGhlIHN0ZW5jaWwgYnVmZmVyIGlzIGNsZWFyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBUaGUgc3RlbmNpbCB2YWx1ZSB0byBjbGVhciB0aGUgc3RlbmNpbCBidWZmZXIgdG8uXG4gICAgICovXG4gICAgc2V0Q2xlYXJTdGVuY2lsKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5jbGVhclN0ZW5jaWwpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuY2xlYXJTdGVuY2lsKHZhbHVlKTtcbiAgICAgICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHdoZXRoZXIgZGVwdGggdGVzdGluZyBpcyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgZGVwdGggdGVzdGluZyBpcyBlbmFibGVkIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgZGVwdGhUZXN0ID0gZGV2aWNlLmdldERlcHRoVGVzdCgpO1xuICAgICAqIGNvbnNvbGUubG9nKCdEZXB0aCB0ZXN0aW5nIGlzICcgKyBkZXB0aFRlc3QgPyAnZW5hYmxlZCcgOiAnZGlzYWJsZWQnKTtcbiAgICAgKi9cbiAgICBnZXREZXB0aFRlc3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRlcHRoVGVzdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIGRlcHRoIHRlc3Rpbmcgb2YgZnJhZ21lbnRzLiBPbmNlIHRoaXMgc3RhdGUgaXMgc2V0LCBpdCBwZXJzaXN0cyB1bnRpbCBpdFxuICAgICAqIGlzIGNoYW5nZWQuIEJ5IGRlZmF1bHQsIGRlcHRoIHRlc3RpbmcgaXMgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZGVwdGhUZXN0IC0gVHJ1ZSB0byBlbmFibGUgZGVwdGggdGVzdGluZyBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZGV2aWNlLnNldERlcHRoVGVzdCh0cnVlKTtcbiAgICAgKi9cbiAgICBzZXREZXB0aFRlc3QoZGVwdGhUZXN0KSB7XG4gICAgICAgIGlmICh0aGlzLmRlcHRoVGVzdCAhPT0gZGVwdGhUZXN0KSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBpZiAoZGVwdGhUZXN0KSB7XG4gICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kaXNhYmxlKGdsLkRFUFRIX1RFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5kZXB0aFRlc3QgPSBkZXB0aFRlc3Q7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHRoZSBkZXB0aCB0ZXN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZ1bmMgLSBBIGZ1bmN0aW9uIHRvIGNvbXBhcmUgYSBuZXcgZGVwdGggdmFsdWUgd2l0aCBhbiBleGlzdGluZyB6LWJ1ZmZlclxuICAgICAqIHZhbHVlIGFuZCBkZWNpZGUgaWYgdG8gd3JpdGUgYSBwaXhlbC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19ORVZFUn06IGRvbid0IGRyYXdcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9OiBkcmF3IGlmIG5ldyBkZXB0aCA8IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCA9PSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH06IGRyYXcgaWYgbmV3IGRlcHRoIDw9IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn06IGRyYXcgaWYgbmV3IGRlcHRoID4gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH06IGRyYXcgaWYgbmV3IGRlcHRoICE9IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggPj0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19BTFdBWVN9OiBhbHdheXMgZHJhd1xuICAgICAqL1xuICAgIHNldERlcHRoRnVuYyhmdW5jKSB7XG4gICAgICAgIGlmICh0aGlzLmRlcHRoRnVuYyA9PT0gZnVuYykgcmV0dXJuO1xuICAgICAgICB0aGlzLmdsLmRlcHRoRnVuYyh0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSk7XG4gICAgICAgIHRoaXMuZGVwdGhGdW5jID0gZnVuYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHdoZXRoZXIgd3JpdGVzIHRvIHRoZSBkZXB0aCBidWZmZXIgYXJlIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBkZXB0aCB3cml0aW5nIGlzIGVuYWJsZWQgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBkZXB0aFdyaXRlID0gZGV2aWNlLmdldERlcHRoV3JpdGUoKTtcbiAgICAgKiBjb25zb2xlLmxvZygnRGVwdGggd3JpdGluZyBpcyAnICsgZGVwdGhXcml0ZSA/ICdlbmFibGVkJyA6ICdkaXNhYmxlZCcpO1xuICAgICAqL1xuICAgIGdldERlcHRoV3JpdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRlcHRoV3JpdGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvciBkaXNhYmxlcyB3cml0ZXMgdG8gdGhlIGRlcHRoIGJ1ZmZlci4gT25jZSB0aGlzIHN0YXRlIGlzIHNldCwgaXQgcGVyc2lzdHMgdW50aWwgaXRcbiAgICAgKiBpcyBjaGFuZ2VkLiBCeSBkZWZhdWx0LCBkZXB0aCB3cml0ZXMgYXJlIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHdyaXRlRGVwdGggLSBUcnVlIHRvIGVuYWJsZSBkZXB0aCB3cml0aW5nIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBkZXZpY2Uuc2V0RGVwdGhXcml0ZSh0cnVlKTtcbiAgICAgKi9cbiAgICBzZXREZXB0aFdyaXRlKHdyaXRlRGVwdGgpIHtcbiAgICAgICAgaWYgKHRoaXMuZGVwdGhXcml0ZSAhPT0gd3JpdGVEZXB0aCkge1xuICAgICAgICAgICAgdGhpcy5nbC5kZXB0aE1hc2sod3JpdGVEZXB0aCk7XG4gICAgICAgICAgICB0aGlzLmRlcHRoV3JpdGUgPSB3cml0ZURlcHRoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvciBkaXNhYmxlcyB3cml0ZXMgdG8gdGhlIGNvbG9yIGJ1ZmZlci4gT25jZSB0aGlzIHN0YXRlIGlzIHNldCwgaXQgcGVyc2lzdHMgdW50aWwgaXRcbiAgICAgKiBpcyBjaGFuZ2VkLiBCeSBkZWZhdWx0LCBjb2xvciB3cml0ZXMgYXJlIGVuYWJsZWQgZm9yIGFsbCBjb2xvciBjaGFubmVscy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gd3JpdGVSZWQgLSBUcnVlIHRvIGVuYWJsZSB3cml0aW5nIG9mIHRoZSByZWQgY2hhbm5lbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gd3JpdGVHcmVlbiAtIFRydWUgdG8gZW5hYmxlIHdyaXRpbmcgb2YgdGhlIGdyZWVuIGNoYW5uZWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHdyaXRlQmx1ZSAtIFRydWUgdG8gZW5hYmxlIHdyaXRpbmcgb2YgdGhlIGJsdWUgY2hhbm5lbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gd3JpdGVBbHBoYSAtIFRydWUgdG8gZW5hYmxlIHdyaXRpbmcgb2YgdGhlIGFscGhhIGNoYW5uZWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEp1c3Qgd3JpdGUgYWxwaGEgaW50byB0aGUgZnJhbWUgYnVmZmVyXG4gICAgICogZGV2aWNlLnNldENvbG9yV3JpdGUoZmFsc2UsIGZhbHNlLCBmYWxzZSwgdHJ1ZSk7XG4gICAgICovXG4gICAgc2V0Q29sb3JXcml0ZSh3cml0ZVJlZCwgd3JpdGVHcmVlbiwgd3JpdGVCbHVlLCB3cml0ZUFscGhhKSB7XG4gICAgICAgIGlmICgodGhpcy53cml0ZVJlZCAhPT0gd3JpdGVSZWQpIHx8XG4gICAgICAgICAgICAodGhpcy53cml0ZUdyZWVuICE9PSB3cml0ZUdyZWVuKSB8fFxuICAgICAgICAgICAgKHRoaXMud3JpdGVCbHVlICE9PSB3cml0ZUJsdWUpIHx8XG4gICAgICAgICAgICAodGhpcy53cml0ZUFscGhhICE9PSB3cml0ZUFscGhhKSkge1xuICAgICAgICAgICAgdGhpcy5nbC5jb2xvck1hc2sod3JpdGVSZWQsIHdyaXRlR3JlZW4sIHdyaXRlQmx1ZSwgd3JpdGVBbHBoYSk7XG4gICAgICAgICAgICB0aGlzLndyaXRlUmVkID0gd3JpdGVSZWQ7XG4gICAgICAgICAgICB0aGlzLndyaXRlR3JlZW4gPSB3cml0ZUdyZWVuO1xuICAgICAgICAgICAgdGhpcy53cml0ZUJsdWUgPSB3cml0ZUJsdWU7XG4gICAgICAgICAgICB0aGlzLndyaXRlQWxwaGEgPSB3cml0ZUFscGhhO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvciBkaXNhYmxlcyBhbHBoYSB0byBjb3ZlcmFnZSAoV2ViR0wyIG9ubHkpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzdGF0ZSAtIFRydWUgdG8gZW5hYmxlIGFscGhhIHRvIGNvdmVyYWdlIGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRBbHBoYVRvQ292ZXJhZ2Uoc3RhdGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLndlYmdsMikgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5hbHBoYVRvQ292ZXJhZ2UgPT09IHN0YXRlKSByZXR1cm47XG4gICAgICAgIHRoaXMuYWxwaGFUb0NvdmVyYWdlID0gc3RhdGU7XG5cbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5TQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgb3V0cHV0IHZlcnRleCBidWZmZXIuIEl0IHdpbGwgYmUgd3JpdHRlbiB0byBieSBhIHNoYWRlciB3aXRoIHRyYW5zZm9ybSBmZWVkYmFja1xuICAgICAqIHZhcnlpbmdzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3ZlcnRleC1idWZmZXIuanMnKS5WZXJ0ZXhCdWZmZXJ9IHRmIC0gVGhlIG91dHB1dCB2ZXJ0ZXggYnVmZmVyLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUcmFuc2Zvcm1GZWVkYmFja0J1ZmZlcih0Zikge1xuICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciA9PT0gdGYpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciA9IHRmO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgaWYgKHRmKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmZlZWRiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmVlZGJhY2sgPSBnbC5jcmVhdGVUcmFuc2Zvcm1GZWVkYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBnbC5iaW5kVHJhbnNmb3JtRmVlZGJhY2soZ2wuVFJBTlNGT1JNX0ZFRURCQUNLLCB0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuYmluZFRyYW5zZm9ybUZlZWRiYWNrKGdsLlRSQU5TRk9STV9GRUVEQkFDSywgbnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIHRoZSByYXN0ZXJpemF0aW9uIHJlbmRlciBzdGF0ZS4gVXNlZnVsIHdpdGggdHJhbnNmb3JtIGZlZWRiYWNrLCB3aGVuIHlvdSBvbmx5IG5lZWRcbiAgICAgKiB0byBwcm9jZXNzIHRoZSBkYXRhIHdpdGhvdXQgZHJhd2luZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb24gLSBUcnVlIHRvIGVuYWJsZSByYXN0ZXJpemF0aW9uIGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRSYXN0ZXIob24pIHtcbiAgICAgICAgaWYgKHRoaXMucmFzdGVyID09PSBvbikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMucmFzdGVyID0gb247XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICBpZiAob24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5SQVNURVJJWkVSX0RJU0NBUkQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlJBU1RFUklaRVJfRElTQ0FSRCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIHRoZSBwb2x5Z29uIG9mZnNldCByZW5kZXIgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9uIC0gVHJ1ZSB0byBlbmFibGUgcG9seWdvbiBvZmZzZXQgYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldERlcHRoQmlhcyhvbikge1xuICAgICAgICBpZiAodGhpcy5kZXB0aEJpYXNFbmFibGVkID09PSBvbikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuZGVwdGhCaWFzRW5hYmxlZCA9IG9uO1xuXG4gICAgICAgIGlmIChvbikge1xuICAgICAgICAgICAgdGhpcy5nbC5lbmFibGUodGhpcy5nbC5QT0xZR09OX09GRlNFVF9GSUxMKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHRoZSBzY2FsZSBmYWN0b3IgYW5kIHVuaXRzIHRvIGNhbGN1bGF0ZSBkZXB0aCB2YWx1ZXMuIFRoZSBvZmZzZXQgaXMgYWRkZWQgYmVmb3JlXG4gICAgICogdGhlIGRlcHRoIHRlc3QgaXMgcGVyZm9ybWVkIGFuZCBiZWZvcmUgdGhlIHZhbHVlIGlzIHdyaXR0ZW4gaW50byB0aGUgZGVwdGggYnVmZmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNvbnN0QmlhcyAtIFRoZSBtdWx0aXBsaWVyIGJ5IHdoaWNoIGFuIGltcGxlbWVudGF0aW9uLXNwZWNpZmljIHZhbHVlIGlzXG4gICAgICogbXVsdGlwbGllZCB3aXRoIHRvIGNyZWF0ZSBhIGNvbnN0YW50IGRlcHRoIG9mZnNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2xvcGVCaWFzIC0gVGhlIHNjYWxlIGZhY3RvciBmb3IgdGhlIHZhcmlhYmxlIGRlcHRoIG9mZnNldCBmb3IgZWFjaCBwb2x5Z29uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXREZXB0aEJpYXNWYWx1ZXMoY29uc3RCaWFzLCBzbG9wZUJpYXMpIHtcbiAgICAgICAgdGhpcy5nbC5wb2x5Z29uT2Zmc2V0KHNsb3BlQmlhcywgY29uc3RCaWFzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHdoZXRoZXIgYmxlbmRpbmcgaXMgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGJsZW5kaW5nIGlzIGVuYWJsZWQgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBnZXRCbGVuZGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmxlbmRpbmc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvciBkaXNhYmxlcyBibGVuZGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYmxlbmRpbmcgLSBUcnVlIHRvIGVuYWJsZSBibGVuZGluZyBhbmQgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKi9cbiAgICBzZXRCbGVuZGluZyhibGVuZGluZykge1xuICAgICAgICBpZiAodGhpcy5ibGVuZGluZyAhPT0gYmxlbmRpbmcpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGlmIChibGVuZGluZykge1xuICAgICAgICAgICAgICAgIGdsLmVuYWJsZShnbC5CTEVORCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ibGVuZGluZyA9IGJsZW5kaW5nO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvciBkaXNhYmxlcyBzdGVuY2lsIHRlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGVuYWJsZSAtIFRydWUgdG8gZW5hYmxlIHN0ZW5jaWwgdGVzdCBhbmQgZmFsc2UgdG8gZGlzYWJsZSBpdC5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsVGVzdChlbmFibGUpIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbCAhPT0gZW5hYmxlKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBpZiAoZW5hYmxlKSB7XG4gICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLlNURU5DSUxfVEVTVCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuU1RFTkNJTF9URVNUKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbCA9IGVuYWJsZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgc3RlbmNpbCB0ZXN0IGZvciBib3RoIGZyb250IGFuZCBiYWNrIGZhY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZ1bmMgLSBBIGNvbXBhcmlzb24gZnVuY3Rpb24gdGhhdCBkZWNpZGVzIGlmIHRoZSBwaXhlbCBzaG91bGQgYmUgd3JpdHRlbixcbiAgICAgKiBiYXNlZCBvbiB0aGUgY3VycmVudCBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSwgcmVmZXJlbmNlIHZhbHVlLCBhbmQgbWFzayB2YWx1ZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19ORVZFUn06IG5ldmVyIHBhc3NcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPD0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn06IHBhc3MgaWYgKHJlZiAmIG1hc2spID4gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSAhPSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19BTFdBWVN9OiBhbHdheXMgcGFzc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJlZiAtIFJlZmVyZW5jZSB2YWx1ZSB1c2VkIGluIGNvbXBhcmlzb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1hc2sgLSBNYXNrIGFwcGxpZWQgdG8gc3RlbmNpbCBidWZmZXIgdmFsdWUgYW5kIHJlZmVyZW5jZSB2YWx1ZSBiZWZvcmVcbiAgICAgKiBjb21wYXJpc29uLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxGdW5jKGZ1bmMsIHJlZiwgbWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRnVuY0Zyb250ICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkZyb250ICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0Zyb250ICE9PSBtYXNrIHx8XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jQmFjayAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZCYWNrICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0JhY2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jKHRoaXMuZ2xDb21wYXJpc29uW2Z1bmNdLCByZWYsIG1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRnVuY0Zyb250ID0gdGhpcy5zdGVuY2lsRnVuY0JhY2sgPSBmdW5jO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsUmVmRnJvbnQgPSB0aGlzLnN0ZW5jaWxSZWZCYWNrID0gcmVmO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsTWFza0Zyb250ID0gdGhpcy5zdGVuY2lsTWFza0JhY2sgPSBtYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBzdGVuY2lsIHRlc3QgZm9yIGZyb250IGZhY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZ1bmMgLSBBIGNvbXBhcmlzb24gZnVuY3Rpb24gdGhhdCBkZWNpZGVzIGlmIHRoZSBwaXhlbCBzaG91bGQgYmUgd3JpdHRlbixcbiAgICAgKiBiYXNlZCBvbiB0aGUgY3VycmVudCBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSwgcmVmZXJlbmNlIHZhbHVlLCBhbmQgbWFzayB2YWx1ZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19ORVZFUn06IG5ldmVyIHBhc3NcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPD0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn06IHBhc3MgaWYgKHJlZiAmIG1hc2spID4gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSAhPSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19BTFdBWVN9OiBhbHdheXMgcGFzc1xuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJlZiAtIFJlZmVyZW5jZSB2YWx1ZSB1c2VkIGluIGNvbXBhcmlzb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1hc2sgLSBNYXNrIGFwcGxpZWQgdG8gc3RlbmNpbCBidWZmZXIgdmFsdWUgYW5kIHJlZmVyZW5jZSB2YWx1ZSBiZWZvcmUgY29tcGFyaXNvbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsRnVuY0Zyb250KGZ1bmMsIHJlZiwgbWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRnVuY0Zyb250ICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkZyb250ICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0Zyb250ICE9PSBtYXNrKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5zdGVuY2lsRnVuY1NlcGFyYXRlKGdsLkZST05ULCB0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSwgcmVmLCBtYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHJlZjtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maWd1cmVzIHN0ZW5jaWwgdGVzdCBmb3IgYmFjayBmYWNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmdW5jIC0gQSBjb21wYXJpc29uIGZ1bmN0aW9uIHRoYXQgZGVjaWRlcyBpZiB0aGUgcGl4ZWwgc2hvdWxkIGJlIHdyaXR0ZW4sXG4gICAgICogYmFzZWQgb24gdGhlIGN1cnJlbnQgc3RlbmNpbCBidWZmZXIgdmFsdWUsIHJlZmVyZW5jZSB2YWx1ZSwgYW5kIG1hc2sgdmFsdWUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTkVWRVJ9OiBuZXZlciBwYXNzXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfTogcGFzcyBpZiAocmVmICYgbWFzaykgPCAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spID09IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH06IHBhc3MgaWYgKHJlZiAmIG1hc2spIDw9IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgIT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPj0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfQUxXQVlTfTogYWx3YXlzIHBhc3NcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByZWYgLSBSZWZlcmVuY2UgdmFsdWUgdXNlZCBpbiBjb21wYXJpc29uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXNrIC0gTWFzayBhcHBsaWVkIHRvIHN0ZW5jaWwgYnVmZmVyIHZhbHVlIGFuZCByZWZlcmVuY2UgdmFsdWUgYmVmb3JlIGNvbXBhcmlzb24uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbEZ1bmNCYWNrKGZ1bmMsIHJlZiwgbWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRnVuY0JhY2sgIT09IGZ1bmMgfHwgdGhpcy5zdGVuY2lsUmVmQmFjayAhPT0gcmVmIHx8IHRoaXMuc3RlbmNpbE1hc2tCYWNrICE9PSBtYXNrKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5zdGVuY2lsRnVuY1NlcGFyYXRlKGdsLkJBQ0ssIHRoaXMuZ2xDb21wYXJpc29uW2Z1bmNdLCByZWYsIG1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRnVuY0JhY2sgPSBmdW5jO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsUmVmQmFjayA9IHJlZjtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbE1hc2tCYWNrID0gbWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgaG93IHN0ZW5jaWwgYnVmZmVyIHZhbHVlcyBzaG91bGQgYmUgbW9kaWZpZWQgYmFzZWQgb24gdGhlIHJlc3VsdCBvZiBkZXB0aC9zdGVuY2lsXG4gICAgICogdGVzdHMuIFdvcmtzIGZvciBib3RoIGZyb250IGFuZCBiYWNrIGZhY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZhaWwgLSBBY3Rpb24gdG8gdGFrZSBpZiBzdGVuY2lsIHRlc3QgaXMgZmFpbGVkLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfS0VFUH06IGRvbid0IGNoYW5nZSB0aGUgc3RlbmNpbCBidWZmZXIgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfWkVST306IHNldCB2YWx1ZSB0byB6ZXJvXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX1JFUExBQ0V9OiByZXBsYWNlIHZhbHVlIHdpdGggdGhlIHJlZmVyZW5jZSB2YWx1ZSAoc2VlIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRTdGVuY2lsRnVuY30pXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVH06IGluY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5DUkVNRU5UV1JBUH06IGluY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIHplcm8gd2hlbiBpdCdzIGxhcmdlclxuICAgICAqIHRoYW4gYSBtYXhpbXVtIHJlcHJlc2VudGFibGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UfTogZGVjcmVtZW50IHRoZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9ERUNSRU1FTlRXUkFQfTogZGVjcmVtZW50IHRoZSB2YWx1ZSwgYnV0IHdyYXAgaXQgdG8gYSBtYXhpbXVtXG4gICAgICogcmVwcmVzZW50YWJsZSB2YWx1ZSwgaWYgdGhlIGN1cnJlbnQgdmFsdWUgaXMgMFxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTlZFUlR9OiBpbnZlcnQgdGhlIHZhbHVlIGJpdHdpc2VcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6ZmFpbCAtIEFjdGlvbiB0byB0YWtlIGlmIGRlcHRoIHRlc3QgaXMgZmFpbGVkLiAgQWNjZXB0cyB0aGUgc2FtZSB2YWx1ZXMgYXNcbiAgICAgKiBgZmFpbGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpwYXNzIC0gQWN0aW9uIHRvIHRha2UgaWYgYm90aCBkZXB0aCBhbmQgc3RlbmNpbCB0ZXN0IGFyZSBwYXNzZWQuIEFjY2VwdHNcbiAgICAgKiB0aGUgc2FtZSB2YWx1ZXMgYXMgYGZhaWxgLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3cml0ZU1hc2sgLSBBIGJpdCBtYXNrIGFwcGxpZWQgdG8gdGhlIHJlZmVyZW5jZSB2YWx1ZSwgd2hlbiB3cml0dGVuLlxuICAgICAqL1xuICAgIHNldFN0ZW5jaWxPcGVyYXRpb24oZmFpbCwgemZhaWwsIHpwYXNzLCB3cml0ZU1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZhaWxGcm9udCAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ICE9PSB6ZmFpbCB8fCB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ICE9PSB6cGFzcyB8fFxuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEJhY2sgIT09IGZhaWwgfHwgdGhpcy5zdGVuY2lsWmZhaWxCYWNrICE9PSB6ZmFpbCB8fCB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgIT09IHpwYXNzKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxPcCh0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEZyb250ID0gdGhpcy5zdGVuY2lsRmFpbEJhY2sgPSBmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxGcm9udCA9IHRoaXMuc3RlbmNpbFpmYWlsQmFjayA9IHpmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWnBhc3NGcm9udCA9IHRoaXMuc3RlbmNpbFpwYXNzQmFjayA9IHpwYXNzO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCAhPT0gd3JpdGVNYXNrIHx8IHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgIT09IHdyaXRlTWFzaykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsTWFzayh3cml0ZU1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgPSB3cml0ZU1hc2s7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrID0gd3JpdGVNYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBob3cgc3RlbmNpbCBidWZmZXIgdmFsdWVzIHNob3VsZCBiZSBtb2RpZmllZCBiYXNlZCBvbiB0aGUgcmVzdWx0IG9mIGRlcHRoL3N0ZW5jaWxcbiAgICAgKiB0ZXN0cy4gV29ya3MgZm9yIGZyb250IGZhY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZhaWwgLSBBY3Rpb24gdG8gdGFrZSBpZiBzdGVuY2lsIHRlc3QgaXMgZmFpbGVkLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfS0VFUH06IGRvbid0IGNoYW5nZSB0aGUgc3RlbmNpbCBidWZmZXIgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfWkVST306IHNldCB2YWx1ZSB0byB6ZXJvXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX1JFUExBQ0V9OiByZXBsYWNlIHZhbHVlIHdpdGggdGhlIHJlZmVyZW5jZSB2YWx1ZSAoc2VlIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRTdGVuY2lsRnVuY30pXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVH06IGluY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5DUkVNRU5UV1JBUH06IGluY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIHplcm8gd2hlbiBpdCdzIGxhcmdlclxuICAgICAqIHRoYW4gYSBtYXhpbXVtIHJlcHJlc2VudGFibGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UfTogZGVjcmVtZW50IHRoZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9ERUNSRU1FTlRXUkFQfTogZGVjcmVtZW50IHRoZSB2YWx1ZSwgYnV0IHdyYXAgaXQgdG8gYSBtYXhpbXVtXG4gICAgICogcmVwcmVzZW50YWJsZSB2YWx1ZSwgaWYgdGhlIGN1cnJlbnQgdmFsdWUgaXMgMFxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTlZFUlR9OiBpbnZlcnQgdGhlIHZhbHVlIGJpdHdpc2VcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6ZmFpbCAtIEFjdGlvbiB0byB0YWtlIGlmIGRlcHRoIHRlc3QgaXMgZmFpbGVkLiAgQWNjZXB0cyB0aGUgc2FtZSB2YWx1ZXMgYXNcbiAgICAgKiBgZmFpbGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHpwYXNzIC0gQWN0aW9uIHRvIHRha2UgaWYgYm90aCBkZXB0aCBhbmQgc3RlbmNpbCB0ZXN0IGFyZSBwYXNzZWQuICBBY2NlcHRzXG4gICAgICogdGhlIHNhbWUgdmFsdWVzIGFzIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd3JpdGVNYXNrIC0gQSBiaXQgbWFzayBhcHBsaWVkIHRvIHRoZSByZWZlcmVuY2UgdmFsdWUsIHdoZW4gd3JpdHRlbi5cbiAgICAgKi9cbiAgICBzZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQoZmFpbCwgemZhaWwsIHpwYXNzLCB3cml0ZU1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZhaWxGcm9udCAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ICE9PSB6ZmFpbCB8fCB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ICE9PSB6cGFzcykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsT3BTZXBhcmF0ZSh0aGlzLmdsLkZST05ULCB0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEZyb250ID0gZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgPSB6ZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgIT09IHdyaXRlTWFzaykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsTWFza1NlcGFyYXRlKHRoaXMuZ2wuRlJPTlQsIHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgaG93IHN0ZW5jaWwgYnVmZmVyIHZhbHVlcyBzaG91bGQgYmUgbW9kaWZpZWQgYmFzZWQgb24gdGhlIHJlc3VsdCBvZiBkZXB0aC9zdGVuY2lsXG4gICAgICogdGVzdHMuIFdvcmtzIGZvciBiYWNrIGZhY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZhaWwgLSBBY3Rpb24gdG8gdGFrZSBpZiBzdGVuY2lsIHRlc3QgaXMgZmFpbGVkLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfS0VFUH06IGRvbid0IGNoYW5nZSB0aGUgc3RlbmNpbCBidWZmZXIgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfWkVST306IHNldCB2YWx1ZSB0byB6ZXJvXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX1JFUExBQ0V9OiByZXBsYWNlIHZhbHVlIHdpdGggdGhlIHJlZmVyZW5jZSB2YWx1ZSAoc2VlIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRTdGVuY2lsRnVuY30pXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVH06IGluY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5DUkVNRU5UV1JBUH06IGluY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIHplcm8gd2hlbiBpdCdzIGxhcmdlclxuICAgICAqIHRoYW4gYSBtYXhpbXVtIHJlcHJlc2VudGFibGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UfTogZGVjcmVtZW50IHRoZSB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9ERUNSRU1FTlRXUkFQfTogZGVjcmVtZW50IHRoZSB2YWx1ZSwgYnV0IHdyYXAgaXQgdG8gYSBtYXhpbXVtXG4gICAgICogcmVwcmVzZW50YWJsZSB2YWx1ZSwgaWYgdGhlIGN1cnJlbnQgdmFsdWUgaXMgMFxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTlZFUlR9OiBpbnZlcnQgdGhlIHZhbHVlIGJpdHdpc2VcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB6ZmFpbCAtIEFjdGlvbiB0byB0YWtlIGlmIGRlcHRoIHRlc3QgaXMgZmFpbGVkLiBBY2NlcHRzIHRoZSBzYW1lIHZhbHVlcyBhc1xuICAgICAqIGBmYWlsYC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0genBhc3MgLSBBY3Rpb24gdG8gdGFrZSBpZiBib3RoIGRlcHRoIGFuZCBzdGVuY2lsIHRlc3QgYXJlIHBhc3NlZC4gQWNjZXB0c1xuICAgICAqIHRoZSBzYW1lIHZhbHVlcyBhcyBgZmFpbGAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdyaXRlTWFzayAtIEEgYml0IG1hc2sgYXBwbGllZCB0byB0aGUgcmVmZXJlbmNlIHZhbHVlLCB3aGVuIHdyaXR0ZW4uXG4gICAgICovXG4gICAgc2V0U3RlbmNpbE9wZXJhdGlvbkJhY2soZmFpbCwgemZhaWwsIHpwYXNzLCB3cml0ZU1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZhaWxCYWNrICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsQmFjayAhPT0gemZhaWwgfHwgdGhpcy5zdGVuY2lsWnBhc3NCYWNrICE9PSB6cGFzcykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsT3BTZXBhcmF0ZSh0aGlzLmdsLkJBQ0ssIHRoaXMuZ2xTdGVuY2lsT3BbZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbemZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pwYXNzXSk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IGZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgPSB6ZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzQmFjayA9IHpwYXNzO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrICE9PSB3cml0ZU1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE1hc2tTZXBhcmF0ZSh0aGlzLmdsLkJBQ0ssIHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tCYWNrID0gd3JpdGVNYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBibGVuZGluZyBvcGVyYXRpb25zLiBCb3RoIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gYmxlbmQgbW9kZXMgY2FuIHRha2UgdGhlXG4gICAgICogZm9sbG93aW5nIHZhbHVlczpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9aRVJPfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkV9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfRFNUX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfRFNUX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9DT05TVEFOVF9DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9DT05TVEFOVF9BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX0NPTlNUQU5UX0FMUEhBfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kU3JjIC0gVGhlIHNvdXJjZSBibGVuZCBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmREc3QgLSBUaGUgZGVzdGluYXRpb24gYmxlbmQgZnVuY3Rpb24uXG4gICAgICovXG4gICAgc2V0QmxlbmRGdW5jdGlvbihibGVuZFNyYywgYmxlbmREc3QpIHtcbiAgICAgICAgaWYgKHRoaXMuYmxlbmRTcmMgIT09IGJsZW5kU3JjIHx8IHRoaXMuYmxlbmREc3QgIT09IGJsZW5kRHN0IHx8IHRoaXMuc2VwYXJhdGVBbHBoYUJsZW5kKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmJsZW5kRnVuYyh0aGlzLmdsQmxlbmRGdW5jdGlvbltibGVuZFNyY10sIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uW2JsZW5kRHN0XSk7XG4gICAgICAgICAgICB0aGlzLmJsZW5kU3JjID0gYmxlbmRTcmM7XG4gICAgICAgICAgICB0aGlzLmJsZW5kRHN0ID0gYmxlbmREc3Q7XG4gICAgICAgICAgICB0aGlzLnNlcGFyYXRlQWxwaGFCbGVuZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyBibGVuZGluZyBvcGVyYXRpb25zLiBCb3RoIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gYmxlbmQgbW9kZXMgY2FuIHRha2UgdGhlXG4gICAgICogZm9sbG93aW5nIHZhbHVlczpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9aRVJPfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkV9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfRFNUX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfRFNUX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kU3JjIC0gVGhlIHNvdXJjZSBibGVuZCBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmREc3QgLSBUaGUgZGVzdGluYXRpb24gYmxlbmQgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kU3JjQWxwaGEgLSBUaGUgc2VwYXJhdGUgc291cmNlIGJsZW5kIGZ1bmN0aW9uIGZvciB0aGUgYWxwaGEgY2hhbm5lbC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmREc3RBbHBoYSAtIFRoZSBzZXBhcmF0ZSBkZXN0aW5hdGlvbiBibGVuZCBmdW5jdGlvbiBmb3IgdGhlIGFscGhhIGNoYW5uZWwuXG4gICAgICovXG4gICAgc2V0QmxlbmRGdW5jdGlvblNlcGFyYXRlKGJsZW5kU3JjLCBibGVuZERzdCwgYmxlbmRTcmNBbHBoYSwgYmxlbmREc3RBbHBoYSkge1xuICAgICAgICBpZiAodGhpcy5ibGVuZFNyYyAhPT0gYmxlbmRTcmMgfHwgdGhpcy5ibGVuZERzdCAhPT0gYmxlbmREc3QgfHwgdGhpcy5ibGVuZFNyY0FscGhhICE9PSBibGVuZFNyY0FscGhhIHx8IHRoaXMuYmxlbmREc3RBbHBoYSAhPT0gYmxlbmREc3RBbHBoYSB8fCAhdGhpcy5zZXBhcmF0ZUFscGhhQmxlbmQpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmxlbmRGdW5jU2VwYXJhdGUodGhpcy5nbEJsZW5kRnVuY3Rpb25bYmxlbmRTcmNdLCB0aGlzLmdsQmxlbmRGdW5jdGlvbltibGVuZERzdF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uW2JsZW5kU3JjQWxwaGFdLCB0aGlzLmdsQmxlbmRGdW5jdGlvbltibGVuZERzdEFscGhhXSk7XG4gICAgICAgICAgICB0aGlzLmJsZW5kU3JjID0gYmxlbmRTcmM7XG4gICAgICAgICAgICB0aGlzLmJsZW5kRHN0ID0gYmxlbmREc3Q7XG4gICAgICAgICAgICB0aGlzLmJsZW5kU3JjQWxwaGEgPSBibGVuZFNyY0FscGhhO1xuICAgICAgICAgICAgdGhpcy5ibGVuZERzdEFscGhhID0gYmxlbmREc3RBbHBoYTtcbiAgICAgICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUJsZW5kID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyZXMgdGhlIGJsZW5kaW5nIGVxdWF0aW9uLiBUaGUgZGVmYXVsdCBibGVuZCBlcXVhdGlvbiBpcyB7QGxpbmsgQkxFTkRFUVVBVElPTl9BRER9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJsZW5kRXF1YXRpb24gLSBUaGUgYmxlbmQgZXF1YXRpb24uIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fQUREfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fU1VCVFJBQ1R9XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9SRVZFUlNFX1NVQlRSQUNUfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fTUlOfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fTUFYfVxuICAgICAqXG4gICAgICogTm90ZSB0aGF0IE1JTiBhbmQgTUFYIG1vZGVzIHJlcXVpcmUgZWl0aGVyIEVYVF9ibGVuZF9taW5tYXggb3IgV2ViR0wyIHRvIHdvcmsgKGNoZWNrXG4gICAgICogZGV2aWNlLmV4dEJsZW5kTWlubWF4KS5cbiAgICAgKi9cbiAgICBzZXRCbGVuZEVxdWF0aW9uKGJsZW5kRXF1YXRpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuYmxlbmRFcXVhdGlvbiAhPT0gYmxlbmRFcXVhdGlvbiB8fCB0aGlzLnNlcGFyYXRlQWxwaGFFcXVhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZEVxdWF0aW9uKHRoaXMuZ2xCbGVuZEVxdWF0aW9uW2JsZW5kRXF1YXRpb25dKTtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRFcXVhdGlvbiA9IGJsZW5kRXF1YXRpb247XG4gICAgICAgICAgICB0aGlzLnNlcGFyYXRlQWxwaGFFcXVhdGlvbiA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29uZmlndXJlcyB0aGUgYmxlbmRpbmcgZXF1YXRpb24uIFRoZSBkZWZhdWx0IGJsZW5kIGVxdWF0aW9uIGlzIHtAbGluayBCTEVOREVRVUFUSU9OX0FERH0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYmxlbmRFcXVhdGlvbiAtIFRoZSBibGVuZCBlcXVhdGlvbi4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9BRER9XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9TVUJUUkFDVH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX1JFVkVSU0VfU1VCVFJBQ1R9XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9NSU59XG4gICAgICogLSB7QGxpbmsgQkxFTkRFUVVBVElPTl9NQVh9XG4gICAgICpcbiAgICAgKiBOb3RlIHRoYXQgTUlOIGFuZCBNQVggbW9kZXMgcmVxdWlyZSBlaXRoZXIgRVhUX2JsZW5kX21pbm1heCBvciBXZWJHTDIgdG8gd29yayAoY2hlY2tcbiAgICAgKiBkZXZpY2UuZXh0QmxlbmRNaW5tYXgpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBibGVuZEFscGhhRXF1YXRpb24gLSBBIHNlcGFyYXRlIGJsZW5kIGVxdWF0aW9uIGZvciB0aGUgYWxwaGEgY2hhbm5lbC5cbiAgICAgKiBBY2NlcHRzIHNhbWUgdmFsdWVzIGFzIGBibGVuZEVxdWF0aW9uYC5cbiAgICAgKi9cbiAgICBzZXRCbGVuZEVxdWF0aW9uU2VwYXJhdGUoYmxlbmRFcXVhdGlvbiwgYmxlbmRBbHBoYUVxdWF0aW9uKSB7XG4gICAgICAgIGlmICh0aGlzLmJsZW5kRXF1YXRpb24gIT09IGJsZW5kRXF1YXRpb24gfHwgdGhpcy5ibGVuZEFscGhhRXF1YXRpb24gIT09IGJsZW5kQWxwaGFFcXVhdGlvbiB8fCAhdGhpcy5zZXBhcmF0ZUFscGhhRXF1YXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmxlbmRFcXVhdGlvblNlcGFyYXRlKHRoaXMuZ2xCbGVuZEVxdWF0aW9uW2JsZW5kRXF1YXRpb25dLCB0aGlzLmdsQmxlbmRFcXVhdGlvbltibGVuZEFscGhhRXF1YXRpb25dKTtcbiAgICAgICAgICAgIHRoaXMuYmxlbmRFcXVhdGlvbiA9IGJsZW5kRXF1YXRpb247XG4gICAgICAgICAgICB0aGlzLmJsZW5kQWxwaGFFcXVhdGlvbiA9IGJsZW5kQWxwaGFFcXVhdGlvbjtcbiAgICAgICAgICAgIHRoaXMuc2VwYXJhdGVBbHBoYUVxdWF0aW9uID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBibGVuZGluZyBmYWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBUaGUgcmVkIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBUaGUgZ3JlZW4gY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIFRoZSBibHVlIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBUaGUgYWxwaGEgY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0QmxlbmRDb2xvcihyLCBnLCBiLCBhKSB7XG4gICAgICAgIGNvbnN0IGMgPSB0aGlzLmJsZW5kQ29sb3I7XG4gICAgICAgIGlmICgociAhPT0gYy5yKSB8fCAoZyAhPT0gYy5nKSB8fCAoYiAhPT0gYy5iKSB8fCAoYSAhPT0gYy5hKSkge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZENvbG9yKHIsIGcsIGIsIGEpO1xuICAgICAgICAgICAgYy5zZXQociwgZywgYiwgYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyBob3cgdHJpYW5nbGVzIGFyZSBjdWxsZWQgYmFzZWQgb24gdGhlaXIgZmFjZSBkaXJlY3Rpb24uIFRoZSBkZWZhdWx0IGN1bGwgbW9kZSBpc1xuICAgICAqIHtAbGluayBDVUxMRkFDRV9CQUNLfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjdWxsTW9kZSAtIFRoZSBjdWxsIG1vZGUgdG8gc2V0LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBDVUxMRkFDRV9OT05FfVxuICAgICAqIC0ge0BsaW5rIENVTExGQUNFX0JBQ0t9XG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfRlJPTlR9XG4gICAgICogLSB7QGxpbmsgQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLfVxuICAgICAqL1xuICAgIHNldEN1bGxNb2RlKGN1bGxNb2RlKSB7XG4gICAgICAgIGlmICh0aGlzLmN1bGxNb2RlICE9PSBjdWxsTW9kZSkge1xuICAgICAgICAgICAgaWYgKGN1bGxNb2RlID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5nbC5kaXNhYmxlKHRoaXMuZ2wuQ1VMTF9GQUNFKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VsbE1vZGUgPT09IENVTExGQUNFX05PTkUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5nbC5lbmFibGUodGhpcy5nbC5DVUxMX0ZBQ0UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1vZGUgPSB0aGlzLmdsQ3VsbFtjdWxsTW9kZV07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VsbEZhY2UgIT09IG1vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5nbC5jdWxsRmFjZShtb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdWxsRmFjZSA9IG1vZGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5jdWxsTW9kZSA9IGN1bGxNb2RlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgY3VycmVudCBjdWxsIG1vZGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgY3VycmVudCBjdWxsIG1vZGUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEN1bGxNb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdWxsTW9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBhY3RpdmUgc2hhZGVyIHRvIGJlIHVzZWQgZHVyaW5nIHN1YnNlcXVlbnQgZHJhdyBjYWxscy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U2hhZGVyfSBzaGFkZXIgLSBUaGUgc2hhZGVyIHRvIHNldCB0byBhc3NpZ24gdG8gdGhlIGRldmljZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc2hhZGVyIHdhcyBzdWNjZXNzZnVsbHkgc2V0LCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgc2V0U2hhZGVyKHNoYWRlcikge1xuICAgICAgICBpZiAoc2hhZGVyICE9PSB0aGlzLnNoYWRlcikge1xuICAgICAgICAgICAgaWYgKHNoYWRlci5mYWlsZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFzaGFkZXIucmVhZHkgJiYgIXNoYWRlci5pbXBsLmZpbmFsaXplKHRoaXMsIHNoYWRlcikpIHtcbiAgICAgICAgICAgICAgICBzaGFkZXIuZmFpbGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2hhZGVyID0gc2hhZGVyO1xuXG4gICAgICAgICAgICAvLyBTZXQgdGhlIGFjdGl2ZSBzaGFkZXJcbiAgICAgICAgICAgIHRoaXMuZ2wudXNlUHJvZ3JhbShzaGFkZXIuaW1wbC5nbFByb2dyYW0pO1xuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0aGlzLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lKys7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgdGhpcy5hdHRyaWJ1dGVzSW52YWxpZGF0ZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhIHN1cHBvcnRlZCBIRFIgcGl4ZWwgZm9ybWF0IGdpdmVuIGEgc2V0IG9mIGhhcmR3YXJlIHN1cHBvcnQgcmVxdWlyZW1lbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBwcmVmZXJMYXJnZXN0IC0gSWYgdHJ1ZSwgcHJlZmVyIHRoZSBoaWdoZXN0IHByZWNpc2lvbiBmb3JtYXQuIE90aGVyd2lzZSBwcmVmZXIgdGhlIGxvd2VzdCBwcmVjaXNpb24gZm9ybWF0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVuZGVyYWJsZSAtIElmIHRydWUsIG9ubHkgaW5jbHVkZSBwaXhlbCBmb3JtYXRzIHRoYXQgY2FuIGJlIHVzZWQgYXMgcmVuZGVyIHRhcmdldHMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB1cGRhdGFibGUgLSBJZiB0cnVlLCBvbmx5IGluY2x1ZGUgZm9ybWF0cyB0aGF0IGNhbiBiZSB1cGRhdGVkIGJ5IHRoZSBDUFUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBmaWx0ZXJhYmxlIC0gSWYgdHJ1ZSwgb25seSBpbmNsdWRlIGZvcm1hdHMgdGhhdCBzdXBwb3J0IHRleHR1cmUgZmlsdGVyaW5nLlxuICAgICAqXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIEhEUiBwaXhlbCBmb3JtYXQgb3IgbnVsbCBpZiB0aGVyZSBhcmUgbm9uZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0SGRyRm9ybWF0KHByZWZlckxhcmdlc3QsIHJlbmRlcmFibGUsIHVwZGF0YWJsZSwgZmlsdGVyYWJsZSkge1xuICAgICAgICAvLyBOb3RlIHRoYXQgZm9yIFdlYkdMMiwgUElYRUxGT1JNQVRfUkdCMTZGIGFuZCBQSVhFTEZPUk1BVF9SR0IzMkYgYXJlIG5vdCByZW5kZXJhYmxlIGFjY29yZGluZyB0byB0aGlzOlxuICAgICAgICAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdFxuICAgICAgICAvLyBGb3IgV2ViR0wxLCBvbmx5IFBJWEVMRk9STUFUX1JHQkExNkYgYW5kIFBJWEVMRk9STUFUX1JHQkEzMkYgYXJlIHRlc3RlZCBmb3IgYmVpbmcgcmVuZGVyYWJsZS5cbiAgICAgICAgY29uc3QgZjE2VmFsaWQgPSB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgJiZcbiAgICAgICAgICAgICghcmVuZGVyYWJsZSB8fCB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlKSAmJlxuICAgICAgICAgICAgKCF1cGRhdGFibGUgfHwgdGhpcy50ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlKSAmJlxuICAgICAgICAgICAgKCFmaWx0ZXJhYmxlIHx8IHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdExpbmVhcik7XG4gICAgICAgIGNvbnN0IGYzMlZhbGlkID0gdGhpcy5leHRUZXh0dXJlRmxvYXQgJiZcbiAgICAgICAgICAgICghcmVuZGVyYWJsZSB8fCB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUpICYmXG4gICAgICAgICAgICAoIWZpbHRlcmFibGUgfHwgdGhpcy5leHRUZXh0dXJlRmxvYXRMaW5lYXIpO1xuXG4gICAgICAgIGlmIChmMTZWYWxpZCAmJiBmMzJWYWxpZCkge1xuICAgICAgICAgICAgcmV0dXJuIHByZWZlckxhcmdlc3QgPyBQSVhFTEZPUk1BVF9SR0JBMzJGIDogUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmIChmMTZWYWxpZCkge1xuICAgICAgICAgICAgcmV0dXJuIFBJWEVMRk9STUFUX1JHQkExNkY7XG4gICAgICAgIH0gZWxzZSBpZiAoZjMyVmFsaWQpIHtcbiAgICAgICAgICAgIHJldHVybiBQSVhFTEZPUk1BVF9SR0JBMzJGO1xuICAgICAgICB9IC8qIGVsc2UgKi9cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgbWVtb3J5IGZyb20gYWxsIHZlcnRleCBhcnJheSBvYmplY3RzIGV2ZXIgYWxsb2NhdGVkIHdpdGggdGhpcyBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgY2xlYXJWZXJ0ZXhBcnJheU9iamVjdENhY2hlKCkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIHRoaXMuX3Zhb01hcC5mb3JFYWNoKChpdGVtLCBrZXksIG1hcE9iaikgPT4ge1xuICAgICAgICAgICAgZ2wuZGVsZXRlVmVydGV4QXJyYXkoaXRlbSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX3Zhb01hcC5jbGVhcigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdpZHRoIG9mIHRoZSBiYWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2wuZHJhd2luZ0J1ZmZlcldpZHRoIHx8IHRoaXMuY2FudmFzLndpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlaWdodCBvZiB0aGUgYmFjayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nbC5kcmF3aW5nQnVmZmVySGVpZ2h0IHx8IHRoaXMuY2FudmFzLmhlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdWxsc2NyZWVuIG1vZGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZnVsbHNjcmVlbihmdWxsc2NyZWVuKSB7XG4gICAgICAgIGlmIChmdWxsc2NyZWVuKSB7XG4gICAgICAgICAgICBjb25zdCBjYW52YXMgPSB0aGlzLmdsLmNhbnZhcztcbiAgICAgICAgICAgIGNhbnZhcy5yZXF1ZXN0RnVsbHNjcmVlbigpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9jdW1lbnQuZXhpdEZ1bGxzY3JlZW4oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmdWxsc2NyZWVuKCkge1xuICAgICAgICByZXR1cm4gISFkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiBoaWdoIHByZWNpc2lvbiBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBhcmUgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24gPSB0ZXN0VGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbih0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVjayBpZiB0ZXh0dXJlIHdpdGggaGFsZiBmbG9hdCBmb3JtYXQgY2FuIGJlIHVwZGF0ZWQgd2l0aCBkYXRhLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdGVzdFRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUodGhpcy5nbCwgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0LkhBTEZfRkxPQVRfT0VTKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdsR3JhcGhpY3NEZXZpY2UgfTtcbiJdLCJuYW1lcyI6WyJpbnZhbGlkYXRlQXR0YWNobWVudHMiLCJfZnVsbFNjcmVlblF1YWRWUyIsIl9wcmVjaXNpb25UZXN0MVBTIiwiX3ByZWNpc2lvblRlc3QyUFMiLCJfb3V0cHV0VGV4dHVyZTJEIiwicXVhZFdpdGhTaGFkZXIiLCJkZXZpY2UiLCJ0YXJnZXQiLCJzaGFkZXIiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsIm9sZFJ0IiwicmVuZGVyVGFyZ2V0Iiwic2V0UmVuZGVyVGFyZ2V0IiwidXBkYXRlQmVnaW4iLCJvbGREZXB0aFRlc3QiLCJnZXREZXB0aFRlc3QiLCJvbGREZXB0aFdyaXRlIiwiZ2V0RGVwdGhXcml0ZSIsIm9sZEN1bGxNb2RlIiwiZ2V0Q3VsbE1vZGUiLCJvbGRXUiIsIndyaXRlUmVkIiwib2xkV0ciLCJ3cml0ZUdyZWVuIiwib2xkV0IiLCJ3cml0ZUJsdWUiLCJvbGRXQSIsIndyaXRlQWxwaGEiLCJzZXREZXB0aFRlc3QiLCJzZXREZXB0aFdyaXRlIiwic2V0Q3VsbE1vZGUiLCJDVUxMRkFDRV9OT05FIiwic2V0Q29sb3JXcml0ZSIsInNldFZlcnRleEJ1ZmZlciIsInF1YWRWZXJ0ZXhCdWZmZXIiLCJzZXRTaGFkZXIiLCJkcmF3IiwidHlwZSIsIlBSSU1JVElWRV9UUklTVFJJUCIsImJhc2UiLCJjb3VudCIsImluZGV4ZWQiLCJ1cGRhdGVFbmQiLCJwb3BHcHVNYXJrZXIiLCJ0ZXN0UmVuZGVyYWJsZSIsImdsIiwicGl4ZWxGb3JtYXQiLCJyZXN1bHQiLCJ0ZXh0dXJlIiwiY3JlYXRlVGV4dHVyZSIsImJpbmRUZXh0dXJlIiwiVEVYVFVSRV8yRCIsInRleFBhcmFtZXRlcmkiLCJURVhUVVJFX01JTl9GSUxURVIiLCJORUFSRVNUIiwiVEVYVFVSRV9NQUdfRklMVEVSIiwiVEVYVFVSRV9XUkFQX1MiLCJDTEFNUF9UT19FREdFIiwiVEVYVFVSRV9XUkFQX1QiLCJ0ZXhJbWFnZTJEIiwiUkdCQSIsImZyYW1lYnVmZmVyIiwiY3JlYXRlRnJhbWVidWZmZXIiLCJiaW5kRnJhbWVidWZmZXIiLCJGUkFNRUJVRkZFUiIsImZyYW1lYnVmZmVyVGV4dHVyZTJEIiwiQ09MT1JfQVRUQUNITUVOVDAiLCJjaGVja0ZyYW1lYnVmZmVyU3RhdHVzIiwiRlJBTUVCVUZGRVJfQ09NUExFVEUiLCJkZWxldGVUZXh0dXJlIiwiZGVsZXRlRnJhbWVidWZmZXIiLCJ0ZXN0VGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImRhdGEiLCJVaW50MTZBcnJheSIsImdldEVycm9yIiwiTk9fRVJST1IiLCJjb25zb2xlIiwibG9nIiwidGVzdFRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iLCJ0ZXh0dXJlRmxvYXRSZW5kZXJhYmxlIiwic2hhZGVyMSIsIlNoYWRlciIsIlNoYWRlclV0aWxzIiwiY3JlYXRlRGVmaW5pdGlvbiIsIm5hbWUiLCJ2ZXJ0ZXhDb2RlIiwiZnJhZ21lbnRDb2RlIiwic2hhZGVyMiIsInRleHR1cmVPcHRpb25zIiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIndpZHRoIiwiaGVpZ2h0IiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwidGV4MSIsIlRleHR1cmUiLCJ0YXJnMSIsIlJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiZGVwdGgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsInRleDIiLCJ0YXJnMiIsImNvbnN0YW50VGV4U291cmNlIiwic2V0VmFsdWUiLCJwcmV2RnJhbWVidWZmZXIiLCJhY3RpdmVGcmFtZWJ1ZmZlciIsInNldEZyYW1lYnVmZmVyIiwiaW1wbCIsIl9nbEZyYW1lQnVmZmVyIiwicGl4ZWxzIiwiVWludDhBcnJheSIsInJlYWRQaXhlbHMiLCJ4IiwieSIsInoiLCJ3IiwiZiIsImRlc3Ryb3kiLCJ0ZXN0SW1hZ2VCaXRtYXAiLCJwbmdCeXRlcyIsImNyZWF0ZUltYWdlQml0bWFwIiwiQmxvYiIsInByZW11bHRpcGx5QWxwaGEiLCJ0aGVuIiwiaW1hZ2UiLCJsZXZlbHMiLCJydCIsImluaXRSZW5kZXJUYXJnZXQiLCJVaW50OENsYW1wZWRBcnJheSIsIlVOU0lHTkVEX0JZVEUiLCJjYXRjaCIsImUiLCJXZWJnbEdyYXBoaWNzRGV2aWNlIiwiR3JhcGhpY3NEZXZpY2UiLCJjb25zdHJ1Y3RvciIsImNhbnZhcyIsIm9wdGlvbnMiLCJ3ZWJnbDIiLCJkZXZpY2VUeXBlIiwiREVWSUNFVFlQRV9XRUJHTCIsImRlZmF1bHRGcmFtZWJ1ZmZlciIsInVwZGF0ZUNsaWVudFJlY3QiLCJjb250ZXh0TG9zdCIsIl9jb250ZXh0TG9zdEhhbmRsZXIiLCJldmVudCIsInByZXZlbnREZWZhdWx0IiwibG9zZUNvbnRleHQiLCJEZWJ1ZyIsImZpcmUiLCJfY29udGV4dFJlc3RvcmVkSGFuZGxlciIsInJlc3RvcmVDb250ZXh0Iiwic3RlbmNpbCIsInBvd2VyUHJlZmVyZW5jZSIsInVhIiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZyIsImluY2x1ZGVzIiwiYW50aWFsaWFzIiwicHJlZmVyV2ViR2wyIiwidW5kZWZpbmVkIiwibmFtZXMiLCJpIiwibGVuZ3RoIiwiZ2V0Q29udGV4dCIsIkVycm9yIiwiYWxwaGFCaXRzIiwiZ2V0UGFyYW1ldGVyIiwiQUxQSEFfQklUUyIsImZyYW1lYnVmZmVyRm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCOCIsImlzQ2hyb21lIiwicGxhdGZvcm0iLCJicm93c2VyIiwid2luZG93IiwiY2hyb21lIiwiaXNNYWMiLCJhcHBWZXJzaW9uIiwiaW5kZXhPZiIsIl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kIiwic2FmYXJpIiwiX3RlbXBNYWNDaHJvbWVCbGl0RnJhbWVidWZmZXJXb3JrYXJvdW5kIiwiYWxwaGEiLCJzZXR1cFZlcnRleEFycmF5T2JqZWN0IiwiYWRkRXZlbnRMaXN0ZW5lciIsImluaXRpYWxpemVFeHRlbnNpb25zIiwiaW5pdGlhbGl6ZUNhcGFiaWxpdGllcyIsImluaXRpYWxpemVSZW5kZXJTdGF0ZSIsImluaXRpYWxpemVDb250ZXh0Q2FjaGVzIiwic3VwcG9ydHNJbWFnZUJpdG1hcCIsIkltYWdlQml0bWFwIiwiZGVmYXVsdENsZWFyT3B0aW9ucyIsImNvbG9yIiwiZmxhZ3MiLCJDTEVBUkZMQUdfQ09MT1IiLCJDTEVBUkZMQUdfREVQVEgiLCJnbEFkZHJlc3MiLCJSRVBFQVQiLCJNSVJST1JFRF9SRVBFQVQiLCJnbEJsZW5kRXF1YXRpb24iLCJGVU5DX0FERCIsIkZVTkNfU1VCVFJBQ1QiLCJGVU5DX1JFVkVSU0VfU1VCVFJBQ1QiLCJNSU4iLCJleHRCbGVuZE1pbm1heCIsIk1JTl9FWFQiLCJNQVgiLCJNQVhfRVhUIiwiZ2xCbGVuZEZ1bmN0aW9uIiwiWkVSTyIsIk9ORSIsIlNSQ19DT0xPUiIsIk9ORV9NSU5VU19TUkNfQ09MT1IiLCJEU1RfQ09MT1IiLCJPTkVfTUlOVVNfRFNUX0NPTE9SIiwiU1JDX0FMUEhBIiwiU1JDX0FMUEhBX1NBVFVSQVRFIiwiT05FX01JTlVTX1NSQ19BTFBIQSIsIkRTVF9BTFBIQSIsIk9ORV9NSU5VU19EU1RfQUxQSEEiLCJDT05TVEFOVF9DT0xPUiIsIk9ORV9NSU5VU19DT05TVEFOVF9DT0xPUiIsIkNPTlNUQU5UX0FMUEhBIiwiT05FX01JTlVTX0NPTlNUQU5UX0FMUEhBIiwiZ2xDb21wYXJpc29uIiwiTkVWRVIiLCJMRVNTIiwiRVFVQUwiLCJMRVFVQUwiLCJHUkVBVEVSIiwiTk9URVFVQUwiLCJHRVFVQUwiLCJBTFdBWVMiLCJnbFN0ZW5jaWxPcCIsIktFRVAiLCJSRVBMQUNFIiwiSU5DUiIsIklOQ1JfV1JBUCIsIkRFQ1IiLCJERUNSX1dSQVAiLCJJTlZFUlQiLCJnbENsZWFyRmxhZyIsIkNPTE9SX0JVRkZFUl9CSVQiLCJERVBUSF9CVUZGRVJfQklUIiwiU1RFTkNJTF9CVUZGRVJfQklUIiwiZ2xDdWxsIiwiQkFDSyIsIkZST05UIiwiRlJPTlRfQU5EX0JBQ0siLCJnbEZpbHRlciIsIkxJTkVBUiIsIk5FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJMSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJMSU5FQVJfTUlQTUFQX0xJTkVBUiIsImdsUHJpbWl0aXZlIiwiUE9JTlRTIiwiTElORVMiLCJMSU5FX0xPT1AiLCJMSU5FX1NUUklQIiwiVFJJQU5HTEVTIiwiVFJJQU5HTEVfU1RSSVAiLCJUUklBTkdMRV9GQU4iLCJnbFR5cGUiLCJCWVRFIiwiU0hPUlQiLCJVTlNJR05FRF9TSE9SVCIsIklOVCIsIlVOU0lHTkVEX0lOVCIsIkZMT0FUIiwicGNVbmlmb3JtVHlwZSIsIkJPT0wiLCJVTklGT1JNVFlQRV9CT09MIiwiVU5JRk9STVRZUEVfSU5UIiwiVU5JRk9STVRZUEVfRkxPQVQiLCJGTE9BVF9WRUMyIiwiVU5JRk9STVRZUEVfVkVDMiIsIkZMT0FUX1ZFQzMiLCJVTklGT1JNVFlQRV9WRUMzIiwiRkxPQVRfVkVDNCIsIlVOSUZPUk1UWVBFX1ZFQzQiLCJJTlRfVkVDMiIsIlVOSUZPUk1UWVBFX0lWRUMyIiwiSU5UX1ZFQzMiLCJVTklGT1JNVFlQRV9JVkVDMyIsIklOVF9WRUM0IiwiVU5JRk9STVRZUEVfSVZFQzQiLCJCT09MX1ZFQzIiLCJVTklGT1JNVFlQRV9CVkVDMiIsIkJPT0xfVkVDMyIsIlVOSUZPUk1UWVBFX0JWRUMzIiwiQk9PTF9WRUM0IiwiVU5JRk9STVRZUEVfQlZFQzQiLCJGTE9BVF9NQVQyIiwiVU5JRk9STVRZUEVfTUFUMiIsIkZMT0FUX01BVDMiLCJVTklGT1JNVFlQRV9NQVQzIiwiRkxPQVRfTUFUNCIsIlVOSUZPUk1UWVBFX01BVDQiLCJTQU1QTEVSXzJEIiwiVU5JRk9STVRZUEVfVEVYVFVSRTJEIiwiU0FNUExFUl9DVUJFIiwiVU5JRk9STVRZUEVfVEVYVFVSRUNVQkUiLCJTQU1QTEVSXzJEX1NIQURPVyIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1ciLCJTQU1QTEVSX0NVQkVfU0hBRE9XIiwiVU5JRk9STVRZUEVfVEVYVFVSRUNVQkVfU0hBRE9XIiwiU0FNUExFUl8zRCIsIlVOSUZPUk1UWVBFX1RFWFRVUkUzRCIsInRhcmdldFRvU2xvdCIsIlRFWFRVUkVfQ1VCRV9NQVAiLCJURVhUVVJFXzNEIiwic2NvcGVYIiwic2NvcGVZIiwic2NvcGVaIiwic2NvcGVXIiwidW5pZm9ybVZhbHVlIiwiY29tbWl0RnVuY3Rpb24iLCJ1bmlmb3JtIiwidmFsdWUiLCJ1bmlmb3JtMWkiLCJsb2NhdGlvbklkIiwidW5pZm9ybTFmIiwidW5pZm9ybTJmdiIsInVuaWZvcm0zZnYiLCJ1bmlmb3JtNGZ2IiwidW5pZm9ybTJpdiIsInVuaWZvcm0zaXYiLCJ1bmlmb3JtNGl2IiwidW5pZm9ybU1hdHJpeDJmdiIsInVuaWZvcm1NYXRyaXgzZnYiLCJ1bmlmb3JtTWF0cml4NGZ2IiwiVU5JRk9STVRZUEVfRkxPQVRBUlJBWSIsInVuaWZvcm0xZnYiLCJVTklGT1JNVFlQRV9WRUMyQVJSQVkiLCJVTklGT1JNVFlQRV9WRUMzQVJSQVkiLCJVTklGT1JNVFlQRV9WRUM0QVJSQVkiLCJzdXBwb3J0c0JvbmVUZXh0dXJlcyIsImV4dFRleHR1cmVGbG9hdCIsIm1heFZlcnRleFRleHR1cmVzIiwibnVtVW5pZm9ybXMiLCJ2ZXJ0ZXhVbmlmb3Jtc0NvdW50IiwiYm9uZUxpbWl0IiwiTWF0aCIsImZsb29yIiwibWluIiwidW5tYXNrZWRSZW5kZXJlciIsInNjb3BlIiwicmVzb2x2ZSIsImV4dENvbG9yQnVmZmVyRmxvYXQiLCJleHRDb2xvckJ1ZmZlckhhbGZGbG9hdCIsInRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlIiwiZXh0VGV4dHVyZUhhbGZGbG9hdCIsIkhBTEZfRkxPQVRfT0VTIiwic3VwcG9ydHNNb3JwaFRhcmdldFRleHR1cmVzQ29yZSIsIm1heFByZWNpc2lvbiIsInN1cHBvcnRzRGVwdGhTaGFkb3ciLCJfdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiIsIl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlIiwiYXJlYUxpZ2h0THV0Rm9ybWF0IiwidGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIiLCJQSVhFTEZPUk1BVF9SR0JBMTZGIiwiZXh0VGV4dHVyZUZsb2F0TGluZWFyIiwicG9zdEluaXQiLCJmZWVkYmFjayIsImRlbGV0ZVRyYW5zZm9ybUZlZWRiYWNrIiwiY2xlYXJWZXJ0ZXhBcnJheU9iamVjdENhY2hlIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInBvc3REZXN0cm95IiwiY3JlYXRlVmVydGV4QnVmZmVySW1wbCIsInZlcnRleEJ1ZmZlciIsIldlYmdsVmVydGV4QnVmZmVyIiwiY3JlYXRlSW5kZXhCdWZmZXJJbXBsIiwiaW5kZXhCdWZmZXIiLCJXZWJnbEluZGV4QnVmZmVyIiwiY3JlYXRlU2hhZGVySW1wbCIsIldlYmdsU2hhZGVyIiwiY3JlYXRlVGV4dHVyZUltcGwiLCJXZWJnbFRleHR1cmUiLCJjcmVhdGVSZW5kZXJUYXJnZXRJbXBsIiwiV2ViZ2xSZW5kZXJUYXJnZXQiLCJwdXNoTWFya2VyIiwic3BlY3RvciIsImxhYmVsIiwidG9TdHJpbmciLCJzZXRNYXJrZXIiLCJwb3BNYXJrZXIiLCJjbGVhck1hcmtlciIsImdldFByZWNpc2lvbiIsInByZWNpc2lvbiIsImdldFNoYWRlclByZWNpc2lvbkZvcm1hdCIsInZlcnRleFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQiLCJWRVJURVhfU0hBREVSIiwiSElHSF9GTE9BVCIsInZlcnRleFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCIsIk1FRElVTV9GTE9BVCIsImZyYWdtZW50U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdCIsIkZSQUdNRU5UX1NIQURFUiIsImZyYWdtZW50U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0IiwiaGlnaHBBdmFpbGFibGUiLCJtZWRpdW1wQXZhaWxhYmxlIiwid2FybiIsInN1cHBvcnRlZEV4dGVuc2lvbnMiLCJnZXRTdXBwb3J0ZWRFeHRlbnNpb25zIiwiZ2V0RXh0ZW5zaW9uIiwiYXJndW1lbnRzIiwiZXh0RHJhd0J1ZmZlcnMiLCJleHRJbnN0YW5jaW5nIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsImV4dFRleHR1cmVMb2QiLCJleHRVaW50RWxlbWVudCIsImV4dFZlcnRleEFycmF5T2JqZWN0IiwiZXh0RGlzam9pbnRUaW1lclF1ZXJ5IiwiZXh0RGVwdGhUZXh0dXJlIiwiZXh0IiwiZHJhd0FycmF5c0luc3RhbmNlZCIsImRyYXdBcnJheXNJbnN0YW5jZWRBTkdMRSIsImJpbmQiLCJkcmF3RWxlbWVudHNJbnN0YW5jZWQiLCJkcmF3RWxlbWVudHNJbnN0YW5jZWRBTkdMRSIsInZlcnRleEF0dHJpYkRpdmlzb3IiLCJ2ZXJ0ZXhBdHRyaWJEaXZpc29yQU5HTEUiLCJjcmVhdGVWZXJ0ZXhBcnJheSIsImNyZWF0ZVZlcnRleEFycmF5T0VTIiwiZGVsZXRlVmVydGV4QXJyYXkiLCJkZWxldGVWZXJ0ZXhBcnJheU9FUyIsImlzVmVydGV4QXJyYXkiLCJpc1ZlcnRleEFycmF5T0VTIiwiYmluZFZlcnRleEFycmF5IiwiYmluZFZlcnRleEFycmF5T0VTIiwiZXh0RGVidWdSZW5kZXJlckluZm8iLCJleHRGbG9hdEJsZW5kIiwiZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZVBWUlRDIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVTM1RDIiwiZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFTVEMiLCJleHRQYXJhbGxlbFNoYWRlckNvbXBpbGUiLCJjb250ZXh0QXR0cmlicyIsImdldENvbnRleHRBdHRyaWJ1dGVzIiwic3VwcG9ydHNNc2FhIiwic3VwcG9ydHNTdGVuY2lsIiwic3VwcG9ydHNJbnN0YW5jaW5nIiwibWF4VGV4dHVyZVNpemUiLCJNQVhfVEVYVFVSRV9TSVpFIiwibWF4Q3ViZU1hcFNpemUiLCJNQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFIiwibWF4UmVuZGVyQnVmZmVyU2l6ZSIsIk1BWF9SRU5ERVJCVUZGRVJfU0laRSIsIm1heFRleHR1cmVzIiwiTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJtYXhDb21iaW5lZFRleHR1cmVzIiwiTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJNQVhfVkVSVEVYX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJNQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyIsImZyYWdtZW50VW5pZm9ybXNDb3VudCIsIk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMiLCJtYXhEcmF3QnVmZmVycyIsIk1BWF9EUkFXX0JVRkZFUlMiLCJtYXhDb2xvckF0dGFjaG1lbnRzIiwiTUFYX0NPTE9SX0FUVEFDSE1FTlRTIiwibWF4Vm9sdW1lU2l6ZSIsIk1BWF8zRF9URVhUVVJFX1NJWkUiLCJNQVhfRFJBV19CVUZGRVJTX0VYVCIsIk1BWF9DT0xPUl9BVFRBQ0hNRU5UU19FWFQiLCJVTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCIsInVubWFza2VkVmVuZG9yIiwiVU5NQVNLRURfVkVORE9SX1dFQkdMIiwic2Ftc3VuZ01vZGVsUmVnZXgiLCJzdXBwb3J0c0dwdVBhcnRpY2xlcyIsIm1hdGNoIiwibWF4QW5pc290cm9weSIsIk1BWF9URVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCIsInNhbXBsZXMiLCJTQU1QTEVTIiwibWF4U2FtcGxlcyIsIk1BWF9TQU1QTEVTIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwiYW5kcm9pZCIsInN1cHBvcnRzVGV4dHVyZUZldGNoIiwiYmxlbmRpbmciLCJkaXNhYmxlIiwiQkxFTkQiLCJibGVuZFNyYyIsIkJMRU5ETU9ERV9PTkUiLCJibGVuZERzdCIsIkJMRU5ETU9ERV9aRVJPIiwiYmxlbmRTcmNBbHBoYSIsImJsZW5kRHN0QWxwaGEiLCJzZXBhcmF0ZUFscGhhQmxlbmQiLCJibGVuZEVxdWF0aW9uIiwiQkxFTkRFUVVBVElPTl9BREQiLCJibGVuZEFscGhhRXF1YXRpb24iLCJzZXBhcmF0ZUFscGhhRXF1YXRpb24iLCJibGVuZEZ1bmMiLCJibGVuZENvbG9yIiwiQ29sb3IiLCJjb2xvck1hc2siLCJjdWxsTW9kZSIsIkNVTExGQUNFX0JBQ0siLCJlbmFibGUiLCJDVUxMX0ZBQ0UiLCJjdWxsRmFjZSIsImRlcHRoVGVzdCIsIkRFUFRIX1RFU1QiLCJkZXB0aEZ1bmMiLCJGVU5DX0xFU1NFUVVBTCIsImRlcHRoV3JpdGUiLCJkZXB0aE1hc2siLCJTVEVOQ0lMX1RFU1QiLCJzdGVuY2lsRnVuY0Zyb250Iiwic3RlbmNpbEZ1bmNCYWNrIiwiRlVOQ19BTFdBWVMiLCJzdGVuY2lsUmVmRnJvbnQiLCJzdGVuY2lsUmVmQmFjayIsInN0ZW5jaWxNYXNrRnJvbnQiLCJzdGVuY2lsTWFza0JhY2siLCJzdGVuY2lsRnVuYyIsInN0ZW5jaWxGYWlsRnJvbnQiLCJzdGVuY2lsRmFpbEJhY2siLCJTVEVOQ0lMT1BfS0VFUCIsInN0ZW5jaWxaZmFpbEZyb250Iiwic3RlbmNpbFpmYWlsQmFjayIsInN0ZW5jaWxacGFzc0Zyb250Iiwic3RlbmNpbFpwYXNzQmFjayIsInN0ZW5jaWxXcml0ZU1hc2tGcm9udCIsInN0ZW5jaWxXcml0ZU1hc2tCYWNrIiwic3RlbmNpbE9wIiwic3RlbmNpbE1hc2siLCJhbHBoYVRvQ292ZXJhZ2UiLCJyYXN0ZXIiLCJTQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UiLCJSQVNURVJJWkVSX0RJU0NBUkQiLCJkZXB0aEJpYXNFbmFibGVkIiwiUE9MWUdPTl9PRkZTRVRfRklMTCIsImNsZWFyRGVwdGgiLCJjbGVhckNvbG9yIiwiY2xlYXJTdGVuY2lsIiwiaGludCIsIkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlQiLCJOSUNFU1QiLCJGUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5UX09FUyIsIlNDSVNTT1JfVEVTVCIsInBpeGVsU3RvcmVpIiwiVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTl9XRUJHTCIsIk5PTkUiLCJ1bnBhY2tGbGlwWSIsIlVOUEFDS19GTElQX1lfV0VCR0wiLCJ1bnBhY2tQcmVtdWx0aXBseUFscGhhIiwiVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMIiwiVU5QQUNLX0FMSUdOTUVOVCIsIl92YW9NYXAiLCJNYXAiLCJib3VuZFZhbyIsInRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyIiwidGV4dHVyZVVuaXQiLCJ0ZXh0dXJlVW5pdHMiLCJwdXNoIiwic2hhZGVycyIsInRleHR1cmVzIiwiYnVmZmVyIiwiYnVmZmVycyIsInRhcmdldHMiLCJ1bmxvY2siLCJlbmRTaGFkZXJCYXRjaCIsInNldFZpZXdwb3J0IiwiaCIsInZ4IiwidnkiLCJ2dyIsInZoIiwidmlld3BvcnQiLCJzZXRTY2lzc29yIiwic3giLCJzeSIsInN3Iiwic2giLCJzY2lzc29yIiwiZmIiLCJjb3B5UmVuZGVyVGFyZ2V0Iiwic291cmNlIiwiZGVzdCIsImVycm9yIiwiX2NvbG9yQnVmZmVyIiwiX2Zvcm1hdCIsIl9kZXB0aCIsIl9kZXB0aEJ1ZmZlciIsInByZXZSdCIsIlJFQURfRlJBTUVCVUZGRVIiLCJEUkFXX0ZSQU1FQlVGRkVSIiwiYmxpdEZyYW1lYnVmZmVyIiwiZ2V0Q29weVNoYWRlciIsIl9jb3B5U2hhZGVyIiwic3RhcnRQYXNzIiwicmVuZGVyUGFzcyIsImNvbG9yT3BzIiwiZGVwdGhTdGVuY2lsT3BzIiwiY2xlYXIiLCJjbGVhckZsYWdzIiwiY2xlYXJPcHRpb25zIiwiY2xlYXJWYWx1ZSIsInIiLCJnIiwiYiIsImEiLCJjbGVhckRlcHRoVmFsdWUiLCJDTEVBUkZMQUdfU1RFTkNJTCIsImNsZWFyU3RlbmNpbFZhbHVlIiwiYXNzZXJ0IiwiaW5zaWRlUmVuZGVyUGFzcyIsImVuZFBhc3MiLCJ1bmJpbmRWZXJ0ZXhBcnJheSIsInN0b3JlIiwic3RvcmVEZXB0aCIsIkRFUFRIX0FUVEFDSE1FTlQiLCJzdG9yZVN0ZW5jaWwiLCJTVEVOQ0lMX0FUVEFDSE1FTlQiLCJmdWxsU2l6ZUNsZWFyUmVjdCIsImludmFsaWRhdGVGcmFtZWJ1ZmZlciIsImF1dG9SZXNvbHZlIiwiX2dsVGV4dHVyZSIsInBvdCIsImFjdGl2ZVRleHR1cmUiLCJnZW5lcmF0ZU1pcG1hcCIsIl9nbFRhcmdldCIsInVuaXQiLCJzbG90IiwiaW5pdGlhbGl6ZWQiLCJfc2FtcGxlcyIsInNldFVucGFja0ZsaXBZIiwiZmxpcFkiLCJzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhIiwiVEVYVFVSRTAiLCJ0ZXh0dXJlVGFyZ2V0IiwidGV4dHVyZU9iamVjdCIsImJpbmRUZXh0dXJlT25Vbml0Iiwic2V0VGV4dHVyZVBhcmFtZXRlcnMiLCJfcGFyYW1ldGVyRmxhZ3MiLCJmaWx0ZXIiLCJfbWluRmlsdGVyIiwiX21pcG1hcHMiLCJfY29tcHJlc3NlZCIsIl9sZXZlbHMiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUiIsIl9tYWdGaWx0ZXIiLCJfYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJfYWRkcmVzc1YiLCJURVhUVVJFX1dSQVBfUiIsIl9hZGRyZXNzVyIsIlRFWFRVUkVfQ09NUEFSRV9NT0RFIiwiX2NvbXBhcmVPblJlYWQiLCJDT01QQVJFX1JFRl9UT19URVhUVVJFIiwiVEVYVFVSRV9DT01QQVJFX0ZVTkMiLCJfY29tcGFyZUZ1bmMiLCJ0ZXhQYXJhbWV0ZXJmIiwiVEVYVFVSRV9NQVhfQU5JU09UUk9QWV9FWFQiLCJtYXgiLCJyb3VuZCIsIl9hbmlzb3Ryb3B5Iiwic2V0VGV4dHVyZSIsImluaXRpYWxpemUiLCJfbmVlZHNVcGxvYWQiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwidXBsb2FkIiwidmVydGV4QnVmZmVycyIsImtleSIsInZhbyIsInVzZUNhY2hlIiwiaWQiLCJyZW5kZXJpbmdpbmdIYXNoIiwiZ2V0IiwiYmluZEJ1ZmZlciIsIkVMRU1FTlRfQVJSQVlfQlVGRkVSIiwibG9jWmVybyIsIkFSUkFZX0JVRkZFUiIsImJ1ZmZlcklkIiwiZWxlbWVudHMiLCJqIiwibG9jIiwic2VtYW50aWNUb0xvY2F0aW9uIiwidmVydGV4QXR0cmliUG9pbnRlciIsIm51bUNvbXBvbmVudHMiLCJkYXRhVHlwZSIsIm5vcm1hbGl6ZSIsInN0cmlkZSIsIm9mZnNldCIsImVuYWJsZVZlcnRleEF0dHJpYkFycmF5IiwiaW5zdGFuY2luZyIsInNldCIsInNldEJ1ZmZlcnMiLCJwcmltaXRpdmUiLCJudW1JbnN0YW5jZXMiLCJrZWVwQnVmZmVycyIsInNhbXBsZXIiLCJzYW1wbGVyVmFsdWUiLCJudW1UZXh0dXJlcyIsInNjb3BlSWQiLCJ1bmlmb3JtVmVyc2lvbiIsInByb2dyYW1WZXJzaW9uIiwic2FtcGxlcnMiLCJ1bmlmb3JtcyIsImxlbiIsInNhbXBsZXJOYW1lIiwid2Fybk9uY2UiLCJlcnJvck9uY2UiLCJkZXB0aEJ1ZmZlciIsImFycmF5IiwidW5pZm9ybTFpdiIsInZlcnNpb24iLCJ2ZXJzaW9uT2JqZWN0IiwiZ2xvYmFsSWQiLCJyZXZpc2lvbiIsImJpbmRCdWZmZXJCYXNlIiwiVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiIsImJlZ2luVHJhbnNmb3JtRmVlZGJhY2siLCJtb2RlIiwiZ2xGb3JtYXQiLCJieXRlc1BlckluZGV4IiwiZHJhd0VsZW1lbnRzIiwiZmlyc3QiLCJkcmF3QXJyYXlzIiwiZW5kVHJhbnNmb3JtRmVlZGJhY2siLCJfZHJhd0NhbGxzUGVyRnJhbWUiLCJfcHJpbXNQZXJGcmFtZSIsImRlZmF1bHRPcHRpb25zIiwic2V0Q2xlYXJDb2xvciIsInNldENsZWFyRGVwdGgiLCJzZXRDbGVhclN0ZW5jaWwiLCJjIiwic2V0RGVwdGhGdW5jIiwiZnVuYyIsIndyaXRlRGVwdGgiLCJzZXRBbHBoYVRvQ292ZXJhZ2UiLCJzdGF0ZSIsInNldFRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyIiwidGYiLCJjcmVhdGVUcmFuc2Zvcm1GZWVkYmFjayIsImJpbmRUcmFuc2Zvcm1GZWVkYmFjayIsIlRSQU5TRk9STV9GRUVEQkFDSyIsInNldFJhc3RlciIsIm9uIiwic2V0RGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwiY29uc3RCaWFzIiwic2xvcGVCaWFzIiwicG9seWdvbk9mZnNldCIsImdldEJsZW5kaW5nIiwic2V0QmxlbmRpbmciLCJzZXRTdGVuY2lsVGVzdCIsInNldFN0ZW5jaWxGdW5jIiwicmVmIiwibWFzayIsInNldFN0ZW5jaWxGdW5jRnJvbnQiLCJzdGVuY2lsRnVuY1NlcGFyYXRlIiwic2V0U3RlbmNpbEZ1bmNCYWNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbiIsImZhaWwiLCJ6ZmFpbCIsInpwYXNzIiwid3JpdGVNYXNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbkZyb250Iiwic3RlbmNpbE9wU2VwYXJhdGUiLCJzdGVuY2lsTWFza1NlcGFyYXRlIiwic2V0U3RlbmNpbE9wZXJhdGlvbkJhY2siLCJzZXRCbGVuZEZ1bmN0aW9uIiwic2V0QmxlbmRGdW5jdGlvblNlcGFyYXRlIiwiYmxlbmRGdW5jU2VwYXJhdGUiLCJzZXRCbGVuZEVxdWF0aW9uIiwic2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlIiwiYmxlbmRFcXVhdGlvblNlcGFyYXRlIiwic2V0QmxlbmRDb2xvciIsImZhaWxlZCIsInJlYWR5IiwiZmluYWxpemUiLCJ1c2VQcm9ncmFtIiwiZ2xQcm9ncmFtIiwiX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUiLCJhdHRyaWJ1dGVzSW52YWxpZGF0ZWQiLCJnZXRIZHJGb3JtYXQiLCJwcmVmZXJMYXJnZXN0IiwicmVuZGVyYWJsZSIsInVwZGF0YWJsZSIsImZpbHRlcmFibGUiLCJmMTZWYWxpZCIsImYzMlZhbGlkIiwiZm9yRWFjaCIsIml0ZW0iLCJtYXBPYmoiLCJkcmF3aW5nQnVmZmVyV2lkdGgiLCJkcmF3aW5nQnVmZmVySGVpZ2h0IiwiZnVsbHNjcmVlbiIsInJlcXVlc3RGdWxsc2NyZWVuIiwiZG9jdW1lbnQiLCJleGl0RnVsbHNjcmVlbiIsImZ1bGxzY3JlZW5FbGVtZW50IiwidGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXVDQSxNQUFNQSxxQkFBcUIsR0FBRyxFQUFFLENBQUE7QUFFaEMsTUFBTUMsaUJBQWlCLGFBQWMsQ0FBQTtBQUNyQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FBQTtBQUVELE1BQU1DLGlCQUFpQixhQUFjLENBQUE7QUFDckM7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsaUJBQWlCLGFBQWMsQ0FBQTtBQUNyQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FBQTtBQUVELE1BQU1DLGdCQUFnQixhQUFjLENBQUE7QUFDcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsQ0FBQTtBQUVELFNBQVNDLGNBQWMsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUU1Q0MsRUFBQUEsYUFBYSxDQUFDQyxhQUFhLENB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
