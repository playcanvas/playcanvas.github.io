import { Version } from './version.js';

let idCounter = 0;
class VersionedObject {
	constructor() {
		idCounter++;
		this.version = new Version();
		this.version.globalId = idCounter;
	}
	increment() {
		this.version.revision++;
	}
}

export { VersionedObject };
