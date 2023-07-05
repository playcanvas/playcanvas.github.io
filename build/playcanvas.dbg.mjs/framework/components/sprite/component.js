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
   * @type {import('../../../scene/sprite.js').Sprite}
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc3ByaXRlL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9XT1JMRCxcbiAgICBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQsIFNQUklURV9SRU5ERVJNT0RFX1RJTEVEXG59IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBTUFJJVEVUWVBFX1NJTVBMRSwgU1BSSVRFVFlQRV9BTklNQVRFRCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNwcml0ZUFuaW1hdGlvbkNsaXAgfSBmcm9tICcuL3Nwcml0ZS1hbmltYXRpb24tY2xpcC5qcyc7XG5cbmNvbnN0IFBBUkFNX0VNSVNTSVZFX01BUCA9ICd0ZXh0dXJlX2VtaXNzaXZlTWFwJztcbmNvbnN0IFBBUkFNX09QQUNJVFlfTUFQID0gJ3RleHR1cmVfb3BhY2l0eU1hcCc7XG5jb25zdCBQQVJBTV9FTUlTU0lWRSA9ICdtYXRlcmlhbF9lbWlzc2l2ZSc7XG5jb25zdCBQQVJBTV9PUEFDSVRZID0gJ21hdGVyaWFsX29wYWNpdHknO1xuY29uc3QgUEFSQU1fSU5ORVJfT0ZGU0VUID0gJ2lubmVyT2Zmc2V0JztcbmNvbnN0IFBBUkFNX09VVEVSX1NDQUxFID0gJ291dGVyU2NhbGUnO1xuY29uc3QgUEFSQU1fQVRMQVNfUkVDVCA9ICdhdGxhc1JlY3QnO1xuXG4vKipcbiAqIEVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciBhIHNpbXBsZSBzdGF0aWMgc3ByaXRlIG9yIHNwcml0ZSBhbmltYXRpb25zLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgU3ByaXRlQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU3ByaXRlQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuU3ByaXRlQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl90eXBlID0gU1BSSVRFVFlQRV9TSU1QTEU7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgdGhpcy5fY29sb3IgPSBuZXcgQ29sb3IoMSwgMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG4gICAgICAgIHRoaXMuX3NwZWVkID0gMTtcbiAgICAgICAgdGhpcy5fZmxpcFggPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZmxpcFkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fd2lkdGggPSAxO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSAxO1xuXG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IDA7XG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAgICAgLy8gOS1zbGljaW5nXG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUgPSBuZXcgVmVjMigxLCAxKTtcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZVVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB0aGlzLl9pbm5lck9mZnNldCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdCA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuXG4gICAgICAgIC8vIGJhdGNoIGdyb3Vwc1xuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSAtMTtcbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cCA9IG51bGw7XG5cbiAgICAgICAgLy8gbm9kZSAvIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgdGhpcy5fbm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwuZ3JhcGggPSB0aGlzLl9ub2RlO1xuICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICBlbnRpdHkuYWRkQ2hpbGQodGhpcy5fbW9kZWwuZ3JhcGgpO1xuICAgICAgICB0aGlzLl9tb2RlbC5fZW50aXR5ID0gZW50aXR5O1xuICAgICAgICB0aGlzLl91cGRhdGVBYWJiRnVuYyA9IHRoaXMuX3VwZGF0ZUFhYmIuYmluZCh0aGlzKTtcblxuICAgICAgICB0aGlzLl9hZGRlZE1vZGVsID0gZmFsc2U7XG5cbiAgICAgICAgLy8gYW5pbWF0ZWQgc3ByaXRlc1xuICAgICAgICB0aGlzLl9hdXRvUGxheUNsaXAgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaWN0aW9uYXJ5IG9mIHNwcml0ZSBhbmltYXRpb24gY2xpcHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBTcHJpdGVBbmltYXRpb25DbGlwPn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NsaXBzID0ge307XG5cbiAgICAgICAgLy8gY3JlYXRlIGRlZmF1bHQgY2xpcCBmb3Igc2ltcGxlIHNwcml0ZSB0eXBlXG4gICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwID0gbmV3IFNwcml0ZUFuaW1hdGlvbkNsaXAodGhpcywge1xuICAgICAgICAgICAgbmFtZTogdGhpcy5lbnRpdHkubmFtZSxcbiAgICAgICAgICAgIGZwczogMCxcbiAgICAgICAgICAgIGxvb3A6IGZhbHNlLFxuICAgICAgICAgICAgc3ByaXRlQXNzZXQ6IG51bGxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzcHJpdGUgYW5pbWF0aW9uIGNsaXAgY3VycmVudGx5IHBsYXlpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTcHJpdGVBbmltYXRpb25DbGlwfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSB0aGlzLl9kZWZhdWx0Q2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIHN0YXJ0cyBwbGF5aW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNwbGF5XG4gICAgICogQHBhcmFtIHtTcHJpdGVBbmltYXRpb25DbGlwfSBjbGlwIC0gVGhlIGNsaXAgdGhhdCBzdGFydGVkIHBsYXlpbmcuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjcGF1c2VcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IHdhcyBwYXVzZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHJlc3VtZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I3Jlc3VtZVxuICAgICAqIEBwYXJhbSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gY2xpcCAtIFRoZSBjbGlwIHRoYXQgd2FzIHJlc3VtZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFuaW1hdGlvbiBjbGlwIGlzIHN0b3BwZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU3ByaXRlQ29tcG9uZW50I3N0b3BcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IHdhcyBzdG9wcGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCBzdG9wcyBwbGF5aW5nIGJlY2F1c2UgaXQgcmVhY2hlZCBpdHMgZW5kaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNwcml0ZUNvbXBvbmVudCNlbmRcbiAgICAgKiBAcGFyYW0ge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IGNsaXAgLSBUaGUgY2xpcCB0aGF0IGVuZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhbmltYXRpb24gY2xpcCByZWFjaGVkIHRoZSBlbmQgb2YgaXRzIGN1cnJlbnQgbG9vcC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTcHJpdGVDb21wb25lbnQjbG9vcFxuICAgICAqIEBwYXJhbSB7U3ByaXRlQW5pbWF0aW9uQ2xpcH0gY2xpcCAtIFRoZSBjbGlwLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIFNwcml0ZUNvbXBvbmVudC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU1BSSVRFVFlQRV9TSU1QTEV9OiBUaGUgY29tcG9uZW50IHJlbmRlcnMgYSBzaW5nbGUgZnJhbWUgZnJvbSBhIHNwcml0ZSBhc3NldC5cbiAgICAgKiAtIHtAbGluayBTUFJJVEVUWVBFX0FOSU1BVEVEfTogVGhlIGNvbXBvbmVudCBjYW4gcGxheSBzcHJpdGUgYW5pbWF0aW9uIGNsaXBzLlxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFNQUklURVRZUEVfU0lNUExFfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IFNQUklURVRZUEVfU0lNUExFKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwID0gdGhpcy5fZGVmYXVsdENsaXA7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lID0gdGhpcy5mcmFtZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcC5zcHJpdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faGlkZU1vZGVsKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gU1BSSVRFVFlQRV9BTklNQVRFRCkge1xuICAgICAgICAgICAgdGhpcy5zdG9wKCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hdXRvUGxheUNsaXApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90cnlBdXRvUGxheSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgJiYgdGhpcy5fY3VycmVudENsaXAuaXNQbGF5aW5nICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGVNb2RlbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBmcmFtZSBjb3VudGVyIG9mIHRoZSBzcHJpdGUuIFNwZWNpZmllcyB3aGljaCBmcmFtZSBmcm9tIHRoZSBjdXJyZW50IHNwcml0ZSBhc3NldCB0b1xuICAgICAqIHJlbmRlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGZyYW1lKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2N1cnJlbnRDbGlwLmZyYW1lID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGZyYW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudENsaXAuZnJhbWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFzc2V0IGlkIG9yIHRoZSB7QGxpbmsgQXNzZXR9IG9mIHRoZSBzcHJpdGUgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICAgICAqIHtAbGluayBTUFJJVEVUWVBFX1NJTVBMRX0gc3ByaXRlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ8aW1wb3J0KCcuLi8uLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fVxuICAgICAqL1xuICAgIHNldCBzcHJpdGVBc3NldCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9kZWZhdWx0Q2xpcC5zcHJpdGVBc3NldCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBzcHJpdGVBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlZmF1bHRDbGlwLl9zcHJpdGVBc3NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBzcHJpdGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9zcHJpdGUuanMnKS5TcHJpdGV9XG4gICAgICovXG4gICAgc2V0IHNwcml0ZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jdXJyZW50Q2xpcC5zcHJpdGUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgc3ByaXRlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudENsaXAuc3ByaXRlO1xuICAgIH1cblxuICAgIC8vIChwcml2YXRlKSB7cGMuTWF0ZXJpYWx9IG1hdGVyaWFsIFRoZSBtYXRlcmlhbCB1c2VkIHRvIHJlbmRlciBhIHNwcml0ZS5cbiAgICBzZXQgbWF0ZXJpYWwodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sb3IgdGludCBvZiB0aGUgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge0NvbG9yfVxuICAgICAqL1xuICAgIHNldCBjb2xvcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jb2xvci5yID0gdmFsdWUucjtcbiAgICAgICAgdGhpcy5fY29sb3IuZyA9IHZhbHVlLmc7XG4gICAgICAgIHRoaXMuX2NvbG9yLmIgPSB2YWx1ZS5iO1xuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9jb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fRU1JU1NJVkUsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgb3BhY2l0eSBvZiB0aGUgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgb3BhY2l0eSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jb2xvci5hID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fT1BBQ0lUWSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG9wYWNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvci5hO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZGljdGlvbmFyeSB0aGF0IGNvbnRhaW5zIHtAbGluayBTcHJpdGVBbmltYXRpb25DbGlwfXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgU3ByaXRlQW5pbWF0aW9uQ2xpcD59XG4gICAgICovXG4gICAgc2V0IGNsaXBzKHZhbHVlKSB7XG4gICAgICAgIC8vIGlmIHZhbHVlIGlzIG51bGwgcmVtb3ZlIGFsbCBjbGlwc1xuICAgICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gdGhpcy5fY2xpcHMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUNsaXAobmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZW1vdmUgZXhpc3RpbmcgY2xpcHMgbm90IGluIG5ldyB2YWx1ZVxuICAgICAgICAvLyBhbmQgdXBkYXRlIGNsaXBzIGluIGJvdGggb2JqZWN0c1xuICAgICAgICBmb3IgKGNvbnN0IG5hbWUgaW4gdGhpcy5fY2xpcHMpIHtcbiAgICAgICAgICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWVba2V5XS5uYW1lID09PSBuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpcHNbbmFtZV0uZnBzID0gdmFsdWVba2V5XS5mcHM7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NsaXBzW25hbWVdLmxvb3AgPSB2YWx1ZVtrZXldLmxvb3A7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlW2tleV0uaGFzT3duUHJvcGVydHkoJ3Nwcml0ZScpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlwc1tuYW1lXS5zcHJpdGUgPSB2YWx1ZVtrZXldLnNwcml0ZTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZVtrZXldLmhhc093blByb3BlcnR5KCdzcHJpdGVBc3NldCcpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlwc1tuYW1lXS5zcHJpdGVBc3NldCA9IHZhbHVlW2tleV0uc3ByaXRlQXNzZXQ7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghZm91bmQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUNsaXAobmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGQgY2xpcHMgdGhhdCBkbyBub3QgZXhpc3RcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jbGlwc1t2YWx1ZVtrZXldLm5hbWVdKSBjb250aW51ZTtcblxuICAgICAgICAgICAgdGhpcy5hZGRDbGlwKHZhbHVlW2tleV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYXV0byBwbGF5IGNsaXBcbiAgICAgICAgaWYgKHRoaXMuX2F1dG9QbGF5Q2xpcCkge1xuICAgICAgICAgICAgdGhpcy5fdHJ5QXV0b1BsYXkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBjdXJyZW50IGNsaXAgZG9lc24ndCBoYXZlIGEgc3ByaXRlIHRoZW4gaGlkZSB0aGUgbW9kZWxcbiAgICAgICAgaWYgKCF0aGlzLl9jdXJyZW50Q2xpcCB8fCAhdGhpcy5fY3VycmVudENsaXAuc3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjbGlwcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGNsaXAgYmVpbmcgcGxheWVkLlxuICAgICAqXG4gICAgICogQHR5cGUge1Nwcml0ZUFuaW1hdGlvbkNsaXB9XG4gICAgICovXG4gICAgZ2V0IGN1cnJlbnRDbGlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VycmVudENsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBnbG9iYWwgc3BlZWQgbW9kaWZpZXIgdXNlZCB3aGVuIHBsYXlpbmcgc3ByaXRlIGFuaW1hdGlvbiBjbGlwcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNwZWVkKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NwZWVkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHNwZWVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3BlZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmxpcCB0aGUgWCBheGlzIHdoZW4gcmVuZGVyaW5nIGEgc3ByaXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZsaXBYKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mbGlwWCA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mbGlwWCA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICBnZXQgZmxpcFgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwWDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGbGlwIHRoZSBZIGF4aXMgd2hlbiByZW5kZXJpbmcgYSBzcHJpdGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZmxpcFkodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZsaXBZID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2ZsaXBZID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVRyYW5zZm9ybSgpO1xuICAgIH1cblxuICAgIGdldCBmbGlwWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZsaXBZO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgc3ByaXRlIHdoZW4gcmVuZGVyaW5nIHVzaW5nIDktU2xpY2luZy4gVGhlIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG9ubHkgdXNlZFxuICAgICAqIHdoZW4gdGhlIHJlbmRlciBtb2RlIG9mIHRoZSBzcHJpdGUgYXNzZXQgaXMgU2xpY2VkIG9yIFRpbGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgd2lkdGgodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB0aGlzLl93aWR0aCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX291dGVyU2NhbGUueCA9IHRoaXMuX3dpZHRoO1xuXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZSAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQgfHwgdGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEKSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVHJhbnNmb3JtKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSBzcHJpdGUgd2hlbiByZW5kZXJpbmcgdXNpbmcgOS1TbGljaW5nLiBUaGUgd2lkdGggYW5kIGhlaWdodCBhcmUgb25seSB1c2VkXG4gICAgICogd2hlbiB0aGUgcmVuZGVyIG1vZGUgb2YgdGhlIHNwcml0ZSBhc3NldCBpcyBTbGljZWQgb3IgVGlsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBoZWlnaHQodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB0aGlzLl9oZWlnaHQpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9oZWlnaHQgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS55ID0gdGhpcy5oZWlnaHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlICYmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIHNwcml0ZSB0byBhIHNwZWNpZmljIGJhdGNoIGdyb3VwIChzZWUge0BsaW5rIEJhdGNoR3JvdXB9KS4gRGVmYXVsdCBpcyAtMSAobm8gZ3JvdXApLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYmF0Y2hHcm91cElkKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHByZXYgPSB0aGlzLl9iYXRjaEdyb3VwSWQ7XG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBJZCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHByZXYgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLlNQUklURSwgcHJldiwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHZhbHVlID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5TUFJJVEUsIHZhbHVlLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyByZS1hZGQgbW9kZWwgdG8gc2NlbmUgaW4gY2FzZSBpdCB3YXMgcmVtb3ZlZCBieSBiYXRjaGluZ1xuICAgICAgICAgICAgaWYgKHByZXYgPj0gMCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCAmJiB0aGlzLl9jdXJyZW50Q2xpcC5zcHJpdGUgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hvd01vZGVsKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGJhdGNoR3JvdXBJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoR3JvdXBJZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbmFtZSBvZiB0aGUgY2xpcCB0byBwbGF5IGF1dG9tYXRpY2FsbHkgd2hlbiB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWQgYW5kIHRoZSBjbGlwIGV4aXN0cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IGF1dG9QbGF5Q2xpcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hdXRvUGxheUNsaXAgPSB2YWx1ZSBpbnN0YW5jZW9mIFNwcml0ZUFuaW1hdGlvbkNsaXAgPyB2YWx1ZS5uYW1lIDogdmFsdWU7XG4gICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9QbGF5Q2xpcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F1dG9QbGF5Q2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZHJhdyBvcmRlciBvZiB0aGUgY29tcG9uZW50LiBBIGhpZ2hlciB2YWx1ZSBtZWFucyB0aGF0IHRoZSBjb21wb25lbnQgd2lsbCBiZSByZW5kZXJlZCBvblxuICAgICAqIHRvcCBvZiBvdGhlciBjb21wb25lbnRzIGluIHRoZSBzYW1lIGxheWVyLiBUaGlzIGlzIG5vdCB1c2VkIHVubGVzcyB0aGUgbGF5ZXIncyBzb3J0IG9yZGVyIGlzXG4gICAgICogc2V0IHRvIHtAbGluayBTT1JUTU9ERV9NQU5VQUx9LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgZHJhd09yZGVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZHJhd09yZGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZHJhd09yZGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhpcyBzcHJpdGUgc2hvdWxkIGJlbG9uZy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgbGF5ZXJzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9hZGRlZE1vZGVsKSB7XG4gICAgICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xheWVycyA9IHZhbHVlO1xuXG4gICAgICAgIC8vIGVhcmx5IG91dFxuICAgICAgICBpZiAoIXRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9zaG93TW9kZWwoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgZ2V0IGFhYmIoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9tZXNoSW5zdGFuY2UuYWFiYjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gYXBwLnNjZW5lO1xuXG4gICAgICAgIHNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgdGhpcy5fb25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLl9vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLl9vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zaG93TW9kZWwoKTtcbiAgICAgICAgaWYgKHRoaXMuX2F1dG9QbGF5Q2xpcClcbiAgICAgICAgICAgIHRoaXMuX3RyeUF1dG9QbGF5KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuU1BSSVRFLCB0aGlzLl9iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLl9vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAoc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub2ZmKCdhZGQnLCB0aGlzLl9vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5fb25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zdG9wKCk7XG4gICAgICAgIHRoaXMuX2hpZGVNb2RlbCgpO1xuXG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuU1BSSVRFLCB0aGlzLl9iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLl9kZWZhdWx0Q2xpcCkge1xuICAgICAgICAgICAgdGhpcy5fZGVmYXVsdENsaXAuX2Rlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX2RlZmF1bHRDbGlwID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl9jbGlwcykge1xuICAgICAgICAgICAgdGhpcy5fY2xpcHNba2V5XS5fZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NsaXBzID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9oaWRlTW9kZWwoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLl9ub2RlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbm9kZS5wYXJlbnQpXG4gICAgICAgICAgICAgICAgdGhpcy5fbm9kZS5wYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5fbm9kZSk7XG4gICAgICAgICAgICB0aGlzLl9ub2RlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB3ZSBkZWNyZWFzZSB0aGUgcmVmIGNvdW50cyBtYXRlcmlhbHMgYW5kIG1lc2hlc1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tZXNoID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2hvd01vZGVsKCkge1xuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbCkgcmV0dXJuO1xuICAgICAgICBpZiAoIXRoaXMuX21lc2hJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBbdGhpcy5fbWVzaEluc3RhbmNlXTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKG1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYWRkZWRNb2RlbCA9IHRydWU7XG4gICAgfVxuXG4gICAgX2hpZGVNb2RlbCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hZGRlZE1vZGVsIHx8ICF0aGlzLl9tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gW3RoaXMuX21lc2hJbnN0YW5jZV07XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2xheWVycy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhtZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWwgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBTZXQgdGhlIGRlc2lyZWQgbWVzaCBvbiB0aGUgbWVzaCBpbnN0YW5jZVxuICAgIF9zaG93RnJhbWUoZnJhbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLnNwcml0ZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1lc2ggPSB0aGlzLnNwcml0ZS5tZXNoZXNbZnJhbWVdO1xuICAgICAgICAvLyBpZiBtZXNoIGlzIG51bGwgdGhlbiBoaWRlIHRoZSBtZXNoIGluc3RhbmNlXG4gICAgICAgIGlmICghbWVzaCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tZXNoID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UudmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbWF0ZXJpYWw7XG4gICAgICAgIGlmICh0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdDlTbGljZWRNYXRlcmlhbFNsaWNlZE1vZGU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdDlTbGljZWRNYXRlcmlhbFRpbGVkTW9kZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIG1lc2ggaW5zdGFuY2UgaWYgaXQgZG9lc24ndCBleGlzdCB5ZXRcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaCwgdGhpcy5fbWF0ZXJpYWwsIHRoaXMuX25vZGUpO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLmNhc3RTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5yZWNlaXZlU2hhZG93ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuZHJhd09yZGVyID0gdGhpcy5fZHJhd09yZGVyO1xuICAgICAgICAgICAgdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcy5wdXNoKHRoaXMuX21lc2hJbnN0YW5jZSk7XG5cbiAgICAgICAgICAgIC8vIHNldCBvdmVycmlkZXMgb24gbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzBdID0gdGhpcy5fY29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsxXSA9IHRoaXMuX2NvbG9yLmc7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9jb2xvci5iO1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9FTUlTU0lWRSwgdGhpcy5fY29sb3JVbmlmb3JtKTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fT1BBQ0lUWSwgdGhpcy5fY29sb3IuYSk7XG5cbiAgICAgICAgICAgIC8vIG5vdyB0aGF0IHdlIGNyZWF0ZWQgdGhlIG1lc2ggaW5zdGFuY2UsIGFkZCB0aGUgbW9kZWwgdG8gdGhlIHNjZW5lXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zaG93TW9kZWwoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVwZGF0ZSBtYXRlcmlhbFxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlLm1hdGVyaWFsICE9PSBtYXRlcmlhbCkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgbWVzaFxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlLm1lc2ggIT09IG1lc2gpIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5tZXNoID0gbWVzaDtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIC8vIHJlc2V0IGFhYmJcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5fYWFiYlZlciA9IC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IHRleHR1cmUgcGFyYW1zXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZS5hdGxhcyAmJiB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0VNSVNTSVZFX01BUCwgdGhpcy5zcHJpdGUuYXRsYXMudGV4dHVyZSk7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX09QQUNJVFlfTUFQLCB0aGlzLnNwcml0ZS5hdGxhcy50ZXh0dXJlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIG5vIHRleHR1cmUgc28gcmVzZXQgdGV4dHVyZSBwYXJhbXNcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIoUEFSQU1fRU1JU1NJVkVfTUFQKTtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5kZWxldGVQYXJhbWV0ZXIoUEFSQU1fT1BBQ0lUWV9NQVApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yIDktc2xpY2VkXG4gICAgICAgIGlmICh0aGlzLnNwcml0ZS5hdGxhcyAmJiAodGhpcy5zcHJpdGUucmVuZGVyTW9kZSA9PT0gU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIHx8IHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEKSkge1xuICAgICAgICAgICAgLy8gc2V0IGN1c3RvbSBhYWJiIGZ1bmN0aW9uXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2UuX3VwZGF0ZUFhYmJGdW5jID0gdGhpcy5fdXBkYXRlQWFiYkZ1bmM7XG5cbiAgICAgICAgICAgIC8vIGNhbGN1bGF0ZSBpbm5lciBvZmZzZXRcbiAgICAgICAgICAgIGNvbnN0IGZyYW1lRGF0YSA9IHRoaXMuc3ByaXRlLmF0bGFzLmZyYW1lc1t0aGlzLnNwcml0ZS5mcmFtZUtleXNbZnJhbWVdXTtcbiAgICAgICAgICAgIGlmIChmcmFtZURhdGEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBib3JkZXJXaWR0aFNjYWxlID0gMiAvIGZyYW1lRGF0YS5yZWN0Lno7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9yZGVySGVpZ2h0U2NhbGUgPSAyIC8gZnJhbWVEYXRhLnJlY3QudztcblxuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0LnNldChcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci54ICogYm9yZGVyV2lkdGhTY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLmJvcmRlci55ICogYm9yZGVySGVpZ2h0U2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIueiAqIGJvcmRlcldpZHRoU2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIGZyYW1lRGF0YS5ib3JkZXIudyAqIGJvcmRlckhlaWdodFNjYWxlXG4gICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHRleCA9IHRoaXMuc3ByaXRlLmF0bGFzLnRleHR1cmU7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXRsYXNSZWN0LnNldChmcmFtZURhdGEucmVjdC54IC8gdGV4LndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QueSAvIHRleC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFtZURhdGEucmVjdC56IC8gdGV4LndpZHRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJhbWVEYXRhLnJlY3QudyAvIHRleC5oZWlnaHRcbiAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0LnNldCgwLCAwLCAwLCAwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IGlubmVyIG9mZnNldCBhbmQgYXRsYXMgcmVjdCBvbiBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bMF0gPSB0aGlzLl9pbm5lck9mZnNldC54O1xuICAgICAgICAgICAgdGhpcy5faW5uZXJPZmZzZXRVbmlmb3JtWzFdID0gdGhpcy5faW5uZXJPZmZzZXQueTtcbiAgICAgICAgICAgIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybVsyXSA9IHRoaXMuX2lubmVyT2Zmc2V0Lno7XG4gICAgICAgICAgICB0aGlzLl9pbm5lck9mZnNldFVuaWZvcm1bM10gPSB0aGlzLl9pbm5lck9mZnNldC53O1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLnNldFBhcmFtZXRlcihQQVJBTV9JTk5FUl9PRkZTRVQsIHRoaXMuX2lubmVyT2Zmc2V0VW5pZm9ybSk7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzBdID0gdGhpcy5fYXRsYXNSZWN0Lng7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzFdID0gdGhpcy5fYXRsYXNSZWN0Lnk7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzJdID0gdGhpcy5fYXRsYXNSZWN0Lno7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1JlY3RVbmlmb3JtWzNdID0gdGhpcy5fYXRsYXNSZWN0Lnc7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2Uuc2V0UGFyYW1ldGVyKFBBUkFNX0FUTEFTX1JFQ1QsIHRoaXMuX2F0bGFzUmVjdFVuaWZvcm0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlLl91cGRhdGVBYWJiRnVuYyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91cGRhdGVUcmFuc2Zvcm0oKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlVHJhbnNmb3JtKCkge1xuICAgICAgICAvLyBmbGlwXG4gICAgICAgIGxldCBzY2FsZVggPSB0aGlzLmZsaXBYID8gLTEgOiAxO1xuICAgICAgICBsZXQgc2NhbGVZID0gdGhpcy5mbGlwWSA/IC0xIDogMTtcblxuICAgICAgICAvLyBwaXZvdFxuICAgICAgICBsZXQgcG9zWCA9IDA7XG4gICAgICAgIGxldCBwb3NZID0gMDtcblxuICAgICAgICBpZiAodGhpcy5zcHJpdGUgJiYgKHRoaXMuc3ByaXRlLnJlbmRlck1vZGUgPT09IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRCB8fCB0aGlzLnNwcml0ZS5yZW5kZXJNb2RlID09PSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCkpIHtcblxuICAgICAgICAgICAgbGV0IHcgPSAxO1xuICAgICAgICAgICAgbGV0IGggPSAxO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5zcHJpdGUuYXRsYXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmcmFtZURhdGEgPSB0aGlzLnNwcml0ZS5hdGxhcy5mcmFtZXNbdGhpcy5zcHJpdGUuZnJhbWVLZXlzW3RoaXMuZnJhbWVdXTtcbiAgICAgICAgICAgICAgICBpZiAoZnJhbWVEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGdldCBmcmFtZSBkaW1lbnNpb25zXG4gICAgICAgICAgICAgICAgICAgIHcgPSBmcmFtZURhdGEucmVjdC56O1xuICAgICAgICAgICAgICAgICAgICBoID0gZnJhbWVEYXRhLnJlY3QudztcblxuICAgICAgICAgICAgICAgICAgICAvLyB1cGRhdGUgcGl2b3RcbiAgICAgICAgICAgICAgICAgICAgcG9zWCA9ICgwLjUgLSBmcmFtZURhdGEucGl2b3QueCkgKiB0aGlzLl93aWR0aDtcbiAgICAgICAgICAgICAgICAgICAgcG9zWSA9ICgwLjUgLSBmcmFtZURhdGEucGl2b3QueSkgKiB0aGlzLl9oZWlnaHQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzY2FsZTogYXBwbHkgUFBVXG4gICAgICAgICAgICBjb25zdCBzY2FsZU11bFggPSB3IC8gdGhpcy5zcHJpdGUucGl4ZWxzUGVyVW5pdDtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlTXVsWSA9IGggLyB0aGlzLnNwcml0ZS5waXhlbHNQZXJVbml0O1xuXG4gICAgICAgICAgICAvLyBzY2FsZSBib3JkZXJzIGlmIG5lY2Vzc2FyeSBpbnN0ZWFkIG9mIG92ZXJsYXBwaW5nXG4gICAgICAgICAgICB0aGlzLl9vdXRlclNjYWxlLnNldChNYXRoLm1heCh0aGlzLl93aWR0aCwgdGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIE1hdGgubWF4KHRoaXMuX2hlaWdodCwgdGhpcy5faW5uZXJPZmZzZXQueSAqIHNjYWxlTXVsWSkpO1xuXG4gICAgICAgICAgICBzY2FsZVggKj0gc2NhbGVNdWxYO1xuICAgICAgICAgICAgc2NhbGVZICo9IHNjYWxlTXVsWTtcblxuICAgICAgICAgICAgdGhpcy5fb3V0ZXJTY2FsZS54IC89IHNjYWxlTXVsWDtcbiAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGUueSAvPSBzY2FsZU11bFk7XG5cbiAgICAgICAgICAgIC8vIHNjYWxlOiBzaHJpbmtpbmcgYmVsb3cgMVxuICAgICAgICAgICAgc2NhbGVYICo9IG1hdGguY2xhbXAodGhpcy5fd2lkdGggLyAodGhpcy5faW5uZXJPZmZzZXQueCAqIHNjYWxlTXVsWCksIDAuMDAwMSwgMSk7XG4gICAgICAgICAgICBzY2FsZVkgKj0gbWF0aC5jbGFtcCh0aGlzLl9oZWlnaHQgLyAodGhpcy5faW5uZXJPZmZzZXQueSAqIHNjYWxlTXVsWSksIDAuMDAwMSwgMSk7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBvdXRlciBzY2FsZVxuICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtWzBdID0gdGhpcy5fb3V0ZXJTY2FsZS54O1xuICAgICAgICAgICAgICAgIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtWzFdID0gdGhpcy5fb3V0ZXJTY2FsZS55O1xuICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZS5zZXRQYXJhbWV0ZXIoUEFSQU1fT1VURVJfU0NBTEUsIHRoaXMuX291dGVyU2NhbGVVbmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNjYWxlXG4gICAgICAgIHRoaXMuX25vZGUuc2V0TG9jYWxTY2FsZShzY2FsZVgsIHNjYWxlWSwgMSk7XG4gICAgICAgIC8vIHBpdm90XG4gICAgICAgIHRoaXMuX25vZGUuc2V0TG9jYWxQb3NpdGlvbihwb3NYLCBwb3NZLCAwKTtcbiAgICB9XG5cbiAgICAvLyB1cGRhdGVzIEFBQkIgd2hpbGUgOS1zbGljaW5nXG4gICAgX3VwZGF0ZUFhYmIoYWFiYikge1xuICAgICAgICAvLyBwaXZvdFxuICAgICAgICBhYWJiLmNlbnRlci5zZXQoMCwgMCwgMCk7XG4gICAgICAgIC8vIHNpemVcbiAgICAgICAgYWFiYi5oYWxmRXh0ZW50cy5zZXQodGhpcy5fb3V0ZXJTY2FsZS54ICogMC41LCB0aGlzLl9vdXRlclNjYWxlLnkgKiAwLjUsIDAuMDAxKTtcbiAgICAgICAgLy8gd29ybGQgdHJhbnNmb3JtXG4gICAgICAgIGFhYmIuc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihhYWJiLCB0aGlzLl9ub2RlLmdldFdvcmxkVHJhbnNmb3JtKCkpO1xuICAgICAgICByZXR1cm4gYWFiYjtcbiAgICB9XG5cbiAgICBfdHJ5QXV0b1BsYXkoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXV0b1BsYXlDbGlwKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLnR5cGUgIT09IFNQUklURVRZUEVfQU5JTUFURUQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBjbGlwID0gdGhpcy5fY2xpcHNbdGhpcy5fYXV0b1BsYXlDbGlwXTtcbiAgICAgICAgLy8gaWYgdGhlIGNsaXAgZXhpc3RzIGFuZCBub3RoaW5nIGVsc2UgaXMgcGxheWluZyBwbGF5IGl0XG4gICAgICAgIGlmIChjbGlwICYmICFjbGlwLmlzUGxheWluZyAmJiAoIXRoaXMuX2N1cnJlbnRDbGlwIHx8ICF0aGlzLl9jdXJyZW50Q2xpcC5pc1BsYXlpbmcpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBsYXkoY2xpcC5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9zaG93TW9kZWwoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9hZGRlZE1vZGVsICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkICYmIHRoaXMuX21lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhbdGhpcy5fbWVzaEluc3RhbmNlXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25MYXllclJlbW92ZWQobGF5ZXIpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5zdGFuY2UpIHJldHVybjtcblxuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMoW3RoaXMuX21lc2hJbnN0YW5jZV0pO1xuICAgIH1cblxuICAgIHJlbW92ZU1vZGVsRnJvbUxheWVycygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMoW3RoaXMuX21lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbmQgYWRkcyBhIG5ldyB7QGxpbmsgU3ByaXRlQW5pbWF0aW9uQ2xpcH0gdG8gdGhlIGNvbXBvbmVudCdzIGNsaXBzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBEYXRhIGZvciB0aGUgbmV3IGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGF0YS5uYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBuZXcgYW5pbWF0aW9uIGNsaXAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtkYXRhLmZwc10gLSBGcmFtZXMgcGVyIHNlY29uZCBmb3IgdGhlIGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RhdGEubG9vcF0gLSBXaGV0aGVyIHRvIGxvb3AgdGhlIGFuaW1hdGlvbiBjbGlwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfGltcG9ydCgnLi4vLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH0gW2RhdGEuc3ByaXRlQXNzZXRdIC0gVGhlIGFzc2V0IGlkIG9yXG4gICAgICogdGhlIHtAbGluayBBc3NldH0gb2YgdGhlIHNwcml0ZSB0aGF0IHRoaXMgY2xpcCB3aWxsIHBsYXkuXG4gICAgICogQHJldHVybnMge1Nwcml0ZUFuaW1hdGlvbkNsaXB9IFRoZSBuZXcgY2xpcCB0aGF0IHdhcyBhZGRlZC5cbiAgICAgKi9cbiAgICBhZGRDbGlwKGRhdGEpIHtcbiAgICAgICAgY29uc3QgY2xpcCA9IG5ldyBTcHJpdGVBbmltYXRpb25DbGlwKHRoaXMsIHtcbiAgICAgICAgICAgIG5hbWU6IGRhdGEubmFtZSxcbiAgICAgICAgICAgIGZwczogZGF0YS5mcHMsXG4gICAgICAgICAgICBsb29wOiBkYXRhLmxvb3AsXG4gICAgICAgICAgICBzcHJpdGVBc3NldDogZGF0YS5zcHJpdGVBc3NldFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl9jbGlwc1tkYXRhLm5hbWVdID0gY2xpcDtcblxuICAgICAgICBpZiAoY2xpcC5uYW1lICYmIGNsaXAubmFtZSA9PT0gdGhpcy5fYXV0b1BsYXlDbGlwKVxuICAgICAgICAgICAgdGhpcy5fdHJ5QXV0b1BsYXkoKTtcblxuICAgICAgICByZXR1cm4gY2xpcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGEgY2xpcCBieSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgYW5pbWF0aW9uIGNsaXAgdG8gcmVtb3ZlLlxuICAgICAqL1xuICAgIHJlbW92ZUNsaXAobmFtZSkge1xuICAgICAgICBkZWxldGUgdGhpcy5fY2xpcHNbbmFtZV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGFuIGFuaW1hdGlvbiBjbGlwIGJ5IG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBjbGlwLlxuICAgICAqIEByZXR1cm5zIHtTcHJpdGVBbmltYXRpb25DbGlwfSBUaGUgY2xpcC5cbiAgICAgKi9cbiAgICBjbGlwKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsaXBzW25hbWVdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBsYXlzIGEgc3ByaXRlIGFuaW1hdGlvbiBjbGlwIGJ5IG5hbWUuIElmIHRoZSBhbmltYXRpb24gY2xpcCBpcyBhbHJlYWR5IHBsYXlpbmcgdGhlbiB0aGlzXG4gICAgICogd2lsbCBkbyBub3RoaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgY2xpcCB0byBwbGF5LlxuICAgICAqIEByZXR1cm5zIHtTcHJpdGVBbmltYXRpb25DbGlwfSBUaGUgY2xpcCB0aGF0IHN0YXJ0ZWQgcGxheWluZy5cbiAgICAgKi9cbiAgICBwbGF5KG5hbWUpIHtcbiAgICAgICAgY29uc3QgY2xpcCA9IHRoaXMuX2NsaXBzW25hbWVdO1xuXG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9jdXJyZW50Q2xpcDtcbiAgICAgICAgaWYgKGN1cnJlbnQgJiYgY3VycmVudCAhPT0gY2xpcCkge1xuICAgICAgICAgICAgY3VycmVudC5fcGxheWluZyA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSBjbGlwO1xuXG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcCkge1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudENsaXAgPSBjbGlwO1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudENsaXAucGxheSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgRGVidWcud2FybihgVHJ5aW5nIHRvIHBsYXkgc3ByaXRlIGFuaW1hdGlvbiAke25hbWV9IHdoaWNoIGRvZXMgbm90IGV4aXN0LmApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNsaXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGF1c2VzIHRoZSBjdXJyZW50IGFuaW1hdGlvbiBjbGlwLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgPT09IHRoaXMuX2RlZmF1bHRDbGlwKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwLmlzUGxheWluZykge1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudENsaXAucGF1c2UoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3VtZXMgdGhlIGN1cnJlbnQgcGF1c2VkIGFuaW1hdGlvbiBjbGlwLlxuICAgICAqL1xuICAgIHJlc3VtZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2N1cnJlbnRDbGlwID09PSB0aGlzLl9kZWZhdWx0Q2xpcCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9jdXJyZW50Q2xpcC5pc1BhdXNlZCkge1xuICAgICAgICAgICAgdGhpcy5fY3VycmVudENsaXAucmVzdW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wcyB0aGUgY3VycmVudCBhbmltYXRpb24gY2xpcCBhbmQgcmVzZXRzIGl0IHRvIHRoZSBmaXJzdCBmcmFtZS5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5fY3VycmVudENsaXAgPT09IHRoaXMuX2RlZmF1bHRDbGlwKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY3VycmVudENsaXAuc3RvcCgpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU3ByaXRlQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiUEFSQU1fRU1JU1NJVkVfTUFQIiwiUEFSQU1fT1BBQ0lUWV9NQVAiLCJQQVJBTV9FTUlTU0lWRSIsIlBBUkFNX09QQUNJVFkiLCJQQVJBTV9JTk5FUl9PRkZTRVQiLCJQQVJBTV9PVVRFUl9TQ0FMRSIsIlBBUkFNX0FUTEFTX1JFQ1QiLCJTcHJpdGVDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl90eXBlIiwiU1BSSVRFVFlQRV9TSU1QTEUiLCJfbWF0ZXJpYWwiLCJkZWZhdWx0TWF0ZXJpYWwiLCJfY29sb3IiLCJDb2xvciIsIl9jb2xvclVuaWZvcm0iLCJGbG9hdDMyQXJyYXkiLCJfc3BlZWQiLCJfZmxpcFgiLCJfZmxpcFkiLCJfd2lkdGgiLCJfaGVpZ2h0IiwiX2RyYXdPcmRlciIsIl9sYXllcnMiLCJMQVlFUklEX1dPUkxEIiwiX291dGVyU2NhbGUiLCJWZWMyIiwiX291dGVyU2NhbGVVbmlmb3JtIiwiX2lubmVyT2Zmc2V0IiwiVmVjNCIsIl9pbm5lck9mZnNldFVuaWZvcm0iLCJfYXRsYXNSZWN0IiwiX2F0bGFzUmVjdFVuaWZvcm0iLCJfYmF0Y2hHcm91cElkIiwiX2JhdGNoR3JvdXAiLCJfbm9kZSIsIkdyYXBoTm9kZSIsIl9tb2RlbCIsIk1vZGVsIiwiZ3JhcGgiLCJfbWVzaEluc3RhbmNlIiwiYWRkQ2hpbGQiLCJfZW50aXR5IiwiX3VwZGF0ZUFhYmJGdW5jIiwiX3VwZGF0ZUFhYmIiLCJiaW5kIiwiX2FkZGVkTW9kZWwiLCJfYXV0b1BsYXlDbGlwIiwiX2NsaXBzIiwiX2RlZmF1bHRDbGlwIiwiU3ByaXRlQW5pbWF0aW9uQ2xpcCIsIm5hbWUiLCJmcHMiLCJsb29wIiwic3ByaXRlQXNzZXQiLCJfY3VycmVudENsaXAiLCJ0eXBlIiwidmFsdWUiLCJzdG9wIiwiZW5hYmxlZCIsImZyYW1lIiwic3ByaXRlIiwiX3Nob3dNb2RlbCIsIl9oaWRlTW9kZWwiLCJTUFJJVEVUWVBFX0FOSU1BVEVEIiwiX3RyeUF1dG9QbGF5IiwiaXNQbGF5aW5nIiwiX3Nwcml0ZUFzc2V0IiwibWF0ZXJpYWwiLCJjb2xvciIsInIiLCJnIiwiYiIsInNldFBhcmFtZXRlciIsIm9wYWNpdHkiLCJhIiwiY2xpcHMiLCJyZW1vdmVDbGlwIiwiZm91bmQiLCJrZXkiLCJoYXNPd25Qcm9wZXJ0eSIsImFkZENsaXAiLCJjdXJyZW50Q2xpcCIsInNwZWVkIiwiZmxpcFgiLCJfdXBkYXRlVHJhbnNmb3JtIiwiZmxpcFkiLCJ3aWR0aCIsIngiLCJyZW5kZXJNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfVElMRUQiLCJTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQiLCJoZWlnaHQiLCJ5IiwiYmF0Y2hHcm91cElkIiwicHJldiIsIl90aGlzJHN5c3RlbSRhcHAkYmF0YyIsImFwcCIsImJhdGNoZXIiLCJyZW1vdmUiLCJCYXRjaEdyb3VwIiwiU1BSSVRFIiwiX3RoaXMkc3lzdGVtJGFwcCRiYXRjMiIsImluc2VydCIsImF1dG9QbGF5Q2xpcCIsImRyYXdPcmRlciIsImxheWVycyIsImFhYmIiLCJvbkVuYWJsZSIsInNjZW5lIiwib24iLCJfb25MYXllcnNDaGFuZ2VkIiwiX29uTGF5ZXJBZGRlZCIsIl9vbkxheWVyUmVtb3ZlZCIsIl9hcHAkYmF0Y2hlciIsIm9uRGlzYWJsZSIsIm9mZiIsIl9hcHAkYmF0Y2hlcjIiLCJvbkRlc3Ryb3kiLCJfZGVzdHJveSIsInBhcmVudCIsInJlbW92ZUNoaWxkIiwibWVzaCIsIm1lc2hJbnN0YW5jZXMiLCJpIiwibGVuIiwibGVuZ3RoIiwibGF5ZXIiLCJnZXRMYXllckJ5SWQiLCJhZGRNZXNoSW5zdGFuY2VzIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIl9zaG93RnJhbWUiLCJtZXNoZXMiLCJ2aXNpYmxlIiwiZGVmYXVsdDlTbGljZWRNYXRlcmlhbFNsaWNlZE1vZGUiLCJkZWZhdWx0OVNsaWNlZE1hdGVyaWFsVGlsZWRNb2RlIiwiTWVzaEluc3RhbmNlIiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJwdXNoIiwiX2FhYmJWZXIiLCJhdGxhcyIsInRleHR1cmUiLCJkZWxldGVQYXJhbWV0ZXIiLCJmcmFtZURhdGEiLCJmcmFtZXMiLCJmcmFtZUtleXMiLCJib3JkZXJXaWR0aFNjYWxlIiwicmVjdCIsInoiLCJib3JkZXJIZWlnaHRTY2FsZSIsInciLCJzZXQiLCJib3JkZXIiLCJ0ZXgiLCJzY2FsZVgiLCJzY2FsZVkiLCJwb3NYIiwicG9zWSIsImgiLCJwaXZvdCIsInNjYWxlTXVsWCIsInBpeGVsc1BlclVuaXQiLCJzY2FsZU11bFkiLCJNYXRoIiwibWF4IiwibWF0aCIsImNsYW1wIiwic2V0TG9jYWxTY2FsZSIsInNldExvY2FsUG9zaXRpb24iLCJjZW50ZXIiLCJoYWxmRXh0ZW50cyIsInNldEZyb21UcmFuc2Zvcm1lZEFhYmIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImNsaXAiLCJwbGF5Iiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsImluZGV4IiwiaW5kZXhPZiIsImlkIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwiZGF0YSIsImN1cnJlbnQiLCJfcGxheWluZyIsIkRlYnVnIiwid2FybiIsInBhdXNlIiwicmVzdW1lIiwiaXNQYXVzZWQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7O0FBcUJBLE1BQU1BLGtCQUFrQixHQUFHLHFCQUFxQixDQUFBO0FBQ2hELE1BQU1DLGlCQUFpQixHQUFHLG9CQUFvQixDQUFBO0FBQzlDLE1BQU1DLGNBQWMsR0FBRyxtQkFBbUIsQ0FBQTtBQUMxQyxNQUFNQyxhQUFhLEdBQUcsa0JBQWtCLENBQUE7QUFDeEMsTUFB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
