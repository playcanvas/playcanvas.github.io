import { BitPacking } from '../../core/math/bit-packing.js';
import { BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ZERO } from './constants.js';

// masks (to only keep relevant bits)
const opMask = 0b111;
const factorMask = 0b1111;

// shifts values to where individual parts are stored
const colorOpShift = 0; // 00 - 02 (3bits)
const colorSrcFactorShift = 3; // 03 - 06 (4bits)
const colorDstFactorShift = 7; // 07 - 10 (4bits)
const alphaOpShift = 11; // 11 - 13 (3bits)
const alphaSrcFactorShift = 14; // 14 - 17 (4bits)
const alphaDstFactorShift = 18; // 18 - 21 (4bits)
const redWriteShift = 22; // 22 (1 bit)
const greenWriteShift = 23; // 23 (1 bit)
const blueWriteShift = 24; // 24 (1 bit)
const alphaWriteShift = 25; // 25 (1 bit)
const blendShift = 26; // 26 (1 bit)

// combined values access
const allWriteMasks = 0b1111;
const allWriteShift = redWriteShift;
/**
 * BlendState is a descriptor that defines how output of fragment shader is written and blended
 * into render target. A blend state can be set on a material using {@link Material#blendState},
 * or in some cases on the graphics device using {@link GraphicsDevice#setBlendState}.
 *
 * For the best performance, do not modify blend state after it has been created, but create
 * multiple blend states and assign them to the material or graphics device as needed.
 */
class BlendState {
  /**
   * Bitfield representing the blend state for render target 0.
   *
   * @private
   */

  /**
   * Create a new BlendState instance.
   *
   * All factor parameters can take the following values:
   *
   * - {@link BLENDMODE_ZERO}
   * - {@link BLENDMODE_ONE}
   * - {@link BLENDMODE_SRC_COLOR}
   * - {@link BLENDMODE_ONE_MINUS_SRC_COLOR}
   * - {@link BLENDMODE_DST_COLOR}
   * - {@link BLENDMODE_ONE_MINUS_DST_COLOR}
   * - {@link BLENDMODE_SRC_ALPHA}
   * - {@link BLENDMODE_SRC_ALPHA_SATURATE}
   * - {@link BLENDMODE_ONE_MINUS_SRC_ALPHA}
   * - {@link BLENDMODE_DST_ALPHA}
   * - {@link BLENDMODE_ONE_MINUS_DST_ALPHA}
   * - {@link BLENDMODE_CONSTANT}
   * - {@link BLENDMODE_ONE_MINUS_CONSTANT}
   *
   * All op parameters can take the following values:
   *
   * - {@link BLENDEQUATION_ADD}
   * - {@link BLENDEQUATION_SUBTRACT}
   * - {@link BLENDEQUATION_REVERSE_SUBTRACT}
   * - {@link BLENDEQUATION_MIN}
   * - {@link BLENDEQUATION_MAX}
   *
   * Note that MIN and MAX operations on WebGL platform require either EXT_blend_minmax or WebGL2
   * to work (check device.extBlendMinmax).
   *
   * @param {boolean} [blend] - Enables or disables blending. Defaults to false.
   * @param {number} [colorOp] - Configures color blending operation. Defaults to
   * {@link BLENDEQUATION_ADD}.
   * @param {number} [colorSrcFactor] - Configures source color blending factor. Defaults to
   * {@link BLENDMODE_ONE}.
   * @param {number} [colorDstFactor] - Configures destination color blending factor. Defaults to
   * {@link BLENDMODE_ZERO}.
   * @param {number} [alphaOp] - Configures alpha blending operation. Defaults to
   * {@link BLENDEQUATION_ADD}.
   * @param {number} [alphaSrcFactor] - Configures source alpha blending factor. Defaults to
   * {@link BLENDMODE_ONE}.
   * @param {number} [alphaDstFactor] - Configures destination alpha blending factor. Defaults to
   * {@link BLENDMODE_ZERO}.
   * @param {boolean} [redWrite] - True to enable writing of the red channel and false otherwise.
   * Defaults to true.
   * @param {boolean} [greenWrite] - True to enable writing of the green channel and false
   * otherwise. Defaults to true.
   * @param {boolean} [blueWrite] - True to enable writing of the blue channel and false otherwise.
   * Defaults to true.
   * @param {boolean} [alphaWrite] - True to enable writing of the alpha channel and false
   * otherwise. Defaults to true.
   */
  constructor(blend = false, colorOp = BLENDEQUATION_ADD, colorSrcFactor = BLENDMODE_ONE, colorDstFactor = BLENDMODE_ZERO, alphaOp, alphaSrcFactor, alphaDstFactor, redWrite = true, greenWrite = true, blueWrite = true, alphaWrite = true) {
    this.target0 = 0;
    this.setColorBlend(colorOp, colorSrcFactor, colorDstFactor);
    this.setAlphaBlend(alphaOp != null ? alphaOp : colorOp, alphaSrcFactor != null ? alphaSrcFactor : colorSrcFactor, alphaDstFactor != null ? alphaDstFactor : colorDstFactor);
    this.setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite);
    this.blend = blend;
  }

  /**
   * Enables or disables blending.
   *
   * @type {boolean}
   */
  set blend(value) {
    this.target0 = BitPacking.set(this.target0, value ? 1 : 0, blendShift);
  }
  get blend() {
    return BitPacking.all(this.target0, blendShift);
  }
  setColorBlend(op, srcFactor, dstFactor) {
    this.target0 = BitPacking.set(this.target0, op, colorOpShift, opMask);
    this.target0 = BitPacking.set(this.target0, srcFactor, colorSrcFactorShift, factorMask);
    this.target0 = BitPacking.set(this.target0, dstFactor, colorDstFactorShift, factorMask);
  }
  setAlphaBlend(op, srcFactor, dstFactor) {
    this.target0 = BitPacking.set(this.target0, op, alphaOpShift, opMask);
    this.target0 = BitPacking.set(this.target0, srcFactor, alphaSrcFactorShift, factorMask);
    this.target0 = BitPacking.set(this.target0, dstFactor, alphaDstFactorShift, factorMask);
  }
  setColorWrite(redWrite, greenWrite, blueWrite, alphaWrite) {
    this.redWrite = redWrite;
    this.greenWrite = greenWrite;
    this.blueWrite = blueWrite;
    this.alphaWrite = alphaWrite;
  }
  get colorOp() {
    return BitPacking.get(this.target0, colorOpShift, opMask);
  }
  get colorSrcFactor() {
    return BitPacking.get(this.target0, colorSrcFactorShift, factorMask);
  }
  get colorDstFactor() {
    return BitPacking.get(this.target0, colorDstFactorShift, factorMask);
  }
  get alphaOp() {
    return BitPacking.get(this.target0, alphaOpShift, opMask);
  }
  get alphaSrcFactor() {
    return BitPacking.get(this.target0, alphaSrcFactorShift, factorMask);
  }
  get alphaDstFactor() {
    return BitPacking.get(this.target0, alphaDstFactorShift, factorMask);
  }
  set redWrite(value) {
    this.target0 = BitPacking.set(this.target0, value ? 1 : 0, redWriteShift);
  }
  get redWrite() {
    return BitPacking.all(this.target0, redWriteShift);
  }
  set greenWrite(value) {
    this.target0 = BitPacking.set(this.target0, value ? 1 : 0, greenWriteShift);
  }
  get greenWrite() {
    return BitPacking.all(this.target0, greenWriteShift);
  }
  set blueWrite(value) {
    this.target0 = BitPacking.set(this.target0, value ? 1 : 0, blueWriteShift);
  }
  get blueWrite() {
    return BitPacking.all(this.target0, blueWriteShift);
  }
  set alphaWrite(value) {
    this.target0 = BitPacking.set(this.target0, value ? 1 : 0, alphaWriteShift);
  }
  get alphaWrite() {
    return BitPacking.all(this.target0, alphaWriteShift);
  }
  get allWrite() {
    // return a number with all 4 bits, for fast compare
    return BitPacking.get(this.target0, allWriteShift, allWriteMasks);
  }

  /**
   * Copies the contents of a source blend state to this blend state.
   *
   * @param {BlendState} rhs - A blend state to copy from.
   * @returns {BlendState} Self for chaining.
   */
  copy(rhs) {
    this.target0 = rhs.target0;
    return this;
  }

  /**
   * Returns an identical copy of the specified blend state.
   *
   * @returns {this} The result of the cloning.
   */
  clone() {
    const clone = new this.constructor();
    return clone.copy(this);
  }
  get key() {
    return this.target0;
  }

  /**
   * Reports whether two BlendStates are equal.
   *
   * @param {BlendState} rhs - The blend state to compare to.
   * @returns {boolean} True if the blend states are equal and false otherwise.
   */
  equals(rhs) {
    return this.target0 === rhs.target0;
  }

  /**
   * A default blend state that has blending disabled and writes to all color channels.
   *
   * @type {BlendState}
   * @readonly
   */
}
BlendState.DEFAULT = Object.freeze(new BlendState());
BlendState.NOWRITE = Object.freeze(new BlendState(undefined, undefined, undefined, undefined, undefined, undefined, undefined, false, false, false, false));

export { BlendState };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmxlbmQtc3RhdGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy9ibGVuZC1zdGF0ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCaXRQYWNraW5nIH0gZnJvbSBcIi4uLy4uL2NvcmUvbWF0aC9iaXQtcGFja2luZy5qc1wiO1xuaW1wb3J0IHsgQkxFTkRFUVVBVElPTl9BREQsIEJMRU5ETU9ERV9PTkUsIEJMRU5ETU9ERV9aRVJPIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuLy8gbWFza3MgKHRvIG9ubHkga2VlcCByZWxldmFudCBiaXRzKVxuY29uc3Qgb3BNYXNrID0gMGIxMTE7XG5jb25zdCBmYWN0b3JNYXNrID0gMGIxMTExO1xuXG4vLyBzaGlmdHMgdmFsdWVzIHRvIHdoZXJlIGluZGl2aWR1YWwgcGFydHMgYXJlIHN0b3JlZFxuY29uc3QgY29sb3JPcFNoaWZ0ID0gMDsgICAgICAgICAgICAgLy8gMDAgLSAwMiAoM2JpdHMpXG5jb25zdCBjb2xvclNyY0ZhY3RvclNoaWZ0ID0gMzsgICAgICAvLyAwMyAtIDA2ICg0Yml0cylcbmNvbnN0IGNvbG9yRHN0RmFjdG9yU2hpZnQgPSA3OyAgICAgIC8vIDA3IC0gMTAgKDRiaXRzKVxuY29uc3QgYWxwaGFPcFNoaWZ0ID0gMTE7ICAgICAgICAgICAgLy8gMTEgLSAxMyAoM2JpdHMpXG5jb25zdCBhbHBoYVNyY0ZhY3RvclNoaWZ0ID0gMTQ7ICAgICAvLyAxNCAtIDE3ICg0Yml0cylcbmNvbnN0IGFscGhhRHN0RmFjdG9yU2hpZnQgPSAxODsgICAgIC8vIDE4IC0gMjEgKDRiaXRzKVxuY29uc3QgcmVkV3JpdGVTaGlmdCA9IDIyOyAgICAgICAgICAgLy8gMjIgKDEgYml0KVxuY29uc3QgZ3JlZW5Xcml0ZVNoaWZ0ID0gMjM7ICAgICAgICAgLy8gMjMgKDEgYml0KVxuY29uc3QgYmx1ZVdyaXRlU2hpZnQgPSAyNDsgICAgICAgICAgLy8gMjQgKDEgYml0KVxuY29uc3QgYWxwaGFXcml0ZVNoaWZ0ID0gMjU7ICAgICAgICAgLy8gMjUgKDEgYml0KVxuY29uc3QgYmxlbmRTaGlmdCA9IDI2OyAgICAgICAgICAgICAgLy8gMjYgKDEgYml0KVxuXG4vLyBjb21iaW5lZCB2YWx1ZXMgYWNjZXNzXG5jb25zdCBhbGxXcml0ZU1hc2tzID0gMGIxMTExO1xuY29uc3QgYWxsV3JpdGVTaGlmdCA9IHJlZFdyaXRlU2hpZnQ7XG4vKipcbiAqIEJsZW5kU3RhdGUgaXMgYSBkZXNjcmlwdG9yIHRoYXQgZGVmaW5lcyBob3cgb3V0cHV0IG9mIGZyYWdtZW50IHNoYWRlciBpcyB3cml0dGVuIGFuZCBibGVuZGVkXG4gKiBpbnRvIHJlbmRlciB0YXJnZXQuIEEgYmxlbmQgc3RhdGUgY2FuIGJlIHNldCBvbiBhIG1hdGVyaWFsIHVzaW5nIHtAbGluayBNYXRlcmlhbCNibGVuZFN0YXRlfSxcbiAqIG9yIGluIHNvbWUgY2FzZXMgb24gdGhlIGdyYXBoaWNzIGRldmljZSB1c2luZyB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0QmxlbmRTdGF0ZX0uXG4gKlxuICogRm9yIHRoZSBiZXN0IHBlcmZvcm1hbmNlLCBkbyBub3QgbW9kaWZ5IGJsZW5kIHN0YXRlIGFmdGVyIGl0IGhhcyBiZWVuIGNyZWF0ZWQsIGJ1dCBjcmVhdGVcbiAqIG11bHRpcGxlIGJsZW5kIHN0YXRlcyBhbmQgYXNzaWduIHRoZW0gdG8gdGhlIG1hdGVyaWFsIG9yIGdyYXBoaWNzIGRldmljZSBhcyBuZWVkZWQuXG4gKi9cbmNsYXNzIEJsZW5kU3RhdGUge1xuICAgIC8qKlxuICAgICAqIEJpdGZpZWxkIHJlcHJlc2VudGluZyB0aGUgYmxlbmQgc3RhdGUgZm9yIHJlbmRlciB0YXJnZXQgMC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgdGFyZ2V0MCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQmxlbmRTdGF0ZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEFsbCBmYWN0b3IgcGFyYW1ldGVycyBjYW4gdGFrZSB0aGUgZm9sbG93aW5nIHZhbHVlczpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9aRVJPfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkV9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19DT0xPUn1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfRFNUX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEF9XG4gICAgICogLSB7QGxpbmsgQkxFTkRNT0RFX1NSQ19BTFBIQV9TQVRVUkFURX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfRFNUX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0FMUEhBfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ETU9ERV9DT05TVEFOVH1cbiAgICAgKiAtIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX0NPTlNUQU5UfVxuICAgICAqXG4gICAgICogQWxsIG9wIHBhcmFtZXRlcnMgY2FuIHRha2UgdGhlIGZvbGxvd2luZyB2YWx1ZXM6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX0FERH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX1NVQlRSQUNUfVxuICAgICAqIC0ge0BsaW5rIEJMRU5ERVFVQVRJT05fUkVWRVJTRV9TVUJUUkFDVH1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX01JTn1cbiAgICAgKiAtIHtAbGluayBCTEVOREVRVUFUSU9OX01BWH1cbiAgICAgKlxuICAgICAqIE5vdGUgdGhhdCBNSU4gYW5kIE1BWCBvcGVyYXRpb25zIG9uIFdlYkdMIHBsYXRmb3JtIHJlcXVpcmUgZWl0aGVyIEVYVF9ibGVuZF9taW5tYXggb3IgV2ViR0wyXG4gICAgICogdG8gd29yayAoY2hlY2sgZGV2aWNlLmV4dEJsZW5kTWlubWF4KS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2JsZW5kXSAtIEVuYWJsZXMgb3IgZGlzYWJsZXMgYmxlbmRpbmcuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbY29sb3JPcF0gLSBDb25maWd1cmVzIGNvbG9yIGJsZW5kaW5nIG9wZXJhdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgQkxFTkRFUVVBVElPTl9BRER9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbY29sb3JTcmNGYWN0b3JdIC0gQ29uZmlndXJlcyBzb3VyY2UgY29sb3IgYmxlbmRpbmcgZmFjdG9yLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBCTEVORE1PREVfT05FfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2NvbG9yRHN0RmFjdG9yXSAtIENvbmZpZ3VyZXMgZGVzdGluYXRpb24gY29sb3IgYmxlbmRpbmcgZmFjdG9yLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBCTEVORE1PREVfWkVST30uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFthbHBoYU9wXSAtIENvbmZpZ3VyZXMgYWxwaGEgYmxlbmRpbmcgb3BlcmF0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBCTEVOREVRVUFUSU9OX0FERH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFthbHBoYVNyY0ZhY3Rvcl0gLSBDb25maWd1cmVzIHNvdXJjZSBhbHBoYSBibGVuZGluZyBmYWN0b3IuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEJMRU5ETU9ERV9PTkV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYWxwaGFEc3RGYWN0b3JdIC0gQ29uZmlndXJlcyBkZXN0aW5hdGlvbiBhbHBoYSBibGVuZGluZyBmYWN0b3IuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEJMRU5ETU9ERV9aRVJPfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtyZWRXcml0ZV0gLSBUcnVlIHRvIGVuYWJsZSB3cml0aW5nIG9mIHRoZSByZWQgY2hhbm5lbCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZ3JlZW5Xcml0ZV0gLSBUcnVlIHRvIGVuYWJsZSB3cml0aW5nIG9mIHRoZSBncmVlbiBjaGFubmVsIGFuZCBmYWxzZVxuICAgICAqIG90aGVyd2lzZS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtibHVlV3JpdGVdIC0gVHJ1ZSB0byBlbmFibGUgd3JpdGluZyBvZiB0aGUgYmx1ZSBjaGFubmVsIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFthbHBoYVdyaXRlXSAtIFRydWUgdG8gZW5hYmxlIHdyaXRpbmcgb2YgdGhlIGFscGhhIGNoYW5uZWwgYW5kIGZhbHNlXG4gICAgICogb3RoZXJ3aXNlLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGJsZW5kID0gZmFsc2UsIGNvbG9yT3AgPSBCTEVOREVRVUFUSU9OX0FERCwgY29sb3JTcmNGYWN0b3IgPSBCTEVORE1PREVfT05FLCBjb2xvckRzdEZhY3RvciA9IEJMRU5ETU9ERV9aRVJPLFxuICAgICAgICBhbHBoYU9wLCBhbHBoYVNyY0ZhY3RvciwgYWxwaGFEc3RGYWN0b3IsXG4gICAgICAgIHJlZFdyaXRlID0gdHJ1ZSwgZ3JlZW5Xcml0ZSA9IHRydWUsIGJsdWVXcml0ZSA9IHRydWUsIGFscGhhV3JpdGUgPSB0cnVlKSB7XG4gICAgICAgIHRoaXMuc2V0Q29sb3JCbGVuZChjb2xvck9wLCBjb2xvclNyY0ZhY3RvciwgY29sb3JEc3RGYWN0b3IpO1xuICAgICAgICB0aGlzLnNldEFscGhhQmxlbmQoYWxwaGFPcCA/PyBjb2xvck9wLCBhbHBoYVNyY0ZhY3RvciA/PyBjb2xvclNyY0ZhY3RvciwgYWxwaGFEc3RGYWN0b3IgPz8gY29sb3JEc3RGYWN0b3IpO1xuICAgICAgICB0aGlzLnNldENvbG9yV3JpdGUocmVkV3JpdGUsIGdyZWVuV3JpdGUsIGJsdWVXcml0ZSwgYWxwaGFXcml0ZSk7XG4gICAgICAgIHRoaXMuYmxlbmQgPSBibGVuZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIG9yIGRpc2FibGVzIGJsZW5kaW5nLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGJsZW5kKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0MCA9IEJpdFBhY2tpbmcuc2V0KHRoaXMudGFyZ2V0MCwgdmFsdWUgPyAxIDogMCwgYmxlbmRTaGlmdCk7XG4gICAgfVxuXG4gICAgZ2V0IGJsZW5kKCkge1xuICAgICAgICByZXR1cm4gQml0UGFja2luZy5hbGwodGhpcy50YXJnZXQwLCBibGVuZFNoaWZ0KTtcbiAgICB9XG5cbiAgICBzZXRDb2xvckJsZW5kKG9wLCBzcmNGYWN0b3IsIGRzdEZhY3Rvcikge1xuICAgICAgICB0aGlzLnRhcmdldDAgPSBCaXRQYWNraW5nLnNldCh0aGlzLnRhcmdldDAsIG9wLCBjb2xvck9wU2hpZnQsIG9wTWFzayk7XG4gICAgICAgIHRoaXMudGFyZ2V0MCA9IEJpdFBhY2tpbmcuc2V0KHRoaXMudGFyZ2V0MCwgc3JjRmFjdG9yLCBjb2xvclNyY0ZhY3RvclNoaWZ0LCBmYWN0b3JNYXNrKTtcbiAgICAgICAgdGhpcy50YXJnZXQwID0gQml0UGFja2luZy5zZXQodGhpcy50YXJnZXQwLCBkc3RGYWN0b3IsIGNvbG9yRHN0RmFjdG9yU2hpZnQsIGZhY3Rvck1hc2spO1xuICAgIH1cblxuICAgIHNldEFscGhhQmxlbmQob3AsIHNyY0ZhY3RvciwgZHN0RmFjdG9yKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0MCA9IEJpdFBhY2tpbmcuc2V0KHRoaXMudGFyZ2V0MCwgb3AsIGFscGhhT3BTaGlmdCwgb3BNYXNrKTtcbiAgICAgICAgdGhpcy50YXJnZXQwID0gQml0UGFja2luZy5zZXQodGhpcy50YXJnZXQwLCBzcmNGYWN0b3IsIGFscGhhU3JjRmFjdG9yU2hpZnQsIGZhY3Rvck1hc2spO1xuICAgICAgICB0aGlzLnRhcmdldDAgPSBCaXRQYWNraW5nLnNldCh0aGlzLnRhcmdldDAsIGRzdEZhY3RvciwgYWxwaGFEc3RGYWN0b3JTaGlmdCwgZmFjdG9yTWFzayk7XG4gICAgfVxuXG4gICAgc2V0Q29sb3JXcml0ZShyZWRXcml0ZSwgZ3JlZW5Xcml0ZSwgYmx1ZVdyaXRlLCBhbHBoYVdyaXRlKSB7XG4gICAgICAgIHRoaXMucmVkV3JpdGUgPSByZWRXcml0ZTtcbiAgICAgICAgdGhpcy5ncmVlbldyaXRlID0gZ3JlZW5Xcml0ZTtcbiAgICAgICAgdGhpcy5ibHVlV3JpdGUgPSBibHVlV3JpdGU7XG4gICAgICAgIHRoaXMuYWxwaGFXcml0ZSA9IGFscGhhV3JpdGU7XG4gICAgfVxuXG4gICAgZ2V0IGNvbG9yT3AoKSB7XG4gICAgICAgIHJldHVybiBCaXRQYWNraW5nLmdldCh0aGlzLnRhcmdldDAsIGNvbG9yT3BTaGlmdCwgb3BNYXNrKTtcbiAgICB9XG5cbiAgICBnZXQgY29sb3JTcmNGYWN0b3IoKSB7XG4gICAgICAgIHJldHVybiBCaXRQYWNraW5nLmdldCh0aGlzLnRhcmdldDAsIGNvbG9yU3JjRmFjdG9yU2hpZnQsIGZhY3Rvck1hc2spO1xuICAgIH1cblxuICAgIGdldCBjb2xvckRzdEZhY3RvcigpIHtcbiAgICAgICAgcmV0dXJuIEJpdFBhY2tpbmcuZ2V0KHRoaXMudGFyZ2V0MCwgY29sb3JEc3RGYWN0b3JTaGlmdCwgZmFjdG9yTWFzayk7XG4gICAgfVxuXG4gICAgZ2V0IGFscGhhT3AoKSB7XG4gICAgICAgIHJldHVybiBCaXRQYWNraW5nLmdldCh0aGlzLnRhcmdldDAsIGFscGhhT3BTaGlmdCwgb3BNYXNrKTtcbiAgICB9XG5cbiAgICBnZXQgYWxwaGFTcmNGYWN0b3IoKSB7XG4gICAgICAgIHJldHVybiBCaXRQYWNraW5nLmdldCh0aGlzLnRhcmdldDAsIGFscGhhU3JjRmFjdG9yU2hpZnQsIGZhY3Rvck1hc2spO1xuICAgIH1cblxuICAgIGdldCBhbHBoYURzdEZhY3RvcigpIHtcbiAgICAgICAgcmV0dXJuIEJpdFBhY2tpbmcuZ2V0KHRoaXMudGFyZ2V0MCwgYWxwaGFEc3RGYWN0b3JTaGlmdCwgZmFjdG9yTWFzayk7XG4gICAgfVxuXG4gICAgc2V0IHJlZFdyaXRlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0MCA9IEJpdFBhY2tpbmcuc2V0KHRoaXMudGFyZ2V0MCwgdmFsdWUgPyAxIDogMCwgcmVkV3JpdGVTaGlmdCk7XG4gICAgfVxuXG4gICAgZ2V0IHJlZFdyaXRlKCkge1xuICAgICAgICByZXR1cm4gQml0UGFja2luZy5hbGwodGhpcy50YXJnZXQwLCByZWRXcml0ZVNoaWZ0KTtcbiAgICB9XG5cbiAgICBzZXQgZ3JlZW5Xcml0ZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLnRhcmdldDAgPSBCaXRQYWNraW5nLnNldCh0aGlzLnRhcmdldDAsIHZhbHVlID8gMSA6IDAsIGdyZWVuV3JpdGVTaGlmdCk7XG4gICAgfVxuXG4gICAgZ2V0IGdyZWVuV3JpdGUoKSB7XG4gICAgICAgIHJldHVybiBCaXRQYWNraW5nLmFsbCh0aGlzLnRhcmdldDAsIGdyZWVuV3JpdGVTaGlmdCk7XG4gICAgfVxuXG4gICAgc2V0IGJsdWVXcml0ZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLnRhcmdldDAgPSBCaXRQYWNraW5nLnNldCh0aGlzLnRhcmdldDAsIHZhbHVlID8gMSA6IDAsIGJsdWVXcml0ZVNoaWZ0KTtcbiAgICB9XG5cbiAgICBnZXQgYmx1ZVdyaXRlKCkge1xuICAgICAgICByZXR1cm4gQml0UGFja2luZy5hbGwodGhpcy50YXJnZXQwLCBibHVlV3JpdGVTaGlmdCk7XG4gICAgfVxuXG4gICAgc2V0IGFscGhhV3JpdGUodmFsdWUpIHtcbiAgICAgICAgdGhpcy50YXJnZXQwID0gQml0UGFja2luZy5zZXQodGhpcy50YXJnZXQwLCB2YWx1ZSA/IDEgOiAwLCBhbHBoYVdyaXRlU2hpZnQpO1xuICAgIH1cblxuICAgIGdldCBhbHBoYVdyaXRlKCkge1xuICAgICAgICByZXR1cm4gQml0UGFja2luZy5hbGwodGhpcy50YXJnZXQwLCBhbHBoYVdyaXRlU2hpZnQpO1xuICAgIH1cblxuICAgIGdldCBhbGxXcml0ZSgpIHtcbiAgICAgICAgLy8gcmV0dXJuIGEgbnVtYmVyIHdpdGggYWxsIDQgYml0cywgZm9yIGZhc3QgY29tcGFyZVxuICAgICAgICByZXR1cm4gQml0UGFja2luZy5nZXQodGhpcy50YXJnZXQwLCBhbGxXcml0ZVNoaWZ0LCBhbGxXcml0ZU1hc2tzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIGJsZW5kIHN0YXRlIHRvIHRoaXMgYmxlbmQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0JsZW5kU3RhdGV9IHJocyAtIEEgYmxlbmQgc3RhdGUgdG8gY29weSBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtCbGVuZFN0YXRlfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBjb3B5KHJocykge1xuICAgICAgICB0aGlzLnRhcmdldDAgPSByaHMudGFyZ2V0MDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBpZGVudGljYWwgY29weSBvZiB0aGUgc3BlY2lmaWVkIGJsZW5kIHN0YXRlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IFRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgcmV0dXJuIGNsb25lLmNvcHkodGhpcyk7XG4gICAgfVxuXG4gICAgZ2V0IGtleSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGFyZ2V0MDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIEJsZW5kU3RhdGVzIGFyZSBlcXVhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QmxlbmRTdGF0ZX0gcmhzIC0gVGhlIGJsZW5kIHN0YXRlIHRvIGNvbXBhcmUgdG8uXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGJsZW5kIHN0YXRlcyBhcmUgZXF1YWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRhcmdldDAgPT09IHJocy50YXJnZXQwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZGVmYXVsdCBibGVuZCBzdGF0ZSB0aGF0IGhhcyBibGVuZGluZyBkaXNhYmxlZCBhbmQgd3JpdGVzIHRvIGFsbCBjb2xvciBjaGFubmVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtCbGVuZFN0YXRlfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBERUZBVUxUID0gT2JqZWN0LmZyZWV6ZShuZXcgQmxlbmRTdGF0ZSgpKTtcblxuICAgIC8qKlxuICAgICAqIEEgYmxlbmQgc3RhdGUgdGhhdCBkb2VzIG5vdCB3cml0ZSB0byBjb2xvciBjaGFubmVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtCbGVuZFN0YXRlfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBOT1dSSVRFID0gT2JqZWN0LmZyZWV6ZShuZXcgQmxlbmRTdGF0ZSh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIGZhbHNlKSk7XG59XG5cbmV4cG9ydCB7IEJsZW5kU3RhdGUgfTtcbiJdLCJuYW1lcyI6WyJvcE1hc2siLCJmYWN0b3JNYXNrIiwiY29sb3JPcFNoaWZ0IiwiY29sb3JTcmNGYWN0b3JTaGlmdCIsImNvbG9yRHN0RmFjdG9yU2hpZnQiLCJhbHBoYU9wU2hpZnQiLCJhbHBoYVNyY0ZhY3RvclNoaWZ0IiwiYWxwaGFEc3RGYWN0b3JTaGlmdCIsInJlZFdyaXRlU2hpZnQiLCJncmVlbldyaXRlU2hpZnQiLCJibHVlV3JpdGVTaGlmdCIsImFscGhhV3JpdGVTaGlmdCIsImJsZW5kU2hpZnQiLCJhbGxXcml0ZU1hc2tzIiwiYWxsV3JpdGVTaGlmdCIsIkJsZW5kU3RhdGUiLCJjb25zdHJ1Y3RvciIsImJsZW5kIiwiY29sb3JPcCIsIkJMRU5ERVFVQVRJT05fQUREIiwiY29sb3JTcmNGYWN0b3IiLCJCTEVORE1PREVfT05FIiwiY29sb3JEc3RGYWN0b3IiLCJCTEVORE1PREVfWkVSTyIsImFscGhhT3AiLCJhbHBoYVNyY0ZhY3RvciIsImFscGhhRHN0RmFjdG9yIiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsInRhcmdldDAiLCJzZXRDb2xvckJsZW5kIiwic2V0QWxwaGFCbGVuZCIsInNldENvbG9yV3JpdGUiLCJ2YWx1ZSIsIkJpdFBhY2tpbmciLCJzZXQiLCJhbGwiLCJvcCIsInNyY0ZhY3RvciIsImRzdEZhY3RvciIsImdldCIsImFsbFdyaXRlIiwiY29weSIsInJocyIsImNsb25lIiwia2V5IiwiZXF1YWxzIiwiREVGQVVMVCIsIk9iamVjdCIsImZyZWV6ZSIsIk5PV1JJVEUiLCJ1bmRlZmluZWQiXSwibWFwcGluZ3MiOiI7OztBQUdBO0FBQ0EsTUFBTUEsTUFBTSxHQUFHLEtBQUssQ0FBQTtBQUNwQixNQUFNQyxVQUFVLEdBQUcsTUFBTSxDQUFBOztBQUV6QjtBQUNBLE1BQU1DLFlBQVksR0FBRyxDQUFDLENBQUM7QUFDdkIsTUFBTUMsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDO0FBQzlCLE1BQU1DLG1CQUFtQixHQUFHLENBQUMsQ0FBQztBQUM5QixNQUFNQyxZQUFZLEdBQUcsRUFBRSxDQUFDO0FBQ3hCLE1BQU1DLG1CQUFtQixHQUFHLEVBQUUsQ0FBQztBQUMvQixNQUFNQyxtQkFBbUIsR0FBRyxFQUFFLENBQUM7QUFDL0IsTUFBTUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztBQUN6QixNQUFNQyxlQUFlLEdBQUcsRUFBRSxDQUFDO0FBQzNCLE1BQU1DLGNBQWMsR0FBRyxFQUFFLENBQUM7QUFDMUIsTUFBTUMsZUFBZSxHQUFHLEVBQUUsQ0FBQztBQUMzQixNQUFNQyxVQUFVLEdBQUcsRUFBRSxDQUFDOztBQUV0QjtBQUNBLE1BQU1DLGFBQWEsR0FBRyxNQUFNLENBQUE7QUFDNUIsTUFBTUMsYUFBYSxHQUFHTixhQUFhLENBQUE7QUFDbkM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1PLFVBQVUsQ0FBQztBQUNiO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsS0FBSyxHQUFHLEtBQUssRUFBRUMsT0FBTyxHQUFHQyxpQkFBaUIsRUFBRUMsY0FBYyxHQUFHQyxhQUFhLEVBQUVDLGNBQWMsR0FBR0MsY0FBYyxFQUNuSEMsT0FBTyxFQUFFQyxjQUFjLEVBQUVDLGNBQWMsRUFDdkNDLFFBQVEsR0FBRyxJQUFJLEVBQUVDLFVBQVUsR0FBRyxJQUFJLEVBQUVDLFNBQVMsR0FBRyxJQUFJLEVBQUVDLFVBQVUsR0FBRyxJQUFJLEVBQUU7SUFBQSxJQXhEN0VDLENBQUFBLE9BQU8sR0FBRyxDQUFDLENBQUE7SUF5RFAsSUFBSSxDQUFDQyxhQUFhLENBQUNkLE9BQU8sRUFBRUUsY0FBYyxFQUFFRSxjQUFjLENBQUMsQ0FBQTtJQUMzRCxJQUFJLENBQUNXLGFBQWEsQ0FBQ1QsT0FBTyxXQUFQQSxPQUFPLEdBQUlOLE9BQU8sRUFBRU8sY0FBYyxXQUFkQSxjQUFjLEdBQUlMLGNBQWMsRUFBRU0sY0FBYyxXQUFkQSxjQUFjLEdBQUlKLGNBQWMsQ0FBQyxDQUFBO0lBQzFHLElBQUksQ0FBQ1ksYUFBYSxDQUFDUCxRQUFRLEVBQUVDLFVBQVUsRUFBRUMsU0FBUyxFQUFFQyxVQUFVLENBQUMsQ0FBQTtJQUMvRCxJQUFJLENBQUNiLEtBQUssR0FBR0EsS0FBSyxDQUFBO0FBQ3RCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJLElBQUlBLEtBQUtBLENBQUNrQixLQUFLLEVBQUU7QUFDYixJQUFBLElBQUksQ0FBQ0osT0FBTyxHQUFHSyxVQUFVLENBQUNDLEdBQUcsQ0FBQyxJQUFJLENBQUNOLE9BQU8sRUFBRUksS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUV2QixVQUFVLENBQUMsQ0FBQTtBQUMxRSxHQUFBO0VBRUEsSUFBSUssS0FBS0EsR0FBRztJQUNSLE9BQU9tQixVQUFVLENBQUNFLEdBQUcsQ0FBQyxJQUFJLENBQUNQLE9BQU8sRUFBRW5CLFVBQVUsQ0FBQyxDQUFBO0FBQ25ELEdBQUE7QUFFQW9CLEVBQUFBLGFBQWFBLENBQUNPLEVBQUUsRUFBRUMsU0FBUyxFQUFFQyxTQUFTLEVBQUU7QUFDcEMsSUFBQSxJQUFJLENBQUNWLE9BQU8sR0FBR0ssVUFBVSxDQUFDQyxHQUFHLENBQUMsSUFBSSxDQUFDTixPQUFPLEVBQUVRLEVBQUUsRUFBRXJDLFlBQVksRUFBRUYsTUFBTSxDQUFDLENBQUE7QUFDckUsSUFBQSxJQUFJLENBQUMrQixPQUFPLEdBQUdLLFVBQVUsQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQ04sT0FBTyxFQUFFUyxTQUFTLEVBQUVyQyxtQkFBbUIsRUFBRUYsVUFBVSxDQUFDLENBQUE7QUFDdkYsSUFBQSxJQUFJLENBQUM4QixPQUFPLEdBQUdLLFVBQVUsQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQ04sT0FBTyxFQUFFVSxTQUFTLEVBQUVyQyxtQkFBbUIsRUFBRUgsVUFBVSxDQUFDLENBQUE7QUFDM0YsR0FBQTtBQUVBZ0MsRUFBQUEsYUFBYUEsQ0FBQ00sRUFBRSxFQUFFQyxTQUFTLEVBQUVDLFNBQVMsRUFBRTtBQUNwQyxJQUFBLElBQUksQ0FBQ1YsT0FBTyxHQUFHSyxVQUFVLENBQUNDLEdBQUcsQ0FBQyxJQUFJLENBQUNOLE9BQU8sRUFBRVEsRUFBRSxFQUFFbEMsWUFBWSxFQUFFTCxNQUFNLENBQUMsQ0FBQTtBQUNyRSxJQUFBLElBQUksQ0FBQytCLE9BQU8sR0FBR0ssVUFBVSxDQUFDQyxHQUFHLENBQUMsSUFBSSxDQUFDTixPQUFPLEVBQUVTLFNBQVMsRUFBRWxDLG1CQUFtQixFQUFFTCxVQUFVLENBQUMsQ0FBQTtBQUN2RixJQUFBLElBQUksQ0FBQzhCLE9BQU8sR0FBR0ssVUFBVSxDQUFDQyxHQUFHLENBQUMsSUFBSSxDQUFDTixPQUFPLEVBQUVVLFNBQVMsRUFBRWxDLG1CQUFtQixFQUFFTixVQUFVLENBQUMsQ0FBQTtBQUMzRixHQUFBO0VBRUFpQyxhQUFhQSxDQUFDUCxRQUFRLEVBQUVDLFVBQVUsRUFBRUMsU0FBUyxFQUFFQyxVQUFVLEVBQUU7SUFDdkQsSUFBSSxDQUFDSCxRQUFRLEdBQUdBLFFBQVEsQ0FBQTtJQUN4QixJQUFJLENBQUNDLFVBQVUsR0FBR0EsVUFBVSxDQUFBO0lBQzVCLElBQUksQ0FBQ0MsU0FBUyxHQUFHQSxTQUFTLENBQUE7SUFDMUIsSUFBSSxDQUFDQyxVQUFVLEdBQUdBLFVBQVUsQ0FBQTtBQUNoQyxHQUFBO0VBRUEsSUFBSVosT0FBT0EsR0FBRztJQUNWLE9BQU9rQixVQUFVLENBQUNNLEdBQUcsQ0FBQyxJQUFJLENBQUNYLE9BQU8sRUFBRTdCLFlBQVksRUFBRUYsTUFBTSxDQUFDLENBQUE7QUFDN0QsR0FBQTtFQUVBLElBQUlvQixjQUFjQSxHQUFHO0lBQ2pCLE9BQU9nQixVQUFVLENBQUNNLEdBQUcsQ0FBQyxJQUFJLENBQUNYLE9BQU8sRUFBRTVCLG1CQUFtQixFQUFFRixVQUFVLENBQUMsQ0FBQTtBQUN4RSxHQUFBO0VBRUEsSUFBSXFCLGNBQWNBLEdBQUc7SUFDakIsT0FBT2MsVUFBVSxDQUFDTSxHQUFHLENBQUMsSUFBSSxDQUFDWCxPQUFPLEVBQUUzQixtQkFBbUIsRUFBRUgsVUFBVSxDQUFDLENBQUE7QUFDeEUsR0FBQTtFQUVBLElBQUl1QixPQUFPQSxHQUFHO0lBQ1YsT0FBT1ksVUFBVSxDQUFDTSxHQUFHLENBQUMsSUFBSSxDQUFDWCxPQUFPLEVBQUUxQixZQUFZLEVBQUVMLE1BQU0sQ0FBQyxDQUFBO0FBQzdELEdBQUE7RUFFQSxJQUFJeUIsY0FBY0EsR0FBRztJQUNqQixPQUFPVyxVQUFVLENBQUNNLEdBQUcsQ0FBQyxJQUFJLENBQUNYLE9BQU8sRUFBRXpCLG1CQUFtQixFQUFFTCxVQUFVLENBQUMsQ0FBQTtBQUN4RSxHQUFBO0VBRUEsSUFBSXlCLGNBQWNBLEdBQUc7SUFDakIsT0FBT1UsVUFBVSxDQUFDTSxHQUFHLENBQUMsSUFBSSxDQUFDWCxPQUFPLEVBQUV4QixtQkFBbUIsRUFBRU4sVUFBVSxDQUFDLENBQUE7QUFDeEUsR0FBQTtFQUVBLElBQUkwQixRQUFRQSxDQUFDUSxLQUFLLEVBQUU7QUFDaEIsSUFBQSxJQUFJLENBQUNKLE9BQU8sR0FBR0ssVUFBVSxDQUFDQyxHQUFHLENBQUMsSUFBSSxDQUFDTixPQUFPLEVBQUVJLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFM0IsYUFBYSxDQUFDLENBQUE7QUFDN0UsR0FBQTtFQUVBLElBQUltQixRQUFRQSxHQUFHO0lBQ1gsT0FBT1MsVUFBVSxDQUFDRSxHQUFHLENBQUMsSUFBSSxDQUFDUCxPQUFPLEVBQUV2QixhQUFhLENBQUMsQ0FBQTtBQUN0RCxHQUFBO0VBRUEsSUFBSW9CLFVBQVVBLENBQUNPLEtBQUssRUFBRTtBQUNsQixJQUFBLElBQUksQ0FBQ0osT0FBTyxHQUFHSyxVQUFVLENBQUNDLEdBQUcsQ0FBQyxJQUFJLENBQUNOLE9BQU8sRUFBRUksS0FBSyxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUxQixlQUFlLENBQUMsQ0FBQTtBQUMvRSxHQUFBO0VBRUEsSUFBSW1CLFVBQVVBLEdBQUc7SUFDYixPQUFPUSxVQUFVLENBQUNFLEdBQUcsQ0FBQyxJQUFJLENBQUNQLE9BQU8sRUFBRXRCLGVBQWUsQ0FBQyxDQUFBO0FBQ3hELEdBQUE7RUFFQSxJQUFJb0IsU0FBU0EsQ0FBQ00sS0FBSyxFQUFFO0FBQ2pCLElBQUEsSUFBSSxDQUFDSixPQUFPLEdBQUdLLFVBQVUsQ0FBQ0MsR0FBRyxDQUFDLElBQUksQ0FBQ04sT0FBTyxFQUFFSSxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRXpCLGNBQWMsQ0FBQyxDQUFBO0FBQzlFLEdBQUE7RUFFQSxJQUFJbUIsU0FBU0EsR0FBRztJQUNaLE9BQU9PLFVBQVUsQ0FBQ0UsR0FBRyxDQUFDLElBQUksQ0FBQ1AsT0FBTyxFQUFFckIsY0FBYyxDQUFDLENBQUE7QUFDdkQsR0FBQTtFQUVBLElBQUlvQixVQUFVQSxDQUFDSyxLQUFLLEVBQUU7QUFDbEIsSUFBQSxJQUFJLENBQUNKLE9BQU8sR0FBR0ssVUFBVSxDQUFDQyxHQUFHLENBQUMsSUFBSSxDQUFDTixPQUFPLEVBQUVJLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFeEIsZUFBZSxDQUFDLENBQUE7QUFDL0UsR0FBQTtFQUVBLElBQUltQixVQUFVQSxHQUFHO0lBQ2IsT0FBT00sVUFBVSxDQUFDRSxHQUFHLENBQUMsSUFBSSxDQUFDUCxPQUFPLEVBQUVwQixlQUFlLENBQUMsQ0FBQTtBQUN4RCxHQUFBO0VBRUEsSUFBSWdDLFFBQVFBLEdBQUc7QUFDWDtJQUNBLE9BQU9QLFVBQVUsQ0FBQ00sR0FBRyxDQUFDLElBQUksQ0FBQ1gsT0FBTyxFQUFFakIsYUFBYSxFQUFFRCxhQUFhLENBQUMsQ0FBQTtBQUNyRSxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJK0IsSUFBSUEsQ0FBQ0MsR0FBRyxFQUFFO0FBQ04sSUFBQSxJQUFJLENBQUNkLE9BQU8sR0FBR2MsR0FBRyxDQUFDZCxPQUFPLENBQUE7QUFDMUIsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJZSxFQUFBQSxLQUFLQSxHQUFHO0FBQ0osSUFBQSxNQUFNQSxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUM5QixXQUFXLEVBQUUsQ0FBQTtBQUNwQyxJQUFBLE9BQU84QixLQUFLLENBQUNGLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUMzQixHQUFBO0VBRUEsSUFBSUcsR0FBR0EsR0FBRztJQUNOLE9BQU8sSUFBSSxDQUFDaEIsT0FBTyxDQUFBO0FBQ3ZCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lpQixNQUFNQSxDQUFDSCxHQUFHLEVBQUU7QUFDUixJQUFBLE9BQU8sSUFBSSxDQUFDZCxPQUFPLEtBQUtjLEdBQUcsQ0FBQ2QsT0FBTyxDQUFBO0FBQ3ZDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBVUEsQ0FBQTtBQXBOTWhCLFVBQVUsQ0EyTUxrQyxPQUFPLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUlwQyxVQUFVLEVBQUUsQ0FBQyxDQUFBO0FBM005Q0EsVUFBVSxDQW1OTHFDLE9BQU8sR0FBR0YsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSXBDLFVBQVUsQ0FBQ3NDLFNBQVMsRUFBRUEsU0FBUyxFQUFFQSxTQUFTLEVBQUVBLFNBQVMsRUFBRUEsU0FBUyxFQUFFQSxTQUFTLEVBQUVBLFNBQVMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQzs7OzsifQ==
