/**
 * Base class that implements reference counting for objects.
 *
 * @ignore
 */
class RefCountedObject {
  constructor() {
    /**
     * @type {number}
     * @private
     */
    this._refCount = 0;
  }
  /**
   * Increments the reference counter.
   */
  incRefCount() {
    this._refCount++;
  }

  /**
   * Decrements the reference counter.
   */
  decRefCount() {
    this._refCount--;
  }

  /**
   * The current reference count.
   *
   * @type {number}
   */
  get refCount() {
    return this._refCount;
  }
}

export { RefCountedObject };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVmLWNvdW50ZWQtb2JqZWN0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29yZS9yZWYtY291bnRlZC1vYmplY3QuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBCYXNlIGNsYXNzIHRoYXQgaW1wbGVtZW50cyByZWZlcmVuY2UgY291bnRpbmcgZm9yIG9iamVjdHMuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZWZDb3VudGVkT2JqZWN0IHtcbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlZkNvdW50ID0gMDtcblxuICAgIC8qKlxuICAgICAqIEluY3JlbWVudHMgdGhlIHJlZmVyZW5jZSBjb3VudGVyLlxuICAgICAqL1xuICAgIGluY1JlZkNvdW50KCkge1xuICAgICAgICB0aGlzLl9yZWZDb3VudCsrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlY3JlbWVudHMgdGhlIHJlZmVyZW5jZSBjb3VudGVyLlxuICAgICAqL1xuICAgIGRlY1JlZkNvdW50KCkge1xuICAgICAgICB0aGlzLl9yZWZDb3VudC0tO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IHJlZmVyZW5jZSBjb3VudC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHJlZkNvdW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVmQ291bnQ7XG4gICAgfVxufVxuXG5leHBvcnQgeyBSZWZDb3VudGVkT2JqZWN0IH07XG4iXSwibmFtZXMiOlsiUmVmQ291bnRlZE9iamVjdCIsImNvbnN0cnVjdG9yIiwiX3JlZkNvdW50IiwiaW5jUmVmQ291bnQiLCJkZWNSZWZDb3VudCIsInJlZkNvdW50Il0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZ0JBQWdCLENBQUM7RUFBQUMsV0FBQSxHQUFBO0FBQ25CO0FBQ0o7QUFDQTtBQUNBO0lBSEksSUFJQUMsQ0FBQUEsU0FBUyxHQUFHLENBQUMsQ0FBQTtBQUFBLEdBQUE7QUFFYjtBQUNKO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsR0FBRztJQUNWLElBQUksQ0FBQ0QsU0FBUyxFQUFFLENBQUE7QUFDcEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDSUUsRUFBQUEsV0FBV0EsR0FBRztJQUNWLElBQUksQ0FBQ0YsU0FBUyxFQUFFLENBQUE7QUFDcEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUcsUUFBUUEsR0FBRztJQUNYLE9BQU8sSUFBSSxDQUFDSCxTQUFTLENBQUE7QUFDekIsR0FBQTtBQUNKOzs7OyJ9
