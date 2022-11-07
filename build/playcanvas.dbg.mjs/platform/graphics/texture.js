/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { TRACEID_TEXTURE_ALLOC, TRACEID_VRAM_TEXTURE } from '../../core/constants.js';
import { math } from '../../core/math/math.js';
import { PIXELFORMAT_R8_G8_B8_A8, TEXTURETYPE_DEFAULT, TEXTUREPROJECTION_NONE, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTUREPROJECTION_CUBE, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ETC1, TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_L8_A8, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R4_G4_B4_A4, PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGBA, TEXTURELOCK_WRITE } from './constants.js';

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
    this._format = PIXELFORMAT_R8_G8_B8_A8;
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
    this._compressed = this._format === PIXELFORMAT_DXT1 || this._format === PIXELFORMAT_DXT3 || this._format === PIXELFORMAT_DXT5 || this._format >= PIXELFORMAT_ETC1;

    this._invalid = false;
    this._lockedLevel = -1;
    if (!this._levels) {
      this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
    }
    this.dirtyAll();
    this._gpuSize = 0;
    this.impl = graphicsDevice.createTextureImpl(this);

    graphicsDevice.textures.push(this);
    Debug.trace(TRACEID_TEXTURE_ALLOC, `Alloc: Id ${this.id} ${this.name}: ${this.width}x${this.height} ` + `${this.cubemap ? '[Cubemap]' : ''}` + `${this.volume ? '[Volume]' : ''}` + `${this.mipmaps ? '[Mipmaps]' : ''}`);
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
      _pixelSizeTable[PIXELFORMAT_L8_A8] = 2;
      _pixelSizeTable[PIXELFORMAT_R5_G6_B5] = 2;
      _pixelSizeTable[PIXELFORMAT_R5_G5_B5_A1] = 2;
      _pixelSizeTable[PIXELFORMAT_R4_G4_B4_A4] = 2;
      _pixelSizeTable[PIXELFORMAT_R8_G8_B8] = 4;
      _pixelSizeTable[PIXELFORMAT_R8_G8_B8_A8] = 4;
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
        case PIXELFORMAT_L8_A8:
          this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth * 2);
          break;
        case PIXELFORMAT_R5_G6_B5:
        case PIXELFORMAT_R5_G5_B5_A1:
        case PIXELFORMAT_R4_G4_B4_A4:
          this._levels[options.level] = new Uint16Array(this._width * this._height * this._depth);
          break;
        case PIXELFORMAT_R8_G8_B8:
          this._levels[options.level] = new Uint8Array(this._width * this._height * this._depth * 3);
          break;
        case PIXELFORMAT_R8_G8_B8_A8:
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
      Debug.log("pc.Texture#unlock: Attempting to unlock a texture that is not locked.");
    }

    this.upload();
    this._lockedLevel = -1;
  }

  upload() {
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
  }

  getDds() {
    Debug.assert(this.format === PIXELFORMAT_R8_G8_B8_A8, "This format is not implemented yet");
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVEVYVFVSRV9BTExPQywgVFJBQ0VJRF9WUkFNX1RFWFRVUkUgfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQge1xuICAgIEFERFJFU1NfUkVQRUFULFxuICAgIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBGVU5DX0xFU1MsXG4gICAgUElYRUxGT1JNQVRfQTgsIFBJWEVMRk9STUFUX0w4LCBQSVhFTEZPUk1BVF9MOF9BOCwgUElYRUxGT1JNQVRfUjVfRzZfQjUsIFBJWEVMRk9STUFUX1I1X0c1X0I1X0ExLCBQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNCxcbiAgICBQSVhFTEZPUk1BVF9SOF9HOF9COCwgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsIFBJWEVMRk9STUFUX0RYVDEsIFBJWEVMRk9STUFUX0RYVDMsIFBJWEVMRk9STUFUX0RYVDUsXG4gICAgUElYRUxGT1JNQVRfUkdCMTZGLCBQSVhFTEZPUk1BVF9SR0JBMTZGLCBQSVhFTEZPUk1BVF9SR0IzMkYsIFBJWEVMRk9STUFUX1JHQkEzMkYsIFBJWEVMRk9STUFUX1IzMkYsIFBJWEVMRk9STUFUX0RFUFRILFxuICAgIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCwgUElYRUxGT1JNQVRfMTExMTEwRiwgUElYRUxGT1JNQVRfU1JHQiwgUElYRUxGT1JNQVRfU1JHQkEsIFBJWEVMRk9STUFUX0VUQzEsXG4gICAgUElYRUxGT1JNQVRfRVRDMl9SR0IsIFBJWEVMRk9STUFUX0VUQzJfUkdCQSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEsXG4gICAgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSwgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEsIFBJWEVMRk9STUFUX0FTVENfNHg0LCBQSVhFTEZPUk1BVF9BVENfUkdCLFxuICAgIFBJWEVMRk9STUFUX0FUQ19SR0JBLFxuICAgIFRFWEhJTlRfU0hBRE9XTUFQLCBURVhISU5UX0FTU0VULCBURVhISU5UX0xJR0hUTUFQLFxuICAgIFRFWFRVUkVMT0NLX1dSSVRFLFxuICAgIFRFWFRVUkVQUk9KRUNUSU9OX05PTkUsIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkUsXG4gICAgVEVYVFVSRVRZUEVfREVGQVVMVCwgVEVYVFVSRVRZUEVfUkdCTSwgVEVYVFVSRVRZUEVfUkdCRSwgVEVYVFVSRVRZUEVfUkdCUCwgVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1Jcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gR3JhcGhpY3NEZXZpY2UgKi9cblxubGV0IF9waXhlbFNpemVUYWJsZSA9IG51bGw7XG5sZXQgX2Jsb2NrU2l6ZVRhYmxlID0gbnVsbDtcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIHRleHR1cmUgaXMgYSBjb250YWluZXIgZm9yIHRleGVsIGRhdGEgdGhhdCBjYW4gYmUgdXRpbGl6ZWQgaW4gYSBmcmFnbWVudCBzaGFkZXIuIFR5cGljYWxseSxcbiAqIHRoZSB0ZXhlbCBkYXRhIHJlcHJlc2VudHMgYW4gaW1hZ2UgdGhhdCBpcyBtYXBwZWQgb3ZlciBnZW9tZXRyeS5cbiAqL1xuY2xhc3MgVGV4dHVyZSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFRleHR1cmUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhpcyB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPYmplY3QgZm9yIHBhc3Npbmcgb3B0aW9uYWwgYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5uYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy53aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLiBEZWZhdWx0cyB0byA0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5oZWlnaHRdIC0gVGhlIGhlaWdodCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuIERlZmF1bHRzIHRvIDQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmRlcHRoXSAtIFRoZSBudW1iZXIgb2YgZGVwdGggc2xpY2VzIGluIGEgM0QgdGV4dHVyZSAoV2ViR0wyIG9ubHkpLlxuICAgICAqIERlZmF1bHRzIHRvIDEgKHNpbmdsZSAyRCBpbWFnZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZvcm1hdF0gLSBUaGUgcGl4ZWwgZm9ybWF0IG9mIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SNV9HNl9CNX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SOF9HOF9COH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDN9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUNX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0IxNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTE2Rn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0IzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTMyRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9FVEMxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF8xMTExMTBGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FTVENfNHg0fT4vbGk+XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVRDX1JHQn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCQX1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOH0uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnByb2plY3Rpb25dIC0gVGhlIHByb2plY3Rpb24gdHlwZSBvZiB0aGUgdGV4dHVyZSwgdXNlZCB3aGVuIHRoZVxuICAgICAqIHRleHR1cmUgcmVwcmVzZW50cyBhbiBlbnZpcm9ubWVudC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fTk9ORX1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9DVUJFfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX0VRVUlSRUNUfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX09DVEFIRURSQUx9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fQ1VCRX0gaWYgb3B0aW9ucy5jdWJlbWFwIGlzIHNwZWNpZmllZCwgb3RoZXJ3aXNlXG4gICAgICoge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX05PTkV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5GaWx0ZXJdIC0gVGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1hZ0ZpbHRlcl0gLSBUaGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hbmlzb3Ryb3B5XSAtIFRoZSBsZXZlbCBvZiBhbmlzb3Ryb3BpYyBmaWx0ZXJpbmcgdG8gdXNlLiBEZWZhdWx0c1xuICAgICAqIHRvIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NVXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFUgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NWXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFYgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NXXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFcgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5taXBtYXBzXSAtIFdoZW4gZW5hYmxlZCB0cnkgdG8gZ2VuZXJhdGUgb3IgdXNlIG1pcG1hcHMgZm9yIHRoaXNcbiAgICAgKiB0ZXh0dXJlLiBEZWZhdWx0IGlzIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jdWJlbWFwXSAtIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIGlzIHRvIGJlIGEgY3ViZW1hcC5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnZvbHVtZV0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBpcyB0byBiZSBhIDNEIHZvbHVtZVxuICAgICAqIChXZWJHTDIgb25seSkuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy50eXBlXSAtIFNwZWNpZmllcyB0aGUgaW1hZ2UgdHlwZSwgc2VlIHtAbGluayBURVhUVVJFVFlQRV9ERUZBVUxUfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZpeEN1YmVtYXBTZWFtc10gLSBTcGVjaWZpZXMgd2hldGhlciB0aGlzIGN1YmVtYXAgdGV4dHVyZSByZXF1aXJlc1xuICAgICAqIHNwZWNpYWwgc2VhbSBmaXhpbmcgc2hhZGVyIGNvZGUgdG8gbG9vayByaWdodC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mbGlwWV0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBzaG91bGQgYmUgZmxpcHBlZCBpbiB0aGVcbiAgICAgKiBZLWRpcmVjdGlvbi4gT25seSBhZmZlY3RzIHRleHR1cmVzIHdpdGggYSBzb3VyY2UgdGhhdCBpcyBhbiBpbWFnZSwgY2FudmFzIG9yIHZpZGVvIGVsZW1lbnQuXG4gICAgICogRG9lcyBub3QgYWZmZWN0IGN1YmVtYXBzLCBjb21wcmVzc2VkIHRleHR1cmVzIG9yIHRleHR1cmVzIHNldCBmcm9tIHJhdyBwaXhlbCBkYXRhLiBEZWZhdWx0c1xuICAgICAqIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlbXVsdGlwbHlBbHBoYV0gLSBJZiB0cnVlLCB0aGUgYWxwaGEgY2hhbm5lbCBvZiB0aGUgdGV4dHVyZSAoaWZcbiAgICAgKiBwcmVzZW50KSBpcyBtdWx0aXBsaWVkIGludG8gdGhlIGNvbG9yIGNoYW5uZWxzLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNvbXBhcmVPblJlYWRdIC0gV2hlbiBlbmFibGVkLCBhbmQgaWYgdGV4dHVyZSBmb3JtYXQgaXNcbiAgICAgKiB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEh9IG9yIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUx9LCBoYXJkd2FyZSBQQ0YgaXMgZW5hYmxlZCBmb3JcbiAgICAgKiB0aGlzIHRleHR1cmUsIGFuZCB5b3UgY2FuIGdldCBmaWx0ZXJlZCByZXN1bHRzIG9mIGNvbXBhcmlzb24gdXNpbmcgdGV4dHVyZSgpIGluIHlvdXIgc2hhZGVyXG4gICAgICogKFdlYkdMMiBvbmx5KS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmNvbXBhcmVGdW5jXSAtIENvbXBhcmlzb24gZnVuY3Rpb24gd2hlbiBjb21wYXJlT25SZWFkIGlzIGVuYWJsZWRcbiAgICAgKiAoV2ViR0wyIG9ubHkpLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBGVU5DX0xFU1N9LlxuICAgICAqIEBwYXJhbSB7VWludDhBcnJheVtdfSBbb3B0aW9ucy5sZXZlbHNdIC0gQXJyYXkgb2YgVWludDhBcnJheS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDh4OHgyNC1iaXQgdGV4dHVyZVxuICAgICAqIHZhciB0ZXh0dXJlID0gbmV3IHBjLlRleHR1cmUoZ3JhcGhpY3NEZXZpY2UsIHtcbiAgICAgKiAgICAgd2lkdGg6IDgsXG4gICAgICogICAgIGhlaWdodDogOCxcbiAgICAgKiAgICAgZm9ybWF0OiBwYy5QSVhFTEZPUk1BVF9SOF9HOF9COFxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gRmlsbCB0aGUgdGV4dHVyZSB3aXRoIGEgZ3JhZGllbnRcbiAgICAgKiB2YXIgcGl4ZWxzID0gdGV4dHVyZS5sb2NrKCk7XG4gICAgICogdmFyIGNvdW50ID0gMDtcbiAgICAgKiBmb3IgKHZhciBpID0gMDsgaSA8IDg7IGkrKykge1xuICAgICAqICAgICBmb3IgKHZhciBqID0gMDsgaiA8IDg7IGorKykge1xuICAgICAqICAgICAgICAgcGl4ZWxzW2NvdW50KytdID0gaSAqIDMyO1xuICAgICAqICAgICAgICAgcGl4ZWxzW2NvdW50KytdID0gaiAqIDMyO1xuICAgICAqICAgICAgICAgcGl4ZWxzW2NvdW50KytdID0gMjU1O1xuICAgICAqICAgICB9XG4gICAgICogfVxuICAgICAqIHRleHR1cmUudW5sb2NrKCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5pZCA9IGlkKys7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmRldmljZSwgXCJUZXh0dXJlIGNvbnRydWN0b3IgcmVxdWlyZXMgYSBncmFwaGljc0RldmljZSB0byBiZSB2YWxpZFwiKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG5hbWUgb2YgdGhlIHRleHR1cmUuIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm5hbWUgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gNDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gNDtcbiAgICAgICAgdGhpcy5fZGVwdGggPSAxO1xuXG4gICAgICAgIHRoaXMuX2Zvcm1hdCA9IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4O1xuICAgICAgICB0aGlzLnR5cGUgPSBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBURVhUVVJFUFJPSkVDVElPTl9OT05FO1xuXG4gICAgICAgIHRoaXMuX2N1YmVtYXAgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdm9sdW1lID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZml4Q3ViZW1hcFNlYW1zID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZsaXBZID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9pc1JlbmRlclRhcmdldCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX21pcG1hcHMgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX21pbkZpbHRlciA9IEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUjtcbiAgICAgICAgdGhpcy5fbWFnRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgdGhpcy5fYW5pc290cm9weSA9IDE7XG4gICAgICAgIHRoaXMuX2FkZHJlc3NVID0gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgIHRoaXMuX2FkZHJlc3NWID0gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgIHRoaXMuX2FkZHJlc3NXID0gQUREUkVTU19SRVBFQVQ7XG5cbiAgICAgICAgdGhpcy5fY29tcGFyZU9uUmVhZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb21wYXJlRnVuYyA9IEZVTkNfTEVTUztcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMucHJvZmlsZXJIaW50ID0gMDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKG9wdGlvbnMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMubmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSAob3B0aW9ucy53aWR0aCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMud2lkdGggOiB0aGlzLl93aWR0aDtcbiAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IChvcHRpb25zLmhlaWdodCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuaGVpZ2h0IDogdGhpcy5faGVpZ2h0O1xuXG4gICAgICAgICAgICB0aGlzLl9mb3JtYXQgPSAob3B0aW9ucy5mb3JtYXQgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmZvcm1hdCA6IHRoaXMuX2Zvcm1hdDtcblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3R5cGUnKSkge1xuICAgICAgICAgICAgICAgIHRoaXMudHlwZSA9IG9wdGlvbnMudHlwZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgncmdibScpKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChcIm9wdGlvbnMucmdibSBpcyBkZXByZWNhdGVkLiBVc2Ugb3B0aW9ucy50eXBlIGluc3RlYWQuXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMudHlwZSA9IG9wdGlvbnMucmdibSA/IFRFWFRVUkVUWVBFX1JHQk0gOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCdzd2l6emxlR0dHUicpKSB7XG4gICAgICAgICAgICAgICAgRGVidWcuZGVwcmVjYXRlZChcIm9wdGlvbnMuc3dpenpsZUdHR1IgaXMgZGVwcmVjYXRlZC4gVXNlIG9wdGlvbnMudHlwZSBpbnN0ZWFkLlwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnN3aXp6bGVHR0dSID8gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IgOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5taXBtYXBzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9taXBtYXBzID0gb3B0aW9ucy5taXBtYXBzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9taXBtYXBzID0gKG9wdGlvbnMuYXV0b01pcG1hcCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuYXV0b01pcG1hcCA6IHRoaXMuX21pcG1hcHM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2xldmVscyA9IG9wdGlvbnMubGV2ZWxzO1xuXG4gICAgICAgICAgICB0aGlzLl9jdWJlbWFwID0gKG9wdGlvbnMuY3ViZW1hcCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuY3ViZW1hcCA6IHRoaXMuX2N1YmVtYXA7XG4gICAgICAgICAgICB0aGlzLmZpeEN1YmVtYXBTZWFtcyA9IChvcHRpb25zLmZpeEN1YmVtYXBTZWFtcyAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuZml4Q3ViZW1hcFNlYW1zIDogdGhpcy5maXhDdWJlbWFwU2VhbXM7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gVEVYVFVSRVBST0pFQ1RJT05fQ1VCRTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5wcm9qZWN0aW9uICYmIG9wdGlvbnMucHJvamVjdGlvbiAhPT0gVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvamVjdGlvbiA9IG9wdGlvbnMucHJvamVjdGlvbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbWluRmlsdGVyID0gKG9wdGlvbnMubWluRmlsdGVyICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5taW5GaWx0ZXIgOiB0aGlzLl9taW5GaWx0ZXI7XG4gICAgICAgICAgICB0aGlzLl9tYWdGaWx0ZXIgPSAob3B0aW9ucy5tYWdGaWx0ZXIgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLm1hZ0ZpbHRlciA6IHRoaXMuX21hZ0ZpbHRlcjtcbiAgICAgICAgICAgIHRoaXMuX2FuaXNvdHJvcHkgPSAob3B0aW9ucy5hbmlzb3Ryb3B5ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5hbmlzb3Ryb3B5IDogdGhpcy5fYW5pc290cm9weTtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NVID0gKG9wdGlvbnMuYWRkcmVzc1UgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmFkZHJlc3NVIDogdGhpcy5fYWRkcmVzc1U7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzViA9IChvcHRpb25zLmFkZHJlc3NWICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5hZGRyZXNzViA6IHRoaXMuX2FkZHJlc3NWO1xuXG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlT25SZWFkID0gKG9wdGlvbnMuY29tcGFyZU9uUmVhZCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuY29tcGFyZU9uUmVhZCA6IHRoaXMuX2NvbXBhcmVPblJlYWQ7XG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlRnVuYyA9IChvcHRpb25zLl9jb21wYXJlRnVuYyAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuX2NvbXBhcmVGdW5jIDogdGhpcy5fY29tcGFyZUZ1bmM7XG5cbiAgICAgICAgICAgIHRoaXMuX2ZsaXBZID0gKG9wdGlvbnMuZmxpcFkgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmZsaXBZIDogdGhpcy5fZmxpcFk7XG4gICAgICAgICAgICB0aGlzLl9wcmVtdWx0aXBseUFscGhhID0gKG9wdGlvbnMucHJlbXVsdGlwbHlBbHBoYSAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMucHJlbXVsdGlwbHlBbHBoYSA6IHRoaXMuX3ByZW11bHRpcGx5QWxwaGE7XG5cbiAgICAgICAgICAgIGlmIChncmFwaGljc0RldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kZXB0aCA9IChvcHRpb25zLmRlcHRoICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5kZXB0aCA6IHRoaXMuX2RlcHRoO1xuICAgICAgICAgICAgICAgIHRoaXMuX3ZvbHVtZSA9IChvcHRpb25zLnZvbHVtZSAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMudm9sdW1lIDogdGhpcy5fdm9sdW1lO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NXID0gKG9wdGlvbnMuYWRkcmVzc1cgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmFkZHJlc3NXIDogdGhpcy5fYWRkcmVzc1c7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgICAgIHRoaXMucHJvZmlsZXJIaW50ID0gKG9wdGlvbnMucHJvZmlsZXJIaW50ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5wcm9maWxlckhpbnQgOiB0aGlzLnByb2ZpbGVySGludDtcbiAgICAgICAgICAgIC8vICNlbmRpZlxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY29tcHJlc3NlZCA9ICh0aGlzLl9mb3JtYXQgPT09IFBJWEVMRk9STUFUX0RYVDEgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3JtYXQgPT09IFBJWEVMRk9STUFUX0RYVDMgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3JtYXQgPT09IFBJWEVMRk9STUFUX0RYVDUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb3JtYXQgPj0gUElYRUxGT1JNQVRfRVRDMSk7XG5cbiAgICAgICAgLy8gTWlwIGxldmVsc1xuICAgICAgICB0aGlzLl9pbnZhbGlkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2xvY2tlZExldmVsID0gLTE7XG4gICAgICAgIGlmICghdGhpcy5fbGV2ZWxzKSB7XG4gICAgICAgICAgICB0aGlzLl9sZXZlbHMgPSB0aGlzLl9jdWJlbWFwID8gW1tudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXV0gOiBbbnVsbF07XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRpcnR5QWxsKCk7XG5cbiAgICAgICAgdGhpcy5fZ3B1U2l6ZSA9IDA7XG5cbiAgICAgICAgdGhpcy5pbXBsID0gZ3JhcGhpY3NEZXZpY2UuY3JlYXRlVGV4dHVyZUltcGwodGhpcyk7XG5cbiAgICAgICAgLy8gdHJhY2sgdGhlIHRleHR1cmVcbiAgICAgICAgZ3JhcGhpY3NEZXZpY2UudGV4dHVyZXMucHVzaCh0aGlzKTtcblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1RFWFRVUkVfQUxMT0MsIGBBbGxvYzogSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX06ICR7dGhpcy53aWR0aH14JHt0aGlzLmhlaWdodH0gYCArXG4gICAgICAgICAgICBgJHt0aGlzLmN1YmVtYXAgPyAnW0N1YmVtYXBdJyA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy52b2x1bWUgPyAnW1ZvbHVtZV0nIDogJyd9YCArXG4gICAgICAgICAgICBgJHt0aGlzLm1pcG1hcHMgPyAnW01pcG1hcHNdJyA6ICcnfWApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWVzIHJlc291cmNlcyBhc3NvY2lhdGVkIHdpdGggdGhpcyB0ZXh0dXJlLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9URVhUVVJFX0FMTE9DLCBgRGVBbGxvYzogSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX1gKTtcblxuICAgICAgICBpZiAodGhpcy5kZXZpY2UpIHtcbiAgICAgICAgICAgIC8vIHN0b3AgdHJhY2tpbmcgdGhlIHRleHR1cmVcbiAgICAgICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICAgICAgY29uc3QgaWR4ID0gZGV2aWNlLnRleHR1cmVzLmluZGV4T2YodGhpcyk7XG4gICAgICAgICAgICBpZiAoaWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGRldmljZS50ZXh0dXJlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVtb3ZlIHRleHR1cmUgZnJvbSBhbnkgdW5pZm9ybXNcbiAgICAgICAgICAgIGRldmljZS5zY29wZS5yZW1vdmVWYWx1ZSh0aGlzKTtcblxuICAgICAgICAgICAgLy8gZGVzdHJveSBpbXBsZW1lbnRhdGlvblxuICAgICAgICAgICAgdGhpcy5pbXBsLmRlc3Ryb3koZGV2aWNlKTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIHRleHR1cmUgc3RhdHNcbiAgICAgICAgICAgIHRoaXMuYWRqdXN0VnJhbVNpemVUcmFja2luZyhkZXZpY2UuX3ZyYW0sIC10aGlzLl9ncHVTaXplKTtcblxuICAgICAgICAgICAgdGhpcy5fbGV2ZWxzID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuZGV2aWNlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSByZW5kZXJpbmcgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW1wbC5sb3NlQ29udGV4dCgpO1xuICAgICAgICB0aGlzLmRpcnR5QWxsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB2cmFtIHNpemUgdHJhY2tpbmcgZm9yIHRoZSB0ZXh0dXJlLCBzaXplIGNhbiBiZSBwb3NpdGl2ZSB0byBhZGQgb3IgbmVnYXRpdmUgdG8gc3VidHJhY3RcbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhZGp1c3RWcmFtU2l6ZVRyYWNraW5nKHZyYW0sIHNpemUpIHtcblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1ZSQU1fVEVYVFVSRSwgYCR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9IHNpemU6ICR7c2l6ZX0gdnJhbS50ZXh0dXJlOiAke3ZyYW0udGV4fSA9PiAke3ZyYW0udGV4ICsgc2l6ZX1gKTtcblxuICAgICAgICB2cmFtLnRleCArPSBzaXplO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgaWYgKHRoaXMucHJvZmlsZXJIaW50ID09PSBURVhISU5UX1NIQURPV01BUCkge1xuICAgICAgICAgICAgdnJhbS50ZXhTaGFkb3cgKz0gc2l6ZTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnByb2ZpbGVySGludCA9PT0gVEVYSElOVF9BU1NFVCkge1xuICAgICAgICAgICAgdnJhbS50ZXhBc3NldCArPSBzaXplO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucHJvZmlsZXJIaW50ID09PSBURVhISU5UX0xJR0hUTUFQKSB7XG4gICAgICAgICAgICB2cmFtLnRleExpZ2h0bWFwICs9IHNpemU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXIgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1R9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX05FQVJFU1R9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWluRmlsdGVyKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX21pbkZpbHRlciAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fbWluRmlsdGVyID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWluRmlsdGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWluRmlsdGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYWduaWZpY2F0aW9uIGZpbHRlciB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbWFnRmlsdGVyKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hZ0ZpbHRlciAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fbWFnRmlsdGVyID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFnRmlsdGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFnRmlsdGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhZGRyZXNzaW5nIG1vZGUgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZSBob3Jpem9udGFsbHkuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfUkVQRUFUfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfQ0xBTVBfVE9fRURHRX1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX01JUlJPUkVEX1JFUEVBVH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFkZHJlc3NVKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZHJlc3NVICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzVSA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSA0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFkZHJlc3NVKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkcmVzc1U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFkZHJlc3NpbmcgbW9kZSB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlIHZlcnRpY2FsbHkuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfUkVQRUFUfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfQ0xBTVBfVE9fRURHRX1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX01JUlJPUkVEX1JFUEVBVH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFkZHJlc3NWKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZHJlc3NWICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzViA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSA4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFkZHJlc3NWKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkcmVzc1Y7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFkZHJlc3NpbmcgbW9kZSB0byBiZSBhcHBsaWVkIHRvIHRoZSAzRCB0ZXh0dXJlIGRlcHRoIChXZWJHTDIgb25seSkuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfUkVQRUFUfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfQ0xBTVBfVE9fRURHRX1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX01JUlJPUkVEX1JFUEVBVH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFkZHJlc3NXKGFkZHJlc3NXKSB7XG4gICAgICAgIGlmICghdGhpcy5kZXZpY2Uud2ViZ2wyKSByZXR1cm47XG4gICAgICAgIGlmICghdGhpcy5fdm9sdW1lKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKFwicGMuVGV4dHVyZSNhZGRyZXNzVzogQ2FuJ3Qgc2V0IFcgYWRkcmVzc2luZyBtb2RlIGZvciBhIG5vbi0zRCB0ZXh0dXJlLlwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYWRkcmVzc1cgIT09IHRoaXMuX2FkZHJlc3NXKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzVyA9IGFkZHJlc3NXO1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMTY7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWRkcmVzc1coKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRyZXNzVztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXaGVuIGVuYWJsZWQsIGFuZCBpZiB0ZXh0dXJlIGZvcm1hdCBpcyB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEh9IG9yXG4gICAgICoge0BsaW5rIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTH0sIGhhcmR3YXJlIFBDRiBpcyBlbmFibGVkIGZvciB0aGlzIHRleHR1cmUsIGFuZCB5b3UgY2FuIGdldFxuICAgICAqIGZpbHRlcmVkIHJlc3VsdHMgb2YgY29tcGFyaXNvbiB1c2luZyB0ZXh0dXJlKCkgaW4geW91ciBzaGFkZXIgKFdlYkdMMiBvbmx5KS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjb21wYXJlT25SZWFkKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBhcmVPblJlYWQgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBhcmVPblJlYWQgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMzI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29tcGFyZU9uUmVhZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhcmVPblJlYWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcGFyaXNvbiBmdW5jdGlvbiB3aGVuIGNvbXBhcmVPblJlYWQgaXMgZW5hYmxlZCAoV2ViR0wyIG9ubHkpLiBQb3NzaWJsZSB2YWx1ZXM6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGNvbXBhcmVGdW5jKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2NvbXBhcmVGdW5jICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlRnVuYyA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSA2NDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjb21wYXJlRnVuYygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhcmVGdW5jO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEludGVnZXIgdmFsdWUgc3BlY2lmeWluZyB0aGUgbGV2ZWwgb2YgYW5pc290cm9waWMgdG8gYXBwbHkgdG8gdGhlIHRleHR1cmUgcmFuZ2luZyBmcm9tIDEgKG5vXG4gICAgICogYW5pc290cm9waWMgZmlsdGVyaW5nKSB0byB0aGUge0BsaW5rIEdyYXBoaWNzRGV2aWNlfSBwcm9wZXJ0eSBtYXhBbmlzb3Ryb3B5LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYW5pc290cm9weSh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9hbmlzb3Ryb3B5ICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9hbmlzb3Ryb3B5ID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDEyODtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhbmlzb3Ryb3B5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW5pc290cm9weTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUb2dnbGVzIGF1dG9tYXRpYyBtaXBtYXAgZ2VuZXJhdGlvbi4gQ2FuJ3QgYmUgdXNlZCBvbiBub24gcG93ZXIgb2YgdHdvIHRleHR1cmVzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQGlnbm9yZVxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICovXG4gICAgc2V0IGF1dG9NaXBtYXAodikge1xuICAgICAgICB0aGlzLl9taXBtYXBzID0gdjtcbiAgICB9XG5cbiAgICBnZXQgYXV0b01pcG1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pcG1hcHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyBpZiB0ZXh0dXJlIHNob3VsZCBnZW5lcmF0ZS91cGxvYWQgbWlwbWFwcyBpZiBwb3NzaWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBtaXBtYXBzKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX21pcG1hcHMgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX21pcG1hcHMgPSB2O1xuICAgICAgICAgICAgaWYgKHYpIHRoaXMuX25lZWRzTWlwbWFwc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWlwbWFwcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pcG1hcHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHdpZHRoIG9mIHRoZSB0ZXh0dXJlIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd2lkdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGhlaWdodCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9oZWlnaHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG51bWJlciBvZiBkZXB0aCBzbGljZXMgaW4gYSAzRCB0ZXh0dXJlIChXZWJHTDIgb25seSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBkZXB0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2RlcHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBwaXhlbCBmb3JtYXQgb2YgdGhlIHRleHR1cmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0E4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0w4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0w4X0E4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1I1X0c2X0I1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1I1X0c1X0I1X0ExfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1I0X0c0X0I0X0E0fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1I4X0c4X0I4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUM31cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQ1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjE2Rn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjMyRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0VUQzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUXzExMTExMEZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVNUQ180eDR9Pi9saT5cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0JBfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZm9ybWF0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZm9ybWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGlzIHRleHR1cmUgaXMgYSBjdWJlIG1hcCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGN1YmVtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdWJlbWFwO1xuICAgIH1cblxuICAgIGdldCBncHVTaXplKCkge1xuICAgICAgICBjb25zdCBtaXBzID0gdGhpcy5wb3QgJiYgdGhpcy5fbWlwbWFwcyAmJiAhKHRoaXMuX2NvbXByZXNzZWQgJiYgdGhpcy5fbGV2ZWxzLmxlbmd0aCA9PT0gMSk7XG4gICAgICAgIHJldHVybiBUZXh0dXJlLmNhbGNHcHVTaXplKHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQsIHRoaXMuX2RlcHRoLCB0aGlzLl9mb3JtYXQsIG1pcHMsIHRoaXMuX2N1YmVtYXApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGlzIHRleHR1cmUgaXMgYSAzRCB2b2x1bWUgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB2b2x1bWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92b2x1bWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgc2hvdWxkIGJlIGZsaXBwZWQgaW4gdGhlIFktZGlyZWN0aW9uLiBPbmx5IGFmZmVjdHMgdGV4dHVyZXNcbiAgICAgKiB3aXRoIGEgc291cmNlIHRoYXQgaXMgYW4gaW1hZ2UsIGNhbnZhcyBvciB2aWRlbyBlbGVtZW50LiBEb2VzIG5vdCBhZmZlY3QgY3ViZW1hcHMsXG4gICAgICogY29tcHJlc3NlZCB0ZXh0dXJlcyBvciB0ZXh0dXJlcyBzZXQgZnJvbSByYXcgcGl4ZWwgZGF0YS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmbGlwWShmbGlwWSkge1xuICAgICAgICBpZiAodGhpcy5fZmxpcFkgIT09IGZsaXBZKSB7XG4gICAgICAgICAgICB0aGlzLl9mbGlwWSA9IGZsaXBZO1xuICAgICAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZsaXBZKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmxpcFk7XG4gICAgfVxuXG4gICAgc2V0IHByZW11bHRpcGx5QWxwaGEocHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICBpZiAodGhpcy5fcHJlbXVsdGlwbHlBbHBoYSAhPT0gcHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICAgICAgdGhpcy5fcHJlbXVsdGlwbHlBbHBoYSA9IHByZW11bHRpcGx5QWxwaGE7XG4gICAgICAgICAgICB0aGlzLl9uZWVkc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcHJlbXVsdGlwbHlBbHBoYSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZW11bHRpcGx5QWxwaGE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIGFsbCBkaW1lbnNpb25zIG9mIHRoZSB0ZXh0dXJlIGFyZSBwb3dlciBvZiB0d28sIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgcG90KCkge1xuICAgICAgICByZXR1cm4gbWF0aC5wb3dlck9mVHdvKHRoaXMuX3dpZHRoKSAmJiBtYXRoLnBvd2VyT2ZUd28odGhpcy5faGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvLyBnZXQgdGhlIHRleHR1cmUncyBlbmNvZGluZyB0eXBlXG4gICAgZ2V0IGVuY29kaW5nKCkge1xuICAgICAgICBzd2l0Y2ggKHRoaXMudHlwZSkge1xuICAgICAgICAgICAgY2FzZSBURVhUVVJFVFlQRV9SR0JNOlxuICAgICAgICAgICAgICAgIHJldHVybiAncmdibSc7XG4gICAgICAgICAgICBjYXNlIFRFWFRVUkVUWVBFX1JHQkU6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdyZ2JlJztcbiAgICAgICAgICAgIGNhc2UgVEVYVFVSRVRZUEVfUkdCUDpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JnYnAnO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gKHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0IxNkYgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0IzMkYgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMTZGIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTMyRikgPyAnbGluZWFyJyA6ICdzcmdiJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHN0YXRpYyBmdW5jdGlvbnNcbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGUgdGhlIEdQVSBtZW1vcnkgcmVxdWlyZWQgZm9yIGEgdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRleHR1cmUncyB3aWR0aC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGV4dHVyZSdzIGhlaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVwdGggLSBUZXh0dXJlJ3MgZGVwdGguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZvcm1hdCAtIFRleHR1cmUncyBwaXhlbCBmb3JtYXQgUElYRUxGT1JNQVRfKioqLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbWlwbWFwcyAtIFRydWUgaWYgdGhlIHRleHR1cmUgaW5jbHVkZXMgbWlwbWFwcywgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gY3ViZW1hcCAtIFRydWUgaXMgdGhlIHRleHR1cmUgaXMgYSBjdWJlbWFwLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG51bWJlciBvZiBieXRlcyBvZiBHUFUgbWVtb3J5IHJlcXVpcmVkIGZvciB0aGUgdGV4dHVyZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RhdGljIGNhbGNHcHVTaXplKHdpZHRoLCBoZWlnaHQsIGRlcHRoLCBmb3JtYXQsIG1pcG1hcHMsIGN1YmVtYXApIHtcbiAgICAgICAgaWYgKCFfcGl4ZWxTaXplVGFibGUpIHtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZSA9IFtdO1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0E4XSA9IDE7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfTDhdID0gMTtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9MOF9BOF0gPSAyO1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1I1X0c2X0I1XSA9IDI7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUjVfRzVfQjVfQTFdID0gMjtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNF0gPSAyO1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1I4X0c4X0I4XSA9IDQ7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUjhfRzhfQjhfQThdID0gNDtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SR0IxNkZdID0gODtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SR0JBMTZGXSA9IDg7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUkdCMzJGXSA9IDE2O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1JHQkEzMkZdID0gMTY7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUjMyRl0gPSA0O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0RFUFRIXSA9IDQ7IC8vIGNhbiBiZSBzbWFsbGVyIHVzaW5nIFdlYkdMMSBleHRlbnNpb24/XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMXSA9IDQ7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfMTExMTEwRl0gPSA0O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1NSR0JdID0gNDtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9TUkdCQV0gPSA0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFfYmxvY2tTaXplVGFibGUpIHtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZSA9IFtdO1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0VUQzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9FVEMyX1JHQl0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0RYVDFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9BVENfUkdCXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRVRDMl9SR0JBXSA9IDE2O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0RYVDNdID0gMTY7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRFhUNV0gPSAxNjtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9BU1RDXzR4NF0gPSAxNjtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9BVENfUkdCQV0gPSAxNjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBpeGVsU2l6ZSA9IF9waXhlbFNpemVUYWJsZS5oYXNPd25Qcm9wZXJ0eShmb3JtYXQpID8gX3BpeGVsU2l6ZVRhYmxlW2Zvcm1hdF0gOiAwO1xuICAgICAgICBjb25zdCBibG9ja1NpemUgPSBfYmxvY2tTaXplVGFibGUuaGFzT3duUHJvcGVydHkoZm9ybWF0KSA/IF9ibG9ja1NpemVUYWJsZVtmb3JtYXRdIDogMDtcbiAgICAgICAgbGV0IHJlc3VsdCA9IDA7XG5cbiAgICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgICAgIGlmIChwaXhlbFNpemUgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gaGFuZGxlIHVuY29tcHJlc3NlZCBmb3JtYXRzXG4gICAgICAgICAgICAgICAgcmVzdWx0ICs9IHdpZHRoICogaGVpZ2h0ICogZGVwdGggKiBwaXhlbFNpemU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBibG9jayBmb3JtYXRzXG4gICAgICAgICAgICAgICAgbGV0IGJsb2NrV2lkdGggPSBNYXRoLmZsb29yKCh3aWR0aCArIDMpIC8gNCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmxvY2tIZWlnaHQgPSBNYXRoLmZsb29yKChoZWlnaHQgKyAzKSAvIDQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJsb2NrRGVwdGggPSBNYXRoLmZsb29yKChkZXB0aCArIDMpIC8gNCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIHx8XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEpIHtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tXaWR0aCA9IE1hdGgubWF4KE1hdGguZmxvb3IoYmxvY2tXaWR0aCAvIDIpLCAxKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gYmxvY2tXaWR0aCAqIGJsb2NrSGVpZ2h0ICogYmxvY2tEZXB0aCAqIGJsb2NrU2l6ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHdlJ3JlIGRvbmUgaWYgbWlwbWFwcyBhcmVuJ3QgcmVxdWlyZWQgb3Igd2UndmUgY2FsY3VsYXRlZCB0aGUgc21hbGxlc3QgbWlwbWFwIGxldmVsXG4gICAgICAgICAgICBpZiAoIW1pcG1hcHMgfHwgKCh3aWR0aCA9PT0gMSkgJiYgKGhlaWdodCA9PT0gMSkgJiYgKGRlcHRoID09PSAxKSkpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdpZHRoID0gTWF0aC5tYXgoTWF0aC5mbG9vcih3aWR0aCAvIDIpLCAxKTtcbiAgICAgICAgICAgIGhlaWdodCA9IE1hdGgubWF4KE1hdGguZmxvb3IoaGVpZ2h0IC8gMiksIDEpO1xuICAgICAgICAgICAgZGVwdGggPSBNYXRoLm1heChNYXRoLmZsb29yKGRlcHRoIC8gMiksIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdCAqIChjdWJlbWFwID8gNiA6IDEpO1xuICAgIH1cblxuICAgIC8vIEZvcmNlIGEgZnVsbCByZXN1Ym1pc3Npb24gb2YgdGhlIHRleHR1cmUgdG8gV2ViR0wgKHVzZWQgb24gYSBjb250ZXh0IHJlc3RvcmUgZXZlbnQpXG4gICAgZGlydHlBbGwoKSB7XG4gICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWQgPSB0aGlzLl9jdWJlbWFwID8gW1t0cnVlLCB0cnVlLCB0cnVlLCB0cnVlLCB0cnVlLCB0cnVlXV0gOiBbdHJ1ZV07XG5cbiAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9uZWVkc01pcG1hcHNVcGxvYWQgPSB0aGlzLl9taXBtYXBzO1xuICAgICAgICB0aGlzLl9taXBtYXBzVXBsb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyA9IDI1NTsgLy8gMSB8IDIgfCA0IHwgOCB8IDE2IHwgMzIgfCA2NCB8IDEyOFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvY2tzIGEgbWlwbGV2ZWwgb2YgdGhlIHRleHR1cmUsIHJldHVybmluZyBhIHR5cGVkIGFycmF5IHRvIGJlIGZpbGxlZCB3aXRoIHBpeGVsIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QuIFZhbGlkIHByb3BlcnRpZXMgYXJlIGFzIGZvbGxvd3M6XG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmxldmVsXSAtIFRoZSBtaXAgbGV2ZWwgdG8gbG9jayB3aXRoIDAgYmVpbmcgdGhlIHRvcCBsZXZlbC4gRGVmYXVsdHNcbiAgICAgKiB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mYWNlXSAtIElmIHRoZSB0ZXh0dXJlIGlzIGEgY3ViZW1hcCwgdGhpcyBpcyB0aGUgaW5kZXggb2YgdGhlIGZhY2VcbiAgICAgKiB0byBsb2NrLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tb2RlXSAtIFRoZSBsb2NrIG1vZGUuIENhbiBiZTpcbiAgICAgKiAtIHtAbGluayBURVhUVVJFTE9DS19SRUFEfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVMT0NLX1dSSVRFfVxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBURVhUVVJFTE9DS19XUklURX0uXG4gICAgICogQHJldHVybnMge1VpbnQ4QXJyYXl8VWludDE2QXJyYXl8RmxvYXQzMkFycmF5fSBBIHR5cGVkIGFycmF5IGNvbnRhaW5pbmcgdGhlIHBpeGVsIGRhdGEgb2ZcbiAgICAgKiB0aGUgbG9ja2VkIG1pcCBsZXZlbC5cbiAgICAgKi9cbiAgICBsb2NrKG9wdGlvbnMgPSB7fSkge1xuICAgICAgICAvLyBJbml0aWFsaXplIG9wdGlvbnMgdG8gc29tZSBzZW5zaWJsZSBkZWZhdWx0c1xuICAgICAgICBpZiAob3B0aW9ucy5sZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLmxldmVsID0gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuZmFjZSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMubW9kZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLm1vZGUgPSBURVhUVVJFTE9DS19XUklURTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xvY2tlZExldmVsID0gb3B0aW9ucy5sZXZlbDtcblxuICAgICAgICBpZiAodGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID09PSBudWxsKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKHRoaXMuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfQTg6XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9MODpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfTDhfQTg6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogIHRoaXMuX2RlcHRoICogMik7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjVfRzZfQjU6XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMTpcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1I0X0c0X0I0X0E0OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDE2QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjhfRzhfQjg6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiAzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SOF9HOF9COF9BODpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RYVDE6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KE1hdGguZmxvb3IoKHRoaXMuX3dpZHRoICsgMykgLyA0KSAqIE1hdGguZmxvb3IoKHRoaXMuX2hlaWdodCArIDMpIC8gNCkgKiA4ICogdGhpcy5fZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RYVDM6XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQ1OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheShNYXRoLmZsb29yKCh0aGlzLl93aWR0aCArIDMpIC8gNCkgKiBNYXRoLmZsb29yKCh0aGlzLl9oZWlnaHQgKyAzKSAvIDQpICogMTYgKiB0aGlzLl9kZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMTZGOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDE2QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjMyRjpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogMyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTE2RjpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQxNkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiA0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMzJGOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiA0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgcGl4ZWwgZGF0YSBvZiB0aGUgdGV4dHVyZSBmcm9tIGEgY2FudmFzLCBpbWFnZSwgdmlkZW8gRE9NIGVsZW1lbnQuIElmIHRoZSB0ZXh0dXJlIGlzXG4gICAgICogYSBjdWJlbWFwLCB0aGUgc3VwcGxpZWQgc291cmNlIG11c3QgYmUgYW4gYXJyYXkgb2YgNiBjYW52YXNlcywgaW1hZ2VzIG9yIHZpZGVvcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR8SFRNTEltYWdlRWxlbWVudHxIVE1MVmlkZW9FbGVtZW50fEhUTUxDYW52YXNFbGVtZW50W118SFRNTEltYWdlRWxlbWVudFtdfEhUTUxWaWRlb0VsZW1lbnRbXX0gc291cmNlIC0gQVxuICAgICAqIGNhbnZhcywgaW1hZ2Ugb3IgdmlkZW8gZWxlbWVudCwgb3IgYW4gYXJyYXkgb2YgNiBjYW52YXMsIGltYWdlIG9yIHZpZGVvIGVsZW1lbnRzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWlwTGV2ZWxdIC0gQSBub24tbmVnYXRpdmUgaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBpbWFnZSBsZXZlbCBvZiBkZXRhaWwuXG4gICAgICogRGVmYXVsdHMgdG8gMCwgd2hpY2ggcmVwcmVzZW50cyB0aGUgYmFzZSBpbWFnZSBzb3VyY2UuIEEgbGV2ZWwgdmFsdWUgb2YgTiwgdGhhdCBpcyBncmVhdGVyXG4gICAgICogdGhhbiAwLCByZXByZXNlbnRzIHRoZSBpbWFnZSBzb3VyY2UgZm9yIHRoZSBOdGggbWlwbWFwIHJlZHVjdGlvbiBsZXZlbC5cbiAgICAgKi9cbiAgICBzZXRTb3VyY2Uoc291cmNlLCBtaXBMZXZlbCA9IDApIHtcbiAgICAgICAgbGV0IGludmFsaWQgPSBmYWxzZTtcbiAgICAgICAgbGV0IHdpZHRoLCBoZWlnaHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1YmVtYXApIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2VbMF0pIHtcbiAgICAgICAgICAgICAgICAvLyByZWx5IG9uIGZpcnN0IGZhY2Ugc2l6ZXNcbiAgICAgICAgICAgICAgICB3aWR0aCA9IHNvdXJjZVswXS53aWR0aCB8fCAwO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHNvdXJjZVswXS5oZWlnaHQgfHwgMDtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZhY2UgPSBzb3VyY2VbaV07XG4gICAgICAgICAgICAgICAgICAgIC8vIGN1YmVtYXAgYmVjb21lcyBpbnZhbGlkIGlmIGFueSBjb25kaXRpb24gaXMgbm90IHNhdGlzZmllZFxuICAgICAgICAgICAgICAgICAgICBpZiAoIWZhY2UgfHwgICAgICAgICAgICAgICAgICAvLyBmYWNlIGlzIG1pc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhY2Uud2lkdGggIT09IHdpZHRoIHx8ICAgLy8gZmFjZSBpcyBkaWZmZXJlbnQgd2lkdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhY2UuaGVpZ2h0ICE9PSBoZWlnaHQgfHwgLy8gZmFjZSBpcyBkaWZmZXJlbnQgaGVpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICAhdGhpcy5kZXZpY2UuX2lzQnJvd3NlckludGVyZmFjZShmYWNlKSkgeyAgICAgICAgICAgIC8vIG5ldyBpbWFnZSBiaXRtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGZpcnN0IGZhY2UgaXMgbWlzc2luZ1xuICAgICAgICAgICAgICAgIGludmFsaWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWludmFsaWQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXJrIGxldmVscyBhcyB1cGRhdGVkXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2xldmVsc1ttaXBMZXZlbF1baV0gIT09IHNvdXJjZVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWRbbWlwTGV2ZWxdW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBzb3VyY2UgaXMgdmFsaWQgdHlwZSBvZiBlbGVtZW50XG4gICAgICAgICAgICBpZiAoIXRoaXMuZGV2aWNlLl9pc0Jyb3dzZXJJbnRlcmZhY2Uoc291cmNlKSlcbiAgICAgICAgICAgICAgICBpbnZhbGlkID0gdHJ1ZTtcblxuICAgICAgICAgICAgaWYgKCFpbnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgLy8gbWFyayBsZXZlbCBhcyB1cGRhdGVkXG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZSAhPT0gdGhpcy5fbGV2ZWxzW21pcExldmVsXSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF0gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgd2lkdGggPSBzb3VyY2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gc291cmNlLmhlaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbnZhbGlkKSB7XG4gICAgICAgICAgICAvLyBpbnZhbGlkIHRleHR1cmVcblxuICAgICAgICAgICAgLy8gZGVmYXVsdCBzaXplc1xuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSA0O1xuICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gNDtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGxldmVsc1xuICAgICAgICAgICAgaWYgKHRoaXMuX2N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdW2ldID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF1baV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW21pcExldmVsXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdmFsaWQgdGV4dHVyZVxuICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2xldmVsc1ttaXBMZXZlbF0gPSBzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBvciBjaGFuZ2VkIHN0YXRlIG9mIHZhbGlkaXR5XG4gICAgICAgIGlmICh0aGlzLl9pbnZhbGlkICE9PSBpbnZhbGlkIHx8ICFpbnZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLl9pbnZhbGlkID0gaW52YWxpZDtcblxuICAgICAgICAgICAgLy8gcmV1cGxvYWRcbiAgICAgICAgICAgIHRoaXMudXBsb2FkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBpeGVsIGRhdGEgb2YgdGhlIHRleHR1cmUuIElmIHRoaXMgaXMgYSBjdWJlbWFwIHRoZW4gYW4gYXJyYXkgb2YgNiBpbWFnZXMgd2lsbCBiZVxuICAgICAqIHJldHVybmVkIG90aGVyd2lzZSBhIHNpbmdsZSBpbWFnZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWlwTGV2ZWxdIC0gQSBub24tbmVnYXRpdmUgaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBpbWFnZSBsZXZlbCBvZiBkZXRhaWwuXG4gICAgICogRGVmYXVsdHMgdG8gMCwgd2hpY2ggcmVwcmVzZW50cyB0aGUgYmFzZSBpbWFnZSBzb3VyY2UuIEEgbGV2ZWwgdmFsdWUgb2YgTiwgdGhhdCBpcyBncmVhdGVyXG4gICAgICogdGhhbiAwLCByZXByZXNlbnRzIHRoZSBpbWFnZSBzb3VyY2UgZm9yIHRoZSBOdGggbWlwbWFwIHJlZHVjdGlvbiBsZXZlbC5cbiAgICAgKiBAcmV0dXJucyB7SFRNTEltYWdlRWxlbWVudH0gVGhlIHNvdXJjZSBpbWFnZSBvZiB0aGlzIHRleHR1cmUuIENhbiBiZSBudWxsIGlmIHNvdXJjZSBub3RcbiAgICAgKiBhc3NpZ25lZCBmb3Igc3BlY2lmaWMgaW1hZ2UgbGV2ZWwuXG4gICAgICovXG4gICAgZ2V0U291cmNlKG1pcExldmVsID0gMCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGV2ZWxzW21pcExldmVsXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmxvY2tzIHRoZSBjdXJyZW50bHkgbG9ja2VkIG1pcCBsZXZlbCBhbmQgdXBsb2FkcyBpdCB0byBWUkFNLlxuICAgICAqL1xuICAgIHVubG9jaygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xvY2tlZExldmVsID09PSAtMSkge1xuICAgICAgICAgICAgRGVidWcubG9nKFwicGMuVGV4dHVyZSN1bmxvY2s6IEF0dGVtcHRpbmcgdG8gdW5sb2NrIGEgdGV4dHVyZSB0aGF0IGlzIG5vdCBsb2NrZWQuXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBsb2FkIHRoZSBuZXcgcGl4ZWwgZGF0YVxuICAgICAgICB0aGlzLnVwbG9hZCgpO1xuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IC0xO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZvcmNlcyBhIHJldXBsb2FkIG9mIHRoZSB0ZXh0dXJlcyBwaXhlbCBkYXRhIHRvIGdyYXBoaWNzIG1lbW9yeS4gT3JkaW5hcmlseSwgdGhpcyBmdW5jdGlvblxuICAgICAqIGlzIGNhbGxlZCBieSBpbnRlcm5hbGx5IGJ5IHtAbGluayBUZXh0dXJlI3NldFNvdXJjZX0gYW5kIHtAbGluayBUZXh0dXJlI3VubG9ja30uIEhvd2V2ZXIsIGl0XG4gICAgICogc3RpbGwgbmVlZHMgdG8gYmUgY2FsbGVkIGV4cGxpY2l0bHkgaW4gdGhlIGNhc2Ugd2hlcmUgYW4gSFRNTFZpZGVvRWxlbWVudCBpcyBzZXQgYXMgdGhlXG4gICAgICogc291cmNlIG9mIHRoZSB0ZXh0dXJlLiAgTm9ybWFsbHksIHRoaXMgaXMgZG9uZSBvbmNlIGV2ZXJ5IGZyYW1lIGJlZm9yZSB2aWRlbyB0ZXh0dXJlZFxuICAgICAqIGdlb21ldHJ5IGlzIHJlbmRlcmVkLlxuICAgICAqL1xuICAgIHVwbG9hZCgpIHtcbiAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9uZWVkc01pcG1hcHNVcGxvYWQgPSB0aGlzLl9taXBtYXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlIGFuIGluLW1lbW9yeSBERFMgcmVwcmVzZW50YXRpb24gb2YgdGhpcyB0ZXh0dXJlLiBPbmx5IHdvcmtzIG9uIFJHQkE4IHRleHR1cmVzLlxuICAgICAqIEN1cnJlbnRseSwgb25seSB1c2VkIGJ5IHRoZSBFZGl0b3IgdG8gd3JpdGUgcHJlZmlsdGVyZWQgY3ViZW1hcHMgdG8gRERTIGZvcm1hdC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBcnJheUJ1ZmZlcn0gQnVmZmVyIGNvbnRhaW5pbmcgdGhlIEREUyBkYXRhLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXREZHMoKSB7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsIFwiVGhpcyBmb3JtYXQgaXMgbm90IGltcGxlbWVudGVkIHlldFwiKTtcblxuICAgICAgICBsZXQgZnNpemUgPSAxMjg7XG4gICAgICAgIGxldCBpZHggPSAwO1xuICAgICAgICB3aGlsZSAodGhpcy5fbGV2ZWxzW2lkeF0pIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWlwU2l6ZSA9IHRoaXMuX2xldmVsc1tpZHhdLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBpZiAoIW1pcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYE5vIGJ5dGUgYXJyYXkgZm9yIG1pcCAke2lkeH1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZnNpemUgKz0gbWlwU2l6ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9sZXZlbHNbaWR4XVtmYWNlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYE5vIGxldmVsIGRhdGEgZm9yIG1pcCAke2lkeH0sIGZhY2UgJHtmYWNlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBtaXBTaXplID0gdGhpcy5fbGV2ZWxzW2lkeF1bZmFjZV0ubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW1pcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBObyBieXRlIGFycmF5IGZvciBtaXAgJHtpZHh9LCBmYWNlICR7ZmFjZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZnNpemUgKz0gbWlwU2l6ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmc2l6ZSArPSB0aGlzLl9sZXZlbHNbaWR4XS5sZW5ndGg7XG4gICAgICAgICAgICBpZHgrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGJ1ZmYgPSBuZXcgQXJyYXlCdWZmZXIoZnNpemUpO1xuICAgICAgICBjb25zdCBoZWFkZXIgPSBuZXcgVWludDMyQXJyYXkoYnVmZiwgMCwgMTI4IC8gNCk7XG5cbiAgICAgICAgY29uc3QgRERTX01BR0lDID0gNTQyMzI3ODc2OyAvLyBcIkREU1wiXG4gICAgICAgIGNvbnN0IEREU19IRUFERVJfU0laRSA9IDEyNDtcbiAgICAgICAgY29uc3QgRERTX0ZMQUdTX1JFUVVJUkVEID0gMHgwMSB8IDB4MDIgfCAweDA0IHwgMHgxMDAwIHwgMHg4MDAwMDsgLy8gY2FwcyB8IGhlaWdodCB8IHdpZHRoIHwgcGl4ZWxmb3JtYXQgfCBsaW5lYXJzaXplXG4gICAgICAgIGNvbnN0IEREU19GTEFHU19NSVBNQVAgPSAweDIwMDAwO1xuICAgICAgICBjb25zdCBERFNfUElYRUxGT1JNQVRfU0laRSA9IDMyO1xuICAgICAgICBjb25zdCBERFNfUElYRUxGTEFHU19SR0JBOCA9IDB4MDEgfCAweDQwOyAvLyBhbHBoYSB8IHJnYlxuICAgICAgICBjb25zdCBERFNfQ0FQU19SRVFVSVJFRCA9IDB4MTAwMDtcbiAgICAgICAgY29uc3QgRERTX0NBUFNfTUlQTUFQID0gMHg0MDAwMDA7XG4gICAgICAgIGNvbnN0IEREU19DQVBTX0NPTVBMRVggPSAweDg7XG4gICAgICAgIGNvbnN0IEREU19DQVBTMl9DVUJFTUFQID0gMHgyMDAgfCAweDQwMCB8IDB4ODAwIHwgMHgxMDAwIHwgMHgyMDAwIHwgMHg0MDAwIHwgMHg4MDAwOyAvLyBjdWJlbWFwIHwgYWxsIGZhY2VzXG5cbiAgICAgICAgbGV0IGZsYWdzID0gRERTX0ZMQUdTX1JFUVVJUkVEO1xuICAgICAgICBpZiAodGhpcy5fbGV2ZWxzLmxlbmd0aCA+IDEpIGZsYWdzIHw9IEREU19GTEFHU19NSVBNQVA7XG5cbiAgICAgICAgbGV0IGNhcHMgPSBERFNfQ0FQU19SRVFVSVJFRDtcbiAgICAgICAgaWYgKHRoaXMuX2xldmVscy5sZW5ndGggPiAxKSBjYXBzIHw9IEREU19DQVBTX01JUE1BUDtcbiAgICAgICAgaWYgKHRoaXMuX2xldmVscy5sZW5ndGggPiAxIHx8IHRoaXMuY3ViZW1hcCkgY2FwcyB8PSBERFNfQ0FQU19DT01QTEVYO1xuXG4gICAgICAgIGNvbnN0IGNhcHMyID0gdGhpcy5jdWJlbWFwID8gRERTX0NBUFMyX0NVQkVNQVAgOiAwO1xuXG4gICAgICAgIGhlYWRlclswXSA9IEREU19NQUdJQztcbiAgICAgICAgaGVhZGVyWzFdID0gRERTX0hFQURFUl9TSVpFO1xuICAgICAgICBoZWFkZXJbMl0gPSBmbGFncztcbiAgICAgICAgaGVhZGVyWzNdID0gdGhpcy5oZWlnaHQ7XG4gICAgICAgIGhlYWRlcls0XSA9IHRoaXMud2lkdGg7XG4gICAgICAgIGhlYWRlcls1XSA9IHRoaXMud2lkdGggKiB0aGlzLmhlaWdodCAqIDQ7XG4gICAgICAgIGhlYWRlcls2XSA9IDA7IC8vIGRlcHRoXG4gICAgICAgIGhlYWRlcls3XSA9IHRoaXMuX2xldmVscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTE7IGkrKykge1xuICAgICAgICAgICAgaGVhZGVyWzggKyBpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaGVhZGVyWzE5XSA9IEREU19QSVhFTEZPUk1BVF9TSVpFO1xuICAgICAgICBoZWFkZXJbMjBdID0gRERTX1BJWEVMRkxBR1NfUkdCQTg7XG4gICAgICAgIGhlYWRlclsyMV0gPSAwOyAvLyBmb3VyY2NcbiAgICAgICAgaGVhZGVyWzIyXSA9IDMyOyAvLyBicHBcbiAgICAgICAgaGVhZGVyWzIzXSA9IDB4MDBGRjAwMDA7IC8vIFIgbWFza1xuICAgICAgICBoZWFkZXJbMjRdID0gMHgwMDAwRkYwMDsgLy8gRyBtYXNrXG4gICAgICAgIGhlYWRlclsyNV0gPSAweDAwMDAwMEZGOyAvLyBCIG1hc2tcbiAgICAgICAgaGVhZGVyWzI2XSA9IDB4RkYwMDAwMDA7IC8vIEEgbWFza1xuICAgICAgICBoZWFkZXJbMjddID0gY2FwcztcbiAgICAgICAgaGVhZGVyWzI4XSA9IGNhcHMyO1xuICAgICAgICBoZWFkZXJbMjldID0gMDtcbiAgICAgICAgaGVhZGVyWzMwXSA9IDA7XG4gICAgICAgIGhlYWRlclszMV0gPSAwO1xuXG4gICAgICAgIGxldCBvZmZzZXQgPSAxMjg7XG4gICAgICAgIGlmICghdGhpcy5jdWJlbWFwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xldmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxldmVsID0gdGhpcy5fbGV2ZWxzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pcCA9IG5ldyBVaW50OEFycmF5KGJ1ZmYsIG9mZnNldCwgbGV2ZWwubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxldmVsLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pcFtqXSA9IGxldmVsW2pdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvZmZzZXQgKz0gbGV2ZWwubGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xldmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZXZlbCA9IHRoaXMuX2xldmVsc1tpXVtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWlwID0gbmV3IFVpbnQ4QXJyYXkoYnVmZiwgb2Zmc2V0LCBsZXZlbC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxldmVsLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtaXBbal0gPSBsZXZlbFtqXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBvZmZzZXQgKz0gbGV2ZWwubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBidWZmO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgVGV4dHVyZSB9O1xuIl0sIm5hbWVzIjpbIl9waXhlbFNpemVUYWJsZSIsIl9ibG9ja1NpemVUYWJsZSIsImlkIiwiVGV4dHVyZSIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJvcHRpb25zIiwiZGV2aWNlIiwiRGVidWciLCJhc3NlcnQiLCJuYW1lIiwiX3dpZHRoIiwiX2hlaWdodCIsIl9kZXB0aCIsIl9mb3JtYXQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCIsInR5cGUiLCJURVhUVVJFVFlQRV9ERUZBVUxUIiwicHJvamVjdGlvbiIsIlRFWFRVUkVQUk9KRUNUSU9OX05PTkUiLCJfY3ViZW1hcCIsIl92b2x1bWUiLCJmaXhDdWJlbWFwU2VhbXMiLCJfZmxpcFkiLCJfcHJlbXVsdGlwbHlBbHBoYSIsIl9pc1JlbmRlclRhcmdldCIsIl9taXBtYXBzIiwiX21pbkZpbHRlciIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsIl9tYWdGaWx0ZXIiLCJGSUxURVJfTElORUFSIiwiX2FuaXNvdHJvcHkiLCJfYWRkcmVzc1UiLCJBRERSRVNTX1JFUEVBVCIsIl9hZGRyZXNzViIsIl9hZGRyZXNzVyIsIl9jb21wYXJlT25SZWFkIiwiX2NvbXBhcmVGdW5jIiwiRlVOQ19MRVNTIiwicHJvZmlsZXJIaW50IiwidW5kZWZpbmVkIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJoYXNPd25Qcm9wZXJ0eSIsImRlcHJlY2F0ZWQiLCJyZ2JtIiwiVEVYVFVSRVRZUEVfUkdCTSIsInN3aXp6bGVHR0dSIiwiVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IiLCJtaXBtYXBzIiwiYXV0b01pcG1hcCIsIl9sZXZlbHMiLCJsZXZlbHMiLCJjdWJlbWFwIiwiVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSIsIm1pbkZpbHRlciIsIm1hZ0ZpbHRlciIsImFuaXNvdHJvcHkiLCJhZGRyZXNzVSIsImFkZHJlc3NWIiwiY29tcGFyZU9uUmVhZCIsImZsaXBZIiwicHJlbXVsdGlwbHlBbHBoYSIsIndlYmdsMiIsImRlcHRoIiwidm9sdW1lIiwiYWRkcmVzc1ciLCJfY29tcHJlc3NlZCIsIlBJWEVMRk9STUFUX0RYVDEiLCJQSVhFTEZPUk1BVF9EWFQzIiwiUElYRUxGT1JNQVRfRFhUNSIsIlBJWEVMRk9STUFUX0VUQzEiLCJfaW52YWxpZCIsIl9sb2NrZWRMZXZlbCIsImRpcnR5QWxsIiwiX2dwdVNpemUiLCJpbXBsIiwiY3JlYXRlVGV4dHVyZUltcGwiLCJ0ZXh0dXJlcyIsInB1c2giLCJ0cmFjZSIsIlRSQUNFSURfVEVYVFVSRV9BTExPQyIsImRlc3Ryb3kiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwic2NvcGUiLCJyZW1vdmVWYWx1ZSIsImFkanVzdFZyYW1TaXplVHJhY2tpbmciLCJfdnJhbSIsImxvc2VDb250ZXh0IiwidnJhbSIsInNpemUiLCJUUkFDRUlEX1ZSQU1fVEVYVFVSRSIsInRleCIsIlRFWEhJTlRfU0hBRE9XTUFQIiwidGV4U2hhZG93IiwiVEVYSElOVF9BU1NFVCIsInRleEFzc2V0IiwiVEVYSElOVF9MSUdIVE1BUCIsInRleExpZ2h0bWFwIiwidiIsIl9wYXJhbWV0ZXJGbGFncyIsIndhcm4iLCJjb21wYXJlRnVuYyIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJncHVTaXplIiwibWlwcyIsInBvdCIsImxlbmd0aCIsImNhbGNHcHVTaXplIiwiX25lZWRzVXBsb2FkIiwibWF0aCIsInBvd2VyT2ZUd28iLCJlbmNvZGluZyIsIlRFWFRVUkVUWVBFX1JHQkUiLCJURVhUVVJFVFlQRV9SR0JQIiwiUElYRUxGT1JNQVRfUkdCMTZGIiwiUElYRUxGT1JNQVRfUkdCMzJGIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJQSVhFTEZPUk1BVF9BOCIsIlBJWEVMRk9STUFUX0w4IiwiUElYRUxGT1JNQVRfTDhfQTgiLCJQSVhFTEZPUk1BVF9SNV9HNl9CNSIsIlBJWEVMRk9STUFUX1I1X0c1X0I1X0ExIiwiUElYRUxGT1JNQVRfUjRfRzRfQjRfQTQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COCIsIlBJWEVMRk9STUFUX1IzMkYiLCJQSVhFTEZPUk1BVF9ERVBUSCIsIlBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCIsIlBJWEVMRk9STUFUXzExMTExMEYiLCJQSVhFTEZPUk1BVF9TUkdCIiwiUElYRUxGT1JNQVRfU1JHQkEiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQiIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX0FUQ19SR0IiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQkEiLCJQSVhFTEZPUk1BVF9BU1RDXzR4NCIsIlBJWEVMRk9STUFUX0FUQ19SR0JBIiwicGl4ZWxTaXplIiwiYmxvY2tTaXplIiwicmVzdWx0IiwiYmxvY2tXaWR0aCIsIk1hdGgiLCJmbG9vciIsImJsb2NrSGVpZ2h0IiwiYmxvY2tEZXB0aCIsIm1heCIsIl9sZXZlbHNVcGRhdGVkIiwiX21pcG1hcHNVcGxvYWRlZCIsImxvY2siLCJsZXZlbCIsImZhY2UiLCJtb2RlIiwiVEVYVFVSRUxPQ0tfV1JJVEUiLCJVaW50OEFycmF5IiwiVWludDE2QXJyYXkiLCJGbG9hdDMyQXJyYXkiLCJzZXRTb3VyY2UiLCJzb3VyY2UiLCJtaXBMZXZlbCIsImludmFsaWQiLCJpIiwiX2lzQnJvd3NlckludGVyZmFjZSIsInVwbG9hZCIsImdldFNvdXJjZSIsInVubG9jayIsImxvZyIsImdldERkcyIsImZzaXplIiwibWlwU2l6ZSIsImVycm9yIiwiYnVmZiIsIkFycmF5QnVmZmVyIiwiaGVhZGVyIiwiVWludDMyQXJyYXkiLCJERFNfTUFHSUMiLCJERFNfSEVBREVSX1NJWkUiLCJERFNfRkxBR1NfUkVRVUlSRUQiLCJERFNfRkxBR1NfTUlQTUFQIiwiRERTX1BJWEVMRk9STUFUX1NJWkUiLCJERFNfUElYRUxGTEFHU19SR0JBOCIsIkREU19DQVBTX1JFUVVJUkVEIiwiRERTX0NBUFNfTUlQTUFQIiwiRERTX0NBUFNfQ09NUExFWCIsIkREU19DQVBTMl9DVUJFTUFQIiwiZmxhZ3MiLCJjYXBzIiwiY2FwczIiLCJvZmZzZXQiLCJtaXAiLCJqIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBdUJBLElBQUlBLGVBQWUsR0FBRyxJQUFJLENBQUE7QUFDMUIsSUFBSUMsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUUxQixJQUFJQyxFQUFFLEdBQUcsQ0FBQyxDQUFBOztBQU1WLE1BQU1DLE9BQU8sQ0FBQztBQWdIVkMsRUFBQUEsV0FBVyxDQUFDQyxjQUFjLEVBQUVDLE9BQU8sRUFBRTtBQUNqQyxJQUFBLElBQUksQ0FBQ0osRUFBRSxHQUFHQSxFQUFFLEVBQUUsQ0FBQTtJQUNkLElBQUksQ0FBQ0ssTUFBTSxHQUFHRixjQUFjLENBQUE7SUFDNUJHLEtBQUssQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQ0YsTUFBTSxFQUFFLDBEQUEwRCxDQUFDLENBQUE7O0lBT3JGLElBQUksQ0FBQ0csSUFBSSxHQUFHLElBQUksQ0FBQTtJQUVoQixJQUFJLENBQUNDLE1BQU0sR0FBRyxDQUFDLENBQUE7SUFDZixJQUFJLENBQUNDLE9BQU8sR0FBRyxDQUFDLENBQUE7SUFDaEIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBRWYsSUFBSSxDQUFDQyxPQUFPLEdBQUdDLHVCQUF1QixDQUFBO0lBQ3RDLElBQUksQ0FBQ0MsSUFBSSxHQUFHQyxtQkFBbUIsQ0FB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
