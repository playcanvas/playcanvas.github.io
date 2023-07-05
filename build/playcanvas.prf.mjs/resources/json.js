/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Http, http } from '../net/http.js';

class JsonHandler {
  constructor(app) {
    this.handlerType = "json";
    this.maxRetries = 0;
  }

  load(url, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }

    const options = {
      retry: this.maxRetries > 0,
      maxRetries: this.maxRetries
    };

    if (url.load.startsWith('blob:')) {
      options.responseType = Http.ResponseType.JSON;
    }

    http.get(url.load, options, function (err, response) {
      if (!err) {
        callback(null, response);
      } else {
        callback(`Error loading JSON resource: ${url.original} [${err}]`);
      }
    });
  }

  open(url, data) {
    return data;
  }

  patch(asset, assets) {}

}

export { JsonHandler };
