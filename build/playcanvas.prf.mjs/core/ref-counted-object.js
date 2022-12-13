/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
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
