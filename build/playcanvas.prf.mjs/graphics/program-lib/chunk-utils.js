/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
const decodeTable = {
  'linear': 'decodeLinear',
  'srgb': 'decodeGamma',
  'rgbm': 'decodeRGBM',
  'rgbe': 'decodeRGBE',
  'rgbp': 'decodeRGBP'
};
const encodeTable = {
  'linear': 'encodeLinear',
  'srgb': 'encodeGamma',
  'rgbm': 'encodeRGBM',
  'rgbe': 'encodeRGBE',
  'rgbp': 'encodeRGBP'
};

class ChunkUtils {
  static decodeFunc(encoding) {
    return decodeTable[encoding] || 'decodeGamma';
  }

  static encodeFunc(encoding) {
    return encodeTable[encoding] || 'encodeGamma';
  }

}

export { ChunkUtils };
