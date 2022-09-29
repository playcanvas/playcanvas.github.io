/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { RefCountedCache } from '../../core/ref-counted-cache.js';

class LightmapCache {
  static incRef(texture) {
    this.cache.incRef(texture);
  }

  static decRef(texture) {
    this.cache.decRef(texture);
  }

  static destroy() {
    this.cache.destroy();
  }

}

LightmapCache.cache = new RefCountedCache();

export { LightmapCache };
