/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
const version = '1.62.0';
const revision = '818511d2b';
const config = {};
const common = {};
const apps = {};
const data = {};
const _typeLookup = function () {
	const result = {};
	const names = ['Array', 'Object', 'Function', 'Date', 'RegExp', 'Float32Array'];
	for (let i = 0; i < names.length; i++) result['[object ' + names[i] + ']'] = names[i].toLowerCase();
	return result;
}();
function type(obj) {
	if (obj === null) {
		return 'null';
	}
	const type = typeof obj;
	if (type === 'undefined' || type === 'number' || type === 'string' || type === 'boolean') {
		return type;
	}
	return _typeLookup[Object.prototype.toString.call(obj)];
}
function extend(target, ex) {
	for (const prop in ex) {
		const copy = ex[prop];
		if (type(copy) === 'object') {
			target[prop] = extend({}, copy);
		} else if (type(copy) === 'array') {
			target[prop] = extend([], copy);
		} else {
			target[prop] = copy;
		}
	}
	return target;
}

export { apps, common, config, data, extend, revision, type, version };
