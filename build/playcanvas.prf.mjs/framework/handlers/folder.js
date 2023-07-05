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
