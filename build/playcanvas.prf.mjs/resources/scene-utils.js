/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { http } from '../net/http.js';

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
