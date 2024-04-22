import { http } from '../../platform/net/http.js';
import { ResourceHandler } from './handler.js';

class HtmlHandler extends ResourceHandler {
  constructor(app) {
    super(app, 'html');
    /**
     * TextDecoder for decoding binary data.
     *
     * @type {TextDecoder|null}
     * @private
     */
    this.decoder = null;
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

  /**
   * Parses raw DataView and returns string.
   *
   * @param {DataView} data - The raw data as a DataView
   * @returns {string} The parsed resource data.
   */
  openBinary(data) {
    var _this$decoder;
    (_this$decoder = this.decoder) != null ? _this$decoder : this.decoder = new TextDecoder('utf-8');
    return this.decoder.decode(data);
  }
}

export { HtmlHandler };
