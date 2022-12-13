/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class FolderHandler {
  constructor() {
    this.handlerType = "folder";
  }
  load(url, callback) {
    callback(null, null);
  }
  open(url, data) {
    return data;
  }
}

export { FolderHandler };
