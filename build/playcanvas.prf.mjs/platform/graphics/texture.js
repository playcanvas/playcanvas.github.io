/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../../core/tracing.js';
import { math } from '../../core/math/math.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_DEFAULT, TEXTUREPROJECTION_NONE, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTUREPROJECTION_CUBE, isCompressedPixelFormat, TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_DXT1, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGBA, TEXTURELOCK_WRITE } from './constants.js';

let _pixelSizeTable = null;
let _blockSizeTable = null;
let id = 0;

class Texture {
  constructor(graphicsDevice, options) {
    this.id = id++;
    this.device = graphicsDevice;

    this.name = null;
    this._width = 4;
    this._height = 4;
    this._depth = 1;
    this._format = PIXELFORMAT_RGBA8;
    this.type = TEXTURETYPE_DEFAULT;
    this.projection = TEXTUREPROJECTION_NONE;
    this._cubemap = false;
    this._volume = false;
    this.fixCubemapSeams = false;
    this._flipY = false;
    this._premultiplyAlpha = false;
    this._isRenderTarget = false;
    this._mipmaps = true;
    this._minFilter = FILTER_LINEAR_MIPMAP_LINEAR;
    this._magFilter = FILTER_LINEAR;
    this._anisotropy = 1;
    this._addressU = ADDRESS_REPEAT;
    this._addressV = ADDRESS_REPEAT;
    this._addressW = ADDRESS_REPEAT;
    this._compareOnRead = false;
    this._compareFunc = FUNC_LESS;
    this.profilerHint = 0;
    if (options !== undefined) {
      if (options.name !== undefined) {
        this.name = options.name;
      }
      this._width = options.width !== undefined ? options.width : this._width;
      this._height = options.height !== undefined ? options.height : this._height;
      this._format = options.format !== undefined ? options.format : this._format;
      if (options.hasOwnProperty('type')) {
        this.type = options.type;
      } else if (options.hasOwnProperty('rgbm')) {
        this.type = options.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
      } else if (options.hasOwnProperty('swizzleGGGR')) {
        this.type = options.swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
      }
      if (options.mipmaps !== undefined) {
        this._mipmaps = options.mipmaps;
      } else {
        this._mipmaps = options.autoMipmap !== undefined ? options.autoMipmap : this._mipmaps;
      }
      this._levels = options.levels;
      this._cubemap = options.cubemap !== undefined ? options.cubemap : this._cubemap;
      this.fixCubemapSeams = options.fixCubemapSeams !== undefined ? options.fixCubemapSeams : this.fixCubemapSeams;
      if (this._cubemap) {
        this.projection = TEXTUREPROJECTION_CUBE;
      } else if (options.projection && options.projection !== TEXTUREPROJECTION_CUBE) {
        this.projection = options.projection;
      }
      this._minFilter = options.minFilter !== undefined ? options.minFilter : this._minFilter;
      this._magFilter = options.magFilter !== undefined ? options.magFilter : this._magFilter;
      this._anisotropy = options.anisotropy !== undefined ? options.anisotropy : this._anisotropy;
      this._addressU = options.addressU !== undefined ? options.addressU : this._addressU;
      this._addressV = options.addressV !== undefined ? options.addressV : this._addressV;
      this._compareOnRead = options.compareOnRead !== undefined ? options.compareOnRead : this._compareOnRead;
      this._compareFunc = options._compareFunc !== undefined ? options._compareFunc : this._compareFunc;
      this._flipY = options.flipY !== undefined ? options.flipY : this._flipY;
      this._premultiplyAlpha = options.premultiplyAlpha !== undefined ? options.premultiplyAlpha : this._premultiplyAlpha;
      if (graphicsDevice.webgl2) {
        this._depth = options.depth !== undefined ? options.depth : this._depth;
        this._volume = options.volume !== undefined ? options.volume : this._volume;
        this._addressW = options.addressW !== undefined ? options.addressW : this._addressW;
      }
      this.profilerHint = options.profilerHint !== undefined ? options.profilerHint : this.profilerHint;
    }
    this._compressed = isCompressedPixelFormat(this._format);

    this._invalid = false;
    this._lockedLevel = -1;
    if (!this._levels) {
      this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
    }
    this.dirtyAll();
    this._gpuSize = 0;
    this.impl = graphicsDevice.createTextureImpl(this);

    graphicsDevice.textures.push(this);
  }

  destroy() {
    if (this.device) {
      const device = this.device;
      const idx = device.textures.indexOf(this);
      if (idx !== -1) {
        device.textures.splice(idx, 1);
      }

      device.scope.removeValue(this);

      this.impl.destroy(device);

      this.adjustVramSizeTracking(device._vram, -this._gpuSize);
      this._levels = null;
      this.device = null;
    }
  }

  loseContext() {
    this.impl.loseContext();
    this.dirtyAll();
  }

  adjustVramSizeTracking(vram, size) {
    vram.tex += size;
    if (this.profilerHint === TEXHINT_SHADOWMAP) {
      vram.texShadow += size;
    } else if (this.profilerHint === TEXHINT_ASSET) {
      vram.texAsset += size;
    } else if (this.profilerHint === TEXHINT_LIGHTMAP) {
      vram.texLightmap += size;
    }
  }

  set minFilter(v) {
    if (this._minFilter !== v) {
      this._minFilter = v;
      this._parameterFlags |= 1;
    }
  }
  get minFilter() {
    return this._minFilter;
  }

  set magFilter(v) {
    if (this._magFilter !== v) {
      this._magFilter = v;
      this._parameterFlags |= 2;
    }
  }
  get magFilter() {
    return this._magFilter;
  }

  set addressU(v) {
    if (this._addressU !== v) {
      this._addressU = v;
      this._parameterFlags |= 4;
    }
  }
  get addressU() {
    return this._addressU;
  }

  set addressV(v) {
    if (this._addressV !== v) {
      this._addressV = v;
      this._parameterFlags |= 8;
    }
  }
  get addressV() {
    return this._addressV;
  }

  set addressW(addressW) {
    if (!this.device.webgl2) return;
    if (!this._volume) {
      return;
    }
    if (addressW !== this._addressW) {
      this._addressW = addressW;
      this._parameterFlags |= 16;
    }
  }
  get addressW() {
    return this._addressW;
  }

  set compareOnRead(v) {
    if (this._compareOnRead !== v) {
      this._compareOnRead = v;
      this._parameterFlags |= 32;
    }
  }
  get compareOnRead() {
    return this._compareOnRead;
  }

  set compareFunc(v) {
    if (this._compareFunc !== v) {
      this._compareFunc = v;
      this._parameterFlags |= 64;
    }
  }
  get compareFunc() {
    return this._compareFunc;
  }

  set anisotropy(v) {
    if (this._anisotropy !== v) {
      this._anisotropy = v;
      this._parameterFlags |= 128;
    }
  }
  get anisotropy() {
    return this._anisotropy;
  }

  set autoMipmap(v) {
    this._mipmaps = v;
  }
  get autoMipmap() {
    return this._mipmaps;
  }

  set mipmaps(v) {
    if (this._mipmaps !== v) {
      this._mipmaps = v;
      if (v) this._needsMipmapsUpload = true;
    }
  }
  get mipmaps() {
    return this._mipmaps;
  }

  get width() {
    return this._width;
  }

  get height() {
    return this._height;
  }

  get depth() {
    return this._depth;
  }

  get format() {
    return this._format;
  }

  get cubemap() {
    return this._cubemap;
  }
  get gpuSize() {
    const mips = this.pot && this._mipmaps && !(this._compressed && this._levels.length === 1);
    return Texture.calcGpuSize(this._width, this._height, this._depth, this._format, mips, this._cubemap);
  }

  get volume() {
    return this._volume;
  }

  set flipY(flipY) {
    if (this._flipY !== flipY) {
      this._flipY = flipY;
      this._needsUpload = true;
    }
  }
  get flipY() {
    return this._flipY;
  }
  set premultiplyAlpha(premultiplyAlpha) {
    if (this._premultiplyAlpha !== premultiplyAlpha) {
      this._premultiplyAlpha = premultiplyAlpha;
      this._needsUpload = true;
    }
  }
  get premultiplyAlpha() {
    return this._premultiplyAlpha;
  }

  get pot() {
    return math.powerOfTwo(this._width) && math.powerOfTwo(this._height);
  }

  get encoding() {
    switch (this.type) {
      case TEXTURETYPE_RGBM:
        return 'rgbm';
      case TEXTURETYPE_RGBE:
        return 'rgbe';
      case TEXTURETYPE_RGBP:
        return 'rgbp';
      default:
        return this.format === PIXELFORMAT_RGB16F || this.format === PIXELFORMAT_RGB32F || this.format === PIXELFORMAT_RGBA16F || this.format === PIXELFORMAT_RGBA32F ? 'linear' : 'srgb';
    }
  }

  static calcGpuSize(width, height, depth, format, mipmaps, cubemap) {
    if (!_pixelSizeTable) {
      _pixelSizeTable = [];
      _pixelSizeTable[PIXELFORMAT_A8] = 1;
      _pixelSizeTable[PIXELFORMAT_L8] = 1;
      _pixelSizeTable[PIXELFORMAT_LA8] = 2;
      _pixelSizeTable[PIXELFORMAT_RGB565] = 2;
      _pixelSizeTable[PIXELFORMAT_RGBA5551] = 2;
      _pixelSizeTable[PIXELFORMAT_RGBA4] = 2;
      _pixelSizeTable[PIXELFORMAT_RGB8] = 4;
      _pixelSizeTable[PIXELFORMAT_RGBA8] = 4;
      _pixelSizeTable[PIXELFORMAT_RGB16F] = 8;
      _pixelSizeTable[PIXELFORMAT_RGBA16F] = 8;
      _pixelSizeTable[PIXELFORMAT_RGB32F] = 16;
      _pixelSizeTable[PIXELFORMAT_RGBA32F] = 16;
      _pixelSizeTable[PIXELFORMAT_R32F] = 4;
      _pixelSizeTable[PIXELFORMAT_DEPTH] = 4;
      _pixelSizeTable[PIXELFORMAT_DEPTHSTENCIL] = 4;
      _pixelSizeTable[PIXELFORMAT_111110F] = 4;
      _pixelSizeTable[PIXELFORMAT_SRGB] = 4;
      _pixelSizeTable[PIXELFORMAT_SRGBA] = 4;
    }
    if (!_blockSizeTable) {
      _blockSizeTable = [];
      _blockSizeTable[PIXELFORMAT_ETC1] = 8;
      _blockSizeTable[PIXELFORMAT_ETC2_RGB] = 8;
      _blockSizeTable[PIXELFORMAT_PVRTC_2BPP_RGB_1] = 8;
      _blockSizeTable[PIXELFORMAT_PVRTC_2BPP_RGBA_1] = 8;
      _blockSizeTable[PIXELFORMAT_PVRTC_4BPP_RGB_1] = 8;
      _blockSizeTable[PIXELFORMAT_PVRTC_4BPP_RGBA_1] = 8;
      _blockSizeTable[PIXELFORMAT_DXT1] = 8;
      _blockSizeTable[PIXELFORMAT_ATC_RGB] = 8;
      _blockSizeTable[PIXELFORMAT_ETC2_RGBA] = 16;
      _blockSizeTable[PIXELFORMAT_DXT3] = 16;
      _blockSizeTable[PIXELFORMAT_DXT5] = 16;
      _blockSizeTable[PIXELFORMAT_ASTC_4x4] = 16;
      _blockSizeTable[PIXELFORMAT_ATC_RGBA] = 16;
    }
    const pixelSize = _pixelSizeTable.hasOwnProperty(format) ? _pixelSizeTable[format] : 0;
    const blockSize = _blockSizeTable.hasOwnProperty(format) ? _blockSizeTable[format] : 0;
    let result = 0;
    while (1) {
      if (pixelSize > 0) {
        result += width * height * depth * pixelSize;
      } else {
        let blockWidth = Math.floor((width + 3) / 4);
        const blockHeight = Math.floor((height + 3) / 4);
        const blockDepth = Math.floor((depth + 3) / 4);
        if (format === PIXELFORMAT_PVRTC_2BPP_RGB_1 || format === PIXELFORMAT_PVRTC_2BPP_RGBA_1) {
          blockWidth = Math.max(Math.floor(blockWidth / 2), 1);
        }
        result += blockWidth * blockHeight * blockDepth * blockSize;
      }
      if (!mipmaps || width === 1 && height === 1 && depth === 1) {
        break;
      }
      width = Math.max(Math.floor(width / 2), 1);
      height = Math.max(Math.floor(height / 2), 1);
      depth = Math.max(Math.floor(depth / 2), 1);
    }
    return result * (cubemap ? 6 : 1);
  }

  dirtyAll() {
    this._levelsUpdated = this._cubemap ? [[true, true, true, true, true, true]] : [true];
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
    this._mipmapsUploaded = false;
    this._parameterFlags = 255;
  }

  lock(options = {}) {
    if (options.level === undefined) {
      options.level = 0;
    }
    if (options.face === undefined) {
      options.face = 0;
    }
    if (options.mode === undefined) {
      options.mode = TEXTURELOCK_WRITE;
    }
    this._lockedLevel = options.level;
    if (this._levels[options.level] === null) {
      switch (this._format) {
        case PIXELFORMAT_A8:
        case PIXELFORMAT_L8:
          this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth);
          break;
        case PIXELFORMAT_LA8:
          this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth * 2);
          break;
        case PIXELFORMAT_RGB565:
        case PIXELFORMAT_RGBA5551:
        case PIXELFORMAT_RGBA4:
          this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth);
          break;
        case PIXELFORMAT_RGB8:
          this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth * 3);
          break;
        case PIXELFORMAT_RGBA8:
          this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth * 4);
          break;
        case PIXELFORMAT_DXT1:
          this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 8 * this._depth);
          break;
        case PIXELFORMAT_DXT3:
        case PIXELFORMAT_DXT5:
          this._levels[options.level] = new Uint8Array(Math.floor((this._width + 3) / 4) * Math.floor((this._height + 3) / 4) * 16 * this._depth);
          break;
        case PIXELFORMAT_RGB16F:
          this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth * 3);
          break;
        case PIXELFORMAT_RGB32F:
          this._levels[options.level] = new Float32Array(this._width * this._height * this._depth * 3);
          break;
        case PIXELFORMAT_RGBA16F:
          this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth * 4);
          break;
        case PIXELFORMAT_RGBA32F:
          this._levels[options.level] = new Float32Array(this._width * this._height * this._depth * 4);
          break;
      }
    }
    return this._levels[options.level];
  }

  setSource(source, mipLevel = 0) {
    let invalid = false;
    let width, height;
    if (this._cubemap) {
      if (source[0]) {
        width = source[0].width || 0;
        height = source[0].height || 0;
        for (let i = 0; i < 6; i++) {
          const face = source[i];
          if (!face ||
          face.width !== width ||
          face.height !== height ||
          !this.device._isBrowserInterface(face)) {
            invalid = true;
            break;
          }
        }
      } else {
        invalid = true;
      }
      if (!invalid) {
        for (let i = 0; i < 6; i++) {
          if (this._levels[mipLevel][i] !== source[i]) this._levelsUpdated[mipLevel][i] = true;
        }
      }
    } else {
      if (!this.device._isBrowserInterface(source)) invalid = true;
      if (!invalid) {
        if (source !== this._levels[mipLevel]) this._levelsUpdated[mipLevel] = true;
        width = source.width;
        height = source.height;
      }
    }
    if (invalid) {

      this._width = 4;
      this._height = 4;

      if (this._cubemap) {
        for (let i = 0; i < 6; i++) {
          this._levels[mipLevel][i] = null;
          this._levelsUpdated[mipLevel][i] = true;
        }
      } else {
        this._levels[mipLevel] = null;
        this._levelsUpdated[mipLevel] = true;
      }
    } else {
      if (mipLevel === 0) {
        this._width = width;
        this._height = height;
      }
      this._levels[mipLevel] = source;
    }

    if (this._invalid !== invalid || !invalid) {
      this._invalid = invalid;

      this.upload();
    }
  }

  getSource(mipLevel = 0) {
    return this._levels[mipLevel];
  }

  unlock() {
    if (this._lockedLevel === -1) ;

    this.upload();
    this._lockedLevel = -1;
  }

  upload() {
    var _this$impl$uploadImme, _this$impl;
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
    (_this$impl$uploadImme = (_this$impl = this.impl).uploadImmediate) == null ? void 0 : _this$impl$uploadImme.call(_this$impl, this.device, this);
  }

  getDds() {
    let fsize = 128;
    let idx = 0;
    while (this._levels[idx]) {
      if (!this.cubemap) {
        const mipSize = this._levels[idx].length;
        if (!mipSize) {
          return undefined;
        }
        fsize += mipSize;
      } else {
        for (let face = 0; face < 6; face++) {
          if (!this._levels[idx][face]) {
            return undefined;
          }
          const mipSize = this._levels[idx][face].length;
          if (!mipSize) {
            return undefined;
          }
          fsize += mipSize;
        }
      }
      fsize += this._levels[idx].length;
      idx++;
    }
    const buff = new ArrayBuffer(fsize);
    const header = new Uint32Array(buff, 0, 128 / 4);
    const DDS_MAGIC = 542327876;
    const DDS_HEADER_SIZE = 124;
    const DDS_FLAGS_REQUIRED = 0x01 | 0x02 | 0x04 | 0x1000 | 0x80000;
    const DDS_FLAGS_MIPMAP = 0x20000;
    const DDS_PIXELFORMAT_SIZE = 32;
    const DDS_PIXELFLAGS_RGBA8 = 0x01 | 0x40;
    const DDS_CAPS_REQUIRED = 0x1000;
    const DDS_CAPS_MIPMAP = 0x400000;
    const DDS_CAPS_COMPLEX = 0x8;
    const DDS_CAPS2_CUBEMAP = 0x200 | 0x400 | 0x800 | 0x1000 | 0x2000 | 0x4000 | 0x8000;

    let flags = DDS_FLAGS_REQUIRED;
    if (this._levels.length > 1) flags |= DDS_FLAGS_MIPMAP;
    let caps = DDS_CAPS_REQUIRED;
    if (this._levels.length > 1) caps |= DDS_CAPS_MIPMAP;
    if (this._levels.length > 1 || this.cubemap) caps |= DDS_CAPS_COMPLEX;
    const caps2 = this.cubemap ? DDS_CAPS2_CUBEMAP : 0;
    header[0] = DDS_MAGIC;
    header[1] = DDS_HEADER_SIZE;
    header[2] = flags;
    header[3] = this.height;
    header[4] = this.width;
    header[5] = this.width * this.height * 4;
    header[6] = 0;
    header[7] = this._levels.length;
    for (let i = 0; i < 11; i++) {
      header[8 + i] = 0;
    }
    header[19] = DDS_PIXELFORMAT_SIZE;
    header[20] = DDS_PIXELFLAGS_RGBA8;
    header[21] = 0;
    header[22] = 32;
    header[23] = 0x00FF0000;
    header[24] = 0x0000FF00;
    header[25] = 0x000000FF;
    header[26] = 0xFF000000;
    header[27] = caps;
    header[28] = caps2;
    header[29] = 0;
    header[30] = 0;
    header[31] = 0;
    let offset = 128;
    if (!this.cubemap) {
      for (let i = 0; i < this._levels.length; i++) {
        const level = this._levels[i];
        const mip = new Uint8Array(buff, offset, level.length);
        for (let j = 0; j < level.length; j++) {
          mip[j] = level[j];
        }
        offset += level.length;
      }
    } else {
      for (let face = 0; face < 6; face++) {
        for (let i = 0; i < this._levels.length; i++) {
          const level = this._levels[i][face];
          const mip = new Uint8Array(buff, offset, level.length);
          for (let j = 0; j < level.length; j++) {
            mip[j] = level[j];
          }
          offset += level.length;
        }
      }
    }
    return buff;
  }
}

export { Texture };
