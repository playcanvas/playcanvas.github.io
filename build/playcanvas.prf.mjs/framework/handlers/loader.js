import '../../core/debug.js';

class ResourceLoader {
	constructor(app) {
		this._handlers = {};
		this._requests = {};
		this._cache = {};
		this._app = app;
	}
	addHandler(type, handler) {
		this._handlers[type] = handler;
		handler._loader = this;
	}
	removeHandler(type) {
		delete this._handlers[type];
	}
	getHandler(type) {
		return this._handlers[type];
	}
	static makeKey(url, type) {
		return `${url}-${type}`;
	}
	load(url, type, callback, asset) {
		const handler = this._handlers[type];
		if (!handler) {
			const err = `No resource handler for asset type: '${type}' when loading [${url}]`;
			callback(err);
			return;
		}
		if (!url) {
			this._loadNull(handler, callback, asset);
			return;
		}
		const key = ResourceLoader.makeKey(url, type);
		if (this._cache[key] !== undefined) {
			callback(null, this._cache[key]);
		} else if (this._requests[key]) {
			this._requests[key].push(callback);
		} else {
			this._requests[key] = [callback];
			const self = this;
			const handleLoad = function handleLoad(err, urlObj) {
				if (err) {
					self._onFailure(key, err);
					return;
				}
				handler.load(urlObj, function (err, data, extra) {
					if (!self._requests[key]) {
						return;
					}
					if (err) {
						self._onFailure(key, err);
						return;
					}
					try {
						self._onSuccess(key, handler.open(urlObj.original, data, asset), extra);
					} catch (e) {
						self._onFailure(key, e);
					}
				}, asset);
			};
			const normalizedUrl = url.split('?')[0];
			if (this._app.enableBundles && this._app.bundles.hasUrl(normalizedUrl)) {
				if (!this._app.bundles.canLoadUrl(normalizedUrl)) {
					handleLoad(`Bundle for ${url} not loaded yet`);
					return;
				}
				this._app.bundles.loadUrl(normalizedUrl, function (err, fileUrlFromBundle) {
					handleLoad(err, {
						load: fileUrlFromBundle,
						original: normalizedUrl
					});
				});
			} else {
				handleLoad(null, {
					load: url,
					original: asset && asset.file.filename || url
				});
			}
		}
	}
	_loadNull(handler, callback, asset) {
		const onLoad = function onLoad(err, data, extra) {
			if (err) {
				callback(err);
			} else {
				try {
					callback(null, handler.open(null, data, asset), extra);
				} catch (e) {
					callback(e);
				}
			}
		};
		handler.load(null, onLoad, asset);
	}
	_onSuccess(key, result, extra) {
		if (result !== null) {
			this._cache[key] = result;
		} else {
			delete this._cache[key];
		}
		for (let i = 0; i < this._requests[key].length; i++) {
			this._requests[key][i](null, result, extra);
		}
		delete this._requests[key];
	}
	_onFailure(key, err) {
		console.error(err);
		if (this._requests[key]) {
			for (let i = 0; i < this._requests[key].length; i++) {
				this._requests[key][i](err);
			}
			delete this._requests[key];
		}
	}
	open(type, data) {
		const handler = this._handlers[type];
		if (!handler) {
			console.warn('No resource handler found for: ' + type);
			return data;
		}
		return handler.open(null, data);
	}
	patch(asset, assets) {
		const handler = this._handlers[asset.type];
		if (!handler) {
			console.warn('No resource handler found for: ' + asset.type);
			return;
		}
		if (handler.patch) {
			handler.patch(asset, assets);
		}
	}
	clearCache(url, type) {
		const key = ResourceLoader.makeKey(url, type);
		delete this._cache[key];
	}
	getFromCache(url, type) {
		const key = ResourceLoader.makeKey(url, type);
		if (this._cache[key]) {
			return this._cache[key];
		}
		return undefined;
	}
	enableRetry(maxRetries = 5) {
		maxRetries = Math.max(0, maxRetries) || 0;
		for (const key in this._handlers) {
			this._handlers[key].maxRetries = maxRetries;
		}
	}
	disableRetry() {
		for (const key in this._handlers) {
			this._handlers[key].maxRetries = 0;
		}
	}
	destroy() {
		this._handlers = {};
		this._requests = {};
		this._cache = {};
	}
}

export { ResourceLoader };
