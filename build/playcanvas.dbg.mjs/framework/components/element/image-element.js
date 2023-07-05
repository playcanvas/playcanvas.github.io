import { Debug } from '../../../core/debug.js';
import { TRACE_ID_ELEMENT } from '../../../core/constants.js';
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
import { StencilParameters } from '../../../platform/graphics/stencil-parameters.js';
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
      Debug.trace(TRACE_ID_ELEMENT, 'setDrawOrder: ', this.unmaskMeshInstance.name, this.unmaskMeshInstance.drawOrder);
    }
  }
  setDrawOrder(drawOrder) {
    if (!this.meshInstance) return;
    Debug.trace(TRACE_ID_ELEMENT, 'setDrawOrder: ', this.meshInstance.name, drawOrder);
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
  _removeMaterialAssetEvents() {
    if (this._materialAsset) {
      const assets = this._system.app.assets;
      assets.off('add:' + this._materialAsset, this._onMaterialAdded, this);
      const asset = assets.get(this._materialAsset);
      if (asset) {
        asset.off('load', this._onMaterialLoad, this);
        asset.off('change', this._onMaterialChange, this);
        asset.off('remove', this._onMaterialRemove, this);
      }
    }
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

    // Remove material asset if changed
    if (this._materialAsset) {
      const asset = this._system.app.assets.get(this._materialAsset);
      if (!asset || asset.resource !== value) {
        this._removeMaterialAssetEvents();
        this._materialAsset = null;
      }
    }
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
      this._removeMaterialAssetEvents();
      this._materialAsset = _id;
      if (this._materialAsset) {
        const asset = assets.get(this._materialAsset);
        if (!asset) {
          this._materialAsset = null;
          this.material = null;
          this._materialAsset = _id;
          assets.on('add:' + this._materialAsset, this._onMaterialAdded, this);
        } else {
          this._bindMaterialAsset(asset);
        }
      } else {
        this._materialAsset = null;
        this.material = null;
        this._materialAsset = _id;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtZWxlbWVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL2VsZW1lbnQvaW1hZ2UtZWxlbWVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVFJBQ0VfSURfRUxFTUVOVCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHtcbiAgICBCVUZGRVJfU1RBVElDLFxuICAgIEZVTkNfRVFVQUwsXG4gICAgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBTVEVOQ0lMT1BfREVDUkVNRU5ULFxuICAgIFRZUEVfRkxPQVQzMlxufSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGV2aWNlLWNhY2hlLmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUl9IVUQsIExBWUVSX1dPUkxELFxuICAgIFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSwgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zdGVuY2lsLXBhcmFtZXRlcnMuanMnO1xuXG5pbXBvcnQgeyBGSVRNT0RFX1NUUkVUQ0gsIEZJVE1PREVfQ09OVEFJTiwgRklUTU9ERV9DT1ZFUiB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmNvbnN0IF92ZXJ0ZXhGb3JtYXREZXZpY2VDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuXG5jbGFzcyBJbWFnZVJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKGVudGl0eSwgbWVzaCwgbWF0ZXJpYWwpIHtcbiAgICAgICAgdGhpcy5fZW50aXR5ID0gZW50aXR5O1xuICAgICAgICB0aGlzLl9lbGVtZW50ID0gZW50aXR5LmVsZW1lbnQ7XG5cbiAgICAgICAgdGhpcy5tb2RlbCA9IG5ldyBNb2RlbCgpO1xuICAgICAgICB0aGlzLm5vZGUgPSBuZXcgR3JhcGhOb2RlKCk7XG4gICAgICAgIHRoaXMubW9kZWwuZ3JhcGggPSB0aGlzLm5vZGU7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgbWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm5hbWUgPSAnSW1hZ2VFbGVtZW50OiAnICsgZW50aXR5Lm5hbWU7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX21lc2hEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubW9kZWwubWVzaEluc3RhbmNlcy5wdXNoKHRoaXMubWVzaEluc3RhbmNlKTtcblxuICAgICAgICB0aGlzLl9lbnRpdHkuYWRkQ2hpbGQodGhpcy5tb2RlbC5ncmFwaCk7XG4gICAgICAgIHRoaXMubW9kZWwuX2VudGl0eSA9IHRoaXMuX2VudGl0eTtcblxuICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5zZXRNYXRlcmlhbChudWxsKTsgLy8gY2xlYXIgbWF0ZXJpYWwgcmVmZXJlbmNlc1xuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5tb2RlbC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICB0aGlzLm5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2ggPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VudGl0eSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBudWxsO1xuICAgIH1cblxuICAgIHNldE1lc2gobWVzaCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA9ICEhbWVzaDtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1lc2ggPSBtZXNoO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZm9yY2VVcGRhdGVBYWJiKCk7XG4gICAgfVxuXG4gICAgc2V0TWFzayhtYXNrKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgdGhpcy5tZXNoSW5zdGFuY2UubWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5uYW1lID0gJ1VubWFzazogJyArIHRoaXMuX2VudGl0eS5uYW1lO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucGljayA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMucHVzaCh0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIC8vIGNvcHkgcGFyYW1ldGVyc1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMubWVzaEluc3RhbmNlLnBhcmFtZXRlcnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIobmFtZSwgdGhpcy5tZXNoSW5zdGFuY2UucGFyYW1ldGVyc1tuYW1lXS5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSB1bm1hc2sgbWVzaCBpbnN0YW5jZSBmcm9tIG1vZGVsXG4gICAgICAgICAgICBjb25zdCBpZHggPSB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuaW5kZXhPZih0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBtb2RlbCB0aGVuIHJlLWFkZCB0byB1cGRhdGUgdG8gY3VycmVudCBtZXNoIGluc3RhbmNlc1xuICAgICAgICBpZiAodGhpcy5fZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fZWxlbWVudC5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuYWRkTW9kZWxUb0xheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldE1hdGVyaWFsKG1hdGVyaWFsKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRQYXJhbWV0ZXIobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihuYW1lLCB2YWx1ZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlbGV0ZVBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0VW5tYXNrRHJhd09yZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZ2V0TGFzdENoaWxkID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGxldCBsYXN0O1xuICAgICAgICAgICAgY29uc3QgYyA9IGUuY2hpbGRyZW47XG4gICAgICAgICAgICBjb25zdCBsID0gYy5sZW5ndGg7XG4gICAgICAgICAgICBpZiAobCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjW2ldLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3QgPSBjW2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFsYXN0KSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gZ2V0TGFzdENoaWxkKGxhc3QpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBsYXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVGhlIHVubWFzayBtZXNoIGluc3RhbmNlIHJlbmRlcnMgaW50byB0aGUgc3RlbmNpbCBidWZmZXJcbiAgICAgICAgLy8gd2l0aCB0aGUgcmVmIG9mIHRoZSBwcmV2aW91cyBtYXNrLiBUaGlzIGVzc2VudGlhbGx5IFwiY2xlYXJzXCJcbiAgICAgICAgLy8gdGhlIG1hc2sgdmFsdWVcbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGhlIHVubWFzayBoYXMgYSBkcmF3T3JkZXIgc2V0IHRvIGJlIG1pZC13YXkgYmV0d2VlbiB0aGUgbGFzdCBjaGlsZCBvZiB0aGVcbiAgICAgICAgLy8gbWFza2VkIGhpZXJhcmNoeSBhbmQgdGhlIG5leHQgY2hpbGQgdG8gYmUgZHJhd24uXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRoZSBvZmZzZXQgaXMgcmVkdWNlZCBieSBhIHNtYWxsIGZyYWN0aW9uIGVhY2ggdGltZSBzbyB0aGF0IGlmIG11bHRpcGxlIG1hc2tzXG4gICAgICAgIC8vIGVuZCBvbiB0aGUgc2FtZSBsYXN0IGNoaWxkIHRoZXkgYXJlIHVubWFza2VkIGluIHRoZSBjb3JyZWN0IG9yZGVyLlxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGxhc3RDaGlsZCA9IGdldExhc3RDaGlsZCh0aGlzLl9lbnRpdHkpO1xuICAgICAgICAgICAgaWYgKGxhc3RDaGlsZCAmJiBsYXN0Q2hpbGQuZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IGxhc3RDaGlsZC5lbGVtZW50LmRyYXdPcmRlciArIGxhc3RDaGlsZC5lbGVtZW50LmdldE1hc2tPZmZzZXQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdGhpcy5tZXNoSW5zdGFuY2UuZHJhd09yZGVyICsgdGhpcy5fZWxlbWVudC5nZXRNYXNrT2Zmc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRV9JRF9FTEVNRU5ULCAnc2V0RHJhd09yZGVyOiAnLCB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5uYW1lLCB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5kcmF3T3JkZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0RHJhd09yZGVyKGRyYXdPcmRlcikge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFX0lEX0VMRU1FTlQsICdzZXREcmF3T3JkZXI6ICcsIHRoaXMubWVzaEluc3RhbmNlLm5hbWUsIGRyYXdPcmRlcik7XG5cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gZHJhd09yZGVyO1xuICAgIH1cblxuICAgIHNldEN1bGwoY3VsbCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9lbGVtZW50O1xuXG4gICAgICAgIGxldCB2aXNpYmxlRm4gPSBudWxsO1xuICAgICAgICBpZiAoY3VsbCAmJiBlbGVtZW50Ll9pc1NjcmVlblNwYWNlKCkpIHtcbiAgICAgICAgICAgIHZpc2libGVGbiA9IGZ1bmN0aW9uIChjYW1lcmEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZWxlbWVudC5pc1Zpc2libGVGb3JDYW1lcmEoY2FtZXJhKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5jdWxsID0gY3VsbDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuaXNWaXNpYmxlRnVuYyA9IHZpc2libGVGbjtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLmN1bGwgPSBjdWxsO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuaXNWaXNpYmxlRnVuYyA9IHZpc2libGVGbjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFNjcmVlblNwYWNlKHNjcmVlblNwYWNlKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5zY3JlZW5TcGFjZSA9IHNjcmVlblNwYWNlO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2Uuc2NyZWVuU3BhY2UgPSBzY3JlZW5TcGFjZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldExheWVyKGxheWVyKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5sYXllciA9IGxheWVyO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UubGF5ZXIgPSBsYXllcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvcmNlVXBkYXRlQWFiYihtYXNrKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fYWFiYlZlciA9IC0xO1xuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLl9hYWJiVmVyID0gLTE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRBYWJiRnVuYyhmbikge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmJGdW5jID0gZm47XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmJGdW5jID0gZm47XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIEltYWdlRWxlbWVudCB7XG4gICAgY29uc3RydWN0b3IoZWxlbWVudCkge1xuICAgICAgICB0aGlzLl9lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgICAgdGhpcy5fZW50aXR5ID0gZWxlbWVudC5lbnRpdHk7XG4gICAgICAgIHRoaXMuX3N5c3RlbSA9IGVsZW1lbnQuc3lzdGVtO1xuXG4gICAgICAgIC8vIHB1YmxpY1xuICAgICAgICB0aGlzLl90ZXh0dXJlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl90ZXh0dXJlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9zcHJpdGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9zcHJpdGVGcmFtZSA9IDA7XG4gICAgICAgIHRoaXMuX3BpeGVsc1BlclVuaXQgPSBudWxsO1xuICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IC0xOyAvLyB3aWxsIGJlIHNldCB3aGVuIGFzc2lnbmluZyB0ZXh0dXJlc1xuXG4gICAgICAgIHRoaXMuX3JlY3QgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTsgLy8geCwgeSwgdywgaFxuXG4gICAgICAgIHRoaXMuX21hc2sgPSBmYWxzZTsgLy8gdGhpcyBpbWFnZSBlbGVtZW50IGlzIGEgbWFza1xuICAgICAgICB0aGlzLl9tYXNrUmVmID0gMDsgLy8gaWQgdXNlZCBpbiBzdGVuY2lsIGJ1ZmZlciB0byBtYXNrXG5cbiAgICAgICAgLy8gOS1zbGljaW5nXG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUgPSBuZXcgVmVjMigpO1xuICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0ID0gbmV3IFZlYzQoKTtcbiAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5fYXRsYXNSZWN0ID0gbmV3IFZlYzQoKTtcbiAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG5cbiAgICAgICAgdGhpcy5fZGVmYXVsdE1lc2ggPSB0aGlzLl9jcmVhdGVNZXNoKCk7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUgPSBuZXcgSW1hZ2VSZW5kZXJhYmxlKHRoaXMuX2VudGl0eSwgdGhpcy5fZGVmYXVsdE1lc2gsIHRoaXMuX21hdGVyaWFsKTtcblxuICAgICAgICAvLyBzZXQgZGVmYXVsdCBjb2xvcnNcbiAgICAgICAgdGhpcy5fY29sb3IgPSBuZXcgQ29sb3IoMSwgMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoWzEsIDEsIDFdKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2VtaXNzaXZlJywgdGhpcy5fY29sb3JVbmlmb3JtKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCAxKTtcblxuICAgICAgICB0aGlzLl91cGRhdGVBYWJiRnVuYyA9IHRoaXMuX3VwZGF0ZUFhYmIuYmluZCh0aGlzKTtcblxuICAgICAgICAvLyBpbml0aWFsaXplIGJhc2VkIG9uIHNjcmVlblxuICAgICAgICB0aGlzLl9vblNjcmVlbkNoYW5nZSh0aGlzLl9lbGVtZW50LnNjcmVlbik7XG5cbiAgICAgICAgLy8gbGlzdGVuIGZvciBldmVudHNcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vbigncmVzaXplJywgdGhpcy5fb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vbignc2V0OnBpdm90JywgdGhpcy5fb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vbignc2NyZWVuOnNldDpzY3JlZW5zcGFjZScsIHRoaXMuX29uU2NyZWVuU3BhY2VDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzZXQ6c2NyZWVuJywgdGhpcy5fb25TY3JlZW5DaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzZXQ6ZHJhd29yZGVyJywgdGhpcy5fb25EcmF3T3JkZXJDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzY3JlZW46c2V0OnJlc29sdXRpb24nLCB0aGlzLl9vblJlc29sdXRpb25DaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIHJlc2V0IGFsbCBhc3NldHMgdG8gdW5iaW5kIGFsbCBhc3NldCBldmVudHNcbiAgICAgICAgdGhpcy50ZXh0dXJlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLnNwcml0ZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYXRlcmlhbEFzc2V0ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1lc2godGhpcy5fZGVmYXVsdE1lc2gpO1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fZGVmYXVsdE1lc2ggPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdyZXNpemUnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2V0OnBpdm90JywgdGhpcy5fb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NjcmVlbjpzZXQ6c2NyZWVuc3BhY2UnLCB0aGlzLl9vblNjcmVlblNwYWNlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NldDpzY3JlZW4nLCB0aGlzLl9vblNjcmVlbkNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzZXQ6ZHJhd29yZGVyJywgdGhpcy5fb25EcmF3T3JkZXJDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2NyZWVuOnNldDpyZXNvbHV0aW9uJywgdGhpcy5fb25SZXNvbHV0aW9uQ2hhbmdlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25SZXNvbHV0aW9uQ2hhbmdlKHJlcykge1xuICAgIH1cblxuICAgIF9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5fcmVuZGVyYWJsZS5tZXNoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNjcmVlblNwYWNlQ2hhbmdlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHZhbHVlKTtcbiAgICB9XG5cbiAgICBfb25TY3JlZW5DaGFuZ2Uoc2NyZWVuLCBwcmV2aW91cykge1xuICAgICAgICBpZiAoc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbChzY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoZmFsc2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uRHJhd09yZGVyQ2hhbmdlKG9yZGVyKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0RHJhd09yZGVyKG9yZGVyKTtcblxuICAgICAgICBpZiAodGhpcy5tYXNrICYmIHRoaXMuX2VsZW1lbnQuc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LnNjcmVlbi5zY3JlZW4ub25jZSgnc3luY2RyYXdvcmRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFVubWFza0RyYXdPcmRlcigpO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm5zIHRydWUgaWYgd2UgYXJlIHVzaW5nIGEgbWF0ZXJpYWxcbiAgICAvLyBvdGhlciB0aGFuIHRoZSBkZWZhdWx0IG1hdGVyaWFsc1xuICAgIF9oYXNVc2VyTWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX21hdGVyaWFsQXNzZXQgfHxcbiAgICAgICAgICAgICAgICghIXRoaXMuX21hdGVyaWFsICYmXG4gICAgICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5pbmRleE9mKHRoaXMuX21hdGVyaWFsKSA9PT0gLTEpO1xuICAgIH1cblxuICAgIF91c2U5U2xpY2luZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3ByaXRlICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpO1xuICAgIH1cblxuICAgIF91cGRhdGVNYXRlcmlhbChzY3JlZW5TcGFjZSkge1xuICAgICAgICBjb25zdCBtYXNrID0gISF0aGlzLl9tYXNrO1xuICAgICAgICBjb25zdCBuaW5lU2xpY2VkID0gISEodGhpcy5zcHJpdGUgJiYgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKTtcbiAgICAgICAgY29uc3QgbmluZVRpbGVkID0gISEodGhpcy5zcHJpdGUgJiYgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpO1xuXG4gICAgICAgIGlmICghdGhpcy5faGFzVXNlck1hdGVyaWFsKCkpIHtcbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsID0gdGhpcy5fc3lzdGVtLmdldEltYWdlRWxlbWVudE1hdGVyaWFsKHNjcmVlblNwYWNlLCBtYXNrLCBuaW5lU2xpY2VkLCBuaW5lVGlsZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUpIHtcbiAgICAgICAgICAgIC8vIGN1bGxpbmcgaXMgYWx3YXlzIHRydWUgZm9yIG5vbi1zY3JlZW5zcGFjZSAoZnJ1c3RydW0gaXMgdXNlZCk7IGZvciBzY3JlZW5zcGFjZSwgdXNlIHRoZSAnY3VsbCcgcHJvcGVydHlcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0Q3VsbCghdGhpcy5fZWxlbWVudC5faXNTY3JlZW5TcGFjZSgpIHx8IHRoaXMuX2VsZW1lbnQuX2lzU2NyZWVuQ3VsbGVkKCkpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRNYXRlcmlhbCh0aGlzLl9tYXRlcmlhbCk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFNjcmVlblNwYWNlKHNjcmVlblNwYWNlKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TGF5ZXIoc2NyZWVuU3BhY2UgPyBMQVlFUl9IVUQgOiBMQVlFUl9XT1JMRCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBidWlsZCBhIHF1YWQgZm9yIHRoZSBpbWFnZVxuICAgIF9jcmVhdGVNZXNoKCkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5fZWxlbWVudDtcbiAgICAgICAgY29uc3QgdyA9IGVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoO1xuICAgICAgICBjb25zdCBoID0gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuICAgICAgICBjb25zdCByID0gdGhpcy5fcmVjdDtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5fc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcblxuICAgICAgICAvLyBjb250ZW50IG9mIHRoZSB2ZXJ0ZXggYnVmZmVyIGZvciA0IHZlcnRpY2VzLCByZW5kZXJlZCBhcyBhIHRyaXN0cmlwXG4gICAgICAgIGNvbnN0IHZlcnRleERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KFtcbiAgICAgICAgICAgIHcsIDAsIDAsICAgICAgICAgICAgICAgICAgICAgICAgLy8gcG9zaXRpb25cbiAgICAgICAgICAgIDAsIDAsIDEsICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICByLnggKyByLnosIDEuMCAtIHIueSwgICAgICAgICAgIC8vIHV2XG5cbiAgICAgICAgICAgIHcsIGgsIDAsICAgICAgICAgICAgICAgICAgICAgICAgLy8gcG9zaXRpb25cbiAgICAgICAgICAgIDAsIDAsIDEsICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICByLnggKyByLnosIDEuMCAtIChyLnkgKyByLncpLCAgIC8vIHV2XG5cbiAgICAgICAgICAgIDAsIDAsIDAsICAgICAgICAgICAgICAgICAgICAgICAgLy8gcG9zaXRpb25cbiAgICAgICAgICAgIDAsIDAsIDEsICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICByLngsIDEuMCAtIHIueSwgICAgICAgICAgICAgICAgIC8vIHV2XG5cbiAgICAgICAgICAgIDAsIGgsIDAsICAgICAgICAgICAgICAgICAgICAgICAgLy8gcG9zaXRpb25cbiAgICAgICAgICAgIDAsIDAsIDEsICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICByLngsIDEuMCAtIChyLnkgKyByLncpICAgICAgICAgIC8vIHV2XG4gICAgICAgIF0pO1xuXG4gICAgICAgIC8vIHBlciBkZXZpY2UgY2FjaGVkIHZlcnRleCBmb3JtYXQsIHRvIHNoYXJlIGl0IGJ5IGFsbCB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICBjb25zdCB2ZXJ0ZXhGb3JtYXQgPSBfdmVydGV4Rm9ybWF0RGV2aWNlQ2FjaGUuZ2V0KGRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBWZXJ0ZXhGb3JtYXQoZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfUE9TSVRJT04sIGNvbXBvbmVudHM6IDMsIHR5cGU6IFRZUEVfRkxPQVQzMiB9LFxuICAgICAgICAgICAgICAgIHsgc2VtYW50aWM6IFNFTUFOVElDX05PUk1BTCwgY29tcG9uZW50czogMywgdHlwZTogVFlQRV9GTE9BVDMyIH0sXG4gICAgICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfVEVYQ09PUkQwLCBjb21wb25lbnRzOiAyLCB0eXBlOiBUWVBFX0ZMT0FUMzIgfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIoZGV2aWNlLCB2ZXJ0ZXhGb3JtYXQsIDQsIEJVRkZFUl9TVEFUSUMsIHZlcnRleERhdGEuYnVmZmVyKTtcblxuICAgICAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICAgICAgbWVzaC52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLnR5cGUgPSBQUklNSVRJVkVfVFJJU1RSSVA7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IDQ7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSBmYWxzZTtcbiAgICAgICAgbWVzaC5hYWJiLnNldE1pbk1heChWZWMzLlpFUk8sIG5ldyBWZWMzKHcsIGgsIDApKTtcblxuICAgICAgICB0aGlzLl91cGRhdGVNZXNoKG1lc2gpO1xuXG4gICAgICAgIHJldHVybiBtZXNoO1xuICAgIH1cblxuICAgIF91cGRhdGVNZXNoKG1lc2gpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7XG4gICAgICAgIGxldCB3ID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgIGxldCBoID0gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuXG4gICAgICAgIGlmIChlbGVtZW50LmZpdE1vZGUgIT09IEZJVE1PREVfU1RSRVRDSCAmJiB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbFJhdGlvID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggLyBlbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQ7XG4gICAgICAgICAgICAvLyBjaGVjayB3aGljaCBjb29yZGluYXRlIG11c3QgY2hhbmdlIGluIG9yZGVyIHRvIHByZXNlcnZlIHRoZSBzb3VyY2UgYXNwZWN0IHJhdGlvXG4gICAgICAgICAgICBpZiAoKGVsZW1lbnQuZml0TW9kZSA9PT0gRklUTU9ERV9DT05UQUlOICYmIGFjdHVhbFJhdGlvID4gdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8pIHx8XG4gICAgICAgICAgICAgICAgKGVsZW1lbnQuZml0TW9kZSA9PT0gRklUTU9ERV9DT1ZFUiAmJiBhY3R1YWxSYXRpbyA8IHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvKSkge1xuICAgICAgICAgICAgICAgIC8vIHVzZSAnaGVpZ2h0JyB0byByZS1jYWxjdWxhdGUgd2lkdGhcbiAgICAgICAgICAgICAgICB3ID0gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0ICogdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW87XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHVzZSAnd2lkdGgnIHRvIHJlLWNhbGN1bGF0ZSBoZWlnaHRcbiAgICAgICAgICAgICAgICBoID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggLyB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBtYXRlcmlhbFxuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IGVsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoc2NyZWVuU3BhY2UpO1xuXG4gICAgICAgIC8vIGZvcmNlIHVwZGF0ZSBtZXNoSW5zdGFuY2UgYWFiYlxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkgdGhpcy5fcmVuZGVyYWJsZS5mb3JjZVVwZGF0ZUFhYmIoKTtcblxuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGlubmVyIG9mZnNldCBmcm9tIHRoZSBmcmFtZSdzIGJvcmRlclxuICAgICAgICAgICAgY29uc3QgZnJhbWVEYXRhID0gdGhpcy5fc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLl9zcHJpdGUuZnJhbWVLZXlzW3RoaXMuX3Nwcml0ZUZyYW1lXV07XG4gICAgICAgICAgICBjb25zdCBib3JkZXJXaWR0aFNjYWxlID0gMiAvIGZyYW1lRGF0YS5yZWN0Lno7XG4gICAgICAgICAgICBjb25zdCBib3JkZXJIZWlnaHRTY2FsZSA9IDIgLyBmcmFtZURhdGEucmVjdC53O1xuXG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldC5zZXQoXG4gICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci54ICogYm9yZGVyV2lkdGhTY2FsZSxcbiAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnkgKiBib3JkZXJIZWlnaHRTY2FsZSxcbiAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnogKiBib3JkZXJXaWR0aFNjYWxlLFxuICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIudyAqIGJvcmRlckhlaWdodFNjYWxlXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCB0ZXggPSB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlO1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0LnNldChmcmFtZURhdGEucmVjdC54IC8gdGV4LndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEucmVjdC55IC8gdGV4LmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueiAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QudyAvIHRleC5oZWlnaHQpO1xuXG4gICAgICAgICAgICAvLyBzY2FsZTogYXBwbHkgUFBVXG4gICAgICAgICAgICBjb25zdCBwcHUgPSB0aGlzLl9waXhlbHNQZXJVbml0ICE9PSBudWxsID8gdGhpcy5fcGl4ZWxzUGVyVW5pdCA6IHRoaXMuc3ByaXRlLnBpeGVsc1BlclVuaXQ7XG4gICAgICAgICAgICBjb25zdCBzY2FsZU11bFggPSBmcmFtZURhdGEucmVjdC56IC8gcHB1O1xuICAgICAgICAgICAgY29uc3Qgc2NhbGVNdWxZID0gZnJhbWVEYXRhLnJlY3QudyAvIHBwdTtcblxuICAgICAgICAgICAgLy8gc2NhbGUgYm9yZGVycyBpZiBuZWNlc3NhcnkgaW5zdGVhZCBvZiBvdmVybGFwcGluZ1xuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS5zZXQoTWF0aC5tYXgodywgdGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIE1hdGgubWF4KGgsIHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpKTtcblxuICAgICAgICAgICAgbGV0IHNjYWxlWCA9IHNjYWxlTXVsWDtcbiAgICAgICAgICAgIGxldCBzY2FsZVkgPSBzY2FsZU11bFk7XG5cbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUueCAvPSBzY2FsZU11bFg7XG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnkgLz0gc2NhbGVNdWxZO1xuXG4gICAgICAgICAgICAvLyBzY2FsZTogc2hyaW5raW5nIGJlbG93IDFcbiAgICAgICAgICAgIHNjYWxlWCAqPSBtYXRoLmNsYW1wKHcgLyAodGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIDAuMDAwMSwgMSk7XG4gICAgICAgICAgICBzY2FsZVkgKj0gbWF0aC5jbGFtcChoIC8gKHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpLCAwLjAwMDEsIDEpO1xuXG4gICAgICAgICAgICAvLyBzZXQgc2NhbGVcbiAgICAgICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzBdID0gdGhpcy5faW5uZXJPZmZzZXQueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMV0gPSB0aGlzLl9pbm5lck9mZnNldC55O1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVsyXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lno7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzNdID0gdGhpcy5faW5uZXJPZmZzZXQudztcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignaW5uZXJPZmZzZXQnLCB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bMF0gPSB0aGlzLl9hdGxhc1JlY3QueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzFdID0gdGhpcy5fYXRsYXNSZWN0Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsyXSA9IHRoaXMuX2F0bGFzUmVjdC56O1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bM10gPSB0aGlzLl9hdGxhc1JlY3QudztcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignYXRsYXNSZWN0JywgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm1bMF0gPSB0aGlzLl9vdXRlclNjYWxlLng7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm1bMV0gPSB0aGlzLl9vdXRlclNjYWxlLnk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ291dGVyU2NhbGUnLCB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRBYWJiRnVuYyh0aGlzLl91cGRhdGVBYWJiRnVuYyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxTY2FsZShzY2FsZVgsIHNjYWxlWSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5ub2RlLnNldExvY2FsUG9zaXRpb24oKDAuNSAtIGVsZW1lbnQucGl2b3QueCkgKiB3LCAoMC41IC0gZWxlbWVudC5waXZvdC55KSAqIGgsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdmIgPSBtZXNoLnZlcnRleEJ1ZmZlcjtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleERhdGFGMzIgPSBuZXcgRmxvYXQzMkFycmF5KHZiLmxvY2soKSk7XG5cbiAgICAgICAgICAgIC8vIG9mZnNldCBmb3IgcGl2b3RcbiAgICAgICAgICAgIGNvbnN0IGhwID0gZWxlbWVudC5waXZvdC54O1xuICAgICAgICAgICAgY29uc3QgdnAgPSBlbGVtZW50LnBpdm90Lnk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB2ZXJ0ZXggcG9zaXRpb25zLCBhY2NvdW50aW5nIGZvciB0aGUgcGl2b3Qgb2Zmc2V0XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzBdID0gdyAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMV0gPSAwIC0gdnAgKiBoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls4XSA9IHcgLSBocCAqIHc7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzldID0gaCAtIHZwICogaDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTZdID0gMCAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTddID0gMCAtIHZwICogaDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjRdID0gMCAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjVdID0gaCAtIHZwICogaDtcblxuICAgICAgICAgICAgbGV0IGF0bGFzVGV4dHVyZVdpZHRoID0gMTtcbiAgICAgICAgICAgIGxldCBhdGxhc1RleHR1cmVIZWlnaHQgPSAxO1xuICAgICAgICAgICAgbGV0IHJlY3QgPSB0aGlzLl9yZWN0O1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fc3ByaXRlICYmIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXNbdGhpcy5fc3ByaXRlRnJhbWVdICYmIHRoaXMuX3Nwcml0ZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZyYW1lID0gdGhpcy5fc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLl9zcHJpdGUuZnJhbWVLZXlzW3RoaXMuX3Nwcml0ZUZyYW1lXV07XG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlY3QgPSBmcmFtZS5yZWN0O1xuICAgICAgICAgICAgICAgICAgICBhdGxhc1RleHR1cmVXaWR0aCA9IHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlLndpZHRoO1xuICAgICAgICAgICAgICAgICAgICBhdGxhc1RleHR1cmVIZWlnaHQgPSB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBVcGRhdGUgdmVydGV4IHRleHR1cmUgY29vcmRpbmF0ZXNcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbNl0gPSAocmVjdC54ICsgcmVjdC56KSAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls3XSA9IDEuMCAtIHJlY3QueSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTRdID0gKHJlY3QueCArIHJlY3QueikgLyBhdGxhc1RleHR1cmVXaWR0aDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTVdID0gMS4wIC0gKHJlY3QueSArIHJlY3QudykgLyBhdGxhc1RleHR1cmVIZWlnaHQ7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzIyXSA9IHJlY3QueCAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsyM10gPSAxLjAgLSByZWN0LnkgLyBhdGxhc1RleHR1cmVIZWlnaHQ7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMwXSA9IHJlY3QueCAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlszMV0gPSAxLjAgLSAocmVjdC55ICsgcmVjdC53KSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcblxuICAgICAgICAgICAgdmIudW5sb2NrKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pbiA9IG5ldyBWZWMzKDAgLSBocCAqIHcsIDAgLSB2cCAqIGgsIDApO1xuICAgICAgICAgICAgY29uc3QgbWF4ID0gbmV3IFZlYzModyAtIGhwICogdywgaCAtIHZwICogaCwgMCk7XG4gICAgICAgICAgICBtZXNoLmFhYmIuc2V0TWluTWF4KG1pbiwgbWF4KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxTY2FsZSgxLCAxLCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxQb3NpdGlvbigwLCAwLCAwKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmMobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tZXNoRGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBHZXRzIHRoZSBtZXNoIGZyb20gdGhlIHNwcml0ZSBhc3NldFxuICAgIC8vIGlmIHRoZSBzcHJpdGUgaXMgOS1zbGljZWQgb3IgdGhlIGRlZmF1bHQgbWVzaCBmcm9tIHRoZVxuICAgIC8vIGltYWdlIGVsZW1lbnQgYW5kIGNhbGxzIF91cGRhdGVNZXNoIG9yIHNldHMgbWVzaERpcnR5IHRvIHRydWVcbiAgICAvLyBpZiB0aGUgY29tcG9uZW50IGlzIGN1cnJlbnRseSBiZWluZyBpbml0aWFsaXplZC4gQWxzbyB1cGRhdGVzXG4gICAgLy8gYXNwZWN0IHJhdGlvLiBXZSBuZWVkIHRvIGNhbGwgX3VwZGF0ZVNwcml0ZSBldmVyeSB0aW1lXG4gICAgLy8gc29tZXRoaW5nIHJlbGF0ZWQgdG8gdGhlIHNwcml0ZSBhc3NldCBjaGFuZ2VzXG4gICAgX3VwZGF0ZVNwcml0ZSgpIHtcbiAgICAgICAgbGV0IG5pbmVTbGljZSA9IGZhbHNlO1xuICAgICAgICBsZXQgbWVzaCA9IG51bGw7XG5cbiAgICAgICAgLy8gcmVzZXQgdGFyZ2V0IGFzcGVjdCByYXRpb1xuICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IC0xO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUgJiYgdGhpcy5fc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICAvLyB0YWtlIG1lc2ggZnJvbSBzcHJpdGVcbiAgICAgICAgICAgIG1lc2ggPSB0aGlzLl9zcHJpdGUubWVzaGVzW3RoaXMuc3ByaXRlRnJhbWVdO1xuICAgICAgICAgICAgbmluZVNsaWNlID0gdGhpcy5fc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQ7XG5cbiAgICAgICAgICAgIC8vIHJlLWNhbGN1bGF0ZSBhc3BlY3QgcmF0aW8gZnJvbSBzcHJpdGUgZnJhbWVcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lRGF0YSA9IHRoaXMuX3Nwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5fc3ByaXRlLmZyYW1lS2V5c1t0aGlzLl9zcHJpdGVGcmFtZV1dO1xuICAgICAgICAgICAgaWYgKGZyYW1lRGF0YT8ucmVjdC53ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gZnJhbWVEYXRhLnJlY3QueiAvIGZyYW1lRGF0YS5yZWN0Lnc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB3ZSB1c2UgOSBzbGljaW5nIHRoZW4gdXNlIHRoYXQgbWVzaCBvdGhlcndpc2Uga2VlcCB1c2luZyB0aGUgZGVmYXVsdCBtZXNoXG4gICAgICAgIHRoaXMubWVzaCA9IG5pbmVTbGljZSA/IG1lc2ggOiB0aGlzLl9kZWZhdWx0TWVzaDtcblxuICAgICAgICB0aGlzLnJlZnJlc2hNZXNoKCk7XG4gICAgfVxuXG4gICAgcmVmcmVzaE1lc2goKSB7XG4gICAgICAgIGlmICh0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZWxlbWVudC5fYmVpbmdJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5tZXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVwZGF0ZXMgQUFCQiB3aGlsZSA5LXNsaWNpbmdcbiAgICBfdXBkYXRlQWFiYihhYWJiKSB7XG4gICAgICAgIGFhYmIuY2VudGVyLnNldCgwLCAwLCAwKTtcbiAgICAgICAgYWFiYi5oYWxmRXh0ZW50cy5zZXQodGhpcy5fb3V0ZXJTY2FsZS54ICogMC41LCB0aGlzLl9vdXRlclNjYWxlLnkgKiAwLjUsIDAuMDAxKTtcbiAgICAgICAgYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGFhYmIsIHRoaXMuX3JlbmRlcmFibGUubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgcmV0dXJuIGFhYmI7XG4gICAgfVxuXG4gICAgX3RvZ2dsZU1hc2soKSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQuX2RpcnRpZnlNYXNrKCk7XG5cbiAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKTtcblxuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1hc2soISF0aGlzLl9tYXNrKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsQWRkZWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VudGl0eS5lbmFibGVkKSByZXR1cm47IC8vIGRvbid0IGJpbmQgdW50aWwgZWxlbWVudCBpcyBlbmFibGVkXG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uTWF0ZXJpYWxDaGFuZ2UoKSB7XG5cbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFJlbW92ZSgpIHtcblxuICAgIH1cblxuICAgIF9vblRleHR1cmVBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uVGV4dHVyZUFkZGVkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRUZXh0dXJlQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2JpbmRUZXh0dXJlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbnRpdHkuZW5hYmxlZCkgcmV0dXJuOyAvLyBkb24ndCBiaW5kIHVudGlsIGVsZW1lbnQgaXMgZW5hYmxlZFxuXG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25UZXh0dXJlTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vblRleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uVGV4dHVyZUxvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kVGV4dHVyZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uVGV4dHVyZUxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25UZXh0dXJlTG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLnRleHR1cmUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICB9XG5cbiAgICBfb25UZXh0dXJlQ2hhbmdlKGFzc2V0KSB7XG5cbiAgICB9XG5cbiAgICBfb25UZXh0dXJlUmVtb3ZlKGFzc2V0KSB7XG5cbiAgICB9XG5cbiAgICAvLyBXaGVuIHNwcml0ZSBhc3NldCBpcyBhZGRlZCBiaW5kIGl0XG4gICAgX29uU3ByaXRlQXNzZXRBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uU3ByaXRlQXNzZXRBZGRlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIb29rIHVwIGV2ZW50IGhhbmRsZXJzIG9uIHNwcml0ZSBhc3NldFxuICAgIF9iaW5kU3ByaXRlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbnRpdHkuZW5hYmxlZCkgcmV0dXJuOyAvLyBkb24ndCBiaW5kIHVudGlsIGVsZW1lbnQgaXMgZW5hYmxlZFxuXG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25TcHJpdGVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25TcHJpdGVBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblNwcml0ZUFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZFNwcml0ZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblNwcml0ZUFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblNwcml0ZUFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQuZGF0YS50ZXh0dXJlQXRsYXNBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdsb2FkOicgKyBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0LCB0aGlzLl9vblRleHR1cmVBdGxhc0xvYWQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2hlbiBzcHJpdGUgYXNzZXQgaXMgbG9hZGVkIG1ha2Ugc3VyZSB0aGUgdGV4dHVyZSBhdGxhcyBhc3NldCBpcyBsb2FkZWQgdG9vXG4gICAgLy8gSWYgc28gdGhlbiBzZXQgdGhlIHNwcml0ZSwgb3RoZXJ3aXNlIHdhaXQgZm9yIHRoZSBhdGxhcyB0byBiZSBsb2FkZWQgZmlyc3RcbiAgICBfb25TcHJpdGVBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCFhc3NldCB8fCAhYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghYXNzZXQucmVzb3VyY2UuYXRsYXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdGxhc0Fzc2V0SWQgPSBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0O1xuICAgICAgICAgICAgICAgIGlmIChhdGxhc0Fzc2V0SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2xvYWQ6JyArIGF0bGFzQXNzZXRJZCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2xvYWQ6JyArIGF0bGFzQXNzZXRJZCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXaGVuIHRoZSBzcHJpdGUgYXNzZXQgY2hhbmdlcyByZXNldCBpdFxuICAgIF9vblNwcml0ZUFzc2V0Q2hhbmdlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25TcHJpdGVBc3NldFJlbW92ZShhc3NldCkge1xuICAgIH1cblxuICAgIC8vIEhvb2sgdXAgZXZlbnQgaGFuZGxlcnMgb24gc3ByaXRlIGFzc2V0XG4gICAgX2JpbmRTcHJpdGUoc3ByaXRlKSB7XG4gICAgICAgIHNwcml0ZS5vbignc2V0Om1lc2hlcycsIHRoaXMuX29uU3ByaXRlTWVzaGVzQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6cGl4ZWxzUGVyVW5pdCcsIHRoaXMuX29uU3ByaXRlUHB1Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6YXRsYXMnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGlmIChzcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgIHNwcml0ZS5hdGxhcy5vbignc2V0OnRleHR1cmUnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kU3ByaXRlKHNwcml0ZSkge1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6cGl4ZWxzUGVyVW5pdCcsIHRoaXMuX29uU3ByaXRlUHB1Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9mZignc2V0OmF0bGFzJywgdGhpcy5fb25BdGxhc1RleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBpZiAoc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICBzcHJpdGUuYXRsYXMub2ZmKCdzZXQ6dGV4dHVyZScsIHRoaXMuX29uQXRsYXNUZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNwcml0ZU1lc2hlc0NoYW5nZSgpIHtcbiAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSBtYXRoLmNsYW1wKHRoaXMuX3Nwcml0ZUZyYW1lLCAwLCB0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yY2UgdXBkYXRlXG4gICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgIH1cblxuICAgIF9vblNwcml0ZVBwdUNoYW5nZSgpIHtcbiAgICAgICAgLy8gZm9yY2UgdXBkYXRlIHdoZW4gdGhlIHNwcml0ZSBpcyA5LXNsaWNlZC4gSWYgaXQncyBub3RcbiAgICAgICAgLy8gdGhlbiBpdHMgbWVzaCB3aWxsIGNoYW5nZSB3aGVuIHRoZSBwcHUgY2hhbmdlcyB3aGljaCB3aWxsXG4gICAgICAgIC8vIGJlIGhhbmRsZWQgYnkgb25TcHJpdGVNZXNoZXNDaGFuZ2VcbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgIT09IFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSAmJiB0aGlzLl9waXhlbHNQZXJVbml0ID09PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uQXRsYXNUZXh0dXJlQ2hhbmdlKCkge1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgdGhpcy5zcHJpdGUuYXRsYXMgJiYgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJywgdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdoZW4gYXRsYXMgaXMgbG9hZGVkIHRyeSB0byByZXNldCB0aGUgc3ByaXRlIGFzc2V0XG4gICAgX29uVGV4dHVyZUF0bGFzTG9hZChhdGxhc0Fzc2V0KSB7XG4gICAgICAgIGNvbnN0IHNwcml0ZUFzc2V0ID0gdGhpcy5fc3ByaXRlQXNzZXQ7XG4gICAgICAgIGlmIChzcHJpdGVBc3NldCBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBfc3ByaXRlQXNzZXQgc2hvdWxkIG5ldmVyIGJlIGFuIGFzc2V0IGluc3RhbmNlP1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoc3ByaXRlQXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQodGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHNwcml0ZUFzc2V0KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl9tYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl90ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZFRleHR1cmVBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbGVtZW50LmFkZE1vZGVsVG9MYXllcnModGhpcy5fcmVuZGVyYWJsZS5tb2RlbCk7XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLl9yZW5kZXJhYmxlLm1vZGVsKTtcbiAgICB9XG5cbiAgICBfc2V0U3RlbmNpbChzdGVuY2lsUGFyYW1zKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlLnN0ZW5jaWxGcm9udCA9IHN0ZW5jaWxQYXJhbXM7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrID0gc3RlbmNpbFBhcmFtcztcblxuICAgICAgICBsZXQgcmVmID0gMDtcbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQubWFza2VkQnkpIHtcbiAgICAgICAgICAgIHJlZiA9IHRoaXMuX2VsZW1lbnQubWFza2VkQnkuZWxlbWVudC5faW1hZ2UuX21hc2tSZWY7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICBjb25zdCBzcCA9IG5ldyBTdGVuY2lsUGFyYW1ldGVycyh7XG4gICAgICAgICAgICAgICAgcmVmOiByZWYgKyAxLFxuICAgICAgICAgICAgICAgIGZ1bmM6IEZVTkNfRVFVQUwsXG4gICAgICAgICAgICAgICAgenBhc3M6IFNURU5DSUxPUF9ERUNSRU1FTlRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnVubWFza01lc2hJbnN0YW5jZS5zdGVuY2lsRnJvbnQgPSBzcDtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrID0gc3A7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgY29sb3IodmFsdWUpIHtcbiAgICAgICAgY29uc3QgciA9IHZhbHVlLnI7XG4gICAgICAgIGNvbnN0IGcgPSB2YWx1ZS5nO1xuICAgICAgICBjb25zdCBiID0gdmFsdWUuYjtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh0aGlzLl9jb2xvciA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ1NldHRpbmcgZWxlbWVudC5jb2xvciB0byBpdHNlbGYgd2lsbCBoYXZlIG5vIGVmZmVjdCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmICh0aGlzLl9jb2xvci5yICE9PSByIHx8IHRoaXMuX2NvbG9yLmcgIT09IGcgfHwgdGhpcy5fY29sb3IuYiAhPT0gYikge1xuICAgICAgICAgICAgdGhpcy5fY29sb3IuciA9IHI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5nID0gZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmIgPSBiO1xuXG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSByO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IGI7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0OmNvbG9yJywgdGhpcy5fY29sb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgc2V0IG9wYWNpdHkodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9jb2xvci5hKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5hID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmZpcmUoJ3NldDpvcGFjaXR5JywgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9wYWNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvci5hO1xuICAgIH1cblxuICAgIHNldCByZWN0KHZhbHVlKSB7XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRoaXMuX3JlY3QgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1NldHRpbmcgZWxlbWVudC5yZWN0IHRvIGl0c2VsZiB3aWxsIGhhdmUgbm8gZWZmZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgbGV0IHgsIHksIHosIHc7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgIHggPSB2YWx1ZS54O1xuICAgICAgICAgICAgeSA9IHZhbHVlLnk7XG4gICAgICAgICAgICB6ID0gdmFsdWUuejtcbiAgICAgICAgICAgIHcgPSB2YWx1ZS53O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgeSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgeiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgdyA9IHZhbHVlWzNdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHggPT09IHRoaXMuX3JlY3QueCAmJlxuICAgICAgICAgICAgeSA9PT0gdGhpcy5fcmVjdC55ICYmXG4gICAgICAgICAgICB6ID09PSB0aGlzLl9yZWN0LnogJiZcbiAgICAgICAgICAgIHcgPT09IHRoaXMuX3JlY3Qud1xuICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3JlY3Quc2V0KHgsIHksIHosIHcpO1xuXG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZWxlbWVudC5fYmVpbmdJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5fcmVuZGVyYWJsZS5tZXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjdDtcbiAgICB9XG5cbiAgICBfcmVtb3ZlTWF0ZXJpYWxBc3NldEV2ZW50cygpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25NYXRlcmlhbExvYWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbENoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1hdGVyaWFsUmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldCBtYXRlcmlhbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgICAgICBpZiAodGhpcy5tYXNrKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBzY3JlZW5TcGFjZSA/IHRoaXMuX3N5c3RlbS5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCA6IHRoaXMuX3N5c3RlbS5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gc2NyZWVuU3BhY2UgPyB0aGlzLl9zeXN0ZW0uZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCA6IHRoaXMuX3N5c3RlbS5kZWZhdWx0SW1hZ2VNYXRlcmlhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gdmFsdWU7XG5cbiAgICAgICAgLy8gUmVtb3ZlIG1hdGVyaWFsIGFzc2V0IGlmIGNoYW5nZWRcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgaWYgKCFhc3NldCB8fCBhc3NldC5yZXNvdXJjZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW1vdmVNYXRlcmlhbEFzc2V0RXZlbnRzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWF0ZXJpYWwodmFsdWUpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIG5vdCB0aGUgZGVmYXVsdCBtYXRlcmlhbCB0aGVuIGNsZWFyIGNvbG9yIGFuZCBvcGFjaXR5IG92ZXJyaWRlc1xuICAgICAgICAgICAgaWYgKHRoaXMuX2hhc1VzZXJNYXRlcmlhbCgpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIGlmIHdlIGFyZSBiYWNrIHRvIHRoZSBkZWZhdWx0cyByZXNldCB0aGUgY29sb3IgYW5kIG9wYWNpdHlcbiAgICAgICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsxXSA9IHRoaXMuX2NvbG9yLmc7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgdGhpcy5fY29sb3IuYSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICBzZXQgbWF0ZXJpYWxBc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cztcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICBfaWQgPSB2YWx1ZS5pZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbW92ZU1hdGVyaWFsQXNzZXRFdmVudHMoKTtcblxuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IF9pZDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsQXNzZXQgPSBfaWQ7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMubWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IF9pZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbEFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWxBc3NldDtcbiAgICB9XG5cbiAgICBzZXQgdGV4dHVyZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZSA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlQXNzZXQgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5fdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlQXNzZXQgJiYgdGV4dHVyZUFzc2V0LnJlc291cmNlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3RleHR1cmUgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUpIHtcblxuICAgICAgICAgICAgLy8gY2xlYXIgc3ByaXRlIGFzc2V0IGlmIHRleHR1cmUgaXMgc2V0XG4gICAgICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNwcml0ZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZGVmYXVsdCB0ZXh0dXJlIGp1c3QgdXNlcyBlbWlzc2l2ZSBhbmQgb3BhY2l0eSBtYXBzXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcsIHRoaXMuX3RleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcsIHRoaXMuX3RleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzBdID0gdGhpcy5fY29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsxXSA9IHRoaXMuX2NvbG9yLmc7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9jb2xvci5iO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2VtaXNzaXZlJywgdGhpcy5fY29sb3JVbmlmb3JtKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgdGhpcy5fY29sb3IuYSk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRleHR1cmUncyBhc3BlY3QgcmF0aW8gY2hhbmdlZCBhbmQgdGhlIGVsZW1lbnQgbmVlZHMgdG8gcHJlc2VydmUgYXNwZWN0IHJhdGlvLCByZWZyZXNoIHRoZSBtZXNoXG4gICAgICAgICAgICBjb25zdCBuZXdBc3BlY3RSYXRpbyA9IHRoaXMuX3RleHR1cmUud2lkdGggLyB0aGlzLl90ZXh0dXJlLmhlaWdodDtcbiAgICAgICAgICAgIGlmIChuZXdBc3BlY3RSYXRpbyAhPT0gdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IG5ld0FzcGVjdFJhdGlvO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9lbGVtZW50LmZpdE1vZGUgIT09IEZJVE1PREVfU1RSRVRDSCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlZnJlc2hNZXNoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2xlYXIgdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJyk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJyk7XG5cbiAgICAgICAgICAgIC8vIHJlc2V0IHRhcmdldCBhc3BlY3QgcmF0aW8gYW5kIHJlZnJlc2ggbWVzaCBpZiB0aGVyZSBpcyBhbiBhc3BlY3QgcmF0aW8gc2V0dGluZ1xuICAgICAgICAgICAgLy8gdGhpcyBpcyBuZWVkZWQgaW4gb3JkZXIgdG8gcHJvcGVybHkgcmVzZXQgdGhlIG1lc2ggdG8gJ3N0cmV0Y2gnIGFjcm9zcyB0aGUgZW50aXJlIGVsZW1lbnQgYm91bmRzXG4gICAgICAgICAgICAvLyB3aGVuIHJlc2V0dGluZyB0aGUgdGV4dHVyZVxuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8gPSAtMTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9lbGVtZW50LmZpdE1vZGUgIT09IEZJVE1PREVfU1RSRVRDSCkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVmcmVzaE1lc2goKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0ZXh0dXJlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dHVyZTtcbiAgICB9XG5cbiAgICBzZXQgdGV4dHVyZUFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgX2lkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCAhPT0gX2lkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl90ZXh0dXJlQXNzZXQsIHRoaXMuX29uVGV4dHVyZUFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fdGV4dHVyZUFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoX3ByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgX3ByZXYub2ZmKCdsb2FkJywgdGhpcy5fb25UZXh0dXJlTG9hZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZignY2hhbmdlJywgdGhpcy5fb25UZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgX3ByZXYub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblRleHR1cmVSZW1vdmUsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fdGV4dHVyZUFzc2V0ID0gX2lkO1xuICAgICAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uKCdhZGQ6JyArIHRoaXMuX3RleHR1cmVBc3NldCwgdGhpcy5fb25UZXh0dXJlQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRUZXh0dXJlQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0ZXh0dXJlQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlQXNzZXQ7XG4gICAgfVxuXG4gICAgc2V0IHNwcml0ZUFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgX2lkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fc3ByaXRlQXNzZXQsIHRoaXMuX29uU3ByaXRlQXNzZXRBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgX3ByZXYgPSBhc3NldHMuZ2V0KHRoaXMuX3Nwcml0ZUFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoX3ByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kU3ByaXRlQXNzZXQoX3ByZXYpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fc3ByaXRlQXNzZXQgPSBfaWQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fc3ByaXRlQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBhc3NldHMub24oJ2FkZDonICsgdGhpcy5fc3ByaXRlQXNzZXQsIHRoaXMuX29uU3ByaXRlQXNzZXRBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYmluZFNwcml0ZUFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmZpcmUoJ3NldDpzcHJpdGVBc3NldCcsIF9pZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3ByaXRlQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcHJpdGVBc3NldDtcbiAgICB9XG5cbiAgICBzZXQgc3ByaXRlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fdW5iaW5kU3ByaXRlKHRoaXMuX3Nwcml0ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHNwcml0ZUFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX3Nwcml0ZUFzc2V0KTtcbiAgICAgICAgICAgIGlmIChzcHJpdGVBc3NldCAmJiBzcHJpdGVBc3NldC5yZXNvdXJjZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNwcml0ZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3Nwcml0ZSA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGUodGhpcy5fc3ByaXRlKTtcblxuICAgICAgICAgICAgLy8gY2xlYXIgdGV4dHVyZSBpZiBzcHJpdGUgaXMgYmVpbmcgc2V0XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSAmJiB0aGlzLl9zcHJpdGUuYXRsYXMgJiYgdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUpIHtcbiAgICAgICAgICAgIC8vIGRlZmF1bHQgdGV4dHVyZSBqdXN0IHVzZXMgZW1pc3NpdmUgYW5kIG9wYWNpdHkgbWFwc1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJywgdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2xlYXIgdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJyk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbGFtcCBmcmFtZVxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9zcHJpdGVGcmFtZSA9IG1hdGguY2xhbXAodGhpcy5fc3ByaXRlRnJhbWUsIDAsIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXMubGVuZ3RoIC0gMSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91cGRhdGVTcHJpdGUoKTtcbiAgICB9XG5cbiAgICBnZXQgc3ByaXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3ByaXRlO1xuICAgIH1cblxuICAgIHNldCBzcHJpdGVGcmFtZSh2YWx1ZSkge1xuICAgICAgICBjb25zdCBvbGRWYWx1ZSA9IHRoaXMuX3Nwcml0ZUZyYW1lO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIC8vIGNsYW1wIGZyYW1lXG4gICAgICAgICAgICB0aGlzLl9zcHJpdGVGcmFtZSA9IG1hdGguY2xhbXAodmFsdWUsIDAsIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXMubGVuZ3RoIC0gMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zcHJpdGVGcmFtZSA9IHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUZyYW1lICE9PSBvbGRWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlU3ByaXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5maXJlKCdzZXQ6c3ByaXRlRnJhbWUnLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3ByaXRlRnJhbWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcHJpdGVGcmFtZTtcbiAgICB9XG5cbiAgICBzZXQgbWVzaCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1lc2godmFsdWUpO1xuICAgICAgICBpZiAodGhpcy5fZGVmYXVsdE1lc2ggPT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldEFhYmJGdW5jKG51bGwpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRBYWJiRnVuYyh0aGlzLl91cGRhdGVBYWJiRnVuYyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWVzaCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlcmFibGUubWVzaDtcbiAgICB9XG5cbiAgICBzZXQgbWFzayh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWFzayAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX21hc2sgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3RvZ2dsZU1hc2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXNrKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFzaztcbiAgICB9XG5cbiAgICBzZXQgcGl4ZWxzUGVyVW5pdCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fcGl4ZWxzUGVyVW5pdCA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9waXhlbHNQZXJVbml0ID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUgJiYgKHRoaXMuX3Nwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHwgdGhpcy5fc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlU3ByaXRlKCk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGdldCBwaXhlbHNQZXJVbml0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGl4ZWxzUGVyVW5pdDtcbiAgICB9XG5cbiAgICAvLyBwcml2YXRlXG4gICAgZ2V0IGFhYmIoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlLm1lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlLmFhYmI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG5leHBvcnQgeyBJbWFnZUVsZW1lbnQgfTtcbiJdLCJuYW1lcyI6WyJfdmVydGV4Rm9ybWF0RGV2aWNlQ2FjaGUiLCJEZXZpY2VDYWNoZSIsIkltYWdlUmVuZGVyYWJsZSIsImNvbnN0cnVjdG9yIiwiZW50aXR5IiwibWVzaCIsIm1hdGVyaWFsIiwiX2VudGl0eSIsIl9lbGVtZW50IiwiZWxlbWVudCIsIm1vZGVsIiwiTW9kZWwiLCJub2RlIiwiR3JhcGhOb2RlIiwiZ3JhcGgiLCJtZXNoSW5zdGFuY2UiLCJNZXNoSW5zdGFuY2UiLCJuYW1lIiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJfbWVzaERpcnR5IiwibWVzaEluc3RhbmNlcyIsInB1c2giLCJhZGRDaGlsZCIsInVubWFza01lc2hJbnN0YW5jZSIsImRlc3Ryb3kiLCJzZXRNYXRlcmlhbCIsInJlbW92ZU1vZGVsRnJvbUxheWVycyIsInNldE1lc2giLCJ2aXNpYmxlIiwiZm9yY2VVcGRhdGVBYWJiIiwic2V0TWFzayIsIm1hc2siLCJwaWNrIiwicGFyYW1ldGVycyIsInNldFBhcmFtZXRlciIsImRhdGEiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwiZW5hYmxlZCIsImFkZE1vZGVsVG9MYXllcnMiLCJ2YWx1ZSIsImRlbGV0ZVBhcmFtZXRlciIsInNldFVubWFza0RyYXdPcmRlciIsImdldExhc3RDaGlsZCIsImUiLCJsYXN0IiwiYyIsImNoaWxkcmVuIiwibCIsImxlbmd0aCIsImkiLCJjaGlsZCIsImxhc3RDaGlsZCIsImRyYXdPcmRlciIsImdldE1hc2tPZmZzZXQiLCJEZWJ1ZyIsInRyYWNlIiwiVFJBQ0VfSURfRUxFTUVOVCIsInNldERyYXdPcmRlciIsInNldEN1bGwiLCJjdWxsIiwidmlzaWJsZUZuIiwiX2lzU2NyZWVuU3BhY2UiLCJjYW1lcmEiLCJpc1Zpc2libGVGb3JDYW1lcmEiLCJpc1Zpc2libGVGdW5jIiwic2V0U2NyZWVuU3BhY2UiLCJzY3JlZW5TcGFjZSIsInNldExheWVyIiwibGF5ZXIiLCJfYWFiYlZlciIsInNldEFhYmJGdW5jIiwiZm4iLCJfdXBkYXRlQWFiYkZ1bmMiLCJJbWFnZUVsZW1lbnQiLCJfc3lzdGVtIiwic3lzdGVtIiwiX3RleHR1cmVBc3NldCIsIl90ZXh0dXJlIiwiX21hdGVyaWFsQXNzZXQiLCJfbWF0ZXJpYWwiLCJfc3ByaXRlQXNzZXQiLCJfc3ByaXRlIiwiX3Nwcml0ZUZyYW1lIiwiX3BpeGVsc1BlclVuaXQiLCJfdGFyZ2V0QXNwZWN0UmF0aW8iLCJfcmVjdCIsIlZlYzQiLCJfbWFzayIsIl9tYXNrUmVmIiwiX291dGVyU2NhbGUiLCJWZWMyIiwiX291dGVyU2NhbGVVbmlmb3JtIiwiRmxvYXQzMkFycmF5IiwiX2lubmVyT2Zmc2V0IiwiX2lubmVyT2Zmc2V0VW5pZm9ybSIsIl9hdGxhc1JlY3QiLCJfYXRsYXNSZWN0VW5pZm9ybSIsIl9kZWZhdWx0TWVzaCIsIl9jcmVhdGVNZXNoIiwiX3JlbmRlcmFibGUiLCJfY29sb3IiLCJDb2xvciIsIl9jb2xvclVuaWZvcm0iLCJfdXBkYXRlQWFiYiIsImJpbmQiLCJfb25TY3JlZW5DaGFuZ2UiLCJzY3JlZW4iLCJvbiIsIl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UiLCJfb25TY3JlZW5TcGFjZUNoYW5nZSIsIl9vbkRyYXdPcmRlckNoYW5nZSIsIl9vblJlc29sdXRpb25DaGFuZ2UiLCJ0ZXh0dXJlQXNzZXQiLCJzcHJpdGVBc3NldCIsIm1hdGVyaWFsQXNzZXQiLCJvZmYiLCJyZXMiLCJfdXBkYXRlTWVzaCIsIl91cGRhdGVNYXRlcmlhbCIsInByZXZpb3VzIiwib3JkZXIiLCJvbmNlIiwiX2hhc1VzZXJNYXRlcmlhbCIsImRlZmF1bHRJbWFnZU1hdGVyaWFscyIsIl91c2U5U2xpY2luZyIsInNwcml0ZSIsInJlbmRlck1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQiLCJTUFJJVEVfUkVOREVSTU9ERV9USUxFRCIsIm5pbmVTbGljZWQiLCJuaW5lVGlsZWQiLCJnZXRJbWFnZUVsZW1lbnRNYXRlcmlhbCIsIl9pc1NjcmVlbkN1bGxlZCIsIkxBWUVSX0hVRCIsIkxBWUVSX1dPUkxEIiwidyIsImNhbGN1bGF0ZWRXaWR0aCIsImgiLCJjYWxjdWxhdGVkSGVpZ2h0IiwiciIsImRldmljZSIsImFwcCIsImdyYXBoaWNzRGV2aWNlIiwidmVydGV4RGF0YSIsIngiLCJ6IiwieSIsInZlcnRleEZvcm1hdCIsImdldCIsIlZlcnRleEZvcm1hdCIsInNlbWFudGljIiwiU0VNQU5USUNfUE9TSVRJT04iLCJjb21wb25lbnRzIiwidHlwZSIsIlRZUEVfRkxPQVQzMiIsIlNFTUFOVElDX05PUk1BTCIsIlNFTUFOVElDX1RFWENPT1JEMCIsInZlcnRleEJ1ZmZlciIsIlZlcnRleEJ1ZmZlciIsIkJVRkZFUl9TVEFUSUMiLCJidWZmZXIiLCJNZXNoIiwicHJpbWl0aXZlIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiYmFzZSIsImNvdW50IiwiaW5kZXhlZCIsImFhYmIiLCJzZXRNaW5NYXgiLCJWZWMzIiwiWkVSTyIsImZpdE1vZGUiLCJGSVRNT0RFX1NUUkVUQ0giLCJhY3R1YWxSYXRpbyIsIkZJVE1PREVfQ09OVEFJTiIsIkZJVE1PREVfQ09WRVIiLCJmcmFtZURhdGEiLCJhdGxhcyIsImZyYW1lcyIsImZyYW1lS2V5cyIsImJvcmRlcldpZHRoU2NhbGUiLCJyZWN0IiwiYm9yZGVySGVpZ2h0U2NhbGUiLCJzZXQiLCJib3JkZXIiLCJ0ZXgiLCJ0ZXh0dXJlIiwid2lkdGgiLCJoZWlnaHQiLCJwcHUiLCJwaXhlbHNQZXJVbml0Iiwic2NhbGVNdWxYIiwic2NhbGVNdWxZIiwiTWF0aCIsIm1heCIsInNjYWxlWCIsInNjYWxlWSIsIm1hdGgiLCJjbGFtcCIsInNldExvY2FsU2NhbGUiLCJzZXRMb2NhbFBvc2l0aW9uIiwicGl2b3QiLCJ2YiIsInZlcnRleERhdGFGMzIiLCJsb2NrIiwiaHAiLCJ2cCIsImF0bGFzVGV4dHVyZVdpZHRoIiwiYXRsYXNUZXh0dXJlSGVpZ2h0IiwiZnJhbWUiLCJ1bmxvY2siLCJtaW4iLCJfdXBkYXRlU3ByaXRlIiwibmluZVNsaWNlIiwibWVzaGVzIiwic3ByaXRlRnJhbWUiLCJyZWZyZXNoTWVzaCIsIl9iZWluZ0luaXRpYWxpemVkIiwiY2VudGVyIiwiaGFsZkV4dGVudHMiLCJzZXRGcm9tVHJhbnNmb3JtZWRBYWJiIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJfdG9nZ2xlTWFzayIsIl9kaXJ0aWZ5TWFzayIsIl9vbk1hdGVyaWFsTG9hZCIsImFzc2V0IiwicmVzb3VyY2UiLCJfb25NYXRlcmlhbEFkZGVkIiwiYXNzZXRzIiwiaWQiLCJfYmluZE1hdGVyaWFsQXNzZXQiLCJfb25NYXRlcmlhbENoYW5nZSIsIl9vbk1hdGVyaWFsUmVtb3ZlIiwibG9hZCIsIl91bmJpbmRNYXRlcmlhbEFzc2V0IiwiX29uVGV4dHVyZUFkZGVkIiwiX2JpbmRUZXh0dXJlQXNzZXQiLCJfb25UZXh0dXJlTG9hZCIsIl9vblRleHR1cmVDaGFuZ2UiLCJfb25UZXh0dXJlUmVtb3ZlIiwiX3VuYmluZFRleHR1cmVBc3NldCIsIl9vblNwcml0ZUFzc2V0QWRkZWQiLCJfYmluZFNwcml0ZUFzc2V0IiwiX29uU3ByaXRlQXNzZXRMb2FkIiwiX29uU3ByaXRlQXNzZXRDaGFuZ2UiLCJfb25TcHJpdGVBc3NldFJlbW92ZSIsIl91bmJpbmRTcHJpdGVBc3NldCIsInRleHR1cmVBdGxhc0Fzc2V0IiwiX29uVGV4dHVyZUF0bGFzTG9hZCIsImF0bGFzQXNzZXRJZCIsIl9iaW5kU3ByaXRlIiwiX29uU3ByaXRlTWVzaGVzQ2hhbmdlIiwiX29uU3ByaXRlUHB1Q2hhbmdlIiwiX29uQXRsYXNUZXh0dXJlQ2hhbmdlIiwiX3VuYmluZFNwcml0ZSIsIlNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSIsImF0bGFzQXNzZXQiLCJBc3NldCIsIm9uRW5hYmxlIiwib25EaXNhYmxlIiwiX3NldFN0ZW5jaWwiLCJzdGVuY2lsUGFyYW1zIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJyZWYiLCJtYXNrZWRCeSIsIl9pbWFnZSIsInNwIiwiU3RlbmNpbFBhcmFtZXRlcnMiLCJmdW5jIiwiRlVOQ19FUVVBTCIsInpwYXNzIiwiU1RFTkNJTE9QX0RFQ1JFTUVOVCIsImNvbG9yIiwiZyIsImIiLCJ3YXJuIiwiZmlyZSIsIm9wYWNpdHkiLCJhIiwiY29uc29sZSIsIl9yZW1vdmVNYXRlcmlhbEFzc2V0RXZlbnRzIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsIiwiZGVmYXVsdEltYWdlTWF0ZXJpYWwiLCJfaWQiLCJuZXdBc3BlY3RSYXRpbyIsIl9wcmV2Iiwib2xkVmFsdWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUNBLE1BQU1BLHdCQUF3QixHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBO0FBRWxELE1BQU1DLGVBQWUsQ0FBQztBQUNsQkMsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxJQUFJLEVBQUVDLFFBQVEsRUFBRTtJQUNoQyxJQUFJLENBQUNDLE9BQU8sR0FBR0gsTUFBTSxDQUFBO0FBQ3JCLElBQUEsSUFBSSxDQUFDSSxRQUFRLEdBQUdKLE1BQU0sQ0FBQ0ssT0FBTyxDQUFBO0FBRTlCLElBQUEsSUFBSSxDQUFDQyxLQUFLLEdBQUcsSUFBSUMsS0FBSyxFQUFFLENBQUE7QUFDeEIsSUFBQSxJQUFJ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
