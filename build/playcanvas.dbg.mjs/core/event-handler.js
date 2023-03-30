/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * Callback used by {@link EventHandler} functions. Note the callback is limited to 8 arguments.
 *
 * @callback HandleEventCallback
 * @param {*} [arg1] - First argument that is passed from caller.
 * @param {*} [arg2] - Second argument that is passed from caller.
 * @param {*} [arg3] - Third argument that is passed from caller.
 * @param {*} [arg4] - Fourth argument that is passed from caller.
 * @param {*} [arg5] - Fifth argument that is passed from caller.
 * @param {*} [arg6] - Sixth argument that is passed from caller.
 * @param {*} [arg7] - Seventh argument that is passed from caller.
 * @param {*} [arg8] - Eighth argument that is passed from caller.
 */

/**
 * Abstract base class that implements functionality for event handling.
 *
 * ```javascript
 * var obj = new EventHandlerSubclass();
 *
 * // subscribe to an event
 * obj.on('hello', function (str) {
 *     console.log('event hello is fired', str);
 * });
 *
 * // fire event
 * obj.fire('hello', 'world');
 * ```
 */
class EventHandler {
  constructor() {
    this._callbacks = {};
    this._callbackActive = {};
  }
  /**
   * Reinitialize the event handler.
   *
   * @private
   */
  initEventHandler() {
    this._callbacks = {};
    this._callbackActive = {};
  }

  /**
   * Registers a new event handler.
   *
   * @param {string} name - Name of the event to bind the callback to.
   * @param {HandleEventCallback} callback - Function that is called when event is fired. Note
   * the callback is limited to 8 arguments.
   * @param {object} [scope] - Object to use as 'this' when the event is fired, defaults to
   * current this.
   * @param {boolean} [once=false] - If true, the callback will be unbound after being fired once.
   * @private
   */
  _addCallback(name, callback, scope, once = false) {
    if (!name || typeof name !== 'string' || !callback) return;
    if (!this._callbacks[name]) this._callbacks[name] = [];
    if (this._callbackActive[name] && this._callbackActive[name] === this._callbacks[name]) this._callbackActive[name] = this._callbackActive[name].slice();
    this._callbacks[name].push({
      callback: callback,
      scope: scope || this,
      once: once
    });
  }

  /**
   * Attach an event handler to an event.
   *
   * @param {string} name - Name of the event to bind the callback to.
   * @param {HandleEventCallback} callback - Function that is called when event is fired. Note
   * the callback is limited to 8 arguments.
   * @param {object} [scope] - Object to use as 'this' when the event is fired, defaults to
   * current this.
   * @returns {EventHandler} Self for chaining.
   * @example
   * obj.on('test', function (a, b) {
   *     console.log(a + b);
   * });
   * obj.fire('test', 1, 2); // prints 3 to the console
   */
  on(name, callback, scope) {
    this._addCallback(name, callback, scope, false);
    return this;
  }

  /**
   * Detach an event handler from an event. If callback is not provided then all callbacks are
   * unbound from the event, if scope is not provided then all events with the callback will be
   * unbound.
   *
   * @param {string} [name] - Name of the event to unbind.
   * @param {HandleEventCallback} [callback] - Function to be unbound.
   * @param {object} [scope] - Scope that was used as the this when the event is fired.
   * @returns {EventHandler} Self for chaining.
   * @example
   * var handler = function () {
   * };
   * obj.on('test', handler);
   *
   * obj.off(); // Removes all events
   * obj.off('test'); // Removes all events called 'test'
   * obj.off('test', handler); // Removes all handler functions, called 'test'
   * obj.off('test', handler, this); // Removes all handler functions, called 'test' with scope this
   */
  off(name, callback, scope) {
    if (name) {
      if (this._callbackActive[name] && this._callbackActive[name] === this._callbacks[name]) this._callbackActive[name] = this._callbackActive[name].slice();
    } else {
      for (const key in this._callbackActive) {
        if (!this._callbacks[key]) continue;
        if (this._callbacks[key] !== this._callbackActive[key]) continue;
        this._callbackActive[key] = this._callbackActive[key].slice();
      }
    }
    if (!name) {
      this._callbacks = {};
    } else if (!callback) {
      if (this._callbacks[name]) this._callbacks[name] = [];
    } else {
      const events = this._callbacks[name];
      if (!events) return this;
      let count = events.length;
      for (let i = 0; i < count; i++) {
        if (events[i].callback !== callback) continue;
        if (scope && events[i].scope !== scope) continue;
        events[i--] = events[--count];
      }
      events.length = count;
    }
    return this;
  }

  /**
   * Fire an event, all additional arguments are passed on to the event listener.
   *
   * @param {string} name - Name of event to fire.
   * @param {*} [arg1] - First argument that is passed to the event handler.
   * @param {*} [arg2] - Second argument that is passed to the event handler.
   * @param {*} [arg3] - Third argument that is passed to the event handler.
   * @param {*} [arg4] - Fourth argument that is passed to the event handler.
   * @param {*} [arg5] - Fifth argument that is passed to the event handler.
   * @param {*} [arg6] - Sixth argument that is passed to the event handler.
   * @param {*} [arg7] - Seventh argument that is passed to the event handler.
   * @param {*} [arg8] - Eighth argument that is passed to the event handler.
   * @returns {EventHandler} Self for chaining.
   * @example
   * obj.fire('test', 'This is the message');
   */
  fire(name, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8) {
    if (!name || !this._callbacks[name]) return this;
    let callbacks;
    if (!this._callbackActive[name]) {
      this._callbackActive[name] = this._callbacks[name];
    } else {
      if (this._callbackActive[name] === this._callbacks[name]) this._callbackActive[name] = this._callbackActive[name].slice();
      callbacks = this._callbacks[name].slice();
    }

    // TODO: What does callbacks do here?
    // In particular this condition check looks wrong: (i < (callbacks || this._callbackActive[name]).length)
    // Because callbacks is not an integer
    // eslint-disable-next-line no-unmodified-loop-condition
    for (let i = 0; (callbacks || this._callbackActive[name]) && i < (callbacks || this._callbackActive[name]).length; i++) {
      const evt = (callbacks || this._callbackActive[name])[i];
      evt.callback.call(evt.scope, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8);
      if (evt.once) {
        // check that callback still exists because user may have unsubscribed
        // in the event handler
        const existingCallback = this._callbacks[name];
        const ind = existingCallback ? existingCallback.indexOf(evt) : -1;
        if (ind !== -1) {
          if (this._callbackActive[name] === existingCallback) this._callbackActive[name] = this._callbackActive[name].slice();
          this._callbacks[name].splice(ind, 1);
        }
      }
    }
    if (!callbacks) this._callbackActive[name] = null;
    return this;
  }

  /**
   * Attach an event handler to an event. This handler will be removed after being fired once.
   *
   * @param {string} name - Name of the event to bind the callback to.
   * @param {HandleEventCallback} callback - Function that is called when event is fired. Note
   * the callback is limited to 8 arguments.
   * @param {object} [scope] - Object to use as 'this' when the event is fired, defaults to
   * current this.
   * @returns {EventHandler} Self for chaining.
   * @example
   * obj.once('test', function (a, b) {
   *     console.log(a + b);
   * });
   * obj.fire('test', 1, 2); // prints 3 to the console
   * obj.fire('test', 1, 2); // not going to get handled
   */
  once(name, callback, scope) {
    this._addCallback(name, callback, scope, true);
    return this;
  }

  /**
   * Test if there are any handlers bound to an event name.
   *
   * @param {string} name - The name of the event to test.
   * @returns {boolean} True if the object has handlers bound to the specified event name.
   * @example
   * obj.on('test', function () { }); // bind an event to 'test'
   * obj.hasEvent('test'); // returns true
   * obj.hasEvent('hello'); // returns false
   */
  hasEvent(name) {
    return this._callbacks[name] && this._callbacks[name].length !== 0 || false;
  }
}

export { EventHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtaGFuZGxlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvZXZlbnQtaGFuZGxlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEV2ZW50SGFuZGxlcn0gZnVuY3Rpb25zLiBOb3RlIHRoZSBjYWxsYmFjayBpcyBsaW1pdGVkIHRvIDggYXJndW1lbnRzLlxuICpcbiAqIEBjYWxsYmFjayBIYW5kbGVFdmVudENhbGxiYWNrXG4gKiBAcGFyYW0geyp9IFthcmcxXSAtIEZpcnN0IGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICogQHBhcmFtIHsqfSBbYXJnMl0gLSBTZWNvbmQgYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgZnJvbSBjYWxsZXIuXG4gKiBAcGFyYW0geyp9IFthcmczXSAtIFRoaXJkIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICogQHBhcmFtIHsqfSBbYXJnNF0gLSBGb3VydGggYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgZnJvbSBjYWxsZXIuXG4gKiBAcGFyYW0geyp9IFthcmc1XSAtIEZpZnRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICogQHBhcmFtIHsqfSBbYXJnNl0gLSBTaXh0aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCBmcm9tIGNhbGxlci5cbiAqIEBwYXJhbSB7Kn0gW2FyZzddIC0gU2V2ZW50aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCBmcm9tIGNhbGxlci5cbiAqIEBwYXJhbSB7Kn0gW2FyZzhdIC0gRWlnaHRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICovXG5cbi8qKlxuICogQWJzdHJhY3QgYmFzZSBjbGFzcyB0aGF0IGltcGxlbWVudHMgZnVuY3Rpb25hbGl0eSBmb3IgZXZlbnQgaGFuZGxpbmcuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogdmFyIG9iaiA9IG5ldyBFdmVudEhhbmRsZXJTdWJjbGFzcygpO1xuICpcbiAqIC8vIHN1YnNjcmliZSB0byBhbiBldmVudFxuICogb2JqLm9uKCdoZWxsbycsIGZ1bmN0aW9uIChzdHIpIHtcbiAqICAgICBjb25zb2xlLmxvZygnZXZlbnQgaGVsbG8gaXMgZmlyZWQnLCBzdHIpO1xuICogfSk7XG4gKlxuICogLy8gZmlyZSBldmVudFxuICogb2JqLmZpcmUoJ2hlbGxvJywgJ3dvcmxkJyk7XG4gKiBgYGBcbiAqL1xuY2xhc3MgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NhbGxiYWNrcyA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jYWxsYmFja0FjdGl2ZSA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogUmVpbml0aWFsaXplIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBpbml0RXZlbnRIYW5kbGVyKCkge1xuICAgICAgICB0aGlzLl9jYWxsYmFja3MgPSB7fTtcbiAgICAgICAgdGhpcy5fY2FsbGJhY2tBY3RpdmUgPSB7fTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBuZXcgZXZlbnQgaGFuZGxlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gTmFtZSBvZiB0aGUgZXZlbnQgdG8gYmluZCB0aGUgY2FsbGJhY2sgdG8uXG4gICAgICogQHBhcmFtIHtIYW5kbGVFdmVudENhbGxiYWNrfSBjYWxsYmFjayAtIEZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHdoZW4gZXZlbnQgaXMgZmlyZWQuIE5vdGVcbiAgICAgKiB0aGUgY2FsbGJhY2sgaXMgbGltaXRlZCB0byA4IGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3Njb3BlXSAtIE9iamVjdCB0byB1c2UgYXMgJ3RoaXMnIHdoZW4gdGhlIGV2ZW50IGlzIGZpcmVkLCBkZWZhdWx0cyB0b1xuICAgICAqIGN1cnJlbnQgdGhpcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvbmNlPWZhbHNlXSAtIElmIHRydWUsIHRoZSBjYWxsYmFjayB3aWxsIGJlIHVuYm91bmQgYWZ0ZXIgYmVpbmcgZmlyZWQgb25jZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hZGRDYWxsYmFjayhuYW1lLCBjYWxsYmFjaywgc2NvcGUsIG9uY2UgPSBmYWxzZSkge1xuICAgICAgICBpZiAoIW5hbWUgfHwgdHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnIHx8ICFjYWxsYmFjaylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAoIXRoaXMuX2NhbGxiYWNrc1tuYW1lXSlcbiAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrc1tuYW1lXSA9IFtdO1xuXG4gICAgICAgIGlmICh0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSAmJiB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9PT0gdGhpcy5fY2FsbGJhY2tzW25hbWVdKVxuICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gPSB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXS5zbGljZSgpO1xuXG4gICAgICAgIHRoaXMuX2NhbGxiYWNrc1tuYW1lXS5wdXNoKHtcbiAgICAgICAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcbiAgICAgICAgICAgIHNjb3BlOiBzY29wZSB8fCB0aGlzLFxuICAgICAgICAgICAgb25jZTogb25jZVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlciB0byBhbiBldmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gTmFtZSBvZiB0aGUgZXZlbnQgdG8gYmluZCB0aGUgY2FsbGJhY2sgdG8uXG4gICAgICogQHBhcmFtIHtIYW5kbGVFdmVudENhbGxiYWNrfSBjYWxsYmFjayAtIEZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIHdoZW4gZXZlbnQgaXMgZmlyZWQuIE5vdGVcbiAgICAgKiB0aGUgY2FsbGJhY2sgaXMgbGltaXRlZCB0byA4IGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3Njb3BlXSAtIE9iamVjdCB0byB1c2UgYXMgJ3RoaXMnIHdoZW4gdGhlIGV2ZW50IGlzIGZpcmVkLCBkZWZhdWx0cyB0b1xuICAgICAqIGN1cnJlbnQgdGhpcy5cbiAgICAgKiBAcmV0dXJucyB7RXZlbnRIYW5kbGVyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG9iai5vbigndGVzdCcsIGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGEgKyBiKTtcbiAgICAgKiB9KTtcbiAgICAgKiBvYmouZmlyZSgndGVzdCcsIDEsIDIpOyAvLyBwcmludHMgMyB0byB0aGUgY29uc29sZVxuICAgICAqL1xuICAgIG9uKG5hbWUsIGNhbGxiYWNrLCBzY29wZSkge1xuICAgICAgICB0aGlzLl9hZGRDYWxsYmFjayhuYW1lLCBjYWxsYmFjaywgc2NvcGUsIGZhbHNlKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXRhY2ggYW4gZXZlbnQgaGFuZGxlciBmcm9tIGFuIGV2ZW50LiBJZiBjYWxsYmFjayBpcyBub3QgcHJvdmlkZWQgdGhlbiBhbGwgY2FsbGJhY2tzIGFyZVxuICAgICAqIHVuYm91bmQgZnJvbSB0aGUgZXZlbnQsIGlmIHNjb3BlIGlzIG5vdCBwcm92aWRlZCB0aGVuIGFsbCBldmVudHMgd2l0aCB0aGUgY2FsbGJhY2sgd2lsbCBiZVxuICAgICAqIHVuYm91bmQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW25hbWVdIC0gTmFtZSBvZiB0aGUgZXZlbnQgdG8gdW5iaW5kLlxuICAgICAqIEBwYXJhbSB7SGFuZGxlRXZlbnRDYWxsYmFja30gW2NhbGxiYWNrXSAtIEZ1bmN0aW9uIHRvIGJlIHVuYm91bmQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtzY29wZV0gLSBTY29wZSB0aGF0IHdhcyB1c2VkIGFzIHRoZSB0aGlzIHdoZW4gdGhlIGV2ZW50IGlzIGZpcmVkLlxuICAgICAqIEByZXR1cm5zIHtFdmVudEhhbmRsZXJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGhhbmRsZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICogfTtcbiAgICAgKiBvYmoub24oJ3Rlc3QnLCBoYW5kbGVyKTtcbiAgICAgKlxuICAgICAqIG9iai5vZmYoKTsgLy8gUmVtb3ZlcyBhbGwgZXZlbnRzXG4gICAgICogb2JqLm9mZigndGVzdCcpOyAvLyBSZW1vdmVzIGFsbCBldmVudHMgY2FsbGVkICd0ZXN0J1xuICAgICAqIG9iai5vZmYoJ3Rlc3QnLCBoYW5kbGVyKTsgLy8gUmVtb3ZlcyBhbGwgaGFuZGxlciBmdW5jdGlvbnMsIGNhbGxlZCAndGVzdCdcbiAgICAgKiBvYmoub2ZmKCd0ZXN0JywgaGFuZGxlciwgdGhpcyk7IC8vIFJlbW92ZXMgYWxsIGhhbmRsZXIgZnVuY3Rpb25zLCBjYWxsZWQgJ3Rlc3QnIHdpdGggc2NvcGUgdGhpc1xuICAgICAqL1xuICAgIG9mZihuYW1lLCBjYWxsYmFjaywgc2NvcGUpIHtcbiAgICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSAmJiB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9PT0gdGhpcy5fY2FsbGJhY2tzW25hbWVdKVxuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID0gdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0uc2xpY2UoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMuX2NhbGxiYWNrQWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9jYWxsYmFja3Nba2V5XSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY2FsbGJhY2tzW2tleV0gIT09IHRoaXMuX2NhbGxiYWNrQWN0aXZlW2tleV0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tBY3RpdmVba2V5XSA9IHRoaXMuX2NhbGxiYWNrQWN0aXZlW2tleV0uc2xpY2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbmFtZSkge1xuICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tzID0geyB9O1xuICAgICAgICB9IGVsc2UgaWYgKCFjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NhbGxiYWNrc1tuYW1lXSlcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxsYmFja3NbbmFtZV0gPSBbXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IHRoaXMuX2NhbGxiYWNrc1tuYW1lXTtcbiAgICAgICAgICAgIGlmICghZXZlbnRzKVxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgICAgICAgICBsZXQgY291bnQgPSBldmVudHMubGVuZ3RoO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoZXZlbnRzW2ldLmNhbGxiYWNrICE9PSBjYWxsYmFjaylcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2NvcGUgJiYgZXZlbnRzW2ldLnNjb3BlICE9PSBzY29wZSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBldmVudHNbaS0tXSA9IGV2ZW50c1stLWNvdW50XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV2ZW50cy5sZW5ndGggPSBjb3VudDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmUgYW4gZXZlbnQsIGFsbCBhZGRpdGlvbmFsIGFyZ3VtZW50cyBhcmUgcGFzc2VkIG9uIHRvIHRoZSBldmVudCBsaXN0ZW5lci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gTmFtZSBvZiBldmVudCB0byBmaXJlLlxuICAgICAqIEBwYXJhbSB7Kn0gW2FyZzFdIC0gRmlyc3QgYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXG4gICAgICogQHBhcmFtIHsqfSBbYXJnMl0gLSBTZWNvbmQgYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXG4gICAgICogQHBhcmFtIHsqfSBbYXJnM10gLSBUaGlyZCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cbiAgICAgKiBAcGFyYW0geyp9IFthcmc0XSAtIEZvdXJ0aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cbiAgICAgKiBAcGFyYW0geyp9IFthcmc1XSAtIEZpZnRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqIEBwYXJhbSB7Kn0gW2FyZzZdIC0gU2l4dGggYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXG4gICAgICogQHBhcmFtIHsqfSBbYXJnN10gLSBTZXZlbnRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqIEBwYXJhbSB7Kn0gW2FyZzhdIC0gRWlnaHRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqIEByZXR1cm5zIHtFdmVudEhhbmRsZXJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogb2JqLmZpcmUoJ3Rlc3QnLCAnVGhpcyBpcyB0aGUgbWVzc2FnZScpO1xuICAgICAqL1xuICAgIGZpcmUobmFtZSwgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCkge1xuICAgICAgICBpZiAoIW5hbWUgfHwgIXRoaXMuX2NhbGxiYWNrc1tuYW1lXSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgICAgIGxldCBjYWxsYmFja3M7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSkge1xuICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gPSB0aGlzLl9jYWxsYmFja3NbbmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gPT09IHRoaXMuX2NhbGxiYWNrc1tuYW1lXSlcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9IHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdLnNsaWNlKCk7XG5cbiAgICAgICAgICAgIGNhbGxiYWNrcyA9IHRoaXMuX2NhbGxiYWNrc1tuYW1lXS5zbGljZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETzogV2hhdCBkb2VzIGNhbGxiYWNrcyBkbyBoZXJlP1xuICAgICAgICAvLyBJbiBwYXJ0aWN1bGFyIHRoaXMgY29uZGl0aW9uIGNoZWNrIGxvb2tzIHdyb25nOiAoaSA8IChjYWxsYmFja3MgfHwgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0pLmxlbmd0aClcbiAgICAgICAgLy8gQmVjYXVzZSBjYWxsYmFja3MgaXMgbm90IGFuIGludGVnZXJcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVubW9kaWZpZWQtbG9vcC1jb25kaXRpb25cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IChjYWxsYmFja3MgfHwgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0pICYmIChpIDwgKGNhbGxiYWNrcyB8fCB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSkubGVuZ3RoKTsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBldnQgPSAoY2FsbGJhY2tzIHx8IHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdKVtpXTtcbiAgICAgICAgICAgIGV2dC5jYWxsYmFjay5jYWxsKGV2dC5zY29wZSwgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSwgYXJnNiwgYXJnNywgYXJnOCk7XG5cbiAgICAgICAgICAgIGlmIChldnQub25jZSkge1xuICAgICAgICAgICAgICAgIC8vIGNoZWNrIHRoYXQgY2FsbGJhY2sgc3RpbGwgZXhpc3RzIGJlY2F1c2UgdXNlciBtYXkgaGF2ZSB1bnN1YnNjcmliZWRcbiAgICAgICAgICAgICAgICAvLyBpbiB0aGUgZXZlbnQgaGFuZGxlclxuICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nQ2FsbGJhY2sgPSB0aGlzLl9jYWxsYmFja3NbbmFtZV07XG4gICAgICAgICAgICAgICAgY29uc3QgaW5kID0gZXhpc3RpbmdDYWxsYmFjayA/IGV4aXN0aW5nQ2FsbGJhY2suaW5kZXhPZihldnQpIDogLTE7XG5cbiAgICAgICAgICAgICAgICBpZiAoaW5kICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gPT09IGV4aXN0aW5nQ2FsbGJhY2spXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9IHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdLnNsaWNlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tzW25hbWVdLnNwbGljZShpbmQsIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY2FsbGJhY2tzKVxuICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gPSBudWxsO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGFjaCBhbiBldmVudCBoYW5kbGVyIHRvIGFuIGV2ZW50LiBUaGlzIGhhbmRsZXIgd2lsbCBiZSByZW1vdmVkIGFmdGVyIGJlaW5nIGZpcmVkIG9uY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGJpbmQgdGhlIGNhbGxiYWNrIHRvLlxuICAgICAqIEBwYXJhbSB7SGFuZGxlRXZlbnRDYWxsYmFja30gY2FsbGJhY2sgLSBGdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB3aGVuIGV2ZW50IGlzIGZpcmVkLiBOb3RlXG4gICAgICogdGhlIGNhbGxiYWNrIGlzIGxpbWl0ZWQgdG8gOCBhcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtzY29wZV0gLSBPYmplY3QgdG8gdXNlIGFzICd0aGlzJyB3aGVuIHRoZSBldmVudCBpcyBmaXJlZCwgZGVmYXVsdHMgdG9cbiAgICAgKiBjdXJyZW50IHRoaXMuXG4gICAgICogQHJldHVybnMge0V2ZW50SGFuZGxlcn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBvYmoub25jZSgndGVzdCcsIGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKGEgKyBiKTtcbiAgICAgKiB9KTtcbiAgICAgKiBvYmouZmlyZSgndGVzdCcsIDEsIDIpOyAvLyBwcmludHMgMyB0byB0aGUgY29uc29sZVxuICAgICAqIG9iai5maXJlKCd0ZXN0JywgMSwgMik7IC8vIG5vdCBnb2luZyB0byBnZXQgaGFuZGxlZFxuICAgICAqL1xuICAgIG9uY2UobmFtZSwgY2FsbGJhY2ssIHNjb3BlKSB7XG4gICAgICAgIHRoaXMuX2FkZENhbGxiYWNrKG5hbWUsIGNhbGxiYWNrLCBzY29wZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRlc3QgaWYgdGhlcmUgYXJlIGFueSBoYW5kbGVycyBib3VuZCB0byBhbiBldmVudCBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgdG8gdGVzdC5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgb2JqZWN0IGhhcyBoYW5kbGVycyBib3VuZCB0byB0aGUgc3BlY2lmaWVkIGV2ZW50IG5hbWUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBvYmoub24oJ3Rlc3QnLCBmdW5jdGlvbiAoKSB7IH0pOyAvLyBiaW5kIGFuIGV2ZW50IHRvICd0ZXN0J1xuICAgICAqIG9iai5oYXNFdmVudCgndGVzdCcpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiBvYmouaGFzRXZlbnQoJ2hlbGxvJyk7IC8vIHJldHVybnMgZmFsc2VcbiAgICAgKi9cbiAgICBoYXNFdmVudChuYW1lKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5fY2FsbGJhY2tzW25hbWVdICYmIHRoaXMuX2NhbGxiYWNrc1tuYW1lXS5sZW5ndGggIT09IDApIHx8IGZhbHNlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgRXZlbnRIYW5kbGVyIH07XG4iXSwibmFtZXMiOlsiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJfY2FsbGJhY2tzIiwiX2NhbGxiYWNrQWN0aXZlIiwiaW5pdEV2ZW50SGFuZGxlciIsIl9hZGRDYWxsYmFjayIsIm5hbWUiLCJjYWxsYmFjayIsInNjb3BlIiwib25jZSIsInNsaWNlIiwicHVzaCIsIm9uIiwib2ZmIiwia2V5IiwiZXZlbnRzIiwiY291bnQiLCJsZW5ndGgiLCJpIiwiZmlyZSIsImFyZzEiLCJhcmcyIiwiYXJnMyIsImFyZzQiLCJhcmc1IiwiYXJnNiIsImFyZzciLCJhcmc4IiwiY2FsbGJhY2tzIiwiZXZ0IiwiY2FsbCIsImV4aXN0aW5nQ2FsbGJhY2siLCJpbmQiLCJpbmRleE9mIiwic3BsaWNlIiwiaGFzRXZlbnQiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsWUFBWSxDQUFDO0VBQUFDLFdBQUEsR0FBQTtJQUFBLElBS2ZDLENBQUFBLFVBQVUsR0FBRyxFQUFFLENBQUE7SUFBQSxJQU1mQyxDQUFBQSxlQUFlLEdBQUcsRUFBRSxDQUFBO0FBQUEsR0FBQTtBQUVwQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLGdCQUFnQkEsR0FBRztBQUNmLElBQUEsSUFBSSxDQUFDRixVQUFVLEdBQUcsRUFBRSxDQUFBO0FBQ3BCLElBQUEsSUFBSSxDQUFDQyxlQUFlLEdBQUcsRUFBRSxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJRSxZQUFZQSxDQUFDQyxJQUFJLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFQyxJQUFJLEdBQUcsS0FBSyxFQUFFO0lBQzlDLElBQUksQ0FBQ0gsSUFBSSxJQUFJLE9BQU9BLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQ0MsUUFBUSxFQUM5QyxPQUFBO0FBRUosSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDTCxVQUFVLENBQUNJLElBQUksQ0FBQyxFQUN0QixJQUFJLENBQUNKLFVBQVUsQ0FBQ0ksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFBO0FBRTlC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
