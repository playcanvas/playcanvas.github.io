/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Color } from '../../core/math/color.js';
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

/**
 * A render pass represents a node in the frame graph, and encapsulates a system which
 * renders to a render target using an execution callback.
 *
 * @ignore
 */
class RenderPass {
  /** @type {string} */

  /** @type {import('../graphics/render-target.js').RenderTarget} */

  /**
   * Number of samples. 0 if no render target, otherwise number of samples from the render target,
   * or the main framebuffer if render target is null.
   *
   * @type {number}
   */

  /** @type {ColorAttachmentOps} */

  /** @type {DepthStencilAttachmentOps} */

  /**
   * If true, this pass might use dynamically rendered cubemaps. Use for a case where rendering to cubemap
   * faces is interleaved with rendering to shadows, to avoid generating cubemap mipmaps. This will likely
   * be retired when render target dependency tracking gets implemented.
   *
   * @type {boolean}
   */

  /**
   * True if the render pass uses the full viewport / scissor for rendering into the render target.
   *
   * @type {boolean}
   */

  /**
   * Custom function that is called before the pass has started.
   *
   * @type {Function}
   */

  /**
   * Custom function that is called after the pass has fnished.
   *
   * @type {Function}
   */

  /**
   * Creates an instance of the RenderPass.
   *
   * @param {import('../graphics/graphics-device.js').GraphicsDevice} graphicsDevice - The
   * graphics device.
   * @param {Function} execute - Custom function that is called when the pass needs to be
   * rendered.
   */
  constructor(graphicsDevice, execute) {
    this.name = void 0;
    this.renderTarget = void 0;
    this.samples = 0;
    this.colorOps = void 0;
    this.depthStencilOps = void 0;
    this.requiresCubemaps = true;
    this.fullSizeClearRect = true;
    this.before = void 0;
    this.after = void 0;
    this.device = graphicsDevice;

    /** @type {Function} */
    this.execute = execute;
  }

  /**
   * @param {import('../graphics/render-target.js').RenderTarget} renderTarget - The render
   * target to render into (output). This function should be called only for render passes which
   * use render target, or passes which render directly into the default framebuffer, in which
   * case a null or undefined render target is expected.
   */
  init(renderTarget) {
    var _this$renderTarget, _this$renderTarget$co;
    // null represents the default framebuffer
    this.renderTarget = renderTarget || null;

    // allocate ops only when render target is used
    this.colorOps = new ColorAttachmentOps();
    this.depthStencilOps = new DepthStencilAttachmentOps();

    // defaults depend on multisampling
    this.samples = Math.max(this.renderTarget ? this.renderTarget.samples : this.device.samples, 1);

    // if rendering to single-sampled buffer, this buffer needs to be stored
    if (this.samples === 1) {
      this.colorOps.store = true;
      this.colorOps.resolve = false;
    }

    // if render target needs mipmaps
    if ((_this$renderTarget = this.renderTarget) != null && (_this$renderTarget$co = _this$renderTarget.colorBuffer) != null && _this$renderTarget$co.mipmaps) {
      this.colorOps.mipmaps = true;
    }
  }

  /**
   * Mark render pass as clearing the full color buffer.
   *
   * @param {Color} color - The color to clear to.
   */
  setClearColor(color) {
    this.colorOps.clearValue.copy(color);
    this.colorOps.clear = true;
  }

  /**
   * Mark render pass as clearing the full depth buffer.
   *
   * @param {number} depthValue - The depth value to clear to.
   */
  setClearDepth(depthValue) {
    this.depthStencilOps.clearDepthValue = depthValue;
    this.depthStencilOps.clearDepth = true;
  }

  /**
   * Mark render pass as clearing the full stencil buffer.
   *
   * @param {number} stencilValue - The stencil value to clear to.
   */
  setClearStencil(stencilValue) {
    this.depthStencilOps.clearStencilValue = stencilValue;
    this.depthStencilOps.clearStencil = true;
  }

  /**
   * Render the render pass
   */
  render() {
    var _this$before, _this$after;
    const device = this.device;
    const realPass = this.renderTarget !== undefined;
    DebugGraphics.pushGpuMarker(device, `Pass:${this.name}`);
    (_this$before = this.before) == null ? void 0 : _this$before.call(this);
    if (realPass) {
      device.startPass(this);
    }
    this.execute();
    if (realPass) {
      device.endPass(this);
    }
    (_this$after = this.after) == null ? void 0 : _this$after.call(this);
    DebugGraphics.popGpuMarker(device);
  }
}

export { ColorAttachmentOps, DepthStencilAttachmentOps, RenderPass };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXBhc3MuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItcGFzcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuXG5jbGFzcyBDb2xvckF0dGFjaG1lbnRPcHMge1xuICAgIC8qKlxuICAgICAqIEEgY29sb3IgdXNlZCB0byBjbGVhciB0aGUgY29sb3IgYXR0YWNobWVudCB3aGVuIHRoZSBjbGVhciBpcyBlbmFibGVkLlxuICAgICAqL1xuICAgIGNsZWFyVmFsdWUgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMSk7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBhdHRhY2htZW50IHNob3VsZCBiZSBjbGVhcmVkIGJlZm9yZSByZW5kZXJpbmcsIGZhbHNlIHRvIHByZXNlcnZlXG4gICAgICogdGhlIGV4aXN0aW5nIGNvbnRlbnQuXG4gICAgICovXG4gICAgY2xlYXIgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGF0dGFjaG1lbnQgbmVlZHMgdG8gYmUgc3RvcmVkIGFmdGVyIHRoZSByZW5kZXIgcGFzcy4gRmFsc2VcbiAgICAgKiBpZiBpdCBjYW4gYmUgZGlzY2FyZGVkLlxuICAgICAqIE5vdGU6IFRoaXMgcmVsYXRlcyB0byB0aGUgc3VyZmFjZSB0aGF0IGlzIGdldHRpbmcgcmVuZGVyZWQgdG8sIGFuZCBjYW4gYmUgZWl0aGVyXG4gICAgICogc2luZ2xlIG9yIG11bHRpLXNhbXBsZWQuIEZ1cnRoZXIsIGlmIGEgbXVsdGktc2FtcGxlZCBzdXJmYWNlIGlzIHVzZWQsIHRoZSByZXNvbHZlXG4gICAgICogZmxhZyBmdXJ0aGVyIHNwZWNpZmllcyBpZiB0aGlzIGdldHMgcmVzb2x2ZWQgdG8gYSBzaW5nbGUtc2FtcGxlZCBzdXJmYWNlLiBUaGlzXG4gICAgICogYmVoYXZpb3IgbWF0Y2hlcyB0aGUgV2ViR1BVIHNwZWNpZmljYXRpb24uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzdG9yZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgYXR0YWNobWVudCBuZWVkcyB0byBiZSByZXNvbHZlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHJlc29sdmUgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgYXR0YWNobWVudCBuZWVkcyB0byBoYXZlIG1pcG1hcHMgZ2VuZXJhdGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgbWlwbWFwcyA9IGZhbHNlO1xufVxuXG5jbGFzcyBEZXB0aFN0ZW5jaWxBdHRhY2htZW50T3BzIHtcbiAgICAvKipcbiAgICAgKiBBIGRlcHRoIHZhbHVlIHVzZWQgdG8gY2xlYXIgdGhlIGRlcHRoIGF0dGFjaG1lbnQgd2hlbiB0aGUgY2xlYXIgaXMgZW5hYmxlZC5cbiAgICAgKi9cbiAgICBjbGVhckRlcHRoVmFsdWUgPSAxO1xuXG4gICAgLyoqXG4gICAgICogQSBzdGVuY2lsIHZhbHVlIHVzZWQgdG8gY2xlYXIgdGhlIHN0ZW5jaWwgYXR0YWNobWVudCB3aGVuIHRoZSBjbGVhciBpcyBlbmFibGVkLlxuICAgICAqL1xuICAgIGNsZWFyU3RlbmNpbFZhbHVlID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRlcHRoIGF0dGFjaG1lbnQgc2hvdWxkIGJlIGNsZWFyZWQgYmVmb3JlIHJlbmRlcmluZywgZmFsc2UgdG8gcHJlc2VydmVcbiAgICAgKiB0aGUgZXhpc3RpbmcgY29udGVudC5cbiAgICAgKi9cbiAgICBjbGVhckRlcHRoID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBzdGVuY2lsIGF0dGFjaG1lbnQgc2hvdWxkIGJlIGNsZWFyZWQgYmVmb3JlIHJlbmRlcmluZywgZmFsc2UgdG8gcHJlc2VydmVcbiAgICAgKiB0aGUgZXhpc3RpbmcgY29udGVudC5cbiAgICAgKi9cbiAgICBjbGVhclN0ZW5jaWwgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGRlcHRoIGF0dGFjaG1lbnQgbmVlZHMgdG8gYmUgc3RvcmVkIGFmdGVyIHRoZSByZW5kZXIgcGFzcy4gRmFsc2VcbiAgICAgKiBpZiBpdCBjYW4gYmUgZGlzY2FyZGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc3RvcmVEZXB0aCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVHJ1ZSBpZiB0aGUgc3RlbmNpbCBhdHRhY2htZW50IG5lZWRzIHRvIGJlIHN0b3JlZCBhZnRlciB0aGUgcmVuZGVyIHBhc3MuIEZhbHNlXG4gICAgICogaWYgaXQgY2FuIGJlIGRpc2NhcmRlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHN0b3JlU3RlbmNpbCA9IGZhbHNlO1xufVxuXG4vKipcbiAqIEEgcmVuZGVyIHBhc3MgcmVwcmVzZW50cyBhIG5vZGUgaW4gdGhlIGZyYW1lIGdyYXBoLCBhbmQgZW5jYXBzdWxhdGVzIGEgc3lzdGVtIHdoaWNoXG4gKiByZW5kZXJzIHRvIGEgcmVuZGVyIHRhcmdldCB1c2luZyBhbiBleGVjdXRpb24gY2FsbGJhY2suXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZW5kZXJQYXNzIHtcbiAgICAvKiogQHR5cGUge3N0cmluZ30gKi9cbiAgICBuYW1lO1xuXG4gICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9ICovXG4gICAgcmVuZGVyVGFyZ2V0O1xuXG4gICAgLyoqXG4gICAgICogTnVtYmVyIG9mIHNhbXBsZXMuIDAgaWYgbm8gcmVuZGVyIHRhcmdldCwgb3RoZXJ3aXNlIG51bWJlciBvZiBzYW1wbGVzIGZyb20gdGhlIHJlbmRlciB0YXJnZXQsXG4gICAgICogb3IgdGhlIG1haW4gZnJhbWVidWZmZXIgaWYgcmVuZGVyIHRhcmdldCBpcyBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzYW1wbGVzID0gMDtcblxuICAgIC8qKiBAdHlwZSB7Q29sb3JBdHRhY2htZW50T3BzfSAqL1xuICAgIGNvbG9yT3BzO1xuXG4gICAgLyoqIEB0eXBlIHtEZXB0aFN0ZW5jaWxBdHRhY2htZW50T3BzfSAqL1xuICAgIGRlcHRoU3RlbmNpbE9wcztcblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoaXMgcGFzcyBtaWdodCB1c2UgZHluYW1pY2FsbHkgcmVuZGVyZWQgY3ViZW1hcHMuIFVzZSBmb3IgYSBjYXNlIHdoZXJlIHJlbmRlcmluZyB0byBjdWJlbWFwXG4gICAgICogZmFjZXMgaXMgaW50ZXJsZWF2ZWQgd2l0aCByZW5kZXJpbmcgdG8gc2hhZG93cywgdG8gYXZvaWQgZ2VuZXJhdGluZyBjdWJlbWFwIG1pcG1hcHMuIFRoaXMgd2lsbCBsaWtlbHlcbiAgICAgKiBiZSByZXRpcmVkIHdoZW4gcmVuZGVyIHRhcmdldCBkZXBlbmRlbmN5IHRyYWNraW5nIGdldHMgaW1wbGVtZW50ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICByZXF1aXJlc0N1YmVtYXBzID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIHJlbmRlciBwYXNzIHVzZXMgdGhlIGZ1bGwgdmlld3BvcnQgLyBzY2lzc29yIGZvciByZW5kZXJpbmcgaW50byB0aGUgcmVuZGVyIHRhcmdldC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGZ1bGxTaXplQ2xlYXJSZWN0ID0gdHJ1ZTtcblxuICAgIC8qKlxuICAgICAqIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCBiZWZvcmUgdGhlIHBhc3MgaGFzIHN0YXJ0ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7RnVuY3Rpb259XG4gICAgICovXG4gICAgYmVmb3JlO1xuXG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGZ1bmN0aW9uIHRoYXQgaXMgY2FsbGVkIGFmdGVyIHRoZSBwYXNzIGhhcyBmbmlzaGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAqL1xuICAgIGFmdGVyO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhbiBpbnN0YW5jZSBvZiB0aGUgUmVuZGVyUGFzcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZXhlY3V0ZSAtIEN1c3RvbSBmdW5jdGlvbiB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBwYXNzIG5lZWRzIHRvIGJlXG4gICAgICogcmVuZGVyZWQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIGV4ZWN1dGUpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcblxuICAgICAgICAvKiogQHR5cGUge0Z1bmN0aW9ufSAqL1xuICAgICAgICB0aGlzLmV4ZWN1dGUgPSBleGVjdXRlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fSByZW5kZXJUYXJnZXQgLSBUaGUgcmVuZGVyXG4gICAgICogdGFyZ2V0IHRvIHJlbmRlciBpbnRvIChvdXRwdXQpLiBUaGlzIGZ1bmN0aW9uIHNob3VsZCBiZSBjYWxsZWQgb25seSBmb3IgcmVuZGVyIHBhc3NlcyB3aGljaFxuICAgICAqIHVzZSByZW5kZXIgdGFyZ2V0LCBvciBwYXNzZXMgd2hpY2ggcmVuZGVyIGRpcmVjdGx5IGludG8gdGhlIGRlZmF1bHQgZnJhbWVidWZmZXIsIGluIHdoaWNoXG4gICAgICogY2FzZSBhIG51bGwgb3IgdW5kZWZpbmVkIHJlbmRlciB0YXJnZXQgaXMgZXhwZWN0ZWQuXG4gICAgICovXG4gICAgaW5pdChyZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICAvLyBudWxsIHJlcHJlc2VudHMgdGhlIGRlZmF1bHQgZnJhbWVidWZmZXJcbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSByZW5kZXJUYXJnZXQgfHwgbnVsbDtcblxuICAgICAgICAvLyBhbGxvY2F0ZSBvcHMgb25seSB3aGVuIHJlbmRlciB0YXJnZXQgaXMgdXNlZFxuICAgICAgICB0aGlzLmNvbG9yT3BzID0gbmV3IENvbG9yQXR0YWNobWVudE9wcygpO1xuICAgICAgICB0aGlzLmRlcHRoU3RlbmNpbE9wcyA9IG5ldyBEZXB0aFN0ZW5jaWxBdHRhY2htZW50T3BzKCk7XG5cbiAgICAgICAgLy8gZGVmYXVsdHMgZGVwZW5kIG9uIG11bHRpc2FtcGxpbmdcbiAgICAgICAgdGhpcy5zYW1wbGVzID0gTWF0aC5tYXgodGhpcy5yZW5kZXJUYXJnZXQgPyB0aGlzLnJlbmRlclRhcmdldC5zYW1wbGVzIDogdGhpcy5kZXZpY2Uuc2FtcGxlcywgMSk7XG5cbiAgICAgICAgLy8gaWYgcmVuZGVyaW5nIHRvIHNpbmdsZS1zYW1wbGVkIGJ1ZmZlciwgdGhpcyBidWZmZXIgbmVlZHMgdG8gYmUgc3RvcmVkXG4gICAgICAgIGlmICh0aGlzLnNhbXBsZXMgPT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuY29sb3JPcHMuc3RvcmUgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5jb2xvck9wcy5yZXNvbHZlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiByZW5kZXIgdGFyZ2V0IG5lZWRzIG1pcG1hcHNcbiAgICAgICAgaWYgKHRoaXMucmVuZGVyVGFyZ2V0Py5jb2xvckJ1ZmZlcj8ubWlwbWFwcykge1xuICAgICAgICAgICAgdGhpcy5jb2xvck9wcy5taXBtYXBzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmsgcmVuZGVyIHBhc3MgYXMgY2xlYXJpbmcgdGhlIGZ1bGwgY29sb3IgYnVmZmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtDb2xvcn0gY29sb3IgLSBUaGUgY29sb3IgdG8gY2xlYXIgdG8uXG4gICAgICovXG4gICAgc2V0Q2xlYXJDb2xvcihjb2xvcikge1xuICAgICAgICB0aGlzLmNvbG9yT3BzLmNsZWFyVmFsdWUuY29weShjb2xvcik7XG4gICAgICAgIHRoaXMuY29sb3JPcHMuY2xlYXIgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmsgcmVuZGVyIHBhc3MgYXMgY2xlYXJpbmcgdGhlIGZ1bGwgZGVwdGggYnVmZmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlcHRoVmFsdWUgLSBUaGUgZGVwdGggdmFsdWUgdG8gY2xlYXIgdG8uXG4gICAgICovXG4gICAgc2V0Q2xlYXJEZXB0aChkZXB0aFZhbHVlKSB7XG4gICAgICAgIHRoaXMuZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGhWYWx1ZSA9IGRlcHRoVmFsdWU7XG4gICAgICAgIHRoaXMuZGVwdGhTdGVuY2lsT3BzLmNsZWFyRGVwdGggPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmsgcmVuZGVyIHBhc3MgYXMgY2xlYXJpbmcgdGhlIGZ1bGwgc3RlbmNpbCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc3RlbmNpbFZhbHVlIC0gVGhlIHN0ZW5jaWwgdmFsdWUgdG8gY2xlYXIgdG8uXG4gICAgICovXG4gICAgc2V0Q2xlYXJTdGVuY2lsKHN0ZW5jaWxWYWx1ZSkge1xuICAgICAgICB0aGlzLmRlcHRoU3RlbmNpbE9wcy5jbGVhclN0ZW5jaWxWYWx1ZSA9IHN0ZW5jaWxWYWx1ZTtcbiAgICAgICAgdGhpcy5kZXB0aFN0ZW5jaWxPcHMuY2xlYXJTdGVuY2lsID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgdGhlIHJlbmRlciBwYXNzXG4gICAgICovXG4gICAgcmVuZGVyKCkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCByZWFsUGFzcyA9IHRoaXMucmVuZGVyVGFyZ2V0ICE9PSB1bmRlZmluZWQ7XG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIGBQYXNzOiR7dGhpcy5uYW1lfWApO1xuXG4gICAgICAgIHRoaXMuYmVmb3JlPy4oKTtcblxuICAgICAgICBpZiAocmVhbFBhc3MpIHtcbiAgICAgICAgICAgIGRldmljZS5zdGFydFBhc3ModGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmV4ZWN1dGUoKTtcblxuICAgICAgICBpZiAocmVhbFBhc3MpIHtcbiAgICAgICAgICAgIGRldmljZS5lbmRQYXNzKHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hZnRlcj8uKCk7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVuZGVyUGFzcywgQ29sb3JBdHRhY2htZW50T3BzLCBEZXB0aFN0ZW5jaWxBdHRhY2htZW50T3BzIH07XG4iXSwibmFtZXMiOlsiQ29sb3JBdHRhY2htZW50T3BzIiwiY2xlYXJWYWx1ZSIsIkNvbG9yIiwiY2xlYXIiLCJzdG9yZSIsInJlc29sdmUiLCJtaXBtYXBzIiwiRGVwdGhTdGVuY2lsQXR0YWNobWVudE9wcyIsImNsZWFyRGVwdGhWYWx1ZSIsImNsZWFyU3RlbmNpbFZhbHVlIiwiY2xlYXJEZXB0aCIsImNsZWFyU3RlbmNpbCIsInN0b3JlRGVwdGgiLCJzdG9yZVN0ZW5jaWwiLCJSZW5kZXJQYXNzIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImV4ZWN1dGUiLCJuYW1lIiwicmVuZGVyVGFyZ2V0Iiwic2FtcGxlcyIsImNvbG9yT3BzIiwiZGVwdGhTdGVuY2lsT3BzIiwicmVxdWlyZXNDdWJlbWFwcyIsImZ1bGxTaXplQ2xlYXJSZWN0IiwiYmVmb3JlIiwiYWZ0ZXIiLCJkZXZpY2UiLCJpbml0IiwiTWF0aCIsIm1heCIsImNvbG9yQnVmZmVyIiwic2V0Q2xlYXJDb2xvciIsImNvbG9yIiwiY29weSIsInNldENsZWFyRGVwdGgiLCJkZXB0aFZhbHVlIiwic2V0Q2xlYXJTdGVuY2lsIiwic3RlbmNpbFZhbHVlIiwicmVuZGVyIiwicmVhbFBhc3MiLCJ1bmRlZmluZWQiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsInN0YXJ0UGFzcyIsImVuZFBhc3MiLCJwb3BHcHVNYXJrZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBR0EsTUFBTUEsa0JBQWtCLENBQUM7QUFBQSxFQUFBLFdBQUEsR0FBQTtBQUFBLElBQUEsSUFBQSxDQUlyQkMsVUFBVSxHQUFHLElBQUlDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtJQUFBLElBTWxDQyxDQUFBQSxLQUFLLEdBQUcsS0FBSyxDQUFBO0lBQUEsSUFZYkMsQ0FBQUEsS0FBSyxHQUFHLEtBQUssQ0FBQTtJQUFBLElBT2JDLENBQUFBLE9BQU8sR0FBRyxJQUFJLENBQUE7SUFBQSxJQU9kQyxDQUFBQSxPQUFPLEdBQUcsS0FBSyxDQUFBO0FBQUEsR0FBQTtBQUNuQixDQUFBO0FBRUEsTUFBTUMseUJBQXlCLENBQUM7QUFBQSxFQUFBLFdBQUEsR0FBQTtJQUFBLElBSTVCQyxDQUFBQSxlQUFlLEdBQUcsQ0FBQyxDQUFBO0lBQUEsSUFLbkJDLENBQUFBLGlCQUFpQixHQUFHLENBQUMsQ0FBQTtJQUFBLElBTXJCQyxDQUFB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
