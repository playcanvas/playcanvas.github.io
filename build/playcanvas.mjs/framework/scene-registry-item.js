class SceneRegistryItem {
	constructor(name, url) {
		this.name = name;
		this.url = url;
		this.data = null;
		this._loading = false;
		this._onLoadedCallbacks = [];
	}
	get loaded() {
		return !!this.data;
	}
	get loading() {
		return this._loading;
	}
}

export { SceneRegistryItem };
