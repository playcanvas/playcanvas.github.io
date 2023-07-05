import { math } from './math.js';

let checkRange = 5;
const oneDiv255 = 1 / 255;
const floatView = new Float32Array(1);
const int32View = new Int32Array(floatView.buffer);

/**
 * Utility static class providing functionality to pack float values to various storage
 * representations.
 *
 * @ignore
 */
class FloatPacking {
  /**
   * Packs a float to a 16-bit half-float representation used by the GPU.
   *
   * @param {number} value - The float value to pack.
   * @returns {number} The packed value.
   */
  static float2Half(value) {
    // based on https://esdiscuss.org/topic/float16array
    // This method is faster than the OpenEXR implementation (very often
    // used, eg. in Ogre), with the additional benefit of rounding, inspired
    // by James Tursa?s half-precision code.
    floatView[0] = value;
    const x = int32View[0];
    let bits = x >> 16 & 0x8000; // Get the sign
    let m = x >> 12 & 0x07ff; // Keep one extra bit for rounding
    const e = x >> 23 & 0xff; // Using int is faster here

    // If zero, or denormal, or exponent underflows too much for a denormal half, return signed zero.
    if (e < 103) {
      return bits;
    }

    // If NaN, return NaN. If Inf or exponent overflow, return Inf.
    if (e > 142) {
      bits |= 0x7c00;

      // If exponent was 0xff and one mantissa bit was set, it means NaN,
      // not Inf, so make sure we set one mantissa bit too.
      bits |= (e === 255 ? 0 : 1) && x & 0x007fffff;
      return bits;
    }

    // If exponent underflows but not too much, return a denormal
    if (e < 113) {
      m |= 0x0800;

      // Extra rounding may overflow and set mantissa to 0 and exponent to 1, which is OK.
      bits |= (m >> 114 - e) + (m >> 113 - e & 1);
      return bits;
    }
    bits |= e - 112 << 10 | m >> 1;

    // Extra rounding. An overflow will set mantissa to 0 and increment the exponent, which is OK.
    bits += m & 1;
    return bits;
  }

  /**
   * Packs a float value in [0..1) range to specified number of bytes and stores them in an array
   * with start offset. Based on: https://aras-p.info/blog/2009/07/30/encoding-floats-to-rgba-the-final/
   * Note: calls to Math.round are only needed on iOS. Precision is somehow really bad without
   * it. Looks like an issue with their implementation of Uint8ClampedArray.
   *
   * @param {number} value - The float value to pack.
   * @param {Uint8ClampedArray} array - The array to store the packed value in.
   * @param {number} offset - The start offset in the array to store the packed value at.
   * @param {number} numBytes - The number of bytes to pack the value to.
   */
  static float2Bytes(value, array, offset, numBytes) {
    const enc1 = 255.0 * value % 1;
    array[offset + 0] = Math.round((value % 1 - oneDiv255 * enc1) * 255);
    if (numBytes > 1) {
      const enc2 = 65025.0 * value % 1;
      array[offset + 1] = Math.round((enc1 - oneDiv255 * enc2) * 255);
      if (numBytes > 2) {
        const enc3 = 16581375.0 * value % 1;
        array[offset + 2] = Math.round((enc2 - oneDiv255 * enc3) * 255);
        if (numBytes > 3) {
          array[offset + 3] = Math.round(enc3 * 255);
        }
      }
    }
  }

  /**
   * Packs a float into specified number of bytes. Min and max range for the float is specified,
   * allowing the float to be normalized to 0..1 range.
   *
   * @param {number} value - The float value to pack.
   * @param {Uint8ClampedArray} array - The array to store the packed value in.
   * @param {number} offset - The start offset in the array to store the packed value at.
   * @param {number} min - Range minimum.
   * @param {number} max - Range maximum.
   * @param {number} numBytes - The number of bytes to pack the value to.
   */
  static float2BytesRange(value, array, offset, min, max, numBytes) {
    if (value < min || value > max) {
      if (checkRange) {
        checkRange--;
        console.warn('float2BytesRange - value to pack is out of specified range.');
      }
    }
    value = math.clamp((value - min) / (max - min), 0, 1);
    FloatPacking.float2Bytes(value, array, offset, numBytes);
  }

  /**
   * Packs a float into specified number of bytes, using 1 byte for exponent and the remaining
   * bytes for the mantissa.
   *
   * @param {number} value - The float value to pack.
   * @param {Uint8ClampedArray} array - The array to store the packed value in.
   * @param {number} offset - The start offset in the array to store the packed value at.
   * @param {number} numBytes - The number of bytes to pack the value to.
   */
  static float2MantissaExponent(value, array, offset, numBytes) {
    // exponent is increased by one, so that 2^exponent is larger than the value
    const exponent = Math.floor(Math.log2(Math.abs(value))) + 1;
    value /= Math.pow(2, exponent);

    // value is now in -1..1 range, store it using specified number of bytes less one
    FloatPacking.float2BytesRange(value, array, offset, -1, 1, numBytes - 1);

    // last byte for the exponent (positive or negative)
    array[offset + numBytes - 1] = Math.round(exponent + 127);
  }
}

export { FloatPacking };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxvYXQtcGFja2luZy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2NvcmUvbWF0aC9mbG9hdC1wYWNraW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IG1hdGggfSBmcm9tICcuL21hdGguanMnO1xuXG5sZXQgY2hlY2tSYW5nZSA9IDU7XG5jb25zdCBvbmVEaXYyNTUgPSAxIC8gMjU1O1xuY29uc3QgZmxvYXRWaWV3ID0gbmV3IEZsb2F0MzJBcnJheSgxKTtcbmNvbnN0IGludDMyVmlldyA9IG5ldyBJbnQzMkFycmF5KGZsb2F0Vmlldy5idWZmZXIpO1xuXG4vKipcbiAqIFV0aWxpdHkgc3RhdGljIGNsYXNzIHByb3ZpZGluZyBmdW5jdGlvbmFsaXR5IHRvIHBhY2sgZmxvYXQgdmFsdWVzIHRvIHZhcmlvdXMgc3RvcmFnZVxuICogcmVwcmVzZW50YXRpb25zLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgRmxvYXRQYWNraW5nIHtcbiAgICAvKipcbiAgICAgKiBQYWNrcyBhIGZsb2F0IHRvIGEgMTYtYml0IGhhbGYtZmxvYXQgcmVwcmVzZW50YXRpb24gdXNlZCBieSB0aGUgR1BVLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIGZsb2F0IHZhbHVlIHRvIHBhY2suXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIHBhY2tlZCB2YWx1ZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgZmxvYXQySGFsZih2YWx1ZSkge1xuICAgICAgICAvLyBiYXNlZCBvbiBodHRwczovL2VzZGlzY3Vzcy5vcmcvdG9waWMvZmxvYXQxNmFycmF5XG4gICAgICAgIC8vIFRoaXMgbWV0aG9kIGlzIGZhc3RlciB0aGFuIHRoZSBPcGVuRVhSIGltcGxlbWVudGF0aW9uICh2ZXJ5IG9mdGVuXG4gICAgICAgIC8vIHVzZWQsIGVnLiBpbiBPZ3JlKSwgd2l0aCB0aGUgYWRkaXRpb25hbCBiZW5lZml0IG9mIHJvdW5kaW5nLCBpbnNwaXJlZFxuICAgICAgICAvLyBieSBKYW1lcyBUdXJzYT9zIGhhbGYtcHJlY2lzaW9uIGNvZGUuXG4gICAgICAgIGZsb2F0Vmlld1swXSA9IHZhbHVlO1xuICAgICAgICBjb25zdCB4ID0gaW50MzJWaWV3WzBdO1xuXG4gICAgICAgIGxldCBiaXRzID0gKHggPj4gMTYpICYgMHg4MDAwOyAvLyBHZXQgdGhlIHNpZ25cbiAgICAgICAgbGV0IG0gPSAoeCA+PiAxMikgJiAweDA3ZmY7IC8vIEtlZXAgb25lIGV4dHJhIGJpdCBmb3Igcm91bmRpbmdcbiAgICAgICAgY29uc3QgZSA9ICh4ID4+IDIzKSAmIDB4ZmY7IC8vIFVzaW5nIGludCBpcyBmYXN0ZXIgaGVyZVxuXG4gICAgICAgIC8vIElmIHplcm8sIG9yIGRlbm9ybWFsLCBvciBleHBvbmVudCB1bmRlcmZsb3dzIHRvbyBtdWNoIGZvciBhIGRlbm9ybWFsIGhhbGYsIHJldHVybiBzaWduZWQgemVyby5cbiAgICAgICAgaWYgKGUgPCAxMDMpIHtcbiAgICAgICAgICAgIHJldHVybiBiaXRzO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgTmFOLCByZXR1cm4gTmFOLiBJZiBJbmYgb3IgZXhwb25lbnQgb3ZlcmZsb3csIHJldHVybiBJbmYuXG4gICAgICAgIGlmIChlID4gMTQyKSB7XG4gICAgICAgICAgICBiaXRzIHw9IDB4N2MwMDtcblxuICAgICAgICAgICAgLy8gSWYgZXhwb25lbnQgd2FzIDB4ZmYgYW5kIG9uZSBtYW50aXNzYSBiaXQgd2FzIHNldCwgaXQgbWVhbnMgTmFOLFxuICAgICAgICAgICAgLy8gbm90IEluZiwgc28gbWFrZSBzdXJlIHdlIHNldCBvbmUgbWFudGlzc2EgYml0IHRvby5cbiAgICAgICAgICAgIGJpdHMgfD0gKChlID09PSAyNTUpID8gMCA6IDEpICYmICh4ICYgMHgwMDdmZmZmZik7XG4gICAgICAgICAgICByZXR1cm4gYml0cztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIGV4cG9uZW50IHVuZGVyZmxvd3MgYnV0IG5vdCB0b28gbXVjaCwgcmV0dXJuIGEgZGVub3JtYWxcbiAgICAgICAgaWYgKGUgPCAxMTMpIHtcbiAgICAgICAgICAgIG0gfD0gMHgwODAwO1xuXG4gICAgICAgICAgICAvLyBFeHRyYSByb3VuZGluZyBtYXkgb3ZlcmZsb3cgYW5kIHNldCBtYW50aXNzYSB0byAwIGFuZCBleHBvbmVudCB0byAxLCB3aGljaCBpcyBPSy5cbiAgICAgICAgICAgIGJpdHMgfD0gKG0gPj4gKDExNCAtIGUpKSArICgobSA+PiAoMTEzIC0gZSkpICYgMSk7XG4gICAgICAgICAgICByZXR1cm4gYml0cztcbiAgICAgICAgfVxuXG4gICAgICAgIGJpdHMgfD0gKChlIC0gMTEyKSA8PCAxMCkgfCAobSA+PiAxKTtcblxuICAgICAgICAvLyBFeHRyYSByb3VuZGluZy4gQW4gb3ZlcmZsb3cgd2lsbCBzZXQgbWFudGlzc2EgdG8gMCBhbmQgaW5jcmVtZW50IHRoZSBleHBvbmVudCwgd2hpY2ggaXMgT0suXG4gICAgICAgIGJpdHMgKz0gbSAmIDE7XG4gICAgICAgIHJldHVybiBiaXRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBhY2tzIGEgZmxvYXQgdmFsdWUgaW4gWzAuLjEpIHJhbmdlIHRvIHNwZWNpZmllZCBudW1iZXIgb2YgYnl0ZXMgYW5kIHN0b3JlcyB0aGVtIGluIGFuIGFycmF5XG4gICAgICogd2l0aCBzdGFydCBvZmZzZXQuIEJhc2VkIG9uOiBodHRwczovL2FyYXMtcC5pbmZvL2Jsb2cvMjAwOS8wNy8zMC9lbmNvZGluZy1mbG9hdHMtdG8tcmdiYS10aGUtZmluYWwvXG4gICAgICogTm90ZTogY2FsbHMgdG8gTWF0aC5yb3VuZCBhcmUgb25seSBuZWVkZWQgb24gaU9TLiBQcmVjaXNpb24gaXMgc29tZWhvdyByZWFsbHkgYmFkIHdpdGhvdXRcbiAgICAgKiBpdC4gTG9va3MgbGlrZSBhbiBpc3N1ZSB3aXRoIHRoZWlyIGltcGxlbWVudGF0aW9uIG9mIFVpbnQ4Q2xhbXBlZEFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHZhbHVlIC0gVGhlIGZsb2F0IHZhbHVlIHRvIHBhY2suXG4gICAgICogQHBhcmFtIHtVaW50OENsYW1wZWRBcnJheX0gYXJyYXkgLSBUaGUgYXJyYXkgdG8gc3RvcmUgdGhlIHBhY2tlZCB2YWx1ZSBpbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb2Zmc2V0IC0gVGhlIHN0YXJ0IG9mZnNldCBpbiB0aGUgYXJyYXkgdG8gc3RvcmUgdGhlIHBhY2tlZCB2YWx1ZSBhdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbnVtQnl0ZXMgLSBUaGUgbnVtYmVyIG9mIGJ5dGVzIHRvIHBhY2sgdGhlIHZhbHVlIHRvLlxuICAgICAqL1xuICAgIHN0YXRpYyBmbG9hdDJCeXRlcyh2YWx1ZSwgYXJyYXksIG9mZnNldCwgbnVtQnl0ZXMpIHtcbiAgICAgICAgY29uc3QgZW5jMSA9ICgyNTUuMCAqIHZhbHVlKSAlIDE7XG4gICAgICAgIGFycmF5W29mZnNldCArIDBdID0gTWF0aC5yb3VuZCgoKHZhbHVlICUgMSkgLSBvbmVEaXYyNTUgKiBlbmMxKSAqIDI1NSk7XG5cbiAgICAgICAgaWYgKG51bUJ5dGVzID4gMSkge1xuICAgICAgICAgICAgY29uc3QgZW5jMiA9ICg2NTAyNS4wICogdmFsdWUpICUgMTtcbiAgICAgICAgICAgIGFycmF5W29mZnNldCArIDFdID0gTWF0aC5yb3VuZCgoZW5jMSAtIG9uZURpdjI1NSAqIGVuYzIpICogMjU1KTtcblxuICAgICAgICAgICAgaWYgKG51bUJ5dGVzID4gMikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVuYzMgPSAoMTY1ODEzNzUuMCAqIHZhbHVlKSAlIDE7XG4gICAgICAgICAgICAgICAgYXJyYXlbb2Zmc2V0ICsgMl0gPSBNYXRoLnJvdW5kKChlbmMyIC0gb25lRGl2MjU1ICogZW5jMykgKiAyNTUpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG51bUJ5dGVzID4gMykge1xuICAgICAgICAgICAgICAgICAgICBhcnJheVtvZmZzZXQgKyAzXSA9IE1hdGgucm91bmQoZW5jMyAqIDI1NSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUGFja3MgYSBmbG9hdCBpbnRvIHNwZWNpZmllZCBudW1iZXIgb2YgYnl0ZXMuIE1pbiBhbmQgbWF4IHJhbmdlIGZvciB0aGUgZmxvYXQgaXMgc3BlY2lmaWVkLFxuICAgICAqIGFsbG93aW5nIHRoZSBmbG9hdCB0byBiZSBub3JtYWxpemVkIHRvIDAuLjEgcmFuZ2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBUaGUgZmxvYXQgdmFsdWUgdG8gcGFjay5cbiAgICAgKiBAcGFyYW0ge1VpbnQ4Q2xhbXBlZEFycmF5fSBhcnJheSAtIFRoZSBhcnJheSB0byBzdG9yZSB0aGUgcGFja2VkIHZhbHVlIGluLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBvZmZzZXQgLSBUaGUgc3RhcnQgb2Zmc2V0IGluIHRoZSBhcnJheSB0byBzdG9yZSB0aGUgcGFja2VkIHZhbHVlIGF0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gLSBSYW5nZSBtaW5pbXVtLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXggLSBSYW5nZSBtYXhpbXVtLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW1CeXRlcyAtIFRoZSBudW1iZXIgb2YgYnl0ZXMgdG8gcGFjayB0aGUgdmFsdWUgdG8uXG4gICAgICovXG4gICAgc3RhdGljIGZsb2F0MkJ5dGVzUmFuZ2UodmFsdWUsIGFycmF5LCBvZmZzZXQsIG1pbiwgbWF4LCBudW1CeXRlcykge1xuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh2YWx1ZSA8IG1pbiB8fCB2YWx1ZSA+IG1heCkge1xuICAgICAgICAgICAgaWYgKGNoZWNrUmFuZ2UpIHtcbiAgICAgICAgICAgICAgICBjaGVja1JhbmdlLS07XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdmbG9hdDJCeXRlc1JhbmdlIC0gdmFsdWUgdG8gcGFjayBpcyBvdXQgb2Ygc3BlY2lmaWVkIHJhbmdlLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHZhbHVlID0gbWF0aC5jbGFtcCgodmFsdWUgLSBtaW4pIC8gKG1heCAtIG1pbiksIDAsIDEpO1xuICAgICAgICBGbG9hdFBhY2tpbmcuZmxvYXQyQnl0ZXModmFsdWUsIGFycmF5LCBvZmZzZXQsIG51bUJ5dGVzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYWNrcyBhIGZsb2F0IGludG8gc3BlY2lmaWVkIG51bWJlciBvZiBieXRlcywgdXNpbmcgMSBieXRlIGZvciBleHBvbmVudCBhbmQgdGhlIHJlbWFpbmluZ1xuICAgICAqIGJ5dGVzIGZvciB0aGUgbWFudGlzc2EuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWUgLSBUaGUgZmxvYXQgdmFsdWUgdG8gcGFjay5cbiAgICAgKiBAcGFyYW0ge1VpbnQ4Q2xhbXBlZEFycmF5fSBhcnJheSAtIFRoZSBhcnJheSB0byBzdG9yZSB0aGUgcGFja2VkIHZhbHVlIGluLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBvZmZzZXQgLSBUaGUgc3RhcnQgb2Zmc2V0IGluIHRoZSBhcnJheSB0byBzdG9yZSB0aGUgcGFja2VkIHZhbHVlIGF0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBudW1CeXRlcyAtIFRoZSBudW1iZXIgb2YgYnl0ZXMgdG8gcGFjayB0aGUgdmFsdWUgdG8uXG4gICAgICovXG4gICAgc3RhdGljIGZsb2F0Mk1hbnRpc3NhRXhwb25lbnQodmFsdWUsIGFycmF5LCBvZmZzZXQsIG51bUJ5dGVzKSB7XG4gICAgICAgIC8vIGV4cG9uZW50IGlzIGluY3JlYXNlZCBieSBvbmUsIHNvIHRoYXQgMl5leHBvbmVudCBpcyBsYXJnZXIgdGhhbiB0aGUgdmFsdWVcbiAgICAgICAgY29uc3QgZXhwb25lbnQgPSBNYXRoLmZsb29yKE1hdGgubG9nMihNYXRoLmFicyh2YWx1ZSkpKSArIDE7XG4gICAgICAgIHZhbHVlIC89IE1hdGgucG93KDIsIGV4cG9uZW50KTtcblxuICAgICAgICAvLyB2YWx1ZSBpcyBub3cgaW4gLTEuLjEgcmFuZ2UsIHN0b3JlIGl0IHVzaW5nIHNwZWNpZmllZCBudW1iZXIgb2YgYnl0ZXMgbGVzcyBvbmVcbiAgICAgICAgRmxvYXRQYWNraW5nLmZsb2F0MkJ5dGVzUmFuZ2UodmFsdWUsIGFycmF5LCBvZmZzZXQsIC0xLCAxLCBudW1CeXRlcyAtIDEpO1xuXG4gICAgICAgIC8vIGxhc3QgYnl0ZSBmb3IgdGhlIGV4cG9uZW50IChwb3NpdGl2ZSBvciBuZWdhdGl2ZSlcbiAgICAgICAgYXJyYXlbb2Zmc2V0ICsgbnVtQnl0ZXMgLSAxXSA9IE1hdGgucm91bmQoZXhwb25lbnQgKyAxMjcpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgRmxvYXRQYWNraW5nIH07XG4iXSwibmFtZXMiOlsiY2hlY2tSYW5nZSIsIm9uZURpdjI1NSIsImZsb2F0VmlldyIsIkZsb2F0MzJBcnJheSIsImludDMyVmlldyIsIkludDMyQXJyYXkiLCJidWZmZXIiLCJGbG9hdFBhY2tpbmciLCJmbG9hdDJIYWxmIiwidmFsdWUiLCJ4IiwiYml0cyIsIm0iLCJlIiwiZmxvYXQyQnl0ZXMiLCJhcnJheSIsIm9mZnNldCIsIm51bUJ5dGVzIiwiZW5jMSIsIk1hdGgiLCJyb3VuZCIsImVuYzIiLCJlbmMzIiwiZmxvYXQyQnl0ZXNSYW5nZSIsIm1pbiIsIm1heCIsImNvbnNvbGUiLCJ3YXJuIiwibWF0aCIsImNsYW1wIiwiZmxvYXQyTWFudGlzc2FFeHBvbmVudCIsImV4cG9uZW50IiwiZmxvb3IiLCJsb2cyIiwiYWJzIiwicG93Il0sIm1hcHBpbmdzIjoiOztBQUVBLElBQUlBLFVBQVUsR0FBRyxDQUFDLENBQUE7QUFDbEIsTUFBTUMsU0FBUyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUE7QUFDekIsTUFBTUMs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
