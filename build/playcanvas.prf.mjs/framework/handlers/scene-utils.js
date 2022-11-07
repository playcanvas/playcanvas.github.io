/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { http } from '../../platform/net/http.js';

const SceneUtils = {
  load: function (url, maxRetries, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }
    http.get(url.load, {
      retry: maxRetries > 0,
      maxRetries: maxRetries
    }, function (err, response) {
      if (!err) {
        callback(err, response);
      } else {
        let errMsg = 'Error while loading scene JSON ' + url.original;
        if (err.message) {
          errMsg += ': ' + err.message;
          if (err.stack) {
            errMsg += '\n' + err.stack;
          }
        } else {
          errMsg += ': ' + err;
        }
        callback(errMsg);
      }
    });
  }
};

export { SceneUtils };