class IndexedList {
	constructor() {
		this._list = [];
		this._index = {};
	}
	push(key, item) {
		if (this._index[key]) {
			throw Error('Key already in index ' + key);
		}
		const location = this._list.push(item) - 1;
		this._index[key] = location;
	}
	has(key) {
		return this._index[key] !== undefined;
	}
	get(key) {
		const location = this._index[key];
		if (location !== undefined) {
			return this._list[location];
		}
		return null;
	}
	remove(key) {
		const location = this._index[key];
		if (location !== undefined) {
			this._list.splice(location, 1);
			delete this._index[key];
			for (key in this._index) {
				const idx = this._index[key];
				if (idx > location) {
					this._index[key] = idx - 1;
				}
			}
			return true;
		}
		return false;
	}
	list() {
		return this._list;
	}
	clear() {
		this._list.length = 0;
		for (const prop in this._index) {
			delete this._index[prop];
		}
	}
}

export { IndexedList };
