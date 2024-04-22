class BundleRegistry {
  constructor(assets) {
    this._idToBundle = new Map();
    this._assetToBundles = new Map();
    this._urlsToBundles = new Map();
    this._fileRequests = new Map();
    this._assets = assets;
    this._assets.bundles = this;
    this._assets.on('add', this._onAssetAdd, this);
    this._assets.on('remove', this._onAssetRemove, this);
  }
  _onAssetAdd(asset) {
    if (asset.type === 'bundle') {
      this._idToBundle.set(asset.id, asset);
      this._assets.on(`load:start:${asset.id}`, this._onBundleLoadStart, this);
      this._assets.on(`load:${asset.id}`, this._onBundleLoad, this);
      this._assets.on(`error:${asset.id}`, this._onBundleError, this);
      const assetIds = asset.data.assets;
      for (let i = 0; i < assetIds.length; i++) {
        this._indexAssetInBundle(assetIds[i], asset);
      }
    } else {
      if (this._assetToBundles.has(asset.id)) {
        this._indexAssetFileUrls(asset);
      }
    }
  }
  _unbindAssetEvents(id) {
    this._assets.off('load:start:' + id, this._onBundleLoadStart, this);
    this._assets.off('load:' + id, this._onBundleLoad, this);
    this._assets.off('error:' + id, this._onBundleError, this);
  }
  _indexAssetInBundle(id, bundle) {
    let bundles = this._assetToBundles.get(id);
    if (!bundles) {
      bundles = new Set();
      this._assetToBundles.set(id, bundles);
    }
    bundles.add(bundle);
    const asset = this._assets.get(id);
    if (asset) this._indexAssetFileUrls(asset);
  }
  _indexAssetFileUrls(asset) {
    const urls = this._getAssetFileUrls(asset);
    if (!urls) return;
    for (let i = 0; i < urls.length; i++) {
      const bundles = this._assetToBundles.get(asset.id);
      if (!bundles) continue;
      this._urlsToBundles.set(urls[i], bundles);
    }
  }
  _getAssetFileUrls(asset) {
    let url = asset.getFileUrl();
    if (!url) return null;
    url = url.split('?')[0];
    const urls = [url];
    if (asset.type === 'font') {
      const numFiles = asset.data.info.maps.length;
      for (let i = 1; i < numFiles; i++) {
        urls.push(url.replace('.png', i + '.png'));
      }
    }
    return urls;
  }
  _onAssetRemove(asset) {
    if (asset.type === 'bundle') {
      this._idToBundle.delete(asset.id);
      this._unbindAssetEvents(asset.id);
      const assetIds = asset.data.assets;
      for (let i = 0; i < assetIds.length; i++) {
        const bundles = this._assetToBundles.get(assetIds[i]);
        if (!bundles) continue;
        bundles.delete(asset);
        if (bundles.size === 0) {
          this._assetToBundles.delete(assetIds[i]);
          for (const [url, otherBundles] of this._urlsToBundles) {
            if (otherBundles !== bundles) continue;
            this._urlsToBundles.delete(url);
          }
        }
      }
      this._onBundleError(`Bundle ${asset.id} was removed`);
    } else {
      const bundles = this._assetToBundles.get(asset.id);
      if (!bundles) return;
      this._assetToBundles.delete(asset.id);
      const urls = this._getAssetFileUrls(asset);
      if (!urls) return;
      for (let i = 0; i < urls.length; i++) {
        this._urlsToBundles.delete(urls[i]);
      }
    }
  }
  _onBundleLoadStart(asset) {
    asset.resource.on('add', (url, data) => {
      const callbacks = this._fileRequests.get(url);
      if (!callbacks) return;
      for (let i = 0; i < callbacks.length; i++) {
        callbacks[i](null, data);
      }
      this._fileRequests.delete(url);
    });
  }
  _onBundleLoad(asset) {
    if (!asset.resource) {
      this._onBundleError(`Bundle ${asset.id} failed to load`);
      return;
    }
    if (!this._fileRequests) return;
    for (const [url, requests] of this._fileRequests) {
      const bundles = this._urlsToBundles.get(url);
      if (!bundles || !bundles.has(asset)) continue;
      const decodedUrl = decodeURIComponent(url);
      let err, data;
      if (asset.resource.has(decodedUrl)) {
        data = asset.resource.get(decodedUrl);
      } else if (asset.resource.loaded) {
        err = `Bundle ${asset.id} does not contain URL ${url}`;
      } else {
        continue;
      }
      for (let i = 0; i < requests.length; i++) {
        requests[i](err, err || data);
      }
      this._fileRequests.delete(url);
    }
  }
  _onBundleError(err) {
    for (const [url, requests] of this._fileRequests) {
      const bundle = this._findLoadedOrLoadingBundleForUrl(url);
      if (!bundle) {
        for (let i = 0; i < requests.length; i++) requests[i](err);
        this._fileRequests.delete(url);
      }
    }
  }
  _findLoadedOrLoadingBundleForUrl(url) {
    const bundles = this._urlsToBundles.get(url);
    if (!bundles) return null;
    let candidate = null;
    for (const bundle of bundles) {
      if (bundle.loaded && bundle.resource) {
        return bundle;
      } else if (bundle.loading) {
        candidate = bundle;
      }
    }
    return candidate;
  }
  listBundlesForAsset(asset) {
    const bundles = this._assetToBundles.get(asset.id);
    if (bundles) return Array.from(bundles);
    return null;
  }
  list() {
    return Array.from(this._idToBundle.values());
  }
  hasUrl(url) {
    return this._urlsToBundles.has(url);
  }
  urlIsLoadedOrLoading(url) {
    return !!this._findLoadedOrLoadingBundleForUrl(url);
  }
  loadUrl(url, callback) {
    const bundle = this._findLoadedOrLoadingBundleForUrl(url);
    if (!bundle) {
      callback(`URL ${url} not found in any bundles`);
      return;
    }
    if (bundle.loaded) {
      const decodedUrl = decodeURIComponent(url);
      if (bundle.resource.has(decodedUrl)) {
        callback(null, bundle.resource.get(decodedUrl));
        return;
      } else if (bundle.resource.loaded) {
        callback(`Bundle ${bundle.id} does not contain URL ${url}`);
        return;
      }
    }
    let callbacks = this._fileRequests.get(url);
    if (!callbacks) {
      callbacks = [];
      this._fileRequests.set(url, callbacks);
    }
    callbacks.push(callback);
  }
  destroy() {
    this._assets.off('add', this._onAssetAdd, this);
    this._assets.off('remove', this._onAssetRemove, this);
    for (const id of this._idToBundle.keys()) {
      this._unbindAssetEvents(id);
    }
    this._assets = null;
    this._idToBundle.clear();
    this._idToBundle = null;
    this._assetToBundles.clear();
    this._assetToBundles = null;
    this._urlsToBundles.clear();
    this._urlsToBundles = null;
    this._fileRequests.clear();
    this._fileRequests = null;
  }
}

export { BundleRegistry };
