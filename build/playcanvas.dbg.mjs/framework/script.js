import { events } from '../core/events.js';
import { getApplication } from './globals.js';
import { ScriptTypes } from './script/script-types.js';

/**
 * Callback used by {@link script.createLoadingScreen}.
 *
 * @callback CreateScreenCallback
 * @param {import('./app-base.js').AppBase} app - The application.
 */

/**
 * Callback used by {@link script.create}.
 *
 * @callback CreateScriptCallback
 * @param {import('./app-base.js').AppBase} app - The application.
 * @returns {object} Return the Type of the script resource to be instanced for each Entity.
 * @ignore
 */

let _legacy = false;

// flag to avoid creating multiple loading screens e.g. when
// loading screen scripts are reloaded
let _createdLoadingScreen = false;

/**
 * The script namespace holds the createLoadingScreen function that is used to override the default
 * PlayCanvas loading screen.
 *
 * @namespace
 */
const script = {
  // set during script load to be used for initializing script
  app: null,
  /**
   * Create a script resource object. A script file should contain a single call to
   * {@link script.create} and the callback should return a script object which will be
   * instantiated when attached to Entities.
   *
   * @param {string} name - The name of the script object.
   * @param {CreateScriptCallback} callback - The callback function which is passed an
   * {@link AppBase} object, which is used to access Entities and Components, and should
   * return the Type of the script resource to be instanced for each Entity.
   * @example
   * pc.script.create(function (app) {
   *     var Scriptable = function (entity) {
   *         // store entity
   *         this.entity = entity;
   *
   *         // use app
   *         app.components.model.addComponent(entity, {
   *             // component properties
   *         });
   *     };
   *
   *     return Scriptable;
   * });
   * @ignore
   */
  create: function (name, callback) {
    if (!_legacy) return;

    // get the ScriptType from the callback
    const ScriptType = callback(script.app);

    // store the script name
    ScriptType._pcScriptName = name;

    // Push this onto loading stack
    ScriptTypes.push(ScriptType, _legacy);
    this.fire("created", name, callback);
  },
  /**
   * Creates a script attribute for the current script. The script attribute can be accessed
   * inside the script instance like so 'this.attributeName' or outside a script instance like so
   * 'entity.script.attributeName'. Script attributes can be edited from the Attribute Editor of
   * the PlayCanvas Editor like normal Components.
   *
   * @param {string} name - The name of the attribute.
   * @param {string} type - The type of the attribute. Can be: 'number', 'string', 'boolean',
   * 'asset', 'entity', 'rgb', 'rgba', 'vector', 'enumeration', 'curve', 'colorcurve'.
   * @param {object} defaultValue - The default value of the attribute.
   * @param {object} options - Optional parameters for the attribute.
   * @param {number} options.min - The minimum value of the attribute.
   * @param {number} options.max - The maximum value of the attribute.
   * @param {number} options.step - The step that will be used when changing the attribute value
   * in the PlayCanvas Editor.
   * @param {number} options.decimalPrecision - A number that specifies the number of decimal
   * digits allowed for the value.
   * @param {object[]} options.enumerations - An array of name, value pairs from which the user
   * can select one if the attribute type is an enumeration.
   * @param {string[]} options.curves - (For 'curve' attributes only) An array of strings that
   * define the names of each curve in the curve editor.
   * @param {boolean} options.color - (For 'curve' attributes only) If true then the curve
   * attribute will be a color curve.
   * @example
   * pc.script.attribute('speed', 'number', 5);
   * pc.script.attribute('message', 'string', "My message");
   * pc.script.attribute('enemyPosition', 'vector', [1, 0, 0]);
   * pc.script.attribute('spellType', 'enumeration', 0, {
   *     enumerations: [{
   *         name: "Fire",
   *         value: 0
   *     }, {
   *         name: "Ice",
   *         value: 1
   *     }]
   * });
   * pc.script.attribute('enemy', 'entity');
   * pc.script.attribute('enemySpeed', 'curve');
   * pc.script.attribute('enemyPosition', 'curve', null, {
   *     curves: ['x', 'y', 'z']
   * });
   * pc.script.attribute('color', 'colorcurve', null, {
   *     type: 'rgba'
   * });
   *
   * pc.script.create('scriptable', function (app) {
   *     var Scriptable = function (entity) {
   *         // store entity
   *         this.entity = entity;
   *     };
   *
   *     return Scriptable;
   * });
   * @ignore
   */
  attribute: function (name, type, defaultValue, options) {
    // only works when parsing the script...
  },
  /**
   * Handles the creation of the loading screen of the application. A script can subscribe to the
   * events of a {@link AppBase} to show a loading screen, progress bar etc. In order for
   * this to work you need to set the project's loading screen script to the script that calls
   * this method.
   *
   * @param {CreateScreenCallback} callback - A function which can set up and tear down a
   * customized loading screen.
   * @example
   * pc.script.createLoadingScreen(function (app) {
   *     var showSplashScreen = function () {};
   *     var hideSplashScreen = function () {};
   *     var showProgress = function (progress) {};
   *     app.on("preload:start", showSplashScreen);
   *     app.on("preload:progress", showProgress);
   *     app.on("start", hideSplashScreen);
   * });
   */
  createLoadingScreen: function (callback) {
    if (_createdLoadingScreen) return;
    _createdLoadingScreen = true;
    const app = getApplication();
    callback(app);
  }
};
Object.defineProperty(script, 'legacy', {
  get: function () {
    return _legacy;
  },
  set: function (value) {
    _legacy = value;
  }
});
events.attach(script);

export { script };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyaXB0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3NjcmlwdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBldmVudHMgfSBmcm9tICcuLi9jb3JlL2V2ZW50cy5qcyc7XG5cbmltcG9ydCB7IGdldEFwcGxpY2F0aW9uIH0gZnJvbSAnLi9nbG9iYWxzLmpzJztcbmltcG9ydCB7IFNjcmlwdFR5cGVzIH0gZnJvbSAnLi9zY3JpcHQvc2NyaXB0LXR5cGVzLmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBzY3JpcHQuY3JlYXRlTG9hZGluZ1NjcmVlbn0uXG4gKlxuICogQGNhbGxiYWNrIENyZWF0ZVNjcmVlbkNhbGxiYWNrXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIHNjcmlwdC5jcmVhdGV9LlxuICpcbiAqIEBjYWxsYmFjayBDcmVhdGVTY3JpcHRDYWxsYmFja1xuICogQHBhcmFtIHtpbXBvcnQoJy4vYXBwLWJhc2UuanMnKS5BcHBCYXNlfSBhcHAgLSBUaGUgYXBwbGljYXRpb24uXG4gKiBAcmV0dXJucyB7b2JqZWN0fSBSZXR1cm4gdGhlIFR5cGUgb2YgdGhlIHNjcmlwdCByZXNvdXJjZSB0byBiZSBpbnN0YW5jZWQgZm9yIGVhY2ggRW50aXR5LlxuICogQGlnbm9yZVxuICovXG5cbmxldCBfbGVnYWN5ID0gZmFsc2U7XG5cbi8vIGZsYWcgdG8gYXZvaWQgY3JlYXRpbmcgbXVsdGlwbGUgbG9hZGluZyBzY3JlZW5zIGUuZy4gd2hlblxuLy8gbG9hZGluZyBzY3JlZW4gc2NyaXB0cyBhcmUgcmVsb2FkZWRcbmxldCBfY3JlYXRlZExvYWRpbmdTY3JlZW4gPSBmYWxzZTtcblxuLyoqXG4gKiBUaGUgc2NyaXB0IG5hbWVzcGFjZSBob2xkcyB0aGUgY3JlYXRlTG9hZGluZ1NjcmVlbiBmdW5jdGlvbiB0aGF0IGlzIHVzZWQgdG8gb3ZlcnJpZGUgdGhlIGRlZmF1bHRcbiAqIFBsYXlDYW52YXMgbG9hZGluZyBzY3JlZW4uXG4gKlxuICogQG5hbWVzcGFjZVxuICovXG5jb25zdCBzY3JpcHQgPSB7XG4gICAgLy8gc2V0IGR1cmluZyBzY3JpcHQgbG9hZCB0byBiZSB1c2VkIGZvciBpbml0aWFsaXppbmcgc2NyaXB0XG4gICAgYXBwOiBudWxsLFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgc2NyaXB0IHJlc291cmNlIG9iamVjdC4gQSBzY3JpcHQgZmlsZSBzaG91bGQgY29udGFpbiBhIHNpbmdsZSBjYWxsIHRvXG4gICAgICoge0BsaW5rIHNjcmlwdC5jcmVhdGV9IGFuZCB0aGUgY2FsbGJhY2sgc2hvdWxkIHJldHVybiBhIHNjcmlwdCBvYmplY3Qgd2hpY2ggd2lsbCBiZVxuICAgICAqIGluc3RhbnRpYXRlZCB3aGVuIGF0dGFjaGVkIHRvIEVudGl0aWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2NyaXB0IG9iamVjdC5cbiAgICAgKiBAcGFyYW0ge0NyZWF0ZVNjcmlwdENhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB3aGljaCBpcyBwYXNzZWQgYW5cbiAgICAgKiB7QGxpbmsgQXBwQmFzZX0gb2JqZWN0LCB3aGljaCBpcyB1c2VkIHRvIGFjY2VzcyBFbnRpdGllcyBhbmQgQ29tcG9uZW50cywgYW5kIHNob3VsZFxuICAgICAqIHJldHVybiB0aGUgVHlwZSBvZiB0aGUgc2NyaXB0IHJlc291cmNlIHRvIGJlIGluc3RhbmNlZCBmb3IgZWFjaCBFbnRpdHkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5zY3JpcHQuY3JlYXRlKGZ1bmN0aW9uIChhcHApIHtcbiAgICAgKiAgICAgdmFyIFNjcmlwdGFibGUgPSBmdW5jdGlvbiAoZW50aXR5KSB7XG4gICAgICogICAgICAgICAvLyBzdG9yZSBlbnRpdHlcbiAgICAgKiAgICAgICAgIHRoaXMuZW50aXR5ID0gZW50aXR5O1xuICAgICAqXG4gICAgICogICAgICAgICAvLyB1c2UgYXBwXG4gICAgICogICAgICAgICBhcHAuY29tcG9uZW50cy5tb2RlbC5hZGRDb21wb25lbnQoZW50aXR5LCB7XG4gICAgICogICAgICAgICAgICAgLy8gY29tcG9uZW50IHByb3BlcnRpZXNcbiAgICAgKiAgICAgICAgIH0pO1xuICAgICAqICAgICB9O1xuICAgICAqXG4gICAgICogICAgIHJldHVybiBTY3JpcHRhYmxlO1xuICAgICAqIH0pO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBjcmVhdGU6IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIV9sZWdhY3kpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gZ2V0IHRoZSBTY3JpcHRUeXBlIGZyb20gdGhlIGNhbGxiYWNrXG4gICAgICAgIGNvbnN0IFNjcmlwdFR5cGUgPSBjYWxsYmFjayhzY3JpcHQuYXBwKTtcblxuICAgICAgICAvLyBzdG9yZSB0aGUgc2NyaXB0IG5hbWVcbiAgICAgICAgU2NyaXB0VHlwZS5fcGNTY3JpcHROYW1lID0gbmFtZTtcblxuICAgICAgICAvLyBQdXNoIHRoaXMgb250byBsb2FkaW5nIHN0YWNrXG4gICAgICAgIFNjcmlwdFR5cGVzLnB1c2goU2NyaXB0VHlwZSwgX2xlZ2FjeSk7XG5cbiAgICAgICAgdGhpcy5maXJlKFwiY3JlYXRlZFwiLCBuYW1lLCBjYWxsYmFjayk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzY3JpcHQgYXR0cmlidXRlIGZvciB0aGUgY3VycmVudCBzY3JpcHQuIFRoZSBzY3JpcHQgYXR0cmlidXRlIGNhbiBiZSBhY2Nlc3NlZFxuICAgICAqIGluc2lkZSB0aGUgc2NyaXB0IGluc3RhbmNlIGxpa2Ugc28gJ3RoaXMuYXR0cmlidXRlTmFtZScgb3Igb3V0c2lkZSBhIHNjcmlwdCBpbnN0YW5jZSBsaWtlIHNvXG4gICAgICogJ2VudGl0eS5zY3JpcHQuYXR0cmlidXRlTmFtZScuIFNjcmlwdCBhdHRyaWJ1dGVzIGNhbiBiZSBlZGl0ZWQgZnJvbSB0aGUgQXR0cmlidXRlIEVkaXRvciBvZlxuICAgICAqIHRoZSBQbGF5Q2FudmFzIEVkaXRvciBsaWtlIG5vcm1hbCBDb21wb25lbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gVGhlIHR5cGUgb2YgdGhlIGF0dHJpYnV0ZS4gQ2FuIGJlOiAnbnVtYmVyJywgJ3N0cmluZycsICdib29sZWFuJyxcbiAgICAgKiAnYXNzZXQnLCAnZW50aXR5JywgJ3JnYicsICdyZ2JhJywgJ3ZlY3RvcicsICdlbnVtZXJhdGlvbicsICdjdXJ2ZScsICdjb2xvcmN1cnZlJy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGVmYXVsdFZhbHVlIC0gVGhlIGRlZmF1bHQgdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIE9wdGlvbmFsIHBhcmFtZXRlcnMgZm9yIHRoZSBhdHRyaWJ1dGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG9wdGlvbnMubWluIC0gVGhlIG1pbmltdW0gdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3B0aW9ucy5tYXggLSBUaGUgbWF4aW11bSB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBvcHRpb25zLnN0ZXAgLSBUaGUgc3RlcCB0aGF0IHdpbGwgYmUgdXNlZCB3aGVuIGNoYW5naW5nIHRoZSBhdHRyaWJ1dGUgdmFsdWVcbiAgICAgKiBpbiB0aGUgUGxheUNhbnZhcyBFZGl0b3IuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG9wdGlvbnMuZGVjaW1hbFByZWNpc2lvbiAtIEEgbnVtYmVyIHRoYXQgc3BlY2lmaWVzIHRoZSBudW1iZXIgb2YgZGVjaW1hbFxuICAgICAqIGRpZ2l0cyBhbGxvd2VkIGZvciB0aGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtvYmplY3RbXX0gb3B0aW9ucy5lbnVtZXJhdGlvbnMgLSBBbiBhcnJheSBvZiBuYW1lLCB2YWx1ZSBwYWlycyBmcm9tIHdoaWNoIHRoZSB1c2VyXG4gICAgICogY2FuIHNlbGVjdCBvbmUgaWYgdGhlIGF0dHJpYnV0ZSB0eXBlIGlzIGFuIGVudW1lcmF0aW9uLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IG9wdGlvbnMuY3VydmVzIC0gKEZvciAnY3VydmUnIGF0dHJpYnV0ZXMgb25seSkgQW4gYXJyYXkgb2Ygc3RyaW5ncyB0aGF0XG4gICAgICogZGVmaW5lIHRoZSBuYW1lcyBvZiBlYWNoIGN1cnZlIGluIHRoZSBjdXJ2ZSBlZGl0b3IuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBvcHRpb25zLmNvbG9yIC0gKEZvciAnY3VydmUnIGF0dHJpYnV0ZXMgb25seSkgSWYgdHJ1ZSB0aGVuIHRoZSBjdXJ2ZVxuICAgICAqIGF0dHJpYnV0ZSB3aWxsIGJlIGEgY29sb3IgY3VydmUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5zY3JpcHQuYXR0cmlidXRlKCdzcGVlZCcsICdudW1iZXInLCA1KTtcbiAgICAgKiBwYy5zY3JpcHQuYXR0cmlidXRlKCdtZXNzYWdlJywgJ3N0cmluZycsIFwiTXkgbWVzc2FnZVwiKTtcbiAgICAgKiBwYy5zY3JpcHQuYXR0cmlidXRlKCdlbmVteVBvc2l0aW9uJywgJ3ZlY3RvcicsIFsxLCAwLCAwXSk7XG4gICAgICogcGMuc2NyaXB0LmF0dHJpYnV0ZSgnc3BlbGxUeXBlJywgJ2VudW1lcmF0aW9uJywgMCwge1xuICAgICAqICAgICBlbnVtZXJhdGlvbnM6IFt7XG4gICAgICogICAgICAgICBuYW1lOiBcIkZpcmVcIixcbiAgICAgKiAgICAgICAgIHZhbHVlOiAwXG4gICAgICogICAgIH0sIHtcbiAgICAgKiAgICAgICAgIG5hbWU6IFwiSWNlXCIsXG4gICAgICogICAgICAgICB2YWx1ZTogMVxuICAgICAqICAgICB9XVxuICAgICAqIH0pO1xuICAgICAqIHBjLnNjcmlwdC5hdHRyaWJ1dGUoJ2VuZW15JywgJ2VudGl0eScpO1xuICAgICAqIHBjLnNjcmlwdC5hdHRyaWJ1dGUoJ2VuZW15U3BlZWQnLCAnY3VydmUnKTtcbiAgICAgKiBwYy5zY3JpcHQuYXR0cmlidXRlKCdlbmVteVBvc2l0aW9uJywgJ2N1cnZlJywgbnVsbCwge1xuICAgICAqICAgICBjdXJ2ZXM6IFsneCcsICd5JywgJ3onXVxuICAgICAqIH0pO1xuICAgICAqIHBjLnNjcmlwdC5hdHRyaWJ1dGUoJ2NvbG9yJywgJ2NvbG9yY3VydmUnLCBudWxsLCB7XG4gICAgICogICAgIHR5cGU6ICdyZ2JhJ1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogcGMuc2NyaXB0LmNyZWF0ZSgnc2NyaXB0YWJsZScsIGZ1bmN0aW9uIChhcHApIHtcbiAgICAgKiAgICAgdmFyIFNjcmlwdGFibGUgPSBmdW5jdGlvbiAoZW50aXR5KSB7XG4gICAgICogICAgICAgICAvLyBzdG9yZSBlbnRpdHlcbiAgICAgKiAgICAgICAgIHRoaXMuZW50aXR5ID0gZW50aXR5O1xuICAgICAqICAgICB9O1xuICAgICAqXG4gICAgICogICAgIHJldHVybiBTY3JpcHRhYmxlO1xuICAgICAqIH0pO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhdHRyaWJ1dGU6IGZ1bmN0aW9uIChuYW1lLCB0eXBlLCBkZWZhdWx0VmFsdWUsIG9wdGlvbnMpIHtcbiAgICAgICAgLy8gb25seSB3b3JrcyB3aGVuIHBhcnNpbmcgdGhlIHNjcmlwdC4uLlxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBIYW5kbGVzIHRoZSBjcmVhdGlvbiBvZiB0aGUgbG9hZGluZyBzY3JlZW4gb2YgdGhlIGFwcGxpY2F0aW9uLiBBIHNjcmlwdCBjYW4gc3Vic2NyaWJlIHRvIHRoZVxuICAgICAqIGV2ZW50cyBvZiBhIHtAbGluayBBcHBCYXNlfSB0byBzaG93IGEgbG9hZGluZyBzY3JlZW4sIHByb2dyZXNzIGJhciBldGMuIEluIG9yZGVyIGZvclxuICAgICAqIHRoaXMgdG8gd29yayB5b3UgbmVlZCB0byBzZXQgdGhlIHByb2plY3QncyBsb2FkaW5nIHNjcmVlbiBzY3JpcHQgdG8gdGhlIHNjcmlwdCB0aGF0IGNhbGxzXG4gICAgICogdGhpcyBtZXRob2QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0NyZWF0ZVNjcmVlbkNhbGxiYWNrfSBjYWxsYmFjayAtIEEgZnVuY3Rpb24gd2hpY2ggY2FuIHNldCB1cCBhbmQgdGVhciBkb3duIGFcbiAgICAgKiBjdXN0b21pemVkIGxvYWRpbmcgc2NyZWVuLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuc2NyaXB0LmNyZWF0ZUxvYWRpbmdTY3JlZW4oZnVuY3Rpb24gKGFwcCkge1xuICAgICAqICAgICB2YXIgc2hvd1NwbGFzaFNjcmVlbiA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAqICAgICB2YXIgaGlkZVNwbGFzaFNjcmVlbiA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAqICAgICB2YXIgc2hvd1Byb2dyZXNzID0gZnVuY3Rpb24gKHByb2dyZXNzKSB7fTtcbiAgICAgKiAgICAgYXBwLm9uKFwicHJlbG9hZDpzdGFydFwiLCBzaG93U3BsYXNoU2NyZWVuKTtcbiAgICAgKiAgICAgYXBwLm9uKFwicHJlbG9hZDpwcm9ncmVzc1wiLCBzaG93UHJvZ3Jlc3MpO1xuICAgICAqICAgICBhcHAub24oXCJzdGFydFwiLCBoaWRlU3BsYXNoU2NyZWVuKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBjcmVhdGVMb2FkaW5nU2NyZWVuOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKF9jcmVhdGVkTG9hZGluZ1NjcmVlbilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBfY3JlYXRlZExvYWRpbmdTY3JlZW4gPSB0cnVlO1xuXG4gICAgICAgIGNvbnN0IGFwcCA9IGdldEFwcGxpY2F0aW9uKCk7XG4gICAgICAgIGNhbGxiYWNrKGFwcCk7XG4gICAgfVxufTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KHNjcmlwdCwgJ2xlZ2FjeScsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF9sZWdhY3k7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBfbGVnYWN5ID0gdmFsdWU7XG4gICAgfVxufSk7XG5cbmV2ZW50cy5hdHRhY2goc2NyaXB0KTtcblxuZXhwb3J0IHsgc2NyaXB0IH07XG4iXSwibmFtZXMiOlsiX2xlZ2FjeSIsIl9jcmVhdGVkTG9hZGluZ1NjcmVlbiIsInNjcmlwdCIsImFwcCIsImNyZWF0ZSIsIm5hbWUiLCJjYWxsYmFjayIsIlNjcmlwdFR5cGUiLCJfcGNTY3JpcHROYW1lIiwiU2NyaXB0VHlwZXMiLCJwdXNoIiwiZmlyZSIsImF0dHJpYnV0ZSIsInR5cGUiLCJkZWZhdWx0VmFsdWUiLCJvcHRpb25zIiwiY3JlYXRlTG9hZGluZ1NjcmVlbiIsImdldEFwcGxpY2F0aW9uIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXQiLCJzZXQiLCJ2YWx1ZSIsImV2ZW50cyIsImF0dGFjaCJdLCJtYXBwaW5ncyI6Ijs7OztBQUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLElBQUlBLE9BQU8sR0FBRyxLQUFLLENBQUE7O0FBRW5CO0FBQ0E7QUFDQSxJQUFJQyxxQkFBcUIsR0FBRyxLQUFLLENBQUE7O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLE1BQU0sR0FBRztBQUNYO0FBQ0FDLEVBQUFBLEdBQUcsRUFBRSxJQUFJO0FBRVQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsTUFBTSxFQUFFLFVBQVVDLElBQUksRUFBRUMsUUFBUSxFQUFFO0lBQzlCLElBQUksQ0FBQ04sT0FBTyxFQUNSLE9BQUE7O0FBRUo7QUFDQSxJQUFBLE1BQU1PLFVBQVUsR0FBR0QsUUFBUSxDQUFDSixNQUFNLENBQUNDLEdBQUcsQ0FBQyxDQUFBOztBQUV2QztJQUNBSSxVQUFVLENBQUNDLGFBQWEsR0FBR0gsSUFBSSxDQUFBOztBQUUvQjtBQUNBSSxJQUFBQSxXQUFXLENBQUNDLElBQUksQ0FBQ0gsVUFBVSxFQUFFUCxPQUFPLENBQUMsQ0FBQTtJQUVyQyxJQUFJLENBQUNXLElBQUksQ0FBQyxTQUFTLEVBQUVOLElBQUksRUFBRUMsUUFBUSxDQUFDLENBQUE7R0FDdkM7QUFFRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJTSxTQUFTLEVBQUUsVUFBVVAsSUFBSSxFQUFFUSxJQUFJLEVBQUVDLFlBQVksRUFBRUMsT0FBTyxFQUFFO0FBQ3BEO0dBQ0g7QUFFRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsbUJBQW1CLEVBQUUsVUFBVVYsUUFBUSxFQUFFO0FBQ3JDLElBQUEsSUFBSUwscUJBQXFCLEVBQ3JCLE9BQUE7QUFFSkEsSUFBQUEscUJBQXFCLEdBQUcsSUFBSSxDQUFBO0FBRTVCLElBQUEsTUFBTUUsR0FBRyxHQUFHYyxjQUFjLEVBQUUsQ0FBQTtJQUM1QlgsUUFBUSxDQUFDSCxHQUFHLENBQUMsQ0FBQTtBQUNqQixHQUFBO0FBQ0osRUFBQztBQUVEZSxNQUFNLENBQUNDLGNBQWMsQ0FBQ2pCLE1BQU0sRUFBRSxRQUFRLEVBQUU7RUFDcENrQixHQUFHLEVBQUUsWUFBWTtBQUNiLElBQUEsT0FBT3BCLE9BQU8sQ0FBQTtHQUNqQjtBQUNEcUIsRUFBQUEsR0FBRyxFQUFFLFVBQVVDLEtBQUssRUFBRTtBQUNsQnRCLElBQUFBLE9BQU8sR0FBR3NCLEtBQUssQ0FBQTtBQUNuQixHQUFBO0FBQ0osQ0FBQyxDQUFDLENBQUE7QUFFRkMsTUFBTSxDQUFDQyxNQUFNLENBQUN0QixNQUFNLENBQUM7Ozs7In0=
