/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { TRACEID_TEXTURE_ALLOC, TRACEID_VRAM_TEXTURE } from '../core/constants.js';
import { math } from '../math/math.js';
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

          if (!face || face.width !== width || face.height !== height || !this.device._isBrowserInterface(face)) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2dyYXBoaWNzL3RleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVEVYVFVSRV9BTExPQywgVFJBQ0VJRF9WUkFNX1RFWFRVUkUgfSBmcm9tICcuLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vbWF0aC9tYXRoLmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX1JFUEVBVCxcbiAgICBGSUxURVJfTElORUFSLCBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgRlVOQ19MRVNTLFxuICAgIFBJWEVMRk9STUFUX0E4LCBQSVhFTEZPUk1BVF9MOCwgUElYRUxGT1JNQVRfTDhfQTgsIFBJWEVMRk9STUFUX1I1X0c2X0I1LCBQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMSwgUElYRUxGT1JNQVRfUjRfRzRfQjRfQTQsXG4gICAgUElYRUxGT1JNQVRfUjhfRzhfQjgsIFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCBQSVhFTEZPUk1BVF9EWFQxLCBQSVhFTEZPUk1BVF9EWFQzLCBQSVhFTEZPUk1BVF9EWFQ1LFxuICAgIFBJWEVMRk9STUFUX1JHQjE2RiwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCMzJGLCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9SMzJGLCBQSVhFTEZPUk1BVF9ERVBUSCxcbiAgICBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwsIFBJWEVMRk9STUFUXzExMTExMEYsIFBJWEVMRk9STUFUX1NSR0IsIFBJWEVMRk9STUFUX1NSR0JBLCBQSVhFTEZPUk1BVF9FVEMxLFxuICAgIFBJWEVMRk9STUFUX0VUQzJfUkdCLCBQSVhFTEZPUk1BVF9FVEMyX1JHQkEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xLFxuICAgIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xLCBQSVhFTEZPUk1BVF9BU1RDXzR4NCwgUElYRUxGT1JNQVRfQVRDX1JHQixcbiAgICBQSVhFTEZPUk1BVF9BVENfUkdCQSxcbiAgICBURVhISU5UX1NIQURPV01BUCwgVEVYSElOVF9BU1NFVCwgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9OT05FLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFLFxuICAgIFRFWFRVUkVUWVBFX0RFRkFVTFQsIFRFWFRVUkVUWVBFX1JHQk0sIFRFWFRVUkVUWVBFX1JHQkUsIFRFWFRVUkVUWVBFX1JHQlAsIFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG5cbmxldCBfcGl4ZWxTaXplVGFibGUgPSBudWxsO1xubGV0IF9ibG9ja1NpemVUYWJsZSA9IG51bGw7XG5cbmxldCBpZCA9IDA7XG5cbi8qKlxuICogQSB0ZXh0dXJlIGlzIGEgY29udGFpbmVyIGZvciB0ZXhlbCBkYXRhIHRoYXQgY2FuIGJlIHV0aWxpemVkIGluIGEgZnJhZ21lbnQgc2hhZGVyLiBUeXBpY2FsbHksXG4gKiB0aGUgdGV4ZWwgZGF0YSByZXByZXNlbnRzIGFuIGltYWdlIHRoYXQgaXMgbWFwcGVkIG92ZXIgZ2VvbWV0cnkuXG4gKi9cbmNsYXNzIFRleHR1cmUge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBUZXh0dXJlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoaXMgdGV4dHVyZS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IGZvciBwYXNzaW5nIG9wdGlvbmFsIGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgdGV4dHVyZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMud2lkdGhdIC0gVGhlIHdpZHRoIG9mIHRoZSB0ZXh0dXJlIGluIHBpeGVscy4gRGVmYXVsdHMgdG8gNC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLiBEZWZhdWx0cyB0byA0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5kZXB0aF0gLSBUaGUgbnVtYmVyIG9mIGRlcHRoIHNsaWNlcyBpbiBhIDNEIHRleHR1cmUgKFdlYkdMMiBvbmx5KS5cbiAgICAgKiBEZWZhdWx0cyB0byAxIChzaW5nbGUgMkQgaW1hZ2UpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mb3JtYXRdIC0gVGhlIHBpeGVsIGZvcm1hdCBvZiB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTDh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTDhfQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUjVfRzZfQjV9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUjVfRzVfQjVfQTF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUjRfRzRfQjRfQTR9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUjhfRzhfQjh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQzfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDV9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkExNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkEzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRVRDMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfMTExMTEwRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BU1RDXzR4NH0+L2xpPlxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0J9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVRDX1JHQkF9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTh9LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5wcm9qZWN0aW9uXSAtIFRoZSBwcm9qZWN0aW9uIHR5cGUgb2YgdGhlIHRleHR1cmUsIHVzZWQgd2hlbiB0aGVcbiAgICAgKiB0ZXh0dXJlIHJlcHJlc2VudHMgYW4gZW52aXJvbm1lbnQuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX05PTkV9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fQ1VCRX1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9FUVVJUkVDVH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkV9IGlmIG9wdGlvbnMuY3ViZW1hcCBpcyBzcGVjaWZpZWQsIG90aGVyd2lzZVxuICAgICAqIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9OT05FfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWluRmlsdGVyXSAtIFRoZSBtaW5pZmljYXRpb24gZmlsdGVyIHR5cGUgdG8gdXNlLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYWdGaWx0ZXJdIC0gVGhlIG1hZ25pZmljYXRpb24gZmlsdGVyIHR5cGUgdG8gdXNlLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBGSUxURVJfTElORUFSfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYW5pc290cm9weV0gLSBUaGUgbGV2ZWwgb2YgYW5pc290cm9waWMgZmlsdGVyaW5nIHRvIHVzZS4gRGVmYXVsdHNcbiAgICAgKiB0byAxLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hZGRyZXNzVV0gLSBUaGUgcmVwZWF0IG1vZGUgdG8gdXNlIGluIHRoZSBVIGRpcmVjdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgQUREUkVTU19SRVBFQVR9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hZGRyZXNzVl0gLSBUaGUgcmVwZWF0IG1vZGUgdG8gdXNlIGluIHRoZSBWIGRpcmVjdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgQUREUkVTU19SRVBFQVR9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hZGRyZXNzV10gLSBUaGUgcmVwZWF0IG1vZGUgdG8gdXNlIGluIHRoZSBXIGRpcmVjdGlvbi4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgQUREUkVTU19SRVBFQVR9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubWlwbWFwc10gLSBXaGVuIGVuYWJsZWQgdHJ5IHRvIGdlbmVyYXRlIG9yIHVzZSBtaXBtYXBzIGZvciB0aGlzXG4gICAgICogdGV4dHVyZS4gRGVmYXVsdCBpcyB0cnVlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY3ViZW1hcF0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBpcyB0byBiZSBhIGN1YmVtYXAuXG4gICAgICogRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy52b2x1bWVdIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgaXMgdG8gYmUgYSAzRCB2b2x1bWVcbiAgICAgKiAoV2ViR0wyIG9ubHkpLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMudHlwZV0gLSBTcGVjaWZpZXMgdGhlIGltYWdlIHR5cGUsIHNlZSB7QGxpbmsgVEVYVFVSRVRZUEVfREVGQVVMVH0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5maXhDdWJlbWFwU2VhbXNdIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhpcyBjdWJlbWFwIHRleHR1cmUgcmVxdWlyZXNcbiAgICAgKiBzcGVjaWFsIHNlYW0gZml4aW5nIHNoYWRlciBjb2RlIHRvIGxvb2sgcmlnaHQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZmxpcFldIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgc2hvdWxkIGJlIGZsaXBwZWQgaW4gdGhlXG4gICAgICogWS1kaXJlY3Rpb24uIE9ubHkgYWZmZWN0cyB0ZXh0dXJlcyB3aXRoIGEgc291cmNlIHRoYXQgaXMgYW4gaW1hZ2UsIGNhbnZhcyBvciB2aWRlbyBlbGVtZW50LlxuICAgICAqIERvZXMgbm90IGFmZmVjdCBjdWJlbWFwcywgY29tcHJlc3NlZCB0ZXh0dXJlcyBvciB0ZXh0dXJlcyBzZXQgZnJvbSByYXcgcGl4ZWwgZGF0YS4gRGVmYXVsdHNcbiAgICAgKiB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnByZW11bHRpcGx5QWxwaGFdIC0gSWYgdHJ1ZSwgdGhlIGFscGhhIGNoYW5uZWwgb2YgdGhlIHRleHR1cmUgKGlmXG4gICAgICogcHJlc2VudCkgaXMgbXVsdGlwbGllZCBpbnRvIHRoZSBjb2xvciBjaGFubmVscy4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jb21wYXJlT25SZWFkXSAtIFdoZW4gZW5hYmxlZCwgYW5kIGlmIHRleHR1cmUgZm9ybWF0IGlzXG4gICAgICoge0BsaW5rIFBJWEVMRk9STUFUX0RFUFRIfSBvciB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMfSwgaGFyZHdhcmUgUENGIGlzIGVuYWJsZWQgZm9yXG4gICAgICogdGhpcyB0ZXh0dXJlLCBhbmQgeW91IGNhbiBnZXQgZmlsdGVyZWQgcmVzdWx0cyBvZiBjb21wYXJpc29uIHVzaW5nIHRleHR1cmUoKSBpbiB5b3VyIHNoYWRlclxuICAgICAqIChXZWJHTDIgb25seSkuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5jb21wYXJlRnVuY10gLSBDb21wYXJpc29uIGZ1bmN0aW9uIHdoZW4gY29tcGFyZU9uUmVhZCBpcyBlbmFibGVkXG4gICAgICogKFdlYkdMMiBvbmx5KS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn1cbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgRlVOQ19MRVNTfS5cbiAgICAgKiBAcGFyYW0ge1VpbnQ4QXJyYXlbXX0gW29wdGlvbnMubGV2ZWxzXSAtIEFycmF5IG9mIFVpbnQ4QXJyYXkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSA4eDh4MjQtYml0IHRleHR1cmVcbiAgICAgKiB2YXIgdGV4dHVyZSA9IG5ldyBwYy5UZXh0dXJlKGdyYXBoaWNzRGV2aWNlLCB7XG4gICAgICogICAgIHdpZHRoOiA4LFxuICAgICAqICAgICBoZWlnaHQ6IDgsXG4gICAgICogICAgIGZvcm1hdDogcGMuUElYRUxGT1JNQVRfUjhfRzhfQjhcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIEZpbGwgdGhlIHRleHR1cmUgd2l0aCBhIGdyYWRpZW50XG4gICAgICogdmFyIHBpeGVscyA9IHRleHR1cmUubG9jaygpO1xuICAgICAqIHZhciBjb3VudCA9IDA7XG4gICAgICogZm9yICh2YXIgaSA9IDA7IGkgPCA4OyBpKyspIHtcbiAgICAgKiAgICAgZm9yICh2YXIgaiA9IDA7IGogPCA4OyBqKyspIHtcbiAgICAgKiAgICAgICAgIHBpeGVsc1tjb3VudCsrXSA9IGkgKiAzMjtcbiAgICAgKiAgICAgICAgIHBpeGVsc1tjb3VudCsrXSA9IGogKiAzMjtcbiAgICAgKiAgICAgICAgIHBpeGVsc1tjb3VudCsrXSA9IDI1NTtcbiAgICAgKiAgICAgfVxuICAgICAqIH1cbiAgICAgKiB0ZXh0dXJlLnVubG9jaygpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuaWQgPSBpZCsrO1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5kZXZpY2UsIFwiVGV4dHVyZSBjb250cnVjdG9yIHJlcXVpcmVzIGEgZ3JhcGhpY3NEZXZpY2UgdG8gYmUgdmFsaWRcIik7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBuYW1lIG9mIHRoZSB0ZXh0dXJlLiBEZWZhdWx0cyB0byBudWxsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uYW1lID0gbnVsbDtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IDQ7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IDQ7XG4gICAgICAgIHRoaXMuX2RlcHRoID0gMTtcblxuICAgICAgICB0aGlzLl9mb3JtYXQgPSBQSVhFTEZPUk1BVF9SOF9HOF9COF9BODtcbiAgICAgICAgdGhpcy50eXBlID0gVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gVEVYVFVSRVBST0pFQ1RJT05fTk9ORTtcblxuICAgICAgICB0aGlzLl9jdWJlbWFwID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmZpeEN1YmVtYXBTZWFtcyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9mbGlwWSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9wcmVtdWx0aXBseUFscGhhID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5faXNSZW5kZXJUYXJnZXQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9taXBtYXBzID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl9taW5GaWx0ZXIgPSBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVI7XG4gICAgICAgIHRoaXMuX21hZ0ZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgIHRoaXMuX2FuaXNvdHJvcHkgPSAxO1xuICAgICAgICB0aGlzLl9hZGRyZXNzVSA9IEFERFJFU1NfUkVQRUFUO1xuICAgICAgICB0aGlzLl9hZGRyZXNzViA9IEFERFJFU1NfUkVQRUFUO1xuICAgICAgICB0aGlzLl9hZGRyZXNzVyA9IEFERFJFU1NfUkVQRUFUO1xuXG4gICAgICAgIHRoaXMuX2NvbXBhcmVPblJlYWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fY29tcGFyZUZ1bmMgPSBGVU5DX0xFU1M7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnByb2ZpbGVySGludCA9IDA7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmIChvcHRpb25zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLm5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3dpZHRoID0gKG9wdGlvbnMud2lkdGggIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLndpZHRoIDogdGhpcy5fd2lkdGg7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSAob3B0aW9ucy5oZWlnaHQgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmhlaWdodCA6IHRoaXMuX2hlaWdodDtcblxuICAgICAgICAgICAgdGhpcy5fZm9ybWF0ID0gKG9wdGlvbnMuZm9ybWF0ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5mb3JtYXQgOiB0aGlzLl9mb3JtYXQ7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCd0eXBlJykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnR5cGU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3JnYm0nKSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoXCJvcHRpb25zLnJnYm0gaXMgZGVwcmVjYXRlZC4gVXNlIG9wdGlvbnMudHlwZSBpbnN0ZWFkLlwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnJnYm0gPyBURVhUVVJFVFlQRV9SR0JNIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnc3dpenpsZUdHR1InKSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoXCJvcHRpb25zLnN3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBvcHRpb25zLnR5cGUgaW5zdGVhZC5cIik7XG4gICAgICAgICAgICAgICAgdGhpcy50eXBlID0gb3B0aW9ucy5zd2l6emxlR0dHUiA/IFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubWlwbWFwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWlwbWFwcyA9IG9wdGlvbnMubWlwbWFwcztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWlwbWFwcyA9IChvcHRpb25zLmF1dG9NaXBtYXAgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmF1dG9NaXBtYXAgOiB0aGlzLl9taXBtYXBzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9sZXZlbHMgPSBvcHRpb25zLmxldmVscztcblxuICAgICAgICAgICAgdGhpcy5fY3ViZW1hcCA9IChvcHRpb25zLmN1YmVtYXAgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmN1YmVtYXAgOiB0aGlzLl9jdWJlbWFwO1xuICAgICAgICAgICAgdGhpcy5maXhDdWJlbWFwU2VhbXMgPSAob3B0aW9ucy5maXhDdWJlbWFwU2VhbXMgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmZpeEN1YmVtYXBTZWFtcyA6IHRoaXMuZml4Q3ViZW1hcFNlYW1zO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvamVjdGlvbiA9IFRFWFRVUkVQUk9KRUNUSU9OX0NVQkU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMucHJvamVjdGlvbiAmJiBvcHRpb25zLnByb2plY3Rpb24gIT09IFRFWFRVUkVQUk9KRUNUSU9OX0NVQkUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBvcHRpb25zLnByb2plY3Rpb247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX21pbkZpbHRlciA9IChvcHRpb25zLm1pbkZpbHRlciAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMubWluRmlsdGVyIDogdGhpcy5fbWluRmlsdGVyO1xuICAgICAgICAgICAgdGhpcy5fbWFnRmlsdGVyID0gKG9wdGlvbnMubWFnRmlsdGVyICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5tYWdGaWx0ZXIgOiB0aGlzLl9tYWdGaWx0ZXI7XG4gICAgICAgICAgICB0aGlzLl9hbmlzb3Ryb3B5ID0gKG9wdGlvbnMuYW5pc290cm9weSAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuYW5pc290cm9weSA6IHRoaXMuX2FuaXNvdHJvcHk7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzVSA9IChvcHRpb25zLmFkZHJlc3NVICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5hZGRyZXNzVSA6IHRoaXMuX2FkZHJlc3NVO1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1YgPSAob3B0aW9ucy5hZGRyZXNzViAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuYWRkcmVzc1YgOiB0aGlzLl9hZGRyZXNzVjtcblxuICAgICAgICAgICAgdGhpcy5fY29tcGFyZU9uUmVhZCA9IChvcHRpb25zLmNvbXBhcmVPblJlYWQgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmNvbXBhcmVPblJlYWQgOiB0aGlzLl9jb21wYXJlT25SZWFkO1xuICAgICAgICAgICAgdGhpcy5fY29tcGFyZUZ1bmMgPSAob3B0aW9ucy5fY29tcGFyZUZ1bmMgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLl9jb21wYXJlRnVuYyA6IHRoaXMuX2NvbXBhcmVGdW5jO1xuXG4gICAgICAgICAgICB0aGlzLl9mbGlwWSA9IChvcHRpb25zLmZsaXBZICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5mbGlwWSA6IHRoaXMuX2ZsaXBZO1xuICAgICAgICAgICAgdGhpcy5fcHJlbXVsdGlwbHlBbHBoYSA9IChvcHRpb25zLnByZW11bHRpcGx5QWxwaGEgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLnByZW11bHRpcGx5QWxwaGEgOiB0aGlzLl9wcmVtdWx0aXBseUFscGhhO1xuXG4gICAgICAgICAgICBpZiAoZ3JhcGhpY3NEZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGVwdGggPSAob3B0aW9ucy5kZXB0aCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuZGVwdGggOiB0aGlzLl9kZXB0aDtcbiAgICAgICAgICAgICAgICB0aGlzLl92b2x1bWUgPSAob3B0aW9ucy52b2x1bWUgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLnZvbHVtZSA6IHRoaXMuX3ZvbHVtZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRyZXNzVyA9IChvcHRpb25zLmFkZHJlc3NXICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5hZGRyZXNzVyA6IHRoaXMuX2FkZHJlc3NXO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0aGlzLnByb2ZpbGVySGludCA9IChvcHRpb25zLnByb2ZpbGVySGludCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMucHJvZmlsZXJIaW50IDogdGhpcy5wcm9maWxlckhpbnQ7XG4gICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NvbXByZXNzZWQgPSAodGhpcy5fZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9EWFQxIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9EWFQzIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9EWFQ1IHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9ybWF0ID49IFBJWEVMRk9STUFUX0VUQzEpO1xuXG4gICAgICAgIC8vIE1pcCBsZXZlbHNcbiAgICAgICAgdGhpcy5faW52YWxpZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IC0xO1xuICAgICAgICBpZiAoIXRoaXMuX2xldmVscykge1xuICAgICAgICAgICAgdGhpcy5fbGV2ZWxzID0gdGhpcy5fY3ViZW1hcCA/IFtbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF1dIDogW251bGxdO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kaXJ0eUFsbCgpO1xuXG4gICAgICAgIHRoaXMuX2dwdVNpemUgPSAwO1xuXG4gICAgICAgIHRoaXMuaW1wbCA9IGdyYXBoaWNzRGV2aWNlLmNyZWF0ZVRleHR1cmVJbXBsKHRoaXMpO1xuXG4gICAgICAgIC8vIHRyYWNrIHRoZSB0ZXh0dXJlXG4gICAgICAgIGdyYXBoaWNzRGV2aWNlLnRleHR1cmVzLnB1c2godGhpcyk7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9URVhUVVJFX0FMTE9DLCBgQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9OiAke3RoaXMud2lkdGh9eCR7dGhpcy5oZWlnaHR9IGAgK1xuICAgICAgICAgICAgYCR7dGhpcy5jdWJlbWFwID8gJ1tDdWJlbWFwXScgOiAnJ31gICtcbiAgICAgICAgICAgIGAke3RoaXMudm9sdW1lID8gJ1tWb2x1bWVdJyA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy5taXBtYXBzID8gJ1tNaXBtYXBzXScgOiAnJ31gKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgdGV4dHVyZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfVEVYVFVSRV9BTExPQywgYERlQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9YCk7XG5cbiAgICAgICAgaWYgKHRoaXMuZGV2aWNlKSB7XG4gICAgICAgICAgICAvLyBzdG9wIHRyYWNraW5nIHRoZSB0ZXh0dXJlXG4gICAgICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IGRldmljZS50ZXh0dXJlcy5pbmRleE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2UudGV4dHVyZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlbW92ZSB0ZXh0dXJlIGZyb20gYW55IHVuaWZvcm1zXG4gICAgICAgICAgICBkZXZpY2Uuc2NvcGUucmVtb3ZlVmFsdWUodGhpcyk7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgaW1wbGVtZW50YXRpb25cbiAgICAgICAgICAgIHRoaXMuaW1wbC5kZXN0cm95KGRldmljZSk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0ZXh0dXJlIHN0YXRzXG4gICAgICAgICAgICB0aGlzLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGhpcy5fZ3B1U2l6ZSk7XG5cbiAgICAgICAgICAgIHRoaXMuX2xldmVscyA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmRldmljZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgcmVuZGVyaW5nIGNvbnRleHQgd2FzIGxvc3QuIEl0IHJlbGVhc2VzIGFsbCBjb250ZXh0IHJlbGF0ZWQgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmltcGwubG9zZUNvbnRleHQoKTtcbiAgICAgICAgdGhpcy5kaXJ0eUFsbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdnJhbSBzaXplIHRyYWNraW5nIGZvciB0aGUgdGV4dHVyZSwgc2l6ZSBjYW4gYmUgcG9zaXRpdmUgdG8gYWRkIG9yIG5lZ2F0aXZlIHRvIHN1YnRyYWN0XG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYWRqdXN0VnJhbVNpemVUcmFja2luZyh2cmFtLCBzaXplKSB7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9WUkFNX1RFWFRVUkUsIGAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfSBzaXplOiAke3NpemV9IHZyYW0udGV4dHVyZTogJHt2cmFtLnRleH0gPT4gJHt2cmFtLnRleCArIHNpemV9YCk7XG5cbiAgICAgICAgdnJhbS50ZXggKz0gc2l6ZTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGlmICh0aGlzLnByb2ZpbGVySGludCA9PT0gVEVYSElOVF9TSEFET1dNQVApIHtcbiAgICAgICAgICAgIHZyYW0udGV4U2hhZG93ICs9IHNpemU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wcm9maWxlckhpbnQgPT09IFRFWEhJTlRfQVNTRVQpIHtcbiAgICAgICAgICAgIHZyYW0udGV4QXNzZXQgKz0gc2l6ZTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnByb2ZpbGVySGludCA9PT0gVEVYSElOVF9MSUdIVE1BUCkge1xuICAgICAgICAgICAgdnJhbS50ZXhMaWdodG1hcCArPSBzaXplO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtaW5pZmljYXRpb24gZmlsdGVyIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1R9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUn1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1pbkZpbHRlcih2KSB7XG4gICAgICAgIGlmICh0aGlzLl9taW5GaWx0ZXIgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX21pbkZpbHRlciA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1pbkZpbHRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pbkZpbHRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXIgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1R9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX0xJTkVBUn1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1hZ0ZpbHRlcih2KSB7XG4gICAgICAgIGlmICh0aGlzLl9tYWdGaWx0ZXIgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX21hZ0ZpbHRlciA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hZ0ZpbHRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hZ0ZpbHRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWRkcmVzc2luZyBtb2RlIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUgaG9yaXpvbnRhbGx5LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBBRERSRVNTX1JFUEVBVH1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX0NMQU1QX1RPX0VER0V9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19NSVJST1JFRF9SRVBFQVR9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhZGRyZXNzVSh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9hZGRyZXNzVSAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1UgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gNDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhZGRyZXNzVSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZHJlc3NVO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhZGRyZXNzaW5nIG1vZGUgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZSB2ZXJ0aWNhbGx5LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBBRERSRVNTX1JFUEVBVH1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX0NMQU1QX1RPX0VER0V9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19NSVJST1JFRF9SRVBFQVR9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhZGRyZXNzVih2KSB7XG4gICAgICAgIGlmICh0aGlzLl9hZGRyZXNzViAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1YgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gODtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhZGRyZXNzVigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZHJlc3NWO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhZGRyZXNzaW5nIG1vZGUgdG8gYmUgYXBwbGllZCB0byB0aGUgM0QgdGV4dHVyZSBkZXB0aCAoV2ViR0wyIG9ubHkpLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBBRERSRVNTX1JFUEVBVH1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX0NMQU1QX1RPX0VER0V9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19NSVJST1JFRF9SRVBFQVR9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhZGRyZXNzVyhhZGRyZXNzVykge1xuICAgICAgICBpZiAoIXRoaXMuZGV2aWNlLndlYmdsMikgcmV0dXJuO1xuICAgICAgICBpZiAoIXRoaXMuX3ZvbHVtZSkge1xuICAgICAgICAgICAgRGVidWcud2FybihcInBjLlRleHR1cmUjYWRkcmVzc1c6IENhbid0IHNldCBXIGFkZHJlc3NpbmcgbW9kZSBmb3IgYSBub24tM0QgdGV4dHVyZS5cIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFkZHJlc3NXICE9PSB0aGlzLl9hZGRyZXNzVykge1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1cgPSBhZGRyZXNzVztcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDE2O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFkZHJlc3NXKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkcmVzc1c7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2hlbiBlbmFibGVkLCBhbmQgaWYgdGV4dHVyZSBmb3JtYXQgaXMge0BsaW5rIFBJWEVMRk9STUFUX0RFUFRIfSBvclxuICAgICAqIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUx9LCBoYXJkd2FyZSBQQ0YgaXMgZW5hYmxlZCBmb3IgdGhpcyB0ZXh0dXJlLCBhbmQgeW91IGNhbiBnZXRcbiAgICAgKiBmaWx0ZXJlZCByZXN1bHRzIG9mIGNvbXBhcmlzb24gdXNpbmcgdGV4dHVyZSgpIGluIHlvdXIgc2hhZGVyIChXZWJHTDIgb25seSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY29tcGFyZU9uUmVhZCh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9jb21wYXJlT25SZWFkICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlT25SZWFkID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDMyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbXBhcmVPblJlYWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb21wYXJlT25SZWFkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbXBhcmlzb24gZnVuY3Rpb24gd2hlbiBjb21wYXJlT25SZWFkIGlzIGVuYWJsZWQgKFdlYkdMMiBvbmx5KS4gUG9zc2libGUgdmFsdWVzOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn1cbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjb21wYXJlRnVuYyh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9jb21wYXJlRnVuYyAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fY29tcGFyZUZ1bmMgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gNjQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29tcGFyZUZ1bmMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb21wYXJlRnVuYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnRlZ2VyIHZhbHVlIHNwZWNpZnlpbmcgdGhlIGxldmVsIG9mIGFuaXNvdHJvcGljIHRvIGFwcGx5IHRvIHRoZSB0ZXh0dXJlIHJhbmdpbmcgZnJvbSAxIChub1xuICAgICAqIGFuaXNvdHJvcGljIGZpbHRlcmluZykgdG8gdGhlIHtAbGluayBHcmFwaGljc0RldmljZX0gcHJvcGVydHkgbWF4QW5pc290cm9weS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFuaXNvdHJvcHkodikge1xuICAgICAgICBpZiAodGhpcy5fYW5pc290cm9weSAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fYW5pc290cm9weSA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAxMjg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5pc290cm9weSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaXNvdHJvcHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVG9nZ2xlcyBhdXRvbWF0aWMgbWlwbWFwIGdlbmVyYXRpb24uIENhbid0IGJlIHVzZWQgb24gbm9uIHBvd2VyIG9mIHR3byB0ZXh0dXJlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqL1xuICAgIHNldCBhdXRvTWlwbWFwKHYpIHtcbiAgICAgICAgdGhpcy5fbWlwbWFwcyA9IHY7XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9NaXBtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9taXBtYXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgaWYgdGV4dHVyZSBzaG91bGQgZ2VuZXJhdGUvdXBsb2FkIG1pcG1hcHMgaWYgcG9zc2libGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbWlwbWFwcyh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9taXBtYXBzICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9taXBtYXBzID0gdjtcbiAgICAgICAgICAgIGlmICh2KSB0aGlzLl9uZWVkc01pcG1hcHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1pcG1hcHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9taXBtYXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBudW1iZXIgb2YgZGVwdGggc2xpY2VzIGluIGEgM0QgdGV4dHVyZSAoV2ViR0wyIG9ubHkpLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGl4ZWwgZm9ybWF0IG9mIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SNV9HNl9CNX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SOF9HOF9COH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDN9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUNX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0IxNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTE2Rn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0IzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTMyRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9FVEMxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF8xMTExMTBGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FTVENfNHg0fT4vbGk+XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVRDX1JHQn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCQX1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGZvcm1hdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Zvcm1hdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhpcyB0ZXh0dXJlIGlzIGEgY3ViZSBtYXAgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBjdWJlbWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3ViZW1hcDtcbiAgICB9XG5cbiAgICBnZXQgZ3B1U2l6ZSgpIHtcbiAgICAgICAgY29uc3QgbWlwcyA9IHRoaXMucG90ICYmIHRoaXMuX21pcG1hcHMgJiYgISh0aGlzLl9jb21wcmVzc2VkICYmIHRoaXMuX2xldmVscy5sZW5ndGggPT09IDEpO1xuICAgICAgICByZXR1cm4gVGV4dHVyZS5jYWxjR3B1U2l6ZSh0aGlzLl93aWR0aCwgdGhpcy5faGVpZ2h0LCB0aGlzLl9kZXB0aCwgdGhpcy5fZm9ybWF0LCBtaXBzLCB0aGlzLl9jdWJlbWFwKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhpcyB0ZXh0dXJlIGlzIGEgM0Qgdm9sdW1lIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgdm9sdW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdm9sdW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIHNob3VsZCBiZSBmbGlwcGVkIGluIHRoZSBZLWRpcmVjdGlvbi4gT25seSBhZmZlY3RzIHRleHR1cmVzXG4gICAgICogd2l0aCBhIHNvdXJjZSB0aGF0IGlzIGFuIGltYWdlLCBjYW52YXMgb3IgdmlkZW8gZWxlbWVudC4gRG9lcyBub3QgYWZmZWN0IGN1YmVtYXBzLFxuICAgICAqIGNvbXByZXNzZWQgdGV4dHVyZXMgb3IgdGV4dHVyZXMgc2V0IGZyb20gcmF3IHBpeGVsIGRhdGEuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgZmxpcFkoZmxpcFkpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZsaXBZICE9PSBmbGlwWSkge1xuICAgICAgICAgICAgdGhpcy5fZmxpcFkgPSBmbGlwWTtcbiAgICAgICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmbGlwWSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZsaXBZO1xuICAgIH1cblxuICAgIHNldCBwcmVtdWx0aXBseUFscGhhKHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgaWYgKHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgIT09IHByZW11bHRpcGx5QWxwaGEpIHtcbiAgICAgICAgICAgIHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgPSBwcmVtdWx0aXBseUFscGhhO1xuICAgICAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHByZW11bHRpcGx5QWxwaGEoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcmVtdWx0aXBseUFscGhhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiBhbGwgZGltZW5zaW9ucyBvZiB0aGUgdGV4dHVyZSBhcmUgcG93ZXIgb2YgdHdvLCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHBvdCgpIHtcbiAgICAgICAgcmV0dXJuIG1hdGgucG93ZXJPZlR3byh0aGlzLl93aWR0aCkgJiYgbWF0aC5wb3dlck9mVHdvKHRoaXMuX2hlaWdodCk7XG4gICAgfVxuXG4gICAgLy8gZ2V0IHRoZSB0ZXh0dXJlJ3MgZW5jb2RpbmcgdHlwZVxuICAgIGdldCBlbmNvZGluZygpIHtcbiAgICAgICAgc3dpdGNoICh0aGlzLnR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgVEVYVFVSRVRZUEVfUkdCTTpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JnYm0nO1xuICAgICAgICAgICAgY2FzZSBURVhUVVJFVFlQRV9SR0JFOlxuICAgICAgICAgICAgICAgIHJldHVybiAncmdiZSc7XG4gICAgICAgICAgICBjYXNlIFRFWFRVUkVUWVBFX1JHQlA6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdyZ2JwJztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgcmV0dXJuICh0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCMTZGIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCMzJGIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTE2RiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkEzMkYpID8gJ2xpbmVhcicgOiAnc3JnYic7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzdGF0aWMgZnVuY3Rpb25zXG4gICAgLyoqXG4gICAgICogQ2FsY3VsYXRlIHRoZSBHUFUgbWVtb3J5IHJlcXVpcmVkIGZvciBhIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUZXh0dXJlJ3Mgd2lkdGguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRleHR1cmUncyBoZWlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlcHRoIC0gVGV4dHVyZSdzIGRlcHRoLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmb3JtYXQgLSBUZXh0dXJlJ3MgcGl4ZWwgZm9ybWF0IFBJWEVMRk9STUFUXyoqKi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IG1pcG1hcHMgLSBUcnVlIGlmIHRoZSB0ZXh0dXJlIGluY2x1ZGVzIG1pcG1hcHMsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGN1YmVtYXAgLSBUcnVlIGlzIHRoZSB0ZXh0dXJlIGlzIGEgY3ViZW1hcCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBudW1iZXIgb2YgYnl0ZXMgb2YgR1BVIG1lbW9yeSByZXF1aXJlZCBmb3IgdGhlIHRleHR1cmUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHN0YXRpYyBjYWxjR3B1U2l6ZSh3aWR0aCwgaGVpZ2h0LCBkZXB0aCwgZm9ybWF0LCBtaXBtYXBzLCBjdWJlbWFwKSB7XG4gICAgICAgIGlmICghX3BpeGVsU2l6ZVRhYmxlKSB7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGUgPSBbXTtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9BOF0gPSAxO1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0w4XSA9IDE7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfTDhfQThdID0gMjtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SNV9HNl9CNV0gPSAyO1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1I1X0c1X0I1X0ExXSA9IDI7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUjRfRzRfQjRfQTRdID0gMjtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SOF9HOF9COF0gPSA0O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1I4X0c4X0I4X0E4XSA9IDQ7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUkdCMTZGXSA9IDg7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfUkdCQTE2Rl0gPSA4O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1JHQjMyRl0gPSAxNjtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9SR0JBMzJGXSA9IDE2O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1IzMkZdID0gNDtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9ERVBUSF0gPSA0OyAvLyBjYW4gYmUgc21hbGxlciB1c2luZyBXZWJHTDEgZXh0ZW5zaW9uP1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0RFUFRIU1RFTkNJTF0gPSA0O1xuICAgICAgICAgICAgX3BpeGVsU2l6ZVRhYmxlW1BJWEVMRk9STUFUXzExMTExMEZdID0gNDtcbiAgICAgICAgICAgIF9waXhlbFNpemVUYWJsZVtQSVhFTEZPUk1BVF9TUkdCXSA9IDQ7XG4gICAgICAgICAgICBfcGl4ZWxTaXplVGFibGVbUElYRUxGT1JNQVRfU1JHQkFdID0gNDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghX2Jsb2NrU2l6ZVRhYmxlKSB7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGUgPSBbXTtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9FVEMxXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRVRDMl9SR0JdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9EWFQxXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfQVRDX1JHQl0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0VUQzJfUkdCQV0gPSAxNjtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9EWFQzXSA9IDE2O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0RYVDVdID0gMTY7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfQVNUQ180eDRdID0gMTY7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfQVRDX1JHQkFdID0gMTY7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwaXhlbFNpemUgPSBfcGl4ZWxTaXplVGFibGUuaGFzT3duUHJvcGVydHkoZm9ybWF0KSA/IF9waXhlbFNpemVUYWJsZVtmb3JtYXRdIDogMDtcbiAgICAgICAgY29uc3QgYmxvY2tTaXplID0gX2Jsb2NrU2l6ZVRhYmxlLmhhc093blByb3BlcnR5KGZvcm1hdCkgPyBfYmxvY2tTaXplVGFibGVbZm9ybWF0XSA6IDA7XG4gICAgICAgIGxldCByZXN1bHQgPSAwO1xuXG4gICAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgICAgICBpZiAocGl4ZWxTaXplID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSB1bmNvbXByZXNzZWQgZm9ybWF0c1xuICAgICAgICAgICAgICAgIHJlc3VsdCArPSB3aWR0aCAqIGhlaWdodCAqIGRlcHRoICogcGl4ZWxTaXplO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBoYW5kbGUgYmxvY2sgZm9ybWF0c1xuICAgICAgICAgICAgICAgIGxldCBibG9ja1dpZHRoID0gTWF0aC5mbG9vcigod2lkdGggKyAzKSAvIDQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJsb2NrSGVpZ2h0ID0gTWF0aC5mbG9vcigoaGVpZ2h0ICsgMykgLyA0KTtcbiAgICAgICAgICAgICAgICBjb25zdCBibG9ja0RlcHRoID0gTWF0aC5mbG9vcigoZGVwdGggKyAzKSAvIDQpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSB8fFxuICAgICAgICAgICAgICAgICAgICBmb3JtYXQgPT09IFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2NrV2lkdGggPSBNYXRoLm1heChNYXRoLmZsb29yKGJsb2NrV2lkdGggLyAyKSwgMSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzdWx0ICs9IGJsb2NrV2lkdGggKiBibG9ja0hlaWdodCAqIGJsb2NrRGVwdGggKiBibG9ja1NpemU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB3ZSdyZSBkb25lIGlmIG1pcG1hcHMgYXJlbid0IHJlcXVpcmVkIG9yIHdlJ3ZlIGNhbGN1bGF0ZWQgdGhlIHNtYWxsZXN0IG1pcG1hcCBsZXZlbFxuICAgICAgICAgICAgaWYgKCFtaXBtYXBzIHx8ICgod2lkdGggPT09IDEpICYmIChoZWlnaHQgPT09IDEpICYmIChkZXB0aCA9PT0gMSkpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aWR0aCA9IE1hdGgubWF4KE1hdGguZmxvb3Iod2lkdGggLyAyKSwgMSk7XG4gICAgICAgICAgICBoZWlnaHQgPSBNYXRoLm1heChNYXRoLmZsb29yKGhlaWdodCAvIDIpLCAxKTtcbiAgICAgICAgICAgIGRlcHRoID0gTWF0aC5tYXgoTWF0aC5mbG9vcihkZXB0aCAvIDIpLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQgKiAoY3ViZW1hcCA/IDYgOiAxKTtcbiAgICB9XG5cbiAgICAvLyBGb3JjZSBhIGZ1bGwgcmVzdWJtaXNzaW9uIG9mIHRoZSB0ZXh0dXJlIHRvIFdlYkdMICh1c2VkIG9uIGEgY29udGV4dCByZXN0b3JlIGV2ZW50KVxuICAgIGRpcnR5QWxsKCkge1xuICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkID0gdGhpcy5fY3ViZW1hcCA/IFtbdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZV1dIDogW3RydWVdO1xuXG4gICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbmVlZHNNaXBtYXBzVXBsb2FkID0gdGhpcy5fbWlwbWFwcztcbiAgICAgICAgdGhpcy5fbWlwbWFwc1VwbG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgPSAyNTU7IC8vIDEgfCAyIHwgNCB8IDggfCAxNiB8IDMyIHwgNjQgfCAxMjhcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2NrcyBhIG1pcGxldmVsIG9mIHRoZSB0ZXh0dXJlLCByZXR1cm5pbmcgYSB0eXBlZCBhcnJheSB0byBiZSBmaWxsZWQgd2l0aCBwaXhlbCBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0LiBWYWxpZCBwcm9wZXJ0aWVzIGFyZSBhcyBmb2xsb3dzOlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5sZXZlbF0gLSBUaGUgbWlwIGxldmVsIHRvIGxvY2sgd2l0aCAwIGJlaW5nIHRoZSB0b3AgbGV2ZWwuIERlZmF1bHRzXG4gICAgICogdG8gMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmFjZV0gLSBJZiB0aGUgdGV4dHVyZSBpcyBhIGN1YmVtYXAsIHRoaXMgaXMgdGhlIGluZGV4IG9mIHRoZSBmYWNlXG4gICAgICogdG8gbG9jay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubW9kZV0gLSBUaGUgbG9jayBtb2RlLiBDYW4gYmU6XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRUxPQ0tfUkVBRH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFTE9DS19XUklURX1cbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgVEVYVFVSRUxPQ0tfV1JJVEV9LlxuICAgICAqIEByZXR1cm5zIHtVaW50OEFycmF5fFVpbnQxNkFycmF5fEZsb2F0MzJBcnJheX0gQSB0eXBlZCBhcnJheSBjb250YWluaW5nIHRoZSBwaXhlbCBkYXRhIG9mXG4gICAgICogdGhlIGxvY2tlZCBtaXAgbGV2ZWwuXG4gICAgICovXG4gICAgbG9jayhvcHRpb25zID0ge30pIHtcbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBvcHRpb25zIHRvIHNvbWUgc2Vuc2libGUgZGVmYXVsdHNcbiAgICAgICAgaWYgKG9wdGlvbnMubGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5sZXZlbCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFjZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLmZhY2UgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLm1vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5tb2RlID0gVEVYVFVSRUxPQ0tfV1JJVEU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IG9wdGlvbnMubGV2ZWw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgc3dpdGNoICh0aGlzLl9mb3JtYXQpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0E4OlxuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfTDg6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0w4X0E4OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqICB0aGlzLl9kZXB0aCAqIDIpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1I1X0c2X0I1OlxuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjVfRzVfQjVfQTE6XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SNF9HNF9CNF9BNDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQxNkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1I4X0c4X0I4OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogMyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTg6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiA0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQxOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheShNYXRoLmZsb29yKCh0aGlzLl93aWR0aCArIDMpIC8gNCkgKiBNYXRoLmZsb29yKCh0aGlzLl9oZWlnaHQgKyAzKSAvIDQpICogOCAqIHRoaXMuX2RlcHRoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQzOlxuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUNTpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkoTWF0aC5mbG9vcigodGhpcy5fd2lkdGggKyAzKSAvIDQpICogTWF0aC5mbG9vcigodGhpcy5faGVpZ2h0ICsgMykgLyA0KSAqIDE2ICogdGhpcy5fZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjE2RjpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQxNkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiAzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IzMkY6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkExNkY6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50MTZBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogNCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTMyRjpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogNCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHBpeGVsIGRhdGEgb2YgdGhlIHRleHR1cmUgZnJvbSBhIGNhbnZhcywgaW1hZ2UsIHZpZGVvIERPTSBlbGVtZW50LiBJZiB0aGUgdGV4dHVyZSBpc1xuICAgICAqIGEgY3ViZW1hcCwgdGhlIHN1cHBsaWVkIHNvdXJjZSBtdXN0IGJlIGFuIGFycmF5IG9mIDYgY2FudmFzZXMsIGltYWdlcyBvciB2aWRlb3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxDYW52YXNFbGVtZW50fEhUTUxJbWFnZUVsZW1lbnR8SFRNTFZpZGVvRWxlbWVudHxIVE1MQ2FudmFzRWxlbWVudFtdfEhUTUxJbWFnZUVsZW1lbnRbXXxIVE1MVmlkZW9FbGVtZW50W119IHNvdXJjZSAtIEFcbiAgICAgKiBjYW52YXMsIGltYWdlIG9yIHZpZGVvIGVsZW1lbnQsIG9yIGFuIGFycmF5IG9mIDYgY2FudmFzLCBpbWFnZSBvciB2aWRlbyBlbGVtZW50cy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21pcExldmVsXSAtIEEgbm9uLW5lZ2F0aXZlIGludGVnZXIgc3BlY2lmeWluZyB0aGUgaW1hZ2UgbGV2ZWwgb2YgZGV0YWlsLlxuICAgICAqIERlZmF1bHRzIHRvIDAsIHdoaWNoIHJlcHJlc2VudHMgdGhlIGJhc2UgaW1hZ2Ugc291cmNlLiBBIGxldmVsIHZhbHVlIG9mIE4sIHRoYXQgaXMgZ3JlYXRlclxuICAgICAqIHRoYW4gMCwgcmVwcmVzZW50cyB0aGUgaW1hZ2Ugc291cmNlIGZvciB0aGUgTnRoIG1pcG1hcCByZWR1Y3Rpb24gbGV2ZWwuXG4gICAgICovXG4gICAgc2V0U291cmNlKHNvdXJjZSwgbWlwTGV2ZWwgPSAwKSB7XG4gICAgICAgIGxldCBpbnZhbGlkID0gZmFsc2U7XG4gICAgICAgIGxldCB3aWR0aCwgaGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlWzBdKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVseSBvbiBmaXJzdCBmYWNlIHNpemVzXG4gICAgICAgICAgICAgICAgd2lkdGggPSBzb3VyY2VbMF0ud2lkdGggfHwgMDtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSBzb3VyY2VbMF0uaGVpZ2h0IHx8IDA7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWNlID0gc291cmNlW2ldO1xuICAgICAgICAgICAgICAgICAgICAvLyBjdWJlbWFwIGJlY29tZXMgaW52YWxpZCBpZiBhbnkgY29uZGl0aW9uIGlzIG5vdCBzYXRpc2ZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmYWNlIHx8ICAgICAgICAgICAgICAgICAgLy8gZmFjZSBpcyBtaXNzaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWNlLndpZHRoICE9PSB3aWR0aCB8fCAgIC8vIGZhY2UgaXMgZGlmZmVyZW50IHdpZHRoXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWNlLmhlaWdodCAhPT0gaGVpZ2h0IHx8IC8vIGZhY2UgaXMgZGlmZmVyZW50IGhlaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgIXRoaXMuZGV2aWNlLl9pc0Jyb3dzZXJJbnRlcmZhY2UoZmFjZSkpIHsgICAgICAgICAgICAvLyBuZXcgaW1hZ2UgYml0bWFwXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBmaXJzdCBmYWNlIGlzIG1pc3NpbmdcbiAgICAgICAgICAgICAgICBpbnZhbGlkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpbnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgLy8gbWFyayBsZXZlbHMgYXMgdXBkYXRlZFxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdW2ldICE9PSBzb3VyY2VbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXVtpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgc291cmNlIGlzIHZhbGlkIHR5cGUgb2YgZWxlbWVudFxuICAgICAgICAgICAgaWYgKCF0aGlzLmRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKHNvdXJjZSkpXG4gICAgICAgICAgICAgICAgaW52YWxpZCA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmICghaW52YWxpZCkge1xuICAgICAgICAgICAgICAgIC8vIG1hcmsgbGV2ZWwgYXMgdXBkYXRlZFxuICAgICAgICAgICAgICAgIGlmIChzb3VyY2UgIT09IHRoaXMuX2xldmVsc1ttaXBMZXZlbF0pXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWRbbWlwTGV2ZWxdID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIHdpZHRoID0gc291cmNlLndpZHRoO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHNvdXJjZS5oZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW52YWxpZCkge1xuICAgICAgICAgICAgLy8gaW52YWxpZCB0ZXh0dXJlXG5cbiAgICAgICAgICAgIC8vIGRlZmF1bHQgc2l6ZXNcbiAgICAgICAgICAgIHRoaXMuX3dpZHRoID0gNDtcbiAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IDQ7XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBsZXZlbHNcbiAgICAgICAgICAgIGlmICh0aGlzLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW21pcExldmVsXVtpXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWRbbWlwTGV2ZWxdW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1ttaXBMZXZlbF0gPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWRbbWlwTGV2ZWxdID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHZhbGlkIHRleHR1cmVcbiAgICAgICAgICAgIGlmIChtaXBMZXZlbCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdID0gc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgb3IgY2hhbmdlZCBzdGF0ZSBvZiB2YWxpZGl0eVxuICAgICAgICBpZiAodGhpcy5faW52YWxpZCAhPT0gaW52YWxpZCB8fCAhaW52YWxpZCkge1xuICAgICAgICAgICAgdGhpcy5faW52YWxpZCA9IGludmFsaWQ7XG5cbiAgICAgICAgICAgIC8vIHJldXBsb2FkXG4gICAgICAgICAgICB0aGlzLnVwbG9hZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBwaXhlbCBkYXRhIG9mIHRoZSB0ZXh0dXJlLiBJZiB0aGlzIGlzIGEgY3ViZW1hcCB0aGVuIGFuIGFycmF5IG9mIDYgaW1hZ2VzIHdpbGwgYmVcbiAgICAgKiByZXR1cm5lZCBvdGhlcndpc2UgYSBzaW5nbGUgaW1hZ2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21pcExldmVsXSAtIEEgbm9uLW5lZ2F0aXZlIGludGVnZXIgc3BlY2lmeWluZyB0aGUgaW1hZ2UgbGV2ZWwgb2YgZGV0YWlsLlxuICAgICAqIERlZmF1bHRzIHRvIDAsIHdoaWNoIHJlcHJlc2VudHMgdGhlIGJhc2UgaW1hZ2Ugc291cmNlLiBBIGxldmVsIHZhbHVlIG9mIE4sIHRoYXQgaXMgZ3JlYXRlclxuICAgICAqIHRoYW4gMCwgcmVwcmVzZW50cyB0aGUgaW1hZ2Ugc291cmNlIGZvciB0aGUgTnRoIG1pcG1hcCByZWR1Y3Rpb24gbGV2ZWwuXG4gICAgICogQHJldHVybnMge0hUTUxJbWFnZUVsZW1lbnR9IFRoZSBzb3VyY2UgaW1hZ2Ugb2YgdGhpcyB0ZXh0dXJlLiBDYW4gYmUgbnVsbCBpZiBzb3VyY2Ugbm90XG4gICAgICogYXNzaWduZWQgZm9yIHNwZWNpZmljIGltYWdlIGxldmVsLlxuICAgICAqL1xuICAgIGdldFNvdXJjZShtaXBMZXZlbCA9IDApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xldmVsc1ttaXBMZXZlbF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVW5sb2NrcyB0aGUgY3VycmVudGx5IGxvY2tlZCBtaXAgbGV2ZWwgYW5kIHVwbG9hZHMgaXQgdG8gVlJBTS5cbiAgICAgKi9cbiAgICB1bmxvY2soKSB7XG4gICAgICAgIGlmICh0aGlzLl9sb2NrZWRMZXZlbCA9PT0gLTEpIHtcbiAgICAgICAgICAgIERlYnVnLmxvZyhcInBjLlRleHR1cmUjdW5sb2NrOiBBdHRlbXB0aW5nIHRvIHVubG9jayBhIHRleHR1cmUgdGhhdCBpcyBub3QgbG9ja2VkLlwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwbG9hZCB0aGUgbmV3IHBpeGVsIGRhdGFcbiAgICAgICAgdGhpcy51cGxvYWQoKTtcbiAgICAgICAgdGhpcy5fbG9ja2VkTGV2ZWwgPSAtMTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3JjZXMgYSByZXVwbG9hZCBvZiB0aGUgdGV4dHVyZXMgcGl4ZWwgZGF0YSB0byBncmFwaGljcyBtZW1vcnkuIE9yZGluYXJpbHksIHRoaXMgZnVuY3Rpb25cbiAgICAgKiBpcyBjYWxsZWQgYnkgaW50ZXJuYWxseSBieSB7QGxpbmsgVGV4dHVyZSNzZXRTb3VyY2V9IGFuZCB7QGxpbmsgVGV4dHVyZSN1bmxvY2t9LiBIb3dldmVyLCBpdFxuICAgICAqIHN0aWxsIG5lZWRzIHRvIGJlIGNhbGxlZCBleHBsaWNpdGx5IGluIHRoZSBjYXNlIHdoZXJlIGFuIEhUTUxWaWRlb0VsZW1lbnQgaXMgc2V0IGFzIHRoZVxuICAgICAqIHNvdXJjZSBvZiB0aGUgdGV4dHVyZS4gIE5vcm1hbGx5LCB0aGlzIGlzIGRvbmUgb25jZSBldmVyeSBmcmFtZSBiZWZvcmUgdmlkZW8gdGV4dHVyZWRcbiAgICAgKiBnZW9tZXRyeSBpcyByZW5kZXJlZC5cbiAgICAgKi9cbiAgICB1cGxvYWQoKSB7XG4gICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbmVlZHNNaXBtYXBzVXBsb2FkID0gdGhpcy5fbWlwbWFwcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZSBhbiBpbi1tZW1vcnkgRERTIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgdGV4dHVyZS4gT25seSB3b3JrcyBvbiBSR0JBOCB0ZXh0dXJlcy5cbiAgICAgKiBDdXJyZW50bHksIG9ubHkgdXNlZCBieSB0aGUgRWRpdG9yIHRvIHdyaXRlIHByZWZpbHRlcmVkIGN1YmVtYXBzIHRvIEREUyBmb3JtYXQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7QXJyYXlCdWZmZXJ9IEJ1ZmZlciBjb250YWluaW5nIHRoZSBERFMgZGF0YS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0RGRzKCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4LCBcIlRoaXMgZm9ybWF0IGlzIG5vdCBpbXBsZW1lbnRlZCB5ZXRcIik7XG5cbiAgICAgICAgbGV0IGZzaXplID0gMTI4O1xuICAgICAgICBsZXQgaWR4ID0gMDtcbiAgICAgICAgd2hpbGUgKHRoaXMuX2xldmVsc1tpZHhdKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pcFNpemUgPSB0aGlzLl9sZXZlbHNbaWR4XS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgaWYgKCFtaXBTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBObyBieXRlIGFycmF5IGZvciBtaXAgJHtpZHh9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZzaXplICs9IG1pcFNpemU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgZmFjZSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5fbGV2ZWxzW2lkeF1bZmFjZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBObyBsZXZlbCBkYXRhIGZvciBtaXAgJHtpZHh9LCBmYWNlICR7ZmFjZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWlwU2l6ZSA9IHRoaXMuX2xldmVsc1tpZHhdW2ZhY2VdLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFtaXBTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgTm8gYnl0ZSBhcnJheSBmb3IgbWlwICR7aWR4fSwgZmFjZSAke2ZhY2V9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGZzaXplICs9IG1pcFNpemU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZnNpemUgKz0gdGhpcy5fbGV2ZWxzW2lkeF0ubGVuZ3RoO1xuICAgICAgICAgICAgaWR4Kys7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBidWZmID0gbmV3IEFycmF5QnVmZmVyKGZzaXplKTtcbiAgICAgICAgY29uc3QgaGVhZGVyID0gbmV3IFVpbnQzMkFycmF5KGJ1ZmYsIDAsIDEyOCAvIDQpO1xuXG4gICAgICAgIGNvbnN0IEREU19NQUdJQyA9IDU0MjMyNzg3NjsgLy8gXCJERFNcIlxuICAgICAgICBjb25zdCBERFNfSEVBREVSX1NJWkUgPSAxMjQ7XG4gICAgICAgIGNvbnN0IEREU19GTEFHU19SRVFVSVJFRCA9IDB4MDEgfCAweDAyIHwgMHgwNCB8IDB4MTAwMCB8IDB4ODAwMDA7IC8vIGNhcHMgfCBoZWlnaHQgfCB3aWR0aCB8IHBpeGVsZm9ybWF0IHwgbGluZWFyc2l6ZVxuICAgICAgICBjb25zdCBERFNfRkxBR1NfTUlQTUFQID0gMHgyMDAwMDtcbiAgICAgICAgY29uc3QgRERTX1BJWEVMRk9STUFUX1NJWkUgPSAzMjtcbiAgICAgICAgY29uc3QgRERTX1BJWEVMRkxBR1NfUkdCQTggPSAweDAxIHwgMHg0MDsgLy8gYWxwaGEgfCByZ2JcbiAgICAgICAgY29uc3QgRERTX0NBUFNfUkVRVUlSRUQgPSAweDEwMDA7XG4gICAgICAgIGNvbnN0IEREU19DQVBTX01JUE1BUCA9IDB4NDAwMDAwO1xuICAgICAgICBjb25zdCBERFNfQ0FQU19DT01QTEVYID0gMHg4O1xuICAgICAgICBjb25zdCBERFNfQ0FQUzJfQ1VCRU1BUCA9IDB4MjAwIHwgMHg0MDAgfCAweDgwMCB8IDB4MTAwMCB8IDB4MjAwMCB8IDB4NDAwMCB8IDB4ODAwMDsgLy8gY3ViZW1hcCB8IGFsbCBmYWNlc1xuXG4gICAgICAgIGxldCBmbGFncyA9IEREU19GTEFHU19SRVFVSVJFRDtcbiAgICAgICAgaWYgKHRoaXMuX2xldmVscy5sZW5ndGggPiAxKSBmbGFncyB8PSBERFNfRkxBR1NfTUlQTUFQO1xuXG4gICAgICAgIGxldCBjYXBzID0gRERTX0NBUFNfUkVRVUlSRUQ7XG4gICAgICAgIGlmICh0aGlzLl9sZXZlbHMubGVuZ3RoID4gMSkgY2FwcyB8PSBERFNfQ0FQU19NSVBNQVA7XG4gICAgICAgIGlmICh0aGlzLl9sZXZlbHMubGVuZ3RoID4gMSB8fCB0aGlzLmN1YmVtYXApIGNhcHMgfD0gRERTX0NBUFNfQ09NUExFWDtcblxuICAgICAgICBjb25zdCBjYXBzMiA9IHRoaXMuY3ViZW1hcCA/IEREU19DQVBTMl9DVUJFTUFQIDogMDtcblxuICAgICAgICBoZWFkZXJbMF0gPSBERFNfTUFHSUM7XG4gICAgICAgIGhlYWRlclsxXSA9IEREU19IRUFERVJfU0laRTtcbiAgICAgICAgaGVhZGVyWzJdID0gZmxhZ3M7XG4gICAgICAgIGhlYWRlclszXSA9IHRoaXMuaGVpZ2h0O1xuICAgICAgICBoZWFkZXJbNF0gPSB0aGlzLndpZHRoO1xuICAgICAgICBoZWFkZXJbNV0gPSB0aGlzLndpZHRoICogdGhpcy5oZWlnaHQgKiA0O1xuICAgICAgICBoZWFkZXJbNl0gPSAwOyAvLyBkZXB0aFxuICAgICAgICBoZWFkZXJbN10gPSB0aGlzLl9sZXZlbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDExOyBpKyspIHtcbiAgICAgICAgICAgIGhlYWRlcls4ICsgaV0gPSAwO1xuICAgICAgICB9XG4gICAgICAgIGhlYWRlclsxOV0gPSBERFNfUElYRUxGT1JNQVRfU0laRTtcbiAgICAgICAgaGVhZGVyWzIwXSA9IEREU19QSVhFTEZMQUdTX1JHQkE4O1xuICAgICAgICBoZWFkZXJbMjFdID0gMDsgLy8gZm91cmNjXG4gICAgICAgIGhlYWRlclsyMl0gPSAzMjsgLy8gYnBwXG4gICAgICAgIGhlYWRlclsyM10gPSAweDAwRkYwMDAwOyAvLyBSIG1hc2tcbiAgICAgICAgaGVhZGVyWzI0XSA9IDB4MDAwMEZGMDA7IC8vIEcgbWFza1xuICAgICAgICBoZWFkZXJbMjVdID0gMHgwMDAwMDBGRjsgLy8gQiBtYXNrXG4gICAgICAgIGhlYWRlclsyNl0gPSAweEZGMDAwMDAwOyAvLyBBIG1hc2tcbiAgICAgICAgaGVhZGVyWzI3XSA9IGNhcHM7XG4gICAgICAgIGhlYWRlclsyOF0gPSBjYXBzMjtcbiAgICAgICAgaGVhZGVyWzI5XSA9IDA7XG4gICAgICAgIGhlYWRlclszMF0gPSAwO1xuICAgICAgICBoZWFkZXJbMzFdID0gMDtcblxuICAgICAgICBsZXQgb2Zmc2V0ID0gMTI4O1xuICAgICAgICBpZiAoIXRoaXMuY3ViZW1hcCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sZXZlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsZXZlbCA9IHRoaXMuX2xldmVsc1tpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBtaXAgPSBuZXcgVWludDhBcnJheShidWZmLCBvZmZzZXQsIGxldmVsLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZXZlbC5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBtaXBbal0gPSBsZXZlbFtqXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb2Zmc2V0ICs9IGxldmVsLmxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgZmFjZSsrKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sZXZlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbaV1bZmFjZV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pcCA9IG5ldyBVaW50OEFycmF5KGJ1ZmYsIG9mZnNldCwgbGV2ZWwubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZXZlbC5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWlwW2pdID0gbGV2ZWxbal07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0ICs9IGxldmVsLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYnVmZjtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFRleHR1cmUgfTtcbiJdLCJuYW1lcyI6WyJfcGl4ZWxTaXplVGFibGUiLCJfYmxvY2tTaXplVGFibGUiLCJpZCIsIlRleHR1cmUiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwib3B0aW9ucyIsImRldmljZSIsIkRlYnVnIiwiYXNzZXJ0IiwibmFtZSIsIl93aWR0aCIsIl9oZWlnaHQiLCJfZGVwdGgiLCJfZm9ybWF0IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJ0eXBlIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsInByb2plY3Rpb24iLCJURVhUVVJFUFJPSkVDVElPTl9OT05FIiwiX2N1YmVtYXAiLCJfdm9sdW1lIiwiZml4Q3ViZW1hcFNlYW1zIiwiX2ZsaXBZIiwiX3ByZW11bHRpcGx5QWxwaGEiLCJfaXNSZW5kZXJUYXJnZXQiLCJfbWlwbWFwcyIsIl9taW5GaWx0ZXIiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJfbWFnRmlsdGVyIiwiRklMVEVSX0xJTkVBUiIsIl9hbmlzb3Ryb3B5IiwiX2FkZHJlc3NVIiwiQUREUkVTU19SRVBFQVQiLCJfYWRkcmVzc1YiLCJfYWRkcmVzc1ciLCJfY29tcGFyZU9uUmVhZCIsIl9jb21wYXJlRnVuYyIsIkZVTkNfTEVTUyIsInByb2ZpbGVySGludCIsInVuZGVmaW5lZCIsIndpZHRoIiwiaGVpZ2h0IiwiZm9ybWF0IiwiaGFzT3duUHJvcGVydHkiLCJkZXByZWNhdGVkIiwicmdibSIsIlRFWFRVUkVUWVBFX1JHQk0iLCJzd2l6emxlR0dHUiIsIlRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIiwibWlwbWFwcyIsImF1dG9NaXBtYXAiLCJfbGV2ZWxzIiwibGV2ZWxzIiwiY3ViZW1hcCIsIlRFWFRVUkVQUk9KRUNUSU9OX0NVQkUiLCJtaW5GaWx0ZXIiLCJtYWdGaWx0ZXIiLCJhbmlzb3Ryb3B5IiwiYWRkcmVzc1UiLCJhZGRyZXNzViIsImNvbXBhcmVPblJlYWQiLCJmbGlwWSIsInByZW11bHRpcGx5QWxwaGEiLCJ3ZWJnbDIiLCJkZXB0aCIsInZvbHVtZSIsImFkZHJlc3NXIiwiX2NvbXByZXNzZWQiLCJQSVhFTEZPUk1BVF9EWFQxIiwiUElYRUxGT1JNQVRfRFhUMyIsIlBJWEVMRk9STUFUX0RYVDUiLCJQSVhFTEZPUk1BVF9FVEMxIiwiX2ludmFsaWQiLCJfbG9ja2VkTGV2ZWwiLCJkaXJ0eUFsbCIsIl9ncHVTaXplIiwiaW1wbCIsImNyZWF0ZVRleHR1cmVJbXBsIiwidGV4dHVyZXMiLCJwdXNoIiwidHJhY2UiLCJUUkFDRUlEX1RFWFRVUkVfQUxMT0MiLCJkZXN0cm95IiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsInNjb3BlIiwicmVtb3ZlVmFsdWUiLCJhZGp1c3RWcmFtU2l6ZVRyYWNraW5nIiwiX3ZyYW0iLCJsb3NlQ29udGV4dCIsInZyYW0iLCJzaXplIiwiVFJBQ0VJRF9WUkFNX1RFWFRVUkUiLCJ0ZXgiLCJURVhISU5UX1NIQURPV01BUCIsInRleFNoYWRvdyIsIlRFWEhJTlRfQVNTRVQiLCJ0ZXhBc3NldCIsIlRFWEhJTlRfTElHSFRNQVAiLCJ0ZXhMaWdodG1hcCIsInYiLCJfcGFyYW1ldGVyRmxhZ3MiLCJ3YXJuIiwiY29tcGFyZUZ1bmMiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwiZ3B1U2l6ZSIsIm1pcHMiLCJwb3QiLCJsZW5ndGgiLCJjYWxjR3B1U2l6ZSIsIl9uZWVkc1VwbG9hZCIsIm1hdGgiLCJwb3dlck9mVHdvIiwiZW5jb2RpbmciLCJURVhUVVJFVFlQRV9SR0JFIiwiVEVYVFVSRVRZUEVfUkdCUCIsIlBJWEVMRk9STUFUX1JHQjE2RiIsIlBJWEVMRk9STUFUX1JHQjMyRiIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiUElYRUxGT1JNQVRfQTgiLCJQSVhFTEZPUk1BVF9MOCIsIlBJWEVMRk9STUFUX0w4X0E4IiwiUElYRUxGT1JNQVRfUjVfRzZfQjUiLCJQSVhFTEZPUk1BVF9SNV9HNV9CNV9BMSIsIlBJWEVMRk9STUFUX1I0X0c0X0I0X0E0IiwiUElYRUxGT1JNQVRfUjhfRzhfQjgiLCJQSVhFTEZPUk1BVF9SMzJGIiwiUElYRUxGT1JNQVRfREVQVEgiLCJQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwiLCJQSVhFTEZPUk1BVF8xMTExMTBGIiwiUElYRUxGT1JNQVRfU1JHQiIsIlBJWEVMRk9STUFUX1NSR0JBIiwiUElYRUxGT1JNQVRfRVRDMl9SR0IiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9BVENfUkdCIiwiUElYRUxGT1JNQVRfRVRDMl9SR0JBIiwiUElYRUxGT1JNQVRfQVNUQ180eDQiLCJQSVhFTEZPUk1BVF9BVENfUkdCQSIsInBpeGVsU2l6ZSIsImJsb2NrU2l6ZSIsInJlc3VsdCIsImJsb2NrV2lkdGgiLCJNYXRoIiwiZmxvb3IiLCJibG9ja0hlaWdodCIsImJsb2NrRGVwdGgiLCJtYXgiLCJfbGV2ZWxzVXBkYXRlZCIsIl9taXBtYXBzVXBsb2FkZWQiLCJsb2NrIiwibGV2ZWwiLCJmYWNlIiwibW9kZSIsIlRFWFRVUkVMT0NLX1dSSVRFIiwiVWludDhBcnJheSIsIlVpbnQxNkFycmF5IiwiRmxvYXQzMkFycmF5Iiwic2V0U291cmNlIiwic291cmNlIiwibWlwTGV2ZWwiLCJpbnZhbGlkIiwiaSIsIl9pc0Jyb3dzZXJJbnRlcmZhY2UiLCJ1cGxvYWQiLCJnZXRTb3VyY2UiLCJ1bmxvY2siLCJsb2ciLCJnZXREZHMiLCJmc2l6ZSIsIm1pcFNpemUiLCJlcnJvciIsImJ1ZmYiLCJBcnJheUJ1ZmZlciIsImhlYWRlciIsIlVpbnQzMkFycmF5IiwiRERTX01BR0lDIiwiRERTX0hFQURFUl9TSVpFIiwiRERTX0ZMQUdTX1JFUVVJUkVEIiwiRERTX0ZMQUdTX01JUE1BUCIsIkREU19QSVhFTEZPUk1BVF9TSVpFIiwiRERTX1BJWEVMRkxBR1NfUkdCQTgiLCJERFNfQ0FQU19SRVFVSVJFRCIsIkREU19DQVBTX01JUE1BUCIsIkREU19DQVBTX0NPTVBMRVgiLCJERFNfQ0FQUzJfQ1VCRU1BUCIsImZsYWdzIiwiY2FwcyIsImNhcHMyIiwib2Zmc2V0IiwibWlwIiwiaiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQXVCQSxJQUFJQSxlQUFlLEdBQUcsSUFBdEIsQ0FBQTtBQUNBLElBQUlDLGVBQWUsR0FBRyxJQUF0QixDQUFBO0FBRUEsSUFBSUMsRUFBRSxHQUFHLENBQVQsQ0FBQTs7QUFNQSxNQUFNQyxPQUFOLENBQWM7QUFnSFZDLEVBQUFBLFdBQVcsQ0FBQ0MsY0FBRCxFQUFpQkMsT0FBakIsRUFBMEI7SUFDakMsSUFBS0osQ0FBQUEsRUFBTCxHQUFVQSxFQUFFLEVBQVosQ0FBQTtJQUNBLElBQUtLLENBQUFBLE1BQUwsR0FBY0YsY0FBZCxDQUFBO0FBQ0FHLElBQUFBLEtBQUssQ0FBQ0MsTUFBTixDQUFhLElBQUtGLENBQUFBLE1BQWxCLEVBQTBCLDBEQUExQixDQUFBLENBQUE7SUFPQSxJQUFLRyxDQUFBQSxJQUFMLEdBQVksSUFBWixDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsTUFBTCxHQUFjLENBQWQsQ0FBQTtJQUNBLElBQUtDLENBQUFBLE9BQUwsR0FBZSxDQUFmLENBQUE7SUFDQSxJQUFLQyxDQUFBQSxNQUFMLEdBQWMsQ0FBZCxDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsT0FBTCxHQUFlQyx1QkFBZixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEsSUFBTCxHQUFZQyxtQkFBWixDQUFBO0lBQ0EsSUFBS0MsQ0FBQUEs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
