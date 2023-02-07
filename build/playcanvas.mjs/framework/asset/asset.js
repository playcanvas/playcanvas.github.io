import { path } from '../../core/path.js';
import { Tags } from '../../core/tags.js';
import { EventHandler } from '../../core/event-handler.js';
import { findAvailableLocale } from '../i18n/utils.js';
import { ABSOLUTE_URL } from './constants.js';
import { AssetFile } from './asset-file.js';
import { getApplication } from '../globals.js';
import { http } from '../../platform/net/http.js';

let assetIdCounter = -1;
const VARIANT_SUPPORT = {
	pvr: 'extCompressedTexturePVRTC',
	dxt: 'extCompressedTextureS3TC',
	etc2: 'extCompressedTextureETC',
	etc1: 'extCompressedTextureETC1',
	basis: 'canvas'
};
const VARIANT_DEFAULT_PRIORITY = ['pvr', 'dxt', 'etc2', 'etc1', 'basis'];
class Asset extends EventHandler {
	constructor(name, type, file, data, options) {
		super();
		this._id = assetIdCounter--;
		this.name = name || '';
		this.type = type;
		this.tags = new Tags(this);
		this._preload = false;
		this._file = null;
		this._data = data || {};
		this.options = options || {};
		this._resources = [];
		this._i18n = {};
		this.loaded = false;
		this.loading = false;
		this.registry = null;
		if (file) this.file = file;
	}
	set id(value) {
		this._id = value;
	}
	get id() {
		return this._id;
	}
	set file(value) {
		if (value && value.variants && ['texture', 'textureatlas', 'bundle'].indexOf(this.type) !== -1) {
			var _this$registry, _this$registry$_loade;
			const app = ((_this$registry = this.registry) == null ? void 0 : (_this$registry$_loade = _this$registry._loader) == null ? void 0 : _this$registry$_loade._app) || getApplication();
			const device = app == null ? void 0 : app.graphicsDevice;
			if (device) {
				for (let i = 0, len = VARIANT_DEFAULT_PRIORITY.length; i < len; i++) {
					const variant = VARIANT_DEFAULT_PRIORITY[i];
					if (value.variants[variant] && device[VARIANT_SUPPORT[variant]]) {
						value = value.variants[variant];
						break;
					}
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
	set data(value) {
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
	set resource(value) {
		const _old = this._resources[0];
		this._resources[0] = value;
		this.fire('change', this, 'resource', value, _old);
	}
	get resource() {
		return this._resources[0];
	}
	set resources(value) {
		const _old = this._resources;
		this._resources = value;
		this.fire('change', this, 'resources', value, _old);
	}
	get resources() {
		return this._resources;
	}
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
			if (this.loaded) this.registry._loader.patch(this, this.registry);
		}
	}
	get loadFaces() {
		return this._loadFaces;
	}
	getFileUrl() {
		const file = this.file;
		if (!file || !file.url) return null;
		let url = file.url;
		if (this.registry && this.registry.prefix && !ABSOLUTE_URL.test(url)) url = this.registry.prefix + url;
		if (this.type !== 'script' && file.hash) {
			const separator = url.indexOf('?') !== -1 ? '&' : '?';
			url += separator + 't=' + file.hash;
		}
		return url;
	}
	getAbsoluteUrl(relativePath) {
		if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
			return relativePath;
		}
		const base = path.getDirectory(this.file.url);
		return path.join(base, relativePath);
	}
	getLocalizedAssetId(locale) {
		locale = findAvailableLocale(locale, this._i18n);
		return this._i18n[locale] || null;
	}
	addLocalizedAssetId(locale, assetId) {
		this._i18n[locale] = assetId;
		this.fire('add:localized', locale, assetId);
	}
	removeLocalizedAssetId(locale) {
		const assetId = this._i18n[locale];
		if (assetId) {
			delete this._i18n[locale];
			this.fire('remove:localized', locale, assetId);
		}
	}
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
		if (this.loaded) {
			this.loaded = false;
			this.registry.load(this);
		}
	}
	unload() {
		if (!this.loaded && this._resources.length === 0) return;
		this.fire('unload', this);
		this.registry.fire('unload:' + this.id, this);
		const old = this._resources;
		this.resources = [];
		this.loaded = false;
		if (this.file) {
			this.registry._loader.clearCache(this.getFileUrl(), this.type);
		}
		for (let i = 0; i < old.length; ++i) {
			const resource = old[i];
			if (resource && resource.destroy) {
				resource.destroy();
			}
		}
	}
	static fetchArrayBuffer(loadUrl, callback, asset, maxRetries = 0) {
		var _asset$file;
		if (asset != null && (_asset$file = asset.file) != null && _asset$file.contents) {
			setTimeout(() => {
				callback(null, asset.file.contents);
			});
		} else {
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
