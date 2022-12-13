/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { defineProtoFunc } from './defineProtoFunc.js';

defineProtoFunc(Array, 'fill', function (value) {
  if (this == null) {
    throw new TypeError('this is null or not defined');
  }
  var O = Object(this);

  var len = O.length >>> 0;

  var start = arguments[1];
  var relativeStart = start >> 0;

  var k = relativeStart < 0 ? Math.max(len + relativeStart, 0) : Math.min(relativeStart, len);

  var end = arguments[2];
  var relativeEnd = end === undefined ? len : end >> 0;

  var finalValue = relativeEnd < 0 ? Math.max(len + relativeEnd, 0) : Math.min(relativeEnd, len);

  while (k < finalValue) {
    O[k] = value;
    k++;
  }

  return O;
});
