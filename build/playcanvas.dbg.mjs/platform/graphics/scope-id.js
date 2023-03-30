/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { VersionedObject } from './versioned-object.js';

/**
 * The scope for a variable.
 */
class ScopeId {
  /**
   * Create a new ScopeId instance.
   *
   * @param {string} name - The variable name.
   */
  constructor(name) {
    /**
     * The variable name.
     *
     * @type {string}
     */
    this.name = name;

    // Set the default value
    this.value = null;

    // Create the version object
    this.versionObject = new VersionedObject();
  }

  // Don't stringify ScopeId to JSON by JSON.stringify, as this stores 'value'
  // which is not needed. This is used when stringifying a uniform buffer format, which
  // internally stores the scope.
  toJSON(key) {
    return undefined;
  }

  /**
   * Set variable value.
   *
   * @param {*} value - The value.
   */
  setValue(value) {
    // Set the new value
    this.value = value;

    // Increment the revision
    this.versionObject.increment();
  }

  /**
   * Get variable value.
   *
   * @returns {*} The value.
   */
  getValue() {
    return this.value;
  }
}

export { ScopeId };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NvcGUtaWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy9zY29wZS1pZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBWZXJzaW9uZWRPYmplY3QgfSBmcm9tICcuL3ZlcnNpb25lZC1vYmplY3QuanMnO1xuXG4vKipcbiAqIFRoZSBzY29wZSBmb3IgYSB2YXJpYWJsZS5cbiAqL1xuY2xhc3MgU2NvcGVJZCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjb3BlSWQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSB2YXJpYWJsZSBuYW1lLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB2YXJpYWJsZSBuYW1lLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcblxuICAgICAgICAvLyBTZXQgdGhlIGRlZmF1bHQgdmFsdWVcbiAgICAgICAgdGhpcy52YWx1ZSA9IG51bGw7XG5cbiAgICAgICAgLy8gQ3JlYXRlIHRoZSB2ZXJzaW9uIG9iamVjdFxuICAgICAgICB0aGlzLnZlcnNpb25PYmplY3QgPSBuZXcgVmVyc2lvbmVkT2JqZWN0KCk7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3Qgc3RyaW5naWZ5IFNjb3BlSWQgdG8gSlNPTiBieSBKU09OLnN0cmluZ2lmeSwgYXMgdGhpcyBzdG9yZXMgJ3ZhbHVlJ1xuICAgIC8vIHdoaWNoIGlzIG5vdCBuZWVkZWQuIFRoaXMgaXMgdXNlZCB3aGVuIHN0cmluZ2lmeWluZyBhIHVuaWZvcm0gYnVmZmVyIGZvcm1hdCwgd2hpY2hcbiAgICAvLyBpbnRlcm5hbGx5IHN0b3JlcyB0aGUgc2NvcGUuXG4gICAgdG9KU09OKGtleSkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB2YXJpYWJsZSB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgLSBUaGUgdmFsdWUuXG4gICAgICovXG4gICAgc2V0VmFsdWUodmFsdWUpIHtcbiAgICAgICAgLy8gU2V0IHRoZSBuZXcgdmFsdWVcbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuXG4gICAgICAgIC8vIEluY3JlbWVudCB0aGUgcmV2aXNpb25cbiAgICAgICAgdGhpcy52ZXJzaW9uT2JqZWN0LmluY3JlbWVudCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB2YXJpYWJsZSB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHsqfSBUaGUgdmFsdWUuXG4gICAgICovXG4gICAgZ2V0VmFsdWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2NvcGVJZCB9O1xuIl0sIm5hbWVzIjpbIlNjb3BlSWQiLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJ2YWx1ZSIsInZlcnNpb25PYmplY3QiLCJWZXJzaW9uZWRPYmplY3QiLCJ0b0pTT04iLCJrZXkiLCJ1bmRlZmluZWQiLCJzZXRWYWx1ZSIsImluY3JlbWVudCIsImdldFZhbHVlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsT0FBTyxDQUFDO0FBQ1Y7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxJQUFJLEVBQUU7QUFDZDtBQUNSO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQSxJQUFJLEdBQUdBLElBQUksQ0FBQTs7QUFFaEI7SUFDQSxJQUFJLENBQUNDLEtBQUssR0FBRyxJQUFJLENBQUE7O0FBRWpCO0FBQ0EsSUFBQSxJQUFJLENBQUNDLGFBQWEsR0FBRyxJQUFJQyxlQUFlLEVBQUUsQ0FBQTtBQUM5QyxHQUFBOztBQUVBO0FBQ0E7QUFDQTtFQUNBQyxNQUFNQSxDQUFDQyxHQUFHLEVBQUU7QUFDUixJQUFBLE9BQU9DLFNBQVMsQ0FBQTtBQUNwQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsUUFBUUEsQ0FBQ04sS0FBSyxFQUFFO0FBQ1o7SUFDQSxJQUFJLENBQUNBLEtBQUssR0FBR0EsS0FBSyxDQUFBOztBQUVsQjtBQUNBLElBQUEsSUFBSSxDQUFDQyxhQUFhLENBQUNNLFNBQVMsRUFBRSxDQUFBO0FBQ2xDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxRQUFRQSxHQUFHO0lBQ1AsT0FBTyxJQUFJLENBQUNSLEtBQUssQ0FBQTtBQUNyQixHQUFBO0FBQ0o7Ozs7In0=
