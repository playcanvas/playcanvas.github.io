/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Color } from '../math/color.js';
import { DebugGraphics } from './debug-graphics.js';

class ColorAttachmentOps {
  constructor() {
    this.clearValue = new Color(0, 0, 0, 1);
    this.clear = false;
    this.store = false;
    this.resolve = true;
    this.mipmaps = false;
  }

}

class DepthStencilAttachmentOps {
  constructor() {
    this.clearDepthValue = 1;
    this.clearStencilValue = 0;
    this.clearDepth = false;
    this.clearStencil = false;
    this.storeDepth = false;
    this.storeStencil = false;
  }

}

class RenderPass {
  constructor(graphicsDevice, execute) {
    this.name = void 0;
    this.renderTarget = void 0;
    this.samples = 0;
    this.colorOps = void 0;
    this.depthStencilOps = void 0;
    this.requiresCubemaps = true;
    this.fullSizeClearRect = true;
    this.device = graphicsDevice;
    this.execute = execute;
  }

  init(renderTarget) {
    var _this$renderTarget, _this$renderTarget$co;

    this.renderTarget = renderTarget || null;
    this.colorOps = new ColorAttachmentOps();
    this.depthStencilOps = new DepthStencilAttachmentOps();
    this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);

    if (this.samples === 1) {
      this.colorOps.store = true;
      this.colorOps.resolve = false;
    }

    if ((_this$renderTarget = this.renderTarget) != null && (_this$renderTarget$co = _this$renderTarget.colorBuffer) != null && _this$renderTarget$co.mipmaps) {
      this.colorOps.mipmaps = true;
    }
  }

  setClearColor(color) {
    this.colorOps.clearValue.copy(color);
    this.colorOps.clear = true;
  }

  setClearDepth(depthValue) {
    this.depthStencilOps.clearDepthValue = depthValue;
    this.depthStencilOps.clearDepth = true;
  }

  setClearStencil(stencilValue) {
    this.depthStencilOps.clearStencilValue = stencilValue;
    this.depthStencilOps.clearStencil = true;
  }

  render() {
    const device = this.device;
    const realPass = this.renderTarget !== undefined;
    DebugGraphics.pushGpuMarker(device, `Pass:${this.name}`);

    if (realPass) {
      device.startPass(this);
    }

    this.execute();

    if (realPass) {
      device.endPass(this);
    }

    DebugGraphics.popGpuMarker(device);
  }

}

export { ColorAttachmentOps, DepthStencilAttachmentOps, RenderPass };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhc3MuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9ncmFwaGljcy9yZW5kZXItcGFzcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IFJlbmRlclRhcmdldCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBHcmFwaGljc0RldmljZSAqL1xuXG5jbGFzcyBDb2xvckF0dGFjaG1lbnRPcHMge1xuICAgIC8qKlxuICAgICAqIEEgY29sb3IgdXNlZCB0byBjbGVhciB0aGUgY29sb3IgYXR0YWNobWVudCB3aGVuIHRoZSBjbGVhciBpcyBlbmFibGVkLlxuICAgICAqL1xuICAgIGNsZWFyVmFsdWUgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMSk7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBhdHRhY2htZW50IHNob3VsZCBiZSBjbGVhcmVkIGJlZm9yZSByZW5kZXJpbmcsIGZhbHNlIHRvIHByZXNlcnZlXG4gICAgICogdGhlIGV4aXN0aW5nIGNvbnRlbnQuXG4gICAgICovXG4gICAgY2xlYXIgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGF0dGFjaG1lbnQgbmVlZHMgdG8gYmUgc3RvcmVkIGFmdGVyIHRoZSByZW5kZXIgcGFzcy4gRmFsc2VcbiAgICAgKiBpZiBpdCBjYW4gYmUgZGlzY2FyZGVkLlxuICAgICAqIE5vdGU6IFRoaXMgcmVsYXRlcyB0byB0aGUgc3VyZmFjZSB0aGF0IGlzIGdldHRpbmcgcmVuZGVyZWQgdG8sIGFuZCBjYW4gYmUgZWl0aGVyXG4gICAgICogc2luZ2xlIG9yIG11bHRpLXNhbXBsZWQuIEZ1cnRoZXIsIGlmIGEgbXVsdGktc2FtcGxlZCBzdXJmYWNlIGlzIHVzZWQsIHRoZSByZXNvbHZlXG4gICAgICogZmxhZyBmdXJ0aGVyIHNwZWNpZmllcyBpZiB0aGlzIGdldHMgcmVzb2x2ZWQgdG8gYSBzaW5nbGUtc2FtcGxlZCBzdXJmYWNlLiBUaGlzXG4gICAgICogYmVoYXZpb3IgbWF0Y2hlcyB0aGUgV2ViR1BVIHNwZWNpZmljYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzdG9yZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgYXR0YWNobWVudCBuZWVkcyB0byBiZSByZXNvbHZlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHJlc29sdmUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgYXR0YWNobWVudCBuZWVkcyB0byBoYXZlIG1pcG1hcHMgZ2VuZXJhdGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgbWlwbWFwcyA9IGZhbHNlO1xufVxuXG5jbGFzcyBEZXB0aFN0ZW5jaWxBdHRhY2htZW50T3BzIHtcbiAgICAvKipcbiAgICAgKiBBIGRlcHRoIHZhbHVlIHVzZWQgdG8gY2xlYXIgdGhlIGRlcHRoIGF0dGFjaG1lbnQgd2hlbiB0aGUgY2xlYXIgaXMgZW5hYmxlZC5cbiAgICAgKi9cbiAgICBjbGVhckRlcHRoVmFsdWUgPSAxO1xuXG4gICAgLyoqXG4gICAgICogQSBzdGVuY2lsIHZhbHVlIHVzZWQgdG8gY2xlYXIgdGhlIHN0ZW5jaWwgYXR0YWNobWVudCB3aGVuIHRoZSBjbGVhciBpcyBlbmFibGVkLlxuICAgICAqL1xuICAgIGNsZWFyU3RlbmNpbFZhbHVlID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRlcHRoIGF0dGFjaG1lbnQgc2hvdWxkIGJlIGNsZWFyZWQgYmVmb3JlIHJlbmRlcmluZywgZmFsc2UgdG8gcHJlc2VydmVcbiAgICAgKiB0aGUgZXhpc3RpbmcgY29udGVudC5cbiAgICAgKi9cbiAgICBjbGVhckRlcHRoID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBzdGVuY2lsIGF0dGFjaG1lbnQgc2hvdWxkIGJlIGNsZWFyZWQgYmVmb3JlIHJlbmRlcmluZywgZmFsc2UgdG8gcHJlc2VydmVcbiAgICAgKiB0aGUgZXhpc3RpbmcgY29udGVudC5cbiAgICAgKi9cbiAgICBjbGVhclN0ZW5jaWwgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRlcHRoIGF0dGFjaG1lbnQgbmVlZHMgdG8gYmUgc3RvcmVkIGFmdGVyIHRoZSByZW5kZXIgcGFzcy4gRmFsc2VcbiAgICAgKiBpZiBpdCBjYW4gYmUgZGlzY2FyZGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc3RvcmVEZXB0aCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgc3RlbmNpbCBhdHRhY2htZW50IG5lZWRzIHRvIGJlIHN0b3JlZCBhZnRlciB0aGUgcmVuZGVyIHBhc3MuIEZhbHNlXG4gICAgICogaWYgaXQgY2FuIGJlIGRpc2NhcmRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHN0b3JlU3RlbmNpbCA9IGZhbHNlO1xufVxuXG4vKipcbiAqIEEgcmVuZGVyIHBhc3MgcmVwcmVzZW50cyBhIG5vZGUgaW4gdGhlIGZyYW1lIGdyYXBoLCBhbmQgZW5jYXBzdWxhdGVzIGEgc3lzdGVtIHdoaWNoXG4gKiByZW5kZXJzIHRvIGEgcmVuZGVyIHRhcmdldCB1c2luZyBhbiBleGVjdXRpb24gY2FsbGJhY2suXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZW5kZXJQYXNzIHtcbiAgICAvKiogQHR5cGUge3N0cmluZ30gKi9cbiAgICBuYW1lO1xuXG4gICAgLyoqIEB0eXBlIHtSZW5kZXJUYXJnZXR9ICovXG4gICAgcmVuZGVyVGFyZ2V0O1xuXG4gICAgLyoqXG4gICAgICogTnVtYmVyIG9mIHNhbXBsZXMuIDAgaWYgbm8gcmVuZGVyIHRhcmdldCwgb3RoZXJ3aXNlIG51bWJlciBvZiBzYW1wbGVzIGZyb20gdGhlIHJlbmRlciB0YXJnZXQsXG4gICAgICogb3IgdGhlIG1haW4gZnJhbWVidWZmZXIgaWYgcmVuZGVyIHRhcmdldCBpcyBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzYW1wbGVzID0gMDtcblxuICAgIC8qKiBAdHlwZSB7Q29sb3JBdHRhY2htZW50T3BzfSAqL1xuICAgIGNvbG9yT3BzO1xuXG4gICAgLyoqIEB0eXBlIHtEZXB0aFN0ZW5jaWxBdHRhY2htZW50T3BzfSAqL1xuICAgIGRlcHRoU3RlbmNpbE9wcztcblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoaXMgcGFzcyBtaWdodCB1c2UgZHluYW1pY2FsbHkgcmVuZGVyZWQgY3ViZW1hcHMuIFVzZSBmb3IgYSBjYXNlIHdoZXJlIHJlbmRlcmluZyB0byBjdWJlbWFwXG4gICAgICogZmFjZXMgaXMgaW50ZXJsZWF2ZWQgd2l0aCByZW5kZXJpbmcgdG8gc2hhZG93cywgdG8gYXZvaWQgZ2VuZXJhdGluZyBjdWJlbWFwIG1pcG1hcHMuIFRoaXMgd2lsbCBsaWtlbHlcbiAgICAgKiBiZSByZXRpcmVkIHdoZW4gcmVuZGVyIHRhcmdldCBkZXBlbmRlbmN5IHRyYWNraW5nIGdldHMgaW1wbGVtZW50ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICByZXF1aXJlc0N1YmVtYXBzID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIHJlbmRlciBwYXNzIHVzZXMgdGhlIGZ1bGwgdmlld3BvcnQgLyBzY2lzc29yIGZvciByZW5kZXJpbmcgaW50byB0aGUgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGZ1bGxTaXplQ2xlYXJSZWN0ID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gaW5zdGFuY2Ugb2YgdGhlIFJlbmRlclBhc3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZXhlY3V0ZSAtIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBwYXNzIG5lZWRzIHRvIGJlXG4gICAgICogcmVuZGVyZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIGV4ZWN1dGUpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcblxuICAgICAgICAvKiogQHR5cGUge0Z1bmN0aW9ufSAqL1xuICAgICAgICB0aGlzLmV4ZWN1dGUgPSBleGVjdXRlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyVGFyZ2V0fSByZW5kZXJUYXJnZXQgLSBUaGUgcmVuZGVyIHRhcmdldCB0byByZW5kZXIgaW50byAob3V0cHV0KS4gVGhpcyBmdW5jdGlvbiBzaG91bGQgYmVcbiAgICAgKiBjYWxsZWQgb25seSBmb3IgcmVuZGVyIHBhc3NlcyB3aGljaCB1c2UgcmVuZGVyIHRhcmdldCwgb3IgcGFzc2VzIHdoaWNoIHJlbmRlciBkaXJlY3RseSBpbnRvIHRoZSBkZWZhdWx0XG4gICAgICogZnJhbWVidWZmZXIsIGluIHdoaWNoIGNhc2UgYSBudWxsIG9yIHVuZGVmaW5lZCByZW5kZXIgdGFyZ2V0IGlzIGV4cGVjdGVkLlxuICAgICAqL1xuICAgIGluaXQocmVuZGVyVGFyZ2V0KSB7XG5cbiAgICAgICAgLy8gbnVsbCByZXByZXNlbnRzIHRoZSBkZWZhdWx0IGZyYW1lYnVmZmVyXG4gICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gcmVuZGVyVGFyZ2V0IHx8IG51bGw7XG5cbiAgICAgICAgLy8gYWxsb2NhdGUgb3BzIG9ubHkgd2hlbiByZW5kZXIgdGFyZ2V0IGlzIHVzZWRcbiAgICAgICAgdGhpcy5jb2xvck9wcyA9IG5ldyBDb2xvckF0dGFjaG1lbnRPcHMoKTtcbiAgICAgICAgdGhpcy5kZXB0aFN0ZW5jaWxPcHMgPSBuZXcgRGVwdGhTdGVuY2lsQXR0YWNobWVudE9wcygpO1xuXG4gICAgICAgIC8vIGRlZmF1bHRzIGRlcGVuZCBvbiBtdWx0aXNhbXBsaW5nXG4gICAgICAgIHRoaXMuc2FtcGxlcyA9IE1hdGgubWF4KHRoaXMucmVuZGVyVGFyZ2V0ID8gdGhpcy5yZW5kZXJUYXJnZXQuc2FtcGxlcyA6IHRoaXMuZGV2aWNlLnNhbXBsZXMsIDEpO1xuXG4gICAgICAgIC8vIGlmIHJlbmRlcmluZyB0byBzaW5nbGUtc2FtcGxlZCBidWZmZXIsIHRoaXMgYnVmZmVyIG5lZWRzIHRvIGJlIHN0b3JlZFxuICAgICAgICBpZiAodGhpcy5zYW1wbGVzID09PSAxKSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yT3BzLnN0b3JlID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuY29sb3JPcHMucmVzb2x2ZSA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgcmVuZGVyIHRhcmdldCBuZWVkcyBtaXBtYXBzXG4gICAgICAgIGlmICh0aGlzLnJlbmRlclRhcmdldD8uY29sb3JCdWZmZXI/Lm1pcG1hcHMpIHtcbiAgICAgICAgICAgIHRoaXMuY29sb3JPcHMubWlwbWFwcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIHJlbmRlciBwYXNzIGFzIGNsZWFyaW5nIHRoZSBmdWxsIGNvbG9yIGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Q29sb3J9IGNvbG9yIC0gVGhlIGNvbG9yIHRvIGNsZWFyIHRvLlxuICAgICAqL1xuICAgIHNldENsZWFyQ29sb3IoY29sb3IpIHtcbiAgICAgICAgdGhpcy5jb2xvck9wcy5jbGVhclZhbHVlLmNvcHkoY29sb3IpO1xuICAgICAgICB0aGlzLmNvbG9yT3BzLmNsZWFyID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIHJlbmRlciBwYXNzIGFzIGNsZWFyaW5nIHRoZSBmdWxsIGRlcHRoIGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkZXB0aFZhbHVlIC0gVGhlIGRlcHRoIHZhbHVlIHRvIGNsZWFyIHRvLlxuICAgICAqL1xuICAgIHNldENsZWFyRGVwdGgoZGVwdGhWYWx1ZSkge1xuICAgICAgICB0aGlzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoVmFsdWUgPSBkZXB0aFZhbHVlO1xuICAgICAgICB0aGlzLmRlcHRoU3RlbmNpbE9wcy5jbGVhckRlcHRoID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIHJlbmRlciBwYXNzIGFzIGNsZWFyaW5nIHRoZSBmdWxsIHN0ZW5jaWwgYnVmZmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHN0ZW5jaWxWYWx1ZSAtIFRoZSBzdGVuY2lsIHZhbHVlIHRvIGNsZWFyIHRvLlxuICAgICAqL1xuICAgIHNldENsZWFyU3RlbmNpbChzdGVuY2lsVmFsdWUpIHtcbiAgICAgICAgdGhpcy5kZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsVmFsdWUgPSBzdGVuY2lsVmFsdWU7XG4gICAgICAgIHRoaXMuZGVwdGhTdGVuY2lsT3BzLmNsZWFyU3RlbmNpbCA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHRoZSByZW5kZXIgcGFzc1xuICAgICAqL1xuICAgIHJlbmRlcigpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3QgcmVhbFBhc3MgPSB0aGlzLnJlbmRlclRhcmdldCAhPT0gdW5kZWZpbmVkO1xuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCBgUGFzczoke3RoaXMubmFtZX1gKTtcblxuICAgICAgICBpZiAocmVhbFBhc3MpIHtcbiAgICAgICAgICAgIGRldmljZS5zdGFydFBhc3ModGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4ZWN1dGUoKTtcblxuICAgICAgICBpZiAocmVhbFBhc3MpIHtcbiAgICAgICAgICAgIGRldmljZS5lbmRQYXNzKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVuZGVyUGFzcywgQ29sb3JBdHRhY2htZW50T3BzLCBEZXB0aFN0ZW5jaWxBdHRhY2htZW50T3BzIH07XG4iXSwibmFtZXMiOlsiQ29sb3JBdHRhY2htZW50T3BzIiwiY2xlYXJWYWx1ZSIsIkNvbG9yIiwiY2xlYXIiLCJzdG9yZSIsInJlc29sdmUiLCJtaXBtYXBzIiwiRGVwdGhTdGVuY2lsQXR0YWNobWVudE9wcyIsImNsZWFyRGVwdGhWYWx1ZSIsImNsZWFyU3RlbmNpbFZhbHVlIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsInN0b3JlRGVwdGgiLCJzdG9yZVN0ZW5jaWwiLCJSZW5kZXJQYXNzIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImV4ZWN1dGUiLCJuYW1lIiwicmVuZGVyVGFyZ2V0Iiwic2FtcGxlcyIsImNvbG9yT3BzIiwiZGVwdGhTdGVuY2lsT3BzIiwicmVxdWlyZXNDdWJlbWFwcyIsImZ1bGxTaXplQ2xlYXJSZWN0IiwiZGV2aWNlIiwiaW5pdCIsIk1hdGgiLCJtYXgiLCJjb2xvckJ1ZmZlciIsInNldENsZWFyQ29sb3IiLCJjb2xvciIsImNvcHkiLCJzZXRDbGVhckRlcHRoIiwiZGVwdGhWYWx1ZSIsInNldENsZWFyU3RlbmNpbCIsInN0ZW5jaWxWYWx1ZSIsInJlbmRlciIsInJlYWxQYXNzIiwidW5kZWZpbmVkIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJzdGFydFBhc3MiLCJlbmRQYXNzIiwicG9wR3B1TWFya2VyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQU1BLE1BQU1BLGtCQUFOLENBQXlCO0FBQUEsRUFBQSxXQUFBLEdBQUE7QUFBQSxJQUFBLElBQUEsQ0FJckJDLFVBSnFCLEdBSVIsSUFBSUMsS0FBSixDQUFVLENBQVYsRUFBYSxDQUFiLEVBQWdCLENBQWhCLEVBQW1CLENBQW5CLENBSlEsQ0FBQTtJQUFBLElBVXJCQyxDQUFBQSxLQVZxQixHQVViLEtBVmEsQ0FBQTtJQUFBLElBc0JyQkMsQ0FBQUEsS0F0QnFCLEdBc0JiLEtBdEJhLENBQUE7SUFBQSxJQTZCckJDLENBQUFBLE9BN0JxQixHQTZCWCxJQTdCVyxDQUFBO0lBQUEsSUFvQ3JCQyxDQUFBQSxPQXBDcUIsR0FvQ1gsS0FwQ1csQ0FBQTtBQUFBLEdBQUE7O0FBQUEsQ0FBQTs7QUF1Q3pCLE1BQU1DLHlCQUFOLENBQWdDO0FBQUEsRUFBQSxXQUFBLEdBQUE7SUFBQSxJQUk1QkMsQ0FBQUEsZUFKNEIsR0FJVixDQUpVLENBQUE7SUFBQSxJQVM1QkMsQ0FBQUEsaUJBVDRCLEdBU1IsQ0FUUSxDQUFBO0lBQUEsSUFlNUJDLENBQUFBLFVBZjRCLEdBZWYsS0FmZSxDQUFBO0lBQUEsSUFxQjVCQyxDQUFBQSxZQXJCNEIsR0FxQmIsS0FyQmEsQ0FBQTtJQUFBLElBNkI1QkMsQ0FBQUEsVUE3QjRCLEdBNkJmLEtBN0JlLENBQUE7SUFBQSxJQXFDNUJDLENBQUFBLFlBckM0QixHQXFDYixLQXJDYSxDQUFBO0FBQUEsR0FBQTs7QUFBQSxDQUFBOztBQThDaEMsTUFBTUMsVUFBTixDQUFpQjtBQTRDYkMsRUFBQUEsV0FBVyxDQUFDQyxjQUFELEVBQWlCQyxPQUFqQixFQUEwQjtBQUFBLElBQUEsSUFBQSxDQTFDckNDLElBMENxQyxHQUFBLEtBQUEsQ0FB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
