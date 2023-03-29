/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
const math = {
  DEG_TO_RAD: Math.PI / 180,
  RAD_TO_DEG: 180 / Math.PI,
  clamp: function (value, min, max) {
    if (value >= max) return max;
    if (value <= min) return min;
    return value;
  },
  intToBytes24: function (i) {
    const r = i >> 16 & 0xff;
    const g = i >> 8 & 0xff;
    const b = i & 0xff;
    return [r, g, b];
  },
  intToBytes32: function (i) {
    const r = i >> 24 & 0xff;
    const g = i >> 16 & 0xff;
    const b = i >> 8 & 0xff;
    const a = i & 0xff;
    return [r, g, b, a];
  },
  bytesToInt24: function (r, g, b) {
    if (r.length) {
      b = r[2];
      g = r[1];
      r = r[0];
    }

    return r << 16 | g << 8 | b;
  },
  bytesToInt32: function (r, g, b, a) {
    if (r.length) {
      a = r[3];
      b = r[2];
      g = r[1];
      r = r[0];
    }

    return (r << 24 | g << 16 | b << 8 | a) >>> 0;
  },
  lerp: function (a, b, alpha) {
    return a + (b - a) * math.clamp(alpha, 0, 1);
  },
  lerpAngle: function (a, b, alpha) {
    if (b - a > 180) {
      b -= 360;
    }

    if (b - a < -180) {
      b += 360;
    }

    return math.lerp(a, b, math.clamp(alpha, 0, 1));
  },
  powerOfTwo: function (x) {
    return x !== 0 && !(x & x - 1);
  },
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
  random: function (min, max) {
    const diff = max - min;
    return Math.random() * diff + min;
  },
  smoothstep: function (min, max, x) {
    if (x <= min) return 0;
    if (x >= max) return 1;
    x = (x - min) / (max - min);
    return x * x * (3 - 2 * x);
  },
  smootherstep: function (min, max, x) {
    if (x <= min) return 0;
    if (x >= max) return 1;
    x = (x - min) / (max - min);
    return x * x * x * (x * (x * 6 - 15) + 10);
  },
  roundUp: function (numToRound, multiple) {
    if (multiple === 0) return numToRound;
    return Math.ceil(numToRound / multiple) * multiple;
  },
  between: function (num, a, b, inclusive) {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return inclusive ? num >= min && num <= max : num > min && num < max;
  }
};

export { math };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0aC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL21hdGgvbWF0aC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE1hdGggQVBJLlxuICpcbiAqIEBuYW1lc3BhY2VcbiAqL1xuY29uc3QgbWF0aCA9IHtcbiAgICAvKipcbiAgICAgKiBDb252ZXJzaW9uIGZhY3RvciBiZXR3ZWVuIGRlZ3JlZXMgYW5kIHJhZGlhbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIERFR19UT19SQUQ6IE1hdGguUEkgLyAxODAsXG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJzaW9uIGZhY3RvciBiZXR3ZWVuIGRlZ3JlZXMgYW5kIHJhZGlhbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIFJBRF9UT19ERUc6IDE4MCAvIE1hdGguUEksXG5cbiAgICAvKipcbiAgICAgKiBDbGFtcCBhIG51bWJlciBiZXR3ZWVuIG1pbiBhbmQgbWF4IGluY2x1c2l2ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWx1ZSAtIE51bWJlciB0byBjbGFtcC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWluIC0gTWluIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXggLSBNYXggdmFsdWUuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIGNsYW1wZWQgdmFsdWUuXG4gICAgICovXG4gICAgY2xhbXA6IGZ1bmN0aW9uICh2YWx1ZSwgbWluLCBtYXgpIHtcbiAgICAgICAgaWYgKHZhbHVlID49IG1heCkgcmV0dXJuIG1heDtcbiAgICAgICAgaWYgKHZhbHVlIDw9IG1pbikgcmV0dXJuIG1pbjtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0IGFuIDI0IGJpdCBpbnRlZ2VyIGludG8gYW4gYXJyYXkgb2YgMyBieXRlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpIC0gTnVtYmVyIGhvbGRpbmcgYW4gaW50ZWdlciB2YWx1ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyW119IEFuIGFycmF5IG9mIDMgYnl0ZXMuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBTZXQgYnl0ZXMgdG8gWzB4MTEsIDB4MjIsIDB4MzNdXG4gICAgICogdmFyIGJ5dGVzID0gcGMubWF0aC5pbnRUb0J5dGVzMjQoMHgxMTIyMzMpO1xuICAgICAqL1xuICAgIGludFRvQnl0ZXMyNDogZnVuY3Rpb24gKGkpIHtcbiAgICAgICAgY29uc3QgciA9IChpID4+IDE2KSAmIDB4ZmY7XG4gICAgICAgIGNvbnN0IGcgPSAoaSA+PiA4KSAmIDB4ZmY7XG4gICAgICAgIGNvbnN0IGIgPSAoaSkgJiAweGZmO1xuXG4gICAgICAgIHJldHVybiBbciwgZywgYl07XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgYW4gMzIgYml0IGludGVnZXIgaW50byBhbiBhcnJheSBvZiA0IGJ5dGVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGkgLSBOdW1iZXIgaG9sZGluZyBhbiBpbnRlZ2VyIHZhbHVlLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJbXX0gQW4gYXJyYXkgb2YgNCBieXRlcy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCBieXRlcyB0byBbMHgxMSwgMHgyMiwgMHgzMywgMHg0NF1cbiAgICAgKiB2YXIgYnl0ZXMgPSBwYy5tYXRoLmludFRvQnl0ZXMzMigweDExMjIzMzQ0KTtcbiAgICAgKi9cbiAgICBpbnRUb0J5dGVzMzI6IGZ1bmN0aW9uIChpKSB7XG4gICAgICAgIGNvbnN0IHIgPSAoaSA+PiAyNCkgJiAweGZmO1xuICAgICAgICBjb25zdCBnID0gKGkgPj4gMTYpICYgMHhmZjtcbiAgICAgICAgY29uc3QgYiA9IChpID4+IDgpICYgMHhmZjtcbiAgICAgICAgY29uc3QgYSA9IChpKSAmIDB4ZmY7XG5cbiAgICAgICAgcmV0dXJuIFtyLCBnLCBiLCBhXTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCAzIDggYml0IE51bWJlcnMgaW50byBhIHNpbmdsZSB1bnNpZ25lZCAyNCBiaXQgTnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGIgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHJldHVybnMge251bWJlcn0gQSBzaW5nbGUgdW5zaWduZWQgMjQgYml0IE51bWJlci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFNldCByZXN1bHQxIHRvIDB4MTEyMjMzIGZyb20gYW4gYXJyYXkgb2YgMyB2YWx1ZXNcbiAgICAgKiB2YXIgcmVzdWx0MSA9IHBjLm1hdGguYnl0ZXNUb0ludDI0KFsweDExLCAweDIyLCAweDMzXSk7XG4gICAgICpcbiAgICAgKiAvLyBTZXQgcmVzdWx0MiB0byAweDExMjIzMyBmcm9tIDMgZGlzY3JldGUgdmFsdWVzXG4gICAgICogdmFyIHJlc3VsdDIgPSBwYy5tYXRoLmJ5dGVzVG9JbnQyNCgweDExLCAweDIyLCAweDMzKTtcbiAgICAgKi9cbiAgICBieXRlc1RvSW50MjQ6IGZ1bmN0aW9uIChyLCBnLCBiKSB7XG4gICAgICAgIGlmIChyLmxlbmd0aCkge1xuICAgICAgICAgICAgYiA9IHJbMl07XG4gICAgICAgICAgICBnID0gclsxXTtcbiAgICAgICAgICAgIHIgPSByWzBdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoKHIgPDwgMTYpIHwgKGcgPDwgOCkgfCBiKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ29udmVydCA0IDEtYnl0ZSBOdW1iZXJzIGludG8gYSBzaW5nbGUgdW5zaWduZWQgMzJiaXQgTnVtYmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHIgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGcgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGIgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBBIHNpbmdsZSBieXRlICgwLTI1NSkuXG4gICAgICogQHJldHVybnMge251bWJlcn0gQSBzaW5nbGUgdW5zaWduZWQgMzJiaXQgTnVtYmVyLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gU2V0IHJlc3VsdDEgdG8gMHgxMTIyMzM0NCBmcm9tIGFuIGFycmF5IG9mIDQgdmFsdWVzXG4gICAgICogdmFyIHJlc3VsdDEgPSBwYy5tYXRoLmJ5dGVzVG9JbnQzMihbMHgxMSwgMHgyMiwgMHgzMywgMHg0NF0pO1xuICAgICAqXG4gICAgICogLy8gU2V0IHJlc3VsdDIgdG8gMHgxMTIyMzM0NCBmcm9tIDQgZGlzY3JldGUgdmFsdWVzXG4gICAgICogdmFyIHJlc3VsdDIgPSBwYy5tYXRoLmJ5dGVzVG9JbnQzMigweDExLCAweDIyLCAweDMzLCAweDQ0KTtcbiAgICAgKi9cbiAgICBieXRlc1RvSW50MzI6IGZ1bmN0aW9uIChyLCBnLCBiLCBhKSB7XG4gICAgICAgIGlmIChyLmxlbmd0aCkge1xuICAgICAgICAgICAgYSA9IHJbM107XG4gICAgICAgICAgICBiID0gclsyXTtcbiAgICAgICAgICAgIGcgPSByWzFdO1xuICAgICAgICAgICAgciA9IHJbMF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaHkgKChyIDw8IDI0KT4+PjApP1xuICAgICAgICAvLyA8PCBvcGVyYXRvciB1c2VzIHNpZ25lZCAzMiBiaXQgbnVtYmVycywgc28gMTI4PDwyNCBpcyBuZWdhdGl2ZS5cbiAgICAgICAgLy8gPj4+IHVzZWQgdW5zaWduZWQgc28gPj4+MCBjb252ZXJ0cyBiYWNrIHRvIGFuIHVuc2lnbmVkLlxuICAgICAgICAvLyBTZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xOTA4NDkyL3Vuc2lnbmVkLWludGVnZXItaW4tamF2YXNjcmlwdFxuICAgICAgICByZXR1cm4gKChyIDw8IDI0KSB8IChnIDw8IDE2KSB8IChiIDw8IDgpIHwgYSkgPj4+IDA7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZXMgdGhlIGxpbmVhciBpbnRlcnBvbGF0aW9uIG9mIHR3byBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBOdW1iZXIgdG8gbGluZWFybHkgaW50ZXJwb2xhdGUgZnJvbS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIE51bWJlciB0byBsaW5lYXJseSBpbnRlcnBvbGF0ZSB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYWxwaGEgLSBUaGUgdmFsdWUgY29udHJvbGxpbmcgdGhlIHJlc3VsdCBvZiBpbnRlcnBvbGF0aW9uLiBXaGVuIGFscGhhIGlzIDAsXG4gICAgICogYSBpcyByZXR1cm5lZC4gV2hlbiBhbHBoYSBpcyAxLCBiIGlzIHJldHVybmVkLiBCZXR3ZWVuIDAgYW5kIDEsIGEgbGluZWFyIGludGVycG9sYXRpb25cbiAgICAgKiBiZXR3ZWVuIGEgYW5kIGIgaXMgcmV0dXJuZWQuIGFscGhhIGlzIGNsYW1wZWQgYmV0d2VlbiAwIGFuZCAxLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBsaW5lYXIgaW50ZXJwb2xhdGlvbiBvZiB0d28gbnVtYmVycy5cbiAgICAgKi9cbiAgICBsZXJwOiBmdW5jdGlvbiAoYSwgYiwgYWxwaGEpIHtcbiAgICAgICAgcmV0dXJuIGEgKyAoYiAtIGEpICogbWF0aC5jbGFtcChhbHBoYSwgMCwgMSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZXMgdGhlIGxpbmVhciBpbnRlcnBvbGF0aW9uIG9mIHR3byBhbmdsZXMgZW5zdXJpbmcgdGhhdCBpbnRlcnBvbGF0aW9uIGlzIGNvcnJlY3RseVxuICAgICAqIHBlcmZvcm1lZCBhY3Jvc3MgdGhlIDM2MCB0byAwIGRlZ3JlZSBib3VuZGFyeS4gQW5nbGVzIGFyZSBzdXBwbGllZCBpbiBkZWdyZWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGEgLSBBbmdsZSAoaW4gZGVncmVlcykgdG8gbGluZWFybHkgaW50ZXJwb2xhdGUgZnJvbS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYiAtIEFuZ2xlIChpbiBkZWdyZWVzKSB0byBsaW5lYXJseSBpbnRlcnBvbGF0ZSB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYWxwaGEgLSBUaGUgdmFsdWUgY29udHJvbGxpbmcgdGhlIHJlc3VsdCBvZiBpbnRlcnBvbGF0aW9uLiBXaGVuIGFscGhhIGlzIDAsXG4gICAgICogYSBpcyByZXR1cm5lZC4gV2hlbiBhbHBoYSBpcyAxLCBiIGlzIHJldHVybmVkLiBCZXR3ZWVuIDAgYW5kIDEsIGEgbGluZWFyIGludGVycG9sYXRpb25cbiAgICAgKiBiZXR3ZWVuIGEgYW5kIGIgaXMgcmV0dXJuZWQuIGFscGhhIGlzIGNsYW1wZWQgYmV0d2VlbiAwIGFuZCAxLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBsaW5lYXIgaW50ZXJwb2xhdGlvbiBvZiB0d28gYW5nbGVzLlxuICAgICAqL1xuICAgIGxlcnBBbmdsZTogZnVuY3Rpb24gKGEsIGIsIGFscGhhKSB7XG4gICAgICAgIGlmIChiIC0gYSA+IDE4MCkge1xuICAgICAgICAgICAgYiAtPSAzNjA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGIgLSBhIDwgLTE4MCkge1xuICAgICAgICAgICAgYiArPSAzNjA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGgubGVycChhLCBiLCBtYXRoLmNsYW1wKGFscGhhLCAwLCAxKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiBhcmd1bWVudCBpcyBhIHBvd2VyLW9mLXR3byBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBOdW1iZXIgdG8gY2hlY2sgZm9yIHBvd2VyLW9mLXR3byBwcm9wZXJ0eS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZiBwb3dlci1vZi10d28gYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBwb3dlck9mVHdvOiBmdW5jdGlvbiAoeCkge1xuICAgICAgICByZXR1cm4gKCh4ICE9PSAwKSAmJiAhKHggJiAoeCAtIDEpKSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG5leHQgcG93ZXIgb2YgMiBmb3IgdGhlIHNwZWNpZmllZCB2YWx1ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWwgLSBUaGUgdmFsdWUgZm9yIHdoaWNoIHRvIGNhbGN1bGF0ZSB0aGUgbmV4dCBwb3dlciBvZiAyLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBuZXh0IHBvd2VyIG9mIDIuXG4gICAgICovXG4gICAgbmV4dFBvd2VyT2ZUd286IGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgdmFsLS07XG4gICAgICAgIHZhbCB8PSAodmFsID4+IDEpO1xuICAgICAgICB2YWwgfD0gKHZhbCA+PiAyKTtcbiAgICAgICAgdmFsIHw9ICh2YWwgPj4gNCk7XG4gICAgICAgIHZhbCB8PSAodmFsID4+IDgpO1xuICAgICAgICB2YWwgfD0gKHZhbCA+PiAxNik7XG4gICAgICAgIHZhbCsrO1xuICAgICAgICByZXR1cm4gdmFsO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYSBwc2V1ZG8tcmFuZG9tIG51bWJlciBiZXR3ZWVuIG1pbiBhbmQgbWF4LiBUaGUgbnVtYmVyIGdlbmVyYXRlZCBpcyBpbiB0aGUgcmFuZ2VcbiAgICAgKiBbbWluLCBtYXgpLCB0aGF0IGlzIGluY2x1c2l2ZSBvZiB0aGUgbWluaW11bSBidXQgZXhjbHVzaXZlIG9mIHRoZSBtYXhpbXVtLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1pbiAtIExvd2VyIGJvdW5kIGZvciByYW5nZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4IC0gVXBwZXIgYm91bmQgZm9yIHJhbmdlLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFBzZXVkby1yYW5kb20gbnVtYmVyIGJldHdlZW4gdGhlIHN1cHBsaWVkIHJhbmdlLlxuICAgICAqL1xuICAgIHJhbmRvbTogZnVuY3Rpb24gKG1pbiwgbWF4KSB7XG4gICAgICAgIGNvbnN0IGRpZmYgPSBtYXggLSBtaW47XG4gICAgICAgIHJldHVybiBNYXRoLnJhbmRvbSgpICogZGlmZiArIG1pbjtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVGhlIGZ1bmN0aW9uIGludGVycG9sYXRlcyBzbW9vdGhseSBiZXR3ZWVuIHR3byBpbnB1dCB2YWx1ZXMgYmFzZWQgb24gYSB0aGlyZCBvbmUgdGhhdCBzaG91bGRcbiAgICAgKiBiZSBiZXR3ZWVuIHRoZSBmaXJzdCB0d28uIFRoZSByZXR1cm5lZCB2YWx1ZSBpcyBjbGFtcGVkIGJldHdlZW4gMCBhbmQgMS5cbiAgICAgKlxuICAgICAqIFRoZSBzbG9wZSAoaS5lLiBkZXJpdmF0aXZlKSBvZiB0aGUgc21vb3Roc3RlcCBmdW5jdGlvbiBzdGFydHMgYXQgMCBhbmQgZW5kcyBhdCAwLiBUaGlzIG1ha2VzXG4gICAgICogaXQgZWFzeSB0byBjcmVhdGUgYSBzZXF1ZW5jZSBvZiB0cmFuc2l0aW9ucyB1c2luZyBzbW9vdGhzdGVwIHRvIGludGVycG9sYXRlIGVhY2ggc2VnbWVudFxuICAgICAqIHJhdGhlciB0aGFuIHVzaW5nIGEgbW9yZSBzb3BoaXN0aWNhdGVkIG9yIGV4cGVuc2l2ZSBpbnRlcnBvbGF0aW9uIHRlY2huaXF1ZS5cbiAgICAgKlxuICAgICAqIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1Ntb290aHN0ZXAgZm9yIG1vcmUgZGV0YWlscy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gLSBUaGUgbG93ZXIgYm91bmQgb2YgdGhlIGludGVycG9sYXRpb24gcmFuZ2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heCAtIFRoZSB1cHBlciBib3VuZCBvZiB0aGUgaW50ZXJwb2xhdGlvbiByYW5nZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB2YWx1ZSB0byBpbnRlcnBvbGF0ZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgc21vb3RobHkgaW50ZXJwb2xhdGVkIHZhbHVlIGNsYW1wZWQgYmV0d2VlbiB6ZXJvIGFuZCBvbmUuXG4gICAgICovXG4gICAgc21vb3Roc3RlcDogZnVuY3Rpb24gKG1pbiwgbWF4LCB4KSB7XG4gICAgICAgIGlmICh4IDw9IG1pbikgcmV0dXJuIDA7XG4gICAgICAgIGlmICh4ID49IG1heCkgcmV0dXJuIDE7XG5cbiAgICAgICAgeCA9ICh4IC0gbWluKSAvIChtYXggLSBtaW4pO1xuXG4gICAgICAgIHJldHVybiB4ICogeCAqICgzIC0gMiAqIHgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBbiBpbXByb3ZlZCB2ZXJzaW9uIG9mIHRoZSB7QGxpbmsgbWF0aC5zbW9vdGhzdGVwfSBmdW5jdGlvbiB3aGljaCBoYXMgemVybyAxc3QgYW5kIDJuZCBvcmRlclxuICAgICAqIGRlcml2YXRpdmVzIGF0IHQ9MCBhbmQgdD0xLlxuICAgICAqXG4gICAgICogU2VlIGh0dHA6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvU21vb3Roc3RlcCBmb3IgbW9yZSBkZXRhaWxzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1pbiAtIFRoZSBsb3dlciBib3VuZCBvZiB0aGUgaW50ZXJwb2xhdGlvbiByYW5nZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4IC0gVGhlIHVwcGVyIGJvdW5kIG9mIHRoZSBpbnRlcnBvbGF0aW9uIHJhbmdlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHZhbHVlIHRvIGludGVycG9sYXRlLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBzbW9vdGhseSBpbnRlcnBvbGF0ZWQgdmFsdWUgY2xhbXBlZCBiZXR3ZWVuIHplcm8gYW5kIG9uZS5cbiAgICAgKi9cbiAgICBzbW9vdGhlcnN0ZXA6IGZ1bmN0aW9uIChtaW4sIG1heCwgeCkge1xuICAgICAgICBpZiAoeCA8PSBtaW4pIHJldHVybiAwO1xuICAgICAgICBpZiAoeCA+PSBtYXgpIHJldHVybiAxO1xuXG4gICAgICAgIHggPSAoeCAtIG1pbikgLyAobWF4IC0gbWluKTtcblxuICAgICAgICByZXR1cm4geCAqIHggKiB4ICogKHggKiAoeCAqIDYgLSAxNSkgKyAxMCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJvdW5kcyBhIG51bWJlciB1cCB0byBuZWFyZXN0IG11bHRpcGxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG51bVRvUm91bmQgLSBUaGUgbnVtYmVyIHRvIHJvdW5kIHVwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtdWx0aXBsZSAtIFRoZSBtdWx0aXBsZSB0byByb3VuZCB1cCB0by5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBIG51bWJlciByb3VuZGVkIHVwIHRvIG5lYXJlc3QgbXVsdGlwbGUuXG4gICAgICovXG4gICAgcm91bmRVcDogZnVuY3Rpb24gKG51bVRvUm91bmQsIG11bHRpcGxlKSB7XG4gICAgICAgIGlmIChtdWx0aXBsZSA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiBudW1Ub1JvdW5kO1xuICAgICAgICByZXR1cm4gTWF0aC5jZWlsKG51bVRvUm91bmQgLyBtdWx0aXBsZSkgKiBtdWx0aXBsZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgYSBnaXZlbiBudW1iZXIgcmVzaWRlcyBiZXR3ZWVuIHR3byBvdGhlciBnaXZlbiBudW1iZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG51bSAtIFRoZSBudW1iZXIgdG8gY2hlY2sgdGhlIHBvc2l0aW9uIG9mLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhIC0gVGhlIGZpcnN0IHVwcGVyIG9yIGxvd2VyIHRocmVzaG9sZCB0byBjaGVjayBiZXR3ZWVuLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiIC0gVGhlIHNlY29uZCB1cHBlciBvciBsb3dlciB0aHJlc2hvbGQgdG8gY2hlY2sgYmV0d2Vlbi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGluY2x1c2l2ZSAtIElmIHRydWUsIGEgbnVtIHBhcmFtIHdoaWNoIGlzIGVxdWFsIHRvIGEgb3IgYiB3aWxsIHJldHVybiB0cnVlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmIGJldHdlZW4gb3IgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBiZXR3ZWVuOiBmdW5jdGlvbiAobnVtLCBhLCBiLCBpbmNsdXNpdmUpIHtcbiAgICAgICAgY29uc3QgbWluID0gTWF0aC5taW4oYSwgYik7XG4gICAgICAgIGNvbnN0IG1heCA9IE1hdGgubWF4KGEsIGIpO1xuICAgICAgICByZXR1cm4gaW5jbHVzaXZlID8gbnVtID49IG1pbiAmJiBudW0gPD0gbWF4IDogbnVtID4gbWluICYmIG51bSA8IG1heDtcbiAgICB9XG59O1xuXG5leHBvcnQgeyBtYXRoIH07XG4iXSwibmFtZXMiOlsibWF0aCIsIkRFR19UT19SQUQiLCJNYXRoIiwiUEkiLCJSQURfVE9fREVHIiwiY2xhbXAiLCJ2YWx1ZSIsIm1pbiIsIm1heCIsImludFRvQnl0ZXMyNCIsImkiLCJyIiwiZyIsImIiLCJpbnRUb0J5dGVzMzIiLCJhIiwiYnl0ZXNUb0ludDI0IiwibGVuZ3RoIiwiYnl0ZXNUb0ludDMyIiwibGVycCIsImFscGhhIiwibGVycEFuZ2xlIiwicG93ZXJPZlR3byIsIngiLCJuZXh0UG93ZXJPZlR3byIsInZhbCIsInJhbmRvbSIsImRpZmYiLCJzbW9vdGhzdGVwIiwic21vb3RoZXJzdGVwIiwicm91bmRVcCIsIm51bVRvUm91bmQiLCJtdWx0aXBsZSIsImNlaWwiLCJiZXR3ZWVuIiwibnVtIiwiaW5jbHVzaXZlIl0sIm1hcHBpbmdzIjoiOzs7OztBQUtBLE1BQU1BLElBQUksR0FBRztBQU1UQyxFQUFBQSxVQUFVLEVBQUVDLElBQUksQ0FBQ0MsRUFBTCxHQUFVLEdBTmI7QUFhVEMsRUFBQUEsVUFBVSxFQUFFLEdBQUEsR0FBTUYsSUFBSSxDQUFDQyxFQWJkO0FBdUJURSxFQUFBQSxLQUFLLEVBQUUsVUFBVUMsS0FBVixFQUFpQkMsR0FBakIsRUFBc0JDLEdBQXRCLEVBQTJCO0FBQzlCLElBQUEsSUFBSUYsS0FBSyxJQUFJRSxHQUFiLEVBQWtCLE9BQU9BLEdBQVAsQ0FBQTtBQUNsQixJQUFBLElBQUlGLEtBQUssSUFBSUMsR0FBYixFQUFrQixPQUFPQSxHQUFQLENBQUE7QUFDbEIsSUFBQSxPQUFPRCxLQUFQLENBQUE7R0ExQks7RUFzQ1RHLFlBQVksRUFBRSxVQUFVQyxDQUFWLEVBQWE7QUFDdkIsSUFBQSxNQUFNQyxDQUFDLEdBQUlELENBQUMsSUFBSSxFQUFOLEdBQVksSUFBdEIsQ0FBQTtBQUNBLElBQUEsTUFBTUUsQ0FBQyxHQUFJRixDQUFDLElBQUksQ0FBTixHQUFXLElBQXJCLENBQUE7QUFDQSxJQUFBLE1BQU1HLENBQUMsR0FBSUgsQ0FBRCxHQUFNLElBQWhCLENBQUE7QUFFQSxJQUFBLE9BQU8sQ0FBQ0MsQ0FBRCxFQUFJQyxDQUFKLEVBQU9DLENBQVAsQ0FBUCxDQUFBO0dBM0NLO0VBdURUQyxZQUFZLEVBQUUsVUFBVUosQ0FBVixFQUFhO0FBQ3ZCLElBQUEsTUFBTUMsQ0FBQyxHQUFJRCxDQUFDLElBQUksRUFBTixHQUFZLElBQXRCLENBQUE7QUFDQSxJQUFBLE1BQU1FLENBQUMsR0FBSUYsQ0FBQyxJQUFJLEVBQU4sR0FBWSxJQUF0QixDQUFBO0FBQ0EsSUFBQSxNQUFNRyxDQUFDLEdBQUlILENB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
