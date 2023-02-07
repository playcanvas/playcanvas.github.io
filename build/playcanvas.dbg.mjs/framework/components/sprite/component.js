/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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

/**
 * Enables an Entity to render a simple static sprite or sprite animations.
 *
 * @augments Component
 */
class SpriteComponent extends Component {
  /**
   * Create a new SpriteComponent instance.
   *
   * @param {import('./system.js').SpriteComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
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
    this._layers = [LAYERID_WORLD]; // assign to the default world layer

    // 9-slicing
    this._outerScale = new Vec2(1, 1);
    this._outerScaleUniform = new Float32Array(2);
    this._innerOffset = new Vec4();
    this._innerOffsetUniform = new Float32Array(4);
    this._atlasRect = new Vec4();
    this._atlasRectUniform = new Float32Array(4);

    // batch groups
    this._batchGroupId = -1;
    this._batchGroup = null;

    // node / mesh instance
    this._node = new GraphNode();
    this._model = new Model();
    this._model.graph = this._node;
    this._meshInstance = null;
    entity.addChild(this._model.graph);
    this._model._entity = entity;
    this._updateAabbFunc = this._updateAabb.bind(this);
    this._addedModel = false;

    // animated sprites
    this._autoPlayClip = null;

    /**
     * Dictionary of sprite animation clips.
     *
     * @type {Object<string, SpriteAnimationClip>}
     * @private
     */
    this._clips = {};

    // create default clip for simple sprite type
    this._defaultClip = new SpriteAnimationClip(this, {
      name: this.entity.name,
      fps: 0,
      loop: false,
      spriteAsset: null
    });

    /**
     * The sprite animation clip currently playing.
     *
     * @type {SpriteAnimationClip}
     * @private
     */
    this._currentClip = this._defaultClip;
  }

  /**
   * Fired when an animation clip starts playing.
   *
   * @event SpriteComponent#play
   * @param {SpriteAnimationClip} clip - The clip that started playing.
   */

  /**
   * Fired when an animation clip is paused.
   *
   * @event SpriteComponent#pause
   * @param {SpriteAnimationClip} clip - The clip that was paused.
   */

  /**
   * Fired when an animation clip is resumed.
   *
   * @event SpriteComponent#resume
   * @param {SpriteAnimationClip} clip - The clip that was resumed.
   */

  /**
   * Fired when an animation clip is stopped.
   *
   * @event SpriteComponent#stop
   * @param {SpriteAnimationClip} clip - The clip that was stopped.
   */

  /**
   * Fired when an animation clip stops playing because it reached its ending.
   *
   * @event SpriteComponent#end
   * @param {SpriteAnimationClip} clip - The clip that ended.
   */

  /**
   * Fired when an animation clip reached the end of its current loop.
   *
   * @event SpriteComponent#loop
   * @param {SpriteAnimationClip} clip - The clip.
   */

  /**
   * The type of the SpriteComponent. Can be:
   *
   * - {@link SPRITETYPE_SIMPLE}: The component renders a single frame from a sprite asset.
   * - {@link SPRITETYPE_ANIMATED}: The component can play sprite animation clips.
   *
   * Defaults to {@link SPRITETYPE_SIMPLE}.
   *
   * @type {string}
   */
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

  /**
   * The frame counter of the sprite. Specifies which frame from the current sprite asset to
   * render.
   *
   * @type {number}
   */
  set frame(value) {
    this._currentClip.frame = value;
  }
  get frame() {
    return this._currentClip.frame;
  }

  /**
   * The asset id or the {@link Asset} of the sprite to render. Only works for
   * {@link SPRITETYPE_SIMPLE} sprites.
   *
   * @type {number|import('../../asset/asset.js').Asset}
   */
  set spriteAsset(value) {
    this._defaultClip.spriteAsset = value;
  }
  get spriteAsset() {
    return this._defaultClip._spriteAsset;
  }

  /**
   * The current sprite.
   *
   * @type {Sprite}
   */
  set sprite(value) {
    this._currentClip.sprite = value;
  }
  get sprite() {
    return this._currentClip.sprite;
  }

  // (private) {pc.Material} material The material used to render a sprite.
  set material(value) {
    this._material = value;
    if (this._meshInstance) {
      this._meshInstance.material = value;
    }
  }
  get material() {
    return this._material;
  }

  /**
   * The color tint of the sprite.
   *
   * @type {Color}
   */
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

  /**
   * The opacity of the sprite.
   *
   * @type {number}
   */
  set opacity(value) {
    this._color.a = value;
    if (this._meshInstance) {
      this._meshInstance.setParameter(PARAM_OPACITY, value);
    }
  }
  get opacity() {
    return this._color.a;
  }

  /**
   * A dictionary that contains {@link SpriteAnimationClip}s.
   *
   * @type {Object<string, SpriteAnimationClip>}
   */
  set clips(value) {
    // if value is null remove all clips
    if (!value) {
      for (const name in this._clips) {
        this.removeClip(name);
      }
      return;
    }

    // remove existing clips not in new value
    // and update clips in both objects
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

    // add clips that do not exist
    for (const key in value) {
      if (this._clips[value[key].name]) continue;
      this.addClip(value[key]);
    }

    // auto play clip
    if (this._autoPlayClip) {
      this._tryAutoPlay();
    }

    // if the current clip doesn't have a sprite then hide the model
    if (!this._currentClip || !this._currentClip.sprite) {
      this._hideModel();
    }
  }
  get clips() {
    return this._clips;
  }

  /**
   * The current clip being played.
   *
   * @type {SpriteAnimationClip}
   */
  get currentClip() {
    return this._currentClip;
  }

  /**
   * A global speed modifier used when playing sprite animation clips.
   *
   * @type {number}
   */
  set speed(value) {
    this._speed = value;
  }
  get speed() {
    return this._speed;
  }

  /**
   * Flip the X axis when rendering a sprite.
   *
   * @type {boolean}
   */
  set flipX(value) {
    if (this._flipX === value) return;
    this._flipX = value;
    this._updateTransform();
  }
  get flipX() {
    return this._flipX;
  }

  /**
   * Flip the Y axis when rendering a sprite.
   *
   * @type {boolean}
   */
  set flipY(value) {
    if (this._flipY === value) return;
    this._flipY = value;
    this._updateTransform();
  }
  get flipY() {
    return this._flipY;
  }

  /**
   * The width of the sprite when rendering using 9-Slicing. The width and height are only used
   * when the render mode of the sprite asset is Sliced or Tiled.
   *
   * @type {number}
   */
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

  /**
   * The height of the sprite when rendering using 9-Slicing. The width and height are only used
   * when the render mode of the sprite asset is Sliced or Tiled.
   *
   * @type {number}
   */
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

  /**
   * Assign sprite to a specific batch group (see {@link BatchGroup}). Default is -1 (no group).
   *
   * @type {number}
   */
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
      // re-add model to scene in case it was removed by batching
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

  /**
   * The name of the clip to play automatically when the component is enabled and the clip exists.
   *
   * @type {string}
   */
  set autoPlayClip(value) {
    this._autoPlayClip = value instanceof SpriteAnimationClip ? value.name : value;
    this._tryAutoPlay();
  }
  get autoPlayClip() {
    return this._autoPlayClip;
  }

  /**
   * The draw order of the component. A higher value means that the component will be rendered on
   * top of other components in the same layer. This is not used unless the layer's sort order is
   * set to {@link SORTMODE_MANUAL}.
   *
   * @type {number}
   */
  set drawOrder(value) {
    this._drawOrder = value;
    if (this._meshInstance) {
      this._meshInstance.drawOrder = value;
    }
  }
  get drawOrder() {
    return this._drawOrder;
  }

  /**
   * An array of layer IDs ({@link Layer#id}) to which this sprite should belong.
   *
   * @type {number[]}
   */
  set layers(value) {
    if (this._addedModel) {
      this._hideModel();
    }
    this._layers = value;

    // early out
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
      // make sure we decrease the ref counts materials and meshes
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

  // Set the desired mesh on the mesh instance
  _showFrame(frame) {
    if (!this.sprite) return;
    const mesh = this.sprite.meshes[frame];
    // if mesh is null then hide the mesh instance
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

    // create mesh instance if it doesn't exist yet
    if (!this._meshInstance) {
      this._meshInstance = new MeshInstance(mesh, this._material, this._node);
      this._meshInstance.castShadow = false;
      this._meshInstance.receiveShadow = false;
      this._meshInstance.drawOrder = this._drawOrder;
      this._model.meshInstances.push(this._meshInstance);

      // set overrides on mesh instance
      this._colorUniform[0] = this._color.r;
      this._colorUniform[1] = this._color.g;
      this._colorUniform[2] = this._color.b;
      this._meshInstance.setParameter(PARAM_EMISSIVE, this._colorUniform);
      this._meshInstance.setParameter(PARAM_OPACITY, this._color.a);

      // now that we created the mesh instance, add the model to the scene
      if (this.enabled && this.entity.enabled) {
        this._showModel();
      }
    }

    // update material
    if (this._meshInstance.material !== material) {
      this._meshInstance.material = material;
    }

    // update mesh
    if (this._meshInstance.mesh !== mesh) {
      this._meshInstance.mesh = mesh;
      this._meshInstance.visible = true;
      // reset aabb
      this._meshInstance._aabbVer = -1;
    }

    // set texture params
    if (this.sprite.atlas && this.sprite.atlas.texture) {
      this._meshInstance.setParameter(PARAM_EMISSIVE_MAP, this.sprite.atlas.texture);
      this._meshInstance.setParameter(PARAM_OPACITY_MAP, this.sprite.atlas.texture);
    } else {
      // no texture so reset texture params
      this._meshInstance.deleteParameter(PARAM_EMISSIVE_MAP);
      this._meshInstance.deleteParameter(PARAM_OPACITY_MAP);
    }

    // for 9-sliced
    if (this.sprite.atlas && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
      // set custom aabb function
      this._meshInstance._updateAabbFunc = this._updateAabbFunc;

      // calculate inner offset
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

      // set inner offset and atlas rect on mesh instance
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
    // flip
    let scaleX = this.flipX ? -1 : 1;
    let scaleY = this.flipY ? -1 : 1;

    // pivot
    let posX = 0;
    let posY = 0;
    if (this.sprite && (this.sprite.renderMode === SPRITE_RENDERMODE_SLICED || this.sprite.renderMode === SPRITE_RENDERMODE_TILED)) {
      let w = 1;
      let h = 1;
      if (this.sprite.atlas) {
        const frameData = this.sprite.atlas.frames[this.sprite.frameKeys[this.frame]];
        if (frameData) {
          // get frame dimensions
          w = frameData.rect.z;
          h = frameData.rect.w;

          // update pivot
          posX = (0.5 - frameData.pivot.x) * this._width;
          posY = (0.5 - frameData.pivot.y) * this._height;
        }
      }

      // scale: apply PPU
      const scaleMulX = w / this.sprite.pixelsPerUnit;
      const scaleMulY = h / this.sprite.pixelsPerUnit;

      // scale borders if necessary instead of overlapping
      this._outerScale.set(Math.max(this._width, this._innerOffset.x * scaleMulX), Math.max(this._height, this._innerOffset.y * scaleMulY));
      scaleX *= scaleMulX;
      scaleY *= scaleMulY;
      this._outerScale.x /= scaleMulX;
      this._outerScale.y /= scaleMulY;

      // scale: shrinking below 1
      scaleX *= math.clamp(this._width / (this._innerOffset.x * scaleMulX), 0.0001, 1);
      scaleY *= math.clamp(this._height / (this._innerOffset.y * scaleMulY), 0.0001, 1);

      // update outer scale
      if (this._meshInstance) {
        this._outerScaleUniform[0] = this._outerScale.x;
        this._outerScaleUniform[1] = this._outerScale.y;
        this._meshInstance.setParameter(PARAM_OUTER_SCALE, this._outerScaleUniform);
      }
    }

    // scale
    this._node.setLocalScale(scaleX, scaleY, 1);
    // pivot
    this._node.setLocalPosition(posX, posY, 0);
  }

  // updates AABB while 9-slicing
  _updateAabb(aabb) {
    // pivot
    aabb.center.set(0, 0, 0);
    // size
    aabb.halfExtents.set(this._outerScale.x * 0.5, this._outerScale.y * 0.5, 0.001);
    // world transform
    aabb.setFromTransformedAabb(aabb, this._node.getWorldTransform());
    return aabb;
  }
  _tryAutoPlay() {
    if (!this._autoPlayClip) return;
    if (this.type !== SPRITETYPE_ANIMATED) return;
    const clip = this._clips[this._autoPlayClip];
    // if the clip exists and nothing else is playing play it
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

  /**
   * Creates and adds a new {@link SpriteAnimationClip} to the component's clips.
   *
   * @param {object} data - Data for the new animation clip.
   * @param {string} [data.name] - The name of the new animation clip.
   * @param {number} [data.fps] - Frames per second for the animation clip.
   * @param {boolean} [data.loop] - Whether to loop the animation clip.
   * @param {number|import('../../asset/asset.js').Asset} [data.spriteAsset] - The asset id or
   * the {@link Asset} of the sprite that this clip will play.
   * @returns {SpriteAnimationClip} The new clip that was added.
   */
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

  /**
   * Removes a clip by name.
   *
   * @param {string} name - The name of the animation clip to remove.
   */
  removeClip(name) {
    delete this._clips[name];
  }

  /**
   * Get an animation clip by name.
   *
   * @param {string} name - The name of the clip.
   * @returns {SpriteAnimationClip} The clip.
   */
  clip(name) {
    return this._clips[name];
  }

  /**
   * Plays a sprite animation clip by name. If the animation clip is already playing then this
   * will do nothing.
   *
   * @param {string} name - The name of the clip to play.
   * @returns {SpriteAnimationClip} The clip that started playing.
   */
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

  /**
   * Pauses the current animation clip.
   */
  pause() {
    if (this._currentClip === this._defaultClip) return;
    if (this._currentClip.isPlaying) {
      this._currentClip.pause();
    }
  }

  /**
   * Resumes the current paused animation clip.
   */
  resume() {
    if (this._currentClip === this._defaultClip) return;
    if (this._currentClip.isPaused) {
      this._currentClip.resume();
    }
  }

  /**
   * Stops the current animation clip and resets it to the first frame.
   */
  stop() {
    if (this._currentClip === this._defaultClip) return;
    this._currentClip.stop();
  }
}

export { SpriteComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc3ByaXRlL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9XT1JMRCxcbiAgICBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQsIFNQUklURV9SRU5ERVJNT0RFX1RJTEVEXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBTUFJJVEVUWVBFX1NJTVBMRSwgU1BSSVRFVFlQRV9BTklNQVRFRCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNwcml0ZUFuaW1hdGlvbkNsaXAgfSBmcm9tICcuL3Nwcml0ZS1hbmltYXRpb24tY2xpcC5qcyc7XG5cbmNvbnN0IFBBUkFNX0VNSVNTSVZFX01BUCA9ICd0ZXh0dXJlX2VtaXNzaXZlTWFwJztcbmNvbnN0IFBBUkFNX09QQUNJVFlfTUFQID0gJ3RleHR1cmVfb3BhY2l0eU1hcCc7XG5jb25zdCBQQVJBTV9FTUlTU0lWRSA9ICdtYXRlcmlhbF9lbWlzc2l2ZSc7XG5jb25zdCBQQVJBTV9PUEFDSVRZID0gJ21hdGVyaWFsX29wYWNpdHknO1xuY29uc3QgUEFSQU1fSU5ORVJfT0ZGU0VUID0gJ2lubmVyT2Zmc2V0JztcbmNvbnN0IFBBUkFNX09VVEVSX1NDQUxFID0gJ291dGVyU2NhbGUnO1xuY29uc3QgUEFSQU1fQVRMQVNfUkVDVCA9ICdhdGxhc1JlY3QnO1xuXG4vKipcbiAqIEVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciBhIHNpbXBsZSBzdGF0aWMgc3ByaXRlIG9yIHNwcml0ZSBhbmltYXRpb25zLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgU3ByaXRlQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU3ByaXRlQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuU3ByaXRlQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl90eXBlID0gU1BSSVRFVFlQRV9TSU1QTEU7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgdGhpcy5fY29sb3IgPSBuZXcgQ29sb3IoMSwgMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuX3NwZWVkID0gMTtcbiAgICAgICAgdGhpcy5fZmxpcFggPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZmxpcFkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fd2lkdGggPSAxO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSAxO1xuXG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IDA7XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAgICAgLy8gOS1zbGljaW5nXG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUgPSBuZXcgVmVjMigxLCAxKTtcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB0aGlzLl9pbm5lck9mZnNldCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuXG4gICAgICAgIC8vIGJhdGNoIGdyb3Vwc1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSAtMTtcbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cCA9IG51bGw7XG5cbiAgICAgICAgLy8gbm9kZSAvIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgdGhpcy5fbm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwuZ3JhcGggPSB0aGlzLl9ub2RlO1xuICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICBlbnRpdHkuYWRkQ2hpbGQodGhpcy5fbW9kZWwuZ3JhcGgpO1xuICAgICAgICB0aGlzLl9tb2RlbC5fZW50aXR5ID0gZW50aXR5O1xuICAgICAgICB0aGlzLl91cGRhdGVBYWJiRnVuYyA9IHRoaXMuX3VwZGF0ZUFhYmIuYmluZCh0aGlzKTtcblxuICAgICAgICB0aGlzLl9hZGRlZE1vZGVsID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYW5pbWF0ZWQgc3ByaXRlc1xuICAgICAgICB0aGlzLl9hdXRvUGxheUNsaXAgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaWN0aW9uYXJ5IG9mIHNwcml0ZSBhbmltYXRpb24gY2xpcHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBTcHJpdGVBbmltYXRpb25DbGlwPn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsaXBzID0ge307XG5cbiAgICAgICAgLy8gY3JlYXRlIGRlZmF1bHQgY2xpcCBmb3Igc2ltcGxlIHNwcml0ZSB0eXBlXG4gICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwID0gbmV3IFNwcml0ZUFuaW1hdGlvbkNsaXAodGhpcywge1xuICAgICAgICAgICAgbmFtZTogdGhpcy5lbnRpdHkubmFtZSxcbiAgICAgICAgICAgIGZwczogMCxcbiAgICAgICAgICAgIGxvb3A6IGZhbHNlLFxuICAgICAgICAgICAgc3ByaXRlQXNzZXQ6IG51bGxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzcHJpdGUgYW5pbWF0aW9uIGNsaXAgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTcHJpdGVBbmltYXRpb25DbGlwfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSB0aGlzLl9kZWZhdWx0Q2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIHN0YXJ0cyBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNwbGF5XG4gICAgICogQHBhcmFtIHtTcHJpdGVBbmltYXRpb25DbGlwfSBjbGlwIC0gVGhlIGNsaXAgdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjcGF1c2VcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IHdhcyBwYXVzZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I3Jlc3VtZVxuICAgICAqIEBwYXJhbSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gY2xpcCAtIFRoZSBjbGlwIHRoYXQgd2FzIHJlc3VtZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I3N0b3BcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IHdhcyBzdG9wcGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCBzdG9wcyBwbGF5aW5nIGJlY2F1c2UgaXQgcmVhY2hlZCBpdHMgZW5kaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNlbmRcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IGVuZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCByZWFjaGVkIHRoZSBlbmQgb2YgaXRzIGN1cnJlbnQgbG9vcC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjbG9vcFxuICAgICAqIEBwYXJhbSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gY2xpcCAtIFRoZSBjbGlwLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIFNwcml0ZUNvbXBvbmVudC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1BSSVRFVFlQRV9TSU1QTEV9OiBUaGUgY29tcG9uZW50IHJlbmRlcnMgYSBzaW5nbGUgZnJhbWUgZnJvbSBhIHNwcml0ZSBhc3NldC5cbiAgICAgKiAtIHtAbGluayBTUFJJVEVUWVBFX0FOSU1BVEVEfTogVGhlIGNvbXBvbmVudCBjYW4gcGxheSBzcHJpdGUgYW5pbWF0aW9uIGNsaXBzLlxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFNQUklURVRZUEVfU0lNUExFfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IFNQUklURVRZUEVfU0lNUExFKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gdGhpcy5fZGVmYXVsdENsaXA7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lID0gdGhpcy5mcmFtZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcC5zcHJpdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gU1BSSVRFVFlQRV9BTklNQVRFRCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgJiYgdGhpcy5fY3VycmVudENsaXAuaXNQbGF5aW5nICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGVNb2RlbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBmcmFtZSBjb3VudGVyIG9mIHRoZSBzcHJpdGUuIFNwZWNpZmllcyB3aGljaCBmcmFtZSBmcm9tIHRoZSBjdXJyZW50IHNwcml0ZSBhc3NldCB0b1xuICAgICAqIHJlbmRlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZyYW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGZyYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudENsaXAuZnJhbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFzc2V0IGlkIG9yIHRoZSB7QGxpbmsgQXNzZXR9IG9mIHRoZSBzcHJpdGUgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICAgICAqIHtAbGluayBTUFJJVEVUWVBFX1NJTVBMRX0gc3ByaXRlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ8aW1wb3J0KCcuLi8uLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fVxuICAgICAqL1xuICAgIHNldCBzcHJpdGVBc3NldCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kZWZhdWx0Q2xpcC5zcHJpdGVBc3NldCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzcHJpdGVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZmF1bHRDbGlwLl9zcHJpdGVBc3NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBzcHJpdGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U3ByaXRlfVxuICAgICAqL1xuICAgIHNldCBzcHJpdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAuc3ByaXRlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwLnNwcml0ZTtcbiAgICB9XG5cbiAgICAvLyAocHJpdmF0ZSkge3BjLk1hdGVyaWFsfSBtYXRlcmlhbCBUaGUgbWF0ZXJpYWwgdXNlZCB0byByZW5kZXIgYSBzcHJpdGUuXG4gICAgc2V0IG1hdGVyaWFsKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIHRpbnQgb2YgdGhlIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDb2xvcn1cbiAgICAgKi9cbiAgICBzZXQgY29sb3IodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY29sb3IuciA9IHZhbHVlLnI7XG4gICAgICAgIHRoaXMuX2NvbG9yLmcgPSB2YWx1ZS5nO1xuICAgICAgICB0aGlzLl9jb2xvci5iID0gdmFsdWUuYjtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX2NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG9wYWNpdHkgb2YgdGhlIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG9wYWNpdHkodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY29sb3IuYSA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09QQUNJVFksIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvcGFjaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3IuYTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGRpY3Rpb25hcnkgdGhhdCBjb250YWlucyB7QGxpbmsgU3ByaXRlQW5pbWF0aW9uQ2xpcH1zLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIFNwcml0ZUFuaW1hdGlvbkNsaXA+fVxuICAgICAqL1xuICAgIHNldCBjbGlwcyh2YWx1ZSkge1xuICAgICAgICAvLyBpZiB2YWx1ZSBpcyBudWxsIHJlbW92ZSBhbGwgY2xpcHNcbiAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuX2NsaXBzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVDbGlwKG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIGNsaXBzIG5vdCBpbiBuZXcgdmFsdWVcbiAgICAgICAgLy8gYW5kIHVwZGF0ZSBjbGlwcyBpbiBib3RoIG9iamVjdHNcbiAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuX2NsaXBzKSB7XG4gICAgICAgICAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlW2tleV0ubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NsaXBzW25hbWVdLmZwcyA9IHZhbHVlW2tleV0uZnBzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlwc1tuYW1lXS5sb29wID0gdmFsdWVba2V5XS5sb29wO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZVtrZXldLmhhc093blByb3BlcnR5KCdzcHJpdGUnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uc3ByaXRlID0gdmFsdWVba2V5XS5zcHJpdGU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVba2V5XS5oYXNPd25Qcm9wZXJ0eSgnc3ByaXRlQXNzZXQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uc3ByaXRlQXNzZXQgPSB2YWx1ZVtrZXldLnNwcml0ZUFzc2V0O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWZvdW5kKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVDbGlwKG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIGNsaXBzIHRoYXQgZG8gbm90IGV4aXN0XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2xpcHNbdmFsdWVba2V5XS5uYW1lXSkgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuYWRkQ2xpcCh2YWx1ZVtrZXldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGF1dG8gcGxheSBjbGlwXG4gICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUgY3VycmVudCBjbGlwIGRvZXNuJ3QgaGF2ZSBhIHNwcml0ZSB0aGVuIGhpZGUgdGhlIG1vZGVsXG4gICAgICAgIGlmICghdGhpcy5fY3VycmVudENsaXAgfHwgIXRoaXMuX2N1cnJlbnRDbGlwLnNwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY2xpcHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGlwcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBjbGlwIGJlaW5nIHBsYXllZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTcHJpdGVBbmltYXRpb25DbGlwfVxuICAgICAqL1xuICAgIGdldCBjdXJyZW50Q2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZ2xvYmFsIHNwZWVkIG1vZGlmaWVyIHVzZWQgd2hlbiBwbGF5aW5nIHNwcml0ZSBhbmltYXRpb24gY2xpcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzcGVlZCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zcGVlZCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzcGVlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwZWVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZsaXAgdGhlIFggYXhpcyB3aGVuIHJlbmRlcmluZyBhIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmbGlwWCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fZmxpcFggPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZmxpcFggPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgZ2V0IGZsaXBYKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmxpcFg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmxpcCB0aGUgWSBheGlzIHdoZW4gcmVuZGVyaW5nIGEgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZsaXBZKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mbGlwWSA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mbGlwWSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICBnZXQgZmxpcFkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwWTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIHNwcml0ZSB3aGVuIHJlbmRlcmluZyB1c2luZyA5LVNsaWNpbmcuIFRoZSB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBvbmx5IHVzZWRcbiAgICAgKiB3aGVuIHRoZSByZW5kZXIgbW9kZSBvZiB0aGUgc3ByaXRlIGFzc2V0IGlzIFNsaWNlZCBvciBUaWxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHdpZHRoKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5fd2lkdGgpIHJldHVybjtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnggPSB0aGlzLl93aWR0aDtcblxuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEIHx8IHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zZm9ybSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgc3ByaXRlIHdoZW4gcmVuZGVyaW5nIHVzaW5nIDktU2xpY2luZy4gVGhlIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG9ubHkgdXNlZFxuICAgICAqIHdoZW4gdGhlIHJlbmRlciBtb2RlIG9mIHRoZSBzcHJpdGUgYXNzZXQgaXMgU2xpY2VkIG9yIFRpbGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5faGVpZ2h0KSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUueSA9IHRoaXMuaGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBzcHJpdGUgdG8gYSBzcGVjaWZpYyBiYXRjaCBncm91cCAoc2VlIHtAbGluayBCYXRjaEdyb3VwfSkuIERlZmF1bHQgaXMgLTEgKG5vIGdyb3VwKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGJhdGNoR3JvdXBJZCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBwcmV2ID0gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiBwcmV2ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5TUFJJVEUsIHByZXYsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB2YWx1ZSA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuU1BSSVRFLCB2YWx1ZSwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmUtYWRkIG1vZGVsIHRvIHNjZW5lIGluIGNhc2UgaXQgd2FzIHJlbW92ZWQgYnkgYmF0Y2hpbmdcbiAgICAgICAgICAgIGlmIChwcmV2ID49IDApIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgJiYgdGhpcy5fY3VycmVudENsaXAuc3ByaXRlICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBiYXRjaEdyb3VwSWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iYXRjaEdyb3VwSWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGNsaXAgdG8gcGxheSBhdXRvbWF0aWNhbGx5IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkIGFuZCB0aGUgY2xpcCBleGlzdHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCBhdXRvUGxheUNsaXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYXV0b1BsYXlDbGlwID0gdmFsdWUgaW5zdGFuY2VvZiBTcHJpdGVBbmltYXRpb25DbGlwID8gdmFsdWUubmFtZSA6IHZhbHVlO1xuICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuICAgIH1cblxuICAgIGdldCBhdXRvUGxheUNsaXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdXRvUGxheUNsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGRyYXcgb3JkZXIgb2YgdGhlIGNvbXBvbmVudC4gQSBoaWdoZXIgdmFsdWUgbWVhbnMgdGhhdCB0aGUgY29tcG9uZW50IHdpbGwgYmUgcmVuZGVyZWQgb25cbiAgICAgKiB0b3Agb2Ygb3RoZXIgY29tcG9uZW50cyBpbiB0aGUgc2FtZSBsYXllci4gVGhpcyBpcyBub3QgdXNlZCB1bmxlc3MgdGhlIGxheWVyJ3Mgc29ydCBvcmRlciBpc1xuICAgICAqIHNldCB0byB7QGxpbmsgU09SVE1PREVfTUFOVUFMfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGRyYXdPcmRlcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGRyYXdPcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RyYXdPcmRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgc3ByaXRlIHNob3VsZCBiZWxvbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IGxheWVycyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sYXllcnMgPSB2YWx1ZTtcblxuICAgICAgICAvLyBlYXJseSBvdXRcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIGdldCBhYWJiKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbWVzaEluc3RhbmNlLmFhYmI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMuX29uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbignYWRkJywgdGhpcy5fb25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5fb25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApXG4gICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLlNQUklURSwgdGhpcy5fYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgc2NlbmUub2ZmKCdzZXQ6bGF5ZXJzJywgdGhpcy5fb25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5fb25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcblxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLlNQUklURSwgdGhpcy5fYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fZGVmYXVsdENsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwLl9kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9kZWZhdWx0Q2xpcCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fY2xpcHMpIHtcbiAgICAgICAgICAgIHRoaXMuX2NsaXBzW2tleV0uX2Rlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jbGlwcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIHRoaXMuX21vZGVsID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fbm9kZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX25vZGUucGFyZW50KVxuICAgICAgICAgICAgICAgIHRoaXMuX25vZGUucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuX25vZGUpO1xuICAgICAgICAgICAgdGhpcy5fbm9kZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICAvLyBtYWtlIHN1cmUgd2UgZGVjcmVhc2UgdGhlIHJlZiBjb3VudHMgbWF0ZXJpYWxzIGFuZCBtZXNoZXNcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3Nob3dNb2RlbCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZGVkTW9kZWwpIHJldHVybjtcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gW3RoaXMuX21lc2hJbnN0YW5jZV07XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2xheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhtZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWwgPSB0cnVlO1xuICAgIH1cblxuICAgIF9oaWRlTW9kZWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYWRkZWRNb2RlbCB8fCAhdGhpcy5fbWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IFt0aGlzLl9tZXNoSW5zdGFuY2VdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9sYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMobWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hZGRlZE1vZGVsID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSBkZXNpcmVkIG1lc2ggb24gdGhlIG1lc2ggaW5zdGFuY2VcbiAgICBfc2hvd0ZyYW1lKGZyYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5zcHJpdGUpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoID0gdGhpcy5zcHJpdGUubWVzaGVzW2ZyYW1lXTtcbiAgICAgICAgLy8gaWYgbWVzaCBpcyBudWxsIHRoZW4gaGlkZSB0aGUgbWVzaCBpbnN0YW5jZVxuICAgICAgICBpZiAoIW1lc2gpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnZpc2libGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG1hdGVyaWFsO1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxTbGljZWRNb2RlO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxUaWxlZE1vZGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBtZXNoIGluc3RhbmNlIGlmIGl0IGRvZXNuJ3QgZXhpc3QgeWV0XG4gICAgICAgIGlmICghdGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMuX21hdGVyaWFsLCB0aGlzLl9ub2RlKTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5jYXN0U2hhZG93ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IHRoaXMuX2RyYXdPcmRlcjtcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMucHVzaCh0aGlzLl9tZXNoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAvLyBzZXQgb3ZlcnJpZGVzIG9uIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9jb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fRU1JU1NJVkUsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09QQUNJVFksIHRoaXMuX2NvbG9yLmEpO1xuXG4gICAgICAgICAgICAvLyBub3cgdGhhdCB3ZSBjcmVhdGVkIHRoZSBtZXNoIGluc3RhbmNlLCBhZGQgdGhlIG1vZGVsIHRvIHRoZSBzY2VuZVxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgbWF0ZXJpYWxcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCAhPT0gbWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIG1lc2hcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZS5tZXNoICE9PSBtZXNoKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCA9IG1lc2g7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UudmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICAvLyByZXNldCBhYWJiXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUuYXRsYXMgJiYgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9FTUlTU0lWRV9NQVAsIHRoaXMuc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9PUEFDSVRZX01BUCwgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyB0ZXh0dXJlIHNvIHJlc2V0IHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFX01BUCk7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKFBBUkFNX09QQUNJVFlfTUFQKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZvciA5LXNsaWNlZFxuICAgICAgICBpZiAodGhpcy5zcHJpdGUuYXRsYXMgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcbiAgICAgICAgICAgIC8vIHNldCBjdXN0b20gYWFiYiBmdW5jdGlvblxuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLl91cGRhdGVBYWJiRnVuYyA9IHRoaXMuX3VwZGF0ZUFhYmJGdW5jO1xuXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgaW5uZXIgb2Zmc2V0XG4gICAgICAgICAgICBjb25zdCBmcmFtZURhdGEgPSB0aGlzLnNwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5zcHJpdGUuZnJhbWVLZXlzW2ZyYW1lXV07XG4gICAgICAgICAgICBpZiAoZnJhbWVEYXRhKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9yZGVyV2lkdGhTY2FsZSA9IDIgLyBmcmFtZURhdGEucmVjdC56O1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvcmRlckhlaWdodFNjYWxlID0gMiAvIGZyYW1lRGF0YS5yZWN0Lnc7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldC5zZXQoXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueCAqIGJvcmRlcldpZHRoU2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueSAqIGJvcmRlckhlaWdodFNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnogKiBib3JkZXJXaWR0aFNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLncgKiBib3JkZXJIZWlnaHRTY2FsZVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0ZXggPSB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdC5zZXQoZnJhbWVEYXRhLnJlY3QueCAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LnkgLyB0ZXguaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueiAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LncgLyB0ZXguaGVpZ2h0XG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldC5zZXQoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBpbm5lciBvZmZzZXQgYW5kIGF0bGFzIHJlY3Qgb24gbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzBdID0gdGhpcy5faW5uZXJPZmZzZXQueDtcbiAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVsxXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lnk7XG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMl0gPSB0aGlzLl9pbm5lck9mZnNldC56O1xuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzNdID0gdGhpcy5faW5uZXJPZmZzZXQudztcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fSU5ORVJfT0ZGU0VULCB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0pO1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVswXSA9IHRoaXMuX2F0bGFzUmVjdC54O1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsxXSA9IHRoaXMuX2F0bGFzUmVjdC55O1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsyXSA9IHRoaXMuX2F0bGFzUmVjdC56O1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVszXSA9IHRoaXMuX2F0bGFzUmVjdC53O1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9BVExBU19SRUNULCB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgLy8gZmxpcFxuICAgICAgICBsZXQgc2NhbGVYID0gdGhpcy5mbGlwWCA/IC0xIDogMTtcbiAgICAgICAgbGV0IHNjYWxlWSA9IHRoaXMuZmxpcFkgPyAtMSA6IDE7XG5cbiAgICAgICAgLy8gcGl2b3RcbiAgICAgICAgbGV0IHBvc1ggPSAwO1xuICAgICAgICBsZXQgcG9zWSA9IDA7XG5cbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpKSB7XG5cbiAgICAgICAgICAgIGxldCB3ID0gMTtcbiAgICAgICAgICAgIGxldCBoID0gMTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZnJhbWVEYXRhID0gdGhpcy5zcHJpdGUuYXRsYXMuZnJhbWVzW3RoaXMuc3ByaXRlLmZyYW1lS2V5c1t0aGlzLmZyYW1lXV07XG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBnZXQgZnJhbWUgZGltZW5zaW9uc1xuICAgICAgICAgICAgICAgICAgICB3ID0gZnJhbWVEYXRhLnJlY3QuejtcbiAgICAgICAgICAgICAgICAgICAgaCA9IGZyYW1lRGF0YS5yZWN0Lnc7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIHBpdm90XG4gICAgICAgICAgICAgICAgICAgIHBvc1ggPSAoMC41IC0gZnJhbWVEYXRhLnBpdm90LngpICogdGhpcy5fd2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIHBvc1kgPSAoMC41IC0gZnJhbWVEYXRhLnBpdm90LnkpICogdGhpcy5faGVpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2NhbGU6IGFwcGx5IFBQVVxuICAgICAgICAgICAgY29uc3Qgc2NhbGVNdWxYID0gdyAvIHRoaXMuc3ByaXRlLnBpeGVsc1BlclVuaXQ7XG4gICAgICAgICAgICBjb25zdCBzY2FsZU11bFkgPSBoIC8gdGhpcy5zcHJpdGUucGl4ZWxzUGVyVW5pdDtcblxuICAgICAgICAgICAgLy8gc2NhbGUgYm9yZGVycyBpZiBuZWNlc3NhcnkgaW5zdGVhZCBvZiBvdmVybGFwcGluZ1xuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS5zZXQoTWF0aC5tYXgodGhpcy5fd2lkdGgsIHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCBNYXRoLm1heCh0aGlzLl9oZWlnaHQsIHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpKTtcblxuICAgICAgICAgICAgc2NhbGVYICo9IHNjYWxlTXVsWDtcbiAgICAgICAgICAgIHNjYWxlWSAqPSBzY2FsZU11bFk7XG5cbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUueCAvPSBzY2FsZU11bFg7XG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnkgLz0gc2NhbGVNdWxZO1xuXG4gICAgICAgICAgICAvLyBzY2FsZTogc2hyaW5raW5nIGJlbG93IDFcbiAgICAgICAgICAgIHNjYWxlWCAqPSBtYXRoLmNsYW1wKHRoaXMuX3dpZHRoIC8gKHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCAwLjAwMDEsIDEpO1xuICAgICAgICAgICAgc2NhbGVZICo9IG1hdGguY2xhbXAodGhpcy5faGVpZ2h0IC8gKHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpLCAwLjAwMDEsIDEpO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgb3V0ZXIgc2NhbGVcbiAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybVswXSA9IHRoaXMuX291dGVyU2NhbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybVsxXSA9IHRoaXMuX291dGVyU2NhbGUueTtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09VVEVSX1NDQUxFLCB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzY2FsZVxuICAgICAgICB0aGlzLl9ub2RlLnNldExvY2FsU2NhbGUoc2NhbGVYLCBzY2FsZVksIDEpO1xuICAgICAgICAvLyBwaXZvdFxuICAgICAgICB0aGlzLl9ub2RlLnNldExvY2FsUG9zaXRpb24ocG9zWCwgcG9zWSwgMCk7XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlcyBBQUJCIHdoaWxlIDktc2xpY2luZ1xuICAgIF91cGRhdGVBYWJiKGFhYmIpIHtcbiAgICAgICAgLy8gcGl2b3RcbiAgICAgICAgYWFiYi5jZW50ZXIuc2V0KDAsIDAsIDApO1xuICAgICAgICAvLyBzaXplXG4gICAgICAgIGFhYmIuaGFsZkV4dGVudHMuc2V0KHRoaXMuX291dGVyU2NhbGUueCAqIDAuNSwgdGhpcy5fb3V0ZXJTY2FsZS55ICogMC41LCAwLjAwMSk7XG4gICAgICAgIC8vIHdvcmxkIHRyYW5zZm9ybVxuICAgICAgICBhYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoYWFiYiwgdGhpcy5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgcmV0dXJuIGFhYmI7XG4gICAgfVxuXG4gICAgX3RyeUF1dG9QbGF5KCkge1xuICAgICAgICBpZiAoIXRoaXMuX2F1dG9QbGF5Q2xpcCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy50eXBlICE9PSBTUFJJVEVUWVBFX0FOSU1BVEVEKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY2xpcCA9IHRoaXMuX2NsaXBzW3RoaXMuX2F1dG9QbGF5Q2xpcF07XG4gICAgICAgIC8vIGlmIHRoZSBjbGlwIGV4aXN0cyBhbmQgbm90aGluZyBlbHNlIGlzIHBsYXlpbmcgcGxheSBpdFxuICAgICAgICBpZiAoY2xpcCAmJiAhY2xpcC5pc1BsYXlpbmcgJiYgKCF0aGlzLl9jdXJyZW50Q2xpcCB8fCAhdGhpcy5fY3VycmVudENsaXAuaXNQbGF5aW5nKSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KGNsaXAubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbCAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuX21lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGlmICghdGhpcy5fbWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLl9tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICByZW1vdmVNb2RlbEZyb21MYXllcnMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLl9tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW5kIGFkZHMgYSBuZXcge0BsaW5rIFNwcml0ZUFuaW1hdGlvbkNsaXB9IHRvIHRoZSBjb21wb25lbnQncyBjbGlwcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkYXRhIC0gRGF0YSBmb3IgdGhlIG5ldyBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2RhdGEubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgbmV3IGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZGF0YS5mcHNdIC0gRnJhbWVzIHBlciBzZWNvbmQgZm9yIHRoZSBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkYXRhLmxvb3BdIC0gV2hldGhlciB0byBsb29wIHRoZSBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxpbXBvcnQoJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXR9IFtkYXRhLnNwcml0ZUFzc2V0XSAtIFRoZSBhc3NldCBpZCBvclxuICAgICAqIHRoZSB7QGxpbmsgQXNzZXR9IG9mIHRoZSBzcHJpdGUgdGhhdCB0aGlzIGNsaXAgd2lsbCBwbGF5LlxuICAgICAqIEByZXR1cm5zIHtTcHJpdGVBbmltYXRpb25DbGlwfSBUaGUgbmV3IGNsaXAgdGhhdCB3YXMgYWRkZWQuXG4gICAgICovXG4gICAgYWRkQ2xpcChkYXRhKSB7XG4gICAgICAgIGNvbnN0IGNsaXAgPSBuZXcgU3ByaXRlQW5pbWF0aW9uQ2xpcCh0aGlzLCB7XG4gICAgICAgICAgICBuYW1lOiBkYXRhLm5hbWUsXG4gICAgICAgICAgICBmcHM6IGRhdGEuZnBzLFxuICAgICAgICAgICAgbG9vcDogZGF0YS5sb29wLFxuICAgICAgICAgICAgc3ByaXRlQXNzZXQ6IGRhdGEuc3ByaXRlQXNzZXRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5fY2xpcHNbZGF0YS5uYW1lXSA9IGNsaXA7XG5cbiAgICAgICAgaWYgKGNsaXAubmFtZSAmJiBjbGlwLm5hbWUgPT09IHRoaXMuX2F1dG9QbGF5Q2xpcClcbiAgICAgICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG5cbiAgICAgICAgcmV0dXJuIGNsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGNsaXAgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGFuaW1hdGlvbiBjbGlwIHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICByZW1vdmVDbGlwKG5hbWUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX2NsaXBzW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhbiBhbmltYXRpb24gY2xpcCBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgY2xpcC5cbiAgICAgKiBAcmV0dXJucyB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gVGhlIGNsaXAuXG4gICAgICovXG4gICAgY2xpcChuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGlwc1tuYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQbGF5cyBhIHNwcml0ZSBhbmltYXRpb24gY2xpcCBieSBuYW1lLiBJZiB0aGUgYW5pbWF0aW9uIGNsaXAgaXMgYWxyZWFkeSBwbGF5aW5nIHRoZW4gdGhpc1xuICAgICAqIHdpbGwgZG8gbm90aGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGNsaXAgdG8gcGxheS5cbiAgICAgKiBAcmV0dXJucyB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gVGhlIGNsaXAgdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG4gICAgcGxheShuYW1lKSB7XG4gICAgICAgIGNvbnN0IGNsaXAgPSB0aGlzLl9jbGlwc1tuYW1lXTtcblxuICAgICAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5fY3VycmVudENsaXA7XG4gICAgICAgIGlmIChjdXJyZW50ICYmIGN1cnJlbnQgIT09IGNsaXApIHtcbiAgICAgICAgICAgIGN1cnJlbnQuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gY2xpcDtcblxuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gY2xpcDtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLnBsYXkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYFRyeWluZyB0byBwbGF5IHNwcml0ZSBhbmltYXRpb24gJHtuYW1lfSB3aGljaCBkb2VzIG5vdCBleGlzdC5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdXNlcyB0aGUgY3VycmVudCBhbmltYXRpb24gY2xpcC5cbiAgICAgKi9cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwID09PSB0aGlzLl9kZWZhdWx0Q2xpcCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcC5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLnBhdXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN1bWVzIHRoZSBjdXJyZW50IHBhdXNlZCBhbmltYXRpb24gY2xpcC5cbiAgICAgKi9cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCA9PT0gdGhpcy5fZGVmYXVsdENsaXApIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAuaXNQYXVzZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLnJlc3VtZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgdGhlIGN1cnJlbnQgYW5pbWF0aW9uIGNsaXAgYW5kIHJlc2V0cyBpdCB0byB0aGUgZmlyc3QgZnJhbWUuXG4gICAgICovXG4gICAgc3RvcCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwID09PSB0aGlzLl9kZWZhdWx0Q2xpcCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLnN0b3AoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNwcml0ZUNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIlBBUkFNX0VNSVNTSVZFX01BUCIsIlBBUkFNX09QQUNJVFlfTUFQIiwiUEFSQU1fRU1JU1NJVkUiLCJQQVJBTV9PUEFDSVRZIiwiUEFSQU1fSU5ORVJfT0ZGU0VUIiwiUEFSQU1fT1VURVJfU0NBTEUiLCJQQVJBTV9BVExBU19SRUNUIiwiU3ByaXRlQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfdHlwZSIsIlNQUklURVRZUEVfU0lNUExFIiwiX21hdGVyaWFsIiwiZGVmYXVsdE1hdGVyaWFsIiwiX2NvbG9yIiwiQ29sb3IiLCJfY29sb3JVbmlmb3JtIiwiRmxvYXQzMkFycmF5IiwiX3NwZWVkIiwiX2ZsaXBYIiwiX2ZsaXBZIiwiX3dpZHRoIiwiX2hlaWdodCIsIl9kcmF3T3JkZXIiLCJfbGF5ZXJzIiwiTEFZRVJJRF9XT1JMRCIsIl9vdXRlclNjYWxlIiwiVmVjMiIsIl9vdXRlclNjYWxlVW5pZm9ybSIsIl9pbm5lck9mZnNldCIsIlZlYzQiLCJfaW5uZXJPZmZzZXRVbmlmb3JtIiwiX2F0bGFzUmVjdCIsIl9hdGxhc1JlY3RVbmlmb3JtIiwiX2JhdGNoR3JvdXBJZCIsIl9iYXRjaEdyb3VwIiwiX25vZGUiLCJHcmFwaE5vZGUiLCJfbW9kZWwiLCJNb2RlbCIsImdyYXBoIiwiX21lc2hJbnN0YW5jZSIsImFkZENoaWxkIiwiX2VudGl0eSIsIl91cGRhdGVBYWJiRnVuYyIsIl91cGRhdGVBYWJiIiwiYmluZCIsIl9hZGRlZE1vZGVsIiwiX2F1dG9QbGF5Q2xpcCIsIl9jbGlwcyIsIl9kZWZhdWx0Q2xpcCIsIlNwcml0ZUFuaW1hdGlvbkNsaXAiLCJuYW1lIiwiZnBzIiwibG9vcCIsInNwcml0ZUFzc2V0IiwiX2N1cnJlbnRDbGlwIiwidHlwZSIsInZhbHVlIiwic3RvcCIsImVuYWJsZWQiLCJmcmFtZSIsInNwcml0ZSIsIl9zaG93TW9kZWwiLCJfaGlkZU1vZGVsIiwiU1BSSVRFVFlQRV9BTklNQVRFRCIsIl90cnlBdXRvUGxheSIsImlzUGxheWluZyIsIl9zcHJpdGVBc3NldCIsIm1hdGVyaWFsIiwiY29sb3IiLCJyIiwiZyIsImIiLCJzZXRQYXJhbWV0ZXIiLCJvcGFjaXR5IiwiYSIsImNsaXBzIiwicmVtb3ZlQ2xpcCIsImZvdW5kIiwia2V5IiwiaGFzT3duUHJvcGVydHkiLCJhZGRDbGlwIiwiY3VycmVudENsaXAiLCJzcGVlZCIsImZsaXBYIiwiX3VwZGF0ZVRyYW5zZm9ybSIsImZsaXBZIiwid2lkdGgiLCJ4IiwicmVuZGVyTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiaGVpZ2h0IiwieSIsImJhdGNoR3JvdXBJZCIsInByZXYiLCJhcHAiLCJiYXRjaGVyIiwicmVtb3ZlIiwiQmF0Y2hHcm91cCIsIlNQUklURSIsImluc2VydCIsImF1dG9QbGF5Q2xpcCIsImRyYXdPcmRlciIsImxheWVycyIsImFhYmIiLCJvbkVuYWJsZSIsInNjZW5lIiwib24iLCJfb25MYXllcnNDaGFuZ2VkIiwiX29uTGF5ZXJBZGRlZCIsIl9vbkxheWVyUmVtb3ZlZCIsIm9uRGlzYWJsZSIsIm9mZiIsIm9uRGVzdHJveSIsIl9kZXN0cm95IiwicGFyZW50IiwicmVtb3ZlQ2hpbGQiLCJtZXNoIiwibWVzaEluc3RhbmNlcyIsImkiLCJsZW4iLCJsZW5ndGgiLCJsYXllciIsImdldExheWVyQnlJZCIsImFkZE1lc2hJbnN0YW5jZXMiLCJyZW1vdmVNZXNoSW5zdGFuY2VzIiwiX3Nob3dGcmFtZSIsIm1lc2hlcyIsInZpc2libGUiLCJkZWZhdWx0OVNsaWNlZE1hdGVyaWFsU2xpY2VkTW9kZSIsImRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxUaWxlZE1vZGUiLCJNZXNoSW5zdGFuY2UiLCJjYXN0U2hhZG93IiwicmVjZWl2ZVNoYWRvdyIsInB1c2giLCJfYWFiYlZlciIsImF0bGFzIiwidGV4dHVyZSIsImRlbGV0ZVBhcmFtZXRlciIsImZyYW1lRGF0YSIsImZyYW1lcyIsImZyYW1lS2V5cyIsImJvcmRlcldpZHRoU2NhbGUiLCJyZWN0IiwieiIsImJvcmRlckhlaWdodFNjYWxlIiwidyIsInNldCIsImJvcmRlciIsInRleCIsInNjYWxlWCIsInNjYWxlWSIsInBvc1giLCJwb3NZIiwiaCIsInBpdm90Iiwic2NhbGVNdWxYIiwicGl4ZWxzUGVyVW5pdCIsInNjYWxlTXVsWSIsIk1hdGgiLCJtYXgiLCJtYXRoIiwiY2xhbXAiLCJzZXRMb2NhbFNjYWxlIiwic2V0TG9jYWxQb3NpdGlvbiIsImNlbnRlciIsImhhbGZFeHRlbnRzIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsImdldFdvcmxkVHJhbnNmb3JtIiwiY2xpcCIsInBsYXkiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpbmRleE9mIiwiaWQiLCJyZW1vdmVNb2RlbEZyb21MYXllcnMiLCJkYXRhIiwiY3VycmVudCIsIl9wbGF5aW5nIiwiRGVidWciLCJ3YXJuIiwicGF1c2UiLCJyZXN1bWUiLCJpc1BhdXNlZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFCQSxNQUFNQSxrQkFBa0IsR0FBRyxxQkFBcUIsQ0FBQTtBQUNoRCxNQUFNQyxpQkFBaUIsR0FBRyxvQkFBb0IsQ0FBQTtBQUM5QyxNQUFNQyxjQUFjLEdBQUcsbUJBQW1CLENBQUE7QUFDMUMsTUFBTUMsYUFBYSxHQUFHLGtCQUFrQixDQUFBO0FBQ3hDLE1BQU1DLGtCQUFrQixHQUFHLGFBQWEsQ0FBQTtBQUN4QyxNQUFNQyxpQkFBaUIsR0FBRyxZQUFZLENBQUE7QUFDdEMsTUFBTUMsZ0JBQWdCLEdBQUcsV0FBVyxDQUFBOztBQUVwQztBQUNBO0FBQ0E7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
