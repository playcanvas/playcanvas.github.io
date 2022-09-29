/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { version, revision } from '../core/core.js';
import { string } from '../core/string.js';
import { now, Timer } from '../core/time.js';
import { Debug } from '../core/debug.js';
import { math } from '../math/math.js';
import { Color } from '../math/color.js';
import { Mat4 } from '../math/mat4.js';
import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';
import { BoundingBox } from '../shape/bounding-box.js';
import { BoundingSphere } from '../shape/bounding-sphere.js';
import { Frustum } from '../shape/frustum.js';
import { Plane } from '../shape/plane.js';
import { TYPE_INT8, TYPE_UINT8, TYPE_INT16, TYPE_UINT16, TYPE_INT32, TYPE_UINT32, TYPE_FLOAT32, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BLENDMODE_ZERO, BLENDMODE_ONE, BLENDMODE_SRC_COLOR, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_DST_COLOR, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_ALPHA, BUFFER_STATIC, BUFFER_DYNAMIC, BUFFER_STREAM, CULLFACE_NONE, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PRIMITIVE_POINTS, PRIMITIVE_LINES, PRIMITIVE_LINELOOP, PRIMITIVE_LINESTRIP, PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_COLOR, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR2, SEMANTIC_ATTR3, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTURETYPE_RGBM, TEXTURETYPE_DEFAULT, TEXTURETYPE_SWIZZLEGGGR } from '../graphics/constants.js';
import { begin, dummyFragmentCode, end, fogCode, gammaCode, precisionCode, skinCode, tonemapCode, versionCode } from '../graphics/program-lib/programs/common.js';
import { drawQuadWithShader } from '../graphics/simple-post-effect.js';
import { shaderChunks } from '../graphics/program-lib/chunks/chunks.js';
import { GraphicsDevice } from '../graphics/graphics-device.js';
import { IndexBuffer } from '../graphics/index-buffer.js';
import { createFullscreenQuad, drawFullscreenQuad, PostEffect } from '../graphics/post-effect.js';
import { PostEffectQueue } from '../framework/components/camera/post-effect-queue.js';
import { ProgramLibrary } from '../graphics/program-library.js';
import { RenderTarget } from '../graphics/render-target.js';
import { ScopeId } from '../graphics/scope-id.js';
import { Shader } from '../graphics/shader.js';
import { ShaderInput } from '../graphics/shader-input.js';
import { Texture } from '../graphics/texture.js';
import { VertexBuffer } from '../graphics/vertex-buffer.js';
import { VertexFormat } from '../graphics/vertex-format.js';
import { VertexIterator } from '../graphics/vertex-iterator.js';
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
import { Picker } from '../scene/picker.js';
import { Scene } from '../scene/scene.js';
import { Skin } from '../scene/skin.js';
import { SkinInstance } from '../scene/skin-instance.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { Batch } from '../scene/batching/batch.js';
import { getDefaultMaterial } from '../scene/materials/default-material.js';
import { Animation, Key, Node } from '../animation/animation.js';
import { Skeleton } from '../animation/skeleton.js';
import { Channel } from '../audio/channel.js';
import { Channel3d } from '../audio/channel3d.js';
import { Listener } from '../sound/listener.js';
import { Sound } from '../sound/sound.js';
import { SoundManager } from '../sound/manager.js';
import { AssetRegistry } from '../asset/asset-registry.js';
import { XrInputSource } from '../xr/xr-input-source.js';
import { Controller } from '../input/controller.js';
import { ElementInput } from '../input/element-input.js';
import { GamePads } from '../input/game-pads.js';
import { Keyboard } from '../input/keyboard.js';
import { KeyboardEvent } from '../input/keyboard-event.js';
import { Mouse } from '../input/mouse.js';
import { MouseEvent } from '../input/mouse-event.js';
import { TouchDevice } from '../input/touch-device.js';
import { getTouchTargetCoords, Touch, TouchEvent } from '../input/touch-event.js';
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
import { basisInitialize } from '../resources/basis.js';

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
  dummyFragmentCode: dummyFragmentCode,
  end: end,
  fogCode: fogCode,
  gammaCode: gammaCode,
  precisionCode: precisionCode,
  skinCode: skinCode,
  tonemapCode: tonemapCode,
  versionCode: versionCode
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwcmVjYXRlZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2RlcHJlY2F0ZWQvZGVwcmVjYXRlZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZXZpc2lvbiwgdmVyc2lvbiB9IGZyb20gJy4uL2NvcmUvY29yZS5qcyc7XG5pbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuLi9jb3JlL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBUaW1lciwgbm93IH0gZnJvbSAnLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBCb3VuZGluZ0JveCB9IGZyb20gJy4uL3NoYXBlL2JvdW5kaW5nLWJveC5qcyc7XG5pbXBvcnQgeyBCb3VuZGluZ1NwaGVyZSB9IGZyb20gJy4uL3NoYXBlL2JvdW5kaW5nLXNwaGVyZS5qcyc7XG5pbXBvcnQgeyBGcnVzdHVtIH0gZnJvbSAnLi4vc2hhcGUvZnJ1c3R1bS5qcyc7XG5pbXBvcnQgeyBQbGFuZSB9IGZyb20gJy4uL3NoYXBlL3BsYW5lLmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsIEFERFJFU1NfTUlSUk9SRURfUkVQRUFULCBBRERSRVNTX1JFUEVBVCxcbiAgICBCTEVORE1PREVfWkVSTywgQkxFTkRNT0RFX09ORSwgQkxFTkRNT0RFX1NSQ19DT0xPUiwgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1IsXG4gICAgQkxFTkRNT0RFX0RTVF9DT0xPUiwgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1IsIEJMRU5ETU9ERV9TUkNfQUxQSEEsIEJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEUsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEsIEJMRU5ETU9ERV9EU1RfQUxQSEEsIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBLFxuICAgIEJVRkZFUl9TVEFUSUMsIEJVRkZFUl9EWU5BTUlDLCBCVUZGRVJfU1RSRUFNLFxuICAgIENVTExGQUNFX05PTkUsIENVTExGQUNFX0JBQ0ssIENVTExGQUNFX0ZST05ULCBDVUxMRkFDRV9GUk9OVEFOREJBQ0ssXG4gICAgRklMVEVSX05FQVJFU1QsIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNULCBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSLFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1QsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBJTkRFWEZPUk1BVF9VSU5UOCwgSU5ERVhGT1JNQVRfVUlOVDE2LCBJTkRFWEZPUk1BVF9VSU5UMzIsXG4gICAgUElYRUxGT1JNQVRfUjVfRzZfQjUsIFBJWEVMRk9STUFUX1I4X0c4X0I4LCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCxcbiAgICBQUklNSVRJVkVfUE9JTlRTLCBQUklNSVRJVkVfTElORVMsIFBSSU1JVElWRV9MSU5FTE9PUCwgUFJJTUlUSVZFX0xJTkVTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJQU5HTEVTLCBQUklNSVRJVkVfVFJJU1RSSVAsIFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfQ09MT1IsIFNFTUFOVElDX1RFWENPT1JELCBTRU1BTlRJQ19URVhDT09SRDAsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQxLCBTRU1BTlRJQ19BVFRSMCwgU0VNQU5USUNfQVRUUjEsIFNFTUFOVElDX0FUVFIyLCBTRU1BTlRJQ19BVFRSMyxcbiAgICBURVhUVVJFTE9DS19SRUFELCBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNLCBURVhUVVJFVFlQRV9TV0laWkxFR0dHUixcbiAgICBUWVBFX0lOVDgsIFRZUEVfVUlOVDgsIFRZUEVfSU5UMTYsIFRZUEVfVUlOVDE2LCBUWVBFX0lOVDMyLCBUWVBFX1VJTlQzMiwgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBiZWdpbiwgZHVtbXlGcmFnbWVudENvZGUsIGVuZCwgZm9nQ29kZSwgZ2FtbWFDb2RlLCBwcmVjaXNpb25Db2RlLCBza2luQ29kZSwgdG9uZW1hcENvZGUsIHZlcnNpb25Db2RlIH0gZnJvbSAnLi4vZ3JhcGhpY3MvcHJvZ3JhbS1saWIvcHJvZ3JhbXMvY29tbW9uLmpzJztcbmltcG9ydCB7IGRyYXdRdWFkV2l0aFNoYWRlciB9IGZyb20gJy4uL2dyYXBoaWNzL3NpbXBsZS1wb3N0LWVmZmVjdC5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuLi9ncmFwaGljcy9wcm9ncmFtLWxpYi9jaHVua3MvY2h1bmtzLmpzJztcbmltcG9ydCB7IEdyYXBoaWNzRGV2aWNlIH0gZnJvbSAnLi4vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJztcbmltcG9ydCB7IEluZGV4QnVmZmVyIH0gZnJvbSAnLi4vZ3JhcGhpY3MvaW5kZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IGNyZWF0ZUZ1bGxzY3JlZW5RdWFkLCBkcmF3RnVsbHNjcmVlblF1YWQsIFBvc3RFZmZlY3QgfSBmcm9tICcuLi9ncmFwaGljcy9wb3N0LWVmZmVjdC5qcyc7XG5pbXBvcnQgeyBQb3N0RWZmZWN0UXVldWUgfSBmcm9tICcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvcG9zdC1lZmZlY3QtcXVldWUuanMnO1xuaW1wb3J0IHsgUHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9ncmFwaGljcy9wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgUmVuZGVyVGFyZ2V0IH0gZnJvbSAnLi4vZ3JhcGhpY3MvcmVuZGVyLXRhcmdldC5qcyc7XG5pbXBvcnQgeyBTY29wZUlkIH0gZnJvbSAnLi4vZ3JhcGhpY3Mvc2NvcGUtaWQuanMnO1xuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSAnLi4vZ3JhcGhpY3Mvc2hhZGVyLmpzJztcbmltcG9ydCB7IFNoYWRlcklucHV0IH0gZnJvbSAnLi4vZ3JhcGhpY3Mvc2hhZGVyLWlucHV0LmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IFZlcnRleEJ1ZmZlciB9IGZyb20gJy4uL2dyYXBoaWNzL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgVmVydGV4Rm9ybWF0IH0gZnJvbSAnLi4vZ3JhcGhpY3MvdmVydGV4LWZvcm1hdC5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhJdGVyYXRvciB9IGZyb20gJy4uL2dyYXBoaWNzL3ZlcnRleC1pdGVyYXRvci5qcyc7XG5cbmltcG9ydCB7IFBST0pFQ1RJT05fT1JUSE9HUkFQSElDLCBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFLCBMQVlFUklEX0lNTUVESUFURSwgTElORUJBVENIX09WRVJMQVksIExBWUVSSURfV09STEQgfSBmcm9tICcuLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgY2FsY3VsYXRlVGFuZ2VudHMsIGNyZWF0ZUJveCwgY3JlYXRlQ2Fwc3VsZSwgY3JlYXRlQ29uZSwgY3JlYXRlQ3lsaW5kZXIsIGNyZWF0ZU1lc2gsIGNyZWF0ZVBsYW5lLCBjcmVhdGVTcGhlcmUsIGNyZWF0ZVRvcnVzIH0gZnJvbSAnLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBwYXJ0aXRpb25Ta2luIH0gZnJvbSAnLi4vc2NlbmUvc2tpbi1wYXJ0aXRpb24uanMnO1xuaW1wb3J0IHsgQmFzaWNNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9iYXNpYy1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBGb3J3YXJkUmVuZGVyZXIgfSBmcm9tICcuLi9zY2VuZS9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uL3NjZW5lL21lc2guanMnO1xuaW1wb3J0IHsgTW9ycGggfSBmcm9tICcuLi9zY2VuZS9tb3JwaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UsIENvbW1hbmQgfSBmcm9tICcuLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgUGFydGljbGVFbWl0dGVyIH0gZnJvbSAnLi4vc2NlbmUvcGFydGljbGUtc3lzdGVtL3BhcnRpY2xlLWVtaXR0ZXIuanMnO1xuaW1wb3J0IHsgUGlja2VyIH0gZnJvbSAnLi4vc2NlbmUvcGlja2VyLmpzJztcbmltcG9ydCB7IFNjZW5lIH0gZnJvbSAnLi4vc2NlbmUvc2NlbmUuanMnO1xuaW1wb3J0IHsgU2tpbiB9IGZyb20gJy4uL3NjZW5lL3NraW4uanMnO1xuaW1wb3J0IHsgU2tpbkluc3RhbmNlIH0gZnJvbSAnLi4vc2NlbmUvc2tpbi1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLmpzJztcbmltcG9ydCB7IEJhdGNoIH0gZnJvbSAnLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2guanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL2RlZmF1bHQtbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQgeyBBbmltYXRpb24sIEtleSwgTm9kZSB9IGZyb20gJy4uL2FuaW1hdGlvbi9hbmltYXRpb24uanMnO1xuaW1wb3J0IHsgU2tlbGV0b24gfSBmcm9tICcuLi9hbmltYXRpb24vc2tlbGV0b24uanMnO1xuXG5pbXBvcnQgeyBDaGFubmVsIH0gZnJvbSAnLi4vYXVkaW8vY2hhbm5lbC5qcyc7XG5pbXBvcnQgeyBDaGFubmVsM2QgfSBmcm9tICcuLi9hdWRpby9jaGFubmVsM2QuanMnO1xuaW1wb3J0IHsgTGlzdGVuZXIgfSBmcm9tICcuLi9zb3VuZC9saXN0ZW5lci5qcyc7XG5pbXBvcnQgeyBTb3VuZCB9IGZyb20gJy4uL3NvdW5kL3NvdW5kLmpzJztcbmltcG9ydCB7IFNvdW5kTWFuYWdlciB9IGZyb20gJy4uL3NvdW5kL21hbmFnZXIuanMnO1xuXG5pbXBvcnQgeyBBc3NldFJlZ2lzdHJ5IH0gZnJvbSAnLi4vYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMnO1xuXG5pbXBvcnQgeyBYcklucHV0U291cmNlIH0gZnJvbSAnLi4veHIveHItaW5wdXQtc291cmNlLmpzJztcblxuaW1wb3J0IHsgQ29udHJvbGxlciB9IGZyb20gJy4uL2lucHV0L2NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgRWxlbWVudElucHV0IH0gZnJvbSAnLi4vaW5wdXQvZWxlbWVudC1pbnB1dC5qcyc7XG5pbXBvcnQgeyBHYW1lUGFkcyB9IGZyb20gJy4uL2lucHV0L2dhbWUtcGFkcy5qcyc7XG5pbXBvcnQgeyBLZXlib2FyZCB9IGZyb20gJy4uL2lucHV0L2tleWJvYXJkLmpzJztcbmltcG9ydCB7IEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi9pbnB1dC9rZXlib2FyZC1ldmVudC5qcyc7XG5pbXBvcnQgeyBNb3VzZSB9IGZyb20gJy4uL2lucHV0L21vdXNlLmpzJztcbmltcG9ydCB7IE1vdXNlRXZlbnQgfSBmcm9tICcuLi9pbnB1dC9tb3VzZS1ldmVudC5qcyc7XG5pbXBvcnQgeyBUb3VjaERldmljZSB9IGZyb20gJy4uL2lucHV0L3RvdWNoLWRldmljZS5qcyc7XG5pbXBvcnQgeyBnZXRUb3VjaFRhcmdldENvb3JkcywgVG91Y2gsIFRvdWNoRXZlbnQgfSBmcm9tICcuLi9pbnB1dC90b3VjaC1ldmVudC5qcyc7XG5cbmltcG9ydCB7IEZJTExNT0RFX0ZJTExfV0lORE9XLCBGSUxMTU9ERV9LRUVQX0FTUEVDVCwgRklMTE1PREVfTk9ORSwgUkVTT0xVVElPTl9BVVRPLCBSRVNPTFVUSU9OX0ZJWEVEIH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBBcHBsaWNhdGlvbiB9IGZyb20gJy4uL2ZyYW1ld29yay9hcHBsaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRBcHBsaWNhdGlvbiB9IGZyb20gJy4uL2ZyYW1ld29yay9nbG9iYWxzLmpzJztcbmltcG9ydCB7IENhbWVyYUNvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnO1xuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL3N5c3RlbS5qcyc7XG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuLi9mcmFtZXdvcmsvZW50aXR5LmpzJztcbmltcG9ydCB7IExpZ2h0Q29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvbGlnaHQvY29tcG9uZW50LmpzJztcbmltcG9ydCB7IE1vZGVsQ29tcG9uZW50IH0gZnJvbSAnLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvbW9kZWwvY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFJlbmRlckNvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL3JlbmRlci9jb21wb25lbnQuanMnO1xuaW1wb3J0IHtcbiAgICBCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNULCBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCwgQk9EWUZMQUdfU1RBVElDX09CSkVDVCxcbiAgICBCT0RZU1RBVEVfQUNUSVZFX1RBRywgQk9EWVNUQVRFX0RJU0FCTEVfREVBQ1RJVkFUSU9OLCBCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OLCBCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HLCBCT0RZU1RBVEVfV0FOVFNfREVBQ1RJVkFUSU9OLFxuICAgIEJPRFlUWVBFX0RZTkFNSUMsIEJPRFlUWVBFX0tJTkVNQVRJQywgQk9EWVRZUEVfU1RBVElDXG59IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL3JpZ2lkLWJvZHkvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudCB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL3JpZ2lkLWJvZHkvY29tcG9uZW50LmpzJztcbmltcG9ydCB7IFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL2ZyYW1ld29yay9jb21wb25lbnRzL3JpZ2lkLWJvZHkvc3lzdGVtLmpzJztcbmltcG9ydCB7IGJhc2lzSW5pdGlhbGl6ZSB9IGZyb20gJy4uL3Jlc291cmNlcy9iYXNpcy5qcyc7XG5cbi8vIENPUkVcblxuZXhwb3J0IGNvbnN0IGxvZyA9IHtcbiAgICB3cml0ZTogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLndyaXRlIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLmxvZyBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLmxvZyh0ZXh0KTtcbiAgICB9LFxuXG4gICAgb3BlbjogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cub3BlbiBpcyBkZXByZWNhdGVkLiBVc2UgY29uc29sZS5sb2cgaW5zdGVhZC4nKTtcbiAgICAgICAgbG9nLndyaXRlKCdQb3dlcmVkIGJ5IFBsYXlDYW52YXMgJyArIHZlcnNpb24gKyAnICcgKyByZXZpc2lvbik7XG4gICAgfSxcblxuICAgIGluZm86IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5pbmZvIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLmluZm8gaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS5pbmZvKCdJTkZPOiAgICAnICsgdGV4dCk7XG4gICAgfSxcblxuICAgIGRlYnVnOiBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuZGVidWcgaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUuZGVidWcgaW5zdGVhZC4nKTtcbiAgICAgICAgY29uc29sZS5kZWJ1ZygnREVCVUc6ICAgJyArIHRleHQpO1xuICAgIH0sXG5cbiAgICBlcnJvcjogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLmVycm9yIGlzIGRlcHJlY2F0ZWQuIFVzZSBjb25zb2xlLmVycm9yIGluc3RlYWQuJyk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0VSUk9SOiAgICcgKyB0ZXh0KTtcbiAgICB9LFxuXG4gICAgd2FybmluZzogZnVuY3Rpb24gKHRleHQpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMubG9nLndhcm5pbmcgaXMgZGVwcmVjYXRlZC4gVXNlIGNvbnNvbGUud2FybiBpbnN0ZWFkLicpO1xuICAgICAgICBjb25zb2xlLndhcm4oJ1dBUk5JTkc6ICcgKyB0ZXh0KTtcbiAgICB9LFxuXG4gICAgYWxlcnQ6IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmxvZy5hbGVydCBpcyBkZXByZWNhdGVkLiBVc2UgYWxlcnQgaW5zdGVhZC4nKTtcbiAgICAgICAgbG9nLndyaXRlKCdBTEVSVDogICAnICsgdGV4dCk7XG4gICAgICAgIGFsZXJ0KHRleHQpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWFsZXJ0XG4gICAgfSxcblxuICAgIGFzc2VydDogZnVuY3Rpb24gKGNvbmRpdGlvbiwgdGV4dCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5sb2cuYXNzZXJ0IGlzIGRlcHJlY2F0ZWQuIFVzZSBhIGNvbmRpdGlvbmFsIHBsdXMgY29uc29sZS5sb2cgaW5zdGVhZC4nKTtcbiAgICAgICAgaWYgKGNvbmRpdGlvbiA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIGxvZy53cml0ZSgnQVNTRVJUOiAgJyArIHRleHQpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuc3RyaW5nLmVuZHNXaXRoID0gZnVuY3Rpb24gKHMsIHN1YnMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5zdHJpbmcuZW5kc1dpdGggaXMgZGVwcmVjYXRlZC4gVXNlIFN0cmluZyNlbmRzV2l0aCBpbnN0ZWFkLicpO1xuICAgIHJldHVybiBzLmVuZHNXaXRoKHN1YnMpO1xufTtcblxuc3RyaW5nLnN0YXJ0c1dpdGggPSBmdW5jdGlvbiAocywgc3Vicykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLnN0cmluZy5zdGFydHNXaXRoIGlzIGRlcHJlY2F0ZWQuIFVzZSBTdHJpbmcjc3RhcnRzV2l0aCBpbnN0ZWFkLicpO1xuICAgIHJldHVybiBzLnN0YXJ0c1dpdGgoc3Vicyk7XG59O1xuXG5leHBvcnQgY29uc3QgdGltZSA9IHtcbiAgICBub3c6IG5vdyxcbiAgICBUaW1lcjogVGltZXJcbn07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb2xvci5wcm90b3R5cGUsICdkYXRhJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Db2xvciNkYXRhIGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIEFjY2VzcyBjb2xvciBjb21wb25lbnRzIHZpYSB0aGVpciBpbmRpdmlkdWFsIHByb3BlcnRpZXMuJyk7XG4gICAgICAgIGlmICghdGhpcy5fZGF0YSkge1xuICAgICAgICAgICAgdGhpcy5fZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YVswXSA9IHRoaXMucjtcbiAgICAgICAgdGhpcy5fZGF0YVsxXSA9IHRoaXMuZztcbiAgICAgICAgdGhpcy5fZGF0YVsyXSA9IHRoaXMuYjtcbiAgICAgICAgdGhpcy5fZGF0YVszXSA9IHRoaXMuYTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGE7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb2xvci5wcm90b3R5cGUsICdkYXRhMycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQ29sb3IjZGF0YTMgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIGNvbG9yIGNvbXBvbmVudHMgdmlhIHRoZWlyIGluZGl2aWR1YWwgcHJvcGVydGllcy4nKTtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhMykge1xuICAgICAgICAgICAgdGhpcy5fZGF0YTMgPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2RhdGEzWzBdID0gdGhpcy5yO1xuICAgICAgICB0aGlzLl9kYXRhM1sxXSA9IHRoaXMuZztcbiAgICAgICAgdGhpcy5fZGF0YTNbMl0gPSB0aGlzLmI7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhMztcbiAgICB9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGluaGVyaXRzKFNlbGYsIFN1cGVyKSB7XG4gICAgY29uc3QgVGVtcCA9IGZ1bmN0aW9uICgpIHt9O1xuICAgIGNvbnN0IEZ1bmMgPSBmdW5jdGlvbiAoYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCkge1xuICAgICAgICBTdXBlci5jYWxsKHRoaXMsIGFyZzEsIGFyZzIsIGFyZzMsIGFyZzQsIGFyZzUsIGFyZzYsIGFyZzcsIGFyZzgpO1xuICAgICAgICBTZWxmLmNhbGwodGhpcywgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCk7XG4gICAgICAgIC8vIHRoaXMuY29uc3RydWN0b3IgPSBTZWxmO1xuICAgIH07XG4gICAgRnVuYy5fc3VwZXIgPSBTdXBlci5wcm90b3R5cGU7XG4gICAgVGVtcC5wcm90b3R5cGUgPSBTdXBlci5wcm90b3R5cGU7XG4gICAgRnVuYy5wcm90b3R5cGUgPSBuZXcgVGVtcCgpO1xuXG4gICAgcmV0dXJuIEZ1bmM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlQXJyYXkoYXJyKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMubWFrZUFycmF5IGlzIG5vdCBwdWJsaWMgQVBJIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuIFVzZSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCBpbnN0ZWFkLicpO1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcnIpO1xufVxuXG4vLyBNQVRIXG5cbm1hdGguSU5WX0xPRzIgPSBNYXRoLkxPRzJFO1xuXG5tYXRoLmludFRvQnl0ZXMgPSBtYXRoLmludFRvQnl0ZXMzMjtcbm1hdGguYnl0ZXNUb0ludCA9IG1hdGguYnl0ZXNUb0ludDMyO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVmVjMi5wcm90b3R5cGUsICdkYXRhJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5WZWMyI2RhdGEgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIHZlY3RvciBjb21wb25lbnRzIHZpYSB0aGVpciBpbmRpdmlkdWFsIHByb3BlcnRpZXMuJyk7XG4gICAgICAgIGlmICghdGhpcy5fZGF0YSkge1xuICAgICAgICAgICAgdGhpcy5fZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YVswXSA9IHRoaXMueDtcbiAgICAgICAgdGhpcy5fZGF0YVsxXSA9IHRoaXMueTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGE7XG4gICAgfVxufSk7XG5cblZlYzIucHJvdG90eXBlLnNjYWxlID0gVmVjMi5wcm90b3R5cGUubXVsU2NhbGFyO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVmVjMy5wcm90b3R5cGUsICdkYXRhJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5WZWMzI2RhdGEgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIHZlY3RvciBjb21wb25lbnRzIHZpYSB0aGVpciBpbmRpdmlkdWFsIHByb3BlcnRpZXMuJyk7XG4gICAgICAgIGlmICghdGhpcy5fZGF0YSkge1xuICAgICAgICAgICAgdGhpcy5fZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YVswXSA9IHRoaXMueDtcbiAgICAgICAgdGhpcy5fZGF0YVsxXSA9IHRoaXMueTtcbiAgICAgICAgdGhpcy5fZGF0YVsyXSA9IHRoaXMuejtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGE7XG4gICAgfVxufSk7XG5cblZlYzMucHJvdG90eXBlLnNjYWxlID0gVmVjMy5wcm90b3R5cGUubXVsU2NhbGFyO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVmVjNC5wcm90b3R5cGUsICdkYXRhJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5WZWM0I2RhdGEgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4gQWNjZXNzIHZlY3RvciBjb21wb25lbnRzIHZpYSB0aGVpciBpbmRpdmlkdWFsIHByb3BlcnRpZXMuJyk7XG4gICAgICAgIGlmICghdGhpcy5fZGF0YSkge1xuICAgICAgICAgICAgdGhpcy5fZGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZGF0YVswXSA9IHRoaXMueDtcbiAgICAgICAgdGhpcy5fZGF0YVsxXSA9IHRoaXMueTtcbiAgICAgICAgdGhpcy5fZGF0YVsyXSA9IHRoaXMuejtcbiAgICAgICAgdGhpcy5fZGF0YVszXSA9IHRoaXMudztcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RhdGE7XG4gICAgfVxufSk7XG5cblZlYzQucHJvdG90eXBlLnNjYWxlID0gVmVjNC5wcm90b3R5cGUubXVsU2NhbGFyO1xuXG4vLyBTSEFQRVxuXG5leHBvcnQgY29uc3Qgc2hhcGUgPSB7XG4gICAgQWFiYjogQm91bmRpbmdCb3gsXG4gICAgU3BoZXJlOiBCb3VuZGluZ1NwaGVyZSxcbiAgICBQbGFuZTogUGxhbmVcbn07XG5cbkJvdW5kaW5nU3BoZXJlLnByb3RvdHlwZS5pbnRlcnNlY3RSYXkgPSBCb3VuZGluZ1NwaGVyZS5wcm90b3R5cGUuaW50ZXJzZWN0c1JheTtcblxuRnJ1c3R1bS5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24gKHByb2plY3Rpb25NYXRyaXgsIHZpZXdNYXRyaXgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5GcnVzdHVtI3VwZGF0ZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuRnJ1c3R1bSNzZXRGcm9tTWF0NCBpbnN0ZWFkLicpO1xuXG4gICAgY29uc3Qgdmlld1Byb2ogPSBuZXcgTWF0NCgpO1xuXG4gICAgdmlld1Byb2oubXVsMihwcm9qZWN0aW9uTWF0cml4LCB2aWV3TWF0cml4KTtcblxuICAgIHRoaXMuc2V0RnJvbU1hdDQodmlld1Byb2opO1xufTtcblxuLy8gR1JBUEhJQ1NcblxuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX0lOVDggPSBUWVBFX0lOVDg7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfVUlOVDggPSBUWVBFX1VJTlQ4O1xuZXhwb3J0IGNvbnN0IEVMRU1FTlRUWVBFX0lOVDE2ID0gVFlQRV9JTlQxNjtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9VSU5UMTYgPSBUWVBFX1VJTlQxNjtcbmV4cG9ydCBjb25zdCBFTEVNRU5UVFlQRV9JTlQzMiA9IFRZUEVfSU5UMzI7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfVUlOVDMyID0gVFlQRV9VSU5UMzI7XG5leHBvcnQgY29uc3QgRUxFTUVOVFRZUEVfRkxPQVQzMiA9IFRZUEVfRkxPQVQzMjtcblxuZXhwb3J0IGZ1bmN0aW9uIFVuc3VwcG9ydGVkQnJvd3NlckVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm5hbWUgPSAnVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3InO1xuICAgIHRoaXMubWVzc2FnZSA9IChtZXNzYWdlIHx8ICcnKTtcbn1cblVuc3VwcG9ydGVkQnJvd3NlckVycm9yLnByb3RvdHlwZSA9IEVycm9yLnByb3RvdHlwZTtcblxuZXhwb3J0IGZ1bmN0aW9uIENvbnRleHRDcmVhdGlvbkVycm9yKG1lc3NhZ2UpIHtcbiAgICB0aGlzLm5hbWUgPSAnQ29udGV4dENyZWF0aW9uRXJyb3InO1xuICAgIHRoaXMubWVzc2FnZSA9IChtZXNzYWdlIHx8ICcnKTtcbn1cbkNvbnRleHRDcmVhdGlvbkVycm9yLnByb3RvdHlwZSA9IEVycm9yLnByb3RvdHlwZTtcblxuZXhwb3J0IGNvbnN0IHByb2dyYW1saWIgPSB7XG4gICAgYmVnaW46IGJlZ2luLFxuICAgIGR1bW15RnJhZ21lbnRDb2RlOiBkdW1teUZyYWdtZW50Q29kZSxcbiAgICBlbmQ6IGVuZCxcbiAgICBmb2dDb2RlOiBmb2dDb2RlLFxuICAgIGdhbW1hQ29kZTogZ2FtbWFDb2RlLFxuICAgIHByZWNpc2lvbkNvZGU6IHByZWNpc2lvbkNvZGUsXG4gICAgc2tpbkNvZGU6IHNraW5Db2RlLFxuICAgIHRvbmVtYXBDb2RlOiB0b25lbWFwQ29kZSxcbiAgICB2ZXJzaW9uQ29kZTogdmVyc2lvbkNvZGVcbn07XG5cbmV4cG9ydCBjb25zdCBnZnggPSB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgQUREUkVTU19NSVJST1JFRF9SRVBFQVQ6IEFERFJFU1NfTUlSUk9SRURfUkVQRUFULFxuICAgIEFERFJFU1NfUkVQRUFUOiBBRERSRVNTX1JFUEVBVCxcbiAgICBCTEVORE1PREVfWkVSTzogQkxFTkRNT0RFX1pFUk8sXG4gICAgQkxFTkRNT0RFX09ORTogQkxFTkRNT0RFX09ORSxcbiAgICBCTEVORE1PREVfU1JDX0NPTE9SOiBCTEVORE1PREVfU1JDX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SOiBCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUixcbiAgICBCTEVORE1PREVfRFNUX0NPTE9SOiBCTEVORE1PREVfRFNUX0NPTE9SLFxuICAgIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SOiBCTEVORE1PREVfT05FX01JTlVTX0RTVF9DT0xPUixcbiAgICBCTEVORE1PREVfU1JDX0FMUEhBOiBCTEVORE1PREVfU1JDX0FMUEhBLFxuICAgIEJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEU6IEJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEUsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEE6IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBLFxuICAgIEJMRU5ETU9ERV9EU1RfQUxQSEE6IEJMRU5ETU9ERV9EU1RfQUxQSEEsXG4gICAgQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQUxQSEE6IEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBLFxuICAgIEJVRkZFUl9TVEFUSUM6IEJVRkZFUl9TVEFUSUMsXG4gICAgQlVGRkVSX0RZTkFNSUM6IEJVRkZFUl9EWU5BTUlDLFxuICAgIEJVRkZFUl9TVFJFQU06IEJVRkZFUl9TVFJFQU0sXG4gICAgQ1VMTEZBQ0VfTk9ORTogQ1VMTEZBQ0VfTk9ORSxcbiAgICBDVUxMRkFDRV9CQUNLOiBDVUxMRkFDRV9CQUNLLFxuICAgIENVTExGQUNFX0ZST05UOiBDVUxMRkFDRV9GUk9OVCxcbiAgICBDVUxMRkFDRV9GUk9OVEFOREJBQ0s6IENVTExGQUNFX0ZST05UQU5EQkFDSyxcbiAgICBFTEVNRU5UVFlQRV9JTlQ4OiBUWVBFX0lOVDgsXG4gICAgRUxFTUVOVFRZUEVfVUlOVDg6IFRZUEVfVUlOVDgsXG4gICAgRUxFTUVOVFRZUEVfSU5UMTY6IFRZUEVfSU5UMTYsXG4gICAgRUxFTUVOVFRZUEVfVUlOVDE2OiBUWVBFX1VJTlQxNixcbiAgICBFTEVNRU5UVFlQRV9JTlQzMjogVFlQRV9JTlQzMixcbiAgICBFTEVNRU5UVFlQRV9VSU5UMzI6IFRZUEVfVUlOVDMyLFxuICAgIEVMRU1FTlRUWVBFX0ZMT0FUMzI6IFRZUEVfRkxPQVQzMixcbiAgICBGSUxURVJfTkVBUkVTVDogRklMVEVSX05FQVJFU1QsXG4gICAgRklMVEVSX0xJTkVBUjogRklMVEVSX0xJTkVBUixcbiAgICBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVDogRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QsXG4gICAgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUjogRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUixcbiAgICBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUOiBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNULFxuICAgIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUjogRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIElOREVYRk9STUFUX1VJTlQ4OiBJTkRFWEZPUk1BVF9VSU5UOCxcbiAgICBJTkRFWEZPUk1BVF9VSU5UMTY6IElOREVYRk9STUFUX1VJTlQxNixcbiAgICBJTkRFWEZPUk1BVF9VSU5UMzI6IElOREVYRk9STUFUX1VJTlQzMixcbiAgICBQSVhFTEZPUk1BVF9SNV9HNl9CNTogUElYRUxGT1JNQVRfUjVfRzZfQjUsXG4gICAgUElYRUxGT1JNQVRfUjhfRzhfQjg6IFBJWEVMRk9STUFUX1I4X0c4X0I4LFxuICAgIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4OiBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCxcbiAgICBQUklNSVRJVkVfUE9JTlRTOiBQUklNSVRJVkVfUE9JTlRTLFxuICAgIFBSSU1JVElWRV9MSU5FUzogUFJJTUlUSVZFX0xJTkVTLFxuICAgIFBSSU1JVElWRV9MSU5FTE9PUDogUFJJTUlUSVZFX0xJTkVMT09QLFxuICAgIFBSSU1JVElWRV9MSU5FU1RSSVA6IFBSSU1JVElWRV9MSU5FU1RSSVAsXG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUzogUFJJTUlUSVZFX1RSSUFOR0xFUyxcbiAgICBQUklNSVRJVkVfVFJJU1RSSVA6IFBSSU1JVElWRV9UUklTVFJJUCxcbiAgICBQUklNSVRJVkVfVFJJRkFOOiBQUklNSVRJVkVfVFJJRkFOLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OOiBTRU1BTlRJQ19QT1NJVElPTixcbiAgICBTRU1BTlRJQ19OT1JNQUw6IFNFTUFOVElDX05PUk1BTCxcbiAgICBTRU1BTlRJQ19DT0xPUjogU0VNQU5USUNfQ09MT1IsXG4gICAgU0VNQU5USUNfVEVYQ09PUkQ6IFNFTUFOVElDX1RFWENPT1JELFxuICAgIFNFTUFOVElDX1RFWENPT1JEMDogU0VNQU5USUNfVEVYQ09PUkQwLFxuICAgIFNFTUFOVElDX1RFWENPT1JEMTogU0VNQU5USUNfVEVYQ09PUkQxLFxuICAgIFNFTUFOVElDX0FUVFIwOiBTRU1BTlRJQ19BVFRSMCxcbiAgICBTRU1BTlRJQ19BVFRSMTogU0VNQU5USUNfQVRUUjEsXG4gICAgU0VNQU5USUNfQVRUUjI6IFNFTUFOVElDX0FUVFIyLFxuICAgIFNFTUFOVElDX0FUVFIzOiBTRU1BTlRJQ19BVFRSMyxcbiAgICBURVhUVVJFTE9DS19SRUFEOiBURVhUVVJFTE9DS19SRUFELFxuICAgIFRFWFRVUkVMT0NLX1dSSVRFOiBURVhUVVJFTE9DS19XUklURSxcbiAgICBkcmF3UXVhZFdpdGhTaGFkZXI6IGRyYXdRdWFkV2l0aFNoYWRlcixcbiAgICBwcm9ncmFtbGliOiBwcm9ncmFtbGliLFxuICAgIHNoYWRlckNodW5rczogc2hhZGVyQ2h1bmtzLFxuICAgIENvbnRleHRDcmVhdGlvbkVycm9yOiBDb250ZXh0Q3JlYXRpb25FcnJvcixcbiAgICBEZXZpY2U6IEdyYXBoaWNzRGV2aWNlLFxuICAgIEluZGV4QnVmZmVyOiBJbmRleEJ1ZmZlcixcbiAgICBQcm9ncmFtTGlicmFyeTogUHJvZ3JhbUxpYnJhcnksXG4gICAgUmVuZGVyVGFyZ2V0OiBSZW5kZXJUYXJnZXQsXG4gICAgU2NvcGVJZDogU2NvcGVJZCxcbiAgICBTaGFkZXI6IFNoYWRlcixcbiAgICBTaGFkZXJJbnB1dDogU2hhZGVySW5wdXQsXG4gICAgVGV4dHVyZTogVGV4dHVyZSxcbiAgICBVbnN1cHBvcnRlZEJyb3dzZXJFcnJvcjogVW5zdXBwb3J0ZWRCcm93c2VyRXJyb3IsXG4gICAgVmVydGV4QnVmZmVyOiBWZXJ0ZXhCdWZmZXIsXG4gICAgVmVydGV4Rm9ybWF0OiBWZXJ0ZXhGb3JtYXQsXG4gICAgVmVydGV4SXRlcmF0b3I6IFZlcnRleEl0ZXJhdG9yXG59O1xuXG5leHBvcnQgY29uc3QgcG9zdGVmZmVjdCA9IHtcbiAgICBjcmVhdGVGdWxsc2NyZWVuUXVhZDogY3JlYXRlRnVsbHNjcmVlblF1YWQsXG4gICAgZHJhd0Z1bGxzY3JlZW5RdWFkOiBkcmF3RnVsbHNjcmVlblF1YWQsXG4gICAgUG9zdEVmZmVjdDogUG9zdEVmZmVjdCxcbiAgICBQb3N0RWZmZWN0UXVldWU6IFBvc3RFZmZlY3RRdWV1ZVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNoYWRlckNodW5rcywgJ3RyYW5zZm9ybVNraW5uZWRWUycsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcjZGVmaW5lIFNLSU5cXG4nICsgc2hhZGVyQ2h1bmtzLnRyYW5zZm9ybVZTO1xuICAgIH1cbn0pO1xuXG5jb25zdCBkZXByZWNhdGVkQ2h1bmtzID0ge1xuICAgICdhbWJpZW50UHJlZmlsdGVyZWRDdWJlLmZyYWcnOiAnYW1iaWVudEVudi5mcmFnJyxcbiAgICAnYW1iaWVudFByZWZpbHRlcmVkQ3ViZUxvZC5mcmFnJzogJ2FtYmllbnRFbnYuZnJhZycsXG4gICAgJ2RwQXRsYXNRdWFkLmZyYWcnOiBudWxsLFxuICAgICdnZW5QYXJhYm9sb2lkLmZyYWcnOiBudWxsLFxuICAgICdwcmVmaWx0ZXJDdWJlbWFwLmZyYWcnOiBudWxsLFxuICAgICdyZWZsZWN0aW9uRHBBdGxhcy5mcmFnJzogJ3JlZmxlY3Rpb25FbnYuZnJhZycsXG4gICAgJ3JlZmxlY3Rpb25QcmVmaWx0ZXJlZEN1YmUuZnJhZyc6ICdyZWZsZWN0aW9uRW52LmZyYWcnLFxuICAgICdyZWZsZWN0aW9uUHJlZmlsdGVyZWRDdWJlTG9kLmZyYWcnOiAncmVmbGVjdGlvbkVudi5mcmFnJ1xufTtcblxuT2JqZWN0LmtleXMoZGVwcmVjYXRlZENodW5rcykuZm9yRWFjaCgoY2h1bmtOYW1lKSA9PiB7XG4gICAgY29uc3QgcmVwbGFjZW1lbnQgPSBkZXByZWNhdGVkQ2h1bmtzW2NodW5rTmFtZV07XG4gICAgY29uc3QgdXNlSW5zdGVhZCA9IHJlcGxhY2VtZW50ID8gYCBVc2UgcGMuc2hhZGVyQ2h1bmtzWycke3JlcGxhY2VtZW50fSddIGluc3RlYWQuYCA6ICcnO1xuICAgIGNvbnN0IG1zZyA9IGBwYy5zaGFkZXJDaHVua3NbJyR7Y2h1bmtOYW1lfSddIGlzIGRlcHJlY2F0ZWQuJHt1c2VJbnN0ZWFkfX1gO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzaGFkZXJDaHVua3MsIGNodW5rTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmVycm9yKG1zZyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5lcnJvcihtc2cpO1xuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuLy8gTm90ZTogVGhpcyB3YXMgbmV2ZXIgcHVibGljIGludGVyZmFjZSwgYnV0IGhhcyBiZWVuIHVzZWQgaW4gZXh0ZXJuYWwgc2NyaXB0c1xuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoUmVuZGVyVGFyZ2V0LnByb3RvdHlwZSwge1xuICAgIF9nbEZyYW1lQnVmZmVyOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyVGFyZ2V0I19nbEZyYW1lQnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJUYXJnZXQuaW1wbCNfZ2xGcmFtZUJ1ZmZlciBpbnN0ZWFkLicpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbC5fZ2xGcmFtZUJ1ZmZlcjtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAocmdibSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyVGFyZ2V0I19nbEZyYW1lQnVmZmVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJUYXJnZXQuaW1wbCNfZ2xGcmFtZUJ1ZmZlciBpbnN0ZWFkLicpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cblZlcnRleEZvcm1hdC5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlZlcnRleEZvcm1hdC51cGRhdGUgaXMgZGVwcmVjYXRlZCwgYW5kIFZlcnRleEZvcm1hdCBjYW5ub3QgYmUgY2hhbmdlZCBhZnRlciBpdCBoYXMgYmVlbiBjcmVhdGVkLicpO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoVGV4dHVyZS5wcm90b3R5cGUsIHtcbiAgICByZ2JtOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNyZ2JtIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnR5cGUgPT09IFRFWFRVUkVUWVBFX1JHQk07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHJnYm0pIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlRleHR1cmUjcmdibSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuVGV4dHVyZSN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSByZ2JtID8gVEVYVFVSRVRZUEVfUkdCTSA6IFRFWFRVUkVUWVBFX0RFRkFVTFQ7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgc3dpenpsZUdHR1I6IHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5UZXh0dXJlI3N3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5UZXh0dXJlI3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnR5cGUgPT09IFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIChzd2l6emxlR0dHUikge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNzd2l6emxlR0dHUiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuVGV4dHVyZSN0eXBlIGluc3RlYWQuJyk7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSBzd2l6emxlR0dHUiA/IFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBfZ2xUZXh0dXJlOiB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuVGV4dHVyZSNfZ2xUZXh0dXJlIGlzIG5vIGxvbmdlciBhdmFpbGFibGUsIHVzZSBVc2UgcGMuVGV4dHVyZS5pbXBsLl9nbFRleHR1cmUgaW5zdGVhZC4nKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGwuX2dsVGV4dHVyZTtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG4vLyBTQ0VORVxuXG5leHBvcnQgY29uc3QgUGhvbmdNYXRlcmlhbCA9IFN0YW5kYXJkTWF0ZXJpYWw7XG5cbmV4cG9ydCBjb25zdCBzY2VuZSA9IHtcbiAgICBwYXJ0aXRpb25Ta2luOiBwYXJ0aXRpb25Ta2luLFxuICAgIHByb2NlZHVyYWw6IHtcbiAgICAgICAgY2FsY3VsYXRlVGFuZ2VudHM6IGNhbGN1bGF0ZVRhbmdlbnRzLFxuICAgICAgICBjcmVhdGVNZXNoOiBjcmVhdGVNZXNoLFxuICAgICAgICBjcmVhdGVUb3J1czogY3JlYXRlVG9ydXMsXG4gICAgICAgIGNyZWF0ZUN5bGluZGVyOiBjcmVhdGVDeWxpbmRlcixcbiAgICAgICAgY3JlYXRlQ2Fwc3VsZTogY3JlYXRlQ2Fwc3VsZSxcbiAgICAgICAgY3JlYXRlQ29uZTogY3JlYXRlQ29uZSxcbiAgICAgICAgY3JlYXRlU3BoZXJlOiBjcmVhdGVTcGhlcmUsXG4gICAgICAgIGNyZWF0ZVBsYW5lOiBjcmVhdGVQbGFuZSxcbiAgICAgICAgY3JlYXRlQm94OiBjcmVhdGVCb3hcbiAgICB9LFxuICAgIEJhc2ljTWF0ZXJpYWw6IEJhc2ljTWF0ZXJpYWwsXG4gICAgQ29tbWFuZDogQ29tbWFuZCxcbiAgICBGb3J3YXJkUmVuZGVyZXI6IEZvcndhcmRSZW5kZXJlcixcbiAgICBHcmFwaE5vZGU6IEdyYXBoTm9kZSxcbiAgICBNYXRlcmlhbDogTWF0ZXJpYWwsXG4gICAgTWVzaDogTWVzaCxcbiAgICBNZXNoSW5zdGFuY2U6IE1lc2hJbnN0YW5jZSxcbiAgICBNb2RlbDogTW9kZWwsXG4gICAgUGFydGljbGVFbWl0dGVyOiBQYXJ0aWNsZUVtaXR0ZXIsXG4gICAgUGhvbmdNYXRlcmlhbDogU3RhbmRhcmRNYXRlcmlhbCxcbiAgICBQaWNrZXI6IFBpY2tlcixcbiAgICBQcm9qZWN0aW9uOiB7XG4gICAgICAgIE9SVEhPR1JBUEhJQzogUFJPSkVDVElPTl9PUlRIT0dSQVBISUMsXG4gICAgICAgIFBFUlNQRUNUSVZFOiBQUk9KRUNUSU9OX1BFUlNQRUNUSVZFXG4gICAgfSxcbiAgICBTY2VuZTogU2NlbmUsXG4gICAgU2tpbjogU2tpbixcbiAgICBTa2luSW5zdGFuY2U6IFNraW5JbnN0YW5jZVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFNjZW5lLnByb3RvdHlwZSwgJ2RlZmF1bHRNYXRlcmlhbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2NlbmUjZGVmYXVsdE1hdGVyaWFsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgICAgIHJldHVybiBnZXREZWZhdWx0TWF0ZXJpYWwoZ2V0QXBwbGljYXRpb24oKS5ncmFwaGljc0RldmljZSk7XG4gICAgfVxufSk7XG5cbi8vIHNjZW5lLnNreWJveFByZWZpbHRlcmVkKioqKiBhcmUgZGVwcmVjYXRlZFxuWycxMjgnLCAnNjQnLCAnMzInLCAnMTYnLCAnOCcsICc0J10uZm9yRWFjaCgoc2l6ZSwgaW5kZXgpID0+IHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoU2NlbmUucHJvdG90eXBlLCBgc2t5Ym94UHJlZmlsdGVyZWQke3NpemV9YCwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlNjZW5lI3NreWJveFByZWZpbHRlcmVkJHtzaXplfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2NlbmUjcHJlZmlsdGVyZWRDdWJlbWFwcyBpbnN0ZWFkLmApO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHNbaW5kZXhdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChgcGMuU2NlbmUjc2t5Ym94UHJlZmlsdGVyZWQke3NpemV9IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5TY2VuZSNwcmVmaWx0ZXJlZEN1YmVtYXBzIGluc3RlYWQuYCk7XG4gICAgICAgICAgICB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzW2luZGV4XSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH0pO1xufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTY2VuZS5wcm90b3R5cGUsICdtb2RlbHMnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbW9kZWxzKSB7XG4gICAgICAgICAgICB0aGlzLl9tb2RlbHMgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWxzO1xuICAgIH1cbn0pO1xuXG4vLyBUaGlzIGNhbiBiZSByZW1vdmVkIHdoZW4gMS41NiBpcyBvdXQgYW5kIHRoZSBFZGl0b3Igbm8gbG9uZ2VyIGNhbGxzIHRoaXNcblNjZW5lLnByb3RvdHlwZS5fdXBkYXRlU2t5Ym94ID0gZnVuY3Rpb24gKGRldmljZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlNjZW5lI191cGRhdGVTa3lib3ggaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNjZW5lI191cGRhdGVTa3kgaW5zdGVhZC5gKTtcbiAgICB0aGlzLl91cGRhdGVTa3koZGV2aWNlKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5hZGRNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2FkZE1vZGVsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgaWYgKHRoaXMuY29udGFpbnNNb2RlbChtb2RlbCkpIHJldHVybjtcbiAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICB0aGlzLm1vZGVscy5wdXNoKG1vZGVsKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5hZGRTaGFkb3dDYXN0ZXIgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNhZGRTaGFkb3dDYXN0ZXIgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICBjb25zdCBsYXllciA9IHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKTtcbiAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgbGF5ZXIuYWRkU2hhZG93Q2FzdGVycyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5yZW1vdmVNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI3JlbW92ZU1vZGVsIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgY29uc3QgaW5kZXggPSB0aGlzLm1vZGVscy5pbmRleE9mKG1vZGVsKTtcbiAgICBpZiAoaW5kZXggIT09IC0xKSB7XG4gICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfV09STEQpO1xuICAgICAgICBpZiAoIWxheWVyKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIHRoaXMubW9kZWxzLnNwbGljZShpbmRleCwgMSk7XG4gICAgfVxufTtcblxuU2NlbmUucHJvdG90eXBlLnJlbW92ZVNoYWRvd0Nhc3RlcnMgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNyZW1vdmVTaGFkb3dDYXN0ZXJzIGlzIGRlcHJlY2F0ZWQuJyk7XG4gICAgY29uc3QgbGF5ZXIgPSB0aGlzLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCk7XG4gICAgaWYgKCFsYXllcikgcmV0dXJuO1xuICAgIGxheWVyLnJlbW92ZVNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG59O1xuXG5TY2VuZS5wcm90b3R5cGUuY29udGFpbnNNb2RlbCA9IGZ1bmN0aW9uIChtb2RlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNjZW5lI2NvbnRhaW5zTW9kZWwgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHMuaW5kZXhPZihtb2RlbCkgPj0gMDtcbn07XG5cblNjZW5lLnByb3RvdHlwZS5nZXRNb2RlbHMgPSBmdW5jdGlvbiAobW9kZWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5TY2VuZSNnZXRNb2RlbHMgaXMgZGVwcmVjYXRlZC4nKTtcbiAgICByZXR1cm4gdGhpcy5tb2RlbHM7XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmF0Y2gucHJvdG90eXBlLCAnbW9kZWwnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkJhdGNoI21vZGVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5CYXRjaCNtZXNoSW5zdGFuY2UgdG8gYWNjZXNzIGJhdGNoZWQgbWVzaCBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59KTtcblxuRm9yd2FyZFJlbmRlcmVyLnByb3RvdHlwZS5yZW5kZXJDb21wb3NpdGlvbiA9IGZ1bmN0aW9uIChjb21wKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuRm9yd2FyZFJlbmRlcmVyI3JlbmRlckNvbXBvc2l0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBCYXNlLnJlbmRlckNvbXBvc2l0aW9uIGluc3RlYWQuJyk7XG4gICAgZ2V0QXBwbGljYXRpb24oKS5yZW5kZXJDb21wb3NpdGlvbihjb21wKTtcbn07XG5cbkZvcndhcmRSZW5kZXJlci5wcm90b3R5cGUudXBkYXRlU2hhZGVyID0gZnVuY3Rpb24gKG1lc2hJbnN0YW5jZSwgb2JqRGVmcywgc3RhdGljTGlnaHRMaXN0LCBwYXNzLCBzb3J0ZWRMaWdodHMpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Gb3J3YXJkUmVuZGVyZXIjdXBkYXRlU2hhZGVyIGlzIGRlcHJlY2F0ZWQsIHVzZSBwYy5NZXNoSW5zdGFuY2UjdXBkYXRlUGFzc1NoYWRlci4nKTtcbiAgICBjb25zdCBzY2VuZSA9IG1lc2hJbnN0YW5jZS5tYXRlcmlhbC5fc2NlbmUgfHwgZ2V0QXBwbGljYXRpb24oKS5zY2VuZTtcbiAgICByZXR1cm4gbWVzaEluc3RhbmNlLnVwZGF0ZVBhc3NTaGFkZXIoc2NlbmUsIHBhc3MsIHN0YXRpY0xpZ2h0TGlzdCwgc29ydGVkTGlnaHRzKTtcbn07XG5cbk1lc2hJbnN0YW5jZS5wcm90b3R5cGUuc3luY0FhYmIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWVzaEluc3RhbmNlI3N5bmNBYWJiIGlzIGRlcHJlY2F0ZWQuJyk7XG59O1xuXG5Nb3JwaC5wcm90b3R5cGUuZ2V0VGFyZ2V0ID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTW9ycGgjZ2V0VGFyZ2V0IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Nb3JwaCN0YXJnZXRzIGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy50YXJnZXRzW2luZGV4XTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuX2RpcnRpZnkgPSBmdW5jdGlvbiAobG9jYWwpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjX2RpcnRpZnkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNfZGlydGlmeUxvY2FsIG9yIF9kaXJ0aWZ5V29ybGQgcmVzcGVjdGl2ZWx5IGluc3RlYWQuJyk7XG4gICAgaWYgKGxvY2FsKVxuICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICBlbHNlXG4gICAgICAgIHRoaXMuX2RpcnRpZnlXb3JsZCgpO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5hZGRMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNhZGRMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIHRoaXMuX2xhYmVsc1tsYWJlbF0gPSB0cnVlO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRMYWJlbHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldExhYmVscyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9sYWJlbHMpO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5oYXNMYWJlbCA9IGZ1bmN0aW9uIChsYWJlbCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNoYXNMYWJlbCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3RhZ3MgaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiAhIXRoaXMuX2xhYmVsc1tsYWJlbF07XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLnJlbW92ZUxhYmVsID0gZnVuY3Rpb24gKGxhYmVsKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI3JlbW92ZUxhYmVsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjdGFncyBpbnN0ZWFkLicpO1xuXG4gICAgZGVsZXRlIHRoaXMuX2xhYmVsc1tsYWJlbF07XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmZpbmRCeUxhYmVsID0gZnVuY3Rpb24gKGxhYmVsLCByZXN1bHRzID0gW10pIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZmluZEJ5TGFiZWwgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSN0YWdzIGluc3RlYWQuJyk7XG5cbiAgICBpZiAodGhpcy5oYXNMYWJlbChsYWJlbCkpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHRoaXMpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgcmVzdWx0cyA9IHRoaXMuX2NoaWxkcmVuW2ldLmZpbmRCeUxhYmVsKGxhYmVsLCByZXN1bHRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0cztcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0Q2hpbGRyZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldENoaWxkcmVuIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjY2hpbGRyZW4gaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLmNoaWxkcmVuO1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXROYW1lID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkdyYXBoTm9kZSNnZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5HcmFwaE5vZGUjbmFtZSBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbkdyYXBoTm9kZS5wcm90b3R5cGUuZ2V0UGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjZ2V0UGF0aCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3BhdGggaW5zdGVhZC4nKTtcblxuICAgIHJldHVybiB0aGlzLnBhdGg7XG59O1xuXG5HcmFwaE5vZGUucHJvdG90eXBlLmdldFJvb3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldFJvb3QgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkdyYXBoTm9kZSNyb290IGluc3RlYWQuJyk7XG5cbiAgICByZXR1cm4gdGhpcy5yb290O1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5nZXRQYXJlbnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuR3JhcGhOb2RlI2dldFBhcmVudCBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI3BhcmVudCBpbnN0ZWFkLicpO1xuXG4gICAgcmV0dXJuIHRoaXMucGFyZW50O1xufTtcblxuR3JhcGhOb2RlLnByb3RvdHlwZS5zZXROYW1lID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5HcmFwaE5vZGUjc2V0TmFtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuR3JhcGhOb2RlI25hbWUgaW5zdGVhZC4nKTtcblxuICAgIHRoaXMubmFtZSA9IG5hbWU7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuZ2V0TmFtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNnZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNuYW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5zZXROYW1lID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5NYXRlcmlhbCNzZXROYW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNuYW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbn07XG5cbk1hdGVyaWFsLnByb3RvdHlwZS5nZXRTaGFkZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTWF0ZXJpYWwjZ2V0U2hhZGVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5NYXRlcmlhbCNzaGFkZXIgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5zaGFkZXI7XG59O1xuXG5NYXRlcmlhbC5wcm90b3R5cGUuc2V0U2hhZGVyID0gZnVuY3Rpb24gKHNoYWRlcikge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLk1hdGVyaWFsI3NldFNoYWRlciBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTWF0ZXJpYWwjc2hhZGVyIGluc3RlYWQuJyk7XG4gICAgdGhpcy5zaGFkZXIgPSBzaGFkZXI7XG59O1xuXG5mdW5jdGlvbiBfZGVmaW5lQWxpYXMobmV3TmFtZSwgb2xkTmFtZSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTdGFuZGFyZE1hdGVyaWFsLnByb3RvdHlwZSwgb2xkTmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtvbGROYW1lfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU3RhbmRhcmRNYXRlcmlhbCMke25ld05hbWV9IGluc3RlYWQuYCk7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1tuZXdOYW1lXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoYHBjLlN0YW5kYXJkTWF0ZXJpYWwjJHtvbGROYW1lfSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU3RhbmRhcmRNYXRlcmlhbCMke25ld05hbWV9IGluc3RlYWQuYCk7XG4gICAgICAgICAgICB0aGlzW25ld05hbWVdID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuX2RlZmluZUFsaWFzKCdkaWZmdXNlVGludCcsICdkaWZmdXNlTWFwVGludCcpO1xuX2RlZmluZUFsaWFzKCdzcGVjdWxhclRpbnQnLCAnc3BlY3VsYXJNYXBUaW50Jyk7XG5fZGVmaW5lQWxpYXMoJ2VtaXNzaXZlVGludCcsICdlbWlzc2l2ZU1hcFRpbnQnKTtcbl9kZWZpbmVBbGlhcygnYW9WZXJ0ZXhDb2xvcicsICdhb01hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ2RpZmZ1c2VWZXJ0ZXhDb2xvcicsICdkaWZmdXNlTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnc3BlY3VsYXJWZXJ0ZXhDb2xvcicsICdzcGVjdWxhck1hcFZlcnRleENvbG9yJyk7XG5fZGVmaW5lQWxpYXMoJ2VtaXNzaXZlVmVydGV4Q29sb3InLCAnZW1pc3NpdmVNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdtZXRhbG5lc3NWZXJ0ZXhDb2xvcicsICdtZXRhbG5lc3NNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdnbG9zc1ZlcnRleENvbG9yJywgJ2dsb3NzTWFwVmVydGV4Q29sb3InKTtcbl9kZWZpbmVBbGlhcygnb3BhY2l0eVZlcnRleENvbG9yJywgJ29wYWNpdHlNYXBWZXJ0ZXhDb2xvcicpO1xuX2RlZmluZUFsaWFzKCdsaWdodFZlcnRleENvbG9yJywgJ2xpZ2h0TWFwVmVydGV4Q29sb3InKTtcblxuLy8gQU5JTUFUSU9OXG5cbmV4cG9ydCBjb25zdCBhbmltID0ge1xuICAgIEFuaW1hdGlvbjogQW5pbWF0aW9uLFxuICAgIEtleTogS2V5LFxuICAgIE5vZGU6IE5vZGUsXG4gICAgU2tlbGV0b246IFNrZWxldG9uXG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldER1cmF0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFuaW1hdGlvbiNnZXREdXJhdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQW5pbWF0aW9uI2R1cmF0aW9uIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuZHVyYXRpb247XG59O1xuXG5BbmltYXRpb24ucHJvdG90eXBlLmdldE5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI2dldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNuYW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubmFtZTtcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuZ2V0Tm9kZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI2dldE5vZGVzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BbmltYXRpb24jbm9kZXMgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5ub2Rlcztcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuc2V0RHVyYXRpb24gPSBmdW5jdGlvbiAoZHVyYXRpb24pIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BbmltYXRpb24jc2V0RHVyYXRpb24gaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNkdXJhdGlvbiBpbnN0ZWFkLicpO1xuICAgIHRoaXMuZHVyYXRpb24gPSBkdXJhdGlvbjtcbn07XG5cbkFuaW1hdGlvbi5wcm90b3R5cGUuc2V0TmFtZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQW5pbWF0aW9uI3NldE5hbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFuaW1hdGlvbiNuYW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXRBbmltYXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0QW5pbWF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNhbmltYXRpb24gaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5hbmltYXRpb247XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0Q3VycmVudFRpbWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jZ2V0Q3VycmVudFRpbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2N1cnJlbnRUaW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMuY3VycmVudFRpbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuZ2V0TG9vcGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXRMb29waW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNsb29waW5nIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubG9vcGluZztcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5nZXROdW1Ob2RlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Ta2VsZXRvbiNnZXROdW1Ob2RlcyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbnVtTm9kZXMgaW5zdGVhZC4nKTtcbiAgICByZXR1cm4gdGhpcy5udW1Ob2Rlcztcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5zZXRBbmltYXRpb24gPSBmdW5jdGlvbiAoYW5pbWF0aW9uKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0QW5pbWF0aW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Ta2VsZXRvbiNhbmltYXRpb24gaW5zdGVhZC4nKTtcbiAgICB0aGlzLmFuaW1hdGlvbiA9IGFuaW1hdGlvbjtcbn07XG5cblNrZWxldG9uLnByb3RvdHlwZS5zZXRDdXJyZW50VGltZSA9IGZ1bmN0aW9uICh0aW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0Q3VycmVudFRpbWUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlNrZWxldG9uI2N1cnJlbnRUaW1lIGluc3RlYWQuJyk7XG4gICAgdGhpcy5jdXJyZW50VGltZSA9IHRpbWU7XG59O1xuXG5Ta2VsZXRvbi5wcm90b3R5cGUuc2V0TG9vcGluZyA9IGZ1bmN0aW9uIChsb29waW5nKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU2tlbGV0b24jc2V0TG9vcGluZyBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU2tlbGV0b24jbG9vcGluZyBpbnN0ZWFkLicpO1xuICAgIHRoaXMubG9vcGluZyA9IGxvb3Bpbmc7XG59O1xuXG4vLyBTT1VORFxuXG5leHBvcnQgY29uc3QgYXVkaW8gPSB7XG4gICAgQXVkaW9NYW5hZ2VyOiBTb3VuZE1hbmFnZXIsXG4gICAgQ2hhbm5lbDogQ2hhbm5lbCxcbiAgICBDaGFubmVsM2Q6IENoYW5uZWwzZCxcbiAgICBMaXN0ZW5lcjogTGlzdGVuZXIsXG4gICAgU291bmQ6IFNvdW5kXG59O1xuXG5Tb3VuZE1hbmFnZXIucHJvdG90eXBlLmdldExpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlNvdW5kTWFuYWdlciNnZXRMaXN0ZW5lciBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI2xpc3RlbmVyIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMubGlzdGVuZXI7XG59O1xuXG5Tb3VuZE1hbmFnZXIucHJvdG90eXBlLmdldFZvbHVtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5Tb3VuZE1hbmFnZXIjZ2V0Vm9sdW1lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Tb3VuZE1hbmFnZXIjdm9sdW1lIGluc3RlYWQuJyk7XG4gICAgcmV0dXJuIHRoaXMudm9sdW1lO1xufTtcblxuU291bmRNYW5hZ2VyLnByb3RvdHlwZS5zZXRWb2x1bWUgPSBmdW5jdGlvbiAodm9sdW1lKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuU291bmRNYW5hZ2VyI3NldFZvbHVtZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuU291bmRNYW5hZ2VyI3ZvbHVtZSBpbnN0ZWFkLicpO1xuICAgIHRoaXMudm9sdW1lID0gdm9sdW1lO1xufTtcblxuLy8gQVNTRVRcblxuZXhwb3J0IGNvbnN0IGFzc2V0ID0ge1xuICAgIEFTU0VUX0FOSU1BVElPTjogJ2FuaW1hdGlvbicsXG4gICAgQVNTRVRfQVVESU86ICdhdWRpbycsXG4gICAgQVNTRVRfSU1BR0U6ICdpbWFnZScsXG4gICAgQVNTRVRfSlNPTjogJ2pzb24nLFxuICAgIEFTU0VUX01PREVMOiAnbW9kZWwnLFxuICAgIEFTU0VUX01BVEVSSUFMOiAnbWF0ZXJpYWwnLFxuICAgIEFTU0VUX1RFWFQ6ICd0ZXh0JyxcbiAgICBBU1NFVF9URVhUVVJFOiAndGV4dHVyZScsXG4gICAgQVNTRVRfQ1VCRU1BUDogJ2N1YmVtYXAnLFxuICAgIEFTU0VUX1NDUklQVDogJ3NjcmlwdCdcbn07XG5cbkFzc2V0UmVnaXN0cnkucHJvdG90eXBlLmdldEFzc2V0QnlJZCA9IGZ1bmN0aW9uIChpZCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFzc2V0UmVnaXN0cnkjZ2V0QXNzZXRCeUlkIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5Bc3NldFJlZ2lzdHJ5I2dldCBpbnN0ZWFkLicpO1xuICAgIHJldHVybiB0aGlzLmdldChpZCk7XG59O1xuXG4vLyBYUlxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdyYXknLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlhySW5wdXRTb3VyY2UjcmF5IGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5YcklucHV0U291cmNlI2dldE9yaWdpbiBhbmQgcGMuWHJJbnB1dFNvdXJjZSNnZXREaXJlY3Rpb24gaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JheUxvY2FsO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdwb3NpdGlvbicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuWHJJbnB1dFNvdXJjZSNwb3NpdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRMb2NhbFBvc2l0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbFBvc2l0aW9uO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoWHJJbnB1dFNvdXJjZS5wcm90b3R5cGUsICdyb3RhdGlvbicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuWHJJbnB1dFNvdXJjZSNyb3RhdGlvbiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuWHJJbnB1dFNvdXJjZSNnZXRMb2NhbFJvdGF0aW9uIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbFJvdGF0aW9uO1xuICAgIH1cbn0pO1xuXG4vLyBJTlBVVFxuXG5leHBvcnQgY29uc3QgaW5wdXQgPSB7XG4gICAgZ2V0VG91Y2hUYXJnZXRDb29yZHM6IGdldFRvdWNoVGFyZ2V0Q29vcmRzLFxuICAgIENvbnRyb2xsZXI6IENvbnRyb2xsZXIsXG4gICAgR2FtZVBhZHM6IEdhbWVQYWRzLFxuICAgIEtleWJvYXJkOiBLZXlib2FyZCxcbiAgICBLZXlib2FyZEV2ZW50OiBLZXlib2FyZEV2ZW50LFxuICAgIE1vdXNlOiBNb3VzZSxcbiAgICBNb3VzZUV2ZW50OiBNb3VzZUV2ZW50LFxuICAgIFRvdWNoOiBUb3VjaCxcbiAgICBUb3VjaERldmljZTogVG91Y2hEZXZpY2UsXG4gICAgVG91Y2hFdmVudDogVG91Y2hFdmVudFxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEVsZW1lbnRJbnB1dC5wcm90b3R5cGUsICd3aGVlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2hlZWxEZWx0YSAqIC0yO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTW91c2VFdmVudC5wcm90b3R5cGUsICd3aGVlbCcsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMud2hlZWxEZWx0YSAqIC0yO1xuICAgIH1cbn0pO1xuXG4vLyBGUkFNRVdPUktcblxuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9UWVBFX1NUQVRJQyA9IEJPRFlUWVBFX1NUQVRJQztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9EWU5BTUlDID0gQk9EWVRZUEVfRFlOQU1JQztcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfVFlQRV9LSU5FTUFUSUMgPSBCT0RZVFlQRV9LSU5FTUFUSUM7XG5leHBvcnQgY29uc3QgUklHSURCT0RZX0NGX1NUQVRJQ19PQkpFQ1QgPSBCT0RZRkxBR19TVEFUSUNfT0JKRUNUO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9DRl9LSU5FTUFUSUNfT0JKRUNUID0gQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQ0ZfTk9SRVNQT05TRV9PQkpFQ1QgPSBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVDtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfQUNUSVZFX1RBRyA9IEJPRFlTVEFURV9BQ1RJVkVfVEFHO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9JU0xBTkRfU0xFRVBJTkcgPSBCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9XQU5UU19ERUFDVElWQVRJT04gPSBCT0RZU1RBVEVfV0FOVFNfREVBQ1RJVkFUSU9OO1xuZXhwb3J0IGNvbnN0IFJJR0lEQk9EWV9ESVNBQkxFX0RFQUNUSVZBVElPTiA9IEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTjtcbmV4cG9ydCBjb25zdCBSSUdJREJPRFlfRElTQUJMRV9TSU1VTEFUSU9OID0gQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTjtcblxuZXhwb3J0IGNvbnN0IGZ3ID0ge1xuICAgIEFwcGxpY2F0aW9uOiBBcHBsaWNhdGlvbixcbiAgICBDb21wb25lbnQ6IENvbXBvbmVudCxcbiAgICBDb21wb25lbnRTeXN0ZW06IENvbXBvbmVudFN5c3RlbSxcbiAgICBFbnRpdHk6IEVudGl0eSxcbiAgICBGaWxsTW9kZToge1xuICAgICAgICBOT05FOiBGSUxMTU9ERV9OT05FLFxuICAgICAgICBGSUxMX1dJTkRPVzogRklMTE1PREVfRklMTF9XSU5ET1csXG4gICAgICAgIEtFRVBfQVNQRUNUOiBGSUxMTU9ERV9LRUVQX0FTUEVDVFxuICAgIH0sXG4gICAgUmVzb2x1dGlvbk1vZGU6IHtcbiAgICAgICAgQVVUTzogUkVTT0xVVElPTl9BVVRPLFxuICAgICAgICBGSVhFRDogUkVTT0xVVElPTl9GSVhFRFxuICAgIH1cbn07XG5cbkFwcGxpY2F0aW9uLnByb3RvdHlwZS5pc0Z1bGxzY3JlZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwbGljYXRpb24jaXNGdWxsc2NyZWVuIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgRnVsbHNjcmVlbiBBUEkgZGlyZWN0bHkuJyk7XG5cbiAgICByZXR1cm4gISFkb2N1bWVudC5mdWxsc2NyZWVuRWxlbWVudDtcbn07XG5cbkFwcGxpY2F0aW9uLnByb3RvdHlwZS5lbmFibGVGdWxsc2NyZWVuID0gZnVuY3Rpb24gKGVsZW1lbnQsIHN1Y2Nlc3MsIGVycm9yKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwbGljYXRpb24jZW5hYmxlRnVsbHNjcmVlbiBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIEZ1bGxzY3JlZW4gQVBJIGRpcmVjdGx5LicpO1xuXG4gICAgZWxlbWVudCA9IGVsZW1lbnQgfHwgdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXM7XG5cbiAgICAvLyBzdWNjZXNzIGNhbGxiYWNrXG4gICAgY29uc3QgcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3VjY2VzcygpO1xuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcyk7XG4gICAgfTtcblxuICAgIC8vIGVycm9yIGNhbGxiYWNrXG4gICAgY29uc3QgZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZXJyb3IoKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmVycm9yJywgZSk7XG4gICAgfTtcblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5jaGFuZ2UnLCBzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgaWYgKGVycm9yKSB7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Z1bGxzY3JlZW5lcnJvcicsIGUsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBpZiAoZWxlbWVudC5yZXF1ZXN0RnVsbHNjcmVlbikge1xuICAgICAgICBlbGVtZW50LnJlcXVlc3RGdWxsc2NyZWVuKEVsZW1lbnQuQUxMT1dfS0VZQk9BUkRfSU5QVVQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVycm9yKCk7XG4gICAgfVxufTtcblxuQXBwbGljYXRpb24ucHJvdG90eXBlLmRpc2FibGVGdWxsc2NyZWVuID0gZnVuY3Rpb24gKHN1Y2Nlc3MpIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBsaWNhdGlvbiNkaXNhYmxlRnVsbHNjcmVlbiBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIEZ1bGxzY3JlZW4gQVBJIGRpcmVjdGx5LicpO1xuXG4gICAgLy8gc3VjY2VzcyBjYWxsYmFja1xuICAgIGNvbnN0IHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHN1Y2Nlc3MoKTtcbiAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZnVsbHNjcmVlbmNoYW5nZScsIHMpO1xuICAgIH07XG5cbiAgICBpZiAoc3VjY2Vzcykge1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdmdWxsc2NyZWVuY2hhbmdlJywgcywgZmFsc2UpO1xuICAgIH1cblxuICAgIGRvY3VtZW50LmV4aXRGdWxsc2NyZWVuKCk7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUuZ2V0U2NlbmVVcmwgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcGxpY2F0aW9uI2dldFNjZW5lVXJsIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBsaWNhdGlvbiNzY2VuZXMgYW5kIHBjLlNjZW5lUmVnaXN0cnkjZmluZCBpbnN0ZWFkLicpO1xuICAgIGNvbnN0IGVudHJ5ID0gdGhpcy5zY2VuZXMuZmluZChuYW1lKTtcbiAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgcmV0dXJuIGVudHJ5LnVybDtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUubG9hZFNjZW5lID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBsaWNhdGlvbiNsb2FkU2NlbmUgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcGxpY2F0aW9uI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmUgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnNjZW5lcy5sb2FkU2NlbmUodXJsLCBjYWxsYmFjayk7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUubG9hZFNjZW5lSGllcmFyY2h5ID0gZnVuY3Rpb24gKHVybCwgY2FsbGJhY2spIHtcbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBsaWNhdGlvbiNsb2FkU2NlbmVIaWVyYXJjaHkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcGxpY2F0aW9uI3NjZW5lcyBhbmQgcGMuU2NlbmVSZWdpc3RyeSNsb2FkU2NlbmVIaWVyYXJjaHkgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnNjZW5lcy5sb2FkU2NlbmVIaWVyYXJjaHkodXJsLCBjYWxsYmFjayk7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUubG9hZFNjZW5lU2V0dGluZ3MgPSBmdW5jdGlvbiAodXJsLCBjYWxsYmFjaykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcGxpY2F0aW9uI2xvYWRTY2VuZVNldHRpbmdzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBsaWNhdGlvbiNzY2VuZXMgYW5kIHBjLlNjZW5lUmVnaXN0cnkjbG9hZFNjZW5lU2V0dGluZ3MgaW5zdGVhZC4nKTtcbiAgICB0aGlzLnNjZW5lcy5sb2FkU2NlbmVTZXR0aW5ncyh1cmwsIGNhbGxiYWNrKTtcbn07XG5cbkFwcGxpY2F0aW9uLnByb3RvdHlwZS5yZW5kZXJNZXNoSW5zdGFuY2UgPSBmdW5jdGlvbiAobWVzaEluc3RhbmNlLCBvcHRpb25zKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwbGljYXRpb24ucmVuZGVyTWVzaEluc3RhbmNlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBsaWNhdGlvbi5kcmF3TWVzaEluc3RhbmNlLicpO1xuICAgIGNvbnN0IGxheWVyID0gb3B0aW9ucz8ubGF5ZXIgPyBvcHRpb25zLmxheWVyIDogdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyO1xuICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdNZXNoKG51bGwsIG51bGwsIG51bGwsIG1lc2hJbnN0YW5jZSwgbGF5ZXIpO1xufTtcblxuQXBwbGljYXRpb24ucHJvdG90eXBlLnJlbmRlck1lc2ggPSBmdW5jdGlvbiAobWVzaCwgbWF0ZXJpYWwsIG1hdHJpeCwgb3B0aW9ucykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcGxpY2F0aW9uLnJlbmRlck1lc2ggaXMgZGVwcmVjYXRlZC4gVXNlIHBjLkFwcGxpY2F0aW9uLmRyYXdNZXNoLicpO1xuICAgIGNvbnN0IGxheWVyID0gb3B0aW9ucz8ubGF5ZXIgPyBvcHRpb25zLmxheWVyIDogdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyO1xuICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdNZXNoKG1hdGVyaWFsLCBtYXRyaXgsIG1lc2gsIG51bGwsIGxheWVyKTtcbn07XG5cbkFwcGxpY2F0aW9uLnByb3RvdHlwZS5fYWRkTGluZXMgPSBmdW5jdGlvbiAocG9zaXRpb25zLCBjb2xvcnMsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBsYXllciA9IChvcHRpb25zICYmIG9wdGlvbnMubGF5ZXIpID8gb3B0aW9ucy5sYXllciA6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSk7XG4gICAgY29uc3QgZGVwdGhUZXN0ID0gKG9wdGlvbnMgJiYgb3B0aW9ucy5kZXB0aFRlc3QgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmRlcHRoVGVzdCA6IHRydWU7XG5cbiAgICBjb25zdCBiYXRjaCA9IHRoaXMuc2NlbmUuaW1tZWRpYXRlLmdldEJhdGNoKGxheWVyLCBkZXB0aFRlc3QpO1xuICAgIGJhdGNoLmFkZExpbmVzKHBvc2l0aW9ucywgY29sb3JzKTtcbn07XG5cbkFwcGxpY2F0aW9uLnByb3RvdHlwZS5yZW5kZXJMaW5lID0gZnVuY3Rpb24gKHN0YXJ0LCBlbmQsIGNvbG9yKSB7XG5cbiAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5BcHBsaWNhdGlvbi5yZW5kZXJMaW5lIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBsaWNhdGlvbi5kcmF3TGluZS4nKTtcblxuICAgIGxldCBlbmRDb2xvciA9IGNvbG9yO1xuICAgIGxldCBvcHRpb25zO1xuXG4gICAgY29uc3QgYXJnMyA9IGFyZ3VtZW50c1szXTtcbiAgICBjb25zdCBhcmc0ID0gYXJndW1lbnRzWzRdO1xuXG4gICAgaWYgKGFyZzMgaW5zdGFuY2VvZiBDb2xvcikge1xuICAgICAgICAvLyBwYXNzZWQgaW4gZW5kIGNvbG9yXG4gICAgICAgIGVuZENvbG9yID0gYXJnMztcblxuICAgICAgICBpZiAodHlwZW9mIGFyZzQgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAvLyBjb21wYXRpYmlsaXR5OiBjb252ZXJ0IGxpbmViYXRjaCBpZCBpbnRvIG9wdGlvbnNcbiAgICAgICAgICAgIGlmIChhcmc0ID09PSBMSU5FQkFUQ0hfT1ZFUkxBWSkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IGZhbHNlXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXI6IHRoaXMuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSksXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoVGVzdDogdHJ1ZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB1c2UgcGFzc2VkIGluIG9wdGlvbnNcbiAgICAgICAgICAgIG9wdGlvbnMgPSBhcmc0O1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgYXJnMyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgZW5kQ29sb3IgPSBjb2xvcjtcblxuICAgICAgICAvLyBjb21wYXRpYmlsaXR5OiBjb252ZXJ0IGxpbmViYXRjaCBpZCBpbnRvIG9wdGlvbnNcbiAgICAgICAgaWYgKGFyZzMgPT09IExJTkVCQVRDSF9PVkVSTEFZKSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgIGRlcHRoVGVzdDogZmFsc2VcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgICAgIGRlcHRoVGVzdDogdHJ1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYXJnMykge1xuICAgICAgICAvLyBvcHRpb25zIHBhc3NlZCBpblxuICAgICAgICBvcHRpb25zID0gYXJnMztcbiAgICB9XG5cbiAgICB0aGlzLl9hZGRMaW5lcyhbc3RhcnQsIGVuZF0sIFtjb2xvciwgZW5kQ29sb3JdLCBvcHRpb25zKTtcbn07XG5cbkFwcGxpY2F0aW9uLnByb3RvdHlwZS5yZW5kZXJMaW5lcyA9IGZ1bmN0aW9uIChwb3NpdGlvbiwgY29sb3IsIG9wdGlvbnMpIHtcblxuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkFwcGxpY2F0aW9uLnJlbmRlckxpbmVzIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5BcHBsaWNhdGlvbi5kcmF3TGluZXMuJyk7XG5cbiAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgICAgLy8gZGVmYXVsdCBvcHRpb25cbiAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGxheWVyOiB0aGlzLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9JTU1FRElBVEUpLFxuICAgICAgICAgICAgZGVwdGhUZXN0OiB0cnVlXG4gICAgICAgIH07XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHksIExJTkVCQVRDSF9PVkVSTEFZIGxpbmVzIGhhdmUgZGVwdGh0ZXN0IGRpc2FibGVkXG4gICAgICAgIGlmIChvcHRpb25zID09PSBMSU5FQkFUQ0hfT1ZFUkxBWSkge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IGZhbHNlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBsYXllcjogdGhpcy5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKSxcbiAgICAgICAgICAgICAgICBkZXB0aFRlc3Q6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBtdWx0aUNvbG9yID0gISFjb2xvci5sZW5ndGg7XG4gICAgaWYgKG11bHRpQ29sb3IpIHtcbiAgICAgICAgaWYgKHBvc2l0aW9uLmxlbmd0aCAhPT0gY29sb3IubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdyZW5kZXJMaW5lczogcG9zaXRpb24vY29sb3IgYXJyYXlzIGhhdmUgZGlmZmVyZW50IGxlbmd0aHMnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAocG9zaXRpb24ubGVuZ3RoICUgMiAhPT0gMCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdyZW5kZXJMaW5lczogYXJyYXkgbGVuZ3RoIGlzIG5vdCBkaXZpc2libGUgYnkgMicpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuX2FkZExpbmVzKHBvc2l0aW9uLCBjb2xvciwgb3B0aW9ucyk7XG59O1xuXG5BcHBsaWNhdGlvbi5wcm90b3R5cGUuZW5hYmxlVnIgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuQXBwbGljYXRpb24jZW5hYmxlVlIgaXMgZGVwcmVjYXRlZCwgYW5kIFdlYlZSIEFQSSBpcyBubyBsb25nZXIgc3VwcG9ydGVkLicpO1xufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KENhbWVyYUNvbXBvbmVudC5wcm90b3R5cGUsICdub2RlJywge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5DYW1lcmFDb21wb25lbnQjbm9kZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuQ2FtZXJhQ29tcG9uZW50I2VudGl0eSBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5lbnRpdHk7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShMaWdodENvbXBvbmVudC5wcm90b3R5cGUsICdlbmFibGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLkxpZ2h0Q29tcG9uZW50I2VuYWJsZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTGlnaHRDb21wb25lbnQjZW5hYmxlZCBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy5lbmFibGVkO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTGlnaHRDb21wb25lbnQjZW5hYmxlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5MaWdodENvbXBvbmVudCNlbmFibGVkIGluc3RlYWQuJyk7XG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IHZhbHVlO1xuICAgIH1cbn0pO1xuXG5Nb2RlbENvbXBvbmVudC5wcm90b3R5cGUuc2V0VmlzaWJsZSA9IGZ1bmN0aW9uICh2aXNpYmxlKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTW9kZWxDb21wb25lbnQjc2V0VmlzaWJsZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTW9kZWxDb21wb25lbnQjZW5hYmxlZCBpbnN0ZWFkLicpO1xuICAgIHRoaXMuZW5hYmxlZCA9IHZpc2libGU7XG59O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTW9kZWxDb21wb25lbnQucHJvdG90eXBlLCAnYWFiYicsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTW9kZWxDb21wb25lbnQjYWFiYiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTW9kZWxDb21wb25lbnQjY3VzdG9tQWFiYiBpbnN0ZWFkIC0gd2hpY2ggZXhwZWN0cyBsb2NhbCBzcGFjZSBBQUJCIGluc3RlYWQgb2YgYSB3b3JsZCBzcGFjZSBBQUJCLicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuTW9kZWxDb21wb25lbnQjYWFiYiBpcyBkZXByZWNhdGVkLiBVc2UgcGMuTW9kZWxDb21wb25lbnQjY3VzdG9tQWFiYiBpbnN0ZWFkIC0gd2hpY2ggZXhwZWN0cyBsb2NhbCBzcGFjZSBBQUJCIGluc3RlYWQgb2YgYSB3b3JsZCBzcGFjZSBBQUJCLicpO1xuICAgIH1cbn0pO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoUmVuZGVyQ29tcG9uZW50LnByb3RvdHlwZSwgJ2FhYmInLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJlbmRlckNvbXBvbmVudCNhYWJiIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SZW5kZXJDb21wb25lbnQjY3VzdG9tQWFiYiBpbnN0ZWFkIC0gd2hpY2ggZXhwZWN0cyBsb2NhbCBzcGFjZSBBQUJCIGluc3RlYWQgb2YgYSB3b3JsZCBzcGFjZSBBQUJCLicpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmVuZGVyQ29tcG9uZW50I2FhYmIgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJlbmRlckNvbXBvbmVudCNjdXN0b21BYWJiIGluc3RlYWQgLSB3aGljaCBleHBlY3RzIGxvY2FsIHNwYWNlIEFBQkIgaW5zdGVhZCBvZiBhIHdvcmxkIHNwYWNlIEFBQkIuJyk7XG4gICAgfVxufSk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSaWdpZEJvZHlDb21wb25lbnQucHJvdG90eXBlLCAnYm9keVR5cGUnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlJpZ2lkQm9keUNvbXBvbmVudCNib2R5VHlwZSBpcyBkZXByZWNhdGVkLiBVc2UgcGMuUmlnaWRCb2R5Q29tcG9uZW50I3R5cGUgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMudHlwZTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50I2JvZHlUeXBlIGlzIGRlcHJlY2F0ZWQuIFVzZSBwYy5SaWdpZEJvZHlDb21wb25lbnQjdHlwZSBpbnN0ZWFkLicpO1xuICAgICAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgIH1cbn0pO1xuXG5SaWdpZEJvZHlDb21wb25lbnQucHJvdG90eXBlLnN5bmNCb2R5VG9FbnRpdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50I3N5bmNCb2R5VG9FbnRpdHkgaXMgbm90IHB1YmxpYyBBUEkgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4nKTtcbiAgICB0aGlzLl91cGRhdGVEeW5hbWljKCk7XG59O1xuXG5SaWdpZEJvZHlDb21wb25lbnRTeXN0ZW0ucHJvdG90eXBlLnNldEdyYXZpdHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgRGVidWcuZGVwcmVjYXRlZCgncGMuUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtI3NldEdyYXZpdHkgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLlJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbSNncmF2aXR5IGluc3RlYWQuJyk7XG5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICB0aGlzLmdyYXZpdHkuY29weShhcmd1bWVudHNbMF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ3Jhdml0eS5zZXQoYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgfVxufTtcblxuXG5leHBvcnQgZnVuY3Rpb24gYmFzaXNTZXREb3dubG9hZENvbmZpZyhnbHVlVXJsLCB3YXNtVXJsLCBmYWxsYmFja1VybCkge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLmJhc2lzU2V0RG93bmxvYWRDb25maWcgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLmJhc2lzSW5pdGlhbGl6ZSBpbnN0ZWFkLicpO1xuICAgIGJhc2lzSW5pdGlhbGl6ZSh7XG4gICAgICAgIGdsdWVVcmw6IGdsdWVVcmwsXG4gICAgICAgIHdhc21Vcmw6IHdhc21VcmwsXG4gICAgICAgIGZhbGxiYWNrVXJsOiBmYWxsYmFja1VybCxcbiAgICAgICAgbGF6eUluaXQ6IHRydWVcbiAgICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByZWZpbHRlckN1YmVtYXAob3B0aW9ucykge1xuICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLnByZWZpbHRlckN1YmVtYXAgaXMgZGVwcmVjYXRlZC4gVXNlIHBjLmVudkxpZ2h0aW5nIGluc3RlYWQuJyk7XG59XG4iXSwibmFtZXMiOlsibG9nIiwid3JpdGUiLCJ0ZXh0IiwiRGVidWciLCJkZXByZWNhdGVkIiwiY29uc29sZSIsIm9wZW4iLCJ2ZXJzaW9uIiwicmV2aXNpb24iLCJpbmZvIiwiZGVidWciLCJlcnJvciIsIndhcm5pbmciLCJ3YXJuIiwiYWxlcnQiLCJhc3NlcnQiLCJjb25kaXRpb24iLCJzdHJpbmciLCJlbmRzV2l0aCIsInMiLCJzdWJzIiwic3RhcnRzV2l0aCIsInRpbWUiLCJub3ciLCJUaW1lciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiQ29sb3IiLCJwcm90b3R5cGUiLCJnZXQiLCJfZGF0YSIsIkZsb2F0MzJBcnJheSIsInIiLCJnIiwiYiIsImEiLCJfZGF0YTMiLCJpbmhlcml0cyIsIlNlbGYiLCJTdXBlciIsIlRlbXAiLCJGdW5jIiwiYXJnMSIsImFyZzIiLCJhcmczIiwiYXJnNCIsImFyZzUiLCJhcmc2IiwiYXJnNyIsImFyZzgiLCJjYWxsIiwiX3N1cGVyIiwibWFrZUFycmF5IiwiYXJyIiwiQXJyYXkiLCJzbGljZSIsIm1hdGgiLCJJTlZfTE9HMiIsIk1hdGgiLCJMT0cyRSIsImludFRvQnl0ZXMiLCJpbnRUb0J5dGVzMzIiLCJieXRlc1RvSW50IiwiYnl0ZXNUb0ludDMyIiwiVmVjMiIsIngiLCJ5Iiwic2NhbGUiLCJtdWxTY2FsYXIiLCJWZWMzIiwieiIsIlZlYzQiLCJ3Iiwic2hhcGUiLCJBYWJiIiwiQm91bmRpbmdCb3giLCJTcGhlcmUiLCJCb3VuZGluZ1NwaGVyZSIsIlBsYW5lIiwiaW50ZXJzZWN0UmF5IiwiaW50ZXJzZWN0c1JheSIsIkZydXN0dW0iLCJ1cGRhdGUiLCJwcm9qZWN0aW9uTWF0cml4Iiwidmlld01hdHJpeCIsInZpZXdQcm9qIiwiTWF0NCIsIm11bDIiLCJzZXRGcm9tTWF0NCIsIkVMRU1FTlRUWVBFX0lOVDgiLCJUWVBFX0lOVDgiLCJFTEVNRU5UVFlQRV9VSU5UOCIsIlRZUEVfVUlOVDgiLCJFTEVNRU5UVFlQRV9JTlQxNiIsIlRZUEVfSU5UMTYiLCJFTEVNRU5UVFlQRV9VSU5UMTYiLCJUWVBFX1VJTlQxNiIsIkVMRU1FTlRUWVBFX0lOVDMyIiwiVFlQRV9JTlQzMiIsIkVMRU1FTlRUWVBFX1VJTlQzMiIsIlRZUEVfVUlOVDMyIiwiRUxFTUVOVFRZUEVfRkxPQVQzMiIsIlRZUEVfRkxPQVQzMiIsIlVuc3VwcG9ydGVkQnJvd3NlckVycm9yIiwibWVzc2FnZSIsIm5hbWUiLCJFcnJvciIsIkNvbnRleHRDcmVhdGlvbkVycm9yIiwicHJvZ3JhbWxpYiIsImJlZ2luIiwiZHVtbXlGcmFnbWVudENvZGUiLCJlbmQiLCJmb2dDb2RlIiwiZ2FtbWFDb2RlIiwicHJlY2lzaW9uQ29kZSIsInNraW5Db2RlIiwidG9uZW1hcENvZGUiLCJ2ZXJzaW9uQ29kZSIsImdmeCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiQUREUkVTU19SRVBFQVQiLCJCTEVORE1PREVfWkVSTyIsIkJMRU5ETU9ERV9PTkUiLCJCTEVORE1PREVfU1JDX0NPTE9SIiwiQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQ09MT1IiLCJCTEVORE1PREVfRFNUX0NPTE9SIiwiQkxFTkRNT0RFX09ORV9NSU5VU19EU1RfQ09MT1IiLCJCTEVORE1PREVfU1JDX0FMUEhBIiwiQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0FMUEhBIiwiQkxFTkRNT0RFX0RTVF9BTFBIQSIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBIiwiQlVGRkVSX1NUQVRJQyIsIkJVRkZFUl9EWU5BTUlDIiwiQlVGRkVSX1NUUkVBTSIsIkNVTExGQUNFX05PTkUiLCJDVUxMRkFDRV9CQUNLIiwiQ1VMTEZBQ0VfRlJPTlQiLCJDVUxMRkFDRV9GUk9OVEFOREJBQ0siLCJGSUxURVJfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVIiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVIiLCJGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiSU5ERVhGT1JNQVRfVUlOVDgiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJJTkRFWEZPUk1BVF9VSU5UMzIiLCJQSVhFTEZPUk1BVF9SNV9HNl9CNSIsIlBJWEVMRk9STUFUX1I4X0c4X0I4IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJQUklNSVRJVkVfUE9JTlRTIiwiUFJJTUlUSVZFX0xJTkVTIiwiUFJJTUlUSVZFX0xJTkVMT09QIiwiUFJJTUlUSVZFX0xJTkVTVFJJUCIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiU0VNQU5USUNfUE9TSVRJT04iLCJTRU1BTlRJQ19OT1JNQUwiLCJTRU1BTlRJQ19DT0xPUiIsIlNFTUFOVElDX1RFWENPT1JEIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwiU0VNQU5USUNfVEVYQ09PUkQxIiwiU0VNQU5USUNfQVRUUjAiLCJTRU1BTlRJQ19BVFRSMSIsIlNFTUFOVElDX0FUVFIyIiwiU0VNQU5USUNfQVRUUjMiLCJURVhUVVJFTE9DS19SRUFEIiwiVEVYVFVSRUxPQ0tfV1JJVEUiLCJkcmF3UXVhZFdpdGhTaGFkZXIiLCJzaGFkZXJDaHVua3MiLCJEZXZpY2UiLCJHcmFwaGljc0RldmljZSIsIkluZGV4QnVmZmVyIiwiUHJvZ3JhbUxpYnJhcnkiLCJSZW5kZXJUYXJnZXQiLCJTY29wZUlkIiwiU2hhZGVyIiwiU2hhZGVySW5wdXQiLCJUZXh0dXJlIiwiVmVydGV4QnVmZmVyIiwiVmVydGV4Rm9ybWF0IiwiVmVydGV4SXRlcmF0b3IiLCJwb3N0ZWZmZWN0IiwiY3JlYXRlRnVsbHNjcmVlblF1YWQiLCJkcmF3RnVsbHNjcmVlblF1YWQiLCJQb3N0RWZmZWN0IiwiUG9zdEVmZmVjdFF1ZXVlIiwidHJhbnNmb3JtVlMiLCJkZXByZWNhdGVkQ2h1bmtzIiwia2V5cyIsImZvckVhY2giLCJjaHVua05hbWUiLCJyZXBsYWNlbWVudCIsInVzZUluc3RlYWQiLCJtc2ciLCJzZXQiLCJkZWZpbmVQcm9wZXJ0aWVzIiwiX2dsRnJhbWVCdWZmZXIiLCJpbXBsIiwicmdibSIsInR5cGUiLCJURVhUVVJFVFlQRV9SR0JNIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsInN3aXp6bGVHR0dSIiwiVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IiLCJfZ2xUZXh0dXJlIiwiUGhvbmdNYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJzY2VuZSIsInBhcnRpdGlvblNraW4iLCJwcm9jZWR1cmFsIiwiY2FsY3VsYXRlVGFuZ2VudHMiLCJjcmVhdGVNZXNoIiwiY3JlYXRlVG9ydXMiLCJjcmVhdGVDeWxpbmRlciIsImNyZWF0ZUNhcHN1bGUiLCJjcmVhdGVDb25lIiwiY3JlYXRlU3BoZXJlIiwiY3JlYXRlUGxhbmUiLCJjcmVhdGVCb3giLCJCYXNpY01hdGVyaWFsIiwiQ29tbWFuZCIsIkZvcndhcmRSZW5kZXJlciIsIkdyYXBoTm9kZSIsIk1hdGVyaWFsIiwiTWVzaCIsIk1lc2hJbnN0YW5jZSIsIk1vZGVsIiwiUGFydGljbGVFbWl0dGVyIiwiUGlja2VyIiwiUHJvamVjdGlvbiIsIk9SVEhPR1JBUEhJQyIsIlBST0pFQ1RJT05fT1JUSE9HUkFQSElDIiwiUEVSU1BFQ1RJVkUiLCJQUk9KRUNUSU9OX1BFUlNQRUNUSVZFIiwiU2NlbmUiLCJTa2luIiwiU2tpbkluc3RhbmNlIiwiZ2V0RGVmYXVsdE1hdGVyaWFsIiwiZ2V0QXBwbGljYXRpb24iLCJncmFwaGljc0RldmljZSIsInNpemUiLCJpbmRleCIsIl9wcmVmaWx0ZXJlZEN1YmVtYXBzIiwidmFsdWUiLCJ1cGRhdGVTaGFkZXJzIiwiX21vZGVscyIsIl91cGRhdGVTa3lib3giLCJkZXZpY2UiLCJfdXBkYXRlU2t5IiwiYWRkTW9kZWwiLCJtb2RlbCIsImNvbnRhaW5zTW9kZWwiLCJsYXllciIsImxheWVycyIsImdldExheWVyQnlJZCIsIkxBWUVSSURfV09STEQiLCJhZGRNZXNoSW5zdGFuY2VzIiwibWVzaEluc3RhbmNlcyIsIm1vZGVscyIsInB1c2giLCJhZGRTaGFkb3dDYXN0ZXIiLCJhZGRTaGFkb3dDYXN0ZXJzIiwicmVtb3ZlTW9kZWwiLCJpbmRleE9mIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsInNwbGljZSIsInJlbW92ZVNoYWRvd0Nhc3RlcnMiLCJnZXRNb2RlbHMiLCJCYXRjaCIsInJlbmRlckNvbXBvc2l0aW9uIiwiY29tcCIsInVwZGF0ZVNoYWRlciIsIm1lc2hJbnN0YW5jZSIsIm9iakRlZnMiLCJzdGF0aWNMaWdodExpc3QiLCJwYXNzIiwic29ydGVkTGlnaHRzIiwibWF0ZXJpYWwiLCJfc2NlbmUiLCJ1cGRhdGVQYXNzU2hhZGVyIiwic3luY0FhYmIiLCJNb3JwaCIsImdldFRhcmdldCIsInRhcmdldHMiLCJfZGlydGlmeSIsImxvY2FsIiwiX2RpcnRpZnlMb2NhbCIsIl9kaXJ0aWZ5V29ybGQiLCJhZGRMYWJlbCIsImxhYmVsIiwiX2xhYmVscyIsImdldExhYmVscyIsImhhc0xhYmVsIiwicmVtb3ZlTGFiZWwiLCJmaW5kQnlMYWJlbCIsInJlc3VsdHMiLCJpIiwiX2NoaWxkcmVuIiwibGVuZ3RoIiwiZ2V0Q2hpbGRyZW4iLCJjaGlsZHJlbiIsImdldE5hbWUiLCJnZXRQYXRoIiwicGF0aCIsImdldFJvb3QiLCJyb290IiwiZ2V0UGFyZW50IiwicGFyZW50Iiwic2V0TmFtZSIsImdldFNoYWRlciIsInNoYWRlciIsInNldFNoYWRlciIsIl9kZWZpbmVBbGlhcyIsIm5ld05hbWUiLCJvbGROYW1lIiwiYW5pbSIsIkFuaW1hdGlvbiIsIktleSIsIk5vZGUiLCJTa2VsZXRvbiIsImdldER1cmF0aW9uIiwiZHVyYXRpb24iLCJnZXROb2RlcyIsIm5vZGVzIiwic2V0RHVyYXRpb24iLCJnZXRBbmltYXRpb24iLCJhbmltYXRpb24iLCJnZXRDdXJyZW50VGltZSIsImN1cnJlbnRUaW1lIiwiZ2V0TG9vcGluZyIsImxvb3BpbmciLCJnZXROdW1Ob2RlcyIsIm51bU5vZGVzIiwic2V0QW5pbWF0aW9uIiwic2V0Q3VycmVudFRpbWUiLCJzZXRMb29waW5nIiwiYXVkaW8iLCJBdWRpb01hbmFnZXIiLCJTb3VuZE1hbmFnZXIiLCJDaGFubmVsIiwiQ2hhbm5lbDNkIiwiTGlzdGVuZXIiLCJTb3VuZCIsImdldExpc3RlbmVyIiwibGlzdGVuZXIiLCJnZXRWb2x1bWUiLCJ2b2x1bWUiLCJzZXRWb2x1bWUiLCJhc3NldCIsIkFTU0VUX0FOSU1BVElPTiIsIkFTU0VUX0FVRElPIiwiQVNTRVRfSU1BR0UiLCJBU1NFVF9KU09OIiwiQVNTRVRfTU9ERUwiLCJBU1NFVF9NQVRFUklBTCIsIkFTU0VUX1RFWFQiLCJBU1NFVF9URVhUVVJFIiwiQVNTRVRfQ1VCRU1BUCIsIkFTU0VUX1NDUklQVCIsIkFzc2V0UmVnaXN0cnkiLCJnZXRBc3NldEJ5SWQiLCJpZCIsIlhySW5wdXRTb3VyY2UiLCJfcmF5TG9jYWwiLCJfbG9jYWxQb3NpdGlvbiIsIl9sb2NhbFJvdGF0aW9uIiwiaW5wdXQiLCJnZXRUb3VjaFRhcmdldENvb3JkcyIsIkNvbnRyb2xsZXIiLCJHYW1lUGFkcyIsIktleWJvYXJkIiwiS2V5Ym9hcmRFdmVudCIsIk1vdXNlIiwiTW91c2VFdmVudCIsIlRvdWNoIiwiVG91Y2hEZXZpY2UiLCJUb3VjaEV2ZW50IiwiRWxlbWVudElucHV0Iiwid2hlZWxEZWx0YSIsIlJJR0lEQk9EWV9UWVBFX1NUQVRJQyIsIkJPRFlUWVBFX1NUQVRJQyIsIlJJR0lEQk9EWV9UWVBFX0RZTkFNSUMiLCJCT0RZVFlQRV9EWU5BTUlDIiwiUklHSURCT0RZX1RZUEVfS0lORU1BVElDIiwiQk9EWVRZUEVfS0lORU1BVElDIiwiUklHSURCT0RZX0NGX1NUQVRJQ19PQkpFQ1QiLCJCT0RZRkxBR19TVEFUSUNfT0JKRUNUIiwiUklHSURCT0RZX0NGX0tJTkVNQVRJQ19PQkpFQ1QiLCJCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUIiwiUklHSURCT0RZX0NGX05PUkVTUE9OU0VfT0JKRUNUIiwiQk9EWUZMQUdfTk9SRVNQT05TRV9PQkpFQ1QiLCJSSUdJREJPRFlfQUNUSVZFX1RBRyIsIkJPRFlTVEFURV9BQ1RJVkVfVEFHIiwiUklHSURCT0RZX0lTTEFORF9TTEVFUElORyIsIkJPRFlTVEFURV9JU0xBTkRfU0xFRVBJTkciLCJSSUdJREJPRFlfV0FOVFNfREVBQ1RJVkFUSU9OIiwiQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTiIsIlJJR0lEQk9EWV9ESVNBQkxFX0RFQUNUSVZBVElPTiIsIkJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiIsIlJJR0lEQk9EWV9ESVNBQkxFX1NJTVVMQVRJT04iLCJCT0RZU1RBVEVfRElTQUJMRV9TSU1VTEFUSU9OIiwiZnciLCJBcHBsaWNhdGlvbiIsIkNvbXBvbmVudCIsIkNvbXBvbmVudFN5c3RlbSIsIkVudGl0eSIsIkZpbGxNb2RlIiwiTk9ORSIsIkZJTExNT0RFX05PTkUiLCJGSUxMX1dJTkRPVyIsIkZJTExNT0RFX0ZJTExfV0lORE9XIiwiS0VFUF9BU1BFQ1QiLCJGSUxMTU9ERV9LRUVQX0FTUEVDVCIsIlJlc29sdXRpb25Nb2RlIiwiQVVUTyIsIlJFU09MVVRJT05fQVVUTyIsIkZJWEVEIiwiUkVTT0xVVElPTl9GSVhFRCIsImlzRnVsbHNjcmVlbiIsImRvY3VtZW50IiwiZnVsbHNjcmVlbkVsZW1lbnQiLCJlbmFibGVGdWxsc2NyZWVuIiwiZWxlbWVudCIsInN1Y2Nlc3MiLCJjYW52YXMiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZXF1ZXN0RnVsbHNjcmVlbiIsIkVsZW1lbnQiLCJBTExPV19LRVlCT0FSRF9JTlBVVCIsImRpc2FibGVGdWxsc2NyZWVuIiwiZXhpdEZ1bGxzY3JlZW4iLCJnZXRTY2VuZVVybCIsImVudHJ5Iiwic2NlbmVzIiwiZmluZCIsInVybCIsImxvYWRTY2VuZSIsImNhbGxiYWNrIiwibG9hZFNjZW5lSGllcmFyY2h5IiwibG9hZFNjZW5lU2V0dGluZ3MiLCJyZW5kZXJNZXNoSW5zdGFuY2UiLCJvcHRpb25zIiwiZGVmYXVsdERyYXdMYXllciIsImltbWVkaWF0ZSIsImRyYXdNZXNoIiwicmVuZGVyTWVzaCIsIm1lc2giLCJtYXRyaXgiLCJfYWRkTGluZXMiLCJwb3NpdGlvbnMiLCJjb2xvcnMiLCJMQVlFUklEX0lNTUVESUFURSIsImRlcHRoVGVzdCIsInVuZGVmaW5lZCIsImJhdGNoIiwiZ2V0QmF0Y2giLCJhZGRMaW5lcyIsInJlbmRlckxpbmUiLCJzdGFydCIsImNvbG9yIiwiZW5kQ29sb3IiLCJhcmd1bWVudHMiLCJMSU5FQkFUQ0hfT1ZFUkxBWSIsInJlbmRlckxpbmVzIiwicG9zaXRpb24iLCJtdWx0aUNvbG9yIiwiZW5hYmxlVnIiLCJDYW1lcmFDb21wb25lbnQiLCJlbnRpdHkiLCJMaWdodENvbXBvbmVudCIsImVuYWJsZWQiLCJNb2RlbENvbXBvbmVudCIsInNldFZpc2libGUiLCJ2aXNpYmxlIiwiUmVuZGVyQ29tcG9uZW50IiwiUmlnaWRCb2R5Q29tcG9uZW50Iiwic3luY0JvZHlUb0VudGl0eSIsIl91cGRhdGVEeW5hbWljIiwiUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtIiwic2V0R3Jhdml0eSIsImdyYXZpdHkiLCJjb3B5IiwiYmFzaXNTZXREb3dubG9hZENvbmZpZyIsImdsdWVVcmwiLCJ3YXNtVXJsIiwiZmFsbGJhY2tVcmwiLCJiYXNpc0luaXRpYWxpemUiLCJsYXp5SW5pdCIsInByZWZpbHRlckN1YmVtYXAiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFxSE8sTUFBTUEsR0FBRyxHQUFHO0VBQ2ZDLEtBQUssRUFBRSxVQUFVQyxJQUFWLEVBQWdCO0lBQ25CQyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsc0RBQWpCLENBQUEsQ0FBQTtJQUNBQyxPQUFPLENBQUNMLEdBQVIsQ0FBWUUsSUFBWixDQUFBLENBQUE7R0FIVztBQU1mSSxFQUFBQSxJQUFJLEVBQUUsWUFBWTtJQUNkSCxLQUFLLENBQUNDLFVBQU4sQ0FBaUIscURBQWpCLENBQUEsQ0FBQTtJQUNBSixHQUFHLENBQUNDLEtBQUosQ0FBVSx3QkFBQSxHQUEyQk0sT0FBM0IsR0FBcUMsR0FBckMsR0FBMkNDLFFBQXJELENBQUEsQ0FBQTtHQVJXO0VBV2ZDLElBQUksRUFBRSxVQUFVUCxJQUFWLEVBQWdCO0lBQ2xCQyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsc0RBQWpCLENBQUEsQ0FBQTtBQUNBQyxJQUFBQSxPQUFPLENBQUNJLElBQVIsQ0FBYSxXQUFBLEdBQWNQLElBQTNCLENBQUEsQ0FBQTtHQWJXO0VBZ0JmUSxLQUFLLEVBQUUsVUFBVVIsSUFBVixFQUFnQjtJQUNuQkMsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHdEQUFqQixDQUFBLENBQUE7QUFDQUMsSUFBQUEsT0FBTyxDQUFDSyxLQUFSLENBQWMsV0FBQSxHQUFjUixJQUE1QixDQUFBLENBQUE7R0FsQlc7RUFxQmZTLEtBQUssRUFBRSxVQUFVVCxJQUFWLEVBQWdCO0lBQ25CQyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsd0RBQWpCLENBQUEsQ0FBQTtBQUNBQyxJQUFBQSxPQUFPLENBQUNNLEtBQVIsQ0FBYyxXQUFBLEdBQWNULElBQTVCLENBQUEsQ0FBQTtHQXZCVztFQTBCZlUsT0FBTyxFQUFFLFVBQVVWLElBQVYsRUFBZ0I7SUFDckJDLEtBQUssQ0FBQ0MsVUFBTixDQUFpQix5REFBakIsQ0FBQSxDQUFBO0FBQ0FDLElBQUFBLE9BQU8sQ0FBQ1EsSUFBUixDQUFhLFdBQUEsR0FBY1gsSUFBM0IsQ0FBQSxDQUFBO0dBNUJXO0VBK0JmWSxLQUFLLEVBQUUsVUFBVVosSUFBVixFQUFnQjtJQUNuQkMsS0FBSyxDQUFDQyxVQUFOLENBQWlCLGdEQUFqQixDQUFBLENBQUE7QUFDQUosSUFBQUEsR0FBRyxDQUFDQyxLQUFKLENBQVUsV0FBQSxHQUFjQyxJQUF4QixDQUFBLENBQUE7SUFDQVksS0FBSyxDQUFDWixJQUFELENBQUwsQ0FBQTtHQWxDVztBQXFDZmEsRUFBQUEsTUFBTSxFQUFFLFVBQVVDLFNBQVYsRUFBcUJkLElBQXJCLEVBQTJCO0lBQy9CQyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsMEVBQWpCLENBQUEsQ0FBQTs7SUFDQSxJQUFJWSxTQUFTLEtBQUssS0FBbEIsRUFBeUI7QUFDckJoQixNQUFBQSxHQUFHLENBQUNDLEtBQUosQ0FBVSxXQUFBLEdBQWNDLElBQXhCLENBQUEsQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBO0FBMUNjLEVBQVo7O0FBNkNQZSxNQUFNLENBQUNDLFFBQVAsR0FBa0IsVUFBVUMsQ0FBVixFQUFhQyxJQUFiLEVBQW1CO0VBQ2pDakIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLGdFQUFqQixDQUFBLENBQUE7QUFDQSxFQUFBLE9BQU9lLENBQUMsQ0FBQ0QsUUFBRixDQUFXRSxJQUFYLENBQVAsQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQUgsTUFBTSxDQUFDSSxVQUFQLEdBQW9CLFVBQVVGLENBQVYsRUFBYUMsSUFBYixFQUFtQjtFQUNuQ2pCLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixvRUFBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxPQUFPZSxDQUFDLENBQUNFLFVBQUYsQ0FBYUQsSUFBYixDQUFQLENBQUE7QUFDSCxDQUhELENBQUE7O0FBS08sTUFBTUUsSUFBSSxHQUFHO0FBQ2hCQyxFQUFBQSxHQUFHLEVBQUVBLEdBRFc7QUFFaEJDLEVBQUFBLEtBQUssRUFBRUEsS0FBQUE7QUFGUyxFQUFiO0FBS1BDLE1BQU0sQ0FBQ0MsY0FBUCxDQUFzQkMsS0FBSyxDQUFDQyxTQUE1QixFQUF1QyxNQUF2QyxFQUErQztBQUMzQ0MsRUFBQUEsR0FBRyxFQUFFLFlBQVk7SUFDYjFCLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixrSEFBakIsQ0FBQSxDQUFBOztJQUNBLElBQUksQ0FBQyxJQUFLMEIsQ0FBQUEsS0FBVixFQUFpQjtBQUNiLE1BQUEsSUFBQSxDQUFLQSxLQUFMLEdBQWEsSUFBSUMsWUFBSixDQUFpQixDQUFqQixDQUFiLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsSUFBQSxDQUFLRCxLQUFMLENBQVcsQ0FBWCxDQUFBLEdBQWdCLEtBQUtFLENBQXJCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0YsS0FBTCxDQUFXLENBQVgsQ0FBQSxHQUFnQixLQUFLRyxDQUFyQixDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtILEtBQUwsQ0FBVyxDQUFYLENBQUEsR0FBZ0IsS0FBS0ksQ0FBckIsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLSixLQUFMLENBQVcsQ0FBWCxDQUFBLEdBQWdCLEtBQUtLLENBQXJCLENBQUE7QUFDQSxJQUFBLE9BQU8sS0FBS0wsS0FBWixDQUFBO0FBQ0gsR0FBQTtBQVgwQyxDQUEvQyxDQUFBLENBQUE7QUFjQUwsTUFBTSxDQUFDQyxjQUFQLENBQXNCQyxLQUFLLENBQUNDLFNBQTVCLEVBQXVDLE9BQXZDLEVBQWdEO0FBQzVDQyxFQUFBQSxHQUFHLEVBQUUsWUFBWTtJQUNiMUIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLG1IQUFqQixDQUFBLENBQUE7O0lBQ0EsSUFBSSxDQUFDLElBQUtnQyxDQUFBQSxNQUFWLEVBQWtCO0FBQ2QsTUFBQSxJQUFBLENBQUtBLE1BQUwsR0FBYyxJQUFJTCxZQUFKLENBQWlCLENBQWpCLENBQWQsQ0FBQTtBQUNILEtBQUE7O0FBQ0QsSUFBQSxJQUFBLENBQUtLLE1BQUwsQ0FBWSxDQUFaLENBQUEsR0FBaUIsS0FBS0osQ0FBdEIsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLSSxNQUFMLENBQVksQ0FBWixDQUFBLEdBQWlCLEtBQUtILENBQXRCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0csTUFBTCxDQUFZLENBQVosQ0FBQSxHQUFpQixLQUFLRixDQUF0QixDQUFBO0FBQ0EsSUFBQSxPQUFPLEtBQUtFLE1BQVosQ0FBQTtBQUNILEdBQUE7QUFWMkMsQ0FBaEQsQ0FBQSxDQUFBO0FBYU8sU0FBU0MsUUFBVCxDQUFrQkMsSUFBbEIsRUFBd0JDLEtBQXhCLEVBQStCO0FBQ2xDLEVBQUEsTUFBTUMsSUFBSSxHQUFHLFNBQVBBLElBQU8sR0FBWSxFQUF6QixDQUFBOztFQUNBLE1BQU1DLElBQUksR0FBRyxTQUFQQSxJQUFPLENBQVVDLElBQVYsRUFBZ0JDLElBQWhCLEVBQXNCQyxJQUF0QixFQUE0QkMsSUFBNUIsRUFBa0NDLElBQWxDLEVBQXdDQyxJQUF4QyxFQUE4Q0MsSUFBOUMsRUFBb0RDLElBQXBELEVBQTBEO0FBQ25FVixJQUFBQSxLQUFLLENBQUNXLElBQU4sQ0FBVyxJQUFYLEVBQWlCUixJQUFqQixFQUF1QkMsSUFBdkIsRUFBNkJDLElBQTdCLEVBQW1DQyxJQUFuQyxFQUF5Q0MsSUFBekMsRUFBK0NDLElBQS9DLEVBQXFEQyxJQUFyRCxFQUEyREMsSUFBM0QsQ0FBQSxDQUFBO0FBQ0FYLElBQUFBLElBQUksQ0FBQ1ksSUFBTCxDQUFVLElBQVYsRUFBZ0JSLElBQWhCLEVBQXNCQyxJQUF0QixFQUE0QkMsSUFBNUIsRUFBa0NDLElBQWxDLEVBQXdDQyxJQUF4QyxFQUE4Q0MsSUFBOUMsRUFBb0RDLElBQXBELEVBQTBEQyxJQUExRCxDQUFBLENBQUE7R0FGSixDQUFBOztBQUtBUixFQUFBQSxJQUFJLENBQUNVLE1BQUwsR0FBY1osS0FBSyxDQUFDWCxTQUFwQixDQUFBO0FBQ0FZLEVBQUFBLElBQUksQ0FBQ1osU0FBTCxHQUFpQlcsS0FBSyxDQUFDWCxTQUF2QixDQUFBO0FBQ0FhLEVBQUFBLElBQUksQ0FBQ2IsU0FBTCxHQUFpQixJQUFJWSxJQUFKLEVBQWpCLENBQUE7QUFFQSxFQUFBLE9BQU9DLElBQVAsQ0FBQTtBQUNILENBQUE7QUFFTSxTQUFTVyxTQUFULENBQW1CQyxHQUFuQixFQUF3QjtFQUMzQmxELEtBQUssQ0FBQ0MsVUFBTixDQUFpQixnR0FBakIsQ0FBQSxDQUFBO0VBQ0EsT0FBT2tELEtBQUssQ0FBQzFCLFNBQU4sQ0FBZ0IyQixLQUFoQixDQUFzQkwsSUFBdEIsQ0FBMkJHLEdBQTNCLENBQVAsQ0FBQTtBQUNILENBQUE7QUFJREcsSUFBSSxDQUFDQyxRQUFMLEdBQWdCQyxJQUFJLENBQUNDLEtBQXJCLENBQUE7QUFFQUgsSUFBSSxDQUFDSSxVQUFMLEdBQWtCSixJQUFJLENBQUNLLFlBQXZCLENBQUE7QUFDQUwsSUFBSSxDQUFDTSxVQUFMLEdBQWtCTixJQUFJLENBQUNPLFlBQXZCLENBQUE7QUFFQXRDLE1BQU0sQ0FBQ0MsY0FBUCxDQUFzQnNDLElBQUksQ0FBQ3BDLFNBQTNCLEVBQXNDLE1BQXRDLEVBQThDO0FBQzFDQyxFQUFBQSxHQUFHLEVBQUUsWUFBWTtJQUNiMUIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLGtIQUFqQixDQUFBLENBQUE7O0lBQ0EsSUFBSSxDQUFDLElBQUswQixDQUFBQSxLQUFWLEVBQWlCO0FBQ2IsTUFBQSxJQUFBLENBQUtBLEtBQUwsR0FBYSxJQUFJQyxZQUFKLENBQWlCLENBQWpCLENBQWIsQ0FBQTtBQUNILEtBQUE7O0FBQ0QsSUFBQSxJQUFBLENBQUtELEtBQUwsQ0FBVyxDQUFYLENBQUEsR0FBZ0IsS0FBS21DLENBQXJCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS25DLEtBQUwsQ0FBVyxDQUFYLENBQUEsR0FBZ0IsS0FBS29DLENBQXJCLENBQUE7QUFDQSxJQUFBLE9BQU8sS0FBS3BDLEtBQVosQ0FBQTtBQUNILEdBQUE7QUFUeUMsQ0FBOUMsQ0FBQSxDQUFBO0FBWUFrQyxJQUFJLENBQUNwQyxTQUFMLENBQWV1QyxLQUFmLEdBQXVCSCxJQUFJLENBQUNwQyxTQUFMLENBQWV3QyxTQUF0QyxDQUFBO0FBRUEzQyxNQUFNLENBQUNDLGNBQVAsQ0FBc0IyQyxJQUFJLENBQUN6QyxTQUEzQixFQUFzQyxNQUF0QyxFQUE4QztBQUMxQ0MsRUFBQUEsR0FBRyxFQUFFLFlBQVk7SUFDYjFCLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixrSEFBakIsQ0FBQSxDQUFBOztJQUNBLElBQUksQ0FBQyxJQUFLMEIsQ0FBQUEsS0FBVixFQUFpQjtBQUNiLE1BQUEsSUFBQSxDQUFLQSxLQUFMLEdBQWEsSUFBSUMsWUFBSixDQUFpQixDQUFqQixDQUFiLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsSUFBQSxDQUFLRCxLQUFMLENBQVcsQ0FBWCxDQUFBLEdBQWdCLEtBQUttQyxDQUFyQixDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtuQyxLQUFMLENBQVcsQ0FBWCxDQUFBLEdBQWdCLEtBQUtvQyxDQUFyQixDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtwQyxLQUFMLENBQVcsQ0FBWCxDQUFBLEdBQWdCLEtBQUt3QyxDQUFyQixDQUFBO0FBQ0EsSUFBQSxPQUFPLEtBQUt4QyxLQUFaLENBQUE7QUFDSCxHQUFBO0FBVnlDLENBQTlDLENBQUEsQ0FBQTtBQWFBdUMsSUFBSSxDQUFDekMsU0FBTCxDQUFldUMsS0FBZixHQUF1QkUsSUFBSSxDQUFDekMsU0FBTCxDQUFld0MsU0FBdEMsQ0FBQTtBQUVBM0MsTUFBTSxDQUFDQyxjQUFQLENBQXNCNkMsSUFBSSxDQUFDM0MsU0FBM0IsRUFBc0MsTUFBdEMsRUFBOEM7QUFDMUNDLEVBQUFBLEdBQUcsRUFBRSxZQUFZO0lBQ2IxQixLQUFLLENBQUNDLFVBQU4sQ0FBaUIsa0hBQWpCLENBQUEsQ0FBQTs7SUFDQSxJQUFJLENBQUMsSUFBSzBCLENBQUFBLEtBQVYsRUFBaUI7QUFDYixNQUFBLElBQUEsQ0FBS0EsS0FBTCxHQUFhLElBQUlDLFlBQUosQ0FBaUIsQ0FBakIsQ0FBYixDQUFBO0FBQ0gsS0FBQTs7QUFDRCxJQUFBLElBQUEsQ0FBS0QsS0FBTCxDQUFXLENBQVgsQ0FBQSxHQUFnQixLQUFLbUMsQ0FBckIsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLbkMsS0FBTCxDQUFXLENBQVgsQ0FBQSxHQUFnQixLQUFLb0MsQ0FBckIsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLcEMsS0FBTCxDQUFXLENBQVgsQ0FBQSxHQUFnQixLQUFLd0MsQ0FBckIsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLeEMsS0FBTCxDQUFXLENBQVgsQ0FBQSxHQUFnQixLQUFLMEMsQ0FBckIsQ0FBQTtBQUNBLElBQUEsT0FBTyxLQUFLMUMsS0FBWixDQUFBO0FBQ0gsR0FBQTtBQVh5QyxDQUE5QyxDQUFBLENBQUE7QUFjQXlDLElBQUksQ0FBQzNDLFNBQUwsQ0FBZXVDLEtBQWYsR0FBdUJJLElBQUksQ0FBQzNDLFNBQUwsQ0FBZXdDLFNBQXRDLENBQUE7QUFJTyxNQUFNSyxLQUFLLEdBQUc7QUFDakJDLEVBQUFBLElBQUksRUFBRUMsV0FEVztBQUVqQkMsRUFBQUEsTUFBTSxFQUFFQyxjQUZTO0FBR2pCQyxFQUFBQSxLQUFLLEVBQUVBLEtBQUFBO0FBSFUsRUFBZDtBQU1QRCxjQUFjLENBQUNqRCxTQUFmLENBQXlCbUQsWUFBekIsR0FBd0NGLGNBQWMsQ0FBQ2pELFNBQWYsQ0FBeUJvRCxhQUFqRSxDQUFBOztBQUVBQyxPQUFPLENBQUNyRCxTQUFSLENBQWtCc0QsTUFBbEIsR0FBMkIsVUFBVUMsZ0JBQVYsRUFBNEJDLFVBQTVCLEVBQXdDO0VBQy9EakYsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHNFQUFqQixDQUFBLENBQUE7QUFFQSxFQUFBLE1BQU1pRixRQUFRLEdBQUcsSUFBSUMsSUFBSixFQUFqQixDQUFBO0FBRUFELEVBQUFBLFFBQVEsQ0FBQ0UsSUFBVCxDQUFjSixnQkFBZCxFQUFnQ0MsVUFBaEMsQ0FBQSxDQUFBO0VBRUEsSUFBS0ksQ0FBQUEsV0FBTCxDQUFpQkgsUUFBakIsQ0FBQSxDQUFBO0FBQ0gsQ0FSRCxDQUFBOztBQVlPLE1BQU1JLGdCQUFnQixHQUFHQyxVQUF6QjtBQUNBLE1BQU1DLGlCQUFpQixHQUFHQyxXQUExQjtBQUNBLE1BQU1DLGlCQUFpQixHQUFHQyxXQUExQjtBQUNBLE1BQU1DLGtCQUFrQixHQUFHQyxZQUEzQjtBQUNBLE1BQU1DLGlCQUFpQixHQUFHQyxXQUExQjtBQUNBLE1BQU1DLGtCQUFrQixHQUFHQyxZQUEzQjtBQUNBLE1BQU1DLG1CQUFtQixHQUFHQyxhQUE1QjtBQUVBLFNBQVNDLHVCQUFULENBQWlDQyxPQUFqQyxFQUEwQztFQUM3QyxJQUFLQyxDQUFBQSxJQUFMLEdBQVkseUJBQVosQ0FBQTtBQUNBLEVBQUEsSUFBQSxDQUFLRCxPQUFMLEdBQWdCQSxPQUFPLElBQUksRUFBM0IsQ0FBQTtBQUNILENBQUE7QUFDREQsdUJBQXVCLENBQUMzRSxTQUF4QixHQUFvQzhFLEtBQUssQ0FBQzlFLFNBQTFDLENBQUE7QUFFTyxTQUFTK0Usb0JBQVQsQ0FBOEJILE9BQTlCLEVBQXVDO0VBQzFDLElBQUtDLENBQUFBLElBQUwsR0FBWSxzQkFBWixDQUFBO0FBQ0EsRUFBQSxJQUFBLENBQUtELE9BQUwsR0FBZ0JBLE9BQU8sSUFBSSxFQUEzQixDQUFBO0FBQ0gsQ0FBQTtBQUNERyxvQkFBb0IsQ0FBQy9FLFNBQXJCLEdBQWlDOEUsS0FBSyxDQUFDOUUsU0FBdkMsQ0FBQTtBQUVPLE1BQU1nRixVQUFVLEdBQUc7QUFDdEJDLEVBQUFBLEtBQUssRUFBRUEsS0FEZTtBQUV0QkMsRUFBQUEsaUJBQWlCLEVBQUVBLGlCQUZHO0FBR3RCQyxFQUFBQSxHQUFHLEVBQUVBLEdBSGlCO0FBSXRCQyxFQUFBQSxPQUFPLEVBQUVBLE9BSmE7QUFLdEJDLEVBQUFBLFNBQVMsRUFBRUEsU0FMVztBQU10QkMsRUFBQUEsYUFBYSxFQUFFQSxhQU5PO0FBT3RCQyxFQUFBQSxRQUFRLEVBQUVBLFFBUFk7QUFRdEJDLEVBQUFBLFdBQVcsRUFBRUEsV0FSUztBQVN0QkMsRUFBQUEsV0FBVyxFQUFFQSxXQUFBQTtBQVRTLEVBQW5CO0FBWUEsTUFBTUMsR0FBRyxHQUFHO0FBQ2ZDLEVBQUFBLHFCQUFxQixFQUFFQSxxQkFEUjtBQUVmQyxFQUFBQSx1QkFBdUIsRUFBRUEsdUJBRlY7QUFHZkMsRUFBQUEsY0FBYyxFQUFFQSxjQUhEO0FBSWZDLEVBQUFBLGNBQWMsRUFBRUEsY0FKRDtBQUtmQyxFQUFBQSxhQUFhLEVBQUVBLGFBTEE7QUFNZkMsRUFBQUEsbUJBQW1CLEVBQUVBLG1CQU5OO0FBT2ZDLEVBQUFBLDZCQUE2QixFQUFFQSw2QkFQaEI7QUFRZkMsRUFBQUEsbUJBQW1CLEVBQUVBLG1CQVJOO0FBU2ZDLEVBQUFBLDZCQUE2QixFQUFFQSw2QkFUaEI7QUFVZkMsRUFBQUEsbUJBQW1CLEVBQUVBLG1CQVZOO0FBV2ZDLEVBQUFBLDRCQUE0QixFQUFFQSw0QkFYZjtBQVlmQyxFQUFBQSw2QkFBNkIsRUFBRUEsNkJBWmhCO0FBYWZDLEVBQUFBLG1CQUFtQixFQUFFQSxtQkFiTjtBQWNmQyxFQUFBQSw2QkFBNkIsRUFBRUEsNkJBZGhCO0FBZWZDLEVBQUFBLGFBQWEsRUFBRUEsYUFmQTtBQWdCZkMsRUFBQUEsY0FBYyxFQUFFQSxjQWhCRDtBQWlCZkMsRUFBQUEsYUFBYSxFQUFFQSxhQWpCQTtBQWtCZkMsRUFBQUEsYUFBYSxFQUFFQSxhQWxCQTtBQW1CZkMsRUFBQUEsYUFBYSxFQUFFQSxhQW5CQTtBQW9CZkMsRUFBQUEsY0FBYyxFQUFFQSxjQXBCRDtBQXFCZkMsRUFBQUEscUJBQXFCLEVBQUVBLHFCQXJCUjtBQXNCZmxELEVBQUFBLGdCQUFnQixFQUFFQyxTQXRCSDtBQXVCZkMsRUFBQUEsaUJBQWlCLEVBQUVDLFVBdkJKO0FBd0JmQyxFQUFBQSxpQkFBaUIsRUFBRUMsVUF4Qko7QUF5QmZDLEVBQUFBLGtCQUFrQixFQUFFQyxXQXpCTDtBQTBCZkMsRUFBQUEsaUJBQWlCLEVBQUVDLFVBMUJKO0FBMkJmQyxFQUFBQSxrQkFBa0IsRUFBRUMsV0EzQkw7QUE0QmZDLEVBQUFBLG1CQUFtQixFQUFFQyxZQTVCTjtBQTZCZnNDLEVBQUFBLGNBQWMsRUFBRUEsY0E3QkQ7QUE4QmZDLEVBQUFBLGFBQWEsRUFBRUEsYUE5QkE7QUErQmZDLEVBQUFBLDZCQUE2QixFQUFFQSw2QkEvQmhCO0FBZ0NmQyxFQUFBQSw0QkFBNEIsRUFBRUEsNEJBaENmO0FBaUNmQyxFQUFBQSw0QkFBNEIsRUFBRUEsNEJBakNmO0FBa0NmQyxFQUFBQSwyQkFBMkIsRUFBRUEsMkJBbENkO0FBbUNmQyxFQUFBQSxpQkFBaUIsRUFBRUEsaUJBbkNKO0FBb0NmQyxFQUFBQSxrQkFBa0IsRUFBRUEsa0JBcENMO0FBcUNmQyxFQUFBQSxrQkFBa0IsRUFBRUEsa0JBckNMO0FBc0NmQyxFQUFBQSxvQkFBb0IsRUFBRUEsb0JBdENQO0FBdUNmQyxFQUFBQSxvQkFBb0IsRUFBRUEsb0JBdkNQO0FBd0NmQyxFQUFBQSx1QkFBdUIsRUFBRUEsdUJBeENWO0FBeUNmQyxFQUFBQSxnQkFBZ0IsRUFBRUEsZ0JBekNIO0FBMENmQyxFQUFBQSxlQUFlLEVBQUVBLGVBMUNGO0FBMkNmQyxFQUFBQSxrQkFBa0IsRUFBRUEsa0JBM0NMO0FBNENmQyxFQUFBQSxtQkFBbUIsRUFBRUEsbUJBNUNOO0FBNkNmQyxFQUFBQSxtQkFBbUIsRUFBRUEsbUJBN0NOO0FBOENmQyxFQUFBQSxrQkFBa0IsRUFBRUEsa0JBOUNMO0FBK0NmQyxFQUFBQSxnQkFBZ0IsRUFBRUEsZ0JBL0NIO0FBZ0RmQyxFQUFBQSxpQkFBaUIsRUFBRUEsaUJBaERKO0FBaURmQyxFQUFBQSxlQUFlLEVBQUVBLGVBakRGO0FBa0RmQyxFQUFBQSxjQUFjLEVBQUVBLGNBbEREO0FBbURmQyxFQUFBQSxpQkFBaUIsRUFBRUEsaUJBbkRKO0FBb0RmQyxFQUFBQSxrQkFBa0IsRUFBRUEsa0JBcERMO0FBcURmQyxFQUFBQSxrQkFBa0IsRUFBRUEsa0JBckRMO0FBc0RmQyxFQUFBQSxjQUFjLEVBQUVBLGNBdEREO0FBdURmQyxFQUFBQSxjQUFjLEVBQUVBLGNBdkREO0FBd0RmQyxFQUFBQSxjQUFjLEVBQUVBLGNBeEREO0FBeURmQyxFQUFBQSxjQUFjLEVBQUVBLGNBekREO0FBMERmQyxFQUFBQSxnQkFBZ0IsRUFBRUEsZ0JBMURIO0FBMkRmQyxFQUFBQSxpQkFBaUIsRUFBRUEsaUJBM0RKO0FBNERmQyxFQUFBQSxrQkFBa0IsRUFBRUEsa0JBNURMO0FBNkRmL0QsRUFBQUEsVUFBVSxFQUFFQSxVQTdERztBQThEZmdFLEVBQUFBLFlBQVksRUFBRUEsWUE5REM7QUErRGZqRSxFQUFBQSxvQkFBb0IsRUFBRUEsb0JBL0RQO0FBZ0Vma0UsRUFBQUEsTUFBTSxFQUFFQyxjQWhFTztBQWlFZkMsRUFBQUEsV0FBVyxFQUFFQSxXQWpFRTtBQWtFZkMsRUFBQUEsY0FBYyxFQUFFQSxjQWxFRDtBQW1FZkMsRUFBQUEsWUFBWSxFQUFFQSxZQW5FQztBQW9FZkMsRUFBQUEsT0FBTyxFQUFFQSxPQXBFTTtBQXFFZkMsRUFBQUEsTUFBTSxFQUFFQSxNQXJFTztBQXNFZkMsRUFBQUEsV0FBVyxFQUFFQSxXQXRFRTtBQXVFZkMsRUFBQUEsT0FBTyxFQUFFQSxPQXZFTTtBQXdFZjlFLEVBQUFBLHVCQUF1QixFQUFFQSx1QkF4RVY7QUF5RWYrRSxFQUFBQSxZQUFZLEVBQUVBLFlBekVDO0FBMEVmQyxFQUFBQSxZQUFZLEVBQUVBLFlBMUVDO0FBMkVmQyxFQUFBQSxjQUFjLEVBQUVBLGNBQUFBO0FBM0VELEVBQVo7QUE4RUEsTUFBTUMsVUFBVSxHQUFHO0FBQ3RCQyxFQUFBQSxvQkFBb0IsRUFBRUEsb0JBREE7QUFFdEJDLEVBQUFBLGtCQUFrQixFQUFFQSxrQkFGRTtBQUd0QkMsRUFBQUEsVUFBVSxFQUFFQSxVQUhVO0FBSXRCQyxFQUFBQSxlQUFlLEVBQUVBLGVBQUFBO0FBSkssRUFBbkI7QUFPUHBLLE1BQU0sQ0FBQ0MsY0FBUCxDQUFzQmtKLFlBQXRCLEVBQW9DLG9CQUFwQyxFQUEwRDtBQUN0RC9JLEVBQUFBLEdBQUcsRUFBRSxZQUFZO0lBQ2IsT0FBTyxnQkFBQSxHQUFtQitJLFlBQVksQ0FBQ2tCLFdBQXZDLENBQUE7QUFDSCxHQUFBO0FBSHFELENBQTFELENBQUEsQ0FBQTtBQU1BLE1BQU1DLGdCQUFnQixHQUFHO0FBQ3JCLEVBQUEsNkJBQUEsRUFBK0IsaUJBRFY7QUFFckIsRUFBQSxnQ0FBQSxFQUFrQyxpQkFGYjtBQUdyQixFQUFBLGtCQUFBLEVBQW9CLElBSEM7QUFJckIsRUFBQSxvQkFBQSxFQUFzQixJQUpEO0FBS3JCLEVBQUEsdUJBQUEsRUFBeUIsSUFMSjtBQU1yQixFQUFBLHdCQUFBLEVBQTBCLG9CQU5MO0FBT3JCLEVBQUEsZ0NBQUEsRUFBa0Msb0JBUGI7RUFRckIsbUNBQXFDLEVBQUEsb0JBQUE7QUFSaEIsQ0FBekIsQ0FBQTtBQVdBdEssTUFBTSxDQUFDdUssSUFBUCxDQUFZRCxnQkFBWixFQUE4QkUsT0FBOUIsQ0FBdUNDLFNBQUQsSUFBZTtBQUNqRCxFQUFBLE1BQU1DLFdBQVcsR0FBR0osZ0JBQWdCLENBQUNHLFNBQUQsQ0FBcEMsQ0FBQTtFQUNBLE1BQU1FLFVBQVUsR0FBR0QsV0FBVyxHQUFJLHlCQUF3QkEsV0FBWSxDQUFBLFdBQUEsQ0FBeEMsR0FBdUQsRUFBckYsQ0FBQTtBQUNBLEVBQUEsTUFBTUUsR0FBRyxHQUFJLENBQUEsaUJBQUEsRUFBbUJILFNBQVUsQ0FBQSxpQkFBQSxFQUFtQkUsVUFBVyxDQUF4RSxDQUFBLENBQUEsQ0FBQTtBQUNBM0ssRUFBQUEsTUFBTSxDQUFDQyxjQUFQLENBQXNCa0osWUFBdEIsRUFBb0NzQixTQUFwQyxFQUErQztBQUMzQ3JLLElBQUFBLEdBQUcsRUFBRSxZQUFZO01BQ2IxQixLQUFLLENBQUNRLEtBQU4sQ0FBWTBMLEdBQVosQ0FBQSxDQUFBO0FBQ0EsTUFBQSxPQUFPLElBQVAsQ0FBQTtLQUh1QztBQUszQ0MsSUFBQUEsR0FBRyxFQUFFLFlBQVk7TUFDYm5NLEtBQUssQ0FBQ1EsS0FBTixDQUFZMEwsR0FBWixDQUFBLENBQUE7QUFDSCxLQUFBO0dBUEwsQ0FBQSxDQUFBO0FBU0gsQ0FiRCxDQUFBLENBQUE7QUFnQkE1SyxNQUFNLENBQUM4SyxnQkFBUCxDQUF3QnRCLFlBQVksQ0FBQ3JKLFNBQXJDLEVBQWdEO0FBQzVDNEssRUFBQUEsY0FBYyxFQUFFO0FBQ1ozSyxJQUFBQSxHQUFHLEVBQUUsWUFBWTtNQUNiMUIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLGdHQUFqQixDQUFBLENBQUE7TUFDQSxPQUFPLElBQUEsQ0FBS3FNLElBQUwsQ0FBVUQsY0FBakIsQ0FBQTtLQUhRO0lBS1pGLEdBQUcsRUFBRSxVQUFVSSxJQUFWLEVBQWdCO01BQ2pCdk0sS0FBSyxDQUFDQyxVQUFOLENBQWlCLGdHQUFqQixDQUFBLENBQUE7QUFDSCxLQUFBO0FBUFcsR0FBQTtBQUQ0QixDQUFoRCxDQUFBLENBQUE7O0FBWUFtTCxZQUFZLENBQUMzSixTQUFiLENBQXVCc0QsTUFBdkIsR0FBZ0MsWUFBWTtFQUN4Qy9FLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixxR0FBakIsQ0FBQSxDQUFBO0FBQ0gsQ0FGRCxDQUFBOztBQUlBcUIsTUFBTSxDQUFDOEssZ0JBQVAsQ0FBd0JsQixPQUFPLENBQUN6SixTQUFoQyxFQUEyQztBQUN2QzhLLEVBQUFBLElBQUksRUFBRTtBQUNGN0ssSUFBQUEsR0FBRyxFQUFFLFlBQVk7TUFDYjFCLEtBQUssQ0FBQ0MsVUFBTixDQUFpQiw2REFBakIsQ0FBQSxDQUFBO01BQ0EsT0FBTyxJQUFBLENBQUt1TSxJQUFMLEtBQWNDLGdCQUFyQixDQUFBO0tBSEY7SUFLRk4sR0FBRyxFQUFFLFVBQVVJLElBQVYsRUFBZ0I7TUFDakJ2TSxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsNkRBQWpCLENBQUEsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLdU0sSUFBTCxHQUFZRCxJQUFJLEdBQUdFLGdCQUFILEdBQXNCQyxtQkFBdEMsQ0FBQTtBQUNILEtBQUE7R0FUa0M7QUFZdkNDLEVBQUFBLFdBQVcsRUFBRTtBQUNUakwsSUFBQUEsR0FBRyxFQUFFLFlBQVk7TUFDYjFCLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixvRUFBakIsQ0FBQSxDQUFBO01BQ0EsT0FBTyxJQUFBLENBQUt1TSxJQUFMLEtBQWNJLHVCQUFyQixDQUFBO0tBSEs7SUFLVFQsR0FBRyxFQUFFLFVBQVVRLFdBQVYsRUFBdUI7TUFDeEIzTSxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsb0VBQWpCLENBQUEsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLdU0sSUFBTCxHQUFZRyxXQUFXLEdBQUdDLHVCQUFILEdBQTZCRixtQkFBcEQsQ0FBQTtBQUNILEtBQUE7R0FwQmtDO0FBdUJ2Q0csRUFBQUEsVUFBVSxFQUFFO0FBQ1JuTCxJQUFBQSxHQUFHLEVBQUUsWUFBWTtNQUNiMUIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLDJGQUFqQixDQUFBLENBQUE7TUFDQSxPQUFPLElBQUEsQ0FBS3FNLElBQUwsQ0FBVU8sVUFBakIsQ0FBQTtBQUNILEtBQUE7QUFKTyxHQUFBO0FBdkIyQixDQUEzQyxDQUFBLENBQUE7QUFpQ08sTUFBTUMsYUFBYSxHQUFHQyxpQkFBdEI7QUFFQSxNQUFNQyxLQUFLLEdBQUc7QUFDakJDLEVBQUFBLGFBQWEsRUFBRUEsYUFERTtBQUVqQkMsRUFBQUEsVUFBVSxFQUFFO0FBQ1JDLElBQUFBLGlCQUFpQixFQUFFQSxpQkFEWDtBQUVSQyxJQUFBQSxVQUFVLEVBQUVBLFVBRko7QUFHUkMsSUFBQUEsV0FBVyxFQUFFQSxXQUhMO0FBSVJDLElBQUFBLGNBQWMsRUFBRUEsY0FKUjtBQUtSQyxJQUFBQSxhQUFhLEVBQUVBLGFBTFA7QUFNUkMsSUFBQUEsVUFBVSxFQUFFQSxVQU5KO0FBT1JDLElBQUFBLFlBQVksRUFBRUEsWUFQTjtBQVFSQyxJQUFBQSxXQUFXLEVBQUVBLFdBUkw7QUFTUkMsSUFBQUEsU0FBUyxFQUFFQSxTQUFBQTtHQVhFO0FBYWpCQyxFQUFBQSxhQUFhLEVBQUVBLGFBYkU7QUFjakJDLEVBQUFBLE9BQU8sRUFBRUEsT0FkUTtBQWVqQkMsRUFBQUEsZUFBZSxFQUFFQSxlQWZBO0FBZ0JqQkMsRUFBQUEsU0FBUyxFQUFFQSxTQWhCTTtBQWlCakJDLEVBQUFBLFFBQVEsRUFBRUEsUUFqQk87QUFrQmpCQyxFQUFBQSxJQUFJLEVBQUVBLElBbEJXO0FBbUJqQkMsRUFBQUEsWUFBWSxFQUFFQSxZQW5CRztBQW9CakJDLEVBQUFBLEtBQUssRUFBRUEsS0FwQlU7QUFxQmpCQyxFQUFBQSxlQUFlLEVBQUVBLGVBckJBO0FBc0JqQnRCLEVBQUFBLGFBQWEsRUFBRUMsZ0JBdEJFO0FBdUJqQnNCLEVBQUFBLE1BQU0sRUFBRUEsTUF2QlM7QUF3QmpCQyxFQUFBQSxVQUFVLEVBQUU7QUFDUkMsSUFBQUEsWUFBWSxFQUFFQyx1QkFETjtBQUVSQyxJQUFBQSxXQUFXLEVBQUVDLHNCQUFBQTtHQTFCQTtBQTRCakJDLEVBQUFBLEtBQUssRUFBRUEsS0E1QlU7QUE2QmpCQyxFQUFBQSxJQUFJLEVBQUVBLElBN0JXO0FBOEJqQkMsRUFBQUEsWUFBWSxFQUFFQSxZQUFBQTtBQTlCRyxFQUFkO0FBaUNQdk4sTUFBTSxDQUFDQyxjQUFQLENBQXNCb04sS0FBSyxDQUFDbE4sU0FBNUIsRUFBdUMsaUJBQXZDLEVBQTBEO0FBQ3REQyxFQUFBQSxHQUFHLEVBQUUsWUFBWTtJQUNiMUIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHlDQUFqQixDQUFBLENBQUE7QUFDQSxJQUFBLE9BQU82TyxrQkFBa0IsQ0FBQ0MsY0FBYyxFQUFBLENBQUdDLGNBQWxCLENBQXpCLENBQUE7QUFDSCxHQUFBO0FBSnFELENBQTFELENBQUEsQ0FBQTtBQVFBLENBQUMsS0FBRCxFQUFRLElBQVIsRUFBYyxJQUFkLEVBQW9CLElBQXBCLEVBQTBCLEdBQTFCLEVBQStCLEdBQS9CLEVBQW9DbEQsT0FBcEMsQ0FBNEMsQ0FBQ21ELElBQUQsRUFBT0MsS0FBUCxLQUFpQjtFQUN6RDVOLE1BQU0sQ0FBQ0MsY0FBUCxDQUFzQm9OLEtBQUssQ0FBQ2xOLFNBQTVCLEVBQXdDLENBQUEsaUJBQUEsRUFBbUJ3TixJQUFLLENBQUEsQ0FBaEUsRUFBbUU7QUFDL0R2TixJQUFBQSxHQUFHLEVBQUUsWUFBWTtBQUNiMUIsTUFBQUEsS0FBSyxDQUFDQyxVQUFOLENBQWtCLENBQUEsMEJBQUEsRUFBNEJnUCxJQUFLLENBQW5ELHlEQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ0EsTUFBQSxPQUFPLElBQUtFLENBQUFBLG9CQUFMLENBQTBCRCxLQUExQixDQUFQLENBQUE7S0FIMkQ7SUFLL0QvQyxHQUFHLEVBQUUsVUFBVWlELEtBQVYsRUFBaUI7QUFDbEJwUCxNQUFBQSxLQUFLLENBQUNDLFVBQU4sQ0FBa0IsQ0FBQSwwQkFBQSxFQUE0QmdQLElBQUssQ0FBbkQseURBQUEsQ0FBQSxDQUFBLENBQUE7QUFDQSxNQUFBLElBQUEsQ0FBS0Usb0JBQUwsQ0FBMEJELEtBQTFCLENBQUEsR0FBbUNFLEtBQW5DLENBQUE7TUFDQSxJQUFLQyxDQUFBQSxhQUFMLEdBQXFCLElBQXJCLENBQUE7QUFDSCxLQUFBO0dBVEwsQ0FBQSxDQUFBO0FBV0gsQ0FaRCxDQUFBLENBQUE7QUFjQS9OLE1BQU0sQ0FBQ0MsY0FBUCxDQUFzQm9OLEtBQUssQ0FBQ2xOLFNBQTVCLEVBQXVDLFFBQXZDLEVBQWlEO0FBQzdDQyxFQUFBQSxHQUFHLEVBQUUsWUFBWTtJQUNiLElBQUksQ0FBQyxJQUFLNE4sQ0FBQUEsT0FBVixFQUFtQjtNQUNmLElBQUtBLENBQUFBLE9BQUwsR0FBZSxFQUFmLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsT0FBTyxLQUFLQSxPQUFaLENBQUE7QUFDSCxHQUFBO0FBTjRDLENBQWpELENBQUEsQ0FBQTs7QUFVQVgsS0FBSyxDQUFDbE4sU0FBTixDQUFnQjhOLGFBQWhCLEdBQWdDLFVBQVVDLE1BQVYsRUFBa0I7RUFDOUN4UCxLQUFLLENBQUNDLFVBQU4sQ0FBa0IsQ0FBbEIsc0VBQUEsQ0FBQSxDQUFBLENBQUE7O0VBQ0EsSUFBS3dQLENBQUFBLFVBQUwsQ0FBZ0JELE1BQWhCLENBQUEsQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQWIsS0FBSyxDQUFDbE4sU0FBTixDQUFnQmlPLFFBQWhCLEdBQTJCLFVBQVVDLEtBQVYsRUFBaUI7RUFDeEMzUCxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsa0NBQWpCLENBQUEsQ0FBQTtBQUNBLEVBQUEsSUFBSSxJQUFLMlAsQ0FBQUEsYUFBTCxDQUFtQkQsS0FBbkIsQ0FBSixFQUErQixPQUFBO0VBQy9CLE1BQU1FLEtBQUssR0FBRyxJQUFLQyxDQUFBQSxNQUFMLENBQVlDLFlBQVosQ0FBeUJDLGFBQXpCLENBQWQsQ0FBQTtFQUNBLElBQUksQ0FBQ0gsS0FBTCxFQUFZLE9BQUE7QUFDWkEsRUFBQUEsS0FBSyxDQUFDSSxnQkFBTixDQUF1Qk4sS0FBSyxDQUFDTyxhQUE3QixDQUFBLENBQUE7QUFDQSxFQUFBLElBQUEsQ0FBS0MsTUFBTCxDQUFZQyxJQUFaLENBQWlCVCxLQUFqQixDQUFBLENBQUE7QUFDSCxDQVBELENBQUE7O0FBU0FoQixLQUFLLENBQUNsTixTQUFOLENBQWdCNE8sZUFBaEIsR0FBa0MsVUFBVVYsS0FBVixFQUFpQjtFQUMvQzNQLEtBQUssQ0FBQ0MsVUFBTixDQUFpQix5Q0FBakIsQ0FBQSxDQUFBO0VBQ0EsTUFBTTRQLEtBQUssR0FBRyxJQUFLQyxDQUFBQSxNQUFMLENBQVlDLFlBQVosQ0FBeUJDLGFBQXpCLENBQWQsQ0FBQTtFQUNBLElBQUksQ0FBQ0gsS0FBTCxFQUFZLE9BQUE7QUFDWkEsRUFBQUEsS0FBSyxDQUFDUyxnQkFBTixDQUF1QlgsS0FBSyxDQUFDTyxhQUE3QixDQUFBLENBQUE7QUFDSCxDQUxELENBQUE7O0FBT0F2QixLQUFLLENBQUNsTixTQUFOLENBQWdCOE8sV0FBaEIsR0FBOEIsVUFBVVosS0FBVixFQUFpQjtFQUMzQzNQLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixxQ0FBakIsQ0FBQSxDQUFBO0VBQ0EsTUFBTWlQLEtBQUssR0FBRyxJQUFLaUIsQ0FBQUEsTUFBTCxDQUFZSyxPQUFaLENBQW9CYixLQUFwQixDQUFkLENBQUE7O0FBQ0EsRUFBQSxJQUFJVCxLQUFLLEtBQUssQ0FBQyxDQUFmLEVBQWtCO0lBQ2QsTUFBTVcsS0FBSyxHQUFHLElBQUtDLENBQUFBLE1BQUwsQ0FBWUMsWUFBWixDQUF5QkMsYUFBekIsQ0FBZCxDQUFBO0lBQ0EsSUFBSSxDQUFDSCxLQUFMLEVBQVksT0FBQTtBQUNaQSxJQUFBQSxLQUFLLENBQUNZLG1CQUFOLENBQTBCZCxLQUFLLENBQUNPLGFBQWhDLENBQUEsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLQyxNQUFMLENBQVlPLE1BQVosQ0FBbUJ4QixLQUFuQixFQUEwQixDQUExQixDQUFBLENBQUE7QUFDSCxHQUFBO0FBQ0osQ0FURCxDQUFBOztBQVdBUCxLQUFLLENBQUNsTixTQUFOLENBQWdCa1AsbUJBQWhCLEdBQXNDLFVBQVVoQixLQUFWLEVBQWlCO0VBQ25EM1AsS0FBSyxDQUFDQyxVQUFOLENBQWlCLDZDQUFqQixDQUFBLENBQUE7RUFDQSxNQUFNNFAsS0FBSyxHQUFHLElBQUtDLENBQUFBLE1BQUwsQ0FBWUMsWUFBWixDQUF5QkMsYUFBekIsQ0FBZCxDQUFBO0VBQ0EsSUFBSSxDQUFDSCxLQUFMLEVBQVksT0FBQTtBQUNaQSxFQUFBQSxLQUFLLENBQUNjLG1CQUFOLENBQTBCaEIsS0FBSyxDQUFDTyxhQUFoQyxDQUFBLENBQUE7QUFDSCxDQUxELENBQUE7O0FBT0F2QixLQUFLLENBQUNsTixTQUFOLENBQWdCbU8sYUFBaEIsR0FBZ0MsVUFBVUQsS0FBVixFQUFpQjtFQUM3QzNQLEtBQUssQ0FBQ0MsVUFBTixDQUFpQix1Q0FBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxPQUFPLEtBQUtrUSxNQUFMLENBQVlLLE9BQVosQ0FBb0JiLEtBQXBCLEtBQThCLENBQXJDLENBQUE7QUFDSCxDQUhELENBQUE7O0FBS0FoQixLQUFLLENBQUNsTixTQUFOLENBQWdCbVAsU0FBaEIsR0FBNEIsVUFBVWpCLEtBQVYsRUFBaUI7RUFDekMzUCxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsbUNBQWpCLENBQUEsQ0FBQTtBQUNBLEVBQUEsT0FBTyxLQUFLa1EsTUFBWixDQUFBO0FBQ0gsQ0FIRCxDQUFBOztBQUtBN08sTUFBTSxDQUFDQyxjQUFQLENBQXNCc1AsS0FBSyxDQUFDcFAsU0FBNUIsRUFBdUMsT0FBdkMsRUFBZ0Q7QUFDNUNDLEVBQUFBLEdBQUcsRUFBRSxZQUFZO0lBQ2IxQixLQUFLLENBQUNDLFVBQU4sQ0FBaUIseUZBQWpCLENBQUEsQ0FBQTtBQUNBLElBQUEsT0FBTyxJQUFQLENBQUE7QUFDSCxHQUFBO0FBSjJDLENBQWhELENBQUEsQ0FBQTs7QUFPQTZOLGVBQWUsQ0FBQ3JNLFNBQWhCLENBQTBCcVAsaUJBQTFCLEdBQThDLFVBQVVDLElBQVYsRUFBZ0I7RUFDMUQvUSxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsK0ZBQWpCLENBQUEsQ0FBQTtFQUNBOE8sY0FBYyxFQUFBLENBQUcrQixpQkFBakIsQ0FBbUNDLElBQW5DLENBQUEsQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQWpELGVBQWUsQ0FBQ3JNLFNBQWhCLENBQTBCdVAsWUFBMUIsR0FBeUMsVUFBVUMsWUFBVixFQUF3QkMsT0FBeEIsRUFBaUNDLGVBQWpDLEVBQWtEQyxJQUFsRCxFQUF3REMsWUFBeEQsRUFBc0U7RUFDM0dyUixLQUFLLENBQUNDLFVBQU4sQ0FBaUIsc0ZBQWpCLENBQUEsQ0FBQTtFQUNBLE1BQU0rTSxLQUFLLEdBQUdpRSxZQUFZLENBQUNLLFFBQWIsQ0FBc0JDLE1BQXRCLElBQWdDeEMsY0FBYyxFQUFBLENBQUcvQixLQUEvRCxDQUFBO0VBQ0EsT0FBT2lFLFlBQVksQ0FBQ08sZ0JBQWIsQ0FBOEJ4RSxLQUE5QixFQUFxQ29FLElBQXJDLEVBQTJDRCxlQUEzQyxFQUE0REUsWUFBNUQsQ0FBUCxDQUFBO0FBQ0gsQ0FKRCxDQUFBOztBQU1BbkQsWUFBWSxDQUFDek0sU0FBYixDQUF1QmdRLFFBQXZCLEdBQWtDLFlBQVk7RUFDMUN6UixLQUFLLENBQUNDLFVBQU4sQ0FBaUIseUNBQWpCLENBQUEsQ0FBQTtBQUNILENBRkQsQ0FBQTs7QUFJQXlSLEtBQUssQ0FBQ2pRLFNBQU4sQ0FBZ0JrUSxTQUFoQixHQUE0QixVQUFVekMsS0FBVixFQUFpQjtFQUN6Q2xQLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixpRUFBakIsQ0FBQSxDQUFBO0FBRUEsRUFBQSxPQUFPLElBQUsyUixDQUFBQSxPQUFMLENBQWExQyxLQUFiLENBQVAsQ0FBQTtBQUNILENBSkQsQ0FBQTs7QUFNQW5CLFNBQVMsQ0FBQ3RNLFNBQVYsQ0FBb0JvUSxRQUFwQixHQUErQixVQUFVQyxLQUFWLEVBQWlCO0VBQzVDOVIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLDRHQUFqQixDQUFBLENBQUE7QUFDQSxFQUFBLElBQUk2UixLQUFKLEVBQ0ksSUFBQSxDQUFLQyxhQUFMLEVBREosQ0FBQSxLQUdJLEtBQUtDLGFBQUwsRUFBQSxDQUFBO0FBQ1AsQ0FORCxDQUFBOztBQVFBakUsU0FBUyxDQUFDdE0sU0FBVixDQUFvQndRLFFBQXBCLEdBQStCLFVBQVVDLEtBQVYsRUFBaUI7RUFDNUNsUyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIscUVBQWpCLENBQUEsQ0FBQTtBQUVBLEVBQUEsSUFBQSxDQUFLa1MsT0FBTCxDQUFhRCxLQUFiLENBQUEsR0FBc0IsSUFBdEIsQ0FBQTtBQUNILENBSkQsQ0FBQTs7QUFNQW5FLFNBQVMsQ0FBQ3RNLFNBQVYsQ0FBb0IyUSxTQUFwQixHQUFnQyxZQUFZO0VBQ3hDcFMsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHNFQUFqQixDQUFBLENBQUE7QUFFQSxFQUFBLE9BQU9xQixNQUFNLENBQUN1SyxJQUFQLENBQVksSUFBQSxDQUFLc0csT0FBakIsQ0FBUCxDQUFBO0FBQ0gsQ0FKRCxDQUFBOztBQU1BcEUsU0FBUyxDQUFDdE0sU0FBVixDQUFvQjRRLFFBQXBCLEdBQStCLFVBQVVILEtBQVYsRUFBaUI7RUFDNUNsUyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIscUVBQWpCLENBQUEsQ0FBQTtBQUVBLEVBQUEsT0FBTyxDQUFDLENBQUMsSUFBQSxDQUFLa1MsT0FBTCxDQUFhRCxLQUFiLENBQVQsQ0FBQTtBQUNILENBSkQsQ0FBQTs7QUFNQW5FLFNBQVMsQ0FBQ3RNLFNBQVYsQ0FBb0I2USxXQUFwQixHQUFrQyxVQUFVSixLQUFWLEVBQWlCO0VBQy9DbFMsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHdFQUFqQixDQUFBLENBQUE7QUFFQSxFQUFBLE9BQU8sSUFBS2tTLENBQUFBLE9BQUwsQ0FBYUQsS0FBYixDQUFQLENBQUE7QUFDSCxDQUpELENBQUE7O0FBTUFuRSxTQUFTLENBQUN0TSxTQUFWLENBQW9COFEsV0FBcEIsR0FBa0MsVUFBVUwsS0FBVixFQUFpQk0sT0FBTyxHQUFHLEVBQTNCLEVBQStCO0VBQzdEeFMsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHdFQUFqQixDQUFBLENBQUE7O0FBRUEsRUFBQSxJQUFJLElBQUtvUyxDQUFBQSxRQUFMLENBQWNILEtBQWQsQ0FBSixFQUEwQjtJQUN0Qk0sT0FBTyxDQUFDcEMsSUFBUixDQUFhLElBQWIsQ0FBQSxDQUFBO0FBQ0gsR0FBQTs7QUFFRCxFQUFBLEtBQUssSUFBSXFDLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcsSUFBS0MsQ0FBQUEsU0FBTCxDQUFlQyxNQUFuQyxFQUEyQyxFQUFFRixDQUE3QyxFQUFnRDtJQUM1Q0QsT0FBTyxHQUFHLElBQUtFLENBQUFBLFNBQUwsQ0FBZUQsQ0FBZixDQUFrQkYsQ0FBQUEsV0FBbEIsQ0FBOEJMLEtBQTlCLEVBQXFDTSxPQUFyQyxDQUFWLENBQUE7QUFDSCxHQUFBOztBQUVELEVBQUEsT0FBT0EsT0FBUCxDQUFBO0FBQ0gsQ0FaRCxDQUFBOztBQWNBekUsU0FBUyxDQUFDdE0sU0FBVixDQUFvQm1SLFdBQXBCLEdBQWtDLFlBQVk7RUFDMUM1UyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsNEVBQWpCLENBQUEsQ0FBQTtBQUVBLEVBQUEsT0FBTyxLQUFLNFMsUUFBWixDQUFBO0FBQ0gsQ0FKRCxDQUFBOztBQU1BOUUsU0FBUyxDQUFDdE0sU0FBVixDQUFvQnFSLE9BQXBCLEdBQThCLFlBQVk7RUFDdEM5UyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsb0VBQWpCLENBQUEsQ0FBQTtBQUVBLEVBQUEsT0FBTyxLQUFLcUcsSUFBWixDQUFBO0FBQ0gsQ0FKRCxDQUFBOztBQU1BeUgsU0FBUyxDQUFDdE0sU0FBVixDQUFvQnNSLE9BQXBCLEdBQThCLFlBQVk7RUFDdEMvUyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsb0VBQWpCLENBQUEsQ0FBQTtBQUVBLEVBQUEsT0FBTyxLQUFLK1MsSUFBWixDQUFBO0FBQ0gsQ0FKRCxDQUFBOztBQU1BakYsU0FBUyxDQUFDdE0sU0FBVixDQUFvQndSLE9BQXBCLEdBQThCLFlBQVk7RUFDdENqVCxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsb0VBQWpCLENBQUEsQ0FBQTtBQUVBLEVBQUEsT0FBTyxLQUFLaVQsSUFBWixDQUFBO0FBQ0gsQ0FKRCxDQUFBOztBQU1BbkYsU0FBUyxDQUFDdE0sU0FBVixDQUFvQjBSLFNBQXBCLEdBQWdDLFlBQVk7RUFDeENuVCxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsd0VBQWpCLENBQUEsQ0FBQTtBQUVBLEVBQUEsT0FBTyxLQUFLbVQsTUFBWixDQUFBO0FBQ0gsQ0FKRCxDQUFBOztBQU1BckYsU0FBUyxDQUFDdE0sU0FBVixDQUFvQjRSLE9BQXBCLEdBQThCLFVBQVUvTSxJQUFWLEVBQWdCO0VBQzFDdEcsS0FBSyxDQUFDQyxVQUFOLENBQWlCLG9FQUFqQixDQUFBLENBQUE7RUFFQSxJQUFLcUcsQ0FBQUEsSUFBTCxHQUFZQSxJQUFaLENBQUE7QUFDSCxDQUpELENBQUE7O0FBTUEwSCxRQUFRLENBQUN2TSxTQUFULENBQW1CcVIsT0FBbkIsR0FBNkIsWUFBWTtFQUNyQzlTLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixrRUFBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxPQUFPLEtBQUtxRyxJQUFaLENBQUE7QUFDSCxDQUhELENBQUE7O0FBS0EwSCxRQUFRLENBQUN2TSxTQUFULENBQW1CNFIsT0FBbkIsR0FBNkIsVUFBVS9NLElBQVYsRUFBZ0I7RUFDekN0RyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsa0VBQWpCLENBQUEsQ0FBQTtFQUNBLElBQUtxRyxDQUFBQSxJQUFMLEdBQVlBLElBQVosQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQTBILFFBQVEsQ0FBQ3ZNLFNBQVQsQ0FBbUI2UixTQUFuQixHQUErQixZQUFZO0VBQ3ZDdFQsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHNFQUFqQixDQUFBLENBQUE7QUFDQSxFQUFBLE9BQU8sS0FBS3NULE1BQVosQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQXZGLFFBQVEsQ0FBQ3ZNLFNBQVQsQ0FBbUIrUixTQUFuQixHQUErQixVQUFVRCxNQUFWLEVBQWtCO0VBQzdDdlQsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHNFQUFqQixDQUFBLENBQUE7RUFDQSxJQUFLc1QsQ0FBQUEsTUFBTCxHQUFjQSxNQUFkLENBQUE7QUFDSCxDQUhELENBQUE7O0FBS0EsU0FBU0UsWUFBVCxDQUFzQkMsT0FBdEIsRUFBK0JDLE9BQS9CLEVBQXdDO0VBQ3BDclMsTUFBTSxDQUFDQyxjQUFQLENBQXNCd0wsZ0JBQWdCLENBQUN0TCxTQUF2QyxFQUFrRGtTLE9BQWxELEVBQTJEO0FBQ3ZEalMsSUFBQUEsR0FBRyxFQUFFLFlBQVk7QUFDYjFCLE1BQUFBLEtBQUssQ0FBQ0MsVUFBTixDQUFrQix1QkFBc0IwVCxPQUFRLENBQUEsd0NBQUEsRUFBMENELE9BQVEsQ0FBbEcsU0FBQSxDQUFBLENBQUEsQ0FBQTtNQUNBLE9BQU8sSUFBQSxDQUFLQSxPQUFMLENBQVAsQ0FBQTtLQUhtRDtJQUt2RHZILEdBQUcsRUFBRSxVQUFVaUQsS0FBVixFQUFpQjtBQUNsQnBQLE1BQUFBLEtBQUssQ0FBQ0MsVUFBTixDQUFrQix1QkFBc0IwVCxPQUFRLENBQUEsd0NBQUEsRUFBMENELE9BQVEsQ0FBbEcsU0FBQSxDQUFBLENBQUEsQ0FBQTtNQUNBLElBQUtBLENBQUFBLE9BQUwsSUFBZ0J0RSxLQUFoQixDQUFBO0FBQ0gsS0FBQTtHQVJMLENBQUEsQ0FBQTtBQVVILENBQUE7O0FBRURxRSxZQUFZLENBQUMsYUFBRCxFQUFnQixnQkFBaEIsQ0FBWixDQUFBOztBQUNBQSxZQUFZLENBQUMsY0FBRCxFQUFpQixpQkFBakIsQ0FBWixDQUFBOztBQUNBQSxZQUFZLENBQUMsY0FBRCxFQUFpQixpQkFBakIsQ0FBWixDQUFBOztBQUNBQSxZQUFZLENBQUMsZUFBRCxFQUFrQixrQkFBbEIsQ0FBWixDQUFBOztBQUNBQSxZQUFZLENBQUMsb0JBQUQsRUFBdUIsdUJBQXZCLENBQVosQ0FBQTs7QUFDQUEsWUFBWSxDQUFDLHFCQUFELEVBQXdCLHdCQUF4QixDQUFaLENBQUE7O0FBQ0FBLFlBQVksQ0FBQyxxQkFBRCxFQUF3Qix3QkFBeEIsQ0FBWixDQUFBOztBQUNBQSxZQUFZLENBQUMsc0JBQUQsRUFBeUIseUJBQXpCLENBQVosQ0FBQTs7QUFDQUEsWUFBWSxDQUFDLGtCQUFELEVBQXFCLHFCQUFyQixDQUFaLENBQUE7O0FBQ0FBLFlBQVksQ0FBQyxvQkFBRCxFQUF1Qix1QkFBdkIsQ0FBWixDQUFBOztBQUNBQSxZQUFZLENBQUMsa0JBQUQsRUFBcUIscUJBQXJCLENBQVosQ0FBQTs7QUFJTyxNQUFNRyxJQUFJLEdBQUc7QUFDaEJDLEVBQUFBLFNBQVMsRUFBRUEsU0FESztBQUVoQkMsRUFBQUEsR0FBRyxFQUFFQSxHQUZXO0FBR2hCQyxFQUFBQSxJQUFJLEVBQUVBLElBSFU7QUFJaEJDLEVBQUFBLFFBQVEsRUFBRUEsUUFBQUE7QUFKTSxFQUFiOztBQU9QSCxTQUFTLENBQUNwUyxTQUFWLENBQW9Cd1MsV0FBcEIsR0FBa0MsWUFBWTtFQUMxQ2pVLEtBQUssQ0FBQ0MsVUFBTixDQUFpQiw0RUFBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxPQUFPLEtBQUtpVSxRQUFaLENBQUE7QUFDSCxDQUhELENBQUE7O0FBS0FMLFNBQVMsQ0FBQ3BTLFNBQVYsQ0FBb0JxUixPQUFwQixHQUE4QixZQUFZO0VBQ3RDOVMsS0FBSyxDQUFDQyxVQUFOLENBQWlCLG9FQUFqQixDQUFBLENBQUE7QUFDQSxFQUFBLE9BQU8sS0FBS3FHLElBQVosQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQXVOLFNBQVMsQ0FBQ3BTLFNBQVYsQ0FBb0IwUyxRQUFwQixHQUErQixZQUFZO0VBQ3ZDblUsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHNFQUFqQixDQUFBLENBQUE7QUFDQSxFQUFBLE9BQU8sS0FBS21VLEtBQVosQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQVAsU0FBUyxDQUFDcFMsU0FBVixDQUFvQjRTLFdBQXBCLEdBQWtDLFVBQVVILFFBQVYsRUFBb0I7RUFDbERsVSxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsNEVBQWpCLENBQUEsQ0FBQTtFQUNBLElBQUtpVSxDQUFBQSxRQUFMLEdBQWdCQSxRQUFoQixDQUFBO0FBQ0gsQ0FIRCxDQUFBOztBQUtBTCxTQUFTLENBQUNwUyxTQUFWLENBQW9CNFIsT0FBcEIsR0FBOEIsVUFBVS9NLElBQVYsRUFBZ0I7RUFDMUN0RyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsb0VBQWpCLENBQUEsQ0FBQTtFQUNBLElBQUtxRyxDQUFBQSxJQUFMLEdBQVlBLElBQVosQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQTBOLFFBQVEsQ0FBQ3ZTLFNBQVQsQ0FBbUI2UyxZQUFuQixHQUFrQyxZQUFZO0VBQzFDdFUsS0FBSyxDQUFDQyxVQUFOLENBQWlCLDRFQUFqQixDQUFBLENBQUE7QUFDQSxFQUFBLE9BQU8sS0FBS3NVLFNBQVosQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQVAsUUFBUSxDQUFDdlMsU0FBVCxDQUFtQitTLGNBQW5CLEdBQW9DLFlBQVk7RUFDNUN4VSxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsZ0ZBQWpCLENBQUEsQ0FBQTtBQUNBLEVBQUEsT0FBTyxLQUFLd1UsV0FBWixDQUFBO0FBQ0gsQ0FIRCxDQUFBOztBQUtBVCxRQUFRLENBQUN2UyxTQUFULENBQW1CaVQsVUFBbkIsR0FBZ0MsWUFBWTtFQUN4QzFVLEtBQUssQ0FBQ0MsVUFBTixDQUFpQix3RUFBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxPQUFPLEtBQUswVSxPQUFaLENBQUE7QUFDSCxDQUhELENBQUE7O0FBS0FYLFFBQVEsQ0FBQ3ZTLFNBQVQsQ0FBbUJtVCxXQUFuQixHQUFpQyxZQUFZO0VBQ3pDNVUsS0FBSyxDQUFDQyxVQUFOLENBQWlCLDBFQUFqQixDQUFBLENBQUE7QUFDQSxFQUFBLE9BQU8sS0FBSzRVLFFBQVosQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQWIsUUFBUSxDQUFDdlMsU0FBVCxDQUFtQnFULFlBQW5CLEdBQWtDLFVBQVVQLFNBQVYsRUFBcUI7RUFDbkR2VSxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsNEVBQWpCLENBQUEsQ0FBQTtFQUNBLElBQUtzVSxDQUFBQSxTQUFMLEdBQWlCQSxTQUFqQixDQUFBO0FBQ0gsQ0FIRCxDQUFBOztBQUtBUCxRQUFRLENBQUN2UyxTQUFULENBQW1Cc1QsY0FBbkIsR0FBb0MsVUFBVTVULElBQVYsRUFBZ0I7RUFDaERuQixLQUFLLENBQUNDLFVBQU4sQ0FBaUIsZ0ZBQWpCLENBQUEsQ0FBQTtFQUNBLElBQUt3VSxDQUFBQSxXQUFMLEdBQW1CdFQsSUFBbkIsQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQTZTLFFBQVEsQ0FBQ3ZTLFNBQVQsQ0FBbUJ1VCxVQUFuQixHQUFnQyxVQUFVTCxPQUFWLEVBQW1CO0VBQy9DM1UsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHdFQUFqQixDQUFBLENBQUE7RUFDQSxJQUFLMFUsQ0FBQUEsT0FBTCxHQUFlQSxPQUFmLENBQUE7QUFDSCxDQUhELENBQUE7O0FBT08sTUFBTU0sS0FBSyxHQUFHO0FBQ2pCQyxFQUFBQSxZQUFZLEVBQUVDLFlBREc7QUFFakJDLEVBQUFBLE9BQU8sRUFBRUEsT0FGUTtBQUdqQkMsRUFBQUEsU0FBUyxFQUFFQSxTQUhNO0FBSWpCQyxFQUFBQSxRQUFRLEVBQUVBLFFBSk87QUFLakJDLEVBQUFBLEtBQUssRUFBRUEsS0FBQUE7QUFMVSxFQUFkOztBQVFQSixZQUFZLENBQUMxVCxTQUFiLENBQXVCK1QsV0FBdkIsR0FBcUMsWUFBWTtFQUM3Q3hWLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixrRkFBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxPQUFPLEtBQUt3VixRQUFaLENBQUE7QUFDSCxDQUhELENBQUE7O0FBS0FOLFlBQVksQ0FBQzFULFNBQWIsQ0FBdUJpVSxTQUF2QixHQUFtQyxZQUFZO0VBQzNDMVYsS0FBSyxDQUFDQyxVQUFOLENBQWlCLDhFQUFqQixDQUFBLENBQUE7QUFDQSxFQUFBLE9BQU8sS0FBSzBWLE1BQVosQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQVIsWUFBWSxDQUFDMVQsU0FBYixDQUF1Qm1VLFNBQXZCLEdBQW1DLFVBQVVELE1BQVYsRUFBa0I7RUFDakQzVixLQUFLLENBQUNDLFVBQU4sQ0FBaUIsOEVBQWpCLENBQUEsQ0FBQTtFQUNBLElBQUswVixDQUFBQSxNQUFMLEdBQWNBLE1BQWQsQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFPTyxNQUFNRSxLQUFLLEdBQUc7QUFDakJDLEVBQUFBLGVBQWUsRUFBRSxXQURBO0FBRWpCQyxFQUFBQSxXQUFXLEVBQUUsT0FGSTtBQUdqQkMsRUFBQUEsV0FBVyxFQUFFLE9BSEk7QUFJakJDLEVBQUFBLFVBQVUsRUFBRSxNQUpLO0FBS2pCQyxFQUFBQSxXQUFXLEVBQUUsT0FMSTtBQU1qQkMsRUFBQUEsY0FBYyxFQUFFLFVBTkM7QUFPakJDLEVBQUFBLFVBQVUsRUFBRSxNQVBLO0FBUWpCQyxFQUFBQSxhQUFhLEVBQUUsU0FSRTtBQVNqQkMsRUFBQUEsYUFBYSxFQUFFLFNBVEU7QUFVakJDLEVBQUFBLFlBQVksRUFBRSxRQUFBO0FBVkcsRUFBZDs7QUFhUEMsYUFBYSxDQUFDL1UsU0FBZCxDQUF3QmdWLFlBQXhCLEdBQXVDLFVBQVVDLEVBQVYsRUFBYztFQUNqRDFXLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixnRkFBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxPQUFPLElBQUt5QixDQUFBQSxHQUFMLENBQVNnVixFQUFULENBQVAsQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFPQXBWLE1BQU0sQ0FBQ0MsY0FBUCxDQUFzQm9WLGFBQWEsQ0FBQ2xWLFNBQXBDLEVBQStDLEtBQS9DLEVBQXNEO0FBQ2xEQyxFQUFBQSxHQUFHLEVBQUUsWUFBWTtJQUNiMUIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLCtHQUFqQixDQUFBLENBQUE7QUFDQSxJQUFBLE9BQU8sS0FBSzJXLFNBQVosQ0FBQTtBQUNILEdBQUE7QUFKaUQsQ0FBdEQsQ0FBQSxDQUFBO0FBT0F0VixNQUFNLENBQUNDLGNBQVAsQ0FBc0JvVixhQUFhLENBQUNsVixTQUFwQyxFQUErQyxVQUEvQyxFQUEyRDtBQUN2REMsRUFBQUEsR0FBRyxFQUFFLFlBQVk7SUFDYjFCLEtBQUssQ0FBQ0MsVUFBTixDQUFpQix5RkFBakIsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxPQUFPLEtBQUs0VyxjQUFaLENBQUE7QUFDSCxHQUFBO0FBSnNELENBQTNELENBQUEsQ0FBQTtBQU9BdlYsTUFBTSxDQUFDQyxjQUFQLENBQXNCb1YsYUFBYSxDQUFDbFYsU0FBcEMsRUFBK0MsVUFBL0MsRUFBMkQ7QUFDdkRDLEVBQUFBLEdBQUcsRUFBRSxZQUFZO0lBQ2IxQixLQUFLLENBQUNDLFVBQU4sQ0FBaUIseUZBQWpCLENBQUEsQ0FBQTtBQUNBLElBQUEsT0FBTyxLQUFLNlcsY0FBWixDQUFBO0FBQ0gsR0FBQTtBQUpzRCxDQUEzRCxDQUFBLENBQUE7QUFTTyxNQUFNQyxLQUFLLEdBQUc7QUFDakJDLEVBQUFBLG9CQUFvQixFQUFFQSxvQkFETDtBQUVqQkMsRUFBQUEsVUFBVSxFQUFFQSxVQUZLO0FBR2pCQyxFQUFBQSxRQUFRLEVBQUVBLFFBSE87QUFJakJDLEVBQUFBLFFBQVEsRUFBRUEsUUFKTztBQUtqQkMsRUFBQUEsYUFBYSxFQUFFQSxhQUxFO0FBTWpCQyxFQUFBQSxLQUFLLEVBQUVBLEtBTlU7QUFPakJDLEVBQUFBLFVBQVUsRUFBRUEsVUFQSztBQVFqQkMsRUFBQUEsS0FBSyxFQUFFQSxLQVJVO0FBU2pCQyxFQUFBQSxXQUFXLEVBQUVBLFdBVEk7QUFVakJDLEVBQUFBLFVBQVUsRUFBRUEsVUFBQUE7QUFWSyxFQUFkO0FBYVBuVyxNQUFNLENBQUNDLGNBQVAsQ0FBc0JtVyxZQUFZLENBQUNqVyxTQUFuQyxFQUE4QyxPQUE5QyxFQUF1RDtBQUNuREMsRUFBQUEsR0FBRyxFQUFFLFlBQVk7QUFDYixJQUFBLE9BQU8sSUFBS2lXLENBQUFBLFVBQUwsR0FBa0IsQ0FBQyxDQUExQixDQUFBO0FBQ0gsR0FBQTtBQUhrRCxDQUF2RCxDQUFBLENBQUE7QUFNQXJXLE1BQU0sQ0FBQ0MsY0FBUCxDQUFzQitWLFVBQVUsQ0FBQzdWLFNBQWpDLEVBQTRDLE9BQTVDLEVBQXFEO0FBQ2pEQyxFQUFBQSxHQUFHLEVBQUUsWUFBWTtBQUNiLElBQUEsT0FBTyxJQUFLaVcsQ0FBQUEsVUFBTCxHQUFrQixDQUFDLENBQTFCLENBQUE7QUFDSCxHQUFBO0FBSGdELENBQXJELENBQUEsQ0FBQTtBQVFPLE1BQU1DLHFCQUFxQixHQUFHQyxnQkFBOUI7QUFDQSxNQUFNQyxzQkFBc0IsR0FBR0MsaUJBQS9CO0FBQ0EsTUFBTUMsd0JBQXdCLEdBQUdDLG1CQUFqQztBQUNBLE1BQU1DLDBCQUEwQixHQUFHQyx1QkFBbkM7QUFDQSxNQUFNQyw2QkFBNkIsR0FBR0MsMEJBQXRDO0FBQ0EsTUFBTUMsOEJBQThCLEdBQUdDLDJCQUF2QztBQUNBLE1BQU1DLG9CQUFvQixHQUFHQyxxQkFBN0I7QUFDQSxNQUFNQyx5QkFBeUIsR0FBR0MsMEJBQWxDO0FBQ0EsTUFBTUMsNEJBQTRCLEdBQUdDLDZCQUFyQztBQUNBLE1BQU1DLDhCQUE4QixHQUFHQywrQkFBdkM7QUFDQSxNQUFNQyw0QkFBNEIsR0FBR0MsNkJBQXJDO0FBRUEsTUFBTUMsRUFBRSxHQUFHO0FBQ2RDLEVBQUFBLFdBQVcsRUFBRUEsV0FEQztBQUVkQyxFQUFBQSxTQUFTLEVBQUVBLFNBRkc7QUFHZEMsRUFBQUEsZUFBZSxFQUFFQSxlQUhIO0FBSWRDLEVBQUFBLE1BQU0sRUFBRUEsTUFKTTtBQUtkQyxFQUFBQSxRQUFRLEVBQUU7QUFDTkMsSUFBQUEsSUFBSSxFQUFFQyxhQURBO0FBRU5DLElBQUFBLFdBQVcsRUFBRUMsb0JBRlA7QUFHTkMsSUFBQUEsV0FBVyxFQUFFQyxvQkFBQUE7R0FSSDtBQVVkQyxFQUFBQSxjQUFjLEVBQUU7QUFDWkMsSUFBQUEsSUFBSSxFQUFFQyxlQURNO0FBRVpDLElBQUFBLEtBQUssRUFBRUMsZ0JBQUFBO0FBRkssR0FBQTtBQVZGLEVBQVg7O0FBZ0JQZixXQUFXLENBQUMxWCxTQUFaLENBQXNCMFksWUFBdEIsR0FBcUMsWUFBWTtFQUM3Q25hLEtBQUssQ0FBQ0MsVUFBTixDQUFpQiw2RUFBakIsQ0FBQSxDQUFBO0FBRUEsRUFBQSxPQUFPLENBQUMsQ0FBQ21hLFFBQVEsQ0FBQ0MsaUJBQWxCLENBQUE7QUFDSCxDQUpELENBQUE7O0FBTUFsQixXQUFXLENBQUMxWCxTQUFaLENBQXNCNlksZ0JBQXRCLEdBQXlDLFVBQVVDLE9BQVYsRUFBbUJDLE9BQW5CLEVBQTRCaGEsS0FBNUIsRUFBbUM7RUFDeEVSLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixpRkFBakIsQ0FBQSxDQUFBO0FBRUFzYSxFQUFBQSxPQUFPLEdBQUdBLE9BQU8sSUFBSSxJQUFLdkwsQ0FBQUEsY0FBTCxDQUFvQnlMLE1BQXpDLENBQUE7O0FBR0EsRUFBQSxNQUFNelosQ0FBQyxHQUFHLFNBQUpBLENBQUksR0FBWTtJQUNsQndaLE9BQU8sRUFBQSxDQUFBO0FBQ1BKLElBQUFBLFFBQVEsQ0FBQ00sbUJBQVQsQ0FBNkIsa0JBQTdCLEVBQWlEMVosQ0FBakQsQ0FBQSxDQUFBO0dBRkosQ0FBQTs7QUFNQSxFQUFBLE1BQU0yWixDQUFDLEdBQUcsU0FBSkEsQ0FBSSxHQUFZO0lBQ2xCbmEsS0FBSyxFQUFBLENBQUE7QUFDTDRaLElBQUFBLFFBQVEsQ0FBQ00sbUJBQVQsQ0FBNkIsaUJBQTdCLEVBQWdEQyxDQUFoRCxDQUFBLENBQUE7R0FGSixDQUFBOztBQUtBLEVBQUEsSUFBSUgsT0FBSixFQUFhO0FBQ1RKLElBQUFBLFFBQVEsQ0FBQ1EsZ0JBQVQsQ0FBMEIsa0JBQTFCLEVBQThDNVosQ0FBOUMsRUFBaUQsS0FBakQsQ0FBQSxDQUFBO0FBQ0gsR0FBQTs7QUFFRCxFQUFBLElBQUlSLEtBQUosRUFBVztBQUNQNFosSUFBQUEsUUFBUSxDQUFDUSxnQkFBVCxDQUEwQixpQkFBMUIsRUFBNkNELENBQTdDLEVBQWdELEtBQWhELENBQUEsQ0FBQTtBQUNILEdBQUE7O0VBRUQsSUFBSUosT0FBTyxDQUFDTSxpQkFBWixFQUErQjtBQUMzQk4sSUFBQUEsT0FBTyxDQUFDTSxpQkFBUixDQUEwQkMsT0FBTyxDQUFDQyxvQkFBbEMsQ0FBQSxDQUFBO0FBQ0gsR0FGRCxNQUVPO0lBQ0h2YSxLQUFLLEVBQUEsQ0FBQTtBQUNSLEdBQUE7QUFDSixDQTlCRCxDQUFBOztBQWdDQTJZLFdBQVcsQ0FBQzFYLFNBQVosQ0FBc0J1WixpQkFBdEIsR0FBMEMsVUFBVVIsT0FBVixFQUFtQjtFQUN6RHhhLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixrRkFBakIsQ0FBQSxDQUFBOztBQUdBLEVBQUEsTUFBTWUsQ0FBQyxHQUFHLFNBQUpBLENBQUksR0FBWTtJQUNsQndaLE9BQU8sRUFBQSxDQUFBO0FBQ1BKLElBQUFBLFFBQVEsQ0FBQ00sbUJBQVQsQ0FBNkIsa0JBQTdCLEVBQWlEMVosQ0FBakQsQ0FBQSxDQUFBO0dBRkosQ0FBQTs7QUFLQSxFQUFBLElBQUl3WixPQUFKLEVBQWE7QUFDVEosSUFBQUEsUUFBUSxDQUFDUSxnQkFBVCxDQUEwQixrQkFBMUIsRUFBOEM1WixDQUE5QyxFQUFpRCxLQUFqRCxDQUFBLENBQUE7QUFDSCxHQUFBOztBQUVEb1osRUFBQUEsUUFBUSxDQUFDYSxjQUFULEVBQUEsQ0FBQTtBQUNILENBZEQsQ0FBQTs7QUFnQkE5QixXQUFXLENBQUMxWCxTQUFaLENBQXNCeVosV0FBdEIsR0FBb0MsVUFBVTVVLElBQVYsRUFBZ0I7RUFDaER0RyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsd0dBQWpCLENBQUEsQ0FBQTtFQUNBLE1BQU1rYixLQUFLLEdBQUcsSUFBS0MsQ0FBQUEsTUFBTCxDQUFZQyxJQUFaLENBQWlCL1UsSUFBakIsQ0FBZCxDQUFBOztBQUNBLEVBQUEsSUFBSTZVLEtBQUosRUFBVztJQUNQLE9BQU9BLEtBQUssQ0FBQ0csR0FBYixDQUFBO0FBQ0gsR0FBQTs7QUFDRCxFQUFBLE9BQU8sSUFBUCxDQUFBO0FBQ0gsQ0FQRCxDQUFBOztBQVNBbkMsV0FBVyxDQUFDMVgsU0FBWixDQUFzQjhaLFNBQXRCLEdBQWtDLFVBQVVELEdBQVYsRUFBZUUsUUFBZixFQUF5QjtFQUN2RHhiLEtBQUssQ0FBQ0MsVUFBTixDQUFpQiwyR0FBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxJQUFBLENBQUttYixNQUFMLENBQVlHLFNBQVosQ0FBc0JELEdBQXRCLEVBQTJCRSxRQUEzQixDQUFBLENBQUE7QUFDSCxDQUhELENBQUE7O0FBS0FyQyxXQUFXLENBQUMxWCxTQUFaLENBQXNCZ2Esa0JBQXRCLEdBQTJDLFVBQVVILEdBQVYsRUFBZUUsUUFBZixFQUF5QjtFQUNoRXhiLEtBQUssQ0FBQ0MsVUFBTixDQUFpQiw2SEFBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxJQUFBLENBQUttYixNQUFMLENBQVlLLGtCQUFaLENBQStCSCxHQUEvQixFQUFvQ0UsUUFBcEMsQ0FBQSxDQUFBO0FBQ0gsQ0FIRCxDQUFBOztBQUtBckMsV0FBVyxDQUFDMVgsU0FBWixDQUFzQmlhLGlCQUF0QixHQUEwQyxVQUFVSixHQUFWLEVBQWVFLFFBQWYsRUFBeUI7RUFDL0R4YixLQUFLLENBQUNDLFVBQU4sQ0FBaUIsMkhBQWpCLENBQUEsQ0FBQTtBQUNBLEVBQUEsSUFBQSxDQUFLbWIsTUFBTCxDQUFZTSxpQkFBWixDQUE4QkosR0FBOUIsRUFBbUNFLFFBQW5DLENBQUEsQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQXJDLFdBQVcsQ0FBQzFYLFNBQVosQ0FBc0JrYSxrQkFBdEIsR0FBMkMsVUFBVTFLLFlBQVYsRUFBd0IySyxPQUF4QixFQUFpQztFQUN4RTViLEtBQUssQ0FBQ0MsVUFBTixDQUFpQix1RkFBakIsQ0FBQSxDQUFBO0FBQ0EsRUFBQSxNQUFNNFAsS0FBSyxHQUFHK0wsT0FBTyxJQUFQLElBQUEsSUFBQUEsT0FBTyxDQUFFL0wsS0FBVCxHQUFpQitMLE9BQU8sQ0FBQy9MLEtBQXpCLEdBQWlDLElBQUs3QyxDQUFBQSxLQUFMLENBQVc2TyxnQkFBMUQsQ0FBQTtBQUNBLEVBQUEsSUFBQSxDQUFLN08sS0FBTCxDQUFXOE8sU0FBWCxDQUFxQkMsUUFBckIsQ0FBOEIsSUFBOUIsRUFBb0MsSUFBcEMsRUFBMEMsSUFBMUMsRUFBZ0Q5SyxZQUFoRCxFQUE4RHBCLEtBQTlELENBQUEsQ0FBQTtBQUNILENBSkQsQ0FBQTs7QUFNQXNKLFdBQVcsQ0FBQzFYLFNBQVosQ0FBc0J1YSxVQUF0QixHQUFtQyxVQUFVQyxJQUFWLEVBQWdCM0ssUUFBaEIsRUFBMEI0SyxNQUExQixFQUFrQ04sT0FBbEMsRUFBMkM7RUFDMUU1YixLQUFLLENBQUNDLFVBQU4sQ0FBaUIsdUVBQWpCLENBQUEsQ0FBQTtBQUNBLEVBQUEsTUFBTTRQLEtBQUssR0FBRytMLE9BQU8sSUFBUCxJQUFBLElBQUFBLE9BQU8sQ0FBRS9MLEtBQVQsR0FBaUIrTCxPQUFPLENBQUMvTCxLQUF6QixHQUFpQyxJQUFLN0MsQ0FBQUEsS0FBTCxDQUFXNk8sZ0JBQTFELENBQUE7QUFDQSxFQUFBLElBQUEsQ0FBSzdPLEtBQUwsQ0FBVzhPLFNBQVgsQ0FBcUJDLFFBQXJCLENBQThCekssUUFBOUIsRUFBd0M0SyxNQUF4QyxFQUFnREQsSUFBaEQsRUFBc0QsSUFBdEQsRUFBNERwTSxLQUE1RCxDQUFBLENBQUE7QUFDSCxDQUpELENBQUE7O0FBTUFzSixXQUFXLENBQUMxWCxTQUFaLENBQXNCMGEsU0FBdEIsR0FBa0MsVUFBVUMsU0FBVixFQUFxQkMsTUFBckIsRUFBNkJULE9BQTdCLEVBQXNDO0VBQ3BFLE1BQU0vTCxLQUFLLEdBQUkrTCxPQUFPLElBQUlBLE9BQU8sQ0FBQy9MLEtBQXBCLEdBQTZCK0wsT0FBTyxDQUFDL0wsS0FBckMsR0FBNkMsSUFBQSxDQUFLN0MsS0FBTCxDQUFXOEMsTUFBWCxDQUFrQkMsWUFBbEIsQ0FBK0J1TSxpQkFBL0IsQ0FBM0QsQ0FBQTtBQUNBLEVBQUEsTUFBTUMsU0FBUyxHQUFJWCxPQUFPLElBQUlBLE9BQU8sQ0FBQ1csU0FBUixLQUFzQkMsU0FBbEMsR0FBK0NaLE9BQU8sQ0FBQ1csU0FBdkQsR0FBbUUsSUFBckYsQ0FBQTtBQUVBLEVBQUEsTUFBTUUsS0FBSyxHQUFHLElBQUt6UCxDQUFBQSxLQUFMLENBQVc4TyxTQUFYLENBQXFCWSxRQUFyQixDQUE4QjdNLEtBQTlCLEVBQXFDME0sU0FBckMsQ0FBZCxDQUFBO0FBQ0FFLEVBQUFBLEtBQUssQ0FBQ0UsUUFBTixDQUFlUCxTQUFmLEVBQTBCQyxNQUExQixDQUFBLENBQUE7QUFDSCxDQU5ELENBQUE7O0FBUUFsRCxXQUFXLENBQUMxWCxTQUFaLENBQXNCbWIsVUFBdEIsR0FBbUMsVUFBVUMsS0FBVixFQUFpQmpXLEdBQWpCLEVBQXNCa1csS0FBdEIsRUFBNkI7RUFFNUQ5YyxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsdUVBQWpCLENBQUEsQ0FBQTtFQUVBLElBQUk4YyxRQUFRLEdBQUdELEtBQWYsQ0FBQTtBQUNBLEVBQUEsSUFBSWxCLE9BQUosQ0FBQTtBQUVBLEVBQUEsTUFBTW5aLElBQUksR0FBR3VhLFNBQVMsQ0FBQyxDQUFELENBQXRCLENBQUE7QUFDQSxFQUFBLE1BQU10YSxJQUFJLEdBQUdzYSxTQUFTLENBQUMsQ0FBRCxDQUF0QixDQUFBOztFQUVBLElBQUl2YSxJQUFJLFlBQVlqQixLQUFwQixFQUEyQjtBQUV2QnViLElBQUFBLFFBQVEsR0FBR3RhLElBQVgsQ0FBQTs7QUFFQSxJQUFBLElBQUksT0FBT0MsSUFBUCxLQUFnQixRQUFwQixFQUE4QjtNQUUxQixJQUFJQSxJQUFJLEtBQUt1YSxpQkFBYixFQUFnQztBQUM1QnJCLFFBQUFBLE9BQU8sR0FBRztVQUNOL0wsS0FBSyxFQUFFLEtBQUs3QyxLQUFMLENBQVc4QyxNQUFYLENBQWtCQyxZQUFsQixDQUErQnVNLGlCQUEvQixDQUREO0FBRU5DLFVBQUFBLFNBQVMsRUFBRSxLQUFBO1NBRmYsQ0FBQTtBQUlILE9BTEQsTUFLTztBQUNIWCxRQUFBQSxPQUFPLEdBQUc7VUFDTi9MLEtBQUssRUFBRSxLQUFLN0MsS0FBTCxDQUFXOEMsTUFBWCxDQUFrQkMsWUFBbEIsQ0FBK0J1TSxpQkFBL0IsQ0FERDtBQUVOQyxVQUFBQSxTQUFTLEVBQUUsSUFBQTtTQUZmLENBQUE7QUFJSCxPQUFBO0FBQ0osS0FiRCxNQWFPO0FBRUhYLE1BQUFBLE9BQU8sR0FBR2xaLElBQVYsQ0FBQTtBQUNILEtBQUE7QUFDSixHQXJCRCxNQXFCTyxJQUFJLE9BQU9ELElBQVAsS0FBZ0IsUUFBcEIsRUFBOEI7QUFDakNzYSxJQUFBQSxRQUFRLEdBQUdELEtBQVgsQ0FBQTs7SUFHQSxJQUFJcmEsSUFBSSxLQUFLd2EsaUJBQWIsRUFBZ0M7QUFDNUJyQixNQUFBQSxPQUFPLEdBQUc7UUFDTi9MLEtBQUssRUFBRSxLQUFLN0MsS0FBTCxDQUFXOEMsTUFBWCxDQUFrQkMsWUFBbEIsQ0FBK0J1TSxpQkFBL0IsQ0FERDtBQUVOQyxRQUFBQSxTQUFTLEVBQUUsS0FBQTtPQUZmLENBQUE7QUFJSCxLQUxELE1BS087QUFDSFgsTUFBQUEsT0FBTyxHQUFHO1FBQ04vTCxLQUFLLEVBQUUsS0FBSzdDLEtBQUwsQ0FBVzhDLE1BQVgsQ0FBa0JDLFlBQWxCLENBQStCdU0saUJBQS9CLENBREQ7QUFFTkMsUUFBQUEsU0FBUyxFQUFFLElBQUE7T0FGZixDQUFBO0FBSUgsS0FBQTtHQWRFLE1BZUEsSUFBSTlaLElBQUosRUFBVTtBQUVibVosSUFBQUEsT0FBTyxHQUFHblosSUFBVixDQUFBO0FBQ0gsR0FBQTs7QUFFRCxFQUFBLElBQUEsQ0FBSzBaLFNBQUwsQ0FBZSxDQUFDVSxLQUFELEVBQVFqVyxHQUFSLENBQWYsRUFBNkIsQ0FBQ2tXLEtBQUQsRUFBUUMsUUFBUixDQUE3QixFQUFnRG5CLE9BQWhELENBQUEsQ0FBQTtBQUNILENBcERELENBQUE7O0FBc0RBekMsV0FBVyxDQUFDMVgsU0FBWixDQUFzQnliLFdBQXRCLEdBQW9DLFVBQVVDLFFBQVYsRUFBb0JMLEtBQXBCLEVBQTJCbEIsT0FBM0IsRUFBb0M7RUFFcEU1YixLQUFLLENBQUNDLFVBQU4sQ0FBaUIseUVBQWpCLENBQUEsQ0FBQTs7RUFFQSxJQUFJLENBQUMyYixPQUFMLEVBQWM7QUFFVkEsSUFBQUEsT0FBTyxHQUFHO01BQ04vTCxLQUFLLEVBQUUsS0FBSzdDLEtBQUwsQ0FBVzhDLE1BQVgsQ0FBa0JDLFlBQWxCLENBQStCdU0saUJBQS9CLENBREQ7QUFFTkMsTUFBQUEsU0FBUyxFQUFFLElBQUE7S0FGZixDQUFBO0FBSUgsR0FORCxNQU1PLElBQUksT0FBT1gsT0FBUCxLQUFtQixRQUF2QixFQUFpQztJQUVwQyxJQUFJQSxPQUFPLEtBQUtxQixpQkFBaEIsRUFBbUM7QUFDL0JyQixNQUFBQSxPQUFPLEdBQUc7UUFDTi9MLEtBQUssRUFBRSxLQUFLN0MsS0FBTCxDQUFXOEMsTUFBWCxDQUFrQkMsWUFBbEIsQ0FBK0J1TSxpQkFBL0IsQ0FERDtBQUVOQyxRQUFBQSxTQUFTLEVBQUUsS0FBQTtPQUZmLENBQUE7QUFJSCxLQUxELE1BS087QUFDSFgsTUFBQUEsT0FBTyxHQUFHO1FBQ04vTCxLQUFLLEVBQUUsS0FBSzdDLEtBQUwsQ0FBVzhDLE1BQVgsQ0FBa0JDLFlBQWxCLENBQStCdU0saUJBQS9CLENBREQ7QUFFTkMsUUFBQUEsU0FBUyxFQUFFLElBQUE7T0FGZixDQUFBO0FBSUgsS0FBQTtBQUNKLEdBQUE7O0FBRUQsRUFBQSxNQUFNYSxVQUFVLEdBQUcsQ0FBQyxDQUFDTixLQUFLLENBQUNuSyxNQUEzQixDQUFBOztBQUNBLEVBQUEsSUFBSXlLLFVBQUosRUFBZ0I7QUFDWixJQUFBLElBQUlELFFBQVEsQ0FBQ3hLLE1BQVQsS0FBb0JtSyxLQUFLLENBQUNuSyxNQUE5QixFQUFzQztNQUNsQ3pTLE9BQU8sQ0FBQ00sS0FBUixDQUFjLDJEQUFkLENBQUEsQ0FBQTtBQUNBLE1BQUEsT0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztBQUNELEVBQUEsSUFBSTJjLFFBQVEsQ0FBQ3hLLE1BQVQsR0FBa0IsQ0FBbEIsS0FBd0IsQ0FBNUIsRUFBK0I7SUFDM0J6UyxPQUFPLENBQUNNLEtBQVIsQ0FBYyxpREFBZCxDQUFBLENBQUE7QUFDQSxJQUFBLE9BQUE7QUFDSCxHQUFBOztBQUNELEVBQUEsSUFBQSxDQUFLMmIsU0FBTCxDQUFlZ0IsUUFBZixFQUF5QkwsS0FBekIsRUFBZ0NsQixPQUFoQyxDQUFBLENBQUE7QUFDSCxDQXJDRCxDQUFBOztBQXVDQXpDLFdBQVcsQ0FBQzFYLFNBQVosQ0FBc0I0YixRQUF0QixHQUFpQyxZQUFZO0VBQ3pDcmQsS0FBSyxDQUFDQyxVQUFOLENBQWlCLDhFQUFqQixDQUFBLENBQUE7QUFDSCxDQUZELENBQUE7O0FBSUFxQixNQUFNLENBQUNDLGNBQVAsQ0FBc0IrYixlQUFlLENBQUM3YixTQUF0QyxFQUFpRCxNQUFqRCxFQUF5RDtBQUNyREMsRUFBQUEsR0FBRyxFQUFFLFlBQVk7SUFDYjFCLEtBQUssQ0FBQ0MsVUFBTixDQUFpQiwrRUFBakIsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxPQUFPLEtBQUtzZCxNQUFaLENBQUE7QUFDSCxHQUFBO0FBSm9ELENBQXpELENBQUEsQ0FBQTtBQU9BamMsTUFBTSxDQUFDQyxjQUFQLENBQXNCaWMsY0FBYyxDQUFDL2IsU0FBckMsRUFBZ0QsUUFBaEQsRUFBMEQ7QUFDdERDLEVBQUFBLEdBQUcsRUFBRSxZQUFZO0lBQ2IxQixLQUFLLENBQUNDLFVBQU4sQ0FBaUIsZ0ZBQWpCLENBQUEsQ0FBQTtBQUNBLElBQUEsT0FBTyxLQUFLd2QsT0FBWixDQUFBO0dBSGtEO0VBS3REdFIsR0FBRyxFQUFFLFVBQVVpRCxLQUFWLEVBQWlCO0lBQ2xCcFAsS0FBSyxDQUFDQyxVQUFOLENBQWlCLGdGQUFqQixDQUFBLENBQUE7SUFDQSxJQUFLd2QsQ0FBQUEsT0FBTCxHQUFlck8sS0FBZixDQUFBO0FBQ0gsR0FBQTtBQVJxRCxDQUExRCxDQUFBLENBQUE7O0FBV0FzTyxjQUFjLENBQUNqYyxTQUFmLENBQXlCa2MsVUFBekIsR0FBc0MsVUFBVUMsT0FBVixFQUFtQjtFQUNyRDVkLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixvRkFBakIsQ0FBQSxDQUFBO0VBQ0EsSUFBS3dkLENBQUFBLE9BQUwsR0FBZUcsT0FBZixDQUFBO0FBQ0gsQ0FIRCxDQUFBOztBQUtBdGMsTUFBTSxDQUFDQyxjQUFQLENBQXNCbWMsY0FBYyxDQUFDamMsU0FBckMsRUFBZ0QsTUFBaEQsRUFBd0Q7QUFDcERDLEVBQUFBLEdBQUcsRUFBRSxZQUFZO0lBQ2IxQixLQUFLLENBQUNDLFVBQU4sQ0FBaUIsZ0pBQWpCLENBQUEsQ0FBQTtBQUNBLElBQUEsT0FBTyxJQUFQLENBQUE7R0FIZ0Q7RUFLcERrTSxHQUFHLEVBQUUsVUFBVUssSUFBVixFQUFnQjtJQUNqQnhNLEtBQUssQ0FBQ0MsVUFBTixDQUFpQixnSkFBakIsQ0FBQSxDQUFBO0FBQ0gsR0FBQTtBQVBtRCxDQUF4RCxDQUFBLENBQUE7QUFVQXFCLE1BQU0sQ0FBQ0MsY0FBUCxDQUFzQnNjLGVBQWUsQ0FBQ3BjLFNBQXRDLEVBQWlELE1BQWpELEVBQXlEO0FBQ3JEQyxFQUFBQSxHQUFHLEVBQUUsWUFBWTtJQUNiMUIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLGtKQUFqQixDQUFBLENBQUE7QUFDQSxJQUFBLE9BQU8sSUFBUCxDQUFBO0dBSGlEO0VBS3JEa00sR0FBRyxFQUFFLFVBQVVLLElBQVYsRUFBZ0I7SUFDakJ4TSxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsa0pBQWpCLENBQUEsQ0FBQTtBQUNILEdBQUE7QUFQb0QsQ0FBekQsQ0FBQSxDQUFBO0FBVUFxQixNQUFNLENBQUNDLGNBQVAsQ0FBc0J1YyxrQkFBa0IsQ0FBQ3JjLFNBQXpDLEVBQW9ELFVBQXBELEVBQWdFO0FBQzVEQyxFQUFBQSxHQUFHLEVBQUUsWUFBWTtJQUNiMUIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLHVGQUFqQixDQUFBLENBQUE7QUFDQSxJQUFBLE9BQU8sS0FBS3VNLElBQVosQ0FBQTtHQUh3RDtFQUs1REwsR0FBRyxFQUFFLFVBQVVLLElBQVYsRUFBZ0I7SUFDakJ4TSxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsdUZBQWpCLENBQUEsQ0FBQTtJQUNBLElBQUt1TSxDQUFBQSxJQUFMLEdBQVlBLElBQVosQ0FBQTtBQUNILEdBQUE7QUFSMkQsQ0FBaEUsQ0FBQSxDQUFBOztBQVdBc1Isa0JBQWtCLENBQUNyYyxTQUFuQixDQUE2QnNjLGdCQUE3QixHQUFnRCxZQUFZO0VBQ3hEL2QsS0FBSyxDQUFDQyxVQUFOLENBQWlCLGtGQUFqQixDQUFBLENBQUE7O0FBQ0EsRUFBQSxJQUFBLENBQUsrZCxjQUFMLEVBQUEsQ0FBQTtBQUNILENBSEQsQ0FBQTs7QUFLQUMsd0JBQXdCLENBQUN4YyxTQUF6QixDQUFtQ3ljLFVBQW5DLEdBQWdELFlBQVk7RUFDeERsZSxLQUFLLENBQUNDLFVBQU4sQ0FBaUIsd0dBQWpCLENBQUEsQ0FBQTs7QUFFQSxFQUFBLElBQUkrYyxTQUFTLENBQUNySyxNQUFWLEtBQXFCLENBQXpCLEVBQTRCO0FBQ3hCLElBQUEsSUFBQSxDQUFLd0wsT0FBTCxDQUFhQyxJQUFiLENBQWtCcEIsU0FBUyxDQUFDLENBQUQsQ0FBM0IsQ0FBQSxDQUFBO0FBQ0gsR0FGRCxNQUVPO0FBQ0gsSUFBQSxJQUFBLENBQUttQixPQUFMLENBQWFoUyxHQUFiLENBQWlCNlEsU0FBUyxDQUFDLENBQUQsQ0FBMUIsRUFBK0JBLFNBQVMsQ0FBQyxDQUFELENBQXhDLEVBQTZDQSxTQUFTLENBQUMsQ0FBRCxDQUF0RCxDQUFBLENBQUE7QUFDSCxHQUFBO0FBQ0osQ0FSRCxDQUFBOztBQVdPLFNBQVNxQixzQkFBVCxDQUFnQ0MsT0FBaEMsRUFBeUNDLE9BQXpDLEVBQWtEQyxXQUFsRCxFQUErRDtFQUNsRXhlLEtBQUssQ0FBQ0MsVUFBTixDQUFpQiwwRUFBakIsQ0FBQSxDQUFBO0FBQ0F3ZSxFQUFBQSxlQUFlLENBQUM7QUFDWkgsSUFBQUEsT0FBTyxFQUFFQSxPQURHO0FBRVpDLElBQUFBLE9BQU8sRUFBRUEsT0FGRztBQUdaQyxJQUFBQSxXQUFXLEVBQUVBLFdBSEQ7QUFJWkUsSUFBQUEsUUFBUSxFQUFFLElBQUE7QUFKRSxHQUFELENBQWYsQ0FBQTtBQU1ILENBQUE7QUFFTSxTQUFTQyxnQkFBVCxDQUEwQi9DLE9BQTFCLEVBQW1DO0VBQ3RDNWIsS0FBSyxDQUFDQyxVQUFOLENBQWlCLGdFQUFqQixDQUFBLENBQUE7QUFDSDs7OzsifQ==
