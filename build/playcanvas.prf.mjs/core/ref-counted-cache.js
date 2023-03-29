/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class RefCountedCache {
	constructor() {
		this.cache = new Map();
	}
	destroy() {
		this.cache.forEach((refCount, object) => {
			object.destroy();
		});
		this.cache.clear();
	}
	incRef(object) {
		const refCount = (this.cache.get(object) || 0) + 1;
		this.cache.set(object, refCount);
	}
	decRef(object) {
		if (object) {
			let refCount = this.cache.get(object);
			if (refCount) {
				refCount--;
				if (refCount === 0) {
					this.cache.delete(object);
					object.destroy();
				} else {
					this.cache.set(object, refCount);
				}
			}
		}
	}
}

export { RefCountedCache };
