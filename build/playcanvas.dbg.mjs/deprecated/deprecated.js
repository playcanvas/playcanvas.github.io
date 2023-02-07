/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
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
import { TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BLENDMODE_ZERO, BLENDMODE_ONE, BLENDMODE_SRC_COLOR, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_ALPHA, BUFFER_STATIC, BUFFER_DYNAMIC, BUFFER_STREAM, CULLFACE_NONE, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_COLOR, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTURETYPE_RGBM, TEXTURETYPE_DEFAULT, TEXTURETYPE_SWIZZLEGGGR } from '../platform/graphics/constants.js';
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

export { ContextCreationError, ELEMENTTYPE_FLOAT32, ELEMENTTYPE_INT16, ELEMENTTYPE_INT32, ELEMENTTYPE_INT8, ELEMENTTYPE_UINT16, ELEMENTTYPE_UINT32, ELEMENTTYPE_UINT8, PIXELFORMAT_L8_A8, PIXELFORMAT_R4_G4_B4_A4, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PhongMaterial, RIGIDBODY_ACTIVE_TAG, RIGIDBODY_CF_KINEMATIC_OBJECT, RIGIDBODY_CF_NORESPONSE_OBJECT, RIGIDBODY_CF_STATIC_OBJECT, RIGIDBODY_DISABLE_DEACTIVATION, RIGIDBODY_DISABLE_SIMULATION, RIGIDBODY_ISLAND_SLEEPING, RIGIDBODY_TYPE_DYNAMIC, RIGIDBODY_TYPE_KINEMATIC, RIGIDBODY_TYPE_STATIC, RIGIDBODY_WANTS_DEACTIVATION, UnsupportedBrowserError, anim, asset, audio, basisSetDownloadConfig, createStyle, drawFullscreenQuad, gfx, inherits, input, log, makeArray, posteffect, prefilterCubemap, programlib, scene, shape, time };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwcmVjYXRlZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2RlcHJlY2F0ZWQvZGVwcmVjYXRlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXZpc2lvbiwgdmVyc2lvbiB9IGZyb20gJy4uL2NvcmUvY29yZS5qcyc7XG5pbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuLi9jb3JlL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuaW1wb3J0IHsgQm91bmRpbmdTcGhlcmUgfSBmcm9tICcuLi9jb3JlL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5pbXBvcnQgeyBGcnVzdHVtIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9mcnVzdHVtLmpzJztcbmltcG9ydCB7IFBsYW5lIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9wbGFuZS5qcyc7XG5cbmltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCwgQUREUkVTU19SRVBFQVQsXG4gICAgQkxFTkRNT0RFX1pFUk8sIEJMRU5ETU9ERV9PTkUsIEJMRU5ETU9ERV9TUkNfQ09MT1IsIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9EU1RfQ09MT1IsIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SLCBCTEVORE1PREVfU1JDX0FMUEhBLCBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFLFxuICAgIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBLCBCTEVORE1PREVfRFNUX0FMUEhBLCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICBCVUZGRVJfU1RBVElDLCBCVUZGRVJfRFlOQU1JQywgQlVGRkVSX1NUUkVBTSxcbiAgICBDVUxMRkFDRV9OT05FLCBDVUxMRkFDRV9CQUNLLCBDVUxMRkFDRV9GUk9OVCwgQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLLFxuICAgIEZJTFRFUl9ORUFSRVNULCBGSUxURVJfTElORUFSLCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUixcbiAgICBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNULCBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDgsIElOREVYRk9STUFUX1VJTlQxNiwgSU5ERVhGT1JNQVRfVUlOVDMyLFxuICAgIFBJWEVMRk9STUFUX0xBOCwgUElYRUxGT1JNQVRfUkdCNTY1LCBQSVhFTEZPUk1BVF9SR0JBNTU1MSwgUElYRUxGT1JNQVRfUkdCQTQsIFBJWEVMRk9STUFUX1JHQjgsIFBJWEVMRk9STUFUX1JHQkE4LFxuICAgIFBSSU1JVElWRV9QT0lOVFMsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX0xJTkVMT09QLCBQUklNSVRJVkVfTElORVNUUklQLFxuICAgIFBSSU1JVElWRV9UUklBTkdMRVMsIFBSSU1JVElWRV9UUklTVFJJUCwgUFJJTUlUSVZFX1RSSUZBTixcbiAgICBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19DT0xPUiwgU0VNQU5USUNfVEVYQ09PUkQsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBTRU1BTlRJQ19URVhDT09SRDEsIFNFTUFOVElDX0FUVFIwLCBTRU1BTlRJQ19BVFRSMSwgU0VNQU5USUNfQVRUUjIsIFNFTUFOVElDX0FUVFIzLFxuICAgIFRFWFRVUkVMT0NLX1JFQUQsIFRFWFRVUkVMT0NLX1dSSVRFLFxuICAgIFRFWFRVUkVUWVBFX0RFRkFVTFQsIFRFWFRVUkVUWVBFX1JHQk0sIFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSLFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGJlZ2luLCBlbmQsIGZvZ0NvZGUsIGdhbW1hQ29kZSwgc2tpbkNvZGUsIHRvbmVtYXBDb2RlIH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtcy9jb21tb24uanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vc2NlbmUvZ3JhcGhpY3MvcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgc2hhZGVyQ2h1bmtzIH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFBvc3RFZmZlY3QgfSBmcm9tICcuLi9zY2VuZS9ncmFwaGljcy9wb3N0LWVmZmVjdC5qcyc7XG5pbXBvcnQgeyBQb3N0RWZmZWN0UXVldWUgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvcG9zdC1lZmZlY3QtcXVldWUuanMnO1xuaW1wb3J0IHsgUHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW0tbGlicmFyeS5qcyc7XG5pbXBvcnQgeyBnZXRQcm9ncmFtTGlicmFyeSwgc2V0UHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zY2VuZS9zaGFkZXItbGliL2dldC1wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBTY29wZUlkIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2NvcGUtaWQuanMnO1xuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzJztcbmltcG9ydCB7IFdlYmdsU2hhZGVySW5wdXQgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy93ZWJnbC93ZWJnbC1zaGFkZXItaW5wdXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcbmltcG9ydCB7IFZlcnRleEl0ZXJhdG9yIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWl0ZXJhdG9yLmpzJztcbmltcG9ydCB7IFNoYWRlclV0aWxzIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXV0aWxzLmpzJztcbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlQWNjZXNzIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLWFjY2Vzcy5qcyc7XG5cbmltcG9ydCB7IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLCBMQVlFUklEX0lNTUVESUFURSwgTElORUJBVENIX09WRVJMQVksIExBWUVSSURfV09STEQgfSBmcm9tICcuLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgY2FsY3VsYXRlVGFuZ2VudHMsIGNyZWF0ZUJveCwgY3JlYXRlQ2Fwc3VsZSwgY3JlYXRlQ29uZSwgY3JlYXRlQ3lsaW5kZXIsIGNyZWF0ZU1lc2gsIGNyZWF0ZVBsYW5lLCBjcmVhdGVTcGhlcmUsIGNyZWF0ZVRvcnVzIH0gZnJvbSAnLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBwYXJ0aXRpb25Ta2luIH0gZnJvbSAnLi4vc2NlbmUvc2tpbi1wYXJ0aXRpb24uanMnO1xuaW1wb3J0IHsgQmFzaWNNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9iYXNpYy1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBGb3J3YXJkUmVuZGVyZXIgfSBmcm9tICcuLi9zY2VuZS9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UsIENvbW1hbmQgfSBmcm9tICcuLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgUGFydGljbGVFbWl0dGVyIH0gZnJvbSAnLi4vc2NlbmUvcGFydGljbGUtc3lzdGVtL3BhcnRpY2xlLWVtaXR0ZXIuanMnO1xuaW1wb3J0IHsgUGlja2VyIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2dyYXBoaWNzL3BpY2tlci5qcyc7XG5pbXBvcnQgeyBTY2VuZSB9IGZyb20gJy4uL3NjZW5lL3NjZW5lLmpzJztcbmltcG9ydCB7IFNraW4gfSBmcm9tICcuLi9zY2VuZS9za2luLmpzJztcbmltcG9ydCB7IFNraW5JbnN0YW5jZSB9IGZyb20gJy4uL3NjZW5lL3NraW4taW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBCYXRjaCB9IGZyb20gJy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9kZWZhdWx0LW1hdGVyaWFsLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTGl0T3B0aW9ucyB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9saXQtb3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4uL3NjZW5lL2xheWVyLmpzJztcblxuaW1wb3J0IHsgQW5pbWF0aW9uLCBLZXksIE5vZGUgfSBmcm9tICcuLi9zY2VuZS9hbmltYXRpb24vYW5pbWF0aW9uLmpzJztcbmltcG9ydCB7IFNrZWxldG9uIH0gZnJvbSAnLi4vc2NlbmUvYW5pbWF0aW9uL3NrZWxldG9uLmpzJztcblxuaW1wb3J0IHsgQ2hhbm5lbCB9IGZyb20gJy4uL3BsYXRmb3JtL2F1ZGlvL2NoYW5uZWwuanMnO1xuaW1wb3J0IHsgQ2hhbm5lbDNkIH0gZnJvbSAnLi4vcGxhdGZvcm0vYXVkaW8vY2hhbm5lbDNkLmpzJztcbmltcG9ydCB7IExpc3RlbmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vc291bmQvbGlzdGVuZXIuanMnO1xuaW1wb3J0IHsgU291bmQgfSBmcm9tICcuLi9wbGF0Zm9ybS9zb3VuZC9zb3VuZC5qcyc7XG5pbXBvcnQgeyBTb3VuZE1hbmFnZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9zb3VuZC9tYW5hZ2VyLmpzJztcblxuaW1wb3J0IHsgQXNzZXRSZWdpc3RyeSB9IGZyb20gJy4uL2ZyYW1ld29yay9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5cbmltcG9ydCB7IFhySW5wdXRTb3VyY2UgfSBmcm9tICcuLi9mcmFtZXdvcmsveHIveHItaW5wdXQtc291cmNlLmpzJztcblxuaW1wb3J0IHsgQ29udHJvbGxlciB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L2NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgRWxlbWVudElucHV0IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnO1xuaW1wb3J0IHsgR2FtZVBhZHMgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9nYW1lLXBhZHMuanMnO1xuaW1wb3J0IHsgS2V5Ym9hcmQgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9rZXlib2FyZC5qcyc7XG5pbXBvcnQgeyBLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQva2V5Ym9hcmQtZXZlbnQuanMnO1xuaW1wb3J0IHsgTW91c2UgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9tb3VzZS5qcyc7XG5pbXBvcnQgeyBNb3VzZUV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UtZXZlbnQuanMnO1xuaW1wb3J0IHsgVG91Y2hEZXZpY2UgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC90b3VjaC1kZXZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0VG91Y2hUYXJnZXRDb29yZHMsIFRvdWNoLCBUb3VjaEV2ZW50IH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvdG91Y2gtZXZlbnQuanMnO1xuXG5pbXBvcnQgeyBBcHBCYXNlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2FwcC1iYXNlLmpzJztcbmltcG9ydCB7IGdldEFwcGxpY2F0aW9uIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2dsb2JhbHMuanMnO1xuaW1wb3J0IHsgQ2FtZXJhQ29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBMaWdodENvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2xpZ2h0L2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBNb2RlbENvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL21vZGVsL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBSZW5kZXJDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yZW5kZXIvY29tcG9uZW50LmpzJztcbmltcG9ydCB7XG4gICAgQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCwgQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QsIEJPRFlGTEFHX1NUQVRJQ19PQkpFQ1QsXG4gICAgQk9EWVNUQVRFX0FDVElWRV9UQUcsIEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiwgQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiwgQk9EWVNUQVRFX0lTTEFORF9TTEVFUElORywgQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTixcbiAgICBCT0RZVFlQRV9EWU5BTUlDLCBCT0RZVFlQRV9LSU5FTUFUSUMsIEJPRFlUWVBFX1NUQVRJQ1xufSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0gfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9yaWdpZC1ib2R5L3N5c3RlbS5qcyc7XG5pbXBvcnQgeyBiYXNpc0luaXRpYWxpemUgfSBmcm9tICcuLi9mcmFtZXdvcmsvaGFuZGxlcnMvYmFzaXMuanMnO1xuXG4vLyBDT1JFXG5cbmV4cG9ydCBjb25zdCBsb2cgPSB7XG4gICAgd3JpdGU6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy53cml0ZSBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5sb2cgaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS5sb2codGV4dCk7XG4gICAgfSxcblxuICAgIG9wZW46IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLm9wZW4gaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGxvZy53cml0ZSgnUG93ZXJlZCBieSBQbGF5Q2FudmFzICcgKyB2ZXJzaW9uICsgJyAnICsgcmV2aXNpb24pO1xuICAgIH0sXG5cbiAgICBpbmZvOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuaW5mbyBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5pbmZvIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUuaW5mbygnSU5GTzogICAgJyArIHRleHQpO1xuICAgIH0sXG5cbiAgICBkZWJ1ZzogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmRlYnVnIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLmRlYnVnIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUuZGVidWcoJ0RFQlVHOiAgICcgKyB0ZXh0KTtcbiAgICB9LFxuXG4gICAgZXJyb3I6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5lcnJvciBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5lcnJvciBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFUlJPUjogICAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIHdhcm5pbmc6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy53YXJuaW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLndhcm4gaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS53YXJuKCdXQVJOSU5HOiAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIGFsZXJ0OiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuYWxlcnQgaXMgZGVwcmVjYXRlZC4gVXNlIGFsZXJ0IGluc3RlYWQuJyk7XG4gICAgICAgIGxvZy53cml0ZSgnQUxFUlQ6ICAgJyArIHRleHQpO1xuICAgICAgICBhbGVydCh0ZXh0KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1hbGVydFxuICAgIH0sXG5cbiAgICBhc3NlcnQ6IGZ1bmN0aW9uIChjb25kaXRpb24sIHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmFzc2VydCBpcyBkZXByZWNhdGVkLiBVc2UgYSBjb25kaXRpb25hbCBwbHVzIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGlmIChjb25kaXRpb24gPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBsb2cud3JpdGUoJ0FTU0VSVDogICcgKyB0ZXh0KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cbnN0cmluZy5lbmRzV2l0aCA9IGZ1bmN0aW9uIChzLCBzdWJzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuc3RyaW5nLmVuZHNXaXRoIGlzIGRlcHJlY2F0ZWQuIFVzZSBTdHJpbmcjZW5kc1dpdGggaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gcy5lbmRzV2l0aChzdWJzKTtcbn07XG5cbnN0cmluZy5zdGFydHNXaXRoID0gZnVuY3Rpb24gKHMsIHN1YnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5zdHJpbmcuc3RhcnRzV2l0aCBpcyBkZXByZWNhdGVkLiBVc2UgU3RyaW5nI3N0YXJ0c1dpdGggaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gcy5zdGFydHNXaXRoKHN1YnMpO1xufTtcblxuY2xhc3MgVGltZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLl9pc1J1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYSA9IDA7XG4gICAgICAgIHRoaXMuX2IgPSAwO1xuICAgIH1cblxuICAgIHN0YXJ0KCkge1xuICAgICAgICB0aGlzLl9pc1J1bm5pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLl9hID0gbm93KCk7XG4gICAgfVxuXG4gICAgc3RvcCgpIHtcbiAgICAgICAgdGhpcy5faXNSdW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2IgPSBub3coKTtcbiAgICB9XG5cbiAgICBnZXRNaWxsaXNlY29uZHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iIC0gdGhpcy5fYTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCB0aW1lID0ge1xuICAgIG5vdzogbm93LFxuICAgIFRpbWVyOiBUaW1lclxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkNvbG9yI2RhdGEgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIGNvbG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy5yO1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy5iO1xuICAgICAgICB0aGlzLl9kYXRhWzNdID0gdGhpcy5hO1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Db2xvciNkYXRhMyBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgY29sb3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEzKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhMyA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YTNbMF0gPSB0aGlzLnI7XG4gICAgICAgIHRoaXMuX2RhdGEzWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhM1syXSA9IHRoaXMuYjtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGEzO1xuICAgIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gaW5oZXJpdHMoU2VsZiwgU3VwZXIpIHtcbiAgICBjb25zdCBUZW1wID0gZnVuY3Rpb24gKCkge307XG4gICAgY29uc3QgRnVuYyA9IGZ1bmN0aW9uIChhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KSB7XG4gICAgICAgIFN1cGVyLmNhbGwodGhpcywgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCk7XG4gICAgICAgIFNlbGYuY2FsbCh0aGlzLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KTtcbiAgICAgICAgLy8gdGhpcy5jb25zdHJ1Y3RvciA9IFNlbGY7XG4gICAgfTtcbiAgICBGdW5jLl9zdXBlciA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBUZW1wLnByb3RvdHlwZSA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBGdW5jLnByb3RvdHlwZSA9IG5ldyBUZW1wKCk7XG5cbiAgICByZXR1cm4gRnVuYztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VBcnJheShhcnIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5tYWtlQXJyYXkgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gVXNlIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFycik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVTdHlsZShjc3NTdHJpbmcpIHtcbiAgICBjb25zdCByZXN1bHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuICAgIHJlc3VsdC50eXBlID0gJ3RleHQvY3NzJztcbiAgICBpZiAocmVzdWx0LnN0eWxlU2hlZXQpIHtcbiAgICAgICAgcmVzdWx0LnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzc1N0cmluZztcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzU3RyaW5nKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gTUFUSFxuXG5tYXRoLklOVl9MT0cyID0gTWF0aC5MT0cyRTtcblxubWF0aC5pbnRUb0J5dGVzID0gbWF0aC5pbnRUb0J5dGVzMzI7XG5tYXRoLmJ5dGVzVG9JbnQgPSBtYXRoLmJ5dGVzVG9JbnQzMjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzIucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjMiNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWMyLnByb3RvdHlwZS5zY2FsZSA9IFZlYzIucHJvdG90eXBlLm11bFNjYWxhcjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzMucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjMyNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHRoaXMuX2RhdGFbMl0gPSB0aGlzLno7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWMzLnByb3RvdHlwZS5zY2FsZSA9IFZlYzMucHJvdG90eXBlLm11bFNjYWxhcjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlYzQucHJvdG90eXBlLCAnZGF0YScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVjNCNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyB2ZWN0b3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX2RhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGFbMF0gPSB0aGlzLng7XG4gICAgICAgIHRoaXMuX2RhdGFbMV0gPSB0aGlzLnk7XG4gICAgICAgIHRoaXMuX2RhdGFbMl0gPSB0aGlzLno7XG4gICAgICAgIHRoaXMuX2RhdGFbM10gPSB0aGlzLnc7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn0pO1xuXG5WZWM0LnByb3RvdHlwZS5zY2FsZSA9IFZlYzQucHJvdG90eXBlLm11bFNjYWxhcjtcblxuLy8gU0hBUEVcblxuZXhwb3J0IGNvbnN0IHNoYXBlID0ge1xuICAgIEFhYmI6IEJvdW5kaW5nQm94LFxuICAgIFNwaGVyZTogQm91bmRpbmdTcGhlcmUsXG4gICAgUGxhbmU6IFBsYW5lXG59O1xuXG5Cb3VuZGluZ1NwaGVyZS5wcm90b3R5cGUuaW50ZXJzZWN0UmF5ID0gQm91bmRpbmdTcGhlcmUucHJvdG90eXBlLmludGVyc2VjdHNSYXk7XG5cbkZydXN0dW0ucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChwcm9qZWN0aW9uTWF0cml4LCB2aWV3TWF0cml4KSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuRnJ1c3R1bSN1cGRhdGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkZydXN0dW0jc2V0RnJvbU1hdDQgaW5zdGVhZC4nKTtcblxuICAgIGNvbnN0IHZpZXdQcm9qID0gbmV3IE1hdDQoKTtcblxuICAgIHZpZXdQcm9qLm11bDIocHJvamVjdGlvbk1hdHJpeCwgdmlld01hdHJpeCk7XG5cbiAgICB0aGlzLnNldEZyb21NYXQ0KHZpZXdQcm9qKTtcbn07XG5cbi8vIEdSQVBISUNTXG5cbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTlQ4ID0gVFlQRV9JTlQ4O1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQ4ID0gVFlQRV9VSU5UODtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTlQxNiA9IFRZUEVfSU5UMTY7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfVUlOVDE2ID0gVFlQRV9VSU5UMTY7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfSU5UMzIgPSBUWVBFX0lOVDMyO1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQzMiA9IFRZUEVfVUlOVDMyO1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX0ZMT0FUMzIgPSBUWVBFX0ZMT0FUMzI7XG5cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9MOF9BOCA9IFBJWEVMRk9STUFUX0xBODtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SNV9HNl9CNSA9IFBJWEVMRk9STUFUX1JHQjU2NTtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMSA9IFBJWEVMRk9STUFUX1JHQkE1NTUxO1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I0X0c0X0I0X0E0ID0gUElYRUxGT1JNQVRfUkdCQTQ7XG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUjhfRzhfQjggPSBQSVhFTEZPUk1BVF9SR0I4O1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4ID0gUElYRUxGT1JNQVRfUkdCQTg7XG5cbmV4cG9ydCBmdW5jdGlvbiBVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcihtZXNzYWdlKSB7XG4gICAgdGhpcy5uYW1lID0gJ1Vuc3VwcG9ydGVkQnJvd3NlckVycm9yJztcbiAgICB0aGlzLm1lc3NhZ2UgPSAobWVzc2FnZSB8fCAnJyk7XG59XG5VbnN1cHBvcnRlZEJyb3dzZXJFcnJvci5wcm90b3R5cGUgPSBFcnJvci5wcm90b3R5cGU7XG5cbmV4cG9ydCBmdW5jdGlvbiBDb250ZXh0Q3JlYXRpb25FcnJvcihtZXNzYWdlKSB7XG4gICAgdGhpcy5uYW1lID0gJ0NvbnRleHRDcmVhdGlvbkVycm9yJztcbiAgICB0aGlzLm1lc3NhZ2UgPSAobWVzc2FnZSB8fCAnJyk7XG59XG5Db250ZXh0Q3JlYXRpb25FcnJvci5wcm90b3R5cGUgPSBFcnJvci5wcm90b3R5cGU7XG5cbmV4cG9ydCBjb25zdCBwcm9ncmFtbGliID0ge1xuICAgIGJlZ2luOiBiZWdpbixcbiAgICBkdW1teUZyYWdtZW50Q29kZTogU2hhZGVyVXRpbHMuZHVtbXlGcmFnbWVudENvZGUsXG4gICAgZW5kOiBlbmQsXG4gICAgZm9nQ29kZTogZm9nQ29kZSxcbiAgICBnYW1tYUNvZGU6IGdhbW1hQ29kZSxcbiAgICBwcmVjaXNpb25Db2RlOiBTaGFkZXJVdGlscy5wcmVjaXNpb25Db2RlLFxuICAgIHNraW5Db2RlOiBza2luQ29kZSxcbiAgICB0b25lbWFwQ29kZTogdG9uZW1hcENvZGUsXG4gICAgdmVyc2lvbkNvZGU6IFNoYWRlclV0aWxzLnZlcnNpb25Db2RlXG59O1xuXG5leHBvcnQgY29uc3QgZ2Z4ID0ge1xuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUOiBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCxcbiAgICBBRERSRVNTX1JFUEVBVDogQUREUkVTU19SRVBFQVQsXG4gICAgQkxFTkRNT0RFX1pFUk86IEJMRU5ETU9ERV9aRVJPLFxuICAgIEJMRU5ETU9ERV9PTkU6IEJMRU5ETU9ERV9PTkUsXG4gICAgQkxFTkRNT0RFX1NSQ19DT0xPUjogQkxFTkRNT0RFX1NSQ19DT0xPUixcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUjogQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1IsXG4gICAgQkxFTkRNT0RFX0RTVF9DT0xPUjogQkxFTkRNT0RFX0RTVF9DT0xPUixcbiAgICBCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUjogQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1IsXG4gICAgQkxFTkRNT0RFX1NSQ19BTFBIQTogQkxFTkRNT0RFX1NSQ19BTFBIQSxcbiAgICBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFOiBCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFLFxuICAgIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBOiBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSxcbiAgICBCTEVORE1PREVfRFNUX0FMUEhBOiBCTEVORE1PREVfRFNUX0FMUEhBLFxuICAgIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBOiBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSxcbiAgICBCVUZGRVJfU1RBVElDOiBCVUZGRVJfU1RBVElDLFxuICAgIEJVRkZFUl9EWU5BTUlDOiBCVUZGRVJfRFlOQU1JQyxcbiAgICBCVUZGRVJfU1RSRUFNOiBCVUZGRVJfU1RSRUFNLFxuICAgIENVTExGQUNFX05PTkU6IENVTExGQUNFX05PTkUsXG4gICAgQ1VMTEZBQ0VfQkFDSzogQ1VMTEZBQ0VfQkFDSyxcbiAgICBDVUxMRkFDRV9GUk9OVDogQ1VMTEZBQ0VfRlJPTlQsXG4gICAgQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLOiBDVUxMRkFDRV9GUk9OVEFOREJBQ0ssXG4gICAgRUxFTUVOVFRZUEVfSU5UODogVFlQRV9JTlQ4LFxuICAgIEVMRU1FTlRUWVBFX1VJTlQ4OiBUWVBFX1VJTlQ4LFxuICAgIEVMRU1FTlRUWVBFX0lOVDE2OiBUWVBFX0lOVDE2LFxuICAgIEVMRU1FTlRUWVBFX1VJTlQxNjogVFlQRV9VSU5UMTYsXG4gICAgRUxFTUVOVFRZUEVfSU5UMzI6IFRZUEVfSU5UMzIsXG4gICAgRUxFTUVOVFRZUEVfVUlOVDMyOiBUWVBFX1VJTlQzMixcbiAgICBFTEVNRU5UVFlQRV9GTE9BVDMyOiBUWVBFX0ZMT0FUMzIsXG4gICAgRklMVEVSX05FQVJFU1Q6IEZJTFRFUl9ORUFSRVNULFxuICAgIEZJTFRFUl9MSU5FQVI6IEZJTFRFUl9MSU5FQVIsXG4gICAgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1Q6IEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNULFxuICAgIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVI6IEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVDogRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCxcbiAgICBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVI6IEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBJTkRFWEZPUk1BVF9VSU5UODogSU5ERVhGT1JNQVRfVUlOVDgsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDE2OiBJTkRFWEZPUk1BVF9VSU5UMTYsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDMyOiBJTkRFWEZPUk1BVF9VSU5UMzIsXG4gICAgUElYRUxGT1JNQVRfUkdCNTY1OiBQSVhFTEZPUk1BVF9SR0I1NjUsXG4gICAgUElYRUxGT1JNQVRfUkdCODogUElYRUxGT1JNQVRfUkdCOCxcbiAgICBQSVhFTEZPUk1BVF9SR0JBODogUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgUFJJTUlUSVZFX1BPSU5UUzogUFJJTUlUSVZFX1BPSU5UUyxcbiAgICBQUklNSVRJVkVfTElORVM6IFBSSU1JVElWRV9MSU5FUyxcbiAgICBQUklNSVRJVkVfTElORUxPT1A6IFBSSU1JVElWRV9MSU5FTE9PUCxcbiAgICBQUklNSVRJVkVfTElORVNUUklQOiBQUklNSVRJVkVfTElORVNUUklQLFxuICAgIFBSSU1JVElWRV9UUklBTkdMRVM6IFBSSU1JVElWRV9UUklBTkdMRVMsXG4gICAgUFJJTUlUSVZFX1RSSVNUUklQOiBQUklNSVRJVkVfVFJJU1RSSVAsXG4gICAgUFJJTUlUSVZFX1RSSUZBTjogUFJJTUlUSVZFX1RSSUZBTixcbiAgICBTRU1BTlRJQ19QT1NJVElPTjogU0VNQU5USUNfUE9TSVRJT04sXG4gICAgU0VNQU5USUNfTk9STUFMOiBTRU1BTlRJQ19OT1JNQUwsXG4gICAgU0VNQU5USUNfQ09MT1I6IFNFTUFOVElDX0NPTE9SLFxuICAgIFNFTUFOVElDX1RFWENPT1JEOiBTRU1BTlRJQ19URVhDT09SRCxcbiAgICBTRU1BTlRJQ19URVhDT09SRDA6IFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBTRU1BTlRJQ19URVhDT09SRDE6IFNFTUFOVElDX1RFWENPT1JEMSxcbiAgICBTRU1BTlRJQ19BVFRSMDogU0VNQU5USUNfQVRUUjAsXG4gICAgU0VNQU5USUNfQVRUUjE6IFNFTUFOVElDX0FUVFIxLFxuICAgIFNFTUFOVElDX0FUVFIyOiBTRU1BTlRJQ19BVFRSMixcbiAgICBTRU1BTlRJQ19BVFRSMzogU0VNQU5USUNfQVRUUjMsXG4gICAgVEVYVFVSRUxPQ0tfUkVBRDogVEVYVFVSRUxPQ0tfUkVBRCxcbiAgICBURVhUVVJFTE9DS19XUklURTogVEVYVFVSRUxPQ0tfV1JJVEUsXG4gICAgZHJhd1F1YWRXaXRoU2hhZGVyOiBkcmF3UXVhZFdpdGhTaGFkZXIsXG4gICAgcHJvZ3JhbWxpYjogcHJvZ3JhbWxpYixcbiAgICBzaGFkZXJDaHVua3M6IHNoYWRlckNodW5rcyxcbiAgICBDb250ZXh0Q3JlYXRpb25FcnJvcjogQ29udGV4dENyZWF0aW9uRXJyb3IsXG4gICAgRGV2aWNlOiBHcmFwaGljc0RldmljZSxcbiAgICBJbmRleEJ1ZmZlcjogSW5kZXhCdWZmZXIsXG4gICAgUHJvZ3JhbUxpYnJhcnk6IFByb2dyYW1MaWJyYXJ5LFxuICAgIFJlbmRlclRhcmdldDogUmVuZGVyVGFyZ2V0LFxuICAgIFNjb3BlSWQ6IFNjb3BlSWQsXG4gICAgU2hhZGVyOiBTaGFkZXIsXG4gICAgU2hhZGVySW5wdXQ6IFdlYmdsU2hhZGVySW5wdXQsXG4gICAgVGV4dHVyZTogVGV4dHVyZSxcbiAgICBVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcjogVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IsXG4gICAgVmVydGV4QnVmZmVyOiBWZXJ0ZXhCdWZmZXIsXG4gICAgVmVydGV4Rm9ybWF0OiBWZXJ0ZXhGb3JtYXQsXG4gICAgVmVydGV4SXRlcmF0b3I6IFZlcnRleEl0ZXJhdG9yXG59O1xuXG5jb25zdCBfdmlld3BvcnQgPSBuZXcgVmVjNCgpO1xuXG5leHBvcnQgZnVuY3Rpb24gZHJhd0Z1bGxzY3JlZW5RdWFkKGRldmljZSwgdGFyZ2V0LCB2ZXJ0ZXhCdWZmZXIsIHNoYWRlciwgcmVjdCkge1xuXG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuZHJhd0Z1bGxzY3JlZW5RdWFkIGlzIGRlcHJlY2F0ZWQuIFdoZW4gdXNlZCBhcyBwYXJ0IG9mIFBvc3RFZmZlY3QsIHVzZSBQb3N0RWZmZWN0I2RyYXdRdWFkIGluc3RlYWQuYCk7XG5cbiAgICAvLyBjb252ZXJ0IHJlY3QgaW4gbm9ybWFsaXplZCBzcGFjZSB0byB2aWV3cG9ydCBpbiBwaXhlbCBzcGFjZVxuICAgIGxldCB2aWV3cG9ydDtcbiAgICBpZiAocmVjdCkge1xuICAgICAgICBjb25zdCB3ID0gdGFyZ2V0ID8gdGFyZ2V0LndpZHRoIDogZGV2aWNlLndpZHRoO1xuICAgICAgICBjb25zdCBoID0gdGFyZ2V0ID8gdGFyZ2V0LmhlaWdodCA6IGRldmljZS5oZWlnaHQ7XG4gICAgICAgIHZpZXdwb3J0ID0gX3ZpZXdwb3J0LnNldChyZWN0LnggKiB3LCByZWN0LnkgKiBoLCByZWN0LnogKiB3LCByZWN0LncgKiBoKTtcbiAgICB9XG5cbiAgICBkcmF3UXVhZFdpdGhTaGFkZXIoZGV2aWNlLCB0YXJnZXQsIHNoYWRlciwgdmlld3BvcnQpO1xufVxuXG5leHBvcnQgY29uc3QgcG9zdGVmZmVjdCA9IHtcbiAgICBjcmVhdGVGdWxsc2NyZWVuUXVhZDogKGRldmljZSkgPT4ge1xuICAgICAgICByZXR1cm4gZGV2aWNlLnF1YWRWZXJ0ZXhCdWZmZXI7XG4gICAgfSxcbiAgICBkcmF3RnVsbHNjcmVlblF1YWQ6IGRyYXdGdWxsc2NyZWVuUXVhZCxcbiAgICBQb3N0RWZmZWN0OiBQb3N0RWZmZWN0LFxuICAgIFBvc3RFZmZlY3RRdWV1ZTogUG9zdEVmZmVjdFF1ZXVlXG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2hhZGVyQ2h1bmtzLCAndHJhbnNmb3JtU2tpbm5lZFZTJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyNkZWZpbmUgU0tJTlxcbicgKyBzaGFkZXJDaHVua3MudHJhbnNmb3JtVlM7XG4gICAgfVxufSk7XG5cbmNvbnN0IGRlcHJlY2F0ZWRDaHVua3MgPSB7XG4gICAgJ2FtYmllbnRQcmVmaWx0ZXJlZEN1YmUuZnJhZyc6ICdhbWJpZW50RW52LmZyYWcnLFxuICAgICdhbWJpZW50UHJlZmlsdGVyZWRDdWJlTG9kLmZyYWcnOiAnYW1iaWVudEVudi5mcmFnJyxcbiAgICAnZHBBdGxhc1F1YWQuZnJhZyc6IG51bGwsXG4gICAgJ2dlblBhcmFib2xvaWQuZnJhZyc6IG51bGwsXG4gICAgJ3ByZWZpbHRlckN1YmVtYXAuZnJhZyc6IG51bGwsXG4gICAgJ3JlZmxlY3Rpb25EcEF0bGFzLmZyYWcnOiAncmVmbGVjdGlvbkVudi5mcmFnJyxcbiAgICAncmVmbGVjdGlvblByZWZpbHRlcmVkQ3ViZS5mcmFnJzogJ3JlZmxlY3Rpb25FbnYuZnJhZycsXG4gICAgJ3JlZmxlY3Rpb25QcmVmaWx0ZXJlZEN1YmVMb2QuZnJhZyc6ICdyZWZsZWN0aW9uRW52LmZyYWcnXG59O1xuXG5PYmplY3Qua2V5cyhkZXByZWNhdGVkQ2h1bmtzKS5mb3JFYWNoKChjaHVua05hbWUpID0+IHtcbiAgICBjb25zdCByZXBsYWNlbWVudCA9IGRlcHJlY2F0ZWRDaHVua3NbY2h1bmtOYW1lXTtcbiAgICBjb25zdCB1c2VJbnN0ZWFkID0gcmVwbGFjZW1lbnQgPyBgIFVzZSBwYy5zaGFkZXJDaHVua3NbJyR7cmVwbGFjZW1lbnR9J10gaW5zdGVhZC5gIDogJyc7XG4gICAgY29uc3QgbXNnID0gYHBjLnNoYWRlckNodW5rc1snJHtjaHVua05hbWV9J10gaXMgZGVwcmVjYXRlZC4ke3VzZUluc3RlYWR9fWA7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNoYWRlckNodW5rcywgY2h1bmtOYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IobXNnKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKG1zZyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG4vLyBOb3RlOiBUaGlzIHdhcyBuZXZlciBwdWJsaWMgaW50ZXJmYWNlLCBidXQgaGFzIGJlZW4gdXNlZCBpbiBleHRlcm5hbCBzY3JpcHRzXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhSZW5kZXJUYXJnZXQucHJvdG90eXBlLCB7XG4gICAgX2dsRnJhbWVCdWZmZXI6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJUYXJnZXQjX2dsRnJhbWVCdWZmZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlclRhcmdldC5pbXBsI19nbEZyYW1lQnVmZmVyIGluc3RlYWQuJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsLl9nbEZyYW1lQnVmZmVyO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChyZ2JtKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJUYXJnZXQjX2dsRnJhbWVCdWZmZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlclRhcmdldC5pbXBsI19nbEZyYW1lQnVmZmVyIGluc3RlYWQuJyk7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlcnRleEZvcm1hdCwgJ2RlZmF1bHRJbnN0YW5jaW5nRm9ybWF0Jywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5WZXJ0ZXhGb3JtYXQuZGVmYXVsdEluc3RhbmNpbmdGb3JtYXQgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLlZlcnRleEZvcm1hdC5nZXREZWZhdWx0SW5zdGFuY2luZ0Zvcm1hdChncmFwaGljc0RldmljZSkuJyk7XG4gICAgICAgIHJldHVybiBWZXJ0ZXhGb3JtYXQuZ2V0RGVmYXVsdEluc3RhbmNpbmdGb3JtYXQoR3JhcGhpY3NEZXZpY2VBY2Nlc3MuZ2V0KCkpO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhUZXh0dXJlLnByb3RvdHlwZSwge1xuICAgIHJnYm06IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3JnYm0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlRleHR1cmUjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gVEVYVFVSRVRZUEVfUkdCTTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAocmdibSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNyZ2JtIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IHJnYm0gPyBURVhUVVJFVFlQRV9SR0JNIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBzd2l6emxlR0dHUjoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlRleHR1cmUjc3dpenpsZUdHR1IgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlRleHR1cmUjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1I7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHN3aXp6bGVHR0dSKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3N3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IHN3aXp6bGVHR0dSID8gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IgOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9nbFRleHR1cmU6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI19nbFRleHR1cmUgaXMgbm8gbG9uZ2VyIGF2YWlsYWJsZSwgdXNlIFVzZSBwYy5UZXh0dXJlLmltcGwuX2dsVGV4dHVyZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbC5fZ2xUZXh0dXJlO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5nZXRQcm9ncmFtTGlicmFyeSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNnZXRQcm9ncmFtTGlicmFyeSBpcyBkZXByZWNhdGVkLmApO1xuICAgIHJldHVybiBnZXRQcm9ncmFtTGlicmFyeSh0aGlzKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRQcm9ncmFtTGlicmFyeSA9IGZ1bmN0aW9uIChsaWIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRQcm9ncmFtTGlicmFyeSBpcyBkZXByZWNhdGVkLmApO1xuICAgIHNldFByb2dyYW1MaWJyYXJ5KHRoaXMsIGxpYik7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUucmVtb3ZlU2hhZGVyRnJvbUNhY2hlID0gZnVuY3Rpb24gKHNoYWRlcikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3JlbW92ZVNoYWRlckZyb21DYWNoZSBpcyBkZXByZWNhdGVkLmApO1xuICAgIGdldFByb2dyYW1MaWJyYXJ5KHRoaXMpLnJlbW92ZUZyb21DYWNoZShzaGFkZXIpO1xufTtcblxuLy8gU0NFTkVcblxuZXhwb3J0IGNvbnN0IFBob25nTWF0ZXJpYWwgPSBTdGFuZGFyZE1hdGVyaWFsO1xuXG5leHBvcnQgY29uc3Qgc2NlbmUgPSB7XG4gICAgcGFydGl0aW9uU2tpbjogcGFydGl0aW9uU2tpbixcbiAgICBwcm9jZWR1cmFsOiB7XG4gICAgICAgIGNhbGN1bGF0ZVRhbmdlbnRzOiBjYWxjdWxhdGVUYW5nZW50cyxcbiAgICAgICAgY3JlYXRlTWVzaDogY3JlYXRlTWVzaCxcbiAgICAgICAgY3JlYXRlVG9ydXM6IGNyZWF0ZVRvcnVzLFxuICAgICAgICBjcmVhdGVDeWxpbmRlcjogY3JlYXRlQ3lsaW5kZXIsXG4gICAgICAgIGNyZWF0ZUNhcHN1bGU6IGNyZWF0ZUNhcHN1bGUsXG4gICAgICAgIGNyZWF0ZUNvbmU6IGNyZWF0ZUNvbmUsXG4gICAgICAgIGNyZWF0ZVNwaGVyZTogY3JlYXRlU3BoZXJlLFxuICAgICAgICBjcmVhdGVQbGFuZTogY3JlYXRlUGxhbmUsXG4gICAgICAgIGNyZWF0ZUJveDogY3JlYXRlQm94XG4gICAgfSxcbiAgICBCYXNpY01hdGVyaWFsOiBCYXNpY01hdGVyaWFsLFxuICAgIENvbW1hbmQ6IENvbW1hbmQsXG4gICAgRm9yd2FyZFJlbmRlcmVyOiBGb3J3YXJkUmVuZGVyZXIsXG4gICAgR3JhcGhOb2RlOiBHcmFwaE5vZGUsXG4gICAgTWF0ZXJpYWw6IE1hdGVyaWFsLFxuICAgIE1lc2g6IE1lc2gsXG4gICAgTWVzaEluc3RhbmNlOiBNZXNoSW5zdGFuY2UsXG4gICAgTW9kZWw6IE1vZGVsLFxuICAgIFBhcnRpY2xlRW1pdHRlcjogUGFydGljbGVFbWl0dGVyLFxuICAgIFBob25nTWF0ZXJpYWw6IFN0YW5kYXJkTWF0ZXJpYWwsXG4gICAgUGlja2VyOiBQaWNrZXIsXG4gICAgUHJvamVjdGlvbjoge1xuICAgICAgICBPUlRIT0dSQVBISUM6IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLFxuICAgICAgICBQRVJTUEVDVElWRTogUFJPSkVDVElPTl9QRVJTUEVDVElWRVxuICAgIH0sXG4gICAgU2NlbmU6IFNjZW5lLFxuICAgIFNraW46IFNraW4sXG4gICAgU2tpbkluc3RhbmNlOiBTa2luSW5zdGFuY2Vcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTY2VuZS5wcm90b3R5cGUsICdkZWZhdWx0TWF0ZXJpYWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2RlZmF1bHRNYXRlcmlhbCBpcyBkZXByZWNhdGVkLicpO1xuICAgICAgICByZXR1cm4gZ2V0RGVmYXVsdE1hdGVyaWFsKGdldEFwcGxpY2F0aW9uKCkuZ3JhcGhpY3NEZXZpY2UpO1xuICAgIH1cbn0pO1xuXG4vLyBzY2VuZS5za3lib3hQcmVmaWx0ZXJlZCoqKiogYXJlIGRlcHJlY2F0ZWRcblsnMTI4JywgJzY0JywgJzMyJywgJzE2JywgJzgnLCAnNCddLmZvckVhY2goKHNpemUsIGluZGV4KSA9PiB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNjZW5lLnByb3RvdHlwZSwgYHNreWJveFByZWZpbHRlcmVkJHtzaXplfWAsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TY2VuZSNza3lib3hQcmVmaWx0ZXJlZCR7c2l6ZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNjZW5lI3ByZWZpbHRlcmVkQ3ViZW1hcHMgaW5zdGVhZC5gKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzW2luZGV4XTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlNjZW5lI3NreWJveFByZWZpbHRlcmVkJHtzaXplfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2NlbmUjcHJlZmlsdGVyZWRDdWJlbWFwcyBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwc1tpbmRleF0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2NlbmUucHJvdG90eXBlLCAnbW9kZWxzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuX21vZGVscykge1xuICAgICAgICAgICAgdGhpcy5fbW9kZWxzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVscztcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KExheWVyLnByb3RvdHlwZSwgJ3JlbmRlclRhcmdldCcsIHtcbiAgICBzZXQ6IGZ1bmN0aW9uIChydCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5MYXllciNyZW5kZXJUYXJnZXQgaXMgZGVwcmVjYXRlZC4gU2V0IHRoZSByZW5kZXIgdGFyZ2V0IG9uIHRoZSBjYW1lcmEgaW5zdGVhZC5gKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyVGFyZ2V0ID0gcnQ7XG4gICAgICAgIHRoaXMuX2RpcnR5Q2FtZXJhcyA9IHRydWU7XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclRhcmdldDtcbiAgICB9XG59KTtcblxuLy8gVGhpcyBjYW4gYmUgcmVtb3ZlZCB3aGVuIDEuNTYgaXMgb3V0IGFuZCB0aGUgRWRpdG9yIG5vIGxvbmdlciBjYWxscyB0aGlzXG5TY2VuZS5wcm90b3R5cGUuX3VwZGF0ZVNreWJveCA9IGZ1bmN0aW9uIChkZXZpY2UpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TY2VuZSNfdXBkYXRlU2t5Ym94IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5TY2VuZSNfdXBkYXRlU2t5IGluc3RlYWQuYCk7XG4gICAgdGhpcy5fdXBkYXRlU2t5KGRldmljZSk7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuYWRkTW9kZWwgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNhZGRNb2RlbCBpcyBkZXByZWNhdGVkLicpO1xuICAgIGlmICh0aGlzLmNvbnRhaW5zTW9kZWwobW9kZWwpKSByZXR1cm47XG4gICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCk7XG4gICAgaWYgKCFsYXllcikgcmV0dXJuO1xuICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgdGhpcy5tb2RlbHMucHVzaChtb2RlbCk7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuYWRkU2hhZG93Q2FzdGVyID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjYWRkU2hhZG93Q2FzdGVyIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCk7XG4gICAgaWYgKCFsYXllcikgcmV0dXJuO1xuICAgIGxheWVyLmFkZFNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUucmVtb3ZlTW9kZWwgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNyZW1vdmVNb2RlbCBpcyBkZXByZWNhdGVkLicpO1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5tb2RlbHMuaW5kZXhPZihtb2RlbCk7XG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICAgICAgaWYgKCFsYXllcikgcmV0dXJuO1xuICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB0aGlzLm1vZGVscy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbn07XG5cblNjZW5lLnByb3RvdHlwZS5yZW1vdmVTaGFkb3dDYXN0ZXJzID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjcmVtb3ZlU2hhZG93Q2FzdGVycyBpcyBkZXByZWNhdGVkLicpO1xuICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfV09STEQpO1xuICAgIGlmICghbGF5ZXIpIHJldHVybjtcbiAgICBsYXllci5yZW1vdmVTaGFkb3dDYXN0ZXJzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xufTtcblxuU2NlbmUucHJvdG90eXBlLmNvbnRhaW5zTW9kZWwgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNjb250YWluc01vZGVsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzLmluZGV4T2YobW9kZWwpID49IDA7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuZ2V0TW9kZWxzID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjZ2V0TW9kZWxzIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhdGNoLnByb3RvdHlwZSwgJ21vZGVsJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5CYXRjaCNtb2RlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQmF0Y2gjbWVzaEluc3RhbmNlIHRvIGFjY2VzcyBiYXRjaGVkIG1lc2ggaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufSk7XG5cbkZvcndhcmRSZW5kZXJlci5wcm90b3R5cGUucmVuZGVyQ29tcG9zaXRpb24gPSBmdW5jdGlvbiAoY29tcCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkZvcndhcmRSZW5kZXJlciNyZW5kZXJDb21wb3NpdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZS5yZW5kZXJDb21wb3NpdGlvbiBpbnN0ZWFkLicpO1xuICAgIGdldEFwcGxpY2F0aW9uKCkucmVuZGVyQ29tcG9zaXRpb24oY29tcCk7XG59O1xuXG5Gb3J3YXJkUmVuZGVyZXIucHJvdG90eXBlLnVwZGF0ZVNoYWRlciA9IGZ1bmN0aW9uIChtZXNoSW5zdGFuY2UsIG9iakRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuRm9yd2FyZFJlbmRlcmVyI3VwZGF0ZVNoYWRlciBpcyBkZXByZWNhdGVkLCB1c2UgcGMuTWVzaEluc3RhbmNlI3VwZGF0ZVBhc3NTaGFkZXIuJyk7XG4gICAgY29uc3Qgc2NlbmUgPSBtZXNoSW5zdGFuY2UubWF0ZXJpYWwuX3NjZW5lIHx8IGdldEFwcGxpY2F0aW9uKCkuc2NlbmU7XG4gICAgcmV0dXJuIG1lc2hJbnN0YW5jZS51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBzdGF0aWNMaWdodExpc3QsIHNvcnRlZExpZ2h0cyk7XG59O1xuXG5NZXNoSW5zdGFuY2UucHJvdG90eXBlLnN5bmNBYWJiID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1lc2hJbnN0YW5jZSNzeW5jQWFiYiBpcyBkZXByZWNhdGVkLicpO1xufTtcblxuTW9ycGgucHJvdG90eXBlLmdldFRhcmdldCA9IGZ1bmN0aW9uIChpbmRleCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1vcnBoI2dldFRhcmdldCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTW9ycGgjdGFyZ2V0cyBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMudGFyZ2V0c1tpbmRleF07XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLl9kaXJ0aWZ5ID0gZnVuY3Rpb24gKGxvY2FsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI19kaXJ0aWZ5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjX2RpcnRpZnlMb2NhbCBvciBfZGlydGlmeVdvcmxkIHJlc3BlY3RpdmVseSBpbnN0ZWFkLicpO1xuICAgIGlmIChsb2NhbClcbiAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgZWxzZVxuICAgICAgICB0aGlzLl9kaXJ0aWZ5V29ybGQoKTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuYWRkTGFiZWwgPSBmdW5jdGlvbiAobGFiZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjYWRkTGFiZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICB0aGlzLl9sYWJlbHNbbGFiZWxdID0gdHJ1ZTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0TGFiZWxzID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRMYWJlbHMgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fbGFiZWxzKTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuaGFzTGFiZWwgPSBmdW5jdGlvbiAobGFiZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjaGFzTGFiZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gISF0aGlzLl9sYWJlbHNbbGFiZWxdO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5yZW1vdmVMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNyZW1vdmVMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIGRlbGV0ZSB0aGlzLl9sYWJlbHNbbGFiZWxdO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5maW5kQnlMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCwgcmVzdWx0cyA9IFtdKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2ZpbmRCeUxhYmVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgaWYgKHRoaXMuaGFzTGFiZWwobGFiZWwpKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaCh0aGlzKTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHJlc3VsdHMgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kQnlMYWJlbChsYWJlbCwgcmVzdWx0cyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldENoaWxkcmVuID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRDaGlsZHJlbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI2NoaWxkcmVuIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5jaGlsZHJlbjtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0TmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI25hbWUgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLm5hbWU7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldFBhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldFBhdGggaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNwYXRoIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5wYXRoO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRSb290ID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRSb290IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjcm9vdCBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMucm9vdDtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0UGFyZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRQYXJlbnQgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNwYXJlbnQgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLnBhcmVudDtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuc2V0TmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI3NldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNuYW1lIGluc3RlYWQuJyk7XG5cbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xufTtcblxuTWF0ZXJpYWwucHJvdG90eXBlLmdldE5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWF0ZXJpYWwjZ2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTWF0ZXJpYWwjbmFtZSBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLm5hbWU7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuc2V0TmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWF0ZXJpYWwjc2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTWF0ZXJpYWwjbmFtZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuZ2V0U2hhZGVyID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1hdGVyaWFsI2dldFNoYWRlciBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTWF0ZXJpYWwjc2hhZGVyIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuc2hhZGVyO1xufTtcblxuTWF0ZXJpYWwucHJvdG90eXBlLnNldFNoYWRlciA9IGZ1bmN0aW9uIChzaGFkZXIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNzZXRTaGFkZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1hdGVyaWFsI3NoYWRlciBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2hhZGVyID0gc2hhZGVyO1xufTtcblxuZnVuY3Rpb24gX2RlZmluZUFsaWFzKG5ld05hbWUsIG9sZE5hbWUpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3RhbmRhcmRNYXRlcmlhbC5wcm90b3R5cGUsIG9sZE5hbWUsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TdGFuZGFyZE1hdGVyaWFsIyR7b2xkTmFtZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtuZXdOYW1lfSBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbbmV3TmFtZV07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TdGFuZGFyZE1hdGVyaWFsIyR7b2xkTmFtZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtuZXdOYW1lfSBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgdGhpc1tuZXdOYW1lXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbl9kZWZpbmVBbGlhcygnZGlmZnVzZVRpbnQnLCAnZGlmZnVzZU1hcFRpbnQnKTtcbl9kZWZpbmVBbGlhcygnc3BlY3VsYXJUaW50JywgJ3NwZWN1bGFyTWFwVGludCcpO1xuX2RlZmluZUFsaWFzKCdlbWlzc2l2ZVRpbnQnLCAnZW1pc3NpdmVNYXBUaW50Jyk7XG5fZGVmaW5lQWxpYXMoJ2FvVmVydGV4Q29sb3InLCAnYW9NYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdkaWZmdXNlVmVydGV4Q29sb3InLCAnZGlmZnVzZU1hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ3NwZWN1bGFyVmVydGV4Q29sb3InLCAnc3BlY3VsYXJNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdlbWlzc2l2ZVZlcnRleENvbG9yJywgJ2VtaXNzaXZlTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnbWV0YWxuZXNzVmVydGV4Q29sb3InLCAnbWV0YWxuZXNzTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnZ2xvc3NWZXJ0ZXhDb2xvcicsICdnbG9zc01hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ29wYWNpdHlWZXJ0ZXhDb2xvcicsICdvcGFjaXR5TWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnbGlnaHRWZXJ0ZXhDb2xvcicsICdsaWdodE1hcFZlcnRleENvbG9yJyk7XG5cbl9kZWZpbmVBbGlhcygnc2hlZW5HbG9zcycsICdzaGVlbkdsb3NzaWVzcycpO1xuX2RlZmluZUFsaWFzKCdjbGVhckNvYXRHbG9zcycsICdjbGVhckNvc3RHbG9zc2luZXNzJyk7XG5cbmZ1bmN0aW9uIF9kZWZpbmVPcHRpb24obmFtZSwgbmV3TmFtZSkge1xuICAgIGlmIChuYW1lICE9PSAnY2h1bmtzJyAmJiBuYW1lICE9PSAnX3Bhc3MnKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucy5wcm90b3R5cGUsIG5hbWUsIHtcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYEdldHRpbmcgcGMuT3B0aW9ucyMke25hbWV9IGhhcyBiZWVuIGRlcHJlY2F0ZWQgYXMgdGhlIHByb3BlcnR5IGhhcyBiZWVuIG1vdmVkIHRvIHBjLk9wdGlvbnMuTGl0T3B0aW9ucyMke25ld05hbWUgfHwgbmFtZX0uYCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubGl0T3B0aW9uc1tuZXdOYW1lIHx8IG5hbWVdO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgU2V0dGluZyBwYy5PcHRpb25zIyR7bmFtZX0gaGFzIGJlZW4gZGVwcmVjYXRlZCBhcyB0aGUgcHJvcGVydHkgaGFzIGJlZW4gbW92ZWQgdG8gcGMuT3B0aW9ucy5MaXRPcHRpb25zIyR7bmV3TmFtZSB8fCBuYW1lfS5gKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxpdE9wdGlvbnNbbmV3TmFtZSB8fCBuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5fZGVmaW5lT3B0aW9uKCdyZWZyYWN0aW9uJywgJ3VzZVJlZnJhY3Rpb24nKTtcblxuY29uc3QgdGVtcE9wdGlvbnMgPSBuZXcgTGl0T3B0aW9ucygpO1xuY29uc3QgbGl0T3B0aW9uUHJvcGVydGllcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRlbXBPcHRpb25zKTtcbmZvciAoY29uc3QgbGl0T3B0aW9uIGluIGxpdE9wdGlvblByb3BlcnRpZXMpIHtcbiAgICBfZGVmaW5lT3B0aW9uKGxpdE9wdGlvblByb3BlcnRpZXNbbGl0T3B0aW9uXSk7XG59XG5cbi8vIEFOSU1BVElPTlxuXG5leHBvcnQgY29uc3QgYW5pbSA9IHtcbiAgICBBbmltYXRpb246IEFuaW1hdGlvbixcbiAgICBLZXk6IEtleSxcbiAgICBOb2RlOiBOb2RlLFxuICAgIFNrZWxldG9uOiBTa2VsZXRvblxufTtcblxuQW5pbWF0aW9uLnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BbmltYXRpb24jZ2V0RHVyYXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNkdXJhdGlvbiBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmR1cmF0aW9uO1xufTtcblxuQW5pbWF0aW9uLnByb3RvdHlwZS5nZXROYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNnZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jbmFtZSBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLm5hbWU7XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldE5vZGVzID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNnZXROb2RlcyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQW5pbWF0aW9uI25vZGVzIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubm9kZXM7XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLnNldER1cmF0aW9uID0gZnVuY3Rpb24gKGR1cmF0aW9uKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI3NldER1cmF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jZHVyYXRpb24gaW5zdGVhZC4nKTtcbiAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLnNldE5hbWUgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNzZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jbmFtZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0QW5pbWF0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI2dldEFuaW1hdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jYW5pbWF0aW9uIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuYW5pbWF0aW9uO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLmdldEN1cnJlbnRUaW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI2dldEN1cnJlbnRUaW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNjdXJyZW50VGltZSBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmN1cnJlbnRUaW1lO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLmdldExvb3BpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0TG9vcGluZyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbG9vcGluZyBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmxvb3Bpbmc7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0TnVtTm9kZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0TnVtTm9kZXMgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI251bU5vZGVzIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubnVtTm9kZXM7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuc2V0QW5pbWF0aW9uID0gZnVuY3Rpb24gKGFuaW1hdGlvbikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI3NldEFuaW1hdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jYW5pbWF0aW9uIGluc3RlYWQuJyk7XG4gICAgdGhpcy5hbmltYXRpb24gPSBhbmltYXRpb247XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuc2V0Q3VycmVudFRpbWUgPSBmdW5jdGlvbiAodGltZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI3NldEN1cnJlbnRUaW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNjdXJyZW50VGltZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMuY3VycmVudFRpbWUgPSB0aW1lO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLnNldExvb3BpbmcgPSBmdW5jdGlvbiAobG9vcGluZykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI3NldExvb3BpbmcgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2xvb3BpbmcgaW5zdGVhZC4nKTtcbiAgICB0aGlzLmxvb3BpbmcgPSBsb29waW5nO1xufTtcblxuLy8gU09VTkRcblxuZXhwb3J0IGNvbnN0IGF1ZGlvID0ge1xuICAgIEF1ZGlvTWFuYWdlcjogU291bmRNYW5hZ2VyLFxuICAgIENoYW5uZWw6IENoYW5uZWwsXG4gICAgQ2hhbm5lbDNkOiBDaGFubmVsM2QsXG4gICAgTGlzdGVuZXI6IExpc3RlbmVyLFxuICAgIFNvdW5kOiBTb3VuZFxufTtcblxuU291bmRNYW5hZ2VyLnByb3RvdHlwZS5nZXRMaXN0ZW5lciA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Tb3VuZE1hbmFnZXIjZ2V0TGlzdGVuZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNvdW5kTWFuYWdlciNsaXN0ZW5lciBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmxpc3RlbmVyO1xufTtcblxuU291bmRNYW5hZ2VyLnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU291bmRNYW5hZ2VyI2dldFZvbHVtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI3ZvbHVtZSBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLnZvbHVtZTtcbn07XG5cblNvdW5kTWFuYWdlci5wcm90b3R5cGUuc2V0Vm9sdW1lID0gZnVuY3Rpb24gKHZvbHVtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNvdW5kTWFuYWdlciNzZXRWb2x1bWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNvdW5kTWFuYWdlciN2b2x1bWUgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnZvbHVtZSA9IHZvbHVtZTtcbn07XG5cbi8vIEFTU0VUXG5cbmV4cG9ydCBjb25zdCBhc3NldCA9IHtcbiAgICBBU1NFVF9BTklNQVRJT046ICdhbmltYXRpb24nLFxuICAgIEFTU0VUX0FVRElPOiAnYXVkaW8nLFxuICAgIEFTU0VUX0lNQUdFOiAnaW1hZ2UnLFxuICAgIEFTU0VUX0pTT046ICdqc29uJyxcbiAgICBBU1NFVF9NT0RFTDogJ21vZGVsJyxcbiAgICBBU1NFVF9NQVRFUklBTDogJ21hdGVyaWFsJyxcbiAgICBBU1NFVF9URVhUOiAndGV4dCcsXG4gICAgQVNTRVRfVEVYVFVSRTogJ3RleHR1cmUnLFxuICAgIEFTU0VUX0NVQkVNQVA6ICdjdWJlbWFwJyxcbiAgICBBU1NFVF9TQ1JJUFQ6ICdzY3JpcHQnXG59O1xuXG5Bc3NldFJlZ2lzdHJ5LnByb3RvdHlwZS5nZXRBc3NldEJ5SWQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Bc3NldFJlZ2lzdHJ5I2dldEFzc2V0QnlJZCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXNzZXRSZWdpc3RyeSNnZXQgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5nZXQoaWQpO1xufTtcblxuLy8gWFJcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFhySW5wdXRTb3VyY2UucHJvdG90eXBlLCAncmF5Jywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5YcklucHV0U291cmNlI3JheSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRPcmlnaW4gYW5kIHBjLlhySW5wdXRTb3VyY2UjZ2V0RGlyZWN0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9yYXlMb2NhbDtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFhySW5wdXRTb3VyY2UucHJvdG90eXBlLCAncG9zaXRpb24nLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlhySW5wdXRTb3VyY2UjcG9zaXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlhySW5wdXRTb3VyY2UjZ2V0TG9jYWxQb3NpdGlvbiBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxQb3NpdGlvbjtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFhySW5wdXRTb3VyY2UucHJvdG90eXBlLCAncm90YXRpb24nLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlhySW5wdXRTb3VyY2Ujcm90YXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlhySW5wdXRTb3VyY2UjZ2V0TG9jYWxSb3RhdGlvbiBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxSb3RhdGlvbjtcbiAgICB9XG59KTtcblxuLy8gSU5QVVRcblxuZXhwb3J0IGNvbnN0IGlucHV0ID0ge1xuICAgIGdldFRvdWNoVGFyZ2V0Q29vcmRzOiBnZXRUb3VjaFRhcmdldENvb3JkcyxcbiAgICBDb250cm9sbGVyOiBDb250cm9sbGVyLFxuICAgIEdhbWVQYWRzOiBHYW1lUGFkcyxcbiAgICBLZXlib2FyZDogS2V5Ym9hcmQsXG4gICAgS2V5Ym9hcmRFdmVudDogS2V5Ym9hcmRFdmVudCxcbiAgICBNb3VzZTogTW91c2UsXG4gICAgTW91c2VFdmVudDogTW91c2VFdmVudCxcbiAgICBUb3VjaDogVG91Y2gsXG4gICAgVG91Y2hEZXZpY2U6IFRvdWNoRGV2aWNlLFxuICAgIFRvdWNoRXZlbnQ6IFRvdWNoRXZlbnRcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShFbGVtZW50SW5wdXQucHJvdG90eXBlLCAnd2hlZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndoZWVsRGVsdGEgKiAtMjtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE1vdXNlRXZlbnQucHJvdG90eXBlLCAnd2hlZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndoZWVsRGVsdGEgKiAtMjtcbiAgICB9XG59KTtcblxuLy8gRlJBTUVXT1JLXG5cbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9TVEFUSUMgPSBCT0RZVFlQRV9TVEFUSUM7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX1RZUEVfRFlOQU1JQyA9IEJPRFlUWVBFX0RZTkFNSUM7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX1RZUEVfS0lORU1BVElDID0gQk9EWVRZUEVfS0lORU1BVElDO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9DRl9TVEFUSUNfT0JKRUNUID0gQk9EWUZMQUdfU1RBVElDX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQ0ZfS0lORU1BVElDX09CSkVDVCA9IEJPRFlGTEFHX0tJTkVNQVRJQ19PQkpFQ1Q7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0NGX05PUkVTUE9OU0VfT0JKRUNUID0gQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1Q7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0FDVElWRV9UQUcgPSBCT0RZU1RBVEVfQUNUSVZFX1RBRztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfSVNMQU5EX1NMRUVQSU5HID0gQk9EWVNUQVRFX0lTTEFORF9TTEVFUElORztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfV0FOVFNfREVBQ1RJVkFUSU9OID0gQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTjtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfRElTQUJMRV9ERUFDVElWQVRJT04gPSBCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT047XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0RJU0FCTEVfU0lNVUxBVElPTiA9IEJPRFlTVEFURV9ESVNBQkxFX1NJTVVMQVRJT047XG5cbkFwcEJhc2UucHJvdG90eXBlLmlzRnVsbHNjcmVlbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2lzRnVsbHNjcmVlbiBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIEZ1bGxzY3JlZW4gQVBJIGRpcmVjdGx5LicpO1xuXG4gICAgcmV0dXJuICEhZG9jdW1lbnQuZnVsbHNjcmVlbkVsZW1lbnQ7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5lbmFibGVGdWxsc2NyZWVuID0gZnVuY3Rpb24gKGVsZW1lbnQsIHN1Y2Nlc3MsIGVycm9yKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNlbmFibGVGdWxsc2NyZWVuIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgRnVsbHNjcmVlbiBBUEkgZGlyZWN0bHkuJyk7XG5cbiAgICBlbGVtZW50ID0gZWxlbWVudCB8fCB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcztcblxuICAgIC8vIHN1Y2Nlc3MgY2FsbGJhY2tcbiAgICBjb25zdCBzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzdWNjZXNzKCk7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLCBzKTtcbiAgICB9O1xuXG4gICAgLy8gZXJyb3IgY2FsbGJhY2tcbiAgICBjb25zdCBlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBlcnJvcigpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuZXJyb3InLCBlKTtcbiAgICB9O1xuXG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsIHMsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmVycm9yJywgZSwgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChlbGVtZW50LnJlcXVlc3RGdWxsc2NyZWVuKSB7XG4gICAgICAgIGVsZW1lbnQucmVxdWVzdEZ1bGxzY3JlZW4oRWxlbWVudC5BTExPV19LRVlCT0FSRF9JTlBVVCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZXJyb3IoKTtcbiAgICB9XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5kaXNhYmxlRnVsbHNjcmVlbiA9IGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNkaXNhYmxlRnVsbHNjcmVlbiBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIEZ1bGxzY3JlZW4gQVBJIGRpcmVjdGx5LicpO1xuXG4gICAgLy8gc3VjY2VzcyBjYWxsYmFja1xuICAgIGNvbnN0IHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHN1Y2Nlc3MoKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsIHMpO1xuICAgIH07XG5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcywgZmFsc2UpO1xuICAgIH1cblxuICAgIGRvY3VtZW50LmV4aXRGdWxsc2NyZWVuKCk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5nZXRTY2VuZVVybCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNnZXRTY2VuZVVybCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZSNzY2VuZXMgYW5kIHBjLlNjZW5lUmVnaXN0cnkjZmluZCBpbnN0ZWFkLicpO1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5zY2VuZXMuZmluZChuYW1lKTtcbiAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgcmV0dXJuIGVudHJ5LnVybDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5sb2FkU2NlbmUgPSBmdW5jdGlvbiAodXJsLCBjYWxsYmFjaykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjbG9hZFNjZW5lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmUgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnNjZW5lcy5sb2FkU2NlbmUodXJsLCBjYWxsYmFjayk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5sb2FkU2NlbmVIaWVyYXJjaHkgPSBmdW5jdGlvbiAodXJsLCBjYWxsYmFjaykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjbG9hZFNjZW5lSGllcmFyY2h5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVIaWVyYXJjaHkgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnNjZW5lcy5sb2FkU2NlbmVIaWVyYXJjaHkodXJsLCBjYWxsYmFjayk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5sb2FkU2NlbmVTZXR0aW5ncyA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNsb2FkU2NlbmVTZXR0aW5ncyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZSNzY2VuZXMgYW5kIHBjLlNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lU2V0dGluZ3MgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnNjZW5lcy5sb2FkU2NlbmVTZXR0aW5ncyh1cmwsIGNhbGxiYWNrKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLnJlbmRlck1lc2hJbnN0YW5jZSA9IGZ1bmN0aW9uIChtZXNoSW5zdGFuY2UsIG9wdGlvbnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlLnJlbmRlck1lc2hJbnN0YW5jZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZS5kcmF3TWVzaEluc3RhbmNlLicpO1xuICAgIGNvbnN0IGxheWVyID0gb3B0aW9ucz8ubGF5ZXIgPyBvcHRpb25zLmxheWVyIDogdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyO1xuICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdNZXNoKG51bGwsIG51bGwsIG51bGwsIG1lc2hJbnN0YW5jZSwgbGF5ZXIpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUucmVuZGVyTWVzaCA9IGZ1bmN0aW9uIChtZXNoLCBtYXRlcmlhbCwgbWF0cml4LCBvcHRpb25zKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZS5yZW5kZXJNZXNoIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlLmRyYXdNZXNoLicpO1xuICAgIGNvbnN0IGxheWVyID0gb3B0aW9ucz8ubGF5ZXIgPyBvcHRpb25zLmxheWVyIDogdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyO1xuICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdNZXNoKG1hdGVyaWFsLCBtYXRyaXgsIG1lc2gsIG51bGwsIGxheWVyKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLl9hZGRMaW5lcyA9IGZ1bmN0aW9uIChwb3NpdGlvbnMsIGNvbG9ycywgb3B0aW9ucykge1xuICAgIGNvbnN0IGxheWVyID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5sYXllcikgPyBvcHRpb25zLmxheWVyIDogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKTtcbiAgICBjb25zdCBkZXB0aFRlc3QgPSAob3B0aW9ucyAmJiBvcHRpb25zLmRlcHRoVGVzdCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuZGVwdGhUZXN0IDogdHJ1ZTtcblxuICAgIGNvbnN0IGJhdGNoID0gdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0QmF0Y2gobGF5ZXIsIGRlcHRoVGVzdCk7XG4gICAgYmF0Y2guYWRkTGluZXMocG9zaXRpb25zLCBjb2xvcnMpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUucmVuZGVyTGluZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCBjb2xvcikge1xuXG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZS5yZW5kZXJMaW5lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlLmRyYXdMaW5lLicpO1xuXG4gICAgbGV0IGVuZENvbG9yID0gY29sb3I7XG4gICAgbGV0IG9wdGlvbnM7XG5cbiAgICBjb25zdCBhcmczID0gYXJndW1lbnRzWzNdO1xuICAgIGNvbnN0IGFyZzQgPSBhcmd1bWVudHNbNF07XG5cbiAgICBpZiAoYXJnMyBpbnN0YW5jZW9mIENvbG9yKSB7XG4gICAgICAgIC8vIHBhc3NlZCBpbiBlbmQgY29sb3JcbiAgICAgICAgZW5kQ29sb3IgPSBhcmczO1xuXG4gICAgICAgIGlmICh0eXBlb2YgYXJnNCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIC8vIGNvbXBhdGliaWxpdHk6IGNvbnZlcnQgbGluZWJhdGNoIGlkIGludG8gb3B0aW9uc1xuICAgICAgICAgICAgaWYgKGFyZzQgPT09IExJTkVCQVRDSF9PVkVSTEFZKSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoVGVzdDogZmFsc2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGhUZXN0OiB0cnVlXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHVzZSBwYXNzZWQgaW4gb3B0aW9uc1xuICAgICAgICAgICAgb3B0aW9ucyA9IGFyZzQ7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBhcmczID09PSAnbnVtYmVyJykge1xuICAgICAgICBlbmRDb2xvciA9IGNvbG9yO1xuXG4gICAgICAgIC8vIGNvbXBhdGliaWxpdHk6IGNvbnZlcnQgbGluZWJhdGNoIGlkIGludG8gb3B0aW9uc1xuICAgICAgICBpZiAoYXJnMyA9PT0gTElORUJBVENIX09WRVJMQVkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiBmYWxzZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChhcmczKSB7XG4gICAgICAgIC8vIG9wdGlvbnMgcGFzc2VkIGluXG4gICAgICAgIG9wdGlvbnMgPSBhcmczO1xuICAgIH1cblxuICAgIHRoaXMuX2FkZExpbmVzKFtzdGFydCwgZW5kXSwgW2NvbG9yLCBlbmRDb2xvcl0sIG9wdGlvbnMpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUucmVuZGVyTGluZXMgPSBmdW5jdGlvbiAocG9zaXRpb24sIGNvbG9yLCBvcHRpb25zKSB7XG5cbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlLnJlbmRlckxpbmVzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlLmRyYXdMaW5lcy4nKTtcblxuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgICAvLyBkZWZhdWx0IG9wdGlvblxuICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgfTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSwgTElORUJBVENIX09WRVJMQVkgbGluZXMgaGF2ZSBkZXB0aHRlc3QgZGlzYWJsZWRcbiAgICAgICAgaWYgKG9wdGlvbnMgPT09IExJTkVCQVRDSF9PVkVSTEFZKSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgIGRlcHRoVGVzdDogZmFsc2VcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgIGRlcHRoVGVzdDogdHJ1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG11bHRpQ29sb3IgPSAhIWNvbG9yLmxlbmd0aDtcbiAgICBpZiAobXVsdGlDb2xvcikge1xuICAgICAgICBpZiAocG9zaXRpb24ubGVuZ3RoICE9PSBjb2xvci5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ3JlbmRlckxpbmVzOiBwb3NpdGlvbi9jb2xvciBhcnJheXMgaGF2ZSBkaWZmZXJlbnQgbGVuZ3RocycpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChwb3NpdGlvbi5sZW5ndGggJSAyICE9PSAwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ3JlbmRlckxpbmVzOiBhcnJheSBsZW5ndGggaXMgbm90IGRpdmlzaWJsZSBieSAyJyk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5fYWRkTGluZXMocG9zaXRpb24sIGNvbG9yLCBvcHRpb25zKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmVuYWJsZVZyID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjZW5hYmxlVlIgaXMgZGVwcmVjYXRlZCwgYW5kIFdlYlZSIEFQSSBpcyBubyBsb25nZXIgc3VwcG9ydGVkLicpO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENhbWVyYUNvbXBvbmVudC5wcm90b3R5cGUsICdub2RlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5DYW1lcmFDb21wb25lbnQjbm9kZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQ2FtZXJhQ29tcG9uZW50I2VudGl0eSBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5lbnRpdHk7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaWdodENvbXBvbmVudC5wcm90b3R5cGUsICdlbmFibGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkxpZ2h0Q29tcG9uZW50I2VuYWJsZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTGlnaHRDb21wb25lbnQjZW5hYmxlZCBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5lbmFibGVkO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTGlnaHRDb21wb25lbnQjZW5hYmxlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5MaWdodENvbXBvbmVudCNlbmFibGVkIGluc3RlYWQuJyk7XG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG5Nb2RlbENvbXBvbmVudC5wcm90b3R5cGUuc2V0VmlzaWJsZSA9IGZ1bmN0aW9uICh2aXNpYmxlKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTW9kZWxDb21wb25lbnQjc2V0VmlzaWJsZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTW9kZWxDb21wb25lbnQjZW5hYmxlZCBpbnN0ZWFkLicpO1xuICAgIHRoaXMuZW5hYmxlZCA9IHZpc2libGU7XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTW9kZWxDb21wb25lbnQucHJvdG90eXBlLCAnYWFiYicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTW9kZWxDb21wb25lbnQjYWFiYiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTW9kZWxDb21wb25lbnQjY3VzdG9tQWFiYiBpbnN0ZWFkIC0gd2hpY2ggZXhwZWN0cyBsb2NhbCBzcGFjZSBBQUJCIGluc3RlYWQgb2YgYSB3b3JsZCBzcGFjZSBBQUJCLicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTW9kZWxDb21wb25lbnQjYWFiYiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTW9kZWxDb21wb25lbnQjY3VzdG9tQWFiYiBpbnN0ZWFkIC0gd2hpY2ggZXhwZWN0cyBsb2NhbCBzcGFjZSBBQUJCIGluc3RlYWQgb2YgYSB3b3JsZCBzcGFjZSBBQUJCLicpO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoUmVuZGVyQ29tcG9uZW50LnByb3RvdHlwZSwgJ2FhYmInLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJlbmRlckNvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJDb21wb25lbnQjY3VzdG9tQWFiYiBpbnN0ZWFkIC0gd2hpY2ggZXhwZWN0cyBsb2NhbCBzcGFjZSBBQUJCIGluc3RlYWQgb2YgYSB3b3JsZCBzcGFjZSBBQUJCLicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyQ29tcG9uZW50I2FhYmIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlckNvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSaWdpZEJvZHlDb21wb25lbnQucHJvdG90eXBlLCAnYm9keVR5cGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudCNib2R5VHlwZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmlnaWRCb2R5Q29tcG9uZW50I3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50I2JvZHlUeXBlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SaWdpZEJvZHlDb21wb25lbnQjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgIH1cbn0pO1xuXG5SaWdpZEJvZHlDb21wb25lbnQucHJvdG90eXBlLnN5bmNCb2R5VG9FbnRpdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50I3N5bmNCb2R5VG9FbnRpdHkgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4nKTtcbiAgICB0aGlzLl91cGRhdGVEeW5hbWljKCk7XG59O1xuXG5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0ucHJvdG90eXBlLnNldEdyYXZpdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI3NldEdyYXZpdHkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNncmF2aXR5IGluc3RlYWQuJyk7XG5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICB0aGlzLmdyYXZpdHkuY29weShhcmd1bWVudHNbMF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ3Jhdml0eS5zZXQoYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgfVxufTtcblxuXG5leHBvcnQgZnVuY3Rpb24gYmFzaXNTZXREb3dubG9hZENvbmZpZyhnbHVlVXJsLCB3YXNtVXJsLCBmYWxsYmFja1VybCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmJhc2lzU2V0RG93bmxvYWRDb25maWcgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLmJhc2lzSW5pdGlhbGl6ZSBpbnN0ZWFkLicpO1xuICAgIGJhc2lzSW5pdGlhbGl6ZSh7XG4gICAgICAgIGdsdWVVcmw6IGdsdWVVcmwsXG4gICAgICAgIHdhc21Vcmw6IHdhc21VcmwsXG4gICAgICAgIGZhbGxiYWNrVXJsOiBmYWxsYmFja1VybCxcbiAgICAgICAgbGF6eUluaXQ6IHRydWVcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZWZpbHRlckN1YmVtYXAob3B0aW9ucykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLnByZWZpbHRlckN1YmVtYXAgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLmVudkxpZ2h0aW5nIGluc3RlYWQuJyk7XG59XG4iXSwibmFtZXMiOlsibG9nIiwid3JpdGUiLCJ0ZXh0IiwiRGVidWciLCJkZXByZWNhdGVkIiwiY29uc29sZSIsIm9wZW4iLCJ2ZXJzaW9uIiwicmV2aXNpb24iLCJpbmZvIiwiZGVidWciLCJlcnJvciIsIndhcm5pbmciLCJ3YXJuIiwiYWxlcnQiLCJhc3NlcnQiLCJjb25kaXRpb24iLCJzdHJpbmciLCJlbmRzV2l0aCIsInMiLCJzdWJzIiwic3RhcnRzV2l0aCIsIlRpbWVyIiwiY29uc3RydWN0b3IiLCJfaXNSdW5uaW5nIiwiX2EiLCJfYiIsInN0YXJ0Iiwibm93Iiwic3RvcCIsImdldE1pbGxpc2Vjb25kcyIsInRpbWUiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsIkNvbG9yIiwicHJvdG90eXBlIiwiZ2V0IiwiX2RhdGEiLCJGbG9hdDMyQXJyYXkiLCJyIiwiZyIsImIiLCJhIiwiX2RhdGEzIiwiaW5oZXJpdHMiLCJTZWxmIiwiU3VwZXIiLCJUZW1wIiwiRnVuYyIsImFyZzEiLCJhcmcyIiwiYXJnMyIsImFyZzQiLCJhcmc1IiwiYXJnNiIsImFyZzciLCJhcmc4IiwiY2FsbCIsIl9zdXBlciIsIm1ha2VBcnJheSIsImFyciIsIkFycmF5Iiwic2xpY2UiLCJjcmVhdGVTdHlsZSIsImNzc1N0cmluZyIsInJlc3VsdCIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsInR5cGUiLCJzdHlsZVNoZWV0IiwiY3NzVGV4dCIsImFwcGVuZENoaWxkIiwiY3JlYXRlVGV4dE5vZGUiLCJtYXRoIiwiSU5WX0xPRzIiLCJNYXRoIiwiTE9HMkUiLCJpbnRUb0J5dGVzIiwiaW50VG9CeXRlczMyIiwiYnl0ZXNUb0ludCIsImJ5dGVzVG9JbnQzMiIsIlZlYzIiLCJ4IiwieSIsInNjYWxlIiwibXVsU2NhbGFyIiwiVmVjMyIsInoiLCJWZWM0IiwidyIsInNoYXBlIiwiQWFiYiIsIkJvdW5kaW5nQm94IiwiU3BoZXJlIiwiQm91bmRpbmdTcGhlcmUiLCJQbGFuZSIsImludGVyc2VjdFJheSIsImludGVyc2VjdHNSYXkiLCJGcnVzdHVtIiwidXBkYXRlIiwicHJvamVjdGlvbk1hdHJpeCIsInZpZXdNYXRyaXgiLCJ2aWV3UHJvaiIsIk1hdDQiLCJtdWwyIiwic2V0RnJvbU1hdDQiLCJFTEVNRU5UVFlQRV9JTlQ4IiwiVFlQRV9JTlQ4IiwiRUxFTUVOVFRZUEVfVUlOVDgiLCJUWVBFX1VJTlQ4IiwiRUxFTUVOVFRZUEVfSU5UMTYiLCJUWVBFX0lOVDE2IiwiRUxFTUVOVFRZUEVfVUlOVDE2IiwiVFlQRV9VSU5UMTYiLCJFTEVNRU5UVFlQRV9JTlQzMiIsIlRZUEVfSU5UMzIiLCJFTEVNRU5UVFlQRV9VSU5UMzIiLCJUWVBFX1VJTlQzMiIsIkVMRU1FTlRUWVBFX0ZMT0FUMzIiLCJUWVBFX0ZMT0FUMzIiLCJQSVhFTEZPUk1BVF9MOF9BOCIsIlBJWEVMRk9STUFUX0xBOCIsIlBJWEVMRk9STUFUX1I1X0c2X0I1IiwiUElYRUxGT1JNQVRfUkdCNTY1IiwiUElYRUxGT1JNQVRfUjVfRzVfQjVfQTEiLCJQSVhFTEZPUk1BVF9SR0JBNTU1MSIsIlBJWEVMRk9STUFUX1I0X0c0X0I0X0E0IiwiUElYRUxGT1JNQVRfUkdCQTQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COCIsIlBJWEVMRk9STUFUX1JHQjgiLCJQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IiLCJtZXNzYWdlIiwibmFtZSIsIkVycm9yIiwiQ29udGV4dENyZWF0aW9uRXJyb3IiLCJwcm9ncmFtbGliIiwiYmVnaW4iLCJkdW1teUZyYWdtZW50Q29kZSIsIlNoYWRlclV0aWxzIiwiZW5kIiwiZm9nQ29kZSIsImdhbW1hQ29kZSIsInByZWNpc2lvbkNvZGUiLCJza2luQ29kZSIsInRvbmVtYXBDb2RlIiwidmVyc2lvbkNvZGUiLCJnZngiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJBRERSRVNTX01JUlJPUkVEX1JFUEVBVCIsIkFERFJFU1NfUkVQRUFUIiwiQkxFTkRNT0RFX1pFUk8iLCJCTEVORE1PREVfT05FIiwiQkxFTkRNT0RFX1NSQ19DT0xPUiIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SIiwiQkxFTkRNT0RFX0RTVF9DT0xPUiIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SIiwiQkxFTkRNT0RFX1NSQ19BTFBIQSIsIkJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEUiLCJCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSIsIkJMRU5ETU9ERV9EU1RfQUxQSEEiLCJCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSIsIkJVRkZFUl9TVEFUSUMiLCJCVUZGRVJfRFlOQU1JQyIsIkJVRkZFUl9TVFJFQU0iLCJDVUxMRkFDRV9OT05FIiwiQ1VMTEZBQ0VfQkFDSyIsIkNVTExGQUNFX0ZST05UIiwiQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLIiwiRklMVEVSX05FQVJFU1QiLCJGSUxURVJfTElORUFSIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsIklOREVYRk9STUFUX1VJTlQ4IiwiSU5ERVhGT1JNQVRfVUlOVDE2IiwiSU5ERVhGT1JNQVRfVUlOVDMyIiwiUFJJTUlUSVZFX1BPSU5UUyIsIlBSSU1JVElWRV9MSU5FUyIsIlBSSU1JVElWRV9MSU5FTE9PUCIsIlBSSU1JVElWRV9MSU5FU1RSSVAiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiUFJJTUlUSVZFX1RSSUZBTiIsIlNFTUFOVElDX1BPU0lUSU9OIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfQ09MT1IiLCJTRU1BTlRJQ19URVhDT09SRCIsIlNFTUFOVElDX1RFWENPT1JEMCIsIlNFTUFOVElDX1RFWENPT1JEMSIsIlNFTUFOVElDX0FUVFIwIiwiU0VNQU5USUNfQVRUUjEiLCJTRU1BTlRJQ19BVFRSMiIsIlNFTUFOVElDX0FUVFIzIiwiVEVYVFVSRUxPQ0tfUkVBRCIsIlRFWFRVUkVMT0NLX1dSSVRFIiwiZHJhd1F1YWRXaXRoU2hhZGVyIiwic2hhZGVyQ2h1bmtzIiwiRGV2aWNlIiwiR3JhcGhpY3NEZXZpY2UiLCJJbmRleEJ1ZmZlciIsIlByb2dyYW1MaWJyYXJ5IiwiUmVuZGVyVGFyZ2V0IiwiU2NvcGVJZCIsIlNoYWRlciIsIlNoYWRlcklucHV0IiwiV2ViZ2xTaGFkZXJJbnB1dCIsIlRleHR1cmUiLCJWZXJ0ZXhCdWZmZXIiLCJWZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhJdGVyYXRvciIsIl92aWV3cG9ydCIsImRyYXdGdWxsc2NyZWVuUXVhZCIsImRldmljZSIsInRhcmdldCIsInZlcnRleEJ1ZmZlciIsInNoYWRlciIsInJlY3QiLCJ2aWV3cG9ydCIsIndpZHRoIiwiaCIsImhlaWdodCIsInNldCIsInBvc3RlZmZlY3QiLCJjcmVhdGVGdWxsc2NyZWVuUXVhZCIsInF1YWRWZXJ0ZXhCdWZmZXIiLCJQb3N0RWZmZWN0IiwiUG9zdEVmZmVjdFF1ZXVlIiwidHJhbnNmb3JtVlMiLCJkZXByZWNhdGVkQ2h1bmtzIiwia2V5cyIsImZvckVhY2giLCJjaHVua05hbWUiLCJyZXBsYWNlbWVudCIsInVzZUluc3RlYWQiLCJtc2ciLCJkZWZpbmVQcm9wZXJ0aWVzIiwiX2dsRnJhbWVCdWZmZXIiLCJpbXBsIiwicmdibSIsImdldERlZmF1bHRJbnN0YW5jaW5nRm9ybWF0IiwiR3JhcGhpY3NEZXZpY2VBY2Nlc3MiLCJURVhUVVJFVFlQRV9SR0JNIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsInN3aXp6bGVHR0dSIiwiVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IiLCJfZ2xUZXh0dXJlIiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJzZXRQcm9ncmFtTGlicmFyeSIsImxpYiIsInJlbW92ZVNoYWRlckZyb21DYWNoZSIsInJlbW92ZUZyb21DYWNoZSIsIlBob25nTWF0ZXJpYWwiLCJTdGFuZGFyZE1hdGVyaWFsIiwic2NlbmUiLCJwYXJ0aXRpb25Ta2luIiwicHJvY2VkdXJhbCIsImNhbGN1bGF0ZVRhbmdlbnRzIiwiY3JlYXRlTWVzaCIsImNyZWF0ZVRvcnVzIiwiY3JlYXRlQ3lsaW5kZXIiLCJjcmVhdGVDYXBzdWxlIiwiY3JlYXRlQ29uZSIsImNyZWF0ZVNwaGVyZSIsImNyZWF0ZVBsYW5lIiwiY3JlYXRlQm94IiwiQmFzaWNNYXRlcmlhbCIsIkNvbW1hbmQiLCJGb3J3YXJkUmVuZGVyZXIiLCJHcmFwaE5vZGUiLCJNYXRlcmlhbCIsIk1lc2giLCJNZXNoSW5zdGFuY2UiLCJNb2RlbCIsIlBhcnRpY2xlRW1pdHRlciIsIlBpY2tlciIsIlByb2plY3Rpb24iLCJPUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsIlBFUlNQRUNUSVZFIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsIlNjZW5lIiwiU2tpbiIsIlNraW5JbnN0YW5jZSIsImdldERlZmF1bHRNYXRlcmlhbCIsImdldEFwcGxpY2F0aW9uIiwiZ3JhcGhpY3NEZXZpY2UiLCJzaXplIiwiaW5kZXgiLCJfcHJlZmlsdGVyZWRDdWJlbWFwcyIsInZhbHVlIiwidXBkYXRlU2hhZGVycyIsIl9tb2RlbHMiLCJMYXllciIsInJ0IiwiX3JlbmRlclRhcmdldCIsIl9kaXJ0eUNhbWVyYXMiLCJfdXBkYXRlU2t5Ym94IiwiX3VwZGF0ZVNreSIsImFkZE1vZGVsIiwibW9kZWwiLCJjb250YWluc01vZGVsIiwibGF5ZXIiLCJsYXllcnMiLCJnZXRMYXllckJ5SWQiLCJMQVlFUklEX1dPUkxEIiwiYWRkTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZXMiLCJtb2RlbHMiLCJwdXNoIiwiYWRkU2hhZG93Q2FzdGVyIiwiYWRkU2hhZG93Q2FzdGVycyIsInJlbW92ZU1vZGVsIiwiaW5kZXhPZiIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJzcGxpY2UiLCJyZW1vdmVTaGFkb3dDYXN0ZXJzIiwiZ2V0TW9kZWxzIiwiQmF0Y2giLCJyZW5kZXJDb21wb3NpdGlvbiIsImNvbXAiLCJ1cGRhdGVTaGFkZXIiLCJtZXNoSW5zdGFuY2UiLCJvYmpEZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsIm1hdGVyaWFsIiwiX3NjZW5lIiwidXBkYXRlUGFzc1NoYWRlciIsInN5bmNBYWJiIiwiTW9ycGgiLCJnZXRUYXJnZXQiLCJ0YXJnZXRzIiwiX2RpcnRpZnkiLCJsb2NhbCIsIl9kaXJ0aWZ5TG9jYWwiLCJfZGlydGlmeVdvcmxkIiwiYWRkTGFiZWwiLCJsYWJlbCIsIl9sYWJlbHMiLCJnZXRMYWJlbHMiLCJoYXNMYWJlbCIsInJlbW92ZUxhYmVsIiwiZmluZEJ5TGFiZWwiLCJyZXN1bHRzIiwiaSIsIl9jaGlsZHJlbiIsImxlbmd0aCIsImdldENoaWxkcmVuIiwiY2hpbGRyZW4iLCJnZXROYW1lIiwiZ2V0UGF0aCIsInBhdGgiLCJnZXRSb290Iiwicm9vdCIsImdldFBhcmVudCIsInBhcmVudCIsInNldE5hbWUiLCJnZXRTaGFkZXIiLCJzZXRTaGFkZXIiLCJfZGVmaW5lQWxpYXMiLCJuZXdOYW1lIiwib2xkTmFtZSIsIl9kZWZpbmVPcHRpb24iLCJTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyIsImxpdE9wdGlvbnMiLCJ0ZW1wT3B0aW9ucyIsIkxpdE9wdGlvbnMiLCJsaXRPcHRpb25Qcm9wZXJ0aWVzIiwiZ2V0T3duUHJvcGVydHlOYW1lcyIsImxpdE9wdGlvbiIsImFuaW0iLCJBbmltYXRpb24iLCJLZXkiLCJOb2RlIiwiU2tlbGV0b24iLCJnZXREdXJhdGlvbiIsImR1cmF0aW9uIiwiZ2V0Tm9kZXMiLCJub2RlcyIsInNldER1cmF0aW9uIiwiZ2V0QW5pbWF0aW9uIiwiYW5pbWF0aW9uIiwiZ2V0Q3VycmVudFRpbWUiLCJjdXJyZW50VGltZSIsImdldExvb3BpbmciLCJsb29waW5nIiwiZ2V0TnVtTm9kZXMiLCJudW1Ob2RlcyIsInNldEFuaW1hdGlvbiIsInNldEN1cnJlbnRUaW1lIiwic2V0TG9vcGluZyIsImF1ZGlvIiwiQXVkaW9NYW5hZ2VyIiwiU291bmRNYW5hZ2VyIiwiQ2hhbm5lbCIsIkNoYW5uZWwzZCIsIkxpc3RlbmVyIiwiU291bmQiLCJnZXRMaXN0ZW5lciIsImxpc3RlbmVyIiwiZ2V0Vm9sdW1lIiwidm9sdW1lIiwic2V0Vm9sdW1lIiwiYXNzZXQiLCJBU1NFVF9BTklNQVRJT04iLCJBU1NFVF9BVURJTyIsIkFTU0VUX0lNQUdFIiwiQVNTRVRfSlNPTiIsIkFTU0VUX01PREVMIiwiQVNTRVRfTUFURVJJQUwiLCJBU1NFVF9URVhUIiwiQVNTRVRfVEVYVFVSRSIsIkFTU0VUX0NVQkVNQVAiLCJBU1NFVF9TQ1JJUFQiLCJBc3NldFJlZ2lzdHJ5IiwiZ2V0QXNzZXRCeUlkIiwiaWQiLCJYcklucHV0U291cmNlIiwiX3JheUxvY2FsIiwiX2xvY2FsUG9zaXRpb24iLCJfbG9jYWxSb3RhdGlvbiIsImlucHV0IiwiZ2V0VG91Y2hUYXJnZXRDb29yZHMiLCJDb250cm9sbGVyIiwiR2FtZVBhZHMiLCJLZXlib2FyZCIsIktleWJvYXJkRXZlbnQiLCJNb3VzZSIsIk1vdXNlRXZlbnQiLCJUb3VjaCIsIlRvdWNoRGV2aWNlIiwiVG91Y2hFdmVudCIsIkVsZW1lbnRJbnB1dCIsIndoZWVsRGVsdGEiLCJSSUdJREJPRFlfVFlQRV9TVEFUSUMiLCJCT0RZVFlQRV9TVEFUSUMiLCJSSUdJREJPRFlfVFlQRV9EWU5BTUlDIiwiQk9EWVRZUEVfRFlOQU1JQyIsIlJJR0lEQk9EWV9UWVBFX0tJTkVNQVRJQyIsIkJPRFlUWVBFX0tJTkVNQVRJQyIsIlJJR0lEQk9EWV9DRl9TVEFUSUNfT0JKRUNUIiwiQk9EWUZMQUdfU1RBVElDX09CSkVDVCIsIlJJR0lEQk9EWV9DRl9LSU5FTUFUSUNfT0JKRUNUIiwiQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCIsIlJJR0lEQk9EWV9DRl9OT1JFU1BPTlNFX09CSkVDVCIsIkJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUIiwiUklHSURCT0RZX0FDVElWRV9UQUciLCJCT0RZU1RBVEVfQUNUSVZFX1RBRyIsIlJJR0lEQk9EWV9JU0xBTkRfU0xFRVBJTkciLCJCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HIiwiUklHSURCT0RZX1dBTlRTX0RFQUNUSVZBVElPTiIsIkJPRFlTVEFURV9XQU5UU19ERUFDVElWQVRJT04iLCJSSUdJREJPRFlfRElTQUJMRV9ERUFDVElWQVRJT04iLCJCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04iLCJSSUdJREJPRFlfRElTQUJMRV9TSU1VTEFUSU9OIiwiQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiIsIkFwcEJhc2UiLCJpc0Z1bGxzY3JlZW4iLCJmdWxsc2NyZWVuRWxlbWVudCIsImVuYWJsZUZ1bGxzY3JlZW4iLCJlbGVtZW50Iiwic3VjY2VzcyIsImNhbnZhcyIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJlIiwiYWRkRXZlbnRMaXN0ZW5lciIsInJlcXVlc3RGdWxsc2NyZWVuIiwiRWxlbWVudCIsIkFMTE9XX0tFWUJPQVJEX0lOUFVUIiwiZGlzYWJsZUZ1bGxzY3JlZW4iLCJleGl0RnVsbHNjcmVlbiIsImdldFNjZW5lVXJsIiwiZW50cnkiLCJzY2VuZXMiLCJmaW5kIiwidXJsIiwibG9hZFNjZW5lIiwiY2FsbGJhY2siLCJsb2FkU2NlbmVIaWVyYXJjaHkiLCJsb2FkU2NlbmVTZXR0aW5ncyIsInJlbmRlck1lc2hJbnN0YW5jZSIsIm9wdGlvbnMiLCJkZWZhdWx0RHJhd0xheWVyIiwiaW1tZWRpYXRlIiwiZHJhd01lc2giLCJyZW5kZXJNZXNoIiwibWVzaCIsIm1hdHJpeCIsIl9hZGRMaW5lcyIsInBvc2l0aW9ucyIsImNvbG9ycyIsIkxBWUVSSURfSU1NRURJQVRFIiwiZGVwdGhUZXN0IiwidW5kZWZpbmVkIiwiYmF0Y2giLCJnZXRCYXRjaCIsImFkZExpbmVzIiwicmVuZGVyTGluZSIsImNvbG9yIiwiZW5kQ29sb3IiLCJhcmd1bWVudHMiLCJMSU5FQkFUQ0hfT1ZFUkxBWSIsInJlbmRlckxpbmVzIiwicG9zaXRpb24iLCJtdWx0aUNvbG9yIiwiZW5hYmxlVnIiLCJDYW1lcmFDb21wb25lbnQiLCJlbnRpdHkiLCJMaWdodENvbXBvbmVudCIsImVuYWJsZWQiLCJNb2RlbENvbXBvbmVudCIsInNldFZpc2libGUiLCJ2aXNpYmxlIiwiUmVuZGVyQ29tcG9uZW50IiwiUmlnaWRCb2R5Q29tcG9uZW50Iiwic3luY0JvZHlUb0VudGl0eSIsIl91cGRhdGVEeW5hbWljIiwiUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIiwic2V0R3Jhdml0eSIsImdyYXZpdHkiLCJjb3B5IiwiYmFzaXNTZXREb3dubG9hZENvbmZpZyIsImdsdWVVcmwiLCJ3YXNtVXJsIiwiZmFsbGJhY2tVcmwiLCJiYXNpc0luaXRpYWxpemUiLCJsYXp5SW5pdCIsInByZWZpbHRlckN1YmVtYXAiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFIQTs7QUFFTyxNQUFNQSxHQUFHLEdBQUc7RUFDZkMsS0FBSyxFQUFFLFVBQVVDLElBQUksRUFBRTtBQUNuQkMsSUFBQUEsS0FBSyxDQUFDQyxVQUFVLENBQUMsc0RBQXNELENBQUMsQ0FBQTtBQUN4RUMsSUFBQUEsT0FBTyxDQUFDTCxHQUFHLENBQUNFLElBQUksQ0FBQyxDQUFBO0dBQ3BCO0FBRURJLEVBQUFBLElBQUksRUFBRSxZQUFZO0FBQ2RILElBQUFBLEtBQUssQ0FBQ0MsVUFBVSxDQUFDLHFEQUFxRCxDQUFDLENBQUE7SUFDdkVKLEdBQUcsQ0FBQ0MsS0FBSyxDQUFDLHdCQUF3QixHQUFHTSxPQUFPLEdBQUcsR0FBRyxHQUFHQyxRQUFRLENBQUMsQ0FBQTtHQUNqRTtFQUVEQyxJQUFJLEVBQUUsVUFBVVAsSUFBSSxFQUFFO0FBQ2xCQyxJQUFBQSxLQUFLLENBQUNDLFVBQVUsQ0FBQyxzREFBc0QsQ0FBQyxDQUFBO0FBQ3hFQyxJQUFBQSxPQUFPLENBQUNJLElBQUksQ0FBQyxXQUFXLEdBQUdQLElBQUksQ0FBQyxDQUFBO0dBQ25DO0VBRURRLEtBQUss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
