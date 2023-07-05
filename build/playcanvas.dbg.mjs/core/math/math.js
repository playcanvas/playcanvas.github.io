/**
 * Math API.
 *
 * @namespace
 */
const math = {
  /**
   * Conversion factor between degrees and radians.
   *
   * @type {number}
   */
  DEG_TO_RAD: Math.PI / 180,
  /**
   * Conversion factor between degrees and radians.
   *
   * @type {number}
   */
  RAD_TO_DEG: 180 / Math.PI,
  /**
   * Clamp a number between min and max inclusive.
   *
   * @param {number} value - Number to clamp.
   * @param {number} min - Min value.
   * @param {number} max - Max value.
   * @returns {number} The clamped value.
   */
  clamp: function (value, min, max) {
    if (value >= max) return max;
    if (value <= min) return min;
    return value;
  },
  /**
   * Convert an 24 bit integer into an array of 3 bytes.
   *
   * @param {number} i - Number holding an integer value.
   * @returns {number[]} An array of 3 bytes.
   * @example
   * // Set bytes to [0x11, 0x22, 0x33]
   * const bytes = pc.math.intToBytes24(0x112233);
   */
  intToBytes24: function (i) {
    const r = i >> 16 & 0xff;
    const g = i >> 8 & 0xff;
    const b = i & 0xff;
    return [r, g, b];
  },
  /**
   * Convert an 32 bit integer into an array of 4 bytes.
   *
   * @param {number} i - Number holding an integer value.
   * @returns {number[]} An array of 4 bytes.
   * @example
   * // Set bytes to [0x11, 0x22, 0x33, 0x44]
   * const bytes = pc.math.intToBytes32(0x11223344);
   */
  intToBytes32: function (i) {
    const r = i >> 24 & 0xff;
    const g = i >> 16 & 0xff;
    const b = i >> 8 & 0xff;
    const a = i & 0xff;
    return [r, g, b, a];
  },
  /**
   * Convert 3 8 bit Numbers into a single unsigned 24 bit Number.
   *
   * @param {number} r - A single byte (0-255).
   * @param {number} g - A single byte (0-255).
   * @param {number} b - A single byte (0-255).
   * @returns {number} A single unsigned 24 bit Number.
   * @example
   * // Set result1 to 0x112233 from an array of 3 values
   * const result1 = pc.math.bytesToInt24([0x11, 0x22, 0x33]);
   *
   * // Set result2 to 0x112233 from 3 discrete values
   * const result2 = pc.math.bytesToInt24(0x11, 0x22, 0x33);
   */
  bytesToInt24: function (r, g, b) {
    if (r.length) {
      b = r[2];
      g = r[1];
      r = r[0];
    }
    return r << 16 | g << 8 | b;
  },
  /**
   * Convert 4 1-byte Numbers into a single unsigned 32bit Number.
   *
   * @param {number} r - A single byte (0-255).
   * @param {number} g - A single byte (0-255).
   * @param {number} b - A single byte (0-255).
   * @param {number} a - A single byte (0-255).
   * @returns {number} A single unsigned 32bit Number.
   * @example
   * // Set result1 to 0x11223344 from an array of 4 values
   * const result1 = pc.math.bytesToInt32([0x11, 0x22, 0x33, 0x44]);
   *
   * // Set result2 to 0x11223344 from 4 discrete values
   * const result2 = pc.math.bytesToInt32(0x11, 0x22, 0x33, 0x44);
   */
  bytesToInt32: function (r, g, b, a) {
    if (r.length) {
      a = r[3];
      b = r[2];
      g = r[1];
      r = r[0];
    }

    // Why ((r << 24)>>>0)?
    // << operator uses signed 32 bit numbers, so 128<<24 is negative.
    // >>> used unsigned so >>>0 converts back to an unsigned.
    // See http://stackoverflow.com/questions/1908492/unsigned-integer-in-javascript
    return (r << 24 | g << 16 | b << 8 | a) >>> 0;
  },
  /**
   * Calculates the linear interpolation of two numbers.
   *
   * @param {number} a - Number to linearly interpolate from.
   * @param {number} b - Number to linearly interpolate to.
   * @param {number} alpha - The value controlling the result of interpolation. When alpha is 0,
   * a is returned. When alpha is 1, b is returned. Between 0 and 1, a linear interpolation
   * between a and b is returned. alpha is clamped between 0 and 1.
   * @returns {number} The linear interpolation of two numbers.
   */
  lerp: function (a, b, alpha) {
    return a + (b - a) * math.clamp(alpha, 0, 1);
  },
  /**
   * Calculates the linear interpolation of two angles ensuring that interpolation is correctly
   * performed across the 360 to 0 degree boundary. Angles are supplied in degrees.
   *
   * @param {number} a - Angle (in degrees) to linearly interpolate from.
   * @param {number} b - Angle (in degrees) to linearly interpolate to.
   * @param {number} alpha - The value controlling the result of interpolation. When alpha is 0,
   * a is returned. When alpha is 1, b is returned. Between 0 and 1, a linear interpolation
   * between a and b is returned. alpha is clamped between 0 and 1.
   * @returns {number} The linear interpolation of two angles.
   */
  lerpAngle: function (a, b, alpha) {
    if (b - a > 180) {
      b -= 360;
    }
    if (b - a < -180) {
      b += 360;
    }
    return math.lerp(a, b, math.clamp(alpha, 0, 1));
  },
  /**
   * Returns true if argument is a power-of-two and false otherwise.
   *
   * @param {number} x - Number to check for power-of-two property.
   * @returns {boolean} true if power-of-two and false otherwise.
   */
  powerOfTwo: function (x) {
    return x !== 0 && !(x & x - 1);
  },
  /**
   * Returns the next power of 2 for the specified value.
   *
   * @param {number} val - The value for which to calculate the next power of 2.
   * @returns {number} The next power of 2.
   */
  nextPowerOfTwo: function (val) {
    val--;
    val |= val >> 1;
    val |= val >> 2;
    val |= val >> 4;
    val |= val >> 8;
    val |= val >> 16;
    val++;
    return val;
  },
  /**
   * Returns the nearest (smaller or larger) power of 2 for the specified value.
   *
   * @param {number} val - The value for which to calculate the nearest power of 2.
   * @returns {number} The nearest power of 2.
   */
  nearestPowerOfTwo: function (val) {
    return Math.pow(2, Math.round(Math.log(val) / Math.log(2)));
  },
  /**
   * Return a pseudo-random number between min and max. The number generated is in the range
   * [min, max), that is inclusive of the minimum but exclusive of the maximum.
   *
   * @param {number} min - Lower bound for range.
   * @param {number} max - Upper bound for range.
   * @returns {number} Pseudo-random number between the supplied range.
   */
  random: function (min, max) {
    const diff = max - min;
    return Math.random() * diff + min;
  },
  /**
   * The function interpolates smoothly between two input values based on a third one that should
   * be between the first two. The returned value is clamped between 0 and 1.
   *
   * The slope (i.e. derivative) of the smoothstep function starts at 0 and ends at 0. This makes
   * it easy to create a sequence of transitions using smoothstep to interpolate each segment
   * rather than using a more sophisticated or expensive interpolation technique.
   *
   * See http://en.wikipedia.org/wiki/Smoothstep for more details.
   *
   * @param {number} min - The lower bound of the interpolation range.
   * @param {number} max - The upper bound of the interpolation range.
   * @param {number} x - The value to interpolate.
   * @returns {number} The smoothly interpolated value clamped between zero and one.
   */
  smoothstep: function (min, max, x) {
    if (x <= min) return 0;
    if (x >= max) return 1;
    x = (x - min) / (max - min);
    return x * x * (3 - 2 * x);
  },
  /**
   * An improved version of the {@link math.smoothstep} function which has zero 1st and 2nd order
   * derivatives at t=0 and t=1.
   *
   * See http://en.wikipedia.org/wiki/Smoothstep for more details.
   *
   * @param {number} min - The lower bound of the interpolation range.
   * @param {number} max - The upper bound of the interpolation range.
   * @param {number} x - The value to interpolate.
   * @returns {number} The smoothly interpolated value clamped between zero and one.
   */
  smootherstep: function (min, max, x) {
    if (x <= min) return 0;
    if (x >= max) return 1;
    x = (x - min) / (max - min);
    return x * x * x * (x * (x * 6 - 15) + 10);
  },
  /**
   * Rounds a number up to nearest multiple.
   *
   * @param {number} numToRound - The number to round up.
   * @param {number} multiple - The multiple to round up to.
   * @returns {number} A number rounded up to nearest multiple.
   */
  roundUp: function (numToRound, multiple) {
    if (multiple === 0) return numToRound;
    return Math.ceil(numToRound / multiple) * multiple;
  },
  /**
   * Checks whether a given number resides between two other given numbers.
   *
   * @param {number} num - The number to check the position of.
   * @param {number} a - The first upper or lower threshold to check between.
   * @param {number} b - The second upper or lower threshold to check between.
   * @param {boolean} inclusive - If true, a num param which is equal to a or b will return true.
   * @returns {boolean} true if between or false otherwise.
   * @ignore
   */
  between: function (num, a, b, inclusive) {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return inclusive ? num >= min && num <= max : num > min && num < max;
  }
};

export { math };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0aC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9tYXRoLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTWF0aCBBUEkuXG4gKlxuICogQG5hbWVzcGFjZVxuICovXG5jb25zdCBtYXRoID0ge1xuICAgIC8qKlxuICAgICAqIENvbnZlcnNpb24gZmFjdG9yIGJldHdlZW4gZGVncmVlcyBhbmQgcmFkaWFucy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgREVHX1RPX1JBRDogTWF0aC5QSSAvIDE4MCxcblxuICAgIC8qKlxuICAgICAqIENvbnZlcnNpb24gZmFjdG9yIGJldHdlZW4gZGVncmVlcyBhbmQgcmFkaWFucy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgUkFEX1RPX0RFRzogMTgwIC8gTWF0aC5QSSxcblxuICAgIC8qKlxuICAgICAqIENsYW1wIGEgbnVtYmVyIGJldHdlZW4gbWluIGFuZCBtYXggaW5jbHVzaXZlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gTnVtYmVyIHRvIGNsYW1wLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gLSBNaW4gdmFsdWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heCAtIE1heCB2YWx1ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgY2xhbXBlZCB2YWx1ZS5cbiAgICAgKi9cbiAgICBjbGFtcDogZnVuY3Rpb24gKHZhbHVlLCBtaW4sIG1heCkge1xuICAgICAgICBpZiAodmFsdWUgPj0gbWF4KSByZXR1cm4gbWF4O1xuICAgICAgICBpZiAodmFsdWUgPD0gbWluKSByZXR1cm4gbWluO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgYW4gMjQgYml0IGludGVnZXIgaW50byBhbiBhcnJheSBvZiAzIGJ5dGVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGkgLSBOdW1iZXIgaG9sZGluZyBhbiBpbnRlZ2VyIHZhbHVlLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJbXX0gQW4gYXJyYXkgb2YgMyBieXRlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCBieXRlcyB0byBbMHgxMSwgMHgyMiwgMHgzM11cbiAgICAgKiBjb25zdCBieXRlcyA9IHBjLm1hdGguaW50VG9CeXRlczI0KDB4MTEyMjMzKTtcbiAgICAgKi9cbiAgICBpbnRUb0J5dGVzMjQ6IGZ1bmN0aW9uIChpKSB7XG4gICAgICAgIGNvbnN0IHIgPSAoaSA+PiAxNikgJiAweGZmO1xuICAgICAgICBjb25zdCBnID0gKGkgPj4gOCkgJiAweGZmO1xuICAgICAgICBjb25zdCBiID0gKGkpICYgMHhmZjtcblxuICAgICAgICByZXR1cm4gW3IsIGcsIGJdO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IGFuIDMyIGJpdCBpbnRlZ2VyIGludG8gYW4gYXJyYXkgb2YgNCBieXRlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpIC0gTnVtYmVyIGhvbGRpbmcgYW4gaW50ZWdlciB2YWx1ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyW119IEFuIGFycmF5IG9mIDQgYnl0ZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgYnl0ZXMgdG8gWzB4MTEsIDB4MjIsIDB4MzMsIDB4NDRdXG4gICAgICogY29uc3QgYnl0ZXMgPSBwYy5tYXRoLmludFRvQnl0ZXMzMigweDExMjIzMzQ0KTtcbiAgICAgKi9cbiAgICBpbnRUb0J5dGVzMzI6IGZ1bmN0aW9uIChpKSB7XG4gICAgICAgIGNvbnN0IHIgPSAoaSA+PiAyNCkgJiAweGZmO1xuICAgICAgICBjb25zdCBnID0gKGkgPj4gMTYpICYgMHhmZjtcbiAgICAgICAgY29uc3QgYiA9IChpID4+IDgpICYgMHhmZjtcbiAgICAgICAgY29uc3QgYSA9IChpKSAmIDB4ZmY7XG5cbiAgICAgICAgcmV0dXJuIFtyLCBnLCBiLCBhXTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCAzIDggYml0IE51bWJlcnMgaW50byBhIHNpbmdsZSB1bnNpZ25lZCAyNCBiaXQgTnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGIgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHJldHVybnMge251bWJlcn0gQSBzaW5nbGUgdW5zaWduZWQgMjQgYml0IE51bWJlci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByZXN1bHQxIHRvIDB4MTEyMjMzIGZyb20gYW4gYXJyYXkgb2YgMyB2YWx1ZXNcbiAgICAgKiBjb25zdCByZXN1bHQxID0gcGMubWF0aC5ieXRlc1RvSW50MjQoWzB4MTEsIDB4MjIsIDB4MzNdKTtcbiAgICAgKlxuICAgICAqIC8vIFNldCByZXN1bHQyIHRvIDB4MTEyMjMzIGZyb20gMyBkaXNjcmV0ZSB2YWx1ZXNcbiAgICAgKiBjb25zdCByZXN1bHQyID0gcGMubWF0aC5ieXRlc1RvSW50MjQoMHgxMSwgMHgyMiwgMHgzMyk7XG4gICAgICovXG4gICAgYnl0ZXNUb0ludDI0OiBmdW5jdGlvbiAociwgZywgYikge1xuICAgICAgICBpZiAoci5sZW5ndGgpIHtcbiAgICAgICAgICAgIGIgPSByWzJdO1xuICAgICAgICAgICAgZyA9IHJbMV07XG4gICAgICAgICAgICByID0gclswXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKChyIDw8IDE2KSB8IChnIDw8IDgpIHwgYik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgNCAxLWJ5dGUgTnVtYmVycyBpbnRvIGEgc2luZ2xlIHVuc2lnbmVkIDMyYml0IE51bWJlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByIC0gQSBzaW5nbGUgYnl0ZSAoMC0yNTUpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBnIC0gQSBzaW5nbGUgYnl0ZSAoMC0yNTUpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gQSBzaW5nbGUgYnl0ZSAoMC0yNTUpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhIC0gQSBzaW5nbGUgYnl0ZSAoMC0yNTUpLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEEgc2luZ2xlIHVuc2lnbmVkIDMyYml0IE51bWJlci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByZXN1bHQxIHRvIDB4MTEyMjMzNDQgZnJvbSBhbiBhcnJheSBvZiA0IHZhbHVlc1xuICAgICAqIGNvbnN0IHJlc3VsdDEgPSBwYy5tYXRoLmJ5dGVzVG9JbnQzMihbMHgxMSwgMHgyMiwgMHgzMywgMHg0NF0pO1xuICAgICAqXG4gICAgICogLy8gU2V0IHJlc3VsdDIgdG8gMHgxMTIyMzM0NCBmcm9tIDQgZGlzY3JldGUgdmFsdWVzXG4gICAgICogY29uc3QgcmVzdWx0MiA9IHBjLm1hdGguYnl0ZXNUb0ludDMyKDB4MTEsIDB4MjIsIDB4MzMsIDB4NDQpO1xuICAgICAqL1xuICAgIGJ5dGVzVG9JbnQzMjogZnVuY3Rpb24gKHIsIGcsIGIsIGEpIHtcbiAgICAgICAgaWYgKHIubGVuZ3RoKSB7XG4gICAgICAgICAgICBhID0gclszXTtcbiAgICAgICAgICAgIGIgPSByWzJdO1xuICAgICAgICAgICAgZyA9IHJbMV07XG4gICAgICAgICAgICByID0gclswXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdoeSAoKHIgPDwgMjQpPj4+MCk/XG4gICAgICAgIC8vIDw8IG9wZXJhdG9yIHVzZXMgc2lnbmVkIDMyIGJpdCBudW1iZXJzLCBzbyAxMjg8PDI0IGlzIG5lZ2F0aXZlLlxuICAgICAgICAvLyA+Pj4gdXNlZCB1bnNpZ25lZCBzbyA+Pj4wIGNvbnZlcnRzIGJhY2sgdG8gYW4gdW5zaWduZWQuXG4gICAgICAgIC8vIFNlZSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE5MDg0OTIvdW5zaWduZWQtaW50ZWdlci1pbi1qYXZhc2NyaXB0XG4gICAgICAgIHJldHVybiAoKHIgPDwgMjQpIHwgKGcgPDwgMTYpIHwgKGIgPDwgOCkgfCBhKSA+Pj4gMDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2FsY3VsYXRlcyB0aGUgbGluZWFyIGludGVycG9sYXRpb24gb2YgdHdvIG51bWJlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYSAtIE51bWJlciB0byBsaW5lYXJseSBpbnRlcnBvbGF0ZSBmcm9tLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gTnVtYmVyIHRvIGxpbmVhcmx5IGludGVycG9sYXRlIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbHBoYSAtIFRoZSB2YWx1ZSBjb250cm9sbGluZyB0aGUgcmVzdWx0IG9mIGludGVycG9sYXRpb24uIFdoZW4gYWxwaGEgaXMgMCxcbiAgICAgKiBhIGlzIHJldHVybmVkLiBXaGVuIGFscGhhIGlzIDEsIGIgaXMgcmV0dXJuZWQuIEJldHdlZW4gMCBhbmQgMSwgYSBsaW5lYXIgaW50ZXJwb2xhdGlvblxuICAgICAqIGJldHdlZW4gYSBhbmQgYiBpcyByZXR1cm5lZC4gYWxwaGEgaXMgY2xhbXBlZCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGxpbmVhciBpbnRlcnBvbGF0aW9uIG9mIHR3byBudW1iZXJzLlxuICAgICAqL1xuICAgIGxlcnA6IGZ1bmN0aW9uIChhLCBiLCBhbHBoYSkge1xuICAgICAgICByZXR1cm4gYSArIChiIC0gYSkgKiBtYXRoLmNsYW1wKGFscGhhLCAwLCAxKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2FsY3VsYXRlcyB0aGUgbGluZWFyIGludGVycG9sYXRpb24gb2YgdHdvIGFuZ2xlcyBlbnN1cmluZyB0aGF0IGludGVycG9sYXRpb24gaXMgY29ycmVjdGx5XG4gICAgICogcGVyZm9ybWVkIGFjcm9zcyB0aGUgMzYwIHRvIDAgZGVncmVlIGJvdW5kYXJ5LiBBbmdsZXMgYXJlIHN1cHBsaWVkIGluIGRlZ3JlZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYSAtIEFuZ2xlIChpbiBkZWdyZWVzKSB0byBsaW5lYXJseSBpbnRlcnBvbGF0ZSBmcm9tLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gQW5nbGUgKGluIGRlZ3JlZXMpIHRvIGxpbmVhcmx5IGludGVycG9sYXRlIHRvLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhbHBoYSAtIFRoZSB2YWx1ZSBjb250cm9sbGluZyB0aGUgcmVzdWx0IG9mIGludGVycG9sYXRpb24uIFdoZW4gYWxwaGEgaXMgMCxcbiAgICAgKiBhIGlzIHJldHVybmVkLiBXaGVuIGFscGhhIGlzIDEsIGIgaXMgcmV0dXJuZWQuIEJldHdlZW4gMCBhbmQgMSwgYSBsaW5lYXIgaW50ZXJwb2xhdGlvblxuICAgICAqIGJldHdlZW4gYSBhbmQgYiBpcyByZXR1cm5lZC4gYWxwaGEgaXMgY2xhbXBlZCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGxpbmVhciBpbnRlcnBvbGF0aW9uIG9mIHR3byBhbmdsZXMuXG4gICAgICovXG4gICAgbGVycEFuZ2xlOiBmdW5jdGlvbiAoYSwgYiwgYWxwaGEpIHtcbiAgICAgICAgaWYgKGIgLSBhID4gMTgwKSB7XG4gICAgICAgICAgICBiIC09IDM2MDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYiAtIGEgPCAtMTgwKSB7XG4gICAgICAgICAgICBiICs9IDM2MDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbWF0aC5sZXJwKGEsIGIsIG1hdGguY2xhbXAoYWxwaGEsIDAsIDEpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIGFyZ3VtZW50IGlzIGEgcG93ZXItb2YtdHdvIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIE51bWJlciB0byBjaGVjayBmb3IgcG93ZXItb2YtdHdvIHByb3BlcnR5LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmIHBvd2VyLW9mLXR3byBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHBvd2VyT2ZUd286IGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIHJldHVybiAoKHggIT09IDApICYmICEoeCAmICh4IC0gMSkpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgbmV4dCBwb3dlciBvZiAyIGZvciB0aGUgc3BlY2lmaWVkIHZhbHVlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbCAtIFRoZSB2YWx1ZSBmb3Igd2hpY2ggdG8gY2FsY3VsYXRlIHRoZSBuZXh0IHBvd2VyIG9mIDIuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG5leHQgcG93ZXIgb2YgMi5cbiAgICAgKi9cbiAgICBuZXh0UG93ZXJPZlR3bzogZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICB2YWwtLTtcbiAgICAgICAgdmFsIHw9ICh2YWwgPj4gMSk7XG4gICAgICAgIHZhbCB8PSAodmFsID4+IDIpO1xuICAgICAgICB2YWwgfD0gKHZhbCA+PiA0KTtcbiAgICAgICAgdmFsIHw9ICh2YWwgPj4gOCk7XG4gICAgICAgIHZhbCB8PSAodmFsID4+IDE2KTtcbiAgICAgICAgdmFsKys7XG4gICAgICAgIHJldHVybiB2YWw7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG5lYXJlc3QgKHNtYWxsZXIgb3IgbGFyZ2VyKSBwb3dlciBvZiAyIGZvciB0aGUgc3BlY2lmaWVkIHZhbHVlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbCAtIFRoZSB2YWx1ZSBmb3Igd2hpY2ggdG8gY2FsY3VsYXRlIHRoZSBuZWFyZXN0IHBvd2VyIG9mIDIuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG5lYXJlc3QgcG93ZXIgb2YgMi5cbiAgICAgKi9cbiAgICBuZWFyZXN0UG93ZXJPZlR3bzogZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICByZXR1cm4gTWF0aC5wb3coMiwgTWF0aC5yb3VuZChNYXRoLmxvZyh2YWwpIC8gTWF0aC5sb2coMikpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGEgcHNldWRvLXJhbmRvbSBudW1iZXIgYmV0d2VlbiBtaW4gYW5kIG1heC4gVGhlIG51bWJlciBnZW5lcmF0ZWQgaXMgaW4gdGhlIHJhbmdlXG4gICAgICogW21pbiwgbWF4KSwgdGhhdCBpcyBpbmNsdXNpdmUgb2YgdGhlIG1pbmltdW0gYnV0IGV4Y2x1c2l2ZSBvZiB0aGUgbWF4aW11bS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gLSBMb3dlciBib3VuZCBmb3IgcmFuZ2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heCAtIFVwcGVyIGJvdW5kIGZvciByYW5nZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBQc2V1ZG8tcmFuZG9tIG51bWJlciBiZXR3ZWVuIHRoZSBzdXBwbGllZCByYW5nZS5cbiAgICAgKi9cbiAgICByYW5kb206IGZ1bmN0aW9uIChtaW4sIG1heCkge1xuICAgICAgICBjb25zdCBkaWZmID0gbWF4IC0gbWluO1xuICAgICAgICByZXR1cm4gTWF0aC5yYW5kb20oKSAqIGRpZmYgKyBtaW47XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFRoZSBmdW5jdGlvbiBpbnRlcnBvbGF0ZXMgc21vb3RobHkgYmV0d2VlbiB0d28gaW5wdXQgdmFsdWVzIGJhc2VkIG9uIGEgdGhpcmQgb25lIHRoYXQgc2hvdWxkXG4gICAgICogYmUgYmV0d2VlbiB0aGUgZmlyc3QgdHdvLiBUaGUgcmV0dXJuZWQgdmFsdWUgaXMgY2xhbXBlZCBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICpcbiAgICAgKiBUaGUgc2xvcGUgKGkuZS4gZGVyaXZhdGl2ZSkgb2YgdGhlIHNtb290aHN0ZXAgZnVuY3Rpb24gc3RhcnRzIGF0IDAgYW5kIGVuZHMgYXQgMC4gVGhpcyBtYWtlc1xuICAgICAqIGl0IGVhc3kgdG8gY3JlYXRlIGEgc2VxdWVuY2Ugb2YgdHJhbnNpdGlvbnMgdXNpbmcgc21vb3Roc3RlcCB0byBpbnRlcnBvbGF0ZSBlYWNoIHNlZ21lbnRcbiAgICAgKiByYXRoZXIgdGhhbiB1c2luZyBhIG1vcmUgc29waGlzdGljYXRlZCBvciBleHBlbnNpdmUgaW50ZXJwb2xhdGlvbiB0ZWNobmlxdWUuXG4gICAgICpcbiAgICAgKiBTZWUgaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9TbW9vdGhzdGVwIGZvciBtb3JlIGRldGFpbHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWluIC0gVGhlIGxvd2VyIGJvdW5kIG9mIHRoZSBpbnRlcnBvbGF0aW9uIHJhbmdlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXggLSBUaGUgdXBwZXIgYm91bmQgb2YgdGhlIGludGVycG9sYXRpb24gcmFuZ2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgdmFsdWUgdG8gaW50ZXJwb2xhdGUuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIHNtb290aGx5IGludGVycG9sYXRlZCB2YWx1ZSBjbGFtcGVkIGJldHdlZW4gemVybyBhbmQgb25lLlxuICAgICAqL1xuICAgIHNtb290aHN0ZXA6IGZ1bmN0aW9uIChtaW4sIG1heCwgeCkge1xuICAgICAgICBpZiAoeCA8PSBtaW4pIHJldHVybiAwO1xuICAgICAgICBpZiAoeCA+PSBtYXgpIHJldHVybiAxO1xuXG4gICAgICAgIHggPSAoeCAtIG1pbikgLyAobWF4IC0gbWluKTtcblxuICAgICAgICByZXR1cm4geCAqIHggKiAoMyAtIDIgKiB4KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQW4gaW1wcm92ZWQgdmVyc2lvbiBvZiB0aGUge0BsaW5rIG1hdGguc21vb3Roc3RlcH0gZnVuY3Rpb24gd2hpY2ggaGFzIHplcm8gMXN0IGFuZCAybmQgb3JkZXJcbiAgICAgKiBkZXJpdmF0aXZlcyBhdCB0PTAgYW5kIHQ9MS5cbiAgICAgKlxuICAgICAqIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1Ntb290aHN0ZXAgZm9yIG1vcmUgZGV0YWlscy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gLSBUaGUgbG93ZXIgYm91bmQgb2YgdGhlIGludGVycG9sYXRpb24gcmFuZ2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heCAtIFRoZSB1cHBlciBib3VuZCBvZiB0aGUgaW50ZXJwb2xhdGlvbiByYW5nZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB2YWx1ZSB0byBpbnRlcnBvbGF0ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgc21vb3RobHkgaW50ZXJwb2xhdGVkIHZhbHVlIGNsYW1wZWQgYmV0d2VlbiB6ZXJvIGFuZCBvbmUuXG4gICAgICovXG4gICAgc21vb3RoZXJzdGVwOiBmdW5jdGlvbiAobWluLCBtYXgsIHgpIHtcbiAgICAgICAgaWYgKHggPD0gbWluKSByZXR1cm4gMDtcbiAgICAgICAgaWYgKHggPj0gbWF4KSByZXR1cm4gMTtcblxuICAgICAgICB4ID0gKHggLSBtaW4pIC8gKG1heCAtIG1pbik7XG5cbiAgICAgICAgcmV0dXJuIHggKiB4ICogeCAqICh4ICogKHggKiA2IC0gMTUpICsgMTApO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSb3VuZHMgYSBudW1iZXIgdXAgdG8gbmVhcmVzdCBtdWx0aXBsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW1Ub1JvdW5kIC0gVGhlIG51bWJlciB0byByb3VuZCB1cC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbXVsdGlwbGUgLSBUaGUgbXVsdGlwbGUgdG8gcm91bmQgdXAgdG8uXG4gICAgICogQHJldHVybnMge251bWJlcn0gQSBudW1iZXIgcm91bmRlZCB1cCB0byBuZWFyZXN0IG11bHRpcGxlLlxuICAgICAqL1xuICAgIHJvdW5kVXA6IGZ1bmN0aW9uIChudW1Ub1JvdW5kLCBtdWx0aXBsZSkge1xuICAgICAgICBpZiAobXVsdGlwbGUgPT09IDApXG4gICAgICAgICAgICByZXR1cm4gbnVtVG9Sb3VuZDtcbiAgICAgICAgcmV0dXJuIE1hdGguY2VpbChudW1Ub1JvdW5kIC8gbXVsdGlwbGUpICogbXVsdGlwbGU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB3aGV0aGVyIGEgZ2l2ZW4gbnVtYmVyIHJlc2lkZXMgYmV0d2VlbiB0d28gb3RoZXIgZ2l2ZW4gbnVtYmVycy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW0gLSBUaGUgbnVtYmVyIHRvIGNoZWNrIHRoZSBwb3NpdGlvbiBvZi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYSAtIFRoZSBmaXJzdCB1cHBlciBvciBsb3dlciB0aHJlc2hvbGQgdG8gY2hlY2sgYmV0d2Vlbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIFRoZSBzZWNvbmQgdXBwZXIgb3IgbG93ZXIgdGhyZXNob2xkIHRvIGNoZWNrIGJldHdlZW4uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpbmNsdXNpdmUgLSBJZiB0cnVlLCBhIG51bSBwYXJhbSB3aGljaCBpcyBlcXVhbCB0byBhIG9yIGIgd2lsbCByZXR1cm4gdHJ1ZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZiBiZXR3ZWVuIG9yIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYmV0d2VlbjogZnVuY3Rpb24gKG51bSwgYSwgYiwgaW5jbHVzaXZlKSB7XG4gICAgICAgIGNvbnN0IG1pbiA9IE1hdGgubWluKGEsIGIpO1xuICAgICAgICBjb25zdCBtYXggPSBNYXRoLm1heChhLCBiKTtcbiAgICAgICAgcmV0dXJuIGluY2x1c2l2ZSA/IG51bSA+PSBtaW4gJiYgbnVtIDw9IG1heCA6IG51bSA+IG1pbiAmJiBudW0gPCBtYXg7XG4gICAgfVxufTtcblxuZXhwb3J0IHsgbWF0aCB9O1xuIl0sIm5hbWVzIjpbIm1hdGgiLCJERUdfVE9fUkFEIiwiTWF0aCIsIlBJIiwiUkFEX1RPX0RFRyIsImNsYW1wIiwidmFsdWUiLCJtaW4iLCJtYXgiLCJpbnRUb0J5dGVzMjQiLCJpIiwiciIsImciLCJiIiwiaW50VG9CeXRlczMyIiwiYSIsImJ5dGVzVG9JbnQyNCIsImxlbmd0aCIsImJ5dGVzVG9JbnQzMiIsImxlcnAiLCJhbHBoYSIsImxlcnBBbmdsZSIsInBvd2VyT2ZUd28iLCJ4IiwibmV4dFBvd2VyT2ZUd28iLCJ2YWwiLCJuZWFyZXN0UG93ZXJPZlR3byIsInBvdyIsInJvdW5kIiwibG9nIiwicmFuZG9tIiwiZGlmZiIsInNtb290aHN0ZXAiLCJzbW9vdGhlcnN0ZXAiLCJyb3VuZFVwIiwibnVtVG9Sb3VuZCIsIm11bHRpcGxlIiwiY2VpbCIsImJldHdlZW4iLCJudW0iLCJpbmNsdXNpdmUiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxJQUFJLEdBQUc7QUFDVDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFVBQVUsRUFBRUMsSUFBSSxDQUFDQyxFQUFFLEdBQUcsR0FBRztBQUV6QjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFVBQVUsRUFBRSxHQUFHLEdBQUdGLElBQUksQ0FBQ0MsRUFBRTtBQUV6QjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lFLEtBQUssRUFBRSxVQUFVQyxLQUFLLEVBQUVDLEdBQUcsRUFBRUMsR0FBRyxFQUFFO0FBQzlCLElBQUEsSUFBSUYsS0FBSyxJQUFJRSxHQUFHLEVBQUUsT0FBT0EsR0FBRyxDQUFBO0FB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
