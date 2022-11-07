/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { BUFFER_STATIC, PRIMITIVE_TRIFAN, FUNC_EQUAL, STENCILOP_DECREMENT, SEMANTIC_POSITION, TYPE_FLOAT32, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD0 } from '../../../platform/graphics/constants.js';
import { VertexBuffer } from '../../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../platform/graphics/vertex-format.js';
import { SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, LAYER_HUD, LAYER_WORLD, SPRITE_RENDERMODE_SIMPLE } from '../../../scene/constants.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Mesh } from '../../../scene/mesh.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { StencilParameters } from '../../../scene/stencil-parameters.js';
import { FITMODE_STRETCH, FITMODE_CONTAIN, FITMODE_COVER } from './constants.js';
import { Asset } from '../../asset/asset.js';

class ImageRenderable {
  constructor(entity, mesh, material) {
    this._entity = entity;
    this._element = entity.element;
    this.model = new Model();
    this.node = new GraphNode();
    this.model.graph = this.node;
    this.mesh = mesh;
    this.meshInstance = new MeshInstance(this.mesh, material, this.node);
    this.meshInstance.name = 'ImageElement: ' + entity.name;
    this.meshInstance.castShadow = false;
    this.meshInstance.receiveShadow = false;
    this._meshDirty = false;
    this.model.meshInstances.push(this.meshInstance);
    this._entity.addChild(this.model.graph);
    this.model._entity = this._entity;
    this.unmaskMeshInstance = null;
  }
  destroy() {
    this.setMaterial(null);
    this._element.removeModelFromLayers(this.model);
    this.model.destroy();
    this.model = null;
    this.node = null;
    this.mesh = null;
    this.meshInstance = null;
    this._entity = null;
    this._element = null;
  }
  setMesh(mesh) {
    if (!this.meshInstance) return;
    this.mesh = mesh;
    this.meshInstance.mesh = mesh;
    this.meshInstance.visible = !!mesh;
    if (this.unmaskMeshInstance) {
      this.unmaskMeshInstance.mesh = mesh;
    }
    this.forceUpdateAabb();
  }
  setMask(mask) {
    if (!this.meshInstance) return;
    if (mask) {
      this.unmaskMeshInstance = new MeshInstance(this.mesh, this.meshInstance.material, this.node);
      this.unmaskMeshInstance.name = 'Unmask: ' + this._entity.name;
      this.unmaskMeshInstance.castShadow = false;
      this.unmaskMeshInstance.receiveShadow = false;
      this.unmaskMeshInstance.pick = false;
      this.model.meshInstances.push(this.unmaskMeshInstance);

      for (const name in this.meshInstance.parameters) {
        this.unmaskMeshInstance.setParameter(name, this.meshInstance.parameters[name].data);
      }
    } else {
      const idx = this.model.meshInstances.indexOf(this.unmaskMeshInstance);
      if (idx >= 0) {
        this.model.meshInstances.splice(idx, 1);
      }
      this.unmaskMeshInstance = null;
    }

    if (this._entity.enabled && this._element.enabled) {
      this._element.removeModelFromLayers(this.model);
      this._element.addModelToLayers(this.model);
    }
  }
  setMaterial(material) {
    if (!this.meshInstance) return;
    this.meshInstance.material = material;
    if (this.unmaskMeshInstance) {
      this.unmaskMeshInstance.material = material;
    }
  }
  setParameter(name, value) {
    if (!this.meshInstance) return;
    this.meshInstance.setParameter(name, value);
    if (this.unmaskMeshInstance) {
      this.unmaskMeshInstance.setParameter(name, value);
    }
  }
  deleteParameter(name) {
    if (!this.meshInstance) return;
    this.meshInstance.deleteParameter(name);
    if (this.unmaskMeshInstance) {
      this.unmaskMeshInstance.deleteParameter(name);
    }
  }
  setUnmaskDrawOrder() {
    if (!this.meshInstance) return;
    const getLastChild = function getLastChild(e) {
      let last;
      const c = e.children;
      const l = c.length;
      if (l) {
        for (let i = 0; i < l; i++) {
          if (c[i].element) {
            last = c[i];
          }
        }
        if (!last) return null;
        const child = getLastChild(last);
        if (child) {
          return child;
        }
        return last;
      }
      return null;
    };

    if (this.unmaskMeshInstance) {
      const lastChild = getLastChild(this._entity);
      if (lastChild && lastChild.element) {
        this.unmaskMeshInstance.drawOrder = lastChild.element.drawOrder + lastChild.element.getMaskOffset();
      } else {
        this.unmaskMeshInstance.drawOrder = this.meshInstance.drawOrder + this._element.getMaskOffset();
      }
    }
  }
  setDrawOrder(drawOrder) {
    if (!this.meshInstance) return;
    this.meshInstance.drawOrder = drawOrder;
  }
  setCull(cull) {
    if (!this.meshInstance) return;
    const element = this._element;
    let visibleFn = null;
    if (cull && element._isScreenSpace()) {
      visibleFn = function (camera) {
        return element.isVisibleForCamera(camera);
      };
    }
    this.meshInstance.cull = cull;
    this.meshInstance.isVisibleFunc = visibleFn;
    if (this.unmaskMeshInstance) {
      this.unmaskMeshInstance.cull = cull;
      this.unmaskMeshInstance.isVisibleFunc = visibleFn;
    }
  }
  setScreenSpace(screenSpace) {
    if (!this.meshInstance) return;
    this.meshInstance.screenSpace = screenSpace;
    if (this.unmaskMeshInstance) {
      this.unmaskMeshInstance.screenSpace = screenSpace;
    }
  }
  setLayer(layer) {
    if (!this.meshInstance) return;
    this.meshInstance.layer = layer;
    if (this.unmaskMeshInstance) {
      this.unmaskMeshInstance.layer = layer;
    }
  }
  forceUpdateAabb(mask) {
    if (!this.meshInstance) return;
    this.meshInstance._aabbVer = -1;
    if (this.unmaskMeshInstance) {
      this.unmaskMeshInstance._aabbVer = -1;
    }
  }
  setAabbFunc(fn) {
    if (!this.meshInstance) return;
    this.meshInstance._updateAabbFunc = fn;
    if (this.unmaskMeshInstance) {
      this.unmaskMeshInstance._updateAabbFunc = fn;
    }
  }
}
class ImageElement {
  constructor(element) {
    this._element = element;
    this._entity = element.entity;
    this._system = element.system;

    this._textureAsset = null;
    this._texture = null;
    this._materialAsset = null;
    this._material = null;
    this._spriteAsset = null;
    this._sprite = null;
    this._spriteFrame = 0;
    this._pixelsPerUnit = null;
    this._targetAspectRatio = -1;

    this._rect = new Vec4(0, 0, 1, 1);

    this._mask = false;
    this._maskRef = 0;

    this._outerScale = new Vec2();
    this._outerScaleUniform = new Float32Array(2);
    this._innerOffset = new Vec4();
    this._innerOffsetUniform = new Float32Array(4);
    this._atlasRect = new Vec4();
    this._atlasRectUniform = new Float32Array(4);
    this._defaultMesh = this._createMesh();
    this._renderable = new ImageRenderable(this._entity, this._defaultMesh, this._material);

    this._color = new Color(1, 1, 1, 1);
    this._colorUniform = new Float32Array([1, 1, 1]);
    this._renderable.setParameter('material_emissive', this._colorUniform);
    this._renderable.setParameter('material_opacity', 1);
    this._updateAabbFunc = this._updateAabb.bind(this);

    this._onScreenChange(this._element.screen);

    this._element.on('resize', this._onParentResizeOrPivotChange, this);
    this._element.on('set:pivot', this._onParentResizeOrPivotChange, this);
    this._element.on('screen:set:screenspace', this._onScreenSpaceChange, this);
    this._element.on('set:screen', this._onScreenChange, this);
    this._element.on('set:draworder', this._onDrawOrderChange, this);
    this._element.on('screen:set:resolution', this._onResolutionChange, this);
  }
  destroy() {
    this.textureAsset = null;
    this.spriteAsset = null;
    this.materialAsset = null;
    this._renderable.setMesh(this._defaultMesh);
    this._renderable.destroy();
    this._defaultMesh = null;
    this._element.off('resize', this._onParentResizeOrPivotChange, this);
    this._element.off('set:pivot', this._onParentResizeOrPivotChange, this);
    this._element.off('screen:set:screenspace', this._onScreenSpaceChange, this);
    this._element.off('set:screen', this._onScreenChange, this);
    this._element.off('set:draworder', this._onDrawOrderChange, this);
    this._element.off('screen:set:resolution', this._onResolutionChange, this);
  }
  _onResolutionChange(res) {}
  _onParentResizeOrPivotChange() {
    if (this._renderable.mesh) {
      this._updateMesh(this._renderable.mesh);
    }
  }
  _onScreenSpaceChange(value) {
    this._updateMaterial(value);
  }
  _onScreenChange(screen, previous) {
    if (screen) {
      this._updateMaterial(screen.screen.screenSpace);
    } else {
      this._updateMaterial(false);
    }
  }
  _onDrawOrderChange(order) {
    this._renderable.setDrawOrder(order);
    if (this.mask && this._element.screen) {
      this._element.screen.screen.once('syncdraworder', function () {
        this._renderable.setUnmaskDrawOrder();
      }, this);
    }
  }

  _hasUserMaterial() {
    return !!this._materialAsset || !!this._material && this._system.defaultImageMaterials.indexOf(this._material) === -1;
  }
  _use9Slicing() {
    return this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED);
  }
  _updateMaterial(screenSpace) {
    const mask = !!this._mask;
    const nineSliced = !!(this.sprite && this.sprite.renderMode === SPRITE_RENDERMODE_SLICED);
    const nineTiled = !!(this.sprite && this.sprite.renderMode === SPRITE_RENDERMODE_TILED);
    if (!this._hasUserMaterial()) {
      this._material = this._system.getImageElementMaterial(screenSpace, mask, nineSliced, nineTiled);
    }
    if (this._renderable) {
      this._renderable.setCull(!this._element._isScreenSpace() || this._element._isScreenCulled());
      this._renderable.setMaterial(this._material);
      this._renderable.setScreenSpace(screenSpace);
      this._renderable.setLayer(screenSpace ? LAYER_HUD : LAYER_WORLD);
    }
  }

  _createMesh() {
    const element = this._element;
    const w = element.calculatedWidth;
    const h = element.calculatedHeight;
    const r = this._rect;

    const vertexData = new ArrayBuffer(4 * 8 * 4);
    const vertexDataF32 = new Float32Array(vertexData);

    vertexDataF32[5] = 1;
    vertexDataF32[6] = r.x;
    vertexDataF32[7] = 1.0 - r.y;

    vertexDataF32[8] = w;
    vertexDataF32[13] = 1;
    vertexDataF32[14] = r.x + r.z;
    vertexDataF32[15] = 1.0 - r.y;

    vertexDataF32[16] = w;
    vertexDataF32[17] = h;
    vertexDataF32[21] = 1;
    vertexDataF32[22] = r.x + r.z;
    vertexDataF32[23] = 1.0 - (r.y + r.w);

    vertexDataF32[25] = h;
    vertexDataF32[29] = 1;
    vertexDataF32[30] = r.x;
    vertexDataF32[31] = 1.0 - (r.y + r.w);

    const vertexDesc = [{
      semantic: SEMANTIC_POSITION,
      components: 3,
      type: TYPE_FLOAT32
    }, {
      semantic: SEMANTIC_NORMAL,
      components: 3,
      type: TYPE_FLOAT32
    }, {
      semantic: SEMANTIC_TEXCOORD0,
      components: 2,
      type: TYPE_FLOAT32
    }];
    const device = this._system.app.graphicsDevice;
    const vertexFormat = new VertexFormat(device, vertexDesc);
    const vertexBuffer = new VertexBuffer(device, vertexFormat, 4, BUFFER_STATIC, vertexData);
    const mesh = new Mesh(device);
    mesh.vertexBuffer = vertexBuffer;
    mesh.primitive[0].type = PRIMITIVE_TRIFAN;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = 4;
    mesh.primitive[0].indexed = false;
    mesh.aabb.setMinMax(Vec3.ZERO, new Vec3(w, h, 0));
    this._updateMesh(mesh);
    return mesh;
  }
  _updateMesh(mesh) {
    const element = this._element;
    let w = element.calculatedWidth;
    let h = element.calculatedHeight;
    if (element.fitMode !== FITMODE_STRETCH && this._targetAspectRatio > 0) {
      const actualRatio = element.calculatedWidth / element.calculatedHeight;
      if (element.fitMode === FITMODE_CONTAIN && actualRatio > this._targetAspectRatio || element.fitMode === FITMODE_COVER && actualRatio < this._targetAspectRatio) {
        w = element.calculatedHeight * this._targetAspectRatio;
      } else {
        h = element.calculatedWidth / this._targetAspectRatio;
      }
    }

    const screenSpace = element._isScreenSpace();
    this._updateMaterial(screenSpace);

    if (this._renderable) this._renderable.forceUpdateAabb();
    if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
      const frameData = this._sprite.atlas.frames[this._sprite.frameKeys[this._spriteFrame]];
      const borderWidthScale = 2 / frameData.rect.z;
      const borderHeightScale = 2 / frameData.rect.w;
      this._innerOffset.set(frameData.border.x * borderWidthScale, frameData.border.y * borderHeightScale, frameData.border.z * borderWidthScale, frameData.border.w * borderHeightScale);
      const tex = this.sprite.atlas.texture;
      this._atlasRect.set(frameData.rect.x / tex.width, frameData.rect.y / tex.height, frameData.rect.z / tex.width, frameData.rect.w / tex.height);

      const ppu = this._pixelsPerUnit !== null ? this._pixelsPerUnit : this.sprite.pixelsPerUnit;
      const scaleMulX = frameData.rect.z / ppu;
      const scaleMulY = frameData.rect.w / ppu;

      this._outerScale.set(Math.max(w, this._innerOffset.x * scaleMulX), Math.max(h, this._innerOffset.y * scaleMulY));
      let scaleX = scaleMulX;
      let scaleY = scaleMulY;
      this._outerScale.x /= scaleMulX;
      this._outerScale.y /= scaleMulY;

      scaleX *= math.clamp(w / (this._innerOffset.x * scaleMulX), 0.0001, 1);
      scaleY *= math.clamp(h / (this._innerOffset.y * scaleMulY), 0.0001, 1);

      if (this._renderable) {
        this._innerOffsetUniform[0] = this._innerOffset.x;
        this._innerOffsetUniform[1] = this._innerOffset.y;
        this._innerOffsetUniform[2] = this._innerOffset.z;
        this._innerOffsetUniform[3] = this._innerOffset.w;
        this._renderable.setParameter('innerOffset', this._innerOffsetUniform);
        this._atlasRectUniform[0] = this._atlasRect.x;
        this._atlasRectUniform[1] = this._atlasRect.y;
        this._atlasRectUniform[2] = this._atlasRect.z;
        this._atlasRectUniform[3] = this._atlasRect.w;
        this._renderable.setParameter('atlasRect', this._atlasRectUniform);
        this._outerScaleUniform[0] = this._outerScale.x;
        this._outerScaleUniform[1] = this._outerScale.y;
        this._renderable.setParameter('outerScale', this._outerScaleUniform);
        this._renderable.setAabbFunc(this._updateAabbFunc);
        this._renderable.node.setLocalScale(scaleX, scaleY, 1);
        this._renderable.node.setLocalPosition((0.5 - element.pivot.x) * w, (0.5 - element.pivot.y) * h, 0);
      }
    } else {
      const vb = mesh.vertexBuffer;
      const vertexDataF32 = new Float32Array(vb.lock());

      const hp = element.pivot.x;
      const vp = element.pivot.y;

      vertexDataF32[0] = 0 - hp * w;
      vertexDataF32[1] = 0 - vp * h;
      vertexDataF32[8] = w - hp * w;
      vertexDataF32[9] = 0 - vp * h;
      vertexDataF32[16] = w - hp * w;
      vertexDataF32[17] = h - vp * h;
      vertexDataF32[24] = 0 - hp * w;
      vertexDataF32[25] = h - vp * h;
      let atlasTextureWidth = 1;
      let atlasTextureHeight = 1;
      let rect = this._rect;
      if (this._sprite && this._sprite.frameKeys[this._spriteFrame] && this._sprite.atlas) {
        const frame = this._sprite.atlas.frames[this._sprite.frameKeys[this._spriteFrame]];
        if (frame) {
          rect = frame.rect;
          atlasTextureWidth = this._sprite.atlas.texture.width;
          atlasTextureHeight = this._sprite.atlas.texture.height;
        }
      }

      vertexDataF32[6] = rect.x / atlasTextureWidth;
      vertexDataF32[7] = 1.0 - rect.y / atlasTextureHeight;
      vertexDataF32[14] = (rect.x + rect.z) / atlasTextureWidth;
      vertexDataF32[15] = 1.0 - rect.y / atlasTextureHeight;
      vertexDataF32[22] = (rect.x + rect.z) / atlasTextureWidth;
      vertexDataF32[23] = 1.0 - (rect.y + rect.w) / atlasTextureHeight;
      vertexDataF32[30] = rect.x / atlasTextureWidth;
      vertexDataF32[31] = 1.0 - (rect.y + rect.w) / atlasTextureHeight;
      vb.unlock();
      const min = new Vec3(0 - hp * w, 0 - vp * h, 0);
      const max = new Vec3(w - hp * w, h - vp * h, 0);
      mesh.aabb.setMinMax(min, max);
      if (this._renderable) {
        this._renderable.node.setLocalScale(1, 1, 1);
        this._renderable.node.setLocalPosition(0, 0, 0);
        this._renderable.setAabbFunc(null);
      }
    }
    this._meshDirty = false;
  }

  _updateSprite() {
    let nineSlice = false;
    let mesh = null;

    this._targetAspectRatio = -1;
    if (this._sprite && this._sprite.atlas) {
      mesh = this._sprite.meshes[this.spriteFrame];
      nineSlice = this._sprite.renderMode === SPRITE_RENDERMODE_SLICED || this._sprite.renderMode === SPRITE_RENDERMODE_TILED;

      const frameData = this._sprite.atlas.frames[this._sprite.frameKeys[this._spriteFrame]];
      if ((frameData == null ? void 0 : frameData.rect.w) > 0) {
        this._targetAspectRatio = frameData.rect.z / frameData.rect.w;
      }
    }

    this.mesh = nineSlice ? mesh : this._defaultMesh;
    this.refreshMesh();
  }
  refreshMesh() {
    if (this.mesh) {
      if (!this._element._beingInitialized) {
        this._updateMesh(this.mesh);
      } else {
        this._meshDirty = true;
      }
    }
  }

  _updateAabb(aabb) {
    aabb.center.set(0, 0, 0);
    aabb.halfExtents.set(this._outerScale.x * 0.5, this._outerScale.y * 0.5, 0.001);
    aabb.setFromTransformedAabb(aabb, this._renderable.node.getWorldTransform());
    return aabb;
  }
  _toggleMask() {
    this._element._dirtifyMask();
    const screenSpace = this._element._isScreenSpace();
    this._updateMaterial(screenSpace);
    this._renderable.setMask(!!this._mask);
  }
  _onMaterialLoad(asset) {
    this.material = asset.resource;
  }
  _onMaterialAdded(asset) {
    this._system.app.assets.off('add:' + asset.id, this._onMaterialAdded, this);
    if (this._materialAsset === asset.id) {
      this._bindMaterialAsset(asset);
    }
  }
  _bindMaterialAsset(asset) {
    if (!this._entity.enabled) return;

    asset.on('load', this._onMaterialLoad, this);
    asset.on('change', this._onMaterialChange, this);
    asset.on('remove', this._onMaterialRemove, this);
    if (asset.resource) {
      this._onMaterialLoad(asset);
    } else {
      this._system.app.assets.load(asset);
    }
  }
  _unbindMaterialAsset(asset) {
    asset.off('load', this._onMaterialLoad, this);
    asset.off('change', this._onMaterialChange, this);
    asset.off('remove', this._onMaterialRemove, this);
  }
  _onMaterialChange() {}
  _onMaterialRemove() {}
  _onTextureAdded(asset) {
    this._system.app.assets.off('add:' + asset.id, this._onTextureAdded, this);
    if (this._textureAsset === asset.id) {
      this._bindTextureAsset(asset);
    }
  }
  _bindTextureAsset(asset) {
    if (!this._entity.enabled) return;

    asset.on('load', this._onTextureLoad, this);
    asset.on('change', this._onTextureChange, this);
    asset.on('remove', this._onTextureRemove, this);
    if (asset.resource) {
      this._onTextureLoad(asset);
    } else {
      this._system.app.assets.load(asset);
    }
  }
  _unbindTextureAsset(asset) {
    asset.off('load', this._onTextureLoad, this);
    asset.off('change', this._onTextureChange, this);
    asset.off('remove', this._onTextureRemove, this);
  }
  _onTextureLoad(asset) {
    this.texture = asset.resource;
  }
  _onTextureChange(asset) {}
  _onTextureRemove(asset) {}

  _onSpriteAssetAdded(asset) {
    this._system.app.assets.off('add:' + asset.id, this._onSpriteAssetAdded, this);
    if (this._spriteAsset === asset.id) {
      this._bindSpriteAsset(asset);
    }
  }

  _bindSpriteAsset(asset) {
    if (!this._entity.enabled) return;

    asset.on('load', this._onSpriteAssetLoad, this);
    asset.on('change', this._onSpriteAssetChange, this);
    asset.on('remove', this._onSpriteAssetRemove, this);
    if (asset.resource) {
      this._onSpriteAssetLoad(asset);
    } else {
      this._system.app.assets.load(asset);
    }
  }
  _unbindSpriteAsset(asset) {
    asset.off('load', this._onSpriteAssetLoad, this);
    asset.off('change', this._onSpriteAssetChange, this);
    asset.off('remove', this._onSpriteAssetRemove, this);
    if (asset.data.textureAtlasAsset) {
      this._system.app.assets.off('load:' + asset.data.textureAtlasAsset, this._onTextureAtlasLoad, this);
    }
  }

  _onSpriteAssetLoad(asset) {
    if (!asset || !asset.resource) {
      this.sprite = null;
    } else {
      if (!asset.resource.atlas) {
        const atlasAssetId = asset.data.textureAtlasAsset;
        if (atlasAssetId) {
          const assets = this._system.app.assets;
          assets.off('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
          assets.once('load:' + atlasAssetId, this._onTextureAtlasLoad, this);
        }
      } else {
        this.sprite = asset.resource;
      }
    }
  }

  _onSpriteAssetChange(asset) {
    this._onSpriteAssetLoad(asset);
  }
  _onSpriteAssetRemove(asset) {}

  _bindSprite(sprite) {
    sprite.on('set:meshes', this._onSpriteMeshesChange, this);
    sprite.on('set:pixelsPerUnit', this._onSpritePpuChange, this);
    sprite.on('set:atlas', this._onAtlasTextureChange, this);
    if (sprite.atlas) {
      sprite.atlas.on('set:texture', this._onAtlasTextureChange, this);
    }
  }
  _unbindSprite(sprite) {
    sprite.off('set:meshes', this._onSpriteMeshesChange, this);
    sprite.off('set:pixelsPerUnit', this._onSpritePpuChange, this);
    sprite.off('set:atlas', this._onAtlasTextureChange, this);
    if (sprite.atlas) {
      sprite.atlas.off('set:texture', this._onAtlasTextureChange, this);
    }
  }
  _onSpriteMeshesChange() {
    if (this._sprite) {
      this._spriteFrame = math.clamp(this._spriteFrame, 0, this._sprite.frameKeys.length - 1);
    }

    this._updateSprite();
  }
  _onSpritePpuChange() {
    if (this.sprite.renderMode !== SPRITE_RENDERMODE_SIMPLE && this._pixelsPerUnit === null) {
      this._updateSprite();
    }
  }
  _onAtlasTextureChange() {
    if (this.sprite && this.sprite.atlas && this.sprite.atlas.texture) {
      this._renderable.setParameter('texture_emissiveMap', this._sprite.atlas.texture);
      this._renderable.setParameter('texture_opacityMap', this._sprite.atlas.texture);
    } else {
      this._renderable.deleteParameter('texture_emissiveMap');
      this._renderable.deleteParameter('texture_opacityMap');
    }
  }

  _onTextureAtlasLoad(atlasAsset) {
    const spriteAsset = this._spriteAsset;
    if (spriteAsset instanceof Asset) {
      this._onSpriteAssetLoad(spriteAsset);
    } else {
      this._onSpriteAssetLoad(this._system.app.assets.get(spriteAsset));
    }
  }
  onEnable() {
    if (this._materialAsset) {
      const asset = this._system.app.assets.get(this._materialAsset);
      if (asset && asset.resource !== this._material) {
        this._bindMaterialAsset(asset);
      }
    }
    if (this._textureAsset) {
      const asset = this._system.app.assets.get(this._textureAsset);
      if (asset && asset.resource !== this._texture) {
        this._bindTextureAsset(asset);
      }
    }
    if (this._spriteAsset) {
      const asset = this._system.app.assets.get(this._spriteAsset);
      if (asset && asset.resource !== this._sprite) {
        this._bindSpriteAsset(asset);
      }
    }
    this._element.addModelToLayers(this._renderable.model);
  }
  onDisable() {
    this._element.removeModelFromLayers(this._renderable.model);
  }
  _setStencil(stencilParams) {
    this._renderable.meshInstance.stencilFront = stencilParams;
    this._renderable.meshInstance.stencilBack = stencilParams;
    let ref = 0;
    if (this._element.maskedBy) {
      ref = this._element.maskedBy.element._image._maskRef;
    }
    if (this._renderable.unmaskMeshInstance) {
      const sp = new StencilParameters({
        ref: ref + 1,
        func: FUNC_EQUAL,
        zpass: STENCILOP_DECREMENT
      });
      this._renderable.unmaskMeshInstance.stencilFront = sp;
      this._renderable.unmaskMeshInstance.stencilBack = sp;
    }
  }
  set color(value) {
    const r = value.r;
    const g = value.g;
    const b = value.b;
    if (this._color === value) {
      Debug.warn('Setting element.color to itself will have no effect');
    }
    if (this._color.r !== r || this._color.g !== g || this._color.b !== b) {
      this._color.r = r;
      this._color.g = g;
      this._color.b = b;
      this._colorUniform[0] = r;
      this._colorUniform[1] = g;
      this._colorUniform[2] = b;
      this._renderable.setParameter('material_emissive', this._colorUniform);
    }
    if (this._element) {
      this._element.fire('set:color', this._color);
    }
  }
  get color() {
    return this._color;
  }
  set opacity(value) {
    if (value !== this._color.a) {
      this._color.a = value;
      this._renderable.setParameter('material_opacity', value);
    }
    if (this._element) {
      this._element.fire('set:opacity', value);
    }
  }
  get opacity() {
    return this._color.a;
  }
  set rect(value) {
    if (this._rect === value) {
      console.warn('Setting element.rect to itself will have no effect');
    }
    let x, y, z, w;
    if (value instanceof Vec4) {
      x = value.x;
      y = value.y;
      z = value.z;
      w = value.w;
    } else {
      x = value[0];
      y = value[1];
      z = value[2];
      w = value[3];
    }
    if (x === this._rect.x && y === this._rect.y && z === this._rect.z && w === this._rect.w) {
      return;
    }
    this._rect.set(x, y, z, w);
    if (this._renderable.mesh) {
      if (!this._element._beingInitialized) {
        this._updateMesh(this._renderable.mesh);
      } else {
        this._meshDirty = true;
      }
    }
  }
  get rect() {
    return this._rect;
  }
  set material(value) {
    if (this._material === value) return;
    if (!value) {
      const screenSpace = this._element._isScreenSpace();
      if (this.mask) {
        value = screenSpace ? this._system.defaultScreenSpaceImageMaskMaterial : this._system.defaultImageMaskMaterial;
      } else {
        value = screenSpace ? this._system.defaultScreenSpaceImageMaterial : this._system.defaultImageMaterial;
      }
    }
    this._material = value;
    if (value) {
      this._renderable.setMaterial(value);

      if (this._hasUserMaterial()) {
        this._renderable.deleteParameter('material_opacity');
        this._renderable.deleteParameter('material_emissive');
      } else {
        this._colorUniform[0] = this._color.r;
        this._colorUniform[1] = this._color.g;
        this._colorUniform[2] = this._color.b;
        this._renderable.setParameter('material_emissive', this._colorUniform);
        this._renderable.setParameter('material_opacity', this._color.a);
      }
    }
  }
  get material() {
    return this._material;
  }
  set materialAsset(value) {
    const assets = this._system.app.assets;
    let _id = value;
    if (value instanceof Asset) {
      _id = value.id;
    }
    if (this._materialAsset !== _id) {
      if (this._materialAsset) {
        assets.off('add:' + this._materialAsset, this._onMaterialAdded, this);
        const _prev = assets.get(this._materialAsset);
        if (_prev) {
          _prev.off('load', this._onMaterialLoad, this);
          _prev.off('change', this._onMaterialChange, this);
          _prev.off('remove', this._onMaterialRemove, this);
        }
      }
      this._materialAsset = _id;
      if (this._materialAsset) {
        const asset = assets.get(this._materialAsset);
        if (!asset) {
          this.material = null;
          assets.on('add:' + this._materialAsset, this._onMaterialAdded, this);
        } else {
          this._bindMaterialAsset(asset);
        }
      } else {
        this.material = null;
      }
    }
  }
  get materialAsset() {
    return this._materialAsset;
  }
  set texture(value) {
    if (this._texture === value) return;
    if (this._textureAsset) {
      const textureAsset = this._system.app.assets.get(this._textureAsset);
      if (textureAsset && textureAsset.resource !== value) {
        this.textureAsset = null;
      }
    }
    this._texture = value;
    if (value) {
      if (this._spriteAsset) {
        this.spriteAsset = null;
      }

      this._renderable.setParameter('texture_emissiveMap', this._texture);
      this._renderable.setParameter('texture_opacityMap', this._texture);
      this._colorUniform[0] = this._color.r;
      this._colorUniform[1] = this._color.g;
      this._colorUniform[2] = this._color.b;
      this._renderable.setParameter('material_emissive', this._colorUniform);
      this._renderable.setParameter('material_opacity', this._color.a);

      const newAspectRatio = this._texture.width / this._texture.height;
      if (newAspectRatio !== this._targetAspectRatio) {
        this._targetAspectRatio = newAspectRatio;
        if (this._element.fitMode !== FITMODE_STRETCH) {
          this.refreshMesh();
        }
      }
    } else {
      this._renderable.deleteParameter('texture_emissiveMap');
      this._renderable.deleteParameter('texture_opacityMap');

      this._targetAspectRatio = -1;
      if (this._element.fitMode !== FITMODE_STRETCH) {
        this.refreshMesh();
      }
    }
  }
  get texture() {
    return this._texture;
  }
  set textureAsset(value) {
    const assets = this._system.app.assets;
    let _id = value;
    if (value instanceof Asset) {
      _id = value.id;
    }
    if (this._textureAsset !== _id) {
      if (this._textureAsset) {
        assets.off('add:' + this._textureAsset, this._onTextureAdded, this);
        const _prev = assets.get(this._textureAsset);
        if (_prev) {
          _prev.off('load', this._onTextureLoad, this);
          _prev.off('change', this._onTextureChange, this);
          _prev.off('remove', this._onTextureRemove, this);
        }
      }
      this._textureAsset = _id;
      if (this._textureAsset) {
        const asset = assets.get(this._textureAsset);
        if (!asset) {
          this.texture = null;
          assets.on('add:' + this._textureAsset, this._onTextureAdded, this);
        } else {
          this._bindTextureAsset(asset);
        }
      } else {
        this.texture = null;
      }
    }
  }
  get textureAsset() {
    return this._textureAsset;
  }
  set spriteAsset(value) {
    const assets = this._system.app.assets;
    let _id = value;
    if (value instanceof Asset) {
      _id = value.id;
    }
    if (this._spriteAsset !== _id) {
      if (this._spriteAsset) {
        assets.off('add:' + this._spriteAsset, this._onSpriteAssetAdded, this);
        const _prev = assets.get(this._spriteAsset);
        if (_prev) {
          this._unbindSpriteAsset(_prev);
        }
      }
      this._spriteAsset = _id;
      if (this._spriteAsset) {
        const asset = assets.get(this._spriteAsset);
        if (!asset) {
          this.sprite = null;
          assets.on('add:' + this._spriteAsset, this._onSpriteAssetAdded, this);
        } else {
          this._bindSpriteAsset(asset);
        }
      } else {
        this.sprite = null;
      }
    }
    if (this._element) {
      this._element.fire('set:spriteAsset', _id);
    }
  }
  get spriteAsset() {
    return this._spriteAsset;
  }
  set sprite(value) {
    if (this._sprite === value) return;
    if (this._sprite) {
      this._unbindSprite(this._sprite);
    }
    if (this._spriteAsset) {
      const spriteAsset = this._system.app.assets.get(this._spriteAsset);
      if (spriteAsset && spriteAsset.resource !== value) {
        this.spriteAsset = null;
      }
    }
    this._sprite = value;
    if (this._sprite) {
      this._bindSprite(this._sprite);

      if (this._textureAsset) {
        this.textureAsset = null;
      }
    }
    if (this._sprite && this._sprite.atlas && this._sprite.atlas.texture) {
      this._renderable.setParameter('texture_emissiveMap', this._sprite.atlas.texture);
      this._renderable.setParameter('texture_opacityMap', this._sprite.atlas.texture);
    } else {
      this._renderable.deleteParameter('texture_emissiveMap');
      this._renderable.deleteParameter('texture_opacityMap');
    }

    if (this._sprite) {
      this._spriteFrame = math.clamp(this._spriteFrame, 0, this._sprite.frameKeys.length - 1);
    }
    this._updateSprite();
  }
  get sprite() {
    return this._sprite;
  }
  set spriteFrame(value) {
    const oldValue = this._spriteFrame;
    if (this._sprite) {
      this._spriteFrame = math.clamp(value, 0, this._sprite.frameKeys.length - 1);
    } else {
      this._spriteFrame = value;
    }
    if (this._spriteFrame !== oldValue) {
      this._updateSprite();
    }
    if (this._element) {
      this._element.fire('set:spriteFrame', value);
    }
  }
  get spriteFrame() {
    return this._spriteFrame;
  }
  set mesh(value) {
    this._renderable.setMesh(value);
    if (this._defaultMesh === value) {
      this._renderable.setAabbFunc(null);
    } else {
      this._renderable.setAabbFunc(this._updateAabbFunc);
    }
  }
  get mesh() {
    return this._renderable.mesh;
  }
  set mask(value) {
    if (this._mask !== value) {
      this._mask = value;
      this._toggleMask();
    }
  }
  get mask() {
    return this._mask;
  }
  set pixelsPerUnit(value) {
    if (this._pixelsPerUnit === value) return;
    this._pixelsPerUnit = value;
    if (this._sprite && (this._sprite.renderMode === SPRITE_RENDERMODE_SLICED || this._sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
      this._updateSprite();
    }
  }
  get pixelsPerUnit() {
    return this._pixelsPerUnit;
  }

  get aabb() {
    if (this._renderable.meshInstance) {
      return this._renderable.meshInstance.aabb;
    }
    return null;
  }
}

export { ImageElement };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtZWxlbWVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL2VsZW1lbnQvaW1hZ2UtZWxlbWVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQge1xuICAgIEJVRkZFUl9TVEFUSUMsXG4gICAgRlVOQ19FUVVBTCxcbiAgICBQUklNSVRJVkVfVFJJRkFOLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBTVEVOQ0lMT1BfREVDUkVNRU5ULFxuICAgIFRZUEVfRkxPQVQzMlxufSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUl9IVUQsIExBWUVSX1dPUkxELFxuICAgIFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSwgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9zdGVuY2lsLXBhcmFtZXRlcnMuanMnO1xuXG5pbXBvcnQgeyBGSVRNT0RFX1NUUkVUQ0gsIEZJVE1PREVfQ09OVEFJTiwgRklUTU9ERV9DT1ZFUiB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbi8vICNpZiBfREVCVUdcbmNvbnN0IF9kZWJ1Z0xvZ2dpbmcgPSBmYWxzZTtcbi8vICNlbmRpZlxuXG5jbGFzcyBJbWFnZVJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKGVudGl0eSwgbWVzaCwgbWF0ZXJpYWwpIHtcbiAgICAgICAgdGhpcy5fZW50aXR5ID0gZW50aXR5O1xuICAgICAgICB0aGlzLl9lbGVtZW50ID0gZW50aXR5LmVsZW1lbnQ7XG5cbiAgICAgICAgdGhpcy5tb2RlbCA9IG5ldyBNb2RlbCgpO1xuICAgICAgICB0aGlzLm5vZGUgPSBuZXcgR3JhcGhOb2RlKCk7XG4gICAgICAgIHRoaXMubW9kZWwuZ3JhcGggPSB0aGlzLm5vZGU7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgbWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm5hbWUgPSAnSW1hZ2VFbGVtZW50OiAnICsgZW50aXR5Lm5hbWU7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX21lc2hEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubW9kZWwubWVzaEluc3RhbmNlcy5wdXNoKHRoaXMubWVzaEluc3RhbmNlKTtcblxuICAgICAgICB0aGlzLl9lbnRpdHkuYWRkQ2hpbGQodGhpcy5tb2RlbC5ncmFwaCk7XG4gICAgICAgIHRoaXMubW9kZWwuX2VudGl0eSA9IHRoaXMuX2VudGl0eTtcblxuICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5zZXRNYXRlcmlhbChudWxsKTsgLy8gY2xlYXIgbWF0ZXJpYWwgcmVmZXJlbmNlc1xuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5tb2RlbC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICB0aGlzLm5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2ggPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VudGl0eSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBudWxsO1xuICAgIH1cblxuICAgIHNldE1lc2gobWVzaCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA9ICEhbWVzaDtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1lc2ggPSBtZXNoO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZm9yY2VVcGRhdGVBYWJiKCk7XG4gICAgfVxuXG4gICAgc2V0TWFzayhtYXNrKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgdGhpcy5tZXNoSW5zdGFuY2UubWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5uYW1lID0gJ1VubWFzazogJyArIHRoaXMuX2VudGl0eS5uYW1lO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucGljayA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMucHVzaCh0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIC8vIGNvcHkgcGFyYW1ldGVyc1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMubWVzaEluc3RhbmNlLnBhcmFtZXRlcnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIobmFtZSwgdGhpcy5tZXNoSW5zdGFuY2UucGFyYW1ldGVyc1tuYW1lXS5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSB1bm1hc2sgbWVzaCBpbnN0YW5jZSBmcm9tIG1vZGVsXG4gICAgICAgICAgICBjb25zdCBpZHggPSB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuaW5kZXhPZih0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBtb2RlbCB0aGVuIHJlLWFkZCB0byB1cGRhdGUgdG8gY3VycmVudCBtZXNoIGluc3RhbmNlc1xuICAgICAgICBpZiAodGhpcy5fZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fZWxlbWVudC5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuYWRkTW9kZWxUb0xheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldE1hdGVyaWFsKG1hdGVyaWFsKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRQYXJhbWV0ZXIobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihuYW1lLCB2YWx1ZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlbGV0ZVBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0VW5tYXNrRHJhd09yZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZ2V0TGFzdENoaWxkID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGxldCBsYXN0O1xuICAgICAgICAgICAgY29uc3QgYyA9IGUuY2hpbGRyZW47XG4gICAgICAgICAgICBjb25zdCBsID0gYy5sZW5ndGg7XG4gICAgICAgICAgICBpZiAobCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjW2ldLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3QgPSBjW2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFsYXN0KSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gZ2V0TGFzdENoaWxkKGxhc3QpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBsYXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVGhlIHVubWFzayBtZXNoIGluc3RhbmNlIHJlbmRlcnMgaW50byB0aGUgc3RlbmNpbCBidWZmZXJcbiAgICAgICAgLy8gd2l0aCB0aGUgcmVmIG9mIHRoZSBwcmV2aW91cyBtYXNrLiBUaGlzIGVzc2VudGlhbGx5IFwiY2xlYXJzXCJcbiAgICAgICAgLy8gdGhlIG1hc2sgdmFsdWVcbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGhlIHVubWFzayBoYXMgYSBkcmF3T3JkZXIgc2V0IHRvIGJlIG1pZC13YXkgYmV0d2VlbiB0aGUgbGFzdCBjaGlsZCBvZiB0aGVcbiAgICAgICAgLy8gbWFza2VkIGhpZXJhcmNoeSBhbmQgdGhlIG5leHQgY2hpbGQgdG8gYmUgZHJhd24uXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRoZSBvZmZzZXQgaXMgcmVkdWNlZCBieSBhIHNtYWxsIGZyYWN0aW9uIGVhY2ggdGltZSBzbyB0aGF0IGlmIG11bHRpcGxlIG1hc2tzXG4gICAgICAgIC8vIGVuZCBvbiB0aGUgc2FtZSBsYXN0IGNoaWxkIHRoZXkgYXJlIHVubWFza2VkIGluIHRoZSBjb3JyZWN0IG9yZGVyLlxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGxhc3RDaGlsZCA9IGdldExhc3RDaGlsZCh0aGlzLl9lbnRpdHkpO1xuICAgICAgICAgICAgaWYgKGxhc3RDaGlsZCAmJiBsYXN0Q2hpbGQuZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IGxhc3RDaGlsZC5lbGVtZW50LmRyYXdPcmRlciArIGxhc3RDaGlsZC5lbGVtZW50LmdldE1hc2tPZmZzZXQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdGhpcy5tZXNoSW5zdGFuY2UuZHJhd09yZGVyICsgdGhpcy5fZWxlbWVudC5nZXRNYXNrT2Zmc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykgY29uc29sZS5sb2coJ3NldERyYXdPcmRlcjogJywgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UubmFtZSwgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZHJhd09yZGVyKTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0RHJhd09yZGVyKGRyYXdPcmRlcikge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIGNvbnNvbGUubG9nKCdzZXREcmF3T3JkZXI6ICcsIHRoaXMubWVzaEluc3RhbmNlLm5hbWUsIGRyYXdPcmRlcik7XG4gICAgICAgIC8vICNlbmRpZlxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kcmF3T3JkZXIgPSBkcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgc2V0Q3VsbChjdWxsKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7XG5cbiAgICAgICAgbGV0IHZpc2libGVGbiA9IG51bGw7XG4gICAgICAgIGlmIChjdWxsICYmIGVsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKSkge1xuICAgICAgICAgICAgdmlzaWJsZUZuID0gZnVuY3Rpb24gKGNhbWVyYSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlbGVtZW50LmlzVmlzaWJsZUZvckNhbWVyYShjYW1lcmEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmN1bGwgPSBjdWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5pc1Zpc2libGVGdW5jID0gdmlzaWJsZUZuO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuY3VsbCA9IGN1bGw7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5pc1Zpc2libGVGdW5jID0gdmlzaWJsZUZuO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2NyZWVuU3BhY2Uoc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnNjcmVlblNwYWNlID0gc2NyZWVuU3BhY2U7XG5cbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5zY3JlZW5TcGFjZSA9IHNjcmVlblNwYWNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0TGF5ZXIobGF5ZXIpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmxheWVyID0gbGF5ZXI7XG5cbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5sYXllciA9IGxheWVyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yY2VVcGRhdGVBYWJiKG1hc2spIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl9hYWJiVmVyID0gLTE7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEFhYmJGdW5jKGZuKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSBmbjtcbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSBmbjtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgSW1hZ2VFbGVtZW50IHtcbiAgICBjb25zdHJ1Y3RvcihlbGVtZW50KSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgICB0aGlzLl9lbnRpdHkgPSBlbGVtZW50LmVudGl0eTtcbiAgICAgICAgdGhpcy5fc3lzdGVtID0gZWxlbWVudC5zeXN0ZW07XG5cbiAgICAgICAgLy8gcHVibGljXG4gICAgICAgIHRoaXMuX3RleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RleHR1cmUgPSBudWxsO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLl9zcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3Nwcml0ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gMDtcbiAgICAgICAgdGhpcy5fcGl4ZWxzUGVyVW5pdCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gLTE7IC8vIHdpbGwgYmUgc2V0IHdoZW4gYXNzaWduaW5nIHRleHR1cmVzXG5cbiAgICAgICAgdGhpcy5fcmVjdCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpOyAvLyB4LCB5LCB3LCBoXG5cbiAgICAgICAgdGhpcy5fbWFzayA9IGZhbHNlOyAvLyB0aGlzIGltYWdlIGVsZW1lbnQgaXMgYSBtYXNrXG4gICAgICAgIHRoaXMuX21hc2tSZWYgPSAwOyAvLyBpZCB1c2VkIGluIHN0ZW5jaWwgYnVmZmVyIHRvIG1hc2tcblxuICAgICAgICAvLyA5LXNsaWNpbmdcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZSA9IG5ldyBWZWMyKCk7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICAgICAgdGhpcy5faW5uZXJPZmZzZXQgPSBuZXcgVmVjNCgpO1xuICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9hdGxhc1JlY3QgPSBuZXcgVmVjNCgpO1xuICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcblxuICAgICAgICB0aGlzLl9kZWZhdWx0TWVzaCA9IHRoaXMuX2NyZWF0ZU1lc2goKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZSA9IG5ldyBJbWFnZVJlbmRlcmFibGUodGhpcy5fZW50aXR5LCB0aGlzLl9kZWZhdWx0TWVzaCwgdGhpcy5fbWF0ZXJpYWwpO1xuXG4gICAgICAgIC8vIHNldCBkZWZhdWx0IGNvbG9yc1xuICAgICAgICB0aGlzLl9jb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheShbMSwgMSwgMV0pO1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIDEpO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmJGdW5jID0gdGhpcy5fdXBkYXRlQWFiYi5iaW5kKHRoaXMpO1xuXG4gICAgICAgIC8vIGluaXRpYWxpemUgYmFzZWQgb24gc2NyZWVuXG4gICAgICAgIHRoaXMuX29uU2NyZWVuQ2hhbmdlKHRoaXMuX2VsZW1lbnQuc2NyZWVuKTtcblxuICAgICAgICAvLyBsaXN0ZW4gZm9yIGV2ZW50c1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdyZXNpemUnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzZXQ6cGl2b3QnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzY3JlZW46c2V0OnNjcmVlbnNwYWNlJywgdGhpcy5fb25TY3JlZW5TcGFjZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NldDpzY3JlZW4nLCB0aGlzLl9vblNjcmVlbkNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NldDpkcmF3b3JkZXInLCB0aGlzLl9vbkRyYXdPcmRlckNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NjcmVlbjpzZXQ6cmVzb2x1dGlvbicsIHRoaXMuX29uUmVzb2x1dGlvbkNoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gcmVzZXQgYWxsIGFzc2V0cyB0byB1bmJpbmQgYWxsIGFzc2V0IGV2ZW50c1xuICAgICAgICB0aGlzLnRleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLm1hdGVyaWFsQXNzZXQgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWVzaCh0aGlzLl9kZWZhdWx0TWVzaCk7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9kZWZhdWx0TWVzaCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3Jlc2l6ZScsIHRoaXMuX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzZXQ6cGl2b3QnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2NyZWVuOnNldDpzY3JlZW5zcGFjZScsIHRoaXMuX29uU2NyZWVuU3BhY2VDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2V0OnNjcmVlbicsIHRoaXMuX29uU2NyZWVuQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NldDpkcmF3b3JkZXInLCB0aGlzLl9vbkRyYXdPcmRlckNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzY3JlZW46c2V0OnJlc29sdXRpb24nLCB0aGlzLl9vblJlc29sdXRpb25DaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vblJlc29sdXRpb25DaGFuZ2UocmVzKSB7XG4gICAgfVxuXG4gICAgX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUubWVzaCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWVzaCh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2NyZWVuU3BhY2VDaGFuZ2UodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwodmFsdWUpO1xuICAgIH1cblxuICAgIF9vblNjcmVlbkNoYW5nZShzY3JlZW4sIHByZXZpb3VzKSB7XG4gICAgICAgIGlmIChzY3JlZW4pIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbChmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25EcmF3T3JkZXJDaGFuZ2Uob3JkZXIpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXREcmF3T3JkZXIob3JkZXIpO1xuXG4gICAgICAgIGlmICh0aGlzLm1hc2sgJiYgdGhpcy5fZWxlbWVudC5zY3JlZW4pIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuc2NyZWVuLnNjcmVlbi5vbmNlKCdzeW5jZHJhd29yZGVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0VW5tYXNrRHJhd09yZGVyKCk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJldHVybnMgdHJ1ZSBpZiB3ZSBhcmUgdXNpbmcgYSBtYXRlcmlhbFxuICAgIC8vIG90aGVyIHRoYW4gdGhlIGRlZmF1bHQgbWF0ZXJpYWxzXG4gICAgX2hhc1VzZXJNYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fbWF0ZXJpYWxBc3NldCB8fFxuICAgICAgICAgICAgICAgKCEhdGhpcy5fbWF0ZXJpYWwgJiZcbiAgICAgICAgICAgICAgICB0aGlzLl9zeXN0ZW0uZGVmYXVsdEltYWdlTWF0ZXJpYWxzLmluZGV4T2YodGhpcy5fbWF0ZXJpYWwpID09PSAtMSk7XG4gICAgfVxuXG4gICAgX3VzZTlTbGljaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKSB7XG4gICAgICAgIGNvbnN0IG1hc2sgPSAhIXRoaXMuX21hc2s7XG4gICAgICAgIGNvbnN0IG5pbmVTbGljZWQgPSAhISh0aGlzLnNwcml0ZSAmJiB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpO1xuICAgICAgICBjb25zdCBuaW5lVGlsZWQgPSAhISh0aGlzLnNwcml0ZSAmJiB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9oYXNVc2VyTWF0ZXJpYWwoKSkge1xuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSB0aGlzLl9zeXN0ZW0uZ2V0SW1hZ2VFbGVtZW50TWF0ZXJpYWwoc2NyZWVuU3BhY2UsIG1hc2ssIG5pbmVTbGljZWQsIG5pbmVUaWxlZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkge1xuICAgICAgICAgICAgLy8gY3VsbGluZyBpcyBhbHdheXMgdHJ1ZSBmb3Igbm9uLXNjcmVlbnNwYWNlIChmcnVzdHJ1bSBpcyB1c2VkKTsgZm9yIHNjcmVlbnNwYWNlLCB1c2UgdGhlICdjdWxsJyBwcm9wZXJ0eVxuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRDdWxsKCF0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCkgfHwgdGhpcy5fZWxlbWVudC5faXNTY3JlZW5DdWxsZWQoKSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1hdGVyaWFsKHRoaXMuX21hdGVyaWFsKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0U2NyZWVuU3BhY2Uoc2NyZWVuU3BhY2UpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRMYXllcihzY3JlZW5TcGFjZSA/IExBWUVSX0hVRCA6IExBWUVSX1dPUkxEKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGJ1aWxkIGEgcXVhZCBmb3IgdGhlIGltYWdlXG4gICAgX2NyZWF0ZU1lc2goKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9lbGVtZW50O1xuICAgICAgICBjb25zdCB3ID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgIGNvbnN0IGggPSBlbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgciA9IHRoaXMuX3JlY3Q7XG5cbiAgICAgICAgLy8gTm90ZSB0aGF0IHdoZW4gY3JlYXRpbmcgYSB0eXBlZCBhcnJheSwgaXQncyBpbml0aWFsaXplZCB0byB6ZXJvcy5cbiAgICAgICAgLy8gQWxsb2NhdGUgbWVtb3J5IGZvciA0IHZlcnRpY2VzLCA4IGZsb2F0cyBwZXIgdmVydGV4LCA0IGJ5dGVzIHBlciBmbG9hdC5cbiAgICAgICAgY29uc3QgdmVydGV4RGF0YSA9IG5ldyBBcnJheUJ1ZmZlcig0ICogOCAqIDQpO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhEYXRhRjMyID0gbmV3IEZsb2F0MzJBcnJheSh2ZXJ0ZXhEYXRhKTtcblxuICAgICAgICAvLyBWZXJ0ZXggbGF5b3V0IGlzOiBQWCwgUFksIFBaLCBOWCwgTlksIE5aLCBVLCBWXG4gICAgICAgIC8vIFNpbmNlIHRoZSBtZW1vcnkgaXMgemVyb2VkLCB3ZSB3aWxsIG9ubHkgc2V0IG5vbi16ZXJvIGVsZW1lbnRzXG5cbiAgICAgICAgLy8gUE9TOiAwLCAwLCAwXG4gICAgICAgIHZlcnRleERhdGFGMzJbNV0gPSAxOyAgICAgICAgICAvLyBOWlxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzZdID0gci54OyAgICAgICAgLy8gVVxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzddID0gMS4wIC0gci55OyAgLy8gVlxuXG4gICAgICAgIC8vIFBPUzogdywgMCwgMFxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzhdID0gdzsgICAgICAgICAgLy8gUFhcbiAgICAgICAgdmVydGV4RGF0YUYzMlsxM10gPSAxOyAgICAgICAgIC8vIE5aXG4gICAgICAgIHZlcnRleERhdGFGMzJbMTRdID0gci54ICsgci56OyAvLyBVXG4gICAgICAgIHZlcnRleERhdGFGMzJbMTVdID0gMS4wIC0gci55OyAvLyBWXG5cbiAgICAgICAgLy8gUE9TOiB3LCBoLCAwXG4gICAgICAgIHZlcnRleERhdGFGMzJbMTZdID0gdzsgICAgICAgICAvLyBQWFxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE3XSA9IGg7ICAgICAgICAgLy8gUFlcbiAgICAgICAgdmVydGV4RGF0YUYzMlsyMV0gPSAxOyAgICAgICAgIC8vIE5aXG4gICAgICAgIHZlcnRleERhdGFGMzJbMjJdID0gci54ICsgci56OyAvLyBVXG4gICAgICAgIHZlcnRleERhdGFGMzJbMjNdID0gMS4wIC0gKHIueSArIHIudyk7IC8vIFZcblxuICAgICAgICAvLyBQT1M6IDAsIGgsIDBcbiAgICAgICAgdmVydGV4RGF0YUYzMlsyNV0gPSBoOyAgICAgICAgIC8vIFBZXG4gICAgICAgIHZlcnRleERhdGFGMzJbMjldID0gMTsgICAgICAgICAvLyBOWlxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMwXSA9IHIueDsgICAgICAgLy8gVVxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMxXSA9IDEuMCAtIChyLnkgKyByLncpOyAvLyBWXG5cbiAgICAgICAgY29uc3QgdmVydGV4RGVzYyA9IFtcbiAgICAgICAgICAgIHsgc2VtYW50aWM6IFNFTUFOVElDX1BPU0lUSU9OLCBjb21wb25lbnRzOiAzLCB0eXBlOiBUWVBFX0ZMT0FUMzIgfSxcbiAgICAgICAgICAgIHsgc2VtYW50aWM6IFNFTUFOVElDX05PUk1BTCwgY29tcG9uZW50czogMywgdHlwZTogVFlQRV9GTE9BVDMyIH0sXG4gICAgICAgICAgICB7IHNlbWFudGljOiBTRU1BTlRJQ19URVhDT09SRDAsIGNvbXBvbmVudHM6IDIsIHR5cGU6IFRZUEVfRkxPQVQzMiB9XG4gICAgICAgIF07XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5fc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdChkZXZpY2UsIHZlcnRleERlc2MpO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKGRldmljZSwgdmVydGV4Rm9ybWF0LCA0LCBCVUZGRVJfU1RBVElDLCB2ZXJ0ZXhEYXRhKTtcblxuICAgICAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICAgICAgbWVzaC52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLnR5cGUgPSBQUklNSVRJVkVfVFJJRkFOO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5iYXNlID0gMDtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPSA0O1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkID0gZmFsc2U7XG4gICAgICAgIG1lc2guYWFiYi5zZXRNaW5NYXgoVmVjMy5aRVJPLCBuZXcgVmVjMyh3LCBoLCAwKSk7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlTWVzaChtZXNoKTtcblxuICAgICAgICByZXR1cm4gbWVzaDtcbiAgICB9XG5cbiAgICBfdXBkYXRlTWVzaChtZXNoKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9lbGVtZW50O1xuICAgICAgICBsZXQgdyA9IGVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoO1xuICAgICAgICBsZXQgaCA9IGVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodDtcblxuICAgICAgICBpZiAoZWxlbWVudC5maXRNb2RlICE9PSBGSVRNT0RFX1NUUkVUQ0ggJiYgdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8gPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBhY3R1YWxSYXRpbyA9IGVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoIC8gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuICAgICAgICAgICAgLy8gY2hlY2sgd2hpY2ggY29vcmRpbmF0ZSBtdXN0IGNoYW5nZSBpbiBvcmRlciB0byBwcmVzZXJ2ZSB0aGUgc291cmNlIGFzcGVjdCByYXRpb1xuICAgICAgICAgICAgaWYgKChlbGVtZW50LmZpdE1vZGUgPT09IEZJVE1PREVfQ09OVEFJTiAmJiBhY3R1YWxSYXRpbyA+IHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvKSB8fFxuICAgICAgICAgICAgICAgIChlbGVtZW50LmZpdE1vZGUgPT09IEZJVE1PREVfQ09WRVIgJiYgYWN0dWFsUmF0aW8gPCB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbykpIHtcbiAgICAgICAgICAgICAgICAvLyB1c2UgJ2hlaWdodCcgdG8gcmUtY2FsY3VsYXRlIHdpZHRoXG4gICAgICAgICAgICAgICAgdyA9IGVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodCAqIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB1c2UgJ3dpZHRoJyB0byByZS1jYWxjdWxhdGUgaGVpZ2h0XG4gICAgICAgICAgICAgICAgaCA9IGVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoIC8gdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW87XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgbWF0ZXJpYWxcbiAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSBlbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKTtcblxuICAgICAgICAvLyBmb3JjZSB1cGRhdGUgbWVzaEluc3RhbmNlIGFhYmJcbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUpIHRoaXMuX3JlbmRlcmFibGUuZm9yY2VVcGRhdGVBYWJiKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpKSB7XG5cbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBpbm5lciBvZmZzZXQgZnJvbSB0aGUgZnJhbWUncyBib3JkZXJcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lRGF0YSA9IHRoaXMuX3Nwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5fc3ByaXRlLmZyYW1lS2V5c1t0aGlzLl9zcHJpdGVGcmFtZV1dO1xuICAgICAgICAgICAgY29uc3QgYm9yZGVyV2lkdGhTY2FsZSA9IDIgLyBmcmFtZURhdGEucmVjdC56O1xuICAgICAgICAgICAgY29uc3QgYm9yZGVySGVpZ2h0U2NhbGUgPSAyIC8gZnJhbWVEYXRhLnJlY3QudztcblxuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXQuc2V0KFxuICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueCAqIGJvcmRlcldpZHRoU2NhbGUsXG4gICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci55ICogYm9yZGVySGVpZ2h0U2NhbGUsXG4gICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci56ICogYm9yZGVyV2lkdGhTY2FsZSxcbiAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLncgKiBib3JkZXJIZWlnaHRTY2FsZVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgY29uc3QgdGV4ID0gdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZTtcbiAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdC5zZXQoZnJhbWVEYXRhLnJlY3QueCAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueSAvIHRleC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LnogLyB0ZXgud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LncgLyB0ZXguaGVpZ2h0KTtcblxuICAgICAgICAgICAgLy8gc2NhbGU6IGFwcGx5IFBQVVxuICAgICAgICAgICAgY29uc3QgcHB1ID0gdGhpcy5fcGl4ZWxzUGVyVW5pdCAhPT0gbnVsbCA/IHRoaXMuX3BpeGVsc1BlclVuaXQgOiB0aGlzLnNwcml0ZS5waXhlbHNQZXJVbml0O1xuICAgICAgICAgICAgY29uc3Qgc2NhbGVNdWxYID0gZnJhbWVEYXRhLnJlY3QueiAvIHBwdTtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlTXVsWSA9IGZyYW1lRGF0YS5yZWN0LncgLyBwcHU7XG5cbiAgICAgICAgICAgIC8vIHNjYWxlIGJvcmRlcnMgaWYgbmVjZXNzYXJ5IGluc3RlYWQgb2Ygb3ZlcmxhcHBpbmdcbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUuc2V0KE1hdGgubWF4KHcsIHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCBNYXRoLm1heChoLCB0aGlzLl9pbm5lck9mZnNldC55ICogc2NhbGVNdWxZKSk7XG5cbiAgICAgICAgICAgIGxldCBzY2FsZVggPSBzY2FsZU11bFg7XG4gICAgICAgICAgICBsZXQgc2NhbGVZID0gc2NhbGVNdWxZO1xuXG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnggLz0gc2NhbGVNdWxYO1xuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS55IC89IHNjYWxlTXVsWTtcblxuICAgICAgICAgICAgLy8gc2NhbGU6IHNocmlua2luZyBiZWxvdyAxXG4gICAgICAgICAgICBzY2FsZVggKj0gbWF0aC5jbGFtcCh3IC8gKHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCAwLjAwMDEsIDEpO1xuICAgICAgICAgICAgc2NhbGVZICo9IG1hdGguY2xhbXAoaCAvICh0aGlzLl9pbm5lck9mZnNldC55ICogc2NhbGVNdWxZKSwgMC4wMDAxLCAxKTtcblxuICAgICAgICAgICAgLy8gc2V0IHNjYWxlXG4gICAgICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVswXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lng7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzFdID0gdGhpcy5faW5uZXJPZmZzZXQueTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMl0gPSB0aGlzLl9pbm5lck9mZnNldC56O1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVszXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lnc7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ2lubmVyT2Zmc2V0JywgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzBdID0gdGhpcy5fYXRsYXNSZWN0Lng7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsxXSA9IHRoaXMuX2F0bGFzUmVjdC55O1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bMl0gPSB0aGlzLl9hdGxhc1JlY3QuejtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzNdID0gdGhpcy5fYXRsYXNSZWN0Lnc7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ2F0bGFzUmVjdCcsIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtWzBdID0gdGhpcy5fb3V0ZXJTY2FsZS54O1xuICAgICAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtWzFdID0gdGhpcy5fb3V0ZXJTY2FsZS55O1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdvdXRlclNjYWxlJywgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmModGhpcy5fdXBkYXRlQWFiYkZ1bmMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5ub2RlLnNldExvY2FsU2NhbGUoc2NhbGVYLCBzY2FsZVksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUubm9kZS5zZXRMb2NhbFBvc2l0aW9uKCgwLjUgLSBlbGVtZW50LnBpdm90LngpICogdywgKDAuNSAtIGVsZW1lbnQucGl2b3QueSkgKiBoLCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHZiID0gbWVzaC52ZXJ0ZXhCdWZmZXI7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhEYXRhRjMyID0gbmV3IEZsb2F0MzJBcnJheSh2Yi5sb2NrKCkpO1xuXG4gICAgICAgICAgICAvLyBvZmZzZXQgZm9yIHBpdm90XG4gICAgICAgICAgICBjb25zdCBocCA9IGVsZW1lbnQucGl2b3QueDtcbiAgICAgICAgICAgIGNvbnN0IHZwID0gZWxlbWVudC5waXZvdC55O1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgdmVydGV4IHBvc2l0aW9ucywgYWNjb3VudGluZyBmb3IgdGhlIHBpdm90IG9mZnNldFxuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlswXSA9IDAgLSBocCAqIHc7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzFdID0gMCAtIHZwICogaDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbOF0gPSB3IC0gaHAgKiB3O1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls5XSA9IDAgLSB2cCAqIGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE2XSA9IHcgLSBocCAqIHc7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE3XSA9IGggLSB2cCAqIGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzI0XSA9IDAgLSBocCAqIHc7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzI1XSA9IGggLSB2cCAqIGg7XG5cblxuICAgICAgICAgICAgbGV0IGF0bGFzVGV4dHVyZVdpZHRoID0gMTtcbiAgICAgICAgICAgIGxldCBhdGxhc1RleHR1cmVIZWlnaHQgPSAxO1xuICAgICAgICAgICAgbGV0IHJlY3QgPSB0aGlzLl9yZWN0O1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fc3ByaXRlICYmIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXNbdGhpcy5fc3ByaXRlRnJhbWVdICYmIHRoaXMuX3Nwcml0ZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZyYW1lID0gdGhpcy5fc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLl9zcHJpdGUuZnJhbWVLZXlzW3RoaXMuX3Nwcml0ZUZyYW1lXV07XG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlY3QgPSBmcmFtZS5yZWN0O1xuICAgICAgICAgICAgICAgICAgICBhdGxhc1RleHR1cmVXaWR0aCA9IHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlLndpZHRoO1xuICAgICAgICAgICAgICAgICAgICBhdGxhc1RleHR1cmVIZWlnaHQgPSB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBVcGRhdGUgdmVydGV4IHRleHR1cmUgY29vcmRpbmF0ZXNcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbNl0gPSByZWN0LnggLyBhdGxhc1RleHR1cmVXaWR0aDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbN10gPSAxLjAgLSByZWN0LnkgLyBhdGxhc1RleHR1cmVIZWlnaHQ7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE0XSA9IChyZWN0LnggKyByZWN0LnopIC8gYXRsYXNUZXh0dXJlV2lkdGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE1XSA9IDEuMCAtIHJlY3QueSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjJdID0gKHJlY3QueCArIHJlY3QueikgLyBhdGxhc1RleHR1cmVXaWR0aDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjNdID0gMS4wIC0gKHJlY3QueSArIHJlY3QudykgLyBhdGxhc1RleHR1cmVIZWlnaHQ7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMwXSA9IHJlY3QueCAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlszMV0gPSAxLjAgLSAocmVjdC55ICsgcmVjdC53KSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcblxuICAgICAgICAgICAgdmIudW5sb2NrKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pbiA9IG5ldyBWZWMzKDAgLSBocCAqIHcsIDAgLSB2cCAqIGgsIDApO1xuICAgICAgICAgICAgY29uc3QgbWF4ID0gbmV3IFZlYzModyAtIGhwICogdywgaCAtIHZwICogaCwgMCk7XG4gICAgICAgICAgICBtZXNoLmFhYmIuc2V0TWluTWF4KG1pbiwgbWF4KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxTY2FsZSgxLCAxLCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxQb3NpdGlvbigwLCAwLCAwKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmMobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tZXNoRGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBHZXRzIHRoZSBtZXNoIGZyb20gdGhlIHNwcml0ZSBhc3NldFxuICAgIC8vIGlmIHRoZSBzcHJpdGUgaXMgOS1zbGljZWQgb3IgdGhlIGRlZmF1bHQgbWVzaCBmcm9tIHRoZVxuICAgIC8vIGltYWdlIGVsZW1lbnQgYW5kIGNhbGxzIF91cGRhdGVNZXNoIG9yIHNldHMgbWVzaERpcnR5IHRvIHRydWVcbiAgICAvLyBpZiB0aGUgY29tcG9uZW50IGlzIGN1cnJlbnRseSBiZWluZyBpbml0aWFsaXplZC4gQWxzbyB1cGRhdGVzXG4gICAgLy8gYXNwZWN0IHJhdGlvLiBXZSBuZWVkIHRvIGNhbGwgX3VwZGF0ZVNwcml0ZSBldmVyeSB0aW1lXG4gICAgLy8gc29tZXRoaW5nIHJlbGF0ZWQgdG8gdGhlIHNwcml0ZSBhc3NldCBjaGFuZ2VzXG4gICAgX3VwZGF0ZVNwcml0ZSgpIHtcbiAgICAgICAgbGV0IG5pbmVTbGljZSA9IGZhbHNlO1xuICAgICAgICBsZXQgbWVzaCA9IG51bGw7XG5cbiAgICAgICAgLy8gcmVzZXQgdGFyZ2V0IGFzcGVjdCByYXRpb1xuICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IC0xO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUgJiYgdGhpcy5fc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICAvLyB0YWtlIG1lc2ggZnJvbSBzcHJpdGVcbiAgICAgICAgICAgIG1lc2ggPSB0aGlzLl9zcHJpdGUubWVzaGVzW3RoaXMuc3ByaXRlRnJhbWVdO1xuICAgICAgICAgICAgbmluZVNsaWNlID0gdGhpcy5fc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQ7XG5cbiAgICAgICAgICAgIC8vIHJlLWNhbGN1bGF0ZSBhc3BlY3QgcmF0aW8gZnJvbSBzcHJpdGUgZnJhbWVcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lRGF0YSA9IHRoaXMuX3Nwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5fc3ByaXRlLmZyYW1lS2V5c1t0aGlzLl9zcHJpdGVGcmFtZV1dO1xuICAgICAgICAgICAgaWYgKGZyYW1lRGF0YT8ucmVjdC53ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gZnJhbWVEYXRhLnJlY3QueiAvIGZyYW1lRGF0YS5yZWN0Lnc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB3ZSB1c2UgOSBzbGljaW5nIHRoZW4gdXNlIHRoYXQgbWVzaCBvdGhlcndpc2Uga2VlcCB1c2luZyB0aGUgZGVmYXVsdCBtZXNoXG4gICAgICAgIHRoaXMubWVzaCA9IG5pbmVTbGljZSA/IG1lc2ggOiB0aGlzLl9kZWZhdWx0TWVzaDtcblxuICAgICAgICB0aGlzLnJlZnJlc2hNZXNoKCk7XG4gICAgfVxuXG4gICAgcmVmcmVzaE1lc2goKSB7XG4gICAgICAgIGlmICh0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZWxlbWVudC5fYmVpbmdJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5tZXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVwZGF0ZXMgQUFCQiB3aGlsZSA5LXNsaWNpbmdcbiAgICBfdXBkYXRlQWFiYihhYWJiKSB7XG4gICAgICAgIGFhYmIuY2VudGVyLnNldCgwLCAwLCAwKTtcbiAgICAgICAgYWFiYi5oYWxmRXh0ZW50cy5zZXQodGhpcy5fb3V0ZXJTY2FsZS54ICogMC41LCB0aGlzLl9vdXRlclNjYWxlLnkgKiAwLjUsIDAuMDAxKTtcbiAgICAgICAgYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGFhYmIsIHRoaXMuX3JlbmRlcmFibGUubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgcmV0dXJuIGFhYmI7XG4gICAgfVxuXG4gICAgX3RvZ2dsZU1hc2soKSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQuX2RpcnRpZnlNYXNrKCk7XG5cbiAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKTtcblxuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1hc2soISF0aGlzLl9tYXNrKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsQWRkZWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VudGl0eS5lbmFibGVkKSByZXR1cm47IC8vIGRvbid0IGJpbmQgdW50aWwgZWxlbWVudCBpcyBlbmFibGVkXG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uTWF0ZXJpYWxDaGFuZ2UoKSB7XG5cbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFJlbW92ZSgpIHtcblxuICAgIH1cblxuICAgIF9vblRleHR1cmVBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uVGV4dHVyZUFkZGVkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRUZXh0dXJlQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2JpbmRUZXh0dXJlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbnRpdHkuZW5hYmxlZCkgcmV0dXJuOyAvLyBkb24ndCBiaW5kIHVudGlsIGVsZW1lbnQgaXMgZW5hYmxlZFxuXG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25UZXh0dXJlTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vblRleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uVGV4dHVyZUxvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kVGV4dHVyZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uVGV4dHVyZUxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25UZXh0dXJlTG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLnRleHR1cmUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICB9XG5cbiAgICBfb25UZXh0dXJlQ2hhbmdlKGFzc2V0KSB7XG5cbiAgICB9XG5cbiAgICBfb25UZXh0dXJlUmVtb3ZlKGFzc2V0KSB7XG5cbiAgICB9XG5cbiAgICAvLyBXaGVuIHNwcml0ZSBhc3NldCBpcyBhZGRlZCBiaW5kIGl0XG4gICAgX29uU3ByaXRlQXNzZXRBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uU3ByaXRlQXNzZXRBZGRlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIb29rIHVwIGV2ZW50IGhhbmRsZXJzIG9uIHNwcml0ZSBhc3NldFxuICAgIF9iaW5kU3ByaXRlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbnRpdHkuZW5hYmxlZCkgcmV0dXJuOyAvLyBkb24ndCBiaW5kIHVudGlsIGVsZW1lbnQgaXMgZW5hYmxlZFxuXG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25TcHJpdGVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25TcHJpdGVBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblNwcml0ZUFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZFNwcml0ZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblNwcml0ZUFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblNwcml0ZUFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQuZGF0YS50ZXh0dXJlQXRsYXNBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdsb2FkOicgKyBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0LCB0aGlzLl9vblRleHR1cmVBdGxhc0xvYWQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2hlbiBzcHJpdGUgYXNzZXQgaXMgbG9hZGVkIG1ha2Ugc3VyZSB0aGUgdGV4dHVyZSBhdGxhcyBhc3NldCBpcyBsb2FkZWQgdG9vXG4gICAgLy8gSWYgc28gdGhlbiBzZXQgdGhlIHNwcml0ZSwgb3RoZXJ3aXNlIHdhaXQgZm9yIHRoZSBhdGxhcyB0byBiZSBsb2FkZWQgZmlyc3RcbiAgICBfb25TcHJpdGVBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCFhc3NldCB8fCAhYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghYXNzZXQucmVzb3VyY2UuYXRsYXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdGxhc0Fzc2V0SWQgPSBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0O1xuICAgICAgICAgICAgICAgIGlmIChhdGxhc0Fzc2V0SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2xvYWQ6JyArIGF0bGFzQXNzZXRJZCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2xvYWQ6JyArIGF0bGFzQXNzZXRJZCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXaGVuIHRoZSBzcHJpdGUgYXNzZXQgY2hhbmdlcyByZXNldCBpdFxuICAgIF9vblNwcml0ZUFzc2V0Q2hhbmdlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25TcHJpdGVBc3NldFJlbW92ZShhc3NldCkge1xuICAgIH1cblxuICAgIC8vIEhvb2sgdXAgZXZlbnQgaGFuZGxlcnMgb24gc3ByaXRlIGFzc2V0XG4gICAgX2JpbmRTcHJpdGUoc3ByaXRlKSB7XG4gICAgICAgIHNwcml0ZS5vbignc2V0Om1lc2hlcycsIHRoaXMuX29uU3ByaXRlTWVzaGVzQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6cGl4ZWxzUGVyVW5pdCcsIHRoaXMuX29uU3ByaXRlUHB1Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6YXRsYXMnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGlmIChzcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgIHNwcml0ZS5hdGxhcy5vbignc2V0OnRleHR1cmUnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kU3ByaXRlKHNwcml0ZSkge1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6cGl4ZWxzUGVyVW5pdCcsIHRoaXMuX29uU3ByaXRlUHB1Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9mZignc2V0OmF0bGFzJywgdGhpcy5fb25BdGxhc1RleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBpZiAoc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICBzcHJpdGUuYXRsYXMub2ZmKCdzZXQ6dGV4dHVyZScsIHRoaXMuX29uQXRsYXNUZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNwcml0ZU1lc2hlc0NoYW5nZSgpIHtcbiAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSBtYXRoLmNsYW1wKHRoaXMuX3Nwcml0ZUZyYW1lLCAwLCB0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yY2UgdXBkYXRlXG4gICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgIH1cblxuICAgIF9vblNwcml0ZVBwdUNoYW5nZSgpIHtcbiAgICAgICAgLy8gZm9yY2UgdXBkYXRlIHdoZW4gdGhlIHNwcml0ZSBpcyA5LXNsaWNlZC4gSWYgaXQncyBub3RcbiAgICAgICAgLy8gdGhlbiBpdHMgbWVzaCB3aWxsIGNoYW5nZSB3aGVuIHRoZSBwcHUgY2hhbmdlcyB3aGljaCB3aWxsXG4gICAgICAgIC8vIGJlIGhhbmRsZWQgYnkgb25TcHJpdGVNZXNoZXNDaGFuZ2VcbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgIT09IFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSAmJiB0aGlzLl9waXhlbHNQZXJVbml0ID09PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uQXRsYXNUZXh0dXJlQ2hhbmdlKCkge1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgdGhpcy5zcHJpdGUuYXRsYXMgJiYgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJywgdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdoZW4gYXRsYXMgaXMgbG9hZGVkIHRyeSB0byByZXNldCB0aGUgc3ByaXRlIGFzc2V0XG4gICAgX29uVGV4dHVyZUF0bGFzTG9hZChhdGxhc0Fzc2V0KSB7XG4gICAgICAgIGNvbnN0IHNwcml0ZUFzc2V0ID0gdGhpcy5fc3ByaXRlQXNzZXQ7XG4gICAgICAgIGlmIChzcHJpdGVBc3NldCBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBfc3ByaXRlQXNzZXQgc2hvdWxkIG5ldmVyIGJlIGFuIGFzc2V0IGluc3RhbmNlP1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoc3ByaXRlQXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQodGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHNwcml0ZUFzc2V0KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl9tYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl90ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZFRleHR1cmVBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbGVtZW50LmFkZE1vZGVsVG9MYXllcnModGhpcy5fcmVuZGVyYWJsZS5tb2RlbCk7XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLl9yZW5kZXJhYmxlLm1vZGVsKTtcbiAgICB9XG5cbiAgICBfc2V0U3RlbmNpbChzdGVuY2lsUGFyYW1zKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlLnN0ZW5jaWxGcm9udCA9IHN0ZW5jaWxQYXJhbXM7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrID0gc3RlbmNpbFBhcmFtcztcblxuICAgICAgICBsZXQgcmVmID0gMDtcbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQubWFza2VkQnkpIHtcbiAgICAgICAgICAgIHJlZiA9IHRoaXMuX2VsZW1lbnQubWFza2VkQnkuZWxlbWVudC5faW1hZ2UuX21hc2tSZWY7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICBjb25zdCBzcCA9IG5ldyBTdGVuY2lsUGFyYW1ldGVycyh7XG4gICAgICAgICAgICAgICAgcmVmOiByZWYgKyAxLFxuICAgICAgICAgICAgICAgIGZ1bmM6IEZVTkNfRVFVQUwsXG4gICAgICAgICAgICAgICAgenBhc3M6IFNURU5DSUxPUF9ERUNSRU1FTlRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnVubWFza01lc2hJbnN0YW5jZS5zdGVuY2lsRnJvbnQgPSBzcDtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrID0gc3A7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgY29sb3IodmFsdWUpIHtcbiAgICAgICAgY29uc3QgciA9IHZhbHVlLnI7XG4gICAgICAgIGNvbnN0IGcgPSB2YWx1ZS5nO1xuICAgICAgICBjb25zdCBiID0gdmFsdWUuYjtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh0aGlzLl9jb2xvciA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ1NldHRpbmcgZWxlbWVudC5jb2xvciB0byBpdHNlbGYgd2lsbCBoYXZlIG5vIGVmZmVjdCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmICh0aGlzLl9jb2xvci5yICE9PSByIHx8IHRoaXMuX2NvbG9yLmcgIT09IGcgfHwgdGhpcy5fY29sb3IuYiAhPT0gYikge1xuICAgICAgICAgICAgdGhpcy5fY29sb3IuciA9IHI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5nID0gZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmIgPSBiO1xuXG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSByO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IGI7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0OmNvbG9yJywgdGhpcy5fY29sb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgc2V0IG9wYWNpdHkodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9jb2xvci5hKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5hID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmZpcmUoJ3NldDpvcGFjaXR5JywgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9wYWNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvci5hO1xuICAgIH1cblxuICAgIHNldCByZWN0KHZhbHVlKSB7XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRoaXMuX3JlY3QgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1NldHRpbmcgZWxlbWVudC5yZWN0IHRvIGl0c2VsZiB3aWxsIGhhdmUgbm8gZWZmZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgbGV0IHgsIHksIHosIHc7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgIHggPSB2YWx1ZS54O1xuICAgICAgICAgICAgeSA9IHZhbHVlLnk7XG4gICAgICAgICAgICB6ID0gdmFsdWUuejtcbiAgICAgICAgICAgIHcgPSB2YWx1ZS53O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgeSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgeiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgdyA9IHZhbHVlWzNdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHggPT09IHRoaXMuX3JlY3QueCAmJlxuICAgICAgICAgICAgeSA9PT0gdGhpcy5fcmVjdC55ICYmXG4gICAgICAgICAgICB6ID09PSB0aGlzLl9yZWN0LnogJiZcbiAgICAgICAgICAgIHcgPT09IHRoaXMuX3JlY3Qud1xuICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3JlY3Quc2V0KHgsIHksIHosIHcpO1xuXG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZWxlbWVudC5fYmVpbmdJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5fcmVuZGVyYWJsZS5tZXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjdDtcbiAgICB9XG5cbiAgICBzZXQgbWF0ZXJpYWwodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmVlblNwYWNlID0gdGhpcy5fZWxlbWVudC5faXNTY3JlZW5TcGFjZSgpO1xuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gc2NyZWVuU3BhY2UgPyB0aGlzLl9zeXN0ZW0uZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwgOiB0aGlzLl9zeXN0ZW0uZGVmYXVsdEltYWdlTWFza01hdGVyaWFsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHNjcmVlblNwYWNlID8gdGhpcy5fc3lzdGVtLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwgOiB0aGlzLl9zeXN0ZW0uZGVmYXVsdEltYWdlTWF0ZXJpYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWF0ZXJpYWwodmFsdWUpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIG5vdCB0aGUgZGVmYXVsdCBtYXRlcmlhbCB0aGVuIGNsZWFyIGNvbG9yIGFuZCBvcGFjaXR5IG92ZXJyaWRlc1xuICAgICAgICAgICAgaWYgKHRoaXMuX2hhc1VzZXJNYXRlcmlhbCgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIGlmIHdlIGFyZSBiYWNrIHRvIHRoZSBkZWZhdWx0cyByZXNldCB0aGUgY29sb3IgYW5kIG9wYWNpdHlcbiAgICAgICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsxXSA9IHRoaXMuX2NvbG9yLmc7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgdGhpcy5fY29sb3IuYSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICBzZXQgbWF0ZXJpYWxBc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoX3ByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgX3ByZXYub2ZmKCdsb2FkJywgdGhpcy5fb25NYXRlcmlhbExvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2NoYW5nZScsIHRoaXMuX29uTWF0ZXJpYWxDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxSZW1vdmUsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IF9pZDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbEFzc2V0O1xuICAgIH1cblxuICAgIHNldCB0ZXh0dXJlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmVBc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKHRleHR1cmVBc3NldCAmJiB0ZXh0dXJlQXNzZXQucmVzb3VyY2UgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdGV4dHVyZSA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSkge1xuXG4gICAgICAgICAgICAvLyBjbGVhciBzcHJpdGUgYXNzZXQgaWYgdGV4dHVyZSBpcyBzZXRcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkZWZhdWx0IHRleHR1cmUganVzdCB1c2VzIGVtaXNzaXZlIGFuZCBvcGFjaXR5IG1hcHNcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJywgdGhpcy5fdGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJywgdGhpcy5fdGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX2NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCB0aGlzLl9jb2xvci5hKTtcblxuICAgICAgICAgICAgLy8gaWYgdGV4dHVyZSdzIGFzcGVjdCByYXRpbyBjaGFuZ2VkIGFuZCB0aGUgZWxlbWVudCBuZWVkcyB0byBwcmVzZXJ2ZSBhc3BlY3QgcmF0aW8sIHJlZnJlc2ggdGhlIG1lc2hcbiAgICAgICAgICAgIGNvbnN0IG5ld0FzcGVjdFJhdGlvID0gdGhpcy5fdGV4dHVyZS53aWR0aCAvIHRoaXMuX3RleHR1cmUuaGVpZ2h0O1xuICAgICAgICAgICAgaWYgKG5ld0FzcGVjdFJhdGlvICE9PSB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gbmV3QXNwZWN0UmF0aW87XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQuZml0TW9kZSAhPT0gRklUTU9ERV9TVFJFVENIKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcmVzaE1lc2goKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcblxuICAgICAgICAgICAgLy8gcmVzZXQgdGFyZ2V0IGFzcGVjdCByYXRpbyBhbmQgcmVmcmVzaCBtZXNoIGlmIHRoZXJlIGlzIGFuIGFzcGVjdCByYXRpbyBzZXR0aW5nXG4gICAgICAgICAgICAvLyB0aGlzIGlzIG5lZWRlZCBpbiBvcmRlciB0byBwcm9wZXJseSByZXNldCB0aGUgbWVzaCB0byAnc3RyZXRjaCcgYWNyb3NzIHRoZSBlbnRpcmUgZWxlbWVudCBib3VuZHNcbiAgICAgICAgICAgIC8vIHdoZW4gcmVzZXR0aW5nIHRoZSB0ZXh0dXJlXG4gICAgICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IC0xO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQuZml0TW9kZSAhPT0gRklUTU9ERV9TVFJFVENIKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoTWVzaCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHRleHR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlO1xuICAgIH1cblxuICAgIHNldCB0ZXh0dXJlQXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGxldCBfaWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX3RleHR1cmVBc3NldCwgdGhpcy5fb25UZXh0dXJlQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2xvYWQnLCB0aGlzLl9vblRleHR1cmVMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgX3ByZXYub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblRleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ3JlbW92ZScsIHRoaXMuX29uVGV4dHVyZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlQXNzZXQgPSBfaWQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX3RleHR1cmVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBhc3NldHMub24oJ2FkZDonICsgdGhpcy5fdGV4dHVyZUFzc2V0LCB0aGlzLl9vblRleHR1cmVBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYmluZFRleHR1cmVBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHRleHR1cmVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmVBc3NldDtcbiAgICB9XG5cbiAgICBzZXQgc3ByaXRlQXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGxldCBfaWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQgIT09IF9pZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9zcHJpdGVBc3NldCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fc3ByaXRlQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRTcHJpdGVBc3NldChfcHJldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9zcHJpdGVBc3NldCA9IF9pZDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNwcml0ZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9zcHJpdGVBc3NldCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kU3ByaXRlQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0OnNwcml0ZUFzc2V0JywgX2lkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzcHJpdGVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZUFzc2V0O1xuICAgIH1cblxuICAgIHNldCBzcHJpdGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl91bmJpbmRTcHJpdGUodGhpcy5fc3ByaXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgY29uc3Qgc3ByaXRlQXNzZXQgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5fc3ByaXRlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKHNwcml0ZUFzc2V0ICYmIHNwcml0ZUFzc2V0LnJlc291cmNlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3ByaXRlID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fYmluZFNwcml0ZSh0aGlzLl9zcHJpdGUpO1xuXG4gICAgICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIGlmIHNwcml0ZSBpcyBiZWluZyBzZXRcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlICYmIHRoaXMuX3Nwcml0ZS5hdGxhcyAmJiB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgLy8gZGVmYXVsdCB0ZXh0dXJlIGp1c3QgdXNlcyBlbWlzc2l2ZSBhbmQgb3BhY2l0eSBtYXBzXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcsIHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsYW1wIGZyYW1lXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gbWF0aC5jbGFtcCh0aGlzLl9zcHJpdGVGcmFtZSwgMCwgdGhpcy5fc3ByaXRlLmZyYW1lS2V5cy5sZW5ndGggLSAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgIH1cblxuICAgIGdldCBzcHJpdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcHJpdGU7XG4gICAgfVxuXG4gICAgc2V0IHNwcml0ZUZyYW1lKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpcy5fc3ByaXRlRnJhbWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gbWF0aC5jbGFtcCh2YWx1ZSwgMCwgdGhpcy5fc3ByaXRlLmZyYW1lS2V5cy5sZW5ndGggLSAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlRnJhbWUgIT09IG9sZFZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTcHJpdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmZpcmUoJ3NldDpzcHJpdGVGcmFtZScsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzcHJpdGVGcmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZUZyYW1lO1xuICAgIH1cblxuICAgIHNldCBtZXNoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWVzaCh2YWx1ZSk7XG4gICAgICAgIGlmICh0aGlzLl9kZWZhdWx0TWVzaCA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmMobnVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldEFhYmJGdW5jKHRoaXMuX3VwZGF0ZUFhYmJGdW5jKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtZXNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyYWJsZS5tZXNoO1xuICAgIH1cblxuICAgIHNldCBtYXNrKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXNrICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbWFzayA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlTWFzaygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hc2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrO1xuICAgIH1cblxuICAgIHNldCBwaXhlbHNQZXJVbml0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9waXhlbHNQZXJVbml0ID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3BpeGVsc1BlclVuaXQgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSAmJiAodGhpcy5fc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTcHJpdGUoKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgZ2V0IHBpeGVsc1BlclVuaXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXhlbHNQZXJVbml0O1xuICAgIH1cblxuICAgIC8vIHByaXZhdGVcbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2UuYWFiYjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEltYWdlRWxlbWVudCB9O1xuIl0sIm5hbWVzIjpbIkltYWdlUmVuZGVyYWJsZSIsImNvbnN0cnVjdG9yIiwiZW50aXR5IiwibWVzaCIsIm1hdGVyaWFsIiwiX2VudGl0eSIsIl9lbGVtZW50IiwiZWxlbWVudCIsIm1vZGVsIiwiTW9kZWwiLCJub2RlIiwiR3JhcGhOb2RlIiwiZ3JhcGgiLCJtZXNoSW5zdGFuY2UiLCJNZXNoSW5zdGFuY2UiLCJuYW1lIiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJfbWVzaERpcnR5IiwibWVzaEluc3RhbmNlcyIsInB1c2giLCJhZGRDaGlsZCIsInVubWFza01lc2hJbnN0YW5jZSIsImRlc3Ryb3kiLCJzZXRNYXRlcmlhbCIsInJlbW92ZU1vZGVsRnJvbUxheWVycyIsInNldE1lc2giLCJ2aXNpYmxlIiwiZm9yY2VVcGRhdGVBYWJiIiwic2V0TWFzayIsIm1hc2siLCJwaWNrIiwicGFyYW1ldGVycyIsInNldFBhcmFtZXRlciIsImRhdGEiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwiZW5hYmxlZCIsImFkZE1vZGVsVG9MYXllcnMiLCJ2YWx1ZSIsImRlbGV0ZVBhcmFtZXRlciIsInNldFVubWFza0RyYXdPcmRlciIsImdldExhc3RDaGlsZCIsImUiLCJsYXN0IiwiYyIsImNoaWxkcmVuIiwibCIsImxlbmd0aCIsImkiLCJjaGlsZCIsImxhc3RDaGlsZCIsImRyYXdPcmRlciIsImdldE1hc2tPZmZzZXQiLCJzZXREcmF3T3JkZXIiLCJzZXRDdWxsIiwiY3VsbCIsInZpc2libGVGbiIsIl9pc1NjcmVlblNwYWNlIiwiY2FtZXJhIiwiaXNWaXNpYmxlRm9yQ2FtZXJhIiwiaXNWaXNpYmxlRnVuYyIsInNldFNjcmVlblNwYWNlIiwic2NyZWVuU3BhY2UiLCJzZXRMYXllciIsImxheWVyIiwiX2FhYmJWZXIiLCJzZXRBYWJiRnVuYyIsImZuIiwiX3VwZGF0ZUFhYmJGdW5jIiwiSW1hZ2VFbGVtZW50IiwiX3N5c3RlbSIsInN5c3RlbSIsIl90ZXh0dXJlQXNzZXQiLCJfdGV4dHVyZSIsIl9tYXRlcmlhbEFzc2V0IiwiX21hdGVyaWFsIiwiX3Nwcml0ZUFzc2V0IiwiX3Nwcml0ZSIsIl9zcHJpdGVGcmFtZSIsIl9waXhlbHNQZXJVbml0IiwiX3RhcmdldEFzcGVjdFJhdGlvIiwiX3JlY3QiLCJWZWM0IiwiX21hc2siLCJfbWFza1JlZiIsIl9vdXRlclNjYWxlIiwiVmVjMiIsIl9vdXRlclNjYWxlVW5pZm9ybSIsIkZsb2F0MzJBcnJheSIsIl9pbm5lck9mZnNldCIsIl9pbm5lck9mZnNldFVuaWZvcm0iLCJfYXRsYXNSZWN0IiwiX2F0bGFzUmVjdFVuaWZvcm0iLCJfZGVmYXVsdE1lc2giLCJfY3JlYXRlTWVzaCIsIl9yZW5kZXJhYmxlIiwiX2NvbG9yIiwiQ29sb3IiLCJfY29sb3JVbmlmb3JtIiwiX3VwZGF0ZUFhYmIiLCJiaW5kIiwiX29uU2NyZWVuQ2hhbmdlIiwic2NyZWVuIiwib24iLCJfb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlIiwiX29uU2NyZWVuU3BhY2VDaGFuZ2UiLCJfb25EcmF3T3JkZXJDaGFuZ2UiLCJfb25SZXNvbHV0aW9uQ2hhbmdlIiwidGV4dHVyZUFzc2V0Iiwic3ByaXRlQXNzZXQiLCJtYXRlcmlhbEFzc2V0Iiwib2ZmIiwicmVzIiwiX3VwZGF0ZU1lc2giLCJfdXBkYXRlTWF0ZXJpYWwiLCJwcmV2aW91cyIsIm9yZGVyIiwib25jZSIsIl9oYXNVc2VyTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2VNYXRlcmlhbHMiLCJfdXNlOVNsaWNpbmciLCJzcHJpdGUiLCJyZW5kZXJNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJuaW5lU2xpY2VkIiwibmluZVRpbGVkIiwiZ2V0SW1hZ2VFbGVtZW50TWF0ZXJpYWwiLCJfaXNTY3JlZW5DdWxsZWQiLCJMQVlFUl9IVUQiLCJMQVlFUl9XT1JMRCIsInciLCJjYWxjdWxhdGVkV2lkdGgiLCJoIiwiY2FsY3VsYXRlZEhlaWdodCIsInIiLCJ2ZXJ0ZXhEYXRhIiwiQXJyYXlCdWZmZXIiLCJ2ZXJ0ZXhEYXRhRjMyIiwieCIsInkiLCJ6IiwidmVydGV4RGVzYyIsInNlbWFudGljIiwiU0VNQU5USUNfUE9TSVRJT04iLCJjb21wb25lbnRzIiwidHlwZSIsIlRZUEVfRkxPQVQzMiIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX1RFWENPT1JEMCIsImRldmljZSIsImFwcCIsImdyYXBoaWNzRGV2aWNlIiwidmVydGV4Rm9ybWF0IiwiVmVydGV4Rm9ybWF0IiwidmVydGV4QnVmZmVyIiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX1NUQVRJQyIsIk1lc2giLCJwcmltaXRpdmUiLCJQUklNSVRJVkVfVFJJRkFOIiwiYmFzZSIsImNvdW50IiwiaW5kZXhlZCIsImFhYmIiLCJzZXRNaW5NYXgiLCJWZWMzIiwiWkVSTyIsImZpdE1vZGUiLCJGSVRNT0RFX1NUUkVUQ0giLCJhY3R1YWxSYXRpbyIsIkZJVE1PREVfQ09OVEFJTiIsIkZJVE1PREVfQ09WRVIiLCJmcmFtZURhdGEiLCJhdGxhcyIsImZyYW1lcyIsImZyYW1lS2V5cyIsImJvcmRlcldpZHRoU2NhbGUiLCJyZWN0IiwiYm9yZGVySGVpZ2h0U2NhbGUiLCJzZXQiLCJib3JkZXIiLCJ0ZXgiLCJ0ZXh0dXJlIiwid2lkdGgiLCJoZWlnaHQiLCJwcHUiLCJwaXhlbHNQZXJVbml0Iiwic2NhbGVNdWxYIiwic2NhbGVNdWxZIiwiTWF0aCIsIm1heCIsInNjYWxlWCIsInNjYWxlWSIsIm1hdGgiLCJjbGFtcCIsInNldExvY2FsU2NhbGUiLCJzZXRMb2NhbFBvc2l0aW9uIiwicGl2b3QiLCJ2YiIsImxvY2siLCJocCIsInZwIiwiYXRsYXNUZXh0dXJlV2lkdGgiLCJhdGxhc1RleHR1cmVIZWlnaHQiLCJmcmFtZSIsInVubG9jayIsIm1pbiIsIl91cGRhdGVTcHJpdGUiLCJuaW5lU2xpY2UiLCJtZXNoZXMiLCJzcHJpdGVGcmFtZSIsInJlZnJlc2hNZXNoIiwiX2JlaW5nSW5pdGlhbGl6ZWQiLCJjZW50ZXIiLCJoYWxmRXh0ZW50cyIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsIl90b2dnbGVNYXNrIiwiX2RpcnRpZnlNYXNrIiwiX29uTWF0ZXJpYWxMb2FkIiwiYXNzZXQiLCJyZXNvdXJjZSIsIl9vbk1hdGVyaWFsQWRkZWQiLCJhc3NldHMiLCJpZCIsIl9iaW5kTWF0ZXJpYWxBc3NldCIsIl9vbk1hdGVyaWFsQ2hhbmdlIiwiX29uTWF0ZXJpYWxSZW1vdmUiLCJsb2FkIiwiX3VuYmluZE1hdGVyaWFsQXNzZXQiLCJfb25UZXh0dXJlQWRkZWQiLCJfYmluZFRleHR1cmVBc3NldCIsIl9vblRleHR1cmVMb2FkIiwiX29uVGV4dHVyZUNoYW5nZSIsIl9vblRleHR1cmVSZW1vdmUiLCJfdW5iaW5kVGV4dHVyZUFzc2V0IiwiX29uU3ByaXRlQXNzZXRBZGRlZCIsIl9iaW5kU3ByaXRlQXNzZXQiLCJfb25TcHJpdGVBc3NldExvYWQiLCJfb25TcHJpdGVBc3NldENoYW5nZSIsIl9vblNwcml0ZUFzc2V0UmVtb3ZlIiwiX3VuYmluZFNwcml0ZUFzc2V0IiwidGV4dHVyZUF0bGFzQXNzZXQiLCJfb25UZXh0dXJlQXRsYXNMb2FkIiwiYXRsYXNBc3NldElkIiwiX2JpbmRTcHJpdGUiLCJfb25TcHJpdGVNZXNoZXNDaGFuZ2UiLCJfb25TcHJpdGVQcHVDaGFuZ2UiLCJfb25BdGxhc1RleHR1cmVDaGFuZ2UiLCJfdW5iaW5kU3ByaXRlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIiwiYXRsYXNBc3NldCIsIkFzc2V0IiwiZ2V0Iiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJfc2V0U3RlbmNpbCIsInN0ZW5jaWxQYXJhbXMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInJlZiIsIm1hc2tlZEJ5IiwiX2ltYWdlIiwic3AiLCJTdGVuY2lsUGFyYW1ldGVycyIsImZ1bmMiLCJGVU5DX0VRVUFMIiwienBhc3MiLCJTVEVOQ0lMT1BfREVDUkVNRU5UIiwiY29sb3IiLCJnIiwiYiIsIkRlYnVnIiwid2FybiIsImZpcmUiLCJvcGFjaXR5IiwiYSIsImNvbnNvbGUiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCIsImRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2VNYXRlcmlhbCIsIl9pZCIsIl9wcmV2IiwibmV3QXNwZWN0UmF0aW8iLCJvbGRWYWx1ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFxQ0EsTUFBTUEsZUFBZSxDQUFDO0FBQ2xCQyxFQUFBQSxXQUFXLENBQUNDLE1BQU0sRUFBRUMsSUFBSSxFQUFFQyxRQUFRLEVBQUU7SUFDaEMsSUFBSSxDQUFDQyxPQUFPLEdBQUdILE1BQU0sQ0FBQTtBQUNyQixJQUFBLElBQUksQ0FBQ0ksUUFBUSxHQUFHSixNQUFNLENBQUNLLE9BQU8sQ0FBQTtBQUU5QixJQUFBLElBQUksQ0FBQ0MsS0FBSyxHQUFHLElBQUlDLEtBQUssRUFBRSxDQUFBO0FBQ3hCLElBQUEsSUFBSSxDQUFDQyxJQUFJLEdBQUcsSUFBSUMsU0FBUyxFQUFFLENBQUE7QUFDM0IsSUFBQSxJQUFJLENBQUNILEtBQUssQ0FBQ0ksS0FBSyxHQUFHLElBQUksQ0FBQ0YsSUFBSSxDQUFBO0lBRTVCLElBQUksQ0FBQ1AsSUFBSSxHQUFHQSxJQUFJLENBQUE7QUFDaEIsSUFBQSxJQUFJLENBQUNVLFlBQVksR0FBRyxJQUFJQyxZQUFZLENBQUMsSUFBSSxDQUFDWCxJQUFJLEVBQUVDLFFBQVEsRUFBRSxJQUFJLENBQUNNLElBQUksQ0FBQyxDQUFBO0lBQ3BFLElBQUksQ0FBQ0csWUFBWSxDQUFDRSxJQUFJLEdBQUcsZ0JBQWdCLEdBQUdiLE1BQU0sQ0FBQ2EsSUFBSSxDQUFBO0FBQ3ZELElBQUEsSUFBSSxDQUFDRixZQUFZLENBQUNHLFVBQVUsR0FBRyxLQUFLLENBQUE7QUFDcEMsSUFBQSxJQUFJLENBQUNILFlBQVksQ0FBQ0ksYUFBYSxHQUFHLEtBQUssQ0FBQTtJQUV2QyxJQUFJLENBQUNDLFVBQVUsR0FBRyxLQUFLLENBQUE7SUFFdkIsSUFBSSxDQUFDVixLQUFLLENBQUNXLGFBQWEsQ0FBQ0MsSUFBSSxD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
