import { BitPacking } from '../../core/math/bit-packing.js';
import { FUNC_ALWAYS, FUNC_LESSEQUAL } from './constants.js';

// masks (to only keep relevant bits)
const funcMask = 0b111;

// shifts values to where individual parts are stored
const funcShift = 0; // 00 - 02 (3bits)
const writeShift = 3; // 03 - 03 (1bit)

/**
 * DepthState is a descriptor that defines how the depth value of the fragment is used by the
 * rendering pipeline. A depth state can be set on a material using {@link Material#depthState},
 * or in some cases on the graphics device using {@link GraphicsDevice#setDepthState}.
 *
 * For the best performance, do not modify depth state after it has been created, but create
 * multiple depth states and assign them to the material or graphics device as needed.
 */
class DepthState {
  /**
   * Create a new Depth State instance.
   *
   * @param {number} func - Controls how the depth of the fragment is compared against the
   * current depth contained in the depth buffer. See {@link DepthState#func} for details.
   * Defaults to {@link FUNC_LESSEQUAL}.
   * @param {boolean} write - If true, depth values are written to the depth buffer of the
   * currently active render target. Defaults to true.
   */
  constructor(func = FUNC_LESSEQUAL, write = true) {
    /**
     * Bitfield representing the depth state.
     *
     * @private
     */
    this.data = 0;
    this.func = func;
    this.write = write;
  }

  /**
   * If true, a shader fragment is only written to the current render target if it passes the depth
   * test. If false, it is written regardless of what is in the depth buffer. Note that when depth
   * testing is disabled, writes to the depth buffer are also disabled. Defaults to true.
   *
   * @type {boolean}
   */
  set test(value) {
    this.func = value ? FUNC_LESSEQUAL : FUNC_ALWAYS;
  }
  get test() {
    return this.func !== FUNC_ALWAYS;
  }

  /**
   * If true, shader write a depth value to the depth buffer of the currently active render
   * target. If false, no depth value is written.
   *
   * @type {boolean}
   */
  set write(value) {
    this.data = BitPacking.set(this.data, value ? 1 : 0, writeShift);
  }
  get write() {
    return BitPacking.all(this.data, writeShift);
  }

  /**
   * Controls how the depth of the fragment is compared against the current depth contained in
   * the depth buffer. Can be:
   *
   * - {@link FUNC_NEVER}: don't draw
   * - {@link FUNC_LESS}: draw if new depth < depth buffer
   * - {@link FUNC_EQUAL}: draw if new depth == depth buffer
   * - {@link FUNC_LESSEQUAL}: draw if new depth <= depth buffer
   * - {@link FUNC_GREATER}: draw if new depth > depth buffer
   * - {@link FUNC_NOTEQUAL}: draw if new depth != depth buffer
   * - {@link FUNC_GREATEREQUAL}: draw if new depth >= depth buffer
   * - {@link FUNC_ALWAYS}: always draw
   *
   * @type {number}
   */
  set func(value) {
    this.data = BitPacking.set(this.data, value, funcShift, funcMask);
  }
  get func() {
    return BitPacking.get(this.data, funcShift, funcMask);
  }

  /**
   * Copies the contents of a source depth state to this depth state.
   *
   * @param {DepthState} rhs - A depth state to copy from.
   * @returns {DepthState} Self for chaining.
   */
  copy(rhs) {
    this.data = rhs.data;
    return this;
  }

  /**
   * Returns an identical copy of the specified depth state.
   *
   * @returns {this} The result of the cloning.
   */
  clone() {
    const clone = new this.constructor();
    return clone.copy(this);
  }
  get key() {
    return this.data;
  }

  /**
   * Reports whether two DepthStates are equal.
   *
   * @param {DepthState} rhs - The depth state to compare to.
   * @returns {boolean} True if the depth states are equal and false otherwise.
   */
  equals(rhs) {
    return this.data === rhs.data;
  }

  /**
   * A default depth state that has the depth testing function set to {@link FUNC_LESSEQUAL} and depth writes enabled.
   *
   * @type {DepthState}
   * @readonly
   */
}
DepthState.DEFAULT = Object.freeze(new DepthState());
/**
 * A depth state that always passes the fragment but does not write depth to the depth buffer.
 *
 * @type {DepthState}
 * @readonly
 */
DepthState.NODEPTH = Object.freeze(new DepthState(FUNC_ALWAYS, false));
/**
 * A depth state that always passes the fragment and writes depth to the depth buffer.
 *
 * @type {DepthState}
 * @readonly
 */
DepthState.WRITEDEPTH = Object.freeze(new DepthState(FUNC_ALWAYS, true));

export { DepthState };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVwdGgtc3RhdGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy9kZXB0aC1zdGF0ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCaXRQYWNraW5nIH0gZnJvbSBcIi4uLy4uL2NvcmUvbWF0aC9iaXQtcGFja2luZy5qc1wiO1xuaW1wb3J0IHtcbiAgICBGVU5DX0xFU1NFUVVBTCwgRlVOQ19BTFdBWVNcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG4vLyBtYXNrcyAodG8gb25seSBrZWVwIHJlbGV2YW50IGJpdHMpXG5jb25zdCBmdW5jTWFzayA9IDBiMTExO1xuXG4vLyBzaGlmdHMgdmFsdWVzIHRvIHdoZXJlIGluZGl2aWR1YWwgcGFydHMgYXJlIHN0b3JlZFxuY29uc3QgZnVuY1NoaWZ0ID0gMDsgICAgICAgLy8gMDAgLSAwMiAoM2JpdHMpXG5jb25zdCB3cml0ZVNoaWZ0ID0gMzsgICAgICAvLyAwMyAtIDAzICgxYml0KVxuXG4vKipcbiAqIERlcHRoU3RhdGUgaXMgYSBkZXNjcmlwdG9yIHRoYXQgZGVmaW5lcyBob3cgdGhlIGRlcHRoIHZhbHVlIG9mIHRoZSBmcmFnbWVudCBpcyB1c2VkIGJ5IHRoZVxuICogcmVuZGVyaW5nIHBpcGVsaW5lLiBBIGRlcHRoIHN0YXRlIGNhbiBiZSBzZXQgb24gYSBtYXRlcmlhbCB1c2luZyB7QGxpbmsgTWF0ZXJpYWwjZGVwdGhTdGF0ZX0sXG4gKiBvciBpbiBzb21lIGNhc2VzIG9uIHRoZSBncmFwaGljcyBkZXZpY2UgdXNpbmcge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldERlcHRoU3RhdGV9LlxuICpcbiAqIEZvciB0aGUgYmVzdCBwZXJmb3JtYW5jZSwgZG8gbm90IG1vZGlmeSBkZXB0aCBzdGF0ZSBhZnRlciBpdCBoYXMgYmVlbiBjcmVhdGVkLCBidXQgY3JlYXRlXG4gKiBtdWx0aXBsZSBkZXB0aCBzdGF0ZXMgYW5kIGFzc2lnbiB0aGVtIHRvIHRoZSBtYXRlcmlhbCBvciBncmFwaGljcyBkZXZpY2UgYXMgbmVlZGVkLlxuICovXG5jbGFzcyBEZXB0aFN0YXRlIHtcbiAgICAvKipcbiAgICAgKiBCaXRmaWVsZCByZXByZXNlbnRpbmcgdGhlIGRlcHRoIHN0YXRlLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBkYXRhID0gMDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBEZXB0aCBTdGF0ZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmdW5jIC0gQ29udHJvbHMgaG93IHRoZSBkZXB0aCBvZiB0aGUgZnJhZ21lbnQgaXMgY29tcGFyZWQgYWdhaW5zdCB0aGVcbiAgICAgKiBjdXJyZW50IGRlcHRoIGNvbnRhaW5lZCBpbiB0aGUgZGVwdGggYnVmZmVyLiBTZWUge0BsaW5rIERlcHRoU3RhdGUjZnVuY30gZm9yIGRldGFpbHMuXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHdyaXRlIC0gSWYgdHJ1ZSwgZGVwdGggdmFsdWVzIGFyZSB3cml0dGVuIHRvIHRoZSBkZXB0aCBidWZmZXIgb2YgdGhlXG4gICAgICogY3VycmVudGx5IGFjdGl2ZSByZW5kZXIgdGFyZ2V0LiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGZ1bmMgPSBGVU5DX0xFU1NFUVVBTCwgd3JpdGUgPSB0cnVlKSB7XG4gICAgICAgIHRoaXMuZnVuYyA9IGZ1bmM7XG4gICAgICAgIHRoaXMud3JpdGUgPSB3cml0ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBhIHNoYWRlciBmcmFnbWVudCBpcyBvbmx5IHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldCBpZiBpdCBwYXNzZXMgdGhlIGRlcHRoXG4gICAgICogdGVzdC4gSWYgZmFsc2UsIGl0IGlzIHdyaXR0ZW4gcmVnYXJkbGVzcyBvZiB3aGF0IGlzIGluIHRoZSBkZXB0aCBidWZmZXIuIE5vdGUgdGhhdCB3aGVuIGRlcHRoXG4gICAgICogdGVzdGluZyBpcyBkaXNhYmxlZCwgd3JpdGVzIHRvIHRoZSBkZXB0aCBidWZmZXIgYXJlIGFsc28gZGlzYWJsZWQuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgdGVzdCh2YWx1ZSkge1xuICAgICAgICB0aGlzLmZ1bmMgPSB2YWx1ZSA/IEZVTkNfTEVTU0VRVUFMIDogRlVOQ19BTFdBWVM7XG4gICAgfVxuXG4gICAgZ2V0IHRlc3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmZ1bmMgIT09IEZVTkNfQUxXQVlTO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHNoYWRlciB3cml0ZSBhIGRlcHRoIHZhbHVlIHRvIHRoZSBkZXB0aCBidWZmZXIgb2YgdGhlIGN1cnJlbnRseSBhY3RpdmUgcmVuZGVyXG4gICAgICogdGFyZ2V0LiBJZiBmYWxzZSwgbm8gZGVwdGggdmFsdWUgaXMgd3JpdHRlbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCB3cml0ZSh2YWx1ZSkge1xuICAgICAgICB0aGlzLmRhdGEgPSBCaXRQYWNraW5nLnNldCh0aGlzLmRhdGEsIHZhbHVlID8gMSA6IDAsIHdyaXRlU2hpZnQpO1xuICAgIH1cblxuICAgIGdldCB3cml0ZSgpIHtcbiAgICAgICAgcmV0dXJuIEJpdFBhY2tpbmcuYWxsKHRoaXMuZGF0YSwgd3JpdGVTaGlmdCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgaG93IHRoZSBkZXB0aCBvZiB0aGUgZnJhZ21lbnQgaXMgY29tcGFyZWQgYWdhaW5zdCB0aGUgY3VycmVudCBkZXB0aCBjb250YWluZWQgaW5cbiAgICAgKiB0aGUgZGVwdGggYnVmZmVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX05FVkVSfTogZG9uJ3QgZHJhd1xuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU306IGRyYXcgaWYgbmV3IGRlcHRoIDwgZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH06IGRyYXcgaWYgbmV3IGRlcHRoID09IGRlcHRoIGJ1ZmZlclxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggPD0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfTogZHJhdyBpZiBuZXcgZGVwdGggPiBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfTogZHJhdyBpZiBuZXcgZGVwdGggIT0gZGVwdGggYnVmZmVyXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9OiBkcmF3IGlmIG5ldyBkZXB0aCA+PSBkZXB0aCBidWZmZXJcbiAgICAgKiAtIHtAbGluayBGVU5DX0FMV0FZU306IGFsd2F5cyBkcmF3XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBmdW5jKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IEJpdFBhY2tpbmcuc2V0KHRoaXMuZGF0YSwgdmFsdWUsIGZ1bmNTaGlmdCwgZnVuY01hc2spO1xuICAgIH1cblxuICAgIGdldCBmdW5jKCkge1xuICAgICAgICByZXR1cm4gQml0UGFja2luZy5nZXQodGhpcy5kYXRhLCBmdW5jU2hpZnQsIGZ1bmNNYXNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3BpZXMgdGhlIGNvbnRlbnRzIG9mIGEgc291cmNlIGRlcHRoIHN0YXRlIHRvIHRoaXMgZGVwdGggc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0RlcHRoU3RhdGV9IHJocyAtIEEgZGVwdGggc3RhdGUgdG8gY29weSBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtEZXB0aFN0YXRlfSBTZWxmIGZvciBjaGFpbmluZy5cbiAgICAgKi9cbiAgICBjb3B5KHJocykge1xuICAgICAgICB0aGlzLmRhdGEgPSByaHMuZGF0YTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhbiBpZGVudGljYWwgY29weSBvZiB0aGUgc3BlY2lmaWVkIGRlcHRoIHN0YXRlLlxuICAgICAqXG4gICAgICogQHJldHVybnMge3RoaXN9IFRoZSByZXN1bHQgb2YgdGhlIGNsb25pbmcuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IHRoaXMuY29uc3RydWN0b3IoKTtcbiAgICAgICAgcmV0dXJuIGNsb25lLmNvcHkodGhpcyk7XG4gICAgfVxuXG4gICAgZ2V0IGtleSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnRzIHdoZXRoZXIgdHdvIERlcHRoU3RhdGVzIGFyZSBlcXVhbC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RGVwdGhTdGF0ZX0gcmhzIC0gVGhlIGRlcHRoIHN0YXRlIHRvIGNvbXBhcmUgdG8uXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGRlcHRoIHN0YXRlcyBhcmUgZXF1YWwgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBlcXVhbHMocmhzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGEgPT09IHJocy5kYXRhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZGVmYXVsdCBkZXB0aCBzdGF0ZSB0aGF0IGhhcyB0aGUgZGVwdGggdGVzdGluZyBmdW5jdGlvbiBzZXQgdG8ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfSBhbmQgZGVwdGggd3JpdGVzIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RGVwdGhTdGF0ZX1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgREVGQVVMVCA9IE9iamVjdC5mcmVlemUobmV3IERlcHRoU3RhdGUoKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGRlcHRoIHN0YXRlIHRoYXQgYWx3YXlzIHBhc3NlcyB0aGUgZnJhZ21lbnQgYnV0IGRvZXMgbm90IHdyaXRlIGRlcHRoIHRvIHRoZSBkZXB0aCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RGVwdGhTdGF0ZX1cbiAgICAgKiBAcmVhZG9ubHlcbiAgICAgKi9cbiAgICBzdGF0aWMgTk9ERVBUSCA9IE9iamVjdC5mcmVlemUobmV3IERlcHRoU3RhdGUoRlVOQ19BTFdBWVMsIGZhbHNlKSk7XG5cbiAgICAvKipcbiAgICAgKiBBIGRlcHRoIHN0YXRlIHRoYXQgYWx3YXlzIHBhc3NlcyB0aGUgZnJhZ21lbnQgYW5kIHdyaXRlcyBkZXB0aCB0byB0aGUgZGVwdGggYnVmZmVyLlxuICAgICAqXG4gICAgICogQHR5cGUge0RlcHRoU3RhdGV9XG4gICAgICogQHJlYWRvbmx5XG4gICAgICovXG4gICAgc3RhdGljIFdSSVRFREVQVEggPSBPYmplY3QuZnJlZXplKG5ldyBEZXB0aFN0YXRlKEZVTkNfQUxXQVlTLCB0cnVlKSk7XG59XG5cbmV4cG9ydCB7IERlcHRoU3RhdGUgfTtcbiJdLCJuYW1lcyI6WyJmdW5jTWFzayIsImZ1bmNTaGlmdCIsIndyaXRlU2hpZnQiLCJEZXB0aFN0YXRlIiwiY29uc3RydWN0b3IiLCJmdW5jIiwiRlVOQ19MRVNTRVFVQUwiLCJ3cml0ZSIsImRhdGEiLCJ0ZXN0IiwidmFsdWUiLCJGVU5DX0FMV0FZUyIsIkJpdFBhY2tpbmciLCJzZXQiLCJhbGwiLCJnZXQiLCJjb3B5IiwicmhzIiwiY2xvbmUiLCJrZXkiLCJlcXVhbHMiLCJERUZBVUxUIiwiT2JqZWN0IiwiZnJlZXplIiwiTk9ERVBUSCIsIldSSVRFREVQVEgiXSwibWFwcGluZ3MiOiI7OztBQUtBO0FBQ0EsTUFBTUEsUUFBUSxHQUFHLEtBQUssQ0FBQTs7QUFFdEI7QUFDQSxNQUFNQyxTQUFTLEdBQUcs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
