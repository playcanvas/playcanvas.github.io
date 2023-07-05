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
