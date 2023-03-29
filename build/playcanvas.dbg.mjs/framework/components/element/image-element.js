/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { SEMANTIC_POSITION, TYPE_FLOAT32, SEMANTIC_NORMAL, SEMANTIC_TEXCOORD0, BUFFER_STATIC, PRIMITIVE_TRISTRIP, FUNC_EQUAL, STENCILOP_DECREMENT } from '../../../platform/graphics/constants.js';
import { VertexBuffer } from '../../../platform/graphics/vertex-buffer.js';
import { VertexFormat } from '../../../platform/graphics/vertex-format.js';
import { DeviceCache } from '../../../platform/graphics/device-cache.js';
import { SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED, LAYER_HUD, LAYER_WORLD, SPRITE_RENDERMODE_SIMPLE } from '../../../scene/constants.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { Mesh } from '../../../scene/mesh.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { StencilParameters } from '../../../scene/stencil-parameters.js';
import { FITMODE_STRETCH, FITMODE_CONTAIN, FITMODE_COVER } from './constants.js';
import { Asset } from '../../asset/asset.js';

const _vertexFormatDeviceCache = new DeviceCache();
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
    this.setMaterial(null); // clear material references
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

      // copy parameters
      for (const name in this.meshInstance.parameters) {
        this.unmaskMeshInstance.setParameter(name, this.meshInstance.parameters[name].data);
      }
    } else {
      // remove unmask mesh instance from model
      const idx = this.model.meshInstances.indexOf(this.unmaskMeshInstance);
      if (idx >= 0) {
        this.model.meshInstances.splice(idx, 1);
      }
      this.unmaskMeshInstance = null;
    }

    // remove model then re-add to update to current mesh instances
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

    // The unmask mesh instance renders into the stencil buffer
    // with the ref of the previous mask. This essentially "clears"
    // the mask value
    //
    // The unmask has a drawOrder set to be mid-way between the last child of the
    // masked hierarchy and the next child to be drawn.
    //
    // The offset is reduced by a small fraction each time so that if multiple masks
    // end on the same last child they are unmasked in the correct order.
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

    // public
    this._textureAsset = null;
    this._texture = null;
    this._materialAsset = null;
    this._material = null;
    this._spriteAsset = null;
    this._sprite = null;
    this._spriteFrame = 0;
    this._pixelsPerUnit = null;
    this._targetAspectRatio = -1; // will be set when assigning textures

    this._rect = new Vec4(0, 0, 1, 1); // x, y, w, h

    this._mask = false; // this image element is a mask
    this._maskRef = 0; // id used in stencil buffer to mask

    // 9-slicing
    this._outerScale = new Vec2();
    this._outerScaleUniform = new Float32Array(2);
    this._innerOffset = new Vec4();
    this._innerOffsetUniform = new Float32Array(4);
    this._atlasRect = new Vec4();
    this._atlasRectUniform = new Float32Array(4);
    this._defaultMesh = this._createMesh();
    this._renderable = new ImageRenderable(this._entity, this._defaultMesh, this._material);

    // set default colors
    this._color = new Color(1, 1, 1, 1);
    this._colorUniform = new Float32Array([1, 1, 1]);
    this._renderable.setParameter('material_emissive', this._colorUniform);
    this._renderable.setParameter('material_opacity', 1);
    this._updateAabbFunc = this._updateAabb.bind(this);

    // initialize based on screen
    this._onScreenChange(this._element.screen);

    // listen for events
    this._element.on('resize', this._onParentResizeOrPivotChange, this);
    this._element.on('set:pivot', this._onParentResizeOrPivotChange, this);
    this._element.on('screen:set:screenspace', this._onScreenSpaceChange, this);
    this._element.on('set:screen', this._onScreenChange, this);
    this._element.on('set:draworder', this._onDrawOrderChange, this);
    this._element.on('screen:set:resolution', this._onResolutionChange, this);
  }
  destroy() {
    // reset all assets to unbind all asset events
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

  // Returns true if we are using a material
  // other than the default materials
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
      // culling is always true for non-screenspace (frustrum is used); for screenspace, use the 'cull' property
      this._renderable.setCull(!this._element._isScreenSpace() || this._element._isScreenCulled());
      this._renderable.setMaterial(this._material);
      this._renderable.setScreenSpace(screenSpace);
      this._renderable.setLayer(screenSpace ? LAYER_HUD : LAYER_WORLD);
    }
  }

  // build a quad for the image
  _createMesh() {
    const element = this._element;
    const w = element.calculatedWidth;
    const h = element.calculatedHeight;
    const r = this._rect;
    const device = this._system.app.graphicsDevice;

    // content of the vertex buffer for 4 vertices, rendered as a tristrip
    const vertexData = new Float32Array([w, 0, 0,
    // position
    0, 0, 1,
    // normal
    r.x + r.z, 1.0 - r.y,
    // uv

    w, h, 0,
    // position
    0, 0, 1,
    // normal
    r.x + r.z, 1.0 - (r.y + r.w),
    // uv

    0, 0, 0,
    // position
    0, 0, 1,
    // normal
    r.x, 1.0 - r.y,
    // uv

    0, h, 0,
    // position
    0, 0, 1,
    // normal
    r.x, 1.0 - (r.y + r.w) // uv
    ]);

    // per device cached vertex format, to share it by all vertex buffers
    const vertexFormat = _vertexFormatDeviceCache.get(device, () => {
      return new VertexFormat(device, [{
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
      }]);
    });
    const vertexBuffer = new VertexBuffer(device, vertexFormat, 4, BUFFER_STATIC, vertexData.buffer);
    const mesh = new Mesh(device);
    mesh.vertexBuffer = vertexBuffer;
    mesh.primitive[0].type = PRIMITIVE_TRISTRIP;
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
      // check which coordinate must change in order to preserve the source aspect ratio
      if (element.fitMode === FITMODE_CONTAIN && actualRatio > this._targetAspectRatio || element.fitMode === FITMODE_COVER && actualRatio < this._targetAspectRatio) {
        // use 'height' to re-calculate width
        w = element.calculatedHeight * this._targetAspectRatio;
      } else {
        // use 'width' to re-calculate height
        h = element.calculatedWidth / this._targetAspectRatio;
      }
    }

    // update material
    const screenSpace = element._isScreenSpace();
    this._updateMaterial(screenSpace);

    // force update meshInstance aabb
    if (this._renderable) this._renderable.forceUpdateAabb();
    if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
      // calculate inner offset from the frame's border
      const frameData = this._sprite.atlas.frames[this._sprite.frameKeys[this._spriteFrame]];
      const borderWidthScale = 2 / frameData.rect.z;
      const borderHeightScale = 2 / frameData.rect.w;
      this._innerOffset.set(frameData.border.x * borderWidthScale, frameData.border.y * borderHeightScale, frameData.border.z * borderWidthScale, frameData.border.w * borderHeightScale);
      const tex = this.sprite.atlas.texture;
      this._atlasRect.set(frameData.rect.x / tex.width, frameData.rect.y / tex.height, frameData.rect.z / tex.width, frameData.rect.w / tex.height);

      // scale: apply PPU
      const ppu = this._pixelsPerUnit !== null ? this._pixelsPerUnit : this.sprite.pixelsPerUnit;
      const scaleMulX = frameData.rect.z / ppu;
      const scaleMulY = frameData.rect.w / ppu;

      // scale borders if necessary instead of overlapping
      this._outerScale.set(Math.max(w, this._innerOffset.x * scaleMulX), Math.max(h, this._innerOffset.y * scaleMulY));
      let scaleX = scaleMulX;
      let scaleY = scaleMulY;
      this._outerScale.x /= scaleMulX;
      this._outerScale.y /= scaleMulY;

      // scale: shrinking below 1
      scaleX *= math.clamp(w / (this._innerOffset.x * scaleMulX), 0.0001, 1);
      scaleY *= math.clamp(h / (this._innerOffset.y * scaleMulY), 0.0001, 1);

      // set scale
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

      // offset for pivot
      const hp = element.pivot.x;
      const vp = element.pivot.y;

      // Update vertex positions, accounting for the pivot offset
      vertexDataF32[0] = w - hp * w;
      vertexDataF32[1] = 0 - vp * h;
      vertexDataF32[8] = w - hp * w;
      vertexDataF32[9] = h - vp * h;
      vertexDataF32[16] = 0 - hp * w;
      vertexDataF32[17] = 0 - vp * h;
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

      // Update vertex texture coordinates
      vertexDataF32[6] = (rect.x + rect.z) / atlasTextureWidth;
      vertexDataF32[7] = 1.0 - rect.y / atlasTextureHeight;
      vertexDataF32[14] = (rect.x + rect.z) / atlasTextureWidth;
      vertexDataF32[15] = 1.0 - (rect.y + rect.w) / atlasTextureHeight;
      vertexDataF32[22] = rect.x / atlasTextureWidth;
      vertexDataF32[23] = 1.0 - rect.y / atlasTextureHeight;
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

  // Gets the mesh from the sprite asset
  // if the sprite is 9-sliced or the default mesh from the
  // image element and calls _updateMesh or sets meshDirty to true
  // if the component is currently being initialized. Also updates
  // aspect ratio. We need to call _updateSprite every time
  // something related to the sprite asset changes
  _updateSprite() {
    let nineSlice = false;
    let mesh = null;

    // reset target aspect ratio
    this._targetAspectRatio = -1;
    if (this._sprite && this._sprite.atlas) {
      // take mesh from sprite
      mesh = this._sprite.meshes[this.spriteFrame];
      nineSlice = this._sprite.renderMode === SPRITE_RENDERMODE_SLICED || this._sprite.renderMode === SPRITE_RENDERMODE_TILED;

      // re-calculate aspect ratio from sprite frame
      const frameData = this._sprite.atlas.frames[this._sprite.frameKeys[this._spriteFrame]];
      if ((frameData == null ? void 0 : frameData.rect.w) > 0) {
        this._targetAspectRatio = frameData.rect.z / frameData.rect.w;
      }
    }

    // if we use 9 slicing then use that mesh otherwise keep using the default mesh
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

  // updates AABB while 9-slicing
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
    if (!this._entity.enabled) return; // don't bind until element is enabled

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
    if (!this._entity.enabled) return; // don't bind until element is enabled

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

  // When sprite asset is added bind it
  _onSpriteAssetAdded(asset) {
    this._system.app.assets.off('add:' + asset.id, this._onSpriteAssetAdded, this);
    if (this._spriteAsset === asset.id) {
      this._bindSpriteAsset(asset);
    }
  }

  // Hook up event handlers on sprite asset
  _bindSpriteAsset(asset) {
    if (!this._entity.enabled) return; // don't bind until element is enabled

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

  // When sprite asset is loaded make sure the texture atlas asset is loaded too
  // If so then set the sprite, otherwise wait for the atlas to be loaded first
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

  // When the sprite asset changes reset it
  _onSpriteAssetChange(asset) {
    this._onSpriteAssetLoad(asset);
  }
  _onSpriteAssetRemove(asset) {}

  // Hook up event handlers on sprite asset
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
    // clamp frame
    if (this._sprite) {
      this._spriteFrame = math.clamp(this._spriteFrame, 0, this._sprite.frameKeys.length - 1);
    }

    // force update
    this._updateSprite();
  }
  _onSpritePpuChange() {
    // force update when the sprite is 9-sliced. If it's not
    // then its mesh will change when the ppu changes which will
    // be handled by onSpriteMeshesChange
    if (this.sprite.renderMode !== SPRITE_RENDERMODE_SIMPLE && this._pixelsPerUnit === null) {
      // force update
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

  // When atlas is loaded try to reset the sprite asset
  _onTextureAtlasLoad(atlasAsset) {
    const spriteAsset = this._spriteAsset;
    if (spriteAsset instanceof Asset) {
      // TODO: _spriteAsset should never be an asset instance?
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

      // if this is not the default material then clear color and opacity overrides
      if (this._hasUserMaterial()) {
        this._renderable.deleteParameter('material_opacity');
        this._renderable.deleteParameter('material_emissive');
      } else {
        // otherwise if we are back to the defaults reset the color and opacity
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
      // clear sprite asset if texture is set
      if (this._spriteAsset) {
        this.spriteAsset = null;
      }

      // default texture just uses emissive and opacity maps
      this._renderable.setParameter('texture_emissiveMap', this._texture);
      this._renderable.setParameter('texture_opacityMap', this._texture);
      this._colorUniform[0] = this._color.r;
      this._colorUniform[1] = this._color.g;
      this._colorUniform[2] = this._color.b;
      this._renderable.setParameter('material_emissive', this._colorUniform);
      this._renderable.setParameter('material_opacity', this._color.a);

      // if texture's aspect ratio changed and the element needs to preserve aspect ratio, refresh the mesh
      const newAspectRatio = this._texture.width / this._texture.height;
      if (newAspectRatio !== this._targetAspectRatio) {
        this._targetAspectRatio = newAspectRatio;
        if (this._element.fitMode !== FITMODE_STRETCH) {
          this.refreshMesh();
        }
      }
    } else {
      // clear texture params
      this._renderable.deleteParameter('texture_emissiveMap');
      this._renderable.deleteParameter('texture_opacityMap');

      // reset target aspect ratio and refresh mesh if there is an aspect ratio setting
      // this is needed in order to properly reset the mesh to 'stretch' across the entire element bounds
      // when resetting the texture
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

      // clear texture if sprite is being set
      if (this._textureAsset) {
        this.textureAsset = null;
      }
    }
    if (this._sprite && this._sprite.atlas && this._sprite.atlas.texture) {
      // default texture just uses emissive and opacity maps
      this._renderable.setParameter('texture_emissiveMap', this._sprite.atlas.texture);
      this._renderable.setParameter('texture_opacityMap', this._sprite.atlas.texture);
    } else {
      // clear texture params
      this._renderable.deleteParameter('texture_emissiveMap');
      this._renderable.deleteParameter('texture_opacityMap');
    }

    // clamp frame
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
      // clamp frame
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

  // private
  get aabb() {
    if (this._renderable.meshInstance) {
      return this._renderable.meshInstance.aabb;
    }
    return null;
  }
}

export { ImageElement };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtZWxlbWVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL2VsZW1lbnQvaW1hZ2UtZWxlbWVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQge1xuICAgIEJVRkZFUl9TVEFUSUMsXG4gICAgRlVOQ19FUVVBTCxcbiAgICBQUklNSVRJVkVfVFJJU1RSSVAsXG4gICAgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX05PUk1BTCwgU0VNQU5USUNfVEVYQ09PUkQwLFxuICAgIFNURU5DSUxPUF9ERUNSRU1FTlQsXG4gICAgVFlQRV9GTE9BVDMyXG59IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtYnVmZmVyLmpzJztcbmltcG9ydCB7IFZlcnRleEZvcm1hdCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3ZlcnRleC1mb3JtYXQuanMnO1xuaW1wb3J0IHsgRGV2aWNlQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZXZpY2UtY2FjaGUuanMnO1xuXG5pbXBvcnQge1xuICAgIExBWUVSX0hVRCwgTEFZRVJfV09STEQsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFLCBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQsIFNQUklURV9SRU5ERVJNT0RFX1RJTEVEXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tb2RlbC5qcyc7XG5pbXBvcnQgeyBTdGVuY2lsUGFyYW1ldGVycyB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3N0ZW5jaWwtcGFyYW1ldGVycy5qcyc7XG5cbmltcG9ydCB7IEZJVE1PREVfU1RSRVRDSCwgRklUTU9ERV9DT05UQUlOLCBGSVRNT0RFX0NPVkVSIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuLy8gI2lmIF9ERUJVR1xuY29uc3QgX2RlYnVnTG9nZ2luZyA9IGZhbHNlO1xuLy8gI2VuZGlmXG5cbmNvbnN0IF92ZXJ0ZXhGb3JtYXREZXZpY2VDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuXG5jbGFzcyBJbWFnZVJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKGVudGl0eSwgbWVzaCwgbWF0ZXJpYWwpIHtcbiAgICAgICAgdGhpcy5fZW50aXR5ID0gZW50aXR5O1xuICAgICAgICB0aGlzLl9lbGVtZW50ID0gZW50aXR5LmVsZW1lbnQ7XG5cbiAgICAgICAgdGhpcy5tb2RlbCA9IG5ldyBNb2RlbCgpO1xuICAgICAgICB0aGlzLm5vZGUgPSBuZXcgR3JhcGhOb2RlKCk7XG4gICAgICAgIHRoaXMubW9kZWwuZ3JhcGggPSB0aGlzLm5vZGU7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgbWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm5hbWUgPSAnSW1hZ2VFbGVtZW50OiAnICsgZW50aXR5Lm5hbWU7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX21lc2hEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubW9kZWwubWVzaEluc3RhbmNlcy5wdXNoKHRoaXMubWVzaEluc3RhbmNlKTtcblxuICAgICAgICB0aGlzLl9lbnRpdHkuYWRkQ2hpbGQodGhpcy5tb2RlbC5ncmFwaCk7XG4gICAgICAgIHRoaXMubW9kZWwuX2VudGl0eSA9IHRoaXMuX2VudGl0eTtcblxuICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5zZXRNYXRlcmlhbChudWxsKTsgLy8gY2xlYXIgbWF0ZXJpYWwgcmVmZXJlbmNlc1xuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5tb2RlbC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICB0aGlzLm5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2ggPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VudGl0eSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBudWxsO1xuICAgIH1cblxuICAgIHNldE1lc2gobWVzaCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA9ICEhbWVzaDtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1lc2ggPSBtZXNoO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZm9yY2VVcGRhdGVBYWJiKCk7XG4gICAgfVxuXG4gICAgc2V0TWFzayhtYXNrKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgdGhpcy5tZXNoSW5zdGFuY2UubWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5uYW1lID0gJ1VubWFzazogJyArIHRoaXMuX2VudGl0eS5uYW1lO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucGljayA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMucHVzaCh0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIC8vIGNvcHkgcGFyYW1ldGVyc1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMubWVzaEluc3RhbmNlLnBhcmFtZXRlcnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIobmFtZSwgdGhpcy5tZXNoSW5zdGFuY2UucGFyYW1ldGVyc1tuYW1lXS5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSB1bm1hc2sgbWVzaCBpbnN0YW5jZSBmcm9tIG1vZGVsXG4gICAgICAgICAgICBjb25zdCBpZHggPSB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuaW5kZXhPZih0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBtb2RlbCB0aGVuIHJlLWFkZCB0byB1cGRhdGUgdG8gY3VycmVudCBtZXNoIGluc3RhbmNlc1xuICAgICAgICBpZiAodGhpcy5fZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fZWxlbWVudC5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuYWRkTW9kZWxUb0xheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldE1hdGVyaWFsKG1hdGVyaWFsKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRQYXJhbWV0ZXIobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihuYW1lLCB2YWx1ZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlbGV0ZVBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0VW5tYXNrRHJhd09yZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZ2V0TGFzdENoaWxkID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGxldCBsYXN0O1xuICAgICAgICAgICAgY29uc3QgYyA9IGUuY2hpbGRyZW47XG4gICAgICAgICAgICBjb25zdCBsID0gYy5sZW5ndGg7XG4gICAgICAgICAgICBpZiAobCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjW2ldLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3QgPSBjW2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFsYXN0KSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gZ2V0TGFzdENoaWxkKGxhc3QpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBsYXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVGhlIHVubWFzayBtZXNoIGluc3RhbmNlIHJlbmRlcnMgaW50byB0aGUgc3RlbmNpbCBidWZmZXJcbiAgICAgICAgLy8gd2l0aCB0aGUgcmVmIG9mIHRoZSBwcmV2aW91cyBtYXNrLiBUaGlzIGVzc2VudGlhbGx5IFwiY2xlYXJzXCJcbiAgICAgICAgLy8gdGhlIG1hc2sgdmFsdWVcbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGhlIHVubWFzayBoYXMgYSBkcmF3T3JkZXIgc2V0IHRvIGJlIG1pZC13YXkgYmV0d2VlbiB0aGUgbGFzdCBjaGlsZCBvZiB0aGVcbiAgICAgICAgLy8gbWFza2VkIGhpZXJhcmNoeSBhbmQgdGhlIG5leHQgY2hpbGQgdG8gYmUgZHJhd24uXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRoZSBvZmZzZXQgaXMgcmVkdWNlZCBieSBhIHNtYWxsIGZyYWN0aW9uIGVhY2ggdGltZSBzbyB0aGF0IGlmIG11bHRpcGxlIG1hc2tzXG4gICAgICAgIC8vIGVuZCBvbiB0aGUgc2FtZSBsYXN0IGNoaWxkIHRoZXkgYXJlIHVubWFza2VkIGluIHRoZSBjb3JyZWN0IG9yZGVyLlxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGxhc3RDaGlsZCA9IGdldExhc3RDaGlsZCh0aGlzLl9lbnRpdHkpO1xuICAgICAgICAgICAgaWYgKGxhc3RDaGlsZCAmJiBsYXN0Q2hpbGQuZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IGxhc3RDaGlsZC5lbGVtZW50LmRyYXdPcmRlciArIGxhc3RDaGlsZC5lbGVtZW50LmdldE1hc2tPZmZzZXQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdGhpcy5tZXNoSW5zdGFuY2UuZHJhd09yZGVyICsgdGhpcy5fZWxlbWVudC5nZXRNYXNrT2Zmc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykgY29uc29sZS5sb2coJ3NldERyYXdPcmRlcjogJywgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UubmFtZSwgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZHJhd09yZGVyKTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0RHJhd09yZGVyKGRyYXdPcmRlcikge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIGNvbnNvbGUubG9nKCdzZXREcmF3T3JkZXI6ICcsIHRoaXMubWVzaEluc3RhbmNlLm5hbWUsIGRyYXdPcmRlcik7XG4gICAgICAgIC8vICNlbmRpZlxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kcmF3T3JkZXIgPSBkcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgc2V0Q3VsbChjdWxsKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7XG5cbiAgICAgICAgbGV0IHZpc2libGVGbiA9IG51bGw7XG4gICAgICAgIGlmIChjdWxsICYmIGVsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKSkge1xuICAgICAgICAgICAgdmlzaWJsZUZuID0gZnVuY3Rpb24gKGNhbWVyYSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlbGVtZW50LmlzVmlzaWJsZUZvckNhbWVyYShjYW1lcmEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmN1bGwgPSBjdWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5pc1Zpc2libGVGdW5jID0gdmlzaWJsZUZuO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuY3VsbCA9IGN1bGw7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5pc1Zpc2libGVGdW5jID0gdmlzaWJsZUZuO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2NyZWVuU3BhY2Uoc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnNjcmVlblNwYWNlID0gc2NyZWVuU3BhY2U7XG5cbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5zY3JlZW5TcGFjZSA9IHNjcmVlblNwYWNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0TGF5ZXIobGF5ZXIpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmxheWVyID0gbGF5ZXI7XG5cbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5sYXllciA9IGxheWVyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yY2VVcGRhdGVBYWJiKG1hc2spIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl9hYWJiVmVyID0gLTE7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEFhYmJGdW5jKGZuKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSBmbjtcbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSBmbjtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgSW1hZ2VFbGVtZW50IHtcbiAgICBjb25zdHJ1Y3RvcihlbGVtZW50KSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgICB0aGlzLl9lbnRpdHkgPSBlbGVtZW50LmVudGl0eTtcbiAgICAgICAgdGhpcy5fc3lzdGVtID0gZWxlbWVudC5zeXN0ZW07XG5cbiAgICAgICAgLy8gcHVibGljXG4gICAgICAgIHRoaXMuX3RleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RleHR1cmUgPSBudWxsO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLl9zcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3Nwcml0ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gMDtcbiAgICAgICAgdGhpcy5fcGl4ZWxzUGVyVW5pdCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gLTE7IC8vIHdpbGwgYmUgc2V0IHdoZW4gYXNzaWduaW5nIHRleHR1cmVzXG5cbiAgICAgICAgdGhpcy5fcmVjdCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpOyAvLyB4LCB5LCB3LCBoXG5cbiAgICAgICAgdGhpcy5fbWFzayA9IGZhbHNlOyAvLyB0aGlzIGltYWdlIGVsZW1lbnQgaXMgYSBtYXNrXG4gICAgICAgIHRoaXMuX21hc2tSZWYgPSAwOyAvLyBpZCB1c2VkIGluIHN0ZW5jaWwgYnVmZmVyIHRvIG1hc2tcblxuICAgICAgICAvLyA5LXNsaWNpbmdcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZSA9IG5ldyBWZWMyKCk7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICAgICAgdGhpcy5faW5uZXJPZmZzZXQgPSBuZXcgVmVjNCgpO1xuICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9hdGxhc1JlY3QgPSBuZXcgVmVjNCgpO1xuICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcblxuICAgICAgICB0aGlzLl9kZWZhdWx0TWVzaCA9IHRoaXMuX2NyZWF0ZU1lc2goKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZSA9IG5ldyBJbWFnZVJlbmRlcmFibGUodGhpcy5fZW50aXR5LCB0aGlzLl9kZWZhdWx0TWVzaCwgdGhpcy5fbWF0ZXJpYWwpO1xuXG4gICAgICAgIC8vIHNldCBkZWZhdWx0IGNvbG9yc1xuICAgICAgICB0aGlzLl9jb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheShbMSwgMSwgMV0pO1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIDEpO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmJGdW5jID0gdGhpcy5fdXBkYXRlQWFiYi5iaW5kKHRoaXMpO1xuXG4gICAgICAgIC8vIGluaXRpYWxpemUgYmFzZWQgb24gc2NyZWVuXG4gICAgICAgIHRoaXMuX29uU2NyZWVuQ2hhbmdlKHRoaXMuX2VsZW1lbnQuc2NyZWVuKTtcblxuICAgICAgICAvLyBsaXN0ZW4gZm9yIGV2ZW50c1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdyZXNpemUnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzZXQ6cGl2b3QnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzY3JlZW46c2V0OnNjcmVlbnNwYWNlJywgdGhpcy5fb25TY3JlZW5TcGFjZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NldDpzY3JlZW4nLCB0aGlzLl9vblNjcmVlbkNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NldDpkcmF3b3JkZXInLCB0aGlzLl9vbkRyYXdPcmRlckNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NjcmVlbjpzZXQ6cmVzb2x1dGlvbicsIHRoaXMuX29uUmVzb2x1dGlvbkNoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gcmVzZXQgYWxsIGFzc2V0cyB0byB1bmJpbmQgYWxsIGFzc2V0IGV2ZW50c1xuICAgICAgICB0aGlzLnRleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLm1hdGVyaWFsQXNzZXQgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWVzaCh0aGlzLl9kZWZhdWx0TWVzaCk7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9kZWZhdWx0TWVzaCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3Jlc2l6ZScsIHRoaXMuX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzZXQ6cGl2b3QnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2NyZWVuOnNldDpzY3JlZW5zcGFjZScsIHRoaXMuX29uU2NyZWVuU3BhY2VDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2V0OnNjcmVlbicsIHRoaXMuX29uU2NyZWVuQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NldDpkcmF3b3JkZXInLCB0aGlzLl9vbkRyYXdPcmRlckNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzY3JlZW46c2V0OnJlc29sdXRpb24nLCB0aGlzLl9vblJlc29sdXRpb25DaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vblJlc29sdXRpb25DaGFuZ2UocmVzKSB7XG4gICAgfVxuXG4gICAgX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUubWVzaCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWVzaCh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2NyZWVuU3BhY2VDaGFuZ2UodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwodmFsdWUpO1xuICAgIH1cblxuICAgIF9vblNjcmVlbkNoYW5nZShzY3JlZW4sIHByZXZpb3VzKSB7XG4gICAgICAgIGlmIChzY3JlZW4pIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbChmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25EcmF3T3JkZXJDaGFuZ2Uob3JkZXIpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXREcmF3T3JkZXIob3JkZXIpO1xuXG4gICAgICAgIGlmICh0aGlzLm1hc2sgJiYgdGhpcy5fZWxlbWVudC5zY3JlZW4pIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuc2NyZWVuLnNjcmVlbi5vbmNlKCdzeW5jZHJhd29yZGVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0VW5tYXNrRHJhd09yZGVyKCk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJldHVybnMgdHJ1ZSBpZiB3ZSBhcmUgdXNpbmcgYSBtYXRlcmlhbFxuICAgIC8vIG90aGVyIHRoYW4gdGhlIGRlZmF1bHQgbWF0ZXJpYWxzXG4gICAgX2hhc1VzZXJNYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fbWF0ZXJpYWxBc3NldCB8fFxuICAgICAgICAgICAgICAgKCEhdGhpcy5fbWF0ZXJpYWwgJiZcbiAgICAgICAgICAgICAgICB0aGlzLl9zeXN0ZW0uZGVmYXVsdEltYWdlTWF0ZXJpYWxzLmluZGV4T2YodGhpcy5fbWF0ZXJpYWwpID09PSAtMSk7XG4gICAgfVxuXG4gICAgX3VzZTlTbGljaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKSB7XG4gICAgICAgIGNvbnN0IG1hc2sgPSAhIXRoaXMuX21hc2s7XG4gICAgICAgIGNvbnN0IG5pbmVTbGljZWQgPSAhISh0aGlzLnNwcml0ZSAmJiB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpO1xuICAgICAgICBjb25zdCBuaW5lVGlsZWQgPSAhISh0aGlzLnNwcml0ZSAmJiB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9oYXNVc2VyTWF0ZXJpYWwoKSkge1xuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSB0aGlzLl9zeXN0ZW0uZ2V0SW1hZ2VFbGVtZW50TWF0ZXJpYWwoc2NyZWVuU3BhY2UsIG1hc2ssIG5pbmVTbGljZWQsIG5pbmVUaWxlZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkge1xuICAgICAgICAgICAgLy8gY3VsbGluZyBpcyBhbHdheXMgdHJ1ZSBmb3Igbm9uLXNjcmVlbnNwYWNlIChmcnVzdHJ1bSBpcyB1c2VkKTsgZm9yIHNjcmVlbnNwYWNlLCB1c2UgdGhlICdjdWxsJyBwcm9wZXJ0eVxuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRDdWxsKCF0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCkgfHwgdGhpcy5fZWxlbWVudC5faXNTY3JlZW5DdWxsZWQoKSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1hdGVyaWFsKHRoaXMuX21hdGVyaWFsKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0U2NyZWVuU3BhY2Uoc2NyZWVuU3BhY2UpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRMYXllcihzY3JlZW5TcGFjZSA/IExBWUVSX0hVRCA6IExBWUVSX1dPUkxEKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGJ1aWxkIGEgcXVhZCBmb3IgdGhlIGltYWdlXG4gICAgX2NyZWF0ZU1lc2goKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9lbGVtZW50O1xuICAgICAgICBjb25zdCB3ID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgIGNvbnN0IGggPSBlbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQ7XG4gICAgICAgIGNvbnN0IHIgPSB0aGlzLl9yZWN0O1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLl9zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIC8vIGNvbnRlbnQgb2YgdGhlIHZlcnRleCBidWZmZXIgZm9yIDQgdmVydGljZXMsIHJlbmRlcmVkIGFzIGEgdHJpc3RyaXBcbiAgICAgICAgY29uc3QgdmVydGV4RGF0YSA9IG5ldyBGbG9hdDMyQXJyYXkoW1xuICAgICAgICAgICAgdywgMCwgMCwgICAgICAgICAgICAgICAgICAgICAgICAvLyBwb3NpdGlvblxuICAgICAgICAgICAgMCwgMCwgMSwgICAgICAgICAgICAgICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIHIueCArIHIueiwgMS4wIC0gci55LCAgICAgICAgICAgLy8gdXZcblxuICAgICAgICAgICAgdywgaCwgMCwgICAgICAgICAgICAgICAgICAgICAgICAvLyBwb3NpdGlvblxuICAgICAgICAgICAgMCwgMCwgMSwgICAgICAgICAgICAgICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIHIueCArIHIueiwgMS4wIC0gKHIueSArIHIudyksICAgLy8gdXZcblxuICAgICAgICAgICAgMCwgMCwgMCwgICAgICAgICAgICAgICAgICAgICAgICAvLyBwb3NpdGlvblxuICAgICAgICAgICAgMCwgMCwgMSwgICAgICAgICAgICAgICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIHIueCwgMS4wIC0gci55LCAgICAgICAgICAgICAgICAgLy8gdXZcblxuICAgICAgICAgICAgMCwgaCwgMCwgICAgICAgICAgICAgICAgICAgICAgICAvLyBwb3NpdGlvblxuICAgICAgICAgICAgMCwgMCwgMSwgICAgICAgICAgICAgICAgICAgICAgICAvLyBub3JtYWxcbiAgICAgICAgICAgIHIueCwgMS4wIC0gKHIueSArIHIudykgICAgICAgICAgLy8gdXZcbiAgICAgICAgXSk7XG5cbiAgICAgICAgLy8gcGVyIGRldmljZSBjYWNoZWQgdmVydGV4IGZvcm1hdCwgdG8gc2hhcmUgaXQgYnkgYWxsIHZlcnRleCBidWZmZXJzXG4gICAgICAgIGNvbnN0IHZlcnRleEZvcm1hdCA9IF92ZXJ0ZXhGb3JtYXREZXZpY2VDYWNoZS5nZXQoZGV2aWNlLCAoKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IFZlcnRleEZvcm1hdChkZXZpY2UsIFtcbiAgICAgICAgICAgICAgICB7IHNlbWFudGljOiBTRU1BTlRJQ19QT1NJVElPTiwgY29tcG9uZW50czogMywgdHlwZTogVFlQRV9GTE9BVDMyIH0sXG4gICAgICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfTk9STUFMLCBjb21wb25lbnRzOiAzLCB0eXBlOiBUWVBFX0ZMT0FUMzIgfSxcbiAgICAgICAgICAgICAgICB7IHNlbWFudGljOiBTRU1BTlRJQ19URVhDT09SRDAsIGNvbXBvbmVudHM6IDIsIHR5cGU6IFRZUEVfRkxPQVQzMiB9XG4gICAgICAgICAgICBdKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgdmVydGV4QnVmZmVyID0gbmV3IFZlcnRleEJ1ZmZlcihkZXZpY2UsIHZlcnRleEZvcm1hdCwgNCwgQlVGRkVSX1NUQVRJQywgdmVydGV4RGF0YS5idWZmZXIpO1xuXG4gICAgICAgIGNvbnN0IG1lc2ggPSBuZXcgTWVzaChkZXZpY2UpO1xuICAgICAgICBtZXNoLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlcjtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0udHlwZSA9IFBSSU1JVElWRV9UUklTVFJJUDtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uYmFzZSA9IDA7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID0gNDtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uaW5kZXhlZCA9IGZhbHNlO1xuICAgICAgICBtZXNoLmFhYmIuc2V0TWluTWF4KFZlYzMuWkVSTywgbmV3IFZlYzModywgaCwgMCkpO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZU1lc2gobWVzaCk7XG5cbiAgICAgICAgcmV0dXJuIG1lc2g7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1lc2gobWVzaCkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5fZWxlbWVudDtcbiAgICAgICAgbGV0IHcgPSBlbGVtZW50LmNhbGN1bGF0ZWRXaWR0aDtcbiAgICAgICAgbGV0IGggPSBlbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQ7XG5cbiAgICAgICAgaWYgKGVsZW1lbnQuZml0TW9kZSAhPT0gRklUTU9ERV9TVFJFVENIICYmIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID4gMCkge1xuICAgICAgICAgICAgY29uc3QgYWN0dWFsUmF0aW8gPSBlbGVtZW50LmNhbGN1bGF0ZWRXaWR0aCAvIGVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodDtcbiAgICAgICAgICAgIC8vIGNoZWNrIHdoaWNoIGNvb3JkaW5hdGUgbXVzdCBjaGFuZ2UgaW4gb3JkZXIgdG8gcHJlc2VydmUgdGhlIHNvdXJjZSBhc3BlY3QgcmF0aW9cbiAgICAgICAgICAgIGlmICgoZWxlbWVudC5maXRNb2RlID09PSBGSVRNT0RFX0NPTlRBSU4gJiYgYWN0dWFsUmF0aW8gPiB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbykgfHxcbiAgICAgICAgICAgICAgICAoZWxlbWVudC5maXRNb2RlID09PSBGSVRNT0RFX0NPVkVSICYmIGFjdHVhbFJhdGlvIDwgdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8pKSB7XG4gICAgICAgICAgICAgICAgLy8gdXNlICdoZWlnaHQnIHRvIHJlLWNhbGN1bGF0ZSB3aWR0aFxuICAgICAgICAgICAgICAgIHcgPSBlbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQgKiB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gdXNlICd3aWR0aCcgdG8gcmUtY2FsY3VsYXRlIGhlaWdodFxuICAgICAgICAgICAgICAgIGggPSBlbGVtZW50LmNhbGN1bGF0ZWRXaWR0aCAvIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIG1hdGVyaWFsXG4gICAgICAgIGNvbnN0IHNjcmVlblNwYWNlID0gZWxlbWVudC5faXNTY3JlZW5TcGFjZSgpO1xuICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbChzY3JlZW5TcGFjZSk7XG5cbiAgICAgICAgLy8gZm9yY2UgdXBkYXRlIG1lc2hJbnN0YW5jZSBhYWJiXG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlKSB0aGlzLl9yZW5kZXJhYmxlLmZvcmNlVXBkYXRlQWFiYigpO1xuXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8IHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSkge1xuXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgaW5uZXIgb2Zmc2V0IGZyb20gdGhlIGZyYW1lJ3MgYm9yZGVyXG4gICAgICAgICAgICBjb25zdCBmcmFtZURhdGEgPSB0aGlzLl9zcHJpdGUuYXRsYXMuZnJhbWVzW3RoaXMuX3Nwcml0ZS5mcmFtZUtleXNbdGhpcy5fc3ByaXRlRnJhbWVdXTtcbiAgICAgICAgICAgIGNvbnN0IGJvcmRlcldpZHRoU2NhbGUgPSAyIC8gZnJhbWVEYXRhLnJlY3QuejtcbiAgICAgICAgICAgIGNvbnN0IGJvcmRlckhlaWdodFNjYWxlID0gMiAvIGZyYW1lRGF0YS5yZWN0Lnc7XG5cbiAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0LnNldChcbiAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnggKiBib3JkZXJXaWR0aFNjYWxlLFxuICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueSAqIGJvcmRlckhlaWdodFNjYWxlLFxuICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueiAqIGJvcmRlcldpZHRoU2NhbGUsXG4gICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci53ICogYm9yZGVySGVpZ2h0U2NhbGVcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGNvbnN0IHRleCA9IHRoaXMuc3ByaXRlLmF0bGFzLnRleHR1cmU7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3Quc2V0KGZyYW1lRGF0YS5yZWN0LnggLyB0ZXgud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LnkgLyB0ZXguaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEucmVjdC56IC8gdGV4LndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEucmVjdC53IC8gdGV4LmhlaWdodCk7XG5cbiAgICAgICAgICAgIC8vIHNjYWxlOiBhcHBseSBQUFVcbiAgICAgICAgICAgIGNvbnN0IHBwdSA9IHRoaXMuX3BpeGVsc1BlclVuaXQgIT09IG51bGwgPyB0aGlzLl9waXhlbHNQZXJVbml0IDogdGhpcy5zcHJpdGUucGl4ZWxzUGVyVW5pdDtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlTXVsWCA9IGZyYW1lRGF0YS5yZWN0LnogLyBwcHU7XG4gICAgICAgICAgICBjb25zdCBzY2FsZU11bFkgPSBmcmFtZURhdGEucmVjdC53IC8gcHB1O1xuXG4gICAgICAgICAgICAvLyBzY2FsZSBib3JkZXJzIGlmIG5lY2Vzc2FyeSBpbnN0ZWFkIG9mIG92ZXJsYXBwaW5nXG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnNldChNYXRoLm1heCh3LCB0aGlzLl9pbm5lck9mZnNldC54ICogc2NhbGVNdWxYKSwgTWF0aC5tYXgoaCwgdGhpcy5faW5uZXJPZmZzZXQueSAqIHNjYWxlTXVsWSkpO1xuXG4gICAgICAgICAgICBsZXQgc2NhbGVYID0gc2NhbGVNdWxYO1xuICAgICAgICAgICAgbGV0IHNjYWxlWSA9IHNjYWxlTXVsWTtcblxuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS54IC89IHNjYWxlTXVsWDtcbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUueSAvPSBzY2FsZU11bFk7XG5cbiAgICAgICAgICAgIC8vIHNjYWxlOiBzaHJpbmtpbmcgYmVsb3cgMVxuICAgICAgICAgICAgc2NhbGVYICo9IG1hdGguY2xhbXAodyAvICh0aGlzLl9pbm5lck9mZnNldC54ICogc2NhbGVNdWxYKSwgMC4wMDAxLCAxKTtcbiAgICAgICAgICAgIHNjYWxlWSAqPSBtYXRoLmNsYW1wKGggLyAodGhpcy5faW5uZXJPZmZzZXQueSAqIHNjYWxlTXVsWSksIDAuMDAwMSwgMSk7XG5cbiAgICAgICAgICAgIC8vIHNldCBzY2FsZVxuICAgICAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMF0gPSB0aGlzLl9pbm5lck9mZnNldC54O1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVsxXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzJdID0gdGhpcy5faW5uZXJPZmZzZXQuejtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bM10gPSB0aGlzLl9pbm5lck9mZnNldC53O1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdpbm5lck9mZnNldCcsIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVswXSA9IHRoaXMuX2F0bGFzUmVjdC54O1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bMV0gPSB0aGlzLl9hdGxhc1JlY3QueTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzJdID0gdGhpcy5fYXRsYXNSZWN0Lno7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVszXSA9IHRoaXMuX2F0bGFzUmVjdC53O1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdhdGxhc1JlY3QnLCB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybVswXSA9IHRoaXMuX291dGVyU2NhbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybVsxXSA9IHRoaXMuX291dGVyU2NhbGUueTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignb3V0ZXJTY2FsZScsIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldEFhYmJGdW5jKHRoaXMuX3VwZGF0ZUFhYmJGdW5jKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUubm9kZS5zZXRMb2NhbFNjYWxlKHNjYWxlWCwgc2NhbGVZLCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxQb3NpdGlvbigoMC41IC0gZWxlbWVudC5waXZvdC54KSAqIHcsICgwLjUgLSBlbGVtZW50LnBpdm90LnkpICogaCwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCB2YiA9IG1lc2gudmVydGV4QnVmZmVyO1xuICAgICAgICAgICAgY29uc3QgdmVydGV4RGF0YUYzMiA9IG5ldyBGbG9hdDMyQXJyYXkodmIubG9jaygpKTtcblxuICAgICAgICAgICAgLy8gb2Zmc2V0IGZvciBwaXZvdFxuICAgICAgICAgICAgY29uc3QgaHAgPSBlbGVtZW50LnBpdm90Lng7XG4gICAgICAgICAgICBjb25zdCB2cCA9IGVsZW1lbnQucGl2b3QueTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIHZlcnRleCBwb3NpdGlvbnMsIGFjY291bnRpbmcgZm9yIHRoZSBwaXZvdCBvZmZzZXRcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMF0gPSB3IC0gaHAgKiB3O1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsxXSA9IDAgLSB2cCAqIGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzhdID0gdyAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbOV0gPSBoIC0gdnAgKiBoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsxNl0gPSAwIC0gaHAgKiB3O1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsxN10gPSAwIC0gdnAgKiBoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsyNF0gPSAwIC0gaHAgKiB3O1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsyNV0gPSBoIC0gdnAgKiBoO1xuXG4gICAgICAgICAgICBsZXQgYXRsYXNUZXh0dXJlV2lkdGggPSAxO1xuICAgICAgICAgICAgbGV0IGF0bGFzVGV4dHVyZUhlaWdodCA9IDE7XG4gICAgICAgICAgICBsZXQgcmVjdCA9IHRoaXMuX3JlY3Q7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGUgJiYgdGhpcy5fc3ByaXRlLmZyYW1lS2V5c1t0aGlzLl9zcHJpdGVGcmFtZV0gJiYgdGhpcy5fc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZnJhbWUgPSB0aGlzLl9zcHJpdGUuYXRsYXMuZnJhbWVzW3RoaXMuX3Nwcml0ZS5mcmFtZUtleXNbdGhpcy5fc3ByaXRlRnJhbWVdXTtcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVjdCA9IGZyYW1lLnJlY3Q7XG4gICAgICAgICAgICAgICAgICAgIGF0bGFzVGV4dHVyZVdpZHRoID0gdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUud2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIGF0bGFzVGV4dHVyZUhlaWdodCA9IHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlLmhlaWdodDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB2ZXJ0ZXggdGV4dHVyZSBjb29yZGluYXRlc1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls2XSA9IChyZWN0LnggKyByZWN0LnopIC8gYXRsYXNUZXh0dXJlV2lkdGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzddID0gMS4wIC0gcmVjdC55IC8gYXRsYXNUZXh0dXJlSGVpZ2h0O1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsxNF0gPSAocmVjdC54ICsgcmVjdC56KSAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsxNV0gPSAxLjAgLSAocmVjdC55ICsgcmVjdC53KSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjJdID0gcmVjdC54IC8gYXRsYXNUZXh0dXJlV2lkdGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzIzXSA9IDEuMCAtIHJlY3QueSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMzBdID0gcmVjdC54IC8gYXRsYXNUZXh0dXJlV2lkdGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMxXSA9IDEuMCAtIChyZWN0LnkgKyByZWN0LncpIC8gYXRsYXNUZXh0dXJlSGVpZ2h0O1xuXG4gICAgICAgICAgICB2Yi51bmxvY2soKTtcblxuICAgICAgICAgICAgY29uc3QgbWluID0gbmV3IFZlYzMoMCAtIGhwICogdywgMCAtIHZwICogaCwgMCk7XG4gICAgICAgICAgICBjb25zdCBtYXggPSBuZXcgVmVjMyh3IC0gaHAgKiB3LCBoIC0gdnAgKiBoLCAwKTtcbiAgICAgICAgICAgIG1lc2guYWFiYi5zZXRNaW5NYXgobWluLCBtYXgpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUubm9kZS5zZXRMb2NhbFNjYWxlKDEsIDEsIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUubm9kZS5zZXRMb2NhbFBvc2l0aW9uKDAsIDAsIDApO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRBYWJiRnVuYyhudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21lc2hEaXJ0eSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEdldHMgdGhlIG1lc2ggZnJvbSB0aGUgc3ByaXRlIGFzc2V0XG4gICAgLy8gaWYgdGhlIHNwcml0ZSBpcyA5LXNsaWNlZCBvciB0aGUgZGVmYXVsdCBtZXNoIGZyb20gdGhlXG4gICAgLy8gaW1hZ2UgZWxlbWVudCBhbmQgY2FsbHMgX3VwZGF0ZU1lc2ggb3Igc2V0cyBtZXNoRGlydHkgdG8gdHJ1ZVxuICAgIC8vIGlmIHRoZSBjb21wb25lbnQgaXMgY3VycmVudGx5IGJlaW5nIGluaXRpYWxpemVkLiBBbHNvIHVwZGF0ZXNcbiAgICAvLyBhc3BlY3QgcmF0aW8uIFdlIG5lZWQgdG8gY2FsbCBfdXBkYXRlU3ByaXRlIGV2ZXJ5IHRpbWVcbiAgICAvLyBzb21ldGhpbmcgcmVsYXRlZCB0byB0aGUgc3ByaXRlIGFzc2V0IGNoYW5nZXNcbiAgICBfdXBkYXRlU3ByaXRlKCkge1xuICAgICAgICBsZXQgbmluZVNsaWNlID0gZmFsc2U7XG4gICAgICAgIGxldCBtZXNoID0gbnVsbDtcblxuICAgICAgICAvLyByZXNldCB0YXJnZXQgYXNwZWN0IHJhdGlvXG4gICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gLTE7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSAmJiB0aGlzLl9zcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgIC8vIHRha2UgbWVzaCBmcm9tIHNwcml0ZVxuICAgICAgICAgICAgbWVzaCA9IHRoaXMuX3Nwcml0ZS5tZXNoZXNbdGhpcy5zcHJpdGVGcmFtZV07XG4gICAgICAgICAgICBuaW5lU2xpY2UgPSB0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8IHRoaXMuX3Nwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRDtcblxuICAgICAgICAgICAgLy8gcmUtY2FsY3VsYXRlIGFzcGVjdCByYXRpbyBmcm9tIHNwcml0ZSBmcmFtZVxuICAgICAgICAgICAgY29uc3QgZnJhbWVEYXRhID0gdGhpcy5fc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLl9zcHJpdGUuZnJhbWVLZXlzW3RoaXMuX3Nwcml0ZUZyYW1lXV07XG4gICAgICAgICAgICBpZiAoZnJhbWVEYXRhPy5yZWN0LncgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8gPSBmcmFtZURhdGEucmVjdC56IC8gZnJhbWVEYXRhLnJlY3QudztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHdlIHVzZSA5IHNsaWNpbmcgdGhlbiB1c2UgdGhhdCBtZXNoIG90aGVyd2lzZSBrZWVwIHVzaW5nIHRoZSBkZWZhdWx0IG1lc2hcbiAgICAgICAgdGhpcy5tZXNoID0gbmluZVNsaWNlID8gbWVzaCA6IHRoaXMuX2RlZmF1bHRNZXNoO1xuXG4gICAgICAgIHRoaXMucmVmcmVzaE1lc2goKTtcbiAgICB9XG5cbiAgICByZWZyZXNoTWVzaCgpIHtcbiAgICAgICAgaWYgKHRoaXMubWVzaCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9lbGVtZW50Ll9iZWluZ0luaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWVzaCh0aGlzLm1lc2gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlcyBBQUJCIHdoaWxlIDktc2xpY2luZ1xuICAgIF91cGRhdGVBYWJiKGFhYmIpIHtcbiAgICAgICAgYWFiYi5jZW50ZXIuc2V0KDAsIDAsIDApO1xuICAgICAgICBhYWJiLmhhbGZFeHRlbnRzLnNldCh0aGlzLl9vdXRlclNjYWxlLnggKiAwLjUsIHRoaXMuX291dGVyU2NhbGUueSAqIDAuNSwgMC4wMDEpO1xuICAgICAgICBhYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoYWFiYiwgdGhpcy5fcmVuZGVyYWJsZS5ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICByZXR1cm4gYWFiYjtcbiAgICB9XG5cbiAgICBfdG9nZ2xlTWFzaygpIHtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5fZGlydGlmeU1hc2soKTtcblxuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IHRoaXMuX2VsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoc2NyZWVuU3BhY2UpO1xuXG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWFzayghIXRoaXMuX21hc2spO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsTG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLm1hdGVyaWFsID0gYXNzZXQucmVzb3VyY2U7XG4gICAgfVxuXG4gICAgX29uTWF0ZXJpYWxBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uTWF0ZXJpYWxBZGRlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW50aXR5LmVuYWJsZWQpIHJldHVybjsgLy8gZG9uJ3QgYmluZCB1bnRpbCBlbGVtZW50IGlzIGVuYWJsZWRcblxuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uTWF0ZXJpYWxDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1hdGVyaWFsTG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1hdGVyaWFsUmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbENoYW5nZSgpIHtcblxuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsUmVtb3ZlKCkge1xuXG4gICAgfVxuXG4gICAgX29uVGV4dHVyZUFkZGVkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25UZXh0dXJlQWRkZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZFRleHR1cmVBc3NldChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZFRleHR1cmVBc3NldChhc3NldCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VudGl0eS5lbmFibGVkKSByZXR1cm47IC8vIGRvbid0IGJpbmQgdW50aWwgZWxlbWVudCBpcyBlbmFibGVkXG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vblRleHR1cmVMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblRleHR1cmVSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25UZXh0dXJlTG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRUZXh0dXJlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25UZXh0dXJlTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25UZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblRleHR1cmVSZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vblRleHR1cmVMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMudGV4dHVyZSA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vblRleHR1cmVDaGFuZ2UoYXNzZXQpIHtcblxuICAgIH1cblxuICAgIF9vblRleHR1cmVSZW1vdmUoYXNzZXQpIHtcblxuICAgIH1cblxuICAgIC8vIFdoZW4gc3ByaXRlIGFzc2V0IGlzIGFkZGVkIGJpbmQgaXRcbiAgICBfb25TcHJpdGVBc3NldEFkZGVkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLm9mZignYWRkOicgKyBhc3NldC5pZCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0ID09PSBhc3NldC5pZCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZFNwcml0ZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhvb2sgdXAgZXZlbnQgaGFuZGxlcnMgb24gc3ByaXRlIGFzc2V0XG4gICAgX2JpbmRTcHJpdGVBc3NldChhc3NldCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VudGl0eS5lbmFibGVkKSByZXR1cm47IC8vIGRvbid0IGJpbmQgdW50aWwgZWxlbWVudCBpcyBlbmFibGVkXG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vblNwcml0ZUFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vblNwcml0ZUFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uU3ByaXRlQXNzZXRSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kU3ByaXRlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25TcHJpdGVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uU3ByaXRlQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uU3ByaXRlQXNzZXRSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2xvYWQ6JyArIGFzc2V0LmRhdGEudGV4dHVyZUF0bGFzQXNzZXQsIHRoaXMuX29uVGV4dHVyZUF0bGFzTG9hZCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXaGVuIHNwcml0ZSBhc3NldCBpcyBsb2FkZWQgbWFrZSBzdXJlIHRoZSB0ZXh0dXJlIGF0bGFzIGFzc2V0IGlzIGxvYWRlZCB0b29cbiAgICAvLyBJZiBzbyB0aGVuIHNldCB0aGUgc3ByaXRlLCBvdGhlcndpc2Ugd2FpdCBmb3IgdGhlIGF0bGFzIHRvIGJlIGxvYWRlZCBmaXJzdFxuICAgIF9vblNwcml0ZUFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICBpZiAoIWFzc2V0IHx8ICFhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKCFhc3NldC5yZXNvdXJjZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGF0bGFzQXNzZXRJZCA9IGFzc2V0LmRhdGEudGV4dHVyZUF0bGFzQXNzZXQ7XG4gICAgICAgICAgICAgICAgaWYgKGF0bGFzQXNzZXRJZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9mZignbG9hZDonICsgYXRsYXNBc3NldElkLCB0aGlzLl9vblRleHR1cmVBdGxhc0xvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBhc3NldHMub25jZSgnbG9hZDonICsgYXRsYXNBc3NldElkLCB0aGlzLl9vblRleHR1cmVBdGxhc0xvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdoZW4gdGhlIHNwcml0ZSBhc3NldCBjaGFuZ2VzIHJlc2V0IGl0XG4gICAgX29uU3ByaXRlQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIF9vblNwcml0ZUFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgfVxuXG4gICAgLy8gSG9vayB1cCBldmVudCBoYW5kbGVycyBvbiBzcHJpdGUgYXNzZXRcbiAgICBfYmluZFNwcml0ZShzcHJpdGUpIHtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub24oJ3NldDpwaXhlbHNQZXJVbml0JywgdGhpcy5fb25TcHJpdGVQcHVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub24oJ3NldDphdGxhcycsIHRoaXMuX29uQXRsYXNUZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgaWYgKHNwcml0ZS5hdGxhcykge1xuICAgICAgICAgICAgc3ByaXRlLmF0bGFzLm9uKCdzZXQ6dGV4dHVyZScsIHRoaXMuX29uQXRsYXNUZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRTcHJpdGUoc3ByaXRlKSB7XG4gICAgICAgIHNwcml0ZS5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblNwcml0ZU1lc2hlc0NoYW5nZSwgdGhpcyk7XG4gICAgICAgIHNwcml0ZS5vZmYoJ3NldDpwaXhlbHNQZXJVbml0JywgdGhpcy5fb25TcHJpdGVQcHVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6YXRsYXMnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGlmIChzcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgIHNwcml0ZS5hdGxhcy5vZmYoJ3NldDp0ZXh0dXJlJywgdGhpcy5fb25BdGxhc1RleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU3ByaXRlTWVzaGVzQ2hhbmdlKCkge1xuICAgICAgICAvLyBjbGFtcCBmcmFtZVxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9zcHJpdGVGcmFtZSA9IG1hdGguY2xhbXAodGhpcy5fc3ByaXRlRnJhbWUsIDAsIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXMubGVuZ3RoIC0gMSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgdGhpcy5fdXBkYXRlU3ByaXRlKCk7XG4gICAgfVxuXG4gICAgX29uU3ByaXRlUHB1Q2hhbmdlKCkge1xuICAgICAgICAvLyBmb3JjZSB1cGRhdGUgd2hlbiB0aGUgc3ByaXRlIGlzIDktc2xpY2VkLiBJZiBpdCdzIG5vdFxuICAgICAgICAvLyB0aGVuIGl0cyBtZXNoIHdpbGwgY2hhbmdlIHdoZW4gdGhlIHBwdSBjaGFuZ2VzIHdoaWNoIHdpbGxcbiAgICAgICAgLy8gYmUgaGFuZGxlZCBieSBvblNwcml0ZU1lc2hlc0NoYW5nZVxuICAgICAgICBpZiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSAhPT0gU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFICYmIHRoaXMuX3BpeGVsc1BlclVuaXQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIGZvcmNlIHVwZGF0ZVxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlU3ByaXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25BdGxhc1RleHR1cmVDaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiB0aGlzLnNwcml0ZS5hdGxhcyAmJiB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcsIHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2hlbiBhdGxhcyBpcyBsb2FkZWQgdHJ5IHRvIHJlc2V0IHRoZSBzcHJpdGUgYXNzZXRcbiAgICBfb25UZXh0dXJlQXRsYXNMb2FkKGF0bGFzQXNzZXQpIHtcbiAgICAgICAgY29uc3Qgc3ByaXRlQXNzZXQgPSB0aGlzLl9zcHJpdGVBc3NldDtcbiAgICAgICAgaWYgKHNwcml0ZUFzc2V0IGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IF9zcHJpdGVBc3NldCBzaG91bGQgbmV2ZXIgYmUgYW4gYXNzZXQgaW5zdGFuY2U/XG4gICAgICAgICAgICB0aGlzLl9vblNwcml0ZUFzc2V0TG9hZChzcHJpdGVBc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vblNwcml0ZUFzc2V0TG9hZCh0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoc3ByaXRlQXNzZXQpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5fbWF0ZXJpYWxBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX21hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3RleHR1cmVBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX3RleHR1cmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kVGV4dHVyZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3Nwcml0ZUFzc2V0KTtcbiAgICAgICAgICAgIGlmIChhc3NldCAmJiBhc3NldC5yZXNvdXJjZSAhPT0gdGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZFNwcml0ZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VsZW1lbnQuYWRkTW9kZWxUb0xheWVycyh0aGlzLl9yZW5kZXJhYmxlLm1vZGVsKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKHRoaXMuX3JlbmRlcmFibGUubW9kZWwpO1xuICAgIH1cblxuICAgIF9zZXRTdGVuY2lsKHN0ZW5jaWxQYXJhbXMpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2Uuc3RlbmNpbEZyb250ID0gc3RlbmNpbFBhcmFtcztcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2Uuc3RlbmNpbEJhY2sgPSBzdGVuY2lsUGFyYW1zO1xuXG4gICAgICAgIGxldCByZWYgPSAwO1xuICAgICAgICBpZiAodGhpcy5fZWxlbWVudC5tYXNrZWRCeSkge1xuICAgICAgICAgICAgcmVmID0gdGhpcy5fZWxlbWVudC5tYXNrZWRCeS5lbGVtZW50Ll9pbWFnZS5fbWFza1JlZjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZS51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHNwID0gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKHtcbiAgICAgICAgICAgICAgICByZWY6IHJlZiArIDEsXG4gICAgICAgICAgICAgICAgZnVuYzogRlVOQ19FUVVBTCxcbiAgICAgICAgICAgICAgICB6cGFzczogU1RFTkNJTE9QX0RFQ1JFTUVOVFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlLnN0ZW5jaWxGcm9udCA9IHNwO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS51bm1hc2tNZXNoSW5zdGFuY2Uuc3RlbmNpbEJhY2sgPSBzcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldCBjb2xvcih2YWx1ZSkge1xuICAgICAgICBjb25zdCByID0gdmFsdWUucjtcbiAgICAgICAgY29uc3QgZyA9IHZhbHVlLmc7XG4gICAgICAgIGNvbnN0IGIgPSB2YWx1ZS5iO1xuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRoaXMuX2NvbG9yID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgRGVidWcud2FybignU2V0dGluZyBlbGVtZW50LmNvbG9yIHRvIGl0c2VsZiB3aWxsIGhhdmUgbm8gZWZmZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKHRoaXMuX2NvbG9yLnIgIT09IHIgfHwgdGhpcy5fY29sb3IuZyAhPT0gZyB8fCB0aGlzLl9jb2xvci5iICE9PSBiKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5yID0gcjtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmcgPSBnO1xuICAgICAgICAgICAgdGhpcy5fY29sb3IuYiA9IGI7XG5cbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSBnO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gYjtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5maXJlKCdzZXQ6Y29sb3InLCB0aGlzLl9jb2xvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG5cbiAgICBzZXQgb3BhY2l0eSh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2NvbG9yLmEpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmEgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0Om9wYWNpdHknLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb3BhY2l0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yLmE7XG4gICAgfVxuXG4gICAgc2V0IHJlY3QodmFsdWUpIHtcbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodGhpcy5fcmVjdCA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignU2V0dGluZyBlbGVtZW50LnJlY3QgdG8gaXRzZWxmIHdpbGwgaGF2ZSBubyBlZmZlY3QnKTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBsZXQgeCwgeSwgeiwgdztcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVmVjNCkge1xuICAgICAgICAgICAgeCA9IHZhbHVlLng7XG4gICAgICAgICAgICB5ID0gdmFsdWUueTtcbiAgICAgICAgICAgIHogPSB2YWx1ZS56O1xuICAgICAgICAgICAgdyA9IHZhbHVlLnc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB4ID0gdmFsdWVbMF07XG4gICAgICAgICAgICB5ID0gdmFsdWVbMV07XG4gICAgICAgICAgICB6ID0gdmFsdWVbMl07XG4gICAgICAgICAgICB3ID0gdmFsdWVbM107XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoeCA9PT0gdGhpcy5fcmVjdC54ICYmXG4gICAgICAgICAgICB5ID09PSB0aGlzLl9yZWN0LnkgJiZcbiAgICAgICAgICAgIHogPT09IHRoaXMuX3JlY3QueiAmJlxuICAgICAgICAgICAgdyA9PT0gdGhpcy5fcmVjdC53XG4gICAgICAgICkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcmVjdC5zZXQoeCwgeSwgeiwgdyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUubWVzaCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9lbGVtZW50Ll9iZWluZ0luaXRpYWxpemVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWVzaCh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlY3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWN0O1xuICAgIH1cblxuICAgIHNldCBtYXRlcmlhbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgICAgICBpZiAodGhpcy5tYXNrKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBzY3JlZW5TcGFjZSA/IHRoaXMuX3N5c3RlbS5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCA6IHRoaXMuX3N5c3RlbS5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gc2NyZWVuU3BhY2UgPyB0aGlzLl9zeXN0ZW0uZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCA6IHRoaXMuX3N5c3RlbS5kZWZhdWx0SW1hZ2VNYXRlcmlhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRNYXRlcmlhbCh2YWx1ZSk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgbm90IHRoZSBkZWZhdWx0IG1hdGVyaWFsIHRoZW4gY2xlYXIgY29sb3IgYW5kIG9wYWNpdHkgb3ZlcnJpZGVzXG4gICAgICAgICAgICBpZiAodGhpcy5faGFzVXNlck1hdGVyaWFsKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBvdGhlcndpc2UgaWYgd2UgYXJlIGJhY2sgdG8gdGhlIGRlZmF1bHRzIHJlc2V0IHRoZSBjb2xvciBhbmQgb3BhY2l0eVxuICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9jb2xvci5iO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCB0aGlzLl9jb2xvci5hKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIHNldCBtYXRlcmlhbEFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgX2lkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQgIT09IF9pZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX21hdGVyaWFsQXNzZXQsIHRoaXMuX29uTWF0ZXJpYWxBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgX3ByZXYgPSBhc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbENoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbFJlbW92ZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gX2lkO1xuICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fbWF0ZXJpYWxBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uKCdhZGQ6JyArIHRoaXMuX21hdGVyaWFsQXNzZXQsIHRoaXMuX29uTWF0ZXJpYWxBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWxBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsQXNzZXQ7XG4gICAgfVxuXG4gICAgc2V0IHRleHR1cmUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmUgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgY29uc3QgdGV4dHVyZUFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3RleHR1cmVBc3NldCk7XG4gICAgICAgICAgICBpZiAodGV4dHVyZUFzc2V0ICYmIHRleHR1cmVBc3NldC5yZXNvdXJjZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl90ZXh0dXJlID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlKSB7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIHNwcml0ZSBhc3NldCBpZiB0ZXh0dXJlIGlzIHNldFxuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGRlZmF1bHQgdGV4dHVyZSBqdXN0IHVzZXMgZW1pc3NpdmUgYW5kIG9wYWNpdHkgbWFwc1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnLCB0aGlzLl90ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnLCB0aGlzLl90ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9jb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIHRoaXMuX2NvbG9yLmEpO1xuXG4gICAgICAgICAgICAvLyBpZiB0ZXh0dXJlJ3MgYXNwZWN0IHJhdGlvIGNoYW5nZWQgYW5kIHRoZSBlbGVtZW50IG5lZWRzIHRvIHByZXNlcnZlIGFzcGVjdCByYXRpbywgcmVmcmVzaCB0aGUgbWVzaFxuICAgICAgICAgICAgY29uc3QgbmV3QXNwZWN0UmF0aW8gPSB0aGlzLl90ZXh0dXJlLndpZHRoIC8gdGhpcy5fdGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICBpZiAobmV3QXNwZWN0UmF0aW8gIT09IHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8gPSBuZXdBc3BlY3RSYXRpbztcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZWxlbWVudC5maXRNb2RlICE9PSBGSVRNT0RFX1NUUkVUQ0gpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoTWVzaCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNsZWFyIHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuXG4gICAgICAgICAgICAvLyByZXNldCB0YXJnZXQgYXNwZWN0IHJhdGlvIGFuZCByZWZyZXNoIG1lc2ggaWYgdGhlcmUgaXMgYW4gYXNwZWN0IHJhdGlvIHNldHRpbmdcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgbmVlZGVkIGluIG9yZGVyIHRvIHByb3Blcmx5IHJlc2V0IHRoZSBtZXNoIHRvICdzdHJldGNoJyBhY3Jvc3MgdGhlIGVudGlyZSBlbGVtZW50IGJvdW5kc1xuICAgICAgICAgICAgLy8gd2hlbiByZXNldHRpbmcgdGhlIHRleHR1cmVcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gLTE7XG4gICAgICAgICAgICBpZiAodGhpcy5fZWxlbWVudC5maXRNb2RlICE9PSBGSVRNT0RFX1NUUkVUQ0gpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlZnJlc2hNZXNoKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdGV4dHVyZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmU7XG4gICAgfVxuXG4gICAgc2V0IHRleHR1cmVBc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQgIT09IF9pZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fdGV4dHVyZUFzc2V0LCB0aGlzLl9vblRleHR1cmVBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgX3ByZXYgPSBhc3NldHMuZ2V0KHRoaXMuX3RleHR1cmVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKF9wcmV2KSB7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZignbG9hZCcsIHRoaXMuX29uVGV4dHVyZUxvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2NoYW5nZScsIHRoaXMuX29uVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3RleHR1cmVBc3NldCA9IF9pZDtcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl90ZXh0dXJlQXNzZXQsIHRoaXMuX29uVGV4dHVyZUFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kVGV4dHVyZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdGV4dHVyZUFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZUFzc2V0O1xuICAgIH1cblxuICAgIHNldCBzcHJpdGVBc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCAhPT0gX2lkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX3Nwcml0ZUFzc2V0LCB0aGlzLl9vblNwcml0ZUFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKF9wcmV2KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZFNwcml0ZUFzc2V0KF9wcmV2KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUFzc2V0ID0gX2lkO1xuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX3Nwcml0ZUFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uKCdhZGQ6JyArIHRoaXMuX3Nwcml0ZUFzc2V0LCB0aGlzLl9vblNwcml0ZUFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNwcml0ZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5maXJlKCdzZXQ6c3ByaXRlQXNzZXQnLCBfaWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZUFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3ByaXRlQXNzZXQ7XG4gICAgfVxuXG4gICAgc2V0IHNwcml0ZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fc3ByaXRlID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VuYmluZFNwcml0ZSh0aGlzLl9zcHJpdGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBzcHJpdGVBc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICBpZiAoc3ByaXRlQXNzZXQgJiYgc3ByaXRlQXNzZXQucmVzb3VyY2UgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zcHJpdGUgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9iaW5kU3ByaXRlKHRoaXMuX3Nwcml0ZSk7XG5cbiAgICAgICAgICAgIC8vIGNsZWFyIHRleHR1cmUgaWYgc3ByaXRlIGlzIGJlaW5nIHNldFxuICAgICAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUgJiYgdGhpcy5fc3ByaXRlLmF0bGFzICYmIHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlKSB7XG4gICAgICAgICAgICAvLyBkZWZhdWx0IHRleHR1cmUganVzdCB1c2VzIGVtaXNzaXZlIGFuZCBvcGFjaXR5IG1hcHNcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJywgdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcsIHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNsZWFyIHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSBtYXRoLmNsYW1wKHRoaXMuX3Nwcml0ZUZyYW1lLCAwLCB0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlU3ByaXRlKCk7XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZTtcbiAgICB9XG5cbiAgICBzZXQgc3ByaXRlRnJhbWUodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0aGlzLl9zcHJpdGVGcmFtZTtcblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICAvLyBjbGFtcCBmcmFtZVxuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSBtYXRoLmNsYW1wKHZhbHVlLCAwLCB0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSB2YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVGcmFtZSAhPT0gb2xkVmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0OnNwcml0ZUZyYW1lJywgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZUZyYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3ByaXRlRnJhbWU7XG4gICAgfVxuXG4gICAgc2V0IG1lc2godmFsdWUpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRNZXNoKHZhbHVlKTtcbiAgICAgICAgaWYgKHRoaXMuX2RlZmF1bHRNZXNoID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRBYWJiRnVuYyhudWxsKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmModGhpcy5fdXBkYXRlQWFiYkZ1bmMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1lc2goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJhYmxlLm1lc2g7XG4gICAgfVxuXG4gICAgc2V0IG1hc2sodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hc2sgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXNrID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVNYXNrKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFzaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc2s7XG4gICAgfVxuXG4gICAgc2V0IHBpeGVsc1BlclVuaXQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3BpeGVsc1BlclVuaXQgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcGl4ZWxzUGVyVW5pdCA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fc3ByaXRlICYmICh0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8IHRoaXMuX3Nwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBnZXQgcGl4ZWxzUGVyVW5pdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BpeGVsc1BlclVuaXQ7XG4gICAgfVxuXG4gICAgLy8gcHJpdmF0ZVxuICAgIGdldCBhYWJiKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJhYmxlLm1lc2hJbnN0YW5jZS5hYWJiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgSW1hZ2VFbGVtZW50IH07XG4iXSwibmFtZXMiOlsiX3ZlcnRleEZvcm1hdERldmljZUNhY2hlIiwiRGV2aWNlQ2FjaGUiLCJJbWFnZVJlbmRlcmFibGUiLCJjb25zdHJ1Y3RvciIsImVudGl0eSIsIm1lc2giLCJtYXRlcmlhbCIsIl9lbnRpdHkiLCJfZWxlbWVudCIsImVsZW1lbnQiLCJtb2RlbCIsIk1vZGVsIiwibm9kZSIsIkdyYXBoTm9kZSIsImdyYXBoIiwibWVzaEluc3RhbmNlIiwiTWVzaEluc3RhbmNlIiwibmFtZSIsImNhc3RTaGFkb3ciLCJyZWNlaXZlU2hhZG93IiwiX21lc2hEaXJ0eSIsIm1lc2hJbnN0YW5jZXMiLCJwdXNoIiwiYWRkQ2hpbGQiLCJ1bm1hc2tNZXNoSW5zdGFuY2UiLCJkZXN0cm95Iiwic2V0TWF0ZXJpYWwiLCJyZW1vdmVNb2RlbEZyb21MYXllcnMiLCJzZXRNZXNoIiwidmlzaWJsZSIsImZvcmNlVXBkYXRlQWFiYiIsInNldE1hc2siLCJtYXNrIiwicGljayIsInBhcmFtZXRlcnMiLCJzZXRQYXJhbWV0ZXIiLCJkYXRhIiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsImVuYWJsZWQiLCJhZGRNb2RlbFRvTGF5ZXJzIiwidmFsdWUiLCJkZWxldGVQYXJhbWV0ZXIiLCJzZXRVbm1hc2tEcmF3T3JkZXIiLCJnZXRMYXN0Q2hpbGQiLCJlIiwibGFzdCIsImMiLCJjaGlsZHJlbiIsImwiLCJsZW5ndGgiLCJpIiwiY2hpbGQiLCJsYXN0Q2hpbGQiLCJkcmF3T3JkZXIiLCJnZXRNYXNrT2Zmc2V0Iiwic2V0RHJhd09yZGVyIiwic2V0Q3VsbCIsImN1bGwiLCJ2aXNpYmxlRm4iLCJfaXNTY3JlZW5TcGFjZSIsImNhbWVyYSIsImlzVmlzaWJsZUZvckNhbWVyYSIsImlzVmlzaWJsZUZ1bmMiLCJzZXRTY3JlZW5TcGFjZSIsInNjcmVlblNwYWNlIiwic2V0TGF5ZXIiLCJsYXllciIsIl9hYWJiVmVyIiwic2V0QWFiYkZ1bmMiLCJmbiIsIl91cGRhdGVBYWJiRnVuYyIsIkltYWdlRWxlbWVudCIsIl9zeXN0ZW0iLCJzeXN0ZW0iLCJfdGV4dHVyZUFzc2V0IiwiX3RleHR1cmUiLCJfbWF0ZXJpYWxBc3NldCIsIl9tYXRlcmlhbCIsIl9zcHJpdGVBc3NldCIsIl9zcHJpdGUiLCJfc3ByaXRlRnJhbWUiLCJfcGl4ZWxzUGVyVW5pdCIsIl90YXJnZXRBc3BlY3RSYXRpbyIsIl9yZWN0IiwiVmVjNCIsIl9tYXNrIiwiX21hc2tSZWYiLCJfb3V0ZXJTY2FsZSIsIlZlYzIiLCJfb3V0ZXJTY2FsZVVuaWZvcm0iLCJGbG9hdDMyQXJyYXkiLCJfaW5uZXJPZmZzZXQiLCJfaW5uZXJPZmZzZXRVbmlmb3JtIiwiX2F0bGFzUmVjdCIsIl9hdGxhc1JlY3RVbmlmb3JtIiwiX2RlZmF1bHRNZXNoIiwiX2NyZWF0ZU1lc2giLCJfcmVuZGVyYWJsZSIsIl9jb2xvciIsIkNvbG9yIiwiX2NvbG9yVW5pZm9ybSIsIl91cGRhdGVBYWJiIiwiYmluZCIsIl9vblNjcmVlbkNoYW5nZSIsInNjcmVlbiIsIm9uIiwiX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSIsIl9vblNjcmVlblNwYWNlQ2hhbmdlIiwiX29uRHJhd09yZGVyQ2hhbmdlIiwiX29uUmVzb2x1dGlvbkNoYW5nZSIsInRleHR1cmVBc3NldCIsInNwcml0ZUFzc2V0IiwibWF0ZXJpYWxBc3NldCIsIm9mZiIsInJlcyIsIl91cGRhdGVNZXNoIiwiX3VwZGF0ZU1hdGVyaWFsIiwicHJldmlvdXMiLCJvcmRlciIsIm9uY2UiLCJfaGFzVXNlck1hdGVyaWFsIiwiZGVmYXVsdEltYWdlTWF0ZXJpYWxzIiwiX3VzZTlTbGljaW5nIiwic3ByaXRlIiwicmVuZGVyTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwibmluZVNsaWNlZCIsIm5pbmVUaWxlZCIsImdldEltYWdlRWxlbWVudE1hdGVyaWFsIiwiX2lzU2NyZWVuQ3VsbGVkIiwiTEFZRVJfSFVEIiwiTEFZRVJfV09STEQiLCJ3IiwiY2FsY3VsYXRlZFdpZHRoIiwiaCIsImNhbGN1bGF0ZWRIZWlnaHQiLCJyIiwiZGV2aWNlIiwiYXBwIiwiZ3JhcGhpY3NEZXZpY2UiLCJ2ZXJ0ZXhEYXRhIiwieCIsInoiLCJ5IiwidmVydGV4Rm9ybWF0IiwiZ2V0IiwiVmVydGV4Rm9ybWF0Iiwic2VtYW50aWMiLCJTRU1BTlRJQ19QT1NJVElPTiIsImNvbXBvbmVudHMiLCJ0eXBlIiwiVFlQRV9GTE9BVDMyIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwidmVydGV4QnVmZmVyIiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX1NUQVRJQyIsImJ1ZmZlciIsIk1lc2giLCJwcmltaXRpdmUiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJiYXNlIiwiY291bnQiLCJpbmRleGVkIiwiYWFiYiIsInNldE1pbk1heCIsIlZlYzMiLCJaRVJPIiwiZml0TW9kZSIsIkZJVE1PREVfU1RSRVRDSCIsImFjdHVhbFJhdGlvIiwiRklUTU9ERV9DT05UQUlOIiwiRklUTU9ERV9DT1ZFUiIsImZyYW1lRGF0YSIsImF0bGFzIiwiZnJhbWVzIiwiZnJhbWVLZXlzIiwiYm9yZGVyV2lkdGhTY2FsZSIsInJlY3QiLCJib3JkZXJIZWlnaHRTY2FsZSIsInNldCIsImJvcmRlciIsInRleCIsInRleHR1cmUiLCJ3aWR0aCIsImhlaWdodCIsInBwdSIsInBpeGVsc1BlclVuaXQiLCJzY2FsZU11bFgiLCJzY2FsZU11bFkiLCJNYXRoIiwibWF4Iiwic2NhbGVYIiwic2NhbGVZIiwibWF0aCIsImNsYW1wIiwic2V0TG9jYWxTY2FsZSIsInNldExvY2FsUG9zaXRpb24iLCJwaXZvdCIsInZiIiwidmVydGV4RGF0YUYzMiIsImxvY2siLCJocCIsInZwIiwiYXRsYXNUZXh0dXJlV2lkdGgiLCJhdGxhc1RleHR1cmVIZWlnaHQiLCJmcmFtZSIsInVubG9jayIsIm1pbiIsIl91cGRhdGVTcHJpdGUiLCJuaW5lU2xpY2UiLCJtZXNoZXMiLCJzcHJpdGVGcmFtZSIsInJlZnJlc2hNZXNoIiwiX2JlaW5nSW5pdGlhbGl6ZWQiLCJjZW50ZXIiLCJoYWxmRXh0ZW50cyIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsIl90b2dnbGVNYXNrIiwiX2RpcnRpZnlNYXNrIiwiX29uTWF0ZXJpYWxMb2FkIiwiYXNzZXQiLCJyZXNvdXJjZSIsIl9vbk1hdGVyaWFsQWRkZWQiLCJhc3NldHMiLCJpZCIsIl9iaW5kTWF0ZXJpYWxBc3NldCIsIl9vbk1hdGVyaWFsQ2hhbmdlIiwiX29uTWF0ZXJpYWxSZW1vdmUiLCJsb2FkIiwiX3VuYmluZE1hdGVyaWFsQXNzZXQiLCJfb25UZXh0dXJlQWRkZWQiLCJfYmluZFRleHR1cmVBc3NldCIsIl9vblRleHR1cmVMb2FkIiwiX29uVGV4dHVyZUNoYW5nZSIsIl9vblRleHR1cmVSZW1vdmUiLCJfdW5iaW5kVGV4dHVyZUFzc2V0IiwiX29uU3ByaXRlQXNzZXRBZGRlZCIsIl9iaW5kU3ByaXRlQXNzZXQiLCJfb25TcHJpdGVBc3NldExvYWQiLCJfb25TcHJpdGVBc3NldENoYW5nZSIsIl9vblNwcml0ZUFzc2V0UmVtb3ZlIiwiX3VuYmluZFNwcml0ZUFzc2V0IiwidGV4dHVyZUF0bGFzQXNzZXQiLCJfb25UZXh0dXJlQXRsYXNMb2FkIiwiYXRsYXNBc3NldElkIiwiX2JpbmRTcHJpdGUiLCJfb25TcHJpdGVNZXNoZXNDaGFuZ2UiLCJfb25TcHJpdGVQcHVDaGFuZ2UiLCJfb25BdGxhc1RleHR1cmVDaGFuZ2UiLCJfdW5iaW5kU3ByaXRlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIiwiYXRsYXNBc3NldCIsIkFzc2V0Iiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJfc2V0U3RlbmNpbCIsInN0ZW5jaWxQYXJhbXMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInJlZiIsIm1hc2tlZEJ5IiwiX2ltYWdlIiwic3AiLCJTdGVuY2lsUGFyYW1ldGVycyIsImZ1bmMiLCJGVU5DX0VRVUFMIiwienBhc3MiLCJTVEVOQ0lMT1BfREVDUkVNRU5UIiwiY29sb3IiLCJnIiwiYiIsIkRlYnVnIiwid2FybiIsImZpcmUiLCJvcGFjaXR5IiwiYSIsImNvbnNvbGUiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCIsImRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2VNYXRlcmlhbCIsIl9pZCIsIl9wcmV2IiwibmV3QXNwZWN0UmF0aW8iLCJvbGRWYWx1ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBc0NBLE1BQU1BLHdCQUF3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
