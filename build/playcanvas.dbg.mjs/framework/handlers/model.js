/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../core/path.js';
import { Http, http } from '../../platform/net/http.js';
import { getDefaultMaterial } from '../../scene/materials/default-material.js';
import { GlbModelParser } from '../parsers/glb-model.js';
import { JsonModelParser } from '../parsers/json-model.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * Callback used by {@link ModelHandler#addParser} to decide on which parser to use.
 *
 * @callback AddParserCallback
 * @param {string} url - The resource url.
 * @param {object} data - The raw model data.
 * @returns {boolean} Return true if this parser should be used to parse the data into a
 * {@link Model}.
 */

/**
 * Resource handler used for loading {@link Model} resources.
 *
 * @implements {ResourceHandler}
 */
class ModelHandler {
  /**
   * Type of the resource the handler handles.
   *
   * @type {string}
   */

  /**
   * Create a new ModelHandler instance.
   *
   * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
   * @hideconstructor
   */
  constructor(app) {
    this.handlerType = "model";
    this._device = app.graphicsDevice;
    this._parsers = [];
    this._defaultMaterial = getDefaultMaterial(this._device);
    this.maxRetries = 0;
    this.addParser(new JsonModelParser(this._device, this._defaultMaterial), function (url, data) {
      return path.getExtension(url) === '.json';
    });
    this.addParser(new GlbModelParser(this._device, this._defaultMaterial), function (url, data) {
      return path.getExtension(url) === '.glb';
    });
  }
  load(url, callback) {
    if (typeof url === 'string') {
      url = {
        load: url,
        original: url
      };
    }

    // we need to specify JSON for blob URLs
    const options = {
      retry: this.maxRetries > 0,
      maxRetries: this.maxRetries
    };
    if (url.load.startsWith('blob:') || url.load.startsWith('data:')) {
      if (path.getExtension(url.original).toLowerCase() === '.glb') {
        options.responseType = Http.ResponseType.ARRAY_BUFFER;
      } else {
        options.responseType = Http.ResponseType.JSON;
      }
    }
    http.get(url.load, options, (err, response) => {
      if (!callback) return;
      if (!err) {
        // parse the model
        for (let i = 0; i < this._parsers.length; i++) {
          const p = this._parsers[i];
          if (p.decider(url.original, response)) {
            p.parser.parse(response, (err, parseResult) => {
              if (err) {
                callback(err);
              } else {
                callback(null, parseResult);
              }
            });
            return;
          }
        }
        callback("No parsers found");
      } else {
        callback(`Error loading model: ${url.original} [${err}]`);
      }
    });
  }
  open(url, data) {
    // parse was done in open, return the data as-is
    return data;
  }
  patch(asset, assets) {
    if (!asset.resource) return;
    const data = asset.data;
    const self = this;
    asset.resource.meshInstances.forEach(function (meshInstance, i) {
      if (data.mapping) {
        const handleMaterial = function handleMaterial(asset) {
          if (asset.resource) {
            meshInstance.material = asset.resource;
          } else {
            asset.once('load', handleMaterial);
            assets.load(asset);
          }
          asset.once('remove', function (asset) {
            if (meshInstance.material === asset.resource) {
              meshInstance.material = self._defaultMaterial;
            }
          });
        };
        if (!data.mapping[i]) {
          meshInstance.material = self._defaultMaterial;
          return;
        }
        const id = data.mapping[i].material;
        const url = data.mapping[i].path;
        let material;
        if (id !== undefined) {
          // id mapping
          if (!id) {
            meshInstance.material = self._defaultMaterial;
          } else {
            material = assets.get(id);
            if (material) {
              handleMaterial(material);
            } else {
              assets.once('add:' + id, handleMaterial);
            }
          }
        } else if (url) {
          // url mapping
          const path = asset.getAbsoluteUrl(data.mapping[i].path);
          material = assets.getByUrl(path);
          if (material) {
            handleMaterial(material);
          } else {
            assets.once('add:url:' + path, handleMaterial);
          }
        }
      }
    });
  }

  /**
   * Add a parser that converts raw data into a {@link Model}. Default parser is for JSON models.
   *
   * @param {object} parser - See JsonModelParser for example.
   * @param {AddParserCallback} decider - Function that decides on which parser to use. Function
   * should take (url, data) arguments and return true if this parser should be used to parse the
   * data into a {@link Model}. The first parser to return true is used.
   */
  addParser(parser, decider) {
    this._parsers.push({
      parser: parser,
      decider: decider
    });
  }
}

export { ModelHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvaGFuZGxlcnMvbW9kZWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5cbmltcG9ydCB7IGh0dHAsIEh0dHAgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7IGdldERlZmF1bHRNYXRlcmlhbCB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9kZWZhdWx0LW1hdGVyaWFsLmpzJztcblxuaW1wb3J0IHsgR2xiTW9kZWxQYXJzZXIgfSBmcm9tICcuLi9wYXJzZXJzL2dsYi1tb2RlbC5qcyc7XG5pbXBvcnQgeyBKc29uTW9kZWxQYXJzZXIgfSBmcm9tICcuLi9wYXJzZXJzL2pzb24tbW9kZWwuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9oYW5kbGVyLmpzJykuUmVzb3VyY2VIYW5kbGVyfSBSZXNvdXJjZUhhbmRsZXIgKi9cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBNb2RlbEhhbmRsZXIjYWRkUGFyc2VyfSB0byBkZWNpZGUgb24gd2hpY2ggcGFyc2VyIHRvIHVzZS5cbiAqXG4gKiBAY2FsbGJhY2sgQWRkUGFyc2VyQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgcmVzb3VyY2UgdXJsLlxuICogQHBhcmFtIHtvYmplY3R9IGRhdGEgLSBUaGUgcmF3IG1vZGVsIGRhdGEuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJuIHRydWUgaWYgdGhpcyBwYXJzZXIgc2hvdWxkIGJlIHVzZWQgdG8gcGFyc2UgdGhlIGRhdGEgaW50byBhXG4gKiB7QGxpbmsgTW9kZWx9LlxuICovXG5cbi8qKlxuICogUmVzb3VyY2UgaGFuZGxlciB1c2VkIGZvciBsb2FkaW5nIHtAbGluayBNb2RlbH0gcmVzb3VyY2VzLlxuICpcbiAqIEBpbXBsZW1lbnRzIHtSZXNvdXJjZUhhbmRsZXJ9XG4gKi9cbmNsYXNzIE1vZGVsSGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogVHlwZSBvZiB0aGUgcmVzb3VyY2UgdGhlIGhhbmRsZXIgaGFuZGxlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgaGFuZGxlclR5cGUgPSBcIm1vZGVsXCI7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgTW9kZWxIYW5kbGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIHJ1bm5pbmcge0BsaW5rIEFwcEJhc2V9LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgdGhpcy5fZGV2aWNlID0gYXBwLmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICB0aGlzLl9wYXJzZXJzID0gW107XG4gICAgICAgIHRoaXMuX2RlZmF1bHRNYXRlcmlhbCA9IGdldERlZmF1bHRNYXRlcmlhbCh0aGlzLl9kZXZpY2UpO1xuICAgICAgICB0aGlzLm1heFJldHJpZXMgPSAwO1xuXG4gICAgICAgIHRoaXMuYWRkUGFyc2VyKG5ldyBKc29uTW9kZWxQYXJzZXIodGhpcy5fZGV2aWNlLCB0aGlzLl9kZWZhdWx0TWF0ZXJpYWwpLCBmdW5jdGlvbiAodXJsLCBkYXRhKSB7XG4gICAgICAgICAgICByZXR1cm4gKHBhdGguZ2V0RXh0ZW5zaW9uKHVybCkgPT09ICcuanNvbicpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5hZGRQYXJzZXIobmV3IEdsYk1vZGVsUGFyc2VyKHRoaXMuX2RldmljZSwgdGhpcy5fZGVmYXVsdE1hdGVyaWFsKSwgZnVuY3Rpb24gKHVybCwgZGF0YSkge1xuICAgICAgICAgICAgcmV0dXJuIChwYXRoLmdldEV4dGVuc2lvbih1cmwpID09PSAnLmdsYicpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBsb2FkKHVybCwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKHR5cGVvZiB1cmwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB1cmwgPSB7XG4gICAgICAgICAgICAgICAgbG9hZDogdXJsLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsOiB1cmxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3ZSBuZWVkIHRvIHNwZWNpZnkgSlNPTiBmb3IgYmxvYiBVUkxzXG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICByZXRyeTogdGhpcy5tYXhSZXRyaWVzID4gMCxcbiAgICAgICAgICAgIG1heFJldHJpZXM6IHRoaXMubWF4UmV0cmllc1xuICAgICAgICB9O1xuXG4gICAgICAgIGlmICh1cmwubG9hZC5zdGFydHNXaXRoKCdibG9iOicpIHx8IHVybC5sb2FkLnN0YXJ0c1dpdGgoJ2RhdGE6JykpIHtcbiAgICAgICAgICAgIGlmIChwYXRoLmdldEV4dGVuc2lvbih1cmwub3JpZ2luYWwpLnRvTG93ZXJDYXNlKCkgPT09ICcuZ2xiJykge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMucmVzcG9uc2VUeXBlID0gSHR0cC5SZXNwb25zZVR5cGUuQVJSQVlfQlVGRkVSO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLnJlc3BvbnNlVHlwZSA9IEh0dHAuUmVzcG9uc2VUeXBlLkpTT047XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBodHRwLmdldCh1cmwubG9hZCwgb3B0aW9ucywgKGVyciwgcmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGlmICghY2FsbGJhY2spXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgIC8vIHBhcnNlIHRoZSBtb2RlbFxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fcGFyc2Vycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwID0gdGhpcy5fcGFyc2Vyc1tpXTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocC5kZWNpZGVyKHVybC5vcmlnaW5hbCwgcmVzcG9uc2UpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwLnBhcnNlci5wYXJzZShyZXNwb25zZSwgKGVyciwgcGFyc2VSZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcGFyc2VSZXN1bHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrKFwiTm8gcGFyc2VycyBmb3VuZFwiKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soYEVycm9yIGxvYWRpbmcgbW9kZWw6ICR7dXJsLm9yaWdpbmFsfSBbJHtlcnJ9XWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBvcGVuKHVybCwgZGF0YSkge1xuICAgICAgICAvLyBwYXJzZSB3YXMgZG9uZSBpbiBvcGVuLCByZXR1cm4gdGhlIGRhdGEgYXMtaXNcbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuXG4gICAgcGF0Y2goYXNzZXQsIGFzc2V0cykge1xuICAgICAgICBpZiAoIWFzc2V0LnJlc291cmNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhc3NldC5kYXRhO1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICBhc3NldC5yZXNvdXJjZS5tZXNoSW5zdGFuY2VzLmZvckVhY2goZnVuY3Rpb24gKG1lc2hJbnN0YW5jZSwgaSkge1xuICAgICAgICAgICAgaWYgKGRhdGEubWFwcGluZykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRsZU1hdGVyaWFsID0gZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldC5vbmNlKCdsb2FkJywgaGFuZGxlTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXQub25jZSgncmVtb3ZlJywgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWVzaEluc3RhbmNlLm1hdGVyaWFsID09PSBhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IHNlbGYuX2RlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGlmICghZGF0YS5tYXBwaW5nW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IHNlbGYuX2RlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gZGF0YS5tYXBwaW5nW2ldLm1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IGRhdGEubWFwcGluZ1tpXS5wYXRoO1xuICAgICAgICAgICAgICAgIGxldCBtYXRlcmlhbDtcblxuICAgICAgICAgICAgICAgIGlmIChpZCAhPT0gdW5kZWZpbmVkKSB7IC8vIGlkIG1hcHBpbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gc2VsZi5fZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwgPSBhc3NldHMuZ2V0KGlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZU1hdGVyaWFsKG1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2FkZDonICsgaWQsIGhhbmRsZU1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodXJsKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHVybCBtYXBwaW5nXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSBhc3NldC5nZXRBYnNvbHV0ZVVybChkYXRhLm1hcHBpbmdbaV0ucGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsID0gYXNzZXRzLmdldEJ5VXJsKHBhdGgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlTWF0ZXJpYWwobWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2FkZDp1cmw6JyArIHBhdGgsIGhhbmRsZU1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgcGFyc2VyIHRoYXQgY29udmVydHMgcmF3IGRhdGEgaW50byBhIHtAbGluayBNb2RlbH0uIERlZmF1bHQgcGFyc2VyIGlzIGZvciBKU09OIG1vZGVscy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBwYXJzZXIgLSBTZWUgSnNvbk1vZGVsUGFyc2VyIGZvciBleGFtcGxlLlxuICAgICAqIEBwYXJhbSB7QWRkUGFyc2VyQ2FsbGJhY2t9IGRlY2lkZXIgLSBGdW5jdGlvbiB0aGF0IGRlY2lkZXMgb24gd2hpY2ggcGFyc2VyIHRvIHVzZS4gRnVuY3Rpb25cbiAgICAgKiBzaG91bGQgdGFrZSAodXJsLCBkYXRhKSBhcmd1bWVudHMgYW5kIHJldHVybiB0cnVlIGlmIHRoaXMgcGFyc2VyIHNob3VsZCBiZSB1c2VkIHRvIHBhcnNlIHRoZVxuICAgICAqIGRhdGEgaW50byBhIHtAbGluayBNb2RlbH0uIFRoZSBmaXJzdCBwYXJzZXIgdG8gcmV0dXJuIHRydWUgaXMgdXNlZC5cbiAgICAgKi9cbiAgICBhZGRQYXJzZXIocGFyc2VyLCBkZWNpZGVyKSB7XG4gICAgICAgIHRoaXMuX3BhcnNlcnMucHVzaCh7XG4gICAgICAgICAgICBwYXJzZXI6IHBhcnNlcixcbiAgICAgICAgICAgIGRlY2lkZXI6IGRlY2lkZXJcbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBNb2RlbEhhbmRsZXIgfTtcbiJdLCJuYW1lcyI6WyJNb2RlbEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImFwcCIsImhhbmRsZXJUeXBlIiwiX2RldmljZSIsImdyYXBoaWNzRGV2aWNlIiwiX3BhcnNlcnMiLCJfZGVmYXVsdE1hdGVyaWFsIiwiZ2V0RGVmYXVsdE1hdGVyaWFsIiwibWF4UmV0cmllcyIsImFkZFBhcnNlciIsIkpzb25Nb2RlbFBhcnNlciIsInVybCIsImRhdGEiLCJwYXRoIiwiZ2V0RXh0ZW5zaW9uIiwiR2xiTW9kZWxQYXJzZXIiLCJsb2FkIiwiY2FsbGJhY2siLCJvcmlnaW5hbCIsIm9wdGlvbnMiLCJyZXRyeSIsInN0YXJ0c1dpdGgiLCJ0b0xvd2VyQ2FzZSIsInJlc3BvbnNlVHlwZSIsIkh0dHAiLCJSZXNwb25zZVR5cGUiLCJBUlJBWV9CVUZGRVIiLCJKU09OIiwiaHR0cCIsImdldCIsImVyciIsInJlc3BvbnNlIiwiaSIsImxlbmd0aCIsInAiLCJkZWNpZGVyIiwicGFyc2VyIiwicGFyc2UiLCJwYXJzZVJlc3VsdCIsIm9wZW4iLCJwYXRjaCIsImFzc2V0IiwiYXNzZXRzIiwicmVzb3VyY2UiLCJzZWxmIiwibWVzaEluc3RhbmNlcyIsImZvckVhY2giLCJtZXNoSW5zdGFuY2UiLCJtYXBwaW5nIiwiaGFuZGxlTWF0ZXJpYWwiLCJtYXRlcmlhbCIsIm9uY2UiLCJpZCIsInVuZGVmaW5lZCIsImdldEFic29sdXRlVXJsIiwiZ2V0QnlVcmwiLCJwdXNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQVNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsWUFBWSxDQUFDO0FBQ2Y7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBVyxDQUFDQyxHQUFHLEVBQUU7SUFBQSxJQVJqQkMsQ0FB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
