/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class Bundle {
  constructor(files) {
    this._blobUrls = {};

    for (let i = 0, len = files.length; i < len; i++) {
      if (files[i].url) {
        this._blobUrls[files[i].name] = files[i].url;
      }
    }
  }

  hasBlobUrl(url) {
    return !!this._blobUrls[url];
  }

  getBlobUrl(url) {
    return this._blobUrls[url];
  }

  destroy() {
    for (const key in this._blobUrls) {
      URL.revokeObjectURL(this._blobUrls[key]);
    }

    this._blobUrls = null;
  }

}

export { Bundle };
