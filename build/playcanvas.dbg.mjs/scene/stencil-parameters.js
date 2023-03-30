/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { FUNC_ALWAYS, STENCILOP_KEEP } from '../platform/graphics/constants.js';

/**
 * Holds stencil test settings.
 */
class StencilParameters {
  /**
   * Sets stencil test function. See {@link GraphicsDevice#setStencilFunc}.
   *
   * @type {number}
   */

  /**
   * Sets stencil test reference value. See {@link GraphicsDevice#setStencilFunc}.
   *
   * @type {number}
   */

  /**
   * Sets operation to perform if stencil test is failed. See {@link GraphicsDevice#setStencilOperation}.
   *
   * @type {number}
   */

  /**
   * Sets operation to perform if depth test is failed. See {@link GraphicsDevice#setStencilOperation}.
   *
   * @type {number}
   */

  /**
   * Sets operation to perform if both stencil and depth test are passed. See {@link GraphicsDevice#setStencilOperation}.
   *
   * @type {number}
   */

  /**
   * Sets stencil test reading mask. See {@link GraphicsDevice#setStencilFunc}.
   *
   * @type {number}
   */

  /**
   * Sets stencil test writing mask. See {@link GraphicsDevice#setStencilOperation}.
   *
   * @type {number}
   */

  /**
   * Create a new StencilParameters instance.
   *
   * @param {object} options - Options object to configure the stencil parameters.
   */
  constructor(options) {
    var _options$func, _options$ref, _options$readMask, _options$writeMask, _options$fail, _options$zfail, _options$zpass;
    this.func = void 0;
    this.ref = void 0;
    this.fail = void 0;
    this.zfail = void 0;
    this.zpass = void 0;
    this.readMask = void 0;
    this.writeMask = void 0;
    this.func = (_options$func = options.func) != null ? _options$func : FUNC_ALWAYS;
    this.ref = (_options$ref = options.ref) != null ? _options$ref : 0;
    this.readMask = (_options$readMask = options.readMask) != null ? _options$readMask : 0xFF;
    this.writeMask = (_options$writeMask = options.writeMask) != null ? _options$writeMask : 0xFF;
    this.fail = (_options$fail = options.fail) != null ? _options$fail : STENCILOP_KEEP; // keep == 0
    this.zfail = (_options$zfail = options.zfail) != null ? _options$zfail : STENCILOP_KEEP;
    this.zpass = (_options$zpass = options.zpass) != null ? _options$zpass : STENCILOP_KEEP;
  }

  /**
   * Clone the stencil parameters.
   *
   * @returns {StencilParameters} A cloned StencilParameters object.
   */
  clone() {
    return new StencilParameters({
      func: this.func,
      ref: this.ref,
      readMask: this.readMask,
      writeMask: this.writeMask,
      fail: this.fail,
      zfail: this.zfail,
      zpass: this.zpass
    });
  }
}

export { StencilParameters };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlbmNpbC1wYXJhbWV0ZXJzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc2NlbmUvc3RlbmNpbC1wYXJhbWV0ZXJzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEZVTkNfQUxXQVlTLCBTVEVOQ0lMT1BfS0VFUCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogSG9sZHMgc3RlbmNpbCB0ZXN0IHNldHRpbmdzLlxuICovXG5jbGFzcyBTdGVuY2lsUGFyYW1ldGVycyB7XG4gICAgLyoqXG4gICAgICogU2V0cyBzdGVuY2lsIHRlc3QgZnVuY3Rpb24uIFNlZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0U3RlbmNpbEZ1bmN9LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBmdW5jO1xuXG4gICAgLyoqXG4gICAgICogU2V0cyBzdGVuY2lsIHRlc3QgcmVmZXJlbmNlIHZhbHVlLiBTZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxGdW5jfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgcmVmO1xuXG4gICAgLyoqXG4gICAgICogU2V0cyBvcGVyYXRpb24gdG8gcGVyZm9ybSBpZiBzdGVuY2lsIHRlc3QgaXMgZmFpbGVkLiBTZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxPcGVyYXRpb259LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBmYWlsO1xuXG4gICAgLyoqXG4gICAgICogU2V0cyBvcGVyYXRpb24gdG8gcGVyZm9ybSBpZiBkZXB0aCB0ZXN0IGlzIGZhaWxlZC4gU2VlIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRTdGVuY2lsT3BlcmF0aW9ufS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgemZhaWw7XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIG9wZXJhdGlvbiB0byBwZXJmb3JtIGlmIGJvdGggc3RlbmNpbCBhbmQgZGVwdGggdGVzdCBhcmUgcGFzc2VkLiBTZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxPcGVyYXRpb259LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB6cGFzcztcblxuICAgIC8qKlxuICAgICAqIFNldHMgc3RlbmNpbCB0ZXN0IHJlYWRpbmcgbWFzay4gU2VlIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRTdGVuY2lsRnVuY30uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHJlYWRNYXNrO1xuXG4gICAgLyoqXG4gICAgICogU2V0cyBzdGVuY2lsIHRlc3Qgd3JpdGluZyBtYXNrLiBTZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxPcGVyYXRpb259LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICB3cml0ZU1hc2s7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU3RlbmNpbFBhcmFtZXRlcnMgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIE9wdGlvbnMgb2JqZWN0IHRvIGNvbmZpZ3VyZSB0aGUgc3RlbmNpbCBwYXJhbWV0ZXJzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5mdW5jID0gb3B0aW9ucy5mdW5jID8/IEZVTkNfQUxXQVlTO1xuICAgICAgICB0aGlzLnJlZiA9IG9wdGlvbnMucmVmID8/IDA7XG4gICAgICAgIHRoaXMucmVhZE1hc2sgPSBvcHRpb25zLnJlYWRNYXNrID8/IDB4RkY7XG4gICAgICAgIHRoaXMud3JpdGVNYXNrID0gb3B0aW9ucy53cml0ZU1hc2sgPz8gMHhGRjtcblxuICAgICAgICB0aGlzLmZhaWwgPSBvcHRpb25zLmZhaWwgPz8gU1RFTkNJTE9QX0tFRVA7IC8vIGtlZXAgPT0gMFxuICAgICAgICB0aGlzLnpmYWlsID0gb3B0aW9ucy56ZmFpbCA/PyBTVEVOQ0lMT1BfS0VFUDtcbiAgICAgICAgdGhpcy56cGFzcyA9IG9wdGlvbnMuenBhc3MgPz8gU1RFTkNJTE9QX0tFRVA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2xvbmUgdGhlIHN0ZW5jaWwgcGFyYW1ldGVycy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTdGVuY2lsUGFyYW1ldGVyc30gQSBjbG9uZWQgU3RlbmNpbFBhcmFtZXRlcnMgb2JqZWN0LlxuICAgICAqL1xuICAgIGNsb25lKCkge1xuICAgICAgICByZXR1cm4gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKHtcbiAgICAgICAgICAgIGZ1bmM6IHRoaXMuZnVuYyxcbiAgICAgICAgICAgIHJlZjogdGhpcy5yZWYsXG4gICAgICAgICAgICByZWFkTWFzazogdGhpcy5yZWFkTWFzayxcbiAgICAgICAgICAgIHdyaXRlTWFzazogdGhpcy53cml0ZU1hc2ssXG4gICAgICAgICAgICBmYWlsOiB0aGlzLmZhaWwsXG4gICAgICAgICAgICB6ZmFpbDogdGhpcy56ZmFpbCxcbiAgICAgICAgICAgIHpwYXNzOiB0aGlzLnpwYXNzXG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfTtcbiJdLCJuYW1lcyI6WyJTdGVuY2lsUGFyYW1ldGVycyIsImNvbnN0cnVjdG9yIiwib3B0aW9ucyIsIl9vcHRpb25zJGZ1bmMiLCJfb3B0aW9ucyRyZWYiLCJfb3B0aW9ucyRyZWFkTWFzayIsIl9vcHRpb25zJHdyaXRlTWFzayIsIl9vcHRpb25zJGZhaWwiLCJfb3B0aW9ucyR6ZmFpbCIsIl9vcHRpb25zJHpwYXNzIiwiZnVuYyIsInJlZiIsImZhaWwiLCJ6ZmFpbCIsInpwYXNzIiwicmVhZE1hc2siLCJ3cml0ZU1hc2siLCJGVU5DX0FMV0FZUyIsIlNURU5DSUxPUF9L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
