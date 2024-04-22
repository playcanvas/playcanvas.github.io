/**
 * This function takes a browser Touch object and returns the coordinates of the touch relative to
 * the target DOM element.
 *
 * @param {globalThis.Touch} touch - The browser Touch object.
 * @returns {object} The coordinates of the touch relative to the touch.target DOM element. In the
 * format \{x, y\}.
 * @category Input
 */
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

/**
 * A instance of a single point touch on a {@link TouchDevice}.
 *
 * @category Input
 */
class Touch {
  /**
   * Create a new Touch object from the browser Touch.
   *
   * @param {globalThis.Touch} touch - The browser Touch object.
   */
  constructor(touch) {
    /**
     * The identifier of the touch.
     *
     * @type {number}
     */
    this.id = void 0;
    /**
     * The x coordinate relative to the element that the TouchDevice is attached to.
     *
     * @type {number}
     */
    this.x = void 0;
    /**
     * The y coordinate relative to the element that the TouchDevice is attached to.
     *
     * @type {number}
     */
    this.y = void 0;
    /**
     * The target DOM element of the touch event.
     *
     * @type {Element}
     */
    this.target = void 0;
    /**
     * The original browser Touch object.
     *
     * @type {globalThis.Touch}
     */
    this.touch = void 0;
    const coords = getTouchTargetCoords(touch);
    this.id = touch.identifier;
    this.x = coords.x;
    this.y = coords.y;
    this.target = touch.target;
    this.touch = touch;
  }
}

/**
 * A Event corresponding to touchstart, touchend, touchmove or touchcancel. TouchEvent wraps the
 * standard browser DOM event and provides lists of {@link Touch} objects.
 *
 * @category Input
 */
class TouchEvent {
  /**
   * Create a new TouchEvent instance. It is created from an existing browser event.
   *
   * @param {import('./touch-device.js').TouchDevice} device - The source device of the touch
   * events.
   * @param {globalThis.TouchEvent} event - The original browser TouchEvent.
   */
  constructor(device, event) {
    /**
     * The target DOM element that the event was fired from.
     *
     * @type {Element}
     */
    this.element = void 0;
    /**
     * The original browser TouchEvent.
     *
     * @type {globalThis.TouchEvent}
     */
    this.event = void 0;
    /**
     * A list of all touches currently in contact with the device.
     *
     * @type {Touch[]}
     */
    this.touches = [];
    /**
     * A list of touches that have changed since the last event.
     *
     * @type {Touch[]}
     */
    this.changedTouches = [];
    this.element = event.target;
    this.event = event;
    this.touches = Array.from(event.touches).map(touch => new Touch(touch));
    this.changedTouches = Array.from(event.changedTouches).map(touch => new Touch(touch));
  }

  /**
   * Get an event from one of the touch lists by the id. It is useful to access touches by their
   * id so that you can be sure you are referencing the same touch.
   *
   * @param {number} id - The identifier of the touch.
   * @param {Touch[]} list - An array of touches to search.
   * @returns {Touch|null} The {@link Touch} object or null.
   */
  getTouchById(id, list) {
    return list.find(touch => touch.id === id) || null;
  }
}

export { Touch, TouchEvent, getTouchTargetCoords };
