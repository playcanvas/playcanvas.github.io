import { GpuProfiler } from '../gpu-profiler.js';
import { WebgpuQuerySet } from './webgpu-query-set.js';

class WebgpuGpuProfiler extends GpuProfiler {
  constructor(device) {
    super();
    this.device = void 0;
    /** @type {number} */
    this.frameGPUMarkerSlot = void 0;
    this.device = device;

    // gpu timing queries
    this.timestampQueriesSet = device.supportsTimestampQuery ? new WebgpuQuerySet(device, true, 512) : null;
  }
  destroy() {
    var _this$timestampQuerie;
    (_this$timestampQuerie = this.timestampQueriesSet) == null || _this$timestampQuerie.destroy();
    this.timestampQueriesSet = null;
  }
  frameStart() {
    this.processEnableRequest();
  }
  frameEnd() {
    if (this._enabled) {
      var _this$timestampQuerie2;
      // schedule command buffer where timestamps are copied to CPU
      (_this$timestampQuerie2 = this.timestampQueriesSet) == null || _this$timestampQuerie2.resolve(this.slotCount * 2);
    }
  }
  request() {
    if (this._enabled) {
      var _this$timestampQuerie3;
      // request results
      const renderVersion = this.device.renderVersion;
      (_this$timestampQuerie3 = this.timestampQueriesSet) == null || _this$timestampQuerie3.request(this.slotCount, renderVersion).then(results => {
        this.report(results.renderVersion, results.timings);
      });
      super.request(renderVersion);
    }
  }
}

export { WebgpuGpuProfiler };
