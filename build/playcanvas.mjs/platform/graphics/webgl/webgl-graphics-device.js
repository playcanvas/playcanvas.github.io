import { setupVertexArrayObject } from '../../../polyfill/OESVertexArrayObject.js';
import '../../../core/tracing.js';
import { platform } from '../../../core/platform.js';
import { Color } from '../../../core/math/color.js';
import { DEVICETYPE_WEBGL2, DEVICETYPE_WEBGL1, PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, UNIFORMTYPE_BOOL, UNIFORMTYPE_INT, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4ARRAY, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, CULLFACE_BACK, FUNC_ALWAYS, STENCILOP_KEEP, ADDRESS_CLAMP_TO_EDGE, semanticToLocation, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_NONE, PRIMITIVE_TRISTRIP, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR } from '../constants.js';
import { GraphicsDevice } from '../graphics-device.js';
import { RenderTarget } from '../render-target.js';
import { Texture } from '../texture.js';
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
function quadWithShader(device, target, shader) {
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
}
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
		this.defaultFramebuffer = null;
		this.updateClientRect();
		this.contextLost = false;
		this._contextLostHandler = event => {
			event.preventDefault();
			this.contextLost = true;
			this.loseContext();
			this.fire('devicelost');
		};
		this._contextRestoredHandler = () => {
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
		}
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
		this.supportsDepthShadow = this.webgl2;
		this._textureFloatHighPrecision = undefined;
		this._textureHalfFloatUpdatable = undefined;
		this.areaLightLutFormat = PIXELFORMAT_RGBA8;
		if (this.extTextureHalfFloat && this.textureHalfFloatUpdatable && this.extTextureHalfFloatLinear) {
			this.areaLightLutFormat = PIXELFORMAT_RGBA16F;
		} else if (this.extTextureFloat && this.extTextureFloatLinear) {
			this.areaLightLutFormat = PIXELFORMAT_RGBA32F;
		}
		this.postInit();
	}
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
				} else {
					precision = "lowp";
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
		if (!this._extDisjointTimerQuery) {
			if (this.webgl2) {
				this._extDisjointTimerQuery = this.getExtension('EXT_disjoint_timer_query_webgl2', 'EXT_disjoint_timer_query');
			}
		}
		return this._extDisjointTimerQuery;
	}
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
		this.extColorBufferHalfFloat = this.getExtension("EXT_color_buffer_half_float");
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
		super.initializeRenderState();
		const gl = this.gl;
		gl.disable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ZERO);
		gl.blendEquation(gl.FUNC_ADD);
		gl.colorMask(true, true, true, true);
		this.blendColor = new Color(0, 0, 0, 0);
		gl.blendColor(0, 0, 0, 0);
		this.cullMode = CULLFACE_BACK;
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);
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
	endShaderBatch() {
		WebglShader.endShaderBatch(this);
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
			return false;
		}
		if (color) {
			if (!dest) {
				if (!source._colorBuffer) {
					return false;
				}
			} else if (source) {
				if (!source._colorBuffer || !dest._colorBuffer) {
					return false;
				}
				if (source._colorBuffer._format !== dest._colorBuffer._format) {
					return false;
				}
			}
		}
		if (depth && source) {
			if (!source._depth) {
				if (!source._depthBuffer || !dest._depthBuffer) {
					return false;
				}
				if (source._depthBuffer._format !== dest._depthBuffer._format) {
					return false;
				}
			}
		}
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
		this.insideRenderPass = true;
	}
	endPass(renderPass) {
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
	}
	updateBegin() {
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
	}
	updateEnd() {
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
				key += vertexBuffer.id + vertexBuffer.format.renderingHash;
			}
			vao = this._vaoMap.get(key);
		}
		if (!vao) {
			const gl = this.gl;
			vao = gl.createVertexArray();
			gl.bindVertexArray(vao);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
			for (let i = 0; i < vertexBuffers.length; i++) {
				const vertexBuffer = vertexBuffers[i];
				gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer.impl.bufferId);
				const elements = vertexBuffer.format.elements;
				for (let j = 0; j < elements.length; j++) {
					const e = elements[j];
					const loc = semanticToLocation[e.name];
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
				return;
			}
			if (samplerValue instanceof Texture) {
				texture = samplerValue;
				this.setTexture(texture, textureUnit);
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
	}
	clear(options) {
		var _options$flags;
		const defaultOptions = this.defaultClearOptions;
		options = options || defaultOptions;
		const flags = (_options$flags = options.flags) != null ? _options$flags : defaultOptions.flags;
		if (flags !== 0) {
			const gl = this.gl;
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
				const depth = (_options$depth = options.depth) != null ? _options$depth : defaultOptions.depth;
				if (depth !== this.clearDepth) {
					this.gl.clearDepth(depth);
					this.clearDepth = depth;
				}
				this.setDepthState(DepthState.WRITEDEPTH);
			}
			if (flags & CLEARFLAG_STENCIL) {
				var _options$stencil;
				const stencil = (_options$stencil = options.stencil) != null ? _options$stencil : defaultOptions.stencil;
				if (stencil !== this.clearStencil) {
					this.gl.clearStencil(stencil);
					this.clearStencil = stencil;
				}
			}
			gl.clear(this.glClearFlag[flags]);
		}
	}
	readPixels(x, y, w, h, pixels) {
		const gl = this.gl;
		gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
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
	setBlendState(blendState) {
		const currentBlendState = this.blendState;
		if (!currentBlendState.equals(blendState)) {
			const gl = this.gl;
			const {
				blend,
				colorOp,
				alphaOp,
				colorSrcFactor,
				colorDstFactor,
				alphaSrcFactor,
				alphaDstFactor
			} = blendState;
			if (currentBlendState.blend !== blend) {
				if (blend) {
					gl.enable(gl.BLEND);
				} else {
					gl.disable(gl.BLEND);
				}
			}
			if (currentBlendState.colorOp !== colorOp || currentBlendState.alphaOp !== alphaOp) {
				const glBlendEquation = this.glBlendEquation;
				gl.blendEquationSeparate(glBlendEquation[colorOp], glBlendEquation[alphaOp]);
			}
			if (currentBlendState.colorSrcFactor !== colorSrcFactor || currentBlendState.colorDstFactor !== colorDstFactor || currentBlendState.alphaSrcFactor !== alphaSrcFactor || currentBlendState.alphaDstFactor !== alphaDstFactor) {
				gl.blendFuncSeparate(this.glBlendFunctionColor[colorSrcFactor], this.glBlendFunctionColor[colorDstFactor], this.glBlendFunctionAlpha[alphaSrcFactor], this.glBlendFunctionAlpha[alphaDstFactor]);
			}
			if (currentBlendState.allWrite !== blendState.allWrite) {
				this.gl.colorMask(blendState.redWrite, blendState.greenWrite, blendState.blueWrite, blendState.alphaWrite);
			}
			currentBlendState.copy(blendState);
		}
	}
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
			const write = depthState.write;
			if (currentDepthState.write !== write) {
				gl.depthMask(write);
			}
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
	getCullMode() {
		return this.cullMode;
	}
	setShader(shader) {
		if (shader !== this.shader) {
			if (shader.failed) {
				return false;
			} else if (!shader.ready && !shader.impl.finalize(this, shader)) {
				shader.failed = true;
				return false;
			}
			this.shader = shader;
			this.gl.useProgram(shader.impl.glProgram);
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
