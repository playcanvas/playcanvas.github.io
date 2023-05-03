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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc3ByaXRlL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9XT1JMRCxcbiAgICBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQsIFNQUklURV9SRU5ERVJNT0RFX1RJTEVEXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBTUFJJVEVUWVBFX1NJTVBMRSwgU1BSSVRFVFlQRV9BTklNQVRFRCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNwcml0ZUFuaW1hdGlvbkNsaXAgfSBmcm9tICcuL3Nwcml0ZS1hbmltYXRpb24tY2xpcC5qcyc7XG5cbmNvbnN0IFBBUkFNX0VNSVNTSVZFX01BUCA9ICd0ZXh0dXJlX2VtaXNzaXZlTWFwJztcbmNvbnN0IFBBUkFNX09QQUNJVFlfTUFQID0gJ3RleHR1cmVfb3BhY2l0eU1hcCc7XG5jb25zdCBQQVJBTV9FTUlTU0lWRSA9ICdtYXRlcmlhbF9lbWlzc2l2ZSc7XG5jb25zdCBQQVJBTV9PUEFDSVRZID0gJ21hdGVyaWFsX29wYWNpdHknO1xuY29uc3QgUEFSQU1fSU5ORVJfT0ZGU0VUID0gJ2lubmVyT2Zmc2V0JztcbmNvbnN0IFBBUkFNX09VVEVSX1NDQUxFID0gJ291dGVyU2NhbGUnO1xuY29uc3QgUEFSQU1fQVRMQVNfUkVDVCA9ICdhdGxhc1JlY3QnO1xuXG4vKipcbiAqIEVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciBhIHNpbXBsZSBzdGF0aWMgc3ByaXRlIG9yIHNwcml0ZSBhbmltYXRpb25zLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgU3ByaXRlQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU3ByaXRlQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuU3ByaXRlQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl90eXBlID0gU1BSSVRFVFlQRV9TSU1QTEU7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgdGhpcy5fY29sb3IgPSBuZXcgQ29sb3IoMSwgMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuX3NwZWVkID0gMTtcbiAgICAgICAgdGhpcy5fZmxpcFggPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZmxpcFkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fd2lkdGggPSAxO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSAxO1xuXG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IDA7XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAgICAgLy8gOS1zbGljaW5nXG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUgPSBuZXcgVmVjMigxLCAxKTtcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB0aGlzLl9pbm5lck9mZnNldCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuXG4gICAgICAgIC8vIGJhdGNoIGdyb3Vwc1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSAtMTtcbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cCA9IG51bGw7XG5cbiAgICAgICAgLy8gbm9kZSAvIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgdGhpcy5fbm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwuZ3JhcGggPSB0aGlzLl9ub2RlO1xuICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICBlbnRpdHkuYWRkQ2hpbGQodGhpcy5fbW9kZWwuZ3JhcGgpO1xuICAgICAgICB0aGlzLl9tb2RlbC5fZW50aXR5ID0gZW50aXR5O1xuICAgICAgICB0aGlzLl91cGRhdGVBYWJiRnVuYyA9IHRoaXMuX3VwZGF0ZUFhYmIuYmluZCh0aGlzKTtcblxuICAgICAgICB0aGlzLl9hZGRlZE1vZGVsID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYW5pbWF0ZWQgc3ByaXRlc1xuICAgICAgICB0aGlzLl9hdXRvUGxheUNsaXAgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaWN0aW9uYXJ5IG9mIHNwcml0ZSBhbmltYXRpb24gY2xpcHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBTcHJpdGVBbmltYXRpb25DbGlwPn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsaXBzID0ge307XG5cbiAgICAgICAgLy8gY3JlYXRlIGRlZmF1bHQgY2xpcCBmb3Igc2ltcGxlIHNwcml0ZSB0eXBlXG4gICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwID0gbmV3IFNwcml0ZUFuaW1hdGlvbkNsaXAodGhpcywge1xuICAgICAgICAgICAgbmFtZTogdGhpcy5lbnRpdHkubmFtZSxcbiAgICAgICAgICAgIGZwczogMCxcbiAgICAgICAgICAgIGxvb3A6IGZhbHNlLFxuICAgICAgICAgICAgc3ByaXRlQXNzZXQ6IG51bGxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzcHJpdGUgYW5pbWF0aW9uIGNsaXAgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTcHJpdGVBbmltYXRpb25DbGlwfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSB0aGlzLl9kZWZhdWx0Q2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIHN0YXJ0cyBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNwbGF5XG4gICAgICogQHBhcmFtIHtTcHJpdGVBbmltYXRpb25DbGlwfSBjbGlwIC0gVGhlIGNsaXAgdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjcGF1c2VcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IHdhcyBwYXVzZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I3Jlc3VtZVxuICAgICAqIEBwYXJhbSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gY2xpcCAtIFRoZSBjbGlwIHRoYXQgd2FzIHJlc3VtZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I3N0b3BcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IHdhcyBzdG9wcGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCBzdG9wcyBwbGF5aW5nIGJlY2F1c2UgaXQgcmVhY2hlZCBpdHMgZW5kaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNlbmRcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IGVuZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCByZWFjaGVkIHRoZSBlbmQgb2YgaXRzIGN1cnJlbnQgbG9vcC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjbG9vcFxuICAgICAqIEBwYXJhbSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gY2xpcCAtIFRoZSBjbGlwLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIFNwcml0ZUNvbXBvbmVudC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1BSSVRFVFlQRV9TSU1QTEV9OiBUaGUgY29tcG9uZW50IHJlbmRlcnMgYSBzaW5nbGUgZnJhbWUgZnJvbSBhIHNwcml0ZSBhc3NldC5cbiAgICAgKiAtIHtAbGluayBTUFJJVEVUWVBFX0FOSU1BVEVEfTogVGhlIGNvbXBvbmVudCBjYW4gcGxheSBzcHJpdGUgYW5pbWF0aW9uIGNsaXBzLlxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFNQUklURVRZUEVfU0lNUExFfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IFNQUklURVRZUEVfU0lNUExFKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gdGhpcy5fZGVmYXVsdENsaXA7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lID0gdGhpcy5mcmFtZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcC5zcHJpdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gU1BSSVRFVFlQRV9BTklNQVRFRCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgJiYgdGhpcy5fY3VycmVudENsaXAuaXNQbGF5aW5nICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGVNb2RlbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBmcmFtZSBjb3VudGVyIG9mIHRoZSBzcHJpdGUuIFNwZWNpZmllcyB3aGljaCBmcmFtZSBmcm9tIHRoZSBjdXJyZW50IHNwcml0ZSBhc3NldCB0b1xuICAgICAqIHJlbmRlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZyYW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGZyYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudENsaXAuZnJhbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFzc2V0IGlkIG9yIHRoZSB7QGxpbmsgQXNzZXR9IG9mIHRoZSBzcHJpdGUgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICAgICAqIHtAbGluayBTUFJJVEVUWVBFX1NJTVBMRX0gc3ByaXRlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ8aW1wb3J0KCcuLi8uLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fVxuICAgICAqL1xuICAgIHNldCBzcHJpdGVBc3NldCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kZWZhdWx0Q2xpcC5zcHJpdGVBc3NldCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzcHJpdGVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZmF1bHRDbGlwLl9zcHJpdGVBc3NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBzcHJpdGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7U3ByaXRlfVxuICAgICAqL1xuICAgIHNldCBzcHJpdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAuc3ByaXRlID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNwcml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwLnNwcml0ZTtcbiAgICB9XG5cbiAgICAvLyAocHJpdmF0ZSkge3BjLk1hdGVyaWFsfSBtYXRlcmlhbCBUaGUgbWF0ZXJpYWwgdXNlZCB0byByZW5kZXIgYSBzcHJpdGUuXG4gICAgc2V0IG1hdGVyaWFsKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIHRpbnQgb2YgdGhlIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDb2xvcn1cbiAgICAgKi9cbiAgICBzZXQgY29sb3IodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY29sb3IuciA9IHZhbHVlLnI7XG4gICAgICAgIHRoaXMuX2NvbG9yLmcgPSB2YWx1ZS5nO1xuICAgICAgICB0aGlzLl9jb2xvci5iID0gdmFsdWUuYjtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX2NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG9wYWNpdHkgb2YgdGhlIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG9wYWNpdHkodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY29sb3IuYSA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09QQUNJVFksIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvcGFjaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3IuYTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIGRpY3Rpb25hcnkgdGhhdCBjb250YWlucyB7QGxpbmsgU3ByaXRlQW5pbWF0aW9uQ2xpcH1zLlxuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIFNwcml0ZUFuaW1hdGlvbkNsaXA+fVxuICAgICAqL1xuICAgIHNldCBjbGlwcyh2YWx1ZSkge1xuICAgICAgICAvLyBpZiB2YWx1ZSBpcyBudWxsIHJlbW92ZSBhbGwgY2xpcHNcbiAgICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuX2NsaXBzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVDbGlwKG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIGNsaXBzIG5vdCBpbiBuZXcgdmFsdWVcbiAgICAgICAgLy8gYW5kIHVwZGF0ZSBjbGlwcyBpbiBib3RoIG9iamVjdHNcbiAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHRoaXMuX2NsaXBzKSB7XG4gICAgICAgICAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlW2tleV0ubmFtZSA9PT0gbmFtZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NsaXBzW25hbWVdLmZwcyA9IHZhbHVlW2tleV0uZnBzO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlwc1tuYW1lXS5sb29wID0gdmFsdWVba2V5XS5sb29wO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZVtrZXldLmhhc093blByb3BlcnR5KCdzcHJpdGUnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uc3ByaXRlID0gdmFsdWVba2V5XS5zcHJpdGU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWVba2V5XS5oYXNPd25Qcm9wZXJ0eSgnc3ByaXRlQXNzZXQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uc3ByaXRlQXNzZXQgPSB2YWx1ZVtrZXldLnNwcml0ZUFzc2V0O1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWZvdW5kKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmVDbGlwKG5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIGNsaXBzIHRoYXQgZG8gbm90IGV4aXN0XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2xpcHNbdmFsdWVba2V5XS5uYW1lXSkgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuYWRkQ2xpcCh2YWx1ZVtrZXldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGF1dG8gcGxheSBjbGlwXG4gICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUgY3VycmVudCBjbGlwIGRvZXNuJ3QgaGF2ZSBhIHNwcml0ZSB0aGVuIGhpZGUgdGhlIG1vZGVsXG4gICAgICAgIGlmICghdGhpcy5fY3VycmVudENsaXAgfHwgIXRoaXMuX2N1cnJlbnRDbGlwLnNwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY2xpcHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGlwcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBjbGlwIGJlaW5nIHBsYXllZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTcHJpdGVBbmltYXRpb25DbGlwfVxuICAgICAqL1xuICAgIGdldCBjdXJyZW50Q2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1cnJlbnRDbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZ2xvYmFsIHNwZWVkIG1vZGlmaWVyIHVzZWQgd2hlbiBwbGF5aW5nIHNwcml0ZSBhbmltYXRpb24gY2xpcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzcGVlZCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9zcGVlZCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzcGVlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwZWVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZsaXAgdGhlIFggYXhpcyB3aGVuIHJlbmRlcmluZyBhIHNwcml0ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmbGlwWCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fZmxpcFggPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZmxpcFggPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgZ2V0IGZsaXBYKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmxpcFg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmxpcCB0aGUgWSBheGlzIHdoZW4gcmVuZGVyaW5nIGEgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZsaXBZKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mbGlwWSA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mbGlwWSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICBnZXQgZmxpcFkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwWTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIHNwcml0ZSB3aGVuIHJlbmRlcmluZyB1c2luZyA5LVNsaWNpbmcuIFRoZSB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBvbmx5IHVzZWRcbiAgICAgKiB3aGVuIHRoZSByZW5kZXIgbW9kZSBvZiB0aGUgc3ByaXRlIGFzc2V0IGlzIFNsaWNlZCBvciBUaWxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHdpZHRoKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5fd2lkdGgpIHJldHVybjtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnggPSB0aGlzLl93aWR0aDtcblxuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEIHx8IHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zZm9ybSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgc3ByaXRlIHdoZW4gcmVuZGVyaW5nIHVzaW5nIDktU2xpY2luZy4gVGhlIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG9ubHkgdXNlZFxuICAgICAqIHdoZW4gdGhlIHJlbmRlciBtb2RlIG9mIHRoZSBzcHJpdGUgYXNzZXQgaXMgU2xpY2VkIG9yIFRpbGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdGhpcy5faGVpZ2h0KSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUueSA9IHRoaXMuaGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBzcHJpdGUgdG8gYSBzcGVjaWZpYyBiYXRjaCBncm91cCAoc2VlIHtAbGluayBCYXRjaEdyb3VwfSkuIERlZmF1bHQgaXMgLTEgKG5vIGdyb3VwKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGJhdGNoR3JvdXBJZCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBwcmV2ID0gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiBwcmV2ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5TUFJJVEUsIHByZXYsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB2YWx1ZSA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuU1BSSVRFLCB2YWx1ZSwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcmUtYWRkIG1vZGVsIHRvIHNjZW5lIGluIGNhc2UgaXQgd2FzIHJlbW92ZWQgYnkgYmF0Y2hpbmdcbiAgICAgICAgICAgIGlmIChwcmV2ID49IDApIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgJiYgdGhpcy5fY3VycmVudENsaXAuc3ByaXRlICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Nob3dNb2RlbCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBiYXRjaEdyb3VwSWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iYXRjaEdyb3VwSWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIGNsaXAgdG8gcGxheSBhdXRvbWF0aWNhbGx5IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkIGFuZCB0aGUgY2xpcCBleGlzdHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCBhdXRvUGxheUNsaXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYXV0b1BsYXlDbGlwID0gdmFsdWUgaW5zdGFuY2VvZiBTcHJpdGVBbmltYXRpb25DbGlwID8gdmFsdWUubmFtZSA6IHZhbHVlO1xuICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuICAgIH1cblxuICAgIGdldCBhdXRvUGxheUNsaXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdXRvUGxheUNsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGRyYXcgb3JkZXIgb2YgdGhlIGNvbXBvbmVudC4gQSBoaWdoZXIgdmFsdWUgbWVhbnMgdGhhdCB0aGUgY29tcG9uZW50IHdpbGwgYmUgcmVuZGVyZWQgb25cbiAgICAgKiB0b3Agb2Ygb3RoZXIgY29tcG9uZW50cyBpbiB0aGUgc2FtZSBsYXllci4gVGhpcyBpcyBub3QgdXNlZCB1bmxlc3MgdGhlIGxheWVyJ3Mgc29ydCBvcmRlciBpc1xuICAgICAqIHNldCB0byB7QGxpbmsgU09SVE1PREVfTUFOVUFMfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGRyYXdPcmRlcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGRyYXdPcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RyYXdPcmRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgc3ByaXRlIHNob3VsZCBiZWxvbmcuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IGxheWVycyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sYXllcnMgPSB2YWx1ZTtcblxuICAgICAgICAvLyBlYXJseSBvdXRcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIGdldCBhYWJiKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbWVzaEluc3RhbmNlLmFhYmI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMuX29uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbignYWRkJywgdGhpcy5fb25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5fb25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApXG4gICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLlNQUklURSwgdGhpcy5fYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgc2NlbmUub2ZmKCdzZXQ6bGF5ZXJzJywgdGhpcy5fb25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5fb25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3RvcCgpO1xuICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcblxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLlNQUklURSwgdGhpcy5fYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fZGVmYXVsdENsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwLl9kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9kZWZhdWx0Q2xpcCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fY2xpcHMpIHtcbiAgICAgICAgICAgIHRoaXMuX2NsaXBzW2tleV0uX2Rlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jbGlwcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgIHRoaXMuX21vZGVsID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fbm9kZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX25vZGUucGFyZW50KVxuICAgICAgICAgICAgICAgIHRoaXMuX25vZGUucGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuX25vZGUpO1xuICAgICAgICAgICAgdGhpcy5fbm9kZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICAvLyBtYWtlIHN1cmUgd2UgZGVjcmVhc2UgdGhlIHJlZiBjb3VudHMgbWF0ZXJpYWxzIGFuZCBtZXNoZXNcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3Nob3dNb2RlbCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZGVkTW9kZWwpIHJldHVybjtcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gW3RoaXMuX21lc2hJbnN0YW5jZV07XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2xheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhtZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWwgPSB0cnVlO1xuICAgIH1cblxuICAgIF9oaWRlTW9kZWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYWRkZWRNb2RlbCB8fCAhdGhpcy5fbWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IFt0aGlzLl9tZXNoSW5zdGFuY2VdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9sYXllcnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMobWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hZGRlZE1vZGVsID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSBkZXNpcmVkIG1lc2ggb24gdGhlIG1lc2ggaW5zdGFuY2VcbiAgICBfc2hvd0ZyYW1lKGZyYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5zcHJpdGUpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoID0gdGhpcy5zcHJpdGUubWVzaGVzW2ZyYW1lXTtcbiAgICAgICAgLy8gaWYgbWVzaCBpcyBudWxsIHRoZW4gaGlkZSB0aGUgbWVzaCBpbnN0YW5jZVxuICAgICAgICBpZiAoIW1lc2gpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnZpc2libGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG1hdGVyaWFsO1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxTbGljZWRNb2RlO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxUaWxlZE1vZGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBtZXNoIGluc3RhbmNlIGlmIGl0IGRvZXNuJ3QgZXhpc3QgeWV0XG4gICAgICAgIGlmICghdGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMuX21hdGVyaWFsLCB0aGlzLl9ub2RlKTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5jYXN0U2hhZG93ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmRyYXdPcmRlciA9IHRoaXMuX2RyYXdPcmRlcjtcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMucHVzaCh0aGlzLl9tZXNoSW5zdGFuY2UpO1xuXG4gICAgICAgICAgICAvLyBzZXQgb3ZlcnJpZGVzIG9uIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9jb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fRU1JU1NJVkUsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09QQUNJVFksIHRoaXMuX2NvbG9yLmEpO1xuXG4gICAgICAgICAgICAvLyBub3cgdGhhdCB3ZSBjcmVhdGVkIHRoZSBtZXNoIGluc3RhbmNlLCBhZGQgdGhlIG1vZGVsIHRvIHRoZSBzY2VuZVxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgbWF0ZXJpYWxcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCAhPT0gbWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIG1lc2hcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZS5tZXNoICE9PSBtZXNoKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UubWVzaCA9IG1lc2g7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UudmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICAvLyByZXNldCBhYWJiXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCB0ZXh0dXJlIHBhcmFtc1xuICAgICAgICBpZiAodGhpcy5zcHJpdGUuYXRsYXMgJiYgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9FTUlTU0lWRV9NQVAsIHRoaXMuc3ByaXRlLmF0bGFzLnRleHR1cmUpO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9PUEFDSVRZX01BUCwgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyB0ZXh0dXJlIHNvIHJlc2V0IHRleHR1cmUgcGFyYW1zXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFX01BUCk7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZGVsZXRlUGFyYW1ldGVyKFBBUkFNX09QQUNJVFlfTUFQKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZvciA5LXNsaWNlZFxuICAgICAgICBpZiAodGhpcy5zcHJpdGUuYXRsYXMgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcbiAgICAgICAgICAgIC8vIHNldCBjdXN0b20gYWFiYiBmdW5jdGlvblxuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLl91cGRhdGVBYWJiRnVuYyA9IHRoaXMuX3VwZGF0ZUFhYmJGdW5jO1xuXG4gICAgICAgICAgICAvLyBjYWxjdWxhdGUgaW5uZXIgb2Zmc2V0XG4gICAgICAgICAgICBjb25zdCBmcmFtZURhdGEgPSB0aGlzLnNwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5zcHJpdGUuZnJhbWVLZXlzW2ZyYW1lXV07XG4gICAgICAgICAgICBpZiAoZnJhbWVEYXRhKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9yZGVyV2lkdGhTY2FsZSA9IDIgLyBmcmFtZURhdGEucmVjdC56O1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvcmRlckhlaWdodFNjYWxlID0gMiAvIGZyYW1lRGF0YS5yZWN0Lnc7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldC5zZXQoXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueCAqIGJvcmRlcldpZHRoU2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueSAqIGJvcmRlckhlaWdodFNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLnogKiBib3JkZXJXaWR0aFNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEuYm9yZGVyLncgKiBib3JkZXJIZWlnaHRTY2FsZVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0ZXggPSB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlO1xuICAgICAgICAgICAgICAgIHRoaXMuX2F0bGFzUmVjdC5zZXQoZnJhbWVEYXRhLnJlY3QueCAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LnkgLyB0ZXguaGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueiAvIHRleC53aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5yZWN0LncgLyB0ZXguaGVpZ2h0XG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldC5zZXQoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBpbm5lciBvZmZzZXQgYW5kIGF0bGFzIHJlY3Qgb24gbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzBdID0gdGhpcy5faW5uZXJPZmZzZXQueDtcbiAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVsxXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lnk7XG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMl0gPSB0aGlzLl9pbm5lck9mZnNldC56O1xuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzNdID0gdGhpcy5faW5uZXJPZmZzZXQudztcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fSU5ORVJfT0ZGU0VULCB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm0pO1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVswXSA9IHRoaXMuX2F0bGFzUmVjdC54O1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsxXSA9IHRoaXMuX2F0bGFzUmVjdC55O1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVsyXSA9IHRoaXMuX2F0bGFzUmVjdC56O1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0VW5pZm9ybVszXSA9IHRoaXMuX2F0bGFzUmVjdC53O1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9BVExBU19SRUNULCB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5fdXBkYXRlQWFiYkZ1bmMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgLy8gZmxpcFxuICAgICAgICBsZXQgc2NhbGVYID0gdGhpcy5mbGlwWCA/IC0xIDogMTtcbiAgICAgICAgbGV0IHNjYWxlWSA9IHRoaXMuZmxpcFkgPyAtMSA6IDE7XG5cbiAgICAgICAgLy8gcGl2b3RcbiAgICAgICAgbGV0IHBvc1ggPSAwO1xuICAgICAgICBsZXQgcG9zWSA9IDA7XG5cbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpKSB7XG5cbiAgICAgICAgICAgIGxldCB3ID0gMTtcbiAgICAgICAgICAgIGxldCBoID0gMTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuc3ByaXRlLmF0bGFzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZnJhbWVEYXRhID0gdGhpcy5zcHJpdGUuYXRsYXMuZnJhbWVzW3RoaXMuc3ByaXRlLmZyYW1lS2V5c1t0aGlzLmZyYW1lXV07XG4gICAgICAgICAgICAgICAgaWYgKGZyYW1lRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBnZXQgZnJhbWUgZGltZW5zaW9uc1xuICAgICAgICAgICAgICAgICAgICB3ID0gZnJhbWVEYXRhLnJlY3QuejtcbiAgICAgICAgICAgICAgICAgICAgaCA9IGZyYW1lRGF0YS5yZWN0Lnc7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIHBpdm90XG4gICAgICAgICAgICAgICAgICAgIHBvc1ggPSAoMC41IC0gZnJhbWVEYXRhLnBpdm90LngpICogdGhpcy5fd2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIHBvc1kgPSAoMC41IC0gZnJhbWVEYXRhLnBpdm90LnkpICogdGhpcy5faGVpZ2h0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2NhbGU6IGFwcGx5IFBQVVxuICAgICAgICAgICAgY29uc3Qgc2NhbGVNdWxYID0gdyAvIHRoaXMuc3ByaXRlLnBpeGVsc1BlclVuaXQ7XG4gICAgICAgICAgICBjb25zdCBzY2FsZU11bFkgPSBoIC8gdGhpcy5zcHJpdGUucGl4ZWxzUGVyVW5pdDtcblxuICAgICAgICAgICAgLy8gc2NhbGUgYm9yZGVycyBpZiBuZWNlc3NhcnkgaW5zdGVhZCBvZiBvdmVybGFwcGluZ1xuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS5zZXQoTWF0aC5tYXgodGhpcy5fd2lkdGgsIHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCBNYXRoLm1heCh0aGlzLl9oZWlnaHQsIHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpKTtcblxuICAgICAgICAgICAgc2NhbGVYICo9IHNjYWxlTXVsWDtcbiAgICAgICAgICAgIHNjYWxlWSAqPSBzY2FsZU11bFk7XG5cbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUueCAvPSBzY2FsZU11bFg7XG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnkgLz0gc2NhbGVNdWxZO1xuXG4gICAgICAgICAgICAvLyBzY2FsZTogc2hyaW5raW5nIGJlbG93IDFcbiAgICAgICAgICAgIHNjYWxlWCAqPSBtYXRoLmNsYW1wKHRoaXMuX3dpZHRoIC8gKHRoaXMuX2lubmVyT2Zmc2V0LnggKiBzY2FsZU11bFgpLCAwLjAwMDEsIDEpO1xuICAgICAgICAgICAgc2NhbGVZICo9IG1hdGguY2xhbXAodGhpcy5faGVpZ2h0IC8gKHRoaXMuX2lubmVyT2Zmc2V0LnkgKiBzY2FsZU11bFkpLCAwLjAwMDEsIDEpO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgb3V0ZXIgc2NhbGVcbiAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybVswXSA9IHRoaXMuX291dGVyU2NhbGUueDtcbiAgICAgICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybVsxXSA9IHRoaXMuX291dGVyU2NhbGUueTtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09VVEVSX1NDQUxFLCB0aGlzLl9vdXRlclNjYWxlVW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzY2FsZVxuICAgICAgICB0aGlzLl9ub2RlLnNldExvY2FsU2NhbGUoc2NhbGVYLCBzY2FsZVksIDEpO1xuICAgICAgICAvLyBwaXZvdFxuICAgICAgICB0aGlzLl9ub2RlLnNldExvY2FsUG9zaXRpb24ocG9zWCwgcG9zWSwgMCk7XG4gICAgfVxuXG4gICAgLy8gdXBkYXRlcyBBQUJCIHdoaWxlIDktc2xpY2luZ1xuICAgIF91cGRhdGVBYWJiKGFhYmIpIHtcbiAgICAgICAgLy8gcGl2b3RcbiAgICAgICAgYWFiYi5jZW50ZXIuc2V0KDAsIDAsIDApO1xuICAgICAgICAvLyBzaXplXG4gICAgICAgIGFhYmIuaGFsZkV4dGVudHMuc2V0KHRoaXMuX291dGVyU2NhbGUueCAqIDAuNSwgdGhpcy5fb3V0ZXJTY2FsZS55ICogMC41LCAwLjAwMSk7XG4gICAgICAgIC8vIHdvcmxkIHRyYW5zZm9ybVxuICAgICAgICBhYWJiLnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoYWFiYiwgdGhpcy5fbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgcmV0dXJuIGFhYmI7XG4gICAgfVxuXG4gICAgX3RyeUF1dG9QbGF5KCkge1xuICAgICAgICBpZiAoIXRoaXMuX2F1dG9QbGF5Q2xpcCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy50eXBlICE9PSBTUFJJVEVUWVBFX0FOSU1BVEVEKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY2xpcCA9IHRoaXMuX2NsaXBzW3RoaXMuX2F1dG9QbGF5Q2xpcF07XG4gICAgICAgIC8vIGlmIHRoZSBjbGlwIGV4aXN0cyBhbmQgbm90aGluZyBlbHNlIGlzIHBsYXlpbmcgcGxheSBpdFxuICAgICAgICBpZiAoY2xpcCAmJiAhY2xpcC5pc1BsYXlpbmcgJiYgKCF0aGlzLl9jdXJyZW50Q2xpcCB8fCAhdGhpcy5fY3VycmVudENsaXAuaXNQbGF5aW5nKSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wbGF5KGNsaXAubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbCAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuX21lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGlmICghdGhpcy5fbWVzaEluc3RhbmNlKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLl9tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICByZW1vdmVNb2RlbEZyb21MYXllcnMoKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLl9tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW5kIGFkZHMgYSBuZXcge0BsaW5rIFNwcml0ZUFuaW1hdGlvbkNsaXB9IHRvIHRoZSBjb21wb25lbnQncyBjbGlwcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkYXRhIC0gRGF0YSBmb3IgdGhlIG5ldyBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2RhdGEubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgbmV3IGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZGF0YS5mcHNdIC0gRnJhbWVzIHBlciBzZWNvbmQgZm9yIHRoZSBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkYXRhLmxvb3BdIC0gV2hldGhlciB0byBsb29wIHRoZSBhbmltYXRpb24gY2xpcC5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxpbXBvcnQoJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXR9IFtkYXRhLnNwcml0ZUFzc2V0XSAtIFRoZSBhc3NldCBpZCBvclxuICAgICAqIHRoZSB7QGxpbmsgQXNzZXR9IG9mIHRoZSBzcHJpdGUgdGhhdCB0aGlzIGNsaXAgd2lsbCBwbGF5LlxuICAgICAqIEByZXR1cm5zIHtTcHJpdGVBbmltYXRpb25DbGlwfSBUaGUgbmV3IGNsaXAgdGhhdCB3YXMgYWRkZWQuXG4gICAgICovXG4gICAgYWRkQ2xpcChkYXRhKSB7XG4gICAgICAgIGNvbnN0IGNsaXAgPSBuZXcgU3ByaXRlQW5pbWF0aW9uQ2xpcCh0aGlzLCB7XG4gICAgICAgICAgICBuYW1lOiBkYXRhLm5hbWUsXG4gICAgICAgICAgICBmcHM6IGRhdGEuZnBzLFxuICAgICAgICAgICAgbG9vcDogZGF0YS5sb29wLFxuICAgICAgICAgICAgc3ByaXRlQXNzZXQ6IGRhdGEuc3ByaXRlQXNzZXRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5fY2xpcHNbZGF0YS5uYW1lXSA9IGNsaXA7XG5cbiAgICAgICAgaWYgKGNsaXAubmFtZSAmJiBjbGlwLm5hbWUgPT09IHRoaXMuX2F1dG9QbGF5Q2xpcClcbiAgICAgICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG5cbiAgICAgICAgcmV0dXJuIGNsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGNsaXAgYnkgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGFuaW1hdGlvbiBjbGlwIHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICByZW1vdmVDbGlwKG5hbWUpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuX2NsaXBzW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhbiBhbmltYXRpb24gY2xpcCBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgY2xpcC5cbiAgICAgKiBAcmV0dXJucyB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gVGhlIGNsaXAuXG4gICAgICovXG4gICAgY2xpcChuYW1lKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbGlwc1tuYW1lXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQbGF5cyBhIHNwcml0ZSBhbmltYXRpb24gY2xpcCBieSBuYW1lLiBJZiB0aGUgYW5pbWF0aW9uIGNsaXAgaXMgYWxyZWFkeSBwbGF5aW5nIHRoZW4gdGhpc1xuICAgICAqIHdpbGwgZG8gbm90aGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGNsaXAgdG8gcGxheS5cbiAgICAgKiBAcmV0dXJucyB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gVGhlIGNsaXAgdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG4gICAgcGxheShuYW1lKSB7XG4gICAgICAgIGNvbnN0IGNsaXAgPSB0aGlzLl9jbGlwc1tuYW1lXTtcblxuICAgICAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5fY3VycmVudENsaXA7XG4gICAgICAgIGlmIChjdXJyZW50ICYmIGN1cnJlbnQgIT09IGNsaXApIHtcbiAgICAgICAgICAgIGN1cnJlbnQuX3BsYXlpbmcgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gY2xpcDtcblxuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXApIHtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gY2xpcDtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLnBsYXkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYFRyeWluZyB0byBwbGF5IHNwcml0ZSBhbmltYXRpb24gJHtuYW1lfSB3aGljaCBkb2VzIG5vdCBleGlzdC5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjbGlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdXNlcyB0aGUgY3VycmVudCBhbmltYXRpb24gY2xpcC5cbiAgICAgKi9cbiAgICBwYXVzZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwID09PSB0aGlzLl9kZWZhdWx0Q2xpcCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcC5pc1BsYXlpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLnBhdXNlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN1bWVzIHRoZSBjdXJyZW50IHBhdXNlZCBhbmltYXRpb24gY2xpcC5cbiAgICAgKi9cbiAgICByZXN1bWUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCA9PT0gdGhpcy5fZGVmYXVsdENsaXApIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAuaXNQYXVzZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLnJlc3VtZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcHMgdGhlIGN1cnJlbnQgYW5pbWF0aW9uIGNsaXAgYW5kIHJlc2V0cyBpdCB0byB0aGUgZmlyc3QgZnJhbWUuXG4gICAgICovXG4gICAgc3RvcCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwID09PSB0aGlzLl9kZWZhdWx0Q2xpcCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLnN0b3AoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNwcml0ZUNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIlBBUkFNX0VNSVNTSVZFX01BUCIsIlBBUkFNX09QQUNJVFlfTUFQIiwiUEFSQU1fRU1JU1NJVkUiLCJQQVJBTV9PUEFDSVRZIiwiUEFSQU1fSU5ORVJfT0ZGU0VUIiwiUEFSQU1fT1VURVJfU0NBTEUiLCJQQVJBTV9BVExBU19SRUNUIiwiU3ByaXRlQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfdHlwZSIsIlNQUklURVRZUEVfU0lNUExFIiwiX21hdGVyaWFsIiwiZGVmYXVsdE1hdGVyaWFsIiwiX2NvbG9yIiwiQ29sb3IiLCJfY29sb3JVbmlmb3JtIiwiRmxvYXQzMkFycmF5IiwiX3NwZWVkIiwiX2ZsaXBYIiwiX2ZsaXBZIiwiX3dpZHRoIiwiX2hlaWdodCIsIl9kcmF3T3JkZXIiLCJfbGF5ZXJzIiwiTEFZRVJJRF9XT1JMRCIsIl9vdXRlclNjYWxlIiwiVmVjMiIsIl9vdXRlclNjYWxlVW5pZm9ybSIsIl9pbm5lck9mZnNldCIsIlZlYzQiLCJfaW5uZXJPZmZzZXRVbmlmb3JtIiwiX2F0bGFzUmVjdCIsIl9hdGxhc1JlY3RVbmlmb3JtIiwiX2JhdGNoR3JvdXBJZCIsIl9iYXRjaEdyb3VwIiwiX25vZGUiLCJHcmFwaE5vZGUiLCJfbW9kZWwiLCJNb2RlbCIsImdyYXBoIiwiX21lc2hJbnN0YW5jZSIsImFkZENoaWxkIiwiX2VudGl0eSIsIl91cGRhdGVBYWJiRnVuYyIsIl91cGRhdGVBYWJiIiwiYmluZCIsIl9hZGRlZE1vZGVsIiwiX2F1dG9QbGF5Q2xpcCIsIl9jbGlwcyIsIl9kZWZhdWx0Q2xpcCIsIlNwcml0ZUFuaW1hdGlvbkNsaXAiLCJuYW1lIiwiZnBzIiwibG9vcCIsInNwcml0ZUFzc2V0IiwiX2N1cnJlbnRDbGlwIiwidHlwZSIsInZhbHVlIiwic3RvcCIsImVuYWJsZWQiLCJmcmFtZSIsInNwcml0ZSIsIl9zaG93TW9kZWwiLCJfaGlkZU1vZGVsIiwiU1BSSVRFVFlQRV9BTklNQVRFRCIsIl90cnlBdXRvUGxheSIsImlzUGxheWluZyIsIl9zcHJpdGVBc3NldCIsIm1hdGVyaWFsIiwiY29sb3IiLCJyIiwiZyIsImIiLCJzZXRQYXJhbWV0ZXIiLCJvcGFjaXR5IiwiYSIsImNsaXBzIiwicmVtb3ZlQ2xpcCIsImZvdW5kIiwia2V5IiwiaGFzT3duUHJvcGVydHkiLCJhZGRDbGlwIiwiY3VycmVudENsaXAiLCJzcGVlZCIsImZsaXBYIiwiX3VwZGF0ZVRyYW5zZm9ybSIsImZsaXBZIiwid2lkdGgiLCJ4IiwicmVuZGVyTW9kZSIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiaGVpZ2h0IiwieSIsImJhdGNoR3JvdXBJZCIsInByZXYiLCJfdGhpcyRzeXN0ZW0kYXBwJGJhdGMiLCJhcHAiLCJiYXRjaGVyIiwicmVtb3ZlIiwiQmF0Y2hHcm91cCIsIlNQUklURSIsIl90aGlzJHN5c3RlbSRhcHAkYmF0YzIiLCJpbnNlcnQiLCJhdXRvUGxheUNsaXAiLCJkcmF3T3JkZXIiLCJsYXllcnMiLCJhYWJiIiwib25FbmFibGUiLCJzY2VuZSIsIm9uIiwiX29uTGF5ZXJzQ2hhbmdlZCIsIl9vbkxheWVyQWRkZWQiLCJfb25MYXllclJlbW92ZWQiLCJfYXBwJGJhdGNoZXIiLCJvbkRpc2FibGUiLCJvZmYiLCJfYXBwJGJhdGNoZXIyIiwib25EZXN0cm95IiwiX2Rlc3Ryb3kiLCJwYXJlbnQiLCJyZW1vdmVDaGlsZCIsIm1lc2giLCJtZXNoSW5zdGFuY2VzIiwiaSIsImxlbiIsImxlbmd0aCIsImxheWVyIiwiZ2V0TGF5ZXJCeUlkIiwiYWRkTWVzaEluc3RhbmNlcyIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJfc2hvd0ZyYW1lIiwibWVzaGVzIiwidmlzaWJsZSIsImRlZmF1bHQ5U2xpY2VkTWF0ZXJpYWxTbGljZWRNb2RlIiwiZGVmYXVsdDlTbGljZWRNYXRlcmlhbFRpbGVkTW9kZSIsIk1lc2hJbnN0YW5jZSIsImNhc3RTaGFkb3ciLCJyZWNlaXZlU2hhZG93IiwicHVzaCIsIl9hYWJiVmVyIiwiYXRsYXMiLCJ0ZXh0dXJlIiwiZGVsZXRlUGFyYW1ldGVyIiwiZnJhbWVEYXRhIiwiZnJhbWVzIiwiZnJhbWVLZXlzIiwiYm9yZGVyV2lkdGhTY2FsZSIsInJlY3QiLCJ6IiwiYm9yZGVySGVpZ2h0U2NhbGUiLCJ3Iiwic2V0IiwiYm9yZGVyIiwidGV4Iiwic2NhbGVYIiwic2NhbGVZIiwicG9zWCIsInBvc1kiLCJoIiwicGl2b3QiLCJzY2FsZU11bFgiLCJwaXhlbHNQZXJVbml0Iiwic2NhbGVNdWxZIiwiTWF0aCIsIm1heCIsIm1hdGgiLCJjbGFtcCIsInNldExvY2FsU2NhbGUiLCJzZXRMb2NhbFBvc2l0aW9uIiwiY2VudGVyIiwiaGFsZkV4dGVudHMiLCJzZXRGcm9tVHJhbnNmb3JtZWRBYWJiIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJjbGlwIiwicGxheSIsIm9sZENvbXAiLCJuZXdDb21wIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJpbmRleCIsImluZGV4T2YiLCJpZCIsInJlbW92ZU1vZGVsRnJvbUxheWVycyIsImRhdGEiLCJjdXJyZW50IiwiX3BsYXlpbmciLCJEZWJ1ZyIsIndhcm4iLCJwYXVzZSIsInJlc3VtZSIsImlzUGF1c2VkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQXFCQSxNQUFNQSxrQkFBa0IsR0FBRyxxQkFBcUIsQ0FBQTtBQUNoRCxNQUFNQyxpQkFBaUIsR0FBRyxvQkFBb0IsQ0FBQTtBQUM5QyxNQUFNQyxjQUFjLEdBQUcsbUJBQW1CLENBQUE7QUFDMUMsTUFBTUMsYUFBYSxHQUFHLGtCQUFrQixDQUFBO0FBQ3hDLE1BQU1DLGtCQUFrQixHQUFHLGFBQWEsQ0FBQTtBQUN4QyxNQUFN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
