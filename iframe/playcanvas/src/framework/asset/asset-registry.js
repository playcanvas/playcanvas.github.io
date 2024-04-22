import { path } from '../../core/path.js';
import { EventHandler } from '../../core/event-handler.js';
import { TagsCache } from '../../core/tags-cache.js';
import { standardMaterialTextureParameters } from '../../scene/materials/standard-material-parameters.js';
import { script } from '../script.js';
import { Asset } from './asset.js';

class AssetRegistry extends EventHandler {
  constructor(loader) {
    super();
    this._assets = new Set();
    this._idToAsset = new Map();
    this._urlToAsset = new Map();
    this._nameToAsset = new Map();
    this._tags = new TagsCache('_id');
    this.prefix = null;
    this.bundles = null;
    this._loader = loader;
  }
  list(filters = {}) {
    const assets = Array.from(this._assets);
    if (filters.preload !== undefined) {
      return assets.filter(asset => asset.preload === filters.preload);
    }
    return assets;
  }
  add(asset) {
    var _asset$file, _asset$file2;
    if (this._assets.has(asset)) return;
    this._assets.add(asset);
    this._idToAsset.set(asset.id, asset);
    if ((_asset$file = asset.file) != null && _asset$file.url) {
      this._urlToAsset.set(asset.file.url, asset);
    }
    if (!this._nameToAsset.has(asset.name)) this._nameToAsset.set(asset.name, new Set());
    this._nameToAsset.get(asset.name).add(asset);
    asset.on('name', this._onNameChange, this);
    asset.registry = this;
    this._tags.addItem(asset);
    asset.tags.on('add', this._onTagAdd, this);
    asset.tags.on('remove', this._onTagRemove, this);
    this.fire('add', asset);
    this.fire('add:' + asset.id, asset);
    if ((_asset$file2 = asset.file) != null && _asset$file2.url) {
      this.fire('add:url:' + asset.file.url, asset);
    }
    if (asset.preload) this.load(asset);
  }
  remove(asset) {
    var _asset$file3, _asset$file4;
    if (!this._assets.has(asset)) return false;
    this._assets.delete(asset);
    this._idToAsset.delete(asset.id);
    if ((_asset$file3 = asset.file) != null && _asset$file3.url) {
      this._urlToAsset.delete(asset.file.url);
    }
    asset.off('name', this._onNameChange, this);
    if (this._nameToAsset.has(asset.name)) {
      const items = this._nameToAsset.get(asset.name);
      items.delete(asset);
      if (items.size === 0) {
        this._nameToAsset.delete(asset.name);
      }
    }
    this._tags.removeItem(asset);
    asset.tags.off('add', this._onTagAdd, this);
    asset.tags.off('remove', this._onTagRemove, this);
    asset.fire('remove', asset);
    this.fire('remove', asset);
    this.fire('remove:' + asset.id, asset);
    if ((_asset$file4 = asset.file) != null && _asset$file4.url) {
      this.fire('remove:url:' + asset.file.url, asset);
    }
    return true;
  }
  get(id) {
    return this._idToAsset.get(Number(id));
  }
  getByUrl(url) {
    return this._urlToAsset.get(url);
  }
  load(asset, options) {
    if ((asset.loading || asset.loaded) && !(options != null && options.force)) {
      return;
    }
    const file = asset.file;
    const _fireLoad = () => {
      this.fire('load', asset);
      this.fire('load:' + asset.id, asset);
      if (file && file.url) this.fire('load:url:' + file.url, asset);
      asset.fire('load', asset);
    };
    const _opened = resource => {
      if (resource instanceof Array) {
        asset.resources = resource;
      } else {
        asset.resource = resource;
      }
      this._loader.patch(asset, this);
      if (asset.type === 'bundle') {
        const assetIds = asset.data.assets;
        for (let i = 0; i < assetIds.length; i++) {
          const assetInBundle = this._idToAsset.get(assetIds[i]);
          if (assetInBundle && !assetInBundle.loaded) {
            this.load(assetInBundle, {
              force: true
            });
          }
        }
        if (asset.resource.loaded) {
          _fireLoad();
        } else {
          this.fire('load:start', asset);
          this.fire('load:start:' + asset.id, asset);
          if (file && file.url) this.fire('load:start:url:' + file.url, asset);
          asset.fire('load:start', asset);
          asset.resource.on('load', _fireLoad);
        }
      } else {
        _fireLoad();
      }
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
      const fileUrl = asset.getFileUrl();
      if (asset.type === 'bundle') {
        const assetIds = asset.data.assets;
        for (let i = 0; i < assetIds.length; i++) {
          const assetInBundle = this._idToAsset.get(assetIds[i]);
          if (!assetInBundle) continue;
          if (assetInBundle.loaded || assetInBundle.resource || assetInBundle.loading) continue;
          assetInBundle.loading = true;
        }
      }
      this._loader.load(fileUrl, asset.type, _loaded, asset, options);
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
  _onTagAdd(tag, asset) {
    this._tags.add(tag, asset);
  }
  _onTagRemove(tag, asset) {
    this._tags.remove(tag, asset);
  }
  _onNameChange(asset, name, nameOld) {
    if (this._nameToAsset.has(nameOld)) {
      const items = this._nameToAsset.get(nameOld);
      items.delete(asset);
      if (items.size === 0) {
        this._nameToAsset.delete(nameOld);
      }
    }
    if (!this._nameToAsset.has(asset.name)) this._nameToAsset.set(asset.name, new Set());
    this._nameToAsset.get(asset.name).add(asset);
  }
  findByTag() {
    return this._tags.find(arguments);
  }
  filter(callback) {
    return Array.from(this._assets).filter(asset => callback(asset));
  }
  find(name, type) {
    const items = this._nameToAsset.get(name);
    if (!items) return null;
    for (const asset of items) {
      if (!type || asset.type === type) {
        return asset;
      }
    }
    return null;
  }
  findAll(name, type) {
    const items = this._nameToAsset.get(name);
    if (!items) return [];
    const results = Array.from(items);
    if (!type) return results;
    return results.filter(asset => asset.type === type);
  }
}
AssetRegistry.EVENT_LOAD = 'load';
AssetRegistry.EVENT_ADD = 'add';
AssetRegistry.EVENT_REMOVE = 'remove';
AssetRegistry.EVENT_ERROR = 'error';

export { AssetRegistry };
