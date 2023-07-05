/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
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
