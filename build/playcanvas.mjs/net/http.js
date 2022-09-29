import { extend } from '../core/core.js';
import { now } from '../core/time.js';
import { path } from '../core/path.js';
import { URI } from '../core/uri.js';
import { math } from '../math/math.js';

class Http {
  get(url, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    return this.request('GET', url, options, callback);
  }

  post(url, data, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    options.postdata = data;
    return this.request('POST', url, options, callback);
  }

  put(url, data, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    options.postdata = data;
    return this.request('PUT', url, options, callback);
  }

  del(url, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    return this.request('DELETE', url, options, callback);
  }

  request(method, url, options, callback) {
    let uri, query, postdata;
    let errored = false;

    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    if (options.retry) {
      options = Object.assign({
        retries: 0,
        maxRetries: 5
      }, options);
    }

    options.callback = callback;

    if (options.async == null) {
      options.async = true;
    }

    if (options.headers == null) {
      options.headers = {};
    }

    if (options.postdata != null) {
      if (options.postdata instanceof Document) {
        postdata = options.postdata;
      } else if (options.postdata instanceof FormData) {
        postdata = options.postdata;
      } else if (options.postdata instanceof Object) {
        let contentType = options.headers['Content-Type'];

        if (contentType === undefined) {
          options.headers['Content-Type'] = Http.ContentType.FORM_URLENCODED;
          contentType = options.headers['Content-Type'];
        }

        switch (contentType) {
          case Http.ContentType.FORM_URLENCODED:
            {
              postdata = '';
              let bFirstItem = true;

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
      if (!errored) {
        options.error(xhr.status, xhr, e);
      }
    }

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
    const binTypes = [Http.ContentType.MP4, Http.ContentType.WAV, Http.ContentType.OGG, Http.ContentType.MP3, Http.ContentType.BIN, Http.ContentType.DDS, Http.ContentType.BASIS, Http.ContentType.GLB, Http.ContentType.OPUS];

    if (binTypes.indexOf(contentType) >= 0) {
      return true;
    }

    return false;
  }

  _onReadyStateChange(method, url, options, xhr) {
    if (xhr.readyState === 4) {
      switch (xhr.status) {
        case 0:
          {
            if (xhr.responseURL && xhr.responseURL.startsWith('file:///')) {
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
      const parts = header.split(';');
      contentType = parts[0].trim();
    }

    try {
      if (contentType === Http.ContentType.JSON || url.split('?')[0].endsWith('.json')) {
        response = JSON.parse(xhr.responseText);
      } else if (this._isBinaryContentType(contentType)) {
        response = xhr.response;
      } else {
        if (xhr.responseType === Http.ResponseType.ARRAY_BUFFER) {
          response = xhr.response;
        } else if (xhr.responseType === Http.ResponseType.BLOB || xhr.responseType === Http.ResponseType.JSON) {
          response = xhr.response;
        } else {
          if (xhr.responseType === Http.ResponseType.DOCUMENT || contentType === Http.ContentType.XML) {
            response = xhr.responseXML;
          } else {
            response = xhr.responseText;
          }
        }
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

    if (options.retry && options.retries < options.maxRetries) {
      options.retries++;
      options.retrying = true;
      const retryDelay = math.clamp(Math.pow(2, options.retries) * Http.retryDelay, 0, options.maxRetryDelay || 5000);
      console.log(`${method}: ${url} - Error ${xhr.status}. Retrying in ${retryDelay} ms`);
      setTimeout(() => {
        options.retrying = false;
        this.request(method, url, options, options.callback);
      }, retryDelay);
    } else {
      options.callback(xhr.status === 0 ? 'Network error' : xhr.status, null);
    }
  }

}

Http.ContentType = {
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  GIF: 'image/gif',
  JPEG: 'image/jpeg',
  DDS: 'image/dds',
  JSON: 'application/json',
  PNG: 'image/png',
  TEXT: 'text/plain',
  XML: 'application/xml',
  WAV: 'audio/x-wav',
  OGG: 'audio/ogg',
  MP3: 'audio/mpeg',
  MP4: 'audio/mp4',
  AAC: 'audio/aac',
  BIN: 'application/octet-stream',
  BASIS: 'image/basis',
  GLB: 'model/gltf-binary',
  OPUS: 'audio/ogg; codecs="opus"'
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
