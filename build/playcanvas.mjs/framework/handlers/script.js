import { script } from '../script.js';
import { ScriptTypes } from '../script/script-types.js';

class ScriptHandler {
	constructor(app) {
		this.handlerType = "script";
		this._app = app;
		this._scripts = {};
		this._cache = {};
	}
	load(url, callback) {
		if (typeof url === 'string') {
			url = {
				load: url,
				original: url
			};
		}
		const self = this;
		script.app = this._app;
		this._loadScript(url.load, (err, url, extra) => {
			if (!err) {
				if (script.legacy) {
					let Type = null;
					if (ScriptTypes._types.length) {
						Type = ScriptTypes._types.pop();
					}
					if (Type) {
						this._scripts[url] = Type;
					} else {
						Type = null;
					}
					callback(null, Type, extra);
				} else {
					const obj = {};
					for (let i = 0; i < ScriptTypes._types.length; i++) obj[ScriptTypes._types[i].name] = ScriptTypes._types[i];
					ScriptTypes._types.length = 0;
					callback(null, obj, extra);
					delete self._loader._cache[url + 'script'];
				}
			} else {
				callback(err);
			}
		});
	}
	open(url, data) {
		return data;
	}
	patch(asset, assets) {}
	_loadScript(url, callback) {
		const head = document.head;
		const element = document.createElement('script');
		this._cache[url] = element;
		element.async = false;
		element.addEventListener('error', function (e) {
			callback(`Script: ${e.target.src} failed to load`);
		}, false);
		let done = false;
		element.onload = element.onreadystatechange = function () {
			if (!done && (!this.readyState || this.readyState === 'loaded' || this.readyState === 'complete')) {
				done = true;
				callback(null, url, element);
			}
		};
		element.src = url;
		head.appendChild(element);
	}
}

export { ScriptHandler };
