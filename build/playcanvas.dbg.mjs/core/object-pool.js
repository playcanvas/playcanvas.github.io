/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * A pool of reusable objects of the same type. Designed to promote reuse of objects to reduce
 * garbage collection.
 *
 * @ignore
 */
class ObjectPool {
  /**
   * @type {object[]} - Array of object instances.
   * @private
   */

  /**
   * @type {number} - The number of object instances that are currently allocated.
   * @private
   */

  /**
   * @param {Function} constructorFunc - The constructor function for the objects in the pool.
   * @param {number} size - The initial number of object instances to allocate.
   */
  constructor(constructorFunc, size) {
    this._pool = [];
    this._count = 0;
    this._constructor = constructorFunc;
    this._resize(size);
  }

  /**
   * @param {number} size - The number of object instances to allocate.
   * @private
   */
  _resize(size) {
    if (size > this._pool.length) {
      for (let i = this._pool.length; i < size; i++) {
        this._pool[i] = new this._constructor();
      }
    }
  }

  /**
   * Returns an object instance from the pool. If no instances are available, the pool will be
   * doubled in size and a new instance will be returned.
   *
   * @returns {object} An object instance from the pool.
   */
  allocate() {
    if (this._count >= this._pool.length) {
      this._resize(this._pool.length * 2);
    }
    return this._pool[this._count++];
  }

  /**
   * All object instances in the pool will be available again. The pool itself will not be
   * resized.
   */
  freeAll() {
    this._count = 0;
  }
}

export { ObjectPool };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JqZWN0LXBvb2wuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb3JlL29iamVjdC1wb29sLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSBwb29sIG9mIHJldXNhYmxlIG9iamVjdHMgb2YgdGhlIHNhbWUgdHlwZS4gRGVzaWduZWQgdG8gcHJvbW90ZSByZXVzZSBvZiBvYmplY3RzIHRvIHJlZHVjZVxuICogZ2FyYmFnZSBjb2xsZWN0aW9uLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgT2JqZWN0UG9vbCB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge29iamVjdFtdfSAtIEFycmF5IG9mIG9iamVjdCBpbnN0YW5jZXMuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcG9vbCA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcn0gLSBUaGUgbnVtYmVyIG9mIG9iamVjdCBpbnN0YW5jZXMgdGhhdCBhcmUgY3VycmVudGx5IGFsbG9jYXRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jb3VudCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb25zdHJ1Y3RvckZ1bmMgLSBUaGUgY29uc3RydWN0b3IgZnVuY3Rpb24gZm9yIHRoZSBvYmplY3RzIGluIHRoZSBwb29sLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzaXplIC0gVGhlIGluaXRpYWwgbnVtYmVyIG9mIG9iamVjdCBpbnN0YW5jZXMgdG8gYWxsb2NhdGUuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY29uc3RydWN0b3JGdW5jLCBzaXplKSB7XG4gICAgICAgIHRoaXMuX2NvbnN0cnVjdG9yID0gY29uc3RydWN0b3JGdW5jO1xuXG4gICAgICAgIHRoaXMuX3Jlc2l6ZShzaXplKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2l6ZSAtIFRoZSBudW1iZXIgb2Ygb2JqZWN0IGluc3RhbmNlcyB0byBhbGxvY2F0ZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZXNpemUoc2l6ZSkge1xuICAgICAgICBpZiAoc2l6ZSA+IHRoaXMuX3Bvb2wubGVuZ3RoKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5fcG9vbC5sZW5ndGg7IGkgPCBzaXplOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wb29sW2ldID0gbmV3IHRoaXMuX2NvbnN0cnVjdG9yKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIG9iamVjdCBpbnN0YW5jZSBmcm9tIHRoZSBwb29sLiBJZiBubyBpbnN0YW5jZXMgYXJlIGF2YWlsYWJsZSwgdGhlIHBvb2wgd2lsbCBiZVxuICAgICAqIGRvdWJsZWQgaW4gc2l6ZSBhbmQgYSBuZXcgaW5zdGFuY2Ugd2lsbCBiZSByZXR1cm5lZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IEFuIG9iamVjdCBpbnN0YW5jZSBmcm9tIHRoZSBwb29sLlxuICAgICAqL1xuICAgIGFsbG9jYXRlKCkge1xuICAgICAgICBpZiAodGhpcy5fY291bnQgPj0gdGhpcy5fcG9vbC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2l6ZSh0aGlzLl9wb29sLmxlbmd0aCAqIDIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9wb29sW3RoaXMuX2NvdW50KytdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFsbCBvYmplY3QgaW5zdGFuY2VzIGluIHRoZSBwb29sIHdpbGwgYmUgYXZhaWxhYmxlIGFnYWluLiBUaGUgcG9vbCBpdHNlbGYgd2lsbCBub3QgYmVcbiAgICAgKiByZXNpemVkLlxuICAgICAqL1xuICAgIGZyZWVBbGwoKSB7XG4gICAgICAgIHRoaXMuX2NvdW50ID0gMDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IE9iamVjdFBvb2wgfTtcbiJdLCJuYW1lcyI6WyJPYmplY3RQb29sIiwiY29uc3RydWN0b3IiLCJjb25zdHJ1Y3RvckZ1bmMiLCJzaXplIiwiX3Bvb2wiLCJfY291bnQiLCJfY29uc3RydWN0b3IiLCJfcmVzaXplIiwibGVuZ3RoIiwiaSIsImFsbG9jYXRlIiwiZnJlZUFsbCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxVQUFVLENBQUM7QUFDYjtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXLENBQUNDLGVBQWUsRUFBRUMsSUFBSSxFQUFFO0lBQUEsSUFabkNDLENBQUFBLEtBQUssR0FBRyxFQUFFLENBQUE7SUFBQSxJQU1WQyxDQUFBQSxNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBT04sSUFBSSxDQUFDQyxZQUFZLEdBQUdKLGVBQWUsQ0FBQTtBQUVuQyxJQUFBLElBQUksQ0FBQ0ssT0FBTyxDQUFDSixJQUFJLENBQUMsQ0FBQTtBQUN0QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0VBQ0lJLE9BQU8sQ0FBQ0osSUFBSSxFQUFFO0FBQ1YsSUFBQSxJQUFJQSxJQUFJLEdBQUcsSUFBSSxDQUFDQyxLQUFLLENBQUNJLE1BQU0sRUFBRTtBQUMxQixNQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLElBQUksQ0FBQ0wsS0FBSyxDQUFDSSxNQUFNLEVBQUVDLENBQUMsR0FBR04sSUFBSSxFQUFFTSxDQUFDLEVBQUUsRUFBRTtRQUMzQyxJQUFJLENBQUNMLEtBQUssQ0FBQ0ssQ0FBQyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUNILFlBQVksRUFBRSxDQUFBO0FBQzNDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUksRUFBQUEsUUFBUSxHQUFHO0lBQ1AsSUFBSSxJQUFJLENBQUNMLE1BQU0sSUFBSSxJQUFJLENBQUNELEtBQUssQ0FBQ0ksTUFBTSxFQUFFO01BQ2xDLElBQUksQ0FBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQ0gsS0FBSyxDQUFDSSxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUE7QUFDdkMsS0FBQTtJQUNBLE9BQU8sSUFBSSxDQUFDSixLQUFLLENBQUMsSUFBSSxDQUFDQyxNQUFNLEVBQUUsQ0FBQyxDQUFBO0FBQ3BDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDSU0sRUFBQUEsT0FBTyxHQUFHO0lBQ04sSUFBSSxDQUFDTixNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ25CLEdBQUE7QUFDSjs7OzsifQ==
