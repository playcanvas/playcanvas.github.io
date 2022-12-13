/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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

class ElementComponent extends Component {
  constructor(system, entity) {
    super(system, entity);

    this._beingInitialized = false;
    this._anchor = new Vec4();
    this._localAnchor = new Vec4();
    this._pivot = new Vec2();
    this._width = this._calculatedWidth = 32;
    this._height = this._calculatedHeight = 32;
    this._margin = new Vec4(0, 0, -32, -32);

    this._modelTransform = new Mat4();
    this._screenToWorld = new Mat4();

    this._anchorTransform = new Mat4();
    this._anchorDirty = true;

    this._parentWorldTransform = new Mat4();
    this._screenTransform = new Mat4();

    this._screenCorners = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];

    this._canvasCorners = [new Vec2(), new Vec2(), new Vec2(), new Vec2()];

    this._worldCorners = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];
    this._cornersDirty = true;
    this._canvasCornersDirty = true;
    this._worldCornersDirty = true;
    this.entity.on('insert', this._onInsert, this);
    this._patch();

    this.screen = null;
    this._type = ELEMENTTYPE_GROUP;

    this._image = null;
    this._text = null;
    this._group = null;
    this._drawOrder = 0;

    this._fitMode = FITMODE_STRETCH;

    this._useInput = false;
    this._layers = [LAYERID_UI];
    this._addedModels = [];

    this._batchGroupId = -1;
    this._batchGroup = null;

    this._offsetReadAt = 0;
    this._maskOffset = 0.5;
    this._maskedBy = null;
  }

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

  set calculatedWidth(value) {
    this._setCalculatedWidth(value, true);
  }
  get calculatedWidth() {
    return this._calculatedWidth;
  }

  set calculatedHeight(value) {
    this._setCalculatedHeight(value, true);
  }
  get calculatedHeight() {
    return this._calculatedHeight;
  }

  get canvasCorners() {
    if (!this._canvasCornersDirty || !this.screen || !this.screen.screen.screenSpace) return this._canvasCorners;
    const device = this.system.app.graphicsDevice;
    const screenCorners = this.screenCorners;
    const sx = device.canvas.clientWidth / device.width;
    const sy = device.canvas.clientHeight / device.height;

    for (let i = 0; i < 4; i++) {
      this._canvasCorners[i].set(screenCorners[i].x * sx, (device.height - screenCorners[i].y) * sy);
    }
    this._canvasCornersDirty = false;
    return this._canvasCorners;
  }

  set drawOrder(value) {
    let priority = 0;
    if (this.screen) {
      priority = this.screen.screen.priority;
    }
    if (value > 0xFFFFFF) {
      Debug.warn('Element.drawOrder larger than max size of: ' + 0xFFFFFF);
      value = 0xFFFFFF;
    }

    this._drawOrder = (priority << 24) + value;
    this.fire('set:draworder', this._drawOrder);
  }
  get drawOrder() {
    return this._drawOrder;
  }

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

  set margin(value) {
    this._margin.copy(value);
    this._calculateSize(true, true);
    this.fire('set:margin', this._margin);
  }
  get margin() {
    return this._margin;
  }

  get maskedBy() {
    return this._maskedBy;
  }

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

    this._flagChildrenAsDirty();
    this.fire('set:pivot', pivot);
  }
  get pivot() {
    return this._pivot;
  }

  set right(value) {
    this._margin.z = value;

    const p = this.entity.getLocalPosition();
    const wl = this._absLeft;
    const wr = this._localAnchor.z - value;
    this._setWidth(wr - wl);

    p.x = this._localAnchor.z - this._localAnchor.x - value - this._calculatedWidth * (1 - this._pivot.x);
    this.entity.setLocalPosition(p);
  }
  get right() {
    return this._margin.z;
  }

  get screenCorners() {
    if (!this._cornersDirty || !this.screen) return this._screenCorners;
    const parentBottomLeft = this.entity.parent && this.entity.parent.element && this.entity.parent.element.screenCorners[0];

    this._screenCorners[0].set(this._absLeft, this._absBottom, 0);
    this._screenCorners[1].set(this._absRight, this._absBottom, 0);
    this._screenCorners[2].set(this._absRight, this._absTop, 0);
    this._screenCorners[3].set(this._absLeft, this._absTop, 0);

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

  get textWidth() {
    return this._text ? this._text.width : 0;
  }

  get textHeight() {
    return this._text ? this._text.height : 0;
  }

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

  get worldCorners() {
    if (!this._worldCornersDirty) {
      return this._worldCorners;
    }
    if (this.screen) {
      const screenCorners = this.screenCorners;
      if (!this.screen.screen.screenSpace) {
        matA.copy(this.screen.screen._screenMatrix);

        matA.data[13] = -matA.data[13];

        matA.mul2(this.screen.getWorldTransform(), matA);

        for (let i = 0; i < 4; i++) {
          matA.transformPoint(screenCorners[i], this._worldCorners[i]);
        }
      }
    } else {
      const localPos = this.entity.getLocalPosition();

      matA.setTranslate(-localPos.x, -localPos.y, -localPos.z);
      matB.setTRS(Vec3.ZERO, this.entity.getLocalRotation(), this.entity.getLocalScale());
      matC.setTranslate(localPos.x, localPos.y, localPos.z);

      const entity = this.entity.parent ? this.entity.parent : this.entity;
      matD.copy(entity.getWorldTransform());
      matD.mul(matC).mul(matB).mul(matA);

      vecA.set(localPos.x - this.pivot.x * this.calculatedWidth, localPos.y - this.pivot.y * this.calculatedHeight, localPos.z);
      matD.transformPoint(vecA, this._worldCorners[0]);

      vecA.set(localPos.x + (1 - this.pivot.x) * this.calculatedWidth, localPos.y - this.pivot.y * this.calculatedHeight, localPos.z);
      matD.transformPoint(vecA, this._worldCorners[1]);

      vecA.set(localPos.x + (1 - this.pivot.x) * this.calculatedWidth, localPos.y + (1 - this.pivot.y) * this.calculatedHeight, localPos.z);
      matD.transformPoint(vecA, this._worldCorners[2]);

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
    this.getWorldTransform();
    invParentWtm.copy(this.element._screenToWorld).invert();
    invParentWtm.transformPoint(position, this.localPosition);
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

  _setLocalPosition(x, y, z) {
    if (x instanceof Vec3) {
      this.localPosition.copy(x);
    } else {
      this.localPosition.set(x, y, z);
    }

    const element = this.element;
    const p = this.localPosition;
    const pvt = element._pivot;
    element._margin.x = p.x - element._calculatedWidth * pvt.x;
    element._margin.z = element._localAnchor.z - element._localAnchor.x - element._calculatedWidth - element._margin.x;
    element._margin.y = p.y - element._calculatedHeight * pvt.y;
    element._margin.w = element._localAnchor.w - element._localAnchor.y - element._calculatedHeight - element._margin.y;
    if (!this._dirtyLocal) this._dirtifyLocal();
  }

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
          resx = this._parent.element.calculatedWidth;
          resy = this._parent.element.calculatedHeight;
          px = this._parent.element.pivot.x;
          py = this._parent.element.pivot.y;
        } else {
          const resolution = screen.screen.resolution;
          resx = resolution.x / screen.screen.scale;
          resy = resolution.y / screen.screen.scale;
        }
        element._anchorTransform.setTranslate(resx * (element.anchor.x - px), -(resy * (py - element.anchor.y)), 0);
        element._anchorDirty = false;
        element._calculateLocalAnchors();
      }

      if (element._sizeDirty) {
        element._calculateSize(false, false);
      }
    }
    if (this._dirtyLocal) {
      this.localTransform.setTRS(this.localPosition, this.localRotation, this.localScale);

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

          const parentWorldTransform = element._parentWorldTransform;
          parentWorldTransform.setIdentity();
          const parent = this._parent;
          if (parent && parent.element && parent !== screen) {
            matA.setTRS(Vec3.ZERO, parent.getLocalRotation(), parent.getLocalScale());
            parentWorldTransform.mul2(parent.element._parentWorldTransform, matA);
          }

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

    const result = this._parseUpToScreen();
    this.entity._dirtifyWorld();
    this._updateScreen(result.screen);
    this._dirtifyMask();
  }
  _dirtifyMask() {
    let current = this.entity;
    while (current) {
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

      if (mask.element) {
        const depth = 1;
        mask.element.syncMask(depth);
      }
    }
    this.system._prerender.length = 0;
  }
  _bindScreen(screen) {
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

    const children = this.entity.children;
    for (let i = 0, l = children.length; i < l; i++) {
      if (children[i].element) children[i].element._updateScreen(screen);
    }

    if (this.screen) this.screen.screen.syncDrawOrder();
  }
  syncMask(depth) {
    const result = this._parseUpToScreen();
    this._updateMask(result.mask, depth);
  }

  _setMaskedBy(mask) {
    const renderableElement = this._image || this._text;
    if (mask) {
      const ref = mask.element._image._maskRef;
      const sp = new StencilParameters({
        ref: ref,
        func: FUNC_EQUAL
      });

      if (renderableElement && renderableElement._setStencil) {
        renderableElement._setStencil(sp);
      }
      this._maskedBy = mask;
    } else {

      if (renderableElement && renderableElement._setStencil) {
        renderableElement._setStencil(null);
      }
      this._maskedBy = null;
    }
  }

  _updateMask(currentMask, depth) {
    if (currentMask) {
      this._setMaskedBy(currentMask);

      if (this.mask) {
        const ref = currentMask.element._image._maskRef;
        const sp = new StencilParameters({
          ref: ref,
          func: FUNC_EQUAL,
          zpass: STENCILOP_INCREMENT
        });
        this._image._setStencil(sp);
        this._image._maskRef = depth;

        depth++;
        currentMask = this.entity;
      }

      const children = this.entity.children;
      for (let i = 0, l = children.length; i < l; i++) {
        if (children[i].element) {
          children[i].element._updateMask(currentMask, depth);
        }
      }

      if (this.mask) depth--;
    } else {
      this._setMaskedBy(null);
      if (this.mask) {
        const sp = new StencilParameters({
          ref: depth,
          func: FUNC_ALWAYS,
          zpass: STENCILOP_REPLACE
        });
        this._image._setStencil(sp);
        this._image._maskRef = depth;

        depth++;
        currentMask = this.entity;
      }

      const children = this.entity.children;
      for (let i = 0, l = children.length; i < l; i++) {
        if (children[i].element) {
          children[i].element._updateMask(currentMask, depth);
        }
      }

      if (this.mask) depth--;
    }
  }

  _parseUpToScreen() {
    const result = {
      screen: null,
      mask: null
    };
    let parent = this.entity._parent;
    while (parent && !parent.screen) {
      if (parent.element && parent.element.mask) {
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
        this.screen = null;
      } else {
        this._updateScreen(null);
      }
    }
  }

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

    if (this.screen && this.screen.screen) {
      this._unbindScreen(this.screen.screen);
      this.screen.screen.syncDrawOrder();
    }
    this.off();
  }

  _calculateSize(propagateCalculatedWidth, propagateCalculatedHeight) {
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

  _setWidth(w) {
    this._width = w;
    this._setCalculatedWidth(w, false);
    this.fire('set:width', this._width);
  }

  _setHeight(h) {
    this._height = h;
    this._setCalculatedHeight(h, false);
    this.fire('set:height', this._height);
  }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgRlVOQ19BTFdBWVMsIEZVTkNfRVFVQUwsIFNURU5DSUxPUF9JTkNSRU1FTlQsIFNURU5DSUxPUF9SRVBMQUNFIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgTEFZRVJJRF9VSSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9zdGVuY2lsLXBhcmFtZXRlcnMuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuLi8uLi9lbnRpdHkuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBFTEVNRU5UVFlQRV9HUk9VUCwgRUxFTUVOVFRZUEVfSU1BR0UsIEVMRU1FTlRUWVBFX1RFWFQsIEZJVE1PREVfU1RSRVRDSCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEltYWdlRWxlbWVudCB9IGZyb20gJy4vaW1hZ2UtZWxlbWVudC5qcyc7XG5pbXBvcnQgeyBUZXh0RWxlbWVudCB9IGZyb20gJy4vdGV4dC1lbGVtZW50LmpzJztcblxuLy8gI2lmIF9ERUJVR1xuY29uc3QgX2RlYnVnTG9nZ2luZyA9IGZhbHNlO1xuLy8gI2VuZGlmXG5cbmNvbnN0IHBvc2l0aW9uID0gbmV3IFZlYzMoKTtcbmNvbnN0IGludlBhcmVudFd0bSA9IG5ldyBNYXQ0KCk7XG5cbmNvbnN0IHZlY0EgPSBuZXcgVmVjMygpO1xuY29uc3QgdmVjQiA9IG5ldyBWZWMzKCk7XG5jb25zdCBtYXRBID0gbmV3IE1hdDQoKTtcbmNvbnN0IG1hdEIgPSBuZXcgTWF0NCgpO1xuY29uc3QgbWF0QyA9IG5ldyBNYXQ0KCk7XG5jb25zdCBtYXREID0gbmV3IE1hdDQoKTtcblxuLyoqXG4gKiBFbGVtZW50Q29tcG9uZW50cyBhcmUgdXNlZCB0byBjb25zdHJ1Y3QgdXNlciBpbnRlcmZhY2VzLiBBbiBFbGVtZW50Q29tcG9uZW50J3MgW3R5cGVdKCN0eXBlKVxuICogcHJvcGVydHkgY2FuIGJlIGNvbmZpZ3VyZWQgaW4gMyBtYWluIHdheXM6IGFzIGEgdGV4dCBlbGVtZW50LCBhcyBhbiBpbWFnZSBlbGVtZW50IG9yIGFzIGEgZ3JvdXBcbiAqIGVsZW1lbnQuIElmIHRoZSBFbGVtZW50Q29tcG9uZW50IGhhcyBhIHtAbGluayBTY3JlZW5Db21wb25lbnR9IGFuY2VzdG9yIGluIHRoZSBoaWVyYXJjaHksIGl0XG4gKiB3aWxsIGJlIHRyYW5zZm9ybWVkIHdpdGggcmVzcGVjdCB0byB0aGUgY29vcmRpbmF0ZSBzeXN0ZW0gb2YgdGhlIHNjcmVlbi4gSWYgdGhlcmUgaXMgbm9cbiAqIHtAbGluayBTY3JlZW5Db21wb25lbnR9IGFuY2VzdG9yLCB0aGUgRWxlbWVudENvbXBvbmVudCB3aWxsIGJlIHRyYW5zZm9ybWVkIGxpa2UgYW55IG90aGVyXG4gKiBlbnRpdHkuXG4gKlxuICogWW91IHNob3VsZCBuZXZlciBuZWVkIHRvIHVzZSB0aGUgRWxlbWVudENvbXBvbmVudCBjb25zdHJ1Y3Rvci4gVG8gYWRkIGFuIEVsZW1lbnRDb21wb25lbnQgdG8gYVxuICoge0BsaW5rIEVudGl0eX0sIHVzZSB7QGxpbmsgRW50aXR5I2FkZENvbXBvbmVudH06XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gQWRkIGFuIGVsZW1lbnQgY29tcG9uZW50IHRvIGFuIGVudGl0eSB3aXRoIHRoZSBkZWZhdWx0IG9wdGlvbnNcbiAqIGxldCBlbnRpdHkgPSBwYy5FbnRpdHkoKTtcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJlbGVtZW50XCIpOyAvLyBUaGlzIGRlZmF1bHRzIHRvIGEgJ2dyb3VwJyBlbGVtZW50XG4gKiBgYGBcbiAqXG4gKiBUbyBjcmVhdGUgYSBzaW1wbGUgdGV4dC1iYXNlZCBlbGVtZW50OlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGVudGl0eS5hZGRDb21wb25lbnQoXCJlbGVtZW50XCIsIHtcbiAqICAgICBhbmNob3I6IG5ldyBwYy5WZWM0KDAuNSwgMC41LCAwLjUsIDAuNSksIC8vIGNlbnRlcmVkIGFuY2hvclxuICogICAgIGZvbnRBc3NldDogZm9udEFzc2V0LFxuICogICAgIGZvbnRTaXplOiAxMjgsXG4gKiAgICAgcGl2b3Q6IG5ldyBwYy5WZWMyKDAuNSwgMC41KSwgICAgICAgICAgICAvLyBjZW50ZXJlZCBwaXZvdFxuICogICAgIHRleHQ6IFwiSGVsbG8gV29ybGQhXCIsXG4gKiAgICAgdHlwZTogcGMuRUxFTUVOVFRZUEVfVEVYVFxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBPbmNlIHRoZSBFbGVtZW50Q29tcG9uZW50IGlzIGFkZGVkIHRvIHRoZSBlbnRpdHksIHlvdSBjYW4gc2V0IGFuZCBnZXQgYW55IG9mIGl0cyBwcm9wZXJ0aWVzOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIGVudGl0eS5lbGVtZW50LmNvbG9yID0gcGMuQ29sb3IuUkVEOyAvLyBTZXQgdGhlIGVsZW1lbnQncyBjb2xvciB0byByZWRcbiAqXG4gKiBjb25zb2xlLmxvZyhlbnRpdHkuZWxlbWVudC5jb2xvcik7ICAgLy8gR2V0IHRoZSBlbGVtZW50J3MgY29sb3IgYW5kIHByaW50IGl0XG4gKiBgYGBcbiAqXG4gKiBSZWxldmFudCAnRW5naW5lLW9ubHknIGV4YW1wbGVzOlxuICogLSBbQmFzaWMgdGV4dCByZW5kZXJpbmddKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jdXNlci1pbnRlcmZhY2UvdGV4dC1iYXNpYylcbiAqIC0gW1JlbmRlcmluZyB0ZXh0IG91dGxpbmVzXShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3VzZXItaW50ZXJmYWNlL3RleHQtb3V0bGluZSlcbiAqIC0gW0FkZGluZyBkcm9wIHNoYWRvd3MgdG8gdGV4dF0oaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyN1c2VyLWludGVyZmFjZS90ZXh0LWRyb3Atc2hhZG93KVxuICogLSBbQ29sb3JpbmcgdGV4dCB3aXRoIG1hcmt1cF0oaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyN1c2VyLWludGVyZmFjZS90ZXh0LW1hcmt1cClcbiAqIC0gW1dyYXBwaW5nIHRleHRdKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jdXNlci1pbnRlcmZhY2UvdGV4dC13cmFwKVxuICogLSBbVHlwZXdyaXRlciB0ZXh0XShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3VzZXItaW50ZXJmYWNlL3RleHQtdHlwZXdyaXRlcilcbiAqXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJykuQ29sb3J9IGNvbG9yIFRoZSBjb2xvciBvZiB0aGUgaW1hZ2UgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIG9yIHRoZSBjb2xvciBvZiB0aGUgdGV4dCBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHkgVGhlIG9wYWNpdHkgb2YgdGhlIGltYWdlIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIG9yIHRoZVxuICogdGV4dCBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcycpLkNvbG9yfSBvdXRsaW5lQ29sb3IgVGhlIHRleHQgb3V0bGluZSBlZmZlY3RcbiAqIGNvbG9yIGFuZCBvcGFjaXR5LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3V0bGluZVRoaWNrbmVzcyBUaGUgd2lkdGggb2YgdGhlIHRleHQgb3V0bGluZSBlZmZlY3QuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJykuQ29sb3J9IHNoYWRvd0NvbG9yIFRoZSB0ZXh0IHNoYWRvdyBlZmZlY3QgY29sb3JcbiAqIGFuZCBvcGFjaXR5LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IHNoYWRvd09mZnNldCBUaGUgdGV4dCBzaGFkb3cgZWZmZWN0IHNoaWZ0IGFtb3VudCBmcm9tIG9yaWdpbmFsIHRleHQuIE9ubHkgd29ya3NcbiAqIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGF1dG9XaWR0aCBBdXRvbWF0aWNhbGx5IHNldCB0aGUgd2lkdGggb2YgdGhlIGNvbXBvbmVudCB0byBiZSB0aGUgc2FtZSBhcyB0aGVcbiAqIHRleHRXaWR0aC4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvSGVpZ2h0IEF1dG9tYXRpY2FsbHkgc2V0IHRoZSBoZWlnaHQgb2YgdGhlIGNvbXBvbmVudCB0byBiZSB0aGUgc2FtZSBhc1xuICogdGhlIHRleHRIZWlnaHQuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBmaXRNb2RlIFNldCBob3cgdGhlIGNvbnRlbnQgc2hvdWxkIGJlIGZpdHRlZCBhbmQgcHJlc2VydmUgdGhlIGFzcGVjdCByYXRpbyBvZlxuICogdGhlIHNvdXJjZSB0ZXh0dXJlIG9yIHNwcml0ZS4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmb250QXNzZXQgVGhlIGlkIG9mIHRoZSBmb250IGFzc2V0IHVzZWQgZm9yIHJlbmRlcmluZyB0aGUgdGV4dC4gT25seSB3b3Jrc1xuICogZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9mb250L2ZvbnQuanMnKS5Gb250fSBmb250IFRoZSBmb250IHVzZWQgZm9yIHJlbmRlcmluZyB0aGUgdGV4dC4gT25seVxuICogd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmb250U2l6ZSBUaGUgc2l6ZSBvZiB0aGUgZm9udC4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvRml0V2lkdGggV2hlbiB0cnVlIHRoZSBmb250IHNpemUgYW5kIGxpbmUgaGVpZ2h0IHdpbGwgc2NhbGUgc28gdGhhdCB0aGVcbiAqIHRleHQgZml0cyBpbnNpZGUgdGhlIHdpZHRoIG9mIHRoZSBFbGVtZW50LiBUaGUgZm9udCBzaXplIHdpbGwgYmUgc2NhbGVkIGJldHdlZW4gbWluRm9udFNpemUgYW5kXG4gKiBtYXhGb250U2l6ZS4gVGhlIHZhbHVlIG9mIGF1dG9GaXRXaWR0aCB3aWxsIGJlIGlnbm9yZWQgaWYgYXV0b1dpZHRoIGlzIHRydWUuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGF1dG9GaXRIZWlnaHQgV2hlbiB0cnVlIHRoZSBmb250IHNpemUgYW5kIGxpbmUgaGVpZ2h0IHdpbGwgc2NhbGUgc28gdGhhdCB0aGVcbiAqIHRleHQgZml0cyBpbnNpZGUgdGhlIGhlaWdodCBvZiB0aGUgRWxlbWVudC4gVGhlIGZvbnQgc2l6ZSB3aWxsIGJlIHNjYWxlZCBiZXR3ZWVuIG1pbkZvbnRTaXplIGFuZFxuICogbWF4Rm9udFNpemUuIFRoZSB2YWx1ZSBvZiBhdXRvRml0SGVpZ2h0IHdpbGwgYmUgaWdub3JlZCBpZiBhdXRvSGVpZ2h0IGlzIHRydWUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWluRm9udFNpemUgVGhlIG1pbmltdW0gc2l6ZSB0aGF0IHRoZSBmb250IGNhbiBzY2FsZSB0byB3aGVuIGF1dG9GaXRXaWR0aCBvclxuICogYXV0b0ZpdEhlaWdodCBhcmUgdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXhGb250U2l6ZSBUaGUgbWF4aW11bSBzaXplIHRoYXQgdGhlIGZvbnQgY2FuIHNjYWxlIHRvIHdoZW4gYXV0b0ZpdFdpZHRoIG9yXG4gKiBhdXRvRml0SGVpZ2h0IGFyZSB0cnVlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwYWNpbmcgVGhlIHNwYWNpbmcgYmV0d2VlbiB0aGUgbGV0dGVycyBvZiB0aGUgdGV4dC4gT25seSB3b3JrcyBmb3JcbiAqIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaW5lSGVpZ2h0IFRoZSBoZWlnaHQgb2YgZWFjaCBsaW5lIG9mIHRleHQuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHdyYXBMaW5lcyBXaGV0aGVyIHRvIGF1dG9tYXRpY2FsbHkgd3JhcCBsaW5lcyBiYXNlZCBvbiB0aGUgZWxlbWVudCB3aWR0aC5cbiAqIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcywgYW5kIHdoZW4gYXV0b1dpZHRoIGlzIHNldCB0byBmYWxzZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXhMaW5lcyBUaGUgbWF4aW11bSBudW1iZXIgb2YgbGluZXMgdGhhdCB0aGUgRWxlbWVudCBjYW4gd3JhcCB0by4gQW55XG4gKiBsZWZ0b3ZlciB0ZXh0IHdpbGwgYmUgYXBwZW5kZWQgdG8gdGhlIGxhc3QgbGluZS4gU2V0IHRoaXMgdG8gbnVsbCB0byBhbGxvdyB1bmxpbWl0ZWQgbGluZXMuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGFsaWdubWVudCBUaGUgaG9yaXpvbnRhbCBhbmQgdmVydGljYWwgYWxpZ25tZW50IG9mIHRoZSB0ZXh0LiBWYWx1ZXMgcmFuZ2UgZnJvbVxuICogMCB0byAxIHdoZXJlIFswLDBdIGlzIHRoZSBib3R0b20gbGVmdCBhbmQgWzEsMV0gaXMgdGhlIHRvcCByaWdodC4gIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdGV4dCBUaGUgdGV4dCB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy4gVG9cbiAqIG92ZXJyaWRlIGNlcnRhaW4gdGV4dCBzdHlsaW5nIHByb3BlcnRpZXMgb24gYSBwZXItY2hhcmFjdGVyIGJhc2lzLCB0aGUgdGV4dCBjYW4gb3B0aW9uYWxseVxuICogaW5jbHVkZSBtYXJrdXAgdGFncyBjb250YWluZWQgd2l0aGluIHNxdWFyZSBicmFja2V0cy4gU3VwcG9ydGVkIHRhZ3MgYXJlOlxuICpcbiAqIC0gYGNvbG9yYCAtIG92ZXJyaWRlIHRoZSBlbGVtZW50J3MgYGNvbG9yYCBwcm9wZXJ0eS4gRXhhbXBsZXM6XG4gKiAgIC0gYFtjb2xvcj1cIiNmZjAwMDBcIl1yZWQgdGV4dFsvY29sb3JdYFxuICogICAtIGBbY29sb3I9XCIjMDBmZjAwXCJdZ3JlZW4gdGV4dFsvY29sb3JdYFxuICogICAtIGBbY29sb3I9XCIjMDAwMGZmXCJdYmx1ZSB0ZXh0Wy9jb2xvcl1gXG4gKiAtIGBvdXRsaW5lYCAtIG92ZXJyaWRlIHRoZSBlbGVtZW50J3MgYG91dGxpbmVDb2xvcmAgYW5kIGBvdXRsaW5lVGhpY2tuZXNzYCBwcm9wZXJ0aWVzLiBFeGFtcGxlOlxuICogICAtIGBbb3V0bGluZSBjb2xvcj1cIiNmZmZmZmZcIiB0aGlja25lc3M9XCIwLjVcIl10ZXh0Wy9vdXRsaW5lXWBcbiAqIC0gYHNoYWRvd2AgLSBvdmVycmlkZSB0aGUgZWxlbWVudCdzIGBzaGFkb3dDb2xvcmAgYW5kIGBzaGFkb3dPZmZzZXRgIHByb3BlcnRpZXMuIEV4YW1wbGVzOlxuICogICAtIGBbc2hhZG93IGNvbG9yPVwiI2ZmZmZmZlwiIG9mZnNldD1cIjAuNVwiXXRleHRbL3NoYWRvd11gXG4gKiAgIC0gYFtzaGFkb3cgY29sb3I9XCIjMDAwMDAwXCIgb2Zmc2V0WD1cIjAuMVwiIG9mZnNldFk9XCIwLjJcIl10ZXh0Wy9zaGFkb3ddYFxuICpcbiAqIE5vdGUgdGhhdCBtYXJrdXAgdGFncyBhcmUgb25seSBwcm9jZXNzZWQgaWYgdGhlIHRleHQgZWxlbWVudCdzIGBlbmFibGVNYXJrdXBgIHByb3BlcnR5IGlzIHNldCB0b1xuICogdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBrZXkgVGhlIGxvY2FsaXphdGlvbiBrZXkgdG8gdXNlIHRvIGdldCB0aGUgbG9jYWxpemVkIHRleHQgZnJvbVxuICoge0BsaW5rIEFwcGxpY2F0aW9uI2kxOG59LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGV4dHVyZUFzc2V0IFRoZSBpZCBvZiB0aGUgdGV4dHVyZSBhc3NldCB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSB0ZXh0dXJlIFRoZSB0ZXh0dXJlIHRvXG4gKiByZW5kZXIuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3ByaXRlQXNzZXQgVGhlIGlkIG9mIHRoZSBzcHJpdGUgYXNzZXQgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcyB3aGljaCBjYW4gcmVuZGVyIGVpdGhlciBhIHRleHR1cmUgb3IgYSBzcHJpdGUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvc3ByaXRlLmpzJykuU3ByaXRlfSBzcHJpdGUgVGhlIHNwcml0ZSB0byByZW5kZXIuIE9ubHkgd29ya3NcbiAqIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIHdoaWNoIGNhbiByZW5kZXIgZWl0aGVyIGEgdGV4dHVyZSBvciBhIHNwcml0ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzcHJpdGVGcmFtZSBUaGUgZnJhbWUgb2YgdGhlIHNwcml0ZSB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIHdobyBoYXZlIGEgc3ByaXRlIGFzc2lnbmVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHBpeGVsc1BlclVuaXQgVGhlIG51bWJlciBvZiBwaXhlbHMgdGhhdCBtYXAgdG8gb25lIFBsYXlDYW52YXMgdW5pdC4gT25seVxuICogd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMgd2hvIGhhdmUgYSBzbGljZWQgc3ByaXRlIGFzc2lnbmVkLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG1hdGVyaWFsQXNzZXQgVGhlIGlkIG9mIHRoZSBtYXRlcmlhbCBhc3NldCB0byB1c2Ugd2hlbiByZW5kZXJpbmcgYW4gaW1hZ2UuXG4gKiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfSBtYXRlcmlhbCBUaGUgbWF0ZXJpYWwgdG8gdXNlXG4gKiB3aGVuIHJlbmRlcmluZyBhbiBpbWFnZS4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7VmVjNH0gcmVjdCBTcGVjaWZpZXMgd2hpY2ggcmVnaW9uIG9mIHRoZSB0ZXh0dXJlIHRvIHVzZSBpbiBvcmRlciB0byByZW5kZXIgYW4gaW1hZ2UuXG4gKiBWYWx1ZXMgcmFuZ2UgZnJvbSAwIHRvIDEgYW5kIGluZGljYXRlIHUsIHYsIHdpZHRoLCBoZWlnaHQuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBydGxSZW9yZGVyIFJlb3JkZXIgdGhlIHRleHQgZm9yIFJUTCBsYW5ndWFnZXMgdXNpbmcgYSBmdW5jdGlvbiByZWdpc3RlcmVkXG4gKiBieSBgYXBwLnN5c3RlbXMuZWxlbWVudC5yZWdpc3RlclVuaWNvZGVDb252ZXJ0ZXJgLlxuICogQHByb3BlcnR5IHtib29sZWFufSB1bmljb2RlQ29udmVydGVyIENvbnZlcnQgdW5pY29kZSBjaGFyYWN0ZXJzIHVzaW5nIGEgZnVuY3Rpb24gcmVnaXN0ZXJlZCBieVxuICogYGFwcC5zeXN0ZW1zLmVsZW1lbnQucmVnaXN0ZXJVbmljb2RlQ29udmVydGVyYC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZW5hYmxlTWFya3VwIEZsYWcgZm9yIGVuYWJsaW5nIG1hcmt1cCBwcm9jZXNzaW5nLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByYW5nZVN0YXJ0IEluZGV4IG9mIHRoZSBmaXJzdCBjaGFyYWN0ZXIgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhbmdlRW5kIEluZGV4IG9mIHRoZSBsYXN0IGNoYXJhY3RlciB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG1hc2sgU3dpdGNoIEltYWdlIEVsZW1lbnQgaW50byBhIG1hc2suIE1hc2tzIGRvIG5vdCByZW5kZXIgaW50byB0aGUgc2NlbmUsXG4gKiBidXQgaW5zdGVhZCBsaW1pdCBjaGlsZCBlbGVtZW50cyB0byBvbmx5IGJlIHJlbmRlcmVkIHdoZXJlIHRoaXMgZWxlbWVudCBpcyByZW5kZXJlZC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgRWxlbWVudENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEVsZW1lbnRDb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5FbGVtZW50Q29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIC8vIHNldCB0byB0cnVlIGJ5IHRoZSBFbGVtZW50Q29tcG9uZW50U3lzdGVtIHdoaWxlXG4gICAgICAgIC8vIHRoZSBjb21wb25lbnQgaXMgYmVpbmcgaW5pdGlhbGl6ZWRcbiAgICAgICAgdGhpcy5fYmVpbmdJbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2FuY2hvciA9IG5ldyBWZWM0KCk7XG4gICAgICAgIHRoaXMuX2xvY2FsQW5jaG9yID0gbmV3IFZlYzQoKTtcblxuICAgICAgICB0aGlzLl9waXZvdCA9IG5ldyBWZWMyKCk7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSB0aGlzLl9jYWxjdWxhdGVkV2lkdGggPSAzMjtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdGhpcy5fY2FsY3VsYXRlZEhlaWdodCA9IDMyO1xuXG4gICAgICAgIHRoaXMuX21hcmdpbiA9IG5ldyBWZWM0KDAsIDAsIC0zMiwgLTMyKTtcblxuICAgICAgICAvLyB0aGUgbW9kZWwgdHJhbnNmb3JtIHVzZWQgdG8gcmVuZGVyXG4gICAgICAgIHRoaXMuX21vZGVsVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcblxuICAgICAgICB0aGlzLl9zY3JlZW5Ub1dvcmxkID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvLyB0cmFuc2Zvcm0gdGhhdCB1cGRhdGVzIGxvY2FsIHBvc2l0aW9uIGFjY29yZGluZyB0byBhbmNob3IgdmFsdWVzXG4gICAgICAgIHRoaXMuX2FuY2hvclRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIC8vIHRyYW5zZm9ybXMgdG8gY2FsY3VsYXRlIHNjcmVlbiBjb29yZGluYXRlc1xuICAgICAgICB0aGlzLl9wYXJlbnRXb3JsZFRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIHRoaXMuX3NjcmVlblRyYW5zZm9ybSA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgLy8gdGhlIGNvcm5lcnMgb2YgdGhlIGVsZW1lbnQgcmVsYXRpdmUgdG8gaXRzIHNjcmVlbiBjb21wb25lbnQuXG4gICAgICAgIC8vIE9yZGVyIGlzIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCwgdG9wIGxlZnRcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVycyA9IFtuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpLCBuZXcgVmVjMygpXTtcblxuICAgICAgICAvLyBjYW52YXMtc3BhY2UgY29ybmVycyBvZiB0aGUgZWxlbWVudC5cbiAgICAgICAgLy8gT3JkZXIgaXMgYm90dG9tIGxlZnQsIGJvdHRvbSByaWdodCwgdG9wIHJpZ2h0LCB0b3AgbGVmdFxuICAgICAgICB0aGlzLl9jYW52YXNDb3JuZXJzID0gW25ldyBWZWMyKCksIG5ldyBWZWMyKCksIG5ldyBWZWMyKCksIG5ldyBWZWMyKCldO1xuXG4gICAgICAgIC8vIHRoZSB3b3JsZC1zcGFjZSBjb3JuZXJzIG9mIHRoZSBlbGVtZW50XG4gICAgICAgIC8vIE9yZGVyIGlzIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCwgdG9wIGxlZnRcbiAgICAgICAgdGhpcy5fd29ybGRDb3JuZXJzID0gW25ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKCldO1xuXG4gICAgICAgIHRoaXMuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLmVudGl0eS5vbignaW5zZXJ0JywgdGhpcy5fb25JbnNlcnQsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX3BhdGNoKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBFbnRpdHkgd2l0aCBhIHtAbGluayBTY3JlZW5Db21wb25lbnR9IHRoYXQgdGhpcyBjb21wb25lbnQgYmVsb25ncyB0by4gVGhpcyBpc1xuICAgICAgICAgKiBhdXRvbWF0aWNhbGx5IHNldCB3aGVuIHRoZSBjb21wb25lbnQgaXMgYSBjaGlsZCBvZiBhIFNjcmVlbkNvbXBvbmVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VudGl0eXxudWxsfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY3JlZW4gPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSBFTEVNRU5UVFlQRV9HUk9VUDtcblxuICAgICAgICAvLyBlbGVtZW50IHR5cGVzXG4gICAgICAgIHRoaXMuX2ltYWdlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdGV4dCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2dyb3VwID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIC8vIEZpdCBtb2RlXG4gICAgICAgIHRoaXMuX2ZpdE1vZGUgPSBGSVRNT0RFX1NUUkVUQ0g7XG5cbiAgICAgICAgLy8gaW5wdXQgcmVsYXRlZFxuICAgICAgICB0aGlzLl91c2VJbnB1dCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2xheWVycyA9IFtMQVlFUklEX1VJXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IFVJIGxheWVyXG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWxzID0gW107IC8vIHN0b3JlIG1vZGVscyB0aGF0IGhhdmUgYmVlbiBhZGRlZCB0byBsYXllciBzbyB3ZSBjYW4gcmUtYWRkIHdoZW4gbGF5ZXIgaXMgY2hhbmdlZFxuXG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXBJZCA9IC0xO1xuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIHRoaXMuX2JhdGNoR3JvdXAgPSBudWxsO1xuICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgLy9cblxuICAgICAgICB0aGlzLl9vZmZzZXRSZWFkQXQgPSAwO1xuICAgICAgICB0aGlzLl9tYXNrT2Zmc2V0ID0gMC41O1xuICAgICAgICB0aGlzLl9tYXNrZWRCeSA9IG51bGw7IC8vIHRoZSBlbnRpdHkgdGhhdCBpcyBtYXNraW5nIHRoaXMgZWxlbWVudFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGlzIHByZXNzZWQgd2hpbGUgdGhlIGN1cnNvciBpcyBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW5cbiAgICAgKiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjbW91c2Vkb3duXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBpcyByZWxlYXNlZCB3aGlsZSB0aGUgY3Vyc29yIGlzIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlblxuICAgICAqIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCNtb3VzZXVwXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBjdXJzb3IgZW50ZXJzIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjbW91c2VlbnRlclxuICAgICAqIEBwYXJhbSB7RWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgbW91c2UgY3Vyc29yIGxlYXZlcyB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I21vdXNlbGVhdmVcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGN1cnNvciBpcyBtb3ZlZCBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I21vdXNlbW92ZVxuICAgICAqIEBwYXJhbSB7RWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgbW91c2Ugd2hlZWwgaXMgc2Nyb2xsZWQgb24gdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCNtb3VzZXdoZWVsXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBpcyBwcmVzc2VkIGFuZCByZWxlYXNlZCBvbiB0aGUgY29tcG9uZW50IG9yIHdoZW4gYSB0b3VjaCBzdGFydHMgYW5kXG4gICAgICogZW5kcyBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I2NsaWNrXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudHxFbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgdG91Y2ggc3RhcnRzIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjdG91Y2hzdGFydFxuICAgICAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHRvdWNoIGVuZHMgb24gdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCN0b3VjaGVuZFxuICAgICAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHRvdWNoIG1vdmVzIGFmdGVyIGl0IHN0YXJ0ZWQgdG91Y2hpbmcgdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0XG4gICAgICogaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I3RvdWNobW92ZVxuICAgICAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHRvdWNoIGlzIGNhbmNlbGVkIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjdG91Y2hjYW5jZWxcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIGdldCBfYWJzTGVmdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xvY2FsQW5jaG9yLnggKyB0aGlzLl9tYXJnaW4ueDtcbiAgICB9XG5cbiAgICBnZXQgX2Fic1JpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IueiAtIHRoaXMuX21hcmdpbi56O1xuICAgIH1cblxuICAgIGdldCBfYWJzVG9wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IudyAtIHRoaXMuX21hcmdpbi53O1xuICAgIH1cblxuICAgIGdldCBfYWJzQm90dG9tKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IueSArIHRoaXMuX21hcmdpbi55O1xuICAgIH1cblxuICAgIGdldCBfaGFzU3BsaXRBbmNob3JzWCgpIHtcbiAgICAgICAgcmV0dXJuIE1hdGguYWJzKHRoaXMuX2FuY2hvci54IC0gdGhpcy5fYW5jaG9yLnopID4gMC4wMDE7XG4gICAgfVxuXG4gICAgZ2V0IF9oYXNTcGxpdEFuY2hvcnNZKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5hYnModGhpcy5fYW5jaG9yLnkgLSB0aGlzLl9hbmNob3IudykgPiAwLjAwMTtcbiAgICB9XG5cbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSByZXR1cm4gdGhpcy5faW1hZ2UuYWFiYjtcbiAgICAgICAgaWYgKHRoaXMuX3RleHQpIHJldHVybiB0aGlzLl90ZXh0LmFhYmI7XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHdoZXJlIHRoZSBsZWZ0LCBib3R0b20sIHJpZ2h0IGFuZCB0b3AgZWRnZXMgb2YgdGhlIGNvbXBvbmVudCBhcmUgYW5jaG9yZWQgcmVsYXRpdmVcbiAgICAgKiB0byBpdHMgcGFyZW50LiBFYWNoIHZhbHVlIHJhbmdlcyBmcm9tIDAgdG8gMS4gZS5nLiBhIHZhbHVlIG9mIFswLCAwLCAwLCAwXSBtZWFucyB0aGF0IHRoZVxuICAgICAqIGVsZW1lbnQgd2lsbCBiZSBhbmNob3JlZCB0byB0aGUgYm90dG9tIGxlZnQgb2YgaXRzIHBhcmVudC4gQSB2YWx1ZSBvZiBbMSwgMSwgMSwgMV0gbWVhbnMgaXRcbiAgICAgKiB3aWxsIGJlIGFuY2hvcmVkIHRvIHRoZSB0b3AgcmlnaHQuIEEgc3BsaXQgYW5jaG9yIGlzIHdoZW4gdGhlIGxlZnQtcmlnaHQgb3IgdG9wLWJvdHRvbSBwYWlyc1xuICAgICAqIG9mIHRoZSBhbmNob3IgYXJlIG5vdCBlcXVhbC4gSW4gdGhhdCBjYXNlIHRoZSBjb21wb25lbnQgd2lsbCBiZSByZXNpemVkIHRvIGNvdmVyIHRoYXQgZW50aXJlXG4gICAgICogYXJlYS4gZS5nLiBhIHZhbHVlIG9mIFswLCAwLCAxLCAxXSB3aWxsIG1ha2UgdGhlIGNvbXBvbmVudCByZXNpemUgZXhhY3RseSBhcyBpdHMgcGFyZW50LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5hcHAucm9vdC5maW5kQnlOYW1lKFwiSW52ZW50b3J5XCIpLmVsZW1lbnQuYW5jaG9yID0gbmV3IHBjLlZlYzQoTWF0aC5yYW5kb20oKSAqIDAuMSwgMCwgMSwgMCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5hcHAucm9vdC5maW5kQnlOYW1lKFwiSW52ZW50b3J5XCIpLmVsZW1lbnQuYW5jaG9yID0gW01hdGgucmFuZG9tKCkgKiAwLjEsIDAsIDEsIDBdO1xuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzQgfCBudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgYW5jaG9yKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci5jb3B5KHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci5zZXQoLi4udmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0aGlzLmVudGl0eS5fcGFyZW50ICYmICF0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fY2FsY3VsYXRlTG9jYWxBbmNob3JzKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVTaXplKHRoaXMuX2hhc1NwbGl0QW5jaG9yc1gsIHRoaXMuX2hhc1NwbGl0QW5jaG9yc1kpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIGlmICghdGhpcy5lbnRpdHkuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5fZGlydGlmeUxvY2FsKCk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6YW5jaG9yJywgdGhpcy5fYW5jaG9yKTtcbiAgICB9XG5cbiAgICBnZXQgYW5jaG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5jaG9yO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBlbGVtZW50IHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5FTEVNRU5ULCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdmFsdWUgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLkVMRU1FTlQsIHZhbHVlLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUgPCAwICYmIHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAvLyByZS1hZGQgbW9kZWwgdG8gc2NlbmUsIGluIGNhc2UgaXQgd2FzIHJlbW92ZWQgYnkgYmF0Y2hpbmdcbiAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZSAmJiB0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycyh0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3RleHQgJiYgdGhpcy5fdGV4dC5fbW9kZWwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnModGhpcy5fdGV4dC5fbW9kZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cElkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGJhdGNoR3JvdXBJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoR3JvdXBJZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgYm90dG9tIGVkZ2Ugb2YgdGhlIGFuY2hvci4gQ2FuIGJlIHVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBhIHNwbGl0XG4gICAgICogYW5jaG9yIHRvIG1ha2UgdGhlIGNvbXBvbmVudCdzIHRvcCBlZGdlIGFsd2F5cyBiZSAndG9wJyB1bml0cyBhd2F5IGZyb20gdGhlIHRvcC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGJvdHRvbSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4ueSA9IHZhbHVlO1xuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3dCA9IHRoaXMuX2Fic1RvcDtcbiAgICAgICAgY29uc3Qgd2IgPSB0aGlzLl9sb2NhbEFuY2hvci55ICsgdmFsdWU7XG4gICAgICAgIHRoaXMuX3NldEhlaWdodCh3dCAtIHdiKTtcblxuICAgICAgICBwLnkgPSB2YWx1ZSArIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQgKiB0aGlzLl9waXZvdC55O1xuICAgICAgICB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHApO1xuICAgIH1cblxuICAgIGdldCBib3R0b20oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXJnaW4ueTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggYXQgd2hpY2ggdGhlIGVsZW1lbnQgd2lsbCBiZSByZW5kZXJlZC4gSW4gbW9zdCBjYXNlcyB0aGlzIHdpbGwgYmUgdGhlIHNhbWUgYXNcbiAgICAgKiBgd2lkdGhgLiBIb3dldmVyLCBpbiBzb21lIGNhc2VzIHRoZSBlbmdpbmUgbWF5IGNhbGN1bGF0ZSBhIGRpZmZlcmVudCB3aWR0aCBmb3IgdGhlIGVsZW1lbnQsXG4gICAgICogc3VjaCBhcyB3aGVuIHRoZSBlbGVtZW50IGlzIHVuZGVyIHRoZSBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gSW4gdGhlc2VcbiAgICAgKiBzY2VuYXJpb3MsIGBjYWxjdWxhdGVkV2lkdGhgIG1heSBiZSBzbWFsbGVyIG9yIGxhcmdlciB0aGFuIHRoZSB3aWR0aCB0aGF0IHdhcyBzZXQgaW4gdGhlXG4gICAgICogZWRpdG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgY2FsY3VsYXRlZFdpZHRoKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRXaWR0aCh2YWx1ZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZWRXaWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IGF0IHdoaWNoIHRoZSBlbGVtZW50IHdpbGwgYmUgcmVuZGVyZWQuIEluIG1vc3QgY2FzZXMgdGhpcyB3aWxsIGJlIHRoZSBzYW1lIGFzXG4gICAgICogYGhlaWdodGAuIEhvd2V2ZXIsIGluIHNvbWUgY2FzZXMgdGhlIGVuZ2luZSBtYXkgY2FsY3VsYXRlIGEgZGlmZmVyZW50IGhlaWdodCBmb3IgdGhlIGVsZW1lbnQsXG4gICAgICogc3VjaCBhcyB3aGVuIHRoZSBlbGVtZW50IGlzIHVuZGVyIHRoZSBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gSW4gdGhlc2VcbiAgICAgKiBzY2VuYXJpb3MsIGBjYWxjdWxhdGVkSGVpZ2h0YCBtYXkgYmUgc21hbGxlciBvciBsYXJnZXIgdGhhbiB0aGUgaGVpZ2h0IHRoYXQgd2FzIHNldCBpbiB0aGVcbiAgICAgKiBlZGl0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjYWxjdWxhdGVkSGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRIZWlnaHQodmFsdWUsIHRydWUpO1xuICAgIH1cblxuICAgIGdldCBjYWxjdWxhdGVkSGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FsY3VsYXRlZEhlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiA0IHtAbGluayBWZWMyfXMgdGhhdCByZXByZXNlbnQgdGhlIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCBhbmQgdG9wXG4gICAgICogbGVmdCBjb3JuZXJzIG9mIHRoZSBjb21wb25lbnQgaW4gY2FudmFzIHBpeGVscy4gT25seSB3b3JrcyBmb3Igc2NyZWVuIHNwYWNlIGVsZW1lbnRcbiAgICAgKiBjb21wb25lbnRzLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzJbXX1cbiAgICAgKi9cbiAgICBnZXQgY2FudmFzQ29ybmVycygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jYW52YXNDb3JuZXJzRGlydHkgfHwgIXRoaXMuc2NyZWVuIHx8ICF0aGlzLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY2FudmFzQ29ybmVycztcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjcmVlbkNvcm5lcnMgPSB0aGlzLnNjcmVlbkNvcm5lcnM7XG4gICAgICAgIGNvbnN0IHN4ID0gZGV2aWNlLmNhbnZhcy5jbGllbnRXaWR0aCAvIGRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3Qgc3kgPSBkZXZpY2UuY2FudmFzLmNsaWVudEhlaWdodCAvIGRldmljZS5oZWlnaHQ7XG5cbiAgICAgICAgLy8gc2NhbGUgc2NyZWVuIGNvcm5lcnMgdG8gY2FudmFzIHNpemUgYW5kIHJldmVyc2UgeVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fY2FudmFzQ29ybmVyc1tpXS5zZXQoc2NyZWVuQ29ybmVyc1tpXS54ICogc3gsIChkZXZpY2UuaGVpZ2h0IC0gc2NyZWVuQ29ybmVyc1tpXS55KSAqIHN5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9jYW52YXNDb3JuZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkcmF3IG9yZGVyIG9mIHRoZSBjb21wb25lbnQuIEEgaGlnaGVyIHZhbHVlIG1lYW5zIHRoYXQgdGhlIGNvbXBvbmVudCB3aWxsIGJlIHJlbmRlcmVkIG9uXG4gICAgICogdG9wIG9mIG90aGVyIGNvbXBvbmVudHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBkcmF3T3JkZXIodmFsdWUpIHtcbiAgICAgICAgbGV0IHByaW9yaXR5ID0gMDtcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICBwcmlvcml0eSA9IHRoaXMuc2NyZWVuLnNjcmVlbi5wcmlvcml0eTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA+IDB4RkZGRkZGKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKCdFbGVtZW50LmRyYXdPcmRlciBsYXJnZXIgdGhhbiBtYXggc2l6ZSBvZjogJyArIDB4RkZGRkZGKTtcbiAgICAgICAgICAgIHZhbHVlID0gMHhGRkZGRkY7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzY3JlZW4gcHJpb3JpdHkgaXMgc3RvcmVkIGluIHRoZSB0b3AgOCBiaXRzXG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IChwcmlvcml0eSA8PCAyNCkgKyB2YWx1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6ZHJhd29yZGVyJywgdGhpcy5fZHJhd09yZGVyKTtcbiAgICB9XG5cbiAgICBnZXQgZHJhd09yZGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZHJhd09yZGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIGVsZW1lbnQgYXMgc2V0IGluIHRoZSBlZGl0b3IuIE5vdGUgdGhhdCBpbiBzb21lIGNhc2VzIHRoaXMgbWF5IG5vdCByZWZsZWN0XG4gICAgICogdGhlIHRydWUgaGVpZ2h0IGF0IHdoaWNoIHRoZSBlbGVtZW50IGlzIHJlbmRlcmVkLCBzdWNoIGFzIHdoZW4gdGhlIGVsZW1lbnQgaXMgdW5kZXIgdGhlXG4gICAgICogY29udHJvbCBvZiBhIHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudH0uIFNlZSBgY2FsY3VsYXRlZEhlaWdodGAgaW4gb3JkZXIgdG8gZW5zdXJlIHlvdSBhcmVcbiAgICAgKiByZWFkaW5nIHRoZSB0cnVlIGhlaWdodCBhdCB3aGljaCB0aGUgZWxlbWVudCB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5faGFzU3BsaXRBbmNob3JzWSkge1xuICAgICAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZEhlaWdodCh2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDpoZWlnaHQnLCB0aGlzLl9oZWlnaHQpO1xuICAgIH1cblxuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbGF5ZXIgSURzICh7QGxpbmsgTGF5ZXIjaWR9KSB0byB3aGljaCB0aGlzIGVsZW1lbnQgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCxcbiAgICAgKiBwb3AsIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZGVkTW9kZWxzLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fYWRkZWRNb2RlbHNbal0ubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sYXllcnMgPSB2YWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCB8fCAhdGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoKSByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9hZGRlZE1vZGVsc1tqXS5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIGFuY2hvci4gQ2FuIGJlIHVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBhIHNwbGl0XG4gICAgICogYW5jaG9yIHRvIG1ha2UgdGhlIGNvbXBvbmVudCdzIGxlZnQgZWRnZSBhbHdheXMgYmUgJ2xlZnQnIHVuaXRzIGF3YXkgZnJvbSB0aGUgbGVmdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxlZnQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWFyZ2luLnggPSB2YWx1ZTtcbiAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgY29uc3Qgd3IgPSB0aGlzLl9hYnNSaWdodDtcbiAgICAgICAgY29uc3Qgd2wgPSB0aGlzLl9sb2NhbEFuY2hvci54ICsgdmFsdWU7XG4gICAgICAgIHRoaXMuX3NldFdpZHRoKHdyIC0gd2wpO1xuXG4gICAgICAgIHAueCA9IHZhbHVlICsgdGhpcy5fY2FsY3VsYXRlZFdpZHRoICogdGhpcy5fcGl2b3QueDtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcbiAgICB9XG5cbiAgICBnZXQgbGVmdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcmdpbi54O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBsZWZ0LCBib3R0b20sIHJpZ2h0IGFuZCB0b3AgZWRnZXMgb2YgdGhlIGFuY2hvci4gRm9yIGV4YW1wbGUgaWYgd2UgYXJlXG4gICAgICogdXNpbmcgYSBzcGxpdCBhbmNob3IgbGlrZSBbMCwwLDEsMV0gYW5kIHRoZSBtYXJnaW4gaXMgWzAsMCwwLDBdIHRoZW4gdGhlIGNvbXBvbmVudCB3aWxsIGJlXG4gICAgICogdGhlIHNhbWUgd2lkdGggYW5kIGhlaWdodCBhcyBpdHMgcGFyZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzR9XG4gICAgICovXG4gICAgc2V0IG1hcmdpbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4uY29weSh2YWx1ZSk7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNpemUodHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0Om1hcmdpbicsIHRoaXMuX21hcmdpbik7XG4gICAgfVxuXG4gICAgZ2V0IG1hcmdpbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcmdpbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGVudGl0eSB0aGF0IGlzIGN1cnJlbnRseSBtYXNraW5nIHRoaXMgZWxlbWVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBnZXQgbWFza2VkQnkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXNrZWRCeTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcG9zaXRpb24gb2YgdGhlIHBpdm90IG9mIHRoZSBjb21wb25lbnQgcmVsYXRpdmUgdG8gaXRzIGFuY2hvci4gRWFjaCB2YWx1ZSByYW5nZXMgZnJvbSAwXG4gICAgICogdG8gMSB3aGVyZSBbMCwwXSBpcyB0aGUgYm90dG9tIGxlZnQgYW5kIFsxLDFdIGlzIHRoZSB0b3AgcmlnaHQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmFwcC5yb290LmZpbmRCeU5hbWUoXCJJbnZlbnRvcnlcIikuZWxlbWVudC5waXZvdCA9IFtNYXRoLnJhbmRvbSgpICogMC4xLCBNYXRoLnJhbmRvbSgpICogMC4xXTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmFwcC5yb290LmZpbmRCeU5hbWUoXCJJbnZlbnRvcnlcIikuZWxlbWVudC5waXZvdCA9IG5ldyBwYy5WZWMyKE1hdGgucmFuZG9tKCkgKiAwLjEsIE1hdGgucmFuZG9tKCkgKiAwLjEpO1xuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzIgfCBudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgcGl2b3QodmFsdWUpIHtcbiAgICAgICAgY29uc3QgeyBwaXZvdCwgbWFyZ2luIH0gPSB0aGlzO1xuICAgICAgICBjb25zdCBwcmV2WCA9IHBpdm90Lng7XG4gICAgICAgIGNvbnN0IHByZXZZID0gcGl2b3QueTtcblxuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBWZWMyKSB7XG4gICAgICAgICAgICBwaXZvdC5jb3B5KHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBpdm90LnNldCguLi52YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBteCA9IG1hcmdpbi54ICsgbWFyZ2luLno7XG4gICAgICAgIGNvbnN0IGR4ID0gcGl2b3QueCAtIHByZXZYO1xuICAgICAgICBtYXJnaW4ueCArPSBteCAqIGR4O1xuICAgICAgICBtYXJnaW4ueiAtPSBteCAqIGR4O1xuXG4gICAgICAgIGNvbnN0IG15ID0gbWFyZ2luLnkgKyBtYXJnaW4udztcbiAgICAgICAgY29uc3QgZHkgPSBwaXZvdC55IC0gcHJldlk7XG4gICAgICAgIG1hcmdpbi55ICs9IG15ICogZHk7XG4gICAgICAgIG1hcmdpbi53IC09IG15ICogZHk7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICB0aGlzLl93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU2l6ZShmYWxzZSwgZmFsc2UpO1xuXG4gICAgICAgIC8vIHdlIG5lZWQgdG8gZmxhZyBjaGlsZHJlbiBhcyBkaXJ0eSB0b29cbiAgICAgICAgLy8gaW4gb3JkZXIgZm9yIHRoZW0gdG8gdXBkYXRlIHRoZWlyIHBvc2l0aW9uXG4gICAgICAgIHRoaXMuX2ZsYWdDaGlsZHJlbkFzRGlydHkoKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDpwaXZvdCcsIHBpdm90KTtcbiAgICB9XG5cbiAgICBnZXQgcGl2b3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9waXZvdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgcmlnaHQgZWRnZSBvZiB0aGUgYW5jaG9yLiBDYW4gYmUgdXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIGEgc3BsaXRcbiAgICAgKiBhbmNob3IgdG8gbWFrZSB0aGUgY29tcG9uZW50J3MgcmlnaHQgZWRnZSBhbHdheXMgYmUgJ3JpZ2h0JyB1bml0cyBhd2F5IGZyb20gdGhlIHJpZ2h0LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcmlnaHQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbWFyZ2luLnogPSB2YWx1ZTtcblxuICAgICAgICAvLyB1cGRhdGUgd2lkdGhcbiAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgY29uc3Qgd2wgPSB0aGlzLl9hYnNMZWZ0O1xuICAgICAgICBjb25zdCB3ciA9IHRoaXMuX2xvY2FsQW5jaG9yLnogLSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fc2V0V2lkdGgod3IgLSB3bCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIHBvc2l0aW9uXG4gICAgICAgIHAueCA9ICh0aGlzLl9sb2NhbEFuY2hvci56IC0gdGhpcy5fbG9jYWxBbmNob3IueCkgLSB2YWx1ZSAtICh0aGlzLl9jYWxjdWxhdGVkV2lkdGggKiAoMSAtIHRoaXMuX3Bpdm90LngpKTtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcbiAgICB9XG5cbiAgICBnZXQgcmlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXJnaW4uejtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiA0IHtAbGluayBWZWMzfXMgdGhhdCByZXByZXNlbnQgdGhlIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCBhbmQgdG9wXG4gICAgICogbGVmdCBjb3JuZXJzIG9mIHRoZSBjb21wb25lbnQgcmVsYXRpdmUgdG8gaXRzIHBhcmVudCB7QGxpbmsgU2NyZWVuQ29tcG9uZW50fS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzW119XG4gICAgICovXG4gICAgZ2V0IHNjcmVlbkNvcm5lcnMoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29ybmVyc0RpcnR5IHx8ICF0aGlzLnNjcmVlbilcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9zY3JlZW5Db3JuZXJzO1xuXG4gICAgICAgIGNvbnN0IHBhcmVudEJvdHRvbUxlZnQgPSB0aGlzLmVudGl0eS5wYXJlbnQgJiYgdGhpcy5lbnRpdHkucGFyZW50LmVsZW1lbnQgJiYgdGhpcy5lbnRpdHkucGFyZW50LmVsZW1lbnQuc2NyZWVuQ29ybmVyc1swXTtcblxuICAgICAgICAvLyBpbml0IGNvcm5lcnNcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVyc1swXS5zZXQodGhpcy5fYWJzTGVmdCwgdGhpcy5fYWJzQm90dG9tLCAwKTtcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVyc1sxXS5zZXQodGhpcy5fYWJzUmlnaHQsIHRoaXMuX2Fic0JvdHRvbSwgMCk7XG4gICAgICAgIHRoaXMuX3NjcmVlbkNvcm5lcnNbMl0uc2V0KHRoaXMuX2Fic1JpZ2h0LCB0aGlzLl9hYnNUb3AsIDApO1xuICAgICAgICB0aGlzLl9zY3JlZW5Db3JuZXJzWzNdLnNldCh0aGlzLl9hYnNMZWZ0LCB0aGlzLl9hYnNUb3AsIDApO1xuXG4gICAgICAgIC8vIHRyYW5zZm9ybSBjb3JuZXJzIHRvIHNjcmVlbiBzcGFjZVxuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IHRoaXMuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX3NjcmVlblRyYW5zZm9ybS50cmFuc2Zvcm1Qb2ludCh0aGlzLl9zY3JlZW5Db3JuZXJzW2ldLCB0aGlzLl9zY3JlZW5Db3JuZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChzY3JlZW5TcGFjZSlcbiAgICAgICAgICAgICAgICB0aGlzLl9zY3JlZW5Db3JuZXJzW2ldLm11bFNjYWxhcih0aGlzLnNjcmVlbi5zY3JlZW4uc2NhbGUpO1xuXG4gICAgICAgICAgICBpZiAocGFyZW50Qm90dG9tTGVmdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NjcmVlbkNvcm5lcnNbaV0uYWRkKHBhcmVudEJvdHRvbUxlZnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY29ybmVyc0RpcnR5ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fc2NyZWVuQ29ybmVycztcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgdGV4dCByZW5kZXJlZCBieSB0aGUgY29tcG9uZW50LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB0ZXh0V2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0ID8gdGhpcy5fdGV4dC53aWR0aCA6IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgdGV4dCByZW5kZXJlZCBieSB0aGUgY29tcG9uZW50LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB0ZXh0SGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGV4dCA/IHRoaXMuX3RleHQuaGVpZ2h0IDogMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdG9wIGVkZ2Ugb2YgdGhlIGFuY2hvci4gQ2FuIGJlIHVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBhIHNwbGl0IGFuY2hvclxuICAgICAqIHRvIG1ha2UgdGhlIGNvbXBvbmVudCdzIGJvdHRvbSBlZGdlIGFsd2F5cyBiZSAnYm90dG9tJyB1bml0cyBhd2F5IGZyb20gdGhlIGJvdHRvbS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHRvcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4udyA9IHZhbHVlO1xuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3YiA9IHRoaXMuX2Fic0JvdHRvbTtcbiAgICAgICAgY29uc3Qgd3QgPSB0aGlzLl9sb2NhbEFuY2hvci53IC0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3NldEhlaWdodCh3dCAtIHdiKTtcblxuICAgICAgICBwLnkgPSAodGhpcy5fbG9jYWxBbmNob3IudyAtIHRoaXMuX2xvY2FsQW5jaG9yLnkpIC0gdmFsdWUgLSB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0ICogKDEgLSB0aGlzLl9waXZvdC55KTtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcbiAgICB9XG5cbiAgICBnZXQgdG9wKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFyZ2luLnc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIEVsZW1lbnRDb21wb25lbnQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEVMRU1FTlRUWVBFX0dST1VQfTogVGhlIGNvbXBvbmVudCBjYW4gYmUgdXNlZCBhcyBhIGxheW91dCBtZWNoYW5pc20gdG8gY3JlYXRlIGdyb3VwcyBvZlxuICAgICAqIEVsZW1lbnRDb21wb25lbnRzIGUuZy4gcGFuZWxzLlxuICAgICAqIC0ge0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfTogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhbiBpbWFnZVxuICAgICAqIC0ge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9OiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIHRleHRcbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IEVMRU1FTlRUWVBFX0lNQUdFKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2UgPSBuZXcgSW1hZ2VFbGVtZW50KHRoaXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gRUxFTUVOVFRZUEVfVEVYVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSBuZXcgVGV4dEVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGVuIHRoZSBjb21wb25lbnQgd2lsbCByZWNlaXZlIE1vdXNlIG9yIFRvdWNoIGlucHV0IGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCB1c2VJbnB1dCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdXNlSW5wdXQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3VzZUlucHV0ID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LmFkZEVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LnJlbW92ZUVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fdXNlSW5wdXQgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKCdFbGVtZW50cyB3aWxsIG5vdCBnZXQgYW55IGlucHV0IGV2ZW50cyBiZWNhdXNlIHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQgaXMgbm90IGNyZWF0ZWQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnVzZUlucHV0JywgdmFsdWUpO1xuICAgIH1cblxuICAgIGdldCB1c2VJbnB1dCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VzZUlucHV0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBob3cgdGhlIGNvbnRlbnQgc2hvdWxkIGJlIGZpdHRlZCBhbmQgcHJlc2VydmUgdGhlIGFzcGVjdCByYXRpbyBvZiB0aGUgc291cmNlIHRleHR1cmUgb3Igc3ByaXRlLlxuICAgICAqIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJVE1PREVfU1RSRVRDSH06IEZpdCB0aGUgY29udGVudCBleGFjdGx5IHRvIEVsZW1lbnQncyBib3VuZGluZyBib3guXG4gICAgICogLSB7QGxpbmsgRklUTU9ERV9DT05UQUlOfTogRml0IHRoZSBjb250ZW50IHdpdGhpbiB0aGUgRWxlbWVudCdzIGJvdW5kaW5nIGJveCB3aGlsZSBwcmVzZXJ2aW5nIGl0cyBBc3BlY3QgUmF0aW8uXG4gICAgICogLSB7QGxpbmsgRklUTU9ERV9DT1ZFUn06IEZpdCB0aGUgY29udGVudCB0byBjb3ZlciB0aGUgZW50aXJlIEVsZW1lbnQncyBib3VuZGluZyBib3ggd2hpbGUgcHJlc2VydmluZyBpdHMgQXNwZWN0IFJhdGlvLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzZXQgZml0TW9kZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9maXRNb2RlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNpemUodHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgdGhpcy5faW1hZ2UucmVmcmVzaE1lc2goKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmaXRNb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZml0TW9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIGVsZW1lbnQgYXMgc2V0IGluIHRoZSBlZGl0b3IuIE5vdGUgdGhhdCBpbiBzb21lIGNhc2VzIHRoaXMgbWF5IG5vdCByZWZsZWN0XG4gICAgICogdGhlIHRydWUgd2lkdGggYXQgd2hpY2ggdGhlIGVsZW1lbnQgaXMgcmVuZGVyZWQsIHN1Y2ggYXMgd2hlbiB0aGUgZWxlbWVudCBpcyB1bmRlciB0aGVcbiAgICAgKiBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gU2VlIGBjYWxjdWxhdGVkV2lkdGhgIGluIG9yZGVyIHRvIGVuc3VyZSB5b3UgYXJlXG4gICAgICogcmVhZGluZyB0aGUgdHJ1ZSB3aWR0aCBhdCB3aGljaCB0aGUgZWxlbWVudCB3aWxsIGJlIHJlbmRlcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgd2lkdGgodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fd2lkdGggPSB2YWx1ZTtcblxuICAgICAgICBpZiAoIXRoaXMuX2hhc1NwbGl0QW5jaG9yc1gpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRXaWR0aCh2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDp3aWR0aCcsIHRoaXMuX3dpZHRoKTtcbiAgICB9XG5cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiA0IHtAbGluayBWZWMzfXMgdGhhdCByZXByZXNlbnQgdGhlIGJvdHRvbSBsZWZ0LCBib3R0b20gcmlnaHQsIHRvcCByaWdodCBhbmQgdG9wXG4gICAgICogbGVmdCBjb3JuZXJzIG9mIHRoZSBjb21wb25lbnQgaW4gd29ybGQgc3BhY2UuIE9ubHkgd29ya3MgZm9yIDNEIGVsZW1lbnQgY29tcG9uZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtWZWMzW119XG4gICAgICovXG4gICAgZ2V0IHdvcmxkQ29ybmVycygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl93b3JsZENvcm5lcnNEaXJ0eSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3dvcmxkQ29ybmVycztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgY29uc3Qgc2NyZWVuQ29ybmVycyA9IHRoaXMuc2NyZWVuQ29ybmVycztcblxuICAgICAgICAgICAgaWYgKCF0aGlzLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgICAgICBtYXRBLmNvcHkodGhpcy5zY3JlZW4uc2NyZWVuLl9zY3JlZW5NYXRyaXgpO1xuXG4gICAgICAgICAgICAgICAgLy8gZmxpcCBzY3JlZW4gbWF0cml4IGFsb25nIHRoZSBob3Jpem9udGFsIGF4aXNcbiAgICAgICAgICAgICAgICBtYXRBLmRhdGFbMTNdID0gLW1hdEEuZGF0YVsxM107XG5cbiAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdHJhbnNmb3JtIHRoYXQgYnJpbmdzIHNjcmVlbiBjb3JuZXJzIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICAgICAgbWF0QS5tdWwyKHRoaXMuc2NyZWVuLmdldFdvcmxkVHJhbnNmb3JtKCksIG1hdEEpO1xuXG4gICAgICAgICAgICAgICAgLy8gdHJhbnNmb3JtIHNjcmVlbiBjb3JuZXJzIHRvIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWF0QS50cmFuc2Zvcm1Qb2ludChzY3JlZW5Db3JuZXJzW2ldLCB0aGlzLl93b3JsZENvcm5lcnNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGxvY2FsUG9zID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuXG4gICAgICAgICAgICAvLyByb3RhdGUgYW5kIHNjYWxlIGFyb3VuZCBwaXZvdFxuICAgICAgICAgICAgbWF0QS5zZXRUcmFuc2xhdGUoLWxvY2FsUG9zLngsIC1sb2NhbFBvcy55LCAtbG9jYWxQb3Mueik7XG4gICAgICAgICAgICBtYXRCLnNldFRSUyhWZWMzLlpFUk8sIHRoaXMuZW50aXR5LmdldExvY2FsUm90YXRpb24oKSwgdGhpcy5lbnRpdHkuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgIG1hdEMuc2V0VHJhbnNsYXRlKGxvY2FsUG9zLngsIGxvY2FsUG9zLnksIGxvY2FsUG9zLnopO1xuXG4gICAgICAgICAgICAvLyBnZXQgcGFyZW50IHdvcmxkIHRyYW5zZm9ybSAoYnV0IHVzZSB0aGlzIGVudGl0eSBpZiB0aGVyZSBpcyBubyBwYXJlbnQpXG4gICAgICAgICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmVudGl0eS5wYXJlbnQgPyB0aGlzLmVudGl0eS5wYXJlbnQgOiB0aGlzLmVudGl0eTtcbiAgICAgICAgICAgIG1hdEQuY29weShlbnRpdHkuZ2V0V29ybGRUcmFuc2Zvcm0oKSk7XG4gICAgICAgICAgICBtYXRELm11bChtYXRDKS5tdWwobWF0QikubXVsKG1hdEEpO1xuXG4gICAgICAgICAgICAvLyBib3R0b20gbGVmdFxuICAgICAgICAgICAgdmVjQS5zZXQobG9jYWxQb3MueCAtIHRoaXMucGl2b3QueCAqIHRoaXMuY2FsY3VsYXRlZFdpZHRoLCBsb2NhbFBvcy55IC0gdGhpcy5waXZvdC55ICogdGhpcy5jYWxjdWxhdGVkSGVpZ2h0LCBsb2NhbFBvcy56KTtcbiAgICAgICAgICAgIG1hdEQudHJhbnNmb3JtUG9pbnQodmVjQSwgdGhpcy5fd29ybGRDb3JuZXJzWzBdKTtcblxuICAgICAgICAgICAgLy8gYm90dG9tIHJpZ2h0XG4gICAgICAgICAgICB2ZWNBLnNldChsb2NhbFBvcy54ICsgKDEgLSB0aGlzLnBpdm90LngpICogdGhpcy5jYWxjdWxhdGVkV2lkdGgsIGxvY2FsUG9zLnkgLSB0aGlzLnBpdm90LnkgKiB0aGlzLmNhbGN1bGF0ZWRIZWlnaHQsIGxvY2FsUG9zLnopO1xuICAgICAgICAgICAgbWF0RC50cmFuc2Zvcm1Qb2ludCh2ZWNBLCB0aGlzLl93b3JsZENvcm5lcnNbMV0pO1xuXG4gICAgICAgICAgICAvLyB0b3AgcmlnaHRcbiAgICAgICAgICAgIHZlY0Euc2V0KGxvY2FsUG9zLnggKyAoMSAtIHRoaXMucGl2b3QueCkgKiB0aGlzLmNhbGN1bGF0ZWRXaWR0aCwgbG9jYWxQb3MueSArICgxIC0gdGhpcy5waXZvdC55KSAqIHRoaXMuY2FsY3VsYXRlZEhlaWdodCwgbG9jYWxQb3Mueik7XG4gICAgICAgICAgICBtYXRELnRyYW5zZm9ybVBvaW50KHZlY0EsIHRoaXMuX3dvcmxkQ29ybmVyc1syXSk7XG5cbiAgICAgICAgICAgIC8vIHRvcCBsZWZ0XG4gICAgICAgICAgICB2ZWNBLnNldChsb2NhbFBvcy54IC0gdGhpcy5waXZvdC54ICogdGhpcy5jYWxjdWxhdGVkV2lkdGgsIGxvY2FsUG9zLnkgKyAoMSAtIHRoaXMucGl2b3QueSkgKiB0aGlzLmNhbGN1bGF0ZWRIZWlnaHQsIGxvY2FsUG9zLnopO1xuICAgICAgICAgICAgbWF0RC50cmFuc2Zvcm1Qb2ludCh2ZWNBLCB0aGlzLl93b3JsZENvcm5lcnNbM10pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fd29ybGRDb3JuZXJzRGlydHkgPSBmYWxzZTtcblxuICAgICAgICByZXR1cm4gdGhpcy5fd29ybGRDb3JuZXJzO1xuXG4gICAgfVxuXG4gICAgX3BhdGNoKCkge1xuICAgICAgICB0aGlzLmVudGl0eS5fc3luYyA9IHRoaXMuX3N5bmM7XG4gICAgICAgIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uID0gdGhpcy5fc2V0UG9zaXRpb247XG4gICAgICAgIHRoaXMuZW50aXR5LnNldExvY2FsUG9zaXRpb24gPSB0aGlzLl9zZXRMb2NhbFBvc2l0aW9uO1xuICAgIH1cblxuICAgIF91bnBhdGNoKCkge1xuICAgICAgICB0aGlzLmVudGl0eS5fc3luYyA9IEVudGl0eS5wcm90b3R5cGUuX3N5bmM7XG4gICAgICAgIHRoaXMuZW50aXR5LnNldFBvc2l0aW9uID0gRW50aXR5LnByb3RvdHlwZS5zZXRQb3NpdGlvbjtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbiA9IEVudGl0eS5wcm90b3R5cGUuc2V0TG9jYWxQb3NpdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXRjaGVkIG1ldGhvZCBmb3Igc2V0dGluZyB0aGUgcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxWZWMzfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvciBWZWMzXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgeiBjb29yZGluYXRlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0UG9zaXRpb24oeCwgeSwgeikge1xuICAgICAgICBpZiAoIXRoaXMuZWxlbWVudC5zY3JlZW4pIHtcbiAgICAgICAgICAgIEVudGl0eS5wcm90b3R5cGUuc2V0UG9zaXRpb24uY2FsbCh0aGlzLCB4LCB5LCB6KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgcG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uLnNldCh4LCB5LCB6KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ2V0V29ybGRUcmFuc2Zvcm0oKTsgLy8gZW5zdXJlIGhpZXJhcmNoeSBpcyB1cCB0byBkYXRlXG4gICAgICAgIGludlBhcmVudFd0bS5jb3B5KHRoaXMuZWxlbWVudC5fc2NyZWVuVG9Xb3JsZCkuaW52ZXJ0KCk7XG4gICAgICAgIGludlBhcmVudFd0bS50cmFuc2Zvcm1Qb2ludChwb3NpdGlvbiwgdGhpcy5sb2NhbFBvc2l0aW9uKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXRjaGVkIG1ldGhvZCBmb3Igc2V0dGluZyB0aGUgbG9jYWwgcG9zaXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcnxWZWMzfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvciBWZWMzXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHogLSBUaGUgeiBjb29yZGluYXRlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0TG9jYWxQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICh4IGluc3RhbmNlb2YgVmVjMykge1xuICAgICAgICAgICAgdGhpcy5sb2NhbFBvc2l0aW9uLmNvcHkoeCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdXBkYXRlIG1hcmdpblxuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50O1xuICAgICAgICBjb25zdCBwID0gdGhpcy5sb2NhbFBvc2l0aW9uO1xuICAgICAgICBjb25zdCBwdnQgPSBlbGVtZW50Ll9waXZvdDtcbiAgICAgICAgZWxlbWVudC5fbWFyZ2luLnggPSBwLnggLSBlbGVtZW50Ll9jYWxjdWxhdGVkV2lkdGggKiBwdnQueDtcbiAgICAgICAgZWxlbWVudC5fbWFyZ2luLnogPSAoZWxlbWVudC5fbG9jYWxBbmNob3IueiAtIGVsZW1lbnQuX2xvY2FsQW5jaG9yLngpIC0gZWxlbWVudC5fY2FsY3VsYXRlZFdpZHRoIC0gZWxlbWVudC5fbWFyZ2luLng7XG4gICAgICAgIGVsZW1lbnQuX21hcmdpbi55ID0gcC55IC0gZWxlbWVudC5fY2FsY3VsYXRlZEhlaWdodCAqIHB2dC55O1xuICAgICAgICBlbGVtZW50Ll9tYXJnaW4udyA9IChlbGVtZW50Ll9sb2NhbEFuY2hvci53IC0gZWxlbWVudC5fbG9jYWxBbmNob3IueSkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0IC0gZWxlbWVudC5fbWFyZ2luLnk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9kaXJ0eUxvY2FsKVxuICAgICAgICAgICAgdGhpcy5fZGlydGlmeUxvY2FsKCk7XG4gICAgfVxuXG4gICAgLy8gdGhpcyBtZXRob2Qgb3ZlcndyaXRlcyBHcmFwaE5vZGUjc3luYyBhbmQgc28gb3BlcmF0ZXMgaW4gc2NvcGUgb2YgdGhlIEVudGl0eS5cbiAgICBfc3luYygpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuZWxlbWVudDtcbiAgICAgICAgY29uc3Qgc2NyZWVuID0gZWxlbWVudC5zY3JlZW47XG5cbiAgICAgICAgaWYgKHNjcmVlbikge1xuXG4gICAgICAgICAgICBpZiAoZWxlbWVudC5fYW5jaG9yRGlydHkpIHtcbiAgICAgICAgICAgICAgICBsZXQgcmVzeCA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IHJlc3kgPSAwO1xuICAgICAgICAgICAgICAgIGxldCBweCA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IHB5ID0gMTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9wYXJlbnQgJiYgdGhpcy5fcGFyZW50LmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNlIHBhcmVudCByZWN0XG4gICAgICAgICAgICAgICAgICAgIHJlc3ggPSB0aGlzLl9wYXJlbnQuZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgICAgICAgICAgICAgIHJlc3kgPSB0aGlzLl9wYXJlbnQuZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICBweCA9IHRoaXMuX3BhcmVudC5lbGVtZW50LnBpdm90Lng7XG4gICAgICAgICAgICAgICAgICAgIHB5ID0gdGhpcy5fcGFyZW50LmVsZW1lbnQucGl2b3QueTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyB1c2Ugc2NyZWVuIHJlY3RcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IHNjcmVlbi5zY3JlZW4ucmVzb2x1dGlvbjtcbiAgICAgICAgICAgICAgICAgICAgcmVzeCA9IHJlc29sdXRpb24ueCAvIHNjcmVlbi5zY3JlZW4uc2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIHJlc3kgPSByZXNvbHV0aW9uLnkgLyBzY3JlZW4uc2NyZWVuLnNjYWxlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2FuY2hvclRyYW5zZm9ybS5zZXRUcmFuc2xhdGUoKHJlc3ggKiAoZWxlbWVudC5hbmNob3IueCAtIHB4KSksIC0ocmVzeSAqIChweSAtIGVsZW1lbnQuYW5jaG9yLnkpKSwgMCk7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5fYW5jaG9yRGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBlbGVtZW50Ll9jYWxjdWxhdGVMb2NhbEFuY2hvcnMoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgZWxlbWVudCBzaXplIGlzIGRpcnR5XG4gICAgICAgICAgICAvLyByZWNhbGN1bGF0ZSBpdHMgc2l6ZVxuICAgICAgICAgICAgLy8gV0FSTklORzogT3JkZXIgaXMgaW1wb3J0YW50IGFzIGNhbGN1bGF0ZVNpemUgcmVzZXRzIGRpcnR5TG9jYWxcbiAgICAgICAgICAgIC8vIHNvIHRoaXMgbmVlZHMgdG8gcnVuIGJlZm9yZSByZXNldHRpbmcgZGlydHlMb2NhbCB0byBmYWxzZSBiZWxvd1xuICAgICAgICAgICAgaWYgKGVsZW1lbnQuX3NpemVEaXJ0eSkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2NhbGN1bGF0ZVNpemUoZmFsc2UsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eUxvY2FsKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsVHJhbnNmb3JtLnNldFRSUyh0aGlzLmxvY2FsUG9zaXRpb24sIHRoaXMubG9jYWxSb3RhdGlvbiwgdGhpcy5sb2NhbFNjYWxlKTtcblxuICAgICAgICAgICAgLy8gdXBkYXRlIG1hcmdpblxuICAgICAgICAgICAgY29uc3QgcCA9IHRoaXMubG9jYWxQb3NpdGlvbjtcbiAgICAgICAgICAgIGNvbnN0IHB2dCA9IGVsZW1lbnQuX3Bpdm90O1xuICAgICAgICAgICAgZWxlbWVudC5fbWFyZ2luLnggPSBwLnggLSBlbGVtZW50Ll9jYWxjdWxhdGVkV2lkdGggKiBwdnQueDtcbiAgICAgICAgICAgIGVsZW1lbnQuX21hcmdpbi56ID0gKGVsZW1lbnQuX2xvY2FsQW5jaG9yLnogLSBlbGVtZW50Ll9sb2NhbEFuY2hvci54KSAtIGVsZW1lbnQuX2NhbGN1bGF0ZWRXaWR0aCAtIGVsZW1lbnQuX21hcmdpbi54O1xuICAgICAgICAgICAgZWxlbWVudC5fbWFyZ2luLnkgPSBwLnkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0ICogcHZ0Lnk7XG4gICAgICAgICAgICBlbGVtZW50Ll9tYXJnaW4udyA9IChlbGVtZW50Ll9sb2NhbEFuY2hvci53IC0gZWxlbWVudC5fbG9jYWxBbmNob3IueSkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0IC0gZWxlbWVudC5fbWFyZ2luLnk7XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TG9jYWwgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2NyZWVuKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fZGlydHlXb3JsZCkge1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5fY2FudmFzQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBlbGVtZW50Ll93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBFbnRpdHkucHJvdG90eXBlLl9zeW5jLmNhbGwodGhpcyk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmICh0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fcGFyZW50ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5jb3B5KHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB0cmFuc2Zvcm0gZWxlbWVudCBoaWVyYXJjaHlcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fcGFyZW50LmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5fc2NyZWVuVG9Xb3JsZC5tdWwyKHRoaXMuX3BhcmVudC5lbGVtZW50Ll9tb2RlbFRyYW5zZm9ybSwgZWxlbWVudC5fYW5jaG9yVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkLmNvcHkoZWxlbWVudC5fYW5jaG9yVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlbGVtZW50Ll9tb2RlbFRyYW5zZm9ybS5tdWwyKGVsZW1lbnQuX3NjcmVlblRvV29ybGQsIHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjcmVlbikge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkLm11bDIoc2NyZWVuLnNjcmVlbi5fc2NyZWVuTWF0cml4LCBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX3NjcmVlblRvV29ybGQubXVsMihzY3JlZW4ud29ybGRUcmFuc2Zvcm0sIGVsZW1lbnQuX3NjcmVlblRvV29ybGQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5tdWwyKGVsZW1lbnQuX3NjcmVlblRvV29ybGQsIHRoaXMubG9jYWxUcmFuc2Zvcm0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBwYXJlbnQgd29ybGQgdHJhbnNmb3JtXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudFdvcmxkVHJhbnNmb3JtID0gZWxlbWVudC5fcGFyZW50V29ybGRUcmFuc2Zvcm07XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFdvcmxkVHJhbnNmb3JtLnNldElkZW50aXR5KCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuX3BhcmVudDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhcmVudCAmJiBwYXJlbnQuZWxlbWVudCAmJiBwYXJlbnQgIT09IHNjcmVlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0QS5zZXRUUlMoVmVjMy5aRVJPLCBwYXJlbnQuZ2V0TG9jYWxSb3RhdGlvbigpLCBwYXJlbnQuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFdvcmxkVHJhbnNmb3JtLm11bDIocGFyZW50LmVsZW1lbnQuX3BhcmVudFdvcmxkVHJhbnNmb3JtLCBtYXRBKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBlbGVtZW50IHRyYW5zZm9ybVxuICAgICAgICAgICAgICAgICAgICAvLyByb3RhdGUgYW5kIHNjYWxlIGFyb3VuZCBwaXZvdFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXB0aE9mZnNldCA9IHZlY0E7XG4gICAgICAgICAgICAgICAgICAgIGRlcHRoT2Zmc2V0LnNldCgwLCAwLCB0aGlzLmxvY2FsUG9zaXRpb24ueik7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGl2b3RPZmZzZXQgPSB2ZWNCO1xuICAgICAgICAgICAgICAgICAgICBwaXZvdE9mZnNldC5zZXQoZWxlbWVudC5fYWJzTGVmdCArIGVsZW1lbnQuX3Bpdm90LnggKiBlbGVtZW50LmNhbGN1bGF0ZWRXaWR0aCwgZWxlbWVudC5fYWJzQm90dG9tICsgZWxlbWVudC5fcGl2b3QueSAqIGVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodCwgMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgbWF0QS5zZXRUcmFuc2xhdGUoLXBpdm90T2Zmc2V0LngsIC1waXZvdE9mZnNldC55LCAtcGl2b3RPZmZzZXQueik7XG4gICAgICAgICAgICAgICAgICAgIG1hdEIuc2V0VFJTKGRlcHRoT2Zmc2V0LCB0aGlzLmdldExvY2FsUm90YXRpb24oKSwgdGhpcy5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgICAgICAgICBtYXRDLnNldFRyYW5zbGF0ZShwaXZvdE9mZnNldC54LCBwaXZvdE9mZnNldC55LCBwaXZvdE9mZnNldC56KTtcblxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5UcmFuc2Zvcm0ubXVsMihlbGVtZW50Ll9wYXJlbnRXb3JsZFRyYW5zZm9ybSwgbWF0QykubXVsKG1hdEIpLm11bChtYXRBKTtcblxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9jb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9jYW52YXNDb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll93b3JsZENvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53b3JsZFRyYW5zZm9ybS5jb3B5KGVsZW1lbnQuX21vZGVsVHJhbnNmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2RpcnR5V29ybGQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkluc2VydChwYXJlbnQpIHtcbiAgICAgICAgLy8gd2hlbiB0aGUgZW50aXR5IGlzIHJlcGFyZW50ZWQgZmluZCBhIHBvc3NpYmxlIG5ldyBzY3JlZW4gYW5kIG1hc2tcblxuICAgICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9wYXJzZVVwVG9TY3JlZW4oKTtcblxuICAgICAgICB0aGlzLmVudGl0eS5fZGlydGlmeVdvcmxkKCk7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlU2NyZWVuKHJlc3VsdC5zY3JlZW4pO1xuXG4gICAgICAgIHRoaXMuX2RpcnRpZnlNYXNrKCk7XG4gICAgfVxuXG4gICAgX2RpcnRpZnlNYXNrKCkge1xuICAgICAgICBsZXQgY3VycmVudCA9IHRoaXMuZW50aXR5O1xuICAgICAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgICAgICAgLy8gc2VhcmNoIHVwIHRoZSBoaWVyYXJjaHkgdW50aWwgd2UgZmluZCBhbiBlbnRpdHkgd2hpY2ggaGFzOlxuICAgICAgICAgICAgLy8gLSBubyBwYXJlbnRcbiAgICAgICAgICAgIC8vIC0gc2NyZWVuIGNvbXBvbmVudCBvbiBwYXJlbnRcbiAgICAgICAgICAgIGNvbnN0IG5leHQgPSBjdXJyZW50LnBhcmVudDtcbiAgICAgICAgICAgIGlmICgobmV4dCA9PT0gbnVsbCB8fCBuZXh0LnNjcmVlbikgJiYgY3VycmVudC5lbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLnN5c3RlbS5fcHJlcmVuZGVyIHx8ICF0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyID0gW107XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5vbmNlKCdwcmVyZW5kZXInLCB0aGlzLl9vblByZXJlbmRlciwgdGhpcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykgY29uc29sZS5sb2coJ3JlZ2lzdGVyIHByZXJlbmRlcicpO1xuICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgaSA9IHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIuaW5kZXhPZih0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICAgICAgaWYgKGkgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgaiA9IHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIuaW5kZXhPZihjdXJyZW50KTtcbiAgICAgICAgICAgICAgICBpZiAoaiA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uX3ByZXJlbmRlci5wdXNoKGN1cnJlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIGNvbnNvbGUubG9nKCdzZXQgcHJlcmVuZGVyIHJvb3QgdG86ICcgKyBjdXJyZW50Lm5hbWUpO1xuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjdXJyZW50ID0gbmV4dDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblByZXJlbmRlcigpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtYXNrID0gdGhpcy5zeXN0ZW0uX3ByZXJlbmRlcltpXTtcbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIGlmIChfZGVidWdMb2dnaW5nKSBjb25zb2xlLmxvZygncHJlcmVuZGVyIGZyb206ICcgKyBtYXNrLm5hbWUpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIC8vIHByZXZlbnQgY2FsbCBpZiBlbGVtZW50IGhhcyBiZWVuIHJlbW92ZWQgc2luY2UgYmVpbmcgYWRkZWRcbiAgICAgICAgICAgIGlmIChtYXNrLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXB0aCA9IDE7XG4gICAgICAgICAgICAgICAgbWFzay5lbGVtZW50LnN5bmNNYXNrKGRlcHRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICBfYmluZFNjcmVlbihzY3JlZW4pIHtcbiAgICAgICAgLy8gQmluZCB0aGUgRWxlbWVudCB0byB0aGUgU2NyZWVuLiBXZSB1c2VkIHRvIHN1YnNjcmliZSB0byBTY3JlZW4gZXZlbnRzIGhlcmUuIEhvd2V2ZXIsXG4gICAgICAgIC8vIHRoYXQgd2FzIHZlcnkgc2xvdyB3aGVuIHRoZXJlIGFyZSB0aG91c2FuZHMgb2YgRWxlbWVudHMuIFdoZW4gdGhlIHRpbWUgY29tZXMgdG8gdW5iaW5kXG4gICAgICAgIC8vIHRoZSBFbGVtZW50IGZyb20gdGhlIFNjcmVlbiwgZmluZGluZyB0aGUgZXZlbnQgY2FsbGJhY2tzIHRvIHJlbW92ZSB0YWtlcyBhIGNvbnNpZGVyYWJsZVxuICAgICAgICAvLyBhbW91bnQgb2YgdGltZS4gU28gaW5zdGVhZCwgdGhlIFNjcmVlbiBzdG9yZXMgdGhlIEVsZW1lbnQgY29tcG9uZW50IGFuZCBjYWxscyBpdHNcbiAgICAgICAgLy8gZnVuY3Rpb25zIGRpcmVjdGx5LlxuICAgICAgICBzY3JlZW4uX2JpbmRFbGVtZW50KHRoaXMpO1xuICAgIH1cblxuICAgIF91bmJpbmRTY3JlZW4oc2NyZWVuKSB7XG4gICAgICAgIHNjcmVlbi5fdW5iaW5kRWxlbWVudCh0aGlzKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlU2NyZWVuKHNjcmVlbikge1xuICAgICAgICBpZiAodGhpcy5zY3JlZW4gJiYgdGhpcy5zY3JlZW4gIT09IHNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fdW5iaW5kU2NyZWVuKHRoaXMuc2NyZWVuLnNjcmVlbik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcmV2aW91c1NjcmVlbiA9IHRoaXMuc2NyZWVuO1xuICAgICAgICB0aGlzLnNjcmVlbiA9IHNjcmVlbjtcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl9iaW5kU2NyZWVuKHRoaXMuc2NyZWVuLnNjcmVlbik7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTaXplKHRoaXMuX2hhc1NwbGl0QW5jaG9yc1gsIHRoaXMuX2hhc1NwbGl0QW5jaG9yc1kpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnNjcmVlbicsIHRoaXMuc2NyZWVuLCBwcmV2aW91c1NjcmVlbik7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBhbGwgY2hpbGQgc2NyZWVuc1xuICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuZW50aXR5LmNoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldLmVsZW1lbnQpIGNoaWxkcmVuW2ldLmVsZW1lbnQuX3VwZGF0ZVNjcmVlbihzY3JlZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIGRyYXcgb3JkZXJcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB0aGlzLnNjcmVlbi5zY3JlZW4uc3luY0RyYXdPcmRlcigpO1xuICAgIH1cblxuICAgIHN5bmNNYXNrKGRlcHRoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX3BhcnNlVXBUb1NjcmVlbigpO1xuICAgICAgICB0aGlzLl91cGRhdGVNYXNrKHJlc3VsdC5tYXNrLCBkZXB0aCk7XG4gICAgfVxuXG4gICAgLy8gc2V0IHRoZSBtYXNrZWRieSBwcm9wZXJ0eSB0byB0aGUgZW50aXR5IHRoYXQgaXMgbWFza2luZyB0aGlzIGVsZW1lbnRcbiAgICAvLyAtIHNldCB0aGUgc3RlbmNpbCBidWZmZXIgdG8gY2hlY2sgdGhlIG1hc2sgdmFsdWVcbiAgICAvLyAgIHNvIGFzIHRvIG9ubHkgcmVuZGVyIGluc2lkZSB0aGUgbWFza1xuICAgIC8vICAgTm90ZTogaWYgdGhpcyBlbnRpdHkgaXMgaXRzZWxmIGEgbWFzayB0aGUgc3RlbmNpbCBwYXJhbXNcbiAgICAvLyAgIHdpbGwgYmUgdXBkYXRlZCBpbiB1cGRhdGVNYXNrIHRvIGluY2x1ZGUgbWFza2luZ1xuICAgIF9zZXRNYXNrZWRCeShtYXNrKSB7XG4gICAgICAgIGNvbnN0IHJlbmRlcmFibGVFbGVtZW50ID0gdGhpcy5faW1hZ2UgfHwgdGhpcy5fdGV4dDtcblxuICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgY29uc3QgcmVmID0gbWFzay5lbGVtZW50Ll9pbWFnZS5fbWFza1JlZjtcbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIGlmIChfZGVidWdMb2dnaW5nKSBjb25zb2xlLmxvZygnbWFza2luZzogJyArIHRoaXMuZW50aXR5Lm5hbWUgKyAnIHdpdGggJyArIHJlZik7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgY29uc3Qgc3AgPSBuZXcgU3RlbmNpbFBhcmFtZXRlcnMoe1xuICAgICAgICAgICAgICAgIHJlZjogcmVmLFxuICAgICAgICAgICAgICAgIGZ1bmM6IEZVTkNfRVFVQUxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGltYWdlIG9yIHRleHQsIHNldCB0aGUgc3RlbmNpbCBwYXJhbWV0ZXJzXG4gICAgICAgICAgICBpZiAocmVuZGVyYWJsZUVsZW1lbnQgJiYgcmVuZGVyYWJsZUVsZW1lbnQuX3NldFN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJhYmxlRWxlbWVudC5fc2V0U3RlbmNpbChzcCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX21hc2tlZEJ5ID0gbWFzaztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgIGlmIChfZGVidWdMb2dnaW5nKSBjb25zb2xlLmxvZygnbm8gbWFza2luZyBvbjogJyArIHRoaXMuZW50aXR5Lm5hbWUpO1xuICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBzdGVuY2lsIHBhcmFtcyBpZiB0aGlzIGlzIGltYWdlIG9yIHRleHRcbiAgICAgICAgICAgIGlmIChyZW5kZXJhYmxlRWxlbWVudCAmJiByZW5kZXJhYmxlRWxlbWVudC5fc2V0U3RlbmNpbCkge1xuICAgICAgICAgICAgICAgIHJlbmRlcmFibGVFbGVtZW50Ll9zZXRTdGVuY2lsKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbWFza2VkQnkgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmVjdXJzaXZlbHkgdXBkYXRlIGVudGl0eSdzIHN0ZW5jaWwgcGFyYW1zXG4gICAgLy8gdG8gcmVuZGVyIHRoZSBjb3JyZWN0IHZhbHVlIGludG8gdGhlIHN0ZW5jaWwgYnVmZmVyXG4gICAgX3VwZGF0ZU1hc2soY3VycmVudE1hc2ssIGRlcHRoKSB7XG4gICAgICAgIGlmIChjdXJyZW50TWFzaykge1xuICAgICAgICAgICAgdGhpcy5fc2V0TWFza2VkQnkoY3VycmVudE1hc2spO1xuXG4gICAgICAgICAgICAvLyB0aGlzIGVsZW1lbnQgaXMgYWxzbyBtYXNraW5nIG90aGVyc1xuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZiA9IGN1cnJlbnRNYXNrLmVsZW1lbnQuX2ltYWdlLl9tYXNrUmVmO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNwID0gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgcmVmOiByZWYsXG4gICAgICAgICAgICAgICAgICAgIGZ1bmM6IEZVTkNfRVFVQUwsXG4gICAgICAgICAgICAgICAgICAgIHpwYXNzOiBTVEVOQ0lMT1BfSU5DUkVNRU5UXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2UuX3NldFN0ZW5jaWwoc3ApO1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlLl9tYXNrUmVmID0gZGVwdGg7XG5cbiAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgY291bnRlciB0byBjb3VudCBtYXNrIGRlcHRoXG4gICAgICAgICAgICAgICAgZGVwdGgrKztcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnbWFza2luZyBmcm9tOiAnICsgdGhpcy5lbnRpdHkubmFtZSArICcgd2l0aCAnICsgKHNwLnJlZiArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2RlcHRoKysgdG86ICcsIGRlcHRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBjdXJyZW50TWFzayA9IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZWN1cnNlIHRocm91Z2ggYWxsIGNoaWxkcmVuXG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuZW50aXR5LmNoaWxkcmVuO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW5baV0uZWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbltpXS5lbGVtZW50Ll91cGRhdGVNYXNrKGN1cnJlbnRNYXNrLCBkZXB0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiBtYXNrIGNvdW50ZXIgd2FzIGluY3JlYXNlZCwgZGVjcmVtZW50IGl0IGFzIHdlIGNvbWUgYmFjayB1cCB0aGUgaGllcmFyY2h5XG4gICAgICAgICAgICBpZiAodGhpcy5tYXNrKSBkZXB0aC0tO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjbGVhcmluZyBtYXNrXG4gICAgICAgICAgICB0aGlzLl9zZXRNYXNrZWRCeShudWxsKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNwID0gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKHtcbiAgICAgICAgICAgICAgICAgICAgcmVmOiBkZXB0aCxcbiAgICAgICAgICAgICAgICAgICAgZnVuYzogRlVOQ19BTFdBWVMsXG4gICAgICAgICAgICAgICAgICAgIHpwYXNzOiBTVEVOQ0lMT1BfUkVQTEFDRVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlLl9zZXRTdGVuY2lsKHNwKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZS5fbWFza1JlZiA9IGRlcHRoO1xuXG4gICAgICAgICAgICAgICAgLy8gaW5jcmVtZW50IG1hc2sgY291bnRlciB0byBjb3VudCBkZXB0aCBvZiBtYXNrc1xuICAgICAgICAgICAgICAgIGRlcHRoKys7XG5cbiAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ21hc2tpbmcgZnJvbTogJyArIHRoaXMuZW50aXR5Lm5hbWUgKyAnIHdpdGggJyArIHNwLnJlZik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdkZXB0aCsrIHRvOiAnLCBkZXB0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgY3VycmVudE1hc2sgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVjdXJzZSB0aHJvdWdoIGFsbCBjaGlsZHJlblxuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSB0aGlzLmVudGl0eS5jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuW2ldLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW5baV0uZWxlbWVudC5fdXBkYXRlTWFzayhjdXJyZW50TWFzaywgZGVwdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZGVjcmVtZW50IG1hc2sgY291bnRlciBhcyB3ZSBjb21lIGJhY2sgdXAgdGhlIGhpZXJhcmNoeVxuICAgICAgICAgICAgaWYgKHRoaXMubWFzaykgZGVwdGgtLTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNlYXJjaCB1cCB0aGUgcGFyZW50IGhpZXJhcmNoeSB1bnRpbCB3ZSByZWFjaCBhIHNjcmVlblxuICAgIC8vIHRoaXMgc2NyZWVuIGlzIHRoZSBwYXJlbnQgc2NyZWVuXG4gICAgLy8gYWxzbyBzZWFyY2hlcyBmb3IgbWFza2VkIGVsZW1lbnRzIHRvIGdldCB0aGUgcmVsZXZhbnQgbWFza1xuICAgIF9wYXJzZVVwVG9TY3JlZW4oKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgIHNjcmVlbjogbnVsbCxcbiAgICAgICAgICAgIG1hc2s6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICBsZXQgcGFyZW50ID0gdGhpcy5lbnRpdHkuX3BhcmVudDtcblxuICAgICAgICB3aGlsZSAocGFyZW50ICYmICFwYXJlbnQuc2NyZWVuKSB7XG4gICAgICAgICAgICBpZiAocGFyZW50LmVsZW1lbnQgJiYgcGFyZW50LmVsZW1lbnQubWFzaykge1xuICAgICAgICAgICAgICAgIC8vIG1hc2sgZW50aXR5XG4gICAgICAgICAgICAgICAgaWYgKCFyZXN1bHQubWFzaykgcmVzdWx0Lm1hc2sgPSBwYXJlbnQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcmVudCAmJiBwYXJlbnQuc2NyZWVuKSByZXN1bHQuc2NyZWVuID0gcGFyZW50O1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgX29uU2NyZWVuUmVzaXplKHJlcykge1xuICAgICAgICB0aGlzLl9hbmNob3JEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTaXplKHRoaXMuX2hhc1NwbGl0QW5jaG9yc1gsIHRoaXMuX2hhc1NwbGl0QW5jaG9yc1kpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc2NyZWVuOnNldDpyZXNvbHV0aW9uJywgcmVzKTtcbiAgICB9XG5cbiAgICBfb25TY3JlZW5TcGFjZUNoYW5nZSgpIHtcbiAgICAgICAgdGhpcy5maXJlKCdzY3JlZW46c2V0OnNjcmVlbnNwYWNlJywgdGhpcy5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlKTtcbiAgICB9XG5cbiAgICBfb25TY3JlZW5SZW1vdmUoKSB7XG4gICAgICAgIGlmICh0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgaWYgKHRoaXMuc2NyZWVuLl9kZXN0cm95aW5nKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIHNjcmVlbiBlbnRpdHkgaXMgYmVpbmcgZGVzdHJveWVkLCB3ZSBkb24ndCBjYWxsXG4gICAgICAgICAgICAgICAgLy8gX3VwZGF0ZVNjcmVlbigpIGFzIGFuIG9wdGltaXphdGlvbiBidXQgd2Ugc2hvdWxkIHN0aWxsXG4gICAgICAgICAgICAgICAgLy8gc2V0IGl0IHRvIG51bGwgdG8gY2xlYW4gdXAgZGFuZ2xpbmcgcmVmZXJlbmNlc1xuICAgICAgICAgICAgICAgIHRoaXMuc2NyZWVuID0gbnVsbDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlU2NyZWVuKG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc3RvcmUgcGl4ZWwgcG9zaXRpb25zIG9mIGFuY2hvciByZWxhdGl2ZSB0byBjdXJyZW50IHBhcmVudCByZXNvbHV0aW9uXG4gICAgX2NhbGN1bGF0ZUxvY2FsQW5jaG9ycygpIHtcbiAgICAgICAgbGV0IHJlc3ggPSAxMDAwO1xuICAgICAgICBsZXQgcmVzeSA9IDEwMDA7XG4gICAgICAgIGNvbnN0IHBhcmVudCA9IHRoaXMuZW50aXR5Ll9wYXJlbnQ7XG4gICAgICAgIGlmIChwYXJlbnQgJiYgcGFyZW50LmVsZW1lbnQpIHtcbiAgICAgICAgICAgIHJlc3ggPSBwYXJlbnQuZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgICAgICByZXN5ID0gcGFyZW50LmVsZW1lbnQuY2FsY3VsYXRlZEhlaWdodDtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNjcmVlbikge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gdGhpcy5zY3JlZW4uc2NyZWVuLnJlc29sdXRpb247XG4gICAgICAgICAgICBjb25zdCBzY2FsZSA9IHRoaXMuc2NyZWVuLnNjcmVlbi5zY2FsZTtcbiAgICAgICAgICAgIHJlc3ggPSByZXMueCAvIHNjYWxlO1xuICAgICAgICAgICAgcmVzeSA9IHJlcy55IC8gc2NhbGU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2NhbEFuY2hvci5zZXQoXG4gICAgICAgICAgICB0aGlzLl9hbmNob3IueCAqIHJlc3gsXG4gICAgICAgICAgICB0aGlzLl9hbmNob3IueSAqIHJlc3ksXG4gICAgICAgICAgICB0aGlzLl9hbmNob3IueiAqIHJlc3gsXG4gICAgICAgICAgICB0aGlzLl9hbmNob3IudyAqIHJlc3lcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBpbnRlcm5hbCAtIGFwcGx5IG9mZnNldCB4LHkgdG8gbG9jYWwgcG9zaXRpb24gYW5kIGZpbmQgcG9pbnQgaW4gd29ybGQgc3BhY2VcbiAgICBnZXRPZmZzZXRQb3NpdGlvbih4LCB5KSB7XG4gICAgICAgIGNvbnN0IHAgPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCkuY2xvbmUoKTtcblxuICAgICAgICBwLnggKz0geDtcbiAgICAgICAgcC55ICs9IHk7XG5cbiAgICAgICAgdGhpcy5fc2NyZWVuVG9Xb3JsZC50cmFuc2Zvcm1Qb2ludChwLCBwKTtcblxuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG5cbiAgICBvbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnModGhpcy5faW1hZ2UgPyB0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbCA6IHRoaXMuX3RleHQuX21vZGVsKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90ZXh0KSB7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMuX3RleHQuX21vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25MYXllclJlbW92ZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5faW1hZ2UpIHtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5faW1hZ2UuX3JlbmRlcmFibGUubW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdGV4dCkge1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLl90ZXh0Ll9tb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBpZiAodGhpcy5faW1hZ2UpIHRoaXMuX2ltYWdlLm9uRW5hYmxlKCk7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0KSB0aGlzLl90ZXh0Lm9uRW5hYmxlKCk7XG4gICAgICAgIGlmICh0aGlzLl9ncm91cCkgdGhpcy5fZ3JvdXAub25FbmFibGUoKTtcblxuICAgICAgICBpZiAodGhpcy51c2VJbnB1dCAmJiB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LmFkZEVsZW1lbnQodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUub24oJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLkVMRU1FTlQsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmZpcmUoJ2VuYWJsZWVsZW1lbnQnKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSB0aGlzLl9pbWFnZS5vbkRpc2FibGUoKTtcbiAgICAgICAgaWYgKHRoaXMuX3RleHQpIHRoaXMuX3RleHQub25EaXNhYmxlKCk7XG4gICAgICAgIGlmICh0aGlzLl9ncm91cCkgdGhpcy5fZ3JvdXAub25EaXNhYmxlKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQgJiYgdGhpcy51c2VJbnB1dCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dC5yZW1vdmVFbGVtZW50KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuRUxFTUVOVCwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnZGlzYWJsZWVsZW1lbnQnKTtcbiAgICB9XG5cbiAgICBvblJlbW92ZSgpIHtcbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdpbnNlcnQnLCB0aGlzLl9vbkluc2VydCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3VucGF0Y2goKTtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSB0aGlzLl9pbWFnZS5kZXN0cm95KCk7XG4gICAgICAgIGlmICh0aGlzLl90ZXh0KSB0aGlzLl90ZXh0LmRlc3Ryb3koKTtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dCAmJiB0aGlzLnVzZUlucHV0KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LnJlbW92ZUVsZW1lbnQodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGVyZSBpcyBhIHNjcmVlbiwgdXBkYXRlIGRyYXctb3JkZXJcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuICYmIHRoaXMuc2NyZWVuLnNjcmVlbikge1xuICAgICAgICAgICAgdGhpcy5fdW5iaW5kU2NyZWVuKHRoaXMuc2NyZWVuLnNjcmVlbik7XG4gICAgICAgICAgICB0aGlzLnNjcmVlbi5zY3JlZW4uc3luY0RyYXdPcmRlcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWNhbGN1bGF0ZXMgdGhlc2UgcHJvcGVydGllczpcbiAgICAgKiAgIC0gYF9sb2NhbEFuY2hvcmBcbiAgICAgKiAgIC0gYHdpZHRoYFxuICAgICAqICAgLSBgaGVpZ2h0YFxuICAgICAqICAgLSBMb2NhbCBwb3NpdGlvbiBpcyB1cGRhdGVkIGlmIGFuY2hvcnMgYXJlIHNwbGl0XG4gICAgICpcbiAgICAgKiBBc3N1bWVzIHRoZXNlIHByb3BlcnRpZXMgYXJlIHVwIHRvIGRhdGU6XG4gICAgICogICAtIGBfbWFyZ2luYFxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBwcm9wYWdhdGVDYWxjdWxhdGVkV2lkdGggLSBJZiB0cnVlLCBjYWxsIGBfc2V0V2lkdGhgIGluc3RlYWRcbiAgICAgKiBvZiBgX3NldENhbGN1bGF0ZWRXaWR0aGBcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByb3BhZ2F0ZUNhbGN1bGF0ZWRIZWlnaHQgLSBJZiB0cnVlLCBjYWxsIGBfc2V0SGVpZ2h0YCBpbnN0ZWFkXG4gICAgICogb2YgYF9zZXRDYWxjdWxhdGVkSGVpZ2h0YFxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NhbGN1bGF0ZVNpemUocHJvcGFnYXRlQ2FsY3VsYXRlZFdpZHRoLCBwcm9wYWdhdGVDYWxjdWxhdGVkSGVpZ2h0KSB7XG4gICAgICAgIC8vIGNhbid0IGNhbGN1bGF0ZSBpZiBsb2NhbCBhbmNob3JzIGFyZSB3cm9uZ1xuICAgICAgICBpZiAoIXRoaXMuZW50aXR5Ll9wYXJlbnQgJiYgIXRoaXMuc2NyZWVuKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlTG9jYWxBbmNob3JzKCk7XG5cbiAgICAgICAgY29uc3QgbmV3V2lkdGggPSB0aGlzLl9hYnNSaWdodCAtIHRoaXMuX2Fic0xlZnQ7XG4gICAgICAgIGNvbnN0IG5ld0hlaWdodCA9IHRoaXMuX2Fic1RvcCAtIHRoaXMuX2Fic0JvdHRvbTtcblxuICAgICAgICBpZiAocHJvcGFnYXRlQ2FsY3VsYXRlZFdpZHRoKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRXaWR0aChuZXdXaWR0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRDYWxjdWxhdGVkV2lkdGgobmV3V2lkdGgsIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcm9wYWdhdGVDYWxjdWxhdGVkSGVpZ2h0KSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRIZWlnaHQobmV3SGVpZ2h0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRIZWlnaHQobmV3SGVpZ2h0LCBmYWxzZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBwLnggPSB0aGlzLl9tYXJnaW4ueCArIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCAqIHRoaXMuX3Bpdm90Lng7XG4gICAgICAgIHAueSA9IHRoaXMuX21hcmdpbi55ICsgdGhpcy5fY2FsY3VsYXRlZEhlaWdodCAqIHRoaXMuX3Bpdm90Lnk7XG5cbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwKTtcblxuICAgICAgICB0aGlzLl9zaXplRGlydHkgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBzZXQgd2lkdGggd2l0aG91dCB1cGRhdGluZyBtYXJnaW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdyAtIFRoZSBuZXcgd2lkdGguXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0V2lkdGgodykge1xuICAgICAgICB0aGlzLl93aWR0aCA9IHc7XG4gICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRXaWR0aCh3LCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6d2lkdGgnLCB0aGlzLl93aWR0aCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW50ZXJuYWwgc2V0IGhlaWdodCB3aXRob3V0IHVwZGF0aW5nIG1hcmdpbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoIC0gVGhlIG5ldyBoZWlnaHQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0SGVpZ2h0KGgpIHtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gaDtcbiAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZEhlaWdodChoLCBmYWxzZSk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6aGVpZ2h0JywgdGhpcy5faGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIG1ldGhvZCBzZXRzIHRoZSBjYWxjdWxhdGVkIHdpZHRoIHZhbHVlIGFuZCBvcHRpb25hbGx5IHVwZGF0ZXMgdGhlIG1hcmdpbnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBUaGUgbmV3IGNhbGN1bGF0ZWQgd2lkdGguXG4gICAgICogQHBhcmFtIHtib29sZWFufSB1cGRhdGVNYXJnaW5zIC0gVXBkYXRlIG1hcmdpbnMgb3Igbm90LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldENhbGN1bGF0ZWRXaWR0aCh2YWx1ZSwgdXBkYXRlTWFyZ2lucykge1xuICAgICAgICBpZiAoTWF0aC5hYnModmFsdWUgLSB0aGlzLl9jYWxjdWxhdGVkV2lkdGgpIDw9IDFlLTQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlZFdpZHRoID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZW50aXR5Ll9kaXJ0aWZ5TG9jYWwoKTtcblxuICAgICAgICBpZiAodXBkYXRlTWFyZ2lucykge1xuICAgICAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHB2dCA9IHRoaXMuX3Bpdm90O1xuICAgICAgICAgICAgdGhpcy5fbWFyZ2luLnggPSBwLnggLSB0aGlzLl9jYWxjdWxhdGVkV2lkdGggKiBwdnQueDtcbiAgICAgICAgICAgIHRoaXMuX21hcmdpbi56ID0gKHRoaXMuX2xvY2FsQW5jaG9yLnogLSB0aGlzLl9sb2NhbEFuY2hvci54KSAtIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCAtIHRoaXMuX21hcmdpbi54O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZmxhZ0NoaWxkcmVuQXNEaXJ0eSgpO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDpjYWxjdWxhdGVkV2lkdGgnLCB0aGlzLl9jYWxjdWxhdGVkV2lkdGgpO1xuICAgICAgICB0aGlzLmZpcmUoJ3Jlc2l6ZScsIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCwgdGhpcy5fY2FsY3VsYXRlZEhlaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2Qgc2V0cyB0aGUgY2FsY3VsYXRlZCBoZWlnaHQgdmFsdWUgYW5kIG9wdGlvbmFsbHkgdXBkYXRlcyB0aGUgbWFyZ2lucy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBuZXcgY2FsY3VsYXRlZCBoZWlnaHQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSB1cGRhdGVNYXJnaW5zIC0gVXBkYXRlIG1hcmdpbnMgb3Igbm90LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NldENhbGN1bGF0ZWRIZWlnaHQodmFsdWUsIHVwZGF0ZU1hcmdpbnMpIHtcbiAgICAgICAgaWYgKE1hdGguYWJzKHZhbHVlIC0gdGhpcy5fY2FsY3VsYXRlZEhlaWdodCkgPD0gMWUtNClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZW50aXR5Ll9kaXJ0aWZ5TG9jYWwoKTtcblxuICAgICAgICBpZiAodXBkYXRlTWFyZ2lucykge1xuICAgICAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IHB2dCA9IHRoaXMuX3Bpdm90O1xuICAgICAgICAgICAgdGhpcy5fbWFyZ2luLnkgPSBwLnkgLSB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0ICogcHZ0Lnk7XG4gICAgICAgICAgICB0aGlzLl9tYXJnaW4udyA9ICh0aGlzLl9sb2NhbEFuY2hvci53IC0gdGhpcy5fbG9jYWxBbmNob3IueSkgLSB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0IC0gdGhpcy5fbWFyZ2luLnk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9mbGFnQ2hpbGRyZW5Bc0RpcnR5KCk7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OmNhbGN1bGF0ZWRIZWlnaHQnLCB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0KTtcbiAgICAgICAgdGhpcy5maXJlKCdyZXNpemUnLCB0aGlzLl9jYWxjdWxhdGVkV2lkdGgsIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQpO1xuICAgIH1cblxuICAgIF9mbGFnQ2hpbGRyZW5Bc0RpcnR5KCkge1xuICAgICAgICBjb25zdCBjID0gdGhpcy5lbnRpdHkuX2NoaWxkcmVuO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY1tpXS5lbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgY1tpXS5lbGVtZW50Ll9hbmNob3JEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgY1tpXS5lbGVtZW50Ll9zaXplRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkTW9kZWxUb0xheWVycyhtb2RlbCkge1xuICAgICAgICB0aGlzLl9hZGRlZE1vZGVscy5wdXNoKG1vZGVsKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVNb2RlbEZyb21MYXllcnMobW9kZWwpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5fYWRkZWRNb2RlbHMuaW5kZXhPZihtb2RlbCk7XG4gICAgICAgIGlmIChpZHggPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5fYWRkZWRNb2RlbHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRNYXNrT2Zmc2V0KCkge1xuICAgICAgICAvLyByZXNldCBvZmZzZXQgb24gbmV3IGZyYW1lXG4gICAgICAgIC8vIHdlIGFsd2F5cyBjb3VudCBvZmZzZXQgZG93biBmcm9tIDAuNVxuICAgICAgICBjb25zdCBmcmFtZSA9IHRoaXMuc3lzdGVtLmFwcC5mcmFtZTtcbiAgICAgICAgaWYgKHRoaXMuX29mZnNldFJlYWRBdCAhPT0gZnJhbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX21hc2tPZmZzZXQgPSAwLjU7XG4gICAgICAgICAgICB0aGlzLl9vZmZzZXRSZWFkQXQgPSBmcmFtZTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBtbyA9IHRoaXMuX21hc2tPZmZzZXQ7XG4gICAgICAgIHRoaXMuX21hc2tPZmZzZXQgLT0gMC4wMDE7XG4gICAgICAgIHJldHVybiBtbztcbiAgICB9XG5cbiAgICBpc1Zpc2libGVGb3JDYW1lcmEoY2FtZXJhKSB7XG4gICAgICAgIGxldCBjbGlwTCwgY2xpcFIsIGNsaXBULCBjbGlwQjtcblxuICAgICAgICBpZiAodGhpcy5tYXNrZWRCeSkge1xuICAgICAgICAgICAgY29uc3QgY29ybmVycyA9IHRoaXMubWFza2VkQnkuZWxlbWVudC5zY3JlZW5Db3JuZXJzO1xuXG4gICAgICAgICAgICBjbGlwTCA9IE1hdGgubWluKE1hdGgubWluKGNvcm5lcnNbMF0ueCwgY29ybmVyc1sxXS54KSwgTWF0aC5taW4oY29ybmVyc1syXS54LCBjb3JuZXJzWzNdLngpKTtcbiAgICAgICAgICAgIGNsaXBSID0gTWF0aC5tYXgoTWF0aC5tYXgoY29ybmVyc1swXS54LCBjb3JuZXJzWzFdLngpLCBNYXRoLm1heChjb3JuZXJzWzJdLngsIGNvcm5lcnNbM10ueCkpO1xuICAgICAgICAgICAgY2xpcEIgPSBNYXRoLm1pbihNYXRoLm1pbihjb3JuZXJzWzBdLnksIGNvcm5lcnNbMV0ueSksIE1hdGgubWluKGNvcm5lcnNbMl0ueSwgY29ybmVyc1szXS55KSk7XG4gICAgICAgICAgICBjbGlwVCA9IE1hdGgubWF4KE1hdGgubWF4KGNvcm5lcnNbMF0ueSwgY29ybmVyc1sxXS55KSwgTWF0aC5tYXgoY29ybmVyc1syXS55LCBjb3JuZXJzWzNdLnkpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IHN3ID0gdGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLndpZHRoO1xuICAgICAgICAgICAgY29uc3Qgc2ggPSB0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2UuaGVpZ2h0O1xuXG4gICAgICAgICAgICBjb25zdCBjYW1lcmFXaWR0aCA9IGNhbWVyYS5fcmVjdC56ICogc3c7XG4gICAgICAgICAgICBjb25zdCBjYW1lcmFIZWlnaHQgPSBjYW1lcmEuX3JlY3QudyAqIHNoO1xuICAgICAgICAgICAgY2xpcEwgPSBjYW1lcmEuX3JlY3QueCAqIHN3O1xuICAgICAgICAgICAgY2xpcFIgPSBjbGlwTCArIGNhbWVyYVdpZHRoO1xuICAgICAgICAgICAgY2xpcFQgPSAoMSAtIGNhbWVyYS5fcmVjdC55KSAqIHNoO1xuICAgICAgICAgICAgY2xpcEIgPSBjbGlwVCAtIGNhbWVyYUhlaWdodDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGhpdENvcm5lcnMgPSB0aGlzLnNjcmVlbkNvcm5lcnM7XG5cbiAgICAgICAgY29uc3QgbGVmdCA9IE1hdGgubWluKE1hdGgubWluKGhpdENvcm5lcnNbMF0ueCwgaGl0Q29ybmVyc1sxXS54KSwgTWF0aC5taW4oaGl0Q29ybmVyc1syXS54LCBoaXRDb3JuZXJzWzNdLngpKTtcbiAgICAgICAgY29uc3QgcmlnaHQgPSBNYXRoLm1heChNYXRoLm1heChoaXRDb3JuZXJzWzBdLngsIGhpdENvcm5lcnNbMV0ueCksIE1hdGgubWF4KGhpdENvcm5lcnNbMl0ueCwgaGl0Q29ybmVyc1szXS54KSk7XG4gICAgICAgIGNvbnN0IGJvdHRvbSA9IE1hdGgubWluKE1hdGgubWluKGhpdENvcm5lcnNbMF0ueSwgaGl0Q29ybmVyc1sxXS55KSwgTWF0aC5taW4oaGl0Q29ybmVyc1syXS55LCBoaXRDb3JuZXJzWzNdLnkpKTtcbiAgICAgICAgY29uc3QgdG9wID0gTWF0aC5tYXgoTWF0aC5tYXgoaGl0Q29ybmVyc1swXS55LCBoaXRDb3JuZXJzWzFdLnkpLCBNYXRoLm1heChoaXRDb3JuZXJzWzJdLnksIGhpdENvcm5lcnNbM10ueSkpO1xuXG4gICAgICAgIGlmIChyaWdodCA8IGNsaXBMIHx8XG4gICAgICAgICAgICBsZWZ0ID4gY2xpcFIgfHxcbiAgICAgICAgICAgIGJvdHRvbSA+IGNsaXBUIHx8XG4gICAgICAgICAgICB0b3AgPCBjbGlwQikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgX2lzU2NyZWVuU3BhY2UoKSB7XG4gICAgICAgIGlmICh0aGlzLnNjcmVlbiAmJiB0aGlzLnNjcmVlbi5zY3JlZW4pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2lzU2NyZWVuQ3VsbGVkKCkge1xuICAgICAgICBpZiAodGhpcy5zY3JlZW4gJiYgdGhpcy5zY3JlZW4uc2NyZWVuKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zY3JlZW4uc2NyZWVuLmN1bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2RpcnR5QmF0Y2goKSB7XG4gICAgICAgIGlmICh0aGlzLmJhdGNoR3JvdXBJZCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5tYXJrR3JvdXBEaXJ0eSh0aGlzLmJhdGNoR3JvdXBJZCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmUobmFtZSkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShFbGVtZW50Q29tcG9uZW50LnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3RleHRbbmFtZV07XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2ltYWdlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2ltYWdlW25hbWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fdGV4dCkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0W25hbWVdICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUJhdGNoKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dFtuYW1lXSA9IHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZVtuYW1lXSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZGlydHlCYXRjaCgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlW25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuX2RlZmluZSgnZm9udFNpemUnKTtcbl9kZWZpbmUoJ21pbkZvbnRTaXplJyk7XG5fZGVmaW5lKCdtYXhGb250U2l6ZScpO1xuX2RlZmluZSgnbWF4TGluZXMnKTtcbl9kZWZpbmUoJ2F1dG9GaXRXaWR0aCcpO1xuX2RlZmluZSgnYXV0b0ZpdEhlaWdodCcpO1xuX2RlZmluZSgnY29sb3InKTtcbl9kZWZpbmUoJ2ZvbnQnKTtcbl9kZWZpbmUoJ2ZvbnRBc3NldCcpO1xuX2RlZmluZSgnc3BhY2luZycpO1xuX2RlZmluZSgnbGluZUhlaWdodCcpO1xuX2RlZmluZSgnd3JhcExpbmVzJyk7XG5fZGVmaW5lKCdsaW5lcycpO1xuX2RlZmluZSgnYWxpZ25tZW50Jyk7XG5fZGVmaW5lKCdhdXRvV2lkdGgnKTtcbl9kZWZpbmUoJ2F1dG9IZWlnaHQnKTtcbl9kZWZpbmUoJ3J0bFJlb3JkZXInKTtcbl9kZWZpbmUoJ3VuaWNvZGVDb252ZXJ0ZXInKTtcbl9kZWZpbmUoJ3RleHQnKTtcbl9kZWZpbmUoJ2tleScpO1xuX2RlZmluZSgndGV4dHVyZScpO1xuX2RlZmluZSgndGV4dHVyZUFzc2V0Jyk7XG5fZGVmaW5lKCdtYXRlcmlhbCcpO1xuX2RlZmluZSgnbWF0ZXJpYWxBc3NldCcpO1xuX2RlZmluZSgnc3ByaXRlJyk7XG5fZGVmaW5lKCdzcHJpdGVBc3NldCcpO1xuX2RlZmluZSgnc3ByaXRlRnJhbWUnKTtcbl9kZWZpbmUoJ3BpeGVsc1BlclVuaXQnKTtcbl9kZWZpbmUoJ29wYWNpdHknKTtcbl9kZWZpbmUoJ3JlY3QnKTtcbl9kZWZpbmUoJ21hc2snKTtcbl9kZWZpbmUoJ291dGxpbmVDb2xvcicpO1xuX2RlZmluZSgnb3V0bGluZVRoaWNrbmVzcycpO1xuX2RlZmluZSgnc2hhZG93Q29sb3InKTtcbl9kZWZpbmUoJ3NoYWRvd09mZnNldCcpO1xuX2RlZmluZSgnZW5hYmxlTWFya3VwJyk7XG5fZGVmaW5lKCdyYW5nZVN0YXJ0Jyk7XG5fZGVmaW5lKCdyYW5nZUVuZCcpO1xuXG5leHBvcnQgeyBFbGVtZW50Q29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsicG9zaXRpb24iLCJWZWMzIiwiaW52UGFyZW50V3RtIiwiTWF0NCIsInZlY0EiLCJ2ZWNCIiwibWF0QSIsIm1hdEIiLCJtYXRDIiwibWF0RCIsIkVsZW1lbnRDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl9iZWluZ0luaXRpYWxpemVkIiwiX2FuY2hvciIsIlZlYzQiLCJfbG9jYWxBbmNob3IiLCJfcGl2b3QiLCJWZWMyIiwiX3dpZHRoIiwiX2NhbGN1bGF0ZWRXaWR0aCIsIl9oZWlnaHQiLCJfY2FsY3VsYXRlZEhlaWdodCIsIl9tYXJnaW4iLCJfbW9kZWxUcmFuc2Zvcm0iLCJfc2NyZWVuVG9Xb3JsZCIsIl9hbmNob3JUcmFuc2Zvcm0iLCJfYW5jaG9yRGlydHkiLCJfcGFyZW50V29ybGRUcmFuc2Zvcm0iLCJfc2NyZWVuVHJhbnNmb3JtIiwiX3NjcmVlbkNvcm5lcnMiLCJfY2FudmFzQ29ybmVycyIsIl93b3JsZENvcm5lcnMiLCJfY29ybmVyc0RpcnR5IiwiX2NhbnZhc0Nvcm5lcnNEaXJ0eSIsIl93b3JsZENvcm5lcnNEaXJ0eSIsIm9uIiwiX29uSW5zZXJ0IiwiX3BhdGNoIiwic2NyZWVuIiwiX3R5cGUiLCJFTEVNRU5UVFlQRV9HUk9VUCIsIl9pbWFnZSIsIl90ZXh0IiwiX2dyb3VwIiwiX2RyYXdPcmRlciIsIl9maXRNb2RlIiwiRklUTU9ERV9TVFJFVENIIiwiX3VzZUlucHV0IiwiX2xheWVycyIsIkxBWUVSSURfVUkiLCJfYWRkZWRNb2RlbHMiLCJfYmF0Y2hHcm91cElkIiwiX2JhdGNoR3JvdXAiLCJfb2Zmc2V0UmVhZEF0IiwiX21hc2tPZmZzZXQiLCJfbWFza2VkQnkiLCJfYWJzTGVmdCIsIngiLCJfYWJzUmlnaHQiLCJ6IiwiX2Fic1RvcCIsInciLCJfYWJzQm90dG9tIiwieSIsIl9oYXNTcGxpdEFuY2hvcnNYIiwiTWF0aCIsImFicyIsIl9oYXNTcGxpdEFuY2hvcnNZIiwiYWFiYiIsImFuY2hvciIsInZhbHVlIiwiY29weSIsInNldCIsIl9wYXJlbnQiLCJfY2FsY3VsYXRlTG9jYWxBbmNob3JzIiwiX2NhbGN1bGF0ZVNpemUiLCJfZGlydHlMb2NhbCIsIl9kaXJ0aWZ5TG9jYWwiLCJmaXJlIiwiYmF0Y2hHcm91cElkIiwiZW5hYmxlZCIsImFwcCIsImJhdGNoZXIiLCJyZW1vdmUiLCJCYXRjaEdyb3VwIiwiRUxFTUVOVCIsImluc2VydCIsIl9yZW5kZXJhYmxlIiwibW9kZWwiLCJhZGRNb2RlbFRvTGF5ZXJzIiwiX21vZGVsIiwiYm90dG9tIiwicCIsImdldExvY2FsUG9zaXRpb24iLCJ3dCIsIndiIiwiX3NldEhlaWdodCIsInNldExvY2FsUG9zaXRpb24iLCJjYWxjdWxhdGVkV2lkdGgiLCJfc2V0Q2FsY3VsYXRlZFdpZHRoIiwiY2FsY3VsYXRlZEhlaWdodCIsIl9zZXRDYWxjdWxhdGVkSGVpZ2h0IiwiY2FudmFzQ29ybmVycyIsInNjcmVlblNwYWNlIiwiZGV2aWNlIiwiZ3JhcGhpY3NEZXZpY2UiLCJzY3JlZW5Db3JuZXJzIiwic3giLCJjYW52YXMiLCJjbGllbnRXaWR0aCIsIndpZHRoIiwic3kiLCJjbGllbnRIZWlnaHQiLCJoZWlnaHQiLCJpIiwiZHJhd09yZGVyIiwicHJpb3JpdHkiLCJEZWJ1ZyIsIndhcm4iLCJsYXllcnMiLCJsZW5ndGgiLCJsYXllciIsInNjZW5lIiwiZ2V0TGF5ZXJCeUlkIiwiaiIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJtZXNoSW5zdGFuY2VzIiwiYWRkTWVzaEluc3RhbmNlcyIsImxlZnQiLCJ3ciIsIndsIiwiX3NldFdpZHRoIiwibWFyZ2luIiwibWFza2VkQnkiLCJwaXZvdCIsInByZXZYIiwicHJldlkiLCJteCIsImR4IiwibXkiLCJkeSIsIl9mbGFnQ2hpbGRyZW5Bc0RpcnR5IiwicmlnaHQiLCJwYXJlbnRCb3R0b21MZWZ0IiwicGFyZW50IiwiZWxlbWVudCIsInRyYW5zZm9ybVBvaW50IiwibXVsU2NhbGFyIiwic2NhbGUiLCJhZGQiLCJ0ZXh0V2lkdGgiLCJ0ZXh0SGVpZ2h0IiwidG9wIiwidHlwZSIsImRlc3Ryb3kiLCJFTEVNRU5UVFlQRV9JTUFHRSIsIkltYWdlRWxlbWVudCIsIkVMRU1FTlRUWVBFX1RFWFQiLCJUZXh0RWxlbWVudCIsInVzZUlucHV0IiwiZWxlbWVudElucHV0IiwiYWRkRWxlbWVudCIsInJlbW92ZUVsZW1lbnQiLCJmaXRNb2RlIiwicmVmcmVzaE1lc2giLCJ3b3JsZENvcm5lcnMiLCJfc2NyZWVuTWF0cml4IiwiZGF0YSIsIm11bDIiLCJnZXRXb3JsZFRyYW5zZm9ybSIsImxvY2FsUG9zIiwic2V0VHJhbnNsYXRlIiwic2V0VFJTIiwiWkVSTyIsImdldExvY2FsUm90YXRpb24iLCJnZXRMb2NhbFNjYWxlIiwibXVsIiwiX3N5bmMiLCJzZXRQb3NpdGlvbiIsIl9zZXRQb3NpdGlvbiIsIl9zZXRMb2NhbFBvc2l0aW9uIiwiX3VucGF0Y2giLCJFbnRpdHkiLCJwcm90b3R5cGUiLCJjYWxsIiwiaW52ZXJ0IiwibG9jYWxQb3NpdGlvbiIsInB2dCIsInJlc3giLCJyZXN5IiwicHgiLCJweSIsInJlc29sdXRpb24iLCJfc2l6ZURpcnR5IiwibG9jYWxUcmFuc2Zvcm0iLCJsb2NhbFJvdGF0aW9uIiwibG9jYWxTY2FsZSIsIl9kaXJ0eVdvcmxkIiwid29ybGRUcmFuc2Zvcm0iLCJwYXJlbnRXb3JsZFRyYW5zZm9ybSIsInNldElkZW50aXR5IiwiZGVwdGhPZmZzZXQiLCJwaXZvdE9mZnNldCIsInJlc3VsdCIsIl9wYXJzZVVwVG9TY3JlZW4iLCJfZGlydGlmeVdvcmxkIiwiX3VwZGF0ZVNjcmVlbiIsIl9kaXJ0aWZ5TWFzayIsImN1cnJlbnQiLCJuZXh0IiwiX3ByZXJlbmRlciIsIm9uY2UiLCJfb25QcmVyZW5kZXIiLCJpbmRleE9mIiwic3BsaWNlIiwicHVzaCIsIm1hc2siLCJkZXB0aCIsInN5bmNNYXNrIiwiX2JpbmRTY3JlZW4iLCJfYmluZEVsZW1lbnQiLCJfdW5iaW5kU2NyZWVuIiwiX3VuYmluZEVsZW1lbnQiLCJwcmV2aW91c1NjcmVlbiIsImNoaWxkcmVuIiwibCIsInN5bmNEcmF3T3JkZXIiLCJfdXBkYXRlTWFzayIsIl9zZXRNYXNrZWRCeSIsInJlbmRlcmFibGVFbGVtZW50IiwicmVmIiwiX21hc2tSZWYiLCJzcCIsIlN0ZW5jaWxQYXJhbWV0ZXJzIiwiZnVuYyIsIkZVTkNfRVFVQUwiLCJfc2V0U3RlbmNpbCIsImN1cnJlbnRNYXNrIiwienBhc3MiLCJTVEVOQ0lMT1BfSU5DUkVNRU5UIiwiRlVOQ19BTFdBWVMiLCJTVEVOQ0lMT1BfUkVQTEFDRSIsIl9vblNjcmVlblJlc2l6ZSIsInJlcyIsIl9vblNjcmVlblNwYWNlQ2hhbmdlIiwiX29uU2NyZWVuUmVtb3ZlIiwiX2Rlc3Ryb3lpbmciLCJnZXRPZmZzZXRQb3NpdGlvbiIsImNsb25lIiwib25MYXllcnNDaGFuZ2VkIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJvZmYiLCJvbkxheWVyQWRkZWQiLCJvbkxheWVyUmVtb3ZlZCIsImluZGV4IiwiaWQiLCJvbkVuYWJsZSIsIm9uRGlzYWJsZSIsIm9uUmVtb3ZlIiwicHJvcGFnYXRlQ2FsY3VsYXRlZFdpZHRoIiwicHJvcGFnYXRlQ2FsY3VsYXRlZEhlaWdodCIsIm5ld1dpZHRoIiwibmV3SGVpZ2h0IiwiaCIsInVwZGF0ZU1hcmdpbnMiLCJjIiwiX2NoaWxkcmVuIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwiaWR4IiwiZ2V0TWFza09mZnNldCIsImZyYW1lIiwibW8iLCJpc1Zpc2libGVGb3JDYW1lcmEiLCJjYW1lcmEiLCJjbGlwTCIsImNsaXBSIiwiY2xpcFQiLCJjbGlwQiIsImNvcm5lcnMiLCJtaW4iLCJtYXgiLCJzdyIsInNoIiwiY2FtZXJhV2lkdGgiLCJfcmVjdCIsImNhbWVyYUhlaWdodCIsImhpdENvcm5lcnMiLCJfaXNTY3JlZW5TcGFjZSIsIl9pc1NjcmVlbkN1bGxlZCIsImN1bGwiLCJfZGlydHlCYXRjaCIsIm1hcmtHcm91cERpcnR5IiwiX2RlZmluZSIsIm5hbWUiLCJPYmplY3QiLCJkZWZpbmVQcm9wZXJ0eSIsImdldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF5QkEsTUFBTUEsUUFBUSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQzNCLE1BQU1DLFlBQVksR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUUvQixNQUFNQyxJQUFJLEdBQUcsSUFBSUgsSUFBSSxFQUFFLENBQUE7QUFDdkIsTUFBTUksSUFBSSxHQUFHLElBQUlK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LEtBQUssR0FBR2xOLElBQUksQ0FBQ3VOLEdBQUcsQ0FBQ3ZOLElBQUksQ0FBQ3VOLEdBQUcsQ0FBQ0QsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDOU4sQ0FBQyxFQUFFOE4sT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDOU4sQ0FBQyxDQUFDLEVBQUVRLElBQUksQ0FBQ3VOLEdBQUcsQ0FBQ0QsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDOU4sQ0FBQyxFQUFFOE4sT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDOU4sQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM1RjJOLE1BQUFBLEtBQUssR0FBR25OLElBQUksQ0FBQ3dOLEdBQUcsQ0FBQ3hOLElBQUksQ0FBQ3dOLEdBQUcsQ0FBQ0YsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDOU4sQ0FBQyxFQUFFOE4sT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDOU4sQ0FBQyxDQUFDLEVBQUVRLElBQUksQ0FBQ3dOLEdBQUcsQ0FBQ0YsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDOU4sQ0FBQyxFQUFFOE4sT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDOU4sQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM1RjZOLE1BQUFBLEtBQUssR0FBR3JOLElBQUksQ0FBQ3VOLEdBQUcsQ0FBQ3ZOLElBQUksQ0FBQ3VOLEdBQUcsQ0FBQ0QsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDeE4sQ0FBQyxFQUFFd04sT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDeE4sQ0FBQyxDQUFDLEVBQUVFLElBQUksQ0FBQ3VOLEdBQUcsQ0FBQ0QsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDeE4sQ0FBQyxFQUFFd04sT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDeE4sQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM1RnNOLE1BQUFBLEtBQUssR0FBR3BOLElBQUksQ0FBQ3dOLEdBQUcsQ0FBQ3hOLElBQUksQ0FBQ3dOLEdBQUcsQ0FBQ0YsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDeE4sQ0FBQyxFQUFFd04sT0FBTyxDQUFD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
