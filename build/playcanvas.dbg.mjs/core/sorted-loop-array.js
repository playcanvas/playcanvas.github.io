/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * Helper class used to hold an array of items in a specific order. This array is safe to modify
 * while we loop through it. The class assumes that it holds objects that need to be sorted based
 * on one of their fields.
 *
 * @ignore
 */
class SortedLoopArray {
  /**
   * The internal array that holds the actual array elements.
   *
   * @type {object[]}
   */

  /**
   * The number of elements in the array.
   *
   * @type {number}
   */

  /**
   * The current index used to loop through the array. This gets modified if we add or remove
   * elements from the array while looping. See the example to see how to loop through this
   * array.
   *
   * @type {number}
   */

  /** @private */

  /** @private */

  /**
   * Create a new SortedLoopArray instance.
   *
   * @param {object} args - Arguments.
   * @param {string} args.sortBy - The name of the field that each element in the array is going
   * to be sorted by.
   * @example
   * var array = new pc.SortedLoopArray({ sortBy: 'priority' });
   * array.insert(item); // adds item to the right slot based on item.priority
   * array.append(item); // adds item to the end of the array
   * array.remove(item); // removes item from array
   * for (array.loopIndex = 0; array.loopIndex < array.length; array.loopIndex++) {
   *   // do things with array elements
   *   // safe to remove and add elements into the array while looping
   * }
   */
  constructor(args) {
    this.items = [];
    this.length = 0;
    this.loopIndex = -1;
    this._sortBy = void 0;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29ydGVkLWxvb3AtYXJyYXkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9jb3JlL3NvcnRlZC1sb29wLWFycmF5LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSGVscGVyIGNsYXNzIHVzZWQgdG8gaG9sZCBhbiBhcnJheSBvZiBpdGVtcyBpbiBhIHNwZWNpZmljIG9yZGVyLiBUaGlzIGFycmF5IGlzIHNhZmUgdG8gbW9kaWZ5XG4gKiB3aGlsZSB3ZSBsb29wIHRocm91Z2ggaXQuIFRoZSBjbGFzcyBhc3N1bWVzIHRoYXQgaXQgaG9sZHMgb2JqZWN0cyB0aGF0IG5lZWQgdG8gYmUgc29ydGVkIGJhc2VkXG4gKiBvbiBvbmUgb2YgdGhlaXIgZmllbGRzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgU29ydGVkTG9vcEFycmF5IHtcbiAgICAvKipcbiAgICAgKiBUaGUgaW50ZXJuYWwgYXJyYXkgdGhhdCBob2xkcyB0aGUgYWN0dWFsIGFycmF5IGVsZW1lbnRzLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdFtdfVxuICAgICAqL1xuICAgIGl0ZW1zID0gW107XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIGluIHRoZSBhcnJheS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgbGVuZ3RoID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGluZGV4IHVzZWQgdG8gbG9vcCB0aHJvdWdoIHRoZSBhcnJheS4gVGhpcyBnZXRzIG1vZGlmaWVkIGlmIHdlIGFkZCBvciByZW1vdmVcbiAgICAgKiBlbGVtZW50cyBmcm9tIHRoZSBhcnJheSB3aGlsZSBsb29waW5nLiBTZWUgdGhlIGV4YW1wbGUgdG8gc2VlIGhvdyB0byBsb29wIHRocm91Z2ggdGhpc1xuICAgICAqIGFycmF5LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBsb29wSW5kZXggPSAtMTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9zb3J0Qnk7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfc29ydEhhbmRsZXI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU29ydGVkTG9vcEFycmF5IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGFyZ3MgLSBBcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGFyZ3Muc29ydEJ5IC0gVGhlIG5hbWUgb2YgdGhlIGZpZWxkIHRoYXQgZWFjaCBlbGVtZW50IGluIHRoZSBhcnJheSBpcyBnb2luZ1xuICAgICAqIHRvIGJlIHNvcnRlZCBieS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhcnJheSA9IG5ldyBwYy5Tb3J0ZWRMb29wQXJyYXkoeyBzb3J0Qnk6ICdwcmlvcml0eScgfSk7XG4gICAgICogYXJyYXkuaW5zZXJ0KGl0ZW0pOyAvLyBhZGRzIGl0ZW0gdG8gdGhlIHJpZ2h0IHNsb3QgYmFzZWQgb24gaXRlbS5wcmlvcml0eVxuICAgICAqIGFycmF5LmFwcGVuZChpdGVtKTsgLy8gYWRkcyBpdGVtIHRvIHRoZSBlbmQgb2YgdGhlIGFycmF5XG4gICAgICogYXJyYXkucmVtb3ZlKGl0ZW0pOyAvLyByZW1vdmVzIGl0ZW0gZnJvbSBhcnJheVxuICAgICAqIGZvciAoYXJyYXkubG9vcEluZGV4ID0gMDsgYXJyYXkubG9vcEluZGV4IDwgYXJyYXkubGVuZ3RoOyBhcnJheS5sb29wSW5kZXgrKykge1xuICAgICAqICAgLy8gZG8gdGhpbmdzIHdpdGggYXJyYXkgZWxlbWVudHNcbiAgICAgKiAgIC8vIHNhZmUgdG8gcmVtb3ZlIGFuZCBhZGQgZWxlbWVudHMgaW50byB0aGUgYXJyYXkgd2hpbGUgbG9vcGluZ1xuICAgICAqIH1cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcmdzKSB7XG4gICAgICAgIHRoaXMuX3NvcnRCeSA9IGFyZ3Muc29ydEJ5O1xuICAgICAgICB0aGlzLl9zb3J0SGFuZGxlciA9IHRoaXMuX2RvU29ydC5iaW5kKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlYXJjaGVzIGZvciB0aGUgcmlnaHQgc3BvdCB0byBpbnNlcnQgdGhlIHNwZWNpZmllZCBpdGVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGl0ZW0gLSBUaGUgaXRlbS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgaW5kZXggd2hlcmUgdG8gaW5zZXJ0IHRoZSBpdGVtLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2JpbmFyeVNlYXJjaChpdGVtKSB7XG4gICAgICAgIGxldCBsZWZ0ID0gMDtcbiAgICAgICAgbGV0IHJpZ2h0ID0gdGhpcy5pdGVtcy5sZW5ndGggLSAxO1xuICAgICAgICBjb25zdCBzZWFyY2ggPSBpdGVtW3RoaXMuX3NvcnRCeV07XG5cbiAgICAgICAgbGV0IG1pZGRsZTtcbiAgICAgICAgbGV0IGN1cnJlbnQ7XG4gICAgICAgIHdoaWxlIChsZWZ0IDw9IHJpZ2h0KSB7XG4gICAgICAgICAgICBtaWRkbGUgPSBNYXRoLmZsb29yKChsZWZ0ICsgcmlnaHQpIC8gMik7XG4gICAgICAgICAgICBjdXJyZW50ID0gdGhpcy5pdGVtc1ttaWRkbGVdW3RoaXMuX3NvcnRCeV07XG4gICAgICAgICAgICBpZiAoY3VycmVudCA8PSBzZWFyY2gpIHtcbiAgICAgICAgICAgICAgICBsZWZ0ID0gbWlkZGxlICsgMTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY3VycmVudCA+IHNlYXJjaCkge1xuICAgICAgICAgICAgICAgIHJpZ2h0ID0gbWlkZGxlIC0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsZWZ0O1xuICAgIH1cblxuICAgIF9kb1NvcnQoYSwgYikge1xuICAgICAgICBjb25zdCBzb3J0QnkgPSB0aGlzLl9zb3J0Qnk7XG4gICAgICAgIHJldHVybiBhW3NvcnRCeV0gLSBiW3NvcnRCeV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyB0aGUgc3BlY2lmaWVkIGl0ZW0gaW50byB0aGUgYXJyYXkgYXQgdGhlIHJpZ2h0IGluZGV4IGJhc2VkIG9uIHRoZSAnc29ydEJ5JyBmaWVsZFxuICAgICAqIHBhc3NlZCBpbnRvIHRoZSBjb25zdHJ1Y3Rvci4gVGhpcyBhbHNvIGFkanVzdHMgdGhlIGxvb3BJbmRleCBhY2NvcmRpbmdseS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBpdGVtIC0gVGhlIGl0ZW0gdG8gaW5zZXJ0LlxuICAgICAqL1xuICAgIGluc2VydChpdGVtKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fYmluYXJ5U2VhcmNoKGl0ZW0pO1xuICAgICAgICB0aGlzLml0ZW1zLnNwbGljZShpbmRleCwgMCwgaXRlbSk7XG4gICAgICAgIHRoaXMubGVuZ3RoKys7XG4gICAgICAgIGlmICh0aGlzLmxvb3BJbmRleCA+PSBpbmRleCkge1xuICAgICAgICAgICAgdGhpcy5sb29wSW5kZXgrKztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGVuZHMgdGhlIHNwZWNpZmllZCBpdGVtIHRvIHRoZSBlbmQgb2YgdGhlIGFycmF5LiBGYXN0ZXIgdGhhbiBpbnNlcnQoKSBhcyBpdCBkb2VzIG5vdFxuICAgICAqIGJpbmFyeSBzZWFyY2ggZm9yIHRoZSByaWdodCBpbmRleC4gVGhpcyBhbHNvIGFkanVzdHMgdGhlIGxvb3BJbmRleCBhY2NvcmRpbmdseS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBpdGVtIC0gVGhlIGl0ZW0gdG8gYXBwZW5kLlxuICAgICAqL1xuICAgIGFwcGVuZChpdGVtKSB7XG4gICAgICAgIHRoaXMuaXRlbXMucHVzaChpdGVtKTtcbiAgICAgICAgdGhpcy5sZW5ndGgrKztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIHRoZSBzcGVjaWZpZWQgaXRlbSBmcm9tIHRoZSBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBpdGVtIC0gVGhlIGl0ZW0gdG8gcmVtb3ZlLlxuICAgICAqL1xuICAgIHJlbW92ZShpdGVtKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuaXRlbXMuaW5kZXhPZihpdGVtKTtcbiAgICAgICAgaWYgKGlkeCA8IDApIHJldHVybjtcblxuICAgICAgICB0aGlzLml0ZW1zLnNwbGljZShpZHgsIDEpO1xuICAgICAgICB0aGlzLmxlbmd0aC0tO1xuICAgICAgICBpZiAodGhpcy5sb29wSW5kZXggPj0gaWR4KSB7XG4gICAgICAgICAgICB0aGlzLmxvb3BJbmRleC0tO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU29ydHMgZWxlbWVudHMgaW4gdGhlIGFycmF5IGJhc2VkIG9uIHRoZSAnc29ydEJ5JyBmaWVsZCBwYXNzZWQgaW50byB0aGUgY29uc3RydWN0b3IuIFRoaXNcbiAgICAgKiBhbHNvIHVwZGF0ZXMgdGhlIGxvb3BJbmRleCBpZiB3ZSBhcmUgY3VycmVudGx5IGxvb3BpbmcuXG4gICAgICpcbiAgICAgKiBXQVJOSU5HOiBCZSBjYXJlZnVsIGlmIHlvdSBhcmUgc29ydGluZyB3aGlsZSBpdGVyYXRpbmcgYmVjYXVzZSBpZiBhZnRlciBzb3J0aW5nIHRoZSBhcnJheVxuICAgICAqIGVsZW1lbnQgdGhhdCB5b3UgYXJlIGN1cnJlbnRseSBwcm9jZXNzaW5nIGlzIG1vdmVkIGJlaGluZCBvdGhlciBlbGVtZW50cyB0aGVuIHlvdSBtaWdodCBlbmRcbiAgICAgKiB1cCBpdGVyYXRpbmcgb3ZlciBlbGVtZW50cyBtb3JlIHRoYW4gb25jZSFcbiAgICAgKi9cbiAgICBzb3J0KCkge1xuICAgICAgICAvLyBnZXQgY3VycmVudCBpdGVtIHBvaW50ZWQgdG8gYnkgbG9vcEluZGV4XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSAodGhpcy5sb29wSW5kZXggPj0gMCA/IHRoaXMuaXRlbXNbdGhpcy5sb29wSW5kZXhdIDogbnVsbCk7XG4gICAgICAgIC8vIHNvcnRcbiAgICAgICAgdGhpcy5pdGVtcy5zb3J0KHRoaXMuX3NvcnRIYW5kbGVyKTtcbiAgICAgICAgLy8gZmluZCBuZXcgbG9vcEluZGV4XG4gICAgICAgIGlmIChjdXJyZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLmxvb3BJbmRleCA9IHRoaXMuaXRlbXMuaW5kZXhPZihjdXJyZW50KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgU29ydGVkTG9vcEFycmF5IH07XG4iXSwibmFtZXMiOlsiU29ydGVkTG9vcEFycmF5IiwiY29uc3RydWN0b3IiLCJhcmdzIiwiaXRlbXMiLCJsZW5ndGgiLCJsb29wSW5kZXgiLCJfc29ydEJ5IiwiX3NvcnRIYW5kbGVyIiwic29ydEJ5IiwiX2RvU29ydCIsImJpbmQiLCJfYmluYXJ5U2VhcmNoIiwiaXRlbSIsImxlZnQiLCJyaWdodCIsInNlYXJjaCIsIm1pZGRsZSIsImN1cnJlbnQiLCJNYXRoIiwiZmxvb3IiLCJhIiwiYiIsImluc2VydCIsImluZGV4Iiwic3BsaWNlIiwiYXBwZW5kIiwicHVzaCIsInJlbW92ZSIsImlkeCIsImluZGV4T2YiLCJzb3J0Il0sIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsZUFBZSxDQUFDO0FBQ2xCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTs7QUFHQTs7QUFHQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXLENBQUNDLElBQUksRUFBRTtJQUFBLElBeENsQkMsQ0FBQUEsS0FBSyxHQUFHLEVBQUUsQ0FBQTtJQUFBLElBT1ZDLENBQUFBLE1BQU0sR0FBRyxDQUFD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
