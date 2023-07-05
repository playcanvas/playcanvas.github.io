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
 * const obj = new EventHandlerSubclass();
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
    /**
     * @type {object}
     * @private
     */
    this._callbacks = {};
    /**
     * @type {object}
     * @private
     */
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
   * const handler = function () {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtaGFuZGxlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvZXZlbnQtaGFuZGxlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEV2ZW50SGFuZGxlcn0gZnVuY3Rpb25zLiBOb3RlIHRoZSBjYWxsYmFjayBpcyBsaW1pdGVkIHRvIDggYXJndW1lbnRzLlxuICpcbiAqIEBjYWxsYmFjayBIYW5kbGVFdmVudENhbGxiYWNrXG4gKiBAcGFyYW0geyp9IFthcmcxXSAtIEZpcnN0IGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICogQHBhcmFtIHsqfSBbYXJnMl0gLSBTZWNvbmQgYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgZnJvbSBjYWxsZXIuXG4gKiBAcGFyYW0geyp9IFthcmczXSAtIFRoaXJkIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICogQHBhcmFtIHsqfSBbYXJnNF0gLSBGb3VydGggYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgZnJvbSBjYWxsZXIuXG4gKiBAcGFyYW0geyp9IFthcmc1XSAtIEZpZnRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICogQHBhcmFtIHsqfSBbYXJnNl0gLSBTaXh0aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCBmcm9tIGNhbGxlci5cbiAqIEBwYXJhbSB7Kn0gW2FyZzddIC0gU2V2ZW50aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCBmcm9tIGNhbGxlci5cbiAqIEBwYXJhbSB7Kn0gW2FyZzhdIC0gRWlnaHRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIGZyb20gY2FsbGVyLlxuICovXG5cbi8qKlxuICogQWJzdHJhY3QgYmFzZSBjbGFzcyB0aGF0IGltcGxlbWVudHMgZnVuY3Rpb25hbGl0eSBmb3IgZXZlbnQgaGFuZGxpbmcuXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogY29uc3Qgb2JqID0gbmV3IEV2ZW50SGFuZGxlclN1YmNsYXNzKCk7XG4gKlxuICogLy8gc3Vic2NyaWJlIHRvIGFuIGV2ZW50XG4gKiBvYmoub24oJ2hlbGxvJywgZnVuY3Rpb24gKHN0cikge1xuICogICAgIGNvbnNvbGUubG9nKCdldmVudCBoZWxsbyBpcyBmaXJlZCcsIHN0cik7XG4gKiB9KTtcbiAqXG4gKiAvLyBmaXJlIGV2ZW50XG4gKiBvYmouZmlyZSgnaGVsbG8nLCAnd29ybGQnKTtcbiAqIGBgYFxuICovXG5jbGFzcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY2FsbGJhY2tzID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NhbGxiYWNrQWN0aXZlID0ge307XG5cbiAgICAvKipcbiAgICAgKiBSZWluaXRpYWxpemUgdGhlIGV2ZW50IGhhbmRsZXIuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGluaXRFdmVudEhhbmRsZXIoKSB7XG4gICAgICAgIHRoaXMuX2NhbGxiYWNrcyA9IHt9O1xuICAgICAgICB0aGlzLl9jYWxsYmFja0FjdGl2ZSA9IHt9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBhIG5ldyBldmVudCBoYW5kbGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIHRoZSBldmVudCB0byBiaW5kIHRoZSBjYWxsYmFjayB0by5cbiAgICAgKiBAcGFyYW0ge0hhbmRsZUV2ZW50Q2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2hlbiBldmVudCBpcyBmaXJlZC4gTm90ZVxuICAgICAqIHRoZSBjYWxsYmFjayBpcyBsaW1pdGVkIHRvIDggYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbc2NvcGVdIC0gT2JqZWN0IHRvIHVzZSBhcyAndGhpcycgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWQsIGRlZmF1bHRzIHRvXG4gICAgICogY3VycmVudCB0aGlzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29uY2U9ZmFsc2VdIC0gSWYgdHJ1ZSwgdGhlIGNhbGxiYWNrIHdpbGwgYmUgdW5ib3VuZCBhZnRlciBiZWluZyBmaXJlZCBvbmNlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZENhbGxiYWNrKG5hbWUsIGNhbGxiYWNrLCBzY29wZSwgb25jZSA9IGZhbHNlKSB7XG4gICAgICAgIGlmICghbmFtZSB8fCB0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycgfHwgIWNhbGxiYWNrKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICghdGhpcy5fY2FsbGJhY2tzW25hbWVdKVxuICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tzW25hbWVdID0gW107XG5cbiAgICAgICAgaWYgKHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdICYmIHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID09PSB0aGlzLl9jYWxsYmFja3NbbmFtZV0pXG4gICAgICAgICAgICB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9IHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdLnNsaWNlKCk7XG5cbiAgICAgICAgdGhpcy5fY2FsbGJhY2tzW25hbWVdLnB1c2goe1xuICAgICAgICAgICAgY2FsbGJhY2s6IGNhbGxiYWNrLFxuICAgICAgICAgICAgc2NvcGU6IHNjb3BlIHx8IHRoaXMsXG4gICAgICAgICAgICBvbmNlOiBvbmNlXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEF0dGFjaCBhbiBldmVudCBoYW5kbGVyIHRvIGFuIGV2ZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIHRoZSBldmVudCB0byBiaW5kIHRoZSBjYWxsYmFjayB0by5cbiAgICAgKiBAcGFyYW0ge0hhbmRsZUV2ZW50Q2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2hlbiBldmVudCBpcyBmaXJlZC4gTm90ZVxuICAgICAqIHRoZSBjYWxsYmFjayBpcyBsaW1pdGVkIHRvIDggYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbc2NvcGVdIC0gT2JqZWN0IHRvIHVzZSBhcyAndGhpcycgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWQsIGRlZmF1bHRzIHRvXG4gICAgICogY3VycmVudCB0aGlzLlxuICAgICAqIEByZXR1cm5zIHtFdmVudEhhbmRsZXJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogb2JqLm9uKCd0ZXN0JywgZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coYSArIGIpO1xuICAgICAqIH0pO1xuICAgICAqIG9iai5maXJlKCd0ZXN0JywgMSwgMik7IC8vIHByaW50cyAzIHRvIHRoZSBjb25zb2xlXG4gICAgICovXG4gICAgb24obmFtZSwgY2FsbGJhY2ssIHNjb3BlKSB7XG4gICAgICAgIHRoaXMuX2FkZENhbGxiYWNrKG5hbWUsIGNhbGxiYWNrLCBzY29wZSwgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERldGFjaCBhbiBldmVudCBoYW5kbGVyIGZyb20gYW4gZXZlbnQuIElmIGNhbGxiYWNrIGlzIG5vdCBwcm92aWRlZCB0aGVuIGFsbCBjYWxsYmFja3MgYXJlXG4gICAgICogdW5ib3VuZCBmcm9tIHRoZSBldmVudCwgaWYgc2NvcGUgaXMgbm90IHByb3ZpZGVkIHRoZW4gYWxsIGV2ZW50cyB3aXRoIHRoZSBjYWxsYmFjayB3aWxsIGJlXG4gICAgICogdW5ib3VuZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbmFtZV0gLSBOYW1lIG9mIHRoZSBldmVudCB0byB1bmJpbmQuXG4gICAgICogQHBhcmFtIHtIYW5kbGVFdmVudENhbGxiYWNrfSBbY2FsbGJhY2tdIC0gRnVuY3Rpb24gdG8gYmUgdW5ib3VuZC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW3Njb3BlXSAtIFNjb3BlIHRoYXQgd2FzIHVzZWQgYXMgdGhlIHRoaXMgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWQuXG4gICAgICogQHJldHVybnMge0V2ZW50SGFuZGxlcn0gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBoYW5kbGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAqIH07XG4gICAgICogb2JqLm9uKCd0ZXN0JywgaGFuZGxlcik7XG4gICAgICpcbiAgICAgKiBvYmoub2ZmKCk7IC8vIFJlbW92ZXMgYWxsIGV2ZW50c1xuICAgICAqIG9iai5vZmYoJ3Rlc3QnKTsgLy8gUmVtb3ZlcyBhbGwgZXZlbnRzIGNhbGxlZCAndGVzdCdcbiAgICAgKiBvYmoub2ZmKCd0ZXN0JywgaGFuZGxlcik7IC8vIFJlbW92ZXMgYWxsIGhhbmRsZXIgZnVuY3Rpb25zLCBjYWxsZWQgJ3Rlc3QnXG4gICAgICogb2JqLm9mZigndGVzdCcsIGhhbmRsZXIsIHRoaXMpOyAvLyBSZW1vdmVzIGFsbCBoYW5kbGVyIGZ1bmN0aW9ucywgY2FsbGVkICd0ZXN0JyB3aXRoIHNjb3BlIHRoaXNcbiAgICAgKi9cbiAgICBvZmYobmFtZSwgY2FsbGJhY2ssIHNjb3BlKSB7XG4gICAgICAgIGlmIChuYW1lKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gJiYgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gPT09IHRoaXMuX2NhbGxiYWNrc1tuYW1lXSlcbiAgICAgICAgICAgICAgICB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSA9IHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdLnNsaWNlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLl9jYWxsYmFja0FjdGl2ZSkge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2FsbGJhY2tzW2tleV0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2NhbGxiYWNrc1trZXldICE9PSB0aGlzLl9jYWxsYmFja0FjdGl2ZVtrZXldKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrQWN0aXZlW2tleV0gPSB0aGlzLl9jYWxsYmFja0FjdGl2ZVtrZXldLnNsaWNlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrcyA9IHsgfTtcbiAgICAgICAgfSBlbHNlIGlmICghY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jYWxsYmFja3NbbmFtZV0pXG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tzW25hbWVdID0gW107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBldmVudHMgPSB0aGlzLl9jYWxsYmFja3NbbmFtZV07XG4gICAgICAgICAgICBpZiAoIWV2ZW50cylcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcblxuICAgICAgICAgICAgbGV0IGNvdW50ID0gZXZlbnRzLmxlbmd0aDtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50c1tpXS5jYWxsYmFjayAhPT0gY2FsbGJhY2spXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjb3BlICYmIGV2ZW50c1tpXS5zY29wZSAhPT0gc2NvcGUpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgZXZlbnRzW2ktLV0gPSBldmVudHNbLS1jb3VudF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBldmVudHMubGVuZ3RoID0gY291bnQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlIGFuIGV2ZW50LCBhbGwgYWRkaXRpb25hbCBhcmd1bWVudHMgYXJlIHBhc3NlZCBvbiB0byB0aGUgZXZlbnQgbGlzdGVuZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIE5hbWUgb2YgZXZlbnQgdG8gZmlyZS5cbiAgICAgKiBAcGFyYW0geyp9IFthcmcxXSAtIEZpcnN0IGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqIEBwYXJhbSB7Kn0gW2FyZzJdIC0gU2Vjb25kIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqIEBwYXJhbSB7Kn0gW2FyZzNdIC0gVGhpcmQgYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXG4gICAgICogQHBhcmFtIHsqfSBbYXJnNF0gLSBGb3VydGggYXJndW1lbnQgdGhhdCBpcyBwYXNzZWQgdG8gdGhlIGV2ZW50IGhhbmRsZXIuXG4gICAgICogQHBhcmFtIHsqfSBbYXJnNV0gLSBGaWZ0aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cbiAgICAgKiBAcGFyYW0geyp9IFthcmc2XSAtIFNpeHRoIGFyZ3VtZW50IHRoYXQgaXMgcGFzc2VkIHRvIHRoZSBldmVudCBoYW5kbGVyLlxuICAgICAqIEBwYXJhbSB7Kn0gW2FyZzddIC0gU2V2ZW50aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cbiAgICAgKiBAcGFyYW0geyp9IFthcmc4XSAtIEVpZ2h0aCBhcmd1bWVudCB0aGF0IGlzIHBhc3NlZCB0byB0aGUgZXZlbnQgaGFuZGxlci5cbiAgICAgKiBAcmV0dXJucyB7RXZlbnRIYW5kbGVyfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG9iai5maXJlKCd0ZXN0JywgJ1RoaXMgaXMgdGhlIG1lc3NhZ2UnKTtcbiAgICAgKi9cbiAgICBmaXJlKG5hbWUsIGFyZzEsIGFyZzIsIGFyZzMsIGFyZzQsIGFyZzUsIGFyZzYsIGFyZzcsIGFyZzgpIHtcbiAgICAgICAgaWYgKCFuYW1lIHx8ICF0aGlzLl9jYWxsYmFja3NbbmFtZV0pXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcblxuICAgICAgICBsZXQgY2FsbGJhY2tzO1xuXG4gICAgICAgIGlmICghdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0pIHtcbiAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID0gdGhpcy5fY2FsbGJhY2tzW25hbWVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID09PSB0aGlzLl9jYWxsYmFja3NbbmFtZV0pXG4gICAgICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gPSB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXS5zbGljZSgpO1xuXG4gICAgICAgICAgICBjYWxsYmFja3MgPSB0aGlzLl9jYWxsYmFja3NbbmFtZV0uc2xpY2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE86IFdoYXQgZG9lcyBjYWxsYmFja3MgZG8gaGVyZT9cbiAgICAgICAgLy8gSW4gcGFydGljdWxhciB0aGlzIGNvbmRpdGlvbiBjaGVjayBsb29rcyB3cm9uZzogKGkgPCAoY2FsbGJhY2tzIHx8IHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdKS5sZW5ndGgpXG4gICAgICAgIC8vIEJlY2F1c2UgY2FsbGJhY2tzIGlzIG5vdCBhbiBpbnRlZ2VyXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bm1vZGlmaWVkLWxvb3AtY29uZGl0aW9uXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyAoY2FsbGJhY2tzIHx8IHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdKSAmJiAoaSA8IChjYWxsYmFja3MgfHwgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0pLmxlbmd0aCk7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZXZ0ID0gKGNhbGxiYWNrcyB8fCB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXSlbaV07XG4gICAgICAgICAgICBldnQuY2FsbGJhY2suY2FsbChldnQuc2NvcGUsIGFyZzEsIGFyZzIsIGFyZzMsIGFyZzQsIGFyZzUsIGFyZzYsIGFyZzcsIGFyZzgpO1xuXG4gICAgICAgICAgICBpZiAoZXZ0Lm9uY2UpIHtcbiAgICAgICAgICAgICAgICAvLyBjaGVjayB0aGF0IGNhbGxiYWNrIHN0aWxsIGV4aXN0cyBiZWNhdXNlIHVzZXIgbWF5IGhhdmUgdW5zdWJzY3JpYmVkXG4gICAgICAgICAgICAgICAgLy8gaW4gdGhlIGV2ZW50IGhhbmRsZXJcbiAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ0NhbGxiYWNrID0gdGhpcy5fY2FsbGJhY2tzW25hbWVdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZCA9IGV4aXN0aW5nQ2FsbGJhY2sgPyBleGlzdGluZ0NhbGxiYWNrLmluZGV4T2YoZXZ0KSA6IC0xO1xuXG4gICAgICAgICAgICAgICAgaWYgKGluZCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID09PSBleGlzdGluZ0NhbGxiYWNrKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY2FsbGJhY2tBY3RpdmVbbmFtZV0gPSB0aGlzLl9jYWxsYmFja0FjdGl2ZVtuYW1lXS5zbGljZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrc1tuYW1lXS5zcGxpY2UoaW5kLCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWNhbGxiYWNrcylcbiAgICAgICAgICAgIHRoaXMuX2NhbGxiYWNrQWN0aXZlW25hbWVdID0gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRhY2ggYW4gZXZlbnQgaGFuZGxlciB0byBhbiBldmVudC4gVGhpcyBoYW5kbGVyIHdpbGwgYmUgcmVtb3ZlZCBhZnRlciBiZWluZyBmaXJlZCBvbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBOYW1lIG9mIHRoZSBldmVudCB0byBiaW5kIHRoZSBjYWxsYmFjayB0by5cbiAgICAgKiBAcGFyYW0ge0hhbmRsZUV2ZW50Q2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gdGhhdCBpcyBjYWxsZWQgd2hlbiBldmVudCBpcyBmaXJlZC4gTm90ZVxuICAgICAqIHRoZSBjYWxsYmFjayBpcyBsaW1pdGVkIHRvIDggYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbc2NvcGVdIC0gT2JqZWN0IHRvIHVzZSBhcyAndGhpcycgd2hlbiB0aGUgZXZlbnQgaXMgZmlyZWQsIGRlZmF1bHRzIHRvXG4gICAgICogY3VycmVudCB0aGlzLlxuICAgICAqIEByZXR1cm5zIHtFdmVudEhhbmRsZXJ9IFNlbGYgZm9yIGNoYWluaW5nLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogb2JqLm9uY2UoJ3Rlc3QnLCBmdW5jdGlvbiAoYSwgYikge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhhICsgYik7XG4gICAgICogfSk7XG4gICAgICogb2JqLmZpcmUoJ3Rlc3QnLCAxLCAyKTsgLy8gcHJpbnRzIDMgdG8gdGhlIGNvbnNvbGVcbiAgICAgKiBvYmouZmlyZSgndGVzdCcsIDEsIDIpOyAvLyBub3QgZ29pbmcgdG8gZ2V0IGhhbmRsZWRcbiAgICAgKi9cbiAgICBvbmNlKG5hbWUsIGNhbGxiYWNrLCBzY29wZSkge1xuICAgICAgICB0aGlzLl9hZGRDYWxsYmFjayhuYW1lLCBjYWxsYmFjaywgc2NvcGUsIHRydWUpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUZXN0IGlmIHRoZXJlIGFyZSBhbnkgaGFuZGxlcnMgYm91bmQgdG8gYW4gZXZlbnQgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIGV2ZW50IHRvIHRlc3QuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIG9iamVjdCBoYXMgaGFuZGxlcnMgYm91bmQgdG8gdGhlIHNwZWNpZmllZCBldmVudCBuYW1lLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogb2JqLm9uKCd0ZXN0JywgZnVuY3Rpb24gKCkgeyB9KTsgLy8gYmluZCBhbiBldmVudCB0byAndGVzdCdcbiAgICAgKiBvYmouaGFzRXZlbnQoJ3Rlc3QnKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogb2JqLmhhc0V2ZW50KCdoZWxsbycpOyAvLyByZXR1cm5zIGZhbHNlXG4gICAgICovXG4gICAgaGFzRXZlbnQobmFtZSkge1xuICAgICAgICByZXR1cm4gKHRoaXMuX2NhbGxiYWNrc1tuYW1lXSAmJiB0aGlzLl9jYWxsYmFja3NbbmFtZV0ubGVuZ3RoICE9PSAwKSB8fCBmYWxzZTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEV2ZW50SGFuZGxlciB9O1xuIl0sIm5hbWVzIjpbIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiX2NhbGxiYWNrcyIsIl9jYWxsYmFja0FjdGl2ZSIsImluaXRFdmVudEhhbmRsZXIiLCJfYWRkQ2FsbGJhY2siLCJuYW1lIiwiY2FsbGJhY2siLCJzY29wZSIsIm9uY2UiLCJzbGljZSIsInB1c2giLCJvbiIsIm9mZiIsImtleSIsImV2ZW50cyIsImNvdW50IiwibGVuZ3RoIiwiaSIsImZpcmUiLCJhcmcxIiwiYXJnMiIsImFyZzMiLCJhcmc0IiwiYXJnNSIsImFyZzYiLCJhcmc3IiwiYXJnOCIsImNhbGxiYWNrcyIsImV2dCIsImNhbGwiLCJleGlzdGluZ0NhbGxiYWNrIiwiaW5kIiwiaW5kZXhPZiIsInNwbGljZSIsImhhc0V2ZW50Il0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxZQUFZLENBQUM7RUFBQUMsV0FBQSxHQUFBO0FBQ2Y7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxVQUFVLEdBQUcsRUFBRSxDQUFBO0FBRWY7QUFDSjtBQUNBO0FBQ0E7SUFISSxJQUlBQyxDQUFBQSxlQUFlLEdBQUcsRUFBRSxDQUFBO0FBQUEsR0FBQTtBQUVwQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLGdCQUFnQkEsR0FBRztBQUNmLElBQUEsSUFBSSxDQUFDRixVQUFVLEdBQUcsRUFBRSxDQUFBO0FBQ3BCLElBQUEsSUFBSSxDQUFDQyxlQUFlLEdBQUcsRUFBRSxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJRSxZQUFZQSxDQUFDQyxJQUFJLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFQyxJQUFJLEdBQUcsS0FBSyxFQUFFO0lBQzlDLElBQUksQ0FBQ0gsSUFBSSxJQUFJLE9BQU9BLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQ0MsUUFBUSxFQUM5QyxPQUFBO0FBRUosSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDTCxVQUFVLENBQUNJLElBQUksQ0FBQyxFQUN0QixJQUFJLENBQUNKLFVBQVUsQ0FBQ0ksSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFBO0FBRTlCLElBQUEsSUFBSSxJQUFJLENBQUNILGVBQWUsQ0FBQ0csSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDSCxlQUFlLENBQUNHLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQ0osVUFBVSxDQUFDSSxJQUFJLENBQUMsRUFDbEYsSUFBSSxDQUFDSCxlQUFlLENBQUNHLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQ0gsZUFBZSxDQUFDRyxJQUFJLENBQUMsQ0FBQ0ksS0FBSyxFQUFFLENBQUE7QUFFbkUsSUFBQSxJQUFJLENBQUNSLFVBQVUsQ0FBQ0ksSUFBSSxDQUFDLENBQUNLLElBQUksQ0FBQztBQUN2QkosTUFBQUEsUUFBUSxFQUFFQSxRQUFRO01BQ2xCQyxLQUFLLEVBQUVBLEtBQUssSUFBSSxJQUFJO0FBQ3BCQyxNQUFBQSxJQUFJLEVBQUVBLElBQUFBO0FBQ1YsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJRyxFQUFBQSxFQUFFQSxDQUFDTixJQUFJLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFO0lBQ3RCLElBQUksQ0FBQ0gsWUFBWSxDQUFDQyxJQUFJLEVBQUVDLFFBQVEsRUFBRUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFBO0FBRS9DLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lLLEVBQUFBLEdBQUdBLENBQUNQLElBQUksRUFBRUMsUUFBUSxFQUFFQyxLQUFLLEVBQUU7QUFDdkIsSUFBQSxJQUFJRixJQUFJLEVBQUU7QUFDTixNQUFBLElBQUksSUFBSSxDQUFDSCxlQUFlLENBQUNHLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQ0gsZUFBZSxDQUFDRyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUNKLFVBQVUsQ0FBQ0ksSUFBSSxDQUFDLEVBQ2xGLElBQUksQ0FBQ0gsZUFBZSxDQUFDRyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUNILGVBQWUsQ0FBQ0csSUFBSSxDQUFDLENBQUNJLEtBQUssRUFBRSxDQUFBO0FBQ3ZFLEtBQUMsTUFBTTtBQUNILE1BQUEsS0FBSyxNQUFNSSxHQUFHLElBQUksSUFBSSxDQUFDWCxlQUFlLEVBQUU7QUFDcEMsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDRCxVQUFVLENBQUNZLEdBQUcsQ0FBQyxFQUNyQixTQUFBO0FBRUosUUFBQSxJQUFJLElBQUksQ0FBQ1osVUFBVSxDQUFDWSxHQUFHLENBQUMsS0FBSyxJQUFJLENBQUNYLGVBQWUsQ0FBQ1csR0FBRyxDQUFDLEVBQ2xELFNBQUE7QUFFSixRQUFBLElBQUksQ0FBQ1gsZUFBZSxDQUFDVyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUNYLGVBQWUsQ0FBQ1csR0FBRyxDQUFDLENBQUNKLEtBQUssRUFBRSxDQUFBO0FBQ2pFLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSSxDQUFDSixJQUFJLEVBQUU7QUFDUCxNQUFBLElBQUksQ0FBQ0osVUFBVSxHQUFHLEVBQUcsQ0FBQTtBQUN6QixLQUFDLE1BQU0sSUFBSSxDQUFDSyxRQUFRLEVBQUU7QUFDbEIsTUFBQSxJQUFJLElBQUksQ0FBQ0wsVUFBVSxDQUFDSSxJQUFJLENBQUMsRUFDckIsSUFBSSxDQUFDSixVQUFVLENBQUNJLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQTtBQUNsQyxLQUFDLE1BQU07QUFDSCxNQUFBLE1BQU1TLE1BQU0sR0FBRyxJQUFJLENBQUNiLFVBQVUsQ0FBQ0ksSUFBSSxDQUFDLENBQUE7QUFDcEMsTUFBQSxJQUFJLENBQUNTLE1BQU0sRUFDUCxPQUFPLElBQUksQ0FBQTtBQUVmLE1BQUEsSUFBSUMsS0FBSyxHQUFHRCxNQUFNLENBQUNFLE1BQU0sQ0FBQTtNQUV6QixLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0YsS0FBSyxFQUFFRSxDQUFDLEVBQUUsRUFBRTtRQUM1QixJQUFJSCxNQUFNLENBQUNHLENBQUMsQ0FBQyxDQUFDWCxRQUFRLEtBQUtBLFFBQVEsRUFDL0IsU0FBQTtRQUVKLElBQUlDLEtBQUssSUFBSU8sTUFBTSxDQUFDRyxDQUFDLENBQUMsQ0FBQ1YsS0FBSyxLQUFLQSxLQUFLLEVBQ2xDLFNBQUE7UUFFSk8sTUFBTSxDQUFDRyxDQUFDLEVBQUUsQ0FBQyxHQUFHSCxNQUFNLENBQUMsRUFBRUMsS0FBSyxDQUFDLENBQUE7QUFDakMsT0FBQTtNQUNBRCxNQUFNLENBQUNFLE1BQU0sR0FBR0QsS0FBSyxDQUFBO0FBQ3pCLEtBQUE7QUFFQSxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJRyxFQUFBQSxJQUFJQSxDQUFDYixJQUFJLEVBQUVjLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFO0FBQ3ZELElBQUEsSUFBSSxDQUFDckIsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDSixVQUFVLENBQUNJLElBQUksQ0FBQyxFQUMvQixPQUFPLElBQUksQ0FBQTtBQUVmLElBQUEsSUFBSXNCLFNBQVMsQ0FBQTtBQUViLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3pCLGVBQWUsQ0FBQ0csSUFBSSxDQUFDLEVBQUU7TUFDN0IsSUFBSSxDQUFDSCxlQUFlLENBQUNHLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQ0osVUFBVSxDQUFDSSxJQUFJLENBQUMsQ0FBQTtBQUN0RCxLQUFDLE1BQU07QUFDSCxNQUFBLElBQUksSUFBSSxDQUFDSCxlQUFlLENBQUNHLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQ0osVUFBVSxDQUFDSSxJQUFJLENBQUMsRUFDcEQsSUFBSSxDQUFDSCxlQUFlLENBQUNHLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQ0gsZUFBZSxDQUFDRyxJQUFJLENBQUMsQ0FBQ0ksS0FBSyxFQUFFLENBQUE7TUFFbkVrQixTQUFTLEdBQUcsSUFBSSxDQUFDMUIsVUFBVSxDQUFDSSxJQUFJLENBQUMsQ0FBQ0ksS0FBSyxFQUFFLENBQUE7QUFDN0MsS0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUEsS0FBSyxJQUFJUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUNVLFNBQVMsSUFBSSxJQUFJLENBQUN6QixlQUFlLENBQUNHLElBQUksQ0FBQyxLQUFNWSxDQUFDLEdBQUcsQ0FBQ1UsU0FBUyxJQUFJLElBQUksQ0FBQ3pCLGVBQWUsQ0FBQ0csSUFBSSxDQUFDLEVBQUVXLE1BQU8sRUFBRUMsQ0FBQyxFQUFFLEVBQUU7QUFDdEgsTUFBQSxNQUFNVyxHQUFHLEdBQUcsQ0FBQ0QsU0FBUyxJQUFJLElBQUksQ0FBQ3pCLGVBQWUsQ0FBQ0csSUFBSSxDQUFDLEVBQUVZLENBQUMsQ0FBQyxDQUFBO01BQ3hEVyxHQUFHLENBQUN0QixRQUFRLENBQUN1QixJQUFJLENBQUNELEdBQUcsQ0FBQ3JCLEtBQUssRUFBRVksSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFQyxJQUFJLENBQUMsQ0FBQTtNQUU1RSxJQUFJRSxHQUFHLENBQUNwQixJQUFJLEVBQUU7QUFDVjtBQUNBO0FBQ0EsUUFBQSxNQUFNc0IsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDN0IsVUFBVSxDQUFDSSxJQUFJLENBQUMsQ0FBQTtBQUM5QyxRQUFBLE1BQU0wQixHQUFHLEdBQUdELGdCQUFnQixHQUFHQSxnQkFBZ0IsQ0FBQ0UsT0FBTyxDQUFDSixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUVqRSxRQUFBLElBQUlHLEdBQUcsS0FBSyxDQUFDLENBQUMsRUFBRTtVQUNaLElBQUksSUFBSSxDQUFDN0IsZUFBZSxDQUFDRyxJQUFJLENBQUMsS0FBS3lCLGdCQUFnQixFQUMvQyxJQUFJLENBQUM1QixlQUFlLENBQUNHLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQ0gsZUFBZSxDQUFDRyxJQUFJLENBQUMsQ0FBQ0ksS0FBSyxFQUFFLENBQUE7VUFFbkUsSUFBSSxDQUFDUixVQUFVLENBQUNJLElBQUksQ0FBQyxDQUFDNEIsTUFBTSxDQUFDRixHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDeEMsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSSxDQUFDSixTQUFTLEVBQ1YsSUFBSSxDQUFDekIsZUFBZSxDQUFDRyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUE7QUFFckMsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUcsRUFBQUEsSUFBSUEsQ0FBQ0gsSUFBSSxFQUFFQyxRQUFRLEVBQUVDLEtBQUssRUFBRTtJQUN4QixJQUFJLENBQUNILFlBQVksQ0FBQ0MsSUFBSSxFQUFFQyxRQUFRLEVBQUVDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUM5QyxJQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJMkIsUUFBUUEsQ0FBQzdCLElBQUksRUFBRTtBQUNYLElBQUEsT0FBUSxJQUFJLENBQUNKLFVBQVUsQ0FBQ0ksSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDSixVQUFVLENBQUNJLElBQUksQ0FBQyxDQUFDVyxNQUFNLEtBQUssQ0FBQyxJQUFLLEtBQUssQ0FBQTtBQUNqRixHQUFBO0FBQ0o7Ozs7In0=
