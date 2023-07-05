/**
 * BitPacking API - functionality for operating on values stored as bits in a number.
 *
 * @namespace
 * @ignore
 */
const BitPacking = {
  /**
   * Sets a value to specified bits of a number.
   *
   * @param {number} storage - Number to store the bits into.
   * @param {number} value - Value to store.
   * @param {number} shift - Number of bits to shift the value.
   * @param {number} [mask] - Mask for the value to limit the number of storage bits. Defaults to 1.
   * @returns {number} Returns the storage updated with the value.
   */
  set: function (storage, value, shift, mask = 1) {
    // clear the space
    const data = storage & ~(mask << shift);

    // set the bits
    return data | value << shift;
  },
  /**
   * Gets the value of specified bits from a number.
   *
   * @param {number} storage - Number to extract the bits from.
   * @param {number} shift - Number of bits to shift the mask.
   * @param {number} [mask] - Mask for the value to limit the number of storage bits. Defaults to 1.
   * @returns {number} Returns the extracted value.
   */
  get: function (storage, shift, mask = 1) {
    return storage >> shift & mask;
  },
  /**
   * Tests if all specified bits are set.
   *
   * @param {number} storage - Number to test.
   * @param {number} shift - Number of bits to shift the mask.
   * @param {number} [mask] - Mask to limit the number of storage bits. Defaults to 1.
   * @returns {boolean} Returns true if all bits in the mask are set in the storage.
   */
  all: function (storage, shift, mask = 1) {
    const shifted = mask << shift;
    return (storage & shifted) === shifted;
  },
  /**
   * Tests if any specified bits are set.
   *
   * @param {number} storage - Number to test.
   * @param {number} shift - Number of bits to shift the mask.
   * @param {number} [mask] - Mask to limit the number of storage bits. Defaults to 1.
   * @returns {boolean} Returns true if any bits in the mask are set in the storage.
   */
  any: function (storage, shift, mask = 1) {
    return (storage & mask << shift) !== 0;
  }
};

export { BitPacking };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYml0LXBhY2tpbmcuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9jb3JlL21hdGgvYml0LXBhY2tpbmcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBCaXRQYWNraW5nIEFQSSAtIGZ1bmN0aW9uYWxpdHkgZm9yIG9wZXJhdGluZyBvbiB2YWx1ZXMgc3RvcmVkIGFzIGJpdHMgaW4gYSBudW1iZXIuXG4gKlxuICogQG5hbWVzcGFjZVxuICogQGlnbm9yZVxuICovXG5jb25zdCBCaXRQYWNraW5nID0ge1xuXG4gICAgLyoqXG4gICAgICogU2V0cyBhIHZhbHVlIHRvIHNwZWNpZmllZCBiaXRzIG9mIGEgbnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHN0b3JhZ2UgLSBOdW1iZXIgdG8gc3RvcmUgdGhlIGJpdHMgaW50by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBWYWx1ZSB0byBzdG9yZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2hpZnQgLSBOdW1iZXIgb2YgYml0cyB0byBzaGlmdCB0aGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttYXNrXSAtIE1hc2sgZm9yIHRoZSB2YWx1ZSB0byBsaW1pdCB0aGUgbnVtYmVyIG9mIHN0b3JhZ2UgYml0cy4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBzdG9yYWdlIHVwZGF0ZWQgd2l0aCB0aGUgdmFsdWUuXG4gICAgICovXG4gICAgc2V0OiBmdW5jdGlvbiAoc3RvcmFnZSwgdmFsdWUsIHNoaWZ0LCBtYXNrID0gMSkge1xuICAgICAgICAvLyBjbGVhciB0aGUgc3BhY2VcbiAgICAgICAgY29uc3QgZGF0YSA9IHN0b3JhZ2UgJiB+KG1hc2sgPDwgc2hpZnQpO1xuXG4gICAgICAgIC8vIHNldCB0aGUgYml0c1xuICAgICAgICByZXR1cm4gZGF0YSB8ICh2YWx1ZSA8PCBzaGlmdCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIHZhbHVlIG9mIHNwZWNpZmllZCBiaXRzIGZyb20gYSBudW1iZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc3RvcmFnZSAtIE51bWJlciB0byBleHRyYWN0IHRoZSBiaXRzIGZyb20uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNoaWZ0IC0gTnVtYmVyIG9mIGJpdHMgdG8gc2hpZnQgdGhlIG1hc2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttYXNrXSAtIE1hc2sgZm9yIHRoZSB2YWx1ZSB0byBsaW1pdCB0aGUgbnVtYmVyIG9mIHN0b3JhZ2UgYml0cy4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBleHRyYWN0ZWQgdmFsdWUuXG4gICAgICovXG4gICAgZ2V0OiBmdW5jdGlvbiAoc3RvcmFnZSwgc2hpZnQsIG1hc2sgPSAxKSB7XG4gICAgICAgIHJldHVybiAoc3RvcmFnZSA+PiBzaGlmdCkgJiBtYXNrO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUZXN0cyBpZiBhbGwgc3BlY2lmaWVkIGJpdHMgYXJlIHNldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzdG9yYWdlIC0gTnVtYmVyIHRvIHRlc3QuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNoaWZ0IC0gTnVtYmVyIG9mIGJpdHMgdG8gc2hpZnQgdGhlIG1hc2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttYXNrXSAtIE1hc2sgdG8gbGltaXQgdGhlIG51bWJlciBvZiBzdG9yYWdlIGJpdHMuIERlZmF1bHRzIHRvIDEuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiBhbGwgYml0cyBpbiB0aGUgbWFzayBhcmUgc2V0IGluIHRoZSBzdG9yYWdlLlxuICAgICAqL1xuICAgIGFsbDogZnVuY3Rpb24gKHN0b3JhZ2UsIHNoaWZ0LCBtYXNrID0gMSkge1xuICAgICAgICBjb25zdCBzaGlmdGVkID0gbWFzayA8PCBzaGlmdDtcbiAgICAgICAgcmV0dXJuIChzdG9yYWdlICYgc2hpZnRlZCkgPT09IHNoaWZ0ZWQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRlc3RzIGlmIGFueSBzcGVjaWZpZWQgYml0cyBhcmUgc2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHN0b3JhZ2UgLSBOdW1iZXIgdG8gdGVzdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2hpZnQgLSBOdW1iZXIgb2YgYml0cyB0byBzaGlmdCB0aGUgbWFzay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21hc2tdIC0gTWFzayB0byBsaW1pdCB0aGUgbnVtYmVyIG9mIHN0b3JhZ2UgYml0cy4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIGFueSBiaXRzIGluIHRoZSBtYXNrIGFyZSBzZXQgaW4gdGhlIHN0b3JhZ2UuXG4gICAgICovXG4gICAgYW55OiBmdW5jdGlvbiAoc3RvcmFnZSwgc2hpZnQsIG1hc2sgPSAxKSB7XG4gICAgICAgIHJldHVybiAoc3RvcmFnZSAmIChtYXNrIDw8IHNoaWZ0KSkgIT09IDA7XG4gICAgfVxufTtcblxuZXhwb3J0IHsgQml0UGFja2luZyB9O1xuIl0sIm5hbWVzIjpbIkJpdFBhY2tpbmciLCJzZXQiLCJzdG9yYWdlIiwidmFsdWUiLCJzaGlmdCIsIm1hc2siLCJkYXRhIiwiZ2V0IiwiYWxsIiwic2hpZnRlZCIsImFueSJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsVUFBVSxHQUFHO0FBRWY7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLEdBQUcsRUFBRSxVQUFVQyxPQUFPLEVBQUVDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO0FBQzVDO0lBQ0EsTUFBTUMsSUFBSSxHQUFHSixPQUFPLEdBQUcsRUFBRUcsSUFBSSxJQUFJRCxLQUFLLENBQUMsQ0FBQTs7QUFFdkM7QUFDQSxJQUFBLE9BQU9FLElBQUksR0FBSUgsS0FBSyxJQUFJQyxLQUFNLENBQUE7R0FDakM7QUFFRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lHLEdBQUcsRUFBRSxVQUFVTCxPQUFPLEVBQUVFLEtBQUssRUFBRUMsSUFBSSxHQUFHLENBQUMsRUFBRTtBQUNyQyxJQUFBLE9BQVFILE9BQU8sSUFBSUUsS0FBSyxHQUFJQyxJQUFJLENBQUE7R0FDbkM7QUFFRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lHLEdBQUcsRUFBRSxVQUFVTixPQUFPLEVBQUVFLEtBQUssRUFBRUMsSUFBSSxHQUFHLENBQUMsRUFBRTtBQUNyQyxJQUFBLE1BQU1JLE9BQU8sR0FBR0osSUFBSSxJQUFJRCxLQUFLLENBQUE7QUFDN0IsSUFBQSxPQUFPLENBQUNGLE9BQU8sR0FBR08sT0FBTyxNQUFNQSxPQUFPLENBQUE7R0FDekM7QUFFRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLEdBQUcsRUFBRSxVQUFVUixPQUFPLEVBQUVFLEtBQUssRUFBRUMsSUFBSSxHQUFHLENBQUMsRUFBRTtBQUNyQyxJQUFBLE9BQU8sQ0FBQ0gsT0FBTyxHQUFJRyxJQUFJLElBQUlELEtBQU0sTUFBTSxDQUFDLENBQUE7QUFDNUMsR0FBQTtBQUNKOzs7OyJ9
