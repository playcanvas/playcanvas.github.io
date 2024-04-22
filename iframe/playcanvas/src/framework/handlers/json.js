import { Http, http } from '../../platform/net/http.js';
import { ResourceHandler } from './handler.js';

class JsonHandler extends ResourceHandler {
  constructor(app) {
    super(app, 'json');
    this.decoder = null;
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
  openBinary(data) {
    var _this$decoder;
    (_this$decoder = this.decoder) != null ? _this$decoder : this.decoder = new TextDecoder('utf-8');
    return JSON.parse(this.decoder.decode(data));
  }
}

export { JsonHandler };
