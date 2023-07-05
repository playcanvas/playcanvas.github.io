class AnimTarget {
	constructor(func, type, components, targetPath) {
		if (func.set) {
			this._set = func.set;
			this._get = func.get;
		} else {
			this._set = func;
		}
		this._type = type;
		this._components = components;
		this._targetPath = targetPath;
		this._isTransform = this._targetPath.substring(this._targetPath.length - 13) === 'localRotation' || this._targetPath.substring(this._targetPath.length - 13) === 'localPosition' || this._targetPath.substring(this._targetPath.length - 10) === 'localScale';
	}
	get set() {
		return this._set;
	}
	get get() {
		return this._get;
	}
	get type() {
		return this._type;
	}
	get components() {
		return this._components;
	}
	get targetPath() {
		return this._targetPath;
	}
	get isTransform() {
		return this._isTransform;
	}
}

export { AnimTarget };
