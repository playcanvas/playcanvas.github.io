/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../math/math.js';
import { Color } from '../../../math/color.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec4 } from '../../../math/vec4.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc3ByaXRlL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQge1xuICAgIExBWUVSSURfV09STEQsXG4gICAgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRFxufSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQmF0Y2hHcm91cCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLWdyb3VwLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21vZGVsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHsgU1BSSVRFVFlQRV9TSU1QTEUsIFNQUklURVRZUEVfQU5JTUFURUQgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTcHJpdGVBbmltYXRpb25DbGlwIH0gZnJvbSAnLi9zcHJpdGUtYW5pbWF0aW9uLWNsaXAuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH0gQXNzZXQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IEVudGl0eSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuU3ByaXRlQ29tcG9uZW50U3lzdGVtfSBTcHJpdGVDb21wb25lbnRTeXN0ZW0gKi9cblxuY29uc3QgUEFSQU1fRU1JU1NJVkVfTUFQID0gJ3RleHR1cmVfZW1pc3NpdmVNYXAnO1xuY29uc3QgUEFSQU1fT1BBQ0lUWV9NQVAgPSAndGV4dHVyZV9vcGFjaXR5TWFwJztcbmNvbnN0IFBBUkFNX0VNSVNTSVZFID0gJ21hdGVyaWFsX2VtaXNzaXZlJztcbmNvbnN0IFBBUkFNX09QQUNJVFkgPSAnbWF0ZXJpYWxfb3BhY2l0eSc7XG5jb25zdCBQQVJBTV9JTk5FUl9PRkZTRVQgPSAnaW5uZXJPZmZzZXQnO1xuY29uc3QgUEFSQU1fT1VURVJfU0NBTEUgPSAnb3V0ZXJTY2FsZSc7XG5jb25zdCBQQVJBTV9BVExBU19SRUNUID0gJ2F0bGFzUmVjdCc7XG5cbi8qKlxuICogRW5hYmxlcyBhbiBFbnRpdHkgdG8gcmVuZGVyIGEgc2ltcGxlIHN0YXRpYyBzcHJpdGUgb3Igc3ByaXRlIGFuaW1hdGlvbnMuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBTcHJpdGVDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTcHJpdGVDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0IGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgdGhpcy5fdHlwZSA9IFNQUklURVRZUEVfU0lNUExFO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgIHRoaXMuX2NvbG9yID0gbmV3IENvbG9yKDEsIDEsIDEsIDEpO1xuICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDMpO1xuICAgICAgICB0aGlzLl9zcGVlZCA9IDE7XG4gICAgICAgIHRoaXMuX2ZsaXBYID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZsaXBZID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3dpZHRoID0gMTtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gMTtcblxuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSAwO1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBbTEFZRVJJRF9XT1JMRF07IC8vIGFzc2lnbiB0byB0aGUgZGVmYXVsdCB3b3JsZCBsYXllclxuXG4gICAgICAgIC8vIDktc2xpY2luZ1xuICAgICAgICB0aGlzLl9vdXRlclNjYWxlID0gbmV3IFZlYzIoMSwgMSk7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICAgICAgdGhpcy5faW5uZXJPZmZzZXQgPSBuZXcgVmVjNCgpO1xuICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9hdGxhc1JlY3QgPSBuZXcgVmVjNCgpO1xuICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcblxuICAgICAgICAvLyBiYXRjaCBncm91cHNcbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cElkID0gLTE7XG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXAgPSBudWxsO1xuXG4gICAgICAgIC8vIG5vZGUgLyBtZXNoIGluc3RhbmNlXG4gICAgICAgIHRoaXMuX25vZGUgPSBuZXcgR3JhcGhOb2RlKCk7XG4gICAgICAgIHRoaXMuX21vZGVsID0gbmV3IE1vZGVsKCk7XG4gICAgICAgIHRoaXMuX21vZGVsLmdyYXBoID0gdGhpcy5fbm9kZTtcbiAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgZW50aXR5LmFkZENoaWxkKHRoaXMuX21vZGVsLmdyYXBoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwuX2VudGl0eSA9IGVudGl0eTtcbiAgICAgICAgdGhpcy5fdXBkYXRlQWFiYkZ1bmMgPSB0aGlzLl91cGRhdGVBYWJiLmJpbmQodGhpcyk7XG5cbiAgICAgICAgdGhpcy5fYWRkZWRNb2RlbCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGFuaW1hdGVkIHNwcml0ZXNcbiAgICAgICAgdGhpcy5fYXV0b1BsYXlDbGlwID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGljdGlvbmFyeSBvZiBzcHJpdGUgYW5pbWF0aW9uIGNsaXBzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgU3ByaXRlQW5pbWF0aW9uQ2xpcD59XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9jbGlwcyA9IHt9O1xuXG4gICAgICAgIC8vIGNyZWF0ZSBkZWZhdWx0IGNsaXAgZm9yIHNpbXBsZSBzcHJpdGUgdHlwZVxuICAgICAgICB0aGlzLl9kZWZhdWx0Q2xpcCA9IG5ldyBTcHJpdGVBbmltYXRpb25DbGlwKHRoaXMsIHtcbiAgICAgICAgICAgIG5hbWU6IHRoaXMuZW50aXR5Lm5hbWUsXG4gICAgICAgICAgICBmcHM6IDAsXG4gICAgICAgICAgICBsb29wOiBmYWxzZSxcbiAgICAgICAgICAgIHNwcml0ZUFzc2V0OiBudWxsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc3ByaXRlIGFuaW1hdGlvbiBjbGlwIGN1cnJlbnRseSBwbGF5aW5nLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gdGhpcy5fZGVmYXVsdENsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCBzdGFydHMgcGxheWluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjcGxheVxuICAgICAqIEBwYXJhbSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gY2xpcCAtIFRoZSBjbGlwIHRoYXQgc3RhcnRlZCBwbGF5aW5nLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCBpcyBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I3BhdXNlXG4gICAgICogQHBhcmFtIHtTcHJpdGVBbmltYXRpb25DbGlwfSBjbGlwIC0gVGhlIGNsaXAgdGhhdCB3YXMgcGF1c2VkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCBpcyByZXN1bWVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNyZXN1bWVcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IHdhcyByZXN1bWVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCBpcyBzdG9wcGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNzdG9wXG4gICAgICogQHBhcmFtIHtTcHJpdGVBbmltYXRpb25DbGlwfSBjbGlwIC0gVGhlIGNsaXAgdGhhdCB3YXMgc3RvcHBlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYW5pbWF0aW9uIGNsaXAgc3RvcHMgcGxheWluZyBiZWNhdXNlIGl0IHJlYWNoZWQgaXRzIGVuZGluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjZW5kXG4gICAgICogQHBhcmFtIHtTcHJpdGVBbmltYXRpb25DbGlwfSBjbGlwIC0gVGhlIGNsaXAgdGhhdCBlbmRlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYW5pbWF0aW9uIGNsaXAgcmVhY2hlZCB0aGUgZW5kIG9mIGl0cyBjdXJyZW50IGxvb3AuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I2xvb3BcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHRoZSBTcHJpdGVDb21wb25lbnQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNQUklURVRZUEVfU0lNUExFfTogVGhlIGNvbXBvbmVudCByZW5kZXJzIGEgc2luZ2xlIGZyYW1lIGZyb20gYSBzcHJpdGUgYXNzZXQuXG4gICAgICogLSB7QGxpbmsgU1BSSVRFVFlQRV9BTklNQVRFRH06IFRoZSBjb21wb25lbnQgY2FuIHBsYXkgc3ByaXRlIGFuaW1hdGlvbiBjbGlwcy5cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBTUFJJVEVUWVBFX1NJTVBMRX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB0eXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBTUFJJVEVUWVBFX1NJTVBMRSkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcCA9IHRoaXMuX2RlZmF1bHRDbGlwO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5mcmFtZSA9IHRoaXMuZnJhbWU7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAuc3ByaXRlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2hpZGVNb2RlbCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3R5cGUgPT09IFNQUklURVRZUEVfQU5JTUFURUQpIHtcbiAgICAgICAgICAgIHRoaXMuc3RvcCgpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYXV0b1BsYXlDbGlwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdHJ5QXV0b1BsYXkoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwICYmIHRoaXMuX2N1cnJlbnRDbGlwLmlzUGxheWluZyAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZnJhbWUgY291bnRlciBvZiB0aGUgc3ByaXRlLiBTcGVjaWZpZXMgd2hpY2ggZnJhbWUgZnJvbSB0aGUgY3VycmVudCBzcHJpdGUgYXNzZXQgdG9cbiAgICAgKiByZW5kZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBmcmFtZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5mcmFtZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmcmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhc3NldCBpZCBvciB0aGUge0BsaW5rIEFzc2V0fSBvZiB0aGUgc3ByaXRlIHRvIHJlbmRlci4gT25seSB3b3JrcyBmb3JcbiAgICAgKiB7QGxpbmsgU1BSSVRFVFlQRV9TSU1QTEV9IHNwcml0ZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfEFzc2V0fVxuICAgICAqL1xuICAgIHNldCBzcHJpdGVBc3NldCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kZWZhdWx0Q2xpcC5zcHJpdGVBc3NldCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzcHJpdGVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZmF1bHRDbGlwLl9zcHJpdGVBc3NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBzcHJpdGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U3ByaXRlfVxuICAgICAqL1xuICAgIHNldCBzcHJpdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAuc3ByaXRlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwLnNwcml0ZTtcbiAgICB9XG5cbiAgICAvLyAocHJpdmF0ZSkge3BjLk1hdGVyaWFsfSBtYXRlcmlhbCBUaGUgbWF0ZXJpYWwgdXNlZCB0byByZW5kZXIgYSBzcHJpdGUuXG4gICAgc2V0IG1hdGVyaWFsKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIHRpbnQgb2YgdGhlIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDb2xvcn1cbiAgICAgKi9cbiAgICBzZXQgY29sb3IodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY29sb3IuciA9IHZhbHVlLnI7XG4gICAgICAgIHRoaXMuX2NvbG9yLmcgPSB2YWx1ZS5nO1xuICAgICAgICB0aGlzLl9jb2xvci5iID0gdmFsdWUuYjtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX2NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG9wYWNpdHkgb2YgdGhlIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG9wYWNpdHkodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY29sb3IuYSA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09QQUNJVFksIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvcGFjaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3IuYTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGRpY3Rpb25hcnkgdGhhdCBjb250YWlucyB7QGxpbmsgU3ByaXRlQW5pbWF0aW9uQ2xpcH1zLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIFNwcml0ZUFuaW1hdGlvbkNsaXA+fVxuICAgICAqL1xuICAgIHNldCBjbGlwcyh2YWx1ZSkge1xuICAgICAgICAvLyBpZiB2YWx1ZSBpcyBudWxsIHJlbW92ZSBhbGwgY2xpcHNcbiAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuX2NsaXBzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVDbGlwKG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIGNsaXBzIG5vdCBpbiBuZXcgdmFsdWVcbiAgICAgICAgLy8gYW5kIHVwZGF0ZSBjbGlwcyBpbiBib3RoIG9iamVjdHNcbiAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuX2NsaXBzKSB7XG4gICAgICAgICAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlW2tleV0ubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NsaXBzW25hbWVdLmZwcyA9IHZhbHVlW2tleV0uZnBzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlwc1tuYW1lXS5sb29wID0gdmFsdWVba2V5XS5sb29wO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZVtrZXldLmhhc093blByb3BlcnR5KCdzcHJpdGUnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uc3ByaXRlID0gdmFsdWVba2V5XS5zcHJpdGU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVba2V5XS5oYXNPd25Qcm9wZXJ0eSgnc3ByaXRlQXNzZXQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uc3ByaXRlQXNzZXQgPSB2YWx1ZVtrZXldLnNwcml0ZUFzc2V0O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWZvdW5kKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVDbGlwKG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIGNsaXBzIHRoYXQgZG8gbm90IGV4aXN0XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2xpcHNbdmFsdWVba2V5XS5uYW1lXSkgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuYWRkQ2xpcCh2YWx1ZVtrZXldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGF1dG8gcGxheSBjbGlwXG4gICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUgY3VycmVudCBjbGlwIGRvZXNuJ3QgaGF2ZSBhIHNwcml0ZSB0aGVuIGhpZGUgdGhlIG1vZGVsXG4gICAgICAgIGlmICghdGhpcy5fY3VycmVudENsaXAgfHwgIXRoaXMuX2N1cnJlbnRDbGlwLnNwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY2xpcHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGlwcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBjbGlwIGJlaW5nIHBsYXllZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTcHJpdGVBbmltYXRpb25DbGlwfVxuICAgICAqL1xuICAgIGdldCBjdXJyZW50Q2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZ2xvYmFsIHNwZWVkIG1vZGlmaWVyIHVzZWQgd2hlbiBwbGF5aW5nIHNwcml0ZSBhbmltYXRpb24gY2xpcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzcGVlZCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zcGVlZCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzcGVlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwZWVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZsaXAgdGhlIFggYXhpcyB3aGVuIHJlbmRlcmluZyBhIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmbGlwWCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fZmxpcFggPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZmxpcFggPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgZ2V0IGZsaXBYKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmxpcFg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmxpcCB0aGUgWSBheGlzIHdoZW4gcmVuZGVyaW5nIGEgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZsaXBZKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mbGlwWSA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mbGlwWSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICBnZXQgZmxpcFkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwWTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIHNwcml0ZSB3aGVuIHJlbmRlcmluZyB1c2luZyA5LVNsaWNpbmcuIFRoZSB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBvbmx5IHVzZWRcbiAgICAgKiB3aGVuIHRoZSByZW5kZXIgbW9kZSBvZiB0aGUgc3ByaXRlIGFzc2V0IGlzIFNsaWNlZCBvciBUaWxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHdpZHRoKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5fd2lkdGgpIHJldHVybjtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnggPSB0aGlzLl93aWR0aDtcblxuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEIHx8IHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zZm9ybSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgc3ByaXRlIHdoZW4gcmVuZGVyaW5nIHVzaW5nIDktU2xpY2luZy4gVGhlIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG9ubHkgdXNlZFxuICAgICAqIHdoZW4gdGhlIHJlbmRlciBtb2RlIG9mIHRoZSBzcHJpdGUgYXNzZXQgaXMgU2xpY2VkIG9yIFRpbGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5faGVpZ2h0KSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUueSA9IHRoaXMuaGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBzcHJpdGUgdG8gYSBzcGVjaWZpYyBiYXRjaCBncm91cCAoc2VlIHtAbGluayBCYXRjaEdyb3VwfSkuIERlZmF1bHQgaXMgLTEgKG5vIGdyb3VwKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGJhdGNoR3JvdXBJZCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBwcmV2ID0gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiBwcmV2ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5TUFJJVEUsIHByZXYsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB2YWx1ZSA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuU1BSSVRFLCB2YWx1ZSwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmUtYWRkIG1vZGVsIHRvIHNjZW5lIGluIGNhc2UgaXQgd2FzIHJlbW92ZWQgYnkgYmF0Y2hpbmdcbiAgICAgICAgICAgIGlmIChwcmV2ID49IDApIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgJiYgdGhpcy5fY3VycmVudENsaXAuc3ByaXRlICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBiYXRjaEdyb3VwSWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iYXRjaEdyb3VwSWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGNsaXAgdG8gcGxheSBhdXRvbWF0aWNhbGx5IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkIGFuZCB0aGUgY2xpcCBleGlzdHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCBhdXRvUGxheUNsaXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYXV0b1BsYXlDbGlwID0gdmFsdWUgaW5zdGFuY2VvZiBTcHJpdGVBbmltYXRpb25DbGlwID8gdmFsdWUubmFtZSA6IHZhbHVlO1xuICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuICAgIH1cblxuICAgIGdldCBhdXRvUGxheUNsaXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdXRvUGxheUNsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGRyYXcgb3JkZXIgb2YgdGhlIGNvbXBvbmVudC4gQSBoaWdoZXIgdmFsdWUgbWVhbnMgdGhhdCB0aGUgY29tcG9uZW50IHdpbGwgYmUgcmVuZGVyZWQgb25cbiAgICAgKiB0b3Agb2Ygb3RoZXIgY29tcG9uZW50cyBpbiB0aGUgc2FtZSBsYXllci4gVGhpcyBpcyBub3QgdXNlZCB1bmxlc3MgdGhlIGxheWVyJ3Mgc29ydCBvcmRlciBpc1xuICAgICAqIHNldCB0byB7QGxpbmsgU09SVE1PREVfTUFOVUFMfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGRyYXdPcmRlcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGRyYXdPcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RyYXdPcmRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgc3ByaXRlIHNob3VsZCBiZWxvbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IGxheWVycyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sYXllcnMgPSB2YWx1ZTtcblxuICAgICAgICAvLyBlYXJseSBvdXRcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIGdldCBhYWJiKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbWVzaEluc3RhbmNlLmFhYmI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMuX29uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbignYWRkJywgdGhpcy5fb25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5fb25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApXG4gICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLlNQUklURSwgdGhpcy5fYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgc2NlbmUub2ZmKCdzZXQ6bGF5ZXJzJywgdGhpcy5fb25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5fb25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcblxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLlNQUklURSwgdGhpcy5fYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fZGVmYXVsdENsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwLl9kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9kZWZhdWx0Q2xpcCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fY2xpcHMpIHtcbiAgICAgICAgICAgIHRoaXMuX2NsaXBzW2tleV0uX2Rlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jbGlwcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIHRoaXMuX21vZGVsID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fbm9kZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX25vZGUucGFyZW50KVxuICAgICAgICAgICAgICAgIHRoaXMuX25vZGUucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuX25vZGUpO1xuICAgICAgICAgICAgdGhpcy5fbm9kZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICAvLyBtYWtlIHN1cmUgd2UgZGVjcmVhc2UgdGhlIHJlZiBjb3VudHMgbWF0ZXJpYWxzIGFuZCBtZXNoZXNcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3Nob3dNb2RlbCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZGVkTW9kZWwpIHJldHVybjtcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gW3RoaXMuX21lc2hJbnN0YW5jZV07XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2xheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhtZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWwgPSB0cnVlO1xuICAgIH1cblxuICAgIF9oaWRlTW9kZWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYWRkZWRNb2RlbCB8fCAhdGhpcy5fbWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IFt0aGlzLl9tZXNoSW5zdGFuY2VdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9sYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMobWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hZGRlZE1vZGVsID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSBkZXNpcmVkIG1lc2ggb24gdGhlIG1lc2ggaW5zdGFuY2VcbiAgICBfc2hvd0ZyYW1lKGZyYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5zcHJpdGUpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoID0gdGhpcy5zcHJpdGUubWVzaGVzW2ZyYW1lXTtcbiAgICAgICAgLy8gaWYgbWVzaCBpcyBudWxsIHRoZW4gaGlkZSB0aGUgbWVzaCBpbnN0YW5jZVxuICAgICAgICBpZiAoIW1lc2gpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnZpc2libGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG1hdGVyaWFsO1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxTbGljZWRNb2RlO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxUaWxlZE1vZGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBtZXNoIGluc3RhbmNlIGlmIGl0IGRvZXNuJ3QgZXhpc3QgeWV0XG4gICAgICAgIGlmICghdGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMuX21hdGVyaWFsLCB0aGlzLl9ub2RlKTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5jYXN0U2hhZG93ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IHRoaXMuX2RyYXdPcmRlcjtcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMucHVzaCh0aGlzLl9tZXNoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAvLyBzZXQgb3ZlcnJpZGVzIG9uIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9jb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fRU1JU1NJVkUsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09QQUNJVFksIHRoaXMuX2NvbG9yLmEpO1xuXG4gICAgICAgICAgICAvLyBub3cgdGhhdCB3ZSBjcmVhdGVkIHRoZSBtZXNoIGluc3RhbmNlLCBhZGQgdGhlIG1vZGVsIHRvIHRoZSBzY2VuZVxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgbWF0ZXJpYWxcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCAhPT0gbWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIG1lc2hcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZS5tZXNoICE9PSBtZXNoKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCA9IG1lc2g7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UudmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICAvLyByZXNldCBhYWJiXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUuYXRsYXMgJiYgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9FTUlTU0lWRV9NQVAsIHRoaXMuc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9PUEFDSVRZX01BUCwgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyB0ZXh0dXJlIHNvIHJlc2V0IHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFX01BUCk7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKFBBUkFNX09QQUNJVFlfTUFQKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZvciA5LXNsaWNlZFxuICAgICAgICBpZiAodGhpcy5zcHJpdGUuYXRsYXMgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcbiAgICAgICAgICAgIC8vIHNldCBjdXN0b20gYWFiYiBmdW5jdGlvblxuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLl91cGRhdGVBYWJiRnVuYyA9IHRoaXMuX3VwZGF0ZUFhYmJGdW5jO1xuXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgaW5uZXIgb2Zmc2V0XG4gICAgICAgICAgICBjb25zdCBmcmFtZURhdGEgPSB0aGlzLnNwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5zcHJpdGUuZnJhbWVLZXlzW2ZyYW1lXV07XG4gICAgICAgICAgICBpZiAoZnJhbWVEYXRhKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9yZGVyV2lkdGhTY2FsZSA9IDIgLyBmcmFtZURhdGEucmVjdC56O1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvcmRlckhlaWdodFNjYWxlID0gMiAvIGZyYW1lRGF0YS5yZWN0Lnc7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldC5zZXQoXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueCAqIGJvcmRlcldpZHRoU2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueSAqIGJvcmRlckhlaWdodFNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnogKiBib3JkZXJXaWR0aFNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLncgKiBib3JkZXJIZWlnaHRTY2FsZVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0ZXggPSB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdC5zZXQoZnJhbWVEYXRhLnJlY3QueCAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LnkgLyB0ZXguaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueiAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LncgLyB0ZXguaGVpZ2h0XG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldC5zZXQoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBpbm5lciBvZmZzZXQgYW5kIGF0bGFzIHJlY3Qgb24gbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzBdID0gdGhpcy5faW5uZXJPZmZzZXQueDtcbiAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVsxXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lnk7XG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMl0gPSB0aGlzLl9pbm5lck9mZnNldC56O1xuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzNdID0gdGhpcy5faW5uZXJPZmZzZXQudztcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fSU5ORVJfT0ZGU0VULCB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0pO1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVswXSA9IHRoaXMuX2F0bGFzUmVjdC54O1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsxXSA9IHRoaXMuX2F0bGFzUmVjdC55O1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsyXSA9IHRoaXMuX2F0bGFzUmVjdC56O1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVszXSA9IHRoaXMuX2F0bGFzUmVjdC53O1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9BVExBU19SRUNULCB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgLy8gZmxpcFxuICAgICAgICBsZXQgc2NhbGVYID0gdGhpcy5mbGlwWCA/IC0xIDogMTtcbiAgICAgICAgbGV0IHNjYWxlWSA9IHRoaXMuZmxpcFkgPyAtMSA6IDE7XG5cbiAgICAgICAgLy8gcGl2b3RcbiAgICAgICAgbGV0IHBvc1ggPSAwO1xuICAgICAgICBsZXQgcG9zWSA9IDA7XG5cbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpKSB7XG5cbiAgICAgICAgICAgIGxldCB3ID0gMTtcbiAgICAgICAgICAgIGxldCBoID0gMTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZnJhbWVEYXRhID0gdGhpcy5zcHJpdGUuYXRsYXMuZnJhbWVzW3RoaXMuc3ByaXRlLmZyYW1lS2V5c1t0aGlzLmZyYW1lXV07XG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBnZXQgZnJhbWUgZGltZW5zaW9uc1xuICAgICAgICAgICAgICAgICAgICB3ID0gZnJhbWVEYXRhLnJlY3QuejtcbiAgICAgICAgICAgICAgICAgICAgaCA9IGZyYW1lRGF0YS5yZWN0Lnc7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIHBpdm90XG4gICAgICAgICAgICAgICAgICAgIHBvc1ggPSAoMC41IC0gZnJhbWVEYXRhLnBpdm90LngpICogdGhpcy5fd2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIHBvc1kgPSAoMC41IC0gZnJhbWVEYXRhLnBpdm90LnkpICogdGhpcy5faGVpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2NhbGU6IGFwcGx5IFBQVVxuICAgICAgICAgICAgY29uc3Qgc2NhbGVNdWxYID0gdyAvIHRoaXMuc3ByaXRlLnBpeGVsc1BlclVuaXQ7XG4gICAgICAgICAgICBjb25zdCBzY2FsZU11bFkgPSBoIC8gdGhpcy5zcHJpdGUucGl4ZWxzUGVyVW5pdDtcblxuICAgICAgICAgICAgLy8gc2NhbGUgYm9yZGVycyBpZiBuZWNlc3NhcnkgaW5zdGVhZCBvZiBvdmVybGFwcGluZ1xuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS5zZXQoTWF0aC5tYXgodGhpcy5fd2lkdGgsIHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCBNYXRoLm1heCh0aGlzLl9oZWlnaHQsIHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpKTtcblxuICAgICAgICAgICAgc2NhbGVYICo9IHNjYWxlTXVsWDtcbiAgICAgICAgICAgIHNjYWxlWSAqPSBzY2FsZU11bFk7XG5cbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUueCAvPSBzY2FsZU11bFg7XG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnkgLz0gc2NhbGVNdWxZO1xuXG4gICAgICAgICAgICAvLyBzY2FsZTogc2hyaW5raW5nIGJlbG93IDFcbiAgICAgICAgICAgIHNjYWxlWCAqPSBtYXRoLmNsYW1wKHRoaXMuX3dpZHRoIC8gKHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCAwLjAwMDEsIDEpO1xuICAgICAgICAgICAgc2NhbGVZICo9IG1hdGguY2xhbXAodGhpcy5faGVpZ2h0IC8gKHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpLCAwLjAwMDEsIDEpO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgb3V0ZXIgc2NhbGVcbiAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybVswXSA9IHRoaXMuX291dGVyU2NhbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybVsxXSA9IHRoaXMuX291dGVyU2NhbGUueTtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09VVEVSX1NDQUxFLCB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzY2FsZVxuICAgICAgICB0aGlzLl9ub2RlLnNldExvY2FsU2NhbGUoc2NhbGVYLCBzY2FsZVksIDEpO1xuICAgICAgICAvLyBwaXZvdFxuICAgICAgICB0aGlzLl9ub2RlLnNldExvY2FsUG9zaXRpb24ocG9zWCwgcG9zWSwgMCk7XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlcyBBQUJCIHdoaWxlIDktc2xpY2luZ1xuICAgIF91cGRhdGVBYWJiKGFhYmIpIHtcbiAgICAgICAgLy8gcGl2b3RcbiAgICAgICAgYWFiYi5jZW50ZXIuc2V0KDAsIDAsIDApO1xuICAgICAgICAvLyBzaXplXG4gICAgICAgIGFhYmIuaGFsZkV4dGVudHMuc2V0KHRoaXMuX291dGVyU2NhbGUueCAqIDAuNSwgdGhpcy5fb3V0ZXJTY2FsZS55ICogMC41LCAwLjAwMSk7XG4gICAgICAgIC8vIHdvcmxkIHRyYW5zZm9ybVxuICAgICAgICBhYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoYWFiYiwgdGhpcy5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgcmV0dXJuIGFhYmI7XG4gICAgfVxuXG4gICAgX3RyeUF1dG9QbGF5KCkge1xuICAgICAgICBpZiAoIXRoaXMuX2F1dG9QbGF5Q2xpcCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy50eXBlICE9PSBTUFJJVEVUWVBFX0FOSU1BVEVEKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY2xpcCA9IHRoaXMuX2NsaXBzW3RoaXMuX2F1dG9QbGF5Q2xpcF07XG4gICAgICAgIC8vIGlmIHRoZSBjbGlwIGV4aXN0cyBhbmQgbm90aGluZyBlbHNlIGlzIHBsYXlpbmcgcGxheSBpdFxuICAgICAgICBpZiAoY2xpcCAmJiAhY2xpcC5pc1BsYXlpbmcgJiYgKCF0aGlzLl9jdXJyZW50Q2xpcCB8fCAhdGhpcy5fY3VycmVudENsaXAuaXNQbGF5aW5nKSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KGNsaXAubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbCAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuX21lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGlmICghdGhpcy5fbWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLl9tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICByZW1vdmVNb2RlbEZyb21MYXllcnMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLl9tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW5kIGFkZHMgYSBuZXcge0BsaW5rIFNwcml0ZUFuaW1hdGlvbkNsaXB9IHRvIHRoZSBjb21wb25lbnQncyBjbGlwcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkYXRhIC0gRGF0YSBmb3IgdGhlIG5ldyBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2RhdGEubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgbmV3IGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZGF0YS5mcHNdIC0gRnJhbWVzIHBlciBzZWNvbmQgZm9yIHRoZSBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkYXRhLmxvb3BdIC0gV2hldGhlciB0byBsb29wIHRoZSBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxBc3NldH0gW2RhdGEuc3ByaXRlQXNzZXRdIC0gVGhlIGFzc2V0IGlkIG9yIHRoZSB7QGxpbmsgQXNzZXR9IG9mIHRoZSBzcHJpdGVcbiAgICAgKiB0aGF0IHRoaXMgY2xpcCB3aWxsIHBsYXkuXG4gICAgICogQHJldHVybnMge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IFRoZSBuZXcgY2xpcCB0aGF0IHdhcyBhZGRlZC5cbiAgICAgKi9cbiAgICBhZGRDbGlwKGRhdGEpIHtcbiAgICAgICAgY29uc3QgY2xpcCA9IG5ldyBTcHJpdGVBbmltYXRpb25DbGlwKHRoaXMsIHtcbiAgICAgICAgICAgIG5hbWU6IGRhdGEubmFtZSxcbiAgICAgICAgICAgIGZwczogZGF0YS5mcHMsXG4gICAgICAgICAgICBsb29wOiBkYXRhLmxvb3AsXG4gICAgICAgICAgICBzcHJpdGVBc3NldDogZGF0YS5zcHJpdGVBc3NldFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl9jbGlwc1tkYXRhLm5hbWVdID0gY2xpcDtcblxuICAgICAgICBpZiAoY2xpcC5uYW1lICYmIGNsaXAubmFtZSA9PT0gdGhpcy5fYXV0b1BsYXlDbGlwKVxuICAgICAgICAgICAgdGhpcy5fdHJ5QXV0b1BsYXkoKTtcblxuICAgICAgICByZXR1cm4gY2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgY2xpcCBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgYW5pbWF0aW9uIGNsaXAgdG8gcmVtb3ZlLlxuICAgICAqL1xuICAgIHJlbW92ZUNsaXAobmFtZSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fY2xpcHNbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGFuIGFuaW1hdGlvbiBjbGlwIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBjbGlwLlxuICAgICAqIEByZXR1cm5zIHtTcHJpdGVBbmltYXRpb25DbGlwfSBUaGUgY2xpcC5cbiAgICAgKi9cbiAgICBjbGlwKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaXBzW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBsYXlzIGEgc3ByaXRlIGFuaW1hdGlvbiBjbGlwIGJ5IG5hbWUuIElmIHRoZSBhbmltYXRpb24gY2xpcCBpcyBhbHJlYWR5IHBsYXlpbmcgdGhlbiB0aGlzXG4gICAgICogd2lsbCBkbyBub3RoaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgY2xpcCB0byBwbGF5LlxuICAgICAqIEByZXR1cm5zIHtTcHJpdGVBbmltYXRpb25DbGlwfSBUaGUgY2xpcCB0aGF0IHN0YXJ0ZWQgcGxheWluZy5cbiAgICAgKi9cbiAgICBwbGF5KG5hbWUpIHtcbiAgICAgICAgY29uc3QgY2xpcCA9IHRoaXMuX2NsaXBzW25hbWVdO1xuXG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50Q2xpcDtcbiAgICAgICAgaWYgKGN1cnJlbnQgJiYgY3VycmVudCAhPT0gY2xpcCkge1xuICAgICAgICAgICAgY3VycmVudC5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSBjbGlwO1xuXG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCkge1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSBjbGlwO1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudENsaXAucGxheSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgRGVidWcud2FybihgVHJ5aW5nIHRvIHBsYXkgc3ByaXRlIGFuaW1hdGlvbiAke25hbWV9IHdoaWNoIGRvZXMgbm90IGV4aXN0LmApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGF1c2VzIHRoZSBjdXJyZW50IGFuaW1hdGlvbiBjbGlwLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgPT09IHRoaXMuX2RlZmF1bHRDbGlwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudENsaXAucGF1c2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3VtZXMgdGhlIGN1cnJlbnQgcGF1c2VkIGFuaW1hdGlvbiBjbGlwLlxuICAgICAqL1xuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwID09PSB0aGlzLl9kZWZhdWx0Q2xpcCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcC5pc1BhdXNlZCkge1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudENsaXAucmVzdW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyB0aGUgY3VycmVudCBhbmltYXRpb24gY2xpcCBhbmQgcmVzZXRzIGl0IHRvIHRoZSBmaXJzdCBmcmFtZS5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgPT09IHRoaXMuX2RlZmF1bHRDbGlwKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAuc3RvcCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU3ByaXRlQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiUEFSQU1fRU1JU1NJVkVfTUFQIiwiUEFSQU1fT1BBQ0lUWV9NQVAiLCJQQVJBTV9FTUlTU0lWRSIsIlBBUkFNX09QQUNJVFkiLCJQQVJBTV9JTk5FUl9PRkZTRVQiLCJQQVJBTV9PVVRFUl9TQ0FMRSIsIlBBUkFNX0FUTEFTX1JFQ1QiLCJTcHJpdGVDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl90eXBlIiwiU1BSSVRFVFlQRV9TSU1QTEUiLCJfbWF0ZXJpYWwiLCJkZWZhdWx0TWF0ZXJpYWwiLCJfY29sb3IiLCJDb2xvciIsIl9jb2xvclVuaWZvcm0iLCJGbG9hdDMyQXJyYXkiLCJfc3BlZWQiLCJfZmxpcFgiLCJfZmxpcFkiLCJfd2lkdGgiLCJfaGVpZ2h0IiwiX2RyYXdPcmRlciIsIl9sYXllcnMiLCJMQVlFUklEX1dPUkxEIiwiX291dGVyU2NhbGUiLCJWZWMyIiwiX291dGVyU2NhbGVVbmlmb3JtIiwiX2lubmVyT2Zmc2V0IiwiVmVjNCIsIl9pbm5lck9mZnNldFVuaWZvcm0iLCJfYXRsYXNSZWN0IiwiX2F0bGFzUmVjdFVuaWZvcm0iLCJfYmF0Y2hHcm91cElkIiwiX2JhdGNoR3JvdXAiLCJfbm9kZSIsIkdyYXBoTm9kZSIsIl9tb2RlbCIsIk1vZGVsIiwiZ3JhcGgiLCJfbWVzaEluc3RhbmNlIiwiYWRkQ2hpbGQiLCJfZW50aXR5IiwiX3VwZGF0ZUFhYmJGdW5jIiwiX3VwZGF0ZUFhYmIiLCJiaW5kIiwiX2FkZGVkTW9kZWwiLCJfYXV0b1BsYXlDbGlwIiwiX2NsaXBzIiwiX2RlZmF1bHRDbGlwIiwiU3ByaXRlQW5pbWF0aW9uQ2xpcCIsIm5hbWUiLCJmcHMiLCJsb29wIiwic3ByaXRlQXNzZXQiLCJfY3VycmVudENsaXAiLCJ0eXBlIiwidmFsdWUiLCJzdG9wIiwiZW5hYmxlZCIsImZyYW1lIiwic3ByaXRlIiwiX3Nob3dNb2RlbCIsIl9oaWRlTW9kZWwiLCJTUFJJVEVUWVBFX0FOSU1BVEVEIiwiX3RyeUF1dG9QbGF5IiwiaXNQbGF5aW5nIiwiX3Nwcml0ZUFzc2V0IiwibWF0ZXJpYWwiLCJjb2xvciIsInIiLCJnIiwiYiIsInNldFBhcmFtZXRlciIsIm9wYWNpdHkiLCJhIiwiY2xpcHMiLCJyZW1vdmVDbGlwIiwiZm91bmQiLCJrZXkiLCJoYXNPd25Qcm9wZXJ0eSIsImFkZENsaXAiLCJjdXJyZW50Q2xpcCIsInNwZWVkIiwiZmxpcFgiLCJfdXBkYXRlVHJhbnNmb3JtIiwiZmxpcFkiLCJ3aWR0aCIsIngiLCJyZW5kZXJNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQiLCJoZWlnaHQiLCJ5IiwiYmF0Y2hHcm91cElkIiwicHJldiIsImFwcCIsImJhdGNoZXIiLCJyZW1vdmUiLCJCYXRjaEdyb3VwIiwiU1BSSVRFIiwiaW5zZXJ0IiwiYXV0b1BsYXlDbGlwIiwiZHJhd09yZGVyIiwibGF5ZXJzIiwiYWFiYiIsIm9uRW5hYmxlIiwic2NlbmUiLCJvbiIsIl9vbkxheWVyc0NoYW5nZWQiLCJfb25MYXllckFkZGVkIiwiX29uTGF5ZXJSZW1vdmVkIiwib25EaXNhYmxlIiwib2ZmIiwib25EZXN0cm95IiwiX2Rlc3Ryb3kiLCJwYXJlbnQiLCJyZW1vdmVDaGlsZCIsIm1lc2giLCJtZXNoSW5zdGFuY2VzIiwiaSIsImxlbiIsImxlbmd0aCIsImxheWVyIiwiZ2V0TGF5ZXJCeUlkIiwiYWRkTWVzaEluc3RhbmNlcyIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJfc2hvd0ZyYW1lIiwibWVzaGVzIiwidmlzaWJsZSIsImRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxTbGljZWRNb2RlIiwiZGVmYXVsdDlTbGljZWRNYXRlcmlhbFRpbGVkTW9kZSIsIk1lc2hJbnN0YW5jZSIsImNhc3RTaGFkb3ciLCJyZWNlaXZlU2hhZG93IiwicHVzaCIsIl9hYWJiVmVyIiwiYXRsYXMiLCJ0ZXh0dXJlIiwiZGVsZXRlUGFyYW1ldGVyIiwiZnJhbWVEYXRhIiwiZnJhbWVzIiwiZnJhbWVLZXlzIiwiYm9yZGVyV2lkdGhTY2FsZSIsInJlY3QiLCJ6IiwiYm9yZGVySGVpZ2h0U2NhbGUiLCJ3Iiwic2V0IiwiYm9yZGVyIiwidGV4Iiwic2NhbGVYIiwic2NhbGVZIiwicG9zWCIsInBvc1kiLCJoIiwicGl2b3QiLCJzY2FsZU11bFgiLCJwaXhlbHNQZXJVbml0Iiwic2NhbGVNdWxZIiwiTWF0aCIsIm1heCIsIm1hdGgiLCJjbGFtcCIsInNldExvY2FsU2NhbGUiLCJzZXRMb2NhbFBvc2l0aW9uIiwiY2VudGVyIiwiaGFsZkV4dGVudHMiLCJzZXRGcm9tVHJhbnNmb3JtZWRBYWJiIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJjbGlwIiwicGxheSIsIm9sZENvbXAiLCJuZXdDb21wIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJpbmRleCIsImluZGV4T2YiLCJpZCIsInJlbW92ZU1vZGVsRnJvbUxheWVycyIsImRhdGEiLCJjdXJyZW50IiwiX3BsYXlpbmciLCJEZWJ1ZyIsIndhcm4iLCJwYXVzZSIsInJlc3VtZSIsImlzUGF1c2VkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBeUJBLE1BQU1BLGtCQUFrQixHQUFHLHFCQUEzQixDQUFBO0FBQ0EsTUFBTUMsaUJBQWlCLEdBQUcsb0JBQTFCLENBQUE7QUFDQSxNQUFNQyxjQUFjLEdBQUcsbUJBQXZCLENBQUE7QUFDQSxNQUFNQyxhQUFhLEdBQUcsa0JBQXRCLENBQUE7QUFDQSxNQUFNQyxrQkFBa0IsR0FBRyxhQUEzQixDQUFBO0FBQ0EsTUFBTUMsaUJBQWlCLEdBQUcs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
