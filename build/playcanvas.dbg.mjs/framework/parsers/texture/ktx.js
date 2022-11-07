/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { Asset } from '../../asset/asset.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { TEXHINT_ASSET, ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_111110F, PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F } from '../../../platform/graphics/constants.js';

const IDENTIFIER = [0x58544BAB, 0xBB313120, 0x0A1A0A0D];

const KNOWN_FORMATS = {
  0x83F0: PIXELFORMAT_DXT1,
  0x83F2: PIXELFORMAT_DXT3,
  0x83F3: PIXELFORMAT_DXT5,
  0x8D64: PIXELFORMAT_ETC1,
  0x9274: PIXELFORMAT_ETC2_RGB,
  0x9278: PIXELFORMAT_ETC2_RGBA,
  0x8C00: PIXELFORMAT_PVRTC_4BPP_RGB_1,
  0x8C01: PIXELFORMAT_PVRTC_2BPP_RGB_1,
  0x8C02: PIXELFORMAT_PVRTC_4BPP_RGBA_1,
  0x8C03: PIXELFORMAT_PVRTC_2BPP_RGBA_1,
  0x8051: PIXELFORMAT_R8_G8_B8,
  0x8058: PIXELFORMAT_R8_G8_B8_A8,
  0x8C41: PIXELFORMAT_SRGB,
  0x8C43: PIXELFORMAT_SRGBA,
  0x8C3A: PIXELFORMAT_111110F,
  0x881B: PIXELFORMAT_RGB16F,
  0x881A: PIXELFORMAT_RGBA16F
};

function createContainer(pixelFormat, buffer, byteOffset, byteSize) {
  return pixelFormat === PIXELFORMAT_111110F ? new Uint32Array(buffer, byteOffset, byteSize / 4) : new Uint8Array(buffer, byteOffset, byteSize);
}

class KtxParser {
  constructor(registry) {
    this.maxRetries = 0;
  }
  load(url, callback, asset) {
    Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
  }
  open(url, data, device) {
    const textureData = this.parse(data);
    if (!textureData) {
      return null;
    }
    const texture = new Texture(device, {
      name: url,
      profilerHint: TEXHINT_ASSET,
      addressU: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
      addressV: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
      width: textureData.width,
      height: textureData.height,
      format: textureData.format,
      cubemap: textureData.cubemap,
      levels: textureData.levels
    });
    texture.upload();
    return texture;
  }
  parse(data) {
    const dataU32 = new Uint32Array(data);

    if (IDENTIFIER[0] !== dataU32[0] || IDENTIFIER[1] !== dataU32[1] || IDENTIFIER[2] !== dataU32[2]) {
      Debug.warn('Invalid definition header found in KTX file. Expected 0xAB4B5458, 0x203131BB, 0x0D0A1A0A');
      return null;
    }

    const header = {
      endianness: dataU32[3],
      glType: dataU32[4],
      glTypeSize: dataU32[5],
      glFormat: dataU32[6],
      glInternalFormat: dataU32[7],
      glBaseInternalFormat: dataU32[8],
      pixelWidth: dataU32[9],
      pixelHeight: dataU32[10],
      pixelDepth: dataU32[11],
      numberOfArrayElements: dataU32[12],
      numberOfFaces: dataU32[13],
      numberOfMipmapLevels: dataU32[14],
      bytesOfKeyValueData: dataU32[15]
    };

    if (header.pixelDepth > 1) {
      Debug.warn('More than 1 pixel depth not supported!');
      return null;
    }

    if (header.numberOfArrayElements !== 0) {
      Debug.warn('Array texture not supported!');
      return null;
    }
    const format = KNOWN_FORMATS[header.glInternalFormat];

    if (format === undefined) {
      Debug.warn('Unknown glInternalFormat: ' + header.glInternalFormat);
      return null;
    }

    let offset = 16 + header.bytesOfKeyValueData / 4;
    const isCubemap = header.numberOfFaces > 1;
    const levels = [];
    for (let mipmapLevel = 0; mipmapLevel < (header.numberOfMipmapLevels || 1); mipmapLevel++) {
      const imageSizeInBytes = dataU32[offset++];
      if (isCubemap) {
        levels.push([]);
      }
      const target = isCubemap ? levels[mipmapLevel] : levels;
      for (let face = 0; face < (isCubemap ? 6 : 1); ++face) {
        target.push(createContainer(format, data, offset * 4, imageSizeInBytes));
        offset += imageSizeInBytes + 3 >> 2;
      }
    }
    return {
      format: format,
      width: header.pixelWidth,
      height: header.pixelHeight,
      levels: levels,
      cubemap: isCubemap
    };
  }
}

export { KtxParser };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia3R4LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3BhcnNlcnMvdGV4dHVyZS9rdHguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vLi4vZnJhbWV3b3JrL2Fzc2V0L2Fzc2V0LmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBBRERSRVNTX1JFUEVBVCxcbiAgICBQSVhFTEZPUk1BVF9EWFQxLCBQSVhFTEZPUk1BVF9EWFQzLCBQSVhFTEZPUk1BVF9EWFQ1LFxuICAgIFBJWEVMRk9STUFUX0VUQzEsIFBJWEVMRk9STUFUX0VUQzJfUkdCLCBQSVhFTEZPUk1BVF9FVEMyX1JHQkEsXG4gICAgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xLFxuICAgIFBJWEVMRk9STUFUX1I4X0c4X0I4LCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCwgUElYRUxGT1JNQVRfU1JHQiwgUElYRUxGT1JNQVRfU1JHQkEsXG4gICAgUElYRUxGT1JNQVRfMTExMTEwRiwgUElYRUxGT1JNQVRfUkdCMTZGLCBQSVhFTEZPUk1BVF9SR0JBMTZGLFxuICAgIFRFWEhJTlRfQVNTRVRcbn0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2hhbmRsZXJzL3RleHR1cmUuanMnKS5UZXh0dXJlUGFyc2VyfSBUZXh0dXJlUGFyc2VyICovXG5cbi8vIERlZmluZWQgaGVyZTogaHR0cHM6Ly93d3cua2hyb25vcy5vcmcvb3BlbmdsZXMvc2RrL3Rvb2xzL0tUWC9maWxlX2Zvcm1hdF9zcGVjL1xuY29uc3QgSURFTlRJRklFUiA9IFsweDU4NTQ0QkFCLCAweEJCMzEzMTIwLCAweDBBMUEwQTBEXTsgLy8gwqtLVFggMTHCu1xcclxcblxceDFBXFxuXG5cbmNvbnN0IEtOT1dOX0ZPUk1BVFMgPSB7XG4gICAgLy8gY29tcHJlc3NlZCBmb3JtYXRzXG4gICAgMHg4M0YwOiBQSVhFTEZPUk1BVF9EWFQxLFxuICAgIDB4ODNGMjogUElYRUxGT1JNQVRfRFhUMyxcbiAgICAweDgzRjM6IFBJWEVMRk9STUFUX0RYVDUsXG4gICAgMHg4RDY0OiBQSVhFTEZPUk1BVF9FVEMxLFxuICAgIDB4OTI3NDogUElYRUxGT1JNQVRfRVRDMl9SR0IsXG4gICAgMHg5Mjc4OiBQSVhFTEZPUk1BVF9FVEMyX1JHQkEsXG4gICAgMHg4QzAwOiBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xLFxuICAgIDB4OEMwMTogUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSxcbiAgICAweDhDMDI6IFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xLFxuICAgIDB4OEMwMzogUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEsXG5cbiAgICAvLyB1bmNvbXByZXNzZWQgZm9ybWF0c1xuICAgIDB4ODA1MTogUElYRUxGT1JNQVRfUjhfRzhfQjgsICAgICAgIC8vIEdMX1JHQjhcbiAgICAweDgwNTg6IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCAgICAvLyBHTF9SR0JBOFxuICAgIDB4OEM0MTogUElYRUxGT1JNQVRfU1JHQiwgICAgICAgICAgIC8vIEdMX1NSR0I4XG4gICAgMHg4QzQzOiBQSVhFTEZPUk1BVF9TUkdCQSwgICAgICAgICAgLy8gR0xfU1JHQjhfQUxQSEE4XG4gICAgMHg4QzNBOiBQSVhFTEZPUk1BVF8xMTExMTBGLCAgICAgICAgLy8gR0xfUjExRl9HMTFGX0IxMEZcbiAgICAweDg4MUI6IFBJWEVMRk9STUFUX1JHQjE2RiwgICAgICAgICAvLyBHTF9SR0IxNkZcbiAgICAweDg4MUE6IFBJWEVMRk9STUFUX1JHQkExNkYgICAgICAgICAvLyBHTF9SR0JBMTZGXG59O1xuXG5mdW5jdGlvbiBjcmVhdGVDb250YWluZXIocGl4ZWxGb3JtYXQsIGJ1ZmZlciwgYnl0ZU9mZnNldCwgYnl0ZVNpemUpIHtcbiAgICByZXR1cm4gKHBpeGVsRm9ybWF0ID09PSBQSVhFTEZPUk1BVF8xMTExMTBGKSA/XG4gICAgICAgIG5ldyBVaW50MzJBcnJheShidWZmZXIsIGJ5dGVPZmZzZXQsIGJ5dGVTaXplIC8gNCkgOlxuICAgICAgICBuZXcgVWludDhBcnJheShidWZmZXIsIGJ5dGVPZmZzZXQsIGJ5dGVTaXplKTtcbn1cblxuLyoqXG4gKiBUZXh0dXJlIHBhcnNlciBmb3Iga3R4IGZpbGVzLlxuICpcbiAqIEBpbXBsZW1lbnRzIHtUZXh0dXJlUGFyc2VyfVxuICogQGlnbm9yZVxuICovXG5jbGFzcyBLdHhQYXJzZXIge1xuICAgIGNvbnN0cnVjdG9yKHJlZ2lzdHJ5KSB7XG4gICAgICAgIHRoaXMubWF4UmV0cmllcyA9IDA7XG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICBBc3NldC5mZXRjaEFycmF5QnVmZmVyKHVybC5sb2FkLCBjYWxsYmFjaywgYXNzZXQsIHRoaXMubWF4UmV0cmllcyk7XG4gICAgfVxuXG4gICAgb3Blbih1cmwsIGRhdGEsIGRldmljZSkge1xuICAgICAgICBjb25zdCB0ZXh0dXJlRGF0YSA9IHRoaXMucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgaWYgKCF0ZXh0dXJlRGF0YSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB0ZXh0dXJlID0gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgICAgICBuYW1lOiB1cmwsXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICBwcm9maWxlckhpbnQ6IFRFWEhJTlRfQVNTRVQsXG4gICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgIGFkZHJlc3NVOiB0ZXh0dXJlRGF0YS5jdWJlbWFwID8gQUREUkVTU19DTEFNUF9UT19FREdFIDogQUREUkVTU19SRVBFQVQsXG4gICAgICAgICAgICBhZGRyZXNzVjogdGV4dHVyZURhdGEuY3ViZW1hcCA/IEFERFJFU1NfQ0xBTVBfVE9fRURHRSA6IEFERFJFU1NfUkVQRUFULFxuICAgICAgICAgICAgd2lkdGg6IHRleHR1cmVEYXRhLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiB0ZXh0dXJlRGF0YS5oZWlnaHQsXG4gICAgICAgICAgICBmb3JtYXQ6IHRleHR1cmVEYXRhLmZvcm1hdCxcbiAgICAgICAgICAgIGN1YmVtYXA6IHRleHR1cmVEYXRhLmN1YmVtYXAsXG4gICAgICAgICAgICBsZXZlbHM6IHRleHR1cmVEYXRhLmxldmVsc1xuICAgICAgICB9KTtcblxuICAgICAgICB0ZXh0dXJlLnVwbG9hZCgpO1xuXG4gICAgICAgIHJldHVybiB0ZXh0dXJlO1xuICAgIH1cblxuICAgIHBhcnNlKGRhdGEpIHtcbiAgICAgICAgY29uc3QgZGF0YVUzMiA9IG5ldyBVaW50MzJBcnJheShkYXRhKTtcblxuICAgICAgICAvLyBjaGVjayBtYWdpYyBiaXRzXG4gICAgICAgIGlmIChJREVOVElGSUVSWzBdICE9PSBkYXRhVTMyWzBdIHx8XG4gICAgICAgICAgICBJREVOVElGSUVSWzFdICE9PSBkYXRhVTMyWzFdIHx8XG4gICAgICAgICAgICBJREVOVElGSUVSWzJdICE9PSBkYXRhVTMyWzJdKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKCdJbnZhbGlkIGRlZmluaXRpb24gaGVhZGVyIGZvdW5kIGluIEtUWCBmaWxlLiBFeHBlY3RlZCAweEFCNEI1NDU4LCAweDIwMzEzMUJCLCAweDBEMEExQTBBJyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHVucGFjayBoZWFkZXIgaW5mb1xuICAgICAgICBjb25zdCBoZWFkZXIgPSB7XG4gICAgICAgICAgICBlbmRpYW5uZXNzOiBkYXRhVTMyWzNdLCAvLyB0b2RvOiBVc2UgdGhpcyBpbmZvcm1hdGlvblxuICAgICAgICAgICAgZ2xUeXBlOiBkYXRhVTMyWzRdLFxuICAgICAgICAgICAgZ2xUeXBlU2l6ZTogZGF0YVUzMls1XSxcbiAgICAgICAgICAgIGdsRm9ybWF0OiBkYXRhVTMyWzZdLFxuICAgICAgICAgICAgZ2xJbnRlcm5hbEZvcm1hdDogZGF0YVUzMls3XSxcbiAgICAgICAgICAgIGdsQmFzZUludGVybmFsRm9ybWF0OiBkYXRhVTMyWzhdLFxuICAgICAgICAgICAgcGl4ZWxXaWR0aDogZGF0YVUzMls5XSxcbiAgICAgICAgICAgIHBpeGVsSGVpZ2h0OiBkYXRhVTMyWzEwXSxcbiAgICAgICAgICAgIHBpeGVsRGVwdGg6IGRhdGFVMzJbMTFdLFxuICAgICAgICAgICAgbnVtYmVyT2ZBcnJheUVsZW1lbnRzOiBkYXRhVTMyWzEyXSxcbiAgICAgICAgICAgIG51bWJlck9mRmFjZXM6IGRhdGFVMzJbMTNdLFxuICAgICAgICAgICAgbnVtYmVyT2ZNaXBtYXBMZXZlbHM6IGRhdGFVMzJbMTRdLFxuICAgICAgICAgICAgYnl0ZXNPZktleVZhbHVlRGF0YTogZGF0YVUzMlsxNV1cbiAgICAgICAgfTtcblxuICAgICAgICAvLyBkb24ndCBzdXBwb3J0IHZvbHVtZSB0ZXh0dXJlc1xuICAgICAgICBpZiAoaGVhZGVyLnBpeGVsRGVwdGggPiAxKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKCdNb3JlIHRoYW4gMSBwaXhlbCBkZXB0aCBub3Qgc3VwcG9ydGVkIScpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkb24ndCBzdXBwb3J0IHRleHR1cmUgYXJyYXlzXG4gICAgICAgIGlmIChoZWFkZXIubnVtYmVyT2ZBcnJheUVsZW1lbnRzICE9PSAwKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKCdBcnJheSB0ZXh0dXJlIG5vdCBzdXBwb3J0ZWQhJyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZvcm1hdCA9IEtOT1dOX0ZPUk1BVFNbaGVhZGVyLmdsSW50ZXJuYWxGb3JtYXRdO1xuXG4gICAgICAgIC8vIG9ubHkgc3VwcG9ydCBzdWJzZXQgb2YgcGl4ZWwgZm9ybWF0c1xuICAgICAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ1Vua25vd24gZ2xJbnRlcm5hbEZvcm1hdDogJyArIGhlYWRlci5nbEludGVybmFsRm9ybWF0KTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gb2Zmc2V0IGxvY2F0aW5nIHRoZSBmaXJzdCBieXRlIG9mIHRleHR1cmUgbGV2ZWwgZGF0YVxuICAgICAgICBsZXQgb2Zmc2V0ID0gMTYgKyBoZWFkZXIuYnl0ZXNPZktleVZhbHVlRGF0YSAvIDQ7XG5cbiAgICAgICAgY29uc3QgaXNDdWJlbWFwID0gKGhlYWRlci5udW1iZXJPZkZhY2VzID4gMSk7XG4gICAgICAgIGNvbnN0IGxldmVscyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBtaXBtYXBMZXZlbCA9IDA7IG1pcG1hcExldmVsIDwgKGhlYWRlci5udW1iZXJPZk1pcG1hcExldmVscyB8fCAxKTsgbWlwbWFwTGV2ZWwrKykge1xuICAgICAgICAgICAgY29uc3QgaW1hZ2VTaXplSW5CeXRlcyA9IGRhdGFVMzJbb2Zmc2V0KytdO1xuXG4gICAgICAgICAgICBpZiAoaXNDdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgbGV2ZWxzLnB1c2goW10pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBpc0N1YmVtYXAgPyBsZXZlbHNbbWlwbWFwTGV2ZWxdIDogbGV2ZWxzO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBmYWNlID0gMDsgZmFjZSA8IChpc0N1YmVtYXAgPyA2IDogMSk7ICsrZmFjZSkge1xuICAgICAgICAgICAgICAgIHRhcmdldC5wdXNoKGNyZWF0ZUNvbnRhaW5lcihmb3JtYXQsIGRhdGEsIG9mZnNldCAqIDQsIGltYWdlU2l6ZUluQnl0ZXMpKTtcbiAgICAgICAgICAgICAgICBvZmZzZXQgKz0gKGltYWdlU2l6ZUluQnl0ZXMgKyAzKSA+PiAyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGZvcm1hdDogZm9ybWF0LFxuICAgICAgICAgICAgd2lkdGg6IGhlYWRlci5waXhlbFdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWFkZXIucGl4ZWxIZWlnaHQsXG4gICAgICAgICAgICBsZXZlbHM6IGxldmVscyxcbiAgICAgICAgICAgIGN1YmVtYXA6IGlzQ3ViZW1hcFxuICAgICAgICB9O1xuICAgIH1cbn1cblxuZXhwb3J0IHsgS3R4UGFyc2VyIH07XG4iXSwibmFtZXMiOlsiSURFTlRJRklFUiIsIktOT1dOX0ZPUk1BVFMiLCJQSVhFTEZPUk1BVF9EWFQxIiwiUElYRUxGT1JNQVRfRFhUMyIsIlBJWEVMRk9STUFUX0RYVDUiLCJQSVhFTEZPUk1BVF9FVEMxIiwiUElYRUxGT1JNQVRfRVRDMl9SR0IiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQkEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9SOF9HOF9COCIsIlBJWEVMRk9STUFUX1I4X0c4X0I4X0E4IiwiUElYRUxGT1JNQVRfU1JHQiIsIlBJWEVMRk9STUFUX1NSR0JBIiwiUElYRUxGT1JNQVRfMTExMTEwRiIsIlBJWEVMRk9STUFUX1JHQjE2RiIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJjcmVhdGVDb250YWluZXIiLCJwaXhlbEZvcm1hdCIsImJ1ZmZlciIsImJ5dGVPZmZzZXQiLCJieXRlU2l6ZSIsIlVpbnQzMkFycmF5IiwiVWludDhBcnJheSIsIkt0eFBhcnNlciIsImNvbnN0cnVjdG9yIiwicmVnaXN0cnkiLCJtYXhSZXRyaWVzIiwibG9hZCIsInVybCIsImNhbGxiYWNrIiwiYXNzZXQiLCJBc3NldCIsImZldGNoQXJyYXlCdWZmZXIiLCJvcGVuIiwiZGF0YSIsImRldmljZSIsInRleHR1cmVEYXRhIiwicGFyc2UiLCJ0ZXh0dXJlIiwiVGV4dHVyZSIsIm5hbWUiLCJwcm9maWxlckhpbnQiLCJURVhISU5UX0FTU0VUIiwiYWRkcmVzc1UiLCJjdWJlbWFwIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiQUREUkVTU19SRVBFQVQiLCJhZGRyZXNzViIsIndpZHRoIiwiaGVpZ2h0IiwiZm9ybWF0IiwibGV2ZWxzIiwidXBsb2FkIiwiZGF0YVUzMiIsIkRlYnVnIiwid2FybiIsImhlYWRlciIsImVuZGlhbm5lc3MiLCJnbFR5cGUiLCJnbFR5cGVTaXplIiwiZ2xGb3JtYXQiLCJnbEludGVybmFsRm9ybWF0IiwiZ2xCYXNlSW50ZXJuYWxGb3JtYXQiLCJwaXhlbFdpZHRoIiwicGl4ZWxIZWlnaHQiLCJwaXhlbERlcHRoIiwibnVtYmVyT2ZBcnJheUVsZW1lbnRzIiwibnVtYmVyT2ZGYWNlcyIsIm51bWJlck9mTWlwbWFwTGV2ZWxzIiwiYnl0ZXNPZktleVZhbHVlRGF0YSIsInVuZGVmaW5lZCIsIm9mZnNldCIsImlzQ3ViZW1hcCIsIm1pcG1hcExldmVsIiwiaW1hZ2VTaXplSW5CeXRlcyIsInB1c2giLCJ0YXJnZXQiLCJmYWNlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBZ0JBLE1BQU1BLFVBQVUsR0FBRyxDQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUE7O0FBRXZELE1BQU1DLGFBQWEsR0FBRztBQUVsQixFQUFBLE1BQU0sRUFBRUMsZ0JBQWdCO0FBQ3hCLEVBQUEsTUFBTSxFQUFFQyxnQkFBZ0I7QUFDeEIsRUFBQSxNQUFNLEVBQUVDLGdCQUFnQjtBQUN4QixFQUFBLE1BQU0sRUFBRUMsZ0JBQWdCO0FBQ3hCLEVBQUEsTUFBTSxFQUFFQyxvQkFBb0I7QUFDNUIsRUFBQSxNQUFNLEVBQUVDLHFCQUFxQjtBQUM3QixFQUFBLE1BQU0sRUFBRUMsNEJBQTRCO0FBQ3BDLEVBQUEsTUFBTSxFQUFFQyw0QkFBNEI7QUFDcEMsRUFBQSxNQUFNLEVBQUVDLDZCQUE2QjtBQUNyQyxFQUFBLE1BQU0sRUFBRUMsNkJBQTZCO0FBR3JDLEVBQUEsTUFBTSxFQUFFQyxvQkFBb0I7QUFDNUIsRUFBQSxNQUFNLEVBQUVDLHVCQUF1QjtBQUMvQixFQUFBLE1BQU0sRUFBRUMsZ0JBQWdCO0FBQ3hCLEVBQUEsTUFBTSxFQUFFQyxpQkFBaUI7QUFDekIsRUFBQSxNQUFNLEVBQUVDLG1CQUFtQjtBQUMzQixFQUFBLE1BQU0sRUFBRUMsa0JBQWtCO0FBQzFCLEVBQUEsTUFBTSxFQUFFQyxtQkFBQUE7QUFDWixDQUFDLENBQUE7O0FBRUQsU0FBU0MsZUFBZSxDQUFDQyxXQUFXLEVBQUVDLE1BQU0sRUFBRUMsVUFBVSxFQUFFQyxRQUFRLEVBQUU7RUFDaEUsT0FBUUgsV0FBVyxLQUFLSixtQkFBbUIsR0FDdkMsSUFBSVEsV0FBVyxDQUFDSCxNQUFNLEVBQUVDLFVBQVUsRUFBRUMsUUFBUSxHQUFHLENBQUMsQ0FBQyxHQUNqRCxJQUFJRSxVQUFVLENBQUNKLE1BQU0sRUFBRUMsVUFBVSxFQUFFQyxRQUFRLENBQUMsQ0FBQTtBQUNwRCxDQUFBOztBQVFBLE1BQU1HLFNBQVMsQ0FBQztFQUNaQyxXQUFXLENBQUNDLFFBQVEsRUFBRTtJQUNsQixJQUFJLENBQUNDLFVBQVUsR0FBRyxDQUFDLENBQUE7QUFDdkIsR0FBQTtBQUVBQyxFQUFBQSxJQUFJLENBQUNDLEdBQUcsRUFBRUMsUUFBUSxFQUFFQyxLQUFLLEVBQUU7QUFDdkJDLElBQUFBLEtBQUssQ0FBQ0MsZ0JBQWdCLENBQUNKLEdBQUcsQ0FBQ0QsSUFBSSxFQUFFRSxRQUFRLEVBQUVDLEtBQUssRUFBRSxJQUFJLENBQUNKLFVBQVUsQ0FBQyxDQUFBO0FBQ3RFLEdBQUE7QUFFQU8sRUFBQUEsSUFBSSxDQUFDTCxHQUFHLEVBQUVNLElBQUksRUFBRUMsTUFBTSxFQUFFO0FBQ3BCLElBQUEsTUFBTUMsV0FBVyxHQUFHLElBQUksQ0FBQ0MsS0FBSyxDQUFDSCxJQUFJLENBQUMsQ0FBQTtJQUVwQyxJQUFJLENBQUNFLFdBQVcsRUFBRTtBQUNkLE1BQUEsT0FBTyxJQUFJLENBQUE7QUFDZixLQUFBO0FBRUEsSUFBQSxNQUFNRSxPQUFPLEdBQUcsSUFBSUMsT0FBTyxDQUFDSixNQUFNLEVBQUU7QUFDaENLLE1BQUFBLElBQUksRUFBRVosR0FBRztBQUVUYSxNQUFBQSxZQUFZLEVBQUVDLGFBQWE7QUFFM0JDLE1BQUFBLFFBQVEsRUFBRVAsV0FBVyxDQUFDUSxPQUFPLEdBQUdDLHFCQUFxQixHQUFHQyxjQUFjO0FBQ3RFQyxNQUFBQSxRQUFRLEVBQUVYLFdBQVcsQ0FBQ1EsT0FBTyxHQUFHQyxxQkFBcUIsR0FBR0MsY0FBYztNQUN0RUUsS0FBSyxFQUFFWixXQUFXLENBQUNZLEtBQUs7TUFDeEJDLE1BQU0sRUFBRWIsV0FBVyxDQUFDYSxNQUFNO01BQzFCQyxNQUFNLEVBQUVkLFdBQVcsQ0FBQ2MsTUFBTTtNQUMxQk4sT0FBTyxFQUFFUixXQUFXLENBQUNRLE9BQU87TUFDNUJPLE1BQU0sRUFBRWYsV0FBVyxDQUFDZSxNQUFBQTtBQUN4QixLQUFDLENBQUMsQ0FBQTtJQUVGYixPQUFPLENBQUNjLE1BQU0sRUFBRSxDQUFBO0FBRWhCLElBQUEsT0FBT2QsT0FBTyxDQUFBO0FBQ2xCLEdBQUE7RUFFQUQsS0FBSyxDQUFDSCxJQUFJLEVBQUU7QUFDUixJQUFBLE1BQU1tQixPQUFPLEdBQUcsSUFBSWhDLFdBQVcsQ0FBQ2EsSUFBSSxDQUFDLENBQUE7O0FBR3JDLElBQUEsSUFBSXJDLFVBQVUsQ0FBQyxDQUFDLENBQUMsS0FBS3dELE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFDNUJ4RCxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUt3RCxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQzVCeEQsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLd0QsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzlCQyxNQUFBQSxLQUFLLENBQUNDLElBQUksQ0FBQywwRkFBMEYsQ0FBQyxDQUFBO0FBQ3RHLE1BQUEsT0FBTyxJQUFJLENBQUE7QUFDZixLQUFBOztBQUdBLElBQUEsTUFBTUMsTUFBTSxHQUFHO0FBQ1hDLE1BQUFBLFVBQVUsRUFBRUosT0FBTyxDQUFDLENBQUMsQ0FBQztBQUN0QkssTUFBQUEsTUFBTSxFQUFFTCxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ2xCTSxNQUFBQSxVQUFVLEVBQUVOLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDdEJPLE1BQUFBLFFBQVEsRUFBRVAsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUNwQlEsTUFBQUEsZ0JBQWdCLEVBQUVSLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDNUJTLE1BQUFBLG9CQUFvQixFQUFFVCxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ2hDVSxNQUFBQSxVQUFVLEVBQUVWLE9BQU8sQ0FBQyxDQUFDLENBQUM7QUFDdEJXLE1BQUFBLFdBQVcsRUFBRVgsT0FBTyxDQUFDLEVBQUUsQ0FBQztBQUN4QlksTUFBQUEsVUFBVSxFQUFFWixPQUFPLENBQUMsRUFBRSxDQUFDO0FBQ3ZCYSxNQUFBQSxxQkFBcUIsRUFBRWIsT0FBTyxDQUFDLEVBQUUsQ0FBQztBQUNsQ2MsTUFBQUEsYUFBYSxFQUFFZCxPQUFPLENBQUMsRUFBRSxDQUFDO0FBQzFCZSxNQUFBQSxvQkFBb0IsRUFBRWYsT0FBTyxDQUFDLEVBQUUsQ0FBQztNQUNqQ2dCLG1CQUFtQixFQUFFaEIsT0FBTyxDQUFDLEVBQUUsQ0FBQTtLQUNsQyxDQUFBOztBQUdELElBQUEsSUFBSUcsTUFBTSxDQUFDUyxVQUFVLEdBQUcsQ0FBQyxFQUFFO0FBQ3ZCWCxNQUFBQSxLQUFLLENBQUNDLElBQUksQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFBO0FBQ3BELE1BQUEsT0FBTyxJQUFJLENBQUE7QUFDZixLQUFBOztBQUdBLElBQUEsSUFBSUMsTUFBTSxDQUFDVSxxQkFBcUIsS0FBSyxDQUFDLEVBQUU7QUFDcENaLE1BQUFBLEtBQUssQ0FBQ0MsSUFBSSxDQUFDLDhCQUE4QixDQUFDLENBQUE7QUFDMUMsTUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEtBQUE7QUFFQSxJQUFBLE1BQU1MLE1BQU0sR0FBR3BELGFBQWEsQ0FBQzBELE1BQU0sQ0FBQ0ssZ0JBQWdCLENBQUMsQ0FBQTs7SUFHckQsSUFBSVgsTUFBTSxLQUFLb0IsU0FBUyxFQUFFO01BQ3RCaEIsS0FBSyxDQUFDQyxJQUFJLENBQUMsNEJBQTRCLEdBQUdDLE1BQU0sQ0FBQ0ssZ0JBQWdCLENBQUMsQ0FBQTtBQUNsRSxNQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsS0FBQTs7SUFHQSxJQUFJVSxNQUFNLEdBQUcsRUFBRSxHQUFHZixNQUFNLENBQUNhLG1CQUFtQixHQUFHLENBQUMsQ0FBQTtBQUVoRCxJQUFBLE1BQU1HLFNBQVMsR0FBSWhCLE1BQU0sQ0FBQ1csYUFBYSxHQUFHLENBQUUsQ0FBQTtJQUM1QyxNQUFNaEIsTUFBTSxHQUFHLEVBQUUsQ0FBQTtBQUNqQixJQUFBLEtBQUssSUFBSXNCLFdBQVcsR0FBRyxDQUFDLEVBQUVBLFdBQVcsSUFBSWpCLE1BQU0sQ0FBQ1ksb0JBQW9CLElBQUksQ0FBQyxDQUFDLEVBQUVLLFdBQVcsRUFBRSxFQUFFO0FBQ3ZGLE1BQUEsTUFBTUMsZ0JBQWdCLEdBQUdyQixPQUFPLENBQUNrQixNQUFNLEVBQUUsQ0FBQyxDQUFBO0FBRTFDLE1BQUEsSUFBSUMsU0FBUyxFQUFFO0FBQ1hyQixRQUFBQSxNQUFNLENBQUN3QixJQUFJLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDbkIsT0FBQTtNQUVBLE1BQU1DLE1BQU0sR0FBR0osU0FBUyxHQUFHckIsTUFBTSxDQUFDc0IsV0FBVyxDQUFDLEdBQUd0QixNQUFNLENBQUE7QUFFdkQsTUFBQSxLQUFLLElBQUkwQixJQUFJLEdBQUcsQ0FBQyxFQUFFQSxJQUFJLElBQUlMLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRUssSUFBSSxFQUFFO0FBQ25ERCxRQUFBQSxNQUFNLENBQUNELElBQUksQ0FBQzNELGVBQWUsQ0FBQ2tDLE1BQU0sRUFBRWhCLElBQUksRUFBRXFDLE1BQU0sR0FBRyxDQUFDLEVBQUVHLGdCQUFnQixDQUFDLENBQUMsQ0FBQTtBQUN4RUgsUUFBQUEsTUFBTSxJQUFLRyxnQkFBZ0IsR0FBRyxDQUFDLElBQUssQ0FBQyxDQUFBO0FBQ3pDLE9BQUE7QUFDSixLQUFBO0lBRUEsT0FBTztBQUNIeEIsTUFBQUEsTUFBTSxFQUFFQSxNQUFNO01BQ2RGLEtBQUssRUFBRVEsTUFBTSxDQUFDTyxVQUFVO01BQ3hCZCxNQUFNLEVBQUVPLE1BQU0sQ0FBQ1EsV0FBVztBQUMxQmIsTUFBQUEsTUFBTSxFQUFFQSxNQUFNO0FBQ2RQLE1BQUFBLE9BQU8sRUFBRTRCLFNBQUFBO0tBQ1osQ0FBQTtBQUNMLEdBQUE7QUFDSjs7OzsifQ==