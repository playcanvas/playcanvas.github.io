/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class ResourceHandler {
  load(url, callback, asset) {
    throw new Error('not implemented');
  }

  open(url, data, asset) {
    throw new Error('not implemented');
  }

  patch(asset, assets) {}

}

export { ResourceHandler };
