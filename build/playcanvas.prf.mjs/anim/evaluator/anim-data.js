/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
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
