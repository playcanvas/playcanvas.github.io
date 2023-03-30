/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
  if (name !== 'chunks' && name !== '_pass') {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwcmVjYXRlZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2RlcHJlY2F0ZWQvZGVwcmVjYXRlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXZpc2lvbiwgdmVyc2lvbiB9IGZyb20gJy4uL2NvcmUvY29yZS5qcyc7XG5pbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuLi9jb3JlL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5pbXBvcnQgeyBGcnVzdHVtIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9mcnVzdHVtLmpzJztcbmltcG9ydCB7IFBsYW5lIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9wbGFuZS5qcyc7XG5cbmltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQkxFTkRNT0RFX1pFUk8sIEJMRU5ETU9ERV9PTkUsIEJMRU5ETU9ERV9TUkNfQ09MT1IsIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9EU1RfQ09MT1IsIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SLCBCTEVORE1PREVfU1JDX0FMUEhBLCBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFLFxuICAgIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBLCBCTEVORE1PREVfRFNUX0FMUEhBLCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICBCTEVORE1PREVfQ09OU1RBTlQsIEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQsXG4gICAgQlVGRkVSX1NUQVRJQywgQlVGRkVSX0RZTkFNSUMsIEJVRkZFUl9TVFJFQU0sXG4gICAgQ1VMTEZBQ0VfTk9ORSwgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfRlJPTlQsIENVTExGQUNFX0ZST05UQU5EQkFDSyxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQSVhFTEZPUk1BVF9MQTgsIFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTU1NTEsIFBJWEVMRk9STUFUX1JHQkE0LCBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICBQUklNSVRJVkVfUE9JTlRTLCBQUklNSVRJVkVfTElORVMsIFBSSU1JVElWRV9MSU5FTE9PUCwgUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTLCBQUklNSVRJVkVfVFJJU1RSSVAsIFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfQ09MT1IsIFNFTUFOVElDX1RFWENPT1JELCBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19BVFRSMCwgU0VNQU5USUNfQVRUUjEsIFNFTUFOVElDX0FUVFIyLCBTRU1BTlRJQ19BVFRSMyxcbiAgICBURVhUVVJFTE9DS19SRUFELCBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNLCBURVhUVVJFVFlQRV9TV0laWkxFR0dHUixcbiAgICBUWVBFX0lOVDgsIFRZUEVfVUlOVDgsIFRZUEVfSU5UMTYsIFRZUEVfVUlOVDE2LCBUWVBFX0lOVDMyLCBUWVBFX1VJTlQzMiwgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBiZWdpbiwgZW5kLCBmb2dDb2RlLCBnYW1tYUNvZGUsIHNraW5Db2RlLCB0b25lbWFwQ29kZSB9IGZyb20gJy4uL3NjZW5lL3NoYWRlci1saWIvcHJvZ3JhbXMvY29tbW9uLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4uL3NjZW5lL2dyYXBoaWNzL3F1YWQtcmVuZGVyLXV0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBJbmRleEJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2luZGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBQb3N0RWZmZWN0IH0gZnJvbSAnLi4vc2NlbmUvZ3JhcGhpY3MvcG9zdC1lZmZlY3QuanMnO1xuaW1wb3J0IHsgUG9zdEVmZmVjdFF1ZXVlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL3Bvc3QtZWZmZWN0LXF1ZXVlLmpzJztcbmltcG9ydCB7IFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnksIHNldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2NvcGVJZCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3Njb3BlLWlkLmpzJztcbmltcG9ydCB7IFNoYWRlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJnbFNoYWRlcklucHV0IH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtc2hhZGVyLWlucHV0LmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhJdGVyYXRvciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBTaGFkZXJVdGlscyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci11dGlscy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qcyc7XG5cbmltcG9ydCB7IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLCBMQVlFUklEX0lNTUVESUFURSwgTElORUJBVENIX09WRVJMQVksIExBWUVSSURfV09STEQgfSBmcm9tICcuLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgY2FsY3VsYXRlVGFuZ2VudHMsIGNyZWF0ZUJveCwgY3JlYXRlQ2Fwc3VsZSwgY3JlYXRlQ29uZSwgY3JlYXRlQ3lsaW5kZXIsIGNyZWF0ZU1lc2gsIGNyZWF0ZVBsYW5lLCBjcmVhdGVTcGhlcmUsIGNyZWF0ZVRvcnVzIH0gZnJvbSAnLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBwYXJ0aXRpb25Ta2luIH0gZnJvbSAnLi4vc2NlbmUvc2tpbi1wYXJ0aXRpb24uanMnO1xuaW1wb3J0IHsgQmFzaWNNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9iYXNpYy1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBGb3J3YXJkUmVuZGVyZXIgfSBmcm9tICcuLi9zY2VuZS9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UsIENvbW1hbmQgfSBmcm9tICcuLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgUGFydGljbGVFbWl0dGVyIH0gZnJvbSAnLi4vc2NlbmUvcGFydGljbGUtc3lzdGVtL3BhcnRpY2xlLWVtaXR0ZXIuanMnO1xuaW1wb3J0IHsgUGlja2VyIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2dyYXBoaWNzL3BpY2tlci5qcyc7XG5pbXBvcnQgeyBTY2VuZSB9IGZyb20gJy4uL3NjZW5lL3NjZW5lLmpzJztcbmltcG9ydCB7IFNraW4gfSBmcm9tICcuLi9zY2VuZS9za2luLmpzJztcbmltcG9ydCB7IFNraW5JbnN0YW5jZSB9IGZyb20gJy4uL3NjZW5lL3NraW4taW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBCYXRjaCB9IGZyb20gJy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9kZWZhdWx0LW1hdGVyaWFsLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTGl0T3B0aW9ucyB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9saXQtb3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4uL3NjZW5lL2xheWVyLmpzJztcblxuaW1wb3J0IHsgQW5pbWF0aW9uLCBLZXksIE5vZGUgfSBmcm9tICcuLi9zY2VuZS9hbmltYXRpb24vYW5pbWF0aW9uLmpzJztcbmltcG9ydCB7IFNrZWxldG9uIH0gZnJvbSAnLi4vc2NlbmUvYW5pbWF0aW9uL3NrZWxldG9uLmpzJztcblxuaW1wb3J0IHsgQ2hhbm5lbCB9IGZyb20gJy4uL3BsYXRmb3JtL2F1ZGlvL2NoYW5uZWwuanMnO1xuaW1wb3J0IHsgQ2hhbm5lbDNkIH0gZnJvbSAnLi4vcGxhdGZvcm0vYXVkaW8vY2hhbm5lbDNkLmpzJztcbmltcG9ydCB7IExpc3RlbmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vc291bmQvbGlzdGVuZXIuanMnO1xuaW1wb3J0IHsgU291bmQgfSBmcm9tICcuLi9wbGF0Zm9ybS9zb3VuZC9zb3VuZC5qcyc7XG5pbXBvcnQgeyBTb3VuZE1hbmFnZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9zb3VuZC9tYW5hZ2VyLmpzJztcblxuaW1wb3J0IHsgQXNzZXRSZWdpc3RyeSB9IGZyb20gJy4uL2ZyYW1ld29yay9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5cbmltcG9ydCB7IFhySW5wdXRTb3VyY2UgfSBmcm9tICcuLi9mcmFtZXdvcmsveHIveHItaW5wdXQtc291cmNlLmpzJztcblxuaW1wb3J0IHsgQ29udHJvbGxlciB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L2NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgRWxlbWVudElucHV0IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnO1xuaW1wb3J0IHsgR2FtZVBhZHMgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9nYW1lLXBhZHMuanMnO1xuaW1wb3J0IHsgS2V5Ym9hcmQgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9rZXlib2FyZC5qcyc7XG5pbXBvcnQgeyBLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQva2V5Ym9hcmQtZXZlbnQuanMnO1xuaW1wb3J0IHsgTW91c2UgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9tb3VzZS5qcyc7XG5pbXBvcnQgeyBNb3VzZUV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UtZXZlbnQuanMnO1xuaW1wb3J0IHsgVG91Y2hEZXZpY2UgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC90b3VjaC1kZXZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0VG91Y2hUYXJnZXRDb29yZHMsIFRvdWNoLCBUb3VjaEV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvdG91Y2gtZXZlbnQuanMnO1xuXG5pbXBvcnQgeyBBcHBCYXNlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2FwcC1iYXNlLmpzJztcbmltcG9ydCB7IGdldEFwcGxpY2F0aW9uIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2dsb2JhbHMuanMnO1xuaW1wb3J0IHsgQ2FtZXJhQ29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBMaWdodENvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2xpZ2h0L2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBNb2RlbENvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL21vZGVsL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBSZW5kZXJDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yZW5kZXIvY29tcG9uZW50LmpzJztcbmltcG9ydCB7XG4gICAgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCwgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QsIEJPRFlGTEFHX1NUQVRJQ19PQkpFQ1QsXG4gICAgQk9EWVNUQVRFX0FDVElWRV9UQUcsIEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiwgQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiwgQk9EWVNUQVRFX0lTTEFORF9TTEVFUElORywgQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTixcbiAgICBCT0RZVFlQRV9EWU5BTUlDLCBCT0RZVFlQRV9LSU5FTUFUSUMsIEJPRFlUWVBFX1NUQVRJQ1xufSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L3N5c3RlbS5qcyc7XG5pbXBvcnQgeyBiYXNpc0luaXRpYWxpemUgfSBmcm9tICcuLi9mcmFtZXdvcmsvaGFuZGxlcnMvYmFzaXMuanMnO1xuXG4vLyBDT1JFXG5cbmV4cG9ydCBjb25zdCBsb2cgPSB7XG4gICAgd3JpdGU6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy53cml0ZSBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5sb2cgaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS5sb2codGV4dCk7XG4gICAgfSxcblxuICAgIG9wZW46IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLm9wZW4gaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGxvZy53cml0ZSgnUG93ZXJlZCBieSBQbGF5Q2FudmFzICcgKyB2ZXJzaW9uICsgJyAnICsgcmV2aXNpb24pO1xuICAgIH0sXG5cbiAgICBpbmZvOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuaW5mbyBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5pbmZvIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUuaW5mbygnSU5GTzogICAgJyArIHRleHQpO1xuICAgIH0sXG5cbiAgICBkZWJ1ZzogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmRlYnVnIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLmRlYnVnIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoJ0RFQlVHOiAgICcgKyB0ZXh0KTtcbiAgICB9LFxuXG4gICAgZXJyb3I6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5lcnJvciBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5lcnJvciBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFUlJPUjogICAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIHdhcm5pbmc6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy53YXJuaW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLndhcm4gaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS53YXJuKCdXQVJOSU5HOiAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIGFsZXJ0OiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuYWxlcnQgaXMgZGVwcmVjYXRlZC4gVXNlIGFsZXJ0IGluc3RlYWQuJyk7XG4gICAgICAgIGxvZy53cml0ZSgnQUxFUlQ6ICAgJyArIHRleHQpO1xuICAgICAgICBhbGVydCh0ZXh0KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1hbGVydFxuICAgIH0sXG5cbiAgICBhc3NlcnQ6IGZ1bmN0aW9uIChjb25kaXRpb24sIHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmFzc2VydCBpcyBkZXByZWNhdGVkLiBVc2UgYSBjb25kaXRpb25hbCBwbHVzIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGlmIChjb25kaXRpb24gPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBsb2cud3JpdGUoJ0FTU0VSVDogICcgKyB0ZXh0KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnN0cmluZy5lbmRzV2l0aCA9IGZ1bmN0aW9uIChzLCBzdWJzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuc3RyaW5nLmVuZHNXaXRoIGlzIGRlcHJlY2F0ZWQuIFVzZSBTdHJpbmcjZW5kc1dpdGggaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gcy5lbmRzV2l0aChzdWJzKTtcbn07XG5cbnN0cmluZy5zdGFydHNXaXRoID0gZnVuY3Rpb24gKHMsIHN1YnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5zdHJpbmcuc3RhcnRzV2l0aCBpcyBkZXByZWNhdGVkLiBVc2UgU3RyaW5nI3N0YXJ0c1dpdGggaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gcy5zdGFydHNXaXRoKHN1YnMpO1xufTtcblxuY2xhc3MgVGltZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLl9pc1J1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYSA9IDA7XG4gICAgICAgIHRoaXMuX2IgPSAwO1xuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICB0aGlzLl9pc1J1bm5pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9hID0gbm93KCk7XG4gICAgfVxuXG4gICAgc3RvcCgpIHtcbiAgICAgICAgdGhpcy5faXNSdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2IgPSBub3coKTtcbiAgICB9XG5cbiAgICBnZXRNaWxsaXNlY29uZHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iIC0gdGhpcy5fYTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCB0aW1lID0ge1xuICAgIG5vdzogbm93LFxuICAgIFRpbWVyOiBUaW1lclxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkNvbG9yI2RhdGEgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIGNvbG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy5yO1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy5iO1xuICAgICAgICB0aGlzLl9kYXRhWzNdID0gdGhpcy5hO1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Db2xvciNkYXRhMyBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgY29sb3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEzKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhMyA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YTNbMF0gPSB0aGlzLnI7XG4gICAgICAgIHRoaXMuX2RhdGEzWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhM1syXSA9IHRoaXMuYjtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGEzO1xuICAgIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gaW5oZXJpdHMoU2VsZiwgU3VwZXIpIHtcbiAgICBjb25zdCBUZW1wID0gZnVuY3Rpb24gKCkge307XG4gICAgY29uc3QgRnVuYyA9IGZ1bmN0aW9uIChhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KSB7XG4gICAgICAgIFN1cGVyLmNhbGwodGhpcywgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCk7XG4gICAgICAgIFNlbGYuY2FsbCh0aGlzLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KTtcbiAgICAgICAgLy8gdGhpcy5jb25zdHJ1Y3RvciA9IFNlbGY7XG4gICAgfTtcbiAgICBGdW5jLl9zdXBlciA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBUZW1wLnByb3RvdHlwZSA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBGdW5jLnByb3RvdHlwZSA9IG5ldyBUZW1wKCk7XG5cbiAgICByZXR1cm4gRnVuYztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VBcnJheShhcnIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5tYWtlQXJyYXkgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gVXNlIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFycik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdHlsZShjc3NTdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHJlc3VsdC50eXBlID0gJ3RleHQvY3NzJztcbiAgICBpZiAocmVzdWx0LnN0eWxlU2hlZXQpIHtcbiAgICAgICAgcmVzdWx0LnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzc1N0cmluZztcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzU3RyaW5nKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gTUFUSFxuXG5tYXRoLklOVl9MT0cyID0gTWF0aC5MT0cyRTtcblxubWF0aC5pbnRUb0J5dGVzID0gbWF0aC5pbnRUb0J5dGVzMzI7XG5tYXRoLmJ5dGVzVG9JbnQgPSBtYXRoLmJ5dGVzVG9JbnQzMjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzIucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjMiNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWMyLnByb3RvdHlwZS5zY2FsZSA9IFZlYzIucHJvdG90eXBlLm11bFNjYWxhcjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzMucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjMyNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHRoaXMuX2RhdGFbMl0gPSB0aGlzLno7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWMzLnByb3RvdHlwZS5zY2FsZSA9IFZlYzMucHJvdG90eXBlLm11bFNjYWxhcjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzQucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjNCNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHRoaXMuX2RhdGFbMl0gPSB0aGlzLno7XG4gICAgICAgIHRoaXMuX2RhdGFbM10gPSB0aGlzLnc7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWM0LnByb3RvdHlwZS5zY2FsZSA9IFZlYzQucHJvdG90eXBlLm11bFNjYWxhcjtcblxuLy8gU0hBUEVcblxuZXhwb3J0IGNvbnN0IHNoYXBlID0ge1xuICAgIEFhYmI6IEJvdW5kaW5nQm94LFxuICAgIFNwaGVyZTogQm91bmRpbmdTcGhlcmUsXG4gICAgUGxhbmU6IFBsYW5lXG59O1xuXG5Cb3VuZGluZ1NwaGVyZS5wcm90b3R5cGUuaW50ZXJzZWN0UmF5ID0gQm91bmRpbmdTcGhlcmUucHJvdG90eXBlLmludGVyc2VjdHNSYXk7XG5cbkZydXN0dW0ucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChwcm9qZWN0aW9uTWF0cml4LCB2aWV3TWF0cml4KSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuRnJ1c3R1bSN1cGRhdGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkZydXN0dW0jc2V0RnJvbU1hdDQgaW5zdGVhZC4nKTtcblxuICAgIGNvbnN0IHZpZXdQcm9qID0gbmV3IE1hdDQoKTtcblxuICAgIHZpZXdQcm9qLm11bDIocHJvamVjdGlvbk1hdHJpeCwgdmlld01hdHJpeCk7XG5cbiAgICB0aGlzLnNldEZyb21NYXQ0KHZpZXdQcm9qKTtcbn07XG5cbi8vIEdSQVBISUNTXG5cbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTlQ4ID0gVFlQRV9JTlQ4O1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQ4ID0gVFlQRV9VSU5UODtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTlQxNiA9IFRZUEVfSU5UMTY7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfVUlOVDE2ID0gVFlQRV9VSU5UMTY7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfSU5UMzIgPSBUWVBFX0lOVDMyO1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQzMiA9IFRZUEVfVUlOVDMyO1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX0ZMT0FUMzIgPSBUWVBFX0ZMT0FUMzI7XG5cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9MOF9BOCA9IFBJWEVMRk9STUFUX0xBODtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SNV9HNl9CNSA9IFBJWEVMRk9STUFUX1JHQjU2NTtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMSA9IFBJWEVMRk9STUFUX1JHQkE1NTUxO1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I0X0c0X0I0X0E0ID0gUElYRUxGT1JNQVRfUkdCQTQ7XG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUjhfRzhfQjggPSBQSVhFTEZPUk1BVF9SR0I4O1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4ID0gUElYRUxGT1JNQVRfUkdCQTg7XG5cbmV4cG9ydCBjb25zdCBCTEVORE1PREVfQ09OU1RBTlRfQ09MT1IgPSBCTEVORE1PREVfQ09OU1RBTlQ7XG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVF9DT0xPUiA9IEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQ7XG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX0NPTlNUQU5UX0FMUEhBID0gQkxFTkRNT0RFX0NPTlNUQU5UO1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEEgPSBCTEVORE1PREVfT05FX01JTlVTX0NPTlNUQU5UO1xuXG5leHBvcnQgZnVuY3Rpb24gVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgZnVuY3Rpb24gQ29udGV4dENyZWF0aW9uRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdDb250ZXh0Q3JlYXRpb25FcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuQ29udGV4dENyZWF0aW9uRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgY29uc3QgcHJvZ3JhbWxpYiA9IHtcbiAgICBiZWdpbjogYmVnaW4sXG4gICAgZHVtbXlGcmFnbWVudENvZGU6IFNoYWRlclV0aWxzLmR1bW15RnJhZ21lbnRDb2RlLFxuICAgIGVuZDogZW5kLFxuICAgIGZvZ0NvZGU6IGZvZ0NvZGUsXG4gICAgZ2FtbWFDb2RlOiBnYW1tYUNvZGUsXG4gICAgcHJlY2lzaW9uQ29kZTogU2hhZGVyVXRpbHMucHJlY2lzaW9uQ29kZSxcbiAgICBza2luQ29kZTogc2tpbkNvZGUsXG4gICAgdG9uZW1hcENvZGU6IHRvbmVtYXBDb2RlLFxuICAgIHZlcnNpb25Db2RlOiBTaGFkZXJVdGlscy52ZXJzaW9uQ29kZVxufTtcblxuZXhwb3J0IGNvbnN0IGdmeCA9IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDogQUREUkVTU19NSVJST1JFRF9SRVBFQVQsXG4gICAgQUREUkVTU19SRVBFQVQ6IEFERFJFU1NfUkVQRUFULFxuICAgIEJMRU5ETU9ERV9aRVJPOiBCTEVORE1PREVfWkVSTyxcbiAgICBCTEVORE1PREVfT05FOiBCTEVORE1PREVfT05FLFxuICAgIEJMRU5ETU9ERV9TUkNfQ09MT1I6IEJMRU5ETU9ERV9TUkNfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9EU1RfQ09MT1I6IEJMRU5ETU9ERV9EU1RfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9TUkNfQUxQSEE6IEJMRU5ETU9ERV9TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURTogQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX0RTVF9BTFBIQTogQkxFTkRNT0RFX0RTVF9BTFBIQSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEsXG4gICAgQlVGRkVSX1NUQVRJQzogQlVGRkVSX1NUQVRJQyxcbiAgICBCVUZGRVJfRFlOQU1JQzogQlVGRkVSX0RZTkFNSUMsXG4gICAgQlVGRkVSX1NUUkVBTTogQlVGRkVSX1NUUkVBTSxcbiAgICBDVUxMRkFDRV9OT05FOiBDVUxMRkFDRV9OT05FLFxuICAgIENVTExGQUNFX0JBQ0s6IENVTExGQUNFX0JBQ0ssXG4gICAgQ1VMTEZBQ0VfRlJPTlQ6IENVTExGQUNFX0ZST05ULFxuICAgIENVTExGQUNFX0ZST05UQU5EQkFDSzogQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLLFxuICAgIEVMRU1FTlRUWVBFX0lOVDg6IFRZUEVfSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9VSU5UODogVFlQRV9VSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9JTlQxNjogVFlQRV9JTlQxNixcbiAgICBFTEVNRU5UVFlQRV9VSU5UMTY6IFRZUEVfVUlOVDE2LFxuICAgIEVMRU1FTlRUWVBFX0lOVDMyOiBUWVBFX0lOVDMyLFxuICAgIEVMRU1FTlRUWVBFX1VJTlQzMjogVFlQRV9VSU5UMzIsXG4gICAgRUxFTUVOVFRZUEVfRkxPQVQzMjogVFlQRV9GTE9BVDMyLFxuICAgIEZJTFRFUl9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVCxcbiAgICBGSUxURVJfTElORUFSOiBGSUxURVJfTElORUFSLFxuICAgIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCxcbiAgICBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q6IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSOiBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDg6IElOREVYRk9STUFUX1VJTlQ4LFxuICAgIElOREVYRk9STUFUX1VJTlQxNjogSU5ERVhGT1JNQVRfVUlOVDE2LFxuICAgIElOREVYRk9STUFUX1VJTlQzMjogSU5ERVhGT1JNQVRfVUlOVDMyLFxuICAgIFBJWEVMRk9STUFUX1JHQjU2NTogUElYRUxGT1JNQVRfUkdCNTY1LFxuICAgIFBJWEVMRk9STUFUX1JHQjg6IFBJWEVMRk9STUFUX1JHQjgsXG4gICAgUElYRUxGT1JNQVRfUkdCQTg6IFBJWEVMRk9STUFUX1JHQkE4LFxuICAgIFBSSU1JVElWRV9QT0lOVFM6IFBSSU1JVElWRV9QT0lOVFMsXG4gICAgUFJJTUlUSVZFX0xJTkVTOiBQUklNSVRJVkVfTElORVMsXG4gICAgUFJJTUlUSVZFX0xJTkVMT09QOiBQUklNSVRJVkVfTElORUxPT1AsXG4gICAgUFJJTUlUSVZFX0xJTkVTVFJJUDogUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTOiBQUklNSVRJVkVfVFJJQU5HTEVTLFxuICAgIFBSSU1JVElWRV9UUklTVFJJUDogUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFBSSU1JVElWRV9UUklGQU46IFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT046IFNFTUFOVElDX1BPU0lUSU9OLFxuICAgIFNFTUFOVElDX05PUk1BTDogU0VNQU5USUNfTk9STUFMLFxuICAgIFNFTUFOVElDX0NPTE9SOiBTRU1BTlRJQ19DT0xPUixcbiAgICBTRU1BTlRJQ19URVhDT09SRDogU0VNQU5USUNfVEVYQ09PUkQsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQwOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgU0VNQU5USUNfQVRUUjA6IFNFTUFOVElDX0FUVFIwLFxuICAgIFNFTUFOVElDX0FUVFIxOiBTRU1BTlRJQ19BVFRSMSxcbiAgICBTRU1BTlRJQ19BVFRSMjogU0VNQU5USUNfQVRUUjIsXG4gICAgU0VNQU5USUNfQVRUUjM6IFNFTUFOVElDX0FUVFIzLFxuICAgIFRFWFRVUkVMT0NLX1JFQUQ6IFRFWFRVUkVMT0NLX1JFQUQsXG4gICAgVEVYVFVSRUxPQ0tfV1JJVEU6IFRFWFRVUkVMT0NLX1dSSVRFLFxuICAgIGRyYXdRdWFkV2l0aFNoYWRlcjogZHJhd1F1YWRXaXRoU2hhZGVyLFxuICAgIHByb2dyYW1saWI6IHByb2dyYW1saWIsXG4gICAgc2hhZGVyQ2h1bmtzOiBzaGFkZXJDaHVua3MsXG4gICAgQ29udGV4dENyZWF0aW9uRXJyb3I6IENvbnRleHRDcmVhdGlvbkVycm9yLFxuICAgIERldmljZTogR3JhcGhpY3NEZXZpY2UsXG4gICAgSW5kZXhCdWZmZXI6IEluZGV4QnVmZmVyLFxuICAgIFByb2dyYW1MaWJyYXJ5OiBQcm9ncmFtTGlicmFyeSxcbiAgICBSZW5kZXJUYXJnZXQ6IFJlbmRlclRhcmdldCxcbiAgICBTY29wZUlkOiBTY29wZUlkLFxuICAgIFNoYWRlcjogU2hhZGVyLFxuICAgIFNoYWRlcklucHV0OiBXZWJnbFNoYWRlcklucHV0LFxuICAgIFRleHR1cmU6IFRleHR1cmUsXG4gICAgVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3I6IFVuc3VwcG9ydGVkQnJvd3NlckVycm9yLFxuICAgIFZlcnRleEJ1ZmZlcjogVmVydGV4QnVmZmVyLFxuICAgIFZlcnRleEZvcm1hdDogVmVydGV4Rm9ybWF0LFxuICAgIFZlcnRleEl0ZXJhdG9yOiBWZXJ0ZXhJdGVyYXRvclxufTtcblxuY29uc3QgX3ZpZXdwb3J0ID0gbmV3IFZlYzQoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGRyYXdGdWxsc2NyZWVuUXVhZChkZXZpY2UsIHRhcmdldCwgdmVydGV4QnVmZmVyLCBzaGFkZXIsIHJlY3QpIHtcblxuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLmRyYXdGdWxsc2NyZWVuUXVhZCBpcyBkZXByZWNhdGVkLiBXaGVuIHVzZWQgYXMgcGFydCBvZiBQb3N0RWZmZWN0LCB1c2UgUG9zdEVmZmVjdCNkcmF3UXVhZCBpbnN0ZWFkLmApO1xuXG4gICAgLy8gY29udmVydCByZWN0IGluIG5vcm1hbGl6ZWQgc3BhY2UgdG8gdmlld3BvcnQgaW4gcGl4ZWwgc3BhY2VcbiAgICBsZXQgdmlld3BvcnQ7XG4gICAgaWYgKHJlY3QpIHtcbiAgICAgICAgY29uc3QgdyA9IHRhcmdldCA/IHRhcmdldC53aWR0aCA6IGRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3QgaCA9IHRhcmdldCA/IHRhcmdldC5oZWlnaHQgOiBkZXZpY2UuaGVpZ2h0O1xuICAgICAgICB2aWV3cG9ydCA9IF92aWV3cG9ydC5zZXQocmVjdC54ICogdywgcmVjdC55ICogaCwgcmVjdC56ICogdywgcmVjdC53ICogaCk7XG4gICAgfVxuXG4gICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgdGFyZ2V0LCBzaGFkZXIsIHZpZXdwb3J0KTtcbn1cblxuZXhwb3J0IGNvbnN0IHBvc3RlZmZlY3QgPSB7XG4gICAgY3JlYXRlRnVsbHNjcmVlblF1YWQ6IChkZXZpY2UpID0+IHtcbiAgICAgICAgcmV0dXJuIGRldmljZS5xdWFkVmVydGV4QnVmZmVyO1xuICAgIH0sXG4gICAgZHJhd0Z1bGxzY3JlZW5RdWFkOiBkcmF3RnVsbHNjcmVlblF1YWQsXG4gICAgUG9zdEVmZmVjdDogUG9zdEVmZmVjdCxcbiAgICBQb3N0RWZmZWN0UXVldWU6IFBvc3RFZmZlY3RRdWV1ZVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNoYWRlckNodW5rcywgJ3RyYW5zZm9ybVNraW5uZWRWUycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcjZGVmaW5lIFNLSU5cXG4nICsgc2hhZGVyQ2h1bmtzLnRyYW5zZm9ybVZTO1xuICAgIH1cbn0pO1xuXG5jb25zdCBkZXByZWNhdGVkQ2h1bmtzID0ge1xuICAgICdhbWJpZW50UHJlZmlsdGVyZWRDdWJlLmZyYWcnOiAnYW1iaWVudEVudi5mcmFnJyxcbiAgICAnYW1iaWVudFByZWZpbHRlcmVkQ3ViZUxvZC5mcmFnJzogJ2FtYmllbnRFbnYuZnJhZycsXG4gICAgJ2RwQXRsYXNRdWFkLmZyYWcnOiBudWxsLFxuICAgICdnZW5QYXJhYm9sb2lkLmZyYWcnOiBudWxsLFxuICAgICdwcmVmaWx0ZXJDdWJlbWFwLmZyYWcnOiBudWxsLFxuICAgICdyZWZsZWN0aW9uRHBBdGxhcy5mcmFnJzogJ3JlZmxlY3Rpb25FbnYuZnJhZycsXG4gICAgJ3JlZmxlY3Rpb25QcmVmaWx0ZXJlZEN1YmUuZnJhZyc6ICdyZWZsZWN0aW9uRW52LmZyYWcnLFxuICAgICdyZWZsZWN0aW9uUHJlZmlsdGVyZWRDdWJlTG9kLmZyYWcnOiAncmVmbGVjdGlvbkVudi5mcmFnJ1xufTtcblxuT2JqZWN0LmtleXMoZGVwcmVjYXRlZENodW5rcykuZm9yRWFjaCgoY2h1bmtOYW1lKSA9PiB7XG4gICAgY29uc3QgcmVwbGFjZW1lbnQgPSBkZXByZWNhdGVkQ2h1bmtzW2NodW5rTmFtZV07XG4gICAgY29uc3QgdXNlSW5zdGVhZCA9IHJlcGxhY2VtZW50ID8gYCBVc2UgcGMuc2hhZGVyQ2h1bmtzWycke3JlcGxhY2VtZW50fSddIGluc3RlYWQuYCA6ICcnO1xuICAgIGNvbnN0IG1zZyA9IGBwYy5zaGFkZXJDaHVua3NbJyR7Y2h1bmtOYW1lfSddIGlzIGRlcHJlY2F0ZWQuJHt1c2VJbnN0ZWFkfX1gO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzaGFkZXJDaHVua3MsIGNodW5rTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKG1zZyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihtc2cpO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuLy8gTm90ZTogVGhpcyB3YXMgbmV2ZXIgcHVibGljIGludGVyZmFjZSwgYnV0IGhhcyBiZWVuIHVzZWQgaW4gZXh0ZXJuYWwgc2NyaXB0c1xuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoUmVuZGVyVGFyZ2V0LnByb3RvdHlwZSwge1xuICAgIF9nbEZyYW1lQnVmZmVyOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyVGFyZ2V0I19nbEZyYW1lQnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJUYXJnZXQuaW1wbCNfZ2xGcmFtZUJ1ZmZlciBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbC5fZ2xGcmFtZUJ1ZmZlcjtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAocmdibSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyVGFyZ2V0I19nbEZyYW1lQnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJUYXJnZXQuaW1wbCNfZ2xGcmFtZUJ1ZmZlciBpbnN0ZWFkLicpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShWZXJ0ZXhGb3JtYXQsICdkZWZhdWx0SW5zdGFuY2luZ0Zvcm1hdCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVydGV4Rm9ybWF0LmRlZmF1bHRJbnN0YW5jaW5nRm9ybWF0IGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5WZXJ0ZXhGb3JtYXQuZ2V0RGVmYXVsdEluc3RhbmNpbmdGb3JtYXQoZ3JhcGhpY3NEZXZpY2UpLicpO1xuICAgICAgICByZXR1cm4gVmVydGV4Rm9ybWF0LmdldERlZmF1bHRJbnN0YW5jaW5nRm9ybWF0KEdyYXBoaWNzRGV2aWNlQWNjZXNzLmdldCgpKTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoVGV4dHVyZS5wcm90b3R5cGUsIHtcbiAgICByZ2JtOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNyZ2JtIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnR5cGUgPT09IFRFWFRVUkVUWVBFX1JHQk07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHJnYm0pIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlRleHR1cmUjcmdibSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuVGV4dHVyZSN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSByZ2JtID8gVEVYVFVSRVRZUEVfUkdCTSA6IFRFWFRVUkVUWVBFX0RFRkFVTFQ7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgc3dpenpsZUdHR1I6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3N3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnR5cGUgPT09IFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChzd2l6emxlR0dHUikge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNzd2l6emxlR0dHUiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuVGV4dHVyZSN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSBzd2l6emxlR0dHUiA/IFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBfZ2xUZXh0dXJlOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNfZ2xUZXh0dXJlIGlzIG5vIGxvbmdlciBhdmFpbGFibGUsIHVzZSBVc2UgcGMuVGV4dHVyZS5pbXBsLl9nbFRleHR1cmUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuZ2V0UHJvZ3JhbUxpYnJhcnkgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2UjZ2V0UHJvZ3JhbUxpYnJhcnkgaXMgZGVwcmVjYXRlZC5gKTtcbiAgICByZXR1cm4gZ2V0UHJvZ3JhbUxpYnJhcnkodGhpcyk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0UHJvZ3JhbUxpYnJhcnkgPSBmdW5jdGlvbiAobGliKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0UHJvZ3JhbUxpYnJhcnkgaXMgZGVwcmVjYXRlZC5gKTtcbiAgICBzZXRQcm9ncmFtTGlicmFyeSh0aGlzLCBsaWIpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLnJlbW92ZVNoYWRlckZyb21DYWNoZSA9IGZ1bmN0aW9uIChzaGFkZXIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNyZW1vdmVTaGFkZXJGcm9tQ2FjaGUgaXMgZGVwcmVjYXRlZC5gKTtcbiAgICBnZXRQcm9ncmFtTGlicmFyeSh0aGlzKS5yZW1vdmVGcm9tQ2FjaGUoc2hhZGVyKTtcbn07XG5cbmNvbnN0IF90ZW1wQmxlbmRTdGF0ZSA9IG5ldyBCbGVuZFN0YXRlKCk7XG5jb25zdCBfdGVtcERlcHRoU3RhdGUgPSBuZXcgRGVwdGhTdGF0ZSgpO1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0QmxlbmRGdW5jdGlvbiA9IGZ1bmN0aW9uIChibGVuZFNyYywgYmxlbmREc3QpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRCbGVuZEZ1bmN0aW9uIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXRCbGVuZFN0YXRlIGluc3RlYWQuYCk7XG4gICAgY29uc3QgY3VycmVudEJsZW5kU3RhdGUgPSB0aGlzLmJsZW5kU3RhdGU7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvckJsZW5kKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yT3AsIGJsZW5kU3JjLCBibGVuZERzdCk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLnNldEFscGhhQmxlbmQoY3VycmVudEJsZW5kU3RhdGUuYWxwaGFPcCwgYmxlbmRTcmMsIGJsZW5kRHN0KTtcbiAgICB0aGlzLnNldEJsZW5kU3RhdGUoX3RlbXBCbGVuZFN0YXRlKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRCbGVuZEZ1bmN0aW9uU2VwYXJhdGUgPSBmdW5jdGlvbiAoYmxlbmRTcmMsIGJsZW5kRHN0LCBibGVuZFNyY0FscGhhLCBibGVuZERzdEFscGhhKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0QmxlbmRGdW5jdGlvblNlcGFyYXRlIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXRCbGVuZFN0YXRlIGluc3RlYWQuYCk7XG4gICAgY29uc3QgY3VycmVudEJsZW5kU3RhdGUgPSB0aGlzLmJsZW5kU3RhdGU7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvckJsZW5kKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yT3AsIGJsZW5kU3JjLCBibGVuZERzdCk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLnNldEFscGhhQmxlbmQoY3VycmVudEJsZW5kU3RhdGUuYWxwaGFPcCwgYmxlbmRTcmNBbHBoYSwgYmxlbmREc3RBbHBoYSk7XG4gICAgdGhpcy5zZXRCbGVuZFN0YXRlKF90ZW1wQmxlbmRTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0QmxlbmRFcXVhdGlvbiA9IGZ1bmN0aW9uIChibGVuZEVxdWF0aW9uKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0QmxlbmRFcXVhdGlvbiBpcyBkZXByZWNhdGVkLCB1c2UgcGMuR3JhcGhpY3NEZXZpY2Uuc2V0QmxlbmRTdGF0ZSBpbnN0ZWFkLmApO1xuICAgIGNvbnN0IGN1cnJlbnRCbGVuZFN0YXRlID0gdGhpcy5ibGVuZFN0YXRlO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5jb3B5KGN1cnJlbnRCbGVuZFN0YXRlKTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuc2V0Q29sb3JCbGVuZChibGVuZEVxdWF0aW9uLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvclNyY0ZhY3RvciwgY3VycmVudEJsZW5kU3RhdGUuY29sb3JEc3RGYWN0b3IpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRBbHBoYUJsZW5kKGJsZW5kRXF1YXRpb24sIGN1cnJlbnRCbGVuZFN0YXRlLmFscGhhU3JjRmFjdG9yLCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYURzdEZhY3Rvcik7XG4gICAgdGhpcy5zZXRCbGVuZFN0YXRlKF90ZW1wQmxlbmRTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0QmxlbmRFcXVhdGlvblNlcGFyYXRlID0gZnVuY3Rpb24gKGJsZW5kRXF1YXRpb24sIGJsZW5kQWxwaGFFcXVhdGlvbikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3NldEJsZW5kRXF1YXRpb25TZXBhcmF0ZSBpcyBkZXByZWNhdGVkLCB1c2UgcGMuR3JhcGhpY3NEZXZpY2Uuc2V0QmxlbmRTdGF0ZSBpbnN0ZWFkLmApO1xuICAgIGNvbnN0IGN1cnJlbnRCbGVuZFN0YXRlID0gdGhpcy5ibGVuZFN0YXRlO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5jb3B5KGN1cnJlbnRCbGVuZFN0YXRlKTtcbiAgICBfdGVtcEJsZW5kU3RhdGUuc2V0Q29sb3JCbGVuZChibGVuZEVxdWF0aW9uLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvclNyY0ZhY3RvciwgY3VycmVudEJsZW5kU3RhdGUuY29sb3JEc3RGYWN0b3IpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRBbHBoYUJsZW5kKGJsZW5kQWxwaGFFcXVhdGlvbiwgY3VycmVudEJsZW5kU3RhdGUuYWxwaGFTcmNGYWN0b3IsIGN1cnJlbnRCbGVuZFN0YXRlLmFscGhhRHN0RmFjdG9yKTtcbiAgICB0aGlzLnNldEJsZW5kU3RhdGUoX3RlbXBCbGVuZFN0YXRlKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRDb2xvcldyaXRlID0gZnVuY3Rpb24gKHJlZFdyaXRlLCBncmVlbldyaXRlLCBibHVlV3JpdGUsIGFscGhhV3JpdGUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRDb2xvcldyaXRlIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXRCbGVuZFN0YXRlIGluc3RlYWQuYCk7XG4gICAgY29uc3QgY3VycmVudEJsZW5kU3RhdGUgPSB0aGlzLmJsZW5kU3RhdGU7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvcldyaXRlKHJlZFdyaXRlLCBncmVlbldyaXRlLCBibHVlV3JpdGUsIGFscGhhV3JpdGUpO1xuICAgIHRoaXMuc2V0QmxlbmRTdGF0ZShfdGVtcEJsZW5kU3RhdGUpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLmdldEJsZW5kaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmJsZW5kU3RhdGUuYmxlbmQ7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0QmxlbmRpbmcgPSBmdW5jdGlvbiAoYmxlbmRpbmcpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRCbGVuZGluZyBpcyBkZXByZWNhdGVkLCB1c2UgcGMuR3JhcGhpY3NEZXZpY2Uuc2V0QmxlbmRTdGF0ZSBpbnN0ZWFkLmApO1xuICAgIF90ZW1wQmxlbmRTdGF0ZS5jb3B5KHRoaXMuYmxlbmRTdGF0ZSk7XG4gICAgX3RlbXBCbGVuZFN0YXRlLmJsZW5kID0gYmxlbmRpbmc7XG4gICAgdGhpcy5zZXRCbGVuZFN0YXRlKF90ZW1wQmxlbmRTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0RGVwdGhXcml0ZSA9IGZ1bmN0aW9uICh3cml0ZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3NldERlcHRoV3JpdGUgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLkdyYXBoaWNzRGV2aWNlLnNldERlcHRoU3RhdGUgaW5zdGVhZC5gKTtcbiAgICBfdGVtcERlcHRoU3RhdGUuY29weSh0aGlzLmRlcHRoU3RhdGUpO1xuICAgIF90ZW1wRGVwdGhTdGF0ZS53cml0ZSA9IHdyaXRlO1xuICAgIHRoaXMuc2V0RGVwdGhTdGF0ZShfdGVtcERlcHRoU3RhdGUpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLnNldERlcHRoRnVuYyA9IGZ1bmN0aW9uIChmdW5jKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2Ujc2V0RGVwdGhGdW5jIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5HcmFwaGljc0RldmljZS5zZXREZXB0aFN0YXRlIGluc3RlYWQuYCk7XG4gICAgX3RlbXBEZXB0aFN0YXRlLmNvcHkodGhpcy5kZXB0aFN0YXRlKTtcbiAgICBfdGVtcERlcHRoU3RhdGUuZnVuYyA9IGZ1bmM7XG4gICAgdGhpcy5zZXREZXB0aFN0YXRlKF90ZW1wRGVwdGhTdGF0ZSk7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUuc2V0RGVwdGhUZXN0ID0gZnVuY3Rpb24gKHRlc3QpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXREZXB0aFRlc3QgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLkdyYXBoaWNzRGV2aWNlLnNldERlcHRoU3RhdGUgaW5zdGVhZC5gKTtcbiAgICBfdGVtcERlcHRoU3RhdGUuY29weSh0aGlzLmRlcHRoU3RhdGUpO1xuICAgIF90ZW1wRGVwdGhTdGF0ZS50ZXN0ID0gdGVzdDtcbiAgICB0aGlzLnNldERlcHRoU3RhdGUoX3RlbXBEZXB0aFN0YXRlKTtcbn07XG5cbi8vIFNDRU5FXG5cbmV4cG9ydCBjb25zdCBQaG9uZ01hdGVyaWFsID0gU3RhbmRhcmRNYXRlcmlhbDtcblxuZXhwb3J0IGNvbnN0IHNjZW5lID0ge1xuICAgIHBhcnRpdGlvblNraW46IHBhcnRpdGlvblNraW4sXG4gICAgcHJvY2VkdXJhbDoge1xuICAgICAgICBjYWxjdWxhdGVUYW5nZW50czogY2FsY3VsYXRlVGFuZ2VudHMsXG4gICAgICAgIGNyZWF0ZU1lc2g6IGNyZWF0ZU1lc2gsXG4gICAgICAgIGNyZWF0ZVRvcnVzOiBjcmVhdGVUb3J1cyxcbiAgICAgICAgY3JlYXRlQ3lsaW5kZXI6IGNyZWF0ZUN5bGluZGVyLFxuICAgICAgICBjcmVhdGVDYXBzdWxlOiBjcmVhdGVDYXBzdWxlLFxuICAgICAgICBjcmVhdGVDb25lOiBjcmVhdGVDb25lLFxuICAgICAgICBjcmVhdGVTcGhlcmU6IGNyZWF0ZVNwaGVyZSxcbiAgICAgICAgY3JlYXRlUGxhbmU6IGNyZWF0ZVBsYW5lLFxuICAgICAgICBjcmVhdGVCb3g6IGNyZWF0ZUJveFxuICAgIH0sXG4gICAgQmFzaWNNYXRlcmlhbDogQmFzaWNNYXRlcmlhbCxcbiAgICBDb21tYW5kOiBDb21tYW5kLFxuICAgIEZvcndhcmRSZW5kZXJlcjogRm9yd2FyZFJlbmRlcmVyLFxuICAgIEdyYXBoTm9kZTogR3JhcGhOb2RlLFxuICAgIE1hdGVyaWFsOiBNYXRlcmlhbCxcbiAgICBNZXNoOiBNZXNoLFxuICAgIE1lc2hJbnN0YW5jZTogTWVzaEluc3RhbmNlLFxuICAgIE1vZGVsOiBNb2RlbCxcbiAgICBQYXJ0aWNsZUVtaXR0ZXI6IFBhcnRpY2xlRW1pdHRlcixcbiAgICBQaG9uZ01hdGVyaWFsOiBTdGFuZGFyZE1hdGVyaWFsLFxuICAgIFBpY2tlcjogUGlja2VyLFxuICAgIFByb2plY3Rpb246IHtcbiAgICAgICAgT1JUSE9HUkFQSElDOiBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyxcbiAgICAgICAgUEVSU1BFQ1RJVkU6IFBST0pFQ1RJT05fUEVSU1BFQ1RJVkVcbiAgICB9LFxuICAgIFNjZW5lOiBTY2VuZSxcbiAgICBTa2luOiBTa2luLFxuICAgIFNraW5JbnN0YW5jZTogU2tpbkluc3RhbmNlXG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2NlbmUucHJvdG90eXBlLCAnZGVmYXVsdE1hdGVyaWFsJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNkZWZhdWx0TWF0ZXJpYWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICAgICAgcmV0dXJuIGdldERlZmF1bHRNYXRlcmlhbChnZXRBcHBsaWNhdGlvbigpLmdyYXBoaWNzRGV2aWNlKTtcbiAgICB9XG59KTtcblxuLy8gc2NlbmUuc2t5Ym94UHJlZmlsdGVyZWQqKioqIGFyZSBkZXByZWNhdGVkXG5bJzEyOCcsICc2NCcsICczMicsICcxNicsICc4JywgJzQnXS5mb3JFYWNoKChzaXplLCBpbmRleCkgPT4ge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTY2VuZS5wcm90b3R5cGUsIGBza3lib3hQcmVmaWx0ZXJlZCR7c2l6ZX1gLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuU2NlbmUjc2t5Ym94UHJlZmlsdGVyZWQke3NpemV9IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5TY2VuZSNwcmVmaWx0ZXJlZEN1YmVtYXBzIGluc3RlYWQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwc1tpbmRleF07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TY2VuZSNza3lib3hQcmVmaWx0ZXJlZCR7c2l6ZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNjZW5lI3ByZWZpbHRlcmVkQ3ViZW1hcHMgaW5zdGVhZC5gKTtcbiAgICAgICAgICAgIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHNbaW5kZXhdID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNjZW5lLnByb3RvdHlwZSwgJ21vZGVscycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9tb2RlbHMpIHtcbiAgICAgICAgICAgIHRoaXMuX21vZGVscyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9tb2RlbHM7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShMYXllci5wcm90b3R5cGUsICdyZW5kZXJUYXJnZXQnLCB7XG4gICAgc2V0OiBmdW5jdGlvbiAocnQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuTGF5ZXIjcmVuZGVyVGFyZ2V0IGlzIGRlcHJlY2F0ZWQuIFNldCB0aGUgcmVuZGVyIHRhcmdldCBvbiB0aGUgY2FtZXJhIGluc3RlYWQuYCk7XG4gICAgICAgIHRoaXMuX3JlbmRlclRhcmdldCA9IHJ0O1xuICAgICAgICB0aGlzLl9kaXJ0eUNhbWVyYXMgPSB0cnVlO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJUYXJnZXQ7XG4gICAgfVxufSk7XG5cbi8vIFRoaXMgY2FuIGJlIHJlbW92ZWQgd2hlbiAxLjU2IGlzIG91dCBhbmQgdGhlIEVkaXRvciBubyBsb25nZXIgY2FsbHMgdGhpc1xuU2NlbmUucHJvdG90eXBlLl91cGRhdGVTa3lib3ggPSBmdW5jdGlvbiAoZGV2aWNlKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuU2NlbmUjX3VwZGF0ZVNreWJveCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2NlbmUjX3VwZGF0ZVNreSBpbnN0ZWFkLmApO1xuICAgIHRoaXMuX3VwZGF0ZVNreShkZXZpY2UpO1xufTtcblxuU2NlbmUucHJvdG90eXBlLmFkZE1vZGVsID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjYWRkTW9kZWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICBpZiAodGhpcy5jb250YWluc01vZGVsKG1vZGVsKSkgcmV0dXJuO1xuICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfV09STEQpO1xuICAgIGlmICghbGF5ZXIpIHJldHVybjtcbiAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgIHRoaXMubW9kZWxzLnB1c2gobW9kZWwpO1xufTtcblxuU2NlbmUucHJvdG90eXBlLmFkZFNoYWRvd0Nhc3RlciA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2FkZFNoYWRvd0Nhc3RlciBpcyBkZXByZWNhdGVkLicpO1xuICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfV09STEQpO1xuICAgIGlmICghbGF5ZXIpIHJldHVybjtcbiAgICBsYXllci5hZGRTaGFkb3dDYXN0ZXJzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xufTtcblxuU2NlbmUucHJvdG90eXBlLnJlbW92ZU1vZGVsID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjcmVtb3ZlTW9kZWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICBjb25zdCBpbmRleCA9IHRoaXMubW9kZWxzLmluZGV4T2YobW9kZWwpO1xuICAgIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCk7XG4gICAgICAgIGlmICghbGF5ZXIpIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgdGhpcy5tb2RlbHMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICB9XG59O1xuXG5TY2VuZS5wcm90b3R5cGUucmVtb3ZlU2hhZG93Q2FzdGVycyA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI3JlbW92ZVNoYWRvd0Nhc3RlcnMgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgbGF5ZXIucmVtb3ZlU2hhZG93Q2FzdGVycyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5jb250YWluc01vZGVsID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjY29udGFpbnNNb2RlbCBpcyBkZXByZWNhdGVkLicpO1xuICAgIHJldHVybiB0aGlzLm1vZGVscy5pbmRleE9mKG1vZGVsKSA+PSAwO1xufTtcblxuU2NlbmUucHJvdG90eXBlLmdldE1vZGVscyA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2dldE1vZGVscyBpcyBkZXByZWNhdGVkLicpO1xuICAgIHJldHVybiB0aGlzLm1vZGVscztcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCYXRjaC5wcm90b3R5cGUsICdtb2RlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQmF0Y2gjbW9kZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkJhdGNoI21lc2hJbnN0YW5jZSB0byBhY2Nlc3MgYmF0Y2hlZCBtZXNoIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn0pO1xuXG5Gb3J3YXJkUmVuZGVyZXIucHJvdG90eXBlLnJlbmRlckNvbXBvc2l0aW9uID0gZnVuY3Rpb24gKGNvbXApIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Gb3J3YXJkUmVuZGVyZXIjcmVuZGVyQ29tcG9zaXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UucmVuZGVyQ29tcG9zaXRpb24gaW5zdGVhZC4nKTtcbiAgICBnZXRBcHBsaWNhdGlvbigpLnJlbmRlckNvbXBvc2l0aW9uKGNvbXApO1xufTtcblxuRm9yd2FyZFJlbmRlcmVyLnByb3RvdHlwZS51cGRhdGVTaGFkZXIgPSBmdW5jdGlvbiAobWVzaEluc3RhbmNlLCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkZvcndhcmRSZW5kZXJlciN1cGRhdGVTaGFkZXIgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLk1lc2hJbnN0YW5jZSN1cGRhdGVQYXNzU2hhZGVyLicpO1xuICAgIGNvbnN0IHNjZW5lID0gbWVzaEluc3RhbmNlLm1hdGVyaWFsLl9zY2VuZSB8fCBnZXRBcHBsaWNhdGlvbigpLnNjZW5lO1xuICAgIHJldHVybiBtZXNoSW5zdGFuY2UudXBkYXRlUGFzc1NoYWRlcihzY2VuZSwgcGFzcywgc3RhdGljTGlnaHRMaXN0LCBzb3J0ZWRMaWdodHMpO1xufTtcblxuTWVzaEluc3RhbmNlLnByb3RvdHlwZS5zeW5jQWFiYiA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NZXNoSW5zdGFuY2Ujc3luY0FhYmIgaXMgZGVwcmVjYXRlZC4nKTtcbn07XG5cbk1vcnBoLnByb3RvdHlwZS5nZXRUYXJnZXQgPSBmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb3JwaCNnZXRUYXJnZXQgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1vcnBoI3RhcmdldHMgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLnRhcmdldHNbaW5kZXhdO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5fZGlydGlmeSA9IGZ1bmN0aW9uIChsb2NhbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNfZGlydGlmeSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI19kaXJ0aWZ5TG9jYWwgb3IgX2RpcnRpZnlXb3JsZCByZXNwZWN0aXZlbHkgaW5zdGVhZC4nKTtcbiAgICBpZiAobG9jYWwpXG4gICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIGVsc2VcbiAgICAgICAgdGhpcy5fZGlydGlmeVdvcmxkKCk7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmFkZExhYmVsID0gZnVuY3Rpb24gKGxhYmVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2FkZExhYmVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgdGhpcy5fbGFiZWxzW2xhYmVsXSA9IHRydWU7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldExhYmVscyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0TGFiZWxzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2xhYmVscyk7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmhhc0xhYmVsID0gZnVuY3Rpb24gKGxhYmVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2hhc0xhYmVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuICEhdGhpcy5fbGFiZWxzW2xhYmVsXTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUucmVtb3ZlTGFiZWwgPSBmdW5jdGlvbiAobGFiZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjcmVtb3ZlTGFiZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICBkZWxldGUgdGhpcy5fbGFiZWxzW2xhYmVsXTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZmluZEJ5TGFiZWwgPSBmdW5jdGlvbiAobGFiZWwsIHJlc3VsdHMgPSBbXSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNmaW5kQnlMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIGlmICh0aGlzLmhhc0xhYmVsKGxhYmVsKSkge1xuICAgICAgICByZXN1bHRzLnB1c2godGhpcyk7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9jaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICByZXN1bHRzID0gdGhpcy5fY2hpbGRyZW5baV0uZmluZEJ5TGFiZWwobGFiZWwsIHJlc3VsdHMpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRzO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRDaGlsZHJlbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0Q2hpbGRyZW4gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNjaGlsZHJlbiBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMuY2hpbGRyZW47XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldE5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNuYW1lIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5uYW1lO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRQYXRoID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRQYXRoIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjcGF0aCBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMucGF0aDtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0Um9vdCA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0Um9vdCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3Jvb3QgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLnJvb3Q7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldFBhcmVudCA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0UGFyZW50IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjcGFyZW50IGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5wYXJlbnQ7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLnNldE5hbWUgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNzZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjbmFtZSBpbnN0ZWFkLicpO1xuXG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5nZXROYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1hdGVyaWFsI2dldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1hdGVyaWFsI25hbWUgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5uYW1lO1xufTtcblxuTWF0ZXJpYWwucHJvdG90eXBlLnNldE5hbWUgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1hdGVyaWFsI3NldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1hdGVyaWFsI25hbWUgaW5zdGVhZC4nKTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xufTtcblxuTWF0ZXJpYWwucHJvdG90eXBlLmdldFNoYWRlciA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNnZXRTaGFkZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1hdGVyaWFsI3NoYWRlciBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLnNoYWRlcjtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5zZXRTaGFkZXIgPSBmdW5jdGlvbiAoc2hhZGVyKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWF0ZXJpYWwjc2V0U2hhZGVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNzaGFkZXIgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnNoYWRlciA9IHNoYWRlcjtcbn07XG5cbi8vIE5vdGU6IHRoaXMgaXMgdXNlZCBieSB0aGUgRWRpdG9yXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTWF0ZXJpYWwucHJvdG90eXBlLCAnYmxlbmQnLCB7XG4gICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuTWF0ZXJpYWwjYmxlbmQgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLk1hdGVyaWFsLmJsZW5kU3RhdGUuYCk7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZS5ibGVuZCA9IHZhbHVlO1xuICAgIH0sXG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmJsZW5kU3RhdGUuYmxlbmQ7XG4gICAgfVxufSk7XG5cbi8vIE5vdGU6IHRoaXMgaXMgdXNlZCBieSB0aGUgRWRpdG9yXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTWF0ZXJpYWwucHJvdG90eXBlLCAnYmxlbmRTcmMnLCB7XG4gICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuTWF0ZXJpYWwjYmxlbmRTcmMgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLk1hdGVyaWFsLmJsZW5kU3RhdGUuYCk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRCbGVuZFN0YXRlID0gdGhpcy5ibGVuZFN0YXRlO1xuICAgICAgICBfdGVtcEJsZW5kU3RhdGUuY29weShjdXJyZW50QmxlbmRTdGF0ZSk7XG4gICAgICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRDb2xvckJsZW5kKGN1cnJlbnRCbGVuZFN0YXRlLmNvbG9yT3AsIHZhbHVlLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvckRzdEZhY3Rvcik7XG4gICAgICAgIF90ZW1wQmxlbmRTdGF0ZS5zZXRBbHBoYUJsZW5kKGN1cnJlbnRCbGVuZFN0YXRlLmFscGhhT3AsIHZhbHVlLCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYURzdEZhY3Rvcik7XG4gICAgICAgIHRoaXMuYmxlbmRTdGF0ZSA9IF90ZW1wQmxlbmRTdGF0ZTtcbiAgICB9LFxuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ibGVuZFN0YXRlLmNvbG9yU3JjRmFjdG9yO1xuICAgIH1cbn0pO1xuXG4vLyBOb3RlOiB0aGlzIGlzIHVzZWQgYnkgdGhlIEVkaXRvclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE1hdGVyaWFsLnByb3RvdHlwZSwgJ2JsZW5kRHN0Jywge1xuICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLk1hdGVyaWFsI2JsZW5kRHN0IGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5NYXRlcmlhbC5ibGVuZFN0YXRlLmApO1xuICAgICAgICBjb25zdCBjdXJyZW50QmxlbmRTdGF0ZSA9IHRoaXMuYmxlbmRTdGF0ZTtcbiAgICAgICAgX3RlbXBCbGVuZFN0YXRlLmNvcHkoY3VycmVudEJsZW5kU3RhdGUpO1xuICAgICAgICBfdGVtcEJsZW5kU3RhdGUuc2V0Q29sb3JCbGVuZChjdXJyZW50QmxlbmRTdGF0ZS5jb2xvck9wLCBjdXJyZW50QmxlbmRTdGF0ZS5jb2xvclNyY0ZhY3RvciwgdmFsdWUpO1xuICAgICAgICBfdGVtcEJsZW5kU3RhdGUuc2V0QWxwaGFCbGVuZChjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYU9wLCBjdXJyZW50QmxlbmRTdGF0ZS5hbHBoYVNyY0ZhY3RvciwgdmFsdWUpO1xuICAgICAgICB0aGlzLmJsZW5kU3RhdGUgPSBfdGVtcEJsZW5kU3RhdGU7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYmxlbmRTdGF0ZS5jb2xvckRzdEZhY3RvcjtcbiAgICB9XG59KTtcblxuLy8gc2hpbmluZXNzIChyYW5nZSAwLi4xMDApIC0gbWFwcyB0byBpbnRlcm5hbCBnbG9zcyB2YWx1ZSAocmFuZ2UgMC4uMSlcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTdGFuZGFyZE1hdGVyaWFsLnByb3RvdHlwZSwgJ3NoaW5pbmVzcycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2xvc3MgKiAxMDA7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB0aGlzLmdsb3NzID0gdmFsdWUgKiAwLjAxO1xuICAgIH1cbn0pO1xuXG5mdW5jdGlvbiBfZGVmaW5lQWxpYXMobmV3TmFtZSwgb2xkTmFtZSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTdGFuZGFyZE1hdGVyaWFsLnByb3RvdHlwZSwgb2xkTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtvbGROYW1lfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU3RhbmRhcmRNYXRlcmlhbCMke25ld05hbWV9IGluc3RlYWQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1tuZXdOYW1lXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtvbGROYW1lfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU3RhbmRhcmRNYXRlcmlhbCMke25ld05hbWV9IGluc3RlYWQuYCk7XG4gICAgICAgICAgICB0aGlzW25ld05hbWVdID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuX2RlZmluZUFsaWFzKCdkaWZmdXNlVGludCcsICdkaWZmdXNlTWFwVGludCcpO1xuX2RlZmluZUFsaWFzKCdzcGVjdWxhclRpbnQnLCAnc3BlY3VsYXJNYXBUaW50Jyk7XG5fZGVmaW5lQWxpYXMoJ2VtaXNzaXZlVGludCcsICdlbWlzc2l2ZU1hcFRpbnQnKTtcbl9kZWZpbmVBbGlhcygnYW9WZXJ0ZXhDb2xvcicsICdhb01hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ2RpZmZ1c2VWZXJ0ZXhDb2xvcicsICdkaWZmdXNlTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnc3BlY3VsYXJWZXJ0ZXhDb2xvcicsICdzcGVjdWxhck1hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ2VtaXNzaXZlVmVydGV4Q29sb3InLCAnZW1pc3NpdmVNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdtZXRhbG5lc3NWZXJ0ZXhDb2xvcicsICdtZXRhbG5lc3NNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdnbG9zc1ZlcnRleENvbG9yJywgJ2dsb3NzTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnb3BhY2l0eVZlcnRleENvbG9yJywgJ29wYWNpdHlNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdsaWdodFZlcnRleENvbG9yJywgJ2xpZ2h0TWFwVmVydGV4Q29sb3InKTtcblxuX2RlZmluZUFsaWFzKCdzaGVlbkdsb3NzJywgJ3NoZWVuR2xvc3NpZXNzJyk7XG5fZGVmaW5lQWxpYXMoJ2NsZWFyQ29hdEdsb3NzJywgJ2NsZWFyQ29zdEdsb3NzaW5lc3MnKTtcblxuZnVuY3Rpb24gX2RlZmluZU9wdGlvbihuYW1lLCBuZXdOYW1lKSB7XG4gICAgaWYgKG5hbWUgIT09ICdjaHVua3MnICYmIG5hbWUgIT09ICdfcGFzcycpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zLnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgR2V0dGluZyBwYy5PcHRpb25zIyR7bmFtZX0gaGFzIGJlZW4gZGVwcmVjYXRlZCBhcyB0aGUgcHJvcGVydHkgaGFzIGJlZW4gbW92ZWQgdG8gcGMuT3B0aW9ucy5MaXRPcHRpb25zIyR7bmV3TmFtZSB8fCBuYW1lfS5gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5saXRPcHRpb25zW25ld05hbWUgfHwgbmFtZV07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBTZXR0aW5nIHBjLk9wdGlvbnMjJHtuYW1lfSBoYXMgYmVlbiBkZXByZWNhdGVkIGFzIHRoZSBwcm9wZXJ0eSBoYXMgYmVlbiBtb3ZlZCB0byBwYy5PcHRpb25zLkxpdE9wdGlvbnMjJHtuZXdOYW1lIHx8IG5hbWV9LmApO1xuICAgICAgICAgICAgICAgIHRoaXMubGl0T3B0aW9uc1tuZXdOYW1lIHx8IG5hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbl9kZWZpbmVPcHRpb24oJ3JlZnJhY3Rpb24nLCAndXNlUmVmcmFjdGlvbicpO1xuXG5jb25zdCB0ZW1wT3B0aW9ucyA9IG5ldyBMaXRPcHRpb25zKCk7XG5jb25zdCBsaXRPcHRpb25Qcm9wZXJ0aWVzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVtcE9wdGlvbnMpO1xuZm9yIChjb25zdCBsaXRPcHRpb24gaW4gbGl0T3B0aW9uUHJvcGVydGllcykge1xuICAgIF9kZWZpbmVPcHRpb24obGl0T3B0aW9uUHJvcGVydGllc1tsaXRPcHRpb25dKTtcbn1cblxuLy8gQU5JTUFUSU9OXG5cbmV4cG9ydCBjb25zdCBhbmltID0ge1xuICAgIEFuaW1hdGlvbjogQW5pbWF0aW9uLFxuICAgIEtleTogS2V5LFxuICAgIE5vZGU6IE5vZGUsXG4gICAgU2tlbGV0b246IFNrZWxldG9uXG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNnZXREdXJhdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQW5pbWF0aW9uI2R1cmF0aW9uIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuZHVyYXRpb247XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldE5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI2dldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNuYW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuZ2V0Tm9kZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI2dldE5vZGVzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jbm9kZXMgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5ub2Rlcztcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuc2V0RHVyYXRpb24gPSBmdW5jdGlvbiAoZHVyYXRpb24pIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BbmltYXRpb24jc2V0RHVyYXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNkdXJhdGlvbiBpbnN0ZWFkLicpO1xuICAgIHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjtcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuc2V0TmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI3NldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNuYW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXRBbmltYXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0QW5pbWF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNhbmltYXRpb24gaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5hbmltYXRpb247XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0Q3VycmVudFRpbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0Q3VycmVudFRpbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2N1cnJlbnRUaW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0TG9vcGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXRMb29waW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNsb29waW5nIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubG9vcGluZztcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXROdW1Ob2RlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXROdW1Ob2RlcyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbnVtTm9kZXMgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5udW1Ob2Rlcztcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5zZXRBbmltYXRpb24gPSBmdW5jdGlvbiAoYW5pbWF0aW9uKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0QW5pbWF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNhbmltYXRpb24gaW5zdGVhZC4nKTtcbiAgICB0aGlzLmFuaW1hdGlvbiA9IGFuaW1hdGlvbjtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5zZXRDdXJyZW50VGltZSA9IGZ1bmN0aW9uICh0aW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0Q3VycmVudFRpbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2N1cnJlbnRUaW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5jdXJyZW50VGltZSA9IHRpbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuc2V0TG9vcGluZyA9IGZ1bmN0aW9uIChsb29waW5nKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0TG9vcGluZyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbG9vcGluZyBpbnN0ZWFkLicpO1xuICAgIHRoaXMubG9vcGluZyA9IGxvb3Bpbmc7XG59O1xuXG4vLyBTT1VORFxuXG5leHBvcnQgY29uc3QgYXVkaW8gPSB7XG4gICAgQXVkaW9NYW5hZ2VyOiBTb3VuZE1hbmFnZXIsXG4gICAgQ2hhbm5lbDogQ2hhbm5lbCxcbiAgICBDaGFubmVsM2Q6IENoYW5uZWwzZCxcbiAgICBMaXN0ZW5lcjogTGlzdGVuZXIsXG4gICAgU291bmQ6IFNvdW5kXG59O1xuXG5Tb3VuZE1hbmFnZXIucHJvdG90eXBlLmdldExpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNvdW5kTWFuYWdlciNnZXRMaXN0ZW5lciBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI2xpc3RlbmVyIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubGlzdGVuZXI7XG59O1xuXG5Tb3VuZE1hbmFnZXIucHJvdG90eXBlLmdldFZvbHVtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Tb3VuZE1hbmFnZXIjZ2V0Vm9sdW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Tb3VuZE1hbmFnZXIjdm9sdW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMudm9sdW1lO1xufTtcblxuU291bmRNYW5hZ2VyLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbiAodm9sdW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU291bmRNYW5hZ2VyI3NldFZvbHVtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI3ZvbHVtZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMudm9sdW1lID0gdm9sdW1lO1xufTtcblxuLy8gQVNTRVRcblxuZXhwb3J0IGNvbnN0IGFzc2V0ID0ge1xuICAgIEFTU0VUX0FOSU1BVElPTjogJ2FuaW1hdGlvbicsXG4gICAgQVNTRVRfQVVESU86ICdhdWRpbycsXG4gICAgQVNTRVRfSU1BR0U6ICdpbWFnZScsXG4gICAgQVNTRVRfSlNPTjogJ2pzb24nLFxuICAgIEFTU0VUX01PREVMOiAnbW9kZWwnLFxuICAgIEFTU0VUX01BVEVSSUFMOiAnbWF0ZXJpYWwnLFxuICAgIEFTU0VUX1RFWFQ6ICd0ZXh0JyxcbiAgICBBU1NFVF9URVhUVVJFOiAndGV4dHVyZScsXG4gICAgQVNTRVRfQ1VCRU1BUDogJ2N1YmVtYXAnLFxuICAgIEFTU0VUX1NDUklQVDogJ3NjcmlwdCdcbn07XG5cbkFzc2V0UmVnaXN0cnkucHJvdG90eXBlLmdldEFzc2V0QnlJZCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFzc2V0UmVnaXN0cnkjZ2V0QXNzZXRCeUlkIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Bc3NldFJlZ2lzdHJ5I2dldCBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmdldChpZCk7XG59O1xuXG4vLyBYUlxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdyYXknLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlhySW5wdXRTb3VyY2UjcmF5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5YcklucHV0U291cmNlI2dldE9yaWdpbiBhbmQgcGMuWHJJbnB1dFNvdXJjZSNnZXREaXJlY3Rpb24gaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JheUxvY2FsO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdwb3NpdGlvbicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuWHJJbnB1dFNvdXJjZSNwb3NpdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRMb2NhbFBvc2l0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbFBvc2l0aW9uO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdyb3RhdGlvbicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuWHJJbnB1dFNvdXJjZSNyb3RhdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRMb2NhbFJvdGF0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbFJvdGF0aW9uO1xuICAgIH1cbn0pO1xuXG4vLyBJTlBVVFxuXG5leHBvcnQgY29uc3QgaW5wdXQgPSB7XG4gICAgZ2V0VG91Y2hUYXJnZXRDb29yZHM6IGdldFRvdWNoVGFyZ2V0Q29vcmRzLFxuICAgIENvbnRyb2xsZXI6IENvbnRyb2xsZXIsXG4gICAgR2FtZVBhZHM6IEdhbWVQYWRzLFxuICAgIEtleWJvYXJkOiBLZXlib2FyZCxcbiAgICBLZXlib2FyZEV2ZW50OiBLZXlib2FyZEV2ZW50LFxuICAgIE1vdXNlOiBNb3VzZSxcbiAgICBNb3VzZUV2ZW50OiBNb3VzZUV2ZW50LFxuICAgIFRvdWNoOiBUb3VjaCxcbiAgICBUb3VjaERldmljZTogVG91Y2hEZXZpY2UsXG4gICAgVG91Y2hFdmVudDogVG91Y2hFdmVudFxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEVsZW1lbnRJbnB1dC5wcm90b3R5cGUsICd3aGVlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2hlZWxEZWx0YSAqIC0yO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTW91c2VFdmVudC5wcm90b3R5cGUsICd3aGVlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2hlZWxEZWx0YSAqIC0yO1xuICAgIH1cbn0pO1xuXG4vLyBGUkFNRVdPUktcblxuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9UWVBFX1NUQVRJQyA9IEJPRFlUWVBFX1NUQVRJQztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9EWU5BTUlDID0gQk9EWVRZUEVfRFlOQU1JQztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9LSU5FTUFUSUMgPSBCT0RZVFlQRV9LSU5FTUFUSUM7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0NGX1NUQVRJQ19PQkpFQ1QgPSBCT0RZRkxBR19TVEFUSUNfT0JKRUNUO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9DRl9LSU5FTUFUSUNfT0JKRUNUID0gQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQ0ZfTk9SRVNQT05TRV9PQkpFQ1QgPSBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQUNUSVZFX1RBRyA9IEJPRFlTVEFURV9BQ1RJVkVfVEFHO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9JU0xBTkRfU0xFRVBJTkcgPSBCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9XQU5UU19ERUFDVElWQVRJT04gPSBCT0RZU1RBVEVfV0FOVFNfREVBQ1RJVkFUSU9OO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9ESVNBQkxFX0RFQUNUSVZBVElPTiA9IEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTjtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfRElTQUJMRV9TSU1VTEFUSU9OID0gQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTjtcblxuQXBwQmFzZS5wcm90b3R5cGUuaXNGdWxsc2NyZWVuID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjaXNGdWxsc2NyZWVuIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgRnVsbHNjcmVlbiBBUEkgZGlyZWN0bHkuJyk7XG5cbiAgICByZXR1cm4gISFkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudDtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmVuYWJsZUZ1bGxzY3JlZW4gPSBmdW5jdGlvbiAoZWxlbWVudCwgc3VjY2VzcywgZXJyb3IpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2VuYWJsZUZ1bGxzY3JlZW4gaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSBGdWxsc2NyZWVuIEFQSSBkaXJlY3RseS4nKTtcblxuICAgIGVsZW1lbnQgPSBlbGVtZW50IHx8IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzO1xuXG4gICAgLy8gc3VjY2VzcyBjYWxsYmFja1xuICAgIGNvbnN0IHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHN1Y2Nlc3MoKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsIHMpO1xuICAgIH07XG5cbiAgICAvLyBlcnJvciBjYWxsYmFja1xuICAgIGNvbnN0IGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGVycm9yKCk7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5lcnJvcicsIGUpO1xuICAgIH07XG5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcywgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChlcnJvcikge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuZXJyb3InLCBlLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGVsZW1lbnQucmVxdWVzdEZ1bGxzY3JlZW4pIHtcbiAgICAgICAgZWxlbWVudC5yZXF1ZXN0RnVsbHNjcmVlbihFbGVtZW50LkFMTE9XX0tFWUJPQVJEX0lOUFVUKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlcnJvcigpO1xuICAgIH1cbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmRpc2FibGVGdWxsc2NyZWVuID0gZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2Rpc2FibGVGdWxsc2NyZWVuIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgRnVsbHNjcmVlbiBBUEkgZGlyZWN0bHkuJyk7XG5cbiAgICAvLyBzdWNjZXNzIGNhbGxiYWNrXG4gICAgY29uc3QgcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3VjY2VzcygpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcyk7XG4gICAgfTtcblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLCBzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgZG9jdW1lbnQuZXhpdEZ1bGxzY3JlZW4oKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmdldFNjZW5lVXJsID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2dldFNjZW5lVXJsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNmaW5kIGluc3RlYWQuJyk7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnNjZW5lcy5maW5kKG5hbWUpO1xuICAgIGlmIChlbnRyeSkge1xuICAgICAgICByZXR1cm4gZW50cnkudXJsO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmxvYWRTY2VuZSA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNsb2FkU2NlbmUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2Ujc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2NlbmVzLmxvYWRTY2VuZSh1cmwsIGNhbGxiYWNrKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmxvYWRTY2VuZUhpZXJhcmNoeSA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNsb2FkU2NlbmVIaWVyYXJjaHkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2Ujc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZUhpZXJhcmNoeSBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2NlbmVzLmxvYWRTY2VuZUhpZXJhcmNoeSh1cmwsIGNhbGxiYWNrKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmxvYWRTY2VuZVNldHRpbmdzID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2xvYWRTY2VuZVNldHRpbmdzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVTZXR0aW5ncyBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2NlbmVzLmxvYWRTY2VuZVNldHRpbmdzKHVybCwgY2FsbGJhY2spO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUucmVuZGVyTWVzaEluc3RhbmNlID0gZnVuY3Rpb24gKG1lc2hJbnN0YW5jZSwgb3B0aW9ucykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UucmVuZGVyTWVzaEluc3RhbmNlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlLmRyYXdNZXNoSW5zdGFuY2UuJyk7XG4gICAgY29uc3QgbGF5ZXIgPSBvcHRpb25zPy5sYXllciA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXI7XG4gICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobnVsbCwgbnVsbCwgbnVsbCwgbWVzaEluc3RhbmNlLCBsYXllcik7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJNZXNoID0gZnVuY3Rpb24gKG1lc2gsIG1hdGVyaWFsLCBtYXRyaXgsIG9wdGlvbnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlLnJlbmRlck1lc2ggaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd01lc2guJyk7XG4gICAgY29uc3QgbGF5ZXIgPSBvcHRpb25zPy5sYXllciA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXI7XG4gICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgbWVzaCwgbnVsbCwgbGF5ZXIpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUuX2FkZExpbmVzID0gZnVuY3Rpb24gKHBvc2l0aW9ucywgY29sb3JzLCBvcHRpb25zKSB7XG4gICAgY29uc3QgbGF5ZXIgPSAob3B0aW9ucyAmJiBvcHRpb25zLmxheWVyKSA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpO1xuICAgIGNvbnN0IGRlcHRoVGVzdCA9IChvcHRpb25zICYmIG9wdGlvbnMuZGVwdGhUZXN0ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5kZXB0aFRlc3QgOiB0cnVlO1xuXG4gICAgY29uc3QgYmF0Y2ggPSB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRCYXRjaChsYXllciwgZGVwdGhUZXN0KTtcbiAgICBiYXRjaC5hZGRMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycyk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJMaW5lID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIGNvbG9yKSB7XG5cbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlLnJlbmRlckxpbmUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd0xpbmUuJyk7XG5cbiAgICBsZXQgZW5kQ29sb3IgPSBjb2xvcjtcbiAgICBsZXQgb3B0aW9ucztcblxuICAgIGNvbnN0IGFyZzMgPSBhcmd1bWVudHNbM107XG4gICAgY29uc3QgYXJnNCA9IGFyZ3VtZW50c1s0XTtcblxuICAgIGlmIChhcmczIGluc3RhbmNlb2YgQ29sb3IpIHtcbiAgICAgICAgLy8gcGFzc2VkIGluIGVuZCBjb2xvclxuICAgICAgICBlbmRDb2xvciA9IGFyZzM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBhcmc0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgLy8gY29tcGF0aWJpbGl0eTogY29udmVydCBsaW5lYmF0Y2ggaWQgaW50byBvcHRpb25zXG4gICAgICAgICAgICBpZiAoYXJnNCA9PT0gTElORUJBVENIX09WRVJMQVkpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGhUZXN0OiBmYWxzZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdXNlIHBhc3NlZCBpbiBvcHRpb25zXG4gICAgICAgICAgICBvcHRpb25zID0gYXJnNDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZzMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGVuZENvbG9yID0gY29sb3I7XG5cbiAgICAgICAgLy8gY29tcGF0aWJpbGl0eTogY29udmVydCBsaW5lYmF0Y2ggaWQgaW50byBvcHRpb25zXG4gICAgICAgIGlmIChhcmczID09PSBMSU5FQkFUQ0hfT1ZFUkxBWSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IGZhbHNlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFyZzMpIHtcbiAgICAgICAgLy8gb3B0aW9ucyBwYXNzZWQgaW5cbiAgICAgICAgb3B0aW9ucyA9IGFyZzM7XG4gICAgfVxuXG4gICAgdGhpcy5fYWRkTGluZXMoW3N0YXJ0LCBlbmRdLCBbY29sb3IsIGVuZENvbG9yXSwgb3B0aW9ucyk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJMaW5lcyA9IGZ1bmN0aW9uIChwb3NpdGlvbiwgY29sb3IsIG9wdGlvbnMpIHtcblxuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UucmVuZGVyTGluZXMgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd0xpbmVzLicpO1xuXG4gICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICAgIC8vIGRlZmF1bHQgb3B0aW9uXG4gICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgIGRlcHRoVGVzdDogdHJ1ZVxuICAgICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LCBMSU5FQkFUQ0hfT1ZFUkxBWSBsaW5lcyBoYXZlIGRlcHRodGVzdCBkaXNhYmxlZFxuICAgICAgICBpZiAob3B0aW9ucyA9PT0gTElORUJBVENIX09WRVJMQVkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiBmYWxzZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbXVsdGlDb2xvciA9ICEhY29sb3IubGVuZ3RoO1xuICAgIGlmIChtdWx0aUNvbG9yKSB7XG4gICAgICAgIGlmIChwb3NpdGlvbi5sZW5ndGggIT09IGNvbG9yLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcigncmVuZGVyTGluZXM6IHBvc2l0aW9uL2NvbG9yIGFycmF5cyBoYXZlIGRpZmZlcmVudCBsZW5ndGhzJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHBvc2l0aW9uLmxlbmd0aCAlIDIgIT09IDApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcigncmVuZGVyTGluZXM6IGFycmF5IGxlbmd0aCBpcyBub3QgZGl2aXNpYmxlIGJ5IDInKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9hZGRMaW5lcyhwb3NpdGlvbiwgY29sb3IsIG9wdGlvbnMpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUuZW5hYmxlVnIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNlbmFibGVWUiBpcyBkZXByZWNhdGVkLCBhbmQgV2ViVlIgQVBJIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQuJyk7XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FtZXJhQ29tcG9uZW50LnByb3RvdHlwZSwgJ25vZGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkNhbWVyYUNvbXBvbmVudCNub2RlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5DYW1lcmFDb21wb25lbnQjZW50aXR5IGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmVudGl0eTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KExpZ2h0Q29tcG9uZW50LnByb3RvdHlwZSwgJ2VuYWJsZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTGlnaHRDb21wb25lbnQjZW5hYmxlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5MaWdodENvbXBvbmVudCNlbmFibGVkIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmVuYWJsZWQ7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5MaWdodENvbXBvbmVudCNlbmFibGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkxpZ2h0Q29tcG9uZW50I2VuYWJsZWQgaW5zdGVhZC4nKTtcbiAgICAgICAgdGhpcy5lbmFibGVkID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbk1vZGVsQ29tcG9uZW50LnByb3RvdHlwZS5zZXRWaXNpYmxlID0gZnVuY3Rpb24gKHZpc2libGUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb2RlbENvbXBvbmVudCNzZXRWaXNpYmxlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb2RlbENvbXBvbmVudCNlbmFibGVkIGluc3RlYWQuJyk7XG4gICAgdGhpcy5lbmFibGVkID0gdmlzaWJsZTtcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShNb2RlbENvbXBvbmVudC5wcm90b3R5cGUsICdhYWJiJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb2RlbENvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb2RlbENvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb2RlbENvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb2RlbENvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSZW5kZXJDb21wb25lbnQucHJvdG90eXBlLCAnYWFiYicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyQ29tcG9uZW50I2FhYmIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlckNvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJDb21wb25lbnQjYWFiYiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmVuZGVyQ29tcG9uZW50I2N1c3RvbUFhYmIgaW5zdGVhZCAtIHdoaWNoIGV4cGVjdHMgbG9jYWwgc3BhY2UgQUFCQiBpbnN0ZWFkIG9mIGEgd29ybGQgc3BhY2UgQUFCQi4nKTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFJpZ2lkQm9keUNvbXBvbmVudC5wcm90b3R5cGUsICdib2R5VHlwZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50I2JvZHlUeXBlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SaWdpZEJvZHlDb21wb25lbnQjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy50eXBlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnQjYm9keVR5cGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJpZ2lkQm9keUNvbXBvbmVudCN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgfVxufSk7XG5cblJpZ2lkQm9keUNvbXBvbmVudC5wcm90b3R5cGUuc3luY0JvZHlUb0VudGl0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnQjc3luY0JvZHlUb0VudGl0eSBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLicpO1xuICAgIHRoaXMuX3VwZGF0ZUR5bmFtaWMoKTtcbn07XG5cblJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbS5wcm90b3R5cGUuc2V0R3Jhdml0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jc2V0R3Jhdml0eSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI2dyYXZpdHkgaW5zdGVhZC4nKTtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHRoaXMuZ3Jhdml0eS5jb3B5KGFyZ3VtZW50c1swXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5ncmF2aXR5LnNldChhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICB9XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBiYXNpc1NldERvd25sb2FkQ29uZmlnKGdsdWVVcmwsIHdhc21VcmwsIGZhbGxiYWNrVXJsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuYmFzaXNTZXREb3dubG9hZENvbmZpZyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuYmFzaXNJbml0aWFsaXplIGluc3RlYWQuJyk7XG4gICAgYmFzaXNJbml0aWFsaXplKHtcbiAgICAgICAgZ2x1ZVVybDogZ2x1ZVVybCxcbiAgICAgICAgd2FzbVVybDogd2FzbVVybCxcbiAgICAgICAgZmFsbGJhY2tVcmw6IGZhbGxiYWNrVXJsLFxuICAgICAgICBsYXp5SW5pdDogdHJ1ZVxuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlZmlsdGVyQ3ViZW1hcChvcHRpb25zKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMucHJlZmlsdGVyQ3ViZW1hcCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuZW52TGlnaHRpbmcgaW5zdGVhZC4nKTtcbn1cbiJdLCJuYW1lcyI6WyJsb2ciLCJ3cml0ZSIsInRleHQiLCJEZWJ1ZyIsImRlcHJlY2F0ZWQiLCJjb25zb2xlIiwib3BlbiIsInZlcnNpb24iLCJyZXZpc2lvbiIsImluZm8iLCJkZWJ1ZyIsImVycm9yIiwid2FybmluZyIsIndhcm4iLCJhbGVydCIsImFzc2VydCIsImNvbmRpdGlvbiIsInN0cmluZyIsImVuZHNXaXRoIiwicyIsInN1YnMiLCJzdGFydHNXaXRoIiwiVGltZXIiLCJjb25zdHJ1Y3RvciIsIl9pc1J1bm5pbmciLCJfYSIsIl9iIiwic3RhcnQiLCJub3ciLCJzdG9wIiwiZ2V0TWlsbGlzZWNvbmRzIiwidGltZSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiQ29sb3IiLCJwcm90b3R5cGUiLCJnZXQiLCJfZGF0YSIsIkZsb2F0MzJBcnJheSIsInIiLCJnIiwiYiIsImEiLCJfZGF0YTMiLCJpbmhlcml0cyIsIlNlbGYiLCJTdXBlciIsIlRlbXAiLCJGdW5jIiwiYXJnMSIsImFyZzIiLCJhcmczIiwiYXJnNCIsImFyZzUiLCJhcmc2IiwiYXJnNyIsImFyZzgiLCJjYWxsIiwiX3N1cGVyIiwibWFrZUFycmF5IiwiYXJyIiwiQXJyYXkiLCJzbGljZSIsImNyZWF0ZVN0eWxlIiwiY3NzU3RyaW5nIiwicmVzdWx0IiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwidHlwZSIsInN0eWxlU2hlZXQiLCJjc3NUZXh0IiwiYXBwZW5kQ2hpbGQiLCJjcmVhdGVUZXh0Tm9kZSIsIm1hdGgiLCJJTlZfTE9HMiIsIk1hdGgiLCJMT0cyRSIsImludFRvQnl0ZXMiLCJpbnRUb0J5dGVzMzIiLCJieXRlc1RvSW50IiwiYnl0ZXNUb0ludDMyIiwiVmVjMiIsIngiLCJ5Iiwic2NhbGUiLCJtdWxTY2FsYXIiLCJWZWMzIiwieiIsIlZlYzQiLCJ3Iiwic2hhcGUiLCJBYWJiIiwiQm91bmRpbmdCb3giLCJTcGhlcmUiLCJCb3VuZGluZ1NwaGVyZSIsIlBsYW5lIiwiaW50ZXJzZWN0UmF5IiwiaW50ZXJzZWN0c1JheSIsIkZydXN0dW0iLCJ1cGRhdGUiLCJwcm9qZWN0aW9uTWF0cml4Iiwidmlld01hdHJpeCIsInZpZXdQcm9qIiwiTWF0NCIsIm11bDIiLCJzZXRGcm9tTWF0NCIsIkVMRU1FTlRUWVBFX0lOVDgiLCJUWVBFX0lOVDgiLCJFTEVNRU5UVFlQRV9VSU5UOCIsIlRZUEVfVUlOVDgiLCJFTEVNRU5UVFlQRV9JTlQxNiIsIlRZUEVfSU5UMTYiLCJFTEVNRU5UVFlQRV9VSU5UMTYiLCJUWVBFX1VJTlQxNiIsIkVMRU1FTlRUWVBFX0lOVDMyIiwiVFlQRV9JTlQzMiIsIkVMRU1FTlRUWVBFX1VJTlQzMiIsIlRZUEVfVUlOVDMyIiwiRUxFTUVOVFRZUEVfRkxPQVQzMiIsIlRZUEVfRkxPQVQzMiIsIlBJWEVMRk9STUFUX0w4X0E4IiwiUElYRUxGT1JNQVRfTEE4IiwiUElYRUxGT1JNQVRfUjVfRzZfQjUiLCJQSVhFTEZPUk1BVF9SR0I1NjUiLCJQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMSIsIlBJWEVMRk9STUFUX1JHQkE1NTUxIiwiUElYRUxGT1JNQVRfUjRfRzRfQjRfQTQiLCJQSVhFTEZPUk1BVF9SR0JBNCIsIlBJWEVMRk9STUFUX1I4X0c4X0I4IiwiUElYRUxGT1JNQVRfUkdCOCIsIlBJWEVMRk9STUFUX1I4X0c4X0I4X0E4IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJCTEVORE1PREVfQ09OU1RBTlRfQ09MT1IiLCJCTEVORE1PREVfQ09OU1RBTlQiLCJCTEVORE1PREVfT05FX01JTlVTX0NPTlNUQU5UX0NPTE9SIiwiQkxFTkRNT0RFX09ORV9NSU5VU19DT05TVEFOVCIsIkJMRU5ETU9ERV9DT05TVEFOVF9BTFBIQSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlRfQUxQSEEiLCJVbnN1cHBvcnRlZEJyb3dzZXJFcnJvciIsIm1lc3NhZ2UiLCJuYW1lIiwiRXJyb3IiLCJDb250ZXh0Q3JlYXRpb25FcnJvciIsInByb2dyYW1saWIiLCJiZWdpbiIsImR1bW15RnJhZ21lbnRDb2RlIiwiU2hhZGVyVXRpbHMiLCJlbmQiLCJmb2dDb2RlIiwiZ2FtbWFDb2RlIiwicHJlY2lzaW9uQ29kZSIsInNraW5Db2RlIiwidG9uZW1hcENvZGUiLCJ2ZXJzaW9uQ29kZSIsImdmeCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiQUREUkVTU19SRVBFQVQiLCJCTEVORE1PREVfWkVSTyIsIkJMRU5ETU9ERV9PTkUiLCJCTEVORE1PREVfU1JDX0NPTE9SIiwiQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1IiLCJCTEVORE1PREVfRFNUX0NPTE9SIiwiQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1IiLCJCTEVORE1PREVfU1JDX0FMUEhBIiwiQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBIiwiQkxFTkRNT0RFX0RTVF9BTFBIQSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBIiwiQlVGRkVSX1NUQVRJQyIsIkJVRkZFUl9EWU5BTUlDIiwiQlVGRkVSX1NUUkVBTSIsIkNVTExGQUNFX05PTkUiLCJDVUxMRkFDRV9CQUNLIiwiQ1VMTEZBQ0VfRlJPTlQiLCJDVUxMRkFDRV9GUk9OVEFOREJBQ0siLCJGSUxURVJfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVIiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiSU5ERVhGT1JNQVRfVUlOVDgiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJQUklNSVRJVkVfUE9JTlRTIiwiUFJJTUlUSVZFX0xJTkVTIiwiUFJJTUlUSVZFX0xJTkVMT09QIiwiUFJJTUlUSVZFX0xJTkVTVFJJUCIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiU0VNQU5USUNfUE9TSVRJT04iLCJTRU1BTlRJQ19OT1JNQUwiLCJTRU1BTlRJQ19DT0xPUiIsIlNFTUFOVElDX1RFWENPT1JEIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwiU0VNQU5USUNfVEVYQ09PUkQxIiwiU0VNQU5USUNfQVRUUjAiLCJTRU1BTlRJQ19BVFRSMSIsIlNFTUFOVElDX0FUVFIyIiwiU0VNQU5USUNfQVRUUjMiLCJURVhUVVJFTE9DS19SRUFEIiwiVEVYVFVSRUxPQ0tfV1JJVEUiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJzaGFkZXJDaHVua3MiLCJEZXZpY2UiLCJHcmFwaGljc0RldmljZSIsIkluZGV4QnVmZmVyIiwiUHJvZ3JhbUxpYnJhcnkiLCJSZW5kZXJUYXJnZXQiLCJTY29wZUlkIiwiU2hhZGVyIiwiU2hhZGVySW5wdXQiLCJXZWJnbFNoYWRlcklucHV0IiwiVGV4dHVyZSIsIlZlcnRleEJ1ZmZlciIsIlZlcnRleEZvcm1hdCIsIlZlcnRleEl0ZXJhdG9yIiwiX3ZpZXdwb3J0IiwiZHJhd0Z1bGxzY3JlZW5RdWFkIiwiZGV2aWNlIiwidGFyZ2V0IiwidmVydGV4QnVmZmVyIiwic2hhZGVyIiwicmVjdCIsInZpZXdwb3J0Iiwid2lkdGgiLCJoIiwiaGVpZ2h0Iiwic2V0IiwicG9zdGVmZmVjdCIsImNyZWF0ZUZ1bGxzY3JlZW5RdWFkIiwicXVhZFZlcnRleEJ1ZmZlciIsIlBvc3RFZmZlY3QiLCJQb3N0RWZmZWN0UXVldWUiLCJ0cmFuc2Zvcm1WUyIsImRlcHJlY2F0ZWRDaHVua3MiLCJrZXlzIiwiZm9yRWFjaCIsImNodW5rTmFtZSIsInJlcGxhY2VtZW50IiwidXNlSW5zdGVhZCIsIm1zZyIsImRlZmluZVByb3BlcnRpZXMiLCJfZ2xGcmFtZUJ1ZmZlciIsImltcGwiLCJyZ2JtIiwiZ2V0RGVmYXVsdEluc3RhbmNpbmdGb3JtYXQiLCJHcmFwaGljc0RldmljZUFjY2VzcyIsIlRFWFRVUkVUWVBFX1JHQk0iLCJURVhUVVJFVFlQRV9ERUZBVUxUIiwic3dpenpsZUdHR1IiLCJURVhUVVJFVFlQRV9TV0laWkxFR0dHUiIsIl9nbFRleHR1cmUiLCJnZXRQcm9ncmFtTGlicmFyeSIsInNldFByb2dyYW1MaWJyYXJ5IiwibGliIiwicmVtb3ZlU2hhZGVyRnJvbUNhY2hlIiwicmVtb3ZlRnJvbUNhY2hlIiwiX3RlbXBCbGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsIl90ZW1wRGVwdGhTdGF0ZSIsIkRlcHRoU3RhdGUiLCJzZXRCbGVuZEZ1bmN0aW9uIiwiYmxlbmRTcmMiLCJibGVuZERzdCIsImN1cnJlbnRCbGVuZFN0YXRlIiwiYmxlbmRTdGF0ZSIsImNvcHkiLCJzZXRDb2xvckJsZW5kIiwiY29sb3JPcCIsInNldEFscGhhQmxlbmQiLCJhbHBoYU9wIiwic2V0QmxlbmRTdGF0ZSIsInNldEJsZW5kRnVuY3Rpb25TZXBhcmF0ZSIsImJsZW5kU3JjQWxwaGEiLCJibGVuZERzdEFscGhhIiwic2V0QmxlbmRFcXVhdGlvbiIsImJsZW5kRXF1YXRpb24iLCJjb2xvclNyY0ZhY3RvciIsImNvbG9yRHN0RmFjdG9yIiwiYWxwaGFTcmNGYWN0b3IiLCJhbHBoYURzdEZhY3RvciIsInNldEJsZW5kRXF1YXRpb25TZXBhcmF0ZSIsImJsZW5kQWxwaGFFcXVhdGlvbiIsInNldENvbG9yV3JpdGUiLCJyZWRXcml0ZSIsImdyZWVuV3JpdGUiLCJibHVlV3JpdGUiLCJhbHBoYVdyaXRlIiwiZ2V0QmxlbmRpbmciLCJibGVuZCIsInNldEJsZW5kaW5nIiwiYmxlbmRpbmciLCJzZXREZXB0aFdyaXRlIiwiZGVwdGhTdGF0ZSIsInNldERlcHRoU3RhdGUiLCJzZXREZXB0aEZ1bmMiLCJmdW5jIiwic2V0RGVwdGhUZXN0IiwidGVzdCIsIlBob25nTWF0ZXJpYWwiLCJTdGFuZGFyZE1hdGVyaWFsIiwic2NlbmUiLCJwYXJ0aXRpb25Ta2luIiwicHJvY2VkdXJhbCIsImNhbGN1bGF0ZVRhbmdlbnRzIiwiY3JlYXRlTWVzaCIsImNyZWF0ZVRvcnVzIiwiY3JlYXRlQ3lsaW5kZXIiLCJjcmVhdGVDYXBzdWxlIiwiY3JlYXRlQ29uZSIsImNyZWF0ZVNwaGVyZSIsImNyZWF0ZVBsYW5lIiwiY3JlYXRlQm94IiwiQmFzaWNNYXRlcmlhbCIsIkNvbW1hbmQiLCJGb3J3YXJkUmVuZGVyZXIiLCJHcmFwaE5vZGUiLCJNYXRlcmlhbCIsIk1lc2giLCJNZXNoSW5zdGFuY2UiLCJNb2RlbCIsIlBhcnRpY2xlRW1pdHRlciIsIlBpY2tlciIsIlByb2plY3Rpb24iLCJPUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsIlBFUlNQRUNUSVZFIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsIlNjZW5lIiwiU2tpbiIsIlNraW5JbnN0YW5jZSIsImdldERlZmF1bHRNYXRlcmlhbCIsImdldEFwcGxpY2F0aW9uIiwiZ3JhcGhpY3NEZXZpY2UiLCJzaXplIiwiaW5kZXgiLCJfcHJlZmlsdGVyZWRDdWJlbWFwcyIsInZhbHVlIiwidXBkYXRlU2hhZGVycyIsIl9tb2RlbHMiLCJMYXllciIsInJ0IiwiX3JlbmRlclRhcmdldCIsIl9kaXJ0eUNhbWVyYXMiLCJfdXBkYXRlU2t5Ym94IiwiX3VwZGF0ZVNreSIsImFkZE1vZGVsIiwibW9kZWwiLCJjb250YWluc01vZGVsIiwibGF5ZXIiLCJsYXllcnMiLCJnZXRMYXllckJ5SWQiLCJMQVlFUklEX1dPUkxEIiwiYWRkTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZXMiLCJtb2RlbHMiLCJwdXNoIiwiYWRkU2hhZG93Q2FzdGVyIiwiYWRkU2hhZG93Q2FzdGVycyIsInJlbW92ZU1vZGVsIiwiaW5kZXhPZiIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJzcGxpY2UiLCJyZW1vdmVTaGFkb3dDYXN0ZXJzIiwiZ2V0TW9kZWxzIiwiQmF0Y2giLCJyZW5kZXJDb21wb3NpdGlvbiIsImNvbXAiLCJ1cGRhdGVTaGFkZXIiLCJtZXNoSW5zdGFuY2UiLCJvYmpEZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsIm1hdGVyaWFsIiwiX3NjZW5lIiwidXBkYXRlUGFzc1NoYWRlciIsInN5bmNBYWJiIiwiTW9ycGgiLCJnZXRUYXJnZXQiLCJ0YXJnZXRzIiwiX2RpcnRpZnkiLCJsb2NhbCIsIl9kaXJ0aWZ5TG9jYWwiLCJfZGlydGlmeVdvcmxkIiwiYWRkTGFiZWwiLCJsYWJlbCIsIl9sYWJlbHMiLCJnZXRMYWJlbHMiLCJoYXNMYWJlbCIsInJlbW92ZUxhYmVsIiwiZmluZEJ5TGFiZWwiLCJyZXN1bHRzIiwiaSIsIl9jaGlsZHJlbiIsImxlbmd0aCIsImdldENoaWxkcmVuIiwiY2hpbGRyZW4iLCJnZXROYW1lIiwiZ2V0UGF0aCIsInBhdGgiLCJnZXRSb290Iiwicm9vdCIsImdldFBhcmVudCIsInBhcmVudCIsInNldE5hbWUiLCJnZXRTaGFkZXIiLCJzZXRTaGFkZXIiLCJnbG9zcyIsIl9kZWZpbmVBbGlhcyIsIm5ld05hbWUiLCJvbGROYW1lIiwiX2RlZmluZU9wdGlvbiIsIlN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIiwibGl0T3B0aW9ucyIsInRlbXBPcHRpb25zIiwiTGl0T3B0aW9ucyIsImxpdE9wdGlvblByb3BlcnRpZXMiLCJnZXRPd25Qcm9wZXJ0eU5hbWVzIiwibGl0T3B0aW9uIiwiYW5pbSIsIkFuaW1hdGlvbiIsIktleSIsIk5vZGUiLCJTa2VsZXRvbiIsImdldER1cmF0aW9uIiwiZHVyYXRpb24iLCJnZXROb2RlcyIsIm5vZGVzIiwic2V0RHVyYXRpb24iLCJnZXRBbmltYXRpb24iLCJhbmltYXRpb24iLCJnZXRDdXJyZW50VGltZSIsImN1cnJlbnRUaW1lIiwiZ2V0TG9vcGluZyIsImxvb3BpbmciLCJnZXROdW1Ob2RlcyIsIm51bU5vZGVzIiwic2V0QW5pbWF0aW9uIiwic2V0Q3VycmVudFRpbWUiLCJzZXRMb29waW5nIiwiYXVkaW8iLCJBdWRpb01hbmFnZXIiLCJTb3VuZE1hbmFnZXIiLCJDaGFubmVsIiwiQ2hhbm5lbDNkIiwiTGlzdGVuZXIiLCJTb3VuZCIsImdldExpc3RlbmVyIiwibGlzdGVuZXIiLCJnZXRWb2x1bWUiLCJ2b2x1bWUiLCJzZXRWb2x1bWUiLCJhc3NldCIsIkFTU0VUX0FOSU1BVElPTiIsIkFTU0VUX0FVRElPIiwiQVNTRVRfSU1BR0UiLCJBU1NFVF9KU09OIiwiQVNTRVRfTU9ERUwiLCJBU1NFVF9NQVRFUklBTCIsIkFTU0VUX1RFWFQiLCJBU1NFVF9URVhUVVJFIiwiQVNTRVRfQ1VCRU1BUCIsIkFTU0VUX1NDUklQVCIsIkFzc2V0UmVnaXN0cnkiLCJnZXRBc3NldEJ5SWQiLCJpZCIsIlhySW5wdXRTb3VyY2UiLCJfcmF5TG9jYWwiLCJfbG9jYWxQb3NpdGlvbiIsIl9sb2NhbFJvdGF0aW9uIiwiaW5wdXQiLCJnZXRUb3VjaFRhcmdldENvb3JkcyIsIkNvbnRyb2xsZXIiLCJHYW1lUGFkcyIsIktleWJvYXJkIiwiS2V5Ym9hcmRFdmVudCIsIk1vdXNlIiwiTW91c2VFdmVudCIsIlRvdWNoIiwiVG91Y2hEZXZpY2UiLCJUb3VjaEV2ZW50IiwiRWxlbWVudElucHV0Iiwid2hlZWxEZWx0YSIsIlJJR0lEQk9EWV9UWVBFX1NUQVRJQyIsIkJPRFlUWVBFX1NUQVRJQyIsIlJJR0lEQk9EWV9UWVBFX0RZTkFNSUMiLCJCT0RZVFlQRV9EWU5BTUlDIiwiUklHSURCT0RZX1RZUEVfS0lORU1BVElDIiwiQk9EWVRZUEVfS0lORU1BVElDIiwiUklHSURCT0RZX0NGX1NUQVRJQ19PQkpFQ1QiLCJCT0RZRkxBR19TVEFUSUNfT0JKRUNUIiwiUklHSURCT0RZX0NGX0tJTkVNQVRJQ19PQkpFQ1QiLCJCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUIiwiUklHSURCT0RZX0NGX05PUkVTUE9OU0VfT0JKRUNUIiwiQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QiLCJSSUdJREJPRFlfQUNUSVZFX1RBRyIsIkJPRFlTVEFURV9BQ1RJVkVfVEFHIiwiUklHSURCT0RZX0lTTEFORF9TTEVFUElORyIsIkJPRFlTVEFURV9JU0xBTkRfU0xFRVBJTkciLCJSSUdJREJPRFlfV0FOVFNfREVBQ1RJVkFUSU9OIiwiQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTiIsIlJJR0lEQk9EWV9ESVNBQkxFX0RFQUNUSVZBVElPTiIsIkJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiIsIlJJR0lEQk9EWV9ESVNBQkxFX1NJTVVMQVRJT04iLCJCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OIiwiQXBwQmFzZSIsImlzRnVsbHNjcmVlbiIsImZ1bGxzY3JlZW5FbGVtZW50IiwiZW5hYmxlRnVsbHNjcmVlbiIsImVsZW1lbnQiLCJzdWNjZXNzIiwiY2FudmFzIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImUiLCJhZGRFdmVudExpc3RlbmVyIiwicmVxdWVzdEZ1bGxzY3JlZW4iLCJFbGVtZW50IiwiQUxMT1dfS0VZQk9BUkRfSU5QVVQiLCJkaXNhYmxlRnVsbHNjcmVlbiIsImV4aXRGdWxsc2NyZWVuIiwiZ2V0U2NlbmVVcmwiLCJlbnRyeSIsInNjZW5lcyIsImZpbmQiLCJ1cmwiLCJsb2FkU2NlbmUiLCJjYWxsYmFjayIsImxvYWRTY2VuZUhpZXJhcmNoeSIsImxvYWRTY2VuZVNldHRpbmdzIiwicmVuZGVyTWVzaEluc3RhbmNlIiwib3B0aW9ucyIsImRlZmF1bHREcmF3TGF5ZXIiLCJpbW1lZGlhdGUiLCJkcmF3TWVzaCIsInJlbmRlck1lc2giLCJtZXNoIiwibWF0cml4IiwiX2FkZExpbmVzIiwicG9zaXRpb25zIiwiY29sb3JzIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJkZXB0aFRlc3QiLCJ1bmRlZmluZWQiLCJiYXRjaCIsImdldEJhdGNoIiwiYWRkTGluZXMiLCJyZW5kZXJMaW5lIiwiY29sb3IiLCJlbmRDb2xvciIsImFyZ3VtZW50cyIsIkxJTkVCQVRDSF9PVkVSTEFZIiwicmVuZGVyTGluZXMiLCJwb3NpdGlvbiIsIm11bHRpQ29sb3IiLCJlbmFibGVWciIsIkNhbWVyYUNvbXBvbmVudCIsImVudGl0eSIsIkxpZ2h0Q29tcG9uZW50IiwiZW5hYmxlZCIsIk1vZGVsQ29tcG9uZW50Iiwic2V0VmlzaWJsZSIsInZpc2libGUiLCJSZW5kZXJDb21wb25lbnQiLCJSaWdpZEJvZHlDb21wb25lbnQiLCJzeW5jQm9keVRvRW50aXR5IiwiX3VwZGF0ZUR5bmFtaWMiLCJSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0iLCJzZXRHcmF2aXR5IiwiZ3Jhdml0eSIsImJhc2lzU2V0RG93bmxvYWRDb25maWciLCJnbHVlVXJsIiwid2FzbVVybCIsImZhbGxiYWNrVXJsIiwiYmFzaXNJbml0aWFsaXplIiwibGF6eUluaXQiLCJwcmVmaWx0ZXJDdWJlbWFwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXdIQTs7QUFFTyxNQUFNQSxHQUFHLEdBQUc7QUFDZkMsRUFBQUEsS0FBSyxFQUFFLFVBQVVDLElBQUksRUFBRTtBQUNuQkMsSUFBQUEsS0FBSyxDQUFDQyxVQUFVLENBQUMsc0RBQXNELENBQUMsQ0FBQTtBQUN4RUMsSUFBQUEsT0FBTyxDQUFDTCxHQUFHLENBQUNFLElBQUksQ0FBQyxDQUFBO0dBQ3BCO0VBRURJLElBQUksRUFBRSxZQUFZO0FBQ2RILElBQUFBLEtBQUssQ0FBQ0MsVUFBVSxDQUFDLHFEQUFxRCxDQUFDLENBQUE7SUFDdkVKLEdBQUcsQ0FBQ0MsS0FBSyxDQUFDLHdCQUF3QixHQUFHTSxPQUFPLEdBQUcsR0FBRyxHQUFHQyxRQUFRLENBQUMsQ0FBQTtHQUNqRTtBQUVEQyxFQUFBQSxJQUFJ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QUFDZCxNQUFBLElBQUksQ0FBQ0EsTUFBTSxHQUFHLElBQUlMLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyQyxLQUFBO0lBQ0EsSUFBSSxDQUFDSyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDSixDQUFDLENBQUE7SUFDdkIsSUFBSSxDQUFDSSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDSCxDQUFDLENBQUE7SUFDdkIsSUFBSSxDQUFDRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDRixDQUFDLENBQUE7SUFDdkIsT0FBTyxJQUFJLENBQUNFLE1BQU0sQ0FBQTtBQUN0QixHQUFBO0FBQ0osQ0FBQyxDQUFDLENBQUE7QUFFSyxTQUFTQyxRQUFRQSxDQUFDQyxJQUFJLEVBQUVDLEtBQUssRUFBRTtBQUNsQyxFQUFBLE1BQU1DLElBQUksR0FBRyxTQUFQQSxJQUFJQSxHQUFlLEVBQUUsQ0FBQTtFQUMzQixNQUFNQyxJQUFJLEdBQUcsU0FBUEEsSUFBSUEsQ0FBYUMsSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLEVBQUU7SUFDbkVWLEtBQUssQ0FBQ1csSUFBSSxDQUFDLElBQUksRUFBRVIsSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLENBQUMsQ0FBQTtJQUNoRVgsSUFBSSxDQUFDWSxJQUFJLENBQUMsSUFBSSxFQUFFUixJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksQ0FBQyxDQUFBO0FBQy9EO0dBQ0gsQ0FBQTs7QUFDRFIsRUFBQUEsSUFBSSxDQUFDVSxNQUFNLEdBQUdaLEtBQUssQ0FBQ1gsU0FBUyxDQUFBO0FBQzdCWSxFQUFBQSxJQUFJ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
