/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * @name pc
 * @namespace
 * @description Root namespace for the PlayCanvas Engine.
 */

const version = '1.62.0-dev';
const revision = '7d088032c';
const config = {};
const common = {};
const apps = {}; // Storage for the applications using the PlayCanvas Engine
const data = {}; // Storage for exported entity data

// Create look up table for types.
const _typeLookup = function () {
  const result = {};
  const names = ['Array', 'Object', 'Function', 'Date', 'RegExp', 'Float32Array'];
  for (let i = 0; i < names.length; i++) result['[object ' + names[i] + ']'] = names[i].toLowerCase();
  return result;
}();

/**
 * Extended typeof() function, returns the type of the object.
 *
 * @param {object} obj - The object to get the type of.
 * @returns {string} The type string: "null", "undefined", "number", "string", "boolean", "array", "object", "function", "date", "regexp" or "float32array".
 * @ignore
 */
function type(obj) {
  if (obj === null) {
    return 'null';
  }
  const type = typeof obj;
  if (type === 'undefined' || type === 'number' || type === 'string' || type === 'boolean') {
    return type;
  }
  return _typeLookup[Object.prototype.toString.call(obj)];
}

/**
 * Merge the contents of two objects into a single object.
 *
 * @param {object} target - The target object of the merge.
 * @param {object} ex - The object that is merged with target.
 * @returns {object} The target object.
 * @example
 * var A = {
 *     a: function () {
 *         console.log(this.a);
 *     }
 * };
 * var B = {
 *     b: function () {
 *         console.log(this.b);
 *     }
 * };
 *
 * pc.extend(A, B);
 * A.a();
 * // logs "a"
 * A.b();
 * // logs "b"
 * @ignore
 */
function extend(target, ex) {
  for (const prop in ex) {
    const copy = ex[prop];
    if (type(copy) === 'object') {
      target[prop] = extend({}, copy);
    } else if (type(copy) === 'array') {
      target[prop] = extend([], copy);
    } else {
      target[prop] = copy;
    }
  }
  return target;
}

export { apps, common, config, data, extend, revision, type, version };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29yZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvY29yZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBuYW1lIHBjXG4gKiBAbmFtZXNwYWNlXG4gKiBAZGVzY3JpcHRpb24gUm9vdCBuYW1lc3BhY2UgZm9yIHRoZSBQbGF5Q2FudmFzIEVuZ2luZS5cbiAqL1xuXG5jb25zdCB2ZXJzaW9uID0gJyRfQ1VSUkVOVF9TREtfVkVSU0lPTic7XG5jb25zdCByZXZpc2lvbiA9ICckX0NVUlJFTlRfU0RLX1JFVklTSU9OJztcbmNvbnN0IGNvbmZpZyA9IHsgfTtcbmNvbnN0IGNvbW1vbiA9IHsgfTtcbmNvbnN0IGFwcHMgPSB7IH07IC8vIFN0b3JhZ2UgZm9yIHRoZSBhcHBsaWNhdGlvbnMgdXNpbmcgdGhlIFBsYXlDYW52YXMgRW5naW5lXG5jb25zdCBkYXRhID0geyB9OyAvLyBTdG9yYWdlIGZvciBleHBvcnRlZCBlbnRpdHkgZGF0YVxuXG4vLyBDcmVhdGUgbG9vayB1cCB0YWJsZSBmb3IgdHlwZXMuXG5jb25zdCBfdHlwZUxvb2t1cCA9IGZ1bmN0aW9uICgpIHtcbiAgICBjb25zdCByZXN1bHQgPSB7IH07XG4gICAgY29uc3QgbmFtZXMgPSBbJ0FycmF5JywgJ09iamVjdCcsICdGdW5jdGlvbicsICdEYXRlJywgJ1JlZ0V4cCcsICdGbG9hdDMyQXJyYXknXTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspXG4gICAgICAgIHJlc3VsdFsnW29iamVjdCAnICsgbmFtZXNbaV0gKyAnXSddID0gbmFtZXNbaV0udG9Mb3dlckNhc2UoKTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59KCk7XG5cbi8qKlxuICogRXh0ZW5kZWQgdHlwZW9mKCkgZnVuY3Rpb24sIHJldHVybnMgdGhlIHR5cGUgb2YgdGhlIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gb2JqIC0gVGhlIG9iamVjdCB0byBnZXQgdGhlIHR5cGUgb2YuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgdHlwZSBzdHJpbmc6IFwibnVsbFwiLCBcInVuZGVmaW5lZFwiLCBcIm51bWJlclwiLCBcInN0cmluZ1wiLCBcImJvb2xlYW5cIiwgXCJhcnJheVwiLCBcIm9iamVjdFwiLCBcImZ1bmN0aW9uXCIsIFwiZGF0ZVwiLCBcInJlZ2V4cFwiIG9yIFwiZmxvYXQzMmFycmF5XCIuXG4gKiBAaWdub3JlXG4gKi9cbmZ1bmN0aW9uIHR5cGUob2JqKSB7XG4gICAgaWYgKG9iaiA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gJ251bGwnO1xuICAgIH1cblxuICAgIGNvbnN0IHR5cGUgPSB0eXBlb2Ygb2JqO1xuXG4gICAgaWYgKHR5cGUgPT09ICd1bmRlZmluZWQnIHx8IHR5cGUgPT09ICdudW1iZXInIHx8IHR5cGUgPT09ICdzdHJpbmcnIHx8IHR5cGUgPT09ICdib29sZWFuJykge1xuICAgICAgICByZXR1cm4gdHlwZTtcbiAgICB9XG5cbiAgICByZXR1cm4gX3R5cGVMb29rdXBbT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaildO1xufVxuXG4vKipcbiAqIE1lcmdlIHRoZSBjb250ZW50cyBvZiB0d28gb2JqZWN0cyBpbnRvIGEgc2luZ2xlIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gdGFyZ2V0IC0gVGhlIHRhcmdldCBvYmplY3Qgb2YgdGhlIG1lcmdlLlxuICogQHBhcmFtIHtvYmplY3R9IGV4IC0gVGhlIG9iamVjdCB0aGF0IGlzIG1lcmdlZCB3aXRoIHRhcmdldC5cbiAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSB0YXJnZXQgb2JqZWN0LlxuICogQGV4YW1wbGVcbiAqIHZhciBBID0ge1xuICogICAgIGE6IGZ1bmN0aW9uICgpIHtcbiAqICAgICAgICAgY29uc29sZS5sb2codGhpcy5hKTtcbiAqICAgICB9XG4gKiB9O1xuICogdmFyIEIgPSB7XG4gKiAgICAgYjogZnVuY3Rpb24gKCkge1xuICogICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmIpO1xuICogICAgIH1cbiAqIH07XG4gKlxuICogcGMuZXh0ZW5kKEEsIEIpO1xuICogQS5hKCk7XG4gKiAvLyBsb2dzIFwiYVwiXG4gKiBBLmIoKTtcbiAqIC8vIGxvZ3MgXCJiXCJcbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gZXh0ZW5kKHRhcmdldCwgZXgpIHtcbiAgICBmb3IgKGNvbnN0IHByb3AgaW4gZXgpIHtcbiAgICAgICAgY29uc3QgY29weSA9IGV4W3Byb3BdO1xuXG4gICAgICAgIGlmICh0eXBlKGNvcHkpID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdGFyZ2V0W3Byb3BdID0gZXh0ZW5kKHt9LCBjb3B5KTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlKGNvcHkpID09PSAnYXJyYXknKSB7XG4gICAgICAgICAgICB0YXJnZXRbcHJvcF0gPSBleHRlbmQoW10sIGNvcHkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGFyZ2V0W3Byb3BdID0gY29weTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG59XG5cbmV4cG9ydCB7IGFwcHMsIGNvbW1vbiwgY29uZmlnLCBkYXRhLCBleHRlbmQsIHJldmlzaW9uLCB0eXBlLCB2ZXJzaW9uIH07XG4iXSwibmFtZXMiOlsidmVyc2lvbiIsInJldmlzaW9uIiwiY29uZmlnIiwiY29tbW9uIiwiYXBwcyIsImRhdGEiLCJfdHlwZUxvb2t1cCIsInJlc3VsdCIsIm5hbWVzIiwiaSIsImxlbmd0aCIsInRvTG93ZXJDYXNlIiwidHlwZSIsIm9iaiIsIk9iamVjdCIsInByb3RvdHlwZSIsInRvU3RyaW5nIiwiY2FsbCIsImV4dGVuZCIsInRhcmdldCIsImV4IiwicHJvcCIsImNvcHkiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFTUEsTUFBQUEsT0FBTyxHQUFHLGFBQXVCO0FBQ2pDQyxNQUFBQSxRQUFRLEdBQUcsWUFBd0I7QUFD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
