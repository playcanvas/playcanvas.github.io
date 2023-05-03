import { setupVertexArrayObject } from '../../../polyfill/OESVertexArrayObject.js';
import { Debug } from '../../../core/debug.js';
import { platform } from '../../../core/platform.js';
import { Color } from '../../../core/math/color.js';
import { DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1, PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, FUNC_ALWAYS, STENCILOP_KEEP, ADDRESS_CLAMP_TO_EDGE, semanticToLocation, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_NONE, PRIMITIVE_TRISTRIP, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR } from '../constants.js';
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
import { StencilParameters } from '../stencil-parameters.js';

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
  device.setStencilState(null, null);
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
   * @param {boolean} [options.stencil=true] - Boolean that indicates that the drawing buffer is
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
   * @param {WebGLRenderingContext | WebGL2RenderingContext} [options.gl] - The rendering context
   * to use. If not specified, a new context will be created.
   */
  constructor(canvas, options = {}) {
    super(canvas, options);
    this.gl = void 0;
    this.webgl2 = void 0;
    options = this.initOptions;
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

    // #4136 - turn off antialiasing on AppleWebKit browsers 15.4
    const ua = typeof navigator !== 'undefined' && navigator.userAgent;
    this.forceDisableMultisampling = ua && ua.includes('AppleWebKit') && (ua.includes('15.4') || ua.includes('15_4'));
    if (this.forceDisableMultisampling) {
      options.antialias = false;
      Debug.log("Antialiasing has been turned off due to rendering issues on AppleWebKit 15.4");
    }
    let gl = null;

    // Retrieve the WebGL context
    if (options.gl) {
      gl = options.gl;
    } else {
      const preferWebGl2 = options.preferWebGl2 !== undefined ? options.preferWebGl2 : true;
      const names = preferWebGl2 ? ["webgl2", "webgl", "experimental-webgl"] : ["webgl", "experimental-webgl"];
      for (let i = 0; i < names.length; i++) {
        gl = canvas.getContext(names[i], options);
        if (gl) {
          break;
        }
      }
    }
    if (!gl) {
      throw new Error("WebGL not supported");
    }
    this.gl = gl;
    this.webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    this._deviceType = this.webgl2 ? DEVICETYPE_WEBGL2 : DEVICETYPE_WEBGL1;

    // pixel format of the framebuffer
    const alphaBits = gl.getParameter(gl.ALPHA_BITS);
    this.framebufferFormat = alphaBits ? PIXELFORMAT_RGBA8 : PIXELFORMAT_RGB8;
    const isChrome = platform.browser && !!window.chrome;
    const isSafari = platform.browser && !!window.safari;
    const isMac = platform.browser && navigator.appVersion.indexOf("Mac") !== -1;

    // enable temporary texture unit workaround on desktop safari
    this._tempEnableSafariTextureUnitWorkaround = isSafari;

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

    // only enable ImageBitmap on chrome
    this.supportsImageBitmap = !isSafari && typeof ImageBitmap !== 'undefined';
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

    // Mali-G52 has rendering issues with GPU particles including
    // SM-A225M, M2003J15SC and KFRAWI (Amazon Fire HD 8 2022)
    const maliRendererRegex = /\bMali-G52+/;
    this.supportsGpuParticles = !this.unmaskedRenderer.match(maliRendererRegex);
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
          Debug.warnOnce(`A sampler ${samplerName} is used by the shader but a scene color texture is not available. Use CameraComponent.requestSceneColorMap to enable it.`);
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
      this.gl.stencilFunc(this.glComparison[func], ref, mask);
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
  setStencilState(stencilFront, stencilBack) {
    if (stencilFront || stencilBack) {
      this.setStencilTest(true);
      if (stencilFront === stencilBack) {
        // identical front/back stencil
        this.setStencilFunc(stencilFront.func, stencilFront.ref, stencilFront.readMask);
        this.setStencilOperation(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);
      } else {
        var _stencilFront, _stencilBack;
        // front
        (_stencilFront = stencilFront) != null ? _stencilFront : stencilFront = StencilParameters.DEFAULT;
        this.setStencilFuncFront(stencilFront.func, stencilFront.ref, stencilFront.readMask);
        this.setStencilOperationFront(stencilFront.fail, stencilFront.zfail, stencilFront.zpass, stencilFront.writeMask);

        // back
        (_stencilBack = stencilBack) != null ? _stencilBack : stencilBack = StencilParameters.DEFAULT;
        this.setStencilFuncBack(stencilBack.func, stencilBack.ref, stencilBack.readMask);
        this.setStencilOperationBack(stencilBack.fail, stencilBack.zfail, stencilBack.zpass, stencilBack.writeMask);
      }
    } else {
      this.setStencilTest(false);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNldHVwVmVydGV4QXJyYXlPYmplY3QgfSBmcm9tICcuLi8uLi8uLi9wb2x5ZmlsbC9PRVNWZXJ0ZXhBcnJheU9iamVjdC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgQ0xFQVJGTEFHX0NPTE9SLCBDTEVBUkZMQUdfREVQVEgsIENMRUFSRkxBR19TVEVOQ0lMLFxuICAgIENVTExGQUNFX05PTkUsXG4gICAgRklMVEVSX05FQVJFU1QsIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNULCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBGVU5DX0FMV0FZUyxcbiAgICBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBTVEVOQ0lMT1BfS0VFUCxcbiAgICBVTklGT1JNVFlQRV9CT09MLCBVTklGT1JNVFlQRV9JTlQsIFVOSUZPUk1UWVBFX0ZMT0FULCBVTklGT1JNVFlQRV9WRUMyLCBVTklGT1JNVFlQRV9WRUMzLFxuICAgIFVOSUZPUk1UWVBFX1ZFQzQsIFVOSUZPUk1UWVBFX0lWRUMyLCBVTklGT1JNVFlQRV9JVkVDMywgVU5JRk9STVRZUEVfSVZFQzQsIFVOSUZPUk1UWVBFX0JWRUMyLFxuICAgIFVOSUZPUk1UWVBFX0JWRUMzLCBVTklGT1JNVFlQRV9CVkVDNCwgVU5JRk9STVRZUEVfTUFUMiwgVU5JRk9STVRZUEVfTUFUMywgVU5JRk9STVRZUEVfTUFUNCxcbiAgICBVTklGT1JNVFlQRV9URVhUVVJFMkQsIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFLCBVTklGT1JNVFlQRV9GTE9BVEFSUkFZLCBVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XLFxuICAgIFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVywgVU5JRk9STVRZUEVfVEVYVFVSRTNELCBVTklGT1JNVFlQRV9WRUMyQVJSQVksIFVOSUZPUk1UWVBFX1ZFQzNBUlJBWSwgVU5JRk9STVRZUEVfVkVDNEFSUkFZLFxuICAgIHNlbWFudGljVG9Mb2NhdGlvbixcbiAgICBQUklNSVRJVkVfVFJJU1RSSVAsXG4gICAgREVWSUNFVFlQRV9XRUJHTDIsXG4gICAgREVWSUNFVFlQRV9XRUJHTDFcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgR3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuLi9ncmFwaGljcy1kZXZpY2UuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vZGVidWctZ3JhcGhpY3MuanMnO1xuXG5pbXBvcnQgeyBXZWJnbFZlcnRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ2wtdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBXZWJnbEluZGV4QnVmZmVyIH0gZnJvbSAnLi93ZWJnbC1pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xTaGFkZXIgfSBmcm9tICcuL3dlYmdsLXNoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJnbFRleHR1cmUgfSBmcm9tICcuL3dlYmdsLXRleHR1cmUuanMnO1xuaW1wb3J0IHsgV2ViZ2xSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3dlYmdsLXJlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2hhZGVyVXRpbHMgfSBmcm9tICcuLi9zaGFkZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSAnLi4vc2hhZGVyLmpzJztcbmltcG9ydCB7IEJsZW5kU3RhdGUgfSBmcm9tICcuLi9ibGVuZC1zdGF0ZS5qcyc7XG5pbXBvcnQgeyBEZXB0aFN0YXRlIH0gZnJvbSAnLi4vZGVwdGgtc3RhdGUuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuLi9zdGVuY2lsLXBhcmFtZXRlcnMuanMnO1xuXG5jb25zdCBpbnZhbGlkYXRlQXR0YWNobWVudHMgPSBbXTtcblxuY29uc3QgX2Z1bGxTY3JlZW5RdWFkVlMgPSAvKiBnbHNsICovYFxuYXR0cmlidXRlIHZlYzIgdmVydGV4X3Bvc2l0aW9uO1xudmFyeWluZyB2ZWMyIHZVdjA7XG52b2lkIG1haW4odm9pZClcbntcbiAgICBnbF9Qb3NpdGlvbiA9IHZlYzQodmVydGV4X3Bvc2l0aW9uLCAwLjUsIDEuMCk7XG4gICAgdlV2MCA9IHZlcnRleF9wb3NpdGlvbi54eSowLjUrMC41O1xufVxuYDtcblxuY29uc3QgX3ByZWNpc2lvblRlc3QxUFMgPSAvKiBnbHNsICovYFxudm9pZCBtYWluKHZvaWQpIHsgXG4gICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgyMTQ3NDgzNjQ4LjApO1xufVxuYDtcblxuY29uc3QgX3ByZWNpc2lvblRlc3QyUFMgPSAvKiBnbHNsICovYFxudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xudmVjNCBwYWNrRmxvYXQoZmxvYXQgZGVwdGgpIHtcbiAgICBjb25zdCB2ZWM0IGJpdF9zaGlmdCA9IHZlYzQoMjU2LjAgKiAyNTYuMCAqIDI1Ni4wLCAyNTYuMCAqIDI1Ni4wLCAyNTYuMCwgMS4wKTtcbiAgICBjb25zdCB2ZWM0IGJpdF9tYXNrICA9IHZlYzQoMC4wLCAxLjAgLyAyNTYuMCwgMS4wIC8gMjU2LjAsIDEuMCAvIDI1Ni4wKTtcbiAgICB2ZWM0IHJlcyA9IG1vZChkZXB0aCAqIGJpdF9zaGlmdCAqIHZlYzQoMjU1KSwgdmVjNCgyNTYpICkgLyB2ZWM0KDI1NSk7XG4gICAgcmVzIC09IHJlcy54eHl6ICogYml0X21hc2s7XG4gICAgcmV0dXJuIHJlcztcbn1cbnZvaWQgbWFpbih2b2lkKSB7XG4gICAgZmxvYXQgYyA9IHRleHR1cmUyRChzb3VyY2UsIHZlYzIoMC4wKSkucjtcbiAgICBmbG9hdCBkaWZmID0gYWJzKGMgLSAyMTQ3NDgzNjQ4LjApIC8gMjE0NzQ4MzY0OC4wO1xuICAgIGdsX0ZyYWdDb2xvciA9IHBhY2tGbG9hdChkaWZmKTtcbn1cbmA7XG5cbmNvbnN0IF9vdXRwdXRUZXh0dXJlMkQgPSAvKiBnbHNsICovYFxudmFyeWluZyB2ZWMyIHZVdjA7XG51bmlmb3JtIHNhbXBsZXIyRCBzb3VyY2U7XG52b2lkIG1haW4odm9pZCkge1xuICAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRChzb3VyY2UsIHZVdjApO1xufVxuYDtcblxuZnVuY3Rpb24gcXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0YXJnZXQsIHNoYWRlcikge1xuXG4gICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgXCJRdWFkV2l0aFNoYWRlclwiKTtcblxuICAgIGNvbnN0IG9sZFJ0ID0gZGV2aWNlLnJlbmRlclRhcmdldDtcbiAgICBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHRhcmdldCk7XG4gICAgZGV2aWNlLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICBkZXZpY2Uuc2V0Q3VsbE1vZGUoQ1VMTEZBQ0VfTk9ORSk7XG4gICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5ERUZBVUxUKTtcbiAgICBkZXZpY2Uuc2V0RGVwdGhTdGF0ZShEZXB0aFN0YXRlLk5PREVQVEgpO1xuICAgIGRldmljZS5zZXRTdGVuY2lsU3RhdGUobnVsbCwgbnVsbCk7XG5cbiAgICBkZXZpY2Uuc2V0VmVydGV4QnVmZmVyKGRldmljZS5xdWFkVmVydGV4QnVmZmVyLCAwKTtcbiAgICBkZXZpY2Uuc2V0U2hhZGVyKHNoYWRlcik7XG5cbiAgICBkZXZpY2UuZHJhdyh7XG4gICAgICAgIHR5cGU6IFBSSU1JVElWRV9UUklTVFJJUCxcbiAgICAgICAgYmFzZTogMCxcbiAgICAgICAgY291bnQ6IDQsXG4gICAgICAgIGluZGV4ZWQ6IGZhbHNlXG4gICAgfSk7XG5cbiAgICBkZXZpY2UudXBkYXRlRW5kKCk7XG5cbiAgICBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KG9sZFJ0KTtcbiAgICBkZXZpY2UudXBkYXRlQmVnaW4oKTtcblxuICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG59XG5cbmZ1bmN0aW9uIHRlc3RSZW5kZXJhYmxlKGdsLCBwaXhlbEZvcm1hdCkge1xuICAgIGxldCByZXN1bHQgPSB0cnVlO1xuXG4gICAgLy8gQ3JlYXRlIGEgMngyIHRleHR1cmVcbiAgICBjb25zdCB0ZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRleHR1cmUpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAyLCAyLCAwLCBnbC5SR0JBLCBwaXhlbEZvcm1hdCwgbnVsbCk7XG5cbiAgICAvLyBUcnkgdG8gdXNlIHRoaXMgdGV4dHVyZSBhcyBhIHJlbmRlciB0YXJnZXRcbiAgICBjb25zdCBmcmFtZWJ1ZmZlciA9IGdsLmNyZWF0ZUZyYW1lYnVmZmVyKCk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBmcmFtZWJ1ZmZlcik7XG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCB0ZXh0dXJlLCAwKTtcblxuICAgIC8vIEl0IGlzIGxlZ2FsIGZvciBhIFdlYkdMIGltcGxlbWVudGF0aW9uIGV4cG9zaW5nIHRoZSBPRVNfdGV4dHVyZV9mbG9hdCBleHRlbnNpb24gdG9cbiAgICAvLyBzdXBwb3J0IGZsb2F0aW5nLXBvaW50IHRleHR1cmVzIGJ1dCBub3QgYXMgYXR0YWNobWVudHMgdG8gZnJhbWVidWZmZXIgb2JqZWN0cy5cbiAgICBpZiAoZ2wuY2hlY2tGcmFtZWJ1ZmZlclN0YXR1cyhnbC5GUkFNRUJVRkZFUikgIT09IGdsLkZSQU1FQlVGRkVSX0NPTVBMRVRFKSB7XG4gICAgICAgIHJlc3VsdCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIENsZWFuIHVwXG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gICAgZ2wuZGVsZXRlVGV4dHVyZSh0ZXh0dXJlKTtcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIG51bGwpO1xuICAgIGdsLmRlbGV0ZUZyYW1lYnVmZmVyKGZyYW1lYnVmZmVyKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRlc3RUZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlKGdsLCBwaXhlbEZvcm1hdCkge1xuICAgIGxldCByZXN1bHQgPSB0cnVlO1xuXG4gICAgLy8gQ3JlYXRlIGEgMngyIHRleHR1cmVcbiAgICBjb25zdCB0ZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRleHR1cmUpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG5cbiAgICAvLyB1cGxvYWQgc29tZSBkYXRhIC0gb24gaU9TIHByaW9yIHRvIGFib3V0IE5vdmVtYmVyIDIwMTksIHBhc3NpbmcgZGF0YSB0byBoYWxmIHRleHR1cmUgd291bGQgZmFpbCBoZXJlXG4gICAgLy8gc2VlIGRldGFpbHMgaGVyZTogaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTE2OTk5OVxuICAgIC8vIG5vdGUgdGhhdCBpZiBub3Qgc3VwcG9ydGVkLCB0aGlzIHByaW50cyBhbiBlcnJvciB0byBjb25zb2xlLCB0aGUgZXJyb3IgY2FuIGJlIHNhZmVseSBpZ25vcmVkIGFzIGl0J3MgaGFuZGxlZFxuICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDE2QXJyYXkoNCAqIDIgKiAyKTtcbiAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIDIsIDIsIDAsIGdsLlJHQkEsIHBpeGVsRm9ybWF0LCBkYXRhKTtcblxuICAgIGlmIChnbC5nZXRFcnJvcigpICE9PSBnbC5OT19FUlJPUikge1xuICAgICAgICByZXN1bHQgPSBmYWxzZTtcbiAgICAgICAgY29uc29sZS5sb2coXCJBYm92ZSBlcnJvciByZWxhdGVkIHRvIEhBTEZfRkxPQVRfT0VTIGNhbiBiZSBpZ25vcmVkLCBpdCB3YXMgdHJpZ2dlcmVkIGJ5IHRlc3RpbmcgaGFsZiBmbG9hdCB0ZXh0dXJlIHN1cHBvcnRcIik7XG4gICAgfVxuXG4gICAgLy8gQ2xlYW4gdXBcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBudWxsKTtcbiAgICBnbC5kZWxldGVUZXh0dXJlKHRleHR1cmUpO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gdGVzdFRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24oZGV2aWNlKSB7XG4gICAgaWYgKCFkZXZpY2UudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3Qgc2hhZGVyMSA9IG5ldyBTaGFkZXIoZGV2aWNlLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKGRldmljZSwge1xuICAgICAgICBuYW1lOiAncHRlc3QxJyxcbiAgICAgICAgdmVydGV4Q29kZTogX2Z1bGxTY3JlZW5RdWFkVlMsXG4gICAgICAgIGZyYWdtZW50Q29kZTogX3ByZWNpc2lvblRlc3QxUFNcbiAgICB9KSk7XG5cbiAgICBjb25zdCBzaGFkZXIyID0gbmV3IFNoYWRlcihkZXZpY2UsIFNoYWRlclV0aWxzLmNyZWF0ZURlZmluaXRpb24oZGV2aWNlLCB7XG4gICAgICAgIG5hbWU6ICdwdGVzdDInLFxuICAgICAgICB2ZXJ0ZXhDb2RlOiBfZnVsbFNjcmVlblF1YWRWUyxcbiAgICAgICAgZnJhZ21lbnRDb2RlOiBfcHJlY2lzaW9uVGVzdDJQU1xuICAgIH0pKTtcblxuICAgIGNvbnN0IHRleHR1cmVPcHRpb25zID0ge1xuICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1JHQkEzMkYsXG4gICAgICAgIHdpZHRoOiAxLFxuICAgICAgICBoZWlnaHQ6IDEsXG4gICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICBtaW5GaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICBuYW1lOiAndGVzdEZIUCdcbiAgICB9O1xuICAgIGNvbnN0IHRleDEgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHRleHR1cmVPcHRpb25zKTtcbiAgICBjb25zdCB0YXJnMSA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICBjb2xvckJ1ZmZlcjogdGV4MSxcbiAgICAgICAgZGVwdGg6IGZhbHNlXG4gICAgfSk7XG4gICAgcXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0YXJnMSwgc2hhZGVyMSk7XG5cbiAgICB0ZXh0dXJlT3B0aW9ucy5mb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBODtcbiAgICBjb25zdCB0ZXgyID0gbmV3IFRleHR1cmUoZGV2aWNlLCB0ZXh0dXJlT3B0aW9ucyk7XG4gICAgY29uc3QgdGFyZzIgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgY29sb3JCdWZmZXI6IHRleDIsXG4gICAgICAgIGRlcHRoOiBmYWxzZVxuICAgIH0pO1xuICAgIGRldmljZS5jb25zdGFudFRleFNvdXJjZS5zZXRWYWx1ZSh0ZXgxKTtcbiAgICBxdWFkV2l0aFNoYWRlcihkZXZpY2UsIHRhcmcyLCBzaGFkZXIyKTtcblxuICAgIGNvbnN0IHByZXZGcmFtZWJ1ZmZlciA9IGRldmljZS5hY3RpdmVGcmFtZWJ1ZmZlcjtcbiAgICBkZXZpY2Uuc2V0RnJhbWVidWZmZXIodGFyZzIuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG5cbiAgICBjb25zdCBwaXhlbHMgPSBuZXcgVWludDhBcnJheSg0KTtcbiAgICBkZXZpY2UucmVhZFBpeGVscygwLCAwLCAxLCAxLCBwaXhlbHMpO1xuXG4gICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHByZXZGcmFtZWJ1ZmZlcik7XG5cbiAgICBjb25zdCB4ID0gcGl4ZWxzWzBdIC8gMjU1O1xuICAgIGNvbnN0IHkgPSBwaXhlbHNbMV0gLyAyNTU7XG4gICAgY29uc3QgeiA9IHBpeGVsc1syXSAvIDI1NTtcbiAgICBjb25zdCB3ID0gcGl4ZWxzWzNdIC8gMjU1O1xuICAgIGNvbnN0IGYgPSB4IC8gKDI1NiAqIDI1NiAqIDI1NikgKyB5IC8gKDI1NiAqIDI1NikgKyB6IC8gMjU2ICsgdztcblxuICAgIHRleDEuZGVzdHJveSgpO1xuICAgIHRhcmcxLmRlc3Ryb3koKTtcbiAgICB0ZXgyLmRlc3Ryb3koKTtcbiAgICB0YXJnMi5kZXN0cm95KCk7XG4gICAgc2hhZGVyMS5kZXN0cm95KCk7XG4gICAgc2hhZGVyMi5kZXN0cm95KCk7XG5cbiAgICByZXR1cm4gZiA9PT0gMDtcbn1cblxuLyoqXG4gKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIG1hbmFnZXMgdGhlIHVuZGVybHlpbmcgZ3JhcGhpY3MgY29udGV4dC4gSXQgaXMgcmVzcG9uc2libGUgZm9yIHN1Ym1pdHRpbmdcbiAqIHJlbmRlciBzdGF0ZSBjaGFuZ2VzIGFuZCBncmFwaGljcyBwcmltaXRpdmVzIHRvIHRoZSBoYXJkd2FyZS4gQSBncmFwaGljcyBkZXZpY2UgaXMgdGllZCB0byBhXG4gKiBzcGVjaWZpYyBjYW52YXMgSFRNTCBlbGVtZW50LiBJdCBpcyB2YWxpZCB0byBoYXZlIG1vcmUgdGhhbiBvbmUgY2FudmFzIGVsZW1lbnQgcGVyIHBhZ2UgYW5kXG4gKiBjcmVhdGUgYSBuZXcgZ3JhcGhpY3MgZGV2aWNlIGFnYWluc3QgZWFjaC5cbiAqXG4gKiBAYXVnbWVudHMgR3JhcGhpY3NEZXZpY2VcbiAqL1xuY2xhc3MgV2ViZ2xHcmFwaGljc0RldmljZSBleHRlbmRzIEdyYXBoaWNzRGV2aWNlIHtcbiAgICAvKipcbiAgICAgKiBUaGUgV2ViR0wgY29udGV4dCBtYW5hZ2VkIGJ5IHRoZSBncmFwaGljcyBkZXZpY2UuIFRoZSB0eXBlIGNvdWxkIGFsc28gdGVjaG5pY2FsbHkgYmVcbiAgICAgKiBgV2ViR0xSZW5kZXJpbmdDb250ZXh0YCBpZiBXZWJHTCAyLjAgaXMgbm90IGF2YWlsYWJsZS4gQnV0IGluIG9yZGVyIGZvciBJbnRlbGxpU2Vuc2UgdG8gYmVcbiAgICAgKiBhYmxlIHRvIGZ1bmN0aW9uIGZvciBhbGwgV2ViR0wgY2FsbHMgaW4gdGhlIGNvZGViYXNlLCB3ZSBzcGVjaWZ5IGBXZWJHTDJSZW5kZXJpbmdDb250ZXh0YFxuICAgICAqIGhlcmUgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtXZWJHTDJSZW5kZXJpbmdDb250ZXh0fVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnbDtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIFdlYkdMIGNvbnRleHQgb2YgdGhpcyBkZXZpY2UgaXMgdXNpbmcgdGhlIFdlYkdMIDIuMCBBUEkuIElmIGZhbHNlLCBXZWJHTCAxLjAgaXNcbiAgICAgKiBiZWluZyB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHdlYmdsMjtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgV2ViZ2xHcmFwaGljc0RldmljZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR9IGNhbnZhcyAtIFRoZSBjYW52YXMgdG8gd2hpY2ggdGhlIGdyYXBoaWNzIGRldmljZSB3aWxsIHJlbmRlci5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9ucyBwYXNzZWQgd2hlbiBjcmVhdGluZyB0aGUgV2ViR0wgY29udGV4dC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFscGhhPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyBpZiB0aGUgY2FudmFzIGNvbnRhaW5zIGFuXG4gICAgICogYWxwaGEgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGVwdGg9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhlIGRyYXdpbmcgYnVmZmVyIGlzXG4gICAgICogcmVxdWVzdGVkIHRvIGhhdmUgYSBkZXB0aCBidWZmZXIgb2YgYXQgbGVhc3QgMTYgYml0cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnN0ZW5jaWw9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoYXQgdGhlIGRyYXdpbmcgYnVmZmVyIGlzXG4gICAgICogcmVxdWVzdGVkIHRvIGhhdmUgYSBzdGVuY2lsIGJ1ZmZlciBvZiBhdCBsZWFzdCA4IGJpdHMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbnRpYWxpYXM9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIHdoZXRoZXIgb3Igbm90IHRvIHBlcmZvcm1cbiAgICAgKiBhbnRpLWFsaWFzaW5nIGlmIHBvc3NpYmxlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlbXVsdGlwbGllZEFscGhhPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBwYWdlXG4gICAgICogY29tcG9zaXRvciB3aWxsIGFzc3VtZSB0aGUgZHJhd2luZyBidWZmZXIgY29udGFpbnMgY29sb3JzIHdpdGggcHJlLW11bHRpcGxpZWQgYWxwaGEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcmVzZXJ2ZURyYXdpbmdCdWZmZXI9ZmFsc2VdIC0gSWYgdGhlIHZhbHVlIGlzIHRydWUgdGhlIGJ1ZmZlcnNcbiAgICAgKiB3aWxsIG5vdCBiZSBjbGVhcmVkIGFuZCB3aWxsIHByZXNlcnZlIHRoZWlyIHZhbHVlcyB1bnRpbCBjbGVhcmVkIG9yIG92ZXJ3cml0dGVuIGJ5IHRoZVxuICAgICAqIGF1dGhvci5cbiAgICAgKiBAcGFyYW0geydkZWZhdWx0J3wnaGlnaC1wZXJmb3JtYW5jZSd8J2xvdy1wb3dlcid9IFtvcHRpb25zLnBvd2VyUHJlZmVyZW5jZT0nZGVmYXVsdCddIC0gQVxuICAgICAqIGhpbnQgdG8gdGhlIHVzZXIgYWdlbnQgaW5kaWNhdGluZyB3aGF0IGNvbmZpZ3VyYXRpb24gb2YgR1BVIGlzIHN1aXRhYmxlIGZvciB0aGUgV2ViR0xcbiAgICAgKiBjb250ZXh0LiBQb3NzaWJsZSB2YWx1ZXMgYXJlOlxuICAgICAqXG4gICAgICogLSAnZGVmYXVsdCc6IExldCB0aGUgdXNlciBhZ2VudCBkZWNpZGUgd2hpY2ggR1BVIGNvbmZpZ3VyYXRpb24gaXMgbW9zdCBzdWl0YWJsZS4gVGhpcyBpcyB0aGVcbiAgICAgKiBkZWZhdWx0IHZhbHVlLlxuICAgICAqIC0gJ2hpZ2gtcGVyZm9ybWFuY2UnOiBQcmlvcml0aXplcyByZW5kZXJpbmcgcGVyZm9ybWFuY2Ugb3ZlciBwb3dlciBjb25zdW1wdGlvbi5cbiAgICAgKiAtICdsb3ctcG93ZXInOiBQcmlvcml0aXplcyBwb3dlciBzYXZpbmcgb3ZlciByZW5kZXJpbmcgcGVyZm9ybWFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZhaWxJZk1ham9yUGVyZm9ybWFuY2VDYXZlYXQ9ZmFsc2VdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyBpZiBhXG4gICAgICogY29udGV4dCB3aWxsIGJlIGNyZWF0ZWQgaWYgdGhlIHN5c3RlbSBwZXJmb3JtYW5jZSBpcyBsb3cgb3IgaWYgbm8gaGFyZHdhcmUgR1BVIGlzIGF2YWlsYWJsZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZWZlcldlYkdsMj10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgaWYgYSBXZWJHbDIgY29udGV4dFxuICAgICAqIHNob3VsZCBiZSBwcmVmZXJyZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5kZXN5bmNocm9uaXplZD1mYWxzZV0gLSBCb29sZWFuIHRoYXQgaGludHMgdGhlIHVzZXIgYWdlbnQgdG9cbiAgICAgKiByZWR1Y2UgdGhlIGxhdGVuY3kgYnkgZGVzeW5jaHJvbml6aW5nIHRoZSBjYW52YXMgcGFpbnQgY3ljbGUgZnJvbSB0aGUgZXZlbnQgbG9vcC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnhyQ29tcGF0aWJsZV0gLSBCb29sZWFuIHRoYXQgaGludHMgdG8gdGhlIHVzZXIgYWdlbnQgdG8gdXNlIGFcbiAgICAgKiBjb21wYXRpYmxlIGdyYXBoaWNzIGFkYXB0ZXIgZm9yIGFuIGltbWVyc2l2ZSBYUiBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtXZWJHTFJlbmRlcmluZ0NvbnRleHQgfCBXZWJHTDJSZW5kZXJpbmdDb250ZXh0fSBbb3B0aW9ucy5nbF0gLSBUaGUgcmVuZGVyaW5nIGNvbnRleHRcbiAgICAgKiB0byB1c2UuIElmIG5vdCBzcGVjaWZpZWQsIGEgbmV3IGNvbnRleHQgd2lsbCBiZSBjcmVhdGVkLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNhbnZhcywgb3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIHN1cGVyKGNhbnZhcywgb3B0aW9ucyk7XG4gICAgICAgIG9wdGlvbnMgPSB0aGlzLmluaXRPcHRpb25zO1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdEZyYW1lYnVmZmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnVwZGF0ZUNsaWVudFJlY3QoKTtcblxuICAgICAgICAvLyBBZGQgaGFuZGxlcnMgZm9yIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgaXMgbG9zdCBvciByZXN0b3JlZFxuICAgICAgICB0aGlzLmNvbnRleHRMb3N0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0TG9zdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmxvc2VDb250ZXh0KCk7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coJ3BjLkdyYXBoaWNzRGV2aWNlOiBXZWJHTCBjb250ZXh0IGxvc3QuJyk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2RldmljZWxvc3QnKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgICAgICAgRGVidWcubG9nKCdwYy5HcmFwaGljc0RldmljZTogV2ViR0wgY29udGV4dCByZXN0b3JlZC4nKTtcbiAgICAgICAgICAgIHRoaXMucmVzdG9yZUNvbnRleHQoKTtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dExvc3QgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZGV2aWNlcmVzdG9yZWQnKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyAjNDEzNiAtIHR1cm4gb2ZmIGFudGlhbGlhc2luZyBvbiBBcHBsZVdlYktpdCBicm93c2VycyAxNS40XG4gICAgICAgIGNvbnN0IHVhID0gKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnKSAmJiBuYXZpZ2F0b3IudXNlckFnZW50O1xuICAgICAgICB0aGlzLmZvcmNlRGlzYWJsZU11bHRpc2FtcGxpbmcgPSB1YSAmJiB1YS5pbmNsdWRlcygnQXBwbGVXZWJLaXQnKSAmJiAodWEuaW5jbHVkZXMoJzE1LjQnKSB8fCB1YS5pbmNsdWRlcygnMTVfNCcpKTtcbiAgICAgICAgaWYgKHRoaXMuZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZykge1xuICAgICAgICAgICAgb3B0aW9ucy5hbnRpYWxpYXMgPSBmYWxzZTtcbiAgICAgICAgICAgIERlYnVnLmxvZyhcIkFudGlhbGlhc2luZyBoYXMgYmVlbiB0dXJuZWQgb2ZmIGR1ZSB0byByZW5kZXJpbmcgaXNzdWVzIG9uIEFwcGxlV2ViS2l0IDE1LjRcIik7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZ2wgPSBudWxsO1xuXG4gICAgICAgIC8vIFJldHJpZXZlIHRoZSBXZWJHTCBjb250ZXh0XG4gICAgICAgIGlmIChvcHRpb25zLmdsKSB7XG4gICAgICAgICAgICBnbCA9IG9wdGlvbnMuZ2w7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBwcmVmZXJXZWJHbDIgPSAob3B0aW9ucy5wcmVmZXJXZWJHbDIgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLnByZWZlcldlYkdsMiA6IHRydWU7XG4gICAgICAgICAgICBjb25zdCBuYW1lcyA9IHByZWZlcldlYkdsMiA/IFtcIndlYmdsMlwiLCBcIndlYmdsXCIsIFwiZXhwZXJpbWVudGFsLXdlYmdsXCJdIDogW1wid2ViZ2xcIiwgXCJleHBlcmltZW50YWwtd2ViZ2xcIl07XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5hbWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgZ2wgPSBjYW52YXMuZ2V0Q29udGV4dChuYW1lc1tpXSwgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgaWYgKGdsKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZ2wpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIldlYkdMIG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmdsID0gZ2w7XG4gICAgICAgIHRoaXMud2ViZ2wyID0gdHlwZW9mIFdlYkdMMlJlbmRlcmluZ0NvbnRleHQgIT09ICd1bmRlZmluZWQnICYmIGdsIGluc3RhbmNlb2YgV2ViR0wyUmVuZGVyaW5nQ29udGV4dDtcbiAgICAgICAgdGhpcy5fZGV2aWNlVHlwZSA9IHRoaXMud2ViZ2wyID8gREVWSUNFVFlQRV9XRUJHTDIgOiBERVZJQ0VUWVBFX1dFQkdMMTtcblxuICAgICAgICAvLyBwaXhlbCBmb3JtYXQgb2YgdGhlIGZyYW1lYnVmZmVyXG4gICAgICAgIGNvbnN0IGFscGhhQml0cyA9IGdsLmdldFBhcmFtZXRlcihnbC5BTFBIQV9CSVRTKTtcbiAgICAgICAgdGhpcy5mcmFtZWJ1ZmZlckZvcm1hdCA9IGFscGhhQml0cyA/IFBJWEVMRk9STUFUX1JHQkE4IDogUElYRUxGT1JNQVRfUkdCODtcblxuICAgICAgICBjb25zdCBpc0Nocm9tZSA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgISF3aW5kb3cuY2hyb21lO1xuICAgICAgICBjb25zdCBpc1NhZmFyaSA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgISF3aW5kb3cuc2FmYXJpO1xuICAgICAgICBjb25zdCBpc01hYyA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIk1hY1wiKSAhPT0gLTE7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB0ZXh0dXJlIHVuaXQgd29ya2Fyb3VuZCBvbiBkZXNrdG9wIHNhZmFyaVxuICAgICAgICB0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kID0gaXNTYWZhcmk7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciBnbEJsaXRGcmFtZWJ1ZmZlciBmYWlsaW5nIG9uIE1hYyBDaHJvbWUgKCMyNTA0KVxuICAgICAgICB0aGlzLl90ZW1wTWFjQ2hyb21lQmxpdEZyYW1lYnVmZmVyV29ya2Fyb3VuZCA9IGlzTWFjICYmIGlzQ2hyb21lICYmICFvcHRpb25zLmFscGhhO1xuXG4gICAgICAgIC8vIGluaXQgcG9seWZpbGwgZm9yIFZBT3MgdW5kZXIgd2ViZ2wxXG4gICAgICAgIGlmICghdGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHNldHVwVmVydGV4QXJyYXlPYmplY3QoZ2wpO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRsb3N0XCIsIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciwgZmFsc2UpO1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dHJlc3RvcmVkXCIsIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVFeHRlbnNpb25zKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNhcGFiaWxpdGllcygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVSZW5kZXJTdGF0ZSgpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gb25seSBlbmFibGUgSW1hZ2VCaXRtYXAgb24gY2hyb21lXG4gICAgICAgIHRoaXMuc3VwcG9ydHNJbWFnZUJpdG1hcCA9ICFpc1NhZmFyaSAmJiB0eXBlb2YgSW1hZ2VCaXRtYXAgIT09ICd1bmRlZmluZWQnO1xuXG4gICAgICAgIHRoaXMuZ2xBZGRyZXNzID0gW1xuICAgICAgICAgICAgZ2wuUkVQRUFULFxuICAgICAgICAgICAgZ2wuQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIGdsLk1JUlJPUkVEX1JFUEVBVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xCbGVuZEVxdWF0aW9uID0gW1xuICAgICAgICAgICAgZ2wuRlVOQ19BREQsXG4gICAgICAgICAgICBnbC5GVU5DX1NVQlRSQUNULFxuICAgICAgICAgICAgZ2wuRlVOQ19SRVZFUlNFX1NVQlRSQUNULFxuICAgICAgICAgICAgdGhpcy53ZWJnbDIgPyBnbC5NSU4gOiB0aGlzLmV4dEJsZW5kTWlubWF4ID8gdGhpcy5leHRCbGVuZE1pbm1heC5NSU5fRVhUIDogZ2wuRlVOQ19BREQsXG4gICAgICAgICAgICB0aGlzLndlYmdsMiA/IGdsLk1BWCA6IHRoaXMuZXh0QmxlbmRNaW5tYXggPyB0aGlzLmV4dEJsZW5kTWlubWF4Lk1BWF9FWFQgOiBnbC5GVU5DX0FERFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uQ29sb3IgPSBbXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuT05FLFxuICAgICAgICAgICAgZ2wuU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICAgICAgICAgIGdsLkRTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19EU1RfQ09MT1IsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEFfU0FUVVJBVEUsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBLFxuICAgICAgICAgICAgZ2wuRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICAgICAgICAgIGdsLkNPTlNUQU5UX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb25BbHBoYSA9IFtcbiAgICAgICAgICAgIGdsLlpFUk8sXG4gICAgICAgICAgICBnbC5PTkUsXG4gICAgICAgICAgICBnbC5TUkNfQ09MT1IsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuRFNUX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLlNSQ19BTFBIQSxcbiAgICAgICAgICAgIGdsLlNSQ19BTFBIQV9TQVRVUkFURSxcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5EU1RfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuQ09OU1RBTlRfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEFcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQ29tcGFyaXNvbiA9IFtcbiAgICAgICAgICAgIGdsLk5FVkVSLFxuICAgICAgICAgICAgZ2wuTEVTUyxcbiAgICAgICAgICAgIGdsLkVRVUFMLFxuICAgICAgICAgICAgZ2wuTEVRVUFMLFxuICAgICAgICAgICAgZ2wuR1JFQVRFUixcbiAgICAgICAgICAgIGdsLk5PVEVRVUFMLFxuICAgICAgICAgICAgZ2wuR0VRVUFMLFxuICAgICAgICAgICAgZ2wuQUxXQVlTXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbFN0ZW5jaWxPcCA9IFtcbiAgICAgICAgICAgIGdsLktFRVAsXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuUkVQTEFDRSxcbiAgICAgICAgICAgIGdsLklOQ1IsXG4gICAgICAgICAgICBnbC5JTkNSX1dSQVAsXG4gICAgICAgICAgICBnbC5ERUNSLFxuICAgICAgICAgICAgZ2wuREVDUl9XUkFQLFxuICAgICAgICAgICAgZ2wuSU5WRVJUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbENsZWFyRmxhZyA9IFtcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBnbC5DT0xPUl9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuREVQVEhfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklUIHwgZ2wuQ09MT1JfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLlNURU5DSUxfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5TVEVOQ0lMX0JVRkZFUl9CSVQgfCBnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xDdWxsID0gW1xuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIGdsLkJBQ0ssXG4gICAgICAgICAgICBnbC5GUk9OVCxcbiAgICAgICAgICAgIGdsLkZST05UX0FORF9CQUNLXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEZpbHRlciA9IFtcbiAgICAgICAgICAgIGdsLk5FQVJFU1QsXG4gICAgICAgICAgICBnbC5MSU5FQVIsXG4gICAgICAgICAgICBnbC5ORUFSRVNUX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9MSU5FQVJcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsUHJpbWl0aXZlID0gW1xuICAgICAgICAgICAgZ2wuUE9JTlRTLFxuICAgICAgICAgICAgZ2wuTElORVMsXG4gICAgICAgICAgICBnbC5MSU5FX0xPT1AsXG4gICAgICAgICAgICBnbC5MSU5FX1NUUklQLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVTLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVfU1RSSVAsXG4gICAgICAgICAgICBnbC5UUklBTkdMRV9GQU5cbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsVHlwZSA9IFtcbiAgICAgICAgICAgIGdsLkJZVEUsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9CWVRFLFxuICAgICAgICAgICAgZ2wuU0hPUlQsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9TSE9SVCxcbiAgICAgICAgICAgIGdsLklOVCxcbiAgICAgICAgICAgIGdsLlVOU0lHTkVEX0lOVCxcbiAgICAgICAgICAgIGdsLkZMT0FUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlID0ge307XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MXSAgICAgICAgID0gVU5JRk9STVRZUEVfQk9PTDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9JTlQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF0gICAgICAgID0gVU5JRk9STVRZUEVfRkxPQVQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9WRUMyXSAgID0gVU5JRk9STVRZUEVfVkVDMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX1ZFQzNdICAgPSBVTklGT1JNVFlQRV9WRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfVkVDNF0gICA9IFVOSUZPUk1UWVBFX1ZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDMl0gICAgID0gVU5JRk9STVRZUEVfSVZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDM10gICAgID0gVU5JRk9STVRZUEVfSVZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDNF0gICAgID0gVU5JRk9STVRZUEVfSVZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzJdICAgID0gVU5JRk9STVRZUEVfQlZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzNdICAgID0gVU5JRk9STVRZUEVfQlZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzRdICAgID0gVU5JRk9STVRZUEVfQlZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9NQVQyXSAgID0gVU5JRk9STVRZUEVfTUFUMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX01BVDNdICAgPSBVTklGT1JNVFlQRV9NQVQzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfTUFUNF0gICA9IFVOSUZPUk1UWVBFX01BVDQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEXSAgID0gVU5JRk9STVRZUEVfVEVYVFVSRTJEO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFXSA9IFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEX1NIQURPV10gICA9IFVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFX1NIQURPV10gPSBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8zRF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9URVhUVVJFM0Q7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdCA9IHt9O1xuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdFtnbC5URVhUVVJFXzJEXSA9IDA7XG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90W2dsLlRFWFRVUkVfQ1VCRV9NQVBdID0gMTtcbiAgICAgICAgdGhpcy50YXJnZXRUb1Nsb3RbZ2wuVEVYVFVSRV8zRF0gPSAyO1xuXG4gICAgICAgIC8vIERlZmluZSB0aGUgdW5pZm9ybSBjb21taXQgZnVuY3Rpb25zXG4gICAgICAgIGxldCBzY29wZVgsIHNjb3BlWSwgc2NvcGVaLCBzY29wZVc7XG4gICAgICAgIGxldCB1bmlmb3JtVmFsdWU7XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb24gPSBbXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0udmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFpKHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JTlRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9GTE9BVF0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtLnZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xZih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLnZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2Z2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzJdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yaXYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CVkVDMl0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMyXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDM10gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2l2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUMzXSA9IHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzNdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUM0XSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQlZFQzRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDNF07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfTUFUMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtTWF0cml4MmZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9NQVQzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm1NYXRyaXgzZnYodW5pZm9ybS5sb2NhdGlvbklkLCBmYWxzZSwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX01BVDRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIGZhbHNlLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfRkxPQVRBUlJBWV0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0xZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMkFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDM0FSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0zZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDNEFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm00ZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0JvbmVUZXh0dXJlcyA9IHRoaXMuZXh0VGV4dHVyZUZsb2F0ICYmIHRoaXMubWF4VmVydGV4VGV4dHVyZXMgPiAwO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBhbiBlc3RpbWF0ZSBvZiB0aGUgbWF4aW11bSBudW1iZXIgb2YgYm9uZXMgdGhhdCBjYW4gYmUgdXBsb2FkZWQgdG8gdGhlIEdQVVxuICAgICAgICAvLyBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGF2YWlsYWJsZSB1bmlmb3JtcyBhbmQgdGhlIG51bWJlciBvZiB1bmlmb3JtcyByZXF1aXJlZCBmb3Igbm9uLVxuICAgICAgICAvLyBib25lIGRhdGEuICBUaGlzIGlzIGJhc2VkIG9mZiBvZiB0aGUgU3RhbmRhcmQgc2hhZGVyLiAgQSB1c2VyIGRlZmluZWQgc2hhZGVyIG1heSBoYXZlXG4gICAgICAgIC8vIGV2ZW4gbGVzcyBzcGFjZSBhdmFpbGFibGUgZm9yIGJvbmVzIHNvIHRoaXMgY2FsY3VsYXRlZCB2YWx1ZSBjYW4gYmUgb3ZlcnJpZGRlbiB2aWFcbiAgICAgICAgLy8gcGMuR3JhcGhpY3NEZXZpY2Uuc2V0Qm9uZUxpbWl0LlxuICAgICAgICBsZXQgbnVtVW5pZm9ybXMgPSB0aGlzLnZlcnRleFVuaWZvcm1zQ291bnQ7XG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBNb2RlbCwgdmlldywgcHJvamVjdGlvbiBhbmQgc2hhZG93IG1hdHJpY2VzXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDg7ICAgICAvLyA4IGxpZ2h0cyBtYXgsIGVhY2ggc3BlY2lmeWluZyBhIHBvc2l0aW9uIHZlY3RvclxuICAgICAgICBudW1Vbmlmb3JtcyAtPSAxOyAgICAgLy8gRXllIHBvc2l0aW9uXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBVcCB0byA0IHRleHR1cmUgdHJhbnNmb3Jtc1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGguZmxvb3IobnVtVW5pZm9ybXMgLyAzKTsgICAvLyBlYWNoIGJvbmUgdXNlcyAzIHVuaWZvcm1zXG5cbiAgICAgICAgLy8gUHV0IGEgbGltaXQgb24gdGhlIG51bWJlciBvZiBzdXBwb3J0ZWQgYm9uZXMgYmVmb3JlIHNraW4gcGFydGl0aW9uaW5nIG11c3QgYmUgcGVyZm9ybWVkXG4gICAgICAgIC8vIFNvbWUgR1BVcyBoYXZlIGRlbW9uc3RyYXRlZCBwZXJmb3JtYW5jZSBpc3N1ZXMgaWYgdGhlIG51bWJlciBvZiB2ZWN0b3JzIGFsbG9jYXRlZCB0byB0aGVcbiAgICAgICAgLy8gc2tpbiBtYXRyaXggcGFsZXR0ZSBpcyBsZWZ0IHVuYm91bmRlZFxuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGgubWluKHRoaXMuYm9uZUxpbWl0LCAxMjgpO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza2VkUmVuZGVyZXIgPT09ICdNYWxpLTQ1MCBNUCcpIHtcbiAgICAgICAgICAgIHRoaXMuYm9uZUxpbWl0ID0gMzQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnN0YW50VGV4U291cmNlID0gdGhpcy5zY29wZS5yZXNvbHZlKFwic291cmNlXCIpO1xuXG4gICAgICAgIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wyIGZsb2F0IHRleHR1cmUgcmVuZGVyYWJpbGl0eSBpcyBkaWN0YXRlZCBieSB0aGUgRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBleHRlbnNpb25cbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSAhIXRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wxIHdlIHNob3VsZCBqdXN0IHRyeSByZW5kZXJpbmcgaW50byBhIGZsb2F0IHRleHR1cmVcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSB0ZXN0UmVuZGVyYWJsZShnbCwgZ2wuRkxPQVQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0d28gZXh0ZW5zaW9ucyBhbGxvdyB1cyB0byByZW5kZXIgdG8gaGFsZiBmbG9hdCBidWZmZXJzXG4gICAgICAgIGlmICh0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0KSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gISF0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0O1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBzaG91bGQgYWZmZWN0IGJvdGggZmxvYXQgYW5kIGhhbGZmbG9hdCBmb3JtYXRzXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9ICEhdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBNYW51YWwgcmVuZGVyIGNoZWNrIGZvciBoYWxmIGZsb2F0XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IHRlc3RSZW5kZXJhYmxlKGdsLCB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlID0gKHRoaXMubWF4UHJlY2lzaW9uID09PSBcImhpZ2hwXCIgJiYgdGhpcy5tYXhWZXJ0ZXhUZXh0dXJlcyA+PSAyKTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0RlcHRoU2hhZG93ID0gdGhpcy53ZWJnbDI7XG5cbiAgICAgICAgdGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBhcmVhIGxpZ2h0IExVVCBmb3JtYXQgLSBvcmRlciBvZiBwcmVmZXJlbmNlOiBoYWxmLCBmbG9hdCwgOGJpdFxuICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkE4O1xuICAgICAgICBpZiAodGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0ICYmIHRoaXMudGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSAmJiB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIpIHtcbiAgICAgICAgICAgIHRoaXMuYXJlYUxpZ2h0THV0Rm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCAmJiB0aGlzLmV4dFRleHR1cmVGbG9hdExpbmVhcikge1xuICAgICAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBMzJGO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wb3N0SW5pdCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGhpcy5mZWVkYmFjaykge1xuICAgICAgICAgICAgZ2wuZGVsZXRlVHJhbnNmb3JtRmVlZGJhY2sodGhpcy5mZWVkYmFjayk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSgpO1xuXG4gICAgICAgIHRoaXMuY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmdsY29udGV4dGxvc3QnLCB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0cmVzdG9yZWQnLCB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5nbCA9IG51bGw7XG5cbiAgICAgICAgc3VwZXIucG9zdERlc3Ryb3koKTtcbiAgICB9XG5cbiAgICAvLyBwcm92aWRlIHdlYmdsIGltcGxlbWVudGF0aW9uIGZvciB0aGUgdmVydGV4IGJ1ZmZlclxuICAgIGNyZWF0ZVZlcnRleEJ1ZmZlckltcGwodmVydGV4QnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbFZlcnRleEJ1ZmZlcigpO1xuICAgIH1cblxuICAgIC8vIHByb3ZpZGUgd2ViZ2wgaW1wbGVtZW50YXRpb24gZm9yIHRoZSBpbmRleCBidWZmZXJcbiAgICBjcmVhdGVJbmRleEJ1ZmZlckltcGwoaW5kZXhCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbEluZGV4QnVmZmVyKGluZGV4QnVmZmVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVTaGFkZXJJbXBsKHNoYWRlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsU2hhZGVyKHNoYWRlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZUltcGwodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsVGV4dHVyZSgpO1xuICAgIH1cblxuICAgIGNyZWF0ZVJlbmRlclRhcmdldEltcGwocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xSZW5kZXJUYXJnZXQoKTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgcHVzaE1hcmtlcihuYW1lKSB7XG4gICAgICAgIGlmICh3aW5kb3cuc3BlY3Rvcikge1xuICAgICAgICAgICAgY29uc3QgbGFiZWwgPSBEZWJ1Z0dyYXBoaWNzLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB3aW5kb3cuc3BlY3Rvci5zZXRNYXJrZXIoYCR7bGFiZWx9ICNgKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBvcE1hcmtlcigpIHtcbiAgICAgICAgaWYgKHdpbmRvdy5zcGVjdG9yKSB7XG4gICAgICAgICAgICBjb25zdCBsYWJlbCA9IERlYnVnR3JhcGhpY3MudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIGlmIChsYWJlbC5sZW5ndGgpXG4gICAgICAgICAgICAgICAgd2luZG93LnNwZWN0b3Iuc2V0TWFya2VyKGAke2xhYmVsfSAjYCk7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgd2luZG93LnNwZWN0b3IuY2xlYXJNYXJrZXIoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyAjZW5kaWZcblxuICAgIC8qKlxuICAgICAqIFF1ZXJ5IHRoZSBwcmVjaXNpb24gc3VwcG9ydGVkIGJ5IGludHMgYW5kIGZsb2F0cyBpbiB2ZXJ0ZXggYW5kIGZyYWdtZW50IHNoYWRlcnMuIE5vdGUgdGhhdFxuICAgICAqIGdldFNoYWRlclByZWNpc2lvbkZvcm1hdCBpcyBub3QgZ3VhcmFudGVlZCB0byBiZSBwcmVzZW50IChzdWNoIGFzIHNvbWUgaW5zdGFuY2VzIG9mIHRoZVxuICAgICAqIGRlZmF1bHQgQW5kcm9pZCBicm93c2VyKS4gSW4gdGhpcyBjYXNlLCBhc3N1bWUgaGlnaHAgaXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gXCJoaWdocFwiLCBcIm1lZGl1bXBcIiBvciBcImxvd3BcIlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRQcmVjaXNpb24oKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgbGV0IHByZWNpc2lvbiA9IFwiaGlnaHBcIjtcblxuICAgICAgICBpZiAoZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KSB7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLlZFUlRFWF9TSEFERVIsIGdsLkhJR0hfRkxPQVQpO1xuICAgICAgICAgICAgY29uc3QgdmVydGV4U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLlZFUlRFWF9TSEFERVIsIGdsLk1FRElVTV9GTE9BVCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5GUkFHTUVOVF9TSEFERVIsIGdsLkhJR0hfRkxPQVQpO1xuICAgICAgICAgICAgY29uc3QgZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuRlJBR01FTlRfU0hBREVSLCBnbC5NRURJVU1fRkxPQVQpO1xuXG4gICAgICAgICAgICBjb25zdCBoaWdocEF2YWlsYWJsZSA9IHZlcnRleFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQucHJlY2lzaW9uID4gMCAmJiBmcmFnbWVudFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQucHJlY2lzaW9uID4gMDtcbiAgICAgICAgICAgIGNvbnN0IG1lZGl1bXBBdmFpbGFibGUgPSB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQucHJlY2lzaW9uID4gMCAmJiBmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdC5wcmVjaXNpb24gPiAwO1xuXG4gICAgICAgICAgICBpZiAoIWhpZ2hwQXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1lZGl1bXBBdmFpbGFibGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gXCJtZWRpdW1wXCI7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJXQVJOSU5HOiBoaWdocCBub3Qgc3VwcG9ydGVkLCB1c2luZyBtZWRpdW1wXCIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByZWNpc2lvbiA9IFwibG93cFwiO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKFwiV0FSTklORzogaGlnaHAgYW5kIG1lZGl1bXAgbm90IHN1cHBvcnRlZCwgdXNpbmcgbG93cFwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJlY2lzaW9uO1xuICAgIH1cblxuICAgIGdldEV4dGVuc2lvbigpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnN1cHBvcnRlZEV4dGVuc2lvbnMuaW5kZXhPZihhcmd1bWVudHNbaV0pICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdsLmdldEV4dGVuc2lvbihhcmd1bWVudHNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGdldCBleHREaXNqb2ludFRpbWVyUXVlcnkoKSB7XG4gICAgICAgIC8vIGxhenkgZXZhbHVhdGlvbiBhcyB0aGlzIGlzIG5vdCB0eXBpY2FsbHkgdXNlZFxuICAgICAgICBpZiAoIXRoaXMuX2V4dERpc2pvaW50VGltZXJRdWVyeSkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gTm90ZSB0aGF0IEZpcmVmb3ggZXhwb3NlcyBFWFRfZGlzam9pbnRfdGltZXJfcXVlcnkgdW5kZXIgV2ViR0wyIHJhdGhlciB0aGFuIEVYVF9kaXNqb2ludF90aW1lcl9xdWVyeV93ZWJnbDJcbiAgICAgICAgICAgICAgICB0aGlzLl9leHREaXNqb2ludFRpbWVyUXVlcnkgPSB0aGlzLmdldEV4dGVuc2lvbignRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5X3dlYmdsMicsICdFWFRfZGlzam9pbnRfdGltZXJfcXVlcnknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fZXh0RGlzam9pbnRUaW1lclF1ZXJ5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgdGhlIGV4dGVuc2lvbnMgcHJvdmlkZWQgYnkgdGhlIFdlYkdMIGNvbnRleHQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgY29uc3Qgc3VwcG9ydGVkRXh0ZW5zaW9ucyA9IGdsLmdldFN1cHBvcnRlZEV4dGVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5zdXBwb3J0ZWRFeHRlbnNpb25zID0gc3VwcG9ydGVkRXh0ZW5zaW9ucztcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMuZXh0QmxlbmRNaW5tYXggPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHREcmF3QnVmZmVycyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dEluc3RhbmNpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUZsb2F0ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRVaW50RWxlbWVudCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFZlcnRleEFycmF5T2JqZWN0ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdFWFRfY29sb3JfYnVmZmVyX2Zsb2F0Jyk7XG4gICAgICAgICAgICB0aGlzLmV4dERlcHRoVGV4dHVyZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdGhpcy5nZXRFeHRlbnNpb24oXCJFWFRfYmxlbmRfbWlubWF4XCIpO1xuICAgICAgICAgICAgdGhpcy5leHREcmF3QnVmZmVycyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdFWFRfZHJhd19idWZmZXJzJyk7XG4gICAgICAgICAgICB0aGlzLmV4dEluc3RhbmNpbmcgPSB0aGlzLmdldEV4dGVuc2lvbihcIkFOR0xFX2luc3RhbmNlZF9hcnJheXNcIik7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zdGFsbCB0aGUgV2ViR0wgMiBJbnN0YW5jaW5nIEFQSSBmb3IgV2ViR0wgMS4wXG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ID0gdGhpcy5leHRJbnN0YW5jaW5nO1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQgPSBleHQuZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQgPSBleHQuZHJhd0VsZW1lbnRzSW5zdGFuY2VkQU5HTEUuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLnZlcnRleEF0dHJpYkRpdmlzb3IgPSBleHQudmVydGV4QXR0cmliRGl2aXNvckFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzID0gdGhpcy5nZXRFeHRlbnNpb24oXCJPRVNfc3RhbmRhcmRfZGVyaXZhdGl2ZXNcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfZmxvYXRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0aGlzLmdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2hhbGZfZmxvYXRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSB0aGlzLmdldEV4dGVuc2lvbignRVhUX3NoYWRlcl90ZXh0dXJlX2xvZCcpO1xuICAgICAgICAgICAgdGhpcy5leHRVaW50RWxlbWVudCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX2VsZW1lbnRfaW5kZXhfdWludFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QgPSB0aGlzLmdldEV4dGVuc2lvbihcIk9FU192ZXJ0ZXhfYXJyYXlfb2JqZWN0XCIpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAvLyBJbnN0YWxsIHRoZSBXZWJHTCAyIFZBTyBBUEkgZm9yIFdlYkdMIDEuMFxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3Q7XG4gICAgICAgICAgICAgICAgZ2wuY3JlYXRlVmVydGV4QXJyYXkgPSBleHQuY3JlYXRlVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5ID0gZXh0LmRlbGV0ZVZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5pc1ZlcnRleEFycmF5ID0gZXh0LmlzVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSA9IGV4dC5iaW5kVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGVwdGhUZXh0dXJlID0gZ2wuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZXB0aF90ZXh0dXJlJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4dERlYnVnUmVuZGVyZXJJbmZvID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2RlYnVnX3JlbmRlcmVyX2luZm8nKTtcbiAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXRMaW5lYXIgPSB0aGlzLmdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2Zsb2F0X2xpbmVhclwiKTtcbiAgICAgICAgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyID0gdGhpcy5nZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9oYWxmX2Zsb2F0X2xpbmVhclwiKTtcbiAgICAgICAgdGhpcy5leHRGbG9hdEJsZW5kID0gdGhpcy5nZXRFeHRlbnNpb24oXCJFWFRfZmxvYXRfYmxlbmRcIik7XG4gICAgICAgIHRoaXMuZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljID0gdGhpcy5nZXRFeHRlbnNpb24oJ0VYVF90ZXh0dXJlX2ZpbHRlcl9hbmlzb3Ryb3BpYycsICdXRUJLSVRfRVhUX3RleHR1cmVfZmlsdGVyX2FuaXNvdHJvcGljJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMxJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX2V0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3B2cnRjJywgJ1dFQktJVF9XRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfcHZydGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZVMzVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3MzdGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9zM3RjJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX2F0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfYXN0YycpO1xuICAgICAgICB0aGlzLmV4dFBhcmFsbGVsU2hhZGVyQ29tcGlsZSA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdLSFJfcGFyYWxsZWxfc2hhZGVyX2NvbXBpbGUnKTtcblxuICAgICAgICAvLyBpT1MgZXhwb3NlcyB0aGlzIGZvciBoYWxmIHByZWNpc2lvbiByZW5kZXIgdGFyZ2V0cyBvbiBib3RoIFdlYmdsMSBhbmQgMiBmcm9tIGlPUyB2IDE0LjViZXRhXG4gICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQgPSB0aGlzLmdldEV4dGVuc2lvbihcIkVYVF9jb2xvcl9idWZmZXJfaGFsZl9mbG9hdFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyeSB0aGUgY2FwYWJpbGl0aWVzIG9mIHRoZSBXZWJHTCBjb250ZXh0LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGluaXRpYWxpemVDYXBhYmlsaXRpZXMoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgbGV0IGV4dDtcblxuICAgICAgICB0aGlzLm1heFByZWNpc2lvbiA9IHRoaXMucHJlY2lzaW9uID0gdGhpcy5nZXRQcmVjaXNpb24oKTtcblxuICAgICAgICBjb25zdCBjb250ZXh0QXR0cmlicyA9IGdsLmdldENvbnRleHRBdHRyaWJ1dGVzKCk7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNNc2FhID0gY29udGV4dEF0dHJpYnMuYW50aWFsaWFzO1xuICAgICAgICB0aGlzLnN1cHBvcnRzU3RlbmNpbCA9IGNvbnRleHRBdHRyaWJzLnN0ZW5jaWw7XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0luc3RhbmNpbmcgPSAhIXRoaXMuZXh0SW5zdGFuY2luZztcblxuICAgICAgICAvLyBRdWVyeSBwYXJhbWV0ZXIgdmFsdWVzIGZyb20gdGhlIFdlYkdMIGNvbnRleHRcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhDdWJlTWFwU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhSZW5kZXJCdWZmZXJTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9SRU5ERVJCVUZGRVJfU0laRSk7XG4gICAgICAgIHRoaXMubWF4VGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heENvbWJpbmVkVGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMpO1xuICAgICAgICB0aGlzLm1heFZlcnRleFRleHR1cmVzID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9WRVJURVhfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMudmVydGV4VW5pZm9ybXNDb3VudCA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyk7XG4gICAgICAgIHRoaXMuZnJhZ21lbnRVbmlmb3Jtc0NvdW50ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMpO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMubWF4RHJhd0J1ZmZlcnMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0RSQVdfQlVGRkVSUyk7XG4gICAgICAgICAgICB0aGlzLm1heENvbG9yQXR0YWNobWVudHMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0NPTE9SX0FUVEFDSE1FTlRTKTtcbiAgICAgICAgICAgIHRoaXMubWF4Vm9sdW1lU2l6ZSA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfM0RfVEVYVFVSRV9TSVpFKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4dCA9IHRoaXMuZXh0RHJhd0J1ZmZlcnM7XG4gICAgICAgICAgICB0aGlzLm1heERyYXdCdWZmZXJzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfRFJBV19CVUZGRVJTX0VYVCkgOiAxO1xuICAgICAgICAgICAgdGhpcy5tYXhDb2xvckF0dGFjaG1lbnRzID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfQ09MT1JfQVRUQUNITUVOVFNfRVhUKSA6IDE7XG4gICAgICAgICAgICB0aGlzLm1heFZvbHVtZVNpemUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHREZWJ1Z1JlbmRlcmVySW5mbztcbiAgICAgICAgdGhpcy51bm1hc2tlZFJlbmRlcmVyID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5VTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCkgOiAnJztcbiAgICAgICAgdGhpcy51bm1hc2tlZFZlbmRvciA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuVU5NQVNLRURfVkVORE9SX1dFQkdMKSA6ICcnO1xuXG4gICAgICAgIC8vIE1hbGktRzUyIGhhcyByZW5kZXJpbmcgaXNzdWVzIHdpdGggR1BVIHBhcnRpY2xlcyBpbmNsdWRpbmdcbiAgICAgICAgLy8gU00tQTIyNU0sIE0yMDAzSjE1U0MgYW5kIEtGUkFXSSAoQW1hem9uIEZpcmUgSEQgOCAyMDIyKVxuICAgICAgICBjb25zdCBtYWxpUmVuZGVyZXJSZWdleCA9IC9cXGJNYWxpLUc1MisvO1xuICAgICAgICB0aGlzLnN1cHBvcnRzR3B1UGFydGljbGVzID0gISh0aGlzLnVubWFza2VkUmVuZGVyZXIubWF0Y2gobWFsaVJlbmRlcmVyUmVnZXgpKTtcblxuICAgICAgICBleHQgPSB0aGlzLmV4dFRleHR1cmVGaWx0ZXJBbmlzb3Ryb3BpYztcbiAgICAgICAgdGhpcy5tYXhBbmlzb3Ryb3B5ID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5NQVhfVEVYVFVSRV9NQVhfQU5JU09UUk9QWV9FWFQpIDogMTtcblxuICAgICAgICB0aGlzLnNhbXBsZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuU0FNUExFUyk7XG4gICAgICAgIHRoaXMubWF4U2FtcGxlcyA9IHRoaXMud2ViZ2wyICYmICF0aGlzLmZvcmNlRGlzYWJsZU11bHRpc2FtcGxpbmcgPyBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1NBTVBMRVMpIDogMTtcblxuICAgICAgICAvLyBEb24ndCBhbGxvdyBhcmVhIGxpZ2h0cyBvbiBvbGQgYW5kcm9pZCBkZXZpY2VzLCB0aGV5IG9mdGVuIGZhaWwgdG8gY29tcGlsZSB0aGUgc2hhZGVyLCBydW4gaXQgaW5jb3JyZWN0bHkgb3IgYXJlIHZlcnkgc2xvdy5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0FyZWFMaWdodHMgPSB0aGlzLndlYmdsMiB8fCAhcGxhdGZvcm0uYW5kcm9pZDtcblxuICAgICAgICAvLyBzdXBwb3J0cyB0ZXh0dXJlIGZldGNoIGluc3RydWN0aW9uXG4gICAgICAgIHRoaXMuc3VwcG9ydHNUZXh0dXJlRmV0Y2ggPSB0aGlzLndlYmdsMjtcblxuICAgICAgICAvLyBBbHNvIGRvIG5vdCBhbGxvdyB0aGVtIHdoZW4gd2Ugb25seSBoYXZlIHNtYWxsIG51bWJlciBvZiB0ZXh0dXJlIHVuaXRzXG4gICAgICAgIGlmICh0aGlzLm1heFRleHR1cmVzIDw9IDgpIHtcbiAgICAgICAgICAgIHRoaXMuc3VwcG9ydHNBcmVhTGlnaHRzID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGluaXRpYWwgcmVuZGVyIHN0YXRlIG9uIHRoZSBXZWJHTCBjb250ZXh0LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGluaXRpYWxpemVSZW5kZXJTdGF0ZSgpIHtcbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCk7XG5cbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgcmVuZGVyIHN0YXRlIHRvIGEga25vd24gc3RhcnQgc3RhdGVcblxuICAgICAgICAvLyBkZWZhdWx0IGJsZW5kIHN0YXRlXG4gICAgICAgIGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuICAgICAgICBnbC5ibGVuZEZ1bmMoZ2wuT05FLCBnbC5aRVJPKTtcbiAgICAgICAgZ2wuYmxlbmRFcXVhdGlvbihnbC5GVU5DX0FERCk7XG4gICAgICAgIGdsLmNvbG9yTWFzayh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcblxuICAgICAgICB0aGlzLmJsZW5kQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMCk7XG4gICAgICAgIGdsLmJsZW5kQ29sb3IoMCwgMCwgMCwgMCk7XG5cbiAgICAgICAgZ2wuZW5hYmxlKGdsLkNVTExfRkFDRSk7XG4gICAgICAgIGdsLmN1bGxGYWNlKGdsLkJBQ0spO1xuXG4gICAgICAgIC8vIGRlZmF1bHQgZGVwdGggc3RhdGVcbiAgICAgICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuICAgICAgICBnbC5kZXB0aEZ1bmMoZ2wuTEVRVUFMKTtcbiAgICAgICAgZ2wuZGVwdGhNYXNrKHRydWUpO1xuXG4gICAgICAgIHRoaXMuc3RlbmNpbCA9IGZhbHNlO1xuICAgICAgICBnbC5kaXNhYmxlKGdsLlNURU5DSUxfVEVTVCk7XG5cbiAgICAgICAgdGhpcy5zdGVuY2lsRnVuY0Zyb250ID0gdGhpcy5zdGVuY2lsRnVuY0JhY2sgPSBGVU5DX0FMV0FZUztcbiAgICAgICAgdGhpcy5zdGVuY2lsUmVmRnJvbnQgPSB0aGlzLnN0ZW5jaWxSZWZCYWNrID0gMDtcbiAgICAgICAgdGhpcy5zdGVuY2lsTWFza0Zyb250ID0gdGhpcy5zdGVuY2lsTWFza0JhY2sgPSAweEZGO1xuICAgICAgICBnbC5zdGVuY2lsRnVuYyhnbC5BTFdBWVMsIDAsIDB4RkYpO1xuXG4gICAgICAgIHRoaXMuc3RlbmNpbEZhaWxGcm9udCA9IHRoaXMuc3RlbmNpbEZhaWxCYWNrID0gU1RFTkNJTE9QX0tFRVA7XG4gICAgICAgIHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgPSBTVEVOQ0lMT1BfS0VFUDtcbiAgICAgICAgdGhpcy5zdGVuY2lsWnBhc3NGcm9udCA9IHRoaXMuc3RlbmNpbFpwYXNzQmFjayA9IFNURU5DSUxPUF9LRUVQO1xuICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IDB4RkY7XG4gICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgPSAweEZGO1xuICAgICAgICBnbC5zdGVuY2lsT3AoZ2wuS0VFUCwgZ2wuS0VFUCwgZ2wuS0VFUCk7XG4gICAgICAgIGdsLnN0ZW5jaWxNYXNrKDB4RkYpO1xuXG4gICAgICAgIHRoaXMuYWxwaGFUb0NvdmVyYWdlID0gZmFsc2U7XG4gICAgICAgIHRoaXMucmFzdGVyID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICBnbC5kaXNhYmxlKGdsLlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSk7XG4gICAgICAgICAgICBnbC5kaXNhYmxlKGdsLlJBU1RFUklaRVJfRElTQ0FSRCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRlcHRoQmlhc0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5QT0xZR09OX09GRlNFVF9GSUxMKTtcblxuICAgICAgICB0aGlzLmNsZWFyRGVwdGggPSAxO1xuICAgICAgICBnbC5jbGVhckRlcHRoKDEpO1xuXG4gICAgICAgIHRoaXMuY2xlYXJDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwLCAwKTtcbiAgICAgICAgZ2wuY2xlYXJDb2xvcigwLCAwLCAwLCAwKTtcblxuICAgICAgICB0aGlzLmNsZWFyU3RlbmNpbCA9IDA7XG4gICAgICAgIGdsLmNsZWFyU3RlbmNpbCgwKTtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIGdsLmhpbnQoZ2wuRlJBR01FTlRfU0hBREVSX0RFUklWQVRJVkVfSElOVCwgZ2wuTklDRVNUKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHtcbiAgICAgICAgICAgICAgICBnbC5oaW50KHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcy5GUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5UX09FUywgZ2wuTklDRVNUKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGdsLmVuYWJsZShnbC5TQ0lTU09SX1RFU1QpO1xuXG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19DT0xPUlNQQUNFX0NPTlZFUlNJT05fV0VCR0wsIGdsLk5PTkUpO1xuXG4gICAgICAgIHRoaXMudW5wYWNrRmxpcFkgPSBmYWxzZTtcbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0ZMSVBfWV9XRUJHTCwgZmFsc2UpO1xuXG4gICAgICAgIHRoaXMudW5wYWNrUHJlbXVsdGlwbHlBbHBoYSA9IGZhbHNlO1xuICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIGZhbHNlKTtcblxuICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfQUxJR05NRU5ULCAxKTtcbiAgICB9XG5cbiAgICBpbml0aWFsaXplQ29udGV4dENhY2hlcygpIHtcbiAgICAgICAgc3VwZXIuaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKTtcblxuICAgICAgICAvLyBjYWNoZSBvZiBWQU9zXG4gICAgICAgIHRoaXMuX3Zhb01hcCA9IG5ldyBNYXAoKTtcblxuICAgICAgICB0aGlzLmJvdW5kVmFvID0gbnVsbDtcbiAgICAgICAgdGhpcy5hY3RpdmVGcmFtZWJ1ZmZlciA9IG51bGw7XG4gICAgICAgIHRoaXMuZmVlZGJhY2sgPSBudWxsO1xuICAgICAgICB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnRleHR1cmVVbml0ID0gMDtcbiAgICAgICAgdGhpcy50ZXh0dXJlVW5pdHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm1heENvbWJpbmVkVGV4dHVyZXM7IGkrKykge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlVW5pdHMucHVzaChbbnVsbCwgbnVsbCwgbnVsbF0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgd2FzIGxvc3QuIEl0IHJlbGVhc2VzIGFsbCBjb250ZXh0IHJlbGF0ZWQgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICAvLyByZWxlYXNlIHNoYWRlcnNcbiAgICAgICAgZm9yIChjb25zdCBzaGFkZXIgb2YgdGhpcy5zaGFkZXJzKSB7XG4gICAgICAgICAgICBzaGFkZXIubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbGVhc2UgdGV4dHVyZXNcbiAgICAgICAgZm9yIChjb25zdCB0ZXh0dXJlIG9mIHRoaXMudGV4dHVyZXMpIHtcbiAgICAgICAgICAgIHRleHR1cmUubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbGVhc2UgdmVydGV4IGFuZCBpbmRleCBidWZmZXJzXG4gICAgICAgIGZvciAoY29uc3QgYnVmZmVyIG9mIHRoaXMuYnVmZmVycykge1xuICAgICAgICAgICAgYnVmZmVyLmxvc2VDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNldCBhbGwgcmVuZGVyIHRhcmdldHMgc28gdGhleSdsbCBiZSByZWNyZWF0ZWQgYXMgcmVxdWlyZWQuXG4gICAgICAgIC8vIFRPRE86IGEgc29sdXRpb24gZm9yIHRoZSBjYXNlIHdoZXJlIGEgcmVuZGVyIHRhcmdldCBjb250YWlucyBzb21ldGhpbmdcbiAgICAgICAgLy8gdGhhdCB3YXMgcHJldmlvdXNseSBnZW5lcmF0ZWQgdGhhdCBuZWVkcyB0byBiZSByZS1yZW5kZXJlZC5cbiAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2YgdGhpcy50YXJnZXRzKSB7XG4gICAgICAgICAgICB0YXJnZXQubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSBXZWJHTCBjb250ZXh0IGlzIHJlc3RvcmVkLiBJdCByZWluaXRpYWxpemVzIGFsbCBjb250ZXh0IHJlbGF0ZWQgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlc3RvcmVDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmluaXRpYWxpemVFeHRlbnNpb25zKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNhcGFiaWxpdGllcygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVSZW5kZXJTdGF0ZSgpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gUmVjb21waWxlIGFsbCBzaGFkZXJzICh0aGV5J2xsIGJlIGxpbmtlZCB3aGVuIHRoZXkncmUgbmV4dCBhY3R1YWxseSB1c2VkKVxuICAgICAgICBmb3IgKGNvbnN0IHNoYWRlciBvZiB0aGlzLnNoYWRlcnMpIHtcbiAgICAgICAgICAgIHNoYWRlci5yZXN0b3JlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVjcmVhdGUgYnVmZmVyIG9iamVjdHMgYW5kIHJldXBsb2FkIGJ1ZmZlciBkYXRhIHRvIHRoZSBHUFVcbiAgICAgICAgZm9yIChjb25zdCBidWZmZXIgb2YgdGhpcy5idWZmZXJzKSB7XG4gICAgICAgICAgICBidWZmZXIudW5sb2NrKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgYWZ0ZXIgYSBiYXRjaCBvZiBzaGFkZXJzIHdhcyBjcmVhdGVkLCB0byBndWlkZSBpbiB0aGVpciBvcHRpbWFsIHByZXBhcmF0aW9uIGZvciByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZW5kU2hhZGVyQmF0Y2goKSB7XG4gICAgICAgIFdlYmdsU2hhZGVyLmVuZFNoYWRlckJhdGNoKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgYWN0aXZlIHJlY3RhbmdsZSBmb3IgcmVuZGVyaW5nIG9uIHRoZSBzcGVjaWZpZWQgZGV2aWNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgcGl4ZWwgc3BhY2UgeC1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHZpZXdwb3J0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHBpeGVsIHNwYWNlIHktY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSB2aWV3cG9ydC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSB3aWR0aCBvZiB0aGUgdmlld3BvcnQgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIGhlaWdodCBvZiB0aGUgdmlld3BvcnQgaW4gcGl4ZWxzLlxuICAgICAqL1xuICAgIHNldFZpZXdwb3J0KHgsIHksIHcsIGgpIHtcbiAgICAgICAgaWYgKCh0aGlzLnZ4ICE9PSB4KSB8fCAodGhpcy52eSAhPT0geSkgfHwgKHRoaXMudncgIT09IHcpIHx8ICh0aGlzLnZoICE9PSBoKSkge1xuICAgICAgICAgICAgdGhpcy5nbC52aWV3cG9ydCh4LCB5LCB3LCBoKTtcbiAgICAgICAgICAgIHRoaXMudnggPSB4O1xuICAgICAgICAgICAgdGhpcy52eSA9IHk7XG4gICAgICAgICAgICB0aGlzLnZ3ID0gdztcbiAgICAgICAgICAgIHRoaXMudmggPSBoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBhY3RpdmUgc2Npc3NvciByZWN0YW5nbGUgb24gdGhlIHNwZWNpZmllZCBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSBwaXhlbCBzcGFjZSB4LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgcGl4ZWwgc3BhY2UgeS1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZSBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZSBpbiBwaXhlbHMuXG4gICAgICovXG4gICAgc2V0U2Npc3Nvcih4LCB5LCB3LCBoKSB7XG4gICAgICAgIGlmICgodGhpcy5zeCAhPT0geCkgfHwgKHRoaXMuc3kgIT09IHkpIHx8ICh0aGlzLnN3ICE9PSB3KSB8fCAodGhpcy5zaCAhPT0gaCkpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc2Npc3Nvcih4LCB5LCB3LCBoKTtcbiAgICAgICAgICAgIHRoaXMuc3ggPSB4O1xuICAgICAgICAgICAgdGhpcy5zeSA9IHk7XG4gICAgICAgICAgICB0aGlzLnN3ID0gdztcbiAgICAgICAgICAgIHRoaXMuc2ggPSBoO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQmluZHMgdGhlIHNwZWNpZmllZCBmcmFtZWJ1ZmZlciBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1dlYkdMRnJhbWVidWZmZXIgfCBudWxsfSBmYiAtIFRoZSBmcmFtZWJ1ZmZlciB0byBiaW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRGcmFtZWJ1ZmZlcihmYikge1xuICAgICAgICBpZiAodGhpcy5hY3RpdmVGcmFtZWJ1ZmZlciAhPT0gZmIpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZmIpO1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVGcmFtZWJ1ZmZlciA9IGZiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29waWVzIHNvdXJjZSByZW5kZXIgdGFyZ2V0IGludG8gZGVzdGluYXRpb24gcmVuZGVyIHRhcmdldC4gTW9zdGx5IHVzZWQgYnkgcG9zdC1lZmZlY3RzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtzb3VyY2VdIC0gVGhlIHNvdXJjZSByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtSZW5kZXJUYXJnZXR9IFtkZXN0XSAtIFRoZSBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byBmcmFtZSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGNvbG9yIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhdIC0gSWYgdHJ1ZSB3aWxsIGNvcHkgdGhlIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGNvcHkgd2FzIHN1Y2Nlc3NmdWwsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBjb3B5UmVuZGVyVGFyZ2V0KHNvdXJjZSwgZGVzdCwgY29sb3IsIGRlcHRoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICBpZiAoIXRoaXMud2ViZ2wyICYmIGRlcHRoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkRlcHRoIGlzIG5vdCBjb3B5YWJsZSBvbiBXZWJHTCAxLjBcIik7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbG9yKSB7XG4gICAgICAgICAgICBpZiAoIWRlc3QpIHtcbiAgICAgICAgICAgICAgICAvLyBjb3B5aW5nIHRvIGJhY2tidWZmZXJcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fY29sb3JCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IGVtcHR5IGNvbG9yIGJ1ZmZlciB0byBiYWNrYnVmZmVyXCIpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAvLyBjb3B5aW5nIHRvIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fY29sb3JCdWZmZXIgfHwgIWRlc3QuX2NvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBjb2xvciBidWZmZXIsIGJlY2F1c2Ugb25lIG9mIHRoZSByZW5kZXIgdGFyZ2V0cyBkb2Vzbid0IGhhdmUgaXRcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZS5fY29sb3JCdWZmZXIuX2Zvcm1hdCAhPT0gZGVzdC5fY29sb3JCdWZmZXIuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgcmVuZGVyIHRhcmdldHMgb2YgZGlmZmVyZW50IGNvbG9yIGZvcm1hdHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlcHRoICYmIHNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKCFzb3VyY2UuX2RlcHRoKSB7ICAgLy8gd2hlbiBkZXB0aCBpcyBhdXRvbWF0aWMsIHdlIGNhbm5vdCB0ZXN0IHRoZSBidWZmZXIgbm9yIGl0cyBmb3JtYXRcbiAgICAgICAgICAgICAgICBpZiAoIXNvdXJjZS5fZGVwdGhCdWZmZXIgfHwgIWRlc3QuX2RlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSBkZXB0aCBidWZmZXIsIGJlY2F1c2Ugb25lIG9mIHRoZSByZW5kZXIgdGFyZ2V0cyBkb2Vzbid0IGhhdmUgaXRcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZS5fZGVwdGhCdWZmZXIuX2Zvcm1hdCAhPT0gZGVzdC5fZGVwdGhCdWZmZXIuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgcmVuZGVyIHRhcmdldHMgb2YgZGlmZmVyZW50IGRlcHRoIGZvcm1hdHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ0NPUFktUlQnKTtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgZGVzdCkge1xuICAgICAgICAgICAgY29uc3QgcHJldlJ0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IGRlc3Q7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUJlZ2luKCk7XG4gICAgICAgICAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuUkVBRF9GUkFNRUJVRkZFUiwgc291cmNlID8gc291cmNlLmltcGwuX2dsRnJhbWVCdWZmZXIgOiBudWxsKTtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5EUkFXX0ZSQU1FQlVGRkVSLCBkZXN0LmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuICAgICAgICAgICAgY29uc3QgdyA9IHNvdXJjZSA/IHNvdXJjZS53aWR0aCA6IGRlc3Qud2lkdGg7XG4gICAgICAgICAgICBjb25zdCBoID0gc291cmNlID8gc291cmNlLmhlaWdodCA6IGRlc3QuaGVpZ2h0O1xuICAgICAgICAgICAgZ2wuYmxpdEZyYW1lYnVmZmVyKDAsIDAsIHcsIGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCwgMCwgdywgaCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoY29sb3IgPyBnbC5DT0xPUl9CVUZGRVJfQklUIDogMCkgfCAoZGVwdGggPyBnbC5ERVBUSF9CVUZGRVJfQklUIDogMCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2wuTkVBUkVTVCk7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHByZXZSdDtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgcHJldlJ0ID8gcHJldlJ0LmltcGwuX2dsRnJhbWVCdWZmZXIgOiBudWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IHRoaXMuZ2V0Q29weVNoYWRlcigpO1xuICAgICAgICAgICAgdGhpcy5jb25zdGFudFRleFNvdXJjZS5zZXRWYWx1ZShzb3VyY2UuX2NvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgIHF1YWRXaXRoU2hhZGVyKHRoaXMsIGRlc3QsIHNoYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgY29weSBzaGFkZXIgZm9yIGVmZmljaWVudCByZW5kZXJpbmcgb2YgZnVsbHNjcmVlbi1xdWFkIHdpdGggdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTaGFkZXJ9IFRoZSBjb3B5IHNoYWRlciAoYmFzZWQgb24gYGZ1bGxzY3JlZW5RdWFkVlNgIGFuZCBgb3V0cHV0VGV4MkRQU2AgaW5cbiAgICAgKiBgc2hhZGVyQ2h1bmtzYCkuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldENvcHlTaGFkZXIoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29weVNoYWRlcikge1xuICAgICAgICAgICAgdGhpcy5fY29weVNoYWRlciA9IG5ldyBTaGFkZXIodGhpcywgU2hhZGVyVXRpbHMuY3JlYXRlRGVmaW5pdGlvbih0aGlzLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ291dHB1dFRleDJEJyxcbiAgICAgICAgICAgICAgICB2ZXJ0ZXhDb2RlOiBfZnVsbFNjcmVlblF1YWRWUyxcbiAgICAgICAgICAgICAgICBmcmFnbWVudENvZGU6IF9vdXRwdXRUZXh0dXJlMkRcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fY29weVNoYWRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBhIHJlbmRlciBwYXNzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBzdGFydC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RhcnRQYXNzKHJlbmRlclBhc3MpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgYFNUQVJULVBBU1NgKTtcblxuICAgICAgICAvLyBzZXQgdXAgcmVuZGVyIHRhcmdldFxuICAgICAgICB0aGlzLnNldFJlbmRlclRhcmdldChyZW5kZXJQYXNzLnJlbmRlclRhcmdldCk7XG4gICAgICAgIHRoaXMudXBkYXRlQmVnaW4oKTtcblxuICAgICAgICAvLyBjbGVhciB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCBjb2xvck9wcyA9IHJlbmRlclBhc3MuY29sb3JPcHM7XG4gICAgICAgIGNvbnN0IGRlcHRoU3RlbmNpbE9wcyA9IHJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzO1xuICAgICAgICBpZiAoY29sb3JPcHMuY2xlYXIgfHwgZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGggfHwgZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCkge1xuXG4gICAgICAgICAgICAvLyB0aGUgcGFzcyBhbHdheXMgY2xlYXJzIGZ1bGwgdGFyZ2V0XG4gICAgICAgICAgICBjb25zdCBydCA9IHJlbmRlclBhc3MucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgY29uc3Qgd2lkdGggPSBydCA/IHJ0LndpZHRoIDogdGhpcy53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IGhlaWdodCA9IHJ0ID8gcnQuaGVpZ2h0IDogdGhpcy5oZWlnaHQ7XG4gICAgICAgICAgICB0aGlzLnNldFZpZXdwb3J0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICAgICAgdGhpcy5zZXRTY2lzc29yKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuXG4gICAgICAgICAgICBsZXQgY2xlYXJGbGFncyA9IDA7XG4gICAgICAgICAgICBjb25zdCBjbGVhck9wdGlvbnMgPSB7fTtcblxuICAgICAgICAgICAgaWYgKGNvbG9yT3BzLmNsZWFyKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJGbGFncyB8PSBDTEVBUkZMQUdfQ09MT1I7XG4gICAgICAgICAgICAgICAgY2xlYXJPcHRpb25zLmNvbG9yID0gW2NvbG9yT3BzLmNsZWFyVmFsdWUuciwgY29sb3JPcHMuY2xlYXJWYWx1ZS5nLCBjb2xvck9wcy5jbGVhclZhbHVlLmIsIGNvbG9yT3BzLmNsZWFyVmFsdWUuYV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aCkge1xuICAgICAgICAgICAgICAgIGNsZWFyRmxhZ3MgfD0gQ0xFQVJGTEFHX0RFUFRIO1xuICAgICAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5kZXB0aCA9IGRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoVmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgY2xlYXJGbGFncyB8PSBDTEVBUkZMQUdfU1RFTkNJTDtcbiAgICAgICAgICAgICAgICBjbGVhck9wdGlvbnMuc3RlbmNpbCA9IGRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWxWYWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY2xlYXIgaXRcbiAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5mbGFncyA9IGNsZWFyRmxhZ3M7XG4gICAgICAgICAgICB0aGlzLmNsZWFyKGNsZWFyT3B0aW9ucyk7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy5jYWxsKCgpID0+IHtcbiAgICAgICAgICAgIGlmICh0aGlzLmluc2lkZVJlbmRlclBhc3MpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvck9uY2UoJ1JlbmRlclBhc3MgY2Fubm90IGJlIHN0YXJ0ZWQgd2hpbGUgaW5zaWRlIGFub3RoZXIgcmVuZGVyIHBhc3MuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSB0cnVlO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuZCBhIHJlbmRlciBwYXNzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3JlbmRlci1wYXNzLmpzJykuUmVuZGVyUGFzc30gcmVuZGVyUGFzcyAtIFRoZSByZW5kZXIgcGFzcyB0byBlbmQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGVuZFBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgRU5ELVBBU1NgKTtcblxuICAgICAgICB0aGlzLnVuYmluZFZlcnRleEFycmF5KCk7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGlmICh0YXJnZXQpIHtcblxuICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSBidWZmZXJzIHRvIHN0b3AgdGhlbSBiZWluZyB3cml0dGVuIHRvIG9uIHRpbGVkIGFyY2hpdGV4dHVyZXNcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgICAgIC8vIGludmFsaWRhdGUgY29sb3Igb25seSBpZiB3ZSBkb24ndCBuZWVkIHRvIHJlc29sdmUgaXRcbiAgICAgICAgICAgICAgICBpZiAoIShyZW5kZXJQYXNzLmNvbG9yT3BzLnN0b3JlIHx8IHJlbmRlclBhc3MuY29sb3JPcHMucmVzb2x2ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuQ09MT1JfQVRUQUNITUVOVDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuREVQVEhfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5wdXNoKGdsLlNURU5DSUxfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGludmFsaWRhdGVBdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSB0aGUgd2hvbGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IHdlIGNvdWxkIGhhbmRsZSB2aWV3cG9ydCBpbnZhbGlkYXRpb24gYXMgd2VsbFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuaW52YWxpZGF0ZUZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIGludmFsaWRhdGVBdHRhY2htZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlc29sdmUgdGhlIGNvbG9yIGJ1ZmZlclxuICAgICAgICAgICAgaWYgKHJlbmRlclBhc3MuY29sb3JPcHMucmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiByZW5kZXJQYXNzLnNhbXBsZXMgPiAxICYmIHRhcmdldC5hdXRvUmVzb2x2ZSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSh0cnVlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSBtaXBtYXBzXG4gICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5jb2xvck9wcy5taXBtYXBzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSB0YXJnZXQuX2NvbG9yQnVmZmVyO1xuICAgICAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYmluZFRleHR1cmUoY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmdlbmVyYXRlTWlwbWFwKGNvbG9yQnVmZmVyLmltcGwuX2dsVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrcyB0aGUgYmVnaW5uaW5nIG9mIGEgYmxvY2sgb2YgcmVuZGVyaW5nLiBJbnRlcm5hbGx5LCB0aGlzIGZ1bmN0aW9uIGJpbmRzIHRoZSByZW5kZXJcbiAgICAgKiB0YXJnZXQgY3VycmVudGx5IHNldCBvbiB0aGUgZGV2aWNlLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBtYXRjaGVkIHdpdGggYSBjYWxsIHRvXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0uIENhbGxzIHRvIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVCZWdpbn0gYW5kXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0gbXVzdCBub3QgYmUgbmVzdGVkLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUJlZ2luKCkge1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ1VQREFURS1CRUdJTicpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuXG4gICAgICAgIC8vIGNsZWFyIHRleHR1cmUgdW5pdHMgb25jZSBhIGZyYW1lIG9uIGRlc2t0b3Agc2FmYXJpXG4gICAgICAgIGlmICh0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kKSB7XG4gICAgICAgICAgICBmb3IgKGxldCB1bml0ID0gMDsgdW5pdCA8IHRoaXMudGV4dHVyZVVuaXRzLmxlbmd0aDsgKyt1bml0KSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgc2xvdCA9IDA7IHNsb3QgPCAzOyArK3Nsb3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlVW5pdHNbdW5pdF1bc2xvdF0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IFdlYkdMIGZyYW1lIGJ1ZmZlciBvYmplY3RcbiAgICAgICAgICAgIGlmICghdGFyZ2V0LmltcGwuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQodGFyZ2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRGcmFtZWJ1ZmZlcih0YXJnZXQuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldEZyYW1lYnVmZmVyKHRoaXMuZGVmYXVsdEZyYW1lYnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBlbmQgb2YgYSBibG9jayBvZiByZW5kZXJpbmcuIFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNhbGxlZCBhZnRlciBhIG1hdGNoaW5nIGNhbGxcbiAgICAgKiB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59LiBDYWxscyB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59IGFuZFxuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVFbmR9IG11c3Qgbm90IGJlIG5lc3RlZC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVFbmQoKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBVUERBVEUtRU5EYCk7XG5cbiAgICAgICAgdGhpcy51bmJpbmRWZXJ0ZXhBcnJheSgpO1xuXG4gICAgICAgIC8vIFVuc2V0IHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgICAvLyBSZXNvbHZlIE1TQUEgaWYgbmVlZGVkXG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGFyZ2V0Ll9zYW1wbGVzID4gMSAmJiB0YXJnZXQuYXV0b1Jlc29sdmUpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgYWN0aXZlIHJlbmRlciB0YXJnZXQgaXMgYXV0by1taXBtYXBwZWQsIGdlbmVyYXRlIGl0cyBtaXAgY2hhaW5cbiAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGFyZ2V0Ll9jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgIC8vIEZJWE1FOiBpZiBjb2xvckJ1ZmZlciBpcyBhIGN1YmVtYXAgY3VycmVudGx5IHdlJ3JlIHJlLWdlbmVyYXRpbmcgbWlwbWFwcyBhZnRlclxuICAgICAgICAgICAgICAgIC8vIHVwZGF0aW5nIGVhY2ggZmFjZSFcbiAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZShjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5nbC5nZW5lcmF0ZU1pcG1hcChjb2xvckJ1ZmZlci5pbXBsLl9nbFRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSdzIHZlcnRpY2FsIGZsaXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZsaXBZIC0gVHJ1ZSB0byBmbGlwIHRoZSB0ZXh0dXJlIHZlcnRpY2FsbHkuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFVucGFja0ZsaXBZKGZsaXBZKSB7XG4gICAgICAgIGlmICh0aGlzLnVucGFja0ZsaXBZICE9PSBmbGlwWSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZsaXBZO1xuXG4gICAgICAgICAgICAvLyBOb3RlOiB0aGUgV2ViR0wgc3BlYyBzdGF0ZXMgdGhhdCBVTlBBQ0tfRkxJUF9ZX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmbGlwWSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSB0byBoYXZlIGl0cyBSR0IgY2hhbm5lbHMgcHJlbXVsdGlwbGllZCBieSBpdHMgYWxwaGEgY2hhbm5lbCBvciBub3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByZW11bHRpcGx5QWxwaGEgLSBUcnVlIHRvIHByZW11bHRpcGx5IHRoZSBhbHBoYSBjaGFubmVsIGFnYWluc3QgdGhlIFJHQlxuICAgICAqIGNoYW5uZWxzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgaWYgKHRoaXMudW5wYWNrUHJlbXVsdGlwbHlBbHBoYSAhPT0gcHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gcHJlbXVsdGlwbHlBbHBoYTtcblxuICAgICAgICAgICAgLy8gTm90ZTogdGhlIFdlYkdMIHNwZWMgc3RhdGVzIHRoYXQgVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIHByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWN0aXZhdGUgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KSB7XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0ICE9PSB0ZXh0dXJlVW5pdCkge1xuICAgICAgICAgICAgdGhpcy5nbC5hY3RpdmVUZXh0dXJlKHRoaXMuZ2wuVEVYVFVSRTAgKyB0ZXh0dXJlVW5pdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0ID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgdGV4dHVyZSBpcyBub3QgYWxyZWFkeSBib3VuZCBvbiB0aGUgY3VycmVudGx5IGFjdGl2ZSB0ZXh0dXJlIHVuaXQsIGJpbmQgaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byBiaW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZSh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IGltcGwgPSB0ZXh0dXJlLmltcGw7XG4gICAgICAgIGNvbnN0IHRleHR1cmVUYXJnZXQgPSBpbXBsLl9nbFRhcmdldDtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9iamVjdCA9IGltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgY29uc3QgdGV4dHVyZVVuaXQgPSB0aGlzLnRleHR1cmVVbml0O1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy50YXJnZXRUb1Nsb3RbdGV4dHVyZVRhcmdldF07XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gIT09IHRleHR1cmVPYmplY3QpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIHRleHR1cmUgaXMgbm90IGJvdW5kIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LCBhY3RpdmUgdGhlIHRleHR1cmUgdW5pdCBhbmQgYmluZFxuICAgICAqIHRoZSB0ZXh0dXJlIHRvIGl0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gYmluZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlIGFuZCBiaW5kIHRoZSB0ZXh0dXJlIHRvLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCkge1xuICAgICAgICBjb25zdCBpbXBsID0gdGV4dHVyZS5pbXBsO1xuICAgICAgICBjb25zdCB0ZXh0dXJlVGFyZ2V0ID0gaW1wbC5fZ2xUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHRleHR1cmVPYmplY3QgPSBpbXBsLl9nbFRleHR1cmU7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnRhcmdldFRvU2xvdFt0ZXh0dXJlVGFyZ2V0XTtcbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSAhPT0gdGV4dHVyZU9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSB0ZXh0dXJlIHBhcmFtZXRlcnMgZm9yIGEgZ2l2ZW4gdGV4dHVyZSBpZiB0aGV5IGhhdmUgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHVwZGF0ZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VGV4dHVyZVBhcmFtZXRlcnModGV4dHVyZSkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGNvbnN0IGZsYWdzID0gdGV4dHVyZS5fcGFyYW1ldGVyRmxhZ3M7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRleHR1cmUuaW1wbC5fZ2xUYXJnZXQ7XG5cbiAgICAgICAgaWYgKGZsYWdzICYgMSkge1xuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHRleHR1cmUuX21pbkZpbHRlcjtcbiAgICAgICAgICAgIGlmICgoIXRleHR1cmUucG90ICYmICF0aGlzLndlYmdsMikgfHwgIXRleHR1cmUuX21pcG1hcHMgfHwgKHRleHR1cmUuX2NvbXByZXNzZWQgJiYgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aCA9PT0gMSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmlsdGVyID09PSBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCB8fCBmaWx0ZXIgPT09IEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX05FQVJFU1Q7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmaWx0ZXIgPT09IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QgfHwgZmlsdGVyID09PSBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCB0aGlzLmdsRmlsdGVyW2ZpbHRlcl0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDIpIHtcbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX01BR19GSUxURVIsIHRoaXMuZ2xGaWx0ZXJbdGV4dHVyZS5fbWFnRmlsdGVyXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9TLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzVV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBXZWJHTDEgZG9lc24ndCBzdXBwb3J0IGFsbCBhZGRyZXNzaW5nIG1vZGVzIHdpdGggTlBPVCB0ZXh0dXJlc1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUywgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5wb3QgPyB0ZXh0dXJlLl9hZGRyZXNzVSA6IEFERFJFU1NfQ0xBTVBfVE9fRURHRV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfVCwgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5fYWRkcmVzc1ZdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gV2ViR0wxIGRvZXNuJ3Qgc3VwcG9ydCBhbGwgYWRkcmVzc2luZyBtb2RlcyB3aXRoIE5QT1QgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1QsIHRoaXMuZ2xBZGRyZXNzW3RleHR1cmUucG90ID8gdGV4dHVyZS5fYWRkcmVzc1YgOiBBRERSRVNTX0NMQU1QX1RPX0VER0VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxNikge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9SLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzV10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDMyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9DT01QQVJFX01PREUsIHRleHR1cmUuX2NvbXBhcmVPblJlYWQgPyBnbC5DT01QQVJFX1JFRl9UT19URVhUVVJFIDogZ2wuTk9ORSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNjQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX0NPTVBBUkVfRlVOQywgdGhpcy5nbENvbXBhcmlzb25bdGV4dHVyZS5fY29tcGFyZUZ1bmNdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxMjgpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljO1xuICAgICAgICAgICAgaWYgKGV4dCkge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmYodGFyZ2V0LCBleHQuVEVYVFVSRV9NQVhfQU5JU09UUk9QWV9FWFQsIE1hdGgubWF4KDEsIE1hdGgubWluKE1hdGgucm91bmQodGV4dHVyZS5fYW5pc290cm9weSksIHRoaXMubWF4QW5pc290cm9weSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0ZXh0dXJlVW5pdCAtIFRoZSB0ZXh0dXJlIHVuaXQgdG8gc2V0IHRoZSB0ZXh0dXJlIG9uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KSB7XG5cbiAgICAgICAgaWYgKCF0ZXh0dXJlLmltcGwuX2dsVGV4dHVyZSlcbiAgICAgICAgICAgIHRleHR1cmUuaW1wbC5pbml0aWFsaXplKHRoaXMsIHRleHR1cmUpO1xuXG4gICAgICAgIGlmICh0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncyA+IDAgfHwgdGV4dHVyZS5fbmVlZHNVcGxvYWQgfHwgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkKSB7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdCBpcyBhY3RpdmVcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlVGV4dHVyZSh0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgIC8vIEVuc3VyZSB0aGUgdGV4dHVyZSBpcyBib3VuZCBvbiBjb3JyZWN0IHRhcmdldCBvZiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdFxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZSh0ZXh0dXJlKTtcblxuICAgICAgICAgICAgaWYgKHRleHR1cmUuX3BhcmFtZXRlckZsYWdzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlUGFyYW1ldGVycyh0ZXh0dXJlKTtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9wYXJhbWV0ZXJGbGFncyA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9uZWVkc1VwbG9hZCB8fCB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLmltcGwudXBsb2FkKHRoaXMsIHRleHR1cmUpO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX25lZWRzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGV4dHVyZS5fbmVlZHNNaXBtYXBzVXBsb2FkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIHRleHR1cmUgaXMgY3VycmVudGx5IGJvdW5kIHRvIHRoZSBjb3JyZWN0IHRhcmdldCBvbiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdC5cbiAgICAgICAgICAgIC8vIElmIHRoZSB0ZXh0dXJlIGlzIGFscmVhZHkgYm91bmQgdG8gdGhlIGNvcnJlY3QgdGFyZ2V0IG9uIHRoZSBzcGVjaWZpZWQgdW5pdCwgdGhlcmUncyBubyBuZWVkXG4gICAgICAgICAgICAvLyB0byBhY3R1YWxseSBtYWtlIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0IGFjdGl2ZSBiZWNhdXNlIHRoZSB0ZXh0dXJlIGl0c2VsZiBkb2VzIG5vdCBuZWVkXG4gICAgICAgICAgICAvLyB0byBiZSB1cGRhdGVkLlxuICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBjcmVhdGVzIFZlcnRleEFycmF5T2JqZWN0IGZyb20gbGlzdCBvZiB2ZXJ0ZXggYnVmZmVyc1xuICAgIGNyZWF0ZVZlcnRleEFycmF5KHZlcnRleEJ1ZmZlcnMpIHtcblxuICAgICAgICBsZXQga2V5LCB2YW87XG5cbiAgICAgICAgLy8gb25seSB1c2UgY2FjaGUgd2hlbiBtb3JlIHRoYW4gMSB2ZXJ0ZXggYnVmZmVyLCBvdGhlcndpc2UgaXQncyB1bmlxdWVcbiAgICAgICAgY29uc3QgdXNlQ2FjaGUgPSB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA+IDE7XG4gICAgICAgIGlmICh1c2VDYWNoZSkge1xuXG4gICAgICAgICAgICAvLyBnZW5lcmF0ZSB1bmlxdWUga2V5IGZvciB0aGUgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgICAgIGtleSA9IFwiXCI7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZlcnRleEJ1ZmZlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXJzW2ldO1xuICAgICAgICAgICAgICAgIGtleSArPSB2ZXJ0ZXhCdWZmZXIuaWQgKyB2ZXJ0ZXhCdWZmZXIuZm9ybWF0LnJlbmRlcmluZ0hhc2g7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRyeSB0byBnZXQgVkFPIGZyb20gY2FjaGVcbiAgICAgICAgICAgIHZhbyA9IHRoaXMuX3Zhb01hcC5nZXQoa2V5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5lZWQgdG8gY3JlYXRlIG5ldyB2YW9cbiAgICAgICAgaWYgKCF2YW8pIHtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIFZBIG9iamVjdFxuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgdmFvID0gZ2wuY3JlYXRlVmVydGV4QXJyYXkoKTtcbiAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSh2YW8pO1xuXG4gICAgICAgICAgICAvLyBkb24ndCBjYXB0dXJlIGluZGV4IGJ1ZmZlciBpbiBWQU9cbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIG51bGwpO1xuXG4gICAgICAgICAgICBsZXQgbG9jWmVybyA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBiaW5kIGJ1ZmZlclxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcnNbaV07XG4gICAgICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZlcnRleEJ1ZmZlci5pbXBsLmJ1ZmZlcklkKTtcblxuICAgICAgICAgICAgICAgIC8vIGZvciBlYWNoIGF0dHJpYnV0ZVxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzID0gdmVydGV4QnVmZmVyLmZvcm1hdC5lbGVtZW50cztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGVsZW1lbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGUgPSBlbGVtZW50c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9jID0gc2VtYW50aWNUb0xvY2F0aW9uW2UubmFtZV07XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvYyA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9jWmVybyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvYywgZS5udW1Db21wb25lbnRzLCB0aGlzLmdsVHlwZVtlLmRhdGFUeXBlXSwgZS5ub3JtYWxpemUsIGUuc3RyaWRlLCBlLm9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvYyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHZlcnRleEJ1ZmZlci5mb3JtYXQuaW5zdGFuY2luZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wudmVydGV4QXR0cmliRGl2aXNvcihsb2MsIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbmQgb2YgVkEgb2JqZWN0XG4gICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkobnVsbCk7XG5cbiAgICAgICAgICAgIC8vIHVuYmluZCBhbnkgYXJyYXkgYnVmZmVyXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgbnVsbCk7XG5cbiAgICAgICAgICAgIC8vIGFkZCBpdCB0byBjYWNoZVxuICAgICAgICAgICAgaWYgKHVzZUNhY2hlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdmFvTWFwLnNldChrZXksIHZhbyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghbG9jWmVybykge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJObyB2ZXJ0ZXggYXR0cmlidXRlIGlzIG1hcHBlZCB0byBsb2NhdGlvbiAwLCB3aGljaCBtaWdodCBjYXVzZSBjb21wYXRpYmlsaXR5IGlzc3VlcyBvbiBTYWZhcmkgb24gTWFjT1MgLSBwbGVhc2UgdXNlIGF0dHJpYnV0ZSBTRU1BTlRJQ19QT1NJVElPTiBvciBTRU1BTlRJQ19BVFRSMTVcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFvO1xuICAgIH1cblxuICAgIHVuYmluZFZlcnRleEFycmF5KCkge1xuICAgICAgICAvLyB1bmJpbmQgVkFPIGZyb20gZGV2aWNlIHRvIHByb3RlY3QgaXQgZnJvbSBiZWluZyBjaGFuZ2VkXG4gICAgICAgIGlmICh0aGlzLmJvdW5kVmFvKSB7XG4gICAgICAgICAgICB0aGlzLmJvdW5kVmFvID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFZlcnRleEFycmF5KG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0QnVmZmVycygpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBsZXQgdmFvO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBWQU8gZm9yIHNwZWNpZmllZCB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICBpZiAodGhpcy52ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA9PT0gMSkge1xuXG4gICAgICAgICAgICAvLyBzaW5nbGUgVkIga2VlcHMgaXRzIFZBT1xuICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gdGhpcy52ZXJ0ZXhCdWZmZXJzWzBdO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KHZlcnRleEJ1ZmZlci5kZXZpY2UgPT09IHRoaXMsIFwiVGhlIFZlcnRleEJ1ZmZlciB3YXMgbm90IGNyZWF0ZWQgdXNpbmcgY3VycmVudCBHcmFwaGljc0RldmljZVwiKTtcbiAgICAgICAgICAgIGlmICghdmVydGV4QnVmZmVyLmltcGwudmFvKSB7XG4gICAgICAgICAgICAgICAgdmVydGV4QnVmZmVyLmltcGwudmFvID0gdGhpcy5jcmVhdGVWZXJ0ZXhBcnJheSh0aGlzLnZlcnRleEJ1ZmZlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFvID0gdmVydGV4QnVmZmVyLmltcGwudmFvO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gb2J0YWluIHRlbXBvcmFyeSBWQU8gZm9yIG11bHRpcGxlIHZlcnRleCBidWZmZXJzXG4gICAgICAgICAgICB2YW8gPSB0aGlzLmNyZWF0ZVZlcnRleEFycmF5KHRoaXMudmVydGV4QnVmZmVycyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgYWN0aXZlIFZBT1xuICAgICAgICBpZiAodGhpcy5ib3VuZFZhbyAhPT0gdmFvKSB7XG4gICAgICAgICAgICB0aGlzLmJvdW5kVmFvID0gdmFvO1xuICAgICAgICAgICAgZ2wuYmluZFZlcnRleEFycmF5KHZhbyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbXB0eSBhcnJheSBvZiB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICB0aGlzLnZlcnRleEJ1ZmZlcnMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBTZXQgdGhlIGFjdGl2ZSBpbmRleCBidWZmZXIgb2JqZWN0XG4gICAgICAgIC8vIE5vdGU6IHdlIGRvbid0IGNhY2hlIHRoaXMgc3RhdGUgYW5kIHNldCBpdCBvbmx5IHdoZW4gaXQgY2hhbmdlcywgYXMgVkFPIGNhcHR1cmVzIGxhc3QgYmluZCBidWZmZXIgaW4gaXRcbiAgICAgICAgLy8gYW5kIHNvIHdlIGRvbid0IGtub3cgd2hhdCBWQU8gc2V0cyBpdCB0by5cbiAgICAgICAgY29uc3QgYnVmZmVySWQgPSB0aGlzLmluZGV4QnVmZmVyID8gdGhpcy5pbmRleEJ1ZmZlci5pbXBsLmJ1ZmZlcklkIDogbnVsbDtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgYnVmZmVySWQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN1Ym1pdHMgYSBncmFwaGljYWwgcHJpbWl0aXZlIHRvIHRoZSBoYXJkd2FyZSBmb3IgaW1tZWRpYXRlIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwcmltaXRpdmUgLSBQcmltaXRpdmUgb2JqZWN0IGRlc2NyaWJpbmcgaG93IHRvIHN1Ym1pdCBjdXJyZW50IHZlcnRleC9pbmRleFxuICAgICAqIGJ1ZmZlcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS50eXBlIC0gVGhlIHR5cGUgb2YgcHJpbWl0aXZlIHRvIHJlbmRlci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1BPSU5UU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORVN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVMT09QfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUFOR0xFU31cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfVFJJU1RSSVB9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSUZBTn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwcmltaXRpdmUuYmFzZSAtIFRoZSBvZmZzZXQgb2YgdGhlIGZpcnN0IGluZGV4IG9yIHZlcnRleCB0byBkaXNwYXRjaCBpbiB0aGVcbiAgICAgKiBkcmF3IGNhbGwuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHByaW1pdGl2ZS5jb3VudCAtIFRoZSBudW1iZXIgb2YgaW5kaWNlcyBvciB2ZXJ0aWNlcyB0byBkaXNwYXRjaCBpbiB0aGUgZHJhd1xuICAgICAqIGNhbGwuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbcHJpbWl0aXZlLmluZGV4ZWRdIC0gVHJ1ZSB0byBpbnRlcnByZXQgdGhlIHByaW1pdGl2ZSBhcyBpbmRleGVkLCB0aGVyZWJ5XG4gICAgICogdXNpbmcgdGhlIGN1cnJlbnRseSBzZXQgaW5kZXggYnVmZmVyIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtudW1JbnN0YW5jZXM9MV0gLSBUaGUgbnVtYmVyIG9mIGluc3RhbmNlcyB0byByZW5kZXIgd2hlbiB1c2luZ1xuICAgICAqIEFOR0xFX2luc3RhbmNlZF9hcnJheXMuIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBba2VlcEJ1ZmZlcnNdIC0gT3B0aW9uYWxseSBrZWVwIHRoZSBjdXJyZW50IHNldCBvZiB2ZXJ0ZXggLyBpbmRleCBidWZmZXJzIC9cbiAgICAgKiBWQU8uIFRoaXMgaXMgdXNlZCB3aGVuIHJlbmRlcmluZyBvZiBtdWx0aXBsZSB2aWV3cywgZm9yIGV4YW1wbGUgdW5kZXIgV2ViWFIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSBzaW5nbGUsIHVuaW5kZXhlZCB0cmlhbmdsZVxuICAgICAqIGRldmljZS5kcmF3KHtcbiAgICAgKiAgICAgdHlwZTogcGMuUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICAgKiAgICAgYmFzZTogMCxcbiAgICAgKiAgICAgY291bnQ6IDMsXG4gICAgICogICAgIGluZGV4ZWQ6IGZhbHNlXG4gICAgICogfSk7XG4gICAgICovXG4gICAgZHJhdyhwcmltaXRpdmUsIG51bUluc3RhbmNlcywga2VlcEJ1ZmZlcnMpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGxldCBzYW1wbGVyLCBzYW1wbGVyVmFsdWUsIHRleHR1cmUsIG51bVRleHR1cmVzOyAvLyBTYW1wbGVyc1xuICAgICAgICBsZXQgdW5pZm9ybSwgc2NvcGVJZCwgdW5pZm9ybVZlcnNpb24sIHByb2dyYW1WZXJzaW9uOyAvLyBVbmlmb3Jtc1xuICAgICAgICBjb25zdCBzaGFkZXIgPSB0aGlzLnNoYWRlcjtcbiAgICAgICAgaWYgKCFzaGFkZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGNvbnN0IHNhbXBsZXJzID0gc2hhZGVyLmltcGwuc2FtcGxlcnM7XG4gICAgICAgIGNvbnN0IHVuaWZvcm1zID0gc2hhZGVyLmltcGwudW5pZm9ybXM7XG5cbiAgICAgICAgLy8gdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgaWYgKCFrZWVwQnVmZmVycykge1xuICAgICAgICAgICAgdGhpcy5zZXRCdWZmZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21taXQgdGhlIHNoYWRlciBwcm9ncmFtIHZhcmlhYmxlc1xuICAgICAgICBsZXQgdGV4dHVyZVVuaXQgPSAwO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzYW1wbGVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgc2FtcGxlciA9IHNhbXBsZXJzW2ldO1xuICAgICAgICAgICAgc2FtcGxlclZhbHVlID0gc2FtcGxlci5zY29wZUlkLnZhbHVlO1xuICAgICAgICAgICAgaWYgKCFzYW1wbGVyVmFsdWUpIHtcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBjb25zdCBzYW1wbGVyTmFtZSA9IHNhbXBsZXIuc2NvcGVJZC5uYW1lO1xuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyTmFtZSA9PT0gJ3VTY2VuZURlcHRoTWFwJyB8fCBzYW1wbGVyTmFtZSA9PT0gJ3VEZXB0aE1hcCcpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgZGVwdGggdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZURlcHRoTWFwIHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXJOYW1lID09PSAndVNjZW5lQ29sb3JNYXAnIHx8IHNhbXBsZXJOYW1lID09PSAndGV4dHVyZV9ncmFiUGFzcycpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcud2Fybk9uY2UoYEEgc2FtcGxlciAke3NhbXBsZXJOYW1lfSBpcyB1c2VkIGJ5IHRoZSBzaGFkZXIgYnV0IGEgc2NlbmUgY29sb3IgdGV4dHVyZSBpcyBub3QgYXZhaWxhYmxlLiBVc2UgQ2FtZXJhQ29tcG9uZW50LnJlcXVlc3RTY2VuZUNvbG9yTWFwIHRvIGVuYWJsZSBpdC5gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvck9uY2UoYFNoYWRlciBbJHtzaGFkZXIubGFiZWx9XSByZXF1aXJlcyB0ZXh0dXJlIHNhbXBsZXIgWyR7c2FtcGxlck5hbWV9XSB3aGljaCBoYXMgbm90IGJlZW4gc2V0LCB3aGlsZSByZW5kZXJpbmcgWyR7RGVidWdHcmFwaGljcy50b1N0cmluZygpfV1gKTtcblxuICAgICAgICAgICAgICAgIC8vIHNraXAgdGhpcyBkcmF3IGNhbGwgdG8gYXZvaWQgaW5jb3JyZWN0IHJlbmRlcmluZyAvIHdlYmdsIGVycm9yc1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNhbXBsZXJWYWx1ZSBpbnN0YW5jZW9mIFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlID0gc2FtcGxlclZhbHVlO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNldCBicmVha3BvaW50IGhlcmUgdG8gZGVidWcgXCJTb3VyY2UgYW5kIGRlc3RpbmF0aW9uIHRleHR1cmVzIG9mIHRoZSBkcmF3IGFyZSB0aGUgc2FtZVwiIGVycm9yc1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuX3NhbXBsZXMgPCAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgJiYgdGhpcy5yZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIgPT09IHRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIlRyeWluZyB0byBiaW5kIGN1cnJlbnQgY29sb3IgYnVmZmVyIGFzIGEgdGV4dHVyZVwiLCB7IHJlbmRlclRhcmdldDogdGhpcy5yZW5kZXJUYXJnZXQsIHRleHR1cmUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMucmVuZGVyVGFyZ2V0LmRlcHRoQnVmZmVyICYmIHRoaXMucmVuZGVyVGFyZ2V0LmRlcHRoQnVmZmVyID09PSB0ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJUcnlpbmcgdG8gYmluZCBjdXJyZW50IGRlcHRoIGJ1ZmZlciBhcyBhIHRleHR1cmVcIiwgeyB0ZXh0dXJlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXIuc2xvdCAhPT0gdGV4dHVyZVVuaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFpKHNhbXBsZXIubG9jYXRpb25JZCwgdGV4dHVyZVVuaXQpO1xuICAgICAgICAgICAgICAgICAgICBzYW1wbGVyLnNsb3QgPSB0ZXh0dXJlVW5pdDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGV4dHVyZVVuaXQrKztcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIEFycmF5XG4gICAgICAgICAgICAgICAgc2FtcGxlci5hcnJheS5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIG51bVRleHR1cmVzID0gc2FtcGxlclZhbHVlLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG51bVRleHR1cmVzOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dHVyZSA9IHNhbXBsZXJWYWx1ZVtqXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlKHRleHR1cmUsIHRleHR1cmVVbml0KTtcblxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVyLmFycmF5W2pdID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmVVbml0Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xaXYoc2FtcGxlci5sb2NhdGlvbklkLCBzYW1wbGVyLmFycmF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbW1pdCBhbnkgdXBkYXRlZCB1bmlmb3Jtc1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdW5pZm9ybXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHVuaWZvcm0gPSB1bmlmb3Jtc1tpXTtcbiAgICAgICAgICAgIHNjb3BlSWQgPSB1bmlmb3JtLnNjb3BlSWQ7XG4gICAgICAgICAgICB1bmlmb3JtVmVyc2lvbiA9IHVuaWZvcm0udmVyc2lvbjtcbiAgICAgICAgICAgIHByb2dyYW1WZXJzaW9uID0gc2NvcGVJZC52ZXJzaW9uT2JqZWN0LnZlcnNpb247XG5cbiAgICAgICAgICAgIC8vIENoZWNrIHRoZSB2YWx1ZSBpcyB2YWxpZFxuICAgICAgICAgICAgaWYgKHVuaWZvcm1WZXJzaW9uLmdsb2JhbElkICE9PSBwcm9ncmFtVmVyc2lvbi5nbG9iYWxJZCB8fCB1bmlmb3JtVmVyc2lvbi5yZXZpc2lvbiAhPT0gcHJvZ3JhbVZlcnNpb24ucmV2aXNpb24pIHtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmVyc2lvbi5nbG9iYWxJZCA9IHByb2dyYW1WZXJzaW9uLmdsb2JhbElkO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WZXJzaW9uLnJldmlzaW9uID0gcHJvZ3JhbVZlcnNpb24ucmV2aXNpb247XG5cbiAgICAgICAgICAgICAgICAvLyBDYWxsIHRoZSBmdW5jdGlvbiB0byBjb21taXQgdGhlIHVuaWZvcm0gdmFsdWVcbiAgICAgICAgICAgICAgICBpZiAoc2NvcGVJZC52YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW3VuaWZvcm0uZGF0YVR5cGVdKHVuaWZvcm0sIHNjb3BlSWQudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbW1lbnRlZCBvdXQgdGlsbCBlbmdpbmUgaXNzdWUgIzQ5NzEgaXMgc29ydGVkIG91dFxuICAgICAgICAgICAgICAgICAgICAvLyBEZWJ1Zy53YXJuT25jZShgU2hhZGVyIFske3NoYWRlci5sYWJlbH1dIHJlcXVpcmVzIHVuaWZvcm0gWyR7dW5pZm9ybS5zY29wZUlkLm5hbWV9XSB3aGljaCBoYXMgbm90IGJlZW4gc2V0LCB3aGlsZSByZW5kZXJpbmcgWyR7RGVidWdHcmFwaGljcy50b1N0cmluZygpfV1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlcikge1xuICAgICAgICAgICAgLy8gRW5hYmxlIFRGLCBzdGFydCB3cml0aW5nIHRvIG91dCBidWZmZXJcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXJCYXNlKGdsLlRSQU5TRk9STV9GRUVEQkFDS19CVUZGRVIsIDAsIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIuaW1wbC5idWZmZXJJZCk7XG4gICAgICAgICAgICBnbC5iZWdpblRyYW5zZm9ybUZlZWRiYWNrKGdsLlBPSU5UUyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtb2RlID0gdGhpcy5nbFByaW1pdGl2ZVtwcmltaXRpdmUudHlwZV07XG4gICAgICAgIGNvbnN0IGNvdW50ID0gcHJpbWl0aXZlLmNvdW50O1xuXG4gICAgICAgIGlmIChwcmltaXRpdmUuaW5kZXhlZCkge1xuICAgICAgICAgICAgY29uc3QgaW5kZXhCdWZmZXIgPSB0aGlzLmluZGV4QnVmZmVyO1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGluZGV4QnVmZmVyLmRldmljZSA9PT0gdGhpcywgXCJUaGUgSW5kZXhCdWZmZXIgd2FzIG5vdCBjcmVhdGVkIHVzaW5nIGN1cnJlbnQgR3JhcGhpY3NEZXZpY2VcIik7XG5cbiAgICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IGluZGV4QnVmZmVyLmltcGwuZ2xGb3JtYXQ7XG4gICAgICAgICAgICBjb25zdCBvZmZzZXQgPSBwcmltaXRpdmUuYmFzZSAqIGluZGV4QnVmZmVyLmJ5dGVzUGVySW5kZXg7XG5cbiAgICAgICAgICAgIGlmIChudW1JbnN0YW5jZXMgPiAwKSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0VsZW1lbnRzSW5zdGFuY2VkKG1vZGUsIGNvdW50LCBmb3JtYXQsIG9mZnNldCwgbnVtSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0VsZW1lbnRzKG1vZGUsIGNvdW50LCBmb3JtYXQsIG9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBmaXJzdCA9IHByaW1pdGl2ZS5iYXNlO1xuXG4gICAgICAgICAgICBpZiAobnVtSW5zdGFuY2VzID4gMCkge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQobW9kZSwgZmlyc3QsIGNvdW50LCBudW1JbnN0YW5jZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3QXJyYXlzKG1vZGUsIGZpcnN0LCBjb3VudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlcikge1xuICAgICAgICAgICAgLy8gZGlzYWJsZSBURlxuICAgICAgICAgICAgZ2wuZW5kVHJhbnNmb3JtRmVlZGJhY2soKTtcbiAgICAgICAgICAgIGdsLmJpbmRCdWZmZXJCYXNlKGdsLlRSQU5TRk9STV9GRUVEQkFDS19CVUZGRVIsIDAsIG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZHJhd0NhbGxzUGVyRnJhbWUrKztcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuX3ByaW1zUGVyRnJhbWVbcHJpbWl0aXZlLnR5cGVdICs9IHByaW1pdGl2ZS5jb3VudCAqIChudW1JbnN0YW5jZXMgPiAxID8gbnVtSW5zdGFuY2VzIDogMSk7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFycyB0aGUgZnJhbWUgYnVmZmVyIG9mIHRoZSBjdXJyZW50bHkgc2V0IHJlbmRlciB0YXJnZXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QgdGhhdCBjb250cm9scyB0aGUgYmVoYXZpb3Igb2YgdGhlIGNsZWFyXG4gICAgICogb3BlcmF0aW9uIGRlZmluZWQgYXMgZm9sbG93czpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBbb3B0aW9ucy5jb2xvcl0gLSBUaGUgY29sb3IgdG8gY2xlYXIgdGhlIGNvbG9yIGJ1ZmZlciB0byBpbiB0aGUgcmFuZ2UgMC4wXG4gICAgICogdG8gMS4wIGZvciBlYWNoIGNvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZGVwdGg9MV0gLSBUaGUgZGVwdGggdmFsdWUgdG8gY2xlYXIgdGhlIGRlcHRoIGJ1ZmZlciB0byBpbiB0aGVcbiAgICAgKiByYW5nZSAwLjAgdG8gMS4wLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mbGFnc10gLSBUaGUgYnVmZmVycyB0byBjbGVhciAodGhlIHR5cGVzIGJlaW5nIGNvbG9yLCBkZXB0aCBhbmRcbiAgICAgKiBzdGVuY2lsKS4gQ2FuIGJlIGFueSBiaXR3aXNlIGNvbWJpbmF0aW9uIG9mOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQ0xFQVJGTEFHX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIENMRUFSRkxBR19ERVBUSH1cbiAgICAgKiAtIHtAbGluayBDTEVBUkZMQUdfU1RFTkNJTH1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdGVuY2lsPTBdIC0gVGhlIHN0ZW5jaWwgdmFsdWUgdG8gY2xlYXIgdGhlIHN0ZW5jaWwgYnVmZmVyIHRvLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ2xlYXIgY29sb3IgYnVmZmVyIHRvIGJsYWNrIGFuZCBkZXB0aCBidWZmZXIgdG8gMS4wXG4gICAgICogZGV2aWNlLmNsZWFyKCk7XG4gICAgICpcbiAgICAgKiAvLyBDbGVhciBqdXN0IHRoZSBjb2xvciBidWZmZXIgdG8gcmVkXG4gICAgICogZGV2aWNlLmNsZWFyKHtcbiAgICAgKiAgICAgY29sb3I6IFsxLCAwLCAwLCAxXSxcbiAgICAgKiAgICAgZmxhZ3M6IHBjLkNMRUFSRkxBR19DT0xPUlxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gQ2xlYXIgY29sb3IgYnVmZmVyIHRvIHllbGxvdyBhbmQgZGVwdGggdG8gMS4wXG4gICAgICogZGV2aWNlLmNsZWFyKHtcbiAgICAgKiAgICAgY29sb3I6IFsxLCAxLCAwLCAxXSxcbiAgICAgKiAgICAgZGVwdGg6IDEsXG4gICAgICogICAgIGZsYWdzOiBwYy5DTEVBUkZMQUdfQ09MT1IgfCBwYy5DTEVBUkZMQUdfREVQVEhcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBjbGVhcihvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRPcHRpb25zID0gdGhpcy5kZWZhdWx0Q2xlYXJPcHRpb25zO1xuICAgICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCBkZWZhdWx0T3B0aW9ucztcblxuICAgICAgICBjb25zdCBmbGFncyA9IG9wdGlvbnMuZmxhZ3MgPz8gZGVmYXVsdE9wdGlvbnMuZmxhZ3M7XG4gICAgICAgIGlmIChmbGFncyAhPT0gMCkge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgICAgICAvLyBTZXQgdGhlIGNsZWFyIGNvbG9yXG4gICAgICAgICAgICBpZiAoZmxhZ3MgJiBDTEVBUkZMQUdfQ09MT1IpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2xvciA9IG9wdGlvbnMuY29sb3IgPz8gZGVmYXVsdE9wdGlvbnMuY29sb3I7XG4gICAgICAgICAgICAgICAgY29uc3QgciA9IGNvbG9yWzBdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGcgPSBjb2xvclsxXTtcbiAgICAgICAgICAgICAgICBjb25zdCBiID0gY29sb3JbMl07XG4gICAgICAgICAgICAgICAgY29uc3QgYSA9IGNvbG9yWzNdO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYyA9IHRoaXMuY2xlYXJDb2xvcjtcbiAgICAgICAgICAgICAgICBpZiAoKHIgIT09IGMucikgfHwgKGcgIT09IGMuZykgfHwgKGIgIT09IGMuYikgfHwgKGEgIT09IGMuYSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5nbC5jbGVhckNvbG9yKHIsIGcsIGIsIGEpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNsZWFyQ29sb3Iuc2V0KHIsIGcsIGIsIGEpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0QmxlbmRTdGF0ZShCbGVuZFN0YXRlLkRFRkFVTFQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmxhZ3MgJiBDTEVBUkZMQUdfREVQVEgpIHtcbiAgICAgICAgICAgICAgICAvLyBTZXQgdGhlIGNsZWFyIGRlcHRoXG4gICAgICAgICAgICAgICAgY29uc3QgZGVwdGggPSBvcHRpb25zLmRlcHRoID8/IGRlZmF1bHRPcHRpb25zLmRlcHRoO1xuXG4gICAgICAgICAgICAgICAgaWYgKGRlcHRoICE9PSB0aGlzLmNsZWFyRGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5nbC5jbGVhckRlcHRoKGRlcHRoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhckRlcHRoID0gZGVwdGg7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5zZXREZXB0aFN0YXRlKERlcHRoU3RhdGUuV1JJVEVERVBUSCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmbGFncyAmIENMRUFSRkxBR19TVEVOQ0lMKSB7XG4gICAgICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBzdGVuY2lsXG4gICAgICAgICAgICAgICAgY29uc3Qgc3RlbmNpbCA9IG9wdGlvbnMuc3RlbmNpbCA/PyBkZWZhdWx0T3B0aW9ucy5zdGVuY2lsO1xuICAgICAgICAgICAgICAgIGlmIChzdGVuY2lsICE9PSB0aGlzLmNsZWFyU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmNsZWFyU3RlbmNpbChzdGVuY2lsKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhclN0ZW5jaWwgPSBzdGVuY2lsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2xlYXIgdGhlIGZyYW1lIGJ1ZmZlclxuICAgICAgICAgICAgZ2wuY2xlYXIodGhpcy5nbENsZWFyRmxhZ1tmbGFnc10pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVhZHMgYSBibG9jayBvZiBwaXhlbHMgZnJvbSBhIHNwZWNpZmllZCByZWN0YW5nbGUgb2YgdGhlIGN1cnJlbnQgY29sb3IgZnJhbWVidWZmZXIgaW50byBhblxuICAgICAqIEFycmF5QnVmZmVyVmlldyBvYmplY3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4LWNvb3JkaW5hdGUgb2YgdGhlIHJlY3RhbmdsZSdzIGxvd2VyLWxlZnQgY29ybmVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHktY29vcmRpbmF0ZSBvZiB0aGUgcmVjdGFuZ2xlJ3MgbG93ZXItbGVmdCBjb3JuZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgd2lkdGggb2YgdGhlIHJlY3RhbmdsZSwgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlLCBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtBcnJheUJ1ZmZlclZpZXd9IHBpeGVscyAtIFRoZSBBcnJheUJ1ZmZlclZpZXcgb2JqZWN0IHRoYXQgaG9sZHMgdGhlIHJldHVybmVkIHBpeGVsXG4gICAgICogZGF0YS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVhZFBpeGVscyh4LCB5LCB3LCBoLCBwaXhlbHMpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICBnbC5yZWFkUGl4ZWxzKHgsIHksIHcsIGgsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIHBpeGVscyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvciBkaXNhYmxlcyBhbHBoYSB0byBjb3ZlcmFnZSAoV2ViR0wyIG9ubHkpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzdGF0ZSAtIFRydWUgdG8gZW5hYmxlIGFscGhhIHRvIGNvdmVyYWdlIGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRBbHBoYVRvQ292ZXJhZ2Uoc3RhdGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLndlYmdsMikgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5hbHBoYVRvQ292ZXJhZ2UgPT09IHN0YXRlKSByZXR1cm47XG4gICAgICAgIHRoaXMuYWxwaGFUb0NvdmVyYWdlID0gc3RhdGU7XG5cbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5TQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgb3V0cHV0IHZlcnRleCBidWZmZXIuIEl0IHdpbGwgYmUgd3JpdHRlbiB0byBieSBhIHNoYWRlciB3aXRoIHRyYW5zZm9ybSBmZWVkYmFja1xuICAgICAqIHZhcnlpbmdzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3ZlcnRleC1idWZmZXIuanMnKS5WZXJ0ZXhCdWZmZXJ9IHRmIC0gVGhlIG91dHB1dCB2ZXJ0ZXggYnVmZmVyLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUcmFuc2Zvcm1GZWVkYmFja0J1ZmZlcih0Zikge1xuICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciA9PT0gdGYpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciA9IHRmO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgaWYgKHRmKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmZlZWRiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmVlZGJhY2sgPSBnbC5jcmVhdGVUcmFuc2Zvcm1GZWVkYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBnbC5iaW5kVHJhbnNmb3JtRmVlZGJhY2soZ2wuVFJBTlNGT1JNX0ZFRURCQUNLLCB0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuYmluZFRyYW5zZm9ybUZlZWRiYWNrKGdsLlRSQU5TRk9STV9GRUVEQkFDSywgbnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIHRoZSByYXN0ZXJpemF0aW9uIHJlbmRlciBzdGF0ZS4gVXNlZnVsIHdpdGggdHJhbnNmb3JtIGZlZWRiYWNrLCB3aGVuIHlvdSBvbmx5IG5lZWRcbiAgICAgKiB0byBwcm9jZXNzIHRoZSBkYXRhIHdpdGhvdXQgZHJhd2luZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb24gLSBUcnVlIHRvIGVuYWJsZSByYXN0ZXJpemF0aW9uIGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRSYXN0ZXIob24pIHtcbiAgICAgICAgaWYgKHRoaXMucmFzdGVyID09PSBvbikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMucmFzdGVyID0gb247XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICBpZiAob24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5SQVNURVJJWkVSX0RJU0NBUkQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlJBU1RFUklaRVJfRElTQ0FSRCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIHRoZSBwb2x5Z29uIG9mZnNldCByZW5kZXIgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9uIC0gVHJ1ZSB0byBlbmFibGUgcG9seWdvbiBvZmZzZXQgYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldERlcHRoQmlhcyhvbikge1xuICAgICAgICBpZiAodGhpcy5kZXB0aEJpYXNFbmFibGVkID09PSBvbikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuZGVwdGhCaWFzRW5hYmxlZCA9IG9uO1xuXG4gICAgICAgIGlmIChvbikge1xuICAgICAgICAgICAgdGhpcy5nbC5lbmFibGUodGhpcy5nbC5QT0xZR09OX09GRlNFVF9GSUxMKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHRoZSBzY2FsZSBmYWN0b3IgYW5kIHVuaXRzIHRvIGNhbGN1bGF0ZSBkZXB0aCB2YWx1ZXMuIFRoZSBvZmZzZXQgaXMgYWRkZWQgYmVmb3JlXG4gICAgICogdGhlIGRlcHRoIHRlc3QgaXMgcGVyZm9ybWVkIGFuZCBiZWZvcmUgdGhlIHZhbHVlIGlzIHdyaXR0ZW4gaW50byB0aGUgZGVwdGggYnVmZmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNvbnN0QmlhcyAtIFRoZSBtdWx0aXBsaWVyIGJ5IHdoaWNoIGFuIGltcGxlbWVudGF0aW9uLXNwZWNpZmljIHZhbHVlIGlzXG4gICAgICogbXVsdGlwbGllZCB3aXRoIHRvIGNyZWF0ZSBhIGNvbnN0YW50IGRlcHRoIG9mZnNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2xvcGVCaWFzIC0gVGhlIHNjYWxlIGZhY3RvciBmb3IgdGhlIHZhcmlhYmxlIGRlcHRoIG9mZnNldCBmb3IgZWFjaCBwb2x5Z29uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXREZXB0aEJpYXNWYWx1ZXMoY29uc3RCaWFzLCBzbG9wZUJpYXMpIHtcbiAgICAgICAgdGhpcy5nbC5wb2x5Z29uT2Zmc2V0KHNsb3BlQmlhcywgY29uc3RCaWFzKTtcbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsVGVzdChlbmFibGUpIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbCAhPT0gZW5hYmxlKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBpZiAoZW5hYmxlKSB7XG4gICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLlNURU5DSUxfVEVTVCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuU1RFTkNJTF9URVNUKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbCA9IGVuYWJsZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFN0ZW5jaWxGdW5jKGZ1bmMsIHJlZiwgbWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRnVuY0Zyb250ICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkZyb250ICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0Zyb250ICE9PSBtYXNrIHx8XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jQmFjayAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZCYWNrICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0JhY2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbEZ1bmModGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgPSB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHRoaXMuc3RlbmNpbFJlZkJhY2sgPSByZWY7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgPSB0aGlzLnN0ZW5jaWxNYXNrQmFjayA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsRnVuY0Zyb250KGZ1bmMsIHJlZiwgbWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRnVuY0Zyb250ICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkZyb250ICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0Zyb250ICE9PSBtYXNrKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5zdGVuY2lsRnVuY1NlcGFyYXRlKGdsLkZST05ULCB0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSwgcmVmLCBtYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHJlZjtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsRnVuY0JhY2soZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGdW5jQmFjayAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZCYWNrICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0JhY2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jU2VwYXJhdGUoZ2wuQkFDSywgdGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZCYWNrID0gcmVmO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsTWFza0JhY2sgPSBtYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U3RlbmNpbE9wZXJhdGlvbihmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRmFpbEZyb250ICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgIT09IHpwYXNzIHx8XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wKHRoaXMuZ2xTdGVuY2lsT3BbZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbemZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pwYXNzXSk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IGZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ID0gdGhpcy5zdGVuY2lsWnBhc3NCYWNrID0genBhc3M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ICE9PSB3cml0ZU1hc2sgfHwgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrKHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IHdyaXRlTWFzaztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgPSB3cml0ZU1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQoZmFpbCwgemZhaWwsIHpwYXNzLCB3cml0ZU1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZhaWxGcm9udCAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ICE9PSB6ZmFpbCB8fCB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ICE9PSB6cGFzcykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsT3BTZXBhcmF0ZSh0aGlzLmdsLkZST05ULCB0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEZyb250ID0gZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgPSB6ZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgIT09IHdyaXRlTWFzaykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsTWFza1NlcGFyYXRlKHRoaXMuZ2wuRlJPTlQsIHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFN0ZW5jaWxPcGVyYXRpb25CYWNrKGZhaWwsIHpmYWlsLCB6cGFzcywgd3JpdGVNYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEJhY2sgPSBmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB3cml0ZU1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEJsZW5kU3RhdGUoYmxlbmRTdGF0ZSkge1xuICAgICAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICAgICAgaWYgKCFjdXJyZW50QmxlbmRTdGF0ZS5lcXVhbHMoYmxlbmRTdGF0ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gc3RhdGUgdmFsdWVzIHRvIHNldFxuICAgICAgICAgICAgY29uc3QgeyBibGVuZCwgY29sb3JPcCwgYWxwaGFPcCwgY29sb3JTcmNGYWN0b3IsIGNvbG9yRHN0RmFjdG9yLCBhbHBoYVNyY0ZhY3RvciwgYWxwaGFEc3RGYWN0b3IgfSA9IGJsZW5kU3RhdGU7XG5cbiAgICAgICAgICAgIC8vIGVuYWJsZSBibGVuZFxuICAgICAgICAgICAgaWYgKGN1cnJlbnRCbGVuZFN0YXRlLmJsZW5kICE9PSBibGVuZCkge1xuICAgICAgICAgICAgICAgIGlmIChibGVuZCkge1xuICAgICAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYmxlbmQgb3BzXG4gICAgICAgICAgICBpZiAoY3VycmVudEJsZW5kU3RhdGUuY29sb3JPcCAhPT0gY29sb3JPcCB8fCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYU9wICE9PSBhbHBoYU9wKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2xCbGVuZEVxdWF0aW9uID0gdGhpcy5nbEJsZW5kRXF1YXRpb247XG4gICAgICAgICAgICAgICAgZ2wuYmxlbmRFcXVhdGlvblNlcGFyYXRlKGdsQmxlbmRFcXVhdGlvbltjb2xvck9wXSwgZ2xCbGVuZEVxdWF0aW9uW2FscGhhT3BdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYmxlbmQgZmFjdG9yc1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yU3JjRmFjdG9yICE9PSBjb2xvclNyY0ZhY3RvciB8fCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvckRzdEZhY3RvciAhPT0gY29sb3JEc3RGYWN0b3IgfHxcbiAgICAgICAgICAgICAgICBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYVNyY0ZhY3RvciAhPT0gYWxwaGFTcmNGYWN0b3IgfHwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFEc3RGYWN0b3IgIT09IGFscGhhRHN0RmFjdG9yKSB7XG5cbiAgICAgICAgICAgICAgICBnbC5ibGVuZEZ1bmNTZXBhcmF0ZSh0aGlzLmdsQmxlbmRGdW5jdGlvbkNvbG9yW2NvbG9yU3JjRmFjdG9yXSwgdGhpcy5nbEJsZW5kRnVuY3Rpb25Db2xvcltjb2xvckRzdEZhY3Rvcl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb25BbHBoYVthbHBoYVNyY0ZhY3Rvcl0sIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uQWxwaGFbYWxwaGFEc3RGYWN0b3JdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY29sb3Igd3JpdGVcbiAgICAgICAgICAgIGlmIChjdXJyZW50QmxlbmRTdGF0ZS5hbGxXcml0ZSAhPT0gYmxlbmRTdGF0ZS5hbGxXcml0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuY29sb3JNYXNrKGJsZW5kU3RhdGUucmVkV3JpdGUsIGJsZW5kU3RhdGUuZ3JlZW5Xcml0ZSwgYmxlbmRTdGF0ZS5ibHVlV3JpdGUsIGJsZW5kU3RhdGUuYWxwaGFXcml0ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBpbnRlcm5hbCBzdGF0ZVxuICAgICAgICAgICAgY3VycmVudEJsZW5kU3RhdGUuY29weShibGVuZFN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBibGVuZGluZyBmYWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBUaGUgcmVkIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBUaGUgZ3JlZW4gY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIFRoZSBibHVlIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBUaGUgYWxwaGEgY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0QmxlbmRDb2xvcihyLCBnLCBiLCBhKSB7XG4gICAgICAgIGNvbnN0IGMgPSB0aGlzLmJsZW5kQ29sb3I7XG4gICAgICAgIGlmICgociAhPT0gYy5yKSB8fCAoZyAhPT0gYy5nKSB8fCAoYiAhPT0gYy5iKSB8fCAoYSAhPT0gYy5hKSkge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZENvbG9yKHIsIGcsIGIsIGEpO1xuICAgICAgICAgICAgYy5zZXQociwgZywgYiwgYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsU3RhdGUoc3RlbmNpbEZyb250LCBzdGVuY2lsQmFjaykge1xuICAgICAgICBpZiAoc3RlbmNpbEZyb250IHx8IHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICB0aGlzLnNldFN0ZW5jaWxUZXN0KHRydWUpO1xuICAgICAgICAgICAgaWYgKHN0ZW5jaWxGcm9udCA9PT0gc3RlbmNpbEJhY2spIHtcblxuICAgICAgICAgICAgICAgIC8vIGlkZW50aWNhbCBmcm9udC9iYWNrIHN0ZW5jaWxcbiAgICAgICAgICAgICAgICB0aGlzLnNldFN0ZW5jaWxGdW5jKHN0ZW5jaWxGcm9udC5mdW5jLCBzdGVuY2lsRnJvbnQucmVmLCBzdGVuY2lsRnJvbnQucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U3RlbmNpbE9wZXJhdGlvbihzdGVuY2lsRnJvbnQuZmFpbCwgc3RlbmNpbEZyb250LnpmYWlsLCBzdGVuY2lsRnJvbnQuenBhc3MsIHN0ZW5jaWxGcm9udC53cml0ZU1hc2spO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gZnJvbnRcbiAgICAgICAgICAgICAgICBzdGVuY2lsRnJvbnQgPz89IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQ7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGVuY2lsRnVuY0Zyb250KHN0ZW5jaWxGcm9udC5mdW5jLCBzdGVuY2lsRnJvbnQucmVmLCBzdGVuY2lsRnJvbnQucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U3RlbmNpbE9wZXJhdGlvbkZyb250KHN0ZW5jaWxGcm9udC5mYWlsLCBzdGVuY2lsRnJvbnQuemZhaWwsIHN0ZW5jaWxGcm9udC56cGFzcywgc3RlbmNpbEZyb250LndyaXRlTWFzayk7XG5cbiAgICAgICAgICAgICAgICAvLyBiYWNrXG4gICAgICAgICAgICAgICAgc3RlbmNpbEJhY2sgPz89IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQ7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGVuY2lsRnVuY0JhY2soc3RlbmNpbEJhY2suZnVuYywgc3RlbmNpbEJhY2sucmVmLCBzdGVuY2lsQmFjay5yZWFkTWFzayk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGVuY2lsT3BlcmF0aW9uQmFjayhzdGVuY2lsQmFjay5mYWlsLCBzdGVuY2lsQmFjay56ZmFpbCwgc3RlbmNpbEJhY2suenBhc3MsIHN0ZW5jaWxCYWNrLndyaXRlTWFzayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldFN0ZW5jaWxUZXN0KGZhbHNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldERlcHRoU3RhdGUoZGVwdGhTdGF0ZSkge1xuICAgICAgICBjb25zdCBjdXJyZW50RGVwdGhTdGF0ZSA9IHRoaXMuZGVwdGhTdGF0ZTtcbiAgICAgICAgaWYgKCFjdXJyZW50RGVwdGhTdGF0ZS5lcXVhbHMoZGVwdGhTdGF0ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gd3JpdGVcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlID0gZGVwdGhTdGF0ZS53cml0ZTtcbiAgICAgICAgICAgIGlmIChjdXJyZW50RGVwdGhTdGF0ZS53cml0ZSAhPT0gd3JpdGUpIHtcbiAgICAgICAgICAgICAgICBnbC5kZXB0aE1hc2sod3JpdGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBoYW5kbGUgY2FzZSB3aGVyZSBkZXB0aCB0ZXN0aW5nIGlzIG9mZiwgYnV0IGRlcHRoIHdyaXRlIGlzIG9uID0+IGVuYWJsZSBhbHdheXMgdGVzdCB0byBkZXB0aCB3cml0ZVxuICAgICAgICAgICAgLy8gTm90ZSBvbiBXZWJHTCBBUEkgYmVoYXZpb3I6IFdoZW4gZGVwdGggdGVzdGluZyBpcyBkaXNhYmxlZCwgd3JpdGVzIHRvIHRoZSBkZXB0aCBidWZmZXIgYXJlIGFsc28gZGlzYWJsZWQuXG4gICAgICAgICAgICBsZXQgeyBmdW5jLCB0ZXN0IH0gPSBkZXB0aFN0YXRlO1xuICAgICAgICAgICAgaWYgKCF0ZXN0ICYmIHdyaXRlKSB7XG4gICAgICAgICAgICAgICAgdGVzdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgZnVuYyA9IEZVTkNfQUxXQVlTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY3VycmVudERlcHRoU3RhdGUuZnVuYyAhPT0gZnVuYykge1xuICAgICAgICAgICAgICAgIGdsLmRlcHRoRnVuYyh0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjdXJyZW50RGVwdGhTdGF0ZS50ZXN0ICE9PSB0ZXN0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB1cGRhdGUgaW50ZXJuYWwgc3RhdGVcbiAgICAgICAgICAgIGN1cnJlbnREZXB0aFN0YXRlLmNvcHkoZGVwdGhTdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDdWxsTW9kZShjdWxsTW9kZSkge1xuICAgICAgICBpZiAodGhpcy5jdWxsTW9kZSAhPT0gY3VsbE1vZGUpIHtcbiAgICAgICAgICAgIGlmIChjdWxsTW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLkNVTExfRkFDRSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1bGxNb2RlID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuQ1VMTF9GQUNFKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlID0gdGhpcy5nbEN1bGxbY3VsbE1vZGVdO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1bGxGYWNlICE9PSBtb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuY3VsbEZhY2UobW9kZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VsbEZhY2UgPSBtb2RlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VsbE1vZGUgPSBjdWxsTW9kZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGFjdGl2ZSBzaGFkZXIgdG8gYmUgdXNlZCBkdXJpbmcgc3Vic2VxdWVudCBkcmF3IGNhbGxzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gc2V0IHRvIGFzc2lnbiB0byB0aGUgZGV2aWNlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzaGFkZXIgd2FzIHN1Y2Nlc3NmdWxseSBzZXQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZXRTaGFkZXIoc2hhZGVyKSB7XG4gICAgICAgIGlmIChzaGFkZXIgIT09IHRoaXMuc2hhZGVyKSB7XG4gICAgICAgICAgICBpZiAoc2hhZGVyLmZhaWxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXNoYWRlci5yZWFkeSAmJiAhc2hhZGVyLmltcGwuZmluYWxpemUodGhpcywgc2hhZGVyKSkge1xuICAgICAgICAgICAgICAgIHNoYWRlci5mYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zaGFkZXIgPSBzaGFkZXI7XG5cbiAgICAgICAgICAgIC8vIFNldCB0aGUgYWN0aXZlIHNoYWRlclxuICAgICAgICAgICAgdGhpcy5nbC51c2VQcm9ncmFtKHNoYWRlci5pbXBsLmdsUHJvZ3JhbSk7XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUrKztcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNJbnZhbGlkYXRlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgc3VwcG9ydGVkIEhEUiBwaXhlbCBmb3JtYXQgZ2l2ZW4gYSBzZXQgb2YgaGFyZHdhcmUgc3VwcG9ydCByZXF1aXJlbWVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByZWZlckxhcmdlc3QgLSBJZiB0cnVlLCBwcmVmZXIgdGhlIGhpZ2hlc3QgcHJlY2lzaW9uIGZvcm1hdC4gT3RoZXJ3aXNlIHByZWZlciB0aGUgbG93ZXN0IHByZWNpc2lvbiBmb3JtYXQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSByZW5kZXJhYmxlIC0gSWYgdHJ1ZSwgb25seSBpbmNsdWRlIHBpeGVsIGZvcm1hdHMgdGhhdCBjYW4gYmUgdXNlZCBhcyByZW5kZXIgdGFyZ2V0cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHVwZGF0YWJsZSAtIElmIHRydWUsIG9ubHkgaW5jbHVkZSBmb3JtYXRzIHRoYXQgY2FuIGJlIHVwZGF0ZWQgYnkgdGhlIENQVS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZpbHRlcmFibGUgLSBJZiB0cnVlLCBvbmx5IGluY2x1ZGUgZm9ybWF0cyB0aGF0IHN1cHBvcnQgdGV4dHVyZSBmaWx0ZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgSERSIHBpeGVsIGZvcm1hdCBvciBudWxsIGlmIHRoZXJlIGFyZSBub25lLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRIZHJGb3JtYXQocHJlZmVyTGFyZ2VzdCwgcmVuZGVyYWJsZSwgdXBkYXRhYmxlLCBmaWx0ZXJhYmxlKSB7XG4gICAgICAgIC8vIE5vdGUgdGhhdCBmb3IgV2ViR0wyLCBQSVhFTEZPUk1BVF9SR0IxNkYgYW5kIFBJWEVMRk9STUFUX1JHQjMyRiBhcmUgbm90IHJlbmRlcmFibGUgYWNjb3JkaW5nIHRvIHRoaXM6XG4gICAgICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9FWFRfY29sb3JfYnVmZmVyX2Zsb2F0XG4gICAgICAgIC8vIEZvciBXZWJHTDEsIG9ubHkgUElYRUxGT1JNQVRfUkdCQTE2RiBhbmQgUElYRUxGT1JNQVRfUkdCQTMyRiBhcmUgdGVzdGVkIGZvciBiZWluZyByZW5kZXJhYmxlLlxuICAgICAgICBjb25zdCBmMTZWYWxpZCA9IHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCAmJlxuICAgICAgICAgICAgKCFyZW5kZXJhYmxlIHx8IHRoaXMudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUpICYmXG4gICAgICAgICAgICAoIXVwZGF0YWJsZSB8fCB0aGlzLnRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUpICYmXG4gICAgICAgICAgICAoIWZpbHRlcmFibGUgfHwgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyKTtcbiAgICAgICAgY29uc3QgZjMyVmFsaWQgPSB0aGlzLmV4dFRleHR1cmVGbG9hdCAmJlxuICAgICAgICAgICAgKCFyZW5kZXJhYmxlIHx8IHRoaXMudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSkgJiZcbiAgICAgICAgICAgICghZmlsdGVyYWJsZSB8fCB0aGlzLmV4dFRleHR1cmVGbG9hdExpbmVhcik7XG5cbiAgICAgICAgaWYgKGYxNlZhbGlkICYmIGYzMlZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZmVyTGFyZ2VzdCA/IFBJWEVMRk9STUFUX1JHQkEzMkYgOiBQSVhFTEZPUk1BVF9SR0JBMTZGO1xuICAgICAgICB9IGVsc2UgaWYgKGYxNlZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmIChmMzJWYWxpZCkge1xuICAgICAgICAgICAgcmV0dXJuIFBJWEVMRk9STUFUX1JHQkEzMkY7XG4gICAgICAgIH0gLyogZWxzZSAqL1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyBtZW1vcnkgZnJvbSBhbGwgdmVydGV4IGFycmF5IG9iamVjdHMgZXZlciBhbGxvY2F0ZWQgd2l0aCB0aGlzIGRldmljZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjbGVhclZlcnRleEFycmF5T2JqZWN0Q2FjaGUoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgdGhpcy5fdmFvTWFwLmZvckVhY2goKGl0ZW0sIGtleSwgbWFwT2JqKSA9PiB7XG4gICAgICAgICAgICBnbC5kZWxldGVWZXJ0ZXhBcnJheShpdGVtKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5fdmFvTWFwLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgcmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpIHtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgcmF0aW8gPSBNYXRoLm1pbih0aGlzLl9tYXhQaXhlbFJhdGlvLCBwbGF0Zm9ybS5icm93c2VyID8gd2luZG93LmRldmljZVBpeGVsUmF0aW8gOiAxKTtcbiAgICAgICAgd2lkdGggPSBNYXRoLmZsb29yKHdpZHRoICogcmF0aW8pO1xuICAgICAgICBoZWlnaHQgPSBNYXRoLmZsb29yKGhlaWdodCAqIHJhdGlvKTtcblxuICAgICAgICBpZiAodGhpcy5jYW52YXMud2lkdGggIT09IHdpZHRoIHx8IHRoaXMuY2FudmFzLmhlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLmNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgICAgICAgdGhpcy5jYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgdGhpcy5maXJlKEdyYXBoaWNzRGV2aWNlLkVWRU5UX1JFU0laRSwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaWR0aCBvZiB0aGUgYmFjayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdsLmRyYXdpbmdCdWZmZXJXaWR0aCB8fCB0aGlzLmNhbnZhcy53aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIZWlnaHQgb2YgdGhlIGJhY2sgYnVmZmVyIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGhlaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2wuZHJhd2luZ0J1ZmZlckhlaWdodCB8fCB0aGlzLmNhbnZhcy5oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnVsbHNjcmVlbiBtb2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZ1bGxzY3JlZW4oZnVsbHNjcmVlbikge1xuICAgICAgICBpZiAoZnVsbHNjcmVlbikge1xuICAgICAgICAgICAgY29uc3QgY2FudmFzID0gdGhpcy5nbC5jYW52YXM7XG4gICAgICAgICAgICBjYW52YXMucmVxdWVzdEZ1bGxzY3JlZW4oKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmV4aXRGdWxsc2NyZWVuKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZnVsbHNjcmVlbigpIHtcbiAgICAgICAgcmV0dXJuICEhZG9jdW1lbnQuZnVsbHNjcmVlbkVsZW1lbnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgaGlnaCBwcmVjaXNpb24gZmxvYXRpbmctcG9pbnQgdGV4dHVyZXMgYXJlIHN1cHBvcnRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB0ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID0gdGVzdFRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24odGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgdGV4dHVyZSB3aXRoIGhhbGYgZmxvYXQgZm9ybWF0IGNhbiBiZSB1cGRhdGVkIHdpdGggZGF0YS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB0ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlKCkge1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9IHRlc3RUZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlKHRoaXMuZ2wsIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdC5IQUxGX0ZMT0FUX09FUyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGU7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJnbEdyYXBoaWNzRGV2aWNlIH07XG4iXSwibmFtZXMiOlsiaW52YWxpZGF0ZUF0dGFjaG1lbnRzIiwiX2Z1bGxTY3JlZW5RdWFkVlMiLCJfcHJlY2lzaW9uVGVzdDFQUyIsIl9wcmVjaXNpb25UZXN0MlBTIiwiX291dHB1dFRleHR1cmUyRCIsInF1YWRXaXRoU2hhZGVyIiwiZGV2aWNlIiwidGFyZ2V0Iiwic2hhZGVyIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJvbGRSdCIsInJlbmRlclRhcmdldCIsInNldFJlbmRlclRhcmdldCIsInVwZGF0ZUJlZ2luIiwic2V0Q3VsbE1vZGUiLCJDVUxMRkFDRV9OT05FIiwic2V0QmxlbmRTdGF0ZSIsIkJsZW5kU3RhdGUiLCJERUZBVUxUIiwic2V0RGVwdGhTdGF0ZSIsIkRlcHRoU3RhdGUiLCJOT0RFUFRIIiwic2V0U3RlbmNpbFN0YXRlIiwic2V0VmVydGV4QnVmZmVyIiwicXVhZFZlcnRleEJ1ZmZlciIsInNldFNoYWRlciIsImRyYXciLCJ0eXBlIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiYmFzZSIsImNvdW50IiwiaW5kZXhlZCIsInVwZGF0ZUVuZCIsInBvcEdwdU1hcmtlciIsInRlc3RSZW5kZXJhYmxlIiwiZ2wiLCJwaXhlbEZvcm1hdCIsInJlc3VsdCIsInRleHR1cmUiLCJjcmVhdGVUZXh0dXJlIiwiYmluZFRleHR1cmUiLCJURVhUVVJFXzJEIiwidGV4UGFyYW1ldGVyaSIsIlRFWFRVUkVfTUlOX0ZJTFRFUiIsIk5FQVJFU1QiLCJURVhUVVJFX01BR19GSUxURVIiLCJURVhUVVJFX1dSQVBfUyIsIkNMQU1QX1RPX0VER0UiLCJURVhUVVJFX1dSQVBfVCIsInRleEltYWdlMkQiLCJSR0JBIiwiZnJhbWVidWZmZXIiLCJjcmVhdGVGcmFtZWJ1ZmZlciIsImJpbmRGcmFtZWJ1ZmZlciIsIkZSQU1FQlVGRkVSIiwiZnJhbWVidWZmZXJUZXh0dXJlMkQiLCJDT0xPUl9BVFRBQ0hNRU5UMCIsImNoZWNrRnJhbWVidWZmZXJTdGF0dXMiLCJGUkFNRUJVRkZFUl9DT01QTEVURSIsImRlbGV0ZVRleHR1cmUiLCJkZWxldGVGcmFtZWJ1ZmZlciIsInRlc3RUZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlIiwiZGF0YSIsIlVpbnQxNkFycmF5IiwiZ2V0RXJyb3IiLCJOT19FUlJPUiIsImNvbnNvbGUiLCJsb2ciLCJ0ZXN0VGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJzaGFkZXIxIiwiU2hhZGVyIiwiU2hhZGVyVXRpbHMiLCJjcmVhdGVEZWZpbml0aW9uIiwibmFtZSIsInZlcnRleENvZGUiLCJmcmFnbWVudENvZGUiLCJzaGFkZXIyIiwidGV4dHVyZU9wdGlvbnMiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwid2lkdGgiLCJoZWlnaHQiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJ0ZXgxIiwiVGV4dHVyZSIsInRhcmcxIiwiUmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJkZXB0aCIsIlBJWEVMRk9STUFUX1JHQkE4IiwidGV4MiIsInRhcmcyIiwiY29uc3RhbnRUZXhTb3VyY2UiLCJzZXRWYWx1ZSIsInByZXZGcmFtZWJ1ZmZlciIsImFjdGl2ZUZyYW1lYnVmZmVyIiwic2V0RnJhbWVidWZmZXIiLCJpbXBsIiwiX2dsRnJhbWVCdWZmZXIiLCJwaXhlbHMiLCJVaW50OEFycmF5IiwicmVhZFBpeGVscyIsIngiLCJ5IiwieiIsInciLCJmIiwiZGVzdHJveSIsIldlYmdsR3JhcGhpY3NEZXZpY2UiLCJHcmFwaGljc0RldmljZSIsImNvbnN0cnVjdG9yIiwiY2FudmFzIiwib3B0aW9ucyIsIndlYmdsMiIsImluaXRPcHRpb25zIiwiZGVmYXVsdEZyYW1lYnVmZmVyIiwidXBkYXRlQ2xpZW50UmVjdCIsImNvbnRleHRMb3N0IiwiX2NvbnRleHRMb3N0SGFuZGxlciIsImV2ZW50IiwicHJldmVudERlZmF1bHQiLCJsb3NlQ29udGV4dCIsIkRlYnVnIiwiZmlyZSIsIl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyIiwicmVzdG9yZUNvbnRleHQiLCJ1YSIsIm5hdmlnYXRvciIsInVzZXJBZ2VudCIsImZvcmNlRGlzYWJsZU11bHRpc2FtcGxpbmciLCJpbmNsdWRlcyIsImFudGlhbGlhcyIsInByZWZlcldlYkdsMiIsInVuZGVmaW5lZCIsIm5hbWVzIiwiaSIsImxlbmd0aCIsImdldENvbnRleHQiLCJFcnJvciIsIldlYkdMMlJlbmRlcmluZ0NvbnRleHQiLCJfZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR0wyIiwiREVWSUNFVFlQRV9XRUJHTDEiLCJhbHBoYUJpdHMiLCJnZXRQYXJhbWV0ZXIiLCJBTFBIQV9CSVRTIiwiZnJhbWVidWZmZXJGb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0I4IiwiaXNDaHJvbWUiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJ3aW5kb3ciLCJjaHJvbWUiLCJpc1NhZmFyaSIsInNhZmFyaSIsImlzTWFjIiwiYXBwVmVyc2lvbiIsImluZGV4T2YiLCJfdGVtcEVuYWJsZVNhZmFyaVRleHR1cmVVbml0V29ya2Fyb3VuZCIsIl90ZW1wTWFjQ2hyb21lQmxpdEZyYW1lYnVmZmVyV29ya2Fyb3VuZCIsImFscGhhIiwic2V0dXBWZXJ0ZXhBcnJheU9iamVjdCIsImFkZEV2ZW50TGlzdGVuZXIiLCJpbml0aWFsaXplRXh0ZW5zaW9ucyIsImluaXRpYWxpemVDYXBhYmlsaXRpZXMiLCJpbml0aWFsaXplUmVuZGVyU3RhdGUiLCJpbml0aWFsaXplQ29udGV4dENhY2hlcyIsInN1cHBvcnRzSW1hZ2VCaXRtYXAiLCJJbWFnZUJpdG1hcCIsImdsQWRkcmVzcyIsIlJFUEVBVCIsIk1JUlJPUkVEX1JFUEVBVCIsImdsQmxlbmRFcXVhdGlvbiIsIkZVTkNfQUREIiwiRlVOQ19TVUJUUkFDVCIsIkZVTkNfUkVWRVJTRV9TVUJUUkFDVCIsIk1JTiIsImV4dEJsZW5kTWlubWF4IiwiTUlOX0VYVCIsIk1BWCIsIk1BWF9FWFQiLCJnbEJsZW5kRnVuY3Rpb25Db2xvciIsIlpFUk8iLCJPTkUiLCJTUkNfQ09MT1IiLCJPTkVfTUlOVVNfU1JDX0NPTE9SIiwiRFNUX0NPTE9SIiwiT05FX01JTlVTX0RTVF9DT0xPUiIsIlNSQ19BTFBIQSIsIlNSQ19BTFBIQV9TQVRVUkFURSIsIk9ORV9NSU5VU19TUkNfQUxQSEEiLCJEU1RfQUxQSEEiLCJPTkVfTUlOVVNfRFNUX0FMUEhBIiwiQ09OU1RBTlRfQ09MT1IiLCJPTkVfTUlOVVNfQ09OU1RBTlRfQ09MT1IiLCJnbEJsZW5kRnVuY3Rpb25BbHBoYSIsIkNPTlNUQU5UX0FMUEhBIiwiT05FX01JTlVTX0NPTlNUQU5UX0FMUEhBIiwiZ2xDb21wYXJpc29uIiwiTkVWRVIiLCJMRVNTIiwiRVFVQUwiLCJMRVFVQUwiLCJHUkVBVEVSIiwiTk9URVFVQUwiLCJHRVFVQUwiLCJBTFdBWVMiLCJnbFN0ZW5jaWxPcCIsIktFRVAiLCJSRVBMQUNFIiwiSU5DUiIsIklOQ1JfV1JBUCIsIkRFQ1IiLCJERUNSX1dSQVAiLCJJTlZFUlQiLCJnbENsZWFyRmxhZyIsIkNPTE9SX0JVRkZFUl9CSVQiLCJERVBUSF9CVUZGRVJfQklUIiwiU1RFTkNJTF9CVUZGRVJfQklUIiwiZ2xDdWxsIiwiQkFDSyIsIkZST05UIiwiRlJPTlRfQU5EX0JBQ0siLCJnbEZpbHRlciIsIkxJTkVBUiIsIk5FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJMSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJMSU5FQVJfTUlQTUFQX0xJTkVBUiIsImdsUHJpbWl0aXZlIiwiUE9JTlRTIiwiTElORVMiLCJMSU5FX0xPT1AiLCJMSU5FX1NUUklQIiwiVFJJQU5HTEVTIiwiVFJJQU5HTEVfU1RSSVAiLCJUUklBTkdMRV9GQU4iLCJnbFR5cGUiLCJCWVRFIiwiVU5TSUdORURfQllURSIsIlNIT1JUIiwiVU5TSUdORURfU0hPUlQiLCJJTlQiLCJVTlNJR05FRF9JTlQiLCJGTE9BVCIsInBjVW5pZm9ybVR5cGUiLCJCT09MIiwiVU5JRk9STVRZUEVfQk9PTCIsIlVOSUZPUk1UWVBFX0lOVCIsIlVOSUZPUk1UWVBFX0ZMT0FUIiwiRkxPQVRfVkVDMiIsIlVOSUZPUk1UWVBFX1ZFQzIiLCJGTE9BVF9WRUMzIiwiVU5JRk9STVRZUEVfVkVDMyIsIkZMT0FUX1ZFQzQiLCJVTklGT1JNVFlQRV9WRUM0IiwiSU5UX1ZFQzIiLCJVTklGT1JNVFlQRV9JVkVDMiIsIklOVF9WRUMzIiwiVU5JRk9STVRZUEVfSVZFQzMiLCJJTlRfVkVDNCIsIlVOSUZPUk1UWVBFX0lWRUM0IiwiQk9PTF9WRUMyIiwiVU5JRk9STVRZUEVfQlZFQzIiLCJCT09MX1ZFQzMiLCJVTklGT1JNVFlQRV9CVkVDMyIsIkJPT0xfVkVDNCIsIlVOSUZPUk1UWVBFX0JWRUM0IiwiRkxPQVRfTUFUMiIsIlVOSUZPUk1UWVBFX01BVDIiLCJGTE9BVF9NQVQzIiwiVU5JRk9STVRZUEVfTUFUMyIsIkZMT0FUX01BVDQiLCJVTklGT1JNVFlQRV9NQVQ0IiwiU0FNUExFUl8yRCIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRCIsIlNBTVBMRVJfQ1VCRSIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFIiwiU0FNUExFUl8yRF9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFMkRfU0hBRE9XIiwiU0FNUExFUl9DVUJFX1NIQURPVyIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVyIsIlNBTVBMRVJfM0QiLCJVTklGT1JNVFlQRV9URVhUVVJFM0QiLCJ0YXJnZXRUb1Nsb3QiLCJURVhUVVJFX0NVQkVfTUFQIiwiVEVYVFVSRV8zRCIsInNjb3BlWCIsInNjb3BlWSIsInNjb3BlWiIsInNjb3BlVyIsInVuaWZvcm1WYWx1ZSIsImNvbW1pdEZ1bmN0aW9uIiwidW5pZm9ybSIsInZhbHVlIiwidW5pZm9ybTFpIiwibG9jYXRpb25JZCIsInVuaWZvcm0xZiIsInVuaWZvcm0yZnYiLCJ1bmlmb3JtM2Z2IiwidW5pZm9ybTRmdiIsInVuaWZvcm0yaXYiLCJ1bmlmb3JtM2l2IiwidW5pZm9ybTRpdiIsInVuaWZvcm1NYXRyaXgyZnYiLCJ1bmlmb3JtTWF0cml4M2Z2IiwidW5pZm9ybU1hdHJpeDRmdiIsIlVOSUZPUk1UWVBFX0ZMT0FUQVJSQVkiLCJ1bmlmb3JtMWZ2IiwiVU5JRk9STVRZUEVfVkVDMkFSUkFZIiwiVU5JRk9STVRZUEVfVkVDM0FSUkFZIiwiVU5JRk9STVRZUEVfVkVDNEFSUkFZIiwic3VwcG9ydHNCb25lVGV4dHVyZXMiLCJleHRUZXh0dXJlRmxvYXQiLCJtYXhWZXJ0ZXhUZXh0dXJlcyIsIm51bVVuaWZvcm1zIiwidmVydGV4VW5pZm9ybXNDb3VudCIsImJvbmVMaW1pdCIsIk1hdGgiLCJmbG9vciIsIm1pbiIsInVubWFza2VkUmVuZGVyZXIiLCJzY29wZSIsInJlc29sdmUiLCJleHRDb2xvckJ1ZmZlckZsb2F0IiwiZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsImV4dFRleHR1cmVIYWxmRmxvYXQiLCJIQUxGX0ZMT0FUX09FUyIsInN1cHBvcnRzTW9ycGhUYXJnZXRUZXh0dXJlc0NvcmUiLCJtYXhQcmVjaXNpb24iLCJzdXBwb3J0c0RlcHRoU2hhZG93IiwiX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iLCJfdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSIsImFyZWFMaWdodEx1dEZvcm1hdCIsInRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJleHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsImV4dFRleHR1cmVGbG9hdExpbmVhciIsInBvc3RJbml0IiwiZmVlZGJhY2siLCJkZWxldGVUcmFuc2Zvcm1GZWVkYmFjayIsImNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJwb3N0RGVzdHJveSIsImNyZWF0ZVZlcnRleEJ1ZmZlckltcGwiLCJ2ZXJ0ZXhCdWZmZXIiLCJXZWJnbFZlcnRleEJ1ZmZlciIsImNyZWF0ZUluZGV4QnVmZmVySW1wbCIsImluZGV4QnVmZmVyIiwiV2ViZ2xJbmRleEJ1ZmZlciIsImNyZWF0ZVNoYWRlckltcGwiLCJXZWJnbFNoYWRlciIsImNyZWF0ZVRleHR1cmVJbXBsIiwiV2ViZ2xUZXh0dXJlIiwiY3JlYXRlUmVuZGVyVGFyZ2V0SW1wbCIsIldlYmdsUmVuZGVyVGFyZ2V0IiwicHVzaE1hcmtlciIsInNwZWN0b3IiLCJsYWJlbCIsInRvU3RyaW5nIiwic2V0TWFya2VyIiwicG9wTWFya2VyIiwiY2xlYXJNYXJrZXIiLCJnZXRQcmVjaXNpb24iLCJwcmVjaXNpb24iLCJnZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQiLCJ2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0IiwiVkVSVEVYX1NIQURFUiIsIkhJR0hfRkxPQVQiLCJ2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQiLCJNRURJVU1fRkxPQVQiLCJmcmFnbWVudFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQiLCJGUkFHTUVOVF9TSEFERVIiLCJmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdCIsImhpZ2hwQXZhaWxhYmxlIiwibWVkaXVtcEF2YWlsYWJsZSIsIndhcm4iLCJnZXRFeHRlbnNpb24iLCJhcmd1bWVudHMiLCJzdXBwb3J0ZWRFeHRlbnNpb25zIiwiZXh0RGlzam9pbnRUaW1lclF1ZXJ5IiwiX2V4dERpc2pvaW50VGltZXJRdWVyeSIsImdldFN1cHBvcnRlZEV4dGVuc2lvbnMiLCJleHREcmF3QnVmZmVycyIsImV4dEluc3RhbmNpbmciLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwiZXh0VGV4dHVyZUxvZCIsImV4dFVpbnRFbGVtZW50IiwiZXh0VmVydGV4QXJyYXlPYmplY3QiLCJleHREZXB0aFRleHR1cmUiLCJleHQiLCJkcmF3QXJyYXlzSW5zdGFuY2VkIiwiZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFIiwiYmluZCIsImRyYXdFbGVtZW50c0luc3RhbmNlZCIsImRyYXdFbGVtZW50c0luc3RhbmNlZEFOR0xFIiwidmVydGV4QXR0cmliRGl2aXNvciIsInZlcnRleEF0dHJpYkRpdmlzb3JBTkdMRSIsImNyZWF0ZVZlcnRleEFycmF5IiwiY3JlYXRlVmVydGV4QXJyYXlPRVMiLCJkZWxldGVWZXJ0ZXhBcnJheSIsImRlbGV0ZVZlcnRleEFycmF5T0VTIiwiaXNWZXJ0ZXhBcnJheSIsImlzVmVydGV4QXJyYXlPRVMiLCJiaW5kVmVydGV4QXJyYXkiLCJiaW5kVmVydGV4QXJyYXlPRVMiLCJleHREZWJ1Z1JlbmRlcmVySW5mbyIsImV4dEZsb2F0QmxlbmQiLCJleHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQzEiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZVMzVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyIsImV4dFBhcmFsbGVsU2hhZGVyQ29tcGlsZSIsImNvbnRleHRBdHRyaWJzIiwiZ2V0Q29udGV4dEF0dHJpYnV0ZXMiLCJzdXBwb3J0c01zYWEiLCJzdXBwb3J0c1N0ZW5jaWwiLCJzdGVuY2lsIiwic3VwcG9ydHNJbnN0YW5jaW5nIiwibWF4VGV4dHVyZVNpemUiLCJNQVhfVEVYVFVSRV9TSVpFIiwibWF4Q3ViZU1hcFNpemUiLCJNQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFIiwibWF4UmVuZGVyQnVmZmVyU2l6ZSIsIk1BWF9SRU5ERVJCVUZGRVJfU0laRSIsIm1heFRleHR1cmVzIiwiTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJtYXhDb21iaW5lZFRleHR1cmVzIiwiTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJNQVhfVkVSVEVYX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJNQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyIsImZyYWdtZW50VW5pZm9ybXNDb3VudCIsIk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMiLCJtYXhEcmF3QnVmZmVycyIsIk1BWF9EUkFXX0JVRkZFUlMiLCJtYXhDb2xvckF0dGFjaG1lbnRzIiwiTUFYX0NPTE9SX0FUVEFDSE1FTlRTIiwibWF4Vm9sdW1lU2l6ZSIsIk1BWF8zRF9URVhUVVJFX1NJWkUiLCJNQVhfRFJBV19CVUZGRVJTX0VYVCIsIk1BWF9DT0xPUl9BVFRBQ0hNRU5UU19FWFQiLCJVTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCIsInVubWFza2VkVmVuZG9yIiwiVU5NQVNLRURfVkVORE9SX1dFQkdMIiwibWFsaVJlbmRlcmVyUmVnZXgiLCJzdXBwb3J0c0dwdVBhcnRpY2xlcyIsIm1hdGNoIiwibWF4QW5pc290cm9weSIsIk1BWF9URVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCIsInNhbXBsZXMiLCJTQU1QTEVTIiwibWF4U2FtcGxlcyIsIk1BWF9TQU1QTEVTIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwiYW5kcm9pZCIsInN1cHBvcnRzVGV4dHVyZUZldGNoIiwiZGlzYWJsZSIsIkJMRU5EIiwiYmxlbmRGdW5jIiwiYmxlbmRFcXVhdGlvbiIsImNvbG9yTWFzayIsImJsZW5kQ29sb3IiLCJDb2xvciIsImVuYWJsZSIsIkNVTExfRkFDRSIsImN1bGxGYWNlIiwiREVQVEhfVEVTVCIsImRlcHRoRnVuYyIsImRlcHRoTWFzayIsIlNURU5DSUxfVEVTVCIsInN0ZW5jaWxGdW5jRnJvbnQiLCJzdGVuY2lsRnVuY0JhY2siLCJGVU5DX0FMV0FZUyIsInN0ZW5jaWxSZWZGcm9udCIsInN0ZW5jaWxSZWZCYWNrIiwic3RlbmNpbE1hc2tGcm9udCIsInN0ZW5jaWxNYXNrQmFjayIsInN0ZW5jaWxGdW5jIiwic3RlbmNpbEZhaWxGcm9udCIsInN0ZW5jaWxGYWlsQmFjayIsIlNURU5DSUxPUF9LRUVQIiwic3RlbmNpbFpmYWlsRnJvbnQiLCJzdGVuY2lsWmZhaWxCYWNrIiwic3RlbmNpbFpwYXNzRnJvbnQiLCJzdGVuY2lsWnBhc3NCYWNrIiwic3RlbmNpbFdyaXRlTWFza0Zyb250Iiwic3RlbmNpbFdyaXRlTWFza0JhY2siLCJzdGVuY2lsT3AiLCJzdGVuY2lsTWFzayIsImFscGhhVG9Db3ZlcmFnZSIsInJhc3RlciIsIlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSIsIlJBU1RFUklaRVJfRElTQ0FSRCIsImRlcHRoQmlhc0VuYWJsZWQiLCJQT0xZR09OX09GRlNFVF9GSUxMIiwiY2xlYXJEZXB0aCIsImNsZWFyQ29sb3IiLCJjbGVhclN0ZW5jaWwiLCJoaW50IiwiRlJBR01FTlRfU0hBREVSX0RFUklWQVRJVkVfSElOVCIsIk5JQ0VTVCIsIkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlRfT0VTIiwiU0NJU1NPUl9URVNUIiwicGl4ZWxTdG9yZWkiLCJVTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OX1dFQkdMIiwiTk9ORSIsInVucGFja0ZsaXBZIiwiVU5QQUNLX0ZMSVBfWV9XRUJHTCIsInVucGFja1ByZW11bHRpcGx5QWxwaGEiLCJVTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wiLCJVTlBBQ0tfQUxJR05NRU5UIiwiX3Zhb01hcCIsIk1hcCIsImJvdW5kVmFvIiwidHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIiLCJ0ZXh0dXJlVW5pdCIsInRleHR1cmVVbml0cyIsInB1c2giLCJzaGFkZXJzIiwidGV4dHVyZXMiLCJidWZmZXIiLCJidWZmZXJzIiwidGFyZ2V0cyIsInVubG9jayIsImVuZFNoYWRlckJhdGNoIiwic2V0Vmlld3BvcnQiLCJoIiwidngiLCJ2eSIsInZ3IiwidmgiLCJ2aWV3cG9ydCIsInNldFNjaXNzb3IiLCJzeCIsInN5Iiwic3ciLCJzaCIsInNjaXNzb3IiLCJmYiIsImNvcHlSZW5kZXJUYXJnZXQiLCJzb3VyY2UiLCJkZXN0IiwiY29sb3IiLCJlcnJvciIsIl9jb2xvckJ1ZmZlciIsIl9mb3JtYXQiLCJfZGVwdGgiLCJfZGVwdGhCdWZmZXIiLCJwcmV2UnQiLCJSRUFEX0ZSQU1FQlVGRkVSIiwiRFJBV19GUkFNRUJVRkZFUiIsImJsaXRGcmFtZWJ1ZmZlciIsImdldENvcHlTaGFkZXIiLCJfY29weVNoYWRlciIsInN0YXJ0UGFzcyIsInJlbmRlclBhc3MiLCJjb2xvck9wcyIsImRlcHRoU3RlbmNpbE9wcyIsImNsZWFyIiwicnQiLCJjbGVhckZsYWdzIiwiY2xlYXJPcHRpb25zIiwiQ0xFQVJGTEFHX0NPTE9SIiwiY2xlYXJWYWx1ZSIsInIiLCJnIiwiYiIsImEiLCJDTEVBUkZMQUdfREVQVEgiLCJjbGVhckRlcHRoVmFsdWUiLCJDTEVBUkZMQUdfU1RFTkNJTCIsImNsZWFyU3RlbmNpbFZhbHVlIiwiZmxhZ3MiLCJjYWxsIiwiaW5zaWRlUmVuZGVyUGFzcyIsImVycm9yT25jZSIsImVuZFBhc3MiLCJ1bmJpbmRWZXJ0ZXhBcnJheSIsInN0b3JlIiwic3RvcmVEZXB0aCIsIkRFUFRIX0FUVEFDSE1FTlQiLCJzdG9yZVN0ZW5jaWwiLCJTVEVOQ0lMX0FUVEFDSE1FTlQiLCJmdWxsU2l6ZUNsZWFyUmVjdCIsImludmFsaWRhdGVGcmFtZWJ1ZmZlciIsImF1dG9SZXNvbHZlIiwiX2dsVGV4dHVyZSIsInBvdCIsImFjdGl2ZVRleHR1cmUiLCJnZW5lcmF0ZU1pcG1hcCIsIl9nbFRhcmdldCIsInVuaXQiLCJzbG90IiwiaW5pdGlhbGl6ZWQiLCJpbml0UmVuZGVyVGFyZ2V0IiwiX3NhbXBsZXMiLCJzZXRVbnBhY2tGbGlwWSIsImZsaXBZIiwic2V0VW5wYWNrUHJlbXVsdGlwbHlBbHBoYSIsInByZW11bHRpcGx5QWxwaGEiLCJURVhUVVJFMCIsInRleHR1cmVUYXJnZXQiLCJ0ZXh0dXJlT2JqZWN0IiwiYmluZFRleHR1cmVPblVuaXQiLCJzZXRUZXh0dXJlUGFyYW1ldGVycyIsIl9wYXJhbWV0ZXJGbGFncyIsImZpbHRlciIsIl9taW5GaWx0ZXIiLCJfbWlwbWFwcyIsIl9jb21wcmVzc2VkIiwiX2xldmVscyIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSIiwiX21hZ0ZpbHRlciIsIl9hZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIl9hZGRyZXNzViIsIlRFWFRVUkVfV1JBUF9SIiwiX2FkZHJlc3NXIiwiVEVYVFVSRV9DT01QQVJFX01PREUiLCJfY29tcGFyZU9uUmVhZCIsIkNPTVBBUkVfUkVGX1RPX1RFWFRVUkUiLCJURVhUVVJFX0NPTVBBUkVfRlVOQyIsIl9jb21wYXJlRnVuYyIsInRleFBhcmFtZXRlcmYiLCJURVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCIsIm1heCIsInJvdW5kIiwiX2FuaXNvdHJvcHkiLCJzZXRUZXh0dXJlIiwiaW5pdGlhbGl6ZSIsIl9uZWVkc1VwbG9hZCIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJ1cGxvYWQiLCJ2ZXJ0ZXhCdWZmZXJzIiwia2V5IiwidmFvIiwidXNlQ2FjaGUiLCJpZCIsInJlbmRlcmluZ0hhc2giLCJnZXQiLCJiaW5kQnVmZmVyIiwiRUxFTUVOVF9BUlJBWV9CVUZGRVIiLCJsb2NaZXJvIiwiQVJSQVlfQlVGRkVSIiwiYnVmZmVySWQiLCJlbGVtZW50cyIsImoiLCJlIiwibG9jIiwic2VtYW50aWNUb0xvY2F0aW9uIiwidmVydGV4QXR0cmliUG9pbnRlciIsIm51bUNvbXBvbmVudHMiLCJkYXRhVHlwZSIsIm5vcm1hbGl6ZSIsInN0cmlkZSIsIm9mZnNldCIsImVuYWJsZVZlcnRleEF0dHJpYkFycmF5IiwiaW5zdGFuY2luZyIsInNldCIsInNldEJ1ZmZlcnMiLCJhc3NlcnQiLCJwcmltaXRpdmUiLCJudW1JbnN0YW5jZXMiLCJrZWVwQnVmZmVycyIsInNhbXBsZXIiLCJzYW1wbGVyVmFsdWUiLCJudW1UZXh0dXJlcyIsInNjb3BlSWQiLCJ1bmlmb3JtVmVyc2lvbiIsInByb2dyYW1WZXJzaW9uIiwic2FtcGxlcnMiLCJ1bmlmb3JtcyIsImxlbiIsInNhbXBsZXJOYW1lIiwid2Fybk9uY2UiLCJkZXB0aEJ1ZmZlciIsImFycmF5IiwidW5pZm9ybTFpdiIsInZlcnNpb24iLCJ2ZXJzaW9uT2JqZWN0IiwiZ2xvYmFsSWQiLCJyZXZpc2lvbiIsImJpbmRCdWZmZXJCYXNlIiwiVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiIsImJlZ2luVHJhbnNmb3JtRmVlZGJhY2siLCJtb2RlIiwiZ2xGb3JtYXQiLCJieXRlc1BlckluZGV4IiwiZHJhd0VsZW1lbnRzIiwiZmlyc3QiLCJkcmF3QXJyYXlzIiwiZW5kVHJhbnNmb3JtRmVlZGJhY2siLCJfZHJhd0NhbGxzUGVyRnJhbWUiLCJfcHJpbXNQZXJGcmFtZSIsIl9vcHRpb25zJGZsYWdzIiwiZGVmYXVsdE9wdGlvbnMiLCJkZWZhdWx0Q2xlYXJPcHRpb25zIiwiX29wdGlvbnMkY29sb3IiLCJjIiwiX29wdGlvbnMkZGVwdGgiLCJXUklURURFUFRIIiwiX29wdGlvbnMkc3RlbmNpbCIsInNldEFscGhhVG9Db3ZlcmFnZSIsInN0YXRlIiwic2V0VHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIiLCJ0ZiIsImNyZWF0ZVRyYW5zZm9ybUZlZWRiYWNrIiwiYmluZFRyYW5zZm9ybUZlZWRiYWNrIiwiVFJBTlNGT1JNX0ZFRURCQUNLIiwic2V0UmFzdGVyIiwib24iLCJzZXREZXB0aEJpYXMiLCJzZXREZXB0aEJpYXNWYWx1ZXMiLCJjb25zdEJpYXMiLCJzbG9wZUJpYXMiLCJwb2x5Z29uT2Zmc2V0Iiwic2V0U3RlbmNpbFRlc3QiLCJzZXRTdGVuY2lsRnVuYyIsImZ1bmMiLCJyZWYiLCJtYXNrIiwic2V0U3RlbmNpbEZ1bmNGcm9udCIsInN0ZW5jaWxGdW5jU2VwYXJhdGUiLCJzZXRTdGVuY2lsRnVuY0JhY2siLCJzZXRTdGVuY2lsT3BlcmF0aW9uIiwiZmFpbCIsInpmYWlsIiwienBhc3MiLCJ3cml0ZU1hc2siLCJzZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQiLCJzdGVuY2lsT3BTZXBhcmF0ZSIsInN0ZW5jaWxNYXNrU2VwYXJhdGUiLCJzZXRTdGVuY2lsT3BlcmF0aW9uQmFjayIsImJsZW5kU3RhdGUiLCJjdXJyZW50QmxlbmRTdGF0ZSIsImVxdWFscyIsImJsZW5kIiwiY29sb3JPcCIsImFscGhhT3AiLCJjb2xvclNyY0ZhY3RvciIsImNvbG9yRHN0RmFjdG9yIiwiYWxwaGFTcmNGYWN0b3IiLCJhbHBoYURzdEZhY3RvciIsImJsZW5kRXF1YXRpb25TZXBhcmF0ZSIsImJsZW5kRnVuY1NlcGFyYXRlIiwiYWxsV3JpdGUiLCJyZWRXcml0ZSIsImdyZWVuV3JpdGUiLCJibHVlV3JpdGUiLCJhbHBoYVdyaXRlIiwiY29weSIsInNldEJsZW5kQ29sb3IiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInJlYWRNYXNrIiwiX3N0ZW5jaWxGcm9udCIsIl9zdGVuY2lsQmFjayIsIlN0ZW5jaWxQYXJhbWV0ZXJzIiwiZGVwdGhTdGF0ZSIsImN1cnJlbnREZXB0aFN0YXRlIiwid3JpdGUiLCJ0ZXN0IiwiY3VsbE1vZGUiLCJmYWlsZWQiLCJyZWFkeSIsImZpbmFsaXplIiwidXNlUHJvZ3JhbSIsImdsUHJvZ3JhbSIsIl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lIiwiYXR0cmlidXRlc0ludmFsaWRhdGVkIiwiZ2V0SGRyRm9ybWF0IiwicHJlZmVyTGFyZ2VzdCIsInJlbmRlcmFibGUiLCJ1cGRhdGFibGUiLCJmaWx0ZXJhYmxlIiwiZjE2VmFsaWQiLCJmMzJWYWxpZCIsImZvckVhY2giLCJpdGVtIiwibWFwT2JqIiwicmVzaXplQ2FudmFzIiwiX3dpZHRoIiwiX2hlaWdodCIsInJhdGlvIiwiX21heFBpeGVsUmF0aW8iLCJkZXZpY2VQaXhlbFJhdGlvIiwiRVZFTlRfUkVTSVpFIiwiZHJhd2luZ0J1ZmZlcldpZHRoIiwiZHJhd2luZ0J1ZmZlckhlaWdodCIsImZ1bGxzY3JlZW4iLCJyZXF1ZXN0RnVsbHNjcmVlbiIsImRvY3VtZW50IiwiZXhpdEZ1bGxzY3JlZW4iLCJmdWxsc2NyZWVuRWxlbWVudCIsInRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBeUNBLE1BQU1BLHFCQUFxQixHQUFHLEVBQUUsQ0FBQTtBQUVoQyxNQUFNQyxpQkFBaUIsYUFBYyxDQUFBO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsaUJBQWlCLGFBQWMsQ0FBQTtBQUNyQztBQUNBO0FBQ0E7QUFDQSxDQUFDLENBQUE7QUFFRCxNQUFNQyxpQkFBaUIsYUFBYyxDQUFBO0FBQ3JDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsZ0JBQWdCLGFBQWMsQ0FBQTtBQUNwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxDQUFBO0FBRUQsU0FBU0MsY0FBY0EsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUU1Q0MsRUFBQUEsYUFBYSxDQUFDQyxhQUFhLENBQUNKLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFBO0FBRXJELEVBQUEsTUFBTUssS0FBSyxHQUFHTCxNQUFNLENBQUNNLFlBQVksQ0FBQTtBQUNqQ04sRUFBQUEsTUFBTSxDQUFDTyxlQUFlLENBQUNOLE1BQU0sQ0FBQyxDQUFBO0VBQzlCRCxNQUFNLENBQUNRLFdBQVcsRUFBRSxDQUFBO0FBRXBCUixFQUFBQSxNQUFNLENBQUNTLFdBQVcsQ0FBQ0MsYUFBYSxDQUFDLENBQUE7QUFDakNWLEVBQUFBLE1BQU0sQ0FBQ1csYUFBYSxDQUFDQyxVQUFVLENBQUNDLE9BQU8sQ0FBQyxDQUFBO0FBQ3hDYixFQUFBQSxN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
