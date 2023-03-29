/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { TagsCache } from '../../core/tags-cache.js';
import { standardMaterialTextureParameters } from '../../scene/materials/standard-material-parameters.js';
import { script } from '../script.js';
import { Asset } from './asset.js';

/**
 * Callback used by {@link AssetRegistry#filter} to filter assets.
 *
 * @callback FilterAssetCallback
 * @param {Asset} asset - The current asset to filter.
 * @returns {boolean} Return `true` to include asset to result list.
 */

/**
 * Callback used by {@link AssetRegistry#loadFromUrl} and called when an asset is loaded (or an
 * error occurs).
 *
 * @callback LoadAssetCallback
 * @param {string|null} err - The error message is null if no errors were encountered.
 * @param {Asset} [asset] - The loaded asset if no errors were encountered.
 */

/**
 * Container for all assets that are available to this application. Note that PlayCanvas scripts
 * are provided with an AssetRegistry instance as `app.assets`.
 *
 * @augments EventHandler
 */
class AssetRegistry extends EventHandler {
  /**
   * Create an instance of an AssetRegistry.
   *
   * @param {import('../handlers/loader.js').ResourceLoader} loader - The ResourceLoader used to
   * load the asset files.
   */
  constructor(loader) {
    super();
    this._loader = loader;
    this._assets = []; // list of all assets
    this._cache = {}; // index for looking up assets by id
    this._names = {}; // index for looking up assets by name
    this._tags = new TagsCache('_id'); // index for looking up by tags
    this._urls = {}; // index for looking up assets by url

    /**
     * A URL prefix that will be added to all asset loading requests.
     *
     * @type {string}
     */
    this.prefix = null;
  }

  /**
   * Fired when an asset completes loading.
   *
   * @event AssetRegistry#load
   * @param {Asset} asset - The asset that has just loaded.
   * @example
   * app.assets.on("load", function (asset) {
   *     console.log("asset loaded: " + asset.name);
   * });
   */

  /**
   * Fired when an asset completes loading.
   *
   * @event AssetRegistry#load:[id]
   * @param {Asset} asset - The asset that has just loaded.
   * @example
   * var id = 123456;
   * var asset = app.assets.get(id);
   * app.assets.on("load:" + id, function (asset) {
   *     console.log("asset loaded: " + asset.name);
   * });
   * app.assets.load(asset);
   */

  /**
   * Fired when an asset completes loading.
   *
   * @event AssetRegistry#load:url:[url]
   * @param {Asset} asset - The asset that has just loaded.
   * @example
   * var id = 123456;
   * var asset = app.assets.get(id);
   * app.assets.on("load:url:" + asset.file.url, function (asset) {
   *     console.log("asset loaded: " + asset.name);
   * });
   * app.assets.load(asset);
   */

  /**
   * Fired when an asset is added to the registry.
   *
   * @event AssetRegistry#add
   * @param {Asset} asset - The asset that was added.
   * @example
   * app.assets.on("add", function (asset) {
   *     console.log("New asset added: " + asset.name);
   * });
   */

  /**
   * Fired when an asset is added to the registry.
   *
   * @event AssetRegistry#add:[id]
   * @param {Asset} asset - The asset that was added.
   * @example
   * var id = 123456;
   * app.assets.on("add:" + id, function (asset) {
   *     console.log("Asset 123456 loaded");
   * });
   */

  /**
   * Fired when an asset is added to the registry.
   *
   * @event AssetRegistry#add:url:[url]
   * @param {Asset} asset - The asset that was added.
   */

  /**
   * Fired when an asset is removed from the registry.
   *
   * @event AssetRegistry#remove
   * @param {Asset} asset - The asset that was removed.
   * @example
   * app.assets.on("remove", function (asset) {
   *     console.log("Asset removed: " + asset.name);
   * });
   */

  /**
   * Fired when an asset is removed from the registry.
   *
   * @event AssetRegistry#remove:[id]
   * @param {Asset} asset - The asset that was removed.
   * @example
   * var id = 123456;
   * app.assets.on("remove:" + id, function (asset) {
   *     console.log("Asset removed: " + asset.name);
   * });
   */

  /**
   * Fired when an asset is removed from the registry.
   *
   * @event AssetRegistry#remove:url:[url]
   * @param {Asset} asset - The asset that was removed.
   */

  /**
   * Fired when an error occurs during asset loading.
   *
   * @event AssetRegistry#error
   * @param {string} err - The error message.
   * @param {Asset} asset - The asset that generated the error.
   * @example
   * var id = 123456;
   * var asset = app.assets.get(id);
   * app.assets.on("error", function (err, asset) {
   *     console.error(err);
   * });
   * app.assets.load(asset);
   */

  /**
   * Fired when an error occurs during asset loading.
   *
   * @event AssetRegistry#error:[id]
   * @param {Asset} asset - The asset that generated the error.
   * @example
   * var id = 123456;
   * var asset = app.assets.get(id);
   * app.assets.on("error:" + id, function (err, asset) {
   *     console.error(err);
   * });
   * app.assets.load(asset);
   */

  /**
   * Create a filtered list of assets from the registry.
   *
   * @param {object} filters - Properties to filter on, currently supports: 'preload: true|false'.
   * @returns {Asset[]} The filtered list of assets.
   */
  list(filters) {
    filters = filters || {};
    return this._assets.filter(asset => {
      let include = true;
      if (filters.preload !== undefined) {
        include = asset.preload === filters.preload;
      }
      return include;
    });
  }

  /**
   * Add an asset to the registry.
   *
   * @param {Asset} asset - The asset to add.
   * @example
   * var asset = new pc.Asset("My Asset", "texture", {
   *     url: "../path/to/image.jpg"
   * });
   * app.assets.add(asset);
   */
  add(asset) {
    const index = this._assets.push(asset) - 1;
    let url;

    // id cache
    this._cache[asset.id] = index;
    if (!this._names[asset.name]) this._names[asset.name] = [];

    // name cache
    this._names[asset.name].push(index);
    if (asset.file) {
      url = asset.file.url;
      this._urls[url] = index;
    }
    asset.registry = this;

    // tags cache
    this._tags.addItem(asset);
    asset.tags.on('add', this._onTagAdd, this);
    asset.tags.on('remove', this._onTagRemove, this);
    this.fire('add', asset);
    this.fire('add:' + asset.id, asset);
    if (url) this.fire('add:url:' + url, asset);
    if (asset.preload) this.load(asset);
  }

  /**
   * Remove an asset from the registry.
   *
   * @param {Asset} asset - The asset to remove.
   * @returns {boolean} True if the asset was successfully removed and false otherwise.
   * @example
   * var asset = app.assets.get(100);
   * app.assets.remove(asset);
   */
  remove(asset) {
    const idx = this._cache[asset.id];
    const url = asset.file ? asset.file.url : null;
    if (idx !== undefined) {
      // remove from list
      this._assets.splice(idx, 1);

      // remove id -> index cache
      delete this._cache[asset.id];

      // name cache needs to be completely rebuilt
      this._names = {};

      // urls cache needs to be completely rebuilt
      this._urls = [];

      // update id cache and rebuild name cache
      for (let i = 0, l = this._assets.length; i < l; i++) {
        const a = this._assets[i];
        this._cache[a.id] = i;
        if (!this._names[a.name]) {
          this._names[a.name] = [];
        }
        this._names[a.name].push(i);
        if (a.file) {
          this._urls[a.file.url] = i;
        }
      }

      // tags cache
      this._tags.removeItem(asset);
      asset.tags.off('add', this._onTagAdd, this);
      asset.tags.off('remove', this._onTagRemove, this);
      asset.fire('remove', asset);
      this.fire('remove', asset);
      this.fire('remove:' + asset.id, asset);
      if (url) this.fire('remove:url:' + url, asset);
      return true;
    }

    // asset not in registry
    return false;
  }

  /**
   * Retrieve an asset from the registry by its id field.
   *
   * @param {number} id - The id of the asset to get.
   * @returns {Asset} The asset.
   * @example
   * var asset = app.assets.get(100);
   */
  get(id) {
    const idx = this._cache[id];
    return this._assets[idx];
  }

  /**
   * Retrieve an asset from the registry by its file's URL field.
   *
   * @param {string} url - The url of the asset to get.
   * @returns {Asset} The asset.
   * @example
   * var asset = app.assets.getByUrl("../path/to/image.jpg");
   */
  getByUrl(url) {
    const idx = this._urls[url];
    return this._assets[idx];
  }

  /**
   * Load the asset's file from a remote source. Listen for "load" events on the asset to find
   * out when it is loaded.
   *
   * @param {Asset} asset - The asset to load.
   * @example
   * // load some assets
   * var assetsToLoad = [
   *     app.assets.find("My Asset"),
   *     app.assets.find("Another Asset")
   * ];
   * var count = 0;
   * assetsToLoad.forEach(function (assetToLoad) {
   *     assetToLoad.ready(function (asset) {
   *         count++;
   *         if (count === assetsToLoad.length) {
   *             // done
   *         }
   *     });
   *     app.assets.load(assetToLoad);
   * });
   */
  load(asset) {
    // do nothing if asset is already loaded
    // note: lots of code calls assets.load() assuming this check is present
    // don't remove it without updating calls to assets.load() with checks for the asset.loaded state
    if (asset.loading || asset.loaded) {
      return;
    }
    const file = asset.file;

    // open has completed on the resource
    const _opened = resource => {
      if (resource instanceof Array) {
        asset.resources = resource;
      } else {
        asset.resource = resource;
      }

      // let handler patch the resource
      this._loader.patch(asset, this);
      this.fire('load', asset);
      this.fire('load:' + asset.id, asset);
      if (file && file.url) this.fire('load:url:' + file.url, asset);
      asset.fire('load', asset);
    };

    // load has completed on the resource
    const _loaded = (err, resource, extra) => {
      asset.loaded = true;
      asset.loading = false;
      if (err) {
        this.fire('error', err, asset);
        this.fire('error:' + asset.id, err, asset);
        asset.fire('error', err, asset);
      } else {
        if (!script.legacy && asset.type === 'script') {
          const handler = this._loader.getHandler('script');
          if (handler._cache[asset.id] && handler._cache[asset.id].parentNode === document.head) {
            // remove old element
            document.head.removeChild(handler._cache[asset.id]);
          }
          handler._cache[asset.id] = extra;
        }
        _opened(resource);
      }
    };
    if (file || asset.type === 'cubemap') {
      // start loading the resource
      this.fire('load:start', asset);
      this.fire('load:' + asset.id + ':start', asset);
      asset.loading = true;
      this._loader.load(asset.getFileUrl(), asset.type, _loaded, asset);
    } else {
      // asset has no file to load, open it directly
      const resource = this._loader.open(asset.type, asset.data);
      asset.loaded = true;
      _opened(resource);
    }
  }

  /**
   * Use this to load and create an asset if you don't have assets created. Usually you would
   * only use this if you are not integrated with the PlayCanvas Editor.
   *
   * @param {string} url - The url to load.
   * @param {string} type - The type of asset to load.
   * @param {LoadAssetCallback} callback - Function called when asset is loaded, passed (err,
   * asset), where err is null if no errors were encountered.
   * @example
   * app.assets.loadFromUrl("../path/to/texture.jpg", "texture", function (err, asset) {
   *     var texture = asset.resource;
   * });
   */
  loadFromUrl(url, type, callback) {
    this.loadFromUrlAndFilename(url, null, type, callback);
  }

  /**
   * Use this to load and create an asset when both the URL and filename are required. For
   * example, use this function when loading BLOB assets, where the URL does not adequately
   * identify the file.
   *
   * @param {string} url - The url to load.
   * @param {string} filename - The filename of the asset to load.
   * @param {string} type - The type of asset to load.
   * @param {LoadAssetCallback} callback - Function called when asset is loaded, passed (err,
   * asset), where err is null if no errors were encountered.
   * @example
   * var file = magicallyAttainAFile();
   * app.assets.loadFromUrlAndFilename(URL.createObjectURL(file), "texture.png", "texture", function (err, asset) {
   *     var texture = asset.resource;
   * });
   */
  loadFromUrlAndFilename(url, filename, type, callback) {
    const name = path.getBasename(filename || url);
    const file = {
      filename: filename || name,
      url: url
    };
    let asset = this.getByUrl(url);
    if (!asset) {
      asset = new Asset(name, type, file);
      this.add(asset);
    } else if (asset.loaded) {
      // asset is already loaded
      callback(asset.loadFromUrlError || null, asset);
      return;
    }
    const startLoad = asset => {
      asset.once('load', loadedAsset => {
        if (type === 'material') {
          this._loadTextures(loadedAsset, (err, textures) => {
            callback(err, loadedAsset);
          });
        } else {
          callback(null, loadedAsset);
        }
      });
      asset.once('error', err => {
        // store the error on the asset in case user requests this asset again
        if (err) {
          this.loadFromUrlError = err;
        }
        callback(err, asset);
      });
      this.load(asset);
    };
    if (asset.resource) {
      callback(null, asset);
    } else if (type === 'model') {
      this._loadModel(asset, startLoad);
    } else {
      startLoad(asset);
    }
  }

  // private method used for engine-only loading of model data
  _loadModel(modelAsset, continuation) {
    const url = modelAsset.getFileUrl();
    const ext = path.getExtension(url);
    if (ext === '.json' || ext === '.glb') {
      const dir = path.getDirectory(url);
      const basename = path.getBasename(url);

      // PlayCanvas model format supports material mapping file
      const mappingUrl = path.join(dir, basename.replace(ext, '.mapping.json'));
      this._loader.load(mappingUrl, 'json', (err, data) => {
        if (err) {
          modelAsset.data = {
            mapping: []
          };
          continuation(modelAsset);
        } else {
          this._loadMaterials(modelAsset, data, (e, materials) => {
            modelAsset.data = data;
            continuation(modelAsset);
          });
        }
      });
    } else {
      // other model format (e.g. obj)
      continuation(modelAsset);
    }
  }

  // private method used for engine-only loading of model materials
  _loadMaterials(modelAsset, mapping, callback) {
    const materials = [];
    let count = 0;
    const onMaterialLoaded = (err, materialAsset) => {
      // load dependent textures
      this._loadTextures(materialAsset, (err, textures) => {
        materials.push(materialAsset);
        if (materials.length === count) {
          callback(null, materials);
        }
      });
    };
    for (let i = 0; i < mapping.mapping.length; i++) {
      const path = mapping.mapping[i].path;
      if (path) {
        count++;
        const url = modelAsset.getAbsoluteUrl(path);
        this.loadFromUrl(url, 'material', onMaterialLoaded);
      }
    }
    if (count === 0) {
      callback(null, materials);
    }
  }

  // private method used for engine-only loading of the textures referenced by
  // the material asset
  _loadTextures(materialAsset, callback) {
    const textures = [];
    let count = 0;
    const data = materialAsset.data;
    if (data.mappingFormat !== 'path') {
      Debug.warn(`Skipping: ${materialAsset.name}, material files must be mappingFormat: "path" to be loaded from URL`);
      callback(null, textures);
      return;
    }
    const onTextureLoaded = (err, texture) => {
      if (err) console.error(err);
      textures.push(texture);
      if (textures.length === count) {
        callback(null, textures);
      }
    };
    const texParams = standardMaterialTextureParameters;
    for (let i = 0; i < texParams.length; i++) {
      const path = data[texParams[i]];
      if (path && typeof path === 'string') {
        count++;
        const url = materialAsset.getAbsoluteUrl(path);
        this.loadFromUrl(url, 'texture', onTextureLoaded);
      }
    }
    if (count === 0) {
      callback(null, textures);
    }
  }

  /**
   * Return all Assets with the specified name and type found in the registry.
   *
   * @param {string} name - The name of the Assets to find.
   * @param {string} [type] - The type of the Assets to find.
   * @returns {Asset[]} A list of all Assets found.
   * @example
   * var assets = app.assets.findAll("myTextureAsset", "texture");
   * console.log("Found " + assets.length + " assets called " + name);
   */
  findAll(name, type) {
    const idxs = this._names[name];
    if (idxs) {
      const assets = idxs.map(idx => {
        return this._assets[idx];
      });
      if (type) {
        return assets.filter(asset => {
          return asset.type === type;
        });
      }
      return assets;
    }
    return [];
  }
  _onTagAdd(tag, asset) {
    this._tags.add(tag, asset);
  }
  _onTagRemove(tag, asset) {
    this._tags.remove(tag, asset);
  }

  /**
   * Return all Assets that satisfy the search query. Query can be simply a string, or comma
   * separated strings, to have inclusive results of assets that match at least one query. A
   * query that consists of an array of tags can be used to match assets that have each tag of
   * array.
   *
   * @param {...*} query - Name of a tag or array of tags.
   * @returns {Asset[]} A list of all Assets matched query.
   * @example
   * var assets = app.assets.findByTag("level-1");
   * // returns all assets that tagged by `level-1`
   * @example
   * var assets = app.assets.findByTag("level-1", "level-2");
   * // returns all assets that tagged by `level-1` OR `level-2`
   * @example
   * var assets = app.assets.findByTag(["level-1", "monster"]);
   * // returns all assets that tagged by `level-1` AND `monster`
   * @example
   * var assets = app.assets.findByTag(["level-1", "monster"], ["level-2", "monster"]);
   * // returns all assets that tagged by (`level-1` AND `monster`) OR (`level-2` AND `monster`)
   */
  findByTag() {
    return this._tags.find(arguments);
  }

  /**
   * Return all Assets that satisfy a filter callback.
   *
   * @param {FilterAssetCallback} callback - The callback function that is used to filter assets.
   * Return `true` to include an asset in the returned array.
   * @returns {Asset[]} A list of all Assets found.
   * @example
   * var assets = app.assets.filter(function (asset) {
   *     return asset.name.indexOf('monster') !== -1;
   * });
   * console.log("Found " + assets.length + " assets, where names contains 'monster'");
   */
  filter(callback) {
    return this._assets.filter(asset => callback(asset));
  }

  /**
   * Return the first Asset with the specified name and type found in the registry.
   *
   * @param {string} name - The name of the Asset to find.
   * @param {string} [type] - The type of the Asset to find.
   * @returns {Asset|null} A single Asset or null if no Asset is found.
   * @example
   * var asset = app.assets.find("myTextureAsset", "texture");
   */
  find(name, type) {
    // findAll returns an empty array the if the asset cannot be found so `asset` is
    // never null/undefined
    const asset = this.findAll(name, type);
    return asset.length > 0 ? asset[0] : null;
  }
}

export { AssetRegistry };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtcmVnaXN0cnkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3NDYWNoZSB9IGZyb20gJy4uLy4uL2NvcmUvdGFncy1jYWNoZS5qcyc7XG5cbmltcG9ydCB7IHN0YW5kYXJkTWF0ZXJpYWxUZXh0dXJlUGFyYW1ldGVycyB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1wYXJhbWV0ZXJzLmpzJztcblxuaW1wb3J0IHsgc2NyaXB0IH0gZnJvbSAnLi4vc2NyaXB0LmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuL2Fzc2V0LmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBc3NldFJlZ2lzdHJ5I2ZpbHRlcn0gdG8gZmlsdGVyIGFzc2V0cy5cbiAqXG4gKiBAY2FsbGJhY2sgRmlsdGVyQXNzZXRDYWxsYmFja1xuICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgY3VycmVudCBhc3NldCB0byBmaWx0ZXIuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJuIGB0cnVlYCB0byBpbmNsdWRlIGFzc2V0IHRvIHJlc3VsdCBsaXN0LlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXNzZXRSZWdpc3RyeSNsb2FkRnJvbVVybH0gYW5kIGNhbGxlZCB3aGVuIGFuIGFzc2V0IGlzIGxvYWRlZCAob3IgYW5cbiAqIGVycm9yIG9jY3VycykuXG4gKlxuICogQGNhbGxiYWNrIExvYWRBc3NldENhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpcyBudWxsIGlmIG5vIGVycm9ycyB3ZXJlIGVuY291bnRlcmVkLlxuICogQHBhcmFtIHtBc3NldH0gW2Fzc2V0XSAtIFRoZSBsb2FkZWQgYXNzZXQgaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuXG4gKi9cblxuLyoqXG4gKiBDb250YWluZXIgZm9yIGFsbCBhc3NldHMgdGhhdCBhcmUgYXZhaWxhYmxlIHRvIHRoaXMgYXBwbGljYXRpb24uIE5vdGUgdGhhdCBQbGF5Q2FudmFzIHNjcmlwdHNcbiAqIGFyZSBwcm92aWRlZCB3aXRoIGFuIEFzc2V0UmVnaXN0cnkgaW5zdGFuY2UgYXMgYGFwcC5hc3NldHNgLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgQXNzZXRSZWdpc3RyeSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIGluc3RhbmNlIG9mIGFuIEFzc2V0UmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vaGFuZGxlcnMvbG9hZGVyLmpzJykuUmVzb3VyY2VMb2FkZXJ9IGxvYWRlciAtIFRoZSBSZXNvdXJjZUxvYWRlciB1c2VkIHRvXG4gICAgICogbG9hZCB0aGUgYXNzZXQgZmlsZXMuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobG9hZGVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5fbG9hZGVyID0gbG9hZGVyO1xuXG4gICAgICAgIHRoaXMuX2Fzc2V0cyA9IFtdOyAvLyBsaXN0IG9mIGFsbCBhc3NldHNcbiAgICAgICAgdGhpcy5fY2FjaGUgPSB7fTsgLy8gaW5kZXggZm9yIGxvb2tpbmcgdXAgYXNzZXRzIGJ5IGlkXG4gICAgICAgIHRoaXMuX25hbWVzID0ge307IC8vIGluZGV4IGZvciBsb29raW5nIHVwIGFzc2V0cyBieSBuYW1lXG4gICAgICAgIHRoaXMuX3RhZ3MgPSBuZXcgVGFnc0NhY2hlKCdfaWQnKTsgLy8gaW5kZXggZm9yIGxvb2tpbmcgdXAgYnkgdGFnc1xuICAgICAgICB0aGlzLl91cmxzID0ge307IC8vIGluZGV4IGZvciBsb29raW5nIHVwIGFzc2V0cyBieSB1cmxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSBVUkwgcHJlZml4IHRoYXQgd2lsbCBiZSBhZGRlZCB0byBhbGwgYXNzZXQgbG9hZGluZyByZXF1ZXN0cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucHJlZml4ID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFzc2V0IGNvbXBsZXRlcyBsb2FkaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0UmVnaXN0cnkjbG9hZFxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgaGFzIGp1c3QgbG9hZGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLmFzc2V0cy5vbihcImxvYWRcIiwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiYXNzZXQgbG9hZGVkOiBcIiArIGFzc2V0Lm5hbWUpO1xuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhc3NldCBjb21wbGV0ZXMgbG9hZGluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldFJlZ2lzdHJ5I2xvYWQ6W2lkXVxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgaGFzIGp1c3QgbG9hZGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGlkID0gMTIzNDU2O1xuICAgICAqIHZhciBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KGlkKTtcbiAgICAgKiBhcHAuYXNzZXRzLm9uKFwibG9hZDpcIiArIGlkLCBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coXCJhc3NldCBsb2FkZWQ6IFwiICsgYXNzZXQubmFtZSk7XG4gICAgICogfSk7XG4gICAgICogYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYXNzZXQgY29tcGxldGVzIGxvYWRpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgQXNzZXRSZWdpc3RyeSNsb2FkOnVybDpbdXJsXVxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgaGFzIGp1c3QgbG9hZGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGlkID0gMTIzNDU2O1xuICAgICAqIHZhciBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KGlkKTtcbiAgICAgKiBhcHAuYXNzZXRzLm9uKFwibG9hZDp1cmw6XCIgKyBhc3NldC5maWxlLnVybCwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiYXNzZXQgbG9hZGVkOiBcIiArIGFzc2V0Lm5hbWUpO1xuICAgICAqIH0pO1xuICAgICAqIGFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFzc2V0IGlzIGFkZGVkIHRvIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldFJlZ2lzdHJ5I2FkZFxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgd2FzIGFkZGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLmFzc2V0cy5vbihcImFkZFwiLCBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coXCJOZXcgYXNzZXQgYWRkZWQ6IFwiICsgYXNzZXQubmFtZSk7XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFzc2V0IGlzIGFkZGVkIHRvIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldFJlZ2lzdHJ5I2FkZDpbaWRdXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdGhhdCB3YXMgYWRkZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgaWQgPSAxMjM0NTY7XG4gICAgICogYXBwLmFzc2V0cy5vbihcImFkZDpcIiArIGlkLCBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coXCJBc3NldCAxMjM0NTYgbG9hZGVkXCIpO1xuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhc3NldCBpcyBhZGRlZCB0byB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgQXNzZXRSZWdpc3RyeSNhZGQ6dXJsOlt1cmxdXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdGhhdCB3YXMgYWRkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFzc2V0IGlzIHJlbW92ZWQgZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgQXNzZXRSZWdpc3RyeSNyZW1vdmVcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLmFzc2V0cy5vbihcInJlbW92ZVwiLCBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coXCJBc3NldCByZW1vdmVkOiBcIiArIGFzc2V0Lm5hbWUpO1xuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhc3NldCBpcyByZW1vdmVkIGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0UmVnaXN0cnkjcmVtb3ZlOltpZF1cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGlkID0gMTIzNDU2O1xuICAgICAqIGFwcC5hc3NldHMub24oXCJyZW1vdmU6XCIgKyBpZCwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiQXNzZXQgcmVtb3ZlZDogXCIgKyBhc3NldC5uYW1lKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYXNzZXQgaXMgcmVtb3ZlZCBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldFJlZ2lzdHJ5I3JlbW92ZTp1cmw6W3VybF1cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBlcnJvciBvY2N1cnMgZHVyaW5nIGFzc2V0IGxvYWRpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgQXNzZXRSZWdpc3RyeSNlcnJvclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZS5cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IGdlbmVyYXRlZCB0aGUgZXJyb3IuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgaWQgPSAxMjM0NTY7XG4gICAgICogdmFyIGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQoaWQpO1xuICAgICAqIGFwcC5hc3NldHMub24oXCJlcnJvclwiLCBmdW5jdGlvbiAoZXJyLCBhc3NldCkge1xuICAgICAqICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICogfSk7XG4gICAgICogYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gZXJyb3Igb2NjdXJzIGR1cmluZyBhc3NldCBsb2FkaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0UmVnaXN0cnkjZXJyb3I6W2lkXVxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgZ2VuZXJhdGVkIHRoZSBlcnJvci5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBpZCA9IDEyMzQ1NjtcbiAgICAgKiB2YXIgYXNzZXQgPSBhcHAuYXNzZXRzLmdldChpZCk7XG4gICAgICogYXBwLmFzc2V0cy5vbihcImVycm9yOlwiICsgaWQsIGZ1bmN0aW9uIChlcnIsIGFzc2V0KSB7XG4gICAgICogICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgKiB9KTtcbiAgICAgKiBhcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgZmlsdGVyZWQgbGlzdCBvZiBhc3NldHMgZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZmlsdGVycyAtIFByb3BlcnRpZXMgdG8gZmlsdGVyIG9uLCBjdXJyZW50bHkgc3VwcG9ydHM6ICdwcmVsb2FkOiB0cnVlfGZhbHNlJy5cbiAgICAgKiBAcmV0dXJucyB7QXNzZXRbXX0gVGhlIGZpbHRlcmVkIGxpc3Qgb2YgYXNzZXRzLlxuICAgICAqL1xuICAgIGxpc3QoZmlsdGVycykge1xuICAgICAgICBmaWx0ZXJzID0gZmlsdGVycyB8fCB7fTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0cy5maWx0ZXIoKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICBsZXQgaW5jbHVkZSA9IHRydWU7XG4gICAgICAgICAgICBpZiAoZmlsdGVycy5wcmVsb2FkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBpbmNsdWRlID0gKGFzc2V0LnByZWxvYWQgPT09IGZpbHRlcnMucHJlbG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gaW5jbHVkZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkIGFuIGFzc2V0IHRvIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRvIGFkZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhc3NldCA9IG5ldyBwYy5Bc3NldChcIk15IEFzc2V0XCIsIFwidGV4dHVyZVwiLCB7XG4gICAgICogICAgIHVybDogXCIuLi9wYXRoL3RvL2ltYWdlLmpwZ1wiXG4gICAgICogfSk7XG4gICAgICogYXBwLmFzc2V0cy5hZGQoYXNzZXQpO1xuICAgICAqL1xuICAgIGFkZChhc3NldCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuX2Fzc2V0cy5wdXNoKGFzc2V0KSAtIDE7XG4gICAgICAgIGxldCB1cmw7XG5cbiAgICAgICAgLy8gaWQgY2FjaGVcbiAgICAgICAgdGhpcy5fY2FjaGVbYXNzZXQuaWRdID0gaW5kZXg7XG4gICAgICAgIGlmICghdGhpcy5fbmFtZXNbYXNzZXQubmFtZV0pXG4gICAgICAgICAgICB0aGlzLl9uYW1lc1thc3NldC5uYW1lXSA9IFtdO1xuXG4gICAgICAgIC8vIG5hbWUgY2FjaGVcbiAgICAgICAgdGhpcy5fbmFtZXNbYXNzZXQubmFtZV0ucHVzaChpbmRleCk7XG4gICAgICAgIGlmIChhc3NldC5maWxlKSB7XG4gICAgICAgICAgICB1cmwgPSBhc3NldC5maWxlLnVybDtcbiAgICAgICAgICAgIHRoaXMuX3VybHNbdXJsXSA9IGluZGV4O1xuICAgICAgICB9XG4gICAgICAgIGFzc2V0LnJlZ2lzdHJ5ID0gdGhpcztcblxuICAgICAgICAvLyB0YWdzIGNhY2hlXG4gICAgICAgIHRoaXMuX3RhZ3MuYWRkSXRlbShhc3NldCk7XG4gICAgICAgIGFzc2V0LnRhZ3Mub24oJ2FkZCcsIHRoaXMuX29uVGFnQWRkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQudGFncy5vbigncmVtb3ZlJywgdGhpcy5fb25UYWdSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnYWRkJywgYXNzZXQpO1xuICAgICAgICB0aGlzLmZpcmUoJ2FkZDonICsgYXNzZXQuaWQsIGFzc2V0KTtcbiAgICAgICAgaWYgKHVybClcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnYWRkOnVybDonICsgdXJsLCBhc3NldCk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnByZWxvYWQpXG4gICAgICAgICAgICB0aGlzLmxvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBhbiBhc3NldCBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRvIHJlbW92ZS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYXNzZXQgd2FzIHN1Y2Nlc3NmdWxseSByZW1vdmVkIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXNzZXQgPSBhcHAuYXNzZXRzLmdldCgxMDApO1xuICAgICAqIGFwcC5hc3NldHMucmVtb3ZlKGFzc2V0KTtcbiAgICAgKi9cbiAgICByZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5fY2FjaGVbYXNzZXQuaWRdO1xuICAgICAgICBjb25zdCB1cmwgPSBhc3NldC5maWxlID8gYXNzZXQuZmlsZS51cmwgOiBudWxsO1xuXG4gICAgICAgIGlmIChpZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gbGlzdFxuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLnNwbGljZShpZHgsIDEpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgaWQgLT4gaW5kZXggY2FjaGVcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVthc3NldC5pZF07XG5cbiAgICAgICAgICAgIC8vIG5hbWUgY2FjaGUgbmVlZHMgdG8gYmUgY29tcGxldGVseSByZWJ1aWx0XG4gICAgICAgICAgICB0aGlzLl9uYW1lcyA9IHt9O1xuXG4gICAgICAgICAgICAvLyB1cmxzIGNhY2hlIG5lZWRzIHRvIGJlIGNvbXBsZXRlbHkgcmVidWlsdFxuICAgICAgICAgICAgdGhpcy5fdXJscyA9IFtdO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgaWQgY2FjaGUgYW5kIHJlYnVpbGQgbmFtZSBjYWNoZVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSB0aGlzLl9hc3NldHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYSA9IHRoaXMuX2Fzc2V0c1tpXTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlW2EuaWRdID0gaTtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX25hbWVzW2EubmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbmFtZXNbYS5uYW1lXSA9IFtdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl9uYW1lc1thLm5hbWVdLnB1c2goaSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYS5maWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3VybHNbYS5maWxlLnVybF0gPSBpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGFncyBjYWNoZVxuICAgICAgICAgICAgdGhpcy5fdGFncy5yZW1vdmVJdGVtKGFzc2V0KTtcbiAgICAgICAgICAgIGFzc2V0LnRhZ3Mub2ZmKCdhZGQnLCB0aGlzLl9vblRhZ0FkZCwgdGhpcyk7XG4gICAgICAgICAgICBhc3NldC50YWdzLm9mZigncmVtb3ZlJywgdGhpcy5fb25UYWdSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgICAgICBhc3NldC5maXJlKCdyZW1vdmUnLCBhc3NldCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGFzc2V0KTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlOicgKyBhc3NldC5pZCwgYXNzZXQpO1xuICAgICAgICAgICAgaWYgKHVybClcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZTp1cmw6JyArIHVybCwgYXNzZXQpO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzc2V0IG5vdCBpbiByZWdpc3RyeVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmUgYW4gYXNzZXQgZnJvbSB0aGUgcmVnaXN0cnkgYnkgaXRzIGlkIGZpZWxkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlkIC0gVGhlIGlkIG9mIHRoZSBhc3NldCB0byBnZXQuXG4gICAgICogQHJldHVybnMge0Fzc2V0fSBUaGUgYXNzZXQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXNzZXQgPSBhcHAuYXNzZXRzLmdldCgxMDApO1xuICAgICAqL1xuICAgIGdldChpZCkge1xuICAgICAgICBjb25zdCBpZHggPSB0aGlzLl9jYWNoZVtpZF07XG4gICAgICAgIHJldHVybiB0aGlzLl9hc3NldHNbaWR4XTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZSBhbiBhc3NldCBmcm9tIHRoZSByZWdpc3RyeSBieSBpdHMgZmlsZSdzIFVSTCBmaWVsZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgdXJsIG9mIHRoZSBhc3NldCB0byBnZXQuXG4gICAgICogQHJldHVybnMge0Fzc2V0fSBUaGUgYXNzZXQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXNzZXQgPSBhcHAuYXNzZXRzLmdldEJ5VXJsKFwiLi4vcGF0aC90by9pbWFnZS5qcGdcIik7XG4gICAgICovXG4gICAgZ2V0QnlVcmwodXJsKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuX3VybHNbdXJsXTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0c1tpZHhdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgdGhlIGFzc2V0J3MgZmlsZSBmcm9tIGEgcmVtb3RlIHNvdXJjZS4gTGlzdGVuIGZvciBcImxvYWRcIiBldmVudHMgb24gdGhlIGFzc2V0IHRvIGZpbmRcbiAgICAgKiBvdXQgd2hlbiBpdCBpcyBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0byBsb2FkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gbG9hZCBzb21lIGFzc2V0c1xuICAgICAqIHZhciBhc3NldHNUb0xvYWQgPSBbXG4gICAgICogICAgIGFwcC5hc3NldHMuZmluZChcIk15IEFzc2V0XCIpLFxuICAgICAqICAgICBhcHAuYXNzZXRzLmZpbmQoXCJBbm90aGVyIEFzc2V0XCIpXG4gICAgICogXTtcbiAgICAgKiB2YXIgY291bnQgPSAwO1xuICAgICAqIGFzc2V0c1RvTG9hZC5mb3JFYWNoKGZ1bmN0aW9uIChhc3NldFRvTG9hZCkge1xuICAgICAqICAgICBhc3NldFRvTG9hZC5yZWFkeShmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgICAgIGNvdW50Kys7XG4gICAgICogICAgICAgICBpZiAoY291bnQgPT09IGFzc2V0c1RvTG9hZC5sZW5ndGgpIHtcbiAgICAgKiAgICAgICAgICAgICAvLyBkb25lXG4gICAgICogICAgICAgICB9XG4gICAgICogICAgIH0pO1xuICAgICAqICAgICBhcHAuYXNzZXRzLmxvYWQoYXNzZXRUb0xvYWQpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGxvYWQoYXNzZXQpIHtcbiAgICAgICAgLy8gZG8gbm90aGluZyBpZiBhc3NldCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICAvLyBub3RlOiBsb3RzIG9mIGNvZGUgY2FsbHMgYXNzZXRzLmxvYWQoKSBhc3N1bWluZyB0aGlzIGNoZWNrIGlzIHByZXNlbnRcbiAgICAgICAgLy8gZG9uJ3QgcmVtb3ZlIGl0IHdpdGhvdXQgdXBkYXRpbmcgY2FsbHMgdG8gYXNzZXRzLmxvYWQoKSB3aXRoIGNoZWNrcyBmb3IgdGhlIGFzc2V0LmxvYWRlZCBzdGF0ZVxuICAgICAgICBpZiAoYXNzZXQubG9hZGluZyB8fCBhc3NldC5sb2FkZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpbGUgPSBhc3NldC5maWxlO1xuXG4gICAgICAgIC8vIG9wZW4gaGFzIGNvbXBsZXRlZCBvbiB0aGUgcmVzb3VyY2VcbiAgICAgICAgY29uc3QgX29wZW5lZCA9IChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgICAgICBhc3NldC5yZXNvdXJjZXMgPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXQucmVzb3VyY2UgPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbGV0IGhhbmRsZXIgcGF0Y2ggdGhlIHJlc291cmNlXG4gICAgICAgICAgICB0aGlzLl9sb2FkZXIucGF0Y2goYXNzZXQsIHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQnLCBhc3NldCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6JyArIGFzc2V0LmlkLCBhc3NldCk7XG4gICAgICAgICAgICBpZiAoZmlsZSAmJiBmaWxlLnVybClcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6dXJsOicgKyBmaWxlLnVybCwgYXNzZXQpO1xuICAgICAgICAgICAgYXNzZXQuZmlyZSgnbG9hZCcsIGFzc2V0KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBsb2FkIGhhcyBjb21wbGV0ZWQgb24gdGhlIHJlc291cmNlXG4gICAgICAgIGNvbnN0IF9sb2FkZWQgPSAoZXJyLCByZXNvdXJjZSwgZXh0cmEpID0+IHtcbiAgICAgICAgICAgIGFzc2V0LmxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICBhc3NldC5sb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyLCBhc3NldCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcjonICsgYXNzZXQuaWQsIGVyciwgYXNzZXQpO1xuICAgICAgICAgICAgICAgIGFzc2V0LmZpcmUoJ2Vycm9yJywgZXJyLCBhc3NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghc2NyaXB0LmxlZ2FjeSAmJiBhc3NldC50eXBlID09PSAnc2NyaXB0Jykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fbG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaGFuZGxlci5fY2FjaGVbYXNzZXQuaWRdICYmIGhhbmRsZXIuX2NhY2hlW2Fzc2V0LmlkXS5wYXJlbnROb2RlID09PSBkb2N1bWVudC5oZWFkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgb2xkIGVsZW1lbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmhlYWQucmVtb3ZlQ2hpbGQoaGFuZGxlci5fY2FjaGVbYXNzZXQuaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyLl9jYWNoZVthc3NldC5pZF0gPSBleHRyYTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBfb3BlbmVkKHJlc291cmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoZmlsZSB8fCBhc3NldC50eXBlID09PSAnY3ViZW1hcCcpIHtcbiAgICAgICAgICAgIC8vIHN0YXJ0IGxvYWRpbmcgdGhlIHJlc291cmNlXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6c3RhcnQnLCBhc3NldCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6JyArIGFzc2V0LmlkICsgJzpzdGFydCcsIGFzc2V0KTtcblxuICAgICAgICAgICAgYXNzZXQubG9hZGluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9sb2FkZXIubG9hZChhc3NldC5nZXRGaWxlVXJsKCksIGFzc2V0LnR5cGUsIF9sb2FkZWQsIGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFzc2V0IGhhcyBubyBmaWxlIHRvIGxvYWQsIG9wZW4gaXQgZGlyZWN0bHlcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlID0gdGhpcy5fbG9hZGVyLm9wZW4oYXNzZXQudHlwZSwgYXNzZXQuZGF0YSk7XG4gICAgICAgICAgICBhc3NldC5sb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgX29wZW5lZChyZXNvdXJjZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2UgdGhpcyB0byBsb2FkIGFuZCBjcmVhdGUgYW4gYXNzZXQgaWYgeW91IGRvbid0IGhhdmUgYXNzZXRzIGNyZWF0ZWQuIFVzdWFsbHkgeW91IHdvdWxkXG4gICAgICogb25seSB1c2UgdGhpcyBpZiB5b3UgYXJlIG5vdCBpbnRlZ3JhdGVkIHdpdGggdGhlIFBsYXlDYW52YXMgRWRpdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSB1cmwgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSB0eXBlIG9mIGFzc2V0IHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtMb2FkQXNzZXRDYWxsYmFja30gY2FsbGJhY2sgLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiBhc3NldCBpcyBsb2FkZWQsIHBhc3NlZCAoZXJyLFxuICAgICAqIGFzc2V0KSwgd2hlcmUgZXJyIGlzIG51bGwgaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuYXNzZXRzLmxvYWRGcm9tVXJsKFwiLi4vcGF0aC90by90ZXh0dXJlLmpwZ1wiLCBcInRleHR1cmVcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgdmFyIHRleHR1cmUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkRnJvbVVybCh1cmwsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMubG9hZEZyb21VcmxBbmRGaWxlbmFtZSh1cmwsIG51bGwsIHR5cGUsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2UgdGhpcyB0byBsb2FkIGFuZCBjcmVhdGUgYW4gYXNzZXQgd2hlbiBib3RoIHRoZSBVUkwgYW5kIGZpbGVuYW1lIGFyZSByZXF1aXJlZC4gRm9yXG4gICAgICogZXhhbXBsZSwgdXNlIHRoaXMgZnVuY3Rpb24gd2hlbiBsb2FkaW5nIEJMT0IgYXNzZXRzLCB3aGVyZSB0aGUgVVJMIGRvZXMgbm90IGFkZXF1YXRlbHlcbiAgICAgKiBpZGVudGlmeSB0aGUgZmlsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgdXJsIHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGZpbGVuYW1lIC0gVGhlIGZpbGVuYW1lIG9mIHRoZSBhc3NldCB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIC0gVGhlIHR5cGUgb2YgYXNzZXQgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0xvYWRBc3NldENhbGxiYWNrfSBjYWxsYmFjayAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIGFzc2V0IGlzIGxvYWRlZCwgcGFzc2VkIChlcnIsXG4gICAgICogYXNzZXQpLCB3aGVyZSBlcnIgaXMgbnVsbCBpZiBubyBlcnJvcnMgd2VyZSBlbmNvdW50ZXJlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBmaWxlID0gbWFnaWNhbGx5QXR0YWluQUZpbGUoKTtcbiAgICAgKiBhcHAuYXNzZXRzLmxvYWRGcm9tVXJsQW5kRmlsZW5hbWUoVVJMLmNyZWF0ZU9iamVjdFVSTChmaWxlKSwgXCJ0ZXh0dXJlLnBuZ1wiLCBcInRleHR1cmVcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgdmFyIHRleHR1cmUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkRnJvbVVybEFuZEZpbGVuYW1lKHVybCwgZmlsZW5hbWUsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmdldEJhc2VuYW1lKGZpbGVuYW1lIHx8IHVybCk7XG5cbiAgICAgICAgY29uc3QgZmlsZSA9IHtcbiAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZSB8fCBuYW1lLFxuICAgICAgICAgICAgdXJsOiB1cmxcbiAgICAgICAgfTtcblxuICAgICAgICBsZXQgYXNzZXQgPSB0aGlzLmdldEJ5VXJsKHVybCk7XG4gICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgIGFzc2V0ID0gbmV3IEFzc2V0KG5hbWUsIHR5cGUsIGZpbGUpO1xuICAgICAgICAgICAgdGhpcy5hZGQoYXNzZXQpO1xuICAgICAgICB9IGVsc2UgaWYgKGFzc2V0LmxvYWRlZCkge1xuICAgICAgICAgICAgLy8gYXNzZXQgaXMgYWxyZWFkeSBsb2FkZWRcbiAgICAgICAgICAgIGNhbGxiYWNrKGFzc2V0LmxvYWRGcm9tVXJsRXJyb3IgfHwgbnVsbCwgYXNzZXQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3RhcnRMb2FkID0gKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICBhc3NldC5vbmNlKCdsb2FkJywgKGxvYWRlZEFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdtYXRlcmlhbCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZFRleHR1cmVzKGxvYWRlZEFzc2V0LCAoZXJyLCB0ZXh0dXJlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBsb2FkZWRBc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGxvYWRlZEFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFzc2V0Lm9uY2UoJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBlcnJvciBvbiB0aGUgYXNzZXQgaW4gY2FzZSB1c2VyIHJlcXVlc3RzIHRoaXMgYXNzZXQgYWdhaW5cbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubG9hZEZyb21VcmxFcnJvciA9IGVycjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBhc3NldCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMubG9hZChhc3NldCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBhc3NldCk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ21vZGVsJykge1xuICAgICAgICAgICAgdGhpcy5fbG9hZE1vZGVsKGFzc2V0LCBzdGFydExvYWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhcnRMb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHByaXZhdGUgbWV0aG9kIHVzZWQgZm9yIGVuZ2luZS1vbmx5IGxvYWRpbmcgb2YgbW9kZWwgZGF0YVxuICAgIF9sb2FkTW9kZWwobW9kZWxBc3NldCwgY29udGludWF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHVybCA9IG1vZGVsQXNzZXQuZ2V0RmlsZVVybCgpO1xuICAgICAgICBjb25zdCBleHQgPSBwYXRoLmdldEV4dGVuc2lvbih1cmwpO1xuXG4gICAgICAgIGlmIChleHQgPT09ICcuanNvbicgfHwgZXh0ID09PSAnLmdsYicpIHtcbiAgICAgICAgICAgIGNvbnN0IGRpciA9IHBhdGguZ2V0RGlyZWN0b3J5KHVybCk7XG4gICAgICAgICAgICBjb25zdCBiYXNlbmFtZSA9IHBhdGguZ2V0QmFzZW5hbWUodXJsKTtcblxuICAgICAgICAgICAgLy8gUGxheUNhbnZhcyBtb2RlbCBmb3JtYXQgc3VwcG9ydHMgbWF0ZXJpYWwgbWFwcGluZyBmaWxlXG4gICAgICAgICAgICBjb25zdCBtYXBwaW5nVXJsID0gcGF0aC5qb2luKGRpciwgYmFzZW5hbWUucmVwbGFjZShleHQsICcubWFwcGluZy5qc29uJykpO1xuICAgICAgICAgICAgdGhpcy5fbG9hZGVyLmxvYWQobWFwcGluZ1VybCwgJ2pzb24nLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEFzc2V0LmRhdGEgPSB7IG1hcHBpbmc6IFtdIH07XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVhdGlvbihtb2RlbEFzc2V0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkTWF0ZXJpYWxzKG1vZGVsQXNzZXQsIGRhdGEsIChlLCBtYXRlcmlhbHMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsQXNzZXQuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51YXRpb24obW9kZWxBc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gb3RoZXIgbW9kZWwgZm9ybWF0IChlLmcuIG9iailcbiAgICAgICAgICAgIGNvbnRpbnVhdGlvbihtb2RlbEFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHByaXZhdGUgbWV0aG9kIHVzZWQgZm9yIGVuZ2luZS1vbmx5IGxvYWRpbmcgb2YgbW9kZWwgbWF0ZXJpYWxzXG4gICAgX2xvYWRNYXRlcmlhbHMobW9kZWxBc3NldCwgbWFwcGluZywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWxzID0gW107XG4gICAgICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICAgICAgY29uc3Qgb25NYXRlcmlhbExvYWRlZCA9IChlcnIsIG1hdGVyaWFsQXNzZXQpID0+IHtcbiAgICAgICAgICAgIC8vIGxvYWQgZGVwZW5kZW50IHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLl9sb2FkVGV4dHVyZXMobWF0ZXJpYWxBc3NldCwgKGVyciwgdGV4dHVyZXMpID0+IHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaChtYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWxzLmxlbmd0aCA9PT0gY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbWF0ZXJpYWxzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1hcHBpbmcubWFwcGluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IG1hcHBpbmcubWFwcGluZ1tpXS5wYXRoO1xuICAgICAgICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IG1vZGVsQXNzZXQuZ2V0QWJzb2x1dGVVcmwocGF0aCk7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkRnJvbVVybCh1cmwsICdtYXRlcmlhbCcsIG9uTWF0ZXJpYWxMb2FkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBtYXRlcmlhbHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJpdmF0ZSBtZXRob2QgdXNlZCBmb3IgZW5naW5lLW9ubHkgbG9hZGluZyBvZiB0aGUgdGV4dHVyZXMgcmVmZXJlbmNlZCBieVxuICAgIC8vIHRoZSBtYXRlcmlhbCBhc3NldFxuICAgIF9sb2FkVGV4dHVyZXMobWF0ZXJpYWxBc3NldCwgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgdGV4dHVyZXMgPSBbXTtcbiAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICBjb25zdCBkYXRhID0gbWF0ZXJpYWxBc3NldC5kYXRhO1xuICAgICAgICBpZiAoZGF0YS5tYXBwaW5nRm9ybWF0ICE9PSAncGF0aCcpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYFNraXBwaW5nOiAke21hdGVyaWFsQXNzZXQubmFtZX0sIG1hdGVyaWFsIGZpbGVzIG11c3QgYmUgbWFwcGluZ0Zvcm1hdDogXCJwYXRoXCIgdG8gYmUgbG9hZGVkIGZyb20gVVJMYCk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvblRleHR1cmVMb2FkZWQgPSAoZXJyLCB0ZXh0dXJlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICB0ZXh0dXJlcy5wdXNoKHRleHR1cmUpO1xuICAgICAgICAgICAgaWYgKHRleHR1cmVzLmxlbmd0aCA9PT0gY291bnQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgdGV4UGFyYW1zID0gc3RhbmRhcmRNYXRlcmlhbFRleHR1cmVQYXJhbWV0ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleFBhcmFtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGRhdGFbdGV4UGFyYW1zW2ldXTtcbiAgICAgICAgICAgIGlmIChwYXRoICYmIHR5cGVvZiBwYXRoID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gbWF0ZXJpYWxBc3NldC5nZXRBYnNvbHV0ZVVybChwYXRoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRGcm9tVXJsKHVybCwgJ3RleHR1cmUnLCBvblRleHR1cmVMb2FkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYWxsIEFzc2V0cyB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBhbmQgdHlwZSBmb3VuZCBpbiB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBBc3NldHMgdG8gZmluZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3R5cGVdIC0gVGhlIHR5cGUgb2YgdGhlIEFzc2V0cyB0byBmaW5kLlxuICAgICAqIEByZXR1cm5zIHtBc3NldFtdfSBBIGxpc3Qgb2YgYWxsIEFzc2V0cyBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhc3NldHMgPSBhcHAuYXNzZXRzLmZpbmRBbGwoXCJteVRleHR1cmVBc3NldFwiLCBcInRleHR1cmVcIik7XG4gICAgICogY29uc29sZS5sb2coXCJGb3VuZCBcIiArIGFzc2V0cy5sZW5ndGggKyBcIiBhc3NldHMgY2FsbGVkIFwiICsgbmFtZSk7XG4gICAgICovXG4gICAgZmluZEFsbChuYW1lLCB0eXBlKSB7XG4gICAgICAgIGNvbnN0IGlkeHMgPSB0aGlzLl9uYW1lc1tuYW1lXTtcbiAgICAgICAgaWYgKGlkeHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IGlkeHMubWFwKChpZHgpID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXRzW2lkeF07XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXNzZXRzLmZpbHRlcigoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChhc3NldC50eXBlID09PSB0eXBlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGFzc2V0cztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBfb25UYWdBZGQodGFnLCBhc3NldCkge1xuICAgICAgICB0aGlzLl90YWdzLmFkZCh0YWcsIGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25UYWdSZW1vdmUodGFnLCBhc3NldCkge1xuICAgICAgICB0aGlzLl90YWdzLnJlbW92ZSh0YWcsIGFzc2V0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYWxsIEFzc2V0cyB0aGF0IHNhdGlzZnkgdGhlIHNlYXJjaCBxdWVyeS4gUXVlcnkgY2FuIGJlIHNpbXBseSBhIHN0cmluZywgb3IgY29tbWFcbiAgICAgKiBzZXBhcmF0ZWQgc3RyaW5ncywgdG8gaGF2ZSBpbmNsdXNpdmUgcmVzdWx0cyBvZiBhc3NldHMgdGhhdCBtYXRjaCBhdCBsZWFzdCBvbmUgcXVlcnkuIEFcbiAgICAgKiBxdWVyeSB0aGF0IGNvbnNpc3RzIG9mIGFuIGFycmF5IG9mIHRhZ3MgY2FuIGJlIHVzZWQgdG8gbWF0Y2ggYXNzZXRzIHRoYXQgaGF2ZSBlYWNoIHRhZyBvZlxuICAgICAqIGFycmF5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHsuLi4qfSBxdWVyeSAtIE5hbWUgb2YgYSB0YWcgb3IgYXJyYXkgb2YgdGFncy5cbiAgICAgKiBAcmV0dXJucyB7QXNzZXRbXX0gQSBsaXN0IG9mIGFsbCBBc3NldHMgbWF0Y2hlZCBxdWVyeS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhc3NldHMgPSBhcHAuYXNzZXRzLmZpbmRCeVRhZyhcImxldmVsLTFcIik7XG4gICAgICogLy8gcmV0dXJucyBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IGBsZXZlbC0xYFxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZEJ5VGFnKFwibGV2ZWwtMVwiLCBcImxldmVsLTJcIik7XG4gICAgICogLy8gcmV0dXJucyBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IGBsZXZlbC0xYCBPUiBgbGV2ZWwtMmBcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhc3NldHMgPSBhcHAuYXNzZXRzLmZpbmRCeVRhZyhbXCJsZXZlbC0xXCIsIFwibW9uc3RlclwiXSk7XG4gICAgICogLy8gcmV0dXJucyBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IGBsZXZlbC0xYCBBTkQgYG1vbnN0ZXJgXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXNzZXRzID0gYXBwLmFzc2V0cy5maW5kQnlUYWcoW1wibGV2ZWwtMVwiLCBcIm1vbnN0ZXJcIl0sIFtcImxldmVsLTJcIiwgXCJtb25zdGVyXCJdKTtcbiAgICAgKiAvLyByZXR1cm5zIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgKGBsZXZlbC0xYCBBTkQgYG1vbnN0ZXJgKSBPUiAoYGxldmVsLTJgIEFORCBgbW9uc3RlcmApXG4gICAgICovXG4gICAgZmluZEJ5VGFnKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdGFncy5maW5kKGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGFsbCBBc3NldHMgdGhhdCBzYXRpc2Z5IGEgZmlsdGVyIGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtGaWx0ZXJBc3NldENhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0aGF0IGlzIHVzZWQgdG8gZmlsdGVyIGFzc2V0cy5cbiAgICAgKiBSZXR1cm4gYHRydWVgIHRvIGluY2x1ZGUgYW4gYXNzZXQgaW4gdGhlIHJldHVybmVkIGFycmF5LlxuICAgICAqIEByZXR1cm5zIHtBc3NldFtdfSBBIGxpc3Qgb2YgYWxsIEFzc2V0cyBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhc3NldHMgPSBhcHAuYXNzZXRzLmZpbHRlcihmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgcmV0dXJuIGFzc2V0Lm5hbWUuaW5kZXhPZignbW9uc3RlcicpICE9PSAtMTtcbiAgICAgKiB9KTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIkZvdW5kIFwiICsgYXNzZXRzLmxlbmd0aCArIFwiIGFzc2V0cywgd2hlcmUgbmFtZXMgY29udGFpbnMgJ21vbnN0ZXInXCIpO1xuICAgICAqL1xuICAgIGZpbHRlcihjYWxsYmFjaykge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXRzLmZpbHRlcihhc3NldCA9PiBjYWxsYmFjayhhc3NldCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgZmlyc3QgQXNzZXQgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgYW5kIHR5cGUgZm91bmQgaW4gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgQXNzZXQgdG8gZmluZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3R5cGVdIC0gVGhlIHR5cGUgb2YgdGhlIEFzc2V0IHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge0Fzc2V0fG51bGx9IEEgc2luZ2xlIEFzc2V0IG9yIG51bGwgaWYgbm8gQXNzZXQgaXMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXNzZXQgPSBhcHAuYXNzZXRzLmZpbmQoXCJteVRleHR1cmVBc3NldFwiLCBcInRleHR1cmVcIik7XG4gICAgICovXG4gICAgZmluZChuYW1lLCB0eXBlKSB7XG4gICAgICAgIC8vIGZpbmRBbGwgcmV0dXJucyBhbiBlbXB0eSBhcnJheSB0aGUgaWYgdGhlIGFzc2V0IGNhbm5vdCBiZSBmb3VuZCBzbyBgYXNzZXRgIGlzXG4gICAgICAgIC8vIG5ldmVyIG51bGwvdW5kZWZpbmVkXG4gICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5maW5kQWxsKG5hbWUsIHR5cGUpO1xuICAgICAgICByZXR1cm4gYXNzZXQubGVuZ3RoID4gMCA/IGFzc2V0WzBdIDogbnVsbDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEFzc2V0UmVnaXN0cnkgfTtcbiJdLCJuYW1lcyI6WyJBc3NldFJlZ2lzdHJ5IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJsb2FkZXIiLCJfbG9hZGVyIiwiX2Fzc2V0cyIsIl9jYWNoZSIsIl9uYW1lcyIsIl90YWdzIiwiVGFnc0NhY2hlIiwiX3VybHMiLCJwcmVmaXgiLCJsaXN0IiwiZmlsdGVycyIsImZpbHRlciIsImFzc2V0IiwiaW5jbHVkZSIsInByZWxvYWQiLCJ1bmRlZmluZWQiLCJhZGQiLCJpbmRleCIsInB1c2giLCJ1cmwiLCJpZCIsIm5hbWUiLCJmaWxlIiwicmVnaXN0cnkiLCJhZGRJdGVtIiwidGFncyIsIm9uIiwiX29uVGFnQWRkIiwiX29uVGFnUmVtb3ZlIiwiZmlyZSIsImxvYWQiLCJyZW1vdmUiLCJpZHgiLCJzcGxpY2UiLCJpIiwibCIsImxlbmd0aCIsImEiLCJyZW1vdmVJdGVtIiwib2ZmIiwiZ2V0IiwiZ2V0QnlVcmwiLCJsb2FkaW5nIiwibG9hZGVkIiwiX29wZW5lZCIsInJlc291cmNlIiwiQXJyYXkiLCJyZXNvdXJjZXMiLCJwYXRjaCIsIl9sb2FkZWQiLCJlcnIiLCJleHRyYSIsInNjcmlwdCIsImxlZ2FjeSIsInR5cGUiLCJoYW5kbGVyIiwiZ2V0SGFuZGxlciIsInBhcmVudE5vZGUiLCJkb2N1bWVudCIsImhlYWQiLCJyZW1vdmVDaGlsZCIsImdldEZpbGVVcmwiLCJvcGVuIiwiZGF0YSIsImxvYWRGcm9tVXJsIiwiY2FsbGJhY2siLCJsb2FkRnJvbVVybEFuZEZpbGVuYW1lIiwiZmlsZW5hbWUiLCJwYXRoIiwiZ2V0QmFzZW5hbWUiLCJBc3NldCIsImxvYWRGcm9tVXJsRXJyb3IiLCJzdGFydExvYWQiLCJvbmNlIiwibG9hZGVkQXNzZXQiLCJfbG9hZFRleHR1cmVzIiwidGV4dHVyZXMiLCJfbG9hZE1vZGVsIiwibW9kZWxBc3NldCIsImNvbnRpbnVhdGlvbiIsImV4dCIsImdldEV4dGVuc2lvbiIsImRpciIsImdldERpcmVjdG9yeSIsImJhc2VuYW1lIiwibWFwcGluZ1VybCIsImpvaW4iLCJyZXBsYWNlIiwibWFwcGluZyIsIl9sb2FkTWF0ZXJpYWxzIiwiZSIsIm1hdGVyaWFscyIsImNvdW50Iiwib25NYXRlcmlhbExvYWRlZCIsIm1hdGVyaWFsQXNzZXQiLCJnZXRBYnNvbHV0ZVVybCIsIm1hcHBpbmdGb3JtYXQiLCJEZWJ1ZyIsIndhcm4iLCJvblRleHR1cmVMb2FkZWQiLCJ0ZXh0dXJlIiwiY29uc29sZSIsImVycm9yIiwidGV4UGFyYW1zIiwic3RhbmRhcmRNYXRlcmlhbFRleHR1cmVQYXJhbWV0ZXJzIiwiZmluZEFsbCIsImlkeHMiLCJhc3NldHMiLCJtYXAiLCJ0YWciLCJmaW5kQnlUYWci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
