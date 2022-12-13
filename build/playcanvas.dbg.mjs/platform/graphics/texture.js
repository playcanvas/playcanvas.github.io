/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { TRACEID_TEXTURE_ALLOC, TRACEID_VRAM_TEXTURE } from '../../core/constants.js';
import { math } from '../../core/math/math.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_DEFAULT, TEXTUREPROJECTION_NONE, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTUREPROJECTION_CUBE, isCompressedPixelFormat, TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4, PIXELFORMAT_RGB8, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_DXT1, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGBA, TEXTURELOCK_WRITE } from './constants.js';

let _pixelSizeTable = null;
let _blockSizeTable = null;
let id = 0;

class Texture {
  constructor(graphicsDevice, options) {
    this.id = id++;
    this.device = graphicsDevice;
    Debug.assert(this.device, "Texture contructor requires a graphicsDevice to be valid");

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
        Debug.deprecated("options.rgbm is deprecated. Use options.type instead.");
        this.type = options.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
      } else if (options.hasOwnProperty('swizzleGGGR')) {
        Debug.deprecated("options.swizzleGGGR is deprecated. Use options.type instead.");
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
    Debug.trace(TRACEID_TEXTURE_ALLOC, `Alloc: Id ${this.id} ${this.name}: ${this.width}x${this.height} ` + `${this.cubemap ? '[Cubemap]' : ''}` + `${this.volume ? '[Volume]' : ''}` + `${this.mipmaps ? '[Mipmaps]' : ''}`, this);
  }

  destroy() {
    Debug.trace(TRACEID_TEXTURE_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);
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
    Debug.trace(TRACEID_VRAM_TEXTURE, `${this.id} ${this.name} size: ${size} vram.texture: ${vram.tex} => ${vram.tex + size}`);
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
      Debug.warn("pc.Texture#addressW: Can't set W addressing mode for a non-3D texture.");
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
    if (this._lockedLevel === -1) {
      Debug.log("pc.Texture#unlock: Attempting to unlock a texture that is not locked.", this);
    }

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
    Debug.assert(this.format === PIXELFORMAT_RGBA8, "This format is not implemented yet");
    let fsize = 128;
    let idx = 0;
    while (this._levels[idx]) {
      if (!this.cubemap) {
        const mipSize = this._levels[idx].length;
        if (!mipSize) {
          Debug.error(`No byte array for mip ${idx}`);
          return undefined;
        }
        fsize += mipSize;
      } else {
        for (let face = 0; face < 6; face++) {
          if (!this._levels[idx][face]) {
            Debug.error(`No level data for mip ${idx}, face ${face}`);
            return undefined;
          }
          const mipSize = this._levels[idx][face].length;
          if (!mipSize) {
            Debug.error(`No byte array for mip ${idx}, face ${face}`);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVEVYVFVSRV9BTExPQywgVFJBQ0VJRF9WUkFNX1RFWFRVUkUgfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQge1xuICAgIGlzQ29tcHJlc3NlZFBpeGVsRm9ybWF0LFxuICAgIEFERFJFU1NfUkVQRUFULFxuICAgIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBGVU5DX0xFU1MsXG4gICAgUElYRUxGT1JNQVRfQTgsIFBJWEVMRk9STUFUX0w4LCBQSVhFTEZPUk1BVF9MQTgsIFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTU1NTEsIFBJWEVMRk9STUFUX1JHQkE0LFxuICAgIFBJWEVMRk9STUFUX1JHQjgsIFBJWEVMRk9STUFUX1JHQkE4LCBQSVhFTEZPUk1BVF9EWFQxLCBQSVhFTEZPUk1BVF9EWFQzLCBQSVhFTEZPUk1BVF9EWFQ1LFxuICAgIFBJWEVMRk9STUFUX1JHQjE2RiwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCMzJGLCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9SMzJGLCBQSVhFTEZPUk1BVF9ERVBUSCxcbiAgICBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwsIFBJWEVMRk9STUFUXzExMTExMEYsIFBJWEVMRk9STUFUX1NSR0IsIFBJWEVMRk9STUFUX1NSR0JBLCBQSVhFTEZPUk1BVF9FVEMxLFxuICAgIFBJWEVMRk9STUFUX0VUQzJfUkdCLCBQSVhFTEZPUk1BVF9FVEMyX1JHQkEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xLFxuICAgIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xLCBQSVhFTEZPUk1BVF9BU1RDXzR4NCwgUElYRUxGT1JNQVRfQVRDX1JHQixcbiAgICBQSVhFTEZPUk1BVF9BVENfUkdCQSxcbiAgICBURVhISU5UX1NIQURPV01BUCwgVEVYSElOVF9BU1NFVCwgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9OT05FLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFLFxuICAgIFRFWFRVUkVUWVBFX0RFRkFVTFQsIFRFWFRVUkVUWVBFX1JHQk0sIFRFWFRVUkVUWVBFX1JHQkUsIFRFWFRVUkVUWVBFX1JHQlAsIFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxubGV0IF9waXhlbFNpemVUYWJsZSA9IG51bGw7XG5sZXQgX2Jsb2NrU2l6ZVRhYmxlID0gbnVsbDtcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIHRleHR1cmUgaXMgYSBjb250YWluZXIgZm9yIHRleGVsIGRhdGEgdGhhdCBjYW4gYmUgdXRpbGl6ZWQgaW4gYSBmcmFnbWVudCBzaGFkZXIuIFR5cGljYWxseSxcbiAqIHRoZSB0ZXhlbCBkYXRhIHJlcHJlc2VudHMgYW4gaW1hZ2UgdGhhdCBpcyBtYXBwZWQgb3ZlciBnZW9tZXRyeS5cbiAqL1xuY2xhc3MgVGV4dHVyZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFRleHR1cmUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlXG4gICAgICogdXNlZCB0byBtYW5hZ2UgdGhpcyB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPYmplY3QgZm9yIHBhc3Npbmcgb3B0aW9uYWwgYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5uYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy53aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLiBEZWZhdWx0cyB0byA0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5oZWlnaHRdIC0gVGhlIGhlaWdodCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuIERlZmF1bHRzIHRvIDQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmRlcHRoXSAtIFRoZSBudW1iZXIgb2YgZGVwdGggc2xpY2VzIGluIGEgM0QgdGV4dHVyZSAoV2ViR0wyIG9ubHkpLlxuICAgICAqIERlZmF1bHRzIHRvIDEgKHNpbmdsZSAyRCBpbWFnZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZvcm1hdF0gLSBUaGUgcGl4ZWwgZm9ybWF0IG9mIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCNTY1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE1NTUxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE0fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQzfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDV9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkExNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkEzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRVRDMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfMTExMTEwRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BU1RDXzR4NH0+L2xpPlxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0J9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVRDX1JHQkF9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTh9LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5wcm9qZWN0aW9uXSAtIFRoZSBwcm9qZWN0aW9uIHR5cGUgb2YgdGhlIHRleHR1cmUsIHVzZWQgd2hlbiB0aGVcbiAgICAgKiB0ZXh0dXJlIHJlcHJlc2VudHMgYW4gZW52aXJvbm1lbnQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX05PTkV9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fQ1VCRX1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9FUVVJUkVDVH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkV9IGlmIG9wdGlvbnMuY3ViZW1hcCBpcyBzcGVjaWZpZWQsIG90aGVyd2lzZVxuICAgICAqIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9OT05FfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWluRmlsdGVyXSAtIFRoZSBtaW5pZmljYXRpb24gZmlsdGVyIHR5cGUgdG8gdXNlLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYWdGaWx0ZXJdIC0gVGhlIG1hZ25pZmljYXRpb24gZmlsdGVyIHR5cGUgdG8gdXNlLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBGSUxURVJfTElORUFSfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYW5pc290cm9weV0gLSBUaGUgbGV2ZWwgb2YgYW5pc290cm9waWMgZmlsdGVyaW5nIHRvIHVzZS4gRGVmYXVsdHNcbiAgICAgKiB0byAxLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hZGRyZXNzVV0gLSBUaGUgcmVwZWF0IG1vZGUgdG8gdXNlIGluIHRoZSBVIGRpcmVjdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgQUREUkVTU19SRVBFQVR9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hZGRyZXNzVl0gLSBUaGUgcmVwZWF0IG1vZGUgdG8gdXNlIGluIHRoZSBWIGRpcmVjdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgQUREUkVTU19SRVBFQVR9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hZGRyZXNzV10gLSBUaGUgcmVwZWF0IG1vZGUgdG8gdXNlIGluIHRoZSBXIGRpcmVjdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgQUREUkVTU19SRVBFQVR9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubWlwbWFwc10gLSBXaGVuIGVuYWJsZWQgdHJ5IHRvIGdlbmVyYXRlIG9yIHVzZSBtaXBtYXBzIGZvciB0aGlzXG4gICAgICogdGV4dHVyZS4gRGVmYXVsdCBpcyB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY3ViZW1hcF0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBpcyB0byBiZSBhIGN1YmVtYXAuXG4gICAgICogRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy52b2x1bWVdIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgaXMgdG8gYmUgYSAzRCB2b2x1bWVcbiAgICAgKiAoV2ViR0wyIG9ubHkpLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudHlwZV0gLSBTcGVjaWZpZXMgdGhlIGltYWdlIHR5cGUsIHNlZSB7QGxpbmsgVEVYVFVSRVRZUEVfREVGQVVMVH0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5maXhDdWJlbWFwU2VhbXNdIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhpcyBjdWJlbWFwIHRleHR1cmUgcmVxdWlyZXNcbiAgICAgKiBzcGVjaWFsIHNlYW0gZml4aW5nIHNoYWRlciBjb2RlIHRvIGxvb2sgcmlnaHQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZmxpcFldIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgc2hvdWxkIGJlIGZsaXBwZWQgaW4gdGhlXG4gICAgICogWS1kaXJlY3Rpb24uIE9ubHkgYWZmZWN0cyB0ZXh0dXJlcyB3aXRoIGEgc291cmNlIHRoYXQgaXMgYW4gaW1hZ2UsIGNhbnZhcyBvciB2aWRlbyBlbGVtZW50LlxuICAgICAqIERvZXMgbm90IGFmZmVjdCBjdWJlbWFwcywgY29tcHJlc3NlZCB0ZXh0dXJlcyBvciB0ZXh0dXJlcyBzZXQgZnJvbSByYXcgcGl4ZWwgZGF0YS4gRGVmYXVsdHNcbiAgICAgKiB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZW11bHRpcGx5QWxwaGFdIC0gSWYgdHJ1ZSwgdGhlIGFscGhhIGNoYW5uZWwgb2YgdGhlIHRleHR1cmUgKGlmXG4gICAgICogcHJlc2VudCkgaXMgbXVsdGlwbGllZCBpbnRvIHRoZSBjb2xvciBjaGFubmVscy4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jb21wYXJlT25SZWFkXSAtIFdoZW4gZW5hYmxlZCwgYW5kIGlmIHRleHR1cmUgZm9ybWF0IGlzXG4gICAgICoge0BsaW5rIFBJWEVMRk9STUFUX0RFUFRIfSBvciB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMfSwgaGFyZHdhcmUgUENGIGlzIGVuYWJsZWQgZm9yXG4gICAgICogdGhpcyB0ZXh0dXJlLCBhbmQgeW91IGNhbiBnZXQgZmlsdGVyZWQgcmVzdWx0cyBvZiBjb21wYXJpc29uIHVzaW5nIHRleHR1cmUoKSBpbiB5b3VyIHNoYWRlclxuICAgICAqIChXZWJHTDIgb25seSkuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5jb21wYXJlRnVuY10gLSBDb21wYXJpc29uIGZ1bmN0aW9uIHdoZW4gY29tcGFyZU9uUmVhZCBpcyBlbmFibGVkXG4gICAgICogKFdlYkdMMiBvbmx5KS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn1cbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgRlVOQ19MRVNTfS5cbiAgICAgKiBAcGFyYW0ge1VpbnQ4QXJyYXlbXX0gW29wdGlvbnMubGV2ZWxzXSAtIEFycmF5IG9mIFVpbnQ4QXJyYXkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA4eDh4MjQtYml0IHRleHR1cmVcbiAgICAgKiB2YXIgdGV4dHVyZSA9IG5ldyBwYy5UZXh0dXJlKGdyYXBoaWNzRGV2aWNlLCB7XG4gICAgICogICAgIHdpZHRoOiA4LFxuICAgICAqICAgICBoZWlnaHQ6IDgsXG4gICAgICogICAgIGZvcm1hdDogcGMuUElYRUxGT1JNQVRfUkdCOFxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gRmlsbCB0aGUgdGV4dHVyZSB3aXRoIGEgZ3JhZGllbnRcbiAgICAgKiB2YXIgcGl4ZWxzID0gdGV4dHVyZS5sb2NrKCk7XG4gICAgICogdmFyIGNvdW50ID0gMDtcbiAgICAgKiBmb3IgKHZhciBpID0gMDsgaSA8IDg7IGkrKykge1xuICAgICAqICAgICBmb3IgKHZhciBqID0gMDsgaiA8IDg7IGorKykge1xuICAgICAqICAgICAgICAgcGl4ZWxzW2NvdW50KytdID0gaSAqIDMyO1xuICAgICAqICAgICAgICAgcGl4ZWxzW2NvdW50KytdID0gaiAqIDMyO1xuICAgICAqICAgICAgICAgcGl4ZWxzW2NvdW50KytdID0gMjU1O1xuICAgICAqICAgICB9XG4gICAgICogfVxuICAgICAqIHRleHR1cmUudW5sb2NrKCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5pZCA9IGlkKys7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmRldmljZSwgXCJUZXh0dXJlIGNvbnRydWN0b3IgcmVxdWlyZXMgYSBncmFwaGljc0RldmljZSB0byBiZSB2YWxpZFwiKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG5hbWUgb2YgdGhlIHRleHR1cmUuIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5hbWUgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gNDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gNDtcbiAgICAgICAgdGhpcy5fZGVwdGggPSAxO1xuXG4gICAgICAgIHRoaXMuX2Zvcm1hdCA9IFBJWEVMRk9STUFUX1JHQkE4O1xuICAgICAgICB0aGlzLnR5cGUgPSBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBURVhUVVJFUFJPSkVDVElPTl9OT05FO1xuXG4gICAgICAgIHRoaXMuX2N1YmVtYXAgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdm9sdW1lID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZml4Q3ViZW1hcFNlYW1zID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZsaXBZID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9pc1JlbmRlclRhcmdldCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX21pcG1hcHMgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX21pbkZpbHRlciA9IEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUjtcbiAgICAgICAgdGhpcy5fbWFnRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgdGhpcy5fYW5pc290cm9weSA9IDE7XG4gICAgICAgIHRoaXMuX2FkZHJlc3NVID0gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgIHRoaXMuX2FkZHJlc3NWID0gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgIHRoaXMuX2FkZHJlc3NXID0gQUREUkVTU19SRVBFQVQ7XG5cbiAgICAgICAgdGhpcy5fY29tcGFyZU9uUmVhZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb21wYXJlRnVuYyA9IEZVTkNfTEVTUztcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMucHJvZmlsZXJIaW50ID0gMDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKG9wdGlvbnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMubmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSAob3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMud2lkdGggOiB0aGlzLl93aWR0aDtcbiAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IChvcHRpb25zLmhlaWdodCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuaGVpZ2h0IDogdGhpcy5faGVpZ2h0O1xuXG4gICAgICAgICAgICB0aGlzLl9mb3JtYXQgPSAob3B0aW9ucy5mb3JtYXQgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmZvcm1hdCA6IHRoaXMuX2Zvcm1hdDtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3R5cGUnKSkge1xuICAgICAgICAgICAgICAgIHRoaXMudHlwZSA9IG9wdGlvbnMudHlwZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgncmdibScpKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChcIm9wdGlvbnMucmdibSBpcyBkZXByZWNhdGVkLiBVc2Ugb3B0aW9ucy50eXBlIGluc3RlYWQuXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMudHlwZSA9IG9wdGlvbnMucmdibSA/IFRFWFRVUkVUWVBFX1JHQk0gOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCdzd2l6emxlR0dHUicpKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChcIm9wdGlvbnMuc3dpenpsZUdHR1IgaXMgZGVwcmVjYXRlZC4gVXNlIG9wdGlvbnMudHlwZSBpbnN0ZWFkLlwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnN3aXp6bGVHR0dSID8gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IgOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5taXBtYXBzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9taXBtYXBzID0gb3B0aW9ucy5taXBtYXBzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9taXBtYXBzID0gKG9wdGlvbnMuYXV0b01pcG1hcCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuYXV0b01pcG1hcCA6IHRoaXMuX21pcG1hcHM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2xldmVscyA9IG9wdGlvbnMubGV2ZWxzO1xuXG4gICAgICAgICAgICB0aGlzLl9jdWJlbWFwID0gKG9wdGlvbnMuY3ViZW1hcCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuY3ViZW1hcCA6IHRoaXMuX2N1YmVtYXA7XG4gICAgICAgICAgICB0aGlzLmZpeEN1YmVtYXBTZWFtcyA9IChvcHRpb25zLmZpeEN1YmVtYXBTZWFtcyAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuZml4Q3ViZW1hcFNlYW1zIDogdGhpcy5maXhDdWJlbWFwU2VhbXM7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gVEVYVFVSRVBST0pFQ1RJT05fQ1VCRTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5wcm9qZWN0aW9uICYmIG9wdGlvbnMucHJvamVjdGlvbiAhPT0gVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvamVjdGlvbiA9IG9wdGlvbnMucHJvamVjdGlvbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbWluRmlsdGVyID0gKG9wdGlvbnMubWluRmlsdGVyICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5taW5GaWx0ZXIgOiB0aGlzLl9taW5GaWx0ZXI7XG4gICAgICAgICAgICB0aGlzLl9tYWdGaWx0ZXIgPSAob3B0aW9ucy5tYWdGaWx0ZXIgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLm1hZ0ZpbHRlciA6IHRoaXMuX21hZ0ZpbHRlcjtcbiAgICAgICAgICAgIHRoaXMuX2FuaXNvdHJvcHkgPSAob3B0aW9ucy5hbmlzb3Ryb3B5ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5hbmlzb3Ryb3B5IDogdGhpcy5fYW5pc290cm9weTtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NVID0gKG9wdGlvbnMuYWRkcmVzc1UgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmFkZHJlc3NVIDogdGhpcy5fYWRkcmVzc1U7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzViA9IChvcHRpb25zLmFkZHJlc3NWICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5hZGRyZXNzViA6IHRoaXMuX2FkZHJlc3NWO1xuXG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlT25SZWFkID0gKG9wdGlvbnMuY29tcGFyZU9uUmVhZCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuY29tcGFyZU9uUmVhZCA6IHRoaXMuX2NvbXBhcmVPblJlYWQ7XG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlRnVuYyA9IChvcHRpb25zLl9jb21wYXJlRnVuYyAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuX2NvbXBhcmVGdW5jIDogdGhpcy5fY29tcGFyZUZ1bmM7XG5cbiAgICAgICAgICAgIHRoaXMuX2ZsaXBZID0gKG9wdGlvbnMuZmxpcFkgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmZsaXBZIDogdGhpcy5fZmxpcFk7XG4gICAgICAgICAgICB0aGlzLl9wcmVtdWx0aXBseUFscGhhID0gKG9wdGlvbnMucHJlbXVsdGlwbHlBbHBoYSAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMucHJlbXVsdGlwbHlBbHBoYSA6IHRoaXMuX3ByZW11bHRpcGx5QWxwaGE7XG5cbiAgICAgICAgICAgIGlmIChncmFwaGljc0RldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXB0aCA9IChvcHRpb25zLmRlcHRoICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5kZXB0aCA6IHRoaXMuX2RlcHRoO1xuICAgICAgICAgICAgICAgIHRoaXMuX3ZvbHVtZSA9IChvcHRpb25zLnZvbHVtZSAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMudm9sdW1lIDogdGhpcy5fdm9sdW1lO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NXID0gKG9wdGlvbnMuYWRkcmVzc1cgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmFkZHJlc3NXIDogdGhpcy5fYWRkcmVzc1c7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHRoaXMucHJvZmlsZXJIaW50ID0gKG9wdGlvbnMucHJvZmlsZXJIaW50ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5wcm9maWxlckhpbnQgOiB0aGlzLnByb2ZpbGVySGludDtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY29tcHJlc3NlZCA9IGlzQ29tcHJlc3NlZFBpeGVsRm9ybWF0KHRoaXMuX2Zvcm1hdCk7XG5cbiAgICAgICAgLy8gTWlwIGxldmVsc1xuICAgICAgICB0aGlzLl9pbnZhbGlkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2xvY2tlZExldmVsID0gLTE7XG4gICAgICAgIGlmICghdGhpcy5fbGV2ZWxzKSB7XG4gICAgICAgICAgICB0aGlzLl9sZXZlbHMgPSB0aGlzLl9jdWJlbWFwID8gW1tudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXV0gOiBbbnVsbF07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRpcnR5QWxsKCk7XG5cbiAgICAgICAgdGhpcy5fZ3B1U2l6ZSA9IDA7XG5cbiAgICAgICAgdGhpcy5pbXBsID0gZ3JhcGhpY3NEZXZpY2UuY3JlYXRlVGV4dHVyZUltcGwodGhpcyk7XG5cbiAgICAgICAgLy8gdHJhY2sgdGhlIHRleHR1cmVcbiAgICAgICAgZ3JhcGhpY3NEZXZpY2UudGV4dHVyZXMucHVzaCh0aGlzKTtcblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1RFWFRVUkVfQUxMT0MsIGBBbGxvYzogSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX06ICR7dGhpcy53aWR0aH14JHt0aGlzLmhlaWdodH0gYCArXG4gICAgICAgICAgICBgJHt0aGlzLmN1YmVtYXAgPyAnW0N1YmVtYXBdJyA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy52b2x1bWUgPyAnW1ZvbHVtZV0nIDogJyd9YCArXG4gICAgICAgICAgICBgJHt0aGlzLm1pcG1hcHMgPyAnW01pcG1hcHNdJyA6ICcnfWAsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWVzIHJlc291cmNlcyBhc3NvY2lhdGVkIHdpdGggdGhpcyB0ZXh0dXJlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9URVhUVVJFX0FMTE9DLCBgRGVBbGxvYzogSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX1gKTtcblxuICAgICAgICBpZiAodGhpcy5kZXZpY2UpIHtcbiAgICAgICAgICAgIC8vIHN0b3AgdHJhY2tpbmcgdGhlIHRleHR1cmVcbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICAgICAgY29uc3QgaWR4ID0gZGV2aWNlLnRleHR1cmVzLmluZGV4T2YodGhpcyk7XG4gICAgICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGRldmljZS50ZXh0dXJlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVtb3ZlIHRleHR1cmUgZnJvbSBhbnkgdW5pZm9ybXNcbiAgICAgICAgICAgIGRldmljZS5zY29wZS5yZW1vdmVWYWx1ZSh0aGlzKTtcblxuICAgICAgICAgICAgLy8gZGVzdHJveSBpbXBsZW1lbnRhdGlvblxuICAgICAgICAgICAgdGhpcy5pbXBsLmRlc3Ryb3koZGV2aWNlKTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIHRleHR1cmUgc3RhdHNcbiAgICAgICAgICAgIHRoaXMuYWRqdXN0VnJhbVNpemVUcmFja2luZyhkZXZpY2UuX3ZyYW0sIC10aGlzLl9ncHVTaXplKTtcblxuICAgICAgICAgICAgdGhpcy5fbGV2ZWxzID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZGV2aWNlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSByZW5kZXJpbmcgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW1wbC5sb3NlQ29udGV4dCgpO1xuICAgICAgICB0aGlzLmRpcnR5QWxsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB2cmFtIHNpemUgdHJhY2tpbmcgZm9yIHRoZSB0ZXh0dXJlLCBzaXplIGNhbiBiZSBwb3NpdGl2ZSB0byBhZGQgb3IgbmVnYXRpdmUgdG8gc3VidHJhY3RcbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhZGp1c3RWcmFtU2l6ZVRyYWNraW5nKHZyYW0sIHNpemUpIHtcblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1ZSQU1fVEVYVFVSRSwgYCR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9IHNpemU6ICR7c2l6ZX0gdnJhbS50ZXh0dXJlOiAke3ZyYW0udGV4fSA9PiAke3ZyYW0udGV4ICsgc2l6ZX1gKTtcblxuICAgICAgICB2cmFtLnRleCArPSBzaXplO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgaWYgKHRoaXMucHJvZmlsZXJIaW50ID09PSBURVhISU5UX1NIQURPV01BUCkge1xuICAgICAgICAgICAgdnJhbS50ZXhTaGFkb3cgKz0gc2l6ZTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnByb2ZpbGVySGludCA9PT0gVEVYSElOVF9BU1NFVCkge1xuICAgICAgICAgICAgdnJhbS50ZXhBc3NldCArPSBzaXplO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucHJvZmlsZXJIaW50ID09PSBURVhISU5UX0xJR0hUTUFQKSB7XG4gICAgICAgICAgICB2cmFtLnRleExpZ2h0bWFwICs9IHNpemU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXIgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1R9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1R9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWluRmlsdGVyKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX21pbkZpbHRlciAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fbWluRmlsdGVyID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWluRmlsdGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWluRmlsdGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYWduaWZpY2F0aW9uIGZpbHRlciB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWFnRmlsdGVyKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hZ0ZpbHRlciAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fbWFnRmlsdGVyID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFnRmlsdGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFnRmlsdGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhZGRyZXNzaW5nIG1vZGUgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZSBob3Jpem9udGFsbHkuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfUkVQRUFUfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfQ0xBTVBfVE9fRURHRX1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX01JUlJPUkVEX1JFUEVBVH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFkZHJlc3NVKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZHJlc3NVICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzVSA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSA0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFkZHJlc3NVKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkcmVzc1U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFkZHJlc3NpbmcgbW9kZSB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlIHZlcnRpY2FsbHkuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfUkVQRUFUfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfQ0xBTVBfVE9fRURHRX1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX01JUlJPUkVEX1JFUEVBVH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFkZHJlc3NWKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZHJlc3NWICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzViA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSA4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFkZHJlc3NWKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkcmVzc1Y7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFkZHJlc3NpbmcgbW9kZSB0byBiZSBhcHBsaWVkIHRvIHRoZSAzRCB0ZXh0dXJlIGRlcHRoIChXZWJHTDIgb25seSkuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfUkVQRUFUfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfQ0xBTVBfVE9fRURHRX1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX01JUlJPUkVEX1JFUEVBVH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFkZHJlc3NXKGFkZHJlc3NXKSB7XG4gICAgICAgIGlmICghdGhpcy5kZXZpY2Uud2ViZ2wyKSByZXR1cm47XG4gICAgICAgIGlmICghdGhpcy5fdm9sdW1lKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKFwicGMuVGV4dHVyZSNhZGRyZXNzVzogQ2FuJ3Qgc2V0IFcgYWRkcmVzc2luZyBtb2RlIGZvciBhIG5vbi0zRCB0ZXh0dXJlLlwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYWRkcmVzc1cgIT09IHRoaXMuX2FkZHJlc3NXKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzVyA9IGFkZHJlc3NXO1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMTY7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWRkcmVzc1coKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRyZXNzVztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaGVuIGVuYWJsZWQsIGFuZCBpZiB0ZXh0dXJlIGZvcm1hdCBpcyB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEh9IG9yXG4gICAgICoge0BsaW5rIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTH0sIGhhcmR3YXJlIFBDRiBpcyBlbmFibGVkIGZvciB0aGlzIHRleHR1cmUsIGFuZCB5b3UgY2FuIGdldFxuICAgICAqIGZpbHRlcmVkIHJlc3VsdHMgb2YgY29tcGFyaXNvbiB1c2luZyB0ZXh0dXJlKCkgaW4geW91ciBzaGFkZXIgKFdlYkdMMiBvbmx5KS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjb21wYXJlT25SZWFkKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBhcmVPblJlYWQgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBhcmVPblJlYWQgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMzI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29tcGFyZU9uUmVhZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhcmVPblJlYWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcGFyaXNvbiBmdW5jdGlvbiB3aGVuIGNvbXBhcmVPblJlYWQgaXMgZW5hYmxlZCAoV2ViR0wyIG9ubHkpLiBQb3NzaWJsZSB2YWx1ZXM6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGNvbXBhcmVGdW5jKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBhcmVGdW5jICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlRnVuYyA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSA2NDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjb21wYXJlRnVuYygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhcmVGdW5jO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEludGVnZXIgdmFsdWUgc3BlY2lmeWluZyB0aGUgbGV2ZWwgb2YgYW5pc290cm9waWMgdG8gYXBwbHkgdG8gdGhlIHRleHR1cmUgcmFuZ2luZyBmcm9tIDEgKG5vXG4gICAgICogYW5pc290cm9waWMgZmlsdGVyaW5nKSB0byB0aGUge0BsaW5rIEdyYXBoaWNzRGV2aWNlfSBwcm9wZXJ0eSBtYXhBbmlzb3Ryb3B5LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYW5pc290cm9weSh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9hbmlzb3Ryb3B5ICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9hbmlzb3Ryb3B5ID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDEyODtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmlzb3Ryb3B5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5pc290cm9weTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIGF1dG9tYXRpYyBtaXBtYXAgZ2VuZXJhdGlvbi4gQ2FuJ3QgYmUgdXNlZCBvbiBub24gcG93ZXIgb2YgdHdvIHRleHR1cmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICovXG4gICAgc2V0IGF1dG9NaXBtYXAodikge1xuICAgICAgICB0aGlzLl9taXBtYXBzID0gdjtcbiAgICB9XG5cbiAgICBnZXQgYXV0b01pcG1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pcG1hcHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyBpZiB0ZXh0dXJlIHNob3VsZCBnZW5lcmF0ZS91cGxvYWQgbWlwbWFwcyBpZiBwb3NzaWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBtaXBtYXBzKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX21pcG1hcHMgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX21pcG1hcHMgPSB2O1xuICAgICAgICAgICAgaWYgKHYpIHRoaXMuX25lZWRzTWlwbWFwc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWlwbWFwcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pcG1hcHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHdpZHRoIG9mIHRoZSB0ZXh0dXJlIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG51bWJlciBvZiBkZXB0aCBzbGljZXMgaW4gYSAzRCB0ZXh0dXJlIChXZWJHTDIgb25seSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBkZXB0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlcHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBwaXhlbCBmb3JtYXQgb2YgdGhlIHRleHR1cmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0E4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0w4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0xBOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0I1NjV9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTU1NTF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTR9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDN9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUNX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0IxNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTE2Rn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0IzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTMyRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9FVEMxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF8xMTExMTBGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FTVENfNHg0fT4vbGk+XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVRDX1JHQn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCQX1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGZvcm1hdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Zvcm1hdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhpcyB0ZXh0dXJlIGlzIGEgY3ViZSBtYXAgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBjdWJlbWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3ViZW1hcDtcbiAgICB9XG5cbiAgICBnZXQgZ3B1U2l6ZSgpIHtcbiAgICAgICAgY29uc3QgbWlwcyA9IHRoaXMucG90ICYmIHRoaXMuX21pcG1hcHMgJiYgISh0aGlzLl9jb21wcmVzc2VkICYmIHRoaXMuX2xldmVscy5sZW5ndGggPT09IDEpO1xuICAgICAgICByZXR1cm4gVGV4dHVyZS5jYWxjR3B1U2l6ZSh0aGlzLl93aWR0aCwgdGhpcy5faGVpZ2h0LCB0aGlzLl9kZXB0aCwgdGhpcy5fZm9ybWF0LCBtaXBzLCB0aGlzLl9jdWJlbWFwKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhpcyB0ZXh0dXJlIGlzIGEgM0Qgdm9sdW1lIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgdm9sdW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdm9sdW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIHNob3VsZCBiZSBmbGlwcGVkIGluIHRoZSBZLWRpcmVjdGlvbi4gT25seSBhZmZlY3RzIHRleHR1cmVzXG4gICAgICogd2l0aCBhIHNvdXJjZSB0aGF0IGlzIGFuIGltYWdlLCBjYW52YXMgb3IgdmlkZW8gZWxlbWVudC4gRG9lcyBub3QgYWZmZWN0IGN1YmVtYXBzLFxuICAgICAqIGNvbXByZXNzZWQgdGV4dHVyZXMgb3IgdGV4dHVyZXMgc2V0IGZyb20gcmF3IHBpeGVsIGRhdGEuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZmxpcFkoZmxpcFkpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZsaXBZICE9PSBmbGlwWSkge1xuICAgICAgICAgICAgdGhpcy5fZmxpcFkgPSBmbGlwWTtcbiAgICAgICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmbGlwWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZsaXBZO1xuICAgIH1cblxuICAgIHNldCBwcmVtdWx0aXBseUFscGhhKHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgaWYgKHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgIT09IHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgICAgIHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgPSBwcmVtdWx0aXBseUFscGhhO1xuICAgICAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHByZW11bHRpcGx5QWxwaGEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcmVtdWx0aXBseUFscGhhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiBhbGwgZGltZW5zaW9ucyBvZiB0aGUgdGV4dHVyZSBhcmUgcG93ZXIgb2YgdHdvLCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHBvdCgpIHtcbiAgICAgICAgcmV0dXJuIG1hdGgucG93ZXJPZlR3byh0aGlzLl93aWR0aCkgJiYgbWF0aC5wb3dlck9mVHdvKHRoaXMuX2hlaWdodCk7XG4gICAgfVxuXG4gICAgLy8gZ2V0IHRoZSB0ZXh0dXJlJ3MgZW5jb2RpbmcgdHlwZVxuICAgIGdldCBlbmNvZGluZygpIHtcbiAgICAgICAgc3dpdGNoICh0aGlzLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgVEVYVFVSRVRZUEVfUkdCTTpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JnYm0nO1xuICAgICAgICAgICAgY2FzZSBURVhUVVJFVFlQRV9SR0JFOlxuICAgICAgICAgICAgICAgIHJldHVybiAncmdiZSc7XG4gICAgICAgICAgICBjYXNlIFRFWFRVUkVUWVBFX1JHQlA6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdyZ2JwJztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuICh0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCMTZGIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCMzJGIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTE2RiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkEzMkYpID8gJ2xpbmVhcicgOiAnc3JnYic7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzdGF0aWMgZnVuY3Rpb25zXG4gICAgLyoqXG4gICAgICogQ2FsY3VsYXRlIHRoZSBHUFUgbWVtb3J5IHJlcXVpcmVkIGZvciBhIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUZXh0dXJlJ3Mgd2lkdGguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRleHR1cmUncyBoZWlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlcHRoIC0gVGV4dHVyZSdzIGRlcHRoLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmb3JtYXQgLSBUZXh0dXJlJ3MgcGl4ZWwgZm9ybWF0IFBJWEVMRk9STUFUXyoqKi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG1pcG1hcHMgLSBUcnVlIGlmIHRoZSB0ZXh0dXJlIGluY2x1ZGVzIG1pcG1hcHMsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGN1YmVtYXAgLSBUcnVlIGlzIHRoZSB0ZXh0dXJlIGlzIGEgY3ViZW1hcCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgYnl0ZXMgb2YgR1BVIG1lbW9yeSByZXF1aXJlZCBmb3IgdGhlIHRleHR1cmUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXRpYyBjYWxjR3B1U2l6ZSh3aWR0aCwgaGVpZ2h0LCBkZXB0aCwgZm9ybWF0LCBtaXBtYXBzLCBjdWJlbWFwKSB7XG4gICAgICAgIGlmICghX3BpeGVsU2l6ZVRhYmxlKSB7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGUgPSBbXTtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9BOF0gPSAxO1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0w4XSA9IDE7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfTEE4XSA9IDI7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUkdCNTY1XSA9IDI7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUkdCQTU1NTFdID0gMjtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SR0JBNF0gPSAyO1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1JHQjhdID0gNDtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SR0JBOF0gPSA0O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1JHQjE2Rl0gPSA4O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1JHQkExNkZdID0gODtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SR0IzMkZdID0gMTY7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUkdCQTMyRl0gPSAxNjtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SMzJGXSA9IDQ7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfREVQVEhdID0gNDsgLy8gY2FuIGJlIHNtYWxsZXIgdXNpbmcgV2ViR0wxIGV4dGVuc2lvbj9cbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUxdID0gNDtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF8xMTExMTBGXSA9IDQ7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfU1JHQl0gPSA0O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1NSR0JBXSA9IDQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIV9ibG9ja1NpemVUYWJsZSkge1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlID0gW107XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRVRDMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0VUQzJfUkdCXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRFhUMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0FUQ19SR0JdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9FVEMyX1JHQkFdID0gMTY7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRFhUM10gPSAxNjtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9EWFQ1XSA9IDE2O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0FTVENfNHg0XSA9IDE2O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0FUQ19SR0JBXSA9IDE2O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGl4ZWxTaXplID0gX3BpeGVsU2l6ZVRhYmxlLmhhc093blByb3BlcnR5KGZvcm1hdCkgPyBfcGl4ZWxTaXplVGFibGVbZm9ybWF0XSA6IDA7XG4gICAgICAgIGNvbnN0IGJsb2NrU2l6ZSA9IF9ibG9ja1NpemVUYWJsZS5oYXNPd25Qcm9wZXJ0eShmb3JtYXQpID8gX2Jsb2NrU2l6ZVRhYmxlW2Zvcm1hdF0gOiAwO1xuICAgICAgICBsZXQgcmVzdWx0ID0gMDtcblxuICAgICAgICB3aGlsZSAoMSkge1xuICAgICAgICAgICAgaWYgKHBpeGVsU2l6ZSA+IDApIHtcbiAgICAgICAgICAgICAgICAvLyBoYW5kbGUgdW5jb21wcmVzc2VkIGZvcm1hdHNcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gd2lkdGggKiBoZWlnaHQgKiBkZXB0aCAqIHBpeGVsU2l6ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gaGFuZGxlIGJsb2NrIGZvcm1hdHNcbiAgICAgICAgICAgICAgICBsZXQgYmxvY2tXaWR0aCA9IE1hdGguZmxvb3IoKHdpZHRoICsgMykgLyA0KTtcbiAgICAgICAgICAgICAgICBjb25zdCBibG9ja0hlaWdodCA9IE1hdGguZmxvb3IoKGhlaWdodCArIDMpIC8gNCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmxvY2tEZXB0aCA9IE1hdGguZmxvb3IoKGRlcHRoICsgMykgLyA0KTtcblxuICAgICAgICAgICAgICAgIGlmIChmb3JtYXQgPT09IFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEgfHxcbiAgICAgICAgICAgICAgICAgICAgZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSkge1xuICAgICAgICAgICAgICAgICAgICBibG9ja1dpZHRoID0gTWF0aC5tYXgoTWF0aC5mbG9vcihibG9ja1dpZHRoIC8gMiksIDEpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc3VsdCArPSBibG9ja1dpZHRoICogYmxvY2tIZWlnaHQgKiBibG9ja0RlcHRoICogYmxvY2tTaXplO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gd2UncmUgZG9uZSBpZiBtaXBtYXBzIGFyZW4ndCByZXF1aXJlZCBvciB3ZSd2ZSBjYWxjdWxhdGVkIHRoZSBzbWFsbGVzdCBtaXBtYXAgbGV2ZWxcbiAgICAgICAgICAgIGlmICghbWlwbWFwcyB8fCAoKHdpZHRoID09PSAxKSAmJiAoaGVpZ2h0ID09PSAxKSAmJiAoZGVwdGggPT09IDEpKSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2lkdGggPSBNYXRoLm1heChNYXRoLmZsb29yKHdpZHRoIC8gMiksIDEpO1xuICAgICAgICAgICAgaGVpZ2h0ID0gTWF0aC5tYXgoTWF0aC5mbG9vcihoZWlnaHQgLyAyKSwgMSk7XG4gICAgICAgICAgICBkZXB0aCA9IE1hdGgubWF4KE1hdGguZmxvb3IoZGVwdGggLyAyKSwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0ICogKGN1YmVtYXAgPyA2IDogMSk7XG4gICAgfVxuXG4gICAgLy8gRm9yY2UgYSBmdWxsIHJlc3VibWlzc2lvbiBvZiB0aGUgdGV4dHVyZSB0byBXZWJHTCAodXNlZCBvbiBhIGNvbnRleHQgcmVzdG9yZSBldmVudClcbiAgICBkaXJ0eUFsbCgpIHtcbiAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZCA9IHRoaXMuX2N1YmVtYXAgPyBbW3RydWUsIHRydWUsIHRydWUsIHRydWUsIHRydWUsIHRydWVdXSA6IFt0cnVlXTtcblxuICAgICAgICB0aGlzLl9uZWVkc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX25lZWRzTWlwbWFwc1VwbG9hZCA9IHRoaXMuX21pcG1hcHM7XG4gICAgICAgIHRoaXMuX21pcG1hcHNVcGxvYWRlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzID0gMjU1OyAvLyAxIHwgMiB8IDQgfCA4IHwgMTYgfCAzMiB8IDY0IHwgMTI4XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9ja3MgYSBtaXBsZXZlbCBvZiB0aGUgdGV4dHVyZSwgcmV0dXJuaW5nIGEgdHlwZWQgYXJyYXkgdG8gYmUgZmlsbGVkIHdpdGggcGl4ZWwgZGF0YS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBvcHRpb25zIG9iamVjdC4gVmFsaWQgcHJvcGVydGllcyBhcmUgYXMgZm9sbG93czpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubGV2ZWxdIC0gVGhlIG1pcCBsZXZlbCB0byBsb2NrIHdpdGggMCBiZWluZyB0aGUgdG9wIGxldmVsLiBEZWZhdWx0c1xuICAgICAqIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZhY2VdIC0gSWYgdGhlIHRleHR1cmUgaXMgYSBjdWJlbWFwLCB0aGlzIGlzIHRoZSBpbmRleCBvZiB0aGUgZmFjZVxuICAgICAqIHRvIGxvY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1vZGVdIC0gVGhlIGxvY2sgbW9kZS4gQ2FuIGJlOlxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVMT0NLX1JFQUR9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRUxPQ0tfV1JJVEV9XG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFRFWFRVUkVMT0NLX1dSSVRFfS5cbiAgICAgKiBAcmV0dXJucyB7VWludDhBcnJheXxVaW50MTZBcnJheXxGbG9hdDMyQXJyYXl9IEEgdHlwZWQgYXJyYXkgY29udGFpbmluZyB0aGUgcGl4ZWwgZGF0YSBvZlxuICAgICAqIHRoZSBsb2NrZWQgbWlwIGxldmVsLlxuICAgICAqL1xuICAgIGxvY2sob3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIC8vIEluaXRpYWxpemUgb3B0aW9ucyB0byBzb21lIHNlbnNpYmxlIGRlZmF1bHRzXG4gICAgICAgIGlmIChvcHRpb25zLmxldmVsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMubGV2ZWwgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmZhY2UgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5mYWNlID0gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5tb2RlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMubW9kZSA9IFRFWFRVUkVMT0NLX1dSSVRFO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbG9ja2VkTGV2ZWwgPSBvcHRpb25zLmxldmVsO1xuXG4gICAgICAgIGlmICh0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIHN3aXRjaCAodGhpcy5fZm9ybWF0KSB7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9BODpcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0w4OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9MQTg6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogIHRoaXMuX2RlcHRoICogMik7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCNTY1OlxuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTU1NTE6XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBNDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQxNkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjg6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiAzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBODpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RYVDE6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KE1hdGguZmxvb3IoKHRoaXMuX3dpZHRoICsgMykgLyA0KSAqIE1hdGguZmxvb3IoKHRoaXMuX2hlaWdodCArIDMpIC8gNCkgKiA4ICogdGhpcy5fZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RYVDM6XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQ1OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheShNYXRoLmZsb29yKCh0aGlzLl93aWR0aCArIDMpIC8gNCkgKiBNYXRoLmZsb29yKCh0aGlzLl9oZWlnaHQgKyAzKSAvIDQpICogMTYgKiB0aGlzLl9kZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMTZGOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDE2QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjMyRjpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogMyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTE2RjpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQxNkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiA0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMzJGOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiA0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgcGl4ZWwgZGF0YSBvZiB0aGUgdGV4dHVyZSBmcm9tIGEgY2FudmFzLCBpbWFnZSwgdmlkZW8gRE9NIGVsZW1lbnQuIElmIHRoZSB0ZXh0dXJlIGlzXG4gICAgICogYSBjdWJlbWFwLCB0aGUgc3VwcGxpZWQgc291cmNlIG11c3QgYmUgYW4gYXJyYXkgb2YgNiBjYW52YXNlcywgaW1hZ2VzIG9yIHZpZGVvcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR8SFRNTEltYWdlRWxlbWVudHxIVE1MVmlkZW9FbGVtZW50fEhUTUxDYW52YXNFbGVtZW50W118SFRNTEltYWdlRWxlbWVudFtdfEhUTUxWaWRlb0VsZW1lbnRbXX0gc291cmNlIC0gQVxuICAgICAqIGNhbnZhcywgaW1hZ2Ugb3IgdmlkZW8gZWxlbWVudCwgb3IgYW4gYXJyYXkgb2YgNiBjYW52YXMsIGltYWdlIG9yIHZpZGVvIGVsZW1lbnRzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWlwTGV2ZWxdIC0gQSBub24tbmVnYXRpdmUgaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBpbWFnZSBsZXZlbCBvZiBkZXRhaWwuXG4gICAgICogRGVmYXVsdHMgdG8gMCwgd2hpY2ggcmVwcmVzZW50cyB0aGUgYmFzZSBpbWFnZSBzb3VyY2UuIEEgbGV2ZWwgdmFsdWUgb2YgTiwgdGhhdCBpcyBncmVhdGVyXG4gICAgICogdGhhbiAwLCByZXByZXNlbnRzIHRoZSBpbWFnZSBzb3VyY2UgZm9yIHRoZSBOdGggbWlwbWFwIHJlZHVjdGlvbiBsZXZlbC5cbiAgICAgKi9cbiAgICBzZXRTb3VyY2Uoc291cmNlLCBtaXBMZXZlbCA9IDApIHtcbiAgICAgICAgbGV0IGludmFsaWQgPSBmYWxzZTtcbiAgICAgICAgbGV0IHdpZHRoLCBoZWlnaHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1YmVtYXApIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2VbMF0pIHtcbiAgICAgICAgICAgICAgICAvLyByZWx5IG9uIGZpcnN0IGZhY2Ugc2l6ZXNcbiAgICAgICAgICAgICAgICB3aWR0aCA9IHNvdXJjZVswXS53aWR0aCB8fCAwO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHNvdXJjZVswXS5oZWlnaHQgfHwgMDtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZhY2UgPSBzb3VyY2VbaV07XG4gICAgICAgICAgICAgICAgICAgIC8vIGN1YmVtYXAgYmVjb21lcyBpbnZhbGlkIGlmIGFueSBjb25kaXRpb24gaXMgbm90IHNhdGlzZmllZFxuICAgICAgICAgICAgICAgICAgICBpZiAoIWZhY2UgfHwgICAgICAgICAgICAgICAgICAvLyBmYWNlIGlzIG1pc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhY2Uud2lkdGggIT09IHdpZHRoIHx8ICAgLy8gZmFjZSBpcyBkaWZmZXJlbnQgd2lkdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhY2UuaGVpZ2h0ICE9PSBoZWlnaHQgfHwgLy8gZmFjZSBpcyBkaWZmZXJlbnQgaGVpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICAhdGhpcy5kZXZpY2UuX2lzQnJvd3NlckludGVyZmFjZShmYWNlKSkgeyAgICAgICAgICAgIC8vIG5ldyBpbWFnZSBiaXRtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGZpcnN0IGZhY2UgaXMgbWlzc2luZ1xuICAgICAgICAgICAgICAgIGludmFsaWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWludmFsaWQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXJrIGxldmVscyBhcyB1cGRhdGVkXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2xldmVsc1ttaXBMZXZlbF1baV0gIT09IHNvdXJjZVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWRbbWlwTGV2ZWxdW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBzb3VyY2UgaXMgdmFsaWQgdHlwZSBvZiBlbGVtZW50XG4gICAgICAgICAgICBpZiAoIXRoaXMuZGV2aWNlLl9pc0Jyb3dzZXJJbnRlcmZhY2Uoc291cmNlKSlcbiAgICAgICAgICAgICAgICBpbnZhbGlkID0gdHJ1ZTtcblxuICAgICAgICAgICAgaWYgKCFpbnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgLy8gbWFyayBsZXZlbCBhcyB1cGRhdGVkXG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZSAhPT0gdGhpcy5fbGV2ZWxzW21pcExldmVsXSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF0gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgd2lkdGggPSBzb3VyY2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gc291cmNlLmhlaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbnZhbGlkKSB7XG4gICAgICAgICAgICAvLyBpbnZhbGlkIHRleHR1cmVcblxuICAgICAgICAgICAgLy8gZGVmYXVsdCBzaXplc1xuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSA0O1xuICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gNDtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGxldmVsc1xuICAgICAgICAgICAgaWYgKHRoaXMuX2N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdW2ldID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF1baV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW21pcExldmVsXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdmFsaWQgdGV4dHVyZVxuICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2xldmVsc1ttaXBMZXZlbF0gPSBzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBvciBjaGFuZ2VkIHN0YXRlIG9mIHZhbGlkaXR5XG4gICAgICAgIGlmICh0aGlzLl9pbnZhbGlkICE9PSBpbnZhbGlkIHx8ICFpbnZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLl9pbnZhbGlkID0gaW52YWxpZDtcblxuICAgICAgICAgICAgLy8gcmV1cGxvYWRcbiAgICAgICAgICAgIHRoaXMudXBsb2FkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBpeGVsIGRhdGEgb2YgdGhlIHRleHR1cmUuIElmIHRoaXMgaXMgYSBjdWJlbWFwIHRoZW4gYW4gYXJyYXkgb2YgNiBpbWFnZXMgd2lsbCBiZVxuICAgICAqIHJldHVybmVkIG90aGVyd2lzZSBhIHNpbmdsZSBpbWFnZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWlwTGV2ZWxdIC0gQSBub24tbmVnYXRpdmUgaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBpbWFnZSBsZXZlbCBvZiBkZXRhaWwuXG4gICAgICogRGVmYXVsdHMgdG8gMCwgd2hpY2ggcmVwcmVzZW50cyB0aGUgYmFzZSBpbWFnZSBzb3VyY2UuIEEgbGV2ZWwgdmFsdWUgb2YgTiwgdGhhdCBpcyBncmVhdGVyXG4gICAgICogdGhhbiAwLCByZXByZXNlbnRzIHRoZSBpbWFnZSBzb3VyY2UgZm9yIHRoZSBOdGggbWlwbWFwIHJlZHVjdGlvbiBsZXZlbC5cbiAgICAgKiBAcmV0dXJucyB7SFRNTEltYWdlRWxlbWVudH0gVGhlIHNvdXJjZSBpbWFnZSBvZiB0aGlzIHRleHR1cmUuIENhbiBiZSBudWxsIGlmIHNvdXJjZSBub3RcbiAgICAgKiBhc3NpZ25lZCBmb3Igc3BlY2lmaWMgaW1hZ2UgbGV2ZWwuXG4gICAgICovXG4gICAgZ2V0U291cmNlKG1pcExldmVsID0gMCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGV2ZWxzW21pcExldmVsXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmxvY2tzIHRoZSBjdXJyZW50bHkgbG9ja2VkIG1pcCBsZXZlbCBhbmQgdXBsb2FkcyBpdCB0byBWUkFNLlxuICAgICAqL1xuICAgIHVubG9jaygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xvY2tlZExldmVsID09PSAtMSkge1xuICAgICAgICAgICAgRGVidWcubG9nKFwicGMuVGV4dHVyZSN1bmxvY2s6IEF0dGVtcHRpbmcgdG8gdW5sb2NrIGEgdGV4dHVyZSB0aGF0IGlzIG5vdCBsb2NrZWQuXCIsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBsb2FkIHRoZSBuZXcgcGl4ZWwgZGF0YVxuICAgICAgICB0aGlzLnVwbG9hZCgpO1xuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IC0xO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZvcmNlcyBhIHJldXBsb2FkIG9mIHRoZSB0ZXh0dXJlcyBwaXhlbCBkYXRhIHRvIGdyYXBoaWNzIG1lbW9yeS4gT3JkaW5hcmlseSwgdGhpcyBmdW5jdGlvblxuICAgICAqIGlzIGNhbGxlZCBieSBpbnRlcm5hbGx5IGJ5IHtAbGluayBUZXh0dXJlI3NldFNvdXJjZX0gYW5kIHtAbGluayBUZXh0dXJlI3VubG9ja30uIEhvd2V2ZXIsIGl0XG4gICAgICogc3RpbGwgbmVlZHMgdG8gYmUgY2FsbGVkIGV4cGxpY2l0bHkgaW4gdGhlIGNhc2Ugd2hlcmUgYW4gSFRNTFZpZGVvRWxlbWVudCBpcyBzZXQgYXMgdGhlXG4gICAgICogc291cmNlIG9mIHRoZSB0ZXh0dXJlLiAgTm9ybWFsbHksIHRoaXMgaXMgZG9uZSBvbmNlIGV2ZXJ5IGZyYW1lIGJlZm9yZSB2aWRlbyB0ZXh0dXJlZFxuICAgICAqIGdlb21ldHJ5IGlzIHJlbmRlcmVkLlxuICAgICAqL1xuICAgIHVwbG9hZCgpIHtcbiAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9uZWVkc01pcG1hcHNVcGxvYWQgPSB0aGlzLl9taXBtYXBzO1xuICAgICAgICB0aGlzLmltcGwudXBsb2FkSW1tZWRpYXRlPy4odGhpcy5kZXZpY2UsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlIGFuIGluLW1lbW9yeSBERFMgcmVwcmVzZW50YXRpb24gb2YgdGhpcyB0ZXh0dXJlLiBPbmx5IHdvcmtzIG9uIFJHQkE4IHRleHR1cmVzLlxuICAgICAqIEN1cnJlbnRseSwgb25seSB1c2VkIGJ5IHRoZSBFZGl0b3IgdG8gd3JpdGUgcHJlZmlsdGVyZWQgY3ViZW1hcHMgdG8gRERTIGZvcm1hdC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBcnJheUJ1ZmZlcn0gQnVmZmVyIGNvbnRhaW5pbmcgdGhlIEREUyBkYXRhLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXREZHMoKSB7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTgsIFwiVGhpcyBmb3JtYXQgaXMgbm90IGltcGxlbWVudGVkIHlldFwiKTtcblxuICAgICAgICBsZXQgZnNpemUgPSAxMjg7XG4gICAgICAgIGxldCBpZHggPSAwO1xuICAgICAgICB3aGlsZSAodGhpcy5fbGV2ZWxzW2lkeF0pIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWlwU2l6ZSA9IHRoaXMuX2xldmVsc1tpZHhdLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBpZiAoIW1pcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYE5vIGJ5dGUgYXJyYXkgZm9yIG1pcCAke2lkeH1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZnNpemUgKz0gbWlwU2l6ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9sZXZlbHNbaWR4XVtmYWNlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYE5vIGxldmVsIGRhdGEgZm9yIG1pcCAke2lkeH0sIGZhY2UgJHtmYWNlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBtaXBTaXplID0gdGhpcy5fbGV2ZWxzW2lkeF1bZmFjZV0ubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW1pcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBObyBieXRlIGFycmF5IGZvciBtaXAgJHtpZHh9LCBmYWNlICR7ZmFjZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZnNpemUgKz0gbWlwU2l6ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmc2l6ZSArPSB0aGlzLl9sZXZlbHNbaWR4XS5sZW5ndGg7XG4gICAgICAgICAgICBpZHgrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGJ1ZmYgPSBuZXcgQXJyYXlCdWZmZXIoZnNpemUpO1xuICAgICAgICBjb25zdCBoZWFkZXIgPSBuZXcgVWludDMyQXJyYXkoYnVmZiwgMCwgMTI4IC8gNCk7XG5cbiAgICAgICAgY29uc3QgRERTX01BR0lDID0gNTQyMzI3ODc2OyAvLyBcIkREU1wiXG4gICAgICAgIGNvbnN0IEREU19IRUFERVJfU0laRSA9IDEyNDtcbiAgICAgICAgY29uc3QgRERTX0ZMQUdTX1JFUVVJUkVEID0gMHgwMSB8IDB4MDIgfCAweDA0IHwgMHgxMDAwIHwgMHg4MDAwMDsgLy8gY2FwcyB8IGhlaWdodCB8IHdpZHRoIHwgcGl4ZWxmb3JtYXQgfCBsaW5lYXJzaXplXG4gICAgICAgIGNvbnN0IEREU19GTEFHU19NSVBNQVAgPSAweDIwMDAwO1xuICAgICAgICBjb25zdCBERFNfUElYRUxGT1JNQVRfU0laRSA9IDMyO1xuICAgICAgICBjb25zdCBERFNfUElYRUxGTEFHU19SR0JBOCA9IDB4MDEgfCAweDQwOyAvLyBhbHBoYSB8IHJnYlxuICAgICAgICBjb25zdCBERFNfQ0FQU19SRVFVSVJFRCA9IDB4MTAwMDtcbiAgICAgICAgY29uc3QgRERTX0NBUFNfTUlQTUFQID0gMHg0MDAwMDA7XG4gICAgICAgIGNvbnN0IEREU19DQVBTX0NPTVBMRVggPSAweDg7XG4gICAgICAgIGNvbnN0IEREU19DQVBTMl9DVUJFTUFQID0gMHgyMDAgfCAweDQwMCB8IDB4ODAwIHwgMHgxMDAwIHwgMHgyMDAwIHwgMHg0MDAwIHwgMHg4MDAwOyAvLyBjdWJlbWFwIHwgYWxsIGZhY2VzXG5cbiAgICAgICAgbGV0IGZsYWdzID0gRERTX0ZMQUdTX1JFUVVJUkVEO1xuICAgICAgICBpZiAodGhpcy5fbGV2ZWxzLmxlbmd0aCA+IDEpIGZsYWdzIHw9IEREU19GTEFHU19NSVBNQVA7XG5cbiAgICAgICAgbGV0IGNhcHMgPSBERFNfQ0FQU19SRVFVSVJFRDtcbiAgICAgICAgaWYgKHRoaXMuX2xldmVscy5sZW5ndGggPiAxKSBjYXBzIHw9IEREU19DQVBTX01JUE1BUDtcbiAgICAgICAgaWYgKHRoaXMuX2xldmVscy5sZW5ndGggPiAxIHx8IHRoaXMuY3ViZW1hcCkgY2FwcyB8PSBERFNfQ0FQU19DT01QTEVYO1xuXG4gICAgICAgIGNvbnN0IGNhcHMyID0gdGhpcy5jdWJlbWFwID8gRERTX0NBUFMyX0NVQkVNQVAgOiAwO1xuXG4gICAgICAgIGhlYWRlclswXSA9IEREU19NQUdJQztcbiAgICAgICAgaGVhZGVyWzFdID0gRERTX0hFQURFUl9TSVpFO1xuICAgICAgICBoZWFkZXJbMl0gPSBmbGFncztcbiAgICAgICAgaGVhZGVyWzNdID0gdGhpcy5oZWlnaHQ7XG4gICAgICAgIGhlYWRlcls0XSA9IHRoaXMud2lkdGg7XG4gICAgICAgIGhlYWRlcls1XSA9IHRoaXMud2lkdGggKiB0aGlzLmhlaWdodCAqIDQ7XG4gICAgICAgIGhlYWRlcls2XSA9IDA7IC8vIGRlcHRoXG4gICAgICAgIGhlYWRlcls3XSA9IHRoaXMuX2xldmVscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTE7IGkrKykge1xuICAgICAgICAgICAgaGVhZGVyWzggKyBpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaGVhZGVyWzE5XSA9IEREU19QSVhFTEZPUk1BVF9TSVpFO1xuICAgICAgICBoZWFkZXJbMjBdID0gRERTX1BJWEVMRkxBR1NfUkdCQTg7XG4gICAgICAgIGhlYWRlclsyMV0gPSAwOyAvLyBmb3VyY2NcbiAgICAgICAgaGVhZGVyWzIyXSA9IDMyOyAvLyBicHBcbiAgICAgICAgaGVhZGVyWzIzXSA9IDB4MDBGRjAwMDA7IC8vIFIgbWFza1xuICAgICAgICBoZWFkZXJbMjRdID0gMHgwMDAwRkYwMDsgLy8gRyBtYXNrXG4gICAgICAgIGhlYWRlclsyNV0gPSAweDAwMDAwMEZGOyAvLyBCIG1hc2tcbiAgICAgICAgaGVhZGVyWzI2XSA9IDB4RkYwMDAwMDA7IC8vIEEgbWFza1xuICAgICAgICBoZWFkZXJbMjddID0gY2FwcztcbiAgICAgICAgaGVhZGVyWzI4XSA9IGNhcHMyO1xuICAgICAgICBoZWFkZXJbMjldID0gMDtcbiAgICAgICAgaGVhZGVyWzMwXSA9IDA7XG4gICAgICAgIGhlYWRlclszMV0gPSAwO1xuXG4gICAgICAgIGxldCBvZmZzZXQgPSAxMjg7XG4gICAgICAgIGlmICghdGhpcy5jdWJlbWFwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xldmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxldmVsID0gdGhpcy5fbGV2ZWxzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pcCA9IG5ldyBVaW50OEFycmF5KGJ1ZmYsIG9mZnNldCwgbGV2ZWwubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxldmVsLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pcFtqXSA9IGxldmVsW2pdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvZmZzZXQgKz0gbGV2ZWwubGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xldmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZXZlbCA9IHRoaXMuX2xldmVsc1tpXVtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWlwID0gbmV3IFVpbnQ4QXJyYXkoYnVmZiwgb2Zmc2V0LCBsZXZlbC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxldmVsLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtaXBbal0gPSBsZXZlbFtqXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBvZmZzZXQgKz0gbGV2ZWwubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBidWZmO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgVGV4dHVyZSB9O1xuIl0sIm5hbWVzIjpbIl9waXhlbFNpemVUYWJsZSIsIl9ibG9ja1NpemVUYWJsZSIsImlkIiwiVGV4dHVyZSIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJvcHRpb25zIiwiZGV2aWNlIiwiRGVidWciLCJhc3NlcnQiLCJuYW1lIiwiX3dpZHRoIiwiX2hlaWdodCIsIl9kZXB0aCIsIl9mb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBOCIsInR5cGUiLCJURVhUVVJFVFlQRV9ERUZBVUxUIiwicHJvamVjdGlvbiIsIlRFWFRVUkVQUk9KRUNUSU9OX05PTkUiLCJfY3ViZW1hcCIsIl92b2x1bWUiLCJmaXhDdWJlbWFwU2VhbXMiLCJfZmxpcFkiLCJfcHJlbXVsdGlwbHlBbHBoYSIsIl9pc1JlbmRlclRhcmdldCIsIl9taXBtYXBzIiwiX21pbkZpbHRlciIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsIl9tYWdGaWx0ZXIiLCJGSUxURVJfTElORUFSIiwiX2FuaXNvdHJvcHkiLCJfYWRkcmVzc1UiLCJBRERSRVNTX1JFUEVBVCIsIl9hZGRyZXNzViIsIl9hZGRyZXNzVyIsIl9jb21wYXJlT25SZWFkIiwiX2NvbXBhcmVGdW5jIiwiRlVOQ19MRVNTIiwicHJvZmlsZXJIaW50IiwidW5kZWZpbmVkIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJoYXNPd25Qcm9wZXJ0eSIsImRlcHJlY2F0ZWQiLCJyZ2JtIiwiVEVYVFVSRVRZUEVfUkdCTSIsInN3aXp6bGVHR0dSIiwiVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IiLCJtaXBtYXBzIiwiYXV0b01pcG1hcCIsIl9sZXZlbHMiLCJsZXZlbHMiLCJjdWJlbWFwIiwiVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSIsIm1pbkZpbHRlciIsIm1hZ0ZpbHRlciIsImFuaXNvdHJvcHkiLCJhZGRyZXNzVSIsImFkZHJlc3NWIiwiY29tcGFyZU9uUmVhZCIsImZsaXBZIiwicHJlbXVsdGlwbHlBbHBoYSIsIndlYmdsMiIsImRlcHRoIiwidm9sdW1lIiwiYWRkcmVzc1ciLCJfY29tcHJlc3NlZCIsImlzQ29tcHJlc3NlZFBpeGVsRm9ybWF0IiwiX2ludmFsaWQiLCJfbG9ja2VkTGV2ZWwiLCJkaXJ0eUFsbCIsIl9ncHVTaXplIiwiaW1wbCIsImNyZWF0ZVRleHR1cmVJbXBsIiwidGV4dHVyZXMiLCJwdXNoIiwidHJhY2UiLCJUUkFDRUlEX1RFWFRVUkVfQUxMT0MiLCJkZXN0cm95IiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsInNjb3BlIiwicmVtb3ZlVmFsdWUiLCJhZGp1c3RWcmFtU2l6ZVRyYWNraW5nIiwiX3ZyYW0iLCJsb3NlQ29udGV4dCIsInZyYW0iLCJzaXplIiwiVFJBQ0VJRF9WUkFNX1RFWFRVUkUiLCJ0ZXgiLCJURVhISU5UX1NIQURPV01BUCIsInRleFNoYWRvdyIsIlRFWEhJTlRfQVNTRVQiLCJ0ZXhBc3NldCIsIlRFWEhJTlRfTElHSFRNQVAiLCJ0ZXhMaWdodG1hcCIsInYiLCJfcGFyYW1ldGVyRmxhZ3MiLCJ3YXJuIiwiY29tcGFyZUZ1bmMiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwiZ3B1U2l6ZSIsIm1pcHMiLCJwb3QiLCJsZW5ndGgiLCJjYWxjR3B1U2l6ZSIsIl9uZWVkc1VwbG9hZCIsIm1hdGgiLCJwb3dlck9mVHdvIiwiZW5jb2RpbmciLCJURVhUVVJFVFlQRV9SR0JFIiwiVEVYVFVSRVRZUEVfUkdCUCIsIlBJWEVMRk9STUFUX1JHQjE2RiIsIlBJWEVMRk9STUFUX1JHQjMyRiIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiUElYRUxGT1JNQVRfQTgiLCJQSVhFTEZPUk1BVF9MOCIsIlBJWEVMRk9STUFUX0xBOCIsIlBJWEVMRk9STUFUX1JHQjU2NSIsIlBJWEVMRk9STUFUX1JHQkE1NTUxIiwiUElYRUxGT1JNQVRfUkdCQTQiLCJQSVhFTEZPUk1BVF9SR0I4IiwiUElYRUxGT1JNQVRfUjMyRiIsIlBJWEVMRk9STUFUX0RFUFRIIiwiUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMIiwiUElYRUxGT1JNQVRfMTExMTEwRiIsIlBJWEVMRk9STUFUX1NSR0IiLCJQSVhFTEZPUk1BVF9TUkdCQSIsIlBJWEVMRk9STUFUX0VUQzEiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQiIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX0RYVDEiLCJQSVhFTEZPUk1BVF9BVENfUkdCIiwiUElYRUxGT1JNQVRfRVRDMl9SR0JBIiwiUElYRUxGT1JNQVRfRFhUMyIsIlBJWEVMRk9STUFUX0RYVDUiLCJQSVhFTEZPUk1BVF9BU1RDXzR4NCIsIlBJWEVMRk9STUFUX0FUQ19SR0JBIiwicGl4ZWxTaXplIiwiYmxvY2tTaXplIiwicmVzdWx0IiwiYmxvY2tXaWR0aCIsIk1hdGgiLCJmbG9vciIsImJsb2NrSGVpZ2h0IiwiYmxvY2tEZXB0aCIsIm1heCIsIl9sZXZlbHNVcGRhdGVkIiwiX21pcG1hcHNVcGxvYWRlZCIsImxvY2siLCJsZXZlbCIsImZhY2UiLCJtb2RlIiwiVEVYVFVSRUxPQ0tfV1JJVEUiLCJVaW50OEFycmF5IiwiVWludDE2QXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJzZXRTb3VyY2UiLCJzb3VyY2UiLCJtaXBMZXZlbCIsImludmFsaWQiLCJpIiwiX2lzQnJvd3NlckludGVyZmFjZSIsInVwbG9hZCIsImdldFNvdXJjZSIsInVubG9jayIsImxvZyIsInVwbG9hZEltbWVkaWF0ZSIsImdldERkcyIsImZzaXplIiwibWlwU2l6ZSIsImVycm9yIiwiYnVmZiIsIkFycmF5QnVmZmVyIiwiaGVhZGVyIiwiVWludDMyQXJyYXkiLCJERFNfTUFHSUMiLCJERFNfSEVBREVSX1NJWkUiLCJERFNfRkxBR1NfUkVRVUlSRUQiLCJERFNfRkxBR1NfTUlQTUFQIiwiRERTX1BJWEVMRk9STUFUX1NJWkUiLCJERFNfUElYRUxGTEFHU19SR0JBOCIsIkREU19DQVBTX1JFUVVJUkVEIiwiRERTX0NBUFNfTUlQTUFQIiwiRERTX0NBUFNfQ09NUExFWCIsIkREU19DQVBTMl9DVUJFTUFQIiwiZmxhZ3MiLCJjYXBzIiwiY2FwczIiLCJvZmZzZXQiLCJtaXAiLCJqIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBc0JBLElBQUlBLGVBQWUsR0FBRyxJQUFJLENBQUE7QUFDMUIsSUFBSUMsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUUxQixJQUFJQyxFQUFFLEdBQUcsQ0FBQyxDQUFBOztBQU1WLE1BQU1DLE9BQU8sQ0FBQztBQWlIVkMsRUFBQUEsV0FBVyxDQUFDQyxjQUFjLEVBQUVDLE9BQU8sRUFBRTtBQUNqQyxJQUFBLElBQUksQ0FBQ0osRUFBRSxHQUFHQSxFQUFFLEVBQUUsQ0FBQTtJQUNkLElBQUksQ0FBQ0ssTUFBTSxHQUFHRixjQUFjLENBQUE7SUFDNUJHLEtBQUssQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQ0YsTUFBTSxFQUFFLDBEQUEwRCxDQUFDLENBQUE7O0lBT3JGLElBQUksQ0FBQ0csSUFBSSxHQUFHLElBQUksQ0FBQTtJQUVoQixJQUFJLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUE7SUFDZixJQUFJLENBQUNDLE9BQU8sR0FBRyxDQUFDLENBQUE7SUFDaEIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBRWYsSUFBSSxDQUFDQyxPQUFPLEdBQUdDLGlCQUFpQixDQUFBO0lBQ2hDLElBQUksQ0FBQ0MsSUFBSSxHQUFHQyxtQkFBbUIsQ0FBQTtJQUMvQixJQUFJLENBQUNDLFVBQVUsR0FBR0Msc0JBQXNCLENBQUE7SUFFeEMsSUFBSSxDQUFDQyxRQUFRLEdBQUcsS0FBSyxDQUFBO0lBQ3JCLElBQUksQ0FBQ0MsT0FBTyxHQUFHLEtBQUssQ0FBQTtJQUNwQixJQUFJLENBQUNDLGVBQWUsR0FBRyxLQUFLLENBQUE7SUFDNUIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsS0FBSyxDQUFBO0lBQ25CLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsS0FBSyxDQUFBO0lBRTlCLElBQUksQ0FBQ0MsZUFBZSxHQUFH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
