/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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

    // Note that when creating a typed array, it's initialized to zeros.
    // Allocate memory for 4 vertices, 8 floats per vertex, 4 bytes per float.
    const vertexData = new ArrayBuffer(4 * 8 * 4);
    const vertexDataF32 = new Float32Array(vertexData);

    // Vertex layout is: PX, PY, PZ, NX, NY, NZ, U, V
    // Since the memory is zeroed, we will only set non-zero elements

    // POS: 0, 0, 0
    vertexDataF32[5] = 1; // NZ
    vertexDataF32[6] = r.x; // U
    vertexDataF32[7] = 1.0 - r.y; // V

    // POS: w, 0, 0
    vertexDataF32[8] = w; // PX
    vertexDataF32[13] = 1; // NZ
    vertexDataF32[14] = r.x + r.z; // U
    vertexDataF32[15] = 1.0 - r.y; // V

    // POS: w, h, 0
    vertexDataF32[16] = w; // PX
    vertexDataF32[17] = h; // PY
    vertexDataF32[21] = 1; // NZ
    vertexDataF32[22] = r.x + r.z; // U
    vertexDataF32[23] = 1.0 - (r.y + r.w); // V

    // POS: 0, h, 0
    vertexDataF32[25] = h; // PY
    vertexDataF32[29] = 1; // NZ
    vertexDataF32[30] = r.x; // U
    vertexDataF32[31] = 1.0 - (r.y + r.w); // V

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

      // Update vertex texture coordinates
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtZWxlbWVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL2VsZW1lbnQvaW1hZ2UtZWxlbWVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQge1xuICAgIEJVRkZFUl9TVEFUSUMsXG4gICAgRlVOQ19FUVVBTCxcbiAgICBQUklNSVRJVkVfVFJJRkFOLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBTVEVOQ0lMT1BfREVDUkVNRU5ULFxuICAgIFRZUEVfRkxPQVQzMlxufSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUl9IVUQsIExBWUVSX1dPUkxELFxuICAgIFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSwgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9zdGVuY2lsLXBhcmFtZXRlcnMuanMnO1xuXG5pbXBvcnQgeyBGSVRNT0RFX1NUUkVUQ0gsIEZJVE1PREVfQ09OVEFJTiwgRklUTU9ERV9DT1ZFUiB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbi8vICNpZiBfREVCVUdcbmNvbnN0IF9kZWJ1Z0xvZ2dpbmcgPSBmYWxzZTtcbi8vICNlbmRpZlxuXG5jbGFzcyBJbWFnZVJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKGVudGl0eSwgbWVzaCwgbWF0ZXJpYWwpIHtcbiAgICAgICAgdGhpcy5fZW50aXR5ID0gZW50aXR5O1xuICAgICAgICB0aGlzLl9lbGVtZW50ID0gZW50aXR5LmVsZW1lbnQ7XG5cbiAgICAgICAgdGhpcy5tb2RlbCA9IG5ldyBNb2RlbCgpO1xuICAgICAgICB0aGlzLm5vZGUgPSBuZXcgR3JhcGhOb2RlKCk7XG4gICAgICAgIHRoaXMubW9kZWwuZ3JhcGggPSB0aGlzLm5vZGU7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgbWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm5hbWUgPSAnSW1hZ2VFbGVtZW50OiAnICsgZW50aXR5Lm5hbWU7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX21lc2hEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubW9kZWwubWVzaEluc3RhbmNlcy5wdXNoKHRoaXMubWVzaEluc3RhbmNlKTtcblxuICAgICAgICB0aGlzLl9lbnRpdHkuYWRkQ2hpbGQodGhpcy5tb2RlbC5ncmFwaCk7XG4gICAgICAgIHRoaXMubW9kZWwuX2VudGl0eSA9IHRoaXMuX2VudGl0eTtcblxuICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5zZXRNYXRlcmlhbChudWxsKTsgLy8gY2xlYXIgbWF0ZXJpYWwgcmVmZXJlbmNlc1xuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5tb2RlbC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICB0aGlzLm5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2ggPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VudGl0eSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBudWxsO1xuICAgIH1cblxuICAgIHNldE1lc2gobWVzaCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA9ICEhbWVzaDtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1lc2ggPSBtZXNoO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZm9yY2VVcGRhdGVBYWJiKCk7XG4gICAgfVxuXG4gICAgc2V0TWFzayhtYXNrKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgdGhpcy5tZXNoSW5zdGFuY2UubWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5uYW1lID0gJ1VubWFzazogJyArIHRoaXMuX2VudGl0eS5uYW1lO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucGljayA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMucHVzaCh0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIC8vIGNvcHkgcGFyYW1ldGVyc1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMubWVzaEluc3RhbmNlLnBhcmFtZXRlcnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIobmFtZSwgdGhpcy5tZXNoSW5zdGFuY2UucGFyYW1ldGVyc1tuYW1lXS5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSB1bm1hc2sgbWVzaCBpbnN0YW5jZSBmcm9tIG1vZGVsXG4gICAgICAgICAgICBjb25zdCBpZHggPSB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuaW5kZXhPZih0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBtb2RlbCB0aGVuIHJlLWFkZCB0byB1cGRhdGUgdG8gY3VycmVudCBtZXNoIGluc3RhbmNlc1xuICAgICAgICBpZiAodGhpcy5fZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fZWxlbWVudC5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuYWRkTW9kZWxUb0xheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldE1hdGVyaWFsKG1hdGVyaWFsKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRQYXJhbWV0ZXIobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihuYW1lLCB2YWx1ZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlbGV0ZVBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0VW5tYXNrRHJhd09yZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZ2V0TGFzdENoaWxkID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGxldCBsYXN0O1xuICAgICAgICAgICAgY29uc3QgYyA9IGUuY2hpbGRyZW47XG4gICAgICAgICAgICBjb25zdCBsID0gYy5sZW5ndGg7XG4gICAgICAgICAgICBpZiAobCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjW2ldLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3QgPSBjW2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFsYXN0KSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gZ2V0TGFzdENoaWxkKGxhc3QpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBsYXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVGhlIHVubWFzayBtZXNoIGluc3RhbmNlIHJlbmRlcnMgaW50byB0aGUgc3RlbmNpbCBidWZmZXJcbiAgICAgICAgLy8gd2l0aCB0aGUgcmVmIG9mIHRoZSBwcmV2aW91cyBtYXNrLiBUaGlzIGVzc2VudGlhbGx5IFwiY2xlYXJzXCJcbiAgICAgICAgLy8gdGhlIG1hc2sgdmFsdWVcbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGhlIHVubWFzayBoYXMgYSBkcmF3T3JkZXIgc2V0IHRvIGJlIG1pZC13YXkgYmV0d2VlbiB0aGUgbGFzdCBjaGlsZCBvZiB0aGVcbiAgICAgICAgLy8gbWFza2VkIGhpZXJhcmNoeSBhbmQgdGhlIG5leHQgY2hpbGQgdG8gYmUgZHJhd24uXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRoZSBvZmZzZXQgaXMgcmVkdWNlZCBieSBhIHNtYWxsIGZyYWN0aW9uIGVhY2ggdGltZSBzbyB0aGF0IGlmIG11bHRpcGxlIG1hc2tzXG4gICAgICAgIC8vIGVuZCBvbiB0aGUgc2FtZSBsYXN0IGNoaWxkIHRoZXkgYXJlIHVubWFza2VkIGluIHRoZSBjb3JyZWN0IG9yZGVyLlxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGxhc3RDaGlsZCA9IGdldExhc3RDaGlsZCh0aGlzLl9lbnRpdHkpO1xuICAgICAgICAgICAgaWYgKGxhc3RDaGlsZCAmJiBsYXN0Q2hpbGQuZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IGxhc3RDaGlsZC5lbGVtZW50LmRyYXdPcmRlciArIGxhc3RDaGlsZC5lbGVtZW50LmdldE1hc2tPZmZzZXQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdGhpcy5tZXNoSW5zdGFuY2UuZHJhd09yZGVyICsgdGhpcy5fZWxlbWVudC5nZXRNYXNrT2Zmc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykgY29uc29sZS5sb2coJ3NldERyYXdPcmRlcjogJywgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UubmFtZSwgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZHJhd09yZGVyKTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0RHJhd09yZGVyKGRyYXdPcmRlcikge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIGNvbnNvbGUubG9nKCdzZXREcmF3T3JkZXI6ICcsIHRoaXMubWVzaEluc3RhbmNlLm5hbWUsIGRyYXdPcmRlcik7XG4gICAgICAgIC8vICNlbmRpZlxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kcmF3T3JkZXIgPSBkcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgc2V0Q3VsbChjdWxsKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7XG5cbiAgICAgICAgbGV0IHZpc2libGVGbiA9IG51bGw7XG4gICAgICAgIGlmIChjdWxsICYmIGVsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKSkge1xuICAgICAgICAgICAgdmlzaWJsZUZuID0gZnVuY3Rpb24gKGNhbWVyYSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlbGVtZW50LmlzVmlzaWJsZUZvckNhbWVyYShjYW1lcmEpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmN1bGwgPSBjdWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5pc1Zpc2libGVGdW5jID0gdmlzaWJsZUZuO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuY3VsbCA9IGN1bGw7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5pc1Zpc2libGVGdW5jID0gdmlzaWJsZUZuO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0U2NyZWVuU3BhY2Uoc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnNjcmVlblNwYWNlID0gc2NyZWVuU3BhY2U7XG5cbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5zY3JlZW5TcGFjZSA9IHNjcmVlblNwYWNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0TGF5ZXIobGF5ZXIpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmxheWVyID0gbGF5ZXI7XG5cbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5sYXllciA9IGxheWVyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yY2VVcGRhdGVBYWJiKG1hc2spIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLl9hYWJiVmVyID0gLTE7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldEFhYmJGdW5jKGZuKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSBmbjtcbiAgICAgICAgaWYgKHRoaXMudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSBmbjtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY2xhc3MgSW1hZ2VFbGVtZW50IHtcbiAgICBjb25zdHJ1Y3RvcihlbGVtZW50KSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgICB0aGlzLl9lbnRpdHkgPSBlbGVtZW50LmVudGl0eTtcbiAgICAgICAgdGhpcy5fc3lzdGVtID0gZWxlbWVudC5zeXN0ZW07XG5cbiAgICAgICAgLy8gcHVibGljXG4gICAgICAgIHRoaXMuX3RleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RleHR1cmUgPSBudWxsO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLl9zcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3Nwcml0ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gMDtcbiAgICAgICAgdGhpcy5fcGl4ZWxzUGVyVW5pdCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gLTE7IC8vIHdpbGwgYmUgc2V0IHdoZW4gYXNzaWduaW5nIHRleHR1cmVzXG5cbiAgICAgICAgdGhpcy5fcmVjdCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpOyAvLyB4LCB5LCB3LCBoXG5cbiAgICAgICAgdGhpcy5fbWFzayA9IGZhbHNlOyAvLyB0aGlzIGltYWdlIGVsZW1lbnQgaXMgYSBtYXNrXG4gICAgICAgIHRoaXMuX21hc2tSZWYgPSAwOyAvLyBpZCB1c2VkIGluIHN0ZW5jaWwgYnVmZmVyIHRvIG1hc2tcblxuICAgICAgICAvLyA5LXNsaWNpbmdcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZSA9IG5ldyBWZWMyKCk7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICAgICAgdGhpcy5faW5uZXJPZmZzZXQgPSBuZXcgVmVjNCgpO1xuICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9hdGxhc1JlY3QgPSBuZXcgVmVjNCgpO1xuICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcblxuICAgICAgICB0aGlzLl9kZWZhdWx0TWVzaCA9IHRoaXMuX2NyZWF0ZU1lc2goKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZSA9IG5ldyBJbWFnZVJlbmRlcmFibGUodGhpcy5fZW50aXR5LCB0aGlzLl9kZWZhdWx0TWVzaCwgdGhpcy5fbWF0ZXJpYWwpO1xuXG4gICAgICAgIC8vIHNldCBkZWZhdWx0IGNvbG9yc1xuICAgICAgICB0aGlzLl9jb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheShbMSwgMSwgMV0pO1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIDEpO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZUFhYmJGdW5jID0gdGhpcy5fdXBkYXRlQWFiYi5iaW5kKHRoaXMpO1xuXG4gICAgICAgIC8vIGluaXRpYWxpemUgYmFzZWQgb24gc2NyZWVuXG4gICAgICAgIHRoaXMuX29uU2NyZWVuQ2hhbmdlKHRoaXMuX2VsZW1lbnQuc2NyZWVuKTtcblxuICAgICAgICAvLyBsaXN0ZW4gZm9yIGV2ZW50c1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdyZXNpemUnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzZXQ6cGl2b3QnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzY3JlZW46c2V0OnNjcmVlbnNwYWNlJywgdGhpcy5fb25TY3JlZW5TcGFjZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NldDpzY3JlZW4nLCB0aGlzLl9vblNjcmVlbkNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NldDpkcmF3b3JkZXInLCB0aGlzLl9vbkRyYXdPcmRlckNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub24oJ3NjcmVlbjpzZXQ6cmVzb2x1dGlvbicsIHRoaXMuX29uUmVzb2x1dGlvbkNoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgLy8gcmVzZXQgYWxsIGFzc2V0cyB0byB1bmJpbmQgYWxsIGFzc2V0IGV2ZW50c1xuICAgICAgICB0aGlzLnRleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLm1hdGVyaWFsQXNzZXQgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWVzaCh0aGlzLl9kZWZhdWx0TWVzaCk7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLl9kZWZhdWx0TWVzaCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3Jlc2l6ZScsIHRoaXMuX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzZXQ6cGl2b3QnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2NyZWVuOnNldDpzY3JlZW5zcGFjZScsIHRoaXMuX29uU2NyZWVuU3BhY2VDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2V0OnNjcmVlbicsIHRoaXMuX29uU2NyZWVuQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NldDpkcmF3b3JkZXInLCB0aGlzLl9vbkRyYXdPcmRlckNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzY3JlZW46c2V0OnJlc29sdXRpb24nLCB0aGlzLl9vblJlc29sdXRpb25DaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vblJlc29sdXRpb25DaGFuZ2UocmVzKSB7XG4gICAgfVxuXG4gICAgX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUubWVzaCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWVzaCh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2NyZWVuU3BhY2VDaGFuZ2UodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwodmFsdWUpO1xuICAgIH1cblxuICAgIF9vblNjcmVlbkNoYW5nZShzY3JlZW4sIHByZXZpb3VzKSB7XG4gICAgICAgIGlmIChzY3JlZW4pIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbChmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25EcmF3T3JkZXJDaGFuZ2Uob3JkZXIpIHtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXREcmF3T3JkZXIob3JkZXIpO1xuXG4gICAgICAgIGlmICh0aGlzLm1hc2sgJiYgdGhpcy5fZWxlbWVudC5zY3JlZW4pIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuc2NyZWVuLnNjcmVlbi5vbmNlKCdzeW5jZHJhd29yZGVyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0VW5tYXNrRHJhd09yZGVyKCk7XG4gICAgICAgICAgICB9LCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJldHVybnMgdHJ1ZSBpZiB3ZSBhcmUgdXNpbmcgYSBtYXRlcmlhbFxuICAgIC8vIG90aGVyIHRoYW4gdGhlIGRlZmF1bHQgbWF0ZXJpYWxzXG4gICAgX2hhc1VzZXJNYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5fbWF0ZXJpYWxBc3NldCB8fFxuICAgICAgICAgICAgICAgKCEhdGhpcy5fbWF0ZXJpYWwgJiZcbiAgICAgICAgICAgICAgICB0aGlzLl9zeXN0ZW0uZGVmYXVsdEltYWdlTWF0ZXJpYWxzLmluZGV4T2YodGhpcy5fbWF0ZXJpYWwpID09PSAtMSk7XG4gICAgfVxuXG4gICAgX3VzZTlTbGljaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKSB7XG4gICAgICAgIGNvbnN0IG1hc2sgPSAhIXRoaXMuX21hc2s7XG4gICAgICAgIGNvbnN0IG5pbmVTbGljZWQgPSAhISh0aGlzLnNwcml0ZSAmJiB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpO1xuICAgICAgICBjb25zdCBuaW5lVGlsZWQgPSAhISh0aGlzLnNwcml0ZSAmJiB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9oYXNVc2VyTWF0ZXJpYWwoKSkge1xuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSB0aGlzLl9zeXN0ZW0uZ2V0SW1hZ2VFbGVtZW50TWF0ZXJpYWwoc2NyZWVuU3BhY2UsIG1hc2ssIG5pbmVTbGljZWQsIG5pbmVUaWxlZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkge1xuICAgICAgICAgICAgLy8gY3VsbGluZyBpcyBhbHdheXMgdHJ1ZSBmb3Igbm9uLXNjcmVlbnNwYWNlIChmcnVzdHJ1bSBpcyB1c2VkKTsgZm9yIHNjcmVlbnNwYWNlLCB1c2UgdGhlICdjdWxsJyBwcm9wZXJ0eVxuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRDdWxsKCF0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCkgfHwgdGhpcy5fZWxlbWVudC5faXNTY3JlZW5DdWxsZWQoKSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1hdGVyaWFsKHRoaXMuX21hdGVyaWFsKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0U2NyZWVuU3BhY2Uoc2NyZWVuU3BhY2UpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRMYXllcihzY3JlZW5TcGFjZSA/IExBWUVSX0hVRCA6IExBWUVSX1dPUkxEKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGJ1aWxkIGEgcXVhZCBmb3IgdGhlIGltYWdlXG4gICAgX2NyZWF0ZU1lc2goKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9lbGVtZW50O1xuICAgICAgICBjb25zdCB3ID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgIGNvbnN0IGggPSBlbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgciA9IHRoaXMuX3JlY3Q7XG5cbiAgICAgICAgLy8gTm90ZSB0aGF0IHdoZW4gY3JlYXRpbmcgYSB0eXBlZCBhcnJheSwgaXQncyBpbml0aWFsaXplZCB0byB6ZXJvcy5cbiAgICAgICAgLy8gQWxsb2NhdGUgbWVtb3J5IGZvciA0IHZlcnRpY2VzLCA4IGZsb2F0cyBwZXIgdmVydGV4LCA0IGJ5dGVzIHBlciBmbG9hdC5cbiAgICAgICAgY29uc3QgdmVydGV4RGF0YSA9IG5ldyBBcnJheUJ1ZmZlcig0ICogOCAqIDQpO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhEYXRhRjMyID0gbmV3IEZsb2F0MzJBcnJheSh2ZXJ0ZXhEYXRhKTtcblxuICAgICAgICAvLyBWZXJ0ZXggbGF5b3V0IGlzOiBQWCwgUFksIFBaLCBOWCwgTlksIE5aLCBVLCBWXG4gICAgICAgIC8vIFNpbmNlIHRoZSBtZW1vcnkgaXMgemVyb2VkLCB3ZSB3aWxsIG9ubHkgc2V0IG5vbi16ZXJvIGVsZW1lbnRzXG5cbiAgICAgICAgLy8gUE9TOiAwLCAwLCAwXG4gICAgICAgIHZlcnRleERhdGFGMzJbNV0gPSAxOyAgICAgICAgICAvLyBOWlxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzZdID0gci54OyAgICAgICAgLy8gVVxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzddID0gMS4wIC0gci55OyAgLy8gVlxuXG4gICAgICAgIC8vIFBPUzogdywgMCwgMFxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzhdID0gdzsgICAgICAgICAgLy8gUFhcbiAgICAgICAgdmVydGV4RGF0YUYzMlsxM10gPSAxOyAgICAgICAgIC8vIE5aXG4gICAgICAgIHZlcnRleERhdGFGMzJbMTRdID0gci54ICsgci56OyAvLyBVXG4gICAgICAgIHZlcnRleERhdGFGMzJbMTVdID0gMS4wIC0gci55OyAvLyBWXG5cbiAgICAgICAgLy8gUE9TOiB3LCBoLCAwXG4gICAgICAgIHZlcnRleERhdGFGMzJbMTZdID0gdzsgICAgICAgICAvLyBQWFxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE3XSA9IGg7ICAgICAgICAgLy8gUFlcbiAgICAgICAgdmVydGV4RGF0YUYzMlsyMV0gPSAxOyAgICAgICAgIC8vIE5aXG4gICAgICAgIHZlcnRleERhdGFGMzJbMjJdID0gci54ICsgci56OyAvLyBVXG4gICAgICAgIHZlcnRleERhdGFGMzJbMjNdID0gMS4wIC0gKHIueSArIHIudyk7IC8vIFZcblxuICAgICAgICAvLyBQT1M6IDAsIGgsIDBcbiAgICAgICAgdmVydGV4RGF0YUYzMlsyNV0gPSBoOyAgICAgICAgIC8vIFBZXG4gICAgICAgIHZlcnRleERhdGFGMzJbMjldID0gMTsgICAgICAgICAvLyBOWlxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMwXSA9IHIueDsgICAgICAgLy8gVVxuICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMxXSA9IDEuMCAtIChyLnkgKyByLncpOyAvLyBWXG5cbiAgICAgICAgY29uc3QgdmVydGV4RGVzYyA9IFtcbiAgICAgICAgICAgIHsgc2VtYW50aWM6IFNFTUFOVElDX1BPU0lUSU9OLCBjb21wb25lbnRzOiAzLCB0eXBlOiBUWVBFX0ZMT0FUMzIgfSxcbiAgICAgICAgICAgIHsgc2VtYW50aWM6IFNFTUFOVElDX05PUk1BTCwgY29tcG9uZW50czogMywgdHlwZTogVFlQRV9GTE9BVDMyIH0sXG4gICAgICAgICAgICB7IHNlbWFudGljOiBTRU1BTlRJQ19URVhDT09SRDAsIGNvbXBvbmVudHM6IDIsIHR5cGU6IFRZUEVfRkxPQVQzMiB9XG4gICAgICAgIF07XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5fc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3QgdmVydGV4Rm9ybWF0ID0gbmV3IFZlcnRleEZvcm1hdChkZXZpY2UsIHZlcnRleERlc2MpO1xuICAgICAgICBjb25zdCB2ZXJ0ZXhCdWZmZXIgPSBuZXcgVmVydGV4QnVmZmVyKGRldmljZSwgdmVydGV4Rm9ybWF0LCA0LCBCVUZGRVJfU1RBVElDLCB2ZXJ0ZXhEYXRhKTtcblxuICAgICAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICAgICAgbWVzaC52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLnR5cGUgPSBQUklNSVRJVkVfVFJJRkFOO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5iYXNlID0gMDtcbiAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uY291bnQgPSA0O1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5pbmRleGVkID0gZmFsc2U7XG4gICAgICAgIG1lc2guYWFiYi5zZXRNaW5NYXgoVmVjMy5aRVJPLCBuZXcgVmVjMyh3LCBoLCAwKSk7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlTWVzaChtZXNoKTtcblxuICAgICAgICByZXR1cm4gbWVzaDtcbiAgICB9XG5cbiAgICBfdXBkYXRlTWVzaChtZXNoKSB7XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9lbGVtZW50O1xuICAgICAgICBsZXQgdyA9IGVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoO1xuICAgICAgICBsZXQgaCA9IGVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodDtcblxuICAgICAgICBpZiAoZWxlbWVudC5maXRNb2RlICE9PSBGSVRNT0RFX1NUUkVUQ0ggJiYgdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8gPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBhY3R1YWxSYXRpbyA9IGVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoIC8gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuICAgICAgICAgICAgLy8gY2hlY2sgd2hpY2ggY29vcmRpbmF0ZSBtdXN0IGNoYW5nZSBpbiBvcmRlciB0byBwcmVzZXJ2ZSB0aGUgc291cmNlIGFzcGVjdCByYXRpb1xuICAgICAgICAgICAgaWYgKChlbGVtZW50LmZpdE1vZGUgPT09IEZJVE1PREVfQ09OVEFJTiAmJiBhY3R1YWxSYXRpbyA+IHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvKSB8fFxuICAgICAgICAgICAgICAgIChlbGVtZW50LmZpdE1vZGUgPT09IEZJVE1PREVfQ09WRVIgJiYgYWN0dWFsUmF0aW8gPCB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbykpIHtcbiAgICAgICAgICAgICAgICAvLyB1c2UgJ2hlaWdodCcgdG8gcmUtY2FsY3VsYXRlIHdpZHRoXG4gICAgICAgICAgICAgICAgdyA9IGVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodCAqIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB1c2UgJ3dpZHRoJyB0byByZS1jYWxjdWxhdGUgaGVpZ2h0XG4gICAgICAgICAgICAgICAgaCA9IGVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoIC8gdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW87XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgbWF0ZXJpYWxcbiAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSBlbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKTtcblxuICAgICAgICAvLyBmb3JjZSB1cGRhdGUgbWVzaEluc3RhbmNlIGFhYmJcbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUpIHRoaXMuX3JlbmRlcmFibGUuZm9yY2VVcGRhdGVBYWJiKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpKSB7XG5cbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBpbm5lciBvZmZzZXQgZnJvbSB0aGUgZnJhbWUncyBib3JkZXJcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lRGF0YSA9IHRoaXMuX3Nwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5fc3ByaXRlLmZyYW1lS2V5c1t0aGlzLl9zcHJpdGVGcmFtZV1dO1xuICAgICAgICAgICAgY29uc3QgYm9yZGVyV2lkdGhTY2FsZSA9IDIgLyBmcmFtZURhdGEucmVjdC56O1xuICAgICAgICAgICAgY29uc3QgYm9yZGVySGVpZ2h0U2NhbGUgPSAyIC8gZnJhbWVEYXRhLnJlY3QudztcblxuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXQuc2V0KFxuICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueCAqIGJvcmRlcldpZHRoU2NhbGUsXG4gICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci55ICogYm9yZGVySGVpZ2h0U2NhbGUsXG4gICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci56ICogYm9yZGVyV2lkdGhTY2FsZSxcbiAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLncgKiBib3JkZXJIZWlnaHRTY2FsZVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgY29uc3QgdGV4ID0gdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZTtcbiAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdC5zZXQoZnJhbWVEYXRhLnJlY3QueCAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueSAvIHRleC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LnogLyB0ZXgud2lkdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LncgLyB0ZXguaGVpZ2h0KTtcblxuICAgICAgICAgICAgLy8gc2NhbGU6IGFwcGx5IFBQVVxuICAgICAgICAgICAgY29uc3QgcHB1ID0gdGhpcy5fcGl4ZWxzUGVyVW5pdCAhPT0gbnVsbCA/IHRoaXMuX3BpeGVsc1BlclVuaXQgOiB0aGlzLnNwcml0ZS5waXhlbHNQZXJVbml0O1xuICAgICAgICAgICAgY29uc3Qgc2NhbGVNdWxYID0gZnJhbWVEYXRhLnJlY3QueiAvIHBwdTtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlTXVsWSA9IGZyYW1lRGF0YS5yZWN0LncgLyBwcHU7XG5cbiAgICAgICAgICAgIC8vIHNjYWxlIGJvcmRlcnMgaWYgbmVjZXNzYXJ5IGluc3RlYWQgb2Ygb3ZlcmxhcHBpbmdcbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUuc2V0KE1hdGgubWF4KHcsIHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCBNYXRoLm1heChoLCB0aGlzLl9pbm5lck9mZnNldC55ICogc2NhbGVNdWxZKSk7XG5cbiAgICAgICAgICAgIGxldCBzY2FsZVggPSBzY2FsZU11bFg7XG4gICAgICAgICAgICBsZXQgc2NhbGVZID0gc2NhbGVNdWxZO1xuXG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnggLz0gc2NhbGVNdWxYO1xuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS55IC89IHNjYWxlTXVsWTtcblxuICAgICAgICAgICAgLy8gc2NhbGU6IHNocmlua2luZyBiZWxvdyAxXG4gICAgICAgICAgICBzY2FsZVggKj0gbWF0aC5jbGFtcCh3IC8gKHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCAwLjAwMDEsIDEpO1xuICAgICAgICAgICAgc2NhbGVZICo9IG1hdGguY2xhbXAoaCAvICh0aGlzLl9pbm5lck9mZnNldC55ICogc2NhbGVNdWxZKSwgMC4wMDAxLCAxKTtcblxuICAgICAgICAgICAgLy8gc2V0IHNjYWxlXG4gICAgICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVswXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lng7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzFdID0gdGhpcy5faW5uZXJPZmZzZXQueTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMl0gPSB0aGlzLl9pbm5lck9mZnNldC56O1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVszXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lnc7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ2lubmVyT2Zmc2V0JywgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzBdID0gdGhpcy5fYXRsYXNSZWN0Lng7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsxXSA9IHRoaXMuX2F0bGFzUmVjdC55O1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bMl0gPSB0aGlzLl9hdGxhc1JlY3QuejtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzNdID0gdGhpcy5fYXRsYXNSZWN0Lnc7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ2F0bGFzUmVjdCcsIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtWzBdID0gdGhpcy5fb3V0ZXJTY2FsZS54O1xuICAgICAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtWzFdID0gdGhpcy5fb3V0ZXJTY2FsZS55O1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdvdXRlclNjYWxlJywgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmModGhpcy5fdXBkYXRlQWFiYkZ1bmMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5ub2RlLnNldExvY2FsU2NhbGUoc2NhbGVYLCBzY2FsZVksIDEpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUubm9kZS5zZXRMb2NhbFBvc2l0aW9uKCgwLjUgLSBlbGVtZW50LnBpdm90LngpICogdywgKDAuNSAtIGVsZW1lbnQucGl2b3QueSkgKiBoLCAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHZiID0gbWVzaC52ZXJ0ZXhCdWZmZXI7XG4gICAgICAgICAgICBjb25zdCB2ZXJ0ZXhEYXRhRjMyID0gbmV3IEZsb2F0MzJBcnJheSh2Yi5sb2NrKCkpO1xuXG4gICAgICAgICAgICAvLyBvZmZzZXQgZm9yIHBpdm90XG4gICAgICAgICAgICBjb25zdCBocCA9IGVsZW1lbnQucGl2b3QueDtcbiAgICAgICAgICAgIGNvbnN0IHZwID0gZWxlbWVudC5waXZvdC55O1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgdmVydGV4IHBvc2l0aW9ucywgYWNjb3VudGluZyBmb3IgdGhlIHBpdm90IG9mZnNldFxuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlswXSA9IDAgLSBocCAqIHc7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzFdID0gMCAtIHZwICogaDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbOF0gPSB3IC0gaHAgKiB3O1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls5XSA9IDAgLSB2cCAqIGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE2XSA9IHcgLSBocCAqIHc7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE3XSA9IGggLSB2cCAqIGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzI0XSA9IDAgLSBocCAqIHc7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzI1XSA9IGggLSB2cCAqIGg7XG5cblxuICAgICAgICAgICAgbGV0IGF0bGFzVGV4dHVyZVdpZHRoID0gMTtcbiAgICAgICAgICAgIGxldCBhdGxhc1RleHR1cmVIZWlnaHQgPSAxO1xuICAgICAgICAgICAgbGV0IHJlY3QgPSB0aGlzLl9yZWN0O1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fc3ByaXRlICYmIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXNbdGhpcy5fc3ByaXRlRnJhbWVdICYmIHRoaXMuX3Nwcml0ZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZyYW1lID0gdGhpcy5fc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLl9zcHJpdGUuZnJhbWVLZXlzW3RoaXMuX3Nwcml0ZUZyYW1lXV07XG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlY3QgPSBmcmFtZS5yZWN0O1xuICAgICAgICAgICAgICAgICAgICBhdGxhc1RleHR1cmVXaWR0aCA9IHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlLndpZHRoO1xuICAgICAgICAgICAgICAgICAgICBhdGxhc1RleHR1cmVIZWlnaHQgPSB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBVcGRhdGUgdmVydGV4IHRleHR1cmUgY29vcmRpbmF0ZXNcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbNl0gPSByZWN0LnggLyBhdGxhc1RleHR1cmVXaWR0aDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbN10gPSAxLjAgLSByZWN0LnkgLyBhdGxhc1RleHR1cmVIZWlnaHQ7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE0XSA9IChyZWN0LnggKyByZWN0LnopIC8gYXRsYXNUZXh0dXJlV2lkdGg7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzE1XSA9IDEuMCAtIHJlY3QueSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjJdID0gKHJlY3QueCArIHJlY3QueikgLyBhdGxhc1RleHR1cmVXaWR0aDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjNdID0gMS4wIC0gKHJlY3QueSArIHJlY3QudykgLyBhdGxhc1RleHR1cmVIZWlnaHQ7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMwXSA9IHJlY3QueCAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlszMV0gPSAxLjAgLSAocmVjdC55ICsgcmVjdC53KSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcblxuICAgICAgICAgICAgdmIudW5sb2NrKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pbiA9IG5ldyBWZWMzKDAgLSBocCAqIHcsIDAgLSB2cCAqIGgsIDApO1xuICAgICAgICAgICAgY29uc3QgbWF4ID0gbmV3IFZlYzModyAtIGhwICogdywgaCAtIHZwICogaCwgMCk7XG4gICAgICAgICAgICBtZXNoLmFhYmIuc2V0TWluTWF4KG1pbiwgbWF4KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxTY2FsZSgxLCAxLCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxQb3NpdGlvbigwLCAwLCAwKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmMobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tZXNoRGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBHZXRzIHRoZSBtZXNoIGZyb20gdGhlIHNwcml0ZSBhc3NldFxuICAgIC8vIGlmIHRoZSBzcHJpdGUgaXMgOS1zbGljZWQgb3IgdGhlIGRlZmF1bHQgbWVzaCBmcm9tIHRoZVxuICAgIC8vIGltYWdlIGVsZW1lbnQgYW5kIGNhbGxzIF91cGRhdGVNZXNoIG9yIHNldHMgbWVzaERpcnR5IHRvIHRydWVcbiAgICAvLyBpZiB0aGUgY29tcG9uZW50IGlzIGN1cnJlbnRseSBiZWluZyBpbml0aWFsaXplZC4gQWxzbyB1cGRhdGVzXG4gICAgLy8gYXNwZWN0IHJhdGlvLiBXZSBuZWVkIHRvIGNhbGwgX3VwZGF0ZVNwcml0ZSBldmVyeSB0aW1lXG4gICAgLy8gc29tZXRoaW5nIHJlbGF0ZWQgdG8gdGhlIHNwcml0ZSBhc3NldCBjaGFuZ2VzXG4gICAgX3VwZGF0ZVNwcml0ZSgpIHtcbiAgICAgICAgbGV0IG5pbmVTbGljZSA9IGZhbHNlO1xuICAgICAgICBsZXQgbWVzaCA9IG51bGw7XG5cbiAgICAgICAgLy8gcmVzZXQgdGFyZ2V0IGFzcGVjdCByYXRpb1xuICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IC0xO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUgJiYgdGhpcy5fc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICAvLyB0YWtlIG1lc2ggZnJvbSBzcHJpdGVcbiAgICAgICAgICAgIG1lc2ggPSB0aGlzLl9zcHJpdGUubWVzaGVzW3RoaXMuc3ByaXRlRnJhbWVdO1xuICAgICAgICAgICAgbmluZVNsaWNlID0gdGhpcy5fc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQ7XG5cbiAgICAgICAgICAgIC8vIHJlLWNhbGN1bGF0ZSBhc3BlY3QgcmF0aW8gZnJvbSBzcHJpdGUgZnJhbWVcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lRGF0YSA9IHRoaXMuX3Nwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5fc3ByaXRlLmZyYW1lS2V5c1t0aGlzLl9zcHJpdGVGcmFtZV1dO1xuICAgICAgICAgICAgaWYgKGZyYW1lRGF0YT8ucmVjdC53ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gZnJhbWVEYXRhLnJlY3QueiAvIGZyYW1lRGF0YS5yZWN0Lnc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB3ZSB1c2UgOSBzbGljaW5nIHRoZW4gdXNlIHRoYXQgbWVzaCBvdGhlcndpc2Uga2VlcCB1c2luZyB0aGUgZGVmYXVsdCBtZXNoXG4gICAgICAgIHRoaXMubWVzaCA9IG5pbmVTbGljZSA/IG1lc2ggOiB0aGlzLl9kZWZhdWx0TWVzaDtcblxuICAgICAgICB0aGlzLnJlZnJlc2hNZXNoKCk7XG4gICAgfVxuXG4gICAgcmVmcmVzaE1lc2goKSB7XG4gICAgICAgIGlmICh0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZWxlbWVudC5fYmVpbmdJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5tZXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVwZGF0ZXMgQUFCQiB3aGlsZSA5LXNsaWNpbmdcbiAgICBfdXBkYXRlQWFiYihhYWJiKSB7XG4gICAgICAgIGFhYmIuY2VudGVyLnNldCgwLCAwLCAwKTtcbiAgICAgICAgYWFiYi5oYWxmRXh0ZW50cy5zZXQodGhpcy5fb3V0ZXJTY2FsZS54ICogMC41LCB0aGlzLl9vdXRlclNjYWxlLnkgKiAwLjUsIDAuMDAxKTtcbiAgICAgICAgYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGFhYmIsIHRoaXMuX3JlbmRlcmFibGUubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgcmV0dXJuIGFhYmI7XG4gICAgfVxuXG4gICAgX3RvZ2dsZU1hc2soKSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQuX2RpcnRpZnlNYXNrKCk7XG5cbiAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKTtcblxuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1hc2soISF0aGlzLl9tYXNrKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsQWRkZWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VudGl0eS5lbmFibGVkKSByZXR1cm47IC8vIGRvbid0IGJpbmQgdW50aWwgZWxlbWVudCBpcyBlbmFibGVkXG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uTWF0ZXJpYWxDaGFuZ2UoKSB7XG5cbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFJlbW92ZSgpIHtcblxuICAgIH1cblxuICAgIF9vblRleHR1cmVBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uVGV4dHVyZUFkZGVkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRUZXh0dXJlQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2JpbmRUZXh0dXJlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbnRpdHkuZW5hYmxlZCkgcmV0dXJuOyAvLyBkb24ndCBiaW5kIHVudGlsIGVsZW1lbnQgaXMgZW5hYmxlZFxuXG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25UZXh0dXJlTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vblRleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uVGV4dHVyZUxvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kVGV4dHVyZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uVGV4dHVyZUxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25UZXh0dXJlTG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLnRleHR1cmUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICB9XG5cbiAgICBfb25UZXh0dXJlQ2hhbmdlKGFzc2V0KSB7XG5cbiAgICB9XG5cbiAgICBfb25UZXh0dXJlUmVtb3ZlKGFzc2V0KSB7XG5cbiAgICB9XG5cbiAgICAvLyBXaGVuIHNwcml0ZSBhc3NldCBpcyBhZGRlZCBiaW5kIGl0XG4gICAgX29uU3ByaXRlQXNzZXRBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uU3ByaXRlQXNzZXRBZGRlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIb29rIHVwIGV2ZW50IGhhbmRsZXJzIG9uIHNwcml0ZSBhc3NldFxuICAgIF9iaW5kU3ByaXRlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbnRpdHkuZW5hYmxlZCkgcmV0dXJuOyAvLyBkb24ndCBiaW5kIHVudGlsIGVsZW1lbnQgaXMgZW5hYmxlZFxuXG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25TcHJpdGVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25TcHJpdGVBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblNwcml0ZUFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZFNwcml0ZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblNwcml0ZUFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblNwcml0ZUFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQuZGF0YS50ZXh0dXJlQXRsYXNBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdsb2FkOicgKyBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0LCB0aGlzLl9vblRleHR1cmVBdGxhc0xvYWQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2hlbiBzcHJpdGUgYXNzZXQgaXMgbG9hZGVkIG1ha2Ugc3VyZSB0aGUgdGV4dHVyZSBhdGxhcyBhc3NldCBpcyBsb2FkZWQgdG9vXG4gICAgLy8gSWYgc28gdGhlbiBzZXQgdGhlIHNwcml0ZSwgb3RoZXJ3aXNlIHdhaXQgZm9yIHRoZSBhdGxhcyB0byBiZSBsb2FkZWQgZmlyc3RcbiAgICBfb25TcHJpdGVBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCFhc3NldCB8fCAhYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghYXNzZXQucmVzb3VyY2UuYXRsYXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdGxhc0Fzc2V0SWQgPSBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0O1xuICAgICAgICAgICAgICAgIGlmIChhdGxhc0Fzc2V0SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2xvYWQ6JyArIGF0bGFzQXNzZXRJZCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2xvYWQ6JyArIGF0bGFzQXNzZXRJZCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXaGVuIHRoZSBzcHJpdGUgYXNzZXQgY2hhbmdlcyByZXNldCBpdFxuICAgIF9vblNwcml0ZUFzc2V0Q2hhbmdlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25TcHJpdGVBc3NldFJlbW92ZShhc3NldCkge1xuICAgIH1cblxuICAgIC8vIEhvb2sgdXAgZXZlbnQgaGFuZGxlcnMgb24gc3ByaXRlIGFzc2V0XG4gICAgX2JpbmRTcHJpdGUoc3ByaXRlKSB7XG4gICAgICAgIHNwcml0ZS5vbignc2V0Om1lc2hlcycsIHRoaXMuX29uU3ByaXRlTWVzaGVzQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6cGl4ZWxzUGVyVW5pdCcsIHRoaXMuX29uU3ByaXRlUHB1Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6YXRsYXMnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGlmIChzcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgIHNwcml0ZS5hdGxhcy5vbignc2V0OnRleHR1cmUnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kU3ByaXRlKHNwcml0ZSkge1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6cGl4ZWxzUGVyVW5pdCcsIHRoaXMuX29uU3ByaXRlUHB1Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9mZignc2V0OmF0bGFzJywgdGhpcy5fb25BdGxhc1RleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBpZiAoc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICBzcHJpdGUuYXRsYXMub2ZmKCdzZXQ6dGV4dHVyZScsIHRoaXMuX29uQXRsYXNUZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNwcml0ZU1lc2hlc0NoYW5nZSgpIHtcbiAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSBtYXRoLmNsYW1wKHRoaXMuX3Nwcml0ZUZyYW1lLCAwLCB0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yY2UgdXBkYXRlXG4gICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgIH1cblxuICAgIF9vblNwcml0ZVBwdUNoYW5nZSgpIHtcbiAgICAgICAgLy8gZm9yY2UgdXBkYXRlIHdoZW4gdGhlIHNwcml0ZSBpcyA5LXNsaWNlZC4gSWYgaXQncyBub3RcbiAgICAgICAgLy8gdGhlbiBpdHMgbWVzaCB3aWxsIGNoYW5nZSB3aGVuIHRoZSBwcHUgY2hhbmdlcyB3aGljaCB3aWxsXG4gICAgICAgIC8vIGJlIGhhbmRsZWQgYnkgb25TcHJpdGVNZXNoZXNDaGFuZ2VcbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgIT09IFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSAmJiB0aGlzLl9waXhlbHNQZXJVbml0ID09PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uQXRsYXNUZXh0dXJlQ2hhbmdlKCkge1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgdGhpcy5zcHJpdGUuYXRsYXMgJiYgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJywgdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdoZW4gYXRsYXMgaXMgbG9hZGVkIHRyeSB0byByZXNldCB0aGUgc3ByaXRlIGFzc2V0XG4gICAgX29uVGV4dHVyZUF0bGFzTG9hZChhdGxhc0Fzc2V0KSB7XG4gICAgICAgIGNvbnN0IHNwcml0ZUFzc2V0ID0gdGhpcy5fc3ByaXRlQXNzZXQ7XG4gICAgICAgIGlmIChzcHJpdGVBc3NldCBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBfc3ByaXRlQXNzZXQgc2hvdWxkIG5ldmVyIGJlIGFuIGFzc2V0IGluc3RhbmNlP1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoc3ByaXRlQXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQodGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHNwcml0ZUFzc2V0KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl9tYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl90ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZFRleHR1cmVBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbGVtZW50LmFkZE1vZGVsVG9MYXllcnModGhpcy5fcmVuZGVyYWJsZS5tb2RlbCk7XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLl9yZW5kZXJhYmxlLm1vZGVsKTtcbiAgICB9XG5cbiAgICBfc2V0U3RlbmNpbChzdGVuY2lsUGFyYW1zKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlLnN0ZW5jaWxGcm9udCA9IHN0ZW5jaWxQYXJhbXM7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrID0gc3RlbmNpbFBhcmFtcztcblxuICAgICAgICBsZXQgcmVmID0gMDtcbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQubWFza2VkQnkpIHtcbiAgICAgICAgICAgIHJlZiA9IHRoaXMuX2VsZW1lbnQubWFza2VkQnkuZWxlbWVudC5faW1hZ2UuX21hc2tSZWY7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICBjb25zdCBzcCA9IG5ldyBTdGVuY2lsUGFyYW1ldGVycyh7XG4gICAgICAgICAgICAgICAgcmVmOiByZWYgKyAxLFxuICAgICAgICAgICAgICAgIGZ1bmM6IEZVTkNfRVFVQUwsXG4gICAgICAgICAgICAgICAgenBhc3M6IFNURU5DSUxPUF9ERUNSRU1FTlRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnVubWFza01lc2hJbnN0YW5jZS5zdGVuY2lsRnJvbnQgPSBzcDtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrID0gc3A7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgY29sb3IodmFsdWUpIHtcbiAgICAgICAgY29uc3QgciA9IHZhbHVlLnI7XG4gICAgICAgIGNvbnN0IGcgPSB2YWx1ZS5nO1xuICAgICAgICBjb25zdCBiID0gdmFsdWUuYjtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh0aGlzLl9jb2xvciA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ1NldHRpbmcgZWxlbWVudC5jb2xvciB0byBpdHNlbGYgd2lsbCBoYXZlIG5vIGVmZmVjdCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmICh0aGlzLl9jb2xvci5yICE9PSByIHx8IHRoaXMuX2NvbG9yLmcgIT09IGcgfHwgdGhpcy5fY29sb3IuYiAhPT0gYikge1xuICAgICAgICAgICAgdGhpcy5fY29sb3IuciA9IHI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5nID0gZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmIgPSBiO1xuXG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSByO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IGI7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0OmNvbG9yJywgdGhpcy5fY29sb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgc2V0IG9wYWNpdHkodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9jb2xvci5hKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5hID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmZpcmUoJ3NldDpvcGFjaXR5JywgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9wYWNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvci5hO1xuICAgIH1cblxuICAgIHNldCByZWN0KHZhbHVlKSB7XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRoaXMuX3JlY3QgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1NldHRpbmcgZWxlbWVudC5yZWN0IHRvIGl0c2VsZiB3aWxsIGhhdmUgbm8gZWZmZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgbGV0IHgsIHksIHosIHc7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgIHggPSB2YWx1ZS54O1xuICAgICAgICAgICAgeSA9IHZhbHVlLnk7XG4gICAgICAgICAgICB6ID0gdmFsdWUuejtcbiAgICAgICAgICAgIHcgPSB2YWx1ZS53O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgeSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgeiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgdyA9IHZhbHVlWzNdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHggPT09IHRoaXMuX3JlY3QueCAmJlxuICAgICAgICAgICAgeSA9PT0gdGhpcy5fcmVjdC55ICYmXG4gICAgICAgICAgICB6ID09PSB0aGlzLl9yZWN0LnogJiZcbiAgICAgICAgICAgIHcgPT09IHRoaXMuX3JlY3Qud1xuICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3JlY3Quc2V0KHgsIHksIHosIHcpO1xuXG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZWxlbWVudC5fYmVpbmdJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5fcmVuZGVyYWJsZS5tZXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjdDtcbiAgICB9XG5cbiAgICBzZXQgbWF0ZXJpYWwodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmVlblNwYWNlID0gdGhpcy5fZWxlbWVudC5faXNTY3JlZW5TcGFjZSgpO1xuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gc2NyZWVuU3BhY2UgPyB0aGlzLl9zeXN0ZW0uZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwgOiB0aGlzLl9zeXN0ZW0uZGVmYXVsdEltYWdlTWFza01hdGVyaWFsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHNjcmVlblNwYWNlID8gdGhpcy5fc3lzdGVtLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwgOiB0aGlzLl9zeXN0ZW0uZGVmYXVsdEltYWdlTWF0ZXJpYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWF0ZXJpYWwodmFsdWUpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIG5vdCB0aGUgZGVmYXVsdCBtYXRlcmlhbCB0aGVuIGNsZWFyIGNvbG9yIGFuZCBvcGFjaXR5IG92ZXJyaWRlc1xuICAgICAgICAgICAgaWYgKHRoaXMuX2hhc1VzZXJNYXRlcmlhbCgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIGlmIHdlIGFyZSBiYWNrIHRvIHRoZSBkZWZhdWx0cyByZXNldCB0aGUgY29sb3IgYW5kIG9wYWNpdHlcbiAgICAgICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsxXSA9IHRoaXMuX2NvbG9yLmc7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgdGhpcy5fY29sb3IuYSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICBzZXQgbWF0ZXJpYWxBc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoX3ByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgX3ByZXYub2ZmKCdsb2FkJywgdGhpcy5fb25NYXRlcmlhbExvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2NoYW5nZScsIHRoaXMuX29uTWF0ZXJpYWxDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxSZW1vdmUsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IF9pZDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbEFzc2V0O1xuICAgIH1cblxuICAgIHNldCB0ZXh0dXJlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmVBc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKHRleHR1cmVBc3NldCAmJiB0ZXh0dXJlQXNzZXQucmVzb3VyY2UgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdGV4dHVyZSA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSkge1xuXG4gICAgICAgICAgICAvLyBjbGVhciBzcHJpdGUgYXNzZXQgaWYgdGV4dHVyZSBpcyBzZXRcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkZWZhdWx0IHRleHR1cmUganVzdCB1c2VzIGVtaXNzaXZlIGFuZCBvcGFjaXR5IG1hcHNcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJywgdGhpcy5fdGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJywgdGhpcy5fdGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX2NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCB0aGlzLl9jb2xvci5hKTtcblxuICAgICAgICAgICAgLy8gaWYgdGV4dHVyZSdzIGFzcGVjdCByYXRpbyBjaGFuZ2VkIGFuZCB0aGUgZWxlbWVudCBuZWVkcyB0byBwcmVzZXJ2ZSBhc3BlY3QgcmF0aW8sIHJlZnJlc2ggdGhlIG1lc2hcbiAgICAgICAgICAgIGNvbnN0IG5ld0FzcGVjdFJhdGlvID0gdGhpcy5fdGV4dHVyZS53aWR0aCAvIHRoaXMuX3RleHR1cmUuaGVpZ2h0O1xuICAgICAgICAgICAgaWYgKG5ld0FzcGVjdFJhdGlvICE9PSB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gbmV3QXNwZWN0UmF0aW87XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQuZml0TW9kZSAhPT0gRklUTU9ERV9TVFJFVENIKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcmVzaE1lc2goKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcblxuICAgICAgICAgICAgLy8gcmVzZXQgdGFyZ2V0IGFzcGVjdCByYXRpbyBhbmQgcmVmcmVzaCBtZXNoIGlmIHRoZXJlIGlzIGFuIGFzcGVjdCByYXRpbyBzZXR0aW5nXG4gICAgICAgICAgICAvLyB0aGlzIGlzIG5lZWRlZCBpbiBvcmRlciB0byBwcm9wZXJseSByZXNldCB0aGUgbWVzaCB0byAnc3RyZXRjaCcgYWNyb3NzIHRoZSBlbnRpcmUgZWxlbWVudCBib3VuZHNcbiAgICAgICAgICAgIC8vIHdoZW4gcmVzZXR0aW5nIHRoZSB0ZXh0dXJlXG4gICAgICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IC0xO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQuZml0TW9kZSAhPT0gRklUTU9ERV9TVFJFVENIKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoTWVzaCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHRleHR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlO1xuICAgIH1cblxuICAgIHNldCB0ZXh0dXJlQXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGxldCBfaWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX3RleHR1cmVBc3NldCwgdGhpcy5fb25UZXh0dXJlQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2xvYWQnLCB0aGlzLl9vblRleHR1cmVMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgX3ByZXYub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblRleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ3JlbW92ZScsIHRoaXMuX29uVGV4dHVyZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlQXNzZXQgPSBfaWQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX3RleHR1cmVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBhc3NldHMub24oJ2FkZDonICsgdGhpcy5fdGV4dHVyZUFzc2V0LCB0aGlzLl9vblRleHR1cmVBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYmluZFRleHR1cmVBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHRleHR1cmVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmVBc3NldDtcbiAgICB9XG5cbiAgICBzZXQgc3ByaXRlQXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGxldCBfaWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQgIT09IF9pZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9zcHJpdGVBc3NldCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fc3ByaXRlQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRTcHJpdGVBc3NldChfcHJldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9zcHJpdGVBc3NldCA9IF9pZDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNwcml0ZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9zcHJpdGVBc3NldCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kU3ByaXRlQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0OnNwcml0ZUFzc2V0JywgX2lkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzcHJpdGVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZUFzc2V0O1xuICAgIH1cblxuICAgIHNldCBzcHJpdGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl91bmJpbmRTcHJpdGUodGhpcy5fc3ByaXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgY29uc3Qgc3ByaXRlQXNzZXQgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5fc3ByaXRlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKHNwcml0ZUFzc2V0ICYmIHNwcml0ZUFzc2V0LnJlc291cmNlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3ByaXRlID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fYmluZFNwcml0ZSh0aGlzLl9zcHJpdGUpO1xuXG4gICAgICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIGlmIHNwcml0ZSBpcyBiZWluZyBzZXRcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlICYmIHRoaXMuX3Nwcml0ZS5hdGxhcyAmJiB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgLy8gZGVmYXVsdCB0ZXh0dXJlIGp1c3QgdXNlcyBlbWlzc2l2ZSBhbmQgb3BhY2l0eSBtYXBzXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcsIHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsYW1wIGZyYW1lXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gbWF0aC5jbGFtcCh0aGlzLl9zcHJpdGVGcmFtZSwgMCwgdGhpcy5fc3ByaXRlLmZyYW1lS2V5cy5sZW5ndGggLSAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgIH1cblxuICAgIGdldCBzcHJpdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcHJpdGU7XG4gICAgfVxuXG4gICAgc2V0IHNwcml0ZUZyYW1lKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpcy5fc3ByaXRlRnJhbWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gbWF0aC5jbGFtcCh2YWx1ZSwgMCwgdGhpcy5fc3ByaXRlLmZyYW1lS2V5cy5sZW5ndGggLSAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlRnJhbWUgIT09IG9sZFZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTcHJpdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmZpcmUoJ3NldDpzcHJpdGVGcmFtZScsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzcHJpdGVGcmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZUZyYW1lO1xuICAgIH1cblxuICAgIHNldCBtZXNoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWVzaCh2YWx1ZSk7XG4gICAgICAgIGlmICh0aGlzLl9kZWZhdWx0TWVzaCA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmMobnVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldEFhYmJGdW5jKHRoaXMuX3VwZGF0ZUFhYmJGdW5jKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtZXNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyYWJsZS5tZXNoO1xuICAgIH1cblxuICAgIHNldCBtYXNrKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXNrICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbWFzayA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlTWFzaygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hc2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrO1xuICAgIH1cblxuICAgIHNldCBwaXhlbHNQZXJVbml0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9waXhlbHNQZXJVbml0ID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3BpeGVsc1BlclVuaXQgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSAmJiAodGhpcy5fc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTcHJpdGUoKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgZ2V0IHBpeGVsc1BlclVuaXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXhlbHNQZXJVbml0O1xuICAgIH1cblxuICAgIC8vIHByaXZhdGVcbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2UuYWFiYjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEltYWdlRWxlbWVudCB9O1xuIl0sIm5hbWVzIjpbIkltYWdlUmVuZGVyYWJsZSIsImNvbnN0cnVjdG9yIiwiZW50aXR5IiwibWVzaCIsIm1hdGVyaWFsIiwiX2VudGl0eSIsIl9lbGVtZW50IiwiZWxlbWVudCIsIm1vZGVsIiwiTW9kZWwiLCJub2RlIiwiR3JhcGhOb2RlIiwiZ3JhcGgiLCJtZXNoSW5zdGFuY2UiLCJNZXNoSW5zdGFuY2UiLCJuYW1lIiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJfbWVzaERpcnR5IiwibWVzaEluc3RhbmNlcyIsInB1c2giLCJhZGRDaGlsZCIsInVubWFza01lc2hJbnN0YW5jZSIsImRlc3Ryb3kiLCJzZXRNYXRlcmlhbCIsInJlbW92ZU1vZGVsRnJvbUxheWVycyIsInNldE1lc2giLCJ2aXNpYmxlIiwiZm9yY2VVcGRhdGVBYWJiIiwic2V0TWFzayIsIm1hc2siLCJwaWNrIiwicGFyYW1ldGVycyIsInNldFBhcmFtZXRlciIsImRhdGEiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwiZW5hYmxlZCIsImFkZE1vZGVsVG9MYXllcnMiLCJ2YWx1ZSIsImRlbGV0ZVBhcmFtZXRlciIsInNldFVubWFza0RyYXdPcmRlciIsImdldExhc3RDaGlsZCIsImUiLCJsYXN0IiwiYyIsImNoaWxkcmVuIiwibCIsImxlbmd0aCIsImkiLCJjaGlsZCIsImxhc3RDaGlsZCIsImRyYXdPcmRlciIsImdldE1hc2tPZmZzZXQiLCJzZXREcmF3T3JkZXIiLCJzZXRDdWxsIiwiY3VsbCIsInZpc2libGVGbiIsIl9pc1NjcmVlblNwYWNlIiwiY2FtZXJhIiwiaXNWaXNpYmxlRm9yQ2FtZXJhIiwiaXNWaXNpYmxlRnVuYyIsInNldFNjcmVlblNwYWNlIiwic2NyZWVuU3BhY2UiLCJzZXRMYXllciIsImxheWVyIiwiX2FhYmJWZXIiLCJzZXRBYWJiRnVuYyIsImZuIiwiX3VwZGF0ZUFhYmJGdW5jIiwiSW1hZ2VFbGVtZW50IiwiX3N5c3RlbSIsInN5c3RlbSIsIl90ZXh0dXJlQXNzZXQiLCJfdGV4dHVyZSIsIl9tYXRlcmlhbEFzc2V0IiwiX21hdGVyaWFsIiwiX3Nwcml0ZUFzc2V0IiwiX3Nwcml0ZSIsIl9zcHJpdGVGcmFtZSIsIl9waXhlbHNQZXJVbml0IiwiX3RhcmdldEFzcGVjdFJhdGlvIiwiX3JlY3QiLCJWZWM0IiwiX21hc2siLCJfbWFza1JlZiIsIl9vdXRlclNjYWxlIiwiVmVjMiIsIl9vdXRlclNjYWxlVW5pZm9ybSIsIkZsb2F0MzJBcnJheSIsIl9pbm5lck9mZnNldCIsIl9pbm5lck9mZnNldFVuaWZvcm0iLCJfYXRsYXNSZWN0IiwiX2F0bGFzUmVjdFVuaWZvcm0iLCJfZGVmYXVsdE1lc2giLCJfY3JlYXRlTWVzaCIsIl9yZW5kZXJhYmxlIiwiX2NvbG9yIiwiQ29sb3IiLCJfY29sb3JVbmlmb3JtIiwiX3VwZGF0ZUFhYmIiLCJiaW5kIiwiX29uU2NyZWVuQ2hhbmdlIiwic2NyZWVuIiwib24iLCJfb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlIiwiX29uU2NyZWVuU3BhY2VDaGFuZ2UiLCJfb25EcmF3T3JkZXJDaGFuZ2UiLCJfb25SZXNvbHV0aW9uQ2hhbmdlIiwidGV4dHVyZUFzc2V0Iiwic3ByaXRlQXNzZXQiLCJtYXRlcmlhbEFzc2V0Iiwib2ZmIiwicmVzIiwiX3VwZGF0ZU1lc2giLCJfdXBkYXRlTWF0ZXJpYWwiLCJwcmV2aW91cyIsIm9yZGVyIiwib25jZSIsIl9oYXNVc2VyTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2VNYXRlcmlhbHMiLCJfdXNlOVNsaWNpbmciLCJzcHJpdGUiLCJyZW5kZXJNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJuaW5lU2xpY2VkIiwibmluZVRpbGVkIiwiZ2V0SW1hZ2VFbGVtZW50TWF0ZXJpYWwiLCJfaXNTY3JlZW5DdWxsZWQiLCJMQVlFUl9IVUQiLCJMQVlFUl9XT1JMRCIsInciLCJjYWxjdWxhdGVkV2lkdGgiLCJoIiwiY2FsY3VsYXRlZEhlaWdodCIsInIiLCJ2ZXJ0ZXhEYXRhIiwiQXJyYXlCdWZmZXIiLCJ2ZXJ0ZXhEYXRhRjMyIiwieCIsInkiLCJ6IiwidmVydGV4RGVzYyIsInNlbWFudGljIiwiU0VNQU5USUNfUE9TSVRJT04iLCJjb21wb25lbnRzIiwidHlwZSIsIlRZUEVfRkxPQVQzMiIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX1RFWENPT1JEMCIsImRldmljZSIsImFwcCIsImdyYXBoaWNzRGV2aWNlIiwidmVydGV4Rm9ybWF0IiwiVmVydGV4Rm9ybWF0IiwidmVydGV4QnVmZmVyIiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX1NUQVRJQyIsIk1lc2giLCJwcmltaXRpdmUiLCJQUklNSVRJVkVfVFJJRkFOIiwiYmFzZSIsImNvdW50IiwiaW5kZXhlZCIsImFhYmIiLCJzZXRNaW5NYXgiLCJWZWMzIiwiWkVSTyIsImZpdE1vZGUiLCJGSVRNT0RFX1NUUkVUQ0giLCJhY3R1YWxSYXRpbyIsIkZJVE1PREVfQ09OVEFJTiIsIkZJVE1PREVfQ09WRVIiLCJmcmFtZURhdGEiLCJhdGxhcyIsImZyYW1lcyIsImZyYW1lS2V5cyIsImJvcmRlcldpZHRoU2NhbGUiLCJyZWN0IiwiYm9yZGVySGVpZ2h0U2NhbGUiLCJzZXQiLCJib3JkZXIiLCJ0ZXgiLCJ0ZXh0dXJlIiwid2lkdGgiLCJoZWlnaHQiLCJwcHUiLCJwaXhlbHNQZXJVbml0Iiwic2NhbGVNdWxYIiwic2NhbGVNdWxZIiwiTWF0aCIsIm1heCIsInNjYWxlWCIsInNjYWxlWSIsIm1hdGgiLCJjbGFtcCIsInNldExvY2FsU2NhbGUiLCJzZXRMb2NhbFBvc2l0aW9uIiwicGl2b3QiLCJ2YiIsImxvY2siLCJocCIsInZwIiwiYXRsYXNUZXh0dXJlV2lkdGgiLCJhdGxhc1RleHR1cmVIZWlnaHQiLCJmcmFtZSIsInVubG9jayIsIm1pbiIsIl91cGRhdGVTcHJpdGUiLCJuaW5lU2xpY2UiLCJtZXNoZXMiLCJzcHJpdGVGcmFtZSIsInJlZnJlc2hNZXNoIiwiX2JlaW5nSW5pdGlhbGl6ZWQiLCJjZW50ZXIiLCJoYWxmRXh0ZW50cyIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsIl90b2dnbGVNYXNrIiwiX2RpcnRpZnlNYXNrIiwiX29uTWF0ZXJpYWxMb2FkIiwiYXNzZXQiLCJyZXNvdXJjZSIsIl9vbk1hdGVyaWFsQWRkZWQiLCJhc3NldHMiLCJpZCIsIl9iaW5kTWF0ZXJpYWxBc3NldCIsIl9vbk1hdGVyaWFsQ2hhbmdlIiwiX29uTWF0ZXJpYWxSZW1vdmUiLCJsb2FkIiwiX3VuYmluZE1hdGVyaWFsQXNzZXQiLCJfb25UZXh0dXJlQWRkZWQiLCJfYmluZFRleHR1cmVBc3NldCIsIl9vblRleHR1cmVMb2FkIiwiX29uVGV4dHVyZUNoYW5nZSIsIl9vblRleHR1cmVSZW1vdmUiLCJfdW5iaW5kVGV4dHVyZUFzc2V0IiwiX29uU3ByaXRlQXNzZXRBZGRlZCIsIl9iaW5kU3ByaXRlQXNzZXQiLCJfb25TcHJpdGVBc3NldExvYWQiLCJfb25TcHJpdGVBc3NldENoYW5nZSIsIl9vblNwcml0ZUFzc2V0UmVtb3ZlIiwiX3VuYmluZFNwcml0ZUFzc2V0IiwidGV4dHVyZUF0bGFzQXNzZXQiLCJfb25UZXh0dXJlQXRsYXNMb2FkIiwiYXRsYXNBc3NldElkIiwiX2JpbmRTcHJpdGUiLCJfb25TcHJpdGVNZXNoZXNDaGFuZ2UiLCJfb25TcHJpdGVQcHVDaGFuZ2UiLCJfb25BdGxhc1RleHR1cmVDaGFuZ2UiLCJfdW5iaW5kU3ByaXRlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIiwiYXRsYXNBc3NldCIsIkFzc2V0IiwiZ2V0Iiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJfc2V0U3RlbmNpbCIsInN0ZW5jaWxQYXJhbXMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInJlZiIsIm1hc2tlZEJ5IiwiX2ltYWdlIiwic3AiLCJTdGVuY2lsUGFyYW1ldGVycyIsImZ1bmMiLCJGVU5DX0VRVUFMIiwienBhc3MiLCJTVEVOQ0lMT1BfREVDUkVNRU5UIiwiY29sb3IiLCJnIiwiYiIsIkRlYnVnIiwid2FybiIsImZpcmUiLCJvcGFjaXR5IiwiYSIsImNvbnNvbGUiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCIsImRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2VNYXRlcmlhbCIsIl9pZCIsIl9wcmV2IiwibmV3QXNwZWN0UmF0aW8iLCJvbGRWYWx1ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFxQ0EsTUFBTUEsZUFBZSxDQUFDO0FBQ2xCQyxFQUFBQSxXQUFXLENBQUNDLE1BQU0sRUFBRUMsSUFBSSxFQUFFQyxRQUFRLEVBQUU7SUFDaEMsSUFBSSxDQUFDQyxPQUFPLEdBQUdILE1BQU0sQ0FBQTtBQUNyQixJQUFBLElBQUksQ0FBQ0ksUUFBUSxHQUFHSixNQUFNLENBQUNLLE9BQU8sQ0FBQTtBQUU5QixJQUFBLElBQUksQ0FBQ0MsS0FBSyxHQUFHLElBQUlDLEtBQUssRUFBRSxDQUFBO0FBQ3hCLElBQUEsSUFBSSxDQUFDQyxJQUFJLEdBQUcsSUFBSUMsU0FBUyxFQUFFLENBQUE7QUFDM0IsSUFBQSxJQUFJLENBQUNILEtBQUssQ0FBQ0ksS0FBSyxHQUFHLElBQUksQ0FBQ0YsSUFBSSxDQUFBO0lBRTVCLElBQUksQ0FBQ1AsSUFBSSxHQUFHQSxJQUFJLENBQUE7QUFDaEIsSUFBQSxJQUFJLENBQUNVLFlBQVksR0FBRyxJQUFJQyxZQUFZLENBQUMsSUFBSSxDQUFDWCxJQUFJLEVBQUVDLFFBQVEsRUFBRSxJQUFJLENBQUNNLElBQUksQ0FBQyxDQUFBO0lBQ3BFLElBQUksQ0FBQ0csWUFBWSxDQUFDRSxJQUFJLEdBQUcsZ0JBQWdCLEdBQUdiLE1BQU0sQ0FBQ2EsSUFBSSxDQUFBO0FBQ3ZELElBQUEsSUFBSSxDQUFDRixZQUFZLENBQUNHLFVBQVUsR0FBRyxLQUFLLENBQUE7QUFDcEMsSUFBQSxJQUFJLENBQUNILFlBQVksQ0FBQ0ksYUFBYSxHQUFHLEtBQUssQ0FBQTtJQUV2QyxJQUFJLENBQUNDLFVBQVUsR0FBRyxLQUFLLENBQUE7SUFFdkIsSUFBSSxDQUFDVixLQUFLLENBQUNXLGFBQWEsQ0FBQ0MsSUFBSSxD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
