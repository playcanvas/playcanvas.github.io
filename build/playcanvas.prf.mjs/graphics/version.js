/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class Version {
  constructor() {
    this.globalId = 0;
    this.revision = 0;
  }

  equals(other) {
    return this.globalId === other.globalId && this.revision === other.revision;
  }

  copy(other) {
    this.globalId = other.globalId;
    this.revision = other.revision;
  }

  reset() {
    this.globalId = 0;
    this.revision = 0;
  }

}

export { Version };
