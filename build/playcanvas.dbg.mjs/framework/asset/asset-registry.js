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
   * const id = 123456;
   * const asset = app.assets.get(id);
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
   * const id = 123456;
   * const asset = app.assets.get(id);
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
   * const id = 123456;
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
   * const id = 123456;
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
   * const id = 123456;
   * const asset = app.assets.get(id);
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
   * const id = 123456;
   * const asset = app.assets.get(id);
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
   * const asset = new pc.Asset("My Asset", "texture", {
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
   * const asset = app.assets.get(100);
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
   * const asset = app.assets.get(100);
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
   * const asset = app.assets.getByUrl("../path/to/image.jpg");
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
   * const assetsToLoad = [
   *     app.assets.find("My Asset"),
   *     app.assets.find("Another Asset")
   * ];
   * let count = 0;
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
   *     const texture = asset.resource;
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
   * const file = magicallyAttainAFile();
   * app.assets.loadFromUrlAndFilename(URL.createObjectURL(file), "texture.png", "texture", function (err, asset) {
   *     const texture = asset.resource;
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
   * const assets = app.assets.findAll("myTextureAsset", "texture");
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
   * const assets = app.assets.findByTag("level-1");
   * // returns all assets that tagged by `level-1`
   * @example
   * const assets = app.assets.findByTag("level-1", "level-2");
   * // returns all assets that tagged by `level-1` OR `level-2`
   * @example
   * const assets = app.assets.findByTag(["level-1", "monster"]);
   * // returns all assets that tagged by `level-1` AND `monster`
   * @example
   * const assets = app.assets.findByTag(["level-1", "monster"], ["level-2", "monster"]);
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
   * const assets = app.assets.filter(function (asset) {
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
   * const asset = app.assets.find("myTextureAsset", "texture");
   */
  find(name, type) {
    // findAll returns an empty array the if the asset cannot be found so `asset` is
    // never null/undefined
    const asset = this.findAll(name, type);
    return asset.length > 0 ? asset[0] : null;
  }
}

export { AssetRegistry };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtcmVnaXN0cnkuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXNzZXQvYXNzZXQtcmVnaXN0cnkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IFRhZ3NDYWNoZSB9IGZyb20gJy4uLy4uL2NvcmUvdGFncy1jYWNoZS5qcyc7XG5cbmltcG9ydCB7IHN0YW5kYXJkTWF0ZXJpYWxUZXh0dXJlUGFyYW1ldGVycyB9IGZyb20gJy4uLy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1wYXJhbWV0ZXJzLmpzJztcblxuaW1wb3J0IHsgc2NyaXB0IH0gZnJvbSAnLi4vc2NyaXB0LmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuL2Fzc2V0LmpzJztcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBc3NldFJlZ2lzdHJ5I2ZpbHRlcn0gdG8gZmlsdGVyIGFzc2V0cy5cbiAqXG4gKiBAY2FsbGJhY2sgRmlsdGVyQXNzZXRDYWxsYmFja1xuICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgY3VycmVudCBhc3NldCB0byBmaWx0ZXIuXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJuIGB0cnVlYCB0byBpbmNsdWRlIGFzc2V0IHRvIHJlc3VsdCBsaXN0LlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXNzZXRSZWdpc3RyeSNsb2FkRnJvbVVybH0gYW5kIGNhbGxlZCB3aGVuIGFuIGFzc2V0IGlzIGxvYWRlZCAob3IgYW5cbiAqIGVycm9yIG9jY3VycykuXG4gKlxuICogQGNhbGxiYWNrIExvYWRBc3NldENhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpcyBudWxsIGlmIG5vIGVycm9ycyB3ZXJlIGVuY291bnRlcmVkLlxuICogQHBhcmFtIHtBc3NldH0gW2Fzc2V0XSAtIFRoZSBsb2FkZWQgYXNzZXQgaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuXG4gKi9cblxuLyoqXG4gKiBDb250YWluZXIgZm9yIGFsbCBhc3NldHMgdGhhdCBhcmUgYXZhaWxhYmxlIHRvIHRoaXMgYXBwbGljYXRpb24uIE5vdGUgdGhhdCBQbGF5Q2FudmFzIHNjcmlwdHNcbiAqIGFyZSBwcm92aWRlZCB3aXRoIGFuIEFzc2V0UmVnaXN0cnkgaW5zdGFuY2UgYXMgYGFwcC5hc3NldHNgLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgQXNzZXRSZWdpc3RyeSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGFuIGluc3RhbmNlIG9mIGFuIEFzc2V0UmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vaGFuZGxlcnMvbG9hZGVyLmpzJykuUmVzb3VyY2VMb2FkZXJ9IGxvYWRlciAtIFRoZSBSZXNvdXJjZUxvYWRlciB1c2VkIHRvXG4gICAgICogbG9hZCB0aGUgYXNzZXQgZmlsZXMuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobG9hZGVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5fbG9hZGVyID0gbG9hZGVyO1xuXG4gICAgICAgIHRoaXMuX2Fzc2V0cyA9IFtdOyAvLyBsaXN0IG9mIGFsbCBhc3NldHNcbiAgICAgICAgdGhpcy5fY2FjaGUgPSB7fTsgLy8gaW5kZXggZm9yIGxvb2tpbmcgdXAgYXNzZXRzIGJ5IGlkXG4gICAgICAgIHRoaXMuX25hbWVzID0ge307IC8vIGluZGV4IGZvciBsb29raW5nIHVwIGFzc2V0cyBieSBuYW1lXG4gICAgICAgIHRoaXMuX3RhZ3MgPSBuZXcgVGFnc0NhY2hlKCdfaWQnKTsgLy8gaW5kZXggZm9yIGxvb2tpbmcgdXAgYnkgdGFnc1xuICAgICAgICB0aGlzLl91cmxzID0ge307IC8vIGluZGV4IGZvciBsb29raW5nIHVwIGFzc2V0cyBieSB1cmxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQSBVUkwgcHJlZml4IHRoYXQgd2lsbCBiZSBhZGRlZCB0byBhbGwgYXNzZXQgbG9hZGluZyByZXF1ZXN0cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucHJlZml4ID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFzc2V0IGNvbXBsZXRlcyBsb2FkaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0UmVnaXN0cnkjbG9hZFxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgaGFzIGp1c3QgbG9hZGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLmFzc2V0cy5vbihcImxvYWRcIiwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiYXNzZXQgbG9hZGVkOiBcIiArIGFzc2V0Lm5hbWUpO1xuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhc3NldCBjb21wbGV0ZXMgbG9hZGluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldFJlZ2lzdHJ5I2xvYWQ6W2lkXVxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgaGFzIGp1c3QgbG9hZGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgaWQgPSAxMjM0NTY7XG4gICAgICogY29uc3QgYXNzZXQgPSBhcHAuYXNzZXRzLmdldChpZCk7XG4gICAgICogYXBwLmFzc2V0cy5vbihcImxvYWQ6XCIgKyBpZCwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiYXNzZXQgbG9hZGVkOiBcIiArIGFzc2V0Lm5hbWUpO1xuICAgICAqIH0pO1xuICAgICAqIGFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGFzc2V0IGNvbXBsZXRlcyBsb2FkaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0UmVnaXN0cnkjbG9hZDp1cmw6W3VybF1cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IGhhcyBqdXN0IGxvYWRlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGlkID0gMTIzNDU2O1xuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5nZXQoaWQpO1xuICAgICAqIGFwcC5hc3NldHMub24oXCJsb2FkOnVybDpcIiArIGFzc2V0LmZpbGUudXJsLCBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc29sZS5sb2coXCJhc3NldCBsb2FkZWQ6IFwiICsgYXNzZXQubmFtZSk7XG4gICAgICogfSk7XG4gICAgICogYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYXNzZXQgaXMgYWRkZWQgdG8gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0UmVnaXN0cnkjYWRkXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdGhhdCB3YXMgYWRkZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuYXNzZXRzLm9uKFwiYWRkXCIsIGZ1bmN0aW9uIChhc3NldCkge1xuICAgICAqICAgICBjb25zb2xlLmxvZyhcIk5ldyBhc3NldCBhZGRlZDogXCIgKyBhc3NldC5uYW1lKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYXNzZXQgaXMgYWRkZWQgdG8gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0UmVnaXN0cnkjYWRkOltpZF1cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IHdhcyBhZGRlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGlkID0gMTIzNDU2O1xuICAgICAqIGFwcC5hc3NldHMub24oXCJhZGQ6XCIgKyBpZCwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiQXNzZXQgMTIzNDU2IGxvYWRlZFwiKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYXNzZXQgaXMgYWRkZWQgdG8gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0UmVnaXN0cnkjYWRkOnVybDpbdXJsXVxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgd2FzIGFkZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBhc3NldCBpcyByZW1vdmVkIGZyb20gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0UmVnaXN0cnkjcmVtb3ZlXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdGhhdCB3YXMgcmVtb3ZlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5hc3NldHMub24oXCJyZW1vdmVcIiwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiQXNzZXQgcmVtb3ZlZDogXCIgKyBhc3NldC5uYW1lKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYXNzZXQgaXMgcmVtb3ZlZCBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldFJlZ2lzdHJ5I3JlbW92ZTpbaWRdXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdGhhdCB3YXMgcmVtb3ZlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGlkID0gMTIzNDU2O1xuICAgICAqIGFwcC5hc3NldHMub24oXCJyZW1vdmU6XCIgKyBpZCwgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICogICAgIGNvbnNvbGUubG9nKFwiQXNzZXQgcmVtb3ZlZDogXCIgKyBhc3NldC5uYW1lKTtcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gYW4gYXNzZXQgaXMgcmVtb3ZlZCBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldFJlZ2lzdHJ5I3JlbW92ZTp1cmw6W3VybF1cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhbiBlcnJvciBvY2N1cnMgZHVyaW5nIGFzc2V0IGxvYWRpbmcuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgQXNzZXRSZWdpc3RyeSNlcnJvclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZS5cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IGdlbmVyYXRlZCB0aGUgZXJyb3IuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBpZCA9IDEyMzQ1NjtcbiAgICAgKiBjb25zdCBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KGlkKTtcbiAgICAgKiBhcHAuYXNzZXRzLm9uKFwiZXJyb3JcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAqIH0pO1xuICAgICAqIGFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGFuIGVycm9yIG9jY3VycyBkdXJpbmcgYXNzZXQgbG9hZGluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldFJlZ2lzdHJ5I2Vycm9yOltpZF1cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IGdlbmVyYXRlZCB0aGUgZXJyb3IuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBpZCA9IDEyMzQ1NjtcbiAgICAgKiBjb25zdCBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KGlkKTtcbiAgICAgKiBhcHAuYXNzZXRzLm9uKFwiZXJyb3I6XCIgKyBpZCwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAqIH0pO1xuICAgICAqIGFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBmaWx0ZXJlZCBsaXN0IG9mIGFzc2V0cyBmcm9tIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBmaWx0ZXJzIC0gUHJvcGVydGllcyB0byBmaWx0ZXIgb24sIGN1cnJlbnRseSBzdXBwb3J0czogJ3ByZWxvYWQ6IHRydWV8ZmFsc2UnLlxuICAgICAqIEByZXR1cm5zIHtBc3NldFtdfSBUaGUgZmlsdGVyZWQgbGlzdCBvZiBhc3NldHMuXG4gICAgICovXG4gICAgbGlzdChmaWx0ZXJzKSB7XG4gICAgICAgIGZpbHRlcnMgPSBmaWx0ZXJzIHx8IHt9O1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXRzLmZpbHRlcigoYXNzZXQpID0+IHtcbiAgICAgICAgICAgIGxldCBpbmNsdWRlID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChmaWx0ZXJzLnByZWxvYWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGluY2x1ZGUgPSAoYXNzZXQucHJlbG9hZCA9PT0gZmlsdGVycy5wcmVsb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbmNsdWRlO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgYW4gYXNzZXQgdG8gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdG8gYWRkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYXNzZXQgPSBuZXcgcGMuQXNzZXQoXCJNeSBBc3NldFwiLCBcInRleHR1cmVcIiwge1xuICAgICAqICAgICB1cmw6IFwiLi4vcGF0aC90by9pbWFnZS5qcGdcIlxuICAgICAqIH0pO1xuICAgICAqIGFwcC5hc3NldHMuYWRkKGFzc2V0KTtcbiAgICAgKi9cbiAgICBhZGQoYXNzZXQpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9hc3NldHMucHVzaChhc3NldCkgLSAxO1xuICAgICAgICBsZXQgdXJsO1xuXG4gICAgICAgIC8vIGlkIGNhY2hlXG4gICAgICAgIHRoaXMuX2NhY2hlW2Fzc2V0LmlkXSA9IGluZGV4O1xuICAgICAgICBpZiAoIXRoaXMuX25hbWVzW2Fzc2V0Lm5hbWVdKVxuICAgICAgICAgICAgdGhpcy5fbmFtZXNbYXNzZXQubmFtZV0gPSBbXTtcblxuICAgICAgICAvLyBuYW1lIGNhY2hlXG4gICAgICAgIHRoaXMuX25hbWVzW2Fzc2V0Lm5hbWVdLnB1c2goaW5kZXgpO1xuICAgICAgICBpZiAoYXNzZXQuZmlsZSkge1xuICAgICAgICAgICAgdXJsID0gYXNzZXQuZmlsZS51cmw7XG4gICAgICAgICAgICB0aGlzLl91cmxzW3VybF0gPSBpbmRleDtcbiAgICAgICAgfVxuICAgICAgICBhc3NldC5yZWdpc3RyeSA9IHRoaXM7XG5cbiAgICAgICAgLy8gdGFncyBjYWNoZVxuICAgICAgICB0aGlzLl90YWdzLmFkZEl0ZW0oYXNzZXQpO1xuICAgICAgICBhc3NldC50YWdzLm9uKCdhZGQnLCB0aGlzLl9vblRhZ0FkZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0LnRhZ3Mub24oJ3JlbW92ZScsIHRoaXMuX29uVGFnUmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ2FkZCcsIGFzc2V0KTtcbiAgICAgICAgdGhpcy5maXJlKCdhZGQ6JyArIGFzc2V0LmlkLCBhc3NldCk7XG4gICAgICAgIGlmICh1cmwpXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2FkZDp1cmw6JyArIHVybCwgYXNzZXQpO1xuXG4gICAgICAgIGlmIChhc3NldC5wcmVsb2FkKVxuICAgICAgICAgICAgdGhpcy5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgYW4gYXNzZXQgZnJvbSB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0byByZW1vdmUuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGFzc2V0IHdhcyBzdWNjZXNzZnVsbHkgcmVtb3ZlZCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYXNzZXQgPSBhcHAuYXNzZXRzLmdldCgxMDApO1xuICAgICAqIGFwcC5hc3NldHMucmVtb3ZlKGFzc2V0KTtcbiAgICAgKi9cbiAgICByZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5fY2FjaGVbYXNzZXQuaWRdO1xuICAgICAgICBjb25zdCB1cmwgPSBhc3NldC5maWxlID8gYXNzZXQuZmlsZS51cmwgOiBudWxsO1xuXG4gICAgICAgIGlmIChpZHggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGZyb20gbGlzdFxuICAgICAgICAgICAgdGhpcy5fYXNzZXRzLnNwbGljZShpZHgsIDEpO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgaWQgLT4gaW5kZXggY2FjaGVcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9jYWNoZVthc3NldC5pZF07XG5cbiAgICAgICAgICAgIC8vIG5hbWUgY2FjaGUgbmVlZHMgdG8gYmUgY29tcGxldGVseSByZWJ1aWx0XG4gICAgICAgICAgICB0aGlzLl9uYW1lcyA9IHt9O1xuXG4gICAgICAgICAgICAvLyB1cmxzIGNhY2hlIG5lZWRzIHRvIGJlIGNvbXBsZXRlbHkgcmVidWlsdFxuICAgICAgICAgICAgdGhpcy5fdXJscyA9IFtdO1xuXG4gICAgICAgICAgICAvLyB1cGRhdGUgaWQgY2FjaGUgYW5kIHJlYnVpbGQgbmFtZSBjYWNoZVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSB0aGlzLl9hc3NldHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYSA9IHRoaXMuX2Fzc2V0c1tpXTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2NhY2hlW2EuaWRdID0gaTtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX25hbWVzW2EubmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbmFtZXNbYS5uYW1lXSA9IFtdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLl9uYW1lc1thLm5hbWVdLnB1c2goaSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYS5maWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3VybHNbYS5maWxlLnVybF0gPSBpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGFncyBjYWNoZVxuICAgICAgICAgICAgdGhpcy5fdGFncy5yZW1vdmVJdGVtKGFzc2V0KTtcbiAgICAgICAgICAgIGFzc2V0LnRhZ3Mub2ZmKCdhZGQnLCB0aGlzLl9vblRhZ0FkZCwgdGhpcyk7XG4gICAgICAgICAgICBhc3NldC50YWdzLm9mZigncmVtb3ZlJywgdGhpcy5fb25UYWdSZW1vdmUsIHRoaXMpO1xuXG4gICAgICAgICAgICBhc3NldC5maXJlKCdyZW1vdmUnLCBhc3NldCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGFzc2V0KTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgncmVtb3ZlOicgKyBhc3NldC5pZCwgYXNzZXQpO1xuICAgICAgICAgICAgaWYgKHVybClcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZTp1cmw6JyArIHVybCwgYXNzZXQpO1xuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzc2V0IG5vdCBpbiByZWdpc3RyeVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmUgYW4gYXNzZXQgZnJvbSB0aGUgcmVnaXN0cnkgYnkgaXRzIGlkIGZpZWxkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGlkIC0gVGhlIGlkIG9mIHRoZSBhc3NldCB0byBnZXQuXG4gICAgICogQHJldHVybnMge0Fzc2V0fSBUaGUgYXNzZXQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KDEwMCk7XG4gICAgICovXG4gICAgZ2V0KGlkKSB7XG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuX2NhY2hlW2lkXTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0c1tpZHhdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlIGFuIGFzc2V0IGZyb20gdGhlIHJlZ2lzdHJ5IGJ5IGl0cyBmaWxlJ3MgVVJMIGZpZWxkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSB1cmwgb2YgdGhlIGFzc2V0IHRvIGdldC5cbiAgICAgKiBAcmV0dXJucyB7QXNzZXR9IFRoZSBhc3NldC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5nZXRCeVVybChcIi4uL3BhdGgvdG8vaW1hZ2UuanBnXCIpO1xuICAgICAqL1xuICAgIGdldEJ5VXJsKHVybCkge1xuICAgICAgICBjb25zdCBpZHggPSB0aGlzLl91cmxzW3VybF07XG4gICAgICAgIHJldHVybiB0aGlzLl9hc3NldHNbaWR4XTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkIHRoZSBhc3NldCdzIGZpbGUgZnJvbSBhIHJlbW90ZSBzb3VyY2UuIExpc3RlbiBmb3IgXCJsb2FkXCIgZXZlbnRzIG9uIHRoZSBhc3NldCB0byBmaW5kXG4gICAgICogb3V0IHdoZW4gaXQgaXMgbG9hZGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdG8gbG9hZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIGxvYWQgc29tZSBhc3NldHNcbiAgICAgKiBjb25zdCBhc3NldHNUb0xvYWQgPSBbXG4gICAgICogICAgIGFwcC5hc3NldHMuZmluZChcIk15IEFzc2V0XCIpLFxuICAgICAqICAgICBhcHAuYXNzZXRzLmZpbmQoXCJBbm90aGVyIEFzc2V0XCIpXG4gICAgICogXTtcbiAgICAgKiBsZXQgY291bnQgPSAwO1xuICAgICAqIGFzc2V0c1RvTG9hZC5mb3JFYWNoKGZ1bmN0aW9uIChhc3NldFRvTG9hZCkge1xuICAgICAqICAgICBhc3NldFRvTG9hZC5yZWFkeShmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgICAgIGNvdW50Kys7XG4gICAgICogICAgICAgICBpZiAoY291bnQgPT09IGFzc2V0c1RvTG9hZC5sZW5ndGgpIHtcbiAgICAgKiAgICAgICAgICAgICAvLyBkb25lXG4gICAgICogICAgICAgICB9XG4gICAgICogICAgIH0pO1xuICAgICAqICAgICBhcHAuYXNzZXRzLmxvYWQoYXNzZXRUb0xvYWQpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGxvYWQoYXNzZXQpIHtcbiAgICAgICAgLy8gZG8gbm90aGluZyBpZiBhc3NldCBpcyBhbHJlYWR5IGxvYWRlZFxuICAgICAgICAvLyBub3RlOiBsb3RzIG9mIGNvZGUgY2FsbHMgYXNzZXRzLmxvYWQoKSBhc3N1bWluZyB0aGlzIGNoZWNrIGlzIHByZXNlbnRcbiAgICAgICAgLy8gZG9uJ3QgcmVtb3ZlIGl0IHdpdGhvdXQgdXBkYXRpbmcgY2FsbHMgdG8gYXNzZXRzLmxvYWQoKSB3aXRoIGNoZWNrcyBmb3IgdGhlIGFzc2V0LmxvYWRlZCBzdGF0ZVxuICAgICAgICBpZiAoYXNzZXQubG9hZGluZyB8fCBhc3NldC5sb2FkZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpbGUgPSBhc3NldC5maWxlO1xuXG4gICAgICAgIC8vIG9wZW4gaGFzIGNvbXBsZXRlZCBvbiB0aGUgcmVzb3VyY2VcbiAgICAgICAgY29uc3QgX29wZW5lZCA9IChyZXNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHJlc291cmNlIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICAgICAgICBhc3NldC5yZXNvdXJjZXMgPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXQucmVzb3VyY2UgPSByZXNvdXJjZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbGV0IGhhbmRsZXIgcGF0Y2ggdGhlIHJlc291cmNlXG4gICAgICAgICAgICB0aGlzLl9sb2FkZXIucGF0Y2goYXNzZXQsIHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQnLCBhc3NldCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6JyArIGFzc2V0LmlkLCBhc3NldCk7XG4gICAgICAgICAgICBpZiAoZmlsZSAmJiBmaWxlLnVybClcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6dXJsOicgKyBmaWxlLnVybCwgYXNzZXQpO1xuICAgICAgICAgICAgYXNzZXQuZmlyZSgnbG9hZCcsIGFzc2V0KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBsb2FkIGhhcyBjb21wbGV0ZWQgb24gdGhlIHJlc291cmNlXG4gICAgICAgIGNvbnN0IF9sb2FkZWQgPSAoZXJyLCByZXNvdXJjZSwgZXh0cmEpID0+IHtcbiAgICAgICAgICAgIGFzc2V0LmxvYWRlZCA9IHRydWU7XG4gICAgICAgICAgICBhc3NldC5sb2FkaW5nID0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ2Vycm9yJywgZXJyLCBhc3NldCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdlcnJvcjonICsgYXNzZXQuaWQsIGVyciwgYXNzZXQpO1xuICAgICAgICAgICAgICAgIGFzc2V0LmZpcmUoJ2Vycm9yJywgZXJyLCBhc3NldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghc2NyaXB0LmxlZ2FjeSAmJiBhc3NldC50eXBlID09PSAnc2NyaXB0Jykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gdGhpcy5fbG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaGFuZGxlci5fY2FjaGVbYXNzZXQuaWRdICYmIGhhbmRsZXIuX2NhY2hlW2Fzc2V0LmlkXS5wYXJlbnROb2RlID09PSBkb2N1bWVudC5oZWFkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgb2xkIGVsZW1lbnRcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmhlYWQucmVtb3ZlQ2hpbGQoaGFuZGxlci5fY2FjaGVbYXNzZXQuaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBoYW5kbGVyLl9jYWNoZVthc3NldC5pZF0gPSBleHRyYTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBfb3BlbmVkKHJlc291cmNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoZmlsZSB8fCBhc3NldC50eXBlID09PSAnY3ViZW1hcCcpIHtcbiAgICAgICAgICAgIC8vIHN0YXJ0IGxvYWRpbmcgdGhlIHJlc291cmNlXG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6c3RhcnQnLCBhc3NldCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ2xvYWQ6JyArIGFzc2V0LmlkICsgJzpzdGFydCcsIGFzc2V0KTtcblxuICAgICAgICAgICAgYXNzZXQubG9hZGluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl9sb2FkZXIubG9hZChhc3NldC5nZXRGaWxlVXJsKCksIGFzc2V0LnR5cGUsIF9sb2FkZWQsIGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFzc2V0IGhhcyBubyBmaWxlIHRvIGxvYWQsIG9wZW4gaXQgZGlyZWN0bHlcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlID0gdGhpcy5fbG9hZGVyLm9wZW4oYXNzZXQudHlwZSwgYXNzZXQuZGF0YSk7XG4gICAgICAgICAgICBhc3NldC5sb2FkZWQgPSB0cnVlO1xuICAgICAgICAgICAgX29wZW5lZChyZXNvdXJjZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVc2UgdGhpcyB0byBsb2FkIGFuZCBjcmVhdGUgYW4gYXNzZXQgaWYgeW91IGRvbid0IGhhdmUgYXNzZXRzIGNyZWF0ZWQuIFVzdWFsbHkgeW91IHdvdWxkXG4gICAgICogb25seSB1c2UgdGhpcyBpZiB5b3UgYXJlIG5vdCBpbnRlZ3JhdGVkIHdpdGggdGhlIFBsYXlDYW52YXMgRWRpdG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSB1cmwgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSAtIFRoZSB0eXBlIG9mIGFzc2V0IHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtMb2FkQXNzZXRDYWxsYmFja30gY2FsbGJhY2sgLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiBhc3NldCBpcyBsb2FkZWQsIHBhc3NlZCAoZXJyLFxuICAgICAqIGFzc2V0KSwgd2hlcmUgZXJyIGlzIG51bGwgaWYgbm8gZXJyb3JzIHdlcmUgZW5jb3VudGVyZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuYXNzZXRzLmxvYWRGcm9tVXJsKFwiLi4vcGF0aC90by90ZXh0dXJlLmpwZ1wiLCBcInRleHR1cmVcIiwgZnVuY3Rpb24gKGVyciwgYXNzZXQpIHtcbiAgICAgKiAgICAgY29uc3QgdGV4dHVyZSA9IGFzc2V0LnJlc291cmNlO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGxvYWRGcm9tVXJsKHVybCwgdHlwZSwgY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5sb2FkRnJvbVVybEFuZEZpbGVuYW1lKHVybCwgbnVsbCwgdHlwZSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVzZSB0aGlzIHRvIGxvYWQgYW5kIGNyZWF0ZSBhbiBhc3NldCB3aGVuIGJvdGggdGhlIFVSTCBhbmQgZmlsZW5hbWUgYXJlIHJlcXVpcmVkLiBGb3JcbiAgICAgKiBleGFtcGxlLCB1c2UgdGhpcyBmdW5jdGlvbiB3aGVuIGxvYWRpbmcgQkxPQiBhc3NldHMsIHdoZXJlIHRoZSBVUkwgZG9lcyBub3QgYWRlcXVhdGVseVxuICAgICAqIGlkZW50aWZ5IHRoZSBmaWxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSB1cmwgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZmlsZW5hbWUgLSBUaGUgZmlsZW5hbWUgb2YgdGhlIGFzc2V0IHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUaGUgdHlwZSBvZiBhc3NldCB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7TG9hZEFzc2V0Q2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gY2FsbGVkIHdoZW4gYXNzZXQgaXMgbG9hZGVkLCBwYXNzZWQgKGVycixcbiAgICAgKiBhc3NldCksIHdoZXJlIGVyciBpcyBudWxsIGlmIG5vIGVycm9ycyB3ZXJlIGVuY291bnRlcmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZmlsZSA9IG1hZ2ljYWxseUF0dGFpbkFGaWxlKCk7XG4gICAgICogYXBwLmFzc2V0cy5sb2FkRnJvbVVybEFuZEZpbGVuYW1lKFVSTC5jcmVhdGVPYmplY3RVUkwoZmlsZSksIFwidGV4dHVyZS5wbmdcIiwgXCJ0ZXh0dXJlXCIsIGZ1bmN0aW9uIChlcnIsIGFzc2V0KSB7XG4gICAgICogICAgIGNvbnN0IHRleHR1cmUgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBsb2FkRnJvbVVybEFuZEZpbGVuYW1lKHVybCwgZmlsZW5hbWUsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBwYXRoLmdldEJhc2VuYW1lKGZpbGVuYW1lIHx8IHVybCk7XG5cbiAgICAgICAgY29uc3QgZmlsZSA9IHtcbiAgICAgICAgICAgIGZpbGVuYW1lOiBmaWxlbmFtZSB8fCBuYW1lLFxuICAgICAgICAgICAgdXJsOiB1cmxcbiAgICAgICAgfTtcblxuICAgICAgICBsZXQgYXNzZXQgPSB0aGlzLmdldEJ5VXJsKHVybCk7XG4gICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgIGFzc2V0ID0gbmV3IEFzc2V0KG5hbWUsIHR5cGUsIGZpbGUpO1xuICAgICAgICAgICAgdGhpcy5hZGQoYXNzZXQpO1xuICAgICAgICB9IGVsc2UgaWYgKGFzc2V0LmxvYWRlZCkge1xuICAgICAgICAgICAgLy8gYXNzZXQgaXMgYWxyZWFkeSBsb2FkZWRcbiAgICAgICAgICAgIGNhbGxiYWNrKGFzc2V0LmxvYWRGcm9tVXJsRXJyb3IgfHwgbnVsbCwgYXNzZXQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3RhcnRMb2FkID0gKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICBhc3NldC5vbmNlKCdsb2FkJywgKGxvYWRlZEFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdtYXRlcmlhbCcpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZFRleHR1cmVzKGxvYWRlZEFzc2V0LCAoZXJyLCB0ZXh0dXJlcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBsb2FkZWRBc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGxvYWRlZEFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGFzc2V0Lm9uY2UoJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIC8vIHN0b3JlIHRoZSBlcnJvciBvbiB0aGUgYXNzZXQgaW4gY2FzZSB1c2VyIHJlcXVlc3RzIHRoaXMgYXNzZXQgYWdhaW5cbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubG9hZEZyb21VcmxFcnJvciA9IGVycjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyLCBhc3NldCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRoaXMubG9hZChhc3NldCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBhc3NldCk7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ21vZGVsJykge1xuICAgICAgICAgICAgdGhpcy5fbG9hZE1vZGVsKGFzc2V0LCBzdGFydExvYWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhcnRMb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHByaXZhdGUgbWV0aG9kIHVzZWQgZm9yIGVuZ2luZS1vbmx5IGxvYWRpbmcgb2YgbW9kZWwgZGF0YVxuICAgIF9sb2FkTW9kZWwobW9kZWxBc3NldCwgY29udGludWF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHVybCA9IG1vZGVsQXNzZXQuZ2V0RmlsZVVybCgpO1xuICAgICAgICBjb25zdCBleHQgPSBwYXRoLmdldEV4dGVuc2lvbih1cmwpO1xuXG4gICAgICAgIGlmIChleHQgPT09ICcuanNvbicgfHwgZXh0ID09PSAnLmdsYicpIHtcbiAgICAgICAgICAgIGNvbnN0IGRpciA9IHBhdGguZ2V0RGlyZWN0b3J5KHVybCk7XG4gICAgICAgICAgICBjb25zdCBiYXNlbmFtZSA9IHBhdGguZ2V0QmFzZW5hbWUodXJsKTtcblxuICAgICAgICAgICAgLy8gUGxheUNhbnZhcyBtb2RlbCBmb3JtYXQgc3VwcG9ydHMgbWF0ZXJpYWwgbWFwcGluZyBmaWxlXG4gICAgICAgICAgICBjb25zdCBtYXBwaW5nVXJsID0gcGF0aC5qb2luKGRpciwgYmFzZW5hbWUucmVwbGFjZShleHQsICcubWFwcGluZy5qc29uJykpO1xuICAgICAgICAgICAgdGhpcy5fbG9hZGVyLmxvYWQobWFwcGluZ1VybCwgJ2pzb24nLCAoZXJyLCBkYXRhKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBtb2RlbEFzc2V0LmRhdGEgPSB7IG1hcHBpbmc6IFtdIH07XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVhdGlvbihtb2RlbEFzc2V0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkTWF0ZXJpYWxzKG1vZGVsQXNzZXQsIGRhdGEsIChlLCBtYXRlcmlhbHMpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsQXNzZXQuZGF0YSA9IGRhdGE7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51YXRpb24obW9kZWxBc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gb3RoZXIgbW9kZWwgZm9ybWF0IChlLmcuIG9iailcbiAgICAgICAgICAgIGNvbnRpbnVhdGlvbihtb2RlbEFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHByaXZhdGUgbWV0aG9kIHVzZWQgZm9yIGVuZ2luZS1vbmx5IGxvYWRpbmcgb2YgbW9kZWwgbWF0ZXJpYWxzXG4gICAgX2xvYWRNYXRlcmlhbHMobW9kZWxBc3NldCwgbWFwcGluZywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWxzID0gW107XG4gICAgICAgIGxldCBjb3VudCA9IDA7XG5cbiAgICAgICAgY29uc3Qgb25NYXRlcmlhbExvYWRlZCA9IChlcnIsIG1hdGVyaWFsQXNzZXQpID0+IHtcbiAgICAgICAgICAgIC8vIGxvYWQgZGVwZW5kZW50IHRleHR1cmVzXG4gICAgICAgICAgICB0aGlzLl9sb2FkVGV4dHVyZXMobWF0ZXJpYWxBc3NldCwgKGVyciwgdGV4dHVyZXMpID0+IHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaChtYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAobWF0ZXJpYWxzLmxlbmd0aCA9PT0gY291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgbWF0ZXJpYWxzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1hcHBpbmcubWFwcGluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IG1hcHBpbmcubWFwcGluZ1tpXS5wYXRoO1xuICAgICAgICAgICAgaWYgKHBhdGgpIHtcbiAgICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IG1vZGVsQXNzZXQuZ2V0QWJzb2x1dGVVcmwocGF0aCk7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkRnJvbVVybCh1cmwsICdtYXRlcmlhbCcsIG9uTWF0ZXJpYWxMb2FkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCBtYXRlcmlhbHMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcHJpdmF0ZSBtZXRob2QgdXNlZCBmb3IgZW5naW5lLW9ubHkgbG9hZGluZyBvZiB0aGUgdGV4dHVyZXMgcmVmZXJlbmNlZCBieVxuICAgIC8vIHRoZSBtYXRlcmlhbCBhc3NldFxuICAgIF9sb2FkVGV4dHVyZXMobWF0ZXJpYWxBc3NldCwgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgdGV4dHVyZXMgPSBbXTtcbiAgICAgICAgbGV0IGNvdW50ID0gMDtcblxuICAgICAgICBjb25zdCBkYXRhID0gbWF0ZXJpYWxBc3NldC5kYXRhO1xuICAgICAgICBpZiAoZGF0YS5tYXBwaW5nRm9ybWF0ICE9PSAncGF0aCcpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYFNraXBwaW5nOiAke21hdGVyaWFsQXNzZXQubmFtZX0sIG1hdGVyaWFsIGZpbGVzIG11c3QgYmUgbWFwcGluZ0Zvcm1hdDogXCJwYXRoXCIgdG8gYmUgbG9hZGVkIGZyb20gVVJMYCk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlcyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvblRleHR1cmVMb2FkZWQgPSAoZXJyLCB0ZXh0dXJlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICB0ZXh0dXJlcy5wdXNoKHRleHR1cmUpO1xuICAgICAgICAgICAgaWYgKHRleHR1cmVzLmxlbmd0aCA9PT0gY291bnQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgdGV4UGFyYW1zID0gc3RhbmRhcmRNYXRlcmlhbFRleHR1cmVQYXJhbWV0ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleFBhcmFtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGRhdGFbdGV4UGFyYW1zW2ldXTtcbiAgICAgICAgICAgIGlmIChwYXRoICYmIHR5cGVvZiBwYXRoID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICAgICAgY29uc3QgdXJsID0gbWF0ZXJpYWxBc3NldC5nZXRBYnNvbHV0ZVVybChwYXRoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRGcm9tVXJsKHVybCwgJ3RleHR1cmUnLCBvblRleHR1cmVMb2FkZWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsLCB0ZXh0dXJlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYWxsIEFzc2V0cyB3aXRoIHRoZSBzcGVjaWZpZWQgbmFtZSBhbmQgdHlwZSBmb3VuZCBpbiB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBBc3NldHMgdG8gZmluZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3R5cGVdIC0gVGhlIHR5cGUgb2YgdGhlIEFzc2V0cyB0byBmaW5kLlxuICAgICAqIEByZXR1cm5zIHtBc3NldFtdfSBBIGxpc3Qgb2YgYWxsIEFzc2V0cyBmb3VuZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZEFsbChcIm15VGV4dHVyZUFzc2V0XCIsIFwidGV4dHVyZVwiKTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIkZvdW5kIFwiICsgYXNzZXRzLmxlbmd0aCArIFwiIGFzc2V0cyBjYWxsZWQgXCIgKyBuYW1lKTtcbiAgICAgKi9cbiAgICBmaW5kQWxsKG5hbWUsIHR5cGUpIHtcbiAgICAgICAgY29uc3QgaWR4cyA9IHRoaXMuX25hbWVzW25hbWVdO1xuICAgICAgICBpZiAoaWR4cykge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gaWR4cy5tYXAoKGlkeCkgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9hc3NldHNbaWR4XTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAodHlwZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhc3NldHMuZmlsdGVyKChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKGFzc2V0LnR5cGUgPT09IHR5cGUpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYXNzZXRzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIF9vblRhZ0FkZCh0YWcsIGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3RhZ3MuYWRkKHRhZywgYXNzZXQpO1xuICAgIH1cblxuICAgIF9vblRhZ1JlbW92ZSh0YWcsIGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX3RhZ3MucmVtb3ZlKHRhZywgYXNzZXQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhbGwgQXNzZXRzIHRoYXQgc2F0aXNmeSB0aGUgc2VhcmNoIHF1ZXJ5LiBRdWVyeSBjYW4gYmUgc2ltcGx5IGEgc3RyaW5nLCBvciBjb21tYVxuICAgICAqIHNlcGFyYXRlZCBzdHJpbmdzLCB0byBoYXZlIGluY2x1c2l2ZSByZXN1bHRzIG9mIGFzc2V0cyB0aGF0IG1hdGNoIGF0IGxlYXN0IG9uZSBxdWVyeS4gQVxuICAgICAqIHF1ZXJ5IHRoYXQgY29uc2lzdHMgb2YgYW4gYXJyYXkgb2YgdGFncyBjYW4gYmUgdXNlZCB0byBtYXRjaCBhc3NldHMgdGhhdCBoYXZlIGVhY2ggdGFnIG9mXG4gICAgICogYXJyYXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gey4uLip9IHF1ZXJ5IC0gTmFtZSBvZiBhIHRhZyBvciBhcnJheSBvZiB0YWdzLlxuICAgICAqIEByZXR1cm5zIHtBc3NldFtdfSBBIGxpc3Qgb2YgYWxsIEFzc2V0cyBtYXRjaGVkIHF1ZXJ5LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYXNzZXRzID0gYXBwLmFzc2V0cy5maW5kQnlUYWcoXCJsZXZlbC0xXCIpO1xuICAgICAqIC8vIHJldHVybnMgYWxsIGFzc2V0cyB0aGF0IHRhZ2dlZCBieSBgbGV2ZWwtMWBcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZEJ5VGFnKFwibGV2ZWwtMVwiLCBcImxldmVsLTJcIik7XG4gICAgICogLy8gcmV0dXJucyBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IGBsZXZlbC0xYCBPUiBgbGV2ZWwtMmBcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZEJ5VGFnKFtcImxldmVsLTFcIiwgXCJtb25zdGVyXCJdKTtcbiAgICAgKiAvLyByZXR1cm5zIGFsbCBhc3NldHMgdGhhdCB0YWdnZWQgYnkgYGxldmVsLTFgIEFORCBgbW9uc3RlcmBcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZEJ5VGFnKFtcImxldmVsLTFcIiwgXCJtb25zdGVyXCJdLCBbXCJsZXZlbC0yXCIsIFwibW9uc3RlclwiXSk7XG4gICAgICogLy8gcmV0dXJucyBhbGwgYXNzZXRzIHRoYXQgdGFnZ2VkIGJ5IChgbGV2ZWwtMWAgQU5EIGBtb25zdGVyYCkgT1IgKGBsZXZlbC0yYCBBTkQgYG1vbnN0ZXJgKVxuICAgICAqL1xuICAgIGZpbmRCeVRhZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RhZ3MuZmluZChhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhbGwgQXNzZXRzIHRoYXQgc2F0aXNmeSBhIGZpbHRlciBjYWxsYmFjay5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RmlsdGVyQXNzZXRDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBpcyB1c2VkIHRvIGZpbHRlciBhc3NldHMuXG4gICAgICogUmV0dXJuIGB0cnVlYCB0byBpbmNsdWRlIGFuIGFzc2V0IGluIHRoZSByZXR1cm5lZCBhcnJheS5cbiAgICAgKiBAcmV0dXJucyB7QXNzZXRbXX0gQSBsaXN0IG9mIGFsbCBBc3NldHMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhc3NldHMgPSBhcHAuYXNzZXRzLmZpbHRlcihmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgICAgcmV0dXJuIGFzc2V0Lm5hbWUuaW5kZXhPZignbW9uc3RlcicpICE9PSAtMTtcbiAgICAgKiB9KTtcbiAgICAgKiBjb25zb2xlLmxvZyhcIkZvdW5kIFwiICsgYXNzZXRzLmxlbmd0aCArIFwiIGFzc2V0cywgd2hlcmUgbmFtZXMgY29udGFpbnMgJ21vbnN0ZXInXCIpO1xuICAgICAqL1xuICAgIGZpbHRlcihjYWxsYmFjaykge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXRzLmZpbHRlcihhc3NldCA9PiBjYWxsYmFjayhhc3NldCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgZmlyc3QgQXNzZXQgd2l0aCB0aGUgc3BlY2lmaWVkIG5hbWUgYW5kIHR5cGUgZm91bmQgaW4gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgQXNzZXQgdG8gZmluZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3R5cGVdIC0gVGhlIHR5cGUgb2YgdGhlIEFzc2V0IHRvIGZpbmQuXG4gICAgICogQHJldHVybnMge0Fzc2V0fG51bGx9IEEgc2luZ2xlIEFzc2V0IG9yIG51bGwgaWYgbm8gQXNzZXQgaXMgZm91bmQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhc3NldCA9IGFwcC5hc3NldHMuZmluZChcIm15VGV4dHVyZUFzc2V0XCIsIFwidGV4dHVyZVwiKTtcbiAgICAgKi9cbiAgICBmaW5kKG5hbWUsIHR5cGUpIHtcbiAgICAgICAgLy8gZmluZEFsbCByZXR1cm5zIGFuIGVtcHR5IGFycmF5IHRoZSBpZiB0aGUgYXNzZXQgY2Fubm90IGJlIGZvdW5kIHNvIGBhc3NldGAgaXNcbiAgICAgICAgLy8gbmV2ZXIgbnVsbC91bmRlZmluZWRcbiAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLmZpbmRBbGwobmFtZSwgdHlwZSk7XG4gICAgICAgIHJldHVybiBhc3NldC5sZW5ndGggPiAwID8gYXNzZXRbMF0gOiBudWxsO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgQXNzZXRSZWdpc3RyeSB9O1xuIl0sIm5hbWVzIjpbIkFzc2V0UmVnaXN0cnkiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImxvYWRlciIsIl9sb2FkZXIiLCJfYXNzZXRzIiwiX2NhY2hlIiwiX25hbWVzIiwiX3RhZ3MiLCJUYWdzQ2FjaGUiLCJfdXJscyIsInByZWZpeCIsImxpc3QiLCJmaWx0ZXJzIiwiZmlsdGVyIiwiYXNzZXQiLCJpbmNsdWRlIiwicHJlbG9hZCIsInVuZGVmaW5lZCIsImFkZCIsImluZGV4IiwicHVzaCIsInVybCIsImlkIiwibmFtZSIsImZpbGUiLCJyZWdpc3RyeSIsImFkZEl0ZW0iLCJ0YWdzIiwib24iLCJfb25UYWdBZGQiLCJfb25UYWdSZW1vdmUiLCJmaXJlIiwibG9hZCIsInJlbW92ZSIsImlkeCIsInNwbGljZSIsImkiLCJsIiwibGVuZ3RoIiwiYSIsInJlbW92ZUl0ZW0iLCJvZmYiLCJnZXQiLCJnZXRCeVVybCIsImxvYWRpbmciLCJsb2FkZWQiLCJfb3BlbmVkIiwicmVzb3VyY2UiLCJBcnJheSIsInJlc291cmNlcyIsInBhdGNoIiwiX2xvYWRlZCIsImVyciIsImV4dHJhIiwic2NyaXB0IiwibGVnYWN5IiwidHlwZSIsImhhbmRsZXIiLCJnZXRIYW5kbGVyIiwicGFyZW50Tm9kZSIsImRvY3VtZW50IiwiaGVhZCIsInJlbW92ZUNoaWxkIiwiZ2V0RmlsZVVybCIsIm9wZW4iLCJkYXRhIiwibG9hZEZyb21VcmwiLCJjYWxsYmFjayIsImxvYWRGcm9tVXJsQW5kRmlsZW5hbWUiLCJmaWxlbmFtZSIsInBhdGgiLCJnZXRCYXNlbmFtZSIsIkFzc2V0IiwibG9hZEZyb21VcmxFcnJvciIsInN0YXJ0TG9hZCIsIm9uY2UiLCJsb2FkZWRBc3NldCIsIl9sb2FkVGV4dHVyZXMiLCJ0ZXh0dXJlcyIsIl9sb2FkTW9kZWwiLCJtb2RlbEFzc2V0IiwiY29udGludWF0aW9uIiwiZXh0IiwiZ2V0RXh0ZW5zaW9uIiwiZGlyIiwiZ2V0RGlyZWN0b3J5IiwiYmFzZW5hbWUiLCJtYXBwaW5nVXJsIiwiam9pbiIsInJlcGxhY2UiLCJtYXBwaW5nIiwiX2xvYWRNYXRlcmlhbHMiLCJlIiwibWF0ZXJpYWxzIiwiY291bnQiLCJvbk1hdGVyaWFsTG9hZGVkIiwibWF0ZXJpYWxBc3NldCIsImdldEFic29sdXRlVXJsIiwibWFwcGluZ0Zvcm1hdCIsIkRlYnVnIiwid2FybiIsIm9uVGV4dHVyZUxvYWRlZCIsInRleHR1cmUiLCJjb25zb2xlIiwiZXJyb3IiLCJ0ZXhQYXJhbXMiLCJzdGFuZGFyZE1hdGVyaWFsVGV4dHVyZVBhcmFtZXRlcnMiLCJmaW5kQWxsIiwiaWR4cyIsImFzc2V0cyIsIm1hcCIsInRhZyIsImZpbmRCeVRhZyIsImZpbmQiLCJhcmd1bWVudHMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBV0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxhQUFhLFNBQVNDLFlBQVksQ0FBQztBQUNyQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFO0FBQ2hCLElBQUEsS0FBSyxFQUFFLENBQUE7SUFFUCxJQUFJLENBQUNDLE9BQU8sR0FBR0QsTUFBTSxDQUFBO0FBRXJCLElBQUEsSUFBSSxDQUFDRSxPQUFPLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLElBQUEsSUFBSSxDQUFDQyxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ2pCLElBQUEsSUFBSSxDQUFDQyxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ2pCLElBQUksQ0FBQ0MsS0FBSyxHQUFHLElBQUlDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNsQyxJQUFBLElBQUksQ0FBQ0MsS0FBSyxHQUFHLEVBQUUsQ0FBQzs7QUFFaEI7QUFDUjtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsTUFBTSxHQUFHLElBQUksQ0FBQTtBQUN0QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVJO0FBQ0o7QUFD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
