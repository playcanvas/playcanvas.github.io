/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
