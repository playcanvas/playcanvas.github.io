/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32 } from '../constants.js';
import { WebglBuffer } from './webgl-buffer.js';

class WebglIndexBuffer extends WebglBuffer {
  constructor(indexBuffer) {
    super();
    const gl = indexBuffer.device.gl;
    const format = indexBuffer.format;
    if (format === INDEXFORMAT_UINT8) {
      this.glFormat = gl.UNSIGNED_BYTE;
    } else if (format === INDEXFORMAT_UINT16) {
      this.glFormat = gl.UNSIGNED_SHORT;
    } else if (format === INDEXFORMAT_UINT32) {
      this.glFormat = gl.UNSIGNED_INT;
    }
  }
  unlock(indexBuffer) {
    const device = indexBuffer.device;
    super.unlock(device, indexBuffer.usage, device.gl.ELEMENT_ARRAY_BUFFER, indexBuffer.storage);
  }
}

export { WebglIndexBuffer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ2wtaW5kZXgtYnVmZmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ2wvd2ViZ2wtaW5kZXgtYnVmZmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IElOREVYRk9STUFUX1VJTlQ4LCBJTkRFWEZPUk1BVF9VSU5UMTYsIElOREVYRk9STUFUX1VJTlQzMiB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBXZWJnbEJ1ZmZlciB9IGZyb20gXCIuL3dlYmdsLWJ1ZmZlci5qc1wiO1xuXG4vKipcbiAqIEEgV2ViR0wgaW1wbGVtZW50YXRpb24gb2YgdGhlIEluZGV4QnVmZmVyLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgV2ViZ2xJbmRleEJ1ZmZlciBleHRlbmRzIFdlYmdsQnVmZmVyIHtcbiAgICBjb25zdHJ1Y3RvcihpbmRleEJ1ZmZlcikge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIGNvbnN0IGdsID0gaW5kZXhCdWZmZXIuZGV2aWNlLmdsO1xuICAgICAgICBjb25zdCBmb3JtYXQgPSBpbmRleEJ1ZmZlci5mb3JtYXQ7XG4gICAgICAgIGlmIChmb3JtYXQgPT09IElOREVYRk9STUFUX1VJTlQ4KSB7XG4gICAgICAgICAgICB0aGlzLmdsRm9ybWF0ID0gZ2wuVU5TSUdORURfQllURTtcbiAgICAgICAgfSBlbHNlIGlmIChmb3JtYXQgPT09IElOREVYRk9STUFUX1VJTlQxNikge1xuICAgICAgICAgICAgdGhpcy5nbEZvcm1hdCA9IGdsLlVOU0lHTkVEX1NIT1JUO1xuICAgICAgICB9IGVsc2UgaWYgKGZvcm1hdCA9PT0gSU5ERVhGT1JNQVRfVUlOVDMyKSB7XG4gICAgICAgICAgICB0aGlzLmdsRm9ybWF0ID0gZ2wuVU5TSUdORURfSU5UO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdW5sb2NrKGluZGV4QnVmZmVyKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gaW5kZXhCdWZmZXIuZGV2aWNlO1xuICAgICAgICBzdXBlci51bmxvY2soZGV2aWNlLCBpbmRleEJ1ZmZlci51c2FnZSwgZGV2aWNlLmdsLkVMRU1FTlRfQVJSQVlfQlVGRkVSLCBpbmRleEJ1ZmZlci5zdG9yYWdlKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdsSW5kZXhCdWZmZXIgfTtcbiJdLCJuYW1lcyI6WyJXZWJnbEluZGV4QnVmZmVyIiwiV2ViZ2xCdWZmZXIiLCJjb25zdHJ1Y3RvciIsImluZGV4QnVmZmVyIiwiZ2wiLCJkZXZpY2UiLCJmb3JtYXQiLCJJTkRFWEZPUk1BVF9VSU5UOCIsImdsRm9ybWF0IiwiVU5TSUdORURfQllURSIsIklOREVYRk9STUFUX1VJTlQxNiIsIlVOU0lHTkVEX1NIT1JUIiwiSU5ERVhGT1JNQVRfVUlOVDMyIiwiVU5TSUdORURfSU5UIiwidW5sb2NrIiwidXNhZ2UiLCJFTEVNRU5UX0FSUkFZX0JVRkZFUiIsInN0b3JhZ2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBUUEsTUFBTUEsZ0JBQWdCLFNBQVNDLFdBQVcsQ0FBQztFQUN2Q0MsV0FBVyxDQUFDQyxXQUFXLEVBQUU7QUFDckIsSUFBQSxLQUFLLEVBQUUsQ0FBQTtBQUVQLElBQUEsTUFBTUMsRUFBRSxHQUFHRCxXQUFXLENBQUNFLE1BQU0sQ0FBQ0QsRUFBRSxDQUFBO0FBQ2hDLElBQUEsTUFBTUUsTUFBTSxHQUFHSCxXQUFXLENBQUNHLE1BQU0sQ0FBQTtJQUNqQyxJQUFJQSxNQUFNLEtBQUtDLGlCQUFpQixFQUFFO0FBQzlCLE1BQUEsSUFBSSxDQUFDQyxRQUFRLEdBQUdKLEVBQUUsQ0FBQ0ssYUFBYSxDQUFBO0FBQ3BDLEtBQUMsTUFBTSxJQUFJSCxNQUFNLEtBQUtJLGtCQUFrQixFQUFFO0FBQ3RDLE1BQUEsSUFBSSxDQUFDRixRQUFRLEdBQUdKLEVBQUUsQ0FBQ08sY0FBYyxDQUFBO0FBQ3JDLEtBQUMsTUFBTSxJQUFJTCxNQUFNLEtBQUtNLGtCQUFrQixFQUFFO0FBQ3RDLE1BQUEsSUFBSSxDQUFDSixRQUFRLEdBQUdKLEVBQUUsQ0FBQ1MsWUFBWSxDQUFBO0FBQ25DLEtBQUE7QUFDSixHQUFBO0VBRUFDLE1BQU0sQ0FBQ1gsV0FBVyxFQUFFO0FBRWhCLElBQUEsTUFBTUUsTUFBTSxHQUFHRixXQUFXLENBQUNFLE1BQU0sQ0FBQTtBQUNqQyxJQUFBLEtBQUssQ0FBQ1MsTUFBTSxDQUFDVCxNQUFNLEVBQUVGLFdBQVcsQ0FBQ1ksS0FBSyxFQUFFVixNQUFNLENBQUNELEVBQUUsQ0FBQ1ksb0JBQW9CLEVBQUViLFdBQVcsQ0FBQ2MsT0FBTyxDQUFDLENBQUE7QUFDaEcsR0FBQTtBQUNKOzs7OyJ9