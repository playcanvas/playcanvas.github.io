// Basis worker
function BasisWorker() {
  // basis compression format enums, reproduced here
  const BASIS_FORMAT = {
    cTFETC1: 0,
    // etc1
    cTFETC2: 1,
    // etc2
    cTFBC1: 2,
    // dxt1
    cTFBC3: 3,
    // dxt5
    cTFPVRTC1_4_RGB: 8,
    // PVRTC1 rgb
    cTFPVRTC1_4_RGBA: 9,
    // PVRTC1 rgba
    cTFASTC_4x4: 10,
    // ASTC
    cTFATC_RGB: 11,
    // ATC rgb
    cTFATC_RGBA_INTERPOLATED_ALPHA: 12,
    // ATC rgba
    // uncompressed (fallback) formats
    cTFRGBA32: 13,
    // rgba 8888
    cTFRGB565: 14,
    // rgb 565
    cTFRGBA4444: 16 // rgba 4444
  };

  // map of GPU to basis format for textures without alpha
  const opaqueMapping = {
    astc: BASIS_FORMAT.cTFASTC_4x4,
    dxt: BASIS_FORMAT.cTFBC1,
    etc1: BASIS_FORMAT.cTFETC1,
    etc2: BASIS_FORMAT.cTFETC1,
    pvr: BASIS_FORMAT.cTFPVRTC1_4_RGB,
    atc: BASIS_FORMAT.cTFATC_RGB,
    none: BASIS_FORMAT.cTFRGB565
  };

  // map of GPU to basis format for textures with alpha
  const alphaMapping = {
    astc: BASIS_FORMAT.cTFASTC_4x4,
    dxt: BASIS_FORMAT.cTFBC3,
    etc1: BASIS_FORMAT.cTFRGBA4444,
    etc2: BASIS_FORMAT.cTFETC2,
    pvr: BASIS_FORMAT.cTFPVRTC1_4_RGBA,
    atc: BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA,
    none: BASIS_FORMAT.cTFRGBA4444
  };

  // engine pixel format constants, reproduced here
  const PIXEL_FORMAT = {
    ETC1: 21,
    ETC2_RGB: 22,
    ETC2_RGBA: 23,
    DXT1: 8,
    DXT5: 10,
    PVRTC_4BPP_RGB_1: 26,
    PVRTC_4BPP_RGBA_1: 27,
    ASTC_4x4: 28,
    ATC_RGB: 29,
    ATC_RGBA: 30,
    R8_G8_B8_A8: 7,
    R5_G6_B5: 3,
    R4_G4_B4_A4: 5
  };

  // map of basis format to engine pixel format
  const basisToEngineMapping = (basisFormat, deviceDetails) => {
    switch (basisFormat) {
      case BASIS_FORMAT.cTFETC1:
        return deviceDetails.formats.etc1 ? PIXEL_FORMAT.ETC1 : PIXEL_FORMAT.ETC2_RGB;
      case BASIS_FORMAT.cTFETC2:
        return PIXEL_FORMAT.ETC2_RGBA;
      case BASIS_FORMAT.cTFBC1:
        return PIXEL_FORMAT.DXT1;
      case BASIS_FORMAT.cTFBC3:
        return PIXEL_FORMAT.DXT5;
      case BASIS_FORMAT.cTFPVRTC1_4_RGB:
        return PIXEL_FORMAT.PVRTC_4BPP_RGB_1;
      case BASIS_FORMAT.cTFPVRTC1_4_RGBA:
        return PIXEL_FORMAT.PVRTC_4BPP_RGBA_1;
      case BASIS_FORMAT.cTFASTC_4x4:
        return PIXEL_FORMAT.ASTC_4x4;
      case BASIS_FORMAT.cTFATC_RGB:
        return PIXEL_FORMAT.ATC_RGB;
      case BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA:
        return PIXEL_FORMAT.ATC_RGBA;
      case BASIS_FORMAT.cTFRGBA32:
        return PIXEL_FORMAT.R8_G8_B8_A8;
      case BASIS_FORMAT.cTFRGB565:
        return PIXEL_FORMAT.R5_G6_B5;
      case BASIS_FORMAT.cTFRGBA4444:
        return PIXEL_FORMAT.R4_G4_B4_A4;
    }
  };

  // unswizzle two-component gggr8888 normal data into rgba8888
  const unswizzleGGGR = data => {
    // given R and G generate B
    const genB = function genB(R, G) {
      const r = R * (2.0 / 255.0) - 1.0;
      const g = G * (2.0 / 255.0) - 1.0;
      const b = Math.sqrt(1.0 - Math.min(1.0, r * r + g * g));
      return Math.max(0, Math.min(255, Math.floor((b + 1.0) * 0.5 * 255.0)));
    };
    for (let offset = 0; offset < data.length; offset += 4) {
      const R = data[offset + 3];
      const G = data[offset + 1];
      data[offset + 0] = R;
      data[offset + 2] = genB(R, G);
      data[offset + 3] = 255;
    }
    return data;
  };

  // pack rgba8888 data into rgb565
  const pack565 = data => {
    const result = new Uint16Array(data.length / 4);
    for (let offset = 0; offset < data.length; offset += 4) {
      const R = data[offset + 0];
      const G = data[offset + 1];
      const B = data[offset + 2];
      result[offset / 4] = (R & 0xf8) << 8 |
      // 5
      (G & 0xfc) << 3 |
      // 6
      B >> 3; // 5
    }

    return result;
  };
  const isPOT = (width, height) => {
    return (width & width - 1) === 0 && (height & height - 1) === 0;
  };
  const performanceNow = () => {
    return typeof performance !== 'undefined' ? performance.now() : 0;
  };

  // globals, set on worker init
  let basis;
  let rgbPriority;
  let rgbaPriority;
  const chooseTargetFormat = (deviceDetails, hasAlpha, isUASTC) => {
    // attempt to match file compression scheme with runtime compression
    if (isUASTC) {
      if (deviceDetails.formats.astc) {
        return 'astc';
      }
    } else {
      if (hasAlpha) {
        if (deviceDetails.formats.etc2) {
          return 'etc2';
        }
      } else {
        if (deviceDetails.formats.etc1 || deviceDetails.formats.etc2) {
          return 'etc1';
        }
      }
    }
    const testInOrder = priority => {
      for (let i = 0; i < priority.length; ++i) {
        const format = priority[i];
        if (deviceDetails.formats[format]) {
          return format;
        }
      }
      return 'none';
    };
    return testInOrder(hasAlpha ? rgbaPriority : rgbPriority);
  };

  // return true if the texture dimensions are valid for the target format
  const dimensionsValid = (width, height, format, webgl2) => {
    switch (format) {
      // etc1, 2
      case BASIS_FORMAT.cTFETC1:
      case BASIS_FORMAT.cTFETC2:
        // no size restrictions
        return true;
      // dxt1, 5
      case BASIS_FORMAT.cTFBC1:
      case BASIS_FORMAT.cTFBC3:
        // width and height must be multiple of 4
        return (width & 0x3) === 0 && (height & 0x3) === 0;
      // pvrtc
      case BASIS_FORMAT.cTFPVRTC1_4_RGB:
      case BASIS_FORMAT.cTFPVRTC1_4_RGBA:
        return isPOT(width, height) && (width === height || webgl2);
      // astc
      case BASIS_FORMAT.cTFASTC_4x4:
        return true;
      // atc
      case BASIS_FORMAT.cTFATC_RGB:
      case BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA:
        // TODO: remove atc support? looks like it's been removed from the webgl spec, see
        // https://www.khronos.org/registry/webgl/extensions/rejected/WEBGL_compressed_texture_atc/
        return true;
    }
  };
  const transcodeKTX2 = (url, data, options) => {
    if (!basis.KTX2File) {
      throw new Error('Basis transcoder module does not include support for KTX2.');
    }
    const funcStart = performanceNow();
    const basisFile = new basis.KTX2File(new Uint8Array(data));
    const width = basisFile.getWidth();
    const height = basisFile.getHeight();
    const levels = basisFile.getLevels();
    const hasAlpha = !!basisFile.getHasAlpha();
    const isUASTC = basisFile.isUASTC && basisFile.isUASTC();
    if (!width || !height || !levels) {
      basisFile.close();
      basisFile.delete();
      throw new Error(`Invalid image dimensions url=${url} width=${width} height=${height} levels=${levels}`);
    }

    // choose the target format
    const format = chooseTargetFormat(options.deviceDetails, hasAlpha, isUASTC);

    // unswizzle gggr textures under pvr compression
    const unswizzle = !!options.isGGGR && format === 'pvr';

    // convert to basis format taking into consideration platform restrictions
    let basisFormat;
    if (unswizzle) {
      // in order to unswizzle we need gggr8888
      basisFormat = BASIS_FORMAT.cTFRGBA32;
    } else {
      // select output format based on supported formats
      basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];

      // if image dimensions don't work on target, fall back to uncompressed
      if (!dimensionsValid(width, height, basisFormat, options.deviceDetails.webgl2)) {
        basisFormat = hasAlpha ? BASIS_FORMAT.cTFRGBA32 : BASIS_FORMAT.cTFRGB565;
      }
    }
    if (!basisFile.startTranscoding()) {
      basisFile.close();
      basisFile.delete();
      throw new Error('Failed to start transcoding url=' + url);
    }
    let i;
    const levelData = [];
    for (let mip = 0; mip < levels; ++mip) {
      const dstSize = basisFile.getImageTranscodedSizeInBytes(mip, 0, 0, basisFormat);
      const dst = new Uint8Array(dstSize);
      if (!basisFile.transcodeImage(dst, mip, 0, 0, basisFormat, 0, -1, -1)) {
        basisFile.close();
        basisFile.delete();
        throw new Error('Failed to transcode image url=' + url);
      }
      const is16BitFormat = basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444;
      levelData.push(is16BitFormat ? new Uint16Array(dst.buffer) : dst);
    }
    basisFile.close();
    basisFile.delete();

    // handle unswizzle option
    if (unswizzle) {
      basisFormat = BASIS_FORMAT.cTFRGB565;
      for (i = 0; i < levelData.length; ++i) {
        levelData[i] = pack565(unswizzleGGGR(levelData[i]));
      }
    }
    return {
      format: basisToEngineMapping(basisFormat, options.deviceDetails),
      width: width,
      height: height,
      levels: levelData,
      cubemap: false,
      transcodeTime: performanceNow() - funcStart,
      url: url,
      unswizzledGGGR: unswizzle
    };
  };

  // transcode the basis super-compressed data into one of the runtime gpu native formats
  const transcodeBasis = (url, data, options) => {
    const funcStart = performanceNow();
    const basisFile = new basis.BasisFile(new Uint8Array(data));
    const width = basisFile.getImageWidth(0, 0);
    const height = basisFile.getImageHeight(0, 0);
    const images = basisFile.getNumImages();
    const levels = basisFile.getNumLevels(0);
    const hasAlpha = !!basisFile.getHasAlpha();
    const isUASTC = basisFile.isUASTC && basisFile.isUASTC();
    if (!width || !height || !images || !levels) {
      basisFile.close();
      basisFile.delete();
      throw new Error(`Invalid image dimensions url=${url} width=${width} height=${height} images=${images} levels=${levels}`);
    }

    // choose the target format
    const format = chooseTargetFormat(options.deviceDetails, hasAlpha, isUASTC);

    // unswizzle gggr textures under pvr compression
    const unswizzle = !!options.isGGGR && format === 'pvr';

    // convert to basis format taking into consideration platform restrictions
    let basisFormat;
    if (unswizzle) {
      // in order to unswizzle we need gggr8888
      basisFormat = BASIS_FORMAT.cTFRGBA32;
    } else {
      // select output format based on supported formats
      basisFormat = hasAlpha ? alphaMapping[format] : opaqueMapping[format];

      // if image dimensions don't work on target, fall back to uncompressed
      if (!dimensionsValid(width, height, basisFormat, options.deviceDetails.webgl2)) {
        basisFormat = hasAlpha ? BASIS_FORMAT.cTFRGBA32 : BASIS_FORMAT.cTFRGB565;
      }
    }
    if (!basisFile.startTranscoding()) {
      basisFile.close();
      basisFile.delete();
      throw new Error('Failed to start transcoding url=' + url);
    }
    let i;
    const levelData = [];
    for (let mip = 0; mip < levels; ++mip) {
      const dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, basisFormat);
      const dst = new Uint8Array(dstSize);
      if (!basisFile.transcodeImage(dst, 0, mip, basisFormat, 0, 0)) {
        basisFile.close();
        basisFile.delete();
        throw new Error('Failed to transcode image url=' + url);
      }
      const is16BitFormat = basisFormat === BASIS_FORMAT.cTFRGB565 || basisFormat === BASIS_FORMAT.cTFRGBA4444;
      levelData.push(is16BitFormat ? new Uint16Array(dst.buffer) : dst);
    }
    basisFile.close();
    basisFile.delete();

    // handle unswizzle option
    if (unswizzle) {
      basisFormat = BASIS_FORMAT.cTFRGB565;
      for (i = 0; i < levelData.length; ++i) {
        levelData[i] = pack565(unswizzleGGGR(levelData[i]));
      }
    }
    return {
      format: basisToEngineMapping(basisFormat, options.deviceDetails),
      width: width,
      height: height,
      levels: levelData,
      cubemap: false,
      transcodeTime: performanceNow() - funcStart,
      url: url,
      unswizzledGGGR: unswizzle
    };
  };
  const transcode = (url, data, options) => {
    return options.isKTX2 ? transcodeKTX2(url, data, options) : transcodeBasis(url, data, options);
  };

  // download and transcode the file given the basis module and
  // file url
  const workerTranscode = (url, data, options) => {
    try {
      const result = transcode(url, data, options);
      result.levels = result.levels.map(v => v.buffer);
      self.postMessage({
        url: url,
        data: result
      }, result.levels);
    } catch (err) {
      self.postMessage({
        url: url,
        err: err
      }, null);
    }
  };
  const workerInit = (config, callback) => {
    // initialize the wasm module
    const instantiateWasmFunc = (imports, successCallback) => {
      WebAssembly.instantiate(config.module, imports).then(result => {
        successCallback(result);
      }).catch(reason => {
        console.error('instantiate failed + ' + reason);
      });
      return {};
    };
    self.BASIS(config.module ? {
      instantiateWasm: instantiateWasmFunc
    } : null).then(instance => {
      instance.initializeBasis();

      // set globals
      basis = instance;
      rgbPriority = config.rgbPriority;
      rgbaPriority = config.rgbaPriority;
      callback(null);
    });
  };

  // handle incoming worker requests
  const queue = [];
  self.onmessage = message => {
    const data = message.data;
    switch (data.type) {
      case 'init':
        workerInit(data.config, () => {
          for (let i = 0; i < queue.length; ++i) {
            workerTranscode(queue[i].url, queue[i].data, queue[i].options);
          }
          queue.length = 0;
        });
        break;
      case 'transcode':
        if (basis) {
          workerTranscode(data.url, data.data, data.options);
        } else {
          queue.push(data);
        }
        break;
    }
  };
}

export { BasisWorker };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzaXMtd29ya2VyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2hhbmRsZXJzL2Jhc2lzLXdvcmtlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBCYXNpcyB3b3JrZXJcbmZ1bmN0aW9uIEJhc2lzV29ya2VyKCkge1xuICAgIC8vIGJhc2lzIGNvbXByZXNzaW9uIGZvcm1hdCBlbnVtcywgcmVwcm9kdWNlZCBoZXJlXG4gICAgY29uc3QgQkFTSVNfRk9STUFUID0ge1xuICAgICAgICBjVEZFVEMxOiAwLCAgICAgICAgICAgICAgICAgICAgICAgICAvLyBldGMxXG4gICAgICAgIGNURkVUQzI6IDEsICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGV0YzJcbiAgICAgICAgY1RGQkMxOiAyLCAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZHh0MVxuICAgICAgICBjVEZCQzM6IDMsICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBkeHQ1XG4gICAgICAgIGNURlBWUlRDMV80X1JHQjogOCwgICAgICAgICAgICAgICAgIC8vIFBWUlRDMSByZ2JcbiAgICAgICAgY1RGUFZSVEMxXzRfUkdCQTogOSwgICAgICAgICAgICAgICAgLy8gUFZSVEMxIHJnYmFcbiAgICAgICAgY1RGQVNUQ180eDQ6IDEwLCAgICAgICAgICAgICAgICAgICAgLy8gQVNUQ1xuICAgICAgICBjVEZBVENfUkdCOiAxMSwgICAgICAgICAgICAgICAgICAgICAvLyBBVEMgcmdiXG4gICAgICAgIGNURkFUQ19SR0JBX0lOVEVSUE9MQVRFRF9BTFBIQTogMTIsIC8vIEFUQyByZ2JhXG4gICAgICAgIC8vIHVuY29tcHJlc3NlZCAoZmFsbGJhY2spIGZvcm1hdHNcbiAgICAgICAgY1RGUkdCQTMyOiAxMywgICAgICAgICAgICAgICAgICAgICAgLy8gcmdiYSA4ODg4XG4gICAgICAgIGNURlJHQjU2NTogMTQsICAgICAgICAgICAgICAgICAgICAgIC8vIHJnYiA1NjVcbiAgICAgICAgY1RGUkdCQTQ0NDQ6IDE2ICAgICAgICAgICAgICAgICAgICAgLy8gcmdiYSA0NDQ0XG4gICAgfTtcblxuICAgIC8vIG1hcCBvZiBHUFUgdG8gYmFzaXMgZm9ybWF0IGZvciB0ZXh0dXJlcyB3aXRob3V0IGFscGhhXG4gICAgY29uc3Qgb3BhcXVlTWFwcGluZyA9IHtcbiAgICAgICAgYXN0YzogQkFTSVNfRk9STUFULmNURkFTVENfNHg0LFxuICAgICAgICBkeHQ6IEJBU0lTX0ZPUk1BVC5jVEZCQzEsXG4gICAgICAgIGV0YzE6IEJBU0lTX0ZPUk1BVC5jVEZFVEMxLFxuICAgICAgICBldGMyOiBCQVNJU19GT1JNQVQuY1RGRVRDMSxcbiAgICAgICAgcHZyOiBCQVNJU19GT1JNQVQuY1RGUFZSVEMxXzRfUkdCLFxuICAgICAgICBhdGM6IEJBU0lTX0ZPUk1BVC5jVEZBVENfUkdCLFxuICAgICAgICBub25lOiBCQVNJU19GT1JNQVQuY1RGUkdCNTY1XG4gICAgfTtcblxuICAgIC8vIG1hcCBvZiBHUFUgdG8gYmFzaXMgZm9ybWF0IGZvciB0ZXh0dXJlcyB3aXRoIGFscGhhXG4gICAgY29uc3QgYWxwaGFNYXBwaW5nID0ge1xuICAgICAgICBhc3RjOiBCQVNJU19GT1JNQVQuY1RGQVNUQ180eDQsXG4gICAgICAgIGR4dDogQkFTSVNfRk9STUFULmNURkJDMyxcbiAgICAgICAgZXRjMTogQkFTSVNfRk9STUFULmNURlJHQkE0NDQ0LFxuICAgICAgICBldGMyOiBCQVNJU19GT1JNQVQuY1RGRVRDMixcbiAgICAgICAgcHZyOiBCQVNJU19GT1JNQVQuY1RGUFZSVEMxXzRfUkdCQSxcbiAgICAgICAgYXRjOiBCQVNJU19GT1JNQVQuY1RGQVRDX1JHQkFfSU5URVJQT0xBVEVEX0FMUEhBLFxuICAgICAgICBub25lOiBCQVNJU19GT1JNQVQuY1RGUkdCQTQ0NDRcbiAgICB9O1xuXG4gICAgLy8gZW5naW5lIHBpeGVsIGZvcm1hdCBjb25zdGFudHMsIHJlcHJvZHVjZWQgaGVyZVxuICAgIGNvbnN0IFBJWEVMX0ZPUk1BVCA9IHtcbiAgICAgICAgRVRDMTogMjEsXG4gICAgICAgIEVUQzJfUkdCOiAyMixcbiAgICAgICAgRVRDMl9SR0JBOiAyMyxcbiAgICAgICAgRFhUMTogOCxcbiAgICAgICAgRFhUNTogMTAsXG4gICAgICAgIFBWUlRDXzRCUFBfUkdCXzE6IDI2LFxuICAgICAgICBQVlJUQ180QlBQX1JHQkFfMTogMjcsXG4gICAgICAgIEFTVENfNHg0OiAyOCxcbiAgICAgICAgQVRDX1JHQjogMjksXG4gICAgICAgIEFUQ19SR0JBOiAzMCxcbiAgICAgICAgUjhfRzhfQjhfQTg6IDcsXG4gICAgICAgIFI1X0c2X0I1OiAzLFxuICAgICAgICBSNF9HNF9CNF9BNDogNVxuICAgIH07XG5cbiAgICAvLyBtYXAgb2YgYmFzaXMgZm9ybWF0IHRvIGVuZ2luZSBwaXhlbCBmb3JtYXRcbiAgICBjb25zdCBiYXNpc1RvRW5naW5lTWFwcGluZyA9IChiYXNpc0Zvcm1hdCwgZGV2aWNlRGV0YWlscykgPT4ge1xuICAgICAgICBzd2l0Y2ggKGJhc2lzRm9ybWF0KSB7XG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZFVEMxOiByZXR1cm4gZGV2aWNlRGV0YWlscy5mb3JtYXRzLmV0YzEgPyBQSVhFTF9GT1JNQVQuRVRDMSA6IFBJWEVMX0ZPUk1BVC5FVEMyX1JHQjtcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkVUQzI6IHJldHVybiBQSVhFTF9GT1JNQVQuRVRDMl9SR0JBO1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGQkMxOiByZXR1cm4gUElYRUxfRk9STUFULkRYVDE7XG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZCQzM6IHJldHVybiBQSVhFTF9GT1JNQVQuRFhUNTtcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURlBWUlRDMV80X1JHQjogcmV0dXJuIFBJWEVMX0ZPUk1BVC5QVlJUQ180QlBQX1JHQl8xO1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGUFZSVEMxXzRfUkdCQTogcmV0dXJuIFBJWEVMX0ZPUk1BVC5QVlJUQ180QlBQX1JHQkFfMTtcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkFTVENfNHg0OiByZXR1cm4gUElYRUxfRk9STUFULkFTVENfNHg0O1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGQVRDX1JHQjogcmV0dXJuIFBJWEVMX0ZPUk1BVC5BVENfUkdCO1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGQVRDX1JHQkFfSU5URVJQT0xBVEVEX0FMUEhBOiByZXR1cm4gUElYRUxfRk9STUFULkFUQ19SR0JBO1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGUkdCQTMyOiByZXR1cm4gUElYRUxfRk9STUFULlI4X0c4X0I4X0E4O1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGUkdCNTY1OiByZXR1cm4gUElYRUxfRk9STUFULlI1X0c2X0I1O1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGUkdCQTQ0NDQ6IHJldHVybiBQSVhFTF9GT1JNQVQuUjRfRzRfQjRfQTQ7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gdW5zd2l6emxlIHR3by1jb21wb25lbnQgZ2dncjg4ODggbm9ybWFsIGRhdGEgaW50byByZ2JhODg4OFxuICAgIGNvbnN0IHVuc3dpenpsZUdHR1IgPSAoZGF0YSkgPT4ge1xuICAgICAgICAvLyBnaXZlbiBSIGFuZCBHIGdlbmVyYXRlIEJcbiAgICAgICAgY29uc3QgZ2VuQiA9IGZ1bmN0aW9uIChSLCBHKSB7XG4gICAgICAgICAgICBjb25zdCByID0gUiAqICgyLjAgLyAyNTUuMCkgLSAxLjA7XG4gICAgICAgICAgICBjb25zdCBnID0gRyAqICgyLjAgLyAyNTUuMCkgLSAxLjA7XG4gICAgICAgICAgICBjb25zdCBiID0gTWF0aC5zcXJ0KDEuMCAtIE1hdGgubWluKDEuMCwgciAqIHIgKyBnICogZykpO1xuICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIE1hdGgubWluKDI1NSwgTWF0aC5mbG9vcigoKGIgKyAxLjApICogMC41KSAqIDI1NS4wKSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGZvciAobGV0IG9mZnNldCA9IDA7IG9mZnNldCA8IGRhdGEubGVuZ3RoOyBvZmZzZXQgKz0gNCkge1xuICAgICAgICAgICAgY29uc3QgUiA9IGRhdGFbb2Zmc2V0ICsgM107XG4gICAgICAgICAgICBjb25zdCBHID0gZGF0YVtvZmZzZXQgKyAxXTtcbiAgICAgICAgICAgIGRhdGFbb2Zmc2V0ICsgMF0gPSBSO1xuICAgICAgICAgICAgZGF0YVtvZmZzZXQgKyAyXSA9IGdlbkIoUiwgRyk7XG4gICAgICAgICAgICBkYXRhW29mZnNldCArIDNdID0gMjU1O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfTtcblxuICAgIC8vIHBhY2sgcmdiYTg4ODggZGF0YSBpbnRvIHJnYjU2NVxuICAgIGNvbnN0IHBhY2s1NjUgPSAoZGF0YSkgPT4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBuZXcgVWludDE2QXJyYXkoZGF0YS5sZW5ndGggLyA0KTtcblxuICAgICAgICBmb3IgKGxldCBvZmZzZXQgPSAwOyBvZmZzZXQgPCBkYXRhLmxlbmd0aDsgb2Zmc2V0ICs9IDQpIHtcbiAgICAgICAgICAgIGNvbnN0IFIgPSBkYXRhW29mZnNldCArIDBdO1xuICAgICAgICAgICAgY29uc3QgRyA9IGRhdGFbb2Zmc2V0ICsgMV07XG4gICAgICAgICAgICBjb25zdCBCID0gZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgICAgICAgIHJlc3VsdFtvZmZzZXQgLyA0XSA9ICgoUiAmIDB4ZjgpIDw8IDgpIHwgIC8vIDVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICgoRyAmIDB4ZmMpIDw8IDMpIHwgIC8vIDZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICgoQiA+PiAzKSk7ICAgICAgICAgIC8vIDVcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGNvbnN0IGlzUE9UID0gKHdpZHRoLCBoZWlnaHQpID0+IHtcbiAgICAgICAgcmV0dXJuICgod2lkdGggJiAod2lkdGggLSAxKSkgPT09IDApICYmICgoaGVpZ2h0ICYgKGhlaWdodCAtIDEpKSA9PT0gMCk7XG4gICAgfTtcblxuICAgIGNvbnN0IHBlcmZvcm1hbmNlTm93ID0gKCkgPT4ge1xuICAgICAgICByZXR1cm4gKHR5cGVvZiBwZXJmb3JtYW5jZSAhPT0gJ3VuZGVmaW5lZCcpID8gcGVyZm9ybWFuY2Uubm93KCkgOiAwO1xuICAgIH07XG5cbiAgICAvLyBnbG9iYWxzLCBzZXQgb24gd29ya2VyIGluaXRcbiAgICBsZXQgYmFzaXM7XG4gICAgbGV0IHJnYlByaW9yaXR5O1xuICAgIGxldCByZ2JhUHJpb3JpdHk7XG5cbiAgICBjb25zdCBjaG9vc2VUYXJnZXRGb3JtYXQgPSAoZGV2aWNlRGV0YWlscywgaGFzQWxwaGEsIGlzVUFTVEMpID0+IHtcbiAgICAgICAgLy8gYXR0ZW1wdCB0byBtYXRjaCBmaWxlIGNvbXByZXNzaW9uIHNjaGVtZSB3aXRoIHJ1bnRpbWUgY29tcHJlc3Npb25cbiAgICAgICAgaWYgKGlzVUFTVEMpIHtcbiAgICAgICAgICAgIGlmIChkZXZpY2VEZXRhaWxzLmZvcm1hdHMuYXN0Yykge1xuICAgICAgICAgICAgICAgIHJldHVybiAnYXN0Yyc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaGFzQWxwaGEpIHtcbiAgICAgICAgICAgICAgICBpZiAoZGV2aWNlRGV0YWlscy5mb3JtYXRzLmV0YzIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICdldGMyJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChkZXZpY2VEZXRhaWxzLmZvcm1hdHMuZXRjMSB8fCBkZXZpY2VEZXRhaWxzLmZvcm1hdHMuZXRjMikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ2V0YzEnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRlc3RJbk9yZGVyID0gKHByaW9yaXR5KSA9PiB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByaW9yaXR5Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0ID0gcHJpb3JpdHlbaV07XG4gICAgICAgICAgICAgICAgaWYgKGRldmljZURldGFpbHMuZm9ybWF0c1tmb3JtYXRdKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmb3JtYXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICdub25lJztcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gdGVzdEluT3JkZXIoaGFzQWxwaGEgPyByZ2JhUHJpb3JpdHkgOiByZ2JQcmlvcml0eSk7XG4gICAgfTtcblxuICAgIC8vIHJldHVybiB0cnVlIGlmIHRoZSB0ZXh0dXJlIGRpbWVuc2lvbnMgYXJlIHZhbGlkIGZvciB0aGUgdGFyZ2V0IGZvcm1hdFxuICAgIGNvbnN0IGRpbWVuc2lvbnNWYWxpZCA9ICh3aWR0aCwgaGVpZ2h0LCBmb3JtYXQsIHdlYmdsMikgPT4ge1xuICAgICAgICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgICAgICAgICAgLy8gZXRjMSwgMlxuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGRVRDMTpcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkVUQzI6XG4gICAgICAgICAgICAgICAgLy8gbm8gc2l6ZSByZXN0cmljdGlvbnNcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIC8vIGR4dDEsIDVcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkJDMTpcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkJDMzpcbiAgICAgICAgICAgICAgICAvLyB3aWR0aCBhbmQgaGVpZ2h0IG11c3QgYmUgbXVsdGlwbGUgb2YgNFxuICAgICAgICAgICAgICAgIHJldHVybiAoKHdpZHRoICYgMHgzKSA9PT0gMCkgJiYgKChoZWlnaHQgJiAweDMpID09PSAwKTtcbiAgICAgICAgICAgIC8vIHB2cnRjXG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZQVlJUQzFfNF9SR0I6XG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZQVlJUQzFfNF9SR0JBOlxuICAgICAgICAgICAgICAgIHJldHVybiBpc1BPVCh3aWR0aCwgaGVpZ2h0KSAmJiAoKHdpZHRoID09PSBoZWlnaHQpIHx8IHdlYmdsMik7XG4gICAgICAgICAgICAvLyBhc3RjXG4gICAgICAgICAgICBjYXNlIEJBU0lTX0ZPUk1BVC5jVEZBU1RDXzR4NDpcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIC8vIGF0Y1xuICAgICAgICAgICAgY2FzZSBCQVNJU19GT1JNQVQuY1RGQVRDX1JHQjpcbiAgICAgICAgICAgIGNhc2UgQkFTSVNfRk9STUFULmNURkFUQ19SR0JBX0lOVEVSUE9MQVRFRF9BTFBIQTpcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiByZW1vdmUgYXRjIHN1cHBvcnQ/IGxvb2tzIGxpa2UgaXQncyBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgd2ViZ2wgc3BlYywgc2VlXG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly93d3cua2hyb25vcy5vcmcvcmVnaXN0cnkvd2ViZ2wvZXh0ZW5zaW9ucy9yZWplY3RlZC9XRUJHTF9jb21wcmVzc2VkX3RleHR1cmVfYXRjL1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IHRyYW5zY29kZUtUWDIgPSAodXJsLCBkYXRhLCBvcHRpb25zKSA9PiB7XG4gICAgICAgIGlmICghYmFzaXMuS1RYMkZpbGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQmFzaXMgdHJhbnNjb2RlciBtb2R1bGUgZG9lcyBub3QgaW5jbHVkZSBzdXBwb3J0IGZvciBLVFgyLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZnVuY1N0YXJ0ID0gcGVyZm9ybWFuY2VOb3coKTtcbiAgICAgICAgY29uc3QgYmFzaXNGaWxlID0gbmV3IGJhc2lzLktUWDJGaWxlKG5ldyBVaW50OEFycmF5KGRhdGEpKTtcblxuICAgICAgICBjb25zdCB3aWR0aCA9IGJhc2lzRmlsZS5nZXRXaWR0aCgpO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBiYXNpc0ZpbGUuZ2V0SGVpZ2h0KCk7XG4gICAgICAgIGNvbnN0IGxldmVscyA9IGJhc2lzRmlsZS5nZXRMZXZlbHMoKTtcbiAgICAgICAgY29uc3QgaGFzQWxwaGEgPSAhIWJhc2lzRmlsZS5nZXRIYXNBbHBoYSgpO1xuICAgICAgICBjb25zdCBpc1VBU1RDID0gYmFzaXNGaWxlLmlzVUFTVEMgJiYgYmFzaXNGaWxlLmlzVUFTVEMoKTtcblxuICAgICAgICBpZiAoIXdpZHRoIHx8ICFoZWlnaHQgfHwgIWxldmVscykge1xuICAgICAgICAgICAgYmFzaXNGaWxlLmNsb3NlKCk7XG4gICAgICAgICAgICBiYXNpc0ZpbGUuZGVsZXRlKCk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgaW1hZ2UgZGltZW5zaW9ucyB1cmw9JHt1cmx9IHdpZHRoPSR7d2lkdGh9IGhlaWdodD0ke2hlaWdodH0gbGV2ZWxzPSR7bGV2ZWxzfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2hvb3NlIHRoZSB0YXJnZXQgZm9ybWF0XG4gICAgICAgIGNvbnN0IGZvcm1hdCA9IGNob29zZVRhcmdldEZvcm1hdChvcHRpb25zLmRldmljZURldGFpbHMsIGhhc0FscGhhLCBpc1VBU1RDKTtcblxuICAgICAgICAvLyB1bnN3aXp6bGUgZ2dnciB0ZXh0dXJlcyB1bmRlciBwdnIgY29tcHJlc3Npb25cbiAgICAgICAgY29uc3QgdW5zd2l6emxlID0gISFvcHRpb25zLmlzR0dHUiAmJiBmb3JtYXQgPT09ICdwdnInO1xuXG4gICAgICAgIC8vIGNvbnZlcnQgdG8gYmFzaXMgZm9ybWF0IHRha2luZyBpbnRvIGNvbnNpZGVyYXRpb24gcGxhdGZvcm0gcmVzdHJpY3Rpb25zXG4gICAgICAgIGxldCBiYXNpc0Zvcm1hdDtcbiAgICAgICAgaWYgKHVuc3dpenpsZSkge1xuICAgICAgICAgICAgLy8gaW4gb3JkZXIgdG8gdW5zd2l6emxlIHdlIG5lZWQgZ2dncjg4ODhcbiAgICAgICAgICAgIGJhc2lzRm9ybWF0ID0gQkFTSVNfRk9STUFULmNURlJHQkEzMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHNlbGVjdCBvdXRwdXQgZm9ybWF0IGJhc2VkIG9uIHN1cHBvcnRlZCBmb3JtYXRzXG4gICAgICAgICAgICBiYXNpc0Zvcm1hdCA9IGhhc0FscGhhID8gYWxwaGFNYXBwaW5nW2Zvcm1hdF0gOiBvcGFxdWVNYXBwaW5nW2Zvcm1hdF07XG5cbiAgICAgICAgICAgIC8vIGlmIGltYWdlIGRpbWVuc2lvbnMgZG9uJ3Qgd29yayBvbiB0YXJnZXQsIGZhbGwgYmFjayB0byB1bmNvbXByZXNzZWRcbiAgICAgICAgICAgIGlmICghZGltZW5zaW9uc1ZhbGlkKHdpZHRoLCBoZWlnaHQsIGJhc2lzRm9ybWF0LCBvcHRpb25zLmRldmljZURldGFpbHMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgIGJhc2lzRm9ybWF0ID0gaGFzQWxwaGEgPyBCQVNJU19GT1JNQVQuY1RGUkdCQTMyIDogQkFTSVNfRk9STUFULmNURlJHQjU2NTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghYmFzaXNGaWxlLnN0YXJ0VHJhbnNjb2RpbmcoKSkge1xuICAgICAgICAgICAgYmFzaXNGaWxlLmNsb3NlKCk7XG4gICAgICAgICAgICBiYXNpc0ZpbGUuZGVsZXRlKCk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBzdGFydCB0cmFuc2NvZGluZyB1cmw9JyArIHVybCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgaTtcblxuICAgICAgICBjb25zdCBsZXZlbERhdGEgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgbWlwID0gMDsgbWlwIDwgbGV2ZWxzOyArK21pcCkge1xuICAgICAgICAgICAgY29uc3QgZHN0U2l6ZSA9IGJhc2lzRmlsZS5nZXRJbWFnZVRyYW5zY29kZWRTaXplSW5CeXRlcyhtaXAsIDAsIDAsIGJhc2lzRm9ybWF0KTtcbiAgICAgICAgICAgIGNvbnN0IGRzdCA9IG5ldyBVaW50OEFycmF5KGRzdFNpemUpO1xuXG4gICAgICAgICAgICBpZiAoIWJhc2lzRmlsZS50cmFuc2NvZGVJbWFnZShkc3QsIG1pcCwgMCwgMCwgYmFzaXNGb3JtYXQsIDAsIC0xLCAtMSkpIHtcbiAgICAgICAgICAgICAgICBiYXNpc0ZpbGUuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICBiYXNpc0ZpbGUuZGVsZXRlKCk7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gdHJhbnNjb2RlIGltYWdlIHVybD0nICsgdXJsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaXMxNkJpdEZvcm1hdCA9IChiYXNpc0Zvcm1hdCA9PT0gQkFTSVNfRk9STUFULmNURlJHQjU2NSB8fCBiYXNpc0Zvcm1hdCA9PT0gQkFTSVNfRk9STUFULmNURlJHQkE0NDQ0KTtcblxuICAgICAgICAgICAgbGV2ZWxEYXRhLnB1c2goaXMxNkJpdEZvcm1hdCA/IG5ldyBVaW50MTZBcnJheShkc3QuYnVmZmVyKSA6IGRzdCk7XG4gICAgICAgIH1cblxuICAgICAgICBiYXNpc0ZpbGUuY2xvc2UoKTtcbiAgICAgICAgYmFzaXNGaWxlLmRlbGV0ZSgpO1xuXG4gICAgICAgIC8vIGhhbmRsZSB1bnN3aXp6bGUgb3B0aW9uXG4gICAgICAgIGlmICh1bnN3aXp6bGUpIHtcbiAgICAgICAgICAgIGJhc2lzRm9ybWF0ID0gQkFTSVNfRk9STUFULmNURlJHQjU2NTtcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsZXZlbERhdGEubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICBsZXZlbERhdGFbaV0gPSBwYWNrNTY1KHVuc3dpenpsZUdHR1IobGV2ZWxEYXRhW2ldKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZm9ybWF0OiBiYXNpc1RvRW5naW5lTWFwcGluZyhiYXNpc0Zvcm1hdCwgb3B0aW9ucy5kZXZpY2VEZXRhaWxzKSxcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0LFxuICAgICAgICAgICAgbGV2ZWxzOiBsZXZlbERhdGEsXG4gICAgICAgICAgICBjdWJlbWFwOiBmYWxzZSxcbiAgICAgICAgICAgIHRyYW5zY29kZVRpbWU6IHBlcmZvcm1hbmNlTm93KCkgLSBmdW5jU3RhcnQsXG4gICAgICAgICAgICB1cmw6IHVybCxcbiAgICAgICAgICAgIHVuc3dpenpsZWRHR0dSOiB1bnN3aXp6bGVcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLy8gdHJhbnNjb2RlIHRoZSBiYXNpcyBzdXBlci1jb21wcmVzc2VkIGRhdGEgaW50byBvbmUgb2YgdGhlIHJ1bnRpbWUgZ3B1IG5hdGl2ZSBmb3JtYXRzXG4gICAgY29uc3QgdHJhbnNjb2RlQmFzaXMgPSAodXJsLCBkYXRhLCBvcHRpb25zKSA9PiB7XG4gICAgICAgIGNvbnN0IGZ1bmNTdGFydCA9IHBlcmZvcm1hbmNlTm93KCk7XG4gICAgICAgIGNvbnN0IGJhc2lzRmlsZSA9IG5ldyBiYXNpcy5CYXNpc0ZpbGUobmV3IFVpbnQ4QXJyYXkoZGF0YSkpO1xuXG4gICAgICAgIGNvbnN0IHdpZHRoID0gYmFzaXNGaWxlLmdldEltYWdlV2lkdGgoMCwgMCk7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IGJhc2lzRmlsZS5nZXRJbWFnZUhlaWdodCgwLCAwKTtcbiAgICAgICAgY29uc3QgaW1hZ2VzID0gYmFzaXNGaWxlLmdldE51bUltYWdlcygpO1xuICAgICAgICBjb25zdCBsZXZlbHMgPSBiYXNpc0ZpbGUuZ2V0TnVtTGV2ZWxzKDApO1xuICAgICAgICBjb25zdCBoYXNBbHBoYSA9ICEhYmFzaXNGaWxlLmdldEhhc0FscGhhKCk7XG4gICAgICAgIGNvbnN0IGlzVUFTVEMgPSBiYXNpc0ZpbGUuaXNVQVNUQyAmJiBiYXNpc0ZpbGUuaXNVQVNUQygpO1xuXG4gICAgICAgIGlmICghd2lkdGggfHwgIWhlaWdodCB8fCAhaW1hZ2VzIHx8ICFsZXZlbHMpIHtcbiAgICAgICAgICAgIGJhc2lzRmlsZS5jbG9zZSgpO1xuICAgICAgICAgICAgYmFzaXNGaWxlLmRlbGV0ZSgpO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGltYWdlIGRpbWVuc2lvbnMgdXJsPSR7dXJsfSB3aWR0aD0ke3dpZHRofSBoZWlnaHQ9JHtoZWlnaHR9IGltYWdlcz0ke2ltYWdlc30gbGV2ZWxzPSR7bGV2ZWxzfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY2hvb3NlIHRoZSB0YXJnZXQgZm9ybWF0XG4gICAgICAgIGNvbnN0IGZvcm1hdCA9IGNob29zZVRhcmdldEZvcm1hdChvcHRpb25zLmRldmljZURldGFpbHMsIGhhc0FscGhhLCBpc1VBU1RDKTtcblxuICAgICAgICAvLyB1bnN3aXp6bGUgZ2dnciB0ZXh0dXJlcyB1bmRlciBwdnIgY29tcHJlc3Npb25cbiAgICAgICAgY29uc3QgdW5zd2l6emxlID0gISFvcHRpb25zLmlzR0dHUiAmJiBmb3JtYXQgPT09ICdwdnInO1xuXG4gICAgICAgIC8vIGNvbnZlcnQgdG8gYmFzaXMgZm9ybWF0IHRha2luZyBpbnRvIGNvbnNpZGVyYXRpb24gcGxhdGZvcm0gcmVzdHJpY3Rpb25zXG4gICAgICAgIGxldCBiYXNpc0Zvcm1hdDtcbiAgICAgICAgaWYgKHVuc3dpenpsZSkge1xuICAgICAgICAgICAgLy8gaW4gb3JkZXIgdG8gdW5zd2l6emxlIHdlIG5lZWQgZ2dncjg4ODhcbiAgICAgICAgICAgIGJhc2lzRm9ybWF0ID0gQkFTSVNfRk9STUFULmNURlJHQkEzMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHNlbGVjdCBvdXRwdXQgZm9ybWF0IGJhc2VkIG9uIHN1cHBvcnRlZCBmb3JtYXRzXG4gICAgICAgICAgICBiYXNpc0Zvcm1hdCA9IGhhc0FscGhhID8gYWxwaGFNYXBwaW5nW2Zvcm1hdF0gOiBvcGFxdWVNYXBwaW5nW2Zvcm1hdF07XG5cbiAgICAgICAgICAgIC8vIGlmIGltYWdlIGRpbWVuc2lvbnMgZG9uJ3Qgd29yayBvbiB0YXJnZXQsIGZhbGwgYmFjayB0byB1bmNvbXByZXNzZWRcbiAgICAgICAgICAgIGlmICghZGltZW5zaW9uc1ZhbGlkKHdpZHRoLCBoZWlnaHQsIGJhc2lzRm9ybWF0LCBvcHRpb25zLmRldmljZURldGFpbHMud2ViZ2wyKSkge1xuICAgICAgICAgICAgICAgIGJhc2lzRm9ybWF0ID0gaGFzQWxwaGEgPyBCQVNJU19GT1JNQVQuY1RGUkdCQTMyIDogQkFTSVNfRk9STUFULmNURlJHQjU2NTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghYmFzaXNGaWxlLnN0YXJ0VHJhbnNjb2RpbmcoKSkge1xuICAgICAgICAgICAgYmFzaXNGaWxlLmNsb3NlKCk7XG4gICAgICAgICAgICBiYXNpc0ZpbGUuZGVsZXRlKCk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byBzdGFydCB0cmFuc2NvZGluZyB1cmw9JyArIHVybCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgaTtcblxuICAgICAgICBjb25zdCBsZXZlbERhdGEgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgbWlwID0gMDsgbWlwIDwgbGV2ZWxzOyArK21pcCkge1xuICAgICAgICAgICAgY29uc3QgZHN0U2l6ZSA9IGJhc2lzRmlsZS5nZXRJbWFnZVRyYW5zY29kZWRTaXplSW5CeXRlcygwLCBtaXAsIGJhc2lzRm9ybWF0KTtcbiAgICAgICAgICAgIGNvbnN0IGRzdCA9IG5ldyBVaW50OEFycmF5KGRzdFNpemUpO1xuXG4gICAgICAgICAgICBpZiAoIWJhc2lzRmlsZS50cmFuc2NvZGVJbWFnZShkc3QsIDAsIG1pcCwgYmFzaXNGb3JtYXQsIDAsIDApKSB7XG4gICAgICAgICAgICAgICAgYmFzaXNGaWxlLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgYmFzaXNGaWxlLmRlbGV0ZSgpO1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHRyYW5zY29kZSBpbWFnZSB1cmw9JyArIHVybCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlzMTZCaXRGb3JtYXQgPSAoYmFzaXNGb3JtYXQgPT09IEJBU0lTX0ZPUk1BVC5jVEZSR0I1NjUgfHwgYmFzaXNGb3JtYXQgPT09IEJBU0lTX0ZPUk1BVC5jVEZSR0JBNDQ0NCk7XG5cbiAgICAgICAgICAgIGxldmVsRGF0YS5wdXNoKGlzMTZCaXRGb3JtYXQgPyBuZXcgVWludDE2QXJyYXkoZHN0LmJ1ZmZlcikgOiBkc3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgYmFzaXNGaWxlLmNsb3NlKCk7XG4gICAgICAgIGJhc2lzRmlsZS5kZWxldGUoKTtcblxuICAgICAgICAvLyBoYW5kbGUgdW5zd2l6emxlIG9wdGlvblxuICAgICAgICBpZiAodW5zd2l6emxlKSB7XG4gICAgICAgICAgICBiYXNpc0Zvcm1hdCA9IEJBU0lTX0ZPUk1BVC5jVEZSR0I1NjU7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGV2ZWxEYXRhLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgbGV2ZWxEYXRhW2ldID0gcGFjazU2NSh1bnN3aXp6bGVHR0dSKGxldmVsRGF0YVtpXSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGZvcm1hdDogYmFzaXNUb0VuZ2luZU1hcHBpbmcoYmFzaXNGb3JtYXQsIG9wdGlvbnMuZGV2aWNlRGV0YWlscyksXG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIGxldmVsczogbGV2ZWxEYXRhLFxuICAgICAgICAgICAgY3ViZW1hcDogZmFsc2UsXG4gICAgICAgICAgICB0cmFuc2NvZGVUaW1lOiBwZXJmb3JtYW5jZU5vdygpIC0gZnVuY1N0YXJ0LFxuICAgICAgICAgICAgdXJsOiB1cmwsXG4gICAgICAgICAgICB1bnN3aXp6bGVkR0dHUjogdW5zd2l6emxlXG4gICAgICAgIH07XG4gICAgfTtcblxuICAgIGNvbnN0IHRyYW5zY29kZSA9ICh1cmwsIGRhdGEsIG9wdGlvbnMpID0+IHtcbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuaXNLVFgyID8gdHJhbnNjb2RlS1RYMih1cmwsIGRhdGEsIG9wdGlvbnMpIDogdHJhbnNjb2RlQmFzaXModXJsLCBkYXRhLCBvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgLy8gZG93bmxvYWQgYW5kIHRyYW5zY29kZSB0aGUgZmlsZSBnaXZlbiB0aGUgYmFzaXMgbW9kdWxlIGFuZFxuICAgIC8vIGZpbGUgdXJsXG4gICAgY29uc3Qgd29ya2VyVHJhbnNjb2RlID0gKHVybCwgZGF0YSwgb3B0aW9ucykgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdHJhbnNjb2RlKHVybCwgZGF0YSwgb3B0aW9ucyk7XG4gICAgICAgICAgICByZXN1bHQubGV2ZWxzID0gcmVzdWx0LmxldmVscy5tYXAodiA9PiB2LmJ1ZmZlcik7XG4gICAgICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHsgdXJsOiB1cmwsIGRhdGE6IHJlc3VsdCB9LCByZXN1bHQubGV2ZWxzKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKHsgdXJsOiB1cmwsIGVycjogZXJyIH0sIG51bGwpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGNvbnN0IHdvcmtlckluaXQgPSAoY29uZmlnLCBjYWxsYmFjaykgPT4ge1xuICAgICAgICAvLyBpbml0aWFsaXplIHRoZSB3YXNtIG1vZHVsZVxuICAgICAgICBjb25zdCBpbnN0YW50aWF0ZVdhc21GdW5jID0gKGltcG9ydHMsIHN1Y2Nlc3NDYWxsYmFjaykgPT4ge1xuICAgICAgICAgICAgV2ViQXNzZW1ibHkuaW5zdGFudGlhdGUoY29uZmlnLm1vZHVsZSwgaW1wb3J0cylcbiAgICAgICAgICAgICAgICAudGhlbigocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NDYWxsYmFjayhyZXN1bHQpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLmNhdGNoKChyZWFzb24pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignaW5zdGFudGlhdGUgZmFpbGVkICsgJyArIHJlYXNvbik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgIH07XG5cbiAgICAgICAgc2VsZi5CQVNJUyhjb25maWcubW9kdWxlID8geyBpbnN0YW50aWF0ZVdhc206IGluc3RhbnRpYXRlV2FzbUZ1bmMgfSA6IG51bGwpXG4gICAgICAgICAgICAudGhlbigoaW5zdGFuY2UpID0+IHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5pbml0aWFsaXplQmFzaXMoKTtcblxuICAgICAgICAgICAgICAgIC8vIHNldCBnbG9iYWxzXG4gICAgICAgICAgICAgICAgYmFzaXMgPSBpbnN0YW5jZTtcbiAgICAgICAgICAgICAgICByZ2JQcmlvcml0eSA9IGNvbmZpZy5yZ2JQcmlvcml0eTtcbiAgICAgICAgICAgICAgICByZ2JhUHJpb3JpdHkgPSBjb25maWcucmdiYVByaW9yaXR5O1xuXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gaGFuZGxlIGluY29taW5nIHdvcmtlciByZXF1ZXN0c1xuICAgIGNvbnN0IHF1ZXVlID0gW107XG4gICAgc2VsZi5vbm1lc3NhZ2UgPSAobWVzc2FnZSkgPT4ge1xuICAgICAgICBjb25zdCBkYXRhID0gbWVzc2FnZS5kYXRhO1xuICAgICAgICBzd2l0Y2ggKGRhdGEudHlwZSkge1xuICAgICAgICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgICAgICAgICAgd29ya2VySW5pdChkYXRhLmNvbmZpZywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JrZXJUcmFuc2NvZGUocXVldWVbaV0udXJsLCBxdWV1ZVtpXS5kYXRhLCBxdWV1ZVtpXS5vcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBxdWV1ZS5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAndHJhbnNjb2RlJzpcbiAgICAgICAgICAgICAgICBpZiAoYmFzaXMpIHtcbiAgICAgICAgICAgICAgICAgICAgd29ya2VyVHJhbnNjb2RlKGRhdGEudXJsLCBkYXRhLmRhdGEsIGRhdGEub3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcXVldWUucHVzaChkYXRhKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9O1xufVxuXG5leHBvcnQge1xuICAgIEJhc2lzV29ya2VyXG59O1xuIl0sIm5hbWVzIjpbIkJhc2lzV29ya2VyIiwiQkFTSVNfRk9STUFUIiwiY1RGRVRDMSIsImNURkVUQzIiLCJjVEZCQzEiLCJjVEZCQzMiLCJjVEZQVlJUQzFfNF9SR0IiLCJjVEZQVlJUQzFfNF9SR0JBIiwiY1RGQVNUQ180eDQiLCJjVEZBVENfUkdCIiwiY1RGQVRDX1JHQkFfSU5URVJQT0xBVEVEX0FMUEhBIiwiY1RGUkdCQTMyIiwiY1RGUkdCNTY1IiwiY1RGUkdCQTQ0NDQiLCJvcGFxdWVNYXBwaW5nIiwiYXN0YyIsImR4dCIsImV0YzEiLCJldGMyIiwicHZyIiwiYXRjIiwibm9uZSIsImFscGhhTWFwcGluZyIsIlBJWEVMX0ZPUk1BVCIsIkVUQzEiLCJFVEMyX1JHQiIsIkVUQzJfUkdCQSIsIkRYVDEiLCJEWFQ1IiwiUFZSVENfNEJQUF9SR0JfMSIsIlBWUlRDXzRCUFBfUkdCQV8xIiwiQVNUQ180eDQiLCJBVENfUkdCIiwiQVRDX1JHQkEiLCJSOF9HOF9COF9BOCIsIlI1X0c2X0I1IiwiUjRfRzRfQjRfQTQiLCJiYXNpc1RvRW5naW5lTWFwcGluZyIsImJhc2lzRm9ybWF0IiwiZGV2aWNlRGV0YWlscyIsImZvcm1hdHMiLCJ1bnN3aXp6bGVHR0dSIiwiZGF0YSIsImdlbkIiLCJSIiwiRyIsInIiLCJnIiwiYiIsIk1hdGgiLCJzcXJ0IiwibWluIiwibWF4IiwiZmxvb3IiLCJvZmZzZXQiLCJsZW5ndGgiLCJwYWNrNTY1IiwicmVzdWx0IiwiVWludDE2QXJyYXkiLCJCIiwiaXNQT1QiLCJ3aWR0aCIsImhlaWdodCIsInBlcmZvcm1hbmNlTm93IiwicGVyZm9ybWFuY2UiLCJub3ciLCJiYXNpcyIsInJnYlByaW9yaXR5IiwicmdiYVByaW9yaXR5IiwiY2hvb3NlVGFyZ2V0Rm9ybWF0IiwiaGFzQWxwaGEiLCJpc1VBU1RDIiwidGVzdEluT3JkZXIiLCJwcmlvcml0eSIsImkiLCJmb3JtYXQiLCJkaW1lbnNpb25zVmFsaWQiLCJ3ZWJnbDIiLCJ0cmFuc2NvZGVLVFgyIiwidXJsIiwib3B0aW9ucyIsIktUWDJGaWxlIiwiRXJyb3IiLCJmdW5jU3RhcnQiLCJiYXNpc0ZpbGUiLCJVaW50OEFycmF5IiwiZ2V0V2lkdGgiLCJnZXRIZWlnaHQiLCJsZXZlbHMiLCJnZXRMZXZlbHMiLCJnZXRIYXNBbHBoYSIsImNsb3NlIiwiZGVsZXRlIiwidW5zd2l6emxlIiwiaXNHR0dSIiwic3RhcnRUcmFuc2NvZGluZyIsImxldmVsRGF0YSIsIm1pcCIsImRzdFNpemUiLCJnZXRJbWFnZVRyYW5zY29kZWRTaXplSW5CeXRlcyIsImRzdCIsInRyYW5zY29kZUltYWdlIiwiaXMxNkJpdEZvcm1hdCIsInB1c2giLCJidWZmZXIiLCJjdWJlbWFwIiwidHJhbnNjb2RlVGltZSIsInVuc3dpenpsZWRHR0dSIiwidHJhbnNjb2RlQmFzaXMiLCJCYXNpc0ZpbGUiLCJnZXRJbWFnZVdpZHRoIiwiZ2V0SW1hZ2VIZWlnaHQiLCJpbWFnZXMiLCJnZXROdW1JbWFnZXMiLCJnZXROdW1MZXZlbHMiLCJ0cmFuc2NvZGUiLCJpc0tUWDIiLCJ3b3JrZXJUcmFuc2NvZGUiLCJtYXAiLCJ2Iiwic2VsZiIsInBvc3RNZXNzYWdlIiwiZXJyIiwid29ya2VySW5pdCIsImNvbmZpZyIsImNhbGxiYWNrIiwiaW5zdGFudGlhdGVXYXNtRnVuYyIsImltcG9ydHMiLCJzdWNjZXNzQ2FsbGJhY2siLCJXZWJBc3NlbWJseSIsImluc3RhbnRpYXRlIiwibW9kdWxlIiwidGhlbiIsImNhdGNoIiwicmVhc29uIiwiY29uc29sZSIsImVycm9yIiwiQkFTSVMiLCJpbnN0YW50aWF0ZVdhc20iLCJpbnN0YW5jZSIsImluaXRpYWxpemVCYXNpcyIsInF1ZXVlIiwib25tZXNzYWdlIiwibWVzc2FnZSIsInR5cGUiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0EsU0FBU0EsV0FBV0EsR0FBRztBQUNuQjtBQUNBLEVBQUEsTUFBTUMsWUFBWSxHQUFHO0FBQ2pCQyxJQUFBQSxPQUFPLEVBQUUs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
