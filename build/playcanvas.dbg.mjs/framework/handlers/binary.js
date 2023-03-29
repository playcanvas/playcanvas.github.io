/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { http, Http } from '../../platform/net/http.js';

class BinaryHandler {
  /**
   * Type of the resource the handler handles.
   *
   * @type {string}
   */

  constructor(app) {
    this.handlerType = "binary";
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
      responseType: Http.ResponseType.ARRAY_BUFFER,
      retry: this.maxRetries > 0,
      maxRetries: this.maxRetries
    }, function (err, response) {
      if (!err) {
        callback(null, response);
      } else {
        callback(`Error loading binary resource: ${url.original} [${err}]`);
      }
    });
  }
  open(url, data) {
    return data;
  }
  patch(asset, assets) {}
}

export { BinaryHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluYXJ5LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2JpbmFyeS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBodHRwLCBIdHRwIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5jbGFzcyBCaW5hcnlIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBUeXBlIG9mIHRoZSByZXNvdXJjZSB0aGUgaGFuZGxlciBoYW5kbGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBoYW5kbGVyVHlwZSA9IFwiYmluYXJ5XCI7XG5cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgdGhpcy5tYXhSZXRyaWVzID0gMDtcbiAgICB9XG5cbiAgICBsb2FkKHVybCwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHR5cGVvZiB1cmwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB1cmwgPSB7XG4gICAgICAgICAgICAgICAgbG9hZDogdXJsLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsOiB1cmxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBodHRwLmdldCh1cmwubG9hZCwge1xuICAgICAgICAgICAgcmVzcG9uc2VUeXBlOiBIdHRwLlJlc3BvbnNlVHlwZS5BUlJBWV9CVUZGRVIsXG4gICAgICAgICAgICByZXRyeTogdGhpcy5tYXhSZXRyaWVzID4gMCxcbiAgICAgICAgICAgIG1heFJldHJpZXM6IHRoaXMubWF4UmV0cmllc1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXNwb25zZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGBFcnJvciBsb2FkaW5nIGJpbmFyeSByZXNvdXJjZTogJHt1cmwub3JpZ2luYWx9IFske2Vycn1dYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIG9wZW4odXJsLCBkYXRhKSB7XG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cblxuICAgIHBhdGNoKGFzc2V0LCBhc3NldHMpIHtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEJpbmFyeUhhbmRsZXIgfTtcbiJdLCJuYW1lcyI6WyJCaW5hcnlIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJoYW5kbGVyVHlwZSIsIm1heFJldHJpZXMiLCJsb2FkIiwidXJsIiwiY2FsbGJhY2siLCJvcmlnaW5hbCIsImh0dHAiLCJnZXQiLCJyZXNwb25zZVR5cGUiLCJIdHRwIiwiUmVzcG9uc2VUeXBlIiwiQVJSQVlfQlVGRkVSIiwicmV0cnkiLCJlcnIiLCJyZXNwb25zZSIsIm9wZW4iLCJkYXRhIiwicGF0Y2giLCJhc3NldCIsImFzc2V0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBLE1BQU1BLGFBQWEsQ0FBQztBQUNoQjtBQUNKO0FBQ0E7QUFDQTtBQUNBOztFQUdJQyxXQUFXLENBQUNDLEdBQUcsRUFBRTtJQUFBLElBRmpCQyxDQUFBQSxXQUFXLEdBQUcsUUFBUSxDQUFBO0lBR2xCLElBQUksQ0FBQ0MsVUFBVSxHQUFHLENBQUMsQ0FBQTtBQUN2QixHQUFBO0FBRUFDLEVBQUFBLElBQUksQ0FBQ0MsR0FBRyxFQUFFQyxRQUFRLEVBQUU7QUFDaEIsSUFBQSxJQUFJLE9BQU9ELEdBQUcsS0FBSyxRQUFRLEVBQUU7QUFDekJBLE1BQUFBLEdBQUcsR0FBRztBQUNGRCxRQUFBQSxJQUFJLEVBQUVDLEdBQUc7QUFDVEUsUUFBQUEsUUFBUSxFQUFFRixHQUFBQTtPQUNiLENBQUE7QUFDTCxLQUFBO0FBRUFHLElBQUFBLElBQUksQ0FBQ0MsR0FBRyxDQUFDSixHQUFHLENBQUNELElBQUksRUFBRTtBQUNmTSxNQUFBQSxZQUFZLEVBQUVDLElBQUksQ0FBQ0MsWUFBWSxDQUFDQyxZQUFZO0FBQzVDQyxNQUFBQSxLQUFLLEVBQUUsSUFBSSxDQUFDWCxVQUFVLEdBQUcsQ0FBQztNQUMxQkEsVUFBVSxFQUFFLElBQUksQ0FBQ0EsVUFBQUE7QUFDckIsS0FBQyxFQUFFLFVBQVVZLEdBQUcsRUFBRUMsUUFBUSxFQUFFO01BQ3hCLElBQUksQ0FBQ0QsR0FBRyxFQUFFO0FBQ05ULFFBQUFBLFFBQVEsQ0FBQyxJQUFJLEVBQUVVLFFBQVEsQ0FBQyxDQUFBO0FBQzVCLE9BQUMsTUFBTTtRQUNIVixRQUFRLENBQUUsa0NBQWlDRCxHQUFHLENBQUNFLFFBQVMsQ0FBSVEsRUFBQUEsRUFBQUEsR0FBSSxHQUFFLENBQUMsQ0FBQTtBQUN2RSxPQUFBO0FBQ0osS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBO0FBRUFFLEVBQUFBLElBQUksQ0FBQ1osR0FBRyxFQUFFYSxJQUFJLEVBQUU7QUFDWixJQUFBLE9BQU9BLElBQUksQ0FBQTtBQUNmLEdBQUE7QUFFQUMsRUFBQUEsS0FBSyxDQUFDQyxLQUFLLEVBQUVDLE1BQU0sRUFBRSxFQUNyQjtBQUNKOzs7OyJ9
