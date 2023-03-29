/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * This function takes a browser Touch object and returns the coordinates of the touch relative to
 * the target element.
 *
 * @param {globalThis.Touch} touch - The browser Touch object.
 * @returns {object} The coordinates of the touch relative to the touch.target element. In the
 * format \{x, y\}.
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
 */
class Touch {
  /**
   * Create a new Touch object from the browser Touch.
   *
   * @param {globalThis.Touch} touch - The browser Touch object.
   */
  constructor(touch) {
    const coords = getTouchTargetCoords(touch);

    /**
     * The identifier of the touch.
     *
     * @type {number}
     */
    this.id = touch.identifier;

    /**
     * The x coordinate relative to the element that the TouchDevice is attached to.
     *
     * @type {number}
     */
    this.x = coords.x;
    /**
     * The y coordinate relative to the element that the TouchDevice is attached to.
     *
     * @type {number}
     */
    this.y = coords.y;

    /**
     * The target element of the touch event.
     *
     * @type {Element}
     */
    this.target = touch.target;

    /**
     * The original browser Touch object.
     *
     * @type {globalThis.Touch}
     */
    this.touch = touch;
  }
}

/**
 * A Event corresponding to touchstart, touchend, touchmove or touchcancel. TouchEvent wraps the
 * standard browser event and provides lists of {@link Touch} objects.
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
     * The target Element that the event was fired from.
     *
     * @type {Element}
     */
    this.element = event.target;
    /**
     * The original browser TouchEvent.
     *
     * @type {globalThis.TouchEvent}
     */
    this.event = event;

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
    if (event) {
      for (let i = 0, l = event.touches.length; i < l; i++) {
        this.touches.push(new Touch(event.touches[i]));
      }
      for (let i = 0, l = event.changedTouches.length; i < l; i++) {
        this.changedTouches.push(new Touch(event.changedTouches[i]));
      }
    }
  }

  /**
   * Get an event from one of the touch lists by the id. It is useful to access
   * touches by their id so that you can be sure you are referencing the same
   * touch.
   *
   * @param {number} id - The identifier of the touch.
   * @param {Touch[]|null} list - An array of touches to search.
   * @returns {Touch} The {@link Touch} object or null.
   */
  getTouchById(id, list) {
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].id === id) {
        return list[i];
      }
    }
    return null;
  }
}

export { Touch, TouchEvent, getTouchTargetCoords };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG91Y2gtZXZlbnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9pbnB1dC90b3VjaC1ldmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoaXMgZnVuY3Rpb24gdGFrZXMgYSBicm93c2VyIFRvdWNoIG9iamVjdCBhbmQgcmV0dXJucyB0aGUgY29vcmRpbmF0ZXMgb2YgdGhlIHRvdWNoIHJlbGF0aXZlIHRvXG4gKiB0aGUgdGFyZ2V0IGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtnbG9iYWxUaGlzLlRvdWNofSB0b3VjaCAtIFRoZSBicm93c2VyIFRvdWNoIG9iamVjdC5cbiAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSBjb29yZGluYXRlcyBvZiB0aGUgdG91Y2ggcmVsYXRpdmUgdG8gdGhlIHRvdWNoLnRhcmdldCBlbGVtZW50LiBJbiB0aGVcbiAqIGZvcm1hdCBcXHt4LCB5XFx9LlxuICovXG5mdW5jdGlvbiBnZXRUb3VjaFRhcmdldENvb3Jkcyh0b3VjaCkge1xuICAgIGxldCB0b3RhbE9mZnNldFggPSAwO1xuICAgIGxldCB0b3RhbE9mZnNldFkgPSAwO1xuICAgIGxldCB0YXJnZXQgPSB0b3VjaC50YXJnZXQ7XG4gICAgd2hpbGUgKCEodGFyZ2V0IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XG4gICAgICAgIHRhcmdldCA9IHRhcmdldC5wYXJlbnROb2RlO1xuICAgIH1cbiAgICBsZXQgY3VycmVudEVsZW1lbnQgPSB0YXJnZXQ7XG5cbiAgICBkbyB7XG4gICAgICAgIHRvdGFsT2Zmc2V0WCArPSBjdXJyZW50RWxlbWVudC5vZmZzZXRMZWZ0IC0gY3VycmVudEVsZW1lbnQuc2Nyb2xsTGVmdDtcbiAgICAgICAgdG90YWxPZmZzZXRZICs9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFRvcCAtIGN1cnJlbnRFbGVtZW50LnNjcm9sbFRvcDtcbiAgICAgICAgY3VycmVudEVsZW1lbnQgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRQYXJlbnQ7XG4gICAgfSB3aGlsZSAoY3VycmVudEVsZW1lbnQpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgeDogdG91Y2gucGFnZVggLSB0b3RhbE9mZnNldFgsXG4gICAgICAgIHk6IHRvdWNoLnBhZ2VZIC0gdG90YWxPZmZzZXRZXG4gICAgfTtcbn1cblxuLyoqXG4gKiBBIGluc3RhbmNlIG9mIGEgc2luZ2xlIHBvaW50IHRvdWNoIG9uIGEge0BsaW5rIFRvdWNoRGV2aWNlfS5cbiAqL1xuY2xhc3MgVG91Y2gge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBUb3VjaCBvYmplY3QgZnJvbSB0aGUgYnJvd3NlciBUb3VjaC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Z2xvYmFsVGhpcy5Ub3VjaH0gdG91Y2ggLSBUaGUgYnJvd3NlciBUb3VjaCBvYmplY3QuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IodG91Y2gpIHtcbiAgICAgICAgY29uc3QgY29vcmRzID0gZ2V0VG91Y2hUYXJnZXRDb29yZHModG91Y2gpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgaWRlbnRpZmllciBvZiB0aGUgdG91Y2guXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmlkID0gdG91Y2guaWRlbnRpZmllcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHggY29vcmRpbmF0ZSByZWxhdGl2ZSB0byB0aGUgZWxlbWVudCB0aGF0IHRoZSBUb3VjaERldmljZSBpcyBhdHRhY2hlZCB0by5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMueCA9IGNvb3Jkcy54O1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHkgY29vcmRpbmF0ZSByZWxhdGl2ZSB0byB0aGUgZWxlbWVudCB0aGF0IHRoZSBUb3VjaERldmljZSBpcyBhdHRhY2hlZCB0by5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMueSA9IGNvb3Jkcy55O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdGFyZ2V0IGVsZW1lbnQgb2YgdGhlIHRvdWNoIGV2ZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudGFyZ2V0ID0gdG91Y2gudGFyZ2V0O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgb3JpZ2luYWwgYnJvd3NlciBUb3VjaCBvYmplY3QuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtnbG9iYWxUaGlzLlRvdWNofVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50b3VjaCA9IHRvdWNoO1xuICAgIH1cbn1cblxuLyoqXG4gKiBBIEV2ZW50IGNvcnJlc3BvbmRpbmcgdG8gdG91Y2hzdGFydCwgdG91Y2hlbmQsIHRvdWNobW92ZSBvciB0b3VjaGNhbmNlbC4gVG91Y2hFdmVudCB3cmFwcyB0aGVcbiAqIHN0YW5kYXJkIGJyb3dzZXIgZXZlbnQgYW5kIHByb3ZpZGVzIGxpc3RzIG9mIHtAbGluayBUb3VjaH0gb2JqZWN0cy5cbiAqL1xuY2xhc3MgVG91Y2hFdmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFRvdWNoRXZlbnQgaW5zdGFuY2UuIEl0IGlzIGNyZWF0ZWQgZnJvbSBhbiBleGlzdGluZyBicm93c2VyIGV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vdG91Y2gtZGV2aWNlLmpzJykuVG91Y2hEZXZpY2V9IGRldmljZSAtIFRoZSBzb3VyY2UgZGV2aWNlIG9mIHRoZSB0b3VjaFxuICAgICAqIGV2ZW50cy5cbiAgICAgKiBAcGFyYW0ge2dsb2JhbFRoaXMuVG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgb3JpZ2luYWwgYnJvd3NlciBUb3VjaEV2ZW50LlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgZXZlbnQpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0YXJnZXQgRWxlbWVudCB0aGF0IHRoZSBldmVudCB3YXMgZmlyZWQgZnJvbS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VsZW1lbnR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVsZW1lbnQgPSBldmVudC50YXJnZXQ7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgb3JpZ2luYWwgYnJvd3NlciBUb3VjaEV2ZW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Z2xvYmFsVGhpcy5Ub3VjaEV2ZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ldmVudCA9IGV2ZW50O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIGxpc3Qgb2YgYWxsIHRvdWNoZXMgY3VycmVudGx5IGluIGNvbnRhY3Qgd2l0aCB0aGUgZGV2aWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VG91Y2hbXX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudG91Y2hlcyA9IFtdO1xuICAgICAgICAvKipcbiAgICAgICAgICogQSBsaXN0IG9mIHRvdWNoZXMgdGhhdCBoYXZlIGNoYW5nZWQgc2luY2UgdGhlIGxhc3QgZXZlbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUb3VjaFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jaGFuZ2VkVG91Y2hlcyA9IFtdO1xuXG4gICAgICAgIGlmIChldmVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBldmVudC50b3VjaGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMudG91Y2hlcy5wdXNoKG5ldyBUb3VjaChldmVudC50b3VjaGVzW2ldKSk7XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBldmVudC5jaGFuZ2VkVG91Y2hlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLmNoYW5nZWRUb3VjaGVzLnB1c2gobmV3IFRvdWNoKGV2ZW50LmNoYW5nZWRUb3VjaGVzW2ldKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgYW4gZXZlbnQgZnJvbSBvbmUgb2YgdGhlIHRvdWNoIGxpc3RzIGJ5IHRoZSBpZC4gSXQgaXMgdXNlZnVsIHRvIGFjY2Vzc1xuICAgICAqIHRvdWNoZXMgYnkgdGhlaXIgaWQgc28gdGhhdCB5b3UgY2FuIGJlIHN1cmUgeW91IGFyZSByZWZlcmVuY2luZyB0aGUgc2FtZVxuICAgICAqIHRvdWNoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlkIC0gVGhlIGlkZW50aWZpZXIgb2YgdGhlIHRvdWNoLlxuICAgICAqIEBwYXJhbSB7VG91Y2hbXXxudWxsfSBsaXN0IC0gQW4gYXJyYXkgb2YgdG91Y2hlcyB0byBzZWFyY2guXG4gICAgICogQHJldHVybnMge1RvdWNofSBUaGUge0BsaW5rIFRvdWNofSBvYmplY3Qgb3IgbnVsbC5cbiAgICAgKi9cbiAgICBnZXRUb3VjaEJ5SWQoaWQsIGxpc3QpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBsaXN0Lmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaWYgKGxpc3RbaV0uaWQgPT09IGlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGxpc3RbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IGdldFRvdWNoVGFyZ2V0Q29vcmRzLCBUb3VjaCwgVG91Y2hFdmVudCB9O1xuIl0sIm5hbWVzIjpbImdldFRvdWNoVGFyZ2V0Q29vcmRzIiwidG91Y2giLCJ0b3RhbE9mZnNldFgiLCJ0b3RhbE9mZnNldFkiLCJ0YXJnZXQiLCJIVE1MRWxlbWVudCIsInBhcmVudE5vZGUiLCJjdXJyZW50RWxlbWVudCIsIm9mZnNldExlZnQiLCJzY3JvbGxMZWZ0Iiwib2Zmc2V0VG9wIiwic2Nyb2xsVG9wIiwib2Zmc2V0UGFyZW50IiwieCIsInBhZ2VYIiwieSIsInBhZ2VZIiwiVG91Y2giLCJjb25zdHJ1Y3RvciIsImNvb3JkcyIsImlkIiwiaWRlbnRpZmllciIsIlRvdWNoRXZlbnQiLCJkZXZpY2UiLCJldmVudCIsImVsZW1lbnQiLCJ0b3VjaGVzIiwiY2hhbmdlZFRvdWNoZXMiLCJpIiwibCIsImxlbmd0aCIsInB1c2giLCJnZXRUb3VjaEJ5SWQiLCJsaXN0Il0sIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQSxvQkFBb0IsQ0FBQ0MsS0FBSyxFQUFFO0VBQ2pDLElBQUlDLFlBQVksR0FBRyxDQUFDLENBQUE7RUFDcEIsSUFBSUMsWUFBWSxHQUFHLENBQUMsQ0FBQTtBQUNwQixFQUFBLElBQUlDLE1BQU0sR0FBR0gsS0FBSyxDQUFDRyxNQUFNLENBQUE7QUFDekIsRUFBQSxPQUFPLEVBQUVBLE1BQU0sWUFBWUMsV0FBVyxDQUFDLEVBQUU7SUFDckNELE1BQU0sR0FBR0EsTUFBTSxDQUFDRSxVQUFVLENBQUE7QUFDOUIsR0FBQTtFQUNBLElBQUlDLGNBQWMsR0FBR0gsTUFBTSxDQUFBO0VBRTNCLEdBQUc7QUFDQ0YsSUFBQUEsWUFBWSxJQUFJSyxjQUFjLENBQUNDLFVBQVUsR0FBR0QsY0FBYyxDQUFDRSxVQUFVLENBQUE7QUFDckVOLElBQUFBLFlBQVksSUFBSUksY0FBYyxDQUFDRyxTQUFTLEdBQUdILGNBQWMsQ0FBQ0ksU0FBUyxDQUFBO0lBQ25FSixjQUFjLEdBQUdBLGNBQWMsQ0FBQ0ssWUFBWSxDQUFBO0FBQ2hELEdBQUMsUUFBUUwsY0FBYyxFQUFBO0VBRXZCLE9BQU87QUFDSE0sSUFBQUEsQ0FBQyxFQUFFWixLQUFLLENB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
