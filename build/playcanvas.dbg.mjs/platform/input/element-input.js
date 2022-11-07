/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision 1331860ee (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../../core/platform.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Vec4 } from '../../core/math/vec4.js';
import { Ray } from '../../core/shape/ray.js';
import { getApplication } from '../../framework/globals.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlbWVudC1pbnB1dC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2lucHV0L2VsZW1lbnQtaW5wdXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi9jb3JlL3BsYXRmb3JtLmpzJztcblxuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IFJheSB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvcmF5LmpzJztcblxuaW1wb3J0IHsgZ2V0QXBwbGljYXRpb24gfSBmcm9tICcuLi8uLi9mcmFtZXdvcmsvZ2xvYmFscy5qcyc7XG5cbmltcG9ydCB7IE1vdXNlIH0gZnJvbSAnLi9tb3VzZS5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBDYW1lcmFDb21wb25lbnQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9lbGVtZW50L2NvbXBvbmVudC5qcycpLkVsZW1lbnRDb21wb25lbnR9IEVsZW1lbnRDb21wb25lbnQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsveHIveHItaW5wdXQtc291cmNlLmpzJykuWHJJbnB1dFNvdXJjZX0gWHJJbnB1dFNvdXJjZSAqL1xuXG5sZXQgdGFyZ2V0WCwgdGFyZ2V0WTtcbmNvbnN0IHZlY0EgPSBuZXcgVmVjMygpO1xuY29uc3QgdmVjQiA9IG5ldyBWZWMzKCk7XG5cbmNvbnN0IHJheUEgPSBuZXcgUmF5KCk7XG5jb25zdCByYXlCID0gbmV3IFJheSgpO1xuY29uc3QgcmF5QyA9IG5ldyBSYXkoKTtcblxucmF5QS5lbmQgPSBuZXcgVmVjMygpO1xucmF5Qi5lbmQgPSBuZXcgVmVjMygpO1xucmF5Qy5lbmQgPSBuZXcgVmVjMygpO1xuXG5jb25zdCBfcHEgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BhID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wYiA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGMgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BkID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9tID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9hdSA9IG5ldyBWZWMzKCk7XG5jb25zdCBfYnYgPSBuZXcgVmVjMygpO1xuY29uc3QgX2N3ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9pciA9IG5ldyBWZWMzKCk7XG5jb25zdCBfc2N0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9hY2N1bXVsYXRlZFNjYWxlID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wYWRkaW5nVG9wID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wYWRkaW5nQm90dG9tID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wYWRkaW5nTGVmdCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGFkZGluZ1JpZ2h0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9jb3JuZXJCb3R0b21MZWZ0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9jb3JuZXJCb3R0b21SaWdodCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfY29ybmVyVG9wUmlnaHQgPSBuZXcgVmVjMygpO1xuY29uc3QgX2Nvcm5lclRvcExlZnQgPSBuZXcgVmVjMygpO1xuXG5jb25zdCBaRVJPX1ZFQzQgPSBuZXcgVmVjNCgpO1xuXG4vLyBwaSB4IHAyICogcDNcbmZ1bmN0aW9uIHNjYWxhclRyaXBsZShwMSwgcDIsIHAzKSB7XG4gICAgcmV0dXJuIF9zY3QuY3Jvc3MocDEsIHAyKS5kb3QocDMpO1xufVxuXG4vLyBHaXZlbiBsaW5lIHBxIGFuZCBjY3cgY29ybmVycyBvZiBhIHF1YWQsIHJldHVybiB0aGUgc3F1YXJlIGRpc3RhbmNlIHRvIHRoZSBpbnRlcnNlY3Rpb24gcG9pbnQuXG4vLyBJZiB0aGUgbGluZSBhbmQgcXVhZCBkbyBub3QgaW50ZXJzZWN0LCByZXR1cm4gLTEuIChmcm9tIFJlYWwtVGltZSBDb2xsaXNpb24gRGV0ZWN0aW9uIGJvb2spXG5mdW5jdGlvbiBpbnRlcnNlY3RMaW5lUXVhZChwLCBxLCBjb3JuZXJzKSB7XG4gICAgX3BxLnN1YjIocSwgcCk7XG4gICAgX3BhLnN1YjIoY29ybmVyc1swXSwgcCk7XG4gICAgX3BiLnN1YjIoY29ybmVyc1sxXSwgcCk7XG4gICAgX3BjLnN1YjIoY29ybmVyc1syXSwgcCk7XG5cbiAgICAvLyBEZXRlcm1pbmUgd2hpY2ggdHJpYW5nbGUgdG8gdGVzdCBhZ2FpbnN0IGJ5IHRlc3RpbmcgYWdhaW5zdCBkaWFnb25hbCBmaXJzdFxuICAgIF9tLmNyb3NzKF9wYywgX3BxKTtcbiAgICBsZXQgdiA9IF9wYS5kb3QoX20pO1xuICAgIGxldCB1O1xuICAgIGxldCB3O1xuXG4gICAgaWYgKHYgPj0gMCkge1xuICAgICAgICAvLyBUZXN0IGludGVyc2VjdGlvbiBhZ2FpbnN0IHRyaWFuZ2xlIGFiY1xuICAgICAgICB1ID0gLV9wYi5kb3QoX20pO1xuICAgICAgICBpZiAodSA8IDApXG4gICAgICAgICAgICByZXR1cm4gLTE7XG5cbiAgICAgICAgdyA9IHNjYWxhclRyaXBsZShfcHEsIF9wYiwgX3BhKTtcbiAgICAgICAgaWYgKHcgPCAwKVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuXG4gICAgICAgIGNvbnN0IGRlbm9tID0gMS4wIC8gKHUgKyB2ICsgdyk7XG5cbiAgICAgICAgX2F1LmNvcHkoY29ybmVyc1swXSkubXVsU2NhbGFyKHUgKiBkZW5vbSk7XG4gICAgICAgIF9idi5jb3B5KGNvcm5lcnNbMV0pLm11bFNjYWxhcih2ICogZGVub20pO1xuICAgICAgICBfY3cuY29weShjb3JuZXJzWzJdKS5tdWxTY2FsYXIodyAqIGRlbm9tKTtcbiAgICAgICAgX2lyLmNvcHkoX2F1KS5hZGQoX2J2KS5hZGQoX2N3KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUZXN0IGludGVyc2VjdGlvbiBhZ2FpbnN0IHRyaWFuZ2xlIGRhY1xuICAgICAgICBfcGQuc3ViMihjb3JuZXJzWzNdLCBwKTtcbiAgICAgICAgdSA9IF9wZC5kb3QoX20pO1xuICAgICAgICBpZiAodSA8IDApXG4gICAgICAgICAgICByZXR1cm4gLTE7XG5cbiAgICAgICAgdyA9IHNjYWxhclRyaXBsZShfcHEsIF9wYSwgX3BkKTtcbiAgICAgICAgaWYgKHcgPCAwKVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuXG4gICAgICAgIHYgPSAtdjtcblxuICAgICAgICBjb25zdCBkZW5vbSA9IDEuMCAvICh1ICsgdiArIHcpO1xuXG4gICAgICAgIF9hdS5jb3B5KGNvcm5lcnNbMF0pLm11bFNjYWxhcih1ICogZGVub20pO1xuICAgICAgICBfYnYuY29weShjb3JuZXJzWzNdKS5tdWxTY2FsYXIodiAqIGRlbm9tKTtcbiAgICAgICAgX2N3LmNvcHkoY29ybmVyc1syXSkubXVsU2NhbGFyKHcgKiBkZW5vbSk7XG4gICAgICAgIF9pci5jb3B5KF9hdSkuYWRkKF9idikuYWRkKF9jdyk7XG4gICAgfVxuXG4gICAgLy8gVGhlIGFsZ29yaXRobSBhYm92ZSBkb2Vzbid0IHdvcmsgaWYgYWxsIHRoZSBjb3JuZXJzIGFyZSB0aGUgc2FtZVxuICAgIC8vIFNvIGRvIHRoYXQgdGVzdCBoZXJlIGJ5IGNoZWNraW5nIGlmIHRoZSBkaWFnb25hbHMgYXJlIDAgKHNpbmNlIHRoZXNlIGFyZSByZWN0YW5nbGVzIHdlJ3JlIGNoZWNraW5nIGFnYWluc3QpXG4gICAgaWYgKF9wcS5zdWIyKGNvcm5lcnNbMF0sIGNvcm5lcnNbMl0pLmxlbmd0aFNxKCkgPCAwLjAwMDEgKiAwLjAwMDEpIHJldHVybiAtMTtcbiAgICBpZiAoX3BxLnN1YjIoY29ybmVyc1sxXSwgY29ybmVyc1szXSkubGVuZ3RoU3EoKSA8IDAuMDAwMSAqIDAuMDAwMSkgcmV0dXJuIC0xO1xuXG4gICAgcmV0dXJuIF9pci5zdWIocCkubGVuZ3RoU3EoKTtcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGlucHV0IGV2ZW50IGZpcmVkIG9uIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9LiBXaGVuIGFuIGV2ZW50IGlzIHJhaXNlZCBvbiBhblxuICogRWxlbWVudENvbXBvbmVudCBpdCBidWJibGVzIHVwIHRvIGl0cyBwYXJlbnQgRWxlbWVudENvbXBvbmVudHMgdW5sZXNzIHdlIGNhbGwgc3RvcFByb3BhZ2F0aW9uKCkuXG4gKi9cbmNsYXNzIEVsZW1lbnRJbnB1dEV2ZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgRWxlbWVudElucHV0RXZlbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01vdXNlRXZlbnR8VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgTW91c2VFdmVudCBvciBUb3VjaEV2ZW50IHRoYXQgd2FzIG9yaWdpbmFsbHlcbiAgICAgKiByYWlzZWQuXG4gICAgICogQHBhcmFtIHtFbGVtZW50Q29tcG9uZW50fSBlbGVtZW50IC0gVGhlIEVsZW1lbnRDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5XG4gICAgICogcmFpc2VkIG9uLlxuICAgICAqIEBwYXJhbSB7Q2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBUaGUgQ2FtZXJhQ29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWRcbiAgICAgKiB2aWEuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIE1vdXNlRXZlbnQgb3IgVG91Y2hFdmVudCB0aGF0IHdhcyBvcmlnaW5hbGx5IHJhaXNlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge01vdXNlRXZlbnR8VG91Y2hFdmVudH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZXZlbnQgPSBldmVudDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIEVsZW1lbnRDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZCBvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VsZW1lbnRDb21wb25lbnR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgQ2FtZXJhQ29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWQgdmlhLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Q2FtZXJhQ29tcG9uZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jYW1lcmEgPSBjYW1lcmE7XG5cbiAgICAgICAgdGhpcy5fc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcCBwcm9wYWdhdGlvbiBvZiB0aGUgZXZlbnQgdG8gcGFyZW50IHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuIFRoaXMgYWxzbyBzdG9wc1xuICAgICAqIHByb3BhZ2F0aW9uIG9mIHRoZSBldmVudCB0byBvdGhlciBldmVudCBsaXN0ZW5lcnMgb2YgdGhlIG9yaWdpbmFsIERPTSBFdmVudC5cbiAgICAgKi9cbiAgICBzdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgICAgIHRoaXMuX3N0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50KSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5ldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgTW91c2UgZXZlbnQgZmlyZWQgb24gYSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0uXG4gKlxuICogQGF1Z21lbnRzIEVsZW1lbnRJbnB1dEV2ZW50XG4gKi9cbmNsYXNzIEVsZW1lbnRNb3VzZUV2ZW50IGV4dGVuZHMgRWxlbWVudElucHV0RXZlbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBhbiBFbGVtZW50TW91c2VFdmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgTW91c2VFdmVudCB0aGF0IHdhcyBvcmlnaW5hbGx5IHJhaXNlZC5cbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRDb21wb25lbnR9IGVsZW1lbnQgLSBUaGUgRWxlbWVudENvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHlcbiAgICAgKiByYWlzZWQgb24uXG4gICAgICogQHBhcmFtIHtDYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIFRoZSBDYW1lcmFDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZFxuICAgICAqIHZpYS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsYXN0WCAtIFRoZSBsYXN0IHggY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGFzdFkgLSBUaGUgbGFzdCB5IGNvb3JkaW5hdGUuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSwgeCwgeSwgbGFzdFgsIGxhc3RZKSB7XG4gICAgICAgIHN1cGVyKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEpO1xuXG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdoZXRoZXIgdGhlIGN0cmwga2V5IHdhcyBwcmVzc2VkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY3RybEtleSA9IGV2ZW50LmN0cmxLZXkgfHwgZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGV0aGVyIHRoZSBhbHQga2V5IHdhcyBwcmVzc2VkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYWx0S2V5ID0gZXZlbnQuYWx0S2V5IHx8IGZhbHNlO1xuICAgICAgICAvKipcbiAgICAgICAgICogV2hldGhlciB0aGUgc2hpZnQga2V5IHdhcyBwcmVzc2VkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2hpZnRLZXkgPSBldmVudC5zaGlmdEtleSB8fCBmYWxzZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdoZXRoZXIgdGhlIG1ldGEga2V5IHdhcyBwcmVzc2VkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWV0YUtleSA9IGV2ZW50Lm1ldGFLZXkgfHwgZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBtb3VzZSBidXR0b24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmJ1dHRvbiA9IGV2ZW50LmJ1dHRvbjtcblxuICAgICAgICBpZiAoTW91c2UuaXNQb2ludGVyTG9ja2VkKCkpIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGFtb3VudCBvZiBob3Jpem9udGFsIG1vdmVtZW50IG9mIHRoZSBjdXJzb3IuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5keCA9IGV2ZW50Lm1vdmVtZW50WCB8fCBldmVudC53ZWJraXRNb3ZlbWVudFggfHwgZXZlbnQubW96TW92ZW1lbnRYIHx8IDA7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBhbW91bnQgb2YgdmVydGljYWwgbW92ZW1lbnQgb2YgdGhlIGN1cnNvci5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmR5ID0gZXZlbnQubW92ZW1lbnRZIHx8IGV2ZW50LndlYmtpdE1vdmVtZW50WSB8fCBldmVudC5tb3pNb3ZlbWVudFkgfHwgMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZHggPSB4IC0gbGFzdFg7XG4gICAgICAgICAgICB0aGlzLmR5ID0geSAtIGxhc3RZO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhbW91bnQgb2YgdGhlIHdoZWVsIG1vdmVtZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy53aGVlbERlbHRhID0gMDtcblxuICAgICAgICAvLyBkZWx0YVkgaXMgaW4gYSBkaWZmZXJlbnQgcmFuZ2UgYWNyb3NzIGRpZmZlcmVudCBicm93c2Vycy4gVGhlIG9ubHkgdGhpbmdcbiAgICAgICAgLy8gdGhhdCBpcyBjb25zaXN0ZW50IGlzIHRoZSBzaWduIG9mIHRoZSB2YWx1ZSBzbyBzbmFwIHRvIC0xLysxLlxuICAgICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ3doZWVsJykge1xuICAgICAgICAgICAgaWYgKGV2ZW50LmRlbHRhWSA+IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndoZWVsRGVsdGEgPSAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChldmVudC5kZWx0YVkgPCAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy53aGVlbERlbHRhID0gLTE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIFRvdWNoRXZlbnQgZmlyZWQgb24gYSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0uXG4gKlxuICogQGF1Z21lbnRzIEVsZW1lbnRJbnB1dEV2ZW50XG4gKi9cbmNsYXNzIEVsZW1lbnRUb3VjaEV2ZW50IGV4dGVuZHMgRWxlbWVudElucHV0RXZlbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBhbiBFbGVtZW50VG91Y2hFdmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgVG91Y2hFdmVudCB0aGF0IHdhcyBvcmlnaW5hbGx5IHJhaXNlZC5cbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRDb21wb25lbnR9IGVsZW1lbnQgLSBUaGUgRWxlbWVudENvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHlcbiAgICAgKiByYWlzZWQgb24uXG4gICAgICogQHBhcmFtIHtDYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIFRoZSBDYW1lcmFDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZFxuICAgICAqIHZpYS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvb3JkaW5hdGUgb2YgdGhlIHRvdWNoIHRoYXQgdHJpZ2dlcmVkIHRoZSBldmVudC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGUgb2YgdGhlIHRvdWNoIHRoYXQgdHJpZ2dlcmVkIHRoZSBldmVudC5cbiAgICAgKiBAcGFyYW0ge1RvdWNofSB0b3VjaCAtIFRoZSB0b3VjaCBvYmplY3QgdGhhdCB0cmlnZ2VyZWQgdGhlIGV2ZW50LlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIHgsIHksIHRvdWNoKSB7XG4gICAgICAgIHN1cGVyKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgVG91Y2ggb2JqZWN0cyByZXByZXNlbnRpbmcgYWxsIGN1cnJlbnQgcG9pbnRzIG9mIGNvbnRhY3Qgd2l0aCB0aGUgc3VyZmFjZSxcbiAgICAgICAgICogcmVnYXJkbGVzcyBvZiB0YXJnZXQgb3IgY2hhbmdlZCBzdGF0dXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUb3VjaFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50b3VjaGVzID0gZXZlbnQudG91Y2hlcztcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBUb3VjaCBvYmplY3RzIHJlcHJlc2VudGluZyBpbmRpdmlkdWFsIHBvaW50cyBvZiBjb250YWN0IHdob3NlIHN0YXRlcyBjaGFuZ2VkIGJldHdlZW5cbiAgICAgICAgICogdGhlIHByZXZpb3VzIHRvdWNoIGV2ZW50IGFuZCB0aGlzIG9uZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1RvdWNoW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNoYW5nZWRUb3VjaGVzID0gZXZlbnQuY2hhbmdlZFRvdWNoZXM7XG4gICAgICAgIHRoaXMueCA9IHg7XG4gICAgICAgIHRoaXMueSA9IHk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG91Y2ggb2JqZWN0IHRoYXQgdHJpZ2dlcmVkIHRoZSBldmVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1RvdWNofVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50b3VjaCA9IHRvdWNoO1xuICAgIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgWFJJbnB1dFNvdXJjZUV2ZW50IGZpcmVkIG9uIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9LlxuICpcbiAqIEBhdWdtZW50cyBFbGVtZW50SW5wdXRFdmVudFxuICovXG5jbGFzcyBFbGVtZW50U2VsZWN0RXZlbnQgZXh0ZW5kcyBFbGVtZW50SW5wdXRFdmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIGluc3RhbmNlIG9mIGEgRWxlbWVudFNlbGVjdEV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGV2ZW50IC0gVGhlIFhSSW5wdXRTb3VyY2VFdmVudCB0aGF0IHdhcyBvcmlnaW5hbGx5IHJhaXNlZC5cbiAgICAgKiBAcGFyYW0ge0VsZW1lbnRDb21wb25lbnR9IGVsZW1lbnQgLSBUaGUgRWxlbWVudENvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHlcbiAgICAgKiByYWlzZWQgb24uXG4gICAgICogQHBhcmFtIHtDYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIFRoZSBDYW1lcmFDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZFxuICAgICAqIHZpYS5cbiAgICAgKiBAcGFyYW0ge1hySW5wdXRTb3VyY2V9IGlucHV0U291cmNlIC0gVGhlIFhSIGlucHV0IHNvdXJjZSB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHlcbiAgICAgKiByYWlzZWQgZnJvbS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihldmVudCwgZWxlbWVudCwgY2FtZXJhLCBpbnB1dFNvdXJjZSkge1xuICAgICAgICBzdXBlcihldmVudCwgZWxlbWVudCwgY2FtZXJhKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFhSIGlucHV0IHNvdXJjZSB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkIGZyb20uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtYcklucHV0U291cmNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbnB1dFNvdXJjZSA9IGlucHV0U291cmNlO1xuICAgIH1cbn1cblxuLyoqXG4gKiBIYW5kbGVzIG1vdXNlIGFuZCB0b3VjaCBldmVudHMgZm9yIHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuIFdoZW4gaW5wdXQgZXZlbnRzIG9jY3VyIG9uIGFuXG4gKiBFbGVtZW50Q29tcG9uZW50IHRoaXMgZmlyZXMgdGhlIGFwcHJvcHJpYXRlIGV2ZW50cyBvbiB0aGUgRWxlbWVudENvbXBvbmVudC5cbiAqL1xuY2xhc3MgRWxlbWVudElucHV0IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgRWxlbWVudElucHV0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbGVtZW50fSBkb21FbGVtZW50IC0gVGhlIERPTSBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBhcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy51c2VNb3VzZV0gLSBXaGV0aGVyIHRvIGFsbG93IG1vdXNlIGlucHV0LiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudXNlVG91Y2hdIC0gV2hldGhlciB0byBhbGxvdyB0b3VjaCBpbnB1dC4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnVzZVhyXSAtIFdoZXRoZXIgdG8gYWxsb3cgWFIgaW5wdXQgc291cmNlcy4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihkb21FbGVtZW50LCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuX2FwcCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F0dGFjaGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3RhcmdldCA9IG51bGw7XG5cbiAgICAgICAgLy8gZm9yY2UgZGlzYWJsZSBhbGwgZWxlbWVudCBpbnB1dCBldmVudHNcbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fbGFzdFggPSAwO1xuICAgICAgICB0aGlzLl9sYXN0WSA9IDA7XG5cbiAgICAgICAgdGhpcy5fdXBIYW5kbGVyID0gdGhpcy5faGFuZGxlVXAuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fZG93bkhhbmRsZXIgPSB0aGlzLl9oYW5kbGVEb3duLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX21vdmVIYW5kbGVyID0gdGhpcy5faGFuZGxlTW92ZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl93aGVlbEhhbmRsZXIgPSB0aGlzLl9oYW5kbGVXaGVlbC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl90b3VjaHN0YXJ0SGFuZGxlciA9IHRoaXMuX2hhbmRsZVRvdWNoU3RhcnQuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fdG91Y2hlbmRIYW5kbGVyID0gdGhpcy5faGFuZGxlVG91Y2hFbmQuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fdG91Y2hjYW5jZWxIYW5kbGVyID0gdGhpcy5fdG91Y2hlbmRIYW5kbGVyO1xuICAgICAgICB0aGlzLl90b3VjaG1vdmVIYW5kbGVyID0gdGhpcy5faGFuZGxlVG91Y2hNb3ZlLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX3NvcnRIYW5kbGVyID0gdGhpcy5fc29ydEVsZW1lbnRzLmJpbmQodGhpcyk7XG5cbiAgICAgICAgdGhpcy5fZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5faG92ZXJlZEVsZW1lbnQgPSBudWxsO1xuICAgICAgICB0aGlzLl9wcmVzc2VkRWxlbWVudCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3RvdWNoZWRFbGVtZW50cyA9IHt9O1xuICAgICAgICB0aGlzLl90b3VjaGVzRm9yV2hpY2hUb3VjaExlYXZlSGFzRmlyZWQgPSB7fTtcbiAgICAgICAgdGhpcy5fc2VsZWN0ZWRFbGVtZW50cyA9IHt9O1xuICAgICAgICB0aGlzLl9zZWxlY3RlZFByZXNzZWRFbGVtZW50cyA9IHt9O1xuXG4gICAgICAgIHRoaXMuX3VzZU1vdXNlID0gIW9wdGlvbnMgfHwgb3B0aW9ucy51c2VNb3VzZSAhPT0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3VzZVRvdWNoID0gIW9wdGlvbnMgfHwgb3B0aW9ucy51c2VUb3VjaCAhPT0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3VzZVhyID0gIW9wdGlvbnMgfHwgb3B0aW9ucy51c2VYciAhPT0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3NlbGVjdEV2ZW50c0F0dGFjaGVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKHBsYXRmb3JtLnRvdWNoKVxuICAgICAgICAgICAgdGhpcy5fY2xpY2tlZEVudGl0aWVzID0ge307XG5cbiAgICAgICAgdGhpcy5hdHRhY2goZG9tRWxlbWVudCk7XG4gICAgfVxuXG4gICAgc2V0IGVuYWJsZWQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBlbmFibGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlZDtcbiAgICB9XG5cbiAgICBzZXQgYXBwKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FwcCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBhcHAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hcHAgfHwgZ2V0QXBwbGljYXRpb24oKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRhY2ggbW91c2UgYW5kIHRvdWNoIGV2ZW50cyB0byBhIERPTSBlbGVtZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbGVtZW50fSBkb21FbGVtZW50IC0gVGhlIERPTSBlbGVtZW50LlxuICAgICAqL1xuICAgIGF0dGFjaChkb21FbGVtZW50KSB7XG4gICAgICAgIGlmICh0aGlzLl9hdHRhY2hlZCkge1xuICAgICAgICAgICAgdGhpcy5fYXR0YWNoZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl90YXJnZXQgPSBkb21FbGVtZW50O1xuICAgICAgICB0aGlzLl9hdHRhY2hlZCA9IHRydWU7XG5cbiAgICAgICAgY29uc3Qgb3B0cyA9IHBsYXRmb3JtLnBhc3NpdmVFdmVudHMgPyB7IHBhc3NpdmU6IHRydWUgfSA6IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5fdXNlTW91c2UpIHtcbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgdGhpcy5fdXBIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCB0aGlzLl9kb3duSGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgdGhpcy5fbW92ZUhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3doZWVsJywgdGhpcy5fd2hlZWxIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl91c2VUb3VjaCAmJiBwbGF0Zm9ybS50b3VjaCkge1xuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoc3RhcnQnLCB0aGlzLl90b3VjaHN0YXJ0SGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICAvLyBQYXNzaXZlIGlzIG5vdCB1c2VkIGZvciB0aGUgdG91Y2hlbmQgZXZlbnQgYmVjYXVzZSBzb21lIGNvbXBvbmVudHMgbmVlZCB0byBiZVxuICAgICAgICAgICAgLy8gYWJsZSB0byBjYWxsIHByZXZlbnREZWZhdWx0KCkuIFNlZSBub3RlcyBpbiBidXR0b24vY29tcG9uZW50LmpzIGZvciBtb3JlIGRldGFpbHMuXG4gICAgICAgICAgICB0aGlzLl90YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hlbmQnLCB0aGlzLl90b3VjaGVuZEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaG1vdmUnLCB0aGlzLl90b3VjaG1vdmVIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLl90YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2hjYW5jZWwnLCB0aGlzLl90b3VjaGNhbmNlbEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXR0YWNoU2VsZWN0RXZlbnRzKCk7XG4gICAgfVxuXG4gICAgYXR0YWNoU2VsZWN0RXZlbnRzKCkge1xuICAgICAgICBpZiAoIXRoaXMuX3NlbGVjdEV2ZW50c0F0dGFjaGVkICYmIHRoaXMuX3VzZVhyICYmIHRoaXMuYXBwICYmIHRoaXMuYXBwLnhyICYmIHRoaXMuYXBwLnhyLnN1cHBvcnRlZCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9jbGlja2VkRW50aXRpZXMpXG4gICAgICAgICAgICAgICAgdGhpcy5fY2xpY2tlZEVudGl0aWVzID0ge307XG5cbiAgICAgICAgICAgIHRoaXMuX3NlbGVjdEV2ZW50c0F0dGFjaGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuYXBwLnhyLm9uKCdzdGFydCcsIHRoaXMuX29uWHJTdGFydCwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgbW91c2UgYW5kIHRvdWNoIGV2ZW50cyBmcm9tIHRoZSBET00gZWxlbWVudCB0aGF0IGl0IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGRldGFjaCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hdHRhY2hlZCkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9hdHRhY2hlZCA9IGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IG9wdHMgPSBwbGF0Zm9ybS5wYXNzaXZlRXZlbnRzID8geyBwYXNzaXZlOiB0cnVlIH0gOiBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuX3VzZU1vdXNlKSB7XG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuX3VwSGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5fZG93bkhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuX21vdmVIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCd3aGVlbCcsIHRoaXMuX3doZWVsSGFuZGxlciwgb3B0cyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdXNlVG91Y2gpIHtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy5fdG91Y2hzdGFydEhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcy5fdG91Y2hlbmRIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLl90YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy5fdG91Y2htb3ZlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNoY2FuY2VsJywgdGhpcy5fdG91Y2hjYW5jZWxIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc2VsZWN0RXZlbnRzQXR0YWNoZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlbGVjdEV2ZW50c0F0dGFjaGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmFwcC54ci5vZmYoJ3N0YXJ0JywgdGhpcy5fb25YclN0YXJ0LCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLnhyLm9mZignZW5kJywgdGhpcy5fb25YckVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmFwcC54ci5vZmYoJ3VwZGF0ZScsIHRoaXMuX29uWHJVcGRhdGUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub2ZmKCdzZWxlY3RzdGFydCcsIHRoaXMuX29uU2VsZWN0U3RhcnQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub2ZmKCdzZWxlY3RlbmQnLCB0aGlzLl9vblNlbGVjdEVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uWHJJbnB1dFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl90YXJnZXQgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZCBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fSB0byB0aGUgaW50ZXJuYWwgbGlzdCBvZiBFbGVtZW50Q29tcG9uZW50cyB0aGF0IGFyZSBiZWluZ1xuICAgICAqIGNoZWNrZWQgZm9yIGlucHV0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbGVtZW50Q29tcG9uZW50fSBlbGVtZW50IC0gVGhlIEVsZW1lbnRDb21wb25lbnQuXG4gICAgICovXG4gICAgYWRkRWxlbWVudChlbGVtZW50KSB7XG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50cy5pbmRleE9mKGVsZW1lbnQpID09PSAtMSlcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnRzLnB1c2goZWxlbWVudCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9IGZyb20gdGhlIGludGVybmFsIGxpc3Qgb2YgRWxlbWVudENvbXBvbmVudHMgdGhhdCBhcmUgYmVpbmdcbiAgICAgKiBjaGVja2VkIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZSBFbGVtZW50Q29tcG9uZW50LlxuICAgICAqL1xuICAgIHJlbW92ZUVsZW1lbnQoZWxlbWVudCkge1xuICAgICAgICBjb25zdCBpZHggPSB0aGlzLl9lbGVtZW50cy5pbmRleE9mKGVsZW1lbnQpO1xuICAgICAgICBpZiAoaWR4ICE9PSAtMSlcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnRzLnNwbGljZShpZHgsIDEpO1xuICAgIH1cblxuICAgIF9oYW5kbGVVcChldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBpZiAoTW91c2UuaXNQb2ludGVyTG9ja2VkKCkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY2FsY01vdXNlQ29vcmRzKGV2ZW50KTtcblxuICAgICAgICB0aGlzLl9vbkVsZW1lbnRNb3VzZUV2ZW50KCdtb3VzZXVwJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9oYW5kbGVEb3duKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmIChNb3VzZS5pc1BvaW50ZXJMb2NrZWQoKSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjTW91c2VDb29yZHMoZXZlbnQpO1xuXG4gICAgICAgIHRoaXMuX29uRWxlbWVudE1vdXNlRXZlbnQoJ21vdXNlZG93bicsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfaGFuZGxlTW92ZShldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjTW91c2VDb29yZHMoZXZlbnQpO1xuXG4gICAgICAgIHRoaXMuX29uRWxlbWVudE1vdXNlRXZlbnQoJ21vdXNlbW92ZScsIGV2ZW50KTtcblxuICAgICAgICB0aGlzLl9sYXN0WCA9IHRhcmdldFg7XG4gICAgICAgIHRoaXMuX2xhc3RZID0gdGFyZ2V0WTtcbiAgICB9XG5cbiAgICBfaGFuZGxlV2hlZWwoZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY2FsY01vdXNlQ29vcmRzKGV2ZW50KTtcblxuICAgICAgICB0aGlzLl9vbkVsZW1lbnRNb3VzZUV2ZW50KCdtb3VzZXdoZWVsJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9kZXRlcm1pbmVUb3VjaGVkRWxlbWVudHMoZXZlbnQpIHtcbiAgICAgICAgY29uc3QgdG91Y2hlZEVsZW1lbnRzID0ge307XG4gICAgICAgIGNvbnN0IGNhbWVyYXMgPSB0aGlzLmFwcC5zeXN0ZW1zLmNhbWVyYS5jYW1lcmFzO1xuXG4gICAgICAgIC8vIGNoZWNrIGNhbWVyYXMgZnJvbSBsYXN0IHRvIGZyb250XG4gICAgICAgIC8vIHNvIHRoYXQgZWxlbWVudHMgdGhhdCBhcmUgZHJhd24gYWJvdmUgb3RoZXJzXG4gICAgICAgIC8vIHJlY2VpdmUgZXZlbnRzIGZpcnN0XG4gICAgICAgIGZvciAobGV0IGkgPSBjYW1lcmFzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBjYW1lcmFzW2ldO1xuXG4gICAgICAgICAgICBsZXQgZG9uZSA9IDA7XG4gICAgICAgICAgICBjb25zdCBsZW4gPSBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRvdWNoZWRFbGVtZW50c1tldmVudC5jaGFuZ2VkVG91Y2hlc1tqXS5pZGVudGlmaWVyXSkge1xuICAgICAgICAgICAgICAgICAgICBkb25lKys7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvb3JkcyA9IHRoaXMuX2NhbGNUb3VjaENvb3JkcyhldmVudC5jaGFuZ2VkVG91Y2hlc1tqXSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudEJ5Q29vcmRzKGNhbWVyYSwgY29vcmRzLngsIGNvb3Jkcy55KTtcbiAgICAgICAgICAgICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICAgICAgICAgICAgICBkb25lKys7XG4gICAgICAgICAgICAgICAgICAgIHRvdWNoZWRFbGVtZW50c1tldmVudC5jaGFuZ2VkVG91Y2hlc1tqXS5pZGVudGlmaWVyXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVsZW1lbnQ6IGVsZW1lbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmE6IGNhbWVyYSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHg6IGNvb3Jkcy54LFxuICAgICAgICAgICAgICAgICAgICAgICAgeTogY29vcmRzLnlcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkb25lID09PSBsZW4pIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0b3VjaGVkRWxlbWVudHM7XG4gICAgfVxuXG4gICAgX2hhbmRsZVRvdWNoU3RhcnQoZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbmV3VG91Y2hlZEVsZW1lbnRzID0gdGhpcy5fZGV0ZXJtaW5lVG91Y2hlZEVsZW1lbnRzKGV2ZW50KTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZXZlbnQuY2hhbmdlZFRvdWNoZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRvdWNoID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbaV07XG4gICAgICAgICAgICBjb25zdCBuZXdUb3VjaEluZm8gPSBuZXdUb3VjaGVkRWxlbWVudHNbdG91Y2guaWRlbnRpZmllcl07XG4gICAgICAgICAgICBjb25zdCBvbGRUb3VjaEluZm8gPSB0aGlzLl90b3VjaGVkRWxlbWVudHNbdG91Y2guaWRlbnRpZmllcl07XG5cbiAgICAgICAgICAgIGlmIChuZXdUb3VjaEluZm8gJiYgKCFvbGRUb3VjaEluZm8gfHwgbmV3VG91Y2hJbmZvLmVsZW1lbnQgIT09IG9sZFRvdWNoSW5mby5lbGVtZW50KSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudChldmVudC50eXBlLCBuZXcgRWxlbWVudFRvdWNoRXZlbnQoZXZlbnQsIG5ld1RvdWNoSW5mby5lbGVtZW50LCBuZXdUb3VjaEluZm8uY2FtZXJhLCBuZXdUb3VjaEluZm8ueCwgbmV3VG91Y2hJbmZvLnksIHRvdWNoKSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fdG91Y2hlc0ZvcldoaWNoVG91Y2hMZWF2ZUhhc0ZpcmVkW3RvdWNoLmlkZW50aWZpZXJdID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IHRvdWNoSWQgaW4gbmV3VG91Y2hlZEVsZW1lbnRzKSB7XG4gICAgICAgICAgICB0aGlzLl90b3VjaGVkRWxlbWVudHNbdG91Y2hJZF0gPSBuZXdUb3VjaGVkRWxlbWVudHNbdG91Y2hJZF07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfaGFuZGxlVG91Y2hFbmQoZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY2FtZXJhcyA9IHRoaXMuYXBwLnN5c3RlbXMuY2FtZXJhLmNhbWVyYXM7XG5cbiAgICAgICAgLy8gY2xlYXIgY2xpY2tlZCBlbnRpdGllcyBmaXJzdCB0aGVuIHN0b3JlIGVhY2ggY2xpY2tlZCBlbnRpdHlcbiAgICAgICAgLy8gaW4gX2NsaWNrZWRFbnRpdGllcyBzbyB0aGF0IHdlIGRvbid0IGZpcmUgYW5vdGhlciBjbGlja1xuICAgICAgICAvLyBvbiBpdCBpbiB0aGlzIGhhbmRsZXIgb3IgaW4gdGhlIG1vdXNldXAgaGFuZGxlciB3aGljaCBpc1xuICAgICAgICAvLyBmaXJlZCBsYXRlclxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl9jbGlja2VkRW50aXRpZXMpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9jbGlja2VkRW50aXRpZXNba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdG91Y2ggPSBldmVudC5jaGFuZ2VkVG91Y2hlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IHRvdWNoSW5mbyA9IHRoaXMuX3RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcbiAgICAgICAgICAgIGlmICghdG91Y2hJbmZvKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gdG91Y2hJbmZvLmVsZW1lbnQ7XG4gICAgICAgICAgICBjb25zdCBjYW1lcmEgPSB0b3VjaEluZm8uY2FtZXJhO1xuICAgICAgICAgICAgY29uc3QgeCA9IHRvdWNoSW5mby54O1xuICAgICAgICAgICAgY29uc3QgeSA9IHRvdWNoSW5mby55O1xuXG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fdG91Y2hlZEVsZW1lbnRzW3RvdWNoLmlkZW50aWZpZXJdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3RvdWNoZXNGb3JXaGljaFRvdWNoTGVhdmVIYXNGaXJlZFt0b3VjaC5pZGVudGlmaWVyXTtcblxuICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KGV2ZW50LnR5cGUsIG5ldyBFbGVtZW50VG91Y2hFdmVudChldmVudCwgZWxlbWVudCwgY2FtZXJhLCB4LCB5LCB0b3VjaCkpO1xuXG4gICAgICAgICAgICAvLyBjaGVjayBpZiB0b3VjaCB3YXMgcmVsZWFzZWQgb3ZlciBwcmV2aW91c2x5IHRvdWNoXG4gICAgICAgICAgICAvLyBlbGVtZW50IGluIG9yZGVyIHRvIGZpcmUgY2xpY2sgZXZlbnRcbiAgICAgICAgICAgIGNvbnN0IGNvb3JkcyA9IHRoaXMuX2NhbGNUb3VjaENvb3Jkcyh0b3VjaCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGMgPSBjYW1lcmFzLmxlbmd0aCAtIDE7IGMgPj0gMDsgYy0tKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaG92ZXJlZCA9IHRoaXMuX2dldFRhcmdldEVsZW1lbnRCeUNvb3JkcyhjYW1lcmFzW2NdLCBjb29yZHMueCwgY29vcmRzLnkpO1xuICAgICAgICAgICAgICAgIGlmIChob3ZlcmVkID09PSBlbGVtZW50KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9jbGlja2VkRW50aXRpZXNbZWxlbWVudC5lbnRpdHkuZ2V0R3VpZCgpXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCdjbGljaycsIG5ldyBFbGVtZW50VG91Y2hFdmVudChldmVudCwgZWxlbWVudCwgY2FtZXJhLCB4LCB5LCB0b3VjaCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2xpY2tlZEVudGl0aWVzW2VsZW1lbnQuZW50aXR5LmdldEd1aWQoKV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfaGFuZGxlVG91Y2hNb3ZlKGV2ZW50KSB7XG4gICAgICAgIC8vIGNhbGwgcHJldmVudERlZmF1bHQgdG8gYXZvaWQgaXNzdWVzIGluIENocm9tZSBBbmRyb2lkOlxuICAgICAgICAvLyBodHRwOi8vd2lsc29ucGFnZS5jby51ay90b3VjaC1ldmVudHMtaW4tY2hyb21lLWFuZHJvaWQvXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgbmV3VG91Y2hlZEVsZW1lbnRzID0gdGhpcy5fZGV0ZXJtaW5lVG91Y2hlZEVsZW1lbnRzKGV2ZW50KTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZXZlbnQuY2hhbmdlZFRvdWNoZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHRvdWNoID0gZXZlbnQuY2hhbmdlZFRvdWNoZXNbaV07XG4gICAgICAgICAgICBjb25zdCBuZXdUb3VjaEluZm8gPSBuZXdUb3VjaGVkRWxlbWVudHNbdG91Y2guaWRlbnRpZmllcl07XG4gICAgICAgICAgICBjb25zdCBvbGRUb3VjaEluZm8gPSB0aGlzLl90b3VjaGVkRWxlbWVudHNbdG91Y2guaWRlbnRpZmllcl07XG5cbiAgICAgICAgICAgIGlmIChvbGRUb3VjaEluZm8pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb29yZHMgPSB0aGlzLl9jYWxjVG91Y2hDb29yZHModG91Y2gpO1xuXG4gICAgICAgICAgICAgICAgLy8gRmlyZSB0b3VjaGxlYXZlIGlmIHdlJ3ZlIGxlZnQgdGhlIHByZXZpb3VzbHkgdG91Y2hlZCBlbGVtZW50XG4gICAgICAgICAgICAgICAgaWYgKCghbmV3VG91Y2hJbmZvIHx8IG5ld1RvdWNoSW5mby5lbGVtZW50ICE9PSBvbGRUb3VjaEluZm8uZWxlbWVudCkgJiYgIXRoaXMuX3RvdWNoZXNGb3JXaGljaFRvdWNoTGVhdmVIYXNGaXJlZFt0b3VjaC5pZGVudGlmaWVyXSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ3RvdWNobGVhdmUnLCBuZXcgRWxlbWVudFRvdWNoRXZlbnQoZXZlbnQsIG9sZFRvdWNoSW5mby5lbGVtZW50LCBvbGRUb3VjaEluZm8uY2FtZXJhLCBjb29yZHMueCwgY29vcmRzLnksIHRvdWNoKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gRmxhZyB0aGF0IHRvdWNobGVhdmUgaGFzIGJlZW4gZmlyZWQgZm9yIHRoaXMgdG91Y2gsIHNvIHRoYXQgd2UgZG9uJ3RcbiAgICAgICAgICAgICAgICAgICAgLy8gcmUtZmlyZSBpdCBvbiB0aGUgbmV4dCB0b3VjaG1vdmUuIFRoaXMgaXMgcmVxdWlyZWQgYmVjYXVzZSB0b3VjaG1vdmVcbiAgICAgICAgICAgICAgICAgICAgLy8gZXZlbnRzIGtlZXAgb24gZmlyaW5nIGZvciB0aGUgc2FtZSBlbGVtZW50IHVudGlsIHRoZSB0b3VjaCBlbmRzLCBldmVuXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSB0b3VjaCBwb3NpdGlvbiBtb3ZlcyBhd2F5IGZyb20gdGhlIGVsZW1lbnQuIFRvdWNobGVhdmUsIG9uIHRoZVxuICAgICAgICAgICAgICAgICAgICAvLyBvdGhlciBoYW5kLCBzaG91bGQgZmlyZSBvbmNlIHdoZW4gdGhlIHRvdWNoIHBvc2l0aW9uIG1vdmVzIGF3YXkgZnJvbVxuICAgICAgICAgICAgICAgICAgICAvLyB0aGUgZWxlbWVudCBhbmQgdGhlbiBub3QgcmUtZmlyZSBhZ2FpbiB3aXRoaW4gdGhlIHNhbWUgdG91Y2ggc2Vzc2lvbi5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdG91Y2hlc0ZvcldoaWNoVG91Y2hMZWF2ZUhhc0ZpcmVkW3RvdWNoLmlkZW50aWZpZXJdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ3RvdWNobW92ZScsIG5ldyBFbGVtZW50VG91Y2hFdmVudChldmVudCwgb2xkVG91Y2hJbmZvLmVsZW1lbnQsIG9sZFRvdWNoSW5mby5jYW1lcmEsIGNvb3Jkcy54LCBjb29yZHMueSwgdG91Y2gpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkVsZW1lbnRNb3VzZUV2ZW50KGV2ZW50VHlwZSwgZXZlbnQpIHtcbiAgICAgICAgbGV0IGVsZW1lbnQgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IGxhc3RIb3ZlcmVkID0gdGhpcy5faG92ZXJlZEVsZW1lbnQ7XG4gICAgICAgIHRoaXMuX2hvdmVyZWRFbGVtZW50ID0gbnVsbDtcblxuICAgICAgICBjb25zdCBjYW1lcmFzID0gdGhpcy5hcHAuc3lzdGVtcy5jYW1lcmEuY2FtZXJhcztcbiAgICAgICAgbGV0IGNhbWVyYTtcblxuICAgICAgICAvLyBjaGVjayBjYW1lcmFzIGZyb20gbGFzdCB0byBmcm9udFxuICAgICAgICAvLyBzbyB0aGF0IGVsZW1lbnRzIHRoYXQgYXJlIGRyYXduIGFib3ZlIG90aGVyc1xuICAgICAgICAvLyByZWNlaXZlIGV2ZW50cyBmaXJzdFxuICAgICAgICBmb3IgKGxldCBpID0gY2FtZXJhcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgY2FtZXJhID0gY2FtZXJhc1tpXTtcblxuICAgICAgICAgICAgZWxlbWVudCA9IHRoaXMuX2dldFRhcmdldEVsZW1lbnRCeUNvb3JkcyhjYW1lcmEsIHRhcmdldFgsIHRhcmdldFkpO1xuICAgICAgICAgICAgaWYgKGVsZW1lbnQpXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjdXJyZW50bHkgaG92ZXJlZCBlbGVtZW50IGlzIHdoYXRldmVyJ3MgYmVpbmcgcG9pbnRlZCBieSBtb3VzZSAod2hpY2ggbWF5IGJlIG51bGwpXG4gICAgICAgIHRoaXMuX2hvdmVyZWRFbGVtZW50ID0gZWxlbWVudDtcblxuICAgICAgICAvLyBpZiB0aGVyZSB3YXMgYSBwcmVzc2VkIGVsZW1lbnQsIGl0IHRha2VzIGZ1bGwgcHJpb3JpdHkgb2YgJ21vdmUnIGFuZCAndXAnIGV2ZW50c1xuICAgICAgICBpZiAoKGV2ZW50VHlwZSA9PT0gJ21vdXNlbW92ZScgfHwgZXZlbnRUeXBlID09PSAnbW91c2V1cCcpICYmIHRoaXMuX3ByZXNzZWRFbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoZXZlbnRUeXBlLCBuZXcgRWxlbWVudE1vdXNlRXZlbnQoZXZlbnQsIHRoaXMuX3ByZXNzZWRFbGVtZW50LCBjYW1lcmEsIHRhcmdldFgsIHRhcmdldFksIHRoaXMuX2xhc3RYLCB0aGlzLl9sYXN0WSkpO1xuICAgICAgICB9IGVsc2UgaWYgKGVsZW1lbnQpIHtcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSwgZmlyZSBpdCB0byB0aGUgY3VycmVudGx5IGhvdmVyZWQgZXZlbnRcbiAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudChldmVudFR5cGUsIG5ldyBFbGVtZW50TW91c2VFdmVudChldmVudCwgZWxlbWVudCwgY2FtZXJhLCB0YXJnZXRYLCB0YXJnZXRZLCB0aGlzLl9sYXN0WCwgdGhpcy5fbGFzdFkpKTtcblxuICAgICAgICAgICAgaWYgKGV2ZW50VHlwZSA9PT0gJ21vdXNlZG93bicpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcmVzc2VkRWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGFzdEhvdmVyZWQgIT09IHRoaXMuX2hvdmVyZWRFbGVtZW50KSB7XG4gICAgICAgICAgICAvLyBtb3VzZWxlYXZlIGV2ZW50XG4gICAgICAgICAgICBpZiAobGFzdEhvdmVyZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ21vdXNlbGVhdmUnLCBuZXcgRWxlbWVudE1vdXNlRXZlbnQoZXZlbnQsIGxhc3RIb3ZlcmVkLCBjYW1lcmEsIHRhcmdldFgsIHRhcmdldFksIHRoaXMuX2xhc3RYLCB0aGlzLl9sYXN0WSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBtb3VzZWVudGVyIGV2ZW50XG4gICAgICAgICAgICBpZiAodGhpcy5faG92ZXJlZEVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ21vdXNlZW50ZXInLCBuZXcgRWxlbWVudE1vdXNlRXZlbnQoZXZlbnQsIHRoaXMuX2hvdmVyZWRFbGVtZW50LCBjYW1lcmEsIHRhcmdldFgsIHRhcmdldFksIHRoaXMuX2xhc3RYLCB0aGlzLl9sYXN0WSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50VHlwZSA9PT0gJ21vdXNldXAnICYmIHRoaXMuX3ByZXNzZWRFbGVtZW50KSB7XG4gICAgICAgICAgICAvLyBjbGljayBldmVudFxuICAgICAgICAgICAgaWYgKHRoaXMuX3ByZXNzZWRFbGVtZW50ID09PSB0aGlzLl9ob3ZlcmVkRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3ByZXNzZWRFbGVtZW50ID0gbnVsbDtcblxuICAgICAgICAgICAgICAgIC8vIGZpcmUgY2xpY2sgZXZlbnQgaWYgaXQgaGFzbid0IGJlZW4gZmlyZWQgYWxyZWFkeSBieSB0aGUgdG91Y2h1cCBoYW5kbGVyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9jbGlja2VkRW50aXRpZXMgfHwgIXRoaXMuX2NsaWNrZWRFbnRpdGllc1t0aGlzLl9ob3ZlcmVkRWxlbWVudC5lbnRpdHkuZ2V0R3VpZCgpXSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ2NsaWNrJywgbmV3IEVsZW1lbnRNb3VzZUV2ZW50KGV2ZW50LCB0aGlzLl9ob3ZlcmVkRWxlbWVudCwgY2FtZXJhLCB0YXJnZXRYLCB0YXJnZXRZLCB0aGlzLl9sYXN0WCwgdGhpcy5fbGFzdFkpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3ByZXNzZWRFbGVtZW50ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblhyU3RhcnQoKSB7XG4gICAgICAgIHRoaXMuYXBwLnhyLm9uKCdlbmQnLCB0aGlzLl9vblhyRW5kLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIub24oJ3VwZGF0ZScsIHRoaXMuX29uWHJVcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vbignc2VsZWN0c3RhcnQnLCB0aGlzLl9vblNlbGVjdFN0YXJ0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub24oJ3NlbGVjdGVuZCcsIHRoaXMuX29uU2VsZWN0RW5kLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub24oJ3JlbW92ZScsIHRoaXMuX29uWHJJbnB1dFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uWHJFbmQoKSB7XG4gICAgICAgIHRoaXMuYXBwLnhyLm9mZigndXBkYXRlJywgdGhpcy5fb25YclVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZignc2VsZWN0c3RhcnQnLCB0aGlzLl9vblNlbGVjdFN0YXJ0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub2ZmKCdzZWxlY3RlbmQnLCB0aGlzLl9vblNlbGVjdEVuZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25YcklucHV0UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25YclVwZGF0ZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgaW5wdXRTb3VyY2VzID0gdGhpcy5hcHAueHIuaW5wdXQuaW5wdXRTb3VyY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0U291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fb25FbGVtZW50U2VsZWN0RXZlbnQoJ3NlbGVjdG1vdmUnLCBpbnB1dFNvdXJjZXNbaV0sIG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uWHJJbnB1dFJlbW92ZShpbnB1dFNvdXJjZSkge1xuICAgICAgICBjb25zdCBob3ZlcmVkID0gdGhpcy5fc2VsZWN0ZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG4gICAgICAgIGlmIChob3ZlcmVkKSB7XG4gICAgICAgICAgICBpbnB1dFNvdXJjZS5fZWxlbWVudEVudGl0eSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ3NlbGVjdGxlYXZlJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChudWxsLCBob3ZlcmVkLCBudWxsLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuX3NlbGVjdGVkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICBkZWxldGUgdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgIH1cblxuICAgIF9vblNlbGVjdFN0YXJ0KGlucHV0U291cmNlLCBldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcbiAgICAgICAgdGhpcy5fb25FbGVtZW50U2VsZWN0RXZlbnQoJ3NlbGVjdHN0YXJ0JywgaW5wdXRTb3VyY2UsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25TZWxlY3RFbmQoaW5wdXRTb3VyY2UsIGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9vbkVsZW1lbnRTZWxlY3RFdmVudCgnc2VsZWN0ZW5kJywgaW5wdXRTb3VyY2UsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25FbGVtZW50U2VsZWN0RXZlbnQoZXZlbnRUeXBlLCBpbnB1dFNvdXJjZSwgZXZlbnQpIHtcbiAgICAgICAgbGV0IGVsZW1lbnQ7XG5cbiAgICAgICAgY29uc3QgaG92ZXJlZEJlZm9yZSA9IHRoaXMuX3NlbGVjdGVkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICBsZXQgaG92ZXJlZE5vdztcblxuICAgICAgICBjb25zdCBjYW1lcmFzID0gdGhpcy5hcHAuc3lzdGVtcy5jYW1lcmEuY2FtZXJhcztcbiAgICAgICAgbGV0IGNhbWVyYTtcblxuICAgICAgICBpZiAoaW5wdXRTb3VyY2UuZWxlbWVudElucHV0KSB7XG4gICAgICAgICAgICByYXlDLnNldChpbnB1dFNvdXJjZS5nZXRPcmlnaW4oKSwgaW5wdXRTb3VyY2UuZ2V0RGlyZWN0aW9uKCkpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gY2FtZXJhcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgICAgIGNhbWVyYSA9IGNhbWVyYXNbaV07XG5cbiAgICAgICAgICAgICAgICBlbGVtZW50ID0gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudEJ5UmF5KHJheUMsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQpXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaW5wdXRTb3VyY2UuX2VsZW1lbnRFbnRpdHkgPSBlbGVtZW50IHx8IG51bGw7XG5cbiAgICAgICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlbGVjdGVkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdID0gZWxlbWVudDtcbiAgICAgICAgICAgIGhvdmVyZWROb3cgPSBlbGVtZW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3NlbGVjdGVkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhvdmVyZWRCZWZvcmUgIT09IGhvdmVyZWROb3cpIHtcbiAgICAgICAgICAgIGlmIChob3ZlcmVkQmVmb3JlKSB0aGlzLl9maXJlRXZlbnQoJ3NlbGVjdGxlYXZlJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgaG92ZXJlZEJlZm9yZSwgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICAgICAgaWYgKGhvdmVyZWROb3cpIHRoaXMuX2ZpcmVFdmVudCgnc2VsZWN0ZW50ZXInLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50LCBob3ZlcmVkTm93LCBjYW1lcmEsIGlucHV0U291cmNlKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnRUeXBlID09PSAnc2VsZWN0c3RhcnQnKSB7XG4gICAgICAgICAgICB0aGlzLl9zZWxlY3RlZFByZXNzZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF0gPSBob3ZlcmVkTm93O1xuICAgICAgICAgICAgaWYgKGhvdmVyZWROb3cpIHRoaXMuX2ZpcmVFdmVudCgnc2VsZWN0c3RhcnQnLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50LCBob3ZlcmVkTm93LCBjYW1lcmEsIGlucHV0U291cmNlKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcmVzc2VkID0gdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICBpZiAoIWlucHV0U291cmNlLmVsZW1lbnRJbnB1dCAmJiBwcmVzc2VkKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICAgICAgaWYgKGhvdmVyZWRCZWZvcmUpIHRoaXMuX2ZpcmVFdmVudCgnc2VsZWN0ZW5kJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgaG92ZXJlZEJlZm9yZSwgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50VHlwZSA9PT0gJ3NlbGVjdGVuZCcgJiYgaW5wdXRTb3VyY2UuZWxlbWVudElucHV0KSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuXG4gICAgICAgICAgICBpZiAoaG92ZXJlZEJlZm9yZSkgdGhpcy5fZmlyZUV2ZW50KCdzZWxlY3RlbmQnLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50LCBob3ZlcmVkQmVmb3JlLCBjYW1lcmEsIGlucHV0U291cmNlKSk7XG5cbiAgICAgICAgICAgIGlmIChwcmVzc2VkICYmIHByZXNzZWQgPT09IGhvdmVyZWRCZWZvcmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ2NsaWNrJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgcHJlc3NlZCwgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2ZpcmVFdmVudChuYW1lLCBldnQpIHtcbiAgICAgICAgbGV0IGVsZW1lbnQgPSBldnQuZWxlbWVudDtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGVsZW1lbnQuZmlyZShuYW1lLCBldnQpO1xuICAgICAgICAgICAgaWYgKGV2dC5fc3RvcFByb3BhZ2F0aW9uKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBpZiAoIWVsZW1lbnQuZW50aXR5LnBhcmVudClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZWxlbWVudCA9IGVsZW1lbnQuZW50aXR5LnBhcmVudC5lbGVtZW50O1xuICAgICAgICAgICAgaWYgKCFlbGVtZW50KVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NhbGNNb3VzZUNvb3JkcyhldmVudCkge1xuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5fdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBjb25zdCBsZWZ0ID0gTWF0aC5mbG9vcihyZWN0LmxlZnQpO1xuICAgICAgICBjb25zdCB0b3AgPSBNYXRoLmZsb29yKHJlY3QudG9wKTtcbiAgICAgICAgdGFyZ2V0WCA9IChldmVudC5jbGllbnRYIC0gbGVmdCk7XG4gICAgICAgIHRhcmdldFkgPSAoZXZlbnQuY2xpZW50WSAtIHRvcCk7XG4gICAgfVxuXG4gICAgX2NhbGNUb3VjaENvb3Jkcyh0b3VjaCkge1xuICAgICAgICBsZXQgdG90YWxPZmZzZXRYID0gMDtcbiAgICAgICAgbGV0IHRvdGFsT2Zmc2V0WSA9IDA7XG4gICAgICAgIGxldCB0YXJnZXQgPSB0b3VjaC50YXJnZXQ7XG4gICAgICAgIHdoaWxlICghKHRhcmdldCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGN1cnJlbnRFbGVtZW50ID0gdGFyZ2V0O1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIHRvdGFsT2Zmc2V0WCArPSBjdXJyZW50RWxlbWVudC5vZmZzZXRMZWZ0IC0gY3VycmVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcbiAgICAgICAgICAgIHRvdGFsT2Zmc2V0WSArPSBjdXJyZW50RWxlbWVudC5vZmZzZXRUb3AgLSBjdXJyZW50RWxlbWVudC5zY3JvbGxUb3A7XG4gICAgICAgICAgICBjdXJyZW50RWxlbWVudCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFBhcmVudDtcbiAgICAgICAgfSB3aGlsZSAoY3VycmVudEVsZW1lbnQpO1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSBjb29yZHMgYW5kIHNjYWxlIHRoZW0gdG8gdGhlIGdyYXBoaWNzRGV2aWNlIHNpemVcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6ICh0b3VjaC5wYWdlWCAtIHRvdGFsT2Zmc2V0WCksXG4gICAgICAgICAgICB5OiAodG91Y2gucGFnZVkgLSB0b3RhbE9mZnNldFkpXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgX3NvcnRFbGVtZW50cyhhLCBiKSB7XG4gICAgICAgIGNvbnN0IGxheWVyT3JkZXIgPSB0aGlzLmFwcC5zY2VuZS5sYXllcnMuc29ydFRyYW5zcGFyZW50TGF5ZXJzKGEubGF5ZXJzLCBiLmxheWVycyk7XG4gICAgICAgIGlmIChsYXllck9yZGVyICE9PSAwKSByZXR1cm4gbGF5ZXJPcmRlcjtcblxuICAgICAgICBpZiAoYS5zY3JlZW4gJiYgIWIuc2NyZWVuKVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICBpZiAoIWEuc2NyZWVuICYmIGIuc2NyZWVuKVxuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIGlmICghYS5zY3JlZW4gJiYgIWIuc2NyZWVuKVxuICAgICAgICAgICAgcmV0dXJuIDA7XG5cbiAgICAgICAgaWYgKGEuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSAmJiAhYi5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlKVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICBpZiAoYi5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlICYmICFhLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpXG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgcmV0dXJuIGIuZHJhd09yZGVyIC0gYS5kcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgX2dldFRhcmdldEVsZW1lbnRCeUNvb3JkcyhjYW1lcmEsIHgsIHkpIHtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHNjcmVlbi1zcGFjZSBhbmQgM2Qtc3BhY2UgcmF5c1xuICAgICAgICBjb25zdCByYXlTY3JlZW4gPSB0aGlzLl9jYWxjdWxhdGVSYXlTY3JlZW4oeCwgeSwgY2FtZXJhLCByYXlBKSA/IHJheUEgOiBudWxsO1xuICAgICAgICBjb25zdCByYXkzZCA9IHRoaXMuX2NhbGN1bGF0ZVJheTNkKHgsIHksIGNhbWVyYSwgcmF5QikgPyByYXlCIDogbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudChjYW1lcmEsIHJheVNjcmVlbiwgcmF5M2QpO1xuICAgIH1cblxuICAgIF9nZXRUYXJnZXRFbGVtZW50QnlSYXkocmF5LCBjYW1lcmEpIHtcbiAgICAgICAgLy8gM2QgcmF5IGlzIGNvcGllZCBmcm9tIGlucHV0IHJheVxuICAgICAgICByYXlBLm9yaWdpbi5jb3B5KHJheS5vcmlnaW4pO1xuICAgICAgICByYXlBLmRpcmVjdGlvbi5jb3B5KHJheS5kaXJlY3Rpb24pO1xuICAgICAgICByYXlBLmVuZC5jb3B5KHJheUEuZGlyZWN0aW9uKS5tdWxTY2FsYXIoY2FtZXJhLmZhckNsaXAgKiAyKS5hZGQocmF5QS5vcmlnaW4pO1xuICAgICAgICBjb25zdCByYXkzZCA9IHJheUE7XG5cbiAgICAgICAgLy8gc2NyZWVuLXNwYWNlIHJheSBpcyBidWlsdCBmcm9tIGlucHV0IHJheSdzIG9yaWdpbiwgY29udmVydGVkIHRvIHNjcmVlbi1zcGFjZVxuICAgICAgICBjb25zdCBzY3JlZW5Qb3MgPSBjYW1lcmEud29ybGRUb1NjcmVlbihyYXkzZC5vcmlnaW4sIHZlY0EpO1xuICAgICAgICBjb25zdCByYXlTY3JlZW4gPSB0aGlzLl9jYWxjdWxhdGVSYXlTY3JlZW4oc2NyZWVuUG9zLngsIHNjcmVlblBvcy55LCBjYW1lcmEsIHJheUIpID8gcmF5QiA6IG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFRhcmdldEVsZW1lbnQoY2FtZXJhLCByYXlTY3JlZW4sIHJheTNkKTtcbiAgICB9XG5cbiAgICBfZ2V0VGFyZ2V0RWxlbWVudChjYW1lcmEsIHJheVNjcmVlbiwgcmF5M2QpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG4gICAgICAgIGxldCBjbG9zZXN0RGlzdGFuY2UzZCA9IEluZmluaXR5O1xuXG4gICAgICAgIC8vIHNvcnQgZWxlbWVudHMgYmFzZWQgb24gbGF5ZXJzIGFuZCBkcmF3IG9yZGVyXG4gICAgICAgIHRoaXMuX2VsZW1lbnRzLnNvcnQodGhpcy5fc29ydEhhbmRsZXIpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9lbGVtZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnRzW2ldO1xuXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBhbnkgb2YgdGhlIGxheWVycyB0aGlzIGVsZW1lbnQgcmVuZGVycyB0byBpcyBiZWluZyByZW5kZXJlZCBieSB0aGUgY2FtZXJhXG4gICAgICAgICAgICBpZiAoIWVsZW1lbnQubGF5ZXJzLnNvbWUodiA9PiBjYW1lcmEubGF5ZXJzU2V0Lmhhcyh2KSkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGVsZW1lbnQuc2NyZWVuICYmIGVsZW1lbnQuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgICAgIGlmICghcmF5U2NyZWVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIDJkIHNjcmVlbiBlbGVtZW50cyB0YWtlIHByZWNlZGVuY2UgLSBpZiBoaXQsIGltbWVkaWF0ZWx5IHJldHVyblxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnREaXN0YW5jZSA9IHRoaXMuX2NoZWNrRWxlbWVudChyYXlTY3JlZW4sIGVsZW1lbnQsIHRydWUpO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50RGlzdGFuY2UgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBlbGVtZW50O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghcmF5M2QpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudERpc3RhbmNlID0gdGhpcy5fY2hlY2tFbGVtZW50KHJheTNkLCBlbGVtZW50LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnREaXN0YW5jZSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBjbG9zZXN0IG9uZSBpbiB3b3JsZCBzcGFjZVxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudERpc3RhbmNlIDwgY2xvc2VzdERpc3RhbmNlM2QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbG9zZXN0RGlzdGFuY2UzZCA9IGN1cnJlbnREaXN0YW5jZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBlbGVtZW50IGlzIG9uIGEgU2NyZWVuLCBpdCB0YWtlcyBwcmVjZWRlbmNlXG4gICAgICAgICAgICAgICAgICAgIGlmIChlbGVtZW50LnNjcmVlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZWxlbWVudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvLyBJbiBtb3N0IGNhc2VzIHRoZSBjb3JuZXJzIHVzZWQgZm9yIGhpdCB0ZXN0aW5nIHdpbGwganVzdCBiZSB0aGUgZWxlbWVudCdzXG4gICAgLy8gc2NyZWVuIGNvcm5lcnMuIEhvd2V2ZXIsIGluIGNhc2VzIHdoZXJlIHRoZSBlbGVtZW50IGhhcyBhZGRpdGlvbmFsIGhpdFxuICAgIC8vIHBhZGRpbmcgc3BlY2lmaWVkLCB3ZSBuZWVkIHRvIGV4cGFuZCB0aGUgc2NyZWVuQ29ybmVycyB0byBpbmNvcnBvcmF0ZSB0aGVcbiAgICAvLyBwYWRkaW5nLlxuICAgIF9idWlsZEhpdENvcm5lcnMoZWxlbWVudCwgc2NyZWVuT3JXb3JsZENvcm5lcnMsIHNjYWxlWCwgc2NhbGVZLCBzY2FsZVopIHtcbiAgICAgICAgbGV0IGhpdENvcm5lcnMgPSBzY3JlZW5PcldvcmxkQ29ybmVycztcbiAgICAgICAgY29uc3QgYnV0dG9uID0gZWxlbWVudC5lbnRpdHkgJiYgZWxlbWVudC5lbnRpdHkuYnV0dG9uO1xuXG4gICAgICAgIGlmIChidXR0b24pIHtcbiAgICAgICAgICAgIGNvbnN0IGhpdFBhZGRpbmcgPSBlbGVtZW50LmVudGl0eS5idXR0b24uaGl0UGFkZGluZyB8fCBaRVJPX1ZFQzQ7XG5cbiAgICAgICAgICAgIF9wYWRkaW5nVG9wLmNvcHkoZWxlbWVudC5lbnRpdHkudXApO1xuICAgICAgICAgICAgX3BhZGRpbmdCb3R0b20uY29weShfcGFkZGluZ1RvcCkubXVsU2NhbGFyKC0xKTtcbiAgICAgICAgICAgIF9wYWRkaW5nUmlnaHQuY29weShlbGVtZW50LmVudGl0eS5yaWdodCk7XG4gICAgICAgICAgICBfcGFkZGluZ0xlZnQuY29weShfcGFkZGluZ1JpZ2h0KS5tdWxTY2FsYXIoLTEpO1xuXG4gICAgICAgICAgICBfcGFkZGluZ1RvcC5tdWxTY2FsYXIoaGl0UGFkZGluZy53ICogc2NhbGVZKTtcbiAgICAgICAgICAgIF9wYWRkaW5nQm90dG9tLm11bFNjYWxhcihoaXRQYWRkaW5nLnkgKiBzY2FsZVkpO1xuICAgICAgICAgICAgX3BhZGRpbmdSaWdodC5tdWxTY2FsYXIoaGl0UGFkZGluZy56ICogc2NhbGVYKTtcbiAgICAgICAgICAgIF9wYWRkaW5nTGVmdC5tdWxTY2FsYXIoaGl0UGFkZGluZy54ICogc2NhbGVYKTtcblxuICAgICAgICAgICAgX2Nvcm5lckJvdHRvbUxlZnQuY29weShoaXRDb3JuZXJzWzBdKS5hZGQoX3BhZGRpbmdCb3R0b20pLmFkZChfcGFkZGluZ0xlZnQpO1xuICAgICAgICAgICAgX2Nvcm5lckJvdHRvbVJpZ2h0LmNvcHkoaGl0Q29ybmVyc1sxXSkuYWRkKF9wYWRkaW5nQm90dG9tKS5hZGQoX3BhZGRpbmdSaWdodCk7XG4gICAgICAgICAgICBfY29ybmVyVG9wUmlnaHQuY29weShoaXRDb3JuZXJzWzJdKS5hZGQoX3BhZGRpbmdUb3ApLmFkZChfcGFkZGluZ1JpZ2h0KTtcbiAgICAgICAgICAgIF9jb3JuZXJUb3BMZWZ0LmNvcHkoaGl0Q29ybmVyc1szXSkuYWRkKF9wYWRkaW5nVG9wKS5hZGQoX3BhZGRpbmdMZWZ0KTtcblxuICAgICAgICAgICAgaGl0Q29ybmVycyA9IFtfY29ybmVyQm90dG9tTGVmdCwgX2Nvcm5lckJvdHRvbVJpZ2h0LCBfY29ybmVyVG9wUmlnaHQsIF9jb3JuZXJUb3BMZWZ0XTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSB0aGUgY29ybmVycyBhcmUgaW4gdGhlIHJpZ2h0IG9yZGVyIFtibCwgYnIsIHRyLCB0bF1cbiAgICAgICAgLy8gZm9yIHggYW5kIHk6IHNpbXBseSBpbnZlcnQgd2hhdCBpcyBjb25zaWRlcmVkIFwibGVmdC9yaWdodFwiIGFuZCBcInRvcC9ib3R0b21cIlxuICAgICAgICBpZiAoc2NhbGVYIDwgMCkge1xuICAgICAgICAgICAgY29uc3QgbGVmdCA9IGhpdENvcm5lcnNbMl0ueDtcbiAgICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gaGl0Q29ybmVyc1swXS54O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1swXS54ID0gbGVmdDtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMV0ueCA9IHJpZ2h0O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1syXS54ID0gcmlnaHQ7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzNdLnggPSBsZWZ0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChzY2FsZVkgPCAwKSB7XG4gICAgICAgICAgICBjb25zdCBib3R0b20gPSBoaXRDb3JuZXJzWzJdLnk7XG4gICAgICAgICAgICBjb25zdCB0b3AgPSBoaXRDb3JuZXJzWzBdLnk7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzBdLnkgPSBib3R0b207XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzFdLnkgPSBib3R0b207XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzJdLnkgPSB0b3A7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzNdLnkgPSB0b3A7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgeiBpcyBpbnZlcnRlZCwgZW50aXJlIGVsZW1lbnQgaXMgaW52ZXJ0ZWQsIHNvIGZsaXAgaXQgYXJvdW5kIGJ5IHN3YXBwaW5nIGNvcm5lciBwb2ludHMgMiBhbmQgMFxuICAgICAgICBpZiAoc2NhbGVaIDwgMCkge1xuICAgICAgICAgICAgY29uc3QgeCA9IGhpdENvcm5lcnNbMl0ueDtcbiAgICAgICAgICAgIGNvbnN0IHkgPSBoaXRDb3JuZXJzWzJdLnk7XG4gICAgICAgICAgICBjb25zdCB6ID0gaGl0Q29ybmVyc1syXS56O1xuXG4gICAgICAgICAgICBoaXRDb3JuZXJzWzJdLnggPSBoaXRDb3JuZXJzWzBdLng7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzJdLnkgPSBoaXRDb3JuZXJzWzBdLnk7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzJdLnogPSBoaXRDb3JuZXJzWzBdLno7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzBdLnggPSB4O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1swXS55ID0geTtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMF0ueiA9IHo7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaGl0Q29ybmVycztcbiAgICB9XG5cbiAgICBfY2FsY3VsYXRlU2NhbGVUb1NjcmVlbihlbGVtZW50KSB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gZWxlbWVudC5lbnRpdHk7XG4gICAgICAgIGNvbnN0IHNjcmVlblNjYWxlID0gZWxlbWVudC5zY3JlZW4uc2NyZWVuLnNjYWxlO1xuXG4gICAgICAgIF9hY2N1bXVsYXRlZFNjYWxlLnNldChzY3JlZW5TY2FsZSwgc2NyZWVuU2NhbGUsIHNjcmVlblNjYWxlKTtcblxuICAgICAgICB3aGlsZSAoY3VycmVudCAmJiAhY3VycmVudC5zY3JlZW4pIHtcbiAgICAgICAgICAgIF9hY2N1bXVsYXRlZFNjYWxlLm11bChjdXJyZW50LmdldExvY2FsU2NhbGUoKSk7XG4gICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudC5wYXJlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2FjY3VtdWxhdGVkU2NhbGU7XG4gICAgfVxuXG4gICAgX2NhbGN1bGF0ZVNjYWxlVG9Xb3JsZChlbGVtZW50KSB7XG4gICAgICAgIGxldCBjdXJyZW50ID0gZWxlbWVudC5lbnRpdHk7XG4gICAgICAgIF9hY2N1bXVsYXRlZFNjYWxlLnNldCgxLCAxLCAxKTtcblxuICAgICAgICB3aGlsZSAoY3VycmVudCkge1xuICAgICAgICAgICAgX2FjY3VtdWxhdGVkU2NhbGUubXVsKGN1cnJlbnQuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfYWNjdW11bGF0ZWRTY2FsZTtcbiAgICB9XG5cbiAgICBfY2FsY3VsYXRlUmF5U2NyZWVuKHgsIHksIGNhbWVyYSwgcmF5KSB7XG4gICAgICAgIGNvbnN0IHN3ID0gdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2Uud2lkdGg7XG4gICAgICAgIGNvbnN0IHNoID0gdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2UuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYVdpZHRoID0gY2FtZXJhLnJlY3QueiAqIHN3O1xuICAgICAgICBjb25zdCBjYW1lcmFIZWlnaHQgPSBjYW1lcmEucmVjdC53ICogc2g7XG4gICAgICAgIGNvbnN0IGNhbWVyYUxlZnQgPSBjYW1lcmEucmVjdC54ICogc3c7XG4gICAgICAgIGNvbnN0IGNhbWVyYVJpZ2h0ID0gY2FtZXJhTGVmdCArIGNhbWVyYVdpZHRoO1xuICAgICAgICAvLyBjYW1lcmEgYm90dG9tIChvcmlnaW4gaXMgYm90dG9tIGxlZnQgb2Ygd2luZG93KVxuICAgICAgICBjb25zdCBjYW1lcmFCb3R0b20gPSAoMSAtIGNhbWVyYS5yZWN0LnkpICogc2g7XG4gICAgICAgIGNvbnN0IGNhbWVyYVRvcCA9IGNhbWVyYUJvdHRvbSAtIGNhbWVyYUhlaWdodDtcblxuICAgICAgICBsZXQgX3ggPSB4ICogc3cgLyB0aGlzLl90YXJnZXQuY2xpZW50V2lkdGg7XG4gICAgICAgIGxldCBfeSA9IHkgKiBzaCAvIHRoaXMuX3RhcmdldC5jbGllbnRIZWlnaHQ7XG5cbiAgICAgICAgaWYgKF94ID49IGNhbWVyYUxlZnQgJiYgX3ggPD0gY2FtZXJhUmlnaHQgJiZcbiAgICAgICAgICAgIF95IDw9IGNhbWVyYUJvdHRvbSAmJiBfeSA+PSBjYW1lcmFUb3ApIHtcblxuICAgICAgICAgICAgLy8gbGltaXQgd2luZG93IGNvb3JkcyB0byBjYW1lcmEgcmVjdCBjb29yZHNcbiAgICAgICAgICAgIF94ID0gc3cgKiAoX3ggLSBjYW1lcmFMZWZ0KSAvIGNhbWVyYVdpZHRoO1xuICAgICAgICAgICAgX3kgPSBzaCAqIChfeSAtIGNhbWVyYVRvcCkgLyBjYW1lcmFIZWlnaHQ7XG5cbiAgICAgICAgICAgIC8vIHJldmVyc2UgX3lcbiAgICAgICAgICAgIF95ID0gc2ggLSBfeTtcblxuICAgICAgICAgICAgcmF5Lm9yaWdpbi5zZXQoX3gsIF95LCAxKTtcbiAgICAgICAgICAgIHJheS5kaXJlY3Rpb24uc2V0KDAsIDAsIC0xKTtcbiAgICAgICAgICAgIHJheS5lbmQuY29weShyYXkuZGlyZWN0aW9uKS5tdWxTY2FsYXIoMikuYWRkKHJheS5vcmlnaW4pO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2NhbGN1bGF0ZVJheTNkKHgsIHksIGNhbWVyYSwgcmF5KSB7XG4gICAgICAgIGNvbnN0IHN3ID0gdGhpcy5fdGFyZ2V0LmNsaWVudFdpZHRoO1xuICAgICAgICBjb25zdCBzaCA9IHRoaXMuX3RhcmdldC5jbGllbnRIZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgY2FtZXJhV2lkdGggPSBjYW1lcmEucmVjdC56ICogc3c7XG4gICAgICAgIGNvbnN0IGNhbWVyYUhlaWdodCA9IGNhbWVyYS5yZWN0LncgKiBzaDtcbiAgICAgICAgY29uc3QgY2FtZXJhTGVmdCA9IGNhbWVyYS5yZWN0LnggKiBzdztcbiAgICAgICAgY29uc3QgY2FtZXJhUmlnaHQgPSBjYW1lcmFMZWZ0ICsgY2FtZXJhV2lkdGg7XG4gICAgICAgIC8vIGNhbWVyYSBib3R0b20gLSBvcmlnaW4gaXMgYm90dG9tIGxlZnQgb2Ygd2luZG93XG4gICAgICAgIGNvbnN0IGNhbWVyYUJvdHRvbSA9ICgxIC0gY2FtZXJhLnJlY3QueSkgKiBzaDtcbiAgICAgICAgY29uc3QgY2FtZXJhVG9wID0gY2FtZXJhQm90dG9tIC0gY2FtZXJhSGVpZ2h0O1xuXG4gICAgICAgIGxldCBfeCA9IHg7XG4gICAgICAgIGxldCBfeSA9IHk7XG5cbiAgICAgICAgLy8gY2hlY2sgd2luZG93IGNvb3JkcyBhcmUgd2l0aGluIGNhbWVyYSByZWN0XG4gICAgICAgIGlmICh4ID49IGNhbWVyYUxlZnQgJiYgeCA8PSBjYW1lcmFSaWdodCAmJlxuICAgICAgICAgICAgeSA8PSBjYW1lcmFCb3R0b20gJiYgX3kgPj0gY2FtZXJhVG9wKSB7XG5cbiAgICAgICAgICAgIC8vIGxpbWl0IHdpbmRvdyBjb29yZHMgdG8gY2FtZXJhIHJlY3QgY29vcmRzXG4gICAgICAgICAgICBfeCA9IHN3ICogKF94IC0gY2FtZXJhTGVmdCkgLyBjYW1lcmFXaWR0aDtcbiAgICAgICAgICAgIF95ID0gc2ggKiAoX3kgLSAoY2FtZXJhVG9wKSkgLyBjYW1lcmFIZWlnaHQ7XG5cbiAgICAgICAgICAgIC8vIDNEIHNjcmVlblxuICAgICAgICAgICAgY2FtZXJhLnNjcmVlblRvV29ybGQoX3gsIF95LCBjYW1lcmEubmVhckNsaXAsIHZlY0EpO1xuICAgICAgICAgICAgY2FtZXJhLnNjcmVlblRvV29ybGQoX3gsIF95LCBjYW1lcmEuZmFyQ2xpcCwgdmVjQik7XG5cbiAgICAgICAgICAgIHJheS5vcmlnaW4uY29weSh2ZWNBKTtcbiAgICAgICAgICAgIHJheS5kaXJlY3Rpb24uc2V0KDAsIDAsIC0xKTtcbiAgICAgICAgICAgIHJheS5lbmQuY29weSh2ZWNCKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIF9jaGVja0VsZW1lbnQocmF5LCBlbGVtZW50LCBzY3JlZW4pIHtcbiAgICAgICAgLy8gZW5zdXJlIGNsaWNrIGlzIGNvbnRhaW5lZCBieSBhbnkgbWFzayBmaXJzdFxuICAgICAgICBpZiAoZWxlbWVudC5tYXNrZWRCeSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NoZWNrRWxlbWVudChyYXksIGVsZW1lbnQubWFza2VkQnkuZWxlbWVudCwgc2NyZWVuKSA8IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc2NhbGU7XG4gICAgICAgIGlmIChzY3JlZW4pIHtcbiAgICAgICAgICAgIHNjYWxlID0gdGhpcy5fY2FsY3VsYXRlU2NhbGVUb1NjcmVlbihlbGVtZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNjYWxlID0gdGhpcy5fY2FsY3VsYXRlU2NhbGVUb1dvcmxkKGVsZW1lbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29ybmVycyA9IHRoaXMuX2J1aWxkSGl0Q29ybmVycyhlbGVtZW50LCBzY3JlZW4gPyBlbGVtZW50LnNjcmVlbkNvcm5lcnMgOiBlbGVtZW50LndvcmxkQ29ybmVycywgc2NhbGUueCwgc2NhbGUueSwgc2NhbGUueik7XG5cbiAgICAgICAgcmV0dXJuIGludGVyc2VjdExpbmVRdWFkKHJheS5vcmlnaW4sIHJheS5lbmQsIGNvcm5lcnMpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgRWxlbWVudElucHV0LCBFbGVtZW50SW5wdXRFdmVudCwgRWxlbWVudE1vdXNlRXZlbnQsIEVsZW1lbnRTZWxlY3RFdmVudCwgRWxlbWVudFRvdWNoRXZlbnQgfTtcbiJdLCJuYW1lcyI6WyJ0YXJnZXRYIiwidGFyZ2V0WSIsInZlY0EiLCJWZWMzIiwidmVjQiIsInJheUEiLCJSYXkiLCJyYXlCIiwicmF5QyIsImVuZCIsIl9wcSIsIl9wYSIsIl9wYiIsIl9wYyIsIl9wZCIsIl9tIiwiX2F1IiwiX2J2IiwiX2N3IiwiX2lyIiwiX3NjdCIsIl9hY2N1bXVsYXRlZFNjYWxlIiwiX3BhZGRpbmdUb3AiLCJfcGFkZGluZ0JvdHRvbSIsIl9wYWRkaW5nTGVmdCIsIl9wYWRkaW5nUmlnaHQiLCJfY29ybmVyQm90dG9tTGVmdCIsIl9jb3JuZXJCb3R0b21SaWdodCIsIl9jb3JuZXJUb3BSaWdodCIsIl9jb3JuZXJUb3BMZWZ0IiwiWkVST19WRUM0IiwiVmVjNCIsInNjYWxhclRyaXBsZSIsInAxIiwicDIiLCJwMyIsImNyb3NzIiwiZG90IiwiaW50ZXJzZWN0TGluZVF1YWQiLCJwIiwicSIsImNvcm5lcnMiLCJzdWIyIiwidiIsInUiLCJ3IiwiZGVub20iLCJjb3B5IiwibXVsU2NhbGFyIiwiYWRkIiwibGVuZ3RoU3EiLCJzdWIiLCJFbGVtZW50SW5wdXRFdmVudCIsImNvbnN0cnVjdG9yIiwiZXZlbnQiLCJlbGVtZW50IiwiY2FtZXJhIiwiX3N0b3BQcm9wYWdhdGlvbiIsInN0b3BQcm9wYWdhdGlvbiIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsIkVsZW1lbnRNb3VzZUV2ZW50IiwieCIsInkiLCJsYXN0WCIsImxhc3RZIiwiY3RybEtleSIsImFsdEtleSIsInNoaWZ0S2V5IiwibWV0YUtleSIsImJ1dHRvbiIsIk1vdXNlIiwiaXNQb2ludGVyTG9ja2VkIiwiZHgiLCJtb3ZlbWVudFgiLCJ3ZWJraXRNb3ZlbWVudFgiLCJtb3pNb3ZlbWVudFgiLCJkeSIsIm1vdmVtZW50WSIsIndlYmtpdE1vdmVtZW50WSIsIm1vek1vdmVtZW50WSIsIndoZWVsRGVsdGEiLCJ0eXBlIiwiZGVsdGFZIiwiRWxlbWVudFRvdWNoRXZlbnQiLCJ0b3VjaCIsInRvdWNoZXMiLCJjaGFuZ2VkVG91Y2hlcyIsIkVsZW1lbnRTZWxlY3RFdmVudCIsImlucHV0U291cmNlIiwiRWxlbWVudElucHV0IiwiZG9tRWxlbWVudCIsIm9wdGlvbnMiLCJfYXBwIiwiX2F0dGFjaGVkIiwiX3RhcmdldCIsIl9lbmFibGVkIiwiX2xhc3RYIiwiX2xhc3RZIiwiX3VwSGFuZGxlciIsIl9oYW5kbGVVcCIsImJpbmQiLCJfZG93bkhhbmRsZXIiLCJfaGFuZGxlRG93biIsIl9tb3ZlSGFuZGxlciIsIl9oYW5kbGVNb3ZlIiwiX3doZWVsSGFuZGxlciIsIl9oYW5kbGVXaGVlbCIsIl90b3VjaHN0YXJ0SGFuZGxlciIsIl9oYW5kbGVUb3VjaFN0YXJ0IiwiX3RvdWNoZW5kSGFuZGxlciIsIl9oYW5kbGVUb3VjaEVuZCIsIl90b3VjaGNhbmNlbEhhbmRsZXIiLCJfdG91Y2htb3ZlSGFuZGxlciIsIl9oYW5kbGVUb3VjaE1vdmUiLCJfc29ydEhhbmRsZXIiLCJfc29ydEVsZW1lbnRzIiwiX2VsZW1lbnRzIiwiX2hvdmVyZWRFbGVtZW50IiwiX3ByZXNzZWRFbGVtZW50IiwiX3RvdWNoZWRFbGVtZW50cyIsIl90b3VjaGVzRm9yV2hpY2hUb3VjaExlYXZlSGFzRmlyZWQiLCJfc2VsZWN0ZWRFbGVtZW50cyIsIl9zZWxlY3RlZFByZXNzZWRFbGVtZW50cyIsIl91c2VNb3VzZSIsInVzZU1vdXNlIiwiX3VzZVRvdWNoIiwidXNlVG91Y2giLCJfdXNlWHIiLCJ1c2VYciIsIl9zZWxlY3RFdmVudHNBdHRhY2hlZCIsInBsYXRmb3JtIiwiX2NsaWNrZWRFbnRpdGllcyIsImF0dGFjaCIsImVuYWJsZWQiLCJ2YWx1ZSIsImFwcCIsImdldEFwcGxpY2F0aW9uIiwiZGV0YWNoIiwib3B0cyIsInBhc3NpdmVFdmVudHMiLCJwYXNzaXZlIiwid2luZG93IiwiYWRkRXZlbnRMaXN0ZW5lciIsImF0dGFjaFNlbGVjdEV2ZW50cyIsInhyIiwic3VwcG9ydGVkIiwib24iLCJfb25YclN0YXJ0IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm9mZiIsIl9vblhyRW5kIiwiX29uWHJVcGRhdGUiLCJpbnB1dCIsIl9vblNlbGVjdFN0YXJ0IiwiX29uU2VsZWN0RW5kIiwiX29uWHJJbnB1dFJlbW92ZSIsImFkZEVsZW1lbnQiLCJpbmRleE9mIiwicHVzaCIsInJlbW92ZUVsZW1lbnQiLCJpZHgiLCJzcGxpY2UiLCJfY2FsY01vdXNlQ29vcmRzIiwiX29uRWxlbWVudE1vdXNlRXZlbnQiLCJfZGV0ZXJtaW5lVG91Y2hlZEVsZW1lbnRzIiwidG91Y2hlZEVsZW1lbnRzIiwiY2FtZXJhcyIsInN5c3RlbXMiLCJpIiwibGVuZ3RoIiwiZG9uZSIsImxlbiIsImoiLCJpZGVudGlmaWVyIiwiY29vcmRzIiwiX2NhbGNUb3VjaENvb3JkcyIsIl9nZXRUYXJnZXRFbGVtZW50QnlDb29yZHMiLCJuZXdUb3VjaGVkRWxlbWVudHMiLCJuZXdUb3VjaEluZm8iLCJvbGRUb3VjaEluZm8iLCJfZmlyZUV2ZW50IiwidG91Y2hJZCIsImtleSIsInRvdWNoSW5mbyIsImMiLCJob3ZlcmVkIiwiZW50aXR5IiwiZ2V0R3VpZCIsInByZXZlbnREZWZhdWx0IiwiZXZlbnRUeXBlIiwibGFzdEhvdmVyZWQiLCJpbnB1dFNvdXJjZXMiLCJfb25FbGVtZW50U2VsZWN0RXZlbnQiLCJpZCIsIl9lbGVtZW50RW50aXR5IiwiaG92ZXJlZEJlZm9yZSIsImhvdmVyZWROb3ciLCJlbGVtZW50SW5wdXQiLCJzZXQiLCJnZXRPcmlnaW4iLCJnZXREaXJlY3Rpb24iLCJfZ2V0VGFyZ2V0RWxlbWVudEJ5UmF5IiwicHJlc3NlZCIsIm5hbWUiLCJldnQiLCJmaXJlIiwicGFyZW50IiwicmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsImxlZnQiLCJNYXRoIiwiZmxvb3IiLCJ0b3AiLCJjbGllbnRYIiwiY2xpZW50WSIsInRvdGFsT2Zmc2V0WCIsInRvdGFsT2Zmc2V0WSIsInRhcmdldCIsIkhUTUxFbGVtZW50IiwicGFyZW50Tm9kZSIsImN1cnJlbnRFbGVtZW50Iiwib2Zmc2V0TGVmdCIsInNjcm9sbExlZnQiLCJvZmZzZXRUb3AiLCJzY3JvbGxUb3AiLCJvZmZzZXRQYXJlbnQiLCJwYWdlWCIsInBhZ2VZIiwiYSIsImIiLCJsYXllck9yZGVyIiwic2NlbmUiLCJsYXllcnMiLCJzb3J0VHJhbnNwYXJlbnRMYXllcnMiLCJzY3JlZW4iLCJzY3JlZW5TcGFjZSIsImRyYXdPcmRlciIsInJheVNjcmVlbiIsIl9jYWxjdWxhdGVSYXlTY3JlZW4iLCJyYXkzZCIsIl9jYWxjdWxhdGVSYXkzZCIsIl9nZXRUYXJnZXRFbGVtZW50IiwicmF5Iiwib3JpZ2luIiwiZGlyZWN0aW9uIiwiZmFyQ2xpcCIsInNjcmVlblBvcyIsIndvcmxkVG9TY3JlZW4iLCJyZXN1bHQiLCJjbG9zZXN0RGlzdGFuY2UzZCIsIkluZmluaXR5Iiwic29ydCIsInNvbWUiLCJsYXllcnNTZXQiLCJoYXMiLCJjdXJyZW50RGlzdGFuY2UiLCJfY2hlY2tFbGVtZW50IiwiX2J1aWxkSGl0Q29ybmVycyIsInNjcmVlbk9yV29ybGRDb3JuZXJzIiwic2NhbGVYIiwic2NhbGVZIiwic2NhbGVaIiwiaGl0Q29ybmVycyIsImhpdFBhZGRpbmciLCJ1cCIsInJpZ2h0IiwieiIsImJvdHRvbSIsIl9jYWxjdWxhdGVTY2FsZVRvU2NyZWVuIiwiY3VycmVudCIsInNjcmVlblNjYWxlIiwic2NhbGUiLCJtdWwiLCJnZXRMb2NhbFNjYWxlIiwiX2NhbGN1bGF0ZVNjYWxlVG9Xb3JsZCIsInN3IiwiZ3JhcGhpY3NEZXZpY2UiLCJ3aWR0aCIsInNoIiwiaGVpZ2h0IiwiY2FtZXJhV2lkdGgiLCJjYW1lcmFIZWlnaHQiLCJjYW1lcmFMZWZ0IiwiY2FtZXJhUmlnaHQiLCJjYW1lcmFCb3R0b20iLCJjYW1lcmFUb3AiLCJfeCIsImNsaWVudFdpZHRoIiwiX3kiLCJjbGllbnRIZWlnaHQiLCJzY3JlZW5Ub1dvcmxkIiwibmVhckNsaXAiLCJtYXNrZWRCeSIsInNjcmVlbkNvcm5lcnMiLCJ3b3JsZENvcm5lcnMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQWVBLElBQUlBLE9BQUosRUFBYUMsT0FBYixDQUFBO0FBQ0EsTUFBTUMsSUFBSSxHQUFHLElBQUlDLElBQUosRUFBYixDQUFBO0FBQ0EsTUFBTUMsSUFBSSxHQUFHLElBQUlELElBQUosRUFBYixDQUFBO0FBRUEsTUFBTUUsSUFBSSxHQUFHLElBQUlDLEdBQUosRUFBYixDQUFBO0FBQ0EsTUFBTUMsSUFBSSxHQUFHLElBQUlELEdBQUosRUFBYixDQUFBO0FBQ0EsTUFBTUUsSUFBSSxHQUFHLElBQUlGLEdBQUosRUFBYixDQUFBO0FBRUFELElBQUksQ0FBQ0ksR0FBTCxHQUFXLElBQUlOLElBQUosRUFBWCxDQUFBO0FBQ0FJLElBQUksQ0FBQ0UsR0FBTCxHQUFXLElBQUlOLElBQUosRUFBWCxDQUFBO0FBQ0FLLElBQUksQ0FBQ0MsR0FBTCxHQUFXLElBQUlOLElBQUosRUFBWCxDQUFBOztBQUVBLE1BQU1PLEdBQUcsR0FBRyxJQUFJUCxJQUFKLEVBQVosQ0FBQTs7QUFDQSxNQUFNUSxHQUFHLEdBQUcsSUFBSVIsSUFBSixFQUFaLENBQUE7O0FBQ0EsTUFBTVMsR0FBRyxHQUFHLElBQUlULElBQUosRUFBWixDQUFBOztBQUNBLE1BQU1VLEdBQUcsR0FBRyxJQUFJVixJQUFKLEVBQVosQ0FBQTs7QUFDQSxNQUFNVyxHQUFHLEdBQUcsSUFBSVgsSUFBSixFQUFaLENBQUE7O0FBQ0EsTUFBTVksRUFBRSxHQUFHLElBQUlaLElBQUosRUFBWCxDQUFBOztBQUNBLE1BQU1hLEdBQUcsR0FBRyxJQUFJYixJQUFKLEVBQVosQ0FBQTs7QUFDQSxNQUFNYyxHQUFHLEdBQUcsSUFBSWQsSUFBSixFQUFaLENBQUE7O0FBQ0EsTUFBTWUsR0FBRyxHQUFHLElBQUlmLElBQUosRUFBWixDQUFBOztBQUNBLE1BQU1nQixHQUFHLEdBQUcsSUFBSWhCLElBQUosRUFBWixDQUFBOztBQUNBLE1BQU1pQixJQUFJLEdBQUcsSUFBSWpCLElBQUosRUFBYixDQUFBOztBQUNBLE1BQU1rQixpQkFBaUIsR0FBRyxJQUFJbEIsSUFBSixFQUExQixDQUFBOztBQUNBLE1BQU1tQixXQUFXLEdBQUcsSUFBSW5CLElBQUosRUFBcEIsQ0FBQTs7QUFDQSxNQUFNb0IsY0FBYyxHQUFHLElBQUlwQixJQUFKLEVBQXZCLENBQUE7O0FBQ0EsTUFBTXFCLFlBQVksR0FBRyxJQUFJckIsSUFBSixFQUFyQixDQUFBOztBQUNBLE1BQU1zQixhQUFhLEdBQUcsSUFBSXRCLElBQUosRUFBdEIsQ0FBQTs7QUFDQSxNQUFNdUIsaUJBQWlCLEdBQUcsSUFBSXZCLElBQUosRUFBMUIsQ0FBQTs7QUFDQSxNQUFNd0Isa0JBQWtCLEdBQUcsSUFBSXhCLElBQUosRUFBM0IsQ0FBQTs7QUFDQSxNQUFNeUIsZUFBZSxHQUFHLElBQUl6QixJQUFKLEVBQXhCLENBQUE7O0FBQ0EsTUFBTTBCLGNBQWMsR0FBRyxJQUFJMUIsSUFBSixFQUF2QixDQUFBOztBQUVBLE1BQU0yQixTQUFTLEdBQUcsSUFBSUMsSUFBSixFQUFsQixDQUFBOztBQUdBLFNBQVNDLFlBQVQsQ0FBc0JDLEVBQXRCLEVBQTBCQyxFQUExQixFQUE4QkMsRUFBOUIsRUFBa0M7RUFDOUIsT0FBT2YsSUFBSSxDQUFDZ0IsS0FBTCxDQUFXSCxFQUFYLEVBQWVDLEVBQWYsQ0FBbUJHLENBQUFBLEdBQW5CLENBQXVCRixFQUF2QixDQUFQLENBQUE7QUFDSCxDQUFBOztBQUlELFNBQVNHLGlCQUFULENBQTJCQyxDQUEzQixFQUE4QkMsQ0FBOUIsRUFBaUNDLE9BQWpDLEVBQTBDO0FBQ3RDL0IsRUFBQUEsR0FBRyxDQUFDZ0MsSUFBSixDQUFTRixDQUFULEVBQVlELENBQVosQ0FBQSxDQUFBOztFQUNBNUIsR0FBRyxDQUFDK0IsSUFBSixDQUFTRCxPQUFPLENBQUMsQ0FBRCxDQUFoQixFQUFxQkYsQ0FBckIsQ0FBQSxDQUFBOztFQUNBM0IsR0FBRyxDQUFDOEIsSUFBSixDQUFTRCxPQUFPLENBQUMsQ0FBRCxDQUFoQixFQUFxQkYsQ0FBckIsQ0FBQSxDQUFBOztFQUNBMUIsR0FBRyxDQUFDNkIsSUFBSixDQUFTRCxPQUFPLENBQUMsQ0FBRCxDQUFoQixFQUFxQkYsQ0FBckIsQ0FBQSxDQUFBOztBQUdBeEIsRUFBQUEsRUFBRSxDQUFDcUIsS0FBSCxDQUFTdkIsR0FBVCxFQUFjSCxHQUFkLENBQUEsQ0FBQTs7QUFDQSxFQUFBLElBQUlpQyxDQUFDLEdBQUdoQyxHQUFHLENBQUMwQixHQUFKLENBQVF0QixFQUFSLENBQVIsQ0FBQTs7QUFDQSxFQUFBLElBQUk2QixDQUFKLENBQUE7QUFDQSxFQUFBLElBQUlDLENBQUosQ0FBQTs7RUFFQSxJQUFJRixDQUFDLElBQUksQ0FBVCxFQUFZO0FBRVJDLElBQUFBLENBQUMsR0FBRyxDQUFDaEMsR0FBRyxDQUFDeUIsR0FBSixDQUFRdEIsRUFBUixDQUFMLENBQUE7QUFDQSxJQUFBLElBQUk2QixDQUFDLEdBQUcsQ0FBUixFQUNJLE9BQU8sQ0FBQyxDQUFSLENBQUE7SUFFSkMsQ0FBQyxHQUFHYixZQUFZLENBQUN0QixHQUFELEVBQU1FLEdBQU4sRUFBV0QsR0FBWCxDQUFoQixDQUFBO0FBQ0EsSUFBQSxJQUFJa0MsQ0FBQyxHQUFHLENBQVIsRUFDSSxPQUFPLENBQUMsQ0FBUixDQUFBO0lBRUosTUFBTUMsS0FBSyxHQUFHLEdBQU9GLElBQUFBLENBQUMsR0FBR0QsQ0FBSixHQUFRRSxDQUFmLENBQWQsQ0FBQTs7QUFFQTdCLElBQUFBLEdBQUcsQ0FBQytCLElBQUosQ0FBU04sT0FBTyxDQUFDLENBQUQsQ0FBaEIsQ0FBQSxDQUFxQk8sU0FBckIsQ0FBK0JKLENBQUMsR0FBR0UsS0FBbkMsQ0FBQSxDQUFBOztBQUNBN0IsSUFBQUEsR0FBRyxDQUFDOEIsSUFBSixDQUFTTixPQUFPLENBQUMsQ0FBRCxDQUFoQixDQUFBLENBQXFCTyxTQUFyQixDQUErQkwsQ0FBQyxHQUFHRyxLQUFuQyxDQUFBLENBQUE7O0FBQ0E1QixJQUFBQSxHQUFHLENBQUM2QixJQUFKLENBQVNOLE9BQU8sQ0FBQyxDQUFELENBQWhCLENBQUEsQ0FBcUJPLFNBQXJCLENBQStCSCxDQUFDLEdBQUdDLEtBQW5DLENBQUEsQ0FBQTs7SUFDQTNCLEdBQUcsQ0FBQzRCLElBQUosQ0FBUy9CLEdBQVQsQ0FBQSxDQUFjaUMsR0FBZCxDQUFrQmhDLEdBQWxCLENBQUEsQ0FBdUJnQyxHQUF2QixDQUEyQi9CLEdBQTNCLENBQUEsQ0FBQTtBQUNILEdBaEJELE1BZ0JPO0lBRUhKLEdBQUcsQ0FBQzRCLElBQUosQ0FBU0QsT0FBTyxDQUFDLENBQUQsQ0FBaEIsRUFBcUJGLENBQXJCLENBQUEsQ0FBQTs7QUFDQUssSUFBQUEsQ0FBQyxHQUFHOUIsR0FBRyxDQUFDdUIsR0FBSixDQUFRdEIsRUFBUixDQUFKLENBQUE7QUFDQSxJQUFBLElBQUk2QixDQUFDLEdBQUcsQ0FBUixFQUNJLE9BQU8sQ0FBQyxDQUFSLENBQUE7SUFFSkMsQ0FBQyxHQUFHYixZQUFZLENBQUN0QixHQUFELEVBQU1DLEdBQU4sRUFBV0csR0FBWCxDQUFoQixDQUFBO0FBQ0EsSUFBQSxJQUFJK0IsQ0FBQyxHQUFHLENBQVIsRUFDSSxPQUFPLENBQUMsQ0FBUixDQUFBO0lBRUpGLENBQUMsR0FBRyxDQUFDQSxDQUFMLENBQUE7SUFFQSxNQUFNRyxLQUFLLEdBQUcsR0FBT0YsSUFBQUEsQ0FBQyxHQUFHRCxDQUFKLEdBQVFFLENBQWYsQ0FBZCxDQUFBOztBQUVBN0IsSUFBQUEsR0FBRyxDQUFDK0IsSUFBSixDQUFTTixPQUFPLENBQUMsQ0FBRCxDQUFoQixDQUFBLENBQXFCTyxTQUFyQixDQUErQkosQ0FBQyxHQUFHRSxLQUFuQyxDQUFBLENBQUE7O0FBQ0E3QixJQUFBQSxHQUFHLENBQUM4QixJQUFKLENBQVNOLE9BQU8sQ0FBQyxDQUFELENBQWhCLENBQUEsQ0FBcUJPLFNBQXJCLENBQStCTCxDQUFDLEdBQUdHLEtBQW5DLENBQUEsQ0FBQTs7QUFDQTVCLElBQUFBLEdBQUcsQ0FBQzZCLElBQUosQ0FBU04sT0FBTyxDQUFDLENBQUQsQ0FBaEIsQ0FBQSxDQUFxQk8sU0FBckIsQ0FBK0JILENBQUMsR0FBR0MsS0FBbkMsQ0FBQSxDQUFBOztJQUNBM0IsR0FBRyxDQUFDNEIsSUFBSixDQUFTL0IsR0FBVCxDQUFBLENBQWNpQyxHQUFkLENBQWtCaEMsR0FBbEIsQ0FBQSxDQUF1QmdDLEdBQXZCLENBQTJCL0IsR0FBM0IsQ0FBQSxDQUFBO0FBQ0gsR0FBQTs7RUFJRCxJQUFJUixHQUFHLENBQUNnQyxJQUFKLENBQVNELE9BQU8sQ0FBQyxDQUFELENBQWhCLEVBQXFCQSxPQUFPLENBQUMsQ0FBRCxDQUE1QixFQUFpQ1MsUUFBakMsRUFBQSxHQUE4QyxTQUFTLE1BQTNELEVBQW1FLE9BQU8sQ0FBQyxDQUFSLENBQUE7RUFDbkUsSUFBSXhDLEdBQUcsQ0FBQ2dDLElBQUosQ0FBU0QsT0FBTyxDQUFDLENBQUQsQ0FBaEIsRUFBcUJBLE9BQU8sQ0FBQyxDQUFELENBQTVCLEVBQWlDUyxRQUFqQyxFQUFBLEdBQThDLFNBQVMsTUFBM0QsRUFBbUUsT0FBTyxDQUFDLENBQVIsQ0FBQTtBQUVuRSxFQUFBLE9BQU8vQixHQUFHLENBQUNnQyxHQUFKLENBQVFaLENBQVIsQ0FBQSxDQUFXVyxRQUFYLEVBQVAsQ0FBQTtBQUNILENBQUE7O0FBTUQsTUFBTUUsaUJBQU4sQ0FBd0I7QUFXcEJDLEVBQUFBLFdBQVcsQ0FBQ0MsS0FBRCxFQUFRQyxPQUFSLEVBQWlCQyxNQUFqQixFQUF5QjtJQU1oQyxJQUFLRixDQUFBQSxLQUFMLEdBQWFBLEtBQWIsQ0FBQTtJQU9BLElBQUtDLENBQUFBLE9BQUwsR0FBZUEsT0FBZixDQUFBO0lBT0EsSUFBS0MsQ0FBQUEsTUFBTCxHQUFjQSxNQUFkLENBQUE7SUFFQSxJQUFLQyxDQUFBQSxnQkFBTCxHQUF3QixLQUF4QixDQUFBO0FBQ0gsR0FBQTs7QUFNREMsRUFBQUEsZUFBZSxHQUFHO0lBQ2QsSUFBS0QsQ0FBQUEsZ0JBQUwsR0FBd0IsSUFBeEIsQ0FBQTs7SUFDQSxJQUFJLElBQUEsQ0FBS0gsS0FBVCxFQUFnQjtNQUNaLElBQUtBLENBQUFBLEtBQUwsQ0FBV0ssd0JBQVgsRUFBQSxDQUFBO01BQ0EsSUFBS0wsQ0FBQUEsS0FBTCxDQUFXSSxlQUFYLEVBQUEsQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztBQTlDbUIsQ0FBQTs7QUFzRHhCLE1BQU1FLGlCQUFOLFNBQWdDUixpQkFBaEMsQ0FBa0Q7QUFjOUNDLEVBQUFBLFdBQVcsQ0FBQ0MsS0FBRCxFQUFRQyxPQUFSLEVBQWlCQyxNQUFqQixFQUF5QkssQ0FBekIsRUFBNEJDLENBQTVCLEVBQStCQyxLQUEvQixFQUFzQ0MsS0FBdEMsRUFBNkM7QUFDcEQsSUFBQSxLQUFBLENBQU1WLEtBQU4sRUFBYUMsT0FBYixFQUFzQkMsTUFBdEIsQ0FBQSxDQUFBO0lBRUEsSUFBS0ssQ0FBQUEsQ0FBTCxHQUFTQSxDQUFULENBQUE7SUFDQSxJQUFLQyxDQUFBQSxDQUFMLEdBQVNBLENBQVQsQ0FBQTtBQU9BLElBQUEsSUFBQSxDQUFLRyxPQUFMLEdBQWVYLEtBQUssQ0FBQ1csT0FBTixJQUFpQixLQUFoQyxDQUFBO0FBTUEsSUFBQSxJQUFBLENBQUtDLE1BQUwsR0FBY1osS0FBSyxDQUFDWSxNQUFOLElBQWdCLEtBQTlCLENBQUE7QUFNQSxJQUFBLElBQUEsQ0FBS0MsUUFBTCxHQUFnQmIsS0FBSyxDQUFDYSxRQUFOLElBQWtCLEtBQWxDLENBQUE7QUFNQSxJQUFBLElBQUEsQ0FBS0MsT0FBTCxHQUFlZCxLQUFLLENBQUNjLE9BQU4sSUFBaUIsS0FBaEMsQ0FBQTtBQU9BLElBQUEsSUFBQSxDQUFLQyxNQUFMLEdBQWNmLEtBQUssQ0FBQ2UsTUFBcEIsQ0FBQTs7QUFFQSxJQUFBLElBQUlDLEtBQUssQ0FBQ0MsZUFBTixFQUFKLEVBQTZCO0FBTXpCLE1BQUEsSUFBQSxDQUFLQyxFQUFMLEdBQVVsQixLQUFLLENBQUNtQixTQUFOLElBQW1CbkIsS0FBSyxDQUFDb0IsZUFBekIsSUFBNENwQixLQUFLLENBQUNxQixZQUFsRCxJQUFrRSxDQUE1RSxDQUFBO0FBTUEsTUFBQSxJQUFBLENBQUtDLEVBQUwsR0FBVXRCLEtBQUssQ0FBQ3VCLFNBQU4sSUFBbUJ2QixLQUFLLENBQUN3QixlQUF6QixJQUE0Q3hCLEtBQUssQ0FBQ3lCLFlBQWxELElBQWtFLENBQTVFLENBQUE7QUFDSCxLQWJELE1BYU87QUFDSCxNQUFBLElBQUEsQ0FBS1AsRUFBTCxHQUFVWCxDQUFDLEdBQUdFLEtBQWQsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLYSxFQUFMLEdBQVVkLENBQUMsR0FBR0UsS0FBZCxDQUFBO0FBQ0gsS0FBQTs7SUFPRCxJQUFLZ0IsQ0FBQUEsVUFBTCxHQUFrQixDQUFsQixDQUFBOztBQUlBLElBQUEsSUFBSTFCLEtBQUssQ0FBQzJCLElBQU4sS0FBZSxPQUFuQixFQUE0QjtBQUN4QixNQUFBLElBQUkzQixLQUFLLENBQUM0QixNQUFOLEdBQWUsQ0FBbkIsRUFBc0I7UUFDbEIsSUFBS0YsQ0FBQUEsVUFBTCxHQUFrQixDQUFsQixDQUFBO0FBQ0gsT0FGRCxNQUVPLElBQUkxQixLQUFLLENBQUM0QixNQUFOLEdBQWUsQ0FBbkIsRUFBc0I7UUFDekIsSUFBS0YsQ0FBQUEsVUFBTCxHQUFrQixDQUFDLENBQW5CLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBdEY2QyxDQUFBOztBQThGbEQsTUFBTUcsaUJBQU4sU0FBZ0MvQixpQkFBaEMsQ0FBa0Q7QUFhOUNDLEVBQUFBLFdBQVcsQ0FBQ0MsS0FBRCxFQUFRQyxPQUFSLEVBQWlCQyxNQUFqQixFQUF5QkssQ0FBekIsRUFBNEJDLENBQTVCLEVBQStCc0IsS0FBL0IsRUFBc0M7QUFDN0MsSUFBQSxLQUFBLENBQU05QixLQUFOLEVBQWFDLE9BQWIsRUFBc0JDLE1BQXRCLENBQUEsQ0FBQTtBQVFBLElBQUEsSUFBQSxDQUFLNkIsT0FBTCxHQUFlL0IsS0FBSyxDQUFDK0IsT0FBckIsQ0FBQTtBQU9BLElBQUEsSUFBQSxDQUFLQyxjQUFMLEdBQXNCaEMsS0FBSyxDQUFDZ0MsY0FBNUIsQ0FBQTtJQUNBLElBQUt6QixDQUFBQSxDQUFMLEdBQVNBLENBQVQsQ0FBQTtJQUNBLElBQUtDLENBQUFBLENBQUwsR0FBU0EsQ0FBVCxDQUFBO0lBTUEsSUFBS3NCLENBQUFBLEtBQUwsR0FBYUEsS0FBYixDQUFBO0FBQ0gsR0FBQTs7QUF0QzZDLENBQUE7O0FBOENsRCxNQUFNRyxrQkFBTixTQUFpQ25DLGlCQUFqQyxDQUFtRDtFQVkvQ0MsV0FBVyxDQUFDQyxLQUFELEVBQVFDLE9BQVIsRUFBaUJDLE1BQWpCLEVBQXlCZ0MsV0FBekIsRUFBc0M7QUFDN0MsSUFBQSxLQUFBLENBQU1sQyxLQUFOLEVBQWFDLE9BQWIsRUFBc0JDLE1BQXRCLENBQUEsQ0FBQTtJQU9BLElBQUtnQyxDQUFBQSxXQUFMLEdBQW1CQSxXQUFuQixDQUFBO0FBQ0gsR0FBQTs7QUFyQjhDLENBQUE7O0FBNEJuRCxNQUFNQyxZQUFOLENBQW1CO0FBVWZwQyxFQUFBQSxXQUFXLENBQUNxQyxVQUFELEVBQWFDLE9BQWIsRUFBc0I7SUFDN0IsSUFBS0MsQ0FBQUEsSUFBTCxHQUFZLElBQVosQ0FBQTtJQUNBLElBQUtDLENBQUFBLFNBQUwsR0FBaUIsS0FBakIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLE9BQUwsR0FBZSxJQUFmLENBQUE7SUFHQSxJQUFLQyxDQUFBQSxRQUFMLEdBQWdCLElBQWhCLENBQUE7SUFFQSxJQUFLQyxDQUFBQSxNQUFMLEdBQWMsQ0FBZCxDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsTUFBTCxHQUFjLENBQWQsQ0FBQTtJQUVBLElBQUtDLENBQUFBLFVBQUwsR0FBa0IsSUFBS0MsQ0FBQUEsU0FBTCxDQUFlQyxJQUFmLENBQW9CLElBQXBCLENBQWxCLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxZQUFMLEdBQW9CLElBQUtDLENBQUFBLFdBQUwsQ0FBaUJGLElBQWpCLENBQXNCLElBQXRCLENBQXBCLENBQUE7SUFDQSxJQUFLRyxDQUFBQSxZQUFMLEdBQW9CLElBQUtDLENBQUFBLFdBQUwsQ0FBaUJKLElBQWpCLENBQXNCLElBQXRCLENBQXBCLENBQUE7SUFDQSxJQUFLSyxDQUFBQSxhQUFMLEdBQXFCLElBQUtDLENBQUFBLFlBQUwsQ0FBa0JOLElBQWxCLENBQXVCLElBQXZCLENBQXJCLENBQUE7SUFDQSxJQUFLTyxDQUFBQSxrQkFBTCxHQUEwQixJQUFLQyxDQUFBQSxpQkFBTCxDQUF1QlIsSUFBdkIsQ0FBNEIsSUFBNUIsQ0FBMUIsQ0FBQTtJQUNBLElBQUtTLENBQUFBLGdCQUFMLEdBQXdCLElBQUtDLENBQUFBLGVBQUwsQ0FBcUJWLElBQXJCLENBQTBCLElBQTFCLENBQXhCLENBQUE7SUFDQSxJQUFLVyxDQUFBQSxtQkFBTCxHQUEyQixJQUFBLENBQUtGLGdCQUFoQyxDQUFBO0lBQ0EsSUFBS0csQ0FBQUEsaUJBQUwsR0FBeUIsSUFBS0MsQ0FBQUEsZ0JBQUwsQ0FBc0JiLElBQXRCLENBQTJCLElBQTNCLENBQXpCLENBQUE7SUFDQSxJQUFLYyxDQUFBQSxZQUFMLEdBQW9CLElBQUtDLENBQUFBLGFBQUwsQ0FBbUJmLElBQW5CLENBQXdCLElBQXhCLENBQXBCLENBQUE7SUFFQSxJQUFLZ0IsQ0FBQUEsU0FBTCxHQUFpQixFQUFqQixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsZUFBTCxHQUF1QixJQUF2QixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsZUFBTCxHQUF1QixJQUF2QixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsZ0JBQUwsR0FBd0IsRUFBeEIsQ0FBQTtJQUNBLElBQUtDLENBQUFBLGtDQUFMLEdBQTBDLEVBQTFDLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxpQkFBTCxHQUF5QixFQUF6QixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsd0JBQUwsR0FBZ0MsRUFBaEMsQ0FBQTtJQUVBLElBQUtDLENBQUFBLFNBQUwsR0FBaUIsQ0FBQ2hDLE9BQUQsSUFBWUEsT0FBTyxDQUFDaUMsUUFBUixLQUFxQixLQUFsRCxDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsU0FBTCxHQUFpQixDQUFDbEMsT0FBRCxJQUFZQSxPQUFPLENBQUNtQyxRQUFSLEtBQXFCLEtBQWxELENBQUE7SUFDQSxJQUFLQyxDQUFBQSxNQUFMLEdBQWMsQ0FBQ3BDLE9BQUQsSUFBWUEsT0FBTyxDQUFDcUMsS0FBUixLQUFrQixLQUE1QyxDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEscUJBQUwsR0FBNkIsS0FBN0IsQ0FBQTtBQUVBLElBQUEsSUFBSUMsUUFBUSxDQUFDOUMsS0FBYixFQUNJLElBQUsrQyxDQUFBQSxnQkFBTCxHQUF3QixFQUF4QixDQUFBO0lBRUosSUFBS0MsQ0FBQUEsTUFBTCxDQUFZMUMsVUFBWixDQUFBLENBQUE7QUFDSCxHQUFBOztFQUVVLElBQVAyQyxPQUFPLENBQUNDLEtBQUQsRUFBUTtJQUNmLElBQUt2QyxDQUFBQSxRQUFMLEdBQWdCdUMsS0FBaEIsQ0FBQTtBQUNILEdBQUE7O0FBRVUsRUFBQSxJQUFQRCxPQUFPLEdBQUc7QUFDVixJQUFBLE9BQU8sS0FBS3RDLFFBQVosQ0FBQTtBQUNILEdBQUE7O0VBRU0sSUFBSHdDLEdBQUcsQ0FBQ0QsS0FBRCxFQUFRO0lBQ1gsSUFBSzFDLENBQUFBLElBQUwsR0FBWTBDLEtBQVosQ0FBQTtBQUNILEdBQUE7O0FBRU0sRUFBQSxJQUFIQyxHQUFHLEdBQUc7QUFDTixJQUFBLE9BQU8sSUFBSzNDLENBQUFBLElBQUwsSUFBYTRDLGNBQWMsRUFBbEMsQ0FBQTtBQUNILEdBQUE7O0VBT0RKLE1BQU0sQ0FBQzFDLFVBQUQsRUFBYTtJQUNmLElBQUksSUFBQSxDQUFLRyxTQUFULEVBQW9CO01BQ2hCLElBQUtBLENBQUFBLFNBQUwsR0FBaUIsS0FBakIsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLNEMsTUFBTCxFQUFBLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUszQyxDQUFBQSxPQUFMLEdBQWVKLFVBQWYsQ0FBQTtJQUNBLElBQUtHLENBQUFBLFNBQUwsR0FBaUIsSUFBakIsQ0FBQTtBQUVBLElBQUEsTUFBTTZDLElBQUksR0FBR1IsUUFBUSxDQUFDUyxhQUFULEdBQXlCO0FBQUVDLE1BQUFBLE9BQU8sRUFBRSxJQUFBO0FBQVgsS0FBekIsR0FBNkMsS0FBMUQsQ0FBQTs7SUFDQSxJQUFJLElBQUEsQ0FBS2pCLFNBQVQsRUFBb0I7TUFDaEJrQixNQUFNLENBQUNDLGdCQUFQLENBQXdCLFNBQXhCLEVBQW1DLElBQUs1QyxDQUFBQSxVQUF4QyxFQUFvRHdDLElBQXBELENBQUEsQ0FBQTtNQUNBRyxNQUFNLENBQUNDLGdCQUFQLENBQXdCLFdBQXhCLEVBQXFDLElBQUt6QyxDQUFBQSxZQUExQyxFQUF3RHFDLElBQXhELENBQUEsQ0FBQTtNQUNBRyxNQUFNLENBQUNDLGdCQUFQLENBQXdCLFdBQXhCLEVBQXFDLElBQUt2QyxDQUFBQSxZQUExQyxFQUF3RG1DLElBQXhELENBQUEsQ0FBQTtNQUNBRyxNQUFNLENBQUNDLGdCQUFQLENBQXdCLE9BQXhCLEVBQWlDLElBQUtyQyxDQUFBQSxhQUF0QyxFQUFxRGlDLElBQXJELENBQUEsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxJQUFJLEtBQUtiLFNBQUwsSUFBa0JLLFFBQVEsQ0FBQzlDLEtBQS9CLEVBQXNDO01BQ2xDLElBQUtVLENBQUFBLE9BQUwsQ0FBYWdELGdCQUFiLENBQThCLFlBQTlCLEVBQTRDLElBQUEsQ0FBS25DLGtCQUFqRCxFQUFxRStCLElBQXJFLENBQUEsQ0FBQTs7TUFHQSxJQUFLNUMsQ0FBQUEsT0FBTCxDQUFhZ0QsZ0JBQWIsQ0FBOEIsVUFBOUIsRUFBMEMsSUFBQSxDQUFLakMsZ0JBQS9DLEVBQWlFLEtBQWpFLENBQUEsQ0FBQTs7TUFDQSxJQUFLZixDQUFBQSxPQUFMLENBQWFnRCxnQkFBYixDQUE4QixXQUE5QixFQUEyQyxJQUFBLENBQUs5QixpQkFBaEQsRUFBbUUsS0FBbkUsQ0FBQSxDQUFBOztNQUNBLElBQUtsQixDQUFBQSxPQUFMLENBQWFnRCxnQkFBYixDQUE4QixhQUE5QixFQUE2QyxJQUFBLENBQUsvQixtQkFBbEQsRUFBdUUsS0FBdkUsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLElBQUEsQ0FBS2dDLGtCQUFMLEVBQUEsQ0FBQTtBQUNILEdBQUE7O0FBRURBLEVBQUFBLGtCQUFrQixHQUFHO0lBQ2pCLElBQUksQ0FBQyxLQUFLZCxxQkFBTixJQUErQixLQUFLRixNQUFwQyxJQUE4QyxLQUFLUSxHQUFuRCxJQUEwRCxLQUFLQSxHQUFMLENBQVNTLEVBQW5FLElBQXlFLElBQUEsQ0FBS1QsR0FBTCxDQUFTUyxFQUFULENBQVlDLFNBQXpGLEVBQW9HO0FBQ2hHLE1BQUEsSUFBSSxDQUFDLElBQUtkLENBQUFBLGdCQUFWLEVBQ0ksSUFBS0EsQ0FBQUEsZ0JBQUwsR0FBd0IsRUFBeEIsQ0FBQTtNQUVKLElBQUtGLENBQUFBLHFCQUFMLEdBQTZCLElBQTdCLENBQUE7TUFDQSxJQUFLTSxDQUFBQSxHQUFMLENBQVNTLEVBQVQsQ0FBWUUsRUFBWixDQUFlLE9BQWYsRUFBd0IsSUFBQSxDQUFLQyxVQUE3QixFQUF5QyxJQUF6QyxDQUFBLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7QUFLRFYsRUFBQUEsTUFBTSxHQUFHO0lBQ0wsSUFBSSxDQUFDLElBQUs1QyxDQUFBQSxTQUFWLEVBQXFCLE9BQUE7SUFDckIsSUFBS0EsQ0FBQUEsU0FBTCxHQUFpQixLQUFqQixDQUFBO0FBRUEsSUFBQSxNQUFNNkMsSUFBSSxHQUFHUixRQUFRLENBQUNTLGFBQVQsR0FBeUI7QUFBRUMsTUFBQUEsT0FBTyxFQUFFLElBQUE7QUFBWCxLQUF6QixHQUE2QyxLQUExRCxDQUFBOztJQUNBLElBQUksSUFBQSxDQUFLakIsU0FBVCxFQUFvQjtNQUNoQmtCLE1BQU0sQ0FBQ08sbUJBQVAsQ0FBMkIsU0FBM0IsRUFBc0MsSUFBS2xELENBQUFBLFVBQTNDLEVBQXVEd0MsSUFBdkQsQ0FBQSxDQUFBO01BQ0FHLE1BQU0sQ0FBQ08sbUJBQVAsQ0FBMkIsV0FBM0IsRUFBd0MsSUFBSy9DLENBQUFBLFlBQTdDLEVBQTJEcUMsSUFBM0QsQ0FBQSxDQUFBO01BQ0FHLE1BQU0sQ0FBQ08sbUJBQVAsQ0FBMkIsV0FBM0IsRUFBd0MsSUFBSzdDLENBQUFBLFlBQTdDLEVBQTJEbUMsSUFBM0QsQ0FBQSxDQUFBO01BQ0FHLE1BQU0sQ0FBQ08sbUJBQVAsQ0FBMkIsT0FBM0IsRUFBb0MsSUFBSzNDLENBQUFBLGFBQXpDLEVBQXdEaUMsSUFBeEQsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFJLElBQUEsQ0FBS2IsU0FBVCxFQUFvQjtNQUNoQixJQUFLL0IsQ0FBQUEsT0FBTCxDQUFhc0QsbUJBQWIsQ0FBaUMsWUFBakMsRUFBK0MsSUFBQSxDQUFLekMsa0JBQXBELEVBQXdFK0IsSUFBeEUsQ0FBQSxDQUFBOztNQUNBLElBQUs1QyxDQUFBQSxPQUFMLENBQWFzRCxtQkFBYixDQUFpQyxVQUFqQyxFQUE2QyxJQUFBLENBQUt2QyxnQkFBbEQsRUFBb0UsS0FBcEUsQ0FBQSxDQUFBOztNQUNBLElBQUtmLENBQUFBLE9BQUwsQ0FBYXNELG1CQUFiLENBQWlDLFdBQWpDLEVBQThDLElBQUEsQ0FBS3BDLGlCQUFuRCxFQUFzRSxLQUF0RSxDQUFBLENBQUE7O01BQ0EsSUFBS2xCLENBQUFBLE9BQUwsQ0FBYXNELG1CQUFiLENBQWlDLGFBQWpDLEVBQWdELElBQUEsQ0FBS3JDLG1CQUFyRCxFQUEwRSxLQUExRSxDQUFBLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUksSUFBQSxDQUFLa0IscUJBQVQsRUFBZ0M7TUFDNUIsSUFBS0EsQ0FBQUEscUJBQUwsR0FBNkIsS0FBN0IsQ0FBQTtNQUNBLElBQUtNLENBQUFBLEdBQUwsQ0FBU1MsRUFBVCxDQUFZSyxHQUFaLENBQWdCLE9BQWhCLEVBQXlCLElBQUEsQ0FBS0YsVUFBOUIsRUFBMEMsSUFBMUMsQ0FBQSxDQUFBO01BQ0EsSUFBS1osQ0FBQUEsR0FBTCxDQUFTUyxFQUFULENBQVlLLEdBQVosQ0FBZ0IsS0FBaEIsRUFBdUIsSUFBQSxDQUFLQyxRQUE1QixFQUFzQyxJQUF0QyxDQUFBLENBQUE7TUFDQSxJQUFLZixDQUFBQSxHQUFMLENBQVNTLEVBQVQsQ0FBWUssR0FBWixDQUFnQixRQUFoQixFQUEwQixJQUFBLENBQUtFLFdBQS9CLEVBQTRDLElBQTVDLENBQUEsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLaEIsR0FBTCxDQUFTUyxFQUFULENBQVlRLEtBQVosQ0FBa0JILEdBQWxCLENBQXNCLGFBQXRCLEVBQXFDLElBQUtJLENBQUFBLGNBQTFDLEVBQTBELElBQTFELENBQUEsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLbEIsR0FBTCxDQUFTUyxFQUFULENBQVlRLEtBQVosQ0FBa0JILEdBQWxCLENBQXNCLFdBQXRCLEVBQW1DLElBQUtLLENBQUFBLFlBQXhDLEVBQXNELElBQXRELENBQUEsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLbkIsR0FBTCxDQUFTUyxFQUFULENBQVlRLEtBQVosQ0FBa0JILEdBQWxCLENBQXNCLFFBQXRCLEVBQWdDLElBQUtNLENBQUFBLGdCQUFyQyxFQUF1RCxJQUF2RCxDQUFBLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUs3RCxDQUFBQSxPQUFMLEdBQWUsSUFBZixDQUFBO0FBQ0gsR0FBQTs7RUFRRDhELFVBQVUsQ0FBQ3JHLE9BQUQsRUFBVTtBQUNoQixJQUFBLElBQUksSUFBSzZELENBQUFBLFNBQUwsQ0FBZXlDLE9BQWYsQ0FBdUJ0RyxPQUF2QixDQUFBLEtBQW9DLENBQUMsQ0FBekMsRUFDSSxJQUFLNkQsQ0FBQUEsU0FBTCxDQUFlMEMsSUFBZixDQUFvQnZHLE9BQXBCLENBQUEsQ0FBQTtBQUNQLEdBQUE7O0VBUUR3RyxhQUFhLENBQUN4RyxPQUFELEVBQVU7SUFDbkIsTUFBTXlHLEdBQUcsR0FBRyxJQUFLNUMsQ0FBQUEsU0FBTCxDQUFleUMsT0FBZixDQUF1QnRHLE9BQXZCLENBQVosQ0FBQTs7QUFDQSxJQUFBLElBQUl5RyxHQUFHLEtBQUssQ0FBQyxDQUFiLEVBQ0ksSUFBQSxDQUFLNUMsU0FBTCxDQUFlNkMsTUFBZixDQUFzQkQsR0FBdEIsRUFBMkIsQ0FBM0IsQ0FBQSxDQUFBO0FBQ1AsR0FBQTs7RUFFRDdELFNBQVMsQ0FBQzdDLEtBQUQsRUFBUTtJQUNiLElBQUksQ0FBQyxJQUFLeUMsQ0FBQUEsUUFBVixFQUFvQixPQUFBO0FBRXBCLElBQUEsSUFBSXpCLEtBQUssQ0FBQ0MsZUFBTixFQUFKLEVBQ0ksT0FBQTs7SUFFSixJQUFLMkYsQ0FBQUEsZ0JBQUwsQ0FBc0I1RyxLQUF0QixDQUFBLENBQUE7O0FBRUEsSUFBQSxJQUFBLENBQUs2RyxvQkFBTCxDQUEwQixTQUExQixFQUFxQzdHLEtBQXJDLENBQUEsQ0FBQTtBQUNILEdBQUE7O0VBRURnRCxXQUFXLENBQUNoRCxLQUFELEVBQVE7SUFDZixJQUFJLENBQUMsSUFBS3lDLENBQUFBLFFBQVYsRUFBb0IsT0FBQTtBQUVwQixJQUFBLElBQUl6QixLQUFLLENBQUNDLGVBQU4sRUFBSixFQUNJLE9BQUE7O0lBRUosSUFBSzJGLENBQUFBLGdCQUFMLENBQXNCNUcsS0FBdEIsQ0FBQSxDQUFBOztBQUVBLElBQUEsSUFBQSxDQUFLNkcsb0JBQUwsQ0FBMEIsV0FBMUIsRUFBdUM3RyxLQUF2QyxDQUFBLENBQUE7QUFDSCxHQUFBOztFQUVEa0QsV0FBVyxDQUFDbEQsS0FBRCxFQUFRO0lBQ2YsSUFBSSxDQUFDLElBQUt5QyxDQUFBQSxRQUFWLEVBQW9CLE9BQUE7O0lBRXBCLElBQUttRSxDQUFBQSxnQkFBTCxDQUFzQjVHLEtBQXRCLENBQUEsQ0FBQTs7QUFFQSxJQUFBLElBQUEsQ0FBSzZHLG9CQUFMLENBQTBCLFdBQTFCLEVBQXVDN0csS0FBdkMsQ0FBQSxDQUFBOztJQUVBLElBQUswQyxDQUFBQSxNQUFMLEdBQWNoRyxPQUFkLENBQUE7SUFDQSxJQUFLaUcsQ0FBQUEsTUFBTCxHQUFjaEcsT0FBZCxDQUFBO0FBQ0gsR0FBQTs7RUFFRHlHLFlBQVksQ0FBQ3BELEtBQUQsRUFBUTtJQUNoQixJQUFJLENBQUMsSUFBS3lDLENBQUFBLFFBQVYsRUFBb0IsT0FBQTs7SUFFcEIsSUFBS21FLENBQUFBLGdCQUFMLENBQXNCNUcsS0FBdEIsQ0FBQSxDQUFBOztBQUVBLElBQUEsSUFBQSxDQUFLNkcsb0JBQUwsQ0FBMEIsWUFBMUIsRUFBd0M3RyxLQUF4QyxDQUFBLENBQUE7QUFDSCxHQUFBOztFQUVEOEcseUJBQXlCLENBQUM5RyxLQUFELEVBQVE7SUFDN0IsTUFBTStHLGVBQWUsR0FBRyxFQUF4QixDQUFBO0lBQ0EsTUFBTUMsT0FBTyxHQUFHLElBQUsvQixDQUFBQSxHQUFMLENBQVNnQyxPQUFULENBQWlCL0csTUFBakIsQ0FBd0I4RyxPQUF4QyxDQUFBOztBQUtBLElBQUEsS0FBSyxJQUFJRSxDQUFDLEdBQUdGLE9BQU8sQ0FBQ0csTUFBUixHQUFpQixDQUE5QixFQUFpQ0QsQ0FBQyxJQUFJLENBQXRDLEVBQXlDQSxDQUFDLEVBQTFDLEVBQThDO0FBQzFDLE1BQUEsTUFBTWhILE1BQU0sR0FBRzhHLE9BQU8sQ0FBQ0UsQ0FBRCxDQUF0QixDQUFBO01BRUEsSUFBSUUsSUFBSSxHQUFHLENBQVgsQ0FBQTtBQUNBLE1BQUEsTUFBTUMsR0FBRyxHQUFHckgsS0FBSyxDQUFDZ0MsY0FBTixDQUFxQm1GLE1BQWpDLENBQUE7O01BQ0EsS0FBSyxJQUFJRyxDQUFDLEdBQUcsQ0FBYixFQUFnQkEsQ0FBQyxHQUFHRCxHQUFwQixFQUF5QkMsQ0FBQyxFQUExQixFQUE4QjtRQUMxQixJQUFJUCxlQUFlLENBQUMvRyxLQUFLLENBQUNnQyxjQUFOLENBQXFCc0YsQ0FBckIsQ0FBQSxDQUF3QkMsVUFBekIsQ0FBbkIsRUFBeUQ7VUFDckRILElBQUksRUFBQSxDQUFBO0FBQ0osVUFBQSxTQUFBO0FBQ0gsU0FBQTs7UUFFRCxNQUFNSSxNQUFNLEdBQUcsSUFBQSxDQUFLQyxnQkFBTCxDQUFzQnpILEtBQUssQ0FBQ2dDLGNBQU4sQ0FBcUJzRixDQUFyQixDQUF0QixDQUFmLENBQUE7O0FBRUEsUUFBQSxNQUFNckgsT0FBTyxHQUFHLElBQUt5SCxDQUFBQSx5QkFBTCxDQUErQnhILE1BQS9CLEVBQXVDc0gsTUFBTSxDQUFDakgsQ0FBOUMsRUFBaURpSCxNQUFNLENBQUNoSCxDQUF4RCxDQUFoQixDQUFBOztBQUNBLFFBQUEsSUFBSVAsT0FBSixFQUFhO1VBQ1RtSCxJQUFJLEVBQUEsQ0FBQTtVQUNKTCxlQUFlLENBQUMvRyxLQUFLLENBQUNnQyxjQUFOLENBQXFCc0YsQ0FBckIsQ0FBQSxDQUF3QkMsVUFBekIsQ0FBZixHQUFzRDtBQUNsRHRILFlBQUFBLE9BQU8sRUFBRUEsT0FEeUM7QUFFbERDLFlBQUFBLE1BQU0sRUFBRUEsTUFGMEM7WUFHbERLLENBQUMsRUFBRWlILE1BQU0sQ0FBQ2pILENBSHdDO1lBSWxEQyxDQUFDLEVBQUVnSCxNQUFNLENBQUNoSCxDQUFBQTtXQUpkLENBQUE7QUFNSCxTQUFBO0FBQ0osT0FBQTs7TUFFRCxJQUFJNEcsSUFBSSxLQUFLQyxHQUFiLEVBQWtCO0FBQ2QsUUFBQSxNQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0FBRUQsSUFBQSxPQUFPTixlQUFQLENBQUE7QUFDSCxHQUFBOztFQUVEekQsaUJBQWlCLENBQUN0RCxLQUFELEVBQVE7SUFDckIsSUFBSSxDQUFDLElBQUt5QyxDQUFBQSxRQUFWLEVBQW9CLE9BQUE7O0FBRXBCLElBQUEsTUFBTWtGLGtCQUFrQixHQUFHLElBQUEsQ0FBS2IseUJBQUwsQ0FBK0I5RyxLQUEvQixDQUEzQixDQUFBOztBQUVBLElBQUEsS0FBSyxJQUFJa0gsQ0FBQyxHQUFHLENBQVIsRUFBV0csR0FBRyxHQUFHckgsS0FBSyxDQUFDZ0MsY0FBTixDQUFxQm1GLE1BQTNDLEVBQW1ERCxDQUFDLEdBQUdHLEdBQXZELEVBQTRESCxDQUFDLEVBQTdELEVBQWlFO0FBQzdELE1BQUEsTUFBTXBGLEtBQUssR0FBRzlCLEtBQUssQ0FBQ2dDLGNBQU4sQ0FBcUJrRixDQUFyQixDQUFkLENBQUE7QUFDQSxNQUFBLE1BQU1VLFlBQVksR0FBR0Qsa0JBQWtCLENBQUM3RixLQUFLLENBQUN5RixVQUFQLENBQXZDLENBQUE7TUFDQSxNQUFNTSxZQUFZLEdBQUcsSUFBSzVELENBQUFBLGdCQUFMLENBQXNCbkMsS0FBSyxDQUFDeUYsVUFBNUIsQ0FBckIsQ0FBQTs7QUFFQSxNQUFBLElBQUlLLFlBQVksS0FBSyxDQUFDQyxZQUFELElBQWlCRCxZQUFZLENBQUMzSCxPQUFiLEtBQXlCNEgsWUFBWSxDQUFDNUgsT0FBNUQsQ0FBaEIsRUFBc0Y7QUFDbEYsUUFBQSxJQUFBLENBQUs2SCxVQUFMLENBQWdCOUgsS0FBSyxDQUFDMkIsSUFBdEIsRUFBNEIsSUFBSUUsaUJBQUosQ0FBc0I3QixLQUF0QixFQUE2QjRILFlBQVksQ0FBQzNILE9BQTFDLEVBQW1EMkgsWUFBWSxDQUFDMUgsTUFBaEUsRUFBd0UwSCxZQUFZLENBQUNySCxDQUFyRixFQUF3RnFILFlBQVksQ0FBQ3BILENBQXJHLEVBQXdHc0IsS0FBeEcsQ0FBNUIsQ0FBQSxDQUFBOztBQUNBLFFBQUEsSUFBQSxDQUFLb0Msa0NBQUwsQ0FBd0NwQyxLQUFLLENBQUN5RixVQUE5QyxJQUE0RCxLQUE1RCxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0FBRUQsSUFBQSxLQUFLLE1BQU1RLE9BQVgsSUFBc0JKLGtCQUF0QixFQUEwQztBQUN0QyxNQUFBLElBQUEsQ0FBSzFELGdCQUFMLENBQXNCOEQsT0FBdEIsSUFBaUNKLGtCQUFrQixDQUFDSSxPQUFELENBQW5ELENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7RUFFRHZFLGVBQWUsQ0FBQ3hELEtBQUQsRUFBUTtJQUNuQixJQUFJLENBQUMsSUFBS3lDLENBQUFBLFFBQVYsRUFBb0IsT0FBQTtJQUVwQixNQUFNdUUsT0FBTyxHQUFHLElBQUsvQixDQUFBQSxHQUFMLENBQVNnQyxPQUFULENBQWlCL0csTUFBakIsQ0FBd0I4RyxPQUF4QyxDQUFBOztBQU1BLElBQUEsS0FBSyxNQUFNZ0IsR0FBWCxJQUFrQixJQUFBLENBQUtuRCxnQkFBdkIsRUFBeUM7QUFDckMsTUFBQSxPQUFPLElBQUtBLENBQUFBLGdCQUFMLENBQXNCbUQsR0FBdEIsQ0FBUCxDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLEtBQUssSUFBSWQsQ0FBQyxHQUFHLENBQVIsRUFBV0csR0FBRyxHQUFHckgsS0FBSyxDQUFDZ0MsY0FBTixDQUFxQm1GLE1BQTNDLEVBQW1ERCxDQUFDLEdBQUdHLEdBQXZELEVBQTRESCxDQUFDLEVBQTdELEVBQWlFO0FBQzdELE1BQUEsTUFBTXBGLEtBQUssR0FBRzlCLEtBQUssQ0FBQ2dDLGNBQU4sQ0FBcUJrRixDQUFyQixDQUFkLENBQUE7TUFDQSxNQUFNZSxTQUFTLEdBQUcsSUFBS2hFLENBQUFBLGdCQUFMLENBQXNCbkMsS0FBSyxDQUFDeUYsVUFBNUIsQ0FBbEIsQ0FBQTtNQUNBLElBQUksQ0FBQ1UsU0FBTCxFQUNJLFNBQUE7QUFFSixNQUFBLE1BQU1oSSxPQUFPLEdBQUdnSSxTQUFTLENBQUNoSSxPQUExQixDQUFBO0FBQ0EsTUFBQSxNQUFNQyxNQUFNLEdBQUcrSCxTQUFTLENBQUMvSCxNQUF6QixDQUFBO0FBQ0EsTUFBQSxNQUFNSyxDQUFDLEdBQUcwSCxTQUFTLENBQUMxSCxDQUFwQixDQUFBO0FBQ0EsTUFBQSxNQUFNQyxDQUFDLEdBQUd5SCxTQUFTLENBQUN6SCxDQUFwQixDQUFBO0FBRUEsTUFBQSxPQUFPLEtBQUt5RCxnQkFBTCxDQUFzQm5DLEtBQUssQ0FBQ3lGLFVBQTVCLENBQVAsQ0FBQTtBQUNBLE1BQUEsT0FBTyxLQUFLckQsa0NBQUwsQ0FBd0NwQyxLQUFLLENBQUN5RixVQUE5QyxDQUFQLENBQUE7O01BRUEsSUFBS08sQ0FBQUEsVUFBTCxDQUFnQjlILEtBQUssQ0FBQzJCLElBQXRCLEVBQTRCLElBQUlFLGlCQUFKLENBQXNCN0IsS0FBdEIsRUFBNkJDLE9BQTdCLEVBQXNDQyxNQUF0QyxFQUE4Q0ssQ0FBOUMsRUFBaURDLENBQWpELEVBQW9Ec0IsS0FBcEQsQ0FBNUIsQ0FBQSxDQUFBOztBQUlBLE1BQUEsTUFBTTBGLE1BQU0sR0FBRyxJQUFBLENBQUtDLGdCQUFMLENBQXNCM0YsS0FBdEIsQ0FBZixDQUFBOztBQUVBLE1BQUEsS0FBSyxJQUFJb0csQ0FBQyxHQUFHbEIsT0FBTyxDQUFDRyxNQUFSLEdBQWlCLENBQTlCLEVBQWlDZSxDQUFDLElBQUksQ0FBdEMsRUFBeUNBLENBQUMsRUFBMUMsRUFBOEM7QUFDMUMsUUFBQSxNQUFNQyxPQUFPLEdBQUcsSUFBQSxDQUFLVCx5QkFBTCxDQUErQlYsT0FBTyxDQUFDa0IsQ0FBRCxDQUF0QyxFQUEyQ1YsTUFBTSxDQUFDakgsQ0FBbEQsRUFBcURpSCxNQUFNLENBQUNoSCxDQUE1RCxDQUFoQixDQUFBOztRQUNBLElBQUkySCxPQUFPLEtBQUtsSSxPQUFoQixFQUF5QjtVQUVyQixJQUFJLENBQUMsSUFBSzRFLENBQUFBLGdCQUFMLENBQXNCNUUsT0FBTyxDQUFDbUksTUFBUixDQUFlQyxPQUFmLEVBQXRCLENBQUwsRUFBc0Q7QUFDbEQsWUFBQSxJQUFBLENBQUtQLFVBQUwsQ0FBZ0IsT0FBaEIsRUFBeUIsSUFBSWpHLGlCQUFKLENBQXNCN0IsS0FBdEIsRUFBNkJDLE9BQTdCLEVBQXNDQyxNQUF0QyxFQUE4Q0ssQ0FBOUMsRUFBaURDLENBQWpELEVBQW9Ec0IsS0FBcEQsQ0FBekIsQ0FBQSxDQUFBOztZQUNBLElBQUsrQyxDQUFBQSxnQkFBTCxDQUFzQjVFLE9BQU8sQ0FBQ21JLE1BQVIsQ0FBZUMsT0FBZixFQUF0QixDQUFBLEdBQWtELElBQWxELENBQUE7QUFDSCxXQUFBO0FBRUosU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7RUFFRDFFLGdCQUFnQixDQUFDM0QsS0FBRCxFQUFRO0FBR3BCQSxJQUFBQSxLQUFLLENBQUNzSSxjQUFOLEVBQUEsQ0FBQTtJQUVBLElBQUksQ0FBQyxJQUFLN0YsQ0FBQUEsUUFBVixFQUFvQixPQUFBOztBQUVwQixJQUFBLE1BQU1rRixrQkFBa0IsR0FBRyxJQUFBLENBQUtiLHlCQUFMLENBQStCOUcsS0FBL0IsQ0FBM0IsQ0FBQTs7QUFFQSxJQUFBLEtBQUssSUFBSWtILENBQUMsR0FBRyxDQUFSLEVBQVdHLEdBQUcsR0FBR3JILEtBQUssQ0FBQ2dDLGNBQU4sQ0FBcUJtRixNQUEzQyxFQUFtREQsQ0FBQyxHQUFHRyxHQUF2RCxFQUE0REgsQ0FBQyxFQUE3RCxFQUFpRTtBQUM3RCxNQUFBLE1BQU1wRixLQUFLLEdBQUc5QixLQUFLLENBQUNnQyxjQUFOLENBQXFCa0YsQ0FBckIsQ0FBZCxDQUFBO0FBQ0EsTUFBQSxNQUFNVSxZQUFZLEdBQUdELGtCQUFrQixDQUFDN0YsS0FBSyxDQUFDeUYsVUFBUCxDQUF2QyxDQUFBO01BQ0EsTUFBTU0sWUFBWSxHQUFHLElBQUs1RCxDQUFBQSxnQkFBTCxDQUFzQm5DLEtBQUssQ0FBQ3lGLFVBQTVCLENBQXJCLENBQUE7O0FBRUEsTUFBQSxJQUFJTSxZQUFKLEVBQWtCO0FBQ2QsUUFBQSxNQUFNTCxNQUFNLEdBQUcsSUFBQSxDQUFLQyxnQkFBTCxDQUFzQjNGLEtBQXRCLENBQWYsQ0FBQTs7UUFHQSxJQUFJLENBQUMsQ0FBQzhGLFlBQUQsSUFBaUJBLFlBQVksQ0FBQzNILE9BQWIsS0FBeUI0SCxZQUFZLENBQUM1SCxPQUF4RCxLQUFvRSxDQUFDLEtBQUtpRSxrQ0FBTCxDQUF3Q3BDLEtBQUssQ0FBQ3lGLFVBQTlDLENBQXpFLEVBQW9JO1VBQ2hJLElBQUtPLENBQUFBLFVBQUwsQ0FBZ0IsWUFBaEIsRUFBOEIsSUFBSWpHLGlCQUFKLENBQXNCN0IsS0FBdEIsRUFBNkI2SCxZQUFZLENBQUM1SCxPQUExQyxFQUFtRDRILFlBQVksQ0FBQzNILE1BQWhFLEVBQXdFc0gsTUFBTSxDQUFDakgsQ0FBL0UsRUFBa0ZpSCxNQUFNLENBQUNoSCxDQUF6RixFQUE0RnNCLEtBQTVGLENBQTlCLENBQUEsQ0FBQTs7QUFRQSxVQUFBLElBQUEsQ0FBS29DLGtDQUFMLENBQXdDcEMsS0FBSyxDQUFDeUYsVUFBOUMsSUFBNEQsSUFBNUQsQ0FBQTtBQUNILFNBQUE7O1FBRUQsSUFBS08sQ0FBQUEsVUFBTCxDQUFnQixXQUFoQixFQUE2QixJQUFJakcsaUJBQUosQ0FBc0I3QixLQUF0QixFQUE2QjZILFlBQVksQ0FBQzVILE9BQTFDLEVBQW1ENEgsWUFBWSxDQUFDM0gsTUFBaEUsRUFBd0VzSCxNQUFNLENBQUNqSCxDQUEvRSxFQUFrRmlILE1BQU0sQ0FBQ2hILENBQXpGLEVBQTRGc0IsS0FBNUYsQ0FBN0IsQ0FBQSxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUVEK0UsRUFBQUEsb0JBQW9CLENBQUMwQixTQUFELEVBQVl2SSxLQUFaLEVBQW1CO0lBQ25DLElBQUlDLE9BQU8sR0FBRyxJQUFkLENBQUE7SUFFQSxNQUFNdUksV0FBVyxHQUFHLElBQUEsQ0FBS3pFLGVBQXpCLENBQUE7SUFDQSxJQUFLQSxDQUFBQSxlQUFMLEdBQXVCLElBQXZCLENBQUE7SUFFQSxNQUFNaUQsT0FBTyxHQUFHLElBQUsvQixDQUFBQSxHQUFMLENBQVNnQyxPQUFULENBQWlCL0csTUFBakIsQ0FBd0I4RyxPQUF4QyxDQUFBO0FBQ0EsSUFBQSxJQUFJOUcsTUFBSixDQUFBOztBQUtBLElBQUEsS0FBSyxJQUFJZ0gsQ0FBQyxHQUFHRixPQUFPLENBQUNHLE1BQVIsR0FBaUIsQ0FBOUIsRUFBaUNELENBQUMsSUFBSSxDQUF0QyxFQUF5Q0EsQ0FBQyxFQUExQyxFQUE4QztBQUMxQ2hILE1BQUFBLE1BQU0sR0FBRzhHLE9BQU8sQ0FBQ0UsQ0FBRCxDQUFoQixDQUFBO01BRUFqSCxPQUFPLEdBQUcsS0FBS3lILHlCQUFMLENBQStCeEgsTUFBL0IsRUFBdUN4RCxPQUF2QyxFQUFnREMsT0FBaEQsQ0FBVixDQUFBO0FBQ0EsTUFBQSxJQUFJc0QsT0FBSixFQUNJLE1BQUE7QUFDUCxLQUFBOztJQUdELElBQUs4RCxDQUFBQSxlQUFMLEdBQXVCOUQsT0FBdkIsQ0FBQTs7SUFHQSxJQUFJLENBQUNzSSxTQUFTLEtBQUssV0FBZCxJQUE2QkEsU0FBUyxLQUFLLFNBQTVDLEtBQTBELElBQUt2RSxDQUFBQSxlQUFuRSxFQUFvRjtNQUNoRixJQUFLOEQsQ0FBQUEsVUFBTCxDQUFnQlMsU0FBaEIsRUFBMkIsSUFBSWpJLGlCQUFKLENBQXNCTixLQUF0QixFQUE2QixJQUFLZ0UsQ0FBQUEsZUFBbEMsRUFBbUQ5RCxNQUFuRCxFQUEyRHhELE9BQTNELEVBQW9FQyxPQUFwRSxFQUE2RSxLQUFLK0YsTUFBbEYsRUFBMEYsSUFBS0MsQ0FBQUEsTUFBL0YsQ0FBM0IsQ0FBQSxDQUFBO0tBREosTUFFTyxJQUFJMUMsT0FBSixFQUFhO01BRWhCLElBQUs2SCxDQUFBQSxVQUFMLENBQWdCUyxTQUFoQixFQUEyQixJQUFJakksaUJBQUosQ0FBc0JOLEtBQXRCLEVBQTZCQyxPQUE3QixFQUFzQ0MsTUFBdEMsRUFBOEN4RCxPQUE5QyxFQUF1REMsT0FBdkQsRUFBZ0UsS0FBSytGLE1BQXJFLEVBQTZFLElBQUtDLENBQUFBLE1BQWxGLENBQTNCLENBQUEsQ0FBQTs7TUFFQSxJQUFJNEYsU0FBUyxLQUFLLFdBQWxCLEVBQStCO1FBQzNCLElBQUt2RSxDQUFBQSxlQUFMLEdBQXVCL0QsT0FBdkIsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsSUFBSXVJLFdBQVcsS0FBSyxJQUFLekUsQ0FBQUEsZUFBekIsRUFBMEM7QUFFdEMsTUFBQSxJQUFJeUUsV0FBSixFQUFpQjtRQUNiLElBQUtWLENBQUFBLFVBQUwsQ0FBZ0IsWUFBaEIsRUFBOEIsSUFBSXhILGlCQUFKLENBQXNCTixLQUF0QixFQUE2QndJLFdBQTdCLEVBQTBDdEksTUFBMUMsRUFBa0R4RCxPQUFsRCxFQUEyREMsT0FBM0QsRUFBb0UsS0FBSytGLE1BQXpFLEVBQWlGLElBQUtDLENBQUFBLE1BQXRGLENBQTlCLENBQUEsQ0FBQTtBQUNILE9BQUE7O01BR0QsSUFBSSxJQUFBLENBQUtvQixlQUFULEVBQTBCO1FBQ3RCLElBQUsrRCxDQUFBQSxVQUFMLENBQWdCLFlBQWhCLEVBQThCLElBQUl4SCxpQkFBSixDQUFzQk4sS0FBdEIsRUFBNkIsSUFBSytELENBQUFBLGVBQWxDLEVBQW1EN0QsTUFBbkQsRUFBMkR4RCxPQUEzRCxFQUFvRUMsT0FBcEUsRUFBNkUsS0FBSytGLE1BQWxGLEVBQTBGLElBQUtDLENBQUFBLE1BQS9GLENBQTlCLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBOztBQUVELElBQUEsSUFBSTRGLFNBQVMsS0FBSyxTQUFkLElBQTJCLElBQUEsQ0FBS3ZFLGVBQXBDLEVBQXFEO0FBRWpELE1BQUEsSUFBSSxJQUFLQSxDQUFBQSxlQUFMLEtBQXlCLElBQUEsQ0FBS0QsZUFBbEMsRUFBbUQ7UUFDL0MsSUFBS0MsQ0FBQUEsZUFBTCxHQUF1QixJQUF2QixDQUFBOztBQUdBLFFBQUEsSUFBSSxDQUFDLElBQUthLENBQUFBLGdCQUFOLElBQTBCLENBQUMsS0FBS0EsZ0JBQUwsQ0FBc0IsSUFBS2QsQ0FBQUEsZUFBTCxDQUFxQnFFLE1BQXJCLENBQTRCQyxPQUE1QixFQUF0QixDQUEvQixFQUE2RjtVQUN6RixJQUFLUCxDQUFBQSxVQUFMLENBQWdCLE9BQWhCLEVBQXlCLElBQUl4SCxpQkFBSixDQUFzQk4sS0FBdEIsRUFBNkIsSUFBSytELENBQUFBLGVBQWxDLEVBQW1EN0QsTUFBbkQsRUFBMkR4RCxPQUEzRCxFQUFvRUMsT0FBcEUsRUFBNkUsS0FBSytGLE1BQWxGLEVBQTBGLElBQUtDLENBQUFBLE1BQS9GLENBQXpCLENBQUEsQ0FBQTtBQUNILFNBQUE7QUFDSixPQVBELE1BT087UUFDSCxJQUFLcUIsQ0FBQUEsZUFBTCxHQUF1QixJQUF2QixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUVENkIsRUFBQUEsVUFBVSxHQUFHO0lBQ1QsSUFBS1osQ0FBQUEsR0FBTCxDQUFTUyxFQUFULENBQVlFLEVBQVosQ0FBZSxLQUFmLEVBQXNCLElBQUEsQ0FBS0ksUUFBM0IsRUFBcUMsSUFBckMsQ0FBQSxDQUFBO0lBQ0EsSUFBS2YsQ0FBQUEsR0FBTCxDQUFTUyxFQUFULENBQVlFLEVBQVosQ0FBZSxRQUFmLEVBQXlCLElBQUEsQ0FBS0ssV0FBOUIsRUFBMkMsSUFBM0MsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtoQixHQUFMLENBQVNTLEVBQVQsQ0FBWVEsS0FBWixDQUFrQk4sRUFBbEIsQ0FBcUIsYUFBckIsRUFBb0MsSUFBS08sQ0FBQUEsY0FBekMsRUFBeUQsSUFBekQsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtsQixHQUFMLENBQVNTLEVBQVQsQ0FBWVEsS0FBWixDQUFrQk4sRUFBbEIsQ0FBcUIsV0FBckIsRUFBa0MsSUFBS1EsQ0FBQUEsWUFBdkMsRUFBcUQsSUFBckQsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtuQixHQUFMLENBQVNTLEVBQVQsQ0FBWVEsS0FBWixDQUFrQk4sRUFBbEIsQ0FBcUIsUUFBckIsRUFBK0IsSUFBS1MsQ0FBQUEsZ0JBQXBDLEVBQXNELElBQXRELENBQUEsQ0FBQTtBQUNILEdBQUE7O0FBRURMLEVBQUFBLFFBQVEsR0FBRztJQUNQLElBQUtmLENBQUFBLEdBQUwsQ0FBU1MsRUFBVCxDQUFZSyxHQUFaLENBQWdCLFFBQWhCLEVBQTBCLElBQUEsQ0FBS0UsV0FBL0IsRUFBNEMsSUFBNUMsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtoQixHQUFMLENBQVNTLEVBQVQsQ0FBWVEsS0FBWixDQUFrQkgsR0FBbEIsQ0FBc0IsYUFBdEIsRUFBcUMsSUFBS0ksQ0FBQUEsY0FBMUMsRUFBMEQsSUFBMUQsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtsQixHQUFMLENBQVNTLEVBQVQsQ0FBWVEsS0FBWixDQUFrQkgsR0FBbEIsQ0FBc0IsV0FBdEIsRUFBbUMsSUFBS0ssQ0FBQUEsWUFBeEMsRUFBc0QsSUFBdEQsQ0FBQSxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtuQixHQUFMLENBQVNTLEVBQVQsQ0FBWVEsS0FBWixDQUFrQkgsR0FBbEIsQ0FBc0IsUUFBdEIsRUFBZ0MsSUFBS00sQ0FBQUEsZ0JBQXJDLEVBQXVELElBQXZELENBQUEsQ0FBQTtBQUNILEdBQUE7O0FBRURKLEVBQUFBLFdBQVcsR0FBRztJQUNWLElBQUksQ0FBQyxJQUFLeEQsQ0FBQUEsUUFBVixFQUFvQixPQUFBO0lBRXBCLE1BQU1nRyxZQUFZLEdBQUcsSUFBS3hELENBQUFBLEdBQUwsQ0FBU1MsRUFBVCxDQUFZUSxLQUFaLENBQWtCdUMsWUFBdkMsQ0FBQTs7QUFDQSxJQUFBLEtBQUssSUFBSXZCLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUd1QixZQUFZLENBQUN0QixNQUFqQyxFQUF5Q0QsQ0FBQyxFQUExQyxFQUE4QztNQUMxQyxJQUFLd0IsQ0FBQUEscUJBQUwsQ0FBMkIsWUFBM0IsRUFBeUNELFlBQVksQ0FBQ3ZCLENBQUQsQ0FBckQsRUFBMEQsSUFBMUQsQ0FBQSxDQUFBO0FBQ0gsS0FBQTtBQUNKLEdBQUE7O0VBRURiLGdCQUFnQixDQUFDbkUsV0FBRCxFQUFjO0lBQzFCLE1BQU1pRyxPQUFPLEdBQUcsSUFBS2hFLENBQUFBLGlCQUFMLENBQXVCakMsV0FBVyxDQUFDeUcsRUFBbkMsQ0FBaEIsQ0FBQTs7QUFDQSxJQUFBLElBQUlSLE9BQUosRUFBYTtNQUNUakcsV0FBVyxDQUFDMEcsY0FBWixHQUE2QixJQUE3QixDQUFBOztBQUNBLE1BQUEsSUFBQSxDQUFLZCxVQUFMLENBQWdCLGFBQWhCLEVBQStCLElBQUk3RixrQkFBSixDQUF1QixJQUF2QixFQUE2QmtHLE9BQTdCLEVBQXNDLElBQXRDLEVBQTRDakcsV0FBNUMsQ0FBL0IsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLE9BQU8sS0FBS2lDLGlCQUFMLENBQXVCakMsV0FBVyxDQUFDeUcsRUFBbkMsQ0FBUCxDQUFBO0FBQ0EsSUFBQSxPQUFPLEtBQUt2RSx3QkFBTCxDQUE4QmxDLFdBQVcsQ0FBQ3lHLEVBQTFDLENBQVAsQ0FBQTtBQUNILEdBQUE7O0FBRUR4QyxFQUFBQSxjQUFjLENBQUNqRSxXQUFELEVBQWNsQyxLQUFkLEVBQXFCO0lBQy9CLElBQUksQ0FBQyxJQUFLeUMsQ0FBQUEsUUFBVixFQUFvQixPQUFBOztBQUNwQixJQUFBLElBQUEsQ0FBS2lHLHFCQUFMLENBQTJCLGFBQTNCLEVBQTBDeEcsV0FBMUMsRUFBdURsQyxLQUF2RCxDQUFBLENBQUE7QUFDSCxHQUFBOztBQUVEb0csRUFBQUEsWUFBWSxDQUFDbEUsV0FBRCxFQUFjbEMsS0FBZCxFQUFxQjtJQUM3QixJQUFJLENBQUMsSUFBS3lDLENBQUFBLFFBQVYsRUFBb0IsT0FBQTs7QUFDcEIsSUFBQSxJQUFBLENBQUtpRyxxQkFBTCxDQUEyQixXQUEzQixFQUF3Q3hHLFdBQXhDLEVBQXFEbEMsS0FBckQsQ0FBQSxDQUFBO0FBQ0gsR0FBQTs7QUFFRDBJLEVBQUFBLHFCQUFxQixDQUFDSCxTQUFELEVBQVlyRyxXQUFaLEVBQXlCbEMsS0FBekIsRUFBZ0M7QUFDakQsSUFBQSxJQUFJQyxPQUFKLENBQUE7SUFFQSxNQUFNNEksYUFBYSxHQUFHLElBQUsxRSxDQUFBQSxpQkFBTCxDQUF1QmpDLFdBQVcsQ0FBQ3lHLEVBQW5DLENBQXRCLENBQUE7QUFDQSxJQUFBLElBQUlHLFVBQUosQ0FBQTtJQUVBLE1BQU05QixPQUFPLEdBQUcsSUFBSy9CLENBQUFBLEdBQUwsQ0FBU2dDLE9BQVQsQ0FBaUIvRyxNQUFqQixDQUF3QjhHLE9BQXhDLENBQUE7QUFDQSxJQUFBLElBQUk5RyxNQUFKLENBQUE7O0lBRUEsSUFBSWdDLFdBQVcsQ0FBQzZHLFlBQWhCLEVBQThCO01BQzFCN0wsSUFBSSxDQUFDOEwsR0FBTCxDQUFTOUcsV0FBVyxDQUFDK0csU0FBWixFQUFULEVBQWtDL0csV0FBVyxDQUFDZ0gsWUFBWixFQUFsQyxDQUFBLENBQUE7O0FBRUEsTUFBQSxLQUFLLElBQUloQyxDQUFDLEdBQUdGLE9BQU8sQ0FBQ0csTUFBUixHQUFpQixDQUE5QixFQUFpQ0QsQ0FBQyxJQUFJLENBQXRDLEVBQXlDQSxDQUFDLEVBQTFDLEVBQThDO0FBQzFDaEgsUUFBQUEsTUFBTSxHQUFHOEcsT0FBTyxDQUFDRSxDQUFELENBQWhCLENBQUE7QUFFQWpILFFBQUFBLE9BQU8sR0FBRyxJQUFLa0osQ0FBQUEsc0JBQUwsQ0FBNEJqTSxJQUE1QixFQUFrQ2dELE1BQWxDLENBQVYsQ0FBQTtBQUNBLFFBQUEsSUFBSUQsT0FBSixFQUNJLE1BQUE7QUFDUCxPQUFBO0FBQ0osS0FBQTs7QUFFRGlDLElBQUFBLFdBQVcsQ0FBQzBHLGNBQVosR0FBNkIzSSxPQUFPLElBQUksSUFBeEMsQ0FBQTs7QUFFQSxJQUFBLElBQUlBLE9BQUosRUFBYTtBQUNULE1BQUEsSUFBQSxDQUFLa0UsaUJBQUwsQ0FBdUJqQyxXQUFXLENBQUN5RyxFQUFuQyxJQUF5QzFJLE9BQXpDLENBQUE7QUFDQTZJLE1BQUFBLFVBQVUsR0FBRzdJLE9BQWIsQ0FBQTtBQUNILEtBSEQsTUFHTztBQUNILE1BQUEsT0FBTyxLQUFLa0UsaUJBQUwsQ0FBdUJqQyxXQUFXLENBQUN5RyxFQUFuQyxDQUFQLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUlFLGFBQWEsS0FBS0MsVUFBdEIsRUFBa0M7QUFDOUIsTUFBQSxJQUFJRCxhQUFKLEVBQW1CLElBQUEsQ0FBS2YsVUFBTCxDQUFnQixhQUFoQixFQUErQixJQUFJN0Ysa0JBQUosQ0FBdUJqQyxLQUF2QixFQUE4QjZJLGFBQTlCLEVBQTZDM0ksTUFBN0MsRUFBcURnQyxXQUFyRCxDQUEvQixDQUFBLENBQUE7QUFDbkIsTUFBQSxJQUFJNEcsVUFBSixFQUFnQixJQUFBLENBQUtoQixVQUFMLENBQWdCLGFBQWhCLEVBQStCLElBQUk3RixrQkFBSixDQUF1QmpDLEtBQXZCLEVBQThCOEksVUFBOUIsRUFBMEM1SSxNQUExQyxFQUFrRGdDLFdBQWxELENBQS9CLENBQUEsQ0FBQTtBQUNuQixLQUFBOztJQUVELElBQUlxRyxTQUFTLEtBQUssYUFBbEIsRUFBaUM7QUFDN0IsTUFBQSxJQUFBLENBQUtuRSx3QkFBTCxDQUE4QmxDLFdBQVcsQ0FBQ3lHLEVBQTFDLElBQWdERyxVQUFoRCxDQUFBO0FBQ0EsTUFBQSxJQUFJQSxVQUFKLEVBQWdCLElBQUEsQ0FBS2hCLFVBQUwsQ0FBZ0IsYUFBaEIsRUFBK0IsSUFBSTdGLGtCQUFKLENBQXVCakMsS0FBdkIsRUFBOEI4SSxVQUE5QixFQUEwQzVJLE1BQTFDLEVBQWtEZ0MsV0FBbEQsQ0FBL0IsQ0FBQSxDQUFBO0FBQ25CLEtBQUE7O0lBRUQsTUFBTWtILE9BQU8sR0FBRyxJQUFLaEYsQ0FBQUEsd0JBQUwsQ0FBOEJsQyxXQUFXLENBQUN5RyxFQUExQyxDQUFoQixDQUFBOztBQUNBLElBQUEsSUFBSSxDQUFDekcsV0FBVyxDQUFDNkcsWUFBYixJQUE2QkssT0FBakMsRUFBMEM7QUFDdEMsTUFBQSxPQUFPLEtBQUtoRix3QkFBTCxDQUE4QmxDLFdBQVcsQ0FBQ3lHLEVBQTFDLENBQVAsQ0FBQTtBQUNBLE1BQUEsSUFBSUUsYUFBSixFQUFtQixJQUFBLENBQUtmLFVBQUwsQ0FBZ0IsV0FBaEIsRUFBNkIsSUFBSTdGLGtCQUFKLENBQXVCakMsS0FBdkIsRUFBOEI2SSxhQUE5QixFQUE2QzNJLE1BQTdDLEVBQXFEZ0MsV0FBckQsQ0FBN0IsQ0FBQSxDQUFBO0FBQ3RCLEtBQUE7O0FBRUQsSUFBQSxJQUFJcUcsU0FBUyxLQUFLLFdBQWQsSUFBNkJyRyxXQUFXLENBQUM2RyxZQUE3QyxFQUEyRDtBQUN2RCxNQUFBLE9BQU8sS0FBSzNFLHdCQUFMLENBQThCbEMsV0FBVyxDQUFDeUcsRUFBMUMsQ0FBUCxDQUFBO0FBRUEsTUFBQSxJQUFJRSxhQUFKLEVBQW1CLElBQUEsQ0FBS2YsVUFBTCxDQUFnQixXQUFoQixFQUE2QixJQUFJN0Ysa0JBQUosQ0FBdUJqQyxLQUF2QixFQUE4QjZJLGFBQTlCLEVBQTZDM0ksTUFBN0MsRUFBcURnQyxXQUFyRCxDQUE3QixDQUFBLENBQUE7O0FBRW5CLE1BQUEsSUFBSWtILE9BQU8sSUFBSUEsT0FBTyxLQUFLUCxhQUEzQixFQUEwQztBQUN0QyxRQUFBLElBQUEsQ0FBS2YsVUFBTCxDQUFnQixPQUFoQixFQUF5QixJQUFJN0Ysa0JBQUosQ0FBdUJqQyxLQUF2QixFQUE4Qm9KLE9BQTlCLEVBQXVDbEosTUFBdkMsRUFBK0NnQyxXQUEvQyxDQUF6QixDQUFBLENBQUE7QUFDSCxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUQ0RixFQUFBQSxVQUFVLENBQUN1QixJQUFELEVBQU9DLEdBQVAsRUFBWTtBQUNsQixJQUFBLElBQUlySixPQUFPLEdBQUdxSixHQUFHLENBQUNySixPQUFsQixDQUFBOztBQUNBLElBQUEsT0FBTyxJQUFQLEVBQWE7QUFDVEEsTUFBQUEsT0FBTyxDQUFDc0osSUFBUixDQUFhRixJQUFiLEVBQW1CQyxHQUFuQixDQUFBLENBQUE7TUFDQSxJQUFJQSxHQUFHLENBQUNuSixnQkFBUixFQUNJLE1BQUE7QUFFSixNQUFBLElBQUksQ0FBQ0YsT0FBTyxDQUFDbUksTUFBUixDQUFlb0IsTUFBcEIsRUFDSSxNQUFBO0FBRUp2SixNQUFBQSxPQUFPLEdBQUdBLE9BQU8sQ0FBQ21JLE1BQVIsQ0FBZW9CLE1BQWYsQ0FBc0J2SixPQUFoQyxDQUFBO01BQ0EsSUFBSSxDQUFDQSxPQUFMLEVBQ0ksTUFBQTtBQUNQLEtBQUE7QUFDSixHQUFBOztFQUVEMkcsZ0JBQWdCLENBQUM1RyxLQUFELEVBQVE7QUFDcEIsSUFBQSxNQUFNeUosSUFBSSxHQUFHLElBQUEsQ0FBS2pILE9BQUwsQ0FBYWtILHFCQUFiLEVBQWIsQ0FBQTs7SUFDQSxNQUFNQyxJQUFJLEdBQUdDLElBQUksQ0FBQ0MsS0FBTCxDQUFXSixJQUFJLENBQUNFLElBQWhCLENBQWIsQ0FBQTtJQUNBLE1BQU1HLEdBQUcsR0FBR0YsSUFBSSxDQUFDQyxLQUFMLENBQVdKLElBQUksQ0FBQ0ssR0FBaEIsQ0FBWixDQUFBO0FBQ0FwTixJQUFBQSxPQUFPLEdBQUlzRCxLQUFLLENBQUMrSixPQUFOLEdBQWdCSixJQUEzQixDQUFBO0FBQ0FoTixJQUFBQSxPQUFPLEdBQUlxRCxLQUFLLENBQUNnSyxPQUFOLEdBQWdCRixHQUEzQixDQUFBO0FBQ0gsR0FBQTs7RUFFRHJDLGdCQUFnQixDQUFDM0YsS0FBRCxFQUFRO0lBQ3BCLElBQUltSSxZQUFZLEdBQUcsQ0FBbkIsQ0FBQTtJQUNBLElBQUlDLFlBQVksR0FBRyxDQUFuQixDQUFBO0FBQ0EsSUFBQSxJQUFJQyxNQUFNLEdBQUdySSxLQUFLLENBQUNxSSxNQUFuQixDQUFBOztBQUNBLElBQUEsT0FBTyxFQUFFQSxNQUFNLFlBQVlDLFdBQXBCLENBQVAsRUFBeUM7TUFDckNELE1BQU0sR0FBR0EsTUFBTSxDQUFDRSxVQUFoQixDQUFBO0FBQ0gsS0FBQTs7SUFDRCxJQUFJQyxjQUFjLEdBQUdILE1BQXJCLENBQUE7O0lBRUEsR0FBRztBQUNDRixNQUFBQSxZQUFZLElBQUlLLGNBQWMsQ0FBQ0MsVUFBZixHQUE0QkQsY0FBYyxDQUFDRSxVQUEzRCxDQUFBO0FBQ0FOLE1BQUFBLFlBQVksSUFBSUksY0FBYyxDQUFDRyxTQUFmLEdBQTJCSCxjQUFjLENBQUNJLFNBQTFELENBQUE7TUFDQUosY0FBYyxHQUFHQSxjQUFjLENBQUNLLFlBQWhDLENBQUE7QUFDSCxLQUpELFFBSVNMLGNBSlQsRUFBQTs7SUFPQSxPQUFPO0FBQ0gvSixNQUFBQSxDQUFDLEVBQUd1QixLQUFLLENBQUM4SSxLQUFOLEdBQWNYLFlBRGY7QUFFSHpKLE1BQUFBLENBQUMsRUFBR3NCLEtBQUssQ0FBQytJLEtBQU4sR0FBY1gsWUFBQUE7S0FGdEIsQ0FBQTtBQUlILEdBQUE7O0FBRURyRyxFQUFBQSxhQUFhLENBQUNpSCxDQUFELEVBQUlDLENBQUosRUFBTztBQUNoQixJQUFBLE1BQU1DLFVBQVUsR0FBRyxJQUFBLENBQUsvRixHQUFMLENBQVNnRyxLQUFULENBQWVDLE1BQWYsQ0FBc0JDLHFCQUF0QixDQUE0Q0wsQ0FBQyxDQUFDSSxNQUE5QyxFQUFzREgsQ0FBQyxDQUFDRyxNQUF4RCxDQUFuQixDQUFBO0FBQ0EsSUFBQSxJQUFJRixVQUFVLEtBQUssQ0FBbkIsRUFBc0IsT0FBT0EsVUFBUCxDQUFBO0lBRXRCLElBQUlGLENBQUMsQ0FBQ00sTUFBRixJQUFZLENBQUNMLENBQUMsQ0FBQ0ssTUFBbkIsRUFDSSxPQUFPLENBQUMsQ0FBUixDQUFBO0lBQ0osSUFBSSxDQUFDTixDQUFDLENBQUNNLE1BQUgsSUFBYUwsQ0FBQyxDQUFDSyxNQUFuQixFQUNJLE9BQU8sQ0FBUCxDQUFBO0lBQ0osSUFBSSxDQUFDTixDQUFDLENBQUNNLE1BQUgsSUFBYSxDQUFDTCxDQUFDLENBQUNLLE1BQXBCLEVBQ0ksT0FBTyxDQUFQLENBQUE7QUFFSixJQUFBLElBQUlOLENBQUMsQ0FBQ00sTUFBRixDQUFTQSxNQUFULENBQWdCQyxXQUFoQixJQUErQixDQUFDTixDQUFDLENBQUNLLE1BQUYsQ0FBU0EsTUFBVCxDQUFnQkMsV0FBcEQsRUFDSSxPQUFPLENBQUMsQ0FBUixDQUFBO0FBQ0osSUFBQSxJQUFJTixDQUFDLENBQUNLLE1BQUYsQ0FBU0EsTUFBVCxDQUFnQkMsV0FBaEIsSUFBK0IsQ0FBQ1AsQ0FBQyxDQUFDTSxNQUFGLENBQVNBLE1BQVQsQ0FBZ0JDLFdBQXBELEVBQ0ksT0FBTyxDQUFQLENBQUE7QUFDSixJQUFBLE9BQU9OLENBQUMsQ0FBQ08sU0FBRixHQUFjUixDQUFDLENBQUNRLFNBQXZCLENBQUE7QUFDSCxHQUFBOztBQUVENUQsRUFBQUEseUJBQXlCLENBQUN4SCxNQUFELEVBQVNLLENBQVQsRUFBWUMsQ0FBWixFQUFlO0FBRXBDLElBQUEsTUFBTStLLFNBQVMsR0FBRyxJQUFLQyxDQUFBQSxtQkFBTCxDQUF5QmpMLENBQXpCLEVBQTRCQyxDQUE1QixFQUErQk4sTUFBL0IsRUFBdUNuRCxJQUF2QyxDQUErQ0EsR0FBQUEsSUFBL0MsR0FBc0QsSUFBeEUsQ0FBQTtBQUNBLElBQUEsTUFBTTBPLEtBQUssR0FBRyxJQUFLQyxDQUFBQSxlQUFMLENBQXFCbkwsQ0FBckIsRUFBd0JDLENBQXhCLEVBQTJCTixNQUEzQixFQUFtQ2pELElBQW5DLENBQTJDQSxHQUFBQSxJQUEzQyxHQUFrRCxJQUFoRSxDQUFBO0lBRUEsT0FBTyxJQUFBLENBQUswTyxpQkFBTCxDQUF1QnpMLE1BQXZCLEVBQStCcUwsU0FBL0IsRUFBMENFLEtBQTFDLENBQVAsQ0FBQTtBQUNILEdBQUE7O0FBRUR0QyxFQUFBQSxzQkFBc0IsQ0FBQ3lDLEdBQUQsRUFBTTFMLE1BQU4sRUFBYztBQUVoQ25ELElBQUFBLElBQUksQ0FBQzhPLE1BQUwsQ0FBWXBNLElBQVosQ0FBaUJtTSxHQUFHLENBQUNDLE1BQXJCLENBQUEsQ0FBQTtBQUNBOU8sSUFBQUEsSUFBSSxDQUFDK08sU0FBTCxDQUFlck0sSUFBZixDQUFvQm1NLEdBQUcsQ0FBQ0UsU0FBeEIsQ0FBQSxDQUFBO0lBQ0EvTyxJQUFJLENBQUNJLEdBQUwsQ0FBU3NDLElBQVQsQ0FBYzFDLElBQUksQ0FBQytPLFNBQW5CLENBQThCcE0sQ0FBQUEsU0FBOUIsQ0FBd0NRLE1BQU0sQ0FBQzZMLE9BQVAsR0FBaUIsQ0FBekQsRUFBNERwTSxHQUE1RCxDQUFnRTVDLElBQUksQ0FBQzhPLE1BQXJFLENBQUEsQ0FBQTtJQUNBLE1BQU1KLEtBQUssR0FBRzFPLElBQWQsQ0FBQTtJQUdBLE1BQU1pUCxTQUFTLEdBQUc5TCxNQUFNLENBQUMrTCxhQUFQLENBQXFCUixLQUFLLENBQUNJLE1BQTNCLEVBQW1DalAsSUFBbkMsQ0FBbEIsQ0FBQTtBQUNBLElBQUEsTUFBTTJPLFNBQVMsR0FBRyxJQUFBLENBQUtDLG1CQUFMLENBQXlCUSxTQUFTLENBQUN6TCxDQUFuQyxFQUFzQ3lMLFNBQVMsQ0FBQ3hMLENBQWhELEVBQW1ETixNQUFuRCxFQUEyRGpELElBQTNELENBQW1FQSxHQUFBQSxJQUFuRSxHQUEwRSxJQUE1RixDQUFBO0lBRUEsT0FBTyxJQUFBLENBQUswTyxpQkFBTCxDQUF1QnpMLE1BQXZCLEVBQStCcUwsU0FBL0IsRUFBMENFLEtBQTFDLENBQVAsQ0FBQTtBQUNILEdBQUE7O0FBRURFLEVBQUFBLGlCQUFpQixDQUFDekwsTUFBRCxFQUFTcUwsU0FBVCxFQUFvQkUsS0FBcEIsRUFBMkI7SUFDeEMsSUFBSVMsTUFBTSxHQUFHLElBQWIsQ0FBQTtJQUNBLElBQUlDLGlCQUFpQixHQUFHQyxRQUF4QixDQUFBOztBQUdBLElBQUEsSUFBQSxDQUFLdEksU0FBTCxDQUFldUksSUFBZixDQUFvQixLQUFLekksWUFBekIsQ0FBQSxDQUFBOztBQUVBLElBQUEsS0FBSyxJQUFJc0QsQ0FBQyxHQUFHLENBQVIsRUFBV0csR0FBRyxHQUFHLElBQUt2RCxDQUFBQSxTQUFMLENBQWVxRCxNQUFyQyxFQUE2Q0QsQ0FBQyxHQUFHRyxHQUFqRCxFQUFzREgsQ0FBQyxFQUF2RCxFQUEyRDtBQUN2RCxNQUFBLE1BQU1qSCxPQUFPLEdBQUcsSUFBQSxDQUFLNkQsU0FBTCxDQUFlb0QsQ0FBZixDQUFoQixDQUFBOztBQUdBLE1BQUEsSUFBSSxDQUFDakgsT0FBTyxDQUFDaUwsTUFBUixDQUFlb0IsSUFBZixDQUFvQmpOLENBQUMsSUFBSWEsTUFBTSxDQUFDcU0sU0FBUCxDQUFpQkMsR0FBakIsQ0FBcUJuTixDQUFyQixDQUF6QixDQUFMLEVBQXdEO0FBQ3BELFFBQUEsU0FBQTtBQUNILE9BQUE7O01BRUQsSUFBSVksT0FBTyxDQUFDbUwsTUFBUixJQUFrQm5MLE9BQU8sQ0FBQ21MLE1BQVIsQ0FBZUEsTUFBZixDQUFzQkMsV0FBNUMsRUFBeUQ7UUFDckQsSUFBSSxDQUFDRSxTQUFMLEVBQWdCO0FBQ1osVUFBQSxTQUFBO0FBQ0gsU0FBQTs7UUFHRCxNQUFNa0IsZUFBZSxHQUFHLElBQUEsQ0FBS0MsYUFBTCxDQUFtQm5CLFNBQW5CLEVBQThCdEwsT0FBOUIsRUFBdUMsSUFBdkMsQ0FBeEIsQ0FBQTs7UUFDQSxJQUFJd00sZUFBZSxJQUFJLENBQXZCLEVBQTBCO0FBQ3RCUCxVQUFBQSxNQUFNLEdBQUdqTSxPQUFULENBQUE7QUFDQSxVQUFBLE1BQUE7QUFDSCxTQUFBO0FBQ0osT0FYRCxNQVdPO1FBQ0gsSUFBSSxDQUFDd0wsS0FBTCxFQUFZO0FBQ1IsVUFBQSxTQUFBO0FBQ0gsU0FBQTs7UUFFRCxNQUFNZ0IsZUFBZSxHQUFHLElBQUEsQ0FBS0MsYUFBTCxDQUFtQmpCLEtBQW5CLEVBQTBCeEwsT0FBMUIsRUFBbUMsS0FBbkMsQ0FBeEIsQ0FBQTs7UUFDQSxJQUFJd00sZUFBZSxJQUFJLENBQXZCLEVBQTBCO1VBRXRCLElBQUlBLGVBQWUsR0FBR04saUJBQXRCLEVBQXlDO0FBQ3JDRCxZQUFBQSxNQUFNLEdBQUdqTSxPQUFULENBQUE7QUFDQWtNLFlBQUFBLGlCQUFpQixHQUFHTSxlQUFwQixDQUFBO0FBQ0gsV0FBQTs7VUFHRCxJQUFJeE0sT0FBTyxDQUFDbUwsTUFBWixFQUFvQjtBQUNoQmMsWUFBQUEsTUFBTSxHQUFHak0sT0FBVCxDQUFBO0FBQ0EsWUFBQSxNQUFBO0FBQ0gsV0FBQTtBQUNKLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTs7QUFFRCxJQUFBLE9BQU9pTSxNQUFQLENBQUE7QUFDSCxHQUFBOztFQU1EUyxnQkFBZ0IsQ0FBQzFNLE9BQUQsRUFBVTJNLG9CQUFWLEVBQWdDQyxNQUFoQyxFQUF3Q0MsTUFBeEMsRUFBZ0RDLE1BQWhELEVBQXdEO0lBQ3BFLElBQUlDLFVBQVUsR0FBR0osb0JBQWpCLENBQUE7SUFDQSxNQUFNN0wsTUFBTSxHQUFHZCxPQUFPLENBQUNtSSxNQUFSLElBQWtCbkksT0FBTyxDQUFDbUksTUFBUixDQUFlckgsTUFBaEQsQ0FBQTs7QUFFQSxJQUFBLElBQUlBLE1BQUosRUFBWTtNQUNSLE1BQU1rTSxVQUFVLEdBQUdoTixPQUFPLENBQUNtSSxNQUFSLENBQWVySCxNQUFmLENBQXNCa00sVUFBdEIsSUFBb0N6TyxTQUF2RCxDQUFBOztBQUVBUixNQUFBQSxXQUFXLENBQUN5QixJQUFaLENBQWlCUSxPQUFPLENBQUNtSSxNQUFSLENBQWU4RSxFQUFoQyxDQUFBLENBQUE7O01BQ0FqUCxjQUFjLENBQUN3QixJQUFmLENBQW9CekIsV0FBcEIsRUFBaUMwQixTQUFqQyxDQUEyQyxDQUFDLENBQTVDLENBQUEsQ0FBQTs7QUFDQXZCLE1BQUFBLGFBQWEsQ0FBQ3NCLElBQWQsQ0FBbUJRLE9BQU8sQ0FBQ21JLE1BQVIsQ0FBZStFLEtBQWxDLENBQUEsQ0FBQTs7TUFDQWpQLFlBQVksQ0FBQ3VCLElBQWIsQ0FBa0J0QixhQUFsQixFQUFpQ3VCLFNBQWpDLENBQTJDLENBQUMsQ0FBNUMsQ0FBQSxDQUFBOztBQUVBMUIsTUFBQUEsV0FBVyxDQUFDMEIsU0FBWixDQUFzQnVOLFVBQVUsQ0FBQzFOLENBQVgsR0FBZXVOLE1BQXJDLENBQUEsQ0FBQTs7QUFDQTdPLE1BQUFBLGNBQWMsQ0FBQ3lCLFNBQWYsQ0FBeUJ1TixVQUFVLENBQUN6TSxDQUFYLEdBQWVzTSxNQUF4QyxDQUFBLENBQUE7O0FBQ0EzTyxNQUFBQSxhQUFhLENBQUN1QixTQUFkLENBQXdCdU4sVUFBVSxDQUFDRyxDQUFYLEdBQWVQLE1BQXZDLENBQUEsQ0FBQTs7QUFDQTNPLE1BQUFBLFlBQVksQ0FBQ3dCLFNBQWIsQ0FBdUJ1TixVQUFVLENBQUMxTSxDQUFYLEdBQWVzTSxNQUF0QyxDQUFBLENBQUE7O0FBRUF6TyxNQUFBQSxpQkFBaUIsQ0FBQ3FCLElBQWxCLENBQXVCdU4sVUFBVSxDQUFDLENBQUQsQ0FBakMsQ0FBc0NyTixDQUFBQSxHQUF0QyxDQUEwQzFCLGNBQTFDLENBQTBEMEIsQ0FBQUEsR0FBMUQsQ0FBOER6QixZQUE5RCxDQUFBLENBQUE7O0FBQ0FHLE1BQUFBLGtCQUFrQixDQUFDb0IsSUFBbkIsQ0FBd0J1TixVQUFVLENBQUMsQ0FBRCxDQUFsQyxDQUF1Q3JOLENBQUFBLEdBQXZDLENBQTJDMUIsY0FBM0MsQ0FBMkQwQixDQUFBQSxHQUEzRCxDQUErRHhCLGFBQS9ELENBQUEsQ0FBQTs7QUFDQUcsTUFBQUEsZUFBZSxDQUFDbUIsSUFBaEIsQ0FBcUJ1TixVQUFVLENBQUMsQ0FBRCxDQUEvQixDQUFvQ3JOLENBQUFBLEdBQXBDLENBQXdDM0IsV0FBeEMsQ0FBcUQyQixDQUFBQSxHQUFyRCxDQUF5RHhCLGFBQXpELENBQUEsQ0FBQTs7QUFDQUksTUFBQUEsY0FBYyxDQUFDa0IsSUFBZixDQUFvQnVOLFVBQVUsQ0FBQyxDQUFELENBQTlCLENBQW1Dck4sQ0FBQUEsR0FBbkMsQ0FBdUMzQixXQUF2QyxDQUFvRDJCLENBQUFBLEdBQXBELENBQXdEekIsWUFBeEQsQ0FBQSxDQUFBOztNQUVBOE8sVUFBVSxHQUFHLENBQUM1TyxpQkFBRCxFQUFvQkMsa0JBQXBCLEVBQXdDQyxlQUF4QyxFQUF5REMsY0FBekQsQ0FBYixDQUFBO0FBQ0gsS0FBQTs7SUFJRCxJQUFJc08sTUFBTSxHQUFHLENBQWIsRUFBZ0I7QUFDWixNQUFBLE1BQU1sRCxJQUFJLEdBQUdxRCxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWN6TSxDQUEzQixDQUFBO0FBQ0EsTUFBQSxNQUFNNE0sS0FBSyxHQUFHSCxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWN6TSxDQUE1QixDQUFBO0FBQ0F5TSxNQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWN6TSxDQUFkLEdBQWtCb0osSUFBbEIsQ0FBQTtBQUNBcUQsTUFBQUEsVUFBVSxDQUFDLENBQUQsQ0FBVixDQUFjek0sQ0FBZCxHQUFrQjRNLEtBQWxCLENBQUE7QUFDQUgsTUFBQUEsVUFBVSxDQUFDLENBQUQsQ0FBVixDQUFjek0sQ0FBZCxHQUFrQjRNLEtBQWxCLENBQUE7QUFDQUgsTUFBQUEsVUFBVSxDQUFDLENBQUQsQ0FBVixDQUFjek0sQ0FBZCxHQUFrQm9KLElBQWxCLENBQUE7QUFDSCxLQUFBOztJQUNELElBQUltRCxNQUFNLEdBQUcsQ0FBYixFQUFnQjtBQUNaLE1BQUEsTUFBTU8sTUFBTSxHQUFHTCxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWN4TSxDQUE3QixDQUFBO0FBQ0EsTUFBQSxNQUFNc0osR0FBRyxHQUFHa0QsVUFBVSxDQUFDLENBQUQsQ0FBVixDQUFjeE0sQ0FBMUIsQ0FBQTtBQUNBd00sTUFBQUEsVUFBVSxDQUFDLENBQUQsQ0FBVixDQUFjeE0sQ0FBZCxHQUFrQjZNLE1BQWxCLENBQUE7QUFDQUwsTUFBQUEsVUFBVSxDQUFDLENBQUQsQ0FBVixDQUFjeE0sQ0FBZCxHQUFrQjZNLE1BQWxCLENBQUE7QUFDQUwsTUFBQUEsVUFBVSxDQUFDLENBQUQsQ0FBVixDQUFjeE0sQ0FBZCxHQUFrQnNKLEdBQWxCLENBQUE7QUFDQWtELE1BQUFBLFVBQVUsQ0FBQyxDQUFELENBQVYsQ0FBY3hNLENBQWQsR0FBa0JzSixHQUFsQixDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFJaUQsTUFBTSxHQUFHLENBQWIsRUFBZ0I7QUFDWixNQUFBLE1BQU14TSxDQUFDLEdBQUd5TSxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWN6TSxDQUF4QixDQUFBO0FBQ0EsTUFBQSxNQUFNQyxDQUFDLEdBQUd3TSxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWN4TSxDQUF4QixDQUFBO0FBQ0EsTUFBQSxNQUFNNE0sQ0FBQyxHQUFHSixVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWNJLENBQXhCLENBQUE7TUFFQUosVUFBVSxDQUFDLENBQUQsQ0FBVixDQUFjek0sQ0FBZCxHQUFrQnlNLFVBQVUsQ0FBQyxDQUFELENBQVYsQ0FBY3pNLENBQWhDLENBQUE7TUFDQXlNLFVBQVUsQ0FBQyxDQUFELENBQVYsQ0FBY3hNLENBQWQsR0FBa0J3TSxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWN4TSxDQUFoQyxDQUFBO01BQ0F3TSxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWNJLENBQWQsR0FBa0JKLFVBQVUsQ0FBQyxDQUFELENBQVYsQ0FBY0ksQ0FBaEMsQ0FBQTtBQUNBSixNQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWN6TSxDQUFkLEdBQWtCQSxDQUFsQixDQUFBO0FBQ0F5TSxNQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWN4TSxDQUFkLEdBQWtCQSxDQUFsQixDQUFBO0FBQ0F3TSxNQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLENBQWNJLENBQWQsR0FBa0JBLENBQWxCLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsT0FBT0osVUFBUCxDQUFBO0FBQ0gsR0FBQTs7RUFFRE0sdUJBQXVCLENBQUNyTixPQUFELEVBQVU7QUFDN0IsSUFBQSxJQUFJc04sT0FBTyxHQUFHdE4sT0FBTyxDQUFDbUksTUFBdEIsQ0FBQTtJQUNBLE1BQU1vRixXQUFXLEdBQUd2TixPQUFPLENBQUNtTCxNQUFSLENBQWVBLE1BQWYsQ0FBc0JxQyxLQUExQyxDQUFBOztBQUVBMVAsSUFBQUEsaUJBQWlCLENBQUNpTCxHQUFsQixDQUFzQndFLFdBQXRCLEVBQW1DQSxXQUFuQyxFQUFnREEsV0FBaEQsQ0FBQSxDQUFBOztBQUVBLElBQUEsT0FBT0QsT0FBTyxJQUFJLENBQUNBLE9BQU8sQ0FBQ25DLE1BQTNCLEVBQW1DO0FBQy9Cck4sTUFBQUEsaUJBQWlCLENBQUMyUCxHQUFsQixDQUFzQkgsT0FBTyxDQUFDSSxhQUFSLEVBQXRCLENBQUEsQ0FBQTs7TUFDQUosT0FBTyxHQUFHQSxPQUFPLENBQUMvRCxNQUFsQixDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLE9BQU96TCxpQkFBUCxDQUFBO0FBQ0gsR0FBQTs7RUFFRDZQLHNCQUFzQixDQUFDM04sT0FBRCxFQUFVO0FBQzVCLElBQUEsSUFBSXNOLE9BQU8sR0FBR3ROLE9BQU8sQ0FBQ21JLE1BQXRCLENBQUE7O0FBQ0FySyxJQUFBQSxpQkFBaUIsQ0FBQ2lMLEdBQWxCLENBQXNCLENBQXRCLEVBQXlCLENBQXpCLEVBQTRCLENBQTVCLENBQUEsQ0FBQTs7QUFFQSxJQUFBLE9BQU91RSxPQUFQLEVBQWdCO0FBQ1p4UCxNQUFBQSxpQkFBaUIsQ0FBQzJQLEdBQWxCLENBQXNCSCxPQUFPLENBQUNJLGFBQVIsRUFBdEIsQ0FBQSxDQUFBOztNQUNBSixPQUFPLEdBQUdBLE9BQU8sQ0FBQy9ELE1BQWxCLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsT0FBT3pMLGlCQUFQLENBQUE7QUFDSCxHQUFBOztFQUVEeU4sbUJBQW1CLENBQUNqTCxDQUFELEVBQUlDLENBQUosRUFBT04sTUFBUCxFQUFlMEwsR0FBZixFQUFvQjtBQUNuQyxJQUFBLE1BQU1pQyxFQUFFLEdBQUcsSUFBQSxDQUFLNUksR0FBTCxDQUFTNkksY0FBVCxDQUF3QkMsS0FBbkMsQ0FBQTtBQUNBLElBQUEsTUFBTUMsRUFBRSxHQUFHLElBQUEsQ0FBSy9JLEdBQUwsQ0FBUzZJLGNBQVQsQ0FBd0JHLE1BQW5DLENBQUE7SUFFQSxNQUFNQyxXQUFXLEdBQUdoTyxNQUFNLENBQUN1SixJQUFQLENBQVkyRCxDQUFaLEdBQWdCUyxFQUFwQyxDQUFBO0lBQ0EsTUFBTU0sWUFBWSxHQUFHak8sTUFBTSxDQUFDdUosSUFBUCxDQUFZbEssQ0FBWixHQUFnQnlPLEVBQXJDLENBQUE7SUFDQSxNQUFNSSxVQUFVLEdBQUdsTyxNQUFNLENBQUN1SixJQUFQLENBQVlsSixDQUFaLEdBQWdCc04sRUFBbkMsQ0FBQTtBQUNBLElBQUEsTUFBTVEsV0FBVyxHQUFHRCxVQUFVLEdBQUdGLFdBQWpDLENBQUE7SUFFQSxNQUFNSSxZQUFZLEdBQUcsQ0FBQyxDQUFJcE8sR0FBQUEsTUFBTSxDQUFDdUosSUFBUCxDQUFZakosQ0FBakIsSUFBc0J3TixFQUEzQyxDQUFBO0FBQ0EsSUFBQSxNQUFNTyxTQUFTLEdBQUdELFlBQVksR0FBR0gsWUFBakMsQ0FBQTs7SUFFQSxJQUFJSyxFQUFFLEdBQUdqTyxDQUFDLEdBQUdzTixFQUFKLEdBQVMsSUFBQSxDQUFLckwsT0FBTCxDQUFhaU0sV0FBL0IsQ0FBQTs7SUFDQSxJQUFJQyxFQUFFLEdBQUdsTyxDQUFDLEdBQUd3TixFQUFKLEdBQVMsSUFBQSxDQUFLeEwsT0FBTCxDQUFhbU0sWUFBL0IsQ0FBQTs7QUFFQSxJQUFBLElBQUlILEVBQUUsSUFBSUosVUFBTixJQUFvQkksRUFBRSxJQUFJSCxXQUExQixJQUNBSyxFQUFFLElBQUlKLFlBRE4sSUFDc0JJLEVBQUUsSUFBSUgsU0FEaEMsRUFDMkM7TUFHdkNDLEVBQUUsR0FBR1gsRUFBRSxJQUFJVyxFQUFFLEdBQUdKLFVBQVQsQ0FBRixHQUF5QkYsV0FBOUIsQ0FBQTtNQUNBUSxFQUFFLEdBQUdWLEVBQUUsSUFBSVUsRUFBRSxHQUFHSCxTQUFULENBQUYsR0FBd0JKLFlBQTdCLENBQUE7TUFHQU8sRUFBRSxHQUFHVixFQUFFLEdBQUdVLEVBQVYsQ0FBQTtNQUVBOUMsR0FBRyxDQUFDQyxNQUFKLENBQVc3QyxHQUFYLENBQWV3RixFQUFmLEVBQW1CRSxFQUFuQixFQUF1QixDQUF2QixDQUFBLENBQUE7TUFDQTlDLEdBQUcsQ0FBQ0UsU0FBSixDQUFjOUMsR0FBZCxDQUFrQixDQUFsQixFQUFxQixDQUFyQixFQUF3QixDQUFDLENBQXpCLENBQUEsQ0FBQTtBQUNBNEMsTUFBQUEsR0FBRyxDQUFDek8sR0FBSixDQUFRc0MsSUFBUixDQUFhbU0sR0FBRyxDQUFDRSxTQUFqQixDQUE0QnBNLENBQUFBLFNBQTVCLENBQXNDLENBQXRDLENBQUEsQ0FBeUNDLEdBQXpDLENBQTZDaU0sR0FBRyxDQUFDQyxNQUFqRCxDQUFBLENBQUE7QUFFQSxNQUFBLE9BQU8sSUFBUCxDQUFBO0FBQ0gsS0FBQTs7QUFDRCxJQUFBLE9BQU8sS0FBUCxDQUFBO0FBQ0gsR0FBQTs7RUFFREgsZUFBZSxDQUFDbkwsQ0FBRCxFQUFJQyxDQUFKLEVBQU9OLE1BQVAsRUFBZTBMLEdBQWYsRUFBb0I7QUFDL0IsSUFBQSxNQUFNaUMsRUFBRSxHQUFHLElBQUtyTCxDQUFBQSxPQUFMLENBQWFpTSxXQUF4QixDQUFBO0FBQ0EsSUFBQSxNQUFNVCxFQUFFLEdBQUcsSUFBS3hMLENBQUFBLE9BQUwsQ0FBYW1NLFlBQXhCLENBQUE7SUFFQSxNQUFNVCxXQUFXLEdBQUdoTyxNQUFNLENBQUN1SixJQUFQLENBQVkyRCxDQUFaLEdBQWdCUyxFQUFwQyxDQUFBO0lBQ0EsTUFBTU0sWUFBWSxHQUFHak8sTUFBTSxDQUFDdUosSUFBUCxDQUFZbEssQ0FBWixHQUFnQnlPLEVBQXJDLENBQUE7SUFDQSxNQUFNSSxVQUFVLEdBQUdsTyxNQUFNLENBQUN1SixJQUFQLENBQVlsSixDQUFaLEdBQWdCc04sRUFBbkMsQ0FBQTtBQUNBLElBQUEsTUFBTVEsV0FBVyxHQUFHRCxVQUFVLEdBQUdGLFdBQWpDLENBQUE7SUFFQSxNQUFNSSxZQUFZLEdBQUcsQ0FBQyxDQUFJcE8sR0FBQUEsTUFBTSxDQUFDdUosSUFBUCxDQUFZakosQ0FBakIsSUFBc0J3TixFQUEzQyxDQUFBO0FBQ0EsSUFBQSxNQUFNTyxTQUFTLEdBQUdELFlBQVksR0FBR0gsWUFBakMsQ0FBQTtJQUVBLElBQUlLLEVBQUUsR0FBR2pPLENBQVQsQ0FBQTtJQUNBLElBQUltTyxFQUFFLEdBQUdsTyxDQUFULENBQUE7O0FBR0EsSUFBQSxJQUFJRCxDQUFDLElBQUk2TixVQUFMLElBQW1CN04sQ0FBQyxJQUFJOE4sV0FBeEIsSUFDQTdOLENBQUMsSUFBSThOLFlBREwsSUFDcUJJLEVBQUUsSUFBSUgsU0FEL0IsRUFDMEM7TUFHdENDLEVBQUUsR0FBR1gsRUFBRSxJQUFJVyxFQUFFLEdBQUdKLFVBQVQsQ0FBRixHQUF5QkYsV0FBOUIsQ0FBQTtNQUNBUSxFQUFFLEdBQUdWLEVBQUUsSUFBSVUsRUFBRSxHQUFJSCxTQUFWLENBQUYsR0FBMEJKLFlBQS9CLENBQUE7TUFHQWpPLE1BQU0sQ0FBQzBPLGFBQVAsQ0FBcUJKLEVBQXJCLEVBQXlCRSxFQUF6QixFQUE2QnhPLE1BQU0sQ0FBQzJPLFFBQXBDLEVBQThDalMsSUFBOUMsQ0FBQSxDQUFBO01BQ0FzRCxNQUFNLENBQUMwTyxhQUFQLENBQXFCSixFQUFyQixFQUF5QkUsRUFBekIsRUFBNkJ4TyxNQUFNLENBQUM2TCxPQUFwQyxFQUE2Q2pQLElBQTdDLENBQUEsQ0FBQTtBQUVBOE8sTUFBQUEsR0FBRyxDQUFDQyxNQUFKLENBQVdwTSxJQUFYLENBQWdCN0MsSUFBaEIsQ0FBQSxDQUFBO01BQ0FnUCxHQUFHLENBQUNFLFNBQUosQ0FBYzlDLEdBQWQsQ0FBa0IsQ0FBbEIsRUFBcUIsQ0FBckIsRUFBd0IsQ0FBQyxDQUF6QixDQUFBLENBQUE7QUFDQTRDLE1BQUFBLEdBQUcsQ0FBQ3pPLEdBQUosQ0FBUXNDLElBQVIsQ0FBYTNDLElBQWIsQ0FBQSxDQUFBO0FBRUEsTUFBQSxPQUFPLElBQVAsQ0FBQTtBQUNILEtBQUE7O0FBQ0QsSUFBQSxPQUFPLEtBQVAsQ0FBQTtBQUNILEdBQUE7O0FBRUQ0UCxFQUFBQSxhQUFhLENBQUNkLEdBQUQsRUFBTTNMLE9BQU4sRUFBZW1MLE1BQWYsRUFBdUI7SUFFaEMsSUFBSW5MLE9BQU8sQ0FBQzZPLFFBQVosRUFBc0I7QUFDbEIsTUFBQSxJQUFJLElBQUtwQyxDQUFBQSxhQUFMLENBQW1CZCxHQUFuQixFQUF3QjNMLE9BQU8sQ0FBQzZPLFFBQVIsQ0FBaUI3TyxPQUF6QyxFQUFrRG1MLE1BQWxELENBQUEsR0FBNEQsQ0FBaEUsRUFBbUU7QUFDL0QsUUFBQSxPQUFPLENBQUMsQ0FBUixDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0FBRUQsSUFBQSxJQUFJcUMsS0FBSixDQUFBOztBQUNBLElBQUEsSUFBSXJDLE1BQUosRUFBWTtBQUNScUMsTUFBQUEsS0FBSyxHQUFHLElBQUEsQ0FBS0gsdUJBQUwsQ0FBNkJyTixPQUE3QixDQUFSLENBQUE7QUFDSCxLQUZELE1BRU87QUFDSHdOLE1BQUFBLEtBQUssR0FBRyxJQUFBLENBQUtHLHNCQUFMLENBQTRCM04sT0FBNUIsQ0FBUixDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLE1BQU1kLE9BQU8sR0FBRyxJQUFLd04sQ0FBQUEsZ0JBQUwsQ0FBc0IxTSxPQUF0QixFQUErQm1MLE1BQU0sR0FBR25MLE9BQU8sQ0FBQzhPLGFBQVgsR0FBMkI5TyxPQUFPLENBQUMrTyxZQUF4RSxFQUFzRnZCLEtBQUssQ0FBQ2xOLENBQTVGLEVBQStGa04sS0FBSyxDQUFDak4sQ0FBckcsRUFBd0dpTixLQUFLLENBQUNMLENBQTlHLENBQWhCLENBQUE7O0lBRUEsT0FBT3BPLGlCQUFpQixDQUFDNE0sR0FBRyxDQUFDQyxNQUFMLEVBQWFELEdBQUcsQ0FBQ3pPLEdBQWpCLEVBQXNCZ0MsT0FBdEIsQ0FBeEIsQ0FBQTtBQUNILEdBQUE7O0FBL3pCYzs7OzsifQ==
