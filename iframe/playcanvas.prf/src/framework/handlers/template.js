import { http } from '../../platform/net/http.js';
import { Template } from '../template.js';
import { ResourceHandler } from './handler.js';

class TemplateHandler extends ResourceHandler {
  constructor(app) {
    super(app, 'template');
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
    http.get(url.load, options, function (err, response) {
      if (err) {
        callback('Error requesting template: ' + url.original);
      } else {
        callback(err, response);
      }
    });
  }
  open(url, data) {
    return new Template(this._app, data);
  }
  openBinary(data) {
    var _this$decoder;
    (_this$decoder = this.decoder) != null ? _this$decoder : this.decoder = new TextDecoder('utf-8');
    return new Template(this._app, JSON.parse(this.decoder.decode(data)));
  }
}

export { TemplateHandler };
