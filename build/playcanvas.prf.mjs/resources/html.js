/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { http } from '../net/http.js';

class HtmlHandler {
  constructor(app) {
    this.handlerType = "html";
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
        callback(`Error loading html resource: ${url.original} [${err}]`);
      }
    });
  }

  open(url, data) {
    return data;
  }

  patch(asset, assets) {}

}

export { HtmlHandler };
