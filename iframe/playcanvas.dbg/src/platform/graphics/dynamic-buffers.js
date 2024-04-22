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
