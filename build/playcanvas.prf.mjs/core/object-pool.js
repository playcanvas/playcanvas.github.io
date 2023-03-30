/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
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
