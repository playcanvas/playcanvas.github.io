/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../../core/platform.js';
import { http, Http } from '../../platform/net/http.js';
import { Bundle } from '../bundle/bundle.js';
import { UntarWorker, Untar } from './untar.js';

class BundleHandler {

  constructor(app) {
    this.handlerType = "bundle";
    this._assets = app.assets;
    this._worker = null;
    this.maxRetries = 0;
  }
  load(url, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }
    const self = this;
    http.get(url.load, {
      responseType: Http.ResponseType.ARRAY_BUFFER,
      retry: this.maxRetries > 0,
      maxRetries: this.maxRetries
    }, function (err, response) {
      if (!err) {
        try {
          self._untar(response, callback);
        } catch (ex) {
          callback('Error loading bundle resource ' + url.original + ': ' + ex);
        }
      } else {
        callback('Error loading bundle resource ' + url.original + ': ' + err);
      }
    });
  }
  _untar(response, callback) {
    const self = this;

    if (platform.workers) {
      if (!self._worker) {
        self._worker = new UntarWorker(self._assets.prefix);
      }
      self._worker.untar(response, function (err, files) {
        callback(err, files);

        if (!self._worker.hasPendingRequests()) {
          self._worker.destroy();
          self._worker = null;
        }
      });
    } else {
      const archive = new Untar(response);
      const files = archive.untar(self._assets.prefix);
      callback(null, files);
    }
  }
  open(url, data) {
    return new Bundle(data);
  }
  patch(asset, assets) {}
}

export { BundleHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2J1bmRsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuXG5pbXBvcnQgeyBodHRwLCBIdHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQgeyBCdW5kbGUgfSBmcm9tICcuLi8uLi9mcmFtZXdvcmsvYnVuZGxlL2J1bmRsZS5qcyc7XG5cbmltcG9ydCB7IFVudGFyLCBVbnRhcldvcmtlciB9IGZyb20gJy4vdW50YXIuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gQXBwQmFzZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vaGFuZGxlci5qcycpLlJlc291cmNlSGFuZGxlcn0gUmVzb3VyY2VIYW5kbGVyICovXG5cbi8qKlxuICogTG9hZHMgQnVuZGxlIEFzc2V0cy5cbiAqXG4gKiBAaW1wbGVtZW50cyB7UmVzb3VyY2VIYW5kbGVyfVxuICogQGlnbm9yZVxuICovXG5jbGFzcyBCdW5kbGVIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBUeXBlIG9mIHRoZSByZXNvdXJjZSB0aGUgaGFuZGxlciBoYW5kbGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBoYW5kbGVyVHlwZSA9IFwiYnVuZGxlXCI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQnVuZGxlSGFuZGxlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXBwQmFzZX0gYXBwIC0gVGhlIHJ1bm5pbmcge0BsaW5rIEFwcEJhc2V9LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgdGhpcy5fYXNzZXRzID0gYXBwLmFzc2V0cztcbiAgICAgICAgdGhpcy5fd29ya2VyID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gMDtcbiAgICB9XG5cbiAgICBsb2FkKHVybCwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHR5cGVvZiB1cmwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB1cmwgPSB7XG4gICAgICAgICAgICAgICAgbG9hZDogdXJsLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsOiB1cmxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICBodHRwLmdldCh1cmwubG9hZCwge1xuICAgICAgICAgICAgcmVzcG9uc2VUeXBlOiBIdHRwLlJlc3BvbnNlVHlwZS5BUlJBWV9CVUZGRVIsXG4gICAgICAgICAgICByZXRyeTogdGhpcy5tYXhSZXRyaWVzID4gMCxcbiAgICAgICAgICAgIG1heFJldHJpZXM6IHRoaXMubWF4UmV0cmllc1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBzZWxmLl91bnRhcihyZXNwb25zZSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCdFcnJvciBsb2FkaW5nIGJ1bmRsZSByZXNvdXJjZSAnICsgdXJsLm9yaWdpbmFsICsgJzogJyArIGV4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCdFcnJvciBsb2FkaW5nIGJ1bmRsZSByZXNvdXJjZSAnICsgdXJsLm9yaWdpbmFsICsgJzogJyArIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF91bnRhcihyZXNwb25zZSwgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgLy8gdXNlIHdlYiB3b3JrZXJzIGlmIGF2YWlsYWJsZSBvdGhlcndpc2VcbiAgICAgICAgLy8gZmFsbGJhY2sgdG8gdW50YXInaW5nIGluIHRoZSBtYWluIHRocmVhZFxuICAgICAgICBpZiAocGxhdGZvcm0ud29ya2Vycykge1xuICAgICAgICAgICAgLy8gY3JlYXRlIHdlYiB3b3JrZXIgaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgICBpZiAoIXNlbGYuX3dvcmtlcikge1xuICAgICAgICAgICAgICAgIHNlbGYuX3dvcmtlciA9IG5ldyBVbnRhcldvcmtlcihzZWxmLl9hc3NldHMucHJlZml4KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2VsZi5fd29ya2VyLnVudGFyKHJlc3BvbnNlLCBmdW5jdGlvbiAoZXJyLCBmaWxlcykge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgZmlsZXMpO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSBubyBtb3JlIHJlcXVlc3RzIGZvciB0aGlzIHdvcmtlciB0aGVuXG4gICAgICAgICAgICAgICAgLy8gZGVzdHJveSBpdFxuICAgICAgICAgICAgICAgIGlmICghc2VsZi5fd29ya2VyLmhhc1BlbmRpbmdSZXF1ZXN0cygpKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX3dvcmtlci5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYuX3dvcmtlciA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBhcmNoaXZlID0gbmV3IFVudGFyKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gYXJjaGl2ZS51bnRhcihzZWxmLl9hc3NldHMucHJlZml4KTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGZpbGVzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhKSB7XG4gICAgICAgIHJldHVybiBuZXcgQnVuZGxlKGRhdGEpO1xuICAgIH1cblxuICAgIHBhdGNoKGFzc2V0LCBhc3NldHMpIHtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEJ1bmRsZUhhbmRsZXIgfTtcbiJdLCJuYW1lcyI6WyJCdW5kbGVIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJoYW5kbGVyVHlwZSIsIl9hc3NldHMiLCJhc3NldHMiLCJfd29ya2VyIiwibWF4UmV0cmllcyIsImxvYWQiLCJ1cmwiLCJjYWxsYmFjayIsIm9yaWdpbmFsIiwic2VsZiIsImh0dHAiLCJnZXQiLCJyZXNwb25zZVR5cGUiLCJIdHRwIiwiUmVzcG9uc2VUeXBlIiwiQVJSQVlfQlVGRkVSIiwicmV0cnkiLCJlcnIiLCJyZXNwb25zZSIsIl91bnRhciIsImV4IiwicGxhdGZvcm0iLCJ3b3JrZXJzIiwiVW50YXJXb3JrZXIiLCJwcmVmaXgiLCJ1bnRhciIsImZpbGVzIiwiaGFzUGVuZGluZ1JlcXVlc3RzIiwiZGVzdHJveSIsImFyY2hpdmUiLCJVbnRhciIsIm9wZW4iLCJkYXRhIiwiQnVuZGxlIiwicGF0Y2giLCJhc3NldCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQWlCQSxNQUFNQSxhQUFhLENBQUM7O0VBY2hCQyxXQUFXLENBQUNDLEdBQUcsRUFBRTtJQUFBLElBUmpCQyxDQUFBQSxXQUFXLEdBQUcsUUFBUSxDQUFBO0FBU2xCLElBQUEsSUFBSSxDQUFDQyxPQUFPLEdBQUdGLEdBQUcsQ0FBQ0csTUFBTSxDQUFBO0lBQ3pCLElBQUksQ0FBQ0MsT0FBTyxHQUFHLElBQUksQ0FBQTtJQUNuQixJQUFJLENBQUNDLFVBQVUsR0FBRyxDQUFDLENBQUE7QUFDdkIsR0FBQTtBQUVBQyxFQUFBQSxJQUFJLENBQUNDLEdBQUcsRUFBRUMsUUFBUSxFQUFFO0FBQ2hCLElB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