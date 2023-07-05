import { setupVertexArrayObject } from '../../../polyfill/OESVertexArrayObject.js';
import { math } from '../../../core/math/math.js';
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
  device.setBlendState(BlendState.NOBLEND);
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
    /**
     * The WebGL context managed by the graphics device. The type could also technically be
     * `WebGLRenderingContext` if WebGL 2.0 is not available. But in order for IntelliSense to be
     * able to function for all WebGL calls in the codebase, we specify `WebGL2RenderingContext`
     * here instead.
     *
     * @type {WebGL2RenderingContext}
     * @ignore
     */
    this.gl = void 0;
    /**
     * True if the WebGL context of this device is using the WebGL 2.0 API. If false, WebGL 1.0 is
     * being used.
     *
     * @type {boolean}
     * @ignore
     */
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
    const isChrome = platform.browserName === 'chrome';
    const isSafari = platform.browserName === 'safari';
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
      this.drawBuffers = gl.drawBuffers.bind(gl);
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
      var _this$extDrawBuffers;
      this.extBlendMinmax = this.getExtension("EXT_blend_minmax");
      this.extDrawBuffers = this.getExtension('WEBGL_draw_buffers');
      this.extInstancing = this.getExtension("ANGLE_instanced_arrays");
      this.drawBuffers = (_this$extDrawBuffers = this.extDrawBuffers) == null ? void 0 : _this$extDrawBuffers.drawBuffersWEBGL.bind(this.extDrawBuffers);
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
      this.supportsMrt = true;
      this.supportsVolumeTextures = true;
    } else {
      ext = this.extDrawBuffers;
      this.supportsMrt = !!ext;
      this.maxDrawBuffers = ext ? gl.getParameter(ext.MAX_DRAW_BUFFERS_WEBGL) : 1;
      this.maxColorAttachments = ext ? gl.getParameter(ext.MAX_COLOR_ATTACHMENTS_WEBGL) : 1;
      this.maxVolumeSize = 1;
    }
    ext = this.extDebugRendererInfo;
    this.unmaskedRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    this.unmaskedVendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';

    // Mali-G52 has rendering issues with GPU particles including
    // SM-A225M, M2003J15SC and KFRAWI (Amazon Fire HD 8 2022)
    const maliRendererRegex = /\bMali-G52+/;

    // Samsung devices with Exynos (ARM) either crash or render incorrectly when using GPU for particles. See:
    // https://github.com/playcanvas/engine/issues/3967
    // https://github.com/playcanvas/engine/issues/3415
    // https://github.com/playcanvas/engine/issues/4514
    // Example UA matches: Starting 'SM' and any combination of letters or numbers:
    // Mozilla/5.0 (Linux, Android 12; SM-G970F Build/SP1A.210812.016; wv)
    const samsungModelRegex = /SM-[a-zA-Z0-9]+/;
    this.supportsGpuParticles = !(this.unmaskedVendor === 'ARM' && userAgent.match(samsungModelRegex)) && !this.unmaskedRenderer.match(maliRendererRegex);
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
    if (colorOps != null && colorOps.clear || depthStencilOps.clearDepth || depthStencilOps.clearStencil) {
      // the pass always clears full target
      const rt = renderPass.renderTarget;
      const width = rt ? rt.width : this.width;
      const height = rt ? rt.height : this.height;
      this.setViewport(0, 0, width, height);
      this.setScissor(0, 0, width, height);
      let clearFlags = 0;
      const clearOptions = {};
      if (colorOps != null && colorOps.clear) {
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
    const colorBufferCount = renderPass.colorArrayOps.length;
    if (target) {
      var _renderPass$colorOps;
      // invalidate buffers to stop them being written to on tiled architectures
      if (this.webgl2) {
        invalidateAttachments.length = 0;
        const gl = this.gl;

        // color buffers
        for (let i = 0; i < colorBufferCount; i++) {
          const colorOps = renderPass.colorArrayOps[i];

          // invalidate color only if we don't need to resolve it
          if (!(colorOps.store || colorOps.resolve)) {
            invalidateAttachments.push(gl.COLOR_ATTACHMENT0 + i);
          }
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

      // resolve the color buffer (this resolves all MRT color buffers at once)
      if ((_renderPass$colorOps = renderPass.colorOps) != null && _renderPass$colorOps.resolve) {
        if (this.webgl2 && renderPass.samples > 1 && target.autoResolve) {
          target.resolve(true, false);
        }
      }

      // generate mipmaps
      for (let i = 0; i < colorBufferCount; i++) {
        const colorOps = renderPass.colorArrayOps[i];
        if (colorOps.mipmaps) {
          const colorBuffer = target._colorBuffers[i];
          if (colorBuffer && colorBuffer.impl._glTexture && colorBuffer.mipmaps && (colorBuffer.pot || this.webgl2)) {
            DebugGraphics.pushGpuMarker(this, `MIPS${i}`);
            this.activeTexture(this.maxCombinedTextures - 1);
            this.bindTexture(colorBuffer);
            this.gl.generateMipmap(colorBuffer.impl._glTarget);
            DebugGraphics.popGpuMarker(this);
          }
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
    const flags = texture.impl.dirtyParameterFlags;
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
        gl.texParameterf(target, ext.TEXTURE_MAX_ANISOTROPY_EXT, math.clamp(Math.round(texture._anisotropy), 1, this.maxAnisotropy));
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
    const impl = texture.impl;
    if (!impl._glTexture) impl.initialize(this, texture);
    if (impl.dirtyParameterFlags > 0 || texture._needsUpload || texture._needsMipmapsUpload) {
      // Ensure the specified texture unit is active
      this.activeTexture(textureUnit);

      // Ensure the texture is bound on correct target of the specified texture unit
      this.bindTexture(texture);
      if (impl.dirtyParameterFlags) {
        this.setTextureParameters(texture);
        impl.dirtyParameterFlags = 0;
      }
      if (texture._needsUpload || texture._needsMipmapsUpload) {
        impl.upload(this, texture);
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
        this.setBlendState(BlendState.NOBLEND);
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
  submit() {
    this.gl.flush();
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
   * Asynchronously reads a block of pixels from a specified rectangle of the current color framebuffer
   * into an ArrayBufferView object.
   *
   * @param {number} x - The x-coordinate of the rectangle's lower-left corner.
   * @param {number} y - The y-coordinate of the rectangle's lower-left corner.
   * @param {number} w - The width of the rectangle, in pixels.
   * @param {number} h - The height of the rectangle, in pixels.
   * @param {ArrayBufferView} pixels - The ArrayBufferView object that holds the returned pixel
   * data.
   * @ignore
   */
  async readPixelsAsync(x, y, w, h, pixels) {
    var _this$renderTarget$co, _impl$_glFormat, _impl$_glPixelType;
    const gl = this.gl;
    if (!this.webgl2) {
      // async fences aren't supported on webgl1
      return this.readPixels(x, y, w, h, pixels);
    }
    const clientWaitAsync = (flags, interval_ms) => {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      this.submit();
      return new Promise((resolve, reject) => {
        function test() {
          const res = gl.clientWaitSync(sync, flags, 0);
          if (res === gl.WAIT_FAILED) {
            gl.deleteSync(sync);
            reject(new Error('webgl clientWaitSync sync failed'));
          } else if (res === gl.TIMEOUT_EXPIRED) {
            setTimeout(test, interval_ms);
          } else {
            gl.deleteSync(sync);
            resolve();
          }
        }
        test();
      });
    };
    const impl = (_this$renderTarget$co = this.renderTarget.colorBuffer) == null ? void 0 : _this$renderTarget$co.impl;
    const format = (_impl$_glFormat = impl == null ? void 0 : impl._glFormat) != null ? _impl$_glFormat : gl.RGBA;
    const pixelType = (_impl$_glPixelType = impl == null ? void 0 : impl._glPixelType) != null ? _impl$_glPixelType : gl.UNSIGNED_BYTE;

    // create temporary (gpu-side) buffer and copy data into it
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, pixels.byteLength, gl.STREAM_READ);
    gl.readPixels(x, y, w, h, format, pixelType, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

    // async wait for previous read to finish
    await clientWaitAsync(0, 20);

    // copy the resulting data once it's arrived
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.deleteBuffer(buf);
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

  // debug helper to force lost context
  debugLoseContext(sleep = 100) {
    const context = this.gl.getExtension('WEBGL_lose_context');
    context.loseContext();
    setTimeout(() => context.restoreContext(), sleep);
  }
}

export { WebglGraphicsDevice };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtZ3JhcGhpY3MtZGV2aWNlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNldHVwVmVydGV4QXJyYXlPYmplY3QgfSBmcm9tICcuLi8uLi8uLi9wb2x5ZmlsbC9PRVNWZXJ0ZXhBcnJheU9iamVjdC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5cbmltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgIENMRUFSRkxBR19DT0xPUiwgQ0xFQVJGTEFHX0RFUFRILCBDTEVBUkZMQUdfU1RFTkNJTCxcbiAgICBDVUxMRkFDRV9OT05FLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUixcbiAgICBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNULCBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgRlVOQ19BTFdBWVMsXG4gICAgUElYRUxGT1JNQVRfUkdCOCwgUElYRUxGT1JNQVRfUkdCQTgsIFBJWEVMRk9STUFUX1JHQkExNkYsIFBJWEVMRk9STUFUX1JHQkEzMkYsXG4gICAgU1RFTkNJTE9QX0tFRVAsXG4gICAgVU5JRk9STVRZUEVfQk9PTCwgVU5JRk9STVRZUEVfSU5ULCBVTklGT1JNVFlQRV9GTE9BVCwgVU5JRk9STVRZUEVfVkVDMiwgVU5JRk9STVRZUEVfVkVDMyxcbiAgICBVTklGT1JNVFlQRV9WRUM0LCBVTklGT1JNVFlQRV9JVkVDMiwgVU5JRk9STVRZUEVfSVZFQzMsIFVOSUZPUk1UWVBFX0lWRUM0LCBVTklGT1JNVFlQRV9CVkVDMixcbiAgICBVTklGT1JNVFlQRV9CVkVDMywgVU5JRk9STVRZUEVfQlZFQzQsIFVOSUZPUk1UWVBFX01BVDIsIFVOSUZPUk1UWVBFX01BVDMsIFVOSUZPUk1UWVBFX01BVDQsXG4gICAgVU5JRk9STVRZUEVfVEVYVFVSRTJELCBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRSwgVU5JRk9STVRZUEVfRkxPQVRBUlJBWSwgVU5JRk9STVRZUEVfVEVYVFVSRTJEX1NIQURPVyxcbiAgICBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1csIFVOSUZPUk1UWVBFX1RFWFRVUkUzRCwgVU5JRk9STVRZUEVfVkVDMkFSUkFZLCBVTklGT1JNVFlQRV9WRUMzQVJSQVksIFVOSUZPUk1UWVBFX1ZFQzRBUlJBWSxcbiAgICBzZW1hbnRpY1RvTG9jYXRpb24sXG4gICAgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIERFVklDRVRZUEVfV0VCR0wyLFxuICAgIERFVklDRVRZUEVfV0VCR0wxXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlIH0gZnJvbSAnLi4vZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL2RlYnVnLWdyYXBoaWNzLmpzJztcblxuaW1wb3J0IHsgV2ViZ2xWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuL3dlYmdsLXZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xJbmRleEJ1ZmZlciB9IGZyb20gJy4vd2ViZ2wtaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFdlYmdsU2hhZGVyIH0gZnJvbSAnLi93ZWJnbC1zaGFkZXIuanMnO1xuaW1wb3J0IHsgV2ViZ2xUZXh0dXJlIH0gZnJvbSAnLi93ZWJnbC10ZXh0dXJlLmpzJztcbmltcG9ydCB7IFdlYmdsUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi93ZWJnbC1yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IFNoYWRlclV0aWxzIH0gZnJvbSAnLi4vc2hhZGVyLXV0aWxzLmpzJztcbmltcG9ydCB7IFNoYWRlciB9IGZyb20gJy4uL3NoYWRlci5qcyc7XG5pbXBvcnQgeyBCbGVuZFN0YXRlIH0gZnJvbSAnLi4vYmxlbmQtc3RhdGUuanMnO1xuaW1wb3J0IHsgRGVwdGhTdGF0ZSB9IGZyb20gJy4uL2RlcHRoLXN0YXRlLmpzJztcbmltcG9ydCB7IFN0ZW5jaWxQYXJhbWV0ZXJzIH0gZnJvbSAnLi4vc3RlbmNpbC1wYXJhbWV0ZXJzLmpzJztcblxuY29uc3QgaW52YWxpZGF0ZUF0dGFjaG1lbnRzID0gW107XG5cbmNvbnN0IF9mdWxsU2NyZWVuUXVhZFZTID0gLyogZ2xzbCAqL2BcbmF0dHJpYnV0ZSB2ZWMyIHZlcnRleF9wb3NpdGlvbjtcbnZhcnlpbmcgdmVjMiB2VXYwO1xudm9pZCBtYWluKHZvaWQpXG57XG4gICAgZ2xfUG9zaXRpb24gPSB2ZWM0KHZlcnRleF9wb3NpdGlvbiwgMC41LCAxLjApO1xuICAgIHZVdjAgPSB2ZXJ0ZXhfcG9zaXRpb24ueHkqMC41KzAuNTtcbn1cbmA7XG5cbmNvbnN0IF9wcmVjaXNpb25UZXN0MVBTID0gLyogZ2xzbCAqL2BcbnZvaWQgbWFpbih2b2lkKSB7IFxuICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMjE0NzQ4MzY0OC4wKTtcbn1cbmA7XG5cbmNvbnN0IF9wcmVjaXNpb25UZXN0MlBTID0gLyogZ2xzbCAqL2BcbnVuaWZvcm0gc2FtcGxlcjJEIHNvdXJjZTtcbnZlYzQgcGFja0Zsb2F0KGZsb2F0IGRlcHRoKSB7XG4gICAgY29uc3QgdmVjNCBiaXRfc2hpZnQgPSB2ZWM0KDI1Ni4wICogMjU2LjAgKiAyNTYuMCwgMjU2LjAgKiAyNTYuMCwgMjU2LjAsIDEuMCk7XG4gICAgY29uc3QgdmVjNCBiaXRfbWFzayAgPSB2ZWM0KDAuMCwgMS4wIC8gMjU2LjAsIDEuMCAvIDI1Ni4wLCAxLjAgLyAyNTYuMCk7XG4gICAgdmVjNCByZXMgPSBtb2QoZGVwdGggKiBiaXRfc2hpZnQgKiB2ZWM0KDI1NSksIHZlYzQoMjU2KSApIC8gdmVjNCgyNTUpO1xuICAgIHJlcyAtPSByZXMueHh5eiAqIGJpdF9tYXNrO1xuICAgIHJldHVybiByZXM7XG59XG52b2lkIG1haW4odm9pZCkge1xuICAgIGZsb2F0IGMgPSB0ZXh0dXJlMkQoc291cmNlLCB2ZWMyKDAuMCkpLnI7XG4gICAgZmxvYXQgZGlmZiA9IGFicyhjIC0gMjE0NzQ4MzY0OC4wKSAvIDIxNDc0ODM2NDguMDtcbiAgICBnbF9GcmFnQ29sb3IgPSBwYWNrRmxvYXQoZGlmZik7XG59XG5gO1xuXG5jb25zdCBfb3V0cHV0VGV4dHVyZTJEID0gLyogZ2xzbCAqL2BcbnZhcnlpbmcgdmVjMiB2VXYwO1xudW5pZm9ybSBzYW1wbGVyMkQgc291cmNlO1xudm9pZCBtYWluKHZvaWQpIHtcbiAgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQoc291cmNlLCB2VXYwKTtcbn1cbmA7XG5cbmZ1bmN0aW9uIHF1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZ2V0LCBzaGFkZXIpIHtcblxuICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIFwiUXVhZFdpdGhTaGFkZXJcIik7XG5cbiAgICBjb25zdCBvbGRSdCA9IGRldmljZS5yZW5kZXJUYXJnZXQ7XG4gICAgZGV2aWNlLnNldFJlbmRlclRhcmdldCh0YXJnZXQpO1xuICAgIGRldmljZS51cGRhdGVCZWdpbigpO1xuXG4gICAgZGV2aWNlLnNldEN1bGxNb2RlKENVTExGQUNFX05PTkUpO1xuICAgIGRldmljZS5zZXRCbGVuZFN0YXRlKEJsZW5kU3RhdGUuTk9CTEVORCk7XG4gICAgZGV2aWNlLnNldERlcHRoU3RhdGUoRGVwdGhTdGF0ZS5OT0RFUFRIKTtcbiAgICBkZXZpY2Uuc2V0U3RlbmNpbFN0YXRlKG51bGwsIG51bGwpO1xuXG4gICAgZGV2aWNlLnNldFZlcnRleEJ1ZmZlcihkZXZpY2UucXVhZFZlcnRleEJ1ZmZlciwgMCk7XG4gICAgZGV2aWNlLnNldFNoYWRlcihzaGFkZXIpO1xuXG4gICAgZGV2aWNlLmRyYXcoe1xuICAgICAgICB0eXBlOiBQUklNSVRJVkVfVFJJU1RSSVAsXG4gICAgICAgIGJhc2U6IDAsXG4gICAgICAgIGNvdW50OiA0LFxuICAgICAgICBpbmRleGVkOiBmYWxzZVxuICAgIH0pO1xuXG4gICAgZGV2aWNlLnVwZGF0ZUVuZCgpO1xuXG4gICAgZGV2aWNlLnNldFJlbmRlclRhcmdldChvbGRSdCk7XG4gICAgZGV2aWNlLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xufVxuXG5mdW5jdGlvbiB0ZXN0UmVuZGVyYWJsZShnbCwgcGl4ZWxGb3JtYXQpIHtcbiAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIC8vIENyZWF0ZSBhIDJ4MiB0ZXh0dXJlXG4gICAgY29uc3QgdGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgMiwgMiwgMCwgZ2wuUkdCQSwgcGl4ZWxGb3JtYXQsIG51bGwpO1xuXG4gICAgLy8gVHJ5IHRvIHVzZSB0aGlzIHRleHR1cmUgYXMgYSByZW5kZXIgdGFyZ2V0XG4gICAgY29uc3QgZnJhbWVidWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgZnJhbWVidWZmZXIpO1xuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgdGV4dHVyZSwgMCk7XG5cbiAgICAvLyBJdCBpcyBsZWdhbCBmb3IgYSBXZWJHTCBpbXBsZW1lbnRhdGlvbiBleHBvc2luZyB0aGUgT0VTX3RleHR1cmVfZmxvYXQgZXh0ZW5zaW9uIHRvXG4gICAgLy8gc3VwcG9ydCBmbG9hdGluZy1wb2ludCB0ZXh0dXJlcyBidXQgbm90IGFzIGF0dGFjaG1lbnRzIHRvIGZyYW1lYnVmZmVyIG9iamVjdHMuXG4gICAgaWYgKGdsLmNoZWNrRnJhbWVidWZmZXJTdGF0dXMoZ2wuRlJBTUVCVUZGRVIpICE9PSBnbC5GUkFNRUJVRkZFUl9DT01QTEVURSkge1xuICAgICAgICByZXN1bHQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDbGVhbiB1cFxuICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xuICAgIGdsLmRlbGV0ZVRleHR1cmUodGV4dHVyZSk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcbiAgICBnbC5kZWxldGVGcmFtZWJ1ZmZlcihmcmFtZWJ1ZmZlcik7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiB0ZXN0VGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZShnbCwgcGl4ZWxGb3JtYXQpIHtcbiAgICBsZXQgcmVzdWx0ID0gdHJ1ZTtcblxuICAgIC8vIENyZWF0ZSBhIDJ4MiB0ZXh0dXJlXG4gICAgY29uc3QgdGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgZ2wuTkVBUkVTVCk7XG4gICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuXG4gICAgLy8gdXBsb2FkIHNvbWUgZGF0YSAtIG9uIGlPUyBwcmlvciB0byBhYm91dCBOb3ZlbWJlciAyMDE5LCBwYXNzaW5nIGRhdGEgdG8gaGFsZiB0ZXh0dXJlIHdvdWxkIGZhaWwgaGVyZVxuICAgIC8vIHNlZSBkZXRhaWxzIGhlcmU6IGh0dHBzOi8vYnVncy53ZWJraXQub3JnL3Nob3dfYnVnLmNnaT9pZD0xNjk5OTlcbiAgICAvLyBub3RlIHRoYXQgaWYgbm90IHN1cHBvcnRlZCwgdGhpcyBwcmludHMgYW4gZXJyb3IgdG8gY29uc29sZSwgdGhlIGVycm9yIGNhbiBiZSBzYWZlbHkgaWdub3JlZCBhcyBpdCdzIGhhbmRsZWRcbiAgICBjb25zdCBkYXRhID0gbmV3IFVpbnQxNkFycmF5KDQgKiAyICogMik7XG4gICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCAyLCAyLCAwLCBnbC5SR0JBLCBwaXhlbEZvcm1hdCwgZGF0YSk7XG5cbiAgICBpZiAoZ2wuZ2V0RXJyb3IoKSAhPT0gZ2wuTk9fRVJST1IpIHtcbiAgICAgICAgcmVzdWx0ID0gZmFsc2U7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiQWJvdmUgZXJyb3IgcmVsYXRlZCB0byBIQUxGX0ZMT0FUX09FUyBjYW4gYmUgaWdub3JlZCwgaXQgd2FzIHRyaWdnZXJlZCBieSB0ZXN0aW5nIGhhbGYgZmxvYXQgdGV4dHVyZSBzdXBwb3J0XCIpO1xuICAgIH1cblxuICAgIC8vIENsZWFuIHVwXG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gICAgZ2wuZGVsZXRlVGV4dHVyZSh0ZXh0dXJlKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRlc3RUZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKGRldmljZSkge1xuICAgIGlmICghZGV2aWNlLnRleHR1cmVGbG9hdFJlbmRlcmFibGUpXG4gICAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHNoYWRlcjEgPSBuZXcgU2hhZGVyKGRldmljZSwgU2hhZGVyVXRpbHMuY3JlYXRlRGVmaW5pdGlvbihkZXZpY2UsIHtcbiAgICAgICAgbmFtZTogJ3B0ZXN0MScsXG4gICAgICAgIHZlcnRleENvZGU6IF9mdWxsU2NyZWVuUXVhZFZTLFxuICAgICAgICBmcmFnbWVudENvZGU6IF9wcmVjaXNpb25UZXN0MVBTXG4gICAgfSkpO1xuXG4gICAgY29uc3Qgc2hhZGVyMiA9IG5ldyBTaGFkZXIoZGV2aWNlLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKGRldmljZSwge1xuICAgICAgICBuYW1lOiAncHRlc3QyJyxcbiAgICAgICAgdmVydGV4Q29kZTogX2Z1bGxTY3JlZW5RdWFkVlMsXG4gICAgICAgIGZyYWdtZW50Q29kZTogX3ByZWNpc2lvblRlc3QyUFNcbiAgICB9KSk7XG5cbiAgICBjb25zdCB0ZXh0dXJlT3B0aW9ucyA9IHtcbiAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBMzJGLFxuICAgICAgICB3aWR0aDogMSxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbWFnRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgbmFtZTogJ3Rlc3RGSFAnXG4gICAgfTtcbiAgICBjb25zdCB0ZXgxID0gbmV3IFRleHR1cmUoZGV2aWNlLCB0ZXh0dXJlT3B0aW9ucyk7XG4gICAgY29uc3QgdGFyZzEgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgY29sb3JCdWZmZXI6IHRleDEsXG4gICAgICAgIGRlcHRoOiBmYWxzZVxuICAgIH0pO1xuICAgIHF1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZzEsIHNoYWRlcjEpO1xuXG4gICAgdGV4dHVyZU9wdGlvbnMuZm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgY29uc3QgdGV4MiA9IG5ldyBUZXh0dXJlKGRldmljZSwgdGV4dHVyZU9wdGlvbnMpO1xuICAgIGNvbnN0IHRhcmcyID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgIGNvbG9yQnVmZmVyOiB0ZXgyLFxuICAgICAgICBkZXB0aDogZmFsc2VcbiAgICB9KTtcbiAgICBkZXZpY2UuY29uc3RhbnRUZXhTb3VyY2Uuc2V0VmFsdWUodGV4MSk7XG4gICAgcXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0YXJnMiwgc2hhZGVyMik7XG5cbiAgICBjb25zdCBwcmV2RnJhbWVidWZmZXIgPSBkZXZpY2UuYWN0aXZlRnJhbWVidWZmZXI7XG4gICAgZGV2aWNlLnNldEZyYW1lYnVmZmVyKHRhcmcyLmltcGwuX2dsRnJhbWVCdWZmZXIpO1xuXG4gICAgY29uc3QgcGl4ZWxzID0gbmV3IFVpbnQ4QXJyYXkoNCk7XG4gICAgZGV2aWNlLnJlYWRQaXhlbHMoMCwgMCwgMSwgMSwgcGl4ZWxzKTtcblxuICAgIGRldmljZS5zZXRGcmFtZWJ1ZmZlcihwcmV2RnJhbWVidWZmZXIpO1xuXG4gICAgY29uc3QgeCA9IHBpeGVsc1swXSAvIDI1NTtcbiAgICBjb25zdCB5ID0gcGl4ZWxzWzFdIC8gMjU1O1xuICAgIGNvbnN0IHogPSBwaXhlbHNbMl0gLyAyNTU7XG4gICAgY29uc3QgdyA9IHBpeGVsc1szXSAvIDI1NTtcbiAgICBjb25zdCBmID0geCAvICgyNTYgKiAyNTYgKiAyNTYpICsgeSAvICgyNTYgKiAyNTYpICsgeiAvIDI1NiArIHc7XG5cbiAgICB0ZXgxLmRlc3Ryb3koKTtcbiAgICB0YXJnMS5kZXN0cm95KCk7XG4gICAgdGV4Mi5kZXN0cm95KCk7XG4gICAgdGFyZzIuZGVzdHJveSgpO1xuICAgIHNoYWRlcjEuZGVzdHJveSgpO1xuICAgIHNoYWRlcjIuZGVzdHJveSgpO1xuXG4gICAgcmV0dXJuIGYgPT09IDA7XG59XG5cbi8qKlxuICogVGhlIGdyYXBoaWNzIGRldmljZSBtYW5hZ2VzIHRoZSB1bmRlcmx5aW5nIGdyYXBoaWNzIGNvbnRleHQuIEl0IGlzIHJlc3BvbnNpYmxlIGZvciBzdWJtaXR0aW5nXG4gKiByZW5kZXIgc3RhdGUgY2hhbmdlcyBhbmQgZ3JhcGhpY3MgcHJpbWl0aXZlcyB0byB0aGUgaGFyZHdhcmUuIEEgZ3JhcGhpY3MgZGV2aWNlIGlzIHRpZWQgdG8gYVxuICogc3BlY2lmaWMgY2FudmFzIEhUTUwgZWxlbWVudC4gSXQgaXMgdmFsaWQgdG8gaGF2ZSBtb3JlIHRoYW4gb25lIGNhbnZhcyBlbGVtZW50IHBlciBwYWdlIGFuZFxuICogY3JlYXRlIGEgbmV3IGdyYXBoaWNzIGRldmljZSBhZ2FpbnN0IGVhY2guXG4gKlxuICogQGF1Z21lbnRzIEdyYXBoaWNzRGV2aWNlXG4gKi9cbmNsYXNzIFdlYmdsR3JhcGhpY3NEZXZpY2UgZXh0ZW5kcyBHcmFwaGljc0RldmljZSB7XG4gICAgLyoqXG4gICAgICogVGhlIFdlYkdMIGNvbnRleHQgbWFuYWdlZCBieSB0aGUgZ3JhcGhpY3MgZGV2aWNlLiBUaGUgdHlwZSBjb3VsZCBhbHNvIHRlY2huaWNhbGx5IGJlXG4gICAgICogYFdlYkdMUmVuZGVyaW5nQ29udGV4dGAgaWYgV2ViR0wgMi4wIGlzIG5vdCBhdmFpbGFibGUuIEJ1dCBpbiBvcmRlciBmb3IgSW50ZWxsaVNlbnNlIHRvIGJlXG4gICAgICogYWJsZSB0byBmdW5jdGlvbiBmb3IgYWxsIFdlYkdMIGNhbGxzIGluIHRoZSBjb2RlYmFzZSwgd2Ugc3BlY2lmeSBgV2ViR0wyUmVuZGVyaW5nQ29udGV4dGBcbiAgICAgKiBoZXJlIGluc3RlYWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7V2ViR0wyUmVuZGVyaW5nQ29udGV4dH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2w7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBXZWJHTCBjb250ZXh0IG9mIHRoaXMgZGV2aWNlIGlzIHVzaW5nIHRoZSBXZWJHTCAyLjAgQVBJLiBJZiBmYWxzZSwgV2ViR0wgMS4wIGlzXG4gICAgICogYmVpbmcgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB3ZWJnbDI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgbmV3IFdlYmdsR3JhcGhpY3NEZXZpY2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxDYW52YXNFbGVtZW50fSBjYW52YXMgLSBUaGUgY2FudmFzIHRvIHdoaWNoIHRoZSBncmFwaGljcyBkZXZpY2Ugd2lsbCByZW5kZXIuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbnMgcGFzc2VkIHdoZW4gY3JlYXRpbmcgdGhlIFdlYkdMIGNvbnRleHQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hbHBoYT10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgaWYgdGhlIGNhbnZhcyBjb250YWlucyBhblxuICAgICAqIGFscGhhIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmRlcHRoPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBkcmF3aW5nIGJ1ZmZlciBpc1xuICAgICAqIHJlcXVlc3RlZCB0byBoYXZlIGEgZGVwdGggYnVmZmVyIG9mIGF0IGxlYXN0IDE2IGJpdHMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5zdGVuY2lsPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGF0IHRoZSBkcmF3aW5nIGJ1ZmZlciBpc1xuICAgICAqIHJlcXVlc3RlZCB0byBoYXZlIGEgc3RlbmNpbCBidWZmZXIgb2YgYXQgbGVhc3QgOCBiaXRzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYW50aWFsaWFzPXRydWVdIC0gQm9vbGVhbiB0aGF0IGluZGljYXRlcyB3aGV0aGVyIG9yIG5vdCB0byBwZXJmb3JtXG4gICAgICogYW50aS1hbGlhc2luZyBpZiBwb3NzaWJsZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZW11bHRpcGxpZWRBbHBoYT10cnVlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGUgcGFnZVxuICAgICAqIGNvbXBvc2l0b3Igd2lsbCBhc3N1bWUgdGhlIGRyYXdpbmcgYnVmZmVyIGNvbnRhaW5zIGNvbG9ycyB3aXRoIHByZS1tdWx0aXBsaWVkIGFscGhhLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlc2VydmVEcmF3aW5nQnVmZmVyPWZhbHNlXSAtIElmIHRoZSB2YWx1ZSBpcyB0cnVlIHRoZSBidWZmZXJzXG4gICAgICogd2lsbCBub3QgYmUgY2xlYXJlZCBhbmQgd2lsbCBwcmVzZXJ2ZSB0aGVpciB2YWx1ZXMgdW50aWwgY2xlYXJlZCBvciBvdmVyd3JpdHRlbiBieSB0aGVcbiAgICAgKiBhdXRob3IuXG4gICAgICogQHBhcmFtIHsnZGVmYXVsdCd8J2hpZ2gtcGVyZm9ybWFuY2UnfCdsb3ctcG93ZXInfSBbb3B0aW9ucy5wb3dlclByZWZlcmVuY2U9J2RlZmF1bHQnXSAtIEFcbiAgICAgKiBoaW50IHRvIHRoZSB1c2VyIGFnZW50IGluZGljYXRpbmcgd2hhdCBjb25maWd1cmF0aW9uIG9mIEdQVSBpcyBzdWl0YWJsZSBmb3IgdGhlIFdlYkdMXG4gICAgICogY29udGV4dC4gUG9zc2libGUgdmFsdWVzIGFyZTpcbiAgICAgKlxuICAgICAqIC0gJ2RlZmF1bHQnOiBMZXQgdGhlIHVzZXIgYWdlbnQgZGVjaWRlIHdoaWNoIEdQVSBjb25maWd1cmF0aW9uIGlzIG1vc3Qgc3VpdGFibGUuIFRoaXMgaXMgdGhlXG4gICAgICogZGVmYXVsdCB2YWx1ZS5cbiAgICAgKiAtICdoaWdoLXBlcmZvcm1hbmNlJzogUHJpb3JpdGl6ZXMgcmVuZGVyaW5nIHBlcmZvcm1hbmNlIG92ZXIgcG93ZXIgY29uc3VtcHRpb24uXG4gICAgICogLSAnbG93LXBvd2VyJzogUHJpb3JpdGl6ZXMgcG93ZXIgc2F2aW5nIG92ZXIgcmVuZGVyaW5nIHBlcmZvcm1hbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mYWlsSWZNYWpvclBlcmZvcm1hbmNlQ2F2ZWF0PWZhbHNlXSAtIEJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgaWYgYVxuICAgICAqIGNvbnRleHQgd2lsbCBiZSBjcmVhdGVkIGlmIHRoZSBzeXN0ZW0gcGVyZm9ybWFuY2UgaXMgbG93IG9yIGlmIG5vIGhhcmR3YXJlIEdQVSBpcyBhdmFpbGFibGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcmVmZXJXZWJHbDI9dHJ1ZV0gLSBCb29sZWFuIHRoYXQgaW5kaWNhdGVzIGlmIGEgV2ViR2wyIGNvbnRleHRcbiAgICAgKiBzaG91bGQgYmUgcHJlZmVycmVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZGVzeW5jaHJvbml6ZWQ9ZmFsc2VdIC0gQm9vbGVhbiB0aGF0IGhpbnRzIHRoZSB1c2VyIGFnZW50IHRvXG4gICAgICogcmVkdWNlIHRoZSBsYXRlbmN5IGJ5IGRlc3luY2hyb25pemluZyB0aGUgY2FudmFzIHBhaW50IGN5Y2xlIGZyb20gdGhlIGV2ZW50IGxvb3AuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy54ckNvbXBhdGlibGVdIC0gQm9vbGVhbiB0aGF0IGhpbnRzIHRvIHRoZSB1c2VyIGFnZW50IHRvIHVzZSBhXG4gICAgICogY29tcGF0aWJsZSBncmFwaGljcyBhZGFwdGVyIGZvciBhbiBpbW1lcnNpdmUgWFIgZGV2aWNlLlxuICAgICAqIEBwYXJhbSB7V2ViR0xSZW5kZXJpbmdDb250ZXh0IHwgV2ViR0wyUmVuZGVyaW5nQ29udGV4dH0gW29wdGlvbnMuZ2xdIC0gVGhlIHJlbmRlcmluZyBjb250ZXh0XG4gICAgICogdG8gdXNlLiBJZiBub3Qgc3BlY2lmaWVkLCBhIG5ldyBjb250ZXh0IHdpbGwgYmUgY3JlYXRlZC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihjYW52YXMsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcihjYW52YXMsIG9wdGlvbnMpO1xuICAgICAgICBvcHRpb25zID0gdGhpcy5pbml0T3B0aW9ucztcblxuICAgICAgICB0aGlzLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy51cGRhdGVDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgLy8gQWRkIGhhbmRsZXJzIGZvciB3aGVuIHRoZSBXZWJHTCBjb250ZXh0IGlzIGxvc3Qgb3IgcmVzdG9yZWRcbiAgICAgICAgdGhpcy5jb250ZXh0TG9zdCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciA9IChldmVudCkgPT4ge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dExvc3QgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5sb3NlQ29udGV4dCgpO1xuICAgICAgICAgICAgRGVidWcubG9nKCdwYy5HcmFwaGljc0RldmljZTogV2ViR0wgY29udGV4dCBsb3N0LicpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdkZXZpY2Vsb3N0Jyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciA9ICgpID0+IHtcbiAgICAgICAgICAgIERlYnVnLmxvZygncGMuR3JhcGhpY3NEZXZpY2U6IFdlYkdMIGNvbnRleHQgcmVzdG9yZWQuJyk7XG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVDb250ZXh0KCk7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHRMb3N0ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2RldmljZXJlc3RvcmVkJyk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gIzQxMzYgLSB0dXJuIG9mZiBhbnRpYWxpYXNpbmcgb24gQXBwbGVXZWJLaXQgYnJvd3NlcnMgMTUuNFxuICAgICAgICBjb25zdCB1YSA9ICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJykgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudDtcbiAgICAgICAgdGhpcy5mb3JjZURpc2FibGVNdWx0aXNhbXBsaW5nID0gdWEgJiYgdWEuaW5jbHVkZXMoJ0FwcGxlV2ViS2l0JykgJiYgKHVhLmluY2x1ZGVzKCcxNS40JykgfHwgdWEuaW5jbHVkZXMoJzE1XzQnKSk7XG4gICAgICAgIGlmICh0aGlzLmZvcmNlRGlzYWJsZU11bHRpc2FtcGxpbmcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuYW50aWFsaWFzID0gZmFsc2U7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coXCJBbnRpYWxpYXNpbmcgaGFzIGJlZW4gdHVybmVkIG9mZiBkdWUgdG8gcmVuZGVyaW5nIGlzc3VlcyBvbiBBcHBsZVdlYktpdCAxNS40XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGdsID0gbnVsbDtcblxuICAgICAgICAvLyBSZXRyaWV2ZSB0aGUgV2ViR0wgY29udGV4dFxuICAgICAgICBpZiAob3B0aW9ucy5nbCkge1xuICAgICAgICAgICAgZ2wgPSBvcHRpb25zLmdsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgcHJlZmVyV2ViR2wyID0gKG9wdGlvbnMucHJlZmVyV2ViR2wyICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5wcmVmZXJXZWJHbDIgOiB0cnVlO1xuICAgICAgICAgICAgY29uc3QgbmFtZXMgPSBwcmVmZXJXZWJHbDIgPyBbXCJ3ZWJnbDJcIiwgXCJ3ZWJnbFwiLCBcImV4cGVyaW1lbnRhbC13ZWJnbFwiXSA6IFtcIndlYmdsXCIsIFwiZXhwZXJpbWVudGFsLXdlYmdsXCJdO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGdsID0gY2FudmFzLmdldENvbnRleHQobmFtZXNbaV0sIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGlmIChnbCkge1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWdsKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJXZWJHTCBub3Qgc3VwcG9ydGVkXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5nbCA9IGdsO1xuICAgICAgICB0aGlzLndlYmdsMiA9IHR5cGVvZiBXZWJHTDJSZW5kZXJpbmdDb250ZXh0ICE9PSAndW5kZWZpbmVkJyAmJiBnbCBpbnN0YW5jZW9mIFdlYkdMMlJlbmRlcmluZ0NvbnRleHQ7XG4gICAgICAgIHRoaXMuX2RldmljZVR5cGUgPSB0aGlzLndlYmdsMiA/IERFVklDRVRZUEVfV0VCR0wyIDogREVWSUNFVFlQRV9XRUJHTDE7XG5cbiAgICAgICAgLy8gcGl4ZWwgZm9ybWF0IG9mIHRoZSBmcmFtZWJ1ZmZlclxuICAgICAgICBjb25zdCBhbHBoYUJpdHMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuQUxQSEFfQklUUyk7XG4gICAgICAgIHRoaXMuZnJhbWVidWZmZXJGb3JtYXQgPSBhbHBoYUJpdHMgPyBQSVhFTEZPUk1BVF9SR0JBOCA6IFBJWEVMRk9STUFUX1JHQjg7XG5cbiAgICAgICAgY29uc3QgaXNDaHJvbWUgPSBwbGF0Zm9ybS5icm93c2VyTmFtZSA9PT0gJ2Nocm9tZSc7XG4gICAgICAgIGNvbnN0IGlzU2FmYXJpID0gcGxhdGZvcm0uYnJvd3Nlck5hbWUgPT09ICdzYWZhcmknO1xuICAgICAgICBjb25zdCBpc01hYyA9IHBsYXRmb3JtLmJyb3dzZXIgJiYgbmF2aWdhdG9yLmFwcFZlcnNpb24uaW5kZXhPZihcIk1hY1wiKSAhPT0gLTE7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB0ZXh0dXJlIHVuaXQgd29ya2Fyb3VuZCBvbiBkZXNrdG9wIHNhZmFyaVxuICAgICAgICB0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kID0gaXNTYWZhcmk7XG5cbiAgICAgICAgLy8gZW5hYmxlIHRlbXBvcmFyeSB3b3JrYXJvdW5kIGZvciBnbEJsaXRGcmFtZWJ1ZmZlciBmYWlsaW5nIG9uIE1hYyBDaHJvbWUgKCMyNTA0KVxuICAgICAgICB0aGlzLl90ZW1wTWFjQ2hyb21lQmxpdEZyYW1lYnVmZmVyV29ya2Fyb3VuZCA9IGlzTWFjICYmIGlzQ2hyb21lICYmICFvcHRpb25zLmFscGhhO1xuXG4gICAgICAgIC8vIGluaXQgcG9seWZpbGwgZm9yIFZBT3MgdW5kZXIgd2ViZ2wxXG4gICAgICAgIGlmICghdGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHNldHVwVmVydGV4QXJyYXlPYmplY3QoZ2wpO1xuICAgICAgICB9XG5cbiAgICAgICAgY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRsb3N0XCIsIHRoaXMuX2NvbnRleHRMb3N0SGFuZGxlciwgZmFsc2UpO1xuICAgICAgICBjYW52YXMuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dHJlc3RvcmVkXCIsIHRoaXMuX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLmluaXRpYWxpemVFeHRlbnNpb25zKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNhcGFiaWxpdGllcygpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVSZW5kZXJTdGF0ZSgpO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCk7XG5cbiAgICAgICAgLy8gb25seSBlbmFibGUgSW1hZ2VCaXRtYXAgb24gY2hyb21lXG4gICAgICAgIHRoaXMuc3VwcG9ydHNJbWFnZUJpdG1hcCA9ICFpc1NhZmFyaSAmJiB0eXBlb2YgSW1hZ2VCaXRtYXAgIT09ICd1bmRlZmluZWQnO1xuXG4gICAgICAgIHRoaXMuZ2xBZGRyZXNzID0gW1xuICAgICAgICAgICAgZ2wuUkVQRUFULFxuICAgICAgICAgICAgZ2wuQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIGdsLk1JUlJPUkVEX1JFUEVBVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xCbGVuZEVxdWF0aW9uID0gW1xuICAgICAgICAgICAgZ2wuRlVOQ19BREQsXG4gICAgICAgICAgICBnbC5GVU5DX1NVQlRSQUNULFxuICAgICAgICAgICAgZ2wuRlVOQ19SRVZFUlNFX1NVQlRSQUNULFxuICAgICAgICAgICAgdGhpcy53ZWJnbDIgPyBnbC5NSU4gOiB0aGlzLmV4dEJsZW5kTWlubWF4ID8gdGhpcy5leHRCbGVuZE1pbm1heC5NSU5fRVhUIDogZ2wuRlVOQ19BREQsXG4gICAgICAgICAgICB0aGlzLndlYmdsMiA/IGdsLk1BWCA6IHRoaXMuZXh0QmxlbmRNaW5tYXggPyB0aGlzLmV4dEJsZW5kTWlubWF4Lk1BWF9FWFQgOiBnbC5GVU5DX0FERFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uQ29sb3IgPSBbXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuT05FLFxuICAgICAgICAgICAgZ2wuU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICAgICAgICAgIGdsLkRTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19EU1RfQ09MT1IsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5TUkNfQUxQSEFfU0FUVVJBVEUsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0FMUEhBLFxuICAgICAgICAgICAgZ2wuRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICAgICAgICAgIGdsLkNPTlNUQU5UX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb25BbHBoYSA9IFtcbiAgICAgICAgICAgIGdsLlpFUk8sXG4gICAgICAgICAgICBnbC5PTkUsXG4gICAgICAgICAgICBnbC5TUkNfQ09MT1IsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgICAgICAgICAgZ2wuRFNUX0NPTE9SLFxuICAgICAgICAgICAgZ2wuT05FX01JTlVTX0RTVF9DT0xPUixcbiAgICAgICAgICAgIGdsLlNSQ19BTFBIQSxcbiAgICAgICAgICAgIGdsLlNSQ19BTFBIQV9TQVRVUkFURSxcbiAgICAgICAgICAgIGdsLk9ORV9NSU5VU19TUkNfQUxQSEEsXG4gICAgICAgICAgICBnbC5EU1RfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfRFNUX0FMUEhBLFxuICAgICAgICAgICAgZ2wuQ09OU1RBTlRfQUxQSEEsXG4gICAgICAgICAgICBnbC5PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEFcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsQ29tcGFyaXNvbiA9IFtcbiAgICAgICAgICAgIGdsLk5FVkVSLFxuICAgICAgICAgICAgZ2wuTEVTUyxcbiAgICAgICAgICAgIGdsLkVRVUFMLFxuICAgICAgICAgICAgZ2wuTEVRVUFMLFxuICAgICAgICAgICAgZ2wuR1JFQVRFUixcbiAgICAgICAgICAgIGdsLk5PVEVRVUFMLFxuICAgICAgICAgICAgZ2wuR0VRVUFMLFxuICAgICAgICAgICAgZ2wuQUxXQVlTXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbFN0ZW5jaWxPcCA9IFtcbiAgICAgICAgICAgIGdsLktFRVAsXG4gICAgICAgICAgICBnbC5aRVJPLFxuICAgICAgICAgICAgZ2wuUkVQTEFDRSxcbiAgICAgICAgICAgIGdsLklOQ1IsXG4gICAgICAgICAgICBnbC5JTkNSX1dSQVAsXG4gICAgICAgICAgICBnbC5ERUNSLFxuICAgICAgICAgICAgZ2wuREVDUl9XUkFQLFxuICAgICAgICAgICAgZ2wuSU5WRVJUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbENsZWFyRmxhZyA9IFtcbiAgICAgICAgICAgIDAsXG4gICAgICAgICAgICBnbC5DT0xPUl9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuREVQVEhfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLkNPTE9SX0JVRkZFUl9CSVQgfCBnbC5ERVBUSF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklULFxuICAgICAgICAgICAgZ2wuU1RFTkNJTF9CVUZGRVJfQklUIHwgZ2wuQ09MT1JfQlVGRkVSX0JJVCxcbiAgICAgICAgICAgIGdsLlNURU5DSUxfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQsXG4gICAgICAgICAgICBnbC5TVEVOQ0lMX0JVRkZFUl9CSVQgfCBnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVFxuICAgICAgICBdO1xuXG4gICAgICAgIHRoaXMuZ2xDdWxsID0gW1xuICAgICAgICAgICAgMCxcbiAgICAgICAgICAgIGdsLkJBQ0ssXG4gICAgICAgICAgICBnbC5GUk9OVCxcbiAgICAgICAgICAgIGdsLkZST05UX0FORF9CQUNLXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5nbEZpbHRlciA9IFtcbiAgICAgICAgICAgIGdsLk5FQVJFU1QsXG4gICAgICAgICAgICBnbC5MSU5FQVIsXG4gICAgICAgICAgICBnbC5ORUFSRVNUX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9ORUFSRVNULFxuICAgICAgICAgICAgZ2wuTElORUFSX01JUE1BUF9MSU5FQVJcbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsUHJpbWl0aXZlID0gW1xuICAgICAgICAgICAgZ2wuUE9JTlRTLFxuICAgICAgICAgICAgZ2wuTElORVMsXG4gICAgICAgICAgICBnbC5MSU5FX0xPT1AsXG4gICAgICAgICAgICBnbC5MSU5FX1NUUklQLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVTLFxuICAgICAgICAgICAgZ2wuVFJJQU5HTEVfU1RSSVAsXG4gICAgICAgICAgICBnbC5UUklBTkdMRV9GQU5cbiAgICAgICAgXTtcblxuICAgICAgICB0aGlzLmdsVHlwZSA9IFtcbiAgICAgICAgICAgIGdsLkJZVEUsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9CWVRFLFxuICAgICAgICAgICAgZ2wuU0hPUlQsXG4gICAgICAgICAgICBnbC5VTlNJR05FRF9TSE9SVCxcbiAgICAgICAgICAgIGdsLklOVCxcbiAgICAgICAgICAgIGdsLlVOU0lHTkVEX0lOVCxcbiAgICAgICAgICAgIGdsLkZMT0FUXG4gICAgICAgIF07XG5cbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlID0ge307XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MXSAgICAgICAgID0gVU5JRk9STVRZUEVfQk9PTDtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLklOVF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9JTlQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF0gICAgICAgID0gVU5JRk9STVRZUEVfRkxPQVQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9WRUMyXSAgID0gVU5JRk9STVRZUEVfVkVDMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX1ZFQzNdICAgPSBVTklGT1JNVFlQRV9WRUMzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfVkVDNF0gICA9IFVOSUZPUk1UWVBFX1ZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDMl0gICAgID0gVU5JRk9STVRZUEVfSVZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDM10gICAgID0gVU5JRk9STVRZUEVfSVZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5JTlRfVkVDNF0gICAgID0gVU5JRk9STVRZUEVfSVZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzJdICAgID0gVU5JRk9STVRZUEVfQlZFQzI7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzNdICAgID0gVU5JRk9STVRZUEVfQlZFQzM7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5CT09MX1ZFQzRdICAgID0gVU5JRk9STVRZUEVfQlZFQzQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5GTE9BVF9NQVQyXSAgID0gVU5JRk9STVRZUEVfTUFUMjtcbiAgICAgICAgdGhpcy5wY1VuaWZvcm1UeXBlW2dsLkZMT0FUX01BVDNdICAgPSBVTklGT1JNVFlQRV9NQVQzO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuRkxPQVRfTUFUNF0gICA9IFVOSUZPUk1UWVBFX01BVDQ7XG4gICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEXSAgID0gVU5JRk9STVRZUEVfVEVYVFVSRTJEO1xuICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFXSA9IFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMucGNVbmlmb3JtVHlwZVtnbC5TQU1QTEVSXzJEX1NIQURPV10gICA9IFVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl9DVUJFX1NIQURPV10gPSBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1c7XG4gICAgICAgICAgICB0aGlzLnBjVW5pZm9ybVR5cGVbZ2wuU0FNUExFUl8zRF0gICAgICAgICAgPSBVTklGT1JNVFlQRV9URVhUVVJFM0Q7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdCA9IHt9O1xuICAgICAgICB0aGlzLnRhcmdldFRvU2xvdFtnbC5URVhUVVJFXzJEXSA9IDA7XG4gICAgICAgIHRoaXMudGFyZ2V0VG9TbG90W2dsLlRFWFRVUkVfQ1VCRV9NQVBdID0gMTtcbiAgICAgICAgdGhpcy50YXJnZXRUb1Nsb3RbZ2wuVEVYVFVSRV8zRF0gPSAyO1xuXG4gICAgICAgIC8vIERlZmluZSB0aGUgdW5pZm9ybSBjb21taXQgZnVuY3Rpb25zXG4gICAgICAgIGxldCBzY29wZVgsIHNjb3BlWSwgc2NvcGVaLCBzY29wZVc7XG4gICAgICAgIGxldCB1bmlmb3JtVmFsdWU7XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb24gPSBbXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0udmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTFpKHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm0udmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JTlRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CT09MXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9GTE9BVF0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtLnZhbHVlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xZih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtLnZhbHVlID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9WRUMzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2Z2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX1ZFQzRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzJdID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICB1bmlmb3JtVmFsdWUgPSB1bmlmb3JtLnZhbHVlO1xuICAgICAgICAgICAgc2NvcGVYID0gdmFsdWVbMF07XG4gICAgICAgICAgICBzY29wZVkgPSB2YWx1ZVsxXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmFsdWVbMF0gIT09IHNjb3BlWCB8fCB1bmlmb3JtVmFsdWVbMV0gIT09IHNjb3BlWSkge1xuICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0yaXYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzBdID0gc2NvcGVYO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsxXSA9IHNjb3BlWTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9CVkVDMl0gPSB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUMyXTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDM10gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIHVuaWZvcm1WYWx1ZSA9IHVuaWZvcm0udmFsdWU7XG4gICAgICAgICAgICBzY29wZVggPSB2YWx1ZVswXTtcbiAgICAgICAgICAgIHNjb3BlWSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgc2NvcGVaID0gdmFsdWVbMl07XG4gICAgICAgICAgICBpZiAodW5pZm9ybVZhbHVlWzBdICE9PSBzY29wZVggfHwgdW5pZm9ybVZhbHVlWzFdICE9PSBzY29wZVkgfHwgdW5pZm9ybVZhbHVlWzJdICE9PSBzY29wZVopIHtcbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtM2l2KHVuaWZvcm0ubG9jYXRpb25JZCwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVswXSA9IHNjb3BlWDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMV0gPSBzY29wZVk7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzJdID0gc2NvcGVaO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0JWRUMzXSA9IHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfSVZFQzNdO1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX0lWRUM0XSA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgdW5pZm9ybVZhbHVlID0gdW5pZm9ybS52YWx1ZTtcbiAgICAgICAgICAgIHNjb3BlWCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgc2NvcGVZID0gdmFsdWVbMV07XG4gICAgICAgICAgICBzY29wZVogPSB2YWx1ZVsyXTtcbiAgICAgICAgICAgIHNjb3BlVyA9IHZhbHVlWzNdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm1WYWx1ZVswXSAhPT0gc2NvcGVYIHx8IHVuaWZvcm1WYWx1ZVsxXSAhPT0gc2NvcGVZIHx8IHVuaWZvcm1WYWx1ZVsyXSAhPT0gc2NvcGVaIHx8IHVuaWZvcm1WYWx1ZVszXSAhPT0gc2NvcGVXKSB7XG4gICAgICAgICAgICAgICAgZ2wudW5pZm9ybTRpdih1bmlmb3JtLmxvY2F0aW9uSWQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbMF0gPSBzY29wZVg7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZhbHVlWzFdID0gc2NvcGVZO1xuICAgICAgICAgICAgICAgIHVuaWZvcm1WYWx1ZVsyXSA9IHNjb3BlWjtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmFsdWVbM10gPSBzY29wZVc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfQlZFQzRdID0gdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9JVkVDNF07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfTUFUMl0gID0gZnVuY3Rpb24gKHVuaWZvcm0sIHZhbHVlKSB7XG4gICAgICAgICAgICBnbC51bmlmb3JtTWF0cml4MmZ2KHVuaWZvcm0ubG9jYXRpb25JZCwgZmFsc2UsIHZhbHVlKTtcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvbltVTklGT1JNVFlQRV9NQVQzXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm1NYXRyaXgzZnYodW5pZm9ybS5sb2NhdGlvbklkLCBmYWxzZSwgdmFsdWUpO1xuICAgICAgICB9O1xuICAgICAgICB0aGlzLmNvbW1pdEZ1bmN0aW9uW1VOSUZPUk1UWVBFX01BVDRdICA9IGZ1bmN0aW9uICh1bmlmb3JtLCB2YWx1ZSkge1xuICAgICAgICAgICAgZ2wudW5pZm9ybU1hdHJpeDRmdih1bmlmb3JtLmxvY2F0aW9uSWQsIGZhbHNlLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfRkxPQVRBUlJBWV0gPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0xZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDMkFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0yZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDM0FSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm0zZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuY29tbWl0RnVuY3Rpb25bVU5JRk9STVRZUEVfVkVDNEFSUkFZXSAgPSBmdW5jdGlvbiAodW5pZm9ybSwgdmFsdWUpIHtcbiAgICAgICAgICAgIGdsLnVuaWZvcm00ZnYodW5pZm9ybS5sb2NhdGlvbklkLCB2YWx1ZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c0JvbmVUZXh0dXJlcyA9IHRoaXMuZXh0VGV4dHVyZUZsb2F0ICYmIHRoaXMubWF4VmVydGV4VGV4dHVyZXMgPiAwO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSBhbiBlc3RpbWF0ZSBvZiB0aGUgbWF4aW11bSBudW1iZXIgb2YgYm9uZXMgdGhhdCBjYW4gYmUgdXBsb2FkZWQgdG8gdGhlIEdQVVxuICAgICAgICAvLyBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGF2YWlsYWJsZSB1bmlmb3JtcyBhbmQgdGhlIG51bWJlciBvZiB1bmlmb3JtcyByZXF1aXJlZCBmb3Igbm9uLVxuICAgICAgICAvLyBib25lIGRhdGEuICBUaGlzIGlzIGJhc2VkIG9mZiBvZiB0aGUgU3RhbmRhcmQgc2hhZGVyLiAgQSB1c2VyIGRlZmluZWQgc2hhZGVyIG1heSBoYXZlXG4gICAgICAgIC8vIGV2ZW4gbGVzcyBzcGFjZSBhdmFpbGFibGUgZm9yIGJvbmVzIHNvIHRoaXMgY2FsY3VsYXRlZCB2YWx1ZSBjYW4gYmUgb3ZlcnJpZGRlbiB2aWFcbiAgICAgICAgLy8gcGMuR3JhcGhpY3NEZXZpY2Uuc2V0Qm9uZUxpbWl0LlxuICAgICAgICBsZXQgbnVtVW5pZm9ybXMgPSB0aGlzLnZlcnRleFVuaWZvcm1zQ291bnQ7XG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBNb2RlbCwgdmlldywgcHJvamVjdGlvbiBhbmQgc2hhZG93IG1hdHJpY2VzXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDg7ICAgICAvLyA4IGxpZ2h0cyBtYXgsIGVhY2ggc3BlY2lmeWluZyBhIHBvc2l0aW9uIHZlY3RvclxuICAgICAgICBudW1Vbmlmb3JtcyAtPSAxOyAgICAgLy8gRXllIHBvc2l0aW9uXG4gICAgICAgIG51bVVuaWZvcm1zIC09IDQgKiA0OyAvLyBVcCB0byA0IHRleHR1cmUgdHJhbnNmb3Jtc1xuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGguZmxvb3IobnVtVW5pZm9ybXMgLyAzKTsgICAvLyBlYWNoIGJvbmUgdXNlcyAzIHVuaWZvcm1zXG5cbiAgICAgICAgLy8gUHV0IGEgbGltaXQgb24gdGhlIG51bWJlciBvZiBzdXBwb3J0ZWQgYm9uZXMgYmVmb3JlIHNraW4gcGFydGl0aW9uaW5nIG11c3QgYmUgcGVyZm9ybWVkXG4gICAgICAgIC8vIFNvbWUgR1BVcyBoYXZlIGRlbW9uc3RyYXRlZCBwZXJmb3JtYW5jZSBpc3N1ZXMgaWYgdGhlIG51bWJlciBvZiB2ZWN0b3JzIGFsbG9jYXRlZCB0byB0aGVcbiAgICAgICAgLy8gc2tpbiBtYXRyaXggcGFsZXR0ZSBpcyBsZWZ0IHVuYm91bmRlZFxuICAgICAgICB0aGlzLmJvbmVMaW1pdCA9IE1hdGgubWluKHRoaXMuYm9uZUxpbWl0LCAxMjgpO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza2VkUmVuZGVyZXIgPT09ICdNYWxpLTQ1MCBNUCcpIHtcbiAgICAgICAgICAgIHRoaXMuYm9uZUxpbWl0ID0gMzQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnN0YW50VGV4U291cmNlID0gdGhpcy5zY29wZS5yZXNvbHZlKFwic291cmNlXCIpO1xuXG4gICAgICAgIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wyIGZsb2F0IHRleHR1cmUgcmVuZGVyYWJpbGl0eSBpcyBkaWN0YXRlZCBieSB0aGUgRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBleHRlbnNpb25cbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSAhIXRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gSW4gV2ViR0wxIHdlIHNob3VsZCBqdXN0IHRyeSByZW5kZXJpbmcgaW50byBhIGZsb2F0IHRleHR1cmVcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVGbG9hdFJlbmRlcmFibGUgPSB0ZXN0UmVuZGVyYWJsZShnbCwgZ2wuRkxPQVQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0d28gZXh0ZW5zaW9ucyBhbGxvdyB1cyB0byByZW5kZXIgdG8gaGFsZiBmbG9hdCBidWZmZXJzXG4gICAgICAgIGlmICh0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0KSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlID0gISF0aGlzLmV4dENvbG9yQnVmZmVySGFsZkZsb2F0O1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gRVhUX2NvbG9yX2J1ZmZlcl9mbG9hdCBzaG91bGQgYWZmZWN0IGJvdGggZmxvYXQgYW5kIGhhbGZmbG9hdCBmb3JtYXRzXG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9ICEhdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBNYW51YWwgcmVuZGVyIGNoZWNrIGZvciBoYWxmIGZsb2F0XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IHRlc3RSZW5kZXJhYmxlKGdsLCB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQuSEFMRl9GTE9BVF9PRVMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlID0gKHRoaXMubWF4UHJlY2lzaW9uID09PSBcImhpZ2hwXCIgJiYgdGhpcy5tYXhWZXJ0ZXhUZXh0dXJlcyA+PSAyKTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c0RlcHRoU2hhZG93ID0gdGhpcy53ZWJnbDI7XG5cbiAgICAgICAgdGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBhcmVhIGxpZ2h0IExVVCBmb3JtYXQgLSBvcmRlciBvZiBwcmVmZXJlbmNlOiBoYWxmLCBmbG9hdCwgOGJpdFxuICAgICAgICB0aGlzLmFyZWFMaWdodEx1dEZvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkE4O1xuICAgICAgICBpZiAodGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0ICYmIHRoaXMudGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSAmJiB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXRMaW5lYXIpIHtcbiAgICAgICAgICAgIHRoaXMuYXJlYUxpZ2h0THV0Rm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmV4dFRleHR1cmVGbG9hdCAmJiB0aGlzLmV4dFRleHR1cmVGbG9hdExpbmVhcikge1xuICAgICAgICAgICAgdGhpcy5hcmVhTGlnaHRMdXRGb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBMzJGO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wb3N0SW5pdCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGhpcy5mZWVkYmFjaykge1xuICAgICAgICAgICAgZ2wuZGVsZXRlVHJhbnNmb3JtRmVlZGJhY2sodGhpcy5mZWVkYmFjayk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNsZWFyVmVydGV4QXJyYXlPYmplY3RDYWNoZSgpO1xuXG4gICAgICAgIHRoaXMuY2FudmFzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmdsY29udGV4dGxvc3QnLCB0aGlzLl9jb250ZXh0TG9zdEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2ViZ2xjb250ZXh0cmVzdG9yZWQnLCB0aGlzLl9jb250ZXh0UmVzdG9yZWRIYW5kbGVyLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5fY29udGV4dExvc3RIYW5kbGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fY29udGV4dFJlc3RvcmVkSGFuZGxlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5nbCA9IG51bGw7XG5cbiAgICAgICAgc3VwZXIucG9zdERlc3Ryb3koKTtcbiAgICB9XG5cbiAgICAvLyBwcm92aWRlIHdlYmdsIGltcGxlbWVudGF0aW9uIGZvciB0aGUgdmVydGV4IGJ1ZmZlclxuICAgIGNyZWF0ZVZlcnRleEJ1ZmZlckltcGwodmVydGV4QnVmZmVyLCBmb3JtYXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbFZlcnRleEJ1ZmZlcigpO1xuICAgIH1cblxuICAgIC8vIHByb3ZpZGUgd2ViZ2wgaW1wbGVtZW50YXRpb24gZm9yIHRoZSBpbmRleCBidWZmZXJcbiAgICBjcmVhdGVJbmRleEJ1ZmZlckltcGwoaW5kZXhCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBXZWJnbEluZGV4QnVmZmVyKGluZGV4QnVmZmVyKTtcbiAgICB9XG5cbiAgICBjcmVhdGVTaGFkZXJJbXBsKHNoYWRlcikge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsU2hhZGVyKHNoYWRlcik7XG4gICAgfVxuXG4gICAgY3JlYXRlVGV4dHVyZUltcGwodGV4dHVyZSkge1xuICAgICAgICByZXR1cm4gbmV3IFdlYmdsVGV4dHVyZSgpO1xuICAgIH1cblxuICAgIGNyZWF0ZVJlbmRlclRhcmdldEltcGwocmVuZGVyVGFyZ2V0KSB7XG4gICAgICAgIHJldHVybiBuZXcgV2ViZ2xSZW5kZXJUYXJnZXQoKTtcbiAgICB9XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgcHVzaE1hcmtlcihuYW1lKSB7XG4gICAgICAgIGlmICh3aW5kb3cuc3BlY3Rvcikge1xuICAgICAgICAgICAgY29uc3QgbGFiZWwgPSBEZWJ1Z0dyYXBoaWNzLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB3aW5kb3cuc3BlY3Rvci5zZXRNYXJrZXIoYCR7bGFiZWx9ICNgKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHBvcE1hcmtlcigpIHtcbiAgICAgICAgaWYgKHdpbmRvdy5zcGVjdG9yKSB7XG4gICAgICAgICAgICBjb25zdCBsYWJlbCA9IERlYnVnR3JhcGhpY3MudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIGlmIChsYWJlbC5sZW5ndGgpXG4gICAgICAgICAgICAgICAgd2luZG93LnNwZWN0b3Iuc2V0TWFya2VyKGAke2xhYmVsfSAjYCk7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgd2luZG93LnNwZWN0b3IuY2xlYXJNYXJrZXIoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyAjZW5kaWZcblxuICAgIC8qKlxuICAgICAqIFF1ZXJ5IHRoZSBwcmVjaXNpb24gc3VwcG9ydGVkIGJ5IGludHMgYW5kIGZsb2F0cyBpbiB2ZXJ0ZXggYW5kIGZyYWdtZW50IHNoYWRlcnMuIE5vdGUgdGhhdFxuICAgICAqIGdldFNoYWRlclByZWNpc2lvbkZvcm1hdCBpcyBub3QgZ3VhcmFudGVlZCB0byBiZSBwcmVzZW50IChzdWNoIGFzIHNvbWUgaW5zdGFuY2VzIG9mIHRoZVxuICAgICAqIGRlZmF1bHQgQW5kcm9pZCBicm93c2VyKS4gSW4gdGhpcyBjYXNlLCBhc3N1bWUgaGlnaHAgaXMgYXZhaWxhYmxlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ30gXCJoaWdocFwiLCBcIm1lZGl1bXBcIiBvciBcImxvd3BcIlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRQcmVjaXNpb24oKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgbGV0IHByZWNpc2lvbiA9IFwiaGlnaHBcIjtcblxuICAgICAgICBpZiAoZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KSB7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLlZFUlRFWF9TSEFERVIsIGdsLkhJR0hfRkxPQVQpO1xuICAgICAgICAgICAgY29uc3QgdmVydGV4U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0ID0gZ2wuZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0KGdsLlZFUlRFWF9TSEFERVIsIGdsLk1FRElVTV9GTE9BVCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGZyYWdtZW50U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdCA9IGdsLmdldFNoYWRlclByZWNpc2lvbkZvcm1hdChnbC5GUkFHTUVOVF9TSEFERVIsIGdsLkhJR0hfRkxPQVQpO1xuICAgICAgICAgICAgY29uc3QgZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQgPSBnbC5nZXRTaGFkZXJQcmVjaXNpb25Gb3JtYXQoZ2wuRlJBR01FTlRfU0hBREVSLCBnbC5NRURJVU1fRkxPQVQpO1xuXG4gICAgICAgICAgICBjb25zdCBoaWdocEF2YWlsYWJsZSA9IHZlcnRleFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQucHJlY2lzaW9uID4gMCAmJiBmcmFnbWVudFNoYWRlclByZWNpc2lvbkhpZ2hwRmxvYXQucHJlY2lzaW9uID4gMDtcbiAgICAgICAgICAgIGNvbnN0IG1lZGl1bXBBdmFpbGFibGUgPSB2ZXJ0ZXhTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQucHJlY2lzaW9uID4gMCAmJiBmcmFnbWVudFNoYWRlclByZWNpc2lvbk1lZGl1bXBGbG9hdC5wcmVjaXNpb24gPiAwO1xuXG4gICAgICAgICAgICBpZiAoIWhpZ2hwQXZhaWxhYmxlKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1lZGl1bXBBdmFpbGFibGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gXCJtZWRpdW1wXCI7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJXQVJOSU5HOiBoaWdocCBub3Qgc3VwcG9ydGVkLCB1c2luZyBtZWRpdW1wXCIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByZWNpc2lvbiA9IFwibG93cFwiO1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKFwiV0FSTklORzogaGlnaHAgYW5kIG1lZGl1bXAgbm90IHN1cHBvcnRlZCwgdXNpbmcgbG93cFwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcHJlY2lzaW9uO1xuICAgIH1cblxuICAgIGdldEV4dGVuc2lvbigpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnN1cHBvcnRlZEV4dGVuc2lvbnMuaW5kZXhPZihhcmd1bWVudHNbaV0pICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdsLmdldEV4dGVuc2lvbihhcmd1bWVudHNbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGdldCBleHREaXNqb2ludFRpbWVyUXVlcnkoKSB7XG4gICAgICAgIC8vIGxhenkgZXZhbHVhdGlvbiBhcyB0aGlzIGlzIG5vdCB0eXBpY2FsbHkgdXNlZFxuICAgICAgICBpZiAoIXRoaXMuX2V4dERpc2pvaW50VGltZXJRdWVyeSkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgLy8gTm90ZSB0aGF0IEZpcmVmb3ggZXhwb3NlcyBFWFRfZGlzam9pbnRfdGltZXJfcXVlcnkgdW5kZXIgV2ViR0wyIHJhdGhlciB0aGFuIEVYVF9kaXNqb2ludF90aW1lcl9xdWVyeV93ZWJnbDJcbiAgICAgICAgICAgICAgICB0aGlzLl9leHREaXNqb2ludFRpbWVyUXVlcnkgPSB0aGlzLmdldEV4dGVuc2lvbignRVhUX2Rpc2pvaW50X3RpbWVyX3F1ZXJ5X3dlYmdsMicsICdFWFRfZGlzam9pbnRfdGltZXJfcXVlcnknKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fZXh0RGlzam9pbnRUaW1lclF1ZXJ5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgdGhlIGV4dGVuc2lvbnMgcHJvdmlkZWQgYnkgdGhlIFdlYkdMIGNvbnRleHQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgY29uc3Qgc3VwcG9ydGVkRXh0ZW5zaW9ucyA9IGdsLmdldFN1cHBvcnRlZEV4dGVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5zdXBwb3J0ZWRFeHRlbnNpb25zID0gc3VwcG9ydGVkRXh0ZW5zaW9ucztcblxuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMuZXh0QmxlbmRNaW5tYXggPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHREcmF3QnVmZmVycyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmRyYXdCdWZmZXJzID0gZ2wuZHJhd0J1ZmZlcnMuYmluZChnbCk7XG4gICAgICAgICAgICB0aGlzLmV4dEluc3RhbmNpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUZsb2F0ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5leHRVaW50RWxlbWVudCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmV4dFZlcnRleEFycmF5T2JqZWN0ID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJGbG9hdCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdFWFRfY29sb3JfYnVmZmVyX2Zsb2F0Jyk7XG4gICAgICAgICAgICB0aGlzLmV4dERlcHRoVGV4dHVyZSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmV4dEJsZW5kTWlubWF4ID0gdGhpcy5nZXRFeHRlbnNpb24oXCJFWFRfYmxlbmRfbWlubWF4XCIpO1xuICAgICAgICAgICAgdGhpcy5leHREcmF3QnVmZmVycyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kcmF3X2J1ZmZlcnMnKTtcbiAgICAgICAgICAgIHRoaXMuZXh0SW5zdGFuY2luZyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiQU5HTEVfaW5zdGFuY2VkX2FycmF5c1wiKTtcbiAgICAgICAgICAgIHRoaXMuZHJhd0J1ZmZlcnMgPSB0aGlzLmV4dERyYXdCdWZmZXJzPy5kcmF3QnVmZmVyc1dFQkdMLmJpbmQodGhpcy5leHREcmF3QnVmZmVycyk7XG4gICAgICAgICAgICBpZiAodGhpcy5leHRJbnN0YW5jaW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zdGFsbCB0aGUgV2ViR0wgMiBJbnN0YW5jaW5nIEFQSSBmb3IgV2ViR0wgMS4wXG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ID0gdGhpcy5leHRJbnN0YW5jaW5nO1xuICAgICAgICAgICAgICAgIGdsLmRyYXdBcnJheXNJbnN0YW5jZWQgPSBleHQuZHJhd0FycmF5c0luc3RhbmNlZEFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5kcmF3RWxlbWVudHNJbnN0YW5jZWQgPSBleHQuZHJhd0VsZW1lbnRzSW5zdGFuY2VkQU5HTEUuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLnZlcnRleEF0dHJpYkRpdmlzb3IgPSBleHQudmVydGV4QXR0cmliRGl2aXNvckFOR0xFLmJpbmQoZXh0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzID0gdGhpcy5nZXRFeHRlbnNpb24oXCJPRVNfc3RhbmRhcmRfZGVyaXZhdGl2ZXNcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVGbG9hdCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX3RleHR1cmVfZmxvYXRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVIYWxmRmxvYXQgPSB0aGlzLmdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2hhbGZfZmxvYXRcIik7XG4gICAgICAgICAgICB0aGlzLmV4dFRleHR1cmVMb2QgPSB0aGlzLmdldEV4dGVuc2lvbignRVhUX3NoYWRlcl90ZXh0dXJlX2xvZCcpO1xuICAgICAgICAgICAgdGhpcy5leHRVaW50RWxlbWVudCA9IHRoaXMuZ2V0RXh0ZW5zaW9uKFwiT0VTX2VsZW1lbnRfaW5kZXhfdWludFwiKTtcbiAgICAgICAgICAgIHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QgPSB0aGlzLmdldEV4dGVuc2lvbihcIk9FU192ZXJ0ZXhfYXJyYXlfb2JqZWN0XCIpO1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAvLyBJbnN0YWxsIHRoZSBXZWJHTCAyIFZBTyBBUEkgZm9yIFdlYkdMIDEuMFxuICAgICAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VmVydGV4QXJyYXlPYmplY3Q7XG4gICAgICAgICAgICAgICAgZ2wuY3JlYXRlVmVydGV4QXJyYXkgPSBleHQuY3JlYXRlVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmRlbGV0ZVZlcnRleEFycmF5ID0gZXh0LmRlbGV0ZVZlcnRleEFycmF5T0VTLmJpbmQoZXh0KTtcbiAgICAgICAgICAgICAgICBnbC5pc1ZlcnRleEFycmF5ID0gZXh0LmlzVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSA9IGV4dC5iaW5kVmVydGV4QXJyYXlPRVMuYmluZChleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5leHRDb2xvckJ1ZmZlckZsb2F0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXh0RGVwdGhUZXh0dXJlID0gZ2wuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9kZXB0aF90ZXh0dXJlJyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4dERlYnVnUmVuZGVyZXJJbmZvID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2RlYnVnX3JlbmRlcmVyX2luZm8nKTtcbiAgICAgICAgdGhpcy5leHRUZXh0dXJlRmxvYXRMaW5lYXIgPSB0aGlzLmdldEV4dGVuc2lvbihcIk9FU190ZXh0dXJlX2Zsb2F0X2xpbmVhclwiKTtcbiAgICAgICAgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyID0gdGhpcy5nZXRFeHRlbnNpb24oXCJPRVNfdGV4dHVyZV9oYWxmX2Zsb2F0X2xpbmVhclwiKTtcbiAgICAgICAgdGhpcy5leHRGbG9hdEJsZW5kID0gdGhpcy5nZXRFeHRlbnNpb24oXCJFWFRfZmxvYXRfYmxlbmRcIik7XG4gICAgICAgIHRoaXMuZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljID0gdGhpcy5nZXRFeHRlbnNpb24oJ0VYVF90ZXh0dXJlX2ZpbHRlcl9hbmlzb3Ryb3BpYycsICdXRUJLSVRfRVhUX3RleHR1cmVfZmlsdGVyX2FuaXNvdHJvcGljJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxID0gdGhpcy5nZXRFeHRlbnNpb24oJ1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9ldGMxJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX2V0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3B2cnRjJywgJ1dFQktJVF9XRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfcHZydGMnKTtcbiAgICAgICAgdGhpcy5leHRDb21wcmVzc2VkVGV4dHVyZVMzVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX3MzdGMnLCAnV0VCS0lUX1dFQkdMX2NvbXByZXNzZWRfdGV4dHVyZV9zM3RjJyk7XG4gICAgICAgIHRoaXMuZXh0Q29tcHJlc3NlZFRleHR1cmVBVEMgPSB0aGlzLmdldEV4dGVuc2lvbignV0VCR0xfY29tcHJlc3NlZF90ZXh0dXJlX2F0YycpO1xuICAgICAgICB0aGlzLmV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdXRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfYXN0YycpO1xuICAgICAgICB0aGlzLmV4dFBhcmFsbGVsU2hhZGVyQ29tcGlsZSA9IHRoaXMuZ2V0RXh0ZW5zaW9uKCdLSFJfcGFyYWxsZWxfc2hhZGVyX2NvbXBpbGUnKTtcblxuICAgICAgICAvLyBpT1MgZXhwb3NlcyB0aGlzIGZvciBoYWxmIHByZWNpc2lvbiByZW5kZXIgdGFyZ2V0cyBvbiBib3RoIFdlYmdsMSBhbmQgMiBmcm9tIGlPUyB2IDE0LjViZXRhXG4gICAgICAgIHRoaXMuZXh0Q29sb3JCdWZmZXJIYWxmRmxvYXQgPSB0aGlzLmdldEV4dGVuc2lvbihcIkVYVF9jb2xvcl9idWZmZXJfaGFsZl9mbG9hdFwiKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyeSB0aGUgY2FwYWJpbGl0aWVzIG9mIHRoZSBXZWJHTCBjb250ZXh0LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGluaXRpYWxpemVDYXBhYmlsaXRpZXMoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgbGV0IGV4dDtcblxuICAgICAgICBjb25zdCB1c2VyQWdlbnQgPSB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyA/IG5hdmlnYXRvci51c2VyQWdlbnQgOiBcIlwiO1xuXG4gICAgICAgIHRoaXMubWF4UHJlY2lzaW9uID0gdGhpcy5wcmVjaXNpb24gPSB0aGlzLmdldFByZWNpc2lvbigpO1xuXG4gICAgICAgIGNvbnN0IGNvbnRleHRBdHRyaWJzID0gZ2wuZ2V0Q29udGV4dEF0dHJpYnV0ZXMoKTtcbiAgICAgICAgdGhpcy5zdXBwb3J0c01zYWEgPSBjb250ZXh0QXR0cmlicy5hbnRpYWxpYXM7XG4gICAgICAgIHRoaXMuc3VwcG9ydHNTdGVuY2lsID0gY29udGV4dEF0dHJpYnMuc3RlbmNpbDtcblxuICAgICAgICB0aGlzLnN1cHBvcnRzSW5zdGFuY2luZyA9ICEhdGhpcy5leHRJbnN0YW5jaW5nO1xuXG4gICAgICAgIC8vIFF1ZXJ5IHBhcmFtZXRlciB2YWx1ZXMgZnJvbSB0aGUgV2ViR0wgY29udGV4dFxuICAgICAgICB0aGlzLm1heFRleHR1cmVTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9URVhUVVJFX1NJWkUpO1xuICAgICAgICB0aGlzLm1heEN1YmVNYXBTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9DVUJFX01BUF9URVhUVVJFX1NJWkUpO1xuICAgICAgICB0aGlzLm1heFJlbmRlckJ1ZmZlclNpemUgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1JFTkRFUkJVRkZFUl9TSVpFKTtcbiAgICAgICAgdGhpcy5tYXhUZXh0dXJlcyA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMubWF4Q29tYmluZWRUZXh0dXJlcyA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfQ09NQklORURfVEVYVFVSRV9JTUFHRV9VTklUUyk7XG4gICAgICAgIHRoaXMubWF4VmVydGV4VGV4dHVyZXMgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX1ZFUlRFWF9URVhUVVJFX0lNQUdFX1VOSVRTKTtcbiAgICAgICAgdGhpcy52ZXJ0ZXhVbmlmb3Jtc0NvdW50ID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF9WRVJURVhfVU5JRk9STV9WRUNUT1JTKTtcbiAgICAgICAgdGhpcy5mcmFnbWVudFVuaWZvcm1zQ291bnQgPSBnbC5nZXRQYXJhbWV0ZXIoZ2wuTUFYX0ZSQUdNRU5UX1VOSUZPUk1fVkVDVE9SUyk7XG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgdGhpcy5tYXhEcmF3QnVmZmVycyA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfRFJBV19CVUZGRVJTKTtcbiAgICAgICAgICAgIHRoaXMubWF4Q29sb3JBdHRhY2htZW50cyA9IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfQ09MT1JfQVRUQUNITUVOVFMpO1xuICAgICAgICAgICAgdGhpcy5tYXhWb2x1bWVTaXplID0gZ2wuZ2V0UGFyYW1ldGVyKGdsLk1BWF8zRF9URVhUVVJFX1NJWkUpO1xuICAgICAgICAgICAgdGhpcy5zdXBwb3J0c01ydCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLnN1cHBvcnRzVm9sdW1lVGV4dHVyZXMgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXh0ID0gdGhpcy5leHREcmF3QnVmZmVycztcbiAgICAgICAgICAgIHRoaXMuc3VwcG9ydHNNcnQgPSAhIWV4dDtcbiAgICAgICAgICAgIHRoaXMubWF4RHJhd0J1ZmZlcnMgPSBleHQgPyBnbC5nZXRQYXJhbWV0ZXIoZXh0Lk1BWF9EUkFXX0JVRkZFUlNfV0VCR0wpIDogMTtcbiAgICAgICAgICAgIHRoaXMubWF4Q29sb3JBdHRhY2htZW50cyA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuTUFYX0NPTE9SX0FUVEFDSE1FTlRTX1dFQkdMKSA6IDE7XG4gICAgICAgICAgICB0aGlzLm1heFZvbHVtZVNpemUgPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgZXh0ID0gdGhpcy5leHREZWJ1Z1JlbmRlcmVySW5mbztcbiAgICAgICAgdGhpcy51bm1hc2tlZFJlbmRlcmVyID0gZXh0ID8gZ2wuZ2V0UGFyYW1ldGVyKGV4dC5VTk1BU0tFRF9SRU5ERVJFUl9XRUJHTCkgOiAnJztcbiAgICAgICAgdGhpcy51bm1hc2tlZFZlbmRvciA9IGV4dCA/IGdsLmdldFBhcmFtZXRlcihleHQuVU5NQVNLRURfVkVORE9SX1dFQkdMKSA6ICcnO1xuXG4gICAgICAgIC8vIE1hbGktRzUyIGhhcyByZW5kZXJpbmcgaXNzdWVzIHdpdGggR1BVIHBhcnRpY2xlcyBpbmNsdWRpbmdcbiAgICAgICAgLy8gU00tQTIyNU0sIE0yMDAzSjE1U0MgYW5kIEtGUkFXSSAoQW1hem9uIEZpcmUgSEQgOCAyMDIyKVxuICAgICAgICBjb25zdCBtYWxpUmVuZGVyZXJSZWdleCA9IC9cXGJNYWxpLUc1MisvO1xuXG4gICAgICAgIC8vIFNhbXN1bmcgZGV2aWNlcyB3aXRoIEV4eW5vcyAoQVJNKSBlaXRoZXIgY3Jhc2ggb3IgcmVuZGVyIGluY29ycmVjdGx5IHdoZW4gdXNpbmcgR1BVIGZvciBwYXJ0aWNsZXMuIFNlZTpcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3BsYXljYW52YXMvZW5naW5lL2lzc3Vlcy8zOTY3XG4gICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9wbGF5Y2FudmFzL2VuZ2luZS9pc3N1ZXMvMzQxNVxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcGxheWNhbnZhcy9lbmdpbmUvaXNzdWVzLzQ1MTRcbiAgICAgICAgLy8gRXhhbXBsZSBVQSBtYXRjaGVzOiBTdGFydGluZyAnU00nIGFuZCBhbnkgY29tYmluYXRpb24gb2YgbGV0dGVycyBvciBudW1iZXJzOlxuICAgICAgICAvLyBNb3ppbGxhLzUuMCAoTGludXgsIEFuZHJvaWQgMTI7IFNNLUc5NzBGIEJ1aWxkL1NQMUEuMjEwODEyLjAxNjsgd3YpXG4gICAgICAgIGNvbnN0IHNhbXN1bmdNb2RlbFJlZ2V4ID0gL1NNLVthLXpBLVowLTldKy87XG4gICAgICAgIHRoaXMuc3VwcG9ydHNHcHVQYXJ0aWNsZXMgPSAhKHRoaXMudW5tYXNrZWRWZW5kb3IgPT09ICdBUk0nICYmIHVzZXJBZ2VudC5tYXRjaChzYW1zdW5nTW9kZWxSZWdleCkpICYmXG4gICAgICAgICAgICAhKHRoaXMudW5tYXNrZWRSZW5kZXJlci5tYXRjaChtYWxpUmVuZGVyZXJSZWdleCkpO1xuXG4gICAgICAgIGV4dCA9IHRoaXMuZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljO1xuICAgICAgICB0aGlzLm1heEFuaXNvdHJvcHkgPSBleHQgPyBnbC5nZXRQYXJhbWV0ZXIoZXh0Lk1BWF9URVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCkgOiAxO1xuXG4gICAgICAgIHRoaXMuc2FtcGxlcyA9IGdsLmdldFBhcmFtZXRlcihnbC5TQU1QTEVTKTtcbiAgICAgICAgdGhpcy5tYXhTYW1wbGVzID0gdGhpcy53ZWJnbDIgJiYgIXRoaXMuZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZyA/IGdsLmdldFBhcmFtZXRlcihnbC5NQVhfU0FNUExFUykgOiAxO1xuXG4gICAgICAgIC8vIERvbid0IGFsbG93IGFyZWEgbGlnaHRzIG9uIG9sZCBhbmRyb2lkIGRldmljZXMsIHRoZXkgb2Z0ZW4gZmFpbCB0byBjb21waWxlIHRoZSBzaGFkZXIsIHJ1biBpdCBpbmNvcnJlY3RseSBvciBhcmUgdmVyeSBzbG93LlxuICAgICAgICB0aGlzLnN1cHBvcnRzQXJlYUxpZ2h0cyA9IHRoaXMud2ViZ2wyIHx8ICFwbGF0Zm9ybS5hbmRyb2lkO1xuXG4gICAgICAgIC8vIHN1cHBvcnRzIHRleHR1cmUgZmV0Y2ggaW5zdHJ1Y3Rpb25cbiAgICAgICAgdGhpcy5zdXBwb3J0c1RleHR1cmVGZXRjaCA9IHRoaXMud2ViZ2wyO1xuXG4gICAgICAgIC8vIEFsc28gZG8gbm90IGFsbG93IHRoZW0gd2hlbiB3ZSBvbmx5IGhhdmUgc21hbGwgbnVtYmVyIG9mIHRleHR1cmUgdW5pdHNcbiAgICAgICAgaWYgKHRoaXMubWF4VGV4dHVyZXMgPD0gOCkge1xuICAgICAgICAgICAgdGhpcy5zdXBwb3J0c0FyZWFMaWdodHMgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgaW5pdGlhbCByZW5kZXIgc3RhdGUgb24gdGhlIFdlYkdMIGNvbnRleHQuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCkge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplUmVuZGVyU3RhdGUoKTtcblxuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG5cbiAgICAgICAgLy8gSW5pdGlhbGl6ZSByZW5kZXIgc3RhdGUgdG8gYSBrbm93biBzdGFydCBzdGF0ZVxuXG4gICAgICAgIC8vIGRlZmF1bHQgYmxlbmQgc3RhdGVcbiAgICAgICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG4gICAgICAgIGdsLmJsZW5kRnVuYyhnbC5PTkUsIGdsLlpFUk8pO1xuICAgICAgICBnbC5ibGVuZEVxdWF0aW9uKGdsLkZVTkNfQUREKTtcbiAgICAgICAgZ2wuY29sb3JNYXNrKHRydWUsIHRydWUsIHRydWUsIHRydWUpO1xuXG4gICAgICAgIHRoaXMuYmxlbmRDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwLCAwKTtcbiAgICAgICAgZ2wuYmxlbmRDb2xvcigwLCAwLCAwLCAwKTtcblxuICAgICAgICBnbC5lbmFibGUoZ2wuQ1VMTF9GQUNFKTtcbiAgICAgICAgZ2wuY3VsbEZhY2UoZ2wuQkFDSyk7XG5cbiAgICAgICAgLy8gZGVmYXVsdCBkZXB0aCBzdGF0ZVxuICAgICAgICBnbC5lbmFibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgICAgIGdsLmRlcHRoRnVuYyhnbC5MRVFVQUwpO1xuICAgICAgICBnbC5kZXB0aE1hc2sodHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5zdGVuY2lsID0gZmFsc2U7XG4gICAgICAgIGdsLmRpc2FibGUoZ2wuU1RFTkNJTF9URVNUKTtcblxuICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgPSB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IEZVTkNfQUxXQVlTO1xuICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHRoaXMuc3RlbmNpbFJlZkJhY2sgPSAwO1xuICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgPSB0aGlzLnN0ZW5jaWxNYXNrQmFjayA9IDB4RkY7XG4gICAgICAgIGdsLnN0ZW5jaWxGdW5jKGdsLkFMV0FZUywgMCwgMHhGRik7XG5cbiAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEZyb250ID0gdGhpcy5zdGVuY2lsRmFpbEJhY2sgPSBTVEVOQ0lMT1BfS0VFUDtcbiAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxGcm9udCA9IHRoaXMuc3RlbmNpbFpmYWlsQmFjayA9IFNURU5DSUxPUF9LRUVQO1xuICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ID0gdGhpcy5zdGVuY2lsWnBhc3NCYWNrID0gU1RFTkNJTE9QX0tFRVA7XG4gICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ID0gMHhGRjtcbiAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayA9IDB4RkY7XG4gICAgICAgIGdsLnN0ZW5jaWxPcChnbC5LRUVQLCBnbC5LRUVQLCBnbC5LRUVQKTtcbiAgICAgICAgZ2wuc3RlbmNpbE1hc2soMHhGRik7XG5cbiAgICAgICAgdGhpcy5hbHBoYVRvQ292ZXJhZ2UgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5yYXN0ZXIgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuU0FNUExFX0FMUEhBX1RPX0NPVkVSQUdFKTtcbiAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuUkFTVEVSSVpFUl9ESVNDQVJEKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGVwdGhCaWFzRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICBnbC5kaXNhYmxlKGdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xuXG4gICAgICAgIHRoaXMuY2xlYXJEZXB0aCA9IDE7XG4gICAgICAgIGdsLmNsZWFyRGVwdGgoMSk7XG5cbiAgICAgICAgdGhpcy5jbGVhckNvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDApO1xuICAgICAgICBnbC5jbGVhckNvbG9yKDAsIDAsIDAsIDApO1xuXG4gICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsID0gMDtcbiAgICAgICAgZ2wuY2xlYXJTdGVuY2lsKDApO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgZ2wuaGludChnbC5GUkFHTUVOVF9TSEFERVJfREVSSVZBVElWRV9ISU5ULCBnbC5OSUNFU1QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykge1xuICAgICAgICAgICAgICAgIGdsLmhpbnQodGhpcy5leHRTdGFuZGFyZERlcml2YXRpdmVzLkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlRfT0VTLCBnbC5OSUNFU1QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZ2wuZW5hYmxlKGdsLlNDSVNTT1JfVEVTVCk7XG5cbiAgICAgICAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTl9XRUJHTCwgZ2wuTk9ORSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZhbHNlO1xuICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gZmFsc2U7XG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgZmFsc2UpO1xuXG4gICAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19BTElHTk1FTlQsIDEpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb250ZXh0Q2FjaGVzKCkge1xuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29udGV4dENhY2hlcygpO1xuXG4gICAgICAgIC8vIGNhY2hlIG9mIFZBT3NcbiAgICAgICAgdGhpcy5fdmFvTWFwID0gbmV3IE1hcCgpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuICAgICAgICB0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5mZWVkYmFjayA9IG51bGw7XG4gICAgICAgIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudGV4dHVyZVVuaXQgPSAwO1xuICAgICAgICB0aGlzLnRleHR1cmVVbml0cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWF4Q29tYmluZWRUZXh0dXJlczsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0cy5wdXNoKFtudWxsLCBudWxsLCBudWxsXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgV2ViR0wgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIC8vIHJlbGVhc2Ugc2hhZGVyc1xuICAgICAgICBmb3IgKGNvbnN0IHNoYWRlciBvZiB0aGlzLnNoYWRlcnMpIHtcbiAgICAgICAgICAgIHNoYWRlci5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGNvbnN0IHRleHR1cmUgb2YgdGhpcy50ZXh0dXJlcykge1xuICAgICAgICAgICAgdGV4dHVyZS5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVsZWFzZSB2ZXJ0ZXggYW5kIGluZGV4IGJ1ZmZlcnNcbiAgICAgICAgZm9yIChjb25zdCBidWZmZXIgb2YgdGhpcy5idWZmZXJzKSB7XG4gICAgICAgICAgICBidWZmZXIubG9zZUNvbnRleHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc2V0IGFsbCByZW5kZXIgdGFyZ2V0cyBzbyB0aGV5J2xsIGJlIHJlY3JlYXRlZCBhcyByZXF1aXJlZC5cbiAgICAgICAgLy8gVE9ETzogYSBzb2x1dGlvbiBmb3IgdGhlIGNhc2Ugd2hlcmUgYSByZW5kZXIgdGFyZ2V0IGNvbnRhaW5zIHNvbWV0aGluZ1xuICAgICAgICAvLyB0aGF0IHdhcyBwcmV2aW91c2x5IGdlbmVyYXRlZCB0aGF0IG5lZWRzIHRvIGJlIHJlLXJlbmRlcmVkLlxuICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiB0aGlzLnRhcmdldHMpIHtcbiAgICAgICAgICAgIHRhcmdldC5sb3NlQ29udGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgaXMgcmVzdG9yZWQuIEl0IHJlaW5pdGlhbGl6ZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVzdG9yZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUV4dGVuc2lvbnMoKTtcbiAgICAgICAgdGhpcy5pbml0aWFsaXplQ2FwYWJpbGl0aWVzKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVJlbmRlclN0YXRlKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMoKTtcblxuICAgICAgICAvLyBSZWNvbXBpbGUgYWxsIHNoYWRlcnMgKHRoZXknbGwgYmUgbGlua2VkIHdoZW4gdGhleSdyZSBuZXh0IGFjdHVhbGx5IHVzZWQpXG4gICAgICAgIGZvciAoY29uc3Qgc2hhZGVyIG9mIHRoaXMuc2hhZGVycykge1xuICAgICAgICAgICAgc2hhZGVyLnJlc3RvcmVDb250ZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWNyZWF0ZSBidWZmZXIgb2JqZWN0cyBhbmQgcmV1cGxvYWQgYnVmZmVyIGRhdGEgdG8gdGhlIEdQVVxuICAgICAgICBmb3IgKGNvbnN0IGJ1ZmZlciBvZiB0aGlzLmJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIGJ1ZmZlci51bmxvY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCBhZnRlciBhIGJhdGNoIG9mIHNoYWRlcnMgd2FzIGNyZWF0ZWQsIHRvIGd1aWRlIGluIHRoZWlyIG9wdGltYWwgcHJlcGFyYXRpb24gZm9yIHJlbmRlcmluZy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBlbmRTaGFkZXJCYXRjaCgpIHtcbiAgICAgICAgV2ViZ2xTaGFkZXIuZW5kU2hhZGVyQmF0Y2godGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBhY3RpdmUgcmVjdGFuZ2xlIGZvciByZW5kZXJpbmcgb24gdGhlIHNwZWNpZmllZCBkZXZpY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSBwaXhlbCBzcGFjZSB4LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgdmlld3BvcnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgcGl4ZWwgc3BhY2UgeS1jb29yZGluYXRlIG9mIHRoZSBib3R0b20gbGVmdCBjb3JuZXIgb2YgdGhlIHZpZXdwb3J0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSB2aWV3cG9ydCBpbiBwaXhlbHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSB2aWV3cG9ydCBpbiBwaXhlbHMuXG4gICAgICovXG4gICAgc2V0Vmlld3BvcnQoeCwgeSwgdywgaCkge1xuICAgICAgICBpZiAoKHRoaXMudnggIT09IHgpIHx8ICh0aGlzLnZ5ICE9PSB5KSB8fCAodGhpcy52dyAhPT0gdykgfHwgKHRoaXMudmggIT09IGgpKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnZpZXdwb3J0KHgsIHksIHcsIGgpO1xuICAgICAgICAgICAgdGhpcy52eCA9IHg7XG4gICAgICAgICAgICB0aGlzLnZ5ID0geTtcbiAgICAgICAgICAgIHRoaXMudncgPSB3O1xuICAgICAgICAgICAgdGhpcy52aCA9IGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGFjdGl2ZSBzY2lzc29yIHJlY3RhbmdsZSBvbiB0aGUgc3BlY2lmaWVkIGRldmljZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHBpeGVsIHNwYWNlIHgtY29vcmRpbmF0ZSBvZiB0aGUgYm90dG9tIGxlZnQgY29ybmVyIG9mIHRoZSBzY2lzc29yIHJlY3RhbmdsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSBwaXhlbCBzcGFjZSB5LWNvb3JkaW5hdGUgb2YgdGhlIGJvdHRvbSBsZWZ0IGNvcm5lciBvZiB0aGUgc2Npc3NvciByZWN0YW5nbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgd2lkdGggb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBoZWlnaHQgb2YgdGhlIHNjaXNzb3IgcmVjdGFuZ2xlIGluIHBpeGVscy5cbiAgICAgKi9cbiAgICBzZXRTY2lzc29yKHgsIHksIHcsIGgpIHtcbiAgICAgICAgaWYgKCh0aGlzLnN4ICE9PSB4KSB8fCAodGhpcy5zeSAhPT0geSkgfHwgKHRoaXMuc3cgIT09IHcpIHx8ICh0aGlzLnNoICE9PSBoKSkge1xuICAgICAgICAgICAgdGhpcy5nbC5zY2lzc29yKHgsIHksIHcsIGgpO1xuICAgICAgICAgICAgdGhpcy5zeCA9IHg7XG4gICAgICAgICAgICB0aGlzLnN5ID0geTtcbiAgICAgICAgICAgIHRoaXMuc3cgPSB3O1xuICAgICAgICAgICAgdGhpcy5zaCA9IGg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBCaW5kcyB0aGUgc3BlY2lmaWVkIGZyYW1lYnVmZmVyIG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7V2ViR0xGcmFtZWJ1ZmZlciB8IG51bGx9IGZiIC0gVGhlIGZyYW1lYnVmZmVyIHRvIGJpbmQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldEZyYW1lYnVmZmVyKGZiKSB7XG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyICE9PSBmYikge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBmYik7XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZUZyYW1lYnVmZmVyID0gZmI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgc291cmNlIHJlbmRlciB0YXJnZXQgaW50byBkZXN0aW5hdGlvbiByZW5kZXIgdGFyZ2V0LiBNb3N0bHkgdXNlZCBieSBwb3N0LWVmZmVjdHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW3NvdXJjZV0gLSBUaGUgc291cmNlIHJlbmRlciB0YXJnZXQuIERlZmF1bHRzIHRvIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge1JlbmRlclRhcmdldH0gW2Rlc3RdIC0gVGhlIGRlc3RpbmF0aW9uIHJlbmRlciB0YXJnZXQuIERlZmF1bHRzIHRvIGZyYW1lIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtjb2xvcl0gLSBJZiB0cnVlIHdpbGwgY29weSB0aGUgY29sb3IgYnVmZmVyLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aF0gLSBJZiB0cnVlIHdpbGwgY29weSB0aGUgZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgY29weSB3YXMgc3VjY2Vzc2Z1bCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGNvcHlSZW5kZXJUYXJnZXQoc291cmNlLCBkZXN0LCBjb2xvciwgZGVwdGgpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGlmICghdGhpcy53ZWJnbDIgJiYgZGVwdGgpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKFwiRGVwdGggaXMgbm90IGNvcHlhYmxlIG9uIFdlYkdMIDEuMFwiKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29sb3IpIHtcbiAgICAgICAgICAgIGlmICghZGVzdCkge1xuICAgICAgICAgICAgICAgIC8vIGNvcHlpbmcgdG8gYmFja2J1ZmZlclxuICAgICAgICAgICAgICAgIGlmICghc291cmNlLl9jb2xvckJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihcIkNhbid0IGNvcHkgZW1wdHkgY29sb3IgYnVmZmVyIHRvIGJhY2tidWZmZXJcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNvdXJjZSkge1xuICAgICAgICAgICAgICAgIC8vIGNvcHlpbmcgdG8gcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgICAgIGlmICghc291cmNlLl9jb2xvckJ1ZmZlciB8fCAhZGVzdC5fY29sb3JCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IGNvbG9yIGJ1ZmZlciwgYmVjYXVzZSBvbmUgb2YgdGhlIHJlbmRlciB0YXJnZXRzIGRvZXNuJ3QgaGF2ZSBpdFwiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc291cmNlLl9jb2xvckJ1ZmZlci5fZm9ybWF0ICE9PSBkZXN0Ll9jb2xvckJ1ZmZlci5fZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSByZW5kZXIgdGFyZ2V0cyBvZiBkaWZmZXJlbnQgY29sb3IgZm9ybWF0c1wiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZGVwdGggJiYgc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoIXNvdXJjZS5fZGVwdGgpIHsgICAvLyB3aGVuIGRlcHRoIGlzIGF1dG9tYXRpYywgd2UgY2Fubm90IHRlc3QgdGhlIGJ1ZmZlciBub3IgaXRzIGZvcm1hdFxuICAgICAgICAgICAgICAgIGlmICghc291cmNlLl9kZXB0aEJ1ZmZlciB8fCAhZGVzdC5fZGVwdGhCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJDYW4ndCBjb3B5IGRlcHRoIGJ1ZmZlciwgYmVjYXVzZSBvbmUgb2YgdGhlIHJlbmRlciB0YXJnZXRzIGRvZXNuJ3QgaGF2ZSBpdFwiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc291cmNlLl9kZXB0aEJ1ZmZlci5fZm9ybWF0ICE9PSBkZXN0Ll9kZXB0aEJ1ZmZlci5fZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiQ2FuJ3QgY29weSByZW5kZXIgdGFyZ2V0cyBvZiBkaWZmZXJlbnQgZGVwdGggZm9ybWF0c1wiKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCAnQ09QWS1SVCcpO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMiAmJiBkZXN0KSB7XG4gICAgICAgICAgICBjb25zdCBwcmV2UnQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gZGVzdDtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlQmVnaW4oKTtcbiAgICAgICAgICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5SRUFEX0ZSQU1FQlVGRkVSLCBzb3VyY2UgPyBzb3VyY2UuaW1wbC5fZ2xGcmFtZUJ1ZmZlciA6IG51bGwpO1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIGRlc3QuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG4gICAgICAgICAgICBjb25zdCB3ID0gc291cmNlID8gc291cmNlLndpZHRoIDogZGVzdC53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IGggPSBzb3VyY2UgPyBzb3VyY2UuaGVpZ2h0IDogZGVzdC5oZWlnaHQ7XG4gICAgICAgICAgICBnbC5ibGl0RnJhbWVidWZmZXIoMCwgMCwgdywgaCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLCAwLCB3LCBoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChjb2xvciA/IGdsLkNPTE9SX0JVRkZFUl9CSVQgOiAwKSB8IChkZXB0aCA/IGdsLkRFUFRIX0JVRkZFUl9CSVQgOiAwKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbC5ORUFSRVNUKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gcHJldlJ0O1xuICAgICAgICAgICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBwcmV2UnQgPyBwcmV2UnQuaW1wbC5fZ2xGcmFtZUJ1ZmZlciA6IG51bGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc2hhZGVyID0gdGhpcy5nZXRDb3B5U2hhZGVyKCk7XG4gICAgICAgICAgICB0aGlzLmNvbnN0YW50VGV4U291cmNlLnNldFZhbHVlKHNvdXJjZS5fY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgcXVhZFdpdGhTaGFkZXIodGhpcywgZGVzdCwgc2hhZGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBjb3B5IHNoYWRlciBmb3IgZWZmaWNpZW50IHJlbmRlcmluZyBvZiBmdWxsc2NyZWVuLXF1YWQgd2l0aCB0ZXh0dXJlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge1NoYWRlcn0gVGhlIGNvcHkgc2hhZGVyIChiYXNlZCBvbiBgZnVsbHNjcmVlblF1YWRWU2AgYW5kIGBvdXRwdXRUZXgyRFBTYCBpblxuICAgICAqIGBzaGFkZXJDaHVua3NgKS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0Q29weVNoYWRlcigpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb3B5U2hhZGVyKSB7XG4gICAgICAgICAgICB0aGlzLl9jb3B5U2hhZGVyID0gbmV3IFNoYWRlcih0aGlzLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKHRoaXMsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3V0cHV0VGV4MkQnLFxuICAgICAgICAgICAgICAgIHZlcnRleENvZGU6IF9mdWxsU2NyZWVuUXVhZFZTLFxuICAgICAgICAgICAgICAgIGZyYWdtZW50Q29kZTogX291dHB1dFRleHR1cmUyRFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jb3B5U2hhZGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IGEgcmVuZGVyIHBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcmVuZGVyLXBhc3MuanMnKS5SZW5kZXJQYXNzfSByZW5kZXJQYXNzIC0gVGhlIHJlbmRlciBwYXNzIHRvIHN0YXJ0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGFydFBhc3MocmVuZGVyUGFzcykge1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgU1RBUlQtUEFTU2ApO1xuXG4gICAgICAgIC8vIHNldCB1cCByZW5kZXIgdGFyZ2V0XG4gICAgICAgIHRoaXMuc2V0UmVuZGVyVGFyZ2V0KHJlbmRlclBhc3MucmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgdGhpcy51cGRhdGVCZWdpbigpO1xuXG4gICAgICAgIC8vIGNsZWFyIHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IGNvbG9yT3BzID0gcmVuZGVyUGFzcy5jb2xvck9wcztcbiAgICAgICAgY29uc3QgZGVwdGhTdGVuY2lsT3BzID0gcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHM7XG4gICAgICAgIGlmIChjb2xvck9wcz8uY2xlYXIgfHwgZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGggfHwgZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCkge1xuXG4gICAgICAgICAgICAvLyB0aGUgcGFzcyBhbHdheXMgY2xlYXJzIGZ1bGwgdGFyZ2V0XG4gICAgICAgICAgICBjb25zdCBydCA9IHJlbmRlclBhc3MucmVuZGVyVGFyZ2V0O1xuICAgICAgICAgICAgY29uc3Qgd2lkdGggPSBydCA/IHJ0LndpZHRoIDogdGhpcy53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IGhlaWdodCA9IHJ0ID8gcnQuaGVpZ2h0IDogdGhpcy5oZWlnaHQ7XG4gICAgICAgICAgICB0aGlzLnNldFZpZXdwb3J0KDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICAgICAgICAgICAgdGhpcy5zZXRTY2lzc29yKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuXG4gICAgICAgICAgICBsZXQgY2xlYXJGbGFncyA9IDA7XG4gICAgICAgICAgICBjb25zdCBjbGVhck9wdGlvbnMgPSB7fTtcblxuICAgICAgICAgICAgaWYgKGNvbG9yT3BzPy5jbGVhcikge1xuICAgICAgICAgICAgICAgIGNsZWFyRmxhZ3MgfD0gQ0xFQVJGTEFHX0NPTE9SO1xuICAgICAgICAgICAgICAgIGNsZWFyT3B0aW9ucy5jb2xvciA9IFtjb2xvck9wcy5jbGVhclZhbHVlLnIsIGNvbG9yT3BzLmNsZWFyVmFsdWUuZywgY29sb3JPcHMuY2xlYXJWYWx1ZS5iLCBjb2xvck9wcy5jbGVhclZhbHVlLmFdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGgpIHtcbiAgICAgICAgICAgICAgICBjbGVhckZsYWdzIHw9IENMRUFSRkxBR19ERVBUSDtcbiAgICAgICAgICAgICAgICBjbGVhck9wdGlvbnMuZGVwdGggPSBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJEZXB0aFZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCkge1xuICAgICAgICAgICAgICAgIGNsZWFyRmxhZ3MgfD0gQ0xFQVJGTEFHX1NURU5DSUw7XG4gICAgICAgICAgICAgICAgY2xlYXJPcHRpb25zLnN0ZW5jaWwgPSBkZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsVmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIGl0XG4gICAgICAgICAgICBjbGVhck9wdGlvbnMuZmxhZ3MgPSBjbGVhckZsYWdzO1xuICAgICAgICAgICAgdGhpcy5jbGVhcihjbGVhck9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5pbnNpZGVSZW5kZXJQYXNzKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3JPbmNlKCdSZW5kZXJQYXNzIGNhbm5vdCBiZSBzdGFydGVkIHdoaWxlIGluc2lkZSBhbm90aGVyIHJlbmRlciBwYXNzLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5pbnNpZGVSZW5kZXJQYXNzID0gdHJ1ZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmQgYSByZW5kZXIgcGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9yZW5kZXItcGFzcy5qcycpLlJlbmRlclBhc3N9IHJlbmRlclBhc3MgLSBUaGUgcmVuZGVyIHBhc3MgdG8gZW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBlbmRQYXNzKHJlbmRlclBhc3MpIHtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgYEVORC1QQVNTYCk7XG5cbiAgICAgICAgdGhpcy51bmJpbmRWZXJ0ZXhBcnJheSgpO1xuXG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICBjb25zdCBjb2xvckJ1ZmZlckNvdW50ID0gcmVuZGVyUGFzcy5jb2xvckFycmF5T3BzLmxlbmd0aDtcbiAgICAgICAgaWYgKHRhcmdldCkge1xuXG4gICAgICAgICAgICAvLyBpbnZhbGlkYXRlIGJ1ZmZlcnMgdG8gc3RvcCB0aGVtIGJlaW5nIHdyaXR0ZW4gdG8gb24gdGlsZWQgYXJjaGl0ZWN0dXJlc1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgICAgICAgICAgLy8gY29sb3IgYnVmZmVyc1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29sb3JCdWZmZXJDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9yT3BzID0gcmVuZGVyUGFzcy5jb2xvckFycmF5T3BzW2ldO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGludmFsaWRhdGUgY29sb3Igb25seSBpZiB3ZSBkb24ndCBuZWVkIHRvIHJlc29sdmUgaXRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEoY29sb3JPcHMuc3RvcmUgfHwgY29sb3JPcHMucmVzb2x2ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5wdXNoKGdsLkNPTE9SX0FUVEFDSE1FTlQwICsgaSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXJlbmRlclBhc3MuZGVwdGhTdGVuY2lsT3BzLnN0b3JlRGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgaW52YWxpZGF0ZUF0dGFjaG1lbnRzLnB1c2goZ2wuREVQVEhfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghcmVuZGVyUGFzcy5kZXB0aFN0ZW5jaWxPcHMuc3RvcmVTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgICAgIGludmFsaWRhdGVBdHRhY2htZW50cy5wdXNoKGdsLlNURU5DSUxfQVRUQUNITUVOVCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGludmFsaWRhdGVBdHRhY2htZW50cy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW52YWxpZGF0ZSB0aGUgd2hvbGUgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE86IHdlIGNvdWxkIGhhbmRsZSB2aWV3cG9ydCBpbnZhbGlkYXRpb24gYXMgd2VsbFxuICAgICAgICAgICAgICAgICAgICBpZiAocmVuZGVyUGFzcy5mdWxsU2l6ZUNsZWFyUmVjdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2wuaW52YWxpZGF0ZUZyYW1lYnVmZmVyKGdsLkRSQVdfRlJBTUVCVUZGRVIsIGludmFsaWRhdGVBdHRhY2htZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlc29sdmUgdGhlIGNvbG9yIGJ1ZmZlciAodGhpcyByZXNvbHZlcyBhbGwgTVJUIGNvbG9yIGJ1ZmZlcnMgYXQgb25jZSlcbiAgICAgICAgICAgIGlmIChyZW5kZXJQYXNzLmNvbG9yT3BzPy5yZXNvbHZlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyICYmIHJlbmRlclBhc3Muc2FtcGxlcyA+IDEgJiYgdGFyZ2V0LmF1dG9SZXNvbHZlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldC5yZXNvbHZlKHRydWUsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGdlbmVyYXRlIG1pcG1hcHNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29sb3JCdWZmZXJDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3JPcHMgPSByZW5kZXJQYXNzLmNvbG9yQXJyYXlPcHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKGNvbG9yT3BzLm1pcG1hcHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSB0YXJnZXQuX2NvbG9yQnVmZmVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbG9yQnVmZmVyICYmIGNvbG9yQnVmZmVyLmltcGwuX2dsVGV4dHVyZSAmJiBjb2xvckJ1ZmZlci5taXBtYXBzICYmIChjb2xvckJ1ZmZlci5wb3QgfHwgdGhpcy53ZWJnbDIpKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcih0aGlzLCBgTUlQUyR7aX1gKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hY3RpdmVUZXh0dXJlKHRoaXMubWF4Q29tYmluZWRUZXh0dXJlcyAtIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZShjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdsLmdlbmVyYXRlTWlwbWFwKGNvbG9yQnVmZmVyLmltcGwuX2dsVGFyZ2V0KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmluc2lkZVJlbmRlclBhc3MgPSBmYWxzZTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrcyB0aGUgYmVnaW5uaW5nIG9mIGEgYmxvY2sgb2YgcmVuZGVyaW5nLiBJbnRlcm5hbGx5LCB0aGlzIGZ1bmN0aW9uIGJpbmRzIHRoZSByZW5kZXJcbiAgICAgKiB0YXJnZXQgY3VycmVudGx5IHNldCBvbiB0aGUgZGV2aWNlLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBtYXRjaGVkIHdpdGggYSBjYWxsIHRvXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0uIENhbGxzIHRvIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVCZWdpbn0gYW5kXG4gICAgICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3VwZGF0ZUVuZH0gbXVzdCBub3QgYmUgbmVzdGVkLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZUJlZ2luKCkge1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcywgJ1VQREFURS1CRUdJTicpO1xuXG4gICAgICAgIHRoaXMuYm91bmRWYW8gPSBudWxsO1xuXG4gICAgICAgIC8vIGNsZWFyIHRleHR1cmUgdW5pdHMgb25jZSBhIGZyYW1lIG9uIGRlc2t0b3Agc2FmYXJpXG4gICAgICAgIGlmICh0aGlzLl90ZW1wRW5hYmxlU2FmYXJpVGV4dHVyZVVuaXRXb3JrYXJvdW5kKSB7XG4gICAgICAgICAgICBmb3IgKGxldCB1bml0ID0gMDsgdW5pdCA8IHRoaXMudGV4dHVyZVVuaXRzLmxlbmd0aDsgKyt1bml0KSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgc2xvdCA9IDA7IHNsb3QgPCAzOyArK3Nsb3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlVW5pdHNbdW5pdF1bc2xvdF0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNldCB0aGUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IFdlYkdMIGZyYW1lIGJ1ZmZlciBvYmplY3RcbiAgICAgICAgICAgIGlmICghdGFyZ2V0LmltcGwuaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluaXRSZW5kZXJUYXJnZXQodGFyZ2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRGcmFtZWJ1ZmZlcih0YXJnZXQuaW1wbC5fZ2xGcmFtZUJ1ZmZlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldEZyYW1lYnVmZmVyKHRoaXMuZGVmYXVsdEZyYW1lYnVmZmVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmtzIHRoZSBlbmQgb2YgYSBibG9jayBvZiByZW5kZXJpbmcuIFRoaXMgZnVuY3Rpb24gc2hvdWxkIGJlIGNhbGxlZCBhZnRlciBhIG1hdGNoaW5nIGNhbGxcbiAgICAgKiB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59LiBDYWxscyB0byB7QGxpbmsgR3JhcGhpY3NEZXZpY2UjdXBkYXRlQmVnaW59IGFuZFxuICAgICAqIHtAbGluayBHcmFwaGljc0RldmljZSN1cGRhdGVFbmR9IG11c3Qgbm90IGJlIG5lc3RlZC5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGVFbmQoKSB7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKHRoaXMsIGBVUERBVEUtRU5EYCk7XG5cbiAgICAgICAgdGhpcy51bmJpbmRWZXJ0ZXhBcnJheSgpO1xuXG4gICAgICAgIC8vIFVuc2V0IHRoZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMucmVuZGVyVGFyZ2V0O1xuICAgICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgICAgICAvLyBSZXNvbHZlIE1TQUEgaWYgbmVlZGVkXG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIgJiYgdGFyZ2V0Ll9zYW1wbGVzID4gMSAmJiB0YXJnZXQuYXV0b1Jlc29sdmUpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQucmVzb2x2ZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBJZiB0aGUgYWN0aXZlIHJlbmRlciB0YXJnZXQgaXMgYXV0by1taXBtYXBwZWQsIGdlbmVyYXRlIGl0cyBtaXAgY2hhaW5cbiAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGFyZ2V0Ll9jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIGlmIChjb2xvckJ1ZmZlciAmJiBjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUgJiYgY29sb3JCdWZmZXIubWlwbWFwcyAmJiAoY29sb3JCdWZmZXIucG90IHx8IHRoaXMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgIC8vIEZJWE1FOiBpZiBjb2xvckJ1ZmZlciBpcyBhIGN1YmVtYXAgY3VycmVudGx5IHdlJ3JlIHJlLWdlbmVyYXRpbmcgbWlwbWFwcyBhZnRlclxuICAgICAgICAgICAgICAgIC8vIHVwZGF0aW5nIGVhY2ggZmFjZSFcbiAgICAgICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGhpcy5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5iaW5kVGV4dHVyZShjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5nbC5nZW5lcmF0ZU1pcG1hcChjb2xvckJ1ZmZlci5pbXBsLl9nbFRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcih0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSdzIHZlcnRpY2FsIGZsaXAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZsaXBZIC0gVHJ1ZSB0byBmbGlwIHRoZSB0ZXh0dXJlIHZlcnRpY2FsbHkuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldFVucGFja0ZsaXBZKGZsaXBZKSB7XG4gICAgICAgIGlmICh0aGlzLnVucGFja0ZsaXBZICE9PSBmbGlwWSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tGbGlwWSA9IGZsaXBZO1xuXG4gICAgICAgICAgICAvLyBOb3RlOiB0aGUgV2ViR0wgc3BlYyBzdGF0ZXMgdGhhdCBVTlBBQ0tfRkxJUF9ZX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBmbGlwWSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIGEgdGV4dHVyZSB0byBoYXZlIGl0cyBSR0IgY2hhbm5lbHMgcHJlbXVsdGlwbGllZCBieSBpdHMgYWxwaGEgY2hhbm5lbCBvciBub3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByZW11bHRpcGx5QWxwaGEgLSBUcnVlIHRvIHByZW11bHRpcGx5IHRoZSBhbHBoYSBjaGFubmVsIGFnYWluc3QgdGhlIFJHQlxuICAgICAqIGNoYW5uZWxzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhKHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgaWYgKHRoaXMudW5wYWNrUHJlbXVsdGlwbHlBbHBoYSAhPT0gcHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICAgICAgdGhpcy51bnBhY2tQcmVtdWx0aXBseUFscGhhID0gcHJlbXVsdGlwbHlBbHBoYTtcblxuICAgICAgICAgICAgLy8gTm90ZTogdGhlIFdlYkdMIHNwZWMgc3RhdGVzIHRoYXQgVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMIG9ubHkgYWZmZWN0c1xuICAgICAgICAgICAgLy8gdGV4SW1hZ2UyRCBhbmQgdGV4U3ViSW1hZ2UyRCwgbm90IGNvbXByZXNzZWRUZXhJbWFnZTJEXG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIHByZW11bHRpcGx5QWxwaGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWN0aXZhdGUgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KSB7XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0ICE9PSB0ZXh0dXJlVW5pdCkge1xuICAgICAgICAgICAgdGhpcy5nbC5hY3RpdmVUZXh0dXJlKHRoaXMuZ2wuVEVYVFVSRTAgKyB0ZXh0dXJlVW5pdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0ID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgdGV4dHVyZSBpcyBub3QgYWxyZWFkeSBib3VuZCBvbiB0aGUgY3VycmVudGx5IGFjdGl2ZSB0ZXh0dXJlIHVuaXQsIGJpbmQgaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byBiaW5kLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZSh0ZXh0dXJlKSB7XG4gICAgICAgIGNvbnN0IGltcGwgPSB0ZXh0dXJlLmltcGw7XG4gICAgICAgIGNvbnN0IHRleHR1cmVUYXJnZXQgPSBpbXBsLl9nbFRhcmdldDtcbiAgICAgICAgY29uc3QgdGV4dHVyZU9iamVjdCA9IGltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgY29uc3QgdGV4dHVyZVVuaXQgPSB0aGlzLnRleHR1cmVVbml0O1xuICAgICAgICBjb25zdCBzbG90ID0gdGhpcy50YXJnZXRUb1Nsb3RbdGV4dHVyZVRhcmdldF07XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gIT09IHRleHR1cmVPYmplY3QpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlIHRleHR1cmUgaXMgbm90IGJvdW5kIG9uIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSB1bml0LCBhY3RpdmUgdGhlIHRleHR1cmUgdW5pdCBhbmQgYmluZFxuICAgICAqIHRoZSB0ZXh0dXJlIHRvIGl0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gYmluZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIGFjdGl2YXRlIGFuZCBiaW5kIHRoZSB0ZXh0dXJlIHRvLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiaW5kVGV4dHVyZU9uVW5pdCh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCkge1xuICAgICAgICBjb25zdCBpbXBsID0gdGV4dHVyZS5pbXBsO1xuICAgICAgICBjb25zdCB0ZXh0dXJlVGFyZ2V0ID0gaW1wbC5fZ2xUYXJnZXQ7XG4gICAgICAgIGNvbnN0IHRleHR1cmVPYmplY3QgPSBpbXBsLl9nbFRleHR1cmU7XG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnRhcmdldFRvU2xvdFt0ZXh0dXJlVGFyZ2V0XTtcbiAgICAgICAgaWYgKHRoaXMudGV4dHVyZVVuaXRzW3RleHR1cmVVbml0XVtzbG90XSAhPT0gdGV4dHVyZU9iamVjdCkge1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVUZXh0dXJlKHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgIHRoaXMuZ2wuYmluZFRleHR1cmUodGV4dHVyZVRhcmdldCwgdGV4dHVyZU9iamVjdCk7XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVVbml0c1t0ZXh0dXJlVW5pdF1bc2xvdF0gPSB0ZXh0dXJlT2JqZWN0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSB0ZXh0dXJlIHBhcmFtZXRlcnMgZm9yIGEgZ2l2ZW4gdGV4dHVyZSBpZiB0aGV5IGhhdmUgY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHVwZGF0ZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VGV4dHVyZVBhcmFtZXRlcnModGV4dHVyZSkge1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgIGNvbnN0IGZsYWdzID0gdGV4dHVyZS5pbXBsLmRpcnR5UGFyYW1ldGVyRmxhZ3M7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRleHR1cmUuaW1wbC5fZ2xUYXJnZXQ7XG5cbiAgICAgICAgaWYgKGZsYWdzICYgMSkge1xuICAgICAgICAgICAgbGV0IGZpbHRlciA9IHRleHR1cmUuX21pbkZpbHRlcjtcbiAgICAgICAgICAgIGlmICgoIXRleHR1cmUucG90ICYmICF0aGlzLndlYmdsMikgfHwgIXRleHR1cmUuX21pcG1hcHMgfHwgKHRleHR1cmUuX2NvbXByZXNzZWQgJiYgdGV4dHVyZS5fbGV2ZWxzLmxlbmd0aCA9PT0gMSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoZmlsdGVyID09PSBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCB8fCBmaWx0ZXIgPT09IEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX05FQVJFU1Q7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChmaWx0ZXIgPT09IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QgfHwgZmlsdGVyID09PSBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCB0aGlzLmdsRmlsdGVyW2ZpbHRlcl0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDIpIHtcbiAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX01BR19GSUxURVIsIHRoaXMuZ2xGaWx0ZXJbdGV4dHVyZS5fbWFnRmlsdGVyXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNCkge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9TLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzVV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBXZWJHTDEgZG9lc24ndCBzdXBwb3J0IGFsbCBhZGRyZXNzaW5nIG1vZGVzIHdpdGggTlBPVCB0ZXh0dXJlc1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUywgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5wb3QgPyB0ZXh0dXJlLl9hZGRyZXNzVSA6IEFERFJFU1NfQ0xBTVBfVE9fRURHRV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfVCwgdGhpcy5nbEFkZHJlc3NbdGV4dHVyZS5fYWRkcmVzc1ZdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gV2ViR0wxIGRvZXNuJ3Qgc3VwcG9ydCBhbGwgYWRkcmVzc2luZyBtb2RlcyB3aXRoIE5QT1QgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1QsIHRoaXMuZ2xBZGRyZXNzW3RleHR1cmUucG90ID8gdGV4dHVyZS5fYWRkcmVzc1YgOiBBRERSRVNTX0NMQU1QX1RPX0VER0VdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxNikge1xuICAgICAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgZ2wudGV4UGFyYW1ldGVyaSh0YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9SLCB0aGlzLmdsQWRkcmVzc1t0ZXh0dXJlLl9hZGRyZXNzV10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChmbGFncyAmIDMyKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKHRhcmdldCwgZ2wuVEVYVFVSRV9DT01QQVJFX01PREUsIHRleHR1cmUuX2NvbXBhcmVPblJlYWQgPyBnbC5DT01QQVJFX1JFRl9UT19URVhUVVJFIDogZ2wuTk9ORSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsYWdzICYgNjQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmkodGFyZ2V0LCBnbC5URVhUVVJFX0NPTVBBUkVfRlVOQywgdGhpcy5nbENvbXBhcmlzb25bdGV4dHVyZS5fY29tcGFyZUZ1bmNdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZmxhZ3MgJiAxMjgpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dCA9IHRoaXMuZXh0VGV4dHVyZUZpbHRlckFuaXNvdHJvcGljO1xuICAgICAgICAgICAgaWYgKGV4dCkge1xuICAgICAgICAgICAgICAgIGdsLnRleFBhcmFtZXRlcmYodGFyZ2V0LCBleHQuVEVYVFVSRV9NQVhfQU5JU09UUk9QWV9FWFQsIG1hdGguY2xhbXAoTWF0aC5yb3VuZCh0ZXh0dXJlLl9hbmlzb3Ryb3B5KSwgMSwgdGhpcy5tYXhBbmlzb3Ryb3B5KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBzcGVjaWZpZWQgdGV4dHVyZSBvbiB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdGV4dHVyZVVuaXQgLSBUaGUgdGV4dHVyZSB1bml0IHRvIHNldCB0aGUgdGV4dHVyZSBvbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCkge1xuXG4gICAgICAgIGNvbnN0IGltcGwgPSB0ZXh0dXJlLmltcGw7XG4gICAgICAgIGlmICghaW1wbC5fZ2xUZXh0dXJlKVxuICAgICAgICAgICAgaW1wbC5pbml0aWFsaXplKHRoaXMsIHRleHR1cmUpO1xuXG4gICAgICAgIGlmIChpbXBsLmRpcnR5UGFyYW1ldGVyRmxhZ3MgPiAwIHx8IHRleHR1cmUuX25lZWRzVXBsb2FkIHx8IHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCkge1xuXG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQgaXMgYWN0aXZlXG4gICAgICAgICAgICB0aGlzLmFjdGl2ZVRleHR1cmUodGV4dHVyZVVuaXQpO1xuXG4gICAgICAgICAgICAvLyBFbnN1cmUgdGhlIHRleHR1cmUgaXMgYm91bmQgb24gY29ycmVjdCB0YXJnZXQgb2YgdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXRcbiAgICAgICAgICAgIHRoaXMuYmluZFRleHR1cmUodGV4dHVyZSk7XG5cbiAgICAgICAgICAgIGlmIChpbXBsLmRpcnR5UGFyYW1ldGVyRmxhZ3MpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFRleHR1cmVQYXJhbWV0ZXJzKHRleHR1cmUpO1xuICAgICAgICAgICAgICAgIGltcGwuZGlydHlQYXJhbWV0ZXJGbGFncyA9IDA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0ZXh0dXJlLl9uZWVkc1VwbG9hZCB8fCB0ZXh0dXJlLl9uZWVkc01pcG1hcHNVcGxvYWQpIHtcbiAgICAgICAgICAgICAgICBpbXBsLnVwbG9hZCh0aGlzLCB0ZXh0dXJlKTtcbiAgICAgICAgICAgICAgICB0ZXh0dXJlLl9uZWVkc1VwbG9hZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHRleHR1cmUuX25lZWRzTWlwbWFwc1VwbG9hZCA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gRW5zdXJlIHRoZSB0ZXh0dXJlIGlzIGN1cnJlbnRseSBib3VuZCB0byB0aGUgY29ycmVjdCB0YXJnZXQgb24gdGhlIHNwZWNpZmllZCB0ZXh0dXJlIHVuaXQuXG4gICAgICAgICAgICAvLyBJZiB0aGUgdGV4dHVyZSBpcyBhbHJlYWR5IGJvdW5kIHRvIHRoZSBjb3JyZWN0IHRhcmdldCBvbiB0aGUgc3BlY2lmaWVkIHVuaXQsIHRoZXJlJ3Mgbm8gbmVlZFxuICAgICAgICAgICAgLy8gdG8gYWN0dWFsbHkgbWFrZSB0aGUgc3BlY2lmaWVkIHRleHR1cmUgdW5pdCBhY3RpdmUgYmVjYXVzZSB0aGUgdGV4dHVyZSBpdHNlbGYgZG9lcyBub3QgbmVlZFxuICAgICAgICAgICAgLy8gdG8gYmUgdXBkYXRlZC5cbiAgICAgICAgICAgIHRoaXMuYmluZFRleHR1cmVPblVuaXQodGV4dHVyZSwgdGV4dHVyZVVuaXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gZnVuY3Rpb24gY3JlYXRlcyBWZXJ0ZXhBcnJheU9iamVjdCBmcm9tIGxpc3Qgb2YgdmVydGV4IGJ1ZmZlcnNcbiAgICBjcmVhdGVWZXJ0ZXhBcnJheSh2ZXJ0ZXhCdWZmZXJzKSB7XG5cbiAgICAgICAgbGV0IGtleSwgdmFvO1xuXG4gICAgICAgIC8vIG9ubHkgdXNlIGNhY2hlIHdoZW4gbW9yZSB0aGFuIDEgdmVydGV4IGJ1ZmZlciwgb3RoZXJ3aXNlIGl0J3MgdW5pcXVlXG4gICAgICAgIGNvbnN0IHVzZUNhY2hlID0gdmVydGV4QnVmZmVycy5sZW5ndGggPiAxO1xuICAgICAgICBpZiAodXNlQ2FjaGUpIHtcblxuICAgICAgICAgICAgLy8gZ2VuZXJhdGUgdW5pcXVlIGtleSBmb3IgdGhlIHZlcnRleCBidWZmZXJzXG4gICAgICAgICAgICBrZXkgPSBcIlwiO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2ZXJ0ZXhCdWZmZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gdmVydGV4QnVmZmVyc1tpXTtcbiAgICAgICAgICAgICAgICBrZXkgKz0gdmVydGV4QnVmZmVyLmlkICsgdmVydGV4QnVmZmVyLmZvcm1hdC5yZW5kZXJpbmdIYXNoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0cnkgdG8gZ2V0IFZBTyBmcm9tIGNhY2hlXG4gICAgICAgICAgICB2YW8gPSB0aGlzLl92YW9NYXAuZ2V0KGtleSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBuZWVkIHRvIGNyZWF0ZSBuZXcgdmFvXG4gICAgICAgIGlmICghdmFvKSB7XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSBWQSBvYmplY3RcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIHZhbyA9IGdsLmNyZWF0ZVZlcnRleEFycmF5KCk7XG4gICAgICAgICAgICBnbC5iaW5kVmVydGV4QXJyYXkodmFvKTtcblxuICAgICAgICAgICAgLy8gZG9uJ3QgY2FwdHVyZSBpbmRleCBidWZmZXIgaW4gVkFPXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBudWxsKTtcblxuICAgICAgICAgICAgbGV0IGxvY1plcm8gPSBmYWxzZTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmVydGV4QnVmZmVycy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gYmluZCBidWZmZXJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXJzW2ldO1xuICAgICAgICAgICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2ZXJ0ZXhCdWZmZXIuaW1wbC5idWZmZXJJZCk7XG5cbiAgICAgICAgICAgICAgICAvLyBmb3IgZWFjaCBhdHRyaWJ1dGVcbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50cyA9IHZlcnRleEJ1ZmZlci5mb3JtYXQuZWxlbWVudHM7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBlbGVtZW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlID0gZWxlbWVudHNbal07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYyA9IHNlbWFudGljVG9Mb2NhdGlvbltlLm5hbWVdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2MgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY1plcm8gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihsb2MsIGUubnVtQ29tcG9uZW50cywgdGhpcy5nbFR5cGVbZS5kYXRhVHlwZV0sIGUubm9ybWFsaXplLCBlLnN0cmlkZSwgZS5vZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2MpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh2ZXJ0ZXhCdWZmZXIuZm9ybWF0Lmluc3RhbmNpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLnZlcnRleEF0dHJpYkRpdmlzb3IobG9jLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZW5kIG9mIFZBIG9iamVjdFxuICAgICAgICAgICAgZ2wuYmluZFZlcnRleEFycmF5KG51bGwpO1xuXG4gICAgICAgICAgICAvLyB1bmJpbmQgYW55IGFycmF5IGJ1ZmZlclxuICAgICAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIG51bGwpO1xuXG4gICAgICAgICAgICAvLyBhZGQgaXQgdG8gY2FjaGVcbiAgICAgICAgICAgIGlmICh1c2VDYWNoZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Zhb01hcC5zZXQoa2V5LCB2YW8pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWxvY1plcm8pIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKFwiTm8gdmVydGV4IGF0dHJpYnV0ZSBpcyBtYXBwZWQgdG8gbG9jYXRpb24gMCwgd2hpY2ggbWlnaHQgY2F1c2UgY29tcGF0aWJpbGl0eSBpc3N1ZXMgb24gU2FmYXJpIG9uIE1hY09TIC0gcGxlYXNlIHVzZSBhdHRyaWJ1dGUgU0VNQU5USUNfUE9TSVRJT04gb3IgU0VNQU5USUNfQVRUUjE1XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZhbztcbiAgICB9XG5cbiAgICB1bmJpbmRWZXJ0ZXhBcnJheSgpIHtcbiAgICAgICAgLy8gdW5iaW5kIFZBTyBmcm9tIGRldmljZSB0byBwcm90ZWN0IGl0IGZyb20gYmVpbmcgY2hhbmdlZFxuICAgICAgICBpZiAodGhpcy5ib3VuZFZhbykge1xuICAgICAgICAgICAgdGhpcy5ib3VuZFZhbyA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmdsLmJpbmRWZXJ0ZXhBcnJheShudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEJ1ZmZlcnMoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgbGV0IHZhbztcblxuICAgICAgICAvLyBjcmVhdGUgVkFPIGZvciBzcGVjaWZpZWQgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgaWYgKHRoaXMudmVydGV4QnVmZmVycy5sZW5ndGggPT09IDEpIHtcblxuICAgICAgICAgICAgLy8gc2luZ2xlIFZCIGtlZXBzIGl0cyBWQU9cbiAgICAgICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IHRoaXMudmVydGV4QnVmZmVyc1swXTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydCh2ZXJ0ZXhCdWZmZXIuZGV2aWNlID09PSB0aGlzLCBcIlRoZSBWZXJ0ZXhCdWZmZXIgd2FzIG5vdCBjcmVhdGVkIHVzaW5nIGN1cnJlbnQgR3JhcGhpY3NEZXZpY2VcIik7XG4gICAgICAgICAgICBpZiAoIXZlcnRleEJ1ZmZlci5pbXBsLnZhbykge1xuICAgICAgICAgICAgICAgIHZlcnRleEJ1ZmZlci5pbXBsLnZhbyA9IHRoaXMuY3JlYXRlVmVydGV4QXJyYXkodGhpcy52ZXJ0ZXhCdWZmZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHZhbyA9IHZlcnRleEJ1ZmZlci5pbXBsLnZhbztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG9idGFpbiB0ZW1wb3JhcnkgVkFPIGZvciBtdWx0aXBsZSB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICAgICAgdmFvID0gdGhpcy5jcmVhdGVWZXJ0ZXhBcnJheSh0aGlzLnZlcnRleEJ1ZmZlcnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IGFjdGl2ZSBWQU9cbiAgICAgICAgaWYgKHRoaXMuYm91bmRWYW8gIT09IHZhbykge1xuICAgICAgICAgICAgdGhpcy5ib3VuZFZhbyA9IHZhbztcbiAgICAgICAgICAgIGdsLmJpbmRWZXJ0ZXhBcnJheSh2YW8pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW1wdHkgYXJyYXkgb2YgdmVydGV4IGJ1ZmZlcnNcbiAgICAgICAgdGhpcy52ZXJ0ZXhCdWZmZXJzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgLy8gU2V0IHRoZSBhY3RpdmUgaW5kZXggYnVmZmVyIG9iamVjdFxuICAgICAgICAvLyBOb3RlOiB3ZSBkb24ndCBjYWNoZSB0aGlzIHN0YXRlIGFuZCBzZXQgaXQgb25seSB3aGVuIGl0IGNoYW5nZXMsIGFzIFZBTyBjYXB0dXJlcyBsYXN0IGJpbmQgYnVmZmVyIGluIGl0XG4gICAgICAgIC8vIGFuZCBzbyB3ZSBkb24ndCBrbm93IHdoYXQgVkFPIHNldHMgaXQgdG8uXG4gICAgICAgIGNvbnN0IGJ1ZmZlcklkID0gdGhpcy5pbmRleEJ1ZmZlciA/IHRoaXMuaW5kZXhCdWZmZXIuaW1wbC5idWZmZXJJZCA6IG51bGw7XG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIGJ1ZmZlcklkKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdWJtaXRzIGEgZ3JhcGhpY2FsIHByaW1pdGl2ZSB0byB0aGUgaGFyZHdhcmUgZm9yIGltbWVkaWF0ZSByZW5kZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gcHJpbWl0aXZlIC0gUHJpbWl0aXZlIG9iamVjdCBkZXNjcmliaW5nIGhvdyB0byBzdWJtaXQgY3VycmVudCB2ZXJ0ZXgvaW5kZXhcbiAgICAgKiBidWZmZXJzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwcmltaXRpdmUudHlwZSAtIFRoZSB0eXBlIG9mIHByaW1pdGl2ZSB0byByZW5kZXIuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9QT0lOVFN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX0xJTkVTfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9MSU5FTE9PUH1cbiAgICAgKiAtIHtAbGluayBQUklNSVRJVkVfTElORVNUUklQfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9UUklBTkdMRVN9XG4gICAgICogLSB7QGxpbmsgUFJJTUlUSVZFX1RSSVNUUklQfVxuICAgICAqIC0ge0BsaW5rIFBSSU1JVElWRV9UUklGQU59XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcHJpbWl0aXZlLmJhc2UgLSBUaGUgb2Zmc2V0IG9mIHRoZSBmaXJzdCBpbmRleCBvciB2ZXJ0ZXggdG8gZGlzcGF0Y2ggaW4gdGhlXG4gICAgICogZHJhdyBjYWxsLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBwcmltaXRpdmUuY291bnQgLSBUaGUgbnVtYmVyIG9mIGluZGljZXMgb3IgdmVydGljZXMgdG8gZGlzcGF0Y2ggaW4gdGhlIGRyYXdcbiAgICAgKiBjYWxsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3ByaW1pdGl2ZS5pbmRleGVkXSAtIFRydWUgdG8gaW50ZXJwcmV0IHRoZSBwcmltaXRpdmUgYXMgaW5kZXhlZCwgdGhlcmVieVxuICAgICAqIHVzaW5nIHRoZSBjdXJyZW50bHkgc2V0IGluZGV4IGJ1ZmZlciBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbnVtSW5zdGFuY2VzPTFdIC0gVGhlIG51bWJlciBvZiBpbnN0YW5jZXMgdG8gcmVuZGVyIHdoZW4gdXNpbmdcbiAgICAgKiBBTkdMRV9pbnN0YW5jZWRfYXJyYXlzLiBEZWZhdWx0cyB0byAxLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2tlZXBCdWZmZXJzXSAtIE9wdGlvbmFsbHkga2VlcCB0aGUgY3VycmVudCBzZXQgb2YgdmVydGV4IC8gaW5kZXggYnVmZmVycyAvXG4gICAgICogVkFPLiBUaGlzIGlzIHVzZWQgd2hlbiByZW5kZXJpbmcgb2YgbXVsdGlwbGUgdmlld3MsIGZvciBleGFtcGxlIHVuZGVyIFdlYlhSLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgc2luZ2xlLCB1bmluZGV4ZWQgdHJpYW5nbGVcbiAgICAgKiBkZXZpY2UuZHJhdyh7XG4gICAgICogICAgIHR5cGU6IHBjLlBSSU1JVElWRV9UUklBTkdMRVMsXG4gICAgICogICAgIGJhc2U6IDAsXG4gICAgICogICAgIGNvdW50OiAzLFxuICAgICAqICAgICBpbmRleGVkOiBmYWxzZVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGRyYXcocHJpbWl0aXZlLCBudW1JbnN0YW5jZXMsIGtlZXBCdWZmZXJzKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICBsZXQgc2FtcGxlciwgc2FtcGxlclZhbHVlLCB0ZXh0dXJlLCBudW1UZXh0dXJlczsgLy8gU2FtcGxlcnNcbiAgICAgICAgbGV0IHVuaWZvcm0sIHNjb3BlSWQsIHVuaWZvcm1WZXJzaW9uLCBwcm9ncmFtVmVyc2lvbjsgLy8gVW5pZm9ybXNcbiAgICAgICAgY29uc3Qgc2hhZGVyID0gdGhpcy5zaGFkZXI7XG4gICAgICAgIGlmICghc2hhZGVyKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBjb25zdCBzYW1wbGVycyA9IHNoYWRlci5pbXBsLnNhbXBsZXJzO1xuICAgICAgICBjb25zdCB1bmlmb3JtcyA9IHNoYWRlci5pbXBsLnVuaWZvcm1zO1xuXG4gICAgICAgIC8vIHZlcnRleCBidWZmZXJzXG4gICAgICAgIGlmICgha2VlcEJ1ZmZlcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0QnVmZmVycygpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29tbWl0IHRoZSBzaGFkZXIgcHJvZ3JhbSB2YXJpYWJsZXNcbiAgICAgICAgbGV0IHRleHR1cmVVbml0ID0gMDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gc2FtcGxlcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIHNhbXBsZXIgPSBzYW1wbGVyc1tpXTtcbiAgICAgICAgICAgIHNhbXBsZXJWYWx1ZSA9IHNhbXBsZXIuc2NvcGVJZC52YWx1ZTtcbiAgICAgICAgICAgIGlmICghc2FtcGxlclZhbHVlKSB7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgY29uc3Qgc2FtcGxlck5hbWUgPSBzYW1wbGVyLnNjb3BlSWQubmFtZTtcbiAgICAgICAgICAgICAgICBpZiAoc2FtcGxlck5hbWUgPT09ICd1U2NlbmVEZXB0aE1hcCcgfHwgc2FtcGxlck5hbWUgPT09ICd1RGVwdGhNYXAnKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKGBBIHNhbXBsZXIgJHtzYW1wbGVyTmFtZX0gaXMgdXNlZCBieSB0aGUgc2hhZGVyIGJ1dCBhIHNjZW5lIGRlcHRoIHRleHR1cmUgaXMgbm90IGF2YWlsYWJsZS4gVXNlIENhbWVyYUNvbXBvbmVudC5yZXF1ZXN0U2NlbmVEZXB0aE1hcCB0byBlbmFibGUgaXQuYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyTmFtZSA9PT0gJ3VTY2VuZUNvbG9yTWFwJyB8fCBzYW1wbGVyTmFtZSA9PT0gJ3RleHR1cmVfZ3JhYlBhc3MnKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLndhcm5PbmNlKGBBIHNhbXBsZXIgJHtzYW1wbGVyTmFtZX0gaXMgdXNlZCBieSB0aGUgc2hhZGVyIGJ1dCBhIHNjZW5lIGNvbG9yIHRleHR1cmUgaXMgbm90IGF2YWlsYWJsZS4gVXNlIENhbWVyYUNvbXBvbmVudC5yZXF1ZXN0U2NlbmVDb2xvck1hcCB0byBlbmFibGUgaXQuYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgRGVidWcuZXJyb3JPbmNlKGBTaGFkZXIgWyR7c2hhZGVyLmxhYmVsfV0gcmVxdWlyZXMgdGV4dHVyZSBzYW1wbGVyIFske3NhbXBsZXJOYW1lfV0gd2hpY2ggaGFzIG5vdCBiZWVuIHNldCwgd2hpbGUgcmVuZGVyaW5nIFske0RlYnVnR3JhcGhpY3MudG9TdHJpbmcoKX1dYCk7XG5cbiAgICAgICAgICAgICAgICAvLyBza2lwIHRoaXMgZHJhdyBjYWxsIHRvIGF2b2lkIGluY29ycmVjdCByZW5kZXJpbmcgLyB3ZWJnbCBlcnJvcnNcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzYW1wbGVyVmFsdWUgaW5zdGFuY2VvZiBUZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgdGV4dHVyZSA9IHNhbXBsZXJWYWx1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFRleHR1cmUodGV4dHVyZSwgdGV4dHVyZVVuaXQpO1xuXG4gICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlbmRlclRhcmdldCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBTZXQgYnJlYWtwb2ludCBoZXJlIHRvIGRlYnVnIFwiU291cmNlIGFuZCBkZXN0aW5hdGlvbiB0ZXh0dXJlcyBvZiB0aGUgZHJhdyBhcmUgdGhlIHNhbWVcIiBlcnJvcnNcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucmVuZGVyVGFyZ2V0Ll9zYW1wbGVzIDwgMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucmVuZGVyVGFyZ2V0LmNvbG9yQnVmZmVyICYmIHRoaXMucmVuZGVyVGFyZ2V0LmNvbG9yQnVmZmVyID09PSB0ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoXCJUcnlpbmcgdG8gYmluZCBjdXJyZW50IGNvbG9yIGJ1ZmZlciBhcyBhIHRleHR1cmVcIiwgeyByZW5kZXJUYXJnZXQ6IHRoaXMucmVuZGVyVGFyZ2V0LCB0ZXh0dXJlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnJlbmRlclRhcmdldC5kZXB0aEJ1ZmZlciAmJiB0aGlzLnJlbmRlclRhcmdldC5kZXB0aEJ1ZmZlciA9PT0gdGV4dHVyZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKFwiVHJ5aW5nIHRvIGJpbmQgY3VycmVudCBkZXB0aCBidWZmZXIgYXMgYSB0ZXh0dXJlXCIsIHsgdGV4dHVyZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgIGlmIChzYW1wbGVyLnNsb3QgIT09IHRleHR1cmVVbml0KSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLnVuaWZvcm0xaShzYW1wbGVyLmxvY2F0aW9uSWQsIHRleHR1cmVVbml0KTtcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlci5zbG90ID0gdGV4dHVyZVVuaXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRleHR1cmVVbml0Kys7XG4gICAgICAgICAgICB9IGVsc2UgeyAvLyBBcnJheVxuICAgICAgICAgICAgICAgIHNhbXBsZXIuYXJyYXkubGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICBudW1UZXh0dXJlcyA9IHNhbXBsZXJWYWx1ZS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBudW1UZXh0dXJlczsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRleHR1cmUgPSBzYW1wbGVyVmFsdWVbal07XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0VGV4dHVyZSh0ZXh0dXJlLCB0ZXh0dXJlVW5pdCk7XG5cbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlci5hcnJheVtqXSA9IHRleHR1cmVVbml0O1xuICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlVW5pdCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBnbC51bmlmb3JtMWl2KHNhbXBsZXIubG9jYXRpb25JZCwgc2FtcGxlci5hcnJheSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21taXQgYW55IHVwZGF0ZWQgdW5pZm9ybXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHVuaWZvcm1zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB1bmlmb3JtID0gdW5pZm9ybXNbaV07XG4gICAgICAgICAgICBzY29wZUlkID0gdW5pZm9ybS5zY29wZUlkO1xuICAgICAgICAgICAgdW5pZm9ybVZlcnNpb24gPSB1bmlmb3JtLnZlcnNpb247XG4gICAgICAgICAgICBwcm9ncmFtVmVyc2lvbiA9IHNjb3BlSWQudmVyc2lvbk9iamVjdC52ZXJzaW9uO1xuXG4gICAgICAgICAgICAvLyBDaGVjayB0aGUgdmFsdWUgaXMgdmFsaWRcbiAgICAgICAgICAgIGlmICh1bmlmb3JtVmVyc2lvbi5nbG9iYWxJZCAhPT0gcHJvZ3JhbVZlcnNpb24uZ2xvYmFsSWQgfHwgdW5pZm9ybVZlcnNpb24ucmV2aXNpb24gIT09IHByb2dyYW1WZXJzaW9uLnJldmlzaW9uKSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybVZlcnNpb24uZ2xvYmFsSWQgPSBwcm9ncmFtVmVyc2lvbi5nbG9iYWxJZDtcbiAgICAgICAgICAgICAgICB1bmlmb3JtVmVyc2lvbi5yZXZpc2lvbiA9IHByb2dyYW1WZXJzaW9uLnJldmlzaW9uO1xuXG4gICAgICAgICAgICAgICAgLy8gQ2FsbCB0aGUgZnVuY3Rpb24gdG8gY29tbWl0IHRoZSB1bmlmb3JtIHZhbHVlXG4gICAgICAgICAgICAgICAgaWYgKHNjb3BlSWQudmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jb21taXRGdW5jdGlvblt1bmlmb3JtLmRhdGFUeXBlXSh1bmlmb3JtLCBzY29wZUlkLnZhbHVlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb21tZW50ZWQgb3V0IHRpbGwgZW5naW5lIGlzc3VlICM0OTcxIGlzIHNvcnRlZCBvdXRcbiAgICAgICAgICAgICAgICAgICAgLy8gRGVidWcud2Fybk9uY2UoYFNoYWRlciBbJHtzaGFkZXIubGFiZWx9XSByZXF1aXJlcyB1bmlmb3JtIFske3VuaWZvcm0uc2NvcGVJZC5uYW1lfV0gd2hpY2ggaGFzIG5vdCBiZWVuIHNldCwgd2hpbGUgcmVuZGVyaW5nIFske0RlYnVnR3JhcGhpY3MudG9TdHJpbmcoKX1dYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyICYmIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIEVuYWJsZSBURiwgc3RhcnQgd3JpdGluZyB0byBvdXQgYnVmZmVyXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyQmFzZShnbC5UUkFOU0ZPUk1fRkVFREJBQ0tfQlVGRkVSLCAwLCB0aGlzLnRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyLmltcGwuYnVmZmVySWQpO1xuICAgICAgICAgICAgZ2wuYmVnaW5UcmFuc2Zvcm1GZWVkYmFjayhnbC5QT0lOVFMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbW9kZSA9IHRoaXMuZ2xQcmltaXRpdmVbcHJpbWl0aXZlLnR5cGVdO1xuICAgICAgICBjb25zdCBjb3VudCA9IHByaW1pdGl2ZS5jb3VudDtcblxuICAgICAgICBpZiAocHJpbWl0aXZlLmluZGV4ZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4QnVmZmVyID0gdGhpcy5pbmRleEJ1ZmZlcjtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydChpbmRleEJ1ZmZlci5kZXZpY2UgPT09IHRoaXMsIFwiVGhlIEluZGV4QnVmZmVyIHdhcyBub3QgY3JlYXRlZCB1c2luZyBjdXJyZW50IEdyYXBoaWNzRGV2aWNlXCIpO1xuXG4gICAgICAgICAgICBjb25zdCBmb3JtYXQgPSBpbmRleEJ1ZmZlci5pbXBsLmdsRm9ybWF0O1xuICAgICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gcHJpbWl0aXZlLmJhc2UgKiBpbmRleEJ1ZmZlci5ieXRlc1BlckluZGV4O1xuXG4gICAgICAgICAgICBpZiAobnVtSW5zdGFuY2VzID4gMCkge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdFbGVtZW50c0luc3RhbmNlZChtb2RlLCBjb3VudCwgZm9ybWF0LCBvZmZzZXQsIG51bUluc3RhbmNlcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRyYXdFbGVtZW50cyhtb2RlLCBjb3VudCwgZm9ybWF0LCBvZmZzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZmlyc3QgPSBwcmltaXRpdmUuYmFzZTtcblxuICAgICAgICAgICAgaWYgKG51bUluc3RhbmNlcyA+IDApIHtcbiAgICAgICAgICAgICAgICBnbC5kcmF3QXJyYXlzSW5zdGFuY2VkKG1vZGUsIGZpcnN0LCBjb3VudCwgbnVtSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuZHJhd0FycmF5cyhtb2RlLCBmaXJzdCwgY291bnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyICYmIHRoaXMudHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIpIHtcbiAgICAgICAgICAgIC8vIGRpc2FibGUgVEZcbiAgICAgICAgICAgIGdsLmVuZFRyYW5zZm9ybUZlZWRiYWNrKCk7XG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyQmFzZShnbC5UUkFOU0ZPUk1fRkVFREJBQ0tfQlVGRkVSLCAwLCBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2RyYXdDYWxsc1BlckZyYW1lKys7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLl9wcmltc1BlckZyYW1lW3ByaW1pdGl2ZS50eXBlXSArPSBwcmltaXRpdmUuY291bnQgKiAobnVtSW5zdGFuY2VzID4gMSA/IG51bUluc3RhbmNlcyA6IDEpO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbGVhcnMgdGhlIGZyYW1lIGJ1ZmZlciBvZiB0aGUgY3VycmVudGx5IHNldCByZW5kZXIgdGFyZ2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHRoYXQgY29udHJvbHMgdGhlIGJlaGF2aW9yIG9mIHRoZSBjbGVhclxuICAgICAqIG9wZXJhdGlvbiBkZWZpbmVkIGFzIGZvbGxvd3M6XG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gW29wdGlvbnMuY29sb3JdIC0gVGhlIGNvbG9yIHRvIGNsZWFyIHRoZSBjb2xvciBidWZmZXIgdG8gaW4gdGhlIHJhbmdlIDAuMFxuICAgICAqIHRvIDEuMCBmb3IgZWFjaCBjb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmRlcHRoPTFdIC0gVGhlIGRlcHRoIHZhbHVlIHRvIGNsZWFyIHRoZSBkZXB0aCBidWZmZXIgdG8gaW4gdGhlXG4gICAgICogcmFuZ2UgMC4wIHRvIDEuMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmxhZ3NdIC0gVGhlIGJ1ZmZlcnMgdG8gY2xlYXIgKHRoZSB0eXBlcyBiZWluZyBjb2xvciwgZGVwdGggYW5kXG4gICAgICogc3RlbmNpbCkuIENhbiBiZSBhbnkgYml0d2lzZSBjb21iaW5hdGlvbiBvZjpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIENMRUFSRkxBR19DT0xPUn1cbiAgICAgKiAtIHtAbGluayBDTEVBUkZMQUdfREVQVEh9XG4gICAgICogLSB7QGxpbmsgQ0xFQVJGTEFHX1NURU5DSUx9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3RlbmNpbD0wXSAtIFRoZSBzdGVuY2lsIHZhbHVlIHRvIGNsZWFyIHRoZSBzdGVuY2lsIGJ1ZmZlciB0by4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENsZWFyIGNvbG9yIGJ1ZmZlciB0byBibGFjayBhbmQgZGVwdGggYnVmZmVyIHRvIDEuMFxuICAgICAqIGRldmljZS5jbGVhcigpO1xuICAgICAqXG4gICAgICogLy8gQ2xlYXIganVzdCB0aGUgY29sb3IgYnVmZmVyIHRvIHJlZFxuICAgICAqIGRldmljZS5jbGVhcih7XG4gICAgICogICAgIGNvbG9yOiBbMSwgMCwgMCwgMV0sXG4gICAgICogICAgIGZsYWdzOiBwYy5DTEVBUkZMQUdfQ09MT1JcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIENsZWFyIGNvbG9yIGJ1ZmZlciB0byB5ZWxsb3cgYW5kIGRlcHRoIHRvIDEuMFxuICAgICAqIGRldmljZS5jbGVhcih7XG4gICAgICogICAgIGNvbG9yOiBbMSwgMSwgMCwgMV0sXG4gICAgICogICAgIGRlcHRoOiAxLFxuICAgICAqICAgICBmbGFnczogcGMuQ0xFQVJGTEFHX0NPTE9SIHwgcGMuQ0xFQVJGTEFHX0RFUFRIXG4gICAgICogfSk7XG4gICAgICovXG4gICAgY2xlYXIob3B0aW9ucykge1xuICAgICAgICBjb25zdCBkZWZhdWx0T3B0aW9ucyA9IHRoaXMuZGVmYXVsdENsZWFyT3B0aW9ucztcbiAgICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgZGVmYXVsdE9wdGlvbnM7XG5cbiAgICAgICAgY29uc3QgZmxhZ3MgPSBvcHRpb25zLmZsYWdzID8/IGRlZmF1bHRPcHRpb25zLmZsYWdzO1xuICAgICAgICBpZiAoZmxhZ3MgIT09IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBjb2xvclxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX0NPTE9SKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3IgPSBvcHRpb25zLmNvbG9yID8/IGRlZmF1bHRPcHRpb25zLmNvbG9yO1xuICAgICAgICAgICAgICAgIGNvbnN0IHIgPSBjb2xvclswXTtcbiAgICAgICAgICAgICAgICBjb25zdCBnID0gY29sb3JbMV07XG4gICAgICAgICAgICAgICAgY29uc3QgYiA9IGNvbG9yWzJdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGEgPSBjb2xvclszXTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGMgPSB0aGlzLmNsZWFyQ29sb3I7XG4gICAgICAgICAgICAgICAgaWYgKChyICE9PSBjLnIpIHx8IChnICE9PSBjLmcpIHx8IChiICE9PSBjLmIpIHx8IChhICE9PSBjLmEpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuY2xlYXJDb2xvcihyLCBnLCBiLCBhKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhckNvbG9yLnNldChyLCBnLCBiLCBhKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5OT0JMRU5EKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZsYWdzICYgQ0xFQVJGTEFHX0RFUFRIKSB7XG4gICAgICAgICAgICAgICAgLy8gU2V0IHRoZSBjbGVhciBkZXB0aFxuICAgICAgICAgICAgICAgIGNvbnN0IGRlcHRoID0gb3B0aW9ucy5kZXB0aCA/PyBkZWZhdWx0T3B0aW9ucy5kZXB0aDtcblxuICAgICAgICAgICAgICAgIGlmIChkZXB0aCAhPT0gdGhpcy5jbGVhckRlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuY2xlYXJEZXB0aChkZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJEZXB0aCA9IGRlcHRoO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuc2V0RGVwdGhTdGF0ZShEZXB0aFN0YXRlLldSSVRFREVQVEgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmxhZ3MgJiBDTEVBUkZMQUdfU1RFTkNJTCkge1xuICAgICAgICAgICAgICAgIC8vIFNldCB0aGUgY2xlYXIgc3RlbmNpbFxuICAgICAgICAgICAgICAgIGNvbnN0IHN0ZW5jaWwgPSBvcHRpb25zLnN0ZW5jaWwgPz8gZGVmYXVsdE9wdGlvbnMuc3RlbmNpbDtcbiAgICAgICAgICAgICAgICBpZiAoc3RlbmNpbCAhPT0gdGhpcy5jbGVhclN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5nbC5jbGVhclN0ZW5jaWwoc3RlbmNpbCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2xlYXJTdGVuY2lsID0gc3RlbmNpbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENsZWFyIHRoZSBmcmFtZSBidWZmZXJcbiAgICAgICAgICAgIGdsLmNsZWFyKHRoaXMuZ2xDbGVhckZsYWdbZmxhZ3NdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN1Ym1pdCgpIHtcbiAgICAgICAgdGhpcy5nbC5mbHVzaCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlYWRzIGEgYmxvY2sgb2YgcGl4ZWxzIGZyb20gYSBzcGVjaWZpZWQgcmVjdGFuZ2xlIG9mIHRoZSBjdXJyZW50IGNvbG9yIGZyYW1lYnVmZmVyIGludG8gYW5cbiAgICAgKiBBcnJheUJ1ZmZlclZpZXcgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb29yZGluYXRlIG9mIHRoZSByZWN0YW5nbGUncyBsb3dlci1sZWZ0IGNvcm5lci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5LWNvb3JkaW5hdGUgb2YgdGhlIHJlY3RhbmdsZSdzIGxvd2VyLWxlZnQgY29ybmVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSByZWN0YW5nbGUsIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBoZWlnaHQgb2YgdGhlIHJlY3RhbmdsZSwgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBwaXhlbHMgLSBUaGUgQXJyYXlCdWZmZXJWaWV3IG9iamVjdCB0aGF0IGhvbGRzIHRoZSByZXR1cm5lZCBwaXhlbFxuICAgICAqIGRhdGEuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlYWRQaXhlbHMoeCwgeSwgdywgaCwgcGl4ZWxzKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgZ2wucmVhZFBpeGVscyh4LCB5LCB3LCBoLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBwaXhlbHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzeW5jaHJvbm91c2x5IHJlYWRzIGEgYmxvY2sgb2YgcGl4ZWxzIGZyb20gYSBzcGVjaWZpZWQgcmVjdGFuZ2xlIG9mIHRoZSBjdXJyZW50IGNvbG9yIGZyYW1lYnVmZmVyXG4gICAgICogaW50byBhbiBBcnJheUJ1ZmZlclZpZXcgb2JqZWN0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeC1jb29yZGluYXRlIG9mIHRoZSByZWN0YW5nbGUncyBsb3dlci1sZWZ0IGNvcm5lci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5LWNvb3JkaW5hdGUgb2YgdGhlIHJlY3RhbmdsZSdzIGxvd2VyLWxlZnQgY29ybmVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSByZWN0YW5nbGUsIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBoZWlnaHQgb2YgdGhlIHJlY3RhbmdsZSwgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJWaWV3fSBwaXhlbHMgLSBUaGUgQXJyYXlCdWZmZXJWaWV3IG9iamVjdCB0aGF0IGhvbGRzIHRoZSByZXR1cm5lZCBwaXhlbFxuICAgICAqIGRhdGEuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFzeW5jIHJlYWRQaXhlbHNBc3luYyh4LCB5LCB3LCBoLCBwaXhlbHMpIHtcbiAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuXG4gICAgICAgIGlmICghdGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgIC8vIGFzeW5jIGZlbmNlcyBhcmVuJ3Qgc3VwcG9ydGVkIG9uIHdlYmdsMVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVhZFBpeGVscyh4LCB5LCB3LCBoLCBwaXhlbHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2xpZW50V2FpdEFzeW5jID0gKGZsYWdzLCBpbnRlcnZhbF9tcykgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc3luYyA9IGdsLmZlbmNlU3luYyhnbC5TWU5DX0dQVV9DT01NQU5EU19DT01QTEVURSwgMCk7XG4gICAgICAgICAgICB0aGlzLnN1Ym1pdCgpO1xuXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgICAgIGZ1bmN0aW9uIHRlc3QoKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGdsLmNsaWVudFdhaXRTeW5jKHN5bmMsIGZsYWdzLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlcyA9PT0gZ2wuV0FJVF9GQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsLmRlbGV0ZVN5bmMoc3luYyk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCd3ZWJnbCBjbGllbnRXYWl0U3luYyBzeW5jIGZhaWxlZCcpKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChyZXMgPT09IGdsLlRJTUVPVVRfRVhQSVJFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCh0ZXN0LCBpbnRlcnZhbF9tcyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbC5kZWxldGVTeW5jKHN5bmMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRlc3QoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGltcGwgPSB0aGlzLnJlbmRlclRhcmdldC5jb2xvckJ1ZmZlcj8uaW1wbDtcbiAgICAgICAgY29uc3QgZm9ybWF0ID0gaW1wbD8uX2dsRm9ybWF0ID8/IGdsLlJHQkE7XG4gICAgICAgIGNvbnN0IHBpeGVsVHlwZSA9IGltcGw/Ll9nbFBpeGVsVHlwZSA/PyBnbC5VTlNJR05FRF9CWVRFO1xuXG4gICAgICAgIC8vIGNyZWF0ZSB0ZW1wb3JhcnkgKGdwdS1zaWRlKSBidWZmZXIgYW5kIGNvcHkgZGF0YSBpbnRvIGl0XG4gICAgICAgIGNvbnN0IGJ1ZiA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLlBJWEVMX1BBQ0tfQlVGRkVSLCBidWYpO1xuICAgICAgICBnbC5idWZmZXJEYXRhKGdsLlBJWEVMX1BBQ0tfQlVGRkVSLCBwaXhlbHMuYnl0ZUxlbmd0aCwgZ2wuU1RSRUFNX1JFQUQpO1xuICAgICAgICBnbC5yZWFkUGl4ZWxzKHgsIHksIHcsIGgsIGZvcm1hdCwgcGl4ZWxUeXBlLCAwKTtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5QSVhFTF9QQUNLX0JVRkZFUiwgbnVsbCk7XG5cbiAgICAgICAgLy8gYXN5bmMgd2FpdCBmb3IgcHJldmlvdXMgcmVhZCB0byBmaW5pc2hcbiAgICAgICAgYXdhaXQgY2xpZW50V2FpdEFzeW5jKDAsIDIwKTtcblxuICAgICAgICAvLyBjb3B5IHRoZSByZXN1bHRpbmcgZGF0YSBvbmNlIGl0J3MgYXJyaXZlZFxuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLlBJWEVMX1BBQ0tfQlVGRkVSLCBidWYpO1xuICAgICAgICBnbC5nZXRCdWZmZXJTdWJEYXRhKGdsLlBJWEVMX1BBQ0tfQlVGRkVSLCAwLCBwaXhlbHMpO1xuICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLlBJWEVMX1BBQ0tfQlVGRkVSLCBudWxsKTtcbiAgICAgICAgZ2wuZGVsZXRlQnVmZmVyKGJ1Zik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBvciBkaXNhYmxlcyBhbHBoYSB0byBjb3ZlcmFnZSAoV2ViR0wyIG9ubHkpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzdGF0ZSAtIFRydWUgdG8gZW5hYmxlIGFscGhhIHRvIGNvdmVyYWdlIGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRBbHBoYVRvQ292ZXJhZ2Uoc3RhdGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLndlYmdsMikgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5hbHBoYVRvQ292ZXJhZ2UgPT09IHN0YXRlKSByZXR1cm47XG4gICAgICAgIHRoaXMuYWxwaGFUb0NvdmVyYWdlID0gc3RhdGU7XG5cbiAgICAgICAgaWYgKHN0YXRlKSB7XG4gICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5TQU1QTEVfQUxQSEFfVE9fQ09WRVJBR0UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgb3V0cHV0IHZlcnRleCBidWZmZXIuIEl0IHdpbGwgYmUgd3JpdHRlbiB0byBieSBhIHNoYWRlciB3aXRoIHRyYW5zZm9ybSBmZWVkYmFja1xuICAgICAqIHZhcnlpbmdzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3ZlcnRleC1idWZmZXIuanMnKS5WZXJ0ZXhCdWZmZXJ9IHRmIC0gVGhlIG91dHB1dCB2ZXJ0ZXggYnVmZmVyLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRUcmFuc2Zvcm1GZWVkYmFja0J1ZmZlcih0Zikge1xuICAgICAgICBpZiAodGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciA9PT0gdGYpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy50cmFuc2Zvcm1GZWVkYmFja0J1ZmZlciA9IHRmO1xuXG4gICAgICAgIGlmICh0aGlzLndlYmdsMikge1xuICAgICAgICAgICAgY29uc3QgZ2wgPSB0aGlzLmdsO1xuICAgICAgICAgICAgaWYgKHRmKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmZlZWRiYWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmVlZGJhY2sgPSBnbC5jcmVhdGVUcmFuc2Zvcm1GZWVkYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBnbC5iaW5kVHJhbnNmb3JtRmVlZGJhY2soZ2wuVFJBTlNGT1JNX0ZFRURCQUNLLCB0aGlzLmZlZWRiYWNrKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZ2wuYmluZFRyYW5zZm9ybUZlZWRiYWNrKGdsLlRSQU5TRk9STV9GRUVEQkFDSywgbnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIHRoZSByYXN0ZXJpemF0aW9uIHJlbmRlciBzdGF0ZS4gVXNlZnVsIHdpdGggdHJhbnNmb3JtIGZlZWRiYWNrLCB3aGVuIHlvdSBvbmx5IG5lZWRcbiAgICAgKiB0byBwcm9jZXNzIHRoZSBkYXRhIHdpdGhvdXQgZHJhd2luZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb24gLSBUcnVlIHRvIGVuYWJsZSByYXN0ZXJpemF0aW9uIGFuZCBmYWxzZSB0byBkaXNhYmxlIGl0LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXRSYXN0ZXIob24pIHtcbiAgICAgICAgaWYgKHRoaXMucmFzdGVyID09PSBvbikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMucmFzdGVyID0gb247XG5cbiAgICAgICAgaWYgKHRoaXMud2ViZ2wyKSB7XG4gICAgICAgICAgICBpZiAob24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmRpc2FibGUodGhpcy5nbC5SQVNURVJJWkVSX0RJU0NBUkQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmdsLmVuYWJsZSh0aGlzLmdsLlJBU1RFUklaRVJfRElTQ0FSRCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIHRoZSBwb2x5Z29uIG9mZnNldCByZW5kZXIgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG9uIC0gVHJ1ZSB0byBlbmFibGUgcG9seWdvbiBvZmZzZXQgYW5kIGZhbHNlIHRvIGRpc2FibGUgaXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldERlcHRoQmlhcyhvbikge1xuICAgICAgICBpZiAodGhpcy5kZXB0aEJpYXNFbmFibGVkID09PSBvbikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuZGVwdGhCaWFzRW5hYmxlZCA9IG9uO1xuXG4gICAgICAgIGlmIChvbikge1xuICAgICAgICAgICAgdGhpcy5nbC5lbmFibGUodGhpcy5nbC5QT0xZR09OX09GRlNFVF9GSUxMKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHRoZSBzY2FsZSBmYWN0b3IgYW5kIHVuaXRzIHRvIGNhbGN1bGF0ZSBkZXB0aCB2YWx1ZXMuIFRoZSBvZmZzZXQgaXMgYWRkZWQgYmVmb3JlXG4gICAgICogdGhlIGRlcHRoIHRlc3QgaXMgcGVyZm9ybWVkIGFuZCBiZWZvcmUgdGhlIHZhbHVlIGlzIHdyaXR0ZW4gaW50byB0aGUgZGVwdGggYnVmZmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNvbnN0QmlhcyAtIFRoZSBtdWx0aXBsaWVyIGJ5IHdoaWNoIGFuIGltcGxlbWVudGF0aW9uLXNwZWNpZmljIHZhbHVlIGlzXG4gICAgICogbXVsdGlwbGllZCB3aXRoIHRvIGNyZWF0ZSBhIGNvbnN0YW50IGRlcHRoIG9mZnNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2xvcGVCaWFzIC0gVGhlIHNjYWxlIGZhY3RvciBmb3IgdGhlIHZhcmlhYmxlIGRlcHRoIG9mZnNldCBmb3IgZWFjaCBwb2x5Z29uLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXREZXB0aEJpYXNWYWx1ZXMoY29uc3RCaWFzLCBzbG9wZUJpYXMpIHtcbiAgICAgICAgdGhpcy5nbC5wb2x5Z29uT2Zmc2V0KHNsb3BlQmlhcywgY29uc3RCaWFzKTtcbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsVGVzdChlbmFibGUpIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbCAhPT0gZW5hYmxlKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBpZiAoZW5hYmxlKSB7XG4gICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLlNURU5DSUxfVEVTVCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuU1RFTkNJTF9URVNUKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbCA9IGVuYWJsZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFN0ZW5jaWxGdW5jKGZ1bmMsIHJlZiwgbWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRnVuY0Zyb250ICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkZyb250ICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0Zyb250ICE9PSBtYXNrIHx8XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jQmFjayAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZCYWNrICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0JhY2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbEZ1bmModGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jRnJvbnQgPSB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHRoaXMuc3RlbmNpbFJlZkJhY2sgPSByZWY7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxNYXNrRnJvbnQgPSB0aGlzLnN0ZW5jaWxNYXNrQmFjayA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsRnVuY0Zyb250KGZ1bmMsIHJlZiwgbWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRnVuY0Zyb250ICE9PSBmdW5jIHx8IHRoaXMuc3RlbmNpbFJlZkZyb250ICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0Zyb250ICE9PSBtYXNrKSB7XG4gICAgICAgICAgICBjb25zdCBnbCA9IHRoaXMuZ2w7XG4gICAgICAgICAgICBnbC5zdGVuY2lsRnVuY1NlcGFyYXRlKGdsLkZST05ULCB0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSwgcmVmLCBtYXNrKTtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbEZ1bmNGcm9udCA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZGcm9udCA9IHJlZjtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbE1hc2tGcm9udCA9IG1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsRnVuY0JhY2soZnVuYywgcmVmLCBtYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGdW5jQmFjayAhPT0gZnVuYyB8fCB0aGlzLnN0ZW5jaWxSZWZCYWNrICE9PSByZWYgfHwgdGhpcy5zdGVuY2lsTWFza0JhY2sgIT09IG1hc2spIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgICAgIGdsLnN0ZW5jaWxGdW5jU2VwYXJhdGUoZ2wuQkFDSywgdGhpcy5nbENvbXBhcmlzb25bZnVuY10sIHJlZiwgbWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGdW5jQmFjayA9IGZ1bmM7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxSZWZCYWNrID0gcmVmO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsTWFza0JhY2sgPSBtYXNrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U3RlbmNpbE9wZXJhdGlvbihmYWlsLCB6ZmFpbCwgenBhc3MsIHdyaXRlTWFzaykge1xuICAgICAgICBpZiAodGhpcy5zdGVuY2lsRmFpbEZyb250ICE9PSBmYWlsIHx8IHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgIT09IHpwYXNzIHx8XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wKHRoaXMuZ2xTdGVuY2lsT3BbZmFpbF0sIHRoaXMuZ2xTdGVuY2lsT3BbemZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pwYXNzXSk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxGYWlsRnJvbnQgPSB0aGlzLnN0ZW5jaWxGYWlsQmFjayA9IGZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ID0gdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ID0gdGhpcy5zdGVuY2lsWnBhc3NCYWNrID0genBhc3M7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbFdyaXRlTWFza0Zyb250ICE9PSB3cml0ZU1hc2sgfHwgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrKHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IHdyaXRlTWFzaztcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFdyaXRlTWFza0JhY2sgPSB3cml0ZU1hc2s7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsT3BlcmF0aW9uRnJvbnQoZmFpbCwgemZhaWwsIHpwYXNzLCB3cml0ZU1hc2spIHtcbiAgICAgICAgaWYgKHRoaXMuc3RlbmNpbEZhaWxGcm9udCAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEZyb250ICE9PSB6ZmFpbCB8fCB0aGlzLnN0ZW5jaWxacGFzc0Zyb250ICE9PSB6cGFzcykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsT3BTZXBhcmF0ZSh0aGlzLmdsLkZST05ULCB0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEZyb250ID0gZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpmYWlsRnJvbnQgPSB6ZmFpbDtcbiAgICAgICAgICAgIHRoaXMuc3RlbmNpbFpwYXNzRnJvbnQgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrRnJvbnQgIT09IHdyaXRlTWFzaykge1xuICAgICAgICAgICAgdGhpcy5nbC5zdGVuY2lsTWFza1NlcGFyYXRlKHRoaXMuZ2wuRlJPTlQsIHdyaXRlTWFzayk7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxXcml0ZU1hc2tGcm9udCA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFN0ZW5jaWxPcGVyYXRpb25CYWNrKGZhaWwsIHpmYWlsLCB6cGFzcywgd3JpdGVNYXNrKSB7XG4gICAgICAgIGlmICh0aGlzLnN0ZW5jaWxGYWlsQmFjayAhPT0gZmFpbCB8fCB0aGlzLnN0ZW5jaWxaZmFpbEJhY2sgIT09IHpmYWlsIHx8IHRoaXMuc3RlbmNpbFpwYXNzQmFjayAhPT0genBhc3MpIHtcbiAgICAgICAgICAgIHRoaXMuZ2wuc3RlbmNpbE9wU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB0aGlzLmdsU3RlbmNpbE9wW2ZhaWxdLCB0aGlzLmdsU3RlbmNpbE9wW3pmYWlsXSwgdGhpcy5nbFN0ZW5jaWxPcFt6cGFzc10pO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsRmFpbEJhY2sgPSBmYWlsO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsWmZhaWxCYWNrID0gemZhaWw7XG4gICAgICAgICAgICB0aGlzLnN0ZW5jaWxacGFzc0JhY2sgPSB6cGFzcztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayAhPT0gd3JpdGVNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLmdsLnN0ZW5jaWxNYXNrU2VwYXJhdGUodGhpcy5nbC5CQUNLLCB3cml0ZU1hc2spO1xuICAgICAgICAgICAgdGhpcy5zdGVuY2lsV3JpdGVNYXNrQmFjayA9IHdyaXRlTWFzaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEJsZW5kU3RhdGUoYmxlbmRTdGF0ZSkge1xuICAgICAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICAgICAgaWYgKCFjdXJyZW50QmxlbmRTdGF0ZS5lcXVhbHMoYmxlbmRTdGF0ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gc3RhdGUgdmFsdWVzIHRvIHNldFxuICAgICAgICAgICAgY29uc3QgeyBibGVuZCwgY29sb3JPcCwgYWxwaGFPcCwgY29sb3JTcmNGYWN0b3IsIGNvbG9yRHN0RmFjdG9yLCBhbHBoYVNyY0ZhY3RvciwgYWxwaGFEc3RGYWN0b3IgfSA9IGJsZW5kU3RhdGU7XG5cbiAgICAgICAgICAgIC8vIGVuYWJsZSBibGVuZFxuICAgICAgICAgICAgaWYgKGN1cnJlbnRCbGVuZFN0YXRlLmJsZW5kICE9PSBibGVuZCkge1xuICAgICAgICAgICAgICAgIGlmIChibGVuZCkge1xuICAgICAgICAgICAgICAgICAgICBnbC5lbmFibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYmxlbmQgb3BzXG4gICAgICAgICAgICBpZiAoY3VycmVudEJsZW5kU3RhdGUuY29sb3JPcCAhPT0gY29sb3JPcCB8fCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYU9wICE9PSBhbHBoYU9wKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZ2xCbGVuZEVxdWF0aW9uID0gdGhpcy5nbEJsZW5kRXF1YXRpb247XG4gICAgICAgICAgICAgICAgZ2wuYmxlbmRFcXVhdGlvblNlcGFyYXRlKGdsQmxlbmRFcXVhdGlvbltjb2xvck9wXSwgZ2xCbGVuZEVxdWF0aW9uW2FscGhhT3BdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYmxlbmQgZmFjdG9yc1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yU3JjRmFjdG9yICE9PSBjb2xvclNyY0ZhY3RvciB8fCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvckRzdEZhY3RvciAhPT0gY29sb3JEc3RGYWN0b3IgfHxcbiAgICAgICAgICAgICAgICBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYVNyY0ZhY3RvciAhPT0gYWxwaGFTcmNGYWN0b3IgfHwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFEc3RGYWN0b3IgIT09IGFscGhhRHN0RmFjdG9yKSB7XG5cbiAgICAgICAgICAgICAgICBnbC5ibGVuZEZ1bmNTZXBhcmF0ZSh0aGlzLmdsQmxlbmRGdW5jdGlvbkNvbG9yW2NvbG9yU3JjRmFjdG9yXSwgdGhpcy5nbEJsZW5kRnVuY3Rpb25Db2xvcltjb2xvckRzdEZhY3Rvcl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5nbEJsZW5kRnVuY3Rpb25BbHBoYVthbHBoYVNyY0ZhY3Rvcl0sIHRoaXMuZ2xCbGVuZEZ1bmN0aW9uQWxwaGFbYWxwaGFEc3RGYWN0b3JdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY29sb3Igd3JpdGVcbiAgICAgICAgICAgIGlmIChjdXJyZW50QmxlbmRTdGF0ZS5hbGxXcml0ZSAhPT0gYmxlbmRTdGF0ZS5hbGxXcml0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuY29sb3JNYXNrKGJsZW5kU3RhdGUucmVkV3JpdGUsIGJsZW5kU3RhdGUuZ3JlZW5Xcml0ZSwgYmxlbmRTdGF0ZS5ibHVlV3JpdGUsIGJsZW5kU3RhdGUuYWxwaGFXcml0ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBpbnRlcm5hbCBzdGF0ZVxuICAgICAgICAgICAgY3VycmVudEJsZW5kU3RhdGUuY29weShibGVuZFN0YXRlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBibGVuZGluZyBmYWN0b3JzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBUaGUgcmVkIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBUaGUgZ3JlZW4gY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIFRoZSBibHVlIGNvbXBvbmVudCBpbiB0aGUgcmFuZ2Ugb2YgMCB0byAxLiBEZWZhdWx0IHZhbHVlIGlzIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBUaGUgYWxwaGEgY29tcG9uZW50IGluIHRoZSByYW5nZSBvZiAwIHRvIDEuIERlZmF1bHQgdmFsdWUgaXMgMC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2V0QmxlbmRDb2xvcihyLCBnLCBiLCBhKSB7XG4gICAgICAgIGNvbnN0IGMgPSB0aGlzLmJsZW5kQ29sb3I7XG4gICAgICAgIGlmICgociAhPT0gYy5yKSB8fCAoZyAhPT0gYy5nKSB8fCAoYiAhPT0gYy5iKSB8fCAoYSAhPT0gYy5hKSkge1xuICAgICAgICAgICAgdGhpcy5nbC5ibGVuZENvbG9yKHIsIGcsIGIsIGEpO1xuICAgICAgICAgICAgYy5zZXQociwgZywgYiwgYSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTdGVuY2lsU3RhdGUoc3RlbmNpbEZyb250LCBzdGVuY2lsQmFjaykge1xuICAgICAgICBpZiAoc3RlbmNpbEZyb250IHx8IHN0ZW5jaWxCYWNrKSB7XG4gICAgICAgICAgICB0aGlzLnNldFN0ZW5jaWxUZXN0KHRydWUpO1xuICAgICAgICAgICAgaWYgKHN0ZW5jaWxGcm9udCA9PT0gc3RlbmNpbEJhY2spIHtcblxuICAgICAgICAgICAgICAgIC8vIGlkZW50aWNhbCBmcm9udC9iYWNrIHN0ZW5jaWxcbiAgICAgICAgICAgICAgICB0aGlzLnNldFN0ZW5jaWxGdW5jKHN0ZW5jaWxGcm9udC5mdW5jLCBzdGVuY2lsRnJvbnQucmVmLCBzdGVuY2lsRnJvbnQucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U3RlbmNpbE9wZXJhdGlvbihzdGVuY2lsRnJvbnQuZmFpbCwgc3RlbmNpbEZyb250LnpmYWlsLCBzdGVuY2lsRnJvbnQuenBhc3MsIHN0ZW5jaWxGcm9udC53cml0ZU1hc2spO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgLy8gZnJvbnRcbiAgICAgICAgICAgICAgICBzdGVuY2lsRnJvbnQgPz89IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQ7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGVuY2lsRnVuY0Zyb250KHN0ZW5jaWxGcm9udC5mdW5jLCBzdGVuY2lsRnJvbnQucmVmLCBzdGVuY2lsRnJvbnQucmVhZE1hc2spO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U3RlbmNpbE9wZXJhdGlvbkZyb250KHN0ZW5jaWxGcm9udC5mYWlsLCBzdGVuY2lsRnJvbnQuemZhaWwsIHN0ZW5jaWxGcm9udC56cGFzcywgc3RlbmNpbEZyb250LndyaXRlTWFzayk7XG5cbiAgICAgICAgICAgICAgICAvLyBiYWNrXG4gICAgICAgICAgICAgICAgc3RlbmNpbEJhY2sgPz89IFN0ZW5jaWxQYXJhbWV0ZXJzLkRFRkFVTFQ7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGVuY2lsRnVuY0JhY2soc3RlbmNpbEJhY2suZnVuYywgc3RlbmNpbEJhY2sucmVmLCBzdGVuY2lsQmFjay5yZWFkTWFzayk7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGVuY2lsT3BlcmF0aW9uQmFjayhzdGVuY2lsQmFjay5mYWlsLCBzdGVuY2lsQmFjay56ZmFpbCwgc3RlbmNpbEJhY2suenBhc3MsIHN0ZW5jaWxCYWNrLndyaXRlTWFzayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnNldFN0ZW5jaWxUZXN0KGZhbHNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldERlcHRoU3RhdGUoZGVwdGhTdGF0ZSkge1xuICAgICAgICBjb25zdCBjdXJyZW50RGVwdGhTdGF0ZSA9IHRoaXMuZGVwdGhTdGF0ZTtcbiAgICAgICAgaWYgKCFjdXJyZW50RGVwdGhTdGF0ZS5lcXVhbHMoZGVwdGhTdGF0ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcblxuICAgICAgICAgICAgLy8gd3JpdGVcbiAgICAgICAgICAgIGNvbnN0IHdyaXRlID0gZGVwdGhTdGF0ZS53cml0ZTtcbiAgICAgICAgICAgIGlmIChjdXJyZW50RGVwdGhTdGF0ZS53cml0ZSAhPT0gd3JpdGUpIHtcbiAgICAgICAgICAgICAgICBnbC5kZXB0aE1hc2sod3JpdGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBoYW5kbGUgY2FzZSB3aGVyZSBkZXB0aCB0ZXN0aW5nIGlzIG9mZiwgYnV0IGRlcHRoIHdyaXRlIGlzIG9uID0+IGVuYWJsZSBhbHdheXMgdGVzdCB0byBkZXB0aCB3cml0ZVxuICAgICAgICAgICAgLy8gTm90ZSBvbiBXZWJHTCBBUEkgYmVoYXZpb3I6IFdoZW4gZGVwdGggdGVzdGluZyBpcyBkaXNhYmxlZCwgd3JpdGVzIHRvIHRoZSBkZXB0aCBidWZmZXIgYXJlIGFsc28gZGlzYWJsZWQuXG4gICAgICAgICAgICBsZXQgeyBmdW5jLCB0ZXN0IH0gPSBkZXB0aFN0YXRlO1xuICAgICAgICAgICAgaWYgKCF0ZXN0ICYmIHdyaXRlKSB7XG4gICAgICAgICAgICAgICAgdGVzdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgZnVuYyA9IEZVTkNfQUxXQVlTO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY3VycmVudERlcHRoU3RhdGUuZnVuYyAhPT0gZnVuYykge1xuICAgICAgICAgICAgICAgIGdsLmRlcHRoRnVuYyh0aGlzLmdsQ29tcGFyaXNvbltmdW5jXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjdXJyZW50RGVwdGhTdGF0ZS50ZXN0ICE9PSB0ZXN0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHRlc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGdsLmRpc2FibGUoZ2wuREVQVEhfVEVTVCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB1cGRhdGUgaW50ZXJuYWwgc3RhdGVcbiAgICAgICAgICAgIGN1cnJlbnREZXB0aFN0YXRlLmNvcHkoZGVwdGhTdGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDdWxsTW9kZShjdWxsTW9kZSkge1xuICAgICAgICBpZiAodGhpcy5jdWxsTW9kZSAhPT0gY3VsbE1vZGUpIHtcbiAgICAgICAgICAgIGlmIChjdWxsTW9kZSA9PT0gQ1VMTEZBQ0VfTk9ORSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2wuZGlzYWJsZSh0aGlzLmdsLkNVTExfRkFDRSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1bGxNb2RlID09PSBDVUxMRkFDRV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuZW5hYmxlKHRoaXMuZ2wuQ1VMTF9GQUNFKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtb2RlID0gdGhpcy5nbEN1bGxbY3VsbE1vZGVdO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmN1bGxGYWNlICE9PSBtb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZ2wuY3VsbEZhY2UobW9kZSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VsbEZhY2UgPSBtb2RlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VsbE1vZGUgPSBjdWxsTW9kZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGFjdGl2ZSBzaGFkZXIgdG8gYmUgdXNlZCBkdXJpbmcgc3Vic2VxdWVudCBkcmF3IGNhbGxzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTaGFkZXJ9IHNoYWRlciAtIFRoZSBzaGFkZXIgdG8gc2V0IHRvIGFzc2lnbiB0byB0aGUgZGV2aWNlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBzaGFkZXIgd2FzIHN1Y2Nlc3NmdWxseSBzZXQsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZXRTaGFkZXIoc2hhZGVyKSB7XG4gICAgICAgIGlmIChzaGFkZXIgIT09IHRoaXMuc2hhZGVyKSB7XG4gICAgICAgICAgICBpZiAoc2hhZGVyLmZhaWxlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXNoYWRlci5yZWFkeSAmJiAhc2hhZGVyLmltcGwuZmluYWxpemUodGhpcywgc2hhZGVyKSkge1xuICAgICAgICAgICAgICAgIHNoYWRlci5mYWlsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zaGFkZXIgPSBzaGFkZXI7XG5cbiAgICAgICAgICAgIC8vIFNldCB0aGUgYWN0aXZlIHNoYWRlclxuICAgICAgICAgICAgdGhpcy5nbC51c2VQcm9ncmFtKHNoYWRlci5pbXBsLmdsUHJvZ3JhbSk7XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHRoaXMuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUrKztcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICB0aGlzLmF0dHJpYnV0ZXNJbnZhbGlkYXRlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGEgc3VwcG9ydGVkIEhEUiBwaXhlbCBmb3JtYXQgZ2l2ZW4gYSBzZXQgb2YgaGFyZHdhcmUgc3VwcG9ydCByZXF1aXJlbWVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByZWZlckxhcmdlc3QgLSBJZiB0cnVlLCBwcmVmZXIgdGhlIGhpZ2hlc3QgcHJlY2lzaW9uIGZvcm1hdC4gT3RoZXJ3aXNlIHByZWZlciB0aGUgbG93ZXN0IHByZWNpc2lvbiBmb3JtYXQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSByZW5kZXJhYmxlIC0gSWYgdHJ1ZSwgb25seSBpbmNsdWRlIHBpeGVsIGZvcm1hdHMgdGhhdCBjYW4gYmUgdXNlZCBhcyByZW5kZXIgdGFyZ2V0cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHVwZGF0YWJsZSAtIElmIHRydWUsIG9ubHkgaW5jbHVkZSBmb3JtYXRzIHRoYXQgY2FuIGJlIHVwZGF0ZWQgYnkgdGhlIENQVS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGZpbHRlcmFibGUgLSBJZiB0cnVlLCBvbmx5IGluY2x1ZGUgZm9ybWF0cyB0aGF0IHN1cHBvcnQgdGV4dHVyZSBmaWx0ZXJpbmcuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgSERSIHBpeGVsIGZvcm1hdCBvciBudWxsIGlmIHRoZXJlIGFyZSBub25lLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRIZHJGb3JtYXQocHJlZmVyTGFyZ2VzdCwgcmVuZGVyYWJsZSwgdXBkYXRhYmxlLCBmaWx0ZXJhYmxlKSB7XG4gICAgICAgIC8vIE5vdGUgdGhhdCBmb3IgV2ViR0wyLCBQSVhFTEZPUk1BVF9SR0IxNkYgYW5kIFBJWEVMRk9STUFUX1JHQjMyRiBhcmUgbm90IHJlbmRlcmFibGUgYWNjb3JkaW5nIHRvIHRoaXM6XG4gICAgICAgIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9FWFRfY29sb3JfYnVmZmVyX2Zsb2F0XG4gICAgICAgIC8vIEZvciBXZWJHTDEsIG9ubHkgUElYRUxGT1JNQVRfUkdCQTE2RiBhbmQgUElYRUxGT1JNQVRfUkdCQTMyRiBhcmUgdGVzdGVkIGZvciBiZWluZyByZW5kZXJhYmxlLlxuICAgICAgICBjb25zdCBmMTZWYWxpZCA9IHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdCAmJlxuICAgICAgICAgICAgKCFyZW5kZXJhYmxlIHx8IHRoaXMudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUpICYmXG4gICAgICAgICAgICAoIXVwZGF0YWJsZSB8fCB0aGlzLnRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUpICYmXG4gICAgICAgICAgICAoIWZpbHRlcmFibGUgfHwgdGhpcy5leHRUZXh0dXJlSGFsZkZsb2F0TGluZWFyKTtcbiAgICAgICAgY29uc3QgZjMyVmFsaWQgPSB0aGlzLmV4dFRleHR1cmVGbG9hdCAmJlxuICAgICAgICAgICAgKCFyZW5kZXJhYmxlIHx8IHRoaXMudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSkgJiZcbiAgICAgICAgICAgICghZmlsdGVyYWJsZSB8fCB0aGlzLmV4dFRleHR1cmVGbG9hdExpbmVhcik7XG5cbiAgICAgICAgaWYgKGYxNlZhbGlkICYmIGYzMlZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJlZmVyTGFyZ2VzdCA/IFBJWEVMRk9STUFUX1JHQkEzMkYgOiBQSVhFTEZPUk1BVF9SR0JBMTZGO1xuICAgICAgICB9IGVsc2UgaWYgKGYxNlZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gUElYRUxGT1JNQVRfUkdCQTE2RjtcbiAgICAgICAgfSBlbHNlIGlmIChmMzJWYWxpZCkge1xuICAgICAgICAgICAgcmV0dXJuIFBJWEVMRk9STUFUX1JHQkEzMkY7XG4gICAgICAgIH0gLyogZWxzZSAqL1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyBtZW1vcnkgZnJvbSBhbGwgdmVydGV4IGFycmF5IG9iamVjdHMgZXZlciBhbGxvY2F0ZWQgd2l0aCB0aGlzIGRldmljZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjbGVhclZlcnRleEFycmF5T2JqZWN0Q2FjaGUoKSB7XG4gICAgICAgIGNvbnN0IGdsID0gdGhpcy5nbDtcbiAgICAgICAgdGhpcy5fdmFvTWFwLmZvckVhY2goKGl0ZW0sIGtleSwgbWFwT2JqKSA9PiB7XG4gICAgICAgICAgICBnbC5kZWxldGVWZXJ0ZXhBcnJheShpdGVtKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5fdmFvTWFwLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgcmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpIHtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSBoZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgcmF0aW8gPSBNYXRoLm1pbih0aGlzLl9tYXhQaXhlbFJhdGlvLCBwbGF0Zm9ybS5icm93c2VyID8gd2luZG93LmRldmljZVBpeGVsUmF0aW8gOiAxKTtcbiAgICAgICAgd2lkdGggPSBNYXRoLmZsb29yKHdpZHRoICogcmF0aW8pO1xuICAgICAgICBoZWlnaHQgPSBNYXRoLmZsb29yKGhlaWdodCAqIHJhdGlvKTtcblxuICAgICAgICBpZiAodGhpcy5jYW52YXMud2lkdGggIT09IHdpZHRoIHx8IHRoaXMuY2FudmFzLmhlaWdodCAhPT0gaGVpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLmNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgICAgICAgICAgdGhpcy5jYW52YXMuaGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgdGhpcy5maXJlKEdyYXBoaWNzRGV2aWNlLkVWRU5UX1JFU0laRSwgd2lkdGgsIGhlaWdodCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaWR0aCBvZiB0aGUgYmFjayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdsLmRyYXdpbmdCdWZmZXJXaWR0aCB8fCB0aGlzLmNhbnZhcy53aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIZWlnaHQgb2YgdGhlIGJhY2sgYnVmZmVyIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGhlaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2wuZHJhd2luZ0J1ZmZlckhlaWdodCB8fCB0aGlzLmNhbnZhcy5oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnVsbHNjcmVlbiBtb2RlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZ1bGxzY3JlZW4oZnVsbHNjcmVlbikge1xuICAgICAgICBpZiAoZnVsbHNjcmVlbikge1xuICAgICAgICAgICAgY29uc3QgY2FudmFzID0gdGhpcy5nbC5jYW52YXM7XG4gICAgICAgICAgICBjYW52YXMucmVxdWVzdEZ1bGxzY3JlZW4oKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmV4aXRGdWxsc2NyZWVuKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZnVsbHNjcmVlbigpIHtcbiAgICAgICAgcmV0dXJuICEhZG9jdW1lbnQuZnVsbHNjcmVlbkVsZW1lbnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgaGlnaCBwcmVjaXNpb24gZmxvYXRpbmctcG9pbnQgdGV4dHVyZXMgYXJlIHN1cHBvcnRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB0ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uKCkge1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUZsb2F0SGlnaFByZWNpc2lvbiA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uID0gdGVzdFRleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb24odGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmVGbG9hdEhpZ2hQcmVjaXNpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgdGV4dHVyZSB3aXRoIGhhbGYgZmxvYXQgZm9ybWF0IGNhbiBiZSB1cGRhdGVkIHdpdGggZGF0YS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB0ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlKCkge1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dHVyZUhhbGZGbG9hdFVwZGF0YWJsZSA9IHRlc3RUZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlKHRoaXMuZ2wsIHRoaXMuZXh0VGV4dHVyZUhhbGZGbG9hdC5IQUxGX0ZMT0FUX09FUyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGU7XG4gICAgfVxuXG4gICAgLy8gI2lmIF9ERUJVR1xuICAgIC8vIGRlYnVnIGhlbHBlciB0byBmb3JjZSBsb3N0IGNvbnRleHRcbiAgICBkZWJ1Z0xvc2VDb250ZXh0KHNsZWVwID0gMTAwKSB7XG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSB0aGlzLmdsLmdldEV4dGVuc2lvbignV0VCR0xfbG9zZV9jb250ZXh0Jyk7XG4gICAgICAgIGNvbnRleHQubG9zZUNvbnRleHQoKTtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiBjb250ZXh0LnJlc3RvcmVDb250ZXh0KCksIHNsZWVwKTtcbiAgICB9XG4gICAgLy8gI2VuZGlmXG59XG5cbmV4cG9ydCB7IFdlYmdsR3JhcGhpY3NEZXZpY2UgfTtcbiJdLCJuYW1lcyI6WyJpbnZhbGlkYXRlQXR0YWNobWVudHMiLCJfZnVsbFNjcmVlblF1YWRWUyIsIl9wcmVjaXNpb25UZXN0MVBTIiwiX3ByZWNpc2lvblRlc3QyUFMiLCJfb3V0cHV0VGV4dHVyZTJEIiwicXVhZFdpdGhTaGFkZXIiLCJkZXZpY2UiLCJ0YXJnZXQiLCJzaGFkZXIiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsIm9sZFJ0IiwicmVuZGVyVGFyZ2V0Iiwic2V0UmVuZGVyVGFyZ2V0IiwidXBkYXRlQmVnaW4iLCJzZXRDdWxsTW9kZSIsIkNVTExGQUNFX05PTkUiLCJzZXRCbGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsIk5PQkxFTkQiLCJzZXREZXB0aFN0YXRlIiwiRGVwdGhTdGF0ZSIsIk5PREVQVEgiLCJzZXRTdGVuY2lsU3RhdGUiLCJzZXRWZXJ0ZXhCdWZmZXIiLCJxdWFkVmVydGV4QnVmZmVyIiwic2V0U2hhZGVyIiwiZHJhdyIsInR5cGUiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJiYXNlIiwiY291bnQiLCJpbmRleGVkIiwidXBkYXRlRW5kIiwicG9wR3B1TWFya2VyIiwidGVzdFJlbmRlcmFibGUiLCJnbCIsInBpeGVsRm9ybWF0IiwicmVzdWx0IiwidGV4dHVyZSIsImNyZWF0ZVRleHR1cmUiLCJiaW5kVGV4dHVyZSIsIlRFWFRVUkVfMkQiLCJ0ZXhQYXJhbWV0ZXJpIiwiVEVYVFVSRV9NSU5fRklMVEVSIiwiTkVBUkVTVCIsIlRFWFRVUkVfTUFHX0ZJTFRFUiIsIlRFWFRVUkVfV1JBUF9TIiwiQ0xBTVBfVE9fRURHRSIsIlRFWFRVUkVfV1JBUF9UIiwidGV4SW1hZ2UyRCIsIlJHQkEiLCJmcmFtZWJ1ZmZlciIsImNyZWF0ZUZyYW1lYnVmZmVyIiwiYmluZEZyYW1lYnVmZmVyIiwiRlJBTUVCVUZGRVIiLCJmcmFtZWJ1ZmZlclRleHR1cmUyRCIsIkNPTE9SX0FUVEFDSE1FTlQwIiwiY2hlY2tGcmFtZWJ1ZmZlclN0YXR1cyIsIkZSQU1FQlVGRkVSX0NPTVBMRVRFIiwiZGVsZXRlVGV4dHVyZSIsImRlbGV0ZUZyYW1lYnVmZmVyIiwidGVzdFRleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJkYXRhIiwiVWludDE2QXJyYXkiLCJnZXRFcnJvciIsIk5PX0VSUk9SIiwiY29uc29sZSIsImxvZyIsInRlc3RUZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uIiwidGV4dHVyZUZsb2F0UmVuZGVyYWJsZSIsInNoYWRlcjEiLCJTaGFkZXIiLCJTaGFkZXJVdGlscyIsImNyZWF0ZURlZmluaXRpb24iLCJuYW1lIiwidmVydGV4Q29kZSIsImZyYWdtZW50Q29kZSIsInNoYWRlcjIiLCJ0ZXh0dXJlT3B0aW9ucyIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJ3aWR0aCIsImhlaWdodCIsIm1pcG1hcHMiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIm1hZ0ZpbHRlciIsInRleDEiLCJUZXh0dXJlIiwidGFyZzEiLCJSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsImRlcHRoIiwiUElYRUxGT1JNQVRfUkdCQTgiLCJ0ZXgyIiwidGFyZzIiLCJjb25zdGFudFRleFNvdXJjZSIsInNldFZhbHVlIiwicHJldkZyYW1lYnVmZmVyIiwiYWN0aXZlRnJhbWVidWZmZXIiLCJzZXRGcmFtZWJ1ZmZlciIsImltcGwiLCJfZ2xGcmFtZUJ1ZmZlciIsInBpeGVscyIsIlVpbnQ4QXJyYXkiLCJyZWFkUGl4ZWxzIiwieCIsInkiLCJ6IiwidyIsImYiLCJkZXN0cm95IiwiV2ViZ2xHcmFwaGljc0RldmljZSIsIkdyYXBoaWNzRGV2aWNlIiwiY29uc3RydWN0b3IiLCJjYW52YXMiLCJvcHRpb25zIiwid2ViZ2wyIiwiaW5pdE9wdGlvbnMiLCJkZWZhdWx0RnJhbWVidWZmZXIiLCJ1cGRhdGVDbGllbnRSZWN0IiwiY29udGV4dExvc3QiLCJfY29udGV4dExvc3RIYW5kbGVyIiwiZXZlbnQiLCJwcmV2ZW50RGVmYXVsdCIsImxvc2VDb250ZXh0IiwiRGVidWciLCJmaXJlIiwiX2NvbnRleHRSZXN0b3JlZEhhbmRsZXIiLCJyZXN0b3JlQ29udGV4dCIsInVhIiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwiZm9yY2VEaXNhYmxlTXVsdGlzYW1wbGluZyIsImluY2x1ZGVzIiwiYW50aWFsaWFzIiwicHJlZmVyV2ViR2wyIiwidW5kZWZpbmVkIiwibmFtZXMiLCJpIiwibGVuZ3RoIiwiZ2V0Q29udGV4dCIsIkVycm9yIiwiV2ViR0wyUmVuZGVyaW5nQ29udGV4dCIsIl9kZXZpY2VUeXBlIiwiREVWSUNFVFlQRV9XRUJHTDIiLCJERVZJQ0VUWVBFX1dFQkdMMSIsImFscGhhQml0cyIsImdldFBhcmFtZXRlciIsIkFMUEhBX0JJVFMiLCJmcmFtZWJ1ZmZlckZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQjgiLCJpc0Nocm9tZSIsInBsYXRmb3JtIiwiYnJvd3Nlck5hbWUiLCJpc1NhZmFyaSIsImlzTWFjIiwiYnJvd3NlciIsImFwcFZlcnNpb24iLCJpbmRleE9mIiwiX3RlbXBFbmFibGVTYWZhcmlUZXh0dXJlVW5pdFdvcmthcm91bmQiLCJfdGVtcE1hY0Nocm9tZUJsaXRGcmFtZWJ1ZmZlcldvcmthcm91bmQiLCJhbHBoYSIsInNldHVwVmVydGV4QXJyYXlPYmplY3QiLCJhZGRFdmVudExpc3RlbmVyIiwiaW5pdGlhbGl6ZUV4dGVuc2lvbnMiLCJpbml0aWFsaXplQ2FwYWJpbGl0aWVzIiwiaW5pdGlhbGl6ZVJlbmRlclN0YXRlIiwiaW5pdGlhbGl6ZUNvbnRleHRDYWNoZXMiLCJzdXBwb3J0c0ltYWdlQml0bWFwIiwiSW1hZ2VCaXRtYXAiLCJnbEFkZHJlc3MiLCJSRVBFQVQiLCJNSVJST1JFRF9SRVBFQVQiLCJnbEJsZW5kRXF1YXRpb24iLCJGVU5DX0FERCIsIkZVTkNfU1VCVFJBQ1QiLCJGVU5DX1JFVkVSU0VfU1VCVFJBQ1QiLCJNSU4iLCJleHRCbGVuZE1pbm1heCIsIk1JTl9FWFQiLCJNQVgiLCJNQVhfRVhUIiwiZ2xCbGVuZEZ1bmN0aW9uQ29sb3IiLCJaRVJPIiwiT05FIiwiU1JDX0NPTE9SIiwiT05FX01JTlVTX1NSQ19DT0xPUiIsIkRTVF9DT0xPUiIsIk9ORV9NSU5VU19EU1RfQ09MT1IiLCJTUkNfQUxQSEEiLCJTUkNfQUxQSEFfU0FUVVJBVEUiLCJPTkVfTUlOVVNfU1JDX0FMUEhBIiwiRFNUX0FMUEhBIiwiT05FX01JTlVTX0RTVF9BTFBIQSIsIkNPTlNUQU5UX0NPTE9SIiwiT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SIiwiZ2xCbGVuZEZ1bmN0aW9uQWxwaGEiLCJDT05TVEFOVF9BTFBIQSIsIk9ORV9NSU5VU19DT05TVEFOVF9BTFBIQSIsImdsQ29tcGFyaXNvbiIsIk5FVkVSIiwiTEVTUyIsIkVRVUFMIiwiTEVRVUFMIiwiR1JFQVRFUiIsIk5PVEVRVUFMIiwiR0VRVUFMIiwiQUxXQVlTIiwiZ2xTdGVuY2lsT3AiLCJLRUVQIiwiUkVQTEFDRSIsIklOQ1IiLCJJTkNSX1dSQVAiLCJERUNSIiwiREVDUl9XUkFQIiwiSU5WRVJUIiwiZ2xDbGVhckZsYWciLCJDT0xPUl9CVUZGRVJfQklUIiwiREVQVEhfQlVGRkVSX0JJVCIsIlNURU5DSUxfQlVGRkVSX0JJVCIsImdsQ3VsbCIsIkJBQ0siLCJGUk9OVCIsIkZST05UX0FORF9CQUNLIiwiZ2xGaWx0ZXIiLCJMSU5FQVIiLCJORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiTElORUFSX01JUE1BUF9ORUFSRVNUIiwiTElORUFSX01JUE1BUF9MSU5FQVIiLCJnbFByaW1pdGl2ZSIsIlBPSU5UUyIsIkxJTkVTIiwiTElORV9MT09QIiwiTElORV9TVFJJUCIsIlRSSUFOR0xFUyIsIlRSSUFOR0xFX1NUUklQIiwiVFJJQU5HTEVfRkFOIiwiZ2xUeXBlIiwiQllURSIsIlVOU0lHTkVEX0JZVEUiLCJTSE9SVCIsIlVOU0lHTkVEX1NIT1JUIiwiSU5UIiwiVU5TSUdORURfSU5UIiwiRkxPQVQiLCJwY1VuaWZvcm1UeXBlIiwiQk9PTCIsIlVOSUZPUk1UWVBFX0JPT0wiLCJVTklGT1JNVFlQRV9JTlQiLCJVTklGT1JNVFlQRV9GTE9BVCIsIkZMT0FUX1ZFQzIiLCJVTklGT1JNVFlQRV9WRUMyIiwiRkxPQVRfVkVDMyIsIlVOSUZPUk1UWVBFX1ZFQzMiLCJGTE9BVF9WRUM0IiwiVU5JRk9STVRZUEVfVkVDNCIsIklOVF9WRUMyIiwiVU5JRk9STVRZUEVfSVZFQzIiLCJJTlRfVkVDMyIsIlVOSUZPUk1UWVBFX0lWRUMzIiwiSU5UX1ZFQzQiLCJVTklGT1JNVFlQRV9JVkVDNCIsIkJPT0xfVkVDMiIsIlVOSUZPUk1UWVBFX0JWRUMyIiwiQk9PTF9WRUMzIiwiVU5JRk9STVRZUEVfQlZFQzMiLCJCT09MX1ZFQzQiLCJVTklGT1JNVFlQRV9CVkVDNCIsIkZMT0FUX01BVDIiLCJVTklGT1JNVFlQRV9NQVQyIiwiRkxPQVRfTUFUMyIsIlVOSUZPUk1UWVBFX01BVDMiLCJGTE9BVF9NQVQ0IiwiVU5JRk9STVRZUEVfTUFUNCIsIlNBTVBMRVJfMkQiLCJVTklGT1JNVFlQRV9URVhUVVJFMkQiLCJTQU1QTEVSX0NVQkUiLCJVTklGT1JNVFlQRV9URVhUVVJFQ1VCRSIsIlNBTVBMRVJfMkRfU0hBRE9XIiwiVU5JRk9STVRZUEVfVEVYVFVSRTJEX1NIQURPVyIsIlNBTVBMRVJfQ1VCRV9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1ciLCJTQU1QTEVSXzNEIiwiVU5JRk9STVRZUEVfVEVYVFVSRTNEIiwidGFyZ2V0VG9TbG90IiwiVEVYVFVSRV9DVUJFX01BUCIsIlRFWFRVUkVfM0QiLCJzY29wZVgiLCJzY29wZVkiLCJzY29wZVoiLCJzY29wZVciLCJ1bmlmb3JtVmFsdWUiLCJjb21taXRGdW5jdGlvbiIsInVuaWZvcm0iLCJ2YWx1ZSIsInVuaWZvcm0xaSIsImxvY2F0aW9uSWQiLCJ1bmlmb3JtMWYiLCJ1bmlmb3JtMmZ2IiwidW5pZm9ybTNmdiIsInVuaWZvcm00ZnYiLCJ1bmlmb3JtMml2IiwidW5pZm9ybTNpdiIsInVuaWZvcm00aXYiLCJ1bmlmb3JtTWF0cml4MmZ2IiwidW5pZm9ybU1hdHJpeDNmdiIsInVuaWZvcm1NYXRyaXg0ZnYiLCJVTklGT1JNVFlQRV9GTE9BVEFSUkFZIiwidW5pZm9ybTFmdiIsIlVOSUZPUk1UWVBFX1ZFQzJBUlJBWSIsIlVOSUZPUk1UWVBFX1ZFQzNBUlJBWSIsIlVOSUZPUk1UWVBFX1ZFQzRBUlJBWSIsInN1cHBvcnRzQm9uZVRleHR1cmVzIiwiZXh0VGV4dHVyZUZsb2F0IiwibWF4VmVydGV4VGV4dHVyZXMiLCJudW1Vbmlmb3JtcyIsInZlcnRleFVuaWZvcm1zQ291bnQiLCJib25lTGltaXQiLCJNYXRoIiwiZmxvb3IiLCJtaW4iLCJ1bm1hc2tlZFJlbmRlcmVyIiwic2NvcGUiLCJyZXNvbHZlIiwiZXh0Q29sb3JCdWZmZXJGbG9hdCIsImV4dENvbG9yQnVmZmVySGFsZkZsb2F0IiwidGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUiLCJleHRUZXh0dXJlSGFsZkZsb2F0IiwiSEFMRl9GTE9BVF9PRVMiLCJzdXBwb3J0c01vcnBoVGFyZ2V0VGV4dHVyZXNDb3JlIiwibWF4UHJlY2lzaW9uIiwic3VwcG9ydHNEZXB0aFNoYWRvdyIsIl90ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uIiwiX3RleHR1cmVIYWxmRmxvYXRVcGRhdGFibGUiLCJhcmVhTGlnaHRMdXRGb3JtYXQiLCJ0ZXh0dXJlSGFsZkZsb2F0VXBkYXRhYmxlIiwiZXh0VGV4dHVyZUhhbGZGbG9hdExpbmVhciIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJleHRUZXh0dXJlRmxvYXRMaW5lYXIiLCJwb3N0SW5pdCIsImZlZWRiYWNrIiwiZGVsZXRlVHJhbnNmb3JtRmVlZGJhY2siLCJjbGVhclZlcnRleEFycmF5T2JqZWN0Q2FjaGUiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwicG9zdERlc3Ryb3kiLCJjcmVhdGVWZXJ0ZXhCdWZmZXJJbXBsIiwidmVydGV4QnVmZmVyIiwiV2ViZ2xWZXJ0ZXhCdWZmZXIiLCJjcmVhdGVJbmRleEJ1ZmZlckltcGwiLCJpbmRleEJ1ZmZlciIsIldlYmdsSW5kZXhCdWZmZXIiLCJjcmVhdGVTaGFkZXJJbXBsIiwiV2ViZ2xTaGFkZXIiLCJjcmVhdGVUZXh0dXJlSW1wbCIsIldlYmdsVGV4dHVyZSIsImNyZWF0ZVJlbmRlclRhcmdldEltcGwiLCJXZWJnbFJlbmRlclRhcmdldCIsInB1c2hNYXJrZXIiLCJ3aW5kb3ciLCJzcGVjdG9yIiwibGFiZWwiLCJ0b1N0cmluZyIsInNldE1hcmtlciIsInBvcE1hcmtlciIsImNsZWFyTWFya2VyIiwiZ2V0UHJlY2lzaW9uIiwicHJlY2lzaW9uIiwiZ2V0U2hhZGVyUHJlY2lzaW9uRm9ybWF0IiwidmVydGV4U2hhZGVyUHJlY2lzaW9uSGlnaHBGbG9hdCIsIlZFUlRFWF9TSEFERVIiLCJISUdIX0ZMT0FUIiwidmVydGV4U2hhZGVyUHJlY2lzaW9uTWVkaXVtcEZsb2F0IiwiTUVESVVNX0ZMT0FUIiwiZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25IaWdocEZsb2F0IiwiRlJBR01FTlRfU0hBREVSIiwiZnJhZ21lbnRTaGFkZXJQcmVjaXNpb25NZWRpdW1wRmxvYXQiLCJoaWdocEF2YWlsYWJsZSIsIm1lZGl1bXBBdmFpbGFibGUiLCJ3YXJuIiwiZ2V0RXh0ZW5zaW9uIiwiYXJndW1lbnRzIiwic3VwcG9ydGVkRXh0ZW5zaW9ucyIsImV4dERpc2pvaW50VGltZXJRdWVyeSIsIl9leHREaXNqb2ludFRpbWVyUXVlcnkiLCJnZXRTdXBwb3J0ZWRFeHRlbnNpb25zIiwiZXh0RHJhd0J1ZmZlcnMiLCJkcmF3QnVmZmVycyIsImJpbmQiLCJleHRJbnN0YW5jaW5nIiwiZXh0U3RhbmRhcmREZXJpdmF0aXZlcyIsImV4dFRleHR1cmVMb2QiLCJleHRVaW50RWxlbWVudCIsImV4dFZlcnRleEFycmF5T2JqZWN0IiwiZXh0RGVwdGhUZXh0dXJlIiwiX3RoaXMkZXh0RHJhd0J1ZmZlcnMiLCJkcmF3QnVmZmVyc1dFQkdMIiwiZXh0IiwiZHJhd0FycmF5c0luc3RhbmNlZCIsImRyYXdBcnJheXNJbnN0YW5jZWRBTkdMRSIsImRyYXdFbGVtZW50c0luc3RhbmNlZCIsImRyYXdFbGVtZW50c0luc3RhbmNlZEFOR0xFIiwidmVydGV4QXR0cmliRGl2aXNvciIsInZlcnRleEF0dHJpYkRpdmlzb3JBTkdMRSIsImNyZWF0ZVZlcnRleEFycmF5IiwiY3JlYXRlVmVydGV4QXJyYXlPRVMiLCJkZWxldGVWZXJ0ZXhBcnJheSIsImRlbGV0ZVZlcnRleEFycmF5T0VTIiwiaXNWZXJ0ZXhBcnJheSIsImlzVmVydGV4QXJyYXlPRVMiLCJiaW5kVmVydGV4QXJyYXkiLCJiaW5kVmVydGV4QXJyYXlPRVMiLCJleHREZWJ1Z1JlbmRlcmVySW5mbyIsImV4dEZsb2F0QmxlbmQiLCJleHRUZXh0dXJlRmlsdGVyQW5pc290cm9waWMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQzEiLCJleHRDb21wcmVzc2VkVGV4dHVyZUVUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZVMzVEMiLCJleHRDb21wcmVzc2VkVGV4dHVyZUFUQyIsImV4dENvbXByZXNzZWRUZXh0dXJlQVNUQyIsImV4dFBhcmFsbGVsU2hhZGVyQ29tcGlsZSIsImNvbnRleHRBdHRyaWJzIiwiZ2V0Q29udGV4dEF0dHJpYnV0ZXMiLCJzdXBwb3J0c01zYWEiLCJzdXBwb3J0c1N0ZW5jaWwiLCJzdGVuY2lsIiwic3VwcG9ydHNJbnN0YW5jaW5nIiwibWF4VGV4dHVyZVNpemUiLCJNQVhfVEVYVFVSRV9TSVpFIiwibWF4Q3ViZU1hcFNpemUiLCJNQVhfQ1VCRV9NQVBfVEVYVFVSRV9TSVpFIiwibWF4UmVuZGVyQnVmZmVyU2l6ZSIsIk1BWF9SRU5ERVJCVUZGRVJfU0laRSIsIm1heFRleHR1cmVzIiwiTUFYX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJtYXhDb21iaW5lZFRleHR1cmVzIiwiTUFYX0NPTUJJTkVEX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJNQVhfVkVSVEVYX1RFWFRVUkVfSU1BR0VfVU5JVFMiLCJNQVhfVkVSVEVYX1VOSUZPUk1fVkVDVE9SUyIsImZyYWdtZW50VW5pZm9ybXNDb3VudCIsIk1BWF9GUkFHTUVOVF9VTklGT1JNX1ZFQ1RPUlMiLCJtYXhEcmF3QnVmZmVycyIsIk1BWF9EUkFXX0JVRkZFUlMiLCJtYXhDb2xvckF0dGFjaG1lbnRzIiwiTUFYX0NPTE9SX0FUVEFDSE1FTlRTIiwibWF4Vm9sdW1lU2l6ZSIsIk1BWF8zRF9URVhUVVJFX1NJWkUiLCJzdXBwb3J0c01ydCIsInN1cHBvcnRzVm9sdW1lVGV4dHVyZXMiLCJNQVhfRFJBV19CVUZGRVJTX1dFQkdMIiwiTUFYX0NPTE9SX0FUVEFDSE1FTlRTX1dFQkdMIiwiVU5NQVNLRURfUkVOREVSRVJfV0VCR0wiLCJ1bm1hc2tlZFZlbmRvciIsIlVOTUFTS0VEX1ZFTkRPUl9XRUJHTCIsIm1hbGlSZW5kZXJlclJlZ2V4Iiwic2Ftc3VuZ01vZGVsUmVnZXgiLCJzdXBwb3J0c0dwdVBhcnRpY2xlcyIsIm1hdGNoIiwibWF4QW5pc290cm9weSIsIk1BWF9URVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCIsInNhbXBsZXMiLCJTQU1QTEVTIiwibWF4U2FtcGxlcyIsIk1BWF9TQU1QTEVTIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwiYW5kcm9pZCIsInN1cHBvcnRzVGV4dHVyZUZldGNoIiwiZGlzYWJsZSIsIkJMRU5EIiwiYmxlbmRGdW5jIiwiYmxlbmRFcXVhdGlvbiIsImNvbG9yTWFzayIsImJsZW5kQ29sb3IiLCJDb2xvciIsImVuYWJsZSIsIkNVTExfRkFDRSIsImN1bGxGYWNlIiwiREVQVEhfVEVTVCIsImRlcHRoRnVuYyIsImRlcHRoTWFzayIsIlNURU5DSUxfVEVTVCIsInN0ZW5jaWxGdW5jRnJvbnQiLCJzdGVuY2lsRnVuY0JhY2siLCJGVU5DX0FMV0FZUyIsInN0ZW5jaWxSZWZGcm9udCIsInN0ZW5jaWxSZWZCYWNrIiwic3RlbmNpbE1hc2tGcm9udCIsInN0ZW5jaWxNYXNrQmFjayIsInN0ZW5jaWxGdW5jIiwic3RlbmNpbEZhaWxGcm9udCIsInN0ZW5jaWxGYWlsQmFjayIsIlNURU5DSUxPUF9LRUVQIiwic3RlbmNpbFpmYWlsRnJvbnQiLCJzdGVuY2lsWmZhaWxCYWNrIiwic3RlbmNpbFpwYXNzRnJvbnQiLCJzdGVuY2lsWnBhc3NCYWNrIiwic3RlbmNpbFdyaXRlTWFza0Zyb250Iiwic3RlbmNpbFdyaXRlTWFza0JhY2siLCJzdGVuY2lsT3AiLCJzdGVuY2lsTWFzayIsImFscGhhVG9Db3ZlcmFnZSIsInJhc3RlciIsIlNBTVBMRV9BTFBIQV9UT19DT1ZFUkFHRSIsIlJBU1RFUklaRVJfRElTQ0FSRCIsImRlcHRoQmlhc0VuYWJsZWQiLCJQT0xZR09OX09GRlNFVF9GSUxMIiwiY2xlYXJEZXB0aCIsImNsZWFyQ29sb3IiLCJjbGVhclN0ZW5jaWwiLCJoaW50IiwiRlJBR01FTlRfU0hBREVSX0RFUklWQVRJVkVfSElOVCIsIk5JQ0VTVCIsIkZSQUdNRU5UX1NIQURFUl9ERVJJVkFUSVZFX0hJTlRfT0VTIiwiU0NJU1NPUl9URVNUIiwicGl4ZWxTdG9yZWkiLCJVTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OX1dFQkdMIiwiTk9ORSIsInVucGFja0ZsaXBZIiwiVU5QQUNLX0ZMSVBfWV9XRUJHTCIsInVucGFja1ByZW11bHRpcGx5QWxwaGEiLCJVTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wiLCJVTlBBQ0tfQUxJR05NRU5UIiwiX3Zhb01hcCIsIk1hcCIsImJvdW5kVmFvIiwidHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIiLCJ0ZXh0dXJlVW5pdCIsInRleHR1cmVVbml0cyIsInB1c2giLCJzaGFkZXJzIiwidGV4dHVyZXMiLCJidWZmZXIiLCJidWZmZXJzIiwidGFyZ2V0cyIsInVubG9jayIsImVuZFNoYWRlckJhdGNoIiwic2V0Vmlld3BvcnQiLCJoIiwidngiLCJ2eSIsInZ3IiwidmgiLCJ2aWV3cG9ydCIsInNldFNjaXNzb3IiLCJzeCIsInN5Iiwic3ciLCJzaCIsInNjaXNzb3IiLCJmYiIsImNvcHlSZW5kZXJUYXJnZXQiLCJzb3VyY2UiLCJkZXN0IiwiY29sb3IiLCJlcnJvciIsIl9jb2xvckJ1ZmZlciIsIl9mb3JtYXQiLCJfZGVwdGgiLCJfZGVwdGhCdWZmZXIiLCJwcmV2UnQiLCJSRUFEX0ZSQU1FQlVGRkVSIiwiRFJBV19GUkFNRUJVRkZFUiIsImJsaXRGcmFtZWJ1ZmZlciIsImdldENvcHlTaGFkZXIiLCJfY29weVNoYWRlciIsInN0YXJ0UGFzcyIsInJlbmRlclBhc3MiLCJjb2xvck9wcyIsImRlcHRoU3RlbmNpbE9wcyIsImNsZWFyIiwicnQiLCJjbGVhckZsYWdzIiwiY2xlYXJPcHRpb25zIiwiQ0xFQVJGTEFHX0NPTE9SIiwiY2xlYXJWYWx1ZSIsInIiLCJnIiwiYiIsImEiLCJDTEVBUkZMQUdfREVQVEgiLCJjbGVhckRlcHRoVmFsdWUiLCJDTEVBUkZMQUdfU1RFTkNJTCIsImNsZWFyU3RlbmNpbFZhbHVlIiwiZmxhZ3MiLCJjYWxsIiwiaW5zaWRlUmVuZGVyUGFzcyIsImVycm9yT25jZSIsImVuZFBhc3MiLCJ1bmJpbmRWZXJ0ZXhBcnJheSIsImNvbG9yQnVmZmVyQ291bnQiLCJjb2xvckFycmF5T3BzIiwiX3JlbmRlclBhc3MkY29sb3JPcHMiLCJzdG9yZSIsInN0b3JlRGVwdGgiLCJERVBUSF9BVFRBQ0hNRU5UIiwic3RvcmVTdGVuY2lsIiwiU1RFTkNJTF9BVFRBQ0hNRU5UIiwiZnVsbFNpemVDbGVhclJlY3QiLCJpbnZhbGlkYXRlRnJhbWVidWZmZXIiLCJhdXRvUmVzb2x2ZSIsIl9jb2xvckJ1ZmZlcnMiLCJfZ2xUZXh0dXJlIiwicG90IiwiYWN0aXZlVGV4dHVyZSIsImdlbmVyYXRlTWlwbWFwIiwiX2dsVGFyZ2V0IiwidW5pdCIsInNsb3QiLCJpbml0aWFsaXplZCIsImluaXRSZW5kZXJUYXJnZXQiLCJfc2FtcGxlcyIsInNldFVucGFja0ZsaXBZIiwiZmxpcFkiLCJzZXRVbnBhY2tQcmVtdWx0aXBseUFscGhhIiwicHJlbXVsdGlwbHlBbHBoYSIsIlRFWFRVUkUwIiwidGV4dHVyZVRhcmdldCIsInRleHR1cmVPYmplY3QiLCJiaW5kVGV4dHVyZU9uVW5pdCIsInNldFRleHR1cmVQYXJhbWV0ZXJzIiwiZGlydHlQYXJhbWV0ZXJGbGFncyIsImZpbHRlciIsIl9taW5GaWx0ZXIiLCJfbWlwbWFwcyIsIl9jb21wcmVzc2VkIiwiX2xldmVscyIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSIiwiX21hZ0ZpbHRlciIsIl9hZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIl9hZGRyZXNzViIsIlRFWFRVUkVfV1JBUF9SIiwiX2FkZHJlc3NXIiwiVEVYVFVSRV9DT01QQVJFX01PREUiLCJfY29tcGFyZU9uUmVhZCIsIkNPTVBBUkVfUkVGX1RPX1RFWFRVUkUiLCJURVhUVVJFX0NPTVBBUkVfRlVOQyIsIl9jb21wYXJlRnVuYyIsInRleFBhcmFtZXRlcmYiLCJURVhUVVJFX01BWF9BTklTT1RST1BZX0VYVCIsIm1hdGgiLCJjbGFtcCIsInJvdW5kIiwiX2FuaXNvdHJvcHkiLCJzZXRUZXh0dXJlIiwiaW5pdGlhbGl6ZSIsIl9uZWVkc1VwbG9hZCIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJ1cGxvYWQiLCJ2ZXJ0ZXhCdWZmZXJzIiwia2V5IiwidmFvIiwidXNlQ2FjaGUiLCJpZCIsInJlbmRlcmluZ0hhc2giLCJnZXQiLCJiaW5kQnVmZmVyIiwiRUxFTUVOVF9BUlJBWV9CVUZGRVIiLCJsb2NaZXJvIiwiQVJSQVlfQlVGRkVSIiwiYnVmZmVySWQiLCJlbGVtZW50cyIsImoiLCJlIiwibG9jIiwic2VtYW50aWNUb0xvY2F0aW9uIiwidmVydGV4QXR0cmliUG9pbnRlciIsIm51bUNvbXBvbmVudHMiLCJkYXRhVHlwZSIsIm5vcm1hbGl6ZSIsInN0cmlkZSIsIm9mZnNldCIsImVuYWJsZVZlcnRleEF0dHJpYkFycmF5IiwiaW5zdGFuY2luZyIsInNldCIsInNldEJ1ZmZlcnMiLCJhc3NlcnQiLCJwcmltaXRpdmUiLCJudW1JbnN0YW5jZXMiLCJrZWVwQnVmZmVycyIsInNhbXBsZXIiLCJzYW1wbGVyVmFsdWUiLCJudW1UZXh0dXJlcyIsInNjb3BlSWQiLCJ1bmlmb3JtVmVyc2lvbiIsInByb2dyYW1WZXJzaW9uIiwic2FtcGxlcnMiLCJ1bmlmb3JtcyIsImxlbiIsInNhbXBsZXJOYW1lIiwid2Fybk9uY2UiLCJkZXB0aEJ1ZmZlciIsImFycmF5IiwidW5pZm9ybTFpdiIsInZlcnNpb24iLCJ2ZXJzaW9uT2JqZWN0IiwiZ2xvYmFsSWQiLCJyZXZpc2lvbiIsImJpbmRCdWZmZXJCYXNlIiwiVFJBTlNGT1JNX0ZFRURCQUNLX0JVRkZFUiIsImJlZ2luVHJhbnNmb3JtRmVlZGJhY2siLCJtb2RlIiwiZ2xGb3JtYXQiLCJieXRlc1BlckluZGV4IiwiZHJhd0VsZW1lbnRzIiwiZmlyc3QiLCJkcmF3QXJyYXlzIiwiZW5kVHJhbnNmb3JtRmVlZGJhY2siLCJfZHJhd0NhbGxzUGVyRnJhbWUiLCJfcHJpbXNQZXJGcmFtZSIsIl9vcHRpb25zJGZsYWdzIiwiZGVmYXVsdE9wdGlvbnMiLCJkZWZhdWx0Q2xlYXJPcHRpb25zIiwiX29wdGlvbnMkY29sb3IiLCJjIiwiX29wdGlvbnMkZGVwdGgiLCJXUklURURFUFRIIiwiX29wdGlvbnMkc3RlbmNpbCIsInN1Ym1pdCIsImZsdXNoIiwicmVhZFBpeGVsc0FzeW5jIiwiX3RoaXMkcmVuZGVyVGFyZ2V0JGNvIiwiX2ltcGwkX2dsRm9ybWF0IiwiX2ltcGwkX2dsUGl4ZWxUeXBlIiwiY2xpZW50V2FpdEFzeW5jIiwiaW50ZXJ2YWxfbXMiLCJzeW5jIiwiZmVuY2VTeW5jIiwiU1lOQ19HUFVfQ09NTUFORFNfQ09NUExFVEUiLCJQcm9taXNlIiwicmVqZWN0IiwidGVzdCIsInJlcyIsImNsaWVudFdhaXRTeW5jIiwiV0FJVF9GQUlMRUQiLCJkZWxldGVTeW5jIiwiVElNRU9VVF9FWFBJUkVEIiwic2V0VGltZW91dCIsIl9nbEZvcm1hdCIsInBpeGVsVHlwZSIsIl9nbFBpeGVsVHlwZSIsImJ1ZiIsImNyZWF0ZUJ1ZmZlciIsIlBJWEVMX1BBQ0tfQlVGRkVSIiwiYnVmZmVyRGF0YSIsImJ5dGVMZW5ndGgiLCJTVFJFQU1fUkVBRCIsImdldEJ1ZmZlclN1YkRhdGEiLCJkZWxldGVCdWZmZXIiLCJzZXRBbHBoYVRvQ292ZXJhZ2UiLCJzdGF0ZSIsInNldFRyYW5zZm9ybUZlZWRiYWNrQnVmZmVyIiwidGYiLCJjcmVhdGVUcmFuc2Zvcm1GZWVkYmFjayIsImJpbmRUcmFuc2Zvcm1GZWVkYmFjayIsIlRSQU5TRk9STV9GRUVEQkFDSyIsInNldFJhc3RlciIsIm9uIiwic2V0RGVwdGhCaWFzIiwic2V0RGVwdGhCaWFzVmFsdWVzIiwiY29uc3RCaWFzIiwic2xvcGVCaWFzIiwicG9seWdvbk9mZnNldCIsInNldFN0ZW5jaWxUZXN0Iiwic2V0U3RlbmNpbEZ1bmMiLCJmdW5jIiwicmVmIiwibWFzayIsInNldFN0ZW5jaWxGdW5jRnJvbnQiLCJzdGVuY2lsRnVuY1NlcGFyYXRlIiwic2V0U3RlbmNpbEZ1bmNCYWNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbiIsImZhaWwiLCJ6ZmFpbCIsInpwYXNzIiwid3JpdGVNYXNrIiwic2V0U3RlbmNpbE9wZXJhdGlvbkZyb250Iiwic3RlbmNpbE9wU2VwYXJhdGUiLCJzdGVuY2lsTWFza1NlcGFyYXRlIiwic2V0U3RlbmNpbE9wZXJhdGlvbkJhY2siLCJibGVuZFN0YXRlIiwiY3VycmVudEJsZW5kU3RhdGUiLCJlcXVhbHMiLCJibGVuZCIsImNvbG9yT3AiLCJhbHBoYU9wIiwiY29sb3JTcmNGYWN0b3IiLCJjb2xvckRzdEZhY3RvciIsImFscGhhU3JjRmFjdG9yIiwiYWxwaGFEc3RGYWN0b3IiLCJibGVuZEVxdWF0aW9uU2VwYXJhdGUiLCJibGVuZEZ1bmNTZXBhcmF0ZSIsImFsbFdyaXRlIiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsImNvcHkiLCJzZXRCbGVuZENvbG9yIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJyZWFkTWFzayIsIl9zdGVuY2lsRnJvbnQiLCJfc3RlbmNpbEJhY2siLCJTdGVuY2lsUGFyYW1ldGVycyIsIkRFRkFVTFQiLCJkZXB0aFN0YXRlIiwiY3VycmVudERlcHRoU3RhdGUiLCJ3cml0ZSIsImN1bGxNb2RlIiwiZmFpbGVkIiwicmVhZHkiLCJmaW5hbGl6ZSIsInVzZVByb2dyYW0iLCJnbFByb2dyYW0iLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsImF0dHJpYnV0ZXNJbnZhbGlkYXRlZCIsImdldEhkckZvcm1hdCIsInByZWZlckxhcmdlc3QiLCJyZW5kZXJhYmxlIiwidXBkYXRhYmxlIiwiZmlsdGVyYWJsZSIsImYxNlZhbGlkIiwiZjMyVmFsaWQiLCJmb3JFYWNoIiwiaXRlbSIsIm1hcE9iaiIsInJlc2l6ZUNhbnZhcyIsIl93aWR0aCIsIl9oZWlnaHQiLCJyYXRpbyIsIl9tYXhQaXhlbFJhdGlvIiwiZGV2aWNlUGl4ZWxSYXRpbyIsIkVWRU5UX1JFU0laRSIsImRyYXdpbmdCdWZmZXJXaWR0aCIsImRyYXdpbmdCdWZmZXJIZWlnaHQiLCJmdWxsc2NyZWVuIiwicmVxdWVzdEZ1bGxzY3JlZW4iLCJkb2N1bWVudCIsImV4aXRGdWxsc2NyZWVuIiwiZnVsbHNjcmVlbkVsZW1lbnQiLCJ0ZXh0dXJlRmxvYXRIaWdoUHJlY2lzaW9uIiwiZGVidWdMb3NlQ29udGV4dCIsInNsZWVwIiwiY29udGV4dCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBMENBLE1B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
