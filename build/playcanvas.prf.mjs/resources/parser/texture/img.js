/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
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
