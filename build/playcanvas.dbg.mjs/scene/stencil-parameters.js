/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { FUNC_ALWAYS, STENCILOP_KEEP } from '../platform/graphics/constants.js';

/**
 * Holds stencil test settings.
 *
 * @property {number} func Sets stencil test function. See {@link GraphicsDevice#setStencilFunc}.
 * @property {number} ref Sets stencil test reference value. See
 * {@link GraphicsDevice#setStencilFunc}.
 * @property {number} fail Sets operation to perform if stencil test is failed. See
 * {@link GraphicsDevice#setStencilOperation}.
 * @property {number} zfail Sets operation to perform if depth test is failed. See
 * {@link GraphicsDevice#setStencilOperation}.
 * @property {number} zpass Sets operation to perform if both stencil and depth test are passed.
 * See {@link GraphicsDevice#setStencilOperation}.
 * @property {number} readMask Sets stencil test reading mask. See
 * {@link GraphicsDevice#setStencilFunc}.
 * @property {number} writeMask Sets stencil test writing mask. See
 * {@link GraphicsDevice#setStencilOperation}.
 */
class StencilParameters {
  /**
   * Create a new StencilParameters instance.
   *
   * @param {object} options - Options object to configure the stencil parameters.
   */
  constructor(options) {
    this.func = options.func === undefined ? FUNC_ALWAYS : options.func;
    this.ref = options.ref || 0;
    this.readMask = options.readMask === undefined ? 0xFF : options.readMask;
    this.writeMask = options.writeMask === undefined ? 0xFF : options.writeMask;
    this.fail = options.fail || STENCILOP_KEEP; // keep == 0
    this.zfail = options.zfail || STENCILOP_KEEP;
    this.zpass = options.zpass || STENCILOP_KEEP;
  }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RlbmNpbC1wYXJhbWV0ZXJzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc2NlbmUvc3RlbmNpbC1wYXJhbWV0ZXJzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEZVTkNfQUxXQVlTLCBTVEVOQ0lMT1BfS0VFUCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbi8qKlxuICogSG9sZHMgc3RlbmNpbCB0ZXN0IHNldHRpbmdzLlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmdW5jIFNldHMgc3RlbmNpbCB0ZXN0IGZ1bmN0aW9uLiBTZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxGdW5jfS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWYgU2V0cyBzdGVuY2lsIHRlc3QgcmVmZXJlbmNlIHZhbHVlLiBTZWVcbiAqIHtAbGluayBHcmFwaGljc0RldmljZSNzZXRTdGVuY2lsRnVuY30uXG4gKiBAcHJvcGVydHkge251bWJlcn0gZmFpbCBTZXRzIG9wZXJhdGlvbiB0byBwZXJmb3JtIGlmIHN0ZW5jaWwgdGVzdCBpcyBmYWlsZWQuIFNlZVxuICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxPcGVyYXRpb259LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHpmYWlsIFNldHMgb3BlcmF0aW9uIHRvIHBlcmZvcm0gaWYgZGVwdGggdGVzdCBpcyBmYWlsZWQuIFNlZVxuICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxPcGVyYXRpb259LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHpwYXNzIFNldHMgb3BlcmF0aW9uIHRvIHBlcmZvcm0gaWYgYm90aCBzdGVuY2lsIGFuZCBkZXB0aCB0ZXN0IGFyZSBwYXNzZWQuXG4gKiBTZWUge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxPcGVyYXRpb259LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHJlYWRNYXNrIFNldHMgc3RlbmNpbCB0ZXN0IHJlYWRpbmcgbWFzay4gU2VlXG4gKiB7QGxpbmsgR3JhcGhpY3NEZXZpY2Ujc2V0U3RlbmNpbEZ1bmN9LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHdyaXRlTWFzayBTZXRzIHN0ZW5jaWwgdGVzdCB3cml0aW5nIG1hc2suIFNlZVxuICoge0BsaW5rIEdyYXBoaWNzRGV2aWNlI3NldFN0ZW5jaWxPcGVyYXRpb259LlxuICovXG5jbGFzcyBTdGVuY2lsUGFyYW1ldGVycyB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBPcHRpb25zIG9iamVjdCB0byBjb25maWd1cmUgdGhlIHN0ZW5jaWwgcGFyYW1ldGVycy5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuZnVuYyA9IG9wdGlvbnMuZnVuYyA9PT0gdW5kZWZpbmVkID8gRlVOQ19BTFdBWVMgOiBvcHRpb25zLmZ1bmM7XG4gICAgICAgIHRoaXMucmVmID0gb3B0aW9ucy5yZWYgfHwgMDtcbiAgICAgICAgdGhpcy5yZWFkTWFzayA9IG9wdGlvbnMucmVhZE1hc2sgPT09IHVuZGVmaW5lZCA/IDB4RkYgOiBvcHRpb25zLnJlYWRNYXNrO1xuICAgICAgICB0aGlzLndyaXRlTWFzayA9IG9wdGlvbnMud3JpdGVNYXNrID09PSB1bmRlZmluZWQgPyAweEZGIDogb3B0aW9ucy53cml0ZU1hc2s7XG5cbiAgICAgICAgdGhpcy5mYWlsID0gb3B0aW9ucy5mYWlsIHx8IFNURU5DSUxPUF9LRUVQOyAvLyBrZWVwID09IDBcbiAgICAgICAgdGhpcy56ZmFpbCA9IG9wdGlvbnMuemZhaWwgfHwgU1RFTkNJTE9QX0tFRVA7XG4gICAgICAgIHRoaXMuenBhc3MgPSBvcHRpb25zLnpwYXNzIHx8IFNURU5DSUxPUF9LRUVQO1xuICAgIH1cblxuICAgIGNsb25lKCkge1xuICAgICAgICByZXR1cm4gbmV3IFN0ZW5jaWxQYXJhbWV0ZXJzKHtcbiAgICAgICAgICAgIGZ1bmM6IHRoaXMuZnVuYyxcbiAgICAgICAgICAgIHJlZjogdGhpcy5yZWYsXG4gICAgICAgICAgICByZWFkTWFzazogdGhpcy5yZWFkTWFzayxcbiAgICAgICAgICAgIHdyaXRlTWFzazogdGhpcy53cml0ZU1hc2ssXG4gICAgICAgICAgICBmYWlsOiB0aGlzLmZhaWwsXG4gICAgICAgICAgICB6ZmFpbDogdGhpcy56ZmFpbCxcbiAgICAgICAgICAgIHpwYXNzOiB0aGlzLnpwYXNzXG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU3RlbmNpbFBhcmFtZXRlcnMgfTtcbiJdLCJuYW1lcyI6WyJTdGVuY2lsUGFyYW1ldGVycyIsImNvbnN0cnVjdG9yIiwib3B0aW9ucyIsImZ1bmMiLCJ1bmRlZmluZWQiLCJGVU5DX0FMV0FZUyIsInJlZiIsInJlYWRNYXNrIiwid3JpdGVNYXNrIiwiZmFpbCIsIlNURU5DSUxPUF9LRUVQIiwiemZhaWwiLCJ6cGFzcyIsImNsb25lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLGlCQUFpQixDQUFDO0FBQ3BCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBVyxDQUFDQyxPQUFPLEVBQUU7QUFDakIsSUFBQSxJQUFJLENBQUNDLElBQUksR0FBR0QsT0FBTyxDQUFDQyxJQUFJLEtBQUtDLFNBQVMsR0FBR0MsV0FBVyxHQUFHSCxPQUFPLENBQUNDLElBQUksQ0FBQTtBQUNuRSxJQUFBLElBQUksQ0FBQ0csR0FBRyxHQUFHSixPQUFPLENBQUNJLEdBQUcsSUFBSSxDQUFDLENBQUE7QUFDM0IsSUFBQSxJQUFJLENBQUNDLFFBQVEsR0FBR0wsT0FBTyxDQUFDSyxRQUFRLEtBQUtILFNBQVMsR0FBRyxJQUFJLEdBQUdGLE9BQU8sQ0FBQ0ssUUFBUSxDQUFBO0FBQ3hFLElBQUEsSUFBSSxDQUFDQyxTQUFTLEdBQUdOLE9BQU8sQ0FBQ00sU0FBUyxLQUFLSixTQUFTLEdBQUcsSUFBSSxHQUFHRixPQUFPLENBQUNNLFNBQVMsQ0FBQTtJQUUzRSxJQUFJLENBQUNDLElBQUksR0FBR1AsT0FBTyxDQUFDTyxJQUFJLElBQUlDLGNBQWMsQ0FBQztBQUMzQyxJQUFBLElBQUksQ0FBQ0MsS0FBSyxHQUFHVCxPQUFPLENBQUNTLEtBQUssSUFBSUQsY0FBYyxDQUFBO0FBQzVDLElBQUEsSUFBSSxDQUFDRSxLQUFLLEdBQUdWLE9BQU8sQ0FBQ1UsS0FBSyxJQUFJRixjQUFjLENBQUE7QUFDaEQsR0FBQTtBQUVBRyxFQUFBQSxLQUFLLEdBQUc7SUFDSixPQUFPLElBQUliLGlCQUFpQixDQUFDO01BQ3pCRyxJQUFJLEVBQUUsSUFBSSxDQUFDQSxJQUFJO01BQ2ZHLEdBQUcsRUFBRSxJQUFJLENBQUNBLEdBQUc7TUFDYkMsUUFBUSxFQUFFLElBQUksQ0FBQ0EsUUFBUTtNQUN2QkMsU0FBUyxFQUFFLElBQUksQ0FBQ0EsU0FBUztNQUN6QkMsSUFBSSxFQUFFLElBQUksQ0FBQ0EsSUFBSTtNQUNmRSxLQUFLLEVBQUUsSUFBSSxDQUFDQSxLQUFLO01BQ2pCQyxLQUFLLEVBQUUsSUFBSSxDQUFDQSxLQUFBQTtBQUNoQixLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7QUFDSjs7OzsifQ==
