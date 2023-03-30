/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { extend } from '../../core/core.js';
import { now } from '../../core/time.js';
import { path } from '../../core/path.js';
import { URI } from '../../core/uri.js';
import { math } from '../../core/math/math.js';

/**
 * Callback used by {@link Http#get}, {@link Http#post}, {@link Http#put}, {@link Http#del}, and
 * {@link Http#request}.
 *
 * @callback HttpResponseCallback
 * @param {number|string|Error|null} err - The error code, message, or exception in the case where the request fails.
 * @param {*} [response] - The response data if no errors were encountered. (format depends on response type: text, Object, ArrayBuffer, XML).
 */

/**
 * Used to send and receive HTTP requests.
 */
class Http {
  /**
   * @function
   * @name Http#get
   * @description Perform an HTTP GET request to the given url.
   * @param {string} url - The URL to make the request to.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.get("http://example.com/", function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  /**
   * @function
   * @name Http#get
   * @variation 2
   * @description Perform an HTTP GET request to the given url with additional options such as headers, retries, credentials, etc.
   * @param {string} url - The URL to make the request to.
   * @param {object} options - Additional options.
   * @param {object} [options.headers] - HTTP headers to add to the request.
   * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
   * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
   * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
   * @param {string} [options.responseType] - Override the response type.
   * @param {Document|object} [options.postdata] - Data to send in the body of the request.
   * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
   * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
   * Otherwise, by default, the data is sent as form-urlencoded.
   * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
   * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
   * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.get("http://example.com/", { "retry": true, "maxRetries": 5 }, function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  get(url, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    return this.request('GET', url, options, callback);
  }

  /**
   * @function
   * @name Http#post
   * @description Perform an HTTP POST request to the given url.
   * @param {string} url - The URL to make the request to.
   * @param {object} data - Data to send in the body of the request.
   * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
   * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
   * Otherwise, by default, the data is sent as form-urlencoded.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.post("http://example.com/", { "name": "Alix" }, function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  /**
   * @function
   * @name Http#post
   * @variation 2
   * @description Perform an HTTP POST request to the given url with additional options such as headers, retries, credentials, etc.
   * @param {string} url - The URL to make the request to.
   * @param {object} data - Data to send in the body of the request.
   * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
   * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
   * Otherwise, by default, the data is sent as form-urlencoded.
   * @param {object} options - Additional options.
   * @param {object} [options.headers] - HTTP headers to add to the request.
   * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
   * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
   * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
   * @param {string} [options.responseType] - Override the response type.
   * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
   * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
   * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.post("http://example.com/", { "name": "Alix" }, { "retry": true, "maxRetries": 5 }, function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  post(url, data, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    options.postdata = data;
    return this.request('POST', url, options, callback);
  }

  /**
   * @function
   * @name Http#put
   * @description Perform an HTTP PUT request to the given url.
   * @param {string} url - The URL to make the request to.
   * @param {Document|object} data - Data to send in the body of the request.
   * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
   * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
   * Otherwise, by default, the data is sent as form-urlencoded.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.put("http://example.com/", { "name": "Alix" }, function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  /**
   * @function
   * @name Http#put
   * @variation 2
   * @description Perform an HTTP PUT request to the given url with additional options such as headers, retries, credentials, etc.
   * @param {string} url - The URL to make the request to.
   * @param {Document|object} data - Data to send in the body of the request.
   * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
   * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
   * Otherwise, by default, the data is sent as form-urlencoded.
   * @param {object} options - Additional options.
   * @param {object} [options.headers] - HTTP headers to add to the request.
   * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
   * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
   * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
   * @param {string} [options.responseType] - Override the response type.
   * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
   * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
   * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.put("http://example.com/", { "name": "Alix" }, { "retry": true, "maxRetries": 5 }, function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  put(url, data, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    options.postdata = data;
    return this.request('PUT', url, options, callback);
  }

  /**
   * @function
   * @name Http#del
   * @description Perform an HTTP DELETE request to the given url.
   * @param {object} url - The URL to make the request to.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.del("http://example.com/", function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  /**
   * @function
   * @name Http#del
   * @variation 2
   * @description Perform an HTTP DELETE request to the given url with additional options such as headers, retries, credentials, etc.
   * @param {object} url - The URL to make the request to.
   * @param {object} options - Additional options.
   * @param {object} [options.headers] - HTTP headers to add to the request.
   * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
   * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
   * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
   * @param {string} [options.responseType] - Override the response type.
   * @param {Document|object} [options.postdata] - Data to send in the body of the request.
   * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
   * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
   * Otherwise, by default, the data is sent as form-urlencoded.
   * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
   * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
   * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.del("http://example.com/", { "retry": true, "maxRetries": 5 }, function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  del(url, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    return this.request('DELETE', url, options, callback);
  }

  /**
   * @function
   * @name Http#request
   * @description Make a general purpose HTTP request.
   * @param {string} method - The HTTP method "GET", "POST", "PUT", "DELETE".
   * @param {string} url - The url to make the request to.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.request("get", "http://example.com/", function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  /**
   * @function
   * @name Http#request
   * @variation 2
   * @description Make a general purpose HTTP request with additional options such as headers, retries, credentials, etc.
   * @param {string} method - The HTTP method "GET", "POST", "PUT", "DELETE".
   * @param {string} url - The url to make the request to.
   * @param {object} options - Additional options.
   * @param {object} [options.headers] - HTTP headers to add to the request.
   * @param {boolean} [options.async] - Make the request asynchronously. Defaults to true.
   * @param {boolean} [options.cache] - If false, then add a timestamp to the request to prevent caching.
   * @param {boolean} [options.withCredentials] - Send cookies with this request. Defaults to false.
   * @param {boolean} [options.retry] - If true then if the request fails it will be retried with an exponential backoff.
   * @param {number} [options.maxRetries] - If options.retry is true this specifies the maximum number of retries. Defaults to 5.
   * @param {number} [options.maxRetryDelay] - If options.retry is true this specifies the maximum amount of time to wait between retries in milliseconds. Defaults to 5000.
   * @param {string} [options.responseType] - Override the response type.
   * @param {Document|object} [options.postdata] - Data to send in the body of the request.
   * Some content types are handled automatically. If postdata is an XML Document, it is handled. If
   * the Content-Type header is set to 'application/json' then the postdata is JSON stringified.
   * Otherwise, by default, the data is sent as form-urlencoded.
   * @param {HttpResponseCallback} callback - The callback used when the response has returned. Passed (err, data)
   * where data is the response (format depends on response type: text, Object, ArrayBuffer, XML) and
   * err is the error code.
   * @example
   * pc.http.request("get", "http://example.com/", { "retry": true, "maxRetries": 5 }, function (err, response) {
   *     console.log(response);
   * });
   * @returns {XMLHttpRequest} The request object.
   */
  request(method, url, options, callback) {
    let uri, query, postdata;
    let errored = false;
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    // if retryable we are going to store new properties
    // in the options so create a new copy to not affect
    // the original
    if (options.retry) {
      options = Object.assign({
        retries: 0,
        maxRetries: 5
      }, options);
    }

    // store callback
    options.callback = callback;

    // setup defaults
    if (options.async == null) {
      options.async = true;
    }
    if (options.headers == null) {
      options.headers = {};
    }
    if (options.postdata != null) {
      if (options.postdata instanceof Document) {
        // It's an XML document, so we can send it directly.
        // XMLHttpRequest will set the content type correctly.
        postdata = options.postdata;
      } else if (options.postdata instanceof FormData) {
        postdata = options.postdata;
      } else if (options.postdata instanceof Object) {
        // Now to work out how to encode the post data based on the headers
        let contentType = options.headers['Content-Type'];

        // If there is no type then default to form-encoded
        if (contentType === undefined) {
          options.headers['Content-Type'] = Http.ContentType.FORM_URLENCODED;
          contentType = options.headers['Content-Type'];
        }
        switch (contentType) {
          case Http.ContentType.FORM_URLENCODED:
            {
              // Normal URL encoded form data
              postdata = '';
              let bFirstItem = true;

              // Loop round each entry in the map and encode them into the post data
              for (const key in options.postdata) {
                if (options.postdata.hasOwnProperty(key)) {
                  if (bFirstItem) {
                    bFirstItem = false;
                  } else {
                    postdata += '&';
                  }
                  const encodedKey = encodeURIComponent(key);
                  const encodedValue = encodeURIComponent(options.postdata[key]);
                  postdata += `${encodedKey}=${encodedValue}`;
                }
              }
              break;
            }
          default:
          case Http.ContentType.JSON:
            if (contentType == null) {
              options.headers['Content-Type'] = Http.ContentType.JSON;
            }
            postdata = JSON.stringify(options.postdata);
            break;
        }
      } else {
        postdata = options.postdata;
      }
    }
    if (options.cache === false) {
      // Add timestamp to url to prevent browser caching file
      const timestamp = now();
      uri = new URI(url);
      if (!uri.query) {
        uri.query = 'ts=' + timestamp;
      } else {
        uri.query = uri.query + '&ts=' + timestamp;
      }
      url = uri.toString();
    }
    if (options.query) {
      uri = new URI(url);
      query = extend(uri.getQuery(), options.query);
      uri.setQuery(query);
      url = uri.toString();
    }
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, options.async);
    xhr.withCredentials = options.withCredentials !== undefined ? options.withCredentials : false;
    xhr.responseType = options.responseType || this._guessResponseType(url);

    // Set the http headers
    for (const header in options.headers) {
      if (options.headers.hasOwnProperty(header)) {
        xhr.setRequestHeader(header, options.headers[header]);
      }
    }
    xhr.onreadystatechange = () => {
      this._onReadyStateChange(method, url, options, xhr);
    };
    xhr.onerror = () => {
      this._onError(method, url, options, xhr);
      errored = true;
    };
    try {
      xhr.send(postdata);
    } catch (e) {
      // DWE: Don't callback on exceptions as behavior is inconsistent, e.g. cross-domain request errors don't throw an exception.
      // Error callback should be called by xhr.onerror() callback instead.
      if (!errored) {
        options.error(xhr.status, xhr, e);
      }
    }

    // Return the request object as it can be handy for blocking calls
    return xhr;
  }
  _guessResponseType(url) {
    const uri = new URI(url);
    const ext = path.getExtension(uri.path);
    if (Http.binaryExtensions.indexOf(ext) >= 0) {
      return Http.ResponseType.ARRAY_BUFFER;
    }
    if (ext === '.xml') {
      return Http.ResponseType.DOCUMENT;
    }
    return Http.ResponseType.TEXT;
  }
  _isBinaryContentType(contentType) {
    const binTypes = [Http.ContentType.BASIS, Http.ContentType.BIN, Http.ContentType.DDS, Http.ContentType.GLB, Http.ContentType.MP3, Http.ContentType.MP4, Http.ContentType.OGG, Http.ContentType.OPUS, Http.ContentType.WAV];
    if (binTypes.indexOf(contentType) >= 0) {
      return true;
    }
    return false;
  }
  _isBinaryResponseType(responseType) {
    return responseType === Http.ResponseType.ARRAY_BUFFER || responseType === Http.ResponseType.BLOB || responseType === Http.ResponseType.JSON;
  }
  _onReadyStateChange(method, url, options, xhr) {
    if (xhr.readyState === 4) {
      switch (xhr.status) {
        case 0:
          {
            // If status code 0, it is assumed that the browser has cancelled the request

            // Add support for running Chrome browsers in 'allow-file-access-from-file'
            // This is to allow for specialized programs and libraries such as CefSharp
            // which embed Chromium in the native app.
            if (xhr.responseURL && xhr.responseURL.startsWith('file:///')) {
              // Assume that any file loaded from disk is fine
              this._onSuccess(method, url, options, xhr);
            } else {
              this._onError(method, url, options, xhr);
            }
            break;
          }
        case 200:
        case 201:
        case 206:
        case 304:
          {
            this._onSuccess(method, url, options, xhr);
            break;
          }
        default:
          {
            this._onError(method, url, options, xhr);
            break;
          }
      }
    }
  }
  _onSuccess(method, url, options, xhr) {
    let response;
    let contentType;
    const header = xhr.getResponseHeader('Content-Type');
    if (header) {
      // Split up header into content type and parameter
      const parts = header.split(';');
      contentType = parts[0].trim();
    }
    try {
      // Check the content type to see if we want to parse it
      if (this._isBinaryContentType(contentType) || this._isBinaryResponseType(xhr.responseType)) {
        // It's a binary response
        response = xhr.response;
      } else if (contentType === Http.ContentType.JSON || url.split('?')[0].endsWith('.json')) {
        // It's a JSON response
        response = JSON.parse(xhr.responseText);
      } else if (xhr.responseType === Http.ResponseType.DOCUMENT || contentType === Http.ContentType.XML) {
        // It's an XML response
        response = xhr.responseXML;
      } else {
        // It's raw data
        response = xhr.responseText;
      }
      options.callback(null, response);
    } catch (err) {
      options.callback(err);
    }
  }
  _onError(method, url, options, xhr) {
    if (options.retrying) {
      return;
    }

    // retry if necessary
    if (options.retry && options.retries < options.maxRetries) {
      options.retries++;
      options.retrying = true; // used to stop retrying when both onError and xhr.onerror are called
      const retryDelay = math.clamp(Math.pow(2, options.retries) * Http.retryDelay, 0, options.maxRetryDelay || 5000);
      console.log(`${method}: ${url} - Error ${xhr.status}. Retrying in ${retryDelay} ms`);
      setTimeout(() => {
        options.retrying = false;
        this.request(method, url, options, options.callback);
      }, retryDelay);
    } else {
      // no more retries or not retry so just fail
      options.callback(xhr.status === 0 ? 'Network error' : xhr.status, null);
    }
  }
}
Http.ContentType = {
  AAC: 'audio/aac',
  BASIS: 'image/basis',
  BIN: 'application/octet-stream',
  DDS: 'image/dds',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  GIF: 'image/gif',
  GLB: 'model/gltf-binary',
  JPEG: 'image/jpeg',
  JSON: 'application/json',
  MP3: 'audio/mpeg',
  MP4: 'audio/mp4',
  OGG: 'audio/ogg',
  OPUS: 'audio/ogg; codecs="opus"',
  PNG: 'image/png',
  TEXT: 'text/plain',
  WAV: 'audio/x-wav',
  XML: 'application/xml'
};
Http.ResponseType = {
  TEXT: 'text',
  ARRAY_BUFFER: 'arraybuffer',
  BLOB: 'blob',
  DOCUMENT: 'document',
  JSON: 'json'
};
Http.binaryExtensions = ['.model', '.wav', '.ogg', '.mp3', '.mp4', '.m4a', '.aac', '.dds', '.basis', '.glb', '.opus'];
Http.retryDelay = 100;
const http = new Http();

export { Http, http };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL25ldC9odHRwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGV4dGVuZCB9IGZyb20gJy4uLy4uL2NvcmUvY29yZS5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9jb3JlL3VyaS5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgSHR0cCNnZXR9LCB7QGxpbmsgSHR0cCNwb3N0fSwge0BsaW5rIEh0dHAjcHV0fSwge0BsaW5rIEh0dHAjZGVsfSwgYW5kXG4gKiB7QGxpbmsgSHR0cCNyZXF1ZXN0fS5cbiAqXG4gKiBAY2FsbGJhY2sgSHR0cFJlc3BvbnNlQ2FsbGJhY2tcbiAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ3xFcnJvcnxudWxsfSBlcnIgLSBUaGUgZXJyb3IgY29kZSwgbWVzc2FnZSwgb3IgZXhjZXB0aW9uIGluIHRoZSBjYXNlIHdoZXJlIHRoZSByZXF1ZXN0IGZhaWxzLlxuICogQHBhcmFtIHsqfSBbcmVzcG9uc2VdIC0gVGhlIHJlc3BvbnNlIGRhdGEgaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuIChmb3JtYXQgZGVwZW5kcyBvbiByZXNwb25zZSB0eXBlOiB0ZXh0LCBPYmplY3QsIEFycmF5QnVmZmVyLCBYTUwpLlxuICovXG5cbi8qKlxuICogVXNlZCB0byBzZW5kIGFuZCByZWNlaXZlIEhUVFAgcmVxdWVzdHMuXG4gKi9cbmNsYXNzIEh0dHAge1xuICAgIHN0YXRpYyBDb250ZW50VHlwZSA9IHtcbiAgICAgICAgQUFDOiAnYXVkaW8vYWFjJyxcbiAgICAgICAgQkFTSVM6ICdpbWFnZS9iYXNpcycsXG4gICAgICAgIEJJTjogJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXG4gICAgICAgIEREUzogJ2ltYWdlL2RkcycsXG4gICAgICAgIEZPUk1fVVJMRU5DT0RFRDogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXG4gICAgICAgIEdJRjogJ2ltYWdlL2dpZicsXG4gICAgICAgIEdMQjogJ21vZGVsL2dsdGYtYmluYXJ5JyxcbiAgICAgICAgSlBFRzogJ2ltYWdlL2pwZWcnLFxuICAgICAgICBKU09OOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIE1QMzogJ2F1ZGlvL21wZWcnLFxuICAgICAgICBNUDQ6ICdhdWRpby9tcDQnLFxuICAgICAgICBPR0c6ICdhdWRpby9vZ2cnLFxuICAgICAgICBPUFVTOiAnYXVkaW8vb2dnOyBjb2RlY3M9XCJvcHVzXCInLFxuICAgICAgICBQTkc6ICdpbWFnZS9wbmcnLFxuICAgICAgICBURVhUOiAndGV4dC9wbGFpbicsXG4gICAgICAgIFdBVjogJ2F1ZGlvL3gtd2F2JyxcbiAgICAgICAgWE1MOiAnYXBwbGljYXRpb24veG1sJ1xuICAgIH07XG5cbiAgICBzdGF0aWMgUmVzcG9uc2VUeXBlID0ge1xuICAgICAgICBURVhUOiAndGV4dCcsXG4gICAgICAgIEFSUkFZX0JVRkZFUjogJ2FycmF5YnVmZmVyJyxcbiAgICAgICAgQkxPQjogJ2Jsb2InLFxuICAgICAgICBET0NVTUVOVDogJ2RvY3VtZW50JyxcbiAgICAgICAgSlNPTjogJ2pzb24nXG4gICAgfTtcblxuICAgIHN0YXRpYyBiaW5hcnlFeHRlbnNpb25zID0gW1xuICAgICAgICAnLm1vZGVsJyxcbiAgICAgICAgJy53YXYnLFxuICAgICAgICAnLm9nZycsXG4gICAgICAgICcubXAzJyxcbiAgICAgICAgJy5tcDQnLFxuICAgICAgICAnLm00YScsXG4gICAgICAgICcuYWFjJyxcbiAgICAgICAgJy5kZHMnLFxuICAgICAgICAnLmJhc2lzJyxcbiAgICAgICAgJy5nbGInLFxuICAgICAgICAnLm9wdXMnXG4gICAgXTtcblxuICAgIHN0YXRpYyByZXRyeURlbGF5ID0gMTAwO1xuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNnZXRcbiAgICAgKiBAZGVzY3JpcHRpb24gUGVyZm9ybSBhbiBIVFRQIEdFVCByZXF1ZXN0IHRvIHRoZSBnaXZlbiB1cmwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5nZXQoXCJodHRwOi8vZXhhbXBsZS5jb20vXCIsIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFRoZSByZXF1ZXN0IG9iamVjdC5cbiAgICAgKi9cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBIdHRwI2dldFxuICAgICAqIEB2YXJpYXRpb24gMlxuICAgICAqIEBkZXNjcmlwdGlvbiBQZXJmb3JtIGFuIEhUVFAgR0VUIHJlcXVlc3QgdG8gdGhlIGdpdmVuIHVybCB3aXRoIGFkZGl0aW9uYWwgb3B0aW9ucyBzdWNoIGFzIGhlYWRlcnMsIHJldHJpZXMsIGNyZWRlbnRpYWxzLCBldGMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIEFkZGl0aW9uYWwgb3B0aW9ucy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnMuaGVhZGVyc10gLSBIVFRQIGhlYWRlcnMgdG8gYWRkIHRvIHRoZSByZXF1ZXN0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYXN5bmNdIC0gTWFrZSB0aGUgcmVxdWVzdCBhc3luY2hyb25vdXNseS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNhY2hlXSAtIElmIGZhbHNlLCB0aGVuIGFkZCBhIHRpbWVzdGFtcCB0byB0aGUgcmVxdWVzdCB0byBwcmV2ZW50IGNhY2hpbmcuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy53aXRoQ3JlZGVudGlhbHNdIC0gU2VuZCBjb29raWVzIHdpdGggdGhpcyByZXF1ZXN0LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMucmVzcG9uc2VUeXBlXSAtIE92ZXJyaWRlIHRoZSByZXNwb25zZSB0eXBlLlxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnR8b2JqZWN0fSBbb3B0aW9ucy5wb3N0ZGF0YV0gLSBEYXRhIHRvIHNlbmQgaW4gdGhlIGJvZHkgb2YgdGhlIHJlcXVlc3QuXG4gICAgICogU29tZSBjb250ZW50IHR5cGVzIGFyZSBoYW5kbGVkIGF1dG9tYXRpY2FsbHkuIElmIHBvc3RkYXRhIGlzIGFuIFhNTCBEb2N1bWVudCwgaXQgaXMgaGFuZGxlZC4gSWZcbiAgICAgKiB0aGUgQ29udGVudC1UeXBlIGhlYWRlciBpcyBzZXQgdG8gJ2FwcGxpY2F0aW9uL2pzb24nIHRoZW4gdGhlIHBvc3RkYXRhIGlzIEpTT04gc3RyaW5naWZpZWQuXG4gICAgICogT3RoZXJ3aXNlLCBieSBkZWZhdWx0LCB0aGUgZGF0YSBpcyBzZW50IGFzIGZvcm0tdXJsZW5jb2RlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJldHJ5XSAtIElmIHRydWUgdGhlbiBpZiB0aGUgcmVxdWVzdCBmYWlscyBpdCB3aWxsIGJlIHJldHJpZWQgd2l0aCBhbiBleHBvbmVudGlhbCBiYWNrb2ZmLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhSZXRyaWVzXSAtIElmIG9wdGlvbnMucmV0cnkgaXMgdHJ1ZSB0aGlzIHNwZWNpZmllcyB0aGUgbWF4aW11bSBudW1iZXIgb2YgcmV0cmllcy4gRGVmYXVsdHMgdG8gNS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cnlEZWxheV0gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gYW1vdW50IG9mIHRpbWUgdG8gd2FpdCBiZXR3ZWVuIHJldHJpZXMgaW4gbWlsbGlzZWNvbmRzLiBEZWZhdWx0cyB0byA1MDAwLlxuICAgICAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIGNhbGxiYWNrIHVzZWQgd2hlbiB0aGUgcmVzcG9uc2UgaGFzIHJldHVybmVkLiBQYXNzZWQgKGVyciwgZGF0YSlcbiAgICAgKiB3aGVyZSBkYXRhIGlzIHRoZSByZXNwb25zZSAoZm9ybWF0IGRlcGVuZHMgb24gcmVzcG9uc2UgdHlwZTogdGV4dCwgT2JqZWN0LCBBcnJheUJ1ZmZlciwgWE1MKSBhbmRcbiAgICAgKiBlcnIgaXMgdGhlIGVycm9yIGNvZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5odHRwLmdldChcImh0dHA6Ly9leGFtcGxlLmNvbS9cIiwgeyBcInJldHJ5XCI6IHRydWUsIFwibWF4UmV0cmllc1wiOiA1IH0sIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFRoZSByZXF1ZXN0IG9iamVjdC5cbiAgICAgKi9cbiAgICBnZXQodXJsLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCB1cmwsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBIdHRwI3Bvc3RcbiAgICAgKiBAZGVzY3JpcHRpb24gUGVyZm9ybSBhbiBIVFRQIFBPU1QgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gdXJsLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBEYXRhIHRvIHNlbmQgaW4gdGhlIGJvZHkgb2YgdGhlIHJlcXVlc3QuXG4gICAgICogU29tZSBjb250ZW50IHR5cGVzIGFyZSBoYW5kbGVkIGF1dG9tYXRpY2FsbHkuIElmIHBvc3RkYXRhIGlzIGFuIFhNTCBEb2N1bWVudCwgaXQgaXMgaGFuZGxlZC4gSWZcbiAgICAgKiB0aGUgQ29udGVudC1UeXBlIGhlYWRlciBpcyBzZXQgdG8gJ2FwcGxpY2F0aW9uL2pzb24nIHRoZW4gdGhlIHBvc3RkYXRhIGlzIEpTT04gc3RyaW5naWZpZWQuXG4gICAgICogT3RoZXJ3aXNlLCBieSBkZWZhdWx0LCB0aGUgZGF0YSBpcyBzZW50IGFzIGZvcm0tdXJsZW5jb2RlZC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5wb3N0KFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCB7IFwibmFtZVwiOiBcIkFsaXhcIiB9LCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNwb3N0XG4gICAgICogQHZhcmlhdGlvbiAyXG4gICAgICogQGRlc2NyaXB0aW9uIFBlcmZvcm0gYW4gSFRUUCBQT1NUIHJlcXVlc3QgdG8gdGhlIGdpdmVuIHVybCB3aXRoIGFkZGl0aW9uYWwgb3B0aW9ucyBzdWNoIGFzIGhlYWRlcnMsIHJldHJpZXMsIGNyZWRlbnRpYWxzLCBldGMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIERhdGEgdG8gc2VuZCBpbiB0aGUgYm9keSBvZiB0aGUgcmVxdWVzdC5cbiAgICAgKiBTb21lIGNvbnRlbnQgdHlwZXMgYXJlIGhhbmRsZWQgYXV0b21hdGljYWxseS4gSWYgcG9zdGRhdGEgaXMgYW4gWE1MIERvY3VtZW50LCBpdCBpcyBoYW5kbGVkLiBJZlxuICAgICAqIHRoZSBDb250ZW50LVR5cGUgaGVhZGVyIGlzIHNldCB0byAnYXBwbGljYXRpb24vanNvbicgdGhlbiB0aGUgcG9zdGRhdGEgaXMgSlNPTiBzdHJpbmdpZmllZC5cbiAgICAgKiBPdGhlcndpc2UsIGJ5IGRlZmF1bHQsIHRoZSBkYXRhIGlzIHNlbnQgYXMgZm9ybS11cmxlbmNvZGVkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gQWRkaXRpb25hbCBvcHRpb25zLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzXSAtIEhUVFAgaGVhZGVycyB0byBhZGQgdG8gdGhlIHJlcXVlc3QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hc3luY10gLSBNYWtlIHRoZSByZXF1ZXN0IGFzeW5jaHJvbm91c2x5LiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY2FjaGVdIC0gSWYgZmFsc2UsIHRoZW4gYWRkIGEgdGltZXN0YW1wIHRvIHRoZSByZXF1ZXN0IHRvIHByZXZlbnQgY2FjaGluZy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLndpdGhDcmVkZW50aWFsc10gLSBTZW5kIGNvb2tpZXMgd2l0aCB0aGlzIHJlcXVlc3QuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5yZXNwb25zZVR5cGVdIC0gT3ZlcnJpZGUgdGhlIHJlc3BvbnNlIHR5cGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXRyeV0gLSBJZiB0cnVlIHRoZW4gaWYgdGhlIHJlcXVlc3QgZmFpbHMgaXQgd2lsbCBiZSByZXRyaWVkIHdpdGggYW4gZXhwb25lbnRpYWwgYmFja29mZi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cmllc10gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIHJldHJpZXMuIERlZmF1bHRzIHRvIDUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heFJldHJ5RGVsYXldIC0gSWYgb3B0aW9ucy5yZXRyeSBpcyB0cnVlIHRoaXMgc3BlY2lmaWVzIHRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgYmV0d2VlbiByZXRyaWVzIGluIG1pbGxpc2Vjb25kcy4gRGVmYXVsdHMgdG8gNTAwMC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5wb3N0KFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCB7IFwibmFtZVwiOiBcIkFsaXhcIiB9LCB7IFwicmV0cnlcIjogdHJ1ZSwgXCJtYXhSZXRyaWVzXCI6IDUgfSwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2cocmVzcG9uc2UpO1xuICAgICAqIH0pO1xuICAgICAqIEByZXR1cm5zIHtYTUxIdHRwUmVxdWVzdH0gVGhlIHJlcXVlc3Qgb2JqZWN0LlxuICAgICAqL1xuICAgIHBvc3QodXJsLCBkYXRhLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBvcHRpb25zLnBvc3RkYXRhID0gZGF0YTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUE9TVCcsIHVybCwgb3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIEh0dHAjcHV0XG4gICAgICogQGRlc2NyaXB0aW9uIFBlcmZvcm0gYW4gSFRUUCBQVVQgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gdXJsLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtEb2N1bWVudHxvYmplY3R9IGRhdGEgLSBEYXRhIHRvIHNlbmQgaW4gdGhlIGJvZHkgb2YgdGhlIHJlcXVlc3QuXG4gICAgICogU29tZSBjb250ZW50IHR5cGVzIGFyZSBoYW5kbGVkIGF1dG9tYXRpY2FsbHkuIElmIHBvc3RkYXRhIGlzIGFuIFhNTCBEb2N1bWVudCwgaXQgaXMgaGFuZGxlZC4gSWZcbiAgICAgKiB0aGUgQ29udGVudC1UeXBlIGhlYWRlciBpcyBzZXQgdG8gJ2FwcGxpY2F0aW9uL2pzb24nIHRoZW4gdGhlIHBvc3RkYXRhIGlzIEpTT04gc3RyaW5naWZpZWQuXG4gICAgICogT3RoZXJ3aXNlLCBieSBkZWZhdWx0LCB0aGUgZGF0YSBpcyBzZW50IGFzIGZvcm0tdXJsZW5jb2RlZC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5wdXQoXCJodHRwOi8vZXhhbXBsZS5jb20vXCIsIHsgXCJuYW1lXCI6IFwiQWxpeFwiIH0sIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFRoZSByZXF1ZXN0IG9iamVjdC5cbiAgICAgKi9cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBIdHRwI3B1dFxuICAgICAqIEB2YXJpYXRpb24gMlxuICAgICAqIEBkZXNjcmlwdGlvbiBQZXJmb3JtIGFuIEhUVFAgUFVUIHJlcXVlc3QgdG8gdGhlIGdpdmVuIHVybCB3aXRoIGFkZGl0aW9uYWwgb3B0aW9ucyBzdWNoIGFzIGhlYWRlcnMsIHJldHJpZXMsIGNyZWRlbnRpYWxzLCBldGMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50fG9iamVjdH0gZGF0YSAtIERhdGEgdG8gc2VuZCBpbiB0aGUgYm9keSBvZiB0aGUgcmVxdWVzdC5cbiAgICAgKiBTb21lIGNvbnRlbnQgdHlwZXMgYXJlIGhhbmRsZWQgYXV0b21hdGljYWxseS4gSWYgcG9zdGRhdGEgaXMgYW4gWE1MIERvY3VtZW50LCBpdCBpcyBoYW5kbGVkLiBJZlxuICAgICAqIHRoZSBDb250ZW50LVR5cGUgaGVhZGVyIGlzIHNldCB0byAnYXBwbGljYXRpb24vanNvbicgdGhlbiB0aGUgcG9zdGRhdGEgaXMgSlNPTiBzdHJpbmdpZmllZC5cbiAgICAgKiBPdGhlcndpc2UsIGJ5IGRlZmF1bHQsIHRoZSBkYXRhIGlzIHNlbnQgYXMgZm9ybS11cmxlbmNvZGVkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gQWRkaXRpb25hbCBvcHRpb25zLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzXSAtIEhUVFAgaGVhZGVycyB0byBhZGQgdG8gdGhlIHJlcXVlc3QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hc3luY10gLSBNYWtlIHRoZSByZXF1ZXN0IGFzeW5jaHJvbm91c2x5LiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY2FjaGVdIC0gSWYgZmFsc2UsIHRoZW4gYWRkIGEgdGltZXN0YW1wIHRvIHRoZSByZXF1ZXN0IHRvIHByZXZlbnQgY2FjaGluZy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLndpdGhDcmVkZW50aWFsc10gLSBTZW5kIGNvb2tpZXMgd2l0aCB0aGlzIHJlcXVlc3QuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5yZXNwb25zZVR5cGVdIC0gT3ZlcnJpZGUgdGhlIHJlc3BvbnNlIHR5cGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXRyeV0gLSBJZiB0cnVlIHRoZW4gaWYgdGhlIHJlcXVlc3QgZmFpbHMgaXQgd2lsbCBiZSByZXRyaWVkIHdpdGggYW4gZXhwb25lbnRpYWwgYmFja29mZi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cmllc10gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIHJldHJpZXMuIERlZmF1bHRzIHRvIDUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heFJldHJ5RGVsYXldIC0gSWYgb3B0aW9ucy5yZXRyeSBpcyB0cnVlIHRoaXMgc3BlY2lmaWVzIHRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgYmV0d2VlbiByZXRyaWVzIGluIG1pbGxpc2Vjb25kcy4gRGVmYXVsdHMgdG8gNTAwMC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5wdXQoXCJodHRwOi8vZXhhbXBsZS5jb20vXCIsIHsgXCJuYW1lXCI6IFwiQWxpeFwiIH0sIHsgXCJyZXRyeVwiOiB0cnVlLCBcIm1heFJldHJpZXNcIjogNSB9LCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgcHV0KHVybCwgZGF0YSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgb3B0aW9ucy5wb3N0ZGF0YSA9IGRhdGE7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BVVCcsIHVybCwgb3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIEh0dHAjZGVsXG4gICAgICogQGRlc2NyaXB0aW9uIFBlcmZvcm0gYW4gSFRUUCBERUxFVEUgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gdXJsLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB1cmwgLSBUaGUgVVJMIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtIdHRwUmVzcG9uc2VDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2sgdXNlZCB3aGVuIHRoZSByZXNwb25zZSBoYXMgcmV0dXJuZWQuIFBhc3NlZCAoZXJyLCBkYXRhKVxuICAgICAqIHdoZXJlIGRhdGEgaXMgdGhlIHJlc3BvbnNlIChmb3JtYXQgZGVwZW5kcyBvbiByZXNwb25zZSB0eXBlOiB0ZXh0LCBPYmplY3QsIEFycmF5QnVmZmVyLCBYTUwpIGFuZFxuICAgICAqIGVyciBpcyB0aGUgZXJyb3IgY29kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmh0dHAuZGVsKFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNkZWxcbiAgICAgKiBAdmFyaWF0aW9uIDJcbiAgICAgKiBAZGVzY3JpcHRpb24gUGVyZm9ybSBhbiBIVFRQIERFTEVURSByZXF1ZXN0IHRvIHRoZSBnaXZlbiB1cmwgd2l0aCBhZGRpdGlvbmFsIG9wdGlvbnMgc3VjaCBhcyBoZWFkZXJzLCByZXRyaWVzLCBjcmVkZW50aWFscywgZXRjLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB1cmwgLSBUaGUgVVJMIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBBZGRpdGlvbmFsIG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLmhlYWRlcnNdIC0gSFRUUCBoZWFkZXJzIHRvIGFkZCB0byB0aGUgcmVxdWVzdC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFzeW5jXSAtIE1ha2UgdGhlIHJlcXVlc3QgYXN5bmNocm9ub3VzbHkuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jYWNoZV0gLSBJZiBmYWxzZSwgdGhlbiBhZGQgYSB0aW1lc3RhbXAgdG8gdGhlIHJlcXVlc3QgdG8gcHJldmVudCBjYWNoaW5nLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMud2l0aENyZWRlbnRpYWxzXSAtIFNlbmQgY29va2llcyB3aXRoIHRoaXMgcmVxdWVzdC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnJlc3BvbnNlVHlwZV0gLSBPdmVycmlkZSB0aGUgcmVzcG9uc2UgdHlwZS5cbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50fG9iamVjdH0gW29wdGlvbnMucG9zdGRhdGFdIC0gRGF0YSB0byBzZW5kIGluIHRoZSBib2R5IG9mIHRoZSByZXF1ZXN0LlxuICAgICAqIFNvbWUgY29udGVudCB0eXBlcyBhcmUgaGFuZGxlZCBhdXRvbWF0aWNhbGx5LiBJZiBwb3N0ZGF0YSBpcyBhbiBYTUwgRG9jdW1lbnQsIGl0IGlzIGhhbmRsZWQuIElmXG4gICAgICogdGhlIENvbnRlbnQtVHlwZSBoZWFkZXIgaXMgc2V0IHRvICdhcHBsaWNhdGlvbi9qc29uJyB0aGVuIHRoZSBwb3N0ZGF0YSBpcyBKU09OIHN0cmluZ2lmaWVkLlxuICAgICAqIE90aGVyd2lzZSwgYnkgZGVmYXVsdCwgdGhlIGRhdGEgaXMgc2VudCBhcyBmb3JtLXVybGVuY29kZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXRyeV0gLSBJZiB0cnVlIHRoZW4gaWYgdGhlIHJlcXVlc3QgZmFpbHMgaXQgd2lsbCBiZSByZXRyaWVkIHdpdGggYW4gZXhwb25lbnRpYWwgYmFja29mZi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cmllc10gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIHJldHJpZXMuIERlZmF1bHRzIHRvIDUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heFJldHJ5RGVsYXldIC0gSWYgb3B0aW9ucy5yZXRyeSBpcyB0cnVlIHRoaXMgc3BlY2lmaWVzIHRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgYmV0d2VlbiByZXRyaWVzIGluIG1pbGxpc2Vjb25kcy4gRGVmYXVsdHMgdG8gNTAwMC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5kZWwoXCJodHRwOi8vZXhhbXBsZS5jb20vXCIsIHsgXCJyZXRyeVwiOiB0cnVlLCBcIm1heFJldHJpZXNcIjogNSB9LCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgZGVsKHVybCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnREVMRVRFJywgdXJsLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNyZXF1ZXN0XG4gICAgICogQGRlc2NyaXB0aW9uIE1ha2UgYSBnZW5lcmFsIHB1cnBvc2UgSFRUUCByZXF1ZXN0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXRob2QgLSBUaGUgSFRUUCBtZXRob2QgXCJHRVRcIiwgXCJQT1NUXCIsIFwiUFVUXCIsIFwiREVMRVRFXCIuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSB1cmwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5yZXF1ZXN0KFwiZ2V0XCIsIFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNyZXF1ZXN0XG4gICAgICogQHZhcmlhdGlvbiAyXG4gICAgICogQGRlc2NyaXB0aW9uIE1ha2UgYSBnZW5lcmFsIHB1cnBvc2UgSFRUUCByZXF1ZXN0IHdpdGggYWRkaXRpb25hbCBvcHRpb25zIHN1Y2ggYXMgaGVhZGVycywgcmV0cmllcywgY3JlZGVudGlhbHMsIGV0Yy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWV0aG9kIC0gVGhlIEhUVFAgbWV0aG9kIFwiR0VUXCIsIFwiUE9TVFwiLCBcIlBVVFwiLCBcIkRFTEVURVwiLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgdXJsIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBBZGRpdGlvbmFsIG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLmhlYWRlcnNdIC0gSFRUUCBoZWFkZXJzIHRvIGFkZCB0byB0aGUgcmVxdWVzdC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFzeW5jXSAtIE1ha2UgdGhlIHJlcXVlc3QgYXN5bmNocm9ub3VzbHkuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jYWNoZV0gLSBJZiBmYWxzZSwgdGhlbiBhZGQgYSB0aW1lc3RhbXAgdG8gdGhlIHJlcXVlc3QgdG8gcHJldmVudCBjYWNoaW5nLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMud2l0aENyZWRlbnRpYWxzXSAtIFNlbmQgY29va2llcyB3aXRoIHRoaXMgcmVxdWVzdC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXRyeV0gLSBJZiB0cnVlIHRoZW4gaWYgdGhlIHJlcXVlc3QgZmFpbHMgaXQgd2lsbCBiZSByZXRyaWVkIHdpdGggYW4gZXhwb25lbnRpYWwgYmFja29mZi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cmllc10gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIHJldHJpZXMuIERlZmF1bHRzIHRvIDUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heFJldHJ5RGVsYXldIC0gSWYgb3B0aW9ucy5yZXRyeSBpcyB0cnVlIHRoaXMgc3BlY2lmaWVzIHRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgYmV0d2VlbiByZXRyaWVzIGluIG1pbGxpc2Vjb25kcy4gRGVmYXVsdHMgdG8gNTAwMC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMucmVzcG9uc2VUeXBlXSAtIE92ZXJyaWRlIHRoZSByZXNwb25zZSB0eXBlLlxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnR8b2JqZWN0fSBbb3B0aW9ucy5wb3N0ZGF0YV0gLSBEYXRhIHRvIHNlbmQgaW4gdGhlIGJvZHkgb2YgdGhlIHJlcXVlc3QuXG4gICAgICogU29tZSBjb250ZW50IHR5cGVzIGFyZSBoYW5kbGVkIGF1dG9tYXRpY2FsbHkuIElmIHBvc3RkYXRhIGlzIGFuIFhNTCBEb2N1bWVudCwgaXQgaXMgaGFuZGxlZC4gSWZcbiAgICAgKiB0aGUgQ29udGVudC1UeXBlIGhlYWRlciBpcyBzZXQgdG8gJ2FwcGxpY2F0aW9uL2pzb24nIHRoZW4gdGhlIHBvc3RkYXRhIGlzIEpTT04gc3RyaW5naWZpZWQuXG4gICAgICogT3RoZXJ3aXNlLCBieSBkZWZhdWx0LCB0aGUgZGF0YSBpcyBzZW50IGFzIGZvcm0tdXJsZW5jb2RlZC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5yZXF1ZXN0KFwiZ2V0XCIsIFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCB7IFwicmV0cnlcIjogdHJ1ZSwgXCJtYXhSZXRyaWVzXCI6IDUgfSwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2cocmVzcG9uc2UpO1xuICAgICAqIH0pO1xuICAgICAqIEByZXR1cm5zIHtYTUxIdHRwUmVxdWVzdH0gVGhlIHJlcXVlc3Qgb2JqZWN0LlxuICAgICAqL1xuICAgIHJlcXVlc3QobWV0aG9kLCB1cmwsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIGxldCB1cmksIHF1ZXJ5LCBwb3N0ZGF0YTtcbiAgICAgICAgbGV0IGVycm9yZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHJldHJ5YWJsZSB3ZSBhcmUgZ29pbmcgdG8gc3RvcmUgbmV3IHByb3BlcnRpZXNcbiAgICAgICAgLy8gaW4gdGhlIG9wdGlvbnMgc28gY3JlYXRlIGEgbmV3IGNvcHkgdG8gbm90IGFmZmVjdFxuICAgICAgICAvLyB0aGUgb3JpZ2luYWxcbiAgICAgICAgaWYgKG9wdGlvbnMucmV0cnkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgICAgICAgICAgICByZXRyaWVzOiAwLFxuICAgICAgICAgICAgICAgIG1heFJldHJpZXM6IDVcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RvcmUgY2FsbGJhY2tcbiAgICAgICAgb3B0aW9ucy5jYWxsYmFjayA9IGNhbGxiYWNrO1xuXG4gICAgICAgIC8vIHNldHVwIGRlZmF1bHRzXG4gICAgICAgIGlmIChvcHRpb25zLmFzeW5jID09IG51bGwpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuYXN5bmMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmhlYWRlcnMgPT0gbnVsbCkge1xuICAgICAgICAgICAgb3B0aW9ucy5oZWFkZXJzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5wb3N0ZGF0YSAhPSBudWxsKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5wb3N0ZGF0YSBpbnN0YW5jZW9mIERvY3VtZW50KSB7XG4gICAgICAgICAgICAgICAgLy8gSXQncyBhbiBYTUwgZG9jdW1lbnQsIHNvIHdlIGNhbiBzZW5kIGl0IGRpcmVjdGx5LlxuICAgICAgICAgICAgICAgIC8vIFhNTEh0dHBSZXF1ZXN0IHdpbGwgc2V0IHRoZSBjb250ZW50IHR5cGUgY29ycmVjdGx5LlxuICAgICAgICAgICAgICAgIHBvc3RkYXRhID0gb3B0aW9ucy5wb3N0ZGF0YTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5wb3N0ZGF0YSBpbnN0YW5jZW9mIEZvcm1EYXRhKSB7XG4gICAgICAgICAgICAgICAgcG9zdGRhdGEgPSBvcHRpb25zLnBvc3RkYXRhO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnBvc3RkYXRhIGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgLy8gTm93IHRvIHdvcmsgb3V0IGhvdyB0byBlbmNvZGUgdGhlIHBvc3QgZGF0YSBiYXNlZCBvbiB0aGUgaGVhZGVyc1xuICAgICAgICAgICAgICAgIGxldCBjb250ZW50VHlwZSA9IG9wdGlvbnMuaGVhZGVyc1snQ29udGVudC1UeXBlJ107XG5cbiAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBubyB0eXBlIHRoZW4gZGVmYXVsdCB0byBmb3JtLWVuY29kZWRcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudFR5cGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gSHR0cC5Db250ZW50VHlwZS5GT1JNX1VSTEVOQ09ERUQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRUeXBlID0gb3B0aW9ucy5oZWFkZXJzWydDb250ZW50LVR5cGUnXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3dpdGNoIChjb250ZW50VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEh0dHAuQ29udGVudFR5cGUuRk9STV9VUkxFTkNPREVEOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOb3JtYWwgVVJMIGVuY29kZWQgZm9ybSBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0ZGF0YSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJGaXJzdEl0ZW0gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBMb29wIHJvdW5kIGVhY2ggZW50cnkgaW4gdGhlIG1hcCBhbmQgZW5jb2RlIHRoZW0gaW50byB0aGUgcG9zdCBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBvcHRpb25zLnBvc3RkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucG9zdGRhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYkZpcnN0SXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYkZpcnN0SXRlbSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zdGRhdGEgKz0gJyYnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW5jb2RlZEtleSA9IGVuY29kZVVSSUNvbXBvbmVudChrZXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbmNvZGVkVmFsdWUgPSBlbmNvZGVVUklDb21wb25lbnQob3B0aW9ucy5wb3N0ZGF0YVtrZXldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zdGRhdGEgKz0gYCR7ZW5jb2RlZEtleX09JHtlbmNvZGVkVmFsdWV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEh0dHAuQ29udGVudFR5cGUuSlNPTjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb250ZW50VHlwZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5oZWFkZXJzWydDb250ZW50LVR5cGUnXSA9IEh0dHAuQ29udGVudFR5cGUuSlNPTjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc3RkYXRhID0gSlNPTi5zdHJpbmdpZnkob3B0aW9ucy5wb3N0ZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBvc3RkYXRhID0gb3B0aW9ucy5wb3N0ZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmNhY2hlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgLy8gQWRkIHRpbWVzdGFtcCB0byB1cmwgdG8gcHJldmVudCBicm93c2VyIGNhY2hpbmcgZmlsZVxuICAgICAgICAgICAgY29uc3QgdGltZXN0YW1wID0gbm93KCk7XG5cbiAgICAgICAgICAgIHVyaSA9IG5ldyBVUkkodXJsKTtcbiAgICAgICAgICAgIGlmICghdXJpLnF1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgdXJpLnF1ZXJ5ID0gJ3RzPScgKyB0aW1lc3RhbXA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVyaS5xdWVyeSA9IHVyaS5xdWVyeSArICcmdHM9JyArIHRpbWVzdGFtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVybCA9IHVyaS50b1N0cmluZygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucXVlcnkpIHtcbiAgICAgICAgICAgIHVyaSA9IG5ldyBVUkkodXJsKTtcbiAgICAgICAgICAgIHF1ZXJ5ID0gZXh0ZW5kKHVyaS5nZXRRdWVyeSgpLCBvcHRpb25zLnF1ZXJ5KTtcbiAgICAgICAgICAgIHVyaS5zZXRRdWVyeShxdWVyeSk7XG4gICAgICAgICAgICB1cmwgPSB1cmkudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICB4aHIub3BlbihtZXRob2QsIHVybCwgb3B0aW9ucy5hc3luYyk7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSBvcHRpb25zLndpdGhDcmVkZW50aWFscyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aXRoQ3JlZGVudGlhbHMgOiBmYWxzZTtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IG9wdGlvbnMucmVzcG9uc2VUeXBlIHx8IHRoaXMuX2d1ZXNzUmVzcG9uc2VUeXBlKHVybCk7XG5cbiAgICAgICAgLy8gU2V0IHRoZSBodHRwIGhlYWRlcnNcbiAgICAgICAgZm9yIChjb25zdCBoZWFkZXIgaW4gb3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oZWFkZXJzLmhhc093blByb3BlcnR5KGhlYWRlcikpIHtcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXIsIG9wdGlvbnMuaGVhZGVyc1toZWFkZXJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vblJlYWR5U3RhdGVDaGFuZ2UobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocik7XG4gICAgICAgIH07XG5cbiAgICAgICAgeGhyLm9uZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vbkVycm9yKG1ldGhvZCwgdXJsLCBvcHRpb25zLCB4aHIpO1xuICAgICAgICAgICAgZXJyb3JlZCA9IHRydWU7XG4gICAgICAgIH07XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHhoci5zZW5kKHBvc3RkYXRhKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gRFdFOiBEb24ndCBjYWxsYmFjayBvbiBleGNlcHRpb25zIGFzIGJlaGF2aW9yIGlzIGluY29uc2lzdGVudCwgZS5nLiBjcm9zcy1kb21haW4gcmVxdWVzdCBlcnJvcnMgZG9uJ3QgdGhyb3cgYW4gZXhjZXB0aW9uLlxuICAgICAgICAgICAgLy8gRXJyb3IgY2FsbGJhY2sgc2hvdWxkIGJlIGNhbGxlZCBieSB4aHIub25lcnJvcigpIGNhbGxiYWNrIGluc3RlYWQuXG4gICAgICAgICAgICBpZiAoIWVycm9yZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLmVycm9yKHhoci5zdGF0dXMsIHhociwgZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXR1cm4gdGhlIHJlcXVlc3Qgb2JqZWN0IGFzIGl0IGNhbiBiZSBoYW5keSBmb3IgYmxvY2tpbmcgY2FsbHNcbiAgICAgICAgcmV0dXJuIHhocjtcbiAgICB9XG5cbiAgICBfZ3Vlc3NSZXNwb25zZVR5cGUodXJsKSB7XG4gICAgICAgIGNvbnN0IHVyaSA9IG5ldyBVUkkodXJsKTtcbiAgICAgICAgY29uc3QgZXh0ID0gcGF0aC5nZXRFeHRlbnNpb24odXJpLnBhdGgpO1xuXG4gICAgICAgIGlmIChIdHRwLmJpbmFyeUV4dGVuc2lvbnMuaW5kZXhPZihleHQpID49IDApIHtcbiAgICAgICAgICAgIHJldHVybiBIdHRwLlJlc3BvbnNlVHlwZS5BUlJBWV9CVUZGRVI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXh0ID09PSAnLnhtbCcpIHtcbiAgICAgICAgICAgIHJldHVybiBIdHRwLlJlc3BvbnNlVHlwZS5ET0NVTUVOVDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBIdHRwLlJlc3BvbnNlVHlwZS5URVhUO1xuICAgIH1cblxuICAgIF9pc0JpbmFyeUNvbnRlbnRUeXBlKGNvbnRlbnRUeXBlKSB7XG4gICAgICAgIGNvbnN0IGJpblR5cGVzID0gW1xuICAgICAgICAgICAgSHR0cC5Db250ZW50VHlwZS5CQVNJUyxcbiAgICAgICAgICAgIEh0dHAuQ29udGVudFR5cGUuQklOLFxuICAgICAgICAgICAgSHR0cC5Db250ZW50VHlwZS5ERFMsXG4gICAgICAgICAgICBIdHRwLkNvbnRlbnRUeXBlLkdMQixcbiAgICAgICAgICAgIEh0dHAuQ29udGVudFR5cGUuTVAzLFxuICAgICAgICAgICAgSHR0cC5Db250ZW50VHlwZS5NUDQsXG4gICAgICAgICAgICBIdHRwLkNvbnRlbnRUeXBlLk9HRyxcbiAgICAgICAgICAgIEh0dHAuQ29udGVudFR5cGUuT1BVUyxcbiAgICAgICAgICAgIEh0dHAuQ29udGVudFR5cGUuV0FWXG4gICAgICAgIF07XG4gICAgICAgIGlmIChiaW5UeXBlcy5pbmRleE9mKGNvbnRlbnRUeXBlKSA+PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfaXNCaW5hcnlSZXNwb25zZVR5cGUocmVzcG9uc2VUeXBlKSB7XG4gICAgICAgIHJldHVybiByZXNwb25zZVR5cGUgPT09IEh0dHAuUmVzcG9uc2VUeXBlLkFSUkFZX0JVRkZFUiB8fFxuICAgICAgICAgICAgICAgcmVzcG9uc2VUeXBlID09PSBIdHRwLlJlc3BvbnNlVHlwZS5CTE9CIHx8XG4gICAgICAgICAgICAgICByZXNwb25zZVR5cGUgPT09IEh0dHAuUmVzcG9uc2VUeXBlLkpTT047XG4gICAgfVxuXG4gICAgX29uUmVhZHlTdGF0ZUNoYW5nZShtZXRob2QsIHVybCwgb3B0aW9ucywgeGhyKSB7XG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgc3dpdGNoICh4aHIuc3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAwOiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHN0YXR1cyBjb2RlIDAsIGl0IGlzIGFzc3VtZWQgdGhhdCB0aGUgYnJvd3NlciBoYXMgY2FuY2VsbGVkIHRoZSByZXF1ZXN0XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQWRkIHN1cHBvcnQgZm9yIHJ1bm5pbmcgQ2hyb21lIGJyb3dzZXJzIGluICdhbGxvdy1maWxlLWFjY2Vzcy1mcm9tLWZpbGUnXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgdG8gYWxsb3cgZm9yIHNwZWNpYWxpemVkIHByb2dyYW1zIGFuZCBsaWJyYXJpZXMgc3VjaCBhcyBDZWZTaGFycFxuICAgICAgICAgICAgICAgICAgICAvLyB3aGljaCBlbWJlZCBDaHJvbWl1bSBpbiB0aGUgbmF0aXZlIGFwcC5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHhoci5yZXNwb25zZVVSTCAmJiB4aHIucmVzcG9uc2VVUkwuc3RhcnRzV2l0aCgnZmlsZTovLy8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQXNzdW1lIHRoYXQgYW55IGZpbGUgbG9hZGVkIGZyb20gZGlzayBpcyBmaW5lXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vblN1Y2Nlc3MobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkVycm9yKG1ldGhvZCwgdXJsLCBvcHRpb25zLCB4aHIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlIDIwMDpcbiAgICAgICAgICAgICAgICBjYXNlIDIwMTpcbiAgICAgICAgICAgICAgICBjYXNlIDIwNjpcbiAgICAgICAgICAgICAgICBjYXNlIDMwNDoge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vblN1Y2Nlc3MobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocik7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29uRXJyb3IobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocik7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblN1Y2Nlc3MobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocikge1xuICAgICAgICBsZXQgcmVzcG9uc2U7XG4gICAgICAgIGxldCBjb250ZW50VHlwZTtcbiAgICAgICAgY29uc3QgaGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVR5cGUnKTtcbiAgICAgICAgaWYgKGhlYWRlcikge1xuICAgICAgICAgICAgLy8gU3BsaXQgdXAgaGVhZGVyIGludG8gY29udGVudCB0eXBlIGFuZCBwYXJhbWV0ZXJcbiAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gaGVhZGVyLnNwbGl0KCc7Jyk7XG4gICAgICAgICAgICBjb250ZW50VHlwZSA9IHBhcnRzWzBdLnRyaW0oKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgdGhlIGNvbnRlbnQgdHlwZSB0byBzZWUgaWYgd2Ugd2FudCB0byBwYXJzZSBpdFxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzQmluYXJ5Q29udGVudFR5cGUoY29udGVudFR5cGUpIHx8IHRoaXMuX2lzQmluYXJ5UmVzcG9uc2VUeXBlKHhoci5yZXNwb25zZVR5cGUpKSB7XG4gICAgICAgICAgICAgICAgLy8gSXQncyBhIGJpbmFyeSByZXNwb25zZVxuICAgICAgICAgICAgICAgIHJlc3BvbnNlID0geGhyLnJlc3BvbnNlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250ZW50VHlwZSA9PT0gSHR0cC5Db250ZW50VHlwZS5KU09OIHx8IHVybC5zcGxpdCgnPycpWzBdLmVuZHNXaXRoKCcuanNvbicpKSB7XG4gICAgICAgICAgICAgICAgLy8gSXQncyBhIEpTT04gcmVzcG9uc2VcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHhoci5yZXNwb25zZVR5cGUgPT09IEh0dHAuUmVzcG9uc2VUeXBlLkRPQ1VNRU5UIHx8IGNvbnRlbnRUeXBlID09PSBIdHRwLkNvbnRlbnRUeXBlLlhNTCkge1xuICAgICAgICAgICAgICAgIC8vIEl0J3MgYW4gWE1MIHJlc3BvbnNlXG4gICAgICAgICAgICAgICAgcmVzcG9uc2UgPSB4aHIucmVzcG9uc2VYTUw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEl0J3MgcmF3IGRhdGFcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG9wdGlvbnMuY2FsbGJhY2sobnVsbCwgcmVzcG9uc2UpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkVycm9yKG1ldGhvZCwgdXJsLCBvcHRpb25zLCB4aHIpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMucmV0cnlpbmcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJldHJ5IGlmIG5lY2Vzc2FyeVxuICAgICAgICBpZiAob3B0aW9ucy5yZXRyeSAmJiBvcHRpb25zLnJldHJpZXMgPCBvcHRpb25zLm1heFJldHJpZXMpIHtcbiAgICAgICAgICAgIG9wdGlvbnMucmV0cmllcysrO1xuICAgICAgICAgICAgb3B0aW9ucy5yZXRyeWluZyA9IHRydWU7IC8vIHVzZWQgdG8gc3RvcCByZXRyeWluZyB3aGVuIGJvdGggb25FcnJvciBhbmQgeGhyLm9uZXJyb3IgYXJlIGNhbGxlZFxuICAgICAgICAgICAgY29uc3QgcmV0cnlEZWxheSA9IG1hdGguY2xhbXAoTWF0aC5wb3coMiwgb3B0aW9ucy5yZXRyaWVzKSAqIEh0dHAucmV0cnlEZWxheSwgMCwgb3B0aW9ucy5tYXhSZXRyeURlbGF5IHx8IDUwMDApO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYCR7bWV0aG9kfTogJHt1cmx9IC0gRXJyb3IgJHt4aHIuc3RhdHVzfS4gUmV0cnlpbmcgaW4gJHtyZXRyeURlbGF5fSBtc2ApO1xuXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnJldHJ5aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0KG1ldGhvZCwgdXJsLCBvcHRpb25zLCBvcHRpb25zLmNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0sIHJldHJ5RGVsYXkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gbW9yZSByZXRyaWVzIG9yIG5vdCByZXRyeSBzbyBqdXN0IGZhaWxcbiAgICAgICAgICAgIG9wdGlvbnMuY2FsbGJhY2soeGhyLnN0YXR1cyA9PT0gMCA/ICdOZXR3b3JrIGVycm9yJyA6IHhoci5zdGF0dXMsIG51bGwpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBodHRwID0gbmV3IEh0dHAoKTtcblxuZXhwb3J0IHsgaHR0cCwgSHR0cCB9O1xuIl0sIm5hbWVzIjpbIkh0dHAiLCJnZXQiLCJ1cmwiLCJvcHRpb25zIiwiY2FsbGJhY2siLCJyZXF1ZXN0IiwicG9zdCIsImRhdGEiLCJwb3N0ZGF0YSIsInB1dCIsImRlbCIsIm1ldGhvZCIsInVyaSIsInF1ZXJ5IiwiZXJyb3JlZCIsInJldHJ5IiwiT2JqZWN0IiwiYXNzaWduIiwicmV0cmllcyIsIm1heFJldHJpZXMiLCJhc3luYyIsImhlYWRlcnMiLCJEb2N1bWVudCIsIkZvcm1EYXRhIiwiY29udGVudFR5cGUiLCJ1bmRlZmluZWQiLCJDb250ZW50VHlwZSIsIkZPUk1fVVJMRU5DT0RFRCIsImJGaXJzdEl0ZW0iLCJrZXkiLCJoYXNPd25Qcm9wZXJ0eSIsImVuY29kZWRLZXkiLCJlbmNvZGVVUklDb21wb25lbnQiLCJlbmNvZGVkVmFsdWUiLCJKU09OIiwic3RyaW5naWZ5IiwiY2FjaGUiLCJ0aW1lc3RhbXAiLCJub3ciLCJVUkkiLCJ0b1N0cmluZyIsImV4dGVuZCIsImdldFF1ZXJ5Iiwic2V0UXVlcnkiLCJ4aHIiLCJYTUxIdHRwUmVxdWVzdCIsIm9wZW4iLCJ3aXRoQ3JlZGVudGlhbHMiLCJyZXNwb25zZVR5cGUiLCJfZ3Vlc3NSZXNwb25zZVR5cGUiLCJoZWFkZXIiLCJzZXRSZXF1ZXN0SGVhZGVyIiwib25yZWFkeXN0YXRlY2hhbmdlIiwiX29uUmVhZHlTdGF0ZUNoYW5nZSIsIm9uZXJyb3IiLCJfb25FcnJvciIsInNlbmQiLCJlIiwiZXJyb3IiLCJzdGF0dXMiLCJleHQiLCJwYXRoIiwiZ2V0RXh0ZW5zaW9uIiwiYmluYXJ5RXh0ZW5zaW9ucyIsImluZGV4T2YiLCJSZXNwb25zZVR5cGUiLCJBUlJBWV9CVUZGRVIiLCJET0NVTUVOVCIsIlRFWFQiLCJfaXNCaW5hcnlDb250ZW50VHlwZSIsImJpblR5cGVzIiwiQkFTSVMiLCJCSU4iLCJERFMiLCJHTEIiLCJNUDMiLCJNUDQiLCJPR0ciLCJPUFVTIiwiV0FWIiwiX2lzQmluYXJ5UmVzcG9uc2VUeXBlIiwiQkxPQiIsInJlYWR5U3RhdGUiLCJyZXNwb25zZVVSTCIsInN0YXJ0c1dpdGgiLCJfb25TdWNjZXNzIiwicmVzcG9uc2UiLCJnZXRSZXNwb25zZUhlYWRlciIsInBhcnRzIiwic3BsaXQiLCJ0cmltIiwiZW5kc1dpdGgiLCJwYXJzZSIsInJlc3BvbnNlVGV4dCIsIlhNTCIsInJlc3BvbnNlWE1MIiwiZXJyIiwicmV0cnlpbmciLCJyZXRyeURlbGF5IiwibWF0aCIsImNsYW1wIiwiTWF0aCIsInBvdyIsIm1heFJldHJ5RGVsYXkiLCJjb25zb2xlIiwibG9nIiwic2V0VGltZW91dCIsIkFBQyIsIkdJRiIsIkpQRUciLCJQTkciLCJodHRwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsSUFBSSxDQUFDO0FBNkNQO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxHQUFHQSxDQUFDQyxHQUFHLEVBQUVDLE9BQU8sRUFBRUMsUUFBUSxFQUFFO0FBQ3hCLElBQUEsSUFBSSxPQUFPRCxP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
