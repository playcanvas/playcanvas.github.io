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
