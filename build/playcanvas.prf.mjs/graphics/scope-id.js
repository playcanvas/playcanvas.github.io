/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { VersionedObject } from './versioned-object.js';

class ScopeId {
  constructor(name) {
    this.name = name;
    this.value = null;
    this.versionObject = new VersionedObject();
  }

  toJSON(key) {
    return undefined;
  }

  setValue(value) {
    this.value = value;
    this.versionObject.increment();
  }

  getValue() {
    return this.value;
  }

}

export { ScopeId };
