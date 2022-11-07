/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../core/path.js';
import { Debug } from '../core/debug.js';
import { Http, http } from '../net/http.js';
import { hasAudioContext } from '../audio/capabilities.js';
import { Sound } from '../sound/sound.js';

const ie = function () {
  if (typeof window === 'undefined') {
    return false;
  }

  const ua = window.navigator.userAgent;
  const msie = ua.indexOf('MSIE ');

  if (msie > 0) {
    return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
  }

  const trident = ua.indexOf('Trident/');

  if (trident > 0) {
    const rv = ua.indexOf('rv:');
    return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
  }

  return false;
}();

const supportedExtensions = ['.ogg', '.mp3', '.wav', '.mp4a', '.m4a', '.mp4', '.aac', '.opus'];

class AudioHandler {
  constructor(app) {
    this.handlerType = "audio";
    this.manager = app.soundManager;
    Debug.assert(this.manager, "AudioSourceComponentSystem cannot be created witout sound manager");
    this.maxRetries = 0;
  }

  _isSupported(url) {
    const ext = path.getExtension(url);
    return supportedExtensions.indexOf(ext) > -1;
  }

  load(url, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }

    const success = function success(resource) {
      callback(null, new Sound(resource));
    };

    const error = function error(err) {
      let msg = 'Error loading audio url: ' + url.original;

      if (err) {
        msg += ': ' + (err.message || err);
      }

      console.warn(msg);
      callback(msg);
    };

    if (this._createSound) {
      if (!this._isSupported(url.original)) {
        error(`Audio format for ${url.original} not supported`);
        return;
      }

      this._createSound(url.load, success, error);
    } else {
      error(null);
    }
  }

  open(url, data) {
    return data;
  }

  patch(asset, assets) {}

  _createSound(url, success, error) {
    if (hasAudioContext()) {
      const manager = this.manager;

      if (!manager.context) {
        error('Audio manager has no audio context');
        return;
      }

      const options = {
        retry: this.maxRetries > 0,
        maxRetries: this.maxRetries
      };

      if (url.startsWith('blob:') || url.startsWith('data:')) {
        options.responseType = Http.ResponseType.ARRAY_BUFFER;
      }

      http.get(url, options, function (err, response) {
        if (err) {
          error(err);
          return;
        }

        manager.context.decodeAudioData(response, success, error);
      });
    } else {
      let audio = null;

      try {
        audio = new Audio();
      } catch (e) {
        error('No support for Audio element');
        return;
      }

      if (ie) {
        document.body.appendChild(audio);
      }

      const onReady = function onReady() {
        audio.removeEventListener('canplaythrough', onReady);

        if (ie) {
          document.body.removeChild(audio);
        }

        success(audio);
      };

      audio.onerror = function () {
        audio.onerror = null;

        if (ie) {
          document.body.removeChild(audio);
        }

        error();
      };

      audio.addEventListener('canplaythrough', onReady);
      audio.src = url;
    }
  }

}

export { AudioHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW8uanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9yZXNvdXJjZXMvYXVkaW8uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuXG5pbXBvcnQgeyBodHRwLCBIdHRwIH0gZnJvbSAnLi4vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQgeyBoYXNBdWRpb0NvbnRleHQgfSBmcm9tICcuLi9hdWRpby9jYXBhYmlsaXRpZXMuanMnO1xuXG5pbXBvcnQgeyBTb3VuZCB9IGZyb20gJy4uL3NvdW5kL3NvdW5kLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IEFwcEJhc2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2hhbmRsZXIuanMnKS5SZXNvdXJjZUhhbmRsZXJ9IFJlc291cmNlSGFuZGxlciAqL1xuXG4vLyBjaGVja3MgaWYgdXNlciBpcyBydW5uaW5nIElFXG5jb25zdCBpZSA9IChmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIC8vIE5vZGUuanMgPT4gcmV0dXJuIGZhbHNlXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgY29uc3QgdWEgPSB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudDtcblxuICAgIGNvbnN0IG1zaWUgPSB1YS5pbmRleE9mKCdNU0lFICcpO1xuICAgIGlmIChtc2llID4gMCkge1xuICAgICAgICAvLyBJRSAxMCBvciBvbGRlciA9PiByZXR1cm4gdmVyc2lvbiBudW1iZXJcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KHVhLnN1YnN0cmluZyhtc2llICsgNSwgdWEuaW5kZXhPZignLicsIG1zaWUpKSwgMTApO1xuICAgIH1cblxuICAgIGNvbnN0IHRyaWRlbnQgPSB1YS5pbmRleE9mKCdUcmlkZW50LycpO1xuICAgIGlmICh0cmlkZW50ID4gMCkge1xuICAgICAgICAvLyBJRSAxMSA9PiByZXR1cm4gdmVyc2lvbiBudW1iZXJcbiAgICAgICAgY29uc3QgcnYgPSB1YS5pbmRleE9mKCdydjonKTtcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KHVhLnN1YnN0cmluZyhydiArIDMsIHVhLmluZGV4T2YoJy4nLCBydikpLCAxMCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufSkoKTtcblxuY29uc3Qgc3VwcG9ydGVkRXh0ZW5zaW9ucyA9IFtcbiAgICAnLm9nZycsXG4gICAgJy5tcDMnLFxuICAgICcud2F2JyxcbiAgICAnLm1wNGEnLFxuICAgICcubTRhJyxcbiAgICAnLm1wNCcsXG4gICAgJy5hYWMnLFxuICAgICcub3B1cydcbl07XG5cbi8qKlxuICogUmVzb3VyY2UgaGFuZGxlciB1c2VkIGZvciBsb2FkaW5nIHtAbGluayBTb3VuZH0gcmVzb3VyY2VzLlxuICpcbiAqIEBpbXBsZW1lbnRzIHtSZXNvdXJjZUhhbmRsZXJ9XG4gKi9cbmNsYXNzIEF1ZGlvSGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVHlwZSBvZiB0aGUgcmVzb3VyY2UgdGhlIGhhbmRsZXIgaGFuZGxlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgaGFuZGxlclR5cGUgPSBcImF1ZGlvXCI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQXVkaW9IYW5kbGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcHBCYXNlfSBhcHAgLSBUaGUgcnVubmluZyB7QGxpbmsgQXBwQmFzZX0uXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGFwcCkge1xuICAgICAgICB0aGlzLm1hbmFnZXIgPSBhcHAuc291bmRNYW5hZ2VyO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5tYW5hZ2VyLCBcIkF1ZGlvU291cmNlQ29tcG9uZW50U3lzdGVtIGNhbm5vdCBiZSBjcmVhdGVkIHdpdG91dCBzb3VuZCBtYW5hZ2VyXCIpO1xuXG4gICAgICAgIHRoaXMubWF4UmV0cmllcyA9IDA7XG4gICAgfVxuXG4gICAgX2lzU3VwcG9ydGVkKHVybCkge1xuICAgICAgICBjb25zdCBleHQgPSBwYXRoLmdldEV4dGVuc2lvbih1cmwpO1xuXG4gICAgICAgIHJldHVybiBzdXBwb3J0ZWRFeHRlbnNpb25zLmluZGV4T2YoZXh0KSA+IC0xO1xuICAgIH1cblxuICAgIGxvYWQodXJsLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAodHlwZW9mIHVybCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHVybCA9IHtcbiAgICAgICAgICAgICAgICBsb2FkOiB1cmwsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWw6IHVybFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSBmdW5jdGlvbiAocmVzb3VyY2UpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIG5ldyBTb3VuZChyZXNvdXJjZSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGVycm9yID0gZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgbGV0IG1zZyA9ICdFcnJvciBsb2FkaW5nIGF1ZGlvIHVybDogJyArIHVybC5vcmlnaW5hbDtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBtc2cgKz0gJzogJyArIChlcnIubWVzc2FnZSB8fCBlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS53YXJuKG1zZyk7XG4gICAgICAgICAgICBjYWxsYmFjayhtc2cpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlmICh0aGlzLl9jcmVhdGVTb3VuZCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9pc1N1cHBvcnRlZCh1cmwub3JpZ2luYWwpKSB7XG4gICAgICAgICAgICAgICAgZXJyb3IoYEF1ZGlvIGZvcm1hdCBmb3IgJHt1cmwub3JpZ2luYWx9IG5vdCBzdXBwb3J0ZWRgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2NyZWF0ZVNvdW5kKHVybC5sb2FkLCBzdWNjZXNzLCBlcnJvcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlcnJvcihudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhKSB7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIHBhdGNoKGFzc2V0LCBhc3NldHMpIHtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkcyBhbiBhdWRpbyBhc3NldCB1c2luZyBhbiBBdWRpb0NvbnRleHQgYnkgVVJMIGFuZCBjYWxscyBzdWNjZXNzIG9yIGVycm9yIHdpdGggdGhlXG4gICAgICogY3JlYXRlZCByZXNvdXJjZSBvciBlcnJvciByZXNwZWN0aXZlbHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIHVybCBvZiB0aGUgYXVkaW8gYXNzZXQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gc3VjY2VzcyAtIEZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBpZiB0aGUgYXVkaW8gYXNzZXQgd2FzIGxvYWRlZCBvciBpZiB3ZVxuICAgICAqIGp1c3Qgd2FudCB0byBjb250aW51ZSB3aXRob3V0IGVycm9ycyBldmVuIGlmIHRoZSBhdWRpbyBpcyBub3QgbG9hZGVkLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGVycm9yIC0gRnVuY3Rpb24gdG8gYmUgY2FsbGVkIGlmIHRoZXJlIHdhcyBhbiBlcnJvciB3aGlsZSBsb2FkaW5nIHRoZVxuICAgICAqIGF1ZGlvIGFzc2V0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0ZVNvdW5kKHVybCwgc3VjY2VzcywgZXJyb3IpIHtcbiAgICAgICAgaWYgKGhhc0F1ZGlvQ29udGV4dCgpKSB7XG4gICAgICAgICAgICBjb25zdCBtYW5hZ2VyID0gdGhpcy5tYW5hZ2VyO1xuXG4gICAgICAgICAgICBpZiAoIW1hbmFnZXIuY29udGV4dCkge1xuICAgICAgICAgICAgICAgIGVycm9yKCdBdWRpbyBtYW5hZ2VyIGhhcyBubyBhdWRpbyBjb250ZXh0Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGEgYmxvYiBVUkwgd2UgbmVlZCB0byBzZXQgdGhlIHJlc3BvbnNlIHR5cGUgdG8gYXJyYXlidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgcmV0cnk6IHRoaXMubWF4UmV0cmllcyA+IDAsXG4gICAgICAgICAgICAgICAgbWF4UmV0cmllczogdGhpcy5tYXhSZXRyaWVzXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJ2Jsb2I6JykgfHwgdXJsLnN0YXJ0c1dpdGgoJ2RhdGE6JykpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnJlc3BvbnNlVHlwZSA9IEh0dHAuUmVzcG9uc2VUeXBlLkFSUkFZX0JVRkZFUjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaHR0cC5nZXQodXJsLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3IoZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1hbmFnZXIuY29udGV4dC5kZWNvZGVBdWRpb0RhdGEocmVzcG9uc2UsIHN1Y2Nlc3MsIGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IGF1ZGlvID0gbnVsbDtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhdWRpbyA9IG5ldyBBdWRpbygpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIC8vIFNvbWUgd2luZG93cyBwbGF0Zm9ybXMgd2lsbCByZXBvcnQgQXVkaW8gYXMgYXZhaWxhYmxlLCB0aGVuIHRocm93IGFuIGV4Y2VwdGlvbiB3aGVuXG4gICAgICAgICAgICAgICAgLy8gdGhlIG9iamVjdCBpcyBjcmVhdGVkLlxuICAgICAgICAgICAgICAgIGVycm9yKCdObyBzdXBwb3J0IGZvciBBdWRpbyBlbGVtZW50Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhdWRpbyBuZWVkcyB0byBiZSBhZGRlZCB0byB0aGUgRE9NIGZvciBJRVxuICAgICAgICAgICAgaWYgKGllKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhdWRpbyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG9uUmVhZHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgYXVkaW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2FucGxheXRocm91Z2gnLCBvblJlYWR5KTtcblxuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBmcm9tIERPTSBubyBsb25nZXIgbmVjZXNzYXJ5XG4gICAgICAgICAgICAgICAgaWYgKGllKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoYXVkaW8pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MoYXVkaW8pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgYXVkaW8ub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBhdWRpby5vbmVycm9yID0gbnVsbDtcblxuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBmcm9tIERPTSBubyBsb25nZXIgbmVjZXNzYXJ5XG4gICAgICAgICAgICAgICAgaWYgKGllKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoYXVkaW8pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVycm9yKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBhdWRpby5hZGRFdmVudExpc3RlbmVyKCdjYW5wbGF5dGhyb3VnaCcsIG9uUmVhZHkpO1xuICAgICAgICAgICAgYXVkaW8uc3JjID0gdXJsO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBBdWRpb0hhbmRsZXIgfTtcbiJdLCJuYW1lcyI6WyJpZSIsIndpbmRvdyIsInVhIiwibmF2aWdhdG9yIiwidXNlckFnZW50IiwibXNpZSIsImluZGV4T2YiLCJwYXJzZUludCIsInN1YnN0cmluZyIsInRyaWRlbnQiLCJydiIsInN1cHBvcnRlZEV4dGVuc2lvbnMiLCJBdWRpb0hhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsImhhbmRsZXJUeXBlIiwibWFuYWdlciIsInNvdW5kTWFuYWdlciIsIkRlYnVnIiwiYXNzZXJ0IiwibWF4UmV0cmllcyIsIl9pc1N1cHBvcnRlZCIsInVybCIsImV4dCIsInBhdGgiLCJnZXRFeHRlbnNpb24iLCJsb2FkIiwiY2FsbGJhY2siLCJvcmlnaW5hbCIsInN1Y2Nlc3MiLCJyZXNvdXJjZSIsIlNvdW5kIiwiZXJyb3IiLCJlcnIiLCJtc2ciLCJtZXNzYWdlIiwiY29uc29sZSIsIndhcm4iLCJfY3JlYXRlU291bmQiLCJvcGVuIiwiZGF0YSIsInBhdGNoIiwiYXNzZXQiLCJhc3NldHMiLCJoYXNBdWRpb0NvbnRleHQiLCJjb250ZXh0Iiwib3B0aW9ucyIsInJldHJ5Iiwic3RhcnRzV2l0aCIsInJlc3BvbnNlVHlwZSIsIkh0dHAiLCJSZXNwb25zZVR5cGUiLCJBUlJBWV9CVUZGRVIiLCJodHRwIiwiZ2V0IiwicmVzcG9uc2UiLCJkZWNvZGVBdWRpb0RhdGEiLCJhdWRpbyIsIkF1ZGlvIiwiZSIsImRvY3VtZW50IiwiYm9keSIsImFwcGVuZENoaWxkIiwib25SZWFkeSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJyZW1vdmVDaGlsZCIsIm9uZXJyb3IiLCJhZGRFdmVudExpc3RlbmVyIiwic3JjIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQWFBLE1BQU1BLEVBQUUsR0FBSSxZQUFZO0FBQ3BCLEVBQUEsSUFBSSxPQUFPQyxNQUFQLEtBQWtCLFdBQXRCLEVBQW1DO0FBRS9CLElBQUEsT0FBTyxLQUFQLENBQUE7QUFDSCxHQUFBOztBQUNELEVBQUEsTUFBTUMsRUFBRSxHQUFHRCxNQUFNLENBQUNFLFNBQVAsQ0FBaUJDLFNBQTVCLENBQUE7QUFFQSxFQUFBLE1BQU1DLElBQUksR0FBR0gsRUFBRSxDQUFDSSxPQUFILENBQVcsT0FBWCxDQUFiLENBQUE7O0VBQ0EsSUFBSUQsSUFBSSxHQUFHLENBQVgsRUFBYztJQUVWLE9BQU9FLFFBQVEsQ0FBQ0wsRUFBRSxDQUFDTSxTQUFILENBQWFILElBQUksR0FBRyxDQUFwQixFQUF1QkgsRUFBRSxDQUFDSSxPQUFILENBQVcsR0FBWCxFQUFnQkQsSUFBaEIsQ0FBdkIsQ0FBRCxFQUFnRCxFQUFoRCxDQUFmLENBQUE7QUFDSCxHQUFBOztBQUVELEVBQUEsTUFBTUksT0FBTyxHQUFHUCxFQUFFLENBQUNJLE9BQUgsQ0FBVyxVQUFYLENBQWhCLENBQUE7O0VBQ0EsSUFBSUcsT0FBTyxHQUFHLENBQWQsRUFBaUI7QUFFYixJQUFBLE1BQU1DLEVBQUUsR0FBR1IsRUFBRSxDQUFDSSxPQUFILENBQVcsS0FBWCxDQUFYLENBQUE7SUFDQSxPQUFPQyxRQUFRLENBQUNMLEVBQUUsQ0FBQ00sU0FBSCxDQUFhRSxFQUFFLEdBQUcsQ0FBbEIsRUFBcUJSLEVBQUUsQ0FBQ0ksT0FBSCxDQUFXLEdBQVgsRUFBZ0JJLEVBQWhCLENBQXJCLENBQUQsRUFBNEMsRUFBNUMsQ0FBZixDQUFBO0FBQ0gsR0FBQTs7QUFFRCxFQUFBLE9BQU8sS0FBUCxDQUFBO0FBQ0gsQ0FyQlUsRUFBWCxDQUFBOztBQXVCQSxNQUFNQyxtQkFBbUIsR0FBRyxDQUN4QixNQUR3QixFQUV4QixNQUZ3QixFQUd4QixNQUh3QixFQUl4QixPQUp3QixFQUt4QixNQUx3QixFQU14QixNQU53QixFQU94QixNQVB3QixFQVF4QixPQVJ3QixDQUE1QixDQUFBOztBQWdCQSxNQUFNQyxZQUFOLENBQW1CO0VBY2ZDLFdBQVcsQ0FBQ0MsR0FBRCxFQUFNO0lBQUEsSUFSakJDLENBQUFBLFdBUWlCLEdBUkgsT0FRRyxDQUFBO0FBQ2IsSUFBQSxJQUFBLENBQUtDLE9BQUwsR0FBZUYsR0FBRyxDQUFDRyxZQUFuQixDQUFBO0FBQ0FDLElBQUFBLEtBQUssQ0FBQ0MsTUFBTixDQUFhLElBQUtILENBQUFBLE9BQWxCLEVBQTJCLG1FQUEzQixDQUFBLENBQUE7SUFFQSxJQUFLSSxDQUFBQSxVQUFMLEdBQWtCLENBQWxCLENBQUE7QUFDSCxHQUFBOztFQUVEQyxZQUFZLENBQUNDLEdBQUQsRUFBTTtBQUNkLElBQUEsTUFBTUMsR0FBRyxHQUFHQyxJQUFJLENBQUNDLFlBQUwsQ0FBa0JILEdBQWxCLENBQVosQ0FBQTtBQUVBLElBQUEsT0FBT1gsbUJBQW1CLENBQUNMLE9BQXBCLENBQTRCaUIsR0FBNUIsQ0FBQSxHQUFtQyxDQUFDLENBQTNDLENBQUE7QUFDSCxHQUFBOztBQUVERyxFQUFBQSxJQUFJLENBQUNKLEdBQUQsRUFBTUssUUFBTixFQUFnQjtBQUNoQixJQUFBLElBQUksT0FBT0wsR0FBUCxLQUFlLFFBQW5CLEVBQTZCO0FBQ3pCQSxNQUFBQSxHQUFHLEdBQUc7QUFDRkksUUFBQUEsSUFBSSxFQUFFSixHQURKO0FBRUZNLFFBQUFBLFFBQVEsRUFBRU4sR0FBQUE7T0FGZCxDQUFBO0FBSUgsS0FBQTs7QUFFRCxJQUFBLE1BQU1PLE9BQU8sR0FBRyxTQUFWQSxPQUFVLENBQVVDLFFBQVYsRUFBb0I7TUFDaENILFFBQVEsQ0FBQyxJQUFELEVBQU8sSUFBSUksS0FBSixDQUFVRCxRQUFWLENBQVAsQ0FBUixDQUFBO0tBREosQ0FBQTs7QUFJQSxJQUFBLE1BQU1FLEtBQUssR0FBRyxTQUFSQSxLQUFRLENBQVVDLEdBQVYsRUFBZTtBQUN6QixNQUFBLElBQUlDLEdBQUcsR0FBRywyQkFBOEJaLEdBQUFBLEdBQUcsQ0FBQ00sUUFBNUMsQ0FBQTs7QUFDQSxNQUFBLElBQUlLLEdBQUosRUFBUztBQUNMQyxRQUFBQSxHQUFHLElBQUksSUFBUUQsSUFBQUEsR0FBRyxDQUFDRSxPQUFKLElBQWVGLEdBQXZCLENBQVAsQ0FBQTtBQUNILE9BQUE7O01BQ0RHLE9BQU8sQ0FBQ0MsSUFBUixDQUFhSCxHQUFiLENBQUEsQ0FBQTtNQUNBUCxRQUFRLENBQUNPLEdBQUQsQ0FBUixDQUFBO0tBTkosQ0FBQTs7SUFTQSxJQUFJLElBQUEsQ0FBS0ksWUFBVCxFQUF1QjtNQUNuQixJQUFJLENBQUMsS0FBS2pCLFlBQUwsQ0FBa0JDLEdBQUcsQ0FBQ00sUUFBdEIsQ0FBTCxFQUFzQztBQUNsQ0ksUUFBQUEsS0FBSyxDQUFFLENBQW1CVixpQkFBQUEsRUFBQUEsR0FBRyxDQUFDTSxRQUFTLGdCQUFsQyxDQUFMLENBQUE7QUFDQSxRQUFBLE9BQUE7QUFDSCxPQUFBOztNQUVELElBQUtVLENBQUFBLFlBQUwsQ0FBa0JoQixHQUFHLENBQUNJLElBQXRCLEVBQTRCRyxPQUE1QixFQUFxQ0csS0FBckMsQ0FBQSxDQUFBO0FBQ0gsS0FQRCxNQU9PO01BQ0hBLEtBQUssQ0FBQyxJQUFELENBQUwsQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztBQUVETyxFQUFBQSxJQUFJLENBQUNqQixHQUFELEVBQU1rQixJQUFOLEVBQVk7QUFDWixJQUFBLE9BQU9BLElBQVAsQ0FBQTtBQUNILEdBQUE7O0FBRURDLEVBQUFBLEtBQUssQ0FBQ0MsS0FBRCxFQUFRQyxNQUFSLEVBQWdCLEVBQ3BCOztBQWFETCxFQUFBQSxZQUFZLENBQUNoQixHQUFELEVBQU1PLE9BQU4sRUFBZUcsS0FBZixFQUFzQjtJQUM5QixJQUFJWSxlQUFlLEVBQW5CLEVBQXVCO01BQ25CLE1BQU01QixPQUFPLEdBQUcsSUFBQSxDQUFLQSxPQUFyQixDQUFBOztBQUVBLE1BQUEsSUFBSSxDQUFDQSxPQUFPLENBQUM2QixPQUFiLEVBQXNCO1FBQ2xCYixLQUFLLENBQUMsb0NBQUQsQ0FBTCxDQUFBO0FBQ0EsUUFBQSxPQUFBO0FBQ0gsT0FBQTs7QUFHRCxNQUFBLE1BQU1jLE9BQU8sR0FBRztBQUNaQyxRQUFBQSxLQUFLLEVBQUUsSUFBQSxDQUFLM0IsVUFBTCxHQUFrQixDQURiO0FBRVpBLFFBQUFBLFVBQVUsRUFBRSxJQUFLQSxDQUFBQSxVQUFBQTtPQUZyQixDQUFBOztBQUtBLE1BQUEsSUFBSUUsR0FBRyxDQUFDMEIsVUFBSixDQUFlLE9BQWYsQ0FBQSxJQUEyQjFCLEdBQUcsQ0FBQzBCLFVBQUosQ0FBZSxPQUFmLENBQS9CLEVBQXdEO0FBQ3BERixRQUFBQSxPQUFPLENBQUNHLFlBQVIsR0FBdUJDLElBQUksQ0FBQ0MsWUFBTCxDQUFrQkMsWUFBekMsQ0FBQTtBQUNILE9BQUE7O01BRURDLElBQUksQ0FBQ0MsR0FBTCxDQUFTaEMsR0FBVCxFQUFjd0IsT0FBZCxFQUF1QixVQUFVYixHQUFWLEVBQWVzQixRQUFmLEVBQXlCO0FBQzVDLFFBQUEsSUFBSXRCLEdBQUosRUFBUztVQUNMRCxLQUFLLENBQUNDLEdBQUQsQ0FBTCxDQUFBO0FBQ0EsVUFBQSxPQUFBO0FBQ0gsU0FBQTs7UUFFRGpCLE9BQU8sQ0FBQzZCLE9BQVIsQ0FBZ0JXLGVBQWhCLENBQWdDRCxRQUFoQyxFQUEwQzFCLE9BQTFDLEVBQW1ERyxLQUFuRCxDQUFBLENBQUE7T0FOSixDQUFBLENBQUE7QUFRSCxLQTFCRCxNQTBCTztNQUNILElBQUl5QixLQUFLLEdBQUcsSUFBWixDQUFBOztNQUVBLElBQUk7UUFDQUEsS0FBSyxHQUFHLElBQUlDLEtBQUosRUFBUixDQUFBO09BREosQ0FFRSxPQUFPQyxDQUFQLEVBQVU7UUFHUjNCLEtBQUssQ0FBQyw4QkFBRCxDQUFMLENBQUE7QUFDQSxRQUFBLE9BQUE7QUFDSCxPQUFBOztBQUdELE1BQUEsSUFBSWhDLEVBQUosRUFBUTtBQUNKNEQsUUFBQUEsUUFBUSxDQUFDQyxJQUFULENBQWNDLFdBQWQsQ0FBMEJMLEtBQTFCLENBQUEsQ0FBQTtBQUNILE9BQUE7O0FBRUQsTUFBQSxNQUFNTSxPQUFPLEdBQUcsU0FBVkEsT0FBVSxHQUFZO0FBQ3hCTixRQUFBQSxLQUFLLENBQUNPLG1CQUFOLENBQTBCLGdCQUExQixFQUE0Q0QsT0FBNUMsQ0FBQSxDQUFBOztBQUdBLFFBQUEsSUFBSS9ELEVBQUosRUFBUTtBQUNKNEQsVUFBQUEsUUFBUSxDQUFDQyxJQUFULENBQWNJLFdBQWQsQ0FBMEJSLEtBQTFCLENBQUEsQ0FBQTtBQUNILFNBQUE7O1FBRUQ1QixPQUFPLENBQUM0QixLQUFELENBQVAsQ0FBQTtPQVJKLENBQUE7O01BV0FBLEtBQUssQ0FBQ1MsT0FBTixHQUFnQixZQUFZO1FBQ3hCVCxLQUFLLENBQUNTLE9BQU4sR0FBZ0IsSUFBaEIsQ0FBQTs7QUFHQSxRQUFBLElBQUlsRSxFQUFKLEVBQVE7QUFDSjRELFVBQUFBLFFBQVEsQ0FBQ0MsSUFBVCxDQUFjSSxXQUFkLENBQTBCUixLQUExQixDQUFBLENBQUE7QUFDSCxTQUFBOztRQUVEekIsS0FBSyxFQUFBLENBQUE7T0FSVCxDQUFBOztBQVdBeUIsTUFBQUEsS0FBSyxDQUFDVSxnQkFBTixDQUF1QixnQkFBdkIsRUFBeUNKLE9BQXpDLENBQUEsQ0FBQTtNQUNBTixLQUFLLENBQUNXLEdBQU4sR0FBWTlDLEdBQVosQ0FBQTtBQUNILEtBQUE7QUFDSixHQUFBOztBQW5KYzs7OzsifQ==