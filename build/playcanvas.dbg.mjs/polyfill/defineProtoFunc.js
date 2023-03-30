/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * A short hand function to polyfill prototype methods which are not iterated in e.g. for-in loops.
 * 
 * @param {ObjectConstructor} cls 
 * @param {string} name 
 * @param {Function} func 
 * @ignore
 */
function defineProtoFunc(cls, name, func) {
  if (!cls.prototype[name]) {
    Object.defineProperty(cls.prototype, name, {
      value: func,
      configurable: true,
      enumerable: false,
      writable: true
    });
  }
}

export { defineProtoFunc };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmaW5lUHJvdG9GdW5jLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcG9seWZpbGwvZGVmaW5lUHJvdG9GdW5jLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSBzaG9ydCBoYW5kIGZ1bmN0aW9uIHRvIHBvbHlmaWxsIHByb3RvdHlwZSBtZXRob2RzIHdoaWNoIGFyZSBub3QgaXRlcmF0ZWQgaW4gZS5nLiBmb3ItaW4gbG9vcHMuXG4gKiBcbiAqIEBwYXJhbSB7T2JqZWN0Q29uc3RydWN0b3J9IGNscyBcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBcbiAqIEBpZ25vcmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlZmluZVByb3RvRnVuYyhjbHMsIG5hbWUsIGZ1bmMpIHtcbiAgaWYgKCFjbHMucHJvdG90eXBlW25hbWVdKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY2xzLnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICAgIHZhbHVlOiBmdW5jLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbmVQcm90b0Z1bmMiLCJjbHMiLCJuYW1lIiwiZnVuYyIsInByb3RvdHlwZSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwidmFsdWUiLCJjb25maWd1cmFibGUiLCJlbnVtZXJhYmxlIiwid3JpdGFibGUiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNBLGVBQWVBLENBQUNDLEdBQUcsRUFBRUMsSUFBSSxFQUFFQyxJQUFJLEVBQUU7QUFDL0MsRUFBQSxJQUFJLENBQUNGLEdBQUcsQ0FBQ0csU0FBUyxDQUFDRixJQUFJLENBQUMsRUFBRTtJQUN0QkcsTUFBTSxDQUFDQyxjQUFjLENBQUNMLEdBQUcsQ0FBQ0csU0FBUyxFQUFFRixJQUFJLEVBQUU7QUFDdkNLLE1BQUFBLEtBQUssRUFBRUosSUFBSTtBQUNYSyxNQUFBQSxZQUFZLEVBQUUsSUFBSTtBQUNsQkMsTUFBQUEsVUFBVSxFQUFFLEtBQUs7QUFDakJDLE1BQUFBLFFBQVEsRUFBRSxJQUFBO0FBQ2QsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBO0FBQ0Y7Ozs7In0=
