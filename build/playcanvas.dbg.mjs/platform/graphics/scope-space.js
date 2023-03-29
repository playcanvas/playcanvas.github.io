/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { ScopeId } from './scope-id.js';

/**
 * The scope for variables.
 */
class ScopeSpace {
  /**
   * Create a new ScopeSpace instance.
   *
   * @param {string} name - The scope name.
   */
  constructor(name) {
    /**
     * The scope name.
     *
     * @type {string}
     */
    this.name = name;

    // Create map which maps a uniform name into ScopeId
    this.variables = new Map();
  }

  /**
   * Get (or create, if it doesn't already exist) a variable in the scope.
   *
   * @param {string} name - The variable name.
   * @returns {ScopeId} The variable instance.
   */
  resolve(name) {
    // add new ScopeId if it does not exist yet
    if (!this.variables.has(name)) {
      this.variables.set(name, new ScopeId(name));
    }

    // return the ScopeId instance
    return this.variables.get(name);
  }

  /**
   * Clears value for any uniform with matching value (used to remove deleted textures).
   *
   * @param {*} value - The value to clear.
   * @ignore
   */
  removeValue(value) {
    for (const uniformName in this.variables) {
      const uniform = this.variables[uniformName];
      if (uniform.value === value) {
        uniform.value = null;
      }
    }
  }
}

export { ScopeSpace };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NvcGUtc3BhY2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy9zY29wZS1zcGFjZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTY29wZUlkIH0gZnJvbSAnLi9zY29wZS1pZC5qcyc7XG5cbi8qKlxuICogVGhlIHNjb3BlIGZvciB2YXJpYWJsZXMuXG4gKi9cbmNsYXNzIFNjb3BlU3BhY2Uge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTY29wZVNwYWNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgc2NvcGUgbmFtZS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2NvcGUgbmFtZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWU7XG5cbiAgICAgICAgLy8gQ3JlYXRlIG1hcCB3aGljaCBtYXBzIGEgdW5pZm9ybSBuYW1lIGludG8gU2NvcGVJZFxuICAgICAgICB0aGlzLnZhcmlhYmxlcyA9IG5ldyBNYXAoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgKG9yIGNyZWF0ZSwgaWYgaXQgZG9lc24ndCBhbHJlYWR5IGV4aXN0KSBhIHZhcmlhYmxlIGluIHRoZSBzY29wZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIHZhcmlhYmxlIG5hbWUuXG4gICAgICogQHJldHVybnMge1Njb3BlSWR9IFRoZSB2YXJpYWJsZSBpbnN0YW5jZS5cbiAgICAgKi9cbiAgICByZXNvbHZlKG5hbWUpIHtcbiAgICAgICAgLy8gYWRkIG5ldyBTY29wZUlkIGlmIGl0IGRvZXMgbm90IGV4aXN0IHlldFxuICAgICAgICBpZiAoIXRoaXMudmFyaWFibGVzLmhhcyhuYW1lKSkge1xuICAgICAgICAgICAgdGhpcy52YXJpYWJsZXMuc2V0KG5hbWUsIG5ldyBTY29wZUlkKG5hbWUpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJldHVybiB0aGUgU2NvcGVJZCBpbnN0YW5jZVxuICAgICAgICByZXR1cm4gdGhpcy52YXJpYWJsZXMuZ2V0KG5hbWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsZWFycyB2YWx1ZSBmb3IgYW55IHVuaWZvcm0gd2l0aCBtYXRjaGluZyB2YWx1ZSAodXNlZCB0byByZW1vdmUgZGVsZXRlZCB0ZXh0dXJlcykuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIC0gVGhlIHZhbHVlIHRvIGNsZWFyLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZW1vdmVWYWx1ZSh2YWx1ZSkge1xuICAgICAgICBmb3IgKGNvbnN0IHVuaWZvcm1OYW1lIGluIHRoaXMudmFyaWFibGVzKSB7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtID0gdGhpcy52YXJpYWJsZXNbdW5pZm9ybU5hbWVdO1xuICAgICAgICAgICAgaWYgKHVuaWZvcm0udmFsdWUgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdW5pZm9ybS52YWx1ZSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IFNjb3BlU3BhY2UgfTtcbiJdLCJuYW1lcyI6WyJTY29wZVNwYWNlIiwiY29uc3RydWN0b3IiLCJuYW1lIiwidmFyaWFibGVzIiwiTWFwIiwicmVzb2x2ZSIsImhhcyIsInNldCIsIlNjb3BlSWQiLCJnZXQiLCJyZW1vdmVWYWx1ZSIsInZhbHVlIiwidW5pZm9ybU5hbWUiLCJ1bmlmb3JtIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsVUFBVSxDQUFDO0FBQ2I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXLENBQUNDLElBQUksRUFBRTtBQUNkO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNBLElBQUksR0FBR0EsSUFBSSxDQUFBOztBQUVoQjtBQUNBLElBQUEsSUFBSSxDQUFDQyxTQUFTLEdBQUcsSUFBSUMsR0FBRyxFQUFFLENBQUE7QUFDOUIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsT0FBTyxDQUFDSCxJQUFJLEVBQUU7QUFDVjtJQUNBLElBQUksQ0FBQyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0csR0FBRyxDQUFDSixJQUFJLENBQUMsRUFBRTtBQUMzQixNQUFBLElBQUksQ0FBQ0MsU0FBUyxDQUFDSSxHQUFHLENBQUNMLElBQUksRUFBRSxJQUFJTSxPQUFPLENBQUNOLElBQUksQ0FBQyxDQUFDLENBQUE7QUFDL0MsS0FBQTs7QUFFQTtBQUNBLElBQUEsT0FBTyxJQUFJLENBQUNDLFNBQVMsQ0FBQ00sR0FBRyxDQUFDUCxJQUFJLENBQUMsQ0FBQTtBQUNuQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJUSxXQUFXLENBQUNDLEtBQUssRUFBRTtBQUNmLElBQUEsS0FBSyxNQUFNQyxXQUFXLElBQUksSUFBSSxDQUFDVCxTQUFTLEVBQUU7QUFDdEMsTUFBQSxNQUFNVSxPQUFPLEdBQUcsSUFBSSxDQUFDVixTQUFTLENBQUNTLFdBQVcsQ0FBQyxDQUFBO0FBQzNDLE1BQUEsSUFBSUMsT0FBTyxDQUFDRixLQUFLLEtBQUtBLEtBQUssRUFBRTtRQUN6QkUsT0FBTyxDQUFDRixLQUFLLEdBQUcsSUFBSSxDQUFBO0FBQ3hCLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUNKOzs7OyJ9
