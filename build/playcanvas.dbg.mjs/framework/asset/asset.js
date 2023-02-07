/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../core/path.js';
import { Tags } from '../../core/tags.js';
import { EventHandler } from '../../core/event-handler.js';
import { findAvailableLocale } from '../i18n/utils.js';
import { ABSOLUTE_URL } from './constants.js';
import { AssetFile } from './asset-file.js';
import { getApplication } from '../globals.js';
import { http } from '../../platform/net/http.js';

// auto incrementing number for asset ids
let assetIdCounter = -1;
const VARIANT_SUPPORT = {
  pvr: 'extCompressedTexturePVRTC',
  dxt: 'extCompressedTextureS3TC',
  etc2: 'extCompressedTextureETC',
  etc1: 'extCompressedTextureETC1',
  basis: 'canvas' // dummy, basis is always supported
};

const VARIANT_DEFAULT_PRIORITY = ['pvr', 'dxt', 'etc2', 'etc1', 'basis'];

/**
 * Callback used by {@link Asset#ready} and called when an asset is ready.
 *
 * @callback AssetReadyCallback
 * @param {Asset} asset - The ready asset.
 */

/**
 * An asset record of a file or data resource that can be loaded by the engine. The asset contains
 * four important fields:
 *
 * - `file`: contains the details of a file (filename, url) which contains the resource data, e.g.
 * an image file for a texture asset.
 * - `data`: contains a JSON blob which contains either the resource data for the asset (e.g.
 * material data) or additional data for the file (e.g. material mappings for a model).
 * - `options`: contains a JSON blob with handler-specific load options.
 * - `resource`: contains the final resource when it is loaded. (e.g. a {@link StandardMaterial} or
 * a {@link Texture}).
 *
 * See the {@link AssetRegistry} for details on loading resources from assets.
 *
 * @augments EventHandler
 */
class Asset extends EventHandler {
  /**
   * Create a new Asset record. Generally, Assets are created in the loading process and you
   * won't need to create them by hand.
   *
   * @param {string} name - A non-unique but human-readable name which can be later used to
   * retrieve the asset.
   * @param {string} type - Type of asset. One of ["animation", "audio", "binary", "container",
   * "cubemap", "css", "font", "json", "html", "material", "model", "script", "shader", "sprite",
   * "template", text", "texture", "textureatlas"]
   * @param {object} [file] - Details about the file the asset is made from. At the least must
   * contain the 'url' field. For assets that don't contain file data use null.
   * @param {string} [file.url] - The URL of the resource file that contains the asset data.
   * @param {string} [file.filename] - The filename of the resource file or null if no filename
   * was set (e.g from using {@link AssetRegistry#loadFromUrl}).
   * @param {number} [file.size] - The size of the resource file or null if no size was set
   * (e.g. from using {@link AssetRegistry#loadFromUrl}).
   * @param {string} [file.hash] - The MD5 hash of the resource file data and the Asset data
   * field or null if hash was set (e.g from using {@link AssetRegistry#loadFromUrl}).
   * @param {ArrayBuffer} [file.contents] - Optional file contents. This is faster than wrapping
   * the data in a (base64 encoded) blob. Currently only used by container assets.
   * @param {object|string} [data] - JSON object or string with additional data about the asset.
   * (e.g. for texture and model assets) or contains the asset data itself (e.g. in the case of
   * materials).
   * @param {object} [options] - The asset handler options. For container options see
   * {@link ContainerHandler}.
   * @param {'anonymous'|'use-credentials'|null} [options.crossOrigin] - For use with texture assets
   * that are loaded using the browser. This setting overrides the default crossOrigin specifier.
   * For more details on crossOrigin and its use, see
   * https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin.
   * @example
   * var asset = new pc.Asset("a texture", "texture", {
   *     url: "http://example.com/my/assets/here/texture.png"
   * });
   */
  constructor(name, type, file, data, options) {
    super();
    this._id = assetIdCounter--;

    /**
     * The name of the asset.
     *
     * @type {string}
     */
    this.name = name || '';

    /**
     * The type of the asset. One of ["animation", "audio", "binary", "container", "cubemap",
     * "css", "font", "json", "html", "material", "model", "render", "script", "shader", "sprite",
     * "template", "text", "texture", "textureatlas"]
     *
     * @type {("animation"|"audio"|"binary"|"container"|"cubemap"|"css"|"font"|"json"|"html"|"material"|"model"|"render"|"script"|"shader"|"sprite"|"template"|"text"|"texture"|"textureatlas")}
     */
    this.type = type;

    /**
     * Asset tags. Enables finding of assets by tags using the {@link AssetRegistry#findByTag} method.
     *
     * @type {Tags}
     */
    this.tags = new Tags(this);
    this._preload = false;
    this._file = null;
    this._data = data || {};

    /**
     * Optional JSON data that contains the asset handler options.
     *
     * @type {object}
     */
    this.options = options || {};

    // This is where the loaded resource(s) will be
    this._resources = [];

    // a string-assetId dictionary that maps
    // locale to asset id
    this._i18n = {};

    /**
     * True if the asset has finished attempting to load the resource. It is not guaranteed
     * that the resources are available as there could have been a network error.
     *
     * @type {boolean}
     */
    this.loaded = false;

    /**
     * True if the resource is currently being loaded.
     *
     * @type {boolean}
     */
    this.loading = false;

    /**
     * The asset registry that this Asset belongs to.
     *
     * @type {import('./asset-registry.js').AssetRegistry}
     */
    this.registry = null;
    if (file) this.file = file;
  }

  /**
   * Fired when the asset has completed loading.
   *
   * @event Asset#load
   * @param {Asset} asset - The asset that was loaded.
   */

  /**
   * Fired just before the asset unloads the resource. This allows for the opportunity to prepare
   * for an asset that will be unloaded. E.g. Changing the texture of a model to a default before
   * the one it was using is unloaded.
   *
   * @event Asset#unload
   * @param {Asset} asset - The asset that is due to be unloaded.
   */

  /**
   * Fired when the asset is removed from the asset registry.
   *
   * @event Asset#remove
   * @param {Asset} asset - The asset that was removed.
   */

  /**
   * Fired if the asset encounters an error while loading.
   *
   * @event Asset#error
   * @param {string} err - The error message.
   * @param {Asset} asset - The asset that generated the error.
   */

  /**
   * Fired when one of the asset properties `file`, `data`, `resource` or `resources` is changed.
   *
   * @event Asset#change
   * @param {Asset} asset - The asset that was loaded.
   * @param {string} property - The name of the property that changed.
   * @param {*} value - The new property value.
   * @param {*} oldValue - The old property value.
   */

  /**
   * Fired when we add a new localized asset id to the asset.
   *
   * @event Asset#add:localized
   * @param {string} locale - The locale.
   * @param {number} assetId - The asset id we added.
   */

  /**
   * Fired when we remove a localized asset id from the asset.
   *
   * @event Asset#remove:localized
   * @param {string} locale - The locale.
   * @param {number} assetId - The asset id we removed.
   */

  /**
   * The asset id.
   *
   * @type {number}
   */
  set id(value) {
    this._id = value;
  }
  get id() {
    return this._id;
  }

  /**
   * The file details or null if no file.
   *
   * @type {object}
   */
  set file(value) {
    // if value contains variants, choose the correct variant first
    if (value && value.variants && ['texture', 'textureatlas', 'bundle'].indexOf(this.type) !== -1) {
      var _this$registry, _this$registry$_loade;
      // search for active variant
      const app = ((_this$registry = this.registry) == null ? void 0 : (_this$registry$_loade = _this$registry._loader) == null ? void 0 : _this$registry$_loade._app) || getApplication();
      const device = app == null ? void 0 : app.graphicsDevice;
      if (device) {
        for (let i = 0, len = VARIANT_DEFAULT_PRIORITY.length; i < len; i++) {
          const variant = VARIANT_DEFAULT_PRIORITY[i];
          // if the device supports the variant
          if (value.variants[variant] && device[VARIANT_SUPPORT[variant]]) {
            value = value.variants[variant];
            break;
          }

          // if the variant does not exist but the asset is in a bundle
          // and the bundle contain assets with this variant then return the default
          // file for the asset
          if (app.enableBundles) {
            const bundles = app.bundles.listBundlesForAsset(this);
            if (bundles && bundles.find(b => {
              var _b$file;
              return b == null ? void 0 : (_b$file = b.file) == null ? void 0 : _b$file.variants[variant];
            })) {
              break;
            }
          }
        }
      }
    }
    const oldFile = this._file;
    const newFile = value ? new AssetFile(value.url, value.filename, value.hash, value.size, value.opt, value.contents) : null;
    if (!!newFile !== !!oldFile || newFile && !newFile.equals(oldFile)) {
      this._file = newFile;
      this.fire('change', this, 'file', newFile, oldFile);
      this.reload();
    }
  }
  get file() {
    return this._file;
  }

  /**
   * Optional JSON data that contains either the complete resource data. (e.g. in the case of a
   * material) or additional data (e.g. in the case of a model it contains mappings from mesh to
   * material).
   *
   * @type {object}
   */
  set data(value) {
    // fire change event when data changes
    // because the asset might need reloading if that happens
    const old = this._data;
    this._data = value;
    if (value !== old) {
      this.fire('change', this, 'data', value, old);
      if (this.loaded) this.registry._loader.patch(this, this.registry);
    }
  }
  get data() {
    return this._data;
  }

  /**
   * A reference to the resource when the asset is loaded. e.g. a {@link Texture} or a {@link Model}.
   *
   * @type {object}
   */
  set resource(value) {
    const _old = this._resources[0];
    this._resources[0] = value;
    this.fire('change', this, 'resource', value, _old);
  }
  get resource() {
    return this._resources[0];
  }

  /**
   * A reference to the resources of the asset when it's loaded. An asset can hold more runtime
   * resources than one e.g. cubemaps.
   *
   * @type {object[]}
   */
  set resources(value) {
    const _old = this._resources;
    this._resources = value;
    this.fire('change', this, 'resources', value, _old);
  }
  get resources() {
    return this._resources;
  }

  /**
   * If true the asset will be loaded during the preload phase of application set up.
   *
   * @type {boolean}
   */
  set preload(value) {
    value = !!value;
    if (this._preload === value) return;
    this._preload = value;
    if (this._preload && !this.loaded && !this.loading && this.registry) this.registry.load(this);
  }
  get preload() {
    return this._preload;
  }
  set loadFaces(value) {
    value = !!value;
    if (!this.hasOwnProperty('_loadFaces') || value !== this._loadFaces) {
      this._loadFaces = value;

      // the loadFaces property should be part of the asset data block
      // because changing the flag should result in asset patch being invoked.
      // here we must invoke it manually instead.
      if (this.loaded) this.registry._loader.patch(this, this.registry);
    }
  }
  get loadFaces() {
    return this._loadFaces;
  }

  /**
   * Return the URL required to fetch the file for this asset.
   *
   * @returns {string|null} The URL. Returns null if the asset has no associated file.
   * @example
   * var assets = app.assets.find("My Image", "texture");
   * var img = "&lt;img src='" + assets[0].getFileUrl() + "'&gt;";
   */
  getFileUrl() {
    const file = this.file;
    if (!file || !file.url) return null;
    let url = file.url;
    if (this.registry && this.registry.prefix && !ABSOLUTE_URL.test(url)) url = this.registry.prefix + url;

    // add file hash to avoid hard-caching problems
    if (this.type !== 'script' && file.hash) {
      const separator = url.indexOf('?') !== -1 ? '&' : '?';
      url += separator + 't=' + file.hash;
    }
    return url;
  }

  /**
   * Construct an asset URL from this asset's location and a relative path. If the relativePath
   * is a blob or Base64 URI, then return that instead.
   *
   * @param {string} relativePath - The relative path to be concatenated to this asset's base url.
   * @returns {string} Resulting URL of the asset.
   * @ignore
   */
  getAbsoluteUrl(relativePath) {
    if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
      return relativePath;
    }
    const base = path.getDirectory(this.file.url);
    return path.join(base, relativePath);
  }

  /**
   * Returns the asset id of the asset that corresponds to the specified locale.
   *
   * @param {string} locale - The desired locale e.g. Ar-AR.
   * @returns {number} An asset id or null if there is no asset specified for the desired locale.
   * @ignore
   */
  getLocalizedAssetId(locale) {
    // tries to find either the desired locale or a fallback locale
    locale = findAvailableLocale(locale, this._i18n);
    return this._i18n[locale] || null;
  }

  /**
   * Adds a replacement asset id for the specified locale. When the locale in
   * {@link Application#i18n} changes then references to this asset will be replaced with the
   * specified asset id. (Currently only supported by the {@link ElementComponent}).
   *
   * @param {string} locale - The locale e.g. Ar-AR.
   * @param {number} assetId - The asset id.
   * @ignore
   */
  addLocalizedAssetId(locale, assetId) {
    this._i18n[locale] = assetId;
    this.fire('add:localized', locale, assetId);
  }

  /**
   * Removes a localized asset.
   *
   * @param {string} locale - The locale e.g. Ar-AR.
   * @ignore
   */
  removeLocalizedAssetId(locale) {
    const assetId = this._i18n[locale];
    if (assetId) {
      delete this._i18n[locale];
      this.fire('remove:localized', locale, assetId);
    }
  }

  /**
   * Take a callback which is called as soon as the asset is loaded. If the asset is already
   * loaded the callback is called straight away.
   *
   * @param {AssetReadyCallback} callback - The function called when the asset is ready. Passed
   * the (asset) arguments.
   * @param {object} [scope] - Scope object to use when calling the callback.
   * @example
   * var asset = app.assets.find("My Asset");
   * asset.ready(function (asset) {
   *   // asset loaded
   * });
   * app.assets.load(asset);
   */
  ready(callback, scope) {
    scope = scope || this;
    if (this.loaded) {
      callback.call(scope, this);
    } else {
      this.once('load', function (asset) {
        callback.call(scope, asset);
      });
    }
  }
  reload() {
    // no need to be reloaded
    if (this.loaded) {
      this.loaded = false;
      this.registry.load(this);
    }
  }

  /**
   * Destroys the associated resource and marks asset as unloaded.
   *
   * @example
   * var asset = app.assets.find("My Asset");
   * asset.unload();
   * // asset.resource is null
   */
  unload() {
    if (!this.loaded && this._resources.length === 0) return;
    this.fire('unload', this);
    this.registry.fire('unload:' + this.id, this);
    const old = this._resources;

    // clear resources on the asset
    this.resources = [];
    this.loaded = false;

    // remove resource from loader cache
    if (this.file) {
      this.registry._loader.clearCache(this.getFileUrl(), this.type);
    }

    // destroy resources
    for (let i = 0; i < old.length; ++i) {
      const resource = old[i];
      if (resource && resource.destroy) {
        resource.destroy();
      }
    }
  }

  /**
   * Helper function to resolve asset file data and return the contents as an ArrayBuffer. If the
   * asset file contents are present, that is returned. Otherwise the file data is be downloaded
   * via http.
   *
   * @param {string} loadUrl - The URL as passed into the handler
   * @param {import('../handlers/loader.js').ResourceLoaderCallback} callback - The callback
   * function to receive results.
   * @param {Asset} [asset] - The asset
   * @param {number} maxRetries - Number of retries if http download is required
   * @ignore
   */
  static fetchArrayBuffer(loadUrl, callback, asset, maxRetries = 0) {
    var _asset$file;
    if (asset != null && (_asset$file = asset.file) != null && _asset$file.contents) {
      // asset file contents were provided
      setTimeout(() => {
        callback(null, asset.file.contents);
      });
    } else {
      // asset contents must be downloaded
      http.get(loadUrl, {
        cache: true,
        responseType: 'arraybuffer',
        retry: maxRetries > 0,
        maxRetries: maxRetries
      }, callback);
    }
  }
}

export { Asset };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXNzZXQvYXNzZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBUYWdzIH0gZnJvbSAnLi4vLi4vY29yZS90YWdzLmpzJztcblxuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgZmluZEF2YWlsYWJsZUxvY2FsZSB9IGZyb20gJy4uL2kxOG4vdXRpbHMuanMnO1xuXG5pbXBvcnQgeyBBQlNPTFVURV9VUkwgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBBc3NldEZpbGUgfSBmcm9tICcuL2Fzc2V0LWZpbGUuanMnO1xuaW1wb3J0IHsgZ2V0QXBwbGljYXRpb24gfSBmcm9tICcuLi9nbG9iYWxzLmpzJztcbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9uZXQvaHR0cC5qcyc7XG5cbi8vIGF1dG8gaW5jcmVtZW50aW5nIG51bWJlciBmb3IgYXNzZXQgaWRzXG5sZXQgYXNzZXRJZENvdW50ZXIgPSAtMTtcblxuY29uc3QgVkFSSUFOVF9TVVBQT1JUID0ge1xuICAgIHB2cjogJ2V4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMnLFxuICAgIGR4dDogJ2V4dENvbXByZXNzZWRUZXh0dXJlUzNUQycsXG4gICAgZXRjMjogJ2V4dENvbXByZXNzZWRUZXh0dXJlRVRDJyxcbiAgICBldGMxOiAnZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxJyxcbiAgICBiYXNpczogJ2NhbnZhcycgLy8gZHVtbXksIGJhc2lzIGlzIGFsd2F5cyBzdXBwb3J0ZWRcbn07XG5cbmNvbnN0IFZBUklBTlRfREVGQVVMVF9QUklPUklUWSA9IFsncHZyJywgJ2R4dCcsICdldGMyJywgJ2V0YzEnLCAnYmFzaXMnXTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBc3NldCNyZWFkeX0gYW5kIGNhbGxlZCB3aGVuIGFuIGFzc2V0IGlzIHJlYWR5LlxuICpcbiAqIEBjYWxsYmFjayBBc3NldFJlYWR5Q2FsbGJhY2tcbiAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIHJlYWR5IGFzc2V0LlxuICovXG5cbi8qKlxuICogQW4gYXNzZXQgcmVjb3JkIG9mIGEgZmlsZSBvciBkYXRhIHJlc291cmNlIHRoYXQgY2FuIGJlIGxvYWRlZCBieSB0aGUgZW5naW5lLiBUaGUgYXNzZXQgY29udGFpbnNcbiAqIGZvdXIgaW1wb3J0YW50IGZpZWxkczpcbiAqXG4gKiAtIGBmaWxlYDogY29udGFpbnMgdGhlIGRldGFpbHMgb2YgYSBmaWxlIChmaWxlbmFtZSwgdXJsKSB3aGljaCBjb250YWlucyB0aGUgcmVzb3VyY2UgZGF0YSwgZS5nLlxuICogYW4gaW1hZ2UgZmlsZSBmb3IgYSB0ZXh0dXJlIGFzc2V0LlxuICogLSBgZGF0YWA6IGNvbnRhaW5zIGEgSlNPTiBibG9iIHdoaWNoIGNvbnRhaW5zIGVpdGhlciB0aGUgcmVzb3VyY2UgZGF0YSBmb3IgdGhlIGFzc2V0IChlLmcuXG4gKiBtYXRlcmlhbCBkYXRhKSBvciBhZGRpdGlvbmFsIGRhdGEgZm9yIHRoZSBmaWxlIChlLmcuIG1hdGVyaWFsIG1hcHBpbmdzIGZvciBhIG1vZGVsKS5cbiAqIC0gYG9wdGlvbnNgOiBjb250YWlucyBhIEpTT04gYmxvYiB3aXRoIGhhbmRsZXItc3BlY2lmaWMgbG9hZCBvcHRpb25zLlxuICogLSBgcmVzb3VyY2VgOiBjb250YWlucyB0aGUgZmluYWwgcmVzb3VyY2Ugd2hlbiBpdCBpcyBsb2FkZWQuIChlLmcuIGEge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWx9IG9yXG4gKiBhIHtAbGluayBUZXh0dXJlfSkuXG4gKlxuICogU2VlIHRoZSB7QGxpbmsgQXNzZXRSZWdpc3RyeX0gZm9yIGRldGFpbHMgb24gbG9hZGluZyByZXNvdXJjZXMgZnJvbSBhc3NldHMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBBc3NldCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEFzc2V0IHJlY29yZC4gR2VuZXJhbGx5LCBBc3NldHMgYXJlIGNyZWF0ZWQgaW4gdGhlIGxvYWRpbmcgcHJvY2VzcyBhbmQgeW91XG4gICAgICogd29uJ3QgbmVlZCB0byBjcmVhdGUgdGhlbSBieSBoYW5kLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBBIG5vbi11bmlxdWUgYnV0IGh1bWFuLXJlYWRhYmxlIG5hbWUgd2hpY2ggY2FuIGJlIGxhdGVyIHVzZWQgdG9cbiAgICAgKiByZXRyaWV2ZSB0aGUgYXNzZXQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUeXBlIG9mIGFzc2V0LiBPbmUgb2YgW1wiYW5pbWF0aW9uXCIsIFwiYXVkaW9cIiwgXCJiaW5hcnlcIiwgXCJjb250YWluZXJcIixcbiAgICAgKiBcImN1YmVtYXBcIiwgXCJjc3NcIiwgXCJmb250XCIsIFwianNvblwiLCBcImh0bWxcIiwgXCJtYXRlcmlhbFwiLCBcIm1vZGVsXCIsIFwic2NyaXB0XCIsIFwic2hhZGVyXCIsIFwic3ByaXRlXCIsXG4gICAgICogXCJ0ZW1wbGF0ZVwiLCB0ZXh0XCIsIFwidGV4dHVyZVwiLCBcInRleHR1cmVhdGxhc1wiXVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbZmlsZV0gLSBEZXRhaWxzIGFib3V0IHRoZSBmaWxlIHRoZSBhc3NldCBpcyBtYWRlIGZyb20uIEF0IHRoZSBsZWFzdCBtdXN0XG4gICAgICogY29udGFpbiB0aGUgJ3VybCcgZmllbGQuIEZvciBhc3NldHMgdGhhdCBkb24ndCBjb250YWluIGZpbGUgZGF0YSB1c2UgbnVsbC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2ZpbGUudXJsXSAtIFRoZSBVUkwgb2YgdGhlIHJlc291cmNlIGZpbGUgdGhhdCBjb250YWlucyB0aGUgYXNzZXQgZGF0YS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2ZpbGUuZmlsZW5hbWVdIC0gVGhlIGZpbGVuYW1lIG9mIHRoZSByZXNvdXJjZSBmaWxlIG9yIG51bGwgaWYgbm8gZmlsZW5hbWVcbiAgICAgKiB3YXMgc2V0IChlLmcgZnJvbSB1c2luZyB7QGxpbmsgQXNzZXRSZWdpc3RyeSNsb2FkRnJvbVVybH0pLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZmlsZS5zaXplXSAtIFRoZSBzaXplIG9mIHRoZSByZXNvdXJjZSBmaWxlIG9yIG51bGwgaWYgbm8gc2l6ZSB3YXMgc2V0XG4gICAgICogKGUuZy4gZnJvbSB1c2luZyB7QGxpbmsgQXNzZXRSZWdpc3RyeSNsb2FkRnJvbVVybH0pLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZmlsZS5oYXNoXSAtIFRoZSBNRDUgaGFzaCBvZiB0aGUgcmVzb3VyY2UgZmlsZSBkYXRhIGFuZCB0aGUgQXNzZXQgZGF0YVxuICAgICAqIGZpZWxkIG9yIG51bGwgaWYgaGFzaCB3YXMgc2V0IChlLmcgZnJvbSB1c2luZyB7QGxpbmsgQXNzZXRSZWdpc3RyeSNsb2FkRnJvbVVybH0pLlxuICAgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJ9IFtmaWxlLmNvbnRlbnRzXSAtIE9wdGlvbmFsIGZpbGUgY29udGVudHMuIFRoaXMgaXMgZmFzdGVyIHRoYW4gd3JhcHBpbmdcbiAgICAgKiB0aGUgZGF0YSBpbiBhIChiYXNlNjQgZW5jb2RlZCkgYmxvYi4gQ3VycmVudGx5IG9ubHkgdXNlZCBieSBjb250YWluZXIgYXNzZXRzLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fHN0cmluZ30gW2RhdGFdIC0gSlNPTiBvYmplY3Qgb3Igc3RyaW5nIHdpdGggYWRkaXRpb25hbCBkYXRhIGFib3V0IHRoZSBhc3NldC5cbiAgICAgKiAoZS5nLiBmb3IgdGV4dHVyZSBhbmQgbW9kZWwgYXNzZXRzKSBvciBjb250YWlucyB0aGUgYXNzZXQgZGF0YSBpdHNlbGYgKGUuZy4gaW4gdGhlIGNhc2Ugb2ZcbiAgICAgKiBtYXRlcmlhbHMpLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBUaGUgYXNzZXQgaGFuZGxlciBvcHRpb25zLiBGb3IgY29udGFpbmVyIG9wdGlvbnMgc2VlXG4gICAgICoge0BsaW5rIENvbnRhaW5lckhhbmRsZXJ9LlxuICAgICAqIEBwYXJhbSB7J2Fub255bW91cyd8J3VzZS1jcmVkZW50aWFscyd8bnVsbH0gW29wdGlvbnMuY3Jvc3NPcmlnaW5dIC0gRm9yIHVzZSB3aXRoIHRleHR1cmUgYXNzZXRzXG4gICAgICogdGhhdCBhcmUgbG9hZGVkIHVzaW5nIHRoZSBicm93c2VyLiBUaGlzIHNldHRpbmcgb3ZlcnJpZGVzIHRoZSBkZWZhdWx0IGNyb3NzT3JpZ2luIHNwZWNpZmllci5cbiAgICAgKiBGb3IgbW9yZSBkZXRhaWxzIG9uIGNyb3NzT3JpZ2luIGFuZCBpdHMgdXNlLCBzZWVcbiAgICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvSFRNTEltYWdlRWxlbWVudC9jcm9zc09yaWdpbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhc3NldCA9IG5ldyBwYy5Bc3NldChcImEgdGV4dHVyZVwiLCBcInRleHR1cmVcIiwge1xuICAgICAqICAgICB1cmw6IFwiaHR0cDovL2V4YW1wbGUuY29tL215L2Fzc2V0cy9oZXJlL3RleHR1cmUucG5nXCJcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihuYW1lLCB0eXBlLCBmaWxlLCBkYXRhLCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5faWQgPSBhc3NldElkQ291bnRlci0tO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbmFtZSBvZiB0aGUgYXNzZXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5hbWUgPSBuYW1lIHx8ICcnO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdHlwZSBvZiB0aGUgYXNzZXQuIE9uZSBvZiBbXCJhbmltYXRpb25cIiwgXCJhdWRpb1wiLCBcImJpbmFyeVwiLCBcImNvbnRhaW5lclwiLCBcImN1YmVtYXBcIixcbiAgICAgICAgICogXCJjc3NcIiwgXCJmb250XCIsIFwianNvblwiLCBcImh0bWxcIiwgXCJtYXRlcmlhbFwiLCBcIm1vZGVsXCIsIFwicmVuZGVyXCIsIFwic2NyaXB0XCIsIFwic2hhZGVyXCIsIFwic3ByaXRlXCIsXG4gICAgICAgICAqIFwidGVtcGxhdGVcIiwgXCJ0ZXh0XCIsIFwidGV4dHVyZVwiLCBcInRleHR1cmVhdGxhc1wiXVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7KFwiYW5pbWF0aW9uXCJ8XCJhdWRpb1wifFwiYmluYXJ5XCJ8XCJjb250YWluZXJcInxcImN1YmVtYXBcInxcImNzc1wifFwiZm9udFwifFwianNvblwifFwiaHRtbFwifFwibWF0ZXJpYWxcInxcIm1vZGVsXCJ8XCJyZW5kZXJcInxcInNjcmlwdFwifFwic2hhZGVyXCJ8XCJzcHJpdGVcInxcInRlbXBsYXRlXCJ8XCJ0ZXh0XCJ8XCJ0ZXh0dXJlXCJ8XCJ0ZXh0dXJlYXRsYXNcIil9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnR5cGUgPSB0eXBlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBc3NldCB0YWdzLiBFbmFibGVzIGZpbmRpbmcgb2YgYXNzZXRzIGJ5IHRhZ3MgdXNpbmcgdGhlIHtAbGluayBBc3NldFJlZ2lzdHJ5I2ZpbmRCeVRhZ30gbWV0aG9kLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VGFnc31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudGFncyA9IG5ldyBUYWdzKHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX3ByZWxvYWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZmlsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX2RhdGEgPSBkYXRhIHx8IHsgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogT3B0aW9uYWwgSlNPTiBkYXRhIHRoYXQgY29udGFpbnMgdGhlIGFzc2V0IGhhbmRsZXIgb3B0aW9ucy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge29iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwgeyB9O1xuXG4gICAgICAgIC8vIFRoaXMgaXMgd2hlcmUgdGhlIGxvYWRlZCByZXNvdXJjZShzKSB3aWxsIGJlXG4gICAgICAgIHRoaXMuX3Jlc291cmNlcyA9IFtdO1xuXG4gICAgICAgIC8vIGEgc3RyaW5nLWFzc2V0SWQgZGljdGlvbmFyeSB0aGF0IG1hcHNcbiAgICAgICAgLy8gbG9jYWxlIHRvIGFzc2V0IGlkXG4gICAgICAgIHRoaXMuX2kxOG4gPSB7fTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJ1ZSBpZiB0aGUgYXNzZXQgaGFzIGZpbmlzaGVkIGF0dGVtcHRpbmcgdG8gbG9hZCB0aGUgcmVzb3VyY2UuIEl0IGlzIG5vdCBndWFyYW50ZWVkXG4gICAgICAgICAqIHRoYXQgdGhlIHJlc291cmNlcyBhcmUgYXZhaWxhYmxlIGFzIHRoZXJlIGNvdWxkIGhhdmUgYmVlbiBhIG5ldHdvcmsgZXJyb3IuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVHJ1ZSBpZiB0aGUgcmVzb3VyY2UgaXMgY3VycmVudGx5IGJlaW5nIGxvYWRlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvYWRpbmcgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFzc2V0IHJlZ2lzdHJ5IHRoYXQgdGhpcyBBc3NldCBiZWxvbmdzIHRvLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2Fzc2V0LXJlZ2lzdHJ5LmpzJykuQXNzZXRSZWdpc3RyeX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVnaXN0cnkgPSBudWxsO1xuXG4gICAgICAgIGlmIChmaWxlKSB0aGlzLmZpbGUgPSBmaWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGFzc2V0IGhhcyBjb21wbGV0ZWQgbG9hZGluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldCNsb2FkXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdGhhdCB3YXMgbG9hZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQganVzdCBiZWZvcmUgdGhlIGFzc2V0IHVubG9hZHMgdGhlIHJlc291cmNlLiBUaGlzIGFsbG93cyBmb3IgdGhlIG9wcG9ydHVuaXR5IHRvIHByZXBhcmVcbiAgICAgKiBmb3IgYW4gYXNzZXQgdGhhdCB3aWxsIGJlIHVubG9hZGVkLiBFLmcuIENoYW5naW5nIHRoZSB0ZXh0dXJlIG9mIGEgbW9kZWwgdG8gYSBkZWZhdWx0IGJlZm9yZVxuICAgICAqIHRoZSBvbmUgaXQgd2FzIHVzaW5nIGlzIHVubG9hZGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0I3VubG9hZFxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgaXMgZHVlIHRvIGJlIHVubG9hZGVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgYXNzZXQgaXMgcmVtb3ZlZCBmcm9tIHRoZSBhc3NldCByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldCNyZW1vdmVcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IHdhcyByZW1vdmVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgaWYgdGhlIGFzc2V0IGVuY291bnRlcnMgYW4gZXJyb3Igd2hpbGUgbG9hZGluZy5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldCNlcnJvclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZS5cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IGdlbmVyYXRlZCB0aGUgZXJyb3IuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIG9uZSBvZiB0aGUgYXNzZXQgcHJvcGVydGllcyBgZmlsZWAsIGBkYXRhYCwgYHJlc291cmNlYCBvciBgcmVzb3VyY2VzYCBpcyBjaGFuZ2VkLlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0I2NoYW5nZVxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgd2FzIGxvYWRlZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJvcGVydHkgLSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdGhhdCBjaGFuZ2VkLlxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgLSBUaGUgbmV3IHByb3BlcnR5IHZhbHVlLlxuICAgICAqIEBwYXJhbSB7Kn0gb2xkVmFsdWUgLSBUaGUgb2xkIHByb3BlcnR5IHZhbHVlLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB3ZSBhZGQgYSBuZXcgbG9jYWxpemVkIGFzc2V0IGlkIHRvIHRoZSBhc3NldC5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldCNhZGQ6bG9jYWxpemVkXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGxvY2FsZSAtIFRoZSBsb2NhbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFzc2V0SWQgLSBUaGUgYXNzZXQgaWQgd2UgYWRkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHdlIHJlbW92ZSBhIGxvY2FsaXplZCBhc3NldCBpZCBmcm9tIHRoZSBhc3NldC5cbiAgICAgKlxuICAgICAqIEBldmVudCBBc3NldCNyZW1vdmU6bG9jYWxpemVkXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGxvY2FsZSAtIFRoZSBsb2NhbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFzc2V0SWQgLSBUaGUgYXNzZXQgaWQgd2UgcmVtb3ZlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIFRoZSBhc3NldCBpZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGlkKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2lkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGlkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGZpbGUgZGV0YWlscyBvciBudWxsIGlmIG5vIGZpbGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqL1xuICAgIHNldCBmaWxlKHZhbHVlKSB7XG4gICAgICAgIC8vIGlmIHZhbHVlIGNvbnRhaW5zIHZhcmlhbnRzLCBjaG9vc2UgdGhlIGNvcnJlY3QgdmFyaWFudCBmaXJzdFxuICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUudmFyaWFudHMgJiYgWyd0ZXh0dXJlJywgJ3RleHR1cmVhdGxhcycsICdidW5kbGUnXS5pbmRleE9mKHRoaXMudHlwZSkgIT09IC0xKSB7XG4gICAgICAgICAgICAvLyBzZWFyY2ggZm9yIGFjdGl2ZSB2YXJpYW50XG4gICAgICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnJlZ2lzdHJ5Py5fbG9hZGVyPy5fYXBwIHx8IGdldEFwcGxpY2F0aW9uKCk7XG4gICAgICAgICAgICBjb25zdCBkZXZpY2UgPSBhcHA/LmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICAgICAgaWYgKGRldmljZSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBWQVJJQU5UX0RFRkFVTFRfUFJJT1JJVFkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudCA9IFZBUklBTlRfREVGQVVMVF9QUklPUklUWVtpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIGRldmljZSBzdXBwb3J0cyB0aGUgdmFyaWFudFxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUudmFyaWFudHNbdmFyaWFudF0gJiYgZGV2aWNlW1ZBUklBTlRfU1VQUE9SVFt2YXJpYW50XV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUudmFyaWFudHNbdmFyaWFudF07XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSB2YXJpYW50IGRvZXMgbm90IGV4aXN0IGJ1dCB0aGUgYXNzZXQgaXMgaW4gYSBidW5kbGVcbiAgICAgICAgICAgICAgICAgICAgLy8gYW5kIHRoZSBidW5kbGUgY29udGFpbiBhc3NldHMgd2l0aCB0aGlzIHZhcmlhbnQgdGhlbiByZXR1cm4gdGhlIGRlZmF1bHRcbiAgICAgICAgICAgICAgICAgICAgLy8gZmlsZSBmb3IgdGhlIGFzc2V0XG4gICAgICAgICAgICAgICAgICAgIGlmIChhcHAuZW5hYmxlQnVuZGxlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVuZGxlcyA9IGFwcC5idW5kbGVzLmxpc3RCdW5kbGVzRm9yQXNzZXQodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnVuZGxlcyAmJiBidW5kbGVzLmZpbmQoKGIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYj8uZmlsZT8udmFyaWFudHNbdmFyaWFudF07XG4gICAgICAgICAgICAgICAgICAgICAgICB9KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb2xkRmlsZSA9IHRoaXMuX2ZpbGU7XG4gICAgICAgIGNvbnN0IG5ld0ZpbGUgPSB2YWx1ZSA/IG5ldyBBc3NldEZpbGUodmFsdWUudXJsLCB2YWx1ZS5maWxlbmFtZSwgdmFsdWUuaGFzaCwgdmFsdWUuc2l6ZSwgdmFsdWUub3B0LCB2YWx1ZS5jb250ZW50cykgOiBudWxsO1xuXG4gICAgICAgIGlmICghIW5ld0ZpbGUgIT09ICEhb2xkRmlsZSB8fCAobmV3RmlsZSAmJiAhbmV3RmlsZS5lcXVhbHMob2xkRmlsZSkpKSB7XG4gICAgICAgICAgICB0aGlzLl9maWxlID0gbmV3RmlsZTtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnY2hhbmdlJywgdGhpcywgJ2ZpbGUnLCBuZXdGaWxlLCBvbGRGaWxlKTtcbiAgICAgICAgICAgIHRoaXMucmVsb2FkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZmlsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogT3B0aW9uYWwgSlNPTiBkYXRhIHRoYXQgY29udGFpbnMgZWl0aGVyIHRoZSBjb21wbGV0ZSByZXNvdXJjZSBkYXRhLiAoZS5nLiBpbiB0aGUgY2FzZSBvZiBhXG4gICAgICogbWF0ZXJpYWwpIG9yIGFkZGl0aW9uYWwgZGF0YSAoZS5nLiBpbiB0aGUgY2FzZSBvZiBhIG1vZGVsIGl0IGNvbnRhaW5zIG1hcHBpbmdzIGZyb20gbWVzaCB0b1xuICAgICAqIG1hdGVyaWFsKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICovXG4gICAgc2V0IGRhdGEodmFsdWUpIHtcbiAgICAgICAgLy8gZmlyZSBjaGFuZ2UgZXZlbnQgd2hlbiBkYXRhIGNoYW5nZXNcbiAgICAgICAgLy8gYmVjYXVzZSB0aGUgYXNzZXQgbWlnaHQgbmVlZCByZWxvYWRpbmcgaWYgdGhhdCBoYXBwZW5zXG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuX2RhdGE7XG4gICAgICAgIHRoaXMuX2RhdGEgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHZhbHVlICE9PSBvbGQpIHtcbiAgICAgICAgICAgIHRoaXMuZmlyZSgnY2hhbmdlJywgdGhpcywgJ2RhdGEnLCB2YWx1ZSwgb2xkKTtcblxuICAgICAgICAgICAgaWYgKHRoaXMubG9hZGVkKVxuICAgICAgICAgICAgICAgIHRoaXMucmVnaXN0cnkuX2xvYWRlci5wYXRjaCh0aGlzLCB0aGlzLnJlZ2lzdHJ5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBkYXRhKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlZmVyZW5jZSB0byB0aGUgcmVzb3VyY2Ugd2hlbiB0aGUgYXNzZXQgaXMgbG9hZGVkLiBlLmcuIGEge0BsaW5rIFRleHR1cmV9IG9yIGEge0BsaW5rIE1vZGVsfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICovXG4gICAgc2V0IHJlc291cmNlKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IF9vbGQgPSB0aGlzLl9yZXNvdXJjZXNbMF07XG4gICAgICAgIHRoaXMuX3Jlc291cmNlc1swXSA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2NoYW5nZScsIHRoaXMsICdyZXNvdXJjZScsIHZhbHVlLCBfb2xkKTtcbiAgICB9XG5cbiAgICBnZXQgcmVzb3VyY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZXNvdXJjZXNbMF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByZWZlcmVuY2UgdG8gdGhlIHJlc291cmNlcyBvZiB0aGUgYXNzZXQgd2hlbiBpdCdzIGxvYWRlZC4gQW4gYXNzZXQgY2FuIGhvbGQgbW9yZSBydW50aW1lXG4gICAgICogcmVzb3VyY2VzIHRoYW4gb25lIGUuZy4gY3ViZW1hcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7b2JqZWN0W119XG4gICAgICovXG4gICAgc2V0IHJlc291cmNlcyh2YWx1ZSkge1xuICAgICAgICBjb25zdCBfb2xkID0gdGhpcy5fcmVzb3VyY2VzO1xuICAgICAgICB0aGlzLl9yZXNvdXJjZXMgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5maXJlKCdjaGFuZ2UnLCB0aGlzLCAncmVzb3VyY2VzJywgdmFsdWUsIF9vbGQpO1xuICAgIH1cblxuICAgIGdldCByZXNvdXJjZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZXNvdXJjZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSB0aGUgYXNzZXQgd2lsbCBiZSBsb2FkZWQgZHVyaW5nIHRoZSBwcmVsb2FkIHBoYXNlIG9mIGFwcGxpY2F0aW9uIHNldCB1cC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBwcmVsb2FkKHZhbHVlKSB7XG4gICAgICAgIHZhbHVlID0gISF2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3ByZWxvYWQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3ByZWxvYWQgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3ByZWxvYWQgJiYgIXRoaXMubG9hZGVkICYmICF0aGlzLmxvYWRpbmcgJiYgdGhpcy5yZWdpc3RyeSlcbiAgICAgICAgICAgIHRoaXMucmVnaXN0cnkubG9hZCh0aGlzKTtcbiAgICB9XG5cbiAgICBnZXQgcHJlbG9hZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZWxvYWQ7XG4gICAgfVxuXG4gICAgc2V0IGxvYWRGYWNlcyh2YWx1ZSkge1xuICAgICAgICB2YWx1ZSA9ICEhdmFsdWU7XG4gICAgICAgIGlmICghdGhpcy5oYXNPd25Qcm9wZXJ0eSgnX2xvYWRGYWNlcycpIHx8IHZhbHVlICE9PSB0aGlzLl9sb2FkRmFjZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2xvYWRGYWNlcyA9IHZhbHVlO1xuXG4gICAgICAgICAgICAvLyB0aGUgbG9hZEZhY2VzIHByb3BlcnR5IHNob3VsZCBiZSBwYXJ0IG9mIHRoZSBhc3NldCBkYXRhIGJsb2NrXG4gICAgICAgICAgICAvLyBiZWNhdXNlIGNoYW5naW5nIHRoZSBmbGFnIHNob3VsZCByZXN1bHQgaW4gYXNzZXQgcGF0Y2ggYmVpbmcgaW52b2tlZC5cbiAgICAgICAgICAgIC8vIGhlcmUgd2UgbXVzdCBpbnZva2UgaXQgbWFudWFsbHkgaW5zdGVhZC5cbiAgICAgICAgICAgIGlmICh0aGlzLmxvYWRlZClcbiAgICAgICAgICAgICAgICB0aGlzLnJlZ2lzdHJ5Ll9sb2FkZXIucGF0Y2godGhpcywgdGhpcy5yZWdpc3RyeSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbG9hZEZhY2VzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9hZEZhY2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgVVJMIHJlcXVpcmVkIHRvIGZldGNoIHRoZSBmaWxlIGZvciB0aGlzIGFzc2V0LlxuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ3xudWxsfSBUaGUgVVJMLiBSZXR1cm5zIG51bGwgaWYgdGhlIGFzc2V0IGhhcyBubyBhc3NvY2lhdGVkIGZpbGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXNzZXRzID0gYXBwLmFzc2V0cy5maW5kKFwiTXkgSW1hZ2VcIiwgXCJ0ZXh0dXJlXCIpO1xuICAgICAqIHZhciBpbWcgPSBcIiZsdDtpbWcgc3JjPSdcIiArIGFzc2V0c1swXS5nZXRGaWxlVXJsKCkgKyBcIicmZ3Q7XCI7XG4gICAgICovXG4gICAgZ2V0RmlsZVVybCgpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuZmlsZTtcblxuICAgICAgICBpZiAoIWZpbGUgfHwgIWZpbGUudXJsKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgbGV0IHVybCA9IGZpbGUudXJsO1xuXG4gICAgICAgIGlmICh0aGlzLnJlZ2lzdHJ5ICYmIHRoaXMucmVnaXN0cnkucHJlZml4ICYmICFBQlNPTFVURV9VUkwudGVzdCh1cmwpKVxuICAgICAgICAgICAgdXJsID0gdGhpcy5yZWdpc3RyeS5wcmVmaXggKyB1cmw7XG5cbiAgICAgICAgLy8gYWRkIGZpbGUgaGFzaCB0byBhdm9pZCBoYXJkLWNhY2hpbmcgcHJvYmxlbXNcbiAgICAgICAgaWYgKHRoaXMudHlwZSAhPT0gJ3NjcmlwdCcgJiYgZmlsZS5oYXNoKSB7XG4gICAgICAgICAgICBjb25zdCBzZXBhcmF0b3IgPSB1cmwuaW5kZXhPZignPycpICE9PSAtMSA/ICcmJyA6ICc/JztcbiAgICAgICAgICAgIHVybCArPSBzZXBhcmF0b3IgKyAndD0nICsgZmlsZS5oYXNoO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgYW4gYXNzZXQgVVJMIGZyb20gdGhpcyBhc3NldCdzIGxvY2F0aW9uIGFuZCBhIHJlbGF0aXZlIHBhdGguIElmIHRoZSByZWxhdGl2ZVBhdGhcbiAgICAgKiBpcyBhIGJsb2Igb3IgQmFzZTY0IFVSSSwgdGhlbiByZXR1cm4gdGhhdCBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHJlbGF0aXZlUGF0aCAtIFRoZSByZWxhdGl2ZSBwYXRoIHRvIGJlIGNvbmNhdGVuYXRlZCB0byB0aGlzIGFzc2V0J3MgYmFzZSB1cmwuXG4gICAgICogQHJldHVybnMge3N0cmluZ30gUmVzdWx0aW5nIFVSTCBvZiB0aGUgYXNzZXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEFic29sdXRlVXJsKHJlbGF0aXZlUGF0aCkge1xuICAgICAgICBpZiAocmVsYXRpdmVQYXRoLnN0YXJ0c1dpdGgoJ2Jsb2I6JykgfHwgcmVsYXRpdmVQYXRoLnN0YXJ0c1dpdGgoJ2RhdGE6JykpIHtcbiAgICAgICAgICAgIHJldHVybiByZWxhdGl2ZVBhdGg7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBiYXNlID0gcGF0aC5nZXREaXJlY3RvcnkodGhpcy5maWxlLnVybCk7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4oYmFzZSwgcmVsYXRpdmVQYXRoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBhc3NldCBpZCBvZiB0aGUgYXNzZXQgdGhhdCBjb3JyZXNwb25kcyB0byB0aGUgc3BlY2lmaWVkIGxvY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgZGVzaXJlZCBsb2NhbGUgZS5nLiBBci1BUi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBbiBhc3NldCBpZCBvciBudWxsIGlmIHRoZXJlIGlzIG5vIGFzc2V0IHNwZWNpZmllZCBmb3IgdGhlIGRlc2lyZWQgbG9jYWxlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRMb2NhbGl6ZWRBc3NldElkKGxvY2FsZSkge1xuICAgICAgICAvLyB0cmllcyB0byBmaW5kIGVpdGhlciB0aGUgZGVzaXJlZCBsb2NhbGUgb3IgYSBmYWxsYmFjayBsb2NhbGVcbiAgICAgICAgbG9jYWxlID0gZmluZEF2YWlsYWJsZUxvY2FsZShsb2NhbGUsIHRoaXMuX2kxOG4pO1xuICAgICAgICByZXR1cm4gdGhpcy5faTE4bltsb2NhbGVdIHx8IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHJlcGxhY2VtZW50IGFzc2V0IGlkIGZvciB0aGUgc3BlY2lmaWVkIGxvY2FsZS4gV2hlbiB0aGUgbG9jYWxlIGluXG4gICAgICoge0BsaW5rIEFwcGxpY2F0aW9uI2kxOG59IGNoYW5nZXMgdGhlbiByZWZlcmVuY2VzIHRvIHRoaXMgYXNzZXQgd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZVxuICAgICAqIHNwZWNpZmllZCBhc3NldCBpZC4gKEN1cnJlbnRseSBvbmx5IHN1cHBvcnRlZCBieSB0aGUge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9KS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbG9jYWxlIGUuZy4gQXItQVIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFzc2V0SWQgLSBUaGUgYXNzZXQgaWQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFkZExvY2FsaXplZEFzc2V0SWQobG9jYWxlLCBhc3NldElkKSB7XG4gICAgICAgIHRoaXMuX2kxOG5bbG9jYWxlXSA9IGFzc2V0SWQ7XG4gICAgICAgIHRoaXMuZmlyZSgnYWRkOmxvY2FsaXplZCcsIGxvY2FsZSwgYXNzZXRJZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGxvY2FsaXplZCBhc3NldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbG9jYWxlIGUuZy4gQXItQVIuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbW92ZUxvY2FsaXplZEFzc2V0SWQobG9jYWxlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0SWQgPSB0aGlzLl9pMThuW2xvY2FsZV07XG4gICAgICAgIGlmIChhc3NldElkKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5faTE4bltsb2NhbGVdO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmU6bG9jYWxpemVkJywgbG9jYWxlLCBhc3NldElkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRha2UgYSBjYWxsYmFjayB3aGljaCBpcyBjYWxsZWQgYXMgc29vbiBhcyB0aGUgYXNzZXQgaXMgbG9hZGVkLiBJZiB0aGUgYXNzZXQgaXMgYWxyZWFkeVxuICAgICAqIGxvYWRlZCB0aGUgY2FsbGJhY2sgaXMgY2FsbGVkIHN0cmFpZ2h0IGF3YXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0UmVhZHlDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gY2FsbGVkIHdoZW4gdGhlIGFzc2V0IGlzIHJlYWR5LiBQYXNzZWRcbiAgICAgKiB0aGUgKGFzc2V0KSBhcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtzY29wZV0gLSBTY29wZSBvYmplY3QgdG8gdXNlIHdoZW4gY2FsbGluZyB0aGUgY2FsbGJhY2suXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXNzZXQgPSBhcHAuYXNzZXRzLmZpbmQoXCJNeSBBc3NldFwiKTtcbiAgICAgKiBhc3NldC5yZWFkeShmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgKiAgIC8vIGFzc2V0IGxvYWRlZFxuICAgICAqIH0pO1xuICAgICAqIGFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICovXG4gICAgcmVhZHkoY2FsbGJhY2ssIHNjb3BlKSB7XG4gICAgICAgIHNjb3BlID0gc2NvcGUgfHwgdGhpcztcblxuICAgICAgICBpZiAodGhpcy5sb2FkZWQpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoc2NvcGUsIHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5vbmNlKCdsb2FkJywgZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbChzY29wZSwgYXNzZXQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZWxvYWQoKSB7XG4gICAgICAgIC8vIG5vIG5lZWQgdG8gYmUgcmVsb2FkZWRcbiAgICAgICAgaWYgKHRoaXMubG9hZGVkKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5yZWdpc3RyeS5sb2FkKHRoaXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveXMgdGhlIGFzc29jaWF0ZWQgcmVzb3VyY2UgYW5kIG1hcmtzIGFzc2V0IGFzIHVubG9hZGVkLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXNzZXQgPSBhcHAuYXNzZXRzLmZpbmQoXCJNeSBBc3NldFwiKTtcbiAgICAgKiBhc3NldC51bmxvYWQoKTtcbiAgICAgKiAvLyBhc3NldC5yZXNvdXJjZSBpcyBudWxsXG4gICAgICovXG4gICAgdW5sb2FkKCkge1xuICAgICAgICBpZiAoIXRoaXMubG9hZGVkICYmIHRoaXMuX3Jlc291cmNlcy5sZW5ndGggPT09IDApXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5maXJlKCd1bmxvYWQnLCB0aGlzKTtcbiAgICAgICAgdGhpcy5yZWdpc3RyeS5maXJlKCd1bmxvYWQ6JyArIHRoaXMuaWQsIHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuX3Jlc291cmNlcztcblxuICAgICAgICAvLyBjbGVhciByZXNvdXJjZXMgb24gdGhlIGFzc2V0XG4gICAgICAgIHRoaXMucmVzb3VyY2VzID0gW107XG4gICAgICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gcmVtb3ZlIHJlc291cmNlIGZyb20gbG9hZGVyIGNhY2hlXG4gICAgICAgIGlmICh0aGlzLmZpbGUpIHtcbiAgICAgICAgICAgIHRoaXMucmVnaXN0cnkuX2xvYWRlci5jbGVhckNhY2hlKHRoaXMuZ2V0RmlsZVVybCgpLCB0aGlzLnR5cGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVzdHJveSByZXNvdXJjZXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBvbGQubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc291cmNlID0gb2xkW2ldO1xuICAgICAgICAgICAgaWYgKHJlc291cmNlICYmIHJlc291cmNlLmRlc3Ryb3kpIHtcbiAgICAgICAgICAgICAgICByZXNvdXJjZS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gcmVzb2x2ZSBhc3NldCBmaWxlIGRhdGEgYW5kIHJldHVybiB0aGUgY29udGVudHMgYXMgYW4gQXJyYXlCdWZmZXIuIElmIHRoZVxuICAgICAqIGFzc2V0IGZpbGUgY29udGVudHMgYXJlIHByZXNlbnQsIHRoYXQgaXMgcmV0dXJuZWQuIE90aGVyd2lzZSB0aGUgZmlsZSBkYXRhIGlzIGJlIGRvd25sb2FkZWRcbiAgICAgKiB2aWEgaHR0cC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2FkVXJsIC0gVGhlIFVSTCBhcyBwYXNzZWQgaW50byB0aGUgaGFuZGxlclxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9oYW5kbGVycy9sb2FkZXIuanMnKS5SZXNvdXJjZUxvYWRlckNhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBjYWxsYmFja1xuICAgICAqIGZ1bmN0aW9uIHRvIHJlY2VpdmUgcmVzdWx0cy5cbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBbYXNzZXRdIC0gVGhlIGFzc2V0XG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1heFJldHJpZXMgLSBOdW1iZXIgb2YgcmV0cmllcyBpZiBodHRwIGRvd25sb2FkIGlzIHJlcXVpcmVkXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXRpYyBmZXRjaEFycmF5QnVmZmVyKGxvYWRVcmwsIGNhbGxiYWNrLCBhc3NldCwgbWF4UmV0cmllcyA9IDApIHtcbiAgICAgICAgaWYgKGFzc2V0Py5maWxlPy5jb250ZW50cykge1xuICAgICAgICAgICAgLy8gYXNzZXQgZmlsZSBjb250ZW50cyB3ZXJlIHByb3ZpZGVkXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCBhc3NldC5maWxlLmNvbnRlbnRzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYXNzZXQgY29udGVudHMgbXVzdCBiZSBkb3dubG9hZGVkXG4gICAgICAgICAgICBodHRwLmdldChsb2FkVXJsLCB7XG4gICAgICAgICAgICAgICAgY2FjaGU6IHRydWUsXG4gICAgICAgICAgICAgICAgcmVzcG9uc2VUeXBlOiAnYXJyYXlidWZmZXInLFxuICAgICAgICAgICAgICAgIHJldHJ5OiBtYXhSZXRyaWVzID4gMCxcbiAgICAgICAgICAgICAgICBtYXhSZXRyaWVzOiBtYXhSZXRyaWVzXG4gICAgICAgICAgICB9LCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IEFzc2V0IH07XG4iXSwibmFtZXMiOlsiYXNzZXRJZENvdW50ZXIiLCJWQVJJQU5UX1NVUFBPUlQiLCJwdnIiLCJkeHQiLCJldGMyIiwiZXRjMSIsImJhc2lzIiwiVkFSSUFOVF9ERUZBVUxUX1BSSU9SSVRZIiwiQXNzZXQiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJ0eXBlIiwiZmlsZSIsImRhdGEiLCJvcHRpb25zIiwiX2lkIiwidGFncyIsIlRhZ3MiLCJfcHJlbG9hZCIsIl9maWxlIiwiX2RhdGEiLCJfcmVzb3VyY2VzIiwiX2kxOG4iLCJsb2FkZWQiLCJsb2FkaW5nIiwicmVnaXN0cnkiLCJpZCIsInZhbHVlIiwidmFyaWFudHMiLCJpbmRleE9mIiwiYXBwIiwiX2xvYWRlciIsIl9hcHAiLCJnZXRBcHBsaWNhdGlvbiIsImRldmljZSIsImdyYXBoaWNzRGV2aWNlIiwiaSIsImxlbiIsImxlbmd0aCIsInZhcmlhbnQiLCJlbmFibGVCdW5kbGVzIiwiYnVuZGxlcyIsImxpc3RCdW5kbGVzRm9yQXNzZXQiLCJmaW5kIiwiYiIsIm9sZEZpbGUiLCJuZXdGaWxlIiwiQXNzZXRGaWxlIiwidXJsIiwiZmlsZW5hbWUiLCJoYXNoIiwic2l6ZSIsIm9wdCIsImNvbnRlbnRzIiwiZXF1YWxzIiwiZmlyZSIsInJlbG9hZCIsIm9sZCIsInBhdGNoIiwicmVzb3VyY2UiLCJfb2xkIiwicmVzb3VyY2VzIiwicHJlbG9hZCIsImxvYWQiLCJsb2FkRmFjZXMiLCJoYXNPd25Qcm9wZXJ0eSIsIl9sb2FkRmFjZXMiLCJnZXRGaWxlVXJsIiwicHJlZml4IiwiQUJTT0xVVEVfVVJMIiwidGVzdCIsInNlcGFyYXRvciIsImdldEFic29sdXRlVXJsIiwicmVsYXRpdmVQYXRoIiwic3RhcnRzV2l0aCIsImJhc2UiLCJwYXRoIiwiZ2V0RGlyZWN0b3J5Iiwiam9pbiIsImdldExvY2FsaXplZEFzc2V0SWQiLCJsb2NhbGUiLCJmaW5kQXZhaWxhYmxlTG9jYWxlIiwiYWRkTG9jYWxpemVkQXNzZXRJZCIsImFzc2V0SWQiLCJyZW1vdmVMb2NhbGl6ZWRBc3NldElkIiwicmVhZHkiLCJjYWxsYmFjayIsInNjb3BlIiwiY2FsbCIsIm9uY2UiLCJhc3NldCIsInVubG9hZCIsImNsZWFyQ2FjaGUiLCJkZXN0cm95IiwiZmV0Y2hBcnJheUJ1ZmZlciIsImxvYWRVcmwiLCJtYXhSZXRyaWVzIiwic2V0VGltZW91dCIsImh0dHAiLCJnZXQiLCJjYWNoZSIsInJlc3BvbnNlVHlwZSIsInJldHJ5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQVlBO0FBQ0EsSUFBSUEsY0FBYyxHQUFHLENBQUMsQ0FBQyxDQUFBO0FBRXZCLE1BQU1DLGVBQWUsR0FBRztBQUNwQkMsRUFBQUEsR0FBRyxFQUFFLDJCQUEyQjtBQUNoQ0MsRUFBQUEsR0FBRyxFQUFFLDBCQUEwQjtBQUMvQkMsRUFBQUEsSUFBSSxFQUFFLHlCQUF5QjtBQUMvQkMsRUFBQUEsSUFBSSxFQUFFLDBCQUEwQjtFQUNoQ0MsS0FBSyxFQUFFLFFBQVE7QUFDbkIsQ0FBQyxDQUFBOztBQUVELE1BQU1DLHdCQUF3QixHQUFHLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFBOztBQUV4RTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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
