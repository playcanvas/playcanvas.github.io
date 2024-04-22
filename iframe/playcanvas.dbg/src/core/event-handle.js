import { Debug } from './debug.js';

/**
 * Event Handle that is created by {@link EventHandler} and can be used for easier event removal and management.
 * @example
 * const evt = obj.on('test', (a, b) => {
 *     console.log(a + b);
 * });
 * obj.fire('test');
 *
 * evt.off(); // easy way to remove this event
 * obj.fire('test'); // this will not trigger an event
 * @example
 * // store an array of event handles
 * let events = [ ];
 *
 * events.push(objA.on('testA', () => { }));
 * events.push(objB.on('testB', () => { }));
 *
 * // when needed, remove all events
 * events.forEach((evt) => {
 *     evt.off();
 * });
 * events = [ ];
 */
class EventHandle {
  /**
   * @param {import('./event-handler.js').EventHandler} handler - source object of the event.
   * @param {string} name - Name of the event.
   * @param {import('./event-handler.js').HandleEventCallback} callback - Function that is called when event is fired.
   * @param {object} scope - Object that is used as `this` when event is fired.
   * @param {boolean} [once] - If this is a single event and will be removed after event is fired.
   */
  constructor(handler, name, callback, scope, once = false) {
    /**
     * @type {import('./event-handler.js').EventHandler}
     * @private
     */
    this.handler = void 0;
    /**
     * @type {string}
     * @private
     */
    this.name = void 0;
    /**
     * @type {import('./event-handler.js').HandleEventCallback}
     * @ignore
     */
    this.callback = void 0;
    /**
     * @type {object}
     * @ignore
     */
    this.scope = void 0;
    /**
     * @type {boolean}
     * @ignore
     */
    this._once = void 0;
    /**
     * True if event has been removed.
     * @type {boolean}
     * @private
     */
    this._removed = false;
    this.handler = handler;
    this.name = name;
    this.callback = callback;
    this.scope = scope;
    this._once = once;
  }

  /**
   * Remove this event from its handler.
   */
  off() {
    if (this._removed) return;
    this.handler.off(this.name, this.callback, this.scope);
  }
  on(name, callback, scope = this) {
    Debug.deprecated('Using chaining with EventHandler.on is deprecated, subscribe to an event from EventHandler directly instead.');
    return this.handler._addCallback(name, callback, scope, false);
  }
  once(name, callback, scope = this) {
    Debug.deprecated('Using chaining with EventHandler.once is deprecated, subscribe to an event from EventHandler directly instead.');
    return this.handler._addCallback(name, callback, scope, true);
  }

  /**
   * Mark if event has been removed.
   * @type {boolean}
   * @ignore
   */
  set removed(value) {
    if (!value) return;
    this._removed = true;
  }

  /**
   * True if event has been removed.
   * @type {boolean}
   */
  get removed() {
    return this._removed;
  }
}

export { EventHandle };
