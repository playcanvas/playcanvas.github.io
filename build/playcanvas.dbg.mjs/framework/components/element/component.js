/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { FUNC_EQUAL, STENCILOP_INCREMENT, FUNC_ALWAYS, STENCILOP_REPLACE } from '../../../platform/graphics/constants.js';
import { LAYERID_UI } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { StencilParameters } from '../../../scene/stencil-parameters.js';
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
   * @param {ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse is released while the cursor is on the component. Only fired when
   * useInput is true.
   *
   * @event ElementComponent#mouseup
   * @param {ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse cursor enters the component. Only fired when useInput is true.
   *
   * @event ElementComponent#mouseenter
   * @param {ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse cursor leaves the component. Only fired when useInput is true.
   *
   * @event ElementComponent#mouseleave
   * @param {ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse cursor is moved on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#mousemove
   * @param {ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse wheel is scrolled on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#mousewheel
   * @param {ElementMouseEvent} event - The event.
   */

  /**
   * Fired when the mouse is pressed and released on the component or when a touch starts and
   * ends on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#click
   * @param {ElementMouseEvent|ElementTouchEvent} event - The event.
   */

  /**
   * Fired when a touch starts on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#touchstart
   * @param {ElementTouchEvent} event - The event.
   */

  /**
   * Fired when a touch ends on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#touchend
   * @param {ElementTouchEvent} event - The event.
   */

  /**
   * Fired when a touch moves after it started touching the component. Only fired when useInput
   * is true.
   *
   * @event ElementComponent#touchmove
   * @param {ElementTouchEvent} event - The event.
   */

  /**
   * Fired when a touch is canceled on the component. Only fired when useInput is true.
   *
   * @event ElementComponent#touchcancel
   * @param {ElementTouchEvent} event - The event.
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
        }
        const i = this.system._prerender.indexOf(this.entity);
        if (i >= 0) {
          this.system._prerender.splice(i, 1);
        }
        const j = this.system._prerender.indexOf(current);
        if (j < 0) {
          this.system._prerender.push(current);
        }
      }
      current = next;
    }
  }
  _onPrerender() {
    for (let i = 0; i < this.system._prerender.length; i++) {
      const mask = this.system._prerender[i];

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
      const sp = new StencilParameters({
        ref: ref,
        func: FUNC_EQUAL
      });

      // if this is image or text, set the stencil parameters
      if (renderableElement && renderableElement._setStencil) {
        renderableElement._setStencil(sp);
      }
      this._maskedBy = mask;
    } else {

      // remove stencil params if this is image or text
      if (renderableElement && renderableElement._setStencil) {
        renderableElement._setStencil(null);
      }
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
        currentMask = this.entity;
      }

      // recurse through all children
      const children = this.entity.children;
      for (let i = 0, l = children.length; i < l; i++) {
        if (children[i].element) {
          children[i].element._updateMask(currentMask, depth);
        }
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
        currentMask = this.entity;
      }

      // recurse through all children
      const children = this.entity.children;
      for (let i = 0, l = children.length; i < l; i++) {
        if (children[i].element) {
          children[i].element._updateMask(currentMask, depth);
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgRlVOQ19BTFdBWVMsIEZVTkNfRVFVQUwsIFNURU5DSUxPUF9JTkNSRU1FTlQsIFNURU5DSUxPUF9SRVBMQUNFIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgTEFZRVJJRF9VSSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9zdGVuY2lsLXBhcmFtZXRlcnMuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuLi8uLi9lbnRpdHkuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBFTEVNRU5UVFlQRV9HUk9VUCwgRUxFTUVOVFRZUEVfSU1BR0UsIEVMRU1FTlRUWVBFX1RFWFQsIEZJVE1PREVfU1RSRVRDSCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEltYWdlRWxlbWVudCB9IGZyb20gJy4vaW1hZ2UtZWxlbWVudC5qcyc7XG5pbXBvcnQgeyBUZXh0RWxlbWVudCB9IGZyb20gJy4vdGV4dC1lbGVtZW50LmpzJztcblxuLy8gI2lmIF9ERUJVR1xuY29uc3QgX2RlYnVnTG9nZ2luZyA9IGZhbHNlO1xuLy8gI2VuZGlmXG5cbmNvbnN0IHBvc2l0aW9uID0gbmV3IFZlYzMoKTtcbmNvbnN0IGludlBhcmVudFd0bSA9IG5ldyBNYXQ0KCk7XG5cbmNvbnN0IHZlY0EgPSBuZXcgVmVjMygpO1xuY29uc3QgdmVjQiA9IG5ldyBWZWMzKCk7XG5jb25zdCBtYXRBID0gbmV3IE1hdDQoKTtcbmNvbnN0IG1hdEIgPSBuZXcgTWF0NCgpO1xuY29uc3QgbWF0QyA9IG5ldyBNYXQ0KCk7XG5jb25zdCBtYXREID0gbmV3IE1hdDQoKTtcblxuLyoqXG4gKiBFbGVtZW50Q29tcG9uZW50cyBhcmUgdXNlZCB0byBjb25zdHJ1Y3QgdXNlciBpbnRlcmZhY2VzLiBBbiBFbGVtZW50Q29tcG9uZW50J3MgW3R5cGVdKCN0eXBlKVxuICogcHJvcGVydHkgY2FuIGJlIGNvbmZpZ3VyZWQgaW4gMyBtYWluIHdheXM6IGFzIGEgdGV4dCBlbGVtZW50LCBhcyBhbiBpbWFnZSBlbGVtZW50IG9yIGFzIGEgZ3JvdXBcbiAqIGVsZW1lbnQuIElmIHRoZSBFbGVtZW50Q29tcG9uZW50IGhhcyBhIHtAbGluayBTY3JlZW5Db21wb25lbnR9IGFuY2VzdG9yIGluIHRoZSBoaWVyYXJjaHksIGl0XG4gKiB3aWxsIGJlIHRyYW5zZm9ybWVkIHdpdGggcmVzcGVjdCB0byB0aGUgY29vcmRpbmF0ZSBzeXN0ZW0gb2YgdGhlIHNjcmVlbi4gSWYgdGhlcmUgaXMgbm9cbiAqIHtAbGluayBTY3JlZW5Db21wb25lbnR9IGFuY2VzdG9yLCB0aGUgRWxlbWVudENvbXBvbmVudCB3aWxsIGJlIHRyYW5zZm9ybWVkIGxpa2UgYW55IG90aGVyXG4gKiBlbnRpdHkuXG4gKlxuICogWW91IHNob3VsZCBuZXZlciBuZWVkIHRvIHVzZSB0aGUgRWxlbWVudENvbXBvbmVudCBjb25zdHJ1Y3Rvci4gVG8gYWRkIGFuIEVsZW1lbnRDb21wb25lbnQgdG8gYVxuICoge0BsaW5rIEVudGl0eX0sIHVzZSB7QGxpbmsgRW50aXR5I2FkZENvbXBvbmVudH06XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gQWRkIGFuIGVsZW1lbnQgY29tcG9uZW50IHRvIGFuIGVudGl0eSB3aXRoIHRoZSBkZWZhdWx0IG9wdGlvbnNcbiAqIGxldCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJlbGVtZW50XCIpOyAvLyBUaGlzIGRlZmF1bHRzIHRvIGEgJ2dyb3VwJyBlbGVtZW50XG4gKiBgYGBcbiAqXG4gKiBUbyBjcmVhdGUgYSBzaW1wbGUgdGV4dC1iYXNlZCBlbGVtZW50OlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJlbGVtZW50XCIsIHtcbiAqICAgICBhbmNob3I6IG5ldyBwYy5WZWM0KDAuNSwgMC41LCAwLjUsIDAuNSksIC8vIGNlbnRlcmVkIGFuY2hvclxuICogICAgIGZvbnRBc3NldDogZm9udEFzc2V0LFxuICogICAgIGZvbnRTaXplOiAxMjgsXG4gKiAgICAgcGl2b3Q6IG5ldyBwYy5WZWMyKDAuNSwgMC41KSwgICAgICAgICAgICAvLyBjZW50ZXJlZCBwaXZvdFxuICogICAgIHRleHQ6IFwiSGVsbG8gV29ybGQhXCIsXG4gKiAgICAgdHlwZTogcGMuRUxFTUVOVFRZUEVfVEVYVFxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBPbmNlIHRoZSBFbGVtZW50Q29tcG9uZW50IGlzIGFkZGVkIHRvIHRoZSBlbnRpdHksIHlvdSBjYW4gc2V0IGFuZCBnZXQgYW55IG9mIGl0cyBwcm9wZXJ0aWVzOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGVudGl0eS5lbGVtZW50LmNvbG9yID0gcGMuQ29sb3IuUkVEOyAvLyBTZXQgdGhlIGVsZW1lbnQncyBjb2xvciB0byByZWRcbiAqXG4gKiBjb25zb2xlLmxvZyhlbnRpdHkuZWxlbWVudC5jb2xvcik7ICAgLy8gR2V0IHRoZSBlbGVtZW50J3MgY29sb3IgYW5kIHByaW50IGl0XG4gKiBgYGBcbiAqXG4gKiBSZWxldmFudCAnRW5naW5lLW9ubHknIGV4YW1wbGVzOlxuICogLSBbQmFzaWMgdGV4dCByZW5kZXJpbmddKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jdXNlci1pbnRlcmZhY2UvdGV4dC1iYXNpYylcbiAqIC0gW1JlbmRlcmluZyB0ZXh0IG91dGxpbmVzXShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3VzZXItaW50ZXJmYWNlL3RleHQtb3V0bGluZSlcbiAqIC0gW0FkZGluZyBkcm9wIHNoYWRvd3MgdG8gdGV4dF0oaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyN1c2VyLWludGVyZmFjZS90ZXh0LWRyb3Atc2hhZG93KVxuICogLSBbQ29sb3JpbmcgdGV4dCB3aXRoIG1hcmt1cF0oaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyN1c2VyLWludGVyZmFjZS90ZXh0LW1hcmt1cClcbiAqIC0gW1dyYXBwaW5nIHRleHRdKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jdXNlci1pbnRlcmZhY2UvdGV4dC13cmFwKVxuICogLSBbVHlwZXdyaXRlciB0ZXh0XShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3VzZXItaW50ZXJmYWNlL3RleHQtdHlwZXdyaXRlcilcbiAqXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJykuQ29sb3J9IGNvbG9yIFRoZSBjb2xvciBvZiB0aGUgaW1hZ2UgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIG9yIHRoZSBjb2xvciBvZiB0aGUgdGV4dCBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHkgVGhlIG9wYWNpdHkgb2YgdGhlIGltYWdlIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIG9yIHRoZVxuICogdGV4dCBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcycpLkNvbG9yfSBvdXRsaW5lQ29sb3IgVGhlIHRleHQgb3V0bGluZSBlZmZlY3RcbiAqIGNvbG9yIGFuZCBvcGFjaXR5LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3V0bGluZVRoaWNrbmVzcyBUaGUgd2lkdGggb2YgdGhlIHRleHQgb3V0bGluZSBlZmZlY3QuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJykuQ29sb3J9IHNoYWRvd0NvbG9yIFRoZSB0ZXh0IHNoYWRvdyBlZmZlY3QgY29sb3JcbiAqIGFuZCBvcGFjaXR5LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IHNoYWRvd09mZnNldCBUaGUgdGV4dCBzaGFkb3cgZWZmZWN0IHNoaWZ0IGFtb3VudCBmcm9tIG9yaWdpbmFsIHRleHQuIE9ubHkgd29ya3NcbiAqIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGF1dG9XaWR0aCBBdXRvbWF0aWNhbGx5IHNldCB0aGUgd2lkdGggb2YgdGhlIGNvbXBvbmVudCB0byBiZSB0aGUgc2FtZSBhcyB0aGVcbiAqIHRleHRXaWR0aC4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvSGVpZ2h0IEF1dG9tYXRpY2FsbHkgc2V0IHRoZSBoZWlnaHQgb2YgdGhlIGNvbXBvbmVudCB0byBiZSB0aGUgc2FtZSBhc1xuICogdGhlIHRleHRIZWlnaHQuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBmaXRNb2RlIFNldCBob3cgdGhlIGNvbnRlbnQgc2hvdWxkIGJlIGZpdHRlZCBhbmQgcHJlc2VydmUgdGhlIGFzcGVjdCByYXRpbyBvZlxuICogdGhlIHNvdXJjZSB0ZXh0dXJlIG9yIHNwcml0ZS4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmb250QXNzZXQgVGhlIGlkIG9mIHRoZSBmb250IGFzc2V0IHVzZWQgZm9yIHJlbmRlcmluZyB0aGUgdGV4dC4gT25seSB3b3Jrc1xuICogZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9mb250L2ZvbnQuanMnKS5Gb250fSBmb250IFRoZSBmb250IHVzZWQgZm9yIHJlbmRlcmluZyB0aGUgdGV4dC4gT25seVxuICogd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmb250U2l6ZSBUaGUgc2l6ZSBvZiB0aGUgZm9udC4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvRml0V2lkdGggV2hlbiB0cnVlIHRoZSBmb250IHNpemUgYW5kIGxpbmUgaGVpZ2h0IHdpbGwgc2NhbGUgc28gdGhhdCB0aGVcbiAqIHRleHQgZml0cyBpbnNpZGUgdGhlIHdpZHRoIG9mIHRoZSBFbGVtZW50LiBUaGUgZm9udCBzaXplIHdpbGwgYmUgc2NhbGVkIGJldHdlZW4gbWluRm9udFNpemUgYW5kXG4gKiBtYXhGb250U2l6ZS4gVGhlIHZhbHVlIG9mIGF1dG9GaXRXaWR0aCB3aWxsIGJlIGlnbm9yZWQgaWYgYXV0b1dpZHRoIGlzIHRydWUuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGF1dG9GaXRIZWlnaHQgV2hlbiB0cnVlIHRoZSBmb250IHNpemUgYW5kIGxpbmUgaGVpZ2h0IHdpbGwgc2NhbGUgc28gdGhhdCB0aGVcbiAqIHRleHQgZml0cyBpbnNpZGUgdGhlIGhlaWdodCBvZiB0aGUgRWxlbWVudC4gVGhlIGZvbnQgc2l6ZSB3aWxsIGJlIHNjYWxlZCBiZXR3ZWVuIG1pbkZvbnRTaXplIGFuZFxuICogbWF4Rm9udFNpemUuIFRoZSB2YWx1ZSBvZiBhdXRvRml0SGVpZ2h0IHdpbGwgYmUgaWdub3JlZCBpZiBhdXRvSGVpZ2h0IGlzIHRydWUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWluRm9udFNpemUgVGhlIG1pbmltdW0gc2l6ZSB0aGF0IHRoZSBmb250IGNhbiBzY2FsZSB0byB3aGVuIGF1dG9GaXRXaWR0aCBvclxuICogYXV0b0ZpdEhlaWdodCBhcmUgdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXhGb250U2l6ZSBUaGUgbWF4aW11bSBzaXplIHRoYXQgdGhlIGZvbnQgY2FuIHNjYWxlIHRvIHdoZW4gYXV0b0ZpdFdpZHRoIG9yXG4gKiBhdXRvRml0SGVpZ2h0IGFyZSB0cnVlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwYWNpbmcgVGhlIHNwYWNpbmcgYmV0d2VlbiB0aGUgbGV0dGVycyBvZiB0aGUgdGV4dC4gT25seSB3b3JrcyBmb3JcbiAqIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaW5lSGVpZ2h0IFRoZSBoZWlnaHQgb2YgZWFjaCBsaW5lIG9mIHRleHQuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHdyYXBMaW5lcyBXaGV0aGVyIHRvIGF1dG9tYXRpY2FsbHkgd3JhcCBsaW5lcyBiYXNlZCBvbiB0aGUgZWxlbWVudCB3aWR0aC5cbiAqIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcywgYW5kIHdoZW4gYXV0b1dpZHRoIGlzIHNldCB0byBmYWxzZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXhMaW5lcyBUaGUgbWF4aW11bSBudW1iZXIgb2YgbGluZXMgdGhhdCB0aGUgRWxlbWVudCBjYW4gd3JhcCB0by4gQW55XG4gKiBsZWZ0b3ZlciB0ZXh0IHdpbGwgYmUgYXBwZW5kZWQgdG8gdGhlIGxhc3QgbGluZS4gU2V0IHRoaXMgdG8gbnVsbCB0byBhbGxvdyB1bmxpbWl0ZWQgbGluZXMuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGFsaWdubWVudCBUaGUgaG9yaXpvbnRhbCBhbmQgdmVydGljYWwgYWxpZ25tZW50IG9mIHRoZSB0ZXh0LiBWYWx1ZXMgcmFuZ2UgZnJvbVxuICogMCB0byAxIHdoZXJlIFswLDBdIGlzIHRoZSBib3R0b20gbGVmdCBhbmQgWzEsMV0gaXMgdGhlIHRvcCByaWdodC4gIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdGV4dCBUaGUgdGV4dCB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy4gVG9cbiAqIG92ZXJyaWRlIGNlcnRhaW4gdGV4dCBzdHlsaW5nIHByb3BlcnRpZXMgb24gYSBwZXItY2hhcmFjdGVyIGJhc2lzLCB0aGUgdGV4dCBjYW4gb3B0aW9uYWxseVxuICogaW5jbHVkZSBtYXJrdXAgdGFncyBjb250YWluZWQgd2l0aGluIHNxdWFyZSBicmFja2V0cy4gU3VwcG9ydGVkIHRhZ3MgYXJlOlxuICpcbiAqIC0gYGNvbG9yYCAtIG92ZXJyaWRlIHRoZSBlbGVtZW50J3MgYGNvbG9yYCBwcm9wZXJ0eS4gRXhhbXBsZXM6XG4gKiAgIC0gYFtjb2xvcj1cIiNmZjAwMDBcIl1yZWQgdGV4dFsvY29sb3JdYFxuICogICAtIGBbY29sb3I9XCIjMDBmZjAwXCJdZ3JlZW4gdGV4dFsvY29sb3JdYFxuICogICAtIGBbY29sb3I9XCIjMDAwMGZmXCJdYmx1ZSB0ZXh0Wy9jb2xvcl1gXG4gKiAtIGBvdXRsaW5lYCAtIG92ZXJyaWRlIHRoZSBlbGVtZW50J3MgYG91dGxpbmVDb2xvcmAgYW5kIGBvdXRsaW5lVGhpY2tuZXNzYCBwcm9wZXJ0aWVzLiBFeGFtcGxlOlxuICogICAtIGBbb3V0bGluZSBjb2xvcj1cIiNmZmZmZmZcIiB0aGlja25lc3M9XCIwLjVcIl10ZXh0Wy9vdXRsaW5lXWBcbiAqIC0gYHNoYWRvd2AgLSBvdmVycmlkZSB0aGUgZWxlbWVudCdzIGBzaGFkb3dDb2xvcmAgYW5kIGBzaGFkb3dPZmZzZXRgIHByb3BlcnRpZXMuIEV4YW1wbGVzOlxuICogICAtIGBbc2hhZG93IGNvbG9yPVwiI2ZmZmZmZlwiIG9mZnNldD1cIjAuNVwiXXRleHRbL3NoYWRvd11gXG4gKiAgIC0gYFtzaGFkb3cgY29sb3I9XCIjMDAwMDAwXCIgb2Zmc2V0WD1cIjAuMVwiIG9mZnNldFk9XCIwLjJcIl10ZXh0Wy9zaGFkb3ddYFxuICpcbiAqIE5vdGUgdGhhdCBtYXJrdXAgdGFncyBhcmUgb25seSBwcm9jZXNzZWQgaWYgdGhlIHRleHQgZWxlbWVudCdzIGBlbmFibGVNYXJrdXBgIHByb3BlcnR5IGlzIHNldCB0b1xuICogdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBrZXkgVGhlIGxvY2FsaXphdGlvbiBrZXkgdG8gdXNlIHRvIGdldCB0aGUgbG9jYWxpemVkIHRleHQgZnJvbVxuICoge0BsaW5rIEFwcGxpY2F0aW9uI2kxOG59LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGV4dHVyZUFzc2V0IFRoZSBpZCBvZiB0aGUgdGV4dHVyZSBhc3NldCB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSB0ZXh0dXJlIFRoZSB0ZXh0dXJlIHRvXG4gKiByZW5kZXIuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3ByaXRlQXNzZXQgVGhlIGlkIG9mIHRoZSBzcHJpdGUgYXNzZXQgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcyB3aGljaCBjYW4gcmVuZGVyIGVpdGhlciBhIHRleHR1cmUgb3IgYSBzcHJpdGUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvc3ByaXRlLmpzJykuU3ByaXRlfSBzcHJpdGUgVGhlIHNwcml0ZSB0byByZW5kZXIuIE9ubHkgd29ya3NcbiAqIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIHdoaWNoIGNhbiByZW5kZXIgZWl0aGVyIGEgdGV4dHVyZSBvciBhIHNwcml0ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzcHJpdGVGcmFtZSBUaGUgZnJhbWUgb2YgdGhlIHNwcml0ZSB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIHdobyBoYXZlIGEgc3ByaXRlIGFzc2lnbmVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHBpeGVsc1BlclVuaXQgVGhlIG51bWJlciBvZiBwaXhlbHMgdGhhdCBtYXAgdG8gb25lIFBsYXlDYW52YXMgdW5pdC4gT25seVxuICogd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMgd2hvIGhhdmUgYSBzbGljZWQgc3ByaXRlIGFzc2lnbmVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG1hdGVyaWFsQXNzZXQgVGhlIGlkIG9mIHRoZSBtYXRlcmlhbCBhc3NldCB0byB1c2Ugd2hlbiByZW5kZXJpbmcgYW4gaW1hZ2UuXG4gKiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfSBtYXRlcmlhbCBUaGUgbWF0ZXJpYWwgdG8gdXNlXG4gKiB3aGVuIHJlbmRlcmluZyBhbiBpbWFnZS4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7VmVjNH0gcmVjdCBTcGVjaWZpZXMgd2hpY2ggcmVnaW9uIG9mIHRoZSB0ZXh0dXJlIHRvIHVzZSBpbiBvcmRlciB0byByZW5kZXIgYW4gaW1hZ2UuXG4gKiBWYWx1ZXMgcmFuZ2UgZnJvbSAwIHRvIDEgYW5kIGluZGljYXRlIHUsIHYsIHdpZHRoLCBoZWlnaHQuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBydGxSZW9yZGVyIFJlb3JkZXIgdGhlIHRleHQgZm9yIFJUTCBsYW5ndWFnZXMgdXNpbmcgYSBmdW5jdGlvbiByZWdpc3RlcmVkXG4gKiBieSBgYXBwLnN5c3RlbXMuZWxlbWVudC5yZWdpc3RlclVuaWNvZGVDb252ZXJ0ZXJgLlxuICogQHByb3BlcnR5IHtib29sZWFufSB1bmljb2RlQ29udmVydGVyIENvbnZlcnQgdW5pY29kZSBjaGFyYWN0ZXJzIHVzaW5nIGEgZnVuY3Rpb24gcmVnaXN0ZXJlZCBieVxuICogYGFwcC5zeXN0ZW1zLmVsZW1lbnQucmVnaXN0ZXJVbmljb2RlQ29udmVydGVyYC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZW5hYmxlTWFya3VwIEZsYWcgZm9yIGVuYWJsaW5nIG1hcmt1cCBwcm9jZXNzaW5nLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByYW5nZVN0YXJ0IEluZGV4IG9mIHRoZSBmaXJzdCBjaGFyYWN0ZXIgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhbmdlRW5kIEluZGV4IG9mIHRoZSBsYXN0IGNoYXJhY3RlciB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG1hc2sgU3dpdGNoIEltYWdlIEVsZW1lbnQgaW50byBhIG1hc2suIE1hc2tzIGRvIG5vdCByZW5kZXIgaW50byB0aGUgc2NlbmUsXG4gKiBidXQgaW5zdGVhZCBsaW1pdCBjaGlsZCBlbGVtZW50cyB0byBvbmx5IGJlIHJlbmRlcmVkIHdoZXJlIHRoaXMgZWxlbWVudCBpcyByZW5kZXJlZC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgRWxlbWVudENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEVsZW1lbnRDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5FbGVtZW50Q29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIC8vIHNldCB0byB0cnVlIGJ5IHRoZSBFbGVtZW50Q29tcG9uZW50U3lzdGVtIHdoaWxlXG4gICAgICAgIC8vIHRoZSBjb21wb25lbnQgaXMgYmVpbmcgaW5pdGlhbGl6ZWRcbiAgICAgICAgdGhpcy5fYmVpbmdJbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2FuY2hvciA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2xvY2FsQW5jaG9yID0gbmV3IFZlYzQoKTtcblxuICAgICAgICB0aGlzLl9waXZvdCA9IG5ldyBWZWMyKCk7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSB0aGlzLl9jYWxjdWxhdGVkV2lkdGggPSAzMjtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdGhpcy5fY2FsY3VsYXRlZEhlaWdodCA9IDMyO1xuXG4gICAgICAgIHRoaXMuX21hcmdpbiA9IG5ldyBWZWM0KDAsIDAsIC0zMiwgLTMyKTtcblxuICAgICAgICAvLyB0aGUgbW9kZWwgdHJhbnNmb3JtIHVzZWQgdG8gcmVuZGVyXG4gICAgICAgIHRoaXMuX21vZGVsVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcblxuICAgICAgICB0aGlzLl9zY3JlZW5Ub1dvcmxkID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvLyB0cmFuc2Zvcm0gdGhhdCB1cGRhdGVzIGxvY2FsIHBvc2l0aW9uIGFjY29yZGluZyB0byBhbmNob3IgdmFsdWVzXG4gICAgICAgIHRoaXMuX2FuY2hvclRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIC8vIHRyYW5zZm9ybXMgdG8gY2FsY3VsYXRlIHNjcmVlbiBjb29yZGluYXRlc1xuICAgICAgICB0aGlzLl9wYXJlbnRXb3JsZFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIHRoaXMuX3NjcmVlblRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgLy8gdGhlIGNvcm5lcnMgb2YgdGhlIGVsZW1lbnQgcmVsYXRpdmUgdG8gaXRzIHNjcmVlbiBjb21wb25lbnQuXG4gICAgICAgIC8vIE9yZGVyIGlzIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCwgdG9wIGxlZnRcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVycyA9IFtuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpXTtcblxuICAgICAgICAvLyBjYW52YXMtc3BhY2UgY29ybmVycyBvZiB0aGUgZWxlbWVudC5cbiAgICAgICAgLy8gT3JkZXIgaXMgYm90dG9tIGxlZnQsIGJvdHRvbSByaWdodCwgdG9wIHJpZ2h0LCB0b3AgbGVmdFxuICAgICAgICB0aGlzLl9jYW52YXNDb3JuZXJzID0gW25ldyBWZWMyKCksIG5ldyBWZWMyKCksIG5ldyBWZWMyKCksIG5ldyBWZWMyKCldO1xuXG4gICAgICAgIC8vIHRoZSB3b3JsZC1zcGFjZSBjb3JuZXJzIG9mIHRoZSBlbGVtZW50XG4gICAgICAgIC8vIE9yZGVyIGlzIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCwgdG9wIGxlZnRcbiAgICAgICAgdGhpcy5fd29ybGRDb3JuZXJzID0gW25ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKCldO1xuXG4gICAgICAgIHRoaXMuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLmVudGl0eS5vbignaW5zZXJ0JywgdGhpcy5fb25JbnNlcnQsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX3BhdGNoKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBFbnRpdHkgd2l0aCBhIHtAbGluayBTY3JlZW5Db21wb25lbnR9IHRoYXQgdGhpcyBjb21wb25lbnQgYmVsb25ncyB0by4gVGhpcyBpc1xuICAgICAgICAgKiBhdXRvbWF0aWNhbGx5IHNldCB3aGVuIHRoZSBjb21wb25lbnQgaXMgYSBjaGlsZCBvZiBhIFNjcmVlbkNvbXBvbmVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VudGl0eXxudWxsfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY3JlZW4gPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSBFTEVNRU5UVFlQRV9HUk9VUDtcblxuICAgICAgICAvLyBlbGVtZW50IHR5cGVzXG4gICAgICAgIHRoaXMuX2ltYWdlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdGV4dCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2dyb3VwID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIC8vIEZpdCBtb2RlXG4gICAgICAgIHRoaXMuX2ZpdE1vZGUgPSBGSVRNT0RFX1NUUkVUQ0g7XG5cbiAgICAgICAgLy8gaW5wdXQgcmVsYXRlZFxuICAgICAgICB0aGlzLl91c2VJbnB1dCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtMQVlFUklEX1VJXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IFVJIGxheWVyXG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWxzID0gW107IC8vIHN0b3JlIG1vZGVscyB0aGF0IGhhdmUgYmVlbiBhZGRlZCB0byBsYXllciBzbyB3ZSBjYW4gcmUtYWRkIHdoZW4gbGF5ZXIgaXMgY2hhbmdlZFxuXG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBJZCA9IC0xO1xuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXAgPSBudWxsO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgLy9cblxuICAgICAgICB0aGlzLl9vZmZzZXRSZWFkQXQgPSAwO1xuICAgICAgICB0aGlzLl9tYXNrT2Zmc2V0ID0gMC41O1xuICAgICAgICB0aGlzLl9tYXNrZWRCeSA9IG51bGw7IC8vIHRoZSBlbnRpdHkgdGhhdCBpcyBtYXNraW5nIHRoaXMgZWxlbWVudFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGlzIHByZXNzZWQgd2hpbGUgdGhlIGN1cnNvciBpcyBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW5cbiAgICAgKiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjbW91c2Vkb3duXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBpcyByZWxlYXNlZCB3aGlsZSB0aGUgY3Vyc29yIGlzIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlblxuICAgICAqIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCNtb3VzZXVwXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBjdXJzb3IgZW50ZXJzIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjbW91c2VlbnRlclxuICAgICAqIEBwYXJhbSB7RWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgbW91c2UgY3Vyc29yIGxlYXZlcyB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I21vdXNlbGVhdmVcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGN1cnNvciBpcyBtb3ZlZCBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I21vdXNlbW92ZVxuICAgICAqIEBwYXJhbSB7RWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgbW91c2Ugd2hlZWwgaXMgc2Nyb2xsZWQgb24gdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCNtb3VzZXdoZWVsXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBpcyBwcmVzc2VkIGFuZCByZWxlYXNlZCBvbiB0aGUgY29tcG9uZW50IG9yIHdoZW4gYSB0b3VjaCBzdGFydHMgYW5kXG4gICAgICogZW5kcyBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I2NsaWNrXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudHxFbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgdG91Y2ggc3RhcnRzIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjdG91Y2hzdGFydFxuICAgICAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHRvdWNoIGVuZHMgb24gdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCN0b3VjaGVuZFxuICAgICAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHRvdWNoIG1vdmVzIGFmdGVyIGl0IHN0YXJ0ZWQgdG91Y2hpbmcgdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0XG4gICAgICogaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I3RvdWNobW92ZVxuICAgICAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHRvdWNoIGlzIGNhbmNlbGVkIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjdG91Y2hjYW5jZWxcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIGdldCBfYWJzTGVmdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsQW5jaG9yLnggKyB0aGlzLl9tYXJnaW4ueDtcbiAgICB9XG5cbiAgICBnZXQgX2Fic1JpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IueiAtIHRoaXMuX21hcmdpbi56O1xuICAgIH1cblxuICAgIGdldCBfYWJzVG9wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IudyAtIHRoaXMuX21hcmdpbi53O1xuICAgIH1cblxuICAgIGdldCBfYWJzQm90dG9tKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IueSArIHRoaXMuX21hcmdpbi55O1xuICAgIH1cblxuICAgIGdldCBfaGFzU3BsaXRBbmNob3JzWCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguYWJzKHRoaXMuX2FuY2hvci54IC0gdGhpcy5fYW5jaG9yLnopID4gMC4wMDE7XG4gICAgfVxuXG4gICAgZ2V0IF9oYXNTcGxpdEFuY2hvcnNZKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5hYnModGhpcy5fYW5jaG9yLnkgLSB0aGlzLl9hbmNob3IudykgPiAwLjAwMTtcbiAgICB9XG5cbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSByZXR1cm4gdGhpcy5faW1hZ2UuYWFiYjtcbiAgICAgICAgaWYgKHRoaXMuX3RleHQpIHJldHVybiB0aGlzLl90ZXh0LmFhYmI7XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHdoZXJlIHRoZSBsZWZ0LCBib3R0b20sIHJpZ2h0IGFuZCB0b3AgZWRnZXMgb2YgdGhlIGNvbXBvbmVudCBhcmUgYW5jaG9yZWQgcmVsYXRpdmVcbiAgICAgKiB0byBpdHMgcGFyZW50LiBFYWNoIHZhbHVlIHJhbmdlcyBmcm9tIDAgdG8gMS4gZS5nLiBhIHZhbHVlIG9mIFswLCAwLCAwLCAwXSBtZWFucyB0aGF0IHRoZVxuICAgICAqIGVsZW1lbnQgd2lsbCBiZSBhbmNob3JlZCB0byB0aGUgYm90dG9tIGxlZnQgb2YgaXRzIHBhcmVudC4gQSB2YWx1ZSBvZiBbMSwgMSwgMSwgMV0gbWVhbnMgaXRcbiAgICAgKiB3aWxsIGJlIGFuY2hvcmVkIHRvIHRoZSB0b3AgcmlnaHQuIEEgc3BsaXQgYW5jaG9yIGlzIHdoZW4gdGhlIGxlZnQtcmlnaHQgb3IgdG9wLWJvdHRvbSBwYWlyc1xuICAgICAqIG9mIHRoZSBhbmNob3IgYXJlIG5vdCBlcXVhbC4gSW4gdGhhdCBjYXNlIHRoZSBjb21wb25lbnQgd2lsbCBiZSByZXNpemVkIHRvIGNvdmVyIHRoYXQgZW50aXJlXG4gICAgICogYXJlYS4gZS5nLiBhIHZhbHVlIG9mIFswLCAwLCAxLCAxXSB3aWxsIG1ha2UgdGhlIGNvbXBvbmVudCByZXNpemUgZXhhY3RseSBhcyBpdHMgcGFyZW50LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5hcHAucm9vdC5maW5kQnlOYW1lKFwiSW52ZW50b3J5XCIpLmVsZW1lbnQuYW5jaG9yID0gbmV3IHBjLlZlYzQoTWF0aC5yYW5kb20oKSAqIDAuMSwgMCwgMSwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5hcHAucm9vdC5maW5kQnlOYW1lKFwiSW52ZW50b3J5XCIpLmVsZW1lbnQuYW5jaG9yID0gW01hdGgucmFuZG9tKCkgKiAwLjEsIDAsIDEsIDBdO1xuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzQgfCBudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgYW5jaG9yKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci5jb3B5KHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci5zZXQoLi4udmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmVudGl0eS5fcGFyZW50ICYmICF0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlTG9jYWxBbmNob3JzKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVTaXplKHRoaXMuX2hhc1NwbGl0QW5jaG9yc1gsIHRoaXMuX2hhc1NwbGl0QW5jaG9yc1kpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIGlmICghdGhpcy5lbnRpdHkuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5fZGlydGlmeUxvY2FsKCk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6YW5jaG9yJywgdGhpcy5fYW5jaG9yKTtcbiAgICB9XG5cbiAgICBnZXQgYW5jaG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5jaG9yO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBlbGVtZW50IHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5FTEVNRU5ULCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdmFsdWUgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLkVMRU1FTlQsIHZhbHVlLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUgPCAwICYmIHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAvLyByZS1hZGQgbW9kZWwgdG8gc2NlbmUsIGluIGNhc2UgaXQgd2FzIHJlbW92ZWQgYnkgYmF0Y2hpbmdcbiAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZSAmJiB0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycyh0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3RleHQgJiYgdGhpcy5fdGV4dC5fbW9kZWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnModGhpcy5fdGV4dC5fbW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cElkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGJhdGNoR3JvdXBJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoR3JvdXBJZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgYm90dG9tIGVkZ2Ugb2YgdGhlIGFuY2hvci4gQ2FuIGJlIHVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBhIHNwbGl0XG4gICAgICogYW5jaG9yIHRvIG1ha2UgdGhlIGNvbXBvbmVudCdzIHRvcCBlZGdlIGFsd2F5cyBiZSAndG9wJyB1bml0cyBhd2F5IGZyb20gdGhlIHRvcC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGJvdHRvbSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4ueSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3dCA9IHRoaXMuX2Fic1RvcDtcbiAgICAgICAgY29uc3Qgd2IgPSB0aGlzLl9sb2NhbEFuY2hvci55ICsgdmFsdWU7XG4gICAgICAgIHRoaXMuX3NldEhlaWdodCh3dCAtIHdiKTtcblxuICAgICAgICBwLnkgPSB2YWx1ZSArIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQgKiB0aGlzLl9waXZvdC55O1xuICAgICAgICB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHApO1xuICAgIH1cblxuICAgIGdldCBib3R0b20oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXJnaW4ueTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggYXQgd2hpY2ggdGhlIGVsZW1lbnQgd2lsbCBiZSByZW5kZXJlZC4gSW4gbW9zdCBjYXNlcyB0aGlzIHdpbGwgYmUgdGhlIHNhbWUgYXNcbiAgICAgKiBgd2lkdGhgLiBIb3dldmVyLCBpbiBzb21lIGNhc2VzIHRoZSBlbmdpbmUgbWF5IGNhbGN1bGF0ZSBhIGRpZmZlcmVudCB3aWR0aCBmb3IgdGhlIGVsZW1lbnQsXG4gICAgICogc3VjaCBhcyB3aGVuIHRoZSBlbGVtZW50IGlzIHVuZGVyIHRoZSBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gSW4gdGhlc2VcbiAgICAgKiBzY2VuYXJpb3MsIGBjYWxjdWxhdGVkV2lkdGhgIG1heSBiZSBzbWFsbGVyIG9yIGxhcmdlciB0aGFuIHRoZSB3aWR0aCB0aGF0IHdhcyBzZXQgaW4gdGhlXG4gICAgICogZWRpdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgY2FsY3VsYXRlZFdpZHRoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRXaWR0aCh2YWx1ZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZWRXaWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IGF0IHdoaWNoIHRoZSBlbGVtZW50IHdpbGwgYmUgcmVuZGVyZWQuIEluIG1vc3QgY2FzZXMgdGhpcyB3aWxsIGJlIHRoZSBzYW1lIGFzXG4gICAgICogYGhlaWdodGAuIEhvd2V2ZXIsIGluIHNvbWUgY2FzZXMgdGhlIGVuZ2luZSBtYXkgY2FsY3VsYXRlIGEgZGlmZmVyZW50IGhlaWdodCBmb3IgdGhlIGVsZW1lbnQsXG4gICAgICogc3VjaCBhcyB3aGVuIHRoZSBlbGVtZW50IGlzIHVuZGVyIHRoZSBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gSW4gdGhlc2VcbiAgICAgKiBzY2VuYXJpb3MsIGBjYWxjdWxhdGVkSGVpZ2h0YCBtYXkgYmUgc21hbGxlciBvciBsYXJnZXIgdGhhbiB0aGUgaGVpZ2h0IHRoYXQgd2FzIHNldCBpbiB0aGVcbiAgICAgKiBlZGl0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjYWxjdWxhdGVkSGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRIZWlnaHQodmFsdWUsIHRydWUpO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVkSGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FsY3VsYXRlZEhlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiA0IHtAbGluayBWZWMyfXMgdGhhdCByZXByZXNlbnQgdGhlIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCBhbmQgdG9wXG4gICAgICogbGVmdCBjb3JuZXJzIG9mIHRoZSBjb21wb25lbnQgaW4gY2FudmFzIHBpeGVscy4gT25seSB3b3JrcyBmb3Igc2NyZWVuIHNwYWNlIGVsZW1lbnRcbiAgICAgKiBjb21wb25lbnRzLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzJbXX1cbiAgICAgKi9cbiAgICBnZXQgY2FudmFzQ29ybmVycygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jYW52YXNDb3JuZXJzRGlydHkgfHwgIXRoaXMuc2NyZWVuIHx8ICF0aGlzLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY2FudmFzQ29ybmVycztcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjcmVlbkNvcm5lcnMgPSB0aGlzLnNjcmVlbkNvcm5lcnM7XG4gICAgICAgIGNvbnN0IHN4ID0gZGV2aWNlLmNhbnZhcy5jbGllbnRXaWR0aCAvIGRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3Qgc3kgPSBkZXZpY2UuY2FudmFzLmNsaWVudEhlaWdodCAvIGRldmljZS5oZWlnaHQ7XG5cbiAgICAgICAgLy8gc2NhbGUgc2NyZWVuIGNvcm5lcnMgdG8gY2FudmFzIHNpemUgYW5kIHJldmVyc2UgeVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fY2FudmFzQ29ybmVyc1tpXS5zZXQoc2NyZWVuQ29ybmVyc1tpXS54ICogc3gsIChkZXZpY2UuaGVpZ2h0IC0gc2NyZWVuQ29ybmVyc1tpXS55KSAqIHN5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9jYW52YXNDb3JuZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkcmF3IG9yZGVyIG9mIHRoZSBjb21wb25lbnQuIEEgaGlnaGVyIHZhbHVlIG1lYW5zIHRoYXQgdGhlIGNvbXBvbmVudCB3aWxsIGJlIHJlbmRlcmVkIG9uXG4gICAgICogdG9wIG9mIG90aGVyIGNvbXBvbmVudHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBkcmF3T3JkZXIodmFsdWUpIHtcbiAgICAgICAgbGV0IHByaW9yaXR5ID0gMDtcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICBwcmlvcml0eSA9IHRoaXMuc2NyZWVuLnNjcmVlbi5wcmlvcml0eTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA+IDB4RkZGRkZGKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKCdFbGVtZW50LmRyYXdPcmRlciBsYXJnZXIgdGhhbiBtYXggc2l6ZSBvZjogJyArIDB4RkZGRkZGKTtcbiAgICAgICAgICAgIHZhbHVlID0gMHhGRkZGRkY7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzY3JlZW4gcHJpb3JpdHkgaXMgc3RvcmVkIGluIHRoZSB0b3AgOCBiaXRzXG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IChwcmlvcml0eSA8PCAyNCkgKyB2YWx1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6ZHJhd29yZGVyJywgdGhpcy5fZHJhd09yZGVyKTtcbiAgICB9XG5cbiAgICBnZXQgZHJhd09yZGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZHJhd09yZGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgYXMgc2V0IGluIHRoZSBlZGl0b3IuIE5vdGUgdGhhdCBpbiBzb21lIGNhc2VzIHRoaXMgbWF5IG5vdCByZWZsZWN0XG4gICAgICogdGhlIHRydWUgaGVpZ2h0IGF0IHdoaWNoIHRoZSBlbGVtZW50IGlzIHJlbmRlcmVkLCBzdWNoIGFzIHdoZW4gdGhlIGVsZW1lbnQgaXMgdW5kZXIgdGhlXG4gICAgICogY29udHJvbCBvZiBhIHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudH0uIFNlZSBgY2FsY3VsYXRlZEhlaWdodGAgaW4gb3JkZXIgdG8gZW5zdXJlIHlvdSBhcmVcbiAgICAgKiByZWFkaW5nIHRoZSB0cnVlIGhlaWdodCBhdCB3aGljaCB0aGUgZWxlbWVudCB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5faGFzU3BsaXRBbmNob3JzWSkge1xuICAgICAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZEhlaWdodCh2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDpoZWlnaHQnLCB0aGlzLl9oZWlnaHQpO1xuICAgIH1cblxuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbGF5ZXIgSURzICh7QGxpbmsgTGF5ZXIjaWR9KSB0byB3aGljaCB0aGlzIGVsZW1lbnQgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCxcbiAgICAgKiBwb3AsIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZGVkTW9kZWxzLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fYWRkZWRNb2RlbHNbal0ubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sYXllcnMgPSB2YWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCB8fCAhdGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoKSByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9hZGRlZE1vZGVsc1tqXS5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGFuY2hvci4gQ2FuIGJlIHVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBhIHNwbGl0XG4gICAgICogYW5jaG9yIHRvIG1ha2UgdGhlIGNvbXBvbmVudCdzIGxlZnQgZWRnZSBhbHdheXMgYmUgJ2xlZnQnIHVuaXRzIGF3YXkgZnJvbSB0aGUgbGVmdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxlZnQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWFyZ2luLnggPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgY29uc3Qgd3IgPSB0aGlzLl9hYnNSaWdodDtcbiAgICAgICAgY29uc3Qgd2wgPSB0aGlzLl9sb2NhbEFuY2hvci54ICsgdmFsdWU7XG4gICAgICAgIHRoaXMuX3NldFdpZHRoKHdyIC0gd2wpO1xuXG4gICAgICAgIHAueCA9IHZhbHVlICsgdGhpcy5fY2FsY3VsYXRlZFdpZHRoICogdGhpcy5fcGl2b3QueDtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcbiAgICB9XG5cbiAgICBnZXQgbGVmdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcmdpbi54O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBsZWZ0LCBib3R0b20sIHJpZ2h0IGFuZCB0b3AgZWRnZXMgb2YgdGhlIGFuY2hvci4gRm9yIGV4YW1wbGUgaWYgd2UgYXJlXG4gICAgICogdXNpbmcgYSBzcGxpdCBhbmNob3IgbGlrZSBbMCwwLDEsMV0gYW5kIHRoZSBtYXJnaW4gaXMgWzAsMCwwLDBdIHRoZW4gdGhlIGNvbXBvbmVudCB3aWxsIGJlXG4gICAgICogdGhlIHNhbWUgd2lkdGggYW5kIGhlaWdodCBhcyBpdHMgcGFyZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzR9XG4gICAgICovXG4gICAgc2V0IG1hcmdpbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4uY29weSh2YWx1ZSk7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNpemUodHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0Om1hcmdpbicsIHRoaXMuX21hcmdpbik7XG4gICAgfVxuXG4gICAgZ2V0IG1hcmdpbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcmdpbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGVudGl0eSB0aGF0IGlzIGN1cnJlbnRseSBtYXNraW5nIHRoaXMgZWxlbWVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBnZXQgbWFza2VkQnkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrZWRCeTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcG9zaXRpb24gb2YgdGhlIHBpdm90IG9mIHRoZSBjb21wb25lbnQgcmVsYXRpdmUgdG8gaXRzIGFuY2hvci4gRWFjaCB2YWx1ZSByYW5nZXMgZnJvbSAwXG4gICAgICogdG8gMSB3aGVyZSBbMCwwXSBpcyB0aGUgYm90dG9tIGxlZnQgYW5kIFsxLDFdIGlzIHRoZSB0b3AgcmlnaHQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmFwcC5yb290LmZpbmRCeU5hbWUoXCJJbnZlbnRvcnlcIikuZWxlbWVudC5waXZvdCA9IFtNYXRoLnJhbmRvbSgpICogMC4xLCBNYXRoLnJhbmRvbSgpICogMC4xXTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmFwcC5yb290LmZpbmRCeU5hbWUoXCJJbnZlbnRvcnlcIikuZWxlbWVudC5waXZvdCA9IG5ldyBwYy5WZWMyKE1hdGgucmFuZG9tKCkgKiAwLjEsIE1hdGgucmFuZG9tKCkgKiAwLjEpO1xuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzIgfCBudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgcGl2b3QodmFsdWUpIHtcbiAgICAgICAgY29uc3QgeyBwaXZvdCwgbWFyZ2luIH0gPSB0aGlzO1xuICAgICAgICBjb25zdCBwcmV2WCA9IHBpdm90Lng7XG4gICAgICAgIGNvbnN0IHByZXZZID0gcGl2b3QueTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBWZWMyKSB7XG4gICAgICAgICAgICBwaXZvdC5jb3B5KHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBpdm90LnNldCguLi52YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBteCA9IG1hcmdpbi54ICsgbWFyZ2luLno7XG4gICAgICAgIGNvbnN0IGR4ID0gcGl2b3QueCAtIHByZXZYO1xuICAgICAgICBtYXJnaW4ueCArPSBteCAqIGR4O1xuICAgICAgICBtYXJnaW4ueiAtPSBteCAqIGR4O1xuXG4gICAgICAgIGNvbnN0IG15ID0gbWFyZ2luLnkgKyBtYXJnaW4udztcbiAgICAgICAgY29uc3QgZHkgPSBwaXZvdC55IC0gcHJldlk7XG4gICAgICAgIG1hcmdpbi55ICs9IG15ICogZHk7XG4gICAgICAgIG1hcmdpbi53IC09IG15ICogZHk7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU2l6ZShmYWxzZSwgZmFsc2UpO1xuXG4gICAgICAgIC8vIHdlIG5lZWQgdG8gZmxhZyBjaGlsZHJlbiBhcyBkaXJ0eSB0b29cbiAgICAgICAgLy8gaW4gb3JkZXIgZm9yIHRoZW0gdG8gdXBkYXRlIHRoZWlyIHBvc2l0aW9uXG4gICAgICAgIHRoaXMuX2ZsYWdDaGlsZHJlbkFzRGlydHkoKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDpwaXZvdCcsIHBpdm90KTtcbiAgICB9XG5cbiAgICBnZXQgcGl2b3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXZvdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgYW5jaG9yLiBDYW4gYmUgdXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIGEgc3BsaXRcbiAgICAgKiBhbmNob3IgdG8gbWFrZSB0aGUgY29tcG9uZW50J3MgcmlnaHQgZWRnZSBhbHdheXMgYmUgJ3JpZ2h0JyB1bml0cyBhd2F5IGZyb20gdGhlIHJpZ2h0LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcmlnaHQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWFyZ2luLnogPSB2YWx1ZTtcblxuICAgICAgICAvLyB1cGRhdGUgd2lkdGhcbiAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgY29uc3Qgd2wgPSB0aGlzLl9hYnNMZWZ0O1xuICAgICAgICBjb25zdCB3ciA9IHRoaXMuX2xvY2FsQW5jaG9yLnogLSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fc2V0V2lkdGgod3IgLSB3bCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHBvc2l0aW9uXG4gICAgICAgIHAueCA9ICh0aGlzLl9sb2NhbEFuY2hvci56IC0gdGhpcy5fbG9jYWxBbmNob3IueCkgLSB2YWx1ZSAtICh0aGlzLl9jYWxjdWxhdGVkV2lkdGggKiAoMSAtIHRoaXMuX3Bpdm90LngpKTtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcbiAgICB9XG5cbiAgICBnZXQgcmlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXJnaW4uejtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiA0IHtAbGluayBWZWMzfXMgdGhhdCByZXByZXNlbnQgdGhlIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCBhbmQgdG9wXG4gICAgICogbGVmdCBjb3JuZXJzIG9mIHRoZSBjb21wb25lbnQgcmVsYXRpdmUgdG8gaXRzIHBhcmVudCB7QGxpbmsgU2NyZWVuQ29tcG9uZW50fS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzW119XG4gICAgICovXG4gICAgZ2V0IHNjcmVlbkNvcm5lcnMoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29ybmVyc0RpcnR5IHx8ICF0aGlzLnNjcmVlbilcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zY3JlZW5Db3JuZXJzO1xuXG4gICAgICAgIGNvbnN0IHBhcmVudEJvdHRvbUxlZnQgPSB0aGlzLmVudGl0eS5wYXJlbnQgJiYgdGhpcy5lbnRpdHkucGFyZW50LmVsZW1lbnQgJiYgdGhpcy5lbnRpdHkucGFyZW50LmVsZW1lbnQuc2NyZWVuQ29ybmVyc1swXTtcblxuICAgICAgICAvLyBpbml0IGNvcm5lcnNcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVyc1swXS5zZXQodGhpcy5fYWJzTGVmdCwgdGhpcy5fYWJzQm90dG9tLCAwKTtcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVyc1sxXS5zZXQodGhpcy5fYWJzUmlnaHQsIHRoaXMuX2Fic0JvdHRvbSwgMCk7XG4gICAgICAgIHRoaXMuX3NjcmVlbkNvcm5lcnNbMl0uc2V0KHRoaXMuX2Fic1JpZ2h0LCB0aGlzLl9hYnNUb3AsIDApO1xuICAgICAgICB0aGlzLl9zY3JlZW5Db3JuZXJzWzNdLnNldCh0aGlzLl9hYnNMZWZ0LCB0aGlzLl9hYnNUb3AsIDApO1xuXG4gICAgICAgIC8vIHRyYW5zZm9ybSBjb3JuZXJzIHRvIHNjcmVlbiBzcGFjZVxuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IHRoaXMuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX3NjcmVlblRyYW5zZm9ybS50cmFuc2Zvcm1Qb2ludCh0aGlzLl9zY3JlZW5Db3JuZXJzW2ldLCB0aGlzLl9zY3JlZW5Db3JuZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChzY3JlZW5TcGFjZSlcbiAgICAgICAgICAgICAgICB0aGlzLl9zY3JlZW5Db3JuZXJzW2ldLm11bFNjYWxhcih0aGlzLnNjcmVlbi5zY3JlZW4uc2NhbGUpO1xuXG4gICAgICAgICAgICBpZiAocGFyZW50Qm90dG9tTGVmdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NjcmVlbkNvcm5lcnNbaV0uYWRkKHBhcmVudEJvdHRvbUxlZnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY29ybmVyc0RpcnR5ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fc2NyZWVuQ29ybmVycztcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgdGV4dCByZW5kZXJlZCBieSB0aGUgY29tcG9uZW50LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB0ZXh0V2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0ID8gdGhpcy5fdGV4dC53aWR0aCA6IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgdGV4dCByZW5kZXJlZCBieSB0aGUgY29tcG9uZW50LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB0ZXh0SGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dCA/IHRoaXMuX3RleHQuaGVpZ2h0IDogMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdG9wIGVkZ2Ugb2YgdGhlIGFuY2hvci4gQ2FuIGJlIHVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBhIHNwbGl0IGFuY2hvclxuICAgICAqIHRvIG1ha2UgdGhlIGNvbXBvbmVudCdzIGJvdHRvbSBlZGdlIGFsd2F5cyBiZSAnYm90dG9tJyB1bml0cyBhd2F5IGZyb20gdGhlIGJvdHRvbS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHRvcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4udyA9IHZhbHVlO1xuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3YiA9IHRoaXMuX2Fic0JvdHRvbTtcbiAgICAgICAgY29uc3Qgd3QgPSB0aGlzLl9sb2NhbEFuY2hvci53IC0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3NldEhlaWdodCh3dCAtIHdiKTtcblxuICAgICAgICBwLnkgPSAodGhpcy5fbG9jYWxBbmNob3IudyAtIHRoaXMuX2xvY2FsQW5jaG9yLnkpIC0gdmFsdWUgLSB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0ICogKDEgLSB0aGlzLl9waXZvdC55KTtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcbiAgICB9XG5cbiAgICBnZXQgdG9wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFyZ2luLnc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIEVsZW1lbnRDb21wb25lbnQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEVMRU1FTlRUWVBFX0dST1VQfTogVGhlIGNvbXBvbmVudCBjYW4gYmUgdXNlZCBhcyBhIGxheW91dCBtZWNoYW5pc20gdG8gY3JlYXRlIGdyb3VwcyBvZlxuICAgICAqIEVsZW1lbnRDb21wb25lbnRzIGUuZy4gcGFuZWxzLlxuICAgICAqIC0ge0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfTogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhbiBpbWFnZVxuICAgICAqIC0ge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9OiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIHRleHRcbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IEVMRU1FTlRUWVBFX0lNQUdFKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2UgPSBuZXcgSW1hZ2VFbGVtZW50KHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gRUxFTUVOVFRZUEVfVEVYVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSBuZXcgVGV4dEVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGVuIHRoZSBjb21wb25lbnQgd2lsbCByZWNlaXZlIE1vdXNlIG9yIFRvdWNoIGlucHV0IGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCB1c2VJbnB1dCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdXNlSW5wdXQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3VzZUlucHV0ID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LmFkZEVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LnJlbW92ZUVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fdXNlSW5wdXQgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdFbGVtZW50cyB3aWxsIG5vdCBnZXQgYW55IGlucHV0IGV2ZW50cyBiZWNhdXNlIHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQgaXMgbm90IGNyZWF0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnVzZUlucHV0JywgdmFsdWUpO1xuICAgIH1cblxuICAgIGdldCB1c2VJbnB1dCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VzZUlucHV0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBob3cgdGhlIGNvbnRlbnQgc2hvdWxkIGJlIGZpdHRlZCBhbmQgcHJlc2VydmUgdGhlIGFzcGVjdCByYXRpbyBvZiB0aGUgc291cmNlIHRleHR1cmUgb3Igc3ByaXRlLlxuICAgICAqIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJVE1PREVfU1RSRVRDSH06IEZpdCB0aGUgY29udGVudCBleGFjdGx5IHRvIEVsZW1lbnQncyBib3VuZGluZyBib3guXG4gICAgICogLSB7QGxpbmsgRklUTU9ERV9DT05UQUlOfTogRml0IHRoZSBjb250ZW50IHdpdGhpbiB0aGUgRWxlbWVudCdzIGJvdW5kaW5nIGJveCB3aGlsZSBwcmVzZXJ2aW5nIGl0cyBBc3BlY3QgUmF0aW8uXG4gICAgICogLSB7QGxpbmsgRklUTU9ERV9DT1ZFUn06IEZpdCB0aGUgY29udGVudCB0byBjb3ZlciB0aGUgZW50aXJlIEVsZW1lbnQncyBib3VuZGluZyBib3ggd2hpbGUgcHJlc2VydmluZyBpdHMgQXNwZWN0IFJhdGlvLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzZXQgZml0TW9kZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9maXRNb2RlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNpemUodHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgdGhpcy5faW1hZ2UucmVmcmVzaE1lc2goKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmaXRNb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZml0TW9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIGVsZW1lbnQgYXMgc2V0IGluIHRoZSBlZGl0b3IuIE5vdGUgdGhhdCBpbiBzb21lIGNhc2VzIHRoaXMgbWF5IG5vdCByZWZsZWN0XG4gICAgICogdGhlIHRydWUgd2lkdGggYXQgd2hpY2ggdGhlIGVsZW1lbnQgaXMgcmVuZGVyZWQsIHN1Y2ggYXMgd2hlbiB0aGUgZWxlbWVudCBpcyB1bmRlciB0aGVcbiAgICAgKiBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gU2VlIGBjYWxjdWxhdGVkV2lkdGhgIGluIG9yZGVyIHRvIGVuc3VyZSB5b3UgYXJlXG4gICAgICogcmVhZGluZyB0aGUgdHJ1ZSB3aWR0aCBhdCB3aGljaCB0aGUgZWxlbWVudCB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgd2lkdGgodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB2YWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMuX2hhc1NwbGl0QW5jaG9yc1gpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRXaWR0aCh2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDp3aWR0aCcsIHRoaXMuX3dpZHRoKTtcbiAgICB9XG5cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiA0IHtAbGluayBWZWMzfXMgdGhhdCByZXByZXNlbnQgdGhlIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCBhbmQgdG9wXG4gICAgICogbGVmdCBjb3JuZXJzIG9mIHRoZSBjb21wb25lbnQgaW4gd29ybGQgc3BhY2UuIE9ubHkgd29ya3MgZm9yIDNEIGVsZW1lbnQgY29tcG9uZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzW119XG4gICAgICovXG4gICAgZ2V0IHdvcmxkQ29ybmVycygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl93b3JsZENvcm5lcnNEaXJ0eSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dvcmxkQ29ybmVycztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgY29uc3Qgc2NyZWVuQ29ybmVycyA9IHRoaXMuc2NyZWVuQ29ybmVycztcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgICAgICBtYXRBLmNvcHkodGhpcy5zY3JlZW4uc2NyZWVuLl9zY3JlZW5NYXRyaXgpO1xuXG4gICAgICAgICAgICAgICAgLy8gZmxpcCBzY3JlZW4gbWF0cml4IGFsb25nIHRoZSBob3Jpem9udGFsIGF4aXNcbiAgICAgICAgICAgICAgICBtYXRBLmRhdGFbMTNdID0gLW1hdEEuZGF0YVsxM107XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdHJhbnNmb3JtIHRoYXQgYnJpbmdzIHNjcmVlbiBjb3JuZXJzIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICAgICAgbWF0QS5tdWwyKHRoaXMuc2NyZWVuLmdldFdvcmxkVHJhbnNmb3JtKCksIG1hdEEpO1xuXG4gICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIHNjcmVlbiBjb3JuZXJzIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0QS50cmFuc2Zvcm1Qb2ludChzY3JlZW5Db3JuZXJzW2ldLCB0aGlzLl93b3JsZENvcm5lcnNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGxvY2FsUG9zID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuXG4gICAgICAgICAgICAvLyByb3RhdGUgYW5kIHNjYWxlIGFyb3VuZCBwaXZvdFxuICAgICAgICAgICAgbWF0QS5zZXRUcmFuc2xhdGUoLWxvY2FsUG9zLngsIC1sb2NhbFBvcy55LCAtbG9jYWxQb3Mueik7XG4gICAgICAgICAgICBtYXRCLnNldFRSUyhWZWMzLlpFUk8sIHRoaXMuZW50aXR5LmdldExvY2FsUm90YXRpb24oKSwgdGhpcy5lbnRpdHkuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgIG1hdEMuc2V0VHJhbnNsYXRlKGxvY2FsUG9zLngsIGxvY2FsUG9zLnksIGxvY2FsUG9zLnopO1xuXG4gICAgICAgICAgICAvLyBnZXQgcGFyZW50IHdvcmxkIHRyYW5zZm9ybSAoYnV0IHVzZSB0aGlzIGVudGl0eSBpZiB0aGVyZSBpcyBubyBwYXJlbnQpXG4gICAgICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eS5wYXJlbnQgPyB0aGlzLmVudGl0eS5wYXJlbnQgOiB0aGlzLmVudGl0eTtcbiAgICAgICAgICAgIG1hdEQuY29weShlbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG4gICAgICAgICAgICBtYXRELm11bChtYXRDKS5tdWwobWF0QikubXVsKG1hdEEpO1xuXG4gICAgICAgICAgICAvLyBib3R0b20gbGVmdFxuICAgICAgICAgICAgdmVjQS5zZXQobG9jYWxQb3MueCAtIHRoaXMucGl2b3QueCAqIHRoaXMuY2FsY3VsYXRlZFdpZHRoLCBsb2NhbFBvcy55IC0gdGhpcy5waXZvdC55ICogdGhpcy5jYWxjdWxhdGVkSGVpZ2h0LCBsb2NhbFBvcy56KTtcbiAgICAgICAgICAgIG1hdEQudHJhbnNmb3JtUG9pbnQodmVjQSwgdGhpcy5fd29ybGRDb3JuZXJzWzBdKTtcblxuICAgICAgICAgICAgLy8gYm90dG9tIHJpZ2h0XG4gICAgICAgICAgICB2ZWNBLnNldChsb2NhbFBvcy54ICsgKDEgLSB0aGlzLnBpdm90LngpICogdGhpcy5jYWxjdWxhdGVkV2lkdGgsIGxvY2FsUG9zLnkgLSB0aGlzLnBpdm90LnkgKiB0aGlzLmNhbGN1bGF0ZWRIZWlnaHQsIGxvY2FsUG9zLnopO1xuICAgICAgICAgICAgbWF0RC50cmFuc2Zvcm1Qb2ludCh2ZWNBLCB0aGlzLl93b3JsZENvcm5lcnNbMV0pO1xuXG4gICAgICAgICAgICAvLyB0b3AgcmlnaHRcbiAgICAgICAgICAgIHZlY0Euc2V0KGxvY2FsUG9zLnggKyAoMSAtIHRoaXMucGl2b3QueCkgKiB0aGlzLmNhbGN1bGF0ZWRXaWR0aCwgbG9jYWxQb3MueSArICgxIC0gdGhpcy5waXZvdC55KSAqIHRoaXMuY2FsY3VsYXRlZEhlaWdodCwgbG9jYWxQb3Mueik7XG4gICAgICAgICAgICBtYXRELnRyYW5zZm9ybVBvaW50KHZlY0EsIHRoaXMuX3dvcmxkQ29ybmVyc1syXSk7XG5cbiAgICAgICAgICAgIC8vIHRvcCBsZWZ0XG4gICAgICAgICAgICB2ZWNBLnNldChsb2NhbFBvcy54IC0gdGhpcy5waXZvdC54ICogdGhpcy5jYWxjdWxhdGVkV2lkdGgsIGxvY2FsUG9zLnkgKyAoMSAtIHRoaXMucGl2b3QueSkgKiB0aGlzLmNhbGN1bGF0ZWRIZWlnaHQsIGxvY2FsUG9zLnopO1xuICAgICAgICAgICAgbWF0RC50cmFuc2Zvcm1Qb2ludCh2ZWNBLCB0aGlzLl93b3JsZENvcm5lcnNbM10pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fd29ybGRDb3JuZXJzRGlydHkgPSBmYWxzZTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fd29ybGRDb3JuZXJzO1xuXG4gICAgfVxuXG4gICAgX3BhdGNoKCkge1xuICAgICAgICB0aGlzLmVudGl0eS5fc3luYyA9IHRoaXMuX3N5bmM7XG4gICAgICAgIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uID0gdGhpcy5fc2V0UG9zaXRpb247XG4gICAgICAgIHRoaXMuZW50aXR5LnNldExvY2FsUG9zaXRpb24gPSB0aGlzLl9zZXRMb2NhbFBvc2l0aW9uO1xuICAgIH1cblxuICAgIF91bnBhdGNoKCkge1xuICAgICAgICB0aGlzLmVudGl0eS5fc3luYyA9IEVudGl0eS5wcm90b3R5cGUuX3N5bmM7XG4gICAgICAgIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uID0gRW50aXR5LnByb3RvdHlwZS5zZXRQb3NpdGlvbjtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbiA9IEVudGl0eS5wcm90b3R5cGUuc2V0TG9jYWxQb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXRjaGVkIG1ldGhvZCBmb3Igc2V0dGluZyB0aGUgcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxWZWMzfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvciBWZWMzXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgeiBjb29yZGluYXRlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0UG9zaXRpb24oeCwgeSwgeikge1xuICAgICAgICBpZiAoIXRoaXMuZWxlbWVudC5zY3JlZW4pIHtcbiAgICAgICAgICAgIEVudGl0eS5wcm90b3R5cGUuc2V0UG9zaXRpb24uY2FsbCh0aGlzLCB4LCB5LCB6KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKTsgLy8gZW5zdXJlIGhpZXJhcmNoeSBpcyB1cCB0byBkYXRlXG4gICAgICAgIGludlBhcmVudFd0bS5jb3B5KHRoaXMuZWxlbWVudC5fc2NyZWVuVG9Xb3JsZCkuaW52ZXJ0KCk7XG4gICAgICAgIGludlBhcmVudFd0bS50cmFuc2Zvcm1Qb2ludChwb3NpdGlvbiwgdGhpcy5sb2NhbFBvc2l0aW9uKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXRjaGVkIG1ldGhvZCBmb3Igc2V0dGluZyB0aGUgbG9jYWwgcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxWZWMzfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvciBWZWMzXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgeiBjb29yZGluYXRlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0TG9jYWxQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIG1hcmdpblxuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50O1xuICAgICAgICBjb25zdCBwID0gdGhpcy5sb2NhbFBvc2l0aW9uO1xuICAgICAgICBjb25zdCBwdnQgPSBlbGVtZW50Ll9waXZvdDtcbiAgICAgICAgZWxlbWVudC5fbWFyZ2luLnggPSBwLnggLSBlbGVtZW50Ll9jYWxjdWxhdGVkV2lkdGggKiBwdnQueDtcbiAgICAgICAgZWxlbWVudC5fbWFyZ2luLnogPSAoZWxlbWVudC5fbG9jYWxBbmNob3IueiAtIGVsZW1lbnQuX2xvY2FsQW5jaG9yLngpIC0gZWxlbWVudC5fY2FsY3VsYXRlZFdpZHRoIC0gZWxlbWVudC5fbWFyZ2luLng7XG4gICAgICAgIGVsZW1lbnQuX21hcmdpbi55ID0gcC55IC0gZWxlbWVudC5fY2FsY3VsYXRlZEhlaWdodCAqIHB2dC55O1xuICAgICAgICBlbGVtZW50Ll9tYXJnaW4udyA9IChlbGVtZW50Ll9sb2NhbEFuY2hvci53IC0gZWxlbWVudC5fbG9jYWxBbmNob3IueSkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0IC0gZWxlbWVudC5fbWFyZ2luLnk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLy8gdGhpcyBtZXRob2Qgb3ZlcndyaXRlcyBHcmFwaE5vZGUjc3luYyBhbmQgc28gb3BlcmF0ZXMgaW4gc2NvcGUgb2YgdGhlIEVudGl0eS5cbiAgICBfc3luYygpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZWxlbWVudDtcbiAgICAgICAgY29uc3Qgc2NyZWVuID0gZWxlbWVudC5zY3JlZW47XG5cbiAgICAgICAgaWYgKHNjcmVlbikge1xuXG4gICAgICAgICAgICBpZiAoZWxlbWVudC5fYW5jaG9yRGlydHkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzeCA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IHJlc3kgPSAwO1xuICAgICAgICAgICAgICAgIGxldCBweCA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IHB5ID0gMTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9wYXJlbnQgJiYgdGhpcy5fcGFyZW50LmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNlIHBhcmVudCByZWN0XG4gICAgICAgICAgICAgICAgICAgIHJlc3ggPSB0aGlzLl9wYXJlbnQuZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIHJlc3kgPSB0aGlzLl9wYXJlbnQuZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBweCA9IHRoaXMuX3BhcmVudC5lbGVtZW50LnBpdm90Lng7XG4gICAgICAgICAgICAgICAgICAgIHB5ID0gdGhpcy5fcGFyZW50LmVsZW1lbnQucGl2b3QueTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyB1c2Ugc2NyZWVuIHJlY3RcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IHNjcmVlbi5zY3JlZW4ucmVzb2x1dGlvbjtcbiAgICAgICAgICAgICAgICAgICAgcmVzeCA9IHJlc29sdXRpb24ueCAvIHNjcmVlbi5zY3JlZW4uc2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIHJlc3kgPSByZXNvbHV0aW9uLnkgLyBzY3JlZW4uc2NyZWVuLnNjYWxlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2FuY2hvclRyYW5zZm9ybS5zZXRUcmFuc2xhdGUoKHJlc3ggKiAoZWxlbWVudC5hbmNob3IueCAtIHB4KSksIC0ocmVzeSAqIChweSAtIGVsZW1lbnQuYW5jaG9yLnkpKSwgMCk7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5fYW5jaG9yRGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBlbGVtZW50Ll9jYWxjdWxhdGVMb2NhbEFuY2hvcnMoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgZWxlbWVudCBzaXplIGlzIGRpcnR5XG4gICAgICAgICAgICAvLyByZWNhbGN1bGF0ZSBpdHMgc2l6ZVxuICAgICAgICAgICAgLy8gV0FSTklORzogT3JkZXIgaXMgaW1wb3J0YW50IGFzIGNhbGN1bGF0ZVNpemUgcmVzZXRzIGRpcnR5TG9jYWxcbiAgICAgICAgICAgIC8vIHNvIHRoaXMgbmVlZHMgdG8gcnVuIGJlZm9yZSByZXNldHRpbmcgZGlydHlMb2NhbCB0byBmYWxzZSBiZWxvd1xuICAgICAgICAgICAgaWYgKGVsZW1lbnQuX3NpemVEaXJ0eSkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2NhbGN1bGF0ZVNpemUoZmFsc2UsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLmxvY2FsUG9zaXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbiwgdGhpcy5sb2NhbFNjYWxlKTtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIG1hcmdpblxuICAgICAgICAgICAgY29uc3QgcCA9IHRoaXMubG9jYWxQb3NpdGlvbjtcbiAgICAgICAgICAgIGNvbnN0IHB2dCA9IGVsZW1lbnQuX3Bpdm90O1xuICAgICAgICAgICAgZWxlbWVudC5fbWFyZ2luLnggPSBwLnggLSBlbGVtZW50Ll9jYWxjdWxhdGVkV2lkdGggKiBwdnQueDtcbiAgICAgICAgICAgIGVsZW1lbnQuX21hcmdpbi56ID0gKGVsZW1lbnQuX2xvY2FsQW5jaG9yLnogLSBlbGVtZW50Ll9sb2NhbEFuY2hvci54KSAtIGVsZW1lbnQuX2NhbGN1bGF0ZWRXaWR0aCAtIGVsZW1lbnQuX21hcmdpbi54O1xuICAgICAgICAgICAgZWxlbWVudC5fbWFyZ2luLnkgPSBwLnkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0ICogcHZ0Lnk7XG4gICAgICAgICAgICBlbGVtZW50Ll9tYXJnaW4udyA9IChlbGVtZW50Ll9sb2NhbEFuY2hvci53IC0gZWxlbWVudC5fbG9jYWxBbmNob3IueSkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0IC0gZWxlbWVudC5fbWFyZ2luLnk7XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2NyZWVuKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5fY2FudmFzQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBlbGVtZW50Ll93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBFbnRpdHkucHJvdG90eXBlLl9zeW5jLmNhbGwodGhpcyk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5jb3B5KHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB0cmFuc2Zvcm0gZWxlbWVudCBoaWVyYXJjaHlcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fcGFyZW50LmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5fc2NyZWVuVG9Xb3JsZC5tdWwyKHRoaXMuX3BhcmVudC5lbGVtZW50Ll9tb2RlbFRyYW5zZm9ybSwgZWxlbWVudC5fYW5jaG9yVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkLmNvcHkoZWxlbWVudC5fYW5jaG9yVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlbGVtZW50Ll9tb2RlbFRyYW5zZm9ybS5tdWwyKGVsZW1lbnQuX3NjcmVlblRvV29ybGQsIHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjcmVlbikge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkLm11bDIoc2NyZWVuLnNjcmVlbi5fc2NyZWVuTWF0cml4LCBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX3NjcmVlblRvV29ybGQubXVsMihzY3JlZW4ud29ybGRUcmFuc2Zvcm0sIGVsZW1lbnQuX3NjcmVlblRvV29ybGQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5tdWwyKGVsZW1lbnQuX3NjcmVlblRvV29ybGQsIHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBwYXJlbnQgd29ybGQgdHJhbnNmb3JtXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudFdvcmxkVHJhbnNmb3JtID0gZWxlbWVudC5fcGFyZW50V29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFdvcmxkVHJhbnNmb3JtLnNldElkZW50aXR5KCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX3BhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudCAmJiBwYXJlbnQuZWxlbWVudCAmJiBwYXJlbnQgIT09IHNjcmVlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0QS5zZXRUUlMoVmVjMy5aRVJPLCBwYXJlbnQuZ2V0TG9jYWxSb3RhdGlvbigpLCBwYXJlbnQuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFdvcmxkVHJhbnNmb3JtLm11bDIocGFyZW50LmVsZW1lbnQuX3BhcmVudFdvcmxkVHJhbnNmb3JtLCBtYXRBKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBlbGVtZW50IHRyYW5zZm9ybVxuICAgICAgICAgICAgICAgICAgICAvLyByb3RhdGUgYW5kIHNjYWxlIGFyb3VuZCBwaXZvdFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXB0aE9mZnNldCA9IHZlY0E7XG4gICAgICAgICAgICAgICAgICAgIGRlcHRoT2Zmc2V0LnNldCgwLCAwLCB0aGlzLmxvY2FsUG9zaXRpb24ueik7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGl2b3RPZmZzZXQgPSB2ZWNCO1xuICAgICAgICAgICAgICAgICAgICBwaXZvdE9mZnNldC5zZXQoZWxlbWVudC5fYWJzTGVmdCArIGVsZW1lbnQuX3Bpdm90LnggKiBlbGVtZW50LmNhbGN1bGF0ZWRXaWR0aCwgZWxlbWVudC5fYWJzQm90dG9tICsgZWxlbWVudC5fcGl2b3QueSAqIGVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodCwgMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgbWF0QS5zZXRUcmFuc2xhdGUoLXBpdm90T2Zmc2V0LngsIC1waXZvdE9mZnNldC55LCAtcGl2b3RPZmZzZXQueik7XG4gICAgICAgICAgICAgICAgICAgIG1hdEIuc2V0VFJTKGRlcHRoT2Zmc2V0LCB0aGlzLmdldExvY2FsUm90YXRpb24oKSwgdGhpcy5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgICAgICAgICBtYXRDLnNldFRyYW5zbGF0ZShwaXZvdE9mZnNldC54LCBwaXZvdE9mZnNldC55LCBwaXZvdE9mZnNldC56KTtcblxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5UcmFuc2Zvcm0ubXVsMihlbGVtZW50Ll9wYXJlbnRXb3JsZFRyYW5zZm9ybSwgbWF0QykubXVsKG1hdEIpLm11bChtYXRBKTtcblxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9jb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9jYW52YXNDb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5jb3B5KGVsZW1lbnQuX21vZGVsVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkluc2VydChwYXJlbnQpIHtcbiAgICAgICAgLy8gd2hlbiB0aGUgZW50aXR5IGlzIHJlcGFyZW50ZWQgZmluZCBhIHBvc3NpYmxlIG5ldyBzY3JlZW4gYW5kIG1hc2tcblxuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9wYXJzZVVwVG9TY3JlZW4oKTtcblxuICAgICAgICB0aGlzLmVudGl0eS5fZGlydGlmeVdvcmxkKCk7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlU2NyZWVuKHJlc3VsdC5zY3JlZW4pO1xuXG4gICAgICAgIHRoaXMuX2RpcnRpZnlNYXNrKCk7XG4gICAgfVxuXG4gICAgX2RpcnRpZnlNYXNrKCkge1xuICAgICAgICBsZXQgY3VycmVudCA9IHRoaXMuZW50aXR5O1xuICAgICAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgICAgICAgLy8gc2VhcmNoIHVwIHRoZSBoaWVyYXJjaHkgdW50aWwgd2UgZmluZCBhbiBlbnRpdHkgd2hpY2ggaGFzOlxuICAgICAgICAgICAgLy8gLSBubyBwYXJlbnRcbiAgICAgICAgICAgIC8vIC0gc2NyZWVuIGNvbXBvbmVudCBvbiBwYXJlbnRcbiAgICAgICAgICAgIGNvbnN0IG5leHQgPSBjdXJyZW50LnBhcmVudDtcbiAgICAgICAgICAgIGlmICgobmV4dCA9PT0gbnVsbCB8fCBuZXh0LnNjcmVlbikgJiYgY3VycmVudC5lbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLnN5c3RlbS5fcHJlcmVuZGVyIHx8ICF0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyID0gW107XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5vbmNlKCdwcmVyZW5kZXInLCB0aGlzLl9vblByZXJlbmRlciwgdGhpcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykgY29uc29sZS5sb2coJ3JlZ2lzdGVyIHByZXJlbmRlcicpO1xuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgaSA9IHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIuaW5kZXhPZih0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICAgICAgaWYgKGkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgaiA9IHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIuaW5kZXhPZihjdXJyZW50KTtcbiAgICAgICAgICAgICAgICBpZiAoaiA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3ByZXJlbmRlci5wdXNoKGN1cnJlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIGNvbnNvbGUubG9nKCdzZXQgcHJlcmVuZGVyIHJvb3QgdG86ICcgKyBjdXJyZW50Lm5hbWUpO1xuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjdXJyZW50ID0gbmV4dDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblByZXJlbmRlcigpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYXNrID0gdGhpcy5zeXN0ZW0uX3ByZXJlbmRlcltpXTtcbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIGlmIChfZGVidWdMb2dnaW5nKSBjb25zb2xlLmxvZygncHJlcmVuZGVyIGZyb206ICcgKyBtYXNrLm5hbWUpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIC8vIHByZXZlbnQgY2FsbCBpZiBlbGVtZW50IGhhcyBiZWVuIHJlbW92ZWQgc2luY2UgYmVpbmcgYWRkZWRcbiAgICAgICAgICAgIGlmIChtYXNrLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXB0aCA9IDE7XG4gICAgICAgICAgICAgICAgbWFzay5lbGVtZW50LnN5bmNNYXNrKGRlcHRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICBfYmluZFNjcmVlbihzY3JlZW4pIHtcbiAgICAgICAgLy8gQmluZCB0aGUgRWxlbWVudCB0byB0aGUgU2NyZWVuLiBXZSB1c2VkIHRvIHN1YnNjcmliZSB0byBTY3JlZW4gZXZlbnRzIGhlcmUuIEhvd2V2ZXIsXG4gICAgICAgIC8vIHRoYXQgd2FzIHZlcnkgc2xvdyB3aGVuIHRoZXJlIGFyZSB0aG91c2FuZHMgb2YgRWxlbWVudHMuIFdoZW4gdGhlIHRpbWUgY29tZXMgdG8gdW5iaW5kXG4gICAgICAgIC8vIHRoZSBFbGVtZW50IGZyb20gdGhlIFNjcmVlbiwgZmluZGluZyB0aGUgZXZlbnQgY2FsbGJhY2tzIHRvIHJlbW92ZSB0YWtlcyBhIGNvbnNpZGVyYWJsZVxuICAgICAgICAvLyBhbW91bnQgb2YgdGltZS4gU28gaW5zdGVhZCwgdGhlIFNjcmVlbiBzdG9yZXMgdGhlIEVsZW1lbnQgY29tcG9uZW50IGFuZCBjYWxscyBpdHNcbiAgICAgICAgLy8gZnVuY3Rpb25zIGRpcmVjdGx5LlxuICAgICAgICBzY3JlZW4uX2JpbmRFbGVtZW50KHRoaXMpO1xuICAgIH1cblxuICAgIF91bmJpbmRTY3JlZW4oc2NyZWVuKSB7XG4gICAgICAgIHNjcmVlbi5fdW5iaW5kRWxlbWVudCh0aGlzKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlU2NyZWVuKHNjcmVlbikge1xuICAgICAgICBpZiAodGhpcy5zY3JlZW4gJiYgdGhpcy5zY3JlZW4gIT09IHNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fdW5iaW5kU2NyZWVuKHRoaXMuc2NyZWVuLnNjcmVlbik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcmV2aW91c1NjcmVlbiA9IHRoaXMuc2NyZWVuO1xuICAgICAgICB0aGlzLnNjcmVlbiA9IHNjcmVlbjtcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl9iaW5kU2NyZWVuKHRoaXMuc2NyZWVuLnNjcmVlbik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTaXplKHRoaXMuX2hhc1NwbGl0QW5jaG9yc1gsIHRoaXMuX2hhc1NwbGl0QW5jaG9yc1kpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnNjcmVlbicsIHRoaXMuc2NyZWVuLCBwcmV2aW91c1NjcmVlbik7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBhbGwgY2hpbGQgc2NyZWVuc1xuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuZW50aXR5LmNoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldLmVsZW1lbnQpIGNoaWxkcmVuW2ldLmVsZW1lbnQuX3VwZGF0ZVNjcmVlbihzY3JlZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIGRyYXcgb3JkZXJcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB0aGlzLnNjcmVlbi5zY3JlZW4uc3luY0RyYXdPcmRlcigpO1xuICAgIH1cblxuICAgIHN5bmNNYXNrKGRlcHRoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX3BhcnNlVXBUb1NjcmVlbigpO1xuICAgICAgICB0aGlzLl91cGRhdGVNYXNrKHJlc3VsdC5tYXNrLCBkZXB0aCk7XG4gICAgfVxuXG4gICAgLy8gc2V0IHRoZSBtYXNrZWRieSBwcm9wZXJ0eSB0byB0aGUgZW50aXR5IHRoYXQgaXMgbWFza2luZyB0aGlzIGVsZW1lbnRcbiAgICAvLyAtIHNldCB0aGUgc3RlbmNpbCBidWZmZXIgdG8gY2hlY2sgdGhlIG1hc2sgdmFsdWVcbiAgICAvLyAgIHNvIGFzIHRvIG9ubHkgcmVuZGVyIGluc2lkZSB0aGUgbWFza1xuICAgIC8vICAgTm90ZTogaWYgdGhpcyBlbnRpdHkgaXMgaXRzZWxmIGEgbWFzayB0aGUgc3RlbmNpbCBwYXJhbXNcbiAgICAvLyAgIHdpbGwgYmUgdXBkYXRlZCBpbiB1cGRhdGVNYXNrIHRvIGluY2x1ZGUgbWFza2luZ1xuICAgIF9zZXRNYXNrZWRCeShtYXNrKSB7XG4gICAgICAgIGNvbnN0IHJlbmRlcmFibGVFbGVtZW50ID0gdGhpcy5faW1hZ2UgfHwgdGhpcy5fdGV4dDtcblxuICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgY29uc3QgcmVmID0gbWFzay5lbGVtZW50Ll9pbWFnZS5fbWFza1JlZjtcbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIGlmIChfZGVidWdMb2dnaW5nKSBjb25zb2xlLmxvZygnbWFza2luZzogJyArIHRoaXMuZW50aXR5Lm5hbWUgKyAnIHdpdGggJyArIHJlZik7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgY29uc3Qgc3AgPSBuZXcgU3RlbmNpbFBhcmFtZXRlcnMoe1xuICAgICAgICAgICAgICAgIHJlZjogcmVmLFxuICAgICAgICAgICAgICAgIGZ1bmM6IEZVTkNfRVFVQUxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGltYWdlIG9yIHRleHQsIHNldCB0aGUgc3RlbmNpbCBwYXJhbWV0ZXJzXG4gICAgICAgICAgICBpZiAocmVuZGVyYWJsZUVsZW1lbnQgJiYgcmVuZGVyYWJsZUVsZW1lbnQuX3NldFN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJhYmxlRWxlbWVudC5fc2V0U3RlbmNpbChzcCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX21hc2tlZEJ5ID0gbWFzaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIGlmIChfZGVidWdMb2dnaW5nKSBjb25zb2xlLmxvZygnbm8gbWFza2luZyBvbjogJyArIHRoaXMuZW50aXR5Lm5hbWUpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBzdGVuY2lsIHBhcmFtcyBpZiB0aGlzIGlzIGltYWdlIG9yIHRleHRcbiAgICAgICAgICAgIGlmIChyZW5kZXJhYmxlRWxlbWVudCAmJiByZW5kZXJhYmxlRWxlbWVudC5fc2V0U3RlbmNpbCkge1xuICAgICAgICAgICAgICAgIHJlbmRlcmFibGVFbGVtZW50Ll9zZXRTdGVuY2lsKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbWFza2VkQnkgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVjdXJzaXZlbHkgdXBkYXRlIGVudGl0eSdzIHN0ZW5jaWwgcGFyYW1zXG4gICAgLy8gdG8gcmVuZGVyIHRoZSBjb3JyZWN0IHZhbHVlIGludG8gdGhlIHN0ZW5jaWwgYnVmZmVyXG4gICAgX3VwZGF0ZU1hc2soY3VycmVudE1hc2ssIGRlcHRoKSB7XG4gICAgICAgIGlmIChjdXJyZW50TWFzaykge1xuICAgICAgICAgICAgdGhpcy5fc2V0TWFza2VkQnkoY3VycmVudE1hc2spO1xuXG4gICAgICAgICAgICAvLyB0aGlzIGVsZW1lbnQgaXMgYWxzbyBtYXNraW5nIG90aGVyc1xuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZiA9IGN1cnJlbnRNYXNrLmVsZW1lbnQuX2ltYWdlLl9tYXNrUmVmO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNwID0gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgcmVmOiByZWYsXG4gICAgICAgICAgICAgICAgICAgIGZ1bmM6IEZVTkNfRVFVQUwsXG4gICAgICAgICAgICAgICAgICAgIHpwYXNzOiBTVEVOQ0lMT1BfSU5DUkVNRU5UXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2UuX3NldFN0ZW5jaWwoc3ApO1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlLl9tYXNrUmVmID0gZGVwdGg7XG5cbiAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgY291bnRlciB0byBjb3VudCBtYXNrIGRlcHRoXG4gICAgICAgICAgICAgICAgZGVwdGgrKztcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnbWFza2luZyBmcm9tOiAnICsgdGhpcy5lbnRpdHkubmFtZSArICcgd2l0aCAnICsgKHNwLnJlZiArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2RlcHRoKysgdG86ICcsIGRlcHRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBjdXJyZW50TWFzayA9IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZWN1cnNlIHRocm91Z2ggYWxsIGNoaWxkcmVuXG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuZW50aXR5LmNoaWxkcmVuO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW5baV0uZWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbltpXS5lbGVtZW50Ll91cGRhdGVNYXNrKGN1cnJlbnRNYXNrLCBkZXB0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiBtYXNrIGNvdW50ZXIgd2FzIGluY3JlYXNlZCwgZGVjcmVtZW50IGl0IGFzIHdlIGNvbWUgYmFjayB1cCB0aGUgaGllcmFyY2h5XG4gICAgICAgICAgICBpZiAodGhpcy5tYXNrKSBkZXB0aC0tO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGVhcmluZyBtYXNrXG4gICAgICAgICAgICB0aGlzLl9zZXRNYXNrZWRCeShudWxsKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNwID0gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgcmVmOiBkZXB0aCxcbiAgICAgICAgICAgICAgICAgICAgZnVuYzogRlVOQ19BTFdBWVMsXG4gICAgICAgICAgICAgICAgICAgIHpwYXNzOiBTVEVOQ0lMT1BfUkVQTEFDRVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlLl9zZXRTdGVuY2lsKHNwKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZS5fbWFza1JlZiA9IGRlcHRoO1xuXG4gICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG1hc2sgY291bnRlciB0byBjb3VudCBkZXB0aCBvZiBtYXNrc1xuICAgICAgICAgICAgICAgIGRlcHRoKys7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ21hc2tpbmcgZnJvbTogJyArIHRoaXMuZW50aXR5Lm5hbWUgKyAnIHdpdGggJyArIHNwLnJlZik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdkZXB0aCsrIHRvOiAnLCBkZXB0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgY3VycmVudE1hc2sgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVjdXJzZSB0aHJvdWdoIGFsbCBjaGlsZHJlblxuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLmVudGl0eS5jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW5baV0uZWxlbWVudC5fdXBkYXRlTWFzayhjdXJyZW50TWFzaywgZGVwdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZGVjcmVtZW50IG1hc2sgY291bnRlciBhcyB3ZSBjb21lIGJhY2sgdXAgdGhlIGhpZXJhcmNoeVxuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykgZGVwdGgtLTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNlYXJjaCB1cCB0aGUgcGFyZW50IGhpZXJhcmNoeSB1bnRpbCB3ZSByZWFjaCBhIHNjcmVlblxuICAgIC8vIHRoaXMgc2NyZWVuIGlzIHRoZSBwYXJlbnQgc2NyZWVuXG4gICAgLy8gYWxzbyBzZWFyY2hlcyBmb3IgbWFza2VkIGVsZW1lbnRzIHRvIGdldCB0aGUgcmVsZXZhbnQgbWFza1xuICAgIF9wYXJzZVVwVG9TY3JlZW4oKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgIHNjcmVlbjogbnVsbCxcbiAgICAgICAgICAgIG1hc2s6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICBsZXQgcGFyZW50ID0gdGhpcy5lbnRpdHkuX3BhcmVudDtcblxuICAgICAgICB3aGlsZSAocGFyZW50ICYmICFwYXJlbnQuc2NyZWVuKSB7XG4gICAgICAgICAgICBpZiAocGFyZW50LmVsZW1lbnQgJiYgcGFyZW50LmVsZW1lbnQubWFzaykge1xuICAgICAgICAgICAgICAgIC8vIG1hc2sgZW50aXR5XG4gICAgICAgICAgICAgICAgaWYgKCFyZXN1bHQubWFzaykgcmVzdWx0Lm1hc2sgPSBwYXJlbnQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcmVudCAmJiBwYXJlbnQuc2NyZWVuKSByZXN1bHQuc2NyZWVuID0gcGFyZW50O1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgX29uU2NyZWVuUmVzaXplKHJlcykge1xuICAgICAgICB0aGlzLl9hbmNob3JEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTaXplKHRoaXMuX2hhc1NwbGl0QW5jaG9yc1gsIHRoaXMuX2hhc1NwbGl0QW5jaG9yc1kpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc2NyZWVuOnNldDpyZXNvbHV0aW9uJywgcmVzKTtcbiAgICB9XG5cbiAgICBfb25TY3JlZW5TcGFjZUNoYW5nZSgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdzY3JlZW46c2V0OnNjcmVlbnNwYWNlJywgdGhpcy5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlKTtcbiAgICB9XG5cbiAgICBfb25TY3JlZW5SZW1vdmUoKSB7XG4gICAgICAgIGlmICh0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NyZWVuLl9kZXN0cm95aW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHNjcmVlbiBlbnRpdHkgaXMgYmVpbmcgZGVzdHJveWVkLCB3ZSBkb24ndCBjYWxsXG4gICAgICAgICAgICAgICAgLy8gX3VwZGF0ZVNjcmVlbigpIGFzIGFuIG9wdGltaXphdGlvbiBidXQgd2Ugc2hvdWxkIHN0aWxsXG4gICAgICAgICAgICAgICAgLy8gc2V0IGl0IHRvIG51bGwgdG8gY2xlYW4gdXAgZGFuZ2xpbmcgcmVmZXJlbmNlc1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlU2NyZWVuKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc3RvcmUgcGl4ZWwgcG9zaXRpb25zIG9mIGFuY2hvciByZWxhdGl2ZSB0byBjdXJyZW50IHBhcmVudCByZXNvbHV0aW9uXG4gICAgX2NhbGN1bGF0ZUxvY2FsQW5jaG9ycygpIHtcbiAgICAgICAgbGV0IHJlc3ggPSAxMDAwO1xuICAgICAgICBsZXQgcmVzeSA9IDEwMDA7XG4gICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuZW50aXR5Ll9wYXJlbnQ7XG4gICAgICAgIGlmIChwYXJlbnQgJiYgcGFyZW50LmVsZW1lbnQpIHtcbiAgICAgICAgICAgIHJlc3ggPSBwYXJlbnQuZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgICAgICByZXN5ID0gcGFyZW50LmVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodDtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gdGhpcy5zY3JlZW4uc2NyZWVuLnJlc29sdXRpb247XG4gICAgICAgICAgICBjb25zdCBzY2FsZSA9IHRoaXMuc2NyZWVuLnNjcmVlbi5zY2FsZTtcbiAgICAgICAgICAgIHJlc3ggPSByZXMueCAvIHNjYWxlO1xuICAgICAgICAgICAgcmVzeSA9IHJlcy55IC8gc2NhbGU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2NhbEFuY2hvci5zZXQoXG4gICAgICAgICAgICB0aGlzLl9hbmNob3IueCAqIHJlc3gsXG4gICAgICAgICAgICB0aGlzLl9hbmNob3IueSAqIHJlc3ksXG4gICAgICAgICAgICB0aGlzLl9hbmNob3IueiAqIHJlc3gsXG4gICAgICAgICAgICB0aGlzLl9hbmNob3IudyAqIHJlc3lcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBpbnRlcm5hbCAtIGFwcGx5IG9mZnNldCB4LHkgdG8gbG9jYWwgcG9zaXRpb24gYW5kIGZpbmQgcG9pbnQgaW4gd29ybGQgc3BhY2VcbiAgICBnZXRPZmZzZXRQb3NpdGlvbih4LCB5KSB7XG4gICAgICAgIGNvbnN0IHAgPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCkuY2xvbmUoKTtcblxuICAgICAgICBwLnggKz0geDtcbiAgICAgICAgcC55ICs9IHk7XG5cbiAgICAgICAgdGhpcy5fc2NyZWVuVG9Xb3JsZC50cmFuc2Zvcm1Qb2ludChwLCBwKTtcblxuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG5cbiAgICBvbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnModGhpcy5faW1hZ2UgPyB0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCA6IHRoaXMuX3RleHQuX21vZGVsKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90ZXh0KSB7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMuX3RleHQuX21vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25MYXllclJlbW92ZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5faW1hZ2UpIHtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5faW1hZ2UuX3JlbmRlcmFibGUubW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdGV4dCkge1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLl90ZXh0Ll9tb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBpZiAodGhpcy5faW1hZ2UpIHRoaXMuX2ltYWdlLm9uRW5hYmxlKCk7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0KSB0aGlzLl90ZXh0Lm9uRW5hYmxlKCk7XG4gICAgICAgIGlmICh0aGlzLl9ncm91cCkgdGhpcy5fZ3JvdXAub25FbmFibGUoKTtcblxuICAgICAgICBpZiAodGhpcy51c2VJbnB1dCAmJiB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LmFkZEVsZW1lbnQodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUub24oJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLkVMRU1FTlQsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ2VuYWJsZWVsZW1lbnQnKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSB0aGlzLl9pbWFnZS5vbkRpc2FibGUoKTtcbiAgICAgICAgaWYgKHRoaXMuX3RleHQpIHRoaXMuX3RleHQub25EaXNhYmxlKCk7XG4gICAgICAgIGlmICh0aGlzLl9ncm91cCkgdGhpcy5fZ3JvdXAub25EaXNhYmxlKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQgJiYgdGhpcy51c2VJbnB1dCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dC5yZW1vdmVFbGVtZW50KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuRUxFTUVOVCwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnZGlzYWJsZWVsZW1lbnQnKTtcbiAgICB9XG5cbiAgICBvblJlbW92ZSgpIHtcbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdpbnNlcnQnLCB0aGlzLl9vbkluc2VydCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3VucGF0Y2goKTtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSB0aGlzLl9pbWFnZS5kZXN0cm95KCk7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0KSB0aGlzLl90ZXh0LmRlc3Ryb3koKTtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dCAmJiB0aGlzLnVzZUlucHV0KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LnJlbW92ZUVsZW1lbnQodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGVyZSBpcyBhIHNjcmVlbiwgdXBkYXRlIGRyYXctb3JkZXJcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuICYmIHRoaXMuc2NyZWVuLnNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fdW5iaW5kU2NyZWVuKHRoaXMuc2NyZWVuLnNjcmVlbik7XG4gICAgICAgICAgICB0aGlzLnNjcmVlbi5zY3JlZW4uc3luY0RyYXdPcmRlcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWNhbGN1bGF0ZXMgdGhlc2UgcHJvcGVydGllczpcbiAgICAgKiAgIC0gYF9sb2NhbEFuY2hvcmBcbiAgICAgKiAgIC0gYHdpZHRoYFxuICAgICAqICAgLSBgaGVpZ2h0YFxuICAgICAqICAgLSBMb2NhbCBwb3NpdGlvbiBpcyB1cGRhdGVkIGlmIGFuY2hvcnMgYXJlIHNwbGl0XG4gICAgICpcbiAgICAgKiBBc3N1bWVzIHRoZXNlIHByb3BlcnRpZXMgYXJlIHVwIHRvIGRhdGU6XG4gICAgICogICAtIGBfbWFyZ2luYFxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBwcm9wYWdhdGVDYWxjdWxhdGVkV2lkdGggLSBJZiB0cnVlLCBjYWxsIGBfc2V0V2lkdGhgIGluc3RlYWRcbiAgICAgKiBvZiBgX3NldENhbGN1bGF0ZWRXaWR0aGBcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByb3BhZ2F0ZUNhbGN1bGF0ZWRIZWlnaHQgLSBJZiB0cnVlLCBjYWxsIGBfc2V0SGVpZ2h0YCBpbnN0ZWFkXG4gICAgICogb2YgYF9zZXRDYWxjdWxhdGVkSGVpZ2h0YFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NhbGN1bGF0ZVNpemUocHJvcGFnYXRlQ2FsY3VsYXRlZFdpZHRoLCBwcm9wYWdhdGVDYWxjdWxhdGVkSGVpZ2h0KSB7XG4gICAgICAgIC8vIGNhbid0IGNhbGN1bGF0ZSBpZiBsb2NhbCBhbmNob3JzIGFyZSB3cm9uZ1xuICAgICAgICBpZiAoIXRoaXMuZW50aXR5Ll9wYXJlbnQgJiYgIXRoaXMuc2NyZWVuKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlTG9jYWxBbmNob3JzKCk7XG5cbiAgICAgICAgY29uc3QgbmV3V2lkdGggPSB0aGlzLl9hYnNSaWdodCAtIHRoaXMuX2Fic0xlZnQ7XG4gICAgICAgIGNvbnN0IG5ld0hlaWdodCA9IHRoaXMuX2Fic1RvcCAtIHRoaXMuX2Fic0JvdHRvbTtcblxuICAgICAgICBpZiAocHJvcGFnYXRlQ2FsY3VsYXRlZFdpZHRoKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRXaWR0aChuZXdXaWR0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRDYWxjdWxhdGVkV2lkdGgobmV3V2lkdGgsIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcm9wYWdhdGVDYWxjdWxhdGVkSGVpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRIZWlnaHQobmV3SGVpZ2h0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRIZWlnaHQobmV3SGVpZ2h0LCBmYWxzZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBwLnggPSB0aGlzLl9tYXJnaW4ueCArIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCAqIHRoaXMuX3Bpdm90Lng7XG4gICAgICAgIHAueSA9IHRoaXMuX21hcmdpbi55ICsgdGhpcy5fY2FsY3VsYXRlZEhlaWdodCAqIHRoaXMuX3Bpdm90Lnk7XG5cbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcblxuICAgICAgICB0aGlzLl9zaXplRGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBzZXQgd2lkdGggd2l0aG91dCB1cGRhdGluZyBtYXJnaW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSBuZXcgd2lkdGguXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0V2lkdGgodykge1xuICAgICAgICB0aGlzLl93aWR0aCA9IHc7XG4gICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRXaWR0aCh3LCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6d2lkdGgnLCB0aGlzLl93aWR0aCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgc2V0IGhlaWdodCB3aXRob3V0IHVwZGF0aW5nIG1hcmdpbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIG5ldyBoZWlnaHQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0SGVpZ2h0KGgpIHtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gaDtcbiAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZEhlaWdodChoLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6aGVpZ2h0JywgdGhpcy5faGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIG1ldGhvZCBzZXRzIHRoZSBjYWxjdWxhdGVkIHdpZHRoIHZhbHVlIGFuZCBvcHRpb25hbGx5IHVwZGF0ZXMgdGhlIG1hcmdpbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBUaGUgbmV3IGNhbGN1bGF0ZWQgd2lkdGguXG4gICAgICogQHBhcmFtIHtib29sZWFufSB1cGRhdGVNYXJnaW5zIC0gVXBkYXRlIG1hcmdpbnMgb3Igbm90LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldENhbGN1bGF0ZWRXaWR0aCh2YWx1ZSwgdXBkYXRlTWFyZ2lucykge1xuICAgICAgICBpZiAoTWF0aC5hYnModmFsdWUgLSB0aGlzLl9jYWxjdWxhdGVkV2lkdGgpIDw9IDFlLTQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlZFdpZHRoID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZW50aXR5Ll9kaXJ0aWZ5TG9jYWwoKTtcblxuICAgICAgICBpZiAodXBkYXRlTWFyZ2lucykge1xuICAgICAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHB2dCA9IHRoaXMuX3Bpdm90O1xuICAgICAgICAgICAgdGhpcy5fbWFyZ2luLnggPSBwLnggLSB0aGlzLl9jYWxjdWxhdGVkV2lkdGggKiBwdnQueDtcbiAgICAgICAgICAgIHRoaXMuX21hcmdpbi56ID0gKHRoaXMuX2xvY2FsQW5jaG9yLnogLSB0aGlzLl9sb2NhbEFuY2hvci54KSAtIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCAtIHRoaXMuX21hcmdpbi54O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZmxhZ0NoaWxkcmVuQXNEaXJ0eSgpO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDpjYWxjdWxhdGVkV2lkdGgnLCB0aGlzLl9jYWxjdWxhdGVkV2lkdGgpO1xuICAgICAgICB0aGlzLmZpcmUoJ3Jlc2l6ZScsIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCwgdGhpcy5fY2FsY3VsYXRlZEhlaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2Qgc2V0cyB0aGUgY2FsY3VsYXRlZCBoZWlnaHQgdmFsdWUgYW5kIG9wdGlvbmFsbHkgdXBkYXRlcyB0aGUgbWFyZ2lucy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBuZXcgY2FsY3VsYXRlZCBoZWlnaHQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB1cGRhdGVNYXJnaW5zIC0gVXBkYXRlIG1hcmdpbnMgb3Igbm90LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldENhbGN1bGF0ZWRIZWlnaHQodmFsdWUsIHVwZGF0ZU1hcmdpbnMpIHtcbiAgICAgICAgaWYgKE1hdGguYWJzKHZhbHVlIC0gdGhpcy5fY2FsY3VsYXRlZEhlaWdodCkgPD0gMWUtNClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZW50aXR5Ll9kaXJ0aWZ5TG9jYWwoKTtcblxuICAgICAgICBpZiAodXBkYXRlTWFyZ2lucykge1xuICAgICAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHB2dCA9IHRoaXMuX3Bpdm90O1xuICAgICAgICAgICAgdGhpcy5fbWFyZ2luLnkgPSBwLnkgLSB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0ICogcHZ0Lnk7XG4gICAgICAgICAgICB0aGlzLl9tYXJnaW4udyA9ICh0aGlzLl9sb2NhbEFuY2hvci53IC0gdGhpcy5fbG9jYWxBbmNob3IueSkgLSB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0IC0gdGhpcy5fbWFyZ2luLnk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9mbGFnQ2hpbGRyZW5Bc0RpcnR5KCk7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OmNhbGN1bGF0ZWRIZWlnaHQnLCB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0KTtcbiAgICAgICAgdGhpcy5maXJlKCdyZXNpemUnLCB0aGlzLl9jYWxjdWxhdGVkV2lkdGgsIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQpO1xuICAgIH1cblxuICAgIF9mbGFnQ2hpbGRyZW5Bc0RpcnR5KCkge1xuICAgICAgICBjb25zdCBjID0gdGhpcy5lbnRpdHkuX2NoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY1tpXS5lbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgY1tpXS5lbGVtZW50Ll9hbmNob3JEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgY1tpXS5lbGVtZW50Ll9zaXplRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkTW9kZWxUb0xheWVycyhtb2RlbCkge1xuICAgICAgICB0aGlzLl9hZGRlZE1vZGVscy5wdXNoKG1vZGVsKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVNb2RlbEZyb21MYXllcnMobW9kZWwpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5fYWRkZWRNb2RlbHMuaW5kZXhPZihtb2RlbCk7XG4gICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5fYWRkZWRNb2RlbHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRNYXNrT2Zmc2V0KCkge1xuICAgICAgICAvLyByZXNldCBvZmZzZXQgb24gbmV3IGZyYW1lXG4gICAgICAgIC8vIHdlIGFsd2F5cyBjb3VudCBvZmZzZXQgZG93biBmcm9tIDAuNVxuICAgICAgICBjb25zdCBmcmFtZSA9IHRoaXMuc3lzdGVtLmFwcC5mcmFtZTtcbiAgICAgICAgaWYgKHRoaXMuX29mZnNldFJlYWRBdCAhPT0gZnJhbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX21hc2tPZmZzZXQgPSAwLjU7XG4gICAgICAgICAgICB0aGlzLl9vZmZzZXRSZWFkQXQgPSBmcmFtZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtbyA9IHRoaXMuX21hc2tPZmZzZXQ7XG4gICAgICAgIHRoaXMuX21hc2tPZmZzZXQgLT0gMC4wMDE7XG4gICAgICAgIHJldHVybiBtbztcbiAgICB9XG5cbiAgICBpc1Zpc2libGVGb3JDYW1lcmEoY2FtZXJhKSB7XG4gICAgICAgIGxldCBjbGlwTCwgY2xpcFIsIGNsaXBULCBjbGlwQjtcblxuICAgICAgICBpZiAodGhpcy5tYXNrZWRCeSkge1xuICAgICAgICAgICAgY29uc3QgY29ybmVycyA9IHRoaXMubWFza2VkQnkuZWxlbWVudC5zY3JlZW5Db3JuZXJzO1xuXG4gICAgICAgICAgICBjbGlwTCA9IE1hdGgubWluKE1hdGgubWluKGNvcm5lcnNbMF0ueCwgY29ybmVyc1sxXS54KSwgTWF0aC5taW4oY29ybmVyc1syXS54LCBjb3JuZXJzWzNdLngpKTtcbiAgICAgICAgICAgIGNsaXBSID0gTWF0aC5tYXgoTWF0aC5tYXgoY29ybmVyc1swXS54LCBjb3JuZXJzWzFdLngpLCBNYXRoLm1heChjb3JuZXJzWzJdLngsIGNvcm5lcnNbM10ueCkpO1xuICAgICAgICAgICAgY2xpcEIgPSBNYXRoLm1pbihNYXRoLm1pbihjb3JuZXJzWzBdLnksIGNvcm5lcnNbMV0ueSksIE1hdGgubWluKGNvcm5lcnNbMl0ueSwgY29ybmVyc1szXS55KSk7XG4gICAgICAgICAgICBjbGlwVCA9IE1hdGgubWF4KE1hdGgubWF4KGNvcm5lcnNbMF0ueSwgY29ybmVyc1sxXS55KSwgTWF0aC5tYXgoY29ybmVyc1syXS55LCBjb3JuZXJzWzNdLnkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHN3ID0gdGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLndpZHRoO1xuICAgICAgICAgICAgY29uc3Qgc2ggPSB0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2UuaGVpZ2h0O1xuXG4gICAgICAgICAgICBjb25zdCBjYW1lcmFXaWR0aCA9IGNhbWVyYS5fcmVjdC56ICogc3c7XG4gICAgICAgICAgICBjb25zdCBjYW1lcmFIZWlnaHQgPSBjYW1lcmEuX3JlY3QudyAqIHNoO1xuICAgICAgICAgICAgY2xpcEwgPSBjYW1lcmEuX3JlY3QueCAqIHN3O1xuICAgICAgICAgICAgY2xpcFIgPSBjbGlwTCArIGNhbWVyYVdpZHRoO1xuICAgICAgICAgICAgY2xpcFQgPSAoMSAtIGNhbWVyYS5fcmVjdC55KSAqIHNoO1xuICAgICAgICAgICAgY2xpcEIgPSBjbGlwVCAtIGNhbWVyYUhlaWdodDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGhpdENvcm5lcnMgPSB0aGlzLnNjcmVlbkNvcm5lcnM7XG5cbiAgICAgICAgY29uc3QgbGVmdCA9IE1hdGgubWluKE1hdGgubWluKGhpdENvcm5lcnNbMF0ueCwgaGl0Q29ybmVyc1sxXS54KSwgTWF0aC5taW4oaGl0Q29ybmVyc1syXS54LCBoaXRDb3JuZXJzWzNdLngpKTtcbiAgICAgICAgY29uc3QgcmlnaHQgPSBNYXRoLm1heChNYXRoLm1heChoaXRDb3JuZXJzWzBdLngsIGhpdENvcm5lcnNbMV0ueCksIE1hdGgubWF4KGhpdENvcm5lcnNbMl0ueCwgaGl0Q29ybmVyc1szXS54KSk7XG4gICAgICAgIGNvbnN0IGJvdHRvbSA9IE1hdGgubWluKE1hdGgubWluKGhpdENvcm5lcnNbMF0ueSwgaGl0Q29ybmVyc1sxXS55KSwgTWF0aC5taW4oaGl0Q29ybmVyc1syXS55LCBoaXRDb3JuZXJzWzNdLnkpKTtcbiAgICAgICAgY29uc3QgdG9wID0gTWF0aC5tYXgoTWF0aC5tYXgoaGl0Q29ybmVyc1swXS55LCBoaXRDb3JuZXJzWzFdLnkpLCBNYXRoLm1heChoaXRDb3JuZXJzWzJdLnksIGhpdENvcm5lcnNbM10ueSkpO1xuXG4gICAgICAgIGlmIChyaWdodCA8IGNsaXBMIHx8XG4gICAgICAgICAgICBsZWZ0ID4gY2xpcFIgfHxcbiAgICAgICAgICAgIGJvdHRvbSA+IGNsaXBUIHx8XG4gICAgICAgICAgICB0b3AgPCBjbGlwQikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgX2lzU2NyZWVuU3BhY2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnNjcmVlbiAmJiB0aGlzLnNjcmVlbi5zY3JlZW4pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2lzU2NyZWVuQ3VsbGVkKCkge1xuICAgICAgICBpZiAodGhpcy5zY3JlZW4gJiYgdGhpcy5zY3JlZW4uc2NyZWVuKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zY3JlZW4uc2NyZWVuLmN1bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2RpcnR5QmF0Y2goKSB7XG4gICAgICAgIGlmICh0aGlzLmJhdGNoR3JvdXBJZCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5tYXJrR3JvdXBEaXJ0eSh0aGlzLmJhdGNoR3JvdXBJZCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmUobmFtZSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShFbGVtZW50Q29tcG9uZW50LnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3RleHRbbmFtZV07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2ltYWdlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2ltYWdlW25hbWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0W25hbWVdICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUJhdGNoKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dFtuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZVtuYW1lXSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGlydHlCYXRjaCgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlW25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuX2RlZmluZSgnZm9udFNpemUnKTtcbl9kZWZpbmUoJ21pbkZvbnRTaXplJyk7XG5fZGVmaW5lKCdtYXhGb250U2l6ZScpO1xuX2RlZmluZSgnbWF4TGluZXMnKTtcbl9kZWZpbmUoJ2F1dG9GaXRXaWR0aCcpO1xuX2RlZmluZSgnYXV0b0ZpdEhlaWdodCcpO1xuX2RlZmluZSgnY29sb3InKTtcbl9kZWZpbmUoJ2ZvbnQnKTtcbl9kZWZpbmUoJ2ZvbnRBc3NldCcpO1xuX2RlZmluZSgnc3BhY2luZycpO1xuX2RlZmluZSgnbGluZUhlaWdodCcpO1xuX2RlZmluZSgnd3JhcExpbmVzJyk7XG5fZGVmaW5lKCdsaW5lcycpO1xuX2RlZmluZSgnYWxpZ25tZW50Jyk7XG5fZGVmaW5lKCdhdXRvV2lkdGgnKTtcbl9kZWZpbmUoJ2F1dG9IZWlnaHQnKTtcbl9kZWZpbmUoJ3J0bFJlb3JkZXInKTtcbl9kZWZpbmUoJ3VuaWNvZGVDb252ZXJ0ZXInKTtcbl9kZWZpbmUoJ3RleHQnKTtcbl9kZWZpbmUoJ2tleScpO1xuX2RlZmluZSgndGV4dHVyZScpO1xuX2RlZmluZSgndGV4dHVyZUFzc2V0Jyk7XG5fZGVmaW5lKCdtYXRlcmlhbCcpO1xuX2RlZmluZSgnbWF0ZXJpYWxBc3NldCcpO1xuX2RlZmluZSgnc3ByaXRlJyk7XG5fZGVmaW5lKCdzcHJpdGVBc3NldCcpO1xuX2RlZmluZSgnc3ByaXRlRnJhbWUnKTtcbl9kZWZpbmUoJ3BpeGVsc1BlclVuaXQnKTtcbl9kZWZpbmUoJ29wYWNpdHknKTtcbl9kZWZpbmUoJ3JlY3QnKTtcbl9kZWZpbmUoJ21hc2snKTtcbl9kZWZpbmUoJ291dGxpbmVDb2xvcicpO1xuX2RlZmluZSgnb3V0bGluZVRoaWNrbmVzcycpO1xuX2RlZmluZSgnc2hhZG93Q29sb3InKTtcbl9kZWZpbmUoJ3NoYWRvd09mZnNldCcpO1xuX2RlZmluZSgnZW5hYmxlTWFya3VwJyk7XG5fZGVmaW5lKCdyYW5nZVN0YXJ0Jyk7XG5fZGVmaW5lKCdyYW5nZUVuZCcpO1xuXG5leHBvcnQgeyBFbGVtZW50Q29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsicG9zaXRpb24iLCJWZWMzIiwiaW52UGFyZW50V3RtIiwiTWF0NCIsInZlY0EiLCJ2ZWNCIiwibWF0QSIsIm1hdEIiLCJtYXRDIiwibWF0RCIsIkVsZW1lbnRDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl9iZWluZ0luaXRpYWxpemVkIiwiX2FuY2hvciIsIlZlYzQiLCJfbG9jYWxBbmNob3IiLCJfcGl2b3QiLCJWZWMyIiwiX3dpZHRoIiwiX2NhbGN1bGF0ZWRXaWR0aCIsIl9oZWlnaHQiLCJfY2FsY3VsYXRlZEhlaWdodCIsIl9tYXJnaW4iLCJfbW9kZWxUcmFuc2Zvcm0iLCJfc2NyZWVuVG9Xb3JsZCIsIl9hbmNob3JUcmFuc2Zvcm0iLCJfYW5jaG9yRGlydHkiLCJfcGFyZW50V29ybGRUcmFuc2Zvcm0iLCJfc2NyZWVuVHJhbnNmb3JtIiwiX3NjcmVlbkNvcm5lcnMiLCJfY2FudmFzQ29ybmVycyIsIl93b3JsZENvcm5lcnMiLCJfY29ybmVyc0RpcnR5IiwiX2NhbnZhc0Nvcm5lcnNEaXJ0eSIsIl93b3JsZENvcm5lcnNEaXJ0eSIsIm9uIiwiX29uSW5zZXJ0IiwiX3BhdGNoIiwic2NyZWVuIiwiX3R5cGUiLCJFTEVNRU5UVFlQRV9HUk9VUCIsIl9pbWFnZSIsIl90ZXh0IiwiX2dyb3VwIiwiX2RyYXdPcmRlciIsIl9maXRNb2RlIiwiRklUTU9ERV9TVFJFVENIIiwiX3VzZUlucHV0IiwiX2xheWVycyIsIkxBWUVSSURfVUkiLCJfYWRkZWRNb2RlbHMiLCJfYmF0Y2hHcm91cElkIiwiX2JhdGNoR3JvdXAiLCJfb2Zmc2V0UmVhZEF0IiwiX21hc2tPZmZzZXQiLCJfbWFza2VkQnkiLCJfYWJzTGVmdCIsIngiLCJfYWJzUmlnaHQiLCJ6IiwiX2Fic1RvcCIsInciLCJfYWJzQm90dG9tIiwieSIsIl9oYXNTcGxpdEFuY2hvcnNYIiwiTWF0aCIsImFicyIsIl9oYXNTcGxpdEFuY2hvcnNZIiwiYWFiYiIsImFuY2hvciIsInZhbHVlIiwiY29weSIsInNldCIsIl9wYXJlbnQiLCJfY2FsY3VsYXRlTG9jYWxBbmNob3JzIiwiX2NhbGN1bGF0ZVNpemUiLCJfZGlydHlMb2NhbCIsIl9kaXJ0aWZ5TG9jYWwiLCJmaXJlIiwiYmF0Y2hHcm91cElkIiwiZW5hYmxlZCIsImFwcCIsImJhdGNoZXIiLCJyZW1vdmUiLCJCYXRjaEdyb3VwIiwiRUxFTUVOVCIsImluc2VydCIsIl9yZW5kZXJhYmxlIiwibW9kZWwiLCJhZGRNb2RlbFRvTGF5ZXJzIiwiX21vZGVsIiwiYm90dG9tIiwicCIsImdldExvY2FsUG9zaXRpb24iLCJ3dCIsIndiIiwiX3NldEhlaWdodCIsInNldExvY2FsUG9zaXRpb24iLCJjYWxjdWxhdGVkV2lkdGgiLCJfc2V0Q2FsY3VsYXRlZFdpZHRoIiwiY2FsY3VsYXRlZEhlaWdodCIsIl9zZXRDYWxjdWxhdGVkSGVpZ2h0IiwiY2FudmFzQ29ybmVycyIsInNjcmVlblNwYWNlIiwiZGV2aWNlIiwiZ3JhcGhpY3NEZXZpY2UiLCJzY3JlZW5Db3JuZXJzIiwic3giLCJjYW52YXMiLCJjbGllbnRXaWR0aCIsIndpZHRoIiwic3kiLCJjbGllbnRIZWlnaHQiLCJoZWlnaHQiLCJpIiwiZHJhd09yZGVyIiwicHJpb3JpdHkiLCJEZWJ1ZyIsIndhcm4iLCJsYXllcnMiLCJsZW5ndGgiLCJsYXllciIsInNjZW5lIiwiZ2V0TGF5ZXJCeUlkIiwiaiIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJtZXNoSW5zdGFuY2VzIiwiYWRkTWVzaEluc3RhbmNlcyIsImxlZnQiLCJ3ciIsIndsIiwiX3NldFdpZHRoIiwibWFyZ2luIiwibWFza2VkQnkiLCJwaXZvdCIsInByZXZYIiwicHJldlkiLCJteCIsImR4IiwibXkiLCJkeSIsIl9mbGFnQ2hpbGRyZW5Bc0RpcnR5IiwicmlnaHQiLCJwYXJlbnRCb3R0b21MZWZ0IiwicGFyZW50IiwiZWxlbWVudCIsInRyYW5zZm9ybVBvaW50IiwibXVsU2NhbGFyIiwic2NhbGUiLCJhZGQiLCJ0ZXh0V2lkdGgiLCJ0ZXh0SGVpZ2h0IiwidG9wIiwidHlwZSIsImRlc3Ryb3kiLCJFTEVNRU5UVFlQRV9JTUFHRSIsIkltYWdlRWxlbWVudCIsIkVMRU1FTlRUWVBFX1RFWFQiLCJUZXh0RWxlbWVudCIsInVzZUlucHV0IiwiZWxlbWVudElucHV0IiwiYWRkRWxlbWVudCIsInJlbW92ZUVsZW1lbnQiLCJmaXRNb2RlIiwicmVmcmVzaE1lc2giLCJ3b3JsZENvcm5lcnMiLCJfc2NyZWVuTWF0cml4IiwiZGF0YSIsIm11bDIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImxvY2FsUG9zIiwic2V0VHJhbnNsYXRlIiwic2V0VFJTIiwiWkVSTyIsImdldExvY2FsUm90YXRpb24iLCJnZXRMb2NhbFNjYWxlIiwibXVsIiwiX3N5bmMiLCJzZXRQb3NpdGlvbiIsIl9zZXRQb3NpdGlvbiIsIl9zZXRMb2NhbFBvc2l0aW9uIiwiX3VucGF0Y2giLCJFbnRpdHkiLCJwcm90b3R5cGUiLCJjYWxsIiwiaW52ZXJ0IiwibG9jYWxQb3NpdGlvbiIsInB2dCIsInJlc3giLCJyZXN5IiwicHgiLCJweSIsInJlc29sdXRpb24iLCJfc2l6ZURpcnR5IiwibG9jYWxUcmFuc2Zvcm0iLCJsb2NhbFJvdGF0aW9uIiwibG9jYWxTY2FsZSIsIl9kaXJ0eVdvcmxkIiwid29ybGRUcmFuc2Zvcm0iLCJwYXJlbnRXb3JsZFRyYW5zZm9ybSIsInNldElkZW50aXR5IiwiZGVwdGhPZmZzZXQiLCJwaXZvdE9mZnNldCIsInJlc3VsdCIsIl9wYXJzZVVwVG9TY3JlZW4iLCJfZGlydGlmeVdvcmxkIiwiX3VwZGF0ZVNjcmVlbiIsIl9kaXJ0aWZ5TWFzayIsImN1cnJlbnQiLCJuZXh0IiwiX3ByZXJlbmRlciIsIm9uY2UiLCJfb25QcmVyZW5kZXIiLCJpbmRleE9mIiwic3BsaWNlIiwicHVzaCIsIm1hc2siLCJkZXB0aCIsInN5bmNNYXNrIiwiX2JpbmRTY3JlZW4iLCJfYmluZEVsZW1lbnQiLCJfdW5iaW5kU2NyZWVuIiwiX3VuYmluZEVsZW1lbnQiLCJwcmV2aW91c1NjcmVlbiIsImNoaWxkcmVuIiwibCIsInN5bmNEcmF3T3JkZXIiLCJfdXBkYXRlTWFzayIsIl9zZXRNYXNrZWRCeSIsInJlbmRlcmFibGVFbGVtZW50IiwicmVmIiwiX21hc2tSZWYiLCJzcCIsIlN0ZW5jaWxQYXJhbWV0ZXJzIiwiZnVuYyIsIkZVTkNfRVFVQUwiLCJfc2V0U3RlbmNpbCIsImN1cnJlbnRNYXNrIiwienBhc3MiLCJTVEVOQ0lMT1BfSU5DUkVNRU5UIiwiRlVOQ19BTFdBWVMiLCJTVEVOQ0lMT1BfUkVQTEFDRSIsIl9vblNjcmVlblJlc2l6ZSIsInJlcyIsIl9vblNjcmVlblNwYWNlQ2hhbmdlIiwiX29uU2NyZWVuUmVtb3ZlIiwiX2Rlc3Ryb3lpbmciLCJnZXRPZmZzZXRQb3NpdGlvbiIsImNsb25lIiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvZmYiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsImluZGV4IiwiaWQiLCJvbkVuYWJsZSIsIm9uRGlzYWJsZSIsIm9uUmVtb3ZlIiwicHJvcGFnYXRlQ2FsY3VsYXRlZFdpZHRoIiwicHJvcGFnYXRlQ2FsY3VsYXRlZEhlaWdodCIsIm5ld1dpZHRoIiwibmV3SGVpZ2h0IiwiaCIsInVwZGF0ZU1hcmdpbnMiLCJjIiwiX2NoaWxkcmVuIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwiaWR4IiwiZ2V0TWFza09mZnNldCIsImZyYW1lIiwibW8iLCJpc1Zpc2libGVGb3JDYW1lcmEiLCJjYW1lcmEiLCJjbGlwTCIsImNsaXBSIiwiY2xpcFQiLCJjbGlwQiIsImNvcm5lcnMiLCJtaW4iLCJtYXgiLCJzdyIsInNoIiwiY2FtZXJhV2lkdGgiLCJfcmVjdCIsImNhbWVyYUhlaWdodCIsImhpdENvcm5lcnMiLCJfaXNTY3JlZW5TcGFjZSIsIl9pc1NjcmVlbkN1bGxlZCIsImN1bGwiLCJfZGlydHlCYXRjaCIsIm1hcmtHcm91cERpcnR5IiwiX2RlZmluZSIsIm5hbWUiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF5QkEsTUFBTUEsUUFBUSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzNCLE1BQU1DLFlBQVksR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUUvQixNQUFNQyxJQUFJLEdBQUcsSUFBSUgsSUFBSSxFQUFFLENBQUE7QUFDdkIsTUFBTUksSUFBSSxHQUFHLElBQUlKLElBQUksRUFBRSxDQUFBO0FBQ3ZCLE1BQU1LLElBQUksR0FBRyxJQUFJSCxJQUFJLEVBQUUsQ0FBQTtBQUN2QixNQUFNSSxJQUFJLEdBQUcsSUFBSUosSUFBSSxFQUFFLENBQUE7QUFDdkIsTUFBTUssSUFBSSxHQUFHLElBQUlMLElBQUksRUFBRSxDQUFBO0FBQ3ZCLE1BQU1NLElBQUksR0FBRyxJQUFJTixJQUFJLEVBQUUsQ0FBQTs7QUFFdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0Es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
