class SceneRegistryItem {
  constructor(name, url) {
    this.name = void 0;
    this.url = void 0;
    this.data = null;
    this._loading = false;
    this._onLoadedCallbacks = [];
    this.name = name;
    this.url = url;
  }
  get loaded() {
    return !!this.data;
  }
  get loading() {
    return this._loading;
  }
}

export { SceneRegistryItem };
