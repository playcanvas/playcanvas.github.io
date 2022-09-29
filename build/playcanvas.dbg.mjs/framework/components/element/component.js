/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { Mat4 } from '../../../math/mat4.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';
import { Vec4 } from '../../../math/vec4.js';
import { FUNC_EQUAL, STENCILOP_INCREMENT, FUNC_ALWAYS, STENCILOP_REPLACE } from '../../../graphics/constants.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9jb21wb25lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uLy4uLy4uL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi8uLi9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IEZVTkNfQUxXQVlTLCBGVU5DX0VRVUFMLCBTVEVOQ0lMT1BfSU5DUkVNRU5ULCBTVEVOQ0lMT1BfUkVQTEFDRSB9IGZyb20gJy4uLy4uLy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IExBWUVSSURfVUkgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQmF0Y2hHcm91cCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLWdyb3VwLmpzJztcbmltcG9ydCB7IFN0ZW5jaWxQYXJhbWV0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvc3RlbmNpbC1wYXJhbWV0ZXJzLmpzJztcblxuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi4vLi4vZW50aXR5LmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHsgRUxFTUVOVFRZUEVfR1JPVVAsIEVMRU1FTlRUWVBFX0lNQUdFLCBFTEVNRU5UVFlQRV9URVhULCBGSVRNT0RFX1NUUkVUQ0ggfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJbWFnZUVsZW1lbnQgfSBmcm9tICcuL2ltYWdlLWVsZW1lbnQuanMnO1xuaW1wb3J0IHsgVGV4dEVsZW1lbnQgfSBmcm9tICcuL3RleHQtZWxlbWVudC5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9tYXRoL2NvbG9yLmpzJykuQ29sb3J9IENvbG9yICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vZm9udC9jYW52YXMtZm9udC5qcycpLkNhbnZhc0ZvbnR9IENhbnZhc0ZvbnQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9mb250L2ZvbnQuanMnKS5Gb250fSBGb250ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9IFRleHR1cmUgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnKS5NYXRlcmlhbH0gTWF0ZXJpYWwgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9zcHJpdGUuanMnKS5TcHJpdGV9IFNwcml0ZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuRWxlbWVudENvbXBvbmVudFN5c3RlbX0gRWxlbWVudENvbXBvbmVudFN5c3RlbSAqL1xuXG4vLyAjaWYgX0RFQlVHXG5jb25zdCBfZGVidWdMb2dnaW5nID0gZmFsc2U7XG4vLyAjZW5kaWZcblxuY29uc3QgcG9zaXRpb24gPSBuZXcgVmVjMygpO1xuY29uc3QgaW52UGFyZW50V3RtID0gbmV3IE1hdDQoKTtcblxuY29uc3QgdmVjQSA9IG5ldyBWZWMzKCk7XG5jb25zdCB2ZWNCID0gbmV3IFZlYzMoKTtcbmNvbnN0IG1hdEEgPSBuZXcgTWF0NCgpO1xuY29uc3QgbWF0QiA9IG5ldyBNYXQ0KCk7XG5jb25zdCBtYXRDID0gbmV3IE1hdDQoKTtcbmNvbnN0IG1hdEQgPSBuZXcgTWF0NCgpO1xuXG4vKipcbiAqIEVsZW1lbnRDb21wb25lbnRzIGFyZSB1c2VkIHRvIGNvbnN0cnVjdCB1c2VyIGludGVyZmFjZXMuIEFuIEVsZW1lbnRDb21wb25lbnQncyBbdHlwZV0oI3R5cGUpXG4gKiBwcm9wZXJ0eSBjYW4gYmUgY29uZmlndXJlZCBpbiAzIG1haW4gd2F5czogYXMgYSB0ZXh0IGVsZW1lbnQsIGFzIGFuIGltYWdlIGVsZW1lbnQgb3IgYXMgYSBncm91cFxuICogZWxlbWVudC4gSWYgdGhlIEVsZW1lbnRDb21wb25lbnQgaGFzIGEge0BsaW5rIFNjcmVlbkNvbXBvbmVudH0gYW5jZXN0b3IgaW4gdGhlIGhpZXJhcmNoeSwgaXRcbiAqIHdpbGwgYmUgdHJhbnNmb3JtZWQgd2l0aCByZXNwZWN0IHRvIHRoZSBjb29yZGluYXRlIHN5c3RlbSBvZiB0aGUgc2NyZWVuLiBJZiB0aGVyZSBpcyBub1xuICoge0BsaW5rIFNjcmVlbkNvbXBvbmVudH0gYW5jZXN0b3IsIHRoZSBFbGVtZW50Q29tcG9uZW50IHdpbGwgYmUgdHJhbnNmb3JtZWQgbGlrZSBhbnkgb3RoZXJcbiAqIGVudGl0eS5cbiAqXG4gKiBZb3Ugc2hvdWxkIG5ldmVyIG5lZWQgdG8gdXNlIHRoZSBFbGVtZW50Q29tcG9uZW50IGNvbnN0cnVjdG9yLiBUbyBhZGQgYW4gRWxlbWVudENvbXBvbmVudCB0byBhXG4gKiB7QGxpbmsgRW50aXR5fSwgdXNlIHtAbGluayBFbnRpdHkjYWRkQ29tcG9uZW50fTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBBZGQgYW4gZWxlbWVudCBjb21wb25lbnQgdG8gYW4gZW50aXR5IHdpdGggdGhlIGRlZmF1bHQgb3B0aW9uc1xuICogbGV0IGVudGl0eSA9IHBjLkVudGl0eSgpO1xuICogZW50aXR5LmFkZENvbXBvbmVudChcImVsZW1lbnRcIik7IC8vIFRoaXMgZGVmYXVsdHMgdG8gYSAnZ3JvdXAnIGVsZW1lbnRcbiAqIGBgYFxuICpcbiAqIFRvIGNyZWF0ZSBhIHNpbXBsZSB0ZXh0LWJhc2VkIGVsZW1lbnQ6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogZW50aXR5LmFkZENvbXBvbmVudChcImVsZW1lbnRcIiwge1xuICogICAgIGFuY2hvcjogbmV3IHBjLlZlYzQoMC41LCAwLjUsIDAuNSwgMC41KSwgLy8gY2VudGVyZWQgYW5jaG9yXG4gKiAgICAgZm9udEFzc2V0OiBmb250QXNzZXQsXG4gKiAgICAgZm9udFNpemU6IDEyOCxcbiAqICAgICBwaXZvdDogbmV3IHBjLlZlYzIoMC41LCAwLjUpLCAgICAgICAgICAgIC8vIGNlbnRlcmVkIHBpdm90XG4gKiAgICAgdGV4dDogXCJIZWxsbyBXb3JsZCFcIixcbiAqICAgICB0eXBlOiBwYy5FTEVNRU5UVFlQRV9URVhUXG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIE9uY2UgdGhlIEVsZW1lbnRDb21wb25lbnQgaXMgYWRkZWQgdG8gdGhlIGVudGl0eSwgeW91IGNhbiBzZXQgYW5kIGdldCBhbnkgb2YgaXRzIHByb3BlcnRpZXM6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogZW50aXR5LmVsZW1lbnQuY29sb3IgPSBwYy5Db2xvci5SRUQ7IC8vIFNldCB0aGUgZWxlbWVudCdzIGNvbG9yIHRvIHJlZFxuICpcbiAqIGNvbnNvbGUubG9nKGVudGl0eS5lbGVtZW50LmNvbG9yKTsgICAvLyBHZXQgdGhlIGVsZW1lbnQncyBjb2xvciBhbmQgcHJpbnQgaXRcbiAqIGBgYFxuICpcbiAqIFJlbGV2YW50ICdFbmdpbmUtb25seScgZXhhbXBsZXM6XG4gKiAtIFtCYXNpYyB0ZXh0IHJlbmRlcmluZ10oaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyN1c2VyLWludGVyZmFjZS90ZXh0LWJhc2ljKVxuICogLSBbUmVuZGVyaW5nIHRleHQgb3V0bGluZXNdKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jdXNlci1pbnRlcmZhY2UvdGV4dC1vdXRsaW5lKVxuICogLSBbQWRkaW5nIGRyb3Agc2hhZG93cyB0byB0ZXh0XShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3VzZXItaW50ZXJmYWNlL3RleHQtZHJvcC1zaGFkb3cpXG4gKiAtIFtDb2xvcmluZyB0ZXh0IHdpdGggbWFya3VwXShodHRwOi8vcGxheWNhbnZhcy5naXRodWIuaW8vI3VzZXItaW50ZXJmYWNlL3RleHQtbWFya3VwKVxuICogLSBbV3JhcHBpbmcgdGV4dF0oaHR0cDovL3BsYXljYW52YXMuZ2l0aHViLmlvLyN1c2VyLWludGVyZmFjZS90ZXh0LXdyYXApXG4gKiAtIFtUeXBld3JpdGVyIHRleHRdKGh0dHA6Ly9wbGF5Y2FudmFzLmdpdGh1Yi5pby8jdXNlci1pbnRlcmZhY2UvdGV4dC10eXBld3JpdGVyKVxuICpcbiAqIEBwcm9wZXJ0eSB7Q29sb3J9IGNvbG9yIFRoZSBjb2xvciBvZiB0aGUgaW1hZ2UgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMgb3IgdGhlIGNvbG9yXG4gKiBvZiB0aGUgdGV4dCBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9wYWNpdHkgVGhlIG9wYWNpdHkgb2YgdGhlIGltYWdlIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIG9yIHRoZVxuICogdGV4dCBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtDb2xvcn0gb3V0bGluZUNvbG9yIFRoZSB0ZXh0IG91dGxpbmUgZWZmZWN0IGNvbG9yIGFuZCBvcGFjaXR5LiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG91dGxpbmVUaGlja25lc3MgVGhlIHdpZHRoIG9mIHRoZSB0ZXh0IG91dGxpbmUgZWZmZWN0LiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtDb2xvcn0gc2hhZG93Q29sb3IgVGhlIHRleHQgc2hhZG93IGVmZmVjdCBjb2xvciBhbmQgb3BhY2l0eS4gT25seSB3b3JrcyBmb3JcbiAqIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc2hhZG93T2Zmc2V0IFRoZSB0ZXh0IHNoYWRvdyBlZmZlY3Qgc2hpZnQgYW1vdW50IGZyb20gb3JpZ2luYWwgdGV4dC4gT25seSB3b3Jrc1xuICogZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYXV0b1dpZHRoIEF1dG9tYXRpY2FsbHkgc2V0IHRoZSB3aWR0aCBvZiB0aGUgY29tcG9uZW50IHRvIGJlIHRoZSBzYW1lIGFzIHRoZVxuICogdGV4dFdpZHRoLiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGF1dG9IZWlnaHQgQXV0b21hdGljYWxseSBzZXQgdGhlIGhlaWdodCBvZiB0aGUgY29tcG9uZW50IHRvIGJlIHRoZSBzYW1lIGFzXG4gKiB0aGUgdGV4dEhlaWdodC4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGZpdE1vZGUgU2V0IGhvdyB0aGUgY29udGVudCBzaG91bGQgYmUgZml0dGVkIGFuZCBwcmVzZXJ2ZSB0aGUgYXNwZWN0IHJhdGlvIG9mXG4gKiB0aGUgc291cmNlIHRleHR1cmUgb3Igc3ByaXRlLiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGZvbnRBc3NldCBUaGUgaWQgb2YgdGhlIGZvbnQgYXNzZXQgdXNlZCBmb3IgcmVuZGVyaW5nIHRoZSB0ZXh0LiBPbmx5IHdvcmtzXG4gKiBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtGb250fSBmb250IFRoZSBmb250IHVzZWQgZm9yIHJlbmRlcmluZyB0aGUgdGV4dC4gT25seSB3b3JrcyBmb3JcbiAqIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmb250U2l6ZSBUaGUgc2l6ZSBvZiB0aGUgZm9udC4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX1RFWFR9IHR5cGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhdXRvRml0V2lkdGggV2hlbiB0cnVlIHRoZSBmb250IHNpemUgYW5kIGxpbmUgaGVpZ2h0IHdpbGwgc2NhbGUgc28gdGhhdCB0aGVcbiAqIHRleHQgZml0cyBpbnNpZGUgdGhlIHdpZHRoIG9mIHRoZSBFbGVtZW50LiBUaGUgZm9udCBzaXplIHdpbGwgYmUgc2NhbGVkIGJldHdlZW4gbWluRm9udFNpemUgYW5kXG4gKiBtYXhGb250U2l6ZS4gVGhlIHZhbHVlIG9mIGF1dG9GaXRXaWR0aCB3aWxsIGJlIGlnbm9yZWQgaWYgYXV0b1dpZHRoIGlzIHRydWUuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGF1dG9GaXRIZWlnaHQgV2hlbiB0cnVlIHRoZSBmb250IHNpemUgYW5kIGxpbmUgaGVpZ2h0IHdpbGwgc2NhbGUgc28gdGhhdCB0aGVcbiAqIHRleHQgZml0cyBpbnNpZGUgdGhlIGhlaWdodCBvZiB0aGUgRWxlbWVudC4gVGhlIGZvbnQgc2l6ZSB3aWxsIGJlIHNjYWxlZCBiZXR3ZWVuIG1pbkZvbnRTaXplIGFuZFxuICogbWF4Rm9udFNpemUuIFRoZSB2YWx1ZSBvZiBhdXRvRml0SGVpZ2h0IHdpbGwgYmUgaWdub3JlZCBpZiBhdXRvSGVpZ2h0IGlzIHRydWUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbWluRm9udFNpemUgVGhlIG1pbmltdW0gc2l6ZSB0aGF0IHRoZSBmb250IGNhbiBzY2FsZSB0byB3aGVuIGF1dG9GaXRXaWR0aCBvclxuICogYXV0b0ZpdEhlaWdodCBhcmUgdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXhGb250U2l6ZSBUaGUgbWF4aW11bSBzaXplIHRoYXQgdGhlIGZvbnQgY2FuIHNjYWxlIHRvIHdoZW4gYXV0b0ZpdFdpZHRoIG9yXG4gKiBhdXRvRml0SGVpZ2h0IGFyZSB0cnVlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNwYWNpbmcgVGhlIHNwYWNpbmcgYmV0d2VlbiB0aGUgbGV0dGVycyBvZiB0aGUgdGV4dC4gT25seSB3b3JrcyBmb3JcbiAqIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaW5lSGVpZ2h0IFRoZSBoZWlnaHQgb2YgZWFjaCBsaW5lIG9mIHRleHQuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHdyYXBMaW5lcyBXaGV0aGVyIHRvIGF1dG9tYXRpY2FsbHkgd3JhcCBsaW5lcyBiYXNlZCBvbiB0aGUgZWxlbWVudCB3aWR0aC5cbiAqIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcywgYW5kIHdoZW4gYXV0b1dpZHRoIGlzIHNldCB0byBmYWxzZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXhMaW5lcyBUaGUgbWF4aW11bSBudW1iZXIgb2YgbGluZXMgdGhhdCB0aGUgRWxlbWVudCBjYW4gd3JhcCB0by4gQW55XG4gKiBsZWZ0b3ZlciB0ZXh0IHdpbGwgYmUgYXBwZW5kZWQgdG8gdGhlIGxhc3QgbGluZS4gU2V0IHRoaXMgdG8gbnVsbCB0byBhbGxvdyB1bmxpbWl0ZWQgbGluZXMuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGFsaWdubWVudCBUaGUgaG9yaXpvbnRhbCBhbmQgdmVydGljYWwgYWxpZ25tZW50IG9mIHRoZSB0ZXh0LiBWYWx1ZXMgcmFuZ2UgZnJvbVxuICogMCB0byAxIHdoZXJlIFswLDBdIGlzIHRoZSBib3R0b20gbGVmdCBhbmQgWzEsMV0gaXMgdGhlIHRvcCByaWdodC4gIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gdGV4dCBUaGUgdGV4dCB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy4gVG9cbiAqIG92ZXJyaWRlIGNlcnRhaW4gdGV4dCBzdHlsaW5nIHByb3BlcnRpZXMgb24gYSBwZXItY2hhcmFjdGVyIGJhc2lzLCB0aGUgdGV4dCBjYW4gb3B0aW9uYWxseVxuICogaW5jbHVkZSBtYXJrdXAgdGFncyBjb250YWluZWQgd2l0aGluIHNxdWFyZSBicmFja2V0cy4gU3VwcG9ydGVkIHRhZ3MgYXJlOlxuICpcbiAqIC0gYGNvbG9yYCAtIG92ZXJyaWRlIHRoZSBlbGVtZW50J3MgYGNvbG9yYCBwcm9wZXJ0eS4gRXhhbXBsZXM6XG4gKiAgIC0gYFtjb2xvcj1cIiNmZjAwMDBcIl1yZWQgdGV4dFsvY29sb3JdYFxuICogICAtIGBbY29sb3I9XCIjMDBmZjAwXCJdZ3JlZW4gdGV4dFsvY29sb3JdYFxuICogICAtIGBbY29sb3I9XCIjMDAwMGZmXCJdYmx1ZSB0ZXh0Wy9jb2xvcl1gXG4gKiAtIGBvdXRsaW5lYCAtIG92ZXJyaWRlIHRoZSBlbGVtZW50J3MgYG91dGxpbmVDb2xvcmAgYW5kIGBvdXRsaW5lVGhpY2tuZXNzYCBwcm9wZXJ0aWVzLiBFeGFtcGxlOlxuICogICAtIGBbb3V0bGluZSBjb2xvcj1cIiNmZmZmZmZcIiB0aGlja25lc3M9XCIwLjVcIl10ZXh0Wy9vdXRsaW5lXWBcbiAqIC0gYHNoYWRvd2AgLSBvdmVycmlkZSB0aGUgZWxlbWVudCdzIGBzaGFkb3dDb2xvcmAgYW5kIGBzaGFkb3dPZmZzZXRgIHByb3BlcnRpZXMuIEV4YW1wbGVzOlxuICogICAtIGBbc2hhZG93IGNvbG9yPVwiI2ZmZmZmZlwiIG9mZnNldD1cIjAuNVwiXXRleHRbL3NoYWRvd11gXG4gKiAgIC0gYFtzaGFkb3cgY29sb3I9XCIjMDAwMDAwXCIgb2Zmc2V0WD1cIjAuMVwiIG9mZnNldFk9XCIwLjJcIl10ZXh0Wy9zaGFkb3ddYFxuICpcbiAqIE5vdGUgdGhhdCBtYXJrdXAgdGFncyBhcmUgb25seSBwcm9jZXNzZWQgaWYgdGhlIHRleHQgZWxlbWVudCdzIGBlbmFibGVNYXJrdXBgIHByb3BlcnR5IGlzIHNldCB0b1xuICogdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBrZXkgVGhlIGxvY2FsaXphdGlvbiBrZXkgdG8gdXNlIHRvIGdldCB0aGUgbG9jYWxpemVkIHRleHQgZnJvbVxuICoge0BsaW5rIEFwcGxpY2F0aW9uI2kxOG59LiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gdGV4dHVyZUFzc2V0IFRoZSBpZCBvZiB0aGUgdGV4dHVyZSBhc3NldCB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtUZXh0dXJlfSB0ZXh0dXJlIFRoZSB0ZXh0dXJlIHRvIHJlbmRlci4gT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfVxuICogdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3ByaXRlQXNzZXQgVGhlIGlkIG9mIHRoZSBzcHJpdGUgYXNzZXQgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcyB3aGljaCBjYW4gcmVuZGVyIGVpdGhlciBhIHRleHR1cmUgb3IgYSBzcHJpdGUuXG4gKiBAcHJvcGVydHkge1Nwcml0ZX0gc3ByaXRlIFRoZSBzcHJpdGUgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzXG4gKiB3aGljaCBjYW4gcmVuZGVyIGVpdGhlciBhIHRleHR1cmUgb3IgYSBzcHJpdGUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3ByaXRlRnJhbWUgVGhlIGZyYW1lIG9mIHRoZSBzcHJpdGUgdG8gcmVuZGVyLiBPbmx5IHdvcmtzIGZvclxuICoge0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcyB3aG8gaGF2ZSBhIHNwcml0ZSBhc3NpZ25lZC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBwaXhlbHNQZXJVbml0IFRoZSBudW1iZXIgb2YgcGl4ZWxzIHRoYXQgbWFwIHRvIG9uZSBQbGF5Q2FudmFzIHVuaXQuIE9ubHlcbiAqIHdvcmtzIGZvciB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzIHdobyBoYXZlIGEgc2xpY2VkIHNwcml0ZSBhc3NpZ25lZC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtYXRlcmlhbEFzc2V0IFRoZSBpZCBvZiB0aGUgbWF0ZXJpYWwgYXNzZXQgdG8gdXNlIHdoZW4gcmVuZGVyaW5nIGFuIGltYWdlLlxuICogT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7TWF0ZXJpYWx9IG1hdGVyaWFsIFRoZSBtYXRlcmlhbCB0byB1c2Ugd2hlbiByZW5kZXJpbmcgYW4gaW1hZ2UuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9IHR5cGVzLlxuICogQHByb3BlcnR5IHtWZWM0fSByZWN0IFNwZWNpZmllcyB3aGljaCByZWdpb24gb2YgdGhlIHRleHR1cmUgdG8gdXNlIGluIG9yZGVyIHRvIHJlbmRlciBhbiBpbWFnZS5cbiAqIFZhbHVlcyByYW5nZSBmcm9tIDAgdG8gMSBhbmQgaW5kaWNhdGUgdSwgdiwgd2lkdGgsIGhlaWdodC4gT25seSB3b3JrcyBmb3JcbiAqIHtAbGluayBFTEVNRU5UVFlQRV9JTUFHRX0gdHlwZXMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHJ0bFJlb3JkZXIgUmVvcmRlciB0aGUgdGV4dCBmb3IgUlRMIGxhbmd1YWdlcyB1c2luZyBhIGZ1bmN0aW9uIHJlZ2lzdGVyZWRcbiAqIGJ5IGBhcHAuc3lzdGVtcy5lbGVtZW50LnJlZ2lzdGVyVW5pY29kZUNvbnZlcnRlcmAuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVuaWNvZGVDb252ZXJ0ZXIgQ29udmVydCB1bmljb2RlIGNoYXJhY3RlcnMgdXNpbmcgYSBmdW5jdGlvbiByZWdpc3RlcmVkIGJ5XG4gKiBgYXBwLnN5c3RlbXMuZWxlbWVudC5yZWdpc3RlclVuaWNvZGVDb252ZXJ0ZXJgLlxuICogQHByb3BlcnR5IHtib29sZWFufSBlbmFibGVNYXJrdXAgRmxhZyBmb3IgZW5hYmxpbmcgbWFya3VwIHByb2Nlc3NpbmcuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJhbmdlU3RhcnQgSW5kZXggb2YgdGhlIGZpcnN0IGNoYXJhY3RlciB0byByZW5kZXIuIE9ubHkgd29ya3MgZm9yXG4gKiB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH0gdHlwZXMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gcmFuZ2VFbmQgSW5kZXggb2YgdGhlIGxhc3QgY2hhcmFjdGVyIHRvIHJlbmRlci4gT25seSB3b3JrcyBmb3JcbiAqIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbWFzayBTd2l0Y2ggSW1hZ2UgRWxlbWVudCBpbnRvIGEgbWFzay4gTWFza3MgZG8gbm90IHJlbmRlciBpbnRvIHRoZSBzY2VuZSxcbiAqIGJ1dCBpbnN0ZWFkIGxpbWl0IGNoaWxkIGVsZW1lbnRzIHRvIG9ubHkgYmUgcmVuZGVyZWQgd2hlcmUgdGhpcyBlbGVtZW50IGlzIHJlbmRlcmVkLlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBFbGVtZW50Q29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgRWxlbWVudENvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudENvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0IGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgLy8gc2V0IHRvIHRydWUgYnkgdGhlIEVsZW1lbnRDb21wb25lbnRTeXN0ZW0gd2hpbGVcbiAgICAgICAgLy8gdGhlIGNvbXBvbmVudCBpcyBiZWluZyBpbml0aWFsaXplZFxuICAgICAgICB0aGlzLl9iZWluZ0luaXRpYWxpemVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fYW5jaG9yID0gbmV3IFZlYzQoKTtcbiAgICAgICAgdGhpcy5fbG9jYWxBbmNob3IgPSBuZXcgVmVjNCgpO1xuXG4gICAgICAgIHRoaXMuX3Bpdm90ID0gbmV3IFZlYzIoKTtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCA9IDMyO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0ID0gMzI7XG5cbiAgICAgICAgdGhpcy5fbWFyZ2luID0gbmV3IFZlYzQoMCwgMCwgLTMyLCAtMzIpO1xuXG4gICAgICAgIC8vIHRoZSBtb2RlbCB0cmFuc2Zvcm0gdXNlZCB0byByZW5kZXJcbiAgICAgICAgdGhpcy5fbW9kZWxUcmFuc2Zvcm0gPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgIHRoaXMuX3NjcmVlblRvV29ybGQgPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgIC8vIHRyYW5zZm9ybSB0aGF0IHVwZGF0ZXMgbG9jYWwgcG9zaXRpb24gYWNjb3JkaW5nIHRvIGFuY2hvciB2YWx1ZXNcbiAgICAgICAgdGhpcy5fYW5jaG9yVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcblxuICAgICAgICB0aGlzLl9hbmNob3JEaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgLy8gdHJhbnNmb3JtcyB0byBjYWxjdWxhdGUgc2NyZWVuIGNvb3JkaW5hdGVzXG4gICAgICAgIHRoaXMuX3BhcmVudFdvcmxkVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcbiAgICAgICAgdGhpcy5fc2NyZWVuVHJhbnNmb3JtID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvLyB0aGUgY29ybmVycyBvZiB0aGUgZWxlbWVudCByZWxhdGl2ZSB0byBpdHMgc2NyZWVuIGNvbXBvbmVudC5cbiAgICAgICAgLy8gT3JkZXIgaXMgYm90dG9tIGxlZnQsIGJvdHRvbSByaWdodCwgdG9wIHJpZ2h0LCB0b3AgbGVmdFxuICAgICAgICB0aGlzLl9zY3JlZW5Db3JuZXJzID0gW25ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKCksIG5ldyBWZWMzKCldO1xuXG4gICAgICAgIC8vIGNhbnZhcy1zcGFjZSBjb3JuZXJzIG9mIHRoZSBlbGVtZW50LlxuICAgICAgICAvLyBPcmRlciBpcyBib3R0b20gbGVmdCwgYm90dG9tIHJpZ2h0LCB0b3AgcmlnaHQsIHRvcCBsZWZ0XG4gICAgICAgIHRoaXMuX2NhbnZhc0Nvcm5lcnMgPSBbbmV3IFZlYzIoKSwgbmV3IFZlYzIoKSwgbmV3IFZlYzIoKSwgbmV3IFZlYzIoKV07XG5cbiAgICAgICAgLy8gdGhlIHdvcmxkLXNwYWNlIGNvcm5lcnMgb2YgdGhlIGVsZW1lbnRcbiAgICAgICAgLy8gT3JkZXIgaXMgYm90dG9tIGxlZnQsIGJvdHRvbSByaWdodCwgdG9wIHJpZ2h0LCB0b3AgbGVmdFxuICAgICAgICB0aGlzLl93b3JsZENvcm5lcnMgPSBbbmV3IFZlYzMoKSwgbmV3IFZlYzMoKSwgbmV3IFZlYzMoKSwgbmV3IFZlYzMoKV07XG5cbiAgICAgICAgdGhpcy5fY29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY2FudmFzQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fd29ybGRDb3JuZXJzRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuZW50aXR5Lm9uKCdpbnNlcnQnLCB0aGlzLl9vbkluc2VydCwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5fcGF0Y2goKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIEVudGl0eSB3aXRoIGEge0BsaW5rIFNjcmVlbkNvbXBvbmVudH0gdGhhdCB0aGlzIGNvbXBvbmVudCBiZWxvbmdzIHRvLiBUaGlzIGlzXG4gICAgICAgICAqIGF1dG9tYXRpY2FsbHkgc2V0IHdoZW4gdGhlIGNvbXBvbmVudCBpcyBhIGNoaWxkIG9mIGEgU2NyZWVuQ29tcG9uZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RW50aXR5fG51bGx9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjcmVlbiA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fdHlwZSA9IEVMRU1FTlRUWVBFX0dST1VQO1xuXG4gICAgICAgIC8vIGVsZW1lbnQgdHlwZXNcbiAgICAgICAgdGhpcy5faW1hZ2UgPSBudWxsO1xuICAgICAgICB0aGlzLl90ZXh0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZ3JvdXAgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IDA7XG5cbiAgICAgICAgLy8gRml0IG1vZGVcbiAgICAgICAgdGhpcy5fZml0TW9kZSA9IEZJVE1PREVfU1RSRVRDSDtcblxuICAgICAgICAvLyBpbnB1dCByZWxhdGVkXG4gICAgICAgIHRoaXMuX3VzZUlucHV0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gW0xBWUVSSURfVUldOyAvLyBhc3NpZ24gdG8gdGhlIGRlZmF1bHQgVUkgbGF5ZXJcbiAgICAgICAgdGhpcy5fYWRkZWRNb2RlbHMgPSBbXTsgLy8gc3RvcmUgbW9kZWxzIHRoYXQgaGF2ZSBiZWVuIGFkZGVkIHRvIGxheWVyIHNvIHdlIGNhbiByZS1hZGQgd2hlbiBsYXllciBpcyBjaGFuZ2VkXG5cbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cElkID0gLTE7XG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgdGhpcy5fYmF0Y2hHcm91cCA9IG51bGw7XG4gICAgICAgIC8vICNlbmRpZlxuICAgICAgICAvL1xuXG4gICAgICAgIHRoaXMuX29mZnNldFJlYWRBdCA9IDA7XG4gICAgICAgIHRoaXMuX21hc2tPZmZzZXQgPSAwLjU7XG4gICAgICAgIHRoaXMuX21hc2tlZEJ5ID0gbnVsbDsgLy8gdGhlIGVudGl0eSB0aGF0IGlzIG1hc2tpbmcgdGhpcyBlbGVtZW50XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgbW91c2UgaXMgcHJlc3NlZCB3aGlsZSB0aGUgY3Vyc29yIGlzIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlblxuICAgICAqIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCNtb3VzZWRvd25cbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGlzIHJlbGVhc2VkIHdoaWxlIHRoZSBjdXJzb3IgaXMgb24gdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuXG4gICAgICogdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I21vdXNldXBcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGN1cnNvciBlbnRlcnMgdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCNtb3VzZWVudGVyXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBjdXJzb3IgbGVhdmVzIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjbW91c2VsZWF2ZVxuICAgICAqIEBwYXJhbSB7RWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgbW91c2UgY3Vyc29yIGlzIG1vdmVkIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjbW91c2Vtb3ZlXG4gICAgICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSB3aGVlbCBpcyBzY3JvbGxlZCBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I21vdXNld2hlZWxcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGlzIHByZXNzZWQgYW5kIHJlbGVhc2VkIG9uIHRoZSBjb21wb25lbnQgb3Igd2hlbiBhIHRvdWNoIHN0YXJ0cyBhbmRcbiAgICAgKiBlbmRzIG9uIHRoZSBjb21wb25lbnQuIE9ubHkgZmlyZWQgd2hlbiB1c2VJbnB1dCBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjY2xpY2tcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fEVsZW1lbnRUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYSB0b3VjaCBzdGFydHMgb24gdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCN0b3VjaHN0YXJ0XG4gICAgICogQHBhcmFtIHtFbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgdG91Y2ggZW5kcyBvbiB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXQgaXMgdHJ1ZS5cbiAgICAgKlxuICAgICAqIEBldmVudCBFbGVtZW50Q29tcG9uZW50I3RvdWNoZW5kXG4gICAgICogQHBhcmFtIHtFbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgdG91Y2ggbW92ZXMgYWZ0ZXIgaXQgc3RhcnRlZCB0b3VjaGluZyB0aGUgY29tcG9uZW50LiBPbmx5IGZpcmVkIHdoZW4gdXNlSW5wdXRcbiAgICAgKiBpcyB0cnVlLlxuICAgICAqXG4gICAgICogQGV2ZW50IEVsZW1lbnRDb21wb25lbnQjdG91Y2htb3ZlXG4gICAgICogQHBhcmFtIHtFbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgdG91Y2ggaXMgY2FuY2VsZWQgb24gdGhlIGNvbXBvbmVudC4gT25seSBmaXJlZCB3aGVuIHVzZUlucHV0IGlzIHRydWUuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgRWxlbWVudENvbXBvbmVudCN0b3VjaGNhbmNlbFxuICAgICAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICAgICAqL1xuXG4gICAgZ2V0IF9hYnNMZWZ0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxBbmNob3IueCArIHRoaXMuX21hcmdpbi54O1xuICAgIH1cblxuICAgIGdldCBfYWJzUmlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbEFuY2hvci56IC0gdGhpcy5fbWFyZ2luLno7XG4gICAgfVxuXG4gICAgZ2V0IF9hYnNUb3AoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbEFuY2hvci53IC0gdGhpcy5fbWFyZ2luLnc7XG4gICAgfVxuXG4gICAgZ2V0IF9hYnNCb3R0b20oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2NhbEFuY2hvci55ICsgdGhpcy5fbWFyZ2luLnk7XG4gICAgfVxuXG4gICAgZ2V0IF9oYXNTcGxpdEFuY2hvcnNYKCkge1xuICAgICAgICByZXR1cm4gTWF0aC5hYnModGhpcy5fYW5jaG9yLnggLSB0aGlzLl9hbmNob3IueikgPiAwLjAwMTtcbiAgICB9XG5cbiAgICBnZXQgX2hhc1NwbGl0QW5jaG9yc1koKSB7XG4gICAgICAgIHJldHVybiBNYXRoLmFicyh0aGlzLl9hbmNob3IueSAtIHRoaXMuX2FuY2hvci53KSA+IDAuMDAxO1xuICAgIH1cblxuICAgIGdldCBhYWJiKCkge1xuICAgICAgICBpZiAodGhpcy5faW1hZ2UpIHJldHVybiB0aGlzLl9pbWFnZS5hYWJiO1xuICAgICAgICBpZiAodGhpcy5fdGV4dCkgcmV0dXJuIHRoaXMuX3RleHQuYWFiYjtcblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTcGVjaWZpZXMgd2hlcmUgdGhlIGxlZnQsIGJvdHRvbSwgcmlnaHQgYW5kIHRvcCBlZGdlcyBvZiB0aGUgY29tcG9uZW50IGFyZSBhbmNob3JlZCByZWxhdGl2ZVxuICAgICAqIHRvIGl0cyBwYXJlbnQuIEVhY2ggdmFsdWUgcmFuZ2VzIGZyb20gMCB0byAxLiBlLmcuIGEgdmFsdWUgb2YgWzAsIDAsIDAsIDBdIG1lYW5zIHRoYXQgdGhlXG4gICAgICogZWxlbWVudCB3aWxsIGJlIGFuY2hvcmVkIHRvIHRoZSBib3R0b20gbGVmdCBvZiBpdHMgcGFyZW50LiBBIHZhbHVlIG9mIFsxLCAxLCAxLCAxXSBtZWFucyBpdFxuICAgICAqIHdpbGwgYmUgYW5jaG9yZWQgdG8gdGhlIHRvcCByaWdodC4gQSBzcGxpdCBhbmNob3IgaXMgd2hlbiB0aGUgbGVmdC1yaWdodCBvciB0b3AtYm90dG9tIHBhaXJzXG4gICAgICogb2YgdGhlIGFuY2hvciBhcmUgbm90IGVxdWFsLiBJbiB0aGF0IGNhc2UgdGhlIGNvbXBvbmVudCB3aWxsIGJlIHJlc2l6ZWQgdG8gY292ZXIgdGhhdCBlbnRpcmVcbiAgICAgKiBhcmVhLiBlLmcuIGEgdmFsdWUgb2YgWzAsIDAsIDEsIDFdIHdpbGwgbWFrZSB0aGUgY29tcG9uZW50IHJlc2l6ZSBleGFjdGx5IGFzIGl0cyBwYXJlbnQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmFwcC5yb290LmZpbmRCeU5hbWUoXCJJbnZlbnRvcnlcIikuZWxlbWVudC5hbmNob3IgPSBuZXcgcGMuVmVjNChNYXRoLnJhbmRvbSgpICogMC4xLCAwLCAxLCAwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmFwcC5yb290LmZpbmRCeU5hbWUoXCJJbnZlbnRvcnlcIikuZWxlbWVudC5hbmNob3IgPSBbTWF0aC5yYW5kb20oKSAqIDAuMSwgMCwgMSwgMF07XG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjNCB8IG51bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBhbmNob3IodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVmVjNCkge1xuICAgICAgICAgICAgdGhpcy5fYW5jaG9yLmNvcHkodmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fYW5jaG9yLnNldCguLi52YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuZW50aXR5Ll9wYXJlbnQgJiYgIXRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl9jYWxjdWxhdGVMb2NhbEFuY2hvcnMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNpemUodGhpcy5faGFzU3BsaXRBbmNob3JzWCwgdGhpcy5faGFzU3BsaXRBbmNob3JzWSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hbmNob3JEaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgaWYgKCF0aGlzLmVudGl0eS5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuZW50aXR5Ll9kaXJ0aWZ5TG9jYWwoKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDphbmNob3InLCB0aGlzLl9hbmNob3IpO1xuICAgIH1cblxuICAgIGdldCBhbmNob3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmNob3I7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIGVsZW1lbnQgdG8gYSBzcGVjaWZpYyBiYXRjaCBncm91cCAoc2VlIHtAbGluayBCYXRjaEdyb3VwfSkuIERlZmF1bHQgaXMgLTEgKG5vIGdyb3VwKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGJhdGNoR3JvdXBJZCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLkVMRU1FTlQsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB2YWx1ZSA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuRUxFTUVOVCwgdmFsdWUsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA8IDAgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIHJlLWFkZCBtb2RlbCB0byBzY2VuZSwgaW4gY2FzZSBpdCB3YXMgcmVtb3ZlZCBieSBiYXRjaGluZ1xuICAgICAgICAgICAgaWYgKHRoaXMuX2ltYWdlICYmIHRoaXMuX2ltYWdlLl9yZW5kZXJhYmxlLm1vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKHRoaXMuX2ltYWdlLl9yZW5kZXJhYmxlLm1vZGVsKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdGV4dCAmJiB0aGlzLl90ZXh0Ll9tb2RlbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycyh0aGlzLl90ZXh0Ll9tb2RlbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYmF0Y2hHcm91cElkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSBib3R0b20gZWRnZSBvZiB0aGUgYW5jaG9yLiBDYW4gYmUgdXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIGEgc3BsaXRcbiAgICAgKiBhbmNob3IgdG8gbWFrZSB0aGUgY29tcG9uZW50J3MgdG9wIGVkZ2UgYWx3YXlzIGJlICd0b3AnIHVuaXRzIGF3YXkgZnJvbSB0aGUgdG9wLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYm90dG9tKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX21hcmdpbi55ID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IHAgPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCk7XG4gICAgICAgIGNvbnN0IHd0ID0gdGhpcy5fYWJzVG9wO1xuICAgICAgICBjb25zdCB3YiA9IHRoaXMuX2xvY2FsQW5jaG9yLnkgKyB2YWx1ZTtcbiAgICAgICAgdGhpcy5fc2V0SGVpZ2h0KHd0IC0gd2IpO1xuXG4gICAgICAgIHAueSA9IHZhbHVlICsgdGhpcy5fY2FsY3VsYXRlZEhlaWdodCAqIHRoaXMuX3Bpdm90Lnk7XG4gICAgICAgIHRoaXMuZW50aXR5LnNldExvY2FsUG9zaXRpb24ocCk7XG4gICAgfVxuXG4gICAgZ2V0IGJvdHRvbSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcmdpbi55O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBhdCB3aGljaCB0aGUgZWxlbWVudCB3aWxsIGJlIHJlbmRlcmVkLiBJbiBtb3N0IGNhc2VzIHRoaXMgd2lsbCBiZSB0aGUgc2FtZSBhc1xuICAgICAqIGB3aWR0aGAuIEhvd2V2ZXIsIGluIHNvbWUgY2FzZXMgdGhlIGVuZ2luZSBtYXkgY2FsY3VsYXRlIGEgZGlmZmVyZW50IHdpZHRoIGZvciB0aGUgZWxlbWVudCxcbiAgICAgKiBzdWNoIGFzIHdoZW4gdGhlIGVsZW1lbnQgaXMgdW5kZXIgdGhlIGNvbnRyb2wgb2YgYSB7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnR9LiBJbiB0aGVzZVxuICAgICAqIHNjZW5hcmlvcywgYGNhbGN1bGF0ZWRXaWR0aGAgbWF5IGJlIHNtYWxsZXIgb3IgbGFyZ2VyIHRoYW4gdGhlIHdpZHRoIHRoYXQgd2FzIHNldCBpbiB0aGVcbiAgICAgKiBlZGl0b3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjYWxjdWxhdGVkV2lkdGgodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZFdpZHRoKHZhbHVlLCB0cnVlKTtcbiAgICB9XG5cbiAgICBnZXQgY2FsY3VsYXRlZFdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FsY3VsYXRlZFdpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgYXQgd2hpY2ggdGhlIGVsZW1lbnQgd2lsbCBiZSByZW5kZXJlZC4gSW4gbW9zdCBjYXNlcyB0aGlzIHdpbGwgYmUgdGhlIHNhbWUgYXNcbiAgICAgKiBgaGVpZ2h0YC4gSG93ZXZlciwgaW4gc29tZSBjYXNlcyB0aGUgZW5naW5lIG1heSBjYWxjdWxhdGUgYSBkaWZmZXJlbnQgaGVpZ2h0IGZvciB0aGUgZWxlbWVudCxcbiAgICAgKiBzdWNoIGFzIHdoZW4gdGhlIGVsZW1lbnQgaXMgdW5kZXIgdGhlIGNvbnRyb2wgb2YgYSB7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnR9LiBJbiB0aGVzZVxuICAgICAqIHNjZW5hcmlvcywgYGNhbGN1bGF0ZWRIZWlnaHRgIG1heSBiZSBzbWFsbGVyIG9yIGxhcmdlciB0aGFuIHRoZSBoZWlnaHQgdGhhdCB3YXMgc2V0IGluIHRoZVxuICAgICAqIGVkaXRvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGNhbGN1bGF0ZWRIZWlnaHQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZEhlaWdodCh2YWx1ZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IGNhbGN1bGF0ZWRIZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIDQge0BsaW5rIFZlYzJ9cyB0aGF0IHJlcHJlc2VudCB0aGUgYm90dG9tIGxlZnQsIGJvdHRvbSByaWdodCwgdG9wIHJpZ2h0IGFuZCB0b3BcbiAgICAgKiBsZWZ0IGNvcm5lcnMgb2YgdGhlIGNvbXBvbmVudCBpbiBjYW52YXMgcGl4ZWxzLiBPbmx5IHdvcmtzIGZvciBzY3JlZW4gc3BhY2UgZWxlbWVudFxuICAgICAqIGNvbXBvbmVudHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjMltdfVxuICAgICAqL1xuICAgIGdldCBjYW52YXNDb3JuZXJzKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2NhbnZhc0Nvcm5lcnNEaXJ0eSB8fCAhdGhpcy5zY3JlZW4gfHwgIXRoaXMuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9jYW52YXNDb3JuZXJzO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgY29uc3Qgc2NyZWVuQ29ybmVycyA9IHRoaXMuc2NyZWVuQ29ybmVycztcbiAgICAgICAgY29uc3Qgc3ggPSBkZXZpY2UuY2FudmFzLmNsaWVudFdpZHRoIC8gZGV2aWNlLndpZHRoO1xuICAgICAgICBjb25zdCBzeSA9IGRldmljZS5jYW52YXMuY2xpZW50SGVpZ2h0IC8gZGV2aWNlLmhlaWdodDtcblxuICAgICAgICAvLyBzY2FsZSBzY3JlZW4gY29ybmVycyB0byBjYW52YXMgc2l6ZSBhbmQgcmV2ZXJzZSB5XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9jYW52YXNDb3JuZXJzW2ldLnNldChzY3JlZW5Db3JuZXJzW2ldLnggKiBzeCwgKGRldmljZS5oZWlnaHQgLSBzY3JlZW5Db3JuZXJzW2ldLnkpICogc3kpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FudmFzQ29ybmVyc0RpcnR5ID0gZmFsc2U7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2NhbnZhc0Nvcm5lcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGRyYXcgb3JkZXIgb2YgdGhlIGNvbXBvbmVudC4gQSBoaWdoZXIgdmFsdWUgbWVhbnMgdGhhdCB0aGUgY29tcG9uZW50IHdpbGwgYmUgcmVuZGVyZWQgb25cbiAgICAgKiB0b3Agb2Ygb3RoZXIgY29tcG9uZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGRyYXdPcmRlcih2YWx1ZSkge1xuICAgICAgICBsZXQgcHJpb3JpdHkgPSAwO1xuICAgICAgICBpZiAodGhpcy5zY3JlZW4pIHtcbiAgICAgICAgICAgIHByaW9yaXR5ID0gdGhpcy5zY3JlZW4uc2NyZWVuLnByaW9yaXR5O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlID4gMHhGRkZGRkYpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ0VsZW1lbnQuZHJhd09yZGVyIGxhcmdlciB0aGFuIG1heCBzaXplIG9mOiAnICsgMHhGRkZGRkYpO1xuICAgICAgICAgICAgdmFsdWUgPSAweEZGRkZGRjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNjcmVlbiBwcmlvcml0eSBpcyBzdG9yZWQgaW4gdGhlIHRvcCA4IGJpdHNcbiAgICAgICAgdGhpcy5fZHJhd09yZGVyID0gKHByaW9yaXR5IDw8IDI0KSArIHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDpkcmF3b3JkZXInLCB0aGlzLl9kcmF3T3JkZXIpO1xuICAgIH1cblxuICAgIGdldCBkcmF3T3JkZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgZWxlbWVudCBhcyBzZXQgaW4gdGhlIGVkaXRvci4gTm90ZSB0aGF0IGluIHNvbWUgY2FzZXMgdGhpcyBtYXkgbm90IHJlZmxlY3RcbiAgICAgKiB0aGUgdHJ1ZSBoZWlnaHQgYXQgd2hpY2ggdGhlIGVsZW1lbnQgaXMgcmVuZGVyZWQsIHN1Y2ggYXMgd2hlbiB0aGUgZWxlbWVudCBpcyB1bmRlciB0aGVcbiAgICAgKiBjb250cm9sIG9mIGEge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS4gU2VlIGBjYWxjdWxhdGVkSGVpZ2h0YCBpbiBvcmRlciB0byBlbnN1cmUgeW91IGFyZVxuICAgICAqIHJlYWRpbmcgdGhlIHRydWUgaGVpZ2h0IGF0IHdoaWNoIHRoZSBlbGVtZW50IHdpbGwgYmUgcmVuZGVyZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBoZWlnaHQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9oYXNTcGxpdEFuY2hvcnNZKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRDYWxjdWxhdGVkSGVpZ2h0KHZhbHVlLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OmhlaWdodCcsIHRoaXMuX2hlaWdodCk7XG4gICAgfVxuXG4gICAgZ2V0IGhlaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgZWxlbWVudCBzaG91bGQgYmVsb25nLiBEb24ndCBwdXNoLFxuICAgICAqIHBvcCwgc3BsaWNlIG9yIG1vZGlmeSB0aGlzIGFycmF5LCBpZiB5b3Ugd2FudCB0byBjaGFuZ2UgaXQgLSBzZXQgYSBuZXcgb25lIGluc3RlYWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IGxheWVycyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYWRkZWRNb2RlbHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0aGlzLl9hZGRlZE1vZGVscy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLl9hZGRlZE1vZGVsc1tqXS5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xheWVycyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkIHx8ICF0aGlzLl9hZGRlZE1vZGVscy5sZW5ndGgpIHJldHVybjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB0aGlzLl9hZGRlZE1vZGVscy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMuX2FkZGVkTW9kZWxzW2pdLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGRpc3RhbmNlIGZyb20gdGhlIGxlZnQgZWRnZSBvZiB0aGUgYW5jaG9yLiBDYW4gYmUgdXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIGEgc3BsaXRcbiAgICAgKiBhbmNob3IgdG8gbWFrZSB0aGUgY29tcG9uZW50J3MgbGVmdCBlZGdlIGFsd2F5cyBiZSAnbGVmdCcgdW5pdHMgYXdheSBmcm9tIHRoZSBsZWZ0LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbGVmdCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4ueCA9IHZhbHVlO1xuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3ciA9IHRoaXMuX2Fic1JpZ2h0O1xuICAgICAgICBjb25zdCB3bCA9IHRoaXMuX2xvY2FsQW5jaG9yLnggKyB2YWx1ZTtcbiAgICAgICAgdGhpcy5fc2V0V2lkdGgod3IgLSB3bCk7XG5cbiAgICAgICAgcC54ID0gdmFsdWUgKyB0aGlzLl9jYWxjdWxhdGVkV2lkdGggKiB0aGlzLl9waXZvdC54O1xuICAgICAgICB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHApO1xuICAgIH1cblxuICAgIGdldCBsZWZ0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFyZ2luLng7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGRpc3RhbmNlIGZyb20gdGhlIGxlZnQsIGJvdHRvbSwgcmlnaHQgYW5kIHRvcCBlZGdlcyBvZiB0aGUgYW5jaG9yLiBGb3IgZXhhbXBsZSBpZiB3ZSBhcmVcbiAgICAgKiB1c2luZyBhIHNwbGl0IGFuY2hvciBsaWtlIFswLDAsMSwxXSBhbmQgdGhlIG1hcmdpbiBpcyBbMCwwLDAsMF0gdGhlbiB0aGUgY29tcG9uZW50IHdpbGwgYmVcbiAgICAgKiB0aGUgc2FtZSB3aWR0aCBhbmQgaGVpZ2h0IGFzIGl0cyBwYXJlbnQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjNH1cbiAgICAgKi9cbiAgICBzZXQgbWFyZ2luKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX21hcmdpbi5jb3B5KHZhbHVlKTtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU2l6ZSh0cnVlLCB0cnVlKTtcbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6bWFyZ2luJywgdGhpcy5fbWFyZ2luKTtcbiAgICB9XG5cbiAgICBnZXQgbWFyZ2luKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFyZ2luO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZW50aXR5IHRoYXQgaXMgY3VycmVudGx5IG1hc2tpbmcgdGhpcyBlbGVtZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge0VudGl0eX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGdldCBtYXNrZWRCeSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hc2tlZEJ5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBwb3NpdGlvbiBvZiB0aGUgcGl2b3Qgb2YgdGhlIGNvbXBvbmVudCByZWxhdGl2ZSB0byBpdHMgYW5jaG9yLiBFYWNoIHZhbHVlIHJhbmdlcyBmcm9tIDBcbiAgICAgKiB0byAxIHdoZXJlIFswLDBdIGlzIHRoZSBib3R0b20gbGVmdCBhbmQgWzEsMV0gaXMgdGhlIHRvcCByaWdodC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuYXBwLnJvb3QuZmluZEJ5TmFtZShcIkludmVudG9yeVwiKS5lbGVtZW50LnBpdm90ID0gW01hdGgucmFuZG9tKCkgKiAwLjEsIE1hdGgucmFuZG9tKCkgKiAwLjFdO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuYXBwLnJvb3QuZmluZEJ5TmFtZShcIkludmVudG9yeVwiKS5lbGVtZW50LnBpdm90ID0gbmV3IHBjLlZlYzIoTWF0aC5yYW5kb20oKSAqIDAuMSwgTWF0aC5yYW5kb20oKSAqIDAuMSk7XG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVjMiB8IG51bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBwaXZvdCh2YWx1ZSkge1xuICAgICAgICBjb25zdCB7IHBpdm90LCBtYXJnaW4gfSA9IHRoaXM7XG4gICAgICAgIGNvbnN0IHByZXZYID0gcGl2b3QueDtcbiAgICAgICAgY29uc3QgcHJldlkgPSBwaXZvdC55O1xuXG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzIpIHtcbiAgICAgICAgICAgIHBpdm90LmNvcHkodmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGl2b3Quc2V0KC4uLnZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG14ID0gbWFyZ2luLnggKyBtYXJnaW4uejtcbiAgICAgICAgY29uc3QgZHggPSBwaXZvdC54IC0gcHJldlg7XG4gICAgICAgIG1hcmdpbi54ICs9IG14ICogZHg7XG4gICAgICAgIG1hcmdpbi56IC09IG14ICogZHg7XG5cbiAgICAgICAgY29uc3QgbXkgPSBtYXJnaW4ueSArIG1hcmdpbi53O1xuICAgICAgICBjb25zdCBkeSA9IHBpdm90LnkgLSBwcmV2WTtcbiAgICAgICAgbWFyZ2luLnkgKz0gbXkgKiBkeTtcbiAgICAgICAgbWFyZ2luLncgLT0gbXkgKiBkeTtcblxuICAgICAgICB0aGlzLl9hbmNob3JEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVTaXplKGZhbHNlLCBmYWxzZSk7XG5cbiAgICAgICAgLy8gd2UgbmVlZCB0byBmbGFnIGNoaWxkcmVuIGFzIGRpcnR5IHRvb1xuICAgICAgICAvLyBpbiBvcmRlciBmb3IgdGhlbSB0byB1cGRhdGUgdGhlaXIgcG9zaXRpb25cbiAgICAgICAgdGhpcy5fZmxhZ0NoaWxkcmVuQXNEaXJ0eSgpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OnBpdm90JywgcGl2b3QpO1xuICAgIH1cblxuICAgIGdldCBwaXZvdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bpdm90O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSByaWdodCBlZGdlIG9mIHRoZSBhbmNob3IuIENhbiBiZSB1c2VkIGluIGNvbWJpbmF0aW9uIHdpdGggYSBzcGxpdFxuICAgICAqIGFuY2hvciB0byBtYWtlIHRoZSBjb21wb25lbnQncyByaWdodCBlZGdlIGFsd2F5cyBiZSAncmlnaHQnIHVuaXRzIGF3YXkgZnJvbSB0aGUgcmlnaHQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByaWdodCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9tYXJnaW4ueiA9IHZhbHVlO1xuXG4gICAgICAgIC8vIHVwZGF0ZSB3aWR0aFxuICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICBjb25zdCB3bCA9IHRoaXMuX2Fic0xlZnQ7XG4gICAgICAgIGNvbnN0IHdyID0gdGhpcy5fbG9jYWxBbmNob3IueiAtIHZhbHVlO1xuICAgICAgICB0aGlzLl9zZXRXaWR0aCh3ciAtIHdsKTtcblxuICAgICAgICAvLyB1cGRhdGUgcG9zaXRpb25cbiAgICAgICAgcC54ID0gKHRoaXMuX2xvY2FsQW5jaG9yLnogLSB0aGlzLl9sb2NhbEFuY2hvci54KSAtIHZhbHVlIC0gKHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCAqICgxIC0gdGhpcy5fcGl2b3QueCkpO1xuICAgICAgICB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHApO1xuICAgIH1cblxuICAgIGdldCByaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcmdpbi56O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIDQge0BsaW5rIFZlYzN9cyB0aGF0IHJlcHJlc2VudCB0aGUgYm90dG9tIGxlZnQsIGJvdHRvbSByaWdodCwgdG9wIHJpZ2h0IGFuZCB0b3BcbiAgICAgKiBsZWZ0IGNvcm5lcnMgb2YgdGhlIGNvbXBvbmVudCByZWxhdGl2ZSB0byBpdHMgcGFyZW50IHtAbGluayBTY3JlZW5Db21wb25lbnR9LlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzNbXX1cbiAgICAgKi9cbiAgICBnZXQgc2NyZWVuQ29ybmVycygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb3JuZXJzRGlydHkgfHwgIXRoaXMuc2NyZWVuKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NjcmVlbkNvcm5lcnM7XG5cbiAgICAgICAgY29uc3QgcGFyZW50Qm90dG9tTGVmdCA9IHRoaXMuZW50aXR5LnBhcmVudCAmJiB0aGlzLmVudGl0eS5wYXJlbnQuZWxlbWVudCAmJiB0aGlzLmVudGl0eS5wYXJlbnQuZWxlbWVudC5zY3JlZW5Db3JuZXJzWzBdO1xuXG4gICAgICAgIC8vIGluaXQgY29ybmVyc1xuICAgICAgICB0aGlzLl9zY3JlZW5Db3JuZXJzWzBdLnNldCh0aGlzLl9hYnNMZWZ0LCB0aGlzLl9hYnNCb3R0b20sIDApO1xuICAgICAgICB0aGlzLl9zY3JlZW5Db3JuZXJzWzFdLnNldCh0aGlzLl9hYnNSaWdodCwgdGhpcy5fYWJzQm90dG9tLCAwKTtcbiAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVyc1syXS5zZXQodGhpcy5fYWJzUmlnaHQsIHRoaXMuX2Fic1RvcCwgMCk7XG4gICAgICAgIHRoaXMuX3NjcmVlbkNvcm5lcnNbM10uc2V0KHRoaXMuX2Fic0xlZnQsIHRoaXMuX2Fic1RvcCwgMCk7XG5cbiAgICAgICAgLy8gdHJhbnNmb3JtIGNvcm5lcnMgdG8gc2NyZWVuIHNwYWNlXG4gICAgICAgIGNvbnN0IHNjcmVlblNwYWNlID0gdGhpcy5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fc2NyZWVuVHJhbnNmb3JtLnRyYW5zZm9ybVBvaW50KHRoaXMuX3NjcmVlbkNvcm5lcnNbaV0sIHRoaXMuX3NjcmVlbkNvcm5lcnNbaV0pO1xuICAgICAgICAgICAgaWYgKHNjcmVlblNwYWNlKVxuICAgICAgICAgICAgICAgIHRoaXMuX3NjcmVlbkNvcm5lcnNbaV0ubXVsU2NhbGFyKHRoaXMuc2NyZWVuLnNjcmVlbi5zY2FsZSk7XG5cbiAgICAgICAgICAgIGlmIChwYXJlbnRCb3R0b21MZWZ0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2NyZWVuQ29ybmVyc1tpXS5hZGQocGFyZW50Qm90dG9tTGVmdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jb3JuZXJzRGlydHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fY2FudmFzQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fd29ybGRDb3JuZXJzRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9zY3JlZW5Db3JuZXJzO1xuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHdpZHRoIG9mIHRoZSB0ZXh0IHJlbmRlcmVkIGJ5IHRoZSBjb21wb25lbnQuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHRleHRXaWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHQgPyB0aGlzLl90ZXh0LndpZHRoIDogMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSB0ZXh0IHJlbmRlcmVkIGJ5IHRoZSBjb21wb25lbnQuIE9ubHkgd29ya3MgZm9yIHtAbGluayBFTEVNRU5UVFlQRV9URVhUfSB0eXBlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHRleHRIZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0ID8gdGhpcy5fdGV4dC5oZWlnaHQgOiAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB0b3AgZWRnZSBvZiB0aGUgYW5jaG9yLiBDYW4gYmUgdXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIGEgc3BsaXQgYW5jaG9yXG4gICAgICogdG8gbWFrZSB0aGUgY29tcG9uZW50J3MgYm90dG9tIGVkZ2UgYWx3YXlzIGJlICdib3R0b20nIHVuaXRzIGF3YXkgZnJvbSB0aGUgYm90dG9tLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgdG9wKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX21hcmdpbi53ID0gdmFsdWU7XG4gICAgICAgIGNvbnN0IHAgPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCk7XG4gICAgICAgIGNvbnN0IHdiID0gdGhpcy5fYWJzQm90dG9tO1xuICAgICAgICBjb25zdCB3dCA9IHRoaXMuX2xvY2FsQW5jaG9yLncgLSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fc2V0SGVpZ2h0KHd0IC0gd2IpO1xuXG4gICAgICAgIHAueSA9ICh0aGlzLl9sb2NhbEFuY2hvci53IC0gdGhpcy5fbG9jYWxBbmNob3IueSkgLSB2YWx1ZSAtIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQgKiAoMSAtIHRoaXMuX3Bpdm90LnkpO1xuICAgICAgICB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHApO1xuICAgIH1cblxuICAgIGdldCB0b3AoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXJnaW4udztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiB0aGUgRWxlbWVudENvbXBvbmVudC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRUxFTUVOVFRZUEVfR1JPVVB9OiBUaGUgY29tcG9uZW50IGNhbiBiZSB1c2VkIGFzIGEgbGF5b3V0IG1lY2hhbmlzbSB0byBjcmVhdGUgZ3JvdXBzIG9mXG4gICAgICogRWxlbWVudENvbXBvbmVudHMgZS5nLiBwYW5lbHMuXG4gICAgICogLSB7QGxpbmsgRUxFTUVOVFRZUEVfSU1BR0V9OiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGFuIGltYWdlXG4gICAgICogLSB7QGxpbmsgRUxFTUVOVFRZUEVfVEVYVH06IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgdGV4dFxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzZXQgdHlwZSh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX3R5cGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2UuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dC5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dCA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gRUxFTUVOVFRZUEVfSU1BR0UpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZSA9IG5ldyBJbWFnZUVsZW1lbnQodGhpcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSBFTEVNRU5UVFlQRV9URVhUKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdGV4dCA9IG5ldyBUZXh0RWxlbWVudCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZW4gdGhlIGNvbXBvbmVudCB3aWxsIHJlY2VpdmUgTW91c2Ugb3IgVG91Y2ggaW5wdXQgZXZlbnRzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHVzZUlucHV0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl91c2VJbnB1dCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fdXNlSW5wdXQgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dCkge1xuICAgICAgICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQuYWRkRWxlbWVudCh0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQucmVtb3ZlRWxlbWVudCh0aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl91c2VJbnB1dCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oJ0VsZW1lbnRzIHdpbGwgbm90IGdldCBhbnkgaW5wdXQgZXZlbnRzIGJlY2F1c2UgdGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dCBpcyBub3QgY3JlYXRlZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6dXNlSW5wdXQnLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgZ2V0IHVzZUlucHV0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdXNlSW5wdXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IGhvdyB0aGUgY29udGVudCBzaG91bGQgYmUgZml0dGVkIGFuZCBwcmVzZXJ2ZSB0aGUgYXNwZWN0IHJhdGlvIG9mIHRoZSBzb3VyY2UgdGV4dHVyZSBvciBzcHJpdGUuXG4gICAgICogT25seSB3b3JrcyBmb3Ige0BsaW5rIEVMRU1FTlRUWVBFX0lNQUdFfSB0eXBlcy4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklUTU9ERV9TVFJFVENIfTogRml0IHRoZSBjb250ZW50IGV4YWN0bHkgdG8gRWxlbWVudCdzIGJvdW5kaW5nIGJveC5cbiAgICAgKiAtIHtAbGluayBGSVRNT0RFX0NPTlRBSU59OiBGaXQgdGhlIGNvbnRlbnQgd2l0aGluIHRoZSBFbGVtZW50J3MgYm91bmRpbmcgYm94IHdoaWxlIHByZXNlcnZpbmcgaXRzIEFzcGVjdCBSYXRpby5cbiAgICAgKiAtIHtAbGluayBGSVRNT0RFX0NPVkVSfTogRml0IHRoZSBjb250ZW50IHRvIGNvdmVyIHRoZSBlbnRpcmUgRWxlbWVudCdzIGJvdW5kaW5nIGJveCB3aGlsZSBwcmVzZXJ2aW5nIGl0cyBBc3BlY3QgUmF0aW8uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCBmaXRNb2RlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2ZpdE1vZGUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fY2FsY3VsYXRlU2l6ZSh0cnVlLCB0cnVlKTtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSB7XG4gICAgICAgICAgICB0aGlzLl9pbWFnZS5yZWZyZXNoTWVzaCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZpdE1vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9maXRNb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgZWxlbWVudCBhcyBzZXQgaW4gdGhlIGVkaXRvci4gTm90ZSB0aGF0IGluIHNvbWUgY2FzZXMgdGhpcyBtYXkgbm90IHJlZmxlY3RcbiAgICAgKiB0aGUgdHJ1ZSB3aWR0aCBhdCB3aGljaCB0aGUgZWxlbWVudCBpcyByZW5kZXJlZCwgc3VjaCBhcyB3aGVuIHRoZSBlbGVtZW50IGlzIHVuZGVyIHRoZVxuICAgICAqIGNvbnRyb2wgb2YgYSB7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnR9LiBTZWUgYGNhbGN1bGF0ZWRXaWR0aGAgaW4gb3JkZXIgdG8gZW5zdXJlIHlvdSBhcmVcbiAgICAgKiByZWFkaW5nIHRoZSB0cnVlIHdpZHRoIGF0IHdoaWNoIHRoZSBlbGVtZW50IHdpbGwgYmUgcmVuZGVyZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCB3aWR0aCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl93aWR0aCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5faGFzU3BsaXRBbmNob3JzWCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZFdpZHRoKHZhbHVlLCB0cnVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OndpZHRoJywgdGhpcy5fd2lkdGgpO1xuICAgIH1cblxuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIDQge0BsaW5rIFZlYzN9cyB0aGF0IHJlcHJlc2VudCB0aGUgYm90dG9tIGxlZnQsIGJvdHRvbSByaWdodCwgdG9wIHJpZ2h0IGFuZCB0b3BcbiAgICAgKiBsZWZ0IGNvcm5lcnMgb2YgdGhlIGNvbXBvbmVudCBpbiB3b3JsZCBzcGFjZS4gT25seSB3b3JrcyBmb3IgM0QgZWxlbWVudCBjb21wb25lbnRzLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzNbXX1cbiAgICAgKi9cbiAgICBnZXQgd29ybGRDb3JuZXJzKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3dvcmxkQ29ybmVyc0RpcnR5KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fd29ybGRDb3JuZXJzO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICBjb25zdCBzY3JlZW5Db3JuZXJzID0gdGhpcy5zY3JlZW5Db3JuZXJzO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgICAgIG1hdEEuY29weSh0aGlzLnNjcmVlbi5zY3JlZW4uX3NjcmVlbk1hdHJpeCk7XG5cbiAgICAgICAgICAgICAgICAvLyBmbGlwIHNjcmVlbiBtYXRyaXggYWxvbmcgdGhlIGhvcml6b250YWwgYXhpc1xuICAgICAgICAgICAgICAgIG1hdEEuZGF0YVsxM10gPSAtbWF0QS5kYXRhWzEzXTtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSB0cmFuc2Zvcm0gdGhhdCBicmluZ3Mgc2NyZWVuIGNvcm5lcnMgdG8gd29ybGQgc3BhY2VcbiAgICAgICAgICAgICAgICBtYXRBLm11bDIodGhpcy5zY3JlZW4uZ2V0V29ybGRUcmFuc2Zvcm0oKSwgbWF0QSk7XG5cbiAgICAgICAgICAgICAgICAvLyB0cmFuc2Zvcm0gc2NyZWVuIGNvcm5lcnMgdG8gd29ybGQgc3BhY2VcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtYXRBLnRyYW5zZm9ybVBvaW50KHNjcmVlbkNvcm5lcnNbaV0sIHRoaXMuX3dvcmxkQ29ybmVyc1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgbG9jYWxQb3MgPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCk7XG5cbiAgICAgICAgICAgIC8vIHJvdGF0ZSBhbmQgc2NhbGUgYXJvdW5kIHBpdm90XG4gICAgICAgICAgICBtYXRBLnNldFRyYW5zbGF0ZSgtbG9jYWxQb3MueCwgLWxvY2FsUG9zLnksIC1sb2NhbFBvcy56KTtcbiAgICAgICAgICAgIG1hdEIuc2V0VFJTKFZlYzMuWkVSTywgdGhpcy5lbnRpdHkuZ2V0TG9jYWxSb3RhdGlvbigpLCB0aGlzLmVudGl0eS5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgbWF0Qy5zZXRUcmFuc2xhdGUobG9jYWxQb3MueCwgbG9jYWxQb3MueSwgbG9jYWxQb3Mueik7XG5cbiAgICAgICAgICAgIC8vIGdldCBwYXJlbnQgd29ybGQgdHJhbnNmb3JtIChidXQgdXNlIHRoaXMgZW50aXR5IGlmIHRoZXJlIGlzIG5vIHBhcmVudClcbiAgICAgICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuZW50aXR5LnBhcmVudCA/IHRoaXMuZW50aXR5LnBhcmVudCA6IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgbWF0RC5jb3B5KGVudGl0eS5nZXRXb3JsZFRyYW5zZm9ybSgpKTtcbiAgICAgICAgICAgIG1hdEQubXVsKG1hdEMpLm11bChtYXRCKS5tdWwobWF0QSk7XG5cbiAgICAgICAgICAgIC8vIGJvdHRvbSBsZWZ0XG4gICAgICAgICAgICB2ZWNBLnNldChsb2NhbFBvcy54IC0gdGhpcy5waXZvdC54ICogdGhpcy5jYWxjdWxhdGVkV2lkdGgsIGxvY2FsUG9zLnkgLSB0aGlzLnBpdm90LnkgKiB0aGlzLmNhbGN1bGF0ZWRIZWlnaHQsIGxvY2FsUG9zLnopO1xuICAgICAgICAgICAgbWF0RC50cmFuc2Zvcm1Qb2ludCh2ZWNBLCB0aGlzLl93b3JsZENvcm5lcnNbMF0pO1xuXG4gICAgICAgICAgICAvLyBib3R0b20gcmlnaHRcbiAgICAgICAgICAgIHZlY0Euc2V0KGxvY2FsUG9zLnggKyAoMSAtIHRoaXMucGl2b3QueCkgKiB0aGlzLmNhbGN1bGF0ZWRXaWR0aCwgbG9jYWxQb3MueSAtIHRoaXMucGl2b3QueSAqIHRoaXMuY2FsY3VsYXRlZEhlaWdodCwgbG9jYWxQb3Mueik7XG4gICAgICAgICAgICBtYXRELnRyYW5zZm9ybVBvaW50KHZlY0EsIHRoaXMuX3dvcmxkQ29ybmVyc1sxXSk7XG5cbiAgICAgICAgICAgIC8vIHRvcCByaWdodFxuICAgICAgICAgICAgdmVjQS5zZXQobG9jYWxQb3MueCArICgxIC0gdGhpcy5waXZvdC54KSAqIHRoaXMuY2FsY3VsYXRlZFdpZHRoLCBsb2NhbFBvcy55ICsgKDEgLSB0aGlzLnBpdm90LnkpICogdGhpcy5jYWxjdWxhdGVkSGVpZ2h0LCBsb2NhbFBvcy56KTtcbiAgICAgICAgICAgIG1hdEQudHJhbnNmb3JtUG9pbnQodmVjQSwgdGhpcy5fd29ybGRDb3JuZXJzWzJdKTtcblxuICAgICAgICAgICAgLy8gdG9wIGxlZnRcbiAgICAgICAgICAgIHZlY0Euc2V0KGxvY2FsUG9zLnggLSB0aGlzLnBpdm90LnggKiB0aGlzLmNhbGN1bGF0ZWRXaWR0aCwgbG9jYWxQb3MueSArICgxIC0gdGhpcy5waXZvdC55KSAqIHRoaXMuY2FsY3VsYXRlZEhlaWdodCwgbG9jYWxQb3Mueik7XG4gICAgICAgICAgICBtYXRELnRyYW5zZm9ybVBvaW50KHZlY0EsIHRoaXMuX3dvcmxkQ29ybmVyc1szXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl93b3JsZENvcm5lcnNEaXJ0eSA9IGZhbHNlO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl93b3JsZENvcm5lcnM7XG5cbiAgICB9XG5cbiAgICBfcGF0Y2goKSB7XG4gICAgICAgIHRoaXMuZW50aXR5Ll9zeW5jID0gdGhpcy5fc3luYztcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24gPSB0aGlzLl9zZXRQb3NpdGlvbjtcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbiA9IHRoaXMuX3NldExvY2FsUG9zaXRpb247XG4gICAgfVxuXG4gICAgX3VucGF0Y2goKSB7XG4gICAgICAgIHRoaXMuZW50aXR5Ll9zeW5jID0gRW50aXR5LnByb3RvdHlwZS5fc3luYztcbiAgICAgICAgdGhpcy5lbnRpdHkuc2V0UG9zaXRpb24gPSBFbnRpdHkucHJvdG90eXBlLnNldFBvc2l0aW9uO1xuICAgICAgICB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uID0gRW50aXR5LnByb3RvdHlwZS5zZXRMb2NhbFBvc2l0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdGNoZWQgbWV0aG9kIGZvciBzZXR0aW5nIHRoZSBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfFZlYzN9IHggLSBUaGUgeCBjb29yZGluYXRlIG9yIFZlYzNcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGVcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geiAtIFRoZSB6IGNvb3JkaW5hdGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRQb3NpdGlvbih4LCB5LCB6KSB7XG4gICAgICAgIGlmICghdGhpcy5lbGVtZW50LnNjcmVlbikge1xuICAgICAgICAgICAgRW50aXR5LnByb3RvdHlwZS5zZXRQb3NpdGlvbi5jYWxsKHRoaXMsIHgsIHksIHopO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICBwb3NpdGlvbi5jb3B5KHgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zaXRpb24uc2V0KHgsIHksIHopO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5nZXRXb3JsZFRyYW5zZm9ybSgpOyAvLyBlbnN1cmUgaGllcmFyY2h5IGlzIHVwIHRvIGRhdGVcbiAgICAgICAgaW52UGFyZW50V3RtLmNvcHkodGhpcy5lbGVtZW50Ll9zY3JlZW5Ub1dvcmxkKS5pbnZlcnQoKTtcbiAgICAgICAgaW52UGFyZW50V3RtLnRyYW5zZm9ybVBvaW50KHBvc2l0aW9uLCB0aGlzLmxvY2FsUG9zaXRpb24pO1xuXG4gICAgICAgIGlmICghdGhpcy5fZGlydHlMb2NhbClcbiAgICAgICAgICAgIHRoaXMuX2RpcnRpZnlMb2NhbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhdGNoZWQgbWV0aG9kIGZvciBzZXR0aW5nIHRoZSBsb2NhbCBwb3NpdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfFZlYzN9IHggLSBUaGUgeCBjb29yZGluYXRlIG9yIFZlYzNcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGVcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geiAtIFRoZSB6IGNvb3JkaW5hdGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRMb2NhbFBvc2l0aW9uKHgsIHksIHopIHtcbiAgICAgICAgaWYgKHggaW5zdGFuY2VvZiBWZWMzKSB7XG4gICAgICAgICAgICB0aGlzLmxvY2FsUG9zaXRpb24uY29weSh4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxQb3NpdGlvbi5zZXQoeCwgeSwgeik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB1cGRhdGUgbWFyZ2luXG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmVsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHAgPSB0aGlzLmxvY2FsUG9zaXRpb247XG4gICAgICAgIGNvbnN0IHB2dCA9IGVsZW1lbnQuX3Bpdm90O1xuICAgICAgICBlbGVtZW50Ll9tYXJnaW4ueCA9IHAueCAtIGVsZW1lbnQuX2NhbGN1bGF0ZWRXaWR0aCAqIHB2dC54O1xuICAgICAgICBlbGVtZW50Ll9tYXJnaW4ueiA9IChlbGVtZW50Ll9sb2NhbEFuY2hvci56IC0gZWxlbWVudC5fbG9jYWxBbmNob3IueCkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkV2lkdGggLSBlbGVtZW50Ll9tYXJnaW4ueDtcbiAgICAgICAgZWxlbWVudC5fbWFyZ2luLnkgPSBwLnkgLSBlbGVtZW50Ll9jYWxjdWxhdGVkSGVpZ2h0ICogcHZ0Lnk7XG4gICAgICAgIGVsZW1lbnQuX21hcmdpbi53ID0gKGVsZW1lbnQuX2xvY2FsQW5jaG9yLncgLSBlbGVtZW50Ll9sb2NhbEFuY2hvci55KSAtIGVsZW1lbnQuX2NhbGN1bGF0ZWRIZWlnaHQgLSBlbGVtZW50Ll9tYXJnaW4ueTtcblxuICAgICAgICBpZiAoIXRoaXMuX2RpcnR5TG9jYWwpXG4gICAgICAgICAgICB0aGlzLl9kaXJ0aWZ5TG9jYWwoKTtcbiAgICB9XG5cbiAgICAvLyB0aGlzIG1ldGhvZCBvdmVyd3JpdGVzIEdyYXBoTm9kZSNzeW5jIGFuZCBzbyBvcGVyYXRlcyBpbiBzY29wZSBvZiB0aGUgRW50aXR5LlxuICAgIF9zeW5jKCkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5lbGVtZW50O1xuICAgICAgICBjb25zdCBzY3JlZW4gPSBlbGVtZW50LnNjcmVlbjtcblxuICAgICAgICBpZiAoc2NyZWVuKSB7XG5cbiAgICAgICAgICAgIGlmIChlbGVtZW50Ll9hbmNob3JEaXJ0eSkge1xuICAgICAgICAgICAgICAgIGxldCByZXN4ID0gMDtcbiAgICAgICAgICAgICAgICBsZXQgcmVzeSA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IHB4ID0gMDtcbiAgICAgICAgICAgICAgICBsZXQgcHkgPSAxO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3BhcmVudCAmJiB0aGlzLl9wYXJlbnQuZWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICAvLyB1c2UgcGFyZW50IHJlY3RcbiAgICAgICAgICAgICAgICAgICAgcmVzeCA9IHRoaXMuX3BhcmVudC5lbGVtZW50LmNhbGN1bGF0ZWRXaWR0aDtcbiAgICAgICAgICAgICAgICAgICAgcmVzeSA9IHRoaXMuX3BhcmVudC5lbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIHB4ID0gdGhpcy5fcGFyZW50LmVsZW1lbnQucGl2b3QueDtcbiAgICAgICAgICAgICAgICAgICAgcHkgPSB0aGlzLl9wYXJlbnQuZWxlbWVudC5waXZvdC55O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHVzZSBzY3JlZW4gcmVjdFxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXNvbHV0aW9uID0gc2NyZWVuLnNjcmVlbi5yZXNvbHV0aW9uO1xuICAgICAgICAgICAgICAgICAgICByZXN4ID0gcmVzb2x1dGlvbi54IC8gc2NyZWVuLnNjcmVlbi5zY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgcmVzeSA9IHJlc29sdXRpb24ueSAvIHNjcmVlbi5zY3JlZW4uc2NhbGU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZWxlbWVudC5fYW5jaG9yVHJhbnNmb3JtLnNldFRyYW5zbGF0ZSgocmVzeCAqIChlbGVtZW50LmFuY2hvci54IC0gcHgpKSwgLShyZXN5ICogKHB5IC0gZWxlbWVudC5hbmNob3IueSkpLCAwKTtcbiAgICAgICAgICAgICAgICBlbGVtZW50Ll9hbmNob3JEaXJ0eSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuX2NhbGN1bGF0ZUxvY2FsQW5jaG9ycygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiBlbGVtZW50IHNpemUgaXMgZGlydHlcbiAgICAgICAgICAgIC8vIHJlY2FsY3VsYXRlIGl0cyBzaXplXG4gICAgICAgICAgICAvLyBXQVJOSU5HOiBPcmRlciBpcyBpbXBvcnRhbnQgYXMgY2FsY3VsYXRlU2l6ZSByZXNldHMgZGlydHlMb2NhbFxuICAgICAgICAgICAgLy8gc28gdGhpcyBuZWVkcyB0byBydW4gYmVmb3JlIHJlc2V0dGluZyBkaXJ0eUxvY2FsIHRvIGZhbHNlIGJlbG93XG4gICAgICAgICAgICBpZiAoZWxlbWVudC5fc2l6ZURpcnR5KSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5fY2FsY3VsYXRlU2l6ZShmYWxzZSwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5TG9jYWwpIHtcbiAgICAgICAgICAgIHRoaXMubG9jYWxUcmFuc2Zvcm0uc2V0VFJTKHRoaXMubG9jYWxQb3NpdGlvbiwgdGhpcy5sb2NhbFJvdGF0aW9uLCB0aGlzLmxvY2FsU2NhbGUpO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgbWFyZ2luXG4gICAgICAgICAgICBjb25zdCBwID0gdGhpcy5sb2NhbFBvc2l0aW9uO1xuICAgICAgICAgICAgY29uc3QgcHZ0ID0gZWxlbWVudC5fcGl2b3Q7XG4gICAgICAgICAgICBlbGVtZW50Ll9tYXJnaW4ueCA9IHAueCAtIGVsZW1lbnQuX2NhbGN1bGF0ZWRXaWR0aCAqIHB2dC54O1xuICAgICAgICAgICAgZWxlbWVudC5fbWFyZ2luLnogPSAoZWxlbWVudC5fbG9jYWxBbmNob3IueiAtIGVsZW1lbnQuX2xvY2FsQW5jaG9yLngpIC0gZWxlbWVudC5fY2FsY3VsYXRlZFdpZHRoIC0gZWxlbWVudC5fbWFyZ2luLng7XG4gICAgICAgICAgICBlbGVtZW50Ll9tYXJnaW4ueSA9IHAueSAtIGVsZW1lbnQuX2NhbGN1bGF0ZWRIZWlnaHQgKiBwdnQueTtcbiAgICAgICAgICAgIGVsZW1lbnQuX21hcmdpbi53ID0gKGVsZW1lbnQuX2xvY2FsQW5jaG9yLncgLSBlbGVtZW50Ll9sb2NhbEFuY2hvci55KSAtIGVsZW1lbnQuX2NhbGN1bGF0ZWRIZWlnaHQgLSBlbGVtZW50Ll9tYXJnaW4ueTtcblxuICAgICAgICAgICAgdGhpcy5fZGlydHlMb2NhbCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzY3JlZW4pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9kaXJ0eVdvcmxkKSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudC5fY29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBlbGVtZW50Ll9jYW52YXNDb3JuZXJzRGlydHkgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIEVudGl0eS5wcm90b3R5cGUuX3N5bmMuY2FsbCh0aGlzKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5V29ybGQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9wYXJlbnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLmNvcHkodGhpcy5sb2NhbFRyYW5zZm9ybSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHRyYW5zZm9ybSBlbGVtZW50IGhpZXJhcmNoeVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9wYXJlbnQuZWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICBlbGVtZW50Ll9zY3JlZW5Ub1dvcmxkLm11bDIodGhpcy5fcGFyZW50LmVsZW1lbnQuX21vZGVsVHJhbnNmb3JtLCBlbGVtZW50Ll9hbmNob3JUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX3NjcmVlblRvV29ybGQuY29weShlbGVtZW50Ll9hbmNob3JUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVsZW1lbnQuX21vZGVsVHJhbnNmb3JtLm11bDIoZWxlbWVudC5fc2NyZWVuVG9Xb3JsZCwgdGhpcy5sb2NhbFRyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2NyZWVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX3NjcmVlblRvV29ybGQubXVsMihzY3JlZW4uc2NyZWVuLl9zY3JlZW5NYXRyaXgsIGVsZW1lbnQuX3NjcmVlblRvV29ybGQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5fc2NyZWVuVG9Xb3JsZC5tdWwyKHNjcmVlbi53b3JsZFRyYW5zZm9ybSwgZWxlbWVudC5fc2NyZWVuVG9Xb3JsZCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLm11bDIoZWxlbWVudC5fc2NyZWVuVG9Xb3JsZCwgdGhpcy5sb2NhbFRyYW5zZm9ybSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIHBhcmVudCB3b3JsZCB0cmFuc2Zvcm1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW50V29ybGRUcmFuc2Zvcm0gPSBlbGVtZW50Ll9wYXJlbnRXb3JsZFRyYW5zZm9ybTtcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50V29ybGRUcmFuc2Zvcm0uc2V0SWRlbnRpdHkoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5fcGFyZW50O1xuICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50ICYmIHBhcmVudC5lbGVtZW50ICYmIHBhcmVudCAhPT0gc2NyZWVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRBLnNldFRSUyhWZWMzLlpFUk8sIHBhcmVudC5nZXRMb2NhbFJvdGF0aW9uKCksIHBhcmVudC5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50V29ybGRUcmFuc2Zvcm0ubXVsMihwYXJlbnQuZWxlbWVudC5fcGFyZW50V29ybGRUcmFuc2Zvcm0sIG1hdEEpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIGVsZW1lbnQgdHJhbnNmb3JtXG4gICAgICAgICAgICAgICAgICAgIC8vIHJvdGF0ZSBhbmQgc2NhbGUgYXJvdW5kIHBpdm90XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlcHRoT2Zmc2V0ID0gdmVjQTtcbiAgICAgICAgICAgICAgICAgICAgZGVwdGhPZmZzZXQuc2V0KDAsIDAsIHRoaXMubG9jYWxQb3NpdGlvbi56KTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBwaXZvdE9mZnNldCA9IHZlY0I7XG4gICAgICAgICAgICAgICAgICAgIHBpdm90T2Zmc2V0LnNldChlbGVtZW50Ll9hYnNMZWZ0ICsgZWxlbWVudC5fcGl2b3QueCAqIGVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoLCBlbGVtZW50Ll9hYnNCb3R0b20gKyBlbGVtZW50Ll9waXZvdC55ICogZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0LCAwKTtcblxuICAgICAgICAgICAgICAgICAgICBtYXRBLnNldFRyYW5zbGF0ZSgtcGl2b3RPZmZzZXQueCwgLXBpdm90T2Zmc2V0LnksIC1waXZvdE9mZnNldC56KTtcbiAgICAgICAgICAgICAgICAgICAgbWF0Qi5zZXRUUlMoZGVwdGhPZmZzZXQsIHRoaXMuZ2V0TG9jYWxSb3RhdGlvbigpLCB0aGlzLmdldExvY2FsU2NhbGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIG1hdEMuc2V0VHJhbnNsYXRlKHBpdm90T2Zmc2V0LngsIHBpdm90T2Zmc2V0LnksIHBpdm90T2Zmc2V0LnopO1xuXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX3NjcmVlblRyYW5zZm9ybS5tdWwyKGVsZW1lbnQuX3BhcmVudFdvcmxkVHJhbnNmb3JtLCBtYXRDKS5tdWwobWF0QikubXVsKG1hdEEpO1xuXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX2Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX2NhbnZhc0Nvcm5lcnNEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuX3dvcmxkQ29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndvcmxkVHJhbnNmb3JtLmNvcHkoZWxlbWVudC5fbW9kZWxUcmFuc2Zvcm0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fZGlydHlXb3JsZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uSW5zZXJ0KHBhcmVudCkge1xuICAgICAgICAvLyB3aGVuIHRoZSBlbnRpdHkgaXMgcmVwYXJlbnRlZCBmaW5kIGEgcG9zc2libGUgbmV3IHNjcmVlbiBhbmQgbWFza1xuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX3BhcnNlVXBUb1NjcmVlbigpO1xuXG4gICAgICAgIHRoaXMuZW50aXR5Ll9kaXJ0aWZ5V29ybGQoKTtcblxuICAgICAgICB0aGlzLl91cGRhdGVTY3JlZW4ocmVzdWx0LnNjcmVlbik7XG5cbiAgICAgICAgdGhpcy5fZGlydGlmeU1hc2soKTtcbiAgICB9XG5cbiAgICBfZGlydGlmeU1hc2soKSB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gdGhpcy5lbnRpdHk7XG4gICAgICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggdXAgdGhlIGhpZXJhcmNoeSB1bnRpbCB3ZSBmaW5kIGFuIGVudGl0eSB3aGljaCBoYXM6XG4gICAgICAgICAgICAvLyAtIG5vIHBhcmVudFxuICAgICAgICAgICAgLy8gLSBzY3JlZW4gY29tcG9uZW50IG9uIHBhcmVudFxuICAgICAgICAgICAgY29uc3QgbmV4dCA9IGN1cnJlbnQucGFyZW50O1xuICAgICAgICAgICAgaWYgKChuZXh0ID09PSBudWxsIHx8IG5leHQuc2NyZWVuKSAmJiBjdXJyZW50LmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuc3lzdGVtLl9wcmVyZW5kZXIgfHwgIXRoaXMuc3lzdGVtLl9wcmVyZW5kZXIubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLm9uY2UoJ3ByZXJlbmRlcicsIHRoaXMuX29uUHJlcmVuZGVyLCB0aGlzKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgICAgICAgICAgICAgIGlmIChfZGVidWdMb2dnaW5nKSBjb25zb2xlLmxvZygncmVnaXN0ZXIgcHJlcmVuZGVyJyk7XG4gICAgICAgICAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBpID0gdGhpcy5zeXN0ZW0uX3ByZXJlbmRlci5pbmRleE9mKHRoaXMuZW50aXR5KTtcbiAgICAgICAgICAgICAgICBpZiAoaSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBqID0gdGhpcy5zeXN0ZW0uX3ByZXJlbmRlci5pbmRleE9mKGN1cnJlbnQpO1xuICAgICAgICAgICAgICAgIGlmIChqIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyLnB1c2goY3VycmVudCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykgY29uc29sZS5sb2coJ3NldCBwcmVyZW5kZXIgcm9vdCB0bzogJyArIGN1cnJlbnQubmFtZSk7XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGN1cnJlbnQgPSBuZXh0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUHJlcmVuZGVyKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc3lzdGVtLl9wcmVyZW5kZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1hc2sgPSB0aGlzLnN5c3RlbS5fcHJlcmVuZGVyW2ldO1xuICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIGNvbnNvbGUubG9nKCdwcmVyZW5kZXIgZnJvbTogJyArIG1hc2submFtZSk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgLy8gcHJldmVudCBjYWxsIGlmIGVsZW1lbnQgaGFzIGJlZW4gcmVtb3ZlZCBzaW5jZSBiZWluZyBhZGRlZFxuICAgICAgICAgICAgaWYgKG1hc2suZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlcHRoID0gMTtcbiAgICAgICAgICAgICAgICBtYXNrLmVsZW1lbnQuc3luY01hc2soZGVwdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW0uX3ByZXJlbmRlci5sZW5ndGggPSAwO1xuICAgIH1cblxuICAgIF9iaW5kU2NyZWVuKHNjcmVlbikge1xuICAgICAgICAvLyBCaW5kIHRoZSBFbGVtZW50IHRvIHRoZSBTY3JlZW4uIFdlIHVzZWQgdG8gc3Vic2NyaWJlIHRvIFNjcmVlbiBldmVudHMgaGVyZS4gSG93ZXZlcixcbiAgICAgICAgLy8gdGhhdCB3YXMgdmVyeSBzbG93IHdoZW4gdGhlcmUgYXJlIHRob3VzYW5kcyBvZiBFbGVtZW50cy4gV2hlbiB0aGUgdGltZSBjb21lcyB0byB1bmJpbmRcbiAgICAgICAgLy8gdGhlIEVsZW1lbnQgZnJvbSB0aGUgU2NyZWVuLCBmaW5kaW5nIHRoZSBldmVudCBjYWxsYmFja3MgdG8gcmVtb3ZlIHRha2VzIGEgY29uc2lkZXJhYmxlXG4gICAgICAgIC8vIGFtb3VudCBvZiB0aW1lLiBTbyBpbnN0ZWFkLCB0aGUgU2NyZWVuIHN0b3JlcyB0aGUgRWxlbWVudCBjb21wb25lbnQgYW5kIGNhbGxzIGl0c1xuICAgICAgICAvLyBmdW5jdGlvbnMgZGlyZWN0bHkuXG4gICAgICAgIHNjcmVlbi5fYmluZEVsZW1lbnQodGhpcyk7XG4gICAgfVxuXG4gICAgX3VuYmluZFNjcmVlbihzY3JlZW4pIHtcbiAgICAgICAgc2NyZWVuLl91bmJpbmRFbGVtZW50KHRoaXMpO1xuICAgIH1cblxuICAgIF91cGRhdGVTY3JlZW4oc2NyZWVuKSB7XG4gICAgICAgIGlmICh0aGlzLnNjcmVlbiAmJiB0aGlzLnNjcmVlbiAhPT0gc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl91bmJpbmRTY3JlZW4odGhpcy5zY3JlZW4uc2NyZWVuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByZXZpb3VzU2NyZWVuID0gdGhpcy5zY3JlZW47XG4gICAgICAgIHRoaXMuc2NyZWVuID0gc2NyZWVuO1xuICAgICAgICBpZiAodGhpcy5zY3JlZW4pIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRTY3JlZW4odGhpcy5zY3JlZW4uc2NyZWVuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNpemUodGhpcy5faGFzU3BsaXRBbmNob3JzWCwgdGhpcy5faGFzU3BsaXRBbmNob3JzWSk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6c2NyZWVuJywgdGhpcy5zY3JlZW4sIHByZXZpb3VzU2NyZWVuKTtcblxuICAgICAgICB0aGlzLl9hbmNob3JEaXJ0eSA9IHRydWU7XG5cbiAgICAgICAgLy8gdXBkYXRlIGFsbCBjaGlsZCBzY3JlZW5zXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5lbnRpdHkuY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGRyZW5baV0uZWxlbWVudCkgY2hpbGRyZW5baV0uZWxlbWVudC5fdXBkYXRlU2NyZWVuKHNjcmVlbik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjYWxjdWxhdGUgZHJhdyBvcmRlclxuICAgICAgICBpZiAodGhpcy5zY3JlZW4pIHRoaXMuc2NyZWVuLnNjcmVlbi5zeW5jRHJhd09yZGVyKCk7XG4gICAgfVxuXG4gICAgc3luY01hc2soZGVwdGgpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fcGFyc2VVcFRvU2NyZWVuKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hc2socmVzdWx0Lm1hc2ssIGRlcHRoKTtcbiAgICB9XG5cbiAgICAvLyBzZXQgdGhlIG1hc2tlZGJ5IHByb3BlcnR5IHRvIHRoZSBlbnRpdHkgdGhhdCBpcyBtYXNraW5nIHRoaXMgZWxlbWVudFxuICAgIC8vIC0gc2V0IHRoZSBzdGVuY2lsIGJ1ZmZlciB0byBjaGVjayB0aGUgbWFzayB2YWx1ZVxuICAgIC8vICAgc28gYXMgdG8gb25seSByZW5kZXIgaW5zaWRlIHRoZSBtYXNrXG4gICAgLy8gICBOb3RlOiBpZiB0aGlzIGVudGl0eSBpcyBpdHNlbGYgYSBtYXNrIHRoZSBzdGVuY2lsIHBhcmFtc1xuICAgIC8vICAgd2lsbCBiZSB1cGRhdGVkIGluIHVwZGF0ZU1hc2sgdG8gaW5jbHVkZSBtYXNraW5nXG4gICAgX3NldE1hc2tlZEJ5KG1hc2spIHtcbiAgICAgICAgY29uc3QgcmVuZGVyYWJsZUVsZW1lbnQgPSB0aGlzLl9pbWFnZSB8fCB0aGlzLl90ZXh0O1xuXG4gICAgICAgIGlmIChtYXNrKSB7XG4gICAgICAgICAgICBjb25zdCByZWYgPSBtYXNrLmVsZW1lbnQuX2ltYWdlLl9tYXNrUmVmO1xuICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIGNvbnNvbGUubG9nKCdtYXNraW5nOiAnICsgdGhpcy5lbnRpdHkubmFtZSArICcgd2l0aCAnICsgcmVmKTtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgICAgICBjb25zdCBzcCA9IG5ldyBTdGVuY2lsUGFyYW1ldGVycyh7XG4gICAgICAgICAgICAgICAgcmVmOiByZWYsXG4gICAgICAgICAgICAgICAgZnVuYzogRlVOQ19FUVVBTFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgaW1hZ2Ugb3IgdGV4dCwgc2V0IHRoZSBzdGVuY2lsIHBhcmFtZXRlcnNcbiAgICAgICAgICAgIGlmIChyZW5kZXJhYmxlRWxlbWVudCAmJiByZW5kZXJhYmxlRWxlbWVudC5fc2V0U3RlbmNpbCkge1xuICAgICAgICAgICAgICAgIHJlbmRlcmFibGVFbGVtZW50Ll9zZXRTdGVuY2lsKHNwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbWFza2VkQnkgPSBtYXNrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgaWYgKF9kZWJ1Z0xvZ2dpbmcpIGNvbnNvbGUubG9nKCdubyBtYXNraW5nIG9uOiAnICsgdGhpcy5lbnRpdHkubmFtZSk7XG4gICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIHN0ZW5jaWwgcGFyYW1zIGlmIHRoaXMgaXMgaW1hZ2Ugb3IgdGV4dFxuICAgICAgICAgICAgaWYgKHJlbmRlcmFibGVFbGVtZW50ICYmIHJlbmRlcmFibGVFbGVtZW50Ll9zZXRTdGVuY2lsKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyYWJsZUVsZW1lbnQuX3NldFN0ZW5jaWwobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9tYXNrZWRCeSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZWN1cnNpdmVseSB1cGRhdGUgZW50aXR5J3Mgc3RlbmNpbCBwYXJhbXNcbiAgICAvLyB0byByZW5kZXIgdGhlIGNvcnJlY3QgdmFsdWUgaW50byB0aGUgc3RlbmNpbCBidWZmZXJcbiAgICBfdXBkYXRlTWFzayhjdXJyZW50TWFzaywgZGVwdGgpIHtcbiAgICAgICAgaWYgKGN1cnJlbnRNYXNrKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRNYXNrZWRCeShjdXJyZW50TWFzayk7XG5cbiAgICAgICAgICAgIC8vIHRoaXMgZWxlbWVudCBpcyBhbHNvIG1hc2tpbmcgb3RoZXJzXG4gICAgICAgICAgICBpZiAodGhpcy5tYXNrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVmID0gY3VycmVudE1hc2suZWxlbWVudC5faW1hZ2UuX21hc2tSZWY7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3AgPSBuZXcgU3RlbmNpbFBhcmFtZXRlcnMoe1xuICAgICAgICAgICAgICAgICAgICByZWY6IHJlZixcbiAgICAgICAgICAgICAgICAgICAgZnVuYzogRlVOQ19FUVVBTCxcbiAgICAgICAgICAgICAgICAgICAgenBhc3M6IFNURU5DSUxPUF9JTkNSRU1FTlRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZS5fc2V0U3RlbmNpbChzcCk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2UuX21hc2tSZWYgPSBkZXB0aDtcblxuICAgICAgICAgICAgICAgIC8vIGluY3JlbWVudCBjb3VudGVyIHRvIGNvdW50IG1hc2sgZGVwdGhcbiAgICAgICAgICAgICAgICBkZXB0aCsrO1xuXG4gICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgIGlmIChfZGVidWdMb2dnaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdtYXNraW5nIGZyb206ICcgKyB0aGlzLmVudGl0eS5uYW1lICsgJyB3aXRoICcgKyAoc3AucmVmICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZGVwdGgrKyB0bzogJywgZGVwdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAgICAgICAgIGN1cnJlbnRNYXNrID0gdGhpcy5lbnRpdHk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlY3Vyc2UgdGhyb3VnaCBhbGwgY2hpbGRyZW5cbiAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gdGhpcy5lbnRpdHkuY2hpbGRyZW47XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbltpXS5lbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuW2ldLmVsZW1lbnQuX3VwZGF0ZU1hc2soY3VycmVudE1hc2ssIGRlcHRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIG1hc2sgY291bnRlciB3YXMgaW5jcmVhc2VkLCBkZWNyZW1lbnQgaXQgYXMgd2UgY29tZSBiYWNrIHVwIHRoZSBoaWVyYXJjaHlcbiAgICAgICAgICAgIGlmICh0aGlzLm1hc2spIGRlcHRoLS07XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNsZWFyaW5nIG1hc2tcbiAgICAgICAgICAgIHRoaXMuX3NldE1hc2tlZEJ5KG51bGwpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5tYXNrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3AgPSBuZXcgU3RlbmNpbFBhcmFtZXRlcnMoe1xuICAgICAgICAgICAgICAgICAgICByZWY6IGRlcHRoLFxuICAgICAgICAgICAgICAgICAgICBmdW5jOiBGVU5DX0FMV0FZUyxcbiAgICAgICAgICAgICAgICAgICAgenBhc3M6IFNURU5DSUxPUF9SRVBMQUNFXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2UuX3NldFN0ZW5jaWwoc3ApO1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlLl9tYXNrUmVmID0gZGVwdGg7XG5cbiAgICAgICAgICAgICAgICAvLyBpbmNyZW1lbnQgbWFzayBjb3VudGVyIHRvIGNvdW50IGRlcHRoIG9mIG1hc2tzXG4gICAgICAgICAgICAgICAgZGVwdGgrKztcblxuICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICBpZiAoX2RlYnVnTG9nZ2luZykge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnbWFza2luZyBmcm9tOiAnICsgdGhpcy5lbnRpdHkubmFtZSArICcgd2l0aCAnICsgc3AucmVmKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2RlcHRoKysgdG86ICcsIGRlcHRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBjdXJyZW50TWFzayA9IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZWN1cnNlIHRocm91Z2ggYWxsIGNoaWxkcmVuXG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbiA9IHRoaXMuZW50aXR5LmNoaWxkcmVuO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW5baV0uZWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbltpXS5lbGVtZW50Ll91cGRhdGVNYXNrKGN1cnJlbnRNYXNrLCBkZXB0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgbWFzayBjb3VudGVyIGFzIHdlIGNvbWUgYmFjayB1cCB0aGUgaGllcmFyY2h5XG4gICAgICAgICAgICBpZiAodGhpcy5tYXNrKSBkZXB0aC0tO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2VhcmNoIHVwIHRoZSBwYXJlbnQgaGllcmFyY2h5IHVudGlsIHdlIHJlYWNoIGEgc2NyZWVuXG4gICAgLy8gdGhpcyBzY3JlZW4gaXMgdGhlIHBhcmVudCBzY3JlZW5cbiAgICAvLyBhbHNvIHNlYXJjaGVzIGZvciBtYXNrZWQgZWxlbWVudHMgdG8gZ2V0IHRoZSByZWxldmFudCBtYXNrXG4gICAgX3BhcnNlVXBUb1NjcmVlbigpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgICAgICAgc2NyZWVuOiBudWxsLFxuICAgICAgICAgICAgbWFzazogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIGxldCBwYXJlbnQgPSB0aGlzLmVudGl0eS5fcGFyZW50O1xuXG4gICAgICAgIHdoaWxlIChwYXJlbnQgJiYgIXBhcmVudC5zY3JlZW4pIHtcbiAgICAgICAgICAgIGlmIChwYXJlbnQuZWxlbWVudCAmJiBwYXJlbnQuZWxlbWVudC5tYXNrKSB7XG4gICAgICAgICAgICAgICAgLy8gbWFzayBlbnRpdHlcbiAgICAgICAgICAgICAgICBpZiAoIXJlc3VsdC5tYXNrKSByZXN1bHQubWFzayA9IHBhcmVudDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50LnBhcmVudDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocGFyZW50ICYmIHBhcmVudC5zY3JlZW4pIHJlc3VsdC5zY3JlZW4gPSBwYXJlbnQ7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBfb25TY3JlZW5SZXNpemUocmVzKSB7XG4gICAgICAgIHRoaXMuX2FuY2hvckRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY29ybmVyc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fd29ybGRDb3JuZXJzRGlydHkgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZVNpemUodGhpcy5faGFzU3BsaXRBbmNob3JzWCwgdGhpcy5faGFzU3BsaXRBbmNob3JzWSk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdzY3JlZW46c2V0OnJlc29sdXRpb24nLCByZXMpO1xuICAgIH1cblxuICAgIF9vblNjcmVlblNwYWNlQ2hhbmdlKCkge1xuICAgICAgICB0aGlzLmZpcmUoJ3NjcmVlbjpzZXQ6c2NyZWVuc3BhY2UnLCB0aGlzLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpO1xuICAgIH1cblxuICAgIF9vblNjcmVlblJlbW92ZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zY3JlZW4uX2Rlc3Ryb3lpbmcpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgc2NyZWVuIGVudGl0eSBpcyBiZWluZyBkZXN0cm95ZWQsIHdlIGRvbid0IGNhbGxcbiAgICAgICAgICAgICAgICAvLyBfdXBkYXRlU2NyZWVuKCkgYXMgYW4gb3B0aW1pemF0aW9uIGJ1dCB3ZSBzaG91bGQgc3RpbGxcbiAgICAgICAgICAgICAgICAvLyBzZXQgaXQgdG8gbnVsbCB0byBjbGVhbiB1cCBkYW5nbGluZyByZWZlcmVuY2VzXG4gICAgICAgICAgICAgICAgdGhpcy5zY3JlZW4gPSBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVTY3JlZW4obnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzdG9yZSBwaXhlbCBwb3NpdGlvbnMgb2YgYW5jaG9yIHJlbGF0aXZlIHRvIGN1cnJlbnQgcGFyZW50IHJlc29sdXRpb25cbiAgICBfY2FsY3VsYXRlTG9jYWxBbmNob3JzKCkge1xuICAgICAgICBsZXQgcmVzeCA9IDEwMDA7XG4gICAgICAgIGxldCByZXN5ID0gMTAwMDtcbiAgICAgICAgY29uc3QgcGFyZW50ID0gdGhpcy5lbnRpdHkuX3BhcmVudDtcbiAgICAgICAgaWYgKHBhcmVudCAmJiBwYXJlbnQuZWxlbWVudCkge1xuICAgICAgICAgICAgcmVzeCA9IHBhcmVudC5lbGVtZW50LmNhbGN1bGF0ZWRXaWR0aDtcbiAgICAgICAgICAgIHJlc3kgPSBwYXJlbnQuZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0O1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc2NyZWVuKSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSB0aGlzLnNjcmVlbi5zY3JlZW4ucmVzb2x1dGlvbjtcbiAgICAgICAgICAgIGNvbnN0IHNjYWxlID0gdGhpcy5zY3JlZW4uc2NyZWVuLnNjYWxlO1xuICAgICAgICAgICAgcmVzeCA9IHJlcy54IC8gc2NhbGU7XG4gICAgICAgICAgICByZXN5ID0gcmVzLnkgLyBzY2FsZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xvY2FsQW5jaG9yLnNldChcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci54ICogcmVzeCxcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci55ICogcmVzeSxcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci56ICogcmVzeCxcbiAgICAgICAgICAgIHRoaXMuX2FuY2hvci53ICogcmVzeVxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8vIGludGVybmFsIC0gYXBwbHkgb2Zmc2V0IHgseSB0byBsb2NhbCBwb3NpdGlvbiBhbmQgZmluZCBwb2ludCBpbiB3b3JsZCBzcGFjZVxuICAgIGdldE9mZnNldFBvc2l0aW9uKHgsIHkpIHtcbiAgICAgICAgY29uc3QgcCA9IHRoaXMuZW50aXR5LmdldExvY2FsUG9zaXRpb24oKS5jbG9uZSgpO1xuXG4gICAgICAgIHAueCArPSB4O1xuICAgICAgICBwLnkgKz0geTtcblxuICAgICAgICB0aGlzLl9zY3JlZW5Ub1dvcmxkLnRyYW5zZm9ybVBvaW50KHAsIHApO1xuXG4gICAgICAgIHJldHVybiBwO1xuICAgIH1cblxuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycyh0aGlzLl9pbWFnZSA/IHRoaXMuX2ltYWdlLl9yZW5kZXJhYmxlLm1vZGVsIDogdGhpcy5fdGV4dC5fbW9kZWwpO1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlKSB7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMuX2ltYWdlLl9yZW5kZXJhYmxlLm1vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3RleHQpIHtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5fdGV4dC5fbW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLl9pbWFnZSkge1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLl9pbWFnZS5fcmVuZGVyYWJsZS5tb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90ZXh0KSB7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMuX3RleHQuX21vZGVsLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbWFnZSkgdGhpcy5faW1hZ2Uub25FbmFibGUoKTtcbiAgICAgICAgaWYgKHRoaXMuX3RleHQpIHRoaXMuX3RleHQub25FbmFibGUoKTtcbiAgICAgICAgaWYgKHRoaXMuX2dyb3VwKSB0aGlzLl9ncm91cC5vbkVuYWJsZSgpO1xuXG4gICAgICAgIGlmICh0aGlzLnVzZUlucHV0ICYmIHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQuYWRkRWxlbWVudCh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuRUxFTUVOVCwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlyZSgnZW5hYmxlZWxlbWVudCcpO1xuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5faW1hZ2UpIHRoaXMuX2ltYWdlLm9uRGlzYWJsZSgpO1xuICAgICAgICBpZiAodGhpcy5fdGV4dCkgdGhpcy5fdGV4dC5vbkRpc2FibGUoKTtcbiAgICAgICAgaWYgKHRoaXMuX2dyb3VwKSB0aGlzLl9ncm91cC5vbkRpc2FibGUoKTtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW0uYXBwLmVsZW1lbnRJbnB1dCAmJiB0aGlzLnVzZUlucHV0KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0LnJlbW92ZUVsZW1lbnQodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5FTEVNRU5ULCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5maXJlKCdkaXNhYmxlZWxlbWVudCcpO1xuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ2luc2VydCcsIHRoaXMuX29uSW5zZXJ0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5fdW5wYXRjaCgpO1xuICAgICAgICBpZiAodGhpcy5faW1hZ2UpIHRoaXMuX2ltYWdlLmRlc3Ryb3koKTtcbiAgICAgICAgaWYgKHRoaXMuX3RleHQpIHRoaXMuX3RleHQuZGVzdHJveSgpO1xuXG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuZWxlbWVudElucHV0ICYmIHRoaXMudXNlSW5wdXQpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5lbGVtZW50SW5wdXQucmVtb3ZlRWxlbWVudCh0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZXJlIGlzIGEgc2NyZWVuLCB1cGRhdGUgZHJhdy1vcmRlclxuICAgICAgICBpZiAodGhpcy5zY3JlZW4gJiYgdGhpcy5zY3JlZW4uc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl91bmJpbmRTY3JlZW4odGhpcy5zY3JlZW4uc2NyZWVuKTtcbiAgICAgICAgICAgIHRoaXMuc2NyZWVuLnNjcmVlbi5zeW5jRHJhd09yZGVyKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlY2FsY3VsYXRlcyB0aGVzZSBwcm9wZXJ0aWVzOlxuICAgICAqICAgLSBgX2xvY2FsQW5jaG9yYFxuICAgICAqICAgLSBgd2lkdGhgXG4gICAgICogICAtIGBoZWlnaHRgXG4gICAgICogICAtIExvY2FsIHBvc2l0aW9uIGlzIHVwZGF0ZWQgaWYgYW5jaG9ycyBhcmUgc3BsaXRcbiAgICAgKlxuICAgICAqIEFzc3VtZXMgdGhlc2UgcHJvcGVydGllcyBhcmUgdXAgdG8gZGF0ZTpcbiAgICAgKiAgIC0gYF9tYXJnaW5gXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHByb3BhZ2F0ZUNhbGN1bGF0ZWRXaWR0aCAtIElmIHRydWUsIGNhbGwgYF9zZXRXaWR0aGAgaW5zdGVhZFxuICAgICAqIG9mIGBfc2V0Q2FsY3VsYXRlZFdpZHRoYFxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gcHJvcGFnYXRlQ2FsY3VsYXRlZEhlaWdodCAtIElmIHRydWUsIGNhbGwgYF9zZXRIZWlnaHRgIGluc3RlYWRcbiAgICAgKiBvZiBgX3NldENhbGN1bGF0ZWRIZWlnaHRgXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2FsY3VsYXRlU2l6ZShwcm9wYWdhdGVDYWxjdWxhdGVkV2lkdGgsIHByb3BhZ2F0ZUNhbGN1bGF0ZWRIZWlnaHQpIHtcbiAgICAgICAgLy8gY2FuJ3QgY2FsY3VsYXRlIGlmIGxvY2FsIGFuY2hvcnMgYXJlIHdyb25nXG4gICAgICAgIGlmICghdGhpcy5lbnRpdHkuX3BhcmVudCAmJiAhdGhpcy5zY3JlZW4pIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVMb2NhbEFuY2hvcnMoKTtcblxuICAgICAgICBjb25zdCBuZXdXaWR0aCA9IHRoaXMuX2Fic1JpZ2h0IC0gdGhpcy5fYWJzTGVmdDtcbiAgICAgICAgY29uc3QgbmV3SGVpZ2h0ID0gdGhpcy5fYWJzVG9wIC0gdGhpcy5fYWJzQm90dG9tO1xuXG4gICAgICAgIGlmIChwcm9wYWdhdGVDYWxjdWxhdGVkV2lkdGgpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFdpZHRoKG5ld1dpZHRoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3NldENhbGN1bGF0ZWRXaWR0aChuZXdXaWR0aCwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByb3BhZ2F0ZUNhbGN1bGF0ZWRIZWlnaHQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldEhlaWdodChuZXdIZWlnaHQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZEhlaWdodChuZXdIZWlnaHQsIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHAgPSB0aGlzLmVudGl0eS5nZXRMb2NhbFBvc2l0aW9uKCk7XG4gICAgICAgIHAueCA9IHRoaXMuX21hcmdpbi54ICsgdGhpcy5fY2FsY3VsYXRlZFdpZHRoICogdGhpcy5fcGl2b3QueDtcbiAgICAgICAgcC55ID0gdGhpcy5fbWFyZ2luLnkgKyB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0ICogdGhpcy5fcGl2b3QueTtcblxuICAgICAgICB0aGlzLmVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKHApO1xuXG4gICAgICAgIHRoaXMuX3NpemVEaXJ0eSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEludGVybmFsIHNldCB3aWR0aCB3aXRob3V0IHVwZGF0aW5nIG1hcmdpbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIG5ldyB3aWR0aC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRXaWR0aCh3KSB7XG4gICAgICAgIHRoaXMuX3dpZHRoID0gdztcbiAgICAgICAgdGhpcy5fc2V0Q2FsY3VsYXRlZFdpZHRoKHcsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDp3aWR0aCcsIHRoaXMuX3dpZHRoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbCBzZXQgaGVpZ2h0IHdpdGhvdXQgdXBkYXRpbmcgbWFyZ2luLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgbmV3IGhlaWdodC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRIZWlnaHQoaCkge1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSBoO1xuICAgICAgICB0aGlzLl9zZXRDYWxjdWxhdGVkSGVpZ2h0KGgsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3NldDpoZWlnaHQnLCB0aGlzLl9oZWlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoaXMgbWV0aG9kIHNldHMgdGhlIGNhbGN1bGF0ZWQgd2lkdGggdmFsdWUgYW5kIG9wdGlvbmFsbHkgdXBkYXRlcyB0aGUgbWFyZ2lucy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIFRoZSBuZXcgY2FsY3VsYXRlZCB3aWR0aC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHVwZGF0ZU1hcmdpbnMgLSBVcGRhdGUgbWFyZ2lucyBvciBub3QuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0Q2FsY3VsYXRlZFdpZHRoKHZhbHVlLCB1cGRhdGVNYXJnaW5zKSB7XG4gICAgICAgIGlmIChNYXRoLmFicyh2YWx1ZSAtIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCkgPD0gMWUtNClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjdWxhdGVkV2lkdGggPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5lbnRpdHkuX2RpcnRpZnlMb2NhbCgpO1xuXG4gICAgICAgIGlmICh1cGRhdGVNYXJnaW5zKSB7XG4gICAgICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29uc3QgcHZ0ID0gdGhpcy5fcGl2b3Q7XG4gICAgICAgICAgICB0aGlzLl9tYXJnaW4ueCA9IHAueCAtIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCAqIHB2dC54O1xuICAgICAgICAgICAgdGhpcy5fbWFyZ2luLnogPSAodGhpcy5fbG9jYWxBbmNob3IueiAtIHRoaXMuX2xvY2FsQW5jaG9yLngpIC0gdGhpcy5fY2FsY3VsYXRlZFdpZHRoIC0gdGhpcy5fbWFyZ2luLng7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9mbGFnQ2hpbGRyZW5Bc0RpcnR5KCk7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OmNhbGN1bGF0ZWRXaWR0aCcsIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCk7XG4gICAgICAgIHRoaXMuZmlyZSgncmVzaXplJywgdGhpcy5fY2FsY3VsYXRlZFdpZHRoLCB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGlzIG1ldGhvZCBzZXRzIHRoZSBjYWxjdWxhdGVkIGhlaWdodCB2YWx1ZSBhbmQgb3B0aW9uYWxseSB1cGRhdGVzIHRoZSBtYXJnaW5zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIG5ldyBjYWxjdWxhdGVkIGhlaWdodC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHVwZGF0ZU1hcmdpbnMgLSBVcGRhdGUgbWFyZ2lucyBvciBub3QuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2V0Q2FsY3VsYXRlZEhlaWdodCh2YWx1ZSwgdXBkYXRlTWFyZ2lucykge1xuICAgICAgICBpZiAoTWF0aC5hYnModmFsdWUgLSB0aGlzLl9jYWxjdWxhdGVkSGVpZ2h0KSA8PSAxZS00KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5lbnRpdHkuX2RpcnRpZnlMb2NhbCgpO1xuXG4gICAgICAgIGlmICh1cGRhdGVNYXJnaW5zKSB7XG4gICAgICAgICAgICBjb25zdCBwID0gdGhpcy5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29uc3QgcHZ0ID0gdGhpcy5fcGl2b3Q7XG4gICAgICAgICAgICB0aGlzLl9tYXJnaW4ueSA9IHAueSAtIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQgKiBwdnQueTtcbiAgICAgICAgICAgIHRoaXMuX21hcmdpbi53ID0gKHRoaXMuX2xvY2FsQW5jaG9yLncgLSB0aGlzLl9sb2NhbEFuY2hvci55KSAtIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQgLSB0aGlzLl9tYXJnaW4ueTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2ZsYWdDaGlsZHJlbkFzRGlydHkoKTtcbiAgICAgICAgdGhpcy5maXJlKCdzZXQ6Y2FsY3VsYXRlZEhlaWdodCcsIHRoaXMuX2NhbGN1bGF0ZWRIZWlnaHQpO1xuICAgICAgICB0aGlzLmZpcmUoJ3Jlc2l6ZScsIHRoaXMuX2NhbGN1bGF0ZWRXaWR0aCwgdGhpcy5fY2FsY3VsYXRlZEhlaWdodCk7XG4gICAgfVxuXG4gICAgX2ZsYWdDaGlsZHJlbkFzRGlydHkoKSB7XG4gICAgICAgIGNvbnN0IGMgPSB0aGlzLmVudGl0eS5fY2hpbGRyZW47XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gYy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjW2ldLmVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBjW2ldLmVsZW1lbnQuX2FuY2hvckRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjW2ldLmVsZW1lbnQuX3NpemVEaXJ0eSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhZGRNb2RlbFRvTGF5ZXJzKG1vZGVsKSB7XG4gICAgICAgIHRoaXMuX2FkZGVkTW9kZWxzLnB1c2gobW9kZWwpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZU1vZGVsRnJvbUxheWVycyhtb2RlbCkge1xuICAgICAgICBjb25zdCBpZHggPSB0aGlzLl9hZGRlZE1vZGVscy5pbmRleE9mKG1vZGVsKTtcbiAgICAgICAgaWYgKGlkeCA+PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRlZE1vZGVscy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldE1hc2tPZmZzZXQoKSB7XG4gICAgICAgIC8vIHJlc2V0IG9mZnNldCBvbiBuZXcgZnJhbWVcbiAgICAgICAgLy8gd2UgYWx3YXlzIGNvdW50IG9mZnNldCBkb3duIGZyb20gMC41XG4gICAgICAgIGNvbnN0IGZyYW1lID0gdGhpcy5zeXN0ZW0uYXBwLmZyYW1lO1xuICAgICAgICBpZiAodGhpcy5fb2Zmc2V0UmVhZEF0ICE9PSBmcmFtZSkge1xuICAgICAgICAgICAgdGhpcy5fbWFza09mZnNldCA9IDAuNTtcbiAgICAgICAgICAgIHRoaXMuX29mZnNldFJlYWRBdCA9IGZyYW1lO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG1vID0gdGhpcy5fbWFza09mZnNldDtcbiAgICAgICAgdGhpcy5fbWFza09mZnNldCAtPSAwLjAwMTtcbiAgICAgICAgcmV0dXJuIG1vO1xuICAgIH1cblxuICAgIGlzVmlzaWJsZUZvckNhbWVyYShjYW1lcmEpIHtcbiAgICAgICAgbGV0IGNsaXBMLCBjbGlwUiwgY2xpcFQsIGNsaXBCO1xuXG4gICAgICAgIGlmICh0aGlzLm1hc2tlZEJ5KSB7XG4gICAgICAgICAgICBjb25zdCBjb3JuZXJzID0gdGhpcy5tYXNrZWRCeS5lbGVtZW50LnNjcmVlbkNvcm5lcnM7XG5cbiAgICAgICAgICAgIGNsaXBMID0gTWF0aC5taW4oTWF0aC5taW4oY29ybmVyc1swXS54LCBjb3JuZXJzWzFdLngpLCBNYXRoLm1pbihjb3JuZXJzWzJdLngsIGNvcm5lcnNbM10ueCkpO1xuICAgICAgICAgICAgY2xpcFIgPSBNYXRoLm1heChNYXRoLm1heChjb3JuZXJzWzBdLngsIGNvcm5lcnNbMV0ueCksIE1hdGgubWF4KGNvcm5lcnNbMl0ueCwgY29ybmVyc1szXS54KSk7XG4gICAgICAgICAgICBjbGlwQiA9IE1hdGgubWluKE1hdGgubWluKGNvcm5lcnNbMF0ueSwgY29ybmVyc1sxXS55KSwgTWF0aC5taW4oY29ybmVyc1syXS55LCBjb3JuZXJzWzNdLnkpKTtcbiAgICAgICAgICAgIGNsaXBUID0gTWF0aC5tYXgoTWF0aC5tYXgoY29ybmVyc1swXS55LCBjb3JuZXJzWzFdLnkpLCBNYXRoLm1heChjb3JuZXJzWzJdLnksIGNvcm5lcnNbM10ueSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgc3cgPSB0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2Uud2lkdGg7XG4gICAgICAgICAgICBjb25zdCBzaCA9IHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZS5oZWlnaHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYVdpZHRoID0gY2FtZXJhLl9yZWN0LnogKiBzdztcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYUhlaWdodCA9IGNhbWVyYS5fcmVjdC53ICogc2g7XG4gICAgICAgICAgICBjbGlwTCA9IGNhbWVyYS5fcmVjdC54ICogc3c7XG4gICAgICAgICAgICBjbGlwUiA9IGNsaXBMICsgY2FtZXJhV2lkdGg7XG4gICAgICAgICAgICBjbGlwVCA9ICgxIC0gY2FtZXJhLl9yZWN0LnkpICogc2g7XG4gICAgICAgICAgICBjbGlwQiA9IGNsaXBUIC0gY2FtZXJhSGVpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaGl0Q29ybmVycyA9IHRoaXMuc2NyZWVuQ29ybmVycztcblxuICAgICAgICBjb25zdCBsZWZ0ID0gTWF0aC5taW4oTWF0aC5taW4oaGl0Q29ybmVyc1swXS54LCBoaXRDb3JuZXJzWzFdLngpLCBNYXRoLm1pbihoaXRDb3JuZXJzWzJdLngsIGhpdENvcm5lcnNbM10ueCkpO1xuICAgICAgICBjb25zdCByaWdodCA9IE1hdGgubWF4KE1hdGgubWF4KGhpdENvcm5lcnNbMF0ueCwgaGl0Q29ybmVyc1sxXS54KSwgTWF0aC5tYXgoaGl0Q29ybmVyc1syXS54LCBoaXRDb3JuZXJzWzNdLngpKTtcbiAgICAgICAgY29uc3QgYm90dG9tID0gTWF0aC5taW4oTWF0aC5taW4oaGl0Q29ybmVyc1swXS55LCBoaXRDb3JuZXJzWzFdLnkpLCBNYXRoLm1pbihoaXRDb3JuZXJzWzJdLnksIGhpdENvcm5lcnNbM10ueSkpO1xuICAgICAgICBjb25zdCB0b3AgPSBNYXRoLm1heChNYXRoLm1heChoaXRDb3JuZXJzWzBdLnksIGhpdENvcm5lcnNbMV0ueSksIE1hdGgubWF4KGhpdENvcm5lcnNbMl0ueSwgaGl0Q29ybmVyc1szXS55KSk7XG5cbiAgICAgICAgaWYgKHJpZ2h0IDwgY2xpcEwgfHxcbiAgICAgICAgICAgIGxlZnQgPiBjbGlwUiB8fFxuICAgICAgICAgICAgYm90dG9tID4gY2xpcFQgfHxcbiAgICAgICAgICAgIHRvcCA8IGNsaXBCKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBfaXNTY3JlZW5TcGFjZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuc2NyZWVuICYmIHRoaXMuc2NyZWVuLnNjcmVlbikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfaXNTY3JlZW5DdWxsZWQoKSB7XG4gICAgICAgIGlmICh0aGlzLnNjcmVlbiAmJiB0aGlzLnNjcmVlbi5zY3JlZW4pIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNjcmVlbi5zY3JlZW4uY3VsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfZGlydHlCYXRjaCgpIHtcbiAgICAgICAgaWYgKHRoaXMuYmF0Y2hHcm91cElkICE9PSAtMSkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/Lm1hcmtHcm91cERpcnR5KHRoaXMuYmF0Y2hHcm91cElkKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gX2RlZmluZShuYW1lKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEVsZW1lbnRDb21wb25lbnQucHJvdG90eXBlLCBuYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3RleHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fdGV4dFtuYW1lXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5faW1hZ2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5faW1hZ2VbbmFtZV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90ZXh0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3RleHRbbmFtZV0gIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5QmF0Y2goKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl90ZXh0W25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2ltYWdlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2ltYWdlW25hbWVdICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9kaXJ0eUJhdGNoKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2VbbmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5fZGVmaW5lKCdmb250U2l6ZScpO1xuX2RlZmluZSgnbWluRm9udFNpemUnKTtcbl9kZWZpbmUoJ21heEZvbnRTaXplJyk7XG5fZGVmaW5lKCdtYXhMaW5lcycpO1xuX2RlZmluZSgnYXV0b0ZpdFdpZHRoJyk7XG5fZGVmaW5lKCdhdXRvRml0SGVpZ2h0Jyk7XG5fZGVmaW5lKCdjb2xvcicpO1xuX2RlZmluZSgnZm9udCcpO1xuX2RlZmluZSgnZm9udEFzc2V0Jyk7XG5fZGVmaW5lKCdzcGFjaW5nJyk7XG5fZGVmaW5lKCdsaW5lSGVpZ2h0Jyk7XG5fZGVmaW5lKCd3cmFwTGluZXMnKTtcbl9kZWZpbmUoJ2xpbmVzJyk7XG5fZGVmaW5lKCdhbGlnbm1lbnQnKTtcbl9kZWZpbmUoJ2F1dG9XaWR0aCcpO1xuX2RlZmluZSgnYXV0b0hlaWdodCcpO1xuX2RlZmluZSgncnRsUmVvcmRlcicpO1xuX2RlZmluZSgndW5pY29kZUNvbnZlcnRlcicpO1xuX2RlZmluZSgndGV4dCcpO1xuX2RlZmluZSgna2V5Jyk7XG5fZGVmaW5lKCd0ZXh0dXJlJyk7XG5fZGVmaW5lKCd0ZXh0dXJlQXNzZXQnKTtcbl9kZWZpbmUoJ21hdGVyaWFsJyk7XG5fZGVmaW5lKCdtYXRlcmlhbEFzc2V0Jyk7XG5fZGVmaW5lKCdzcHJpdGUnKTtcbl9kZWZpbmUoJ3Nwcml0ZUFzc2V0Jyk7XG5fZGVmaW5lKCdzcHJpdGVGcmFtZScpO1xuX2RlZmluZSgncGl4ZWxzUGVyVW5pdCcpO1xuX2RlZmluZSgnb3BhY2l0eScpO1xuX2RlZmluZSgncmVjdCcpO1xuX2RlZmluZSgnbWFzaycpO1xuX2RlZmluZSgnb3V0bGluZUNvbG9yJyk7XG5fZGVmaW5lKCdvdXRsaW5lVGhpY2tuZXNzJyk7XG5fZGVmaW5lKCdzaGFkb3dDb2xvcicpO1xuX2RlZmluZSgnc2hhZG93T2Zmc2V0Jyk7XG5fZGVmaW5lKCdlbmFibGVNYXJrdXAnKTtcbl9kZWZpbmUoJ3JhbmdlU3RhcnQnKTtcbl9kZWZpbmUoJ3JhbmdlRW5kJyk7XG5cbmV4cG9ydCB7IEVsZW1lbnRDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJwb3NpdGlvbiIsIlZlYzMiLCJpbnZQYXJlbnRXdG0iLCJNYXQ0IiwidmVjQSIsInZlY0IiLCJtYXRBIiwibWF0QiIsIm1hdEMiLCJtYXREIiwiRWxlbWVudENvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX2JlaW5nSW5pdGlhbGl6ZWQiLCJfYW5jaG9yIiwiVmVjNCIsIl9sb2NhbEFuY2hvciIsIl9waXZvdCIsIlZlYzIiLCJfd2lkdGgiLCJfY2FsY3VsYXRlZFdpZHRoIiwiX2hlaWdodCIsIl9jYWxjdWxhdGVkSGVpZ2h0IiwiX21hcmdpbiIsIl9tb2RlbFRyYW5zZm9ybSIsIl9zY3JlZW5Ub1dvcmxkIiwiX2FuY2hvclRyYW5zZm9ybSIsIl9hbmNob3JEaXJ0eSIsIl9wYXJlbnRXb3JsZFRyYW5zZm9ybSIsIl9zY3JlZW5UcmFuc2Zvcm0iLCJfc2NyZWVuQ29ybmVycyIsIl9jYW52YXNDb3JuZXJzIiwiX3dvcmxkQ29ybmVycyIsIl9jb3JuZXJzRGlydHkiLCJfY2FudmFzQ29ybmVyc0RpcnR5IiwiX3dvcmxkQ29ybmVyc0RpcnR5Iiwib24iLCJfb25JbnNlcnQiLCJfcGF0Y2giLCJzY3JlZW4iLCJfdHlwZSIsIkVMRU1FTlRUWVBFX0dST1VQIiwiX2ltYWdlIiwiX3RleHQiLCJfZ3JvdXAiLCJfZHJhd09yZGVyIiwiX2ZpdE1vZGUiLCJGSVRNT0RFX1NUUkVUQ0giLCJfdXNlSW5wdXQiLCJfbGF5ZXJzIiwiTEFZRVJJRF9VSSIsIl9hZGRlZE1vZGVscyIsIl9iYXRjaEdyb3VwSWQiLCJfYmF0Y2hHcm91cCIsIl9vZmZzZXRSZWFkQXQiLCJfbWFza09mZnNldCIsIl9tYXNrZWRCeSIsIl9hYnNMZWZ0IiwieCIsIl9hYnNSaWdodCIsInoiLCJfYWJzVG9wIiwidyIsIl9hYnNCb3R0b20iLCJ5IiwiX2hhc1NwbGl0QW5jaG9yc1giLCJNYXRoIiwiYWJzIiwiX2hhc1NwbGl0QW5jaG9yc1kiLCJhYWJiIiwiYW5jaG9yIiwidmFsdWUiLCJjb3B5Iiwic2V0IiwiX3BhcmVudCIsIl9jYWxjdWxhdGVMb2NhbEFuY2hvcnMiLCJfY2FsY3VsYXRlU2l6ZSIsIl9kaXJ0eUxvY2FsIiwiX2RpcnRpZnlMb2NhbCIsImZpcmUiLCJiYXRjaEdyb3VwSWQiLCJlbmFibGVkIiwiYXBwIiwiYmF0Y2hlciIsInJlbW92ZSIsIkJhdGNoR3JvdXAiLCJFTEVNRU5UIiwiaW5zZXJ0IiwiX3JlbmRlcmFibGUiLCJtb2RlbCIsImFkZE1vZGVsVG9MYXllcnMiLCJfbW9kZWwiLCJib3R0b20iLCJwIiwiZ2V0TG9jYWxQb3NpdGlvbiIsInd0Iiwid2IiLCJfc2V0SGVpZ2h0Iiwic2V0TG9jYWxQb3NpdGlvbiIsImNhbGN1bGF0ZWRXaWR0aCIsIl9zZXRDYWxjdWxhdGVkV2lkdGgiLCJjYWxjdWxhdGVkSGVpZ2h0IiwiX3NldENhbGN1bGF0ZWRIZWlnaHQiLCJjYW52YXNDb3JuZXJzIiwic2NyZWVuU3BhY2UiLCJkZXZpY2UiLCJncmFwaGljc0RldmljZSIsInNjcmVlbkNvcm5lcnMiLCJzeCIsImNhbnZhcyIsImNsaWVudFdpZHRoIiwid2lkdGgiLCJzeSIsImNsaWVudEhlaWdodCIsImhlaWdodCIsImkiLCJkcmF3T3JkZXIiLCJwcmlvcml0eSIsIkRlYnVnIiwid2FybiIsImxheWVycyIsImxlbmd0aCIsImxheWVyIiwic2NlbmUiLCJnZXRMYXllckJ5SWQiLCJqIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIm1lc2hJbnN0YW5jZXMiLCJhZGRNZXNoSW5zdGFuY2VzIiwibGVmdCIsIndyIiwid2wiLCJfc2V0V2lkdGgiLCJtYXJnaW4iLCJtYXNrZWRCeSIsInBpdm90IiwicHJldlgiLCJwcmV2WSIsIm14IiwiZHgiLCJteSIsImR5IiwiX2ZsYWdDaGlsZHJlbkFzRGlydHkiLCJyaWdodCIsInBhcmVudEJvdHRvbUxlZnQiLCJwYXJlbnQiLCJlbGVtZW50IiwidHJhbnNmb3JtUG9pbnQiLCJtdWxTY2FsYXIiLCJzY2FsZSIsImFkZCIsInRleHRXaWR0aCIsInRleHRIZWlnaHQiLCJ0b3AiLCJ0eXBlIiwiZGVzdHJveSIsIkVMRU1FTlRUWVBFX0lNQUdFIiwiSW1hZ2VFbGVtZW50IiwiRUxFTUVOVFRZUEVfVEVYVCIsIlRleHRFbGVtZW50IiwidXNlSW5wdXQiLCJlbGVtZW50SW5wdXQiLCJhZGRFbGVtZW50IiwicmVtb3ZlRWxlbWVudCIsImZpdE1vZGUiLCJyZWZyZXNoTWVzaCIsIndvcmxkQ29ybmVycyIsIl9zY3JlZW5NYXRyaXgiLCJkYXRhIiwibXVsMiIsImdldFdvcmxkVHJhbnNmb3JtIiwibG9jYWxQb3MiLCJzZXRUcmFuc2xhdGUiLCJzZXRUUlMiLCJaRVJPIiwiZ2V0TG9jYWxSb3RhdGlvbiIsImdldExvY2FsU2NhbGUiLCJtdWwiLCJfc3luYyIsInNldFBvc2l0aW9uIiwiX3NldFBvc2l0aW9uIiwiX3NldExvY2FsUG9zaXRpb24iLCJfdW5wYXRjaCIsIkVudGl0eSIsInByb3RvdHlwZSIsImNhbGwiLCJpbnZlcnQiLCJsb2NhbFBvc2l0aW9uIiwicHZ0IiwicmVzeCIsInJlc3kiLCJweCIsInB5IiwicmVzb2x1dGlvbiIsIl9zaXplRGlydHkiLCJsb2NhbFRyYW5zZm9ybSIsImxvY2FsUm90YXRpb24iLCJsb2NhbFNjYWxlIiwiX2RpcnR5V29ybGQiLCJ3b3JsZFRyYW5zZm9ybSIsInBhcmVudFdvcmxkVHJhbnNmb3JtIiwic2V0SWRlbnRpdHkiLCJkZXB0aE9mZnNldCIsInBpdm90T2Zmc2V0IiwicmVzdWx0IiwiX3BhcnNlVXBUb1NjcmVlbiIsIl9kaXJ0aWZ5V29ybGQiLCJfdXBkYXRlU2NyZWVuIiwiX2RpcnRpZnlNYXNrIiwiY3VycmVudCIsIm5leHQiLCJfcHJlcmVuZGVyIiwib25jZSIsIl9vblByZXJlbmRlciIsImluZGV4T2YiLCJzcGxpY2UiLCJwdXNoIiwibWFzayIsImRlcHRoIiwic3luY01hc2siLCJfYmluZFNjcmVlbiIsIl9iaW5kRWxlbWVudCIsIl91bmJpbmRTY3JlZW4iLCJfdW5iaW5kRWxlbWVudCIsInByZXZpb3VzU2NyZWVuIiwiY2hpbGRyZW4iLCJsIiwic3luY0RyYXdPcmRlciIsIl91cGRhdGVNYXNrIiwiX3NldE1hc2tlZEJ5IiwicmVuZGVyYWJsZUVsZW1lbnQiLCJyZWYiLCJfbWFza1JlZiIsInNwIiwiU3RlbmNpbFBhcmFtZXRlcnMiLCJmdW5jIiwiRlVOQ19FUVVBTCIsIl9zZXRTdGVuY2lsIiwiY3VycmVudE1hc2siLCJ6cGFzcyIsIlNURU5DSUxPUF9JTkNSRU1FTlQiLCJGVU5DX0FMV0FZUyIsIlNURU5DSUxPUF9SRVBMQUNFIiwiX29uU2NyZWVuUmVzaXplIiwicmVzIiwiX29uU2NyZWVuU3BhY2VDaGFuZ2UiLCJfb25TY3JlZW5SZW1vdmUiLCJfZGVzdHJveWluZyIsImdldE9mZnNldFBvc2l0aW9uIiwiY2xvbmUiLCJvbkxheWVyc0NoYW5nZWQiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9mZiIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpZCIsIm9uRW5hYmxlIiwib25EaXNhYmxlIiwib25SZW1vdmUiLCJwcm9wYWdhdGVDYWxjdWxhdGVkV2lkdGgiLCJwcm9wYWdhdGVDYWxjdWxhdGVkSGVpZ2h0IiwibmV3V2lkdGgiLCJuZXdIZWlnaHQiLCJoIiwidXBkYXRlTWFyZ2lucyIsImMiLCJfY2hpbGRyZW4iLCJyZW1vdmVNb2RlbEZyb21MYXllcnMiLCJpZHgiLCJnZXRNYXNrT2Zmc2V0IiwiZnJhbWUiLCJtbyIsImlzVmlzaWJsZUZvckNhbWVyYSIsImNhbWVyYSIsImNsaXBMIiwiY2xpcFIiLCJjbGlwVCIsImNsaXBCIiwiY29ybmVycyIsIm1pbiIsIm1heCIsInN3Iiwic2giLCJjYW1lcmFXaWR0aCIsIl9yZWN0IiwiY2FtZXJhSGVpZ2h0IiwiaGl0Q29ybmVycyIsIl9pc1NjcmVlblNwYWNlIiwiX2lzU2NyZWVuQ3VsbGVkIiwiY3VsbCIsIl9kaXJ0eUJhdGNoIiwibWFya0dyb3VwRGlydHkiLCJfZGVmaW5lIiwibmFtZSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0Il0s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T0FBTyxDQUFDLEtBQUQsQ0FBUCxDQUFBOztBQUNBQSxPQUFPLENBQUMsU0FBRCxDQUFQLENBQUE7O0FBQ0FBLE9BQU8sQ0FBQyxjQUFELENBQVAsQ0FBQTs7QUFDQUEsT0FBTyxDQUFDLFVBQUQsQ0FBUCxDQUFBOztBQUNBQSxPQUFPLENBQUMsZUFBRCxDQUFQLENBQUE7O0FBQ0FBLE9BQU8sQ0FBQyxRQUFELENBQVAsQ0FBQTs7QUFDQUEsT0FBTyxDQUFDLGFBQUQsQ0FBUCxDQUFBOztBQUNBQSxPQUFPLENBQUMsYUFBRCxDQUFQLENBQUE7O0FBQ0FBLE9BQU8sQ0FBQyxlQUFELENBQVAsQ0FBQTs7QUFDQUEsT0FBTyxDQUFDLFNBQUQsQ0FBUCxDQUFBOztBQUNBQSxPQUFPLENBQUMsTUFBRCxDQUFQLENBQUE7O0FBQ0FBLE9BQU8sQ0FBQyxNQUFELENBQVAsQ0FBQTs7QUFDQUEsT0FBTyxDQUFDLGNBQUQsQ0FBUCxDQUFBOztBQUNBQSxPQUFPLENBQUMsa0JBQUQsQ0FBUCxDQUFBOztBQUNBQSxPQUFPLENBQUMsYUFBRCxDQUFQLENBQUE7O0FBQ0FBLE9BQU8sQ0FBQyxjQUFELENBQVAsQ0FBQTs7QUFDQUEsT0FBTyxDQUFDLGNBQUQsQ0FBUCxDQUFBOztBQUNBQSxPQUFPLENBQUMsWUFBRCxDQUFQLENBQUE7O0FBQ0FBLE9BQU8sQ0FBQyxVQUFELENBQVA7Ozs7In0=
