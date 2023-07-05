import { VersionedObject } from './versioned-object.js';

class ScopeId {
	constructor(name) {
		this.name = name;
		this.value = null;
		this.versionObject = new VersionedObject();
	}
	toJSON(key) {
		return undefined;
	}
	setValue(value) {
		this.value = value;
		this.versionObject.increment();
	}
	getValue() {
		return this.value;
	}
}

export { ScopeId };
