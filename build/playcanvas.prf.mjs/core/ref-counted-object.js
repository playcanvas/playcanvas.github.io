/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
