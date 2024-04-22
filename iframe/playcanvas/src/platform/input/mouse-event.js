import { MOUSEBUTTON_NONE } from './constants.js';

function isMousePointerLocked() {
  return !!(document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement);
}
class MouseEvent {
  constructor(mouse, event) {
    var _event$ctrlKey, _event$altKey, _event$shiftKey, _event$metaKey;
    this.x = 0;
    this.y = 0;
    this.dx = 0;
    this.dy = 0;
    this.button = MOUSEBUTTON_NONE;
    this.wheelDelta = 0;
    this.element = void 0;
    this.ctrlKey = false;
    this.altKey = false;
    this.shiftKey = false;
    this.metaKey = false;
    this.event = void 0;
    let coords = {
      x: 0,
      y: 0
    };
    if (event) {
      if (event instanceof MouseEvent) {
        throw Error('Expected MouseEvent');
      }
      coords = mouse._getTargetCoords(event);
    } else {
      event = {};
    }
    if (coords) {
      this.x = coords.x;
      this.y = coords.y;
    } else if (isMousePointerLocked()) {
      this.x = 0;
      this.y = 0;
    } else {
      return;
    }
    if (event.type === 'wheel') {
      if (event.deltaY > 0) {
        this.wheelDelta = 1;
      } else if (event.deltaY < 0) {
        this.wheelDelta = -1;
      }
    }
    if (isMousePointerLocked()) {
      this.dx = event.movementX || event.webkitMovementX || event.mozMovementX || 0;
      this.dy = event.movementY || event.webkitMovementY || event.mozMovementY || 0;
    } else {
      this.dx = this.x - mouse._lastX;
      this.dy = this.y - mouse._lastY;
    }
    if (event.type === 'mousedown' || event.type === 'mouseup') {
      this.button = event.button;
    }
    this.buttons = mouse._buttons.slice(0);
    this.element = event.target;
    this.ctrlKey = (_event$ctrlKey = event.ctrlKey) != null ? _event$ctrlKey : false;
    this.altKey = (_event$altKey = event.altKey) != null ? _event$altKey : false;
    this.shiftKey = (_event$shiftKey = event.shiftKey) != null ? _event$shiftKey : false;
    this.metaKey = (_event$metaKey = event.metaKey) != null ? _event$metaKey : false;
    this.event = event;
  }
}

export { MouseEvent, isMousePointerLocked };
