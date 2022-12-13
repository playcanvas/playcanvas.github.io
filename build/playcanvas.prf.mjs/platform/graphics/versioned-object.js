/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Version } from './version.js';

let idCounter = 0;
class VersionedObject {
  constructor() {
    idCounter++;

    this.version = new Version();

    this.version.globalId = idCounter;
  }
  increment() {
    this.version.revision++;
  }
}

export { VersionedObject };
