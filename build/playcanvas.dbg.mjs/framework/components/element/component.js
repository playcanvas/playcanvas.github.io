import { Debug } from '../../../core/debug.js';
import { TRACE_ID_ELEMENT } from '../../../core/constants.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { FUNC_EQUAL, STENCILOP_INCREMENT, FUNC_ALWAYS, STENCILOP_REPLACE } from '../../../platform/graphics/constants.js';
import { LAYERID_UI } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { StencilParameters } from '../../../platform/graphics/stencil-parameters.js';
import { Entity } from '../../entity.js';
import { Component } from '../component.js';
import { ELEMENTTYPE_GROUP, FITMODE_STRETCH, ELEMENTTYPE_IMAGE, ELEMENTTYPE_TEXT } from './constants.js';
import { ImageElement } from './image-element.js';
import { TextElement } from './text-element.js';

const position = new Vec3();
const invParentWtm = new Mat4();
const vecA = new Vec3();
const vecB = new Vec3();
const matA = new Mat4();
const matB = new Mat4();
const matC = new Mat4();
const matD = new Mat4();

/**
 * ElementComponents are used to construct user interfaces. An ElementComponent's [type](#type)
 * property can be configured in 3 main ways: as a text element, as an image element or as a group
 * element. If the ElementComponent has a {@link ScreenComponent} ancestor in the hierarchy, it
 * will be transformed with respect to the coordinate system of the screen. If there is no
 * {@link ScreenComponent} ancestor, the ElementComponent will be transformed like any other
 * entity.
 *
 * You should never need to use the ElementComponent constructor. To add an ElementComponent to a
 * {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * // Add an element component to an entity with the default options
 * let entity = pc.Entity();
 * entity.addComponent("element"); // This defaults to a 'group' element
 * ```
 *
 * To create a simple text-based element:
 *
 * ```javascript
 * entity.addComponent("element", {
 *     anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5), // centered anchor
 *     fontAsset: fontAsset,
 *     fontSize: 128,
 *     pivot: new pc.Vec2(0.5, 0.5),            // centered pivot
 *     text: "Hello World!",
 *     type: pc.ELEMENTTYPE_TEXT
 * });
 * ```
 *
 * Once the ElementComponent is added to the entity, you can set and get any of its properties:
 *
 * ```javascript
 * entity.element.color = pc.Color.RED; // Set the element's color to red
 *
 * console.log(entity.element.color);   // Get the element's color and print it
 * ```
 *
 * Relevant 'Engine-only' examples:
 * - [Basic text rendering](http://playcanvas.github.io/#user-interface/text-basic)
 * - [Rendering text outlines](http://playcanvas.github.io/#user-interface/text-outline)
 * - [Adding drop shadows to text](http://playcanvas.github.io/#user-interface/text-drop-shadow)
 * - [Coloring text with markup](http://playcanvas.github.io/#user-interface/text-markup)
 * - [Wrapping text](http://playcanvas.github.io/#user-interface/text-wrap)
 * - [Typewriter text](http://playcanvas.github.io/#user-interface/text-typewriter)
 *
 * @property {import('../../../core/math/color.js').Color} color The color of the image for
 * {@link ELEMENTTYPE_IMAGE} types or the color of the text for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} opacity The opacity of the image for {@link ELEMENTTYPE_IMAGE} types or the
 * text for {@link ELEMENTTYPE_TEXT} types.
 * @property {import('../../../core/math/color.js').Color} outlineColor The text outline effect
 * color and opacity. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} outlineThickness The width of the text outline effect. Only works for
 * {@link ELEMENTTYPE_TEXT} types.
 * @property {import('../../../core/math/color.js').Color} shadowColor The text shadow effect color
 * and opacity. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {Vec2} shadowOffset The text shadow effect shift amount from original text. Only works
 * for {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} autoWidth Automatically set the width of the component to be the same as the
 * textWidth. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} autoHeight Automatically set the height of the component to be the same as
 * the textHeight. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {string} fitMode Set how the content should be fitted and preserve the aspect ratio of
 * the source texture or sprite. Only works for {@link ELEMENTTYPE_IMAGE} types.
 * @property {number} fontAsset The id of the font asset used for rendering the text. Only works
 * for {@link ELEMENTTYPE_TEXT} types.
 * @property {import('../../font/font.js').Font} font The font used for rendering the text. Only
 * works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} fontSize The size of the font. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} autoFitWidth When true the font size and line height will scale so that the
 * text fits inside the width of the Element. The font size will be scaled between minFontSize and
 * maxFontSize. The value of autoFitWidth will be ignored if autoWidth is true.
 * @property {boolean} autoFitHeight When true the font size and line height will scale so that the
 * text fits inside the height of the Element. The font size will be scaled between minFontSize and
 * maxFontSize. The value of autoFitHeight will be ignored if autoHeight is true.
 * @property {number} minFontSize The minimum size that the font can scale to when autoFitWidth or
 * autoFitHeight are true.
 * @property {number} maxFontSize The maximum size that the font can scale to when autoFitWidth or
 * autoFitHeight are true.
 * @property {number} spacing The spacing between the letters of the text. Only works for
 * {@link ELEMENTTYPE_TEXT} types.
 * @property {number} lineHeight The height of each line of text. Only works for
 * {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} wrapLines Whether to automatically wrap lines based on the element width.
 * Only works for {@link ELEMENTTYPE_TEXT} types, and when autoWidth is set to false.
 * @property {number} maxLines The maximum number of lines that the Element can wrap to. Any
 * leftover text will be appended to the last line. Set this to null to allow unlimited lines.
 * @property {Vec2} alignment The horizontal and vertical alignment of the text. Values range from
 * 0 to 1 where [0,0] is the bottom left and [1,1] is the top right.  Only works for
 * {@link ELEMENTTYPE_TEXT} types.
 * @property {string} text The text to render. Only works for {@link ELEMENTTYPE_TEXT} types. To
 * override certain text styling properties on a per-character basis, the text can optionally
 * include markup tags contained within square brackets. Supported tags are:
 *
 * - `color` - override the element's `color` property. Examples:
 *   - `[color="#ff0000"]red text[/color]`
 *   - `[color="#00ff00"]green text[/color]`
 *   - `[color="#0000ff"]blue text[/color]`
 * - `outline` - override the element's `outlineColor` and `outlineThickness` properties. Example:
 *   - `[outline color="#ffffff" thickness="0.5"]text[/outline]`
 * - `shadow` - override the element's `shadowColor` and `shadowOffset` properties. Examples:
 *   - `[shadow color="#ffffff" offset="0.5"]text[/shadow]`
 *   - `[shadow color="#000000" offsetX="0.1" offsetY="0.2"]text[/shadow]`
 *
 * Note that markup tags are only processed if the text element's `enableMarkup` property is set to
 * true.
 * @property {string} key The localization key to use to get the localized text from
 * {@link Application#i18n}. Only works for {@link ELEMENTTYPE_TEXT} types.
 * @property {number} textureAsset The id of the texture asset to render. Only works for
 * {@link ELEMENTTYPE_IMAGE} types.
 * @property {import('../../../platform/graphics/texture.js').Texture} texture The texture to
 * render. Only works for {@link ELEMENTTYPE_IMAGE} types.
 * @property {number} spriteAsset The id of the sprite asset to render. Only works for
 * {@link ELEMENTTYPE_IMAGE} types which can render either a texture or a sprite.
 * @property {import('../../../scene/sprite.js').Sprite} sprite The sprite to render. Only works
 * for {@link ELEMENTTYPE_IMAGE} types which can render either a texture or a sprite.
 * @property {number} spriteFrame The frame of the sprite to render. Only works for
 * {@link ELEMENTTYPE_IMAGE} types who have a sprite assigned.
 * @property {number} pixelsPerUnit The number of pixels that map to one PlayCanvas unit. Only
 * works for {@link ELEMENTTYPE_IMAGE} types who have a sliced sprite assigned.
 * @property {number} materialAsset The id of the material asset to use when rendering an image.
 * Only works for {@link ELEMENTTYPE_IMAGE} types.
 * @property {import('../../../scene/materials/material.js').Material} material The material to use
 * when rendering an image. Only works for {@link ELEMENTTYPE_IMAGE} types.
 * @property {Vec4} rect Specifies which region of the texture to use in order to render an image.
 * Values range from 0 to 1 and indicate u, v, width, height. Only works for
 * {@link ELEMENTTYPE_IMAGE} types.
 * @property {boolean} rtlReorder Reorder the text for RTL languages using a function registered
 * by `app.systems.element.registerUnicodeConverter`.
 * @property {boolean} unicodeConverter Convert unicode characters using a function registered by
 * `app.systems.element.registerUnicodeConverter`.
 * @property {boolean} enableMarkup Flag for enabling markup processing. Only works for
 * {@link ELEMENTTYPE_TEXT} types. Defaults to false.
 * @property {number} rangeStart Index of the first character to render. Only works for
 * {@link ELEMENTTYPE_TEXT} types.
 * @property {number} rangeEnd Index of the last character to render. Only works for
 * {@link ELEMENTTYPE_TEXT} types.
 * @property {boolean} mask Switch Image Element into a mask. Masks do not render into the scene,
 * but instead limit child elements to only be rendered where this element is rendered.
 * @augments Component
 */
class ElementComponent extends Component {
  /**
   * Create a new ElementComponent instance.
   *
   * @param {import('./system.js').ElementComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {Entity} entity - The Entity that this Component is attached to.
   */
  constructor(system, entity) {
    super(system, entity);

    // set to true by the ElementComponentSystem while
    // the component is being initialized
    this._beingInitialized = false;
    this._anchor = new Vec4();
    this._localAnchor = new Vec4();
    this._pivot = new Vec2();
    this._width = this._calculatedWidth = 32;
    this._height = this._calculatedHeight = 32;
    this._margin = new Vec4(0, 0, -32, -32);

    // the model transform used to render
    this._modelTransform = new Mat4();
    this._screenToWorld = new Mat4();

    // transform that updates local position according to anchor values
    this._anchorTransform = new Mat4();
    this._anchorDirty = true;

    // transforms to calculate screen coordinates
    this._parentWorldTransform = new Mat4();
    this._screenTransform = new Mat4();

    // the corners of the element relative to its screen component.
    // Order is bottom left, bottom right, top right, top left
    this._screenCorners = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];

    // canvas-space corners of the element.
    // Order is bottom left, bottom right, top right, top left
    this._canvasCorners = [new Vec2(), new Vec2(), new Vec2(), new Vec2()];

    // the world-space corners of the element
    // Order is bottom left, bottom right, top right, top left
    this._worldCorners = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];
    this._cornersDirty = true;
    this._canvasCornersDirty = true;
    this._worldCornersDirty = true;
    this.entity.on('insert', this._onInsert, this);
    this._patch();

    /**
     * The Entity with a {@link ScreenComponent} that this component belongs to. This is
     * automatically set when the component is a child of a ScreenComponent.
     *
     * @type {Entity|null}
     */
    this.screen = null;
    this._type = ELEMENTTYPE_GROUP;

    // element types
    this._image = null;
    this._text = null;
    this._group = null;
    this._drawOrder = 0;

    // Fit mode
    this._fitMode = FITMODE_STRETCH;

    // input related
    this._useInput = false;
    this._layers = [LAYERID_UI]; // assign to the default UI layer
    this._addedModels = []; // store models that have been added to layer so we can re-add when layer is changed

    this._batchGroupId = -1;
    this._batchGroup = null;

    //

    this._offsetReadAt = 0;
    this._maskOffset = 0.5;
    this._maskedBy = null; // the entity that is masking this element
  }

  /**
   * Fired when the mouse is pressed while the cursor is on the component. Only fired when
   * useInput is true.
   *
   * @event ElementComponent#mousedown
   * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse is released while the cursor is on the component. Only fired when
   * useInput is true.
   *
   * @event ElementComponent#mouseup
   * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse cursor enters the component. Only fired when useInput is true.
   *
   * @event ElementComponent#mouseenter
   * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse cursor leaves the component. Only fired when useInput is true.
   *
   * @event ElementComponent#mouseleave
   * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse cursor is moved on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#mousemove
   * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse wheel is scrolled on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#mousewheel
   * @param {import('../../input/element-input.js').ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse is pressed and released on the component or when a touch starts and
   * ends on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#click
   * @param {import('../../input/element-input.js').ElementMouseEvent|import('../../input/element-input.js').ElementTouchEvent} event - The event.
   */

  /**
   * Fired when a touch starts on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#touchstart
   * @param {import('../../input/element-input.js').ElementTouchEvent} event - The event.
   */

  /**
   * Fired when a touch ends on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#touchend
   * @param {import('../../input/element-input.js').ElementTouchEvent} event - The event.
   */

  /**
   * Fired when a touch moves after it started touching the component. Only fired when useInput
   * is true.
   *
   * @event ElementComponent#touchmove
   * @param {import('../../input/element-input.js').ElementTouchEvent} event - The event.
   */

  /**
   * Fired when a touch is canceled on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#touchcancel
   * @param {import('../../input/element-input.js').ElementTouchEvent} event - The event.
   */

  get _absLeft() {
    return this._localAnchor.x + this._margin.x;
  }
  get _absRight() {
    return this._localAnchor.z - this._margin.z;
  }
  get _absTop() {
    return this._localAnchor.w - this._margin.w;
  }
  get _absBottom() {
    return this._localAnchor.y + this._margin.y;
  }
  get _hasSplitAnchorsX() {
    return Math.abs(this._anchor.x - this._anchor.z) > 0.001;
  }
  get _hasSplitAnchorsY() {
    return Math.abs(this._anchor.y - this._anchor.w) > 0.001;
  }
  get aabb() {
    if (this._image) return this._image.aabb;
    if (this._text) return this._text.aabb;
    return null;
  }

  /**
   * Specifies where the left, bottom, right and top edges of the component are anchored relative
   * to its parent. Each value ranges from 0 to 1. e.g. a value of [0, 0, 0, 0] means that the
   * element will be anchored to the bottom left of its parent. A value of [1, 1, 1, 1] means it
   * will be anchored to the top right. A split anchor is when the left-right or top-bottom pairs
   * of the anchor are not equal. In that case the component will be resized to cover that entire
   * area. e.g. a value of [0, 0, 1, 1] will make the component resize exactly as its parent.
   *
   * @example
   * pc.app.root.findByName("Inventory").element.anchor = new pc.Vec4(Math.random() * 0.1, 0, 1, 0);
   * @example
   * pc.app.root.findByName("Inventory").element.anchor = [Math.random() * 0.1, 0, 1, 0];
   *
   * @type {Vec4 | number[]}
   */
  set anchor(value) {
    if (value instanceof Vec4) {
      this._anchor.copy(value);
    } else {
      this._anchor.set(...value);
    }
    if (!this.entity._parent && !this.screen) {
      this._calculateLocalAnchors();
    } else {
      this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);
    }
    this._anchorDirty = true;
    if (!this.entity._dirtyLocal) this.entity._dirtifyLocal();
    this.fire('set:anchor', this._anchor);
  }
  get anchor() {
    return this._anchor;
  }

  /**
   * Assign element to a specific batch group (see {@link BatchGroup}). Default is -1 (no group).
   *
   * @type {number}
   */
  set batchGroupId(value) {
    if (this._batchGroupId === value) return;
    if (this.entity.enabled && this._batchGroupId >= 0) {
      var _this$system$app$batc;
      (_this$system$app$batc = this.system.app.batcher) == null ? void 0 : _this$system$app$batc.remove(BatchGroup.ELEMENT, this.batchGroupId, this.entity);
    }
    if (this.entity.enabled && value >= 0) {
      var _this$system$app$batc2;
      (_this$system$app$batc2 = this.system.app.batcher) == null ? void 0 : _this$system$app$batc2.insert(BatchGroup.ELEMENT, value, this.entity);
    }
    if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
      // re-add model to scene, in case it was removed by batching
      if (this._image && this._image._renderable.model) {
        this.addModelToLayers(this._image._renderable.model);
      } else if (this._text && this._text._model) {
        this.addModelToLayers(this._text._model);
      }
    }
    this._batchGroupId = value;
  }
  get batchGroupId() {
    return this._batchGroupId;
  }

  /**
   * The distance from the bottom edge of the anchor. Can be used in combination with a split
   * anchor to make the component's top edge always be 'top' units away from the top.
   *
   * @type {number}
   */
  set bottom(value) {
    this._margin.y = value;
    const p = this.entity.getLocalPosition();
    const wt = this._absTop;
    const wb = this._localAnchor.y + value;
    this._setHeight(wt - wb);
    p.y = value + this._calculatedHeight * this._pivot.y;
    this.entity.setLocalPosition(p);
  }
  get bottom() {
    return this._margin.y;
  }

  /**
   * The width at which the element will be rendered. In most cases this will be the same as
   * `width`. However, in some cases the engine may calculate a different width for the element,
   * such as when the element is under the control of a {@link LayoutGroupComponent}. In these
   * scenarios, `calculatedWidth` may be smaller or larger than the width that was set in the
   * editor.
   *
   * @type {number}
   */
  set calculatedWidth(value) {
    this._setCalculatedWidth(value, true);
  }
  get calculatedWidth() {
    return this._calculatedWidth;
  }

  /**
   * The height at which the element will be rendered. In most cases this will be the same as
   * `height`. However, in some cases the engine may calculate a different height for the element,
   * such as when the element is under the control of a {@link LayoutGroupComponent}. In these
   * scenarios, `calculatedHeight` may be smaller or larger than the height that was set in the
   * editor.
   *
   * @type {number}
   */
  set calculatedHeight(value) {
    this._setCalculatedHeight(value, true);
  }
  get calculatedHeight() {
    return this._calculatedHeight;
  }

  /**
   * An array of 4 {@link Vec2}s that represent the bottom left, bottom right, top right and top
   * left corners of the component in canvas pixels. Only works for screen space element
   * components.
   *
   * @type {Vec2[]}
   */
  get canvasCorners() {
    if (!this._canvasCornersDirty || !this.screen || !this.screen.screen.screenSpace) return this._canvasCorners;
    const device = this.system.app.graphicsDevice;
    const screenCorners = this.screenCorners;
    const sx = device.canvas.clientWidth / device.width;
    const sy = device.canvas.clientHeight / device.height;

    // scale screen corners to canvas size and reverse y
    for (let i = 0; i < 4; i++) {
      this._canvasCorners[i].set(screenCorners[i].x * sx, (device.height - screenCorners[i].y) * sy);
    }
    this._canvasCornersDirty = false;
    return this._canvasCorners;
  }

  /**
   * The draw order of the component. A higher value means that the component will be rendered on
   * top of other components.
   *
   * @type {number}
   */
  set drawOrder(value) {
    let priority = 0;
    if (this.screen) {
      priority = this.screen.screen.priority;
    }
    if (value > 0xFFFFFF) {
      Debug.warn('Element.drawOrder larger than max size of: ' + 0xFFFFFF);
      value = 0xFFFFFF;
    }

    // screen priority is stored in the top 8 bits
    this._drawOrder = (priority << 24) + value;
    this.fire('set:draworder', this._drawOrder);
  }
  get drawOrder() {
    return this._drawOrder;
  }

  /**
   * The height of the element as set in the editor. Note that in some cases this may not reflect
   * the true height at which the element is rendered, such as when the element is under the
   * control of a {@link LayoutGroupComponent}. See `calculatedHeight` in order to ensure you are
   * reading the true height at which the element will be rendered.
   *
   * @type {number}
   */
  set height(value) {
    this._height = value;
    if (!this._hasSplitAnchorsY) {
      this._setCalculatedHeight(value, true);
    }
    this.fire('set:height', this._height);
  }
  get height() {
    return this._height;
  }

  /**
   * An array of layer IDs ({@link Layer#id}) to which this element should belong. Don't push,
   * pop, splice or modify this array, if you want to change it - set a new one instead.
   *
   * @type {number[]}
   */
  set layers(value) {
    if (this._addedModels.length) {
      for (let i = 0; i < this._layers.length; i++) {
        const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
        if (layer) {
          for (let j = 0; j < this._addedModels.length; j++) {
            layer.removeMeshInstances(this._addedModels[j].meshInstances);
          }
        }
      }
    }
    this._layers = value;
    if (!this.enabled || !this.entity.enabled || !this._addedModels.length) return;
    for (let i = 0; i < this._layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this._layers[i]);
      if (layer) {
        for (let j = 0; j < this._addedModels.length; j++) {
          layer.addMeshInstances(this._addedModels[j].meshInstances);
        }
      }
    }
  }
  get layers() {
    return this._layers;
  }

  /**
   * The distance from the left edge of the anchor. Can be used in combination with a split
   * anchor to make the component's left edge always be 'left' units away from the left.
   *
   * @type {number}
   */
  set left(value) {
    this._margin.x = value;
    const p = this.entity.getLocalPosition();
    const wr = this._absRight;
    const wl = this._localAnchor.x + value;
    this._setWidth(wr - wl);
    p.x = value + this._calculatedWidth * this._pivot.x;
    this.entity.setLocalPosition(p);
  }
  get left() {
    return this._margin.x;
  }

  /**
   * The distance from the left, bottom, right and top edges of the anchor. For example if we are
   * using a split anchor like [0,0,1,1] and the margin is [0,0,0,0] then the component will be
   * the same width and height as its parent.
   *
   * @type {Vec4}
   */
  set margin(value) {
    this._margin.copy(value);
    this._calculateSize(true, true);
    this.fire('set:margin', this._margin);
  }
  get margin() {
    return this._margin;
  }

  /**
   * Get the entity that is currently masking this element.
   *
   * @type {Entity}
   * @private
   */
  get maskedBy() {
    return this._maskedBy;
  }

  /**
   * The position of the pivot of the component relative to its anchor. Each value ranges from 0
   * to 1 where [0,0] is the bottom left and [1,1] is the top right.
   *
   * @example
   * pc.app.root.findByName("Inventory").element.pivot = [Math.random() * 0.1, Math.random() * 0.1];
   * @example
   * pc.app.root.findByName("Inventory").element.pivot = new pc.Vec2(Math.random() * 0.1, Math.random() * 0.1);
   *
   * @type {Vec2 | number[]}
   */
  set pivot(value) {
    const {
      pivot,
      margin
    } = this;
    const prevX = pivot.x;
    const prevY = pivot.y;
    if (value instanceof Vec2) {
      pivot.copy(value);
    } else {
      pivot.set(...value);
    }
    const mx = margin.x + margin.z;
    const dx = pivot.x - prevX;
    margin.x += mx * dx;
    margin.z -= mx * dx;
    const my = margin.y + margin.w;
    const dy = pivot.y - prevY;
    margin.y += my * dy;
    margin.w -= my * dy;
    this._anchorDirty = true;
    this._cornersDirty = true;
    this._worldCornersDirty = true;
    this._calculateSize(false, false);

    // we need to flag children as dirty too
    // in order for them to update their position
    this._flagChildrenAsDirty();
    this.fire('set:pivot', pivot);
  }
  get pivot() {
    return this._pivot;
  }

  /**
   * The distance from the right edge of the anchor. Can be used in combination with a split
   * anchor to make the component's right edge always be 'right' units away from the right.
   *
   * @type {number}
   */
  set right(value) {
    this._margin.z = value;

    // update width
    const p = this.entity.getLocalPosition();
    const wl = this._absLeft;
    const wr = this._localAnchor.z - value;
    this._setWidth(wr - wl);

    // update position
    p.x = this._localAnchor.z - this._localAnchor.x - value - this._calculatedWidth * (1 - this._pivot.x);
    this.entity.setLocalPosition(p);
  }
  get right() {
    return this._margin.z;
  }

  /**
   * An array of 4 {@link Vec3}s that represent the bottom left, bottom right, top right and top
   * left corners of the component relative to its parent {@link ScreenComponent}.
   *
   * @type {Vec3[]}
   */
  get screenCorners() {
    if (!this._cornersDirty || !this.screen) return this._screenCorners;
    const parentBottomLeft = this.entity.parent && this.entity.parent.element && this.entity.parent.element.screenCorners[0];

    // init corners
    this._screenCorners[0].set(this._absLeft, this._absBottom, 0);
    this._screenCorners[1].set(this._absRight, this._absBottom, 0);
    this._screenCorners[2].set(this._absRight, this._absTop, 0);
    this._screenCorners[3].set(this._absLeft, this._absTop, 0);

    // transform corners to screen space
    const screenSpace = this.screen.screen.screenSpace;
    for (let i = 0; i < 4; i++) {
      this._screenTransform.transformPoint(this._screenCorners[i], this._screenCorners[i]);
      if (screenSpace) this._screenCorners[i].mulScalar(this.screen.screen.scale);
      if (parentBottomLeft) {
        this._screenCorners[i].add(parentBottomLeft);
      }
    }
    this._cornersDirty = false;
    this._canvasCornersDirty = true;
    this._worldCornersDirty = true;
    return this._screenCorners;
  }

  /**
   * The width of the text rendered by the component. Only works for {@link ELEMENTTYPE_TEXT} types.
   *
   * @type {number}
   */
  get textWidth() {
    return this._text ? this._text.width : 0;
  }

  /**
   * The height of the text rendered by the component. Only works for {@link ELEMENTTYPE_TEXT} types.
   *
   * @type {number}
   */
  get textHeight() {
    return this._text ? this._text.height : 0;
  }

  /**
   * The distance from the top edge of the anchor. Can be used in combination with a split anchor
   * to make the component's bottom edge always be 'bottom' units away from the bottom.
   *
   * @type {number}
   */
  set top(value) {
    this._margin.w = value;
    const p = this.entity.getLocalPosition();
    const wb = this._absBottom;
    const wt = this._localAnchor.w - value;
    this._setHeight(wt - wb);
    p.y = this._localAnchor.w - this._localAnchor.y - value - this._calculatedHeight * (1 - this._pivot.y);
    this.entity.setLocalPosition(p);
  }
  get top() {
    return this._margin.w;
  }

  /**
   * The type of the ElementComponent. Can be:
   *
   * - {@link ELEMENTTYPE_GROUP}: The component can be used as a layout mechanism to create groups of
   * ElementComponents e.g. panels.
   * - {@link ELEMENTTYPE_IMAGE}: The component will render an image
   * - {@link ELEMENTTYPE_TEXT}: The component will render text
   *
   * @type {string}
   */
  set type(value) {
    if (value !== this._type) {
      this._type = value;
      if (this._image) {
        this._image.destroy();
        this._image = null;
      }
      if (this._text) {
        this._text.destroy();
        this._text = null;
      }
      if (value === ELEMENTTYPE_IMAGE) {
        this._image = new ImageElement(this);
      } else if (value === ELEMENTTYPE_TEXT) {
        this._text = new TextElement(this);
      }
    }
  }
  get type() {
    return this._type;
  }

  /**
   * If true then the component will receive Mouse or Touch input events.
   *
   * @type {boolean}
   */
  set useInput(value) {
    if (this._useInput === value) return;
    this._useInput = value;
    if (this.system.app.elementInput) {
      if (value) {
        if (this.enabled && this.entity.enabled) {
          this.system.app.elementInput.addElement(this);
        }
      } else {
        this.system.app.elementInput.removeElement(this);
      }
    } else {
      if (this._useInput === true) {
        Debug.warn('Elements will not get any input events because this.system.app.elementInput is not created');
      }
    }
    this.fire('set:useInput', value);
  }
  get useInput() {
    return this._useInput;
  }

  /**
   * Set how the content should be fitted and preserve the aspect ratio of the source texture or sprite.
   * Only works for {@link ELEMENTTYPE_IMAGE} types. Can be:
   *
   * - {@link FITMODE_STRETCH}: Fit the content exactly to Element's bounding box.
   * - {@link FITMODE_CONTAIN}: Fit the content within the Element's bounding box while preserving its Aspect Ratio.
   * - {@link FITMODE_COVER}: Fit the content to cover the entire Element's bounding box while preserving its Aspect Ratio.
   *
   * @type {string}
   */
  set fitMode(value) {
    this._fitMode = value;
    this._calculateSize(true, true);
    if (this._image) {
      this._image.refreshMesh();
    }
  }
  get fitMode() {
    return this._fitMode;
  }

  /**
   * The width of the element as set in the editor. Note that in some cases this may not reflect
   * the true width at which the element is rendered, such as when the element is under the
   * control of a {@link LayoutGroupComponent}. See `calculatedWidth` in order to ensure you are
   * reading the true width at which the element will be rendered.
   *
   * @type {number}
   */
  set width(value) {
    this._width = value;
    if (!this._hasSplitAnchorsX) {
      this._setCalculatedWidth(value, true);
    }
    this.fire('set:width', this._width);
  }
  get width() {
    return this._width;
  }

  /**
   * An array of 4 {@link Vec3}s that represent the bottom left, bottom right, top right and top
   * left corners of the component in world space. Only works for 3D element components.
   *
   * @type {Vec3[]}
   */
  get worldCorners() {
    if (!this._worldCornersDirty) {
      return this._worldCorners;
    }
    if (this.screen) {
      const screenCorners = this.screenCorners;
      if (!this.screen.screen.screenSpace) {
        matA.copy(this.screen.screen._screenMatrix);

        // flip screen matrix along the horizontal axis
        matA.data[13] = -matA.data[13];

        // create transform that brings screen corners to world space
        matA.mul2(this.screen.getWorldTransform(), matA);

        // transform screen corners to world space
        for (let i = 0; i < 4; i++) {
          matA.transformPoint(screenCorners[i], this._worldCorners[i]);
        }
      }
    } else {
      const localPos = this.entity.getLocalPosition();

      // rotate and scale around pivot
      matA.setTranslate(-localPos.x, -localPos.y, -localPos.z);
      matB.setTRS(Vec3.ZERO, this.entity.getLocalRotation(), this.entity.getLocalScale());
      matC.setTranslate(localPos.x, localPos.y, localPos.z);

      // get parent world transform (but use this entity if there is no parent)
      const entity = this.entity.parent ? this.entity.parent : this.entity;
      matD.copy(entity.getWorldTransform());
      matD.mul(matC).mul(matB).mul(matA);

      // bottom left
      vecA.set(localPos.x - this.pivot.x * this.calculatedWidth, localPos.y - this.pivot.y * this.calculatedHeight, localPos.z);
      matD.transformPoint(vecA, this._worldCorners[0]);

      // bottom right
      vecA.set(localPos.x + (1 - this.pivot.x) * this.calculatedWidth, localPos.y - this.pivot.y * this.calculatedHeight, localPos.z);
      matD.transformPoint(vecA, this._worldCorners[1]);

      // top right
      vecA.set(localPos.x + (1 - this.pivot.x) * this.calculatedWidth, localPos.y + (1 - this.pivot.y) * this.calculatedHeight, localPos.z);
      matD.transformPoint(vecA, this._worldCorners[2]);

      // top left
      vecA.set(localPos.x - this.pivot.x * this.calculatedWidth, localPos.y + (1 - this.pivot.y) * this.calculatedHeight, localPos.z);
      matD.transformPoint(vecA, this._worldCorners[3]);
    }
    this._worldCornersDirty = false;
    return this._worldCorners;
  }
  _patch() {
    this.entity._sync = this._sync;
    this.entity.setPosition = this._setPosition;
    this.entity.setLocalPosition = this._setLocalPosition;
  }
  _unpatch() {
    this.entity._sync = Entity.prototype._sync;
    this.entity.setPosition = Entity.prototype.setPosition;
    this.entity.setLocalPosition = Entity.prototype.setLocalPosition;
  }

  /**
   * Patched method for setting the position.
   *
   * @param {number|Vec3} x - The x coordinate or Vec3
   * @param {number} y - The y coordinate
   * @param {number} z - The z coordinate
   * @private
   */
  _setPosition(x, y, z) {
    if (!this.element.screen) {
      Entity.prototype.setPosition.call(this, x, y, z);
      return;
    }
    if (x instanceof Vec3) {
      position.copy(x);
    } else {
      position.set(x, y, z);
    }
    this.getWorldTransform(); // ensure hierarchy is up to date
    invParentWtm.copy(this.element._screenToWorld).invert();
    invParentWtm.transformPoint(position, this.localPosition);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  /**
   * Patched method for setting the local position.
   *
   * @param {number|Vec3} x - The x coordinate or Vec3
   * @param {number} y - The y coordinate
   * @param {number} z - The z coordinate
   * @private
   */
  _setLocalPosition(x, y, z) {
    if (x instanceof Vec3) {
      this.localPosition.copy(x);
    } else {
      this.localPosition.set(x, y, z);
    }

    // update margin
    const element = this.element;
    const p = this.localPosition;
    const pvt = element._pivot;
    element._margin.x = p.x - element._calculatedWidth * pvt.x;
    element._margin.z = element._localAnchor.z - element._localAnchor.x - element._calculatedWidth - element._margin.x;
    element._margin.y = p.y - element._calculatedHeight * pvt.y;
    element._margin.w = element._localAnchor.w - element._localAnchor.y - element._calculatedHeight - element._margin.y;
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  // this method overwrites GraphNode#sync and so operates in scope of the Entity.
  _sync() {
    const element = this.element;
    const screen = element.screen;
    if (screen) {
      if (element._anchorDirty) {
        let resx = 0;
        let resy = 0;
        let px = 0;
        let py = 1;
        if (this._parent && this._parent.element) {
          // use parent rect
          resx = this._parent.element.calculatedWidth;
          resy = this._parent.element.calculatedHeight;
          px = this._parent.element.pivot.x;
          py = this._parent.element.pivot.y;
        } else {
          // use screen rect
          const resolution = screen.screen.resolution;
          resx = resolution.x / screen.screen.scale;
          resy = resolution.y / screen.screen.scale;
        }
        element._anchorTransform.setTranslate(resx * (element.anchor.x - px), -(resy * (py - element.anchor.y)), 0);
        element._anchorDirty = false;
        element._calculateLocalAnchors();
      }

      // if element size is dirty
      // recalculate its size
      // WARNING: Order is important as calculateSize resets dirtyLocal
      // so this needs to run before resetting dirtyLocal to false below
      if (element._sizeDirty) {
        element._calculateSize(false, false);
      }
    }
    if (this._dirtyLocal) {
      this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

      // update margin
      const p = this.localPosition;
      const pvt = element._pivot;
      element._margin.x = p.x - element._calculatedWidth * pvt.x;
      element._margin.z = element._localAnchor.z - element._localAnchor.x - element._calculatedWidth - element._margin.x;
      element._margin.y = p.y - element._calculatedHeight * pvt.y;
      element._margin.w = element._localAnchor.w - element._localAnchor.y - element._calculatedHeight - element._margin.y;
      this._dirtyLocal = false;
    }
    if (!screen) {
      if (this._dirtyWorld) {
        element._cornersDirty = true;
        element._canvasCornersDirty = true;
        element._worldCornersDirty = true;
      }
      return Entity.prototype._sync.call(this);
    }
    if (this._dirtyWorld) {
      if (this._parent === null) {
        this.worldTransform.copy(this.localTransform);
      } else {
        // transform element hierarchy
        if (this._parent.element) {
          element._screenToWorld.mul2(this._parent.element._modelTransform, element._anchorTransform);
        } else {
          element._screenToWorld.copy(element._anchorTransform);
        }
        element._modelTransform.mul2(element._screenToWorld, this.localTransform);
        if (screen) {
          element._screenToWorld.mul2(screen.screen._screenMatrix, element._screenToWorld);
          if (!screen.screen.screenSpace) {
            element._screenToWorld.mul2(screen.worldTransform, element._screenToWorld);
          }
          this.worldTransform.mul2(element._screenToWorld, this.localTransform);

          // update parent world transform
          const parentWorldTransform = element._parentWorldTransform;
          parentWorldTransform.setIdentity();
          const parent = this._parent;
          if (parent && parent.element && parent !== screen) {
            matA.setTRS(Vec3.ZERO, parent.getLocalRotation(), parent.getLocalScale());
            parentWorldTransform.mul2(parent.element._parentWorldTransform, matA);
          }

          // update element transform
          // rotate and scale around pivot
          const depthOffset = vecA;
          depthOffset.set(0, 0, this.localPosition.z);
          const pivotOffset = vecB;
          pivotOffset.set(element._absLeft + element._pivot.x * element.calculatedWidth, element._absBottom + element._pivot.y * element.calculatedHeight, 0);
          matA.setTranslate(-pivotOffset.x, -pivotOffset.y, -pivotOffset.z);
          matB.setTRS(depthOffset, this.getLocalRotation(), this.getLocalScale());
          matC.setTranslate(pivotOffset.x, pivotOffset.y, pivotOffset.z);
          element._screenTransform.mul2(element._parentWorldTransform, matC).mul(matB).mul(matA);
          element._cornersDirty = true;
          element._canvasCornersDirty = true;
          element._worldCornersDirty = true;
        } else {
          this.worldTransform.copy(element._modelTransform);
        }
      }
      this._dirtyWorld = false;
    }
  }
  _onInsert(parent) {
    // when the entity is reparented find a possible new screen and mask

    const result = this._parseUpToScreen();
    this.entity._dirtifyWorld();
    this._updateScreen(result.screen);
    this._dirtifyMask();
  }
  _dirtifyMask() {
    let current = this.entity;
    while (current) {
      // search up the hierarchy until we find an entity which has:
      // - no parent
      // - screen component on parent
      const next = current.parent;
      if ((next === null || next.screen) && current.element) {
        if (!this.system._prerender || !this.system._prerender.length) {
          this.system._prerender = [];
          this.system.app.once('prerender', this._onPrerender, this);
          Debug.trace(TRACE_ID_ELEMENT, 'register prerender');
        }
        const i = this.system._prerender.indexOf(this.entity);
        if (i >= 0) {
          this.system._prerender.splice(i, 1);
        }
        const j = this.system._prerender.indexOf(current);
        if (j < 0) {
          this.system._prerender.push(current);
        }
        Debug.trace(TRACE_ID_ELEMENT, 'set prerender root to: ' + current.name);
      }
      current = next;
    }
  }
  _onPrerender() {
    for (let i = 0; i < this.system._prerender.length; i++) {
      const mask = this.system._prerender[i];
      Debug.trace(TRACE_ID_ELEMENT, 'prerender from: ' + mask.name);

      // prevent call if element has been removed since being added
      if (mask.element) {
        const depth = 1;
        mask.element.syncMask(depth);
      }
    }
    this.system._prerender.length = 0;
  }
  _bindScreen(screen) {
    // Bind the Element to the Screen. We used to subscribe to Screen events here. However,
    // that was very slow when there are thousands of Elements. When the time comes to unbind
    // the Element from the Screen, finding the event callbacks to remove takes a considerable
    // amount of time. So instead, the Screen stores the Element component and calls its
    // functions directly.
    screen._bindElement(this);
  }
  _unbindScreen(screen) {
    screen._unbindElement(this);
  }
  _updateScreen(screen) {
    if (this.screen && this.screen !== screen) {
      this._unbindScreen(this.screen.screen);
    }
    const previousScreen = this.screen;
    this.screen = screen;
    if (this.screen) {
      this._bindScreen(this.screen.screen);
    }
    this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);
    this.fire('set:screen', this.screen, previousScreen);
    this._anchorDirty = true;

    // update all child screens
    const children = this.entity.children;
    for (let i = 0, l = children.length; i < l; i++) {
      if (children[i].element) children[i].element._updateScreen(screen);
    }

    // calculate draw order
    if (this.screen) this.screen.screen.syncDrawOrder();
  }
  syncMask(depth) {
    const result = this._parseUpToScreen();
    this._updateMask(result.mask, depth);
  }

  // set the maskedby property to the entity that is masking this element
  // - set the stencil buffer to check the mask value
  //   so as to only render inside the mask
  //   Note: if this entity is itself a mask the stencil params
  //   will be updated in updateMask to include masking
  _setMaskedBy(mask) {
    const renderableElement = this._image || this._text;
    if (mask) {
      const ref = mask.element._image._maskRef;
      Debug.trace(TRACE_ID_ELEMENT, 'masking: ' + this.entity.name + ' with ' + ref);

      // if this is image or text, set the stencil parameters
      renderableElement == null ? void 0 : renderableElement._setStencil(new StencilParameters({
        ref: ref,
        func: FUNC_EQUAL
      }));
      this._maskedBy = mask;
    } else {
      Debug.trace(TRACE_ID_ELEMENT, 'no masking on: ' + this.entity.name);

      // remove stencil params if this is image or text
      renderableElement == null ? void 0 : renderableElement._setStencil(null);
      this._maskedBy = null;
    }
  }

  // recursively update entity's stencil params
  // to render the correct value into the stencil buffer
  _updateMask(currentMask, depth) {
    if (currentMask) {
      this._setMaskedBy(currentMask);

      // this element is also masking others
      if (this.mask) {
        const ref = currentMask.element._image._maskRef;
        const sp = new StencilParameters({
          ref: ref,
          func: FUNC_EQUAL,
          zpass: STENCILOP_INCREMENT
        });
        this._image._setStencil(sp);
        this._image._maskRef = depth;

        // increment counter to count mask depth
        depth++;
        Debug.trace(TRACE_ID_ELEMENT, 'masking from: ' + this.entity.name + ' with ' + (sp.ref + 1));
        Debug.trace(TRACE_ID_ELEMENT, 'depth++ to: ', depth);
        currentMask = this.entity;
      }

      // recurse through all children
      const children = this.entity.children;
      for (let i = 0, l = children.length; i < l; i++) {
        var _children$i$element;
        (_children$i$element = children[i].element) == null ? void 0 : _children$i$element._updateMask(currentMask, depth);
      }

      // if mask counter was increased, decrement it as we come back up the hierarchy
      if (this.mask) depth--;
    } else {
      // clearing mask
      this._setMaskedBy(null);
      if (this.mask) {
        const sp = new StencilParameters({
          ref: depth,
          func: FUNC_ALWAYS,
          zpass: STENCILOP_REPLACE
        });
        this._image._setStencil(sp);
        this._image._maskRef = depth;

        // increment mask counter to count depth of masks
        depth++;
        Debug.trace(TRACE_ID_ELEMENT, 'masking from: ' + this.entity.name + ' with ' + sp.ref);
        Debug.trace(TRACE_ID_ELEMENT, 'depth++ to: ', depth);
        currentMask = this.entity;
      }

      // recurse through all children
      const children = this.entity.children;
      for (let i = 0, l = children.length; i < l; i++) {
        var _children$i$element2;
        (_children$i$element2 = children[i].element) == null ? void 0 : _children$i$element2._updateMask(currentMask, depth);
      }

      // decrement mask counter as we come back up the hierarchy
      if (this.mask) depth--;
    }
  }

  // search up the parent hierarchy until we reach a screen
  // this screen is the parent screen
  // also searches for masked elements to get the relevant mask
  _parseUpToScreen() {
    const result = {
      screen: null,
      mask: null
    };
    let parent = this.entity._parent;
    while (parent && !parent.screen) {
      if (parent.element && parent.element.mask) {
        // mask entity
        if (!result.mask) result.mask = parent;
      }
      parent = parent.parent;
    }
    if (parent && parent.screen) result.screen = parent;
    return result;
  }
  _onScreenResize(res) {
    this._anchorDirty = true;
    this._cornersDirty = true;
    this._worldCornersDirty = true;
    this._calculateSize(this._hasSplitAnchorsX, this._hasSplitAnchorsY);
    this.fire('screen:set:resolution', res);
  }
  _onScreenSpaceChange() {
    this.fire('screen:set:screenspace', this.screen.screen.screenSpace);
  }
  _onScreenRemove() {
    if (this.screen) {
      if (this.screen._destroying) {
        // If the screen entity is being destroyed, we don't call
        // _updateScreen() as an optimization but we should still
        // set it to null to clean up dangling references
        this.screen = null;
      } else {
        this._updateScreen(null);
      }
    }
  }

  // store pixel positions of anchor relative to current parent resolution
  _calculateLocalAnchors() {
    let resx = 1000;
    let resy = 1000;
    const parent = this.entity._parent;
    if (parent && parent.element) {
      resx = parent.element.calculatedWidth;
      resy = parent.element.calculatedHeight;
    } else if (this.screen) {
      const res = this.screen.screen.resolution;
      const scale = this.screen.screen.scale;
      resx = res.x / scale;
      resy = res.y / scale;
    }
    this._localAnchor.set(this._anchor.x * resx, this._anchor.y * resy, this._anchor.z * resx, this._anchor.w * resy);
  }

  // internal - apply offset x,y to local position and find point in world space
  getOffsetPosition(x, y) {
    const p = this.entity.getLocalPosition().clone();
    p.x += x;
    p.y += y;
    this._screenToWorld.transformPoint(p, p);
    return p;
  }
  onLayersChanged(oldComp, newComp) {
    this.addModelToLayers(this._image ? this._image._renderable.model : this._text._model);
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }
  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    if (this._image) {
      layer.addMeshInstances(this._image._renderable.model.meshInstances);
    } else if (this._text) {
      layer.addMeshInstances(this._text._model.meshInstances);
    }
  }
  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    if (this._image) {
      layer.removeMeshInstances(this._image._renderable.model.meshInstances);
    } else if (this._text) {
      layer.removeMeshInstances(this._text._model.meshInstances);
    }
  }
  onEnable() {
    if (this._image) this._image.onEnable();
    if (this._text) this._text.onEnable();
    if (this._group) this._group.onEnable();
    if (this.useInput && this.system.app.elementInput) {
      this.system.app.elementInput.addElement(this);
    }
    this.system.app.scene.on('set:layers', this.onLayersChanged, this);
    if (this.system.app.scene.layers) {
      this.system.app.scene.layers.on('add', this.onLayerAdded, this);
      this.system.app.scene.layers.on('remove', this.onLayerRemoved, this);
    }
    if (this._batchGroupId >= 0) {
      var _this$system$app$batc3;
      (_this$system$app$batc3 = this.system.app.batcher) == null ? void 0 : _this$system$app$batc3.insert(BatchGroup.ELEMENT, this.batchGroupId, this.entity);
    }
    this.fire('enableelement');
  }
  onDisable() {
    this.system.app.scene.off('set:layers', this.onLayersChanged, this);
    if (this.system.app.scene.layers) {
      this.system.app.scene.layers.off('add', this.onLayerAdded, this);
      this.system.app.scene.layers.off('remove', this.onLayerRemoved, this);
    }
    if (this._image) this._image.onDisable();
    if (this._text) this._text.onDisable();
    if (this._group) this._group.onDisable();
    if (this.system.app.elementInput && this.useInput) {
      this.system.app.elementInput.removeElement(this);
    }
    if (this._batchGroupId >= 0) {
      var _this$system$app$batc4;
      (_this$system$app$batc4 = this.system.app.batcher) == null ? void 0 : _this$system$app$batc4.remove(BatchGroup.ELEMENT, this.batchGroupId, this.entity);
    }
    this.fire('disableelement');
  }
  onRemove() {
    this.entity.off('insert', this._onInsert, this);
    this._unpatch();
    if (this._image) this._image.destroy();
    if (this._text) this._text.destroy();
    if (this.system.app.elementInput && this.useInput) {
      this.system.app.elementInput.removeElement(this);
    }

    // if there is a screen, update draw-order
    if (this.screen && this.screen.screen) {
      this._unbindScreen(this.screen.screen);
      this.screen.screen.syncDrawOrder();
    }
    this.off();
  }

  /**
   * Recalculates these properties:
   *   - `_localAnchor`
   *   - `width`
   *   - `height`
   *   - Local position is updated if anchors are split
   *
   * Assumes these properties are up to date:
   *   - `_margin`
   *
   * @param {boolean} propagateCalculatedWidth - If true, call `_setWidth` instead
   * of `_setCalculatedWidth`
   * @param {boolean} propagateCalculatedHeight - If true, call `_setHeight` instead
   * of `_setCalculatedHeight`
   * @private
   */
  _calculateSize(propagateCalculatedWidth, propagateCalculatedHeight) {
    // can't calculate if local anchors are wrong
    if (!this.entity._parent && !this.screen) return;
    this._calculateLocalAnchors();
    const newWidth = this._absRight - this._absLeft;
    const newHeight = this._absTop - this._absBottom;
    if (propagateCalculatedWidth) {
      this._setWidth(newWidth);
    } else {
      this._setCalculatedWidth(newWidth, false);
    }
    if (propagateCalculatedHeight) {
      this._setHeight(newHeight);
    } else {
      this._setCalculatedHeight(newHeight, false);
    }
    const p = this.entity.getLocalPosition();
    p.x = this._margin.x + this._calculatedWidth * this._pivot.x;
    p.y = this._margin.y + this._calculatedHeight * this._pivot.y;
    this.entity.setLocalPosition(p);
    this._sizeDirty = false;
  }

  /**
   * Internal set width without updating margin.
   *
   * @param {number} w - The new width.
   * @private
   */
  _setWidth(w) {
    this._width = w;
    this._setCalculatedWidth(w, false);
    this.fire('set:width', this._width);
  }

  /**
   * Internal set height without updating margin.
   *
   * @param {number} h - The new height.
   * @private
   */
  _setHeight(h) {
    this._height = h;
    this._setCalculatedHeight(h, false);
    this.fire('set:height', this._height);
  }

  /**
   * This method sets the calculated width value and optionally updates the margins.
   *
   * @param {number} value - The new calculated width.
   * @param {boolean} updateMargins - Update margins or not.
   * @private
   */
  _setCalculatedWidth(value, updateMargins) {
    if (Math.abs(value - this._calculatedWidth) <= 1e-4) return;
    this._calculatedWidth = value;
    this.entity._dirtifyLocal();
    if (updateMargins) {
      const p = this.entity.getLocalPosition();
      const pvt = this._pivot;
      this._margin.x = p.x - this._calculatedWidth * pvt.x;
      this._margin.z = this._localAnchor.z - this._localAnchor.x - this._calculatedWidth - this._margin.x;
    }
    this._flagChildrenAsDirty();
    this.fire('set:calculatedWidth', this._calculatedWidth);
    this.fire('resize', this._calculatedWidth, this._calculatedHeight);
  }

  /**
   * This method sets the calculated height value and optionally updates the margins.
   *
   * @param {number} value - The new calculated height.
   * @param {boolean} updateMargins - Update margins or not.
   * @private
   */
  _setCalculatedHeight(value, updateMargins) {
    if (Math.abs(value - this._calculatedHeight) <= 1e-4) return;
    this._calculatedHeight = value;
    this.entity._dirtifyLocal();
    if (updateMargins) {
      const p = this.entity.getLocalPosition();
      const pvt = this._pivot;
      this._margin.y = p.y - this._calculatedHeight * pvt.y;
      this._margin.w = this._localAnchor.w - this._localAnchor.y - this._calculatedHeight - this._margin.y;
    }
    this._flagChildrenAsDirty();
    this.fire('set:calculatedHeight', this._calculatedHeight);
    this.fire('resize', this._calculatedWidth, this._calculatedHeight);
  }
  _flagChildrenAsDirty() {
    const c = this.entity._children;
    for (let i = 0, l = c.length; i < l; i++) {
      if (c[i].element) {
        c[i].element._anchorDirty = true;
        c[i].element._sizeDirty = true;
      }
    }
  }
  addModelToLayers(model) {
    this._addedModels.push(model);
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (!layer) continue;
      layer.addMeshInstances(model.meshInstances);
    }
  }
  removeModelFromLayers(model) {
    const idx = this._addedModels.indexOf(model);
    if (idx >= 0) {
      this._addedModels.splice(idx, 1);
    }
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (!layer) continue;
      layer.removeMeshInstances(model.meshInstances);
    }
  }
  getMaskOffset() {
    // reset offset on new frame
    // we always count offset down from 0.5
    const frame = this.system.app.frame;
    if (this._offsetReadAt !== frame) {
      this._maskOffset = 0.5;
      this._offsetReadAt = frame;
    }
    const mo = this._maskOffset;
    this._maskOffset -= 0.001;
    return mo;
  }
  isVisibleForCamera(camera) {
    let clipL, clipR, clipT, clipB;
    if (this.maskedBy) {
      const corners = this.maskedBy.element.screenCorners;
      clipL = Math.min(Math.min(corners[0].x, corners[1].x), Math.min(corners[2].x, corners[3].x));
      clipR = Math.max(Math.max(corners[0].x, corners[1].x), Math.max(corners[2].x, corners[3].x));
      clipB = Math.min(Math.min(corners[0].y, corners[1].y), Math.min(corners[2].y, corners[3].y));
      clipT = Math.max(Math.max(corners[0].y, corners[1].y), Math.max(corners[2].y, corners[3].y));
    } else {
      const sw = this.system.app.graphicsDevice.width;
      const sh = this.system.app.graphicsDevice.height;
      const cameraWidth = camera._rect.z * sw;
      const cameraHeight = camera._rect.w * sh;
      clipL = camera._rect.x * sw;
      clipR = clipL + cameraWidth;
      clipT = (1 - camera._rect.y) * sh;
      clipB = clipT - cameraHeight;
    }
    const hitCorners = this.screenCorners;
    const left = Math.min(Math.min(hitCorners[0].x, hitCorners[1].x), Math.min(hitCorners[2].x, hitCorners[3].x));
    const right = Math.max(Math.max(hitCorners[0].x, hitCorners[1].x), Math.max(hitCorners[2].x, hitCorners[3].x));
    const bottom = Math.min(Math.min(hitCorners[0].y, hitCorners[1].y), Math.min(hitCorners[2].y, hitCorners[3].y));
    const top = Math.max(Math.max(hitCorners[0].y, hitCorners[1].y), Math.max(hitCorners[2].y, hitCorners[3].y));
    if (right < clipL || left > clipR || bottom > clipT || top < clipB) {
      return false;
    }
    return true;
  }
  _isScreenSpace() {
    if (this.screen && this.screen.screen) {
      return this.screen.screen.screenSpace;
    }
    return false;
  }
  _isScreenCulled() {
    if (this.screen && this.screen.screen) {
      return this.screen.screen.cull;
    }
    return false;
  }
  _dirtyBatch() {
    if (this.batchGroupId !== -1) {
      var _this$system$app$batc5;
      (_this$system$app$batc5 = this.system.app.batcher) == null ? void 0 : _this$system$app$batc5.markGroupDirty(this.batchGroupId);
    }
  }
}
function _define(name) {
  Object.defineProperty(ElementComponent.prototype, name, {
    get: function () {
      if (this._text) {
        return this._text[name];
      } else if (this._image) {
        return this._image[name];
      }
      return null;
    },
    set: function (value) {
      if (this._text) {
        if (this._text[name] !== value) {
          this._dirtyBatch();
        }
        this._text[name] = value;
      } else if (this._image) {
        if (this._image[name] !== value) {
          this._dirtyBatch();
        }
        this._image[name] = value;
      }
    }
  });
}
_define('fontSize');
_define('minFontSize');
_define('maxFontSize');
_define('maxLines');
_define('autoFitWidth');
_define('autoFitHeight');
_define('color');
_define('font');
_define('fontAsset');
_define('spacing');
_define('lineHeight');
_define('wrapLines');
_define('lines');
_define('alignment');
_define('autoWidth');
_define('autoHeight');
_define('rtlReorder');
_define('unicodeConverter');
_define('text');
_define('key');
_define('texture');
_define('textureAsset');
_define('material');
_define('materialAsset');
_define('sprite');
_define('spriteAsset');
_define('spriteFrame');
_define('pixelsPerUnit');
_define('opacity');
_define('rect');
_define('mask');
_define('outlineColor');
_define('outlineThickness');
_define('shadowColor');
_define('shadowOffset');
_define('enableMarkup');
_define('rangeStart');
_define('rangeEnd');

export { ElementComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFX0lEX0VMRU1FTlQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEZVTkNfQUxXQVlTLCBGVU5DX0VRVUFMLCBTVEVOQ0lMT1BfSU5DUkVNRU5ULCBTVEVOQ0lMT1BfUkVQTEFDRSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IExBWUVSSURfVUkgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQmF0Y2hHcm91cCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLWdyb3VwLmpzJztcbmltcG9ydCB7IFN0ZW5jaWxQYXJhbWV0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc3RlbmNpbC1wYXJhbWV0ZXJzLmpzJztcblxuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZW50aXR5LmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHsgRUxFTUVOVFRZUEVfR1JPVVAsIEVMRU1FTlRUWVBFX0lNQUdFLCBFTEVNRU5UVFlQRV9URVhULCBGSVRNT0RFX1NUUkVUQ0ggfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJbWFnZUVsZW1lbnQgfSBmcm9tICcuL2ltYWdlLWVsZW1lbnQuanMnO1xuaW1wb3J0IHsgVGV4dEVsZW1lbnQgfSBmcm9tICcuL3RleHQtZWxlbWVudC5qcyc7XG5cbmNvbnN0IHBvc2l0aW9uID0gbmV3IFZlYzMoKTtcbmNvbnN0IGludlBhcmVudFd0bSA9IG5ldyBNYXQ0KCk7XG5cbmNvbnN0IHZlY0EgPSBuZXcgVmVjMygpO1xuY29uc3QgdmVjQiA9IG5ldyBWZWMzKCk7XG5jb25zdCBtYXRBID0gbmV3IE1hdDQoKTtcbmNvbnN0IG1hdEIgPSBuZXcgTWF0NCgpO1xuY29uc3QgbWF0QyA9IG5ldyBNYXQ0KCk7XG5jb25zdCBtYXREID0gbmV3IE1hdDQoKTtcblxuLyoqXG4gKiBFbGVtZW50Q29tcG9uZW50cyBhcmUgdXNlZCB0byBjb25zdHJ1Y3QgdXNlciBpbnRlcmZhY2VzLiBBbiBFbGVtZW50Q29tcG9uZW50J3MgW3R5cGVdKCN0eXBlKVxuICogcHJvcGVydHkgY2FuIGJlIGNvbmZpZ3VyZWQgaW4gMyBtYWluIHdheXM6IGFzIGEgdGV4dCBlbGVtZW50LCBhcyBhbiBpbWFnZSBlbGVtZW50IG9yIGFzIGEgZ3JvdXBcbiAqIGVsZW1lbnQuIElmIHRoZSBFbGVtZW50Q29tcG9uZW50IGhhcyBhIHtAbGluayBTY3JlZW5Db21wb25lbnR9IGFuY2VzdG9yIGluIHRoZSBoaWVyYXJjaHksIGl0XG4gKiB3aWxsIGJlIHRyYW5zZm9ybWVkIHdpdGggcmVzcGVjdCB0byB0aGUgY29vcmRpbmF0ZSBzeXN0ZW0gb2YgdGhlIHNjcmVlbi4gSWYgdGhlcmUgaXMgbm9cbiAqIHtAbGluayBTY3JlZW5Db21wb25lbnR9IGFuY2VzdG9yLCB0aGUgRWxlbWVudENvbXBvbmVudCB3aWxsIGJlIHRyYW5zZm9ybWVkIGxpa2UgYW55IG90aGVyXG4gKiBlbnRpdHkuXG4gKlxuICogWW91IHNob3VsZCBuZXZlciBuZWVkIHRvIHVzZSB0aGUgRWxlbWVudENvbXBvbmVudCBjb25zdHJ1Y3Rvci4gVG8gYWRkIGFuIEVsZW1lbnRDb21wb25lbnQgdG8gYVxuICoge0BsaW5rIEVudGl0eX0sIHVzZSB7QGxpbmsgRW50aXR5I2FkZENvbXBvbmVudH06XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gQWRkIGFuIGVsZW1lbnQgY29tcG9uZW50IHRvIGFuIGVudGl0eSB3aXRoIHRoZSBkZWZhdWx0IG9wdGlvbnNcbiAqIGxldCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJlbGVtZW50XCIpOyAvLyBUaGlzIGRlZmF1bHRzIHRvIGEgJ2dyb3VwJyBlbGVtZW50XG4gKiBgYGBcbiAqXG4gKiBUbyBjcmVhdGUgYSBzaW1wbGUgdGV4dC1iYXNlZCBlbGVtZW50OlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJlbGVtZW50XCIsIHtcbiAqICAgICBhbmNob3I6IG5ldyBwYy5WZWM0KDAuNSwgMC41LCAwLjUsIDAuNSksIC8vIGNlbnRlcmVkIGFuY2hvclxuICogICAgIGZvbnRBc3NldDogZm9udEFzc2V0LFxuICogICAgIGZvbnRTaXplOiAxMjgsXG4gKiAgICAgcGl2b3Q6IG5ldyBwYy5WZWMyKDAuNSwgMC41KSwgICAgICAgICAgICAvLyBjZW50ZXJlZCBwaXZvdFxuICogICAgIHRleHQ6IFwiSGVsbG8gV29ybGQhXCIsXG4gKiAgICAgdHlwZTogcGMuRUxFTUVOVFRZUEVfVEVYVFxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBPbmNlIHRoZSBFbGVtZW50Q29tcG9uZW50IGlzIGFkZGVkIHRvIHRoZSBlbnRpdHksIHlvdSBjYW4gc2V0IGFuZCBnZXQgYW55IG9mIGl0cyBwcm9wZXJ0aWVzOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGVudGl0eS5lbGVtZW50LmNvbG9yID0gcGMuQ29sb3IuUkVEOyAvLyBTZXQgdGhlIGVsZW1lbnQncyBjb2xvciB0byByZWRcbiAqXG4gKiBjb25zb2xlLmxvZyhlbnRpdHkuZWxlbWVudC5jb2xvcik7ICAgLy8gR2V0IHRoZSBlbGVtZW50J3MgY29sb3IgYW5kIHByaW50IGl0XG4gKiBgYGBcbiAqXG4gKiBSZWxldmFudCAnRW5naW5lLW9ubHknIGV4YW1wbGVzOlxuICogLSBbQmFzaWMgdGV4dCByZW5kZXJpbmddKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jdXNlci1pbnRlcmZhY2UvdGV4dC1iYXNpYylcbiAqIC0gW1JlbmRlcmluZyB0ZXh0IG91dGxpbmVzXShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3VzZXItaW50ZXJmYWNlL3RleHQtb3V0bGluZSlcbiAqIC0gW0FkZGluZyBkcm9wIHNoYWRvd3MgdG8gdGV4dF0oaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyN1c2VyLWludGVyZmFjZS90ZXh0LWRyb3Atc2hhZG93KVxuICogLSBbQ29sb3JpbmcgdGV4dCB3aXRoIG1hcmt1cF0oaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyN1c2VyLWludGVyZmFjZS90ZXh0LW1hcmt1cClcbiAqIC0gW1dyYXBwaW5nIHRleHRdKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jdXNlci1pbnRlcmZhY2UvdGV4dC13cmFwKVxuICogLSBbVHlwZXdyaXRlciB0ZXh0XShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3VzZXItaW50ZXJmYWNlL3RleHQtdHlwZXdyaXRlcilcbiAqXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJykuQ29sb3J9IGNvbG9yIFRoZSBjb2xvciBvZiB0aGUgaW1hZ2UgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIG9yIHRoZSBjb2xvciBvZiB0aGUgdGV4dCBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHkgVGhlIG9wYWNpdHkgb2YgdGhlIGltYWdlIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIG9yIHRoZVxuICogdGV4dCBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcycpLkNvbG9yfSBvdXRsaW5lQ29sb3IgVGhlIHRleHQgb3V0bGluZSBlZmZlY3RcbiAqIGNvbG9yIGFuZCBvcGFjaXR5LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3V0bGluZVRoaWNrbmVzcyBUaGUgd2lkdGggb2YgdGhlIHRleHQgb3V0bGluZSBlZmZlY3QuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJykuQ29sb3J9IHNoYWRvd0NvbG9yIFRoZSB0ZXh0IHNoYWRvdyBlZmZlY3QgY29sb3JcbiAqIGFuZCBvcGFjaXR5LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IHNoYWRvd09mZnNldCBUaGUgdGV4dCBzaGFkb3cgZWZmZWN0IHNoaWZ0IGFtb3VudCBmcm9tIG9yaWdpbmFsIHRleHQuIE9ubHkgd29ya3NcbiAqIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGF1dG9XaWR0aCBBdXRvbWF0aWNhbGx5IHNldCB0aGUgd2lkdGggb2YgdGhlIGNvbXBvbmVudCB0byBiZSB0aGUgc2FtZSBhcyB0aGVcbiAqIHRleHRXaWR0aC4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvSGVpZ2h0IEF1dG9tYXRpY2FsbHkgc2V0IHRoZSBoZWlnaHQgb2YgdGhlIGNvbXBvbmVudCB0byBiZSB0aGUgc2FtZSBhc1xuICogdGhlIHRleHRIZWlnaHQuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBmaXRNb2RlIFNldCBob3cgdGhlIGNvbnRlbnQgc2hvdWxkIGJlIGZpdHRlZCBhbmQgcHJlc2VydmUgdGhlIGFzcGVjdCByYXRpbyBvZlxuICogdGhlIHNvdXJjZSB0ZXh0dXJlIG9yIHNwcml0ZS4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmb250QXNzZXQgVGhlIGlkIG9mIHRoZSBmb250IGFzc2V0IHVzZWQgZm9yIHJlbmRlcmluZyB0aGUgdGV4dC4gT25seSB3b3Jrc1xuICogZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9mb250L2ZvbnQuanMnKS5Gb250fSBmb250IFRoZSBmb250IHVzZWQgZm9yIHJlbmRlcmluZyB0aGUgdGV4dC4gT25seVxuICogd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmb250U2l6ZSBUaGUgc2l6ZSBvZiB0aGUgZm9udC4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvRml0V2lkdGggV2hlbiB0cnVlIHRoZSBmb250IHNpemUgYW5kIGxpbmUgaGVpZ2h0IHdpbGwgc2NhbGUgc28gdGhhdCB0aGVcbiAqIHRleHQgZml0cyBpbnNpZGUgdGhlIHdpZHRoIG9mIHRoZSBFbGVtZW50LiBUaGUgZm9udCBzaXplIHdpbGwgYmUgc2NhbGVkIGJldHdlZW4gbWluRm9udFNpemUgYW5kXG4gKiBtYXhGb250U2l6ZS4gVGhlIHZhbHVlIG9mIGF1dG9GaXRXaWR0aCB3aWxsIGJlIGlnbm9yZWQgaWYgYXV0b1dpZHRoIGlzIHRydWUuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGF1dG9GaXRIZWlnaHQgV2hlbiB0cnVlIHRoZSBmb250IHNpemUgYW5kIGxpbmUgaGVpZ2h0IHdpbGwgc2NhbGUgc28gdGhhdCB0aGVcbiAqIHRleHQgZml0cyBpbnNpZGUgdGhlIGhlaWdodCBvZiB0aGUgRWxlbWVudC4gVGhlIGZvbnQgc2l6ZSB3aWxsIGJlIHNjYWxlZCBiZXR3ZWVuIG1pbkZvbnRTaXplIGFuZFxuICogbWF4Rm9udFNpemUuIFRoZSB2YWx1ZSBvZiBhdXRvRml0SGVpZ2h0IHdpbGwgYmUgaWdub3JlZCBpZiBhdXRvSGVpZ2h0IGlzIHRydWUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWluRm9udFNpemUgVGhlIG1pbmltdW0gc2l6ZSB0aGF0IHRoZSBmb250IGNhbiBzY2FsZSB0byB3aGVuIGF1dG9GaXRXaWR0aCBvclxuICogYXV0b0ZpdEhlaWdodCBhcmUgdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXhGb250U2l6ZSBUaGUgbWF4aW11bSBzaXplIHRoYXQgdGhlIGZvbnQgY2FuIHNjYWxlIHRvIHdoZW4gYXV0b0ZpdFdpZHRoIG9yXG4gKiBhdXRvRml0SGVpZ2h0IGFyZSB0cnVlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwYWNpbmcgVGhlIHNwYWNpbmcgYmV0d2VlbiB0aGUgbGV0dGVycyBvZiB0aGUgdGV4dC4gT25seSB3b3JrcyBmb3JcbiAqIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaW5lSGVpZ2h0IFRoZSBoZWlnaHQgb2YgZWFjaCBsaW5lIG9mIHRleHQuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHdyYXBMaW5lcyBXaGV0aGVyIHRvIGF1dG9tYXRpY2FsbHkgd3JhcCBsaW5lcyBiYXNlZCBvbiB0aGUgZWxlbWVudCB3aWR0aC5cbiAqIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcywgYW5kIHdoZW4gYXV0b1dpZHRoIGlzIHNldCB0byBmYWxzZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXhMaW5lcyBUaGUgbWF4aW11bSBudW1iZXIgb2YgbGluZXMgdGhhdCB0aGUgRWxlbWVudCBjYW4gd3JhcCB0by4gQW55XG4gKiBsZWZ0b3ZlciB0ZXh0IHdpbGwgYmUgYXBwZW5kZWQgdG8gdGhlIGxhc3QgbGluZS4gU2V0IHRoaXMgdG8gbnVsbCB0byBhbGxvdyB1bmxpbWl0ZWQgbGluZXMuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGFsaWdubWVudCBUaGUgaG9yaXpvbnRhbCBhbmQgdmVydGljYWwgYWxpZ25tZW50IG9mIHRoZSB0ZXh0LiBWYWx1ZXMgcmFuZ2UgZnJvbVxuICogMCB0byAxIHdoZXJlIFswLDBdIGlzIHRoZSBib3R0b20gbGVmdCBhbmQgWzEsMV0gaXMgdGhlIHRvcCByaWdodC4gIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdGV4dCBUaGUgdGV4dCB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy4gVG9cbiAqIG92ZXJyaWRlIGNlcnRhaW4gdGV4dCBzdHlsaW5nIHByb3BlcnRpZXMgb24gYSBwZXItY2hhcmFjdGVyIGJhc2lzLCB0aGUgdGV4dCBjYW4gb3B0aW9uYWxseVxuICogaW5jbHVkZSBtYXJrdXAgdGFncyBjb250YWluZWQgd2l0aGluIHNxdWFyZSBicmFja2V0cy4gU3VwcG9ydGVkIHRhZ3MgYXJlOlxuICpcbiAqIC0gYGNvbG9yYCAtIG92ZXJyaWRlIHRoZSBlbGVtZW50J3MgYGNvbG9yYCBwcm9wZXJ0eS4gRXhhbXBsZXM6XG4gKiAgIC0gYFtjb2xvcj1cIiNmZjAwMDBcIl1yZWQgdGV4dFsvY29sb3JdYFxuICogICAtIGBbY29sb3I9XCIjMDBmZjAwXCJdZ3JlZW4gdGV4dFsvY29sb3JdYFxuICogICAtIGBbY29sb3I9XCIjMDAwMGZmXCJdYmx1ZSB0ZXh0Wy9jb2xvcl1gXG4gKiAtIGBvdXRsaW5lYCAtIG92ZXJyaWRlIHRoZSBlbGVtZW50J3MgYG91dGxpbmVDb2xvcmAgYW5kIGBvdXRsaW5lVGhpY2tuZXNzYCBwcm9wZXJ0aWVzLiBFeGFtcGxlOlxuICogICAtIGBbb3V0bGluZSBjb2xvcj1cIiNmZmZmZmZcIiB0aGlja25lc3M9XCIwLjVcIl10ZXh0Wy9vdXRsaW5lXWBcbiAqIC0gYHNoYWRvd2AgLSBvdmVycmlkZSB0aGUgZWxlbWVudCdzIGBzaGFkb3dDb2xvcmAgYW5kIGBzaGFkb3dPZmZzZXRgIHByb3BlcnRpZXMuIEV4YW1wbGVzOlxuICogICAtIGBbc2hhZG93IGNvbG9yPVwiI2ZmZmZmZlwiIG9mZnNldD1cIjAuNVwiXXRleHRbL3NoYWRvd11gXG4gKiAgIC0gYFtzaGFkb3cgY29sb3I9XCIjMDAwMDAwXCIgb2Zmc2V0WD1cIjAuMVwiIG9mZnNldFk9XCIwLjJcIl10ZXh0Wy9zaGFkb3ddYFxuICpcbiAqIE5vdGUgdGhhdCBtYXJrdXAgdGFncyBhcmUgb25seSBwcm9jZXNzZWQgaWYgdGhlIHRleHQgZWxlbWVudCdzIGBlbmFibGVNYXJrdXBgIHByb3BlcnR5IGlzIHNldCB0b1xuICogdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBrZXkgVGhlIGxvY2FsaXphdGlvbiBrZXkgdG8gdXNlIHRvIGdldCB0aGUgbG9jYWxpemVkIHRleHQgZnJvbVxuICoge0BsaW5rIEFwcGxpY2F0aW9uI2kxOG59LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGV4dHVyZUFzc2V0IFRoZSBpZCBvZiB0aGUgdGV4dHVyZSBhc3NldCB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSB0ZXh0dXJlIFRoZSB0ZXh0dXJlIHRvXG4gKiByZW5kZXIuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3ByaXRlQXNzZXQgVGhlIGlkIG9mIHRoZSBzcHJpdGUgYXNzZXQgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcyB3aGljaCBjYW4gcmVuZGVyIGVpdGhlciBhIHRleHR1cmUgb3IgYSBzcHJpdGUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvc3ByaXRlLmpzJykuU3ByaXRlfSBzcHJpdGUgVGhlIHNwcml0ZSB0byByZW5kZXIuIE9ubHkgd29ya3NcbiAqIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIHdoaWNoIGNhbiByZW5kZXIgZWl0aGVyIGEgdGV4dHVyZSBvciBhIHNwcml0ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzcHJpdGVGcmFtZSBUaGUgZnJhbWUgb2YgdGhlIHNwcml0ZSB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIHdobyBoYXZlIGEgc3ByaXRlIGFzc2lnbmVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHBpeGVsc1BlclVuaXQgVGhlIG51bWJlciBvZiBwaXhlbHMgdGhhdCBtYXAgdG8gb25lIFBsYXlDYW52YXMgdW5pdC4gT25seVxuICogd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMgd2hvIGhhdmUgYSBzbGljZWQgc3ByaXRlIGFzc2lnbmVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG1hdGVyaWFsQXNzZXQgVGhlIGlkIG9mIHRoZSBtYXRlcmlhbCBhc3NldCB0byB1c2Ugd2hlbiByZW5kZXJpbmcgYW4gaW1hZ2UuXG4gKiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfSBtYXRlcmlhbCBUaGUgbWF0ZXJpYWwgdG8gdXNlXG4gKiB3aGVuIHJlbmRlcmluZyBhbiBpbWFnZS4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7VmVjNH0gcmVjdCBTcGVjaWZpZXMgd2hpY2ggcmVnaW9uIG9mIHRoZSB0ZXh0dXJlIHRvIHVzZSBpbiBvcmRlciB0byByZW5kZXIgYW4gaW1hZ2UuXG4gKiBWYWx1ZXMgcmFuZ2UgZnJvbSAwIHRvIDEgYW5kIGluZGljYXRlIHUsIHYsIHdpZHRoLCBoZWlnaHQuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBydGxSZW9yZGVyIFJlb3JkZXIgdGhlIHRleHQgZm9yIFJUTCBsYW5ndWFnZXMgdXNpbmcgYSBmdW5jdGlvbiByZWdpc3RlcmVkXG4gKiBieSBgYXBwLnN5c3RlbXMuZWxlbWVudC5yZWdpc3RlclVuaWNvZGVDb252ZXJ0ZXJgLlxuICogQHByb3BlcnR5IHtib29sZWFufSB1bmljb2RlQ29udmVydGVyIENvbnZlcnQgdW5pY29kZSBjaGFyYWN0ZXJzIHVzaW5nIGEgZnVuY3Rpb24gcmVnaXN0ZXJlZCBieVxuICogYGFwcC5zeXN0ZW1zLmVsZW1lbnQucmVnaXN0ZXJVbmljb2RlQ29udmVydGVyYC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZW5hYmxlTWFya3VwIEZsYWcgZm9yIGVuYWJsaW5nIG1hcmt1cCBwcm9jZXNzaW5nLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByYW5nZVN0YXJ0IEluZGV4IG9mIHRoZSBmaXJzdCBjaGFyYWN0ZXIgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhbmdlRW5kIEluZGV4IG9mIHRoZSBsYXN0IGNoYXJhY3RlciB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG1hc2sgU3dpdGNoIEltYWdlIEVsZW1lbnQgaW50byBhIG1hc2suIE1hc2tzIGRvIG5vdCByZW5kZXIgaW50byB0aGUgc2NlbmUsXG4gKiBidXQgaW5zdGVhZCBsaW1pdCBjaGlsZCBlbGVtZW50cyB0byBvbmx5IGJlIHJlbmRlcmVkIHdoZXJlIHRoaXMgZWxlbWVudCBpcyByZW5kZXJlZC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgRWxlbWVudENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEVsZW1lbnRDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5FbGVtZW50Q29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIC8vIHNldCB0byB0cnVlIGJ5IHRoZSBFbGVtZW50Q29tcG9uZW50U3lzdGVtIHdoaWxlXG4gICAgICAgIC8vIHRoZSBjb21wb25lbnQgaXMgYmVpbmcgaW5pdGlhbGl6ZWRcbiAgICAgICAgdGhpcy5fYmVpbmdJbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2FuY2hvciA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2xvY2FsQW5jaG9yID0gbmV3IFZlYzQoKTtcblxuICAgICAgICB0aGlzLl9waXZvdCA9IG5ldyBWZWMyKCk7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSB0aGlzLl9jYWxjdWxhdGVkV2lkdGggPSAzMjtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdGhpcy5fY2FsY3VsYXRlZEhlaWdodCA9IDMyO1xuXG4gICAgICAgIHRoaXMuX21hcmdpbiA9IG5ldyBWZWM0KDAsIDAsIC0zMiwgLTMyKTtcblxuICAgICAgICAvLyB0aGUgbW9kZWwgdHJhbnNmb3JtIHVzZWQgdG8gcmVuZGVyXG4gICAgICAgIHRoaXMuX21vZGVsVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcblxuICAgICAgICB0aGlzLl9zY3JlZW5Ub1dvcmxkID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvLyB0cmFuc2Zvcm0gdGhhdCB1cGRhdGVzIGxvY2FsIHBvc2l0aW9uIGFjY29yZGluZyB0byBhbmNob3IgdmFsdWVzXG4gICAgICAgIHRoaXMuX2FuY2hvclRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIC8vIHRyYW5zZm9ybXMgdG8gY2FsY3VsYXRlIHNjcmVlbiBjb29yZGluYXRlc1xuICAgICAgICB0aGlzLl9wYXJlbnRXb3JsZFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIHRoaXMuX3NjcmVlblRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgLy8gdGhlIGNvcm5lcnMgb2YgdGhlIGVsZW1lbnQgcmVsYXRpdmUgdG8gaXRzIHNjcmVlbiBjb21wb25lbnQuXG4gICAgICAgIC8vIE9yZGVyIGlzIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCwgdG9wIGxlZnRcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVycyA9IFtuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpXTtcblxuICAgICAgICAvLyBjYW52YXMtc3BhY2UgY29ybmVycyBvZiB0aGUgZWxlbWVudC5cbiAgICAgICAgLy8gT3JkZXIgaXMgYm90dG9tIGxlZnQsIGJvdHRvbSByaWdodCwgdG9wIHJpZ2h0LCB0b3AgbGVmdFxuICAgICAgICB0aGlzLl9jYW52YXNDb3JuZXJzID0gW25ldyBWZWMyKCksIG5ldyBWZWMyKCksIG5ldyBWZWMyKCksIG5ldyBWZWMyKCldO1xuXG4gICAgICAgIC8vIHRoZSB3b3JsZC1zcGFjZSBjb3JuZXJzIG9mIHRoZSBlbGVtZW50XG4gICAgICAgIC8vIE9yZGVyIGlzIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCwgdG9wIGxlZnRcbiAgICAgICAgdGhpcy5fd29ybGRDb3JuZXJzID0gW25ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKCldO1xuXG4gICAgICAgIHRoaXMuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLmVudGl0eS5vbignaW5zZXJ0JywgdGhpcy5fb25JbnNlcnQsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX3BhdGNoKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBFbnRpdHkgd2l0aCBhIHtAbGluayBTY3JlZW5Db21wb25lbnR9IHRoYXQgdGhpcyBjb21wb25lbnQgYmVsb25ncyB0by4gVGhpcyBpc1xuICAgICAgICAgKiBhdXRvbWF0aWNhbGx5IHNldCB3aGVuIHRoZSBjb21wb25lbnQgaXMgYSBjaGlsZCBvZiBhIFNjcmVlbkNvbXBvbmVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VudGl0eXxudWxsfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY3JlZW4gPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSBFTEVNRU5UVFlQRV9HUk9VUDtcblxuICAgICAgICAvLyBlbGVtZW50IHR5cGVzXG4gICAgICAgIHRoaXMuX2ltYWdlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdGV4dCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2dyb3VwID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIC8vIEZpdCBtb2RlXG4gICAgICAgIHRoaXMuX2ZpdE1vZGUgPSBGSVRNT0RFX1NUUkVUQ0g7XG5cbiAgICAgICAgLy8gaW5wdXQgcmVsYXRlZFxuICAgICAgICB0aGlzLl91c2VJbnB1dCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtMQVlFUklEX1VJXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IFVJIGxheWVyXG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWxzID0gW107IC8vIHN0b3JlIG1vZGVscyB0aGF0IGhhdmUgYmVlbiBhZGRlZCB0byBsYXllciBzbyB3ZSBjYW4gcmUtYWRkIHdoZW4gbGF5ZXIgaXMgY2hhbmdlZFxuXG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBJZCA9IC0xO1xuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXAgPSBudWxsO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgLy9cblxuICAgICAgICB0aGlzLl9vZmZzZXRSZWFkQXQgPSAwO1xuICAgICAgICB0aGlzLl9tYXNrT2Zmc2V0ID0gMC41O1xuICAgICAgICB0aGlzLl9tYXNrZWRCeSA9IG51bGw7IC8vIHRoZSBlbnRpdHkgdGhhdCBpcyBtYXNraW5nIHRoaXMgZWxlbWVudFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGlzIHByZXNzZWQgd2hpbGUgdGhlIGN1cnNvciBpcyBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW5cbiAgICAgKiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjbW91c2Vkb3duXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnKS5FbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBpcyByZWxlYXNlZCB3aGlsZSB0aGUgY3Vyc29yIGlzIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlblxuICAgICAqIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCNtb3VzZXVwXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnKS5FbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBjdXJzb3IgZW50ZXJzIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjbW91c2VlbnRlclxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9pbnB1dC9lbGVtZW50LWlucHV0LmpzJykuRWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgbW91c2UgY3Vyc29yIGxlYXZlcyB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I21vdXNlbGVhdmVcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vaW5wdXQvZWxlbWVudC1pbnB1dC5qcycpLkVsZW1lbnRNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGN1cnNvciBpcyBtb3ZlZCBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I21vdXNlbW92ZVxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9pbnB1dC9lbGVtZW50LWlucHV0LmpzJykuRWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgbW91c2Ugd2hlZWwgaXMgc2Nyb2xsZWQgb24gdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCNtb3VzZXdoZWVsXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnKS5FbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBpcyBwcmVzc2VkIGFuZCByZWxlYXNlZCBvbiB0aGUgY29tcG9uZW50IG9yIHdoZW4gYSB0b3VjaCBzdGFydHMgYW5kXG4gICAgICogZW5kcyBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I2NsaWNrXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnKS5FbGVtZW50TW91c2VFdmVudHxpbXBvcnQoJy4uLy4uL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnKS5FbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgdG91Y2ggc3RhcnRzIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjdG91Y2hzdGFydFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9pbnB1dC9lbGVtZW50LWlucHV0LmpzJykuRWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHRvdWNoIGVuZHMgb24gdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCN0b3VjaGVuZFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9pbnB1dC9lbGVtZW50LWlucHV0LmpzJykuRWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHRvdWNoIG1vdmVzIGFmdGVyIGl0IHN0YXJ0ZWQgdG91Y2hpbmcgdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0XG4gICAgICogaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I3RvdWNobW92ZVxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9pbnB1dC9lbGVtZW50LWlucHV0LmpzJykuRWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHRvdWNoIGlzIGNhbmNlbGVkIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjdG91Y2hjYW5jZWxcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vaW5wdXQvZWxlbWVudC1pbnB1dC5qcycpLkVsZW1lbnRUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIGdldCBfYWJzTGVmdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsQW5jaG9yLnggKyB0aGlzLl9tYXJnaW4ueDtcbiAgICB9XG5cbiAgICBnZXQgX2Fic1JpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IueiAtIHRoaXMuX21hcmdpbi56O1xuICAgIH1cblxuICAgIGdldCBfYWJzVG9wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IudyAtIHRoaXMuX21hcmdpbi53O1xuICAgIH1cblxuICAgIGdldCBfYWJzQm90dG9tKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IueSArIHRoaXMuX21hcmdpbi55O1xuICAgIH1cblxuICAgIGdldCBfaGFzU3BsaXRBbmNob3JzWCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguYWJzKHRoaXMuX2FuY2hvci54IC0gdGhpcy5fYW5jaG9yLnopID4gMC4wMDE7XG4gICAgfVxuXG4gICAgZ2V0IF9oYXNTcGxpdEFuY2hvcnNZKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5hYnModGhpcy5fYW5jaG9yLnkgLSB0aGlzLl9hbmNob3IudykgPiAwLjAwMTtcbiAgICB9XG5cbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSByZXR1cm4gdGhpcy5faW1hZ2UuYWFiYjtcbiAgICAgICAgaWYgKHRoaXMuX3RleHQpIHJldHVybiB0aGlzLl90ZXh0LmFhYmI7XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHdoZXJlIHRoZSBsZWZ0LCBib3R0b20sIHJpZ2h0IGFuZCB0b3AgZWRnZXMgb2YgdGhlIGNvbXBvbmVudCBhcmUgYW5jaG9yZWQgcmVsYXRpdmVcbiAgICAgKiB0byBpdHMgcGFyZW50LiBFYWNoIHZhbHVlIHJhbmdlcyBmcm9tIDAgdG8gMS4gZS5nLiBhIHZhbHVlIG9mIFswLCAwLCAwLCAwXSBtZWFucyB0aGF0IHRoZVxuICAgICAqIGVsZW1lbnQgd2lsbCBiZSBhbmNob3JlZCB0byB0aGUgYm90dG9tIGxlZnQgb2YgaXRzIHBhcmVudC4gQSB2YWx1ZSBvZiBbMSwgMSwgMSwgMV0gbWVhbnMgaXRcbiAgICAgKiB3aWxsIGJlIGFuY2hvcmVkIHRvIHRoZSB0b3AgcmlnaHQuIEEgc3BsaXQgYW5jaG9yIGlzIHdoZW4gdGhlIGxlZnQtcmlnaHQgb3IgdG9wLWJvdHRvbSBwYWlyc1xuICAgICAqIG9mIHRoZSBhbmNob3IgYXJlIG5vdCBlcXVhbC4gSW4gdGhhdCBjYXNlIHRoZSBjb21wb25lbnQgd2lsbCBiZSByZXNpemVkIHRvIGNvdmVyIHRoYXQgZW50aXJlXG4gICAgICogYXJlYS4gZS5nLiBhIHZhbHVlIG9mIFswLCAwLCAxLCAxXSB3aWxsIG1ha2UgdGhlIGNvbXBvbmVudCByZXNpemUgZXhhY3RseSBhcyBpdHMgcGFyZW50LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5hcHAucm9vdC5maW5kQnlOYW1lKFwiSW52ZW50b3J5XCIpLmVsZW1lbnQuYW5jaG9yID0gbmV3IHBjLlZlYzQoTWF0aC5yYW5kb20oKSAqIDAuMSwgMCwgMSwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5hcHAucm9vdC5maW5kQnlOYW1lKFwiSW52ZW50b3J5XCIpLmVsZW1lbnQuYW5jaG9yID0gW01hdGgucmFuZG9tKCkgKiAwLjEsIDAsIDEsIDBdO1xuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzQgfCBudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgYW5jaG9yKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci5jb3B5KHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci5zZXQoLi4udmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmVudGl0eS5fcGFyZW50ICYmICF0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlTG9jYWxBbmNob3JzKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVTaXplKHRoaXMuX2hhc1NwbGl0QW5jaG9yc1gsIHRoaXMuX2hhc1NwbGl0QW5jaG9yc1kpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIGlmICghdGhpcy5lbnRpdHkuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5fZGlydGlmeUxvY2FsKCk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6YW5jaG9yJywgdGhpcy5fYW5jaG9yKTtcbiAgICB9XG5cbiAgICBnZXQgYW5jaG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5jaG9yO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBlbGVtZW50IHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5FTEVNRU5ULCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdmFsdWUgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLkVMRU1FTlQsIHZhbHVlLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUgPCAwICYmIHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAvLyByZS1hZGQgbW9kZWwgdG8gc2NlbmUsIGluIGNhc2UgaXQgd2FzIHJlbW92ZWQgYnkgYmF0Y2hpbmdcbiAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZSAmJiB0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycyh0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3RleHQgJiYgdGhpcy5fdGV4dC5fbW9kZWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnModGhpcy5fdGV4dC5fbW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cElkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGJhdGNoR3JvdXBJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoR3JvdXBJZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgYm90dG9tIGVkZ2Ugb2YgdGhlIGFuY2hvci4gQ2FuIGJlIHVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBhIHNwbGl0XG4gICAgICogYW5jaG9yIHRvIG1ha2UgdGhlIGNvbXBvbmVudCdzIHRvcCBlZGdlIGFsd2F5cyBiZSAndG9wJyB1bml0cyBhd2F5IGZyb20gdGhlIHRvcC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGJvdHRvbSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4ueSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3dCA9IHRoaXMuX2Fic1RvcDtcbiAgICAgICAgY29uc3Qgd2IgPSB0aGlzLl9sb2NhbEFuY2hvci55ICsgdmFsdWU7XG4gICAgICAgIHRoaXMuX3NldEhlaWdodCh3dCAtIHdiKTtcblxuICAgICAgICBwLnkgPSB2YWx1ZSArIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQgKiB0aGlzLl9waXZvdC55O1xuICAgICAgICB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHApO1xuICAgIH1cblxuICAgIGdldCBib3R0b20oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXJnaW4ueTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggYXQgd2hpY2ggdGhlIGVsZW1lbnQgd2lsbCBiZSByZW5kZXJlZC4gSW4gbW9zdCBjYXNlcyB0aGlzIHdpbGwgYmUgdGhlIHNhbWUgYXNcbiAgICAgKiBgd2lkdGhgLiBIb3dldmVyLCBpbiBzb21lIGNhc2VzIHRoZSBlbmdpbmUgbWF5IGNhbGN1bGF0ZSBhIGRpZmZlcmVudCB3aWR0aCBmb3IgdGhlIGVsZW1lbnQsXG4gICAgICogc3VjaCBhcyB3aGVuIHRoZSBlbGVtZW50IGlzIHVuZGVyIHRoZSBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gSW4gdGhlc2VcbiAgICAgKiBzY2VuYXJpb3MsIGBjYWxjdWxhdGVkV2lkdGhgIG1heSBiZSBzbWFsbGVyIG9yIGxhcmdlciB0aGFuIHRoZSB3aWR0aCB0aGF0IHdhcyBzZXQgaW4gdGhlXG4gICAgICogZWRpdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgY2FsY3VsYXRlZFdpZHRoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRXaWR0aCh2YWx1ZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZWRXaWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IGF0IHdoaWNoIHRoZSBlbGVtZW50IHdpbGwgYmUgcmVuZGVyZWQuIEluIG1vc3QgY2FzZXMgdGhpcyB3aWxsIGJlIHRoZSBzYW1lIGFzXG4gICAgICogYGhlaWdodGAuIEhvd2V2ZXIsIGluIHNvbWUgY2FzZXMgdGhlIGVuZ2luZSBtYXkgY2FsY3VsYXRlIGEgZGlmZmVyZW50IGhlaWdodCBmb3IgdGhlIGVsZW1lbnQsXG4gICAgICogc3VjaCBhcyB3aGVuIHRoZSBlbGVtZW50IGlzIHVuZGVyIHRoZSBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gSW4gdGhlc2VcbiAgICAgKiBzY2VuYXJpb3MsIGBjYWxjdWxhdGVkSGVpZ2h0YCBtYXkgYmUgc21hbGxlciBvciBsYXJnZXIgdGhhbiB0aGUgaGVpZ2h0IHRoYXQgd2FzIHNldCBpbiB0aGVcbiAgICAgKiBlZGl0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjYWxjdWxhdGVkSGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRIZWlnaHQodmFsdWUsIHRydWUpO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVkSGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FsY3VsYXRlZEhlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiA0IHtAbGluayBWZWMyfXMgdGhhdCByZXByZXNlbnQgdGhlIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCBhbmQgdG9wXG4gICAgICogbGVmdCBjb3JuZXJzIG9mIHRoZSBjb21wb25lbnQgaW4gY2FudmFzIHBpeGVscy4gT25seSB3b3JrcyBmb3Igc2NyZWVuIHNwYWNlIGVsZW1lbnRcbiAgICAgKiBjb21wb25lbnRzLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzJbXX1cbiAgICAgKi9cbiAgICBnZXQgY2FudmFzQ29ybmVycygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jYW52YXNDb3JuZXJzRGlydHkgfHwgIXRoaXMuc2NyZWVuIHx8ICF0aGlzLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY2FudmFzQ29ybmVycztcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjcmVlbkNvcm5lcnMgPSB0aGlzLnNjcmVlbkNvcm5lcnM7XG4gICAgICAgIGNvbnN0IHN4ID0gZGV2aWNlLmNhbnZhcy5jbGllbnRXaWR0aCAvIGRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3Qgc3kgPSBkZXZpY2UuY2FudmFzLmNsaWVudEhlaWdodCAvIGRldmljZS5oZWlnaHQ7XG5cbiAgICAgICAgLy8gc2NhbGUgc2NyZWVuIGNvcm5lcnMgdG8gY2FudmFzIHNpemUgYW5kIHJldmVyc2UgeVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fY2FudmFzQ29ybmVyc1tpXS5zZXQoc2NyZWVuQ29ybmVyc1tpXS54ICogc3gsIChkZXZpY2UuaGVpZ2h0IC0gc2NyZWVuQ29ybmVyc1tpXS55KSAqIHN5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9jYW52YXNDb3JuZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkcmF3IG9yZGVyIG9mIHRoZSBjb21wb25lbnQuIEEgaGlnaGVyIHZhbHVlIG1lYW5zIHRoYXQgdGhlIGNvbXBvbmVudCB3aWxsIGJlIHJlbmRlcmVkIG9uXG4gICAgICogdG9wIG9mIG90aGVyIGNvbXBvbmVudHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBkcmF3T3JkZXIodmFsdWUpIHtcbiAgICAgICAgbGV0IHByaW9yaXR5ID0gMDtcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICBwcmlvcml0eSA9IHRoaXMuc2NyZWVuLnNjcmVlbi5wcmlvcml0eTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA+IDB4RkZGRkZGKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKCdFbGVtZW50LmRyYXdPcmRlciBsYXJnZXIgdGhhbiBtYXggc2l6ZSBvZjogJyArIDB4RkZGRkZGKTtcbiAgICAgICAgICAgIHZhbHVlID0gMHhGRkZGRkY7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzY3JlZW4gcHJpb3JpdHkgaXMgc3RvcmVkIGluIHRoZSB0b3AgOCBiaXRzXG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IChwcmlvcml0eSA8PCAyNCkgKyB2YWx1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6ZHJhd29yZGVyJywgdGhpcy5fZHJhd09yZGVyKTtcbiAgICB9XG5cbiAgICBnZXQgZHJhd09yZGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZHJhd09yZGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgYXMgc2V0IGluIHRoZSBlZGl0b3IuIE5vdGUgdGhhdCBpbiBzb21lIGNhc2VzIHRoaXMgbWF5IG5vdCByZWZsZWN0XG4gICAgICogdGhlIHRydWUgaGVpZ2h0IGF0IHdoaWNoIHRoZSBlbGVtZW50IGlzIHJlbmRlcmVkLCBzdWNoIGFzIHdoZW4gdGhlIGVsZW1lbnQgaXMgdW5kZXIgdGhlXG4gICAgICogY29udHJvbCBvZiBhIHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudH0uIFNlZSBgY2FsY3VsYXRlZEhlaWdodGAgaW4gb3JkZXIgdG8gZW5zdXJlIHlvdSBhcmVcbiAgICAgKiByZWFkaW5nIHRoZSB0cnVlIGhlaWdodCBhdCB3aGljaCB0aGUgZWxlbWVudCB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5faGFzU3BsaXRBbmNob3JzWSkge1xuICAgICAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZEhlaWdodCh2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDpoZWlnaHQnLCB0aGlzLl9oZWlnaHQpO1xuICAgIH1cblxuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbGF5ZXIgSURzICh7QGxpbmsgTGF5ZXIjaWR9KSB0byB3aGljaCB0aGlzIGVsZW1lbnQgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCxcbiAgICAgKiBwb3AsIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZGVkTW9kZWxzLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fYWRkZWRNb2RlbHNbal0ubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sYXllcnMgPSB2YWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCB8fCAhdGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoKSByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9hZGRlZE1vZGVsc1tqXS5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGFuY2hvci4gQ2FuIGJlIHVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBhIHNwbGl0XG4gICAgICogYW5jaG9yIHRvIG1ha2UgdGhlIGNvbXBvbmVudCdzIGxlZnQgZWRnZSBhbHdheXMgYmUgJ2xlZnQnIHVuaXRzIGF3YXkgZnJvbSB0aGUgbGVmdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxlZnQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWFyZ2luLnggPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgY29uc3Qgd3IgPSB0aGlzLl9hYnNSaWdodDtcbiAgICAgICAgY29uc3Qgd2wgPSB0aGlzLl9sb2NhbEFuY2hvci54ICsgdmFsdWU7XG4gICAgICAgIHRoaXMuX3NldFdpZHRoKHdyIC0gd2wpO1xuXG4gICAgICAgIHAueCA9IHZhbHVlICsgdGhpcy5fY2FsY3VsYXRlZFdpZHRoICogdGhpcy5fcGl2b3QueDtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcbiAgICB9XG5cbiAgICBnZXQgbGVmdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcmdpbi54O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBsZWZ0LCBib3R0b20sIHJpZ2h0IGFuZCB0b3AgZWRnZXMgb2YgdGhlIGFuY2hvci4gRm9yIGV4YW1wbGUgaWYgd2UgYXJlXG4gICAgICogdXNpbmcgYSBzcGxpdCBhbmNob3IgbGlrZSBbMCwwLDEsMV0gYW5kIHRoZSBtYXJnaW4gaXMgWzAsMCwwLDBdIHRoZW4gdGhlIGNvbXBvbmVudCB3aWxsIGJlXG4gICAgICogdGhlIHNhbWUgd2lkdGggYW5kIGhlaWdodCBhcyBpdHMgcGFyZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzR9XG4gICAgICovXG4gICAgc2V0IG1hcmdpbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4uY29weSh2YWx1ZSk7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNpemUodHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0Om1hcmdpbicsIHRoaXMuX21hcmdpbik7XG4gICAgfVxuXG4gICAgZ2V0IG1hcmdpbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcmdpbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGVudGl0eSB0aGF0IGlzIGN1cnJlbnRseSBtYXNraW5nIHRoaXMgZWxlbWVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBnZXQgbWFza2VkQnkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrZWRCeTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcG9zaXRpb24gb2YgdGhlIHBpdm90IG9mIHRoZSBjb21wb25lbnQgcmVsYXRpdmUgdG8gaXRzIGFuY2hvci4gRWFjaCB2YWx1ZSByYW5nZXMgZnJvbSAwXG4gICAgICogdG8gMSB3aGVyZSBbMCwwXSBpcyB0aGUgYm90dG9tIGxlZnQgYW5kIFsxLDFdIGlzIHRoZSB0b3AgcmlnaHQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmFwcC5yb290LmZpbmRCeU5hbWUoXCJJbnZlbnRvcnlcIikuZWxlbWVudC5waXZvdCA9IFtNYXRoLnJhbmRvbSgpICogMC4xLCBNYXRoLnJhbmRvbSgpICogMC4xXTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmFwcC5yb290LmZpbmRCeU5hbWUoXCJJbnZlbnRvcnlcIikuZWxlbWVudC5waXZvdCA9IG5ldyBwYy5WZWMyKE1hdGgucmFuZG9tKCkgKiAwLjEsIE1hdGgucmFuZG9tKCkgKiAwLjEpO1xuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzIgfCBudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgcGl2b3QodmFsdWUpIHtcbiAgICAgICAgY29uc3QgeyBwaXZvdCwgbWFyZ2luIH0gPSB0aGlzO1xuICAgICAgICBjb25zdCBwcmV2WCA9IHBpdm90Lng7XG4gICAgICAgIGNvbnN0IHByZXZZID0gcGl2b3QueTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBWZWMyKSB7XG4gICAgICAgICAgICBwaXZvdC5jb3B5KHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBpdm90LnNldCguLi52YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBteCA9IG1hcmdpbi54ICsgbWFyZ2luLno7XG4gICAgICAgIGNvbnN0IGR4ID0gcGl2b3QueCAtIHByZXZYO1xuICAgICAgICBtYXJnaW4ueCArPSBteCAqIGR4O1xuICAgICAgICBtYXJnaW4ueiAtPSBteCAqIGR4O1xuXG4gICAgICAgIGNvbnN0IG15ID0gbWFyZ2luLnkgKyBtYXJnaW4udztcbiAgICAgICAgY29uc3QgZHkgPSBwaXZvdC55IC0gcHJldlk7XG4gICAgICAgIG1hcmdpbi55ICs9IG15ICogZHk7XG4gICAgICAgIG1hcmdpbi53IC09IG15ICogZHk7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU2l6ZShmYWxzZSwgZmFsc2UpO1xuXG4gICAgICAgIC8vIHdlIG5lZWQgdG8gZmxhZyBjaGlsZHJlbiBhcyBkaXJ0eSB0b29cbiAgICAgICAgLy8gaW4gb3JkZXIgZm9yIHRoZW0gdG8gdXBkYXRlIHRoZWlyIHBvc2l0aW9uXG4gICAgICAgIHRoaXMuX2ZsYWdDaGlsZHJlbkFzRGlydHkoKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDpwaXZvdCcsIHBpdm90KTtcbiAgICB9XG5cbiAgICBnZXQgcGl2b3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXZvdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgYW5jaG9yLiBDYW4gYmUgdXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIGEgc3BsaXRcbiAgICAgKiBhbmNob3IgdG8gbWFrZSB0aGUgY29tcG9uZW50J3MgcmlnaHQgZWRnZSBhbHdheXMgYmUgJ3JpZ2h0JyB1bml0cyBhd2F5IGZyb20gdGhlIHJpZ2h0LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcmlnaHQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWFyZ2luLnogPSB2YWx1ZTtcblxuICAgICAgICAvLyB1cGRhdGUgd2lkdGhcbiAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgY29uc3Qgd2wgPSB0aGlzLl9hYnNMZWZ0O1xuICAgICAgICBjb25zdCB3ciA9IHRoaXMuX2xvY2FsQW5jaG9yLnogLSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fc2V0V2lkdGgod3IgLSB3bCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHBvc2l0aW9uXG4gICAgICAgIHAueCA9ICh0aGlzLl9sb2NhbEFuY2hvci56IC0gdGhpcy5fbG9jYWxBbmNob3IueCkgLSB2YWx1ZSAtICh0aGlzLl9jYWxjdWxhdGVkV2lkdGggKiAoMSAtIHRoaXMuX3Bpdm90LngpKTtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcbiAgICB9XG5cbiAgICBnZXQgcmlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXJnaW4uejtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiA0IHtAbGluayBWZWMzfXMgdGhhdCByZXByZXNlbnQgdGhlIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCBhbmQgdG9wXG4gICAgICogbGVmdCBjb3JuZXJzIG9mIHRoZSBjb21wb25lbnQgcmVsYXRpdmUgdG8gaXRzIHBhcmVudCB7QGxpbmsgU2NyZWVuQ29tcG9uZW50fS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzW119XG4gICAgICovXG4gICAgZ2V0IHNjcmVlbkNvcm5lcnMoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29ybmVyc0RpcnR5IHx8ICF0aGlzLnNjcmVlbilcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zY3JlZW5Db3JuZXJzO1xuXG4gICAgICAgIGNvbnN0IHBhcmVudEJvdHRvbUxlZnQgPSB0aGlzLmVudGl0eS5wYXJlbnQgJiYgdGhpcy5lbnRpdHkucGFyZW50LmVsZW1lbnQgJiYgdGhpcy5lbnRpdHkucGFyZW50LmVsZW1lbnQuc2NyZWVuQ29ybmVyc1swXTtcblxuICAgICAgICAvLyBpbml0IGNvcm5lcnNcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVyc1swXS5zZXQodGhpcy5fYWJzTGVmdCwgdGhpcy5fYWJzQm90dG9tLCAwKTtcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVyc1sxXS5zZXQodGhpcy5fYWJzUmlnaHQsIHRoaXMuX2Fic0JvdHRvbSwgMCk7XG4gICAgICAgIHRoaXMuX3NjcmVlbkNvcm5lcnNbMl0uc2V0KHRoaXMuX2Fic1JpZ2h0LCB0aGlzLl9hYnNUb3AsIDApO1xuICAgICAgICB0aGlzLl9zY3JlZW5Db3JuZXJzWzNdLnNldCh0aGlzLl9hYnNMZWZ0LCB0aGlzLl9hYnNUb3AsIDApO1xuXG4gICAgICAgIC8vIHRyYW5zZm9ybSBjb3JuZXJzIHRvIHNjcmVlbiBzcGFjZVxuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IHRoaXMuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX3NjcmVlblRyYW5zZm9ybS50cmFuc2Zvcm1Qb2ludCh0aGlzLl9zY3JlZW5Db3JuZXJzW2ldLCB0aGlzLl9zY3JlZW5Db3JuZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChzY3JlZW5TcGFjZSlcbiAgICAgICAgICAgICAgICB0aGlzLl9zY3JlZW5Db3JuZXJzW2ldLm11bFNjYWxhcih0aGlzLnNjcmVlbi5zY3JlZW4uc2NhbGUpO1xuXG4gICAgICAgICAgICBpZiAocGFyZW50Qm90dG9tTGVmdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NjcmVlbkNvcm5lcnNbaV0uYWRkKHBhcmVudEJvdHRvbUxlZnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY29ybmVyc0RpcnR5ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fc2NyZWVuQ29ybmVycztcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgdGV4dCByZW5kZXJlZCBieSB0aGUgY29tcG9uZW50LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB0ZXh0V2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0ID8gdGhpcy5fdGV4dC53aWR0aCA6IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgdGV4dCByZW5kZXJlZCBieSB0aGUgY29tcG9uZW50LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB0ZXh0SGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dCA/IHRoaXMuX3RleHQuaGVpZ2h0IDogMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdG9wIGVkZ2Ugb2YgdGhlIGFuY2hvci4gQ2FuIGJlIHVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBhIHNwbGl0IGFuY2hvclxuICAgICAqIHRvIG1ha2UgdGhlIGNvbXBvbmVudCdzIGJvdHRvbSBlZGdlIGFsd2F5cyBiZSAnYm90dG9tJyB1bml0cyBhd2F5IGZyb20gdGhlIGJvdHRvbS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHRvcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4udyA9IHZhbHVlO1xuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3YiA9IHRoaXMuX2Fic0JvdHRvbTtcbiAgICAgICAgY29uc3Qgd3QgPSB0aGlzLl9sb2NhbEFuY2hvci53IC0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3NldEhlaWdodCh3dCAtIHdiKTtcblxuICAgICAgICBwLnkgPSAodGhpcy5fbG9jYWxBbmNob3IudyAtIHRoaXMuX2xvY2FsQW5jaG9yLnkpIC0gdmFsdWUgLSB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0ICogKDEgLSB0aGlzLl9waXZvdC55KTtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcbiAgICB9XG5cbiAgICBnZXQgdG9wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFyZ2luLnc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIEVsZW1lbnRDb21wb25lbnQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEVMRU1FTlRUWVBFX0dST1VQfTogVGhlIGNvbXBvbmVudCBjYW4gYmUgdXNlZCBhcyBhIGxheW91dCBtZWNoYW5pc20gdG8gY3JlYXRlIGdyb3VwcyBvZlxuICAgICAqIEVsZW1lbnRDb21wb25lbnRzIGUuZy4gcGFuZWxzLlxuICAgICAqIC0ge0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfTogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhbiBpbWFnZVxuICAgICAqIC0ge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9OiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIHRleHRcbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IEVMRU1FTlRUWVBFX0lNQUdFKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2UgPSBuZXcgSW1hZ2VFbGVtZW50KHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gRUxFTUVOVFRZUEVfVEVYVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSBuZXcgVGV4dEVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGVuIHRoZSBjb21wb25lbnQgd2lsbCByZWNlaXZlIE1vdXNlIG9yIFRvdWNoIGlucHV0IGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCB1c2VJbnB1dCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdXNlSW5wdXQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3VzZUlucHV0ID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LmFkZEVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LnJlbW92ZUVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fdXNlSW5wdXQgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdFbGVtZW50cyB3aWxsIG5vdCBnZXQgYW55IGlucHV0IGV2ZW50cyBiZWNhdXNlIHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQgaXMgbm90IGNyZWF0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnVzZUlucHV0JywgdmFsdWUpO1xuICAgIH1cblxuICAgIGdldCB1c2VJbnB1dCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VzZUlucHV0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBob3cgdGhlIGNvbnRlbnQgc2hvdWxkIGJlIGZpdHRlZCBhbmQgcHJlc2VydmUgdGhlIGFzcGVjdCByYXRpbyBvZiB0aGUgc291cmNlIHRleHR1cmUgb3Igc3ByaXRlLlxuICAgICAqIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJVE1PREVfU1RSRVRDSH06IEZpdCB0aGUgY29udGVudCBleGFjdGx5IHRvIEVsZW1lbnQncyBib3VuZGluZyBib3guXG4gICAgICogLSB7QGxpbmsgRklUTU9ERV9DT05UQUlOfTogRml0IHRoZSBjb250ZW50IHdpdGhpbiB0aGUgRWxlbWVudCdzIGJvdW5kaW5nIGJveCB3aGlsZSBwcmVzZXJ2aW5nIGl0cyBBc3BlY3QgUmF0aW8uXG4gICAgICogLSB7QGxpbmsgRklUTU9ERV9DT1ZFUn06IEZpdCB0aGUgY29udGVudCB0byBjb3ZlciB0aGUgZW50aXJlIEVsZW1lbnQncyBib3VuZGluZyBib3ggd2hpbGUgcHJlc2VydmluZyBpdHMgQXNwZWN0IFJhdGlvLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzZXQgZml0TW9kZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9maXRNb2RlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNpemUodHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgdGhpcy5faW1hZ2UucmVmcmVzaE1lc2goKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmaXRNb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZml0TW9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIGVsZW1lbnQgYXMgc2V0IGluIHRoZSBlZGl0b3IuIE5vdGUgdGhhdCBpbiBzb21lIGNhc2VzIHRoaXMgbWF5IG5vdCByZWZsZWN0XG4gICAgICogdGhlIHRydWUgd2lkdGggYXQgd2hpY2ggdGhlIGVsZW1lbnQgaXMgcmVuZGVyZWQsIHN1Y2ggYXMgd2hlbiB0aGUgZWxlbWVudCBpcyB1bmRlciB0aGVcbiAgICAgKiBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gU2VlIGBjYWxjdWxhdGVkV2lkdGhgIGluIG9yZGVyIHRvIGVuc3VyZSB5b3UgYXJlXG4gICAgICogcmVhZGluZyB0aGUgdHJ1ZSB3aWR0aCBhdCB3aGljaCB0aGUgZWxlbWVudCB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgd2lkdGgodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB2YWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMuX2hhc1NwbGl0QW5jaG9yc1gpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRXaWR0aCh2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDp3aWR0aCcsIHRoaXMuX3dpZHRoKTtcbiAgICB9XG5cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiA0IHtAbGluayBWZWMzfXMgdGhhdCByZXByZXNlbnQgdGhlIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCBhbmQgdG9wXG4gICAgICogbGVmdCBjb3JuZXJzIG9mIHRoZSBjb21wb25lbnQgaW4gd29ybGQgc3BhY2UuIE9ubHkgd29ya3MgZm9yIDNEIGVsZW1lbnQgY29tcG9uZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzW119XG4gICAgICovXG4gICAgZ2V0IHdvcmxkQ29ybmVycygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl93b3JsZENvcm5lcnNEaXJ0eSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dvcmxkQ29ybmVycztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgY29uc3Qgc2NyZWVuQ29ybmVycyA9IHRoaXMuc2NyZWVuQ29ybmVycztcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgICAgICBtYXRBLmNvcHkodGhpcy5zY3JlZW4uc2NyZWVuLl9zY3JlZW5NYXRyaXgpO1xuXG4gICAgICAgICAgICAgICAgLy8gZmxpcCBzY3JlZW4gbWF0cml4IGFsb25nIHRoZSBob3Jpem9udGFsIGF4aXNcbiAgICAgICAgICAgICAgICBtYXRBLmRhdGFbMTNdID0gLW1hdEEuZGF0YVsxM107XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdHJhbnNmb3JtIHRoYXQgYnJpbmdzIHNjcmVlbiBjb3JuZXJzIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICAgICAgbWF0QS5tdWwyKHRoaXMuc2NyZWVuLmdldFdvcmxkVHJhbnNmb3JtKCksIG1hdEEpO1xuXG4gICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIHNjcmVlbiBjb3JuZXJzIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0QS50cmFuc2Zvcm1Qb2ludChzY3JlZW5Db3JuZXJzW2ldLCB0aGlzLl93b3JsZENvcm5lcnNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGxvY2FsUG9zID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuXG4gICAgICAgICAgICAvLyByb3RhdGUgYW5kIHNjYWxlIGFyb3VuZCBwaXZvdFxuICAgICAgICAgICAgbWF0QS5zZXRUcmFuc2xhdGUoLWxvY2FsUG9zLngsIC1sb2NhbFBvcy55LCAtbG9jYWxQb3Mueik7XG4gICAgICAgICAgICBtYXRCLnNldFRSUyhWZWMzLlpFUk8sIHRoaXMuZW50aXR5LmdldExvY2FsUm90YXRpb24oKSwgdGhpcy5lbnRpdHkuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgIG1hdEMuc2V0VHJhbnNsYXRlKGxvY2FsUG9zLngsIGxvY2FsUG9zLnksIGxvY2FsUG9zLnopO1xuXG4gICAgICAgICAgICAvLyBnZXQgcGFyZW50IHdvcmxkIHRyYW5zZm9ybSAoYnV0IHVzZSB0aGlzIGVudGl0eSBpZiB0aGVyZSBpcyBubyBwYXJlbnQpXG4gICAgICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eS5wYXJlbnQgPyB0aGlzLmVudGl0eS5wYXJlbnQgOiB0aGlzLmVudGl0eTtcbiAgICAgICAgICAgIG1hdEQuY29weShlbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG4gICAgICAgICAgICBtYXRELm11bChtYXRDKS5tdWwobWF0QikubXVsKG1hdEEpO1xuXG4gICAgICAgICAgICAvLyBib3R0b20gbGVmdFxuICAgICAgICAgICAgdmVjQS5zZXQobG9jYWxQb3MueCAtIHRoaXMucGl2b3QueCAqIHRoaXMuY2FsY3VsYXRlZFdpZHRoLCBsb2NhbFBvcy55IC0gdGhpcy5waXZvdC55ICogdGhpcy5jYWxjdWxhdGVkSGVpZ2h0LCBsb2NhbFBvcy56KTtcbiAgICAgICAgICAgIG1hdEQudHJhbnNmb3JtUG9pbnQodmVjQSwgdGhpcy5fd29ybGRDb3JuZXJzWzBdKTtcblxuICAgICAgICAgICAgLy8gYm90dG9tIHJpZ2h0XG4gICAgICAgICAgICB2ZWNBLnNldChsb2NhbFBvcy54ICsgKDEgLSB0aGlzLnBpdm90LngpICogdGhpcy5jYWxjdWxhdGVkV2lkdGgsIGxvY2FsUG9zLnkgLSB0aGlzLnBpdm90LnkgKiB0aGlzLmNhbGN1bGF0ZWRIZWlnaHQsIGxvY2FsUG9zLnopO1xuICAgICAgICAgICAgbWF0RC50cmFuc2Zvcm1Qb2ludCh2ZWNBLCB0aGlzLl93b3JsZENvcm5lcnNbMV0pO1xuXG4gICAgICAgICAgICAvLyB0b3AgcmlnaHRcbiAgICAgICAgICAgIHZlY0Euc2V0KGxvY2FsUG9zLnggKyAoMSAtIHRoaXMucGl2b3QueCkgKiB0aGlzLmNhbGN1bGF0ZWRXaWR0aCwgbG9jYWxQb3MueSArICgxIC0gdGhpcy5waXZvdC55KSAqIHRoaXMuY2FsY3VsYXRlZEhlaWdodCwgbG9jYWxQb3Mueik7XG4gICAgICAgICAgICBtYXRELnRyYW5zZm9ybVBvaW50KHZlY0EsIHRoaXMuX3dvcmxkQ29ybmVyc1syXSk7XG5cbiAgICAgICAgICAgIC8vIHRvcCBsZWZ0XG4gICAgICAgICAgICB2ZWNBLnNldChsb2NhbFBvcy54IC0gdGhpcy5waXZvdC54ICogdGhpcy5jYWxjdWxhdGVkV2lkdGgsIGxvY2FsUG9zLnkgKyAoMSAtIHRoaXMucGl2b3QueSkgKiB0aGlzLmNhbGN1bGF0ZWRIZWlnaHQsIGxvY2FsUG9zLnopO1xuICAgICAgICAgICAgbWF0RC50cmFuc2Zvcm1Qb2ludCh2ZWNBLCB0aGlzLl93b3JsZENvcm5lcnNbM10pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fd29ybGRDb3JuZXJzRGlydHkgPSBmYWxzZTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fd29ybGRDb3JuZXJzO1xuXG4gICAgfVxuXG4gICAgX3BhdGNoKCkge1xuICAgICAgICB0aGlzLmVudGl0eS5fc3luYyA9IHRoaXMuX3N5bmM7XG4gICAgICAgIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uID0gdGhpcy5fc2V0UG9zaXRpb247XG4gICAgICAgIHRoaXMuZW50aXR5LnNldExvY2FsUG9zaXRpb24gPSB0aGlzLl9zZXRMb2NhbFBvc2l0aW9uO1xuICAgIH1cblxuICAgIF91bnBhdGNoKCkge1xuICAgICAgICB0aGlzLmVudGl0eS5fc3luYyA9IEVudGl0eS5wcm90b3R5cGUuX3N5bmM7XG4gICAgICAgIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uID0gRW50aXR5LnByb3RvdHlwZS5zZXRQb3NpdGlvbjtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbiA9IEVudGl0eS5wcm90b3R5cGUuc2V0TG9jYWxQb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXRjaGVkIG1ldGhvZCBmb3Igc2V0dGluZyB0aGUgcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxWZWMzfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvciBWZWMzXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgeiBjb29yZGluYXRlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0UG9zaXRpb24oeCwgeSwgeikge1xuICAgICAgICBpZiAoIXRoaXMuZWxlbWVudC5zY3JlZW4pIHtcbiAgICAgICAgICAgIEVudGl0eS5wcm90b3R5cGUuc2V0UG9zaXRpb24uY2FsbCh0aGlzLCB4LCB5LCB6KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKTsgLy8gZW5zdXJlIGhpZXJhcmNoeSBpcyB1cCB0byBkYXRlXG4gICAgICAgIGludlBhcmVudFd0bS5jb3B5KHRoaXMuZWxlbWVudC5fc2NyZWVuVG9Xb3JsZCkuaW52ZXJ0KCk7XG4gICAgICAgIGludlBhcmVudFd0bS50cmFuc2Zvcm1Qb2ludChwb3NpdGlvbiwgdGhpcy5sb2NhbFBvc2l0aW9uKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXRjaGVkIG1ldGhvZCBmb3Igc2V0dGluZyB0aGUgbG9jYWwgcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxWZWMzfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvciBWZWMzXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgeiBjb29yZGluYXRlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0TG9jYWxQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIG1hcmdpblxuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50O1xuICAgICAgICBjb25zdCBwID0gdGhpcy5sb2NhbFBvc2l0aW9uO1xuICAgICAgICBjb25zdCBwdnQgPSBlbGVtZW50Ll9waXZvdDtcbiAgICAgICAgZWxlbWVudC5fbWFyZ2luLnggPSBwLnggLSBlbGVtZW50Ll9jYWxjdWxhdGVkV2lkdGggKiBwdnQueDtcbiAgICAgICAgZWxlbWVudC5fbWFyZ2luLnogPSAoZWxlbWVudC5fbG9jYWxBbmNob3IueiAtIGVsZW1lbnQuX2xvY2FsQW5jaG9yLngpIC0gZWxlbWVudC5fY2FsY3VsYXRlZFdpZHRoIC0gZWxlbWVudC5fbWFyZ2luLng7XG4gICAgICAgIGVsZW1lbnQuX21hcmdpbi55ID0gcC55IC0gZWxlbWVudC5fY2FsY3VsYXRlZEhlaWdodCAqIHB2dC55O1xuICAgICAgICBlbGVtZW50Ll9tYXJnaW4udyA9IChlbGVtZW50Ll9sb2NhbEFuY2hvci53IC0gZWxlbWVudC5fbG9jYWxBbmNob3IueSkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0IC0gZWxlbWVudC5fbWFyZ2luLnk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLy8gdGhpcyBtZXRob2Qgb3ZlcndyaXRlcyBHcmFwaE5vZGUjc3luYyBhbmQgc28gb3BlcmF0ZXMgaW4gc2NvcGUgb2YgdGhlIEVudGl0eS5cbiAgICBfc3luYygpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZWxlbWVudDtcbiAgICAgICAgY29uc3Qgc2NyZWVuID0gZWxlbWVudC5zY3JlZW47XG5cbiAgICAgICAgaWYgKHNjcmVlbikge1xuXG4gICAgICAgICAgICBpZiAoZWxlbWVudC5fYW5jaG9yRGlydHkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzeCA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IHJlc3kgPSAwO1xuICAgICAgICAgICAgICAgIGxldCBweCA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IHB5ID0gMTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9wYXJlbnQgJiYgdGhpcy5fcGFyZW50LmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNlIHBhcmVudCByZWN0XG4gICAgICAgICAgICAgICAgICAgIHJlc3ggPSB0aGlzLl9wYXJlbnQuZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIHJlc3kgPSB0aGlzLl9wYXJlbnQuZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBweCA9IHRoaXMuX3BhcmVudC5lbGVtZW50LnBpdm90Lng7XG4gICAgICAgICAgICAgICAgICAgIHB5ID0gdGhpcy5fcGFyZW50LmVsZW1lbnQucGl2b3QueTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyB1c2Ugc2NyZWVuIHJlY3RcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IHNjcmVlbi5zY3JlZW4ucmVzb2x1dGlvbjtcbiAgICAgICAgICAgICAgICAgICAgcmVzeCA9IHJlc29sdXRpb24ueCAvIHNjcmVlbi5zY3JlZW4uc2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIHJlc3kgPSByZXNvbHV0aW9uLnkgLyBzY3JlZW4uc2NyZWVuLnNjYWxlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2FuY2hvclRyYW5zZm9ybS5zZXRUcmFuc2xhdGUoKHJlc3ggKiAoZWxlbWVudC5hbmNob3IueCAtIHB4KSksIC0ocmVzeSAqIChweSAtIGVsZW1lbnQuYW5jaG9yLnkpKSwgMCk7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5fYW5jaG9yRGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBlbGVtZW50Ll9jYWxjdWxhdGVMb2NhbEFuY2hvcnMoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgZWxlbWVudCBzaXplIGlzIGRpcnR5XG4gICAgICAgICAgICAvLyByZWNhbGN1bGF0ZSBpdHMgc2l6ZVxuICAgICAgICAgICAgLy8gV0FSTklORzogT3JkZXIgaXMgaW1wb3J0YW50IGFzIGNhbGN1bGF0ZVNpemUgcmVzZXRzIGRpcnR5TG9jYWxcbiAgICAgICAgICAgIC8vIHNvIHRoaXMgbmVlZHMgdG8gcnVuIGJlZm9yZSByZXNldHRpbmcgZGlydHlMb2NhbCB0byBmYWxzZSBiZWxvd1xuICAgICAgICAgICAgaWYgKGVsZW1lbnQuX3NpemVEaXJ0eSkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2NhbGN1bGF0ZVNpemUoZmFsc2UsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLmxvY2FsUG9zaXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbiwgdGhpcy5sb2NhbFNjYWxlKTtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIG1hcmdpblxuICAgICAgICAgICAgY29uc3QgcCA9IHRoaXMubG9jYWxQb3NpdGlvbjtcbiAgICAgICAgICAgIGNvbnN0IHB2dCA9IGVsZW1lbnQuX3Bpdm90O1xuICAgICAgICAgICAgZWxlbWVudC5fbWFyZ2luLnggPSBwLnggLSBlbGVtZW50Ll9jYWxjdWxhdGVkV2lkdGggKiBwdnQueDtcbiAgICAgICAgICAgIGVsZW1lbnQuX21hcmdpbi56ID0gKGVsZW1lbnQuX2xvY2FsQW5jaG9yLnogLSBlbGVtZW50Ll9sb2NhbEFuY2hvci54KSAtIGVsZW1lbnQuX2NhbGN1bGF0ZWRXaWR0aCAtIGVsZW1lbnQuX21hcmdpbi54O1xuICAgICAgICAgICAgZWxlbWVudC5fbWFyZ2luLnkgPSBwLnkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0ICogcHZ0Lnk7XG4gICAgICAgICAgICBlbGVtZW50Ll9tYXJnaW4udyA9IChlbGVtZW50Ll9sb2NhbEFuY2hvci53IC0gZWxlbWVudC5fbG9jYWxBbmNob3IueSkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0IC0gZWxlbWVudC5fbWFyZ2luLnk7XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2NyZWVuKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5fY2FudmFzQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBlbGVtZW50Ll93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBFbnRpdHkucHJvdG90eXBlLl9zeW5jLmNhbGwodGhpcyk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5jb3B5KHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB0cmFuc2Zvcm0gZWxlbWVudCBoaWVyYXJjaHlcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fcGFyZW50LmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5fc2NyZWVuVG9Xb3JsZC5tdWwyKHRoaXMuX3BhcmVudC5lbGVtZW50Ll9tb2RlbFRyYW5zZm9ybSwgZWxlbWVudC5fYW5jaG9yVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkLmNvcHkoZWxlbWVudC5fYW5jaG9yVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlbGVtZW50Ll9tb2RlbFRyYW5zZm9ybS5tdWwyKGVsZW1lbnQuX3NjcmVlblRvV29ybGQsIHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjcmVlbikge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkLm11bDIoc2NyZWVuLnNjcmVlbi5fc2NyZWVuTWF0cml4LCBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX3NjcmVlblRvV29ybGQubXVsMihzY3JlZW4ud29ybGRUcmFuc2Zvcm0sIGVsZW1lbnQuX3NjcmVlblRvV29ybGQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5tdWwyKGVsZW1lbnQuX3NjcmVlblRvV29ybGQsIHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBwYXJlbnQgd29ybGQgdHJhbnNmb3JtXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudFdvcmxkVHJhbnNmb3JtID0gZWxlbWVudC5fcGFyZW50V29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFdvcmxkVHJhbnNmb3JtLnNldElkZW50aXR5KCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX3BhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudCAmJiBwYXJlbnQuZWxlbWVudCAmJiBwYXJlbnQgIT09IHNjcmVlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0QS5zZXRUUlMoVmVjMy5aRVJPLCBwYXJlbnQuZ2V0TG9jYWxSb3RhdGlvbigpLCBwYXJlbnQuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFdvcmxkVHJhbnNmb3JtLm11bDIocGFyZW50LmVsZW1lbnQuX3BhcmVudFdvcmxkVHJhbnNmb3JtLCBtYXRBKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBlbGVtZW50IHRyYW5zZm9ybVxuICAgICAgICAgICAgICAgICAgICAvLyByb3RhdGUgYW5kIHNjYWxlIGFyb3VuZCBwaXZvdFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXB0aE9mZnNldCA9IHZlY0E7XG4gICAgICAgICAgICAgICAgICAgIGRlcHRoT2Zmc2V0LnNldCgwLCAwLCB0aGlzLmxvY2FsUG9zaXRpb24ueik7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGl2b3RPZmZzZXQgPSB2ZWNCO1xuICAgICAgICAgICAgICAgICAgICBwaXZvdE9mZnNldC5zZXQoZWxlbWVudC5fYWJzTGVmdCArIGVsZW1lbnQuX3Bpdm90LnggKiBlbGVtZW50LmNhbGN1bGF0ZWRXaWR0aCwgZWxlbWVudC5fYWJzQm90dG9tICsgZWxlbWVudC5fcGl2b3QueSAqIGVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodCwgMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgbWF0QS5zZXRUcmFuc2xhdGUoLXBpdm90T2Zmc2V0LngsIC1waXZvdE9mZnNldC55LCAtcGl2b3RPZmZzZXQueik7XG4gICAgICAgICAgICAgICAgICAgIG1hdEIuc2V0VFJTKGRlcHRoT2Zmc2V0LCB0aGlzLmdldExvY2FsUm90YXRpb24oKSwgdGhpcy5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgICAgICAgICBtYXRDLnNldFRyYW5zbGF0ZShwaXZvdE9mZnNldC54LCBwaXZvdE9mZnNldC55LCBwaXZvdE9mZnNldC56KTtcblxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5UcmFuc2Zvcm0ubXVsMihlbGVtZW50Ll9wYXJlbnRXb3JsZFRyYW5zZm9ybSwgbWF0QykubXVsKG1hdEIpLm11bChtYXRBKTtcblxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9jb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9jYW52YXNDb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5jb3B5KGVsZW1lbnQuX21vZGVsVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkluc2VydChwYXJlbnQpIHtcbiAgICAgICAgLy8gd2hlbiB0aGUgZW50aXR5IGlzIHJlcGFyZW50ZWQgZmluZCBhIHBvc3NpYmxlIG5ldyBzY3JlZW4gYW5kIG1hc2tcblxuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9wYXJzZVVwVG9TY3JlZW4oKTtcblxuICAgICAgICB0aGlzLmVudGl0eS5fZGlydGlmeVdvcmxkKCk7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlU2NyZWVuKHJlc3VsdC5zY3JlZW4pO1xuXG4gICAgICAgIHRoaXMuX2RpcnRpZnlNYXNrKCk7XG4gICAgfVxuXG4gICAgX2RpcnRpZnlNYXNrKCkge1xuICAgICAgICBsZXQgY3VycmVudCA9IHRoaXMuZW50aXR5O1xuICAgICAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgICAgICAgLy8gc2VhcmNoIHVwIHRoZSBoaWVyYXJjaHkgdW50aWwgd2UgZmluZCBhbiBlbnRpdHkgd2hpY2ggaGFzOlxuICAgICAgICAgICAgLy8gLSBubyBwYXJlbnRcbiAgICAgICAgICAgIC8vIC0gc2NyZWVuIGNvbXBvbmVudCBvbiBwYXJlbnRcbiAgICAgICAgICAgIGNvbnN0IG5leHQgPSBjdXJyZW50LnBhcmVudDtcbiAgICAgICAgICAgIGlmICgobmV4dCA9PT0gbnVsbCB8fCBuZXh0LnNjcmVlbikgJiYgY3VycmVudC5lbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLnN5c3RlbS5fcHJlcmVuZGVyIHx8ICF0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyID0gW107XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5vbmNlKCdwcmVyZW5kZXInLCB0aGlzLl9vblByZXJlbmRlciwgdGhpcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VfSURfRUxFTUVOVCwgJ3JlZ2lzdGVyIHByZXJlbmRlcicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBpID0gdGhpcy5zeXN0ZW0uX3ByZXJlbmRlci5pbmRleE9mKHRoaXMuZW50aXR5KTtcbiAgICAgICAgICAgICAgICBpZiAoaSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBqID0gdGhpcy5zeXN0ZW0uX3ByZXJlbmRlci5pbmRleE9mKGN1cnJlbnQpO1xuICAgICAgICAgICAgICAgIGlmIChqIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLnB1c2goY3VycmVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFX0lEX0VMRU1FTlQsICdzZXQgcHJlcmVuZGVyIHJvb3QgdG86ICcgKyBjdXJyZW50Lm5hbWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjdXJyZW50ID0gbmV4dDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblByZXJlbmRlcigpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYXNrID0gdGhpcy5zeXN0ZW0uX3ByZXJlbmRlcltpXTtcbiAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFX0lEX0VMRU1FTlQsICdwcmVyZW5kZXIgZnJvbTogJyArIG1hc2submFtZSk7XG5cbiAgICAgICAgICAgIC8vIHByZXZlbnQgY2FsbCBpZiBlbGVtZW50IGhhcyBiZWVuIHJlbW92ZWQgc2luY2UgYmVpbmcgYWRkZWRcbiAgICAgICAgICAgIGlmIChtYXNrLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXB0aCA9IDE7XG4gICAgICAgICAgICAgICAgbWFzay5lbGVtZW50LnN5bmNNYXNrKGRlcHRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICBfYmluZFNjcmVlbihzY3JlZW4pIHtcbiAgICAgICAgLy8gQmluZCB0aGUgRWxlbWVudCB0byB0aGUgU2NyZWVuLiBXZSB1c2VkIHRvIHN1YnNjcmliZSB0byBTY3JlZW4gZXZlbnRzIGhlcmUuIEhvd2V2ZXIsXG4gICAgICAgIC8vIHRoYXQgd2FzIHZlcnkgc2xvdyB3aGVuIHRoZXJlIGFyZSB0aG91c2FuZHMgb2YgRWxlbWVudHMuIFdoZW4gdGhlIHRpbWUgY29tZXMgdG8gdW5iaW5kXG4gICAgICAgIC8vIHRoZSBFbGVtZW50IGZyb20gdGhlIFNjcmVlbiwgZmluZGluZyB0aGUgZXZlbnQgY2FsbGJhY2tzIHRvIHJlbW92ZSB0YWtlcyBhIGNvbnNpZGVyYWJsZVxuICAgICAgICAvLyBhbW91bnQgb2YgdGltZS4gU28gaW5zdGVhZCwgdGhlIFNjcmVlbiBzdG9yZXMgdGhlIEVsZW1lbnQgY29tcG9uZW50IGFuZCBjYWxscyBpdHNcbiAgICAgICAgLy8gZnVuY3Rpb25zIGRpcmVjdGx5LlxuICAgICAgICBzY3JlZW4uX2JpbmRFbGVtZW50KHRoaXMpO1xuICAgIH1cblxuICAgIF91bmJpbmRTY3JlZW4oc2NyZWVuKSB7XG4gICAgICAgIHNjcmVlbi5fdW5iaW5kRWxlbWVudCh0aGlzKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlU2NyZWVuKHNjcmVlbikge1xuICAgICAgICBpZiAodGhpcy5zY3JlZW4gJiYgdGhpcy5zY3JlZW4gIT09IHNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fdW5iaW5kU2NyZWVuKHRoaXMuc2NyZWVuLnNjcmVlbik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcmV2aW91c1NjcmVlbiA9IHRoaXMuc2NyZWVuO1xuICAgICAgICB0aGlzLnNjcmVlbiA9IHNjcmVlbjtcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl9iaW5kU2NyZWVuKHRoaXMuc2NyZWVuLnNjcmVlbik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTaXplKHRoaXMuX2hhc1NwbGl0QW5jaG9yc1gsIHRoaXMuX2hhc1NwbGl0QW5jaG9yc1kpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnNjcmVlbicsIHRoaXMuc2NyZWVuLCBwcmV2aW91c1NjcmVlbik7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBhbGwgY2hpbGQgc2NyZWVuc1xuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuZW50aXR5LmNoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldLmVsZW1lbnQpIGNoaWxkcmVuW2ldLmVsZW1lbnQuX3VwZGF0ZVNjcmVlbihzY3JlZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIGRyYXcgb3JkZXJcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB0aGlzLnNjcmVlbi5zY3JlZW4uc3luY0RyYXdPcmRlcigpO1xuICAgIH1cblxuICAgIHN5bmNNYXNrKGRlcHRoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX3BhcnNlVXBUb1NjcmVlbigpO1xuICAgICAgICB0aGlzLl91cGRhdGVNYXNrKHJlc3VsdC5tYXNrLCBkZXB0aCk7XG4gICAgfVxuXG4gICAgLy8gc2V0IHRoZSBtYXNrZWRieSBwcm9wZXJ0eSB0byB0aGUgZW50aXR5IHRoYXQgaXMgbWFza2luZyB0aGlzIGVsZW1lbnRcbiAgICAvLyAtIHNldCB0aGUgc3RlbmNpbCBidWZmZXIgdG8gY2hlY2sgdGhlIG1hc2sgdmFsdWVcbiAgICAvLyAgIHNvIGFzIHRvIG9ubHkgcmVuZGVyIGluc2lkZSB0aGUgbWFza1xuICAgIC8vICAgTm90ZTogaWYgdGhpcyBlbnRpdHkgaXMgaXRzZWxmIGEgbWFzayB0aGUgc3RlbmNpbCBwYXJhbXNcbiAgICAvLyAgIHdpbGwgYmUgdXBkYXRlZCBpbiB1cGRhdGVNYXNrIHRvIGluY2x1ZGUgbWFza2luZ1xuICAgIF9zZXRNYXNrZWRCeShtYXNrKSB7XG4gICAgICAgIGNvbnN0IHJlbmRlcmFibGVFbGVtZW50ID0gdGhpcy5faW1hZ2UgfHwgdGhpcy5fdGV4dDtcblxuICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgY29uc3QgcmVmID0gbWFzay5lbGVtZW50Ll9pbWFnZS5fbWFza1JlZjtcbiAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFX0lEX0VMRU1FTlQsICdtYXNraW5nOiAnICsgdGhpcy5lbnRpdHkubmFtZSArICcgd2l0aCAnICsgcmVmKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhpcyBpcyBpbWFnZSBvciB0ZXh0LCBzZXQgdGhlIHN0ZW5jaWwgcGFyYW1ldGVyc1xuICAgICAgICAgICAgcmVuZGVyYWJsZUVsZW1lbnQ/Ll9zZXRTdGVuY2lsKG5ldyBTdGVuY2lsUGFyYW1ldGVycyh7XG4gICAgICAgICAgICAgICAgcmVmOiByZWYsXG4gICAgICAgICAgICAgICAgZnVuYzogRlVOQ19FUVVBTFxuICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICB0aGlzLl9tYXNrZWRCeSA9IG1hc2s7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRV9JRF9FTEVNRU5ULCAnbm8gbWFza2luZyBvbjogJyArIHRoaXMuZW50aXR5Lm5hbWUpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgc3RlbmNpbCBwYXJhbXMgaWYgdGhpcyBpcyBpbWFnZSBvciB0ZXh0XG4gICAgICAgICAgICByZW5kZXJhYmxlRWxlbWVudD8uX3NldFN0ZW5jaWwobnVsbCk7XG5cbiAgICAgICAgICAgIHRoaXMuX21hc2tlZEJ5ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJlY3Vyc2l2ZWx5IHVwZGF0ZSBlbnRpdHkncyBzdGVuY2lsIHBhcmFtc1xuICAgIC8vIHRvIHJlbmRlciB0aGUgY29ycmVjdCB2YWx1ZSBpbnRvIHRoZSBzdGVuY2lsIGJ1ZmZlclxuICAgIF91cGRhdGVNYXNrKGN1cnJlbnRNYXNrLCBkZXB0aCkge1xuICAgICAgICBpZiAoY3VycmVudE1hc2spIHtcbiAgICAgICAgICAgIHRoaXMuX3NldE1hc2tlZEJ5KGN1cnJlbnRNYXNrKTtcblxuICAgICAgICAgICAgLy8gdGhpcyBlbGVtZW50IGlzIGFsc28gbWFza2luZyBvdGhlcnNcbiAgICAgICAgICAgIGlmICh0aGlzLm1hc2spIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWYgPSBjdXJyZW50TWFzay5lbGVtZW50Ll9pbWFnZS5fbWFza1JlZjtcbiAgICAgICAgICAgICAgICBjb25zdCBzcCA9IG5ldyBTdGVuY2lsUGFyYW1ldGVycyh7XG4gICAgICAgICAgICAgICAgICAgIHJlZjogcmVmLFxuICAgICAgICAgICAgICAgICAgICBmdW5jOiBGVU5DX0VRVUFMLFxuICAgICAgICAgICAgICAgICAgICB6cGFzczogU1RFTkNJTE9QX0lOQ1JFTUVOVFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlLl9zZXRTdGVuY2lsKHNwKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZS5fbWFza1JlZiA9IGRlcHRoO1xuXG4gICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IGNvdW50ZXIgdG8gY291bnQgbWFzayBkZXB0aFxuICAgICAgICAgICAgICAgIGRlcHRoKys7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRV9JRF9FTEVNRU5ULCAnbWFza2luZyBmcm9tOiAnICsgdGhpcy5lbnRpdHkubmFtZSArICcgd2l0aCAnICsgKHNwLnJlZiArIDEpKTtcbiAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRV9JRF9FTEVNRU5ULCAnZGVwdGgrKyB0bzogJywgZGVwdGgpO1xuXG4gICAgICAgICAgICAgICAgY3VycmVudE1hc2sgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVjdXJzZSB0aHJvdWdoIGFsbCBjaGlsZHJlblxuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLmVudGl0eS5jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRyZW5baV0uZWxlbWVudD8uX3VwZGF0ZU1hc2soY3VycmVudE1hc2ssIGRlcHRoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgbWFzayBjb3VudGVyIHdhcyBpbmNyZWFzZWQsIGRlY3JlbWVudCBpdCBhcyB3ZSBjb21lIGJhY2sgdXAgdGhlIGhpZXJhcmNoeVxuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykgZGVwdGgtLTtcblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2xlYXJpbmcgbWFza1xuICAgICAgICAgICAgdGhpcy5fc2V0TWFza2VkQnkobnVsbCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm1hc2spIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzcCA9IG5ldyBTdGVuY2lsUGFyYW1ldGVycyh7XG4gICAgICAgICAgICAgICAgICAgIHJlZjogZGVwdGgsXG4gICAgICAgICAgICAgICAgICAgIGZ1bmM6IEZVTkNfQUxXQVlTLFxuICAgICAgICAgICAgICAgICAgICB6cGFzczogU1RFTkNJTE9QX1JFUExBQ0VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZS5fc2V0U3RlbmNpbChzcCk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2UuX21hc2tSZWYgPSBkZXB0aDtcblxuICAgICAgICAgICAgICAgIC8vIGluY3JlbWVudCBtYXNrIGNvdW50ZXIgdG8gY291bnQgZGVwdGggb2YgbWFza3NcbiAgICAgICAgICAgICAgICBkZXB0aCsrO1xuXG4gICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VfSURfRUxFTUVOVCwgJ21hc2tpbmcgZnJvbTogJyArIHRoaXMuZW50aXR5Lm5hbWUgKyAnIHdpdGggJyArIHNwLnJlZik7XG4gICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VfSURfRUxFTUVOVCwgJ2RlcHRoKysgdG86ICcsIGRlcHRoKTtcblxuICAgICAgICAgICAgICAgIGN1cnJlbnRNYXNrID0gdGhpcy5lbnRpdHk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlY3Vyc2UgdGhyb3VnaCBhbGwgY2hpbGRyZW5cbiAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5lbnRpdHkuY2hpbGRyZW47XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuW2ldLmVsZW1lbnQ/Ll91cGRhdGVNYXNrKGN1cnJlbnRNYXNrLCBkZXB0aCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGRlY3JlbWVudCBtYXNrIGNvdW50ZXIgYXMgd2UgY29tZSBiYWNrIHVwIHRoZSBoaWVyYXJjaHlcbiAgICAgICAgICAgIGlmICh0aGlzLm1hc2spIGRlcHRoLS07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZWFyY2ggdXAgdGhlIHBhcmVudCBoaWVyYXJjaHkgdW50aWwgd2UgcmVhY2ggYSBzY3JlZW5cbiAgICAvLyB0aGlzIHNjcmVlbiBpcyB0aGUgcGFyZW50IHNjcmVlblxuICAgIC8vIGFsc28gc2VhcmNoZXMgZm9yIG1hc2tlZCBlbGVtZW50cyB0byBnZXQgdGhlIHJlbGV2YW50IG1hc2tcbiAgICBfcGFyc2VVcFRvU2NyZWVuKCkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICBzY3JlZW46IG51bGwsXG4gICAgICAgICAgICBtYXNrOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgbGV0IHBhcmVudCA9IHRoaXMuZW50aXR5Ll9wYXJlbnQ7XG5cbiAgICAgICAgd2hpbGUgKHBhcmVudCAmJiAhcGFyZW50LnNjcmVlbikge1xuICAgICAgICAgICAgaWYgKHBhcmVudC5lbGVtZW50ICYmIHBhcmVudC5lbGVtZW50Lm1hc2spIHtcbiAgICAgICAgICAgICAgICAvLyBtYXNrIGVudGl0eVxuICAgICAgICAgICAgICAgIGlmICghcmVzdWx0Lm1hc2spIHJlc3VsdC5tYXNrID0gcGFyZW50O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYXJlbnQgJiYgcGFyZW50LnNjcmVlbikgcmVzdWx0LnNjcmVlbiA9IHBhcmVudDtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIF9vblNjcmVlblJlc2l6ZShyZXMpIHtcbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU2l6ZSh0aGlzLl9oYXNTcGxpdEFuY2hvcnNYLCB0aGlzLl9oYXNTcGxpdEFuY2hvcnNZKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3NjcmVlbjpzZXQ6cmVzb2x1dGlvbicsIHJlcyk7XG4gICAgfVxuXG4gICAgX29uU2NyZWVuU3BhY2VDaGFuZ2UoKSB7XG4gICAgICAgIHRoaXMuZmlyZSgnc2NyZWVuOnNldDpzY3JlZW5zcGFjZScsIHRoaXMuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSk7XG4gICAgfVxuXG4gICAgX29uU2NyZWVuUmVtb3ZlKCkge1xuICAgICAgICBpZiAodGhpcy5zY3JlZW4pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnNjcmVlbi5fZGVzdHJveWluZykge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBzY3JlZW4gZW50aXR5IGlzIGJlaW5nIGRlc3Ryb3llZCwgd2UgZG9uJ3QgY2FsbFxuICAgICAgICAgICAgICAgIC8vIF91cGRhdGVTY3JlZW4oKSBhcyBhbiBvcHRpbWl6YXRpb24gYnV0IHdlIHNob3VsZCBzdGlsbFxuICAgICAgICAgICAgICAgIC8vIHNldCBpdCB0byBudWxsIHRvIGNsZWFuIHVwIGRhbmdsaW5nIHJlZmVyZW5jZXNcbiAgICAgICAgICAgICAgICB0aGlzLnNjcmVlbiA9IG51bGw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVNjcmVlbihudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHN0b3JlIHBpeGVsIHBvc2l0aW9ucyBvZiBhbmNob3IgcmVsYXRpdmUgdG8gY3VycmVudCBwYXJlbnQgcmVzb2x1dGlvblxuICAgIF9jYWxjdWxhdGVMb2NhbEFuY2hvcnMoKSB7XG4gICAgICAgIGxldCByZXN4ID0gMTAwMDtcbiAgICAgICAgbGV0IHJlc3kgPSAxMDAwO1xuICAgICAgICBjb25zdCBwYXJlbnQgPSB0aGlzLmVudGl0eS5fcGFyZW50O1xuICAgICAgICBpZiAocGFyZW50ICYmIHBhcmVudC5lbGVtZW50KSB7XG4gICAgICAgICAgICByZXN4ID0gcGFyZW50LmVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoO1xuICAgICAgICAgICAgcmVzeSA9IHBhcmVudC5lbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQ7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zY3JlZW4pIHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IHRoaXMuc2NyZWVuLnNjcmVlbi5yZXNvbHV0aW9uO1xuICAgICAgICAgICAgY29uc3Qgc2NhbGUgPSB0aGlzLnNjcmVlbi5zY3JlZW4uc2NhbGU7XG4gICAgICAgICAgICByZXN4ID0gcmVzLnggLyBzY2FsZTtcbiAgICAgICAgICAgIHJlc3kgPSByZXMueSAvIHNjYWxlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbG9jYWxBbmNob3Iuc2V0KFxuICAgICAgICAgICAgdGhpcy5fYW5jaG9yLnggKiByZXN4LFxuICAgICAgICAgICAgdGhpcy5fYW5jaG9yLnkgKiByZXN5LFxuICAgICAgICAgICAgdGhpcy5fYW5jaG9yLnogKiByZXN4LFxuICAgICAgICAgICAgdGhpcy5fYW5jaG9yLncgKiByZXN5XG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gaW50ZXJuYWwgLSBhcHBseSBvZmZzZXQgeCx5IHRvIGxvY2FsIHBvc2l0aW9uIGFuZCBmaW5kIHBvaW50IGluIHdvcmxkIHNwYWNlXG4gICAgZ2V0T2Zmc2V0UG9zaXRpb24oeCwgeSkge1xuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpLmNsb25lKCk7XG5cbiAgICAgICAgcC54ICs9IHg7XG4gICAgICAgIHAueSArPSB5O1xuXG4gICAgICAgIHRoaXMuX3NjcmVlblRvV29ybGQudHJhbnNmb3JtUG9pbnQocCwgcCk7XG5cbiAgICAgICAgcmV0dXJuIHA7XG4gICAgfVxuXG4gICAgb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKHRoaXMuX2ltYWdlID8gdGhpcy5faW1hZ2UuX3JlbmRlcmFibGUubW9kZWwgOiB0aGlzLl90ZXh0Ll9tb2RlbCk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5faW1hZ2UpIHtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5faW1hZ2UuX3JlbmRlcmFibGUubW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdGV4dCkge1xuICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl90ZXh0Ll9tb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSB7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMuX2ltYWdlLl9yZW5kZXJhYmxlLm1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3RleHQpIHtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fdGV4dC5fbW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSB0aGlzLl9pbWFnZS5vbkVuYWJsZSgpO1xuICAgICAgICBpZiAodGhpcy5fdGV4dCkgdGhpcy5fdGV4dC5vbkVuYWJsZSgpO1xuICAgICAgICBpZiAodGhpcy5fZ3JvdXApIHRoaXMuX2dyb3VwLm9uRW5hYmxlKCk7XG5cbiAgICAgICAgaWYgKHRoaXMudXNlSW5wdXQgJiYgdGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dC5hZGRFbGVtZW50KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5FTEVNRU5ULCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maXJlKCdlbmFibGVlbGVtZW50Jyk7XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUub2ZmKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9pbWFnZSkgdGhpcy5faW1hZ2Uub25EaXNhYmxlKCk7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0KSB0aGlzLl90ZXh0Lm9uRGlzYWJsZSgpO1xuICAgICAgICBpZiAodGhpcy5fZ3JvdXApIHRoaXMuX2dyb3VwLm9uRGlzYWJsZSgpO1xuXG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0ICYmIHRoaXMudXNlSW5wdXQpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQucmVtb3ZlRWxlbWVudCh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLkVMRU1FTlQsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ2Rpc2FibGVlbGVtZW50Jyk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuZW50aXR5Lm9mZignaW5zZXJ0JywgdGhpcy5fb25JbnNlcnQsIHRoaXMpO1xuICAgICAgICB0aGlzLl91bnBhdGNoKCk7XG4gICAgICAgIGlmICh0aGlzLl9pbWFnZSkgdGhpcy5faW1hZ2UuZGVzdHJveSgpO1xuICAgICAgICBpZiAodGhpcy5fdGV4dCkgdGhpcy5fdGV4dC5kZXN0cm95KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQgJiYgdGhpcy51c2VJbnB1dCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dC5yZW1vdmVFbGVtZW50KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlcmUgaXMgYSBzY3JlZW4sIHVwZGF0ZSBkcmF3LW9yZGVyXG4gICAgICAgIGlmICh0aGlzLnNjcmVlbiAmJiB0aGlzLnNjcmVlbi5zY3JlZW4pIHtcbiAgICAgICAgICAgIHRoaXMuX3VuYmluZFNjcmVlbih0aGlzLnNjcmVlbi5zY3JlZW4pO1xuICAgICAgICAgICAgdGhpcy5zY3JlZW4uc2NyZWVuLnN5bmNEcmF3T3JkZXIoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMub2ZmKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVjYWxjdWxhdGVzIHRoZXNlIHByb3BlcnRpZXM6XG4gICAgICogICAtIGBfbG9jYWxBbmNob3JgXG4gICAgICogICAtIGB3aWR0aGBcbiAgICAgKiAgIC0gYGhlaWdodGBcbiAgICAgKiAgIC0gTG9jYWwgcG9zaXRpb24gaXMgdXBkYXRlZCBpZiBhbmNob3JzIGFyZSBzcGxpdFxuICAgICAqXG4gICAgICogQXNzdW1lcyB0aGVzZSBwcm9wZXJ0aWVzIGFyZSB1cCB0byBkYXRlOlxuICAgICAqICAgLSBgX21hcmdpbmBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcGFnYXRlQ2FsY3VsYXRlZFdpZHRoIC0gSWYgdHJ1ZSwgY2FsbCBgX3NldFdpZHRoYCBpbnN0ZWFkXG4gICAgICogb2YgYF9zZXRDYWxjdWxhdGVkV2lkdGhgXG4gICAgICogQHBhcmFtIHtib29sZWFufSBwcm9wYWdhdGVDYWxjdWxhdGVkSGVpZ2h0IC0gSWYgdHJ1ZSwgY2FsbCBgX3NldEhlaWdodGAgaW5zdGVhZFxuICAgICAqIG9mIGBfc2V0Q2FsY3VsYXRlZEhlaWdodGBcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jYWxjdWxhdGVTaXplKHByb3BhZ2F0ZUNhbGN1bGF0ZWRXaWR0aCwgcHJvcGFnYXRlQ2FsY3VsYXRlZEhlaWdodCkge1xuICAgICAgICAvLyBjYW4ndCBjYWxjdWxhdGUgaWYgbG9jYWwgYW5jaG9ycyBhcmUgd3JvbmdcbiAgICAgICAgaWYgKCF0aGlzLmVudGl0eS5fcGFyZW50ICYmICF0aGlzLnNjcmVlbikgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZUxvY2FsQW5jaG9ycygpO1xuXG4gICAgICAgIGNvbnN0IG5ld1dpZHRoID0gdGhpcy5fYWJzUmlnaHQgLSB0aGlzLl9hYnNMZWZ0O1xuICAgICAgICBjb25zdCBuZXdIZWlnaHQgPSB0aGlzLl9hYnNUb3AgLSB0aGlzLl9hYnNCb3R0b207XG5cbiAgICAgICAgaWYgKHByb3BhZ2F0ZUNhbGN1bGF0ZWRXaWR0aCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0V2lkdGgobmV3V2lkdGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZFdpZHRoKG5ld1dpZHRoLCBmYWxzZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJvcGFnYXRlQ2FsY3VsYXRlZEhlaWdodCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0SGVpZ2h0KG5ld0hlaWdodCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRDYWxjdWxhdGVkSGVpZ2h0KG5ld0hlaWdodCwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgcC54ID0gdGhpcy5fbWFyZ2luLnggKyB0aGlzLl9jYWxjdWxhdGVkV2lkdGggKiB0aGlzLl9waXZvdC54O1xuICAgICAgICBwLnkgPSB0aGlzLl9tYXJnaW4ueSArIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQgKiB0aGlzLl9waXZvdC55O1xuXG4gICAgICAgIHRoaXMuZW50aXR5LnNldExvY2FsUG9zaXRpb24ocCk7XG5cbiAgICAgICAgdGhpcy5fc2l6ZURpcnR5ID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgc2V0IHdpZHRoIHdpdGhvdXQgdXBkYXRpbmcgbWFyZ2luLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHcgLSBUaGUgbmV3IHdpZHRoLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldFdpZHRoKHcpIHtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB3O1xuICAgICAgICB0aGlzLl9zZXRDYWxjdWxhdGVkV2lkdGgodywgZmFsc2UpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OndpZHRoJywgdGhpcy5fd2lkdGgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIHNldCBoZWlnaHQgd2l0aG91dCB1cGRhdGluZyBtYXJnaW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaCAtIFRoZSBuZXcgaGVpZ2h0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldEhlaWdodChoKSB7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IGg7XG4gICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRIZWlnaHQoaCwgZmFsc2UpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OmhlaWdodCcsIHRoaXMuX2hlaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2Qgc2V0cyB0aGUgY2FsY3VsYXRlZCB3aWR0aCB2YWx1ZSBhbmQgb3B0aW9uYWxseSB1cGRhdGVzIHRoZSBtYXJnaW5zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIG5ldyBjYWxjdWxhdGVkIHdpZHRoLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdXBkYXRlTWFyZ2lucyAtIFVwZGF0ZSBtYXJnaW5zIG9yIG5vdC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRDYWxjdWxhdGVkV2lkdGgodmFsdWUsIHVwZGF0ZU1hcmdpbnMpIHtcbiAgICAgICAgaWYgKE1hdGguYWJzKHZhbHVlIC0gdGhpcy5fY2FsY3VsYXRlZFdpZHRoKSA8PSAxZS00KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCA9IHZhbHVlO1xuICAgICAgICB0aGlzLmVudGl0eS5fZGlydGlmeUxvY2FsKCk7XG5cbiAgICAgICAgaWYgKHVwZGF0ZU1hcmdpbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHAgPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCk7XG4gICAgICAgICAgICBjb25zdCBwdnQgPSB0aGlzLl9waXZvdDtcbiAgICAgICAgICAgIHRoaXMuX21hcmdpbi54ID0gcC54IC0gdGhpcy5fY2FsY3VsYXRlZFdpZHRoICogcHZ0Lng7XG4gICAgICAgICAgICB0aGlzLl9tYXJnaW4ueiA9ICh0aGlzLl9sb2NhbEFuY2hvci56IC0gdGhpcy5fbG9jYWxBbmNob3IueCkgLSB0aGlzLl9jYWxjdWxhdGVkV2lkdGggLSB0aGlzLl9tYXJnaW4ueDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2ZsYWdDaGlsZHJlbkFzRGlydHkoKTtcbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6Y2FsY3VsYXRlZFdpZHRoJywgdGhpcy5fY2FsY3VsYXRlZFdpZHRoKTtcbiAgICAgICAgdGhpcy5maXJlKCdyZXNpemUnLCB0aGlzLl9jYWxjdWxhdGVkV2lkdGgsIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoaXMgbWV0aG9kIHNldHMgdGhlIGNhbGN1bGF0ZWQgaGVpZ2h0IHZhbHVlIGFuZCBvcHRpb25hbGx5IHVwZGF0ZXMgdGhlIG1hcmdpbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBUaGUgbmV3IGNhbGN1bGF0ZWQgaGVpZ2h0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdXBkYXRlTWFyZ2lucyAtIFVwZGF0ZSBtYXJnaW5zIG9yIG5vdC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRDYWxjdWxhdGVkSGVpZ2h0KHZhbHVlLCB1cGRhdGVNYXJnaW5zKSB7XG4gICAgICAgIGlmIChNYXRoLmFicyh2YWx1ZSAtIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQpIDw9IDFlLTQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlZEhlaWdodCA9IHZhbHVlO1xuICAgICAgICB0aGlzLmVudGl0eS5fZGlydGlmeUxvY2FsKCk7XG5cbiAgICAgICAgaWYgKHVwZGF0ZU1hcmdpbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHAgPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCk7XG4gICAgICAgICAgICBjb25zdCBwdnQgPSB0aGlzLl9waXZvdDtcbiAgICAgICAgICAgIHRoaXMuX21hcmdpbi55ID0gcC55IC0gdGhpcy5fY2FsY3VsYXRlZEhlaWdodCAqIHB2dC55O1xuICAgICAgICAgICAgdGhpcy5fbWFyZ2luLncgPSAodGhpcy5fbG9jYWxBbmNob3IudyAtIHRoaXMuX2xvY2FsQW5jaG9yLnkpIC0gdGhpcy5fY2FsY3VsYXRlZEhlaWdodCAtIHRoaXMuX21hcmdpbi55O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZmxhZ0NoaWxkcmVuQXNEaXJ0eSgpO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDpjYWxjdWxhdGVkSGVpZ2h0JywgdGhpcy5fY2FsY3VsYXRlZEhlaWdodCk7XG4gICAgICAgIHRoaXMuZmlyZSgncmVzaXplJywgdGhpcy5fY2FsY3VsYXRlZFdpZHRoLCB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0KTtcbiAgICB9XG5cbiAgICBfZmxhZ0NoaWxkcmVuQXNEaXJ0eSgpIHtcbiAgICAgICAgY29uc3QgYyA9IHRoaXMuZW50aXR5Ll9jaGlsZHJlbjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaWYgKGNbaV0uZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIGNbaV0uZWxlbWVudC5fYW5jaG9yRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNbaV0uZWxlbWVudC5fc2l6ZURpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZE1vZGVsVG9MYXllcnMobW9kZWwpIHtcbiAgICAgICAgdGhpcy5fYWRkZWRNb2RlbHMucHVzaChtb2RlbCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKG1vZGVsKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuX2FkZGVkTW9kZWxzLmluZGV4T2YobW9kZWwpO1xuICAgICAgICBpZiAoaWR4ID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZGVkTW9kZWxzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKG1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0TWFza09mZnNldCgpIHtcbiAgICAgICAgLy8gcmVzZXQgb2Zmc2V0IG9uIG5ldyBmcmFtZVxuICAgICAgICAvLyB3ZSBhbHdheXMgY291bnQgb2Zmc2V0IGRvd24gZnJvbSAwLjVcbiAgICAgICAgY29uc3QgZnJhbWUgPSB0aGlzLnN5c3RlbS5hcHAuZnJhbWU7XG4gICAgICAgIGlmICh0aGlzLl9vZmZzZXRSZWFkQXQgIT09IGZyYW1lKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXNrT2Zmc2V0ID0gMC41O1xuICAgICAgICAgICAgdGhpcy5fb2Zmc2V0UmVhZEF0ID0gZnJhbWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbW8gPSB0aGlzLl9tYXNrT2Zmc2V0O1xuICAgICAgICB0aGlzLl9tYXNrT2Zmc2V0IC09IDAuMDAxO1xuICAgICAgICByZXR1cm4gbW87XG4gICAgfVxuXG4gICAgaXNWaXNpYmxlRm9yQ2FtZXJhKGNhbWVyYSkge1xuICAgICAgICBsZXQgY2xpcEwsIGNsaXBSLCBjbGlwVCwgY2xpcEI7XG5cbiAgICAgICAgaWYgKHRoaXMubWFza2VkQnkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvcm5lcnMgPSB0aGlzLm1hc2tlZEJ5LmVsZW1lbnQuc2NyZWVuQ29ybmVycztcblxuICAgICAgICAgICAgY2xpcEwgPSBNYXRoLm1pbihNYXRoLm1pbihjb3JuZXJzWzBdLngsIGNvcm5lcnNbMV0ueCksIE1hdGgubWluKGNvcm5lcnNbMl0ueCwgY29ybmVyc1szXS54KSk7XG4gICAgICAgICAgICBjbGlwUiA9IE1hdGgubWF4KE1hdGgubWF4KGNvcm5lcnNbMF0ueCwgY29ybmVyc1sxXS54KSwgTWF0aC5tYXgoY29ybmVyc1syXS54LCBjb3JuZXJzWzNdLngpKTtcbiAgICAgICAgICAgIGNsaXBCID0gTWF0aC5taW4oTWF0aC5taW4oY29ybmVyc1swXS55LCBjb3JuZXJzWzFdLnkpLCBNYXRoLm1pbihjb3JuZXJzWzJdLnksIGNvcm5lcnNbM10ueSkpO1xuICAgICAgICAgICAgY2xpcFQgPSBNYXRoLm1heChNYXRoLm1heChjb3JuZXJzWzBdLnksIGNvcm5lcnNbMV0ueSksIE1hdGgubWF4KGNvcm5lcnNbMl0ueSwgY29ybmVyc1szXS55KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBzdyA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZS53aWR0aDtcbiAgICAgICAgICAgIGNvbnN0IHNoID0gdGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLmhlaWdodDtcblxuICAgICAgICAgICAgY29uc3QgY2FtZXJhV2lkdGggPSBjYW1lcmEuX3JlY3QueiAqIHN3O1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhSGVpZ2h0ID0gY2FtZXJhLl9yZWN0LncgKiBzaDtcbiAgICAgICAgICAgIGNsaXBMID0gY2FtZXJhLl9yZWN0LnggKiBzdztcbiAgICAgICAgICAgIGNsaXBSID0gY2xpcEwgKyBjYW1lcmFXaWR0aDtcbiAgICAgICAgICAgIGNsaXBUID0gKDEgLSBjYW1lcmEuX3JlY3QueSkgKiBzaDtcbiAgICAgICAgICAgIGNsaXBCID0gY2xpcFQgLSBjYW1lcmFIZWlnaHQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoaXRDb3JuZXJzID0gdGhpcy5zY3JlZW5Db3JuZXJzO1xuXG4gICAgICAgIGNvbnN0IGxlZnQgPSBNYXRoLm1pbihNYXRoLm1pbihoaXRDb3JuZXJzWzBdLngsIGhpdENvcm5lcnNbMV0ueCksIE1hdGgubWluKGhpdENvcm5lcnNbMl0ueCwgaGl0Q29ybmVyc1szXS54KSk7XG4gICAgICAgIGNvbnN0IHJpZ2h0ID0gTWF0aC5tYXgoTWF0aC5tYXgoaGl0Q29ybmVyc1swXS54LCBoaXRDb3JuZXJzWzFdLngpLCBNYXRoLm1heChoaXRDb3JuZXJzWzJdLngsIGhpdENvcm5lcnNbM10ueCkpO1xuICAgICAgICBjb25zdCBib3R0b20gPSBNYXRoLm1pbihNYXRoLm1pbihoaXRDb3JuZXJzWzBdLnksIGhpdENvcm5lcnNbMV0ueSksIE1hdGgubWluKGhpdENvcm5lcnNbMl0ueSwgaGl0Q29ybmVyc1szXS55KSk7XG4gICAgICAgIGNvbnN0IHRvcCA9IE1hdGgubWF4KE1hdGgubWF4KGhpdENvcm5lcnNbMF0ueSwgaGl0Q29ybmVyc1sxXS55KSwgTWF0aC5tYXgoaGl0Q29ybmVyc1syXS55LCBoaXRDb3JuZXJzWzNdLnkpKTtcblxuICAgICAgICBpZiAocmlnaHQgPCBjbGlwTCB8fFxuICAgICAgICAgICAgbGVmdCA+IGNsaXBSIHx8XG4gICAgICAgICAgICBib3R0b20gPiBjbGlwVCB8fFxuICAgICAgICAgICAgdG9wIDwgY2xpcEIpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIF9pc1NjcmVlblNwYWNlKCkge1xuICAgICAgICBpZiAodGhpcy5zY3JlZW4gJiYgdGhpcy5zY3JlZW4uc2NyZWVuKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIF9pc1NjcmVlbkN1bGxlZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuICYmIHRoaXMuc2NyZWVuLnNjcmVlbikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2NyZWVuLnNjcmVlbi5jdWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIF9kaXJ0eUJhdGNoKCkge1xuICAgICAgICBpZiAodGhpcy5iYXRjaEdyb3VwSWQgIT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8ubWFya0dyb3VwRGlydHkodGhpcy5iYXRjaEdyb3VwSWQpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBfZGVmaW5lKG5hbWUpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRWxlbWVudENvbXBvbmVudC5wcm90b3R5cGUsIG5hbWUsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl90ZXh0W25hbWVdO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9pbWFnZVtuYW1lXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3RleHQpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fdGV4dFtuYW1lXSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGlydHlCYXRjaCgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX3RleHRbbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5faW1hZ2UpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faW1hZ2VbbmFtZV0gIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5QmF0Y2goKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZVtuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG59XG5cbl9kZWZpbmUoJ2ZvbnRTaXplJyk7XG5fZGVmaW5lKCdtaW5Gb250U2l6ZScpO1xuX2RlZmluZSgnbWF4Rm9udFNpemUnKTtcbl9kZWZpbmUoJ21heExpbmVzJyk7XG5fZGVmaW5lKCdhdXRvRml0V2lkdGgnKTtcbl9kZWZpbmUoJ2F1dG9GaXRIZWlnaHQnKTtcbl9kZWZpbmUoJ2NvbG9yJyk7XG5fZGVmaW5lKCdmb250Jyk7XG5fZGVmaW5lKCdmb250QXNzZXQnKTtcbl9kZWZpbmUoJ3NwYWNpbmcnKTtcbl9kZWZpbmUoJ2xpbmVIZWlnaHQnKTtcbl9kZWZpbmUoJ3dyYXBMaW5lcycpO1xuX2RlZmluZSgnbGluZXMnKTtcbl9kZWZpbmUoJ2FsaWdubWVudCcpO1xuX2RlZmluZSgnYXV0b1dpZHRoJyk7XG5fZGVmaW5lKCdhdXRvSGVpZ2h0Jyk7XG5fZGVmaW5lKCdydGxSZW9yZGVyJyk7XG5fZGVmaW5lKCd1bmljb2RlQ29udmVydGVyJyk7XG5fZGVmaW5lKCd0ZXh0Jyk7XG5fZGVmaW5lKCdrZXknKTtcbl9kZWZpbmUoJ3RleHR1cmUnKTtcbl9kZWZpbmUoJ3RleHR1cmVBc3NldCcpO1xuX2RlZmluZSgnbWF0ZXJpYWwnKTtcbl9kZWZpbmUoJ21hdGVyaWFsQXNzZXQnKTtcbl9kZWZpbmUoJ3Nwcml0ZScpO1xuX2RlZmluZSgnc3ByaXRlQXNzZXQnKTtcbl9kZWZpbmUoJ3Nwcml0ZUZyYW1lJyk7XG5fZGVmaW5lKCdwaXhlbHNQZXJVbml0Jyk7XG5fZGVmaW5lKCdvcGFjaXR5Jyk7XG5fZGVmaW5lKCdyZWN0Jyk7XG5fZGVmaW5lKCdtYXNrJyk7XG5fZGVmaW5lKCdvdXRsaW5lQ29sb3InKTtcbl9kZWZpbmUoJ291dGxpbmVUaGlja25lc3MnKTtcbl9kZWZpbmUoJ3NoYWRvd0NvbG9yJyk7XG5fZGVmaW5lKCdzaGFkb3dPZmZzZXQnKTtcbl9kZWZpbmUoJ2VuYWJsZU1hcmt1cCcpO1xuX2RlZmluZSgncmFuZ2VTdGFydCcpO1xuX2RlZmluZSgncmFuZ2VFbmQnKTtcblxuZXhwb3J0IHsgRWxlbWVudENvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbInBvc2l0aW9uIiwiVmVjMyIsImludlBhcmVudFd0bSIsIk1hdDQiLCJ2ZWNBIiwidmVjQiIsIm1hdEEiLCJtYXRCIiwibWF0QyIsIm1hdEQiLCJFbGVtZW50Q29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfYmVpbmdJbml0aWFsaXplZCIsIl9hbmNob3IiLCJWZWM0IiwiX2xvY2FsQW5jaG9yIiwiX3Bpdm90IiwiVmVjMiIsIl93aWR0aCIsIl9jYWxjdWxhdGVkV2lkdGgiLCJfaGVpZ2h0IiwiX2NhbGN1bGF0ZWRIZWlnaHQiLCJfbWFyZ2luIiwiX21vZGVsVHJhbnNmb3JtIiwiX3NjcmVlblRvV29ybGQiLCJfYW5jaG9yVHJhbnNmb3JtIiwiX2FuY2hvckRpcnR5IiwiX3BhcmVudFdvcmxkVHJhbnNmb3JtIiwiX3NjcmVlblRyYW5zZm9ybSIsIl9zY3JlZW5Db3JuZXJzIiwiX2NhbnZhc0Nvcm5lcnMiLCJfd29ybGRDb3JuZXJzIiwiX2Nvcm5lcnNEaXJ0eSIsIl9jYW52YXNDb3JuZXJzRGlydHkiLCJfd29ybGRDb3JuZXJzRGlydHkiLCJvbiIsIl9vbkluc2VydCIsIl9wYXRjaCIsInNjcmVlbiIsIl90eXBlIiwiRUxFTUVOVFRZUEVfR1JPVVAiLCJfaW1hZ2UiLCJfdGV4dCIsIl9ncm91cCIsIl9kcmF3T3JkZXIiLCJfZml0TW9kZSIsIkZJVE1PREVfU1RSRVRDSCIsIl91c2VJbnB1dCIsIl9sYXllcnMiLCJMQVlFUklEX1VJIiwiX2FkZGVkTW9kZWxzIiwiX2JhdGNoR3JvdXBJZCIsIl9iYXRjaEdyb3VwIiwiX29mZnNldFJlYWRBdCIsIl9tYXNrT2Zmc2V0IiwiX21hc2tlZEJ5IiwiX2Fic0xlZnQiLCJ4IiwiX2Fic1JpZ2h0IiwieiIsIl9hYnNUb3AiLCJ3IiwiX2Fic0JvdHRvbSIsInkiLCJfaGFzU3BsaXRBbmNob3JzWCIsIk1hdGgiLCJhYnMiLCJfaGFzU3BsaXRBbmNob3JzWSIsImFhYmIiLCJhbmNob3IiLCJ2YWx1ZSIsImNvcHkiLCJzZXQiLCJfcGFyZW50IiwiX2NhbGN1bGF0ZUxvY2FsQW5jaG9ycyIsIl9jYWxjdWxhdGVTaXplIiwiX2RpcnR5TG9jYWwiLCJfZGlydGlmeUxvY2FsIiwiZmlyZSIsImJhdGNoR3JvdXBJZCIsImVuYWJsZWQiLCJfdGhpcyRzeXN0ZW0kYXBwJGJhdGMiLCJhcHAiLCJiYXRjaGVyIiwicmVtb3ZlIiwiQmF0Y2hHcm91cCIsIkVMRU1FTlQiLCJfdGhpcyRzeXN0ZW0kYXBwJGJhdGMyIiwiaW5zZXJ0IiwiX3JlbmRlcmFibGUiLCJtb2RlbCIsImFkZE1vZGVsVG9MYXllcnMiLCJfbW9kZWwiLCJib3R0b20iLCJwIiwiZ2V0TG9jYWxQb3NpdGlvbiIsInd0Iiwid2IiLCJfc2V0SGVpZ2h0Iiwic2V0TG9jYWxQb3NpdGlvbiIsImNhbGN1bGF0ZWRXaWR0aCIsIl9zZXRDYWxjdWxhdGVkV2lkdGgiLCJjYWxjdWxhdGVkSGVpZ2h0IiwiX3NldENhbGN1bGF0ZWRIZWlnaHQiLCJjYW52YXNDb3JuZXJzIiwic2NyZWVuU3BhY2UiLCJkZXZpY2UiLCJncmFwaGljc0RldmljZSIsInNjcmVlbkNvcm5lcnMiLCJzeCIsImNhbnZhcyIsImNsaWVudFdpZHRoIiwid2lkdGgiLCJzeSIsImNsaWVudEhlaWdodCIsImhlaWdodCIsImkiLCJkcmF3T3JkZXIiLCJwcmlvcml0eSIsIkRlYnVnIiwid2FybiIsImxheWVycyIsImxlbmd0aCIsImxheWVyIiwic2NlbmUiLCJnZXRMYXllckJ5SWQiLCJqIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZXMiLCJhZGRNZXNoSW5zdGFuY2VzIiwibGVmdCIsIndyIiwid2wiLCJfc2V0V2lkdGgiLCJtYXJnaW4iLCJtYXNrZWRCeSIsInBpdm90IiwicHJldlgiLCJwcmV2WSIsIm14IiwiZHgiLCJteSIsImR5IiwiX2ZsYWdDaGlsZHJlbkFzRGlydHkiLCJyaWdodCIsInBhcmVudEJvdHRvbUxlZnQiLCJwYXJlbnQiLCJlbGVtZW50IiwidHJhbnNmb3JtUG9pbnQiLCJtdWxTY2FsYXIiLCJzY2FsZSIsImFkZCIsInRleHRXaWR0aCIsInRleHRIZWlnaHQiLCJ0b3AiLCJ0eXBlIiwiZGVzdHJveSIsIkVMRU1FTlRUWVBFX0lNQUdFIiwiSW1hZ2VFbGVtZW50IiwiRUxFTUVOVFRZUEVfVEVYVCIsIlRleHRFbGVtZW50IiwidXNlSW5wdXQiLCJlbGVtZW50SW5wdXQiLCJhZGRFbGVtZW50IiwicmVtb3ZlRWxlbWVudCIsImZpdE1vZGUiLCJyZWZyZXNoTWVzaCIsIndvcmxkQ29ybmVycyIsIl9zY3JlZW5NYXRyaXgiLCJkYXRhIiwibXVsMiIsImdldFdvcmxkVHJhbnNmb3JtIiwibG9jYWxQb3MiLCJzZXRUcmFuc2xhdGUiLCJzZXRUUlMiLCJaRVJPIiwiZ2V0TG9jYWxSb3RhdGlvbiIsImdldExvY2FsU2NhbGUiLCJtdWwiLCJfc3luYyIsInNldFBvc2l0aW9uIiwiX3NldFBvc2l0aW9uIiwiX3NldExvY2FsUG9zaXRpb24iLCJfdW5wYXRjaCIsIkVudGl0eSIsInByb3RvdHlwZSIsImNhbGwiLCJpbnZlcnQiLCJsb2NhbFBvc2l0aW9uIiwicHZ0IiwicmVzeCIsInJlc3kiLCJweCIsInB5IiwicmVzb2x1dGlvbiIsIl9zaXplRGlydHkiLCJsb2NhbFRyYW5zZm9ybSIsImxvY2FsUm90YXRpb24iLCJsb2NhbFNjYWxlIiwiX2RpcnR5V29ybGQiLCJ3b3JsZFRyYW5zZm9ybSIsInBhcmVudFdvcmxkVHJhbnNmb3JtIiwic2V0SWRlbnRpdHkiLCJkZXB0aE9mZnNldCIsInBpdm90T2Zmc2V0IiwicmVzdWx0IiwiX3BhcnNlVXBUb1NjcmVlbiIsIl9kaXJ0aWZ5V29ybGQiLCJfdXBkYXRlU2NyZWVuIiwiX2RpcnRpZnlNYXNrIiwiY3VycmVudCIsIm5leHQiLCJfcHJlcmVuZGVyIiwib25jZSIsIl9vblByZXJlbmRlciIsInRyYWNlIiwiVFJBQ0VfSURfRUxFTUVOVCIsImluZGV4T2YiLCJzcGxpY2UiLCJwdXNoIiwibmFtZSIsIm1hc2siLCJkZXB0aCIsInN5bmNNYXNrIiwiX2JpbmRTY3JlZW4iLCJfYmluZEVsZW1lbnQiLCJfdW5iaW5kU2NyZWVuIiwiX3VuYmluZEVsZW1lbnQiLCJwcmV2aW91c1NjcmVlbiIsImNoaWxkcmVuIiwibCIsInN5bmNEcmF3T3JkZXIiLCJfdXBkYXRlTWFzayIsIl9zZXRNYXNrZWRCeSIsInJlbmRlcmFibGVFbGVtZW50IiwicmVmIiwiX21hc2tSZWYiLCJfc2V0U3RlbmNpbCIsIlN0ZW5jaWxQYXJhbWV0ZXJzIiwiZnVuYyIsIkZVTkNfRVFVQUwiLCJjdXJyZW50TWFzayIsInNwIiwienBhc3MiLCJTVEVOQ0lMT1BfSU5DUkVNRU5UIiwiX2NoaWxkcmVuJGkkZWxlbWVudCIsIkZVTkNfQUxXQVlTIiwiU1RFTkNJTE9QX1JFUExBQ0UiLCJfY2hpbGRyZW4kaSRlbGVtZW50MiIsIl9vblNjcmVlblJlc2l6ZSIsInJlcyIsIl9vblNjcmVlblNwYWNlQ2hhbmdlIiwiX29uU2NyZWVuUmVtb3ZlIiwiX2Rlc3Ryb3lpbmciLCJnZXRPZmZzZXRQb3NpdGlvbiIsImNsb25lIiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvZmYiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsImluZGV4IiwiaWQiLCJvbkVuYWJsZSIsIl90aGlzJHN5c3RlbSRhcHAkYmF0YzMiLCJvbkRpc2FibGUiLCJfdGhpcyRzeXN0ZW0kYXBwJGJhdGM0Iiwib25SZW1vdmUiLCJwcm9wYWdhdGVDYWxjdWxhdGVkV2lkdGgiLCJwcm9wYWdhdGVDYWxjdWxhdGVkSGVpZ2h0IiwibmV3V2lkdGgiLCJuZXdIZWlnaHQiLCJoIiwidXBkYXRlTWFyZ2lucyIsImMiLCJfY2hpbGRyZW4iLCJyZW1vdmVNb2RlbEZyb21MYXllcnMiLCJpZHgiLCJnZXRNYXNrT2Zmc2V0IiwiZnJhbWUiLCJtbyIsImlzVmlzaWJsZUZvckNhbWVyYSIsImNhbWVyYSIsImNsaXBMIiwiY2xpcFIiLCJjbGlwVCIsImNsaXBCIiwiY29ybmVycyIsIm1pbiIsIm1heCIsInN3Iiwic2giLCJjYW1lcmFXaWR0aCIsIl9yZWN0IiwiY2FtZXJhSGVpZ2h0IiwiaGl0Q29ybmVycyIsIl9pc1NjcmVlblNwYWNlIiwiX2lzU2NyZWVuQ3VsbGVkIiwiY3VsbCIsIl9kaXJ0eUJhdGNoIiwiX3RoaXMkc3lzdGVtJGFwcCRiYXRjNSIsIm1hcmtHcm91cERpcnR5IiwiX2RlZmluZSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBc0JBLE1BQU1BLFFBQVEsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUMzQixNQUFNQyxZQUFZLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFFL0IsTUFBTUMsSUFBSSxHQUFHLElBQUlILElBQUksRUFBRSxDQUFBO0FBQ3ZCLE1BQU1JLElBQUksR0FBRyxJQUFJSixJQUFJLEVBQUUsQ0FBQTtBQUN2QixNQUFNSyxJQUFJLEdBQUcsSUFBSUgsSUFBSSxFQUFFLENBQUE7QUFDdkIsTUFBTUksSUFBSSxHQUFHLElBQUlKLElBQUksRUFBRSxDQUFBO0FBQ3ZCLE1BQU1LLElBQUksR0FBRyxJQUFJTCxJQUFJLEVBQUUsQ0FBQTtBQUN2QixNQUFNTSxJQUFJLEdBQUcsSUFBSU4sSUFBSSxFQUFFLENBQUE7O0FBRXZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1PLGdCQUFnQixTQUFTQyxTQUFTLENBQUM7QUFDckM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUU7QUFD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
