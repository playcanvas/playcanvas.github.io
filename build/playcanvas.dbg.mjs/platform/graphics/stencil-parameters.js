import { FUNC_ALWAYS, STENCILOP_KEEP } from './constants.js';

/**
 * Holds stencil test settings.
 */
class StencilParameters {
  /**
   * Create a new StencilParameters instance.
   *
   * @param {object} [options] - Options object to configure the stencil parameters.
   */
  constructor(options = {}) {
    var _options$func, _options$ref, _options$readMask, _options$writeMask, _options$fail, _options$zfail, _options$zpass;
    /**
     * A comparison function that decides if the pixel should be written, based on the current
     * stencil buffer value, reference value, and mask value. Can be:
     *
     * - {@link FUNC_NEVER}: never pass
     * - {@link FUNC_LESS}: pass if (ref & mask) < (stencil & mask)
     * - {@link FUNC_EQUAL}: pass if (ref & mask) == (stencil & mask)
     * - {@link FUNC_LESSEQUAL}: pass if (ref & mask) <= (stencil & mask)
     * - {@link FUNC_GREATER}: pass if (ref & mask) > (stencil & mask)
     * - {@link FUNC_NOTEQUAL}: pass if (ref & mask) != (stencil & mask)
     * - {@link FUNC_GREATEREQUAL}: pass if (ref & mask) >= (stencil & mask)
     * - {@link FUNC_ALWAYS}: always pass
     *
     * @type {number}
     */
    this.func = void 0;
    /**
     * Sets stencil test reference value used in comparisons.
     *
     * @type {number}
     */
    this.ref = void 0;
    /**
     * Operation to perform if stencil test is failed. Can be:
     *
     * - {@link STENCILOP_KEEP}: don't change the stencil buffer value
     * - {@link STENCILOP_ZERO}: set value to zero
     * - {@link STENCILOP_REPLACE}: replace value with the reference value.
     * - {@link STENCILOP_INCREMENT}: increment the value
     * - {@link STENCILOP_INCREMENTWRAP}: increment the value, but wrap it to zero when it's larger
     * than a maximum representable value
     * - {@link STENCILOP_DECREMENT}: decrement the value
     * - {@link STENCILOP_DECREMENTWRAP}: decrement the value, but wrap it to a maximum
     * representable value, if the current value is 0
     * - {@link STENCILOP_INVERT}: invert the value bitwise
     *
     * @type {number}
     */
    this.fail = void 0;
    /**
     * Operation to perform if depth test is failed. Accepts the same values as `fail`.
     *
     * @type {number}
     */
    this.zfail = void 0;
    /**
     * Operation to perform if both stencil and depth test are passed. Accepts the same values as
     * `fail`.
     *
     * @type {number}
     */
    this.zpass = void 0;
    /**
     * Mask applied to stencil buffer value and reference value before comparison.
     *
     * @type {number}
     */
    this.readMask = void 0;
    /**
     * A bit mask applied to the stencil value, when written.
     *
     * @type {number}
     */
    this.writeMask = void 0;
    this.func = (_options$func = options.func) != null ? _options$func : FUNC_ALWAYS;
    this.ref = (_options$ref = options.ref) != null ? _options$ref : 0;
    this.readMask = (_options$readMask = options.readMask) != null ? _options$readMask : 0xFF;
    this.writeMask = (_options$writeMask = options.writeMask) != null ? _options$writeMask : 0xFF;
    this.fail = (_options$fail = options.fail) != null ? _options$fail : STENCILOP_KEEP; // keep == 0
    this.zfail = (_options$zfail = options.zfail) != null ? _options$zfail : STENCILOP_KEEP;
    this.zpass = (_options$zpass = options.zpass) != null ? _options$zpass : STENCILOP_KEEP;
  }

  // TODO: we could store the key as a property and only update it when the parameters change,
  // by using a dirty flag. But considering stencil is used rarely, this can be done at a later
  // stage. This function is only called when the stencil state is enabled. We could also use
  // BitField to store the parameters and to speed up the key generation.
  get key() {
    const {
      func,
      ref,
      fail,
      zfail,
      zpass,
      readMask,
      writeMask
    } = this;
    return `${func},${ref},${fail},${zfail},${zpass},${readMask},${writeMask}`;
  }

  /**
   * Copies the contents of a source stencil parameters to this stencil parameters.
   *
   * @param {StencilParameters} rhs - A stencil parameters to copy from.
   * @returns {StencilParameters} Self for chaining.
   */
  copy(rhs) {
    this.func = rhs.func;
    this.ref = rhs.ref;
    this.readMask = rhs.readMask;
    this.writeMask = rhs.writeMask;
    this.fail = rhs.fail;
    this.zfail = rhs.zfail;
    this.zpass = rhs.zpass;
    return this;
  }

  /**
   * Clone the stencil parameters.
   *
   * @returns {StencilParameters} A cloned StencilParameters object.
   */
  clone() {
    const clone = new this.constructor();
    return clone.copy(this);
  }

  /**
   * A default stencil state.
   *
   * @type {StencilParameters}
   * @readonly
   */
}
StencilParameters.DEFAULT = Object.freeze(new StencilParameters());

export { StencilParameters };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlbmNpbC1wYXJhbWV0ZXJzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc3RlbmNpbC1wYXJhbWV0ZXJzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEZVTkNfQUxXQVlTLCBTVEVOQ0lMT1BfS0VFUCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuLyoqXG4gKiBIb2xkcyBzdGVuY2lsIHRlc3Qgc2V0dGluZ3MuXG4gKi9cbmNsYXNzIFN0ZW5jaWxQYXJhbWV0ZXJzIHtcbiAgICAvKipcbiAgICAgKiBBIGNvbXBhcmlzb24gZnVuY3Rpb24gdGhhdCBkZWNpZGVzIGlmIHRoZSBwaXhlbCBzaG91bGQgYmUgd3JpdHRlbiwgYmFzZWQgb24gdGhlIGN1cnJlbnRcbiAgICAgKiBzdGVuY2lsIGJ1ZmZlciB2YWx1ZSwgcmVmZXJlbmNlIHZhbHVlLCBhbmQgbWFzayB2YWx1ZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19ORVZFUn06IG5ldmVyIHBhc3NcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA8IChzdGVuY2lsICYgbWFzaylcbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPT0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfTogcGFzcyBpZiAocmVmICYgbWFzaykgPD0gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn06IHBhc3MgaWYgKHJlZiAmIG1hc2spID4gKHN0ZW5jaWwgJiBtYXNrKVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSAhPSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9OiBwYXNzIGlmIChyZWYgJiBtYXNrKSA+PSAoc3RlbmNpbCAmIG1hc2spXG4gICAgICogLSB7QGxpbmsgRlVOQ19BTFdBWVN9OiBhbHdheXMgcGFzc1xuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBmdW5jO1xuXG4gICAgLyoqXG4gICAgICogU2V0cyBzdGVuY2lsIHRlc3QgcmVmZXJlbmNlIHZhbHVlIHVzZWQgaW4gY29tcGFyaXNvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHJlZjtcblxuICAgIC8qKlxuICAgICAqIE9wZXJhdGlvbiB0byBwZXJmb3JtIGlmIHN0ZW5jaWwgdGVzdCBpcyBmYWlsZWQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9LRUVQfTogZG9uJ3QgY2hhbmdlIHRoZSBzdGVuY2lsIGJ1ZmZlciB2YWx1ZVxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9aRVJPfTogc2V0IHZhbHVlIHRvIHplcm9cbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfUkVQTEFDRX06IHJlcGxhY2UgdmFsdWUgd2l0aCB0aGUgcmVmZXJlbmNlIHZhbHVlLlxuICAgICAqIC0ge0BsaW5rIFNURU5DSUxPUF9JTkNSRU1FTlR9OiBpbmNyZW1lbnQgdGhlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0lOQ1JFTUVOVFdSQVB9OiBpbmNyZW1lbnQgdGhlIHZhbHVlLCBidXQgd3JhcCBpdCB0byB6ZXJvIHdoZW4gaXQncyBsYXJnZXJcbiAgICAgKiB0aGFuIGEgbWF4aW11bSByZXByZXNlbnRhYmxlIHZhbHVlXG4gICAgICogLSB7QGxpbmsgU1RFTkNJTE9QX0RFQ1JFTUVOVH06IGRlY3JlbWVudCB0aGUgdmFsdWVcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUH06IGRlY3JlbWVudCB0aGUgdmFsdWUsIGJ1dCB3cmFwIGl0IHRvIGEgbWF4aW11bVxuICAgICAqIHJlcHJlc2VudGFibGUgdmFsdWUsIGlmIHRoZSBjdXJyZW50IHZhbHVlIGlzIDBcbiAgICAgKiAtIHtAbGluayBTVEVOQ0lMT1BfSU5WRVJUfTogaW52ZXJ0IHRoZSB2YWx1ZSBiaXR3aXNlXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGZhaWw7XG5cbiAgICAvKipcbiAgICAgKiBPcGVyYXRpb24gdG8gcGVyZm9ybSBpZiBkZXB0aCB0ZXN0IGlzIGZhaWxlZC4gQWNjZXB0cyB0aGUgc2FtZSB2YWx1ZXMgYXMgYGZhaWxgLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB6ZmFpbDtcblxuICAgIC8qKlxuICAgICAqIE9wZXJhdGlvbiB0byBwZXJmb3JtIGlmIGJvdGggc3RlbmNpbCBhbmQgZGVwdGggdGVzdCBhcmUgcGFzc2VkLiBBY2NlcHRzIHRoZSBzYW1lIHZhbHVlcyBhc1xuICAgICAqIGBmYWlsYC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgenBhc3M7XG5cbiAgICAvKipcbiAgICAgKiBNYXNrIGFwcGxpZWQgdG8gc3RlbmNpbCBidWZmZXIgdmFsdWUgYW5kIHJlZmVyZW5jZSB2YWx1ZSBiZWZvcmUgY29tcGFyaXNvbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgcmVhZE1hc2s7XG5cbiAgICAvKipcbiAgICAgKiBBIGJpdCBtYXNrIGFwcGxpZWQgdG8gdGhlIHN0ZW5jaWwgdmFsdWUsIHdoZW4gd3JpdHRlbi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgd3JpdGVNYXNrO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbnMgb2JqZWN0IHRvIGNvbmZpZ3VyZSB0aGUgc3RlbmNpbCBwYXJhbWV0ZXJzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMgPSB7fSkge1xuICAgICAgICB0aGlzLmZ1bmMgPSBvcHRpb25zLmZ1bmMgPz8gRlVOQ19BTFdBWVM7XG4gICAgICAgIHRoaXMucmVmID0gb3B0aW9ucy5yZWYgPz8gMDtcbiAgICAgICAgdGhpcy5yZWFkTWFzayA9IG9wdGlvbnMucmVhZE1hc2sgPz8gMHhGRjtcbiAgICAgICAgdGhpcy53cml0ZU1hc2sgPSBvcHRpb25zLndyaXRlTWFzayA/PyAweEZGO1xuXG4gICAgICAgIHRoaXMuZmFpbCA9IG9wdGlvbnMuZmFpbCA/PyBTVEVOQ0lMT1BfS0VFUDsgLy8ga2VlcCA9PSAwXG4gICAgICAgIHRoaXMuemZhaWwgPSBvcHRpb25zLnpmYWlsID8/IFNURU5DSUxPUF9LRUVQO1xuICAgICAgICB0aGlzLnpwYXNzID0gb3B0aW9ucy56cGFzcyA/PyBTVEVOQ0lMT1BfS0VFUDtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB3ZSBjb3VsZCBzdG9yZSB0aGUga2V5IGFzIGEgcHJvcGVydHkgYW5kIG9ubHkgdXBkYXRlIGl0IHdoZW4gdGhlIHBhcmFtZXRlcnMgY2hhbmdlLFxuICAgIC8vIGJ5IHVzaW5nIGEgZGlydHkgZmxhZy4gQnV0IGNvbnNpZGVyaW5nIHN0ZW5jaWwgaXMgdXNlZCByYXJlbHksIHRoaXMgY2FuIGJlIGRvbmUgYXQgYSBsYXRlclxuICAgIC8vIHN0YWdlLiBUaGlzIGZ1bmN0aW9uIGlzIG9ubHkgY2FsbGVkIHdoZW4gdGhlIHN0ZW5jaWwgc3RhdGUgaXMgZW5hYmxlZC4gV2UgY291bGQgYWxzbyB1c2VcbiAgICAvLyBCaXRGaWVsZCB0byBzdG9yZSB0aGUgcGFyYW1ldGVycyBhbmQgdG8gc3BlZWQgdXAgdGhlIGtleSBnZW5lcmF0aW9uLlxuICAgIGdldCBrZXkoKSB7XG4gICAgICAgIGNvbnN0IHsgZnVuYywgcmVmLCBmYWlsLCB6ZmFpbCwgenBhc3MsIHJlYWRNYXNrLCB3cml0ZU1hc2sgfSA9IHRoaXM7XG4gICAgICAgIHJldHVybiBgJHtmdW5jfSwke3JlZn0sJHtmYWlsfSwke3pmYWlsfSwke3pwYXNzfSwke3JlYWRNYXNrfSwke3dyaXRlTWFza31gO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvcGllcyB0aGUgY29udGVudHMgb2YgYSBzb3VyY2Ugc3RlbmNpbCBwYXJhbWV0ZXJzIHRvIHRoaXMgc3RlbmNpbCBwYXJhbWV0ZXJzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdGVuY2lsUGFyYW1ldGVyc30gcmhzIC0gQSBzdGVuY2lsIHBhcmFtZXRlcnMgdG8gY29weSBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtTdGVuY2lsUGFyYW1ldGVyc30gU2VsZiBmb3IgY2hhaW5pbmcuXG4gICAgICovXG4gICAgY29weShyaHMpIHtcbiAgICAgICAgdGhpcy5mdW5jID0gcmhzLmZ1bmM7XG4gICAgICAgIHRoaXMucmVmID0gcmhzLnJlZjtcbiAgICAgICAgdGhpcy5yZWFkTWFzayA9IHJocy5yZWFkTWFzaztcbiAgICAgICAgdGhpcy53cml0ZU1hc2sgPSByaHMud3JpdGVNYXNrO1xuICAgICAgICB0aGlzLmZhaWwgPSByaHMuZmFpbDtcbiAgICAgICAgdGhpcy56ZmFpbCA9IHJocy56ZmFpbDtcbiAgICAgICAgdGhpcy56cGFzcyA9IHJocy56cGFzcztcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvbmUgdGhlIHN0ZW5jaWwgcGFyYW1ldGVycy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTdGVuY2lsUGFyYW1ldGVyc30gQSBjbG9uZWQgU3RlbmNpbFBhcmFtZXRlcnMgb2JqZWN0LlxuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICBjb25zdCBjbG9uZSA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCk7XG4gICAgICAgIHJldHVybiBjbG9uZS5jb3B5KHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZGVmYXVsdCBzdGVuY2lsIHN0YXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge1N0ZW5jaWxQYXJhbWV0ZXJzfVxuICAgICAqIEByZWFkb25seVxuICAgICAqL1xuICAgIHN0YXRpYyBERUZBVUxUID0gT2JqZWN0LmZyZWV6ZShuZXcgU3RlbmNpbFBhcmFtZXRlcnMoKSk7XG59XG5cbmV4cG9ydCB7IFN0ZW5jaWxQYXJhbWV0ZXJzIH07XG4iXSwibmFtZXMiOlsiU3RlbmNpbFBhcmFtZXRlcnMiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJfb3B0aW9ucyRmdW5jIiwiX29wdGlvbnMkcmVmIiwiX29wdGlvbnMkcmVhZE1hc2siLCJfb3B0aW9ucyR3cml0ZU1hc2siLCJfb3B0aW9ucyRmYWlsIiwiX29wdGlvbnMkemZhaWwiLCJfb3B0aW9ucyR6cGFzcyIsImZ1bmMiLCJyZWYiLCJmYWlsIiwiemZhaWwiLCJ6cGFzcyIsInJlYWRNYXNrIiwid3JpdGVNYXNrIiwiRlVOQ19BTFdBWVMiLCJTVEVOQ0lMT1BfS0VFUCIsImtleSIsImNvcHkiLCJyaHMiLCJjbG9uZSIsIkRFRkFVTFQiLCJPYmplY3QiLCJmcmVlemUiXSwibWFwcGluZ3MiOiI7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsaUJBQWlCLENBQUM7QUF3RXBCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsQ0FBQ0MsT0FBTyxHQUFHLEVBQUUsRUFBRTtBQUFBLElBQUEsSUFBQUMsYUFBQSxFQUFBQyxZQUFBLEVBQUFDLGlCQUFBLEVBQUFDLGtCQUFBLEVBQUFDLGFBQUEsRUFBQUMsY0FBQSxFQUFBQyxjQUFBLENBQUE7QUE1RTFCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQWRJLElBQUEsSUFBQSxDQWVBQyxJQUFJLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFFSjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLEdBQUcsR0FBQSxL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
