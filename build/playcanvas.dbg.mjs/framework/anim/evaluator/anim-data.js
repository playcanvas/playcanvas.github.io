/**
 * Wraps a set of data used in animation.
 */
class AnimData {
  /**
   * Create a new animation AnimData instance.
   *
   * @param {number} components - Specifies how many components make up an element of data. For
   * example, specify 3 for a set of 3-dimensional vectors. The number of elements in data array
   * must be a multiple of components.
   * @param {Float32Array|number[]} data - The set of data.
   */
  constructor(components, data) {
    this._components = components;
    this._data = data;
  }

  /**
   * Gets the number of components that make up an element.
   *
   * @type {number}
   */
  get components() {
    return this._components;
  }

  /**
   * Gets the data.
   *
   * @type {Float32Array|number[]}
   */
  get data() {
    return this._data;
  }
}

export { AnimData };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1kYXRhLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2FuaW0vZXZhbHVhdG9yL2FuaW0tZGF0YS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFdyYXBzIGEgc2V0IG9mIGRhdGEgdXNlZCBpbiBhbmltYXRpb24uXG4gKi9cbmNsYXNzIEFuaW1EYXRhIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgYW5pbWF0aW9uIEFuaW1EYXRhIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNvbXBvbmVudHMgLSBTcGVjaWZpZXMgaG93IG1hbnkgY29tcG9uZW50cyBtYWtlIHVwIGFuIGVsZW1lbnQgb2YgZGF0YS4gRm9yXG4gICAgICogZXhhbXBsZSwgc3BlY2lmeSAzIGZvciBhIHNldCBvZiAzLWRpbWVuc2lvbmFsIHZlY3RvcnMuIFRoZSBudW1iZXIgb2YgZWxlbWVudHMgaW4gZGF0YSBhcnJheVxuICAgICAqIG11c3QgYmUgYSBtdWx0aXBsZSBvZiBjb21wb25lbnRzLlxuICAgICAqIEBwYXJhbSB7RmxvYXQzMkFycmF5fG51bWJlcltdfSBkYXRhIC0gVGhlIHNldCBvZiBkYXRhLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNvbXBvbmVudHMsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5fY29tcG9uZW50cyA9IGNvbXBvbmVudHM7XG4gICAgICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIG51bWJlciBvZiBjb21wb25lbnRzIHRoYXQgbWFrZSB1cCBhbiBlbGVtZW50LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgY29tcG9uZW50cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBvbmVudHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyB0aGUgZGF0YS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtGbG9hdDMyQXJyYXl8bnVtYmVyW119XG4gICAgICovXG4gICAgZ2V0IGRhdGEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQW5pbURhdGEgfTtcbiJdLCJuYW1lcyI6WyJBbmltRGF0YSIsImNvbnN0cnVjdG9yIiwiY29tcG9uZW50cyIsImRhdGEiLCJfY29tcG9uZW50cyIsIl9kYXRhIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxRQUFRLENBQUM7QUFDWDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLFVBQVUsRUFBRUMsSUFBSSxFQUFFO0lBQzFCLElBQUksQ0FBQ0MsV0FBVyxHQUFHRixVQUFVLENBQUE7SUFDN0IsSUFBSSxDQUFDRyxLQUFLLEdBQUdGLElBQUksQ0FBQTtBQUNyQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJRCxVQUFVQSxHQUFHO0lBQ2IsT0FBTyxJQUFJLENBQUNFLFdBQVcsQ0FBQTtBQUMzQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJRCxJQUFJQSxHQUFHO0lBQ1AsT0FBTyxJQUFJLENBQUNFLEtBQUssQ0FBQTtBQUNyQixHQUFBO0FBQ0o7Ozs7In0=
