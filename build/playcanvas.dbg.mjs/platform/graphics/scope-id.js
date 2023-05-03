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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NvcGUtaWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy9zY29wZS1pZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBWZXJzaW9uZWRPYmplY3QgfSBmcm9tICcuL3ZlcnNpb25lZC1vYmplY3QuanMnO1xuXG4vKipcbiAqIFRoZSBzY29wZSBmb3IgYSB2YXJpYWJsZS5cbiAqL1xuY2xhc3MgU2NvcGVJZCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjb3BlSWQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSB2YXJpYWJsZSBuYW1lLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB2YXJpYWJsZSBuYW1lLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcblxuICAgICAgICAvLyBTZXQgdGhlIGRlZmF1bHQgdmFsdWVcbiAgICAgICAgdGhpcy52YWx1ZSA9IG51bGw7XG5cbiAgICAgICAgLy8gQ3JlYXRlIHRoZSB2ZXJzaW9uIG9iamVjdFxuICAgICAgICB0aGlzLnZlcnNpb25PYmplY3QgPSBuZXcgVmVyc2lvbmVkT2JqZWN0KCk7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3Qgc3RyaW5naWZ5IFNjb3BlSWQgdG8gSlNPTiBieSBKU09OLnN0cmluZ2lmeSwgYXMgdGhpcyBzdG9yZXMgJ3ZhbHVlJ1xuICAgIC8vIHdoaWNoIGlzIG5vdCBuZWVkZWQuIFRoaXMgaXMgdXNlZCB3aGVuIHN0cmluZ2lmeWluZyBhIHVuaWZvcm0gYnVmZmVyIGZvcm1hdCwgd2hpY2hcbiAgICAvLyBpbnRlcm5hbGx5IHN0b3JlcyB0aGUgc2NvcGUuXG4gICAgdG9KU09OKGtleSkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB2YXJpYWJsZSB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgLSBUaGUgdmFsdWUuXG4gICAgICovXG4gICAgc2V0VmFsdWUodmFsdWUpIHtcbiAgICAgICAgLy8gU2V0IHRoZSBuZXcgdmFsdWVcbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuXG4gICAgICAgIC8vIEluY3JlbWVudCB0aGUgcmV2aXNpb25cbiAgICAgICAgdGhpcy52ZXJzaW9uT2JqZWN0LmluY3JlbWVudCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB2YXJpYWJsZSB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHsqfSBUaGUgdmFsdWUuXG4gICAgICovXG4gICAgZ2V0VmFsdWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2NvcGVJZCB9O1xuIl0sIm5hbWVzIjpbIlNjb3BlSWQiLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJ2YWx1ZSIsInZlcnNpb25PYmplY3QiLCJWZXJzaW9uZWRPYmplY3QiLCJ0b0pTT04iLCJrZXkiLCJ1bmRlZmluZWQiLCJzZXRWYWx1ZSIsImluY3JlbWVudCIsImdldFZhbHVlIl0sIm1hcHBpbmdzIjoiOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLE9BQU8sQ0FBQztBQUNWO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsSUFBSSxFQUFFO0FBQ2Q7QUFDUjtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0EsSUFBSSxHQUFHQSxJQUFJLENBQUE7O0FBRWhCO0lBQ0EsSUFBSSxDQUFDQyxLQUFLLEdBQUcsSUFBSSxDQUFBOztBQUVqQjtBQUNBLElBQUEsSUFBSSxDQUFDQyxhQUFhLEdBQUcsSUFBSUMsZUFBZSxFQUFFLENBQUE7QUFDOUMsR0FBQTs7QUFFQTtBQUNBO0FBQ0E7RUFDQUMsTUFBTUEsQ0FBQ0MsR0FBRyxFQUFFO0FBQ1IsSUFBQSxPQUFPQyxTQUFTLENBQUE7QUFDcEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFFBQVFBLENBQUNOLEtBQUssRUFBRTtBQUNaO0lBQ0EsSUFBSSxDQUFDQSxLQUFLLEdBQUdBLEtBQUssQ0FBQTs7QUFFbEI7QUFDQSxJQUFBLElBQUksQ0FBQ0MsYUFBYSxDQUFDTSxTQUFTLEVBQUUsQ0FBQTtBQUNsQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsUUFBUUEsR0FBRztJQUNQLE9BQU8sSUFBSSxDQUFDUixLQUFLLENBQUE7QUFDckIsR0FBQTtBQUNKOzs7OyJ9
