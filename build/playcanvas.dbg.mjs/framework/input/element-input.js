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

// pi x p2 * p3
function scalarTriple(p1, p2, p3) {
  return _sct.cross(p1, p2).dot(p3);
}

// Given line pq and ccw corners of a quad, return the square distance to the intersection point.
// If the line and quad do not intersect, return -1. (from Real-Time Collision Detection book)
function intersectLineQuad(p, q, corners) {
  _pq.sub2(q, p);
  _pa.sub2(corners[0], p);
  _pb.sub2(corners[1], p);
  _pc.sub2(corners[2], p);

  // Determine which triangle to test against by testing against diagonal first
  _m.cross(_pc, _pq);
  let v = _pa.dot(_m);
  let u;
  let w;
  if (v >= 0) {
    // Test intersection against triangle abc
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
    // Test intersection against triangle dac
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

  // The algorithm above doesn't work if all the corners are the same
  // So do that test here by checking if the diagonals are 0 (since these are rectangles we're checking against)
  if (_pq.sub2(corners[0], corners[2]).lengthSq() < 0.0001 * 0.0001) return -1;
  if (_pq.sub2(corners[1], corners[3]).lengthSq() < 0.0001 * 0.0001) return -1;
  return _ir.sub(p).lengthSq();
}

/**
 * Represents an input event fired on a {@link ElementComponent}. When an event is raised on an
 * ElementComponent it bubbles up to its parent ElementComponents unless we call stopPropagation().
 */
class ElementInputEvent {
  /**
   * Create a new ElementInputEvent instance.
   *
   * @param {MouseEvent|TouchEvent} event - The MouseEvent or TouchEvent that was originally
   * raised.
   * @param {import('../components/element/component.js').ElementComponent} element - The
   * ElementComponent that this event was originally raised on.
   * @param {import('../components/camera/component.js').CameraComponent} camera - The
   * CameraComponent that this event was originally raised via.
   */
  constructor(event, element, camera) {
    /**
     * The MouseEvent or TouchEvent that was originally raised.
     *
     * @type {MouseEvent|TouchEvent}
     */
    this.event = event;

    /**
     * The ElementComponent that this event was originally raised on.
     *
     * @type {import('../components/element/component.js').ElementComponent}
     */
    this.element = element;

    /**
     * The CameraComponent that this event was originally raised via.
     *
     * @type {import('../components/camera/component.js').CameraComponent}
     */
    this.camera = camera;
    this._stopPropagation = false;
  }

  /**
   * Stop propagation of the event to parent {@link ElementComponent}s. This also stops
   * propagation of the event to other event listeners of the original DOM Event.
   */
  stopPropagation() {
    this._stopPropagation = true;
    if (this.event) {
      this.event.stopImmediatePropagation();
      this.event.stopPropagation();
    }
  }
}

/**
 * Represents a Mouse event fired on a {@link ElementComponent}.
 *
 * @augments ElementInputEvent
 */
class ElementMouseEvent extends ElementInputEvent {
  /**
   * Create an instance of an ElementMouseEvent.
   *
   * @param {MouseEvent} event - The MouseEvent that was originally raised.
   * @param {import('../components/element/component.js').ElementComponent} element - The
   * ElementComponent that this event was originally raised on.
   * @param {import('../components/camera/component.js').CameraComponent} camera - The
   * CameraComponent that this event was originally raised via.
   * @param {number} x - The x coordinate.
   * @param {number} y - The y coordinate.
   * @param {number} lastX - The last x coordinate.
   * @param {number} lastY - The last y coordinate.
   */
  constructor(event, element, camera, x, y, lastX, lastY) {
    super(event, element, camera);
    this.x = x;
    this.y = y;

    /**
     * Whether the ctrl key was pressed.
     *
     * @type {boolean}
     */
    this.ctrlKey = event.ctrlKey || false;
    /**
     * Whether the alt key was pressed.
     *
     * @type {boolean}
     */
    this.altKey = event.altKey || false;
    /**
     * Whether the shift key was pressed.
     *
     * @type {boolean}
     */
    this.shiftKey = event.shiftKey || false;
    /**
     * Whether the meta key was pressed.
     *
     * @type {boolean}
     */
    this.metaKey = event.metaKey || false;

    /**
     * The mouse button.
     *
     * @type {number}
     */
    this.button = event.button;
    if (Mouse.isPointerLocked()) {
      /**
       * The amount of horizontal movement of the cursor.
       *
       * @type {number}
       */
      this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
      /**
       * The amount of vertical movement of the cursor.
       *
       * @type {number}
       */
      this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
    } else {
      this.dx = x - lastX;
      this.dy = y - lastY;
    }

    /**
     * The amount of the wheel movement.
     *
     * @type {number}
     */
    this.wheelDelta = 0;

    // deltaY is in a different range across different browsers. The only thing
    // that is consistent is the sign of the value so snap to -1/+1.
    if (event.type === 'wheel') {
      if (event.deltaY > 0) {
        this.wheelDelta = 1;
      } else if (event.deltaY < 0) {
        this.wheelDelta = -1;
      }
    }
  }
}

/**
 * Represents a TouchEvent fired on a {@link ElementComponent}.
 *
 * @augments ElementInputEvent
 */
class ElementTouchEvent extends ElementInputEvent {
  /**
   * Create an instance of an ElementTouchEvent.
   *
   * @param {TouchEvent} event - The TouchEvent that was originally raised.
   * @param {import('../components/element/component.js').ElementComponent} element - The
   * ElementComponent that this event was originally raised on.
   * @param {import('../components/camera/component.js').CameraComponent} camera - The
   * CameraComponent that this event was originally raised via.
   * @param {number} x - The x coordinate of the touch that triggered the event.
   * @param {number} y - The y coordinate of the touch that triggered the event.
   * @param {Touch} touch - The touch object that triggered the event.
   */
  constructor(event, element, camera, x, y, touch) {
    super(event, element, camera);

    /**
     * The Touch objects representing all current points of contact with the surface,
     * regardless of target or changed status.
     *
     * @type {Touch[]}
     */
    this.touches = event.touches;
    /**
     * The Touch objects representing individual points of contact whose states changed between
     * the previous touch event and this one.
     *
     * @type {Touch[]}
     */
    this.changedTouches = event.changedTouches;
    this.x = x;
    this.y = y;
    /**
     * The touch object that triggered the event.
     *
     * @type {Touch}
     */
    this.touch = touch;
  }
}

/**
 * Represents a XRInputSourceEvent fired on a {@link ElementComponent}.
 *
 * @augments ElementInputEvent
 */
class ElementSelectEvent extends ElementInputEvent {
  /**
   * Create an instance of a ElementSelectEvent.
   *
   * @param {object} event - The XRInputSourceEvent that was originally raised.
   * @param {import('../components/element/component.js').ElementComponent} element - The
   * ElementComponent that this event was originally raised on.
   * @param {import('../components/camera/component.js').CameraComponent} camera - The
   * CameraComponent that this event was originally raised via.
   * @param {import('../xr/xr-input-source.js').XrInputSource} inputSource - The XR input source
   * that this event was originally raised from.
   */
  constructor(event, element, camera, inputSource) {
    super(event, element, camera);

    /**
     * The XR input source that this event was originally raised from.
     *
     * @type {import('../xr/xr-input-source.js').XrInputSource}
     */
    this.inputSource = inputSource;
  }
}

/**
 * Handles mouse and touch events for {@link ElementComponent}s. When input events occur on an
 * ElementComponent this fires the appropriate events on the ElementComponent.
 */
class ElementInput {
  /**
   * Create a new ElementInput instance.
   *
   * @param {Element} domElement - The DOM element.
   * @param {object} [options] - Optional arguments.
   * @param {boolean} [options.useMouse] - Whether to allow mouse input. Defaults to true.
   * @param {boolean} [options.useTouch] - Whether to allow touch input. Defaults to true.
   * @param {boolean} [options.useXr] - Whether to allow XR input sources. Defaults to true.
   */
  constructor(domElement, options) {
    this._app = null;
    this._attached = false;
    this._target = null;

    // force disable all element input events
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

  /**
   * Attach mouse and touch events to a DOM element.
   *
   * @param {Element} domElement - The DOM element.
   */
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
      // Passive is not used for the touchend event because some components need to be
      // able to call preventDefault(). See notes in button/component.js for more details.
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

  /**
   * Remove mouse and touch events from the DOM element that it is attached to.
   */
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

  /**
   * Add a {@link ElementComponent} to the internal list of ElementComponents that are being
   * checked for input.
   *
   * @param {import('../components/element/component.js').ElementComponent} element - The
   * ElementComponent.
   */
  addElement(element) {
    if (this._elements.indexOf(element) === -1) this._elements.push(element);
  }

  /**
   * Remove a {@link ElementComponent} from the internal list of ElementComponents that are being
   * checked for input.
   *
   * @param {import('../components/element/component.js').ElementComponent} element - The
   * ElementComponent.
   */
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

    // check cameras from last to front
    // so that elements that are drawn above others
    // receive events first
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

    // clear clicked entities first then store each clicked entity
    // in _clickedEntities so that we don't fire another click
    // on it in this handler or in the mouseup handler which is
    // fired later
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

      // check if touch was released over previously touch
      // element in order to fire click event
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
    // call preventDefault to avoid issues in Chrome Android:
    // http://wilsonpage.co.uk/touch-events-in-chrome-android/
    event.preventDefault();
    if (!this._enabled) return;
    const newTouchedElements = this._determineTouchedElements(event);
    for (let i = 0, len = event.changedTouches.length; i < len; i++) {
      const touch = event.changedTouches[i];
      const newTouchInfo = newTouchedElements[touch.identifier];
      const oldTouchInfo = this._touchedElements[touch.identifier];
      if (oldTouchInfo) {
        const coords = this._calcTouchCoords(touch);

        // Fire touchleave if we've left the previously touched element
        if ((!newTouchInfo || newTouchInfo.element !== oldTouchInfo.element) && !this._touchesForWhichTouchLeaveHasFired[touch.identifier]) {
          this._fireEvent('touchleave', new ElementTouchEvent(event, oldTouchInfo.element, oldTouchInfo.camera, coords.x, coords.y, touch));

          // Flag that touchleave has been fired for this touch, so that we don't
          // re-fire it on the next touchmove. This is required because touchmove
          // events keep on firing for the same element until the touch ends, even
          // if the touch position moves away from the element. Touchleave, on the
          // other hand, should fire once when the touch position moves away from
          // the element and then not re-fire again within the same touch session.
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

    // check cameras from last to front
    // so that elements that are drawn above others
    // receive events first
    for (let i = cameras.length - 1; i >= 0; i--) {
      camera = cameras[i];
      element = this._getTargetElementByCoords(camera, targetX, targetY);
      if (element) break;
    }

    // currently hovered element is whatever's being pointed by mouse (which may be null)
    this._hoveredElement = element;

    // if there was a pressed element, it takes full priority of 'move' and 'up' events
    if ((eventType === 'mousemove' || eventType === 'mouseup') && this._pressedElement) {
      this._fireEvent(eventType, new ElementMouseEvent(event, this._pressedElement, camera, targetX, targetY, this._lastX, this._lastY));
    } else if (element) {
      // otherwise, fire it to the currently hovered event
      this._fireEvent(eventType, new ElementMouseEvent(event, element, camera, targetX, targetY, this._lastX, this._lastY));
      if (eventType === 'mousedown') {
        this._pressedElement = element;
      }
    }
    if (lastHovered !== this._hoveredElement) {
      // mouseleave event
      if (lastHovered) {
        this._fireEvent('mouseleave', new ElementMouseEvent(event, lastHovered, camera, targetX, targetY, this._lastX, this._lastY));
      }

      // mouseenter event
      if (this._hoveredElement) {
        this._fireEvent('mouseenter', new ElementMouseEvent(event, this._hoveredElement, camera, targetX, targetY, this._lastX, this._lastY));
      }
    }
    if (eventType === 'mouseup' && this._pressedElement) {
      // click event
      if (this._pressedElement === this._hoveredElement) {
        // fire click event if it hasn't been fired already by the touchend handler
        const guid = this._hoveredElement.entity.getGuid();
        // Always fire, if there are no clicked entities
        let fireClick = !this._clickedEntities;
        // But if there are, we need to check how long ago touchend added a "click brake"
        if (this._clickedEntities) {
          const lastTouchUp = this._clickedEntities[guid] || 0;
          const dt = Date.now() - lastTouchUp;
          fireClick = dt > 300;

          // We do not check another time, so the worst thing that can happen is one ignored click in 300ms.
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

    // calculate coords and scale them to the graphicsDevice size
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
    // calculate screen-space and 3d-space rays
    const rayScreen = this._calculateRayScreen(x, y, camera, rayA) ? rayA : null;
    const ray3d = this._calculateRay3d(x, y, camera, rayB) ? rayB : null;
    return this._getTargetElement(camera, rayScreen, ray3d);
  }
  _getTargetElementByRay(ray, camera) {
    // 3d ray is copied from input ray
    rayA.origin.copy(ray.origin);
    rayA.direction.copy(ray.direction);
    rayA.end.copy(rayA.direction).mulScalar(camera.farClip * 2).add(rayA.origin);
    const ray3d = rayA;

    // screen-space ray is built from input ray's origin, converted to screen-space
    const screenPos = camera.worldToScreen(ray3d.origin, vecA);
    const rayScreen = this._calculateRayScreen(screenPos.x, screenPos.y, camera, rayB) ? rayB : null;
    return this._getTargetElement(camera, rayScreen, ray3d);
  }
  _getTargetElement(camera, rayScreen, ray3d) {
    let result = null;
    let closestDistance3d = Infinity;

    // sort elements based on layers and draw order
    this._elements.sort(this._sortHandler);
    for (let i = 0, len = this._elements.length; i < len; i++) {
      const element = this._elements[i];

      // check if any of the layers this element renders to is being rendered by the camera
      if (!element.layers.some(v => camera.layersSet.has(v))) {
        continue;
      }
      if (element.screen && element.screen.screen.screenSpace) {
        if (!rayScreen) {
          continue;
        }

        // 2d screen elements take precedence - if hit, immediately return
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
          // store the closest one in world space
          if (currentDistance < closestDistance3d) {
            result = element;
            closestDistance3d = currentDistance;
          }

          // if the element is on a Screen, it takes precedence
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
    // camera bottom (origin is bottom left of window)
    const cameraBottom = (1 - camera.rect.y) * sh;
    const cameraTop = cameraBottom - cameraHeight;
    let _x = x * sw / this._target.clientWidth;
    let _y = y * sh / this._target.clientHeight;
    if (_x >= cameraLeft && _x <= cameraRight && _y <= cameraBottom && _y >= cameraTop) {
      // limit window coords to camera rect coords
      _x = sw * (_x - cameraLeft) / cameraWidth;
      _y = sh * (_y - cameraTop) / cameraHeight;

      // reverse _y
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
    // camera bottom - origin is bottom left of window
    const cameraBottom = (1 - camera.rect.y) * sh;
    const cameraTop = cameraBottom - cameraHeight;
    let _x = x;
    let _y = y;

    // check window coords are within camera rect
    if (x >= cameraLeft && x <= cameraRight && y <= cameraBottom && _y >= cameraTop) {
      // limit window coords to camera rect coords
      _x = sw * (_x - cameraLeft) / cameraWidth;
      _y = sh * (_y - cameraTop) / cameraHeight;

      // 3D screen
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
    // ensure click is contained by any mask first
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

  // In most cases the corners used for hit testing will just be the element's
  // screen corners. However, in cases where the element has additional hit
  // padding specified, we need to expand the screenCorners to incorporate the
  // padding.
  // NOTE: Used by Editor for visualization in the viewport
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

    // make sure the corners are in the right order [bl, br, tr, tl]
    // for x and y: simply invert what is considered "left/right" and "top/bottom"
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
    // if z is inverted, entire element is inverted, so flip it around by swapping corner points 2 and 0
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

  // NOTE: Used by Editor for visualization in the viewport
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

  // NOTE: Used by Editor for visualization in the viewport
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWxlbWVudC1pbnB1dC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9pbnB1dC9lbGVtZW50LWlucHV0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcbmltcG9ydCB7IFJheSB9IGZyb20gJy4uLy4uL2NvcmUvc2hhcGUvcmF5LmpzJztcblxuaW1wb3J0IHsgTW91c2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9pbnB1dC9tb3VzZS5qcyc7XG5cbmltcG9ydCB7IGdldEFwcGxpY2F0aW9uIH0gZnJvbSAnLi4vZ2xvYmFscy5qcyc7XG5cbmxldCB0YXJnZXRYLCB0YXJnZXRZO1xuY29uc3QgdmVjQSA9IG5ldyBWZWMzKCk7XG5jb25zdCB2ZWNCID0gbmV3IFZlYzMoKTtcblxuY29uc3QgcmF5QSA9IG5ldyBSYXkoKTtcbmNvbnN0IHJheUIgPSBuZXcgUmF5KCk7XG5jb25zdCByYXlDID0gbmV3IFJheSgpO1xuXG5yYXlBLmVuZCA9IG5ldyBWZWMzKCk7XG5yYXlCLmVuZCA9IG5ldyBWZWMzKCk7XG5yYXlDLmVuZCA9IG5ldyBWZWMzKCk7XG5cbmNvbnN0IF9wcSA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGEgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BiID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wYyA9IG5ldyBWZWMzKCk7XG5jb25zdCBfcGQgPSBuZXcgVmVjMygpO1xuY29uc3QgX20gPSBuZXcgVmVjMygpO1xuY29uc3QgX2F1ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9idiA9IG5ldyBWZWMzKCk7XG5jb25zdCBfY3cgPSBuZXcgVmVjMygpO1xuY29uc3QgX2lyID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9zY3QgPSBuZXcgVmVjMygpO1xuY29uc3QgX2FjY3VtdWxhdGVkU2NhbGUgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BhZGRpbmdUb3AgPSBuZXcgVmVjMygpO1xuY29uc3QgX3BhZGRpbmdCb3R0b20gPSBuZXcgVmVjMygpO1xuY29uc3QgX3BhZGRpbmdMZWZ0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9wYWRkaW5nUmlnaHQgPSBuZXcgVmVjMygpO1xuY29uc3QgX2Nvcm5lckJvdHRvbUxlZnQgPSBuZXcgVmVjMygpO1xuY29uc3QgX2Nvcm5lckJvdHRvbVJpZ2h0ID0gbmV3IFZlYzMoKTtcbmNvbnN0IF9jb3JuZXJUb3BSaWdodCA9IG5ldyBWZWMzKCk7XG5jb25zdCBfY29ybmVyVG9wTGVmdCA9IG5ldyBWZWMzKCk7XG5cbmNvbnN0IFpFUk9fVkVDNCA9IG5ldyBWZWM0KCk7XG5cbi8vIHBpIHggcDIgKiBwM1xuZnVuY3Rpb24gc2NhbGFyVHJpcGxlKHAxLCBwMiwgcDMpIHtcbiAgICByZXR1cm4gX3NjdC5jcm9zcyhwMSwgcDIpLmRvdChwMyk7XG59XG5cbi8vIEdpdmVuIGxpbmUgcHEgYW5kIGNjdyBjb3JuZXJzIG9mIGEgcXVhZCwgcmV0dXJuIHRoZSBzcXVhcmUgZGlzdGFuY2UgdG8gdGhlIGludGVyc2VjdGlvbiBwb2ludC5cbi8vIElmIHRoZSBsaW5lIGFuZCBxdWFkIGRvIG5vdCBpbnRlcnNlY3QsIHJldHVybiAtMS4gKGZyb20gUmVhbC1UaW1lIENvbGxpc2lvbiBEZXRlY3Rpb24gYm9vaylcbmZ1bmN0aW9uIGludGVyc2VjdExpbmVRdWFkKHAsIHEsIGNvcm5lcnMpIHtcbiAgICBfcHEuc3ViMihxLCBwKTtcbiAgICBfcGEuc3ViMihjb3JuZXJzWzBdLCBwKTtcbiAgICBfcGIuc3ViMihjb3JuZXJzWzFdLCBwKTtcbiAgICBfcGMuc3ViMihjb3JuZXJzWzJdLCBwKTtcblxuICAgIC8vIERldGVybWluZSB3aGljaCB0cmlhbmdsZSB0byB0ZXN0IGFnYWluc3QgYnkgdGVzdGluZyBhZ2FpbnN0IGRpYWdvbmFsIGZpcnN0XG4gICAgX20uY3Jvc3MoX3BjLCBfcHEpO1xuICAgIGxldCB2ID0gX3BhLmRvdChfbSk7XG4gICAgbGV0IHU7XG4gICAgbGV0IHc7XG5cbiAgICBpZiAodiA+PSAwKSB7XG4gICAgICAgIC8vIFRlc3QgaW50ZXJzZWN0aW9uIGFnYWluc3QgdHJpYW5nbGUgYWJjXG4gICAgICAgIHUgPSAtX3BiLmRvdChfbSk7XG4gICAgICAgIGlmICh1IDwgMClcbiAgICAgICAgICAgIHJldHVybiAtMTtcblxuICAgICAgICB3ID0gc2NhbGFyVHJpcGxlKF9wcSwgX3BiLCBfcGEpO1xuICAgICAgICBpZiAodyA8IDApXG4gICAgICAgICAgICByZXR1cm4gLTE7XG5cbiAgICAgICAgY29uc3QgZGVub20gPSAxLjAgLyAodSArIHYgKyB3KTtcblxuICAgICAgICBfYXUuY29weShjb3JuZXJzWzBdKS5tdWxTY2FsYXIodSAqIGRlbm9tKTtcbiAgICAgICAgX2J2LmNvcHkoY29ybmVyc1sxXSkubXVsU2NhbGFyKHYgKiBkZW5vbSk7XG4gICAgICAgIF9jdy5jb3B5KGNvcm5lcnNbMl0pLm11bFNjYWxhcih3ICogZGVub20pO1xuICAgICAgICBfaXIuY29weShfYXUpLmFkZChfYnYpLmFkZChfY3cpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFRlc3QgaW50ZXJzZWN0aW9uIGFnYWluc3QgdHJpYW5nbGUgZGFjXG4gICAgICAgIF9wZC5zdWIyKGNvcm5lcnNbM10sIHApO1xuICAgICAgICB1ID0gX3BkLmRvdChfbSk7XG4gICAgICAgIGlmICh1IDwgMClcbiAgICAgICAgICAgIHJldHVybiAtMTtcblxuICAgICAgICB3ID0gc2NhbGFyVHJpcGxlKF9wcSwgX3BhLCBfcGQpO1xuICAgICAgICBpZiAodyA8IDApXG4gICAgICAgICAgICByZXR1cm4gLTE7XG5cbiAgICAgICAgdiA9IC12O1xuXG4gICAgICAgIGNvbnN0IGRlbm9tID0gMS4wIC8gKHUgKyB2ICsgdyk7XG5cbiAgICAgICAgX2F1LmNvcHkoY29ybmVyc1swXSkubXVsU2NhbGFyKHUgKiBkZW5vbSk7XG4gICAgICAgIF9idi5jb3B5KGNvcm5lcnNbM10pLm11bFNjYWxhcih2ICogZGVub20pO1xuICAgICAgICBfY3cuY29weShjb3JuZXJzWzJdKS5tdWxTY2FsYXIodyAqIGRlbm9tKTtcbiAgICAgICAgX2lyLmNvcHkoX2F1KS5hZGQoX2J2KS5hZGQoX2N3KTtcbiAgICB9XG5cbiAgICAvLyBUaGUgYWxnb3JpdGhtIGFib3ZlIGRvZXNuJ3Qgd29yayBpZiBhbGwgdGhlIGNvcm5lcnMgYXJlIHRoZSBzYW1lXG4gICAgLy8gU28gZG8gdGhhdCB0ZXN0IGhlcmUgYnkgY2hlY2tpbmcgaWYgdGhlIGRpYWdvbmFscyBhcmUgMCAoc2luY2UgdGhlc2UgYXJlIHJlY3RhbmdsZXMgd2UncmUgY2hlY2tpbmcgYWdhaW5zdClcbiAgICBpZiAoX3BxLnN1YjIoY29ybmVyc1swXSwgY29ybmVyc1syXSkubGVuZ3RoU3EoKSA8IDAuMDAwMSAqIDAuMDAwMSkgcmV0dXJuIC0xO1xuICAgIGlmIChfcHEuc3ViMihjb3JuZXJzWzFdLCBjb3JuZXJzWzNdKS5sZW5ndGhTcSgpIDwgMC4wMDAxICogMC4wMDAxKSByZXR1cm4gLTE7XG5cbiAgICByZXR1cm4gX2lyLnN1YihwKS5sZW5ndGhTcSgpO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gaW5wdXQgZXZlbnQgZmlyZWQgb24gYSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0uIFdoZW4gYW4gZXZlbnQgaXMgcmFpc2VkIG9uIGFuXG4gKiBFbGVtZW50Q29tcG9uZW50IGl0IGJ1YmJsZXMgdXAgdG8gaXRzIHBhcmVudCBFbGVtZW50Q29tcG9uZW50cyB1bmxlc3Mgd2UgY2FsbCBzdG9wUHJvcGFnYXRpb24oKS5cbiAqL1xuY2xhc3MgRWxlbWVudElucHV0RXZlbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBFbGVtZW50SW5wdXRFdmVudCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TW91c2VFdmVudHxUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBNb3VzZUV2ZW50IG9yIFRvdWNoRXZlbnQgdGhhdCB3YXMgb3JpZ2luYWxseVxuICAgICAqIHJhaXNlZC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9uZW50cy9lbGVtZW50L2NvbXBvbmVudC5qcycpLkVsZW1lbnRDb21wb25lbnR9IGVsZW1lbnQgLSBUaGVcbiAgICAgKiBFbGVtZW50Q29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWQgb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gVGhlXG4gICAgICogQ2FtZXJhQ29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWQgdmlhLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBNb3VzZUV2ZW50IG9yIFRvdWNoRXZlbnQgdGhhdCB3YXMgb3JpZ2luYWxseSByYWlzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtNb3VzZUV2ZW50fFRvdWNoRXZlbnR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBFbGVtZW50Q29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWQgb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvZWxlbWVudC9jb21wb25lbnQuanMnKS5FbGVtZW50Q29tcG9uZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIENhbWVyYUNvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkIHZpYS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jYW1lcmEgPSBjYW1lcmE7XG5cbiAgICAgICAgdGhpcy5fc3RvcFByb3BhZ2F0aW9uID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcCBwcm9wYWdhdGlvbiBvZiB0aGUgZXZlbnQgdG8gcGFyZW50IHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuIFRoaXMgYWxzbyBzdG9wc1xuICAgICAqIHByb3BhZ2F0aW9uIG9mIHRoZSBldmVudCB0byBvdGhlciBldmVudCBsaXN0ZW5lcnMgb2YgdGhlIG9yaWdpbmFsIERPTSBFdmVudC5cbiAgICAgKi9cbiAgICBzdG9wUHJvcGFnYXRpb24oKSB7XG4gICAgICAgIHRoaXMuX3N0b3BQcm9wYWdhdGlvbiA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLmV2ZW50KSB7XG4gICAgICAgICAgICB0aGlzLmV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgdGhpcy5ldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgTW91c2UgZXZlbnQgZmlyZWQgb24gYSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0uXG4gKlxuICogQGF1Z21lbnRzIEVsZW1lbnRJbnB1dEV2ZW50XG4gKi9cbmNsYXNzIEVsZW1lbnRNb3VzZUV2ZW50IGV4dGVuZHMgRWxlbWVudElucHV0RXZlbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBhbiBFbGVtZW50TW91c2VFdmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgTW91c2VFdmVudCB0aGF0IHdhcyBvcmlnaW5hbGx5IHJhaXNlZC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9uZW50cy9lbGVtZW50L2NvbXBvbmVudC5qcycpLkVsZW1lbnRDb21wb25lbnR9IGVsZW1lbnQgLSBUaGVcbiAgICAgKiBFbGVtZW50Q29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWQgb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gVGhlXG4gICAgICogQ2FtZXJhQ29tcG9uZW50IHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWQgdmlhLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGxhc3RYIC0gVGhlIGxhc3QgeCBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBsYXN0WSAtIFRoZSBsYXN0IHkgY29vcmRpbmF0ZS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihldmVudCwgZWxlbWVudCwgY2FtZXJhLCB4LCB5LCBsYXN0WCwgbGFzdFkpIHtcbiAgICAgICAgc3VwZXIoZXZlbnQsIGVsZW1lbnQsIGNhbWVyYSk7XG5cbiAgICAgICAgdGhpcy54ID0geDtcbiAgICAgICAgdGhpcy55ID0geTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogV2hldGhlciB0aGUgY3RybCBrZXkgd2FzIHByZXNzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jdHJsS2V5ID0gZXZlbnQuY3RybEtleSB8fCBmYWxzZTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdoZXRoZXIgdGhlIGFsdCBrZXkgd2FzIHByZXNzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5hbHRLZXkgPSBldmVudC5hbHRLZXkgfHwgZmFsc2U7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGV0aGVyIHRoZSBzaGlmdCBrZXkgd2FzIHByZXNzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zaGlmdEtleSA9IGV2ZW50LnNoaWZ0S2V5IHx8IGZhbHNlO1xuICAgICAgICAvKipcbiAgICAgICAgICogV2hldGhlciB0aGUgbWV0YSBrZXkgd2FzIHByZXNzZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tZXRhS2V5ID0gZXZlbnQubWV0YUtleSB8fCBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG1vdXNlIGJ1dHRvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYnV0dG9uID0gZXZlbnQuYnV0dG9uO1xuXG4gICAgICAgIGlmIChNb3VzZS5pc1BvaW50ZXJMb2NrZWQoKSkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgYW1vdW50IG9mIGhvcml6b250YWwgbW92ZW1lbnQgb2YgdGhlIGN1cnNvci5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmR4ID0gZXZlbnQubW92ZW1lbnRYIHx8IGV2ZW50LndlYmtpdE1vdmVtZW50WCB8fCBldmVudC5tb3pNb3ZlbWVudFggfHwgMDtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGFtb3VudCBvZiB2ZXJ0aWNhbCBtb3ZlbWVudCBvZiB0aGUgY3Vyc29yLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuZHkgPSBldmVudC5tb3ZlbWVudFkgfHwgZXZlbnQud2Via2l0TW92ZW1lbnRZIHx8IGV2ZW50Lm1vek1vdmVtZW50WSB8fCAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5keCA9IHggLSBsYXN0WDtcbiAgICAgICAgICAgIHRoaXMuZHkgPSB5IC0gbGFzdFk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFtb3VudCBvZiB0aGUgd2hlZWwgbW92ZW1lbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLndoZWVsRGVsdGEgPSAwO1xuXG4gICAgICAgIC8vIGRlbHRhWSBpcyBpbiBhIGRpZmZlcmVudCByYW5nZSBhY3Jvc3MgZGlmZmVyZW50IGJyb3dzZXJzLiBUaGUgb25seSB0aGluZ1xuICAgICAgICAvLyB0aGF0IGlzIGNvbnNpc3RlbnQgaXMgdGhlIHNpZ24gb2YgdGhlIHZhbHVlIHNvIHNuYXAgdG8gLTEvKzEuXG4gICAgICAgIGlmIChldmVudC50eXBlID09PSAnd2hlZWwnKSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQuZGVsdGFZID4gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMud2hlZWxEZWx0YSA9IDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmRlbHRhWSA8IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLndoZWVsRGVsdGEgPSAtMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgVG91Y2hFdmVudCBmaXJlZCBvbiBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fS5cbiAqXG4gKiBAYXVnbWVudHMgRWxlbWVudElucHV0RXZlbnRcbiAqL1xuY2xhc3MgRWxlbWVudFRvdWNoRXZlbnQgZXh0ZW5kcyBFbGVtZW50SW5wdXRFdmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIGluc3RhbmNlIG9mIGFuIEVsZW1lbnRUb3VjaEV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBUb3VjaEV2ZW50IHRoYXQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb25lbnRzL2VsZW1lbnQvY29tcG9uZW50LmpzJykuRWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZVxuICAgICAqIEVsZW1lbnRDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZCBvbi5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBUaGVcbiAgICAgKiBDYW1lcmFDb21wb25lbnQgdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZCB2aWEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeCBjb29yZGluYXRlIG9mIHRoZSB0b3VjaCB0aGF0IHRyaWdnZXJlZCB0aGUgZXZlbnQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlIG9mIHRoZSB0b3VjaCB0aGF0IHRyaWdnZXJlZCB0aGUgZXZlbnQuXG4gICAgICogQHBhcmFtIHtUb3VjaH0gdG91Y2ggLSBUaGUgdG91Y2ggb2JqZWN0IHRoYXQgdHJpZ2dlcmVkIHRoZSBldmVudC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihldmVudCwgZWxlbWVudCwgY2FtZXJhLCB4LCB5LCB0b3VjaCkge1xuICAgICAgICBzdXBlcihldmVudCwgZWxlbWVudCwgY2FtZXJhKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFRvdWNoIG9iamVjdHMgcmVwcmVzZW50aW5nIGFsbCBjdXJyZW50IHBvaW50cyBvZiBjb250YWN0IHdpdGggdGhlIHN1cmZhY2UsXG4gICAgICAgICAqIHJlZ2FyZGxlc3Mgb2YgdGFyZ2V0IG9yIGNoYW5nZWQgc3RhdHVzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VG91Y2hbXX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudG91Y2hlcyA9IGV2ZW50LnRvdWNoZXM7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgVG91Y2ggb2JqZWN0cyByZXByZXNlbnRpbmcgaW5kaXZpZHVhbCBwb2ludHMgb2YgY29udGFjdCB3aG9zZSBzdGF0ZXMgY2hhbmdlZCBiZXR3ZWVuXG4gICAgICAgICAqIHRoZSBwcmV2aW91cyB0b3VjaCBldmVudCBhbmQgdGhpcyBvbmUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUb3VjaFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jaGFuZ2VkVG91Y2hlcyA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzO1xuICAgICAgICB0aGlzLnggPSB4O1xuICAgICAgICB0aGlzLnkgPSB5O1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHRvdWNoIG9iamVjdCB0aGF0IHRyaWdnZXJlZCB0aGUgZXZlbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUb3VjaH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudG91Y2ggPSB0b3VjaDtcbiAgICB9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIFhSSW5wdXRTb3VyY2VFdmVudCBmaXJlZCBvbiBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fS5cbiAqXG4gKiBAYXVnbWVudHMgRWxlbWVudElucHV0RXZlbnRcbiAqL1xuY2xhc3MgRWxlbWVudFNlbGVjdEV2ZW50IGV4dGVuZHMgRWxlbWVudElucHV0RXZlbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBhIEVsZW1lbnRTZWxlY3RFdmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldmVudCAtIFRoZSBYUklucHV0U291cmNlRXZlbnQgdGhhdCB3YXMgb3JpZ2luYWxseSByYWlzZWQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2NvbXBvbmVudHMvZWxlbWVudC9jb21wb25lbnQuanMnKS5FbGVtZW50Q29tcG9uZW50fSBlbGVtZW50IC0gVGhlXG4gICAgICogRWxlbWVudENvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkIG9uLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIFRoZVxuICAgICAqIENhbWVyYUNvbXBvbmVudCB0aGF0IHRoaXMgZXZlbnQgd2FzIG9yaWdpbmFsbHkgcmFpc2VkIHZpYS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4veHIveHItaW5wdXQtc291cmNlLmpzJykuWHJJbnB1dFNvdXJjZX0gaW5wdXRTb3VyY2UgLSBUaGUgWFIgaW5wdXQgc291cmNlXG4gICAgICogdGhhdCB0aGlzIGV2ZW50IHdhcyBvcmlnaW5hbGx5IHJhaXNlZCBmcm9tLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIGlucHV0U291cmNlKSB7XG4gICAgICAgIHN1cGVyKGV2ZW50LCBlbGVtZW50LCBjYW1lcmEpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgWFIgaW5wdXQgc291cmNlIHRoYXQgdGhpcyBldmVudCB3YXMgb3JpZ2luYWxseSByYWlzZWQgZnJvbS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4veHIveHItaW5wdXQtc291cmNlLmpzJykuWHJJbnB1dFNvdXJjZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaW5wdXRTb3VyY2UgPSBpbnB1dFNvdXJjZTtcbiAgICB9XG59XG5cbi8qKlxuICogSGFuZGxlcyBtb3VzZSBhbmQgdG91Y2ggZXZlbnRzIGZvciB7QGxpbmsgRWxlbWVudENvbXBvbmVudH1zLiBXaGVuIGlucHV0IGV2ZW50cyBvY2N1ciBvbiBhblxuICogRWxlbWVudENvbXBvbmVudCB0aGlzIGZpcmVzIHRoZSBhcHByb3ByaWF0ZSBldmVudHMgb24gdGhlIEVsZW1lbnRDb21wb25lbnQuXG4gKi9cbmNsYXNzIEVsZW1lbnRJbnB1dCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEVsZW1lbnRJbnB1dCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudH0gZG9tRWxlbWVudCAtIFRoZSBET00gZWxlbWVudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9uYWwgYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudXNlTW91c2VdIC0gV2hldGhlciB0byBhbGxvdyBtb3VzZSBpbnB1dC4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnVzZVRvdWNoXSAtIFdoZXRoZXIgdG8gYWxsb3cgdG91Y2ggaW5wdXQuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy51c2VYcl0gLSBXaGV0aGVyIHRvIGFsbG93IFhSIGlucHV0IHNvdXJjZXMuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZG9tRWxlbWVudCwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLl9hcHAgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRhY2hlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl90YXJnZXQgPSBudWxsO1xuXG4gICAgICAgIC8vIGZvcmNlIGRpc2FibGUgYWxsIGVsZW1lbnQgaW5wdXQgZXZlbnRzXG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX2xhc3RYID0gMDtcbiAgICAgICAgdGhpcy5fbGFzdFkgPSAwO1xuXG4gICAgICAgIHRoaXMuX3VwSGFuZGxlciA9IHRoaXMuX2hhbmRsZVVwLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX2Rvd25IYW5kbGVyID0gdGhpcy5faGFuZGxlRG93bi5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9tb3ZlSGFuZGxlciA9IHRoaXMuX2hhbmRsZU1vdmUuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fd2hlZWxIYW5kbGVyID0gdGhpcy5faGFuZGxlV2hlZWwuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fdG91Y2hzdGFydEhhbmRsZXIgPSB0aGlzLl9oYW5kbGVUb3VjaFN0YXJ0LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX3RvdWNoZW5kSGFuZGxlciA9IHRoaXMuX2hhbmRsZVRvdWNoRW5kLmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX3RvdWNoY2FuY2VsSGFuZGxlciA9IHRoaXMuX3RvdWNoZW5kSGFuZGxlcjtcbiAgICAgICAgdGhpcy5fdG91Y2htb3ZlSGFuZGxlciA9IHRoaXMuX2hhbmRsZVRvdWNoTW92ZS5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9zb3J0SGFuZGxlciA9IHRoaXMuX3NvcnRFbGVtZW50cy5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX2VsZW1lbnRzID0gW107XG4gICAgICAgIHRoaXMuX2hvdmVyZWRFbGVtZW50ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fcHJlc3NlZEVsZW1lbnQgPSBudWxsO1xuICAgICAgICB0aGlzLl90b3VjaGVkRWxlbWVudHMgPSB7fTtcbiAgICAgICAgdGhpcy5fdG91Y2hlc0ZvcldoaWNoVG91Y2hMZWF2ZUhhc0ZpcmVkID0ge307XG4gICAgICAgIHRoaXMuX3NlbGVjdGVkRWxlbWVudHMgPSB7fTtcbiAgICAgICAgdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHMgPSB7fTtcblxuICAgICAgICB0aGlzLl91c2VNb3VzZSA9ICFvcHRpb25zIHx8IG9wdGlvbnMudXNlTW91c2UgIT09IGZhbHNlO1xuICAgICAgICB0aGlzLl91c2VUb3VjaCA9ICFvcHRpb25zIHx8IG9wdGlvbnMudXNlVG91Y2ggIT09IGZhbHNlO1xuICAgICAgICB0aGlzLl91c2VYciA9ICFvcHRpb25zIHx8IG9wdGlvbnMudXNlWHIgIT09IGZhbHNlO1xuICAgICAgICB0aGlzLl9zZWxlY3RFdmVudHNBdHRhY2hlZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChwbGF0Zm9ybS50b3VjaClcbiAgICAgICAgICAgIHRoaXMuX2NsaWNrZWRFbnRpdGllcyA9IHt9O1xuXG4gICAgICAgIHRoaXMuYXR0YWNoKGRvbUVsZW1lbnQpO1xuICAgIH1cblxuICAgIHNldCBlbmFibGVkKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG4gICAgfVxuXG4gICAgc2V0IGFwcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hcHAgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYXBwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXBwIHx8IGdldEFwcGxpY2F0aW9uKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXR0YWNoIG1vdXNlIGFuZCB0b3VjaCBldmVudHMgdG8gYSBET00gZWxlbWVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudH0gZG9tRWxlbWVudCAtIFRoZSBET00gZWxlbWVudC5cbiAgICAgKi9cbiAgICBhdHRhY2goZG9tRWxlbWVudCkge1xuICAgICAgICBpZiAodGhpcy5fYXR0YWNoZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2F0dGFjaGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmRldGFjaCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdGFyZ2V0ID0gZG9tRWxlbWVudDtcbiAgICAgICAgdGhpcy5fYXR0YWNoZWQgPSB0cnVlO1xuXG4gICAgICAgIGNvbnN0IG9wdHMgPSBwbGF0Zm9ybS5wYXNzaXZlRXZlbnRzID8geyBwYXNzaXZlOiB0cnVlIH0gOiBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuX3VzZU1vdXNlKSB7XG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIHRoaXMuX3VwSGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5fZG93bkhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMuX21vdmVIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd3aGVlbCcsIHRoaXMuX3doZWVsSGFuZGxlciwgb3B0cyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdXNlVG91Y2ggJiYgcGxhdGZvcm0udG91Y2gpIHtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5hZGRFdmVudExpc3RlbmVyKCd0b3VjaHN0YXJ0JywgdGhpcy5fdG91Y2hzdGFydEhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgLy8gUGFzc2l2ZSBpcyBub3QgdXNlZCBmb3IgdGhlIHRvdWNoZW5kIGV2ZW50IGJlY2F1c2Ugc29tZSBjb21wb25lbnRzIG5lZWQgdG8gYmVcbiAgICAgICAgICAgIC8vIGFibGUgdG8gY2FsbCBwcmV2ZW50RGVmYXVsdCgpLiBTZWUgbm90ZXMgaW4gYnV0dG9uL2NvbXBvbmVudC5qcyBmb3IgbW9yZSBkZXRhaWxzLlxuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoZW5kJywgdGhpcy5fdG91Y2hlbmRIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB0aGlzLl90YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcigndG91Y2htb3ZlJywgdGhpcy5fdG91Y2htb3ZlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoY2FuY2VsJywgdGhpcy5fdG91Y2hjYW5jZWxIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmF0dGFjaFNlbGVjdEV2ZW50cygpO1xuICAgIH1cblxuICAgIGF0dGFjaFNlbGVjdEV2ZW50cygpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zZWxlY3RFdmVudHNBdHRhY2hlZCAmJiB0aGlzLl91c2VYciAmJiB0aGlzLmFwcCAmJiB0aGlzLmFwcC54ciAmJiB0aGlzLmFwcC54ci5zdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fY2xpY2tlZEVudGl0aWVzKVxuICAgICAgICAgICAgICAgIHRoaXMuX2NsaWNrZWRFbnRpdGllcyA9IHt9O1xuXG4gICAgICAgICAgICB0aGlzLl9zZWxlY3RFdmVudHNBdHRhY2hlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmFwcC54ci5vbignc3RhcnQnLCB0aGlzLl9vblhyU3RhcnQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIG1vdXNlIGFuZCB0b3VjaCBldmVudHMgZnJvbSB0aGUgRE9NIGVsZW1lbnQgdGhhdCBpdCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBkZXRhY2goKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXR0YWNoZWQpIHJldHVybjtcbiAgICAgICAgdGhpcy5fYXR0YWNoZWQgPSBmYWxzZTtcblxuICAgICAgICBjb25zdCBvcHRzID0gcGxhdGZvcm0ucGFzc2l2ZUV2ZW50cyA/IHsgcGFzc2l2ZTogdHJ1ZSB9IDogZmFsc2U7XG4gICAgICAgIGlmICh0aGlzLl91c2VNb3VzZSkge1xuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLl91cEhhbmRsZXIsIG9wdHMpO1xuICAgICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMuX2Rvd25IYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCB0aGlzLl9tb3ZlSGFuZGxlciwgb3B0cyk7XG4gICAgICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2hlZWwnLCB0aGlzLl93aGVlbEhhbmRsZXIsIG9wdHMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3VzZVRvdWNoKSB7XG4gICAgICAgICAgICB0aGlzLl90YXJnZXQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndG91Y2hzdGFydCcsIHRoaXMuX3RvdWNoc3RhcnRIYW5kbGVyLCBvcHRzKTtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGVuZCcsIHRoaXMuX3RvdWNoZW5kSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgdGhpcy5fdGFyZ2V0LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3RvdWNobW92ZScsIHRoaXMuX3RvdWNobW92ZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIHRoaXMuX3RhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGNhbmNlbCcsIHRoaXMuX3RvdWNoY2FuY2VsSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3NlbGVjdEV2ZW50c0F0dGFjaGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9zZWxlY3RFdmVudHNBdHRhY2hlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIub2ZmKCdzdGFydCcsIHRoaXMuX29uWHJTdGFydCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmFwcC54ci5vZmYoJ2VuZCcsIHRoaXMuX29uWHJFbmQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIub2ZmKCd1cGRhdGUnLCB0aGlzLl9vblhyVXBkYXRlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZignc2VsZWN0c3RhcnQnLCB0aGlzLl9vblNlbGVjdFN0YXJ0LCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZignc2VsZWN0ZW5kJywgdGhpcy5fb25TZWxlY3RFbmQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vblhySW5wdXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdGFyZ2V0ID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSB7QGxpbmsgRWxlbWVudENvbXBvbmVudH0gdG8gdGhlIGludGVybmFsIGxpc3Qgb2YgRWxlbWVudENvbXBvbmVudHMgdGhhdCBhcmUgYmVpbmdcbiAgICAgKiBjaGVja2VkIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb25lbnRzL2VsZW1lbnQvY29tcG9uZW50LmpzJykuRWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZVxuICAgICAqIEVsZW1lbnRDb21wb25lbnQuXG4gICAgICovXG4gICAgYWRkRWxlbWVudChlbGVtZW50KSB7XG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50cy5pbmRleE9mKGVsZW1lbnQpID09PSAtMSlcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnRzLnB1c2goZWxlbWVudCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGEge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9IGZyb20gdGhlIGludGVybmFsIGxpc3Qgb2YgRWxlbWVudENvbXBvbmVudHMgdGhhdCBhcmUgYmVpbmdcbiAgICAgKiBjaGVja2VkIGZvciBpbnB1dC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9jb21wb25lbnRzL2VsZW1lbnQvY29tcG9uZW50LmpzJykuRWxlbWVudENvbXBvbmVudH0gZWxlbWVudCAtIFRoZVxuICAgICAqIEVsZW1lbnRDb21wb25lbnQuXG4gICAgICovXG4gICAgcmVtb3ZlRWxlbWVudChlbGVtZW50KSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuX2VsZW1lbnRzLmluZGV4T2YoZWxlbWVudCk7XG4gICAgICAgIGlmIChpZHggIT09IC0xKVxuICAgICAgICAgICAgdGhpcy5fZWxlbWVudHMuc3BsaWNlKGlkeCwgMSk7XG4gICAgfVxuXG4gICAgX2hhbmRsZVVwKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmIChNb3VzZS5pc1BvaW50ZXJMb2NrZWQoKSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjTW91c2VDb29yZHMoZXZlbnQpO1xuXG4gICAgICAgIHRoaXMuX29uRWxlbWVudE1vdXNlRXZlbnQoJ21vdXNldXAnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX2hhbmRsZURvd24oZXZlbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKE1vdXNlLmlzUG9pbnRlckxvY2tlZCgpKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2NhbGNNb3VzZUNvb3JkcyhldmVudCk7XG5cbiAgICAgICAgdGhpcy5fb25FbGVtZW50TW91c2VFdmVudCgnbW91c2Vkb3duJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9oYW5kbGVNb3ZlKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2NhbGNNb3VzZUNvb3JkcyhldmVudCk7XG5cbiAgICAgICAgdGhpcy5fb25FbGVtZW50TW91c2VFdmVudCgnbW91c2Vtb3ZlJywgZXZlbnQpO1xuXG4gICAgICAgIHRoaXMuX2xhc3RYID0gdGFyZ2V0WDtcbiAgICAgICAgdGhpcy5fbGFzdFkgPSB0YXJnZXRZO1xuICAgIH1cblxuICAgIF9oYW5kbGVXaGVlbChldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jYWxjTW91c2VDb29yZHMoZXZlbnQpO1xuXG4gICAgICAgIHRoaXMuX29uRWxlbWVudE1vdXNlRXZlbnQoJ21vdXNld2hlZWwnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX2RldGVybWluZVRvdWNoZWRFbGVtZW50cyhldmVudCkge1xuICAgICAgICBjb25zdCB0b3VjaGVkRWxlbWVudHMgPSB7fTtcbiAgICAgICAgY29uc3QgY2FtZXJhcyA9IHRoaXMuYXBwLnN5c3RlbXMuY2FtZXJhLmNhbWVyYXM7XG5cbiAgICAgICAgLy8gY2hlY2sgY2FtZXJhcyBmcm9tIGxhc3QgdG8gZnJvbnRcbiAgICAgICAgLy8gc28gdGhhdCBlbGVtZW50cyB0aGF0IGFyZSBkcmF3biBhYm92ZSBvdGhlcnNcbiAgICAgICAgLy8gcmVjZWl2ZSBldmVudHMgZmlyc3RcbiAgICAgICAgZm9yIChsZXQgaSA9IGNhbWVyYXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IGNhbWVyYXNbaV07XG5cbiAgICAgICAgICAgIGxldCBkb25lID0gMDtcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgICAgICAgICAgICBpZiAodG91Y2hlZEVsZW1lbnRzW2V2ZW50LmNoYW5nZWRUb3VjaGVzW2pdLmlkZW50aWZpZXJdKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvbmUrKztcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY29vcmRzID0gdGhpcy5fY2FsY1RvdWNoQ29vcmRzKGV2ZW50LmNoYW5nZWRUb3VjaGVzW2pdKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9nZXRUYXJnZXRFbGVtZW50QnlDb29yZHMoY2FtZXJhLCBjb29yZHMueCwgY29vcmRzLnkpO1xuICAgICAgICAgICAgICAgIGlmIChlbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGRvbmUrKztcbiAgICAgICAgICAgICAgICAgICAgdG91Y2hlZEVsZW1lbnRzW2V2ZW50LmNoYW5nZWRUb3VjaGVzW2pdLmlkZW50aWZpZXJdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZWxlbWVudDogZWxlbWVudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbWVyYTogY2FtZXJhLFxuICAgICAgICAgICAgICAgICAgICAgICAgeDogY29vcmRzLngsXG4gICAgICAgICAgICAgICAgICAgICAgICB5OiBjb29yZHMueVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRvbmUgPT09IGxlbikge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRvdWNoZWRFbGVtZW50cztcbiAgICB9XG5cbiAgICBfaGFuZGxlVG91Y2hTdGFydChldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBuZXdUb3VjaGVkRWxlbWVudHMgPSB0aGlzLl9kZXRlcm1pbmVUb3VjaGVkRWxlbWVudHMoZXZlbnQpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdG91Y2ggPSBldmVudC5jaGFuZ2VkVG91Y2hlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG5ld1RvdWNoSW5mbyA9IG5ld1RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcbiAgICAgICAgICAgIGNvbnN0IG9sZFRvdWNoSW5mbyA9IHRoaXMuX3RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcblxuICAgICAgICAgICAgaWYgKG5ld1RvdWNoSW5mbyAmJiAoIW9sZFRvdWNoSW5mbyB8fCBuZXdUb3VjaEluZm8uZWxlbWVudCAhPT0gb2xkVG91Y2hJbmZvLmVsZW1lbnQpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KGV2ZW50LnR5cGUsIG5ldyBFbGVtZW50VG91Y2hFdmVudChldmVudCwgbmV3VG91Y2hJbmZvLmVsZW1lbnQsIG5ld1RvdWNoSW5mby5jYW1lcmEsIG5ld1RvdWNoSW5mby54LCBuZXdUb3VjaEluZm8ueSwgdG91Y2gpKTtcbiAgICAgICAgICAgICAgICB0aGlzLl90b3VjaGVzRm9yV2hpY2hUb3VjaExlYXZlSGFzRmlyZWRbdG91Y2guaWRlbnRpZmllcl0gPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgdG91Y2hJZCBpbiBuZXdUb3VjaGVkRWxlbWVudHMpIHtcbiAgICAgICAgICAgIHRoaXMuX3RvdWNoZWRFbGVtZW50c1t0b3VjaElkXSA9IG5ld1RvdWNoZWRFbGVtZW50c1t0b3VjaElkXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVUb3VjaEVuZChldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBjYW1lcmFzID0gdGhpcy5hcHAuc3lzdGVtcy5jYW1lcmEuY2FtZXJhcztcblxuICAgICAgICAvLyBjbGVhciBjbGlja2VkIGVudGl0aWVzIGZpcnN0IHRoZW4gc3RvcmUgZWFjaCBjbGlja2VkIGVudGl0eVxuICAgICAgICAvLyBpbiBfY2xpY2tlZEVudGl0aWVzIHNvIHRoYXQgd2UgZG9uJ3QgZmlyZSBhbm90aGVyIGNsaWNrXG4gICAgICAgIC8vIG9uIGl0IGluIHRoaXMgaGFuZGxlciBvciBpbiB0aGUgbW91c2V1cCBoYW5kbGVyIHdoaWNoIGlzXG4gICAgICAgIC8vIGZpcmVkIGxhdGVyXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMuX2NsaWNrZWRFbnRpdGllcykge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2NsaWNrZWRFbnRpdGllc1trZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB0b3VjaCA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzW2ldO1xuICAgICAgICAgICAgY29uc3QgdG91Y2hJbmZvID0gdGhpcy5fdG91Y2hlZEVsZW1lbnRzW3RvdWNoLmlkZW50aWZpZXJdO1xuICAgICAgICAgICAgaWYgKCF0b3VjaEluZm8pXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0b3VjaEluZm8uZWxlbWVudDtcbiAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHRvdWNoSW5mby5jYW1lcmE7XG4gICAgICAgICAgICBjb25zdCB4ID0gdG91Y2hJbmZvLng7XG4gICAgICAgICAgICBjb25zdCB5ID0gdG91Y2hJbmZvLnk7XG5cbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl90b3VjaGVkRWxlbWVudHNbdG91Y2guaWRlbnRpZmllcl07XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fdG91Y2hlc0ZvcldoaWNoVG91Y2hMZWF2ZUhhc0ZpcmVkW3RvdWNoLmlkZW50aWZpZXJdO1xuXG4gICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoZXZlbnQudHlwZSwgbmV3IEVsZW1lbnRUb3VjaEV2ZW50KGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIHgsIHksIHRvdWNoKSk7XG5cbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHRvdWNoIHdhcyByZWxlYXNlZCBvdmVyIHByZXZpb3VzbHkgdG91Y2hcbiAgICAgICAgICAgIC8vIGVsZW1lbnQgaW4gb3JkZXIgdG8gZmlyZSBjbGljayBldmVudFxuICAgICAgICAgICAgY29uc3QgY29vcmRzID0gdGhpcy5fY2FsY1RvdWNoQ29vcmRzKHRvdWNoKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgYyA9IGNhbWVyYXMubGVuZ3RoIC0gMTsgYyA+PSAwOyBjLS0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBob3ZlcmVkID0gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudEJ5Q29vcmRzKGNhbWVyYXNbY10sIGNvb3Jkcy54LCBjb29yZHMueSk7XG4gICAgICAgICAgICAgICAgaWYgKGhvdmVyZWQgPT09IGVsZW1lbnQpIHtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2NsaWNrZWRFbnRpdGllc1tlbGVtZW50LmVudGl0eS5nZXRHdWlkKCldKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ2NsaWNrJywgbmV3IEVsZW1lbnRUb3VjaEV2ZW50KGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIHgsIHksIHRvdWNoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jbGlja2VkRW50aXRpZXNbZWxlbWVudC5lbnRpdHkuZ2V0R3VpZCgpXSA9IERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9oYW5kbGVUb3VjaE1vdmUoZXZlbnQpIHtcbiAgICAgICAgLy8gY2FsbCBwcmV2ZW50RGVmYXVsdCB0byBhdm9pZCBpc3N1ZXMgaW4gQ2hyb21lIEFuZHJvaWQ6XG4gICAgICAgIC8vIGh0dHA6Ly93aWxzb25wYWdlLmNvLnVrL3RvdWNoLWV2ZW50cy1pbi1jaHJvbWUtYW5kcm9pZC9cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBuZXdUb3VjaGVkRWxlbWVudHMgPSB0aGlzLl9kZXRlcm1pbmVUb3VjaGVkRWxlbWVudHMoZXZlbnQpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdG91Y2ggPSBldmVudC5jaGFuZ2VkVG91Y2hlc1tpXTtcbiAgICAgICAgICAgIGNvbnN0IG5ld1RvdWNoSW5mbyA9IG5ld1RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcbiAgICAgICAgICAgIGNvbnN0IG9sZFRvdWNoSW5mbyA9IHRoaXMuX3RvdWNoZWRFbGVtZW50c1t0b3VjaC5pZGVudGlmaWVyXTtcblxuICAgICAgICAgICAgaWYgKG9sZFRvdWNoSW5mbykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvb3JkcyA9IHRoaXMuX2NhbGNUb3VjaENvb3Jkcyh0b3VjaCk7XG5cbiAgICAgICAgICAgICAgICAvLyBGaXJlIHRvdWNobGVhdmUgaWYgd2UndmUgbGVmdCB0aGUgcHJldmlvdXNseSB0b3VjaGVkIGVsZW1lbnRcbiAgICAgICAgICAgICAgICBpZiAoKCFuZXdUb3VjaEluZm8gfHwgbmV3VG91Y2hJbmZvLmVsZW1lbnQgIT09IG9sZFRvdWNoSW5mby5lbGVtZW50KSAmJiAhdGhpcy5fdG91Y2hlc0ZvcldoaWNoVG91Y2hMZWF2ZUhhc0ZpcmVkW3RvdWNoLmlkZW50aWZpZXJdKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgndG91Y2hsZWF2ZScsIG5ldyBFbGVtZW50VG91Y2hFdmVudChldmVudCwgb2xkVG91Y2hJbmZvLmVsZW1lbnQsIG9sZFRvdWNoSW5mby5jYW1lcmEsIGNvb3Jkcy54LCBjb29yZHMueSwgdG91Y2gpKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBGbGFnIHRoYXQgdG91Y2hsZWF2ZSBoYXMgYmVlbiBmaXJlZCBmb3IgdGhpcyB0b3VjaCwgc28gdGhhdCB3ZSBkb24ndFxuICAgICAgICAgICAgICAgICAgICAvLyByZS1maXJlIGl0IG9uIHRoZSBuZXh0IHRvdWNobW92ZS4gVGhpcyBpcyByZXF1aXJlZCBiZWNhdXNlIHRvdWNobW92ZVxuICAgICAgICAgICAgICAgICAgICAvLyBldmVudHMga2VlcCBvbiBmaXJpbmcgZm9yIHRoZSBzYW1lIGVsZW1lbnQgdW50aWwgdGhlIHRvdWNoIGVuZHMsIGV2ZW5cbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIHRvdWNoIHBvc2l0aW9uIG1vdmVzIGF3YXkgZnJvbSB0aGUgZWxlbWVudC4gVG91Y2hsZWF2ZSwgb24gdGhlXG4gICAgICAgICAgICAgICAgICAgIC8vIG90aGVyIGhhbmQsIHNob3VsZCBmaXJlIG9uY2Ugd2hlbiB0aGUgdG91Y2ggcG9zaXRpb24gbW92ZXMgYXdheSBmcm9tXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoZSBlbGVtZW50IGFuZCB0aGVuIG5vdCByZS1maXJlIGFnYWluIHdpdGhpbiB0aGUgc2FtZSB0b3VjaCBzZXNzaW9uLlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90b3VjaGVzRm9yV2hpY2hUb3VjaExlYXZlSGFzRmlyZWRbdG91Y2guaWRlbnRpZmllcl0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgndG91Y2htb3ZlJywgbmV3IEVsZW1lbnRUb3VjaEV2ZW50KGV2ZW50LCBvbGRUb3VjaEluZm8uZWxlbWVudCwgb2xkVG91Y2hJbmZvLmNhbWVyYSwgY29vcmRzLngsIGNvb3Jkcy55LCB0b3VjaCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uRWxlbWVudE1vdXNlRXZlbnQoZXZlbnRUeXBlLCBldmVudCkge1xuICAgICAgICBsZXQgZWxlbWVudCA9IG51bGw7XG5cbiAgICAgICAgY29uc3QgbGFzdEhvdmVyZWQgPSB0aGlzLl9ob3ZlcmVkRWxlbWVudDtcbiAgICAgICAgdGhpcy5faG92ZXJlZEVsZW1lbnQgPSBudWxsO1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYXMgPSB0aGlzLmFwcC5zeXN0ZW1zLmNhbWVyYS5jYW1lcmFzO1xuICAgICAgICBsZXQgY2FtZXJhO1xuXG4gICAgICAgIC8vIGNoZWNrIGNhbWVyYXMgZnJvbSBsYXN0IHRvIGZyb250XG4gICAgICAgIC8vIHNvIHRoYXQgZWxlbWVudHMgdGhhdCBhcmUgZHJhd24gYWJvdmUgb3RoZXJzXG4gICAgICAgIC8vIHJlY2VpdmUgZXZlbnRzIGZpcnN0XG4gICAgICAgIGZvciAobGV0IGkgPSBjYW1lcmFzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICBjYW1lcmEgPSBjYW1lcmFzW2ldO1xuXG4gICAgICAgICAgICBlbGVtZW50ID0gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudEJ5Q29vcmRzKGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSk7XG4gICAgICAgICAgICBpZiAoZWxlbWVudClcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGN1cnJlbnRseSBob3ZlcmVkIGVsZW1lbnQgaXMgd2hhdGV2ZXIncyBiZWluZyBwb2ludGVkIGJ5IG1vdXNlICh3aGljaCBtYXkgYmUgbnVsbClcbiAgICAgICAgdGhpcy5faG92ZXJlZEVsZW1lbnQgPSBlbGVtZW50O1xuXG4gICAgICAgIC8vIGlmIHRoZXJlIHdhcyBhIHByZXNzZWQgZWxlbWVudCwgaXQgdGFrZXMgZnVsbCBwcmlvcml0eSBvZiAnbW92ZScgYW5kICd1cCcgZXZlbnRzXG4gICAgICAgIGlmICgoZXZlbnRUeXBlID09PSAnbW91c2Vtb3ZlJyB8fCBldmVudFR5cGUgPT09ICdtb3VzZXVwJykgJiYgdGhpcy5fcHJlc3NlZEVsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudChldmVudFR5cGUsIG5ldyBFbGVtZW50TW91c2VFdmVudChldmVudCwgdGhpcy5fcHJlc3NlZEVsZW1lbnQsIGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSwgdGhpcy5fbGFzdFgsIHRoaXMuX2xhc3RZKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZWxlbWVudCkge1xuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBmaXJlIGl0IHRvIHRoZSBjdXJyZW50bHkgaG92ZXJlZCBldmVudFxuICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KGV2ZW50VHlwZSwgbmV3IEVsZW1lbnRNb3VzZUV2ZW50KGV2ZW50LCBlbGVtZW50LCBjYW1lcmEsIHRhcmdldFgsIHRhcmdldFksIHRoaXMuX2xhc3RYLCB0aGlzLl9sYXN0WSkpO1xuXG4gICAgICAgICAgICBpZiAoZXZlbnRUeXBlID09PSAnbW91c2Vkb3duJykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3ByZXNzZWRFbGVtZW50ID0gZWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYXN0SG92ZXJlZCAhPT0gdGhpcy5faG92ZXJlZEVsZW1lbnQpIHtcbiAgICAgICAgICAgIC8vIG1vdXNlbGVhdmUgZXZlbnRcbiAgICAgICAgICAgIGlmIChsYXN0SG92ZXJlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgnbW91c2VsZWF2ZScsIG5ldyBFbGVtZW50TW91c2VFdmVudChldmVudCwgbGFzdEhvdmVyZWQsIGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSwgdGhpcy5fbGFzdFgsIHRoaXMuX2xhc3RZKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG1vdXNlZW50ZXIgZXZlbnRcbiAgICAgICAgICAgIGlmICh0aGlzLl9ob3ZlcmVkRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgnbW91c2VlbnRlcicsIG5ldyBFbGVtZW50TW91c2VFdmVudChldmVudCwgdGhpcy5faG92ZXJlZEVsZW1lbnQsIGNhbWVyYSwgdGFyZ2V0WCwgdGFyZ2V0WSwgdGhpcy5fbGFzdFgsIHRoaXMuX2xhc3RZKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnRUeXBlID09PSAnbW91c2V1cCcgJiYgdGhpcy5fcHJlc3NlZEVsZW1lbnQpIHtcbiAgICAgICAgICAgIC8vIGNsaWNrIGV2ZW50XG4gICAgICAgICAgICBpZiAodGhpcy5fcHJlc3NlZEVsZW1lbnQgPT09IHRoaXMuX2hvdmVyZWRFbGVtZW50KSB7XG4gICAgICAgICAgICAgICAgLy8gZmlyZSBjbGljayBldmVudCBpZiBpdCBoYXNuJ3QgYmVlbiBmaXJlZCBhbHJlYWR5IGJ5IHRoZSB0b3VjaGVuZCBoYW5kbGVyXG4gICAgICAgICAgICAgICAgY29uc3QgZ3VpZCA9IHRoaXMuX2hvdmVyZWRFbGVtZW50LmVudGl0eS5nZXRHdWlkKCk7XG4gICAgICAgICAgICAgICAgLy8gQWx3YXlzIGZpcmUsIGlmIHRoZXJlIGFyZSBubyBjbGlja2VkIGVudGl0aWVzXG4gICAgICAgICAgICAgICAgbGV0IGZpcmVDbGljayA9ICF0aGlzLl9jbGlja2VkRW50aXRpZXM7XG4gICAgICAgICAgICAgICAgLy8gQnV0IGlmIHRoZXJlIGFyZSwgd2UgbmVlZCB0byBjaGVjayBob3cgbG9uZyBhZ28gdG91Y2hlbmQgYWRkZWQgYSBcImNsaWNrIGJyYWtlXCJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY2xpY2tlZEVudGl0aWVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RUb3VjaFVwID0gdGhpcy5fY2xpY2tlZEVudGl0aWVzW2d1aWRdIHx8IDA7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGR0ID0gRGF0ZS5ub3coKSAtIGxhc3RUb3VjaFVwO1xuICAgICAgICAgICAgICAgICAgICBmaXJlQ2xpY2sgPSBkdCA+IDMwMDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBXZSBkbyBub3QgY2hlY2sgYW5vdGhlciB0aW1lLCBzbyB0aGUgd29yc3QgdGhpbmcgdGhhdCBjYW4gaGFwcGVuIGlzIG9uZSBpZ25vcmVkIGNsaWNrIGluIDMwMG1zLlxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fY2xpY2tlZEVudGl0aWVzW2d1aWRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoZmlyZUNsaWNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVFdmVudCgnY2xpY2snLCBuZXcgRWxlbWVudE1vdXNlRXZlbnQoZXZlbnQsIHRoaXMuX2hvdmVyZWRFbGVtZW50LCBjYW1lcmEsIHRhcmdldFgsIHRhcmdldFksIHRoaXMuX2xhc3RYLCB0aGlzLl9sYXN0WSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3ByZXNzZWRFbGVtZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblhyU3RhcnQoKSB7XG4gICAgICAgIHRoaXMuYXBwLnhyLm9uKCdlbmQnLCB0aGlzLl9vblhyRW5kLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIub24oJ3VwZGF0ZScsIHRoaXMuX29uWHJVcGRhdGUsIHRoaXMpO1xuICAgICAgICB0aGlzLmFwcC54ci5pbnB1dC5vbignc2VsZWN0c3RhcnQnLCB0aGlzLl9vblNlbGVjdFN0YXJ0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub24oJ3NlbGVjdGVuZCcsIHRoaXMuX29uU2VsZWN0RW5kLCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub24oJ3JlbW92ZScsIHRoaXMuX29uWHJJbnB1dFJlbW92ZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uWHJFbmQoKSB7XG4gICAgICAgIHRoaXMuYXBwLnhyLm9mZigndXBkYXRlJywgdGhpcy5fb25YclVwZGF0ZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZignc2VsZWN0c3RhcnQnLCB0aGlzLl9vblNlbGVjdFN0YXJ0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5hcHAueHIuaW5wdXQub2ZmKCdzZWxlY3RlbmQnLCB0aGlzLl9vblNlbGVjdEVuZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuYXBwLnhyLmlucHV0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25YcklucHV0UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25YclVwZGF0ZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgaW5wdXRTb3VyY2VzID0gdGhpcy5hcHAueHIuaW5wdXQuaW5wdXRTb3VyY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0U291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fb25FbGVtZW50U2VsZWN0RXZlbnQoJ3NlbGVjdG1vdmUnLCBpbnB1dFNvdXJjZXNbaV0sIG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uWHJJbnB1dFJlbW92ZShpbnB1dFNvdXJjZSkge1xuICAgICAgICBjb25zdCBob3ZlcmVkID0gdGhpcy5fc2VsZWN0ZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG4gICAgICAgIGlmIChob3ZlcmVkKSB7XG4gICAgICAgICAgICBpbnB1dFNvdXJjZS5fZWxlbWVudEVudGl0eSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ3NlbGVjdGxlYXZlJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChudWxsLCBob3ZlcmVkLCBudWxsLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuX3NlbGVjdGVkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICBkZWxldGUgdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgIH1cblxuICAgIF9vblNlbGVjdFN0YXJ0KGlucHV0U291cmNlLCBldmVudCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VuYWJsZWQpIHJldHVybjtcbiAgICAgICAgdGhpcy5fb25FbGVtZW50U2VsZWN0RXZlbnQoJ3NlbGVjdHN0YXJ0JywgaW5wdXRTb3VyY2UsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25TZWxlY3RFbmQoaW5wdXRTb3VyY2UsIGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5fZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9vbkVsZW1lbnRTZWxlY3RFdmVudCgnc2VsZWN0ZW5kJywgaW5wdXRTb3VyY2UsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25FbGVtZW50U2VsZWN0RXZlbnQoZXZlbnRUeXBlLCBpbnB1dFNvdXJjZSwgZXZlbnQpIHtcbiAgICAgICAgbGV0IGVsZW1lbnQ7XG5cbiAgICAgICAgY29uc3QgaG92ZXJlZEJlZm9yZSA9IHRoaXMuX3NlbGVjdGVkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICBsZXQgaG92ZXJlZE5vdztcblxuICAgICAgICBjb25zdCBjYW1lcmFzID0gdGhpcy5hcHAuc3lzdGVtcy5jYW1lcmEuY2FtZXJhcztcbiAgICAgICAgbGV0IGNhbWVyYTtcblxuICAgICAgICBpZiAoaW5wdXRTb3VyY2UuZWxlbWVudElucHV0KSB7XG4gICAgICAgICAgICByYXlDLnNldChpbnB1dFNvdXJjZS5nZXRPcmlnaW4oKSwgaW5wdXRTb3VyY2UuZ2V0RGlyZWN0aW9uKCkpO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gY2FtZXJhcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgICAgICAgICAgIGNhbWVyYSA9IGNhbWVyYXNbaV07XG5cbiAgICAgICAgICAgICAgICBlbGVtZW50ID0gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudEJ5UmF5KHJheUMsIGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgaWYgKGVsZW1lbnQpXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaW5wdXRTb3VyY2UuX2VsZW1lbnRFbnRpdHkgPSBlbGVtZW50IHx8IG51bGw7XG5cbiAgICAgICAgaWYgKGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3NlbGVjdGVkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdID0gZWxlbWVudDtcbiAgICAgICAgICAgIGhvdmVyZWROb3cgPSBlbGVtZW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3NlbGVjdGVkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhvdmVyZWRCZWZvcmUgIT09IGhvdmVyZWROb3cpIHtcbiAgICAgICAgICAgIGlmIChob3ZlcmVkQmVmb3JlKSB0aGlzLl9maXJlRXZlbnQoJ3NlbGVjdGxlYXZlJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgaG92ZXJlZEJlZm9yZSwgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICAgICAgaWYgKGhvdmVyZWROb3cpIHRoaXMuX2ZpcmVFdmVudCgnc2VsZWN0ZW50ZXInLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50LCBob3ZlcmVkTm93LCBjYW1lcmEsIGlucHV0U291cmNlKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcmVzc2VkID0gdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdO1xuICAgICAgICBpZiAoZXZlbnRUeXBlID09PSAnc2VsZWN0bW92ZScgJiYgcHJlc3NlZCkge1xuICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCdzZWxlY3Rtb3ZlJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgcHJlc3NlZCwgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50VHlwZSA9PT0gJ3NlbGVjdHN0YXJ0Jykge1xuICAgICAgICAgICAgdGhpcy5fc2VsZWN0ZWRQcmVzc2VkRWxlbWVudHNbaW5wdXRTb3VyY2UuaWRdID0gaG92ZXJlZE5vdztcbiAgICAgICAgICAgIGlmIChob3ZlcmVkTm93KSB0aGlzLl9maXJlRXZlbnQoJ3NlbGVjdHN0YXJ0JywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgaG92ZXJlZE5vdywgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpbnB1dFNvdXJjZS5lbGVtZW50SW5wdXQgJiYgcHJlc3NlZCkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3NlbGVjdGVkUHJlc3NlZEVsZW1lbnRzW2lucHV0U291cmNlLmlkXTtcbiAgICAgICAgICAgIGlmIChob3ZlcmVkQmVmb3JlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCdzZWxlY3RlbmQnLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50LCBwcmVzc2VkLCBjYW1lcmEsIGlucHV0U291cmNlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXZlbnRUeXBlID09PSAnc2VsZWN0ZW5kJyAmJiBpbnB1dFNvdXJjZS5lbGVtZW50SW5wdXQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9zZWxlY3RlZFByZXNzZWRFbGVtZW50c1tpbnB1dFNvdXJjZS5pZF07XG5cbiAgICAgICAgICAgIGlmIChwcmVzc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUV2ZW50KCdzZWxlY3RlbmQnLCBuZXcgRWxlbWVudFNlbGVjdEV2ZW50KGV2ZW50LCBwcmVzc2VkLCBjYW1lcmEsIGlucHV0U291cmNlKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwcmVzc2VkICYmIHByZXNzZWQgPT09IGhvdmVyZWRCZWZvcmUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9maXJlRXZlbnQoJ2NsaWNrJywgbmV3IEVsZW1lbnRTZWxlY3RFdmVudChldmVudCwgcHJlc3NlZCwgY2FtZXJhLCBpbnB1dFNvdXJjZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2ZpcmVFdmVudChuYW1lLCBldnQpIHtcbiAgICAgICAgbGV0IGVsZW1lbnQgPSBldnQuZWxlbWVudDtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGVsZW1lbnQuZmlyZShuYW1lLCBldnQpO1xuICAgICAgICAgICAgaWYgKGV2dC5fc3RvcFByb3BhZ2F0aW9uKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBpZiAoIWVsZW1lbnQuZW50aXR5LnBhcmVudClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZWxlbWVudCA9IGVsZW1lbnQuZW50aXR5LnBhcmVudC5lbGVtZW50O1xuICAgICAgICAgICAgaWYgKCFlbGVtZW50KVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NhbGNNb3VzZUNvb3JkcyhldmVudCkge1xuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5fdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBjb25zdCBsZWZ0ID0gTWF0aC5mbG9vcihyZWN0LmxlZnQpO1xuICAgICAgICBjb25zdCB0b3AgPSBNYXRoLmZsb29yKHJlY3QudG9wKTtcbiAgICAgICAgdGFyZ2V0WCA9IChldmVudC5jbGllbnRYIC0gbGVmdCk7XG4gICAgICAgIHRhcmdldFkgPSAoZXZlbnQuY2xpZW50WSAtIHRvcCk7XG4gICAgfVxuXG4gICAgX2NhbGNUb3VjaENvb3Jkcyh0b3VjaCkge1xuICAgICAgICBsZXQgdG90YWxPZmZzZXRYID0gMDtcbiAgICAgICAgbGV0IHRvdGFsT2Zmc2V0WSA9IDA7XG4gICAgICAgIGxldCB0YXJnZXQgPSB0b3VjaC50YXJnZXQ7XG4gICAgICAgIHdoaWxlICghKHRhcmdldCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGN1cnJlbnRFbGVtZW50ID0gdGFyZ2V0O1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIHRvdGFsT2Zmc2V0WCArPSBjdXJyZW50RWxlbWVudC5vZmZzZXRMZWZ0IC0gY3VycmVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcbiAgICAgICAgICAgIHRvdGFsT2Zmc2V0WSArPSBjdXJyZW50RWxlbWVudC5vZmZzZXRUb3AgLSBjdXJyZW50RWxlbWVudC5zY3JvbGxUb3A7XG4gICAgICAgICAgICBjdXJyZW50RWxlbWVudCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFBhcmVudDtcbiAgICAgICAgfSB3aGlsZSAoY3VycmVudEVsZW1lbnQpO1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSBjb29yZHMgYW5kIHNjYWxlIHRoZW0gdG8gdGhlIGdyYXBoaWNzRGV2aWNlIHNpemVcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6ICh0b3VjaC5wYWdlWCAtIHRvdGFsT2Zmc2V0WCksXG4gICAgICAgICAgICB5OiAodG91Y2gucGFnZVkgLSB0b3RhbE9mZnNldFkpXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgX3NvcnRFbGVtZW50cyhhLCBiKSB7XG4gICAgICAgIGNvbnN0IGxheWVyT3JkZXIgPSB0aGlzLmFwcC5zY2VuZS5sYXllcnMuc29ydFRyYW5zcGFyZW50TGF5ZXJzKGEubGF5ZXJzLCBiLmxheWVycyk7XG4gICAgICAgIGlmIChsYXllck9yZGVyICE9PSAwKSByZXR1cm4gbGF5ZXJPcmRlcjtcblxuICAgICAgICBpZiAoYS5zY3JlZW4gJiYgIWIuc2NyZWVuKVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICBpZiAoIWEuc2NyZWVuICYmIGIuc2NyZWVuKVxuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIGlmICghYS5zY3JlZW4gJiYgIWIuc2NyZWVuKVxuICAgICAgICAgICAgcmV0dXJuIDA7XG5cbiAgICAgICAgaWYgKGEuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSAmJiAhYi5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlKVxuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICBpZiAoYi5zY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlICYmICFhLnNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpXG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgcmV0dXJuIGIuZHJhd09yZGVyIC0gYS5kcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgX2dldFRhcmdldEVsZW1lbnRCeUNvb3JkcyhjYW1lcmEsIHgsIHkpIHtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHNjcmVlbi1zcGFjZSBhbmQgM2Qtc3BhY2UgcmF5c1xuICAgICAgICBjb25zdCByYXlTY3JlZW4gPSB0aGlzLl9jYWxjdWxhdGVSYXlTY3JlZW4oeCwgeSwgY2FtZXJhLCByYXlBKSA/IHJheUEgOiBudWxsO1xuICAgICAgICBjb25zdCByYXkzZCA9IHRoaXMuX2NhbGN1bGF0ZVJheTNkKHgsIHksIGNhbWVyYSwgcmF5QikgPyByYXlCIDogbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0VGFyZ2V0RWxlbWVudChjYW1lcmEsIHJheVNjcmVlbiwgcmF5M2QpO1xuICAgIH1cblxuICAgIF9nZXRUYXJnZXRFbGVtZW50QnlSYXkocmF5LCBjYW1lcmEpIHtcbiAgICAgICAgLy8gM2QgcmF5IGlzIGNvcGllZCBmcm9tIGlucHV0IHJheVxuICAgICAgICByYXlBLm9yaWdpbi5jb3B5KHJheS5vcmlnaW4pO1xuICAgICAgICByYXlBLmRpcmVjdGlvbi5jb3B5KHJheS5kaXJlY3Rpb24pO1xuICAgICAgICByYXlBLmVuZC5jb3B5KHJheUEuZGlyZWN0aW9uKS5tdWxTY2FsYXIoY2FtZXJhLmZhckNsaXAgKiAyKS5hZGQocmF5QS5vcmlnaW4pO1xuICAgICAgICBjb25zdCByYXkzZCA9IHJheUE7XG5cbiAgICAgICAgLy8gc2NyZWVuLXNwYWNlIHJheSBpcyBidWlsdCBmcm9tIGlucHV0IHJheSdzIG9yaWdpbiwgY29udmVydGVkIHRvIHNjcmVlbi1zcGFjZVxuICAgICAgICBjb25zdCBzY3JlZW5Qb3MgPSBjYW1lcmEud29ybGRUb1NjcmVlbihyYXkzZC5vcmlnaW4sIHZlY0EpO1xuICAgICAgICBjb25zdCByYXlTY3JlZW4gPSB0aGlzLl9jYWxjdWxhdGVSYXlTY3JlZW4oc2NyZWVuUG9zLngsIHNjcmVlblBvcy55LCBjYW1lcmEsIHJheUIpID8gcmF5QiA6IG51bGw7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFRhcmdldEVsZW1lbnQoY2FtZXJhLCByYXlTY3JlZW4sIHJheTNkKTtcbiAgICB9XG5cbiAgICBfZ2V0VGFyZ2V0RWxlbWVudChjYW1lcmEsIHJheVNjcmVlbiwgcmF5M2QpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IG51bGw7XG4gICAgICAgIGxldCBjbG9zZXN0RGlzdGFuY2UzZCA9IEluZmluaXR5O1xuXG4gICAgICAgIC8vIHNvcnQgZWxlbWVudHMgYmFzZWQgb24gbGF5ZXJzIGFuZCBkcmF3IG9yZGVyXG4gICAgICAgIHRoaXMuX2VsZW1lbnRzLnNvcnQodGhpcy5fc29ydEhhbmRsZXIpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9lbGVtZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnRzW2ldO1xuXG4gICAgICAgICAgICAvLyBjaGVjayBpZiBhbnkgb2YgdGhlIGxheWVycyB0aGlzIGVsZW1lbnQgcmVuZGVycyB0byBpcyBiZWluZyByZW5kZXJlZCBieSB0aGUgY2FtZXJhXG4gICAgICAgICAgICBpZiAoIWVsZW1lbnQubGF5ZXJzLnNvbWUodiA9PiBjYW1lcmEubGF5ZXJzU2V0Lmhhcyh2KSkpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGVsZW1lbnQuc2NyZWVuICYmIGVsZW1lbnQuc2NyZWVuLnNjcmVlbi5zY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgICAgIGlmICghcmF5U2NyZWVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIDJkIHNjcmVlbiBlbGVtZW50cyB0YWtlIHByZWNlZGVuY2UgLSBpZiBoaXQsIGltbWVkaWF0ZWx5IHJldHVyblxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnREaXN0YW5jZSA9IHRoaXMuX2NoZWNrRWxlbWVudChyYXlTY3JlZW4sIGVsZW1lbnQsIHRydWUpO1xuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50RGlzdGFuY2UgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBlbGVtZW50O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghcmF5M2QpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY3VycmVudERpc3RhbmNlID0gdGhpcy5fY2hlY2tFbGVtZW50KHJheTNkLCBlbGVtZW50LCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgaWYgKGN1cnJlbnREaXN0YW5jZSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBjbG9zZXN0IG9uZSBpbiB3b3JsZCBzcGFjZVxuICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudERpc3RhbmNlIDwgY2xvc2VzdERpc3RhbmNlM2QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGVsZW1lbnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbG9zZXN0RGlzdGFuY2UzZCA9IGN1cnJlbnREaXN0YW5jZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBlbGVtZW50IGlzIG9uIGEgU2NyZWVuLCBpdCB0YWtlcyBwcmVjZWRlbmNlXG4gICAgICAgICAgICAgICAgICAgIGlmIChlbGVtZW50LnNjcmVlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZWxlbWVudDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBfY2FsY3VsYXRlUmF5U2NyZWVuKHgsIHksIGNhbWVyYSwgcmF5KSB7XG4gICAgICAgIGNvbnN0IHN3ID0gdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2Uud2lkdGg7XG4gICAgICAgIGNvbnN0IHNoID0gdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2UuaGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IGNhbWVyYVdpZHRoID0gY2FtZXJhLnJlY3QueiAqIHN3O1xuICAgICAgICBjb25zdCBjYW1lcmFIZWlnaHQgPSBjYW1lcmEucmVjdC53ICogc2g7XG4gICAgICAgIGNvbnN0IGNhbWVyYUxlZnQgPSBjYW1lcmEucmVjdC54ICogc3c7XG4gICAgICAgIGNvbnN0IGNhbWVyYVJpZ2h0ID0gY2FtZXJhTGVmdCArIGNhbWVyYVdpZHRoO1xuICAgICAgICAvLyBjYW1lcmEgYm90dG9tIChvcmlnaW4gaXMgYm90dG9tIGxlZnQgb2Ygd2luZG93KVxuICAgICAgICBjb25zdCBjYW1lcmFCb3R0b20gPSAoMSAtIGNhbWVyYS5yZWN0LnkpICogc2g7XG4gICAgICAgIGNvbnN0IGNhbWVyYVRvcCA9IGNhbWVyYUJvdHRvbSAtIGNhbWVyYUhlaWdodDtcblxuICAgICAgICBsZXQgX3ggPSB4ICogc3cgLyB0aGlzLl90YXJnZXQuY2xpZW50V2lkdGg7XG4gICAgICAgIGxldCBfeSA9IHkgKiBzaCAvIHRoaXMuX3RhcmdldC5jbGllbnRIZWlnaHQ7XG5cbiAgICAgICAgaWYgKF94ID49IGNhbWVyYUxlZnQgJiYgX3ggPD0gY2FtZXJhUmlnaHQgJiZcbiAgICAgICAgICAgIF95IDw9IGNhbWVyYUJvdHRvbSAmJiBfeSA+PSBjYW1lcmFUb3ApIHtcblxuICAgICAgICAgICAgLy8gbGltaXQgd2luZG93IGNvb3JkcyB0byBjYW1lcmEgcmVjdCBjb29yZHNcbiAgICAgICAgICAgIF94ID0gc3cgKiAoX3ggLSBjYW1lcmFMZWZ0KSAvIGNhbWVyYVdpZHRoO1xuICAgICAgICAgICAgX3kgPSBzaCAqIChfeSAtIGNhbWVyYVRvcCkgLyBjYW1lcmFIZWlnaHQ7XG5cbiAgICAgICAgICAgIC8vIHJldmVyc2UgX3lcbiAgICAgICAgICAgIF95ID0gc2ggLSBfeTtcblxuICAgICAgICAgICAgcmF5Lm9yaWdpbi5zZXQoX3gsIF95LCAxKTtcbiAgICAgICAgICAgIHJheS5kaXJlY3Rpb24uc2V0KDAsIDAsIC0xKTtcbiAgICAgICAgICAgIHJheS5lbmQuY29weShyYXkuZGlyZWN0aW9uKS5tdWxTY2FsYXIoMikuYWRkKHJheS5vcmlnaW4pO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgX2NhbGN1bGF0ZVJheTNkKHgsIHksIGNhbWVyYSwgcmF5KSB7XG4gICAgICAgIGNvbnN0IHN3ID0gdGhpcy5fdGFyZ2V0LmNsaWVudFdpZHRoO1xuICAgICAgICBjb25zdCBzaCA9IHRoaXMuX3RhcmdldC5jbGllbnRIZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgY2FtZXJhV2lkdGggPSBjYW1lcmEucmVjdC56ICogc3c7XG4gICAgICAgIGNvbnN0IGNhbWVyYUhlaWdodCA9IGNhbWVyYS5yZWN0LncgKiBzaDtcbiAgICAgICAgY29uc3QgY2FtZXJhTGVmdCA9IGNhbWVyYS5yZWN0LnggKiBzdztcbiAgICAgICAgY29uc3QgY2FtZXJhUmlnaHQgPSBjYW1lcmFMZWZ0ICsgY2FtZXJhV2lkdGg7XG4gICAgICAgIC8vIGNhbWVyYSBib3R0b20gLSBvcmlnaW4gaXMgYm90dG9tIGxlZnQgb2Ygd2luZG93XG4gICAgICAgIGNvbnN0IGNhbWVyYUJvdHRvbSA9ICgxIC0gY2FtZXJhLnJlY3QueSkgKiBzaDtcbiAgICAgICAgY29uc3QgY2FtZXJhVG9wID0gY2FtZXJhQm90dG9tIC0gY2FtZXJhSGVpZ2h0O1xuXG4gICAgICAgIGxldCBfeCA9IHg7XG4gICAgICAgIGxldCBfeSA9IHk7XG5cbiAgICAgICAgLy8gY2hlY2sgd2luZG93IGNvb3JkcyBhcmUgd2l0aGluIGNhbWVyYSByZWN0XG4gICAgICAgIGlmICh4ID49IGNhbWVyYUxlZnQgJiYgeCA8PSBjYW1lcmFSaWdodCAmJlxuICAgICAgICAgICAgeSA8PSBjYW1lcmFCb3R0b20gJiYgX3kgPj0gY2FtZXJhVG9wKSB7XG5cbiAgICAgICAgICAgIC8vIGxpbWl0IHdpbmRvdyBjb29yZHMgdG8gY2FtZXJhIHJlY3QgY29vcmRzXG4gICAgICAgICAgICBfeCA9IHN3ICogKF94IC0gY2FtZXJhTGVmdCkgLyBjYW1lcmFXaWR0aDtcbiAgICAgICAgICAgIF95ID0gc2ggKiAoX3kgLSAoY2FtZXJhVG9wKSkgLyBjYW1lcmFIZWlnaHQ7XG5cbiAgICAgICAgICAgIC8vIDNEIHNjcmVlblxuICAgICAgICAgICAgY2FtZXJhLnNjcmVlblRvV29ybGQoX3gsIF95LCBjYW1lcmEubmVhckNsaXAsIHZlY0EpO1xuICAgICAgICAgICAgY2FtZXJhLnNjcmVlblRvV29ybGQoX3gsIF95LCBjYW1lcmEuZmFyQ2xpcCwgdmVjQik7XG5cbiAgICAgICAgICAgIHJheS5vcmlnaW4uY29weSh2ZWNBKTtcbiAgICAgICAgICAgIHJheS5kaXJlY3Rpb24uc2V0KDAsIDAsIC0xKTtcbiAgICAgICAgICAgIHJheS5lbmQuY29weSh2ZWNCKTtcblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIF9jaGVja0VsZW1lbnQocmF5LCBlbGVtZW50LCBzY3JlZW4pIHtcbiAgICAgICAgLy8gZW5zdXJlIGNsaWNrIGlzIGNvbnRhaW5lZCBieSBhbnkgbWFzayBmaXJzdFxuICAgICAgICBpZiAoZWxlbWVudC5tYXNrZWRCeSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NoZWNrRWxlbWVudChyYXksIGVsZW1lbnQubWFza2VkQnkuZWxlbWVudCwgc2NyZWVuKSA8IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc2NhbGU7XG4gICAgICAgIGlmIChzY3JlZW4pIHtcbiAgICAgICAgICAgIHNjYWxlID0gRWxlbWVudElucHV0LmNhbGN1bGF0ZVNjYWxlVG9TY3JlZW4oZWxlbWVudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzY2FsZSA9IEVsZW1lbnRJbnB1dC5jYWxjdWxhdGVTY2FsZVRvV29ybGQoZWxlbWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb3JuZXJzID0gRWxlbWVudElucHV0LmJ1aWxkSGl0Q29ybmVycyhlbGVtZW50LCBzY3JlZW4gPyBlbGVtZW50LnNjcmVlbkNvcm5lcnMgOiBlbGVtZW50LndvcmxkQ29ybmVycywgc2NhbGUpO1xuXG4gICAgICAgIHJldHVybiBpbnRlcnNlY3RMaW5lUXVhZChyYXkub3JpZ2luLCByYXkuZW5kLCBjb3JuZXJzKTtcbiAgICB9XG5cbiAgICAvLyBJbiBtb3N0IGNhc2VzIHRoZSBjb3JuZXJzIHVzZWQgZm9yIGhpdCB0ZXN0aW5nIHdpbGwganVzdCBiZSB0aGUgZWxlbWVudCdzXG4gICAgLy8gc2NyZWVuIGNvcm5lcnMuIEhvd2V2ZXIsIGluIGNhc2VzIHdoZXJlIHRoZSBlbGVtZW50IGhhcyBhZGRpdGlvbmFsIGhpdFxuICAgIC8vIHBhZGRpbmcgc3BlY2lmaWVkLCB3ZSBuZWVkIHRvIGV4cGFuZCB0aGUgc2NyZWVuQ29ybmVycyB0byBpbmNvcnBvcmF0ZSB0aGVcbiAgICAvLyBwYWRkaW5nLlxuICAgIC8vIE5PVEU6IFVzZWQgYnkgRWRpdG9yIGZvciB2aXN1YWxpemF0aW9uIGluIHRoZSB2aWV3cG9ydFxuICAgIHN0YXRpYyBidWlsZEhpdENvcm5lcnMoZWxlbWVudCwgc2NyZWVuT3JXb3JsZENvcm5lcnMsIHNjYWxlKSB7XG4gICAgICAgIGxldCBoaXRDb3JuZXJzID0gc2NyZWVuT3JXb3JsZENvcm5lcnM7XG4gICAgICAgIGNvbnN0IGJ1dHRvbiA9IGVsZW1lbnQuZW50aXR5ICYmIGVsZW1lbnQuZW50aXR5LmJ1dHRvbjtcblxuICAgICAgICBpZiAoYnV0dG9uKSB7XG4gICAgICAgICAgICBjb25zdCBoaXRQYWRkaW5nID0gZWxlbWVudC5lbnRpdHkuYnV0dG9uLmhpdFBhZGRpbmcgfHwgWkVST19WRUM0O1xuXG4gICAgICAgICAgICBfcGFkZGluZ1RvcC5jb3B5KGVsZW1lbnQuZW50aXR5LnVwKTtcbiAgICAgICAgICAgIF9wYWRkaW5nQm90dG9tLmNvcHkoX3BhZGRpbmdUb3ApLm11bFNjYWxhcigtMSk7XG4gICAgICAgICAgICBfcGFkZGluZ1JpZ2h0LmNvcHkoZWxlbWVudC5lbnRpdHkucmlnaHQpO1xuICAgICAgICAgICAgX3BhZGRpbmdMZWZ0LmNvcHkoX3BhZGRpbmdSaWdodCkubXVsU2NhbGFyKC0xKTtcblxuICAgICAgICAgICAgX3BhZGRpbmdUb3AubXVsU2NhbGFyKGhpdFBhZGRpbmcudyAqIHNjYWxlLnkpO1xuICAgICAgICAgICAgX3BhZGRpbmdCb3R0b20ubXVsU2NhbGFyKGhpdFBhZGRpbmcueSAqIHNjYWxlLnkpO1xuICAgICAgICAgICAgX3BhZGRpbmdSaWdodC5tdWxTY2FsYXIoaGl0UGFkZGluZy56ICogc2NhbGUueCk7XG4gICAgICAgICAgICBfcGFkZGluZ0xlZnQubXVsU2NhbGFyKGhpdFBhZGRpbmcueCAqIHNjYWxlLngpO1xuXG4gICAgICAgICAgICBfY29ybmVyQm90dG9tTGVmdC5jb3B5KGhpdENvcm5lcnNbMF0pLmFkZChfcGFkZGluZ0JvdHRvbSkuYWRkKF9wYWRkaW5nTGVmdCk7XG4gICAgICAgICAgICBfY29ybmVyQm90dG9tUmlnaHQuY29weShoaXRDb3JuZXJzWzFdKS5hZGQoX3BhZGRpbmdCb3R0b20pLmFkZChfcGFkZGluZ1JpZ2h0KTtcbiAgICAgICAgICAgIF9jb3JuZXJUb3BSaWdodC5jb3B5KGhpdENvcm5lcnNbMl0pLmFkZChfcGFkZGluZ1RvcCkuYWRkKF9wYWRkaW5nUmlnaHQpO1xuICAgICAgICAgICAgX2Nvcm5lclRvcExlZnQuY29weShoaXRDb3JuZXJzWzNdKS5hZGQoX3BhZGRpbmdUb3ApLmFkZChfcGFkZGluZ0xlZnQpO1xuXG4gICAgICAgICAgICBoaXRDb3JuZXJzID0gW19jb3JuZXJCb3R0b21MZWZ0LCBfY29ybmVyQm90dG9tUmlnaHQsIF9jb3JuZXJUb3BSaWdodCwgX2Nvcm5lclRvcExlZnRdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIHRoZSBjb3JuZXJzIGFyZSBpbiB0aGUgcmlnaHQgb3JkZXIgW2JsLCBiciwgdHIsIHRsXVxuICAgICAgICAvLyBmb3IgeCBhbmQgeTogc2ltcGx5IGludmVydCB3aGF0IGlzIGNvbnNpZGVyZWQgXCJsZWZ0L3JpZ2h0XCIgYW5kIFwidG9wL2JvdHRvbVwiXG4gICAgICAgIGlmIChzY2FsZS54IDwgMCkge1xuICAgICAgICAgICAgY29uc3QgbGVmdCA9IGhpdENvcm5lcnNbMl0ueDtcbiAgICAgICAgICAgIGNvbnN0IHJpZ2h0ID0gaGl0Q29ybmVyc1swXS54O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1swXS54ID0gbGVmdDtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMV0ueCA9IHJpZ2h0O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1syXS54ID0gcmlnaHQ7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzNdLnggPSBsZWZ0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChzY2FsZS55IDwgMCkge1xuICAgICAgICAgICAgY29uc3QgYm90dG9tID0gaGl0Q29ybmVyc1syXS55O1xuICAgICAgICAgICAgY29uc3QgdG9wID0gaGl0Q29ybmVyc1swXS55O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1swXS55ID0gYm90dG9tO1xuICAgICAgICAgICAgaGl0Q29ybmVyc1sxXS55ID0gYm90dG9tO1xuICAgICAgICAgICAgaGl0Q29ybmVyc1syXS55ID0gdG9wO1xuICAgICAgICAgICAgaGl0Q29ybmVyc1szXS55ID0gdG9wO1xuICAgICAgICB9XG4gICAgICAgIC8vIGlmIHogaXMgaW52ZXJ0ZWQsIGVudGlyZSBlbGVtZW50IGlzIGludmVydGVkLCBzbyBmbGlwIGl0IGFyb3VuZCBieSBzd2FwcGluZyBjb3JuZXIgcG9pbnRzIDIgYW5kIDBcbiAgICAgICAgaWYgKHNjYWxlLnogPCAwKSB7XG4gICAgICAgICAgICBjb25zdCB4ID0gaGl0Q29ybmVyc1syXS54O1xuICAgICAgICAgICAgY29uc3QgeSA9IGhpdENvcm5lcnNbMl0ueTtcbiAgICAgICAgICAgIGNvbnN0IHogPSBoaXRDb3JuZXJzWzJdLno7XG5cbiAgICAgICAgICAgIGhpdENvcm5lcnNbMl0ueCA9IGhpdENvcm5lcnNbMF0ueDtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMl0ueSA9IGhpdENvcm5lcnNbMF0ueTtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMl0ueiA9IGhpdENvcm5lcnNbMF0uejtcbiAgICAgICAgICAgIGhpdENvcm5lcnNbMF0ueCA9IHg7XG4gICAgICAgICAgICBoaXRDb3JuZXJzWzBdLnkgPSB5O1xuICAgICAgICAgICAgaGl0Q29ybmVyc1swXS56ID0gejtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBoaXRDb3JuZXJzO1xuICAgIH1cblxuICAgIC8vIE5PVEU6IFVzZWQgYnkgRWRpdG9yIGZvciB2aXN1YWxpemF0aW9uIGluIHRoZSB2aWV3cG9ydFxuICAgIHN0YXRpYyBjYWxjdWxhdGVTY2FsZVRvU2NyZWVuKGVsZW1lbnQpIHtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBlbGVtZW50LmVudGl0eTtcbiAgICAgICAgY29uc3Qgc2NyZWVuU2NhbGUgPSBlbGVtZW50LnNjcmVlbi5zY3JlZW4uc2NhbGU7XG5cbiAgICAgICAgX2FjY3VtdWxhdGVkU2NhbGUuc2V0KHNjcmVlblNjYWxlLCBzY3JlZW5TY2FsZSwgc2NyZWVuU2NhbGUpO1xuXG4gICAgICAgIHdoaWxlIChjdXJyZW50ICYmICFjdXJyZW50LnNjcmVlbikge1xuICAgICAgICAgICAgX2FjY3VtdWxhdGVkU2NhbGUubXVsKGN1cnJlbnQuZ2V0TG9jYWxTY2FsZSgpKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfYWNjdW11bGF0ZWRTY2FsZTtcbiAgICB9XG5cbiAgICAvLyBOT1RFOiBVc2VkIGJ5IEVkaXRvciBmb3IgdmlzdWFsaXphdGlvbiBpbiB0aGUgdmlld3BvcnRcbiAgICBzdGF0aWMgY2FsY3VsYXRlU2NhbGVUb1dvcmxkKGVsZW1lbnQpIHtcbiAgICAgICAgbGV0IGN1cnJlbnQgPSBlbGVtZW50LmVudGl0eTtcbiAgICAgICAgX2FjY3VtdWxhdGVkU2NhbGUuc2V0KDEsIDEsIDEpO1xuXG4gICAgICAgIHdoaWxlIChjdXJyZW50KSB7XG4gICAgICAgICAgICBfYWNjdW11bGF0ZWRTY2FsZS5tdWwoY3VycmVudC5nZXRMb2NhbFNjYWxlKCkpO1xuICAgICAgICAgICAgY3VycmVudCA9IGN1cnJlbnQucGFyZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9hY2N1bXVsYXRlZFNjYWxlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgRWxlbWVudElucHV0LCBFbGVtZW50SW5wdXRFdmVudCwgRWxlbWVudE1vdXNlRXZlbnQsIEVsZW1lbnRTZWxlY3RFdmVudCwgRWxlbWVudFRvdWNoRXZlbnQgfTtcbiJdLCJuYW1lcyI6WyJ0YXJnZXRYIiwidGFyZ2V0WSIsInZlY0EiLCJWZWMzIiwidmVjQiIsInJheUEiLCJSYXkiLCJyYXlCIiwicmF5QyIsImVuZCIsIl9wcSIsIl9wYSIsIl9wYiIsIl9wYyIsIl9wZCIsIl9tIiwiX2F1IiwiX2J2IiwiX2N3IiwiX2lyIiwiX3NjdCIsIl9hY2N1bXVsYXRlZFNjYWxlIiwiX3BhZGRpbmdUb3AiLCJfcGFkZGluZ0JvdHRvbSIsIl9wYWRkaW5nTGVmdCIsIl9wYWRkaW5nUmlnaHQiLCJfY29ybmVyQm90dG9tTGVmdCIsIl9jb3JuZXJCb3R0b21SaWdodCIsIl9jb3JuZXJUb3BSaWdodCIsIl9jb3JuZXJUb3BMZWZ0IiwiWkVST19WRUM0IiwiVmVjNCIsInNjYWxhclRyaXBsZSIsInAxIiwicDIiLCJwMyIsImNyb3NzIiwiZG90IiwiaW50ZXJzZWN0TGluZVF1YWQiLCJwIiwicSIsImNvcm5lcnMiLCJzdWIyIiwidiIsInUiLCJ3IiwiZGVub20iLCJjb3B5IiwibXVsU2NhbGFyIiwiYWRkIiwibGVuZ3RoU3EiLCJzdWIiLCJFbGVtZW50SW5wdXRFdmVudCIsImNvbnN0cnVjdG9yIiwiZXZlbnQiLCJlbGVtZW50IiwiY2FtZXJhIiwiX3N0b3BQcm9wYWdhdGlvbiIsInN0b3BQcm9wYWdhdGlvbiIsInN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbiIsIkVsZW1lbnRNb3VzZUV2ZW50IiwieCIsInkiLCJsYXN0WCIsImxhc3RZIiwiY3RybEtleSIsImFsdEtleSIsInNoaWZ0S2V5IiwibWV0YUtleSIsImJ1dHRvbiIsIk1vdXNlIiwiaXNQb2ludGVyTG9ja2VkIiwiZHgiLCJtb3ZlbWVudFgiLCJ3ZWJraXRNb3ZlbWVudFgiLCJtb3pNb3ZlbWVudFgiLCJkeSIsIm1vdmVtZW50WSIsIndlYmtpdE1vdmVtZW50WSIsIm1vek1vdmVtZW50WSIsIndoZWVsRGVsdGEiLCJ0eXBlIiwiZGVsdGFZIiwiRWxlbWVudFRvdWNoRXZlbnQiLCJ0b3VjaCIsInRvdWNoZXMiLCJjaGFuZ2VkVG91Y2hlcyIsIkVsZW1lbnRTZWxlY3RFdmVudCIsImlucHV0U291cmNlIiwiRWxlbWVudElucHV0IiwiZG9tRWxlbWVudCIsIm9wdGlvbnMiLCJfYXBwIiwiX2F0dGFjaGVkIiwiX3RhcmdldCIsIl9lbmFibGVkIiwiX2xhc3RYIiwiX2xhc3RZIiwiX3VwSGFuZGxlciIsIl9oYW5kbGVVcCIsImJpbmQiLCJfZG93bkhhbmRsZXIiLCJfaGFuZGxlRG93biIsIl9tb3ZlSGFuZGxlciIsIl9oYW5kbGVNb3ZlIiwiX3doZWVsSGFuZGxlciIsIl9oYW5kbGVXaGVlbCIsIl90b3VjaHN0YXJ0SGFuZGxlciIsIl9oYW5kbGVUb3VjaFN0YXJ0IiwiX3RvdWNoZW5kSGFuZGxlciIsIl9oYW5kbGVUb3VjaEVuZCIsIl90b3VjaGNhbmNlbEhhbmRsZXIiLCJfdG91Y2htb3ZlSGFuZGxlciIsIl9oYW5kbGVUb3VjaE1vdmUiLCJfc29ydEhhbmRsZXIiLCJfc29ydEVsZW1lbnRzIiwiX2VsZW1lbnRzIiwiX2hvdmVyZWRFbGVtZW50IiwiX3ByZXNzZWRFbGVtZW50IiwiX3RvdWNoZWRFbGVtZW50cyIsIl90b3VjaGVzRm9yV2hpY2hUb3VjaExlYXZlSGFzRmlyZWQiLCJfc2VsZWN0ZWRFbGVtZW50cyIsIl9zZWxlY3RlZFByZXNzZWRFbGVtZW50cyIsIl91c2VNb3VzZSIsInVzZU1vdXNlIiwiX3VzZVRvdWNoIiwidXNlVG91Y2giLCJfdXNlWHIiLCJ1c2VYciIsIl9zZWxlY3RFdmVudHNBdHRhY2hlZCIsInBsYXRmb3JtIiwiX2NsaWNrZWRFbnRpdGllcyIsImF0dGFjaCIsImVuYWJsZWQiLCJ2YWx1ZSIsImFwcCIsImdldEFwcGxpY2F0aW9uIiwiZGV0YWNoIiwib3B0cyIsInBhc3NpdmVFdmVudHMiLCJwYXNzaXZlIiwid2luZG93IiwiYWRkRXZlbnRMaXN0ZW5lciIsImF0dGFjaFNlbGVjdEV2ZW50cyIsInhyIiwic3VwcG9ydGVkIiwib24iLCJfb25YclN0YXJ0IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm9mZiIsIl9vblhyRW5kIiwiX29uWHJVcGRhdGUiLCJpbnB1dCIsIl9vblNlbGVjdFN0YXJ0IiwiX29uU2VsZWN0RW5kIiwiX29uWHJJbnB1dFJlbW92ZSIsImFkZEVsZW1lbnQiLCJpbmRleE9mIiwicHVzaCIsInJlbW92ZUVsZW1lbnQiLCJpZHgiLCJzcGxpY2UiLCJfY2FsY01vdXNlQ29vcmRzIiwiX29uRWxlbWVudE1vdXNlRXZlbnQiLCJfZGV0ZXJtaW5lVG91Y2hlZEVsZW1lbnRzIiwidG91Y2hlZEVsZW1lbnRzIiwiY2FtZXJhcyIsInN5c3RlbXMiLCJpIiwibGVuZ3RoIiwiZG9uZSIsImxlbiIsImoiLCJpZGVudGlmaWVyIiwiY29vcmRzIiwiX2NhbGNUb3VjaENvb3JkcyIsIl9nZXRUYXJnZXRFbGVtZW50QnlDb29yZHMiLCJuZXdUb3VjaGVkRWxlbWVudHMiLCJuZXdUb3VjaEluZm8iLCJvbGRUb3VjaEluZm8iLCJfZmlyZUV2ZW50IiwidG91Y2hJZCIsImtleSIsInRvdWNoSW5mbyIsImMiLCJob3ZlcmVkIiwiZW50aXR5IiwiZ2V0R3VpZCIsIkRhdGUiLCJub3ciLCJwcmV2ZW50RGVmYXVsdCIsImV2ZW50VHlwZSIsImxhc3RIb3ZlcmVkIiwiZ3VpZCIsImZpcmVDbGljayIsImxhc3RUb3VjaFVwIiwiZHQiLCJpbnB1dFNvdXJjZXMiLCJfb25FbGVtZW50U2VsZWN0RXZlbnQiLCJpZCIsIl9lbGVtZW50RW50aXR5IiwiaG92ZXJlZEJlZm9yZSIsImhvdmVyZWROb3ciLCJlbGVtZW50SW5wdXQiLCJzZXQiLCJnZXRPcmlnaW4iLCJnZXREaXJlY3Rpb24iLCJfZ2V0VGFyZ2V0RWxlbWVudEJ5UmF5IiwicHJlc3NlZCIsIm5hbWUiLCJldnQiLCJmaXJlIiwicGFyZW50IiwicmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsImxlZnQiLCJNYXRoIiwiZmxvb3IiLCJ0b3AiLCJjbGllbnRYIiwiY2xpZW50WSIsInRvdGFsT2Zmc2V0WCIsInRvdGFsT2Zmc2V0WSIsInRhcmdldCIsIkhUTUxFbGVtZW50IiwicGFyZW50Tm9kZSIsImN1cnJlbnRFbGVtZW50Iiwib2Zmc2V0TGVmdCIsInNjcm9sbExlZnQiLCJvZmZzZXRUb3AiLCJzY3JvbGxUb3AiLCJvZmZzZXRQYXJlbnQiLCJwYWdlWCIsInBhZ2VZIiwiYSIsImIiLCJsYXllck9yZGVyIiwic2NlbmUiLCJsYXllcnMiLCJzb3J0VHJhbnNwYXJlbnRMYXllcnMiLCJzY3JlZW4iLCJzY3JlZW5TcGFjZSIsImRyYXdPcmRlciIsInJheVNjcmVlbiIsIl9jYWxjdWxhdGVSYXlTY3JlZW4iLCJyYXkzZCIsIl9jYWxjdWxhdGVSYXkzZCIsIl9nZXRUYXJnZXRFbGVtZW50IiwicmF5Iiwib3JpZ2luIiwiZGlyZWN0aW9uIiwiZmFyQ2xpcCIsInNjcmVlblBvcyIsIndvcmxkVG9TY3JlZW4iLCJyZXN1bHQiLCJjbG9zZXN0RGlzdGFuY2UzZCIsIkluZmluaXR5Iiwic29ydCIsInNvbWUiLCJsYXllcnNTZXQiLCJoYXMiLCJjdXJyZW50RGlzdGFuY2UiLCJfY2hlY2tFbGVtZW50Iiwic3ciLCJncmFwaGljc0RldmljZSIsIndpZHRoIiwic2giLCJoZWlnaHQiLCJjYW1lcmFXaWR0aCIsInoiLCJjYW1lcmFIZWlnaHQiLCJjYW1lcmFMZWZ0IiwiY2FtZXJhUmlnaHQiLCJjYW1lcmFCb3R0b20iLCJjYW1lcmFUb3AiLCJfeCIsImNsaWVudFdpZHRoIiwiX3kiLCJjbGllbnRIZWlnaHQiLCJzY3JlZW5Ub1dvcmxkIiwibmVhckNsaXAiLCJtYXNrZWRCeSIsInNjYWxlIiwiY2FsY3VsYXRlU2NhbGVUb1NjcmVlbiIsImNhbGN1bGF0ZVNjYWxlVG9Xb3JsZCIsImJ1aWxkSGl0Q29ybmVycyIsInNjcmVlbkNvcm5lcnMiLCJ3b3JsZENvcm5lcnMiLCJzY3JlZW5PcldvcmxkQ29ybmVycyIsImhpdENvcm5lcnMiLCJoaXRQYWRkaW5nIiwidXAiLCJyaWdodCIsImJvdHRvbSIsImN1cnJlbnQiLCJzY3JlZW5TY2FsZSIsIm11bCIsImdldExvY2FsU2NhbGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFTQSxJQUFJQSxPQUFPLEVBQUVDLE9BQU8sQ0FBQTtBQUNwQixNQUFNQyxJQUFJLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDdkIsTUFBTUMsSUFBSSxHQUFHLElBQUlELElBQUksRUFBRSxDQUFBO0FBRXZCLE1BQU1FLElBQUksR0FBRyxJQUFJQyxHQUFHLEVBQUUsQ0FBQTtBQUN0QixNQUFNQyxJQUFJLEdBQUcsSUFBSUQsR0FBRyxFQUFFLENBQUE7QUFDdEIsTUFBTUUsSUFBSSxHQUFHLElBQUlGLEdBQUcsRUFBRSxDQUFBO0FBRXRCRCxJQUFJLENBQUNJLEdBQUcsR0FBRyxJQUFJTixJQUFJLEVBQUUsQ0FBQTtBQUNyQkksSUFBSSxDQUFDRSxHQUFHLEdBQUcsSUFBSU4sSUFBSSxFQUFFLENBQUE7QUFDckJLLElBQUksQ0FBQ0MsR0FBRyxHQUFHLElBQUlOLElBQUksRUFBRSxDQUFBO0FBRXJCLE1BQU1PLEdBQUcsR0FBRyxJQUFJUCxJQUFJLEVBQUUsQ0FBQTtBQUN0QixNQUFNUSxHQUFHLEdBQUcsSUFBSVIsSUFBSSxFQUFFLENBQUE7QUFDdEIsTUFBTVMsR0FBRyxHQUFHLElBQUlULElBQUksRUFBRSxDQUFBO0FBQ3RCLE1BQU1VLEdBQUcsR0FBRyxJQUFJ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
