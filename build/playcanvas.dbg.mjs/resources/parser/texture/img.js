/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../../core/path.js';
import { http } from '../../../net/http.js';
import { TEXHINT_ASSET, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8 } from '../../../graphics/constants.js';
import { Texture } from '../../../graphics/texture.js';
import { ABSOLUTE_URL } from '../../../asset/constants.js';

class ImgParser {
  constructor(registry, device) {
    this.crossOrigin = registry.prefix ? 'anonymous' : null;
    this.maxRetries = 0;
    this.device = device;
  }

  load(url, callback, asset) {
    var _asset$file;

    const hasContents = !!(asset != null && (_asset$file = asset.file) != null && _asset$file.contents);

    if (hasContents) {
      if (this.device.supportsImageBitmap) {
        this._loadImageBitmapFromData(asset.file.contents, callback);

        return;
      }

      url = {
        load: URL.createObjectURL(new Blob([asset.file.contents])),
        original: url.original
      };
    }

    const handler = (err, result) => {
      if (hasContents) {
        URL.revokeObjectURL(url.load);
      }

      callback(err, result);
    };

    let crossOrigin;

    if (asset && asset.options && asset.options.hasOwnProperty('crossOrigin')) {
      crossOrigin = asset.options.crossOrigin;
    } else if (ABSOLUTE_URL.test(url.load)) {
      crossOrigin = this.crossOrigin;
    }

    if (this.device.supportsImageBitmap) {
      this._loadImageBitmap(url.load, url.original, crossOrigin, handler);
    } else {
      this._loadImage(url.load, url.original, crossOrigin, handler);
    }
  }

  open(url, data, device) {
    const ext = path.getExtension(url).toLowerCase();
    const format = ext === '.jpg' || ext === '.jpeg' ? PIXELFORMAT_R8_G8_B8 : PIXELFORMAT_R8_G8_B8_A8;
    const texture = new Texture(device, {
      name: url,
      profilerHint: TEXHINT_ASSET,
      width: data.width,
      height: data.height,
      format: format
    });
    texture.setSource(data);
    return texture;
  }

  _loadImage(url, originalUrl, crossOrigin, callback) {
    const image = new Image();

    if (crossOrigin) {
      image.crossOrigin = crossOrigin;
    }

    let retries = 0;
    const maxRetries = this.maxRetries;
    let retryTimeout;

    image.onload = function () {
      callback(null, image);
    };

    image.onerror = function () {
      if (retryTimeout) return;

      if (maxRetries > 0 && ++retries <= maxRetries) {
        const retryDelay = Math.pow(2, retries) * 100;
        console.log(`Error loading Texture from: '${originalUrl}' - Retrying in ${retryDelay}ms...`);
        const idx = url.indexOf('?');
        const separator = idx >= 0 ? '&' : '?';
        retryTimeout = setTimeout(function () {
          image.src = url + separator + 'retry=' + Date.now();
          retryTimeout = null;
        }, retryDelay);
      } else {
        callback(`Error loading Texture from: '${originalUrl}'`);
      }
    };

    image.src = url;
  }

  _loadImageBitmap(url, originalUrl, crossOrigin, callback) {
    const options = {
      cache: true,
      responseType: 'blob',
      retry: this.maxRetries > 0,
      maxRetries: this.maxRetries
    };
    http.get(url, options, function (err, blob) {
      if (err) {
        callback(err);
      } else {
        createImageBitmap(blob, {
          premultiplyAlpha: 'none'
        }).then(imageBitmap => callback(null, imageBitmap)).catch(e => callback(e));
      }
    });
  }

  _loadImageBitmapFromData(data, callback) {
    createImageBitmap(new Blob([data]), {
      premultiplyAlpha: 'none'
    }).then(imageBitmap => callback(null, imageBitmap)).catch(e => callback(e));
  }

}

export { ImgParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1nLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcmVzb3VyY2VzL3BhcnNlci90ZXh0dXJlL2ltZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBwYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9wYXRoLmpzJztcbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi8uLi8uLi9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7XG4gICAgUElYRUxGT1JNQVRfUjhfRzhfQjgsIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCBURVhISU5UX0FTU0VUXG59IGZyb20gJy4uLy4uLy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vLi4vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5cbmltcG9ydCB7IEFCU09MVVRFX1VSTCB9IGZyb20gJy4uLy4uLy4uL2Fzc2V0L2NvbnN0YW50cy5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi90ZXh0dXJlLmpzJykuVGV4dHVyZVBhcnNlcn0gVGV4dHVyZVBhcnNlciAqL1xuXG4vKipcbiAqIFBhcnNlciBmb3IgYnJvd3Nlci1zdXBwb3J0ZWQgaW1hZ2UgZm9ybWF0cy5cbiAqXG4gKiBAaW1wbGVtZW50cyB7VGV4dHVyZVBhcnNlcn1cbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgSW1nUGFyc2VyIHtcbiAgICBjb25zdHJ1Y3RvcihyZWdpc3RyeSwgZGV2aWNlKSB7XG4gICAgICAgIC8vIGJ5IGRlZmF1bHQgZG9uJ3QgdHJ5IGNyb3NzLW9yaWdpbiwgYmVjYXVzZSBzb21lIGJyb3dzZXJzIHNlbmQgZGlmZmVyZW50IGNvb2tpZXMgKGUuZy4gc2FmYXJpKSBpZiB0aGlzIGlzIHNldC5cbiAgICAgICAgdGhpcy5jcm9zc09yaWdpbiA9IHJlZ2lzdHJ5LnByZWZpeCA/ICdhbm9ueW1vdXMnIDogbnVsbDtcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gMDtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICBjb25zdCBoYXNDb250ZW50cyA9ICEhYXNzZXQ/LmZpbGU/LmNvbnRlbnRzO1xuXG4gICAgICAgIGlmIChoYXNDb250ZW50cykge1xuICAgICAgICAgICAgLy8gSW1hZ2VCaXRtYXAgaW50ZXJmYWNlIGNhbiBsb2FkIGlhZ2VcbiAgICAgICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c0ltYWdlQml0bWFwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9hZEltYWdlQml0bWFwRnJvbURhdGEoYXNzZXQuZmlsZS5jb250ZW50cywgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVybCA9IHtcbiAgICAgICAgICAgICAgICBsb2FkOiBVUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyBCbG9iKFthc3NldC5maWxlLmNvbnRlbnRzXSkpLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsOiB1cmwub3JpZ2luYWxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYW5kbGVyID0gKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBpZiAoaGFzQ29udGVudHMpIHtcbiAgICAgICAgICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybC5sb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0KTtcbiAgICAgICAgfTtcblxuICAgICAgICBsZXQgY3Jvc3NPcmlnaW47XG4gICAgICAgIGlmIChhc3NldCAmJiBhc3NldC5vcHRpb25zICYmIGFzc2V0Lm9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2Nyb3NzT3JpZ2luJykpIHtcbiAgICAgICAgICAgIGNyb3NzT3JpZ2luID0gYXNzZXQub3B0aW9ucy5jcm9zc09yaWdpbjtcbiAgICAgICAgfSBlbHNlIGlmIChBQlNPTFVURV9VUkwudGVzdCh1cmwubG9hZCkpIHtcbiAgICAgICAgICAgIGNyb3NzT3JpZ2luID0gdGhpcy5jcm9zc09yaWdpbjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c0ltYWdlQml0bWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2FkSW1hZ2VCaXRtYXAodXJsLmxvYWQsIHVybC5vcmlnaW5hbCwgY3Jvc3NPcmlnaW4sIGhhbmRsZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fbG9hZEltYWdlKHVybC5sb2FkLCB1cmwub3JpZ2luYWwsIGNyb3NzT3JpZ2luLCBoYW5kbGVyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhLCBkZXZpY2UpIHtcbiAgICAgICAgY29uc3QgZXh0ID0gcGF0aC5nZXRFeHRlbnNpb24odXJsKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjb25zdCBmb3JtYXQgPSAoZXh0ID09PSAnLmpwZycgfHwgZXh0ID09PSAnLmpwZWcnKSA/IFBJWEVMRk9STUFUX1I4X0c4X0I4IDogUElYRUxGT1JNQVRfUjhfRzhfQjhfQTg7XG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWU6IHVybCxcbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHByb2ZpbGVySGludDogVEVYSElOVF9BU1NFVCxcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICAgICAgd2lkdGg6IGRhdGEud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGRhdGEuaGVpZ2h0LFxuICAgICAgICAgICAgZm9ybWF0OiBmb3JtYXRcbiAgICAgICAgfSk7XG4gICAgICAgIHRleHR1cmUuc2V0U291cmNlKGRhdGEpO1xuICAgICAgICByZXR1cm4gdGV4dHVyZTtcbiAgICB9XG5cbiAgICBfbG9hZEltYWdlKHVybCwgb3JpZ2luYWxVcmwsIGNyb3NzT3JpZ2luLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBpbWFnZSA9IG5ldyBJbWFnZSgpO1xuICAgICAgICBpZiAoY3Jvc3NPcmlnaW4pIHtcbiAgICAgICAgICAgIGltYWdlLmNyb3NzT3JpZ2luID0gY3Jvc3NPcmlnaW47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcmV0cmllcyA9IDA7XG4gICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSB0aGlzLm1heFJldHJpZXM7XG4gICAgICAgIGxldCByZXRyeVRpbWVvdXQ7XG5cbiAgICAgICAgLy8gQ2FsbCBzdWNjZXNzIGNhbGxiYWNrIGFmdGVyIG9wZW5pbmcgVGV4dHVyZVxuICAgICAgICBpbWFnZS5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBpbWFnZSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaW1hZ2Uub25lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIFJldHJ5IGEgZmV3IHRpbWVzIGJlZm9yZSBmYWlsaW5nXG4gICAgICAgICAgICBpZiAocmV0cnlUaW1lb3V0KSByZXR1cm47XG5cbiAgICAgICAgICAgIGlmIChtYXhSZXRyaWVzID4gMCAmJiArK3JldHJpZXMgPD0gbWF4UmV0cmllcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldHJ5RGVsYXkgPSBNYXRoLnBvdygyLCByZXRyaWVzKSAqIDEwMDtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgRXJyb3IgbG9hZGluZyBUZXh0dXJlIGZyb206ICcke29yaWdpbmFsVXJsfScgLSBSZXRyeWluZyBpbiAke3JldHJ5RGVsYXl9bXMuLi5gKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGlkeCA9IHVybC5pbmRleE9mKCc/Jyk7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VwYXJhdG9yID0gaWR4ID49IDAgPyAnJicgOiAnPyc7XG5cbiAgICAgICAgICAgICAgICByZXRyeVRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gd2UgbmVlZCB0byBhZGQgYSBjYWNoZSBidXN0aW5nIGFyZ3VtZW50IGlmIHdlIGFyZSB0cnlpbmcgdG8gcmUtbG9hZCBhbiBpbWFnZSBlbGVtZW50XG4gICAgICAgICAgICAgICAgICAgIC8vIHdpdGggdGhlIHNhbWUgVVJMXG4gICAgICAgICAgICAgICAgICAgIGltYWdlLnNyYyA9IHVybCArIHNlcGFyYXRvciArICdyZXRyeT0nICsgRGF0ZS5ub3coKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0cnlUaW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9LCByZXRyeURlbGF5KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQ2FsbCBlcnJvciBjYWxsYmFjayB3aXRoIGRldGFpbHMuXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soYEVycm9yIGxvYWRpbmcgVGV4dHVyZSBmcm9tOiAnJHtvcmlnaW5hbFVybH0nYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgaW1hZ2Uuc3JjID0gdXJsO1xuICAgIH1cblxuICAgIF9sb2FkSW1hZ2VCaXRtYXAodXJsLCBvcmlnaW5hbFVybCwgY3Jvc3NPcmlnaW4sIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBjYWNoZTogdHJ1ZSxcbiAgICAgICAgICAgIHJlc3BvbnNlVHlwZTogJ2Jsb2InLFxuICAgICAgICAgICAgcmV0cnk6IHRoaXMubWF4UmV0cmllcyA+IDAsXG4gICAgICAgICAgICBtYXhSZXRyaWVzOiB0aGlzLm1heFJldHJpZXNcbiAgICAgICAgfTtcbiAgICAgICAgaHR0cC5nZXQodXJsLCBvcHRpb25zLCBmdW5jdGlvbiAoZXJyLCBibG9iKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlSW1hZ2VCaXRtYXAoYmxvYiwge1xuICAgICAgICAgICAgICAgICAgICBwcmVtdWx0aXBseUFscGhhOiAnbm9uZSdcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAudGhlbihpbWFnZUJpdG1hcCA9PiBjYWxsYmFjayhudWxsLCBpbWFnZUJpdG1hcCkpXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaChlID0+IGNhbGxiYWNrKGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX2xvYWRJbWFnZUJpdG1hcEZyb21EYXRhKGRhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNyZWF0ZUltYWdlQml0bWFwKG5ldyBCbG9iKFtkYXRhXSksIHsgcHJlbXVsdGlwbHlBbHBoYTogJ25vbmUnIH0pXG4gICAgICAgICAgICAudGhlbihpbWFnZUJpdG1hcCA9PiBjYWxsYmFjayhudWxsLCBpbWFnZUJpdG1hcCkpXG4gICAgICAgICAgICAuY2F0Y2goZSA9PiBjYWxsYmFjayhlKSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBJbWdQYXJzZXIgfTtcbiJdLCJuYW1lcyI6WyJJbWdQYXJzZXIiLCJjb25zdHJ1Y3RvciIsInJlZ2lzdHJ5IiwiZGV2aWNlIiwiY3Jvc3NPcmlnaW4iLCJwcmVmaXgiLCJtYXhSZXRyaWVzIiwibG9hZCIsInVybCIsImNhbGxiYWNrIiwiYXNzZXQiLCJoYXNDb250ZW50cyIsImZpbGUiLCJjb250ZW50cyIsInN1cHBvcnRzSW1hZ2VCaXRtYXAiLCJfbG9hZEltYWdlQml0bWFwRnJvbURhdGEiLCJVUkwiLCJjcmVhdGVPYmplY3RVUkwiLCJCbG9iIiwib3JpZ2luYWwiLCJoYW5kbGVyIiwiZXJyIiwicmVzdWx0IiwicmV2b2tlT2JqZWN0VVJMIiwib3B0aW9ucyIsImhhc093blByb3BlcnR5IiwiQUJTT0xVVEVfVVJMIiwidGVzdCIsIl9sb2FkSW1hZ2VCaXRtYXAiLCJfbG9hZEltYWdlIiwib3BlbiIsImRhdGEiLCJleHQiLCJwYXRoIiwiZ2V0RXh0ZW5zaW9uIiwidG9Mb3dlckNhc2UiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COCIsIlBJWEVMRk9STUFUX1I4X0c4X0I4X0E4IiwidGV4dHVyZSIsIlRleHR1cmUiLCJuYW1lIiwicHJvZmlsZXJIaW50IiwiVEVYSElOVF9BU1NFVCIsIndpZHRoIiwiaGVpZ2h0Iiwic2V0U291cmNlIiwib3JpZ2luYWxVcmwiLCJpbWFnZSIsIkltYWdlIiwicmV0cmllcyIsInJldHJ5VGltZW91dCIsIm9ubG9hZCIsIm9uZXJyb3IiLCJyZXRyeURlbGF5IiwiTWF0aCIsInBvdyIsImNvbnNvbGUiLCJsb2ciLCJpZHgiLCJpbmRleE9mIiwic2VwYXJhdG9yIiwic2V0VGltZW91dCIsInNyYyIsIkRhdGUiLCJub3ciLCJjYWNoZSIsInJlc3BvbnNlVHlwZSIsInJldHJ5IiwiaHR0cCIsImdldCIsImJsb2IiLCJjcmVhdGVJbWFnZUJpdG1hcCIsInByZW11bHRpcGx5QWxwaGEiLCJ0aGVuIiwiaW1hZ2VCaXRtYXAiLCJjYXRjaCIsImUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBa0JBLE1BQU1BLFNBQU4sQ0FBZ0I7QUFDWkMsRUFBQUEsV0FBVyxDQUFDQyxRQUFELEVBQVdDLE1BQVgsRUFBbUI7SUFFMUIsSUFBS0MsQ0FBQUEsV0FBTCxHQUFtQkYsUUFBUSxDQUFDRyxNQUFULEdBQWtCLFdBQWxCLEdBQWdDLElBQW5ELENBQUE7SUFDQSxJQUFLQyxDQUFBQSxVQUFMLEdBQWtCLENBQWxCLENBQUE7SUFDQSxJQUFLSCxDQUFBQSxNQUFMLEdBQWNBLE1BQWQsQ0FBQTtBQUNILEdBQUE7O0FBRURJLEVBQUFBLElBQUksQ0FBQ0MsR0FBRCxFQUFNQyxRQUFOLEVBQWdCQyxLQUFoQixFQUF1QjtBQUFBLElBQUEsSUFBQSxXQUFBLENBQUE7O0FBQ3ZCLElBQUEs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