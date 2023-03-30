/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class ResourceHandler {
	load(url, callback, asset) {
		throw new Error('not implemented');
	}
	open(url, data, asset) {
		throw new Error('not implemented');
	}
	patch(asset, assets) {}
}

export { ResourceHandler };
