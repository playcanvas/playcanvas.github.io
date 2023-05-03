class AnimData {
	constructor(components, data) {
		this._components = components;
		this._data = data;
	}
	get components() {
		return this._components;
	}
	get data() {
		return this._data;
	}
}

export { AnimData };
