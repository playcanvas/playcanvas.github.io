/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class ObjectPool {
	constructor(constructorFunc, size) {
		this._pool = [];
		this._count = 0;
		this._constructor = constructorFunc;
		this._resize(size);
	}
	_resize(size) {
		if (size > this._pool.length) {
			for (let i = this._pool.length; i < size; i++) {
				this._pool[i] = new this._constructor();
			}
		}
	}
	allocate() {
		if (this._count >= this._pool.length) {
			this._resize(this._pool.length * 2);
		}
		return this._pool[this._count++];
	}
	freeAll() {
		this._count = 0;
	}
}

export { ObjectPool };
