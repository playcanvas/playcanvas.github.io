class BundleRegistry {
	constructor(assets) {
		this._assets = assets;
		this._bundleAssets = {};
		this._assetsInBundles = {};
		this._urlsInBundles = {};
		this._fileRequests = {};
		this._assets.on('add', this._onAssetAdded, this);
		this._assets.on('remove', this._onAssetRemoved, this);
	}
	_onAssetAdded(asset) {
		if (asset.type === 'bundle') {
			this._bundleAssets[asset.id] = asset;
			this._registerBundleEventListeners(asset.id);
			for (let i = 0, len = asset.data.assets.length; i < len; i++) {
				this._indexAssetInBundle(asset.data.assets[i], asset);
			}
		} else {
			if (this._assetsInBundles[asset.id]) {
				this._indexAssetFileUrls(asset);
			}
		}
	}
	_registerBundleEventListeners(bundleAssetId) {
		this._assets.on('load:' + bundleAssetId, this._onBundleLoaded, this);
		this._assets.on('error:' + bundleAssetId, this._onBundleError, this);
	}
	_unregisterBundleEventListeners(bundleAssetId) {
		this._assets.off('load:' + bundleAssetId, this._onBundleLoaded, this);
		this._assets.off('error:' + bundleAssetId, this._onBundleError, this);
	}
	_indexAssetInBundle(assetId, bundleAsset) {
		if (!this._assetsInBundles[assetId]) {
			this._assetsInBundles[assetId] = [bundleAsset];
		} else {
			const bundles = this._assetsInBundles[assetId];
			const idx = bundles.indexOf(bundleAsset);
			if (idx === -1) {
				bundles.push(bundleAsset);
			}
		}
		const asset = this._assets.get(assetId);
		if (asset) {
			this._indexAssetFileUrls(asset);
		}
	}
	_indexAssetFileUrls(asset) {
		const urls = this._getAssetFileUrls(asset);
		if (!urls) return;
		for (let i = 0, len = urls.length; i < len; i++) {
			const url = urls[i];
			this._urlsInBundles[url] = this._assetsInBundles[asset.id];
		}
	}
	_getAssetFileUrls(asset) {
		let url = asset.getFileUrl();
		if (!url) return null;
		url = this._normalizeUrl(url);
		const urls = [url];
		if (asset.type === 'font') {
			const numFiles = asset.data.info.maps.length;
			for (let i = 1; i < numFiles; i++) {
				urls.push(url.replace('.png', i + '.png'));
			}
		}
		return urls;
	}
	_normalizeUrl(url) {
		return url && url.split('?')[0];
	}
	_onAssetRemoved(asset) {
		if (asset.type === 'bundle') {
			delete this._bundleAssets[asset.id];
			this._unregisterBundleEventListeners(asset.id);
			for (const id in this._assetsInBundles) {
				const array = this._assetsInBundles[id];
				const idx = array.indexOf(asset);
				if (idx !== -1) {
					array.splice(idx, 1);
					if (!array.length) {
						delete this._assetsInBundles[id];
						for (const url in this._urlsInBundles) {
							if (this._urlsInBundles[url] === array) {
								delete this._urlsInBundles[url];
							}
						}
					}
				}
			}
			this._onBundleError(`Bundle ${asset.id} was removed`, asset);
		} else if (this._assetsInBundles[asset.id]) {
			delete this._assetsInBundles[asset.id];
			const urls = this._getAssetFileUrls(asset);
			for (let i = 0, len = urls.length; i < len; i++) {
				delete this._urlsInBundles[urls[i]];
			}
		}
	}
	_onBundleLoaded(bundleAsset) {
		if (!bundleAsset.resource) {
			this._onBundleError(`Bundle ${bundleAsset.id} failed to load`, bundleAsset);
			return;
		}
		requestAnimationFrame(() => {
			if (!this._fileRequests) {
				return;
			}
			for (const url in this._fileRequests) {
				const bundles = this._urlsInBundles[url];
				if (!bundles || bundles.indexOf(bundleAsset) === -1) continue;
				const decodedUrl = decodeURIComponent(url);
				let err = null;
				if (!bundleAsset.resource.hasBlobUrl(decodedUrl)) {
					err = `Bundle ${bundleAsset.id} does not contain URL ${url}`;
				}
				const requests = this._fileRequests[url];
				for (let i = 0, len = requests.length; i < len; i++) {
					if (err) {
						requests[i](err);
					} else {
						requests[i](null, bundleAsset.resource.getBlobUrl(decodedUrl));
					}
				}
				delete this._fileRequests[url];
			}
		});
	}
	_onBundleError(err, bundleAsset) {
		for (const url in this._fileRequests) {
			const bundle = this._findLoadedOrLoadingBundleForUrl(url);
			if (!bundle) {
				const requests = this._fileRequests[url];
				for (let i = 0, len = requests.length; i < len; i++) {
					requests[i](err);
				}
				delete this._fileRequests[url];
			}
		}
	}
	_findLoadedOrLoadingBundleForUrl(url) {
		const bundles = this._urlsInBundles[url];
		if (!bundles) return null;
		const len = bundles.length;
		for (let i = 0; i < len; i++) {
			if (bundles[i].loaded && bundles[i].resource) {
				return bundles[i];
			}
		}
		for (let i = 0; i < len; i++) {
			if (bundles[i].loading) {
				return bundles[i];
			}
		}
		return null;
	}
	listBundlesForAsset(asset) {
		return this._assetsInBundles[asset.id] || null;
	}
	list() {
		const result = [];
		for (const id in this._bundleAssets) {
			result.push(this._bundleAssets[id]);
		}
		return result;
	}
	hasUrl(url) {
		return !!this._urlsInBundles[url];
	}
	canLoadUrl(url) {
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
			if (!bundle.resource.hasBlobUrl(decodedUrl)) {
				callback(`Bundle ${bundle.id} does not contain URL ${url}`);
				return;
			}
			callback(null, bundle.resource.getBlobUrl(decodedUrl));
		} else if (this._fileRequests.hasOwnProperty(url)) {
			this._fileRequests[url].push(callback);
		} else {
			this._fileRequests[url] = [callback];
		}
	}
	destroy() {
		this._assets.off('add', this._onAssetAdded, this);
		this._assets.off('remove', this._onAssetRemoved, this);
		for (const id in this._bundleAssets) {
			this._unregisterBundleEventListeners(id);
		}
		this._assets = null;
		this._bundleAssets = null;
		this._assetsInBundles = null;
		this._urlsInBundles = null;
		this._fileRequests = null;
	}
}

export { BundleRegistry };
