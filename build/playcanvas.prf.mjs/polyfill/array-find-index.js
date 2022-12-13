/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { defineProtoFunc } from './defineProtoFunc.js';

defineProtoFunc(Array, 'findIndex', function (predicate) {
  if (this == null) {
    throw new TypeError('"this" is null or not defined');
  }
  var o = Object(this);

  var len = o.length >>> 0;

  if (typeof predicate !== 'function') {
    throw new TypeError('predicate must be a function');
  }

  var thisArg = arguments[1];

  var k = 0;

  while (k < len) {
    var kValue = o[k];
    if (predicate.call(thisArg, kValue, k, o)) {
      return k;
    }
    k++;
  }

  return -1;
});
