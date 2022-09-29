/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
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
