class AssetReference {
	constructor(propertyName, parent, registry, callbacks, scope) {
		this.propertyName = propertyName;
		this.parent = parent;
		this._scope = scope;
		this._registry = registry;
		this.id = null;
		this.url = null;
		this.asset = null;
		this._onAssetLoad = callbacks.load;
		this._onAssetAdd = callbacks.add;
		this._onAssetRemove = callbacks.remove;
		this._onAssetUnload = callbacks.unload;
	}
	set id(value) {
		if (this.url) throw Error('Can\'t set id and url');
		this._unbind();
		this._id = value;
		this.asset = this._registry.get(this._id);
		this._bind();
	}
	get id() {
		return this._id;
	}
	set url(value) {
		if (this.id) throw Error('Can\'t set id and url');
		this._unbind();
		this._url = value;
		this.asset = this._registry.getByUrl(this._url);
		this._bind();
	}
	get url() {
		return this._url;
	}
	_bind() {
		if (this.id) {
			if (this._onAssetLoad) this._registry.on('load:' + this.id, this._onLoad, this);
			if (this._onAssetAdd) this._registry.once('add:' + this.id, this._onAdd, this);
			if (this._onAssetRemove) this._registry.on('remove:' + this.id, this._onRemove, this);
			if (this._onAssetUnload) this._registry.on('unload:' + this.id, this._onUnload, this);
		}
		if (this.url) {
			if (this._onAssetLoad) this._registry.on('load:url:' + this.url, this._onLoad, this);
			if (this._onAssetAdd) this._registry.once('add:url:' + this.url, this._onAdd, this);
			if (this._onAssetRemove) this._registry.on('remove:url:' + this.url, this._onRemove, this);
		}
	}
	_unbind() {
		if (this.id) {
			if (this._onAssetLoad) this._registry.off('load:' + this.id, this._onLoad, this);
			if (this._onAssetAdd) this._registry.off('add:' + this.id, this._onAdd, this);
			if (this._onAssetRemove) this._registry.off('remove:' + this.id, this._onRemove, this);
			if (this._onAssetUnload) this._registry.off('unload:' + this.id, this._onUnload, this);
		}
		if (this.url) {
			if (this._onAssetLoad) this._registry.off('load:' + this.url, this._onLoad, this);
			if (this._onAssetAdd) this._registry.off('add:' + this.url, this._onAdd, this);
			if (this._onAssetRemove) this._registry.off('remove:' + this.url, this._onRemove, this);
		}
	}
	_onLoad(asset) {
		this._onAssetLoad.call(this._scope, this.propertyName, this.parent, asset);
	}
	_onAdd(asset) {
		this.asset = asset;
		this._onAssetAdd.call(this._scope, this.propertyName, this.parent, asset);
	}
	_onRemove(asset) {
		this._onAssetRemove.call(this._scope, this.propertyName, this.parent, asset);
		this.asset = null;
	}
	_onUnload(asset) {
		this._onAssetUnload.call(this._scope, this.propertyName, this.parent, asset);
	}
}

export { AssetReference };
