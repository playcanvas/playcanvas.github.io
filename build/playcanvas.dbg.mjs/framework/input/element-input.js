/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../../core/platform.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Ray } from '../../core/shape/ray.js';
import { getApplication } from '../globals.js';
import { Mouse } from '../../platform/input/mouse.js';

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
            this._clickedEntities[element.entity.getGuid()] = true;
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
        this._pressedElement = null;

        if (!this._clickedEntities || !this._clickedEntities[this._hoveredElement.entity.getGuid()]) {
          this._fireEvent('click', new ElementMouseEvent(event, this._hoveredElement, camera, targetX, targetY, this._lastX, this._lastY));
        }
      } else {
        this._pressedElement = null;
      }
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
    if (eventType === 'selectstart') {
      this._selectedPressedElements[inputSource.id] = hoveredNow;
      if (hoveredNow) this._fireEvent('selectstart', new ElementSelectEvent(event, hoveredNow, camera, inputSource));
    }
    const pressed = this._selectedPressedElements[inputSource.id];
    if (!inputSource.elementInput && pressed) {
      delete this._selectedPressedElements[inputSource.id];
      if (hoveredBefore) this._fireEvent('selectend', new ElementSelectEvent(event, hoveredBefore, camera, inputSource));
    }
    if (eventType === 'selectend' && inputSource.elementInput) {
      delete this._selectedPressedElements[inputSource.id];
      if (hoveredBefore) this._fireEvent('selectend', new ElementSelectEvent(event, hoveredBefore, camera, inputSource));
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

  _buildHitCorners(element, screenOrWorldCorners, scaleX, scaleY, scaleZ) {
    let hitCorners = screenOrWorldCorners;
    const button = element.entity && element.entity.button;
    if (button) {
      const hitPadding = element.entity.button.hitPadding || ZERO_VEC4;
      _paddingTop.copy(element.entity.up);
      _paddingBottom.copy(_paddingTop).mulScalar(-1);
      _paddingRight.copy(element.entity.right);
      _paddingLeft.copy(_paddingRight).mulScalar(-1);
      _paddingTop.mulScalar(hitPadding.w * scaleY);
      _paddingBottom.mulScalar(hitPadding.y * scaleY);
      _paddingRight.mulScalar(hitPadding.z * scaleX);
      _paddingLeft.mulScalar(hitPadding.x * scaleX);
      _cornerBottomLeft.copy(hitCorners[0]).add(_paddingBottom).add(_paddingLeft);
      _cornerBottomRight.copy(hitCorners[1]).add(_paddingBottom).add(_paddingRight);
      _cornerTopRight.copy(hitCorners[2]).add(_paddingTop).add(_paddingRight);
      _cornerTopLeft.copy(hitCorners[3]).add(_paddingTop).add(_paddingLeft);
      hitCorners = [_cornerBottomLeft, _cornerBottomRight, _cornerTopRight, _cornerTopLeft];
    }

    if (scaleX < 0) {
      const left = hitCorners[2].x;
      const right = hitCorners[0].x;
      hitCorners[0].x = left;
      hitCorners[1].x = right;
      hitCorners[2].x = right;
      hitCorners[3].x = left;
    }
    if (scaleY < 0) {
      const bottom = hitCorners[2].y;
      const top = hitCorners[0].y;
      hitCorners[0].y = bottom;
      hitCorners[1].y = bottom;
      hitCorners[2].y = top;
      hitCorners[3].y = top;
    }
    if (scaleZ < 0) {
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
  _calculateScaleToScreen(element) {
    let current = element.entity;
    const screenScale = element.screen.screen.scale;
    _accumulatedScale.set(screenScale, screenScale, screenScale);
    while (current && !current.screen) {
      _accumulatedScale.mul(current.getLocalScale());
      current = current.parent;
    }
    return _accumulatedScale;
  }
  _calculateScaleToWorld(element) {
    let current = element.entity;
    _accumulatedScale.set(1, 1, 1);
    while (current) {
      _accumulatedScale.mul(current.getLocalScale());
      current = current.parent;
    }
    return _accumulatedScale;
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
      scale = this._calculateScaleToScreen(element);
    } else {
      scale = this._calculateScaleToWorld(element);
    }
    const corners = this._buildHitCorners(element, screen ? element.screenCorners : element.worldCorners, scale.x, scale.y, scale.z);
    return intersectLineQuad(ray.origin, ray.end, corners);
  }
}

export { ElementInput, ElementInputEvent, ElementMouseEvent, ElementSelectEvent, ElementTouchEvent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlbWVudC1pbnB1dC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9pbnB1dC9lbGVtZW50LWlucHV0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5cbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuXG5pbXBvcnQgeyBSYXkgfSBmcm9tICcuLi8uLi9jb3JlL3NoYXBlL3JheS5qcyc7XG5cbmltcG9ydCB7IGdldEFwcGxpY2F0aW9uIH0gZnJvbSAnLi4vZ2xvYmFscy5qcyc7XG5cbmltcG9ydCB7IE1vdXNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBDYW1lcmFDb21wb25lbnQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9jb21wb25lbnRzL2VsZW1lbnQvY29tcG9uZW50LmpzJykuRWxlbWVudENvbXBvbmVudH0gRWxlbWVudENvbXBvbmVudCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3hyL3hyLWlucHV0LXNvdXJjZS5qcycpLlhySW5wdXRTb3VyY2V9IFhySW5wdXRTb3VyY2UgKi9cblxubGV0IHRhcmdldFgsIHRhcmdldFk7XG5jb25zdCB2ZWNBID0gbmV3IFZlYzMoKTtcbmNvbnN0IHZlY0IgPSBuZXcgVmVjMygpO1xuXG5jb25zdCByYXlBID0gbmV3IFJheSgpO1xuY29uc3QgcmF5QiA9IG5ldyBSYXkoKTtcbmNvbnN0IHJheUMgPSBuZXcgUmF5KCk7XG5cbnJheUEuZW5kID0gbmV3IFZlYzMoKTtcbnJheUIuZW5kID0gbmV3IFZlYzMoKTtcbnJheUMuZW5kID0gbmV3IFZlYzMoKTtcblxuY29uc3QgX3BxID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wYSA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGIgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BjID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wZCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfbSA9IG5ldyBWZWMzKCk7XG5jb25zdCBfYXUgPSBuZXcgVmVjMygpO1xuY29uc3QgX2J2ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9jdyA9IG5ldyBWZWMzKCk7XG5jb25zdCBfaXIgPSBuZXcgVmVjMygpO1xuY29uc3QgX3NjdCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfYWNjdW11bGF0ZWRTY2FsZSA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGFkZGluZ1RvcCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGFkZGluZ0JvdHRvbSA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGFkZGluZ0xlZnQgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BhZGRpbmdSaWdodCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfY29ybmVyQm90dG9tTGVmdCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfY29ybmVyQm90dG9tUmlnaHQgPSBuZXcgVmVjMygpO1xuY29uc3QgX2Nvcm5lclRvcFJpZ2h0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9jb3JuZXJUb3BMZWZ0ID0gbmV3IFZlYzMoKTtcblxuY29uc3QgWkVST19WRUM0ID0gbmV3IFZlYzQoKTtcblxuLy8gcGkgeCBwMiAqIHAzXG5mdW5jdGlvbiBzY2FsYXJUcmlwbGUocDEsIHAyLCBwMykge1xuICAgIHJldHVybiBfc2N0LmNyb3NzKHAxLCBwMikuZG90KHAzKTtcbn1cblxuLy8gR2l2ZW4gbGluZSBwcSBhbmQgY2N3IGNvcm5lcnMgb2YgYSBxdWFkLCByZXR1cm4gdGhlIHNxdWFyZSBkaXN0YW5jZSB0byB0aGUgaW50ZXJzZWN0aW9uIHBvaW50LlxuLy8gSWYgdGhlIGxpbmUgYW5kIHF1YWQgZG8gbm90IGludGVyc2VjdCwgcmV0dXJuIC0xLiAoZnJvbSBSZWFsLVRpbWUgQ29sbGlzaW9uIERldGVjdGlvbiBib29rKVxuZnVuY3Rpb24gaW50ZXJzZWN0TGluZVF1YWQocCwgcSwgY29ybmVycykge1xuICAgIF9wcS5zdWIyKHEsIHApO1xuICAgIF9wYS5zdWIyKGNvcm5lcnNbMF0sIHApO1xuICAgIF9wYi5zdWIyKGNvcm5lcnNbMV0sIHApO1xuICAgIF9wYy5zdWIyKGNvcm5lcnNbMl0sIHApO1xuXG4gICAgLy8gRGV0ZXJtaW5lIHdoaWNoIHRyaWFuZ2xlIHRvIHRlc3QgYWdhaW5zdCBieSB0ZXN0aW5nIGFnYWluc3QgZGlhZ29uYWwgZmlyc3RcbiAgICBfbS5jcm9zcyhfcGMsIF9wcSk7XG4gICAgbGV0IHYgPSBfcGEuZG90KF9tKTtcbiAgICBsZXQgdTtcbiAgICBsZXQgdztcblxuICAgIGlmICh2ID49IDApIHtcbiAgICAgICAgLy8gVGVzdCBpbnRlcnNlY3Rpb24gYWdhaW5zdCB0cmlhbmdsZSBhYmNcbiAgICAgICAgdSA9IC1fcGIuZG90KF9tKTtcbiAgICAgICAgaWYgKHUgPCAwKVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuXG4gICAgICAgIHcgPSBzY2FsYXJUcmlwbGUoX3BxLCBfcGIsIF9wYSk7XG4gICAgICAgIGlmICh3IDwgMClcbiAgICAgICAgICAgIHJldHVybiAtMTtcblxuICAgICAgICBjb25zdCBkZW5vbSA9IDEuMCAvICh1ICsgdiArIHcpO1xuXG4gICAgICAgIF9hdS5jb3B5KGNvcm5lcnNbMF0pLm11bFNjYWxhcih1ICogZGVub20pO1xuICAgICAgICBfYnYuY29weShjb3JuZXJzWzFdKS5tdWxTY2FsYXIodiAqIGRlbm9tKTtcbiAgICAgICAgX2N3LmNvcHkoY29ybmVyc1syXSkubXVsU2NhbGFyKHcgKiBkZW5vbSk7XG4gICAgICAgIF9pci5jb3B5KF9hdSkuYWRkKF9idikuYWRkKF9jdyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gVGVzdCBpbnRlcnNlY3Rpb24gYWdhaW5zdCB0cmlhbmdsZSBkYWNcbiAgICAgICAgX3BkLnN1YjIoY29ybmVyc1szXSwgcCk7XG4gICAgICAgIHUgPSBfcGQuZG90KF9tKTtcbiAgICAgICAgaWYgKHUgPCAwKVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuXG4gICAgICAgIHcgPSBzY2FsYXJUcmlwbGUoX3BxLCBfcGEsIF9wZCk7XG4gICAgICAgIGlmICh3IDwgMClcbiAgICAgICAgICAgIHJldHVybiAtMTtcblxuICAgICAgICB2ID0gLXY7XG5cbiAgICAgICAgY29uc3QgZGVub20gPSAxLjAgLyAodSArIHYgKyB3KTtcblxuICAgICAgICBfYXUuY29weShjb3JuZXJzWzBdKS5tdWxTY2FsYXIodSAqIGRlbm9tKTtcbiAgICAgICAgX2J2LmNvcHkoY29ybmVyc1szXSkubXVsU2NhbGFyKHYgKiBkZW5vbSk7XG4gICAgICAgIF9jdy5jb3B5KGNvcm5lcnNbMl0pLm11bFNjYWxhcih3ICogZGVub20pO1xuICAgICAgICBfaXIuY29weShfYXUpLmFkZChfYnYpLmFkZChfY3cpO1xuICAgIH1cblxuICAgIC8vIFRoZSBhbGdvcml0aG0gYWJvdmUgZG9lc24ndCB3b3JrIGlmIGFsbCB0aGUgY29ybmVycyBhcmUgdGhlIHNhbWVcbiAgICAvLyBTbyBkbyB0aGF0IHRlc3QgaGVyZSBieSBjaGVja2luZyBpZiB0aGUgZGlhZ29uYWxzIGFyZSAwIChzaW5jZSB0aGVzZSBhcmUgcmVjdGFuZ2xlcyB3ZSdyZSBjaGVja2luZyBhZ2FpbnN0KVxuICAgIGlmIChfcHEuc3ViMihjb3JuZXJzWzBdLCBjb3JuZXJzWzJdKS5sZW5ndGhTcSgpIDwgMC4wMDAxICogMC4wMDAxKSByZXR1cm4gLTE7XG4gICAgaWYgKF9wcS5zdWIyKGNvcm5lcnNbMV0sIGNvcm5lcnNbM10pLmxlbmd0aFNxKCkgPCAwLjAwMDEgKiAwLjAwMDEpIHJldHVybiAtMTtcblxuICAgIHJldHVybiBfaXIuc3ViKHApLmxlbmd0aFNxKCk7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBpbnB1dCBldmVudCBmaXJlZCBvbiBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fS4gV2hlbiBhbiBldmVudCBpcyByYWlzZWQgb24gYW5cbiAqIEVsZW1lbnRDb21wb25lbnQgaXQgYnViYmxlcyB1cCB0byBpdHMgcGFyZW50IEVsZW1lbnRDb21wb25lbnRzIHVubGVzcyB3ZSBjYWxsIHN0b3BQcm9wYWdhdGlvbigpLlxuICovXG5jbGFzcyBFbGVtZW50SW5wdXRFdmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEVsZW1lbnRJbnB1dEV2ZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNb3VzZUV2ZW50fFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIE1vdXNlRXZlbnQgb3IgVG91Y2hFdmVudCB0aGF0IHdhcyBvcmlnaW5hbGx5XG4gICAgICogcmFpc2VkLlxuICAgICAqIEBwYXJhbSB7RWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZSBFbGVtZW50Q29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseVxuICAgICAqIHJhaXNlZCBvbi5cbiAgICAgKiBAcGFyYW0ge0NhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gVGhlIENhbWVyYUNvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkXG4gICAgICogdmlhLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBNb3VzZUV2ZW50IG9yIFRvdWNoRXZlbnQgdGhhdCB3YXMgb3JpZ2luYWxseSByYWlzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtNb3VzZUV2ZW50fFRvdWNoRXZlbnR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBFbGVtZW50Q29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWQgb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtFbGVtZW50Q29tcG9uZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIENhbWVyYUNvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkIHZpYS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NhbWVyYUNvbXBvbmVudH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xuXG4gICAgICAgIHRoaXMuX3N0b3BQcm9wYWdhdGlvbiA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0b3AgcHJvcGFnYXRpb24gb2YgdGhlIGV2ZW50IHRvIHBhcmVudCB7QGxpbmsgRWxlbWVudENvbXBvbmVudH1zLiBUaGlzIGFsc28gc3RvcHNcbiAgICAgKiBwcm9wYWdhdGlvbiBvZiB0aGUgZXZlbnQgdG8gb3RoZXIgZXZlbnQgbGlzdGVuZXJzIG9mIHRoZSBvcmlnaW5hbCBET00gRXZlbnQuXG4gICAgICovXG4gICAgc3RvcFByb3BhZ2F0aW9uKCkge1xuICAgICAgICB0aGlzLl9zdG9wUHJvcGFnYXRpb24gPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5ldmVudCkge1xuICAgICAgICAgICAgdGhpcy5ldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIE1vdXNlIGV2ZW50IGZpcmVkIG9uIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9LlxuICpcbiAqIEBhdWdtZW50cyBFbGVtZW50SW5wdXRFdmVudFxuICovXG5jbGFzcyBFbGVtZW50TW91c2VFdmVudCBleHRlbmRzIEVsZW1lbnRJbnB1dEV2ZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW4gaW5zdGFuY2Ugb2YgYW4gRWxlbWVudE1vdXNlRXZlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIE1vdXNlRXZlbnQgdGhhdCB3YXMgb3JpZ2luYWxseSByYWlzZWQuXG4gICAgICogQHBhcmFtIHtFbGVtZW50Q29tcG9uZW50fSBlbGVtZW50IC0gVGhlIEVsZW1lbnRDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5XG4gICAgICogcmFpc2VkIG9uLlxuICAgICAqIEBwYXJhbSB7Q2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBUaGUgQ2FtZXJhQ29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWRcbiAgICAgKiB2aWEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeCBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGFzdFggLSBUaGUgbGFzdCB4IGNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGxhc3RZIC0gVGhlIGxhc3QgeSBjb29yZGluYXRlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIHgsIHksIGxhc3RYLCBsYXN0WSkge1xuICAgICAgICBzdXBlcihldmVudCwgZWxlbWVudCwgY2FtZXJhKTtcblxuICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICB0aGlzLnkgPSB5O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGV0aGVyIHRoZSBjdHJsIGtleSB3YXMgcHJlc3NlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN0cmxLZXkgPSBldmVudC5jdHJsS2V5IHx8IGZhbHNlO1xuICAgICAgICAvKipcbiAgICAgICAgICogV2hldGhlciB0aGUgYWx0IGtleSB3YXMgcHJlc3NlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmFsdEtleSA9IGV2ZW50LmFsdEtleSB8fCBmYWxzZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdoZXRoZXIgdGhlIHNoaWZ0IGtleSB3YXMgcHJlc3NlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNoaWZ0S2V5ID0gZXZlbnQuc2hpZnRLZXkgfHwgZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGV0aGVyIHRoZSBtZXRhIGtleSB3YXMgcHJlc3NlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm1ldGFLZXkgPSBldmVudC5tZXRhS2V5IHx8IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbW91c2UgYnV0dG9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5idXR0b24gPSBldmVudC5idXR0b247XG5cbiAgICAgICAgaWYgKE1vdXNlLmlzUG9pbnRlckxvY2tlZCgpKSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBhbW91bnQgb2YgaG9yaXpvbnRhbCBtb3ZlbWVudCBvZiB0aGUgY3Vyc29yLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuZHggPSBldmVudC5tb3ZlbWVudFggfHwgZXZlbnQud2Via2l0TW92ZW1lbnRYIHx8IGV2ZW50Lm1vek1vdmVtZW50WCB8fCAwO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgYW1vdW50IG9mIHZlcnRpY2FsIG1vdmVtZW50IG9mIHRoZSBjdXJzb3IuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5keSA9IGV2ZW50Lm1vdmVtZW50WSB8fCBldmVudC53ZWJraXRNb3ZlbWVudFkgfHwgZXZlbnQubW96TW92ZW1lbnRZIHx8IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmR4ID0geCAtIGxhc3RYO1xuICAgICAgICAgICAgdGhpcy5keSA9IHkgLSBsYXN0WTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYW1vdW50IG9mIHRoZSB3aGVlbCBtb3ZlbWVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMud2hlZWxEZWx0YSA9IDA7XG5cbiAgICAgICAgLy8gZGVsdGFZIGlzIGluIGEgZGlmZmVyZW50IHJhbmdlIGFjcm9zcyBkaWZmZXJlbnQgYnJvd3NlcnMuIFRoZSBvbmx5IHRoaW5nXG4gICAgICAgIC8vIHRoYXQgaXMgY29uc2lzdGVudCBpcyB0aGUgc2lnbiBvZiB0aGUgdmFsdWUgc28gc25hcCB0byAtMS8rMS5cbiAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICd3aGVlbCcpIHtcbiAgICAgICAgICAgIGlmIChldmVudC5kZWx0YVkgPiAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aGVlbERlbHRhID0gMTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZXZlbnQuZGVsdGFZIDwgMCkge1xuICAgICAgICAgICAgICAgIHRoaXMud2hlZWxEZWx0YSA9IC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBUb3VjaEV2ZW50IGZpcmVkIG9uIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9LlxuICpcbiAqIEBhdWdtZW50cyBFbGVtZW50SW5wdXRFdmVudFxuICovXG5jbGFzcyBFbGVtZW50VG91Y2hFdmVudCBleHRlbmRzIEVsZW1lbnRJbnB1dEV2ZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW4gaW5zdGFuY2Ugb2YgYW4gRWxlbWVudFRvdWNoRXZlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIFRvdWNoRXZlbnQgdGhhdCB3YXMgb3JpZ2luYWxseSByYWlzZWQuXG4gICAgICogQHBhcmFtIHtFbGVtZW50Q29tcG9uZW50fSBlbGVtZW50IC0gVGhlIEVsZW1lbnRDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5XG4gICAgICogcmFpc2VkIG9uLlxuICAgICAqIEBwYXJhbSB7Q2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBUaGUgQ2FtZXJhQ29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWRcbiAgICAgKiB2aWEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeCBjb29yZGluYXRlIG9mIHRoZSB0b3VjaCB0aGF0IHRyaWdnZXJlZCB0aGUgZXZlbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlIG9mIHRoZSB0b3VjaCB0aGF0IHRyaWdnZXJlZCB0aGUgZXZlbnQuXG4gICAgICogQHBhcmFtIHtUb3VjaH0gdG91Y2ggLSBUaGUgdG91Y2ggb2JqZWN0IHRoYXQgdHJpZ2dlcmVkIHRoZSBldmVudC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihldmVudCwgZWxlbWVudCwgY2FtZXJhLCB4LCB5LCB0b3VjaCkge1xuICAgICAgICBzdXBlcihldmVudCwgZWxlbWVudCwgY2FtZXJhKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFRvdWNoIG9iamVjdHMgcmVwcmVzZW50aW5nIGFsbCBjdXJyZW50IHBvaW50cyBvZiBjb250YWN0IHdpdGggdGhlIHN1cmZhY2UsXG4gICAgICAgICAqIHJlZ2FyZGxlc3Mgb2YgdGFyZ2V0IG9yIGNoYW5nZWQgc3RhdHVzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VG91Y2hbXX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudG91Y2hlcyA9IGV2ZW50LnRvdWNoZXM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgVG91Y2ggb2JqZWN0cyByZXByZXNlbnRpbmcgaW5kaXZpZHVhbCBwb2ludHMgb2YgY29udGFjdCB3aG9zZSBzdGF0ZXMgY2hhbmdlZCBiZXR3ZWVuXG4gICAgICAgICAqIHRoZSBwcmV2aW91cyB0b3VjaCBldmVudCBhbmQgdGhpcyBvbmUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUb3VjaFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jaGFuZ2VkVG91Y2hlcyA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzO1xuICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHRvdWNoIG9iamVjdCB0aGF0IHRyaWdnZXJlZCB0aGUgZXZlbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUb3VjaH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudG91Y2ggPSB0b3VjaDtcbiAgICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIFhSSW5wdXRTb3VyY2VFdmVudCBmaXJlZCBvbiBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fS5cbiAqXG4gKiBAYXVnbWVudHMgRWxlbWVudElucHV0RXZlbnRcbiAqL1xuY2xhc3MgRWxlbWVudFNlbGVjdEV2ZW50IGV4dGVuZHMgRWxlbWVudElucHV0RXZlbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBhIEVsZW1lbnRTZWxlY3RFdmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldmVudCAtIFRoZSBYUklucHV0U291cmNlRXZlbnQgdGhhdCB3YXMgb3JpZ2luYWxseSByYWlzZWQuXG4gICAgICogQHBhcmFtIHtFbGVtZW50Q29tcG9uZW50fSBlbGVtZW50IC0gVGhlIEVsZW1lbnRDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5XG4gICAgICogcmFpc2VkIG9uLlxuICAgICAqIEBwYXJhbSB7Q2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBUaGUgQ2FtZXJhQ29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWRcbiAgICAgKiB2aWEuXG4gICAgICogQHBhcmFtIHtYcklucHV0U291cmNlfSBpbnB1dFNvdXJjZSAtIFRoZSBYUiBpbnB1dCBzb3VyY2UgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5XG4gICAgICogcmFpc2VkIGZyb20uXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSwgaW5wdXRTb3VyY2UpIHtcbiAgICAgICAgc3VwZXIoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBYUiBpbnB1dCBzb3VyY2UgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZCBmcm9tLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7WHJJbnB1dFNvdXJjZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaW5wdXRTb3VyY2UgPSBpbnB1dFNvdXJjZTtcbiAgICB9XG59XG5cbi8qKlxuICogSGFuZGxlcyBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzIGZvciB7QGxpbmsgRWxlbWVudENvbXBvbmVudH1zLiBXaGVuIGlucHV0IGV2ZW50cyBvY2N1ciBvbiBhblxuICogRWxlbWVudENvbXBvbmVudCB0aGlzIGZpcmVzIHRoZSBhcHByb3ByaWF0ZSBldmVudHMgb24gdGhlIEVsZW1lbnRDb21wb25lbnQuXG4gKi9cbmNsYXNzIEVsZW1lbnRJbnB1dCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEVsZW1lbnRJbnB1dCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudH0gZG9tRWxlbWVudCAtIFRoZSBET00gZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9uYWwgYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudXNlTW91c2VdIC0gV2hldGhlciB0byBhbGxvdyBtb3VzZSBpbnB1dC4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnVzZVRvdWNoXSAtIFdoZXRoZXIgdG8gYWxsb3cgdG91Y2ggaW5wdXQuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy51c2VYcl0gLSBXaGV0aGVyIHRvIGFsbG93IFhSIGlucHV0IHNvdXJjZXMuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZG9tRWxlbWVudCwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLl9hcHAgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRhY2hlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl90YXJnZXQgPSBudWxsO1xuXG4gICAgICAgIC8vIGZvcmNlIGRpc2FibGUgYWxsIGVsZW1lbnQgaW5wdXQgZXZlbnRzXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX2xhc3RYID0gMDtcbiAgICAgICAgdGhpcy5fbGFzdFkgPSAwO1xuXG4gICAgICAgIHRoaXMuX3VwSGFuZGxlciA9IHRoaXMuX2hhbmRsZVVwLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX2Rvd25IYW5kbGVyID0gdGhpcy5faGFuZGxlRG93bi5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9tb3ZlSGFuZGxlciA9IHRoaXMuX2hhbmRsZU1vdmUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fd2hlZWxIYW5kbGVyID0gdGhpcy5faGFuZGxlV2hlZWwuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fdG91Y2hzdGFydEhhbmRsZXIgPSB0aGlzLl9oYW5kbGVUb3VjaFN0YXJ0LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX3RvdWNoZW5kSGFuZGxlciA9IHRoaXMuX2hhbmRsZVRvdWNoRW5kLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX3RvdWNoY2FuY2VsSGFuZGxlciA9IHRoaXMuX3RvdWNoZW5kSGFuZGxlcjtcbiAgICAgICAgdGhpcy5fdG91Y2htb3ZlSGFuZGxlciA9IHRoaXMuX2hhbmRsZVRvdWNoTW92ZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9zb3J0SGFuZGxlciA9IHRoaXMuX3NvcnRFbGVtZW50cy5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX2VsZW1lbnRzID0gW107XG4gICAgICAgIHRoaXMuX2hvdmVyZWRFbGVtZW50ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fcHJlc3NlZEVsZW1lbnQgPSBudWxsO1xuICAgICAgICB0aGlzLl90b3VjaGVkRWxlbWVudHMgPSB7fTtcbiAgICAgICAgdGhpcy5fdG91Y2hlc0ZvcldoaWNoVG91Y2hMZWF2ZUhhc0ZpcmVkID0ge307XG4gICAgICAgIHRoaXMuX3NlbGVjdGVkRWxlbWVudHMgPSB7fTtcbiAgICAgICAgdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHMgPSB7fTtcblxuICAgICAgICB0aGlzLl91c2VNb3VzZSA9ICFvcHRpb25zIHx8IG9wdGlvbnMudXNlTW91c2UgIT09IGZhbHNlO1xuICAgICAgICB0aGlzLl91c2VUb3VjaCA9ICFvcHRpb25zIHx8IG9wdGlvbnMudXNlVG91Y2ggIT09IGZhbHNlO1xuICAgICAgICB0aGlzLl91c2VYciA9ICFvcHRpb25zIHx8IG9wdGlvbnMudXNlWHIgIT09IGZhbHNlO1xuICAgICAgICB0aGlzLl9zZWxlY3RFdmVudHNBdHRhY2hlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChwbGF0Zm9ybS50b3VjaClcbiAgICAgICAgICAgIHRoaXMuX2NsaWNrZWRFbnRpdGllcyA9IHt9O1xuXG4gICAgICAgIHRoaXMuYXR0YWNoKGRvbUVsZW1lbnQpO1xuICAgIH1cblxuICAgIHNldCBlbmFibGVkKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG4gICAgfVxuXG4gICAgc2V0IGFwcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hcHAgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYXBwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXBwIHx8IGdldEFwcGxpY2F0aW9uKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0YWNoIG1vdXNlIGFuZCB0b3VjaCBldmVudHMgdG8gYSBET00gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudH0gZG9tRWxlbWVudCAtIFRoZSBET00gZWxlbWVudC5cbiAgICAgKi9cbiAgICBhdHRhY2goZG9tRWxlbWVudCkge1xuICAgICAgICBpZiAodGhpcy5fYXR0YWNoZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2F0dGFjaGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmRldGFjaCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdGFyZ2V0ID0gZG9tRWxlbWVudDtcbiAgICAgICAgdGhpcy5fYXR0YWNoZWQgPSB0cnVlO1xuXG4gICAgICAgIGNvbnN0IG9wdHMgPSBwbGF0Zm9ybS5wYXNzaXZlRXZlbnRzID8geyBwYXNzaXZlOiB0cnVlIH0gOiBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuX3VzZU1vdXNlKSB7XG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuX3VwSGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5fZG93bkhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuX21vdmVIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd3aGVlbCcsIHRoaXMuX3doZWVsSGFuZGxlciwgb3B0cyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdXNlVG91Y2ggJiYgcGxhdGZvcm0udG91Y2gpIHtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy5fdG91Y2hzdGFydEhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgLy8gUGFzc2l2ZSBpcyBub3QgdXNlZCBmb3IgdGhlIHRvdWNoZW5kIGV2ZW50IGJlY2F1c2Ugc29tZSBjb21wb25lbnRzIG5lZWQgdG8gYmVcbiAgICAgICAgICAgIC8vIGFibGUgdG8gY2FsbCBwcmV2ZW50RGVmYXVsdCgpLiBTZWUgbm90ZXMgaW4gYnV0dG9uL2NvbXBvbmVudC5qcyBmb3IgbW9yZSBkZXRhaWxzLlxuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcy5fdG91Y2hlbmRIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLl90YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy5fdG91Y2htb3ZlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoY2FuY2VsJywgdGhpcy5fdG91Y2hjYW5jZWxIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF0dGFjaFNlbGVjdEV2ZW50cygpO1xuICAgIH1cblxuICAgIGF0dGFjaFNlbGVjdEV2ZW50cygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZWxlY3RFdmVudHNBdHRhY2hlZCAmJiB0aGlzLl91c2VYciAmJiB0aGlzLmFwcCAmJiB0aGlzLmFwcC54ciAmJiB0aGlzLmFwcC54ci5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fY2xpY2tlZEVudGl0aWVzKVxuICAgICAgICAgICAgICAgIHRoaXMuX2NsaWNrZWRFbnRpdGllcyA9IHt9O1xuXG4gICAgICAgICAgICB0aGlzLl9zZWxlY3RFdmVudHNBdHRhY2hlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmFwcC54ci5vbignc3RhcnQnLCB0aGlzLl9vblhyU3RhcnQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIG1vdXNlIGFuZCB0b3VjaCBldmVudHMgZnJvbSB0aGUgRE9NIGVsZW1lbnQgdGhhdCBpdCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBkZXRhY2goKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXR0YWNoZWQpIHJldHVybjtcbiAgICAgICAgdGhpcy5fYXR0YWNoZWQgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBvcHRzID0gcGxhdGZvcm0ucGFzc2l2ZUV2ZW50cyA/IHsgcGFzc2l2ZTogdHJ1ZSB9IDogZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLl91c2VNb3VzZSkge1xuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLl91cEhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMuX2Rvd25IYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLl9tb3ZlSGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2hlZWwnLCB0aGlzLl93aGVlbEhhbmRsZXIsIG9wdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3VzZVRvdWNoKSB7XG4gICAgICAgICAgICB0aGlzLl90YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMuX3RvdWNoc3RhcnRIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMuX3RvdWNoZW5kSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMuX3RvdWNobW92ZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGNhbmNlbCcsIHRoaXMuX3RvdWNoY2FuY2VsSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3NlbGVjdEV2ZW50c0F0dGFjaGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9zZWxlY3RFdmVudHNBdHRhY2hlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIub2ZmKCdzdGFydCcsIHRoaXMuX29uWHJTdGFydCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmFwcC54ci5vZmYoJ2VuZCcsIHRoaXMuX29uWHJFbmQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIub2ZmKCd1cGRhdGUnLCB0aGlzLl9vblhyVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZignc2VsZWN0c3RhcnQnLCB0aGlzLl9vblNlbGVjdFN0YXJ0LCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZignc2VsZWN0ZW5kJywgdGhpcy5fb25TZWxlY3RFbmQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblhySW5wdXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdGFyZ2V0ID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0gdG8gdGhlIGludGVybmFsIGxpc3Qgb2YgRWxlbWVudENvbXBvbmVudHMgdGhhdCBhcmUgYmVpbmdcbiAgICAgKiBjaGVja2VkIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZSBFbGVtZW50Q29tcG9uZW50LlxuICAgICAqL1xuICAgIGFkZEVsZW1lbnQoZWxlbWVudCkge1xuICAgICAgICBpZiAodGhpcy5fZWxlbWVudHMuaW5kZXhPZihlbGVtZW50KSA9PT0gLTEpXG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50cy5wdXNoKGVsZW1lbnQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fSBmcm9tIHRoZSBpbnRlcm5hbCBsaXN0IG9mIEVsZW1lbnRDb21wb25lbnRzIHRoYXQgYXJlIGJlaW5nXG4gICAgICogY2hlY2tlZCBmb3IgaW5wdXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRDb21wb25lbnR9IGVsZW1lbnQgLSBUaGUgRWxlbWVudENvbXBvbmVudC5cbiAgICAgKi9cbiAgICByZW1vdmVFbGVtZW50KGVsZW1lbnQpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5fZWxlbWVudHMuaW5kZXhPZihlbGVtZW50KTtcbiAgICAgICAgaWYgKGlkeCAhPT0gLTEpXG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50cy5zcGxpY2UoaWR4LCAxKTtcbiAgICB9XG5cbiAgICBfaGFuZGxlVXAoZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKE1vdXNlLmlzUG9pbnRlckxvY2tlZCgpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2NhbGNNb3VzZUNvb3JkcyhldmVudCk7XG5cbiAgICAgICAgdGhpcy5fb25FbGVtZW50TW91c2VFdmVudCgnbW91c2V1cCcsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfaGFuZGxlRG93bihldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBpZiAoTW91c2UuaXNQb2ludGVyTG9ja2VkKCkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY2FsY01vdXNlQ29vcmRzKGV2ZW50KTtcblxuICAgICAgICB0aGlzLl9vbkVsZW1lbnRNb3VzZUV2ZW50KCdtb3VzZWRvd24nLCBldmVudCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZU1vdmUoZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY2FsY01vdXNlQ29vcmRzKGV2ZW50KTtcblxuICAgICAgICB0aGlzLl9vbkVsZW1lbnRNb3VzZUV2ZW50KCdtb3VzZW1vdmUnLCBldmVudCk7XG5cbiAgICAgICAgdGhpcy5fbGFzdFggPSB0YXJnZXRYO1xuICAgICAgICB0aGlzLl9sYXN0WSA9IHRhcmdldFk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVdoZWVsKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2NhbGNNb3VzZUNvb3JkcyhldmVudCk7XG5cbiAgICAgICAgdGhpcy5fb25FbGVtZW50TW91c2VFdmVudCgnbW91c2V3aGVlbCcsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfZGV0ZXJtaW5lVG91Y2hlZEVsZW1lbnRzKGV2ZW50KSB7XG4gICAgICAgIGNvbnN0IHRvdWNoZWRFbGVtZW50cyA9IHt9O1xuICAgICAgICBjb25zdCBjYW1lcmFzID0gdGhpcy5hcHAuc3lzdGVtcy5jYW1lcmEuY2FtZXJhcztcblxuICAgICAgICAvLyBjaGVjayBjYW1lcmFzIGZyb20gbGFzdCB0byBmcm9udFxuICAgICAgICAvLyBzbyB0aGF0IGVsZW1lbnRzIHRoYXQgYXJlIGRyYXduIGFib3ZlIG90aGVyc1xuICAgICAgICAvLyByZWNlaXZlIGV2ZW50cyBmaXJzdFxuICAgICAgICBmb3IgKGxldCBpID0gY2FtZXJhcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gY2FtZXJhc1tpXTtcblxuICAgICAgICAgICAgbGV0IGRvbmUgPSAwO1xuICAgICAgICAgICAgY29uc3QgbGVuID0gZXZlbnQuY2hhbmdlZFRvdWNoZXMubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZW47IGorKykge1xuICAgICAgICAgICAgICAgIGlmICh0b3VjaGVkRWxlbWVudHNbZXZlbnQuY2hhbmdlZFRvdWNoZXNbal0uaWRlbnRpZmllcl0pIHtcbiAgICAgICAgICAgICAgICAgICAgZG9uZSsrO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb29yZHMgPSB0aGlzLl9jYWxjVG91Y2hDb29yZHMoZXZlbnQuY2hhbmdlZFRvdWNoZXNbal0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2dldFRhcmdldEVsZW1lbnRCeUNvb3JkcyhjYW1lcmEsIGNvb3Jkcy54LCBjb29yZHMueSk7XG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgZG9uZSsrO1xuICAgICAgICAgICAgICAgICAgICB0b3VjaGVkRWxlbWVudHNbZXZlbnQuY2hhbmdlZFRvdWNoZXNbal0uaWRlbnRpZmllcl0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbGVtZW50OiBlbGVtZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgY2FtZXJhOiBjYW1lcmEsXG4gICAgICAgICAgICAgICAgICAgICAgICB4OiBjb29yZHMueCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHk6IGNvb3Jkcy55XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZG9uZSA9PT0gbGVuKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdG91Y2hlZEVsZW1lbnRzO1xuICAgIH1cblxuICAgIF9oYW5kbGVUb3VjaFN0YXJ0KGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG5ld1RvdWNoZWRFbGVtZW50cyA9IHRoaXMuX2RldGVybWluZVRvdWNoZWRFbGVtZW50cyhldmVudCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB0b3VjaCA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgbmV3VG91Y2hJbmZvID0gbmV3VG91Y2hlZEVsZW1lbnRzW3RvdWNoLmlkZW50aWZpZXJdO1xuICAgICAgICAgICAgY29uc3Qgb2xkVG91Y2hJbmZvID0gdGhpcy5fdG91Y2hlZEVsZW1lbnRzW3RvdWNoLmlkZW50aWZpZXJdO1xuXG4gICAgICAgICAgICBpZiAobmV3VG91Y2hJbmZvICYmICghb2xkVG91Y2hJbmZvIHx8IG5ld1RvdWNoSW5mby5lbGVtZW50ICE9PSBvbGRUb3VjaEluZm8uZWxlbWVudCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoZXZlbnQudHlwZSwgbmV3IEVsZW1lbnRUb3VjaEV2ZW50KGV2ZW50LCBuZXdUb3VjaEluZm8uZWxlbWVudCwgbmV3VG91Y2hJbmZvLmNhbWVyYSwgbmV3VG91Y2hJbmZvLngsIG5ld1RvdWNoSW5mby55LCB0b3VjaCkpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RvdWNoZXNGb3JXaGljaFRvdWNoTGVhdmVIYXNGaXJlZFt0b3VjaC5pZGVudGlmaWVyXSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCB0b3VjaElkIGluIG5ld1RvdWNoZWRFbGVtZW50cykge1xuICAgICAgICAgICAgdGhpcy5fdG91Y2hlZEVsZW1lbnRzW3RvdWNoSWRdID0gbmV3VG91Y2hlZEVsZW1lbnRzW3RvdWNoSWRdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZVRvdWNoRW5kKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYXMgPSB0aGlzLmFwcC5zeXN0ZW1zLmNhbWVyYS5jYW1lcmFzO1xuXG4gICAgICAgIC8vIGNsZWFyIGNsaWNrZWQgZW50aXRpZXMgZmlyc3QgdGhlbiBzdG9yZSBlYWNoIGNsaWNrZWQgZW50aXR5XG4gICAgICAgIC8vIGluIF9jbGlja2VkRW50aXRpZXMgc28gdGhhdCB3ZSBkb24ndCBmaXJlIGFub3RoZXIgY2xpY2tcbiAgICAgICAgLy8gb24gaXQgaW4gdGhpcyBoYW5kbGVyIG9yIGluIHRoZSBtb3VzZXVwIGhhbmRsZXIgd2hpY2ggaXNcbiAgICAgICAgLy8gZmlyZWQgbGF0ZXJcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fY2xpY2tlZEVudGl0aWVzKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fY2xpY2tlZEVudGl0aWVzW2tleV07XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZXZlbnQuY2hhbmdlZFRvdWNoZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRvdWNoID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbaV07XG4gICAgICAgICAgICBjb25zdCB0b3VjaEluZm8gPSB0aGlzLl90b3VjaGVkRWxlbWVudHNbdG91Y2guaWRlbnRpZmllcl07XG4gICAgICAgICAgICBpZiAoIXRvdWNoSW5mbylcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRvdWNoSW5mby5lbGVtZW50O1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gdG91Y2hJbmZvLmNhbWVyYTtcbiAgICAgICAgICAgIGNvbnN0IHggPSB0b3VjaEluZm8ueDtcbiAgICAgICAgICAgIGNvbnN0IHkgPSB0b3VjaEluZm8ueTtcblxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl90b3VjaGVzRm9yV2hpY2hUb3VjaExlYXZlSGFzRmlyZWRbdG91Y2guaWRlbnRpZmllcl07XG5cbiAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudChldmVudC50eXBlLCBuZXcgRWxlbWVudFRvdWNoRXZlbnQoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSwgeCwgeSwgdG91Y2gpKTtcblxuICAgICAgICAgICAgLy8gY2hlY2sgaWYgdG91Y2ggd2FzIHJlbGVhc2VkIG92ZXIgcHJldmlvdXNseSB0b3VjaFxuICAgICAgICAgICAgLy8gZWxlbWVudCBpbiBvcmRlciB0byBmaXJlIGNsaWNrIGV2ZW50XG4gICAgICAgICAgICBjb25zdCBjb29yZHMgPSB0aGlzLl9jYWxjVG91Y2hDb29yZHModG91Y2gpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBjID0gY2FtZXJhcy5sZW5ndGggLSAxOyBjID49IDA7IGMtLSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhvdmVyZWQgPSB0aGlzLl9nZXRUYXJnZXRFbGVtZW50QnlDb29yZHMoY2FtZXJhc1tjXSwgY29vcmRzLngsIGNvb3Jkcy55KTtcbiAgICAgICAgICAgICAgICBpZiAoaG92ZXJlZCA9PT0gZWxlbWVudCkge1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2xpY2tlZEVudGl0aWVzW2VsZW1lbnQuZW50aXR5LmdldEd1aWQoKV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgnY2xpY2snLCBuZXcgRWxlbWVudFRvdWNoRXZlbnQoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSwgeCwgeSwgdG91Y2gpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NsaWNrZWRFbnRpdGllc1tlbGVtZW50LmVudGl0eS5nZXRHdWlkKCldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhbmRsZVRvdWNoTW92ZShldmVudCkge1xuICAgICAgICAvLyBjYWxsIHByZXZlbnREZWZhdWx0IHRvIGF2b2lkIGlzc3VlcyBpbiBDaHJvbWUgQW5kcm9pZDpcbiAgICAgICAgLy8gaHR0cDovL3dpbHNvbnBhZ2UuY28udWsvdG91Y2gtZXZlbnRzLWluLWNocm9tZS1hbmRyb2lkL1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG5ld1RvdWNoZWRFbGVtZW50cyA9IHRoaXMuX2RldGVybWluZVRvdWNoZWRFbGVtZW50cyhldmVudCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB0b3VjaCA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgbmV3VG91Y2hJbmZvID0gbmV3VG91Y2hlZEVsZW1lbnRzW3RvdWNoLmlkZW50aWZpZXJdO1xuICAgICAgICAgICAgY29uc3Qgb2xkVG91Y2hJbmZvID0gdGhpcy5fdG91Y2hlZEVsZW1lbnRzW3RvdWNoLmlkZW50aWZpZXJdO1xuXG4gICAgICAgICAgICBpZiAob2xkVG91Y2hJbmZvKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29vcmRzID0gdGhpcy5fY2FsY1RvdWNoQ29vcmRzKHRvdWNoKTtcblxuICAgICAgICAgICAgICAgIC8vIEZpcmUgdG91Y2hsZWF2ZSBpZiB3ZSd2ZSBsZWZ0IHRoZSBwcmV2aW91c2x5IHRvdWNoZWQgZWxlbWVudFxuICAgICAgICAgICAgICAgIGlmICgoIW5ld1RvdWNoSW5mbyB8fCBuZXdUb3VjaEluZm8uZWxlbWVudCAhPT0gb2xkVG91Y2hJbmZvLmVsZW1lbnQpICYmICF0aGlzLl90b3VjaGVzRm9yV2hpY2hUb3VjaExlYXZlSGFzRmlyZWRbdG91Y2guaWRlbnRpZmllcl0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCd0b3VjaGxlYXZlJywgbmV3IEVsZW1lbnRUb3VjaEV2ZW50KGV2ZW50LCBvbGRUb3VjaEluZm8uZWxlbWVudCwgb2xkVG91Y2hJbmZvLmNhbWVyYSwgY29vcmRzLngsIGNvb3Jkcy55LCB0b3VjaCkpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIEZsYWcgdGhhdCB0b3VjaGxlYXZlIGhhcyBiZWVuIGZpcmVkIGZvciB0aGlzIHRvdWNoLCBzbyB0aGF0IHdlIGRvbid0XG4gICAgICAgICAgICAgICAgICAgIC8vIHJlLWZpcmUgaXQgb24gdGhlIG5leHQgdG91Y2htb3ZlLiBUaGlzIGlzIHJlcXVpcmVkIGJlY2F1c2UgdG91Y2htb3ZlXG4gICAgICAgICAgICAgICAgICAgIC8vIGV2ZW50cyBrZWVwIG9uIGZpcmluZyBmb3IgdGhlIHNhbWUgZWxlbWVudCB1bnRpbCB0aGUgdG91Y2ggZW5kcywgZXZlblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgdG91Y2ggcG9zaXRpb24gbW92ZXMgYXdheSBmcm9tIHRoZSBlbGVtZW50LiBUb3VjaGxlYXZlLCBvbiB0aGVcbiAgICAgICAgICAgICAgICAgICAgLy8gb3RoZXIgaGFuZCwgc2hvdWxkIGZpcmUgb25jZSB3aGVuIHRoZSB0b3VjaCBwb3NpdGlvbiBtb3ZlcyBhd2F5IGZyb21cbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGVsZW1lbnQgYW5kIHRoZW4gbm90IHJlLWZpcmUgYWdhaW4gd2l0aGluIHRoZSBzYW1lIHRvdWNoIHNlc3Npb24uXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3RvdWNoZXNGb3JXaGljaFRvdWNoTGVhdmVIYXNGaXJlZFt0b3VjaC5pZGVudGlmaWVyXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCd0b3VjaG1vdmUnLCBuZXcgRWxlbWVudFRvdWNoRXZlbnQoZXZlbnQsIG9sZFRvdWNoSW5mby5lbGVtZW50LCBvbGRUb3VjaEluZm8uY2FtZXJhLCBjb29yZHMueCwgY29vcmRzLnksIHRvdWNoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25FbGVtZW50TW91c2VFdmVudChldmVudFR5cGUsIGV2ZW50KSB7XG4gICAgICAgIGxldCBlbGVtZW50ID0gbnVsbDtcblxuICAgICAgICBjb25zdCBsYXN0SG92ZXJlZCA9IHRoaXMuX2hvdmVyZWRFbGVtZW50O1xuICAgICAgICB0aGlzLl9ob3ZlcmVkRWxlbWVudCA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgY2FtZXJhcyA9IHRoaXMuYXBwLnN5c3RlbXMuY2FtZXJhLmNhbWVyYXM7XG4gICAgICAgIGxldCBjYW1lcmE7XG5cbiAgICAgICAgLy8gY2hlY2sgY2FtZXJhcyBmcm9tIGxhc3QgdG8gZnJvbnRcbiAgICAgICAgLy8gc28gdGhhdCBlbGVtZW50cyB0aGF0IGFyZSBkcmF3biBhYm92ZSBvdGhlcnNcbiAgICAgICAgLy8gcmVjZWl2ZSBldmVudHMgZmlyc3RcbiAgICAgICAgZm9yIChsZXQgaSA9IGNhbWVyYXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGNhbWVyYSA9IGNhbWVyYXNbaV07XG5cbiAgICAgICAgICAgIGVsZW1lbnQgPSB0aGlzLl9nZXRUYXJnZXRFbGVtZW50QnlDb29yZHMoY2FtZXJhLCB0YXJnZXRYLCB0YXJnZXRZKTtcbiAgICAgICAgICAgIGlmIChlbGVtZW50KVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3VycmVudGx5IGhvdmVyZWQgZWxlbWVudCBpcyB3aGF0ZXZlcidzIGJlaW5nIHBvaW50ZWQgYnkgbW91c2UgKHdoaWNoIG1heSBiZSBudWxsKVxuICAgICAgICB0aGlzLl9ob3ZlcmVkRWxlbWVudCA9IGVsZW1lbnQ7XG5cbiAgICAgICAgLy8gaWYgdGhlcmUgd2FzIGEgcHJlc3NlZCBlbGVtZW50LCBpdCB0YWtlcyBmdWxsIHByaW9yaXR5IG9mICdtb3ZlJyBhbmQgJ3VwJyBldmVudHNcbiAgICAgICAgaWYgKChldmVudFR5cGUgPT09ICdtb3VzZW1vdmUnIHx8IGV2ZW50VHlwZSA9PT0gJ21vdXNldXAnKSAmJiB0aGlzLl9wcmVzc2VkRWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KGV2ZW50VHlwZSwgbmV3IEVsZW1lbnRNb3VzZUV2ZW50KGV2ZW50LCB0aGlzLl9wcmVzc2VkRWxlbWVudCwgY2FtZXJhLCB0YXJnZXRYLCB0YXJnZXRZLCB0aGlzLl9sYXN0WCwgdGhpcy5fbGFzdFkpKTtcbiAgICAgICAgfSBlbHNlIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICAvLyBvdGhlcndpc2UsIGZpcmUgaXQgdG8gdGhlIGN1cnJlbnRseSBob3ZlcmVkIGV2ZW50XG4gICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoZXZlbnRUeXBlLCBuZXcgRWxlbWVudE1vdXNlRXZlbnQoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSwgdGhpcy5fbGFzdFgsIHRoaXMuX2xhc3RZKSk7XG5cbiAgICAgICAgICAgIGlmIChldmVudFR5cGUgPT09ICdtb3VzZWRvd24nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJlc3NlZEVsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxhc3RIb3ZlcmVkICE9PSB0aGlzLl9ob3ZlcmVkRWxlbWVudCkge1xuICAgICAgICAgICAgLy8gbW91c2VsZWF2ZSBldmVudFxuICAgICAgICAgICAgaWYgKGxhc3RIb3ZlcmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCdtb3VzZWxlYXZlJywgbmV3IEVsZW1lbnRNb3VzZUV2ZW50KGV2ZW50LCBsYXN0SG92ZXJlZCwgY2FtZXJhLCB0YXJnZXRYLCB0YXJnZXRZLCB0aGlzLl9sYXN0WCwgdGhpcy5fbGFzdFkpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbW91c2VlbnRlciBldmVudFxuICAgICAgICAgICAgaWYgKHRoaXMuX2hvdmVyZWRFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCdtb3VzZWVudGVyJywgbmV3IEVsZW1lbnRNb3VzZUV2ZW50KGV2ZW50LCB0aGlzLl9ob3ZlcmVkRWxlbWVudCwgY2FtZXJhLCB0YXJnZXRYLCB0YXJnZXRZLCB0aGlzLl9sYXN0WCwgdGhpcy5fbGFzdFkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudFR5cGUgPT09ICdtb3VzZXVwJyAmJiB0aGlzLl9wcmVzc2VkRWxlbWVudCkge1xuICAgICAgICAgICAgLy8gY2xpY2sgZXZlbnRcbiAgICAgICAgICAgIGlmICh0aGlzLl9wcmVzc2VkRWxlbWVudCA9PT0gdGhpcy5faG92ZXJlZEVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcmVzc2VkRWxlbWVudCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICAvLyBmaXJlIGNsaWNrIGV2ZW50IGlmIGl0IGhhc24ndCBiZWVuIGZpcmVkIGFscmVhZHkgYnkgdGhlIHRvdWNodXAgaGFuZGxlclxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2xpY2tlZEVudGl0aWVzIHx8ICF0aGlzLl9jbGlja2VkRW50aXRpZXNbdGhpcy5faG92ZXJlZEVsZW1lbnQuZW50aXR5LmdldEd1aWQoKV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCdjbGljaycsIG5ldyBFbGVtZW50TW91c2VFdmVudChldmVudCwgdGhpcy5faG92ZXJlZEVsZW1lbnQsIGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSwgdGhpcy5fbGFzdFgsIHRoaXMuX2xhc3RZKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcmVzc2VkRWxlbWVudCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25YclN0YXJ0KCkge1xuICAgICAgICB0aGlzLmFwcC54ci5vbignZW5kJywgdGhpcy5fb25YckVuZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnhyLm9uKCd1cGRhdGUnLCB0aGlzLl9vblhyVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub24oJ3NlbGVjdHN0YXJ0JywgdGhpcy5fb25TZWxlY3RTdGFydCwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9uKCdzZWxlY3RlbmQnLCB0aGlzLl9vblNlbGVjdEVuZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblhySW5wdXRSZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vblhyRW5kKCkge1xuICAgICAgICB0aGlzLmFwcC54ci5vZmYoJ3VwZGF0ZScsIHRoaXMuX29uWHJVcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vZmYoJ3NlbGVjdHN0YXJ0JywgdGhpcy5fb25TZWxlY3RTdGFydCwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZignc2VsZWN0ZW5kJywgdGhpcy5fb25TZWxlY3RFbmQsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uWHJJbnB1dFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uWHJVcGRhdGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGlucHV0U291cmNlcyA9IHRoaXMuYXBwLnhyLmlucHV0LmlucHV0U291cmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnB1dFNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX29uRWxlbWVudFNlbGVjdEV2ZW50KCdzZWxlY3Rtb3ZlJywgaW5wdXRTb3VyY2VzW2ldLCBudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblhySW5wdXRSZW1vdmUoaW5wdXRTb3VyY2UpIHtcbiAgICAgICAgY29uc3QgaG92ZXJlZCA9IHRoaXMuX3NlbGVjdGVkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICBpZiAoaG92ZXJlZCkge1xuICAgICAgICAgICAgaW5wdXRTb3VyY2UuX2VsZW1lbnRFbnRpdHkgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCdzZWxlY3RsZWF2ZScsIG5ldyBFbGVtZW50U2VsZWN0RXZlbnQobnVsbCwgaG92ZXJlZCwgbnVsbCwgaW5wdXRTb3VyY2UpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zZWxlY3RlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXTtcbiAgICAgICAgZGVsZXRlIHRoaXMuX3NlbGVjdGVkUHJlc3NlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXTtcbiAgICB9XG5cbiAgICBfb25TZWxlY3RTdGFydChpbnB1dFNvdXJjZSwgZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG4gICAgICAgIHRoaXMuX29uRWxlbWVudFNlbGVjdEV2ZW50KCdzZWxlY3RzdGFydCcsIGlucHV0U291cmNlLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uU2VsZWN0RW5kKGlucHV0U291cmNlLCBldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcbiAgICAgICAgdGhpcy5fb25FbGVtZW50U2VsZWN0RXZlbnQoJ3NlbGVjdGVuZCcsIGlucHV0U291cmNlLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50VHlwZSwgaW5wdXRTb3VyY2UsIGV2ZW50KSB7XG4gICAgICAgIGxldCBlbGVtZW50O1xuXG4gICAgICAgIGNvbnN0IGhvdmVyZWRCZWZvcmUgPSB0aGlzLl9zZWxlY3RlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXTtcbiAgICAgICAgbGV0IGhvdmVyZWROb3c7XG5cbiAgICAgICAgY29uc3QgY2FtZXJhcyA9IHRoaXMuYXBwLnN5c3RlbXMuY2FtZXJhLmNhbWVyYXM7XG4gICAgICAgIGxldCBjYW1lcmE7XG5cbiAgICAgICAgaWYgKGlucHV0U291cmNlLmVsZW1lbnRJbnB1dCkge1xuICAgICAgICAgICAgcmF5Qy5zZXQoaW5wdXRTb3VyY2UuZ2V0T3JpZ2luKCksIGlucHV0U291cmNlLmdldERpcmVjdGlvbigpKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IGNhbWVyYXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICBjYW1lcmEgPSBjYW1lcmFzW2ldO1xuXG4gICAgICAgICAgICAgICAgZWxlbWVudCA9IHRoaXMuX2dldFRhcmdldEVsZW1lbnRCeVJheShyYXlDLCBjYW1lcmEpO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlucHV0U291cmNlLl9lbGVtZW50RW50aXR5ID0gZWxlbWVudCB8fCBudWxsO1xuXG4gICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZWxlY3RlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXSA9IGVsZW1lbnQ7XG4gICAgICAgICAgICBob3ZlcmVkTm93ID0gZWxlbWVudDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9zZWxlY3RlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChob3ZlcmVkQmVmb3JlICE9PSBob3ZlcmVkTm93KSB7XG4gICAgICAgICAgICBpZiAoaG92ZXJlZEJlZm9yZSkgdGhpcy5fZmlyZUV2ZW50KCdzZWxlY3RsZWF2ZScsIG5ldyBFbGVtZW50U2VsZWN0RXZlbnQoZXZlbnQsIGhvdmVyZWRCZWZvcmUsIGNhbWVyYSwgaW5wdXRTb3VyY2UpKTtcbiAgICAgICAgICAgIGlmIChob3ZlcmVkTm93KSB0aGlzLl9maXJlRXZlbnQoJ3NlbGVjdGVudGVyJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgaG92ZXJlZE5vdywgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50VHlwZSA9PT0gJ3NlbGVjdHN0YXJ0Jykge1xuICAgICAgICAgICAgdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdID0gaG92ZXJlZE5vdztcbiAgICAgICAgICAgIGlmIChob3ZlcmVkTm93KSB0aGlzLl9maXJlRXZlbnQoJ3NlbGVjdHN0YXJ0JywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgaG92ZXJlZE5vdywgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJlc3NlZCA9IHRoaXMuX3NlbGVjdGVkUHJlc3NlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXTtcbiAgICAgICAgaWYgKCFpbnB1dFNvdXJjZS5lbGVtZW50SW5wdXQgJiYgcHJlc3NlZCkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3NlbGVjdGVkUHJlc3NlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXTtcbiAgICAgICAgICAgIGlmIChob3ZlcmVkQmVmb3JlKSB0aGlzLl9maXJlRXZlbnQoJ3NlbGVjdGVuZCcsIG5ldyBFbGVtZW50U2VsZWN0RXZlbnQoZXZlbnQsIGhvdmVyZWRCZWZvcmUsIGNhbWVyYSwgaW5wdXRTb3VyY2UpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudFR5cGUgPT09ICdzZWxlY3RlbmQnICYmIGlucHV0U291cmNlLmVsZW1lbnRJbnB1dCkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3NlbGVjdGVkUHJlc3NlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXTtcblxuICAgICAgICAgICAgaWYgKGhvdmVyZWRCZWZvcmUpIHRoaXMuX2ZpcmVFdmVudCgnc2VsZWN0ZW5kJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgaG92ZXJlZEJlZm9yZSwgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuXG4gICAgICAgICAgICBpZiAocHJlc3NlZCAmJiBwcmVzc2VkID09PSBob3ZlcmVkQmVmb3JlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCdjbGljaycsIG5ldyBFbGVtZW50U2VsZWN0RXZlbnQoZXZlbnQsIHByZXNzZWQsIGNhbWVyYSwgaW5wdXRTb3VyY2UpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9maXJlRXZlbnQobmFtZSwgZXZ0KSB7XG4gICAgICAgIGxldCBlbGVtZW50ID0gZXZ0LmVsZW1lbnQ7XG4gICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICBlbGVtZW50LmZpcmUobmFtZSwgZXZ0KTtcbiAgICAgICAgICAgIGlmIChldnQuX3N0b3BQcm9wYWdhdGlvbilcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgaWYgKCFlbGVtZW50LmVudGl0eS5wYXJlbnQpXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGVsZW1lbnQgPSBlbGVtZW50LmVudGl0eS5wYXJlbnQuZWxlbWVudDtcbiAgICAgICAgICAgIGlmICghZWxlbWVudClcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jYWxjTW91c2VDb29yZHMoZXZlbnQpIHtcbiAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMuX3RhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgY29uc3QgbGVmdCA9IE1hdGguZmxvb3IocmVjdC5sZWZ0KTtcbiAgICAgICAgY29uc3QgdG9wID0gTWF0aC5mbG9vcihyZWN0LnRvcCk7XG4gICAgICAgIHRhcmdldFggPSAoZXZlbnQuY2xpZW50WCAtIGxlZnQpO1xuICAgICAgICB0YXJnZXRZID0gKGV2ZW50LmNsaWVudFkgLSB0b3ApO1xuICAgIH1cblxuICAgIF9jYWxjVG91Y2hDb29yZHModG91Y2gpIHtcbiAgICAgICAgbGV0IHRvdGFsT2Zmc2V0WCA9IDA7XG4gICAgICAgIGxldCB0b3RhbE9mZnNldFkgPSAwO1xuICAgICAgICBsZXQgdGFyZ2V0ID0gdG91Y2gudGFyZ2V0O1xuICAgICAgICB3aGlsZSAoISh0YXJnZXQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcbiAgICAgICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlO1xuICAgICAgICB9XG4gICAgICAgIGxldCBjdXJyZW50RWxlbWVudCA9IHRhcmdldDtcblxuICAgICAgICBkbyB7XG4gICAgICAgICAgICB0b3RhbE9mZnNldFggKz0gY3VycmVudEVsZW1lbnQub2Zmc2V0TGVmdCAtIGN1cnJlbnRFbGVtZW50LnNjcm9sbExlZnQ7XG4gICAgICAgICAgICB0b3RhbE9mZnNldFkgKz0gY3VycmVudEVsZW1lbnQub2Zmc2V0VG9wIC0gY3VycmVudEVsZW1lbnQuc2Nyb2xsVG9wO1xuICAgICAgICAgICAgY3VycmVudEVsZW1lbnQgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRQYXJlbnQ7XG4gICAgICAgIH0gd2hpbGUgKGN1cnJlbnRFbGVtZW50KTtcblxuICAgICAgICAvLyBjYWxjdWxhdGUgY29vcmRzIGFuZCBzY2FsZSB0aGVtIHRvIHRoZSBncmFwaGljc0RldmljZSBzaXplXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiAodG91Y2gucGFnZVggLSB0b3RhbE9mZnNldFgpLFxuICAgICAgICAgICAgeTogKHRvdWNoLnBhZ2VZIC0gdG90YWxPZmZzZXRZKVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIF9zb3J0RWxlbWVudHMoYSwgYikge1xuICAgICAgICBjb25zdCBsYXllck9yZGVyID0gdGhpcy5hcHAuc2NlbmUubGF5ZXJzLnNvcnRUcmFuc3BhcmVudExheWVycyhhLmxheWVycywgYi5sYXllcnMpO1xuICAgICAgICBpZiAobGF5ZXJPcmRlciAhPT0gMCkgcmV0dXJuIGxheWVyT3JkZXI7XG5cbiAgICAgICAgaWYgKGEuc2NyZWVuICYmICFiLnNjcmVlbilcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgaWYgKCFhLnNjcmVlbiAmJiBiLnNjcmVlbilcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICBpZiAoIWEuc2NyZWVuICYmICFiLnNjcmVlbilcbiAgICAgICAgICAgIHJldHVybiAwO1xuXG4gICAgICAgIGlmIChhLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UgJiYgIWIuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSlcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgaWYgKGIuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSAmJiAhYS5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlKVxuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIHJldHVybiBiLmRyYXdPcmRlciAtIGEuZHJhd09yZGVyO1xuICAgIH1cblxuICAgIF9nZXRUYXJnZXRFbGVtZW50QnlDb29yZHMoY2FtZXJhLCB4LCB5KSB7XG4gICAgICAgIC8vIGNhbGN1bGF0ZSBzY3JlZW4tc3BhY2UgYW5kIDNkLXNwYWNlIHJheXNcbiAgICAgICAgY29uc3QgcmF5U2NyZWVuID0gdGhpcy5fY2FsY3VsYXRlUmF5U2NyZWVuKHgsIHksIGNhbWVyYSwgcmF5QSkgPyByYXlBIDogbnVsbDtcbiAgICAgICAgY29uc3QgcmF5M2QgPSB0aGlzLl9jYWxjdWxhdGVSYXkzZCh4LCB5LCBjYW1lcmEsIHJheUIpID8gcmF5QiA6IG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFRhcmdldEVsZW1lbnQoY2FtZXJhLCByYXlTY3JlZW4sIHJheTNkKTtcbiAgICB9XG5cbiAgICBfZ2V0VGFyZ2V0RWxlbWVudEJ5UmF5KHJheSwgY2FtZXJhKSB7XG4gICAgICAgIC8vIDNkIHJheSBpcyBjb3BpZWQgZnJvbSBpbnB1dCByYXlcbiAgICAgICAgcmF5QS5vcmlnaW4uY29weShyYXkub3JpZ2luKTtcbiAgICAgICAgcmF5QS5kaXJlY3Rpb24uY29weShyYXkuZGlyZWN0aW9uKTtcbiAgICAgICAgcmF5QS5lbmQuY29weShyYXlBLmRpcmVjdGlvbikubXVsU2NhbGFyKGNhbWVyYS5mYXJDbGlwICogMikuYWRkKHJheUEub3JpZ2luKTtcbiAgICAgICAgY29uc3QgcmF5M2QgPSByYXlBO1xuXG4gICAgICAgIC8vIHNjcmVlbi1zcGFjZSByYXkgaXMgYnVpbHQgZnJvbSBpbnB1dCByYXkncyBvcmlnaW4sIGNvbnZlcnRlZCB0byBzY3JlZW4tc3BhY2VcbiAgICAgICAgY29uc3Qgc2NyZWVuUG9zID0gY2FtZXJhLndvcmxkVG9TY3JlZW4ocmF5M2Qub3JpZ2luLCB2ZWNBKTtcbiAgICAgICAgY29uc3QgcmF5U2NyZWVuID0gdGhpcy5fY2FsY3VsYXRlUmF5U2NyZWVuKHNjcmVlblBvcy54LCBzY3JlZW5Qb3MueSwgY2FtZXJhLCByYXlCKSA/IHJheUIgOiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRUYXJnZXRFbGVtZW50KGNhbWVyYSwgcmF5U2NyZWVuLCByYXkzZCk7XG4gICAgfVxuXG4gICAgX2dldFRhcmdldEVsZW1lbnQoY2FtZXJhLCByYXlTY3JlZW4sIHJheTNkKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSBudWxsO1xuICAgICAgICBsZXQgY2xvc2VzdERpc3RhbmNlM2QgPSBJbmZpbml0eTtcblxuICAgICAgICAvLyBzb3J0IGVsZW1lbnRzIGJhc2VkIG9uIGxheWVycyBhbmQgZHJhdyBvcmRlclxuICAgICAgICB0aGlzLl9lbGVtZW50cy5zb3J0KHRoaXMuX3NvcnRIYW5kbGVyKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fZWxlbWVudHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9lbGVtZW50c1tpXTtcblxuICAgICAgICAgICAgLy8gY2hlY2sgaWYgYW55IG9mIHRoZSBsYXllcnMgdGhpcyBlbGVtZW50IHJlbmRlcnMgdG8gaXMgYmVpbmcgcmVuZGVyZWQgYnkgdGhlIGNhbWVyYVxuICAgICAgICAgICAgaWYgKCFlbGVtZW50LmxheWVycy5zb21lKHYgPT4gY2FtZXJhLmxheWVyc1NldC5oYXModikpKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChlbGVtZW50LnNjcmVlbiAmJiBlbGVtZW50LnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXJheVNjcmVlbikge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyAyZCBzY3JlZW4gZWxlbWVudHMgdGFrZSBwcmVjZWRlbmNlIC0gaWYgaGl0LCBpbW1lZGlhdGVseSByZXR1cm5cbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50RGlzdGFuY2UgPSB0aGlzLl9jaGVja0VsZW1lbnQocmF5U2NyZWVuLCBlbGVtZW50LCB0cnVlKTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudERpc3RhbmNlID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZWxlbWVudDtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoIXJheTNkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnREaXN0YW5jZSA9IHRoaXMuX2NoZWNrRWxlbWVudChyYXkzZCwgZWxlbWVudCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50RGlzdGFuY2UgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBzdG9yZSB0aGUgY2xvc2VzdCBvbmUgaW4gd29ybGQgc3BhY2VcbiAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnREaXN0YW5jZSA8IGNsb3Nlc3REaXN0YW5jZTNkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBlbGVtZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xvc2VzdERpc3RhbmNlM2QgPSBjdXJyZW50RGlzdGFuY2U7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgZWxlbWVudCBpcyBvbiBhIFNjcmVlbiwgaXQgdGFrZXMgcHJlY2VkZW5jZVxuICAgICAgICAgICAgICAgICAgICBpZiAoZWxlbWVudC5zY3JlZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8gSW4gbW9zdCBjYXNlcyB0aGUgY29ybmVycyB1c2VkIGZvciBoaXQgdGVzdGluZyB3aWxsIGp1c3QgYmUgdGhlIGVsZW1lbnQnc1xuICAgIC8vIHNjcmVlbiBjb3JuZXJzLiBIb3dldmVyLCBpbiBjYXNlcyB3aGVyZSB0aGUgZWxlbWVudCBoYXMgYWRkaXRpb25hbCBoaXRcbiAgICAvLyBwYWRkaW5nIHNwZWNpZmllZCwgd2UgbmVlZCB0byBleHBhbmQgdGhlIHNjcmVlbkNvcm5lcnMgdG8gaW5jb3Jwb3JhdGUgdGhlXG4gICAgLy8gcGFkZGluZy5cbiAgICBfYnVpbGRIaXRDb3JuZXJzKGVsZW1lbnQsIHNjcmVlbk9yV29ybGRDb3JuZXJzLCBzY2FsZVgsIHNjYWxlWSwgc2NhbGVaKSB7XG4gICAgICAgIGxldCBoaXRDb3JuZXJzID0gc2NyZWVuT3JXb3JsZENvcm5lcnM7XG4gICAgICAgIGNvbnN0IGJ1dHRvbiA9IGVsZW1lbnQuZW50aXR5ICYmIGVsZW1lbnQuZW50aXR5LmJ1dHRvbjtcblxuICAgICAgICBpZiAoYnV0dG9uKSB7XG4gICAgICAgICAgICBjb25zdCBoaXRQYWRkaW5nID0gZWxlbWVudC5lbnRpdHkuYnV0dG9uLmhpdFBhZGRpbmcgfHwgWkVST19WRUM0O1xuXG4gICAgICAgICAgICBfcGFkZGluZ1RvcC5jb3B5KGVsZW1lbnQuZW50aXR5LnVwKTtcbiAgICAgICAgICAgIF9wYWRkaW5nQm90dG9tLmNvcHkoX3BhZGRpbmdUb3ApLm11bFNjYWxhcigtMSk7XG4gICAgICAgICAgICBfcGFkZGluZ1JpZ2h0LmNvcHkoZWxlbWVudC5lbnRpdHkucmlnaHQpO1xuICAgICAgICAgICAgX3BhZGRpbmdMZWZ0LmNvcHkoX3BhZGRpbmdSaWdodCkubXVsU2NhbGFyKC0xKTtcblxuICAgICAgICAgICAgX3BhZGRpbmdUb3AubXVsU2NhbGFyKGhpdFBhZGRpbmcudyAqIHNjYWxlWSk7XG4gICAgICAgICAgICBfcGFkZGluZ0JvdHRvbS5tdWxTY2FsYXIoaGl0UGFkZGluZy55ICogc2NhbGVZKTtcbiAgICAgICAgICAgIF9wYWRkaW5nUmlnaHQubXVsU2NhbGFyKGhpdFBhZGRpbmcueiAqIHNjYWxlWCk7XG4gICAgICAgICAgICBfcGFkZGluZ0xlZnQubXVsU2NhbGFyKGhpdFBhZGRpbmcueCAqIHNjYWxlWCk7XG5cbiAgICAgICAgICAgIF9jb3JuZXJCb3R0b21MZWZ0LmNvcHkoaGl0Q29ybmVyc1swXSkuYWRkKF9wYWRkaW5nQm90dG9tKS5hZGQoX3BhZGRpbmdMZWZ0KTtcbiAgICAgICAgICAgIF9jb3JuZXJCb3R0b21SaWdodC5jb3B5KGhpdENvcm5lcnNbMV0pLmFkZChfcGFkZGluZ0JvdHRvbSkuYWRkKF9wYWRkaW5nUmlnaHQpO1xuICAgICAgICAgICAgX2Nvcm5lclRvcFJpZ2h0LmNvcHkoaGl0Q29ybmVyc1syXSkuYWRkKF9wYWRkaW5nVG9wKS5hZGQoX3BhZGRpbmdSaWdodCk7XG4gICAgICAgICAgICBfY29ybmVyVG9wTGVmdC5jb3B5KGhpdENvcm5lcnNbM10pLmFkZChfcGFkZGluZ1RvcCkuYWRkKF9wYWRkaW5nTGVmdCk7XG5cbiAgICAgICAgICAgIGhpdENvcm5lcnMgPSBbX2Nvcm5lckJvdHRvbUxlZnQsIF9jb3JuZXJCb3R0b21SaWdodCwgX2Nvcm5lclRvcFJpZ2h0LCBfY29ybmVyVG9wTGVmdF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYWtlIHN1cmUgdGhlIGNvcm5lcnMgYXJlIGluIHRoZSByaWdodCBvcmRlciBbYmwsIGJyLCB0ciwgdGxdXG4gICAgICAgIC8vIGZvciB4IGFuZCB5OiBzaW1wbHkgaW52ZXJ0IHdoYXQgaXMgY29uc2lkZXJlZCBcImxlZnQvcmlnaHRcIiBhbmQgXCJ0b3AvYm90dG9tXCJcbiAgICAgICAgaWYgKHNjYWxlWCA8IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGxlZnQgPSBoaXRDb3JuZXJzWzJdLng7XG4gICAgICAgICAgICBjb25zdCByaWdodCA9IGhpdENvcm5lcnNbMF0ueDtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMF0ueCA9IGxlZnQ7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzFdLnggPSByaWdodDtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMl0ueCA9IHJpZ2h0O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1szXS54ID0gbGVmdDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc2NhbGVZIDwgMCkge1xuICAgICAgICAgICAgY29uc3QgYm90dG9tID0gaGl0Q29ybmVyc1syXS55O1xuICAgICAgICAgICAgY29uc3QgdG9wID0gaGl0Q29ybmVyc1swXS55O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1swXS55ID0gYm90dG9tO1xuICAgICAgICAgICAgaGl0Q29ybmVyc1sxXS55ID0gYm90dG9tO1xuICAgICAgICAgICAgaGl0Q29ybmVyc1syXS55ID0gdG9wO1xuICAgICAgICAgICAgaGl0Q29ybmVyc1szXS55ID0gdG9wO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIHogaXMgaW52ZXJ0ZWQsIGVudGlyZSBlbGVtZW50IGlzIGludmVydGVkLCBzbyBmbGlwIGl0IGFyb3VuZCBieSBzd2FwcGluZyBjb3JuZXIgcG9pbnRzIDIgYW5kIDBcbiAgICAgICAgaWYgKHNjYWxlWiA8IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHggPSBoaXRDb3JuZXJzWzJdLng7XG4gICAgICAgICAgICBjb25zdCB5ID0gaGl0Q29ybmVyc1syXS55O1xuICAgICAgICAgICAgY29uc3QgeiA9IGhpdENvcm5lcnNbMl0uejtcblxuICAgICAgICAgICAgaGl0Q29ybmVyc1syXS54ID0gaGl0Q29ybmVyc1swXS54O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1syXS55ID0gaGl0Q29ybmVyc1swXS55O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1syXS56ID0gaGl0Q29ybmVyc1swXS56O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1swXS54ID0geDtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMF0ueSA9IHk7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzBdLnogPSB6O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGhpdENvcm5lcnM7XG4gICAgfVxuXG4gICAgX2NhbGN1bGF0ZVNjYWxlVG9TY3JlZW4oZWxlbWVudCkge1xuICAgICAgICBsZXQgY3VycmVudCA9IGVsZW1lbnQuZW50aXR5O1xuICAgICAgICBjb25zdCBzY3JlZW5TY2FsZSA9IGVsZW1lbnQuc2NyZWVuLnNjcmVlbi5zY2FsZTtcblxuICAgICAgICBfYWNjdW11bGF0ZWRTY2FsZS5zZXQoc2NyZWVuU2NhbGUsIHNjcmVlblNjYWxlLCBzY3JlZW5TY2FsZSk7XG5cbiAgICAgICAgd2hpbGUgKGN1cnJlbnQgJiYgIWN1cnJlbnQuc2NyZWVuKSB7XG4gICAgICAgICAgICBfYWNjdW11bGF0ZWRTY2FsZS5tdWwoY3VycmVudC5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9hY2N1bXVsYXRlZFNjYWxlO1xuICAgIH1cblxuICAgIF9jYWxjdWxhdGVTY2FsZVRvV29ybGQoZWxlbWVudCkge1xuICAgICAgICBsZXQgY3VycmVudCA9IGVsZW1lbnQuZW50aXR5O1xuICAgICAgICBfYWNjdW11bGF0ZWRTY2FsZS5zZXQoMSwgMSwgMSk7XG5cbiAgICAgICAgd2hpbGUgKGN1cnJlbnQpIHtcbiAgICAgICAgICAgIF9hY2N1bXVsYXRlZFNjYWxlLm11bChjdXJyZW50LmdldExvY2FsU2NhbGUoKSk7XG4gICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2FjY3VtdWxhdGVkU2NhbGU7XG4gICAgfVxuXG4gICAgX2NhbGN1bGF0ZVJheVNjcmVlbih4LCB5LCBjYW1lcmEsIHJheSkge1xuICAgICAgICBjb25zdCBzdyA9IHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLndpZHRoO1xuICAgICAgICBjb25zdCBzaCA9IHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLmhlaWdodDtcblxuICAgICAgICBjb25zdCBjYW1lcmFXaWR0aCA9IGNhbWVyYS5yZWN0LnogKiBzdztcbiAgICAgICAgY29uc3QgY2FtZXJhSGVpZ2h0ID0gY2FtZXJhLnJlY3QudyAqIHNoO1xuICAgICAgICBjb25zdCBjYW1lcmFMZWZ0ID0gY2FtZXJhLnJlY3QueCAqIHN3O1xuICAgICAgICBjb25zdCBjYW1lcmFSaWdodCA9IGNhbWVyYUxlZnQgKyBjYW1lcmFXaWR0aDtcbiAgICAgICAgLy8gY2FtZXJhIGJvdHRvbSAob3JpZ2luIGlzIGJvdHRvbSBsZWZ0IG9mIHdpbmRvdylcbiAgICAgICAgY29uc3QgY2FtZXJhQm90dG9tID0gKDEgLSBjYW1lcmEucmVjdC55KSAqIHNoO1xuICAgICAgICBjb25zdCBjYW1lcmFUb3AgPSBjYW1lcmFCb3R0b20gLSBjYW1lcmFIZWlnaHQ7XG5cbiAgICAgICAgbGV0IF94ID0geCAqIHN3IC8gdGhpcy5fdGFyZ2V0LmNsaWVudFdpZHRoO1xuICAgICAgICBsZXQgX3kgPSB5ICogc2ggLyB0aGlzLl90YXJnZXQuY2xpZW50SGVpZ2h0O1xuXG4gICAgICAgIGlmIChfeCA+PSBjYW1lcmFMZWZ0ICYmIF94IDw9IGNhbWVyYVJpZ2h0ICYmXG4gICAgICAgICAgICBfeSA8PSBjYW1lcmFCb3R0b20gJiYgX3kgPj0gY2FtZXJhVG9wKSB7XG5cbiAgICAgICAgICAgIC8vIGxpbWl0IHdpbmRvdyBjb29yZHMgdG8gY2FtZXJhIHJlY3QgY29vcmRzXG4gICAgICAgICAgICBfeCA9IHN3ICogKF94IC0gY2FtZXJhTGVmdCkgLyBjYW1lcmFXaWR0aDtcbiAgICAgICAgICAgIF95ID0gc2ggKiAoX3kgLSBjYW1lcmFUb3ApIC8gY2FtZXJhSGVpZ2h0O1xuXG4gICAgICAgICAgICAvLyByZXZlcnNlIF95XG4gICAgICAgICAgICBfeSA9IHNoIC0gX3k7XG5cbiAgICAgICAgICAgIHJheS5vcmlnaW4uc2V0KF94LCBfeSwgMSk7XG4gICAgICAgICAgICByYXkuZGlyZWN0aW9uLnNldCgwLCAwLCAtMSk7XG4gICAgICAgICAgICByYXkuZW5kLmNvcHkocmF5LmRpcmVjdGlvbikubXVsU2NhbGFyKDIpLmFkZChyYXkub3JpZ2luKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIF9jYWxjdWxhdGVSYXkzZCh4LCB5LCBjYW1lcmEsIHJheSkge1xuICAgICAgICBjb25zdCBzdyA9IHRoaXMuX3RhcmdldC5jbGllbnRXaWR0aDtcbiAgICAgICAgY29uc3Qgc2ggPSB0aGlzLl90YXJnZXQuY2xpZW50SGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYVdpZHRoID0gY2FtZXJhLnJlY3QueiAqIHN3O1xuICAgICAgICBjb25zdCBjYW1lcmFIZWlnaHQgPSBjYW1lcmEucmVjdC53ICogc2g7XG4gICAgICAgIGNvbnN0IGNhbWVyYUxlZnQgPSBjYW1lcmEucmVjdC54ICogc3c7XG4gICAgICAgIGNvbnN0IGNhbWVyYVJpZ2h0ID0gY2FtZXJhTGVmdCArIGNhbWVyYVdpZHRoO1xuICAgICAgICAvLyBjYW1lcmEgYm90dG9tIC0gb3JpZ2luIGlzIGJvdHRvbSBsZWZ0IG9mIHdpbmRvd1xuICAgICAgICBjb25zdCBjYW1lcmFCb3R0b20gPSAoMSAtIGNhbWVyYS5yZWN0LnkpICogc2g7XG4gICAgICAgIGNvbnN0IGNhbWVyYVRvcCA9IGNhbWVyYUJvdHRvbSAtIGNhbWVyYUhlaWdodDtcblxuICAgICAgICBsZXQgX3ggPSB4O1xuICAgICAgICBsZXQgX3kgPSB5O1xuXG4gICAgICAgIC8vIGNoZWNrIHdpbmRvdyBjb29yZHMgYXJlIHdpdGhpbiBjYW1lcmEgcmVjdFxuICAgICAgICBpZiAoeCA+PSBjYW1lcmFMZWZ0ICYmIHggPD0gY2FtZXJhUmlnaHQgJiZcbiAgICAgICAgICAgIHkgPD0gY2FtZXJhQm90dG9tICYmIF95ID49IGNhbWVyYVRvcCkge1xuXG4gICAgICAgICAgICAvLyBsaW1pdCB3aW5kb3cgY29vcmRzIHRvIGNhbWVyYSByZWN0IGNvb3Jkc1xuICAgICAgICAgICAgX3ggPSBzdyAqIChfeCAtIGNhbWVyYUxlZnQpIC8gY2FtZXJhV2lkdGg7XG4gICAgICAgICAgICBfeSA9IHNoICogKF95IC0gKGNhbWVyYVRvcCkpIC8gY2FtZXJhSGVpZ2h0O1xuXG4gICAgICAgICAgICAvLyAzRCBzY3JlZW5cbiAgICAgICAgICAgIGNhbWVyYS5zY3JlZW5Ub1dvcmxkKF94LCBfeSwgY2FtZXJhLm5lYXJDbGlwLCB2ZWNBKTtcbiAgICAgICAgICAgIGNhbWVyYS5zY3JlZW5Ub1dvcmxkKF94LCBfeSwgY2FtZXJhLmZhckNsaXAsIHZlY0IpO1xuXG4gICAgICAgICAgICByYXkub3JpZ2luLmNvcHkodmVjQSk7XG4gICAgICAgICAgICByYXkuZGlyZWN0aW9uLnNldCgwLCAwLCAtMSk7XG4gICAgICAgICAgICByYXkuZW5kLmNvcHkodmVjQik7XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfY2hlY2tFbGVtZW50KHJheSwgZWxlbWVudCwgc2NyZWVuKSB7XG4gICAgICAgIC8vIGVuc3VyZSBjbGljayBpcyBjb250YWluZWQgYnkgYW55IG1hc2sgZmlyc3RcbiAgICAgICAgaWYgKGVsZW1lbnQubWFza2VkQnkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jaGVja0VsZW1lbnQocmF5LCBlbGVtZW50Lm1hc2tlZEJ5LmVsZW1lbnQsIHNjcmVlbikgPCAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHNjYWxlO1xuICAgICAgICBpZiAoc2NyZWVuKSB7XG4gICAgICAgICAgICBzY2FsZSA9IHRoaXMuX2NhbGN1bGF0ZVNjYWxlVG9TY3JlZW4oZWxlbWVudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzY2FsZSA9IHRoaXMuX2NhbGN1bGF0ZVNjYWxlVG9Xb3JsZChlbGVtZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvcm5lcnMgPSB0aGlzLl9idWlsZEhpdENvcm5lcnMoZWxlbWVudCwgc2NyZWVuID8gZWxlbWVudC5zY3JlZW5Db3JuZXJzIDogZWxlbWVudC53b3JsZENvcm5lcnMsIHNjYWxlLngsIHNjYWxlLnksIHNjYWxlLnopO1xuXG4gICAgICAgIHJldHVybiBpbnRlcnNlY3RMaW5lUXVhZChyYXkub3JpZ2luLCByYXkuZW5kLCBjb3JuZXJzKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEVsZW1lbnRJbnB1dCwgRWxlbWVudElucHV0RXZlbnQsIEVsZW1lbnRNb3VzZUV2ZW50LCBFbGVtZW50U2VsZWN0RXZlbnQsIEVsZW1lbnRUb3VjaEV2ZW50IH07XG4iXSwibmFtZXMiOlsidGFyZ2V0WCIsInRhcmdldFkiLCJ2ZWNBIiwiVmVjMyIsInZlY0IiLCJyYXlBIiwiUmF5IiwicmF5QiIsInJheUMiLCJlbmQiLCJfcHEiLCJfcGEiLCJfcGIiLCJfcGMiLCJfcGQiLCJfbSIsIl9hdSIsIl9idiIsIl9jdyIsIl9pciIsIl9zY3QiLCJfYWNjdW11bGF0ZWRTY2FsZSIsIl9wYWRkaW5nVG9wIiwiX3BhZGRpbmdCb3R0b20iLCJfcGFkZGluZ0xlZnQiLCJfcGFkZGluZ1JpZ2h0IiwiX2Nvcm5lckJvdHRvbUxlZnQiLCJfY29ybmVyQm90dG9tUmlnaHQiLCJfY29ybmVyVG9wUmlnaHQiLCJfY29ybmVyVG9wTGVmdCIsIlpFUk9fVkVDNCIsIlZlYzQiLCJzY2FsYXJUcmlwbGUiLCJwMSIsInAyIiwicDMiLCJjcm9zcyIsImRvdCIsImludGVyc2VjdExpbmVRdWFkIiwicCIsInEiLCJjb3JuZXJzIiwic3ViMiIsInYiLCJ1IiwidyIsImRlbm9tIiwiY29weSIsIm11bFNjYWxhciIsImFkZCIsImxlbmd0aFNxIiwic3ViIiwiRWxlbWVudElucHV0RXZlbnQiLCJjb25zdHJ1Y3RvciIsImV2ZW50IiwiZWxlbWVudCIsImNhbWVyYSIsIl9zdG9wUHJvcGFnYXRpb24iLCJzdG9wUHJvcGFnYXRpb24iLCJzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iLCJFbGVtZW50TW91c2VFdmVudCIsIngiLCJ5IiwibGFzdFgiLCJsYXN0WSIsImN0cmxLZXkiLCJhbHRLZXkiLCJzaGlmdEtleSIsIm1ldGFLZXkiLCJidXR0b24iLCJNb3VzZSIsImlzUG9pbnRlckxvY2tlZCIsImR4IiwibW92ZW1lbnRYIiwid2Via2l0TW92ZW1lbnRYIiwibW96TW92ZW1lbnRYIiwiZHkiLCJtb3ZlbWVudFkiLCJ3ZWJraXRNb3ZlbWVudFkiLCJtb3pNb3ZlbWVudFkiLCJ3aGVlbERlbHRhIiwidHlwZSIsImRlbHRhWSIsIkVsZW1lbnRUb3VjaEV2ZW50IiwidG91Y2giLCJ0b3VjaGVzIiwiY2hhbmdlZFRvdWNoZXMiLCJFbGVtZW50U2VsZWN0RXZlbnQiLCJpbnB1dFNvdXJjZSIsIkVsZW1lbnRJbnB1dCIsImRvbUVsZW1lbnQiLCJvcHRpb25zIiwiX2FwcCIsIl9hdHRhY2hlZCIsIl90YXJnZXQiLCJfZW5hYmxlZCIsIl9sYXN0WCIsIl9sYXN0WSIsIl91cEhhbmRsZXIiLCJfaGFuZGxlVXAiLCJiaW5kIiwiX2Rvd25IYW5kbGVyIiwiX2hhbmRsZURvd24iLCJfbW92ZUhhbmRsZXIiLCJfaGFuZGxlTW92ZSIsIl93aGVlbEhhbmRsZXIiLCJfaGFuZGxlV2hlZWwiLCJfdG91Y2hzdGFydEhhbmRsZXIiLCJfaGFuZGxlVG91Y2hTdGFydCIsIl90b3VjaGVuZEhhbmRsZXIiLCJfaGFuZGxlVG91Y2hFbmQiLCJfdG91Y2hjYW5jZWxIYW5kbGVyIiwiX3RvdWNobW92ZUhhbmRsZXIiLCJfaGFuZGxlVG91Y2hNb3ZlIiwiX3NvcnRIYW5kbGVyIiwiX3NvcnRFbGVtZW50cyIsIl9lbGVtZW50cyIsIl9ob3ZlcmVkRWxlbWVudCIsIl9wcmVzc2VkRWxlbWVudCIsIl90b3VjaGVkRWxlbWVudHMiLCJfdG91Y2hlc0ZvcldoaWNoVG91Y2hMZWF2ZUhhc0ZpcmVkIiwiX3NlbGVjdGVkRWxlbWVudHMiLCJfc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHMiLCJfdXNlTW91c2UiLCJ1c2VNb3VzZSIsIl91c2VUb3VjaCIsInVzZVRvdWNoIiwiX3VzZVhyIiwidXNlWHIiLCJfc2VsZWN0RXZlbnRzQXR0YWNoZWQiLCJwbGF0Zm9ybSIsIl9jbGlja2VkRW50aXRpZXMiLCJhdHRhY2giLCJlbmFibGVkIiwidmFsdWUiLCJhcHAiLCJnZXRBcHBsaWNhdGlvbiIsImRldGFjaCIsIm9wdHMiLCJwYXNzaXZlRXZlbnRzIiwicGFzc2l2ZSIsIndpbmRvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJhdHRhY2hTZWxlY3RFdmVudHMiLCJ4ciIsInN1cHBvcnRlZCIsIm9uIiwiX29uWHJTdGFydCIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJvZmYiLCJfb25YckVuZCIsIl9vblhyVXBkYXRlIiwiaW5wdXQiLCJfb25TZWxlY3RTdGFydCIsIl9vblNlbGVjdEVuZCIsIl9vblhySW5wdXRSZW1vdmUiLCJhZGRFbGVtZW50IiwiaW5kZXhPZiIsInB1c2giLCJyZW1vdmVFbGVtZW50IiwiaWR4Iiwic3BsaWNlIiwiX2NhbGNNb3VzZUNvb3JkcyIsIl9vbkVsZW1lbnRNb3VzZUV2ZW50IiwiX2RldGVybWluZVRvdWNoZWRFbGVtZW50cyIsInRvdWNoZWRFbGVtZW50cyIsImNhbWVyYXMiLCJzeXN0ZW1zIiwiaSIsImxlbmd0aCIsImRvbmUiLCJsZW4iLCJqIiwiaWRlbnRpZmllciIsImNvb3JkcyIsIl9jYWxjVG91Y2hDb29yZHMiLCJfZ2V0VGFyZ2V0RWxlbWVudEJ5Q29vcmRzIiwibmV3VG91Y2hlZEVsZW1lbnRzIiwibmV3VG91Y2hJbmZvIiwib2xkVG91Y2hJbmZvIiwiX2ZpcmVFdmVudCIsInRvdWNoSWQiLCJrZXkiLCJ0b3VjaEluZm8iLCJjIiwiaG92ZXJlZCIsImVudGl0eSIsImdldEd1aWQiLCJwcmV2ZW50RGVmYXVsdCIsImV2ZW50VHlwZSIsImxhc3RIb3ZlcmVkIiwiaW5wdXRTb3VyY2VzIiwiX29uRWxlbWVudFNlbGVjdEV2ZW50IiwiaWQiLCJfZWxlbWVudEVudGl0eSIsImhvdmVyZWRCZWZvcmUiLCJob3ZlcmVkTm93IiwiZWxlbWVudElucHV0Iiwic2V0IiwiZ2V0T3JpZ2luIiwiZ2V0RGlyZWN0aW9uIiwiX2dldFRhcmdldEVsZW1lbnRCeVJheSIsInByZXNzZWQiLCJuYW1lIiwiZXZ0IiwiZmlyZSIsInBhcmVudCIsInJlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJsZWZ0IiwiTWF0aCIsImZsb29yIiwidG9wIiwiY2xpZW50WCIsImNsaWVudFkiLCJ0b3RhbE9mZnNldFgiLCJ0b3RhbE9mZnNldFkiLCJ0YXJnZXQiLCJIVE1MRWxlbWVudCIsInBhcmVudE5vZGUiLCJjdXJyZW50RWxlbWVudCIsIm9mZnNldExlZnQiLCJzY3JvbGxMZWZ0Iiwib2Zmc2V0VG9wIiwic2Nyb2xsVG9wIiwib2Zmc2V0UGFyZW50IiwicGFnZVgiLCJwYWdlWSIsImEiLCJiIiwibGF5ZXJPcmRlciIsInNjZW5lIiwibGF5ZXJzIiwic29ydFRyYW5zcGFyZW50TGF5ZXJzIiwic2NyZWVuIiwic2NyZWVuU3BhY2UiLCJkcmF3T3JkZXIiLCJyYXlTY3JlZW4iLCJfY2FsY3VsYXRlUmF5U2NyZWVuIiwicmF5M2QiLCJfY2FsY3VsYXRlUmF5M2QiLCJfZ2V0VGFyZ2V0RWxlbWVudCIsInJheSIsIm9yaWdpbiIsImRpcmVjdGlvbiIsImZhckNsaXAiLCJzY3JlZW5Qb3MiLCJ3b3JsZFRvU2NyZWVuIiwicmVzdWx0IiwiY2xvc2VzdERpc3RhbmNlM2QiLCJJbmZpbml0eSIsInNvcnQiLCJzb21lIiwibGF5ZXJzU2V0IiwiaGFzIiwiY3VycmVudERpc3RhbmNlIiwiX2NoZWNrRWxlbWVudCIsIl9idWlsZEhpdENvcm5lcnMiLCJzY3JlZW5PcldvcmxkQ29ybmVycyIsInNjYWxlWCIsInNjYWxlWSIsInNjYWxlWiIsImhpdENvcm5lcnMiLCJoaXRQYWRkaW5nIiwidXAiLCJyaWdodCIsInoiLCJib3R0b20iLCJfY2FsY3VsYXRlU2NhbGVUb1NjcmVlbiIsImN1cnJlbnQiLCJzY3JlZW5TY2FsZSIsInNjYWxlIiwibXVsIiwiZ2V0TG9jYWxTY2FsZSIsIl9jYWxjdWxhdGVTY2FsZVRvV29ybGQiLCJzdyIsImdyYXBoaWNzRGV2aWNlIiwid2lkdGgiLCJzaCIsImhlaWdodCIsImNhbWVyYVdpZHRoIiwiY2FtZXJhSGVpZ2h0IiwiY2FtZXJhTGVmdCIsImNhbWVyYVJpZ2h0IiwiY2FtZXJhQm90dG9tIiwiY2FtZXJhVG9wIiwiX3giLCJjbGllbnRXaWR0aCIsIl95IiwiY2xpZW50SGVpZ2h0Iiwic2NyZWVuVG9Xb3JsZCIsIm5lYXJDbGlwIiwibWFza2VkQnkiLCJzY3JlZW5Db3JuZXJzIiwid29ybGRDb3JuZXJzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFlQSxJQUFJQSxPQUFPLEVBQUVDLE9BQU8sQ0FBQTtBQUNwQixNQUFNQyxJQUFJLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDdkIsTUFBTUMsSUFBSSxH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
