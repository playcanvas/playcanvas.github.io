import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { TEXHINT_ASSET, PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { http } from '../../../platform/net/http.js';
import { ABSOLUTE_URL } from '../../asset/constants.js';
import { ImgAlphaTest } from './img-alpha-test.js';
import { Tracing } from '../../../core/tracing.js';

/** @typedef {import('../../handlers/texture.js').TextureParser} TextureParser */

/**
 * Parser for browser-supported image formats.
 *
 * @implements {TextureParser}
 * @ignore
 */
class ImgParser {
  constructor(registry, device) {
    // by default don't try cross-origin, because some browsers send different cookies (e.g. safari) if this is set.
    this.crossOrigin = registry.prefix ? 'anonymous' : null;
    this.maxRetries = 0;
    this.device = device;

    // run image alpha test

    if (Tracing.get('IMG_ALPHA_TEST')) {
      ImgAlphaTest.run(this.device);
    }
  }
  load(url, callback, asset) {
    var _asset$file;
    const hasContents = !!(asset != null && (_asset$file = asset.file) != null && _asset$file.contents);
    if (hasContents) {
      // ImageBitmap interface can load iage
      if (this.device.supportsImageBitmap) {
        this._loadImageBitmapFromBlob(new Blob([asset.file.contents]), callback);
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
  open(url, data, device, textureOptions = {}) {
    const texture = new Texture(device, _extends({
      name: url,
      profilerHint: TEXHINT_ASSET,
      width: data.width,
      height: data.height,
      format: PIXELFORMAT_RGBA8
    }, textureOptions));
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

    // Call success callback after opening Texture
    image.onload = function () {
      callback(null, image);
    };
    image.onerror = function () {
      // Retry a few times before failing
      if (retryTimeout) return;
      if (maxRetries > 0 && ++retries <= maxRetries) {
        const retryDelay = Math.pow(2, retries) * 100;
        console.log(`Error loading Texture from: '${originalUrl}' - Retrying in ${retryDelay}ms...`);
        const idx = url.indexOf('?');
        const separator = idx >= 0 ? '&' : '?';
        retryTimeout = setTimeout(function () {
          // we need to add a cache busting argument if we are trying to re-load an image element
          // with the same URL
          image.src = url + separator + 'retry=' + Date.now();
          retryTimeout = null;
        }, retryDelay);
      } else {
        // Call error callback with details.
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
    http.get(url, options, (err, blob) => {
      if (err) {
        callback(err);
      } else {
        this._loadImageBitmapFromBlob(blob, callback);
      }
    });
  }
  _loadImageBitmapFromBlob(blob, callback) {
    createImageBitmap(blob, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none'
    }).then(imageBitmap => callback(null, imageBitmap)).catch(e => callback(e));
  }
}

export { ImgParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1nLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3BhcnNlcnMvdGV4dHVyZS9pbWcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgICBQSVhFTEZPUk1BVF9SR0JBOCwgVEVYSElOVF9BU1NFVFxufSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgaHR0cCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL25ldC9odHRwLmpzJztcblxuaW1wb3J0IHsgQUJTT0xVVEVfVVJMIH0gZnJvbSAnLi4vLi4vYXNzZXQvY29uc3RhbnRzLmpzJztcbi8vICNpZiBfREVCVUdcbmltcG9ydCB7IEltZ0FscGhhVGVzdCB9IGZyb20gJy4vaW1nLWFscGhhLXRlc3QuanMnO1xuaW1wb3J0IHsgVHJhY2luZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvdHJhY2luZy5qcyc7XG4vLyAjZW5kaWZcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2hhbmRsZXJzL3RleHR1cmUuanMnKS5UZXh0dXJlUGFyc2VyfSBUZXh0dXJlUGFyc2VyICovXG5cbi8qKlxuICogUGFyc2VyIGZvciBicm93c2VyLXN1cHBvcnRlZCBpbWFnZSBmb3JtYXRzLlxuICpcbiAqIEBpbXBsZW1lbnRzIHtUZXh0dXJlUGFyc2VyfVxuICogQGlnbm9yZVxuICovXG5jbGFzcyBJbWdQYXJzZXIge1xuICAgIGNvbnN0cnVjdG9yKHJlZ2lzdHJ5LCBkZXZpY2UpIHtcbiAgICAgICAgLy8gYnkgZGVmYXVsdCBkb24ndCB0cnkgY3Jvc3Mtb3JpZ2luLCBiZWNhdXNlIHNvbWUgYnJvd3NlcnMgc2VuZCBkaWZmZXJlbnQgY29va2llcyAoZS5nLiBzYWZhcmkpIGlmIHRoaXMgaXMgc2V0LlxuICAgICAgICB0aGlzLmNyb3NzT3JpZ2luID0gcmVnaXN0cnkucHJlZml4ID8gJ2Fub255bW91cycgOiBudWxsO1xuICAgICAgICB0aGlzLm1heFJldHJpZXMgPSAwO1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcblxuICAgICAgICAvLyBydW4gaW1hZ2UgYWxwaGEgdGVzdFxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmIChUcmFjaW5nLmdldCgnSU1HX0FMUEhBX1RFU1QnKSkge1xuICAgICAgICAgICAgSW1nQWxwaGFUZXN0LnJ1bih0aGlzLmRldmljZSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICBjb25zdCBoYXNDb250ZW50cyA9ICEhYXNzZXQ/LmZpbGU/LmNvbnRlbnRzO1xuXG4gICAgICAgIGlmIChoYXNDb250ZW50cykge1xuICAgICAgICAgICAgLy8gSW1hZ2VCaXRtYXAgaW50ZXJmYWNlIGNhbiBsb2FkIGlhZ2VcbiAgICAgICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c0ltYWdlQml0bWFwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9hZEltYWdlQml0bWFwRnJvbUJsb2IobmV3IEJsb2IoW2Fzc2V0LmZpbGUuY29udGVudHNdKSwgY2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVybCA9IHtcbiAgICAgICAgICAgICAgICBsb2FkOiBVUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyBCbG9iKFthc3NldC5maWxlLmNvbnRlbnRzXSkpLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsOiB1cmwub3JpZ2luYWxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYW5kbGVyID0gKGVyciwgcmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBpZiAoaGFzQ29udGVudHMpIHtcbiAgICAgICAgICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybC5sb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0KTtcbiAgICAgICAgfTtcblxuICAgICAgICBsZXQgY3Jvc3NPcmlnaW47XG4gICAgICAgIGlmIChhc3NldCAmJiBhc3NldC5vcHRpb25zICYmIGFzc2V0Lm9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ2Nyb3NzT3JpZ2luJykpIHtcbiAgICAgICAgICAgIGNyb3NzT3JpZ2luID0gYXNzZXQub3B0aW9ucy5jcm9zc09yaWdpbjtcbiAgICAgICAgfSBlbHNlIGlmIChBQlNPTFVURV9VUkwudGVzdCh1cmwubG9hZCkpIHtcbiAgICAgICAgICAgIGNyb3NzT3JpZ2luID0gdGhpcy5jcm9zc09yaWdpbjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmRldmljZS5zdXBwb3J0c0ltYWdlQml0bWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2FkSW1hZ2VCaXRtYXAodXJsLmxvYWQsIHVybC5vcmlnaW5hbCwgY3Jvc3NPcmlnaW4sIGhhbmRsZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fbG9hZEltYWdlKHVybC5sb2FkLCB1cmwub3JpZ2luYWwsIGNyb3NzT3JpZ2luLCBoYW5kbGVyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhLCBkZXZpY2UsIHRleHR1cmVPcHRpb25zID0ge30pIHtcbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlKGRldmljZSwge1xuICAgICAgICAgICAgbmFtZTogdXJsLFxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgcHJvZmlsZXJIaW50OiBURVhISU5UX0FTU0VULFxuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICB3aWR0aDogZGF0YS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogZGF0YS5oZWlnaHQsXG4gICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1JHQkE4LFxuXG4gICAgICAgICAgICAuLi50ZXh0dXJlT3B0aW9uc1xuICAgICAgICB9KTtcblxuICAgICAgICB0ZXh0dXJlLnNldFNvdXJjZShkYXRhKTtcbiAgICAgICAgcmV0dXJuIHRleHR1cmU7XG4gICAgfVxuXG4gICAgX2xvYWRJbWFnZSh1cmwsIG9yaWdpbmFsVXJsLCBjcm9zc09yaWdpbiwgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgaW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgaWYgKGNyb3NzT3JpZ2luKSB7XG4gICAgICAgICAgICBpbWFnZS5jcm9zc09yaWdpbiA9IGNyb3NzT3JpZ2luO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJldHJpZXMgPSAwO1xuICAgICAgICBjb25zdCBtYXhSZXRyaWVzID0gdGhpcy5tYXhSZXRyaWVzO1xuICAgICAgICBsZXQgcmV0cnlUaW1lb3V0O1xuXG4gICAgICAgIC8vIENhbGwgc3VjY2VzcyBjYWxsYmFjayBhZnRlciBvcGVuaW5nIFRleHR1cmVcbiAgICAgICAgaW1hZ2Uub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgaW1hZ2UpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGltYWdlLm9uZXJyb3IgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBSZXRyeSBhIGZldyB0aW1lcyBiZWZvcmUgZmFpbGluZ1xuICAgICAgICAgICAgaWYgKHJldHJ5VGltZW91dCkgcmV0dXJuO1xuXG4gICAgICAgICAgICBpZiAobWF4UmV0cmllcyA+IDAgJiYgKytyZXRyaWVzIDw9IG1heFJldHJpZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXRyeURlbGF5ID0gTWF0aC5wb3coMiwgcmV0cmllcykgKiAxMDA7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEVycm9yIGxvYWRpbmcgVGV4dHVyZSBmcm9tOiAnJHtvcmlnaW5hbFVybH0nIC0gUmV0cnlpbmcgaW4gJHtyZXRyeURlbGF5fW1zLi4uYCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBpZHggPSB1cmwuaW5kZXhPZignPycpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlcGFyYXRvciA9IGlkeCA+PSAwID8gJyYnIDogJz8nO1xuXG4gICAgICAgICAgICAgICAgcmV0cnlUaW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHdlIG5lZWQgdG8gYWRkIGEgY2FjaGUgYnVzdGluZyBhcmd1bWVudCBpZiB3ZSBhcmUgdHJ5aW5nIHRvIHJlLWxvYWQgYW4gaW1hZ2UgZWxlbWVudFxuICAgICAgICAgICAgICAgICAgICAvLyB3aXRoIHRoZSBzYW1lIFVSTFxuICAgICAgICAgICAgICAgICAgICBpbWFnZS5zcmMgPSB1cmwgKyBzZXBhcmF0b3IgKyAncmV0cnk9JyArIERhdGUubm93KCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHJ5VGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgfSwgcmV0cnlEZWxheSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIENhbGwgZXJyb3IgY2FsbGJhY2sgd2l0aCBkZXRhaWxzLlxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGBFcnJvciBsb2FkaW5nIFRleHR1cmUgZnJvbTogJyR7b3JpZ2luYWxVcmx9J2ApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGltYWdlLnNyYyA9IHVybDtcbiAgICB9XG5cbiAgICBfbG9hZEltYWdlQml0bWFwKHVybCwgb3JpZ2luYWxVcmwsIGNyb3NzT3JpZ2luLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgY2FjaGU6IHRydWUsXG4gICAgICAgICAgICByZXNwb25zZVR5cGU6ICdibG9iJyxcbiAgICAgICAgICAgIHJldHJ5OiB0aGlzLm1heFJldHJpZXMgPiAwLFxuICAgICAgICAgICAgbWF4UmV0cmllczogdGhpcy5tYXhSZXRyaWVzXG4gICAgICAgIH07XG4gICAgICAgIGh0dHAuZ2V0KHVybCwgb3B0aW9ucywgKGVyciwgYmxvYikgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2xvYWRJbWFnZUJpdG1hcEZyb21CbG9iKGJsb2IsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX2xvYWRJbWFnZUJpdG1hcEZyb21CbG9iKGJsb2IsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNyZWF0ZUltYWdlQml0bWFwKGJsb2IsIHtcbiAgICAgICAgICAgIHByZW11bHRpcGx5QWxwaGE6ICdub25lJyxcbiAgICAgICAgICAgIGNvbG9yU3BhY2VDb252ZXJzaW9uOiAnbm9uZSdcbiAgICAgICAgfSlcbiAgICAgICAgICAgIC50aGVuKGltYWdlQml0bWFwID0+IGNhbGxiYWNrKG51bGwsIGltYWdlQml0bWFwKSlcbiAgICAgICAgICAgIC5jYXRjaChlID0+IGNhbGxiYWNrKGUpKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEltZ1BhcnNlciB9O1xuIl0sIm5hbWVzIjpbIkltZ1BhcnNlciIsImNvbnN0cnVjdG9yIiwicmVnaXN0cnkiLCJkZXZpY2UiLCJjcm9zc09yaWdpbiIsInByZWZpeCIsIm1heFJldHJpZXMiLCJUcmFjaW5nIiwiZ2V0IiwiSW1nQWxwaGFUZXN0IiwicnVuIiwibG9hZCIsInVybCIsImNhbGxiYWNrIiwiYXNzZXQiLCJfYXNzZXQkZmlsZSIsImhhc0NvbnRlbnRzIiwiZmlsZSIsImNvbnRlbnRzIiwic3VwcG9ydHNJbWFnZUJpdG1hcCIsIl9sb2FkSW1hZ2VCaXRtYXBGcm9tQmxvYiIsIkJsb2IiLCJVUkwiLCJjcmVhdGVPYmplY3RVUkwiLCJvcmlnaW5hbCIsImhhbmRsZXIiLCJlcnIiLCJyZXN1bHQiLCJyZXZva2VPYmplY3RVUkwiLCJvcHRpb25zIiwiaGFzT3duUHJvcGVydHkiLCJBQlNPTFVURV9VUkwiLCJ0ZXN0IiwiX2xvYWRJbWFnZUJpdG1hcCIsIl9sb2FkSW1hZ2UiLCJvcGVuIiwiZGF0YSIsInRleHR1cmVPcHRpb25zIiwidGV4dHVyZSIsIlRleHR1cmUiLCJfZXh0ZW5kcyIsIm5hbWUiLCJwcm9maWxlckhpbnQiLCJURVhISU5UX0FTU0VUIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBOCIsInNldFNvdXJjZSIsIm9yaWdpbmFsVXJsIiwiaW1hZ2UiLCJJbWFnZSIsInJldHJpZXMiLCJyZXRyeVRpbWVvdXQiLCJvbmxvYWQiLCJvbmVycm9yIiwicmV0cnlEZWxheSIsIk1hdGgiLCJwb3ciLCJjb25zb2xlIiwibG9nIiwiaWR4IiwiaW5kZXhPZiIsInNlcGFyYXRvciIsInNldFRpbWVvdXQiLCJzcmMiLCJEYXRlIiwibm93IiwiY2FjaGUiLCJyZXNwb25zZVR5cGUiLCJyZXRyeSIsImh0dHAiLCJibG9iIiwiY3JlYXRlSW1hZ2VCaXRtYXAiLCJwcmVtdWx0aXBseUFscGhhIiwiY29sb3JTcGFjZUNvbnZlcnNpb24iLCJ0aGVuIiwiaW1hZ2VCaXRtYXAiLCJjYXRjaCIsImUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBWUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsU0FBUyxDQUFDO0FBQ1pDLEVBQUFBLFdBQVdBLENBQUNDLFFBQVEsRUFBRUMsTUFBTSxFQUFFO0FBQzFCO0lBQ0EsSUFBSSxDQUFDQyxXQUFXLEdBQUdGLFFBQVEsQ0FBQ0csTUFBTSxHQUFHLFdBQVcsR0FBRyxJQUFJLENBQUE7SUFDdkQsSUFBSSxDQUFDQyxVQUFVLEdBQUcsQ0FBQyxDQUFBO0lBQ25CLElBQUksQ0FBQ0gsTUFBTSxHQUFHQSxN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
