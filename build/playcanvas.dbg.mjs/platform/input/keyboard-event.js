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
   * const onKeyDown = function (e) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5Ym9hcmQtZXZlbnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9pbnB1dC9rZXlib2FyZC1ldmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFRoZSBLZXlib2FyZEV2ZW50IGlzIHBhc3NlZCBpbnRvIGFsbCBldmVudCBjYWxsYmFja3MgZnJvbSB0aGUge0BsaW5rIEtleWJvYXJkfS4gSXQgY29ycmVzcG9uZHNcbiAqIHRvIGEga2V5IHByZXNzIG9yIHJlbGVhc2UuXG4gKi9cbmNsYXNzIEtleWJvYXJkRXZlbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBLZXlib2FyZEV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4va2V5Ym9hcmQuanMnKS5LZXlib2FyZH0ga2V5Ym9hcmQgLSBUaGUga2V5Ym9hcmQgb2JqZWN0IHdoaWNoIGlzIGZpcmluZyB0aGVcbiAgICAgKiBldmVudC5cbiAgICAgKiBAcGFyYW0ge2dsb2JhbFRoaXMuS2V5Ym9hcmRFdmVudH0gZXZlbnQgLSBUaGUgb3JpZ2luYWwgYnJvd3NlciBldmVudCB0aGF0IHdhcyBmaXJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IG9uS2V5RG93biA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICogICAgIGlmIChlLmtleSA9PT0gcGMuS0VZX1NQQUNFKSB7XG4gICAgICogICAgICAgICAvLyBzcGFjZSBrZXkgcHJlc3NlZFxuICAgICAqICAgICB9XG4gICAgICogICAgIGUuZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gVXNlIG9yaWdpbmFsIGJyb3dzZXIgZXZlbnQgdG8gcHJldmVudCBicm93c2VyIGFjdGlvbi5cbiAgICAgKiB9O1xuICAgICAqIGFwcC5rZXlib2FyZC5vbihcImtleWRvd25cIiwgb25LZXlEb3duLCB0aGlzKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihrZXlib2FyZCwgZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50KSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIFRoZSBrZXlDb2RlIG9mIHRoZSBrZXkgdGhhdCBoYXMgY2hhbmdlZC4gU2VlIHRoZSBLRVlfKiBjb25zdGFudHMuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5rZXkgPSBldmVudC5rZXlDb2RlO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgZWxlbWVudCB0aGF0IGZpcmVkIHRoZSBrZXlib2FyZCBldmVudC5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50ID0gZXZlbnQudGFyZ2V0O1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBUaGUgb3JpZ2luYWwgYnJvd3NlciBldmVudCB3aGljaCB3YXMgZmlyZWQuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHR5cGUge2dsb2JhbFRoaXMuS2V5Ym9hcmRFdmVudH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5ldmVudCA9IGV2ZW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5rZXkgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZXZlbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBLZXlib2FyZEV2ZW50IH07XG4iXSwibmFtZXMiOlsiS2V5Ym9hcmRFdmVudCIsImNvbnN0cnVjdG9yIiwia2V5Ym9hcmQiLCJldmVudCIsImtleSIsImtleUNvZGUiLCJlbGVtZW50IiwidGFyZ2V0Il0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGFBQWEsQ0FBQztBQUNoQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsUUFBUSxFQUFFQyxLQUFLLEVBQUU7QUFDekIsSUFBQSxJQUFJQSxLQUFLLEVBQUU7QUFDUDtBQUNaO0FBQ0E7QUFDQTtBQUNBO0FBQ1ksTUFBQSxJQUFJLENBQUNDLEdBQUcsR0FBR0QsS0FBSyxDQUFDRSxPQUFPLENBQUE7QUFDeEI7QUFDWjtBQUNBO0FBQ0E7QUFDQTtBQUNZLE1BQUEsSUFBSSxDQUFDQyxPQUFPLEdBQUdILEtBQUssQ0FBQ0ksTUFBTSxDQUFBO0FBQzNCO0FBQ1o7QUFDQTtBQUNBO0FBQ0E7TUFDWSxJQUFJLENBQUNKLEtBQUssR0FBR0EsS0FBSyxDQUFBO0FBQ3RCLEtBQUMsTUFBTTtNQUNILElBQUksQ0FBQ0MsR0FBRyxHQUFHLElBQUksQ0FBQTtNQUNmLElBQUksQ0FBQ0UsT0FBTyxHQUFHLElBQUksQ0FBQTtNQUNuQixJQUFJLENBQUNILEtBQUssR0FBRyxJQUFJLENBQUE7QUFDckIsS0FBQTtBQUNKLEdBQUE7QUFDSjs7OzsifQ==
