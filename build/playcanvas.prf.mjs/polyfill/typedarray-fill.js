import { defineProtoFunc } from './defineProtoFunc.js';

const typedArrays = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array];
for (const typedArray of typedArrays) {
	defineProtoFunc(typedArray, "fill", Array.prototype.fill);
	defineProtoFunc(typedArray, "join", Array.prototype.join);
}
