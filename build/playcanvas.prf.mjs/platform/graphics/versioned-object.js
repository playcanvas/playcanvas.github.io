/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
