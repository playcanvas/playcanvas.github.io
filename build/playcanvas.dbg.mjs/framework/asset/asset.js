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
   * const asset = new pc.Asset("a texture", "texture", {
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
   * const assets = app.assets.find("My Image", "texture");
   * const img = "&lt;img src='" + assets[0].getFileUrl() + "'&gt;";
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
   * const asset = app.assets.find("My Asset");
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
   * const asset = app.assets.find("My Asset");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXNzZXQvYXNzZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uLy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBUYWdzIH0gZnJvbSAnLi4vLi4vY29yZS90YWdzLmpzJztcblxuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgZmluZEF2YWlsYWJsZUxvY2FsZSB9IGZyb20gJy4uL2kxOG4vdXRpbHMuanMnO1xuXG5pbXBvcnQgeyBBQlNPTFVURV9VUkwgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBBc3NldEZpbGUgfSBmcm9tICcuL2Fzc2V0LWZpbGUuanMnO1xuaW1wb3J0IHsgZ2V0QXBwbGljYXRpb24gfSBmcm9tICcuLi9nbG9iYWxzLmpzJztcbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9uZXQvaHR0cC5qcyc7XG5cbi8vIGF1dG8gaW5jcmVtZW50aW5nIG51bWJlciBmb3IgYXNzZXQgaWRzXG5sZXQgYXNzZXRJZENvdW50ZXIgPSAtMTtcblxuY29uc3QgVkFSSUFOVF9TVVBQT1JUID0ge1xuICAgIHB2cjogJ2V4dENvbXByZXNzZWRUZXh0dXJlUFZSVEMnLFxuICAgIGR4dDogJ2V4dENvbXByZXNzZWRUZXh0dXJlUzNUQycsXG4gICAgZXRjMjogJ2V4dENvbXByZXNzZWRUZXh0dXJlRVRDJyxcbiAgICBldGMxOiAnZXh0Q29tcHJlc3NlZFRleHR1cmVFVEMxJyxcbiAgICBiYXNpczogJ2NhbnZhcycgLy8gZHVtbXksIGJhc2lzIGlzIGFsd2F5cyBzdXBwb3J0ZWRcbn07XG5cbmNvbnN0IFZBUklBTlRfREVGQVVMVF9QUklPUklUWSA9IFsncHZyJywgJ2R4dCcsICdldGMyJywgJ2V0YzEnLCAnYmFzaXMnXTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBc3NldCNyZWFkeX0gYW5kIGNhbGxlZCB3aGVuIGFuIGFzc2V0IGlzIHJlYWR5LlxuICpcbiAqIEBjYWxsYmFjayBBc3NldFJlYWR5Q2FsbGJhY2tcbiAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIHJlYWR5IGFzc2V0LlxuICovXG5cbi8qKlxuICogQW4gYXNzZXQgcmVjb3JkIG9mIGEgZmlsZSBvciBkYXRhIHJlc291cmNlIHRoYXQgY2FuIGJlIGxvYWRlZCBieSB0aGUgZW5naW5lLiBUaGUgYXNzZXQgY29udGFpbnNcbiAqIGZvdXIgaW1wb3J0YW50IGZpZWxkczpcbiAqXG4gKiAtIGBmaWxlYDogY29udGFpbnMgdGhlIGRldGFpbHMgb2YgYSBmaWxlIChmaWxlbmFtZSwgdXJsKSB3aGljaCBjb250YWlucyB0aGUgcmVzb3VyY2UgZGF0YSwgZS5nLlxuICogYW4gaW1hZ2UgZmlsZSBmb3IgYSB0ZXh0dXJlIGFzc2V0LlxuICogLSBgZGF0YWA6IGNvbnRhaW5zIGEgSlNPTiBibG9iIHdoaWNoIGNvbnRhaW5zIGVpdGhlciB0aGUgcmVzb3VyY2UgZGF0YSBmb3IgdGhlIGFzc2V0IChlLmcuXG4gKiBtYXRlcmlhbCBkYXRhKSBvciBhZGRpdGlvbmFsIGRhdGEgZm9yIHRoZSBmaWxlIChlLmcuIG1hdGVyaWFsIG1hcHBpbmdzIGZvciBhIG1vZGVsKS5cbiAqIC0gYG9wdGlvbnNgOiBjb250YWlucyBhIEpTT04gYmxvYiB3aXRoIGhhbmRsZXItc3BlY2lmaWMgbG9hZCBvcHRpb25zLlxuICogLSBgcmVzb3VyY2VgOiBjb250YWlucyB0aGUgZmluYWwgcmVzb3VyY2Ugd2hlbiBpdCBpcyBsb2FkZWQuIChlLmcuIGEge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWx9IG9yXG4gKiBhIHtAbGluayBUZXh0dXJlfSkuXG4gKlxuICogU2VlIHRoZSB7QGxpbmsgQXNzZXRSZWdpc3RyeX0gZm9yIGRldGFpbHMgb24gbG9hZGluZyByZXNvdXJjZXMgZnJvbSBhc3NldHMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBBc3NldCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEFzc2V0IHJlY29yZC4gR2VuZXJhbGx5LCBBc3NldHMgYXJlIGNyZWF0ZWQgaW4gdGhlIGxvYWRpbmcgcHJvY2VzcyBhbmQgeW91XG4gICAgICogd29uJ3QgbmVlZCB0byBjcmVhdGUgdGhlbSBieSBoYW5kLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBBIG5vbi11bmlxdWUgYnV0IGh1bWFuLXJlYWRhYmxlIG5hbWUgd2hpY2ggY2FuIGJlIGxhdGVyIHVzZWQgdG9cbiAgICAgKiByZXRyaWV2ZSB0aGUgYXNzZXQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGUgLSBUeXBlIG9mIGFzc2V0LiBPbmUgb2YgW1wiYW5pbWF0aW9uXCIsIFwiYXVkaW9cIiwgXCJiaW5hcnlcIiwgXCJjb250YWluZXJcIixcbiAgICAgKiBcImN1YmVtYXBcIiwgXCJjc3NcIiwgXCJmb250XCIsIFwianNvblwiLCBcImh0bWxcIiwgXCJtYXRlcmlhbFwiLCBcIm1vZGVsXCIsIFwic2NyaXB0XCIsIFwic2hhZGVyXCIsIFwic3ByaXRlXCIsXG4gICAgICogXCJ0ZW1wbGF0ZVwiLCB0ZXh0XCIsIFwidGV4dHVyZVwiLCBcInRleHR1cmVhdGxhc1wiXVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbZmlsZV0gLSBEZXRhaWxzIGFib3V0IHRoZSBmaWxlIHRoZSBhc3NldCBpcyBtYWRlIGZyb20uIEF0IHRoZSBsZWFzdCBtdXN0XG4gICAgICogY29udGFpbiB0aGUgJ3VybCcgZmllbGQuIEZvciBhc3NldHMgdGhhdCBkb24ndCBjb250YWluIGZpbGUgZGF0YSB1c2UgbnVsbC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2ZpbGUudXJsXSAtIFRoZSBVUkwgb2YgdGhlIHJlc291cmNlIGZpbGUgdGhhdCBjb250YWlucyB0aGUgYXNzZXQgZGF0YS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2ZpbGUuZmlsZW5hbWVdIC0gVGhlIGZpbGVuYW1lIG9mIHRoZSByZXNvdXJjZSBmaWxlIG9yIG51bGwgaWYgbm8gZmlsZW5hbWVcbiAgICAgKiB3YXMgc2V0IChlLmcgZnJvbSB1c2luZyB7QGxpbmsgQXNzZXRSZWdpc3RyeSNsb2FkRnJvbVVybH0pLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbZmlsZS5zaXplXSAtIFRoZSBzaXplIG9mIHRoZSByZXNvdXJjZSBmaWxlIG9yIG51bGwgaWYgbm8gc2l6ZSB3YXMgc2V0XG4gICAgICogKGUuZy4gZnJvbSB1c2luZyB7QGxpbmsgQXNzZXRSZWdpc3RyeSNsb2FkRnJvbVVybH0pLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZmlsZS5oYXNoXSAtIFRoZSBNRDUgaGFzaCBvZiB0aGUgcmVzb3VyY2UgZmlsZSBkYXRhIGFuZCB0aGUgQXNzZXQgZGF0YVxuICAgICAqIGZpZWxkIG9yIG51bGwgaWYgaGFzaCB3YXMgc2V0IChlLmcgZnJvbSB1c2luZyB7QGxpbmsgQXNzZXRSZWdpc3RyeSNsb2FkRnJvbVVybH0pLlxuICAgICAqIEBwYXJhbSB7QXJyYXlCdWZmZXJ9IFtmaWxlLmNvbnRlbnRzXSAtIE9wdGlvbmFsIGZpbGUgY29udGVudHMuIFRoaXMgaXMgZmFzdGVyIHRoYW4gd3JhcHBpbmdcbiAgICAgKiB0aGUgZGF0YSBpbiBhIChiYXNlNjQgZW5jb2RlZCkgYmxvYi4gQ3VycmVudGx5IG9ubHkgdXNlZCBieSBjb250YWluZXIgYXNzZXRzLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fHN0cmluZ30gW2RhdGFdIC0gSlNPTiBvYmplY3Qgb3Igc3RyaW5nIHdpdGggYWRkaXRpb25hbCBkYXRhIGFib3V0IHRoZSBhc3NldC5cbiAgICAgKiAoZS5nLiBmb3IgdGV4dHVyZSBhbmQgbW9kZWwgYXNzZXRzKSBvciBjb250YWlucyB0aGUgYXNzZXQgZGF0YSBpdHNlbGYgKGUuZy4gaW4gdGhlIGNhc2Ugb2ZcbiAgICAgKiBtYXRlcmlhbHMpLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBUaGUgYXNzZXQgaGFuZGxlciBvcHRpb25zLiBGb3IgY29udGFpbmVyIG9wdGlvbnMgc2VlXG4gICAgICoge0BsaW5rIENvbnRhaW5lckhhbmRsZXJ9LlxuICAgICAqIEBwYXJhbSB7J2Fub255bW91cyd8J3VzZS1jcmVkZW50aWFscyd8bnVsbH0gW29wdGlvbnMuY3Jvc3NPcmlnaW5dIC0gRm9yIHVzZSB3aXRoIHRleHR1cmUgYXNzZXRzXG4gICAgICogdGhhdCBhcmUgbG9hZGVkIHVzaW5nIHRoZSBicm93c2VyLiBUaGlzIHNldHRpbmcgb3ZlcnJpZGVzIHRoZSBkZWZhdWx0IGNyb3NzT3JpZ2luIHNwZWNpZmllci5cbiAgICAgKiBGb3IgbW9yZSBkZXRhaWxzIG9uIGNyb3NzT3JpZ2luIGFuZCBpdHMgdXNlLCBzZWVcbiAgICAgKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvSFRNTEltYWdlRWxlbWVudC9jcm9zc09yaWdpbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0ID0gbmV3IHBjLkFzc2V0KFwiYSB0ZXh0dXJlXCIsIFwidGV4dHVyZVwiLCB7XG4gICAgICogICAgIHVybDogXCJodHRwOi8vZXhhbXBsZS5jb20vbXkvYXNzZXRzL2hlcmUvdGV4dHVyZS5wbmdcIlxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG5hbWUsIHR5cGUsIGZpbGUsIGRhdGEsIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLl9pZCA9IGFzc2V0SWRDb3VudGVyLS07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBuYW1lIG9mIHRoZSBhc3NldC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWUgfHwgJyc7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0eXBlIG9mIHRoZSBhc3NldC4gT25lIG9mIFtcImFuaW1hdGlvblwiLCBcImF1ZGlvXCIsIFwiYmluYXJ5XCIsIFwiY29udGFpbmVyXCIsIFwiY3ViZW1hcFwiLFxuICAgICAgICAgKiBcImNzc1wiLCBcImZvbnRcIiwgXCJqc29uXCIsIFwiaHRtbFwiLCBcIm1hdGVyaWFsXCIsIFwibW9kZWxcIiwgXCJyZW5kZXJcIiwgXCJzY3JpcHRcIiwgXCJzaGFkZXJcIiwgXCJzcHJpdGVcIixcbiAgICAgICAgICogXCJ0ZW1wbGF0ZVwiLCBcInRleHRcIiwgXCJ0ZXh0dXJlXCIsIFwidGV4dHVyZWF0bGFzXCJdXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHsoXCJhbmltYXRpb25cInxcImF1ZGlvXCJ8XCJiaW5hcnlcInxcImNvbnRhaW5lclwifFwiY3ViZW1hcFwifFwiY3NzXCJ8XCJmb250XCJ8XCJqc29uXCJ8XCJodG1sXCJ8XCJtYXRlcmlhbFwifFwibW9kZWxcInxcInJlbmRlclwifFwic2NyaXB0XCJ8XCJzaGFkZXJcInxcInNwcml0ZVwifFwidGVtcGxhdGVcInxcInRleHRcInxcInRleHR1cmVcInxcInRleHR1cmVhdGxhc1wiKX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFzc2V0IHRhZ3MuIEVuYWJsZXMgZmluZGluZyBvZiBhc3NldHMgYnkgdGFncyB1c2luZyB0aGUge0BsaW5rIEFzc2V0UmVnaXN0cnkjZmluZEJ5VGFnfSBtZXRob2QuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUYWdzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50YWdzID0gbmV3IFRhZ3ModGhpcyk7XG5cbiAgICAgICAgdGhpcy5fcHJlbG9hZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9maWxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5fZGF0YSA9IGRhdGEgfHwgeyB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBPcHRpb25hbCBKU09OIGRhdGEgdGhhdCBjb250YWlucyB0aGUgYXNzZXQgaGFuZGxlciBvcHRpb25zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCB7IH07XG5cbiAgICAgICAgLy8gVGhpcyBpcyB3aGVyZSB0aGUgbG9hZGVkIHJlc291cmNlKHMpIHdpbGwgYmVcbiAgICAgICAgdGhpcy5fcmVzb3VyY2VzID0gW107XG5cbiAgICAgICAgLy8gYSBzdHJpbmctYXNzZXRJZCBkaWN0aW9uYXJ5IHRoYXQgbWFwc1xuICAgICAgICAvLyBsb2NhbGUgdG8gYXNzZXQgaWRcbiAgICAgICAgdGhpcy5faTE4biA9IHt9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSBhc3NldCBoYXMgZmluaXNoZWQgYXR0ZW1wdGluZyB0byBsb2FkIHRoZSByZXNvdXJjZS4gSXQgaXMgbm90IGd1YXJhbnRlZWRcbiAgICAgICAgICogdGhhdCB0aGUgcmVzb3VyY2VzIGFyZSBhdmFpbGFibGUgYXMgdGhlcmUgY291bGQgaGF2ZSBiZWVuIGEgbmV0d29yayBlcnJvci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUcnVlIGlmIHRoZSByZXNvdXJjZSBpcyBjdXJyZW50bHkgYmVpbmcgbG9hZGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9hZGluZyA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXNzZXQgcmVnaXN0cnkgdGhhdCB0aGlzIEFzc2V0IGJlbG9uZ3MgdG8uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYXNzZXQtcmVnaXN0cnkuanMnKS5Bc3NldFJlZ2lzdHJ5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZWdpc3RyeSA9IG51bGw7XG5cbiAgICAgICAgaWYgKGZpbGUpIHRoaXMuZmlsZSA9IGZpbGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgYXNzZXQgaGFzIGNvbXBsZXRlZCBsb2FkaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0I2xvYWRcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBhc3NldCB0aGF0IHdhcyBsb2FkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCBqdXN0IGJlZm9yZSB0aGUgYXNzZXQgdW5sb2FkcyB0aGUgcmVzb3VyY2UuIFRoaXMgYWxsb3dzIGZvciB0aGUgb3Bwb3J0dW5pdHkgdG8gcHJlcGFyZVxuICAgICAqIGZvciBhbiBhc3NldCB0aGF0IHdpbGwgYmUgdW5sb2FkZWQuIEUuZy4gQ2hhbmdpbmcgdGhlIHRleHR1cmUgb2YgYSBtb2RlbCB0byBhIGRlZmF1bHQgYmVmb3JlXG4gICAgICogdGhlIG9uZSBpdCB3YXMgdXNpbmcgaXMgdW5sb2FkZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgQXNzZXQjdW5sb2FkXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdGhhdCBpcyBkdWUgdG8gYmUgdW5sb2FkZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBhc3NldCBpcyByZW1vdmVkIGZyb20gdGhlIGFzc2V0IHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0I3JlbW92ZVxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgd2FzIHJlbW92ZWQuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCBpZiB0aGUgYXNzZXQgZW5jb3VudGVycyBhbiBlcnJvciB3aGlsZSBsb2FkaW5nLlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0I2Vycm9yXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGVyciAtIFRoZSBlcnJvciBtZXNzYWdlLlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIGFzc2V0IHRoYXQgZ2VuZXJhdGVkIHRoZSBlcnJvci5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gb25lIG9mIHRoZSBhc3NldCBwcm9wZXJ0aWVzIGBmaWxlYCwgYGRhdGFgLCBgcmVzb3VyY2VgIG9yIGByZXNvdXJjZXNgIGlzIGNoYW5nZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgQXNzZXQjY2hhbmdlXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgYXNzZXQgdGhhdCB3YXMgbG9hZGVkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eSAtIFRoZSBuYW1lIG9mIHRoZSBwcm9wZXJ0eSB0aGF0IGNoYW5nZWQuXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSAtIFRoZSBuZXcgcHJvcGVydHkgdmFsdWUuXG4gICAgICogQHBhcmFtIHsqfSBvbGRWYWx1ZSAtIFRoZSBvbGQgcHJvcGVydHkgdmFsdWUuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHdlIGFkZCBhIG5ldyBsb2NhbGl6ZWQgYXNzZXQgaWQgdG8gdGhlIGFzc2V0LlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0I2FkZDpsb2NhbGl6ZWRcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbG9jYWxlIC0gVGhlIGxvY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYXNzZXRJZCAtIFRoZSBhc3NldCBpZCB3ZSBhZGRlZC5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gd2UgcmVtb3ZlIGEgbG9jYWxpemVkIGFzc2V0IGlkIGZyb20gdGhlIGFzc2V0LlxuICAgICAqXG4gICAgICogQGV2ZW50IEFzc2V0I3JlbW92ZTpsb2NhbGl6ZWRcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbG9jYWxlIC0gVGhlIGxvY2FsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYXNzZXRJZCAtIFRoZSBhc3NldCBpZCB3ZSByZW1vdmVkLlxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogVGhlIGFzc2V0IGlkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgaWQodmFsdWUpIHtcbiAgICAgICAgdGhpcy5faWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgaWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZmlsZSBkZXRhaWxzIG9yIG51bGwgaWYgbm8gZmlsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICovXG4gICAgc2V0IGZpbGUodmFsdWUpIHtcbiAgICAgICAgLy8gaWYgdmFsdWUgY29udGFpbnMgdmFyaWFudHMsIGNob29zZSB0aGUgY29ycmVjdCB2YXJpYW50IGZpcnN0XG4gICAgICAgIGlmICh2YWx1ZSAmJiB2YWx1ZS52YXJpYW50cyAmJiBbJ3RleHR1cmUnLCAndGV4dHVyZWF0bGFzJywgJ2J1bmRsZSddLmluZGV4T2YodGhpcy50eXBlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIC8vIHNlYXJjaCBmb3IgYWN0aXZlIHZhcmlhbnRcbiAgICAgICAgICAgIGNvbnN0IGFwcCA9IHRoaXMucmVnaXN0cnk/Ll9sb2FkZXI/Ll9hcHAgfHwgZ2V0QXBwbGljYXRpb24oKTtcbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IGFwcD8uZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgICAgICBpZiAoZGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IFZBUklBTlRfREVGQVVMVF9QUklPUklUWS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YXJpYW50ID0gVkFSSUFOVF9ERUZBVUxUX1BSSU9SSVRZW2ldO1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgZGV2aWNlIHN1cHBvcnRzIHRoZSB2YXJpYW50XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZS52YXJpYW50c1t2YXJpYW50XSAmJiBkZXZpY2VbVkFSSUFOVF9TVVBQT1JUW3ZhcmlhbnRdXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS52YXJpYW50c1t2YXJpYW50XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIHZhcmlhbnQgZG9lcyBub3QgZXhpc3QgYnV0IHRoZSBhc3NldCBpcyBpbiBhIGJ1bmRsZVxuICAgICAgICAgICAgICAgICAgICAvLyBhbmQgdGhlIGJ1bmRsZSBjb250YWluIGFzc2V0cyB3aXRoIHRoaXMgdmFyaWFudCB0aGVuIHJldHVybiB0aGUgZGVmYXVsdFxuICAgICAgICAgICAgICAgICAgICAvLyBmaWxlIGZvciB0aGUgYXNzZXRcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFwcC5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBidW5kbGVzID0gYXBwLmJ1bmRsZXMubGlzdEJ1bmRsZXNGb3JBc3NldCh0aGlzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidW5kbGVzICYmIGJ1bmRsZXMuZmluZCgoYikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBiPy5maWxlPy52YXJpYW50c1t2YXJpYW50XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvbGRGaWxlID0gdGhpcy5fZmlsZTtcbiAgICAgICAgY29uc3QgbmV3RmlsZSA9IHZhbHVlID8gbmV3IEFzc2V0RmlsZSh2YWx1ZS51cmwsIHZhbHVlLmZpbGVuYW1lLCB2YWx1ZS5oYXNoLCB2YWx1ZS5zaXplLCB2YWx1ZS5vcHQsIHZhbHVlLmNvbnRlbnRzKSA6IG51bGw7XG5cbiAgICAgICAgaWYgKCEhbmV3RmlsZSAhPT0gISFvbGRGaWxlIHx8IChuZXdGaWxlICYmICFuZXdGaWxlLmVxdWFscyhvbGRGaWxlKSkpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZpbGUgPSBuZXdGaWxlO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdjaGFuZ2UnLCB0aGlzLCAnZmlsZScsIG5ld0ZpbGUsIG9sZEZpbGUpO1xuICAgICAgICAgICAgdGhpcy5yZWxvYWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmaWxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBPcHRpb25hbCBKU09OIGRhdGEgdGhhdCBjb250YWlucyBlaXRoZXIgdGhlIGNvbXBsZXRlIHJlc291cmNlIGRhdGEuIChlLmcuIGluIHRoZSBjYXNlIG9mIGFcbiAgICAgKiBtYXRlcmlhbCkgb3IgYWRkaXRpb25hbCBkYXRhIChlLmcuIGluIHRoZSBjYXNlIG9mIGEgbW9kZWwgaXQgY29udGFpbnMgbWFwcGluZ3MgZnJvbSBtZXNoIHRvXG4gICAgICogbWF0ZXJpYWwpLlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKi9cbiAgICBzZXQgZGF0YSh2YWx1ZSkge1xuICAgICAgICAvLyBmaXJlIGNoYW5nZSBldmVudCB3aGVuIGRhdGEgY2hhbmdlc1xuICAgICAgICAvLyBiZWNhdXNlIHRoZSBhc3NldCBtaWdodCBuZWVkIHJlbG9hZGluZyBpZiB0aGF0IGhhcHBlbnNcbiAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5fZGF0YTtcbiAgICAgICAgdGhpcy5fZGF0YSA9IHZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgIT09IG9sZCkge1xuICAgICAgICAgICAgdGhpcy5maXJlKCdjaGFuZ2UnLCB0aGlzLCAnZGF0YScsIHZhbHVlLCBvbGQpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5sb2FkZWQpXG4gICAgICAgICAgICAgICAgdGhpcy5yZWdpc3RyeS5fbG9hZGVyLnBhdGNoKHRoaXMsIHRoaXMucmVnaXN0cnkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGRhdGEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kYXRhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmVmZXJlbmNlIHRvIHRoZSByZXNvdXJjZSB3aGVuIHRoZSBhc3NldCBpcyBsb2FkZWQuIGUuZy4gYSB7QGxpbmsgVGV4dHVyZX0gb3IgYSB7QGxpbmsgTW9kZWx9LlxuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKi9cbiAgICBzZXQgcmVzb3VyY2UodmFsdWUpIHtcbiAgICAgICAgY29uc3QgX29sZCA9IHRoaXMuX3Jlc291cmNlc1swXTtcbiAgICAgICAgdGhpcy5fcmVzb3VyY2VzWzBdID0gdmFsdWU7XG4gICAgICAgIHRoaXMuZmlyZSgnY2hhbmdlJywgdGhpcywgJ3Jlc291cmNlJywgdmFsdWUsIF9vbGQpO1xuICAgIH1cblxuICAgIGdldCByZXNvdXJjZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc291cmNlc1swXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHJlZmVyZW5jZSB0byB0aGUgcmVzb3VyY2VzIG9mIHRoZSBhc3NldCB3aGVuIGl0J3MgbG9hZGVkLiBBbiBhc3NldCBjYW4gaG9sZCBtb3JlIHJ1bnRpbWVcbiAgICAgKiByZXNvdXJjZXMgdGhhbiBvbmUgZS5nLiBjdWJlbWFwcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtvYmplY3RbXX1cbiAgICAgKi9cbiAgICBzZXQgcmVzb3VyY2VzKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IF9vbGQgPSB0aGlzLl9yZXNvdXJjZXM7XG4gICAgICAgIHRoaXMuX3Jlc291cmNlcyA9IHZhbHVlO1xuICAgICAgICB0aGlzLmZpcmUoJ2NoYW5nZScsIHRoaXMsICdyZXNvdXJjZXMnLCB2YWx1ZSwgX29sZCk7XG4gICAgfVxuXG4gICAgZ2V0IHJlc291cmNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc291cmNlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlIHRoZSBhc3NldCB3aWxsIGJlIGxvYWRlZCBkdXJpbmcgdGhlIHByZWxvYWQgcGhhc2Ugb2YgYXBwbGljYXRpb24gc2V0IHVwLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHByZWxvYWQodmFsdWUpIHtcbiAgICAgICAgdmFsdWUgPSAhIXZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fcHJlbG9hZCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fcHJlbG9hZCA9IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fcHJlbG9hZCAmJiAhdGhpcy5sb2FkZWQgJiYgIXRoaXMubG9hZGluZyAmJiB0aGlzLnJlZ2lzdHJ5KVxuICAgICAgICAgICAgdGhpcy5yZWdpc3RyeS5sb2FkKHRoaXMpO1xuICAgIH1cblxuICAgIGdldCBwcmVsb2FkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJlbG9hZDtcbiAgICB9XG5cbiAgICBzZXQgbG9hZEZhY2VzKHZhbHVlKSB7XG4gICAgICAgIHZhbHVlID0gISF2YWx1ZTtcbiAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KCdfbG9hZEZhY2VzJykgfHwgdmFsdWUgIT09IHRoaXMuX2xvYWRGYWNlcykge1xuICAgICAgICAgICAgdGhpcy5fbG9hZEZhY2VzID0gdmFsdWU7XG5cbiAgICAgICAgICAgIC8vIHRoZSBsb2FkRmFjZXMgcHJvcGVydHkgc2hvdWxkIGJlIHBhcnQgb2YgdGhlIGFzc2V0IGRhdGEgYmxvY2tcbiAgICAgICAgICAgIC8vIGJlY2F1c2UgY2hhbmdpbmcgdGhlIGZsYWcgc2hvdWxkIHJlc3VsdCBpbiBhc3NldCBwYXRjaCBiZWluZyBpbnZva2VkLlxuICAgICAgICAgICAgLy8gaGVyZSB3ZSBtdXN0IGludm9rZSBpdCBtYW51YWxseSBpbnN0ZWFkLlxuICAgICAgICAgICAgaWYgKHRoaXMubG9hZGVkKVxuICAgICAgICAgICAgICAgIHRoaXMucmVnaXN0cnkuX2xvYWRlci5wYXRjaCh0aGlzLCB0aGlzLnJlZ2lzdHJ5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsb2FkRmFjZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sb2FkRmFjZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRoZSBVUkwgcmVxdWlyZWQgdG8gZmV0Y2ggdGhlIGZpbGUgZm9yIHRoaXMgYXNzZXQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IFRoZSBVUkwuIFJldHVybnMgbnVsbCBpZiB0aGUgYXNzZXQgaGFzIG5vIGFzc29jaWF0ZWQgZmlsZS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0cyA9IGFwcC5hc3NldHMuZmluZChcIk15IEltYWdlXCIsIFwidGV4dHVyZVwiKTtcbiAgICAgKiBjb25zdCBpbWcgPSBcIiZsdDtpbWcgc3JjPSdcIiArIGFzc2V0c1swXS5nZXRGaWxlVXJsKCkgKyBcIicmZ3Q7XCI7XG4gICAgICovXG4gICAgZ2V0RmlsZVVybCgpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuZmlsZTtcblxuICAgICAgICBpZiAoIWZpbGUgfHwgIWZpbGUudXJsKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgbGV0IHVybCA9IGZpbGUudXJsO1xuXG4gICAgICAgIGlmICh0aGlzLnJlZ2lzdHJ5ICYmIHRoaXMucmVnaXN0cnkucHJlZml4ICYmICFBQlNPTFVURV9VUkwudGVzdCh1cmwpKVxuICAgICAgICAgICAgdXJsID0gdGhpcy5yZWdpc3RyeS5wcmVmaXggKyB1cmw7XG5cbiAgICAgICAgLy8gYWRkIGZpbGUgaGFzaCB0byBhdm9pZCBoYXJkLWNhY2hpbmcgcHJvYmxlbXNcbiAgICAgICAgaWYgKHRoaXMudHlwZSAhPT0gJ3NjcmlwdCcgJiYgZmlsZS5oYXNoKSB7XG4gICAgICAgICAgICBjb25zdCBzZXBhcmF0b3IgPSB1cmwuaW5kZXhPZignPycpICE9PSAtMSA/ICcmJyA6ICc/JztcbiAgICAgICAgICAgIHVybCArPSBzZXBhcmF0b3IgKyAndD0nICsgZmlsZS5oYXNoO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgYW4gYXNzZXQgVVJMIGZyb20gdGhpcyBhc3NldCdzIGxvY2F0aW9uIGFuZCBhIHJlbGF0aXZlIHBhdGguIElmIHRoZSByZWxhdGl2ZVBhdGhcbiAgICAgKiBpcyBhIGJsb2Igb3IgQmFzZTY0IFVSSSwgdGhlbiByZXR1cm4gdGhhdCBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHJlbGF0aXZlUGF0aCAtIFRoZSByZWxhdGl2ZSBwYXRoIHRvIGJlIGNvbmNhdGVuYXRlZCB0byB0aGlzIGFzc2V0J3MgYmFzZSB1cmwuXG4gICAgICogQHJldHVybnMge3N0cmluZ30gUmVzdWx0aW5nIFVSTCBvZiB0aGUgYXNzZXQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEFic29sdXRlVXJsKHJlbGF0aXZlUGF0aCkge1xuICAgICAgICBpZiAocmVsYXRpdmVQYXRoLnN0YXJ0c1dpdGgoJ2Jsb2I6JykgfHwgcmVsYXRpdmVQYXRoLnN0YXJ0c1dpdGgoJ2RhdGE6JykpIHtcbiAgICAgICAgICAgIHJldHVybiByZWxhdGl2ZVBhdGg7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBiYXNlID0gcGF0aC5nZXREaXJlY3RvcnkodGhpcy5maWxlLnVybCk7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4oYmFzZSwgcmVsYXRpdmVQYXRoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBhc3NldCBpZCBvZiB0aGUgYXNzZXQgdGhhdCBjb3JyZXNwb25kcyB0byB0aGUgc3BlY2lmaWVkIGxvY2FsZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgZGVzaXJlZCBsb2NhbGUgZS5nLiBBci1BUi5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBBbiBhc3NldCBpZCBvciBudWxsIGlmIHRoZXJlIGlzIG5vIGFzc2V0IHNwZWNpZmllZCBmb3IgdGhlIGRlc2lyZWQgbG9jYWxlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRMb2NhbGl6ZWRBc3NldElkKGxvY2FsZSkge1xuICAgICAgICAvLyB0cmllcyB0byBmaW5kIGVpdGhlciB0aGUgZGVzaXJlZCBsb2NhbGUgb3IgYSBmYWxsYmFjayBsb2NhbGVcbiAgICAgICAgbG9jYWxlID0gZmluZEF2YWlsYWJsZUxvY2FsZShsb2NhbGUsIHRoaXMuX2kxOG4pO1xuICAgICAgICByZXR1cm4gdGhpcy5faTE4bltsb2NhbGVdIHx8IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIHJlcGxhY2VtZW50IGFzc2V0IGlkIGZvciB0aGUgc3BlY2lmaWVkIGxvY2FsZS4gV2hlbiB0aGUgbG9jYWxlIGluXG4gICAgICoge0BsaW5rIEFwcGxpY2F0aW9uI2kxOG59IGNoYW5nZXMgdGhlbiByZWZlcmVuY2VzIHRvIHRoaXMgYXNzZXQgd2lsbCBiZSByZXBsYWNlZCB3aXRoIHRoZVxuICAgICAqIHNwZWNpZmllZCBhc3NldCBpZC4gKEN1cnJlbnRseSBvbmx5IHN1cHBvcnRlZCBieSB0aGUge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9KS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbG9jYWxlIGUuZy4gQXItQVIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGFzc2V0SWQgLSBUaGUgYXNzZXQgaWQuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFkZExvY2FsaXplZEFzc2V0SWQobG9jYWxlLCBhc3NldElkKSB7XG4gICAgICAgIHRoaXMuX2kxOG5bbG9jYWxlXSA9IGFzc2V0SWQ7XG4gICAgICAgIHRoaXMuZmlyZSgnYWRkOmxvY2FsaXplZCcsIGxvY2FsZSwgYXNzZXRJZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIGxvY2FsaXplZCBhc3NldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBsb2NhbGUgLSBUaGUgbG9jYWxlIGUuZy4gQXItQVIuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbW92ZUxvY2FsaXplZEFzc2V0SWQobG9jYWxlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0SWQgPSB0aGlzLl9pMThuW2xvY2FsZV07XG4gICAgICAgIGlmIChhc3NldElkKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5faTE4bltsb2NhbGVdO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdyZW1vdmU6bG9jYWxpemVkJywgbG9jYWxlLCBhc3NldElkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRha2UgYSBjYWxsYmFjayB3aGljaCBpcyBjYWxsZWQgYXMgc29vbiBhcyB0aGUgYXNzZXQgaXMgbG9hZGVkLiBJZiB0aGUgYXNzZXQgaXMgYWxyZWFkeVxuICAgICAqIGxvYWRlZCB0aGUgY2FsbGJhY2sgaXMgY2FsbGVkIHN0cmFpZ2h0IGF3YXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0UmVhZHlDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gY2FsbGVkIHdoZW4gdGhlIGFzc2V0IGlzIHJlYWR5LiBQYXNzZWRcbiAgICAgKiB0aGUgKGFzc2V0KSBhcmd1bWVudHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtzY29wZV0gLSBTY29wZSBvYmplY3QgdG8gdXNlIHdoZW4gY2FsbGluZyB0aGUgY2FsbGJhY2suXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhc3NldCA9IGFwcC5hc3NldHMuZmluZChcIk15IEFzc2V0XCIpO1xuICAgICAqIGFzc2V0LnJlYWR5KGZ1bmN0aW9uIChhc3NldCkge1xuICAgICAqICAgLy8gYXNzZXQgbG9hZGVkXG4gICAgICogfSk7XG4gICAgICogYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgKi9cbiAgICByZWFkeShjYWxsYmFjaywgc2NvcGUpIHtcbiAgICAgICAgc2NvcGUgPSBzY29wZSB8fCB0aGlzO1xuXG4gICAgICAgIGlmICh0aGlzLmxvYWRlZCkge1xuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChzY29wZSwgdGhpcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm9uY2UoJ2xvYWQnLCBmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKHNjb3BlLCBhc3NldCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbG9hZCgpIHtcbiAgICAgICAgLy8gbm8gbmVlZCB0byBiZSByZWxvYWRlZFxuICAgICAgICBpZiAodGhpcy5sb2FkZWQpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLnJlZ2lzdHJ5LmxvYWQodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB0aGUgYXNzb2NpYXRlZCByZXNvdXJjZSBhbmQgbWFya3MgYXNzZXQgYXMgdW5sb2FkZWQuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGFzc2V0ID0gYXBwLmFzc2V0cy5maW5kKFwiTXkgQXNzZXRcIik7XG4gICAgICogYXNzZXQudW5sb2FkKCk7XG4gICAgICogLy8gYXNzZXQucmVzb3VyY2UgaXMgbnVsbFxuICAgICAqL1xuICAgIHVubG9hZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmxvYWRlZCAmJiB0aGlzLl9yZXNvdXJjZXMubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuZmlyZSgndW5sb2FkJywgdGhpcyk7XG4gICAgICAgIHRoaXMucmVnaXN0cnkuZmlyZSgndW5sb2FkOicgKyB0aGlzLmlkLCB0aGlzKTtcblxuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLl9yZXNvdXJjZXM7XG5cbiAgICAgICAgLy8gY2xlYXIgcmVzb3VyY2VzIG9uIHRoZSBhc3NldFxuICAgICAgICB0aGlzLnJlc291cmNlcyA9IFtdO1xuICAgICAgICB0aGlzLmxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIHJlbW92ZSByZXNvdXJjZSBmcm9tIGxvYWRlciBjYWNoZVxuICAgICAgICBpZiAodGhpcy5maWxlKSB7XG4gICAgICAgICAgICB0aGlzLnJlZ2lzdHJ5Ll9sb2FkZXIuY2xlYXJDYWNoZSh0aGlzLmdldEZpbGVVcmwoKSwgdGhpcy50eXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlc3Ryb3kgcmVzb3VyY2VzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCByZXNvdXJjZSA9IG9sZFtpXTtcbiAgICAgICAgICAgIGlmIChyZXNvdXJjZSAmJiByZXNvdXJjZS5kZXN0cm95KSB7XG4gICAgICAgICAgICAgICAgcmVzb3VyY2UuZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGVscGVyIGZ1bmN0aW9uIHRvIHJlc29sdmUgYXNzZXQgZmlsZSBkYXRhIGFuZCByZXR1cm4gdGhlIGNvbnRlbnRzIGFzIGFuIEFycmF5QnVmZmVyLiBJZiB0aGVcbiAgICAgKiBhc3NldCBmaWxlIGNvbnRlbnRzIGFyZSBwcmVzZW50LCB0aGF0IGlzIHJldHVybmVkLiBPdGhlcndpc2UgdGhlIGZpbGUgZGF0YSBpcyBiZSBkb3dubG9hZGVkXG4gICAgICogdmlhIGh0dHAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbG9hZFVybCAtIFRoZSBVUkwgYXMgcGFzc2VkIGludG8gdGhlIGhhbmRsZXJcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vaGFuZGxlcnMvbG9hZGVyLmpzJykuUmVzb3VyY2VMb2FkZXJDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgY2FsbGJhY2tcbiAgICAgKiBmdW5jdGlvbiB0byByZWNlaXZlIHJlc3VsdHMuXG4gICAgICogQHBhcmFtIHtBc3NldH0gW2Fzc2V0XSAtIFRoZSBhc3NldFxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhSZXRyaWVzIC0gTnVtYmVyIG9mIHJldHJpZXMgaWYgaHR0cCBkb3dubG9hZCBpcyByZXF1aXJlZFxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGF0aWMgZmV0Y2hBcnJheUJ1ZmZlcihsb2FkVXJsLCBjYWxsYmFjaywgYXNzZXQsIG1heFJldHJpZXMgPSAwKSB7XG4gICAgICAgIGlmIChhc3NldD8uZmlsZT8uY29udGVudHMpIHtcbiAgICAgICAgICAgIC8vIGFzc2V0IGZpbGUgY29udGVudHMgd2VyZSBwcm92aWRlZFxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgYXNzZXQuZmlsZS5jb250ZW50cyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGFzc2V0IGNvbnRlbnRzIG11c3QgYmUgZG93bmxvYWRlZFxuICAgICAgICAgICAgaHR0cC5nZXQobG9hZFVybCwge1xuICAgICAgICAgICAgICAgIGNhY2hlOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJlc3BvbnNlVHlwZTogJ2FycmF5YnVmZmVyJyxcbiAgICAgICAgICAgICAgICByZXRyeTogbWF4UmV0cmllcyA+IDAsXG4gICAgICAgICAgICAgICAgbWF4UmV0cmllczogbWF4UmV0cmllc1xuICAgICAgICAgICAgfSwgY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBBc3NldCB9O1xuIl0sIm5hbWVzIjpbImFzc2V0SWRDb3VudGVyIiwiVkFSSUFOVF9TVVBQT1JUIiwicHZyIiwiZHh0IiwiZXRjMiIsImV0YzEiLCJiYXNpcyIsIlZBUklBTlRfREVGQVVMVF9QUklPUklUWSIsIkFzc2V0IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJuYW1lIiwidHlwZSIsImZpbGUiLCJkYXRhIiwib3B0aW9ucyIsIl9pZCIsInRhZ3MiLCJUYWdzIiwiX3ByZWxvYWQiLCJfZmlsZSIsIl9kYXRhIiwiX3Jlc291cmNlcyIsIl9pMThuIiwibG9hZGVkIiwibG9hZGluZyIsInJlZ2lzdHJ5IiwiaWQiLCJ2YWx1ZSIsInZhcmlhbnRzIiwiaW5kZXhPZiIsIl90aGlzJHJlZ2lzdHJ5IiwiX3RoaXMkcmVnaXN0cnkkX2xvYWRlIiwiYXBwIiwiX2xvYWRlciIsIl9hcHAiLCJnZXRBcHBsaWNhdGlvbiIsImRldmljZSIsImdyYXBoaWNzRGV2aWNlIiwiaSIsImxlbiIsImxlbmd0aCIsInZhcmlhbnQiLCJlbmFibGVCdW5kbGVzIiwiYnVuZGxlcyIsImxpc3RCdW5kbGVzRm9yQXNzZXQiLCJmaW5kIiwiYiIsIl9iJGZpbGUiLCJvbGRGaWxlIiwibmV3RmlsZSIsIkFzc2V0RmlsZSIsInVybCIsImZpbGVuYW1lIiwiaGFzaCIsInNpemUiLCJvcHQiLCJjb250ZW50cyIsImVxdWFscyIsImZpcmUiLCJyZWxvYWQiLCJvbGQiLCJwYXRjaCIsInJlc291cmNlIiwiX29sZCIsInJlc291cmNlcyIsInByZWxvYWQiLCJsb2FkIiwibG9hZEZhY2VzIiwiaGFzT3duUHJvcGVydHkiLCJfbG9hZEZhY2VzIiwiZ2V0RmlsZVVybCIsInByZWZpeCIsIkFCU09MVVRFX1VSTCIsInRlc3QiLCJzZXBhcmF0b3IiLCJnZXRBYnNvbHV0ZVVybCIsInJlbGF0aXZlUGF0aCIsInN0YXJ0c1dpdGgiLCJiYXNlIiwicGF0aCIsImdldERpcmVjdG9yeSIsImpvaW4iLCJnZXRMb2NhbGl6ZWRBc3NldElkIiwibG9jYWxlIiwiZmluZEF2YWlsYWJsZUxvY2FsZSIsImFkZExvY2FsaXplZEFzc2V0SWQiLCJhc3NldElkIiwicmVtb3ZlTG9jYWxpemVkQXNzZXRJZCIsInJlYWR5IiwiY2FsbGJhY2siLCJzY29wZSIsImNhbGwiLCJvbmNlIiwiYXNzZXQiLCJ1bmxvYWQiLCJjbGVhckNhY2hlIiwiZGVzdHJveSIsImZldGNoQXJyYXlCdWZmZXIiLCJsb2FkVXJsIiwibWF4UmV0cmllcyIsIl9hc3NldCRmaWxlIiwic2V0VGltZW91dCIsImh0dHAiLCJnZXQiLCJjYWNoZSIsInJlc3BvbnNlVHlwZSIsInJldHJ5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFZQTtBQUNBLElBQUlBLGNBQWMsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUV2QixNQUFNQyxlQUFlLEdBQUc7QUFDcEJDLEVBQUFBLEdBQUcsRUFBRSwyQkFBMkI7QUFDaENDLEVBQUFBLEdBQUcsRUFBRSwwQkFBMEI7QUFDL0JDLEVBQUFBLElBQUksRUFBRSx5QkFBeUI7QUFDL0JDLEVBQUFBLElBQUksRUFBRSwwQkFBMEI7RUFDaENDLEtBQUssRUFBRSxRQUFRO0FBQ25CLENBQUMsQ0FBQTs7QUFFRCxNQUFNQyx3QkFBd0IsR0FBRyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMs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
