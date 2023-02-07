import { defineProtoFunc } from './defineProtoFunc.js';

defineProtoFunc(Array, 'find', function (predicate) {
	if (this == null) {
		throw TypeError('"this" is null or not defined');
	}
	var o = Object(this);
	var len = o.length >>> 0;
	if (typeof predicate !== 'function') {
		throw TypeError('predicate must be a function');
	}
	var thisArg = arguments[1];
	var k = 0;
	while (k < len) {
		var kValue = o[k];
		if (predicate.call(thisArg, kValue, k, o)) {
			return kValue;
		}
		k++;
	}
	return undefined;
});
