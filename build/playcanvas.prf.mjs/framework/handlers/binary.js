/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { http, Http } from '../../platform/net/http.js';

class BinaryHandler {
	constructor(app) {
		this.handlerType = "binary";
		this.maxRetries = 0;
	}
	load(url, callback) {
		if (typeof url === 'string') {
			url = {
				load: url,
				original: url
			};
		}
		http.get(url.load, {
			responseType: Http.ResponseType.ARRAY_BUFFER,
			retry: this.maxRetries > 0,
			maxRetries: this.maxRetries
		}, function (err, response) {
			if (!err) {
				callback(null, response);
			} else {
				callback(`Error loading binary resource: ${url.original} [${err}]`);
			}
		});
	}
	open(url, data) {
		return data;
	}
	patch(asset, assets) {}
}

export { BinaryHandler };
