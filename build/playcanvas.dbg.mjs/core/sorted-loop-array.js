/**
 * Helper class used to hold an array of items in a specific order. This array is safe to modify
 * while we loop through it. The class assumes that it holds objects that need to be sorted based
 * on one of their fields.
 *
 * @ignore
 */
class SortedLoopArray {
  /**
   * Create a new SortedLoopArray instance.
   *
   * @param {object} args - Arguments.
   * @param {string} args.sortBy - The name of the field that each element in the array is going
   * to be sorted by.
   * @example
   * const array = new pc.SortedLoopArray({ sortBy: 'priority' });
   * array.insert(item); // adds item to the right slot based on item.priority
   * array.append(item); // adds item to the end of the array
   * array.remove(item); // removes item from array
   * for (array.loopIndex = 0; array.loopIndex < array.length; array.loopIndex++) {
   *   // do things with array elements
   *   // safe to remove and add elements into the array while looping
   * }
   */
  constructor(args) {
    /**
     * The internal array that holds the actual array elements.
     *
     * @type {object[]}
     */
    this.items = [];
    /**
     * The number of elements in the array.
     *
     * @type {number}
     */
    this.length = 0;
    /**
     * The current index used to loop through the array. This gets modified if we add or remove
     * elements from the array while looping. See the example to see how to loop through this
     * array.
     *
     * @type {number}
     */
    this.loopIndex = -1;
    /** @private */
    this._sortBy = void 0;
    /** @private */
    this._sortHandler = void 0;
    this._sortBy = args.sortBy;
    this._sortHandler = this._doSort.bind(this);
  }

  /**
   * Searches for the right spot to insert the specified item.
   *
   * @param {object} item - The item.
   * @returns {number} The index where to insert the item.
   * @private
   */
  _binarySearch(item) {
    let left = 0;
    let right = this.items.length - 1;
    const search = item[this._sortBy];
    let middle;
    let current;
    while (left <= right) {
      middle = Math.floor((left + right) / 2);
      current = this.items[middle][this._sortBy];
      if (current <= search) {
        left = middle + 1;
      } else if (current > search) {
        right = middle - 1;
      }
    }
    return left;
  }
  _doSort(a, b) {
    const sortBy = this._sortBy;
    return a[sortBy] - b[sortBy];
  }

  /**
   * Inserts the specified item into the array at the right index based on the 'sortBy' field
   * passed into the constructor. This also adjusts the loopIndex accordingly.
   *
   * @param {object} item - The item to insert.
   */
  insert(item) {
    const index = this._binarySearch(item);
    this.items.splice(index, 0, item);
    this.length++;
    if (this.loopIndex >= index) {
      this.loopIndex++;
    }
  }

  /**
   * Appends the specified item to the end of the array. Faster than insert() as it does not
   * binary search for the right index. This also adjusts the loopIndex accordingly.
   *
   * @param {object} item - The item to append.
   */
  append(item) {
    this.items.push(item);
    this.length++;
  }

  /**
   * Removes the specified item from the array.
   *
   * @param {object} item - The item to remove.
   */
  remove(item) {
    const idx = this.items.indexOf(item);
    if (idx < 0) return;
    this.items.splice(idx, 1);
    this.length--;
    if (this.loopIndex >= idx) {
      this.loopIndex--;
    }
  }

  /**
   * Sorts elements in the array based on the 'sortBy' field passed into the constructor. This
   * also updates the loopIndex if we are currently looping.
   *
   * WARNING: Be careful if you are sorting while iterating because if after sorting the array
   * element that you are currently processing is moved behind other elements then you might end
   * up iterating over elements more than once!
   */
  sort() {
    // get current item pointed to by loopIndex
    const current = this.loopIndex >= 0 ? this.items[this.loopIndex] : null;
    // sort
    this.items.sort(this._sortHandler);
    // find new loopIndex
    if (current !== null) {
      this.loopIndex = this.items.indexOf(current);
    }
  }
}

export { SortedLoopArray };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29ydGVkLWxvb3AtYXJyYXkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb3JlL3NvcnRlZC1sb29wLWFycmF5LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSGVscGVyIGNsYXNzIHVzZWQgdG8gaG9sZCBhbiBhcnJheSBvZiBpdGVtcyBpbiBhIHNwZWNpZmljIG9yZGVyLiBUaGlzIGFycmF5IGlzIHNhZmUgdG8gbW9kaWZ5XG4gKiB3aGlsZSB3ZSBsb29wIHRocm91Z2ggaXQuIFRoZSBjbGFzcyBhc3N1bWVzIHRoYXQgaXQgaG9sZHMgb2JqZWN0cyB0aGF0IG5lZWQgdG8gYmUgc29ydGVkIGJhc2VkXG4gKiBvbiBvbmUgb2YgdGhlaXIgZmllbGRzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgU29ydGVkTG9vcEFycmF5IHtcbiAgICAvKipcbiAgICAgKiBUaGUgaW50ZXJuYWwgYXJyYXkgdGhhdCBob2xkcyB0aGUgYWN0dWFsIGFycmF5IGVsZW1lbnRzLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdFtdfVxuICAgICAqL1xuICAgIGl0ZW1zID0gW107XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgbGVuZ3RoID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGluZGV4IHVzZWQgdG8gbG9vcCB0aHJvdWdoIHRoZSBhcnJheS4gVGhpcyBnZXRzIG1vZGlmaWVkIGlmIHdlIGFkZCBvciByZW1vdmVcbiAgICAgKiBlbGVtZW50cyBmcm9tIHRoZSBhcnJheSB3aGlsZSBsb29waW5nLiBTZWUgdGhlIGV4YW1wbGUgdG8gc2VlIGhvdyB0byBsb29wIHRocm91Z2ggdGhpc1xuICAgICAqIGFycmF5LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBsb29wSW5kZXggPSAtMTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9zb3J0Qnk7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc29ydEhhbmRsZXI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU29ydGVkTG9vcEFycmF5IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGFyZ3MgLSBBcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGFyZ3Muc29ydEJ5IC0gVGhlIG5hbWUgb2YgdGhlIGZpZWxkIHRoYXQgZWFjaCBlbGVtZW50IGluIHRoZSBhcnJheSBpcyBnb2luZ1xuICAgICAqIHRvIGJlIHNvcnRlZCBieS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFycmF5ID0gbmV3IHBjLlNvcnRlZExvb3BBcnJheSh7IHNvcnRCeTogJ3ByaW9yaXR5JyB9KTtcbiAgICAgKiBhcnJheS5pbnNlcnQoaXRlbSk7IC8vIGFkZHMgaXRlbSB0byB0aGUgcmlnaHQgc2xvdCBiYXNlZCBvbiBpdGVtLnByaW9yaXR5XG4gICAgICogYXJyYXkuYXBwZW5kKGl0ZW0pOyAvLyBhZGRzIGl0ZW0gdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXlcbiAgICAgKiBhcnJheS5yZW1vdmUoaXRlbSk7IC8vIHJlbW92ZXMgaXRlbSBmcm9tIGFycmF5XG4gICAgICogZm9yIChhcnJheS5sb29wSW5kZXggPSAwOyBhcnJheS5sb29wSW5kZXggPCBhcnJheS5sZW5ndGg7IGFycmF5Lmxvb3BJbmRleCsrKSB7XG4gICAgICogICAvLyBkbyB0aGluZ3Mgd2l0aCBhcnJheSBlbGVtZW50c1xuICAgICAqICAgLy8gc2FmZSB0byByZW1vdmUgYW5kIGFkZCBlbGVtZW50cyBpbnRvIHRoZSBhcnJheSB3aGlsZSBsb29waW5nXG4gICAgICogfVxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFyZ3MpIHtcbiAgICAgICAgdGhpcy5fc29ydEJ5ID0gYXJncy5zb3J0Qnk7XG4gICAgICAgIHRoaXMuX3NvcnRIYW5kbGVyID0gdGhpcy5fZG9Tb3J0LmJpbmQodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VhcmNoZXMgZm9yIHRoZSByaWdodCBzcG90IHRvIGluc2VydCB0aGUgc3BlY2lmaWVkIGl0ZW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gaXRlbSAtIFRoZSBpdGVtLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBpbmRleCB3aGVyZSB0byBpbnNlcnQgdGhlIGl0ZW0uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYmluYXJ5U2VhcmNoKGl0ZW0pIHtcbiAgICAgICAgbGV0IGxlZnQgPSAwO1xuICAgICAgICBsZXQgcmlnaHQgPSB0aGlzLml0ZW1zLmxlbmd0aCAtIDE7XG4gICAgICAgIGNvbnN0IHNlYXJjaCA9IGl0ZW1bdGhpcy5fc29ydEJ5XTtcblxuICAgICAgICBsZXQgbWlkZGxlO1xuICAgICAgICBsZXQgY3VycmVudDtcbiAgICAgICAgd2hpbGUgKGxlZnQgPD0gcmlnaHQpIHtcbiAgICAgICAgICAgIG1pZGRsZSA9IE1hdGguZmxvb3IoKGxlZnQgKyByaWdodCkgLyAyKTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSB0aGlzLml0ZW1zW21pZGRsZV1bdGhpcy5fc29ydEJ5XTtcbiAgICAgICAgICAgIGlmIChjdXJyZW50IDw9IHNlYXJjaCkge1xuICAgICAgICAgICAgICAgIGxlZnQgPSBtaWRkbGUgKyAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjdXJyZW50ID4gc2VhcmNoKSB7XG4gICAgICAgICAgICAgICAgcmlnaHQgPSBtaWRkbGUgLSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxlZnQ7XG4gICAgfVxuXG4gICAgX2RvU29ydChhLCBiKSB7XG4gICAgICAgIGNvbnN0IHNvcnRCeSA9IHRoaXMuX3NvcnRCeTtcbiAgICAgICAgcmV0dXJuIGFbc29ydEJ5XSAtIGJbc29ydEJ5XTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnRzIHRoZSBzcGVjaWZpZWQgaXRlbSBpbnRvIHRoZSBhcnJheSBhdCB0aGUgcmlnaHQgaW5kZXggYmFzZWQgb24gdGhlICdzb3J0QnknIGZpZWxkXG4gICAgICogcGFzc2VkIGludG8gdGhlIGNvbnN0cnVjdG9yLiBUaGlzIGFsc28gYWRqdXN0cyB0aGUgbG9vcEluZGV4IGFjY29yZGluZ2x5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGl0ZW0gLSBUaGUgaXRlbSB0byBpbnNlcnQuXG4gICAgICovXG4gICAgaW5zZXJ0KGl0ZW0pIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9iaW5hcnlTZWFyY2goaXRlbSk7XG4gICAgICAgIHRoaXMuaXRlbXMuc3BsaWNlKGluZGV4LCAwLCBpdGVtKTtcbiAgICAgICAgdGhpcy5sZW5ndGgrKztcbiAgICAgICAgaWYgKHRoaXMubG9vcEluZGV4ID49IGluZGV4KSB7XG4gICAgICAgICAgICB0aGlzLmxvb3BJbmRleCsrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwZW5kcyB0aGUgc3BlY2lmaWVkIGl0ZW0gdG8gdGhlIGVuZCBvZiB0aGUgYXJyYXkuIEZhc3RlciB0aGFuIGluc2VydCgpIGFzIGl0IGRvZXMgbm90XG4gICAgICogYmluYXJ5IHNlYXJjaCBmb3IgdGhlIHJpZ2h0IGluZGV4LiBUaGlzIGFsc28gYWRqdXN0cyB0aGUgbG9vcEluZGV4IGFjY29yZGluZ2x5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGl0ZW0gLSBUaGUgaXRlbSB0byBhcHBlbmQuXG4gICAgICovXG4gICAgYXBwZW5kKGl0ZW0pIHtcbiAgICAgICAgdGhpcy5pdGVtcy5wdXNoKGl0ZW0pO1xuICAgICAgICB0aGlzLmxlbmd0aCsrO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhlIHNwZWNpZmllZCBpdGVtIGZyb20gdGhlIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGl0ZW0gLSBUaGUgaXRlbSB0byByZW1vdmUuXG4gICAgICovXG4gICAgcmVtb3ZlKGl0ZW0pIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5pdGVtcy5pbmRleE9mKGl0ZW0pO1xuICAgICAgICBpZiAoaWR4IDwgMCkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuaXRlbXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgIHRoaXMubGVuZ3RoLS07XG4gICAgICAgIGlmICh0aGlzLmxvb3BJbmRleCA+PSBpZHgpIHtcbiAgICAgICAgICAgIHRoaXMubG9vcEluZGV4LS07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTb3J0cyBlbGVtZW50cyBpbiB0aGUgYXJyYXkgYmFzZWQgb24gdGhlICdzb3J0QnknIGZpZWxkIHBhc3NlZCBpbnRvIHRoZSBjb25zdHJ1Y3Rvci4gVGhpc1xuICAgICAqIGFsc28gdXBkYXRlcyB0aGUgbG9vcEluZGV4IGlmIHdlIGFyZSBjdXJyZW50bHkgbG9vcGluZy5cbiAgICAgKlxuICAgICAqIFdBUk5JTkc6IEJlIGNhcmVmdWwgaWYgeW91IGFyZSBzb3J0aW5nIHdoaWxlIGl0ZXJhdGluZyBiZWNhdXNlIGlmIGFmdGVyIHNvcnRpbmcgdGhlIGFycmF5XG4gICAgICogZWxlbWVudCB0aGF0IHlvdSBhcmUgY3VycmVudGx5IHByb2Nlc3NpbmcgaXMgbW92ZWQgYmVoaW5kIG90aGVyIGVsZW1lbnRzIHRoZW4geW91IG1pZ2h0IGVuZFxuICAgICAqIHVwIGl0ZXJhdGluZyBvdmVyIGVsZW1lbnRzIG1vcmUgdGhhbiBvbmNlIVxuICAgICAqL1xuICAgIHNvcnQoKSB7XG4gICAgICAgIC8vIGdldCBjdXJyZW50IGl0ZW0gcG9pbnRlZCB0byBieSBsb29wSW5kZXhcbiAgICAgICAgY29uc3QgY3VycmVudCA9ICh0aGlzLmxvb3BJbmRleCA+PSAwID8gdGhpcy5pdGVtc1t0aGlzLmxvb3BJbmRleF0gOiBudWxsKTtcbiAgICAgICAgLy8gc29ydFxuICAgICAgICB0aGlzLml0ZW1zLnNvcnQodGhpcy5fc29ydEhhbmRsZXIpO1xuICAgICAgICAvLyBmaW5kIG5ldyBsb29wSW5kZXhcbiAgICAgICAgaWYgKGN1cnJlbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMubG9vcEluZGV4ID0gdGhpcy5pdGVtcy5pbmRleE9mKGN1cnJlbnQpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBTb3J0ZWRMb29wQXJyYXkgfTtcbiJdLCJuYW1lcyI6WyJTb3J0ZWRMb29wQXJyYXkiLCJjb25zdHJ1Y3RvciIsImFyZ3MiLCJpdGVtcyIsImxlbmd0aCIsImxvb3BJbmRleCIsIl9zb3J0QnkiLCJfc29ydEhhbmRsZXIiLCJzb3J0QnkiLCJfZG9Tb3J0IiwiYmluZCIsIl9iaW5hcnlTZWFyY2giLCJpdGVtIiwibGVmdCIsInJpZ2h0Iiwic2VhcmNoIiwibWlkZGxlIiwiY3VycmVudCIsIk1hdGgiLCJmbG9vciIsImEiLCJiIiwiaW5zZXJ0IiwiaW5kZXgiLCJzcGxpY2UiLCJhcHBlbmQiLCJwdXNoIiwicmVtb3ZlIiwiaWR4IiwiaW5kZXhPZiIsInNvcnQiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZUFBZSxDQUFDO0FBOEJsQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxJQUFJLEVBQUU7QUE3Q2xCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxLQUFLLEdBQUcsRUFBRSxDQUFBO0FBRVY7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFFVjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQU5JLElBT0FD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
