import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { KeyboardEvent } from './keyboard-event.js';

// internal global keyboard events
const _keyboardEvent = new KeyboardEvent();

/**
 * Convert a browser keyboard event to a PlayCanvas keyboard event.
 *
 * @param {globalThis.KeyboardEvent} event - A browser keyboard event.
 * @returns {KeyboardEvent} A PlayCanvas keyboard event.
 * @ignore
 */
function makeKeyboardEvent(event) {
  _keyboardEvent.key = event.keyCode;
  _keyboardEvent.element = event.target;
  _keyboardEvent.event = event;
  return _keyboardEvent;
}

/**
 * Convert a string or keycode to a keycode.
 *
 * @param {string|number} s - Either a character code or the key character.
 * @returns {number} The character code.
 * @ignore
 */
function toKeyCode(s) {
  if (typeof s === 'string') {
    return s.toUpperCase().charCodeAt(0);
  }
  return s;
}
const _keyCodeToKeyIdentifier = {
  '9': 'Tab',
  '13': 'Enter',
  '16': 'Shift',
  '17': 'Control',
  '18': 'Alt',
  '27': 'Escape',
  '37': 'Left',
  '38': 'Up',
  '39': 'Right',
  '40': 'Down',
  '46': 'Delete',
  '91': 'Win'
};

/**
 * A Keyboard device bound to an Element. Allows you to detect the state of the key presses. Note
 * that the Keyboard object must be attached to an Element before it can detect any key presses.
 *
 * @augments EventHandler
 */
class Keyboard extends EventHandler {
  /**
   * Create a new Keyboard instance.
   *
   * @param {Element|Window} [element] - Element to attach Keyboard to. Note that elements like
   * &lt;div&gt; can't accept focus by default. To use keyboard events on an element like this it
   * must have a value of 'tabindex' e.g. tabindex="0". See
   * [here](http://www.w3.org/WAI/GL/WCAG20/WD-WCAG20-TECHS/SCR29.html) for more details.
   * @param {object} [options] - Optional options object.
   * @param {boolean} [options.preventDefault] - Call preventDefault() in key event handlers.
   * This stops the default action of the event occurring. e.g. Ctrl+T will not open a new
   * browser tab.
   * @param {boolean} [options.stopPropagation] - Call stopPropagation() in key event handlers.
   * This stops the event bubbling up the DOM so no parent handlers will be notified of the
   * event.
   * @example
   * // attach keyboard listeners to the window
   * const keyboard = new pc.Keyboard(window);
   */
  constructor(element, options = {}) {
    super();
    this._element = null;
    this._keyDownHandler = this._handleKeyDown.bind(this);
    this._keyUpHandler = this._handleKeyUp.bind(this);
    this._keyPressHandler = this._handleKeyPress.bind(this);
    this._visibilityChangeHandler = this._handleVisibilityChange.bind(this);
    this._windowBlurHandler = this._handleWindowBlur.bind(this);
    this._keymap = {};
    this._lastmap = {};
    if (element) {
      this.attach(element);
    }
    this.preventDefault = options.preventDefault || false;
    this.stopPropagation = options.stopPropagation || false;
  }

  /**
   * Fired when a key is pressed.
   *
   * @event Keyboard#keydown
   * @param {KeyboardEvent} event - The Keyboard event object. Note, this event is only valid for the current callback.
   * @example
   * const onKeyDown = function (e) {
   *     if (e.key === pc.KEY_SPACE) {
   *         // space key pressed
   *     }
   *     e.event.preventDefault(); // Use original browser event to prevent browser action.
   * };
   * app.keyboard.on("keydown", onKeyDown, this);
   */

  /**
   * Fired when a key is released.
   *
   * @event Keyboard#keyup
   * @param {KeyboardEvent} event - The Keyboard event object. Note, this event is only valid for the current callback.
   * @example
   * const onKeyUp = function (e) {
   *     if (e.key === pc.KEY_SPACE) {
   *         // space key released
   *     }
   *     e.event.preventDefault(); // Use original browser event to prevent browser action.
   * };
   * app.keyboard.on("keyup", onKeyUp, this);
   */

  /**
   * Attach the keyboard event handlers to an Element.
   *
   * @param {Element|Window} element - The element to listen for keyboard events on.
   */
  attach(element) {
    if (this._element) {
      // remove previous attached element
      this.detach();
    }
    this._element = element;
    this._element.addEventListener('keydown', this._keyDownHandler, false);
    this._element.addEventListener('keypress', this._keyPressHandler, false);
    this._element.addEventListener('keyup', this._keyUpHandler, false);
    document.addEventListener('visibilitychange', this._visibilityChangeHandler, false);
    window.addEventListener('blur', this._windowBlurHandler, false);
  }

  /**
   * Detach the keyboard event handlers from the element it is attached to.
   */
  detach() {
    if (!this._element) {
      Debug.warn('Unable to detach keyboard. It is not attached to an element.');
      return;
    }
    this._element.removeEventListener('keydown', this._keyDownHandler);
    this._element.removeEventListener('keypress', this._keyPressHandler);
    this._element.removeEventListener('keyup', this._keyUpHandler);
    this._element = null;
    document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
    window.removeEventListener('blur', this._windowBlurHandler, false);
  }

  /**
   * Convert a key code into a key identifier.
   *
   * @param {number} keyCode - The key code.
   * @returns {string} The key identifier.
   * @private
   */
  toKeyIdentifier(keyCode) {
    keyCode = toKeyCode(keyCode);
    const id = _keyCodeToKeyIdentifier[keyCode.toString()];
    if (id) {
      return id;
    }

    // Convert to hex and add leading 0's
    let hex = keyCode.toString(16).toUpperCase();
    const length = hex.length;
    for (let count = 0; count < 4 - length; count++) {
      hex = '0' + hex;
    }
    return 'U+' + hex;
  }

  /**
   * Process the browser keydown event.
   *
   * @param {globalThis.KeyboardEvent} event - The browser keyboard event.
   * @private
   */
  _handleKeyDown(event) {
    const code = event.keyCode || event.charCode;

    // Google Chrome auto-filling of login forms could raise a malformed event
    if (code === undefined) return;
    const id = this.toKeyIdentifier(code);
    this._keymap[id] = true;
    this.fire('keydown', makeKeyboardEvent(event));
    if (this.preventDefault) {
      event.preventDefault();
    }
    if (this.stopPropagation) {
      event.stopPropagation();
    }
  }

  /**
   * Process the browser keyup event.
   *
   * @param {globalThis.KeyboardEvent} event - The browser keyboard event.
   * @private
   */
  _handleKeyUp(event) {
    const code = event.keyCode || event.charCode;

    // Google Chrome auto-filling of login forms could raise a malformed event
    if (code === undefined) return;
    const id = this.toKeyIdentifier(code);
    delete this._keymap[id];
    this.fire('keyup', makeKeyboardEvent(event));
    if (this.preventDefault) {
      event.preventDefault();
    }
    if (this.stopPropagation) {
      event.stopPropagation();
    }
  }

  /**
   * Process the browser keypress event.
   *
   * @param {globalThis.KeyboardEvent} event - The browser keyboard event.
   * @private
   */
  _handleKeyPress(event) {
    this.fire('keypress', makeKeyboardEvent(event));
    if (this.preventDefault) {
      event.preventDefault();
    }
    if (this.stopPropagation) {
      event.stopPropagation();
    }
  }

  /**
   * Handle the browser visibilitychange event.
   *
   * @private
   */
  _handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this._handleWindowBlur();
    }
  }

  /**
   * Handle the browser blur event.
   *
   * @private
   */
  _handleWindowBlur() {
    this._keymap = {};
    this._lastmap = {};
  }

  /**
   * Called once per frame to update internal state.
   *
   * @ignore
   */
  update() {
    // clear all keys
    for (const prop in this._lastmap) {
      delete this._lastmap[prop];
    }
    for (const prop in this._keymap) {
      if (this._keymap.hasOwnProperty(prop)) {
        this._lastmap[prop] = this._keymap[prop];
      }
    }
  }

  /**
   * Return true if the key is currently down.
   *
   * @param {number} key - The keyCode of the key to test. See the KEY_* constants.
   * @returns {boolean} True if the key was pressed, false if not.
   */
  isPressed(key) {
    const keyCode = toKeyCode(key);
    const id = this.toKeyIdentifier(keyCode);
    return !!this._keymap[id];
  }

  /**
   * Returns true if the key was pressed since the last update.
   *
   * @param {number} key - The keyCode of the key to test. See the KEY_* constants.
   * @returns {boolean} True if the key was pressed.
   */
  wasPressed(key) {
    const keyCode = toKeyCode(key);
    const id = this.toKeyIdentifier(keyCode);
    return !!this._keymap[id] && !!!this._lastmap[id];
  }

  /**
   * Returns true if the key was released since the last update.
   *
   * @param {number} key - The keyCode of the key to test. See the KEY_* constants.
   * @returns {boolean} True if the key was pressed.
   */
  wasReleased(key) {
    const keyCode = toKeyCode(key);
    const id = this.toKeyIdentifier(keyCode);
    return !!!this._keymap[id] && !!this._lastmap[id];
  }
}

export { Keyboard };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2V5Ym9hcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9pbnB1dC9rZXlib2FyZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4va2V5Ym9hcmQtZXZlbnQuanMnO1xuXG4vLyBpbnRlcm5hbCBnbG9iYWwga2V5Ym9hcmQgZXZlbnRzXG5jb25zdCBfa2V5Ym9hcmRFdmVudCA9IG5ldyBLZXlib2FyZEV2ZW50KCk7XG5cbi8qKlxuICogQ29udmVydCBhIGJyb3dzZXIga2V5Ym9hcmQgZXZlbnQgdG8gYSBQbGF5Q2FudmFzIGtleWJvYXJkIGV2ZW50LlxuICpcbiAqIEBwYXJhbSB7Z2xvYmFsVGhpcy5LZXlib2FyZEV2ZW50fSBldmVudCAtIEEgYnJvd3NlciBrZXlib2FyZCBldmVudC5cbiAqIEByZXR1cm5zIHtLZXlib2FyZEV2ZW50fSBBIFBsYXlDYW52YXMga2V5Ym9hcmQgZXZlbnQuXG4gKiBAaWdub3JlXG4gKi9cbmZ1bmN0aW9uIG1ha2VLZXlib2FyZEV2ZW50KGV2ZW50KSB7XG4gICAgX2tleWJvYXJkRXZlbnQua2V5ID0gZXZlbnQua2V5Q29kZTtcbiAgICBfa2V5Ym9hcmRFdmVudC5lbGVtZW50ID0gZXZlbnQudGFyZ2V0O1xuICAgIF9rZXlib2FyZEV2ZW50LmV2ZW50ID0gZXZlbnQ7XG4gICAgcmV0dXJuIF9rZXlib2FyZEV2ZW50O1xufVxuXG4vKipcbiAqIENvbnZlcnQgYSBzdHJpbmcgb3Iga2V5Y29kZSB0byBhIGtleWNvZGUuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd8bnVtYmVyfSBzIC0gRWl0aGVyIGEgY2hhcmFjdGVyIGNvZGUgb3IgdGhlIGtleSBjaGFyYWN0ZXIuXG4gKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgY2hhcmFjdGVyIGNvZGUuXG4gKiBAaWdub3JlXG4gKi9cbmZ1bmN0aW9uIHRvS2V5Q29kZShzKSB7XG4gICAgaWYgKHR5cGVvZiBzID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gcy50b1VwcGVyQ2FzZSgpLmNoYXJDb2RlQXQoMCk7XG4gICAgfVxuICAgIHJldHVybiBzO1xufVxuXG5jb25zdCBfa2V5Q29kZVRvS2V5SWRlbnRpZmllciA9IHtcbiAgICAnOSc6ICdUYWInLFxuICAgICcxMyc6ICdFbnRlcicsXG4gICAgJzE2JzogJ1NoaWZ0JyxcbiAgICAnMTcnOiAnQ29udHJvbCcsXG4gICAgJzE4JzogJ0FsdCcsXG4gICAgJzI3JzogJ0VzY2FwZScsXG5cbiAgICAnMzcnOiAnTGVmdCcsXG4gICAgJzM4JzogJ1VwJyxcbiAgICAnMzknOiAnUmlnaHQnLFxuICAgICc0MCc6ICdEb3duJyxcblxuICAgICc0Nic6ICdEZWxldGUnLFxuXG4gICAgJzkxJzogJ1dpbidcbn07XG5cbi8qKlxuICogQSBLZXlib2FyZCBkZXZpY2UgYm91bmQgdG8gYW4gRWxlbWVudC4gQWxsb3dzIHlvdSB0byBkZXRlY3QgdGhlIHN0YXRlIG9mIHRoZSBrZXkgcHJlc3Nlcy4gTm90ZVxuICogdGhhdCB0aGUgS2V5Ym9hcmQgb2JqZWN0IG11c3QgYmUgYXR0YWNoZWQgdG8gYW4gRWxlbWVudCBiZWZvcmUgaXQgY2FuIGRldGVjdCBhbnkga2V5IHByZXNzZXMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBLZXlib2FyZCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEtleWJvYXJkIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbGVtZW50fFdpbmRvd30gW2VsZW1lbnRdIC0gRWxlbWVudCB0byBhdHRhY2ggS2V5Ym9hcmQgdG8uIE5vdGUgdGhhdCBlbGVtZW50cyBsaWtlXG4gICAgICogJmx0O2RpdiZndDsgY2FuJ3QgYWNjZXB0IGZvY3VzIGJ5IGRlZmF1bHQuIFRvIHVzZSBrZXlib2FyZCBldmVudHMgb24gYW4gZWxlbWVudCBsaWtlIHRoaXMgaXRcbiAgICAgKiBtdXN0IGhhdmUgYSB2YWx1ZSBvZiAndGFiaW5kZXgnIGUuZy4gdGFiaW5kZXg9XCIwXCIuIFNlZVxuICAgICAqIFtoZXJlXShodHRwOi8vd3d3LnczLm9yZy9XQUkvR0wvV0NBRzIwL1dELVdDQUcyMC1URUNIUy9TQ1IyOS5odG1sKSBmb3IgbW9yZSBkZXRhaWxzLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBvcHRpb25zIG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZXZlbnREZWZhdWx0XSAtIENhbGwgcHJldmVudERlZmF1bHQoKSBpbiBrZXkgZXZlbnQgaGFuZGxlcnMuXG4gICAgICogVGhpcyBzdG9wcyB0aGUgZGVmYXVsdCBhY3Rpb24gb2YgdGhlIGV2ZW50IG9jY3VycmluZy4gZS5nLiBDdHJsK1Qgd2lsbCBub3Qgb3BlbiBhIG5ld1xuICAgICAqIGJyb3dzZXIgdGFiLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuc3RvcFByb3BhZ2F0aW9uXSAtIENhbGwgc3RvcFByb3BhZ2F0aW9uKCkgaW4ga2V5IGV2ZW50IGhhbmRsZXJzLlxuICAgICAqIFRoaXMgc3RvcHMgdGhlIGV2ZW50IGJ1YmJsaW5nIHVwIHRoZSBET00gc28gbm8gcGFyZW50IGhhbmRsZXJzIHdpbGwgYmUgbm90aWZpZWQgb2YgdGhlXG4gICAgICogZXZlbnQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBhdHRhY2gga2V5Ym9hcmQgbGlzdGVuZXJzIHRvIHRoZSB3aW5kb3dcbiAgICAgKiBjb25zdCBrZXlib2FyZCA9IG5ldyBwYy5LZXlib2FyZCh3aW5kb3cpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGVsZW1lbnQsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX2VsZW1lbnQgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2tleURvd25IYW5kbGVyID0gdGhpcy5faGFuZGxlS2V5RG93bi5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9rZXlVcEhhbmRsZXIgPSB0aGlzLl9oYW5kbGVLZXlVcC5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl9rZXlQcmVzc0hhbmRsZXIgPSB0aGlzLl9oYW5kbGVLZXlQcmVzcy5iaW5kKHRoaXMpO1xuICAgICAgICB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciA9IHRoaXMuX2hhbmRsZVZpc2liaWxpdHlDaGFuZ2UuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fd2luZG93Qmx1ckhhbmRsZXIgPSB0aGlzLl9oYW5kbGVXaW5kb3dCbHVyLmJpbmQodGhpcyk7XG5cbiAgICAgICAgdGhpcy5fa2V5bWFwID0ge307XG4gICAgICAgIHRoaXMuX2xhc3RtYXAgPSB7fTtcblxuICAgICAgICBpZiAoZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5hdHRhY2goZWxlbWVudCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnByZXZlbnREZWZhdWx0ID0gb3B0aW9ucy5wcmV2ZW50RGVmYXVsdCB8fCBmYWxzZTtcbiAgICAgICAgdGhpcy5zdG9wUHJvcGFnYXRpb24gPSBvcHRpb25zLnN0b3BQcm9wYWdhdGlvbiB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEga2V5IGlzIHByZXNzZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgS2V5Ym9hcmQja2V5ZG93blxuICAgICAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgLSBUaGUgS2V5Ym9hcmQgZXZlbnQgb2JqZWN0LiBOb3RlLCB0aGlzIGV2ZW50IGlzIG9ubHkgdmFsaWQgZm9yIHRoZSBjdXJyZW50IGNhbGxiYWNrLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgb25LZXlEb3duID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgKiAgICAgaWYgKGUua2V5ID09PSBwYy5LRVlfU1BBQ0UpIHtcbiAgICAgKiAgICAgICAgIC8vIHNwYWNlIGtleSBwcmVzc2VkXG4gICAgICogICAgIH1cbiAgICAgKiAgICAgZS5ldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyBVc2Ugb3JpZ2luYWwgYnJvd3NlciBldmVudCB0byBwcmV2ZW50IGJyb3dzZXIgYWN0aW9uLlxuICAgICAqIH07XG4gICAgICogYXBwLmtleWJvYXJkLm9uKFwia2V5ZG93blwiLCBvbktleURvd24sIHRoaXMpO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIGtleSBpcyByZWxlYXNlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBLZXlib2FyZCNrZXl1cFxuICAgICAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgLSBUaGUgS2V5Ym9hcmQgZXZlbnQgb2JqZWN0LiBOb3RlLCB0aGlzIGV2ZW50IGlzIG9ubHkgdmFsaWQgZm9yIHRoZSBjdXJyZW50IGNhbGxiYWNrLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgb25LZXlVcCA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICogICAgIGlmIChlLmtleSA9PT0gcGMuS0VZX1NQQUNFKSB7XG4gICAgICogICAgICAgICAvLyBzcGFjZSBrZXkgcmVsZWFzZWRcbiAgICAgKiAgICAgfVxuICAgICAqICAgICBlLmV2ZW50LnByZXZlbnREZWZhdWx0KCk7IC8vIFVzZSBvcmlnaW5hbCBicm93c2VyIGV2ZW50IHRvIHByZXZlbnQgYnJvd3NlciBhY3Rpb24uXG4gICAgICogfTtcbiAgICAgKiBhcHAua2V5Ym9hcmQub24oXCJrZXl1cFwiLCBvbktleVVwLCB0aGlzKTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEF0dGFjaCB0aGUga2V5Ym9hcmQgZXZlbnQgaGFuZGxlcnMgdG8gYW4gRWxlbWVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudHxXaW5kb3d9IGVsZW1lbnQgLSBUaGUgZWxlbWVudCB0byBsaXN0ZW4gZm9yIGtleWJvYXJkIGV2ZW50cyBvbi5cbiAgICAgKi9cbiAgICBhdHRhY2goZWxlbWVudCkge1xuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCkge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIHByZXZpb3VzIGF0dGFjaGVkIGVsZW1lbnRcbiAgICAgICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5fa2V5RG93bkhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlwcmVzcycsIHRoaXMuX2tleVByZXNzSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB0aGlzLl9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdGhpcy5fa2V5VXBIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignYmx1cicsIHRoaXMuX3dpbmRvd0JsdXJIYW5kbGVyLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGV0YWNoIHRoZSBrZXlib2FyZCBldmVudCBoYW5kbGVycyBmcm9tIHRoZSBlbGVtZW50IGl0IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGRldGFjaCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKCdVbmFibGUgdG8gZGV0YWNoIGtleWJvYXJkLiBJdCBpcyBub3QgYXR0YWNoZWQgdG8gYW4gZWxlbWVudC4nKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMuX2tleURvd25IYW5kbGVyKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlwcmVzcycsIHRoaXMuX2tleVByZXNzSGFuZGxlcik7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB0aGlzLl9rZXlVcEhhbmRsZXIpO1xuICAgICAgICB0aGlzLl9lbGVtZW50ID0gbnVsbDtcblxuICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2JsdXInLCB0aGlzLl93aW5kb3dCbHVySGFuZGxlciwgZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgYSBrZXkgY29kZSBpbnRvIGEga2V5IGlkZW50aWZpZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0ga2V5Q29kZSAtIFRoZSBrZXkgY29kZS5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUga2V5IGlkZW50aWZpZXIuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICB0b0tleUlkZW50aWZpZXIoa2V5Q29kZSkge1xuICAgICAgICBrZXlDb2RlID0gdG9LZXlDb2RlKGtleUNvZGUpO1xuXG4gICAgICAgIGNvbnN0IGlkID0gX2tleUNvZGVUb0tleUlkZW50aWZpZXJba2V5Q29kZS50b1N0cmluZygpXTtcbiAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gaWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb252ZXJ0IHRvIGhleCBhbmQgYWRkIGxlYWRpbmcgMCdzXG4gICAgICAgIGxldCBoZXggPSBrZXlDb2RlLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpO1xuICAgICAgICBjb25zdCBsZW5ndGggPSBoZXgubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBjb3VudCA9IDA7IGNvdW50IDwgKDQgLSBsZW5ndGgpOyBjb3VudCsrKSB7XG4gICAgICAgICAgICBoZXggPSAnMCcgKyBoZXg7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJ1UrJyArIGhleDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIHRoZSBicm93c2VyIGtleWRvd24gZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2dsb2JhbFRoaXMuS2V5Ym9hcmRFdmVudH0gZXZlbnQgLSBUaGUgYnJvd3NlciBrZXlib2FyZCBldmVudC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oYW5kbGVLZXlEb3duKGV2ZW50KSB7XG4gICAgICAgIGNvbnN0IGNvZGUgPSBldmVudC5rZXlDb2RlIHx8IGV2ZW50LmNoYXJDb2RlO1xuXG4gICAgICAgIC8vIEdvb2dsZSBDaHJvbWUgYXV0by1maWxsaW5nIG9mIGxvZ2luIGZvcm1zIGNvdWxkIHJhaXNlIGEgbWFsZm9ybWVkIGV2ZW50XG4gICAgICAgIGlmIChjb2RlID09PSB1bmRlZmluZWQpIHJldHVybjtcblxuICAgICAgICBjb25zdCBpZCA9IHRoaXMudG9LZXlJZGVudGlmaWVyKGNvZGUpO1xuXG4gICAgICAgIHRoaXMuX2tleW1hcFtpZF0gPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuZmlyZSgna2V5ZG93bicsIG1ha2VLZXlib2FyZEV2ZW50KGV2ZW50KSk7XG5cbiAgICAgICAgaWYgKHRoaXMucHJldmVudERlZmF1bHQpIHtcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuc3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgdGhlIGJyb3dzZXIga2V5dXAgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2dsb2JhbFRoaXMuS2V5Ym9hcmRFdmVudH0gZXZlbnQgLSBUaGUgYnJvd3NlciBrZXlib2FyZCBldmVudC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9oYW5kbGVLZXlVcChldmVudCkge1xuICAgICAgICBjb25zdCBjb2RlID0gZXZlbnQua2V5Q29kZSB8fCBldmVudC5jaGFyQ29kZTtcblxuICAgICAgICAvLyBHb29nbGUgQ2hyb21lIGF1dG8tZmlsbGluZyBvZiBsb2dpbiBmb3JtcyBjb3VsZCByYWlzZSBhIG1hbGZvcm1lZCBldmVudFxuICAgICAgICBpZiAoY29kZSA9PT0gdW5kZWZpbmVkKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgaWQgPSB0aGlzLnRvS2V5SWRlbnRpZmllcihjb2RlKTtcblxuICAgICAgICBkZWxldGUgdGhpcy5fa2V5bWFwW2lkXTtcblxuICAgICAgICB0aGlzLmZpcmUoJ2tleXVwJywgbWFrZUtleWJvYXJkRXZlbnQoZXZlbnQpKTtcblxuICAgICAgICBpZiAodGhpcy5wcmV2ZW50RGVmYXVsdCkge1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5zdG9wUHJvcGFnYXRpb24pIHtcbiAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvY2VzcyB0aGUgYnJvd3NlciBrZXlwcmVzcyBldmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Z2xvYmFsVGhpcy5LZXlib2FyZEV2ZW50fSBldmVudCAtIFRoZSBicm93c2VyIGtleWJvYXJkIGV2ZW50LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2hhbmRsZUtleVByZXNzKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuZmlyZSgna2V5cHJlc3MnLCBtYWtlS2V5Ym9hcmRFdmVudChldmVudCkpO1xuXG4gICAgICAgIGlmICh0aGlzLnByZXZlbnREZWZhdWx0KSB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLnN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIGJyb3dzZXIgdmlzaWJpbGl0eWNoYW5nZSBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2hhbmRsZVZpc2liaWxpdHlDaGFuZ2UoKSB7XG4gICAgICAgIGlmIChkb2N1bWVudC52aXNpYmlsaXR5U3RhdGUgPT09ICdoaWRkZW4nKSB7XG4gICAgICAgICAgICB0aGlzLl9oYW5kbGVXaW5kb3dCbHVyKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGUgdGhlIGJyb3dzZXIgYmx1ciBldmVudC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2hhbmRsZVdpbmRvd0JsdXIoKSB7XG4gICAgICAgIHRoaXMuX2tleW1hcCA9IHt9O1xuICAgICAgICB0aGlzLl9sYXN0bWFwID0ge307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIG9uY2UgcGVyIGZyYW1lIHRvIHVwZGF0ZSBpbnRlcm5hbCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoKSB7XG4gICAgICAgIC8vIGNsZWFyIGFsbCBrZXlzXG4gICAgICAgIGZvciAoY29uc3QgcHJvcCBpbiB0aGlzLl9sYXN0bWFwKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbGFzdG1hcFtwcm9wXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgcHJvcCBpbiB0aGlzLl9rZXltYXApIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9rZXltYXAuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sYXN0bWFwW3Byb3BdID0gdGhpcy5fa2V5bWFwW3Byb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRydWUgaWYgdGhlIGtleSBpcyBjdXJyZW50bHkgZG93bi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBrZXkgLSBUaGUga2V5Q29kZSBvZiB0aGUga2V5IHRvIHRlc3QuIFNlZSB0aGUgS0VZXyogY29uc3RhbnRzLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBrZXkgd2FzIHByZXNzZWQsIGZhbHNlIGlmIG5vdC5cbiAgICAgKi9cbiAgICBpc1ByZXNzZWQoa2V5KSB7XG4gICAgICAgIGNvbnN0IGtleUNvZGUgPSB0b0tleUNvZGUoa2V5KTtcbiAgICAgICAgY29uc3QgaWQgPSB0aGlzLnRvS2V5SWRlbnRpZmllcihrZXlDb2RlKTtcblxuICAgICAgICByZXR1cm4gISEodGhpcy5fa2V5bWFwW2lkXSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBrZXkgd2FzIHByZXNzZWQgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGtleSAtIFRoZSBrZXlDb2RlIG9mIHRoZSBrZXkgdG8gdGVzdC4gU2VlIHRoZSBLRVlfKiBjb25zdGFudHMuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGtleSB3YXMgcHJlc3NlZC5cbiAgICAgKi9cbiAgICB3YXNQcmVzc2VkKGtleSkge1xuICAgICAgICBjb25zdCBrZXlDb2RlID0gdG9LZXlDb2RlKGtleSk7XG4gICAgICAgIGNvbnN0IGlkID0gdGhpcy50b0tleUlkZW50aWZpZXIoa2V5Q29kZSk7XG5cbiAgICAgICAgcmV0dXJuICghISh0aGlzLl9rZXltYXBbaWRdKSAmJiAhISEodGhpcy5fbGFzdG1hcFtpZF0pKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGtleSB3YXMgcmVsZWFzZWQgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGtleSAtIFRoZSBrZXlDb2RlIG9mIHRoZSBrZXkgdG8gdGVzdC4gU2VlIHRoZSBLRVlfKiBjb25zdGFudHMuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGtleSB3YXMgcHJlc3NlZC5cbiAgICAgKi9cbiAgICB3YXNSZWxlYXNlZChrZXkpIHtcbiAgICAgICAgY29uc3Qga2V5Q29kZSA9IHRvS2V5Q29kZShrZXkpO1xuICAgICAgICBjb25zdCBpZCA9IHRoaXMudG9LZXlJZGVudGlmaWVyKGtleUNvZGUpO1xuXG4gICAgICAgIHJldHVybiAoISEhKHRoaXMuX2tleW1hcFtpZF0pICYmICEhKHRoaXMuX2xhc3RtYXBbaWRdKSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBLZXlib2FyZCB9O1xuIl0sIm5hbWVzIjpbIl9rZXlib2FyZEV2ZW50IiwiS2V5Ym9hcmRFdmVudCIsIm1ha2VLZXlib2FyZEV2ZW50IiwiZXZlbnQiLCJrZXkiLCJrZXlDb2RlIiwiZWxlbWVudCIsInRhcmdldCIsInRvS2V5Q29kZSIsInMiLCJ0b1VwcGVyQ2FzZSIsImNoYXJDb2RlQXQiLCJfa2V5Q29kZVRvS2V5SWRlbnRpZmllciIsIktleWJvYXJkIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJvcHRpb25zIiwiX2VsZW1lbnQiLCJfa2V5RG93bkhhbmRsZXIiLCJfaGFuZGxlS2V5RG93biIsImJpbmQiLCJfa2V5VXBIYW5kbGVyIiwiX2hhbmRsZUtleVVwIiwiX2tleVByZXNzSGFuZGxlciIsIl9oYW5kbGVLZXlQcmVzcyIsIl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciIsIl9oYW5kbGVWaXNpYmlsaXR5Q2hhbmdlIiwiX3dpbmRvd0JsdXJIYW5kbGVyIiwiX2hhbmRsZVdpbmRvd0JsdXIiLCJfa2V5bWFwIiwiX2xhc3RtYXAiLCJhdHRhY2giLCJwcmV2ZW50RGVmYXVsdCIsInN0b3BQcm9wYWdhdGlvbiIsImRldGFjaCIsImFkZEV2ZW50TGlzdGVuZXIiLCJkb2N1bWVudCIsIndpbmRvdyIsIkRlYnVnIiwid2FybiIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJ0b0tleUlkZW50aWZpZXIiLCJpZCIsInRvU3RyaW5nIiwiaGV4IiwibGVuZ3RoIiwiY291bnQiLCJjb2RlIiwiY2hhckNvZGUiLCJ1bmRlZmluZWQiLCJmaXJlIiwidmlzaWJpbGl0eVN0YXRlIiwidXBkYXRlIiwicHJvcCIsImhhc093blByb3BlcnR5IiwiaXNQcmVzc2VkIiwid2FzUHJlc3NlZCIsIndhc1JlbGVhc2VkIl0sIm1hcHBpbmdzIjoiOzs7O0FBS0E7QUFDQSxNQUFNQSxjQUFjLEdBQUcsSUFBSUMsYUFBYSxFQUFFLENBQUE7O0FBRTFDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsaUJBQWlCQSxDQUFDQyxLQUFLLEVBQUU7QUFDOUJILEVBQUFBLGNBQWMsQ0FBQ0ksR0FBRyxHQUFHRCxLQUFLLENBQUNFLE9BQU8sQ0FBQTtBQUNsQ0wsRUFBQUEsY0FBYyxDQUFDTSxPQUFPLEdBQUdILEtBQUssQ0FBQ0ksTUFBTSxDQUFBO0VBQ3JDUCxjQUFjLENBQUNHLEtBQUssR0FBR0EsS0FBSyxDQUFBO0FBQzVCLEVBQUEsT0FBT0gsY0FBYyxDQUFBO0FBQ3pCLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTUSxTQUFTQSxDQUFDQyxD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
