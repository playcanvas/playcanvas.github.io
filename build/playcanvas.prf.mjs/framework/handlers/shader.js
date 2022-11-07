/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { http } from '../../platform/net/http.js';

class ShaderHandler {

  constructor(app) {
    this.handlerType = "shader";
    this.maxRetries = 0;
  }
  load(url, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }
    http.get(url.load, {
      retry: this.maxRetries > 0,
      maxRetries: this.maxRetries
    }, function (err, response) {
      if (!err) {
        callback(null, response);
      } else {
        callback(`Error loading shader resource: ${url.original} [${err}]`);
      }
    });
  }
  open(url, data) {
    return data;
  }
  patch(asset, assets) {}
}

export { ShaderHandler };
