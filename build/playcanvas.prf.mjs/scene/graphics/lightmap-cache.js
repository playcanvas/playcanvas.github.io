/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
