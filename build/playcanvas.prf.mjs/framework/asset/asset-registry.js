import { path } from '../../core/path.js';
import '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { TagsCache } from '../../core/tags-cache.js';
import { standardMaterialTextureParameters } from '../../scene/materials/standard-material-parameters.js';
import { script } from '../script.js';
import { Asset } from './asset.js';

class AssetRegistry extends EventHandler {
	constructor(loader) {
		super();
		this._loader = loader;
		this._assets = [];
		this._cache = {};
		this._names = {};
		this._tags = new TagsCache('_id');
		this._urls = {};
		this.prefix = null;
	}
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
	add(asset) {
		const index = this._assets.push(asset) - 1;
		let url;
		this._cache[asset.id] = index;
		if (!this._names[asset.name]) this._names[asset.name] = [];
		this._names[asset.name].push(index);
		if (asset.file) {
			url = asset.file.url;
			this._urls[url] = index;
		}
		asset.registry = this;
		this._tags.addItem(asset);
		asset.tags.on('add', this._onTagAdd, this);
		asset.tags.on('remove', this._onTagRemove, this);
		this.fire('add', asset);
		this.fire('add:' + asset.id, asset);
		if (url) this.fire('add:url:' + url, asset);
		if (asset.preload) this.load(asset);
	}
	remove(asset) {
		const idx = this._cache[asset.id];
		const url = asset.file ? asset.file.url : null;
		if (idx !== undefined) {
			this._assets.splice(idx, 1);
			delete this._cache[asset.id];
			this._names = {};
			this._urls = [];
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
			this._tags.removeItem(asset);
			asset.tags.off('add', this._onTagAdd, this);
			asset.tags.off('remove', this._onTagRemove, this);
			asset.fire('remove', asset);
			this.fire('remove', asset);
			this.fire('remove:' + asset.id, asset);
			if (url) this.fire('remove:url:' + url, asset);
			return true;
		}
		return false;
	}
	get(id) {
		const idx = this._cache[id];
		return this._assets[idx];
	}
	getByUrl(url) {
		const idx = this._urls[url];
		return this._assets[idx];
	}
	load(asset) {
		if (asset.loading || asset.loaded) {
			return;
		}
		const file = asset.file;
		const _opened = resource => {
			if (resource instanceof Array) {
				asset.resources = resource;
			} else {
				asset.resource = resource;
			}
			this._loader.patch(asset, this);
			this.fire('load', asset);
			this.fire('load:' + asset.id, asset);
			if (file && file.url) this.fire('load:url:' + file.url, asset);
			asset.fire('load', asset);
		};
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
						document.head.removeChild(handler._cache[asset.id]);
					}
					handler._cache[asset.id] = extra;
				}
				_opened(resource);
			}
		};
		if (file || asset.type === 'cubemap') {
			this.fire('load:start', asset);
			this.fire('load:' + asset.id + ':start', asset);
			asset.loading = true;
			this._loader.load(asset.getFileUrl(), asset.type, _loaded, asset);
		} else {
			const resource = this._loader.open(asset.type, asset.data);
			asset.loaded = true;
			_opened(resource);
		}
	}
	loadFromUrl(url, type, callback) {
		this.loadFromUrlAndFilename(url, null, type, callback);
	}
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
	_loadModel(modelAsset, continuation) {
		const url = modelAsset.getFileUrl();
		const ext = path.getExtension(url);
		if (ext === '.json' || ext === '.glb') {
			const dir = path.getDirectory(url);
			const basename = path.getBasename(url);
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
			continuation(modelAsset);
		}
	}
	_loadMaterials(modelAsset, mapping, callback) {
		const materials = [];
		let count = 0;
		const onMaterialLoaded = (err, materialAsset) => {
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
	_loadTextures(materialAsset, callback) {
		const textures = [];
		let count = 0;
		const data = materialAsset.data;
		if (data.mappingFormat !== 'path') {
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
	findByTag() {
		return this._tags.find(arguments);
	}
	filter(callback) {
		return this._assets.filter(asset => callback(asset));
	}
	find(name, type) {
		const asset = this.findAll(name, type);
		return asset.length > 0 ? asset[0] : null;
	}
}

export { AssetRegistry };
