import { TRACEID_GPU_TIMINGS } from '../../core/constants.js';
import { Tracing } from '../../core/tracing.js';

class GpuProfiler {
  constructor() {
    this.frameAllocations = [];
    this.pastFrameAllocations = new Map();
    this._enabled = false;
    this._enableRequest = false;
    this._frameTime = 0;
  }
  loseContext() {
    this.pastFrameAllocations.clear();
  }
  set enabled(value) {
    this._enableRequest = value;
  }
  get enabled() {
    return this._enableRequest;
  }
  processEnableRequest() {
    if (this._enableRequest !== this._enabled) {
      this._enabled = this._enableRequest;
      if (!this._enabled) {
        this._frameTime = 0;
      }
    }
  }
  request(renderVersion) {
    this.pastFrameAllocations.set(renderVersion, this.frameAllocations);
    this.frameAllocations = [];
  }
  report(renderVersion, timings) {
    if (timings) {
      const allocations = this.pastFrameAllocations.get(renderVersion);
      if (timings.length > 0) {
        this._frameTime = timings[0];
      }
      if (Tracing.get(TRACEID_GPU_TIMINGS)) {
        for (let i = 0; i < allocations.length; ++i) {
          allocations[i];
        }
      }
    }
    this.pastFrameAllocations.delete(renderVersion);
  }
  getSlot(name) {
    const slot = this.frameAllocations.length;
    this.frameAllocations.push(name);
    return slot;
  }
  get slotCount() {
    return this.frameAllocations.length;
  }
}

export { GpuProfiler };
