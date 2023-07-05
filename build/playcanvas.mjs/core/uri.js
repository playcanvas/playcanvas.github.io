function createURI(options) {
	let s = '';
	if ((options.authority || options.scheme) && (options.host || options.hostpath)) {
		throw new Error('Can\'t have \'scheme\' or \'authority\' and \'host\' or \'hostpath\' option');
	}
	if (options.host && options.hostpath) {
		throw new Error('Can\'t have \'host\' and \'hostpath\' option');
	}
	if (options.path && options.hostpath) {
		throw new Error('Can\'t have \'path\' and \'hostpath\' option');
	}
	if (options.scheme) {
		s += options.scheme + ':';
	}
	if (options.authority) {
		s += '//' + options.authority;
	}
	if (options.host) {
		s += options.host;
	}
	if (options.path) {
		s += options.path;
	}
	if (options.hostpath) {
		s += options.hostpath;
	}
	if (options.query) {
		s += '?' + options.query;
	}
	if (options.fragment) {
		s += '#' + options.fragment;
	}
	return s;
}
const re = /^(([^:\/?#]+):)?(\/\/([^\/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;
class URI {
	constructor(uri) {
		this.scheme = void 0;
		this.authority = void 0;
		this.path = void 0;
		this.query = void 0;
		this.fragment = void 0;
		const result = uri.match(re);
		this.scheme = result[2];
		this.authority = result[4];
		this.path = result[5];
		this.query = result[7];
		this.fragment = result[9];
	}
	toString() {
		let s = '';
		if (this.scheme) {
			s += this.scheme + ':';
		}
		if (this.authority) {
			s += '//' + this.authority;
		}
		s += this.path;
		if (this.query) {
			s += '?' + this.query;
		}
		if (this.fragment) {
			s += '#' + this.fragment;
		}
		return s;
	}
	getQuery() {
		const result = {};
		if (this.query) {
			const queryParams = decodeURIComponent(this.query).split('&');
			for (const queryParam of queryParams) {
				const pair = queryParam.split('=');
				result[pair[0]] = pair[1];
			}
		}
		return result;
	}
	setQuery(params) {
		let q = '';
		for (const key in params) {
			if (params.hasOwnProperty(key)) {
				if (q !== '') {
					q += '&';
				}
				q += encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
			}
		}
		this.query = q;
	}
}

export { URI, createURI };
