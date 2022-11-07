/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class AnimData {
  constructor(components, data) {
    this._components = components;
    this._data = data;
  }

  get components() {
    return this._components;
  }

  get data() {
    return this._data;
  }
}

export { AnimData };
