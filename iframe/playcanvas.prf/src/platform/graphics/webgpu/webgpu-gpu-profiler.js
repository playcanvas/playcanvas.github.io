import { GpuProfiler } from '../gpu-profiler.js';
import { WebgpuQuerySet } from './webgpu-query-set.js';

class WebgpuGpuProfiler extends GpuProfiler {
  constructor(device) {
    super();
    this.device = void 0;
    this.frameGPUMarkerSlot = void 0;
    this.device = device;
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
      (_this$timestampQuerie2 = this.timestampQueriesSet) == null || _this$timestampQuerie2.resolve(this.slotCount * 2);
    }
  }
  request() {
    if (this._enabled) {
      var _this$timestampQuerie3;
      const renderVersion = this.device.renderVersion;
      (_this$timestampQuerie3 = this.timestampQueriesSet) == null || _this$timestampQuerie3.request(this.slotCount, renderVersion).then(results => {
        this.report(results.renderVersion, results.timings);
      });
      super.request(renderVersion);
    }
  }
}

export { WebgpuGpuProfiler };
