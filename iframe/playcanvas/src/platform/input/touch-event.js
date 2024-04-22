function getTouchTargetCoords(touch) {
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
class Touch {
  constructor(touch) {
    this.id = void 0;
    this.x = void 0;
    this.y = void 0;
    this.target = void 0;
    this.touch = void 0;
    const coords = getTouchTargetCoords(touch);
    this.id = touch.identifier;
    this.x = coords.x;
    this.y = coords.y;
    this.target = touch.target;
    this.touch = touch;
  }
}
class TouchEvent {
  constructor(device, event) {
    this.element = void 0;
    this.event = void 0;
    this.touches = [];
    this.changedTouches = [];
    this.element = event.target;
    this.event = event;
    this.touches = Array.from(event.touches).map(touch => new Touch(touch));
    this.changedTouches = Array.from(event.changedTouches).map(touch => new Touch(touch));
  }
  getTouchById(id, list) {
    return list.find(touch => touch.id === id) || null;
  }
}

export { Touch, TouchEvent, getTouchTargetCoords };
