import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { SCRIPT_INITIALIZE, SCRIPT_POST_INITIALIZE } from './constants.js';
import { ScriptAttributes } from './script-attributes.js';

const funcNameRegex = new RegExp('^\\s*function(?:\\s|\\s*\\/\\*.*\\*\\/\\s*)+([^\\(\\s\\/]*)\\s*');

/**
 * Represents the type of a script. It is returned by {@link createScript}. Also referred to as
 * Script Type.
 *
 * The type is to be extended using its JavaScript prototype. There is a list of methods that will
 * be executed by the engine on instances of this type, such as:
 *
 * - `initialize`
 * - `postInitialize`
 * - `update`
 * - `postUpdate`
 * - `swap`
 *
 * `initialize` and `postInitialize` - are called (if defined) when a script is about to run for
 * the first time - `postInitialize` will run after all `initialize` methods are executed in the
 * same tick or enabling chain of actions.
 *
 * `update` and `postUpdate` - are called (if defined) for enabled (running state) scripts on each
 * tick.
 *
 * `swap` - is called when a ScriptType that already exists in the registry gets redefined. If the
 * new ScriptType has a `swap` method in its prototype, then it will be executed to perform hot-
 * reload at runtime.
 *
 * @augments EventHandler
 */
class ScriptType extends EventHandler {
  /**
   * Create a new ScriptType instance.
   *
   * @param {object} args - The input arguments object.
   * @param {import('../app-base.js').AppBase} args.app - The {@link AppBase} that is running the
   * script.
   * @param {import('../entity.js').Entity} args.entity - The {@link Entity} that the script is
   * attached to.
   */
  constructor(args) {
    super();
    /**
     * The {@link AppBase} that the instance of this type belongs to.
     *
     * @type {import('../app-base.js').AppBase}
     */
    this.app = void 0;
    /**
     * The {@link Entity} that the instance of this type belongs to.
     *
     * @type {import('../entity.js').Entity}
     */
    this.entity = void 0;
    /** @private */
    this._enabled = void 0;
    /** @private */
    this._enabledOld = void 0;
    /** @private */
    this._initialized = void 0;
    /** @private */
    this._postInitialized = void 0;
    /** @private */
    this.__destroyed = void 0;
    /** @private */
    this.__attributes = void 0;
    /** @private */
    this.__attributesRaw = void 0;
    /** @private */
    this.__scriptType = void 0;
    /**
     * The order in the script component that the methods of this script instance will run
     * relative to other script instances in the component.
     *
     * @type {number}
     * @private
     */
    this.__executionOrder = void 0;
    this.initScriptType(args);
  }

  /**
   * Fired when a script instance becomes enabled.
   *
   * @event ScriptType#enable
   * @example
   * PlayerController.prototype.initialize = function () {
   *     this.on('enable', function () {
   *         // Script Instance is now enabled
   *     });
   * };
   */

  /**
   * Fired when a script instance becomes disabled.
   *
   * @event ScriptType#disable
   * @example
   * PlayerController.prototype.initialize = function () {
   *     this.on('disable', function () {
   *         // Script Instance is now disabled
   *     });
   * };
   */

  /**
   * Fired when a script instance changes state to enabled or disabled.
   *
   * @event ScriptType#state
   * @param {boolean} enabled - True if now enabled, False if disabled.
   * @example
   * PlayerController.prototype.initialize = function () {
   *     this.on('state', function (enabled) {
   *         console.log('Script Instance is now ' + (enabled ? 'enabled' : 'disabled'));
   *     });
   * };
   */

  /**
   * Fired when a script instance is destroyed and removed from component.
   *
   * @event ScriptType#destroy
   * @example
   * PlayerController.prototype.initialize = function () {
   *     this.on('destroy', function () {
   *         // no more part of an entity
   *         // good place to cleanup entity from destroyed script
   *     });
   * };
   */

  /**
   * Fired when any script attribute has been changed.
   *
   * @event ScriptType#attr
   * @param {string} name - Name of attribute.
   * @param {object} value - New value.
   * @param {object} valueOld - Old value.
   * @example
   * PlayerController.prototype.initialize = function () {
   *     this.on('attr', function (name, value, valueOld) {
   *         console.log(name + ' been changed from ' + valueOld + ' to ' + value);
   *     });
   * };
   */

  /**
   * Fired when a specific script attribute has been changed.
   *
   * @event ScriptType#attr:[name]
   * @param {object} value - New value.
   * @param {object} valueOld - Old value.
   * @example
   * PlayerController.prototype.initialize = function () {
   *     this.on('attr:speed', function (value, valueOld) {
   *         console.log('speed been changed from ' + valueOld + ' to ' + value);
   *     });
   * };
   */

  /**
   * Fired when a script instance had an exception. The script instance will be automatically
   * disabled.
   *
   * @event ScriptType#error
   * @param {Error} err - Native JavaScript Error object with details of error.
   * @param {string} method - The method of the script instance that the exception originated from.
   * @example
   * PlayerController.prototype.initialize = function () {
   *     this.on('error', function (err, method) {
   *         // caught an exception
   *         console.log(err.stack);
   *     });
   * };
   */

  /**
   * True if the instance of this type is in running state. False when script is not running,
   * because the Entity or any of its parents are disabled or the {@link ScriptComponent} is
   * disabled or the Script Instance is disabled. When disabled no update methods will be called
   * on each tick. initialize and postInitialize methods will run once when the script instance
   * is in `enabled` state during app tick.
   *
   * @type {boolean}
   */
  set enabled(value) {
    this._enabled = !!value;
    if (this.enabled === this._enabledOld) return;
    this._enabledOld = this.enabled;
    this.fire(this.enabled ? 'enable' : 'disable');
    this.fire('state', this.enabled);

    // initialize script if not initialized yet and script is enabled
    if (!this._initialized && this.enabled) {
      this._initialized = true;
      this.__initializeAttributes(true);
      if (this.initialize) this.entity.script._scriptMethod(this, SCRIPT_INITIALIZE);
    }

    // post initialize script if not post initialized yet and still enabled
    // (initialize might have disabled the script so check this.enabled again)
    // Warning: Do not do this if the script component is currently being enabled
    // because in this case post initialize must be called after all the scripts
    // in the script component have been initialized first
    if (this._initialized && !this._postInitialized && this.enabled && !this.entity.script._beingEnabled) {
      this._postInitialized = true;
      if (this.postInitialize) this.entity.script._scriptMethod(this, SCRIPT_POST_INITIALIZE);
    }
  }
  get enabled() {
    return this._enabled && !this._destroyed && this.entity.script.enabled && this.entity.enabled;
  }

  /**
   * @param {{entity: import('../entity.js').Entity, app: import('../app-base.js').AppBase}} args -
   * The entity and app.
   * @private
   */
  initScriptType(args) {
    const script = this.constructor; // get script type, i.e. function (class)
    Debug.assert(args && args.app && args.entity, `script [${script.__name}] has missing arguments in constructor`);
    this.app = args.app;
    this.entity = args.entity;
    this._enabled = typeof args.enabled === 'boolean' ? args.enabled : true;
    this._enabledOld = this.enabled;
    this.__destroyed = false;
    this.__attributes = {};
    this.__attributesRaw = args.attributes || {}; // need at least an empty object to make sure default attributes are initialized
    this.__scriptType = script;
    this.__executionOrder = -1;
  }

  /**
   * Name of a Script Type.
   *
   * @type {string}
   * @private
   */

  // Will be assigned when calling createScript or registerScript.
  /**
   * @param {*} constructorFn - The constructor function of the script type.
   * @returns {string} The script name.
   * @private
   */
  static __getScriptName(constructorFn) {
    if (typeof constructorFn !== 'function') return undefined;
    if ('name' in Function.prototype) return constructorFn.name;
    if (constructorFn === Function || constructorFn === Function.prototype.constructor) return 'Function';
    const match = ('' + constructorFn).match(funcNameRegex);
    return match ? match[1] : undefined;
  }

  /**
   * Name of a Script Type.
   *
   * @type {string|null}
   */
  static get scriptName() {
    return this.__name;
  }

  /**
   * The interface to define attributes for Script Types. Refer to {@link ScriptAttributes}.
   *
   * @type {ScriptAttributes}
   * @example
   * var PlayerController = pc.createScript('playerController');
   *
   * PlayerController.attributes.add('speed', {
   *     type: 'number',
   *     title: 'Speed',
   *     placeholder: 'km/h',
   *     default: 22.2
   * });
   */
  static get attributes() {
    if (!this.hasOwnProperty('__attributes')) this.__attributes = new ScriptAttributes(this);
    return this.__attributes;
  }

  /**
   * @param {boolean} [force] - Set to true to force initialization of the attributes.
   * @private
   */
  __initializeAttributes(force) {
    if (!force && !this.__attributesRaw) return;

    // set attributes values
    for (const key in this.__scriptType.attributes.index) {
      if (this.__attributesRaw && this.__attributesRaw.hasOwnProperty(key)) {
        this[key] = this.__attributesRaw[key];
      } else if (!this.__attributes.hasOwnProperty(key)) {
        if (this.__scriptType.attributes.index[key].hasOwnProperty('default')) {
          this[key] = this.__scriptType.attributes.index[key].default;
        } else {
          this[key] = null;
        }
      }
    }
    this.__attributesRaw = null;
  }

  /**
   * Shorthand function to extend Script Type prototype with list of methods.
   *
   * @param {object} methods - Object with methods, where key - is name of method, and value - is function.
   * @example
   * var PlayerController = pc.createScript('playerController');
   *
   * PlayerController.extend({
   *     initialize: function () {
   *         // called once on initialize
   *     },
   *     update: function (dt) {
   *         // called each tick
   *     }
   * });
   */
  static extend(methods) {
    for (const key in methods) {
      if (!methods.hasOwnProperty(key)) continue;
      this.prototype[key] = methods[key];
    }
  }

  /**
   * @function
   * @name ScriptType#[initialize]
   * @description Called when script is about to run for the first time.
   */

  /**
   * @function
   * @name ScriptType#[postInitialize]
   * @description Called after all initialize methods are executed in the same tick or enabling chain of actions.
   */

  /**
   * @function
   * @name ScriptType#[update]
   * @description Called for enabled (running state) scripts on each tick.
   * @param {number} dt - The delta time in seconds since the last frame.
   */

  /**
   * @function
   * @name ScriptType#[postUpdate]
   * @description Called for enabled (running state) scripts on each tick, after update.
   * @param {number} dt - The delta time in seconds since the last frame.
   */

  /**
   * @function
   * @name ScriptType#[swap]
   * @description Called when a ScriptType that already exists in the registry
   * gets redefined. If the new ScriptType has a `swap` method in its prototype,
   * then it will be executed to perform hot-reload at runtime.
   * @param {ScriptType} old - Old instance of the scriptType to copy data to the new instance.
   */
}
ScriptType.__name = null;

export { ScriptType };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0LXR5cGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvc2NyaXB0L3NjcmlwdC10eXBlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBTQ1JJUFRfSU5JVElBTElaRSwgU0NSSVBUX1BPU1RfSU5JVElBTElaRSB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNjcmlwdEF0dHJpYnV0ZXMgfSBmcm9tICcuL3NjcmlwdC1hdHRyaWJ1dGVzLmpzJztcblxuY29uc3QgZnVuY05hbWVSZWdleCA9IG5ldyBSZWdFeHAoJ15cXFxccypmdW5jdGlvbig/OlxcXFxzfFxcXFxzKlxcXFwvXFxcXCouKlxcXFwqXFxcXC9cXFxccyopKyhbXlxcXFwoXFxcXHNcXFxcL10qKVxcXFxzKicpO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHR5cGUgb2YgYSBzY3JpcHQuIEl0IGlzIHJldHVybmVkIGJ5IHtAbGluayBjcmVhdGVTY3JpcHR9LiBBbHNvIHJlZmVycmVkIHRvIGFzXG4gKiBTY3JpcHQgVHlwZS5cbiAqXG4gKiBUaGUgdHlwZSBpcyB0byBiZSBleHRlbmRlZCB1c2luZyBpdHMgSmF2YVNjcmlwdCBwcm90b3R5cGUuIFRoZXJlIGlzIGEgbGlzdCBvZiBtZXRob2RzIHRoYXQgd2lsbFxuICogYmUgZXhlY3V0ZWQgYnkgdGhlIGVuZ2luZSBvbiBpbnN0YW5jZXMgb2YgdGhpcyB0eXBlLCBzdWNoIGFzOlxuICpcbiAqIC0gYGluaXRpYWxpemVgXG4gKiAtIGBwb3N0SW5pdGlhbGl6ZWBcbiAqIC0gYHVwZGF0ZWBcbiAqIC0gYHBvc3RVcGRhdGVgXG4gKiAtIGBzd2FwYFxuICpcbiAqIGBpbml0aWFsaXplYCBhbmQgYHBvc3RJbml0aWFsaXplYCAtIGFyZSBjYWxsZWQgKGlmIGRlZmluZWQpIHdoZW4gYSBzY3JpcHQgaXMgYWJvdXQgdG8gcnVuIGZvclxuICogdGhlIGZpcnN0IHRpbWUgLSBgcG9zdEluaXRpYWxpemVgIHdpbGwgcnVuIGFmdGVyIGFsbCBgaW5pdGlhbGl6ZWAgbWV0aG9kcyBhcmUgZXhlY3V0ZWQgaW4gdGhlXG4gKiBzYW1lIHRpY2sgb3IgZW5hYmxpbmcgY2hhaW4gb2YgYWN0aW9ucy5cbiAqXG4gKiBgdXBkYXRlYCBhbmQgYHBvc3RVcGRhdGVgIC0gYXJlIGNhbGxlZCAoaWYgZGVmaW5lZCkgZm9yIGVuYWJsZWQgKHJ1bm5pbmcgc3RhdGUpIHNjcmlwdHMgb24gZWFjaFxuICogdGljay5cbiAqXG4gKiBgc3dhcGAgLSBpcyBjYWxsZWQgd2hlbiBhIFNjcmlwdFR5cGUgdGhhdCBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgcmVnaXN0cnkgZ2V0cyByZWRlZmluZWQuIElmIHRoZVxuICogbmV3IFNjcmlwdFR5cGUgaGFzIGEgYHN3YXBgIG1ldGhvZCBpbiBpdHMgcHJvdG90eXBlLCB0aGVuIGl0IHdpbGwgYmUgZXhlY3V0ZWQgdG8gcGVyZm9ybSBob3QtXG4gKiByZWxvYWQgYXQgcnVudGltZS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIFNjcmlwdFR5cGUgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIFRoZSB7QGxpbmsgQXBwQmFzZX0gdGhhdCB0aGUgaW5zdGFuY2Ugb2YgdGhpcyB0eXBlIGJlbG9uZ3MgdG8uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9XG4gICAgICovXG4gICAgYXBwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHtAbGluayBFbnRpdHl9IHRoYXQgdGhlIGluc3RhbmNlIG9mIHRoaXMgdHlwZSBiZWxvbmdzIHRvLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vZW50aXR5LmpzJykuRW50aXR5fVxuICAgICAqL1xuICAgIGVudGl0eTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9lbmFibGVkO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2VuYWJsZWRPbGQ7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfaW5pdGlhbGl6ZWQ7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfcG9zdEluaXRpYWxpemVkO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX19kZXN0cm95ZWQ7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfX2F0dHJpYnV0ZXM7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfX2F0dHJpYnV0ZXNSYXc7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfX3NjcmlwdFR5cGU7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgb3JkZXIgaW4gdGhlIHNjcmlwdCBjb21wb25lbnQgdGhhdCB0aGUgbWV0aG9kcyBvZiB0aGlzIHNjcmlwdCBpbnN0YW5jZSB3aWxsIHJ1blxuICAgICAqIHJlbGF0aXZlIHRvIG90aGVyIHNjcmlwdCBpbnN0YW5jZXMgaW4gdGhlIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfX2V4ZWN1dGlvbk9yZGVyO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjcmlwdFR5cGUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gYXJncyAtIFRoZSBpbnB1dCBhcmd1bWVudHMgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFyZ3MuYXBwIC0gVGhlIHtAbGluayBBcHBCYXNlfSB0aGF0IGlzIHJ1bm5pbmcgdGhlXG4gICAgICogc2NyaXB0LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9lbnRpdHkuanMnKS5FbnRpdHl9IGFyZ3MuZW50aXR5IC0gVGhlIHtAbGluayBFbnRpdHl9IHRoYXQgdGhlIHNjcmlwdCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFyZ3MpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5pbml0U2NyaXB0VHlwZShhcmdzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGJlY29tZXMgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRUeXBlI2VuYWJsZVxuICAgICAqIEBleGFtcGxlXG4gICAgICogUGxheWVyQ29udHJvbGxlci5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgdGhpcy5vbignZW5hYmxlJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAgICAgLy8gU2NyaXB0IEluc3RhbmNlIGlzIG5vdyBlbmFibGVkXG4gICAgICogICAgIH0pO1xuICAgICAqIH07XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgc2NyaXB0IGluc3RhbmNlIGJlY29tZXMgZGlzYWJsZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0VHlwZSNkaXNhYmxlXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAqICAgICB0aGlzLm9uKCdkaXNhYmxlJywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAgICAgLy8gU2NyaXB0IEluc3RhbmNlIGlzIG5vdyBkaXNhYmxlZFxuICAgICAqICAgICB9KTtcbiAgICAgKiB9O1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBjaGFuZ2VzIHN0YXRlIHRvIGVuYWJsZWQgb3IgZGlzYWJsZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0VHlwZSNzdGF0ZVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZW5hYmxlZCAtIFRydWUgaWYgbm93IGVuYWJsZWQsIEZhbHNlIGlmIGRpc2FibGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogUGxheWVyQ29udHJvbGxlci5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgKiAgICAgdGhpcy5vbignc3RhdGUnLCBmdW5jdGlvbiAoZW5hYmxlZCkge1xuICAgICAqICAgICAgICAgY29uc29sZS5sb2coJ1NjcmlwdCBJbnN0YW5jZSBpcyBub3cgJyArIChlbmFibGVkID8gJ2VuYWJsZWQnIDogJ2Rpc2FibGVkJykpO1xuICAgICAqICAgICB9KTtcbiAgICAgKiB9O1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBpcyBkZXN0cm95ZWQgYW5kIHJlbW92ZWQgZnJvbSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NyaXB0VHlwZSNkZXN0cm95XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAqICAgICB0aGlzLm9uKCdkZXN0cm95JywgZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAgICAgLy8gbm8gbW9yZSBwYXJ0IG9mIGFuIGVudGl0eVxuICAgICAqICAgICAgICAgLy8gZ29vZCBwbGFjZSB0byBjbGVhbnVwIGVudGl0eSBmcm9tIGRlc3Ryb3llZCBzY3JpcHRcbiAgICAgKiAgICAgfSk7XG4gICAgICogfTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW55IHNjcmlwdCBhdHRyaWJ1dGUgaGFzIGJlZW4gY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRUeXBlI2F0dHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIE5hbWUgb2YgYXR0cmlidXRlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB2YWx1ZSAtIE5ldyB2YWx1ZS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gdmFsdWVPbGQgLSBPbGQgdmFsdWUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBQbGF5ZXJDb250cm9sbGVyLnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAqICAgICB0aGlzLm9uKCdhdHRyJywgZnVuY3Rpb24gKG5hbWUsIHZhbHVlLCB2YWx1ZU9sZCkge1xuICAgICAqICAgICAgICAgY29uc29sZS5sb2cobmFtZSArICcgYmVlbiBjaGFuZ2VkIGZyb20gJyArIHZhbHVlT2xkICsgJyB0byAnICsgdmFsdWUpO1xuICAgICAqICAgICB9KTtcbiAgICAgKiB9O1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNwZWNpZmljIHNjcmlwdCBhdHRyaWJ1dGUgaGFzIGJlZW4gY2hhbmdlZC5cbiAgICAgKlxuICAgICAqIEBldmVudCBTY3JpcHRUeXBlI2F0dHI6W25hbWVdXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHZhbHVlIC0gTmV3IHZhbHVlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB2YWx1ZU9sZCAtIE9sZCB2YWx1ZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIFBsYXllckNvbnRyb2xsZXIucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIHRoaXMub24oJ2F0dHI6c3BlZWQnLCBmdW5jdGlvbiAodmFsdWUsIHZhbHVlT2xkKSB7XG4gICAgICogICAgICAgICBjb25zb2xlLmxvZygnc3BlZWQgYmVlbiBjaGFuZ2VkIGZyb20gJyArIHZhbHVlT2xkICsgJyB0byAnICsgdmFsdWUpO1xuICAgICAqICAgICB9KTtcbiAgICAgKiB9O1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIHNjcmlwdCBpbnN0YW5jZSBoYWQgYW4gZXhjZXB0aW9uLiBUaGUgc2NyaXB0IGluc3RhbmNlIHdpbGwgYmUgYXV0b21hdGljYWxseVxuICAgICAqIGRpc2FibGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcmlwdFR5cGUjZXJyb3JcbiAgICAgKiBAcGFyYW0ge0Vycm9yfSBlcnIgLSBOYXRpdmUgSmF2YVNjcmlwdCBFcnJvciBvYmplY3Qgd2l0aCBkZXRhaWxzIG9mIGVycm9yLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXRob2QgLSBUaGUgbWV0aG9kIG9mIHRoZSBzY3JpcHQgaW5zdGFuY2UgdGhhdCB0aGUgZXhjZXB0aW9uIG9yaWdpbmF0ZWQgZnJvbS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIFBsYXllckNvbnRyb2xsZXIucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICogICAgIHRoaXMub24oJ2Vycm9yJywgZnVuY3Rpb24gKGVyciwgbWV0aG9kKSB7XG4gICAgICogICAgICAgICAvLyBjYXVnaHQgYW4gZXhjZXB0aW9uXG4gICAgICogICAgICAgICBjb25zb2xlLmxvZyhlcnIuc3RhY2spO1xuICAgICAqICAgICB9KTtcbiAgICAgKiB9O1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgaW5zdGFuY2Ugb2YgdGhpcyB0eXBlIGlzIGluIHJ1bm5pbmcgc3RhdGUuIEZhbHNlIHdoZW4gc2NyaXB0IGlzIG5vdCBydW5uaW5nLFxuICAgICAqIGJlY2F1c2UgdGhlIEVudGl0eSBvciBhbnkgb2YgaXRzIHBhcmVudHMgYXJlIGRpc2FibGVkIG9yIHRoZSB7QGxpbmsgU2NyaXB0Q29tcG9uZW50fSBpc1xuICAgICAqIGRpc2FibGVkIG9yIHRoZSBTY3JpcHQgSW5zdGFuY2UgaXMgZGlzYWJsZWQuIFdoZW4gZGlzYWJsZWQgbm8gdXBkYXRlIG1ldGhvZHMgd2lsbCBiZSBjYWxsZWRcbiAgICAgKiBvbiBlYWNoIHRpY2suIGluaXRpYWxpemUgYW5kIHBvc3RJbml0aWFsaXplIG1ldGhvZHMgd2lsbCBydW4gb25jZSB3aGVuIHRoZSBzY3JpcHQgaW5zdGFuY2VcbiAgICAgKiBpcyBpbiBgZW5hYmxlZGAgc3RhdGUgZHVyaW5nIGFwcCB0aWNrLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGVuYWJsZWQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9ICEhdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCA9PT0gdGhpcy5fZW5hYmxlZE9sZCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2VuYWJsZWRPbGQgPSB0aGlzLmVuYWJsZWQ7XG4gICAgICAgIHRoaXMuZmlyZSh0aGlzLmVuYWJsZWQgPyAnZW5hYmxlJyA6ICdkaXNhYmxlJyk7XG4gICAgICAgIHRoaXMuZmlyZSgnc3RhdGUnLCB0aGlzLmVuYWJsZWQpO1xuXG4gICAgICAgIC8vIGluaXRpYWxpemUgc2NyaXB0IGlmIG5vdCBpbml0aWFsaXplZCB5ZXQgYW5kIHNjcmlwdCBpcyBlbmFibGVkXG4gICAgICAgIGlmICghdGhpcy5faW5pdGlhbGl6ZWQgJiYgdGhpcy5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XG5cbiAgICAgICAgICAgIHRoaXMuX19pbml0aWFsaXplQXR0cmlidXRlcyh0cnVlKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaW5pdGlhbGl6ZSlcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5zY3JpcHQuX3NjcmlwdE1ldGhvZCh0aGlzLCBTQ1JJUFRfSU5JVElBTElaRSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwb3N0IGluaXRpYWxpemUgc2NyaXB0IGlmIG5vdCBwb3N0IGluaXRpYWxpemVkIHlldCBhbmQgc3RpbGwgZW5hYmxlZFxuICAgICAgICAvLyAoaW5pdGlhbGl6ZSBtaWdodCBoYXZlIGRpc2FibGVkIHRoZSBzY3JpcHQgc28gY2hlY2sgdGhpcy5lbmFibGVkIGFnYWluKVxuICAgICAgICAvLyBXYXJuaW5nOiBEbyBub3QgZG8gdGhpcyBpZiB0aGUgc2NyaXB0IGNvbXBvbmVudCBpcyBjdXJyZW50bHkgYmVpbmcgZW5hYmxlZFxuICAgICAgICAvLyBiZWNhdXNlIGluIHRoaXMgY2FzZSBwb3N0IGluaXRpYWxpemUgbXVzdCBiZSBjYWxsZWQgYWZ0ZXIgYWxsIHRoZSBzY3JpcHRzXG4gICAgICAgIC8vIGluIHRoZSBzY3JpcHQgY29tcG9uZW50IGhhdmUgYmVlbiBpbml0aWFsaXplZCBmaXJzdFxuICAgICAgICBpZiAodGhpcy5faW5pdGlhbGl6ZWQgJiYgIXRoaXMuX3Bvc3RJbml0aWFsaXplZCAmJiB0aGlzLmVuYWJsZWQgJiYgIXRoaXMuZW50aXR5LnNjcmlwdC5fYmVpbmdFbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9wb3N0SW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5wb3N0SW5pdGlhbGl6ZSlcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5zY3JpcHQuX3NjcmlwdE1ldGhvZCh0aGlzLCBTQ1JJUFRfUE9TVF9JTklUSUFMSVpFKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBlbmFibGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlZCAmJiAhdGhpcy5fZGVzdHJveWVkICYmIHRoaXMuZW50aXR5LnNjcmlwdC5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHt7ZW50aXR5OiBpbXBvcnQoJy4uL2VudGl0eS5qcycpLkVudGl0eSwgYXBwOiBpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX19IGFyZ3MgLVxuICAgICAqIFRoZSBlbnRpdHkgYW5kIGFwcC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGluaXRTY3JpcHRUeXBlKGFyZ3MpIHtcbiAgICAgICAgY29uc3Qgc2NyaXB0ID0gdGhpcy5jb25zdHJ1Y3RvcjsgLy8gZ2V0IHNjcmlwdCB0eXBlLCBpLmUuIGZ1bmN0aW9uIChjbGFzcylcbiAgICAgICAgRGVidWcuYXNzZXJ0KGFyZ3MgJiYgYXJncy5hcHAgJiYgYXJncy5lbnRpdHksIGBzY3JpcHQgWyR7c2NyaXB0Ll9fbmFtZX1dIGhhcyBtaXNzaW5nIGFyZ3VtZW50cyBpbiBjb25zdHJ1Y3RvcmApO1xuXG4gICAgICAgIHRoaXMuYXBwID0gYXJncy5hcHA7XG4gICAgICAgIHRoaXMuZW50aXR5ID0gYXJncy5lbnRpdHk7XG5cbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHR5cGVvZiBhcmdzLmVuYWJsZWQgPT09ICdib29sZWFuJyA/IGFyZ3MuZW5hYmxlZCA6IHRydWU7XG4gICAgICAgIHRoaXMuX2VuYWJsZWRPbGQgPSB0aGlzLmVuYWJsZWQ7XG5cbiAgICAgICAgdGhpcy5fX2Rlc3Ryb3llZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9fYXR0cmlidXRlcyA9IHsgfTtcbiAgICAgICAgdGhpcy5fX2F0dHJpYnV0ZXNSYXcgPSBhcmdzLmF0dHJpYnV0ZXMgfHwgeyB9OyAvLyBuZWVkIGF0IGxlYXN0IGFuIGVtcHR5IG9iamVjdCB0byBtYWtlIHN1cmUgZGVmYXVsdCBhdHRyaWJ1dGVzIGFyZSBpbml0aWFsaXplZFxuICAgICAgICB0aGlzLl9fc2NyaXB0VHlwZSA9IHNjcmlwdDtcbiAgICAgICAgdGhpcy5fX2V4ZWN1dGlvbk9yZGVyID0gLTE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTmFtZSBvZiBhIFNjcmlwdCBUeXBlLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHN0YXRpYyBfX25hbWUgPSBudWxsOyAvLyBXaWxsIGJlIGFzc2lnbmVkIHdoZW4gY2FsbGluZyBjcmVhdGVTY3JpcHQgb3IgcmVnaXN0ZXJTY3JpcHQuXG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0geyp9IGNvbnN0cnVjdG9yRm4gLSBUaGUgY29uc3RydWN0b3IgZnVuY3Rpb24gb2YgdGhlIHNjcmlwdCB0eXBlLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBzY3JpcHQgbmFtZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHN0YXRpYyBfX2dldFNjcmlwdE5hbWUoY29uc3RydWN0b3JGbikge1xuICAgICAgICBpZiAodHlwZW9mIGNvbnN0cnVjdG9yRm4gIT09ICdmdW5jdGlvbicpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIGlmICgnbmFtZScgaW4gRnVuY3Rpb24ucHJvdG90eXBlKSByZXR1cm4gY29uc3RydWN0b3JGbi5uYW1lO1xuICAgICAgICBpZiAoY29uc3RydWN0b3JGbiA9PT0gRnVuY3Rpb24gfHwgY29uc3RydWN0b3JGbiA9PT0gRnVuY3Rpb24ucHJvdG90eXBlLmNvbnN0cnVjdG9yKSByZXR1cm4gJ0Z1bmN0aW9uJztcbiAgICAgICAgY29uc3QgbWF0Y2ggPSAoJycgKyBjb25zdHJ1Y3RvckZuKS5tYXRjaChmdW5jTmFtZVJlZ2V4KTtcbiAgICAgICAgcmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0gOiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTmFtZSBvZiBhIFNjcmlwdCBUeXBlLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ3xudWxsfVxuICAgICAqL1xuICAgIHN0YXRpYyBnZXQgc2NyaXB0TmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX19uYW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBpbnRlcmZhY2UgdG8gZGVmaW5lIGF0dHJpYnV0ZXMgZm9yIFNjcmlwdCBUeXBlcy4gUmVmZXIgdG8ge0BsaW5rIFNjcmlwdEF0dHJpYnV0ZXN9LlxuICAgICAqXG4gICAgICogQHR5cGUge1NjcmlwdEF0dHJpYnV0ZXN9XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgUGxheWVyQ29udHJvbGxlciA9IHBjLmNyZWF0ZVNjcmlwdCgncGxheWVyQ29udHJvbGxlcicpO1xuICAgICAqXG4gICAgICogUGxheWVyQ29udHJvbGxlci5hdHRyaWJ1dGVzLmFkZCgnc3BlZWQnLCB7XG4gICAgICogICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAqICAgICB0aXRsZTogJ1NwZWVkJyxcbiAgICAgKiAgICAgcGxhY2Vob2xkZXI6ICdrbS9oJyxcbiAgICAgKiAgICAgZGVmYXVsdDogMjIuMlxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXRpYyBnZXQgYXR0cmlidXRlcygpIHtcbiAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KCdfX2F0dHJpYnV0ZXMnKSkgdGhpcy5fX2F0dHJpYnV0ZXMgPSBuZXcgU2NyaXB0QXR0cmlidXRlcyh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX19hdHRyaWJ1dGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2ZvcmNlXSAtIFNldCB0byB0cnVlIHRvIGZvcmNlIGluaXRpYWxpemF0aW9uIG9mIHRoZSBhdHRyaWJ1dGVzLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX19pbml0aWFsaXplQXR0cmlidXRlcyhmb3JjZSkge1xuICAgICAgICBpZiAoIWZvcmNlICYmICF0aGlzLl9fYXR0cmlidXRlc1JhdylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyBzZXQgYXR0cmlidXRlcyB2YWx1ZXNcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5fX3NjcmlwdFR5cGUuYXR0cmlidXRlcy5pbmRleCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX19hdHRyaWJ1dGVzUmF3ICYmIHRoaXMuX19hdHRyaWJ1dGVzUmF3Lmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICB0aGlzW2tleV0gPSB0aGlzLl9fYXR0cmlidXRlc1Jhd1trZXldO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghdGhpcy5fX2F0dHJpYnV0ZXMuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9fc2NyaXB0VHlwZS5hdHRyaWJ1dGVzLmluZGV4W2tleV0uaGFzT3duUHJvcGVydHkoJ2RlZmF1bHQnKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzW2tleV0gPSB0aGlzLl9fc2NyaXB0VHlwZS5hdHRyaWJ1dGVzLmluZGV4W2tleV0uZGVmYXVsdDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzW2tleV0gPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX19hdHRyaWJ1dGVzUmF3ID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaG9ydGhhbmQgZnVuY3Rpb24gdG8gZXh0ZW5kIFNjcmlwdCBUeXBlIHByb3RvdHlwZSB3aXRoIGxpc3Qgb2YgbWV0aG9kcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBtZXRob2RzIC0gT2JqZWN0IHdpdGggbWV0aG9kcywgd2hlcmUga2V5IC0gaXMgbmFtZSBvZiBtZXRob2QsIGFuZCB2YWx1ZSAtIGlzIGZ1bmN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIFBsYXllckNvbnRyb2xsZXIgPSBwYy5jcmVhdGVTY3JpcHQoJ3BsYXllckNvbnRyb2xsZXInKTtcbiAgICAgKlxuICAgICAqIFBsYXllckNvbnRyb2xsZXIuZXh0ZW5kKHtcbiAgICAgKiAgICAgaW5pdGlhbGl6ZTogZnVuY3Rpb24gKCkge1xuICAgICAqICAgICAgICAgLy8gY2FsbGVkIG9uY2Ugb24gaW5pdGlhbGl6ZVxuICAgICAqICAgICB9LFxuICAgICAqICAgICB1cGRhdGU6IGZ1bmN0aW9uIChkdCkge1xuICAgICAqICAgICAgICAgLy8gY2FsbGVkIGVhY2ggdGlja1xuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG4gICAgc3RhdGljIGV4dGVuZChtZXRob2RzKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIG1ldGhvZHMpIHtcbiAgICAgICAgICAgIGlmICghbWV0aG9kcy5oYXNPd25Qcm9wZXJ0eShrZXkpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICB0aGlzLnByb3RvdHlwZVtrZXldID0gbWV0aG9kc1trZXldO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgU2NyaXB0VHlwZSNbaW5pdGlhbGl6ZV1cbiAgICAgKiBAZGVzY3JpcHRpb24gQ2FsbGVkIHdoZW4gc2NyaXB0IGlzIGFib3V0IHRvIHJ1biBmb3IgdGhlIGZpcnN0IHRpbWUuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBTY3JpcHRUeXBlI1twb3N0SW5pdGlhbGl6ZV1cbiAgICAgKiBAZGVzY3JpcHRpb24gQ2FsbGVkIGFmdGVyIGFsbCBpbml0aWFsaXplIG1ldGhvZHMgYXJlIGV4ZWN1dGVkIGluIHRoZSBzYW1lIHRpY2sgb3IgZW5hYmxpbmcgY2hhaW4gb2YgYWN0aW9ucy5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIFNjcmlwdFR5cGUjW3VwZGF0ZV1cbiAgICAgKiBAZGVzY3JpcHRpb24gQ2FsbGVkIGZvciBlbmFibGVkIChydW5uaW5nIHN0YXRlKSBzY3JpcHRzIG9uIGVhY2ggdGljay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgZGVsdGEgdGltZSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgU2NyaXB0VHlwZSNbcG9zdFVwZGF0ZV1cbiAgICAgKiBAZGVzY3JpcHRpb24gQ2FsbGVkIGZvciBlbmFibGVkIChydW5uaW5nIHN0YXRlKSBzY3JpcHRzIG9uIGVhY2ggdGljaywgYWZ0ZXIgdXBkYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSBkZWx0YSB0aW1lIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBTY3JpcHRUeXBlI1tzd2FwXVxuICAgICAqIEBkZXNjcmlwdGlvbiBDYWxsZWQgd2hlbiBhIFNjcmlwdFR5cGUgdGhhdCBhbHJlYWR5IGV4aXN0cyBpbiB0aGUgcmVnaXN0cnlcbiAgICAgKiBnZXRzIHJlZGVmaW5lZC4gSWYgdGhlIG5ldyBTY3JpcHRUeXBlIGhhcyBhIGBzd2FwYCBtZXRob2QgaW4gaXRzIHByb3RvdHlwZSxcbiAgICAgKiB0aGVuIGl0IHdpbGwgYmUgZXhlY3V0ZWQgdG8gcGVyZm9ybSBob3QtcmVsb2FkIGF0IHJ1bnRpbWUuXG4gICAgICogQHBhcmFtIHtTY3JpcHRUeXBlfSBvbGQgLSBPbGQgaW5zdGFuY2Ugb2YgdGhlIHNjcmlwdFR5cGUgdG8gY29weSBkYXRhIHRvIHRoZSBuZXcgaW5zdGFuY2UuXG4gICAgICovXG59XG5cbmV4cG9ydCB7IFNjcmlwdFR5cGUgfTtcbiJdLCJuYW1lcyI6WyJmdW5jTmFtZVJlZ2V4IiwiUmVnRXhwIiwiU2NyaXB0VHlwZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiYXJncyIsImFwcCIsImVudGl0eSIsIl9lbmFibGVkIiwiX2VuYWJsZWRPbGQiLCJfaW5pdGlhbGl6ZWQiLCJfcG9zdEluaXRpYWxpemVkIiwiX19kZXN0cm95ZWQiLCJfX2F0dHJpYnV0ZXMiLCJfX2F0dHJpYnV0ZXNSYXciLCJfX3NjcmlwdFR5cGUiLCJfX2V4ZWN1dGlvbk9yZGVyIiwiaW5pdFNjcmlwdFR5cGUiLCJlbmFibGVkIiwidmFsdWUiLCJmaXJlIiwiX19pbml0aWFsaXplQXR0cmlidXRlcyIsImluaXRpYWxpemUiLCJzY3JpcHQiLCJfc2NyaXB0TWV0aG9kIiwiU0NSSVBUX0lOSVRJQUxJWkUiLCJfYmVpbmdFbmFibGVkIiwicG9zdEluaXRpYWxpemUiLCJTQ1JJUFRfUE9TVF9JTklUSUFMSVpFIiwiX2Rlc3Ryb3llZCIsIkRlYnVnIiwiYXNzZXJ0IiwiX19uYW1lIiwiYXR0cmlidXRlcyIsIl9fZ2V0U2NyaXB0TmFtZSIsImNvbnN0cnVjdG9yRm4iLCJ1bmRlZmluZWQiLCJGdW5jdGlvbiIsInByb3RvdHlwZSIsIm5hbWUiLCJtYXRjaCIsInNjcmlwdE5hbWUiLCJoYXNPd25Qcm9wZXJ0eSIsIlNjcmlwdEF0dHJpYnV0ZXMiLCJmb3JjZSIsImtleSIsImluZGV4IiwiZGVmYXVsdCIsImV4dGVuZCIsIm1ldGhvZHMiXSwibWFwcGluZ3MiOiI7Ozs7O0FBTUEsTUFBTUEsYUFBYSxHQUFHLElBQUlDLE1BQU0sQ0FBQyxpRUFBaUUsQ0FBQyxDQUFBOztBQUVuRztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsVUFBVSxTQUFTQyxZQUFZLENBQUM7QUFnRGxDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxJQUFJLEVBQUU7QUFDZCxJQUFBLEtBQUssRUFBRSxDQUFBO0FBekRYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsR0FBRyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRUg7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUpJLElBQUEsSUFBQSxDQUtBQyxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFTjtBQUFBLElBQUEsSUFBQSxDQUNBQyxRQUFRLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFUjtBQUFBLElBQUEsSUFBQSxDQUNBQyxXQUFXLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWDtBQUFBLElBQUEsSUFBQSxDQUNBQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWjtBQUFBLElBQUEsSUFBQSxDQUNBQyxnQkFBZ0IsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVoQjtBQUFBLElBQUEsSUFBQSxDQUNBQyxXQUFXLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWDtBQUFBLElBQUEsSUFBQSxDQUNBQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWjtBQUFBLElBQUEsSUFBQSxDQUNBQyxlQUFlLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFZjtBQUFBLElBQUEsSUFBQSxDQUNBQyxZQUFZLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFWjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQU5JLElBQUEsSUFBQSxDQU9BQyxnQkFBZ0IsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQWFaLElBQUEsSUFBSSxDQUFDQyxjQUFjLENBQUNaLElBQUksQ0FBQyxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSWEsT0FBT0EsQ0FBQ0MsS0FBSyxFQUFFO0FBQ2YsSUFBQSxJQUFJLENBQUNYLFFBQVEsR0FBRyxDQUFDLENBQUNXLEtBQUssQ0FBQTtBQUV2QixJQUFBLElBQUksSUFBSSxDQUFDRCxPQUFPLEtBQUssSUFBSSxDQUFDVCxXQUFXLEVBQUUsT0FBQTtBQUV2QyxJQUFBLElBQUksQ0FBQ0EsV0FBVyxHQUFHLElBQUksQ0FBQ1MsT0FBTyxDQUFBO0lBQy9CLElBQUksQ0FBQ0UsSUFBSSxDQUFDLElBQUksQ0FBQ0YsT0FBTyxHQUFHLFFBQVEsR0FBRyxTQUFTLENBQUMsQ0FBQTtJQUM5QyxJQUFJLENBQUNFLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDRixPQUFPLENBQUMsQ0FBQTs7QUFFaEM7SUFDQSxJQUFJLENBQUMsSUFBSSxDQUFDUixZQUFZLElBQUksSUFBSSxDQUFDUSxPQUFPLEVBQUU7TUFDcEMsSUFBSSxDQUFDUixZQUFZLEdBQUcsSUFBSSxDQUFBO0FBRXhCLE1BQUEsSUFBSSxDQUFDVyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUVqQyxNQUFBLElBQUksSUFBSSxDQUFDQyxVQUFVLEVBQ2YsSUFBSSxDQUFDZixNQUFNLENBQUNnQixNQUFNLENBQUNDLGFBQWEsQ0FBQyxJQUFJLEVBQUVDLGlCQUFpQixDQUFDLENBQUE7QUFDakUsS0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0EsSUFBSSxJQUFJLENBQUNmLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQ0MsZ0JBQWdCLElBQUksSUFBSSxDQUFDTyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUNYLE1BQU0sQ0FBQ2dCLE1BQU0sQ0FBQ0csYUFBYSxFQUFFO01BQ2xHLElBQUksQ0FBQ2YsZ0JBQWdCLEdBQUcsSUFBSSxDQUFBO0FBRTVCLE1BQUEsSUFBSSxJQUFJLENBQUNnQixjQUFjLEVBQ25CLElBQUksQ0FBQ3BCLE1BQU0sQ0FBQ2dCLE1BQU0sQ0FBQ0MsYUFBYSxDQUFDLElBQUksRUFBRUksc0JBQXNCLENBQUMsQ0FBQTtBQUN0RSxLQUFBO0FBQ0osR0FBQTtFQUVBLElBQUlWLE9BQU9BLEdBQUc7SUFDVixPQUFPLElBQUksQ0FBQ1YsUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDcUIsVUFBVSxJQUFJLElBQUksQ0FBQ3RCLE1BQU0sQ0FBQ2dCLE1BQU0sQ0FBQ0wsT0FBTyxJQUFJLElBQUksQ0FBQ1gsTUFBTSxDQUFDVyxPQUFPLENBQUE7QUFDakcsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0lELGNBQWNBLENBQUNaLElBQUksRUFBRTtBQUNqQixJQUFBLE1BQU1rQixNQUFNLEdBQUcsSUFBSSxDQUFDbkIsV0FBVyxDQUFDO0FBQ2hDMEIsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLENBQUMxQixJQUFJLElBQUlBLElBQUksQ0FBQ0MsR0FBRyxJQUFJRCxJQUFJLENBQUNFLE1BQU0sRUFBRyxDQUFBLFFBQUEsRUFBVWdCLE1BQU0sQ0FBQ1MsTUFBTyx3Q0FBdUMsQ0FBQyxDQUFBO0FBRS9HLElBQUEsSUFBSSxDQUFDMUIsR0FBRyxHQUFHRCxJQUFJLENBQUNDLEdBQUcsQ0FBQTtBQUNuQixJQUFBLElBQUksQ0FBQ0MsTUFBTSxHQUFHRixJQUFJLENBQUNFLE1BQU0sQ0FBQTtBQUV6QixJQUFBLElBQUksQ0FBQ0MsUUFBUSxHQUFHLE9BQU9ILElBQUksQ0FBQ2EsT0FBTyxLQUFLLFNBQVMsR0FBR2IsSUFBSSxDQUFDYSxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3ZFLElBQUEsSUFBSSxDQUFDVCxXQUFXLEdBQUcsSUFBSSxDQUFDUyxPQUFPLENBQUE7SUFFL0IsSUFBSSxDQUFDTixXQUFXLEdBQUcsS0FBSyxDQUFBO0FBQ3hCLElBQUEsSUFBSSxDQUFDQyxZQUFZLEdBQUcsRUFBRyxDQUFBO0lBQ3ZCLElBQUksQ0FBQ0MsZUFBZSxHQUFHVCxJQUFJLENBQUM0QixVQUFVLElBQUksRUFBRyxDQUFDO0lBQzlDLElBQUksQ0FBQ2xCLFlBQVksR0FBR1EsTUFBTSxDQUFBO0FBQzFCLElBQUEsSUFBSSxDQUFDUCxnQkFBZ0IsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUM5QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFDMEI7QUFFdEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLE9BQU9rQixlQUFlQSxDQUFDQyxhQUFhLEVBQUU7QUFDbEMsSUFBQSxJQUFJLE9BQU9BLGFBQWEsS0FBSyxVQUFVLEVBQUUsT0FBT0MsU0FBUyxDQUFBO0lBQ3pELElBQUksTUFBTSxJQUFJQyxRQUFRLENBQUNDLFNBQVMsRUFBRSxPQUFPSCxhQUFhLENBQUNJLElBQUksQ0FBQTtBQUMzRCxJQUFBLElBQUlKLGFBQWEsS0FBS0UsUUFBUSxJQUFJRixhQUFhLEtBQUtFLFFBQVEsQ0FBQ0MsU0FBUyxDQUFDbEMsV0FBVyxFQUFFLE9BQU8sVUFBVSxDQUFBO0lBQ3JHLE1BQU1vQyxLQUFLLEdBQUcsQ0FBQyxFQUFFLEdBQUdMLGFBQWEsRUFBRUssS0FBSyxDQUFDeEMsYUFBYSxDQUFDLENBQUE7QUFDdkQsSUFBQSxPQUFPd0MsS0FBSyxHQUFHQSxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUdKLFNBQVMsQ0FBQTtBQUN2QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxXQUFXSyxVQUFVQSxHQUFHO0lBQ3BCLE9BQU8sSUFBSSxDQUFDVCxNQUFNLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksV0FBV0MsVUFBVUEsR0FBRztBQUNwQixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNTLGNBQWMsQ0FBQyxjQUFjLENBQUMsRUFBRSxJQUFJLENBQUM3QixZQUFZLEdBQUcsSUFBSThCLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFBO0lBQ3hGLE9BQU8sSUFBSSxDQUFDOUIsWUFBWSxDQUFBO0FBQzVCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7RUFDSVEsc0JBQXNCQSxDQUFDdUIsS0FBSyxFQUFFO0FBQzFCLElBQUEsSUFBSSxDQUFDQSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUM5QixlQUFlLEVBQy9CLE9BQUE7O0FBRUo7SUFDQSxLQUFLLE1BQU0rQixHQUFHLElBQUksSUFBSSxDQUFDOUIsWUFBWSxDQUFDa0IsVUFBVSxDQUFDYSxLQUFLLEVBQUU7QUFDbEQsTUFBQSxJQUFJLElBQUksQ0FBQ2hDLGVBQWUsSUFBSSxJQUFJLENBQUNBLGVBQWUsQ0FBQzRCLGNBQWMsQ0FBQ0csR0FBRyxDQUFDLEVBQUU7UUFDbEUsSUFBSSxDQUFDQSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMvQixlQUFlLENBQUMrQixHQUFHLENBQUMsQ0FBQTtPQUN4QyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUNoQyxZQUFZLENBQUM2QixjQUFjLENBQUNHLEdBQUcsQ0FBQyxFQUFFO0FBQy9DLFFBQUEsSUFBSSxJQUFJLENBQUM5QixZQUFZLENBQUNrQixVQUFVLENBQUNhLEtBQUssQ0FBQ0QsR0FBRyxDQUFDLENBQUNILGNBQWMsQ0FBQyxTQUFTLENBQUMsRUFBRTtBQUNuRSxVQUFBLElBQUksQ0FBQ0csR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDOUIsWUFBWSxDQUFDa0IsVUFBVSxDQUFDYSxLQUFLLENBQUNELEdBQUcsQ0FBQyxDQUFDRSxPQUFPLENBQUE7QUFDL0QsU0FBQyxNQUFNO0FBQ0gsVUFBQSxJQUFJLENBQUNGLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQTtBQUNwQixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLENBQUMvQixlQUFlLEdBQUcsSUFBSSxDQUFBO0FBQy9CLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSSxPQUFPa0MsTUFBTUEsQ0FBQ0MsT0FBTyxFQUFFO0FBQ25CLElBQUEsS0FBSyxNQUFNSixHQUFHLElBQUlJLE9BQU8sRUFBRTtBQUN2QixNQUFBLElBQUksQ0FBQ0EsT0FBTyxDQUFDUCxjQUFjLENBQUNHLEdBQUcsQ0FBQyxFQUM1QixTQUFBO01BRUosSUFBSSxDQUFDUCxTQUFTLENBQUNPLEdBQUcsQ0FBQyxHQUFHSSxPQUFPLENBQUNKLEdBQUcsQ0FBQyxDQUFBO0FBQ3RDLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFFSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFBO0FBcFdNM0MsVUFBVSxDQXNPTDhCLE1BQU0sR0FBRyxJQUFJOzs7OyJ9
