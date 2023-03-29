/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
