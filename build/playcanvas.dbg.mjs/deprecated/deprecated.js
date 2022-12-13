/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { version, revision } from '../core/core.js';
import { string } from '../core/string.js';
import { now, Timer } from '../core/time.js';
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
import { drawQuadWithShader } from '../platform/graphics/simple-post-effect.js';
import { shaderChunks } from '../scene/shader-lib/chunks/chunks.js';
import { GraphicsDevice } from '../platform/graphics/graphics-device.js';
import { IndexBuffer } from '../platform/graphics/index-buffer.js';
import { createFullscreenQuad, drawFullscreenQuad, PostEffect } from '../scene/graphics/post-effect.js';
import { PostEffectQueue } from '../framework/components/camera/post-effect-queue.js';
import { ProgramLibrary } from '../scene/shader-lib/program-library.js';
import { getProgramLibrary, setProgramLibrary } from '../scene/shader-lib/get-program-library.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { ScopeId } from '../platform/graphics/scope-id.js';
import { Shader } from '../platform/graphics/shader.js';
import { ShaderInput } from '../platform/graphics/shader-input.js';
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
    alert(text);
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
  ShaderInput: ShaderInput,
  Texture: Texture,
  UnsupportedBrowserError: UnsupportedBrowserError,
  VertexBuffer: VertexBuffer,
  VertexFormat: VertexFormat,
  VertexIterator: VertexIterator
};
const posteffect = {
  createFullscreenQuad: createFullscreenQuad,
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
VertexFormat.prototype.update = function () {
  Debug.deprecated('pc.VertexFormat.update is deprecated, and VertexFormat cannot be changed after it has been created.');
};
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
  Debug.deprecated('pc.AppBase#isFullscreen is deprecated. Use the Fullscreen API directly.');
  return !!document.fullscreenElement;
};
AppBase.prototype.enableFullscreen = function (element, success, error) {
  Debug.deprecated('pc.AppBase#enableFullscreen is deprecated. Use the Fullscreen API directly.');
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
  Debug.deprecated('pc.AppBase#disableFullscreen is deprecated. Use the Fullscreen API directly.');

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
  Debug.deprecated('pc.AppBase.renderLines is deprecated. Use pc.AppBase.drawLines.');
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

export { ContextCreationError, ELEMENTTYPE_FLOAT32, ELEMENTTYPE_INT16, ELEMENTTYPE_INT32, ELEMENTTYPE_INT8, ELEMENTTYPE_UINT16, ELEMENTTYPE_UINT32, ELEMENTTYPE_UINT8, PIXELFORMAT_L8_A8, PIXELFORMAT_R4_G4_B4_A4, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PhongMaterial, RIGIDBODY_ACTIVE_TAG, RIGIDBODY_CF_KINEMATIC_OBJECT, RIGIDBODY_CF_NORESPONSE_OBJECT, RIGIDBODY_CF_STATIC_OBJECT, RIGIDBODY_DISABLE_DEACTIVATION, RIGIDBODY_DISABLE_SIMULATION, RIGIDBODY_ISLAND_SLEEPING, RIGIDBODY_TYPE_DYNAMIC, RIGIDBODY_TYPE_KINEMATIC, RIGIDBODY_TYPE_STATIC, RIGIDBODY_WANTS_DEACTIVATION, UnsupportedBrowserError, anim, asset, audio, basisSetDownloadConfig, gfx, inherits, input, log, makeArray, posteffect, prefilterCubemap, programlib, scene, shape, time };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwcmVjYXRlZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2RlcHJlY2F0ZWQvZGVwcmVjYXRlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXZpc2lvbiwgdmVyc2lvbiB9IGZyb20gJy4uL2NvcmUvY29yZS5qcyc7XG5pbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuLi9jb3JlL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBUaW1lciwgbm93IH0gZnJvbSAnLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcbmltcG9ydCB7IEJvdW5kaW5nU3BoZXJlIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1zcGhlcmUuanMnO1xuaW1wb3J0IHsgRnJ1c3R1bSB9IGZyb20gJy4uL2NvcmUvc2hhcGUvZnJ1c3R1bS5qcyc7XG5pbXBvcnQgeyBQbGFuZSB9IGZyb20gJy4uL2NvcmUvc2hhcGUvcGxhbmUuanMnO1xuXG5pbXBvcnQge1xuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSwgQUREUkVTU19NSVJST1JFRF9SRVBFQVQsIEFERFJFU1NfUkVQRUFULFxuICAgIEJMRU5ETU9ERV9aRVJPLCBCTEVORE1PREVfT05FLCBCTEVORE1PREVfU1JDX0NPTE9SLCBCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICBCTEVORE1PREVfRFNUX0NPTE9SLCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUiwgQkxFTkRNT0RFX1NSQ19BTFBIQSwgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSwgQkxFTkRNT0RFX0RTVF9BTFBIQSwgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEsXG4gICAgQlVGRkVSX1NUQVRJQywgQlVGRkVSX0RZTkFNSUMsIEJVRkZFUl9TVFJFQU0sXG4gICAgQ1VMTEZBQ0VfTk9ORSwgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfRlJPTlQsIENVTExGQUNFX0ZST05UQU5EQkFDSyxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQSVhFTEZPUk1BVF9MQTgsIFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTU1NTEsIFBJWEVMRk9STUFUX1JHQkE0LCBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICBQUklNSVRJVkVfUE9JTlRTLCBQUklNSVRJVkVfTElORVMsIFBSSU1JVElWRV9MSU5FTE9PUCwgUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTLCBQUklNSVRJVkVfVFJJU1RSSVAsIFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfQ09MT1IsIFNFTUFOVElDX1RFWENPT1JELCBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19BVFRSMCwgU0VNQU5USUNfQVRUUjEsIFNFTUFOVElDX0FUVFIyLCBTRU1BTlRJQ19BVFRSMyxcbiAgICBURVhUVVJFTE9DS19SRUFELCBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNLCBURVhUVVJFVFlQRV9TV0laWkxFR0dHUixcbiAgICBUWVBFX0lOVDgsIFRZUEVfVUlOVDgsIFRZUEVfSU5UMTYsIFRZUEVfVUlOVDE2LCBUWVBFX0lOVDMyLCBUWVBFX1VJTlQzMiwgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBiZWdpbiwgZW5kLCBmb2dDb2RlLCBnYW1tYUNvZGUsIHNraW5Db2RlLCB0b25lbWFwQ29kZSB9IGZyb20gJy4uL3NjZW5lL3NoYWRlci1saWIvcHJvZ3JhbXMvY29tbW9uLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NpbXBsZS1wb3N0LWVmZmVjdC5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgR3JhcGhpY3NEZXZpY2UgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnO1xuaW1wb3J0IHsgSW5kZXhCdWZmZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9pbmRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgY3JlYXRlRnVsbHNjcmVlblF1YWQsIGRyYXdGdWxsc2NyZWVuUXVhZCwgUG9zdEVmZmVjdCB9IGZyb20gJy4uL3NjZW5lL2dyYXBoaWNzL3Bvc3QtZWZmZWN0LmpzJztcbmltcG9ydCB7IFBvc3RFZmZlY3RRdWV1ZSB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9wb3N0LWVmZmVjdC1xdWV1ZS5qcyc7XG5pbXBvcnQgeyBQcm9ncmFtTGlicmFyeSB9IGZyb20gJy4uL3NjZW5lL3NoYWRlci1saWIvcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IGdldFByb2dyYW1MaWJyYXJ5LCBzZXRQcm9ncmFtTGlicmFyeSB9IGZyb20gJy4uL3NjZW5lL3NoYWRlci1saWIvZ2V0LXByb2dyYW0tbGlicmFyeS5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IFNjb3BlSWQgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9zY29wZS1pZC5qcyc7XG5pbXBvcnQgeyBTaGFkZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXIuanMnO1xuaW1wb3J0IHsgU2hhZGVySW5wdXQgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9zaGFkZXItaW5wdXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcbmltcG9ydCB7IFZlcnRleEl0ZXJhdG9yIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWl0ZXJhdG9yLmpzJztcbmltcG9ydCB7IFNoYWRlclV0aWxzIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXV0aWxzLmpzJztcbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlQWNjZXNzIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLWFjY2Vzcy5qcyc7XG5cbmltcG9ydCB7IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLCBMQVlFUklEX0lNTUVESUFURSwgTElORUJBVENIX09WRVJMQVksIExBWUVSSURfV09STEQgfSBmcm9tICcuLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgY2FsY3VsYXRlVGFuZ2VudHMsIGNyZWF0ZUJveCwgY3JlYXRlQ2Fwc3VsZSwgY3JlYXRlQ29uZSwgY3JlYXRlQ3lsaW5kZXIsIGNyZWF0ZU1lc2gsIGNyZWF0ZVBsYW5lLCBjcmVhdGVTcGhlcmUsIGNyZWF0ZVRvcnVzIH0gZnJvbSAnLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBwYXJ0aXRpb25Ta2luIH0gZnJvbSAnLi4vc2NlbmUvc2tpbi1wYXJ0aXRpb24uanMnO1xuaW1wb3J0IHsgQmFzaWNNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9iYXNpYy1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBGb3J3YXJkUmVuZGVyZXIgfSBmcm9tICcuLi9zY2VuZS9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UsIENvbW1hbmQgfSBmcm9tICcuLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgUGFydGljbGVFbWl0dGVyIH0gZnJvbSAnLi4vc2NlbmUvcGFydGljbGUtc3lzdGVtL3BhcnRpY2xlLWVtaXR0ZXIuanMnO1xuaW1wb3J0IHsgUGlja2VyIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2dyYXBoaWNzL3BpY2tlci5qcyc7XG5pbXBvcnQgeyBTY2VuZSB9IGZyb20gJy4uL3NjZW5lL3NjZW5lLmpzJztcbmltcG9ydCB7IFNraW4gfSBmcm9tICcuLi9zY2VuZS9za2luLmpzJztcbmltcG9ydCB7IFNraW5JbnN0YW5jZSB9IGZyb20gJy4uL3NjZW5lL3NraW4taW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBCYXRjaCB9IGZyb20gJy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9kZWZhdWx0LW1hdGVyaWFsLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTGl0T3B0aW9ucyB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9saXQtb3B0aW9ucy5qcyc7XG5cbmltcG9ydCB7IEFuaW1hdGlvbiwgS2V5LCBOb2RlIH0gZnJvbSAnLi4vc2NlbmUvYW5pbWF0aW9uL2FuaW1hdGlvbi5qcyc7XG5pbXBvcnQgeyBTa2VsZXRvbiB9IGZyb20gJy4uL3NjZW5lL2FuaW1hdGlvbi9za2VsZXRvbi5qcyc7XG5cbmltcG9ydCB7IENoYW5uZWwgfSBmcm9tICcuLi9wbGF0Zm9ybS9hdWRpby9jaGFubmVsLmpzJztcbmltcG9ydCB7IENoYW5uZWwzZCB9IGZyb20gJy4uL3BsYXRmb3JtL2F1ZGlvL2NoYW5uZWwzZC5qcyc7XG5pbXBvcnQgeyBMaXN0ZW5lciB9IGZyb20gJy4uL3BsYXRmb3JtL3NvdW5kL2xpc3RlbmVyLmpzJztcbmltcG9ydCB7IFNvdW5kIH0gZnJvbSAnLi4vcGxhdGZvcm0vc291bmQvc291bmQuanMnO1xuaW1wb3J0IHsgU291bmRNYW5hZ2VyIH0gZnJvbSAnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcyc7XG5cbmltcG9ydCB7IEFzc2V0UmVnaXN0cnkgfSBmcm9tICcuLi9mcmFtZXdvcmsvYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMnO1xuXG5pbXBvcnQgeyBYcklucHV0U291cmNlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL3hyL3hyLWlucHV0LXNvdXJjZS5qcyc7XG5cbmltcG9ydCB7IENvbnRyb2xsZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9jb250cm9sbGVyLmpzJztcbmltcG9ydCB7IEVsZW1lbnRJbnB1dCB9IGZyb20gJy4uL2ZyYW1ld29yay9pbnB1dC9lbGVtZW50LWlucHV0LmpzJztcbmltcG9ydCB7IEdhbWVQYWRzIH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvZ2FtZS1wYWRzLmpzJztcbmltcG9ydCB7IEtleWJvYXJkIH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQva2V5Ym9hcmQuanMnO1xuaW1wb3J0IHsgS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L2tleWJvYXJkLWV2ZW50LmpzJztcbmltcG9ydCB7IE1vdXNlIH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UuanMnO1xuaW1wb3J0IHsgTW91c2VFdmVudCB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L21vdXNlLWV2ZW50LmpzJztcbmltcG9ydCB7IFRvdWNoRGV2aWNlIH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvdG91Y2gtZGV2aWNlLmpzJztcbmltcG9ydCB7IGdldFRvdWNoVGFyZ2V0Q29vcmRzLCBUb3VjaCwgVG91Y2hFdmVudCB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L3RvdWNoLWV2ZW50LmpzJztcblxuaW1wb3J0IHsgQXBwQmFzZSB9IGZyb20gJy4uL2ZyYW1ld29yay9hcHAtYmFzZS5qcyc7XG5pbXBvcnQgeyBnZXRBcHBsaWNhdGlvbiB9IGZyb20gJy4uL2ZyYW1ld29yay9nbG9iYWxzLmpzJztcbmltcG9ydCB7IENhbWVyYUNvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgTGlnaHRDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9saWdodC9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgTW9kZWxDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9tb2RlbC9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgUmVuZGVyQ29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvcmVuZGVyL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQge1xuICAgIEJPRFlGTEFHX0tJTkVNQVRJQ19PQkpFQ1QsIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNULCBCT0RZRkxBR19TVEFUSUNfT0JKRUNULFxuICAgIEJPRFlTVEFURV9BQ1RJVkVfVEFHLCBCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04sIEJPRFlTVEFURV9ESVNBQkxFX1NJTVVMQVRJT04sIEJPRFlTVEFURV9JU0xBTkRfU0xFRVBJTkcsIEJPRFlTVEFURV9XQU5UU19ERUFDVElWQVRJT04sXG4gICAgQk9EWVRZUEVfRFlOQU1JQywgQk9EWVRZUEVfS0lORU1BVElDLCBCT0RZVFlQRV9TVEFUSUNcbn0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgUmlnaWRCb2R5Q29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9zeXN0ZW0uanMnO1xuaW1wb3J0IHsgYmFzaXNJbml0aWFsaXplIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2hhbmRsZXJzL2Jhc2lzLmpzJztcblxuLy8gQ09SRVxuXG5leHBvcnQgY29uc3QgbG9nID0ge1xuICAgIHdyaXRlOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cud3JpdGUgaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUubG9nKHRleHQpO1xuICAgIH0sXG5cbiAgICBvcGVuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5vcGVuIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLmxvZyBpbnN0ZWFkLicpO1xuICAgICAgICBsb2cud3JpdGUoJ1Bvd2VyZWQgYnkgUGxheUNhbnZhcyAnICsgdmVyc2lvbiArICcgJyArIHJldmlzaW9uKTtcbiAgICB9LFxuXG4gICAgaW5mbzogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmluZm8gaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUuaW5mbyBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLmluZm8oJ0lORk86ICAgICcgKyB0ZXh0KTtcbiAgICB9LFxuXG4gICAgZGVidWc6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5kZWJ1ZyBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5kZWJ1ZyBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLmRlYnVnKCdERUJVRzogICAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIGVycm9yOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuZXJyb3IgaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUuZXJyb3IgaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS5lcnJvcignRVJST1I6ICAgJyArIHRleHQpO1xuICAgIH0sXG5cbiAgICB3YXJuaW5nOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cud2FybmluZyBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS53YXJuIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUud2FybignV0FSTklORzogJyArIHRleHQpO1xuICAgIH0sXG5cbiAgICBhbGVydDogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmFsZXJ0IGlzIGRlcHJlY2F0ZWQuIFVzZSBhbGVydCBpbnN0ZWFkLicpO1xuICAgICAgICBsb2cud3JpdGUoJ0FMRVJUOiAgICcgKyB0ZXh0KTtcbiAgICAgICAgYWxlcnQodGV4dCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tYWxlcnRcbiAgICB9LFxuXG4gICAgYXNzZXJ0OiBmdW5jdGlvbiAoY29uZGl0aW9uLCB0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5hc3NlcnQgaXMgZGVwcmVjYXRlZC4gVXNlIGEgY29uZGl0aW9uYWwgcGx1cyBjb25zb2xlLmxvZyBpbnN0ZWFkLicpO1xuICAgICAgICBpZiAoY29uZGl0aW9uID09PSBmYWxzZSkge1xuICAgICAgICAgICAgbG9nLndyaXRlKCdBU1NFUlQ6ICAnICsgdGV4dCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5zdHJpbmcuZW5kc1dpdGggPSBmdW5jdGlvbiAocywgc3Vicykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLnN0cmluZy5lbmRzV2l0aCBpcyBkZXByZWNhdGVkLiBVc2UgU3RyaW5nI2VuZHNXaXRoIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHMuZW5kc1dpdGgoc3Vicyk7XG59O1xuXG5zdHJpbmcuc3RhcnRzV2l0aCA9IGZ1bmN0aW9uIChzLCBzdWJzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuc3RyaW5nLnN0YXJ0c1dpdGggaXMgZGVwcmVjYXRlZC4gVXNlIFN0cmluZyNzdGFydHNXaXRoIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHMuc3RhcnRzV2l0aChzdWJzKTtcbn07XG5cbmV4cG9ydCBjb25zdCB0aW1lID0ge1xuICAgIG5vdzogbm93LFxuICAgIFRpbWVyOiBUaW1lclxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkNvbG9yI2RhdGEgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIGNvbG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy5yO1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy5iO1xuICAgICAgICB0aGlzLl9kYXRhWzNdID0gdGhpcy5hO1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Db2xvciNkYXRhMyBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgY29sb3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEzKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhMyA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YTNbMF0gPSB0aGlzLnI7XG4gICAgICAgIHRoaXMuX2RhdGEzWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhM1syXSA9IHRoaXMuYjtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGEzO1xuICAgIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gaW5oZXJpdHMoU2VsZiwgU3VwZXIpIHtcbiAgICBjb25zdCBUZW1wID0gZnVuY3Rpb24gKCkge307XG4gICAgY29uc3QgRnVuYyA9IGZ1bmN0aW9uIChhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KSB7XG4gICAgICAgIFN1cGVyLmNhbGwodGhpcywgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCk7XG4gICAgICAgIFNlbGYuY2FsbCh0aGlzLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KTtcbiAgICAgICAgLy8gdGhpcy5jb25zdHJ1Y3RvciA9IFNlbGY7XG4gICAgfTtcbiAgICBGdW5jLl9zdXBlciA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBUZW1wLnByb3RvdHlwZSA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBGdW5jLnByb3RvdHlwZSA9IG5ldyBUZW1wKCk7XG5cbiAgICByZXR1cm4gRnVuYztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VBcnJheShhcnIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5tYWtlQXJyYXkgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gVXNlIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFycik7XG59XG5cbi8vIE1BVEhcblxubWF0aC5JTlZfTE9HMiA9IE1hdGguTE9HMkU7XG5cbm1hdGguaW50VG9CeXRlcyA9IG1hdGguaW50VG9CeXRlczMyO1xubWF0aC5ieXRlc1RvSW50ID0gbWF0aC5ieXRlc1RvSW50MzI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShWZWMyLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlZlYzIjZGF0YSBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgdmVjdG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy54O1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy55O1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuVmVjMi5wcm90b3R5cGUuc2NhbGUgPSBWZWMyLnByb3RvdHlwZS5tdWxTY2FsYXI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShWZWMzLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlZlYzMjZGF0YSBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgdmVjdG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy54O1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy55O1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy56O1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuVmVjMy5wcm90b3R5cGUuc2NhbGUgPSBWZWMzLnByb3RvdHlwZS5tdWxTY2FsYXI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShWZWM0LnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlZlYzQjZGF0YSBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgdmVjdG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy54O1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy55O1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy56O1xuICAgICAgICB0aGlzLl9kYXRhWzNdID0gdGhpcy53O1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuVmVjNC5wcm90b3R5cGUuc2NhbGUgPSBWZWM0LnByb3RvdHlwZS5tdWxTY2FsYXI7XG5cbi8vIFNIQVBFXG5cbmV4cG9ydCBjb25zdCBzaGFwZSA9IHtcbiAgICBBYWJiOiBCb3VuZGluZ0JveCxcbiAgICBTcGhlcmU6IEJvdW5kaW5nU3BoZXJlLFxuICAgIFBsYW5lOiBQbGFuZVxufTtcblxuQm91bmRpbmdTcGhlcmUucHJvdG90eXBlLmludGVyc2VjdFJheSA9IEJvdW5kaW5nU3BoZXJlLnByb3RvdHlwZS5pbnRlcnNlY3RzUmF5O1xuXG5GcnVzdHVtLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbiAocHJvamVjdGlvbk1hdHJpeCwgdmlld01hdHJpeCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkZydXN0dW0jdXBkYXRlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5GcnVzdHVtI3NldEZyb21NYXQ0IGluc3RlYWQuJyk7XG5cbiAgICBjb25zdCB2aWV3UHJvaiA9IG5ldyBNYXQ0KCk7XG5cbiAgICB2aWV3UHJvai5tdWwyKHByb2plY3Rpb25NYXRyaXgsIHZpZXdNYXRyaXgpO1xuXG4gICAgdGhpcy5zZXRGcm9tTWF0NCh2aWV3UHJvaik7XG59O1xuXG4vLyBHUkFQSElDU1xuXG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfSU5UOCA9IFRZUEVfSU5UODtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9VSU5UOCA9IFRZUEVfVUlOVDg7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfSU5UMTYgPSBUWVBFX0lOVDE2O1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQxNiA9IFRZUEVfVUlOVDE2O1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX0lOVDMyID0gVFlQRV9JTlQzMjtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9VSU5UMzIgPSBUWVBFX1VJTlQzMjtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9GTE9BVDMyID0gVFlQRV9GTE9BVDMyO1xuXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfTDhfQTggPSBQSVhFTEZPUk1BVF9MQTg7XG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUjVfRzZfQjUgPSBQSVhFTEZPUk1BVF9SR0I1NjU7XG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUjVfRzVfQjVfQTEgPSBQSVhFTEZPUk1BVF9SR0JBNTU1MTtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNCA9IFBJWEVMRk9STUFUX1JHQkE0O1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1I4X0c4X0I4ID0gUElYRUxGT1JNQVRfUkdCODtcbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCA9IFBJWEVMRk9STUFUX1JHQkE4O1xuXG5leHBvcnQgZnVuY3Rpb24gVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgZnVuY3Rpb24gQ29udGV4dENyZWF0aW9uRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdDb250ZXh0Q3JlYXRpb25FcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuQ29udGV4dENyZWF0aW9uRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgY29uc3QgcHJvZ3JhbWxpYiA9IHtcbiAgICBiZWdpbjogYmVnaW4sXG4gICAgZHVtbXlGcmFnbWVudENvZGU6IFNoYWRlclV0aWxzLmR1bW15RnJhZ21lbnRDb2RlLFxuICAgIGVuZDogZW5kLFxuICAgIGZvZ0NvZGU6IGZvZ0NvZGUsXG4gICAgZ2FtbWFDb2RlOiBnYW1tYUNvZGUsXG4gICAgcHJlY2lzaW9uQ29kZTogU2hhZGVyVXRpbHMucHJlY2lzaW9uQ29kZSxcbiAgICBza2luQ29kZTogc2tpbkNvZGUsXG4gICAgdG9uZW1hcENvZGU6IHRvbmVtYXBDb2RlLFxuICAgIHZlcnNpb25Db2RlOiBTaGFkZXJVdGlscy52ZXJzaW9uQ29kZVxufTtcblxuZXhwb3J0IGNvbnN0IGdmeCA9IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDogQUREUkVTU19NSVJST1JFRF9SRVBFQVQsXG4gICAgQUREUkVTU19SRVBFQVQ6IEFERFJFU1NfUkVQRUFULFxuICAgIEJMRU5ETU9ERV9aRVJPOiBCTEVORE1PREVfWkVSTyxcbiAgICBCTEVORE1PREVfT05FOiBCTEVORE1PREVfT05FLFxuICAgIEJMRU5ETU9ERV9TUkNfQ09MT1I6IEJMRU5ETU9ERV9TUkNfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9EU1RfQ09MT1I6IEJMRU5ETU9ERV9EU1RfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9TUkNfQUxQSEE6IEJMRU5ETU9ERV9TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURTogQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX0RTVF9BTFBIQTogQkxFTkRNT0RFX0RTVF9BTFBIQSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEsXG4gICAgQlVGRkVSX1NUQVRJQzogQlVGRkVSX1NUQVRJQyxcbiAgICBCVUZGRVJfRFlOQU1JQzogQlVGRkVSX0RZTkFNSUMsXG4gICAgQlVGRkVSX1NUUkVBTTogQlVGRkVSX1NUUkVBTSxcbiAgICBDVUxMRkFDRV9OT05FOiBDVUxMRkFDRV9OT05FLFxuICAgIENVTExGQUNFX0JBQ0s6IENVTExGQUNFX0JBQ0ssXG4gICAgQ1VMTEZBQ0VfRlJPTlQ6IENVTExGQUNFX0ZST05ULFxuICAgIENVTExGQUNFX0ZST05UQU5EQkFDSzogQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLLFxuICAgIEVMRU1FTlRUWVBFX0lOVDg6IFRZUEVfSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9VSU5UODogVFlQRV9VSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9JTlQxNjogVFlQRV9JTlQxNixcbiAgICBFTEVNRU5UVFlQRV9VSU5UMTY6IFRZUEVfVUlOVDE2LFxuICAgIEVMRU1FTlRUWVBFX0lOVDMyOiBUWVBFX0lOVDMyLFxuICAgIEVMRU1FTlRUWVBFX1VJTlQzMjogVFlQRV9VSU5UMzIsXG4gICAgRUxFTUVOVFRZUEVfRkxPQVQzMjogVFlQRV9GTE9BVDMyLFxuICAgIEZJTFRFUl9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVCxcbiAgICBGSUxURVJfTElORUFSOiBGSUxURVJfTElORUFSLFxuICAgIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCxcbiAgICBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q6IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSOiBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDg6IElOREVYRk9STUFUX1VJTlQ4LFxuICAgIElOREVYRk9STUFUX1VJTlQxNjogSU5ERVhGT1JNQVRfVUlOVDE2LFxuICAgIElOREVYRk9STUFUX1VJTlQzMjogSU5ERVhGT1JNQVRfVUlOVDMyLFxuICAgIFBJWEVMRk9STUFUX1JHQjU2NTogUElYRUxGT1JNQVRfUkdCNTY1LFxuICAgIFBJWEVMRk9STUFUX1JHQjg6IFBJWEVMRk9STUFUX1JHQjgsXG4gICAgUElYRUxGT1JNQVRfUkdCQTg6IFBJWEVMRk9STUFUX1JHQkE4LFxuICAgIFBSSU1JVElWRV9QT0lOVFM6IFBSSU1JVElWRV9QT0lOVFMsXG4gICAgUFJJTUlUSVZFX0xJTkVTOiBQUklNSVRJVkVfTElORVMsXG4gICAgUFJJTUlUSVZFX0xJTkVMT09QOiBQUklNSVRJVkVfTElORUxPT1AsXG4gICAgUFJJTUlUSVZFX0xJTkVTVFJJUDogUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTOiBQUklNSVRJVkVfVFJJQU5HTEVTLFxuICAgIFBSSU1JVElWRV9UUklTVFJJUDogUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFBSSU1JVElWRV9UUklGQU46IFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT046IFNFTUFOVElDX1BPU0lUSU9OLFxuICAgIFNFTUFOVElDX05PUk1BTDogU0VNQU5USUNfTk9STUFMLFxuICAgIFNFTUFOVElDX0NPTE9SOiBTRU1BTlRJQ19DT0xPUixcbiAgICBTRU1BTlRJQ19URVhDT09SRDogU0VNQU5USUNfVEVYQ09PUkQsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQwOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgU0VNQU5USUNfQVRUUjA6IFNFTUFOVElDX0FUVFIwLFxuICAgIFNFTUFOVElDX0FUVFIxOiBTRU1BTlRJQ19BVFRSMSxcbiAgICBTRU1BTlRJQ19BVFRSMjogU0VNQU5USUNfQVRUUjIsXG4gICAgU0VNQU5USUNfQVRUUjM6IFNFTUFOVElDX0FUVFIzLFxuICAgIFRFWFRVUkVMT0NLX1JFQUQ6IFRFWFRVUkVMT0NLX1JFQUQsXG4gICAgVEVYVFVSRUxPQ0tfV1JJVEU6IFRFWFRVUkVMT0NLX1dSSVRFLFxuICAgIGRyYXdRdWFkV2l0aFNoYWRlcjogZHJhd1F1YWRXaXRoU2hhZGVyLFxuICAgIHByb2dyYW1saWI6IHByb2dyYW1saWIsXG4gICAgc2hhZGVyQ2h1bmtzOiBzaGFkZXJDaHVua3MsXG4gICAgQ29udGV4dENyZWF0aW9uRXJyb3I6IENvbnRleHRDcmVhdGlvbkVycm9yLFxuICAgIERldmljZTogR3JhcGhpY3NEZXZpY2UsXG4gICAgSW5kZXhCdWZmZXI6IEluZGV4QnVmZmVyLFxuICAgIFByb2dyYW1MaWJyYXJ5OiBQcm9ncmFtTGlicmFyeSxcbiAgICBSZW5kZXJUYXJnZXQ6IFJlbmRlclRhcmdldCxcbiAgICBTY29wZUlkOiBTY29wZUlkLFxuICAgIFNoYWRlcjogU2hhZGVyLFxuICAgIFNoYWRlcklucHV0OiBTaGFkZXJJbnB1dCxcbiAgICBUZXh0dXJlOiBUZXh0dXJlLFxuICAgIFVuc3VwcG9ydGVkQnJvd3NlckVycm9yOiBVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcixcbiAgICBWZXJ0ZXhCdWZmZXI6IFZlcnRleEJ1ZmZlcixcbiAgICBWZXJ0ZXhGb3JtYXQ6IFZlcnRleEZvcm1hdCxcbiAgICBWZXJ0ZXhJdGVyYXRvcjogVmVydGV4SXRlcmF0b3Jcbn07XG5cbmV4cG9ydCBjb25zdCBwb3N0ZWZmZWN0ID0ge1xuICAgIGNyZWF0ZUZ1bGxzY3JlZW5RdWFkOiBjcmVhdGVGdWxsc2NyZWVuUXVhZCxcbiAgICBkcmF3RnVsbHNjcmVlblF1YWQ6IGRyYXdGdWxsc2NyZWVuUXVhZCxcbiAgICBQb3N0RWZmZWN0OiBQb3N0RWZmZWN0LFxuICAgIFBvc3RFZmZlY3RRdWV1ZTogUG9zdEVmZmVjdFF1ZXVlXG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2hhZGVyQ2h1bmtzLCAndHJhbnNmb3JtU2tpbm5lZFZTJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyNkZWZpbmUgU0tJTlxcbicgKyBzaGFkZXJDaHVua3MudHJhbnNmb3JtVlM7XG4gICAgfVxufSk7XG5cbmNvbnN0IGRlcHJlY2F0ZWRDaHVua3MgPSB7XG4gICAgJ2FtYmllbnRQcmVmaWx0ZXJlZEN1YmUuZnJhZyc6ICdhbWJpZW50RW52LmZyYWcnLFxuICAgICdhbWJpZW50UHJlZmlsdGVyZWRDdWJlTG9kLmZyYWcnOiAnYW1iaWVudEVudi5mcmFnJyxcbiAgICAnZHBBdGxhc1F1YWQuZnJhZyc6IG51bGwsXG4gICAgJ2dlblBhcmFib2xvaWQuZnJhZyc6IG51bGwsXG4gICAgJ3ByZWZpbHRlckN1YmVtYXAuZnJhZyc6IG51bGwsXG4gICAgJ3JlZmxlY3Rpb25EcEF0bGFzLmZyYWcnOiAncmVmbGVjdGlvbkVudi5mcmFnJyxcbiAgICAncmVmbGVjdGlvblByZWZpbHRlcmVkQ3ViZS5mcmFnJzogJ3JlZmxlY3Rpb25FbnYuZnJhZycsXG4gICAgJ3JlZmxlY3Rpb25QcmVmaWx0ZXJlZEN1YmVMb2QuZnJhZyc6ICdyZWZsZWN0aW9uRW52LmZyYWcnXG59O1xuXG5PYmplY3Qua2V5cyhkZXByZWNhdGVkQ2h1bmtzKS5mb3JFYWNoKChjaHVua05hbWUpID0+IHtcbiAgICBjb25zdCByZXBsYWNlbWVudCA9IGRlcHJlY2F0ZWRDaHVua3NbY2h1bmtOYW1lXTtcbiAgICBjb25zdCB1c2VJbnN0ZWFkID0gcmVwbGFjZW1lbnQgPyBgIFVzZSBwYy5zaGFkZXJDaHVua3NbJyR7cmVwbGFjZW1lbnR9J10gaW5zdGVhZC5gIDogJyc7XG4gICAgY29uc3QgbXNnID0gYHBjLnNoYWRlckNodW5rc1snJHtjaHVua05hbWV9J10gaXMgZGVwcmVjYXRlZC4ke3VzZUluc3RlYWR9fWA7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNoYWRlckNodW5rcywgY2h1bmtOYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IobXNnKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKG1zZyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG4vLyBOb3RlOiBUaGlzIHdhcyBuZXZlciBwdWJsaWMgaW50ZXJmYWNlLCBidXQgaGFzIGJlZW4gdXNlZCBpbiBleHRlcm5hbCBzY3JpcHRzXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhSZW5kZXJUYXJnZXQucHJvdG90eXBlLCB7XG4gICAgX2dsRnJhbWVCdWZmZXI6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJUYXJnZXQjX2dsRnJhbWVCdWZmZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlclRhcmdldC5pbXBsI19nbEZyYW1lQnVmZmVyIGluc3RlYWQuJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsLl9nbEZyYW1lQnVmZmVyO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChyZ2JtKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJUYXJnZXQjX2dsRnJhbWVCdWZmZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlclRhcmdldC5pbXBsI19nbEZyYW1lQnVmZmVyIGluc3RlYWQuJyk7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFZlcnRleEZvcm1hdCwgJ2RlZmF1bHRJbnN0YW5jaW5nRm9ybWF0Jywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5WZXJ0ZXhGb3JtYXQuZGVmYXVsdEluc3RhbmNpbmdGb3JtYXQgaXMgZGVwcmVjYXRlZCwgdXNlIHBjLlZlcnRleEZvcm1hdC5nZXREZWZhdWx0SW5zdGFuY2luZ0Zvcm1hdChncmFwaGljc0RldmljZSkuJyk7XG4gICAgICAgIHJldHVybiBWZXJ0ZXhGb3JtYXQuZ2V0RGVmYXVsdEluc3RhbmNpbmdGb3JtYXQoR3JhcGhpY3NEZXZpY2VBY2Nlc3MuZ2V0KCkpO1xuICAgIH1cbn0pO1xuXG5WZXJ0ZXhGb3JtYXQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5WZXJ0ZXhGb3JtYXQudXBkYXRlIGlzIGRlcHJlY2F0ZWQsIGFuZCBWZXJ0ZXhGb3JtYXQgY2Fubm90IGJlIGNoYW5nZWQgYWZ0ZXIgaXQgaGFzIGJlZW4gY3JlYXRlZC4nKTtcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKFRleHR1cmUucHJvdG90eXBlLCB7XG4gICAgcmdibToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlRleHR1cmUjcmdibSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuVGV4dHVyZSN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50eXBlID09PSBURVhUVVJFVFlQRV9SR0JNO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChyZ2JtKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3JnYm0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlRleHR1cmUjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgdGhpcy50eXBlID0gcmdibSA/IFRFWFRVUkVUWVBFX1JHQk0gOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIHN3aXp6bGVHR0dSOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNzd2l6emxlR0dHUiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuVGV4dHVyZSN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50eXBlID09PSBURVhUVVJFVFlQRV9TV0laWkxFR0dHUjtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoc3dpenpsZUdHR1IpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlRleHR1cmUjc3dpenpsZUdHR1IgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlRleHR1cmUjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgdGhpcy50eXBlID0gc3dpenpsZUdHR1IgPyBURVhUVVJFVFlQRV9TV0laWkxFR0dHUiA6IFRFWFRVUkVUWVBFX0RFRkFVTFQ7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgX2dsVGV4dHVyZToge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlRleHR1cmUjX2dsVGV4dHVyZSBpcyBubyBsb25nZXIgYXZhaWxhYmxlLCB1c2UgVXNlIHBjLlRleHR1cmUuaW1wbC5fZ2xUZXh0dXJlIGluc3RlYWQuJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsLl9nbFRleHR1cmU7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLmdldFByb2dyYW1MaWJyYXJ5ID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI2dldFByb2dyYW1MaWJyYXJ5IGlzIGRlcHJlY2F0ZWQuYCk7XG4gICAgcmV0dXJuIGdldFByb2dyYW1MaWJyYXJ5KHRoaXMpO1xufTtcblxuR3JhcGhpY3NEZXZpY2UucHJvdG90eXBlLnNldFByb2dyYW1MaWJyYXJ5ID0gZnVuY3Rpb24gKGxpYikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3NldFByb2dyYW1MaWJyYXJ5IGlzIGRlcHJlY2F0ZWQuYCk7XG4gICAgc2V0UHJvZ3JhbUxpYnJhcnkodGhpcywgbGliKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5yZW1vdmVTaGFkZXJGcm9tQ2FjaGUgPSBmdW5jdGlvbiAoc2hhZGVyKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZChgcGMuR3JhcGhpY3NEZXZpY2UjcmVtb3ZlU2hhZGVyRnJvbUNhY2hlIGlzIGRlcHJlY2F0ZWQuYCk7XG4gICAgZ2V0UHJvZ3JhbUxpYnJhcnkodGhpcykucmVtb3ZlRnJvbUNhY2hlKHNoYWRlcik7XG59O1xuXG4vLyBTQ0VORVxuXG5leHBvcnQgY29uc3QgUGhvbmdNYXRlcmlhbCA9IFN0YW5kYXJkTWF0ZXJpYWw7XG5cbmV4cG9ydCBjb25zdCBzY2VuZSA9IHtcbiAgICBwYXJ0aXRpb25Ta2luOiBwYXJ0aXRpb25Ta2luLFxuICAgIHByb2NlZHVyYWw6IHtcbiAgICAgICAgY2FsY3VsYXRlVGFuZ2VudHM6IGNhbGN1bGF0ZVRhbmdlbnRzLFxuICAgICAgICBjcmVhdGVNZXNoOiBjcmVhdGVNZXNoLFxuICAgICAgICBjcmVhdGVUb3J1czogY3JlYXRlVG9ydXMsXG4gICAgICAgIGNyZWF0ZUN5bGluZGVyOiBjcmVhdGVDeWxpbmRlcixcbiAgICAgICAgY3JlYXRlQ2Fwc3VsZTogY3JlYXRlQ2Fwc3VsZSxcbiAgICAgICAgY3JlYXRlQ29uZTogY3JlYXRlQ29uZSxcbiAgICAgICAgY3JlYXRlU3BoZXJlOiBjcmVhdGVTcGhlcmUsXG4gICAgICAgIGNyZWF0ZVBsYW5lOiBjcmVhdGVQbGFuZSxcbiAgICAgICAgY3JlYXRlQm94OiBjcmVhdGVCb3hcbiAgICB9LFxuICAgIEJhc2ljTWF0ZXJpYWw6IEJhc2ljTWF0ZXJpYWwsXG4gICAgQ29tbWFuZDogQ29tbWFuZCxcbiAgICBGb3J3YXJkUmVuZGVyZXI6IEZvcndhcmRSZW5kZXJlcixcbiAgICBHcmFwaE5vZGU6IEdyYXBoTm9kZSxcbiAgICBNYXRlcmlhbDogTWF0ZXJpYWwsXG4gICAgTWVzaDogTWVzaCxcbiAgICBNZXNoSW5zdGFuY2U6IE1lc2hJbnN0YW5jZSxcbiAgICBNb2RlbDogTW9kZWwsXG4gICAgUGFydGljbGVFbWl0dGVyOiBQYXJ0aWNsZUVtaXR0ZXIsXG4gICAgUGhvbmdNYXRlcmlhbDogU3RhbmRhcmRNYXRlcmlhbCxcbiAgICBQaWNrZXI6IFBpY2tlcixcbiAgICBQcm9qZWN0aW9uOiB7XG4gICAgICAgIE9SVEhPR1JBUEhJQzogUFJPSkVDVElPTl9PUlRIT0dSQVBISUMsXG4gICAgICAgIFBFUlNQRUNUSVZFOiBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFXG4gICAgfSxcbiAgICBTY2VuZTogU2NlbmUsXG4gICAgU2tpbjogU2tpbixcbiAgICBTa2luSW5zdGFuY2U6IFNraW5JbnN0YW5jZVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNjZW5lLnByb3RvdHlwZSwgJ2RlZmF1bHRNYXRlcmlhbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjZGVmYXVsdE1hdGVyaWFsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgICAgIHJldHVybiBnZXREZWZhdWx0TWF0ZXJpYWwoZ2V0QXBwbGljYXRpb24oKS5ncmFwaGljc0RldmljZSk7XG4gICAgfVxufSk7XG5cbi8vIHNjZW5lLnNreWJveFByZWZpbHRlcmVkKioqKiBhcmUgZGVwcmVjYXRlZFxuWycxMjgnLCAnNjQnLCAnMzInLCAnMTYnLCAnOCcsICc0J10uZm9yRWFjaCgoc2l6ZSwgaW5kZXgpID0+IHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU2NlbmUucHJvdG90eXBlLCBgc2t5Ym94UHJlZmlsdGVyZWQke3NpemV9YCwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlNjZW5lI3NreWJveFByZWZpbHRlcmVkJHtzaXplfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2NlbmUjcHJlZmlsdGVyZWRDdWJlbWFwcyBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHNbaW5kZXhdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuU2NlbmUjc2t5Ym94UHJlZmlsdGVyZWQke3NpemV9IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5TY2VuZSNwcmVmaWx0ZXJlZEN1YmVtYXBzIGluc3RlYWQuYCk7XG4gICAgICAgICAgICB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzW2luZGV4XSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH0pO1xufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTY2VuZS5wcm90b3R5cGUsICdtb2RlbHMnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbW9kZWxzKSB7XG4gICAgICAgICAgICB0aGlzLl9tb2RlbHMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWxzO1xuICAgIH1cbn0pO1xuXG4vLyBUaGlzIGNhbiBiZSByZW1vdmVkIHdoZW4gMS41NiBpcyBvdXQgYW5kIHRoZSBFZGl0b3Igbm8gbG9uZ2VyIGNhbGxzIHRoaXNcblNjZW5lLnByb3RvdHlwZS5fdXBkYXRlU2t5Ym94ID0gZnVuY3Rpb24gKGRldmljZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlNjZW5lI191cGRhdGVTa3lib3ggaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNjZW5lI191cGRhdGVTa3kgaW5zdGVhZC5gKTtcbiAgICB0aGlzLl91cGRhdGVTa3koZGV2aWNlKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5hZGRNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2FkZE1vZGVsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgaWYgKHRoaXMuY29udGFpbnNNb2RlbChtb2RlbCkpIHJldHVybjtcbiAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICB0aGlzLm1vZGVscy5wdXNoKG1vZGVsKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5hZGRTaGFkb3dDYXN0ZXIgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNhZGRTaGFkb3dDYXN0ZXIgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgbGF5ZXIuYWRkU2hhZG93Q2FzdGVycyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5yZW1vdmVNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI3JlbW92ZU1vZGVsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLm1vZGVscy5pbmRleE9mKG1vZGVsKTtcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfV09STEQpO1xuICAgICAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIHRoaXMubW9kZWxzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxufTtcblxuU2NlbmUucHJvdG90eXBlLnJlbW92ZVNoYWRvd0Nhc3RlcnMgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNyZW1vdmVTaGFkb3dDYXN0ZXJzIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCk7XG4gICAgaWYgKCFsYXllcikgcmV0dXJuO1xuICAgIGxheWVyLnJlbW92ZVNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuY29udGFpbnNNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2NvbnRhaW5zTW9kZWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHMuaW5kZXhPZihtb2RlbCkgPj0gMDtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5nZXRNb2RlbHMgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNnZXRNb2RlbHMgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHM7XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmF0Y2gucHJvdG90eXBlLCAnbW9kZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkJhdGNoI21vZGVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5CYXRjaCNtZXNoSW5zdGFuY2UgdG8gYWNjZXNzIGJhdGNoZWQgbWVzaCBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59KTtcblxuRm9yd2FyZFJlbmRlcmVyLnByb3RvdHlwZS5yZW5kZXJDb21wb3NpdGlvbiA9IGZ1bmN0aW9uIChjb21wKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuRm9yd2FyZFJlbmRlcmVyI3JlbmRlckNvbXBvc2l0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlLnJlbmRlckNvbXBvc2l0aW9uIGluc3RlYWQuJyk7XG4gICAgZ2V0QXBwbGljYXRpb24oKS5yZW5kZXJDb21wb3NpdGlvbihjb21wKTtcbn07XG5cbkZvcndhcmRSZW5kZXJlci5wcm90b3R5cGUudXBkYXRlU2hhZGVyID0gZnVuY3Rpb24gKG1lc2hJbnN0YW5jZSwgb2JqRGVmcywgc3RhdGljTGlnaHRMaXN0LCBwYXNzLCBzb3J0ZWRMaWdodHMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Gb3J3YXJkUmVuZGVyZXIjdXBkYXRlU2hhZGVyIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5NZXNoSW5zdGFuY2UjdXBkYXRlUGFzc1NoYWRlci4nKTtcbiAgICBjb25zdCBzY2VuZSA9IG1lc2hJbnN0YW5jZS5tYXRlcmlhbC5fc2NlbmUgfHwgZ2V0QXBwbGljYXRpb24oKS5zY2VuZTtcbiAgICByZXR1cm4gbWVzaEluc3RhbmNlLnVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHBhc3MsIHN0YXRpY0xpZ2h0TGlzdCwgc29ydGVkTGlnaHRzKTtcbn07XG5cbk1lc2hJbnN0YW5jZS5wcm90b3R5cGUuc3luY0FhYmIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWVzaEluc3RhbmNlI3N5bmNBYWJiIGlzIGRlcHJlY2F0ZWQuJyk7XG59O1xuXG5Nb3JwaC5wcm90b3R5cGUuZ2V0VGFyZ2V0ID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTW9ycGgjZ2V0VGFyZ2V0IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb3JwaCN0YXJnZXRzIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy50YXJnZXRzW2luZGV4XTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuX2RpcnRpZnkgPSBmdW5jdGlvbiAobG9jYWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjX2RpcnRpZnkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNfZGlydGlmeUxvY2FsIG9yIF9kaXJ0aWZ5V29ybGQgcmVzcGVjdGl2ZWx5IGluc3RlYWQuJyk7XG4gICAgaWYgKGxvY2FsKVxuICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICBlbHNlXG4gICAgICAgIHRoaXMuX2RpcnRpZnlXb3JsZCgpO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5hZGRMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNhZGRMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIHRoaXMuX2xhYmVsc1tsYWJlbF0gPSB0cnVlO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRMYWJlbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldExhYmVscyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9sYWJlbHMpO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5oYXNMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNoYXNMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiAhIXRoaXMuX2xhYmVsc1tsYWJlbF07XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLnJlbW92ZUxhYmVsID0gZnVuY3Rpb24gKGxhYmVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI3JlbW92ZUxhYmVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgZGVsZXRlIHRoaXMuX2xhYmVsc1tsYWJlbF07XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmZpbmRCeUxhYmVsID0gZnVuY3Rpb24gKGxhYmVsLCByZXN1bHRzID0gW10pIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZmluZEJ5TGFiZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICBpZiAodGhpcy5oYXNMYWJlbChsYWJlbCkpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHRoaXMpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgcmVzdWx0cyA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRCeUxhYmVsKGxhYmVsLCByZXN1bHRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0Q2hpbGRyZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldENoaWxkcmVuIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjY2hpbGRyZW4gaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXROYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjbmFtZSBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0UGF0aCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3BhdGggaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLnBhdGg7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldFJvb3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldFJvb3QgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNyb290IGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5yb290O1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRQYXJlbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldFBhcmVudCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3BhcmVudCBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMucGFyZW50O1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5zZXROYW1lID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjc2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI25hbWUgaW5zdGVhZC4nKTtcblxuICAgIHRoaXMubmFtZSA9IG5hbWU7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuZ2V0TmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNnZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNuYW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5zZXROYW1lID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNzZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNuYW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5nZXRTaGFkZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWF0ZXJpYWwjZ2V0U2hhZGVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNzaGFkZXIgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5zaGFkZXI7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuc2V0U2hhZGVyID0gZnVuY3Rpb24gKHNoYWRlcikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1hdGVyaWFsI3NldFNoYWRlciBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTWF0ZXJpYWwjc2hhZGVyIGluc3RlYWQuJyk7XG4gICAgdGhpcy5zaGFkZXIgPSBzaGFkZXI7XG59O1xuXG5mdW5jdGlvbiBfZGVmaW5lQWxpYXMobmV3TmFtZSwgb2xkTmFtZSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTdGFuZGFyZE1hdGVyaWFsLnByb3RvdHlwZSwgb2xkTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtvbGROYW1lfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU3RhbmRhcmRNYXRlcmlhbCMke25ld05hbWV9IGluc3RlYWQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1tuZXdOYW1lXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtvbGROYW1lfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU3RhbmRhcmRNYXRlcmlhbCMke25ld05hbWV9IGluc3RlYWQuYCk7XG4gICAgICAgICAgICB0aGlzW25ld05hbWVdID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuX2RlZmluZUFsaWFzKCdkaWZmdXNlVGludCcsICdkaWZmdXNlTWFwVGludCcpO1xuX2RlZmluZUFsaWFzKCdzcGVjdWxhclRpbnQnLCAnc3BlY3VsYXJNYXBUaW50Jyk7XG5fZGVmaW5lQWxpYXMoJ2VtaXNzaXZlVGludCcsICdlbWlzc2l2ZU1hcFRpbnQnKTtcbl9kZWZpbmVBbGlhcygnYW9WZXJ0ZXhDb2xvcicsICdhb01hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ2RpZmZ1c2VWZXJ0ZXhDb2xvcicsICdkaWZmdXNlTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnc3BlY3VsYXJWZXJ0ZXhDb2xvcicsICdzcGVjdWxhck1hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ2VtaXNzaXZlVmVydGV4Q29sb3InLCAnZW1pc3NpdmVNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdtZXRhbG5lc3NWZXJ0ZXhDb2xvcicsICdtZXRhbG5lc3NNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdnbG9zc1ZlcnRleENvbG9yJywgJ2dsb3NzTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnb3BhY2l0eVZlcnRleENvbG9yJywgJ29wYWNpdHlNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdsaWdodFZlcnRleENvbG9yJywgJ2xpZ2h0TWFwVmVydGV4Q29sb3InKTtcblxuZnVuY3Rpb24gX2RlZmluZU9wdGlvbihuYW1lLCBuZXdOYW1lKSB7XG4gICAgaWYgKG5hbWUgIT09ICdjaHVua3MnICYmIG5hbWUgIT09ICdfcGFzcycpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zLnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgR2V0dGluZyBwYy5PcHRpb25zIyR7bmFtZX0gaGFzIGJlZW4gZGVwcmVjYXRlZCBhcyB0aGUgcHJvcGVydHkgaGFzIGJlZW4gbW92ZWQgdG8gcGMuT3B0aW9ucy5MaXRPcHRpb25zIyR7bmV3TmFtZSB8fCBuYW1lfS5gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5saXRPcHRpb25zW25ld05hbWUgfHwgbmFtZV07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBTZXR0aW5nIHBjLk9wdGlvbnMjJHtuYW1lfSBoYXMgYmVlbiBkZXByZWNhdGVkIGFzIHRoZSBwcm9wZXJ0eSBoYXMgYmVlbiBtb3ZlZCB0byBwYy5PcHRpb25zLkxpdE9wdGlvbnMjJHtuZXdOYW1lIHx8IG5hbWV9LmApO1xuICAgICAgICAgICAgICAgIHRoaXMubGl0T3B0aW9uc1tuZXdOYW1lIHx8IG5hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbl9kZWZpbmVPcHRpb24oJ3JlZnJhY3Rpb24nLCAndXNlUmVmcmFjdGlvbicpO1xuXG5jb25zdCB0ZW1wT3B0aW9ucyA9IG5ldyBMaXRPcHRpb25zKCk7XG5jb25zdCBsaXRPcHRpb25Qcm9wZXJ0aWVzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXModGVtcE9wdGlvbnMpO1xuZm9yIChjb25zdCBsaXRPcHRpb24gaW4gbGl0T3B0aW9uUHJvcGVydGllcykge1xuICAgIF9kZWZpbmVPcHRpb24obGl0T3B0aW9uUHJvcGVydGllc1tsaXRPcHRpb25dKTtcbn1cblxuLy8gQU5JTUFUSU9OXG5cbmV4cG9ydCBjb25zdCBhbmltID0ge1xuICAgIEFuaW1hdGlvbjogQW5pbWF0aW9uLFxuICAgIEtleTogS2V5LFxuICAgIE5vZGU6IE5vZGUsXG4gICAgU2tlbGV0b246IFNrZWxldG9uXG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNnZXREdXJhdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQW5pbWF0aW9uI2R1cmF0aW9uIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuZHVyYXRpb247XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldE5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI2dldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNuYW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuZ2V0Tm9kZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI2dldE5vZGVzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jbm9kZXMgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5ub2Rlcztcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuc2V0RHVyYXRpb24gPSBmdW5jdGlvbiAoZHVyYXRpb24pIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BbmltYXRpb24jc2V0RHVyYXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNkdXJhdGlvbiBpbnN0ZWFkLicpO1xuICAgIHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjtcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuc2V0TmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI3NldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNuYW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXRBbmltYXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0QW5pbWF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNhbmltYXRpb24gaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5hbmltYXRpb247XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0Q3VycmVudFRpbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0Q3VycmVudFRpbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2N1cnJlbnRUaW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0TG9vcGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXRMb29waW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNsb29waW5nIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubG9vcGluZztcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXROdW1Ob2RlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXROdW1Ob2RlcyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbnVtTm9kZXMgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5udW1Ob2Rlcztcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5zZXRBbmltYXRpb24gPSBmdW5jdGlvbiAoYW5pbWF0aW9uKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0QW5pbWF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNhbmltYXRpb24gaW5zdGVhZC4nKTtcbiAgICB0aGlzLmFuaW1hdGlvbiA9IGFuaW1hdGlvbjtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5zZXRDdXJyZW50VGltZSA9IGZ1bmN0aW9uICh0aW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0Q3VycmVudFRpbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2N1cnJlbnRUaW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5jdXJyZW50VGltZSA9IHRpbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuc2V0TG9vcGluZyA9IGZ1bmN0aW9uIChsb29waW5nKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0TG9vcGluZyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbG9vcGluZyBpbnN0ZWFkLicpO1xuICAgIHRoaXMubG9vcGluZyA9IGxvb3Bpbmc7XG59O1xuXG4vLyBTT1VORFxuXG5leHBvcnQgY29uc3QgYXVkaW8gPSB7XG4gICAgQXVkaW9NYW5hZ2VyOiBTb3VuZE1hbmFnZXIsXG4gICAgQ2hhbm5lbDogQ2hhbm5lbCxcbiAgICBDaGFubmVsM2Q6IENoYW5uZWwzZCxcbiAgICBMaXN0ZW5lcjogTGlzdGVuZXIsXG4gICAgU291bmQ6IFNvdW5kXG59O1xuXG5Tb3VuZE1hbmFnZXIucHJvdG90eXBlLmdldExpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNvdW5kTWFuYWdlciNnZXRMaXN0ZW5lciBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI2xpc3RlbmVyIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubGlzdGVuZXI7XG59O1xuXG5Tb3VuZE1hbmFnZXIucHJvdG90eXBlLmdldFZvbHVtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Tb3VuZE1hbmFnZXIjZ2V0Vm9sdW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Tb3VuZE1hbmFnZXIjdm9sdW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMudm9sdW1lO1xufTtcblxuU291bmRNYW5hZ2VyLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbiAodm9sdW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU291bmRNYW5hZ2VyI3NldFZvbHVtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI3ZvbHVtZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMudm9sdW1lID0gdm9sdW1lO1xufTtcblxuLy8gQVNTRVRcblxuZXhwb3J0IGNvbnN0IGFzc2V0ID0ge1xuICAgIEFTU0VUX0FOSU1BVElPTjogJ2FuaW1hdGlvbicsXG4gICAgQVNTRVRfQVVESU86ICdhdWRpbycsXG4gICAgQVNTRVRfSU1BR0U6ICdpbWFnZScsXG4gICAgQVNTRVRfSlNPTjogJ2pzb24nLFxuICAgIEFTU0VUX01PREVMOiAnbW9kZWwnLFxuICAgIEFTU0VUX01BVEVSSUFMOiAnbWF0ZXJpYWwnLFxuICAgIEFTU0VUX1RFWFQ6ICd0ZXh0JyxcbiAgICBBU1NFVF9URVhUVVJFOiAndGV4dHVyZScsXG4gICAgQVNTRVRfQ1VCRU1BUDogJ2N1YmVtYXAnLFxuICAgIEFTU0VUX1NDUklQVDogJ3NjcmlwdCdcbn07XG5cbkFzc2V0UmVnaXN0cnkucHJvdG90eXBlLmdldEFzc2V0QnlJZCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFzc2V0UmVnaXN0cnkjZ2V0QXNzZXRCeUlkIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Bc3NldFJlZ2lzdHJ5I2dldCBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmdldChpZCk7XG59O1xuXG4vLyBYUlxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdyYXknLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlhySW5wdXRTb3VyY2UjcmF5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5YcklucHV0U291cmNlI2dldE9yaWdpbiBhbmQgcGMuWHJJbnB1dFNvdXJjZSNnZXREaXJlY3Rpb24gaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JheUxvY2FsO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdwb3NpdGlvbicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuWHJJbnB1dFNvdXJjZSNwb3NpdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRMb2NhbFBvc2l0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbFBvc2l0aW9uO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdyb3RhdGlvbicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuWHJJbnB1dFNvdXJjZSNyb3RhdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRMb2NhbFJvdGF0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbFJvdGF0aW9uO1xuICAgIH1cbn0pO1xuXG4vLyBJTlBVVFxuXG5leHBvcnQgY29uc3QgaW5wdXQgPSB7XG4gICAgZ2V0VG91Y2hUYXJnZXRDb29yZHM6IGdldFRvdWNoVGFyZ2V0Q29vcmRzLFxuICAgIENvbnRyb2xsZXI6IENvbnRyb2xsZXIsXG4gICAgR2FtZVBhZHM6IEdhbWVQYWRzLFxuICAgIEtleWJvYXJkOiBLZXlib2FyZCxcbiAgICBLZXlib2FyZEV2ZW50OiBLZXlib2FyZEV2ZW50LFxuICAgIE1vdXNlOiBNb3VzZSxcbiAgICBNb3VzZUV2ZW50OiBNb3VzZUV2ZW50LFxuICAgIFRvdWNoOiBUb3VjaCxcbiAgICBUb3VjaERldmljZTogVG91Y2hEZXZpY2UsXG4gICAgVG91Y2hFdmVudDogVG91Y2hFdmVudFxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEVsZW1lbnRJbnB1dC5wcm90b3R5cGUsICd3aGVlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2hlZWxEZWx0YSAqIC0yO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTW91c2VFdmVudC5wcm90b3R5cGUsICd3aGVlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2hlZWxEZWx0YSAqIC0yO1xuICAgIH1cbn0pO1xuXG4vLyBGUkFNRVdPUktcblxuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9UWVBFX1NUQVRJQyA9IEJPRFlUWVBFX1NUQVRJQztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9EWU5BTUlDID0gQk9EWVRZUEVfRFlOQU1JQztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9LSU5FTUFUSUMgPSBCT0RZVFlQRV9LSU5FTUFUSUM7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0NGX1NUQVRJQ19PQkpFQ1QgPSBCT0RZRkxBR19TVEFUSUNfT0JKRUNUO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9DRl9LSU5FTUFUSUNfT0JKRUNUID0gQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQ0ZfTk9SRVNQT05TRV9PQkpFQ1QgPSBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQUNUSVZFX1RBRyA9IEJPRFlTVEFURV9BQ1RJVkVfVEFHO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9JU0xBTkRfU0xFRVBJTkcgPSBCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9XQU5UU19ERUFDVElWQVRJT04gPSBCT0RZU1RBVEVfV0FOVFNfREVBQ1RJVkFUSU9OO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9ESVNBQkxFX0RFQUNUSVZBVElPTiA9IEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTjtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfRElTQUJMRV9TSU1VTEFUSU9OID0gQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTjtcblxuQXBwQmFzZS5wcm90b3R5cGUuaXNGdWxsc2NyZWVuID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UjaXNGdWxsc2NyZWVuIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgRnVsbHNjcmVlbiBBUEkgZGlyZWN0bHkuJyk7XG5cbiAgICByZXR1cm4gISFkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudDtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmVuYWJsZUZ1bGxzY3JlZW4gPSBmdW5jdGlvbiAoZWxlbWVudCwgc3VjY2VzcywgZXJyb3IpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2VuYWJsZUZ1bGxzY3JlZW4gaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSBGdWxsc2NyZWVuIEFQSSBkaXJlY3RseS4nKTtcblxuICAgIGVsZW1lbnQgPSBlbGVtZW50IHx8IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzO1xuXG4gICAgLy8gc3VjY2VzcyBjYWxsYmFja1xuICAgIGNvbnN0IHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHN1Y2Nlc3MoKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsIHMpO1xuICAgIH07XG5cbiAgICAvLyBlcnJvciBjYWxsYmFja1xuICAgIGNvbnN0IGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGVycm9yKCk7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5lcnJvcicsIGUpO1xuICAgIH07XG5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcywgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChlcnJvcikge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuZXJyb3InLCBlLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGVsZW1lbnQucmVxdWVzdEZ1bGxzY3JlZW4pIHtcbiAgICAgICAgZWxlbWVudC5yZXF1ZXN0RnVsbHNjcmVlbihFbGVtZW50LkFMTE9XX0tFWUJPQVJEX0lOUFVUKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlcnJvcigpO1xuICAgIH1cbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmRpc2FibGVGdWxsc2NyZWVuID0gZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2Rpc2FibGVGdWxsc2NyZWVuIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgRnVsbHNjcmVlbiBBUEkgZGlyZWN0bHkuJyk7XG5cbiAgICAvLyBzdWNjZXNzIGNhbGxiYWNrXG4gICAgY29uc3QgcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3VjY2VzcygpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcyk7XG4gICAgfTtcblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLCBzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgZG9jdW1lbnQuZXhpdEZ1bGxzY3JlZW4oKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmdldFNjZW5lVXJsID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2dldFNjZW5lVXJsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNmaW5kIGluc3RlYWQuJyk7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLnNjZW5lcy5maW5kKG5hbWUpO1xuICAgIGlmIChlbnRyeSkge1xuICAgICAgICByZXR1cm4gZW50cnkudXJsO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmxvYWRTY2VuZSA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNsb2FkU2NlbmUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2Ujc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2NlbmVzLmxvYWRTY2VuZSh1cmwsIGNhbGxiYWNrKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmxvYWRTY2VuZUhpZXJhcmNoeSA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNsb2FkU2NlbmVIaWVyYXJjaHkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2Ujc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZUhpZXJhcmNoeSBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2NlbmVzLmxvYWRTY2VuZUhpZXJhcmNoeSh1cmwsIGNhbGxiYWNrKTtcbn07XG5cbkFwcEJhc2UucHJvdG90eXBlLmxvYWRTY2VuZVNldHRpbmdzID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlI2xvYWRTY2VuZVNldHRpbmdzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVTZXR0aW5ncyBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2NlbmVzLmxvYWRTY2VuZVNldHRpbmdzKHVybCwgY2FsbGJhY2spO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUucmVuZGVyTWVzaEluc3RhbmNlID0gZnVuY3Rpb24gKG1lc2hJbnN0YW5jZSwgb3B0aW9ucykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UucmVuZGVyTWVzaEluc3RhbmNlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlLmRyYXdNZXNoSW5zdGFuY2UuJyk7XG4gICAgY29uc3QgbGF5ZXIgPSBvcHRpb25zPy5sYXllciA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXI7XG4gICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobnVsbCwgbnVsbCwgbnVsbCwgbWVzaEluc3RhbmNlLCBsYXllcik7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJNZXNoID0gZnVuY3Rpb24gKG1lc2gsIG1hdGVyaWFsLCBtYXRyaXgsIG9wdGlvbnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlLnJlbmRlck1lc2ggaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd01lc2guJyk7XG4gICAgY29uc3QgbGF5ZXIgPSBvcHRpb25zPy5sYXllciA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXI7XG4gICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgbWVzaCwgbnVsbCwgbGF5ZXIpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUuX2FkZExpbmVzID0gZnVuY3Rpb24gKHBvc2l0aW9ucywgY29sb3JzLCBvcHRpb25zKSB7XG4gICAgY29uc3QgbGF5ZXIgPSAob3B0aW9ucyAmJiBvcHRpb25zLmxheWVyKSA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpO1xuICAgIGNvbnN0IGRlcHRoVGVzdCA9IChvcHRpb25zICYmIG9wdGlvbnMuZGVwdGhUZXN0ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5kZXB0aFRlc3QgOiB0cnVlO1xuXG4gICAgY29uc3QgYmF0Y2ggPSB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRCYXRjaChsYXllciwgZGVwdGhUZXN0KTtcbiAgICBiYXRjaC5hZGRMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycyk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJMaW5lID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIGNvbG9yKSB7XG5cbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBCYXNlLnJlbmRlckxpbmUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd0xpbmUuJyk7XG5cbiAgICBsZXQgZW5kQ29sb3IgPSBjb2xvcjtcbiAgICBsZXQgb3B0aW9ucztcblxuICAgIGNvbnN0IGFyZzMgPSBhcmd1bWVudHNbM107XG4gICAgY29uc3QgYXJnNCA9IGFyZ3VtZW50c1s0XTtcblxuICAgIGlmIChhcmczIGluc3RhbmNlb2YgQ29sb3IpIHtcbiAgICAgICAgLy8gcGFzc2VkIGluIGVuZCBjb2xvclxuICAgICAgICBlbmRDb2xvciA9IGFyZzM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBhcmc0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgLy8gY29tcGF0aWJpbGl0eTogY29udmVydCBsaW5lYmF0Y2ggaWQgaW50byBvcHRpb25zXG4gICAgICAgICAgICBpZiAoYXJnNCA9PT0gTElORUJBVENIX09WRVJMQVkpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGhUZXN0OiBmYWxzZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdXNlIHBhc3NlZCBpbiBvcHRpb25zXG4gICAgICAgICAgICBvcHRpb25zID0gYXJnNDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZzMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGVuZENvbG9yID0gY29sb3I7XG5cbiAgICAgICAgLy8gY29tcGF0aWJpbGl0eTogY29udmVydCBsaW5lYmF0Y2ggaWQgaW50byBvcHRpb25zXG4gICAgICAgIGlmIChhcmczID09PSBMSU5FQkFUQ0hfT1ZFUkxBWSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IGZhbHNlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFyZzMpIHtcbiAgICAgICAgLy8gb3B0aW9ucyBwYXNzZWQgaW5cbiAgICAgICAgb3B0aW9ucyA9IGFyZzM7XG4gICAgfVxuXG4gICAgdGhpcy5fYWRkTGluZXMoW3N0YXJ0LCBlbmRdLCBbY29sb3IsIGVuZENvbG9yXSwgb3B0aW9ucyk7XG59O1xuXG5BcHBCYXNlLnByb3RvdHlwZS5yZW5kZXJMaW5lcyA9IGZ1bmN0aW9uIChwb3NpdGlvbiwgY29sb3IsIG9wdGlvbnMpIHtcblxuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcEJhc2UucmVuZGVyTGluZXMgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcEJhc2UuZHJhd0xpbmVzLicpO1xuXG4gICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICAgIC8vIGRlZmF1bHQgb3B0aW9uXG4gICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgIGRlcHRoVGVzdDogdHJ1ZVxuICAgICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LCBMSU5FQkFUQ0hfT1ZFUkxBWSBsaW5lcyBoYXZlIGRlcHRodGVzdCBkaXNhYmxlZFxuICAgICAgICBpZiAob3B0aW9ucyA9PT0gTElORUJBVENIX09WRVJMQVkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiBmYWxzZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbXVsdGlDb2xvciA9ICEhY29sb3IubGVuZ3RoO1xuICAgIGlmIChtdWx0aUNvbG9yKSB7XG4gICAgICAgIGlmIChwb3NpdGlvbi5sZW5ndGggIT09IGNvbG9yLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcigncmVuZGVyTGluZXM6IHBvc2l0aW9uL2NvbG9yIGFycmF5cyBoYXZlIGRpZmZlcmVudCBsZW5ndGhzJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHBvc2l0aW9uLmxlbmd0aCAlIDIgIT09IDApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcigncmVuZGVyTGluZXM6IGFycmF5IGxlbmd0aCBpcyBub3QgZGl2aXNpYmxlIGJ5IDInKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9hZGRMaW5lcyhwb3NpdGlvbiwgY29sb3IsIG9wdGlvbnMpO1xufTtcblxuQXBwQmFzZS5wcm90b3R5cGUuZW5hYmxlVnIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwQmFzZSNlbmFibGVWUiBpcyBkZXByZWNhdGVkLCBhbmQgV2ViVlIgQVBJIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQuJyk7XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2FtZXJhQ29tcG9uZW50LnByb3RvdHlwZSwgJ25vZGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkNhbWVyYUNvbXBvbmVudCNub2RlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5DYW1lcmFDb21wb25lbnQjZW50aXR5IGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmVudGl0eTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KExpZ2h0Q29tcG9uZW50LnByb3RvdHlwZSwgJ2VuYWJsZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTGlnaHRDb21wb25lbnQjZW5hYmxlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5MaWdodENvbXBvbmVudCNlbmFibGVkIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmVuYWJsZWQ7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5MaWdodENvbXBvbmVudCNlbmFibGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkxpZ2h0Q29tcG9uZW50I2VuYWJsZWQgaW5zdGVhZC4nKTtcbiAgICAgICAgdGhpcy5lbmFibGVkID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbk1vZGVsQ29tcG9uZW50LnByb3RvdHlwZS5zZXRWaXNpYmxlID0gZnVuY3Rpb24gKHZpc2libGUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb2RlbENvbXBvbmVudCNzZXRWaXNpYmxlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb2RlbENvbXBvbmVudCNlbmFibGVkIGluc3RlYWQuJyk7XG4gICAgdGhpcy5lbmFibGVkID0gdmlzaWJsZTtcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShNb2RlbENvbXBvbmVudC5wcm90b3R5cGUsICdhYWJiJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb2RlbENvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb2RlbENvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Nb2RlbENvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb2RlbENvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSZW5kZXJDb21wb25lbnQucHJvdG90eXBlLCAnYWFiYicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyQ29tcG9uZW50I2FhYmIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlckNvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJDb21wb25lbnQjYWFiYiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmVuZGVyQ29tcG9uZW50I2N1c3RvbUFhYmIgaW5zdGVhZCAtIHdoaWNoIGV4cGVjdHMgbG9jYWwgc3BhY2UgQUFCQiBpbnN0ZWFkIG9mIGEgd29ybGQgc3BhY2UgQUFCQi4nKTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFJpZ2lkQm9keUNvbXBvbmVudC5wcm90b3R5cGUsICdib2R5VHlwZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50I2JvZHlUeXBlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SaWdpZEJvZHlDb21wb25lbnQjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy50eXBlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnQjYm9keVR5cGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJpZ2lkQm9keUNvbXBvbmVudCN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgfVxufSk7XG5cblJpZ2lkQm9keUNvbXBvbmVudC5wcm90b3R5cGUuc3luY0JvZHlUb0VudGl0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnQjc3luY0JvZHlUb0VudGl0eSBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLicpO1xuICAgIHRoaXMuX3VwZGF0ZUR5bmFtaWMoKTtcbn07XG5cblJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbS5wcm90b3R5cGUuc2V0R3Jhdml0eSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jc2V0R3Jhdml0eSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI2dyYXZpdHkgaW5zdGVhZC4nKTtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHRoaXMuZ3Jhdml0eS5jb3B5KGFyZ3VtZW50c1swXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5ncmF2aXR5LnNldChhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICB9XG59O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBiYXNpc1NldERvd25sb2FkQ29uZmlnKGdsdWVVcmwsIHdhc21VcmwsIGZhbGxiYWNrVXJsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuYmFzaXNTZXREb3dubG9hZENvbmZpZyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuYmFzaXNJbml0aWFsaXplIGluc3RlYWQuJyk7XG4gICAgYmFzaXNJbml0aWFsaXplKHtcbiAgICAgICAgZ2x1ZVVybDogZ2x1ZVVybCxcbiAgICAgICAgd2FzbVVybDogd2FzbVVybCxcbiAgICAgICAgZmFsbGJhY2tVcmw6IGZhbGxiYWNrVXJsLFxuICAgICAgICBsYXp5SW5pdDogdHJ1ZVxuICAgIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJlZmlsdGVyQ3ViZW1hcChvcHRpb25zKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMucHJlZmlsdGVyQ3ViZW1hcCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuZW52TGlnaHRpbmcgaW5zdGVhZC4nKTtcbn1cbiJdLCJuYW1lcyI6WyJsb2ciLCJ3cml0ZSIsInRleHQiLCJEZWJ1ZyIsImRlcHJlY2F0ZWQiLCJjb25zb2xlIiwib3BlbiIsInZlcnNpb24iLCJyZXZpc2lvbiIsImluZm8iLCJkZWJ1ZyIsImVycm9yIiwid2FybmluZyIsIndhcm4iLCJhbGVydCIsImFzc2VydCIsImNvbmRpdGlvbiIsInN0cmluZyIsImVuZHNXaXRoIiwicyIsInN1YnMiLCJzdGFydHNXaXRoIiwidGltZSIsIm5vdyIsIlRpbWVyIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJDb2xvciIsInByb3RvdHlwZSIsImdldCIsIl9kYXRhIiwiRmxvYXQzMkFycmF5IiwiciIsImciLCJiIiwiYSIsIl9kYXRhMyIsImluaGVyaXRzIiwiU2VsZiIsIlN1cGVyIiwiVGVtcCIsIkZ1bmMiLCJhcmcxIiwiYXJnMiIsImFyZzMiLCJhcmc0IiwiYXJnNSIsImFyZzYiLCJhcmc3IiwiYXJnOCIsImNhbGwiLCJfc3VwZXIiLCJtYWtlQXJyYXkiLCJhcnIiLCJBcnJheSIsInNsaWNlIiwibWF0aCIsIklOVl9MT0cyIiwiTWF0aCIsIkxPRzJFIiwiaW50VG9CeXRlcyIsImludFRvQnl0ZXMzMiIsImJ5dGVzVG9JbnQiLCJieXRlc1RvSW50MzIiLCJWZWMyIiwieCIsInkiLCJzY2FsZSIsIm11bFNjYWxhciIsIlZlYzMiLCJ6IiwiVmVjNCIsInciLCJzaGFwZSIsIkFhYmIiLCJCb3VuZGluZ0JveCIsIlNwaGVyZSIsIkJvdW5kaW5nU3BoZXJlIiwiUGxhbmUiLCJpbnRlcnNlY3RSYXkiLCJpbnRlcnNlY3RzUmF5IiwiRnJ1c3R1bSIsInVwZGF0ZSIsInByb2plY3Rpb25NYXRyaXgiLCJ2aWV3TWF0cml4Iiwidmlld1Byb2oiLCJNYXQ0IiwibXVsMiIsInNldEZyb21NYXQ0IiwiRUxFTUVOVFRZUEVfSU5UOCIsIlRZUEVfSU5UOCIsIkVMRU1FTlRUWVBFX1VJTlQ4IiwiVFlQRV9VSU5UOCIsIkVMRU1FTlRUWVBFX0lOVDE2IiwiVFlQRV9JTlQxNiIsIkVMRU1FTlRUWVBFX1VJTlQxNiIsIlRZUEVfVUlOVDE2IiwiRUxFTUVOVFRZUEVfSU5UMzIiLCJUWVBFX0lOVDMyIiwiRUxFTUVOVFRZUEVfVUlOVDMyIiwiVFlQRV9VSU5UMzIiLCJFTEVNRU5UVFlQRV9GTE9BVDMyIiwiVFlQRV9GTE9BVDMyIiwiUElYRUxGT1JNQVRfTDhfQTgiLCJQSVhFTEZPUk1BVF9MQTgiLCJQSVhFTEZPUk1BVF9SNV9HNl9CNSIsIlBJWEVMRk9STUFUX1JHQjU2NSIsIlBJWEVMRk9STUFUX1I1X0c1X0I1X0ExIiwiUElYRUxGT1JNQVRfUkdCQTU1NTEiLCJQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNCIsIlBJWEVMRk9STUFUX1JHQkE0IiwiUElYRUxGT1JNQVRfUjhfRzhfQjgiLCJQSVhFTEZPUk1BVF9SR0I4IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIlVuc3VwcG9ydGVkQnJvd3NlckVycm9yIiwibWVzc2FnZSIsIm5hbWUiLCJFcnJvciIsIkNvbnRleHRDcmVhdGlvbkVycm9yIiwicHJvZ3JhbWxpYiIsImJlZ2luIiwiZHVtbXlGcmFnbWVudENvZGUiLCJTaGFkZXJVdGlscyIsImVuZCIsImZvZ0NvZGUiLCJnYW1tYUNvZGUiLCJwcmVjaXNpb25Db2RlIiwic2tpbkNvZGUiLCJ0b25lbWFwQ29kZSIsInZlcnNpb25Db2RlIiwiZ2Z4IiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19NSVJST1JFRF9SRVBFQVQiLCJBRERSRVNTX1JFUEVBVCIsIkJMRU5ETU9ERV9aRVJPIiwiQkxFTkRNT0RFX09ORSIsIkJMRU5ETU9ERV9TUkNfQ09MT1IiLCJCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUiIsIkJMRU5ETU9ERV9EU1RfQ09MT1IiLCJCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUiIsIkJMRU5ETU9ERV9TUkNfQUxQSEEiLCJCTEVORE1PREVfU1JDX0FMUEhBX1NBVFVSQVRFIiwiQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEiLCJCTEVORE1PREVfRFNUX0FMUEhBIiwiQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEiLCJCVUZGRVJfU1RBVElDIiwiQlVGRkVSX0RZTkFNSUMiLCJCVUZGRVJfU1RSRUFNIiwiQ1VMTEZBQ0VfTk9ORSIsIkNVTExGQUNFX0JBQ0siLCJDVUxMRkFDRV9GUk9OVCIsIkNVTExGQUNFX0ZST05UQU5EQkFDSyIsIkZJTFRFUl9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUiIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJJTkRFWEZPUk1BVF9VSU5UOCIsIklOREVYRk9STUFUX1VJTlQxNiIsIklOREVYRk9STUFUX1VJTlQzMiIsIlBSSU1JVElWRV9QT0lOVFMiLCJQUklNSVRJVkVfTElORVMiLCJQUklNSVRJVkVfTElORUxPT1AiLCJQUklNSVRJVkVfTElORVNUUklQIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsIlBSSU1JVElWRV9UUklTVFJJUCIsIlBSSU1JVElWRV9UUklGQU4iLCJTRU1BTlRJQ19QT1NJVElPTiIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX0NPTE9SIiwiU0VNQU5USUNfVEVYQ09PUkQiLCJTRU1BTlRJQ19URVhDT09SRDAiLCJTRU1BTlRJQ19URVhDT09SRDEiLCJTRU1BTlRJQ19BVFRSMCIsIlNFTUFOVElDX0FUVFIxIiwiU0VNQU5USUNfQVRUUjIiLCJTRU1BTlRJQ19BVFRSMyIsIlRFWFRVUkVMT0NLX1JFQUQiLCJURVhUVVJFTE9DS19XUklURSIsImRyYXdRdWFkV2l0aFNoYWRlciIsInNoYWRlckNodW5rcyIsIkRldmljZSIsIkdyYXBoaWNzRGV2aWNlIiwiSW5kZXhCdWZmZXIiLCJQcm9ncmFtTGlicmFyeSIsIlJlbmRlclRhcmdldCIsIlNjb3BlSWQiLCJTaGFkZXIiLCJTaGFkZXJJbnB1dCIsIlRleHR1cmUiLCJWZXJ0ZXhCdWZmZXIiLCJWZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhJdGVyYXRvciIsInBvc3RlZmZlY3QiLCJjcmVhdGVGdWxsc2NyZWVuUXVhZCIsImRyYXdGdWxsc2NyZWVuUXVhZCIsIlBvc3RFZmZlY3QiLCJQb3N0RWZmZWN0UXVldWUiLCJ0cmFuc2Zvcm1WUyIsImRlcHJlY2F0ZWRDaHVua3MiLCJrZXlzIiwiZm9yRWFjaCIsImNodW5rTmFtZSIsInJlcGxhY2VtZW50IiwidXNlSW5zdGVhZCIsIm1zZyIsInNldCIsImRlZmluZVByb3BlcnRpZXMiLCJfZ2xGcmFtZUJ1ZmZlciIsImltcGwiLCJyZ2JtIiwiZ2V0RGVmYXVsdEluc3RhbmNpbmdGb3JtYXQiLCJHcmFwaGljc0RldmljZUFjY2VzcyIsInR5cGUiLCJURVhUVVJFVFlQRV9SR0JNIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsInN3aXp6bGVHR0dSIiwiVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IiLCJfZ2xUZXh0dXJlIiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJzZXRQcm9ncmFtTGlicmFyeSIsImxpYiIsInJlbW92ZVNoYWRlckZyb21DYWNoZSIsInNoYWRlciIsInJlbW92ZUZyb21DYWNoZSIsIlBob25nTWF0ZXJpYWwiLCJTdGFuZGFyZE1hdGVyaWFsIiwic2NlbmUiLCJwYXJ0aXRpb25Ta2luIiwicHJvY2VkdXJhbCIsImNhbGN1bGF0ZVRhbmdlbnRzIiwiY3JlYXRlTWVzaCIsImNyZWF0ZVRvcnVzIiwiY3JlYXRlQ3lsaW5kZXIiLCJjcmVhdGVDYXBzdWxlIiwiY3JlYXRlQ29uZSIsImNyZWF0ZVNwaGVyZSIsImNyZWF0ZVBsYW5lIiwiY3JlYXRlQm94IiwiQmFzaWNNYXRlcmlhbCIsIkNvbW1hbmQiLCJGb3J3YXJkUmVuZGVyZXIiLCJHcmFwaE5vZGUiLCJNYXRlcmlhbCIsIk1lc2giLCJNZXNoSW5zdGFuY2UiLCJNb2RlbCIsIlBhcnRpY2xlRW1pdHRlciIsIlBpY2tlciIsIlByb2plY3Rpb24iLCJPUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsIlBFUlNQRUNUSVZFIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsIlNjZW5lIiwiU2tpbiIsIlNraW5JbnN0YW5jZSIsImdldERlZmF1bHRNYXRlcmlhbCIsImdldEFwcGxpY2F0aW9uIiwiZ3JhcGhpY3NEZXZpY2UiLCJzaXplIiwiaW5kZXgiLCJfcHJlZmlsdGVyZWRDdWJlbWFwcyIsInZhbHVlIiwidXBkYXRlU2hhZGVycyIsIl9tb2RlbHMiLCJfdXBkYXRlU2t5Ym94IiwiZGV2aWNlIiwiX3VwZGF0ZVNreSIsImFkZE1vZGVsIiwibW9kZWwiLCJjb250YWluc01vZGVsIiwibGF5ZXIiLCJsYXllcnMiLCJnZXRMYXllckJ5SWQiLCJMQVlFUklEX1dPUkxEIiwiYWRkTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZXMiLCJtb2RlbHMiLCJwdXNoIiwiYWRkU2hhZG93Q2FzdGVyIiwiYWRkU2hhZG93Q2FzdGVycyIsInJlbW92ZU1vZGVsIiwiaW5kZXhPZiIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJzcGxpY2UiLCJyZW1vdmVTaGFkb3dDYXN0ZXJzIiwiZ2V0TW9kZWxzIiwiQmF0Y2giLCJyZW5kZXJDb21wb3NpdGlvbiIsImNvbXAiLCJ1cGRhdGVTaGFkZXIiLCJtZXNoSW5zdGFuY2UiLCJvYmpEZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsIm1hdGVyaWFsIiwiX3NjZW5lIiwidXBkYXRlUGFzc1NoYWRlciIsInN5bmNBYWJiIiwiTW9ycGgiLCJnZXRUYXJnZXQiLCJ0YXJnZXRzIiwiX2RpcnRpZnkiLCJsb2NhbCIsIl9kaXJ0aWZ5TG9jYWwiLCJfZGlydGlmeVdvcmxkIiwiYWRkTGFiZWwiLCJsYWJlbCIsIl9sYWJlbHMiLCJnZXRMYWJlbHMiLCJoYXNMYWJlbCIsInJlbW92ZUxhYmVsIiwiZmluZEJ5TGFiZWwiLCJyZXN1bHRzIiwiaSIsIl9jaGlsZHJlbiIsImxlbmd0aCIsImdldENoaWxkcmVuIiwiY2hpbGRyZW4iLCJnZXROYW1lIiwiZ2V0UGF0aCIsInBhdGgiLCJnZXRSb290Iiwicm9vdCIsImdldFBhcmVudCIsInBhcmVudCIsInNldE5hbWUiLCJnZXRTaGFkZXIiLCJzZXRTaGFkZXIiLCJfZGVmaW5lQWxpYXMiLCJuZXdOYW1lIiwib2xkTmFtZSIsIl9kZWZpbmVPcHRpb24iLCJTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyIsImxpdE9wdGlvbnMiLCJ0ZW1wT3B0aW9ucyIsIkxpdE9wdGlvbnMiLCJsaXRPcHRpb25Qcm9wZXJ0aWVzIiwiZ2V0T3duUHJvcGVydHlOYW1lcyIsImxpdE9wdGlvbiIsImFuaW0iLCJBbmltYXRpb24iLCJLZXkiLCJOb2RlIiwiU2tlbGV0b24iLCJnZXREdXJhdGlvbiIsImR1cmF0aW9uIiwiZ2V0Tm9kZXMiLCJub2RlcyIsInNldER1cmF0aW9uIiwiZ2V0QW5pbWF0aW9uIiwiYW5pbWF0aW9uIiwiZ2V0Q3VycmVudFRpbWUiLCJjdXJyZW50VGltZSIsImdldExvb3BpbmciLCJsb29waW5nIiwiZ2V0TnVtTm9kZXMiLCJudW1Ob2RlcyIsInNldEFuaW1hdGlvbiIsInNldEN1cnJlbnRUaW1lIiwic2V0TG9vcGluZyIsImF1ZGlvIiwiQXVkaW9NYW5hZ2VyIiwiU291bmRNYW5hZ2VyIiwiQ2hhbm5lbCIsIkNoYW5uZWwzZCIsIkxpc3RlbmVyIiwiU291bmQiLCJnZXRMaXN0ZW5lciIsImxpc3RlbmVyIiwiZ2V0Vm9sdW1lIiwidm9sdW1lIiwic2V0Vm9sdW1lIiwiYXNzZXQiLCJBU1NFVF9BTklNQVRJT04iLCJBU1NFVF9BVURJTyIsIkFTU0VUX0lNQUdFIiwiQVNTRVRfSlNPTiIsIkFTU0VUX01PREVMIiwiQVNTRVRfTUFURVJJQUwiLCJBU1NFVF9URVhUIiwiQVNTRVRfVEVYVFVSRSIsIkFTU0VUX0NVQkVNQVAiLCJBU1NFVF9TQ1JJUFQiLCJBc3NldFJlZ2lzdHJ5IiwiZ2V0QXNzZXRCeUlkIiwiaWQiLCJYcklucHV0U291cmNlIiwiX3JheUxvY2FsIiwiX2xvY2FsUG9zaXRpb24iLCJfbG9jYWxSb3RhdGlvbiIsImlucHV0IiwiZ2V0VG91Y2hUYXJnZXRDb29yZHMiLCJDb250cm9sbGVyIiwiR2FtZVBhZHMiLCJLZXlib2FyZCIsIktleWJvYXJkRXZlbnQiLCJNb3VzZSIsIk1vdXNlRXZlbnQiLCJUb3VjaCIsIlRvdWNoRGV2aWNlIiwiVG91Y2hFdmVudCIsIkVsZW1lbnRJbnB1dCIsIndoZWVsRGVsdGEiLCJSSUdJREJPRFlfVFlQRV9TVEFUSUMiLCJCT0RZVFlQRV9TVEFUSUMiLCJSSUdJREJPRFlfVFlQRV9EWU5BTUlDIiwiQk9EWVRZUEVfRFlOQU1JQyIsIlJJR0lEQk9EWV9UWVBFX0tJTkVNQVRJQyIsIkJPRFlUWVBFX0tJTkVNQVRJQyIsIlJJR0lEQk9EWV9DRl9TVEFUSUNfT0JKRUNUIiwiQk9EWUZMQUdfU1RBVElDX09CSkVDVCIsIlJJR0lEQk9EWV9DRl9LSU5FTUFUSUNfT0JKRUNUIiwiQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCIsIlJJR0lEQk9EWV9DRl9OT1JFU1BPTlNFX09CSkVDVCIsIkJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUIiwiUklHSURCT0RZX0FDVElWRV9UQUciLCJCT0RZU1RBVEVfQUNUSVZFX1RBRyIsIlJJR0lEQk9EWV9JU0xBTkRfU0xFRVBJTkciLCJCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HIiwiUklHSURCT0RZX1dBTlRTX0RFQUNUSVZBVElPTiIsIkJPRFlTVEFURV9XQU5UU19ERUFDVElWQVRJT04iLCJSSUdJREJPRFlfRElTQUJMRV9ERUFDVElWQVRJT04iLCJCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04iLCJSSUdJREJPRFlfRElTQUJMRV9TSU1VTEFUSU9OIiwiQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiIsIkFwcEJhc2UiLCJpc0Z1bGxzY3JlZW4iLCJkb2N1bWVudCIsImZ1bGxzY3JlZW5FbGVtZW50IiwiZW5hYmxlRnVsbHNjcmVlbiIsImVsZW1lbnQiLCJzdWNjZXNzIiwiY2FudmFzIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImUiLCJhZGRFdmVudExpc3RlbmVyIiwicmVxdWVzdEZ1bGxzY3JlZW4iLCJFbGVtZW50IiwiQUxMT1dfS0VZQk9BUkRfSU5QVVQiLCJkaXNhYmxlRnVsbHNjcmVlbiIsImV4aXRGdWxsc2NyZWVuIiwiZ2V0U2NlbmVVcmwiLCJlbnRyeSIsInNjZW5lcyIsImZpbmQiLCJ1cmwiLCJsb2FkU2NlbmUiLCJjYWxsYmFjayIsImxvYWRTY2VuZUhpZXJhcmNoeSIsImxvYWRTY2VuZVNldHRpbmdzIiwicmVuZGVyTWVzaEluc3RhbmNlIiwib3B0aW9ucyIsImRlZmF1bHREcmF3TGF5ZXIiLCJpbW1lZGlhdGUiLCJkcmF3TWVzaCIsInJlbmRlck1lc2giLCJtZXNoIiwibWF0cml4IiwiX2FkZExpbmVzIiwicG9zaXRpb25zIiwiY29sb3JzIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJkZXB0aFRlc3QiLCJ1bmRlZmluZWQiLCJiYXRjaCIsImdldEJhdGNoIiwiYWRkTGluZXMiLCJyZW5kZXJMaW5lIiwic3RhcnQiLCJjb2xvciIsImVuZENvbG9yIiwiYXJndW1lbnRzIiwiTElORUJBVENIX09WRVJMQVkiLCJyZW5kZXJMaW5lcyIsInBvc2l0aW9uIiwibXVsdGlDb2xvciIsImVuYWJsZVZyIiwiQ2FtZXJhQ29tcG9uZW50IiwiZW50aXR5IiwiTGlnaHRDb21wb25lbnQiLCJlbmFibGVkIiwiTW9kZWxDb21wb25lbnQiLCJzZXRWaXNpYmxlIiwidmlzaWJsZSIsIlJlbmRlckNvbXBvbmVudCIsIlJpZ2lkQm9keUNvbXBvbmVudCIsInN5bmNCb2R5VG9FbnRpdHkiLCJfdXBkYXRlRHluYW1pYyIsIlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSIsInNldEdyYXZpdHkiLCJncmF2aXR5IiwiY29weSIsImJhc2lzU2V0RG93bmxvYWRDb25maWciLCJnbHVlVXJsIiwid2FzbVVybCIsImZhbGxiYWNrVXJsIiwiYmFzaXNJbml0aWFsaXplIiwibGF6eUluaXQiLCJwcmVmaWx0ZXJDdWJlbWFwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXNITyxNQUFNQSxHQUFHLEdBQUc7RUFDZkMsS0FBSyxFQUFFLFVBQVVDLElBQUksRUFBRTtBQUNuQkMsSUFBQUEsS0FBSyxDQUFDQyxVQUFVLENBQUMsc0RBQXNELENBQUMsQ0FBQTtBQUN4RUMsSUFBQUEsT0FBTyxDQUFDTCxHQUFHLENBQUNFLElBQUksQ0FBQyxDQUFBO0dBQ3BCO0FBRURJLEVBQUFBLElBQUksRUFBRSxZQUFZO0FBQ2RILElBQUFBLEtBQUssQ0FBQ0MsVUFBVSxDQUFDLHFEQUFxRCxDQUFDLENBQUE7SUFDdkVKLEdBQUcsQ0FBQ0MsS0FBSyxDQUFDLHdCQUF3QixHQUFHTSxPQUFPLEdBQUcsR0FBRyxHQUFHQyxRQUFRLENBQUMsQ0FBQTtHQUNqRTtFQUVEQyxJQUFJLEVBQUUsVUFBVVAsSUFBSSxFQUFFO0FBQ2xCQyxJQUFBQSxLQUFLLENBQUNDLFVBQVUsQ0FBQyxzREFBc0QsQ0FBQyxDQUFBO0FBQ3hFQyxJQUFBQSxPQUFPLENBQUNJLElBQUksQ0FBQyxXQUFXLEdBQUdQLElBQUksQ0FBQyxDQUFBO0dBQ25DO0VBRURRLEtBQUssRUFBRSxVQUFVUixJQUFJLEVBQUU7QUFDbkJDLElBQUFBLEtBQUssQ0FBQ0MsVUFBVSxDQUFDLHdEQUF3RCxDQUFDLENBQUE7QUFDMUVDLElBQUFBLE9BQU8sQ0FBQ0ssS0FBSyxDQUFDLFdBQVcsR0FBR1IsSUFBSSxDQUFDLENBQUE7R0FDcEM7RUFFRFMsS0FBSyxFQUFFLFVBQVVULElB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
