/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL25ldC9odHRwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGV4dGVuZCB9IGZyb20gJy4uLy4uL2NvcmUvY29yZS5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9jb3JlL3VyaS5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgSHR0cCNnZXR9LCB7QGxpbmsgSHR0cCNwb3N0fSwge0BsaW5rIEh0dHAjcHV0fSwge0BsaW5rIEh0dHAjZGVsfSwgYW5kXG4gKiB7QGxpbmsgSHR0cCNyZXF1ZXN0fS5cbiAqXG4gKiBAY2FsbGJhY2sgSHR0cFJlc3BvbnNlQ2FsbGJhY2tcbiAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ3xFcnJvcnxudWxsfSBlcnIgLSBUaGUgZXJyb3IgY29kZSwgbWVzc2FnZSwgb3IgZXhjZXB0aW9uIGluIHRoZSBjYXNlIHdoZXJlIHRoZSByZXF1ZXN0IGZhaWxzLlxuICogQHBhcmFtIHsqfSBbcmVzcG9uc2VdIC0gVGhlIHJlc3BvbnNlIGRhdGEgaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuIChmb3JtYXQgZGVwZW5kcyBvbiByZXNwb25zZSB0eXBlOiB0ZXh0LCBPYmplY3QsIEFycmF5QnVmZmVyLCBYTUwpLlxuICovXG5cbi8qKlxuICogVXNlZCB0byBzZW5kIGFuZCByZWNlaXZlIEhUVFAgcmVxdWVzdHMuXG4gKi9cbmNsYXNzIEh0dHAge1xuICAgIHN0YXRpYyBDb250ZW50VHlwZSA9IHtcbiAgICAgICAgQUFDOiAnYXVkaW8vYWFjJyxcbiAgICAgICAgQkFTSVM6ICdpbWFnZS9iYXNpcycsXG4gICAgICAgIEJJTjogJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXG4gICAgICAgIEREUzogJ2ltYWdlL2RkcycsXG4gICAgICAgIEZPUk1fVVJMRU5DT0RFRDogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXG4gICAgICAgIEdJRjogJ2ltYWdlL2dpZicsXG4gICAgICAgIEdMQjogJ21vZGVsL2dsdGYtYmluYXJ5JyxcbiAgICAgICAgSlBFRzogJ2ltYWdlL2pwZWcnLFxuICAgICAgICBKU09OOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIE1QMzogJ2F1ZGlvL21wZWcnLFxuICAgICAgICBNUDQ6ICdhdWRpby9tcDQnLFxuICAgICAgICBPR0c6ICdhdWRpby9vZ2cnLFxuICAgICAgICBPUFVTOiAnYXVkaW8vb2dnOyBjb2RlY3M9XCJvcHVzXCInLFxuICAgICAgICBQTkc6ICdpbWFnZS9wbmcnLFxuICAgICAgICBURVhUOiAndGV4dC9wbGFpbicsXG4gICAgICAgIFdBVjogJ2F1ZGlvL3gtd2F2JyxcbiAgICAgICAgWE1MOiAnYXBwbGljYXRpb24veG1sJ1xuICAgIH07XG5cbiAgICBzdGF0aWMgUmVzcG9uc2VUeXBlID0ge1xuICAgICAgICBURVhUOiAndGV4dCcsXG4gICAgICAgIEFSUkFZX0JVRkZFUjogJ2FycmF5YnVmZmVyJyxcbiAgICAgICAgQkxPQjogJ2Jsb2InLFxuICAgICAgICBET0NVTUVOVDogJ2RvY3VtZW50JyxcbiAgICAgICAgSlNPTjogJ2pzb24nXG4gICAgfTtcblxuICAgIHN0YXRpYyBiaW5hcnlFeHRlbnNpb25zID0gW1xuICAgICAgICAnLm1vZGVsJyxcbiAgICAgICAgJy53YXYnLFxuICAgICAgICAnLm9nZycsXG4gICAgICAgICcubXAzJyxcbiAgICAgICAgJy5tcDQnLFxuICAgICAgICAnLm00YScsXG4gICAgICAgICcuYWFjJyxcbiAgICAgICAgJy5kZHMnLFxuICAgICAgICAnLmJhc2lzJyxcbiAgICAgICAgJy5nbGInLFxuICAgICAgICAnLm9wdXMnXG4gICAgXTtcblxuICAgIHN0YXRpYyByZXRyeURlbGF5ID0gMTAwO1xuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNnZXRcbiAgICAgKiBAZGVzY3JpcHRpb24gUGVyZm9ybSBhbiBIVFRQIEdFVCByZXF1ZXN0IHRvIHRoZSBnaXZlbiB1cmwuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5nZXQoXCJodHRwOi8vZXhhbXBsZS5jb20vXCIsIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFRoZSByZXF1ZXN0IG9iamVjdC5cbiAgICAgKi9cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBIdHRwI2dldFxuICAgICAqIEB2YXJpYXRpb24gMlxuICAgICAqIEBkZXNjcmlwdGlvbiBQZXJmb3JtIGFuIEhUVFAgR0VUIHJlcXVlc3QgdG8gdGhlIGdpdmVuIHVybCB3aXRoIGFkZGl0aW9uYWwgb3B0aW9ucyBzdWNoIGFzIGhlYWRlcnMsIHJldHJpZXMsIGNyZWRlbnRpYWxzLCBldGMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIEFkZGl0aW9uYWwgb3B0aW9ucy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnMuaGVhZGVyc10gLSBIVFRQIGhlYWRlcnMgdG8gYWRkIHRvIHRoZSByZXF1ZXN0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuYXN5bmNdIC0gTWFrZSB0aGUgcmVxdWVzdCBhc3luY2hyb25vdXNseS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNhY2hlXSAtIElmIGZhbHNlLCB0aGVuIGFkZCBhIHRpbWVzdGFtcCB0byB0aGUgcmVxdWVzdCB0byBwcmV2ZW50IGNhY2hpbmcuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy53aXRoQ3JlZGVudGlhbHNdIC0gU2VuZCBjb29raWVzIHdpdGggdGhpcyByZXF1ZXN0LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMucmVzcG9uc2VUeXBlXSAtIE92ZXJyaWRlIHRoZSByZXNwb25zZSB0eXBlLlxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnR8b2JqZWN0fSBbb3B0aW9ucy5wb3N0ZGF0YV0gLSBEYXRhIHRvIHNlbmQgaW4gdGhlIGJvZHkgb2YgdGhlIHJlcXVlc3QuXG4gICAgICogU29tZSBjb250ZW50IHR5cGVzIGFyZSBoYW5kbGVkIGF1dG9tYXRpY2FsbHkuIElmIHBvc3RkYXRhIGlzIGFuIFhNTCBEb2N1bWVudCwgaXQgaXMgaGFuZGxlZC4gSWZcbiAgICAgKiB0aGUgQ29udGVudC1UeXBlIGhlYWRlciBpcyBzZXQgdG8gJ2FwcGxpY2F0aW9uL2pzb24nIHRoZW4gdGhlIHBvc3RkYXRhIGlzIEpTT04gc3RyaW5naWZpZWQuXG4gICAgICogT3RoZXJ3aXNlLCBieSBkZWZhdWx0LCB0aGUgZGF0YSBpcyBzZW50IGFzIGZvcm0tdXJsZW5jb2RlZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnJldHJ5XSAtIElmIHRydWUgdGhlbiBpZiB0aGUgcmVxdWVzdCBmYWlscyBpdCB3aWxsIGJlIHJldHJpZWQgd2l0aCBhbiBleHBvbmVudGlhbCBiYWNrb2ZmLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhSZXRyaWVzXSAtIElmIG9wdGlvbnMucmV0cnkgaXMgdHJ1ZSB0aGlzIHNwZWNpZmllcyB0aGUgbWF4aW11bSBudW1iZXIgb2YgcmV0cmllcy4gRGVmYXVsdHMgdG8gNS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cnlEZWxheV0gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gYW1vdW50IG9mIHRpbWUgdG8gd2FpdCBiZXR3ZWVuIHJldHJpZXMgaW4gbWlsbGlzZWNvbmRzLiBEZWZhdWx0cyB0byA1MDAwLlxuICAgICAqIEBwYXJhbSB7SHR0cFJlc3BvbnNlQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIGNhbGxiYWNrIHVzZWQgd2hlbiB0aGUgcmVzcG9uc2UgaGFzIHJldHVybmVkLiBQYXNzZWQgKGVyciwgZGF0YSlcbiAgICAgKiB3aGVyZSBkYXRhIGlzIHRoZSByZXNwb25zZSAoZm9ybWF0IGRlcGVuZHMgb24gcmVzcG9uc2UgdHlwZTogdGV4dCwgT2JqZWN0LCBBcnJheUJ1ZmZlciwgWE1MKSBhbmRcbiAgICAgKiBlcnIgaXMgdGhlIGVycm9yIGNvZGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5odHRwLmdldChcImh0dHA6Ly9leGFtcGxlLmNvbS9cIiwgeyBcInJldHJ5XCI6IHRydWUsIFwibWF4UmV0cmllc1wiOiA1IH0sIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFRoZSByZXF1ZXN0IG9iamVjdC5cbiAgICAgKi9cbiAgICBnZXQodXJsLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCB1cmwsIG9wdGlvbnMsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBIdHRwI3Bvc3RcbiAgICAgKiBAZGVzY3JpcHRpb24gUGVyZm9ybSBhbiBIVFRQIFBPU1QgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gdXJsLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBEYXRhIHRvIHNlbmQgaW4gdGhlIGJvZHkgb2YgdGhlIHJlcXVlc3QuXG4gICAgICogU29tZSBjb250ZW50IHR5cGVzIGFyZSBoYW5kbGVkIGF1dG9tYXRpY2FsbHkuIElmIHBvc3RkYXRhIGlzIGFuIFhNTCBEb2N1bWVudCwgaXQgaXMgaGFuZGxlZC4gSWZcbiAgICAgKiB0aGUgQ29udGVudC1UeXBlIGhlYWRlciBpcyBzZXQgdG8gJ2FwcGxpY2F0aW9uL2pzb24nIHRoZW4gdGhlIHBvc3RkYXRhIGlzIEpTT04gc3RyaW5naWZpZWQuXG4gICAgICogT3RoZXJ3aXNlLCBieSBkZWZhdWx0LCB0aGUgZGF0YSBpcyBzZW50IGFzIGZvcm0tdXJsZW5jb2RlZC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5wb3N0KFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCB7IFwibmFtZVwiOiBcIkFsaXhcIiB9LCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNwb3N0XG4gICAgICogQHZhcmlhdGlvbiAyXG4gICAgICogQGRlc2NyaXB0aW9uIFBlcmZvcm0gYW4gSFRUUCBQT1NUIHJlcXVlc3QgdG8gdGhlIGdpdmVuIHVybCB3aXRoIGFkZGl0aW9uYWwgb3B0aW9ucyBzdWNoIGFzIGhlYWRlcnMsIHJldHJpZXMsIGNyZWRlbnRpYWxzLCBldGMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIERhdGEgdG8gc2VuZCBpbiB0aGUgYm9keSBvZiB0aGUgcmVxdWVzdC5cbiAgICAgKiBTb21lIGNvbnRlbnQgdHlwZXMgYXJlIGhhbmRsZWQgYXV0b21hdGljYWxseS4gSWYgcG9zdGRhdGEgaXMgYW4gWE1MIERvY3VtZW50LCBpdCBpcyBoYW5kbGVkLiBJZlxuICAgICAqIHRoZSBDb250ZW50LVR5cGUgaGVhZGVyIGlzIHNldCB0byAnYXBwbGljYXRpb24vanNvbicgdGhlbiB0aGUgcG9zdGRhdGEgaXMgSlNPTiBzdHJpbmdpZmllZC5cbiAgICAgKiBPdGhlcndpc2UsIGJ5IGRlZmF1bHQsIHRoZSBkYXRhIGlzIHNlbnQgYXMgZm9ybS11cmxlbmNvZGVkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gQWRkaXRpb25hbCBvcHRpb25zLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzXSAtIEhUVFAgaGVhZGVycyB0byBhZGQgdG8gdGhlIHJlcXVlc3QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hc3luY10gLSBNYWtlIHRoZSByZXF1ZXN0IGFzeW5jaHJvbm91c2x5LiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY2FjaGVdIC0gSWYgZmFsc2UsIHRoZW4gYWRkIGEgdGltZXN0YW1wIHRvIHRoZSByZXF1ZXN0IHRvIHByZXZlbnQgY2FjaGluZy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLndpdGhDcmVkZW50aWFsc10gLSBTZW5kIGNvb2tpZXMgd2l0aCB0aGlzIHJlcXVlc3QuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5yZXNwb25zZVR5cGVdIC0gT3ZlcnJpZGUgdGhlIHJlc3BvbnNlIHR5cGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXRyeV0gLSBJZiB0cnVlIHRoZW4gaWYgdGhlIHJlcXVlc3QgZmFpbHMgaXQgd2lsbCBiZSByZXRyaWVkIHdpdGggYW4gZXhwb25lbnRpYWwgYmFja29mZi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cmllc10gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIHJldHJpZXMuIERlZmF1bHRzIHRvIDUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heFJldHJ5RGVsYXldIC0gSWYgb3B0aW9ucy5yZXRyeSBpcyB0cnVlIHRoaXMgc3BlY2lmaWVzIHRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgYmV0d2VlbiByZXRyaWVzIGluIG1pbGxpc2Vjb25kcy4gRGVmYXVsdHMgdG8gNTAwMC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5wb3N0KFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCB7IFwibmFtZVwiOiBcIkFsaXhcIiB9LCB7IFwicmV0cnlcIjogdHJ1ZSwgXCJtYXhSZXRyaWVzXCI6IDUgfSwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2cocmVzcG9uc2UpO1xuICAgICAqIH0pO1xuICAgICAqIEByZXR1cm5zIHtYTUxIdHRwUmVxdWVzdH0gVGhlIHJlcXVlc3Qgb2JqZWN0LlxuICAgICAqL1xuICAgIHBvc3QodXJsLCBkYXRhLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBvcHRpb25zLnBvc3RkYXRhID0gZGF0YTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUE9TVCcsIHVybCwgb3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIEh0dHAjcHV0XG4gICAgICogQGRlc2NyaXB0aW9uIFBlcmZvcm0gYW4gSFRUUCBQVVQgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gdXJsLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtEb2N1bWVudHxvYmplY3R9IGRhdGEgLSBEYXRhIHRvIHNlbmQgaW4gdGhlIGJvZHkgb2YgdGhlIHJlcXVlc3QuXG4gICAgICogU29tZSBjb250ZW50IHR5cGVzIGFyZSBoYW5kbGVkIGF1dG9tYXRpY2FsbHkuIElmIHBvc3RkYXRhIGlzIGFuIFhNTCBEb2N1bWVudCwgaXQgaXMgaGFuZGxlZC4gSWZcbiAgICAgKiB0aGUgQ29udGVudC1UeXBlIGhlYWRlciBpcyBzZXQgdG8gJ2FwcGxpY2F0aW9uL2pzb24nIHRoZW4gdGhlIHBvc3RkYXRhIGlzIEpTT04gc3RyaW5naWZpZWQuXG4gICAgICogT3RoZXJ3aXNlLCBieSBkZWZhdWx0LCB0aGUgZGF0YSBpcyBzZW50IGFzIGZvcm0tdXJsZW5jb2RlZC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5wdXQoXCJodHRwOi8vZXhhbXBsZS5jb20vXCIsIHsgXCJuYW1lXCI6IFwiQWxpeFwiIH0sIGZ1bmN0aW9uIChlcnIsIHJlc3BvbnNlKSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlKTtcbiAgICAgKiB9KTtcbiAgICAgKiBAcmV0dXJucyB7WE1MSHR0cFJlcXVlc3R9IFRoZSByZXF1ZXN0IG9iamVjdC5cbiAgICAgKi9cbiAgICAvKipcbiAgICAgKiBAZnVuY3Rpb25cbiAgICAgKiBAbmFtZSBIdHRwI3B1dFxuICAgICAqIEB2YXJpYXRpb24gMlxuICAgICAqIEBkZXNjcmlwdGlvbiBQZXJmb3JtIGFuIEhUVFAgUFVUIHJlcXVlc3QgdG8gdGhlIGdpdmVuIHVybCB3aXRoIGFkZGl0aW9uYWwgb3B0aW9ucyBzdWNoIGFzIGhlYWRlcnMsIHJldHJpZXMsIGNyZWRlbnRpYWxzLCBldGMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50fG9iamVjdH0gZGF0YSAtIERhdGEgdG8gc2VuZCBpbiB0aGUgYm9keSBvZiB0aGUgcmVxdWVzdC5cbiAgICAgKiBTb21lIGNvbnRlbnQgdHlwZXMgYXJlIGhhbmRsZWQgYXV0b21hdGljYWxseS4gSWYgcG9zdGRhdGEgaXMgYW4gWE1MIERvY3VtZW50LCBpdCBpcyBoYW5kbGVkLiBJZlxuICAgICAqIHRoZSBDb250ZW50LVR5cGUgaGVhZGVyIGlzIHNldCB0byAnYXBwbGljYXRpb24vanNvbicgdGhlbiB0aGUgcG9zdGRhdGEgaXMgSlNPTiBzdHJpbmdpZmllZC5cbiAgICAgKiBPdGhlcndpc2UsIGJ5IGRlZmF1bHQsIHRoZSBkYXRhIGlzIHNlbnQgYXMgZm9ybS11cmxlbmNvZGVkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBvcHRpb25zIC0gQWRkaXRpb25hbCBvcHRpb25zLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9ucy5oZWFkZXJzXSAtIEhUVFAgaGVhZGVycyB0byBhZGQgdG8gdGhlIHJlcXVlc3QuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5hc3luY10gLSBNYWtlIHRoZSByZXF1ZXN0IGFzeW5jaHJvbm91c2x5LiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY2FjaGVdIC0gSWYgZmFsc2UsIHRoZW4gYWRkIGEgdGltZXN0YW1wIHRvIHRoZSByZXF1ZXN0IHRvIHByZXZlbnQgY2FjaGluZy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLndpdGhDcmVkZW50aWFsc10gLSBTZW5kIGNvb2tpZXMgd2l0aCB0aGlzIHJlcXVlc3QuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5yZXNwb25zZVR5cGVdIC0gT3ZlcnJpZGUgdGhlIHJlc3BvbnNlIHR5cGUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXRyeV0gLSBJZiB0cnVlIHRoZW4gaWYgdGhlIHJlcXVlc3QgZmFpbHMgaXQgd2lsbCBiZSByZXRyaWVkIHdpdGggYW4gZXhwb25lbnRpYWwgYmFja29mZi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cmllc10gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIHJldHJpZXMuIERlZmF1bHRzIHRvIDUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heFJldHJ5RGVsYXldIC0gSWYgb3B0aW9ucy5yZXRyeSBpcyB0cnVlIHRoaXMgc3BlY2lmaWVzIHRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgYmV0d2VlbiByZXRyaWVzIGluIG1pbGxpc2Vjb25kcy4gRGVmYXVsdHMgdG8gNTAwMC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5wdXQoXCJodHRwOi8vZXhhbXBsZS5jb20vXCIsIHsgXCJuYW1lXCI6IFwiQWxpeFwiIH0sIHsgXCJyZXRyeVwiOiB0cnVlLCBcIm1heFJldHJpZXNcIjogNSB9LCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgcHV0KHVybCwgZGF0YSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgb3B0aW9ucy5wb3N0ZGF0YSA9IGRhdGE7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BVVCcsIHVybCwgb3B0aW9ucywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIEh0dHAjZGVsXG4gICAgICogQGRlc2NyaXB0aW9uIFBlcmZvcm0gYW4gSFRUUCBERUxFVEUgcmVxdWVzdCB0byB0aGUgZ2l2ZW4gdXJsLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB1cmwgLSBUaGUgVVJMIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtIdHRwUmVzcG9uc2VDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2sgdXNlZCB3aGVuIHRoZSByZXNwb25zZSBoYXMgcmV0dXJuZWQuIFBhc3NlZCAoZXJyLCBkYXRhKVxuICAgICAqIHdoZXJlIGRhdGEgaXMgdGhlIHJlc3BvbnNlIChmb3JtYXQgZGVwZW5kcyBvbiByZXNwb25zZSB0eXBlOiB0ZXh0LCBPYmplY3QsIEFycmF5QnVmZmVyLCBYTUwpIGFuZFxuICAgICAqIGVyciBpcyB0aGUgZXJyb3IgY29kZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLmh0dHAuZGVsKFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNkZWxcbiAgICAgKiBAdmFyaWF0aW9uIDJcbiAgICAgKiBAZGVzY3JpcHRpb24gUGVyZm9ybSBhbiBIVFRQIERFTEVURSByZXF1ZXN0IHRvIHRoZSBnaXZlbiB1cmwgd2l0aCBhZGRpdGlvbmFsIG9wdGlvbnMgc3VjaCBhcyBoZWFkZXJzLCByZXRyaWVzLCBjcmVkZW50aWFscywgZXRjLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB1cmwgLSBUaGUgVVJMIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBBZGRpdGlvbmFsIG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLmhlYWRlcnNdIC0gSFRUUCBoZWFkZXJzIHRvIGFkZCB0byB0aGUgcmVxdWVzdC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFzeW5jXSAtIE1ha2UgdGhlIHJlcXVlc3QgYXN5bmNocm9ub3VzbHkuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jYWNoZV0gLSBJZiBmYWxzZSwgdGhlbiBhZGQgYSB0aW1lc3RhbXAgdG8gdGhlIHJlcXVlc3QgdG8gcHJldmVudCBjYWNoaW5nLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMud2l0aENyZWRlbnRpYWxzXSAtIFNlbmQgY29va2llcyB3aXRoIHRoaXMgcmVxdWVzdC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnJlc3BvbnNlVHlwZV0gLSBPdmVycmlkZSB0aGUgcmVzcG9uc2UgdHlwZS5cbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50fG9iamVjdH0gW29wdGlvbnMucG9zdGRhdGFdIC0gRGF0YSB0byBzZW5kIGluIHRoZSBib2R5IG9mIHRoZSByZXF1ZXN0LlxuICAgICAqIFNvbWUgY29udGVudCB0eXBlcyBhcmUgaGFuZGxlZCBhdXRvbWF0aWNhbGx5LiBJZiBwb3N0ZGF0YSBpcyBhbiBYTUwgRG9jdW1lbnQsIGl0IGlzIGhhbmRsZWQuIElmXG4gICAgICogdGhlIENvbnRlbnQtVHlwZSBoZWFkZXIgaXMgc2V0IHRvICdhcHBsaWNhdGlvbi9qc29uJyB0aGVuIHRoZSBwb3N0ZGF0YSBpcyBKU09OIHN0cmluZ2lmaWVkLlxuICAgICAqIE90aGVyd2lzZSwgYnkgZGVmYXVsdCwgdGhlIGRhdGEgaXMgc2VudCBhcyBmb3JtLXVybGVuY29kZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXRyeV0gLSBJZiB0cnVlIHRoZW4gaWYgdGhlIHJlcXVlc3QgZmFpbHMgaXQgd2lsbCBiZSByZXRyaWVkIHdpdGggYW4gZXhwb25lbnRpYWwgYmFja29mZi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cmllc10gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIHJldHJpZXMuIERlZmF1bHRzIHRvIDUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heFJldHJ5RGVsYXldIC0gSWYgb3B0aW9ucy5yZXRyeSBpcyB0cnVlIHRoaXMgc3BlY2lmaWVzIHRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgYmV0d2VlbiByZXRyaWVzIGluIG1pbGxpc2Vjb25kcy4gRGVmYXVsdHMgdG8gNTAwMC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5kZWwoXCJodHRwOi8vZXhhbXBsZS5jb20vXCIsIHsgXCJyZXRyeVwiOiB0cnVlLCBcIm1heFJldHJpZXNcIjogNSB9LCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgZGVsKHVybCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnREVMRVRFJywgdXJsLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNyZXF1ZXN0XG4gICAgICogQGRlc2NyaXB0aW9uIE1ha2UgYSBnZW5lcmFsIHB1cnBvc2UgSFRUUCByZXF1ZXN0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXRob2QgLSBUaGUgSFRUUCBtZXRob2QgXCJHRVRcIiwgXCJQT1NUXCIsIFwiUFVUXCIsIFwiREVMRVRFXCIuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSB1cmwgdG8gbWFrZSB0aGUgcmVxdWVzdCB0by5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5yZXF1ZXN0KFwiZ2V0XCIsIFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCBmdW5jdGlvbiAoZXJyLCByZXNwb25zZSkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhyZXNwb25zZSk7XG4gICAgICogfSk7XG4gICAgICogQHJldHVybnMge1hNTEh0dHBSZXF1ZXN0fSBUaGUgcmVxdWVzdCBvYmplY3QuXG4gICAgICovXG4gICAgLyoqXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgSHR0cCNyZXF1ZXN0XG4gICAgICogQHZhcmlhdGlvbiAyXG4gICAgICogQGRlc2NyaXB0aW9uIE1ha2UgYSBnZW5lcmFsIHB1cnBvc2UgSFRUUCByZXF1ZXN0IHdpdGggYWRkaXRpb25hbCBvcHRpb25zIHN1Y2ggYXMgaGVhZGVycywgcmV0cmllcywgY3JlZGVudGlhbHMsIGV0Yy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWV0aG9kIC0gVGhlIEhUVFAgbWV0aG9kIFwiR0VUXCIsIFwiUE9TVFwiLCBcIlBVVFwiLCBcIkRFTEVURVwiLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgdXJsIHRvIG1ha2UgdGhlIHJlcXVlc3QgdG8uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IG9wdGlvbnMgLSBBZGRpdGlvbmFsIG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zLmhlYWRlcnNdIC0gSFRUUCBoZWFkZXJzIHRvIGFkZCB0byB0aGUgcmVxdWVzdC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmFzeW5jXSAtIE1ha2UgdGhlIHJlcXVlc3QgYXN5bmNocm9ub3VzbHkuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jYWNoZV0gLSBJZiBmYWxzZSwgdGhlbiBhZGQgYSB0aW1lc3RhbXAgdG8gdGhlIHJlcXVlc3QgdG8gcHJldmVudCBjYWNoaW5nLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMud2l0aENyZWRlbnRpYWxzXSAtIFNlbmQgY29va2llcyB3aXRoIHRoaXMgcmVxdWVzdC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5yZXRyeV0gLSBJZiB0cnVlIHRoZW4gaWYgdGhlIHJlcXVlc3QgZmFpbHMgaXQgd2lsbCBiZSByZXRyaWVkIHdpdGggYW4gZXhwb25lbnRpYWwgYmFja29mZi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWF4UmV0cmllc10gLSBJZiBvcHRpb25zLnJldHJ5IGlzIHRydWUgdGhpcyBzcGVjaWZpZXMgdGhlIG1heGltdW0gbnVtYmVyIG9mIHJldHJpZXMuIERlZmF1bHRzIHRvIDUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1heFJldHJ5RGVsYXldIC0gSWYgb3B0aW9ucy5yZXRyeSBpcyB0cnVlIHRoaXMgc3BlY2lmaWVzIHRoZSBtYXhpbXVtIGFtb3VudCBvZiB0aW1lIHRvIHdhaXQgYmV0d2VlbiByZXRyaWVzIGluIG1pbGxpc2Vjb25kcy4gRGVmYXVsdHMgdG8gNTAwMC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMucmVzcG9uc2VUeXBlXSAtIE92ZXJyaWRlIHRoZSByZXNwb25zZSB0eXBlLlxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnR8b2JqZWN0fSBbb3B0aW9ucy5wb3N0ZGF0YV0gLSBEYXRhIHRvIHNlbmQgaW4gdGhlIGJvZHkgb2YgdGhlIHJlcXVlc3QuXG4gICAgICogU29tZSBjb250ZW50IHR5cGVzIGFyZSBoYW5kbGVkIGF1dG9tYXRpY2FsbHkuIElmIHBvc3RkYXRhIGlzIGFuIFhNTCBEb2N1bWVudCwgaXQgaXMgaGFuZGxlZC4gSWZcbiAgICAgKiB0aGUgQ29udGVudC1UeXBlIGhlYWRlciBpcyBzZXQgdG8gJ2FwcGxpY2F0aW9uL2pzb24nIHRoZW4gdGhlIHBvc3RkYXRhIGlzIEpTT04gc3RyaW5naWZpZWQuXG4gICAgICogT3RoZXJ3aXNlLCBieSBkZWZhdWx0LCB0aGUgZGF0YSBpcyBzZW50IGFzIGZvcm0tdXJsZW5jb2RlZC5cbiAgICAgKiBAcGFyYW0ge0h0dHBSZXNwb25zZUNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayB1c2VkIHdoZW4gdGhlIHJlc3BvbnNlIGhhcyByZXR1cm5lZC4gUGFzc2VkIChlcnIsIGRhdGEpXG4gICAgICogd2hlcmUgZGF0YSBpcyB0aGUgcmVzcG9uc2UgKGZvcm1hdCBkZXBlbmRzIG9uIHJlc3BvbnNlIHR5cGU6IHRleHQsIE9iamVjdCwgQXJyYXlCdWZmZXIsIFhNTCkgYW5kXG4gICAgICogZXJyIGlzIHRoZSBlcnJvciBjb2RlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMuaHR0cC5yZXF1ZXN0KFwiZ2V0XCIsIFwiaHR0cDovL2V4YW1wbGUuY29tL1wiLCB7IFwicmV0cnlcIjogdHJ1ZSwgXCJtYXhSZXRyaWVzXCI6IDUgfSwgZnVuY3Rpb24gKGVyciwgcmVzcG9uc2UpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2cocmVzcG9uc2UpO1xuICAgICAqIH0pO1xuICAgICAqIEByZXR1cm5zIHtYTUxIdHRwUmVxdWVzdH0gVGhlIHJlcXVlc3Qgb2JqZWN0LlxuICAgICAqL1xuICAgIHJlcXVlc3QobWV0aG9kLCB1cmwsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIGxldCB1cmksIHF1ZXJ5LCBwb3N0ZGF0YTtcbiAgICAgICAgbGV0IGVycm9yZWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHJldHJ5YWJsZSB3ZSBhcmUgZ29pbmcgdG8gc3RvcmUgbmV3IHByb3BlcnRpZXNcbiAgICAgICAgLy8gaW4gdGhlIG9wdGlvbnMgc28gY3JlYXRlIGEgbmV3IGNvcHkgdG8gbm90IGFmZmVjdFxuICAgICAgICAvLyB0aGUgb3JpZ2luYWxcbiAgICAgICAgaWYgKG9wdGlvbnMucmV0cnkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtcbiAgICAgICAgICAgICAgICByZXRyaWVzOiAwLFxuICAgICAgICAgICAgICAgIG1heFJldHJpZXM6IDVcbiAgICAgICAgICAgIH0sIG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RvcmUgY2FsbGJhY2tcbiAgICAgICAgb3B0aW9ucy5jYWxsYmFjayA9IGNhbGxiYWNrO1xuXG4gICAgICAgIC8vIHNldHVwIGRlZmF1bHRzXG4gICAgICAgIGlmIChvcHRpb25zLmFzeW5jID09IG51bGwpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuYXN5bmMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmhlYWRlcnMgPT0gbnVsbCkge1xuICAgICAgICAgICAgb3B0aW9ucy5oZWFkZXJzID0ge307XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5wb3N0ZGF0YSAhPSBudWxsKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5wb3N0ZGF0YSBpbnN0YW5jZW9mIERvY3VtZW50KSB7XG4gICAgICAgICAgICAgICAgLy8gSXQncyBhbiBYTUwgZG9jdW1lbnQsIHNvIHdlIGNhbiBzZW5kIGl0IGRpcmVjdGx5LlxuICAgICAgICAgICAgICAgIC8vIFhNTEh0dHBSZXF1ZXN0IHdpbGwgc2V0IHRoZSBjb250ZW50IHR5cGUgY29ycmVjdGx5LlxuICAgICAgICAgICAgICAgIHBvc3RkYXRhID0gb3B0aW9ucy5wb3N0ZGF0YTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5wb3N0ZGF0YSBpbnN0YW5jZW9mIEZvcm1EYXRhKSB7XG4gICAgICAgICAgICAgICAgcG9zdGRhdGEgPSBvcHRpb25zLnBvc3RkYXRhO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnBvc3RkYXRhIGluc3RhbmNlb2YgT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgLy8gTm93IHRvIHdvcmsgb3V0IGhvdyB0byBlbmNvZGUgdGhlIHBvc3QgZGF0YSBiYXNlZCBvbiB0aGUgaGVhZGVyc1xuICAgICAgICAgICAgICAgIGxldCBjb250ZW50VHlwZSA9IG9wdGlvbnMuaGVhZGVyc1snQ29udGVudC1UeXBlJ107XG5cbiAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBubyB0eXBlIHRoZW4gZGVmYXVsdCB0byBmb3JtLWVuY29kZWRcbiAgICAgICAgICAgICAgICBpZiAoY29udGVudFR5cGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gSHR0cC5Db250ZW50VHlwZS5GT1JNX1VSTEVOQ09ERUQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnRUeXBlID0gb3B0aW9ucy5oZWFkZXJzWydDb250ZW50LVR5cGUnXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc3dpdGNoIChjb250ZW50VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIEh0dHAuQ29udGVudFR5cGUuRk9STV9VUkxFTkNPREVEOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOb3JtYWwgVVJMIGVuY29kZWQgZm9ybSBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3N0ZGF0YSA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJGaXJzdEl0ZW0gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBMb29wIHJvdW5kIGVhY2ggZW50cnkgaW4gdGhlIG1hcCBhbmQgZW5jb2RlIHRoZW0gaW50byB0aGUgcG9zdCBkYXRhXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBvcHRpb25zLnBvc3RkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMucG9zdGRhdGEuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoYkZpcnN0SXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYkZpcnN0SXRlbSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zdGRhdGEgKz0gJyYnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW5jb2RlZEtleSA9IGVuY29kZVVSSUNvbXBvbmVudChrZXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbmNvZGVkVmFsdWUgPSBlbmNvZGVVUklDb21wb25lbnQob3B0aW9ucy5wb3N0ZGF0YVtrZXldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zdGRhdGEgKz0gYCR7ZW5jb2RlZEtleX09JHtlbmNvZGVkVmFsdWV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBjYXNlIEh0dHAuQ29udGVudFR5cGUuSlNPTjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb250ZW50VHlwZSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5oZWFkZXJzWydDb250ZW50LVR5cGUnXSA9IEh0dHAuQ29udGVudFR5cGUuSlNPTjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc3RkYXRhID0gSlNPTi5zdHJpbmdpZnkob3B0aW9ucy5wb3N0ZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBvc3RkYXRhID0gb3B0aW9ucy5wb3N0ZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmNhY2hlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgLy8gQWRkIHRpbWVzdGFtcCB0byB1cmwgdG8gcHJldmVudCBicm93c2VyIGNhY2hpbmcgZmlsZVxuICAgICAgICAgICAgY29uc3QgdGltZXN0YW1wID0gbm93KCk7XG5cbiAgICAgICAgICAgIHVyaSA9IG5ldyBVUkkodXJsKTtcbiAgICAgICAgICAgIGlmICghdXJpLnF1ZXJ5KSB7XG4gICAgICAgICAgICAgICAgdXJpLnF1ZXJ5ID0gJ3RzPScgKyB0aW1lc3RhbXA7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVyaS5xdWVyeSA9IHVyaS5xdWVyeSArICcmdHM9JyArIHRpbWVzdGFtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHVybCA9IHVyaS50b1N0cmluZygpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucXVlcnkpIHtcbiAgICAgICAgICAgIHVyaSA9IG5ldyBVUkkodXJsKTtcbiAgICAgICAgICAgIHF1ZXJ5ID0gZXh0ZW5kKHVyaS5nZXRRdWVyeSgpLCBvcHRpb25zLnF1ZXJ5KTtcbiAgICAgICAgICAgIHVyaS5zZXRRdWVyeShxdWVyeSk7XG4gICAgICAgICAgICB1cmwgPSB1cmkudG9TdHJpbmcoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICB4aHIub3BlbihtZXRob2QsIHVybCwgb3B0aW9ucy5hc3luYyk7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSBvcHRpb25zLndpdGhDcmVkZW50aWFscyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy53aXRoQ3JlZGVudGlhbHMgOiBmYWxzZTtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IG9wdGlvbnMucmVzcG9uc2VUeXBlIHx8IHRoaXMuX2d1ZXNzUmVzcG9uc2VUeXBlKHVybCk7XG5cbiAgICAgICAgLy8gU2V0IHRoZSBodHRwIGhlYWRlcnNcbiAgICAgICAgZm9yIChjb25zdCBoZWFkZXIgaW4gb3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oZWFkZXJzLmhhc093blByb3BlcnR5KGhlYWRlcikpIHtcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihoZWFkZXIsIG9wdGlvbnMuaGVhZGVyc1toZWFkZXJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vblJlYWR5U3RhdGVDaGFuZ2UobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocik7XG4gICAgICAgIH07XG5cbiAgICAgICAgeGhyLm9uZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLl9vbkVycm9yKG1ldGhvZCwgdXJsLCBvcHRpb25zLCB4aHIpO1xuICAgICAgICAgICAgZXJyb3JlZCA9IHRydWU7XG4gICAgICAgIH07XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHhoci5zZW5kKHBvc3RkYXRhKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gRFdFOiBEb24ndCBjYWxsYmFjayBvbiBleGNlcHRpb25zIGFzIGJlaGF2aW9yIGlzIGluY29uc2lzdGVudCwgZS5nLiBjcm9zcy1kb21haW4gcmVxdWVzdCBlcnJvcnMgZG9uJ3QgdGhyb3cgYW4gZXhjZXB0aW9uLlxuICAgICAgICAgICAgLy8gRXJyb3IgY2FsbGJhY2sgc2hvdWxkIGJlIGNhbGxlZCBieSB4aHIub25lcnJvcigpIGNhbGxiYWNrIGluc3RlYWQuXG4gICAgICAgICAgICBpZiAoIWVycm9yZWQpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLmVycm9yKHhoci5zdGF0dXMsIHhociwgZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXR1cm4gdGhlIHJlcXVlc3Qgb2JqZWN0IGFzIGl0IGNhbiBiZSBoYW5keSBmb3IgYmxvY2tpbmcgY2FsbHNcbiAgICAgICAgcmV0dXJuIHhocjtcbiAgICB9XG5cbiAgICBfZ3Vlc3NSZXNwb25zZVR5cGUodXJsKSB7XG4gICAgICAgIGNvbnN0IHVyaSA9IG5ldyBVUkkodXJsKTtcbiAgICAgICAgY29uc3QgZXh0ID0gcGF0aC5nZXRFeHRlbnNpb24odXJpLnBhdGgpO1xuXG4gICAgICAgIGlmIChIdHRwLmJpbmFyeUV4dGVuc2lvbnMuaW5kZXhPZihleHQpID49IDApIHtcbiAgICAgICAgICAgIHJldHVybiBIdHRwLlJlc3BvbnNlVHlwZS5BUlJBWV9CVUZGRVI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZXh0ID09PSAnLnhtbCcpIHtcbiAgICAgICAgICAgIHJldHVybiBIdHRwLlJlc3BvbnNlVHlwZS5ET0NVTUVOVDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBIdHRwLlJlc3BvbnNlVHlwZS5URVhUO1xuICAgIH1cblxuICAgIF9pc0JpbmFyeUNvbnRlbnRUeXBlKGNvbnRlbnRUeXBlKSB7XG4gICAgICAgIGNvbnN0IGJpblR5cGVzID0gW1xuICAgICAgICAgICAgSHR0cC5Db250ZW50VHlwZS5CQVNJUyxcbiAgICAgICAgICAgIEh0dHAuQ29udGVudFR5cGUuQklOLFxuICAgICAgICAgICAgSHR0cC5Db250ZW50VHlwZS5ERFMsXG4gICAgICAgICAgICBIdHRwLkNvbnRlbnRUeXBlLkdMQixcbiAgICAgICAgICAgIEh0dHAuQ29udGVudFR5cGUuTVAzLFxuICAgICAgICAgICAgSHR0cC5Db250ZW50VHlwZS5NUDQsXG4gICAgICAgICAgICBIdHRwLkNvbnRlbnRUeXBlLk9HRyxcbiAgICAgICAgICAgIEh0dHAuQ29udGVudFR5cGUuT1BVUyxcbiAgICAgICAgICAgIEh0dHAuQ29udGVudFR5cGUuV0FWXG4gICAgICAgIF07XG4gICAgICAgIGlmIChiaW5UeXBlcy5pbmRleE9mKGNvbnRlbnRUeXBlKSA+PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBfaXNCaW5hcnlSZXNwb25zZVR5cGUocmVzcG9uc2VUeXBlKSB7XG4gICAgICAgIHJldHVybiByZXNwb25zZVR5cGUgPT09IEh0dHAuUmVzcG9uc2VUeXBlLkFSUkFZX0JVRkZFUiB8fFxuICAgICAgICAgICAgICAgcmVzcG9uc2VUeXBlID09PSBIdHRwLlJlc3BvbnNlVHlwZS5CTE9CIHx8XG4gICAgICAgICAgICAgICByZXNwb25zZVR5cGUgPT09IEh0dHAuUmVzcG9uc2VUeXBlLkpTT047XG4gICAgfVxuXG4gICAgX29uUmVhZHlTdGF0ZUNoYW5nZShtZXRob2QsIHVybCwgb3B0aW9ucywgeGhyKSB7XG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgc3dpdGNoICh4aHIuc3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAwOiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHN0YXR1cyBjb2RlIDAsIGl0IGlzIGFzc3VtZWQgdGhhdCB0aGUgYnJvd3NlciBoYXMgY2FuY2VsbGVkIHRoZSByZXF1ZXN0XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQWRkIHN1cHBvcnQgZm9yIHJ1bm5pbmcgQ2hyb21lIGJyb3dzZXJzIGluICdhbGxvdy1maWxlLWFjY2Vzcy1mcm9tLWZpbGUnXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgdG8gYWxsb3cgZm9yIHNwZWNpYWxpemVkIHByb2dyYW1zIGFuZCBsaWJyYXJpZXMgc3VjaCBhcyBDZWZTaGFycFxuICAgICAgICAgICAgICAgICAgICAvLyB3aGljaCBlbWJlZCBDaHJvbWl1bSBpbiB0aGUgbmF0aXZlIGFwcC5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHhoci5yZXNwb25zZVVSTCAmJiB4aHIucmVzcG9uc2VVUkwuc3RhcnRzV2l0aCgnZmlsZTovLy8nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQXNzdW1lIHRoYXQgYW55IGZpbGUgbG9hZGVkIGZyb20gZGlzayBpcyBmaW5lXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vblN1Y2Nlc3MobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbkVycm9yKG1ldGhvZCwgdXJsLCBvcHRpb25zLCB4aHIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlIDIwMDpcbiAgICAgICAgICAgICAgICBjYXNlIDIwMTpcbiAgICAgICAgICAgICAgICBjYXNlIDIwNjpcbiAgICAgICAgICAgICAgICBjYXNlIDMwNDoge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vblN1Y2Nlc3MobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocik7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29uRXJyb3IobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocik7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblN1Y2Nlc3MobWV0aG9kLCB1cmwsIG9wdGlvbnMsIHhocikge1xuICAgICAgICBsZXQgcmVzcG9uc2U7XG4gICAgICAgIGxldCBjb250ZW50VHlwZTtcbiAgICAgICAgY29uc3QgaGVhZGVyID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdDb250ZW50LVR5cGUnKTtcbiAgICAgICAgaWYgKGhlYWRlcikge1xuICAgICAgICAgICAgLy8gU3BsaXQgdXAgaGVhZGVyIGludG8gY29udGVudCB0eXBlIGFuZCBwYXJhbWV0ZXJcbiAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gaGVhZGVyLnNwbGl0KCc7Jyk7XG4gICAgICAgICAgICBjb250ZW50VHlwZSA9IHBhcnRzWzBdLnRyaW0oKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgdGhlIGNvbnRlbnQgdHlwZSB0byBzZWUgaWYgd2Ugd2FudCB0byBwYXJzZSBpdFxuICAgICAgICAgICAgaWYgKHRoaXMuX2lzQmluYXJ5Q29udGVudFR5cGUoY29udGVudFR5cGUpIHx8IHRoaXMuX2lzQmluYXJ5UmVzcG9uc2VUeXBlKHhoci5yZXNwb25zZVR5cGUpKSB7XG4gICAgICAgICAgICAgICAgLy8gSXQncyBhIGJpbmFyeSByZXNwb25zZVxuICAgICAgICAgICAgICAgIHJlc3BvbnNlID0geGhyLnJlc3BvbnNlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250ZW50VHlwZSA9PT0gSHR0cC5Db250ZW50VHlwZS5KU09OIHx8IHVybC5zcGxpdCgnPycpWzBdLmVuZHNXaXRoKCcuanNvbicpKSB7XG4gICAgICAgICAgICAgICAgLy8gSXQncyBhIEpTT04gcmVzcG9uc2VcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHhoci5yZXNwb25zZVR5cGUgPT09IEh0dHAuUmVzcG9uc2VUeXBlLkRPQ1VNRU5UIHx8IGNvbnRlbnRUeXBlID09PSBIdHRwLkNvbnRlbnRUeXBlLlhNTCkge1xuICAgICAgICAgICAgICAgIC8vIEl0J3MgYW4gWE1MIHJlc3BvbnNlXG4gICAgICAgICAgICAgICAgcmVzcG9uc2UgPSB4aHIucmVzcG9uc2VYTUw7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEl0J3MgcmF3IGRhdGFcbiAgICAgICAgICAgICAgICByZXNwb25zZSA9IHhoci5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG9wdGlvbnMuY2FsbGJhY2sobnVsbCwgcmVzcG9uc2UpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkVycm9yKG1ldGhvZCwgdXJsLCBvcHRpb25zLCB4aHIpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMucmV0cnlpbmcpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJldHJ5IGlmIG5lY2Vzc2FyeVxuICAgICAgICBpZiAob3B0aW9ucy5yZXRyeSAmJiBvcHRpb25zLnJldHJpZXMgPCBvcHRpb25zLm1heFJldHJpZXMpIHtcbiAgICAgICAgICAgIG9wdGlvbnMucmV0cmllcysrO1xuICAgICAgICAgICAgb3B0aW9ucy5yZXRyeWluZyA9IHRydWU7IC8vIHVzZWQgdG8gc3RvcCByZXRyeWluZyB3aGVuIGJvdGggb25FcnJvciBhbmQgeGhyLm9uZXJyb3IgYXJlIGNhbGxlZFxuICAgICAgICAgICAgY29uc3QgcmV0cnlEZWxheSA9IG1hdGguY2xhbXAoTWF0aC5wb3coMiwgb3B0aW9ucy5yZXRyaWVzKSAqIEh0dHAucmV0cnlEZWxheSwgMCwgb3B0aW9ucy5tYXhSZXRyeURlbGF5IHx8IDUwMDApO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYCR7bWV0aG9kfTogJHt1cmx9IC0gRXJyb3IgJHt4aHIuc3RhdHVzfS4gUmV0cnlpbmcgaW4gJHtyZXRyeURlbGF5fSBtc2ApO1xuXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnJldHJ5aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0KG1ldGhvZCwgdXJsLCBvcHRpb25zLCBvcHRpb25zLmNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0sIHJldHJ5RGVsYXkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gbW9yZSByZXRyaWVzIG9yIG5vdCByZXRyeSBzbyBqdXN0IGZhaWxcbiAgICAgICAgICAgIG9wdGlvbnMuY2FsbGJhY2soeGhyLnN0YXR1cyA9PT0gMCA/ICdOZXR3b3JrIGVycm9yJyA6IHhoci5zdGF0dXMsIG51bGwpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBodHRwID0gbmV3IEh0dHAoKTtcblxuZXhwb3J0IHsgaHR0cCwgSHR0cCB9O1xuIl0sIm5hbWVzIjpbIkh0dHAiLCJnZXQiLCJ1cmwiLCJvcHRpb25zIiwiY2FsbGJhY2siLCJyZXF1ZXN0IiwicG9zdCIsImRhdGEiLCJwb3N0ZGF0YSIsInB1dCIsImRlbCIsIm1ldGhvZCIsInVyaSIsInF1ZXJ5IiwiZXJyb3JlZCIsInJldHJ5IiwiT2JqZWN0IiwiYXNzaWduIiwicmV0cmllcyIsIm1heFJldHJpZXMiLCJhc3luYyIsImhlYWRlcnMiLCJEb2N1bWVudCIsIkZvcm1EYXRhIiwiY29udGVudFR5cGUiLCJ1bmRlZmluZWQiLCJDb250ZW50VHlwZSIsIkZPUk1fVVJMRU5DT0RFRCIsImJGaXJzdEl0ZW0iLCJrZXkiLCJoYXNPd25Qcm9wZXJ0eSIsImVuY29kZWRLZXkiLCJlbmNvZGVVUklDb21wb25lbnQiLCJlbmNvZGVkVmFsdWUiLCJKU09OIiwic3RyaW5naWZ5IiwiY2FjaGUiLCJ0aW1lc3RhbXAiLCJub3ciLCJVUkkiLCJ0b1N0cmluZyIsImV4dGVuZCIsImdldFF1ZXJ5Iiwic2V0UXVlcnkiLCJ4aHIiLCJYTUxIdHRwUmVxdWVzdCIsIm9wZW4iLCJ3aXRoQ3JlZGVudGlhbHMiLCJyZXNwb25zZVR5cGUiLCJfZ3Vlc3NSZXNwb25zZVR5cGUiLCJoZWFkZXIiLCJzZXRSZXF1ZXN0SGVhZGVyIiwib25yZWFkeXN0YXRlY2hhbmdlIiwiX29uUmVhZHlTdGF0ZUNoYW5nZSIsIm9uZXJyb3IiLCJfb25FcnJvciIsInNlbmQiLCJlIiwiZXJyb3IiLCJzdGF0dXMiLCJleHQiLCJwYXRoIiwiZ2V0RXh0ZW5zaW9uIiwiYmluYXJ5RXh0ZW5zaW9ucyIsImluZGV4T2YiLCJSZXNwb25zZVR5cGUiLCJBUlJBWV9CVUZGRVIiLCJET0NVTUVOVCIsIlRFWFQiLCJfaXNCaW5hcnlDb250ZW50VHlwZSIsImJpblR5cGVzIiwiQkFTSVMiLCJCSU4iLCJERFMiLCJHTEIiLCJNUDMiLCJNUDQiLCJPR0ciLCJPUFVTIiwiV0FWIiwiX2lzQmluYXJ5UmVzcG9uc2VUeXBlIiwiQkxPQiIsInJlYWR5U3RhdGUiLCJyZXNwb25zZVVSTCIsInN0YXJ0c1dpdGgiLCJfb25TdWNjZXNzIiwicmVzcG9uc2UiLCJnZXRSZXNwb25zZUhlYWRlciIsInBhcnRzIiwic3BsaXQiLCJ0cmltIiwiZW5kc1dpdGgiLCJwYXJzZSIsInJlc3BvbnNlVGV4dCIsIlhNTCIsInJlc3BvbnNlWE1MIiwiZXJyIiwicmV0cnlpbmciLCJyZXRyeURlbGF5IiwibWF0aCIsImNsYW1wIiwiTWF0aCIsInBvdyIsIm1heFJldHJ5RGVsYXkiLCJjb25zb2xlIiwibG9nIiwic2V0VGltZW91dCIsIkFBQyIsIkdJRiIsIkpQRUciLCJQTkciLCJodHRwIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsSUFBSSxDQUFDO0FBNkNQO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxHQUFHLENBQUNDLEdBQUcsRUFBRUMsT0FBTyxFQUFFQyxRQUFRLEVBQUU7QUFDeEIsSUFBQSxJQUFJLE9BQU9ELE9BQU8sS0FBSyxVQUFVLEVBQUU7QUFDL0JDLE1BQUFBLFFBQVEsR0FBR0QsT0FBTyxDQUFBO01BQ2xCQSxPQUFPLEdBQUcsRUFBRSxDQUFBO0FBQ2hCLEtBQUE7SUFDQSxPQUFPLElBQUksQ0FBQ0UsT0FBTyxDQUFDLEtBQUssRUFBRUgsR0FBRyxFQUFFQyxPQUFPLEVBQUVDLFFBQVEsQ0FBQyxDQUFBO0FBQ3RELEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUUsSUFBSSxDQUFDSixHQUFHLEVBQUVLLElBQUksRUFBRUosT0FBTyxFQUFFQyxRQUFRLEVBQUU7QUFDL0IsSUFBQSxJQUFJLE9BQU9ELE9BQU8sS0FBSyxVQUFVLEVBQUU7QUFDL0JDLE1BQUFBLFFBQVEsR0FBR0QsT0FBTyxDQUFBO01BQ2xCQSxPQUFPLEdBQUcsRUFBRSxDQUFBO0FBQ2hCLEtBQUE7SUFDQUEsT0FBTyxDQUFDSyxRQUFRLEdBQUdELElBQUksQ0FBQTtJQUN2QixPQUFPLElBQUksQ0FBQ0YsT0FBTyxDQUFDLE1BQU0sRUFBRUgsR0FBRyxFQUFFQyxPQUFPLEVBQUVDLFFBQVEsQ0FBQyxDQUFBO0FBQ3ZELEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUssR0FBRyxDQUFDUCxHQUFHLEVBQUVLLElBQUksRUFBRUosT0FBTyxFQUFFQyxRQUFRLEVBQUU7QUFDOUIsSUFBQSxJQUFJLE9BQU9ELE9BQU8sS0FBSyxVQUFVLEVBQUU7QUFDL0JDLE1BQUFBLFFBQVEsR0FBR0QsT0FBTyxDQUFBO01BQ2xCQSxPQUFPLEdBQUcsRUFBRSxDQUFBO0FBQ2hCLEtBQUE7SUFDQUEsT0FBTyxDQUFDSyxRQUFRLEdBQUdELElBQUksQ0FBQTtJQUN2QixPQUFPLElBQUksQ0FBQ0YsT0FBTyxDQUFDLEtBQUssRUFBRUgsR0FBRyxFQUFFQyxPQUFPLEVBQUVDLFFBQVEsQ0FBQyxDQUFBO0FBQ3RELEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lNLEVBQUFBLEdBQUcsQ0FBQ1IsR0FBRyxFQUFFQyxPQUFPLEVBQUVDLFFBQVEsRUFBRTtBQUN4QixJQUFBLElBQUksT0FBT0QsT0FBTyxLQUFLLFVBQVUsRUFBRTtBQUMvQkMsTUFBQUEsUUFBUSxHQUFHRCxPQUFPLENBQUE7TUFDbEJBLE9BQU8sR0FBRyxFQUFFLENBQUE7QUFDaEIsS0FBQTtJQUNBLE9BQU8sSUFBSSxDQUFDRSxPQUFPLENBQUMsUUFBUSxFQUFFSCxHQUFHLEVBQUVDLE9BQU8sRUFBRUMsUUFBUSxDQUFDLENBQUE7QUFDekQsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLE9BQU8sQ0FBQ00sTUFBTSxFQUFFVCxHQUFHLEVBQUVDLE9BQU8sRUFBRUMsUUFBUSxFQUFFO0FBQ3BDLElBQUEsSUFBSVEsR0FBRyxFQUFFQyxLQUFLLEVBQUVMLFFBQVEsQ0FBQTtJQUN4QixJQUFJTSxPQUFPLEdBQUcsS0FBSyxDQUFBO0FBRW5CLElBQUEsSUFBSSxPQUFPWCxPQUFPLEtBQUssVUFBVSxFQUFFO0FBQy9CQyxNQUFBQSxRQUFRLEdBQUdELE9BQU8sQ0FBQTtNQUNsQkEsT0FBTyxHQUFHLEVBQUUsQ0FBQTtBQUNoQixLQUFBOztBQUVBO0FBQ0E7QUFDQTtJQUNBLElBQUlBLE9BQU8sQ0FBQ1ksS0FBSyxFQUFFO0FBQ2ZaLE1BQUFBLE9BQU8sR0FBR2EsTUFBTSxDQUFDQyxNQUFNLENBQUM7QUFDcEJDLFFBQUFBLE9BQU8sRUFBRSxDQUFDO0FBQ1ZDLFFBQUFBLFVBQVUsRUFBRSxDQUFBO09BQ2YsRUFBRWhCLE9BQU8sQ0FBQyxDQUFBO0FBQ2YsS0FBQTs7QUFFQTtJQUNBQSxPQUFPLENBQUNDLFFBQVEsR0FBR0EsUUFBUSxDQUFBOztBQUUzQjtBQUNBLElBQUEsSUFBSUQsT0FBTyxDQUFDaUIsS0FBSyxJQUFJLElBQUksRUFBRTtNQUN2QmpCLE9BQU8sQ0FBQ2lCLEtBQUssR0FBRyxJQUFJLENBQUE7QUFDeEIsS0FBQTtBQUNBLElBQUEsSUFBSWpCLE9BQU8sQ0FBQ2tCLE9BQU8sSUFBSSxJQUFJLEVBQUU7QUFDekJsQixNQUFBQSxPQUFPLENBQUNrQixPQUFPLEdBQUcsRUFBRSxDQUFBO0FBQ3hCLEtBQUE7QUFFQSxJQUFBLElBQUlsQixPQUFPLENBQUNLLFFBQVEsSUFBSSxJQUFJLEVBQUU7QUFDMUIsTUFBQSxJQUFJTCxPQUFPLENBQUNLLFFBQVEsWUFBWWMsUUFBUSxFQUFFO0FBQ3RDO0FBQ0E7UUFDQWQsUUFBUSxHQUFHTCxPQUFPLENBQUNLLFFBQVEsQ0FBQTtBQUMvQixPQUFDLE1BQU0sSUFBSUwsT0FBTyxDQUFDSyxRQUFRLFlBQVllLFFBQVEsRUFBRTtRQUM3Q2YsUUFBUSxHQUFHTCxPQUFPLENBQUNLLFFBQVEsQ0FBQTtBQUMvQixPQUFDLE1BQU0sSUFBSUwsT0FBTyxDQUFDSyxRQUFRLFlBQVlRLE1BQU0sRUFBRTtBQUMzQztBQUNBLFFBQUEsSUFBSVEsV0FBVyxHQUFHckIsT0FBTyxDQUFDa0IsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFBOztBQUVqRDtRQUNBLElBQUlHLFdBQVcsS0FBS0MsU0FBUyxFQUFFO1VBQzNCdEIsT0FBTyxDQUFDa0IsT0FBTyxDQUFDLGNBQWMsQ0FBQyxHQUFHckIsSUFBSSxDQUFDMEIsV0FBVyxDQUFDQyxlQUFlLENBQUE7QUFDbEVILFVBQUFBLFdBQVcsR0FBR3JCLE9BQU8sQ0FBQ2tCLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQTtBQUNqRCxTQUFBO0FBQ0EsUUFBQSxRQUFRRyxXQUFXO0FBQ2YsVUFBQSxLQUFLeEIsSUFBSSxDQUFDMEIsV0FBVyxDQUFDQyxlQUFlO0FBQUUsWUFBQTtBQUNuQztBQUNBbkIsY0FBQUEsUUFBUSxHQUFHLEVBQUUsQ0FBQTtjQUNiLElBQUlvQixVQUFVLEdBQUcsSUFBSSxDQUFBOztBQUVyQjtBQUNBLGNBQUEsS0FBSyxNQUFNQyxHQUFHLElBQUkxQixPQUFPLENBQUNLLFFBQVEsRUFBRTtnQkFDaEMsSUFBSUwsT0FBTyxDQUFDSyxRQUFRLENBQUNzQixjQUFjLENBQUNELEdBQUcsQ0FBQyxFQUFFO0FBQ3RDLGtCQUFBLElBQUlELFVBQVUsRUFBRTtBQUNaQSxvQkFBQUEsVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUN0QixtQkFBQyxNQUFNO0FBQ0hwQixvQkFBQUEsUUFBUSxJQUFJLEdBQUcsQ0FBQTtBQUNuQixtQkFBQTtBQUVBLGtCQUFBLE1BQU11QixVQUFVLEdBQUdDLGtCQUFrQixDQUFDSCxHQUFHLENBQUMsQ0FBQTtrQkFDMUMsTUFBTUksWUFBWSxHQUFHRCxrQkFBa0IsQ0FBQzdCLE9BQU8sQ0FBQ0ssUUFBUSxDQUFDcUIsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUM5RHJCLGtCQUFBQSxRQUFRLElBQUssQ0FBQSxFQUFFdUIsVUFBVyxDQUFBLENBQUEsRUFBR0UsWUFBYSxDQUFDLENBQUEsQ0FBQTtBQUMvQyxpQkFBQTtBQUNKLGVBQUE7QUFDQSxjQUFBLE1BQUE7QUFDSixhQUFBO0FBQ0EsVUFBQSxRQUFBO0FBQ0EsVUFBQSxLQUFLakMsSUFBSSxDQUFDMEIsV0FBVyxDQUFDUSxJQUFJO1lBQ3RCLElBQUlWLFdBQVcsSUFBSSxJQUFJLEVBQUU7Y0FDckJyQixPQUFPLENBQUNrQixPQUFPLENBQUMsY0FBYyxDQUFDLEdBQUdyQixJQUFJLENBQUMwQixXQUFXLENBQUNRLElBQUksQ0FBQTtBQUMzRCxhQUFBO1lBQ0ExQixRQUFRLEdBQUcwQixJQUFJLENBQUNDLFNBQVMsQ0FBQ2hDLE9BQU8sQ0FBQ0ssUUFBUSxDQUFDLENBQUE7QUFDM0MsWUFBQSxNQUFBO0FBQU0sU0FBQTtBQUVsQixPQUFDLE1BQU07UUFDSEEsUUFBUSxHQUFHTCxPQUFPLENBQUNLLFFBQVEsQ0FBQTtBQUMvQixPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsSUFBSUwsT0FBTyxDQUFDaUMsS0FBSyxLQUFLLEtBQUssRUFBRTtBQUN6QjtNQUNBLE1BQU1DLFNBQVMsR0FBR0MsR0FBRyxFQUFFLENBQUE7QUFFdkIxQixNQUFBQSxHQUFHLEdBQUcsSUFBSTJCLEdBQUcsQ0FBQ3JDLEdBQUcsQ0FBQyxDQUFBO0FBQ2xCLE1BQUEsSUFBSSxDQUFDVSxHQUFHLENBQUNDLEtBQUssRUFBRTtBQUNaRCxRQUFBQSxHQUFHLENBQUNDLEtBQUssR0FBRyxLQUFLLEdBQUd3QixTQUFTLENBQUE7QUFDakMsT0FBQyxNQUFNO1FBQ0h6QixHQUFHLENBQUNDLEtBQUssR0FBR0QsR0FBRyxDQUFDQyxLQUFLLEdBQUcsTUFBTSxHQUFHd0IsU0FBUyxDQUFBO0FBQzlDLE9BQUE7QUFDQW5DLE1BQUFBLEdBQUcsR0FBR1UsR0FBRyxDQUFDNEIsUUFBUSxFQUFFLENBQUE7QUFDeEIsS0FBQTtJQUVBLElBQUlyQyxPQUFPLENBQUNVLEtBQUssRUFBRTtBQUNmRCxNQUFBQSxHQUFHLEdBQUcsSUFBSTJCLEdBQUcsQ0FBQ3JDLEdBQUcsQ0FBQyxDQUFBO01BQ2xCVyxLQUFLLEdBQUc0QixNQUFNLENBQUM3QixHQUFHLENBQUM4QixRQUFRLEVBQUUsRUFBRXZDLE9BQU8sQ0FBQ1UsS0FBSyxDQUFDLENBQUE7QUFDN0NELE1BQUFBLEdBQUcsQ0FBQytCLFFBQVEsQ0FBQzlCLEtBQUssQ0FBQyxDQUFBO0FBQ25CWCxNQUFBQSxHQUFHLEdBQUdVLEdBQUcsQ0FBQzRCLFFBQVEsRUFBRSxDQUFBO0FBQ3hCLEtBQUE7QUFFQSxJQUFBLE1BQU1JLEdBQUcsR0FBRyxJQUFJQyxjQUFjLEVBQUUsQ0FBQTtJQUNoQ0QsR0FBRyxDQUFDRSxJQUFJLENBQUNuQyxNQUFNLEVBQUVULEdBQUcsRUFBRUMsT0FBTyxDQUFDaUIsS0FBSyxDQUFDLENBQUE7QUFDcEN3QixJQUFBQSxHQUFHLENBQUNHLGVBQWUsR0FBRzVDLE9BQU8sQ0FBQzRDLGVBQWUsS0FBS3RCLFNBQVMsR0FBR3RCLE9BQU8sQ0FBQzRDLGVBQWUsR0FBRyxLQUFLLENBQUE7QUFDN0ZILElBQUFBLEdBQUcsQ0FBQ0ksWUFBWSxHQUFHN0MsT0FBTyxDQUFDNkMsWUFBWSxJQUFJLElBQUksQ0FBQ0Msa0JBQWtCLENBQUMvQyxHQUFHLENBQUMsQ0FBQTs7QUFFdkU7QUFDQSxJQUFBLEtBQUssTUFBTWdELE1BQU0sSUFBSS9DLE9BQU8sQ0FBQ2tCLE9BQU8sRUFBRTtNQUNsQyxJQUFJbEIsT0FBTyxDQUFDa0IsT0FBTyxDQUFDUyxjQUFjLENBQUNvQixNQUFNLENBQUMsRUFBRTtRQUN4Q04sR0FBRyxDQUFDTyxnQkFBZ0IsQ0FBQ0QsTUFBTSxFQUFFL0MsT0FBTyxDQUFDa0IsT0FBTyxDQUFDNkIsTUFBTSxDQUFDLENBQUMsQ0FBQTtBQUN6RCxPQUFBO0FBQ0osS0FBQTtJQUVBTixHQUFHLENBQUNRLGtCQUFrQixHQUFHLE1BQU07TUFDM0IsSUFBSSxDQUFDQyxtQkFBbUIsQ0FBQzFDLE1BQU0sRUFBRVQsR0FBRyxFQUFFQyxPQUFPLEVBQUV5QyxHQUFHLENBQUMsQ0FBQTtLQUN0RCxDQUFBO0lBRURBLEdBQUcsQ0FBQ1UsT0FBTyxHQUFHLE1BQU07TUFDaEIsSUFBSSxDQUFDQyxRQUFRLENBQUM1QyxNQUFNLEVBQUVULEdBQUcsRUFBRUMsT0FBTyxFQUFFeUMsR0FBRyxDQUFDLENBQUE7QUFDeEM5QixNQUFBQSxPQUFPLEdBQUcsSUFBSSxDQUFBO0tBQ2pCLENBQUE7SUFFRCxJQUFJO0FBQ0E4QixNQUFBQSxHQUFHLENBQUNZLElBQUksQ0FBQ2hELFFBQVEsQ0FBQyxDQUFBO0tBQ3JCLENBQUMsT0FBT2lELENBQUMsRUFBRTtBQUNSO0FBQ0E7TUFDQSxJQUFJLENBQUMzQyxPQUFPLEVBQUU7UUFDVlgsT0FBTyxDQUFDdUQsS0FBSyxDQUFDZCxHQUFHLENBQUNlLE1BQU0sRUFBRWYsR0FBRyxFQUFFYSxDQUFDLENBQUMsQ0FBQTtBQUNyQyxPQUFBO0FBQ0osS0FBQTs7QUFFQTtBQUNBLElBQUEsT0FBT2IsR0FBRyxDQUFBO0FBQ2QsR0FBQTtFQUVBSyxrQkFBa0IsQ0FBQy9DLEdBQUcsRUFBRTtBQUNwQixJQUFBLE1BQU1VLEdBQUcsR0FBRyxJQUFJMkIsR0FBRyxDQUFDckMsR0FBRyxDQUFDLENBQUE7SUFDeEIsTUFBTTBELEdBQUcsR0FBR0MsSUFBSSxDQUFDQyxZQUFZLENBQUNsRCxHQUFHLENBQUNpRCxJQUFJLENBQUMsQ0FBQTtJQUV2QyxJQUFJN0QsSUFBSSxDQUFDK0QsZ0JBQWdCLENBQUNDLE9BQU8sQ0FBQ0osR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ3pDLE1BQUEsT0FBTzVELElBQUksQ0FBQ2lFLFlBQVksQ0FBQ0MsWUFBWSxDQUFBO0FBQ3pDLEtBQUE7SUFFQSxJQUFJTixHQUFHLEtBQUssTUFBTSxFQUFFO0FBQ2hCLE1BQUEsT0FBTzVELElBQUksQ0FBQ2lFLFlBQVksQ0FBQ0UsUUFBUSxDQUFBO0FBQ3JDLEtBQUE7QUFFQSxJQUFBLE9BQU9uRSxJQUFJLENBQUNpRSxZQUFZLENBQUNHLElBQUksQ0FBQTtBQUNqQyxHQUFBO0VBRUFDLG9CQUFvQixDQUFDN0MsV0FBVyxFQUFFO0lBQzlCLE1BQU04QyxRQUFRLEdBQUcsQ0FDYnRFLElBQUksQ0FBQzBCLFdBQVcsQ0FBQzZDLEtBQUssRUFDdEJ2RSxJQUFJLENBQUMwQixXQUFXLENBQUM4QyxHQUFHLEVBQ3BCeEUsSUFBSSxDQUFDMEIsV0FBVyxDQUFDK0MsR0FBRyxFQUNwQnpFLElBQUksQ0FBQzBCLFdBQVcsQ0FBQ2dELEdBQUcsRUFDcEIxRSxJQUFJLENBQUMwQixXQUFXLENBQUNpRCxHQUFHLEVBQ3BCM0UsSUFBSSxDQUFDMEIsV0FBVyxDQUFDa0QsR0FBRyxFQUNwQjVFLElBQUksQ0FBQzBCLFdBQVcsQ0FBQ21ELEdBQUcsRUFDcEI3RSxJQUFJLENBQUMwQixXQUFXLENBQUNvRCxJQUFJLEVBQ3JCOUUsSUFBSSxDQUFDMEIsV0FBVyxDQUFDcUQsR0FBRyxDQUN2QixDQUFBO0lBQ0QsSUFBSVQsUUFBUSxDQUFDTixPQUFPLENBQUN4QyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDcEMsTUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEtBQUE7QUFFQSxJQUFBLE9BQU8sS0FBSyxDQUFBO0FBQ2hCLEdBQUE7RUFFQXdELHFCQUFxQixDQUFDaEMsWUFBWSxFQUFFO0lBQ2hDLE9BQU9BLFlBQVksS0FBS2hELElBQUksQ0FBQ2lFLFlBQVksQ0FBQ0MsWUFBWSxJQUMvQ2xCLFlBQVksS0FBS2hELElBQUksQ0FBQ2lFLFlBQVksQ0FBQ2dCLElBQUksSUFDdkNqQyxZQUFZLEtBQUtoRCxJQUFJLENBQUNpRSxZQUFZLENBQUMvQixJQUFJLENBQUE7QUFDbEQsR0FBQTtFQUVBbUIsbUJBQW1CLENBQUMxQyxNQUFNLEVBQUVULEdBQUcsRUFBRUMsT0FBTyxFQUFFeUMsR0FBRyxFQUFFO0FBQzNDLElBQUEsSUFBSUEsR0FBRyxDQUFDc0MsVUFBVSxLQUFLLENBQUMsRUFBRTtNQUN0QixRQUFRdEMsR0FBRyxDQUFDZSxNQUFNO0FBQ2QsUUFBQSxLQUFLLENBQUM7QUFBRSxVQUFBO0FBQ0o7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsWUFBQSxJQUFJZixHQUFHLENBQUN1QyxXQUFXLElBQUl2QyxHQUFHLENBQUN1QyxXQUFXLENBQUNDLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRTtBQUMzRDtjQUNBLElBQUksQ0FBQ0MsVUFBVSxDQUFDMUUsTUFBTSxFQUFFVCxHQUFHLEVBQUVDLE9BQU8sRUFBRXlDLEdBQUcsQ0FBQyxDQUFBO0FBQzlDLGFBQUMsTUFBTTtjQUNILElBQUksQ0FBQ1csUUFBUSxDQUFDNUMsTUFBTSxFQUFFVCxHQUFHLEVBQUVDLE9BQU8sRUFBRXlDLEdBQUcsQ0FBQyxDQUFBO0FBQzVDLGFBQUE7QUFDQSxZQUFBLE1BQUE7QUFDSixXQUFBO0FBQ0EsUUFBQSxLQUFLLEdBQUcsQ0FBQTtBQUNSLFFBQUEsS0FBSyxHQUFHLENBQUE7QUFDUixRQUFBLEtBQUssR0FBRyxDQUFBO0FBQ1IsUUFBQSxLQUFLLEdBQUc7QUFBRSxVQUFBO1lBQ04sSUFBSSxDQUFDeUMsVUFBVSxDQUFDMUUsTUFBTSxFQUFFVCxHQUFHLEVBQUVDLE9BQU8sRUFBRXlDLEdBQUcsQ0FBQyxDQUFBO0FBQzFDLFlBQUEsTUFBQTtBQUNKLFdBQUE7QUFDQSxRQUFBO0FBQVMsVUFBQTtZQUNMLElBQUksQ0FBQ1csUUFBUSxDQUFDNUMsTUFBTSxFQUFFVCxHQUFHLEVBQUVDLE9BQU8sRUFBRXlDLEdBQUcsQ0FBQyxDQUFBO0FBQ3hDLFlBQUEsTUFBQTtBQUNKLFdBQUE7QUFBQyxPQUFBO0FBRVQsS0FBQTtBQUNKLEdBQUE7RUFFQXlDLFVBQVUsQ0FBQzFFLE1BQU0sRUFBRVQsR0FBRyxFQUFFQyxPQUFPLEVBQUV5QyxHQUFHLEVBQUU7QUFDbEMsSUFBQSxJQUFJMEMsUUFBUSxDQUFBO0FBQ1osSUFBQSxJQUFJOUQsV0FBVyxDQUFBO0FBQ2YsSUFBQSxNQUFNMEIsTUFBTSxHQUFHTixHQUFHLENBQUMyQyxpQkFBaUIsQ0FBQyxjQUFjLENBQUMsQ0FBQTtBQUNwRCxJQUFBLElBQUlyQyxNQUFNLEVBQUU7QUFDUjtBQUNBLE1BQUEsTUFBTXNDLEtBQUssR0FBR3RDLE1BQU0sQ0FBQ3VDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUMvQmpFLE1BQUFBLFdBQVcsR0FBR2dFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQ0UsSUFBSSxFQUFFLENBQUE7QUFDakMsS0FBQTtJQUNBLElBQUk7QUFDQTtBQUNBLE1BQUEsSUFBSSxJQUFJLENBQUNyQixvQkFBb0IsQ0FBQzdDLFdBQVcsQ0FBQyxJQUFJLElBQUksQ0FBQ3dELHFCQUFxQixDQUFDcEMsR0FBRyxDQUFDSSxZQUFZLENBQUMsRUFBRTtBQUN4RjtRQUNBc0MsUUFBUSxHQUFHMUMsR0FBRyxDQUFDMEMsUUFBUSxDQUFBO09BQzFCLE1BQU0sSUFBSTlELFdBQVcsS0FBS3hCLElBQUksQ0FBQzBCLFdBQVcsQ0FBQ1EsSUFBSSxJQUFJaEMsR0FBRyxDQUFDdUYsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDRSxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7QUFDckY7UUFDQUwsUUFBUSxHQUFHcEQsSUFBSSxDQUFDMEQsS0FBSyxDQUFDaEQsR0FBRyxDQUFDaUQsWUFBWSxDQUFDLENBQUE7QUFDM0MsT0FBQyxNQUFNLElBQUlqRCxHQUFHLENBQUNJLFlBQVksS0FBS2hELElBQUksQ0FBQ2lFLFlBQVksQ0FBQ0UsUUFBUSxJQUFJM0MsV0FBVyxLQUFLeEIsSUFBSSxDQUFDMEIsV0FBVyxDQUFDb0UsR0FBRyxFQUFFO0FBQ2hHO1FBQ0FSLFFBQVEsR0FBRzFDLEdBQUcsQ0FBQ21ELFdBQVcsQ0FBQTtBQUM5QixPQUFDLE1BQU07QUFDSDtRQUNBVCxRQUFRLEdBQUcxQyxHQUFHLENBQUNpRCxZQUFZLENBQUE7QUFDL0IsT0FBQTtBQUVBMUYsTUFBQUEsT0FBTyxDQUFDQyxRQUFRLENBQUMsSUFBSSxFQUFFa0YsUUFBUSxDQUFDLENBQUE7S0FDbkMsQ0FBQyxPQUFPVSxHQUFHLEVBQUU7QUFDVjdGLE1BQUFBLE9BQU8sQ0FBQ0MsUUFBUSxDQUFDNEYsR0FBRyxDQUFDLENBQUE7QUFDekIsS0FBQTtBQUNKLEdBQUE7RUFFQXpDLFFBQVEsQ0FBQzVDLE1BQU0sRUFBRVQsR0FBRyxFQUFFQyxPQUFPLEVBQUV5QyxHQUFHLEVBQUU7SUFDaEMsSUFBSXpDLE9BQU8sQ0FBQzhGLFFBQVEsRUFBRTtBQUNsQixNQUFBLE9BQUE7QUFDSixLQUFBOztBQUVBO0lBQ0EsSUFBSTlGLE9BQU8sQ0FBQ1ksS0FBSyxJQUFJWixPQUFPLENBQUNlLE9BQU8sR0FBR2YsT0FBTyxDQUFDZ0IsVUFBVSxFQUFFO01BQ3ZEaEIsT0FBTyxDQUFDZSxPQUFPLEVBQUUsQ0FBQTtBQUNqQmYsTUFBQUEsT0FBTyxDQUFDOEYsUUFBUSxHQUFHLElBQUksQ0FBQztBQUN4QixNQUFBLE1BQU1DLFVBQVUsR0FBR0MsSUFBSSxDQUFDQyxLQUFLLENBQUNDLElBQUksQ0FBQ0MsR0FBRyxDQUFDLENBQUMsRUFBRW5HLE9BQU8sQ0FBQ2UsT0FBTyxDQUFDLEdBQUdsQixJQUFJLENBQUNrRyxVQUFVLEVBQUUsQ0FBQyxFQUFFL0YsT0FBTyxDQUFDb0csYUFBYSxJQUFJLElBQUksQ0FBQyxDQUFBO0FBQy9HQyxNQUFBQSxPQUFPLENBQUNDLEdBQUcsQ0FBRSxDQUFBLEVBQUU5RixNQUFPLENBQUlULEVBQUFBLEVBQUFBLEdBQUksQ0FBVzBDLFNBQUFBLEVBQUFBLEdBQUcsQ0FBQ2UsTUFBTyxDQUFnQnVDLGNBQUFBLEVBQUFBLFVBQVcsS0FBSSxDQUFDLENBQUE7QUFFcEZRLE1BQUFBLFVBQVUsQ0FBQyxNQUFNO1FBQ2J2RyxPQUFPLENBQUM4RixRQUFRLEdBQUcsS0FBSyxDQUFBO0FBQ3hCLFFBQUEsSUFBSSxDQUFDNUYsT0FBTyxDQUFDTSxNQUFNLEVBQUVULEdBQUcsRUFBRUMsT0FBTyxFQUFFQSxPQUFPLENBQUNDLFFBQVEsQ0FBQyxDQUFBO09BQ3ZELEVBQUU4RixVQUFVLENBQUMsQ0FBQTtBQUNsQixLQUFDLE1BQU07QUFDSDtBQUNBL0YsTUFBQUEsT0FBTyxDQUFDQyxRQUFRLENBQUN3QyxHQUFHLENBQUNlLE1BQU0sS0FBSyxDQUFDLEdBQUcsZUFBZSxHQUFHZixHQUFHLENBQUNlLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMzRSxLQUFBO0FBQ0osR0FBQTtBQUNKLENBQUE7QUEvaUJNM0QsSUFBSSxDQUNDMEIsV0FBVyxHQUFHO0FBQ2pCaUYsRUFBQUEsR0FBRyxFQUFFLFdBQVc7QUFDaEJwQyxFQUFBQSxLQUFLLEVBQUUsYUFBYTtBQUNwQkMsRUFBQUEsR0FBRyxFQUFFLDBCQUEwQjtBQUMvQkMsRUFBQUEsR0FBRyxFQUFFLFdBQVc7QUFDaEI5QyxFQUFBQSxlQUFlLEVBQUUsbUNBQW1DO0FBQ3BEaUYsRUFBQUEsR0FBRyxFQUFFLFdBQVc7QUFDaEJsQyxFQUFBQSxHQUFHLEVBQUUsbUJBQW1CO0FBQ3hCbUMsRUFBQUEsSUFBSSxFQUFFLFlBQVk7QUFDbEIzRSxFQUFBQSxJQUFJLEVBQUUsa0JBQWtCO0FBQ3hCeUMsRUFBQUEsR0FBRyxFQUFFLFlBQVk7QUFDakJDLEVBQUFBLEdBQUcsRUFBRSxXQUFXO0FBQ2hCQyxFQUFBQSxHQUFHLEVBQUUsV0FBVztBQUNoQkMsRUFBQUEsSUFBSSxFQUFFLDBCQUEwQjtBQUNoQ2dDLEVBQUFBLEdBQUcsRUFBRSxXQUFXO0FBQ2hCMUMsRUFBQUEsSUFBSSxFQUFFLFlBQVk7QUFDbEJXLEVBQUFBLEdBQUcsRUFBRSxhQUFhO0FBQ2xCZSxFQUFBQSxHQUFHLEVBQUUsaUJBQUE7QUFDVCxDQUFDLENBQUE7QUFuQkM5RixJQUFJLENBcUJDaUUsWUFBWSxHQUFHO0FBQ2xCRyxFQUFBQSxJQUFJLEVBQUUsTUFBTTtBQUNaRixFQUFBQSxZQUFZLEVBQUUsYUFBYTtBQUMzQmUsRUFBQUEsSUFBSSxFQUFFLE1BQU07QUFDWmQsRUFBQUEsUUFBUSxFQUFFLFVBQVU7QUFDcEJqQyxFQUFBQSxJQUFJLEVBQUUsTUFBQTtBQUNWLENBQUMsQ0FBQTtBQTNCQ2xDLElBQUksQ0E2QkMrRCxnQkFBZ0IsR0FBRyxDQUN0QixRQUFRLEVBQ1IsTUFBTSxFQUNOLE1BQU0sRUFDTixNQUFNLEVBQ04sTUFBTSxFQUNOLE1BQU0sRUFDTixNQUFNLEVBQ04sTUFBTSxFQUNOLFFBQVEsRUFDUixNQUFNLEVBQ04sT0FBTyxDQUNWLENBQUE7QUF6Q0MvRCxJQUFJLENBMkNDa0csVUFBVSxHQUFHLEdBQUcsQ0FBQTtBQXNnQjNCLE1BQU1hLElBQUksR0FBRyxJQUFJL0csSUFBSTs7OzsifQ==
