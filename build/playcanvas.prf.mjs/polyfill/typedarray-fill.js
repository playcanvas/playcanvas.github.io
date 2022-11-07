/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { defineProtoFunc } from './defineProtoFunc.js';

const typedArrays = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array];
for (const typedArray of typedArrays) {
  defineProtoFunc(typedArray, "fill", Array.prototype.fill);
  defineProtoFunc(typedArray, "join", Array.prototype.join);
}
