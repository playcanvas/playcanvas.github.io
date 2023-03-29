/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmaW5lUHJvdG9GdW5jLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcG9seWZpbGwvZGVmaW5lUHJvdG9GdW5jLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSBzaG9ydCBoYW5kIGZ1bmN0aW9uIHRvIHBvbHlmaWxsIHByb3RvdHlwZSBtZXRob2RzIHdoaWNoIGFyZSBub3QgaXRlcmF0ZWQgaW4gZS5nLiBmb3ItaW4gbG9vcHMuXG4gKiBcbiAqIEBwYXJhbSB7T2JqZWN0Q29uc3RydWN0b3J9IGNscyBcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBcbiAqIEBpZ25vcmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlZmluZVByb3RvRnVuYyhjbHMsIG5hbWUsIGZ1bmMpIHtcbiAgaWYgKCFjbHMucHJvdG90eXBlW25hbWVdKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY2xzLnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICAgIHZhbHVlOiBmdW5jLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgICB3cml0YWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbmVQcm90b0Z1bmMiLCJjbHMiLCJuYW1lIiwiZnVuYyIsInByb3RvdHlwZSIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwidmFsdWUiLCJjb25maWd1cmFibGUiLCJlbnVtZXJhYmxlIiwid3JpdGFibGUiXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNBLGVBQWUsQ0FBQ0MsR0FBRyxFQUFFQyxJQUFJLEVBQUVDLElBQUksRUFBRTtBQUMvQyxFQUFBLElBQUksQ0FBQ0YsR0FBRyxDQUFDRyxTQUFTLENBQUNGLElBQUksQ0FBQyxFQUFFO0lBQ3RCRyxNQUFNLENBQUNDLGNBQWMsQ0FBQ0wsR0FBRyxDQUFDRyxTQUFTLEVBQUVGLElBQUksRUFBRTtBQUN2Q0ssTUFBQUEsS0FBSyxFQUFFSixJQUFJO0FBQ1hLLE1BQUFBLFlBQVksRUFBRSxJQUFJO0FBQ2xCQyxNQUFBQSxVQUFVLEVBQUUsS0FBSztBQUNqQkMsTUFBQUEsUUFBUSxFQUFFLElBQUE7QUFDZCxLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7QUFDRjs7OzsifQ==
