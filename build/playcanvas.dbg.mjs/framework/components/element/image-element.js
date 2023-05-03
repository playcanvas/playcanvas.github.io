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
        this.materialAsset = null;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2UtZWxlbWVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9jb21wb25lbnRzL2VsZW1lbnQvaW1hZ2UtZWxlbWVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgVFJBQ0VfSURfRUxFTUVOVCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHtcbiAgICBCVUZGRVJfU1RBVElDLFxuICAgIEZVTkNfRVFVQUwsXG4gICAgUFJJTUlUSVZFX1RSSVNUUklQLFxuICAgIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19OT1JNQUwsIFNFTUFOVElDX1RFWENPT1JEMCxcbiAgICBTVEVOQ0lMT1BfREVDUkVNRU5ULFxuICAgIFRZUEVfRkxPQVQzMlxufSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVmVydGV4QnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdmVydGV4LWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhGb3JtYXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtZm9ybWF0LmpzJztcbmltcG9ydCB7IERldmljZUNhY2hlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGV2aWNlLWNhY2hlLmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUl9IVUQsIExBWUVSX1dPUkxELFxuICAgIFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSwgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWVzaC5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9zdGVuY2lsLXBhcmFtZXRlcnMuanMnO1xuXG5pbXBvcnQgeyBGSVRNT0RFX1NUUkVUQ0gsIEZJVE1PREVfQ09OVEFJTiwgRklUTU9ERV9DT1ZFUiB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmNvbnN0IF92ZXJ0ZXhGb3JtYXREZXZpY2VDYWNoZSA9IG5ldyBEZXZpY2VDYWNoZSgpO1xuXG5jbGFzcyBJbWFnZVJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKGVudGl0eSwgbWVzaCwgbWF0ZXJpYWwpIHtcbiAgICAgICAgdGhpcy5fZW50aXR5ID0gZW50aXR5O1xuICAgICAgICB0aGlzLl9lbGVtZW50ID0gZW50aXR5LmVsZW1lbnQ7XG5cbiAgICAgICAgdGhpcy5tb2RlbCA9IG5ldyBNb2RlbCgpO1xuICAgICAgICB0aGlzLm5vZGUgPSBuZXcgR3JhcGhOb2RlKCk7XG4gICAgICAgIHRoaXMubW9kZWwuZ3JhcGggPSB0aGlzLm5vZGU7XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgbWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLm5hbWUgPSAnSW1hZ2VFbGVtZW50OiAnICsgZW50aXR5Lm5hbWU7XG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX21lc2hEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMubW9kZWwubWVzaEluc3RhbmNlcy5wdXNoKHRoaXMubWVzaEluc3RhbmNlKTtcblxuICAgICAgICB0aGlzLl9lbnRpdHkuYWRkQ2hpbGQodGhpcy5tb2RlbC5ncmFwaCk7XG4gICAgICAgIHRoaXMubW9kZWwuX2VudGl0eSA9IHRoaXMuX2VudGl0eTtcblxuICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5zZXRNYXRlcmlhbChudWxsKTsgLy8gY2xlYXIgbWF0ZXJpYWwgcmVmZXJlbmNlc1xuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgdGhpcy5tb2RlbC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICB0aGlzLm5vZGUgPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2ggPSBudWxsO1xuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VudGl0eSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBudWxsO1xuICAgIH1cblxuICAgIHNldE1lc2gobWVzaCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoID0gbWVzaDtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tZXNoID0gbWVzaDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UudmlzaWJsZSA9ICEhbWVzaDtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1lc2ggPSBtZXNoO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZm9yY2VVcGRhdGVBYWJiKCk7XG4gICAgfVxuXG4gICAgc2V0TWFzayhtYXNrKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKHRoaXMubWVzaCwgdGhpcy5tZXNoSW5zdGFuY2UubWF0ZXJpYWwsIHRoaXMubm9kZSk7XG4gICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5uYW1lID0gJ1VubWFzazogJyArIHRoaXMuX2VudGl0eS5uYW1lO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuY2FzdFNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UucGljayA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMucHVzaCh0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIC8vIGNvcHkgcGFyYW1ldGVyc1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMubWVzaEluc3RhbmNlLnBhcmFtZXRlcnMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIobmFtZSwgdGhpcy5tZXNoSW5zdGFuY2UucGFyYW1ldGVyc1tuYW1lXS5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSB1bm1hc2sgbWVzaCBpbnN0YW5jZSBmcm9tIG1vZGVsXG4gICAgICAgICAgICBjb25zdCBpZHggPSB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuaW5kZXhPZih0aGlzLnVubWFza01lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1vZGVsLm1lc2hJbnN0YW5jZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBtb2RlbCB0aGVuIHJlLWFkZCB0byB1cGRhdGUgdG8gY3VycmVudCBtZXNoIGluc3RhbmNlc1xuICAgICAgICBpZiAodGhpcy5fZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fZWxlbWVudC5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuYWRkTW9kZWxUb0xheWVycyh0aGlzLm1vZGVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldE1hdGVyaWFsKG1hdGVyaWFsKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRQYXJhbWV0ZXIobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLm1lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihuYW1lLCB2YWx1ZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKG5hbWUsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGRlbGV0ZVBhcmFtZXRlcihuYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0VW5tYXNrRHJhd09yZGVyKCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZ2V0TGFzdENoaWxkID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGxldCBsYXN0O1xuICAgICAgICAgICAgY29uc3QgYyA9IGUuY2hpbGRyZW47XG4gICAgICAgICAgICBjb25zdCBsID0gYy5sZW5ndGg7XG4gICAgICAgICAgICBpZiAobCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjW2ldLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3QgPSBjW2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCFsYXN0KSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gZ2V0TGFzdENoaWxkKGxhc3QpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBsYXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gVGhlIHVubWFzayBtZXNoIGluc3RhbmNlIHJlbmRlcnMgaW50byB0aGUgc3RlbmNpbCBidWZmZXJcbiAgICAgICAgLy8gd2l0aCB0aGUgcmVmIG9mIHRoZSBwcmV2aW91cyBtYXNrLiBUaGlzIGVzc2VudGlhbGx5IFwiY2xlYXJzXCJcbiAgICAgICAgLy8gdGhlIG1hc2sgdmFsdWVcbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGhlIHVubWFzayBoYXMgYSBkcmF3T3JkZXIgc2V0IHRvIGJlIG1pZC13YXkgYmV0d2VlbiB0aGUgbGFzdCBjaGlsZCBvZiB0aGVcbiAgICAgICAgLy8gbWFza2VkIGhpZXJhcmNoeSBhbmQgdGhlIG5leHQgY2hpbGQgdG8gYmUgZHJhd24uXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRoZSBvZmZzZXQgaXMgcmVkdWNlZCBieSBhIHNtYWxsIGZyYWN0aW9uIGVhY2ggdGltZSBzbyB0aGF0IGlmIG11bHRpcGxlIG1hc2tzXG4gICAgICAgIC8vIGVuZCBvbiB0aGUgc2FtZSBsYXN0IGNoaWxkIHRoZXkgYXJlIHVubWFza2VkIGluIHRoZSBjb3JyZWN0IG9yZGVyLlxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IGxhc3RDaGlsZCA9IGdldExhc3RDaGlsZCh0aGlzLl9lbnRpdHkpO1xuICAgICAgICAgICAgaWYgKGxhc3RDaGlsZCAmJiBsYXN0Q2hpbGQuZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IGxhc3RDaGlsZC5lbGVtZW50LmRyYXdPcmRlciArIGxhc3RDaGlsZC5lbGVtZW50LmdldE1hc2tPZmZzZXQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdGhpcy5tZXNoSW5zdGFuY2UuZHJhd09yZGVyICsgdGhpcy5fZWxlbWVudC5nZXRNYXNrT2Zmc2V0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRV9JRF9FTEVNRU5ULCAnc2V0RHJhd09yZGVyOiAnLCB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5uYW1lLCB0aGlzLnVubWFza01lc2hJbnN0YW5jZS5kcmF3T3JkZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0RHJhd09yZGVyKGRyYXdPcmRlcikge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFX0lEX0VMRU1FTlQsICdzZXREcmF3T3JkZXI6ICcsIHRoaXMubWVzaEluc3RhbmNlLm5hbWUsIGRyYXdPcmRlcik7XG5cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gZHJhd09yZGVyO1xuICAgIH1cblxuICAgIHNldEN1bGwoY3VsbCkge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9lbGVtZW50O1xuXG4gICAgICAgIGxldCB2aXNpYmxlRm4gPSBudWxsO1xuICAgICAgICBpZiAoY3VsbCAmJiBlbGVtZW50Ll9pc1NjcmVlblNwYWNlKCkpIHtcbiAgICAgICAgICAgIHZpc2libGVGbiA9IGZ1bmN0aW9uIChjYW1lcmEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZWxlbWVudC5pc1Zpc2libGVGb3JDYW1lcmEoY2FtZXJhKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5jdWxsID0gY3VsbDtcbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuaXNWaXNpYmxlRnVuYyA9IHZpc2libGVGbjtcblxuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLmN1bGwgPSBjdWxsO1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuaXNWaXNpYmxlRnVuYyA9IHZpc2libGVGbjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldFNjcmVlblNwYWNlKHNjcmVlblNwYWNlKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5zY3JlZW5TcGFjZSA9IHNjcmVlblNwYWNlO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2Uuc2NyZWVuU3BhY2UgPSBzY3JlZW5TcGFjZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldExheWVyKGxheWVyKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5sYXllciA9IGxheWVyO1xuXG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UubGF5ZXIgPSBsYXllcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvcmNlVXBkYXRlQWFiYihtYXNrKSB7XG4gICAgICAgIGlmICghdGhpcy5tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZS5fYWFiYlZlciA9IC0xO1xuICAgICAgICBpZiAodGhpcy51bm1hc2tNZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMudW5tYXNrTWVzaEluc3RhbmNlLl9hYWJiVmVyID0gLTE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRBYWJiRnVuYyhmbikge1xuICAgICAgICBpZiAoIXRoaXMubWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmJGdW5jID0gZm47XG4gICAgICAgIGlmICh0aGlzLnVubWFza01lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy51bm1hc2tNZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmJGdW5jID0gZm47XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmNsYXNzIEltYWdlRWxlbWVudCB7XG4gICAgY29uc3RydWN0b3IoZWxlbWVudCkge1xuICAgICAgICB0aGlzLl9lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgICAgdGhpcy5fZW50aXR5ID0gZWxlbWVudC5lbnRpdHk7XG4gICAgICAgIHRoaXMuX3N5c3RlbSA9IGVsZW1lbnQuc3lzdGVtO1xuXG4gICAgICAgIC8vIHB1YmxpY1xuICAgICAgICB0aGlzLl90ZXh0dXJlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl90ZXh0dXJlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9zcHJpdGUgPSBudWxsO1xuICAgICAgICB0aGlzLl9zcHJpdGVGcmFtZSA9IDA7XG4gICAgICAgIHRoaXMuX3BpeGVsc1BlclVuaXQgPSBudWxsO1xuICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IC0xOyAvLyB3aWxsIGJlIHNldCB3aGVuIGFzc2lnbmluZyB0ZXh0dXJlc1xuXG4gICAgICAgIHRoaXMuX3JlY3QgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTsgLy8geCwgeSwgdywgaFxuXG4gICAgICAgIHRoaXMuX21hc2sgPSBmYWxzZTsgLy8gdGhpcyBpbWFnZSBlbGVtZW50IGlzIGEgbWFza1xuICAgICAgICB0aGlzLl9tYXNrUmVmID0gMDsgLy8gaWQgdXNlZCBpbiBzdGVuY2lsIGJ1ZmZlciB0byBtYXNrXG5cbiAgICAgICAgLy8gOS1zbGljaW5nXG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUgPSBuZXcgVmVjMigpO1xuICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0ID0gbmV3IFZlYzQoKTtcbiAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5fYXRsYXNSZWN0ID0gbmV3IFZlYzQoKTtcbiAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG5cbiAgICAgICAgdGhpcy5fZGVmYXVsdE1lc2ggPSB0aGlzLl9jcmVhdGVNZXNoKCk7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUgPSBuZXcgSW1hZ2VSZW5kZXJhYmxlKHRoaXMuX2VudGl0eSwgdGhpcy5fZGVmYXVsdE1lc2gsIHRoaXMuX21hdGVyaWFsKTtcblxuICAgICAgICAvLyBzZXQgZGVmYXVsdCBjb2xvcnNcbiAgICAgICAgdGhpcy5fY29sb3IgPSBuZXcgQ29sb3IoMSwgMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoWzEsIDEsIDFdKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2VtaXNzaXZlJywgdGhpcy5fY29sb3JVbmlmb3JtKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCAxKTtcblxuICAgICAgICB0aGlzLl91cGRhdGVBYWJiRnVuYyA9IHRoaXMuX3VwZGF0ZUFhYmIuYmluZCh0aGlzKTtcblxuICAgICAgICAvLyBpbml0aWFsaXplIGJhc2VkIG9uIHNjcmVlblxuICAgICAgICB0aGlzLl9vblNjcmVlbkNoYW5nZSh0aGlzLl9lbGVtZW50LnNjcmVlbik7XG5cbiAgICAgICAgLy8gbGlzdGVuIGZvciBldmVudHNcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vbigncmVzaXplJywgdGhpcy5fb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vbignc2V0OnBpdm90JywgdGhpcy5fb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vbignc2NyZWVuOnNldDpzY3JlZW5zcGFjZScsIHRoaXMuX29uU2NyZWVuU3BhY2VDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzZXQ6c2NyZWVuJywgdGhpcy5fb25TY3JlZW5DaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzZXQ6ZHJhd29yZGVyJywgdGhpcy5fb25EcmF3T3JkZXJDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9uKCdzY3JlZW46c2V0OnJlc29sdXRpb24nLCB0aGlzLl9vblJlc29sdXRpb25DaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIHJlc2V0IGFsbCBhc3NldHMgdG8gdW5iaW5kIGFsbCBhc3NldCBldmVudHNcbiAgICAgICAgdGhpcy50ZXh0dXJlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLnNwcml0ZUFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYXRlcmlhbEFzc2V0ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1lc2godGhpcy5fZGVmYXVsdE1lc2gpO1xuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fZGVmYXVsdE1lc2ggPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdyZXNpemUnLCB0aGlzLl9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2V0OnBpdm90JywgdGhpcy5fb25QYXJlbnRSZXNpemVPclBpdm90Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NjcmVlbjpzZXQ6c2NyZWVuc3BhY2UnLCB0aGlzLl9vblNjcmVlblNwYWNlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NldDpzY3JlZW4nLCB0aGlzLl9vblNjcmVlbkNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzZXQ6ZHJhd29yZGVyJywgdGhpcy5fb25EcmF3T3JkZXJDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2NyZWVuOnNldDpyZXNvbHV0aW9uJywgdGhpcy5fb25SZXNvbHV0aW9uQ2hhbmdlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25SZXNvbHV0aW9uQ2hhbmdlKHJlcykge1xuICAgIH1cblxuICAgIF9vblBhcmVudFJlc2l6ZU9yUGl2b3RDaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5fcmVuZGVyYWJsZS5tZXNoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNjcmVlblNwYWNlQ2hhbmdlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHZhbHVlKTtcbiAgICB9XG5cbiAgICBfb25TY3JlZW5DaGFuZ2Uoc2NyZWVuLCBwcmV2aW91cykge1xuICAgICAgICBpZiAoc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbChzY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlKTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoZmFsc2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uRHJhd09yZGVyQ2hhbmdlKG9yZGVyKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0RHJhd09yZGVyKG9yZGVyKTtcblxuICAgICAgICBpZiAodGhpcy5tYXNrICYmIHRoaXMuX2VsZW1lbnQuc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LnNjcmVlbi5zY3JlZW4ub25jZSgnc3luY2RyYXdvcmRlcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFVubWFza0RyYXdPcmRlcigpO1xuICAgICAgICAgICAgfSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZXR1cm5zIHRydWUgaWYgd2UgYXJlIHVzaW5nIGEgbWF0ZXJpYWxcbiAgICAvLyBvdGhlciB0aGFuIHRoZSBkZWZhdWx0IG1hdGVyaWFsc1xuICAgIF9oYXNVc2VyTWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiAhIXRoaXMuX21hdGVyaWFsQXNzZXQgfHxcbiAgICAgICAgICAgICAgICghIXRoaXMuX21hdGVyaWFsICYmXG4gICAgICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5pbmRleE9mKHRoaXMuX21hdGVyaWFsKSA9PT0gLTEpO1xuICAgIH1cblxuICAgIF91c2U5U2xpY2luZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3ByaXRlICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpO1xuICAgIH1cblxuICAgIF91cGRhdGVNYXRlcmlhbChzY3JlZW5TcGFjZSkge1xuICAgICAgICBjb25zdCBtYXNrID0gISF0aGlzLl9tYXNrO1xuICAgICAgICBjb25zdCBuaW5lU2xpY2VkID0gISEodGhpcy5zcHJpdGUgJiYgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKTtcbiAgICAgICAgY29uc3QgbmluZVRpbGVkID0gISEodGhpcy5zcHJpdGUgJiYgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpO1xuXG4gICAgICAgIGlmICghdGhpcy5faGFzVXNlck1hdGVyaWFsKCkpIHtcbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsID0gdGhpcy5fc3lzdGVtLmdldEltYWdlRWxlbWVudE1hdGVyaWFsKHNjcmVlblNwYWNlLCBtYXNrLCBuaW5lU2xpY2VkLCBuaW5lVGlsZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUpIHtcbiAgICAgICAgICAgIC8vIGN1bGxpbmcgaXMgYWx3YXlzIHRydWUgZm9yIG5vbi1zY3JlZW5zcGFjZSAoZnJ1c3RydW0gaXMgdXNlZCk7IGZvciBzY3JlZW5zcGFjZSwgdXNlIHRoZSAnY3VsbCcgcHJvcGVydHlcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0Q3VsbCghdGhpcy5fZWxlbWVudC5faXNTY3JlZW5TcGFjZSgpIHx8IHRoaXMuX2VsZW1lbnQuX2lzU2NyZWVuQ3VsbGVkKCkpO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRNYXRlcmlhbCh0aGlzLl9tYXRlcmlhbCk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFNjcmVlblNwYWNlKHNjcmVlblNwYWNlKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TGF5ZXIoc2NyZWVuU3BhY2UgPyBMQVlFUl9IVUQgOiBMQVlFUl9XT1JMRCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBidWlsZCBhIHF1YWQgZm9yIHRoZSBpbWFnZVxuICAgIF9jcmVhdGVNZXNoKCkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5fZWxlbWVudDtcbiAgICAgICAgY29uc3QgdyA9IGVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoO1xuICAgICAgICBjb25zdCBoID0gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuICAgICAgICBjb25zdCByID0gdGhpcy5fcmVjdDtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5fc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcblxuICAgICAgICAvLyBjb250ZW50IG9mIHRoZSB2ZXJ0ZXggYnVmZmVyIGZvciA0IHZlcnRpY2VzLCByZW5kZXJlZCBhcyBhIHRyaXN0cmlwXG4gICAgICAgIGNvbnN0IHZlcnRleERhdGEgPSBuZXcgRmxvYXQzMkFycmF5KFtcbiAgICAgICAgICAgIHcsIDAsIDAsICAgICAgICAgICAgICAgICAgICAgICAgLy8gcG9zaXRpb25cbiAgICAgICAgICAgIDAsIDAsIDEsICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICByLnggKyByLnosIDEuMCAtIHIueSwgICAgICAgICAgIC8vIHV2XG5cbiAgICAgICAgICAgIHcsIGgsIDAsICAgICAgICAgICAgICAgICAgICAgICAgLy8gcG9zaXRpb25cbiAgICAgICAgICAgIDAsIDAsIDEsICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICByLnggKyByLnosIDEuMCAtIChyLnkgKyByLncpLCAgIC8vIHV2XG5cbiAgICAgICAgICAgIDAsIDAsIDAsICAgICAgICAgICAgICAgICAgICAgICAgLy8gcG9zaXRpb25cbiAgICAgICAgICAgIDAsIDAsIDEsICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICByLngsIDEuMCAtIHIueSwgICAgICAgICAgICAgICAgIC8vIHV2XG5cbiAgICAgICAgICAgIDAsIGgsIDAsICAgICAgICAgICAgICAgICAgICAgICAgLy8gcG9zaXRpb25cbiAgICAgICAgICAgIDAsIDAsIDEsICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm9ybWFsXG4gICAgICAgICAgICByLngsIDEuMCAtIChyLnkgKyByLncpICAgICAgICAgIC8vIHV2XG4gICAgICAgIF0pO1xuXG4gICAgICAgIC8vIHBlciBkZXZpY2UgY2FjaGVkIHZlcnRleCBmb3JtYXQsIHRvIHNoYXJlIGl0IGJ5IGFsbCB2ZXJ0ZXggYnVmZmVyc1xuICAgICAgICBjb25zdCB2ZXJ0ZXhGb3JtYXQgPSBfdmVydGV4Rm9ybWF0RGV2aWNlQ2FjaGUuZ2V0KGRldmljZSwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBWZXJ0ZXhGb3JtYXQoZGV2aWNlLCBbXG4gICAgICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfUE9TSVRJT04sIGNvbXBvbmVudHM6IDMsIHR5cGU6IFRZUEVfRkxPQVQzMiB9LFxuICAgICAgICAgICAgICAgIHsgc2VtYW50aWM6IFNFTUFOVElDX05PUk1BTCwgY29tcG9uZW50czogMywgdHlwZTogVFlQRV9GTE9BVDMyIH0sXG4gICAgICAgICAgICAgICAgeyBzZW1hbnRpYzogU0VNQU5USUNfVEVYQ09PUkQwLCBjb21wb25lbnRzOiAyLCB0eXBlOiBUWVBFX0ZMT0FUMzIgfVxuICAgICAgICAgICAgXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHZlcnRleEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIoZGV2aWNlLCB2ZXJ0ZXhGb3JtYXQsIDQsIEJVRkZFUl9TVEFUSUMsIHZlcnRleERhdGEuYnVmZmVyKTtcblxuICAgICAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcbiAgICAgICAgbWVzaC52ZXJ0ZXhCdWZmZXIgPSB2ZXJ0ZXhCdWZmZXI7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLnR5cGUgPSBQUklNSVRJVkVfVFJJU1RSSVA7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmJhc2UgPSAwO1xuICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IDQ7XG4gICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmluZGV4ZWQgPSBmYWxzZTtcbiAgICAgICAgbWVzaC5hYWJiLnNldE1pbk1heChWZWMzLlpFUk8sIG5ldyBWZWMzKHcsIGgsIDApKTtcblxuICAgICAgICB0aGlzLl91cGRhdGVNZXNoKG1lc2gpO1xuXG4gICAgICAgIHJldHVybiBtZXNoO1xuICAgIH1cblxuICAgIF91cGRhdGVNZXNoKG1lc2gpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7XG4gICAgICAgIGxldCB3ID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgIGxldCBoID0gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuXG4gICAgICAgIGlmIChlbGVtZW50LmZpdE1vZGUgIT09IEZJVE1PREVfU1RSRVRDSCAmJiB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbFJhdGlvID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggLyBlbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQ7XG4gICAgICAgICAgICAvLyBjaGVjayB3aGljaCBjb29yZGluYXRlIG11c3QgY2hhbmdlIGluIG9yZGVyIHRvIHByZXNlcnZlIHRoZSBzb3VyY2UgYXNwZWN0IHJhdGlvXG4gICAgICAgICAgICBpZiAoKGVsZW1lbnQuZml0TW9kZSA9PT0gRklUTU9ERV9DT05UQUlOICYmIGFjdHVhbFJhdGlvID4gdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW8pIHx8XG4gICAgICAgICAgICAgICAgKGVsZW1lbnQuZml0TW9kZSA9PT0gRklUTU9ERV9DT1ZFUiAmJiBhY3R1YWxSYXRpbyA8IHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvKSkge1xuICAgICAgICAgICAgICAgIC8vIHVzZSAnaGVpZ2h0JyB0byByZS1jYWxjdWxhdGUgd2lkdGhcbiAgICAgICAgICAgICAgICB3ID0gZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0ICogdGhpcy5fdGFyZ2V0QXNwZWN0UmF0aW87XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHVzZSAnd2lkdGgnIHRvIHJlLWNhbGN1bGF0ZSBoZWlnaHRcbiAgICAgICAgICAgICAgICBoID0gZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggLyB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBtYXRlcmlhbFxuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IGVsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoc2NyZWVuU3BhY2UpO1xuXG4gICAgICAgIC8vIGZvcmNlIHVwZGF0ZSBtZXNoSW5zdGFuY2UgYWFiYlxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyYWJsZSkgdGhpcy5fcmVuZGVyYWJsZS5mb3JjZVVwZGF0ZUFhYmIoKTtcblxuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcblxuICAgICAgICAgICAgLy8gY2FsY3VsYXRlIGlubmVyIG9mZnNldCBmcm9tIHRoZSBmcmFtZSdzIGJvcmRlclxuICAgICAgICAgICAgY29uc3QgZnJhbWVEYXRhID0gdGhpcy5fc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLl9zcHJpdGUuZnJhbWVLZXlzW3RoaXMuX3Nwcml0ZUZyYW1lXV07XG4gICAgICAgICAgICBjb25zdCBib3JkZXJXaWR0aFNjYWxlID0gMiAvIGZyYW1lRGF0YS5yZWN0Lno7XG4gICAgICAgICAgICBjb25zdCBib3JkZXJIZWlnaHRTY2FsZSA9IDIgLyBmcmFtZURhdGEucmVjdC53O1xuXG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldC5zZXQoXG4gICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci54ICogYm9yZGVyV2lkdGhTY2FsZSxcbiAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnkgKiBib3JkZXJIZWlnaHRTY2FsZSxcbiAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnogKiBib3JkZXJXaWR0aFNjYWxlLFxuICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIudyAqIGJvcmRlckhlaWdodFNjYWxlXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBjb25zdCB0ZXggPSB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlO1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0LnNldChmcmFtZURhdGEucmVjdC54IC8gdGV4LndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEucmVjdC55IC8gdGV4LmhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueiAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QudyAvIHRleC5oZWlnaHQpO1xuXG4gICAgICAgICAgICAvLyBzY2FsZTogYXBwbHkgUFBVXG4gICAgICAgICAgICBjb25zdCBwcHUgPSB0aGlzLl9waXhlbHNQZXJVbml0ICE9PSBudWxsID8gdGhpcy5fcGl4ZWxzUGVyVW5pdCA6IHRoaXMuc3ByaXRlLnBpeGVsc1BlclVuaXQ7XG4gICAgICAgICAgICBjb25zdCBzY2FsZU11bFggPSBmcmFtZURhdGEucmVjdC56IC8gcHB1O1xuICAgICAgICAgICAgY29uc3Qgc2NhbGVNdWxZID0gZnJhbWVEYXRhLnJlY3QudyAvIHBwdTtcblxuICAgICAgICAgICAgLy8gc2NhbGUgYm9yZGVycyBpZiBuZWNlc3NhcnkgaW5zdGVhZCBvZiBvdmVybGFwcGluZ1xuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS5zZXQoTWF0aC5tYXgodywgdGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIE1hdGgubWF4KGgsIHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpKTtcblxuICAgICAgICAgICAgbGV0IHNjYWxlWCA9IHNjYWxlTXVsWDtcbiAgICAgICAgICAgIGxldCBzY2FsZVkgPSBzY2FsZU11bFk7XG5cbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUueCAvPSBzY2FsZU11bFg7XG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnkgLz0gc2NhbGVNdWxZO1xuXG4gICAgICAgICAgICAvLyBzY2FsZTogc2hyaW5raW5nIGJlbG93IDFcbiAgICAgICAgICAgIHNjYWxlWCAqPSBtYXRoLmNsYW1wKHcgLyAodGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIDAuMDAwMSwgMSk7XG4gICAgICAgICAgICBzY2FsZVkgKj0gbWF0aC5jbGFtcChoIC8gKHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpLCAwLjAwMDEsIDEpO1xuXG4gICAgICAgICAgICAvLyBzZXQgc2NhbGVcbiAgICAgICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzBdID0gdGhpcy5faW5uZXJPZmZzZXQueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMV0gPSB0aGlzLl9pbm5lck9mZnNldC55O1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVsyXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lno7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzNdID0gdGhpcy5faW5uZXJPZmZzZXQudztcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignaW5uZXJPZmZzZXQnLCB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bMF0gPSB0aGlzLl9hdGxhc1JlY3QueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzFdID0gdGhpcy5fYXRsYXNSZWN0Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsyXSA9IHRoaXMuX2F0bGFzUmVjdC56O1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm1bM10gPSB0aGlzLl9hdGxhc1JlY3QudztcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignYXRsYXNSZWN0JywgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm1bMF0gPSB0aGlzLl9vdXRlclNjYWxlLng7XG4gICAgICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm1bMV0gPSB0aGlzLl9vdXRlclNjYWxlLnk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ291dGVyU2NhbGUnLCB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRBYWJiRnVuYyh0aGlzLl91cGRhdGVBYWJiRnVuYyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxTY2FsZShzY2FsZVgsIHNjYWxlWSwgMSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5ub2RlLnNldExvY2FsUG9zaXRpb24oKDAuNSAtIGVsZW1lbnQucGl2b3QueCkgKiB3LCAoMC41IC0gZWxlbWVudC5waXZvdC55KSAqIGgsIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgdmIgPSBtZXNoLnZlcnRleEJ1ZmZlcjtcbiAgICAgICAgICAgIGNvbnN0IHZlcnRleERhdGFGMzIgPSBuZXcgRmxvYXQzMkFycmF5KHZiLmxvY2soKSk7XG5cbiAgICAgICAgICAgIC8vIG9mZnNldCBmb3IgcGl2b3RcbiAgICAgICAgICAgIGNvbnN0IGhwID0gZWxlbWVudC5waXZvdC54O1xuICAgICAgICAgICAgY29uc3QgdnAgPSBlbGVtZW50LnBpdm90Lnk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB2ZXJ0ZXggcG9zaXRpb25zLCBhY2NvdW50aW5nIGZvciB0aGUgcGl2b3Qgb2Zmc2V0XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzBdID0gdyAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMV0gPSAwIC0gdnAgKiBoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls4XSA9IHcgLSBocCAqIHc7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzldID0gaCAtIHZwICogaDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTZdID0gMCAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTddID0gMCAtIHZwICogaDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjRdID0gMCAtIGhwICogdztcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMjVdID0gaCAtIHZwICogaDtcblxuICAgICAgICAgICAgbGV0IGF0bGFzVGV4dHVyZVdpZHRoID0gMTtcbiAgICAgICAgICAgIGxldCBhdGxhc1RleHR1cmVIZWlnaHQgPSAxO1xuICAgICAgICAgICAgbGV0IHJlY3QgPSB0aGlzLl9yZWN0O1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fc3ByaXRlICYmIHRoaXMuX3Nwcml0ZS5mcmFtZUtleXNbdGhpcy5fc3ByaXRlRnJhbWVdICYmIHRoaXMuX3Nwcml0ZS5hdGxhcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZyYW1lID0gdGhpcy5fc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLl9zcHJpdGUuZnJhbWVLZXlzW3RoaXMuX3Nwcml0ZUZyYW1lXV07XG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlY3QgPSBmcmFtZS5yZWN0O1xuICAgICAgICAgICAgICAgICAgICBhdGxhc1RleHR1cmVXaWR0aCA9IHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlLndpZHRoO1xuICAgICAgICAgICAgICAgICAgICBhdGxhc1RleHR1cmVIZWlnaHQgPSB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBVcGRhdGUgdmVydGV4IHRleHR1cmUgY29vcmRpbmF0ZXNcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbNl0gPSAocmVjdC54ICsgcmVjdC56KSAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMls3XSA9IDEuMCAtIHJlY3QueSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTRdID0gKHJlY3QueCArIHJlY3QueikgLyBhdGxhc1RleHR1cmVXaWR0aDtcbiAgICAgICAgICAgIHZlcnRleERhdGFGMzJbMTVdID0gMS4wIC0gKHJlY3QueSArIHJlY3QudykgLyBhdGxhc1RleHR1cmVIZWlnaHQ7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzIyXSA9IHJlY3QueCAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlsyM10gPSAxLjAgLSByZWN0LnkgLyBhdGxhc1RleHR1cmVIZWlnaHQ7XG4gICAgICAgICAgICB2ZXJ0ZXhEYXRhRjMyWzMwXSA9IHJlY3QueCAvIGF0bGFzVGV4dHVyZVdpZHRoO1xuICAgICAgICAgICAgdmVydGV4RGF0YUYzMlszMV0gPSAxLjAgLSAocmVjdC55ICsgcmVjdC53KSAvIGF0bGFzVGV4dHVyZUhlaWdodDtcblxuICAgICAgICAgICAgdmIudW5sb2NrKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pbiA9IG5ldyBWZWMzKDAgLSBocCAqIHcsIDAgLSB2cCAqIGgsIDApO1xuICAgICAgICAgICAgY29uc3QgbWF4ID0gbmV3IFZlYzModyAtIGhwICogdywgaCAtIHZwICogaCwgMCk7XG4gICAgICAgICAgICBtZXNoLmFhYmIuc2V0TWluTWF4KG1pbiwgbWF4KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxTY2FsZSgxLCAxLCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLm5vZGUuc2V0TG9jYWxQb3NpdGlvbigwLCAwLCAwKTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmMobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tZXNoRGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBHZXRzIHRoZSBtZXNoIGZyb20gdGhlIHNwcml0ZSBhc3NldFxuICAgIC8vIGlmIHRoZSBzcHJpdGUgaXMgOS1zbGljZWQgb3IgdGhlIGRlZmF1bHQgbWVzaCBmcm9tIHRoZVxuICAgIC8vIGltYWdlIGVsZW1lbnQgYW5kIGNhbGxzIF91cGRhdGVNZXNoIG9yIHNldHMgbWVzaERpcnR5IHRvIHRydWVcbiAgICAvLyBpZiB0aGUgY29tcG9uZW50IGlzIGN1cnJlbnRseSBiZWluZyBpbml0aWFsaXplZC4gQWxzbyB1cGRhdGVzXG4gICAgLy8gYXNwZWN0IHJhdGlvLiBXZSBuZWVkIHRvIGNhbGwgX3VwZGF0ZVNwcml0ZSBldmVyeSB0aW1lXG4gICAgLy8gc29tZXRoaW5nIHJlbGF0ZWQgdG8gdGhlIHNwcml0ZSBhc3NldCBjaGFuZ2VzXG4gICAgX3VwZGF0ZVNwcml0ZSgpIHtcbiAgICAgICAgbGV0IG5pbmVTbGljZSA9IGZhbHNlO1xuICAgICAgICBsZXQgbWVzaCA9IG51bGw7XG5cbiAgICAgICAgLy8gcmVzZXQgdGFyZ2V0IGFzcGVjdCByYXRpb1xuICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IC0xO1xuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUgJiYgdGhpcy5fc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICAvLyB0YWtlIG1lc2ggZnJvbSBzcHJpdGVcbiAgICAgICAgICAgIG1lc2ggPSB0aGlzLl9zcHJpdGUubWVzaGVzW3RoaXMuc3ByaXRlRnJhbWVdO1xuICAgICAgICAgICAgbmluZVNsaWNlID0gdGhpcy5fc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQ7XG5cbiAgICAgICAgICAgIC8vIHJlLWNhbGN1bGF0ZSBhc3BlY3QgcmF0aW8gZnJvbSBzcHJpdGUgZnJhbWVcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lRGF0YSA9IHRoaXMuX3Nwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5fc3ByaXRlLmZyYW1lS2V5c1t0aGlzLl9zcHJpdGVGcmFtZV1dO1xuICAgICAgICAgICAgaWYgKGZyYW1lRGF0YT8ucmVjdC53ID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gZnJhbWVEYXRhLnJlY3QueiAvIGZyYW1lRGF0YS5yZWN0Lnc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB3ZSB1c2UgOSBzbGljaW5nIHRoZW4gdXNlIHRoYXQgbWVzaCBvdGhlcndpc2Uga2VlcCB1c2luZyB0aGUgZGVmYXVsdCBtZXNoXG4gICAgICAgIHRoaXMubWVzaCA9IG5pbmVTbGljZSA/IG1lc2ggOiB0aGlzLl9kZWZhdWx0TWVzaDtcblxuICAgICAgICB0aGlzLnJlZnJlc2hNZXNoKCk7XG4gICAgfVxuXG4gICAgcmVmcmVzaE1lc2goKSB7XG4gICAgICAgIGlmICh0aGlzLm1lc2gpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZWxlbWVudC5fYmVpbmdJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5tZXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVwZGF0ZXMgQUFCQiB3aGlsZSA5LXNsaWNpbmdcbiAgICBfdXBkYXRlQWFiYihhYWJiKSB7XG4gICAgICAgIGFhYmIuY2VudGVyLnNldCgwLCAwLCAwKTtcbiAgICAgICAgYWFiYi5oYWxmRXh0ZW50cy5zZXQodGhpcy5fb3V0ZXJTY2FsZS54ICogMC41LCB0aGlzLl9vdXRlclNjYWxlLnkgKiAwLjUsIDAuMDAxKTtcbiAgICAgICAgYWFiYi5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGFhYmIsIHRoaXMuX3JlbmRlcmFibGUubm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgcmV0dXJuIGFhYmI7XG4gICAgfVxuXG4gICAgX3RvZ2dsZU1hc2soKSB7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQuX2RpcnRpZnlNYXNrKCk7XG5cbiAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKTtcblxuICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldE1hc2soISF0aGlzLl9tYXNrKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsQWRkZWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VudGl0eS5lbmFibGVkKSByZXR1cm47IC8vIGRvbid0IGJpbmQgdW50aWwgZWxlbWVudCBpcyBlbmFibGVkXG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uTWF0ZXJpYWxDaGFuZ2UoKSB7XG5cbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFJlbW92ZSgpIHtcblxuICAgIH1cblxuICAgIF9vblRleHR1cmVBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uVGV4dHVyZUFkZGVkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuX3RleHR1cmVBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRUZXh0dXJlQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2JpbmRUZXh0dXJlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbnRpdHkuZW5hYmxlZCkgcmV0dXJuOyAvLyBkb24ndCBiaW5kIHVudGlsIGVsZW1lbnQgaXMgZW5hYmxlZFxuXG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25UZXh0dXJlTG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vblRleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uVGV4dHVyZUxvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kVGV4dHVyZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uVGV4dHVyZUxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25UZXh0dXJlUmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25UZXh0dXJlTG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLnRleHR1cmUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICB9XG5cbiAgICBfb25UZXh0dXJlQ2hhbmdlKGFzc2V0KSB7XG5cbiAgICB9XG5cbiAgICBfb25UZXh0dXJlUmVtb3ZlKGFzc2V0KSB7XG5cbiAgICB9XG5cbiAgICAvLyBXaGVuIHNwcml0ZSBhc3NldCBpcyBhZGRlZCBiaW5kIGl0XG4gICAgX29uU3ByaXRlQXNzZXRBZGRlZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uU3ByaXRlQXNzZXRBZGRlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIb29rIHVwIGV2ZW50IGhhbmRsZXJzIG9uIHNwcml0ZSBhc3NldFxuICAgIF9iaW5kU3ByaXRlQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbnRpdHkuZW5hYmxlZCkgcmV0dXJuOyAvLyBkb24ndCBiaW5kIHVudGlsIGVsZW1lbnQgaXMgZW5hYmxlZFxuXG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25TcHJpdGVBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25TcHJpdGVBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblNwcml0ZUFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZFNwcml0ZUFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9mZignbG9hZCcsIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblNwcml0ZUFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblNwcml0ZUFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQuZGF0YS50ZXh0dXJlQXRsYXNBc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdsb2FkOicgKyBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0LCB0aGlzLl9vblRleHR1cmVBdGxhc0xvYWQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2hlbiBzcHJpdGUgYXNzZXQgaXMgbG9hZGVkIG1ha2Ugc3VyZSB0aGUgdGV4dHVyZSBhdGxhcyBhc3NldCBpcyBsb2FkZWQgdG9vXG4gICAgLy8gSWYgc28gdGhlbiBzZXQgdGhlIHNwcml0ZSwgb3RoZXJ3aXNlIHdhaXQgZm9yIHRoZSBhdGxhcyB0byBiZSBsb2FkZWQgZmlyc3RcbiAgICBfb25TcHJpdGVBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgaWYgKCFhc3NldCB8fCAhYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghYXNzZXQucmVzb3VyY2UuYXRsYXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdGxhc0Fzc2V0SWQgPSBhc3NldC5kYXRhLnRleHR1cmVBdGxhc0Fzc2V0O1xuICAgICAgICAgICAgICAgIGlmIChhdGxhc0Fzc2V0SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2xvYWQ6JyArIGF0bGFzQXNzZXRJZCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2xvYWQ6JyArIGF0bGFzQXNzZXRJZCwgdGhpcy5fb25UZXh0dXJlQXRsYXNMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXaGVuIHRoZSBzcHJpdGUgYXNzZXQgY2hhbmdlcyByZXNldCBpdFxuICAgIF9vblNwcml0ZUFzc2V0Q2hhbmdlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uU3ByaXRlQXNzZXRMb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25TcHJpdGVBc3NldFJlbW92ZShhc3NldCkge1xuICAgIH1cblxuICAgIC8vIEhvb2sgdXAgZXZlbnQgaGFuZGxlcnMgb24gc3ByaXRlIGFzc2V0XG4gICAgX2JpbmRTcHJpdGUoc3ByaXRlKSB7XG4gICAgICAgIHNwcml0ZS5vbignc2V0Om1lc2hlcycsIHRoaXMuX29uU3ByaXRlTWVzaGVzQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6cGl4ZWxzUGVyVW5pdCcsIHRoaXMuX29uU3ByaXRlUHB1Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9uKCdzZXQ6YXRsYXMnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGlmIChzcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgIHNwcml0ZS5hdGxhcy5vbignc2V0OnRleHR1cmUnLCB0aGlzLl9vbkF0bGFzVGV4dHVyZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kU3ByaXRlKHNwcml0ZSkge1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TcHJpdGVNZXNoZXNDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBzcHJpdGUub2ZmKCdzZXQ6cGl4ZWxzUGVyVW5pdCcsIHRoaXMuX29uU3ByaXRlUHB1Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgc3ByaXRlLm9mZignc2V0OmF0bGFzJywgdGhpcy5fb25BdGxhc1RleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBpZiAoc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICBzcHJpdGUuYXRsYXMub2ZmKCdzZXQ6dGV4dHVyZScsIHRoaXMuX29uQXRsYXNUZXh0dXJlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNwcml0ZU1lc2hlc0NoYW5nZSgpIHtcbiAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3ByaXRlRnJhbWUgPSBtYXRoLmNsYW1wKHRoaXMuX3Nwcml0ZUZyYW1lLCAwLCB0aGlzLl9zcHJpdGUuZnJhbWVLZXlzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yY2UgdXBkYXRlXG4gICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgIH1cblxuICAgIF9vblNwcml0ZVBwdUNoYW5nZSgpIHtcbiAgICAgICAgLy8gZm9yY2UgdXBkYXRlIHdoZW4gdGhlIHNwcml0ZSBpcyA5LXNsaWNlZC4gSWYgaXQncyBub3RcbiAgICAgICAgLy8gdGhlbiBpdHMgbWVzaCB3aWxsIGNoYW5nZSB3aGVuIHRoZSBwcHUgY2hhbmdlcyB3aGljaCB3aWxsXG4gICAgICAgIC8vIGJlIGhhbmRsZWQgYnkgb25TcHJpdGVNZXNoZXNDaGFuZ2VcbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgIT09IFNQUklURV9SRU5ERVJNT0RFX1NJTVBMRSAmJiB0aGlzLl9waXhlbHNQZXJVbml0ID09PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uQXRsYXNUZXh0dXJlQ2hhbmdlKCkge1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgdGhpcy5zcHJpdGUuYXRsYXMgJiYgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJywgdGhpcy5fc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdoZW4gYXRsYXMgaXMgbG9hZGVkIHRyeSB0byByZXNldCB0aGUgc3ByaXRlIGFzc2V0XG4gICAgX29uVGV4dHVyZUF0bGFzTG9hZChhdGxhc0Fzc2V0KSB7XG4gICAgICAgIGNvbnN0IHNwcml0ZUFzc2V0ID0gdGhpcy5fc3ByaXRlQXNzZXQ7XG4gICAgICAgIGlmIChzcHJpdGVBc3NldCBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBfc3ByaXRlQXNzZXQgc2hvdWxkIG5ldmVyIGJlIGFuIGFzc2V0IGluc3RhbmNlP1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQoc3ByaXRlQXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb25TcHJpdGVBc3NldExvYWQodGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHNwcml0ZUFzc2V0KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl9tYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl90ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZFRleHR1cmVBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRTcHJpdGVBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbGVtZW50LmFkZE1vZGVsVG9MYXllcnModGhpcy5fcmVuZGVyYWJsZS5tb2RlbCk7XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLl9yZW5kZXJhYmxlLm1vZGVsKTtcbiAgICB9XG5cbiAgICBfc2V0U3RlbmNpbChzdGVuY2lsUGFyYW1zKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlLnN0ZW5jaWxGcm9udCA9IHN0ZW5jaWxQYXJhbXM7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrID0gc3RlbmNpbFBhcmFtcztcblxuICAgICAgICBsZXQgcmVmID0gMDtcbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQubWFza2VkQnkpIHtcbiAgICAgICAgICAgIHJlZiA9IHRoaXMuX2VsZW1lbnQubWFza2VkQnkuZWxlbWVudC5faW1hZ2UuX21hc2tSZWY7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICBjb25zdCBzcCA9IG5ldyBTdGVuY2lsUGFyYW1ldGVycyh7XG4gICAgICAgICAgICAgICAgcmVmOiByZWYgKyAxLFxuICAgICAgICAgICAgICAgIGZ1bmM6IEZVTkNfRVFVQUwsXG4gICAgICAgICAgICAgICAgenBhc3M6IFNURU5DSUxPUF9ERUNSRU1FTlRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnVubWFza01lc2hJbnN0YW5jZS5zdGVuY2lsRnJvbnQgPSBzcDtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUudW5tYXNrTWVzaEluc3RhbmNlLnN0ZW5jaWxCYWNrID0gc3A7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgY29sb3IodmFsdWUpIHtcbiAgICAgICAgY29uc3QgciA9IHZhbHVlLnI7XG4gICAgICAgIGNvbnN0IGcgPSB2YWx1ZS5nO1xuICAgICAgICBjb25zdCBiID0gdmFsdWUuYjtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh0aGlzLl9jb2xvciA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ1NldHRpbmcgZWxlbWVudC5jb2xvciB0byBpdHNlbGYgd2lsbCBoYXZlIG5vIGVmZmVjdCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmICh0aGlzLl9jb2xvci5yICE9PSByIHx8IHRoaXMuX2NvbG9yLmcgIT09IGcgfHwgdGhpcy5fY29sb3IuYiAhPT0gYikge1xuICAgICAgICAgICAgdGhpcy5fY29sb3IuciA9IHI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5nID0gZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmIgPSBiO1xuXG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSByO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IGI7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0OmNvbG9yJywgdGhpcy5fY29sb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgc2V0IG9wYWNpdHkodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9jb2xvci5hKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5hID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmZpcmUoJ3NldDpvcGFjaXR5JywgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9wYWNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvci5hO1xuICAgIH1cblxuICAgIHNldCByZWN0KHZhbHVlKSB7XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRoaXMuX3JlY3QgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1NldHRpbmcgZWxlbWVudC5yZWN0IHRvIGl0c2VsZiB3aWxsIGhhdmUgbm8gZWZmZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgbGV0IHgsIHksIHosIHc7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgIHggPSB2YWx1ZS54O1xuICAgICAgICAgICAgeSA9IHZhbHVlLnk7XG4gICAgICAgICAgICB6ID0gdmFsdWUuejtcbiAgICAgICAgICAgIHcgPSB2YWx1ZS53O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeCA9IHZhbHVlWzBdO1xuICAgICAgICAgICAgeSA9IHZhbHVlWzFdO1xuICAgICAgICAgICAgeiA9IHZhbHVlWzJdO1xuICAgICAgICAgICAgdyA9IHZhbHVlWzNdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHggPT09IHRoaXMuX3JlY3QueCAmJlxuICAgICAgICAgICAgeSA9PT0gdGhpcy5fcmVjdC55ICYmXG4gICAgICAgICAgICB6ID09PSB0aGlzLl9yZWN0LnogJiZcbiAgICAgICAgICAgIHcgPT09IHRoaXMuX3JlY3Qud1xuICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3JlY3Quc2V0KHgsIHksIHosIHcpO1xuXG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJhYmxlLm1lc2gpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fZWxlbWVudC5fYmVpbmdJbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1lc2godGhpcy5fcmVuZGVyYWJsZS5tZXNoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaERpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZWN0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjdDtcbiAgICB9XG5cbiAgICBzZXQgbWF0ZXJpYWwodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmICghdmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmVlblNwYWNlID0gdGhpcy5fZWxlbWVudC5faXNTY3JlZW5TcGFjZSgpO1xuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gc2NyZWVuU3BhY2UgPyB0aGlzLl9zeXN0ZW0uZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwgOiB0aGlzLl9zeXN0ZW0uZGVmYXVsdEltYWdlTWFza01hdGVyaWFsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHNjcmVlblNwYWNlID8gdGhpcy5fc3lzdGVtLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwgOiB0aGlzLl9zeXN0ZW0uZGVmYXVsdEltYWdlTWF0ZXJpYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHZhbHVlO1xuXG4gICAgICAgIC8vIFJlbW92ZSBtYXRlcmlhbCBhc3NldCBpZiBjaGFuZ2VkXG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgIGlmICghYXNzZXQgfHwgYXNzZXQucmVzb3VyY2UgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbEFzc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRNYXRlcmlhbCh2YWx1ZSk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgbm90IHRoZSBkZWZhdWx0IG1hdGVyaWFsIHRoZW4gY2xlYXIgY29sb3IgYW5kIG9wYWNpdHkgb3ZlcnJpZGVzXG4gICAgICAgICAgICBpZiAodGhpcy5faGFzVXNlck1hdGVyaWFsKCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLmRlbGV0ZVBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBvdGhlcndpc2UgaWYgd2UgYXJlIGJhY2sgdG8gdGhlIGRlZmF1bHRzIHJlc2V0IHRoZSBjb2xvciBhbmQgb3BhY2l0eVxuICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9jb2xvci5iO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCB0aGlzLl9jb2xvci5hKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIHNldCBtYXRlcmlhbEFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgX2lkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQgIT09IF9pZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX21hdGVyaWFsQXNzZXQsIHRoaXMuX29uTWF0ZXJpYWxBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc3QgX3ByZXYgPSBhc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsTG9hZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbENoYW5nZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIF9wcmV2Lm9mZigncmVtb3ZlJywgdGhpcy5fb25NYXRlcmlhbFJlbW92ZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gX2lkO1xuICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fbWF0ZXJpYWxBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IF9pZDtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uKCdhZGQ6JyArIHRoaXMuX21hdGVyaWFsQXNzZXQsIHRoaXMuX29uTWF0ZXJpYWxBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYmluZE1hdGVyaWFsQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxBc3NldCA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gX2lkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsQXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbEFzc2V0O1xuICAgIH1cblxuICAgIHNldCB0ZXh0dXJlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmVBc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKHRleHR1cmVBc3NldCAmJiB0ZXh0dXJlQXNzZXQucmVzb3VyY2UgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdGV4dHVyZSA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh2YWx1ZSkge1xuXG4gICAgICAgICAgICAvLyBjbGVhciBzcHJpdGUgYXNzZXQgaWYgdGV4dHVyZSBpcyBzZXRcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkZWZhdWx0IHRleHR1cmUganVzdCB1c2VzIGVtaXNzaXZlIGFuZCBvcGFjaXR5IG1hcHNcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJywgdGhpcy5fdGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJywgdGhpcy5fdGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX2NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCB0aGlzLl9jb2xvci5hKTtcblxuICAgICAgICAgICAgLy8gaWYgdGV4dHVyZSdzIGFzcGVjdCByYXRpbyBjaGFuZ2VkIGFuZCB0aGUgZWxlbWVudCBuZWVkcyB0byBwcmVzZXJ2ZSBhc3BlY3QgcmF0aW8sIHJlZnJlc2ggdGhlIG1lc2hcbiAgICAgICAgICAgIGNvbnN0IG5ld0FzcGVjdFJhdGlvID0gdGhpcy5fdGV4dHVyZS53aWR0aCAvIHRoaXMuX3RleHR1cmUuaGVpZ2h0O1xuICAgICAgICAgICAgaWYgKG5ld0FzcGVjdFJhdGlvICE9PSB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RhcmdldEFzcGVjdFJhdGlvID0gbmV3QXNwZWN0UmF0aW87XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQuZml0TW9kZSAhPT0gRklUTU9ERV9TVFJFVENIKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcmVzaE1lc2goKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcblxuICAgICAgICAgICAgLy8gcmVzZXQgdGFyZ2V0IGFzcGVjdCByYXRpbyBhbmQgcmVmcmVzaCBtZXNoIGlmIHRoZXJlIGlzIGFuIGFzcGVjdCByYXRpbyBzZXR0aW5nXG4gICAgICAgICAgICAvLyB0aGlzIGlzIG5lZWRlZCBpbiBvcmRlciB0byBwcm9wZXJseSByZXNldCB0aGUgbWVzaCB0byAnc3RyZXRjaCcgYWNyb3NzIHRoZSBlbnRpcmUgZWxlbWVudCBib3VuZHNcbiAgICAgICAgICAgIC8vIHdoZW4gcmVzZXR0aW5nIHRoZSB0ZXh0dXJlXG4gICAgICAgICAgICB0aGlzLl90YXJnZXRBc3BlY3RSYXRpbyA9IC0xO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQuZml0TW9kZSAhPT0gRklUTU9ERV9TVFJFVENIKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoTWVzaCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHRleHR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0dXJlO1xuICAgIH1cblxuICAgIHNldCB0ZXh0dXJlQXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGxldCBfaWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub2ZmKCdhZGQ6JyArIHRoaXMuX3RleHR1cmVBc3NldCwgdGhpcy5fb25UZXh0dXJlQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl90ZXh0dXJlQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ2xvYWQnLCB0aGlzLl9vblRleHR1cmVMb2FkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgX3ByZXYub2ZmKCdjaGFuZ2UnLCB0aGlzLl9vblRleHR1cmVDaGFuZ2UsIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICBfcHJldi5vZmYoJ3JlbW92ZScsIHRoaXMuX29uVGV4dHVyZVJlbW92ZSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl90ZXh0dXJlQXNzZXQgPSBfaWQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dHVyZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KHRoaXMuX3RleHR1cmVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBhc3NldHMub24oJ2FkZDonICsgdGhpcy5fdGV4dHVyZUFzc2V0LCB0aGlzLl9vblRleHR1cmVBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYmluZFRleHR1cmVBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHRleHR1cmVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHR1cmVBc3NldDtcbiAgICB9XG5cbiAgICBzZXQgc3ByaXRlQXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGxldCBfaWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlQXNzZXQgIT09IF9pZCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZUFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9zcHJpdGVBc3NldCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fc3ByaXRlQXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRTcHJpdGVBc3NldChfcHJldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9zcHJpdGVBc3NldCA9IF9pZDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLl9zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNwcml0ZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9zcHJpdGVBc3NldCwgdGhpcy5fb25TcHJpdGVBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kU3ByaXRlQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zcHJpdGUgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0OnNwcml0ZUFzc2V0JywgX2lkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzcHJpdGVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZUFzc2V0O1xuICAgIH1cblxuICAgIHNldCBzcHJpdGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl91bmJpbmRTcHJpdGUodGhpcy5fc3ByaXRlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgY29uc3Qgc3ByaXRlQXNzZXQgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5fc3ByaXRlQXNzZXQpO1xuICAgICAgICAgICAgaWYgKHNwcml0ZUFzc2V0ICYmIHNwcml0ZUFzc2V0LnJlc291cmNlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc3ByaXRlID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fYmluZFNwcml0ZSh0aGlzLl9zcHJpdGUpO1xuXG4gICAgICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIGlmIHNwcml0ZSBpcyBiZWluZyBzZXRcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0dXJlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRleHR1cmVBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlICYmIHRoaXMuX3Nwcml0ZS5hdGxhcyAmJiB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgLy8gZGVmYXVsdCB0ZXh0dXJlIGp1c3QgdXNlcyBlbWlzc2l2ZSBhbmQgb3BhY2l0eSBtYXBzXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldFBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcsIHRoaXMuX3Nwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnLCB0aGlzLl9zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGVhciB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyYWJsZS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuZGVsZXRlUGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsYW1wIGZyYW1lXG4gICAgICAgIGlmICh0aGlzLl9zcHJpdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gbWF0aC5jbGFtcCh0aGlzLl9zcHJpdGVGcmFtZSwgMCwgdGhpcy5fc3ByaXRlLmZyYW1lS2V5cy5sZW5ndGggLSAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVNwcml0ZSgpO1xuICAgIH1cblxuICAgIGdldCBzcHJpdGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcHJpdGU7XG4gICAgfVxuXG4gICAgc2V0IHNwcml0ZUZyYW1lKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpcy5fc3ByaXRlRnJhbWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSkge1xuICAgICAgICAgICAgLy8gY2xhbXAgZnJhbWVcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gbWF0aC5jbGFtcCh2YWx1ZSwgMCwgdGhpcy5fc3ByaXRlLmZyYW1lS2V5cy5sZW5ndGggLSAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Nwcml0ZUZyYW1lID0gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ByaXRlRnJhbWUgIT09IG9sZFZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTcHJpdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmZpcmUoJ3NldDpzcHJpdGVGcmFtZScsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzcHJpdGVGcmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Nwcml0ZUZyYW1lO1xuICAgIH1cblxuICAgIHNldCBtZXNoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0TWVzaCh2YWx1ZSk7XG4gICAgICAgIGlmICh0aGlzLl9kZWZhdWx0TWVzaCA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlcmFibGUuc2V0QWFiYkZ1bmMobnVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJhYmxlLnNldEFhYmJGdW5jKHRoaXMuX3VwZGF0ZUFhYmJGdW5jKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtZXNoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyYWJsZS5tZXNoO1xuICAgIH1cblxuICAgIHNldCBtYXNrKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXNrICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbWFzayA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlTWFzaygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hc2soKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrO1xuICAgIH1cblxuICAgIHNldCBwaXhlbHNQZXJVbml0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9waXhlbHNQZXJVbml0ID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3BpeGVsc1BlclVuaXQgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3Nwcml0ZSAmJiAodGhpcy5fc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLl9zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVTcHJpdGUoKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgZ2V0IHBpeGVsc1BlclVuaXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXhlbHNQZXJVbml0O1xuICAgIH1cblxuICAgIC8vIHByaXZhdGVcbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlcmFibGUubWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyYWJsZS5tZXNoSW5zdGFuY2UuYWFiYjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEltYWdlRWxlbWVudCB9O1xuIl0sIm5hbWVzIjpbIl92ZXJ0ZXhGb3JtYXREZXZpY2VDYWNoZSIsIkRldmljZUNhY2hlIiwiSW1hZ2VSZW5kZXJhYmxlIiwiY29uc3RydWN0b3IiLCJlbnRpdHkiLCJtZXNoIiwibWF0ZXJpYWwiLCJfZW50aXR5IiwiX2VsZW1lbnQiLCJlbGVtZW50IiwibW9kZWwiLCJNb2RlbCIsIm5vZGUiLCJHcmFwaE5vZGUiLCJncmFwaCIsIm1lc2hJbnN0YW5jZSIsIk1lc2hJbnN0YW5jZSIsIm5hbWUiLCJjYXN0U2hhZG93IiwicmVjZWl2ZVNoYWRvdyIsIl9tZXNoRGlydHkiLCJtZXNoSW5zdGFuY2VzIiwicHVzaCIsImFkZENoaWxkIiwidW5tYXNrTWVzaEluc3RhbmNlIiwiZGVzdHJveSIsInNldE1hdGVyaWFsIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwic2V0TWVzaCIsInZpc2libGUiLCJmb3JjZVVwZGF0ZUFhYmIiLCJzZXRNYXNrIiwibWFzayIsInBpY2siLCJwYXJhbWV0ZXJzIiwic2V0UGFyYW1ldGVyIiwiZGF0YSIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJlbmFibGVkIiwiYWRkTW9kZWxUb0xheWVycyIsInZhbHVlIiwiZGVsZXRlUGFyYW1ldGVyIiwic2V0VW5tYXNrRHJhd09yZGVyIiwiZ2V0TGFzdENoaWxkIiwiZSIsImxhc3QiLCJjIiwiY2hpbGRyZW4iLCJsIiwibGVuZ3RoIiwiaSIsImNoaWxkIiwibGFzdENoaWxkIiwiZHJhd09yZGVyIiwiZ2V0TWFza09mZnNldCIsIkRlYnVnIiwidHJhY2UiLCJUUkFDRV9JRF9FTEVNRU5UIiwic2V0RHJhd09yZGVyIiwic2V0Q3VsbCIsImN1bGwiLCJ2aXNpYmxlRm4iLCJfaXNTY3JlZW5TcGFjZSIsImNhbWVyYSIsImlzVmlzaWJsZUZvckNhbWVyYSIsImlzVmlzaWJsZUZ1bmMiLCJzZXRTY3JlZW5TcGFjZSIsInNjcmVlblNwYWNlIiwic2V0TGF5ZXIiLCJsYXllciIsIl9hYWJiVmVyIiwic2V0QWFiYkZ1bmMiLCJmbiIsIl91cGRhdGVBYWJiRnVuYyIsIkltYWdlRWxlbWVudCIsIl9zeXN0ZW0iLCJzeXN0ZW0iLCJfdGV4dHVyZUFzc2V0IiwiX3RleHR1cmUiLCJfbWF0ZXJpYWxBc3NldCIsIl9tYXRlcmlhbCIsIl9zcHJpdGVBc3NldCIsIl9zcHJpdGUiLCJfc3ByaXRlRnJhbWUiLCJfcGl4ZWxzUGVyVW5pdCIsIl90YXJnZXRBc3BlY3RSYXRpbyIsIl9yZWN0IiwiVmVjNCIsIl9tYXNrIiwiX21hc2tSZWYiLCJfb3V0ZXJTY2FsZSIsIlZlYzIiLCJfb3V0ZXJTY2FsZVVuaWZvcm0iLCJGbG9hdDMyQXJyYXkiLCJfaW5uZXJPZmZzZXQiLCJfaW5uZXJPZmZzZXRVbmlmb3JtIiwiX2F0bGFzUmVjdCIsIl9hdGxhc1JlY3RVbmlmb3JtIiwiX2RlZmF1bHRNZXNoIiwiX2NyZWF0ZU1lc2giLCJfcmVuZGVyYWJsZSIsIl9jb2xvciIsIkNvbG9yIiwiX2NvbG9yVW5pZm9ybSIsIl91cGRhdGVBYWJiIiwiYmluZCIsIl9vblNjcmVlbkNoYW5nZSIsInNjcmVlbiIsIm9uIiwiX29uUGFyZW50UmVzaXplT3JQaXZvdENoYW5nZSIsIl9vblNjcmVlblNwYWNlQ2hhbmdlIiwiX29uRHJhd09yZGVyQ2hhbmdlIiwiX29uUmVzb2x1dGlvbkNoYW5nZSIsInRleHR1cmVBc3NldCIsInNwcml0ZUFzc2V0IiwibWF0ZXJpYWxBc3NldCIsIm9mZiIsInJlcyIsIl91cGRhdGVNZXNoIiwiX3VwZGF0ZU1hdGVyaWFsIiwicHJldmlvdXMiLCJvcmRlciIsIm9uY2UiLCJfaGFzVXNlck1hdGVyaWFsIiwiZGVmYXVsdEltYWdlTWF0ZXJpYWxzIiwiX3VzZTlTbGljaW5nIiwic3ByaXRlIiwicmVuZGVyTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwibmluZVNsaWNlZCIsIm5pbmVUaWxlZCIsImdldEltYWdlRWxlbWVudE1hdGVyaWFsIiwiX2lzU2NyZWVuQ3VsbGVkIiwiTEFZRVJfSFVEIiwiTEFZRVJfV09STEQiLCJ3IiwiY2FsY3VsYXRlZFdpZHRoIiwiaCIsImNhbGN1bGF0ZWRIZWlnaHQiLCJyIiwiZGV2aWNlIiwiYXBwIiwiZ3JhcGhpY3NEZXZpY2UiLCJ2ZXJ0ZXhEYXRhIiwieCIsInoiLCJ5IiwidmVydGV4Rm9ybWF0IiwiZ2V0IiwiVmVydGV4Rm9ybWF0Iiwic2VtYW50aWMiLCJTRU1BTlRJQ19QT1NJVElPTiIsImNvbXBvbmVudHMiLCJ0eXBlIiwiVFlQRV9GTE9BVDMyIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwidmVydGV4QnVmZmVyIiwiVmVydGV4QnVmZmVyIiwiQlVGRkVSX1NUQVRJQyIsImJ1ZmZlciIsIk1lc2giLCJwcmltaXRpdmUiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJiYXNlIiwiY291bnQiLCJpbmRleGVkIiwiYWFiYiIsInNldE1pbk1heCIsIlZlYzMiLCJaRVJPIiwiZml0TW9kZSIsIkZJVE1PREVfU1RSRVRDSCIsImFjdHVhbFJhdGlvIiwiRklUTU9ERV9DT05UQUlOIiwiRklUTU9ERV9DT1ZFUiIsImZyYW1lRGF0YSIsImF0bGFzIiwiZnJhbWVzIiwiZnJhbWVLZXlzIiwiYm9yZGVyV2lkdGhTY2FsZSIsInJlY3QiLCJib3JkZXJIZWlnaHRTY2FsZSIsInNldCIsImJvcmRlciIsInRleCIsInRleHR1cmUiLCJ3aWR0aCIsImhlaWdodCIsInBwdSIsInBpeGVsc1BlclVuaXQiLCJzY2FsZU11bFgiLCJzY2FsZU11bFkiLCJNYXRoIiwibWF4Iiwic2NhbGVYIiwic2NhbGVZIiwibWF0aCIsImNsYW1wIiwic2V0TG9jYWxTY2FsZSIsInNldExvY2FsUG9zaXRpb24iLCJwaXZvdCIsInZiIiwidmVydGV4RGF0YUYzMiIsImxvY2siLCJocCIsInZwIiwiYXRsYXNUZXh0dXJlV2lkdGgiLCJhdGxhc1RleHR1cmVIZWlnaHQiLCJmcmFtZSIsInVubG9jayIsIm1pbiIsIl91cGRhdGVTcHJpdGUiLCJuaW5lU2xpY2UiLCJtZXNoZXMiLCJzcHJpdGVGcmFtZSIsInJlZnJlc2hNZXNoIiwiX2JlaW5nSW5pdGlhbGl6ZWQiLCJjZW50ZXIiLCJoYWxmRXh0ZW50cyIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsIl90b2dnbGVNYXNrIiwiX2RpcnRpZnlNYXNrIiwiX29uTWF0ZXJpYWxMb2FkIiwiYXNzZXQiLCJyZXNvdXJjZSIsIl9vbk1hdGVyaWFsQWRkZWQiLCJhc3NldHMiLCJpZCIsIl9iaW5kTWF0ZXJpYWxBc3NldCIsIl9vbk1hdGVyaWFsQ2hhbmdlIiwiX29uTWF0ZXJpYWxSZW1vdmUiLCJsb2FkIiwiX3VuYmluZE1hdGVyaWFsQXNzZXQiLCJfb25UZXh0dXJlQWRkZWQiLCJfYmluZFRleHR1cmVBc3NldCIsIl9vblRleHR1cmVMb2FkIiwiX29uVGV4dHVyZUNoYW5nZSIsIl9vblRleHR1cmVSZW1vdmUiLCJfdW5iaW5kVGV4dHVyZUFzc2V0IiwiX29uU3ByaXRlQXNzZXRBZGRlZCIsIl9iaW5kU3ByaXRlQXNzZXQiLCJfb25TcHJpdGVBc3NldExvYWQiLCJfb25TcHJpdGVBc3NldENoYW5nZSIsIl9vblNwcml0ZUFzc2V0UmVtb3ZlIiwiX3VuYmluZFNwcml0ZUFzc2V0IiwidGV4dHVyZUF0bGFzQXNzZXQiLCJfb25UZXh0dXJlQXRsYXNMb2FkIiwiYXRsYXNBc3NldElkIiwiX2JpbmRTcHJpdGUiLCJfb25TcHJpdGVNZXNoZXNDaGFuZ2UiLCJfb25TcHJpdGVQcHVDaGFuZ2UiLCJfb25BdGxhc1RleHR1cmVDaGFuZ2UiLCJfdW5iaW5kU3ByaXRlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0lNUExFIiwiYXRsYXNBc3NldCIsIkFzc2V0Iiwib25FbmFibGUiLCJvbkRpc2FibGUiLCJfc2V0U3RlbmNpbCIsInN0ZW5jaWxQYXJhbXMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInJlZiIsIm1hc2tlZEJ5IiwiX2ltYWdlIiwic3AiLCJTdGVuY2lsUGFyYW1ldGVycyIsImZ1bmMiLCJGVU5DX0VRVUFMIiwienBhc3MiLCJTVEVOQ0lMT1BfREVDUkVNRU5UIiwiY29sb3IiLCJnIiwiYiIsIndhcm4iLCJmaXJlIiwib3BhY2l0eSIsImEiLCJjb25zb2xlIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsIiwiZGVmYXVsdEltYWdlTWF0ZXJpYWwiLCJfaWQiLCJfcHJldiIsIm5ld0FzcGVjdFJhdGlvIiwib2xkVmFsdWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBbUNBLE1BQU1BLHdCQUF3QixHQUFHLElBQUlDLFdBQVcsRUFBRSxDQUFBO0FBRWxELE1BQU1DLGVBQWUsQ0FBQztBQUNsQkMsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxJQUFJLEVBQUVDLFFBQVEsRUFBRTtJQUNoQyxJQUFJLENBQUNDLE9BQU8sR0FBR0gsTUFBTSxDQUFBO0FBQ3JCLElBQUEsSUFBSSxDQUFDSSxRQUFRLEdBQUdKLE1BQU0sQ0FBQ0ssT0FBTyxDQUFBO0FBRTlCLElBQUEsSUFBSSxDQUFDQyxLQUFLLEdBQUcsSUFBSUMsS0FBSyxFQUFFLENBQUE7QUFDeEIsSUFBQSxJQUFJLENBQUNDLElBQUksR0FBRyxJQUFJQyxTQUFTLEVBQUUsQ0FBQTtBQUMzQixJQUFBLElBQUksQ0FBQ0gsS0FBSyxDQUFDSSxLQUFLLEdBQUcsSUFBSSxDQUFDRixJQUFJLENBQUE7SUFFNUIsSUFBSSxDQUFDUCxJQUFJLEdBQUdBLElBQUksQ0FBQTtBQUNoQixJQUFBLElBQUksQ0FBQ1UsWUFBWSxHQUFHLElBQUlDLFlBQVksQ0FBQyxJQUFJ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
