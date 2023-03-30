class AssetFile {
	constructor(url = '', filename = '', hash = null, size = null, opt = null, contents = null) {
		this.url = url;
		this.filename = filename;
		this.hash = hash;
		this.size = size;
		this.opt = opt;
		this.contents = contents;
	}
	equals(other) {
		return this.url === other.url && this.filename === other.filename && this.hash === other.hash && this.size === other.size && this.opt === other.opt && this.contents === other.contents;
	}
}

export { AssetFile };
