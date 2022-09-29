/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
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
