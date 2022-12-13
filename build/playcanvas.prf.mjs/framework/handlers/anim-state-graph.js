/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Http, http } from '../../platform/net/http.js';
import { AnimStateGraph } from '../anim/state-graph/anim-state-graph.js';

class AnimStateGraphHandler {

  constructor(app) {
    this.handlerType = "animstategraph";
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
      if (err) {
        callback(`Error loading animation state graph resource: ${url.original} [${err}]`);
      } else {
        callback(null, response);
      }
    });
  }
  open(url, data) {
    return new AnimStateGraph(data);
  }
  patch(asset, assets) {}
}

export { AnimStateGraphHandler };
