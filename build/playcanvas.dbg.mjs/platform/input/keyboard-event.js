/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * The KeyboardEvent is passed into all event callbacks from the {@link Keyboard}. It corresponds
 * to a key press or release.
 */
class KeyboardEvent {
  /**
   * Create a new KeyboardEvent.
   *
   * @param {import('./keyboard.js').Keyboard} keyboard - The keyboard object which is firing the
   * event.
   * @param {globalThis.KeyboardEvent} event - The original browser event that was fired.
   * @example
   * var onKeyDown = function (e) {
   *     if (e.key === pc.KEY_SPACE) {
   *         // space key pressed
   *     }
   *     e.event.preventDefault(); // Use original browser event to prevent browser action.
   * };
   * app.keyboard.on("keydown", onKeyDown, this);
   */
  constructor(keyboard, event) {
    if (event) {
      /**
       * The keyCode of the key that has changed. See the KEY_* constants.
       *
       * @type {number}
       */
      this.key = event.keyCode;
      /**
       * The element that fired the keyboard event.
       *
       * @type {Element}
       */
      this.element = event.target;
      /**
       * The original browser event which was fired.
       *
       * @type {globalThis.KeyboardEvent}
       */
      this.event = event;
    } else {
      this.key = null;
      this.element = null;
      this.event = null;
    }
  }
}

export { KeyboardEvent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5Ym9hcmQtZXZlbnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9pbnB1dC9rZXlib2FyZC1ldmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBLZXlib2FyZEV2ZW50IGlzIHBhc3NlZCBpbnRvIGFsbCBldmVudCBjYWxsYmFja3MgZnJvbSB0aGUge0BsaW5rIEtleWJvYXJkfS4gSXQgY29ycmVzcG9uZHNcbiAqIHRvIGEga2V5IHByZXNzIG9yIHJlbGVhc2UuXG4gKi9cbmNsYXNzIEtleWJvYXJkRXZlbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBLZXlib2FyZEV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4va2V5Ym9hcmQuanMnKS5LZXlib2FyZH0ga2V5Ym9hcmQgLSBUaGUga2V5Ym9hcmQgb2JqZWN0IHdoaWNoIGlzIGZpcmluZyB0aGVcbiAgICAgKiBldmVudC5cbiAgICAgKiBAcGFyYW0ge2dsb2JhbFRoaXMuS2V5Ym9hcmRFdmVudH0gZXZlbnQgLSBUaGUgb3JpZ2luYWwgYnJvd3NlciBldmVudCB0aGF0IHdhcyBmaXJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBvbktleURvd24gPSBmdW5jdGlvbiAoZSkge1xuICAgICAqICAgICBpZiAoZS5rZXkgPT09IHBjLktFWV9TUEFDRSkge1xuICAgICAqICAgICAgICAgLy8gc3BhY2Uga2V5IHByZXNzZWRcbiAgICAgKiAgICAgfVxuICAgICAqICAgICBlLmV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFVzZSBvcmlnaW5hbCBicm93c2VyIGV2ZW50IHRvIHByZXZlbnQgYnJvd3NlciBhY3Rpb24uXG4gICAgICogfTtcbiAgICAgKiBhcHAua2V5Ym9hcmQub24oXCJrZXlkb3duXCIsIG9uS2V5RG93biwgdGhpcyk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioa2V5Ym9hcmQsIGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudCkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUga2V5Q29kZSBvZiB0aGUga2V5IHRoYXQgaGFzIGNoYW5nZWQuIFNlZSB0aGUgS0VZXyogY29uc3RhbnRzLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMua2V5ID0gZXZlbnQua2V5Q29kZTtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIGVsZW1lbnQgdGhhdCBmaXJlZCB0aGUga2V5Ym9hcmQgZXZlbnQuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge0VsZW1lbnR9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuZWxlbWVudCA9IGV2ZW50LnRhcmdldDtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogVGhlIG9yaWdpbmFsIGJyb3dzZXIgZXZlbnQgd2hpY2ggd2FzIGZpcmVkLlxuICAgICAgICAgICAgICpcbiAgICAgICAgICAgICAqIEB0eXBlIHtnbG9iYWxUaGlzLktleWJvYXJkRXZlbnR9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHRoaXMuZXZlbnQgPSBldmVudDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMua2V5ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmV2ZW50ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgS2V5Ym9hcmRFdmVudCB9O1xuIl0sIm5hbWVzIjpbIktleWJvYXJkRXZlbnQiLCJjb25zdHJ1Y3RvciIsImtleWJvYXJkIiwiZXZlbnQiLCJrZXkiLCJrZXlDb2RlIiwiZWxlbWVudCIsInRhcmdldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGFBQWEsQ0FBQztBQUNoQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBVyxDQUFDQyxRQUFRLEVBQUVDLEtBQUssRUFBRTtBQUN6QixJQUFBLElBQUlBLEtBQUssRUFBRTtBQUNQO0FBQ1o7QUFDQTtBQUNBO0FBQ0E7QUFDWSxNQUFBLElBQUksQ0FBQ0MsR0FBRyxHQUFHRCxLQUFLLENBQUNFLE9BQU8sQ0FBQTtBQUN4QjtBQUNaO0FBQ0E7QUFDQTtBQUNBO0FBQ1ksTUFBQSxJQUFJLENBQUNDLE9BQU8sR0FBR0gsS0FBSyxDQUFDSSxNQUFNLENBQUE7QUFDM0I7QUFDWjtBQUNBO0FBQ0E7QUFDQTtNQUNZLElBQUksQ0FBQ0osS0FBSyxHQUFHQSxLQUFLLENBQUE7QUFDdEIsS0FBQyxNQUFNO01BQ0gsSUFBSSxDQUFDQyxHQUFHLEdBQUcsSUFBSSxDQUFBO01BQ2YsSUFBSSxDQUFDRSxPQUFPLEdBQUcsSUFBSSxDQUFBO01BQ25CLElBQUksQ0FBQ0gsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUNyQixLQUFBO0FBQ0osR0FBQTtBQUNKOzs7OyJ9
