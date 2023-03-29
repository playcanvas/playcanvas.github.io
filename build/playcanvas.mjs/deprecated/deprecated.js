import { version, revision } from '../core/core.js';
import { string } from '../core/string.js';
import { now } from '../core/time.js';
import '../core/tracing.js';
import { math } from '../core/math/math.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { BoundingBox } from '../core/shape/bounding-box.js';
import { BoundingSphere } from '../core/shape/bounding-sphere.js';
import { Frustum } from '../core/shape/frustum.js';
import { Plane } from '../core/shape/plane.js';
import { TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, BLENDMODE_CONSTANT, BLENDMODE_ONE_MINUS_CONSTANT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BLENDMODE_ZERO, BLENDMODE_ONE, BLENDMODE_SRC_COLOR, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_ALPHA, BUFFER_STATIC, BUFFER_DYNAMIC, BUFFER_STREAM, CULLFACE_NONE, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_COLOR, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTURETYPE_RGBM, TEXTURETYPE_DEFAULT, TEXTURETYPE_SWIZZLEGGGR } from '../platform/graphics/constants.js';
import { begin, end, fogCode, gammaCode, skinCode, tonemapCode } from '../scene/shader-lib/programs/common.js';
import { drawQuadWithShader } from '../scene/graphics/quad-render-utils.js';
import { shaderChunks } from '../scene/shader-lib/chunks/chunks.js';
import { GraphicsDevice } from '../platform/graphics/graphics-device.js';
import { IndexBuffer } from '../platform/graphics/index-buffer.js';
import { PostEffect } from '../scene/graphics/post-effect.js';
import { PostEffectQueue } from '../framework/components/camera/post-effect-queue.js';
import { ProgramLibrary } from '../scene/shader-lib/program-library.js';
import { getProgramLibrary, setProgramLibrary } from '../scene/shader-lib/get-program-library.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { ScopeId } from '../platform/graphics/scope-id.js';
import { Shader } from '../platform/graphics/shader.js';
import { WebglShaderInput } from '../platform/graphics/webgl/webgl-shader-input.js';
import { Texture } from '../platform/graphics/texture.js';
import { VertexBuffer } from '../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../platform/graphics/vertex-format.js';
import { VertexIterator } from '../platform/graphics/vertex-iterator.js';
import { ShaderUtils } from '../platform/graphics/shader-utils.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { BlendState } from '../platform/graphics/blend-state.js';
import { DepthState } from '../platform/graphics/depth-state.js';
import { LAYERID_WORLD, LAYERID_IMMEDIATE, LINEBATCH_OVERLAY, PROJECTION_ORTHOGRAPHIC, PROJECTION_PERSPECTIVE } from '../scene/constants.js';
import { calculateTangents, createMesh, createTorus, createCylinder, createCapsule, createCone, createSphere, createPlane, createBox } from '../scene/procedural.js';
import { partitionSkin } from '../scene/skin-partition.js';
import { BasicMaterial } from '../scene/materials/basic-material.js';
import { ForwardRenderer } from '../scene/renderer/forward-renderer.js';
import { GraphNode } from '../scene/graph-node.js';
import { Material } from '../scene/materials/material.js';
import { Mesh } from '../scene/mesh.js';
import { Morph } from '../scene/morph.js';
import { Command, MeshInstance } from '../scene/mesh-instance.js';
import { Model } from '../scene/model.js';
import { ParticleEmitter } from '../scene/particle-system/particle-emitter.js';
import { Picker } from '../framework/graphics/picker.js';
import { Scene } from '../scene/scene.js';
import { Skin } from '../scene/skin.js';
import { SkinInstance } from '../scene/skin-instance.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { Batch } from '../scene/batching/batch.js';
import { getDefaultMaterial } from '../scene/materials/default-material.js';
import { StandardMaterialOptions } from '../scene/materials/standard-material-options.js';
import { LitOptions } from '../scene/materials/lit-options.js';
import { Layer } from '../scene/layer.js';
import { Animation, Key, Node } from '../scene/animation/animation.js';
import { Skeleton } from '../scene/animation/skeleton.js';
import { Channel } from '../platform/audio/channel.js';
import { Channel3d } from '../platform/audio/channel3d.js';
import { Listener } from '../platform/sound/listener.js';
import { Sound } from '../platform/sound/sound.js';
import { SoundManager } from '../platform/sound/manager.js';
import { AssetRegistry } from '../framework/asset/asset-registry.js';
import { XrInputSource } from '../framework/xr/xr-input-source.js';
import { Controller } from '../platform/input/controller.js';
import { ElementInput } from '../framework/input/element-input.js';
import { GamePads } from '../platform/input/game-pads.js';
import { Keyboard } from '../platform/input/keyboard.js';
import { KeyboardEvent } from '../platform/input/keyboard-event.js';
import { Mouse } from '../platform/input/mouse.js';
import { MouseEvent } from '../platform/input/mouse-event.js';
import { TouchDevice } from '../platform/input/touch-device.js';
import { getTouchTargetCoords, Touch, TouchEvent } from '../platform/input/touch-event.js';
import { AppBase } from '../framework/app-base.js';
import { getApplication } from '../framework/globals.js';
import { CameraComponent } from '../framework/components/camera/component.js';
import { LightComponent } from '../framework/components/light/component.js';
import { ModelComponent } from '../framework/components/model/component.js';
import { RenderComponent } from '../framework/components/render/component.js';
import { BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYFLAG_STATIC_OBJECT, BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT, BODYSTATE_ACTIVE_TAG, BODYSTATE_ISLAND_SLEEPING, BODYSTATE_WANTS_DEACTIVATION, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION } from '../framework/components/rigid-body/constants.js';
import { RigidBodyComponent } from '../framework/components/rigid-body/component.js';
import { RigidBodyComponentSystem } from '../framework/components/rigid-body/system.js';
import { basisInitialize } from '../framework/handlers/basis.js';

const log = {
	write: function (text) {
		console.log(text);
	},
	open: function () {
		log.write('Powered by PlayCanvas ' + version + ' ' + revision);
	},
	info: function (text) {
		console.info('INFO:    ' + text);
	},
	debug: function (text) {
		console.debug('DEBUG:   ' + text);
	},
	error: function (text) {
		console.error('ERROR:   ' + text);
	},
	warning: function (text) {
		console.warn('WARNING: ' + text);
	},
	alert: function (text) {
		log.write('ALERT:   ' + text);
		alert(text);
	},
	assert: function (condition, text) {
		if (condition === false) {
			log.write('ASSERT:  ' + text);
		}
	}
};
string.endsWith = function (s, subs) {
	return s.endsWith(subs);
};
string.startsWith = function (s, subs) {
	return s.startsWith(subs);
};
class Timer {
	constructor() {
		this._isRunning = false;
		this._a = 0;
		this._b = 0;
	}
	start() {
		this._isRunning = true;
		this._a = now();
	}
	stop() {
		this._isRunning = false;
		this._b = now();
	}
	getMilliseconds() {
		return this._b - this._a;
	}
}
const time = {
	now: now,
	Timer: Timer
};
Object.defineProperty(Color.prototype, 'data', {
	get: function () {
		if (!this._data) {
			this._data = new Float32Array(4);
		}
		this._data[0] = this.r;
		this._data[1] = this.g;
		this._data[2] = this.b;
		this._data[3] = this.a;
		return this._data;
	}
});
Object.defineProperty(Color.prototype, 'data3', {
	get: function () {
		if (!this._data3) {
			this._data3 = new Float32Array(3);
		}
		this._data3[0] = this.r;
		this._data3[1] = this.g;
		this._data3[2] = this.b;
		return this._data3;
	}
});
function inherits(Self, Super) {
	const Temp = function Temp() {};
	const Func = function Func(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
		Super.call(this, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
		Self.call(this, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
	};
	Func._super = Super.prototype;
	Temp.prototype = Super.prototype;
	Func.prototype = new Temp();
	return Func;
}
function makeArray(arr) {
	return Array.prototype.slice.call(arr);
}
function createStyle(cssString) {
	const result = document.createElement('style');
	result.type = 'text/css';
	if (result.styleSheet) {
		result.styleSheet.cssText = cssString;
	} else {
		result.appendChild(document.createTextNode(cssString));
	}
	return result;
}
math.INV_LOG2 = Math.LOG2E;
math.intToBytes = math.intToBytes32;
math.bytesToInt = math.bytesToInt32;
Object.defineProperty(Vec2.prototype, 'data', {
	get: function () {
		if (!this._data) {
			this._data = new Float32Array(2);
		}
		this._data[0] = this.x;
		this._data[1] = this.y;
		return this._data;
	}
});
Vec2.prototype.scale = Vec2.prototype.mulScalar;
Object.defineProperty(Vec3.prototype, 'data', {
	get: function () {
		if (!this._data) {
			this._data = new Float32Array(3);
		}
		this._data[0] = this.x;
		this._data[1] = this.y;
		this._data[2] = this.z;
		return this._data;
	}
});
Vec3.prototype.scale = Vec3.prototype.mulScalar;
Object.defineProperty(Vec4.prototype, 'data', {
	get: function () {
		if (!this._data) {
			this._data = new Float32Array(4);
		}
		this._data[0] = this.x;
		this._data[1] = this.y;
		this._data[2] = this.z;
		this._data[3] = this.w;
		return this._data;
	}
});
Vec4.prototype.scale = Vec4.prototype.mulScalar;
const shape = {
	Aabb: BoundingBox,
	Sphere: BoundingSphere,
	Plane: Plane
};
BoundingSphere.prototype.intersectRay = BoundingSphere.prototype.intersectsRay;
Frustum.prototype.update = function (projectionMatrix, viewMatrix) {
	const viewProj = new Mat4();
	viewProj.mul2(projectionMatrix, viewMatrix);
	this.setFromMat4(viewProj);
};
const ELEMENTTYPE_INT8 = TYPE_INT8;
const ELEMENTTYPE_UINT8 = TYPE_UINT8;
const ELEMENTTYPE_INT16 = TYPE_INT16;
const ELEMENTTYPE_UINT16 = TYPE_UINT16;
const ELEMENTTYPE_INT32 = TYPE_INT32;
const ELEMENTTYPE_UINT32 = TYPE_UINT32;
const ELEMENTTYPE_FLOAT32 = TYPE_FLOAT32;
const PIXELFORMAT_L8_A8 = PIXELFORMAT_LA8;
const PIXELFORMAT_R5_G6_B5 = PIXELFORMAT_RGB565;
const PIXELFORMAT_R5_G5_B5_A1 = PIXELFORMAT_RGBA5551;
const PIXELFORMAT_R4_G4_B4_A4 = PIXELFORMAT_RGBA4;
const PIXELFORMAT_R8_G8_B8 = PIXELFORMAT_RGB8;
const PIXELFORMAT_R8_G8_B8_A8 = PIXELFORMAT_RGBA8;
const BLENDMODE_CONSTANT_COLOR = BLENDMODE_CONSTANT;
const BLENDMODE_ONE_MINUS_CONSTANT_COLOR = BLENDMODE_ONE_MINUS_CONSTANT;
const BLENDMODE_CONSTANT_ALPHA = BLENDMODE_CONSTANT;
const BLENDMODE_ONE_MINUS_CONSTANT_ALPHA = BLENDMODE_ONE_MINUS_CONSTANT;
function UnsupportedBrowserError(message) {
	this.name = 'UnsupportedBrowserError';
	this.message = message || '';
}
UnsupportedBrowserError.prototype = Error.prototype;
function ContextCreationError(message) {
	this.name = 'ContextCreationError';
	this.message = message || '';
}
ContextCreationError.prototype = Error.prototype;
const programlib = {
	begin: begin,
	dummyFragmentCode: ShaderUtils.dummyFragmentCode,
	end: end,
	fogCode: fogCode,
	gammaCode: gammaCode,
	precisionCode: ShaderUtils.precisionCode,
	skinCode: skinCode,
	tonemapCode: tonemapCode,
	versionCode: ShaderUtils.versionCode
};
const gfx = {
	ADDRESS_CLAMP_TO_EDGE: ADDRESS_CLAMP_TO_EDGE,
	ADDRESS_MIRRORED_REPEAT: ADDRESS_MIRRORED_REPEAT,
	ADDRESS_REPEAT: ADDRESS_REPEAT,
	BLENDMODE_ZERO: BLENDMODE_ZERO,
	BLENDMODE_ONE: BLENDMODE_ONE,
	BLENDMODE_SRC_COLOR: BLENDMODE_SRC_COLOR,
	BLENDMODE_ONE_MINUS_SRC_COLOR: BLENDMODE_ONE_MINUS_SRC_COLOR,
	BLENDMODE_DST_COLOR: BLENDMODE_DST_COLOR,
	BLENDMODE_ONE_MINUS_DST_COLOR: BLENDMODE_ONE_MINUS_DST_COLOR,
	BLENDMODE_SRC_ALPHA: BLENDMODE_SRC_ALPHA,
	BLENDMODE_SRC_ALPHA_SATURATE: BLENDMODE_SRC_ALPHA_SATURATE,
	BLENDMODE_ONE_MINUS_SRC_ALPHA: BLENDMODE_ONE_MINUS_SRC_ALPHA,
	BLENDMODE_DST_ALPHA: BLENDMODE_DST_ALPHA,
	BLENDMODE_ONE_MINUS_DST_ALPHA: BLENDMODE_ONE_MINUS_DST_ALPHA,
	BUFFER_STATIC: BUFFER_STATIC,
	BUFFER_DYNAMIC: BUFFER_DYNAMIC,
	BUFFER_STREAM: BUFFER_STREAM,
	CULLFACE_NONE: CULLFACE_NONE,
	CULLFACE_BACK: CULLFACE_BACK,
	CULLFACE_FRONT: CULLFACE_FRONT,
	CULLFACE_FRONTANDBACK: CULLFACE_FRONTANDBACK,
	ELEMENTTYPE_INT8: TYPE_INT8,
	ELEMENTTYPE_UINT8: TYPE_UINT8,
	ELEMENTTYPE_INT16: TYPE_INT16,
	ELEMENTTYPE_UINT16: TYPE_UINT16,
	ELEMENTTYPE_INT32: TYPE_INT32,
	ELEMENTTYPE_UINT32: TYPE_UINT32,
	ELEMENTTYPE_FLOAT32: TYPE_FLOAT32,
	FILTER_NEAREST: FILTER_NEAREST,
	FILTER_LINEAR: FILTER_LINEAR,
	FILTER_NEAREST_MIPMAP_NEAREST: FILTER_NEAREST_MIPMAP_NEAREST,
	FILTER_NEAREST_MIPMAP_LINEAR: FILTER_NEAREST_MIPMAP_LINEAR,
	FILTER_LINEAR_MIPMAP_NEAREST: FILTER_LINEAR_MIPMAP_NEAREST,
	FILTER_LINEAR_MIPMAP_LINEAR: FILTER_LINEAR_MIPMAP_LINEAR,
	INDEXFORMAT_UINT8: INDEXFORMAT_UINT8,
	INDEXFORMAT_UINT16: INDEXFORMAT_UINT16,
	INDEXFORMAT_UINT32: INDEXFORMAT_UINT32,
	PIXELFORMAT_RGB565: PIXELFORMAT_RGB565,
	PIXELFORMAT_RGB8: PIXELFORMAT_RGB8,
	PIXELFORMAT_RGBA8: PIXELFORMAT_RGBA8,
	PRIMITIVE_POINTS: PRIMITIVE_POINTS,
	PRIMITIVE_LINES: PRIMITIVE_LINES,
	PRIMITIVE_LINELOOP: PRIMITIVE_LINELOOP,
	PRIMITIVE_LINESTRIP: PRIMITIVE_LINESTRIP,
	PRIMITIVE_TRIANGLES: PRIMITIVE_TRIANGLES,
	PRIMITIVE_TRISTRIP: PRIMITIVE_TRISTRIP,
	PRIMITIVE_TRIFAN: PRIMITIVE_TRIFAN,
	SEMANTIC_POSITION: SEMANTIC_POSITION,
	SEMANTIC_NORMAL: SEMANTIC_NORMAL,
	SEMANTIC_COLOR: SEMANTIC_COLOR,
	SEMANTIC_TEXCOORD: SEMANTIC_TEXCOORD,
	SEMANTIC_TEXCOORD0: SEMANTIC_TEXCOORD0,
	SEMANTIC_TEXCOORD1: SEMANTIC_TEXCOORD1,
	SEMANTIC_ATTR0: SEMANTIC_ATTR0,
	SEMANTIC_ATTR1: SEMANTIC_ATTR1,
	SEMANTIC_ATTR2: SEMANTIC_ATTR2,
	SEMANTIC_ATTR3: SEMANTIC_ATTR3,
	TEXTURELOCK_READ: TEXTURELOCK_READ,
	TEXTURELOCK_WRITE: TEXTURELOCK_WRITE,
	drawQuadWithShader: drawQuadWithShader,
	programlib: programlib,
	shaderChunks: shaderChunks,
	ContextCreationError: ContextCreationError,
	Device: GraphicsDevice,
	IndexBuffer: IndexBuffer,
	ProgramLibrary: ProgramLibrary,
	RenderTarget: RenderTarget,
	ScopeId: ScopeId,
	Shader: Shader,
	ShaderInput: WebglShaderInput,
	Texture: Texture,
	UnsupportedBrowserError: UnsupportedBrowserError,
	VertexBuffer: VertexBuffer,
	VertexFormat: VertexFormat,
	VertexIterator: VertexIterator
};
const _viewport = new Vec4();
function drawFullscreenQuad(device, target, vertexBuffer, shader, rect) {
	let viewport;
	if (rect) {
		const w = target ? target.width : device.width;
		const h = target ? target.height : device.height;
		viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
	}
	drawQuadWithShader(device, target, shader, viewport);
}
const posteffect = {
	createFullscreenQuad: device => {
		return device.quadVertexBuffer;
	},
	drawFullscreenQuad: drawFullscreenQuad,
	PostEffect: PostEffect,
	PostEffectQueue: PostEffectQueue
};
Object.defineProperty(shaderChunks, 'transformSkinnedVS', {
	get: function () {
		return '#define SKIN\n' + shaderChunks.transformVS;
	}
});
const deprecatedChunks = {
	'ambientPrefilteredCube.frag': 'ambientEnv.frag',
	'ambientPrefilteredCubeLod.frag': 'ambientEnv.frag',
	'dpAtlasQuad.frag': null,
	'genParaboloid.frag': null,
	'prefilterCubemap.frag': null,
	'reflectionDpAtlas.frag': 'reflectionEnv.frag',
	'reflectionPrefilteredCube.frag': 'reflectionEnv.frag',
	'reflectionPrefilteredCubeLod.frag': 'reflectionEnv.frag'
};
Object.keys(deprecatedChunks).forEach(chunkName => {
	deprecatedChunks[chunkName];
	Object.defineProperty(shaderChunks, chunkName, {
		get: function () {
			return null;
		},
		set: function () {}
	});
});
Object.defineProperties(RenderTarget.prototype, {
	_glFrameBuffer: {
		get: function () {
			return this.impl._glFrameBuffer;
		},
		set: function (rgbm) {}
	}
});
Object.defineProperty(VertexFormat, 'defaultInstancingFormat', {
	get: function () {
		return VertexFormat.getDefaultInstancingFormat(GraphicsDeviceAccess.get());
	}
});
Object.defineProperties(Texture.prototype, {
	rgbm: {
		get: function () {
			return this.type === TEXTURETYPE_RGBM;
		},
		set: function (rgbm) {
			this.type = rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
		}
	},
	swizzleGGGR: {
		get: function () {
			return this.type === TEXTURETYPE_SWIZZLEGGGR;
		},
		set: function (swizzleGGGR) {
			this.type = swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
		}
	},
	_glTexture: {
		get: function () {
			return this.impl._glTexture;
		}
	}
});
GraphicsDevice.prototype.getProgramLibrary = function () {
	return getProgramLibrary(this);
};
GraphicsDevice.prototype.setProgramLibrary = function (lib) {
	setProgramLibrary(this, lib);
};
GraphicsDevice.prototype.removeShaderFromCache = function (shader) {
	getProgramLibrary(this).removeFromCache(shader);
};
const _tempBlendState = new BlendState();
const _tempDepthState = new DepthState();
GraphicsDevice.prototype.setBlendFunction = function (blendSrc, blendDst) {
	const currentBlendState = this.blendState;
	_tempBlendState.copy(currentBlendState);
	_tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
	_tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrc, blendDst);
	this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendFunctionSeparate = function (blendSrc, blendDst, blendSrcAlpha, blendDstAlpha) {
	const currentBlendState = this.blendState;
	_tempBlendState.copy(currentBlendState);
	_tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
	_tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrcAlpha, blendDstAlpha);
	this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendEquation = function (blendEquation) {
	const currentBlendState = this.blendState;
	_tempBlendState.copy(currentBlendState);
	_tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
	_tempBlendState.setAlphaBlend(blendEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
	this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendEquationSeparate = function (blendEquation, blendAlphaEquation) {
	const currentBlendState = this.blendState;
	_tempBlendState.copy(currentBlendState);
	_tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
	_tempBlendState.setAlphaBlend(blendAlphaEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
	this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setColorWrite = function (redWrite, greenWrite, blueWrite, alphaWrite) {
	const currentBlendState = this.blendState;
	_tempBlendState.copy(currentBlendState);
	_tempBlendState.setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite);
	this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.getBlending = function () {
	return this.blendState.blend;
};
GraphicsDevice.prototype.setBlending = function (blending) {
	_tempBlendState.copy(this.blendState);
	_tempBlendState.blend = blending;
	this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setDepthWrite = function (write) {
	_tempDepthState.copy(this.depthState);
	_tempDepthState.write = write;
	this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.setDepthFunc = function (func) {
	_tempDepthState.copy(this.depthState);
	_tempDepthState.func = func;
	this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.setDepthTest = function (test) {
	_tempDepthState.copy(this.depthState);
	_tempDepthState.test = test;
	this.setDepthState(_tempDepthState);
};
const PhongMaterial = StandardMaterial;
const scene = {
	partitionSkin: partitionSkin,
	procedural: {
		calculateTangents: calculateTangents,
		createMesh: createMesh,
		createTorus: createTorus,
		createCylinder: createCylinder,
		createCapsule: createCapsule,
		createCone: createCone,
		createSphere: createSphere,
		createPlane: createPlane,
		createBox: createBox
	},
	BasicMaterial: BasicMaterial,
	Command: Command,
	ForwardRenderer: ForwardRenderer,
	GraphNode: GraphNode,
	Material: Material,
	Mesh: Mesh,
	MeshInstance: MeshInstance,
	Model: Model,
	ParticleEmitter: ParticleEmitter,
	PhongMaterial: StandardMaterial,
	Picker: Picker,
	Projection: {
		ORTHOGRAPHIC: PROJECTION_ORTHOGRAPHIC,
		PERSPECTIVE: PROJECTION_PERSPECTIVE
	},
	Scene: Scene,
	Skin: Skin,
	SkinInstance: SkinInstance
};
Object.defineProperty(Scene.prototype, 'defaultMaterial', {
	get: function () {
		return getDefaultMaterial(getApplication().graphicsDevice);
	}
});
['128', '64', '32', '16', '8', '4'].forEach((size, index) => {
	Object.defineProperty(Scene.prototype, `skyboxPrefiltered${size}`, {
		get: function () {
			return this._prefilteredCubemaps[index];
		},
		set: function (value) {
			this._prefilteredCubemaps[index] = value;
			this.updateShaders = true;
		}
	});
});
Object.defineProperty(Scene.prototype, 'models', {
	get: function () {
		if (!this._models) {
			this._models = [];
		}
		return this._models;
	}
});
Object.defineProperty(Layer.prototype, 'renderTarget', {
	set: function (rt) {
		this._renderTarget = rt;
		this._dirtyCameras = true;
	},
	get: function () {
		return this._renderTarget;
	}
});
Scene.prototype._updateSkybox = function (device) {
	this._updateSky(device);
};
Scene.prototype.addModel = function (model) {
	if (this.containsModel(model)) return;
	const layer = this.layers.getLayerById(LAYERID_WORLD);
	if (!layer) return;
	layer.addMeshInstances(model.meshInstances);
	this.models.push(model);
};
Scene.prototype.addShadowCaster = function (model) {
	const layer = this.layers.getLayerById(LAYERID_WORLD);
	if (!layer) return;
	layer.addShadowCasters(model.meshInstances);
};
Scene.prototype.removeModel = function (model) {
	const index = this.models.indexOf(model);
	if (index !== -1) {
		const layer = this.layers.getLayerById(LAYERID_WORLD);
		if (!layer) return;
		layer.removeMeshInstances(model.meshInstances);
		this.models.splice(index, 1);
	}
};
Scene.prototype.removeShadowCasters = function (model) {
	const layer = this.layers.getLayerById(LAYERID_WORLD);
	if (!layer) return;
	layer.removeShadowCasters(model.meshInstances);
};
Scene.prototype.containsModel = function (model) {
	return this.models.indexOf(model) >= 0;
};
Scene.prototype.getModels = function (model) {
	return this.models;
};
Object.defineProperty(Batch.prototype, 'model', {
	get: function () {
		return null;
	}
});
ForwardRenderer.prototype.renderComposition = function (comp) {
	getApplication().renderComposition(comp);
};
ForwardRenderer.prototype.updateShader = function (meshInstance, objDefs, staticLightList, pass, sortedLights) {
	const scene = meshInstance.material._scene || getApplication().scene;
	return meshInstance.updatePassShader(scene, pass, staticLightList, sortedLights);
};
MeshInstance.prototype.syncAabb = function () {};
Morph.prototype.getTarget = function (index) {
	return this.targets[index];
};
GraphNode.prototype._dirtify = function (local) {
	if (local) this._dirtifyLocal();else this._dirtifyWorld();
};
GraphNode.prototype.addLabel = function (label) {
	this._labels[label] = true;
};
GraphNode.prototype.getLabels = function () {
	return Object.keys(this._labels);
};
GraphNode.prototype.hasLabel = function (label) {
	return !!this._labels[label];
};
GraphNode.prototype.removeLabel = function (label) {
	delete this._labels[label];
};
GraphNode.prototype.findByLabel = function (label, results = []) {
	if (this.hasLabel(label)) {
		results.push(this);
	}
	for (let i = 0; i < this._children.length; ++i) {
		results = this._children[i].findByLabel(label, results);
	}
	return results;
};
GraphNode.prototype.getChildren = function () {
	return this.children;
};
GraphNode.prototype.getName = function () {
	return this.name;
};
GraphNode.prototype.getPath = function () {
	return this.path;
};
GraphNode.prototype.getRoot = function () {
	return this.root;
};
GraphNode.prototype.getParent = function () {
	return this.parent;
};
GraphNode.prototype.setName = function (name) {
	this.name = name;
};
Material.prototype.getName = function () {
	return this.name;
};
Material.prototype.setName = function (name) {
	this.name = name;
};
Material.prototype.getShader = function () {
	return this.shader;
};
Material.prototype.setShader = function (shader) {
	this.shader = shader;
};
Object.defineProperty(Material.prototype, 'blend', {
	set: function (value) {
		this.blendState.blend = value;
	},
	get: function () {
		return this.blendState.blend;
	}
});
Object.defineProperty(Material.prototype, 'blendSrc', {
	set: function (value) {
		const currentBlendState = this.blendState;
		_tempBlendState.copy(currentBlendState);
		_tempBlendState.setColorBlend(currentBlendState.colorOp, value, currentBlendState.colorDstFactor);
		_tempBlendState.setAlphaBlend(currentBlendState.alphaOp, value, currentBlendState.alphaDstFactor);
		this.blendState = _tempBlendState;
	},
	get: function () {
		return this.blendState.colorSrcFactor;
	}
});
Object.defineProperty(Material.prototype, 'blendDst', {
	set: function (value) {
		const currentBlendState = this.blendState;
		_tempBlendState.copy(currentBlendState);
		_tempBlendState.setColorBlend(currentBlendState.colorOp, currentBlendState.colorSrcFactor, value);
		_tempBlendState.setAlphaBlend(currentBlendState.alphaOp, currentBlendState.alphaSrcFactor, value);
		this.blendState = _tempBlendState;
	},
	get: function () {
		return this.blendState.colorDstFactor;
	}
});
Object.defineProperty(StandardMaterial.prototype, 'shininess', {
	get: function () {
		return this.gloss * 100;
	},
	set: function (value) {
		this.gloss = value * 0.01;
	}
});
function _defineAlias(newName, oldName) {
	Object.defineProperty(StandardMaterial.prototype, oldName, {
		get: function () {
			return this[newName];
		},
		set: function (value) {
			this[newName] = value;
		}
	});
}
_defineAlias('diffuseTint', 'diffuseMapTint');
_defineAlias('specularTint', 'specularMapTint');
_defineAlias('emissiveTint', 'emissiveMapTint');
_defineAlias('aoVertexColor', 'aoMapVertexColor');
_defineAlias('diffuseVertexColor', 'diffuseMapVertexColor');
_defineAlias('specularVertexColor', 'specularMapVertexColor');
_defineAlias('emissiveVertexColor', 'emissiveMapVertexColor');
_defineAlias('metalnessVertexColor', 'metalnessMapVertexColor');
_defineAlias('glossVertexColor', 'glossMapVertexColor');
_defineAlias('opacityVertexColor', 'opacityMapVertexColor');
_defineAlias('lightVertexColor', 'lightMapVertexColor');
_defineAlias('sheenGloss', 'sheenGlossiess');
_defineAlias('clearCoatGloss', 'clearCostGlossiness');
function _defineOption(name, newName) {
	if (name !== 'chunks' && name !== '_pass') {
		Object.defineProperty(StandardMaterialOptions.prototype, name, {
			get: function () {
				return this.litOptions[newName || name];
			},
			set: function (value) {
				this.litOptions[newName || name] = value;
			}
		});
	}
}
_defineOption('refraction', 'useRefraction');
const tempOptions = new LitOptions();
const litOptionProperties = Object.getOwnPropertyNames(tempOptions);
for (const litOption in litOptionProperties) {
	_defineOption(litOptionProperties[litOption]);
}
const anim = {
	Animation: Animation,
	Key: Key,
	Node: Node,
	Skeleton: Skeleton
};
Animation.prototype.getDuration = function () {
	return this.duration;
};
Animation.prototype.getName = function () {
	return this.name;
};
Animation.prototype.getNodes = function () {
	return this.nodes;
};
Animation.prototype.setDuration = function (duration) {
	this.duration = duration;
};
Animation.prototype.setName = function (name) {
	this.name = name;
};
Skeleton.prototype.getAnimation = function () {
	return this.animation;
};
Skeleton.prototype.getCurrentTime = function () {
	return this.currentTime;
};
Skeleton.prototype.getLooping = function () {
	return this.looping;
};
Skeleton.prototype.getNumNodes = function () {
	return this.numNodes;
};
Skeleton.prototype.setAnimation = function (animation) {
	this.animation = animation;
};
Skeleton.prototype.setCurrentTime = function (time) {
	this.currentTime = time;
};
Skeleton.prototype.setLooping = function (looping) {
	this.looping = looping;
};
const audio = {
	AudioManager: SoundManager,
	Channel: Channel,
	Channel3d: Channel3d,
	Listener: Listener,
	Sound: Sound
};
SoundManager.prototype.getListener = function () {
	return this.listener;
};
SoundManager.prototype.getVolume = function () {
	return this.volume;
};
SoundManager.prototype.setVolume = function (volume) {
	this.volume = volume;
};
const asset = {
	ASSET_ANIMATION: 'animation',
	ASSET_AUDIO: 'audio',
	ASSET_IMAGE: 'image',
	ASSET_JSON: 'json',
	ASSET_MODEL: 'model',
	ASSET_MATERIAL: 'material',
	ASSET_TEXT: 'text',
	ASSET_TEXTURE: 'texture',
	ASSET_CUBEMAP: 'cubemap',
	ASSET_SCRIPT: 'script'
};
AssetRegistry.prototype.getAssetById = function (id) {
	return this.get(id);
};
Object.defineProperty(XrInputSource.prototype, 'ray', {
	get: function () {
		return this._rayLocal;
	}
});
Object.defineProperty(XrInputSource.prototype, 'position', {
	get: function () {
		return this._localPosition;
	}
});
Object.defineProperty(XrInputSource.prototype, 'rotation', {
	get: function () {
		return this._localRotation;
	}
});
const input = {
	getTouchTargetCoords: getTouchTargetCoords,
	Controller: Controller,
	GamePads: GamePads,
	Keyboard: Keyboard,
	KeyboardEvent: KeyboardEvent,
	Mouse: Mouse,
	MouseEvent: MouseEvent,
	Touch: Touch,
	TouchDevice: TouchDevice,
	TouchEvent: TouchEvent
};
Object.defineProperty(ElementInput.prototype, 'wheel', {
	get: function () {
		return this.wheelDelta * -2;
	}
});
Object.defineProperty(MouseEvent.prototype, 'wheel', {
	get: function () {
		return this.wheelDelta * -2;
	}
});
const RIGIDBODY_TYPE_STATIC = BODYTYPE_STATIC;
const RIGIDBODY_TYPE_DYNAMIC = BODYTYPE_DYNAMIC;
const RIGIDBODY_TYPE_KINEMATIC = BODYTYPE_KINEMATIC;
const RIGIDBODY_CF_STATIC_OBJECT = BODYFLAG_STATIC_OBJECT;
const RIGIDBODY_CF_KINEMATIC_OBJECT = BODYFLAG_KINEMATIC_OBJECT;
const RIGIDBODY_CF_NORESPONSE_OBJECT = BODYFLAG_NORESPONSE_OBJECT;
const RIGIDBODY_ACTIVE_TAG = BODYSTATE_ACTIVE_TAG;
const RIGIDBODY_ISLAND_SLEEPING = BODYSTATE_ISLAND_SLEEPING;
const RIGIDBODY_WANTS_DEACTIVATION = BODYSTATE_WANTS_DEACTIVATION;
const RIGIDBODY_DISABLE_DEACTIVATION = BODYSTATE_DISABLE_DEACTIVATION;
const RIGIDBODY_DISABLE_SIMULATION = BODYSTATE_DISABLE_SIMULATION;
AppBase.prototype.isFullscreen = function () {
	return !!document.fullscreenElement;
};
AppBase.prototype.enableFullscreen = function (element, success, error) {
	element = element || this.graphicsDevice.canvas;
	const s = function s() {
		success();
		document.removeEventListener('fullscreenchange', s);
	};
	const e = function e() {
		error();
		document.removeEventListener('fullscreenerror', e);
	};
	if (success) {
		document.addEventListener('fullscreenchange', s, false);
	}
	if (error) {
		document.addEventListener('fullscreenerror', e, false);
	}
	if (element.requestFullscreen) {
		element.requestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
	} else {
		error();
	}
};
AppBase.prototype.disableFullscreen = function (success) {
	const s = function s() {
		success();
		document.removeEventListener('fullscreenchange', s);
	};
	if (success) {
		document.addEventListener('fullscreenchange', s, false);
	}
	document.exitFullscreen();
};
AppBase.prototype.getSceneUrl = function (name) {
	const entry = this.scenes.find(name);
	if (entry) {
		return entry.url;
	}
	return null;
};
AppBase.prototype.loadScene = function (url, callback) {
	this.scenes.loadScene(url, callback);
};
AppBase.prototype.loadSceneHierarchy = function (url, callback) {
	this.scenes.loadSceneHierarchy(url, callback);
};
AppBase.prototype.loadSceneSettings = function (url, callback) {
	this.scenes.loadSceneSettings(url, callback);
};
AppBase.prototype.renderMeshInstance = function (meshInstance, options) {
	const layer = options != null && options.layer ? options.layer : this.scene.defaultDrawLayer;
	this.scene.immediate.drawMesh(null, null, null, meshInstance, layer);
};
AppBase.prototype.renderMesh = function (mesh, material, matrix, options) {
	const layer = options != null && options.layer ? options.layer : this.scene.defaultDrawLayer;
	this.scene.immediate.drawMesh(material, matrix, mesh, null, layer);
};
AppBase.prototype._addLines = function (positions, colors, options) {
	const layer = options && options.layer ? options.layer : this.scene.layers.getLayerById(LAYERID_IMMEDIATE);
	const depthTest = options && options.depthTest !== undefined ? options.depthTest : true;
	const batch = this.scene.immediate.getBatch(layer, depthTest);
	batch.addLines(positions, colors);
};
AppBase.prototype.renderLine = function (start, end, color) {
	let endColor = color;
	let options;
	const arg3 = arguments[3];
	const arg4 = arguments[4];
	if (arg3 instanceof Color) {
		endColor = arg3;
		if (typeof arg4 === 'number') {
			if (arg4 === LINEBATCH_OVERLAY) {
				options = {
					layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
					depthTest: false
				};
			} else {
				options = {
					layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
					depthTest: true
				};
			}
		} else {
			options = arg4;
		}
	} else if (typeof arg3 === 'number') {
		endColor = color;
		if (arg3 === LINEBATCH_OVERLAY) {
			options = {
				layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
				depthTest: false
			};
		} else {
			options = {
				layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
				depthTest: true
			};
		}
	} else if (arg3) {
		options = arg3;
	}
	this._addLines([start, end], [color, endColor], options);
};
AppBase.prototype.renderLines = function (position, color, options) {
	if (!options) {
		options = {
			layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
			depthTest: true
		};
	} else if (typeof options === 'number') {
		if (options === LINEBATCH_OVERLAY) {
			options = {
				layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
				depthTest: false
			};
		} else {
			options = {
				layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
				depthTest: true
			};
		}
	}
	const multiColor = !!color.length;
	if (multiColor) {
		if (position.length !== color.length) {
			console.error('renderLines: position/color arrays have different lengths');
			return;
		}
	}
	if (position.length % 2 !== 0) {
		console.error('renderLines: array length is not divisible by 2');
		return;
	}
	this._addLines(position, color, options);
};
AppBase.prototype.enableVr = function () {};
Object.defineProperty(CameraComponent.prototype, 'node', {
	get: function () {
		return this.entity;
	}
});
Object.defineProperty(LightComponent.prototype, 'enable', {
	get: function () {
		return this.enabled;
	},
	set: function (value) {
		this.enabled = value;
	}
});
ModelComponent.prototype.setVisible = function (visible) {
	this.enabled = visible;
};
Object.defineProperty(ModelComponent.prototype, 'aabb', {
	get: function () {
		return null;
	},
	set: function (type) {}
});
Object.defineProperty(RenderComponent.prototype, 'aabb', {
	get: function () {
		return null;
	},
	set: function (type) {}
});
Object.defineProperty(RigidBodyComponent.prototype, 'bodyType', {
	get: function () {
		return this.type;
	},
	set: function (type) {
		this.type = type;
	}
});
RigidBodyComponent.prototype.syncBodyToEntity = function () {
	this._updateDynamic();
};
RigidBodyComponentSystem.prototype.setGravity = function () {
	if (arguments.length === 1) {
		this.gravity.copy(arguments[0]);
	} else {
		this.gravity.set(arguments[0], arguments[1], arguments[2]);
	}
};
function basisSetDownloadConfig(glueUrl, wasmUrl, fallbackUrl) {
	basisInitialize({
		glueUrl: glueUrl,
		wasmUrl: wasmUrl,
		fallbackUrl: fallbackUrl,
		lazyInit: true
	});
}
function prefilterCubemap(options) {}

export { BLENDMODE_CONSTANT_ALPHA, BLENDMODE_CONSTANT_COLOR, BLENDMODE_ONE_MINUS_CONSTANT_ALPHA, BLENDMODE_ONE_MINUS_CONSTANT_COLOR, ContextCreationError, ELEMENTTYPE_FLOAT32, ELEMENTTYPE_INT16, ELEMENTTYPE_INT32, ELEMENTTYPE_INT8, ELEMENTTYPE_UINT16, ELEMENTTYPE_UINT32, ELEMENTTYPE_UINT8, PIXELFORMAT_L8_A8, PIXELFORMAT_R4_G4_B4_A4, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PhongMaterial, RIGIDBODY_ACTIVE_TAG, RIGIDBODY_CF_KINEMATIC_OBJECT, RIGIDBODY_CF_NORESPONSE_OBJECT, RIGIDBODY_CF_STATIC_OBJECT, RIGIDBODY_DISABLE_DEACTIVATION, RIGIDBODY_DISABLE_SIMULATION, RIGIDBODY_ISLAND_SLEEPING, RIGIDBODY_TYPE_DYNAMIC, RIGIDBODY_TYPE_KINEMATIC, RIGIDBODY_TYPE_STATIC, RIGIDBODY_WANTS_DEACTIVATION, UnsupportedBrowserError, anim, asset, audio, basisSetDownloadConfig, createStyle, drawFullscreenQuad, gfx, inherits, input, log, makeArray, posteffect, prefilterCubemap, programlib, scene, shape, time };
