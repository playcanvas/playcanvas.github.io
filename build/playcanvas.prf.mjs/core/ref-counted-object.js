/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class RefCountedObject {
  constructor() {
    this._refCount = 0;
  }

  incRefCount() {
    this._refCount++;
  }

  decRefCount() {
    this._refCount--;
  }

  get refCount() {
    return this._refCount;
  }

}

export { RefCountedObject };
