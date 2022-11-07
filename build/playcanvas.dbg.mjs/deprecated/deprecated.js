/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
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
import { TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BLENDMODE_ZERO, BLENDMODE_ONE, BLENDMODE_SRC_COLOR, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_ALPHA, BUFFER_STATIC, BUFFER_DYNAMIC, BUFFER_STREAM, CULLFACE_NONE, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_COLOR, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTURETYPE_RGBM, TEXTURETYPE_DEFAULT, TEXTURETYPE_SWIZZLEGGGR } from '../platform/graphics/constants.js';
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
import { FILLMODE_NONE, FILLMODE_FILL_WINDOW, FILLMODE_KEEP_ASPECT, RESOLUTION_AUTO, RESOLUTION_FIXED } from '../framework/constants.js';
import { Application } from '../framework/application.js';
import { getApplication } from '../framework/globals.js';
import { CameraComponent } from '../framework/components/camera/component.js';
import { Component } from '../framework/components/component.js';
import { ComponentSystem } from '../framework/components/system.js';
import { Entity } from '../framework/entity.js';
import { LightComponent } from '../framework/components/light/component.js';
import { ModelComponent } from '../framework/components/model/component.js';
import { RenderComponent } from '../framework/components/render/component.js';
import { BODYTYPE_STATIC, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYFLAG_STATIC_OBJECT, BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT, BODYSTATE_ACTIVE_TAG, BODYSTATE_ISLAND_SLEEPING, BODYSTATE_WANTS_DEACTIVATION, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION } from '../framework/components/rigid-body/constants.js';
import { RigidBodyComponent } from '../framework/components/rigid-body/component.js';
import { RigidBodyComponentSystem } from '../framework/components/rigid-body/system.js';
import { basisInitialize } from '../framework/handlers/basis.js';
import { ShaderUtils } from '../platform/graphics/shader-utils.js';

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
  PIXELFORMAT_R5_G6_B5: PIXELFORMAT_R5_G6_B5,
  PIXELFORMAT_R8_G8_B8: PIXELFORMAT_R8_G8_B8,
  PIXELFORMAT_R8_G8_B8_A8: PIXELFORMAT_R8_G8_B8_A8,
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
const fw = {
  Application: Application,
  Component: Component,
  ComponentSystem: ComponentSystem,
  Entity: Entity,
  FillMode: {
    NONE: FILLMODE_NONE,
    FILL_WINDOW: FILLMODE_FILL_WINDOW,
    KEEP_ASPECT: FILLMODE_KEEP_ASPECT
  },
  ResolutionMode: {
    AUTO: RESOLUTION_AUTO,
    FIXED: RESOLUTION_FIXED
  }
};
Application.prototype.isFullscreen = function () {
  Debug.deprecated('pc.Application#isFullscreen is deprecated. Use the Fullscreen API directly.');
  return !!document.fullscreenElement;
};
Application.prototype.enableFullscreen = function (element, success, error) {
  Debug.deprecated('pc.Application#enableFullscreen is deprecated. Use the Fullscreen API directly.');
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
Application.prototype.disableFullscreen = function (success) {
  Debug.deprecated('pc.Application#disableFullscreen is deprecated. Use the Fullscreen API directly.');

  const s = function s() {
    success();
    document.removeEventListener('fullscreenchange', s);
  };
  if (success) {
    document.addEventListener('fullscreenchange', s, false);
  }
  document.exitFullscreen();
};
Application.prototype.getSceneUrl = function (name) {
  Debug.deprecated('pc.Application#getSceneUrl is deprecated. Use pc.Application#scenes and pc.SceneRegistry#find instead.');
  const entry = this.scenes.find(name);
  if (entry) {
    return entry.url;
  }
  return null;
};
Application.prototype.loadScene = function (url, callback) {
  Debug.deprecated('pc.Application#loadScene is deprecated. Use pc.Application#scenes and pc.SceneRegistry#loadScene instead.');
  this.scenes.loadScene(url, callback);
};
Application.prototype.loadSceneHierarchy = function (url, callback) {
  Debug.deprecated('pc.Application#loadSceneHierarchy is deprecated. Use pc.Application#scenes and pc.SceneRegistry#loadSceneHierarchy instead.');
  this.scenes.loadSceneHierarchy(url, callback);
};
Application.prototype.loadSceneSettings = function (url, callback) {
  Debug.deprecated('pc.Application#loadSceneSettings is deprecated. Use pc.Application#scenes and pc.SceneRegistry#loadSceneSettings instead.');
  this.scenes.loadSceneSettings(url, callback);
};
Application.prototype.renderMeshInstance = function (meshInstance, options) {
  Debug.deprecated('pc.Application.renderMeshInstance is deprecated. Use pc.Application.drawMeshInstance.');
  const layer = options != null && options.layer ? options.layer : this.scene.defaultDrawLayer;
  this.scene.immediate.drawMesh(null, null, null, meshInstance, layer);
};
Application.prototype.renderMesh = function (mesh, material, matrix, options) {
  Debug.deprecated('pc.Application.renderMesh is deprecated. Use pc.Application.drawMesh.');
  const layer = options != null && options.layer ? options.layer : this.scene.defaultDrawLayer;
  this.scene.immediate.drawMesh(material, matrix, mesh, null, layer);
};
Application.prototype._addLines = function (positions, colors, options) {
  const layer = options && options.layer ? options.layer : this.scene.layers.getLayerById(LAYERID_IMMEDIATE);
  const depthTest = options && options.depthTest !== undefined ? options.depthTest : true;
  const batch = this.scene.immediate.getBatch(layer, depthTest);
  batch.addLines(positions, colors);
};
Application.prototype.renderLine = function (start, end, color) {
  Debug.deprecated('pc.Application.renderLine is deprecated. Use pc.Application.drawLine.');
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
Application.prototype.renderLines = function (position, color, options) {
  Debug.deprecated('pc.Application.renderLines is deprecated. Use pc.Application.drawLines.');
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
Application.prototype.enableVr = function () {
  Debug.deprecated('pc.Application#enableVR is deprecated, and WebVR API is no longer supported.');
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

export { ContextCreationError, ELEMENTTYPE_FLOAT32, ELEMENTTYPE_INT16, ELEMENTTYPE_INT32, ELEMENTTYPE_INT8, ELEMENTTYPE_UINT16, ELEMENTTYPE_UINT32, ELEMENTTYPE_UINT8, PhongMaterial, RIGIDBODY_ACTIVE_TAG, RIGIDBODY_CF_KINEMATIC_OBJECT, RIGIDBODY_CF_NORESPONSE_OBJECT, RIGIDBODY_CF_STATIC_OBJECT, RIGIDBODY_DISABLE_DEACTIVATION, RIGIDBODY_DISABLE_SIMULATION, RIGIDBODY_ISLAND_SLEEPING, RIGIDBODY_TYPE_DYNAMIC, RIGIDBODY_TYPE_KINEMATIC, RIGIDBODY_TYPE_STATIC, RIGIDBODY_WANTS_DEACTIVATION, UnsupportedBrowserError, anim, asset, audio, basisSetDownloadConfig, fw, gfx, inherits, input, log, makeArray, posteffect, prefilterCubemap, programlib, scene, shape, time };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwcmVjYXRlZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2RlcHJlY2F0ZWQvZGVwcmVjYXRlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXZpc2lvbiwgdmVyc2lvbiB9IGZyb20gJy4uL2NvcmUvY29yZS5qcyc7XG5pbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuLi9jb3JlL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBUaW1lciwgbm93IH0gZnJvbSAnLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJztcbmltcG9ydCB7IEJvdW5kaW5nU3BoZXJlIH0gZnJvbSAnLi4vY29yZS9zaGFwZS9ib3VuZGluZy1zcGhlcmUuanMnO1xuaW1wb3J0IHsgRnJ1c3R1bSB9IGZyb20gJy4uL2NvcmUvc2hhcGUvZnJ1c3R1bS5qcyc7XG5pbXBvcnQgeyBQbGFuZSB9IGZyb20gJy4uL2NvcmUvc2hhcGUvcGxhbmUuanMnO1xuXG5pbXBvcnQge1xuICAgIEFERFJFU1NfQ0xBTVBfVE9fRURHRSwgQUREUkVTU19NSVJST1JFRF9SRVBFQVQsIEFERFJFU1NfUkVQRUFULFxuICAgIEJMRU5ETU9ERV9aRVJPLCBCTEVORE1PREVfT05FLCBCTEVORE1PREVfU1JDX0NPTE9SLCBCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICBCTEVORE1PREVfRFNUX0NPTE9SLCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUiwgQkxFTkRNT0RFX1NSQ19BTFBIQSwgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSwgQkxFTkRNT0RFX0RTVF9BTFBIQSwgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEsXG4gICAgQlVGRkVSX1NUQVRJQywgQlVGRkVSX0RZTkFNSUMsIEJVRkZFUl9TVFJFQU0sXG4gICAgQ1VMTEZBQ0VfTk9ORSwgQ1VMTEZBQ0VfQkFDSywgQ1VMTEZBQ0VfRlJPTlQsIENVTExGQUNFX0ZST05UQU5EQkFDSyxcbiAgICBGSUxURVJfTkVBUkVTVCwgRklMVEVSX0xJTkVBUiwgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQSVhFTEZPUk1BVF9SNV9HNl9CNSwgUElYRUxGT1JNQVRfUjhfRzhfQjgsIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LFxuICAgIFBSSU1JVElWRV9QT0lOVFMsIFBSSU1JVElWRV9MSU5FUywgUFJJTUlUSVZFX0xJTkVMT09QLCBQUklNSVRJVkVfTElORVNUUklQLFxuICAgIFBSSU1JVElWRV9UUklBTkdMRVMsIFBSSU1JVElWRV9UUklTVFJJUCwgUFJJTUlUSVZFX1RSSUZBTixcbiAgICBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfTk9STUFMLCBTRU1BTlRJQ19DT0xPUiwgU0VNQU5USUNfVEVYQ09PUkQsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBTRU1BTlRJQ19URVhDT09SRDEsIFNFTUFOVElDX0FUVFIwLCBTRU1BTlRJQ19BVFRSMSwgU0VNQU5USUNfQVRUUjIsIFNFTUFOVElDX0FUVFIzLFxuICAgIFRFWFRVUkVMT0NLX1JFQUQsIFRFWFRVUkVMT0NLX1dSSVRFLFxuICAgIFRFWFRVUkVUWVBFX0RFRkFVTFQsIFRFWFRVUkVUWVBFX1JHQk0sIFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSLFxuICAgIFRZUEVfSU5UOCwgVFlQRV9VSU5UOCwgVFlQRV9JTlQxNiwgVFlQRV9VSU5UMTYsIFRZUEVfSU5UMzIsIFRZUEVfVUlOVDMyLCBUWVBFX0ZMT0FUMzJcbn0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGJlZ2luLCBlbmQsIGZvZ0NvZGUsIGdhbW1hQ29kZSwgc2tpbkNvZGUsIHRvbmVtYXBDb2RlIH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtcy9jb21tb24uanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2ltcGxlLXBvc3QtZWZmZWN0LmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL2NodW5rcy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBJbmRleEJ1ZmZlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2luZGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVGdWxsc2NyZWVuUXVhZCwgZHJhd0Z1bGxzY3JlZW5RdWFkLCBQb3N0RWZmZWN0IH0gZnJvbSAnLi4vc2NlbmUvZ3JhcGhpY3MvcG9zdC1lZmZlY3QuanMnO1xuaW1wb3J0IHsgUG9zdEVmZmVjdFF1ZXVlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL3Bvc3QtZWZmZWN0LXF1ZXVlLmpzJztcbmltcG9ydCB7IFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnksIHNldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgU2NvcGVJZCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3Njb3BlLWlkLmpzJztcbmltcG9ydCB7IFNoYWRlciB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcyc7XG5pbXBvcnQgeyBTaGFkZXJJbnB1dCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci1pbnB1dC5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgVmVydGV4SXRlcmF0b3IgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtaXRlcmF0b3IuanMnO1xuXG5pbXBvcnQgeyBQUk9KRUNUSU9OX09SVEhPR1JBUEhJQywgUFJPSkVDVElPTl9QRVJTUEVDVElWRSwgTEFZRVJJRF9JTU1FRElBVEUsIExJTkVCQVRDSF9PVkVSTEFZLCBMQVlFUklEX1dPUkxEIH0gZnJvbSAnLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGNhbGN1bGF0ZVRhbmdlbnRzLCBjcmVhdGVCb3gsIGNyZWF0ZUNhcHN1bGUsIGNyZWF0ZUNvbmUsIGNyZWF0ZUN5bGluZGVyLCBjcmVhdGVNZXNoLCBjcmVhdGVQbGFuZSwgY3JlYXRlU3BoZXJlLCBjcmVhdGVUb3J1cyB9IGZyb20gJy4uL3NjZW5lL3Byb2NlZHVyYWwuanMnO1xuaW1wb3J0IHsgcGFydGl0aW9uU2tpbiB9IGZyb20gJy4uL3NjZW5lL3NraW4tcGFydGl0aW9uLmpzJztcbmltcG9ydCB7IEJhc2ljTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvYmFzaWMtbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH0gZnJvbSAnLi4vc2NlbmUvcmVuZGVyZXIvZm9yd2FyZC1yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IE1vcnBoIH0gZnJvbSAnLi4vc2NlbmUvbW9ycGguanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlLCBDb21tYW5kIH0gZnJvbSAnLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uL3NjZW5lL21vZGVsLmpzJztcbmltcG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IGZyb20gJy4uL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzJztcbmltcG9ydCB7IFBpY2tlciB9IGZyb20gJy4uL2ZyYW1ld29yay9ncmFwaGljcy9waWNrZXIuanMnO1xuaW1wb3J0IHsgU2NlbmUgfSBmcm9tICcuLi9zY2VuZS9zY2VuZS5qcyc7XG5pbXBvcnQgeyBTa2luIH0gZnJvbSAnLi4vc2NlbmUvc2tpbi5qcyc7XG5pbXBvcnQgeyBTa2luSW5zdGFuY2UgfSBmcm9tICcuLi9zY2VuZS9za2luLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgQmF0Y2ggfSBmcm9tICcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0TWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEFuaW1hdGlvbiwgS2V5LCBOb2RlIH0gZnJvbSAnLi4vc2NlbmUvYW5pbWF0aW9uL2FuaW1hdGlvbi5qcyc7XG5pbXBvcnQgeyBTa2VsZXRvbiB9IGZyb20gJy4uL3NjZW5lL2FuaW1hdGlvbi9za2VsZXRvbi5qcyc7XG5cbmltcG9ydCB7IENoYW5uZWwgfSBmcm9tICcuLi9wbGF0Zm9ybS9hdWRpby9jaGFubmVsLmpzJztcbmltcG9ydCB7IENoYW5uZWwzZCB9IGZyb20gJy4uL3BsYXRmb3JtL2F1ZGlvL2NoYW5uZWwzZC5qcyc7XG5pbXBvcnQgeyBMaXN0ZW5lciB9IGZyb20gJy4uL3BsYXRmb3JtL3NvdW5kL2xpc3RlbmVyLmpzJztcbmltcG9ydCB7IFNvdW5kIH0gZnJvbSAnLi4vcGxhdGZvcm0vc291bmQvc291bmQuanMnO1xuaW1wb3J0IHsgU291bmRNYW5hZ2VyIH0gZnJvbSAnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcyc7XG5cbmltcG9ydCB7IEFzc2V0UmVnaXN0cnkgfSBmcm9tICcuLi9mcmFtZXdvcmsvYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMnO1xuXG5pbXBvcnQgeyBYcklucHV0U291cmNlIH0gZnJvbSAnLi4vZnJhbWV3b3JrL3hyL3hyLWlucHV0LXNvdXJjZS5qcyc7XG5cbmltcG9ydCB7IENvbnRyb2xsZXIgfSBmcm9tICcuLi9wbGF0Zm9ybS9pbnB1dC9jb250cm9sbGVyLmpzJztcbmltcG9ydCB7IEVsZW1lbnRJbnB1dCB9IGZyb20gJy4uL2ZyYW1ld29yay9pbnB1dC9lbGVtZW50LWlucHV0LmpzJztcbmltcG9ydCB7IEdhbWVQYWRzIH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvZ2FtZS1wYWRzLmpzJztcbmltcG9ydCB7IEtleWJvYXJkIH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQva2V5Ym9hcmQuanMnO1xuaW1wb3J0IHsgS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L2tleWJvYXJkLWV2ZW50LmpzJztcbmltcG9ydCB7IE1vdXNlIH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UuanMnO1xuaW1wb3J0IHsgTW91c2VFdmVudCB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L21vdXNlLWV2ZW50LmpzJztcbmltcG9ydCB7IFRvdWNoRGV2aWNlIH0gZnJvbSAnLi4vcGxhdGZvcm0vaW5wdXQvdG91Y2gtZGV2aWNlLmpzJztcbmltcG9ydCB7IGdldFRvdWNoVGFyZ2V0Q29vcmRzLCBUb3VjaCwgVG91Y2hFdmVudCB9IGZyb20gJy4uL3BsYXRmb3JtL2lucHV0L3RvdWNoLWV2ZW50LmpzJztcblxuaW1wb3J0IHsgRklMTE1PREVfRklMTF9XSU5ET1csIEZJTExNT0RFX0tFRVBfQVNQRUNULCBGSUxMTU9ERV9OT05FLCBSRVNPTFVUSU9OX0FVVE8sIFJFU09MVVRJT05fRklYRUQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEFwcGxpY2F0aW9uIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2FwcGxpY2F0aW9uLmpzJztcbmltcG9ydCB7IGdldEFwcGxpY2F0aW9uIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2dsb2JhbHMuanMnO1xuaW1wb3J0IHsgQ2FtZXJhQ29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgQ29tcG9uZW50U3lzdGVtIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvc3lzdGVtLmpzJztcbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uL2ZyYW1ld29yay9lbnRpdHkuanMnO1xuaW1wb3J0IHsgTGlnaHRDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9saWdodC9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgTW9kZWxDb21wb25lbnQgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9tb2RlbC9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgUmVuZGVyQ29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvcmVuZGVyL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQge1xuICAgIEJPRFlGTEFHX0tJTkVNQVRJQ19PQkpFQ1QsIEJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNULCBCT0RZRkxBR19TVEFUSUNfT0JKRUNULFxuICAgIEJPRFlTVEFURV9BQ1RJVkVfVEFHLCBCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04sIEJPRFlTVEFURV9ESVNBQkxFX1NJTVVMQVRJT04sIEJPRFlTVEFURV9JU0xBTkRfU0xFRVBJTkcsIEJPRFlTVEFURV9XQU5UU19ERUFDVElWQVRJT04sXG4gICAgQk9EWVRZUEVfRFlOQU1JQywgQk9EWVRZUEVfS0lORU1BVElDLCBCT0RZVFlQRV9TVEFUSUNcbn0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgUmlnaWRCb2R5Q29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9zeXN0ZW0uanMnO1xuaW1wb3J0IHsgYmFzaXNJbml0aWFsaXplIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2hhbmRsZXJzL2Jhc2lzLmpzJztcbmltcG9ydCB7IFNoYWRlclV0aWxzIH0gZnJvbSAnLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXV0aWxzLmpzJztcblxuLy8gQ09SRVxuXG5leHBvcnQgY29uc3QgbG9nID0ge1xuICAgIHdyaXRlOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cud3JpdGUgaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUubG9nIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUubG9nKHRleHQpO1xuICAgIH0sXG5cbiAgICBvcGVuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5vcGVuIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLmxvZyBpbnN0ZWFkLicpO1xuICAgICAgICBsb2cud3JpdGUoJ1Bvd2VyZWQgYnkgUGxheUNhbnZhcyAnICsgdmVyc2lvbiArICcgJyArIHJldmlzaW9uKTtcbiAgICB9LFxuXG4gICAgaW5mbzogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmluZm8gaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUuaW5mbyBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLmluZm8oJ0lORk86ICAgICcgKyB0ZXh0KTtcbiAgICB9LFxuXG4gICAgZGVidWc6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5kZWJ1ZyBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5kZWJ1ZyBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLmRlYnVnKCdERUJVRzogICAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIGVycm9yOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuZXJyb3IgaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUuZXJyb3IgaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS5lcnJvcignRVJST1I6ICAgJyArIHRleHQpO1xuICAgIH0sXG5cbiAgICB3YXJuaW5nOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cud2FybmluZyBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS53YXJuIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUud2FybignV0FSTklORzogJyArIHRleHQpO1xuICAgIH0sXG5cbiAgICBhbGVydDogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmFsZXJ0IGlzIGRlcHJlY2F0ZWQuIFVzZSBhbGVydCBpbnN0ZWFkLicpO1xuICAgICAgICBsb2cud3JpdGUoJ0FMRVJUOiAgICcgKyB0ZXh0KTtcbiAgICAgICAgYWxlcnQodGV4dCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgbm8tYWxlcnRcbiAgICB9LFxuXG4gICAgYXNzZXJ0OiBmdW5jdGlvbiAoY29uZGl0aW9uLCB0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5hc3NlcnQgaXMgZGVwcmVjYXRlZC4gVXNlIGEgY29uZGl0aW9uYWwgcGx1cyBjb25zb2xlLmxvZyBpbnN0ZWFkLicpO1xuICAgICAgICBpZiAoY29uZGl0aW9uID09PSBmYWxzZSkge1xuICAgICAgICAgICAgbG9nLndyaXRlKCdBU1NFUlQ6ICAnICsgdGV4dCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5zdHJpbmcuZW5kc1dpdGggPSBmdW5jdGlvbiAocywgc3Vicykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLnN0cmluZy5lbmRzV2l0aCBpcyBkZXByZWNhdGVkLiBVc2UgU3RyaW5nI2VuZHNXaXRoIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHMuZW5kc1dpdGgoc3Vicyk7XG59O1xuXG5zdHJpbmcuc3RhcnRzV2l0aCA9IGZ1bmN0aW9uIChzLCBzdWJzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuc3RyaW5nLnN0YXJ0c1dpdGggaXMgZGVwcmVjYXRlZC4gVXNlIFN0cmluZyNzdGFydHNXaXRoIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHMuc3RhcnRzV2l0aChzdWJzKTtcbn07XG5cbmV4cG9ydCBjb25zdCB0aW1lID0ge1xuICAgIG5vdzogbm93LFxuICAgIFRpbWVyOiBUaW1lclxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkNvbG9yI2RhdGEgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIGNvbG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy5yO1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy5iO1xuICAgICAgICB0aGlzLl9kYXRhWzNdID0gdGhpcy5hO1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENvbG9yLnByb3RvdHlwZSwgJ2RhdGEzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Db2xvciNkYXRhMyBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgY29sb3IgY29tcG9uZW50cyB2aWEgdGhlaXIgaW5kaXZpZHVhbCBwcm9wZXJ0aWVzLicpO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGEzKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhMyA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YTNbMF0gPSB0aGlzLnI7XG4gICAgICAgIHRoaXMuX2RhdGEzWzFdID0gdGhpcy5nO1xuICAgICAgICB0aGlzLl9kYXRhM1syXSA9IHRoaXMuYjtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGEzO1xuICAgIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gaW5oZXJpdHMoU2VsZiwgU3VwZXIpIHtcbiAgICBjb25zdCBUZW1wID0gZnVuY3Rpb24gKCkge307XG4gICAgY29uc3QgRnVuYyA9IGZ1bmN0aW9uIChhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KSB7XG4gICAgICAgIFN1cGVyLmNhbGwodGhpcywgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCk7XG4gICAgICAgIFNlbGYuY2FsbCh0aGlzLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1LCBhcmc2LCBhcmc3LCBhcmc4KTtcbiAgICAgICAgLy8gdGhpcy5jb25zdHJ1Y3RvciA9IFNlbGY7XG4gICAgfTtcbiAgICBGdW5jLl9zdXBlciA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBUZW1wLnByb3RvdHlwZSA9IFN1cGVyLnByb3RvdHlwZTtcbiAgICBGdW5jLnByb3RvdHlwZSA9IG5ldyBUZW1wKCk7XG5cbiAgICByZXR1cm4gRnVuYztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VBcnJheShhcnIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5tYWtlQXJyYXkgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gVXNlIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFycik7XG59XG5cbi8vIE1BVEhcblxubWF0aC5JTlZfTE9HMiA9IE1hdGguTE9HMkU7XG5cbm1hdGguaW50VG9CeXRlcyA9IG1hdGguaW50VG9CeXRlczMyO1xubWF0aC5ieXRlc1RvSW50ID0gbWF0aC5ieXRlc1RvSW50MzI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShWZWMyLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlZlYzIjZGF0YSBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgdmVjdG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy54O1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy55O1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuVmVjMi5wcm90b3R5cGUuc2NhbGUgPSBWZWMyLnByb3RvdHlwZS5tdWxTY2FsYXI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShWZWMzLnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlZlYzMjZGF0YSBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgdmVjdG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy54O1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy55O1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy56O1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuVmVjMy5wcm90b3R5cGUuc2NhbGUgPSBWZWMzLnByb3RvdHlwZS5tdWxTY2FsYXI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShWZWM0LnByb3RvdHlwZSwgJ2RhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlZlYzQjZGF0YSBpcyBub3QgcHVibGljIEFQSSBhbmQgc2hvdWxkIG5vdCBiZSB1c2VkLiBBY2Nlc3MgdmVjdG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhKSB7XG4gICAgICAgICAgICB0aGlzLl9kYXRhID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhWzBdID0gdGhpcy54O1xuICAgICAgICB0aGlzLl9kYXRhWzFdID0gdGhpcy55O1xuICAgICAgICB0aGlzLl9kYXRhWzJdID0gdGhpcy56O1xuICAgICAgICB0aGlzLl9kYXRhWzNdID0gdGhpcy53O1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG59KTtcblxuVmVjNC5wcm90b3R5cGUuc2NhbGUgPSBWZWM0LnByb3RvdHlwZS5tdWxTY2FsYXI7XG5cbi8vIFNIQVBFXG5cbmV4cG9ydCBjb25zdCBzaGFwZSA9IHtcbiAgICBBYWJiOiBCb3VuZGluZ0JveCxcbiAgICBTcGhlcmU6IEJvdW5kaW5nU3BoZXJlLFxuICAgIFBsYW5lOiBQbGFuZVxufTtcblxuQm91bmRpbmdTcGhlcmUucHJvdG90eXBlLmludGVyc2VjdFJheSA9IEJvdW5kaW5nU3BoZXJlLnByb3RvdHlwZS5pbnRlcnNlY3RzUmF5O1xuXG5GcnVzdHVtLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbiAocHJvamVjdGlvbk1hdHJpeCwgdmlld01hdHJpeCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkZydXN0dW0jdXBkYXRlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5GcnVzdHVtI3NldEZyb21NYXQ0IGluc3RlYWQuJyk7XG5cbiAgICBjb25zdCB2aWV3UHJvaiA9IG5ldyBNYXQ0KCk7XG5cbiAgICB2aWV3UHJvai5tdWwyKHByb2plY3Rpb25NYXRyaXgsIHZpZXdNYXRyaXgpO1xuXG4gICAgdGhpcy5zZXRGcm9tTWF0NCh2aWV3UHJvaik7XG59O1xuXG4vLyBHUkFQSElDU1xuXG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfSU5UOCA9IFRZUEVfSU5UODtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9VSU5UOCA9IFRZUEVfVUlOVDg7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfSU5UMTYgPSBUWVBFX0lOVDE2O1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX1VJTlQxNiA9IFRZUEVfVUlOVDE2O1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX0lOVDMyID0gVFlQRV9JTlQzMjtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9VSU5UMzIgPSBUWVBFX1VJTlQzMjtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9GTE9BVDMyID0gVFlQRV9GTE9BVDMyO1xuXG5leHBvcnQgZnVuY3Rpb24gVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgZnVuY3Rpb24gQ29udGV4dENyZWF0aW9uRXJyb3IobWVzc2FnZSkge1xuICAgIHRoaXMubmFtZSA9ICdDb250ZXh0Q3JlYXRpb25FcnJvcic7XG4gICAgdGhpcy5tZXNzYWdlID0gKG1lc3NhZ2UgfHwgJycpO1xufVxuQ29udGV4dENyZWF0aW9uRXJyb3IucHJvdG90eXBlID0gRXJyb3IucHJvdG90eXBlO1xuXG5leHBvcnQgY29uc3QgcHJvZ3JhbWxpYiA9IHtcbiAgICBiZWdpbjogYmVnaW4sXG4gICAgZHVtbXlGcmFnbWVudENvZGU6IFNoYWRlclV0aWxzLmR1bW15RnJhZ21lbnRDb2RlLFxuICAgIGVuZDogZW5kLFxuICAgIGZvZ0NvZGU6IGZvZ0NvZGUsXG4gICAgZ2FtbWFDb2RlOiBnYW1tYUNvZGUsXG4gICAgcHJlY2lzaW9uQ29kZTogU2hhZGVyVXRpbHMucHJlY2lzaW9uQ29kZSxcbiAgICBza2luQ29kZTogc2tpbkNvZGUsXG4gICAgdG9uZW1hcENvZGU6IHRvbmVtYXBDb2RlLFxuICAgIHZlcnNpb25Db2RlOiBTaGFkZXJVdGlscy52ZXJzaW9uQ29kZVxufTtcblxuZXhwb3J0IGNvbnN0IGdmeCA9IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICBBRERSRVNTX01JUlJPUkVEX1JFUEVBVDogQUREUkVTU19NSVJST1JFRF9SRVBFQVQsXG4gICAgQUREUkVTU19SRVBFQVQ6IEFERFJFU1NfUkVQRUFULFxuICAgIEJMRU5ETU9ERV9aRVJPOiBCTEVORE1PREVfWkVSTyxcbiAgICBCTEVORE1PREVfT05FOiBCTEVORE1PREVfT05FLFxuICAgIEJMRU5ETU9ERV9TUkNfQ09MT1I6IEJMRU5ETU9ERV9TUkNfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9EU1RfQ09MT1I6IEJMRU5ETU9ERV9EU1RfQ09MT1IsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1I6IEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9TUkNfQUxQSEE6IEJMRU5ETU9ERV9TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURTogQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEsXG4gICAgQkxFTkRNT0RFX0RTVF9BTFBIQTogQkxFTkRNT0RFX0RTVF9BTFBIQSxcbiAgICBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQTogQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEEsXG4gICAgQlVGRkVSX1NUQVRJQzogQlVGRkVSX1NUQVRJQyxcbiAgICBCVUZGRVJfRFlOQU1JQzogQlVGRkVSX0RZTkFNSUMsXG4gICAgQlVGRkVSX1NUUkVBTTogQlVGRkVSX1NUUkVBTSxcbiAgICBDVUxMRkFDRV9OT05FOiBDVUxMRkFDRV9OT05FLFxuICAgIENVTExGQUNFX0JBQ0s6IENVTExGQUNFX0JBQ0ssXG4gICAgQ1VMTEZBQ0VfRlJPTlQ6IENVTExGQUNFX0ZST05ULFxuICAgIENVTExGQUNFX0ZST05UQU5EQkFDSzogQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLLFxuICAgIEVMRU1FTlRUWVBFX0lOVDg6IFRZUEVfSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9VSU5UODogVFlQRV9VSU5UOCxcbiAgICBFTEVNRU5UVFlQRV9JTlQxNjogVFlQRV9JTlQxNixcbiAgICBFTEVNRU5UVFlQRV9VSU5UMTY6IFRZUEVfVUlOVDE2LFxuICAgIEVMRU1FTlRUWVBFX0lOVDMyOiBUWVBFX0lOVDMyLFxuICAgIEVMRU1FTlRUWVBFX1VJTlQzMjogVFlQRV9VSU5UMzIsXG4gICAgRUxFTUVOVFRZUEVfRkxPQVQzMjogVFlQRV9GTE9BVDMyLFxuICAgIEZJTFRFUl9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVCxcbiAgICBGSUxURVJfTElORUFSOiBGSUxURVJfTElORUFSLFxuICAgIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCxcbiAgICBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSOiBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1Q6IEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsXG4gICAgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSOiBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgSU5ERVhGT1JNQVRfVUlOVDg6IElOREVYRk9STUFUX1VJTlQ4LFxuICAgIElOREVYRk9STUFUX1VJTlQxNjogSU5ERVhGT1JNQVRfVUlOVDE2LFxuICAgIElOREVYRk9STUFUX1VJTlQzMjogSU5ERVhGT1JNQVRfVUlOVDMyLFxuICAgIFBJWEVMRk9STUFUX1I1X0c2X0I1OiBQSVhFTEZPUk1BVF9SNV9HNl9CNSxcbiAgICBQSVhFTEZPUk1BVF9SOF9HOF9CODogUElYRUxGT1JNQVRfUjhfRzhfQjgsXG4gICAgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTg6IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LFxuICAgIFBSSU1JVElWRV9QT0lOVFM6IFBSSU1JVElWRV9QT0lOVFMsXG4gICAgUFJJTUlUSVZFX0xJTkVTOiBQUklNSVRJVkVfTElORVMsXG4gICAgUFJJTUlUSVZFX0xJTkVMT09QOiBQUklNSVRJVkVfTElORUxPT1AsXG4gICAgUFJJTUlUSVZFX0xJTkVTVFJJUDogUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTOiBQUklNSVRJVkVfVFJJQU5HTEVTLFxuICAgIFBSSU1JVElWRV9UUklTVFJJUDogUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFBSSU1JVElWRV9UUklGQU46IFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT046IFNFTUFOVElDX1BPU0lUSU9OLFxuICAgIFNFTUFOVElDX05PUk1BTDogU0VNQU5USUNfTk9STUFMLFxuICAgIFNFTUFOVElDX0NPTE9SOiBTRU1BTlRJQ19DT0xPUixcbiAgICBTRU1BTlRJQ19URVhDT09SRDogU0VNQU5USUNfVEVYQ09PUkQsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQwOiBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxOiBTRU1BTlRJQ19URVhDT09SRDEsXG4gICAgU0VNQU5USUNfQVRUUjA6IFNFTUFOVElDX0FUVFIwLFxuICAgIFNFTUFOVElDX0FUVFIxOiBTRU1BTlRJQ19BVFRSMSxcbiAgICBTRU1BTlRJQ19BVFRSMjogU0VNQU5USUNfQVRUUjIsXG4gICAgU0VNQU5USUNfQVRUUjM6IFNFTUFOVElDX0FUVFIzLFxuICAgIFRFWFRVUkVMT0NLX1JFQUQ6IFRFWFRVUkVMT0NLX1JFQUQsXG4gICAgVEVYVFVSRUxPQ0tfV1JJVEU6IFRFWFRVUkVMT0NLX1dSSVRFLFxuICAgIGRyYXdRdWFkV2l0aFNoYWRlcjogZHJhd1F1YWRXaXRoU2hhZGVyLFxuICAgIHByb2dyYW1saWI6IHByb2dyYW1saWIsXG4gICAgc2hhZGVyQ2h1bmtzOiBzaGFkZXJDaHVua3MsXG4gICAgQ29udGV4dENyZWF0aW9uRXJyb3I6IENvbnRleHRDcmVhdGlvbkVycm9yLFxuICAgIERldmljZTogR3JhcGhpY3NEZXZpY2UsXG4gICAgSW5kZXhCdWZmZXI6IEluZGV4QnVmZmVyLFxuICAgIFByb2dyYW1MaWJyYXJ5OiBQcm9ncmFtTGlicmFyeSxcbiAgICBSZW5kZXJUYXJnZXQ6IFJlbmRlclRhcmdldCxcbiAgICBTY29wZUlkOiBTY29wZUlkLFxuICAgIFNoYWRlcjogU2hhZGVyLFxuICAgIFNoYWRlcklucHV0OiBTaGFkZXJJbnB1dCxcbiAgICBUZXh0dXJlOiBUZXh0dXJlLFxuICAgIFVuc3VwcG9ydGVkQnJvd3NlckVycm9yOiBVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcixcbiAgICBWZXJ0ZXhCdWZmZXI6IFZlcnRleEJ1ZmZlcixcbiAgICBWZXJ0ZXhGb3JtYXQ6IFZlcnRleEZvcm1hdCxcbiAgICBWZXJ0ZXhJdGVyYXRvcjogVmVydGV4SXRlcmF0b3Jcbn07XG5cbmV4cG9ydCBjb25zdCBwb3N0ZWZmZWN0ID0ge1xuICAgIGNyZWF0ZUZ1bGxzY3JlZW5RdWFkOiBjcmVhdGVGdWxsc2NyZWVuUXVhZCxcbiAgICBkcmF3RnVsbHNjcmVlblF1YWQ6IGRyYXdGdWxsc2NyZWVuUXVhZCxcbiAgICBQb3N0RWZmZWN0OiBQb3N0RWZmZWN0LFxuICAgIFBvc3RFZmZlY3RRdWV1ZTogUG9zdEVmZmVjdFF1ZXVlXG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoc2hhZGVyQ2h1bmtzLCAndHJhbnNmb3JtU2tpbm5lZFZTJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyNkZWZpbmUgU0tJTlxcbicgKyBzaGFkZXJDaHVua3MudHJhbnNmb3JtVlM7XG4gICAgfVxufSk7XG5cbmNvbnN0IGRlcHJlY2F0ZWRDaHVua3MgPSB7XG4gICAgJ2FtYmllbnRQcmVmaWx0ZXJlZEN1YmUuZnJhZyc6ICdhbWJpZW50RW52LmZyYWcnLFxuICAgICdhbWJpZW50UHJlZmlsdGVyZWRDdWJlTG9kLmZyYWcnOiAnYW1iaWVudEVudi5mcmFnJyxcbiAgICAnZHBBdGxhc1F1YWQuZnJhZyc6IG51bGwsXG4gICAgJ2dlblBhcmFib2xvaWQuZnJhZyc6IG51bGwsXG4gICAgJ3ByZWZpbHRlckN1YmVtYXAuZnJhZyc6IG51bGwsXG4gICAgJ3JlZmxlY3Rpb25EcEF0bGFzLmZyYWcnOiAncmVmbGVjdGlvbkVudi5mcmFnJyxcbiAgICAncmVmbGVjdGlvblByZWZpbHRlcmVkQ3ViZS5mcmFnJzogJ3JlZmxlY3Rpb25FbnYuZnJhZycsXG4gICAgJ3JlZmxlY3Rpb25QcmVmaWx0ZXJlZEN1YmVMb2QuZnJhZyc6ICdyZWZsZWN0aW9uRW52LmZyYWcnXG59O1xuXG5PYmplY3Qua2V5cyhkZXByZWNhdGVkQ2h1bmtzKS5mb3JFYWNoKChjaHVua05hbWUpID0+IHtcbiAgICBjb25zdCByZXBsYWNlbWVudCA9IGRlcHJlY2F0ZWRDaHVua3NbY2h1bmtOYW1lXTtcbiAgICBjb25zdCB1c2VJbnN0ZWFkID0gcmVwbGFjZW1lbnQgPyBgIFVzZSBwYy5zaGFkZXJDaHVua3NbJyR7cmVwbGFjZW1lbnR9J10gaW5zdGVhZC5gIDogJyc7XG4gICAgY29uc3QgbXNnID0gYHBjLnNoYWRlckNodW5rc1snJHtjaHVua05hbWV9J10gaXMgZGVwcmVjYXRlZC4ke3VzZUluc3RlYWR9fWA7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNoYWRlckNodW5rcywgY2h1bmtOYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IobXNnKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKG1zZyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG4vLyBOb3RlOiBUaGlzIHdhcyBuZXZlciBwdWJsaWMgaW50ZXJmYWNlLCBidXQgaGFzIGJlZW4gdXNlZCBpbiBleHRlcm5hbCBzY3JpcHRzXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhSZW5kZXJUYXJnZXQucHJvdG90eXBlLCB7XG4gICAgX2dsRnJhbWVCdWZmZXI6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJUYXJnZXQjX2dsRnJhbWVCdWZmZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlclRhcmdldC5pbXBsI19nbEZyYW1lQnVmZmVyIGluc3RlYWQuJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsLl9nbEZyYW1lQnVmZmVyO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChyZ2JtKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJUYXJnZXQjX2dsRnJhbWVCdWZmZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlclRhcmdldC5pbXBsI19nbEZyYW1lQnVmZmVyIGluc3RlYWQuJyk7XG4gICAgICAgIH1cbiAgICB9XG59KTtcblxuVmVydGV4Rm9ybWF0LnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVmVydGV4Rm9ybWF0LnVwZGF0ZSBpcyBkZXByZWNhdGVkLCBhbmQgVmVydGV4Rm9ybWF0IGNhbm5vdCBiZSBjaGFuZ2VkIGFmdGVyIGl0IGhhcyBiZWVuIGNyZWF0ZWQuJyk7XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydGllcyhUZXh0dXJlLnByb3RvdHlwZSwge1xuICAgIHJnYm06IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3JnYm0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlRleHR1cmUjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gVEVYVFVSRVRZUEVfUkdCTTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAocmdibSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNyZ2JtIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IHJnYm0gPyBURVhUVVJFVFlQRV9SR0JNIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBzd2l6emxlR0dHUjoge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlRleHR1cmUjc3dpenpsZUdHR1IgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlRleHR1cmUjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1I7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHN3aXp6bGVHR0dSKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3N3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IHN3aXp6bGVHR0dSID8gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IgOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIF9nbFRleHR1cmU6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI19nbFRleHR1cmUgaXMgbm8gbG9uZ2VyIGF2YWlsYWJsZSwgdXNlIFVzZSBwYy5UZXh0dXJlLmltcGwuX2dsVGV4dHVyZSBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbC5fZ2xUZXh0dXJlO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5nZXRQcm9ncmFtTGlicmFyeSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNnZXRQcm9ncmFtTGlicmFyeSBpcyBkZXByZWNhdGVkLmApO1xuICAgIHJldHVybiBnZXRQcm9ncmFtTGlicmFyeSh0aGlzKTtcbn07XG5cbkdyYXBoaWNzRGV2aWNlLnByb3RvdHlwZS5zZXRQcm9ncmFtTGlicmFyeSA9IGZ1bmN0aW9uIChsaWIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5HcmFwaGljc0RldmljZSNzZXRQcm9ncmFtTGlicmFyeSBpcyBkZXByZWNhdGVkLmApO1xuICAgIHNldFByb2dyYW1MaWJyYXJ5KHRoaXMsIGxpYik7XG59O1xuXG5HcmFwaGljc0RldmljZS5wcm90b3R5cGUucmVtb3ZlU2hhZGVyRnJvbUNhY2hlID0gZnVuY3Rpb24gKHNoYWRlcikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLkdyYXBoaWNzRGV2aWNlI3JlbW92ZVNoYWRlckZyb21DYWNoZSBpcyBkZXByZWNhdGVkLmApO1xuICAgIGdldFByb2dyYW1MaWJyYXJ5KHRoaXMpLnJlbW92ZUZyb21DYWNoZShzaGFkZXIpO1xufTtcblxuLy8gU0NFTkVcblxuZXhwb3J0IGNvbnN0IFBob25nTWF0ZXJpYWwgPSBTdGFuZGFyZE1hdGVyaWFsO1xuXG5leHBvcnQgY29uc3Qgc2NlbmUgPSB7XG4gICAgcGFydGl0aW9uU2tpbjogcGFydGl0aW9uU2tpbixcbiAgICBwcm9jZWR1cmFsOiB7XG4gICAgICAgIGNhbGN1bGF0ZVRhbmdlbnRzOiBjYWxjdWxhdGVUYW5nZW50cyxcbiAgICAgICAgY3JlYXRlTWVzaDogY3JlYXRlTWVzaCxcbiAgICAgICAgY3JlYXRlVG9ydXM6IGNyZWF0ZVRvcnVzLFxuICAgICAgICBjcmVhdGVDeWxpbmRlcjogY3JlYXRlQ3lsaW5kZXIsXG4gICAgICAgIGNyZWF0ZUNhcHN1bGU6IGNyZWF0ZUNhcHN1bGUsXG4gICAgICAgIGNyZWF0ZUNvbmU6IGNyZWF0ZUNvbmUsXG4gICAgICAgIGNyZWF0ZVNwaGVyZTogY3JlYXRlU3BoZXJlLFxuICAgICAgICBjcmVhdGVQbGFuZTogY3JlYXRlUGxhbmUsXG4gICAgICAgIGNyZWF0ZUJveDogY3JlYXRlQm94XG4gICAgfSxcbiAgICBCYXNpY01hdGVyaWFsOiBCYXNpY01hdGVyaWFsLFxuICAgIENvbW1hbmQ6IENvbW1hbmQsXG4gICAgRm9yd2FyZFJlbmRlcmVyOiBGb3J3YXJkUmVuZGVyZXIsXG4gICAgR3JhcGhOb2RlOiBHcmFwaE5vZGUsXG4gICAgTWF0ZXJpYWw6IE1hdGVyaWFsLFxuICAgIE1lc2g6IE1lc2gsXG4gICAgTWVzaEluc3RhbmNlOiBNZXNoSW5zdGFuY2UsXG4gICAgTW9kZWw6IE1vZGVsLFxuICAgIFBhcnRpY2xlRW1pdHRlcjogUGFydGljbGVFbWl0dGVyLFxuICAgIFBob25nTWF0ZXJpYWw6IFN0YW5kYXJkTWF0ZXJpYWwsXG4gICAgUGlja2VyOiBQaWNrZXIsXG4gICAgUHJvamVjdGlvbjoge1xuICAgICAgICBPUlRIT0dSQVBISUM6IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLFxuICAgICAgICBQRVJTUEVDVElWRTogUFJPSkVDVElPTl9QRVJTUEVDVElWRVxuICAgIH0sXG4gICAgU2NlbmU6IFNjZW5lLFxuICAgIFNraW46IFNraW4sXG4gICAgU2tpbkluc3RhbmNlOiBTa2luSW5zdGFuY2Vcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTY2VuZS5wcm90b3R5cGUsICdkZWZhdWx0TWF0ZXJpYWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2RlZmF1bHRNYXRlcmlhbCBpcyBkZXByZWNhdGVkLicpO1xuICAgICAgICByZXR1cm4gZ2V0RGVmYXVsdE1hdGVyaWFsKGdldEFwcGxpY2F0aW9uKCkuZ3JhcGhpY3NEZXZpY2UpO1xuICAgIH1cbn0pO1xuXG4vLyBzY2VuZS5za3lib3hQcmVmaWx0ZXJlZCoqKiogYXJlIGRlcHJlY2F0ZWRcblsnMTI4JywgJzY0JywgJzMyJywgJzE2JywgJzgnLCAnNCddLmZvckVhY2goKHNpemUsIGluZGV4KSA9PiB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFNjZW5lLnByb3RvdHlwZSwgYHNreWJveFByZWZpbHRlcmVkJHtzaXplfWAsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TY2VuZSNza3lib3hQcmVmaWx0ZXJlZCR7c2l6ZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNjZW5lI3ByZWZpbHRlcmVkQ3ViZW1hcHMgaW5zdGVhZC5gKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzW2luZGV4XTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlNjZW5lI3NreWJveFByZWZpbHRlcmVkJHtzaXplfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2NlbmUjcHJlZmlsdGVyZWRDdWJlbWFwcyBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwc1tpbmRleF0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoU2NlbmUucHJvdG90eXBlLCAnbW9kZWxzJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuX21vZGVscykge1xuICAgICAgICAgICAgdGhpcy5fbW9kZWxzID0gW107XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVscztcbiAgICB9XG59KTtcblxuLy8gVGhpcyBjYW4gYmUgcmVtb3ZlZCB3aGVuIDEuNTYgaXMgb3V0IGFuZCB0aGUgRWRpdG9yIG5vIGxvbmdlciBjYWxscyB0aGlzXG5TY2VuZS5wcm90b3R5cGUuX3VwZGF0ZVNreWJveCA9IGZ1bmN0aW9uIChkZXZpY2UpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TY2VuZSNfdXBkYXRlU2t5Ym94IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5TY2VuZSNfdXBkYXRlU2t5IGluc3RlYWQuYCk7XG4gICAgdGhpcy5fdXBkYXRlU2t5KGRldmljZSk7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuYWRkTW9kZWwgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNhZGRNb2RlbCBpcyBkZXByZWNhdGVkLicpO1xuICAgIGlmICh0aGlzLmNvbnRhaW5zTW9kZWwobW9kZWwpKSByZXR1cm47XG4gICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCk7XG4gICAgaWYgKCFsYXllcikgcmV0dXJuO1xuICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgdGhpcy5tb2RlbHMucHVzaChtb2RlbCk7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuYWRkU2hhZG93Q2FzdGVyID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjYWRkU2hhZG93Q2FzdGVyIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCk7XG4gICAgaWYgKCFsYXllcikgcmV0dXJuO1xuICAgIGxheWVyLmFkZFNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUucmVtb3ZlTW9kZWwgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNyZW1vdmVNb2RlbCBpcyBkZXByZWNhdGVkLicpO1xuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5tb2RlbHMuaW5kZXhPZihtb2RlbCk7XG4gICAgaWYgKGluZGV4ICE9PSAtMSkge1xuICAgICAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICAgICAgaWYgKCFsYXllcikgcmV0dXJuO1xuICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB0aGlzLm1vZGVscy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgIH1cbn07XG5cblNjZW5lLnByb3RvdHlwZS5yZW1vdmVTaGFkb3dDYXN0ZXJzID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjcmVtb3ZlU2hhZG93Q2FzdGVycyBpcyBkZXByZWNhdGVkLicpO1xuICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfV09STEQpO1xuICAgIGlmICghbGF5ZXIpIHJldHVybjtcbiAgICBsYXllci5yZW1vdmVTaGFkb3dDYXN0ZXJzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xufTtcblxuU2NlbmUucHJvdG90eXBlLmNvbnRhaW5zTW9kZWwgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNjb250YWluc01vZGVsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzLmluZGV4T2YobW9kZWwpID49IDA7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuZ2V0TW9kZWxzID0gZnVuY3Rpb24gKG1vZGVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjZ2V0TW9kZWxzIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubW9kZWxzO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEJhdGNoLnByb3RvdHlwZSwgJ21vZGVsJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5CYXRjaCNtb2RlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQmF0Y2gjbWVzaEluc3RhbmNlIHRvIGFjY2VzcyBiYXRjaGVkIG1lc2ggaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufSk7XG5cbkZvcndhcmRSZW5kZXJlci5wcm90b3R5cGUucmVuZGVyQ29tcG9zaXRpb24gPSBmdW5jdGlvbiAoY29tcCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkZvcndhcmRSZW5kZXJlciNyZW5kZXJDb21wb3NpdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwQmFzZS5yZW5kZXJDb21wb3NpdGlvbiBpbnN0ZWFkLicpO1xuICAgIGdldEFwcGxpY2F0aW9uKCkucmVuZGVyQ29tcG9zaXRpb24oY29tcCk7XG59O1xuXG5Gb3J3YXJkUmVuZGVyZXIucHJvdG90eXBlLnVwZGF0ZVNoYWRlciA9IGZ1bmN0aW9uIChtZXNoSW5zdGFuY2UsIG9iakRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuRm9yd2FyZFJlbmRlcmVyI3VwZGF0ZVNoYWRlciBpcyBkZXByZWNhdGVkLCB1c2UgcGMuTWVzaEluc3RhbmNlI3VwZGF0ZVBhc3NTaGFkZXIuJyk7XG4gICAgY29uc3Qgc2NlbmUgPSBtZXNoSW5zdGFuY2UubWF0ZXJpYWwuX3NjZW5lIHx8IGdldEFwcGxpY2F0aW9uKCkuc2NlbmU7XG4gICAgcmV0dXJuIG1lc2hJbnN0YW5jZS51cGRhdGVQYXNzU2hhZGVyKHNjZW5lLCBwYXNzLCBzdGF0aWNMaWdodExpc3QsIHNvcnRlZExpZ2h0cyk7XG59O1xuXG5NZXNoSW5zdGFuY2UucHJvdG90eXBlLnN5bmNBYWJiID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1lc2hJbnN0YW5jZSNzeW5jQWFiYiBpcyBkZXByZWNhdGVkLicpO1xufTtcblxuTW9ycGgucHJvdG90eXBlLmdldFRhcmdldCA9IGZ1bmN0aW9uIChpbmRleCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1vcnBoI2dldFRhcmdldCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTW9ycGgjdGFyZ2V0cyBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMudGFyZ2V0c1tpbmRleF07XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLl9kaXJ0aWZ5ID0gZnVuY3Rpb24gKGxvY2FsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI19kaXJ0aWZ5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjX2RpcnRpZnlMb2NhbCBvciBfZGlydGlmeVdvcmxkIHJlc3BlY3RpdmVseSBpbnN0ZWFkLicpO1xuICAgIGlmIChsb2NhbClcbiAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgZWxzZVxuICAgICAgICB0aGlzLl9kaXJ0aWZ5V29ybGQoKTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuYWRkTGFiZWwgPSBmdW5jdGlvbiAobGFiZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjYWRkTGFiZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICB0aGlzLl9sYWJlbHNbbGFiZWxdID0gdHJ1ZTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0TGFiZWxzID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRMYWJlbHMgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5fbGFiZWxzKTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuaGFzTGFiZWwgPSBmdW5jdGlvbiAobGFiZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjaGFzTGFiZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gISF0aGlzLl9sYWJlbHNbbGFiZWxdO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5yZW1vdmVMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNyZW1vdmVMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIGRlbGV0ZSB0aGlzLl9sYWJlbHNbbGFiZWxdO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5maW5kQnlMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCwgcmVzdWx0cyA9IFtdKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2ZpbmRCeUxhYmVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgaWYgKHRoaXMuaGFzTGFiZWwobGFiZWwpKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaCh0aGlzKTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2NoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHJlc3VsdHMgPSB0aGlzLl9jaGlsZHJlbltpXS5maW5kQnlMYWJlbChsYWJlbCwgcmVzdWx0cyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdHM7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldENoaWxkcmVuID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRDaGlsZHJlbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI2NoaWxkcmVuIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5jaGlsZHJlbjtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0TmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI25hbWUgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLm5hbWU7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldFBhdGggPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldFBhdGggaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNwYXRoIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5wYXRoO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRSb290ID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRSb290IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjcm9vdCBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMucm9vdDtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0UGFyZW50ID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXRQYXJlbnQgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNwYXJlbnQgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLnBhcmVudDtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuc2V0TmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI3NldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNuYW1lIGluc3RlYWQuJyk7XG5cbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xufTtcblxuTWF0ZXJpYWwucHJvdG90eXBlLmdldE5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWF0ZXJpYWwjZ2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTWF0ZXJpYWwjbmFtZSBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLm5hbWU7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuc2V0TmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWF0ZXJpYWwjc2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTWF0ZXJpYWwjbmFtZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuZ2V0U2hhZGVyID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1hdGVyaWFsI2dldFNoYWRlciBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTWF0ZXJpYWwjc2hhZGVyIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuc2hhZGVyO1xufTtcblxuTWF0ZXJpYWwucHJvdG90eXBlLnNldFNoYWRlciA9IGZ1bmN0aW9uIChzaGFkZXIpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNzZXRTaGFkZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1hdGVyaWFsI3NoYWRlciBpbnN0ZWFkLicpO1xuICAgIHRoaXMuc2hhZGVyID0gc2hhZGVyO1xufTtcblxuZnVuY3Rpb24gX2RlZmluZUFsaWFzKG5ld05hbWUsIG9sZE5hbWUpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU3RhbmRhcmRNYXRlcmlhbC5wcm90b3R5cGUsIG9sZE5hbWUsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TdGFuZGFyZE1hdGVyaWFsIyR7b2xkTmFtZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtuZXdOYW1lfSBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbbmV3TmFtZV07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKGBwYy5TdGFuZGFyZE1hdGVyaWFsIyR7b2xkTmFtZX0gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtuZXdOYW1lfSBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgdGhpc1tuZXdOYW1lXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbl9kZWZpbmVBbGlhcygnZGlmZnVzZVRpbnQnLCAnZGlmZnVzZU1hcFRpbnQnKTtcbl9kZWZpbmVBbGlhcygnc3BlY3VsYXJUaW50JywgJ3NwZWN1bGFyTWFwVGludCcpO1xuX2RlZmluZUFsaWFzKCdlbWlzc2l2ZVRpbnQnLCAnZW1pc3NpdmVNYXBUaW50Jyk7XG5fZGVmaW5lQWxpYXMoJ2FvVmVydGV4Q29sb3InLCAnYW9NYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdkaWZmdXNlVmVydGV4Q29sb3InLCAnZGlmZnVzZU1hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ3NwZWN1bGFyVmVydGV4Q29sb3InLCAnc3BlY3VsYXJNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdlbWlzc2l2ZVZlcnRleENvbG9yJywgJ2VtaXNzaXZlTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnbWV0YWxuZXNzVmVydGV4Q29sb3InLCAnbWV0YWxuZXNzTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnZ2xvc3NWZXJ0ZXhDb2xvcicsICdnbG9zc01hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ29wYWNpdHlWZXJ0ZXhDb2xvcicsICdvcGFjaXR5TWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnbGlnaHRWZXJ0ZXhDb2xvcicsICdsaWdodE1hcFZlcnRleENvbG9yJyk7XG5cbi8vIEFOSU1BVElPTlxuXG5leHBvcnQgY29uc3QgYW5pbSA9IHtcbiAgICBBbmltYXRpb246IEFuaW1hdGlvbixcbiAgICBLZXk6IEtleSxcbiAgICBOb2RlOiBOb2RlLFxuICAgIFNrZWxldG9uOiBTa2VsZXRvblxufTtcblxuQW5pbWF0aW9uLnByb3RvdHlwZS5nZXREdXJhdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BbmltYXRpb24jZ2V0RHVyYXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNkdXJhdGlvbiBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmR1cmF0aW9uO1xufTtcblxuQW5pbWF0aW9uLnByb3RvdHlwZS5nZXROYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNnZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jbmFtZSBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLm5hbWU7XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldE5vZGVzID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNnZXROb2RlcyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQW5pbWF0aW9uI25vZGVzIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubm9kZXM7XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLnNldER1cmF0aW9uID0gZnVuY3Rpb24gKGR1cmF0aW9uKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI3NldER1cmF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jZHVyYXRpb24gaW5zdGVhZC4nKTtcbiAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLnNldE5hbWUgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNzZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jbmFtZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMubmFtZSA9IG5hbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0QW5pbWF0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI2dldEFuaW1hdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jYW5pbWF0aW9uIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuYW5pbWF0aW9uO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLmdldEN1cnJlbnRUaW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI2dldEN1cnJlbnRUaW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNjdXJyZW50VGltZSBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmN1cnJlbnRUaW1lO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLmdldExvb3BpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0TG9vcGluZyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbG9vcGluZyBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmxvb3Bpbmc7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0TnVtTm9kZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0TnVtTm9kZXMgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI251bU5vZGVzIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubnVtTm9kZXM7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuc2V0QW5pbWF0aW9uID0gZnVuY3Rpb24gKGFuaW1hdGlvbikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI3NldEFuaW1hdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jYW5pbWF0aW9uIGluc3RlYWQuJyk7XG4gICAgdGhpcy5hbmltYXRpb24gPSBhbmltYXRpb247XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuc2V0Q3VycmVudFRpbWUgPSBmdW5jdGlvbiAodGltZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI3NldEN1cnJlbnRUaW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNjdXJyZW50VGltZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMuY3VycmVudFRpbWUgPSB0aW1lO1xufTtcblxuU2tlbGV0b24ucHJvdG90eXBlLnNldExvb3BpbmcgPSBmdW5jdGlvbiAobG9vcGluZykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNrZWxldG9uI3NldExvb3BpbmcgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2xvb3BpbmcgaW5zdGVhZC4nKTtcbiAgICB0aGlzLmxvb3BpbmcgPSBsb29waW5nO1xufTtcblxuLy8gU09VTkRcblxuZXhwb3J0IGNvbnN0IGF1ZGlvID0ge1xuICAgIEF1ZGlvTWFuYWdlcjogU291bmRNYW5hZ2VyLFxuICAgIENoYW5uZWw6IENoYW5uZWwsXG4gICAgQ2hhbm5lbDNkOiBDaGFubmVsM2QsXG4gICAgTGlzdGVuZXI6IExpc3RlbmVyLFxuICAgIFNvdW5kOiBTb3VuZFxufTtcblxuU291bmRNYW5hZ2VyLnByb3RvdHlwZS5nZXRMaXN0ZW5lciA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Tb3VuZE1hbmFnZXIjZ2V0TGlzdGVuZXIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNvdW5kTWFuYWdlciNsaXN0ZW5lciBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmxpc3RlbmVyO1xufTtcblxuU291bmRNYW5hZ2VyLnByb3RvdHlwZS5nZXRWb2x1bWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU291bmRNYW5hZ2VyI2dldFZvbHVtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI3ZvbHVtZSBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLnZvbHVtZTtcbn07XG5cblNvdW5kTWFuYWdlci5wcm90b3R5cGUuc2V0Vm9sdW1lID0gZnVuY3Rpb24gKHZvbHVtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNvdW5kTWFuYWdlciNzZXRWb2x1bWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNvdW5kTWFuYWdlciN2b2x1bWUgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnZvbHVtZSA9IHZvbHVtZTtcbn07XG5cbi8vIEFTU0VUXG5cbmV4cG9ydCBjb25zdCBhc3NldCA9IHtcbiAgICBBU1NFVF9BTklNQVRJT046ICdhbmltYXRpb24nLFxuICAgIEFTU0VUX0FVRElPOiAnYXVkaW8nLFxuICAgIEFTU0VUX0lNQUdFOiAnaW1hZ2UnLFxuICAgIEFTU0VUX0pTT046ICdqc29uJyxcbiAgICBBU1NFVF9NT0RFTDogJ21vZGVsJyxcbiAgICBBU1NFVF9NQVRFUklBTDogJ21hdGVyaWFsJyxcbiAgICBBU1NFVF9URVhUOiAndGV4dCcsXG4gICAgQVNTRVRfVEVYVFVSRTogJ3RleHR1cmUnLFxuICAgIEFTU0VUX0NVQkVNQVA6ICdjdWJlbWFwJyxcbiAgICBBU1NFVF9TQ1JJUFQ6ICdzY3JpcHQnXG59O1xuXG5Bc3NldFJlZ2lzdHJ5LnByb3RvdHlwZS5nZXRBc3NldEJ5SWQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Bc3NldFJlZ2lzdHJ5I2dldEFzc2V0QnlJZCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXNzZXRSZWdpc3RyeSNnZXQgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5nZXQoaWQpO1xufTtcblxuLy8gWFJcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFhySW5wdXRTb3VyY2UucHJvdG90eXBlLCAncmF5Jywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5YcklucHV0U291cmNlI3JheSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRPcmlnaW4gYW5kIHBjLlhySW5wdXRTb3VyY2UjZ2V0RGlyZWN0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9yYXlMb2NhbDtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFhySW5wdXRTb3VyY2UucHJvdG90eXBlLCAncG9zaXRpb24nLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlhySW5wdXRTb3VyY2UjcG9zaXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlhySW5wdXRTb3VyY2UjZ2V0TG9jYWxQb3NpdGlvbiBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxQb3NpdGlvbjtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFhySW5wdXRTb3VyY2UucHJvdG90eXBlLCAncm90YXRpb24nLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlhySW5wdXRTb3VyY2Ujcm90YXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlhySW5wdXRTb3VyY2UjZ2V0TG9jYWxSb3RhdGlvbiBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxSb3RhdGlvbjtcbiAgICB9XG59KTtcblxuLy8gSU5QVVRcblxuZXhwb3J0IGNvbnN0IGlucHV0ID0ge1xuICAgIGdldFRvdWNoVGFyZ2V0Q29vcmRzOiBnZXRUb3VjaFRhcmdldENvb3JkcyxcbiAgICBDb250cm9sbGVyOiBDb250cm9sbGVyLFxuICAgIEdhbWVQYWRzOiBHYW1lUGFkcyxcbiAgICBLZXlib2FyZDogS2V5Ym9hcmQsXG4gICAgS2V5Ym9hcmRFdmVudDogS2V5Ym9hcmRFdmVudCxcbiAgICBNb3VzZTogTW91c2UsXG4gICAgTW91c2VFdmVudDogTW91c2VFdmVudCxcbiAgICBUb3VjaDogVG91Y2gsXG4gICAgVG91Y2hEZXZpY2U6IFRvdWNoRGV2aWNlLFxuICAgIFRvdWNoRXZlbnQ6IFRvdWNoRXZlbnRcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShFbGVtZW50SW5wdXQucHJvdG90eXBlLCAnd2hlZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndoZWVsRGVsdGEgKiAtMjtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE1vdXNlRXZlbnQucHJvdG90eXBlLCAnd2hlZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndoZWVsRGVsdGEgKiAtMjtcbiAgICB9XG59KTtcblxuLy8gRlJBTUVXT1JLXG5cbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9TVEFUSUMgPSBCT0RZVFlQRV9TVEFUSUM7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX1RZUEVfRFlOQU1JQyA9IEJPRFlUWVBFX0RZTkFNSUM7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX1RZUEVfS0lORU1BVElDID0gQk9EWVRZUEVfS0lORU1BVElDO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9DRl9TVEFUSUNfT0JKRUNUID0gQk9EWUZMQUdfU1RBVElDX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQ0ZfS0lORU1BVElDX09CSkVDVCA9IEJPRFlGTEFHX0tJTkVNQVRJQ19PQkpFQ1Q7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0NGX05PUkVTUE9OU0VfT0JKRUNUID0gQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1Q7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0FDVElWRV9UQUcgPSBCT0RZU1RBVEVfQUNUSVZFX1RBRztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfSVNMQU5EX1NMRUVQSU5HID0gQk9EWVNUQVRFX0lTTEFORF9TTEVFUElORztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfV0FOVFNfREVBQ1RJVkFUSU9OID0gQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTjtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfRElTQUJMRV9ERUFDVElWQVRJT04gPSBCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT047XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0RJU0FCTEVfU0lNVUxBVElPTiA9IEJPRFlTVEFURV9ESVNBQkxFX1NJTVVMQVRJT047XG5cbmV4cG9ydCBjb25zdCBmdyA9IHtcbiAgICBBcHBsaWNhdGlvbjogQXBwbGljYXRpb24sXG4gICAgQ29tcG9uZW50OiBDb21wb25lbnQsXG4gICAgQ29tcG9uZW50U3lzdGVtOiBDb21wb25lbnRTeXN0ZW0sXG4gICAgRW50aXR5OiBFbnRpdHksXG4gICAgRmlsbE1vZGU6IHtcbiAgICAgICAgTk9ORTogRklMTE1PREVfTk9ORSxcbiAgICAgICAgRklMTF9XSU5ET1c6IEZJTExNT0RFX0ZJTExfV0lORE9XLFxuICAgICAgICBLRUVQX0FTUEVDVDogRklMTE1PREVfS0VFUF9BU1BFQ1RcbiAgICB9LFxuICAgIFJlc29sdXRpb25Nb2RlOiB7XG4gICAgICAgIEFVVE86IFJFU09MVVRJT05fQVVUTyxcbiAgICAgICAgRklYRUQ6IFJFU09MVVRJT05fRklYRURcbiAgICB9XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUuaXNGdWxsc2NyZWVuID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcGxpY2F0aW9uI2lzRnVsbHNjcmVlbiBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIEZ1bGxzY3JlZW4gQVBJIGRpcmVjdGx5LicpO1xuXG4gICAgcmV0dXJuICEhZG9jdW1lbnQuZnVsbHNjcmVlbkVsZW1lbnQ7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUuZW5hYmxlRnVsbHNjcmVlbiA9IGZ1bmN0aW9uIChlbGVtZW50LCBzdWNjZXNzLCBlcnJvcikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcGxpY2F0aW9uI2VuYWJsZUZ1bGxzY3JlZW4gaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSBGdWxsc2NyZWVuIEFQSSBkaXJlY3RseS4nKTtcblxuICAgIGVsZW1lbnQgPSBlbGVtZW50IHx8IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzO1xuXG4gICAgLy8gc3VjY2VzcyBjYWxsYmFja1xuICAgIGNvbnN0IHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHN1Y2Nlc3MoKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsIHMpO1xuICAgIH07XG5cbiAgICAvLyBlcnJvciBjYWxsYmFja1xuICAgIGNvbnN0IGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGVycm9yKCk7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5lcnJvcicsIGUpO1xuICAgIH07XG5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcywgZmFsc2UpO1xuICAgIH1cblxuICAgIGlmIChlcnJvcikge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuZXJyb3InLCBlLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGVsZW1lbnQucmVxdWVzdEZ1bGxzY3JlZW4pIHtcbiAgICAgICAgZWxlbWVudC5yZXF1ZXN0RnVsbHNjcmVlbihFbGVtZW50LkFMTE9XX0tFWUJPQVJEX0lOUFVUKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBlcnJvcigpO1xuICAgIH1cbn07XG5cbkFwcGxpY2F0aW9uLnByb3RvdHlwZS5kaXNhYmxlRnVsbHNjcmVlbiA9IGZ1bmN0aW9uIChzdWNjZXNzKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwbGljYXRpb24jZGlzYWJsZUZ1bGxzY3JlZW4gaXMgZGVwcmVjYXRlZC4gVXNlIHRoZSBGdWxsc2NyZWVuIEFQSSBkaXJlY3RseS4nKTtcblxuICAgIC8vIHN1Y2Nlc3MgY2FsbGJhY2tcbiAgICBjb25zdCBzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzdWNjZXNzKCk7XG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLCBzKTtcbiAgICB9O1xuXG4gICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsIHMsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBkb2N1bWVudC5leGl0RnVsbHNjcmVlbigpO1xufTtcblxuQXBwbGljYXRpb24ucHJvdG90eXBlLmdldFNjZW5lVXJsID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBsaWNhdGlvbiNnZXRTY2VuZVVybCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwbGljYXRpb24jc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2ZpbmQgaW5zdGVhZC4nKTtcbiAgICBjb25zdCBlbnRyeSA9IHRoaXMuc2NlbmVzLmZpbmQobmFtZSk7XG4gICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIHJldHVybiBlbnRyeS51cmw7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufTtcblxuQXBwbGljYXRpb24ucHJvdG90eXBlLmxvYWRTY2VuZSA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwbGljYXRpb24jbG9hZFNjZW5lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBsaWNhdGlvbiNzY2VuZXMgYW5kIHBjLlNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5zY2VuZXMubG9hZFNjZW5lKHVybCwgY2FsbGJhY2spO1xufTtcblxuQXBwbGljYXRpb24ucHJvdG90eXBlLmxvYWRTY2VuZUhpZXJhcmNoeSA9IGZ1bmN0aW9uICh1cmwsIGNhbGxiYWNrKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwbGljYXRpb24jbG9hZFNjZW5lSGllcmFyY2h5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBsaWNhdGlvbiNzY2VuZXMgYW5kIHBjLlNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lSGllcmFyY2h5IGluc3RlYWQuJyk7XG4gICAgdGhpcy5zY2VuZXMubG9hZFNjZW5lSGllcmFyY2h5KHVybCwgY2FsbGJhY2spO1xufTtcblxuQXBwbGljYXRpb24ucHJvdG90eXBlLmxvYWRTY2VuZVNldHRpbmdzID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBsaWNhdGlvbiNsb2FkU2NlbmVTZXR0aW5ncyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwbGljYXRpb24jc2NlbmVzIGFuZCBwYy5TY2VuZVJlZ2lzdHJ5I2xvYWRTY2VuZVNldHRpbmdzIGluc3RlYWQuJyk7XG4gICAgdGhpcy5zY2VuZXMubG9hZFNjZW5lU2V0dGluZ3ModXJsLCBjYWxsYmFjayk7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUucmVuZGVyTWVzaEluc3RhbmNlID0gZnVuY3Rpb24gKG1lc2hJbnN0YW5jZSwgb3B0aW9ucykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcGxpY2F0aW9uLnJlbmRlck1lc2hJbnN0YW5jZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwbGljYXRpb24uZHJhd01lc2hJbnN0YW5jZS4nKTtcbiAgICBjb25zdCBsYXllciA9IG9wdGlvbnM/LmxheWVyID8gb3B0aW9ucy5sYXllciA6IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcjtcbiAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChudWxsLCBudWxsLCBudWxsLCBtZXNoSW5zdGFuY2UsIGxheWVyKTtcbn07XG5cbkFwcGxpY2F0aW9uLnByb3RvdHlwZS5yZW5kZXJNZXNoID0gZnVuY3Rpb24gKG1lc2gsIG1hdGVyaWFsLCBtYXRyaXgsIG9wdGlvbnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBsaWNhdGlvbi5yZW5kZXJNZXNoIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBsaWNhdGlvbi5kcmF3TWVzaC4nKTtcbiAgICBjb25zdCBsYXllciA9IG9wdGlvbnM/LmxheWVyID8gb3B0aW9ucy5sYXllciA6IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcjtcbiAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChtYXRlcmlhbCwgbWF0cml4LCBtZXNoLCBudWxsLCBsYXllcik7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUuX2FkZExpbmVzID0gZnVuY3Rpb24gKHBvc2l0aW9ucywgY29sb3JzLCBvcHRpb25zKSB7XG4gICAgY29uc3QgbGF5ZXIgPSAob3B0aW9ucyAmJiBvcHRpb25zLmxheWVyKSA/IG9wdGlvbnMubGF5ZXIgOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpO1xuICAgIGNvbnN0IGRlcHRoVGVzdCA9IChvcHRpb25zICYmIG9wdGlvbnMuZGVwdGhUZXN0ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5kZXB0aFRlc3QgOiB0cnVlO1xuXG4gICAgY29uc3QgYmF0Y2ggPSB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRCYXRjaChsYXllciwgZGVwdGhUZXN0KTtcbiAgICBiYXRjaC5hZGRMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycyk7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUucmVuZGVyTGluZSA9IGZ1bmN0aW9uIChzdGFydCwgZW5kLCBjb2xvcikge1xuXG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwbGljYXRpb24ucmVuZGVyTGluZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwbGljYXRpb24uZHJhd0xpbmUuJyk7XG5cbiAgICBsZXQgZW5kQ29sb3IgPSBjb2xvcjtcbiAgICBsZXQgb3B0aW9ucztcblxuICAgIGNvbnN0IGFyZzMgPSBhcmd1bWVudHNbM107XG4gICAgY29uc3QgYXJnNCA9IGFyZ3VtZW50c1s0XTtcblxuICAgIGlmIChhcmczIGluc3RhbmNlb2YgQ29sb3IpIHtcbiAgICAgICAgLy8gcGFzc2VkIGluIGVuZCBjb2xvclxuICAgICAgICBlbmRDb2xvciA9IGFyZzM7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBhcmc0ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgLy8gY29tcGF0aWJpbGl0eTogY29udmVydCBsaW5lYmF0Y2ggaWQgaW50byBvcHRpb25zXG4gICAgICAgICAgICBpZiAoYXJnNCA9PT0gTElORUJBVENIX09WRVJMQVkpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGhUZXN0OiBmYWxzZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdXNlIHBhc3NlZCBpbiBvcHRpb25zXG4gICAgICAgICAgICBvcHRpb25zID0gYXJnNDtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGFyZzMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGVuZENvbG9yID0gY29sb3I7XG5cbiAgICAgICAgLy8gY29tcGF0aWJpbGl0eTogY29udmVydCBsaW5lYmF0Y2ggaWQgaW50byBvcHRpb25zXG4gICAgICAgIGlmIChhcmczID09PSBMSU5FQkFUQ0hfT1ZFUkxBWSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IGZhbHNlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGFyZzMpIHtcbiAgICAgICAgLy8gb3B0aW9ucyBwYXNzZWQgaW5cbiAgICAgICAgb3B0aW9ucyA9IGFyZzM7XG4gICAgfVxuXG4gICAgdGhpcy5fYWRkTGluZXMoW3N0YXJ0LCBlbmRdLCBbY29sb3IsIGVuZENvbG9yXSwgb3B0aW9ucyk7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUucmVuZGVyTGluZXMgPSBmdW5jdGlvbiAocG9zaXRpb24sIGNvbG9yLCBvcHRpb25zKSB7XG5cbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBsaWNhdGlvbi5yZW5kZXJMaW5lcyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQXBwbGljYXRpb24uZHJhd0xpbmVzLicpO1xuXG4gICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICAgIC8vIGRlZmF1bHQgb3B0aW9uXG4gICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgIGRlcHRoVGVzdDogdHJ1ZVxuICAgICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LCBMSU5FQkFUQ0hfT1ZFUkxBWSBsaW5lcyBoYXZlIGRlcHRodGVzdCBkaXNhYmxlZFxuICAgICAgICBpZiAob3B0aW9ucyA9PT0gTElORUJBVENIX09WRVJMQVkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiBmYWxzZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgZGVwdGhUZXN0OiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbXVsdGlDb2xvciA9ICEhY29sb3IubGVuZ3RoO1xuICAgIGlmIChtdWx0aUNvbG9yKSB7XG4gICAgICAgIGlmIChwb3NpdGlvbi5sZW5ndGggIT09IGNvbG9yLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcigncmVuZGVyTGluZXM6IHBvc2l0aW9uL2NvbG9yIGFycmF5cyBoYXZlIGRpZmZlcmVudCBsZW5ndGhzJyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHBvc2l0aW9uLmxlbmd0aCAlIDIgIT09IDApIHtcbiAgICAgICAgY29uc29sZS5lcnJvcigncmVuZGVyTGluZXM6IGFycmF5IGxlbmd0aCBpcyBub3QgZGl2aXNpYmxlIGJ5IDInKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9hZGRMaW5lcyhwb3NpdGlvbiwgY29sb3IsIG9wdGlvbnMpO1xufTtcblxuQXBwbGljYXRpb24ucHJvdG90eXBlLmVuYWJsZVZyID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcGxpY2F0aW9uI2VuYWJsZVZSIGlzIGRlcHJlY2F0ZWQsIGFuZCBXZWJWUiBBUEkgaXMgbm8gbG9uZ2VyIHN1cHBvcnRlZC4nKTtcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDYW1lcmFDb21wb25lbnQucHJvdG90eXBlLCAnbm9kZScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQ2FtZXJhQ29tcG9uZW50I25vZGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkNhbWVyYUNvbXBvbmVudCNlbnRpdHkgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW50aXR5O1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTGlnaHRDb21wb25lbnQucHJvdG90eXBlLCAnZW5hYmxlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5MaWdodENvbXBvbmVudCNlbmFibGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkxpZ2h0Q29tcG9uZW50I2VuYWJsZWQgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZW5hYmxlZDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkxpZ2h0Q29tcG9uZW50I2VuYWJsZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTGlnaHRDb21wb25lbnQjZW5hYmxlZCBpbnN0ZWFkLicpO1xuICAgICAgICB0aGlzLmVuYWJsZWQgPSB2YWx1ZTtcbiAgICB9XG59KTtcblxuTW9kZWxDb21wb25lbnQucHJvdG90eXBlLnNldFZpc2libGUgPSBmdW5jdGlvbiAodmlzaWJsZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1vZGVsQ29tcG9uZW50I3NldFZpc2libGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1vZGVsQ29tcG9uZW50I2VuYWJsZWQgaW5zdGVhZC4nKTtcbiAgICB0aGlzLmVuYWJsZWQgPSB2aXNpYmxlO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE1vZGVsQ29tcG9uZW50LnByb3RvdHlwZSwgJ2FhYmInLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1vZGVsQ29tcG9uZW50I2FhYmIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1vZGVsQ29tcG9uZW50I2N1c3RvbUFhYmIgaW5zdGVhZCAtIHdoaWNoIGV4cGVjdHMgbG9jYWwgc3BhY2UgQUFCQiBpbnN0ZWFkIG9mIGEgd29ybGQgc3BhY2UgQUFCQi4nKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1vZGVsQ29tcG9uZW50I2FhYmIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLk1vZGVsQ29tcG9uZW50I2N1c3RvbUFhYmIgaW5zdGVhZCAtIHdoaWNoIGV4cGVjdHMgbG9jYWwgc3BhY2UgQUFCQiBpbnN0ZWFkIG9mIGEgd29ybGQgc3BhY2UgQUFCQi4nKTtcbiAgICB9XG59KTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFJlbmRlckNvbXBvbmVudC5wcm90b3R5cGUsICdhYWJiJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SZW5kZXJDb21wb25lbnQjYWFiYiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmVuZGVyQ29tcG9uZW50I2N1c3RvbUFhYmIgaW5zdGVhZCAtIHdoaWNoIGV4cGVjdHMgbG9jYWwgc3BhY2UgQUFCQiBpbnN0ZWFkIG9mIGEgd29ybGQgc3BhY2UgQUFCQi4nKTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJlbmRlckNvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJDb21wb25lbnQjY3VzdG9tQWFiYiBpbnN0ZWFkIC0gd2hpY2ggZXhwZWN0cyBsb2NhbCBzcGFjZSBBQUJCIGluc3RlYWQgb2YgYSB3b3JsZCBzcGFjZSBBQUJCLicpO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoUmlnaWRCb2R5Q29tcG9uZW50LnByb3RvdHlwZSwgJ2JvZHlUeXBlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5SaWdpZEJvZHlDb21wb25lbnQjYm9keVR5cGUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJpZ2lkQm9keUNvbXBvbmVudCN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLnR5cGU7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudCNib2R5VHlwZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmlnaWRCb2R5Q29tcG9uZW50I3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICB9XG59KTtcblxuUmlnaWRCb2R5Q29tcG9uZW50LnByb3RvdHlwZS5zeW5jQm9keVRvRW50aXR5ID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudCNzeW5jQm9keVRvRW50aXR5IGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuJyk7XG4gICAgdGhpcy5fdXBkYXRlRHluYW1pYygpO1xufTtcblxuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtLnByb3RvdHlwZS5zZXRHcmF2aXR5ID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNzZXRHcmF2aXR5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0jZ3Jhdml0eSBpbnN0ZWFkLicpO1xuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgdGhpcy5ncmF2aXR5LmNvcHkoYXJndW1lbnRzWzBdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmdyYXZpdHkuc2V0KGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgIH1cbn07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGJhc2lzU2V0RG93bmxvYWRDb25maWcoZ2x1ZVVybCwgd2FzbVVybCwgZmFsbGJhY2tVcmwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5iYXNpc1NldERvd25sb2FkQ29uZmlnIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5iYXNpc0luaXRpYWxpemUgaW5zdGVhZC4nKTtcbiAgICBiYXNpc0luaXRpYWxpemUoe1xuICAgICAgICBnbHVlVXJsOiBnbHVlVXJsLFxuICAgICAgICB3YXNtVXJsOiB3YXNtVXJsLFxuICAgICAgICBmYWxsYmFja1VybDogZmFsbGJhY2tVcmwsXG4gICAgICAgIGxhenlJbml0OiB0cnVlXG4gICAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmVmaWx0ZXJDdWJlbWFwKG9wdGlvbnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5wcmVmaWx0ZXJDdWJlbWFwIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5lbnZMaWdodGluZyBpbnN0ZWFkLicpO1xufVxuIl0sIm5hbWVzIjpbImxvZyIsIndyaXRlIiwidGV4dCIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsImNvbnNvbGUiLCJvcGVuIiwidmVyc2lvbiIsInJldmlzaW9uIiwiaW5mbyIsImRlYnVnIiwiZXJyb3IiLCJ3YXJuaW5nIiwid2FybiIsImFsZXJ0IiwiYXNzZXJ0IiwiY29uZGl0aW9uIiwic3RyaW5nIiwiZW5kc1dpdGgiLCJzIiwic3VicyIsInN0YXJ0c1dpdGgiLCJ0aW1lIiwibm93IiwiVGltZXIiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsIkNvbG9yIiwicHJvdG90eXBlIiwiZ2V0IiwiX2RhdGEiLCJGbG9hdDMyQXJyYXkiLCJyIiwiZyIsImIiLCJhIiwiX2RhdGEzIiwiaW5oZXJpdHMiLCJTZWxmIiwiU3VwZXIiLCJUZW1wIiwiRnVuYyIsImFyZzEiLCJhcmcyIiwiYXJnMyIsImFyZzQiLCJhcmc1IiwiYXJnNiIsImFyZzciLCJhcmc4IiwiY2FsbCIsIl9zdXBlciIsIm1ha2VBcnJheSIsImFyciIsIkFycmF5Iiwic2xpY2UiLCJtYXRoIiwiSU5WX0xPRzIiLCJNYXRoIiwiTE9HMkUiLCJpbnRUb0J5dGVzIiwiaW50VG9CeXRlczMyIiwiYnl0ZXNUb0ludCIsImJ5dGVzVG9JbnQzMiIsIlZlYzIiLCJ4IiwieSIsInNjYWxlIiwibXVsU2NhbGFyIiwiVmVjMyIsInoiLCJWZWM0IiwidyIsInNoYXBlIiwiQWFiYiIsIkJvdW5kaW5nQm94IiwiU3BoZXJlIiwiQm91bmRpbmdTcGhlcmUiLCJQbGFuZSIsImludGVyc2VjdFJheSIsImludGVyc2VjdHNSYXkiLCJGcnVzdHVtIiwidXBkYXRlIiwicHJvamVjdGlvbk1hdHJpeCIsInZpZXdNYXRyaXgiLCJ2aWV3UHJvaiIsIk1hdDQiLCJtdWwyIiwic2V0RnJvbU1hdDQiLCJFTEVNRU5UVFlQRV9JTlQ4IiwiVFlQRV9JTlQ4IiwiRUxFTUVOVFRZUEVfVUlOVDgiLCJUWVBFX1VJTlQ4IiwiRUxFTUVOVFRZUEVfSU5UMTYiLCJUWVBFX0lOVDE2IiwiRUxFTUVOVFRZUEVfVUlOVDE2IiwiVFlQRV9VSU5UMTYiLCJFTEVNRU5UVFlQRV9JTlQzMiIsIlRZUEVfSU5UMzIiLCJFTEVNRU5UVFlQRV9VSU5UMzIiLCJUWVBFX1VJTlQzMiIsIkVMRU1FTlRUWVBFX0ZMT0FUMzIiLCJUWVBFX0ZMT0FUMzIiLCJVbnN1cHBvcnRlZEJyb3dzZXJFcnJvciIsIm1lc3NhZ2UiLCJuYW1lIiwiRXJyb3IiLCJDb250ZXh0Q3JlYXRpb25FcnJvciIsInByb2dyYW1saWIiLCJiZWdpbiIsImR1bW15RnJhZ21lbnRDb2RlIiwiU2hhZGVyVXRpbHMiLCJlbmQiLCJmb2dDb2RlIiwiZ2FtbWFDb2RlIiwicHJlY2lzaW9uQ29kZSIsInNraW5Db2RlIiwidG9uZW1hcENvZGUiLCJ2ZXJzaW9uQ29kZSIsImdmeCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiQUREUkVTU19SRVBFQVQiLCJCTEVORE1PREVfWkVSTyIsIkJMRU5ETU9ERV9PTkUiLCJCTEVORE1PREVfU1JDX0NPTE9SIiwiQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1IiLCJCTEVORE1PREVfRFNUX0NPTE9SIiwiQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1IiLCJCTEVORE1PREVfU1JDX0FMUEhBIiwiQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBIiwiQkxFTkRNT0RFX0RTVF9BTFBIQSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBIiwiQlVGRkVSX1NUQVRJQyIsIkJVRkZFUl9EWU5BTUlDIiwiQlVGRkVSX1NUUkVBTSIsIkNVTExGQUNFX05PTkUiLCJDVUxMRkFDRV9CQUNLIiwiQ1VMTEZBQ0VfRlJPTlQiLCJDVUxMRkFDRV9GUk9OVEFOREJBQ0siLCJGSUxURVJfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVIiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiSU5ERVhGT1JNQVRfVUlOVDgiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJQSVhFTEZPUk1BVF9SNV9HNl9CNSIsIlBJWEVMRk9STUFUX1I4X0c4X0I4IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJQUklNSVRJVkVfUE9JTlRTIiwiUFJJTUlUSVZFX0xJTkVTIiwiUFJJTUlUSVZFX0xJTkVMT09QIiwiUFJJTUlUSVZFX0xJTkVTVFJJUCIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiU0VNQU5USUNfUE9TSVRJT04iLCJTRU1BTlRJQ19OT1JNQUwiLCJTRU1BTlRJQ19DT0xPUiIsIlNFTUFOVElDX1RFWENPT1JEIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwiU0VNQU5USUNfVEVYQ09PUkQxIiwiU0VNQU5USUNfQVRUUjAiLCJTRU1BTlRJQ19BVFRSMSIsIlNFTUFOVElDX0FUVFIyIiwiU0VNQU5USUNfQVRUUjMiLCJURVhUVVJFTE9DS19SRUFEIiwiVEVYVFVSRUxPQ0tfV1JJVEUiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJzaGFkZXJDaHVua3MiLCJEZXZpY2UiLCJHcmFwaGljc0RldmljZSIsIkluZGV4QnVmZmVyIiwiUHJvZ3JhbUxpYnJhcnkiLCJSZW5kZXJUYXJnZXQiLCJTY29wZUlkIiwiU2hhZGVyIiwiU2hhZGVySW5wdXQiLCJUZXh0dXJlIiwiVmVydGV4QnVmZmVyIiwiVmVydGV4Rm9ybWF0IiwiVmVydGV4SXRlcmF0b3IiLCJwb3N0ZWZmZWN0IiwiY3JlYXRlRnVsbHNjcmVlblF1YWQiLCJkcmF3RnVsbHNjcmVlblF1YWQiLCJQb3N0RWZmZWN0IiwiUG9zdEVmZmVjdFF1ZXVlIiwidHJhbnNmb3JtVlMiLCJkZXByZWNhdGVkQ2h1bmtzIiwia2V5cyIsImZvckVhY2giLCJjaHVua05hbWUiLCJyZXBsYWNlbWVudCIsInVzZUluc3RlYWQiLCJtc2ciLCJzZXQiLCJkZWZpbmVQcm9wZXJ0aWVzIiwiX2dsRnJhbWVCdWZmZXIiLCJpbXBsIiwicmdibSIsInR5cGUiLCJURVhUVVJFVFlQRV9SR0JNIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsInN3aXp6bGVHR0dSIiwiVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IiLCJfZ2xUZXh0dXJlIiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJzZXRQcm9ncmFtTGlicmFyeSIsImxpYiIsInJlbW92ZVNoYWRlckZyb21DYWNoZSIsInNoYWRlciIsInJlbW92ZUZyb21DYWNoZSIsIlBob25nTWF0ZXJpYWwiLCJTdGFuZGFyZE1hdGVyaWFsIiwic2NlbmUiLCJwYXJ0aXRpb25Ta2luIiwicHJvY2VkdXJhbCIsImNhbGN1bGF0ZVRhbmdlbnRzIiwiY3JlYXRlTWVzaCIsImNyZWF0ZVRvcnVzIiwiY3JlYXRlQ3lsaW5kZXIiLCJjcmVhdGVDYXBzdWxlIiwiY3JlYXRlQ29uZSIsImNyZWF0ZVNwaGVyZSIsImNyZWF0ZVBsYW5lIiwiY3JlYXRlQm94IiwiQmFzaWNNYXRlcmlhbCIsIkNvbW1hbmQiLCJGb3J3YXJkUmVuZGVyZXIiLCJHcmFwaE5vZGUiLCJNYXRlcmlhbCIsIk1lc2giLCJNZXNoSW5zdGFuY2UiLCJNb2RlbCIsIlBhcnRpY2xlRW1pdHRlciIsIlBpY2tlciIsIlByb2plY3Rpb24iLCJPUlRIT0dSQVBISUMiLCJQUk9KRUNUSU9OX09SVEhPR1JBUEhJQyIsIlBFUlNQRUNUSVZFIiwiUFJPSkVDVElPTl9QRVJTUEVDVElWRSIsIlNjZW5lIiwiU2tpbiIsIlNraW5JbnN0YW5jZSIsImdldERlZmF1bHRNYXRlcmlhbCIsImdldEFwcGxpY2F0aW9uIiwiZ3JhcGhpY3NEZXZpY2UiLCJzaXplIiwiaW5kZXgiLCJfcHJlZmlsdGVyZWRDdWJlbWFwcyIsInZhbHVlIiwidXBkYXRlU2hhZGVycyIsIl9tb2RlbHMiLCJfdXBkYXRlU2t5Ym94IiwiZGV2aWNlIiwiX3VwZGF0ZVNreSIsImFkZE1vZGVsIiwibW9kZWwiLCJjb250YWluc01vZGVsIiwibGF5ZXIiLCJsYXllcnMiLCJnZXRMYXllckJ5SWQiLCJMQVlFUklEX1dPUkxEIiwiYWRkTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZXMiLCJtb2RlbHMiLCJwdXNoIiwiYWRkU2hhZG93Q2FzdGVyIiwiYWRkU2hhZG93Q2FzdGVycyIsInJlbW92ZU1vZGVsIiwiaW5kZXhPZiIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJzcGxpY2UiLCJyZW1vdmVTaGFkb3dDYXN0ZXJzIiwiZ2V0TW9kZWxzIiwiQmF0Y2giLCJyZW5kZXJDb21wb3NpdGlvbiIsImNvbXAiLCJ1cGRhdGVTaGFkZXIiLCJtZXNoSW5zdGFuY2UiLCJvYmpEZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsIm1hdGVyaWFsIiwiX3NjZW5lIiwidXBkYXRlUGFzc1NoYWRlciIsInN5bmNBYWJiIiwiTW9ycGgiLCJnZXRUYXJnZXQiLCJ0YXJnZXRzIiwiX2RpcnRpZnkiLCJsb2NhbCIsIl9kaXJ0aWZ5TG9jYWwiLCJfZGlydGlmeVdvcmxkIiwiYWRkTGFiZWwiLCJsYWJlbCIsIl9sYWJlbHMiLCJnZXRMYWJlbHMiLCJoYXNMYWJlbCIsInJlbW92ZUxhYmVsIiwiZmluZEJ5TGFiZWwiLCJyZXN1bHRzIiwiaSIsIl9jaGlsZHJlbiIsImxlbmd0aCIsImdldENoaWxkcmVuIiwiY2hpbGRyZW4iLCJnZXROYW1lIiwiZ2V0UGF0aCIsInBhdGgiLCJnZXRSb290Iiwicm9vdCIsImdldFBhcmVudCIsInBhcmVudCIsInNldE5hbWUiLCJnZXRTaGFkZXIiLCJzZXRTaGFkZXIiLCJfZGVmaW5lQWxpYXMiLCJuZXdOYW1lIiwib2xkTmFtZSIsImFuaW0iLCJBbmltYXRpb24iLCJLZXkiLCJOb2RlIiwiU2tlbGV0b24iLCJnZXREdXJhdGlvbiIsImR1cmF0aW9uIiwiZ2V0Tm9kZXMiLCJub2RlcyIsInNldER1cmF0aW9uIiwiZ2V0QW5pbWF0aW9uIiwiYW5pbWF0aW9uIiwiZ2V0Q3VycmVudFRpbWUiLCJjdXJyZW50VGltZSIsImdldExvb3BpbmciLCJsb29waW5nIiwiZ2V0TnVtTm9kZXMiLCJudW1Ob2RlcyIsInNldEFuaW1hdGlvbiIsInNldEN1cnJlbnRUaW1lIiwic2V0TG9vcGluZyIsImF1ZGlvIiwiQXVkaW9NYW5hZ2VyIiwiU291bmRNYW5hZ2VyIiwiQ2hhbm5lbCIsIkNoYW5uZWwzZCIsIkxpc3RlbmVyIiwiU291bmQiLCJnZXRMaXN0ZW5lciIsImxpc3RlbmVyIiwiZ2V0Vm9sdW1lIiwidm9sdW1lIiwic2V0Vm9sdW1lIiwiYXNzZXQiLCJBU1NFVF9BTklNQVRJT04iLCJBU1NFVF9BVURJTyIsIkFTU0VUX0lNQUdFIiwiQVNTRVRfSlNPTiIsIkFTU0VUX01PREVMIiwiQVNTRVRfTUFURVJJQUwiLCJBU1NFVF9URVhUIiwiQVNTRVRfVEVYVFVSRSIsIkFTU0VUX0NVQkVNQVAiLCJBU1NFVF9TQ1JJUFQiLCJBc3NldFJlZ2lzdHJ5IiwiZ2V0QXNzZXRCeUlkIiwiaWQiLCJYcklucHV0U291cmNlIiwiX3JheUxvY2FsIiwiX2xvY2FsUG9zaXRpb24iLCJfbG9jYWxSb3RhdGlvbiIsImlucHV0IiwiZ2V0VG91Y2hUYXJnZXRDb29yZHMiLCJDb250cm9sbGVyIiwiR2FtZVBhZHMiLCJLZXlib2FyZCIsIktleWJvYXJkRXZlbnQiLCJNb3VzZSIsIk1vdXNlRXZlbnQiLCJUb3VjaCIsIlRvdWNoRGV2aWNlIiwiVG91Y2hFdmVudCIsIkVsZW1lbnRJbnB1dCIsIndoZWVsRGVsdGEiLCJSSUdJREJPRFlfVFlQRV9TVEFUSUMiLCJCT0RZVFlQRV9TVEFUSUMiLCJSSUdJREJPRFlfVFlQRV9EWU5BTUlDIiwiQk9EWVRZUEVfRFlOQU1JQyIsIlJJR0lEQk9EWV9UWVBFX0tJTkVNQVRJQyIsIkJPRFlUWVBFX0tJTkVNQVRJQyIsIlJJR0lEQk9EWV9DRl9TVEFUSUNfT0JKRUNUIiwiQk9EWUZMQUdfU1RBVElDX09CSkVDVCIsIlJJR0lEQk9EWV9DRl9LSU5FTUFUSUNfT0JKRUNUIiwiQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCIsIlJJR0lEQk9EWV9DRl9OT1JFU1BPTlNFX09CSkVDVCIsIkJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUIiwiUklHSURCT0RZX0FDVElWRV9UQUciLCJCT0RZU1RBVEVfQUNUSVZFX1RBRyIsIlJJR0lEQk9EWV9JU0xBTkRfU0xFRVBJTkciLCJCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HIiwiUklHSURCT0RZX1dBTlRTX0RFQUNUSVZBVElPTiIsIkJPRFlTVEFURV9XQU5UU19ERUFDVElWQVRJT04iLCJSSUdJREJPRFlfRElTQUJMRV9ERUFDVElWQVRJT04iLCJCT0RZU1RBVEVfRElTQUJMRV9ERUFDVElWQVRJT04iLCJSSUdJREJPRFlfRElTQUJMRV9TSU1VTEFUSU9OIiwiQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiIsImZ3IiwiQXBwbGljYXRpb24iLCJDb21wb25lbnQiLCJDb21wb25lbnRTeXN0ZW0iLCJFbnRpdHkiLCJGaWxsTW9kZSIsIk5PTkUiLCJGSUxMTU9ERV9OT05FIiwiRklMTF9XSU5ET1ciLCJGSUxMTU9ERV9GSUxMX1dJTkRPVyIsIktFRVBfQVNQRUNUIiwiRklMTE1PREVfS0VFUF9BU1BFQ1QiLCJSZXNvbHV0aW9uTW9kZSIsIkFVVE8iLCJSRVNPTFVUSU9OX0FVVE8iLCJGSVhFRCIsIlJFU09MVVRJT05fRklYRUQiLCJpc0Z1bGxzY3JlZW4iLCJkb2N1bWVudCIsImZ1bGxzY3JlZW5FbGVtZW50IiwiZW5hYmxlRnVsbHNjcmVlbiIsImVsZW1lbnQiLCJzdWNjZXNzIiwiY2FudmFzIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImUiLCJhZGRFdmVudExpc3RlbmVyIiwicmVxdWVzdEZ1bGxzY3JlZW4iLCJFbGVtZW50IiwiQUxMT1dfS0VZQk9BUkRfSU5QVVQiLCJkaXNhYmxlRnVsbHNjcmVlbiIsImV4aXRGdWxsc2NyZWVuIiwiZ2V0U2NlbmVVcmwiLCJlbnRyeSIsInNjZW5lcyIsImZpbmQiLCJ1cmwiLCJsb2FkU2NlbmUiLCJjYWxsYmFjayIsImxvYWRTY2VuZUhpZXJhcmNoeSIsImxvYWRTY2VuZVNldHRpbmdzIiwicmVuZGVyTWVzaEluc3RhbmNlIiwib3B0aW9ucyIsImRlZmF1bHREcmF3TGF5ZXIiLCJpbW1lZGlhdGUiLCJkcmF3TWVzaCIsInJlbmRlck1lc2giLCJtZXNoIiwibWF0cml4IiwiX2FkZExpbmVzIiwicG9zaXRpb25zIiwiY29sb3JzIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJkZXB0aFRlc3QiLCJ1bmRlZmluZWQiLCJiYXRjaCIsImdldEJhdGNoIiwiYWRkTGluZXMiLCJyZW5kZXJMaW5lIiwic3RhcnQiLCJjb2xvciIsImVuZENvbG9yIiwiYXJndW1lbnRzIiwiTElORUJBVENIX09WRVJMQVkiLCJyZW5kZXJMaW5lcyIsInBvc2l0aW9uIiwibXVsdGlDb2xvciIsImVuYWJsZVZyIiwiQ2FtZXJhQ29tcG9uZW50IiwiZW50aXR5IiwiTGlnaHRDb21wb25lbnQiLCJlbmFibGVkIiwiTW9kZWxDb21wb25lbnQiLCJzZXRWaXNpYmxlIiwidmlzaWJsZSIsIlJlbmRlckNvbXBvbmVudCIsIlJpZ2lkQm9keUNvbXBvbmVudCIsInN5bmNCb2R5VG9FbnRpdHkiLCJfdXBkYXRlRHluYW1pYyIsIlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSIsInNldEdyYXZpdHkiLCJncmF2aXR5IiwiY29weSIsImJhc2lzU2V0RG93bmxvYWRDb25maWciLCJnbHVlVXJsIiwid2FzbVVybCIsImZhbGxiYWNrVXJsIiwiYmFzaXNJbml0aWFsaXplIiwibGF6eUluaXQiLCJwcmVmaWx0ZXJDdWJlbWFwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1SE8sTUFBTUEsR0FBRyxHQUFHO0VBQ2ZDLEtBQUssRUFBRSxVQUFVQyxJQUFJLEVBQUU7QUFDbkJDLElBQUFBLEtBQUssQ0FBQ0MsVUFBVSxDQUFDLHNEQUFz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
