/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { LAYERID_WORLD, SPRITE_RENDERMODE_TILED, SPRITE_RENDERMODE_SLICED } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { Component } from '../component.js';
import { SPRITETYPE_SIMPLE, SPRITETYPE_ANIMATED } from './constants.js';
import { SpriteAnimationClip } from './sprite-animation-clip.js';

const PARAM_EMISSIVE_MAP = 'texture_emissiveMap';
const PARAM_OPACITY_MAP = 'texture_opacityMap';
const PARAM_EMISSIVE = 'material_emissive';
const PARAM_OPACITY = 'material_opacity';
const PARAM_INNER_OFFSET = 'innerOffset';
const PARAM_OUTER_SCALE = 'outerScale';
const PARAM_ATLAS_RECT = 'atlasRect';

class SpriteComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
    this._type = SPRITETYPE_SIMPLE;
    this._material = system.defaultMaterial;
    this._color = new Color(1, 1, 1, 1);
    this._colorUniform = new Float32Array(3);
    this._speed = 1;
    this._flipX = false;
    this._flipY = false;
    this._width = 1;
    this._height = 1;
    this._drawOrder = 0;
    this._layers = [LAYERID_WORLD];

    this._outerScale = new Vec2(1, 1);
    this._outerScaleUniform = new Float32Array(2);
    this._innerOffset = new Vec4();
    this._innerOffsetUniform = new Float32Array(4);
    this._atlasRect = new Vec4();
    this._atlasRectUniform = new Float32Array(4);

    this._batchGroupId = -1;
    this._batchGroup = null;

    this._node = new GraphNode();
    this._model = new Model();
    this._model.graph = this._node;
    this._meshInstance = null;
    entity.addChild(this._model.graph);
    this._model._entity = entity;
    this._updateAabbFunc = this._updateAabb.bind(this);
    this._addedModel = false;

    this._autoPlayClip = null;

    this._clips = {};

    this._defaultClip = new SpriteAnimationClip(this, {
      name: this.entity.name,
      fps: 0,
      loop: false,
      spriteAsset: null
    });

    this._currentClip = this._defaultClip;
  }

  set type(value) {
    if (this._type === value) return;
    this._type = value;
    if (this._type === SPRITETYPE_SIMPLE) {
      this.stop();
      this._currentClip = this._defaultClip;
      if (this.enabled && this.entity.enabled) {
        this._currentClip.frame = this.frame;
        if (this._currentClip.sprite) {
          this._showModel();
        } else {
          this._hideModel();
        }
      }
    } else if (this._type === SPRITETYPE_ANIMATED) {
      this.stop();
      if (this._autoPlayClip) {
        this._tryAutoPlay();
      }
      if (this._currentClip && this._currentClip.isPlaying && this.enabled && this.entity.enabled) {
        this._showModel();
      } else {
        this._hideModel();
      }
    }
  }
  get type() {
    return this._type;
  }

  set frame(value) {
    this._currentClip.frame = value;
  }
  get frame() {
    return this._currentClip.frame;
  }

  set spriteAsset(value) {
    this._defaultClip.spriteAsset = value;
  }
  get spriteAsset() {
    return this._defaultClip._spriteAsset;
  }

  set sprite(value) {
    this._currentClip.sprite = value;
  }
  get sprite() {
    return this._currentClip.sprite;
  }

  set material(value) {
    this._material = value;
    if (this._meshInstance) {
      this._meshInstance.material = value;
    }
  }
  get material() {
    return this._material;
  }

  set color(value) {
    this._color.r = value.r;
    this._color.g = value.g;
    this._color.b = value.b;
    if (this._meshInstance) {
      this._colorUniform[0] = this._color.r;
      this._colorUniform[1] = this._color.g;
      this._colorUniform[2] = this._color.b;
      this._meshInstance.setParameter(PARAM_EMISSIVE, this._colorUniform);
    }
  }
  get color() {
    return this._color;
  }

  set opacity(value) {
    this._color.a = value;
    if (this._meshInstance) {
      this._meshInstance.setParameter(PARAM_OPACITY, value);
    }
  }
  get opacity() {
    return this._color.a;
  }

  set clips(value) {
    if (!value) {
      for (const name in this._clips) {
        this.removeClip(name);
      }
      return;
    }

    for (const name in this._clips) {
      let found = false;
      for (const key in value) {
        if (value[key].name === name) {
          found = true;
          this._clips[name].fps = value[key].fps;
          this._clips[name].loop = value[key].loop;
          if (value[key].hasOwnProperty('sprite')) {
            this._clips[name].sprite = value[key].sprite;
          } else if (value[key].hasOwnProperty('spriteAsset')) {
            this._clips[name].spriteAsset = value[key].spriteAsset;
          }
          break;
        }
      }
      if (!found) {
        this.removeClip(name);
      }
    }

    for (const key in value) {
      if (this._clips[value[key].name]) continue;
      this.addClip(value[key]);
    }

    if (this._autoPlayClip) {
      this._tryAutoPlay();
    }

    if (!this._currentClip || !this._currentClip.sprite) {
      this._hideModel();
    }
  }
  get clips() {
    return this._clips;
  }

  get currentClip() {
    return this._currentClip;
  }

  set speed(value) {
    this._speed = value;
  }
  get speed() {
    return this._speed;
  }

  set flipX(value) {
    if (this._flipX === value) return;
    this._flipX = value;
    this._updateTransform();
  }
  get flipX() {
    return this._flipX;
  }

  set flipY(value) {
    if (this._flipY === value) return;
    this._flipY = value;
    this._updateTransform();
  }
  get flipY() {
    return this._flipY;
  }

  set width(value) {
    if (value === this._width) return;
    this._width = value;
    this._outerScale.x = this._width;
    if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_TILED || this.sprite.renderMode === SPRITE_RENDERMODE_SLICED)) {
      this._updateTransform();
    }
  }
  get width() {
    return this._width;
  }

  set height(value) {
    if (value === this._height) return;
    this._height = value;
    this._outerScale.y = this.height;
    if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_TILED || this.sprite.renderMode === SPRITE_RENDERMODE_SLICED)) {
      this._updateTransform();
    }
  }
  get height() {
    return this._height;
  }

  set batchGroupId(value) {
    if (this._batchGroupId === value) return;
    const prev = this._batchGroupId;
    this._batchGroupId = value;
    if (this.entity.enabled && prev >= 0) {
      var _this$system$app$batc;
      (_this$system$app$batc = this.system.app.batcher) == null ? void 0 : _this$system$app$batc.remove(BatchGroup.SPRITE, prev, this.entity);
    }
    if (this.entity.enabled && value >= 0) {
      var _this$system$app$batc2;
      (_this$system$app$batc2 = this.system.app.batcher) == null ? void 0 : _this$system$app$batc2.insert(BatchGroup.SPRITE, value, this.entity);
    } else {
      if (prev >= 0) {
        if (this._currentClip && this._currentClip.sprite && this.enabled && this.entity.enabled) {
          this._showModel();
        }
      }
    }
  }
  get batchGroupId() {
    return this._batchGroupId;
  }

  set autoPlayClip(value) {
    this._autoPlayClip = value instanceof SpriteAnimationClip ? value.name : value;
    this._tryAutoPlay();
  }
  get autoPlayClip() {
    return this._autoPlayClip;
  }

  set drawOrder(value) {
    this._drawOrder = value;
    if (this._meshInstance) {
      this._meshInstance.drawOrder = value;
    }
  }
  get drawOrder() {
    return this._drawOrder;
  }

  set layers(value) {
    if (this._addedModel) {
      this._hideModel();
    }
    this._layers = value;

    if (!this._meshInstance) {
      return;
    }
    if (this.enabled && this.entity.enabled) {
      this._showModel();
    }
  }
  get layers() {
    return this._layers;
  }
  get aabb() {
    if (this._meshInstance) {
      return this._meshInstance.aabb;
    }
    return null;
  }
  onEnable() {
    const app = this.system.app;
    const scene = app.scene;
    scene.on('set:layers', this._onLayersChanged, this);
    if (scene.layers) {
      scene.layers.on('add', this._onLayerAdded, this);
      scene.layers.on('remove', this._onLayerRemoved, this);
    }
    this._showModel();
    if (this._autoPlayClip) this._tryAutoPlay();
    if (this._batchGroupId >= 0) {
      var _app$batcher;
      (_app$batcher = app.batcher) == null ? void 0 : _app$batcher.insert(BatchGroup.SPRITE, this._batchGroupId, this.entity);
    }
  }
  onDisable() {
    const app = this.system.app;
    const scene = app.scene;
    scene.off('set:layers', this._onLayersChanged, this);
    if (scene.layers) {
      scene.layers.off('add', this._onLayerAdded, this);
      scene.layers.off('remove', this._onLayerRemoved, this);
    }
    this.stop();
    this._hideModel();
    if (this._batchGroupId >= 0) {
      var _app$batcher2;
      (_app$batcher2 = app.batcher) == null ? void 0 : _app$batcher2.remove(BatchGroup.SPRITE, this._batchGroupId, this.entity);
    }
  }
  onDestroy() {
    this._currentClip = null;
    if (this._defaultClip) {
      this._defaultClip._destroy();
      this._defaultClip = null;
    }
    for (const key in this._clips) {
      this._clips[key]._destroy();
    }
    this._clips = null;
    this._hideModel();
    this._model = null;
    if (this._node) {
      if (this._node.parent) this._node.parent.removeChild(this._node);
      this._node = null;
    }
    if (this._meshInstance) {
      this._meshInstance.material = null;
      this._meshInstance.mesh = null;
      this._meshInstance = null;
    }
  }
  _showModel() {
    if (this._addedModel) return;
    if (!this._meshInstance) return;
    const meshInstances = [this._meshInstance];
    for (let i = 0, len = this._layers.length; i < len; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.addMeshInstances(meshInstances);
      }
    }
    this._addedModel = true;
  }
  _hideModel() {
    if (!this._addedModel || !this._meshInstance) return;
    const meshInstances = [this._meshInstance];
    for (let i = 0, len = this._layers.length; i < len; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.removeMeshInstances(meshInstances);
      }
    }
    this._addedModel = false;
  }

  _showFrame(frame) {
    if (!this.sprite) return;
    const mesh = this.sprite.meshes[frame];
    if (!mesh) {
      if (this._meshInstance) {
        this._meshInstance.mesh = null;
        this._meshInstance.visible = false;
      }
      return;
    }
    let material;
    if (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED) {
      material = this.system.default9SlicedMaterialSlicedMode;
    } else if (this.sprite.renderMode === SPRITE_RENDERMODE_TILED) {
      material = this.system.default9SlicedMaterialTiledMode;
    } else {
      material = this.system.defaultMaterial;
    }

    if (!this._meshInstance) {
      this._meshInstance = new MeshInstance(mesh, this._material, this._node);
      this._meshInstance.castShadow = false;
      this._meshInstance.receiveShadow = false;
      this._meshInstance.drawOrder = this._drawOrder;
      this._model.meshInstances.push(this._meshInstance);

      this._colorUniform[0] = this._color.r;
      this._colorUniform[1] = this._color.g;
      this._colorUniform[2] = this._color.b;
      this._meshInstance.setParameter(PARAM_EMISSIVE, this._colorUniform);
      this._meshInstance.setParameter(PARAM_OPACITY, this._color.a);

      if (this.enabled && this.entity.enabled) {
        this._showModel();
      }
    }

    if (this._meshInstance.material !== material) {
      this._meshInstance.material = material;
    }

    if (this._meshInstance.mesh !== mesh) {
      this._meshInstance.mesh = mesh;
      this._meshInstance.visible = true;
      this._meshInstance._aabbVer = -1;
    }

    if (this.sprite.atlas && this.sprite.atlas.texture) {
      this._meshInstance.setParameter(PARAM_EMISSIVE_MAP, this.sprite.atlas.texture);
      this._meshInstance.setParameter(PARAM_OPACITY_MAP, this.sprite.atlas.texture);
    } else {
      this._meshInstance.deleteParameter(PARAM_EMISSIVE_MAP);
      this._meshInstance.deleteParameter(PARAM_OPACITY_MAP);
    }

    if (this.sprite.atlas && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
      this._meshInstance._updateAabbFunc = this._updateAabbFunc;

      const frameData = this.sprite.atlas.frames[this.sprite.frameKeys[frame]];
      if (frameData) {
        const borderWidthScale = 2 / frameData.rect.z;
        const borderHeightScale = 2 / frameData.rect.w;
        this._innerOffset.set(frameData.border.x * borderWidthScale, frameData.border.y * borderHeightScale, frameData.border.z * borderWidthScale, frameData.border.w * borderHeightScale);
        const tex = this.sprite.atlas.texture;
        this._atlasRect.set(frameData.rect.x / tex.width, frameData.rect.y / tex.height, frameData.rect.z / tex.width, frameData.rect.w / tex.height);
      } else {
        this._innerOffset.set(0, 0, 0, 0);
      }

      this._innerOffsetUniform[0] = this._innerOffset.x;
      this._innerOffsetUniform[1] = this._innerOffset.y;
      this._innerOffsetUniform[2] = this._innerOffset.z;
      this._innerOffsetUniform[3] = this._innerOffset.w;
      this._meshInstance.setParameter(PARAM_INNER_OFFSET, this._innerOffsetUniform);
      this._atlasRectUniform[0] = this._atlasRect.x;
      this._atlasRectUniform[1] = this._atlasRect.y;
      this._atlasRectUniform[2] = this._atlasRect.z;
      this._atlasRectUniform[3] = this._atlasRect.w;
      this._meshInstance.setParameter(PARAM_ATLAS_RECT, this._atlasRectUniform);
    } else {
      this._meshInstance._updateAabbFunc = null;
    }
    this._updateTransform();
  }
  _updateTransform() {
    let scaleX = this.flipX ? -1 : 1;
    let scaleY = this.flipY ? -1 : 1;

    let posX = 0;
    let posY = 0;
    if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
      let w = 1;
      let h = 1;
      if (this.sprite.atlas) {
        const frameData = this.sprite.atlas.frames[this.sprite.frameKeys[this.frame]];
        if (frameData) {
          w = frameData.rect.z;
          h = frameData.rect.w;

          posX = (0.5 - frameData.pivot.x) * this._width;
          posY = (0.5 - frameData.pivot.y) * this._height;
        }
      }

      const scaleMulX = w / this.sprite.pixelsPerUnit;
      const scaleMulY = h / this.sprite.pixelsPerUnit;

      this._outerScale.set(Math.max(this._width, this._innerOffset.x * scaleMulX), Math.max(this._height, this._innerOffset.y * scaleMulY));
      scaleX *= scaleMulX;
      scaleY *= scaleMulY;
      this._outerScale.x /= scaleMulX;
      this._outerScale.y /= scaleMulY;

      scaleX *= math.clamp(this._width / (this._innerOffset.x * scaleMulX), 0.0001, 1);
      scaleY *= math.clamp(this._height / (this._innerOffset.y * scaleMulY), 0.0001, 1);

      if (this._meshInstance) {
        this._outerScaleUniform[0] = this._outerScale.x;
        this._outerScaleUniform[1] = this._outerScale.y;
        this._meshInstance.setParameter(PARAM_OUTER_SCALE, this._outerScaleUniform);
      }
    }

    this._node.setLocalScale(scaleX, scaleY, 1);
    this._node.setLocalPosition(posX, posY, 0);
  }

  _updateAabb(aabb) {
    aabb.center.set(0, 0, 0);
    aabb.halfExtents.set(this._outerScale.x * 0.5, this._outerScale.y * 0.5, 0.001);
    aabb.setFromTransformedAabb(aabb, this._node.getWorldTransform());
    return aabb;
  }
  _tryAutoPlay() {
    if (!this._autoPlayClip) return;
    if (this.type !== SPRITETYPE_ANIMATED) return;
    const clip = this._clips[this._autoPlayClip];
    if (clip && !clip.isPlaying && (!this._currentClip || !this._currentClip.isPlaying)) {
      if (this.enabled && this.entity.enabled) {
        this.play(clip.name);
      }
    }
  }
  _onLayersChanged(oldComp, newComp) {
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
    if (this.enabled && this.entity.enabled) {
      this._showModel();
    }
  }
  _onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    if (this._addedModel && this.enabled && this.entity.enabled && this._meshInstance) {
      layer.addMeshInstances([this._meshInstance]);
    }
  }
  _onLayerRemoved(layer) {
    if (!this._meshInstance) return;
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeMeshInstances([this._meshInstance]);
  }
  removeModelFromLayers() {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (!layer) continue;
      layer.removeMeshInstances([this._meshInstance]);
    }
  }

  addClip(data) {
    const clip = new SpriteAnimationClip(this, {
      name: data.name,
      fps: data.fps,
      loop: data.loop,
      spriteAsset: data.spriteAsset
    });
    this._clips[data.name] = clip;
    if (clip.name && clip.name === this._autoPlayClip) this._tryAutoPlay();
    return clip;
  }

  removeClip(name) {
    delete this._clips[name];
  }

  clip(name) {
    return this._clips[name];
  }

  play(name) {
    const clip = this._clips[name];
    const current = this._currentClip;
    if (current && current !== clip) {
      current._playing = false;
    }
    this._currentClip = clip;
    if (this._currentClip) {
      this._currentClip = clip;
      this._currentClip.play();
    } else {
      Debug.warn(`Trying to play sprite animation ${name} which does not exist.`);
    }
    return clip;
  }

  pause() {
    if (this._currentClip === this._defaultClip) return;
    if (this._currentClip.isPlaying) {
      this._currentClip.pause();
    }
  }

  resume() {
    if (this._currentClip === this._defaultClip) return;
    if (this._currentClip.isPaused) {
      this._currentClip.resume();
    }
  }

  stop() {
    if (this._currentClip === this._defaultClip) return;
    this._currentClip.stop();
  }
}

export { SpriteComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc3ByaXRlL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9XT1JMRCxcbiAgICBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQsIFNQUklURV9SRU5ERVJNT0RFX1RJTEVEXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBTUFJJVEVUWVBFX1NJTVBMRSwgU1BSSVRFVFlQRV9BTklNQVRFRCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNwcml0ZUFuaW1hdGlvbkNsaXAgfSBmcm9tICcuL3Nwcml0ZS1hbmltYXRpb24tY2xpcC5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBBc3NldCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gRW50aXR5ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5TcHJpdGVDb21wb25lbnRTeXN0ZW19IFNwcml0ZUNvbXBvbmVudFN5c3RlbSAqL1xuXG5jb25zdCBQQVJBTV9FTUlTU0lWRV9NQVAgPSAndGV4dHVyZV9lbWlzc2l2ZU1hcCc7XG5jb25zdCBQQVJBTV9PUEFDSVRZX01BUCA9ICd0ZXh0dXJlX29wYWNpdHlNYXAnO1xuY29uc3QgUEFSQU1fRU1JU1NJVkUgPSAnbWF0ZXJpYWxfZW1pc3NpdmUnO1xuY29uc3QgUEFSQU1fT1BBQ0lUWSA9ICdtYXRlcmlhbF9vcGFjaXR5JztcbmNvbnN0IFBBUkFNX0lOTkVSX09GRlNFVCA9ICdpbm5lck9mZnNldCc7XG5jb25zdCBQQVJBTV9PVVRFUl9TQ0FMRSA9ICdvdXRlclNjYWxlJztcbmNvbnN0IFBBUkFNX0FUTEFTX1JFQ1QgPSAnYXRsYXNSZWN0JztcblxuLyoqXG4gKiBFbmFibGVzIGFuIEVudGl0eSB0byByZW5kZXIgYSBzaW1wbGUgc3RhdGljIHNwcml0ZSBvciBzcHJpdGUgYW5pbWF0aW9ucy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIFNwcml0ZUNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNwcml0ZUNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3ByaXRlQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl90eXBlID0gU1BSSVRFVFlQRV9TSU1QTEU7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgdGhpcy5fY29sb3IgPSBuZXcgQ29sb3IoMSwgMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuX3NwZWVkID0gMTtcbiAgICAgICAgdGhpcy5fZmxpcFggPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZmxpcFkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fd2lkdGggPSAxO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSAxO1xuXG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IDA7XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAgICAgLy8gOS1zbGljaW5nXG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUgPSBuZXcgVmVjMigxLCAxKTtcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB0aGlzLl9pbm5lck9mZnNldCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuXG4gICAgICAgIC8vIGJhdGNoIGdyb3Vwc1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSAtMTtcbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cCA9IG51bGw7XG5cbiAgICAgICAgLy8gbm9kZSAvIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgdGhpcy5fbm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwuZ3JhcGggPSB0aGlzLl9ub2RlO1xuICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICBlbnRpdHkuYWRkQ2hpbGQodGhpcy5fbW9kZWwuZ3JhcGgpO1xuICAgICAgICB0aGlzLl9tb2RlbC5fZW50aXR5ID0gZW50aXR5O1xuICAgICAgICB0aGlzLl91cGRhdGVBYWJiRnVuYyA9IHRoaXMuX3VwZGF0ZUFhYmIuYmluZCh0aGlzKTtcblxuICAgICAgICB0aGlzLl9hZGRlZE1vZGVsID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYW5pbWF0ZWQgc3ByaXRlc1xuICAgICAgICB0aGlzLl9hdXRvUGxheUNsaXAgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaWN0aW9uYXJ5IG9mIHNwcml0ZSBhbmltYXRpb24gY2xpcHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBTcHJpdGVBbmltYXRpb25DbGlwPn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsaXBzID0ge307XG5cbiAgICAgICAgLy8gY3JlYXRlIGRlZmF1bHQgY2xpcCBmb3Igc2ltcGxlIHNwcml0ZSB0eXBlXG4gICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwID0gbmV3IFNwcml0ZUFuaW1hdGlvbkNsaXAodGhpcywge1xuICAgICAgICAgICAgbmFtZTogdGhpcy5lbnRpdHkubmFtZSxcbiAgICAgICAgICAgIGZwczogMCxcbiAgICAgICAgICAgIGxvb3A6IGZhbHNlLFxuICAgICAgICAgICAgc3ByaXRlQXNzZXQ6IG51bGxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzcHJpdGUgYW5pbWF0aW9uIGNsaXAgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTcHJpdGVBbmltYXRpb25DbGlwfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSB0aGlzLl9kZWZhdWx0Q2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIHN0YXJ0cyBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNwbGF5XG4gICAgICogQHBhcmFtIHtTcHJpdGVBbmltYXRpb25DbGlwfSBjbGlwIC0gVGhlIGNsaXAgdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjcGF1c2VcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IHdhcyBwYXVzZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I3Jlc3VtZVxuICAgICAqIEBwYXJhbSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gY2xpcCAtIFRoZSBjbGlwIHRoYXQgd2FzIHJlc3VtZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I3N0b3BcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IHdhcyBzdG9wcGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCBzdG9wcyBwbGF5aW5nIGJlY2F1c2UgaXQgcmVhY2hlZCBpdHMgZW5kaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNlbmRcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IGVuZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCByZWFjaGVkIHRoZSBlbmQgb2YgaXRzIGN1cnJlbnQgbG9vcC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjbG9vcFxuICAgICAqIEBwYXJhbSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gY2xpcCAtIFRoZSBjbGlwLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIFNwcml0ZUNvbXBvbmVudC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1BSSVRFVFlQRV9TSU1QTEV9OiBUaGUgY29tcG9uZW50IHJlbmRlcnMgYSBzaW5nbGUgZnJhbWUgZnJvbSBhIHNwcml0ZSBhc3NldC5cbiAgICAgKiAtIHtAbGluayBTUFJJVEVUWVBFX0FOSU1BVEVEfTogVGhlIGNvbXBvbmVudCBjYW4gcGxheSBzcHJpdGUgYW5pbWF0aW9uIGNsaXBzLlxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFNQUklURVRZUEVfU0lNUExFfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IFNQUklURVRZUEVfU0lNUExFKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gdGhpcy5fZGVmYXVsdENsaXA7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lID0gdGhpcy5mcmFtZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcC5zcHJpdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gU1BSSVRFVFlQRV9BTklNQVRFRCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgJiYgdGhpcy5fY3VycmVudENsaXAuaXNQbGF5aW5nICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGVNb2RlbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBmcmFtZSBjb3VudGVyIG9mIHRoZSBzcHJpdGUuIFNwZWNpZmllcyB3aGljaCBmcmFtZSBmcm9tIHRoZSBjdXJyZW50IHNwcml0ZSBhc3NldCB0b1xuICAgICAqIHJlbmRlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZyYW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGZyYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudENsaXAuZnJhbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFzc2V0IGlkIG9yIHRoZSB7QGxpbmsgQXNzZXR9IG9mIHRoZSBzcHJpdGUgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICAgICAqIHtAbGluayBTUFJJVEVUWVBFX1NJTVBMRX0gc3ByaXRlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ8QXNzZXR9XG4gICAgICovXG4gICAgc2V0IHNwcml0ZUFzc2V0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwLnNwcml0ZUFzc2V0ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZUFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVmYXVsdENsaXAuX3Nwcml0ZUFzc2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTcHJpdGV9XG4gICAgICovXG4gICAgc2V0IHNwcml0ZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5zcHJpdGUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc3ByaXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudENsaXAuc3ByaXRlO1xuICAgIH1cblxuICAgIC8vIChwcml2YXRlKSB7cGMuTWF0ZXJpYWx9IG1hdGVyaWFsIFRoZSBtYXRlcmlhbCB1c2VkIHRvIHJlbmRlciBhIHNwcml0ZS5cbiAgICBzZXQgbWF0ZXJpYWwodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sb3IgdGludCBvZiB0aGUgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge0NvbG9yfVxuICAgICAqL1xuICAgIHNldCBjb2xvcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jb2xvci5yID0gdmFsdWUucjtcbiAgICAgICAgdGhpcy5fY29sb3IuZyA9IHZhbHVlLmc7XG4gICAgICAgIHRoaXMuX2NvbG9yLmIgPSB2YWx1ZS5iO1xuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9jb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fRU1JU1NJVkUsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgb3BhY2l0eSBvZiB0aGUgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgb3BhY2l0eSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jb2xvci5hID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fT1BBQ0lUWSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9wYWNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvci5hO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZGljdGlvbmFyeSB0aGF0IGNvbnRhaW5zIHtAbGluayBTcHJpdGVBbmltYXRpb25DbGlwfXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgU3ByaXRlQW5pbWF0aW9uQ2xpcD59XG4gICAgICovXG4gICAgc2V0IGNsaXBzKHZhbHVlKSB7XG4gICAgICAgIC8vIGlmIHZhbHVlIGlzIG51bGwgcmVtb3ZlIGFsbCBjbGlwc1xuICAgICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gdGhpcy5fY2xpcHMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUNsaXAobmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgZXhpc3RpbmcgY2xpcHMgbm90IGluIG5ldyB2YWx1ZVxuICAgICAgICAvLyBhbmQgdXBkYXRlIGNsaXBzIGluIGJvdGggb2JqZWN0c1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gdGhpcy5fY2xpcHMpIHtcbiAgICAgICAgICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWVba2V5XS5uYW1lID09PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uZnBzID0gdmFsdWVba2V5XS5mcHM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NsaXBzW25hbWVdLmxvb3AgPSB2YWx1ZVtrZXldLmxvb3A7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlW2tleV0uaGFzT3duUHJvcGVydHkoJ3Nwcml0ZScpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlwc1tuYW1lXS5zcHJpdGUgPSB2YWx1ZVtrZXldLnNwcml0ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZVtrZXldLmhhc093blByb3BlcnR5KCdzcHJpdGVBc3NldCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlwc1tuYW1lXS5zcHJpdGVBc3NldCA9IHZhbHVlW2tleV0uc3ByaXRlQXNzZXQ7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZm91bmQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUNsaXAobmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGQgY2xpcHMgdGhhdCBkbyBub3QgZXhpc3RcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jbGlwc1t2YWx1ZVtrZXldLm5hbWVdKSBjb250aW51ZTtcblxuICAgICAgICAgICAgdGhpcy5hZGRDbGlwKHZhbHVlW2tleV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXV0byBwbGF5IGNsaXBcbiAgICAgICAgaWYgKHRoaXMuX2F1dG9QbGF5Q2xpcCkge1xuICAgICAgICAgICAgdGhpcy5fdHJ5QXV0b1BsYXkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBjdXJyZW50IGNsaXAgZG9lc24ndCBoYXZlIGEgc3ByaXRlIHRoZW4gaGlkZSB0aGUgbW9kZWxcbiAgICAgICAgaWYgKCF0aGlzLl9jdXJyZW50Q2xpcCB8fCAhdGhpcy5fY3VycmVudENsaXAuc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjbGlwcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGNsaXAgYmVpbmcgcGxheWVkLlxuICAgICAqXG4gICAgICogQHR5cGUge1Nwcml0ZUFuaW1hdGlvbkNsaXB9XG4gICAgICovXG4gICAgZ2V0IGN1cnJlbnRDbGlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudENsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBnbG9iYWwgc3BlZWQgbW9kaWZpZXIgdXNlZCB3aGVuIHBsYXlpbmcgc3ByaXRlIGFuaW1hdGlvbiBjbGlwcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNwZWVkKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NwZWVkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNwZWVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3BlZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmxpcCB0aGUgWCBheGlzIHdoZW4gcmVuZGVyaW5nIGEgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZsaXBYKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mbGlwWCA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mbGlwWCA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICBnZXQgZmxpcFgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwWDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGbGlwIHRoZSBZIGF4aXMgd2hlbiByZW5kZXJpbmcgYSBzcHJpdGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZmxpcFkodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZsaXBZID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2ZsaXBZID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zZm9ybSgpO1xuICAgIH1cblxuICAgIGdldCBmbGlwWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZsaXBZO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgc3ByaXRlIHdoZW4gcmVuZGVyaW5nIHVzaW5nIDktU2xpY2luZy4gVGhlIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG9ubHkgdXNlZFxuICAgICAqIHdoZW4gdGhlIHJlbmRlciBtb2RlIG9mIHRoZSBzcHJpdGUgYXNzZXQgaXMgU2xpY2VkIG9yIFRpbGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgd2lkdGgodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB0aGlzLl93aWR0aCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUueCA9IHRoaXMuX3dpZHRoO1xuXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBzcHJpdGUgd2hlbiByZW5kZXJpbmcgdXNpbmcgOS1TbGljaW5nLiBUaGUgd2lkdGggYW5kIGhlaWdodCBhcmUgb25seSB1c2VkXG4gICAgICogd2hlbiB0aGUgcmVuZGVyIG1vZGUgb2YgdGhlIHNwcml0ZSBhc3NldCBpcyBTbGljZWQgb3IgVGlsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBoZWlnaHQodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB0aGlzLl9oZWlnaHQpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9oZWlnaHQgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS55ID0gdGhpcy5oZWlnaHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIHNwcml0ZSB0byBhIHNwZWNpZmljIGJhdGNoIGdyb3VwIChzZWUge0BsaW5rIEJhdGNoR3JvdXB9KS4gRGVmYXVsdCBpcyAtMSAobm8gZ3JvdXApLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYmF0Y2hHcm91cElkKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHByZXYgPSB0aGlzLl9iYXRjaEdyb3VwSWQ7XG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBJZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHByZXYgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLlNQUklURSwgcHJldiwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHZhbHVlID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5TUFJJVEUsIHZhbHVlLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyByZS1hZGQgbW9kZWwgdG8gc2NlbmUgaW4gY2FzZSBpdCB3YXMgcmVtb3ZlZCBieSBiYXRjaGluZ1xuICAgICAgICAgICAgaWYgKHByZXYgPj0gMCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCAmJiB0aGlzLl9jdXJyZW50Q2xpcC5zcHJpdGUgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGJhdGNoR3JvdXBJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoR3JvdXBJZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgY2xpcCB0byBwbGF5IGF1dG9tYXRpY2FsbHkgd2hlbiB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWQgYW5kIHRoZSBjbGlwIGV4aXN0cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IGF1dG9QbGF5Q2xpcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hdXRvUGxheUNsaXAgPSB2YWx1ZSBpbnN0YW5jZW9mIFNwcml0ZUFuaW1hdGlvbkNsaXAgPyB2YWx1ZS5uYW1lIDogdmFsdWU7XG4gICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9QbGF5Q2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F1dG9QbGF5Q2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZHJhdyBvcmRlciBvZiB0aGUgY29tcG9uZW50LiBBIGhpZ2hlciB2YWx1ZSBtZWFucyB0aGF0IHRoZSBjb21wb25lbnQgd2lsbCBiZSByZW5kZXJlZCBvblxuICAgICAqIHRvcCBvZiBvdGhlciBjb21wb25lbnRzIGluIHRoZSBzYW1lIGxheWVyLiBUaGlzIGlzIG5vdCB1c2VkIHVubGVzcyB0aGUgbGF5ZXIncyBzb3J0IG9yZGVyIGlzXG4gICAgICogc2V0IHRvIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZHJhd09yZGVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZHJhd09yZGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZHJhd09yZGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhpcyBzcHJpdGUgc2hvdWxkIGJlbG9uZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgbGF5ZXJzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9hZGRlZE1vZGVsKSB7XG4gICAgICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xheWVycyA9IHZhbHVlO1xuXG4gICAgICAgIC8vIGVhcmx5IG91dFxuICAgICAgICBpZiAoIXRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9zaG93TW9kZWwoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgZ2V0IGFhYmIoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tZXNoSW5zdGFuY2UuYWFiYjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gYXBwLnNjZW5lO1xuXG4gICAgICAgIHNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgdGhpcy5fb25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLl9vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLl9vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zaG93TW9kZWwoKTtcbiAgICAgICAgaWYgKHRoaXMuX2F1dG9QbGF5Q2xpcClcbiAgICAgICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuU1BSSVRFLCB0aGlzLl9iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLl9vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAoc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub2ZmKCdhZGQnLCB0aGlzLl9vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5fb25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIHRoaXMuX2hpZGVNb2RlbCgpO1xuXG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuU1BSSVRFLCB0aGlzLl9iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLl9kZWZhdWx0Q2xpcCkge1xuICAgICAgICAgICAgdGhpcy5fZGVmYXVsdENsaXAuX2Rlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl9jbGlwcykge1xuICAgICAgICAgICAgdGhpcy5fY2xpcHNba2V5XS5fZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NsaXBzID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLl9ub2RlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbm9kZS5wYXJlbnQpXG4gICAgICAgICAgICAgICAgdGhpcy5fbm9kZS5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5fbm9kZSk7XG4gICAgICAgICAgICB0aGlzLl9ub2RlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB3ZSBkZWNyZWFzZSB0aGUgcmVmIGNvdW50cyBtYXRlcmlhbHMgYW5kIG1lc2hlc1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tZXNoID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2hvd01vZGVsKCkge1xuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbCkgcmV0dXJuO1xuICAgICAgICBpZiAoIXRoaXMuX21lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBbdGhpcy5fbWVzaEluc3RhbmNlXTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKG1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYWRkZWRNb2RlbCA9IHRydWU7XG4gICAgfVxuXG4gICAgX2hpZGVNb2RlbCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hZGRlZE1vZGVsIHx8ICF0aGlzLl9tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gW3RoaXMuX21lc2hJbnN0YW5jZV07XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2xheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhtZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWwgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBTZXQgdGhlIGRlc2lyZWQgbWVzaCBvbiB0aGUgbWVzaCBpbnN0YW5jZVxuICAgIF9zaG93RnJhbWUoZnJhbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLnNwcml0ZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1lc2ggPSB0aGlzLnNwcml0ZS5tZXNoZXNbZnJhbWVdO1xuICAgICAgICAvLyBpZiBtZXNoIGlzIG51bGwgdGhlbiBoaWRlIHRoZSBtZXNoIGluc3RhbmNlXG4gICAgICAgIGlmICghbWVzaCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tZXNoID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UudmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbWF0ZXJpYWw7XG4gICAgICAgIGlmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdDlTbGljZWRNYXRlcmlhbFNsaWNlZE1vZGU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdDlTbGljZWRNYXRlcmlhbFRpbGVkTW9kZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIG1lc2ggaW5zdGFuY2UgaWYgaXQgZG9lc24ndCBleGlzdCB5ZXRcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaCwgdGhpcy5fbWF0ZXJpYWwsIHRoaXMuX25vZGUpO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5yZWNlaXZlU2hhZG93ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdGhpcy5fZHJhd09yZGVyO1xuICAgICAgICAgICAgdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcy5wdXNoKHRoaXMuX21lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIC8vIHNldCBvdmVycmlkZXMgb24gbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzBdID0gdGhpcy5fY29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsxXSA9IHRoaXMuX2NvbG9yLmc7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9jb2xvci5iO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9FTUlTU0lWRSwgdGhpcy5fY29sb3JVbmlmb3JtKTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fT1BBQ0lUWSwgdGhpcy5fY29sb3IuYSk7XG5cbiAgICAgICAgICAgIC8vIG5vdyB0aGF0IHdlIGNyZWF0ZWQgdGhlIG1lc2ggaW5zdGFuY2UsIGFkZCB0aGUgbW9kZWwgdG8gdGhlIHNjZW5lXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zaG93TW9kZWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBtYXRlcmlhbFxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlLm1hdGVyaWFsICE9PSBtYXRlcmlhbCkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgbWVzaFxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlLm1lc2ggIT09IG1lc2gpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tZXNoID0gbWVzaDtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIC8vIHJlc2V0IGFhYmJcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5fYWFiYlZlciA9IC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IHRleHR1cmUgcGFyYW1zXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZS5hdGxhcyAmJiB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFX01BUCwgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09QQUNJVFlfTUFQLCB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vIHRleHR1cmUgc28gcmVzZXQgdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIoUEFSQU1fRU1JU1NJVkVfTUFQKTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIoUEFSQU1fT1BBQ0lUWV9NQVApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yIDktc2xpY2VkXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZS5hdGxhcyAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8IHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSkge1xuICAgICAgICAgICAgLy8gc2V0IGN1c3RvbSBhYWJiIGZ1bmN0aW9uXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmJGdW5jID0gdGhpcy5fdXBkYXRlQWFiYkZ1bmM7XG5cbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBpbm5lciBvZmZzZXRcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lRGF0YSA9IHRoaXMuc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLnNwcml0ZS5mcmFtZUtleXNbZnJhbWVdXTtcbiAgICAgICAgICAgIGlmIChmcmFtZURhdGEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBib3JkZXJXaWR0aFNjYWxlID0gMiAvIGZyYW1lRGF0YS5yZWN0Lno7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9yZGVySGVpZ2h0U2NhbGUgPSAyIC8gZnJhbWVEYXRhLnJlY3QudztcblxuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0LnNldChcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci54ICogYm9yZGVyV2lkdGhTY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci55ICogYm9yZGVySGVpZ2h0U2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueiAqIGJvcmRlcldpZHRoU2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIudyAqIGJvcmRlckhlaWdodFNjYWxlXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IHRoaXMuc3ByaXRlLmF0bGFzLnRleHR1cmU7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0LnNldChmcmFtZURhdGEucmVjdC54IC8gdGV4LndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueSAvIHRleC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEucmVjdC56IC8gdGV4LndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QudyAvIHRleC5oZWlnaHRcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0LnNldCgwLCAwLCAwLCAwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IGlubmVyIG9mZnNldCBhbmQgYXRsYXMgcmVjdCBvbiBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMF0gPSB0aGlzLl9pbm5lck9mZnNldC54O1xuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzFdID0gdGhpcy5faW5uZXJPZmZzZXQueTtcbiAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVsyXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lno7XG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bM10gPSB0aGlzLl9pbm5lck9mZnNldC53O1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9JTk5FUl9PRkZTRVQsIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybSk7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzBdID0gdGhpcy5fYXRsYXNSZWN0Lng7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzFdID0gdGhpcy5fYXRsYXNSZWN0Lnk7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzJdID0gdGhpcy5fYXRsYXNSZWN0Lno7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzNdID0gdGhpcy5fYXRsYXNSZWN0Lnc7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0FUTEFTX1JFQ1QsIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLl91cGRhdGVBYWJiRnVuYyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlVHJhbnNmb3JtKCkge1xuICAgICAgICAvLyBmbGlwXG4gICAgICAgIGxldCBzY2FsZVggPSB0aGlzLmZsaXBYID8gLTEgOiAxO1xuICAgICAgICBsZXQgc2NhbGVZID0gdGhpcy5mbGlwWSA/IC0xIDogMTtcblxuICAgICAgICAvLyBwaXZvdFxuICAgICAgICBsZXQgcG9zWCA9IDA7XG4gICAgICAgIGxldCBwb3NZID0gMDtcblxuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcblxuICAgICAgICAgICAgbGV0IHcgPSAxO1xuICAgICAgICAgICAgbGV0IGggPSAxO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5zcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmcmFtZURhdGEgPSB0aGlzLnNwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5zcHJpdGUuZnJhbWVLZXlzW3RoaXMuZnJhbWVdXTtcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWVEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGdldCBmcmFtZSBkaW1lbnNpb25zXG4gICAgICAgICAgICAgICAgICAgIHcgPSBmcmFtZURhdGEucmVjdC56O1xuICAgICAgICAgICAgICAgICAgICBoID0gZnJhbWVEYXRhLnJlY3QudztcblxuICAgICAgICAgICAgICAgICAgICAvLyB1cGRhdGUgcGl2b3RcbiAgICAgICAgICAgICAgICAgICAgcG9zWCA9ICgwLjUgLSBmcmFtZURhdGEucGl2b3QueCkgKiB0aGlzLl93aWR0aDtcbiAgICAgICAgICAgICAgICAgICAgcG9zWSA9ICgwLjUgLSBmcmFtZURhdGEucGl2b3QueSkgKiB0aGlzLl9oZWlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzY2FsZTogYXBwbHkgUFBVXG4gICAgICAgICAgICBjb25zdCBzY2FsZU11bFggPSB3IC8gdGhpcy5zcHJpdGUucGl4ZWxzUGVyVW5pdDtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlTXVsWSA9IGggLyB0aGlzLnNwcml0ZS5waXhlbHNQZXJVbml0O1xuXG4gICAgICAgICAgICAvLyBzY2FsZSBib3JkZXJzIGlmIG5lY2Vzc2FyeSBpbnN0ZWFkIG9mIG92ZXJsYXBwaW5nXG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnNldChNYXRoLm1heCh0aGlzLl93aWR0aCwgdGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIE1hdGgubWF4KHRoaXMuX2hlaWdodCwgdGhpcy5faW5uZXJPZmZzZXQueSAqIHNjYWxlTXVsWSkpO1xuXG4gICAgICAgICAgICBzY2FsZVggKj0gc2NhbGVNdWxYO1xuICAgICAgICAgICAgc2NhbGVZICo9IHNjYWxlTXVsWTtcblxuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS54IC89IHNjYWxlTXVsWDtcbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUueSAvPSBzY2FsZU11bFk7XG5cbiAgICAgICAgICAgIC8vIHNjYWxlOiBzaHJpbmtpbmcgYmVsb3cgMVxuICAgICAgICAgICAgc2NhbGVYICo9IG1hdGguY2xhbXAodGhpcy5fd2lkdGggLyAodGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIDAuMDAwMSwgMSk7XG4gICAgICAgICAgICBzY2FsZVkgKj0gbWF0aC5jbGFtcCh0aGlzLl9oZWlnaHQgLyAodGhpcy5faW5uZXJPZmZzZXQueSAqIHNjYWxlTXVsWSksIDAuMDAwMSwgMSk7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBvdXRlciBzY2FsZVxuICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtWzBdID0gdGhpcy5fb3V0ZXJTY2FsZS54O1xuICAgICAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtWzFdID0gdGhpcy5fb3V0ZXJTY2FsZS55O1xuICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fT1VURVJfU0NBTEUsIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNjYWxlXG4gICAgICAgIHRoaXMuX25vZGUuc2V0TG9jYWxTY2FsZShzY2FsZVgsIHNjYWxlWSwgMSk7XG4gICAgICAgIC8vIHBpdm90XG4gICAgICAgIHRoaXMuX25vZGUuc2V0TG9jYWxQb3NpdGlvbihwb3NYLCBwb3NZLCAwKTtcbiAgICB9XG5cbiAgICAvLyB1cGRhdGVzIEFBQkIgd2hpbGUgOS1zbGljaW5nXG4gICAgX3VwZGF0ZUFhYmIoYWFiYikge1xuICAgICAgICAvLyBwaXZvdFxuICAgICAgICBhYWJiLmNlbnRlci5zZXQoMCwgMCwgMCk7XG4gICAgICAgIC8vIHNpemVcbiAgICAgICAgYWFiYi5oYWxmRXh0ZW50cy5zZXQodGhpcy5fb3V0ZXJTY2FsZS54ICogMC41LCB0aGlzLl9vdXRlclNjYWxlLnkgKiAwLjUsIDAuMDAxKTtcbiAgICAgICAgLy8gd29ybGQgdHJhbnNmb3JtXG4gICAgICAgIGFhYmIuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihhYWJiLCB0aGlzLl9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICByZXR1cm4gYWFiYjtcbiAgICB9XG5cbiAgICBfdHJ5QXV0b1BsYXkoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXV0b1BsYXlDbGlwKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLnR5cGUgIT09IFNQUklURVRZUEVfQU5JTUFURUQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBjbGlwID0gdGhpcy5fY2xpcHNbdGhpcy5fYXV0b1BsYXlDbGlwXTtcbiAgICAgICAgLy8gaWYgdGhlIGNsaXAgZXhpc3RzIGFuZCBub3RoaW5nIGVsc2UgaXMgcGxheWluZyBwbGF5IGl0XG4gICAgICAgIGlmIChjbGlwICYmICFjbGlwLmlzUGxheWluZyAmJiAoIXRoaXMuX2N1cnJlbnRDbGlwIHx8ICF0aGlzLl9jdXJyZW50Q2xpcC5pc1BsYXlpbmcpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBsYXkoY2xpcC5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9zaG93TW9kZWwoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9hZGRlZE1vZGVsICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkICYmIHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhbdGhpcy5fbWVzaEluc3RhbmNlXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25MYXllclJlbW92ZWQobGF5ZXIpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMoW3RoaXMuX21lc2hJbnN0YW5jZV0pO1xuICAgIH1cblxuICAgIHJlbW92ZU1vZGVsRnJvbUxheWVycygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMoW3RoaXMuX21lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbmQgYWRkcyBhIG5ldyB7QGxpbmsgU3ByaXRlQW5pbWF0aW9uQ2xpcH0gdG8gdGhlIGNvbXBvbmVudCdzIGNsaXBzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBEYXRhIGZvciB0aGUgbmV3IGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGF0YS5uYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBuZXcgYW5pbWF0aW9uIGNsaXAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtkYXRhLmZwc10gLSBGcmFtZXMgcGVyIHNlY29uZCBmb3IgdGhlIGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RhdGEubG9vcF0gLSBXaGV0aGVyIHRvIGxvb3AgdGhlIGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfEFzc2V0fSBbZGF0YS5zcHJpdGVBc3NldF0gLSBUaGUgYXNzZXQgaWQgb3IgdGhlIHtAbGluayBBc3NldH0gb2YgdGhlIHNwcml0ZVxuICAgICAqIHRoYXQgdGhpcyBjbGlwIHdpbGwgcGxheS5cbiAgICAgKiBAcmV0dXJucyB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gVGhlIG5ldyBjbGlwIHRoYXQgd2FzIGFkZGVkLlxuICAgICAqL1xuICAgIGFkZENsaXAoZGF0YSkge1xuICAgICAgICBjb25zdCBjbGlwID0gbmV3IFNwcml0ZUFuaW1hdGlvbkNsaXAodGhpcywge1xuICAgICAgICAgICAgbmFtZTogZGF0YS5uYW1lLFxuICAgICAgICAgICAgZnBzOiBkYXRhLmZwcyxcbiAgICAgICAgICAgIGxvb3A6IGRhdGEubG9vcCxcbiAgICAgICAgICAgIHNwcml0ZUFzc2V0OiBkYXRhLnNwcml0ZUFzc2V0XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX2NsaXBzW2RhdGEubmFtZV0gPSBjbGlwO1xuXG4gICAgICAgIGlmIChjbGlwLm5hbWUgJiYgY2xpcC5uYW1lID09PSB0aGlzLl9hdXRvUGxheUNsaXApXG4gICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuXG4gICAgICAgIHJldHVybiBjbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYSBjbGlwIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBhbmltYXRpb24gY2xpcCB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlQ2xpcChuYW1lKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jbGlwc1tuYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYW4gYW5pbWF0aW9uIGNsaXAgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGNsaXAuXG4gICAgICogQHJldHVybnMge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IFRoZSBjbGlwLlxuICAgICAqL1xuICAgIGNsaXAobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2xpcHNbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGxheXMgYSBzcHJpdGUgYW5pbWF0aW9uIGNsaXAgYnkgbmFtZS4gSWYgdGhlIGFuaW1hdGlvbiBjbGlwIGlzIGFscmVhZHkgcGxheWluZyB0aGVuIHRoaXNcbiAgICAgKiB3aWxsIGRvIG5vdGhpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBjbGlwIHRvIHBsYXkuXG4gICAgICogQHJldHVybnMge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IFRoZSBjbGlwIHRoYXQgc3RhcnRlZCBwbGF5aW5nLlxuICAgICAqL1xuICAgIHBsYXkobmFtZSkge1xuICAgICAgICBjb25zdCBjbGlwID0gdGhpcy5fY2xpcHNbbmFtZV07XG5cbiAgICAgICAgY29uc3QgY3VycmVudCA9IHRoaXMuX2N1cnJlbnRDbGlwO1xuICAgICAgICBpZiAoY3VycmVudCAmJiBjdXJyZW50ICE9PSBjbGlwKSB7XG4gICAgICAgICAgICBjdXJyZW50Ll9wbGF5aW5nID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcCA9IGNsaXA7XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwKSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcCA9IGNsaXA7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5wbGF5KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKGBUcnlpbmcgdG8gcGxheSBzcHJpdGUgYW5pbWF0aW9uICR7bmFtZX0gd2hpY2ggZG9lcyBub3QgZXhpc3QuYCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXVzZXMgdGhlIGN1cnJlbnQgYW5pbWF0aW9uIGNsaXAuXG4gICAgICovXG4gICAgcGF1c2UoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCA9PT0gdGhpcy5fZGVmYXVsdENsaXApIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAuaXNQbGF5aW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5wYXVzZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lcyB0aGUgY3VycmVudCBwYXVzZWQgYW5pbWF0aW9uIGNsaXAuXG4gICAgICovXG4gICAgcmVzdW1lKCkge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgPT09IHRoaXMuX2RlZmF1bHRDbGlwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwLmlzUGF1c2VkKSB7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5yZXN1bWUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3BzIHRoZSBjdXJyZW50IGFuaW1hdGlvbiBjbGlwIGFuZCByZXNldHMgaXQgdG8gdGhlIGZpcnN0IGZyYW1lLlxuICAgICAqL1xuICAgIHN0b3AoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCA9PT0gdGhpcy5fZGVmYXVsdENsaXApIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5zdG9wKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTcHJpdGVDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJQQVJBTV9FTUlTU0lWRV9NQVAiLCJQQVJBTV9PUEFDSVRZX01BUCIsIlBBUkFNX0VNSVNTSVZFIiwiUEFSQU1fT1BBQ0lUWSIsIlBBUkFNX0lOTkVSX09GRlNFVCIsIlBBUkFNX09VVEVSX1NDQUxFIiwiUEFSQU1fQVRMQVNfUkVDVCIsIlNwcml0ZUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3R5cGUiLCJTUFJJVEVUWVBFX1NJTVBMRSIsIl9tYXRlcmlhbCIsImRlZmF1bHRNYXRlcmlhbCIsIl9jb2xvciIsIkNvbG9yIiwiX2NvbG9yVW5pZm9ybSIsIkZsb2F0MzJBcnJheSIsIl9zcGVlZCIsIl9mbGlwWCIsIl9mbGlwWSIsIl93aWR0aCIsIl9oZWlnaHQiLCJfZHJhd09yZGVyIiwiX2xheWVycyIsIkxBWUVSSURfV09STEQiLCJfb3V0ZXJTY2FsZSIsIlZlYzIiLCJfb3V0ZXJTY2FsZVVuaWZvcm0iLCJfaW5uZXJPZmZzZXQiLCJWZWM0IiwiX2lubmVyT2Zmc2V0VW5pZm9ybSIsIl9hdGxhc1JlY3QiLCJfYXRsYXNSZWN0VW5pZm9ybSIsIl9iYXRjaEdyb3VwSWQiLCJfYmF0Y2hHcm91cCIsIl9ub2RlIiwiR3JhcGhOb2RlIiwiX21vZGVsIiwiTW9kZWwiLCJncmFwaCIsIl9tZXNoSW5zdGFuY2UiLCJhZGRDaGlsZCIsIl9lbnRpdHkiLCJfdXBkYXRlQWFiYkZ1bmMiLCJfdXBkYXRlQWFiYiIsImJpbmQiLCJfYWRkZWRNb2RlbCIsIl9hdXRvUGxheUNsaXAiLCJfY2xpcHMiLCJfZGVmYXVsdENsaXAiLCJTcHJpdGVBbmltYXRpb25DbGlwIiwibmFtZSIsImZwcyIsImxvb3AiLCJzcHJpdGVBc3NldCIsIl9jdXJyZW50Q2xpcCIsInR5cGUiLCJ2YWx1ZSIsInN0b3AiLCJlbmFibGVkIiwiZnJhbWUiLCJzcHJpdGUiLCJfc2hvd01vZGVsIiwiX2hpZGVNb2RlbCIsIlNQUklURVRZUEVfQU5JTUFURUQiLCJfdHJ5QXV0b1BsYXkiLCJpc1BsYXlpbmciLCJfc3ByaXRlQXNzZXQiLCJtYXRlcmlhbCIsImNvbG9yIiwiciIsImciLCJiIiwic2V0UGFyYW1ldGVyIiwib3BhY2l0eSIsImEiLCJjbGlwcyIsInJlbW92ZUNsaXAiLCJmb3VuZCIsImtleSIsImhhc093blByb3BlcnR5IiwiYWRkQ2xpcCIsImN1cnJlbnRDbGlwIiwic3BlZWQiLCJmbGlwWCIsIl91cGRhdGVUcmFuc2Zvcm0iLCJmbGlwWSIsIndpZHRoIiwieCIsInJlbmRlck1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9USUxFRCIsIlNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCIsImhlaWdodCIsInkiLCJiYXRjaEdyb3VwSWQiLCJwcmV2IiwiYXBwIiwiYmF0Y2hlciIsInJlbW92ZSIsIkJhdGNoR3JvdXAiLCJTUFJJVEUiLCJpbnNlcnQiLCJhdXRvUGxheUNsaXAiLCJkcmF3T3JkZXIiLCJsYXllcnMiLCJhYWJiIiwib25FbmFibGUiLCJzY2VuZSIsIm9uIiwiX29uTGF5ZXJzQ2hhbmdlZCIsIl9vbkxheWVyQWRkZWQiLCJfb25MYXllclJlbW92ZWQiLCJvbkRpc2FibGUiLCJvZmYiLCJvbkRlc3Ryb3kiLCJfZGVzdHJveSIsInBhcmVudCIsInJlbW92ZUNoaWxkIiwibWVzaCIsIm1lc2hJbnN0YW5jZXMiLCJpIiwibGVuIiwibGVuZ3RoIiwibGF5ZXIiLCJnZXRMYXllckJ5SWQiLCJhZGRNZXNoSW5zdGFuY2VzIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIl9zaG93RnJhbWUiLCJtZXNoZXMiLCJ2aXNpYmxlIiwiZGVmYXVsdDlTbGljZWRNYXRlcmlhbFNsaWNlZE1vZGUiLCJkZWZhdWx0OVNsaWNlZE1hdGVyaWFsVGlsZWRNb2RlIiwiTWVzaEluc3RhbmNlIiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJwdXNoIiwiX2FhYmJWZXIiLCJhdGxhcyIsInRleHR1cmUiLCJkZWxldGVQYXJhbWV0ZXIiLCJmcmFtZURhdGEiLCJmcmFtZXMiLCJmcmFtZUtleXMiLCJib3JkZXJXaWR0aFNjYWxlIiwicmVjdCIsInoiLCJib3JkZXJIZWlnaHRTY2FsZSIsInciLCJzZXQiLCJib3JkZXIiLCJ0ZXgiLCJzY2FsZVgiLCJzY2FsZVkiLCJwb3NYIiwicG9zWSIsImgiLCJwaXZvdCIsInNjYWxlTXVsWCIsInBpeGVsc1BlclVuaXQiLCJzY2FsZU11bFkiLCJNYXRoIiwibWF4IiwibWF0aCIsImNsYW1wIiwic2V0TG9jYWxTY2FsZSIsInNldExvY2FsUG9zaXRpb24iLCJjZW50ZXIiLCJoYWxmRXh0ZW50cyIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImNsaXAiLCJwbGF5Iiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsImluZGV4IiwiaW5kZXhPZiIsImlkIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwiZGF0YSIsImN1cnJlbnQiLCJfcGxheWluZyIsIkRlYnVnIiwid2FybiIsInBhdXNlIiwicmVzdW1lIiwiaXNQYXVzZWQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF5QkEsTUFBTUEsa0JBQWtCLEdBQUcscUJBQXFCLENBQUE7QUFDaEQsTUFBTUMsaUJBQWlCLEdBQUcsb0JBQW9CLENBQUE7QUFDOUMsTUFBTUMsY0FBYyxHQUFHLG1CQUFtQixDQUFBO0FBQzFDLE1BQU1DLGFBQWEsR0FBRyxrQkFBa0IsQ0FBQTtBQUN4QyxNQUFNQyxrQkFBa0IsR0FBRyxhQUFhLENBQUE7QUFD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
