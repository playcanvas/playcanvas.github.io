/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../core/platform.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';
import { Ray } from '../shape/ray.js';
import { getApplication } from '../framework/globals.js';
import { Mouse } from './mouse.js';

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlbWVudC1pbnB1dC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2lucHV0L2VsZW1lbnQtaW5wdXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi9jb3JlL3BsYXRmb3JtLmpzJztcblxuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgUmF5IH0gZnJvbSAnLi4vc2hhcGUvcmF5LmpzJztcblxuaW1wb3J0IHsgZ2V0QXBwbGljYXRpb24gfSBmcm9tICcuLi9mcmFtZXdvcmsvZ2xvYmFscy5qcyc7XG5cbmltcG9ydCB7IE1vdXNlIH0gZnJvbSAnLi9tb3VzZS5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBDYW1lcmFDb21wb25lbnQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9lbGVtZW50L2NvbXBvbmVudC5qcycpLkVsZW1lbnRDb21wb25lbnR9IEVsZW1lbnRDb21wb25lbnQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi94ci94ci1pbnB1dC1zb3VyY2UuanMnKS5YcklucHV0U291cmNlfSBYcklucHV0U291cmNlICovXG5cbmxldCB0YXJnZXRYLCB0YXJnZXRZO1xuY29uc3QgdmVjQSA9IG5ldyBWZWMzKCk7XG5jb25zdCB2ZWNCID0gbmV3IFZlYzMoKTtcblxuY29uc3QgcmF5QSA9IG5ldyBSYXkoKTtcbmNvbnN0IHJheUIgPSBuZXcgUmF5KCk7XG5jb25zdCByYXlDID0gbmV3IFJheSgpO1xuXG5yYXlBLmVuZCA9IG5ldyBWZWMzKCk7XG5yYXlCLmVuZCA9IG5ldyBWZWMzKCk7XG5yYXlDLmVuZCA9IG5ldyBWZWMzKCk7XG5cbmNvbnN0IF9wcSA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGEgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BiID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wYyA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGQgPSBuZXcgVmVjMygpO1xuY29uc3QgX20gPSBuZXcgVmVjMygpO1xuY29uc3QgX2F1ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9idiA9IG5ldyBWZWMzKCk7XG5jb25zdCBfY3cgPSBuZXcgVmVjMygpO1xuY29uc3QgX2lyID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9zY3QgPSBuZXcgVmVjMygpO1xuY29uc3QgX2FjY3VtdWxhdGVkU2NhbGUgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BhZGRpbmdUb3AgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BhZGRpbmdCb3R0b20gPSBuZXcgVmVjMygpO1xuY29uc3QgX3BhZGRpbmdMZWZ0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wYWRkaW5nUmlnaHQgPSBuZXcgVmVjMygpO1xuY29uc3QgX2Nvcm5lckJvdHRvbUxlZnQgPSBuZXcgVmVjMygpO1xuY29uc3QgX2Nvcm5lckJvdHRvbVJpZ2h0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9jb3JuZXJUb3BSaWdodCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfY29ybmVyVG9wTGVmdCA9IG5ldyBWZWMzKCk7XG5cbmNvbnN0IFpFUk9fVkVDNCA9IG5ldyBWZWM0KCk7XG5cbi8vIHBpIHggcDIgKiBwM1xuZnVuY3Rpb24gc2NhbGFyVHJpcGxlKHAxLCBwMiwgcDMpIHtcbiAgICByZXR1cm4gX3NjdC5jcm9zcyhwMSwgcDIpLmRvdChwMyk7XG59XG5cbi8vIEdpdmVuIGxpbmUgcHEgYW5kIGNjdyBjb3JuZXJzIG9mIGEgcXVhZCwgcmV0dXJuIHRoZSBzcXVhcmUgZGlzdGFuY2UgdG8gdGhlIGludGVyc2VjdGlvbiBwb2ludC5cbi8vIElmIHRoZSBsaW5lIGFuZCBxdWFkIGRvIG5vdCBpbnRlcnNlY3QsIHJldHVybiAtMS4gKGZyb20gUmVhbC1UaW1lIENvbGxpc2lvbiBEZXRlY3Rpb24gYm9vaylcbmZ1bmN0aW9uIGludGVyc2VjdExpbmVRdWFkKHAsIHEsIGNvcm5lcnMpIHtcbiAgICBfcHEuc3ViMihxLCBwKTtcbiAgICBfcGEuc3ViMihjb3JuZXJzWzBdLCBwKTtcbiAgICBfcGIuc3ViMihjb3JuZXJzWzFdLCBwKTtcbiAgICBfcGMuc3ViMihjb3JuZXJzWzJdLCBwKTtcblxuICAgIC8vIERldGVybWluZSB3aGljaCB0cmlhbmdsZSB0byB0ZXN0IGFnYWluc3QgYnkgdGVzdGluZyBhZ2FpbnN0IGRpYWdvbmFsIGZpcnN0XG4gICAgX20uY3Jvc3MoX3BjLCBfcHEpO1xuICAgIGxldCB2ID0gX3BhLmRvdChfbSk7XG4gICAgbGV0IHU7XG4gICAgbGV0IHc7XG5cbiAgICBpZiAodiA+PSAwKSB7XG4gICAgICAgIC8vIFRlc3QgaW50ZXJzZWN0aW9uIGFnYWluc3QgdHJpYW5nbGUgYWJjXG4gICAgICAgIHUgPSAtX3BiLmRvdChfbSk7XG4gICAgICAgIGlmICh1IDwgMClcbiAgICAgICAgICAgIHJldHVybiAtMTtcblxuICAgICAgICB3ID0gc2NhbGFyVHJpcGxlKF9wcSwgX3BiLCBfcGEpO1xuICAgICAgICBpZiAodyA8IDApXG4gICAgICAgICAgICByZXR1cm4gLTE7XG5cbiAgICAgICAgY29uc3QgZGVub20gPSAxLjAgLyAodSArIHYgKyB3KTtcblxuICAgICAgICBfYXUuY29weShjb3JuZXJzWzBdKS5tdWxTY2FsYXIodSAqIGRlbm9tKTtcbiAgICAgICAgX2J2LmNvcHkoY29ybmVyc1sxXSkubXVsU2NhbGFyKHYgKiBkZW5vbSk7XG4gICAgICAgIF9jdy5jb3B5KGNvcm5lcnNbMl0pLm11bFNjYWxhcih3ICogZGVub20pO1xuICAgICAgICBfaXIuY29weShfYXUpLmFkZChfYnYpLmFkZChfY3cpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRlc3QgaW50ZXJzZWN0aW9uIGFnYWluc3QgdHJpYW5nbGUgZGFjXG4gICAgICAgIF9wZC5zdWIyKGNvcm5lcnNbM10sIHApO1xuICAgICAgICB1ID0gX3BkLmRvdChfbSk7XG4gICAgICAgIGlmICh1IDwgMClcbiAgICAgICAgICAgIHJldHVybiAtMTtcblxuICAgICAgICB3ID0gc2NhbGFyVHJpcGxlKF9wcSwgX3BhLCBfcGQpO1xuICAgICAgICBpZiAodyA8IDApXG4gICAgICAgICAgICByZXR1cm4gLTE7XG5cbiAgICAgICAgdiA9IC12O1xuXG4gICAgICAgIGNvbnN0IGRlbm9tID0gMS4wIC8gKHUgKyB2ICsgdyk7XG5cbiAgICAgICAgX2F1LmNvcHkoY29ybmVyc1swXSkubXVsU2NhbGFyKHUgKiBkZW5vbSk7XG4gICAgICAgIF9idi5jb3B5KGNvcm5lcnNbM10pLm11bFNjYWxhcih2ICogZGVub20pO1xuICAgICAgICBfY3cuY29weShjb3JuZXJzWzJdKS5tdWxTY2FsYXIodyAqIGRlbm9tKTtcbiAgICAgICAgX2lyLmNvcHkoX2F1KS5hZGQoX2J2KS5hZGQoX2N3KTtcbiAgICB9XG5cbiAgICAvLyBUaGUgYWxnb3JpdGhtIGFib3ZlIGRvZXNuJ3Qgd29yayBpZiBhbGwgdGhlIGNvcm5lcnMgYXJlIHRoZSBzYW1lXG4gICAgLy8gU28gZG8gdGhhdCB0ZXN0IGhlcmUgYnkgY2hlY2tpbmcgaWYgdGhlIGRpYWdvbmFscyBhcmUgMCAoc2luY2UgdGhlc2UgYXJlIHJlY3RhbmdsZXMgd2UncmUgY2hlY2tpbmcgYWdhaW5zdClcbiAgICBpZiAoX3BxLnN1YjIoY29ybmVyc1swXSwgY29ybmVyc1syXSkubGVuZ3RoU3EoKSA8IDAuMDAwMSAqIDAuMDAwMSkgcmV0dXJuIC0xO1xuICAgIGlmIChfcHEuc3ViMihjb3JuZXJzWzFdLCBjb3JuZXJzWzNdKS5sZW5ndGhTcSgpIDwgMC4wMDAxICogMC4wMDAxKSByZXR1cm4gLTE7XG5cbiAgICByZXR1cm4gX2lyLnN1YihwKS5sZW5ndGhTcSgpO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaW5wdXQgZXZlbnQgZmlyZWQgb24gYSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0uIFdoZW4gYW4gZXZlbnQgaXMgcmFpc2VkIG9uIGFuXG4gKiBFbGVtZW50Q29tcG9uZW50IGl0IGJ1YmJsZXMgdXAgdG8gaXRzIHBhcmVudCBFbGVtZW50Q29tcG9uZW50cyB1bmxlc3Mgd2UgY2FsbCBzdG9wUHJvcGFnYXRpb24oKS5cbiAqL1xuY2xhc3MgRWxlbWVudElucHV0RXZlbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBFbGVtZW50SW5wdXRFdmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TW91c2VFdmVudHxUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBNb3VzZUV2ZW50IG9yIFRvdWNoRXZlbnQgdGhhdCB3YXMgb3JpZ2luYWxseVxuICAgICAqIHJhaXNlZC5cbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRDb21wb25lbnR9IGVsZW1lbnQgLSBUaGUgRWxlbWVudENvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHlcbiAgICAgKiByYWlzZWQgb24uXG4gICAgICogQHBhcmFtIHtDYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIFRoZSBDYW1lcmFDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZFxuICAgICAqIHZpYS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihldmVudCwgZWxlbWVudCwgY2FtZXJhKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgTW91c2VFdmVudCBvciBUb3VjaEV2ZW50IHRoYXQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7TW91c2VFdmVudHxUb3VjaEV2ZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ldmVudCA9IGV2ZW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgRWxlbWVudENvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkIG9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RWxlbWVudENvbXBvbmVudH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBDYW1lcmFDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZCB2aWEuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtDYW1lcmFDb21wb25lbnR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcblxuICAgICAgICB0aGlzLl9zdG9wUHJvcGFnYXRpb24gPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wIHByb3BhZ2F0aW9uIG9mIHRoZSBldmVudCB0byBwYXJlbnQge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy4gVGhpcyBhbHNvIHN0b3BzXG4gICAgICogcHJvcGFnYXRpb24gb2YgdGhlIGV2ZW50IHRvIG90aGVyIGV2ZW50IGxpc3RlbmVycyBvZiB0aGUgb3JpZ2luYWwgRE9NIEV2ZW50LlxuICAgICAqL1xuICAgIHN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICAgICAgdGhpcy5fc3RvcFByb3BhZ2F0aW9uID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMuZXZlbnQpIHtcbiAgICAgICAgICAgIHRoaXMuZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICB0aGlzLmV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBNb3VzZSBldmVudCBmaXJlZCBvbiBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fS5cbiAqXG4gKiBAYXVnbWVudHMgRWxlbWVudElucHV0RXZlbnRcbiAqL1xuY2xhc3MgRWxlbWVudE1vdXNlRXZlbnQgZXh0ZW5kcyBFbGVtZW50SW5wdXRFdmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIGluc3RhbmNlIG9mIGFuIEVsZW1lbnRNb3VzZUV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBNb3VzZUV2ZW50IHRoYXQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkLlxuICAgICAqIEBwYXJhbSB7RWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZSBFbGVtZW50Q29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseVxuICAgICAqIHJhaXNlZCBvbi5cbiAgICAgKiBAcGFyYW0ge0NhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gVGhlIENhbWVyYUNvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkXG4gICAgICogdmlhLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGxhc3RYIC0gVGhlIGxhc3QgeCBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsYXN0WSAtIFRoZSBsYXN0IHkgY29vcmRpbmF0ZS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihldmVudCwgZWxlbWVudCwgY2FtZXJhLCB4LCB5LCBsYXN0WCwgbGFzdFkpIHtcbiAgICAgICAgc3VwZXIoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSk7XG5cbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogV2hldGhlciB0aGUgY3RybCBrZXkgd2FzIHByZXNzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdHJsS2V5ID0gZXZlbnQuY3RybEtleSB8fCBmYWxzZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdoZXRoZXIgdGhlIGFsdCBrZXkgd2FzIHByZXNzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5hbHRLZXkgPSBldmVudC5hbHRLZXkgfHwgZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGV0aGVyIHRoZSBzaGlmdCBrZXkgd2FzIHByZXNzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zaGlmdEtleSA9IGV2ZW50LnNoaWZ0S2V5IHx8IGZhbHNlO1xuICAgICAgICAvKipcbiAgICAgICAgICogV2hldGhlciB0aGUgbWV0YSBrZXkgd2FzIHByZXNzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tZXRhS2V5ID0gZXZlbnQubWV0YUtleSB8fCBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG1vdXNlIGJ1dHRvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYnV0dG9uID0gZXZlbnQuYnV0dG9uO1xuXG4gICAgICAgIGlmIChNb3VzZS5pc1BvaW50ZXJMb2NrZWQoKSkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgYW1vdW50IG9mIGhvcml6b250YWwgbW92ZW1lbnQgb2YgdGhlIGN1cnNvci5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmR4ID0gZXZlbnQubW92ZW1lbnRYIHx8IGV2ZW50LndlYmtpdE1vdmVtZW50WCB8fCBldmVudC5tb3pNb3ZlbWVudFggfHwgMDtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGFtb3VudCBvZiB2ZXJ0aWNhbCBtb3ZlbWVudCBvZiB0aGUgY3Vyc29yLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuZHkgPSBldmVudC5tb3ZlbWVudFkgfHwgZXZlbnQud2Via2l0TW92ZW1lbnRZIHx8IGV2ZW50Lm1vek1vdmVtZW50WSB8fCAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5keCA9IHggLSBsYXN0WDtcbiAgICAgICAgICAgIHRoaXMuZHkgPSB5IC0gbGFzdFk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFtb3VudCBvZiB0aGUgd2hlZWwgbW92ZW1lbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLndoZWVsRGVsdGEgPSAwO1xuXG4gICAgICAgIC8vIGRlbHRhWSBpcyBpbiBhIGRpZmZlcmVudCByYW5nZSBhY3Jvc3MgZGlmZmVyZW50IGJyb3dzZXJzLiBUaGUgb25seSB0aGluZ1xuICAgICAgICAvLyB0aGF0IGlzIGNvbnNpc3RlbnQgaXMgdGhlIHNpZ24gb2YgdGhlIHZhbHVlIHNvIHNuYXAgdG8gLTEvKzEuXG4gICAgICAgIGlmIChldmVudC50eXBlID09PSAnd2hlZWwnKSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQuZGVsdGFZID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMud2hlZWxEZWx0YSA9IDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmRlbHRhWSA8IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndoZWVsRGVsdGEgPSAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgVG91Y2hFdmVudCBmaXJlZCBvbiBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fS5cbiAqXG4gKiBAYXVnbWVudHMgRWxlbWVudElucHV0RXZlbnRcbiAqL1xuY2xhc3MgRWxlbWVudFRvdWNoRXZlbnQgZXh0ZW5kcyBFbGVtZW50SW5wdXRFdmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIGluc3RhbmNlIG9mIGFuIEVsZW1lbnRUb3VjaEV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBUb3VjaEV2ZW50IHRoYXQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkLlxuICAgICAqIEBwYXJhbSB7RWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZSBFbGVtZW50Q29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseVxuICAgICAqIHJhaXNlZCBvbi5cbiAgICAgKiBAcGFyYW0ge0NhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gVGhlIENhbWVyYUNvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkXG4gICAgICogdmlhLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvZiB0aGUgdG91Y2ggdGhhdCB0cmlnZ2VyZWQgdGhlIGV2ZW50LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZSBvZiB0aGUgdG91Y2ggdGhhdCB0cmlnZ2VyZWQgdGhlIGV2ZW50LlxuICAgICAqIEBwYXJhbSB7VG91Y2h9IHRvdWNoIC0gVGhlIHRvdWNoIG9iamVjdCB0aGF0IHRyaWdnZXJlZCB0aGUgZXZlbnQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSwgeCwgeSwgdG91Y2gpIHtcbiAgICAgICAgc3VwZXIoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBUb3VjaCBvYmplY3RzIHJlcHJlc2VudGluZyBhbGwgY3VycmVudCBwb2ludHMgb2YgY29udGFjdCB3aXRoIHRoZSBzdXJmYWNlLFxuICAgICAgICAgKiByZWdhcmRsZXNzIG9mIHRhcmdldCBvciBjaGFuZ2VkIHN0YXR1cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1RvdWNoW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRvdWNoZXMgPSBldmVudC50b3VjaGVzO1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFRvdWNoIG9iamVjdHMgcmVwcmVzZW50aW5nIGluZGl2aWR1YWwgcG9pbnRzIG9mIGNvbnRhY3Qgd2hvc2Ugc3RhdGVzIGNoYW5nZWQgYmV0d2VlblxuICAgICAgICAgKiB0aGUgcHJldmlvdXMgdG91Y2ggZXZlbnQgYW5kIHRoaXMgb25lLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VG91Y2hbXX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY2hhbmdlZFRvdWNoZXMgPSBldmVudC5jaGFuZ2VkVG91Y2hlcztcbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0b3VjaCBvYmplY3QgdGhhdCB0cmlnZ2VyZWQgdGhlIGV2ZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VG91Y2h9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRvdWNoID0gdG91Y2g7XG4gICAgfVxufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBYUklucHV0U291cmNlRXZlbnQgZmlyZWQgb24gYSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0uXG4gKlxuICogQGF1Z21lbnRzIEVsZW1lbnRJbnB1dEV2ZW50XG4gKi9cbmNsYXNzIEVsZW1lbnRTZWxlY3RFdmVudCBleHRlbmRzIEVsZW1lbnRJbnB1dEV2ZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW4gaW5zdGFuY2Ugb2YgYSBFbGVtZW50U2VsZWN0RXZlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZXZlbnQgLSBUaGUgWFJJbnB1dFNvdXJjZUV2ZW50IHRoYXQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkLlxuICAgICAqIEBwYXJhbSB7RWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZSBFbGVtZW50Q29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseVxuICAgICAqIHJhaXNlZCBvbi5cbiAgICAgKiBAcGFyYW0ge0NhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gVGhlIENhbWVyYUNvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkXG4gICAgICogdmlhLlxuICAgICAqIEBwYXJhbSB7WHJJbnB1dFNvdXJjZX0gaW5wdXRTb3VyY2UgLSBUaGUgWFIgaW5wdXQgc291cmNlIHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseVxuICAgICAqIHJhaXNlZCBmcm9tLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIGlucHV0U291cmNlKSB7XG4gICAgICAgIHN1cGVyKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgWFIgaW5wdXQgc291cmNlIHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWQgZnJvbS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1hySW5wdXRTb3VyY2V9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmlucHV0U291cmNlID0gaW5wdXRTb3VyY2U7XG4gICAgfVxufVxuXG4vKipcbiAqIEhhbmRsZXMgbW91c2UgYW5kIHRvdWNoIGV2ZW50cyBmb3Ige0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy4gV2hlbiBpbnB1dCBldmVudHMgb2NjdXIgb24gYW5cbiAqIEVsZW1lbnRDb21wb25lbnQgdGhpcyBmaXJlcyB0aGUgYXBwcm9wcmlhdGUgZXZlbnRzIG9uIHRoZSBFbGVtZW50Q29tcG9uZW50LlxuICovXG5jbGFzcyBFbGVtZW50SW5wdXQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBFbGVtZW50SW5wdXQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnR9IGRvbUVsZW1lbnQgLSBUaGUgRE9NIGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnVzZU1vdXNlXSAtIFdoZXRoZXIgdG8gYWxsb3cgbW91c2UgaW5wdXQuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy51c2VUb3VjaF0gLSBXaGV0aGVyIHRvIGFsbG93IHRvdWNoIGlucHV0LiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudXNlWHJdIC0gV2hldGhlciB0byBhbGxvdyBYUiBpbnB1dCBzb3VyY2VzLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGRvbUVsZW1lbnQsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5fYXBwID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXR0YWNoZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdGFyZ2V0ID0gbnVsbDtcblxuICAgICAgICAvLyBmb3JjZSBkaXNhYmxlIGFsbCBlbGVtZW50IGlucHV0IGV2ZW50c1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl9sYXN0WCA9IDA7XG4gICAgICAgIHRoaXMuX2xhc3RZID0gMDtcblxuICAgICAgICB0aGlzLl91cEhhbmRsZXIgPSB0aGlzLl9oYW5kbGVVcC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9kb3duSGFuZGxlciA9IHRoaXMuX2hhbmRsZURvd24uYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fbW92ZUhhbmRsZXIgPSB0aGlzLl9oYW5kbGVNb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX3doZWVsSGFuZGxlciA9IHRoaXMuX2hhbmRsZVdoZWVsLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX3RvdWNoc3RhcnRIYW5kbGVyID0gdGhpcy5faGFuZGxlVG91Y2hTdGFydC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl90b3VjaGVuZEhhbmRsZXIgPSB0aGlzLl9oYW5kbGVUb3VjaEVuZC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl90b3VjaGNhbmNlbEhhbmRsZXIgPSB0aGlzLl90b3VjaGVuZEhhbmRsZXI7XG4gICAgICAgIHRoaXMuX3RvdWNobW92ZUhhbmRsZXIgPSB0aGlzLl9oYW5kbGVUb3VjaE1vdmUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fc29ydEhhbmRsZXIgPSB0aGlzLl9zb3J0RWxlbWVudHMuYmluZCh0aGlzKTtcblxuICAgICAgICB0aGlzLl9lbGVtZW50cyA9IFtdO1xuICAgICAgICB0aGlzLl9ob3ZlcmVkRWxlbWVudCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3ByZXNzZWRFbGVtZW50ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdG91Y2hlZEVsZW1lbnRzID0ge307XG4gICAgICAgIHRoaXMuX3RvdWNoZXNGb3JXaGljaFRvdWNoTGVhdmVIYXNGaXJlZCA9IHt9O1xuICAgICAgICB0aGlzLl9zZWxlY3RlZEVsZW1lbnRzID0ge307XG4gICAgICAgIHRoaXMuX3NlbGVjdGVkUHJlc3NlZEVsZW1lbnRzID0ge307XG5cbiAgICAgICAgdGhpcy5fdXNlTW91c2UgPSAhb3B0aW9ucyB8fCBvcHRpb25zLnVzZU1vdXNlICE9PSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdXNlVG91Y2ggPSAhb3B0aW9ucyB8fCBvcHRpb25zLnVzZVRvdWNoICE9PSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdXNlWHIgPSAhb3B0aW9ucyB8fCBvcHRpb25zLnVzZVhyICE9PSBmYWxzZTtcbiAgICAgICAgdGhpcy5fc2VsZWN0RXZlbnRzQXR0YWNoZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAocGxhdGZvcm0udG91Y2gpXG4gICAgICAgICAgICB0aGlzLl9jbGlja2VkRW50aXRpZXMgPSB7fTtcblxuICAgICAgICB0aGlzLmF0dGFjaChkb21FbGVtZW50KTtcbiAgICB9XG5cbiAgICBzZXQgZW5hYmxlZCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGVuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkO1xuICAgIH1cblxuICAgIHNldCBhcHAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYXBwID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGFwcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FwcCB8fCBnZXRBcHBsaWNhdGlvbigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGFjaCBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzIHRvIGEgRE9NIGVsZW1lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnR9IGRvbUVsZW1lbnQgLSBUaGUgRE9NIGVsZW1lbnQuXG4gICAgICovXG4gICAgYXR0YWNoKGRvbUVsZW1lbnQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dGFjaGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9hdHRhY2hlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5kZXRhY2goKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3RhcmdldCA9IGRvbUVsZW1lbnQ7XG4gICAgICAgIHRoaXMuX2F0dGFjaGVkID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBvcHRzID0gcGxhdGZvcm0ucGFzc2l2ZUV2ZW50cyA/IHsgcGFzc2l2ZTogdHJ1ZSB9IDogZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLl91c2VNb3VzZSkge1xuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLl91cEhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMuX2Rvd25IYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLl9tb3ZlSGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignd2hlZWwnLCB0aGlzLl93aGVlbEhhbmRsZXIsIG9wdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3VzZVRvdWNoICYmIHBsYXRmb3JtLnRvdWNoKSB7XG4gICAgICAgICAgICB0aGlzLl90YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMuX3RvdWNoc3RhcnRIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIC8vIFBhc3NpdmUgaXMgbm90IHVzZWQgZm9yIHRoZSB0b3VjaGVuZCBldmVudCBiZWNhdXNlIHNvbWUgY29tcG9uZW50cyBuZWVkIHRvIGJlXG4gICAgICAgICAgICAvLyBhYmxlIHRvIGNhbGwgcHJldmVudERlZmF1bHQoKS4gU2VlIG5vdGVzIGluIGJ1dHRvbi9jb21wb25lbnQuanMgZm9yIG1vcmUgZGV0YWlscy5cbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMuX3RvdWNoZW5kSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMuX3RvdWNobW92ZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaGNhbmNlbCcsIHRoaXMuX3RvdWNoY2FuY2VsSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hdHRhY2hTZWxlY3RFdmVudHMoKTtcbiAgICB9XG5cbiAgICBhdHRhY2hTZWxlY3RFdmVudHMoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2VsZWN0RXZlbnRzQXR0YWNoZWQgJiYgdGhpcy5fdXNlWHIgJiYgdGhpcy5hcHAgJiYgdGhpcy5hcHAueHIgJiYgdGhpcy5hcHAueHIuc3VwcG9ydGVkKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2NsaWNrZWRFbnRpdGllcylcbiAgICAgICAgICAgICAgICB0aGlzLl9jbGlja2VkRW50aXRpZXMgPSB7fTtcblxuICAgICAgICAgICAgdGhpcy5fc2VsZWN0RXZlbnRzQXR0YWNoZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIub24oJ3N0YXJ0JywgdGhpcy5fb25YclN0YXJ0LCB0aGlzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzIGZyb20gdGhlIERPTSBlbGVtZW50IHRoYXQgaXQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgZGV0YWNoKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2F0dGFjaGVkKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2F0dGFjaGVkID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3Qgb3B0cyA9IHBsYXRmb3JtLnBhc3NpdmVFdmVudHMgPyB7IHBhc3NpdmU6IHRydWUgfSA6IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5fdXNlTW91c2UpIHtcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5fdXBIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLl9kb3duSGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5fbW92ZUhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3doZWVsJywgdGhpcy5fd2hlZWxIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl91c2VUb3VjaCkge1xuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0aGlzLl90b3VjaHN0YXJ0SGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICB0aGlzLl90YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0aGlzLl90b3VjaGVuZEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaG1vdmVIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLl90YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hjYW5jZWwnLCB0aGlzLl90b3VjaGNhbmNlbEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zZWxlY3RFdmVudHNBdHRhY2hlZCkge1xuICAgICAgICAgICAgdGhpcy5fc2VsZWN0RXZlbnRzQXR0YWNoZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuYXBwLnhyLm9mZignc3RhcnQnLCB0aGlzLl9vblhyU3RhcnQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIub2ZmKCdlbmQnLCB0aGlzLl9vblhyRW5kLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLnhyLm9mZigndXBkYXRlJywgdGhpcy5fb25YclVwZGF0ZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vZmYoJ3NlbGVjdHN0YXJ0JywgdGhpcy5fb25TZWxlY3RTdGFydCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vZmYoJ3NlbGVjdGVuZCcsIHRoaXMuX29uU2VsZWN0RW5kLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25YcklucHV0UmVtb3ZlLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3RhcmdldCA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9IHRvIHRoZSBpbnRlcm5hbCBsaXN0IG9mIEVsZW1lbnRDb21wb25lbnRzIHRoYXQgYXJlIGJlaW5nXG4gICAgICogY2hlY2tlZCBmb3IgaW5wdXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRDb21wb25lbnR9IGVsZW1lbnQgLSBUaGUgRWxlbWVudENvbXBvbmVudC5cbiAgICAgKi9cbiAgICBhZGRFbGVtZW50KGVsZW1lbnQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnRzLmluZGV4T2YoZWxlbWVudCkgPT09IC0xKVxuICAgICAgICAgICAgdGhpcy5fZWxlbWVudHMucHVzaChlbGVtZW50KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgYSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0gZnJvbSB0aGUgaW50ZXJuYWwgbGlzdCBvZiBFbGVtZW50Q29tcG9uZW50cyB0aGF0IGFyZSBiZWluZ1xuICAgICAqIGNoZWNrZWQgZm9yIGlucHV0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbGVtZW50Q29tcG9uZW50fSBlbGVtZW50IC0gVGhlIEVsZW1lbnRDb21wb25lbnQuXG4gICAgICovXG4gICAgcmVtb3ZlRWxlbWVudChlbGVtZW50KSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuX2VsZW1lbnRzLmluZGV4T2YoZWxlbWVudCk7XG4gICAgICAgIGlmIChpZHggIT09IC0xKVxuICAgICAgICAgICAgdGhpcy5fZWxlbWVudHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVVwKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmIChNb3VzZS5pc1BvaW50ZXJMb2NrZWQoKSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjTW91c2VDb29yZHMoZXZlbnQpO1xuXG4gICAgICAgIHRoaXMuX29uRWxlbWVudE1vdXNlRXZlbnQoJ21vdXNldXAnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZURvd24oZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKE1vdXNlLmlzUG9pbnRlckxvY2tlZCgpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2NhbGNNb3VzZUNvb3JkcyhldmVudCk7XG5cbiAgICAgICAgdGhpcy5fb25FbGVtZW50TW91c2VFdmVudCgnbW91c2Vkb3duJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9oYW5kbGVNb3ZlKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2NhbGNNb3VzZUNvb3JkcyhldmVudCk7XG5cbiAgICAgICAgdGhpcy5fb25FbGVtZW50TW91c2VFdmVudCgnbW91c2Vtb3ZlJywgZXZlbnQpO1xuXG4gICAgICAgIHRoaXMuX2xhc3RYID0gdGFyZ2V0WDtcbiAgICAgICAgdGhpcy5fbGFzdFkgPSB0YXJnZXRZO1xuICAgIH1cblxuICAgIF9oYW5kbGVXaGVlbChldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjTW91c2VDb29yZHMoZXZlbnQpO1xuXG4gICAgICAgIHRoaXMuX29uRWxlbWVudE1vdXNlRXZlbnQoJ21vdXNld2hlZWwnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX2RldGVybWluZVRvdWNoZWRFbGVtZW50cyhldmVudCkge1xuICAgICAgICBjb25zdCB0b3VjaGVkRWxlbWVudHMgPSB7fTtcbiAgICAgICAgY29uc3QgY2FtZXJhcyA9IHRoaXMuYXBwLnN5c3RlbXMuY2FtZXJhLmNhbWVyYXM7XG5cbiAgICAgICAgLy8gY2hlY2sgY2FtZXJhcyBmcm9tIGxhc3QgdG8gZnJvbnRcbiAgICAgICAgLy8gc28gdGhhdCBlbGVtZW50cyB0aGF0IGFyZSBkcmF3biBhYm92ZSBvdGhlcnNcbiAgICAgICAgLy8gcmVjZWl2ZSBldmVudHMgZmlyc3RcbiAgICAgICAgZm9yIChsZXQgaSA9IGNhbWVyYXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGNhbWVyYXNbaV07XG5cbiAgICAgICAgICAgIGxldCBkb25lID0gMDtcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICBpZiAodG91Y2hlZEVsZW1lbnRzW2V2ZW50LmNoYW5nZWRUb3VjaGVzW2pdLmlkZW50aWZpZXJdKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvbmUrKztcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29vcmRzID0gdGhpcy5fY2FsY1RvdWNoQ29vcmRzKGV2ZW50LmNoYW5nZWRUb3VjaGVzW2pdKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9nZXRUYXJnZXRFbGVtZW50QnlDb29yZHMoY2FtZXJhLCBjb29yZHMueCwgY29vcmRzLnkpO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGRvbmUrKztcbiAgICAgICAgICAgICAgICAgICAgdG91Y2hlZEVsZW1lbnRzW2V2ZW50LmNoYW5nZWRUb3VjaGVzW2pdLmlkZW50aWZpZXJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudDogZWxlbWVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbWVyYTogY2FtZXJhLFxuICAgICAgICAgICAgICAgICAgICAgICAgeDogY29vcmRzLngsXG4gICAgICAgICAgICAgICAgICAgICAgICB5OiBjb29yZHMueVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRvbmUgPT09IGxlbikge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRvdWNoZWRFbGVtZW50cztcbiAgICB9XG5cbiAgICBfaGFuZGxlVG91Y2hTdGFydChldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBuZXdUb3VjaGVkRWxlbWVudHMgPSB0aGlzLl9kZXRlcm1pbmVUb3VjaGVkRWxlbWVudHMoZXZlbnQpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdG91Y2ggPSBldmVudC5jaGFuZ2VkVG91Y2hlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG5ld1RvdWNoSW5mbyA9IG5ld1RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcbiAgICAgICAgICAgIGNvbnN0IG9sZFRvdWNoSW5mbyA9IHRoaXMuX3RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcblxuICAgICAgICAgICAgaWYgKG5ld1RvdWNoSW5mbyAmJiAoIW9sZFRvdWNoSW5mbyB8fCBuZXdUb3VjaEluZm8uZWxlbWVudCAhPT0gb2xkVG91Y2hJbmZvLmVsZW1lbnQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KGV2ZW50LnR5cGUsIG5ldyBFbGVtZW50VG91Y2hFdmVudChldmVudCwgbmV3VG91Y2hJbmZvLmVsZW1lbnQsIG5ld1RvdWNoSW5mby5jYW1lcmEsIG5ld1RvdWNoSW5mby54LCBuZXdUb3VjaEluZm8ueSwgdG91Y2gpKTtcbiAgICAgICAgICAgICAgICB0aGlzLl90b3VjaGVzRm9yV2hpY2hUb3VjaExlYXZlSGFzRmlyZWRbdG91Y2guaWRlbnRpZmllcl0gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgdG91Y2hJZCBpbiBuZXdUb3VjaGVkRWxlbWVudHMpIHtcbiAgICAgICAgICAgIHRoaXMuX3RvdWNoZWRFbGVtZW50c1t0b3VjaElkXSA9IG5ld1RvdWNoZWRFbGVtZW50c1t0b3VjaElkXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVUb3VjaEVuZChldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBjYW1lcmFzID0gdGhpcy5hcHAuc3lzdGVtcy5jYW1lcmEuY2FtZXJhcztcblxuICAgICAgICAvLyBjbGVhciBjbGlja2VkIGVudGl0aWVzIGZpcnN0IHRoZW4gc3RvcmUgZWFjaCBjbGlja2VkIGVudGl0eVxuICAgICAgICAvLyBpbiBfY2xpY2tlZEVudGl0aWVzIHNvIHRoYXQgd2UgZG9uJ3QgZmlyZSBhbm90aGVyIGNsaWNrXG4gICAgICAgIC8vIG9uIGl0IGluIHRoaXMgaGFuZGxlciBvciBpbiB0aGUgbW91c2V1cCBoYW5kbGVyIHdoaWNoIGlzXG4gICAgICAgIC8vIGZpcmVkIGxhdGVyXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMuX2NsaWNrZWRFbnRpdGllcykge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2NsaWNrZWRFbnRpdGllc1trZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB0b3VjaCA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgdG91Y2hJbmZvID0gdGhpcy5fdG91Y2hlZEVsZW1lbnRzW3RvdWNoLmlkZW50aWZpZXJdO1xuICAgICAgICAgICAgaWYgKCF0b3VjaEluZm8pXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0b3VjaEluZm8uZWxlbWVudDtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHRvdWNoSW5mby5jYW1lcmE7XG4gICAgICAgICAgICBjb25zdCB4ID0gdG91Y2hJbmZvLng7XG4gICAgICAgICAgICBjb25zdCB5ID0gdG91Y2hJbmZvLnk7XG5cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl90b3VjaGVkRWxlbWVudHNbdG91Y2guaWRlbnRpZmllcl07XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fdG91Y2hlc0ZvcldoaWNoVG91Y2hMZWF2ZUhhc0ZpcmVkW3RvdWNoLmlkZW50aWZpZXJdO1xuXG4gICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoZXZlbnQudHlwZSwgbmV3IEVsZW1lbnRUb3VjaEV2ZW50KGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIHgsIHksIHRvdWNoKSk7XG5cbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHRvdWNoIHdhcyByZWxlYXNlZCBvdmVyIHByZXZpb3VzbHkgdG91Y2hcbiAgICAgICAgICAgIC8vIGVsZW1lbnQgaW4gb3JkZXIgdG8gZmlyZSBjbGljayBldmVudFxuICAgICAgICAgICAgY29uc3QgY29vcmRzID0gdGhpcy5fY2FsY1RvdWNoQ29vcmRzKHRvdWNoKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgYyA9IGNhbWVyYXMubGVuZ3RoIC0gMTsgYyA+PSAwOyBjLS0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBob3ZlcmVkID0gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudEJ5Q29vcmRzKGNhbWVyYXNbY10sIGNvb3Jkcy54LCBjb29yZHMueSk7XG4gICAgICAgICAgICAgICAgaWYgKGhvdmVyZWQgPT09IGVsZW1lbnQpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NsaWNrZWRFbnRpdGllc1tlbGVtZW50LmVudGl0eS5nZXRHdWlkKCldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ2NsaWNrJywgbmV3IEVsZW1lbnRUb3VjaEV2ZW50KGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIHgsIHksIHRvdWNoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlja2VkRW50aXRpZXNbZWxlbWVudC5lbnRpdHkuZ2V0R3VpZCgpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVUb3VjaE1vdmUoZXZlbnQpIHtcbiAgICAgICAgLy8gY2FsbCBwcmV2ZW50RGVmYXVsdCB0byBhdm9pZCBpc3N1ZXMgaW4gQ2hyb21lIEFuZHJvaWQ6XG4gICAgICAgIC8vIGh0dHA6Ly93aWxzb25wYWdlLmNvLnVrL3RvdWNoLWV2ZW50cy1pbi1jaHJvbWUtYW5kcm9pZC9cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBuZXdUb3VjaGVkRWxlbWVudHMgPSB0aGlzLl9kZXRlcm1pbmVUb3VjaGVkRWxlbWVudHMoZXZlbnQpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdG91Y2ggPSBldmVudC5jaGFuZ2VkVG91Y2hlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG5ld1RvdWNoSW5mbyA9IG5ld1RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcbiAgICAgICAgICAgIGNvbnN0IG9sZFRvdWNoSW5mbyA9IHRoaXMuX3RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcblxuICAgICAgICAgICAgaWYgKG9sZFRvdWNoSW5mbykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvb3JkcyA9IHRoaXMuX2NhbGNUb3VjaENvb3Jkcyh0b3VjaCk7XG5cbiAgICAgICAgICAgICAgICAvLyBGaXJlIHRvdWNobGVhdmUgaWYgd2UndmUgbGVmdCB0aGUgcHJldmlvdXNseSB0b3VjaGVkIGVsZW1lbnRcbiAgICAgICAgICAgICAgICBpZiAoKCFuZXdUb3VjaEluZm8gfHwgbmV3VG91Y2hJbmZvLmVsZW1lbnQgIT09IG9sZFRvdWNoSW5mby5lbGVtZW50KSAmJiAhdGhpcy5fdG91Y2hlc0ZvcldoaWNoVG91Y2hMZWF2ZUhhc0ZpcmVkW3RvdWNoLmlkZW50aWZpZXJdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgndG91Y2hsZWF2ZScsIG5ldyBFbGVtZW50VG91Y2hFdmVudChldmVudCwgb2xkVG91Y2hJbmZvLmVsZW1lbnQsIG9sZFRvdWNoSW5mby5jYW1lcmEsIGNvb3Jkcy54LCBjb29yZHMueSwgdG91Y2gpKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGbGFnIHRoYXQgdG91Y2hsZWF2ZSBoYXMgYmVlbiBmaXJlZCBmb3IgdGhpcyB0b3VjaCwgc28gdGhhdCB3ZSBkb24ndFxuICAgICAgICAgICAgICAgICAgICAvLyByZS1maXJlIGl0IG9uIHRoZSBuZXh0IHRvdWNobW92ZS4gVGhpcyBpcyByZXF1aXJlZCBiZWNhdXNlIHRvdWNobW92ZVxuICAgICAgICAgICAgICAgICAgICAvLyBldmVudHMga2VlcCBvbiBmaXJpbmcgZm9yIHRoZSBzYW1lIGVsZW1lbnQgdW50aWwgdGhlIHRvdWNoIGVuZHMsIGV2ZW5cbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIHRvdWNoIHBvc2l0aW9uIG1vdmVzIGF3YXkgZnJvbSB0aGUgZWxlbWVudC4gVG91Y2hsZWF2ZSwgb24gdGhlXG4gICAgICAgICAgICAgICAgICAgIC8vIG90aGVyIGhhbmQsIHNob3VsZCBmaXJlIG9uY2Ugd2hlbiB0aGUgdG91Y2ggcG9zaXRpb24gbW92ZXMgYXdheSBmcm9tXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBlbGVtZW50IGFuZCB0aGVuIG5vdCByZS1maXJlIGFnYWluIHdpdGhpbiB0aGUgc2FtZSB0b3VjaCBzZXNzaW9uLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90b3VjaGVzRm9yV2hpY2hUb3VjaExlYXZlSGFzRmlyZWRbdG91Y2guaWRlbnRpZmllcl0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgndG91Y2htb3ZlJywgbmV3IEVsZW1lbnRUb3VjaEV2ZW50KGV2ZW50LCBvbGRUb3VjaEluZm8uZWxlbWVudCwgb2xkVG91Y2hJbmZvLmNhbWVyYSwgY29vcmRzLngsIGNvb3Jkcy55LCB0b3VjaCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uRWxlbWVudE1vdXNlRXZlbnQoZXZlbnRUeXBlLCBldmVudCkge1xuICAgICAgICBsZXQgZWxlbWVudCA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgbGFzdEhvdmVyZWQgPSB0aGlzLl9ob3ZlcmVkRWxlbWVudDtcbiAgICAgICAgdGhpcy5faG92ZXJlZEVsZW1lbnQgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYXMgPSB0aGlzLmFwcC5zeXN0ZW1zLmNhbWVyYS5jYW1lcmFzO1xuICAgICAgICBsZXQgY2FtZXJhO1xuXG4gICAgICAgIC8vIGNoZWNrIGNhbWVyYXMgZnJvbSBsYXN0IHRvIGZyb250XG4gICAgICAgIC8vIHNvIHRoYXQgZWxlbWVudHMgdGhhdCBhcmUgZHJhd24gYWJvdmUgb3RoZXJzXG4gICAgICAgIC8vIHJlY2VpdmUgZXZlbnRzIGZpcnN0XG4gICAgICAgIGZvciAobGV0IGkgPSBjYW1lcmFzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBjYW1lcmEgPSBjYW1lcmFzW2ldO1xuXG4gICAgICAgICAgICBlbGVtZW50ID0gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudEJ5Q29vcmRzKGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSk7XG4gICAgICAgICAgICBpZiAoZWxlbWVudClcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGN1cnJlbnRseSBob3ZlcmVkIGVsZW1lbnQgaXMgd2hhdGV2ZXIncyBiZWluZyBwb2ludGVkIGJ5IG1vdXNlICh3aGljaCBtYXkgYmUgbnVsbClcbiAgICAgICAgdGhpcy5faG92ZXJlZEVsZW1lbnQgPSBlbGVtZW50O1xuXG4gICAgICAgIC8vIGlmIHRoZXJlIHdhcyBhIHByZXNzZWQgZWxlbWVudCwgaXQgdGFrZXMgZnVsbCBwcmlvcml0eSBvZiAnbW92ZScgYW5kICd1cCcgZXZlbnRzXG4gICAgICAgIGlmICgoZXZlbnRUeXBlID09PSAnbW91c2Vtb3ZlJyB8fCBldmVudFR5cGUgPT09ICdtb3VzZXVwJykgJiYgdGhpcy5fcHJlc3NlZEVsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudChldmVudFR5cGUsIG5ldyBFbGVtZW50TW91c2VFdmVudChldmVudCwgdGhpcy5fcHJlc3NlZEVsZW1lbnQsIGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSwgdGhpcy5fbGFzdFgsIHRoaXMuX2xhc3RZKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudCkge1xuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBmaXJlIGl0IHRvIHRoZSBjdXJyZW50bHkgaG92ZXJlZCBldmVudFxuICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KGV2ZW50VHlwZSwgbmV3IEVsZW1lbnRNb3VzZUV2ZW50KGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIHRhcmdldFgsIHRhcmdldFksIHRoaXMuX2xhc3RYLCB0aGlzLl9sYXN0WSkpO1xuXG4gICAgICAgICAgICBpZiAoZXZlbnRUeXBlID09PSAnbW91c2Vkb3duJykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3ByZXNzZWRFbGVtZW50ID0gZWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYXN0SG92ZXJlZCAhPT0gdGhpcy5faG92ZXJlZEVsZW1lbnQpIHtcbiAgICAgICAgICAgIC8vIG1vdXNlbGVhdmUgZXZlbnRcbiAgICAgICAgICAgIGlmIChsYXN0SG92ZXJlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgnbW91c2VsZWF2ZScsIG5ldyBFbGVtZW50TW91c2VFdmVudChldmVudCwgbGFzdEhvdmVyZWQsIGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSwgdGhpcy5fbGFzdFgsIHRoaXMuX2xhc3RZKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG1vdXNlZW50ZXIgZXZlbnRcbiAgICAgICAgICAgIGlmICh0aGlzLl9ob3ZlcmVkRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgnbW91c2VlbnRlcicsIG5ldyBFbGVtZW50TW91c2VFdmVudChldmVudCwgdGhpcy5faG92ZXJlZEVsZW1lbnQsIGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSwgdGhpcy5fbGFzdFgsIHRoaXMuX2xhc3RZKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnRUeXBlID09PSAnbW91c2V1cCcgJiYgdGhpcy5fcHJlc3NlZEVsZW1lbnQpIHtcbiAgICAgICAgICAgIC8vIGNsaWNrIGV2ZW50XG4gICAgICAgICAgICBpZiAodGhpcy5fcHJlc3NlZEVsZW1lbnQgPT09IHRoaXMuX2hvdmVyZWRFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJlc3NlZEVsZW1lbnQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgLy8gZmlyZSBjbGljayBldmVudCBpZiBpdCBoYXNuJ3QgYmVlbiBmaXJlZCBhbHJlYWR5IGJ5IHRoZSB0b3VjaHVwIGhhbmRsZXJcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NsaWNrZWRFbnRpdGllcyB8fCAhdGhpcy5fY2xpY2tlZEVudGl0aWVzW3RoaXMuX2hvdmVyZWRFbGVtZW50LmVudGl0eS5nZXRHdWlkKCldKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgnY2xpY2snLCBuZXcgRWxlbWVudE1vdXNlRXZlbnQoZXZlbnQsIHRoaXMuX2hvdmVyZWRFbGVtZW50LCBjYW1lcmEsIHRhcmdldFgsIHRhcmdldFksIHRoaXMuX2xhc3RYLCB0aGlzLl9sYXN0WSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJlc3NlZEVsZW1lbnQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uWHJTdGFydCgpIHtcbiAgICAgICAgdGhpcy5hcHAueHIub24oJ2VuZCcsIHRoaXMuX29uWHJFbmQsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC54ci5vbigndXBkYXRlJywgdGhpcy5fb25YclVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9uKCdzZWxlY3RzdGFydCcsIHRoaXMuX29uU2VsZWN0U3RhcnQsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vbignc2VsZWN0ZW5kJywgdGhpcy5fb25TZWxlY3RFbmQsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vbigncmVtb3ZlJywgdGhpcy5fb25YcklucHV0UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25YckVuZCgpIHtcbiAgICAgICAgdGhpcy5hcHAueHIub2ZmKCd1cGRhdGUnLCB0aGlzLl9vblhyVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub2ZmKCdzZWxlY3RzdGFydCcsIHRoaXMuX29uU2VsZWN0U3RhcnQsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vZmYoJ3NlbGVjdGVuZCcsIHRoaXMuX29uU2VsZWN0RW5kLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblhySW5wdXRSZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vblhyVXBkYXRlKCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBpbnB1dFNvdXJjZXMgPSB0aGlzLmFwcC54ci5pbnB1dC5pbnB1dFNvdXJjZXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRTb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9vbkVsZW1lbnRTZWxlY3RFdmVudCgnc2VsZWN0bW92ZScsIGlucHV0U291cmNlc1tpXSwgbnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25YcklucHV0UmVtb3ZlKGlucHV0U291cmNlKSB7XG4gICAgICAgIGNvbnN0IGhvdmVyZWQgPSB0aGlzLl9zZWxlY3RlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXTtcbiAgICAgICAgaWYgKGhvdmVyZWQpIHtcbiAgICAgICAgICAgIGlucHV0U291cmNlLl9lbGVtZW50RW50aXR5ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgnc2VsZWN0bGVhdmUnLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KG51bGwsIGhvdmVyZWQsIG51bGwsIGlucHV0U291cmNlKSk7XG4gICAgICAgIH1cblxuICAgICAgICBkZWxldGUgdGhpcy5fc2VsZWN0ZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9zZWxlY3RlZFByZXNzZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG4gICAgfVxuXG4gICAgX29uU2VsZWN0U3RhcnQoaW5wdXRTb3VyY2UsIGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9vbkVsZW1lbnRTZWxlY3RFdmVudCgnc2VsZWN0c3RhcnQnLCBpbnB1dFNvdXJjZSwgZXZlbnQpO1xuICAgIH1cblxuICAgIF9vblNlbGVjdEVuZChpbnB1dFNvdXJjZSwgZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG4gICAgICAgIHRoaXMuX29uRWxlbWVudFNlbGVjdEV2ZW50KCdzZWxlY3RlbmQnLCBpbnB1dFNvdXJjZSwgZXZlbnQpO1xuICAgIH1cblxuICAgIF9vbkVsZW1lbnRTZWxlY3RFdmVudChldmVudFR5cGUsIGlucHV0U291cmNlLCBldmVudCkge1xuICAgICAgICBsZXQgZWxlbWVudDtcblxuICAgICAgICBjb25zdCBob3ZlcmVkQmVmb3JlID0gdGhpcy5fc2VsZWN0ZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG4gICAgICAgIGxldCBob3ZlcmVkTm93O1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYXMgPSB0aGlzLmFwcC5zeXN0ZW1zLmNhbWVyYS5jYW1lcmFzO1xuICAgICAgICBsZXQgY2FtZXJhO1xuXG4gICAgICAgIGlmIChpbnB1dFNvdXJjZS5lbGVtZW50SW5wdXQpIHtcbiAgICAgICAgICAgIHJheUMuc2V0KGlucHV0U291cmNlLmdldE9yaWdpbigpLCBpbnB1dFNvdXJjZS5nZXREaXJlY3Rpb24oKSk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSBjYW1lcmFzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgY2FtZXJhID0gY2FtZXJhc1tpXTtcblxuICAgICAgICAgICAgICAgIGVsZW1lbnQgPSB0aGlzLl9nZXRUYXJnZXRFbGVtZW50QnlSYXkocmF5QywgY2FtZXJhKTtcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudClcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpbnB1dFNvdXJjZS5fZWxlbWVudEVudGl0eSA9IGVsZW1lbnQgfHwgbnVsbDtcblxuICAgICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fc2VsZWN0ZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF0gPSBlbGVtZW50O1xuICAgICAgICAgICAgaG92ZXJlZE5vdyA9IGVsZW1lbnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fc2VsZWN0ZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaG92ZXJlZEJlZm9yZSAhPT0gaG92ZXJlZE5vdykge1xuICAgICAgICAgICAgaWYgKGhvdmVyZWRCZWZvcmUpIHRoaXMuX2ZpcmVFdmVudCgnc2VsZWN0bGVhdmUnLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50LCBob3ZlcmVkQmVmb3JlLCBjYW1lcmEsIGlucHV0U291cmNlKSk7XG4gICAgICAgICAgICBpZiAoaG92ZXJlZE5vdykgdGhpcy5fZmlyZUV2ZW50KCdzZWxlY3RlbnRlcicsIG5ldyBFbGVtZW50U2VsZWN0RXZlbnQoZXZlbnQsIGhvdmVyZWROb3csIGNhbWVyYSwgaW5wdXRTb3VyY2UpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChldmVudFR5cGUgPT09ICdzZWxlY3RzdGFydCcpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlbGVjdGVkUHJlc3NlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXSA9IGhvdmVyZWROb3c7XG4gICAgICAgICAgICBpZiAoaG92ZXJlZE5vdykgdGhpcy5fZmlyZUV2ZW50KCdzZWxlY3RzdGFydCcsIG5ldyBFbGVtZW50U2VsZWN0RXZlbnQoZXZlbnQsIGhvdmVyZWROb3csIGNhbWVyYSwgaW5wdXRTb3VyY2UpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByZXNzZWQgPSB0aGlzLl9zZWxlY3RlZFByZXNzZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG4gICAgICAgIGlmICghaW5wdXRTb3VyY2UuZWxlbWVudElucHV0ICYmIHByZXNzZWQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9zZWxlY3RlZFByZXNzZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG4gICAgICAgICAgICBpZiAoaG92ZXJlZEJlZm9yZSkgdGhpcy5fZmlyZUV2ZW50KCdzZWxlY3RlbmQnLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50LCBob3ZlcmVkQmVmb3JlLCBjYW1lcmEsIGlucHV0U291cmNlKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnRUeXBlID09PSAnc2VsZWN0ZW5kJyAmJiBpbnB1dFNvdXJjZS5lbGVtZW50SW5wdXQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9zZWxlY3RlZFByZXNzZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG5cbiAgICAgICAgICAgIGlmIChob3ZlcmVkQmVmb3JlKSB0aGlzLl9maXJlRXZlbnQoJ3NlbGVjdGVuZCcsIG5ldyBFbGVtZW50U2VsZWN0RXZlbnQoZXZlbnQsIGhvdmVyZWRCZWZvcmUsIGNhbWVyYSwgaW5wdXRTb3VyY2UpKTtcblxuICAgICAgICAgICAgaWYgKHByZXNzZWQgJiYgcHJlc3NlZCA9PT0gaG92ZXJlZEJlZm9yZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgnY2xpY2snLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50LCBwcmVzc2VkLCBjYW1lcmEsIGlucHV0U291cmNlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZmlyZUV2ZW50KG5hbWUsIGV2dCkge1xuICAgICAgICBsZXQgZWxlbWVudCA9IGV2dC5lbGVtZW50O1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgZWxlbWVudC5maXJlKG5hbWUsIGV2dCk7XG4gICAgICAgICAgICBpZiAoZXZ0Ll9zdG9wUHJvcGFnYXRpb24pXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGlmICghZWxlbWVudC5lbnRpdHkucGFyZW50KVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBlbGVtZW50ID0gZWxlbWVudC5lbnRpdHkucGFyZW50LmVsZW1lbnQ7XG4gICAgICAgICAgICBpZiAoIWVsZW1lbnQpXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY2FsY01vdXNlQ29vcmRzKGV2ZW50KSB7XG4gICAgICAgIGNvbnN0IHJlY3QgPSB0aGlzLl90YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgIGNvbnN0IGxlZnQgPSBNYXRoLmZsb29yKHJlY3QubGVmdCk7XG4gICAgICAgIGNvbnN0IHRvcCA9IE1hdGguZmxvb3IocmVjdC50b3ApO1xuICAgICAgICB0YXJnZXRYID0gKGV2ZW50LmNsaWVudFggLSBsZWZ0KTtcbiAgICAgICAgdGFyZ2V0WSA9IChldmVudC5jbGllbnRZIC0gdG9wKTtcbiAgICB9XG5cbiAgICBfY2FsY1RvdWNoQ29vcmRzKHRvdWNoKSB7XG4gICAgICAgIGxldCB0b3RhbE9mZnNldFggPSAwO1xuICAgICAgICBsZXQgdG90YWxPZmZzZXRZID0gMDtcbiAgICAgICAgbGV0IHRhcmdldCA9IHRvdWNoLnRhcmdldDtcbiAgICAgICAgd2hpbGUgKCEodGFyZ2V0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XG4gICAgICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgY3VycmVudEVsZW1lbnQgPSB0YXJnZXQ7XG5cbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgdG90YWxPZmZzZXRYICs9IGN1cnJlbnRFbGVtZW50Lm9mZnNldExlZnQgLSBjdXJyZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xuICAgICAgICAgICAgdG90YWxPZmZzZXRZICs9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFRvcCAtIGN1cnJlbnRFbGVtZW50LnNjcm9sbFRvcDtcbiAgICAgICAgICAgIGN1cnJlbnRFbGVtZW50ID0gY3VycmVudEVsZW1lbnQub2Zmc2V0UGFyZW50O1xuICAgICAgICB9IHdoaWxlIChjdXJyZW50RWxlbWVudCk7XG5cbiAgICAgICAgLy8gY2FsY3VsYXRlIGNvb3JkcyBhbmQgc2NhbGUgdGhlbSB0byB0aGUgZ3JhcGhpY3NEZXZpY2Ugc2l6ZVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogKHRvdWNoLnBhZ2VYIC0gdG90YWxPZmZzZXRYKSxcbiAgICAgICAgICAgIHk6ICh0b3VjaC5wYWdlWSAtIHRvdGFsT2Zmc2V0WSlcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBfc29ydEVsZW1lbnRzKGEsIGIpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJPcmRlciA9IHRoaXMuYXBwLnNjZW5lLmxheWVycy5zb3J0VHJhbnNwYXJlbnRMYXllcnMoYS5sYXllcnMsIGIubGF5ZXJzKTtcbiAgICAgICAgaWYgKGxheWVyT3JkZXIgIT09IDApIHJldHVybiBsYXllck9yZGVyO1xuXG4gICAgICAgIGlmIChhLnNjcmVlbiAmJiAhYi5zY3JlZW4pXG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIGlmICghYS5zY3JlZW4gJiYgYi5zY3JlZW4pXG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgaWYgKCFhLnNjcmVlbiAmJiAhYi5zY3JlZW4pXG4gICAgICAgICAgICByZXR1cm4gMDtcblxuICAgICAgICBpZiAoYS5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlICYmICFiLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpXG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIGlmIChiLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UgJiYgIWEuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSlcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICByZXR1cm4gYi5kcmF3T3JkZXIgLSBhLmRyYXdPcmRlcjtcbiAgICB9XG5cbiAgICBfZ2V0VGFyZ2V0RWxlbWVudEJ5Q29vcmRzKGNhbWVyYSwgeCwgeSkge1xuICAgICAgICAvLyBjYWxjdWxhdGUgc2NyZWVuLXNwYWNlIGFuZCAzZC1zcGFjZSByYXlzXG4gICAgICAgIGNvbnN0IHJheVNjcmVlbiA9IHRoaXMuX2NhbGN1bGF0ZVJheVNjcmVlbih4LCB5LCBjYW1lcmEsIHJheUEpID8gcmF5QSA6IG51bGw7XG4gICAgICAgIGNvbnN0IHJheTNkID0gdGhpcy5fY2FsY3VsYXRlUmF5M2QoeCwgeSwgY2FtZXJhLCByYXlCKSA/IHJheUIgOiBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRUYXJnZXRFbGVtZW50KGNhbWVyYSwgcmF5U2NyZWVuLCByYXkzZCk7XG4gICAgfVxuXG4gICAgX2dldFRhcmdldEVsZW1lbnRCeVJheShyYXksIGNhbWVyYSkge1xuICAgICAgICAvLyAzZCByYXkgaXMgY29waWVkIGZyb20gaW5wdXQgcmF5XG4gICAgICAgIHJheUEub3JpZ2luLmNvcHkocmF5Lm9yaWdpbik7XG4gICAgICAgIHJheUEuZGlyZWN0aW9uLmNvcHkocmF5LmRpcmVjdGlvbik7XG4gICAgICAgIHJheUEuZW5kLmNvcHkocmF5QS5kaXJlY3Rpb24pLm11bFNjYWxhcihjYW1lcmEuZmFyQ2xpcCAqIDIpLmFkZChyYXlBLm9yaWdpbik7XG4gICAgICAgIGNvbnN0IHJheTNkID0gcmF5QTtcblxuICAgICAgICAvLyBzY3JlZW4tc3BhY2UgcmF5IGlzIGJ1aWx0IGZyb20gaW5wdXQgcmF5J3Mgb3JpZ2luLCBjb252ZXJ0ZWQgdG8gc2NyZWVuLXNwYWNlXG4gICAgICAgIGNvbnN0IHNjcmVlblBvcyA9IGNhbWVyYS53b3JsZFRvU2NyZWVuKHJheTNkLm9yaWdpbiwgdmVjQSk7XG4gICAgICAgIGNvbnN0IHJheVNjcmVlbiA9IHRoaXMuX2NhbGN1bGF0ZVJheVNjcmVlbihzY3JlZW5Qb3MueCwgc2NyZWVuUG9zLnksIGNhbWVyYSwgcmF5QikgPyByYXlCIDogbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudChjYW1lcmEsIHJheVNjcmVlbiwgcmF5M2QpO1xuICAgIH1cblxuICAgIF9nZXRUYXJnZXRFbGVtZW50KGNhbWVyYSwgcmF5U2NyZWVuLCByYXkzZCkge1xuICAgICAgICBsZXQgcmVzdWx0ID0gbnVsbDtcbiAgICAgICAgbGV0IGNsb3Nlc3REaXN0YW5jZTNkID0gSW5maW5pdHk7XG5cbiAgICAgICAgLy8gc29ydCBlbGVtZW50cyBiYXNlZCBvbiBsYXllcnMgYW5kIGRyYXcgb3JkZXJcbiAgICAgICAgdGhpcy5fZWxlbWVudHMuc29ydCh0aGlzLl9zb3J0SGFuZGxlcik7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2VsZW1lbnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5fZWxlbWVudHNbaV07XG5cbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIGFueSBvZiB0aGUgbGF5ZXJzIHRoaXMgZWxlbWVudCByZW5kZXJzIHRvIGlzIGJlaW5nIHJlbmRlcmVkIGJ5IHRoZSBjYW1lcmFcbiAgICAgICAgICAgIGlmICghZWxlbWVudC5sYXllcnMuc29tZSh2ID0+IGNhbWVyYS5sYXllcnNTZXQuaGFzKHYpKSkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZWxlbWVudC5zY3JlZW4gJiYgZWxlbWVudC5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFyYXlTY3JlZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gMmQgc2NyZWVuIGVsZW1lbnRzIHRha2UgcHJlY2VkZW5jZSAtIGlmIGhpdCwgaW1tZWRpYXRlbHkgcmV0dXJuXG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudERpc3RhbmNlID0gdGhpcy5fY2hlY2tFbGVtZW50KHJheVNjcmVlbiwgZWxlbWVudCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnREaXN0YW5jZSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFyYXkzZCkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50RGlzdGFuY2UgPSB0aGlzLl9jaGVja0VsZW1lbnQocmF5M2QsIGVsZW1lbnQsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudERpc3RhbmNlID49IDApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gc3RvcmUgdGhlIGNsb3Nlc3Qgb25lIGluIHdvcmxkIHNwYWNlXG4gICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50RGlzdGFuY2UgPCBjbG9zZXN0RGlzdGFuY2UzZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZWxlbWVudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb3Nlc3REaXN0YW5jZTNkID0gY3VycmVudERpc3RhbmNlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIGVsZW1lbnQgaXMgb24gYSBTY3JlZW4sIGl0IHRha2VzIHByZWNlZGVuY2VcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQuc2NyZWVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBlbGVtZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIEluIG1vc3QgY2FzZXMgdGhlIGNvcm5lcnMgdXNlZCBmb3IgaGl0IHRlc3Rpbmcgd2lsbCBqdXN0IGJlIHRoZSBlbGVtZW50J3NcbiAgICAvLyBzY3JlZW4gY29ybmVycy4gSG93ZXZlciwgaW4gY2FzZXMgd2hlcmUgdGhlIGVsZW1lbnQgaGFzIGFkZGl0aW9uYWwgaGl0XG4gICAgLy8gcGFkZGluZyBzcGVjaWZpZWQsIHdlIG5lZWQgdG8gZXhwYW5kIHRoZSBzY3JlZW5Db3JuZXJzIHRvIGluY29ycG9yYXRlIHRoZVxuICAgIC8vIHBhZGRpbmcuXG4gICAgX2J1aWxkSGl0Q29ybmVycyhlbGVtZW50LCBzY3JlZW5PcldvcmxkQ29ybmVycywgc2NhbGVYLCBzY2FsZVksIHNjYWxlWikge1xuICAgICAgICBsZXQgaGl0Q29ybmVycyA9IHNjcmVlbk9yV29ybGRDb3JuZXJzO1xuICAgICAgICBjb25zdCBidXR0b24gPSBlbGVtZW50LmVudGl0eSAmJiBlbGVtZW50LmVudGl0eS5idXR0b247XG5cbiAgICAgICAgaWYgKGJ1dHRvbikge1xuICAgICAgICAgICAgY29uc3QgaGl0UGFkZGluZyA9IGVsZW1lbnQuZW50aXR5LmJ1dHRvbi5oaXRQYWRkaW5nIHx8IFpFUk9fVkVDNDtcblxuICAgICAgICAgICAgX3BhZGRpbmdUb3AuY29weShlbGVtZW50LmVudGl0eS51cCk7XG4gICAgICAgICAgICBfcGFkZGluZ0JvdHRvbS5jb3B5KF9wYWRkaW5nVG9wKS5tdWxTY2FsYXIoLTEpO1xuICAgICAgICAgICAgX3BhZGRpbmdSaWdodC5jb3B5KGVsZW1lbnQuZW50aXR5LnJpZ2h0KTtcbiAgICAgICAgICAgIF9wYWRkaW5nTGVmdC5jb3B5KF9wYWRkaW5nUmlnaHQpLm11bFNjYWxhcigtMSk7XG5cbiAgICAgICAgICAgIF9wYWRkaW5nVG9wLm11bFNjYWxhcihoaXRQYWRkaW5nLncgKiBzY2FsZVkpO1xuICAgICAgICAgICAgX3BhZGRpbmdCb3R0b20ubXVsU2NhbGFyKGhpdFBhZGRpbmcueSAqIHNjYWxlWSk7XG4gICAgICAgICAgICBfcGFkZGluZ1JpZ2h0Lm11bFNjYWxhcihoaXRQYWRkaW5nLnogKiBzY2FsZVgpO1xuICAgICAgICAgICAgX3BhZGRpbmdMZWZ0Lm11bFNjYWxhcihoaXRQYWRkaW5nLnggKiBzY2FsZVgpO1xuXG4gICAgICAgICAgICBfY29ybmVyQm90dG9tTGVmdC5jb3B5KGhpdENvcm5lcnNbMF0pLmFkZChfcGFkZGluZ0JvdHRvbSkuYWRkKF9wYWRkaW5nTGVmdCk7XG4gICAgICAgICAgICBfY29ybmVyQm90dG9tUmlnaHQuY29weShoaXRDb3JuZXJzWzFdKS5hZGQoX3BhZGRpbmdCb3R0b20pLmFkZChfcGFkZGluZ1JpZ2h0KTtcbiAgICAgICAgICAgIF9jb3JuZXJUb3BSaWdodC5jb3B5KGhpdENvcm5lcnNbMl0pLmFkZChfcGFkZGluZ1RvcCkuYWRkKF9wYWRkaW5nUmlnaHQpO1xuICAgICAgICAgICAgX2Nvcm5lclRvcExlZnQuY29weShoaXRDb3JuZXJzWzNdKS5hZGQoX3BhZGRpbmdUb3ApLmFkZChfcGFkZGluZ0xlZnQpO1xuXG4gICAgICAgICAgICBoaXRDb3JuZXJzID0gW19jb3JuZXJCb3R0b21MZWZ0LCBfY29ybmVyQm90dG9tUmlnaHQsIF9jb3JuZXJUb3BSaWdodCwgX2Nvcm5lclRvcExlZnRdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIHRoZSBjb3JuZXJzIGFyZSBpbiB0aGUgcmlnaHQgb3JkZXIgW2JsLCBiciwgdHIsIHRsXVxuICAgICAgICAvLyBmb3IgeCBhbmQgeTogc2ltcGx5IGludmVydCB3aGF0IGlzIGNvbnNpZGVyZWQgXCJsZWZ0L3JpZ2h0XCIgYW5kIFwidG9wL2JvdHRvbVwiXG4gICAgICAgIGlmIChzY2FsZVggPCAwKSB7XG4gICAgICAgICAgICBjb25zdCBsZWZ0ID0gaGl0Q29ybmVyc1syXS54O1xuICAgICAgICAgICAgY29uc3QgcmlnaHQgPSBoaXRDb3JuZXJzWzBdLng7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzBdLnggPSBsZWZ0O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1sxXS54ID0gcmlnaHQ7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzJdLnggPSByaWdodDtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbM10ueCA9IGxlZnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNjYWxlWSA8IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGJvdHRvbSA9IGhpdENvcm5lcnNbMl0ueTtcbiAgICAgICAgICAgIGNvbnN0IHRvcCA9IGhpdENvcm5lcnNbMF0ueTtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMF0ueSA9IGJvdHRvbTtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMV0ueSA9IGJvdHRvbTtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMl0ueSA9IHRvcDtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbM10ueSA9IHRvcDtcbiAgICAgICAgfVxuICAgICAgICAvLyBpZiB6IGlzIGludmVydGVkLCBlbnRpcmUgZWxlbWVudCBpcyBpbnZlcnRlZCwgc28gZmxpcCBpdCBhcm91bmQgYnkgc3dhcHBpbmcgY29ybmVyIHBvaW50cyAyIGFuZCAwXG4gICAgICAgIGlmIChzY2FsZVogPCAwKSB7XG4gICAgICAgICAgICBjb25zdCB4ID0gaGl0Q29ybmVyc1syXS54O1xuICAgICAgICAgICAgY29uc3QgeSA9IGhpdENvcm5lcnNbMl0ueTtcbiAgICAgICAgICAgIGNvbnN0IHogPSBoaXRDb3JuZXJzWzJdLno7XG5cbiAgICAgICAgICAgIGhpdENvcm5lcnNbMl0ueCA9IGhpdENvcm5lcnNbMF0ueDtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMl0ueSA9IGhpdENvcm5lcnNbMF0ueTtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMl0ueiA9IGhpdENvcm5lcnNbMF0uejtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMF0ueCA9IHg7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzBdLnkgPSB5O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1swXS56ID0gejtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBoaXRDb3JuZXJzO1xuICAgIH1cblxuICAgIF9jYWxjdWxhdGVTY2FsZVRvU2NyZWVuKGVsZW1lbnQpIHtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBlbGVtZW50LmVudGl0eTtcbiAgICAgICAgY29uc3Qgc2NyZWVuU2NhbGUgPSBlbGVtZW50LnNjcmVlbi5zY3JlZW4uc2NhbGU7XG5cbiAgICAgICAgX2FjY3VtdWxhdGVkU2NhbGUuc2V0KHNjcmVlblNjYWxlLCBzY3JlZW5TY2FsZSwgc2NyZWVuU2NhbGUpO1xuXG4gICAgICAgIHdoaWxlIChjdXJyZW50ICYmICFjdXJyZW50LnNjcmVlbikge1xuICAgICAgICAgICAgX2FjY3VtdWxhdGVkU2NhbGUubXVsKGN1cnJlbnQuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfYWNjdW11bGF0ZWRTY2FsZTtcbiAgICB9XG5cbiAgICBfY2FsY3VsYXRlU2NhbGVUb1dvcmxkKGVsZW1lbnQpIHtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBlbGVtZW50LmVudGl0eTtcbiAgICAgICAgX2FjY3VtdWxhdGVkU2NhbGUuc2V0KDEsIDEsIDEpO1xuXG4gICAgICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICAgICAgICBfYWNjdW11bGF0ZWRTY2FsZS5tdWwoY3VycmVudC5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9hY2N1bXVsYXRlZFNjYWxlO1xuICAgIH1cblxuICAgIF9jYWxjdWxhdGVSYXlTY3JlZW4oeCwgeSwgY2FtZXJhLCByYXkpIHtcbiAgICAgICAgY29uc3Qgc3cgPSB0aGlzLmFwcC5ncmFwaGljc0RldmljZS53aWR0aDtcbiAgICAgICAgY29uc3Qgc2ggPSB0aGlzLmFwcC5ncmFwaGljc0RldmljZS5oZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgY2FtZXJhV2lkdGggPSBjYW1lcmEucmVjdC56ICogc3c7XG4gICAgICAgIGNvbnN0IGNhbWVyYUhlaWdodCA9IGNhbWVyYS5yZWN0LncgKiBzaDtcbiAgICAgICAgY29uc3QgY2FtZXJhTGVmdCA9IGNhbWVyYS5yZWN0LnggKiBzdztcbiAgICAgICAgY29uc3QgY2FtZXJhUmlnaHQgPSBjYW1lcmFMZWZ0ICsgY2FtZXJhV2lkdGg7XG4gICAgICAgIC8vIGNhbWVyYSBib3R0b20gKG9yaWdpbiBpcyBib3R0b20gbGVmdCBvZiB3aW5kb3cpXG4gICAgICAgIGNvbnN0IGNhbWVyYUJvdHRvbSA9ICgxIC0gY2FtZXJhLnJlY3QueSkgKiBzaDtcbiAgICAgICAgY29uc3QgY2FtZXJhVG9wID0gY2FtZXJhQm90dG9tIC0gY2FtZXJhSGVpZ2h0O1xuXG4gICAgICAgIGxldCBfeCA9IHggKiBzdyAvIHRoaXMuX3RhcmdldC5jbGllbnRXaWR0aDtcbiAgICAgICAgbGV0IF95ID0geSAqIHNoIC8gdGhpcy5fdGFyZ2V0LmNsaWVudEhlaWdodDtcblxuICAgICAgICBpZiAoX3ggPj0gY2FtZXJhTGVmdCAmJiBfeCA8PSBjYW1lcmFSaWdodCAmJlxuICAgICAgICAgICAgX3kgPD0gY2FtZXJhQm90dG9tICYmIF95ID49IGNhbWVyYVRvcCkge1xuXG4gICAgICAgICAgICAvLyBsaW1pdCB3aW5kb3cgY29vcmRzIHRvIGNhbWVyYSByZWN0IGNvb3Jkc1xuICAgICAgICAgICAgX3ggPSBzdyAqIChfeCAtIGNhbWVyYUxlZnQpIC8gY2FtZXJhV2lkdGg7XG4gICAgICAgICAgICBfeSA9IHNoICogKF95IC0gY2FtZXJhVG9wKSAvIGNhbWVyYUhlaWdodDtcblxuICAgICAgICAgICAgLy8gcmV2ZXJzZSBfeVxuICAgICAgICAgICAgX3kgPSBzaCAtIF95O1xuXG4gICAgICAgICAgICByYXkub3JpZ2luLnNldChfeCwgX3ksIDEpO1xuICAgICAgICAgICAgcmF5LmRpcmVjdGlvbi5zZXQoMCwgMCwgLTEpO1xuICAgICAgICAgICAgcmF5LmVuZC5jb3B5KHJheS5kaXJlY3Rpb24pLm11bFNjYWxhcigyKS5hZGQocmF5Lm9yaWdpbik7XG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfY2FsY3VsYXRlUmF5M2QoeCwgeSwgY2FtZXJhLCByYXkpIHtcbiAgICAgICAgY29uc3Qgc3cgPSB0aGlzLl90YXJnZXQuY2xpZW50V2lkdGg7XG4gICAgICAgIGNvbnN0IHNoID0gdGhpcy5fdGFyZ2V0LmNsaWVudEhlaWdodDtcblxuICAgICAgICBjb25zdCBjYW1lcmFXaWR0aCA9IGNhbWVyYS5yZWN0LnogKiBzdztcbiAgICAgICAgY29uc3QgY2FtZXJhSGVpZ2h0ID0gY2FtZXJhLnJlY3QudyAqIHNoO1xuICAgICAgICBjb25zdCBjYW1lcmFMZWZ0ID0gY2FtZXJhLnJlY3QueCAqIHN3O1xuICAgICAgICBjb25zdCBjYW1lcmFSaWdodCA9IGNhbWVyYUxlZnQgKyBjYW1lcmFXaWR0aDtcbiAgICAgICAgLy8gY2FtZXJhIGJvdHRvbSAtIG9yaWdpbiBpcyBib3R0b20gbGVmdCBvZiB3aW5kb3dcbiAgICAgICAgY29uc3QgY2FtZXJhQm90dG9tID0gKDEgLSBjYW1lcmEucmVjdC55KSAqIHNoO1xuICAgICAgICBjb25zdCBjYW1lcmFUb3AgPSBjYW1lcmFCb3R0b20gLSBjYW1lcmFIZWlnaHQ7XG5cbiAgICAgICAgbGV0IF94ID0geDtcbiAgICAgICAgbGV0IF95ID0geTtcblxuICAgICAgICAvLyBjaGVjayB3aW5kb3cgY29vcmRzIGFyZSB3aXRoaW4gY2FtZXJhIHJlY3RcbiAgICAgICAgaWYgKHggPj0gY2FtZXJhTGVmdCAmJiB4IDw9IGNhbWVyYVJpZ2h0ICYmXG4gICAgICAgICAgICB5IDw9IGNhbWVyYUJvdHRvbSAmJiBfeSA+PSBjYW1lcmFUb3ApIHtcblxuICAgICAgICAgICAgLy8gbGltaXQgd2luZG93IGNvb3JkcyB0byBjYW1lcmEgcmVjdCBjb29yZHNcbiAgICAgICAgICAgIF94ID0gc3cgKiAoX3ggLSBjYW1lcmFMZWZ0KSAvIGNhbWVyYVdpZHRoO1xuICAgICAgICAgICAgX3kgPSBzaCAqIChfeSAtIChjYW1lcmFUb3ApKSAvIGNhbWVyYUhlaWdodDtcblxuICAgICAgICAgICAgLy8gM0Qgc2NyZWVuXG4gICAgICAgICAgICBjYW1lcmEuc2NyZWVuVG9Xb3JsZChfeCwgX3ksIGNhbWVyYS5uZWFyQ2xpcCwgdmVjQSk7XG4gICAgICAgICAgICBjYW1lcmEuc2NyZWVuVG9Xb3JsZChfeCwgX3ksIGNhbWVyYS5mYXJDbGlwLCB2ZWNCKTtcblxuICAgICAgICAgICAgcmF5Lm9yaWdpbi5jb3B5KHZlY0EpO1xuICAgICAgICAgICAgcmF5LmRpcmVjdGlvbi5zZXQoMCwgMCwgLTEpO1xuICAgICAgICAgICAgcmF5LmVuZC5jb3B5KHZlY0IpO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2NoZWNrRWxlbWVudChyYXksIGVsZW1lbnQsIHNjcmVlbikge1xuICAgICAgICAvLyBlbnN1cmUgY2xpY2sgaXMgY29udGFpbmVkIGJ5IGFueSBtYXNrIGZpcnN0XG4gICAgICAgIGlmIChlbGVtZW50Lm1hc2tlZEJ5KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2hlY2tFbGVtZW50KHJheSwgZWxlbWVudC5tYXNrZWRCeS5lbGVtZW50LCBzY3JlZW4pIDwgMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzY2FsZTtcbiAgICAgICAgaWYgKHNjcmVlbikge1xuICAgICAgICAgICAgc2NhbGUgPSB0aGlzLl9jYWxjdWxhdGVTY2FsZVRvU2NyZWVuKGVsZW1lbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2NhbGUgPSB0aGlzLl9jYWxjdWxhdGVTY2FsZVRvV29ybGQoZWxlbWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb3JuZXJzID0gdGhpcy5fYnVpbGRIaXRDb3JuZXJzKGVsZW1lbnQsIHNjcmVlbiA/IGVsZW1lbnQuc2NyZWVuQ29ybmVycyA6IGVsZW1lbnQud29ybGRDb3JuZXJzLCBzY2FsZS54LCBzY2FsZS55LCBzY2FsZS56KTtcblxuICAgICAgICByZXR1cm4gaW50ZXJzZWN0TGluZVF1YWQocmF5Lm9yaWdpbiwgcmF5LmVuZCwgY29ybmVycyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBFbGVtZW50SW5wdXQsIEVsZW1lbnRJbnB1dEV2ZW50LCBFbGVtZW50TW91c2VFdmVudCwgRWxlbWVudFNlbGVjdEV2ZW50LCBFbGVtZW50VG91Y2hFdmVudCB9O1xuIl0sIm5hbWVzIjpbInRhcmdldFgiLCJ0YXJnZXRZIiwidmVjQSIsIlZlYzMiLCJ2ZWNCIiwicmF5QSIsIlJheSIsInJheUIiLCJyYXlDIiwiZW5kIiwiX3BxIiwiX3BhIiwiX3BiIiwiX3BjIiwiX3BkIiwiX20iLCJfYXUiLCJfYnYiLCJfY3ciLCJfaXIiLCJfc2N0IiwiX2FjY3VtdWxhdGVkU2NhbGUiLCJfcGFkZGluZ1RvcCIsIl9wYWRkaW5nQm90dG9tIiwiX3BhZGRpbmdMZWZ0IiwiX3BhZGRpbmdSaWdodCIsIl9jb3JuZXJCb3R0b21MZWZ0IiwiX2Nvcm5lckJvdHRvbVJpZ2h0IiwiX2Nvcm5lclRvcFJpZ2h0IiwiX2Nvcm5lclRvcExlZnQiLCJaRVJPX1ZFQzQiLCJWZWM0Iiwic2NhbGFyVHJpcGxlIiwicDEiLCJwMiIsInAzIiwiY3Jvc3MiLCJkb3QiLCJpbnRlcnNlY3RMaW5lUXVhZCIsInAiLCJxIiwiY29ybmVycyIsInN1YjIiLCJ2IiwidSIsInciLCJkZW5vbSIsImNvcHkiLCJtdWxTY2FsYXIiLCJhZGQiLCJsZW5ndGhTcSIsInN1YiIsIkVsZW1lbnRJbnB1dEV2ZW50IiwiY29uc3RydWN0b3IiLCJldmVudCIsImVsZW1lbnQiLCJjYW1lcmEiLCJfc3RvcFByb3BhZ2F0aW9uIiwic3RvcFByb3BhZ2F0aW9uIiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwiRWxlbWVudE1vdXNlRXZlbnQiLCJ4IiwieSIsImxhc3RYIiwibGFzdFkiLCJjdHJsS2V5IiwiYWx0S2V5Iiwic2hpZnRLZXkiLCJtZXRhS2V5IiwiYnV0dG9uIiwiTW91c2UiLCJpc1BvaW50ZXJMb2NrZWQiLCJkeCIsIm1vdmVtZW50WCIsIndlYmtpdE1vdmVtZW50WCIsIm1vek1vdmVtZW50WCIsImR5IiwibW92ZW1lbnRZIiwid2Via2l0TW92ZW1lbnRZIiwibW96TW92ZW1lbnRZIiwid2hlZWxEZWx0YSIsInR5cGUiLCJkZWx0YVkiLCJFbGVtZW50VG91Y2hFdmVudCIsInRvdWNoIiwidG91Y2hlcyIsImNoYW5nZWRUb3VjaGVzIiwiRWxlbWVudFNlbGVjdEV2ZW50IiwiaW5wdXRTb3VyY2UiLCJFbGVtZW50SW5wdXQiLCJkb21FbGVtZW50Iiwib3B0aW9ucyIsIl9hcHAiLCJfYXR0YWNoZWQiLCJfdGFyZ2V0IiwiX2VuYWJsZWQiLCJfbGFzdFgiLCJfbGFzdFkiLCJfdXBIYW5kbGVyIiwiX2hhbmRsZVVwIiwiYmluZCIsIl9kb3duSGFuZGxlciIsIl9oYW5kbGVEb3duIiwiX21vdmVIYW5kbGVyIiwiX2hhbmRsZU1vdmUiLCJfd2hlZWxIYW5kbGVyIiwiX2hhbmRsZVdoZWVsIiwiX3RvdWNoc3RhcnRIYW5kbGVyIiwiX2hhbmRsZVRvdWNoU3RhcnQiLCJfdG91Y2hlbmRIYW5kbGVyIiwiX2hhbmRsZVRvdWNoRW5kIiwiX3RvdWNoY2FuY2VsSGFuZGxlciIsIl90b3VjaG1vdmVIYW5kbGVyIiwiX2hhbmRsZVRvdWNoTW92ZSIsIl9zb3J0SGFuZGxlciIsIl9zb3J0RWxlbWVudHMiLCJfZWxlbWVudHMiLCJfaG92ZXJlZEVsZW1lbnQiLCJfcHJlc3NlZEVsZW1lbnQiLCJfdG91Y2hlZEVsZW1lbnRzIiwiX3RvdWNoZXNGb3JXaGljaFRvdWNoTGVhdmVIYXNGaXJlZCIsIl9zZWxlY3RlZEVsZW1lbnRzIiwiX3NlbGVjdGVkUHJlc3NlZEVsZW1lbnRzIiwiX3VzZU1vdXNlIiwidXNlTW91c2UiLCJfdXNlVG91Y2giLCJ1c2VUb3VjaCIsIl91c2VYciIsInVzZVhyIiwiX3NlbGVjdEV2ZW50c0F0dGFjaGVkIiwicGxhdGZvcm0iLCJfY2xpY2tlZEVudGl0aWVzIiwiYXR0YWNoIiwiZW5hYmxlZCIsInZhbHVlIiwiYXBwIiwiZ2V0QXBwbGljYXRpb24iLCJkZXRhY2giLCJvcHRzIiwicGFzc2l2ZUV2ZW50cyIsInBhc3NpdmUiLCJ3aW5kb3ciLCJhZGRFdmVudExpc3RlbmVyIiwiYXR0YWNoU2VsZWN0RXZlbnRzIiwieHIiLCJzdXBwb3J0ZWQiLCJvbiIsIl9vblhyU3RhcnQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwib2ZmIiwiX29uWHJFbmQiLCJfb25YclVwZGF0ZSIsImlucHV0IiwiX29uU2VsZWN0U3RhcnQiLCJfb25TZWxlY3RFbmQiLCJfb25YcklucHV0UmVtb3ZlIiwiYWRkRWxlbWVudCIsImluZGV4T2YiLCJwdXNoIiwicmVtb3ZlRWxlbWVudCIsImlkeCIsInNwbGljZSIsIl9jYWxjTW91c2VDb29yZHMiLCJfb25FbGVtZW50TW91c2VFdmVudCIsIl9kZXRlcm1pbmVUb3VjaGVkRWxlbWVudHMiLCJ0b3VjaGVkRWxlbWVudHMiLCJjYW1lcmFzIiwic3lzdGVtcyIsImkiLCJsZW5ndGgiLCJkb25lIiwibGVuIiwiaiIsImlkZW50aWZpZXIiLCJjb29yZHMiLCJfY2FsY1RvdWNoQ29vcmRzIiwiX2dldFRhcmdldEVsZW1lbnRCeUNvb3JkcyIsIm5ld1RvdWNoZWRFbGVtZW50cyIsIm5ld1RvdWNoSW5mbyIsIm9sZFRvdWNoSW5mbyIsIl9maXJlRXZlbnQiLCJ0b3VjaElkIiwia2V5IiwidG91Y2hJbmZvIiwiYyIsImhvdmVyZWQiLCJlbnRpdHkiLCJnZXRHdWlkIiwicHJldmVudERlZmF1bHQiLCJldmVudFR5cGUiLCJsYXN0SG92ZXJlZCIsImlucHV0U291cmNlcyIsIl9vbkVsZW1lbnRTZWxlY3RFdmVudCIsImlkIiwiX2VsZW1lbnRFbnRpdHkiLCJob3ZlcmVkQmVmb3JlIiwiaG92ZXJlZE5vdyIsImVsZW1lbnRJbnB1dCIsInNldCIsImdldE9yaWdpbiIsImdldERpcmVjdGlvbiIsIl9nZXRUYXJnZXRFbGVtZW50QnlSYXkiLCJwcmVzc2VkIiwibmFtZSIsImV2dCIsImZpcmUiLCJwYXJlbnQiLCJyZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwibGVmdCIsIk1hdGgiLCJmbG9vciIsInRvcCIsImNsaWVudFgiLCJjbGllbnRZIiwidG90YWxPZmZzZXRYIiwidG90YWxPZmZzZXRZIiwidGFyZ2V0IiwiSFRNTEVsZW1lbnQiLCJwYXJlbnROb2RlIiwiY3VycmVudEVsZW1lbnQiLCJvZmZzZXRMZWZ0Iiwic2Nyb2xsTGVmdCIsIm9mZnNldFRvcCIsInNjcm9sbFRvcCIsIm9mZnNldFBhcmVudCIsInBhZ2VYIiwicGFnZVkiLCJhIiwiYiIsImxheWVyT3JkZXIiLCJzY2VuZSIsImxheWVycyIsInNvcnRUcmFuc3BhcmVudExheWVycyIsInNjcmVlbiIsInNjcmVlblNwYWNlIiwiZHJhd09yZGVyIiwicmF5U2NyZWVuIiwiX2NhbGN1bGF0ZVJheVNjcmVlbiIsInJheTNkIiwiX2NhbGN1bGF0ZVJheTNkIiwiX2dldFRhcmdldEVsZW1lbnQiLCJyYXkiLCJvcmlnaW4iLCJkaXJlY3Rpb24iLCJmYXJDbGlwIiwic2NyZWVuUG9zIiwid29ybGRUb1NjcmVlbiIsInJlc3VsdCIsImNsb3Nlc3REaXN0YW5jZTNkIiwiSW5maW5pdHkiLCJzb3J0Iiwic29tZSIsImxheWVyc1NldCIsImhhcyIsImN1cnJlbnREaXN0YW5jZSIsIl9jaGVja0VsZW1lbnQiLCJfYnVpbGRIaXRDb3JuZXJzIiwic2NyZWVuT3JXb3JsZENvcm5lcnMiLCJzY2FsZVgiLCJzY2FsZVkiLCJzY2FsZVoiLCJoaXRDb3JuZXJzIiwiaGl0UGFkZGluZyIsInVwIiwicmlnaHQiLCJ6IiwiYm90dG9tIiwiX2NhbGN1bGF0ZVNjYWxlVG9TY3JlZW4iLCJjdXJyZW50Iiwic2NyZWVuU2NhbGUiLCJzY2FsZSIsIm11bCIsImdldExvY2FsU2NhbGUiLCJfY2FsY3VsYXRlU2NhbGVUb1dvcmxkIiwic3ciLCJncmFwaGljc0RldmljZSIsIndpZHRoIiwic2giLCJoZWlnaHQiLCJjYW1lcmFXaWR0aCIsImNhbWVyYUhlaWdodCIsImNhbWVyYUxlZnQiLCJjYW1lcmFSaWdodCIsImNhbWVyYUJvdHRvbSIsImNhbWVyYVRvcCIsIl94IiwiY2xpZW50V2lkdGgiLCJfeSIsImNsaWVudEhlaWdodCIsInNjcmVlblRvV29ybGQiLCJuZWFyQ2xpcCIsIm1hc2tlZEJ5Iiwic2NyZWVuQ29ybmVycyIsIndvcmxkQ29ybmVycyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBZUEsSUFBSUEsT0FBSixFQUFhQyxPQUFiLENBQUE7QUFDQSxNQUFNQyxJQUFJLEdBQUcsSUFBSUMsSUFBSixFQUFiLENBQUE7QUFDQSxNQUFNQyxJQUFJLEdBQUcsSUFBSUQsSUFBSixFQUFiLENBQUE7QUFFQSxN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
