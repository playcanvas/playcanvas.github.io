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
