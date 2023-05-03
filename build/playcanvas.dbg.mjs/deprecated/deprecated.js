import { version, revision } from '../core/core.js';
import { string } from '../core/string.js';
import { now } from '../core/time.js';
import { Debug } from '../core/debug.js';
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

// CORE

const log = {
  write: function (text) {
    Debug.deprecated('pc.log.write is deprecated. Use console.log instead.');
    console.log(text);
  },
  open: function () {
    Debug.deprecated('pc.log.open is deprecated. Use console.log instead.');
    log.write('Powered by PlayCanvas ' + version + ' ' + revision);
  },
  info: function (text) {
    Debug.deprecated('pc.log.info is deprecated. Use console.info instead.');
    console.info('INFO:    ' + text);
  },
  debug: function (text) {
    Debug.deprecated('pc.log.debug is deprecated. Use console.debug instead.');
    console.debug('DEBUG:   ' + text);
  },
  error: function (text) {
    Debug.deprecated('pc.log.error is deprecated. Use console.error instead.');
    console.error('ERROR:   ' + text);
  },
  warning: function (text) {
    Debug.deprecated('pc.log.warning is deprecated. Use console.warn instead.');
    console.warn('WARNING: ' + text);
  },
  alert: function (text) {
    Debug.deprecated('pc.log.alert is deprecated. Use alert instead.');
    log.write('ALERT:   ' + text);
    alert(text); // eslint-disable-line no-alert
  },

  assert: function (condition, text) {
    Debug.deprecated('pc.log.assert is deprecated. Use a conditional plus console.log instead.');
    if (condition === false) {
      log.write('ASSERT:  ' + text);
    }
  }
};
string.endsWith = function (s, subs) {
  Debug.deprecated('pc.string.endsWith is deprecated. Use String#endsWith instead.');
  return s.endsWith(subs);
};
string.startsWith = function (s, subs) {
  Debug.deprecated('pc.string.startsWith is deprecated. Use String#startsWith instead.');
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
    Debug.deprecated('pc.Color#data is not public API and should not be used. Access color components via their individual properties.');
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
    Debug.deprecated('pc.Color#data3 is not public API and should not be used. Access color components via their individual properties.');
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
    // this.constructor = Self;
  };

  Func._super = Super.prototype;
  Temp.prototype = Super.prototype;
  Func.prototype = new Temp();
  return Func;
}
function makeArray(arr) {
  Debug.deprecated('pc.makeArray is not public API and should not be used. Use Array.prototype.slice.call instead.');
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

// MATH

math.INV_LOG2 = Math.LOG2E;
math.intToBytes = math.intToBytes32;
math.bytesToInt = math.bytesToInt32;
Object.defineProperty(Vec2.prototype, 'data', {
  get: function () {
    Debug.deprecated('pc.Vec2#data is not public API and should not be used. Access vector components via their individual properties.');
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
    Debug.deprecated('pc.Vec3#data is not public API and should not be used. Access vector components via their individual properties.');
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
    Debug.deprecated('pc.Vec4#data is not public API and should not be used. Access vector components via their individual properties.');
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

// SHAPE

const shape = {
  Aabb: BoundingBox,
  Sphere: BoundingSphere,
  Plane: Plane
};
BoundingSphere.prototype.intersectRay = BoundingSphere.prototype.intersectsRay;
Frustum.prototype.update = function (projectionMatrix, viewMatrix) {
  Debug.deprecated('pc.Frustum#update is deprecated. Use pc.Frustum#setFromMat4 instead.');
  const viewProj = new Mat4();
  viewProj.mul2(projectionMatrix, viewMatrix);
  this.setFromMat4(viewProj);
};

// GRAPHICS

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
  Debug.deprecated(`pc.drawFullscreenQuad is deprecated. When used as part of PostEffect, use PostEffect#drawQuad instead.`);

  // convert rect in normalized space to viewport in pixel space
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
  const replacement = deprecatedChunks[chunkName];
  const useInstead = replacement ? ` Use pc.shaderChunks['${replacement}'] instead.` : '';
  const msg = `pc.shaderChunks['${chunkName}'] is deprecated.${useInstead}}`;
  Object.defineProperty(shaderChunks, chunkName, {
    get: function () {
      Debug.error(msg);
      return null;
    },
    set: function () {
      Debug.error(msg);
    }
  });
});

// Note: This was never public interface, but has been used in external scripts
Object.defineProperties(RenderTarget.prototype, {
  _glFrameBuffer: {
    get: function () {
      Debug.deprecated('pc.RenderTarget#_glFrameBuffer is deprecated. Use pc.RenderTarget.impl#_glFrameBuffer instead.');
      return this.impl._glFrameBuffer;
    },
    set: function (rgbm) {
      Debug.deprecated('pc.RenderTarget#_glFrameBuffer is deprecated. Use pc.RenderTarget.impl#_glFrameBuffer instead.');
    }
  }
});
Object.defineProperty(VertexFormat, 'defaultInstancingFormat', {
  get: function () {
    Debug.deprecated('pc.VertexFormat.defaultInstancingFormat is deprecated, use pc.VertexFormat.getDefaultInstancingFormat(graphicsDevice).');
    return VertexFormat.getDefaultInstancingFormat(GraphicsDeviceAccess.get());
  }
});
Object.defineProperties(Texture.prototype, {
  rgbm: {
    get: function () {
      Debug.deprecated('pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.');
      return this.type === TEXTURETYPE_RGBM;
    },
    set: function (rgbm) {
      Debug.deprecated('pc.Texture#rgbm is deprecated. Use pc.Texture#type instead.');
      this.type = rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
    }
  },
  swizzleGGGR: {
    get: function () {
      Debug.deprecated('pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.');
      return this.type === TEXTURETYPE_SWIZZLEGGGR;
    },
    set: function (swizzleGGGR) {
      Debug.deprecated('pc.Texture#swizzleGGGR is deprecated. Use pc.Texture#type instead.');
      this.type = swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
    }
  },
  _glTexture: {
    get: function () {
      Debug.deprecated('pc.Texture#_glTexture is no longer available, use Use pc.Texture.impl._glTexture instead.');
      return this.impl._glTexture;
    }
  },
  autoMipmap: {
    get: function () {
      Debug.deprecated('pc.Texture#autoMipmap is deprecated, use pc.Texture#mipmaps instead.');
      return this._mipmaps;
    },
    set: function (value) {
      Debug.deprecated('pc.Texture#autoMipmap is deprecated, use pc.Texture#mipmaps instead.');
      this._mipmaps = value;
    }
  }
});
GraphicsDevice.prototype.getProgramLibrary = function () {
  Debug.deprecated(`pc.GraphicsDevice#getProgramLibrary is deprecated.`);
  return getProgramLibrary(this);
};
GraphicsDevice.prototype.setProgramLibrary = function (lib) {
  Debug.deprecated(`pc.GraphicsDevice#setProgramLibrary is deprecated.`);
  setProgramLibrary(this, lib);
};
GraphicsDevice.prototype.removeShaderFromCache = function (shader) {
  Debug.deprecated(`pc.GraphicsDevice#removeShaderFromCache is deprecated.`);
  getProgramLibrary(this).removeFromCache(shader);
};
const _tempBlendState = new BlendState();
const _tempDepthState = new DepthState();
GraphicsDevice.prototype.setBlendFunction = function (blendSrc, blendDst) {
  Debug.deprecated(`pc.GraphicsDevice#setBlendFunction is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
  _tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrc, blendDst);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendFunctionSeparate = function (blendSrc, blendDst, blendSrcAlpha, blendDstAlpha) {
  Debug.deprecated(`pc.GraphicsDevice#setBlendFunctionSeparate is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorBlend(currentBlendState.colorOp, blendSrc, blendDst);
  _tempBlendState.setAlphaBlend(currentBlendState.alphaOp, blendSrcAlpha, blendDstAlpha);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendEquation = function (blendEquation) {
  Debug.deprecated(`pc.GraphicsDevice#setBlendEquation is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
  _tempBlendState.setAlphaBlend(blendEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setBlendEquationSeparate = function (blendEquation, blendAlphaEquation) {
  Debug.deprecated(`pc.GraphicsDevice#setBlendEquationSeparate is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorBlend(blendEquation, currentBlendState.colorSrcFactor, currentBlendState.colorDstFactor);
  _tempBlendState.setAlphaBlend(blendAlphaEquation, currentBlendState.alphaSrcFactor, currentBlendState.alphaDstFactor);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setColorWrite = function (redWrite, greenWrite, blueWrite, alphaWrite) {
  Debug.deprecated(`pc.GraphicsDevice#setColorWrite is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  const currentBlendState = this.blendState;
  _tempBlendState.copy(currentBlendState);
  _tempBlendState.setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite);
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.getBlending = function () {
  return this.blendState.blend;
};
GraphicsDevice.prototype.setBlending = function (blending) {
  Debug.deprecated(`pc.GraphicsDevice#setBlending is deprecated, use pc.GraphicsDevice.setBlendState instead.`);
  _tempBlendState.copy(this.blendState);
  _tempBlendState.blend = blending;
  this.setBlendState(_tempBlendState);
};
GraphicsDevice.prototype.setDepthWrite = function (write) {
  Debug.deprecated(`pc.GraphicsDevice#setDepthWrite is deprecated, use pc.GraphicsDevice.setDepthState instead.`);
  _tempDepthState.copy(this.depthState);
  _tempDepthState.write = write;
  this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.setDepthFunc = function (func) {
  Debug.deprecated(`pc.GraphicsDevice#setDepthFunc is deprecated, use pc.GraphicsDevice.setDepthState instead.`);
  _tempDepthState.copy(this.depthState);
  _tempDepthState.func = func;
  this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.setDepthTest = function (test) {
  Debug.deprecated(`pc.GraphicsDevice#setDepthTest is deprecated, use pc.GraphicsDevice.setDepthState instead.`);
  _tempDepthState.copy(this.depthState);
  _tempDepthState.test = test;
  this.setDepthState(_tempDepthState);
};
GraphicsDevice.prototype.getCullMode = function () {
  return this.cullMode;
};

// SCENE

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
    Debug.deprecated('pc.Scene#defaultMaterial is deprecated.');
    return getDefaultMaterial(getApplication().graphicsDevice);
  }
});

// scene.skyboxPrefiltered**** are deprecated
['128', '64', '32', '16', '8', '4'].forEach((size, index) => {
  Object.defineProperty(Scene.prototype, `skyboxPrefiltered${size}`, {
    get: function () {
      Debug.deprecated(`pc.Scene#skyboxPrefiltered${size} is deprecated. Use pc.Scene#prefilteredCubemaps instead.`);
      return this._prefilteredCubemaps[index];
    },
    set: function (value) {
      Debug.deprecated(`pc.Scene#skyboxPrefiltered${size} is deprecated. Use pc.Scene#prefilteredCubemaps instead.`);
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
    Debug.deprecated(`pc.Layer#renderTarget is deprecated. Set the render target on the camera instead.`);
    this._renderTarget = rt;
    this._dirtyCameras = true;
  },
  get: function () {
    return this._renderTarget;
  }
});

// This can be removed when 1.56 is out and the Editor no longer calls this
Scene.prototype._updateSkybox = function (device) {
  Debug.deprecated(`pc.Scene#_updateSkybox is deprecated. Use pc.Scene#_updateSky instead.`);
  this._updateSky(device);
};
Scene.prototype.addModel = function (model) {
  Debug.deprecated('pc.Scene#addModel is deprecated.');
  if (this.containsModel(model)) return;
  const layer = this.layers.getLayerById(LAYERID_WORLD);
  if (!layer) return;
  layer.addMeshInstances(model.meshInstances);
  this.models.push(model);
};
Scene.prototype.addShadowCaster = function (model) {
  Debug.deprecated('pc.Scene#addShadowCaster is deprecated.');
  const layer = this.layers.getLayerById(LAYERID_WORLD);
  if (!layer) return;
  layer.addShadowCasters(model.meshInstances);
};
Scene.prototype.removeModel = function (model) {
  Debug.deprecated('pc.Scene#removeModel is deprecated.');
  const index = this.models.indexOf(model);
  if (index !== -1) {
    const layer = this.layers.getLayerById(LAYERID_WORLD);
    if (!layer) return;
    layer.removeMeshInstances(model.meshInstances);
    this.models.splice(index, 1);
  }
};
Scene.prototype.removeShadowCasters = function (model) {
  Debug.deprecated('pc.Scene#removeShadowCasters is deprecated.');
  const layer = this.layers.getLayerById(LAYERID_WORLD);
  if (!layer) return;
  layer.removeShadowCasters(model.meshInstances);
};
Scene.prototype.containsModel = function (model) {
  Debug.deprecated('pc.Scene#containsModel is deprecated.');
  return this.models.indexOf(model) >= 0;
};
Scene.prototype.getModels = function (model) {
  Debug.deprecated('pc.Scene#getModels is deprecated.');
  return this.models;
};
Object.defineProperty(Batch.prototype, 'model', {
  get: function () {
    Debug.deprecated('pc.Batch#model is deprecated. Use pc.Batch#meshInstance to access batched mesh instead.');
    return null;
  }
});
ForwardRenderer.prototype.renderComposition = function (comp) {
  Debug.deprecated('pc.ForwardRenderer#renderComposition is deprecated. Use pc.AppBase.renderComposition instead.');
  getApplication().renderComposition(comp);
};
ForwardRenderer.prototype.updateShader = function (meshInstance, objDefs, staticLightList, pass, sortedLights) {
  Debug.deprecated('pc.ForwardRenderer#updateShader is deprecated, use pc.MeshInstance#updatePassShader.');
  const scene = meshInstance.material._scene || getApplication().scene;
  return meshInstance.updatePassShader(scene, pass, staticLightList, sortedLights);
};
MeshInstance.prototype.syncAabb = function () {
  Debug.deprecated('pc.MeshInstance#syncAabb is deprecated.');
};
Morph.prototype.getTarget = function (index) {
  Debug.deprecated('pc.Morph#getTarget is deprecated. Use pc.Morph#targets instead.');
  return this.targets[index];
};
GraphNode.prototype._dirtify = function (local) {
  Debug.deprecated('pc.GraphNode#_dirtify is deprecated. Use pc.GraphNode#_dirtifyLocal or _dirtifyWorld respectively instead.');
  if (local) this._dirtifyLocal();else this._dirtifyWorld();
};
GraphNode.prototype.addLabel = function (label) {
  Debug.deprecated('pc.GraphNode#addLabel is deprecated. Use pc.GraphNode#tags instead.');
  this._labels[label] = true;
};
GraphNode.prototype.getLabels = function () {
  Debug.deprecated('pc.GraphNode#getLabels is deprecated. Use pc.GraphNode#tags instead.');
  return Object.keys(this._labels);
};
GraphNode.prototype.hasLabel = function (label) {
  Debug.deprecated('pc.GraphNode#hasLabel is deprecated. Use pc.GraphNode#tags instead.');
  return !!this._labels[label];
};
GraphNode.prototype.removeLabel = function (label) {
  Debug.deprecated('pc.GraphNode#removeLabel is deprecated. Use pc.GraphNode#tags instead.');
  delete this._labels[label];
};
GraphNode.prototype.findByLabel = function (label, results = []) {
  Debug.deprecated('pc.GraphNode#findByLabel is deprecated. Use pc.GraphNode#tags instead.');
  if (this.hasLabel(label)) {
    results.push(this);
  }
  for (let i = 0; i < this._children.length; ++i) {
    results = this._children[i].findByLabel(label, results);
  }
  return results;
};
GraphNode.prototype.getChildren = function () {
  Debug.deprecated('pc.GraphNode#getChildren is deprecated. Use pc.GraphNode#children instead.');
  return this.children;
};
GraphNode.prototype.getName = function () {
  Debug.deprecated('pc.GraphNode#getName is deprecated. Use pc.GraphNode#name instead.');
  return this.name;
};
GraphNode.prototype.getPath = function () {
  Debug.deprecated('pc.GraphNode#getPath is deprecated. Use pc.GraphNode#path instead.');
  return this.path;
};
GraphNode.prototype.getRoot = function () {
  Debug.deprecated('pc.GraphNode#getRoot is deprecated. Use pc.GraphNode#root instead.');
  return this.root;
};
GraphNode.prototype.getParent = function () {
  Debug.deprecated('pc.GraphNode#getParent is deprecated. Use pc.GraphNode#parent instead.');
  return this.parent;
};
GraphNode.prototype.setName = function (name) {
  Debug.deprecated('pc.GraphNode#setName is deprecated. Use pc.GraphNode#name instead.');
  this.name = name;
};
Material.prototype.getName = function () {
  Debug.deprecated('pc.Material#getName is deprecated. Use pc.Material#name instead.');
  return this.name;
};
Material.prototype.setName = function (name) {
  Debug.deprecated('pc.Material#setName is deprecated. Use pc.Material#name instead.');
  this.name = name;
};
Material.prototype.getShader = function () {
  Debug.deprecated('pc.Material#getShader is deprecated. Use pc.Material#shader instead.');
  return this.shader;
};
Material.prototype.setShader = function (shader) {
  Debug.deprecated('pc.Material#setShader is deprecated. Use pc.Material#shader instead.');
  this.shader = shader;
};

// Note: this is used by the Editor
Object.defineProperty(Material.prototype, 'blend', {
  set: function (value) {
    Debug.deprecated(`pc.Material#blend is deprecated, use pc.Material.blendState.`);
    this.blendState.blend = value;
  },
  get: function () {
    return this.blendState.blend;
  }
});

// Note: this is used by the Editor
Object.defineProperty(Material.prototype, 'blendSrc', {
  set: function (value) {
    Debug.deprecated(`pc.Material#blendSrc is deprecated, use pc.Material.blendState.`);
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

// Note: this is used by the Editor
Object.defineProperty(Material.prototype, 'blendDst', {
  set: function (value) {
    Debug.deprecated(`pc.Material#blendDst is deprecated, use pc.Material.blendState.`);
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

// shininess (range 0..100) - maps to internal gloss value (range 0..1)
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
      Debug.deprecated(`pc.StandardMaterial#${oldName} is deprecated. Use pc.StandardMaterial#${newName} instead.`);
      return this[newName];
    },
    set: function (value) {
      Debug.deprecated(`pc.StandardMaterial#${oldName} is deprecated. Use pc.StandardMaterial#${newName} instead.`);
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
  if (name !== 'chunks' && name !== '_pass' && name !== '_isForwardPass') {
    Object.defineProperty(StandardMaterialOptions.prototype, name, {
      get: function () {
        Debug.deprecated(`Getting pc.Options#${name} has been deprecated as the property has been moved to pc.Options.LitOptions#${newName || name}.`);
        return this.litOptions[newName || name];
      },
      set: function (value) {
        Debug.deprecated(`Setting pc.Options#${name} has been deprecated as the property has been moved to pc.Options.LitOptions#${newName || name}.`);
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

// ANIMATION

const anim = {
  Animation: Animation,
  Key: Key,
  Node: Node,
  Skeleton: Skeleton
};
Animation.prototype.getDuration = function () {
  Debug.deprecated('pc.Animation#getDuration is deprecated. Use pc.Animation#duration instead.');
  return this.duration;
};
Animation.prototype.getName = function () {
  Debug.deprecated('pc.Animation#getName is deprecated. Use pc.Animation#name instead.');
  return this.name;
};
Animation.prototype.getNodes = function () {
  Debug.deprecated('pc.Animation#getNodes is deprecated. Use pc.Animation#nodes instead.');
  return this.nodes;
};
Animation.prototype.setDuration = function (duration) {
  Debug.deprecated('pc.Animation#setDuration is deprecated. Use pc.Animation#duration instead.');
  this.duration = duration;
};
Animation.prototype.setName = function (name) {
  Debug.deprecated('pc.Animation#setName is deprecated. Use pc.Animation#name instead.');
  this.name = name;
};
Skeleton.prototype.getAnimation = function () {
  Debug.deprecated('pc.Skeleton#getAnimation is deprecated. Use pc.Skeleton#animation instead.');
  return this.animation;
};
Skeleton.prototype.getCurrentTime = function () {
  Debug.deprecated('pc.Skeleton#getCurrentTime is deprecated. Use pc.Skeleton#currentTime instead.');
  return this.currentTime;
};
Skeleton.prototype.getLooping = function () {
  Debug.deprecated('pc.Skeleton#getLooping is deprecated. Use pc.Skeleton#looping instead.');
  return this.looping;
};
Skeleton.prototype.getNumNodes = function () {
  Debug.deprecated('pc.Skeleton#getNumNodes is deprecated. Use pc.Skeleton#numNodes instead.');
  return this.numNodes;
};
Skeleton.prototype.setAnimation = function (animation) {
  Debug.deprecated('pc.Skeleton#setAnimation is deprecated. Use pc.Skeleton#animation instead.');
  this.animation = animation;
};
Skeleton.prototype.setCurrentTime = function (time) {
  Debug.deprecated('pc.Skeleton#setCurrentTime is deprecated. Use pc.Skeleton#currentTime instead.');
  this.currentTime = time;
};
Skeleton.prototype.setLooping = function (looping) {
  Debug.deprecated('pc.Skeleton#setLooping is deprecated. Use pc.Skeleton#looping instead.');
  this.looping = looping;
};

// SOUND

const audio = {
  AudioManager: SoundManager,
  Channel: Channel,
  Channel3d: Channel3d,
  Listener: Listener,
  Sound: Sound
};
SoundManager.prototype.getListener = function () {
  Debug.deprecated('pc.SoundManager#getListener is deprecated. Use pc.SoundManager#listener instead.');
  return this.listener;
};
SoundManager.prototype.getVolume = function () {
  Debug.deprecated('pc.SoundManager#getVolume is deprecated. Use pc.SoundManager#volume instead.');
  return this.volume;
};
SoundManager.prototype.setVolume = function (volume) {
  Debug.deprecated('pc.SoundManager#setVolume is deprecated. Use pc.SoundManager#volume instead.');
  this.volume = volume;
};

// ASSET

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
  Debug.deprecated('pc.AssetRegistry#getAssetById is deprecated. Use pc.AssetRegistry#get instead.');
  return this.get(id);
};

// XR

Object.defineProperty(XrInputSource.prototype, 'ray', {
  get: function () {
    Debug.deprecated('pc.XrInputSource#ray is deprecated. Use pc.XrInputSource#getOrigin and pc.XrInputSource#getDirection instead.');
    return this._rayLocal;
  }
});
Object.defineProperty(XrInputSource.prototype, 'position', {
  get: function () {
    Debug.deprecated('pc.XrInputSource#position is deprecated. Use pc.XrInputSource#getLocalPosition instead.');
    return this._localPosition;
  }
});
Object.defineProperty(XrInputSource.prototype, 'rotation', {
  get: function () {
    Debug.deprecated('pc.XrInputSource#rotation is deprecated. Use pc.XrInputSource#getLocalRotation instead.');
    return this._localRotation;
  }
});

// INPUT

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

// FRAMEWORK

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
  Debug.deprecated('pc.AppBase#isFullscreen is deprecated. Use the Fullscreen API directly.');
  return !!document.fullscreenElement;
};
AppBase.prototype.enableFullscreen = function (element, success, error) {
  Debug.deprecated('pc.AppBase#enableFullscreen is deprecated. Use the Fullscreen API directly.');
  element = element || this.graphicsDevice.canvas;

  // success callback
  const s = function s() {
    success();
    document.removeEventListener('fullscreenchange', s);
  };

  // error callback
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
  Debug.deprecated('pc.AppBase#disableFullscreen is deprecated. Use the Fullscreen API directly.');

  // success callback
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
  Debug.deprecated('pc.AppBase#getSceneUrl is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#find instead.');
  const entry = this.scenes.find(name);
  if (entry) {
    return entry.url;
  }
  return null;
};
AppBase.prototype.loadScene = function (url, callback) {
  Debug.deprecated('pc.AppBase#loadScene is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#loadScene instead.');
  this.scenes.loadScene(url, callback);
};
AppBase.prototype.loadSceneHierarchy = function (url, callback) {
  Debug.deprecated('pc.AppBase#loadSceneHierarchy is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#loadSceneHierarchy instead.');
  this.scenes.loadSceneHierarchy(url, callback);
};
AppBase.prototype.loadSceneSettings = function (url, callback) {
  Debug.deprecated('pc.AppBase#loadSceneSettings is deprecated. Use pc.AppBase#scenes and pc.SceneRegistry#loadSceneSettings instead.');
  this.scenes.loadSceneSettings(url, callback);
};
AppBase.prototype.renderMeshInstance = function (meshInstance, options) {
  Debug.deprecated('pc.AppBase.renderMeshInstance is deprecated. Use pc.AppBase.drawMeshInstance.');
  const layer = options != null && options.layer ? options.layer : this.scene.defaultDrawLayer;
  this.scene.immediate.drawMesh(null, null, null, meshInstance, layer);
};
AppBase.prototype.renderMesh = function (mesh, material, matrix, options) {
  Debug.deprecated('pc.AppBase.renderMesh is deprecated. Use pc.AppBase.drawMesh.');
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
  Debug.deprecated('pc.AppBase.renderLine is deprecated. Use pc.AppBase.drawLine.');
  let endColor = color;
  let options;
  const arg3 = arguments[3];
  const arg4 = arguments[4];
  if (arg3 instanceof Color) {
    // passed in end color
    endColor = arg3;
    if (typeof arg4 === 'number') {
      // compatibility: convert linebatch id into options
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
      // use passed in options
      options = arg4;
    }
  } else if (typeof arg3 === 'number') {
    endColor = color;

    // compatibility: convert linebatch id into options
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
    // options passed in
    options = arg3;
  }
  this._addLines([start, end], [color, endColor], options);
};
AppBase.prototype.renderLines = function (position, color, options) {
  Debug.deprecated('pc.AppBase.renderLines is deprecated. Use pc.AppBase.drawLines.');
  if (!options) {
    // default option
    options = {
      layer: this.scene.layers.getLayerById(LAYERID_IMMEDIATE),
      depthTest: true
    };
  } else if (typeof options === 'number') {
    // backwards compatibility, LINEBATCH_OVERLAY lines have depthtest disabled
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
AppBase.prototype.enableVr = function () {
  Debug.deprecated('pc.AppBase#enableVR is deprecated, and WebVR API is no longer supported.');
};
Object.defineProperty(CameraComponent.prototype, 'node', {
  get: function () {
    Debug.deprecated('pc.CameraComponent#node is deprecated. Use pc.CameraComponent#entity instead.');
    return this.entity;
  }
});
Object.defineProperty(LightComponent.prototype, 'enable', {
  get: function () {
    Debug.deprecated('pc.LightComponent#enable is deprecated. Use pc.LightComponent#enabled instead.');
    return this.enabled;
  },
  set: function (value) {
    Debug.deprecated('pc.LightComponent#enable is deprecated. Use pc.LightComponent#enabled instead.');
    this.enabled = value;
  }
});
ModelComponent.prototype.setVisible = function (visible) {
  Debug.deprecated('pc.ModelComponent#setVisible is deprecated. Use pc.ModelComponent#enabled instead.');
  this.enabled = visible;
};
Object.defineProperty(ModelComponent.prototype, 'aabb', {
  get: function () {
    Debug.deprecated('pc.ModelComponent#aabb is deprecated. Use pc.ModelComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
    return null;
  },
  set: function (type) {
    Debug.deprecated('pc.ModelComponent#aabb is deprecated. Use pc.ModelComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
  }
});
Object.defineProperty(RenderComponent.prototype, 'aabb', {
  get: function () {
    Debug.deprecated('pc.RenderComponent#aabb is deprecated. Use pc.RenderComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
    return null;
  },
  set: function (type) {
    Debug.deprecated('pc.RenderComponent#aabb is deprecated. Use pc.RenderComponent#customAabb instead - which expects local space AABB instead of a world space AABB.');
  }
});
Object.defineProperty(RigidBodyComponent.prototype, 'bodyType', {
  get: function () {
    Debug.deprecated('pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
    return this.type;
  },
  set: function (type) {
    Debug.deprecated('pc.RigidBodyComponent#bodyType is deprecated. Use pc.RigidBodyComponent#type instead.');
    this.type = type;
  }
});
RigidBodyComponent.prototype.syncBodyToEntity = function () {
  Debug.deprecated('pc.RigidBodyComponent#syncBodyToEntity is not public API and should not be used.');
  this._updateDynamic();
};
RigidBodyComponentSystem.prototype.setGravity = function () {
  Debug.deprecated('pc.RigidBodyComponentSystem#setGravity is deprecated. Use pc.RigidBodyComponentSystem#gravity instead.');
  if (arguments.length === 1) {
    this.gravity.copy(arguments[0]);
  } else {
    this.gravity.set(arguments[0], arguments[1], arguments[2]);
  }
};
function basisSetDownloadConfig(glueUrl, wasmUrl, fallbackUrl) {
  Debug.deprecated('pc.basisSetDownloadConfig is deprecated. Use pc.basisInitialize instead.');
  basisInitialize({
    glueUrl: glueUrl,
    wasmUrl: wasmUrl,
    fallbackUrl: fallbackUrl,
    lazyInit: true
  });
}
function prefilterCubemap(options) {
  Debug.deprecated('pc.prefilterCubemap is deprecated. Use pc.envLighting instead.');
}

export { BLENDMODE_CONSTANT_ALPHA, BLENDMODE_CONSTANT_COLOR, BLENDMODE_ONE_MINUS_CONSTANT_ALPHA, BLENDMODE_ONE_MINUS_CONSTANT_COLOR, ContextCreationError, ELEMENTTYPE_FLOAT32, ELEMENTTYPE_INT16, ELEMENTTYPE_INT32, ELEMENTTYPE_INT8, ELEMENTTYPE_UINT16, ELEMENTTYPE_UINT32, ELEMENTTYPE_UINT8, PIXELFORMAT_L8_A8, PIXELFORMAT_R4_G4_B4_A4, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PhongMaterial, RIGIDBODY_ACTIVE_TAG, RIGIDBODY_CF_KINEMATIC_OBJECT, RIGIDBODY_CF_NORESPONSE_OBJECT, RIGIDBODY_CF_STATIC_OBJECT, RIGIDBODY_DISABLE_DEACTIVATION, RIGIDBODY_DISABLE_SIMULATION, RIGIDBODY_ISLAND_SLEEPING, RIGIDBODY_TYPE_DYNAMIC, RIGIDBODY_TYPE_KINEMATIC, RIGIDBODY_TYPE_STATIC, RIGIDBODY_WANTS_DEACTIVATION, UnsupportedBrowserError, anim, asset, audio, basisSetDownloadConfig, createStyle, drawFullscreenQuad, gfx, inherits, input, log, makeArray, posteffect, prefilterCubemap, programlib, scene, shape, time };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwcmVjYXRlZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2RlcHJlY2F0ZWQvZGVwcmVjYXRlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXZpc2lvbiwgdmVyc2lvbiB9IGZyb20gJy4uL2NvcmUvY29yZS5qcyc7XG5pbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuLi9jb3JlL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5pbXBvcnQgeyBGcnVzdHVtIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9mcnVzdHVtLmpzJztcbmltcG9ydCB7IFBsYW5lIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9wbGFuZS5qcyc7XG5cbmltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQkxFTkRNT0RFX1pFUk8sIEJMRU5ETU9ERV9PTkUsIEJMRU5ETU9ERV9TUkNfQ09MT1IsIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9EU1RfQ09MT1IsIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SLCBCTEVORE1PREVfU1JDX0FMUEhBLCBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFLFxuICAgIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBLCBCTEVORE1PREVfRFNUX0FMUEhBLCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICBCTEVORE1PREVfQ09OU1RBTlQsIEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQsXG4gICAgQlVGRkVSX1NUQVRJQywgQlVGRkVSX0RZTkFNSUMsIEJVRkZFUl9TVFJFQU0sXG4gICAgQ1VMTEZBQ0VfTk9ORSwgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfRlJPTlQsIENVTExGQUNFX0ZST05UQU5EQkFDSyxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQSVhFTEZPUk1BVF9MQTgsIFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTU1NTEsIFBJWEVMRk9STUFUX1JHQkE0LCBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICBQUklNSVRJVkVfUE9JTlRTLCBQUklNSVRJVkVfTElORVMsIFBSSU1JVElWRV9MSU5FTE9PUCwgUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTLCBQUklNSVRJVkVfVFJJU1RSSVAsIFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfQ09MT1IsIFNFTUFOVElDX1RFWENPT1JELCBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19BVFRSMCwgU0VNQU5USUNfQVRUUjEsIFNFTUFOVElDX0FUVFIyLCBTRU1BTlRJQ19BVFRSMyxcbiAgICBURVhUVVJFTE9DS19SRUFELCBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNLCBURVhUVVJFVFlQRV9TV0laWkxFR0dHUixcbiAgICBUWVBFX0lOVDgsIFRZUEVfVUlOVDgsIFRZUEVfSU5UMTYsIFRZUEVfVUlOVDE2LCBUWVBFX0lOVDMyLCBUWVBFX1VJTlQzMiwgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBiZWdpbiwgZW5kLCBmb2dDb2RlLCBnYW1tYUNvZGUsIHNraW5Db2RlLCB0b25lbWFwQ29kZSB9IGZyb20gJy4uL3NjZW5lL3NoYWRlci1saWIvcHJvZ3JhbXMvY29tbW9uLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4uL3NjZW5lL2dyYXBoaWNzL3F1YWQtcmVuZGVyLXV0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBJbmRleEJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2luZGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBQb3N0RWZmZWN0IH0gZnJvbSAnLi4vc2NlbmUvZ3JhcGhpY3MvcG9zdC1lZmZlY3QuanMnO1xuaW1wb3J0IHsgUG9zdEVmZmVjdFF1ZXVlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL3Bvc3QtZWZmZWN0LXF1ZXVlLmpzJztcbmltcG9ydCB7IFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnksIHNldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2NvcGVJZCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3Njb3BlLWlkLmpzJztcbmltcG9ydCB7IFNoYWRlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJnbFNoYWRlcklucHV0IH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtc2hhZGVyLWlucHV0LmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhJdGVyYXRvciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBTaGFkZXJVdGlscyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci11dGlscy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qcyc7XG5cbmltcG9ydCB7IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLCBMQVlFUklEX0lNTUVESUFURSwgTElORUJBVENIX09WRVJMQVksIExBWUVSSURfV09STEQgfSBmcm9tICcuLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgY2FsY3VsYXRlVGFuZ2VudHMsIGNyZWF0ZUJveCwgY3JlYXRlQ2Fwc3VsZSwgY3JlYXRlQ29uZSwgY3JlYXRlQ3lsaW5kZXIsIGNyZWF0ZU1lc2gsIGNyZWF0ZVBsYW5lLCBjcmVhdGVTcGhlcmUsIGNyZWF0ZVRvcnVzIH0gZnJvbSAnLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBwYXJ0aXRpb25Ta2luIH0gZnJvbSAnLi4vc2NlbmUvc2tpbi1wYXJ0aXRpb24uanMnO1xuaW1wb3J0IHsgQmFzaWNNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9iYXNpYy1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBGb3J3YXJkUmVuZGVyZXIgfSBmcm9tICcuLi9zY2VuZS9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UsIENvbW1hbmQgfSBmcm9tICcuLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgUGFydGljbGVFbWl0dGVyIH0gZnJvbSAnLi4vc2NlbmUvcGFydGljbGUtc3lzdGVtL3BhcnRpY2xlLWVtaXR0ZXIuanMnO1xuaW1wb3J0IHsgUGlja2VyIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2dyYXBoaWNzL3BpY2tlci5qcyc7XG5pbXBvcnQgeyBTY2VuZSB9IGZyb20gJy4uL3NjZW5lL3NjZW5lLmpzJztcbmltcG9ydCB7IFNraW4gfSBmcm9tICcuLi9zY2VuZS9za2luLmpzJztcbmltcG9ydCB7IFNraW5JbnN0YW5jZSB9IGZyb20gJy4uL3NjZW5lL3NraW4taW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBCYXRjaCB9IGZyb20gJy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9kZWZhdWx0LW1hdGVyaWFsLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTGl0T3B0aW9ucyB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9saXQtb3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4uL3NjZW5lL2xheWVyLmpzJztcblxuaW1wb3J0IHsgQW5pbWF0aW9uLCBLZXksIE5vZGUgfSBmcm9tICcuLi9zY2VuZS9hbmltYXRpb24vYW5pbWF0aW9uLmpzJztcbmltcG9ydCB7IFNrZWxldG9uIH0gZnJvbSAnLi4vc2NlbmUvYW5pbWF0aW9uL3NrZWxldG9uLmpzJztcblxuaW1wb3J0IHsgQ2hhbm5lbCB9IGZyb20gJy4uL3BsYXRmb3JtL2F1ZGlvL2NoYW5uZWwuanMnO1xuaW1wb3J0IHsgQ2hhbm5lbDNkIH0gZnJvbSAnLi4vcGxhdGZvcm0vYXVkaW8vY2hhbm5lbDNkLmpzJztcbmltcG9ydCB7IExpc3RlbmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vc291bmQvbGlzdGVuZXIuanMnO1xuaW1wb3J0IHsgU291bmQgfSBmcm9tICcuLi9wbGF0Zm9ybS9zb3VuZC9zb3VuZC5qcyc7XG5pbXBvcnQgeyBTb3VuZE1hbmFnZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9zb3VuZC9tYW5hZ2VyLmpzJztcblxuaW1wb3J0IHsgQXNzZXRSZWdpc3RyeSB9IGZyb20gJy4uL2ZyYW1ld29yay9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5cbmltcG9ydCB7IFhySW5wdXRTb3VyY2UgfSBmcm9tICcuLi9mcmFtZXdvcmsveHIveHItaW5wdXQtc291cmNlLmpzJztcblxuaW1wb3J0IHsgQ29udHJvbGxlciB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L2NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgRWxlbWVudElucHV0IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnO1xuaW1wb3J0IHsgR2FtZVBhZHMgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9nYW1lLXBhZHMuanMnO1xuaW1wb3J0IHsgS2V5Ym9hcmQgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9rZXlib2FyZC5qcyc7XG5pbXBvcnQgeyBLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQva2V5Ym9hcmQtZXZlbnQuanMnO1xuaW1wb3J0IHsgTW91c2UgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9tb3VzZS5qcyc7XG5pbXBvcnQgeyBNb3VzZUV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UtZXZlbnQuanMnO1xuaW1wb3J0IHsgVG91Y2hEZXZpY2UgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC90b3VjaC1kZXZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0VG91Y2hUYXJnZXRDb29yZHMsIFRvdWNoLCBUb3VjaEV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvdG91Y2gtZXZlbnQuanMnO1xuXG5pbXBvcnQgeyBBcHBCYXNlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2FwcC1iYXNlLmpzJztcbmltcG9ydCB7IGdldEFwcGxpY2F0aW9uIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2dsb2JhbHMuanMnO1xuaW1wb3J0IHsgQ2FtZXJhQ29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBMaWdodENvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2xpZ2h0L2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBNb2RlbENvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL21vZGVsL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBSZW5kZXJDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yZW5kZXIvY29tcG9uZW50LmpzJztcbmltcG9ydCB7XG4gICAgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCwgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QsIEJPRFlGTEFHX1NUQVRJQ19PQkpFQ1QsXG4gICAgQk9EWVNUQVRFX0FDVElWRV9UQUcsIEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiwgQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiwgQk9EWVNUQVRFX0lTTEFORF9TTEVFUElORywgQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTixcbiAgICBCT0RZVFlQRV9EWU5BTUlDLCBCT0RZVFlQRV9LSU5FTUFUSUMsIEJPRFlUWVBFX1NUQVRJQ1xufSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L3N5c3RlbS5qcyc7XG5pbXBvcnQgeyBiYXNpc0luaXRpYWxpemUgfSBmcm9tICcuLi9mcmFtZXdvcmsvaGFuZGxlcnMvYmFzaXMuanMnO1xuXG4vLyBDT1JFXG5cbmV4cG9ydCBjb25zdCBsb2cgPSB7XG4gICAgd3JpdGU6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy53cml0ZSBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5sb2cgaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS5sb2codGV4dCk7XG4gICAgfSxcblxuICAgIG9wZW46IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLm9wZW4gaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGxvZy53cml0ZSgnUG93ZXJlZCBieSBQbGF5Q2FudmFzICcgKyB2ZXJzaW9uICsgJyAnICsgcmV2aXNpb24pO1xuICAgIH0sXG5cbiAgICBpbmZvOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuaW5mbyBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5pbmZvIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUuaW5mbygnSU5GTzogICAgJyArIHRleHQpO1xuICAgIH0sXG5cbiAgICBkZWJ1ZzogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmRlYnVnIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLmRlYnVnIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoJ0RFQlVHOiAgICcgKyB0ZXh0KTtcbiAgICB9LFxuXG4gICAgZXJyb3I6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5lcnJvciBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5lcnJvciBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFUlJPUjogICAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIHdhcm5pbmc6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy53YXJuaW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLndhcm4gaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS53YXJuKCdXQVJOSU5HOiAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIGFsZXJ0OiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuYWxlcnQgaXMgZGVwcmVjYXRlZC4gVXNlIGFsZXJ0IGluc3RlYWQuJyk7XG4gICAgICAgIGxvZy53cml0ZSgnQUxFUlQ6ICAgJyArIHRleHQpO1xuICAgICAgICBhbGVydCh0ZXh0KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1hbGVydFxuICAgIH0sXG5cbiAgICBhc3NlcnQ6IGZ1bmN0aW9uIChjb25kaXRpb24sIHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmFzc2VydCBpcyBkZXByZWNhdGVkLiBVc2UgYSBjb25kaXRpb25hbCBwbHVzIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGlmIChjb25kaXRpb24gPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBsb2cud3JpdGUoJ0FTU0VSVDogICcgKyB0ZXh0KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnN0cmluZy5lbmRzV2l0aCA9IGZ1bmN0aW9uIChzLCBzdWJzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuc3RyaW5nLmVuZHNXaXRoIGlzIGRlcHJlY2F0ZWQuIFVzZSBTdHJpbmcjZW5kc1dpdGggaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gcy5lbmRzV2l0aChzdWJzKTtcbn07XG5cbnN0cmluZy5zdGFydHNXaXRoID0gZnVuY3Rpb24gKHMsIHN1YnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5zdHJpbmcuc3RhcnRzV2l0aCBpcyBkZXByZWNhdGVkLiBVc2UgU3RyaW5nI3N0YXJ0c1dpdGggaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gcy5zdGFydHNXaXRoKHN1YnMpO1xufTtcblxuY2xhc3MgVGltZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLl9pc1J1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYSA9IDA7XG4gICAgICAgIHRoaXMuX2IgPSAwO1xuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICB0aGlzLl9pc1J1bm5pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9hID0gbm93KCk7XG4gICAgfVxuXG4gICAgc3RvcCgpIHtcbiAgICAgICAgdGhpcy5faXNSdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2IgPSBub3coKTtcbiAgICB9XG5cbiAgICBnZXRNaWxsaXNlY29uZHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iIC0gdGhpcy5fYTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCB0aW1lID0ge1xuICAgIG5vdzogbm93LFxuICAgIFRpbWVyOiBUaW1lclxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkNvbG9yI2RhdGEgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIGNvbG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy5yO1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy5iO1xuICAgICAgICB0aGlzLl9kYXRhWzNdID0gdGhpcy5hO1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Db2xvciNkYXRhMyBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgY29sb3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEzKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhMyA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YTNbMF0gPSB0aGlzLnI7XG4gICAgICAgIHRoaXMuX2RhdGEzWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhM1syXSA9IHRoaXMuYjtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGEzO1xuICAgIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gaW5oZXJpdHMoU2VsZiwgU3VwZXIpIHtcbiAgICBjb25zdCBUZW1wID0gZnVuY3Rpb24gKCkge307XG4gICAgY29uc3QgRnVuYyA9IGZ1bmN0aW9uIChhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KSB7XG4gICAgICAgIFN1cGVyLmNhbGwodGhpcywgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCk7XG4gICAgICAgIFNlbGYuY2FsbCh0aGlzLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KTtcbiAgICAgICAgLy8gdGhpcy5jb25zdHJ1Y3RvciA9IFNlbGY7XG4gICAgfTtcbiAgICBGdW5jLl9zdXBlciA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBUZW1wLnByb3RvdHlwZSA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBGdW5jLnByb3RvdHlwZSA9IG5ldyBUZW1wKCk7XG5cbiAgICByZXR1cm4gRnVuYztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VBcnJheShhcnIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5tYWtlQXJyYXkgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gVXNlIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFycik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdHlsZShjc3NTdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHJlc3VsdC50eXBlID0gJ3RleHQvY3NzJztcbiAgICBpZiAocmVzdWx0LnN0eWxlU2hlZXQpIHtcbiAgICAgICAgcmVzdWx0LnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzc1N0cmluZztcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzU3RyaW5nKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gTUFUSFxuXG5tYXRoLklOVl9MT0cyID0gTWF0aC5MT0cyRTtcblxubWF0aC5pbnRUb0J5dGVzID0gbWF0aC5pbnRUb0J5dGVzMzI7XG5tYXRoLmJ5dGVzVG9JbnQgPSBtYXRoLmJ5dGVzVG9JbnQzMjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzIucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjMiNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWMyLnByb3RvdHlwZS5zY2FsZSA9IFZlYzIucHJvdG90eXBlLm11bFNjYWxhcjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzMucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjMyNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHRoaXMuX2RhdGFbMl0gPSB0aGlzLno7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWMzLnByb3RvdHlwZS5zY2FsZSA9IFZlYzMucHJvdG90eXBlLm11bFNjYWxhcjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzQucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjNCNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHRoaXMuX2RhdGFbMl0gPSB0aGlzLno7XG4gICAgICAgIHRoaXMuX2RhdGFbM10gPSB0aGlzLnc7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWM0LnByb3RvdHlwZS5zY2FsZSA9IFZlYzQucHJvdG90eXBlLm11bFNjYWxhcjtcblxuLy8gU0hBUEVcblxuZXhwb3J0IGNvbnN0IHNoYXBlID0ge1xuICAgIEFhYmI6IEJvdW5kaW5nQm94LFxuICAgIFNwaGVyZTogQm91bmRpbmdTcGhlcmUsXG4gICAgUGxhbmU6IFBsYW5lXG59O1xuXG5Cb3VuZGluZ1NwaGVyZS5wcm90b3R5cGUuaW50ZXJzZWN0UmF5ID0gQm91bmRpbmdTcGhlcmUucHJvdG90eXBlLmludGVyc2VjdHNSYXk7XG5cbkZydXN0dW0ucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChwcm9qZWN0aW9uTWF0cml4LCB2aWV3TWF0cml4KSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuRnJ1c3R1bSN1cGRhdGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkZydXN0dW0jc2V0RnJvbU1hdDQgaW5zdGVhZC4nKTtcblxuICAgIGNvbnN0IHZpZXdQcm9qID0gbmV3IE1hdDQoKTtcblxuICAgIHZpZXdQcm9qLm11bDIocHJvamVjdGlvbk1hdHJpeCwgdmlld01hdHJpeCk7XG5cbiAgICB0aGlzLnNldEZyb21NYXQ0KHZpZXdQcm9qKTtcbn07XG5cbi8vIEdSQVBISUNTXG5cbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTlQ4ID0gVFlQRV9JTlQ4O1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQ4ID0gVFlQRV9VSU5UODtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTlQxNiA9IFRZUEVfSU5UMTY7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfVUlOVDE2ID0gVFlQRV9VSU5UMTY7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfSU5UMzIgPSBUWVBFX0lOVDMyO1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQzMiA9IFRZUEVfVUlOVDMyO1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX0ZMT0FUMzIgPSBUWVBFX0ZMT0FUMzI7XG5cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9MOF9BOCA9IFBJWEVMRk9STUFUX0xBODtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SNV9HNl9CNSA9IFBJWEVMRk9STUFUX1JHQjU2NTtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMSA9IFBJWEVMRk9STUFUX1JHQkE1NTUxO1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I0X0c0X0I0X0E0ID0gUElYRUxGT1JNQVRfUkdCQTQ7XG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUjhfRzhfQjggPSBQSVhFTEZPUk1BVF9SR0I4O1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4ID0gUElYRUxGT1JNQVRfUkdCQTg7XG5cbmV4cG9ydCBjb25zdCBCTEVORE1PREVfQ09OU1RBTlRfQ09MT1IgPSBCTEVORE1PREVfQ09OU1RBTlQ7XG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVF9DT0xPUiA9IEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQ7XG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX0NPTlNUQU5UX0FMUEhBID0gQkxFTkRNT0RFX0NPTlNUQU5UO1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEEgPSBCTEVORE1PREVfT05FX01JTlVTX0NPTlNUQU5UO1xuXG5leHBvcnQgZnVuY3Rpb24gVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgZnVuY3Rpb24gQ29udGV4dENyZWF0aW9uRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdDb250ZXh0Q3JlYXRpb25FcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuQ29udGV4dENyZWF0aW9uRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgY29uc3QgcHJvZ3JhbWxpYiA9IHtcbiAgICBiZWdpbjogYmVnaW4sXG4gICAgZHVtbXlGcmFnbWVudENvZGU6IFNoYWRlclV0aWxzLmR1bW15RnJhZ21lbnRDb2RlLFxuICAgIGVuZDogZW5kLFxuICAgIGZvZ0NvZGU6IGZvZ0NvZGUsXG4gICAgZ2FtbWFDb2RlOiBnYW1tYUNvZGUsXG4gICAgcHJlY2lzaW9uQ29kZTogU2hhZGVyVXRpbHMucHJlY2lzaW9uQ29kZSxcbiAgICBza2luQ29kZTogc2tpbkNvZGUsXG4gICAgdG9uZW1hcENvZGU6IHRvbmVtYXBDb2RlLFxuICAgIHZlcnNpb25Db2RlOiBTaGFkZXJVdGlscy52ZXJzaW9uQ29kZVxufTtcblxuZXhwb3J0IGNvbnN0IGdmeCA9IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDogQUREUkVTU19NSVJST1JFRF9SRVBFQVQsXG4gICAgQUREUkVTU19SRVBFQVQ6IEFERFJFU1NfUkVQRUFULFxuICAgIEJMRU5ETU9ERV9aRVJPOiBCTEVORE1PREVfWkVSTyxcbiAgICBCTEVORE1PREVfT05FOiBCTEVORE1PREVfT05FLFxuICAgIEJMRU5ETU9ERV9TUkNfQ09MT1I6IEJMRU5ETU9ERV9TUkNfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9EU1RfQ09MT1I6IEJMRU5ETU9ERV9EU1RfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9TUkNfQUxQSEE6IEJMRU5ETU9ERV9TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURTogQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX0RTVF9BTFBIQTogQkxFTkRNT0RFX0RTVF9BTFBIQSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEsXG4gICAgQlVGRkVSX1NUQVRJQzogQlVGRkVSX1NUQVRJQyxcbiAgICBCVUZGRVJfRFlOQU1JQzogQlVGRkVSX0RZTkFNSUMsXG4gICAgQlVGRkVSX1NUUkVBTTogQlVGRkVSX1NUUkVBTSxcbiAgICBDVUxMRkFDRV9OT05FOiBDVUxMRkFDRV9OT05FLFxuICAgIENVTExGQUNFX0JBQ0s6IENVTExGQUNFX0JBQ0ssXG4gICAgQ1VMTEZBQ0VfRlJPTlQ6IENVTExGQUNFX0ZST05ULFxuICAgIENVTExGQUNFX0ZST05UQU5EQkFDSzogQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLLFxuICAgIEVMRU1FTlRUWVBFX0lOVDg6IFRZUEVfSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9VSU5UODogVFlQRV9VSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9JTlQxNjogVFlQRV9JTlQxNixcbiAgICBFTEVNRU5UVFlQRV9VSU5UMTY6IFRZUEVfVUlOVDE2LFxuICAgIEVMRU1FTlRUWVBFX0lOVDMyOiBUWVBFX0lOVDMyLFxuICAgIEVMRU1FTlRUWVBFX1VJTlQzMjogVFlQRV9VSU5UMzIsXG4gICAgRUxFTUVOVFRZUEVfRkxPQVQzMjogVFlQRV9GTE9BVDMyLFxuICAgIEZJTFRFUl9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVCxcbiAgICBGSUxURVJfTElORUFSOiBGSUxURVJfTElORUFSLFxuICAgIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCxcbiAgICBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q6IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSOiBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDg6IElOREVYRk9STUFUX1VJTlQ4LFxuICAgIElOREVYRk9STUFUX1VJTlQxNjogSU5ERVhGT1JNQVRfVUlOVDE2LFxuICAgIElOREVYRk9STUFUX1VJTlQzMjogSU5ERVhGT1JNQVRfVUlOVDMyLFxuICAgIFBJWEVMRk9STUFUX1JHQjU2NTogUElYRUxGT1JNQVRfUkdCNTY1LFxuICAgIFBJWEVMRk9STUFUX1JHQjg6IFBJWEVMRk9STUFUX1JHQjgsXG4gICAgUElYRUxGT1JNQVRfUkdCQTg6IFBJWEVMRk9STUFUX1JHQkE4LFxuICAgIFBSSU1JVElWRV9QT0lOVFM6IFBSSU1JVElWRV9QT0lOVFMsXG4gICAgUFJJTUlUSVZFX0xJTkVTOiBQUklNSVRJVkVfTElORVMsXG4gICAgUFJJTUlUSVZFX0xJTkVMT09QOiBQUklNSVRJVkVfTElORUxPT1AsXG4gICAgUFJJTUlUSVZFX0xJTkVTVFJJUDogUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTOiBQUklNSVRJVkVfVFJJQU5HTEVTLFxuICAgIFBSSU1JVElWRV9UUklTVFJJUDogUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFBSSU1JVElWRV9UUklGQU46IFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT046IFNFTUFOVElDX1BPU0lUSU9OLFxuICAgIFNFTUFOVElDX05PUk1BTDogU0VNQU5USUNfTk9STUFMLFxuICAgIFNFTUFOVElDX0NPTE9SOiBTRU1BTlRJQ19DT0xPUixcbiAgICBTRU1BTlRJQ19URVhDT09SRDogU0VNQU5USUNfVEVYQ09PUkQsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQwOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgU0VNQU5USUNfQVRUUjA6IFNFTUFOVElDX0FUVFIwLFxuICAgIFNFTUFOVElDX0FUVFIxOiBTRU1BTlRJQ19BVFRSMSxcbiAgICBTRU1BTlRJQ19BVFRSMjogU0VNQU5USUNfQVRUUjIsXG4gICAgU0VNQU5USUNfQVRUUjM6IFNFTUFOVElDX0FUVFIzLFxuICAgIFRFWFRVUkVMT0NLX1JFQUQ6IFRFWFRVUkVMT0NLX1JFQUQsXG4gICAgVEVYVFVSRUxPQ0tfV1JJVEU6IFRFWFRVUkVMT0NLX1dSSVRFLFxuICAgIGRyYXdRdWFkV2l0aFNoYWRlcjogZHJhd1F1YWRXaXRoU2hhZGVyLFxuICAgIHByb2dyYW1saWI6IHByb2dyYW1saWIsXG4gICAgc2hhZGVyQ2h1bmtzOiBzaGFkZXJDaHVua3MsXG4gICAgQ29udGV4dENyZWF0aW9uRXJyb3I6IENvbnRleHRDcmVhdGlvbkVycm9yLFxuICAgIERldmljZTogR3JhcGhpY3NEZXZpY2UsXG4gICAgSW5kZXhCdWZmZXI6IEluZGV4QnVmZmVyLFxuICAgIFByb2dyYW1MaWJyYXJ5OiBQcm9ncmFtTGlicmFyeSxcbiAgICBSZW5kZXJUYXJnZXQ6IFJlbmRlclRhcmdldCxcbiAgICBTY29wZUlkOiBTY29wZUlkLFxuICAgIFNoYWRlcjogU2hhZGVyLFxuICAgIFNoYWRlcklucHV0OiBXZWJnbFNoYWRlcklucHV0LFxuICAgIFRleHR1cmU6IFRleHR1cmUsXG4gICAgVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3I6IFVuc3VwcG9ydGVkQnJvd3NlckVycm9yLFxuICAgIFZlcnRleEJ1ZmZlcjogVmVydGV4QnVmZmVyLFxuICAgIFZlcnRleEZvcm1hdDogVmVydGV4Rm9ybWF0LFxuICAgIFZlcnRleEl0ZXJhdG9yOiBWZXJ0ZXhJdGVyYXRvclxufTtcblxuY29uc3QgX3ZpZXdwb3J0ID0gbmV3IFZlYzQoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRyYXdGdWxsc2NyZWVuUXVhZChkZXZpY2UsIHRhcmdldCwgdmVydGV4QnVmZmVyLCBzaGFkZXIsIHJlY3QpIHtcblxuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLmRyYXdGdWxsc2NyZWVuUXVhZCBpcyBkZXByZWNhdGVkLiBXaGVuIHVzZWQgYXMgcGFydCBvZiBQb3N0RWZmZWN0LCB1c2UgUG9zdEVmZmVjdCNkcmF3UXVhZCBpbnN0ZWFkLmApO1xuXG4gICAgLy8gY29udmVydCByZWN0IGluIG5vcm1hbGl6ZWQgc3BhY2UgdG8gdmlld3BvcnQgaW4gcGl4ZWwgc3BhY2VcbiAgICBsZXQgdmlld3BvcnQ7XG4gICAgaWYgKHJlY3QpIHtcbiAgICAgICAgY29uc3QgdyA9IHRhcmdldCA/IHRhcmdldC53aWR0aCA6IGRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3QgaCA9IHRhcmdldCA/IHRhcmdldC5oZWlnaHQgOiBkZXZpY2UuaGVpZ2h0O1xuICAgICAgICB2aWV3cG9ydCA9IF92aWV3cG9ydC5zZXQocmVjdC54ICogdywgcmVjdC55ICogaCwgcmVjdC56ICogdywgcmVjdC53ICogaCk7XG4gICAgfVxuXG4gICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZ2V0LCBzaGFkZXIsIHZpZXdwb3J0KTtcbn1cblxuZXhwb3J0IGNvbnN0IHBvc3RlZmZlY3QgPSB7XG4gICAgY3JlYXRlRnVsbHNjcmVlblF1YWQ6IChkZXZpY2UpID0+IHtcbiAgICAgICAgcmV0dXJuIGRldmljZS5xdWFkVmVydGV4QnVmZmVyO1xuICAgIH0sXG4gICAgZHJhd0Z1bGxzY3JlZW5RdWFkOiBkcmF3RnVsbHNjcmVlblF1YWQsXG4gICAgUG9zdEVmZmVjdDogUG9zdEVmZmVjdCxcbiAgICBQb3N0RWZmZWN0UXVldWU6IFBvc3RFZmZlY3RRdWV1ZVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNoYWRlckNodW5rcywgJ3RyYW5zZm9ybVNraW5uZWRWUycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcjZGVmaW5lIFNLSU5cXG4nICsgc2hhZGVyQ2h1bmtzLnRyYW5zZm9ybVZTO1xuICAgIH1cbn0pO1xuXG5jb25zdCBkZXByZWNhdGVkQ2h1bmtzID0ge1xuICAgICdhbWJpZW50UHJlZmlsdGVyZWRDdWJlLmZyYWcnOiAnYW1iaWVudEVudi5mcmFnJyxcbiAgICAnYW1iaWVudFByZWZpbHRlcmVkQ3ViZUxvZC5mcmFnJzogJ2FtYmllbnRFbnYuZnJhZycsXG4gICAgJ2RwQXRsYXNRdWFkLmZyYWcnOiBudWxsLFxuICAgICdnZW5QYXJhYm9sb2lkLmZyYWcnOiBudWxsLFxuICAgICdwcmVmaWx0ZXJDdWJlbWFwLmZyYWcnOiBudWxsLFxuICAgICdyZWZsZWN0aW9uRHBBdGxhcy5mcmFnJzogJ3JlZmxlY3Rpb25FbnYuZnJhZycsXG4gICAgJ3JlZmxlY3Rpb25QcmVmaWx0ZXJlZEN1YmUuZnJhZyc6ICdyZWZsZWN0aW9uRW52LmZyYWcnLFxuICAgICdyZWZsZWN0aW9uUHJlZmlsdGVyZWRDdWJlTG9kLmZyYWcnOiAncmVmbGVjdGlvbkVudi5mcmFnJ1xufTtcblxuT2JqZWN0LmtleXMoZGVwcmVjYXRlZENodW5rcykuZm9yRWFjaCgoY2h1bmtOYW1lKSA9PiB7XG4gICAgY29uc3QgcmVwbGFjZW1lbnQgPSBkZXByZWNhdGVkQ2h1bmtzW2NodW5rTmFtZV07XG4gICAgY29uc3QgdXNlSW5zdGVhZCA9IHJlcGxhY2VtZW50ID8gYCBVc2UgcGMuc2hhZGVyQ2h1bmtzWycke3JlcGxhY2VtZW50fSddIGluc3RlYWQuYCA6ICcnO1xuICAgIGNvbnN0IG1zZyA9IGBwYy5zaGFkZXJDaHVua3NbJyR7Y2h1bmtOYW1lfSddIGlzIGRlcHJlY2F0ZWQuJHt1c2VJbnN0ZWFkfX1gO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzaGFkZXJDaHVua3MsIGNodW5rTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKG1zZyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihtc2cpO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuLy8gTm90ZTogVGhpcyB3YXMgbmV2ZXIgcHVibGljIGludGVyZmFjZSwgYnV0IGhhcyBiZWVuIHVzZWQgaW4gZXh0ZXJuYWwgc2NyaXB0c1xuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoUmVuZGVyVGFyZ2V0LnByb3RvdHlwZSwge1xuICAgIF9nbEZyYW1lQnVmZmVyOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyVGFyZ2V0I19nbEZyYW1lQnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJUYXJnZXQuaW1wbCNfZ2xGcmFtZUJ1ZmZlciBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbC5fZ2xGcmFtZUJ1ZmZlcjtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAocmdibSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyVGFyZ2V0I19nbEZyYW1lQnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJUYXJnZXQuaW1wbCNfZ2xGcmFtZUJ1ZmZlciBpbnN0ZWFkLicpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShWZXJ0ZXhGb3JtYXQsICdkZWZhdWx0SW5zdGFuY2luZ0Zvcm1hdCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVydGV4Rm9ybWF0LmRlZmF1bHRJbnN0YW5jaW5nRm9ybWF0IGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5WZXJ0ZXhGb3JtYXQuZ2V0RGVmYXVsdEluc3RhbmNpbmdGb3JtYXQoZ3JhcGhpY3NEZXZpY2UpLicpO1xuICAgICAgICByZXR1cm4gVmVydGV4Rm9ybWF0LmdldERlZmF1bHRJbnN0YW5jaW5nRm9ybWF0KEdyYXBoaWNzRGV2aWNlQWNjZXNzLmdldCgpKTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoVGV4dHVyZS5wcm90b3R5cGUsIHtcbiAgICByZ2JtOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNyZ2JtIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnR5cGUgPT09IFRFWFRVUkVUWVBFX1JHQk07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHJnYm0pIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlRleHR1cmUjcmdibSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuVGV4dHVyZSN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSByZ2JtID8gVEVYVFVSRVRZUEVfUkdCTSA6IFRFWFRVUkVUWVBFX0RFRkFVTFQ7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgc3dpenpsZUdHR1I6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3N3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnR5cGUgPT09IFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChzd2l6emxlR0dHUikge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNzd2l6emxlR0dHUiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuVGV4dHVyZSN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSBzd2l6emxlR0dHUiA/IFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBfZ2xUZXh0dXJlOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNfZ2xUZXh0dXJlIGlzIG5vIGxvbmdlciBhdmFpbGFibGUsIHVzZSBVc2UgcGMuVGV4dHVyZS5pbXBsLl9nbFRleHR1cmUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBhdXRvTWlwbWFwOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNhdXRvTWlwbWFwIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5UZXh0dXJlI21pcG1hcHMgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9taXBtYXBzO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNhdXRvTWlwbWFwIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5UZXh0dXJlI21pcG1hcHMgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHRoaXMuX21pcG1hcHMgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuZ2V0UHJvZ3JhbUxpYnJhcnkgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2UjZ2V0UHJvZ3JhbUxpYnJhcnkgaXMgZGVwcmVjYXRlZC5gKTtcbiAgICByZXR1cm4gZ2V0UHJvZ3JhbUxpYnJhcnkodGhpcyk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0UHJvZ3JhbUxpYnJhcnkgPSBmdW5jdGlvbiAobGliKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0UHJvZ3JhbUxpYnJhcnkgaXMgZGVwcmVjYXRlZC5gKTtcbiAgICBzZXRQcm9ncmFtTGlicmFyeSh0aGlzLCBsaWIpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLnJlbW92ZVNoYWRlckZyb21DYWNoZSA9IGZ1bmN0aW9uIChzaGFkZXIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNyZW1vdmVTaGFkZXJGcm9tQ2FjaGUgaXMgZGVwcmVjYXRlZC5gKTtcbiAgICBnZXRQcm9ncmFtTGlicmFyeSh0aGlzKS5yZW1vdmVGcm9tQ2FjaGUoc2hhZGVyKTtcbn07XG5cbmNvbnN0IF90ZW1wQmxlbmRTdGF0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG5jb25zdCBfdGVtcERlcHRoU3RhdGUgPSBuZXcgRGVwdGhTdGF0ZSgpO1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0QmxlbmRGdW5jdGlvbiA9IGZ1bmN0aW9uIChibGVuZFNyYywgYmxlbmREc3QpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRCbGVuZEZ1bmN0aW9uIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXRCbGVuZFN0YXRlIGluc3RlYWQuYCk7XG4gICAgY29uc3QgY3VycmVudEJsZW5kU3RhdGUgPSB0aGlzLmJsZW5kU3RhdGU7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvckJsZW5kKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yT3AsIGJsZW5kU3JjLCBibGVuZERzdCk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLnNldEFscGhhQmxlbmQoY3VycmVudEJsZW5kU3RhdGUuYWxwaGFPcCwgYmxlbmRTcmMsIGJsZW5kRHN0KTtcbiAgICB0aGlzLnNldEJsZW5kU3RhdGUoX3RlbXBCbGVuZFN0YXRlKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUgPSBmdW5jdGlvbiAoYmxlbmRTcmMsIGJsZW5kRHN0LCBibGVuZFNyY0FscGhhLCBibGVuZERzdEFscGhhKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0QmxlbmRGdW5jdGlvblNlcGFyYXRlIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXRCbGVuZFN0YXRlIGluc3RlYWQuYCk7XG4gICAgY29uc3QgY3VycmVudEJsZW5kU3RhdGUgPSB0aGlzLmJsZW5kU3RhdGU7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvckJsZW5kKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yT3AsIGJsZW5kU3JjLCBibGVuZERzdCk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLnNldEFscGhhQmxlbmQoY3VycmVudEJsZW5kU3RhdGUuYWxwaGFPcCwgYmxlbmRTcmNBbHBoYSwgYmxlbmREc3RBbHBoYSk7XG4gICAgdGhpcy5zZXRCbGVuZFN0YXRlKF90ZW1wQmxlbmRTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0QmxlbmRFcXVhdGlvbiA9IGZ1bmN0aW9uIChibGVuZEVxdWF0aW9uKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0QmxlbmRFcXVhdGlvbiBpcyBkZXByZWNhdGVkLCB1c2UgcGMuR3JhcGhpY3NEZXZpY2Uuc2V0QmxlbmRTdGF0ZSBpbnN0ZWFkLmApO1xuICAgIGNvbnN0IGN1cnJlbnRCbGVuZFN0YXRlID0gdGhpcy5ibGVuZFN0YXRlO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5jb3B5KGN1cnJlbnRCbGVuZFN0YXRlKTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuc2V0Q29sb3JCbGVuZChibGVuZEVxdWF0aW9uLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvclNyY0ZhY3RvciwgY3VycmVudEJsZW5kU3RhdGUuY29sb3JEc3RGYWN0b3IpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRBbHBoYUJsZW5kKGJsZW5kRXF1YXRpb24sIGN1cnJlbnRCbGVuZFN0YXRlLmFscGhhU3JjRmFjdG9yLCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYURzdEZhY3Rvcik7XG4gICAgdGhpcy5zZXRCbGVuZFN0YXRlKF90ZW1wQmxlbmRTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlID0gZnVuY3Rpb24gKGJsZW5kRXF1YXRpb24sIGJsZW5kQWxwaGFFcXVhdGlvbikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3NldEJsZW5kRXF1YXRpb25TZXBhcmF0ZSBpcyBkZXByZWNhdGVkLCB1c2UgcGMuR3JhcGhpY3NEZXZpY2Uuc2V0QmxlbmRTdGF0ZSBpbnN0ZWFkLmApO1xuICAgIGNvbnN0IGN1cnJlbnRCbGVuZFN0YXRlID0gdGhpcy5ibGVuZFN0YXRlO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5jb3B5KGN1cnJlbnRCbGVuZFN0YXRlKTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuc2V0Q29sb3JCbGVuZChibGVuZEVxdWF0aW9uLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvclNyY0ZhY3RvciwgY3VycmVudEJsZW5kU3RhdGUuY29sb3JEc3RGYWN0b3IpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRBbHBoYUJsZW5kKGJsZW5kQWxwaGFFcXVhdGlvbiwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFTcmNGYWN0b3IsIGN1cnJlbnRCbGVuZFN0YXRlLmFscGhhRHN0RmFjdG9yKTtcbiAgICB0aGlzLnNldEJsZW5kU3RhdGUoX3RlbXBCbGVuZFN0YXRlKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRDb2xvcldyaXRlID0gZnVuY3Rpb24gKHJlZFdyaXRlLCBncmVlbldyaXRlLCBibHVlV3JpdGUsIGFscGhhV3JpdGUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRDb2xvcldyaXRlIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXRCbGVuZFN0YXRlIGluc3RlYWQuYCk7XG4gICAgY29uc3QgY3VycmVudEJsZW5kU3RhdGUgPSB0aGlzLmJsZW5kU3RhdGU7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvcldyaXRlKHJlZFdyaXRlLCBncmVlbldyaXRlLCBibHVlV3JpdGUsIGFscGhhV3JpdGUpO1xuICAgIHRoaXMuc2V0QmxlbmRTdGF0ZShfdGVtcEJsZW5kU3RhdGUpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLmdldEJsZW5kaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmJsZW5kU3RhdGUuYmxlbmQ7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0QmxlbmRpbmcgPSBmdW5jdGlvbiAoYmxlbmRpbmcpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRCbGVuZGluZyBpcyBkZXByZWNhdGVkLCB1c2UgcGMuR3JhcGhpY3NEZXZpY2Uuc2V0QmxlbmRTdGF0ZSBpbnN0ZWFkLmApO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5jb3B5KHRoaXMuYmxlbmRTdGF0ZSk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmJsZW5kID0gYmxlbmRpbmc7XG4gICAgdGhpcy5zZXRCbGVuZFN0YXRlKF90ZW1wQmxlbmRTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0RGVwdGhXcml0ZSA9IGZ1bmN0aW9uICh3cml0ZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3NldERlcHRoV3JpdGUgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLkdyYXBoaWNzRGV2aWNlLnNldERlcHRoU3RhdGUgaW5zdGVhZC5gKTtcbiAgICBfdGVtcERlcHRoU3RhdGUuY29weSh0aGlzLmRlcHRoU3RhdGUpO1xuICAgIF90ZW1wRGVwdGhTdGF0ZS53cml0ZSA9IHdyaXRlO1xuICAgIHRoaXMuc2V0RGVwdGhTdGF0ZShfdGVtcERlcHRoU3RhdGUpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLnNldERlcHRoRnVuYyA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0RGVwdGhGdW5jIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXREZXB0aFN0YXRlIGluc3RlYWQuYCk7XG4gICAgX3RlbXBEZXB0aFN0YXRlLmNvcHkodGhpcy5kZXB0aFN0YXRlKTtcbiAgICBfdGVtcERlcHRoU3RhdGUuZnVuYyA9IGZ1bmM7XG4gICAgdGhpcy5zZXREZXB0aFN0YXRlKF90ZW1wRGVwdGhTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0RGVwdGhUZXN0ID0gZnVuY3Rpb24gKHRlc3QpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXREZXB0aFRlc3QgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLkdyYXBoaWNzRGV2aWNlLnNldERlcHRoU3RhdGUgaW5zdGVhZC5gKTtcbiAgICBfdGVtcERlcHRoU3RhdGUuY29weSh0aGlzLmRlcHRoU3RhdGUpO1xuICAgIF90ZW1wRGVwdGhTdGF0ZS50ZXN0ID0gdGVzdDtcbiAgICB0aGlzLnNldERlcHRoU3RhdGUoX3RlbXBEZXB0aFN0YXRlKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5nZXRDdWxsTW9kZSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5jdWxsTW9kZTtcbn07XG5cbi8vIFNDRU5FXG5cbmV4cG9ydCBjb25zdCBQaG9uZ01hdGVyaWFsID0gU3RhbmRhcmRNYXRlcmlhbDtcblxuZXhwb3J0IGNvbnN0IHNjZW5lID0ge1xuICAgIHBhcnRpdGlvblNraW46IHBhcnRpdGlvblNraW4sXG4gICAgcHJvY2VkdXJhbDoge1xuICAgICAgICBjYWxjdWxhdGVUYW5nZW50czogY2FsY3VsYXRlVGFuZ2VudHMsXG4gICAgICAgIGNyZWF0ZU1lc2g6IGNyZWF0ZU1lc2gsXG4gICAgICAgIGNyZWF0ZVRvcnVzOiBjcmVhdGVUb3J1cyxcbiAgICAgICAgY3JlYXRlQ3lsaW5kZXI6IGNyZWF0ZUN5bGluZGVyLFxuICAgICAgICBjcmVhdGVDYXBzdWxlOiBjcmVhdGVDYXBzdWxlLFxuICAgICAgICBjcmVhdGVDb25lOiBjcmVhdGVDb25lLFxuICAgICAgICBjcmVhdGVTcGhlcmU6IGNyZWF0ZVNwaGVyZSxcbiAgICAgICAgY3JlYXRlUGxhbmU6IGNyZWF0ZVBsYW5lLFxuICAgICAgICBjcmVhdGVCb3g6IGNyZWF0ZUJveFxuICAgIH0sXG4gICAgQmFzaWNNYXRlcmlhbDogQmFzaWNNYXRlcmlhbCxcbiAgICBDb21tYW5kOiBDb21tYW5kLFxuICAgIEZvcndhcmRSZW5kZXJlcjogRm9yd2FyZFJlbmRlcmVyLFxuICAgIEdyYXBoTm9kZTogR3JhcGhOb2RlLFxuICAgIE1hdGVyaWFsOiBNYXRlcmlhbCxcbiAgICBNZXNoOiBNZXNoLFxuICAgIE1lc2hJbnN0YW5jZTogTWVzaEluc3RhbmNlLFxuICAgIE1vZGVsOiBNb2RlbCxcbiAgICBQYXJ0aWNsZUVtaXR0ZXI6IFBhcnRpY2xlRW1pdHRlcixcbiAgICBQaG9uZ01hdGVyaWFsOiBTdGFuZGFyZE1hdGVyaWFsLFxuICAgIFBpY2tlcjogUGlja2VyLFxuICAgIFByb2plY3Rpb246IHtcbiAgICAgICAgT1JUSE9HUkFQSElDOiBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyxcbiAgICAgICAgUEVSU1BFQ1RJVkU6IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkVcbiAgICB9LFxuICAgIFNjZW5lOiBTY2VuZSxcbiAgICBTa2luOiBTa2luLFxuICAgIFNraW5JbnN0YW5jZTogU2tpbkluc3RhbmNlXG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2NlbmUucHJvdG90eXBlLCAnZGVmYXVsdE1hdGVyaWFsJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNkZWZhdWx0TWF0ZXJpYWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICAgICAgcmV0dXJuIGdldERlZmF1bHRNYXRlcmlhbChnZXRBcHBsaWNhdGlvbigpLmdyYXBoaWNzRGV2aWNlKTtcbiAgICB9XG59KTtcblxuLy8gc2NlbmUuc2t5Ym94UHJlZmlsdGVyZWQqKioqIGFyZSBkZXByZWNhdGVkXG5bJzEyOCcsICc2NCcsICczMicsICcxNicsICc4JywgJzQnXS5mb3JFYWNoKChzaXplLCBpbmRleCkgPT4ge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTY2VuZS5wcm90b3R5cGUsIGBza3lib3hQcmVmaWx0ZXJlZCR7c2l6ZX1gLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuU2NlbmUjc2t5Ym94UHJlZmlsdGVyZWQke3NpemV9IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5TY2VuZSNwcmVmaWx0ZXJlZEN1YmVtYXBzIGluc3RlYWQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwc1tpbmRleF07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TY2VuZSNza3lib3hQcmVmaWx0ZXJlZCR7c2l6ZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNjZW5lI3ByZWZpbHRlcmVkQ3ViZW1hcHMgaW5zdGVhZC5gKTtcbiAgICAgICAgICAgIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHNbaW5kZXhdID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNjZW5lLnByb3RvdHlwZSwgJ21vZGVscycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9tb2RlbHMpIHtcbiAgICAgICAgICAgIHRoaXMuX21vZGVscyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9tb2RlbHM7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShMYXllci5wcm90b3R5cGUsICdyZW5kZXJUYXJnZXQnLCB7XG4gICAgc2V0OiBmdW5jdGlvbiAocnQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuTGF5ZXIjcmVuZGVyVGFyZ2V0IGlzIGRlcHJlY2F0ZWQuIFNldCB0aGUgcmVuZGVyIHRhcmdldCBvbiB0aGUgY2FtZXJhIGluc3RlYWQuYCk7XG4gICAgICAgIHRoaXMuX3JlbmRlclRhcmdldCA9IHJ0O1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJUYXJnZXQ7XG4gICAgfVxufSk7XG5cbi8vIFRoaXMgY2FuIGJlIHJlbW92ZWQgd2hlbiAxLjU2IGlzIG91dCBhbmQgdGhlIEVkaXRvciBubyBsb25nZXIgY2FsbHMgdGhpc1xuU2NlbmUucHJvdG90eXBlLl91cGRhdGVTa3lib3ggPSBmdW5jdGlvbiAoZGV2aWNlKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuU2NlbmUjX3VwZGF0ZVNreWJveCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2NlbmUjX3VwZGF0ZVNreSBpbnN0ZWFkLmApO1xuICAgIHRoaXMuX3VwZGF0ZVNreShkZXZpY2UpO1xufTtcblxuU2NlbmUucHJvdG90eXBlLmFkZE1vZGVsID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjYWRkTW9kZWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICBpZiAodGhpcy5jb250YWluc01vZGVsKG1vZGVsKSkgcmV0dXJuO1xuICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfV09STEQpO1xuICAgIGlmICghbGF5ZXIpIHJldHVybjtcbiAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgIHRoaXMubW9kZWxzLnB1c2gobW9kZWwpO1xufTtcblxuU2NlbmUucHJvdG90eXBlLmFkZFNoYWRvd0Nhc3RlciA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2FkZFNoYWRvd0Nhc3RlciBpcyBkZXByZWNhdGVkLicpO1xuICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfV09STEQpO1xuICAgIGlmICghbGF5ZXIpIHJldHVybjtcbiAgICBsYXllci5hZGRTaGFkb3dDYXN0ZXJzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xufTtcblxuU2NlbmUucHJvdG90eXBlLnJlbW92ZU1vZGVsID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjcmVtb3ZlTW9kZWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMubW9kZWxzLmluZGV4T2YobW9kZWwpO1xuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCk7XG4gICAgICAgIGlmICghbGF5ZXIpIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgdGhpcy5tb2RlbHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG59O1xuXG5TY2VuZS5wcm90b3R5cGUucmVtb3ZlU2hhZG93Q2FzdGVycyA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI3JlbW92ZVNoYWRvd0Nhc3RlcnMgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgbGF5ZXIucmVtb3ZlU2hhZG93Q2FzdGVycyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5jb250YWluc01vZGVsID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjY29udGFpbnNNb2RlbCBpcyBkZXByZWNhdGVkLicpO1xuICAgIHJldHVybiB0aGlzLm1vZGVscy5pbmRleE9mKG1vZGVsKSA+PSAwO1xufTtcblxuU2NlbmUucHJvdG90eXBlLmdldE1vZGVscyA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2dldE1vZGVscyBpcyBkZXByZWNhdGVkLicpO1xuICAgIHJldHVybiB0aGlzLm1vZGVscztcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXRjaC5wcm90b3R5cGUsICdtb2RlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQmF0Y2gjbW9kZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkJhdGNoI21lc2hJbnN0YW5jZSB0byBhY2Nlc3MgYmF0Y2hlZCBtZXNoIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn0pO1xuXG5Gb3J3YXJkUmVuZGVyZXIucHJvdG90eXBlLnJlbmRlckNvbXBvc2l0aW9uID0gZnVuY3Rpb24gKGNvbXApIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Gb3J3YXJkUmVuZGVyZXIjcmVuZGVyQ29tcG9zaXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UucmVuZGVyQ29tcG9zaXRpb24gaW5zdGVhZC4nKTtcbiAgICBnZXRBcHBsaWNhdGlvbigpLnJlbmRlckNvbXBvc2l0aW9uKGNvbXApO1xufTtcblxuRm9yd2FyZFJlbmRlcmVyLnByb3RvdHlwZS51cGRhdGVTaGFkZXIgPSBmdW5jdGlvbiAobWVzaEluc3RhbmNlLCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkZvcndhcmRSZW5kZXJlciN1cGRhdGVTaGFkZXIgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLk1lc2hJbnN0YW5jZSN1cGRhdGVQYXNzU2hhZGVyLicpO1xuICAgIGNvbnN0IHNjZW5lID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsLl9zY2VuZSB8fCBnZXRBcHBsaWNhdGlvbigpLnNjZW5lO1xuICAgIHJldHVybiBtZXNoSW5zdGFuY2UudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgcGFzcywgc3RhdGljTGlnaHRMaXN0LCBzb3J0ZWRMaWdodHMpO1xufTtcblxuTWVzaEluc3RhbmNlLnByb3RvdHlwZS5zeW5jQWFiYiA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NZXNoSW5zdGFuY2Ujc3luY0FhYmIgaXMgZGVwcmVjYXRlZC4nKTtcbn07XG5cbk1vcnBoLnByb3RvdHlwZS5nZXRUYXJnZXQgPSBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb3JwaCNnZXRUYXJnZXQgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1vcnBoI3RhcmdldHMgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLnRhcmdldHNbaW5kZXhdO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5fZGlydGlmeSA9IGZ1bmN0aW9uIChsb2NhbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNfZGlydGlmeSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI19kaXJ0aWZ5TG9jYWwgb3IgX2RpcnRpZnlXb3JsZCByZXNwZWN0aXZlbHkgaW5zdGVhZC4nKTtcbiAgICBpZiAobG9jYWwpXG4gICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIGVsc2VcbiAgICAgICAgdGhpcy5fZGlydGlmeVdvcmxkKCk7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmFkZExhYmVsID0gZnVuY3Rpb24gKGxhYmVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2FkZExhYmVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgdGhpcy5fbGFiZWxzW2xhYmVsXSA9IHRydWU7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldExhYmVscyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0TGFiZWxzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2xhYmVscyk7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmhhc0xhYmVsID0gZnVuY3Rpb24gKGxhYmVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2hhc0xhYmVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuICEhdGhpcy5fbGFiZWxzW2xhYmVsXTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUucmVtb3ZlTGFiZWwgPSBmdW5jdGlvbiAobGFiZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjcmVtb3ZlTGFiZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICBkZWxldGUgdGhpcy5fbGFiZWxzW2xhYmVsXTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZmluZEJ5TGFiZWwgPSBmdW5jdGlvbiAobGFiZWwsIHJlc3VsdHMgPSBbXSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNmaW5kQnlMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIGlmICh0aGlzLmhhc0xhYmVsKGxhYmVsKSkge1xuICAgICAgICByZXN1bHRzLnB1c2godGhpcyk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICByZXN1bHRzID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZEJ5TGFiZWwobGFiZWwsIHJlc3VsdHMpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRzO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRDaGlsZHJlbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0Q2hpbGRyZW4gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNjaGlsZHJlbiBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW47XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldE5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNuYW1lIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5uYW1lO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRQYXRoID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRQYXRoIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjcGF0aCBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMucGF0aDtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0Um9vdCA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0Um9vdCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3Jvb3QgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLnJvb3Q7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldFBhcmVudCA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0UGFyZW50IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjcGFyZW50IGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5wYXJlbnQ7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLnNldE5hbWUgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNzZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjbmFtZSBpbnN0ZWFkLicpO1xuXG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5nZXROYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1hdGVyaWFsI2dldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1hdGVyaWFsI25hbWUgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5uYW1lO1xufTtcblxuTWF0ZXJpYWwucHJvdG90eXBlLnNldE5hbWUgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1hdGVyaWFsI3NldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1hdGVyaWFsI25hbWUgaW5zdGVhZC4nKTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xufTtcblxuTWF0ZXJpYWwucHJvdG90eXBlLmdldFNoYWRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNnZXRTaGFkZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1hdGVyaWFsI3NoYWRlciBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLnNoYWRlcjtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5zZXRTaGFkZXIgPSBmdW5jdGlvbiAoc2hhZGVyKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWF0ZXJpYWwjc2V0U2hhZGVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNzaGFkZXIgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnNoYWRlciA9IHNoYWRlcjtcbn07XG5cbi8vIE5vdGU6IHRoaXMgaXMgdXNlZCBieSB0aGUgRWRpdG9yXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTWF0ZXJpYWwucHJvdG90eXBlLCAnYmxlbmQnLCB7XG4gICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuTWF0ZXJpYWwjYmxlbmQgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLk1hdGVyaWFsLmJsZW5kU3RhdGUuYCk7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZS5ibGVuZCA9IHZhbHVlO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJsZW5kU3RhdGUuYmxlbmQ7XG4gICAgfVxufSk7XG5cbi8vIE5vdGU6IHRoaXMgaXMgdXNlZCBieSB0aGUgRWRpdG9yXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTWF0ZXJpYWwucHJvdG90eXBlLCAnYmxlbmRTcmMnLCB7XG4gICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuTWF0ZXJpYWwjYmxlbmRTcmMgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLk1hdGVyaWFsLmJsZW5kU3RhdGUuYCk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRCbGVuZFN0YXRlID0gdGhpcy5ibGVuZFN0YXRlO1xuICAgICAgICBfdGVtcEJsZW5kU3RhdGUuY29weShjdXJyZW50QmxlbmRTdGF0ZSk7XG4gICAgICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvckJsZW5kKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yT3AsIHZhbHVlLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvckRzdEZhY3Rvcik7XG4gICAgICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRBbHBoYUJsZW5kKGN1cnJlbnRCbGVuZFN0YXRlLmFscGhhT3AsIHZhbHVlLCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYURzdEZhY3Rvcik7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZSA9IF90ZW1wQmxlbmRTdGF0ZTtcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ibGVuZFN0YXRlLmNvbG9yU3JjRmFjdG9yO1xuICAgIH1cbn0pO1xuXG4vLyBOb3RlOiB0aGlzIGlzIHVzZWQgYnkgdGhlIEVkaXRvclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE1hdGVyaWFsLnByb3RvdHlwZSwgJ2JsZW5kRHN0Jywge1xuICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLk1hdGVyaWFsI2JsZW5kRHN0IGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5NYXRlcmlhbC5ibGVuZFN0YXRlLmApO1xuICAgICAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICAgICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgICAgICBfdGVtcEJsZW5kU3RhdGUuc2V0Q29sb3JCbGVuZChjdXJyZW50QmxlbmRTdGF0ZS5jb2xvck9wLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvclNyY0ZhY3RvciwgdmFsdWUpO1xuICAgICAgICBfdGVtcEJsZW5kU3RhdGUuc2V0QWxwaGFCbGVuZChjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYU9wLCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYVNyY0ZhY3RvciwgdmFsdWUpO1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGUgPSBfdGVtcEJsZW5kU3RhdGU7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmxlbmRTdGF0ZS5jb2xvckRzdEZhY3RvcjtcbiAgICB9XG59KTtcblxuLy8gc2hpbmluZXNzIChyYW5nZSAwLi4xMDApIC0gbWFwcyB0byBpbnRlcm5hbCBnbG9zcyB2YWx1ZSAocmFuZ2UgMC4uMSlcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTdGFuZGFyZE1hdGVyaWFsLnByb3RvdHlwZSwgJ3NoaW5pbmVzcycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2xvc3MgKiAxMDA7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB0aGlzLmdsb3NzID0gdmFsdWUgKiAwLjAxO1xuICAgIH1cbn0pO1xuXG5mdW5jdGlvbiBfZGVmaW5lQWxpYXMobmV3TmFtZSwgb2xkTmFtZSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTdGFuZGFyZE1hdGVyaWFsLnByb3RvdHlwZSwgb2xkTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtvbGROYW1lfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU3RhbmRhcmRNYXRlcmlhbCMke25ld05hbWV9IGluc3RlYWQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1tuZXdOYW1lXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtvbGROYW1lfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU3RhbmRhcmRNYXRlcmlhbCMke25ld05hbWV9IGluc3RlYWQuYCk7XG4gICAgICAgICAgICB0aGlzW25ld05hbWVdID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuX2RlZmluZUFsaWFzKCdkaWZmdXNlVGludCcsICdkaWZmdXNlTWFwVGludCcpO1xuX2RlZmluZUFsaWFzKCdzcGVjdWxhclRpbnQnLCAnc3BlY3VsYXJNYXBUaW50Jyk7XG5fZGVmaW5lQWxpYXMoJ2VtaXNzaXZlVGludCcsICdlbWlzc2l2ZU1hcFRpbnQnKTtcbl9kZWZpbmVBbGlhcygnYW9WZXJ0ZXhDb2xvcicsICdhb01hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ2RpZmZ1c2VWZXJ0ZXhDb2xvcicsICdkaWZmdXNlTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnc3BlY3VsYXJWZXJ0ZXhDb2xvcicsICdzcGVjdWxhck1hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ2VtaXNzaXZlVmVydGV4Q29sb3InLCAnZW1pc3NpdmVNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdtZXRhbG5lc3NWZXJ0ZXhDb2xvcicsICdtZXRhbG5lc3NNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdnbG9zc1ZlcnRleENvbG9yJywgJ2dsb3NzTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnb3BhY2l0eVZlcnRleENvbG9yJywgJ29wYWNpdHlNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdsaWdodFZlcnRleENvbG9yJywgJ2xpZ2h0TWFwVmVydGV4Q29sb3InKTtcblxuX2RlZmluZUFsaWFzKCdzaGVlbkdsb3NzJywgJ3NoZWVuR2xvc3NpZXNzJyk7XG5fZGVmaW5lQWxpYXMoJ2NsZWFyQ29hdEdsb3NzJywgJ2NsZWFyQ29zdEdsb3NzaW5lc3MnKTtcblxuZnVuY3Rpb24gX2RlZmluZU9wdGlvbihuYW1lLCBuZXdOYW1lKSB7XG4gICAgaWYgKG5hbWUgIT09ICdjaHVua3MnICYmIG5hbWUgIT09ICdfcGFzcycgJiYgbmFtZSAhPT0gJ19pc0ZvcndhcmRQYXNzJykge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMucHJvdG90eXBlLCBuYW1lLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBHZXR0aW5nIHBjLk9wdGlvbnMjJHtuYW1lfSBoYXMgYmVlbiBkZXByZWNhdGVkIGFzIHRoZSBwcm9wZXJ0eSBoYXMgYmVlbiBtb3ZlZCB0byBwYy5PcHRpb25zLkxpdE9wdGlvbnMjJHtuZXdOYW1lIHx8IG5hbWV9LmApO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmxpdE9wdGlvbnNbbmV3TmFtZSB8fCBuYW1lXTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYFNldHRpbmcgcGMuT3B0aW9ucyMke25hbWV9IGhhcyBiZWVuIGRlcHJlY2F0ZWQgYXMgdGhlIHByb3BlcnR5IGhhcyBiZWVuIG1vdmVkIHRvIHBjLk9wdGlvbnMuTGl0T3B0aW9ucyMke25ld05hbWUgfHwgbmFtZX0uYCk7XG4gICAgICAgICAgICAgICAgdGhpcy5saXRPcHRpb25zW25ld05hbWUgfHwgbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuX2RlZmluZU9wdGlvbigncmVmcmFjdGlvbicsICd1c2VSZWZyYWN0aW9uJyk7XG5cbmNvbnN0IHRlbXBPcHRpb25zID0gbmV3IExpdE9wdGlvbnMoKTtcbmNvbnN0IGxpdE9wdGlvblByb3BlcnRpZXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh0ZW1wT3B0aW9ucyk7XG5mb3IgKGNvbnN0IGxpdE9wdGlvbiBpbiBsaXRPcHRpb25Qcm9wZXJ0aWVzKSB7XG4gICAgX2RlZmluZU9wdGlvbihsaXRPcHRpb25Qcm9wZXJ0aWVzW2xpdE9wdGlvbl0pO1xufVxuXG4vLyBBTklNQVRJT05cblxuZXhwb3J0IGNvbnN0IGFuaW0gPSB7XG4gICAgQW5pbWF0aW9uOiBBbmltYXRpb24sXG4gICAgS2V5OiBLZXksXG4gICAgTm9kZTogTm9kZSxcbiAgICBTa2VsZXRvbjogU2tlbGV0b25cbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuZ2V0RHVyYXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI2dldER1cmF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jZHVyYXRpb24gaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5kdXJhdGlvbjtcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuZ2V0TmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BbmltYXRpb24jZ2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQW5pbWF0aW9uI25hbWUgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5uYW1lO1xufTtcblxuQW5pbWF0aW9uLnByb3RvdHlwZS5nZXROb2RlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BbmltYXRpb24jZ2V0Tm9kZXMgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNub2RlcyBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLm5vZGVzO1xufTtcblxuQW5pbWF0aW9uLnByb3RvdHlwZS5zZXREdXJhdGlvbiA9IGZ1bmN0aW9uIChkdXJhdGlvbikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNzZXREdXJhdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQW5pbWF0aW9uI2R1cmF0aW9uIGluc3RlYWQuJyk7XG4gICAgdGhpcy5kdXJhdGlvbiA9IGR1cmF0aW9uO1xufTtcblxuQW5pbWF0aW9uLnByb3RvdHlwZS5zZXROYW1lID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BbmltYXRpb24jc2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQW5pbWF0aW9uI25hbWUgaW5zdGVhZC4nKTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLmdldEFuaW1hdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXRBbmltYXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2FuaW1hdGlvbiBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmFuaW1hdGlvbjtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXRDdXJyZW50VGltZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXRDdXJyZW50VGltZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jY3VycmVudFRpbWUgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5jdXJyZW50VGltZTtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXRMb29waW5nID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI2dldExvb3BpbmcgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2xvb3BpbmcgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5sb29waW5nO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLmdldE51bU5vZGVzID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI2dldE51bU5vZGVzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNudW1Ob2RlcyBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLm51bU5vZGVzO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLnNldEFuaW1hdGlvbiA9IGZ1bmN0aW9uIChhbmltYXRpb24pIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNzZXRBbmltYXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2FuaW1hdGlvbiBpbnN0ZWFkLicpO1xuICAgIHRoaXMuYW5pbWF0aW9uID0gYW5pbWF0aW9uO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLnNldEN1cnJlbnRUaW1lID0gZnVuY3Rpb24gKHRpbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNzZXRDdXJyZW50VGltZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jY3VycmVudFRpbWUgaW5zdGVhZC4nKTtcbiAgICB0aGlzLmN1cnJlbnRUaW1lID0gdGltZTtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5zZXRMb29waW5nID0gZnVuY3Rpb24gKGxvb3BpbmcpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNzZXRMb29waW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNsb29waW5nIGluc3RlYWQuJyk7XG4gICAgdGhpcy5sb29waW5nID0gbG9vcGluZztcbn07XG5cbi8vIFNPVU5EXG5cbmV4cG9ydCBjb25zdCBhdWRpbyA9IHtcbiAgICBBdWRpb01hbmFnZXI6IFNvdW5kTWFuYWdlcixcbiAgICBDaGFubmVsOiBDaGFubmVsLFxuICAgIENoYW5uZWwzZDogQ2hhbm5lbDNkLFxuICAgIExpc3RlbmVyOiBMaXN0ZW5lcixcbiAgICBTb3VuZDogU291bmRcbn07XG5cblNvdW5kTWFuYWdlci5wcm90b3R5cGUuZ2V0TGlzdGVuZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU291bmRNYW5hZ2VyI2dldExpc3RlbmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Tb3VuZE1hbmFnZXIjbGlzdGVuZXIgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5saXN0ZW5lcjtcbn07XG5cblNvdW5kTWFuYWdlci5wcm90b3R5cGUuZ2V0Vm9sdW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNvdW5kTWFuYWdlciNnZXRWb2x1bWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNvdW5kTWFuYWdlciN2b2x1bWUgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy52b2x1bWU7XG59O1xuXG5Tb3VuZE1hbmFnZXIucHJvdG90eXBlLnNldFZvbHVtZSA9IGZ1bmN0aW9uICh2b2x1bWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Tb3VuZE1hbmFnZXIjc2V0Vm9sdW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Tb3VuZE1hbmFnZXIjdm9sdW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy52b2x1bWUgPSB2b2x1bWU7XG59O1xuXG4vLyBBU1NFVFxuXG5leHBvcnQgY29uc3QgYXNzZXQgPSB7XG4gICAgQVNTRVRfQU5JTUFUSU9OOiAnYW5pbWF0aW9uJyxcbiAgICBBU1NFVF9BVURJTzogJ2F1ZGlvJyxcbiAgICBBU1NFVF9JTUFHRTogJ2ltYWdlJyxcbiAgICBBU1NFVF9KU09OOiAnanNvbicsXG4gICAgQVNTRVRfTU9ERUw6ICdtb2RlbCcsXG4gICAgQVNTRVRfTUFURVJJQUw6ICdtYXRlcmlhbCcsXG4gICAgQVNTRVRfVEVYVDogJ3RleHQnLFxuICAgIEFTU0VUX1RFWFRVUkU6ICd0ZXh0dXJlJyxcbiAgICBBU1NFVF9DVUJFTUFQOiAnY3ViZW1hcCcsXG4gICAgQVNTRVRfU0NSSVBUOiAnc2NyaXB0J1xufTtcblxuQXNzZXRSZWdpc3RyeS5wcm90b3R5cGUuZ2V0QXNzZXRCeUlkID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXNzZXRSZWdpc3RyeSNnZXRBc3NldEJ5SWQgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFzc2V0UmVnaXN0cnkjZ2V0IGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuZ2V0KGlkKTtcbn07XG5cbi8vIFhSXG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShYcklucHV0U291cmNlLnByb3RvdHlwZSwgJ3JheScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuWHJJbnB1dFNvdXJjZSNyYXkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlhySW5wdXRTb3VyY2UjZ2V0T3JpZ2luIGFuZCBwYy5YcklucHV0U291cmNlI2dldERpcmVjdGlvbiBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5fcmF5TG9jYWw7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShYcklucHV0U291cmNlLnByb3RvdHlwZSwgJ3Bvc2l0aW9uJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5YcklucHV0U291cmNlI3Bvc2l0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5YcklucHV0U291cmNlI2dldExvY2FsUG9zaXRpb24gaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsUG9zaXRpb247XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShYcklucHV0U291cmNlLnByb3RvdHlwZSwgJ3JvdGF0aW9uJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5YcklucHV0U291cmNlI3JvdGF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5YcklucHV0U291cmNlI2dldExvY2FsUm90YXRpb24gaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsUm90YXRpb247XG4gICAgfVxufSk7XG5cbi8vIElOUFVUXG5cbmV4cG9ydCBjb25zdCBpbnB1dCA9IHtcbiAgICBnZXRUb3VjaFRhcmdldENvb3JkczogZ2V0VG91Y2hUYXJnZXRDb29yZHMsXG4gICAgQ29udHJvbGxlcjogQ29udHJvbGxlcixcbiAgICBHYW1lUGFkczogR2FtZVBhZHMsXG4gICAgS2V5Ym9hcmQ6IEtleWJvYXJkLFxuICAgIEtleWJvYXJkRXZlbnQ6IEtleWJvYXJkRXZlbnQsXG4gICAgTW91c2U6IE1vdXNlLFxuICAgIE1vdXNlRXZlbnQ6IE1vdXNlRXZlbnQsXG4gICAgVG91Y2g6IFRvdWNoLFxuICAgIFRvdWNoRGV2aWNlOiBUb3VjaERldmljZSxcbiAgICBUb3VjaEV2ZW50OiBUb3VjaEV2ZW50XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRWxlbWVudElucHV0LnByb3RvdHlwZSwgJ3doZWVsJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy53aGVlbERlbHRhICogLTI7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShNb3VzZUV2ZW50LnByb3RvdHlwZSwgJ3doZWVsJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy53aGVlbERlbHRhICogLTI7XG4gICAgfVxufSk7XG5cbi8vIEZSQU1FV09SS1xuXG5leHBvcnQgY29uc3QgUklHSURCT0RZX1RZUEVfU1RBVElDID0gQk9EWVRZUEVfU1RBVElDO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9UWVBFX0RZTkFNSUMgPSBCT0RZVFlQRV9EWU5BTUlDO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9UWVBFX0tJTkVNQVRJQyA9IEJPRFlUWVBFX0tJTkVNQVRJQztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQ0ZfU1RBVElDX09CSkVDVCA9IEJPRFlGTEFHX1NUQVRJQ19PQkpFQ1Q7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0NGX0tJTkVNQVRJQ19PQkpFQ1QgPSBCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9DRl9OT1JFU1BPTlNFX09CSkVDVCA9IEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9BQ1RJVkVfVEFHID0gQk9EWVNUQVRFX0FDVElWRV9UQUc7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0lTTEFORF9TTEVFUElORyA9IEJPRFlTVEFURV9JU0xBTkRfU0xFRVBJTkc7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX1dBTlRTX0RFQUNUSVZBVElPTiA9IEJPRFlTVEFURV9XQU5UU19ERUFDVElWQVRJT047XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0RJU0FCTEVfREVBQ1RJVkFUSU9OID0gQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9ESVNBQkxFX1NJTVVMQVRJT04gPSBCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OO1xuXG5BcHBCYXNlLnByb3RvdHlwZS5pc0Z1bGxzY3JlZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNpc0Z1bGxzY3JlZW4gaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSBGdWxsc2NyZWVuIEFQSSBkaXJlY3RseS4nKTtcblxuICAgIHJldHVybiAhIWRvY3VtZW50LmZ1bGxzY3JlZW5FbGVtZW50O1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUuZW5hYmxlRnVsbHNjcmVlbiA9IGZ1bmN0aW9uIChlbGVtZW50LCBzdWNjZXNzLCBlcnJvcikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjZW5hYmxlRnVsbHNjcmVlbiBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIEZ1bGxzY3JlZW4gQVBJIGRpcmVjdGx5LicpO1xuXG4gICAgZWxlbWVudCA9IGVsZW1lbnQgfHwgdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXM7XG5cbiAgICAvLyBzdWNjZXNzIGNhbGxiYWNrXG4gICAgY29uc3QgcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3VjY2VzcygpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcyk7XG4gICAgfTtcblxuICAgIC8vIGVycm9yIGNhbGxiYWNrXG4gICAgY29uc3QgZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZXJyb3IoKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmVycm9yJywgZSk7XG4gICAgfTtcblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLCBzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5lcnJvcicsIGUsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBpZiAoZWxlbWVudC5yZXF1ZXN0RnVsbHNjcmVlbikge1xuICAgICAgICBlbGVtZW50LnJlcXVlc3RGdWxsc2NyZWVuKEVsZW1lbnQuQUxMT1dfS0VZQk9BUkRfSU5QVVQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVycm9yKCk7XG4gICAgfVxufTtcblxuQXBwQmFzZS5wcm90b3R5cGUuZGlzYWJsZUZ1bGxzY3JlZW4gPSBmdW5jdGlvbiAoc3VjY2Vzcykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjZGlzYWJsZUZ1bGxzY3JlZW4gaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSBGdWxsc2NyZWVuIEFQSSBkaXJlY3RseS4nKTtcblxuICAgIC8vIHN1Y2Nlc3MgY2FsbGJhY2tcbiAgICBjb25zdCBzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzdWNjZXNzKCk7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLCBzKTtcbiAgICB9O1xuXG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsIHMsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBkb2N1bWVudC5leGl0RnVsbHNjcmVlbigpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUuZ2V0U2NlbmVVcmwgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjZ2V0U2NlbmVVcmwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2Ujc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2ZpbmQgaW5zdGVhZC4nKTtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMuc2NlbmVzLmZpbmQobmFtZSk7XG4gICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIHJldHVybiBlbnRyeS51cmw7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUubG9hZFNjZW5lID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2xvYWRTY2VuZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZSNzY2VuZXMgYW5kIHBjLlNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5zY2VuZXMubG9hZFNjZW5lKHVybCwgY2FsbGJhY2spO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUubG9hZFNjZW5lSGllcmFyY2h5ID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2xvYWRTY2VuZUhpZXJhcmNoeSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZSNzY2VuZXMgYW5kIHBjLlNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lSGllcmFyY2h5IGluc3RlYWQuJyk7XG4gICAgdGhpcy5zY2VuZXMubG9hZFNjZW5lSGllcmFyY2h5KHVybCwgY2FsbGJhY2spO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUubG9hZFNjZW5lU2V0dGluZ3MgPSBmdW5jdGlvbiAodXJsLCBjYWxsYmFjaykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjbG9hZFNjZW5lU2V0dGluZ3MgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2Ujc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZVNldHRpbmdzIGluc3RlYWQuJyk7XG4gICAgdGhpcy5zY2VuZXMubG9hZFNjZW5lU2V0dGluZ3ModXJsLCBjYWxsYmFjayk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJNZXNoSW5zdGFuY2UgPSBmdW5jdGlvbiAobWVzaEluc3RhbmNlLCBvcHRpb25zKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZS5yZW5kZXJNZXNoSW5zdGFuY2UgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd01lc2hJbnN0YW5jZS4nKTtcbiAgICBjb25zdCBsYXllciA9IG9wdGlvbnM/LmxheWVyID8gb3B0aW9ucy5sYXllciA6IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcjtcbiAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChudWxsLCBudWxsLCBudWxsLCBtZXNoSW5zdGFuY2UsIGxheWVyKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLnJlbmRlck1lc2ggPSBmdW5jdGlvbiAobWVzaCwgbWF0ZXJpYWwsIG1hdHJpeCwgb3B0aW9ucykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UucmVuZGVyTWVzaCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZS5kcmF3TWVzaC4nKTtcbiAgICBjb25zdCBsYXllciA9IG9wdGlvbnM/LmxheWVyID8gb3B0aW9ucy5sYXllciA6IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcjtcbiAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChtYXRlcmlhbCwgbWF0cml4LCBtZXNoLCBudWxsLCBsYXllcik7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5fYWRkTGluZXMgPSBmdW5jdGlvbiAocG9zaXRpb25zLCBjb2xvcnMsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBsYXllciA9IChvcHRpb25zICYmIG9wdGlvbnMubGF5ZXIpID8gb3B0aW9ucy5sYXllciA6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSk7XG4gICAgY29uc3QgZGVwdGhUZXN0ID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5kZXB0aFRlc3QgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmRlcHRoVGVzdCA6IHRydWU7XG5cbiAgICBjb25zdCBiYXRjaCA9IHRoaXMuc2NlbmUuaW1tZWRpYXRlLmdldEJhdGNoKGxheWVyLCBkZXB0aFRlc3QpO1xuICAgIGJhdGNoLmFkZExpbmVzKHBvc2l0aW9ucywgY29sb3JzKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLnJlbmRlckxpbmUgPSBmdW5jdGlvbiAoc3RhcnQsIGVuZCwgY29sb3IpIHtcblxuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UucmVuZGVyTGluZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZS5kcmF3TGluZS4nKTtcblxuICAgIGxldCBlbmRDb2xvciA9IGNvbG9yO1xuICAgIGxldCBvcHRpb25zO1xuXG4gICAgY29uc3QgYXJnMyA9IGFyZ3VtZW50c1szXTtcbiAgICBjb25zdCBhcmc0ID0gYXJndW1lbnRzWzRdO1xuXG4gICAgaWYgKGFyZzMgaW5zdGFuY2VvZiBDb2xvcikge1xuICAgICAgICAvLyBwYXNzZWQgaW4gZW5kIGNvbG9yXG4gICAgICAgIGVuZENvbG9yID0gYXJnMztcblxuICAgICAgICBpZiAodHlwZW9mIGFyZzQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAvLyBjb21wYXRpYmlsaXR5OiBjb252ZXJ0IGxpbmViYXRjaCBpZCBpbnRvIG9wdGlvbnNcbiAgICAgICAgICAgIGlmIChhcmc0ID09PSBMSU5FQkFUQ0hfT1ZFUkxBWSkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IGZhbHNlXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoVGVzdDogdHJ1ZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB1c2UgcGFzc2VkIGluIG9wdGlvbnNcbiAgICAgICAgICAgIG9wdGlvbnMgPSBhcmc0O1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYXJnMyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgZW5kQ29sb3IgPSBjb2xvcjtcblxuICAgICAgICAvLyBjb21wYXRpYmlsaXR5OiBjb252ZXJ0IGxpbmViYXRjaCBpZCBpbnRvIG9wdGlvbnNcbiAgICAgICAgaWYgKGFyZzMgPT09IExJTkVCQVRDSF9PVkVSTEFZKSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgIGRlcHRoVGVzdDogZmFsc2VcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgIGRlcHRoVGVzdDogdHJ1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYXJnMykge1xuICAgICAgICAvLyBvcHRpb25zIHBhc3NlZCBpblxuICAgICAgICBvcHRpb25zID0gYXJnMztcbiAgICB9XG5cbiAgICB0aGlzLl9hZGRMaW5lcyhbc3RhcnQsIGVuZF0sIFtjb2xvciwgZW5kQ29sb3JdLCBvcHRpb25zKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLnJlbmRlckxpbmVzID0gZnVuY3Rpb24gKHBvc2l0aW9uLCBjb2xvciwgb3B0aW9ucykge1xuXG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZS5yZW5kZXJMaW5lcyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZS5kcmF3TGluZXMuJyk7XG5cbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgICAgLy8gZGVmYXVsdCBvcHRpb25cbiAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgZGVwdGhUZXN0OiB0cnVlXG4gICAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHksIExJTkVCQVRDSF9PVkVSTEFZIGxpbmVzIGhhdmUgZGVwdGh0ZXN0IGRpc2FibGVkXG4gICAgICAgIGlmIChvcHRpb25zID09PSBMSU5FQkFUQ0hfT1ZFUkxBWSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IGZhbHNlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBtdWx0aUNvbG9yID0gISFjb2xvci5sZW5ndGg7XG4gICAgaWYgKG11bHRpQ29sb3IpIHtcbiAgICAgICAgaWYgKHBvc2l0aW9uLmxlbmd0aCAhPT0gY29sb3IubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdyZW5kZXJMaW5lczogcG9zaXRpb24vY29sb3IgYXJyYXlzIGhhdmUgZGlmZmVyZW50IGxlbmd0aHMnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAocG9zaXRpb24ubGVuZ3RoICUgMiAhPT0gMCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdyZW5kZXJMaW5lczogYXJyYXkgbGVuZ3RoIGlzIG5vdCBkaXZpc2libGUgYnkgMicpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuX2FkZExpbmVzKHBvc2l0aW9uLCBjb2xvciwgb3B0aW9ucyk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5lbmFibGVWciA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2VuYWJsZVZSIGlzIGRlcHJlY2F0ZWQsIGFuZCBXZWJWUiBBUEkgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC4nKTtcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDYW1lcmFDb21wb25lbnQucHJvdG90eXBlLCAnbm9kZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQ2FtZXJhQ29tcG9uZW50I25vZGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkNhbWVyYUNvbXBvbmVudCNlbnRpdHkgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW50aXR5O1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTGlnaHRDb21wb25lbnQucHJvdG90eXBlLCAnZW5hYmxlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5MaWdodENvbXBvbmVudCNlbmFibGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkxpZ2h0Q29tcG9uZW50I2VuYWJsZWQgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW5hYmxlZDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkxpZ2h0Q29tcG9uZW50I2VuYWJsZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTGlnaHRDb21wb25lbnQjZW5hYmxlZCBpbnN0ZWFkLicpO1xuICAgICAgICB0aGlzLmVuYWJsZWQgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxuTW9kZWxDb21wb25lbnQucHJvdG90eXBlLnNldFZpc2libGUgPSBmdW5jdGlvbiAodmlzaWJsZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1vZGVsQ29tcG9uZW50I3NldFZpc2libGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1vZGVsQ29tcG9uZW50I2VuYWJsZWQgaW5zdGVhZC4nKTtcbiAgICB0aGlzLmVuYWJsZWQgPSB2aXNpYmxlO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE1vZGVsQ29tcG9uZW50LnByb3RvdHlwZSwgJ2FhYmInLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1vZGVsQ29tcG9uZW50I2FhYmIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1vZGVsQ29tcG9uZW50I2N1c3RvbUFhYmIgaW5zdGVhZCAtIHdoaWNoIGV4cGVjdHMgbG9jYWwgc3BhY2UgQUFCQiBpbnN0ZWFkIG9mIGEgd29ybGQgc3BhY2UgQUFCQi4nKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1vZGVsQ29tcG9uZW50I2FhYmIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1vZGVsQ29tcG9uZW50I2N1c3RvbUFhYmIgaW5zdGVhZCAtIHdoaWNoIGV4cGVjdHMgbG9jYWwgc3BhY2UgQUFCQiBpbnN0ZWFkIG9mIGEgd29ybGQgc3BhY2UgQUFCQi4nKTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFJlbmRlckNvbXBvbmVudC5wcm90b3R5cGUsICdhYWJiJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJDb21wb25lbnQjYWFiYiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmVuZGVyQ29tcG9uZW50I2N1c3RvbUFhYmIgaW5zdGVhZCAtIHdoaWNoIGV4cGVjdHMgbG9jYWwgc3BhY2UgQUFCQiBpbnN0ZWFkIG9mIGEgd29ybGQgc3BhY2UgQUFCQi4nKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJlbmRlckNvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJDb21wb25lbnQjY3VzdG9tQWFiYiBpbnN0ZWFkIC0gd2hpY2ggZXhwZWN0cyBsb2NhbCBzcGFjZSBBQUJCIGluc3RlYWQgb2YgYSB3b3JsZCBzcGFjZSBBQUJCLicpO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoUmlnaWRCb2R5Q29tcG9uZW50LnByb3RvdHlwZSwgJ2JvZHlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnQjYm9keVR5cGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJpZ2lkQm9keUNvbXBvbmVudCN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLnR5cGU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudCNib2R5VHlwZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmlnaWRCb2R5Q29tcG9uZW50I3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB9XG59KTtcblxuUmlnaWRCb2R5Q29tcG9uZW50LnByb3RvdHlwZS5zeW5jQm9keVRvRW50aXR5ID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudCNzeW5jQm9keVRvRW50aXR5IGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuJyk7XG4gICAgdGhpcy5fdXBkYXRlRHluYW1pYygpO1xufTtcblxuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtLnByb3RvdHlwZS5zZXRHcmF2aXR5ID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNzZXRHcmF2aXR5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jZ3Jhdml0eSBpbnN0ZWFkLicpO1xuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgdGhpcy5ncmF2aXR5LmNvcHkoYXJndW1lbnRzWzBdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdyYXZpdHkuc2V0KGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgIH1cbn07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGJhc2lzU2V0RG93bmxvYWRDb25maWcoZ2x1ZVVybCwgd2FzbVVybCwgZmFsbGJhY2tVcmwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5iYXNpc1NldERvd25sb2FkQ29uZmlnIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5iYXNpc0luaXRpYWxpemUgaW5zdGVhZC4nKTtcbiAgICBiYXNpc0luaXRpYWxpemUoe1xuICAgICAgICBnbHVlVXJsOiBnbHVlVXJsLFxuICAgICAgICB3YXNtVXJsOiB3YXNtVXJsLFxuICAgICAgICBmYWxsYmFja1VybDogZmFsbGJhY2tVcmwsXG4gICAgICAgIGxhenlJbml0OiB0cnVlXG4gICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVmaWx0ZXJDdWJlbWFwKG9wdGlvbnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5wcmVmaWx0ZXJDdWJlbWFwIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5lbnZMaWdodGluZyBpbnN0ZWFkLicpO1xufVxuIl0sIm5hbWVzIjpbImxvZyIsIndyaXRlIiwidGV4dCIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsImNvbnNvbGUiLCJvcGVuIiwidmVyc2lvbiIsInJldmlzaW9uIiwiaW5mbyIsImRlYnVnIiwiZXJyb3IiLCJ3YXJuaW5nIiwid2FybiIsImFsZXJ0IiwiYXNzZXJ0IiwiY29uZGl0aW9uIiwic3RyaW5nIiwiZW5kc1dpdGgiLCJzIiwic3VicyIsInN0YXJ0c1dpdGgiLCJUaW1lciIsImNvbnN0cnVjdG9yIiwiX2lzUnVubmluZyIsIl9hIiwiX2IiLCJzdGFydCIsIm5vdyIsInN0b3AiLCJnZXRNaWxsaXNlY29uZHMiLCJ0aW1lIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJDb2xvciIsInByb3RvdHlwZSIsImdldCIsIl9kYXRhIiwiRmxvYXQzMkFycmF5IiwiciIsImciLCJiIiwiYSIsIl9kYXRhMyIsImluaGVyaXRzIiwiU2VsZiIsIlN1cGVyIiwiVGVtcCIsIkZ1bmMiLCJhcmcxIiwiYXJnMiIsImFyZzMiLCJhcmc0IiwiYXJnNSIsImFyZzYiLCJhcmc3IiwiYXJnOCIsImNhbGwiLCJfc3VwZXIiLCJtYWtlQXJyYXkiLCJhcnIiLCJBcnJheSIsInNsaWNlIiwiY3JlYXRlU3R5bGUiLCJjc3NTdHJpbmciLCJyZXN1bHQiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJ0eXBlIiwic3R5bGVTaGVldCIsImNzc1RleHQiLCJhcHBlbmRDaGlsZCIsImNyZWF0ZVRleHROb2RlIiwibWF0aCIsIklOVl9MT0cyIiwiTWF0aCIsIkxPRzJFIiwiaW50VG9CeXRlcyIsImludFRvQnl0ZXMzMiIsImJ5dGVzVG9JbnQiLCJieXRlc1RvSW50MzIiLCJWZWMyIiwieCIsInkiLCJzY2FsZSIsIm11bFNjYWxhciIsIlZlYzMiLCJ6IiwiVmVjNCIsInciLCJzaGFwZSIsIkFhYmIiLCJCb3VuZGluZ0JveCIsIlNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiUGxhbmUiLCJpbnRlcnNlY3RSYXkiLCJpbnRlcnNlY3RzUmF5IiwiRnJ1c3R1bSIsInVwZGF0ZSIsInByb2plY3Rpb25NYXRyaXgiLCJ2aWV3TWF0cml4Iiwidmlld1Byb2oiLCJNYXQ0IiwibXVsMiIsInNldEZyb21NYXQ0IiwiRUxFTUVOVFRZUEVfSU5UOCIsIlRZUEVfSU5UOCIsIkVMRU1FTlRUWVBFX1VJTlQ4IiwiVFlQRV9VSU5UOCIsIkVMRU1FTlRUWVBFX0lOVDE2IiwiVFlQRV9JTlQxNiIsIkVMRU1FTlRUWVBFX1VJTlQxNiIsIlRZUEVfVUlOVDE2IiwiRUxFTUVOVFRZUEVfSU5UMzIiLCJUWVBFX0lOVDMyIiwiRUxFTUVOVFRZUEVfVUlOVDMyIiwiVFlQRV9VSU5UMzIiLCJFTEVNRU5UVFlQRV9GTE9BVDMyIiwiVFlQRV9GTE9BVDMyIiwiUElYRUxGT1JNQVRfTDhfQTgiLCJQSVhFTEZPUk1BVF9MQTgiLCJQSVhFTEZPUk1BVF9SNV9HNl9CNSIsIlBJWEVMRk9STUFUX1JHQjU2NSIsIlBJWEVMRk9STUFUX1I1X0c1X0I1X0ExIiwiUElYRUxGT1JNQVRfUkdCQTU1NTEiLCJQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNCIsIlBJWEVMRk9STUFUX1JHQkE0IiwiUElYRUxGT1JNQVRfUjhfRzhfQjgiLCJQSVhFTEZPUk1BVF9SR0I4IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIkJMRU5ETU9ERV9DT05TVEFOVF9DT0xPUiIsIkJMRU5ETU9ERV9DT05TVEFOVCIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQ09MT1IiLCJCTEVORE1PREVfT05FX01JTlVTX0NPTlNUQU5UIiwiQkxFTkRNT0RFX0NPTlNUQU5UX0FMUEhBIiwiQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVF9BTFBIQSIsIlVuc3VwcG9ydGVkQnJvd3NlckVycm9yIiwibWVzc2FnZSIsIm5hbWUiLCJFcnJvciIsIkNvbnRleHRDcmVhdGlvbkVycm9yIiwicHJvZ3JhbWxpYiIsImJlZ2luIiwiZHVtbXlGcmFnbWVudENvZGUiLCJTaGFkZXJVdGlscyIsImVuZCIsImZvZ0NvZGUiLCJnYW1tYUNvZGUiLCJwcmVjaXNpb25Db2RlIiwic2tpbkNvZGUiLCJ0b25lbWFwQ29kZSIsInZlcnNpb25Db2RlIiwiZ2Z4IiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19NSVJST1JFRF9SRVBFQVQiLCJBRERSRVNTX1JFUEVBVCIsIkJMRU5ETU9ERV9aRVJPIiwiQkxFTkRNT0RFX09ORSIsIkJMRU5ETU9ERV9TUkNfQ09MT1IiLCJCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUiIsIkJMRU5ETU9ERV9EU1RfQ09MT1IiLCJCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUiIsIkJMRU5ETU9ERV9TUkNfQUxQSEEiLCJCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFIiwiQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEiLCJCTEVORE1PREVfRFNUX0FMUEhBIiwiQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEiLCJCVUZGRVJfU1RBVElDIiwiQlVGRkVSX0RZTkFNSUMiLCJCVUZGRVJfU1RSRUFNIiwiQ1VMTEZBQ0VfTk9ORSIsIkNVTExGQUNFX0JBQ0siLCJDVUxMRkFDRV9GUk9OVCIsIkNVTExGQUNFX0ZST05UQU5EQkFDSyIsIkZJTFRFUl9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUiIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJJTkRFWEZPUk1BVF9VSU5UOCIsIklOREVYRk9STUFUX1VJTlQxNiIsIklOREVYRk9STUFUX1VJTlQzMiIsIlBSSU1JVElWRV9QT0lOVFMiLCJQUklNSVRJVkVfTElORVMiLCJQUklNSVRJVkVfTElORUxPT1AiLCJQUklNSVRJVkVfTElORVNUUklQIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsIlBSSU1JVElWRV9UUklTVFJJUCIsIlBSSU1JVElWRV9UUklGQU4iLCJTRU1BTlRJQ19QT1NJVElPTiIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX0NPTE9SIiwiU0VNQU5USUNfVEVYQ09PUkQiLCJTRU1BTlRJQ19URVhDT09SRDAiLCJTRU1BTlRJQ19URVhDT09SRDEiLCJTRU1BTlRJQ19BVFRSMCIsIlNFTUFOVElDX0FUVFIxIiwiU0VNQU5USUNfQVRUUjIiLCJTRU1BTlRJQ19BVFRSMyIsIlRFWFRVUkVMT0NLX1JFQUQiLCJURVhUVVJFTE9DS19XUklURSIsImRyYXdRdWFkV2l0aFNoYWRlciIsInNoYWRlckNodW5rcyIsIkRldmljZSIsIkdyYXBoaWNzRGV2aWNlIiwiSW5kZXhCdWZmZXIiLCJQcm9ncmFtTGlicmFyeSIsIlJlbmRlclRhcmdldCIsIlNjb3BlSWQiLCJTaGFkZXIiLCJTaGFkZXJJbnB1dCIsIldlYmdsU2hhZGVySW5wdXQiLCJUZXh0dXJlIiwiVmVydGV4QnVmZmVyIiwiVmVydGV4Rm9ybWF0IiwiVmVydGV4SXRlcmF0b3IiLCJfdmlld3BvcnQiLCJkcmF3RnVsbHNjcmVlblF1YWQiLCJkZXZpY2UiLCJ0YXJnZXQiLCJ2ZXJ0ZXhCdWZmZXIiLCJzaGFkZXIiLCJyZWN0Iiwidmlld3BvcnQiLCJ3aWR0aCIsImgiLCJoZWlnaHQiLCJzZXQiLCJwb3N0ZWZmZWN0IiwiY3JlYXRlRnVsbHNjcmVlblF1YWQiLCJxdWFkVmVydGV4QnVmZmVyIiwiUG9zdEVmZmVjdCIsIlBvc3RFZmZlY3RRdWV1ZSIsInRyYW5zZm9ybVZTIiwiZGVwcmVjYXRlZENodW5rcyIsImtleXMiLCJmb3JFYWNoIiwiY2h1bmtOYW1lIiwicmVwbGFjZW1lbnQiLCJ1c2VJbnN0ZWFkIiwibXNnIiwiZGVmaW5lUHJvcGVydGllcyIsIl9nbEZyYW1lQnVmZmVyIiwiaW1wbCIsInJnYm0iLCJnZXREZWZhdWx0SW5zdGFuY2luZ0Zvcm1hdCIsIkdyYXBoaWNzRGV2aWNlQWNjZXNzIiwiVEVYVFVSRVRZUEVfUkdCTSIsIlRFWFRVUkVUWVBFX0RFRkFVTFQiLCJzd2l6emxlR0dHUiIsIlRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIiwiX2dsVGV4dHVyZSIsImF1dG9NaXBtYXAiLCJfbWlwbWFwcyIsInZhbHVlIiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJzZXRQcm9ncmFtTGlicmFyeSIsImxpYiIsInJlbW92ZVNoYWRlckZyb21DYWNoZSIsInJlbW92ZUZyb21DYWNoZSIsIl90ZW1wQmxlbmRTdGF0ZSIsIkJsZW5kU3RhdGUiLCJfdGVtcERlcHRoU3RhdGUiLCJEZXB0aFN0YXRlIiwic2V0QmxlbmRGdW5jdGlvbiIsImJsZW5kU3JjIiwiYmxlbmREc3QiLCJjdXJyZW50QmxlbmRTdGF0ZSIsImJsZW5kU3RhdGUiLCJjb3B5Iiwic2V0Q29sb3JCbGVuZCIsImNvbG9yT3AiLCJzZXRBbHBoYUJsZW5kIiwiYWxwaGFPcCIsInNldEJsZW5kU3RhdGUiLCJzZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUiLCJibGVuZFNyY0FscGhhIiwiYmxlbmREc3RBbHBoYSIsInNldEJsZW5kRXF1YXRpb24iLCJibGVuZEVxdWF0aW9uIiwiY29sb3JTcmNGYWN0b3IiLCJjb2xvckRzdEZhY3RvciIsImFscGhhU3JjRmFjdG9yIiwiYWxwaGFEc3RGYWN0b3IiLCJzZXRCbGVuZEVxdWF0aW9uU2VwYXJhdGUiLCJibGVuZEFscGhhRXF1YXRpb24iLCJzZXRDb2xvcldyaXRlIiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsImdldEJsZW5kaW5nIiwiYmxlbmQiLCJzZXRCbGVuZGluZyIsImJsZW5kaW5nIiwic2V0RGVwdGhXcml0ZSIsImRlcHRoU3RhdGUiLCJzZXREZXB0aFN0YXRlIiwic2V0RGVwdGhGdW5jIiwiZnVuYyIsInNldERlcHRoVGVzdCIsInRlc3QiLCJnZXRDdWxsTW9kZSIsImN1bGxNb2RlIiwiUGhvbmdNYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJzY2VuZSIsInBhcnRpdGlvblNraW4iLCJwcm9jZWR1cmFsIiwiY2FsY3VsYXRlVGFuZ2VudHMiLCJjcmVhdGVNZXNoIiwiY3JlYXRlVG9ydXMiLCJjcmVhdGVDeWxpbmRlciIsImNyZWF0ZUNhcHN1bGUiLCJjcmVhdGVDb25lIiwiY3JlYXRlU3BoZXJlIiwiY3JlYXRlUGxhbmUiLCJjcmVhdGVCb3giLCJCYXNpY01hdGVyaWFsIiwiQ29tbWFuZCIsIkZvcndhcmRSZW5kZXJlciIsIkdyYXBoTm9kZSIsIk1hdGVyaWFsIiwiTWVzaCIsIk1lc2hJbnN0YW5jZSIsIk1vZGVsIiwiUGFydGljbGVFbWl0dGVyIiwiUGlja2VyIiwiUHJvamVjdGlvbiIsIk9SVEhPR1JBUEhJQyIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwiUEVSU1BFQ1RJVkUiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiU2NlbmUiLCJTa2luIiwiU2tpbkluc3RhbmNlIiwiZ2V0RGVmYXVsdE1hdGVyaWFsIiwiZ2V0QXBwbGljYXRpb24iLCJncmFwaGljc0RldmljZSIsInNpemUiLCJpbmRleCIsIl9wcmVmaWx0ZXJlZEN1YmVtYXBzIiwidXBkYXRlU2hhZGVycyIsIl9tb2RlbHMiLCJMYXllciIsInJ0IiwiX3JlbmRlclRhcmdldCIsIl9kaXJ0eUNhbWVyYXMiLCJfdXBkYXRlU2t5Ym94IiwiX3VwZGF0ZVNreSIsImFkZE1vZGVsIiwibW9kZWwiLCJjb250YWluc01vZGVsIiwibGF5ZXIiLCJsYXllcnMiLCJnZXRMYXllckJ5SWQiLCJMQVlFUklEX1dPUkxEIiwiYWRkTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZXMiLCJtb2RlbHMiLCJwdXNoIiwiYWRkU2hhZG93Q2FzdGVyIiwiYWRkU2hhZG93Q2FzdGVycyIsInJlbW92ZU1vZGVsIiwiaW5kZXhPZiIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJzcGxpY2UiLCJyZW1vdmVTaGFkb3dDYXN0ZXJzIiwiZ2V0TW9kZWxzIiwiQmF0Y2giLCJyZW5kZXJDb21wb3NpdGlvbiIsImNvbXAiLCJ1cGRhdGVTaGFkZXIiLCJtZXNoSW5zdGFuY2UiLCJvYmpEZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsIm1hdGVyaWFsIiwiX3NjZW5lIiwidXBkYXRlUGFzc1NoYWRlciIsInN5bmNBYWJiIiwiTW9ycGgiLCJnZXRUYXJnZXQiLCJ0YXJnZXRzIiwiX2RpcnRpZnkiLCJsb2NhbCIsIl9kaXJ0aWZ5TG9jYWwiLCJfZGlydGlmeVdvcmxkIiwiYWRkTGFiZWwiLCJsYWJlbCIsIl9sYWJlbHMiLCJnZXRMYWJlbHMiLCJoYXNMYWJlbCIsInJlbW92ZUxhYmVsIiwiZmluZEJ5TGFiZWwiLCJyZXN1bHRzIiwiaSIsIl9jaGlsZHJlbiIsImxlbmd0aCIsImdldENoaWxkcmVuIiwiY2hpbGRyZW4iLCJnZXROYW1lIiwiZ2V0UGF0aCIsInBhdGgiLCJnZXRSb290Iiwicm9vdCIsImdldFBhcmVudCIsInBhcmVudCIsInNldE5hbWUiLCJnZXRTaGFkZXIiLCJzZXRTaGFkZXIiLCJnbG9zcyIsIl9kZWZpbmVBbGlhcyIsIm5ld05hbWUiLCJvbGROYW1lIiwiX2RlZmluZU9wdGlvbiIsIlN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIiwibGl0T3B0aW9ucyIsInRlbXBPcHRpb25zIiwiTGl0T3B0aW9ucyIsImxpdE9wdGlvblByb3BlcnRpZXMiLCJnZXRPd25Qcm9wZXJ0eU5hbWVzIiwibGl0T3B0aW9uIiwiYW5pbSIsIkFuaW1hdGlvbiIsIktleSIsIk5vZGUiLCJTa2VsZXRvbiIsImdldER1cmF0aW9uIiwiZHVyYXRpb24iLCJnZXROb2RlcyIsIm5vZGVzIiwic2V0RHVyYXRpb24iLCJnZXRBbmltYXRpb24iLCJhbmltYXRpb24iLCJnZXRDdXJyZW50VGltZSIsImN1cnJlbnRUaW1lIiwiZ2V0TG9vcGluZyIsImxvb3BpbmciLCJnZXROdW1Ob2RlcyIsIm51bU5vZGVzIiwic2V0QW5pbWF0aW9uIiwic2V0Q3VycmVudFRpbWUiLCJzZXRMb29waW5nIiwiYXVkaW8iLCJBdWRpb01hbmFnZXIiLCJTb3VuZE1hbmFnZXIiLCJDaGFubmVsIiwiQ2hhbm5lbDNkIiwiTGlzdGVuZXIiLCJTb3VuZCIsImdldExpc3RlbmVyIiwibGlzdGVuZXIiLCJnZXRWb2x1bWUiLCJ2b2x1bWUiLCJzZXRWb2x1bWUiLCJhc3NldCIsIkFTU0VUX0FOSU1BVElPTiIsIkFTU0VUX0FVRElPIiwiQVNTRVRfSU1BR0UiLCJBU1NFVF9KU09OIiwiQVNTRVRfTU9ERUwiLCJBU1NFVF9NQVRFUklBTCIsIkFTU0VUX1RFWFQiLCJBU1NFVF9URVhUVVJFIiwiQVNTRVRfQ1VCRU1BUCIsIkFTU0VUX1NDUklQVCIsIkFzc2V0UmVnaXN0cnkiLCJnZXRBc3NldEJ5SWQiLCJpZCIsIlhySW5wdXRTb3VyY2UiLCJfcmF5TG9jYWwiLCJfbG9jYWxQb3NpdGlvbiIsIl9sb2NhbFJvdGF0aW9uIiwiaW5wdXQiLCJnZXRUb3VjaFRhcmdldENvb3JkcyIsIkNvbnRyb2xsZXIiLCJHYW1lUGFkcyIsIktleWJvYXJkIiwiS2V5Ym9hcmRFdmVudCIsIk1vdXNlIiwiTW91c2VFdmVudCIsIlRvdWNoIiwiVG91Y2hEZXZpY2UiLCJUb3VjaEV2ZW50IiwiRWxlbWVudElucHV0Iiwid2hlZWxEZWx0YSIsIlJJR0lEQk9EWV9UWVBFX1NUQVRJQyIsIkJPRFlUWVBFX1NUQVRJQyIsIlJJR0lEQk9EWV9UWVBFX0RZTkFNSUMiLCJCT0RZVFlQRV9EWU5BTUlDIiwiUklHSURCT0RZX1RZUEVfS0lORU1BVElDIiwiQk9EWVRZUEVfS0lORU1BVElDIiwiUklHSURCT0RZX0NGX1NUQVRJQ19PQkpFQ1QiLCJCT0RZRkxBR19TVEFUSUNfT0JKRUNUIiwiUklHSURCT0RZX0NGX0tJTkVNQVRJQ19PQkpFQ1QiLCJCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUIiwiUklHSURCT0RZX0NGX05PUkVTUE9OU0VfT0JKRUNUIiwiQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QiLCJSSUdJREJPRFlfQUNUSVZFX1RBRyIsIkJPRFlTVEFURV9BQ1RJVkVfVEFHIiwiUklHSURCT0RZX0lTTEFORF9TTEVFUElORyIsIkJPRFlTVEFURV9JU0xBTkRfU0xFRVBJTkciLCJSSUdJREJPRFlfV0FOVFNfREVBQ1RJVkFUSU9OIiwiQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTiIsIlJJR0lEQk9EWV9ESVNBQkxFX0RFQUNUSVZBVElPTiIsIkJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiIsIlJJR0lEQk9EWV9ESVNBQkxFX1NJTVVMQVRJT04iLCJCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OIiwiQXBwQmFzZSIsImlzRnVsbHNjcmVlbiIsImZ1bGxzY3JlZW5FbGVtZW50IiwiZW5hYmxlRnVsbHNjcmVlbiIsImVsZW1lbnQiLCJzdWNjZXNzIiwiY2FudmFzIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImUiLCJhZGRFdmVudExpc3RlbmVyIiwicmVxdWVzdEZ1bGxzY3JlZW4iLCJFbGVtZW50IiwiQUxMT1dfS0VZQk9BUkRfSU5QVVQiLCJkaXNhYmxlRnVsbHNjcmVlbiIsImV4aXRGdWxsc2NyZWVuIiwiZ2V0U2NlbmVVcmwiLCJlbnRyeSIsInNjZW5lcyIsImZpbmQiLCJ1cmwiLCJsb2FkU2NlbmUiLCJjYWxsYmFjayIsImxvYWRTY2VuZUhpZXJhcmNoeSIsImxvYWRTY2VuZVNldHRpbmdzIiwicmVuZGVyTWVzaEluc3RhbmNlIiwib3B0aW9ucyIsImRlZmF1bHREcmF3TGF5ZXIiLCJpbW1lZGlhdGUiLCJkcmF3TWVzaCIsInJlbmRlck1lc2giLCJtZXNoIiwibWF0cml4IiwiX2FkZExpbmVzIiwicG9zaXRpb25zIiwiY29sb3JzIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJkZXB0aFRlc3QiLCJ1bmRlZmluZWQiLCJiYXRjaCIsImdldEJhdGNoIiwiYWRkTGluZXMiLCJyZW5kZXJMaW5lIiwiY29sb3IiLCJlbmRDb2xvciIsImFyZ3VtZW50cyIsIkxJTkVCQVRDSF9PVkVSTEFZIiwicmVuZGVyTGluZXMiLCJwb3NpdGlvbiIsIm11bHRpQ29sb3IiLCJlbmFibGVWciIsIkNhbWVyYUNvbXBvbmVudCIsImVudGl0eSIsIkxpZ2h0Q29tcG9uZW50IiwiZW5hYmxlZCIsIk1vZGVsQ29tcG9uZW50Iiwic2V0VmlzaWJsZSIsInZpc2libGUiLCJSZW5kZXJDb21wb25lbnQiLCJSaWdpZEJvZHlDb21wb25lbnQiLCJzeW5jQm9keVRvRW50aXR5IiwiX3VwZGF0ZUR5bmFtaWMiLCJSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0iLCJzZXRHcmF2aXR5IiwiZ3Jhdml0eSIsImJhc2lzU2V0RG93bmxvYWRDb25maWciLCJnbHVlVXJsIiwid2FzbVVybCIsImZhbGxiYWNrVXJsIiwiYmFzaXNJbml0aWFsaXplIiwibGF6eUluaXQiLCJwcmVmaWx0ZXJDdWJlbWFwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3SEE7O0FBRU8sTUFBTUEsR0FBRyxHQUFHO0FBQ2ZDLEVBQUFBLEtBQUssRUFBRSxVQUFVQyxJQUFJLEVBQUU7QUFDbkJDLElBQUFBLEtBQUssQ0FBQ0MsVUFBVSxDQUFDLHNEQUFzRCxDQUFDLENBQUE7QUFDeEVDLElBQUFBLE9BQU8sQ0FBQ0wsR0FBRyxDQUFDRSxJQUFJLENBQUMsQ0FBQTtHQUNwQjtFQUVESSxJQUFJLEVBQUUsWUFBWTtBQUNkSCxJQUFBQSxLQUFLLENBQUNDLFVBQVUsQ0FBQyxxREFBcUQsQ0FBQyxDQUFBO0lBQ3ZFSixHQUFHLENBQUNDLEtBQUssQ0FBQyx3QkFBd0IsR0FBR00sT0FBTyxHQUFHLEdBQUcsR0FBR0MsUUFBUSxDQUFDLENBQUE7R0FDakU7QUFFREMsRUFBQUEsSUFBSSxFQUFFLFVBQVVQLElBQUksRUFBRTtBQUNsQkMsSUFBQUEsS0FBSyxDQUFDQyxVQUFVLENBQUMsc0RBQXNELENBQUMsQ0FBQTtBQUN4RUMsSUFBQUEsT0FBTyxDQUFDSSxJQUFJLENBQUMsV0FBVyxHQUFHUCxJQUFJLENBQUMsQ0FBQTtHQUNuQztBQUVEUSxFQUFBQSxLQUFLLEVBQUUsVUFBVVIsSUFBSSxFQUFFO0FBQ25CQyxJQUFBQSxLQUFLLENBQUNDLFVBQVUsQ0FBQyx3REFBd0QsQ0FBQyxDQUFBO0FBQzFFQyxJQUFBQSxPQUFPLENBQUNLLEtBQUssQ0FBQyxXQUFXLEdBQUdSLElBQUksQ0FBQyxDQUFBO0dBQ3BDO0FBRURTLEVBQUFBLEtBQUssRUFBRSxVQUFVVCxJQUFJLEVBQUU7QUFDbkJDLElBQUFBLEtBQUss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
