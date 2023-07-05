import '../../../core/debug.js';
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
			if (this._useInput === true) ;
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
			renderableElement == null ? void 0 : renderableElement._setStencil(new StencilParameters({
				ref: ref,
				func: FUNC_EQUAL
			}));
			this._maskedBy = mask;
		} else {
			renderableElement == null ? void 0 : renderableElement._setStencil(null);
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
				var _children$i$element;
				(_children$i$element = children[i].element) == null ? void 0 : _children$i$element._updateMask(currentMask, depth);
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
				var _children$i$element2;
				(_children$i$element2 = children[i].element) == null ? void 0 : _children$i$element2._updateMask(currentMask, depth);
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
