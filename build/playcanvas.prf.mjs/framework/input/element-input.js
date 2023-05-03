import { platform } from '../../core/platform.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Ray } from '../../core/shape/ray.js';
import { Mouse } from '../../platform/input/mouse.js';
import { getApplication } from '../globals.js';

let targetX, targetY;
const vecA = new Vec3();
const vecB = new Vec3();
const rayA = new Ray();
const rayB = new Ray();
const rayC = new Ray();
rayA.end = new Vec3();
rayB.end = new Vec3();
rayC.end = new Vec3();
const _pq = new Vec3();
const _pa = new Vec3();
const _pb = new Vec3();
const _pc = new Vec3();
const _pd = new Vec3();
const _m = new Vec3();
const _au = new Vec3();
const _bv = new Vec3();
const _cw = new Vec3();
const _ir = new Vec3();
const _sct = new Vec3();
const _accumulatedScale = new Vec3();
const _paddingTop = new Vec3();
const _paddingBottom = new Vec3();
const _paddingLeft = new Vec3();
const _paddingRight = new Vec3();
const _cornerBottomLeft = new Vec3();
const _cornerBottomRight = new Vec3();
const _cornerTopRight = new Vec3();
const _cornerTopLeft = new Vec3();
const ZERO_VEC4 = new Vec4();
function scalarTriple(p1, p2, p3) {
	return _sct.cross(p1, p2).dot(p3);
}
function intersectLineQuad(p, q, corners) {
	_pq.sub2(q, p);
	_pa.sub2(corners[0], p);
	_pb.sub2(corners[1], p);
	_pc.sub2(corners[2], p);
	_m.cross(_pc, _pq);
	let v = _pa.dot(_m);
	let u;
	let w;
	if (v >= 0) {
		u = -_pb.dot(_m);
		if (u < 0) return -1;
		w = scalarTriple(_pq, _pb, _pa);
		if (w < 0) return -1;
		const denom = 1.0 / (u + v + w);
		_au.copy(corners[0]).mulScalar(u * denom);
		_bv.copy(corners[1]).mulScalar(v * denom);
		_cw.copy(corners[2]).mulScalar(w * denom);
		_ir.copy(_au).add(_bv).add(_cw);
	} else {
		_pd.sub2(corners[3], p);
		u = _pd.dot(_m);
		if (u < 0) return -1;
		w = scalarTriple(_pq, _pa, _pd);
		if (w < 0) return -1;
		v = -v;
		const denom = 1.0 / (u + v + w);
		_au.copy(corners[0]).mulScalar(u * denom);
		_bv.copy(corners[3]).mulScalar(v * denom);
		_cw.copy(corners[2]).mulScalar(w * denom);
		_ir.copy(_au).add(_bv).add(_cw);
	}
	if (_pq.sub2(corners[0], corners[2]).lengthSq() < 0.0001 * 0.0001) return -1;
	if (_pq.sub2(corners[1], corners[3]).lengthSq() < 0.0001 * 0.0001) return -1;
	return _ir.sub(p).lengthSq();
}
class ElementInputEvent {
	constructor(event, element, camera) {
		this.event = event;
		this.element = element;
		this.camera = camera;
		this._stopPropagation = false;
	}
	stopPropagation() {
		this._stopPropagation = true;
		if (this.event) {
			this.event.stopImmediatePropagation();
			this.event.stopPropagation();
		}
	}
}
class ElementMouseEvent extends ElementInputEvent {
	constructor(event, element, camera, x, y, lastX, lastY) {
		super(event, element, camera);
		this.x = x;
		this.y = y;
		this.ctrlKey = event.ctrlKey || false;
		this.altKey = event.altKey || false;
		this.shiftKey = event.shiftKey || false;
		this.metaKey = event.metaKey || false;
		this.button = event.button;
		if (Mouse.isPointerLocked()) {
			this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
			this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
		} else {
			this.dx = x - lastX;
			this.dy = y - lastY;
		}
		this.wheelDelta = 0;
		if (event.type === 'wheel') {
			if (event.deltaY > 0) {
				this.wheelDelta = 1;
			} else if (event.deltaY < 0) {
				this.wheelDelta = -1;
			}
		}
	}
}
class ElementTouchEvent extends ElementInputEvent {
	constructor(event, element, camera, x, y, touch) {
		super(event, element, camera);
		this.touches = event.touches;
		this.changedTouches = event.changedTouches;
		this.x = x;
		this.y = y;
		this.touch = touch;
	}
}
class ElementSelectEvent extends ElementInputEvent {
	constructor(event, element, camera, inputSource) {
		super(event, element, camera);
		this.inputSource = inputSource;
	}
}
class ElementInput {
	constructor(domElement, options) {
		this._app = null;
		this._attached = false;
		this._target = null;
		this._enabled = true;
		this._lastX = 0;
		this._lastY = 0;
		this._upHandler = this._handleUp.bind(this);
		this._downHandler = this._handleDown.bind(this);
		this._moveHandler = this._handleMove.bind(this);
		this._wheelHandler = this._handleWheel.bind(this);
		this._touchstartHandler = this._handleTouchStart.bind(this);
		this._touchendHandler = this._handleTouchEnd.bind(this);
		this._touchcancelHandler = this._touchendHandler;
		this._touchmoveHandler = this._handleTouchMove.bind(this);
		this._sortHandler = this._sortElements.bind(this);
		this._elements = [];
		this._hoveredElement = null;
		this._pressedElement = null;
		this._touchedElements = {};
		this._touchesForWhichTouchLeaveHasFired = {};
		this._selectedElements = {};
		this._selectedPressedElements = {};
		this._useMouse = !options || options.useMouse !== false;
		this._useTouch = !options || options.useTouch !== false;
		this._useXr = !options || options.useXr !== false;
		this._selectEventsAttached = false;
		if (platform.touch) this._clickedEntities = {};
		this.attach(domElement);
	}
	set enabled(value) {
		this._enabled = value;
	}
	get enabled() {
		return this._enabled;
	}
	set app(value) {
		this._app = value;
	}
	get app() {
		return this._app || getApplication();
	}
	attach(domElement) {
		if (this._attached) {
			this._attached = false;
			this.detach();
		}
		this._target = domElement;
		this._attached = true;
		const opts = platform.passiveEvents ? {
			passive: true
		} : false;
		if (this._useMouse) {
			window.addEventListener('mouseup', this._upHandler, opts);
			window.addEventListener('mousedown', this._downHandler, opts);
			window.addEventListener('mousemove', this._moveHandler, opts);
			window.addEventListener('wheel', this._wheelHandler, opts);
		}
		if (this._useTouch && platform.touch) {
			this._target.addEventListener('touchstart', this._touchstartHandler, opts);
			this._target.addEventListener('touchend', this._touchendHandler, false);
			this._target.addEventListener('touchmove', this._touchmoveHandler, false);
			this._target.addEventListener('touchcancel', this._touchcancelHandler, false);
		}
		this.attachSelectEvents();
	}
	attachSelectEvents() {
		if (!this._selectEventsAttached && this._useXr && this.app && this.app.xr && this.app.xr.supported) {
			if (!this._clickedEntities) this._clickedEntities = {};
			this._selectEventsAttached = true;
			this.app.xr.on('start', this._onXrStart, this);
		}
	}
	detach() {
		if (!this._attached) return;
		this._attached = false;
		const opts = platform.passiveEvents ? {
			passive: true
		} : false;
		if (this._useMouse) {
			window.removeEventListener('mouseup', this._upHandler, opts);
			window.removeEventListener('mousedown', this._downHandler, opts);
			window.removeEventListener('mousemove', this._moveHandler, opts);
			window.removeEventListener('wheel', this._wheelHandler, opts);
		}
		if (this._useTouch) {
			this._target.removeEventListener('touchstart', this._touchstartHandler, opts);
			this._target.removeEventListener('touchend', this._touchendHandler, false);
			this._target.removeEventListener('touchmove', this._touchmoveHandler, false);
			this._target.removeEventListener('touchcancel', this._touchcancelHandler, false);
		}
		if (this._selectEventsAttached) {
			this._selectEventsAttached = false;
			this.app.xr.off('start', this._onXrStart, this);
			this.app.xr.off('end', this._onXrEnd, this);
			this.app.xr.off('update', this._onXrUpdate, this);
			this.app.xr.input.off('selectstart', this._onSelectStart, this);
			this.app.xr.input.off('selectend', this._onSelectEnd, this);
			this.app.xr.input.off('remove', this._onXrInputRemove, this);
		}
		this._target = null;
	}
	addElement(element) {
		if (this._elements.indexOf(element) === -1) this._elements.push(element);
	}
	removeElement(element) {
		const idx = this._elements.indexOf(element);
		if (idx !== -1) this._elements.splice(idx, 1);
	}
	_handleUp(event) {
		if (!this._enabled) return;
		if (Mouse.isPointerLocked()) return;
		this._calcMouseCoords(event);
		this._onElementMouseEvent('mouseup', event);
	}
	_handleDown(event) {
		if (!this._enabled) return;
		if (Mouse.isPointerLocked()) return;
		this._calcMouseCoords(event);
		this._onElementMouseEvent('mousedown', event);
	}
	_handleMove(event) {
		if (!this._enabled) return;
		this._calcMouseCoords(event);
		this._onElementMouseEvent('mousemove', event);
		this._lastX = targetX;
		this._lastY = targetY;
	}
	_handleWheel(event) {
		if (!this._enabled) return;
		this._calcMouseCoords(event);
		this._onElementMouseEvent('mousewheel', event);
	}
	_determineTouchedElements(event) {
		const touchedElements = {};
		const cameras = this.app.systems.camera.cameras;
		for (let i = cameras.length - 1; i >= 0; i--) {
			const camera = cameras[i];
			let done = 0;
			const len = event.changedTouches.length;
			for (let j = 0; j < len; j++) {
				if (touchedElements[event.changedTouches[j].identifier]) {
					done++;
					continue;
				}
				const coords = this._calcTouchCoords(event.changedTouches[j]);
				const element = this._getTargetElementByCoords(camera, coords.x, coords.y);
				if (element) {
					done++;
					touchedElements[event.changedTouches[j].identifier] = {
						element: element,
						camera: camera,
						x: coords.x,
						y: coords.y
					};
				}
			}
			if (done === len) {
				break;
			}
		}
		return touchedElements;
	}
	_handleTouchStart(event) {
		if (!this._enabled) return;
		const newTouchedElements = this._determineTouchedElements(event);
		for (let i = 0, len = event.changedTouches.length; i < len; i++) {
			const touch = event.changedTouches[i];
			const newTouchInfo = newTouchedElements[touch.identifier];
			const oldTouchInfo = this._touchedElements[touch.identifier];
			if (newTouchInfo && (!oldTouchInfo || newTouchInfo.element !== oldTouchInfo.element)) {
				this._fireEvent(event.type, new ElementTouchEvent(event, newTouchInfo.element, newTouchInfo.camera, newTouchInfo.x, newTouchInfo.y, touch));
				this._touchesForWhichTouchLeaveHasFired[touch.identifier] = false;
			}
		}
		for (const touchId in newTouchedElements) {
			this._touchedElements[touchId] = newTouchedElements[touchId];
		}
	}
	_handleTouchEnd(event) {
		if (!this._enabled) return;
		const cameras = this.app.systems.camera.cameras;
		for (const key in this._clickedEntities) {
			delete this._clickedEntities[key];
		}
		for (let i = 0, len = event.changedTouches.length; i < len; i++) {
			const touch = event.changedTouches[i];
			const touchInfo = this._touchedElements[touch.identifier];
			if (!touchInfo) continue;
			const element = touchInfo.element;
			const camera = touchInfo.camera;
			const x = touchInfo.x;
			const y = touchInfo.y;
			delete this._touchedElements[touch.identifier];
			delete this._touchesForWhichTouchLeaveHasFired[touch.identifier];
			this._fireEvent(event.type, new ElementTouchEvent(event, element, camera, x, y, touch));
			const coords = this._calcTouchCoords(touch);
			for (let c = cameras.length - 1; c >= 0; c--) {
				const hovered = this._getTargetElementByCoords(cameras[c], coords.x, coords.y);
				if (hovered === element) {
					if (!this._clickedEntities[element.entity.getGuid()]) {
						this._fireEvent('click', new ElementTouchEvent(event, element, camera, x, y, touch));
						this._clickedEntities[element.entity.getGuid()] = Date.now();
					}
				}
			}
		}
	}
	_handleTouchMove(event) {
		event.preventDefault();
		if (!this._enabled) return;
		const newTouchedElements = this._determineTouchedElements(event);
		for (let i = 0, len = event.changedTouches.length; i < len; i++) {
			const touch = event.changedTouches[i];
			const newTouchInfo = newTouchedElements[touch.identifier];
			const oldTouchInfo = this._touchedElements[touch.identifier];
			if (oldTouchInfo) {
				const coords = this._calcTouchCoords(touch);
				if ((!newTouchInfo || newTouchInfo.element !== oldTouchInfo.element) && !this._touchesForWhichTouchLeaveHasFired[touch.identifier]) {
					this._fireEvent('touchleave', new ElementTouchEvent(event, oldTouchInfo.element, oldTouchInfo.camera, coords.x, coords.y, touch));
					this._touchesForWhichTouchLeaveHasFired[touch.identifier] = true;
				}
				this._fireEvent('touchmove', new ElementTouchEvent(event, oldTouchInfo.element, oldTouchInfo.camera, coords.x, coords.y, touch));
			}
		}
	}
	_onElementMouseEvent(eventType, event) {
		let element = null;
		const lastHovered = this._hoveredElement;
		this._hoveredElement = null;
		const cameras = this.app.systems.camera.cameras;
		let camera;
		for (let i = cameras.length - 1; i >= 0; i--) {
			camera = cameras[i];
			element = this._getTargetElementByCoords(camera, targetX, targetY);
			if (element) break;
		}
		this._hoveredElement = element;
		if ((eventType === 'mousemove' || eventType === 'mouseup') && this._pressedElement) {
			this._fireEvent(eventType, new ElementMouseEvent(event, this._pressedElement, camera, targetX, targetY, this._lastX, this._lastY));
		} else if (element) {
			this._fireEvent(eventType, new ElementMouseEvent(event, element, camera, targetX, targetY, this._lastX, this._lastY));
			if (eventType === 'mousedown') {
				this._pressedElement = element;
			}
		}
		if (lastHovered !== this._hoveredElement) {
			if (lastHovered) {
				this._fireEvent('mouseleave', new ElementMouseEvent(event, lastHovered, camera, targetX, targetY, this._lastX, this._lastY));
			}
			if (this._hoveredElement) {
				this._fireEvent('mouseenter', new ElementMouseEvent(event, this._hoveredElement, camera, targetX, targetY, this._lastX, this._lastY));
			}
		}
		if (eventType === 'mouseup' && this._pressedElement) {
			if (this._pressedElement === this._hoveredElement) {
				const guid = this._hoveredElement.entity.getGuid();
				let fireClick = !this._clickedEntities;
				if (this._clickedEntities) {
					const lastTouchUp = this._clickedEntities[guid] || 0;
					const dt = Date.now() - lastTouchUp;
					fireClick = dt > 300;
					delete this._clickedEntities[guid];
				}
				if (fireClick) {
					this._fireEvent('click', new ElementMouseEvent(event, this._hoveredElement, camera, targetX, targetY, this._lastX, this._lastY));
				}
			}
			this._pressedElement = null;
		}
	}
	_onXrStart() {
		this.app.xr.on('end', this._onXrEnd, this);
		this.app.xr.on('update', this._onXrUpdate, this);
		this.app.xr.input.on('selectstart', this._onSelectStart, this);
		this.app.xr.input.on('selectend', this._onSelectEnd, this);
		this.app.xr.input.on('remove', this._onXrInputRemove, this);
	}
	_onXrEnd() {
		this.app.xr.off('update', this._onXrUpdate, this);
		this.app.xr.input.off('selectstart', this._onSelectStart, this);
		this.app.xr.input.off('selectend', this._onSelectEnd, this);
		this.app.xr.input.off('remove', this._onXrInputRemove, this);
	}
	_onXrUpdate() {
		if (!this._enabled) return;
		const inputSources = this.app.xr.input.inputSources;
		for (let i = 0; i < inputSources.length; i++) {
			this._onElementSelectEvent('selectmove', inputSources[i], null);
		}
	}
	_onXrInputRemove(inputSource) {
		const hovered = this._selectedElements[inputSource.id];
		if (hovered) {
			inputSource._elementEntity = null;
			this._fireEvent('selectleave', new ElementSelectEvent(null, hovered, null, inputSource));
		}
		delete this._selectedElements[inputSource.id];
		delete this._selectedPressedElements[inputSource.id];
	}
	_onSelectStart(inputSource, event) {
		if (!this._enabled) return;
		this._onElementSelectEvent('selectstart', inputSource, event);
	}
	_onSelectEnd(inputSource, event) {
		if (!this._enabled) return;
		this._onElementSelectEvent('selectend', inputSource, event);
	}
	_onElementSelectEvent(eventType, inputSource, event) {
		let element;
		const hoveredBefore = this._selectedElements[inputSource.id];
		let hoveredNow;
		const cameras = this.app.systems.camera.cameras;
		let camera;
		if (inputSource.elementInput) {
			rayC.set(inputSource.getOrigin(), inputSource.getDirection());
			for (let i = cameras.length - 1; i >= 0; i--) {
				camera = cameras[i];
				element = this._getTargetElementByRay(rayC, camera);
				if (element) break;
			}
		}
		inputSource._elementEntity = element || null;
		if (element) {
			this._selectedElements[inputSource.id] = element;
			hoveredNow = element;
		} else {
			delete this._selectedElements[inputSource.id];
		}
		if (hoveredBefore !== hoveredNow) {
			if (hoveredBefore) this._fireEvent('selectleave', new ElementSelectEvent(event, hoveredBefore, camera, inputSource));
			if (hoveredNow) this._fireEvent('selectenter', new ElementSelectEvent(event, hoveredNow, camera, inputSource));
		}
		const pressed = this._selectedPressedElements[inputSource.id];
		if (eventType === 'selectmove' && pressed) {
			this._fireEvent('selectmove', new ElementSelectEvent(event, pressed, camera, inputSource));
		}
		if (eventType === 'selectstart') {
			this._selectedPressedElements[inputSource.id] = hoveredNow;
			if (hoveredNow) this._fireEvent('selectstart', new ElementSelectEvent(event, hoveredNow, camera, inputSource));
		}
		if (!inputSource.elementInput && pressed) {
			delete this._selectedPressedElements[inputSource.id];
			if (hoveredBefore) {
				this._fireEvent('selectend', new ElementSelectEvent(event, pressed, camera, inputSource));
			}
		}
		if (eventType === 'selectend' && inputSource.elementInput) {
			delete this._selectedPressedElements[inputSource.id];
			if (pressed) {
				this._fireEvent('selectend', new ElementSelectEvent(event, pressed, camera, inputSource));
			}
			if (pressed && pressed === hoveredBefore) {
				this._fireEvent('click', new ElementSelectEvent(event, pressed, camera, inputSource));
			}
		}
	}
	_fireEvent(name, evt) {
		let element = evt.element;
		while (true) {
			element.fire(name, evt);
			if (evt._stopPropagation) break;
			if (!element.entity.parent) break;
			element = element.entity.parent.element;
			if (!element) break;
		}
	}
	_calcMouseCoords(event) {
		const rect = this._target.getBoundingClientRect();
		const left = Math.floor(rect.left);
		const top = Math.floor(rect.top);
		targetX = event.clientX - left;
		targetY = event.clientY - top;
	}
	_calcTouchCoords(touch) {
		let totalOffsetX = 0;
		let totalOffsetY = 0;
		let target = touch.target;
		while (!(target instanceof HTMLElement)) {
			target = target.parentNode;
		}
		let currentElement = target;
		do {
			totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
			totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
			currentElement = currentElement.offsetParent;
		} while (currentElement);
		return {
			x: touch.pageX - totalOffsetX,
			y: touch.pageY - totalOffsetY
		};
	}
	_sortElements(a, b) {
		const layerOrder = this.app.scene.layers.sortTransparentLayers(a.layers, b.layers);
		if (layerOrder !== 0) return layerOrder;
		if (a.screen && !b.screen) return -1;
		if (!a.screen && b.screen) return 1;
		if (!a.screen && !b.screen) return 0;
		if (a.screen.screen.screenSpace && !b.screen.screen.screenSpace) return -1;
		if (b.screen.screen.screenSpace && !a.screen.screen.screenSpace) return 1;
		return b.drawOrder - a.drawOrder;
	}
	_getTargetElementByCoords(camera, x, y) {
		const rayScreen = this._calculateRayScreen(x, y, camera, rayA) ? rayA : null;
		const ray3d = this._calculateRay3d(x, y, camera, rayB) ? rayB : null;
		return this._getTargetElement(camera, rayScreen, ray3d);
	}
	_getTargetElementByRay(ray, camera) {
		rayA.origin.copy(ray.origin);
		rayA.direction.copy(ray.direction);
		rayA.end.copy(rayA.direction).mulScalar(camera.farClip * 2).add(rayA.origin);
		const ray3d = rayA;
		const screenPos = camera.worldToScreen(ray3d.origin, vecA);
		const rayScreen = this._calculateRayScreen(screenPos.x, screenPos.y, camera, rayB) ? rayB : null;
		return this._getTargetElement(camera, rayScreen, ray3d);
	}
	_getTargetElement(camera, rayScreen, ray3d) {
		let result = null;
		let closestDistance3d = Infinity;
		this._elements.sort(this._sortHandler);
		for (let i = 0, len = this._elements.length; i < len; i++) {
			const element = this._elements[i];
			if (!element.layers.some(v => camera.layersSet.has(v))) {
				continue;
			}
			if (element.screen && element.screen.screen.screenSpace) {
				if (!rayScreen) {
					continue;
				}
				const currentDistance = this._checkElement(rayScreen, element, true);
				if (currentDistance >= 0) {
					result = element;
					break;
				}
			} else {
				if (!ray3d) {
					continue;
				}
				const currentDistance = this._checkElement(ray3d, element, false);
				if (currentDistance >= 0) {
					if (currentDistance < closestDistance3d) {
						result = element;
						closestDistance3d = currentDistance;
					}
					if (element.screen) {
						result = element;
						break;
					}
				}
			}
		}
		return result;
	}
	_calculateRayScreen(x, y, camera, ray) {
		const sw = this.app.graphicsDevice.width;
		const sh = this.app.graphicsDevice.height;
		const cameraWidth = camera.rect.z * sw;
		const cameraHeight = camera.rect.w * sh;
		const cameraLeft = camera.rect.x * sw;
		const cameraRight = cameraLeft + cameraWidth;
		const cameraBottom = (1 - camera.rect.y) * sh;
		const cameraTop = cameraBottom - cameraHeight;
		let _x = x * sw / this._target.clientWidth;
		let _y = y * sh / this._target.clientHeight;
		if (_x >= cameraLeft && _x <= cameraRight && _y <= cameraBottom && _y >= cameraTop) {
			_x = sw * (_x - cameraLeft) / cameraWidth;
			_y = sh * (_y - cameraTop) / cameraHeight;
			_y = sh - _y;
			ray.origin.set(_x, _y, 1);
			ray.direction.set(0, 0, -1);
			ray.end.copy(ray.direction).mulScalar(2).add(ray.origin);
			return true;
		}
		return false;
	}
	_calculateRay3d(x, y, camera, ray) {
		const sw = this._target.clientWidth;
		const sh = this._target.clientHeight;
		const cameraWidth = camera.rect.z * sw;
		const cameraHeight = camera.rect.w * sh;
		const cameraLeft = camera.rect.x * sw;
		const cameraRight = cameraLeft + cameraWidth;
		const cameraBottom = (1 - camera.rect.y) * sh;
		const cameraTop = cameraBottom - cameraHeight;
		let _x = x;
		let _y = y;
		if (x >= cameraLeft && x <= cameraRight && y <= cameraBottom && _y >= cameraTop) {
			_x = sw * (_x - cameraLeft) / cameraWidth;
			_y = sh * (_y - cameraTop) / cameraHeight;
			camera.screenToWorld(_x, _y, camera.nearClip, vecA);
			camera.screenToWorld(_x, _y, camera.farClip, vecB);
			ray.origin.copy(vecA);
			ray.direction.set(0, 0, -1);
			ray.end.copy(vecB);
			return true;
		}
		return false;
	}
	_checkElement(ray, element, screen) {
		if (element.maskedBy) {
			if (this._checkElement(ray, element.maskedBy.element, screen) < 0) {
				return -1;
			}
		}
		let scale;
		if (screen) {
			scale = ElementInput.calculateScaleToScreen(element);
		} else {
			scale = ElementInput.calculateScaleToWorld(element);
		}
		const corners = ElementInput.buildHitCorners(element, screen ? element.screenCorners : element.worldCorners, scale);
		return intersectLineQuad(ray.origin, ray.end, corners);
	}
	static buildHitCorners(element, screenOrWorldCorners, scale) {
		let hitCorners = screenOrWorldCorners;
		const button = element.entity && element.entity.button;
		if (button) {
			const hitPadding = element.entity.button.hitPadding || ZERO_VEC4;
			_paddingTop.copy(element.entity.up);
			_paddingBottom.copy(_paddingTop).mulScalar(-1);
			_paddingRight.copy(element.entity.right);
			_paddingLeft.copy(_paddingRight).mulScalar(-1);
			_paddingTop.mulScalar(hitPadding.w * scale.y);
			_paddingBottom.mulScalar(hitPadding.y * scale.y);
			_paddingRight.mulScalar(hitPadding.z * scale.x);
			_paddingLeft.mulScalar(hitPadding.x * scale.x);
			_cornerBottomLeft.copy(hitCorners[0]).add(_paddingBottom).add(_paddingLeft);
			_cornerBottomRight.copy(hitCorners[1]).add(_paddingBottom).add(_paddingRight);
			_cornerTopRight.copy(hitCorners[2]).add(_paddingTop).add(_paddingRight);
			_cornerTopLeft.copy(hitCorners[3]).add(_paddingTop).add(_paddingLeft);
			hitCorners = [_cornerBottomLeft, _cornerBottomRight, _cornerTopRight, _cornerTopLeft];
		}
		if (scale.x < 0) {
			const left = hitCorners[2].x;
			const right = hitCorners[0].x;
			hitCorners[0].x = left;
			hitCorners[1].x = right;
			hitCorners[2].x = right;
			hitCorners[3].x = left;
		}
		if (scale.y < 0) {
			const bottom = hitCorners[2].y;
			const top = hitCorners[0].y;
			hitCorners[0].y = bottom;
			hitCorners[1].y = bottom;
			hitCorners[2].y = top;
			hitCorners[3].y = top;
		}
		if (scale.z < 0) {
			const x = hitCorners[2].x;
			const y = hitCorners[2].y;
			const z = hitCorners[2].z;
			hitCorners[2].x = hitCorners[0].x;
			hitCorners[2].y = hitCorners[0].y;
			hitCorners[2].z = hitCorners[0].z;
			hitCorners[0].x = x;
			hitCorners[0].y = y;
			hitCorners[0].z = z;
		}
		return hitCorners;
	}
	static calculateScaleToScreen(element) {
		let current = element.entity;
		const screenScale = element.screen.screen.scale;
		_accumulatedScale.set(screenScale, screenScale, screenScale);
		while (current && !current.screen) {
			_accumulatedScale.mul(current.getLocalScale());
			current = current.parent;
		}
		return _accumulatedScale;
	}
	static calculateScaleToWorld(element) {
		let current = element.entity;
		_accumulatedScale.set(1, 1, 1);
		while (current) {
			_accumulatedScale.mul(current.getLocalScale());
			current = current.parent;
		}
		return _accumulatedScale;
	}
}

export { ElementInput, ElementInputEvent, ElementMouseEvent, ElementSelectEvent, ElementTouchEvent };
