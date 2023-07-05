/**
 * A pool of reusable objects of the same type. Designed to promote reuse of objects to reduce
 * garbage collection.
 *
 * @ignore
 */
class ObjectPool {
  /**
   * @param {Function} constructorFunc - The constructor function for the objects in the pool.
   * @param {number} size - The initial number of object instances to allocate.
   */
  constructor(constructorFunc, size) {
    /**
     * Array of object instances.
     *
     * @type {object[]}
     * @private
     */
    this._pool = [];
    /**
     * The number of object instances that are currently allocated.
     *
     * @type {number}
     * @private
     */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JqZWN0LXBvb2wuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb3JlL29iamVjdC1wb29sLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQSBwb29sIG9mIHJldXNhYmxlIG9iamVjdHMgb2YgdGhlIHNhbWUgdHlwZS4gRGVzaWduZWQgdG8gcHJvbW90ZSByZXVzZSBvZiBvYmplY3RzIHRvIHJlZHVjZVxuICogZ2FyYmFnZSBjb2xsZWN0aW9uLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgT2JqZWN0UG9vbCB7XG4gICAgLyoqXG4gICAgICogQXJyYXkgb2Ygb2JqZWN0IGluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3RbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wb29sID0gW107XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbnVtYmVyIG9mIG9iamVjdCBpbnN0YW5jZXMgdGhhdCBhcmUgY3VycmVudGx5IGFsbG9jYXRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY291bnQgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY29uc3RydWN0b3JGdW5jIC0gVGhlIGNvbnN0cnVjdG9yIGZ1bmN0aW9uIGZvciB0aGUgb2JqZWN0cyBpbiB0aGUgcG9vbC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2l6ZSAtIFRoZSBpbml0aWFsIG51bWJlciBvZiBvYmplY3QgaW5zdGFuY2VzIHRvIGFsbG9jYXRlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNvbnN0cnVjdG9yRnVuYywgc2l6ZSkge1xuICAgICAgICB0aGlzLl9jb25zdHJ1Y3RvciA9IGNvbnN0cnVjdG9yRnVuYztcblxuICAgICAgICB0aGlzLl9yZXNpemUoc2l6ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNpemUgLSBUaGUgbnVtYmVyIG9mIG9iamVjdCBpbnN0YW5jZXMgdG8gYWxsb2NhdGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVzaXplKHNpemUpIHtcbiAgICAgICAgaWYgKHNpemUgPiB0aGlzLl9wb29sLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuX3Bvb2wubGVuZ3RoOyBpIDwgc2l6ZTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcG9vbFtpXSA9IG5ldyB0aGlzLl9jb25zdHJ1Y3RvcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBvYmplY3QgaW5zdGFuY2UgZnJvbSB0aGUgcG9vbC4gSWYgbm8gaW5zdGFuY2VzIGFyZSBhdmFpbGFibGUsIHRoZSBwb29sIHdpbGwgYmVcbiAgICAgKiBkb3VibGVkIGluIHNpemUgYW5kIGEgbmV3IGluc3RhbmNlIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSBBbiBvYmplY3QgaW5zdGFuY2UgZnJvbSB0aGUgcG9vbC5cbiAgICAgKi9cbiAgICBhbGxvY2F0ZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvdW50ID49IHRoaXMuX3Bvb2wubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNpemUodGhpcy5fcG9vbC5sZW5ndGggKiAyKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fcG9vbFt0aGlzLl9jb3VudCsrXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbGwgb2JqZWN0IGluc3RhbmNlcyBpbiB0aGUgcG9vbCB3aWxsIGJlIGF2YWlsYWJsZSBhZ2Fpbi4gVGhlIHBvb2wgaXRzZWxmIHdpbGwgbm90IGJlXG4gICAgICogcmVzaXplZC5cbiAgICAgKi9cbiAgICBmcmVlQWxsKCkge1xuICAgICAgICB0aGlzLl9jb3VudCA9IDA7XG4gICAgfVxufVxuXG5leHBvcnQgeyBPYmplY3RQb29sIH07XG4iXSwibmFtZXMiOlsiT2JqZWN0UG9vbCIsImNvbnN0cnVjdG9yIiwiY29uc3RydWN0b3JGdW5jIiwic2l6ZSIsIl9wb29sIiwiX2NvdW50IiwiX2NvbnN0cnVjdG9yIiwiX3Jlc2l6ZSIsImxlbmd0aCIsImkiLCJhbGxvY2F0ZSIsImZyZWVBbGwiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFVBQVUsQ0FBQztBQWlCYjtBQUNKO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxlQUFlLEVBQUVDLElBQUksRUFBRTtBQXBCbkM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUMsQ0FBQUEsS0FBSyxHQUFHLEVBQUUsQ0FBQTtBQUVWO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUxJLElBTUFDLENBQUFBLE1BQU0sR0FBRyxDQUFDLENBQUE7SUFPTixJQUFJLENBQUNDLFlBQVksR0FBR0osZUFBZSxDQUFBO0FBRW5DLElBQUEsSUFBSSxDQUFDSyxPQUFPLENBQUNKLElBQUksQ0FBQyxDQUFBO0FBQ3RCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7RUFDSUksT0FBT0EsQ0FBQ0osSUFBSSxFQUFFO0FBQ1YsSUFBQSxJQUFJQSxJQUFJLEdBQUcsSUFBSSxDQUFDQyxLQUFLLENBQUNJLE1BQU0sRUFBRTtBQUMxQixNQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLElBQUksQ0FBQ0wsS0FBSyxDQUFDSSxNQUFNLEVBQUVDLENBQUMsR0FBR04sSUFBSSxFQUFFTSxDQUFDLEVBQUUsRUFBRTtRQUMzQyxJQUFJLENBQUNMLEtBQUssQ0FBQ0ssQ0FBQyxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUNILFlBQVksRUFBRSxDQUFBO0FBQzNDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUksRUFBQUEsUUFBUUEsR0FBRztJQUNQLElBQUksSUFBSSxDQUFDTCxNQUFNLElBQUksSUFBSSxDQUFDRCxLQUFLLENBQUNJLE1BQU0sRUFBRTtNQUNsQyxJQUFJLENBQUNELE9BQU8sQ0FBQyxJQUFJLENBQUNILEtBQUssQ0FBQ0ksTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBQ3ZDLEtBQUE7SUFDQSxPQUFPLElBQUksQ0FBQ0osS0FBSyxDQUFDLElBQUksQ0FBQ0MsTUFBTSxFQUFFLENBQUMsQ0FBQTtBQUNwQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0lNLEVBQUFBLE9BQU9BLEdBQUc7SUFDTixJQUFJLENBQUNOLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDbkIsR0FBQTtBQUNKOzs7OyJ9
