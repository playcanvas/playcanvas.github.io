/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { defineProtoFunc } from './defineProtoFunc.js';

const typedArrays = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array];
for (const typedArray of typedArrays) {
	defineProtoFunc(typedArray, "fill", Array.prototype.fill);
	defineProtoFunc(typedArray, "join", Array.prototype.join);
}
