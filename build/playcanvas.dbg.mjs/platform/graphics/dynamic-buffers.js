import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';

/**
 * A base class representing a single per platform buffer.
 *
 * @ignore
 */
class DynamicBuffer {
  constructor(device) {
    /** @type {import('./graphics-device.js').GraphicsDevice} */
    this.device = void 0;
    this.device = device;
  }
}

/**
 * A container for storing the used areas of a pair of staging and gpu buffers.
 *
 * @ignore
 */
class UsedBuffer {
  constructor() {
    /** @type {DynamicBuffer} */
    this.gpuBuffer = void 0;
    /** @type {DynamicBuffer} */
    this.stagingBuffer = void 0;
    /**
     * The beginning position of the used area that needs to be copied from staging to to the GPU
     * buffer.
     *
     * @type {number}
     */
    this.offset = void 0;
    /**
     * Used byte size of the buffer, from the offset.
     *
     * @type {number}
     */
    this.size = void 0;
  }
}

/**
 * A container for storing the return values of an allocation function.
 *
 * @ignore
 */
class DynamicBufferAllocation {
  constructor() {
    /**
     * The storage access to the allocated data in the staging buffer.
     *
     * @type {Int32Array}
     */
    this.storage = void 0;
    /**
     * The gpu buffer this allocation will be copied to.
     *
     * @type {DynamicBuffer}
     */
    this.gpuBuffer = void 0;
    /**
     * Offset in the gpuBuffer where the data will be copied to.
     *
     * @type {number}
     */
    this.offset = void 0;
  }
}

/**
 * The DynamicBuffers class provides a dynamic memory allocation system for uniform buffer data,
 * particularly for non-persistent uniform buffers. This class utilizes a bump allocator to
 * efficiently allocate aligned memory space from a set of large buffers managed internally. To
 * utilize this system, the user writes data to CPU-accessible staging buffers. When submitting
 * command buffers that require these buffers, the system automatically uploads the data to the GPU
 * buffers. This approach ensures efficient memory management and smooth data transfer between the
 * CPU and GPU.
 *
 * @ignore
 */
class DynamicBuffers {
  /**
   * Create the system of dynamic buffers.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} device - The graphics device.
   * @param {number} bufferSize - The size of the underlying large buffers.
   * @param {number} bufferAlignment - Alignment of each allocation.
   */
  constructor(device, bufferSize, bufferAlignment) {
    /**
     * Allocation size of the underlying buffers.
     *
     * @type {number}
     */
    this.bufferSize = void 0;
    /**
     * Internally allocated gpu buffers.
     *
     * @type {DynamicBuffer[]}
     */
    this.gpuBuffers = [];
    /**
     * Internally allocated staging buffers (CPU writable)
     *
     * @type {DynamicBuffer[]}
     */
    this.stagingBuffers = [];
    /**
     * @type {UsedBuffer[]}
     */
    this.usedBuffers = [];
    /**
     * @type {UsedBuffer}
     */
    this.activeBuffer = null;
    this.device = device;
    this.bufferSize = bufferSize;
    this.bufferAlignment = bufferAlignment;
  }

  /**
   * Destroy the system of dynamic buffers.
   */
  destroy() {
    this.gpuBuffers.forEach(gpuBuffer => {
      gpuBuffer.destroy(this.device);
    });
    this.gpuBuffers = null;
    this.stagingBuffers.forEach(stagingBuffer => {
      stagingBuffer.destroy(this.device);
    });
    this.stagingBuffers = null;
    this.usedBuffers = null;
    this.activeBuffer = null;
  }

  /**
   * Allocate an aligned space of the given size from a dynamic buffer.
   *
   * @param {DynamicBufferAllocation} allocation - The allocation info to fill.
   * @param {number} size - The size of the allocation.
   */
  alloc(allocation, size) {
    // if we have active buffer without enough space
    if (this.activeBuffer) {
      const _alignedStart = math.roundUp(this.activeBuffer.size, this.bufferAlignment);
      const space = this.bufferSize - _alignedStart;
      if (space < size) {
        // we're done with this buffer, schedule it for submit
        this.scheduleSubmit();
      }
    }

    // if we don't have an active buffer, allocate new one
    if (!this.activeBuffer) {
      // gpu buffer
      let gpuBuffer = this.gpuBuffers.pop();
      if (!gpuBuffer) {
        gpuBuffer = this.createBuffer(this.device, this.bufferSize, false);
      }

      // staging buffer
      let stagingBuffer = this.stagingBuffers.pop();
      if (!stagingBuffer) {
        stagingBuffer = this.createBuffer(this.device, this.bufferSize, true);
      }
      this.activeBuffer = new UsedBuffer();
      this.activeBuffer.stagingBuffer = stagingBuffer;
      this.activeBuffer.gpuBuffer = gpuBuffer;
      this.activeBuffer.offset = 0;
      this.activeBuffer.size = 0;
    }

    // allocate from active buffer
    const activeBuffer = this.activeBuffer;
    const alignedStart = math.roundUp(activeBuffer.size, this.bufferAlignment);
    Debug.assert(alignedStart + size <= this.bufferSize, `The allocation size of ${size} is larger than the buffer size of ${this.bufferSize}`);
    allocation.gpuBuffer = activeBuffer.gpuBuffer;
    allocation.offset = alignedStart;
    allocation.storage = activeBuffer.stagingBuffer.alloc(alignedStart, size);

    // take the allocation from the buffer
    activeBuffer.size = alignedStart + size;
  }
  scheduleSubmit() {
    if (this.activeBuffer) {
      this.usedBuffers.push(this.activeBuffer);
      this.activeBuffer = null;
    }
  }
  submit() {
    // schedule currently active buffer for submit
    this.scheduleSubmit();
  }
}

export { DynamicBuffer, DynamicBufferAllocation, DynamicBuffers };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1pYy1idWZmZXJzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvZHluYW1pYy1idWZmZXJzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG4vKipcbiAqIEEgYmFzZSBjbGFzcyByZXByZXNlbnRpbmcgYSBzaW5nbGUgcGVyIHBsYXRmb3JtIGJ1ZmZlci5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIER5bmFtaWNCdWZmZXIge1xuICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSAqL1xuICAgIGRldmljZTtcblxuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICB9XG59XG5cbi8qKlxuICogQSBjb250YWluZXIgZm9yIHN0b3JpbmcgdGhlIHVzZWQgYXJlYXMgb2YgYSBwYWlyIG9mIHN0YWdpbmcgYW5kIGdwdSBidWZmZXJzLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgVXNlZEJ1ZmZlciB7XG4gICAgLyoqIEB0eXBlIHtEeW5hbWljQnVmZmVyfSAqL1xuICAgIGdwdUJ1ZmZlcjtcblxuICAgIC8qKiBAdHlwZSB7RHluYW1pY0J1ZmZlcn0gKi9cbiAgICBzdGFnaW5nQnVmZmVyO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGJlZ2lubmluZyBwb3NpdGlvbiBvZiB0aGUgdXNlZCBhcmVhIHRoYXQgbmVlZHMgdG8gYmUgY29waWVkIGZyb20gc3RhZ2luZyB0byB0byB0aGUgR1BVXG4gICAgICogYnVmZmVyLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBvZmZzZXQ7XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIGJ5dGUgc2l6ZSBvZiB0aGUgYnVmZmVyLCBmcm9tIHRoZSBvZmZzZXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNpemU7XG59XG5cbi8qKlxuICogQSBjb250YWluZXIgZm9yIHN0b3JpbmcgdGhlIHJldHVybiB2YWx1ZXMgb2YgYW4gYWxsb2NhdGlvbiBmdW5jdGlvbi5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIER5bmFtaWNCdWZmZXJBbGxvY2F0aW9uIHtcbiAgICAvKipcbiAgICAgKiBUaGUgc3RvcmFnZSBhY2Nlc3MgdG8gdGhlIGFsbG9jYXRlZCBkYXRhIGluIHRoZSBzdGFnaW5nIGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtJbnQzMkFycmF5fVxuICAgICAqL1xuICAgIHN0b3JhZ2U7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZ3B1IGJ1ZmZlciB0aGlzIGFsbG9jYXRpb24gd2lsbCBiZSBjb3BpZWQgdG8uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RHluYW1pY0J1ZmZlcn1cbiAgICAgKi9cbiAgICBncHVCdWZmZXI7XG5cbiAgICAvKipcbiAgICAgKiBPZmZzZXQgaW4gdGhlIGdwdUJ1ZmZlciB3aGVyZSB0aGUgZGF0YSB3aWxsIGJlIGNvcGllZCB0by5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgb2Zmc2V0O1xufVxuXG4vKipcbiAqIFRoZSBEeW5hbWljQnVmZmVycyBjbGFzcyBwcm92aWRlcyBhIGR5bmFtaWMgbWVtb3J5IGFsbG9jYXRpb24gc3lzdGVtIGZvciB1bmlmb3JtIGJ1ZmZlciBkYXRhLFxuICogcGFydGljdWxhcmx5IGZvciBub24tcGVyc2lzdGVudCB1bmlmb3JtIGJ1ZmZlcnMuIFRoaXMgY2xhc3MgdXRpbGl6ZXMgYSBidW1wIGFsbG9jYXRvciB0b1xuICogZWZmaWNpZW50bHkgYWxsb2NhdGUgYWxpZ25lZCBtZW1vcnkgc3BhY2UgZnJvbSBhIHNldCBvZiBsYXJnZSBidWZmZXJzIG1hbmFnZWQgaW50ZXJuYWxseS4gVG9cbiAqIHV0aWxpemUgdGhpcyBzeXN0ZW0sIHRoZSB1c2VyIHdyaXRlcyBkYXRhIHRvIENQVS1hY2Nlc3NpYmxlIHN0YWdpbmcgYnVmZmVycy4gV2hlbiBzdWJtaXR0aW5nXG4gKiBjb21tYW5kIGJ1ZmZlcnMgdGhhdCByZXF1aXJlIHRoZXNlIGJ1ZmZlcnMsIHRoZSBzeXN0ZW0gYXV0b21hdGljYWxseSB1cGxvYWRzIHRoZSBkYXRhIHRvIHRoZSBHUFVcbiAqIGJ1ZmZlcnMuIFRoaXMgYXBwcm9hY2ggZW5zdXJlcyBlZmZpY2llbnQgbWVtb3J5IG1hbmFnZW1lbnQgYW5kIHNtb290aCBkYXRhIHRyYW5zZmVyIGJldHdlZW4gdGhlXG4gKiBDUFUgYW5kIEdQVS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIER5bmFtaWNCdWZmZXJzIHtcbiAgICAvKipcbiAgICAgKiBBbGxvY2F0aW9uIHNpemUgb2YgdGhlIHVuZGVybHlpbmcgYnVmZmVycy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgYnVmZmVyU2l6ZTtcblxuICAgIC8qKlxuICAgICAqIEludGVybmFsbHkgYWxsb2NhdGVkIGdwdSBidWZmZXJzLlxuICAgICAqXG4gICAgICogQHR5cGUge0R5bmFtaWNCdWZmZXJbXX1cbiAgICAgKi9cbiAgICBncHVCdWZmZXJzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBJbnRlcm5hbGx5IGFsbG9jYXRlZCBzdGFnaW5nIGJ1ZmZlcnMgKENQVSB3cml0YWJsZSlcbiAgICAgKlxuICAgICAqIEB0eXBlIHtEeW5hbWljQnVmZmVyW119XG4gICAgICovXG4gICAgc3RhZ2luZ0J1ZmZlcnMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtVc2VkQnVmZmVyW119XG4gICAgICovXG4gICAgdXNlZEJ1ZmZlcnMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtVc2VkQnVmZmVyfVxuICAgICAqL1xuICAgIGFjdGl2ZUJ1ZmZlciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgdGhlIHN5c3RlbSBvZiBkeW5hbWljIGJ1ZmZlcnMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYnVmZmVyU2l6ZSAtIFRoZSBzaXplIG9mIHRoZSB1bmRlcmx5aW5nIGxhcmdlIGJ1ZmZlcnMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1ZmZlckFsaWdubWVudCAtIEFsaWdubWVudCBvZiBlYWNoIGFsbG9jYXRpb24uXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBidWZmZXJTaXplLCBidWZmZXJBbGlnbm1lbnQpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIHRoaXMuYnVmZmVyU2l6ZSA9IGJ1ZmZlclNpemU7XG4gICAgICAgIHRoaXMuYnVmZmVyQWxpZ25tZW50ID0gYnVmZmVyQWxpZ25tZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIHN5c3RlbSBvZiBkeW5hbWljIGJ1ZmZlcnMuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICB0aGlzLmdwdUJ1ZmZlcnMuZm9yRWFjaCgoZ3B1QnVmZmVyKSA9PiB7XG4gICAgICAgICAgICBncHVCdWZmZXIuZGVzdHJveSh0aGlzLmRldmljZSk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmdwdUJ1ZmZlcnMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc3RhZ2luZ0J1ZmZlcnMuZm9yRWFjaCgoc3RhZ2luZ0J1ZmZlcikgPT4ge1xuICAgICAgICAgICAgc3RhZ2luZ0J1ZmZlci5kZXN0cm95KHRoaXMuZGV2aWNlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuc3RhZ2luZ0J1ZmZlcnMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudXNlZEJ1ZmZlcnMgPSBudWxsO1xuICAgICAgICB0aGlzLmFjdGl2ZUJ1ZmZlciA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWxsb2NhdGUgYW4gYWxpZ25lZCBzcGFjZSBvZiB0aGUgZ2l2ZW4gc2l6ZSBmcm9tIGEgZHluYW1pYyBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0R5bmFtaWNCdWZmZXJBbGxvY2F0aW9ufSBhbGxvY2F0aW9uIC0gVGhlIGFsbG9jYXRpb24gaW5mbyB0byBmaWxsLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzaXplIC0gVGhlIHNpemUgb2YgdGhlIGFsbG9jYXRpb24uXG4gICAgICovXG4gICAgYWxsb2MoYWxsb2NhdGlvbiwgc2l6ZSkge1xuXG4gICAgICAgIC8vIGlmIHdlIGhhdmUgYWN0aXZlIGJ1ZmZlciB3aXRob3V0IGVub3VnaCBzcGFjZVxuICAgICAgICBpZiAodGhpcy5hY3RpdmVCdWZmZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGFsaWduZWRTdGFydCA9IG1hdGgucm91bmRVcCh0aGlzLmFjdGl2ZUJ1ZmZlci5zaXplLCB0aGlzLmJ1ZmZlckFsaWdubWVudCk7XG4gICAgICAgICAgICBjb25zdCBzcGFjZSA9IHRoaXMuYnVmZmVyU2l6ZSAtIGFsaWduZWRTdGFydDtcbiAgICAgICAgICAgIGlmIChzcGFjZSA8IHNpemUpIHtcblxuICAgICAgICAgICAgICAgIC8vIHdlJ3JlIGRvbmUgd2l0aCB0aGlzIGJ1ZmZlciwgc2NoZWR1bGUgaXQgZm9yIHN1Ym1pdFxuICAgICAgICAgICAgICAgIHRoaXMuc2NoZWR1bGVTdWJtaXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHdlIGRvbid0IGhhdmUgYW4gYWN0aXZlIGJ1ZmZlciwgYWxsb2NhdGUgbmV3IG9uZVxuICAgICAgICBpZiAoIXRoaXMuYWN0aXZlQnVmZmVyKSB7XG5cbiAgICAgICAgICAgIC8vIGdwdSBidWZmZXJcbiAgICAgICAgICAgIGxldCBncHVCdWZmZXIgPSB0aGlzLmdwdUJ1ZmZlcnMucG9wKCk7XG4gICAgICAgICAgICBpZiAoIWdwdUJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIGdwdUJ1ZmZlciA9IHRoaXMuY3JlYXRlQnVmZmVyKHRoaXMuZGV2aWNlLCB0aGlzLmJ1ZmZlclNpemUsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3RhZ2luZyBidWZmZXJcbiAgICAgICAgICAgIGxldCBzdGFnaW5nQnVmZmVyID0gdGhpcy5zdGFnaW5nQnVmZmVycy5wb3AoKTtcbiAgICAgICAgICAgIGlmICghc3RhZ2luZ0J1ZmZlcikge1xuICAgICAgICAgICAgICAgIHN0YWdpbmdCdWZmZXIgPSB0aGlzLmNyZWF0ZUJ1ZmZlcih0aGlzLmRldmljZSwgdGhpcy5idWZmZXJTaXplLCB0cnVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5hY3RpdmVCdWZmZXIgPSBuZXcgVXNlZEJ1ZmZlcigpO1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVCdWZmZXIuc3RhZ2luZ0J1ZmZlciA9IHN0YWdpbmdCdWZmZXI7XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZUJ1ZmZlci5ncHVCdWZmZXIgPSBncHVCdWZmZXI7XG4gICAgICAgICAgICB0aGlzLmFjdGl2ZUJ1ZmZlci5vZmZzZXQgPSAwO1xuICAgICAgICAgICAgdGhpcy5hY3RpdmVCdWZmZXIuc2l6ZSA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhbGxvY2F0ZSBmcm9tIGFjdGl2ZSBidWZmZXJcbiAgICAgICAgY29uc3QgYWN0aXZlQnVmZmVyID0gdGhpcy5hY3RpdmVCdWZmZXI7XG4gICAgICAgIGNvbnN0IGFsaWduZWRTdGFydCA9IG1hdGgucm91bmRVcChhY3RpdmVCdWZmZXIuc2l6ZSwgdGhpcy5idWZmZXJBbGlnbm1lbnQpO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoYWxpZ25lZFN0YXJ0ICsgc2l6ZSA8PSB0aGlzLmJ1ZmZlclNpemUsIGBUaGUgYWxsb2NhdGlvbiBzaXplIG9mICR7c2l6ZX0gaXMgbGFyZ2VyIHRoYW4gdGhlIGJ1ZmZlciBzaXplIG9mICR7dGhpcy5idWZmZXJTaXplfWApO1xuXG4gICAgICAgIGFsbG9jYXRpb24uZ3B1QnVmZmVyID0gYWN0aXZlQnVmZmVyLmdwdUJ1ZmZlcjtcbiAgICAgICAgYWxsb2NhdGlvbi5vZmZzZXQgPSBhbGlnbmVkU3RhcnQ7XG4gICAgICAgIGFsbG9jYXRpb24uc3RvcmFnZSA9IGFjdGl2ZUJ1ZmZlci5zdGFnaW5nQnVmZmVyLmFsbG9jKGFsaWduZWRTdGFydCwgc2l6ZSk7XG5cbiAgICAgICAgLy8gdGFrZSB0aGUgYWxsb2NhdGlvbiBmcm9tIHRoZSBidWZmZXJcbiAgICAgICAgYWN0aXZlQnVmZmVyLnNpemUgPSBhbGlnbmVkU3RhcnQgKyBzaXplO1xuICAgIH1cblxuICAgIHNjaGVkdWxlU3VibWl0KCkge1xuXG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZUJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy51c2VkQnVmZmVycy5wdXNoKHRoaXMuYWN0aXZlQnVmZmVyKTtcbiAgICAgICAgICAgIHRoaXMuYWN0aXZlQnVmZmVyID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN1Ym1pdCgpIHtcblxuICAgICAgICAvLyBzY2hlZHVsZSBjdXJyZW50bHkgYWN0aXZlIGJ1ZmZlciBmb3Igc3VibWl0XG4gICAgICAgIHRoaXMuc2NoZWR1bGVTdWJtaXQoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IER5bmFtaWNCdWZmZXIsIER5bmFtaWNCdWZmZXJzLCBEeW5hbWljQnVmZmVyQWxsb2NhdGlvbiB9O1xuIl0sIm5hbWVzIjpbIkR5bmFtaWNCdWZmZXIiLCJjb25zdHJ1Y3RvciIsImRldmljZSIsIlVzZWRCdWZmZXIiLCJncHVCdWZmZXIiLCJzdGFnaW5nQnVmZmVyIiwib2Zmc2V0Iiwic2l6ZSIsIkR5bmFtaWNCdWZmZXJBbGxvY2F0aW9uIiwic3RvcmFnZSIsIkR5bmFtaWNCdWZmZXJzIiwiYnVmZmVyU2l6ZSIsImJ1ZmZlckFsaWdubWVudCIsImdwdUJ1ZmZlcnMiLCJzdGFnaW5nQnVmZmVycyIsInVzZWRCdWZmZXJzIiwiYWN0aXZlQnVmZmVyIiwiZGVzdHJveSIsImZvckVhY2giLCJhbGxvYyIsImFsbG9jYXRpb24iLCJhbGlnbmVkU3RhcnQiLCJtYXRoIiwicm91bmRVcCIsInNwYWNlIiwic2NoZWR1bGVTdWJtaXQiLCJwb3AiLCJjcmVhdGVCdWZmZXIiLCJEZWJ1ZyIsImFzc2VydCIsInB1c2giLCJzdWJtaXQiXSwibWFwcGluZ3MiOiI7OztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxhQUFhLENBQUM7RUFJaEJDLFdBQVdBLENBQUNDLE1BQU0sRUFBRTtBQUhwQjtBQUFBLElBQUEsSUFBQSxDQUNBQSxNQUFNLEdBQUEsS0FBQSxDQUFBLENBQUE7SUFHRixJQUFJLENBQUNBLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0FBQ3hCLEdBQUE7QUFDSixDQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxVQUFVLENBQUM7RUFBQUYsV0FBQSxHQUFBO0FBQ2I7QUFBQSxJQUFBLElBQUEsQ0FDQUcsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRVQ7QUFBQSxJQUFBLElBQUEsQ0FDQUMsYUFBYSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRWI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBTEksSUFBQSxJQUFBLENBTUFDLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtBQUVOO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsSUFBSSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsR0FBQTtBQUNSLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLHVCQUF1QixDQUFDO0VBQUFQLFdBQUEsR0FBQTtBQUMxQjtBQUNK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
