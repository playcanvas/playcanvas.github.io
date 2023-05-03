/**
 * Animation curve links an input data set to an output data set and defines the interpolation
 * method to use.
 */
class AnimCurve {
  /**
   * Create a new animation curve.
   *
   * @param {string[]} paths - Array of path strings identifying the targets of this curve, for
   * example "rootNode.translation".
   * @param {number} input - Index of the curve which specifies the key data.
   * @param {number} output - Index of the curve which specifies the value data.
   * @param {number} interpolation - The interpolation method to use. One of the following:
   *
   * - {@link INTERPOLATION_STEP}
   * - {@link INTERPOLATION_LINEAR}
   * - {@link INTERPOLATION_CUBIC}
   */
  constructor(paths, input, output, interpolation) {
    this._paths = paths;
    this._input = input;
    this._output = output;
    this._interpolation = interpolation;
  }

  /**
   * The list of paths which identify targets of this curve.
   *
   * @type {string[]}
   */
  get paths() {
    return this._paths;
  }

  /**
   * The index of the AnimTrack input which contains the key data for this curve.
   *
   * @type {number}
   */
  get input() {
    return this._input;
  }

  /**
   * The index of the AnimTrack input which contains the key data for this curve.
   *
   * @type {number}
   */
  get output() {
    return this._output;
  }

  /**
   * The interpolation method used by this curve.
   *
   * @type {number}
   */
  get interpolation() {
    return this._interpolation;
  }
}

export { AnimCurve };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1jdXJ2ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9hbmltL2V2YWx1YXRvci9hbmltLWN1cnZlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQW5pbWF0aW9uIGN1cnZlIGxpbmtzIGFuIGlucHV0IGRhdGEgc2V0IHRvIGFuIG91dHB1dCBkYXRhIHNldCBhbmQgZGVmaW5lcyB0aGUgaW50ZXJwb2xhdGlvblxuICogbWV0aG9kIHRvIHVzZS5cbiAqL1xuY2xhc3MgQW5pbUN1cnZlIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgYW5pbWF0aW9uIGN1cnZlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gcGF0aHMgLSBBcnJheSBvZiBwYXRoIHN0cmluZ3MgaWRlbnRpZnlpbmcgdGhlIHRhcmdldHMgb2YgdGhpcyBjdXJ2ZSwgZm9yXG4gICAgICogZXhhbXBsZSBcInJvb3ROb2RlLnRyYW5zbGF0aW9uXCIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlucHV0IC0gSW5kZXggb2YgdGhlIGN1cnZlIHdoaWNoIHNwZWNpZmllcyB0aGUga2V5IGRhdGEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG91dHB1dCAtIEluZGV4IG9mIHRoZSBjdXJ2ZSB3aGljaCBzcGVjaWZpZXMgdGhlIHZhbHVlIGRhdGEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGludGVycG9sYXRpb24gLSBUaGUgaW50ZXJwb2xhdGlvbiBtZXRob2QgdG8gdXNlLiBPbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIElOVEVSUE9MQVRJT05fU1RFUH1cbiAgICAgKiAtIHtAbGluayBJTlRFUlBPTEFUSU9OX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBJTlRFUlBPTEFUSU9OX0NVQklDfVxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHBhdGhzLCBpbnB1dCwgb3V0cHV0LCBpbnRlcnBvbGF0aW9uKSB7XG4gICAgICAgIHRoaXMuX3BhdGhzID0gcGF0aHM7XG4gICAgICAgIHRoaXMuX2lucHV0ID0gaW5wdXQ7XG4gICAgICAgIHRoaXMuX291dHB1dCA9IG91dHB1dDtcbiAgICAgICAgdGhpcy5faW50ZXJwb2xhdGlvbiA9IGludGVycG9sYXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGxpc3Qgb2YgcGF0aHMgd2hpY2ggaWRlbnRpZnkgdGFyZ2V0cyBvZiB0aGlzIGN1cnZlLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ1tdfVxuICAgICAqL1xuICAgIGdldCBwYXRocygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3BhdGhzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBpbmRleCBvZiB0aGUgQW5pbVRyYWNrIGlucHV0IHdoaWNoIGNvbnRhaW5zIHRoZSBrZXkgZGF0YSBmb3IgdGhpcyBjdXJ2ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGlucHV0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faW5wdXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGluZGV4IG9mIHRoZSBBbmltVHJhY2sgaW5wdXQgd2hpY2ggY29udGFpbnMgdGhlIGtleSBkYXRhIGZvciB0aGlzIGN1cnZlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgb3V0cHV0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3V0cHV0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBpbnRlcnBvbGF0aW9uIG1ldGhvZCB1c2VkIGJ5IHRoaXMgY3VydmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBpbnRlcnBvbGF0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faW50ZXJwb2xhdGlvbjtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEFuaW1DdXJ2ZSB9O1xuIl0sIm5hbWVzIjpbIkFuaW1DdXJ2ZSIsImNvbnN0cnVjdG9yIiwicGF0aHMiLCJpbnB1dCIsIm91dHB1dCIsImludGVycG9sYXRpb24iLCJfcGF0aHMiLCJfaW5wdXQiLCJfb3V0cHV0IiwiX2ludGVycG9sYXRpb24iXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsU0FBUyxDQUFDO0FBQ1o7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsS0FBSyxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRUMsYUFBYSxFQUFFO0lBQzdDLElBQUksQ0FBQ0MsTUFBTSxHQUFHSixLQUFLLENBQUE7SUFDbkIsSUFBSSxDQUFDSyxNQUFNLEdBQUdKLEtBQUssQ0FBQTtJQUNuQixJQUFJLENBQUNLLE9BQU8sR0FBR0osTUFBTSxDQUFBO0lBQ3JCLElBQUksQ0FBQ0ssY0FBYyxHQUFHSixhQUFhLENBQUE7QUFDdkMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUgsS0FBS0EsR0FBRztJQUNSLE9BQU8sSUFBSSxDQUFDSSxNQUFNLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUgsS0FBS0EsR0FBRztJQUNSLE9BQU8sSUFBSSxDQUFDSSxNQUFNLENBQUE7QUFDdEIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUgsTUFBTUEsR0FBRztJQUNULE9BQU8sSUFBSSxDQUFDSSxPQUFPLENBQUE7QUFDdkIsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUgsYUFBYUEsR0FBRztJQUNoQixPQUFPLElBQUksQ0FBQ0ksY0FBYyxDQUFBO0FBQzlCLEdBQUE7QUFDSjs7OzsifQ==
