/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../core/platform.js';
import { EventHandler } from '../core/event-handler.js';
import { XRTYPE_AR, XRSPACE_VIEWER } from './constants.js';
import { XrHitTestSource } from './xr-hit-test-source.js';

class XrHitTest extends EventHandler {
  constructor(manager) {
    super();
    this.manager = void 0;
    this._supported = platform.browser && !!(window.XRSession && window.XRSession.prototype.requestHitTestSource);
    this._session = null;
    this.sources = [];
    this.manager = manager;

    if (this._supported) {
      this.manager.on('start', this._onSessionStart, this);
      this.manager.on('end', this._onSessionEnd, this);
    }
  }

  _onSessionStart() {
    if (this.manager.type !== XRTYPE_AR) return;
    this._session = this.manager.session;
  }

  _onSessionEnd() {
    if (!this._session) return;
    this._session = null;

    for (let i = 0; i < this.sources.length; i++) {
      this.sources[i].onStop();
    }

    this.sources = [];
  }

  isAvailable(callback, fireError) {
    let err;
    if (!this._supported) err = new Error('XR HitTest is not supported');
    if (!this._session) err = new Error('XR Session is not started (1)');
    if (this.manager.type !== XRTYPE_AR) err = new Error('XR HitTest is available only for AR');

    if (err) {
      if (callback) callback(err);
      if (fireError) fireError.fire('error', err);
      return false;
    }

    return true;
  }

  start(options = {}) {
    if (!this.isAvailable(options.callback, this)) return;
    if (!options.profile && !options.spaceType) options.spaceType = XRSPACE_VIEWER;
    let xrRay;
    const offsetRay = options.offsetRay;

    if (offsetRay) {
      const origin = new DOMPoint(offsetRay.origin.x, offsetRay.origin.y, offsetRay.origin.z, 1.0);
      const direction = new DOMPoint(offsetRay.direction.x, offsetRay.direction.y, offsetRay.direction.z, 0.0);
      xrRay = new XRRay(origin, direction);
    }

    const callback = options.callback;

    if (options.spaceType) {
      this._session.requestReferenceSpace(options.spaceType).then(referenceSpace => {
        if (!this._session) {
          const err = new Error('XR Session is not started (2)');
          if (callback) callback(err);
          this.fire('error', err);
          return;
        }

        this._session.requestHitTestSource({
          space: referenceSpace,
          entityTypes: options.entityTypes || undefined,
          offsetRay: xrRay
        }).then(xrHitTestSource => {
          this._onHitTestSource(xrHitTestSource, false, callback);
        }).catch(ex => {
          if (callback) callback(ex);
          this.fire('error', ex);
        });
      }).catch(ex => {
        if (callback) callback(ex);
        this.fire('error', ex);
      });
    } else {
      this._session.requestHitTestSourceForTransientInput({
        profile: options.profile,
        entityTypes: options.entityTypes || undefined,
        offsetRay: xrRay
      }).then(xrHitTestSource => {
        this._onHitTestSource(xrHitTestSource, true, callback);
      }).catch(ex => {
        if (callback) callback(ex);
        this.fire('error', ex);
      });
    }
  }

  _onHitTestSource(xrHitTestSource, transient, callback) {
    if (!this._session) {
      xrHitTestSource.cancel();
      const err = new Error('XR Session is not started (3)');
      if (callback) callback(err);
      this.fire('error', err);
      return;
    }

    const hitTestSource = new XrHitTestSource(this.manager, xrHitTestSource, transient);
    this.sources.push(hitTestSource);
    if (callback) callback(null, hitTestSource);
    this.fire('add', hitTestSource);
  }

  update(frame) {
    for (let i = 0; i < this.sources.length; i++) {
      this.sources[i].update(frame);
    }
  }

  get supported() {
    return this._supported;
  }

}

export { XrHitTest };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItaGl0LXRlc3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy94ci94ci1oaXQtdGVzdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgWFJTUEFDRV9WSUVXRVIsIFhSVFlQRV9BUiB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFhySGl0VGVzdFNvdXJjZSB9IGZyb20gJy4veHItaGl0LXRlc3Qtc291cmNlLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gWHJNYW5hZ2VyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vc2hhcGUvcmF5LmpzJykuUmF5fSBSYXkgKi9cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBYckhpdFRlc3Qjc3RhcnR9IGFuZCB7QGxpbmsgWHJIaXRUZXN0I3N0YXJ0Rm9ySW5wdXRTb3VyY2V9LlxuICpcbiAqIEBjYWxsYmFjayBYckhpdFRlc3RTdGFydENhbGxiYWNrXG4gKiBAcGFyYW0ge0Vycm9yfG51bGx9IGVyciAtIFRoZSBFcnJvciBvYmplY3QgaWYgZmFpbGVkIHRvIGNyZWF0ZSBoaXQgdGVzdCBzb3VyY2Ugb3IgbnVsbC5cbiAqIEBwYXJhbSB7WHJIaXRUZXN0U291cmNlfG51bGx9IGhpdFRlc3RTb3VyY2UgLSBPYmplY3QgdGhhdCBwcm92aWRlcyBhY2Nlc3MgdG8gaGl0IHJlc3VsdHMgYWdhaW5zdFxuICogcmVhbCB3b3JsZCBnZW9tZXRyeS5cbiAqL1xuXG4vKipcbiAqIEhpdCBUZXN0IHByb3ZpZGVzIGFiaWxpdHkgdG8gZ2V0IHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiByYXkgaW50ZXJzZWN0aW5nIHBvaW50IHdpdGhcbiAqIHJlcHJlc2VudGF0aW9uIG9mIHJlYWwgd29ybGQgZ2VvbWV0cnkgYnkgdW5kZXJseWluZyBBUiBzeXN0ZW0uXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBYckhpdFRlc3QgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYck1hbmFnZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBtYW5hZ2VyO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc3VwcG9ydGVkID0gcGxhdGZvcm0uYnJvd3NlciAmJiAhISh3aW5kb3cuWFJTZXNzaW9uICYmIHdpbmRvdy5YUlNlc3Npb24ucHJvdG90eXBlLnJlcXVlc3RIaXRUZXN0U291cmNlKTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtYUlNlc3Npb259XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2Vzc2lvbiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBMaXN0IG9mIGFjdGl2ZSB7QGxpbmsgWHJIaXRUZXN0U291cmNlfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYckhpdFRlc3RTb3VyY2VbXX1cbiAgICAgKi9cbiAgICBzb3VyY2VzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgWHJIaXRUZXN0IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtYck1hbmFnZXJ9IG1hbmFnZXIgLSBXZWJYUiBNYW5hZ2VyLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtYW5hZ2VyKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcblxuICAgICAgICBpZiAodGhpcy5fc3VwcG9ydGVkKSB7XG4gICAgICAgICAgICB0aGlzLm1hbmFnZXIub24oJ3N0YXJ0JywgdGhpcy5fb25TZXNzaW9uU3RhcnQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5tYW5hZ2VyLm9uKCdlbmQnLCB0aGlzLl9vblNlc3Npb25FbmQsIHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBuZXcge0BsaW5rIFhySGl0VGVzdFNvdXJjZX0gaXMgYWRkZWQgdG8gdGhlIGxpc3QuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJIaXRUZXN0I2FkZFxuICAgICAqIEBwYXJhbSB7WHJIaXRUZXN0U291cmNlfSBoaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlIHRoYXQgaGFzIGJlZW4gYWRkZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuaGl0VGVzdC5vbignYWRkJywgZnVuY3Rpb24gKGhpdFRlc3RTb3VyY2UpIHtcbiAgICAgKiAgICAgLy8gbmV3IGhpdCB0ZXN0IHNvdXJjZSBpcyBhZGRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB7QGxpbmsgWHJIaXRUZXN0U291cmNlfSBpcyByZW1vdmVkIHRvIHRoZSBsaXN0LlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySGl0VGVzdCNyZW1vdmVcbiAgICAgKiBAcGFyYW0ge1hySGl0VGVzdFNvdXJjZX0gaGl0VGVzdFNvdXJjZSAtIEhpdCB0ZXN0IHNvdXJjZSB0aGF0IGhhcyBiZWVuIHJlbW92ZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuaGl0VGVzdC5vbigncmVtb3ZlJywgZnVuY3Rpb24gKGhpdFRlc3RTb3VyY2UpIHtcbiAgICAgKiAgICAgLy8gaGl0IHRlc3Qgc291cmNlIGlzIHJlbW92ZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gaGl0IHRlc3Qgc291cmNlIHJlY2VpdmVzIG5ldyByZXN1bHRzLiBJdCBwcm92aWRlcyB0cmFuc2Zvcm0gaW5mb3JtYXRpb24gdGhhdFxuICAgICAqIHRyaWVzIHRvIG1hdGNoIHJlYWwgd29ybGQgcGlja2VkIGdlb21ldHJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySGl0VGVzdCNyZXN1bHRcbiAgICAgKiBAcGFyYW0ge1hySGl0VGVzdFNvdXJjZX0gaGl0VGVzdFNvdXJjZSAtIEhpdCB0ZXN0IHNvdXJjZSB0aGF0IHByb2R1Y2VkIHRoZSBoaXQgcmVzdWx0LlxuICAgICAqIEBwYXJhbSB7VmVjM30gcG9zaXRpb24gLSBQb3NpdGlvbiBvZiBoaXQgdGVzdC5cbiAgICAgKiBAcGFyYW0ge1F1YXR9IHJvdGF0aW9uIC0gUm90YXRpb24gb2YgaGl0IHRlc3QuXG4gICAgICogQHBhcmFtIHtYcklucHV0U291cmNlfG51bGx9IGlucHV0U291cmNlIC0gSWYgaXMgdHJhbnNpZW50IGhpdCB0ZXN0IHNvdXJjZSwgdGhlbiBpdCB3aWxsIHByb3ZpZGUgcmVsYXRlZCBpbnB1dCBzb3VyY2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuaGl0VGVzdC5vbigncmVzdWx0JywgZnVuY3Rpb24gKGhpdFRlc3RTb3VyY2UsIHBvc2l0aW9uLCByb3RhdGlvbiwgaW5wdXRTb3VyY2UpIHtcbiAgICAgKiAgICAgdGFyZ2V0LnNldFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgKiAgICAgdGFyZ2V0LnNldFJvdGF0aW9uKHJvdGF0aW9uKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gZmFpbGVkIGNyZWF0ZSBoaXQgdGVzdCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJIaXRUZXN0I2Vycm9yXG4gICAgICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgLSBFcnJvciBvYmplY3QgcmVsYXRlZCB0byBmYWlsdXJlIG9mIGNyZWF0aW5nIGhpdCB0ZXN0IHNvdXJjZS5cbiAgICAgKi9cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblNlc3Npb25TdGFydCgpIHtcbiAgICAgICAgaWYgKHRoaXMubWFuYWdlci50eXBlICE9PSBYUlRZUEVfQVIpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fc2Vzc2lvbiA9IHRoaXMubWFuYWdlci5zZXNzaW9uO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblNlc3Npb25FbmQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9zZXNzaW9uID0gbnVsbDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5zb3VyY2VzW2ldLm9uU3RvcCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc291cmNlcyA9IFtdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyBpZiBoaXQgdGVzdGluZyBpcyBhdmFpbGFibGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIEVycm9yIGNhbGxiYWNrLlxuICAgICAqIEBwYXJhbSB7Kn0gZmlyZUVycm9yIC0gRXZlbnQgaGFuZGxlciBvbiB3aGlsZSB0byBmaXJlIGVycm9yIGV2ZW50LlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIGhpdCB0ZXN0IGlzIGF2YWlsYWJsZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGlzQXZhaWxhYmxlKGNhbGxiYWNrLCBmaXJlRXJyb3IpIHtcbiAgICAgICAgbGV0IGVycjtcblxuICAgICAgICBpZiAoIXRoaXMuX3N1cHBvcnRlZClcbiAgICAgICAgICAgIGVyciA9IG5ldyBFcnJvcignWFIgSGl0VGVzdCBpcyBub3Qgc3VwcG9ydGVkJyk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKVxuICAgICAgICAgICAgZXJyID0gbmV3IEVycm9yKCdYUiBTZXNzaW9uIGlzIG5vdCBzdGFydGVkICgxKScpO1xuXG4gICAgICAgIGlmICh0aGlzLm1hbmFnZXIudHlwZSAhPT0gWFJUWVBFX0FSKVxuICAgICAgICAgICAgZXJyID0gbmV3IEVycm9yKCdYUiBIaXRUZXN0IGlzIGF2YWlsYWJsZSBvbmx5IGZvciBBUicpO1xuXG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIGlmIChmaXJlRXJyb3IpIGZpcmVFcnJvci5maXJlKCdlcnJvcicsIGVycik7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBdHRlbXB0cyB0byBzdGFydCBoaXQgdGVzdCB3aXRoIHByb3ZpZGVkIHJlZmVyZW5jZSBzcGFjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBvYmplY3QgZm9yIHBhc3NpbmcgYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5zcGFjZVR5cGVdIC0gUmVmZXJlbmNlIHNwYWNlIHR5cGUuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIFhSU1BBQ0VfVklFV0VSfS4gQ2FuIGJlIG9uZSBvZiB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9WSUVXRVJ9OiBWaWV3ZXIgLSBoaXQgdGVzdCB3aWxsIGJlIGZhY2luZyByZWxhdGl2ZSB0byB2aWV3ZXJzIHNwYWNlLlxuICAgICAqIC0ge0BsaW5rIFhSU1BBQ0VfTE9DQUx9OiBMb2NhbCAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpbiBuZWFyIHRoZVxuICAgICAqIHZpZXdlciBhdCB0aGUgdGltZSBvZiBjcmVhdGlvbi5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0xPQ0FMRkxPT1J9OiBMb2NhbCBGbG9vciAtIHJlcHJlc2VudHMgYSB0cmFja2luZyBzcGFjZSB3aXRoIGEgbmF0aXZlIG9yaWdpblxuICAgICAqIGF0IHRoZSBmbG9vciBpbiBhIHNhZmUgcG9zaXRpb24gZm9yIHRoZSB1c2VyIHRvIHN0YW5kLiBUaGUgeSBheGlzIGVxdWFscyAwIGF0IGZsb29yIGxldmVsLlxuICAgICAqIEZsb29yIGxldmVsIHZhbHVlIG1pZ2h0IGJlIGVzdGltYXRlZCBieSB0aGUgdW5kZXJseWluZyBwbGF0Zm9ybS5cbiAgICAgKiAtIHtAbGluayBYUlNQQUNFX0JPVU5ERURGTE9PUn06IEJvdW5kZWQgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBpdHMgbmF0aXZlXG4gICAgICogb3JpZ2luIGF0IHRoZSBmbG9vciwgd2hlcmUgdGhlIHVzZXIgaXMgZXhwZWN0ZWQgdG8gbW92ZSB3aXRoaW4gYSBwcmUtZXN0YWJsaXNoZWQgYm91bmRhcnkuXG4gICAgICogLSB7QGxpbmsgWFJTUEFDRV9VTkJPVU5ERUR9OiBVbmJvdW5kZWQgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2hlcmUgdGhlIHVzZXIgaXNcbiAgICAgKiBleHBlY3RlZCB0byBtb3ZlIGZyZWVseSBhcm91bmQgdGhlaXIgZW52aXJvbm1lbnQsIHBvdGVudGlhbGx5IGxvbmcgZGlzdGFuY2VzIGZyb20gdGhlaXJcbiAgICAgKiBzdGFydGluZyBwb2ludC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5wcm9maWxlXSAtIGlmIGhpdCB0ZXN0IHNvdXJjZSBtZWFudCB0byBtYXRjaCBpbnB1dCBzb3VyY2UgaW5zdGVhZFxuICAgICAqIG9mIHJlZmVyZW5jZSBzcGFjZSwgdGhlbiBuYW1lIG9mIHByb2ZpbGUgb2YgdGhlIHtAbGluayBYcklucHV0U291cmNlfSBzaG91bGQgYmUgcHJvdmlkZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gW29wdGlvbnMuZW50aXR5VHlwZXNdIC0gT3B0aW9uYWwgbGlzdCBvZiB1bmRlcmx5aW5nIGVudGl0eSB0eXBlcyBhZ2FpbnN0XG4gICAgICogd2hpY2ggaGl0IHRlc3RzIHdpbGwgYmUgcGVyZm9ybWVkLiBEZWZhdWx0cyB0byBbIHtAbGluayBYUlRSQUNLQUJMRV9QTEFORX0gXS4gQ2FuIGJlIGFueVxuICAgICAqIGNvbWJpbmF0aW9uIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBYUlRSQUNLQUJMRV9QT0lOVH06IFBvaW50IC0gaW5kaWNhdGVzIHRoYXQgdGhlIGhpdCB0ZXN0IHJlc3VsdHMgd2lsbCBiZSBjb21wdXRlZFxuICAgICAqIGJhc2VkIG9uIHRoZSBmZWF0dXJlIHBvaW50cyBkZXRlY3RlZCBieSB0aGUgdW5kZXJseWluZyBBdWdtZW50ZWQgUmVhbGl0eSBzeXN0ZW0uXG4gICAgICogLSB7QGxpbmsgWFJUUkFDS0FCTEVfUExBTkV9OiBQbGFuZSAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBiYXNlZCBvbiB0aGUgcGxhbmVzIGRldGVjdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIEF1Z21lbnRlZCBSZWFsaXR5IHN5c3RlbS5cbiAgICAgKiAtIHtAbGluayBYUlRSQUNLQUJMRV9NRVNIfTogTWVzaCAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWRcbiAgICAgKiBiYXNlZCBvbiB0aGUgbWVzaGVzIGRldGVjdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIEF1Z21lbnRlZCBSZWFsaXR5IHN5c3RlbS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmF5fSBbb3B0aW9ucy5vZmZzZXRSYXldIC0gT3B0aW9uYWwgcmF5IGJ5IHdoaWNoIGhpdCB0ZXN0IHJheSBjYW4gYmUgb2Zmc2V0LlxuICAgICAqIEBwYXJhbSB7WHJIaXRUZXN0U3RhcnRDYWxsYmFja30gW29wdGlvbnMuY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIG9uY2VcbiAgICAgKiBoaXQgdGVzdCBzb3VyY2UgaXMgY3JlYXRlZCBvciBmYWlsZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuaGl0VGVzdC5zdGFydCh7XG4gICAgICogICAgIHNwYWNlVHlwZTogcGMuWFJTUEFDRV9WSUVXRVIsXG4gICAgICogICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoZXJyLCBoaXRUZXN0U291cmNlKSB7XG4gICAgICogICAgICAgICBpZiAoZXJyKSByZXR1cm47XG4gICAgICogICAgICAgICBoaXRUZXN0U291cmNlLm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocG9zaXRpb24sIHJvdGF0aW9uKSB7XG4gICAgICogICAgICAgICAgICAgLy8gcG9zaXRpb24gYW5kIHJvdGF0aW9uIG9mIGhpdCB0ZXN0IHJlc3VsdFxuICAgICAqICAgICAgICAgICAgIC8vIGJhc2VkIG9uIFJheSBmYWNpbmcgZm9yd2FyZCBmcm9tIHRoZSBWaWV3ZXIgcmVmZXJlbmNlIHNwYWNlXG4gICAgICogICAgICAgICB9KTtcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIHJheSA9IG5ldyBwYy5SYXkobmV3IHBjLlZlYzMoMCwgMCwgMCksIG5ldyBwYy5WZWMzKDAsIC0xLCAwKSk7XG4gICAgICogYXBwLnhyLmhpdFRlc3Quc3RhcnQoe1xuICAgICAqICAgICBzcGFjZVR5cGU6IHBjLlhSU1BBQ0VfTE9DQUwsXG4gICAgICogICAgIG9mZnNldFJheTogcmF5LFxuICAgICAqICAgICBjYWxsYmFjazogZnVuY3Rpb24gKGVyciwgaGl0VGVzdFNvdXJjZSkge1xuICAgICAqICAgICAgICAgLy8gaGl0IHRlc3Qgc291cmNlIHRoYXQgd2lsbCBzYW1wbGUgcmVhbCB3b3JsZCBnZW9tZXRyeSBzdHJhaWdodCBkb3duXG4gICAgICogICAgICAgICAvLyBmcm9tIHRoZSBwb3NpdGlvbiB3aGVyZSBBUiBzZXNzaW9uIHN0YXJ0ZWRcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLmhpdFRlc3Quc3RhcnQoe1xuICAgICAqICAgICBwcm9maWxlOiAnZ2VuZXJpYy10b3VjaHNjcmVlbicsXG4gICAgICogICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoZXJyLCBoaXRUZXN0U291cmNlKSB7XG4gICAgICogICAgICAgICBpZiAoZXJyKSByZXR1cm47XG4gICAgICogICAgICAgICBoaXRUZXN0U291cmNlLm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocG9zaXRpb24sIHJvdGF0aW9uLCBpbnB1dFNvdXJjZSkge1xuICAgICAqICAgICAgICAgICAgIC8vIHBvc2l0aW9uIGFuZCByb3RhdGlvbiBvZiBoaXQgdGVzdCByZXN1bHRcbiAgICAgKiAgICAgICAgICAgICAvLyB0aGF0IHdpbGwgYmUgY3JlYXRlZCBmcm9tIHRvdWNoIG9uIG1vYmlsZSBkZXZpY2VzXG4gICAgICogICAgICAgICB9KTtcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHN0YXJ0KG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBpZiAoIXRoaXMuaXNBdmFpbGFibGUob3B0aW9ucy5jYWxsYmFjaywgdGhpcykpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLnByb2ZpbGUgJiYgIW9wdGlvbnMuc3BhY2VUeXBlKVxuICAgICAgICAgICAgb3B0aW9ucy5zcGFjZVR5cGUgPSBYUlNQQUNFX1ZJRVdFUjtcblxuICAgICAgICBsZXQgeHJSYXk7XG4gICAgICAgIGNvbnN0IG9mZnNldFJheSA9IG9wdGlvbnMub2Zmc2V0UmF5O1xuICAgICAgICBpZiAob2Zmc2V0UmF5KSB7XG4gICAgICAgICAgICBjb25zdCBvcmlnaW4gPSBuZXcgRE9NUG9pbnQob2Zmc2V0UmF5Lm9yaWdpbi54LCBvZmZzZXRSYXkub3JpZ2luLnksIG9mZnNldFJheS5vcmlnaW4ueiwgMS4wKTtcbiAgICAgICAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IG5ldyBET01Qb2ludChvZmZzZXRSYXkuZGlyZWN0aW9uLngsIG9mZnNldFJheS5kaXJlY3Rpb24ueSwgb2Zmc2V0UmF5LmRpcmVjdGlvbi56LCAwLjApO1xuICAgICAgICAgICAgeHJSYXkgPSBuZXcgWFJSYXkob3JpZ2luLCBkaXJlY3Rpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBvcHRpb25zLmNhbGxiYWNrO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnNwYWNlVHlwZSkge1xuICAgICAgICAgICAgdGhpcy5fc2Vzc2lvbi5yZXF1ZXN0UmVmZXJlbmNlU3BhY2Uob3B0aW9ucy5zcGFjZVR5cGUpLnRoZW4oKHJlZmVyZW5jZVNwYWNlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9zZXNzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVyciA9IG5ldyBFcnJvcignWFIgU2Vzc2lvbiBpcyBub3Qgc3RhcnRlZCAoMiknKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX3Nlc3Npb24ucmVxdWVzdEhpdFRlc3RTb3VyY2Uoe1xuICAgICAgICAgICAgICAgICAgICBzcGFjZTogcmVmZXJlbmNlU3BhY2UsXG4gICAgICAgICAgICAgICAgICAgIGVudGl0eVR5cGVzOiBvcHRpb25zLmVudGl0eVR5cGVzIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0UmF5OiB4clJheVxuICAgICAgICAgICAgICAgIH0pLnRoZW4oKHhySGl0VGVzdFNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkhpdFRlc3RTb3VyY2UoeHJIaXRUZXN0U291cmNlLCBmYWxzZSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGV4KTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGV4KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChleCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2soZXgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnZXJyb3InLCBleCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3Nlc3Npb24ucmVxdWVzdEhpdFRlc3RTb3VyY2VGb3JUcmFuc2llbnRJbnB1dCh7XG4gICAgICAgICAgICAgICAgcHJvZmlsZTogb3B0aW9ucy5wcm9maWxlLFxuICAgICAgICAgICAgICAgIGVudGl0eVR5cGVzOiBvcHRpb25zLmVudGl0eVR5cGVzIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBvZmZzZXRSYXk6IHhyUmF5XG4gICAgICAgICAgICB9KS50aGVuKCh4ckhpdFRlc3RTb3VyY2UpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9vbkhpdFRlc3RTb3VyY2UoeHJIaXRUZXN0U291cmNlLCB0cnVlLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKGV4KTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hSSGl0VGVzdFNvdXJjZX0geHJIaXRUZXN0U291cmNlIC0gSGl0IHRlc3Qgc291cmNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdHJhbnNpZW50IC0gVHJ1ZSBpZiBoaXQgdGVzdCBzb3VyY2UgaXMgY3JlYXRlZCBmcm9tIHRyYW5zaWVudCBpbnB1dCBzb3VyY2UuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayBjYWxsZWQgb25jZSBoaXQgdGVzdCBzb3VyY2UgaXMgY3JlYXRlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkhpdFRlc3RTb3VyY2UoeHJIaXRUZXN0U291cmNlLCB0cmFuc2llbnQsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Vzc2lvbikge1xuICAgICAgICAgICAgeHJIaXRUZXN0U291cmNlLmNhbmNlbCgpO1xuICAgICAgICAgICAgY29uc3QgZXJyID0gbmV3IEVycm9yKCdYUiBTZXNzaW9uIGlzIG5vdCBzdGFydGVkICgzKScpO1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcicsIGVycik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoaXRUZXN0U291cmNlID0gbmV3IFhySGl0VGVzdFNvdXJjZSh0aGlzLm1hbmFnZXIsIHhySGl0VGVzdFNvdXJjZSwgdHJhbnNpZW50KTtcbiAgICAgICAgdGhpcy5zb3VyY2VzLnB1c2goaGl0VGVzdFNvdXJjZSk7XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhudWxsLCBoaXRUZXN0U291cmNlKTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQnLCBoaXRUZXN0U291cmNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0geyp9IGZyYW1lIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGZyYW1lKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zb3VyY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnNvdXJjZXNbaV0udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgQVIgSGl0IFRlc3QgaXMgc3VwcG9ydGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHN1cHBvcnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N1cHBvcnRlZDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhySGl0VGVzdCB9O1xuIl0sIm5hbWVzIjpbIlhySGl0VGVzdCIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwibWFuYWdlciIsIl9zdXBwb3J0ZWQiLCJwbGF0Zm9ybSIsImJyb3dzZXIiLCJ3aW5kb3ciLCJYUlNlc3Npb24iLCJwcm90b3R5cGUiLCJyZXF1ZXN0SGl0VGVzdFNvdXJjZSIsIl9zZXNzaW9uIiwic291cmNlcyIsIm9uIiwiX29uU2Vzc2lvblN0YXJ0IiwiX29uU2Vzc2lvbkVuZCIsInR5cGUiLCJYUlRZUEVfQVIiLCJzZXNzaW9uIiwiaSIsImxlbmd0aCIsIm9uU3RvcCIsImlzQXZhaWxhYmxlIiwiY2FsbGJhY2siLCJmaXJlRXJyb3IiLCJlcnIiLCJFcnJvciIsImZpcmUiLCJzdGFydCIsIm9wdGlvbnMiLCJwcm9maWxlIiwic3BhY2VUeXBlIiwiWFJTUEFDRV9WSUVXRVIiLCJ4clJheSIsIm9mZnNldFJheSIsIm9yaWdpbiIsIkRPTVBvaW50IiwieCIsInkiLCJ6IiwiZGlyZWN0aW9uIiwiWFJSYXkiLCJyZXF1ZXN0UmVmZXJlbmNlU3BhY2UiLCJ0aGVuIiwicmVmZXJlbmNlU3BhY2UiLCJzcGFjZSIsImVudGl0eVR5cGVzIiwidW5kZWZpbmVkIiwieHJIaXRUZXN0U291cmNlIiwiX29uSGl0VGVzdFNvdXJjZSIsImNhdGNoIiwiZXgiLCJyZXF1ZXN0SGl0VGVzdFNvdXJjZUZvclRyYW5zaWVudElucHV0IiwidHJhbnNpZW50IiwiY2FuY2VsIiwiaGl0VGVzdFNvdXJjZSIsIlhySGl0VGVzdFNvdXJjZSIsInB1c2giLCJ1cGRhdGUiLCJmcmFtZSIsInN1cHBvcnRlZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQXdCQSxNQUFNQSxTQUFOLFNBQXdCQyxZQUF4QixDQUFxQztFQWdDakNDLFdBQVcsQ0FBQ0MsT0FBRCxFQUFVO0FBQ2pCLElBQUEsS0FBQSxFQUFBLENBQUE7QUFEaUIsSUFBQSxJQUFBLENBM0JyQkEsT0EyQnFCLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FyQnJCQyxVQXFCcUIsR0FyQlJDLFFBQVEsQ0FBQ0MsT0FBVCxJQUFvQixDQUFDLEVBQUVDLE1BQU0sQ0FBQ0MsU0FBUCxJQUFvQkQsTUFBTSxDQUFDQyxTQUFQLENBQWlCQyxTQUFqQixDQUEyQkMsb0JBQWpELENBcUJiLENBQUE7SUFBQSxJQWZyQkMsQ0FBQUEsUUFlcUIsR0FmVixJQWVVLENBQUE7SUFBQSxJQVJyQkMsQ0FBQUEsT0FRcUIsR0FSWCxFQVFXLENBQUE7SUFHakIsSUFBS1QsQ0FBQUEsT0FBTCxHQUFlQSxPQUFmLENBQUE7O0lBRUEsSUFBSSxJQUFBLENBQUtDLFVBQVQsRUFBcUI7TUFDakIsSUFBS0QsQ0FBQUEsT0FBTCxDQUFhVSxFQUFiLENBQWdCLE9BQWhCLEVBQXlCLElBQUEsQ0FBS0MsZUFBOUIsRUFBK0MsSUFBL0MsQ0FBQSxDQUFBO01BQ0EsSUFBS1gsQ0FBQUEsT0FBTCxDQUFhVSxFQUFiLENBQWdCLEtBQWhCLEVBQXVCLElBQUEsQ0FBS0UsYUFBNUIsRUFBMkMsSUFBM0MsQ0FBQSxDQUFBO0FBQ0gsS0FBQTtBQUNKLEdBQUE7O0FBZ0RERCxFQUFBQSxlQUFlLEdBQUc7QUFDZCxJQUFBLElBQUksS0FBS1gsT0FBTCxDQUFhYSxJQUFiLEtBQXNCQyxTQUExQixF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
