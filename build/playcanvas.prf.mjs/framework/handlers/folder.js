/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
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
