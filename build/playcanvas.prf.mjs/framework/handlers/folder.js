/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class FolderHandler {
	constructor() {
		this.handlerType = "folder";
	}
	load(url, callback) {
		callback(null, null);
	}
	open(url, data) {
		return data;
	}
}

export { FolderHandler };
