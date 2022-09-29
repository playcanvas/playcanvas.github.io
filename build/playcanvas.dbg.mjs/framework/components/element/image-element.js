/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../math/math.js';
import { Color } from '../../../math/color.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';
import { Vec4 } from '../../../math/vec4.js';
import { BUFFER_STATIC, PRIMITIVE_TRIFAN, FUNC_EQUAL, STENCILOP_DECREMENT, SEMANTIC_POSITION, TYPE_FLOAT32, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD0 } from '../../../graphics/constants.js';
import { VertexBuffer } from '../../../graphics/vertex-buffer.js';
import { VertexFormat } from '../../../graphics/vertex-format.js';
import { SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, LAYER_HUD, LAYER_WORLD, SPRITE_RENDERMODE_SIMPLE } from '../../../scene/constants.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Mesh } from '../../../scene/mesh.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { StencilParameters } from '../../../scene/stencil-parameters.js';
import { FITMODE_STRETCH, FITMODE_CONTAIN, FITMODE_COVER } from './constants.js';
import { Asset } from '../../../asset/asset.js';

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtZWxlbWVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL2VsZW1lbnQvaW1hZ2UtZWxlbWVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgQlVGRkVSX1NUQVRJQyxcbiAgICBGVU5DX0VRVUFMLFxuICAgIFBSSU1JVElWRV9UUklGQU4sXG4gICAgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfVEVYQ09PUkQwLFxuICAgIFNURU5DSUxPUF9ERUNSRU1FTlQsXG4gICAgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uLy4uLy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4uLy4uLy4uL2dyYXBoaWNzL3ZlcnRleC1mb3JtYXQuanMnO1xuXG5pbXBvcnQge1xuICAgIExBWUVSX0hVRCwgTEFZRVJfV09STEQsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFLCBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQsIFNQUklURV9SRU5ERVJNT0RFX1RJTEVEXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tb2RlbC5qcyc7XG5pbXBvcnQgeyBTdGVuY2lsUGFyYW1ldGVycyB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3N0ZW5jaWwtcGFyYW1ldGVycy5qcyc7XG5cbmltcG9ydCB7IEZJVE1PREVfU1RSRVRDSCwgRklUTU9ERV9DT05UQUlOLCBGSVRNT0RFX0NPVkVSIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuLy8gI2lmIF9ERUJVR1xuY29uc3QgX2RlYnVnTG9nZ2luZyA9IGZhbHNlO1xuLy8gI2VuZGlmXG5cbmNsYXNzIEltYWdlUmVuZGVyYWJsZSB7XG4gICAgY29uc3RydWN0b3IoZW50aXR5LCBtZXNoLCBtYXRlcmlhbCkge1xuICAgICAgICB0aGlzLl9lbnRpdHkgPSBlbnRpdHk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBlbnRpdHkuZWxlbWVudDtcblxuICAgICAgICB0aGlzLm1vZGVsID0gbmV3IE1vZGVsKCk7XG4gICAgICAgIHRoaXMubm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICAgICAgdGhpcy5tb2RlbC5ncmFwaCA9IHRoaXMubm9kZTtcblxuICAgICAgICB0aGlzLm1lc2ggPSBtZXNoO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UodGhpcy5tZXNoLCBtYXRlcmlhbCwgdGhpcy5ub2RlKTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UubmFtZSA9ICdJbWFnZUVsZW1lbnQ6ICcgKyBlbnRpdHkubmFtZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGZhbHNlO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5yZWNlaXZlU2hhZG93ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbWVzaERpcnR5ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5tb2RlbC5tZXNoSW5zdGFuY2VzLnB1c2godGhpcy5tZXNoSW5zdGFuY2UpO1xuXG4gICAgICAgIHRoaXMuX2VudGl0eS5hZGRDaGlsZCh0aGlzLm1vZGVsLmdyYXBoKTtcbiAgICAgICAgdGhpcy5tb2RlbC5fZW50aXR5ID0gdGhpcy5fZW50aXR5O1xuXG4gICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLnNldE1hdGVyaWFsKG51bGwpOyAvLyBjbGVhciBtYXRlcmlhbCByZWZlcmVuY2VzXG4gICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKHRoaXMubW9kZWwpO1xuICAgICAgICB0aGlzLm1vZGVsLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgIHRoaXMubm9kZSA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaCA9IG51bGw7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZW50aXR5ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZWxlbWVudCA9IG51bGw7XG4gICAgfVxuXG4gICAgc2V0TWVzaChtZXNoKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2ggPSBtZXNoO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm1lc2ggPSBtZXNoO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gISFtZXNoO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UubWVzaCA9IG1lc2g7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mb3JjZVVwZGF0ZUFhYmIoKTtcbiAgICB9XG5cbiAgICBzZXRNYXNrKG1hc2spIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmIChtYXNrKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UodGhpcy5tZXNoLCB0aGlzLm1lc2hJbnN0YW5jZS5tYXRlcmlhbCwgdGhpcy5ub2RlKTtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm5hbWUgPSAnVW5tYXNrOiAnICsgdGhpcy5fZW50aXR5Lm5hbWU7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5jYXN0U2hhZG93ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5yZWNlaXZlU2hhZG93ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5waWNrID0gZmFsc2U7XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWwubWVzaEluc3RhbmNlcy5wdXNoKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKTtcblxuICAgICAgICAgICAgLy8gY29weSBwYXJhbWV0ZXJzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gdGhpcy5tZXNoSW5zdGFuY2UucGFyYW1ldGVycykge1xuICAgICAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihuYW1lLCB0aGlzLm1lc2hJbnN0YW5jZS5wYXJhbWV0ZXJzW25hbWVdLmRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIHVubWFzayBtZXNoIGluc3RhbmNlIGZyb20gbW9kZWxcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IHRoaXMubW9kZWwubWVzaEluc3RhbmNlcy5pbmRleE9mKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKTtcbiAgICAgICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMubW9kZWwubWVzaEluc3RhbmNlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIG1vZGVsIHRoZW4gcmUtYWRkIHRvIHVwZGF0ZSB0byBjdXJyZW50IG1lc2ggaW5zdGFuY2VzXG4gICAgICAgIGlmICh0aGlzLl9lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9lbGVtZW50LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKHRoaXMubW9kZWwpO1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5hZGRNb2RlbFRvTGF5ZXJzKHRoaXMubW9kZWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0TWF0ZXJpYWwobWF0ZXJpYWwpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UubWF0ZXJpYWwgPSBtYXRlcmlhbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFBhcmFtZXRlcihuYW1lLCB2YWx1ZSkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIobmFtZSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZGVsZXRlUGFyYW1ldGVyKG5hbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmRlbGV0ZVBhcmFtZXRlcihuYW1lKTtcbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRVbm1hc2tEcmF3T3JkZXIoKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBjb25zdCBnZXRMYXN0Q2hpbGQgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgbGV0IGxhc3Q7XG4gICAgICAgICAgICBjb25zdCBjID0gZS5jaGlsZHJlbjtcbiAgICAgICAgICAgIGNvbnN0IGwgPSBjLmxlbmd0aDtcbiAgICAgICAgICAgIGlmIChsKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNbaV0uZWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdCA9IGNbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIWxhc3QpIHJldHVybiBudWxsO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGQgPSBnZXRMYXN0Q2hpbGQobGFzdCk7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjaGlsZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxhc3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUaGUgdW5tYXNrIG1lc2ggaW5zdGFuY2UgcmVuZGVycyBpbnRvIHRoZSBzdGVuY2lsIGJ1ZmZlclxuICAgICAgICAvLyB3aXRoIHRoZSByZWYgb2YgdGhlIHByZXZpb3VzIG1hc2suIFRoaXMgZXNzZW50aWFsbHkgXCJjbGVhcnNcIlxuICAgICAgICAvLyB0aGUgbWFzayB2YWx1ZVxuICAgICAgICAvL1xuICAgICAgICAvLyBUaGUgdW5tYXNrIGhhcyBhIGRyYXdPcmRlciBzZXQgdG8gYmUgbWlkLXdheSBiZXR3ZWVuIHRoZSBsYXN0IGNoaWxkIG9mIHRoZVxuICAgICAgICAvLyBtYXNrZWQgaGllcmFyY2h5IGFuZCB0aGUgbmV4dCBjaGlsZCB0byBiZSBkcmF3bi5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGhlIG9mZnNldCBpcyByZWR1Y2VkIGJ5IGEgc21hbGwgZnJhY3Rpb24gZWFjaCB0aW1lIHNvIHRoYXQgaWYgbXVsdGlwbGUgbWFza3NcbiAgICAgICAgLy8gZW5kIG9uIHRoZSBzYW1lIGxhc3QgY2hpbGQgdGhleSBhcmUgdW5tYXNrZWQgaW4gdGhlIGNvcnJlY3Qgb3JkZXIuXG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgY29uc3QgbGFzdENoaWxkID0gZ2V0TGFzdENoaWxkKHRoaXMuX2VudGl0eSk7XG4gICAgICAgICAgICBpZiAobGFzdENoaWxkICYmIGxhc3RDaGlsZC5lbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gbGFzdENoaWxkLmVsZW1lbnQuZHJhd09yZGVyICsgbGFzdENoaWxkLmVsZW1lbnQuZ2V0TWFza09mZnNldCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5kcmF3T3JkZXIgPSB0aGlzLm1lc2hJbnN0YW5jZS5kcmF3T3JkZXIgKyB0aGlzLl9lbGVtZW50LmdldE1hc2tPZmZzZXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIGlmIChfZGVidWdMb2dnaW5nKSBjb25zb2xlLmxvZygnc2V0RHJhd09yZGVyOiAnLCB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5uYW1lLCB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5kcmF3T3JkZXIpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXREcmF3T3JkZXIoZHJhd09yZGVyKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykgY29uc29sZS5sb2coJ3NldERyYXdPcmRlcjogJywgdGhpcy5tZXNoSW5zdGFuY2UubmFtZSwgZHJhd09yZGVyKTtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IGRyYXdPcmRlcjtcbiAgICB9XG5cbiAgICBzZXRDdWxsKGN1bGwpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5fZWxlbWVudDtcblxuICAgICAgICBsZXQgdmlzaWJsZUZuID0gbnVsbDtcbiAgICAgICAgaWYgKGN1bGwgJiYgZWxlbWVudC5faXNTY3JlZW5TcGFjZSgpKSB7XG4gICAgICAgICAgICB2aXNpYmxlRm4gPSBmdW5jdGlvbiAoY2FtZXJhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuaXNWaXNpYmxlRm9yQ2FtZXJhKGNhbWVyYSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuY3VsbCA9IGN1bGw7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmlzVmlzaWJsZUZ1bmMgPSB2aXNpYmxlRm47XG5cbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5jdWxsID0gY3VsbDtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLmlzVmlzaWJsZUZ1bmMgPSB2aXNpYmxlRm47XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTY3JlZW5TcGFjZShzY3JlZW5TcGFjZSkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2Uuc2NyZWVuU3BhY2UgPSBzY3JlZW5TcGFjZTtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLnNjcmVlblNwYWNlID0gc2NyZWVuU3BhY2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRMYXllcihsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UubGF5ZXIgPSBsYXllcjtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLmxheWVyID0gbGF5ZXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmb3JjZVVwZGF0ZUFhYmIobWFzaykge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5fYWFiYlZlciA9IC0xO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0QWFiYkZ1bmMoZm4pIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl91cGRhdGVBYWJiRnVuYyA9IGZuO1xuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLl91cGRhdGVBYWJiRnVuYyA9IGZuO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jbGFzcyBJbWFnZUVsZW1lbnQge1xuICAgIGNvbnN0cnVjdG9yKGVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5fZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgICAgIHRoaXMuX2VudGl0eSA9IGVsZW1lbnQuZW50aXR5O1xuICAgICAgICB0aGlzLl9zeXN0ZW0gPSBlbGVtZW50LnN5c3RlbTtcblxuICAgICAgICAvLyBwdWJsaWNcbiAgICAgICAgdGhpcy5fdGV4dHVyZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdGV4dHVyZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3Nwcml0ZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3ByaXRlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSAwO1xuICAgICAgICB0aGlzLl9waXhlbHNQZXJVbml0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8gPSAtMTsgLy8gd2lsbCBiZSBzZXQgd2hlbiBhc3NpZ25pbmcgdGV4dHVyZXNcblxuICAgICAgICB0aGlzLl9yZWN0ID0gbmV3IFZlYzQoMCwgMCwgMSwgMSk7IC8vIHgsIHksIHcsIGhcblxuICAgICAgICB0aGlzLl9tYXNrID0gZmFsc2U7IC8vIHRoaXMgaW1hZ2UgZWxlbWVudCBpcyBhIG1hc2tcbiAgICAgICAgdGhpcy5fbWFza1JlZiA9IDA7IC8vIGlkIHVzZWQgaW4gc3RlbmNpbCBidWZmZXIgdG8gbWFza1xuXG4gICAgICAgIC8vIDktc2xpY2luZ1xuICAgICAgICB0aGlzLl9vdXRlclNjYWxlID0gbmV3IFZlYzIoKTtcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB0aGlzLl9pbm5lck9mZnNldCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuXG4gICAgICAgIHRoaXMuX2RlZmF1bHRNZXNoID0gdGhpcy5fY3JlYXRlTWVzaCgpO1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlID0gbmV3IEltYWdlUmVuZGVyYWJsZSh0aGlzLl9lbnRpdHksIHRoaXMuX2RlZmF1bHRNZXNoLCB0aGlzLl9tYXRlcmlhbCk7XG5cbiAgICAgICAgLy8gc2V0IGRlZmF1bHQgY29sb3JzXG4gICAgICAgIHRoaXMuX2NvbG9yID0gbmV3IENvbG9yKDEsIDEsIDEsIDEpO1xuICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KFsxLCAxLCAxXSk7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgMSk7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlQWFiYkZ1bmMgPSB0aGlzLl91cGRhdGVBYWJiLmJpbmQodGhpcyk7XG5cbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBiYXNlZCBvbiBzY3JlZW5cbiAgICAgICAgdGhpcy5fb25TY3JlZW5DaGFuZ2UodGhpcy5fZWxlbWVudC5zY3JlZW4pO1xuXG4gICAgICAgIC8vIGxpc3RlbiBmb3IgZXZlbnRzXG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3Jlc2l6ZScsIHRoaXMuX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NldDpwaXZvdCcsIHRoaXMuX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NjcmVlbjpzZXQ6c2NyZWVuc3BhY2UnLCB0aGlzLl9vblNjcmVlblNwYWNlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vbignc2V0OnNjcmVlbicsIHRoaXMuX29uU2NyZWVuQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vbignc2V0OmRyYXdvcmRlcicsIHRoaXMuX29uRHJhd09yZGVyQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vbignc2NyZWVuOnNldDpyZXNvbHV0aW9uJywgdGhpcy5fb25SZXNvbHV0aW9uQ2hhbmdlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyByZXNldCBhbGwgYXNzZXRzIHRvIHVuYmluZCBhbGwgYXNzZXQgZXZlbnRzXG4gICAgICAgIHRoaXMudGV4dHVyZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5zcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRNZXNoKHRoaXMuX2RlZmF1bHRNZXNoKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRNZXNoID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZigncmVzaXplJywgdGhpcy5fb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NldDpwaXZvdCcsIHRoaXMuX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzY3JlZW46c2V0OnNjcmVlbnNwYWNlJywgdGhpcy5fb25TY3JlZW5TcGFjZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzZXQ6c2NyZWVuJywgdGhpcy5fb25TY3JlZW5DaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2V0OmRyYXdvcmRlcicsIHRoaXMuX29uRHJhd09yZGVyQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NjcmVlbjpzZXQ6cmVzb2x1dGlvbicsIHRoaXMuX29uUmVzb2x1dGlvbkNoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uUmVzb2x1dGlvbkNoYW5nZShyZXMpIHtcbiAgICB9XG5cbiAgICBfb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZS5tZXNoKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVNZXNoKHRoaXMuX3JlbmRlcmFibGUubWVzaCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25TY3JlZW5TcGFjZUNoYW5nZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbCh2YWx1ZSk7XG4gICAgfVxuXG4gICAgX29uU2NyZWVuQ2hhbmdlKHNjcmVlbiwgcHJldmlvdXMpIHtcbiAgICAgICAgaWYgKHNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKGZhbHNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkRyYXdPcmRlckNoYW5nZShvcmRlcikge1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldERyYXdPcmRlcihvcmRlcik7XG5cbiAgICAgICAgaWYgKHRoaXMubWFzayAmJiB0aGlzLl9lbGVtZW50LnNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5zY3JlZW4uc2NyZWVuLm9uY2UoJ3N5bmNkcmF3b3JkZXInLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRVbm1hc2tEcmF3T3JkZXIoKTtcbiAgICAgICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmV0dXJucyB0cnVlIGlmIHdlIGFyZSB1c2luZyBhIG1hdGVyaWFsXG4gICAgLy8gb3RoZXIgdGhhbiB0aGUgZGVmYXVsdCBtYXRlcmlhbHNcbiAgICBfaGFzVXNlck1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gISF0aGlzLl9tYXRlcmlhbEFzc2V0IHx8XG4gICAgICAgICAgICAgICAoISF0aGlzLl9tYXRlcmlhbCAmJlxuICAgICAgICAgICAgICAgIHRoaXMuX3N5c3RlbS5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMuaW5kZXhPZih0aGlzLl9tYXRlcmlhbCkgPT09IC0xKTtcbiAgICB9XG5cbiAgICBfdXNlOVNsaWNpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNwcml0ZSAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8IHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlTWF0ZXJpYWwoc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgY29uc3QgbWFzayA9ICEhdGhpcy5fbWFzaztcbiAgICAgICAgY29uc3QgbmluZVNsaWNlZCA9ICEhKHRoaXMuc3ByaXRlICYmIHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCk7XG4gICAgICAgIGNvbnN0IG5pbmVUaWxlZCA9ICEhKHRoaXMuc3ByaXRlICYmIHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2hhc1VzZXJNYXRlcmlhbCgpKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHRoaXMuX3N5c3RlbS5nZXRJbWFnZUVsZW1lbnRNYXRlcmlhbChzY3JlZW5TcGFjZSwgbWFzaywgbmluZVNsaWNlZCwgbmluZVRpbGVkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlKSB7XG4gICAgICAgICAgICAvLyBjdWxsaW5nIGlzIGFsd2F5cyB0cnVlIGZvciBub24tc2NyZWVuc3BhY2UgKGZydXN0cnVtIGlzIHVzZWQpOyBmb3Igc2NyZWVuc3BhY2UsIHVzZSB0aGUgJ2N1bGwnIHByb3BlcnR5XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldEN1bGwoIXRoaXMuX2VsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKSB8fCB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlbkN1bGxlZCgpKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWF0ZXJpYWwodGhpcy5fbWF0ZXJpYWwpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRTY3JlZW5TcGFjZShzY3JlZW5TcGFjZSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldExheWVyKHNjcmVlblNwYWNlID8gTEFZRVJfSFVEIDogTEFZRVJfV09STEQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYnVpbGQgYSBxdWFkIGZvciB0aGUgaW1hZ2VcbiAgICBfY3JlYXRlTWVzaCgpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHcgPSBlbGVtZW50LmNhbGN1bGF0ZWRXaWR0aDtcbiAgICAgICAgY29uc3QgaCA9IGVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodDtcblxuICAgICAgICBjb25zdCByID0gdGhpcy5fcmVjdDtcblxuICAgICAgICAvLyBOb3RlIHRoYXQgd2hlbiBjcmVhdGluZyBhIHR5cGVkIGFycmF5LCBpdCdzIGluaXRpYWxpemVkIHRvIHplcm9zLlxuICAgICAgICAvLyBBbGxvY2F0ZSBtZW1vcnkgZm9yIDQgdmVydGljZXMsIDggZmxvYXRzIHBlciB2ZXJ0ZXgsIDQgYnl0ZXMgcGVyIGZsb2F0LlxuICAgICAgICBjb25zdCB2ZXJ0ZXhEYXRhID0gbmV3IEFycmF5QnVmZmVyKDQgKiA4ICogNCk7XG4gICAgICAgIGNvbnN0IHZlcnRleERhdGFGMzIgPSBuZXcgRmxvYXQzMkFycmF5KHZlcnRleERhdGEpO1xuXG4gICAgICAgIC8vIFZlcnRleCBsYXlvdXQgaXM6IFBYLCBQWSwgUFosIE5YLCBOWSwgTlosIFUsIFZcbiAgICAgICAgLy8gU2luY2UgdGhlIG1lbW9yeSBpcyB6ZXJvZWQsIHdlIHdpbGwgb25seSBzZXQgbm9uLXplcm8gZWxlbWVudHNcblxuICAgICAgICAvLyBQT1M6IDAsIDAsIDBcbiAgICAgICAgdmVydGV4RGF0YUYzMls1XSA9IDE7ICAgICAgICAgIC8vIE5aXG4gICAgICAgIHZlcnRleERhdGFGMzJbNl0gPSByLng7ICAgICAgICAvLyBVXG4gICAgICAgIHZlcnRleERhdGFGMzJbN10gPSAxLjAgLSByLnk7ICAvLyBWXG5cbiAgICAgICAgLy8gUE9TOiB3LCAwLCAwXG4gICAgICAgIHZlcnRleERhdGFGMzJbOF0gPSB3OyAgICAgICAgICAvLyBQWFxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzEzXSA9IDE7ICAgICAgICAgLy8gTlpcbiAgICAgICAgdmVydGV4RGF0YUYzMlsxNF0gPSByLnggKyByLno7IC8vIFVcbiAgICAgICAgdmVydGV4RGF0YUYzMlsxNV0gPSAxLjAgLSByLnk7IC8vIFZcblxuICAgICAgICAvLyBQT1M6IHcsIGgsIDBcbiAgICAgICAgdmVydGV4RGF0YUYzMlsxNl0gPSB3OyAgICAgICAgIC8vIFBYXG4gICAgICAgIHZlcnRleERhdGFGMzJbMTddID0gaDsgICAgICAgICAvLyBQWVxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzIxXSA9IDE7ICAgICAgICAgLy8gTlpcbiAgICAgICAgdmVydGV4RGF0YUYzMlsyMl0gPSByLnggKyByLno7IC8vIFVcbiAgICAgICAgdmVydGV4RGF0YUYzMlsyM10gPSAxLjAgLSAoci55ICsgci53KTsgLy8gVlxuXG4gICAgICAgIC8vIFBPUzogMCwgaCwgMFxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzI1XSA9IGg7ICAgICAgICAgLy8gUFlcbiAgICAgICAgdmVydGV4RGF0YUYzMlsyOV0gPSAxOyAgICAgICAgIC8vIE5aXG4gICAgICAgIHZlcnRleERhdGFGMzJbMzBdID0gci54OyAgICAgICAvLyBVXG4gICAgICAgIHZlcnRleERhdGFGMzJbMzFdID0gMS4wIC0gKHIueSArIHIudyk7IC8vIFZcblxuICAgICAgICBjb25zdCB2ZXJ0ZXhEZXNjID0gW1xuICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfUE9TSVRJT04sIGNvbXBvbmVudHM6IDMsIHR5cGU6IFRZUEVfRkxPQVQzMiB9LFxuICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfTk9STUFMLCBjb21wb25lbnRzOiAzLCB0eXBlOiBUWVBFX0ZMT0FUMzIgfSxcbiAgICAgICAgICAgIHsgc2VtYW50aWM6IFNFTUFOVElDX1RFWENPT1JEMCwgY29tcG9uZW50czogMiwgdHlwZTogVFlQRV9GTE9BVDMyIH1cbiAgICAgICAgXTtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLl9zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhGb3JtYXQgPSBuZXcgVmVydGV4Rm9ybWF0KGRldmljZSwgdmVydGV4RGVzYyk7XG4gICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIoZGV2aWNlLCB2ZXJ0ZXhGb3JtYXQsIDQsIEJVRkZFUl9TVEFUSUMsIHZlcnRleERhdGEpO1xuXG4gICAgICAgIGNvbnN0IG1lc2ggPSBuZXcgTWVzaChkZXZpY2UpO1xuICAgICAgICBtZXNoLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0udHlwZSA9IFBSSU1JVElWRV9UUklGQU47XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IDQ7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSBmYWxzZTtcbiAgICAgICAgbWVzaC5hYWJiLnNldE1pbk1heChWZWMzLlpFUk8sIG5ldyBWZWMzKHcsIGgsIDApKTtcblxuICAgICAgICB0aGlzLl91cGRhdGVNZXNoKG1lc2gpO1xuXG4gICAgICAgIHJldHVybiBtZXNoO1xuICAgIH1cblxuICAgIF91cGRhdGVNZXNoKG1lc2gpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7XG4gICAgICAgIGxldCB3ID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgIGxldCBoID0gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuXG4gICAgICAgIGlmIChlbGVtZW50LmZpdE1vZGUgIT09IEZJVE1PREVfU1RSRVRDSCAmJiB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbFJhdGlvID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggLyBlbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQ7XG4gICAgICAgICAgICAvLyBjaGVjayB3aGljaCBjb29yZGluYXRlIG11c3QgY2hhbmdlIGluIG9yZGVyIHRvIHByZXNlcnZlIHRoZSBzb3VyY2UgYXNwZWN0IHJhdGlvXG4gICAgICAgICAgICBpZiAoKGVsZW1lbnQuZml0TW9kZSA9PT0gRklUTU9ERV9DT05UQUlOICYmIGFjdHVhbFJhdGlvID4gdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8pIHx8XG4gICAgICAgICAgICAgICAgKGVsZW1lbnQuZml0TW9kZSA9PT0gRklUTU9ERV9DT1ZFUiAmJiBhY3R1YWxSYXRpbyA8IHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvKSkge1xuICAgICAgICAgICAgICAgIC8vIHVzZSAnaGVpZ2h0JyB0byByZS1jYWxjdWxhdGUgd2lkdGhcbiAgICAgICAgICAgICAgICB3ID0gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0ICogdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW87XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHVzZSAnd2lkdGgnIHRvIHJlLWNhbGN1bGF0ZSBoZWlnaHRcbiAgICAgICAgICAgICAgICBoID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggLyB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBtYXRlcmlhbFxuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IGVsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoc2NyZWVuU3BhY2UpO1xuXG4gICAgICAgIC8vIGZvcmNlIHVwZGF0ZSBtZXNoSW5zdGFuY2UgYWFiYlxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkgdGhpcy5fcmVuZGVyYWJsZS5mb3JjZVVwZGF0ZUFhYmIoKTtcblxuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGlubmVyIG9mZnNldCBmcm9tIHRoZSBmcmFtZSdzIGJvcmRlclxuICAgICAgICAgICAgY29uc3QgZnJhbWVEYXRhID0gdGhpcy5fc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLl9zcHJpdGUuZnJhbWVLZXlzW3RoaXMuX3Nwcml0ZUZyYW1lXV07XG4gICAgICAgICAgICBjb25zdCBib3JkZXJXaWR0aFNjYWxlID0gMiAvIGZyYW1lRGF0YS5yZWN0Lno7XG4gICAgICAgICAgICBjb25zdCBib3JkZXJIZWlnaHRTY2FsZSA9IDIgLyBmcmFtZURhdGEucmVjdC53O1xuXG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldC5zZXQoXG4gICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci54ICogYm9yZGVyV2lkdGhTY2FsZSxcbiAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnkgKiBib3JkZXJIZWlnaHRTY2FsZSxcbiAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnogKiBib3JkZXJXaWR0aFNjYWxlLFxuICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIudyAqIGJvcmRlckhlaWdodFNjYWxlXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCB0ZXggPSB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlO1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0LnNldChmcmFtZURhdGEucmVjdC54IC8gdGV4LndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEucmVjdC55IC8gdGV4LmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueiAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QudyAvIHRleC5oZWlnaHQpO1xuXG4gICAgICAgICAgICAvLyBzY2FsZTogYXBwbHkgUFBVXG4gICAgICAgICAgICBjb25zdCBwcHUgPSB0aGlzLl9waXhlbHNQZXJVbml0ICE9PSBudWxsID8gdGhpcy5fcGl4ZWxzUGVyVW5pdCA6IHRoaXMuc3ByaXRlLnBpeGVsc1BlclVuaXQ7XG4gICAgICAgICAgICBjb25zdCBzY2FsZU11bFggPSBmcmFtZURhdGEucmVjdC56IC8gcHB1O1xuICAgICAgICAgICAgY29uc3Qgc2NhbGVNdWxZID0gZnJhbWVEYXRhLnJlY3QudyAvIHBwdTtcblxuICAgICAgICAgICAgLy8gc2NhbGUgYm9yZGVycyBpZiBuZWNlc3NhcnkgaW5zdGVhZCBvZiBvdmVybGFwcGluZ1xuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS5zZXQoTWF0aC5tYXgodywgdGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIE1hdGgubWF4KGgsIHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpKTtcblxuICAgICAgICAgICAgbGV0IHNjYWxlWCA9IHNjYWxlTXVsWDtcbiAgICAgICAgICAgIGxldCBzY2FsZVkgPSBzY2FsZU11bFk7XG5cbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUueCAvPSBzY2FsZU11bFg7XG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnkgLz0gc2NhbGVNdWxZO1xuXG4gICAgICAgICAgICAvLyBzY2FsZTogc2hyaW5raW5nIGJlbG93IDFcbiAgICAgICAgICAgIHNjYWxlWCAqPSBtYXRoLmNsYW1wKHcgLyAodGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIDAuMDAwMSwgMSk7XG4gICAgICAgICAgICBzY2FsZVkgKj0gbWF0aC5jbGFtcChoIC8gKHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpLCAwLjAwMDEsIDEpO1xuXG4gICAgICAgICAgICAvLyBzZXQgc2NhbGVcbiAgICAgICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzBdID0gdGhpcy5faW5uZXJPZmZzZXQueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMV0gPSB0aGlzLl9pbm5lck9mZnNldC55O1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVsyXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lno7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzNdID0gdGhpcy5faW5uZXJPZmZzZXQudztcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignaW5uZXJPZmZzZXQnLCB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bMF0gPSB0aGlzLl9hdGxhc1JlY3QueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzFdID0gdGhpcy5fYXRsYXNSZWN0Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsyXSA9IHRoaXMuX2F0bGFzUmVjdC56O1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bM10gPSB0aGlzLl9hdGxhc1JlY3QudztcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignYXRsYXNSZWN0JywgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm1bMF0gPSB0aGlzLl9vdXRlclNjYWxlLng7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm1bMV0gPSB0aGlzLl9vdXRlclNjYWxlLnk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ291dGVyU2NhbGUnLCB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRBYWJiRnVuYyh0aGlzLl91cGRhdGVBYWJiRnVuYyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxTY2FsZShzY2FsZVgsIHNjYWxlWSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5ub2RlLnNldExvY2FsUG9zaXRpb24oKDAuNSAtIGVsZW1lbnQucGl2b3QueCkgKiB3LCAoMC41IC0gZWxlbWVudC5waXZvdC55KSAqIGgsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdmIgPSBtZXNoLnZlcnRleEJ1ZmZlcjtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleERhdGFGMzIgPSBuZXcgRmxvYXQzMkFycmF5KHZiLmxvY2soKSk7XG5cbiAgICAgICAgICAgIC8vIG9mZnNldCBmb3IgcGl2b3RcbiAgICAgICAgICAgIGNvbnN0IGhwID0gZWxlbWVudC5waXZvdC54O1xuICAgICAgICAgICAgY29uc3QgdnAgPSBlbGVtZW50LnBpdm90Lnk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB2ZXJ0ZXggcG9zaXRpb25zLCBhY2NvdW50aW5nIGZvciB0aGUgcGl2b3Qgb2Zmc2V0XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzBdID0gMCAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMV0gPSAwIC0gdnAgKiBoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls4XSA9IHcgLSBocCAqIHc7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzldID0gMCAtIHZwICogaDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTZdID0gdyAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTddID0gaCAtIHZwICogaDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjRdID0gMCAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjVdID0gaCAtIHZwICogaDtcblxuXG4gICAgICAgICAgICBsZXQgYXRsYXNUZXh0dXJlV2lkdGggPSAxO1xuICAgICAgICAgICAgbGV0IGF0bGFzVGV4dHVyZUhlaWdodCA9IDE7XG4gICAgICAgICAgICBsZXQgcmVjdCA9IHRoaXMuX3JlY3Q7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGUgJiYgdGhpcy5fc3ByaXRlLmZyYW1lS2V5c1t0aGlzLl9zcHJpdGVGcmFtZV0gJiYgdGhpcy5fc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZnJhbWUgPSB0aGlzLl9zcHJpdGUuYXRsYXMuZnJhbWVzW3RoaXMuX3Nwcml0ZS5mcmFtZUtleXNbdGhpcy5fc3ByaXRlRnJhbWVdXTtcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVjdCA9IGZyYW1lLnJlY3Q7XG4gICAgICAgICAgICAgICAgICAgIGF0bGFzVGV4dHVyZVdpZHRoID0gdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIGF0bGFzVGV4dHVyZUhlaWdodCA9IHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlLmhlaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB2ZXJ0ZXggdGV4dHVyZSBjb29yZGluYXRlc1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls2XSA9IHJlY3QueCAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls3XSA9IDEuMCAtIHJlY3QueSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTRdID0gKHJlY3QueCArIHJlY3QueikgLyBhdGxhc1RleHR1cmVXaWR0aDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTVdID0gMS4wIC0gcmVjdC55IC8gYXRsYXNUZXh0dXJlSGVpZ2h0O1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsyMl0gPSAocmVjdC54ICsgcmVjdC56KSAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsyM10gPSAxLjAgLSAocmVjdC55ICsgcmVjdC53KSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMzBdID0gcmVjdC54IC8gYXRsYXNUZXh0dXJlV2lkdGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMxXSA9IDEuMCAtIChyZWN0LnkgKyByZWN0LncpIC8gYXRsYXNUZXh0dXJlSGVpZ2h0O1xuXG4gICAgICAgICAgICB2Yi51bmxvY2soKTtcblxuICAgICAgICAgICAgY29uc3QgbWluID0gbmV3IFZlYzMoMCAtIGhwICogdywgMCAtIHZwICogaCwgMCk7XG4gICAgICAgICAgICBjb25zdCBtYXggPSBuZXcgVmVjMyh3IC0gaHAgKiB3LCBoIC0gdnAgKiBoLCAwKTtcbiAgICAgICAgICAgIG1lc2guYWFiYi5zZXRNaW5NYXgobWluLCBtYXgpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUubm9kZS5zZXRMb2NhbFNjYWxlKDEsIDEsIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUubm9kZS5zZXRMb2NhbFBvc2l0aW9uKDAsIDAsIDApO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRBYWJiRnVuYyhudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21lc2hEaXJ0eSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEdldHMgdGhlIG1lc2ggZnJvbSB0aGUgc3ByaXRlIGFzc2V0XG4gICAgLy8gaWYgdGhlIHNwcml0ZSBpcyA5LXNsaWNlZCBvciB0aGUgZGVmYXVsdCBtZXNoIGZyb20gdGhlXG4gICAgLy8gaW1hZ2UgZWxlbWVudCBhbmQgY2FsbHMgX3VwZGF0ZU1lc2ggb3Igc2V0cyBtZXNoRGlydHkgdG8gdHJ1ZVxuICAgIC8vIGlmIHRoZSBjb21wb25lbnQgaXMgY3VycmVudGx5IGJlaW5nIGluaXRpYWxpemVkLiBBbHNvIHVwZGF0ZXNcbiAgICAvLyBhc3BlY3QgcmF0aW8uIFdlIG5lZWQgdG8gY2FsbCBfdXBkYXRlU3ByaXRlIGV2ZXJ5IHRpbWVcbiAgICAvLyBzb21ldGhpbmcgcmVsYXRlZCB0byB0aGUgc3ByaXRlIGFzc2V0IGNoYW5nZXNcbiAgICBfdXBkYXRlU3ByaXRlKCkge1xuICAgICAgICBsZXQgbmluZVNsaWNlID0gZmFsc2U7XG4gICAgICAgIGxldCBtZXNoID0gbnVsbDtcblxuICAgICAgICAvLyByZXNldCB0YXJnZXQgYXNwZWN0IHJhdGlvXG4gICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gLTE7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSAmJiB0aGlzLl9zcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgIC8vIHRha2UgbWVzaCBmcm9tIHNwcml0ZVxuICAgICAgICAgICAgbWVzaCA9IHRoaXMuX3Nwcml0ZS5tZXNoZXNbdGhpcy5zcHJpdGVGcmFtZV07XG4gICAgICAgICAgICBuaW5lU2xpY2UgPSB0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8IHRoaXMuX3Nwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRDtcblxuICAgICAgICAgICAgLy8gcmUtY2FsY3VsYXRlIGFzcGVjdCByYXRpbyBmcm9tIHNwcml0ZSBmcmFtZVxuICAgICAgICAgICAgY29uc3QgZnJhbWVEYXRhID0gdGhpcy5fc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLl9zcHJpdGUuZnJhbWVLZXlzW3RoaXMuX3Nwcml0ZUZyYW1lXV07XG4gICAgICAgICAgICBpZiAoZnJhbWVEYXRhPy5yZWN0LncgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8gPSBmcmFtZURhdGEucmVjdC56IC8gZnJhbWVEYXRhLnJlY3QudztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHdlIHVzZSA5IHNsaWNpbmcgdGhlbiB1c2UgdGhhdCBtZXNoIG90aGVyd2lzZSBrZWVwIHVzaW5nIHRoZSBkZWZhdWx0IG1lc2hcbiAgICAgICAgdGhpcy5tZXNoID0gbmluZVNsaWNlID8gbWVzaCA6IHRoaXMuX2RlZmF1bHRNZXNoO1xuXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc2goKTtcbiAgICB9XG5cbiAgICByZWZyZXNoTWVzaCgpIHtcbiAgICAgICAgaWYgKHRoaXMubWVzaCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9lbGVtZW50Ll9iZWluZ0luaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWVzaCh0aGlzLm1lc2gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlcyBBQUJCIHdoaWxlIDktc2xpY2luZ1xuICAgIF91cGRhdGVBYWJiKGFhYmIpIHtcbiAgICAgICAgYWFiYi5jZW50ZXIuc2V0KDAsIDAsIDApO1xuICAgICAgICBhYWJiLmhhbGZFeHRlbnRzLnNldCh0aGlzLl9vdXRlclNjYWxlLnggKiAwLjUsIHRoaXMuX291dGVyU2NhbGUueSAqIDAuNSwgMC4wMDEpO1xuICAgICAgICBhYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoYWFiYiwgdGhpcy5fcmVuZGVyYWJsZS5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICByZXR1cm4gYWFiYjtcbiAgICB9XG5cbiAgICBfdG9nZ2xlTWFzaygpIHtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5fZGlydGlmeU1hc2soKTtcblxuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IHRoaXMuX2VsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoc2NyZWVuU3BhY2UpO1xuXG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWFzayghIXRoaXMuX21hc2spO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsTG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLm1hdGVyaWFsID0gYXNzZXQucmVzb3VyY2U7XG4gICAgfVxuXG4gICAgX29uTWF0ZXJpYWxBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uTWF0ZXJpYWxBZGRlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW50aXR5LmVuYWJsZWQpIHJldHVybjsgLy8gZG9uJ3QgYmluZCB1bnRpbCBlbGVtZW50IGlzIGVuYWJsZWRcblxuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uTWF0ZXJpYWxDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1hdGVyaWFsTG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1hdGVyaWFsUmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbENoYW5nZSgpIHtcblxuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsUmVtb3ZlKCkge1xuXG4gICAgfVxuXG4gICAgX29uVGV4dHVyZUFkZGVkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25UZXh0dXJlQWRkZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZFRleHR1cmVBc3NldChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZFRleHR1cmVBc3NldChhc3NldCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VudGl0eS5lbmFibGVkKSByZXR1cm47IC8vIGRvbid0IGJpbmQgdW50aWwgZWxlbWVudCBpcyBlbmFibGVkXG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vblRleHR1cmVMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblRleHR1cmVSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25UZXh0dXJlTG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRUZXh0dXJlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25UZXh0dXJlTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25UZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblRleHR1cmVSZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vblRleHR1cmVMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMudGV4dHVyZSA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vblRleHR1cmVDaGFuZ2UoYXNzZXQpIHtcblxuICAgIH1cblxuICAgIF9vblRleHR1cmVSZW1vdmUoYXNzZXQpIHtcblxuICAgIH1cblxuICAgIC8vIFdoZW4gc3ByaXRlIGFzc2V0IGlzIGFkZGVkIGJpbmQgaXRcbiAgICBfb25TcHJpdGVBc3NldEFkZGVkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZFNwcml0ZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhvb2sgdXAgZXZlbnQgaGFuZGxlcnMgb24gc3ByaXRlIGFzc2V0XG4gICAgX2JpbmRTcHJpdGVBc3NldChhc3NldCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VudGl0eS5lbmFibGVkKSByZXR1cm47IC8vIGRvbid0IGJpbmQgdW50aWwgZWxlbWVudCBpcyBlbmFibGVkXG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vblNwcml0ZUFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vblNwcml0ZUFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uU3ByaXRlQXNzZXRSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kU3ByaXRlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25TcHJpdGVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uU3ByaXRlQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uU3ByaXRlQXNzZXRSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2xvYWQ6JyArIGFzc2V0LmRhdGEudGV4dHVyZUF0bGFzQXNzZXQsIHRoaXMuX29uVGV4dHVyZUF0bGFzTG9hZCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXaGVuIHNwcml0ZSBhc3NldCBpcyBsb2FkZWQgbWFrZSBzdXJlIHRoZSB0ZXh0dXJlIGF0bGFzIGFzc2V0IGlzIGxvYWRlZCB0b29cbiAgICAvLyBJZiBzbyB0aGVuIHNldCB0aGUgc3ByaXRlLCBvdGhlcndpc2Ugd2FpdCBmb3IgdGhlIGF0bGFzIHRvIGJlIGxvYWRlZCBmaXJzdFxuICAgIF9vblNwcml0ZUFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICBpZiAoIWFzc2V0IHx8ICFhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKCFhc3NldC5yZXNvdXJjZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGF0bGFzQXNzZXRJZCA9IGFzc2V0LmRhdGEudGV4dHVyZUF0bGFzQXNzZXQ7XG4gICAgICAgICAgICAgICAgaWYgKGF0bGFzQXNzZXRJZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9mZignbG9hZDonICsgYXRsYXNBc3NldElkLCB0aGlzLl9vblRleHR1cmVBdGxhc0xvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBhc3NldHMub25jZSgnbG9hZDonICsgYXRsYXNBc3NldElkLCB0aGlzLl9vblRleHR1cmVBdGxhc0xvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdoZW4gdGhlIHNwcml0ZSBhc3NldCBjaGFuZ2VzIHJlc2V0IGl0XG4gICAgX29uU3ByaXRlQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIF9vblNwcml0ZUFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgfVxuXG4gICAgLy8gSG9vayB1cCBldmVudCBoYW5kbGVycyBvbiBzcHJpdGUgYXNzZXRcbiAgICBfYmluZFNwcml0ZShzcHJpdGUpIHtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub24oJ3NldDpwaXhlbHNQZXJVbml0JywgdGhpcy5fb25TcHJpdGVQcHVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub24oJ3NldDphdGxhcycsIHRoaXMuX29uQXRsYXNUZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgaWYgKHNwcml0ZS5hdGxhcykge1xuICAgICAgICAgICAgc3ByaXRlLmF0bGFzLm9uKCdzZXQ6dGV4dHVyZScsIHRoaXMuX29uQXRsYXNUZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRTcHJpdGUoc3ByaXRlKSB7XG4gICAgICAgIHNwcml0ZS5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblNwcml0ZU1lc2hlc0NoYW5nZSwgdGhpcyk7XG4gICAgICAgIHNwcml0ZS5vZmYoJ3NldDpwaXhlbHNQZXJVbml0JywgdGhpcy5fb25TcHJpdGVQcHVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6YXRsYXMnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGlmIChzcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgIHNwcml0ZS5hdGxhcy5vZmYoJ3NldDp0ZXh0dXJlJywgdGhpcy5fb25BdGxhc1RleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU3ByaXRlTWVzaGVzQ2hhbmdlKCkge1xuICAgICAgICAvLyBjbGFtcCBmcmFtZVxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9zcHJpdGVGcmFtZSA9IG1hdGguY2xhbXAodGhpcy5fc3ByaXRlRnJhbWUsIDAsIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXMubGVuZ3RoIC0gMSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgdGhpcy5fdXBkYXRlU3ByaXRlKCk7XG4gICAgfVxuXG4gICAgX29uU3ByaXRlUHB1Q2hhbmdlKCkge1xuICAgICAgICAvLyBmb3JjZSB1cGRhdGUgd2hlbiB0aGUgc3ByaXRlIGlzIDktc2xpY2VkLiBJZiBpdCdzIG5vdFxuICAgICAgICAvLyB0aGVuIGl0cyBtZXNoIHdpbGwgY2hhbmdlIHdoZW4gdGhlIHBwdSBjaGFuZ2VzIHdoaWNoIHdpbGxcbiAgICAgICAgLy8gYmUgaGFuZGxlZCBieSBvblNwcml0ZU1lc2hlc0NoYW5nZVxuICAgICAgICBpZiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSAhPT0gU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFICYmIHRoaXMuX3BpeGVsc1BlclVuaXQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIGZvcmNlIHVwZGF0ZVxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlU3ByaXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25BdGxhc1RleHR1cmVDaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiB0aGlzLnNwcml0ZS5hdGxhcyAmJiB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcsIHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2hlbiBhdGxhcyBpcyBsb2FkZWQgdHJ5IHRvIHJlc2V0IHRoZSBzcHJpdGUgYXNzZXRcbiAgICBfb25UZXh0dXJlQXRsYXNMb2FkKGF0bGFzQXNzZXQpIHtcbiAgICAgICAgY29uc3Qgc3ByaXRlQXNzZXQgPSB0aGlzLl9zcHJpdGVBc3NldDtcbiAgICAgICAgaWYgKHNwcml0ZUFzc2V0IGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IF9zcHJpdGVBc3NldCBzaG91bGQgbmV2ZXIgYmUgYW4gYXNzZXQgaW5zdGFuY2U/XG4gICAgICAgICAgICB0aGlzLl9vblNwcml0ZUFzc2V0TG9hZChzcHJpdGVBc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vblNwcml0ZUFzc2V0TG9hZCh0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoc3ByaXRlQXNzZXQpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5fbWF0ZXJpYWxBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX21hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3RleHR1cmVBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX3RleHR1cmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kVGV4dHVyZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3Nwcml0ZUFzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCAmJiBhc3NldC5yZXNvdXJjZSAhPT0gdGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZFNwcml0ZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VsZW1lbnQuYWRkTW9kZWxUb0xheWVycyh0aGlzLl9yZW5kZXJhYmxlLm1vZGVsKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKHRoaXMuX3JlbmRlcmFibGUubW9kZWwpO1xuICAgIH1cblxuICAgIF9zZXRTdGVuY2lsKHN0ZW5jaWxQYXJhbXMpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2Uuc3RlbmNpbEZyb250ID0gc3RlbmNpbFBhcmFtcztcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2Uuc3RlbmNpbEJhY2sgPSBzdGVuY2lsUGFyYW1zO1xuXG4gICAgICAgIGxldCByZWYgPSAwO1xuICAgICAgICBpZiAodGhpcy5fZWxlbWVudC5tYXNrZWRCeSkge1xuICAgICAgICAgICAgcmVmID0gdGhpcy5fZWxlbWVudC5tYXNrZWRCeS5lbGVtZW50Ll9pbWFnZS5fbWFza1JlZjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZS51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHNwID0gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKHtcbiAgICAgICAgICAgICAgICByZWY6IHJlZiArIDEsXG4gICAgICAgICAgICAgICAgZnVuYzogRlVOQ19FUVVBTCxcbiAgICAgICAgICAgICAgICB6cGFzczogU1RFTkNJTE9QX0RFQ1JFTUVOVFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlLnN0ZW5jaWxGcm9udCA9IHNwO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS51bm1hc2tNZXNoSW5zdGFuY2Uuc3RlbmNpbEJhY2sgPSBzcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldCBjb2xvcih2YWx1ZSkge1xuICAgICAgICBjb25zdCByID0gdmFsdWUucjtcbiAgICAgICAgY29uc3QgZyA9IHZhbHVlLmc7XG4gICAgICAgIGNvbnN0IGIgPSB2YWx1ZS5iO1xuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRoaXMuX2NvbG9yID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgRGVidWcud2FybignU2V0dGluZyBlbGVtZW50LmNvbG9yIHRvIGl0c2VsZiB3aWxsIGhhdmUgbm8gZWZmZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKHRoaXMuX2NvbG9yLnIgIT09IHIgfHwgdGhpcy5fY29sb3IuZyAhPT0gZyB8fCB0aGlzLl9jb2xvci5iICE9PSBiKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5yID0gcjtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmcgPSBnO1xuICAgICAgICAgICAgdGhpcy5fY29sb3IuYiA9IGI7XG5cbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSBnO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gYjtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5maXJlKCdzZXQ6Y29sb3InLCB0aGlzLl9jb2xvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG5cbiAgICBzZXQgb3BhY2l0eSh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2NvbG9yLmEpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmEgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0Om9wYWNpdHknLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb3BhY2l0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yLmE7XG4gICAgfVxuXG4gICAgc2V0IHJlY3QodmFsdWUpIHtcbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodGhpcy5fcmVjdCA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignU2V0dGluZyBlbGVtZW50LnJlY3QgdG8gaXRzZWxmIHdpbGwgaGF2ZSBubyBlZmZlY3QnKTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBsZXQgeCwgeSwgeiwgdztcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVmVjNCkge1xuICAgICAgICAgICAgeCA9IHZhbHVlLng7XG4gICAgICAgICAgICB5ID0gdmFsdWUueTtcbiAgICAgICAgICAgIHogPSB2YWx1ZS56O1xuICAgICAgICAgICAgdyA9IHZhbHVlLnc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB4ID0gdmFsdWVbMF07XG4gICAgICAgICAgICB5ID0gdmFsdWVbMV07XG4gICAgICAgICAgICB6ID0gdmFsdWVbMl07XG4gICAgICAgICAgICB3ID0gdmFsdWVbM107XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoeCA9PT0gdGhpcy5fcmVjdC54ICYmXG4gICAgICAgICAgICB5ID09PSB0aGlzLl9yZWN0LnkgJiZcbiAgICAgICAgICAgIHogPT09IHRoaXMuX3JlY3QueiAmJlxuICAgICAgICAgICAgdyA9PT0gdGhpcy5fcmVjdC53XG4gICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcmVjdC5zZXQoeCwgeSwgeiwgdyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUubWVzaCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9lbGVtZW50Ll9iZWluZ0luaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWVzaCh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWN0O1xuICAgIH1cblxuICAgIHNldCBtYXRlcmlhbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgICAgICBpZiAodGhpcy5tYXNrKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBzY3JlZW5TcGFjZSA/IHRoaXMuX3N5c3RlbS5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCA6IHRoaXMuX3N5c3RlbS5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gc2NyZWVuU3BhY2UgPyB0aGlzLl9zeXN0ZW0uZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCA6IHRoaXMuX3N5c3RlbS5kZWZhdWx0SW1hZ2VNYXRlcmlhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRNYXRlcmlhbCh2YWx1ZSk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgbm90IHRoZSBkZWZhdWx0IG1hdGVyaWFsIHRoZW4gY2xlYXIgY29sb3IgYW5kIG9wYWNpdHkgb3ZlcnJpZGVzXG4gICAgICAgICAgICBpZiAodGhpcy5faGFzVXNlck1hdGVyaWFsKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBvdGhlcndpc2UgaWYgd2UgYXJlIGJhY2sgdG8gdGhlIGRlZmF1bHRzIHJlc2V0IHRoZSBjb2xvciBhbmQgb3BhY2l0eVxuICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9jb2xvci5iO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCB0aGlzLl9jb2xvci5hKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIHNldCBtYXRlcmlhbEFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgX2lkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQgIT09IF9pZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX21hdGVyaWFsQXNzZXQsIHRoaXMuX29uTWF0ZXJpYWxBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgX3ByZXYgPSBhc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbENoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbFJlbW92ZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gX2lkO1xuICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fbWF0ZXJpYWxBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uKCdhZGQ6JyArIHRoaXMuX21hdGVyaWFsQXNzZXQsIHRoaXMuX29uTWF0ZXJpYWxBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWxBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsQXNzZXQ7XG4gICAgfVxuXG4gICAgc2V0IHRleHR1cmUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmUgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgY29uc3QgdGV4dHVyZUFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3RleHR1cmVBc3NldCk7XG4gICAgICAgICAgICBpZiAodGV4dHVyZUFzc2V0ICYmIHRleHR1cmVBc3NldC5yZXNvdXJjZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl90ZXh0dXJlID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlKSB7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIHNwcml0ZSBhc3NldCBpZiB0ZXh0dXJlIGlzIHNldFxuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGRlZmF1bHQgdGV4dHVyZSBqdXN0IHVzZXMgZW1pc3NpdmUgYW5kIG9wYWNpdHkgbWFwc1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnLCB0aGlzLl90ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnLCB0aGlzLl90ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9jb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIHRoaXMuX2NvbG9yLmEpO1xuXG4gICAgICAgICAgICAvLyBpZiB0ZXh0dXJlJ3MgYXNwZWN0IHJhdGlvIGNoYW5nZWQgYW5kIHRoZSBlbGVtZW50IG5lZWRzIHRvIHByZXNlcnZlIGFzcGVjdCByYXRpbywgcmVmcmVzaCB0aGUgbWVzaFxuICAgICAgICAgICAgY29uc3QgbmV3QXNwZWN0UmF0aW8gPSB0aGlzLl90ZXh0dXJlLndpZHRoIC8gdGhpcy5fdGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICBpZiAobmV3QXNwZWN0UmF0aW8gIT09IHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8gPSBuZXdBc3BlY3RSYXRpbztcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZWxlbWVudC5maXRNb2RlICE9PSBGSVRNT0RFX1NUUkVUQ0gpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoTWVzaCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNsZWFyIHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuXG4gICAgICAgICAgICAvLyByZXNldCB0YXJnZXQgYXNwZWN0IHJhdGlvIGFuZCByZWZyZXNoIG1lc2ggaWYgdGhlcmUgaXMgYW4gYXNwZWN0IHJhdGlvIHNldHRpbmdcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgbmVlZGVkIGluIG9yZGVyIHRvIHByb3Blcmx5IHJlc2V0IHRoZSBtZXNoIHRvICdzdHJldGNoJyBhY3Jvc3MgdGhlIGVudGlyZSBlbGVtZW50IGJvdW5kc1xuICAgICAgICAgICAgLy8gd2hlbiByZXNldHRpbmcgdGhlIHRleHR1cmVcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gLTE7XG4gICAgICAgICAgICBpZiAodGhpcy5fZWxlbWVudC5maXRNb2RlICE9PSBGSVRNT0RFX1NUUkVUQ0gpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlZnJlc2hNZXNoKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdGV4dHVyZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmU7XG4gICAgfVxuXG4gICAgc2V0IHRleHR1cmVBc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQgIT09IF9pZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fdGV4dHVyZUFzc2V0LCB0aGlzLl9vblRleHR1cmVBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgX3ByZXYgPSBhc3NldHMuZ2V0KHRoaXMuX3RleHR1cmVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKF9wcmV2KSB7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZignbG9hZCcsIHRoaXMuX29uVGV4dHVyZUxvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2NoYW5nZScsIHRoaXMuX29uVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVBc3NldCA9IF9pZDtcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl90ZXh0dXJlQXNzZXQsIHRoaXMuX29uVGV4dHVyZUFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kVGV4dHVyZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdGV4dHVyZUFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUFzc2V0O1xuICAgIH1cblxuICAgIHNldCBzcHJpdGVBc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCAhPT0gX2lkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX3Nwcml0ZUFzc2V0LCB0aGlzLl9vblNwcml0ZUFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKF9wcmV2KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZFNwcml0ZUFzc2V0KF9wcmV2KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUFzc2V0ID0gX2lkO1xuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX3Nwcml0ZUFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uKCdhZGQ6JyArIHRoaXMuX3Nwcml0ZUFzc2V0LCB0aGlzLl9vblNwcml0ZUFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNwcml0ZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5maXJlKCdzZXQ6c3ByaXRlQXNzZXQnLCBfaWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZUFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3ByaXRlQXNzZXQ7XG4gICAgfVxuXG4gICAgc2V0IHNwcml0ZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fc3ByaXRlID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VuYmluZFNwcml0ZSh0aGlzLl9zcHJpdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBzcHJpdGVBc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICBpZiAoc3ByaXRlQXNzZXQgJiYgc3ByaXRlQXNzZXQucmVzb3VyY2UgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zcHJpdGUgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9iaW5kU3ByaXRlKHRoaXMuX3Nwcml0ZSk7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIHRleHR1cmUgaWYgc3ByaXRlIGlzIGJlaW5nIHNldFxuICAgICAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUgJiYgdGhpcy5fc3ByaXRlLmF0bGFzICYmIHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlKSB7XG4gICAgICAgICAgICAvLyBkZWZhdWx0IHRleHR1cmUganVzdCB1c2VzIGVtaXNzaXZlIGFuZCBvcGFjaXR5IG1hcHNcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJywgdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcsIHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNsZWFyIHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSBtYXRoLmNsYW1wKHRoaXMuX3Nwcml0ZUZyYW1lLCAwLCB0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlU3ByaXRlKCk7XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZTtcbiAgICB9XG5cbiAgICBzZXQgc3ByaXRlRnJhbWUodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0aGlzLl9zcHJpdGVGcmFtZTtcblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICAvLyBjbGFtcCBmcmFtZVxuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSBtYXRoLmNsYW1wKHZhbHVlLCAwLCB0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVGcmFtZSAhPT0gb2xkVmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0OnNwcml0ZUZyYW1lJywgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZUZyYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3ByaXRlRnJhbWU7XG4gICAgfVxuXG4gICAgc2V0IG1lc2godmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRNZXNoKHZhbHVlKTtcbiAgICAgICAgaWYgKHRoaXMuX2RlZmF1bHRNZXNoID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRBYWJiRnVuYyhudWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmModGhpcy5fdXBkYXRlQWFiYkZ1bmMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1lc2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJhYmxlLm1lc2g7XG4gICAgfVxuXG4gICAgc2V0IG1hc2sodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hc2sgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXNrID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVNYXNrKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc2s7XG4gICAgfVxuXG4gICAgc2V0IHBpeGVsc1BlclVuaXQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3BpeGVsc1BlclVuaXQgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcGl4ZWxzUGVyVW5pdCA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fc3ByaXRlICYmICh0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8IHRoaXMuX3Nwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBnZXQgcGl4ZWxzUGVyVW5pdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BpeGVsc1BlclVuaXQ7XG4gICAgfVxuXG4gICAgLy8gcHJpdmF0ZVxuICAgIGdldCBhYWJiKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJhYmxlLm1lc2hJbnN0YW5jZS5hYWJiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgSW1hZ2VFbGVtZW50IH07XG4iXSwibmFtZXMiOlsiSW1hZ2VSZW5kZXJhYmxlIiwiY29uc3RydWN0b3IiLCJlbnRpdHkiLCJtZXNoIiwibWF0ZXJpYWwiLCJfZW50aXR5IiwiX2VsZW1lbnQiLCJlbGVtZW50IiwibW9kZWwiLCJNb2RlbCIsIm5vZGUiLCJHcmFwaE5vZGUiLCJncmFwaCIsIm1lc2hJbnN0YW5jZSIsIk1lc2hJbnN0YW5jZSIsIm5hbWUiLCJjYXN0U2hhZG93IiwicmVjZWl2ZVNoYWRvdyIsIl9tZXNoRGlydHkiLCJtZXNoSW5zdGFuY2VzIiwicHVzaCIsImFkZENoaWxkIiwidW5tYXNrTWVzaEluc3RhbmNlIiwiZGVzdHJveSIsInNldE1hdGVyaWFsIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwic2V0TWVzaCIsInZpc2libGUiLCJmb3JjZVVwZGF0ZUFhYmIiLCJzZXRNYXNrIiwibWFzayIsInBpY2siLCJwYXJhbWV0ZXJzIiwic2V0UGFyYW1ldGVyIiwiZGF0YSIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJlbmFibGVkIiwiYWRkTW9kZWxUb0xheWVycyIsInZhbHVlIiwiZGVsZXRlUGFyYW1ldGVyIiwic2V0VW5tYXNrRHJhd09yZGVyIiwiZ2V0TGFzdENoaWxkIiwiZSIsImxhc3QiLCJjIiwiY2hpbGRyZW4iLCJsIiwibGVuZ3RoIiwiaSIsImNoaWxkIiwibGFzdENoaWxkIiwiZHJhd09yZGVyIiwiZ2V0TWFza09mZnNldCIsInNldERyYXdPcmRlciIsInNldEN1bGwiLCJjdWxsIiwidmlzaWJsZUZuIiwiX2lzU2NyZWVuU3BhY2UiLCJjYW1lcmEiLCJpc1Zpc2libGVGb3JDYW1lcmEiLCJpc1Zpc2libGVGdW5jIiwic2V0U2NyZWVuU3BhY2UiLCJzY3JlZW5TcGFjZSIsInNldExheWVyIiwibGF5ZXIiLCJfYWFiYlZlciIsInNldEFhYmJGdW5jIiwiZm4iLCJfdXBkYXRlQWFiYkZ1bmMiLCJJbWFnZUVsZW1lbnQiLCJfc3lzdGVtIiwic3lzdGVtIiwiX3RleHR1cmVBc3NldCIsIl90ZXh0dXJlIiwiX21hdGVyaWFsQXNzZXQiLCJfbWF0ZXJpYWwiLCJfc3ByaXRlQXNzZXQiLCJfc3ByaXRlIiwiX3Nwcml0ZUZyYW1lIiwiX3BpeGVsc1BlclVuaXQiLCJfdGFyZ2V0QXNwZWN0UmF0aW8iLCJfcmVjdCIsIlZlYzQiLCJfbWFzayIsIl9tYXNrUmVmIiwiX291dGVyU2NhbGUiLCJWZWMyIiwiX291dGVyU2NhbGVVbmlmb3JtIiwiRmxvYXQzMkFycmF5IiwiX2lubmVyT2Zmc2V0IiwiX2lubmVyT2Zmc2V0VW5pZm9ybSIsIl9hdGxhc1JlY3QiLCJfYXRsYXNSZWN0VW5pZm9ybSIsIl9kZWZhdWx0TWVzaCIsIl9jcmVhdGVNZXNoIiwiX3JlbmRlcmFibGUiLCJfY29sb3IiLCJDb2xvciIsIl9jb2xvclVuaWZvcm0iLCJfdXBkYXRlQWFiYiIsImJpbmQiLCJfb25TY3JlZW5DaGFuZ2UiLCJzY3JlZW4iLCJvbiIsIl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UiLCJfb25TY3JlZW5TcGFjZUNoYW5nZSIsIl9vbkRyYXdPcmRlckNoYW5nZSIsIl9vblJlc29sdXRpb25DaGFuZ2UiLCJ0ZXh0dXJlQXNzZXQiLCJzcHJpdGVBc3NldCIsIm1hdGVyaWFsQXNzZXQiLCJvZmYiLCJyZXMiLCJfdXBkYXRlTWVzaCIsIl91cGRhdGVNYXRlcmlhbCIsInByZXZpb3VzIiwib3JkZXIiLCJvbmNlIiwiX2hhc1VzZXJNYXRlcmlhbCIsImRlZmF1bHRJbWFnZU1hdGVyaWFscyIsIl91c2U5U2xpY2luZyIsInNwcml0ZSIsInJlbmRlck1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQiLCJTUFJJVEVfUkVOREVSTU9ERV9USUxFRCIsIm5pbmVTbGljZWQiLCJuaW5lVGlsZWQiLCJnZXRJbWFnZUVsZW1lbnRNYXRlcmlhbCIsIl9pc1NjcmVlbkN1bGxlZCIsIkxBWUVSX0hVRCIsIkxBWUVSX1dPUkxEIiwidyIsImNhbGN1bGF0ZWRXaWR0aCIsImgiLCJjYWxjdWxhdGVkSGVpZ2h0IiwiciIsInZlcnRleERhdGEiLCJBcnJheUJ1ZmZlciIsInZlcnRleERhdGFGMzIiLCJ4IiwieSIsInoiLCJ2ZXJ0ZXhEZXNjIiwic2VtYW50aWMiLCJTRU1BTlRJQ19QT1NJVElPTiIsImNvbXBvbmVudHMiLCJ0eXBlIiwiVFlQRV9GTE9BVDMyIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwiZGV2aWNlIiwiYXBwIiwiZ3JhcGhpY3NEZXZpY2UiLCJ2ZXJ0ZXhGb3JtYXQiLCJWZXJ0ZXhGb3JtYXQiLCJ2ZXJ0ZXhCdWZmZXIiLCJWZXJ0ZXhCdWZmZXIiLCJCVUZGRVJfU1RBVElDIiwiTWVzaCIsInByaW1pdGl2ZSIsIlBSSU1JVElWRV9UUklGQU4iLCJiYXNlIiwiY291bnQiLCJpbmRleGVkIiwiYWFiYiIsInNldE1pbk1heCIsIlZlYzMiLCJaRVJPIiwiZml0TW9kZSIsIkZJVE1PREVfU1RSRVRDSCIsImFjdHVhbFJhdGlvIiwiRklUTU9ERV9DT05UQUlOIiwiRklUTU9ERV9DT1ZFUiIsImZyYW1lRGF0YSIsImF0bGFzIiwiZnJhbWVzIiwiZnJhbWVLZXlzIiwiYm9yZGVyV2lkdGhTY2FsZSIsInJlY3QiLCJib3JkZXJIZWlnaHRTY2FsZSIsInNldCIsImJvcmRlciIsInRleCIsInRleHR1cmUiLCJ3aWR0aCIsImhlaWdodCIsInBwdSIsInBpeGVsc1BlclVuaXQiLCJzY2FsZU11bFgiLCJzY2FsZU11bFkiLCJNYXRoIiwibWF4Iiwic2NhbGVYIiwic2NhbGVZIiwibWF0aCIsImNsYW1wIiwic2V0TG9jYWxTY2FsZSIsInNldExvY2FsUG9zaXRpb24iLCJwaXZvdCIsInZiIiwibG9jayIsImhwIiwidnAiLCJhdGxhc1RleHR1cmVXaWR0aCIsImF0bGFzVGV4dHVyZUhlaWdodCIsImZyYW1lIiwidW5sb2NrIiwibWluIiwiX3VwZGF0ZVNwcml0ZSIsIm5pbmVTbGljZSIsIm1lc2hlcyIsInNwcml0ZUZyYW1lIiwicmVmcmVzaE1lc2giLCJfYmVpbmdJbml0aWFsaXplZCIsImNlbnRlciIsImhhbGZFeHRlbnRzIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsImdldFdvcmxkVHJhbnNmb3JtIiwiX3RvZ2dsZU1hc2siLCJfZGlydGlmeU1hc2siLCJfb25NYXRlcmlhbExvYWQiLCJhc3NldCIsInJlc291cmNlIiwiX29uTWF0ZXJpYWxBZGRlZCIsImFzc2V0cyIsImlkIiwiX2JpbmRNYXRlcmlhbEFzc2V0IiwiX29uTWF0ZXJpYWxDaGFuZ2UiLCJfb25NYXRlcmlhbFJlbW92ZSIsImxvYWQiLCJfdW5iaW5kTWF0ZXJpYWxBc3NldCIsIl9vblRleHR1cmVBZGRlZCIsIl9iaW5kVGV4dHVyZUFzc2V0IiwiX29uVGV4dHVyZUxvYWQiLCJfb25UZXh0dXJlQ2hhbmdlIiwiX29uVGV4dHVyZVJlbW92ZSIsIl91bmJpbmRUZXh0dXJlQXNzZXQiLCJfb25TcHJpdGVBc3NldEFkZGVkIiwiX2JpbmRTcHJpdGVBc3NldCIsIl9vblNwcml0ZUFzc2V0TG9hZCIsIl9vblNwcml0ZUFzc2V0Q2hhbmdlIiwiX29uU3ByaXRlQXNzZXRSZW1vdmUiLCJfdW5iaW5kU3ByaXRlQXNzZXQiLCJ0ZXh0dXJlQXRsYXNBc3NldCIsIl9vblRleHR1cmVBdGxhc0xvYWQiLCJhdGxhc0Fzc2V0SWQiLCJfYmluZFNwcml0ZSIsIl9vblNwcml0ZU1lc2hlc0NoYW5nZSIsIl9vblNwcml0ZVBwdUNoYW5nZSIsIl9vbkF0bGFzVGV4dHVyZUNoYW5nZSIsIl91bmJpbmRTcHJpdGUiLCJTUFJJVEVfUkVOREVSTU9ERV9TSU1QTEUiLCJhdGxhc0Fzc2V0IiwiQXNzZXQiLCJnZXQiLCJvbkVuYWJsZSIsIm9uRGlzYWJsZSIsIl9zZXRTdGVuY2lsIiwic3RlbmNpbFBhcmFtcyIsInN0ZW5jaWxGcm9udCIsInN0ZW5jaWxCYWNrIiwicmVmIiwibWFza2VkQnkiLCJfaW1hZ2UiLCJzcCIsIlN0ZW5jaWxQYXJhbWV0ZXJzIiwiZnVuYyIsIkZVTkNfRVFVQUwiLCJ6cGFzcyIsIlNURU5DSUxPUF9ERUNSRU1FTlQiLCJjb2xvciIsImciLCJiIiwiRGVidWciLCJ3YXJuIiwiZmlyZSIsIm9wYWNpdHkiLCJhIiwiY29uc29sZSIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsIiwiZGVmYXVsdEltYWdlTWFza01hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCIsImRlZmF1bHRJbWFnZU1hdGVyaWFsIiwiX2lkIiwiX3ByZXYiLCJuZXdBc3BlY3RSYXRpbyIsIm9sZFZhbHVlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFDQSxNQUFNQSxlQUFOLENBQXNCO0FBQ2xCQyxFQUFBQSxXQUFXLENBQUNDLE1BQUQsRUFBU0MsSUFBVCxFQUFlQyxRQUFmLEVBQXlCO0lBQ2hDLElBQUtDLENBQUFBLE9BQUwsR0FBZUgsTUFBZixDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtJLFFBQUwsR0FBZ0JKLE1BQU0sQ0FBQ0ssT0FBdkIsQ0FBQTtBQUVBLElBQUEsSUFBQSxDQUFLQyxLQUFMLEdBQWEsSUFBSUMsS0FBSixFQUFiLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0MsSUFBTCxHQUFZLElBQUlDLFNBQUosRUFBWixDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtILEtBQUwsQ0FBV0ksS0FBWCxHQUFtQixLQUFLRixJQUF4QixDQUFBO0lBRUEsSUFBS1AsQ0FBQUEsSUFBTCxHQUFZQSxJQUFaLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS1UsWUFBTCxHQUFvQixJQUFJQyxZQUFKLENBQWlCLElBQUEsQ0FBS1gsSUFBdEIsRUFBNEJDLFFBQTVCLEVBQXNDLElBQUtNLENBQUFBLElBQTNDLENBQXBCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0csWUFBTCxDQUFrQkUsSUFBbEIsR0FBeUIsZ0JBQW1CYixHQUFBQSxNQUFNLENBQUNhLElBQW5ELENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS0YsWUFBTCxDQUFrQkcsVUFBbEIsR0FBK0IsS0FBL0IsQ0FBQTtBQUNBLElBQUEsSUFBQSxDQUFLSCxZQUFMLENBQWtCSSxhQUFsQixHQUFrQyxLQUFsQyxDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsVUFBTCxHQUFrQixLQUFsQixDQUFBO0FBRUEsSUFBQSxJQUFBLENBQUtWLEtBQUwsQ0FBV1csYUFBWCxDQUF5QkMsSUFBekIsQ0FBOEIsS0FBS1AsWUFBbkMsQ0FB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
