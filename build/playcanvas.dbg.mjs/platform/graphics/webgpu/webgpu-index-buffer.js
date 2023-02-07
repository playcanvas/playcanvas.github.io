/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { INDEXFORMAT_UINT8, INDEXFORMAT_UINT16 } from '../constants.js';
import { WebgpuBuffer } from './webgpu-buffer.js';

/**
 * A WebGPU implementation of the IndexBuffer.
 *
 * @ignore
 */
class WebgpuIndexBuffer extends WebgpuBuffer {
  constructor(indexBuffer) {
    super();
    this.format = null;
    Debug.assert(indexBuffer.format !== INDEXFORMAT_UINT8, "WebGPU does not support 8-bit index buffer format");
    this.format = indexBuffer.format === INDEXFORMAT_UINT16 ? "uint16" : "uint32";
  }
  unlock(indexBuffer) {
    const device = indexBuffer.device;
    super.unlock(device, indexBuffer.usage, GPUBufferUsage.INDEX, indexBuffer.storage);
  }
}

export { WebgpuIndexBuffer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWluZGV4LWJ1ZmZlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtaW5kZXgtYnVmZmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBJTkRFWEZPUk1BVF9VSU5UOCwgSU5ERVhGT1JNQVRfVUlOVDE2IH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFdlYmdwdUJ1ZmZlciB9IGZyb20gXCIuL3dlYmdwdS1idWZmZXIuanNcIjtcblxuLyoqXG4gKiBBIFdlYkdQVSBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgSW5kZXhCdWZmZXIuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBXZWJncHVJbmRleEJ1ZmZlciBleHRlbmRzIFdlYmdwdUJ1ZmZlciB7XG4gICAgZm9ybWF0ID0gbnVsbDtcblxuICAgIGNvbnN0cnVjdG9yKGluZGV4QnVmZmVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KGluZGV4QnVmZmVyLmZvcm1hdCAhPT0gSU5ERVhGT1JNQVRfVUlOVDgsIFwiV2ViR1BVIGRvZXMgbm90IHN1cHBvcnQgOC1iaXQgaW5kZXggYnVmZmVyIGZvcm1hdFwiKTtcbiAgICAgICAgdGhpcy5mb3JtYXQgPSBpbmRleEJ1ZmZlci5mb3JtYXQgPT09IElOREVYRk9STUFUX1VJTlQxNiA/IFwidWludDE2XCIgOiBcInVpbnQzMlwiO1xuICAgIH1cblxuICAgIHVubG9jayhpbmRleEJ1ZmZlcikge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSBpbmRleEJ1ZmZlci5kZXZpY2U7XG4gICAgICAgIHN1cGVyLnVubG9jayhkZXZpY2UsIGluZGV4QnVmZmVyLnVzYWdlLCBHUFVCdWZmZXJVc2FnZS5JTkRFWCwgaW5kZXhCdWZmZXIuc3RvcmFnZSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBXZWJncHVJbmRleEJ1ZmZlciB9O1xuIl0sIm5hbWVzIjpbIldlYmdwdUluZGV4QnVmZmVyIiwiV2ViZ3B1QnVmZmVyIiwiY29uc3RydWN0b3IiLCJpbmRleEJ1ZmZlciIsImZvcm1hdCIsIkRlYnVnIiwiYXNzZXJ0IiwiSU5ERVhGT1JNQVRfVUlOVDgiLCJJTkRFWEZPUk1BVF9VSU5UMTYiLCJ1bmxvY2siLCJkZXZpY2UiLCJ1c2FnZSIsIkdQVUJ1ZmZlclVzYWdlIiwiSU5ERVgiLCJzdG9yYWdlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsaUJBQWlCLFNBQVNDLFlBQVksQ0FBQztFQUd6Q0MsV0FBVyxDQUFDQyxXQUFXLEVBQUU7QUFDckIsSUFBQSxLQUFLLEVBQUUsQ0FBQTtJQUFDLElBSFpDLENBQUFBLE1BQU0sR0FBRyxJQUFJLENBQUE7SUFLVEMsS0FBSyxDQUFDQyxNQUFNLENBQUNILFdBQVcsQ0FBQ0MsTUFBTSxLQUFLRyxpQkFBaUIsRUFBRSxtREFBbUQsQ0FBQyxDQUFBO0lBQzNHLElBQUksQ0FBQ0gsTUFBTSxHQUFHRCxXQUFXLENBQUNDLE1BQU0sS0FBS0ksa0JBQWtCLEdBQUcsUUFBUSxHQUFHLFFBQVEsQ0FBQTtBQUNqRixHQUFBO0VBRUFDLE1BQU0sQ0FBQ04sV0FBVyxFQUFFO0FBQ2hCLElBQUEsTUFBTU8sTUFBTSxHQUFHUCxXQUFXLENBQUNPLE1BQU0sQ0FBQTtBQUNqQyxJQUFBLEtBQUssQ0FBQ0QsTUFBTSxDQUFDQyxNQUFNLEVBQUVQLFdBQVcsQ0FBQ1EsS0FBSyxFQUFFQyxjQUFjLENBQUNDLEtBQUssRUFBRVYsV0FBVyxDQUFDVyxPQUFPLENBQUMsQ0FBQTtBQUN0RixHQUFBO0FBQ0o7Ozs7In0=
