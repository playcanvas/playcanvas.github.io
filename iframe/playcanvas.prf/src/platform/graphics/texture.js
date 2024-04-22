import { math } from '../../core/math/math.js';
import { RenderTarget } from './render-target.js';
import { TextureUtils } from './texture-utils.js';
import { TEXTURELOCK_NONE, PIXELFORMAT_RGBA8, isCompressedPixelFormat, isIntegerPixelFormat, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_CUBE, TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, TEXTURELOCK_WRITE, getPixelFormatArrayType } from './constants.js';

let id = 0;
class Texture {
  constructor(graphicsDevice, options = {}) {
    var _options$name, _options$width, _options$height, _options$format, _options$storage, _options$cubemap, _options$fixCubemapSe, _options$flipY, _options$premultiplyA, _ref, _options$mipmaps, _options$minFilter, _options$magFilter, _options$anisotropy, _options$addressU, _options$addressV, _options$addressW, _options$compareOnRea, _options$compareFunc, _options$profilerHint;
    this.name = void 0;
    this._gpuSize = 0;
    this.id = id++;
    this._invalid = false;
    this._lockedLevel = -1;
    this._lockedMode = TEXTURELOCK_NONE;
    this.renderVersionDirty = 0;
    this._storage = false;
    this.device = graphicsDevice;
    this.name = (_options$name = options.name) != null ? _options$name : '';
    this._width = Math.floor((_options$width = options.width) != null ? _options$width : 4);
    this._height = Math.floor((_options$height = options.height) != null ? _options$height : 4);
    this._format = (_options$format = options.format) != null ? _options$format : PIXELFORMAT_RGBA8;
    this._compressed = isCompressedPixelFormat(this._format);
    this._integerFormat = isIntegerPixelFormat(this._format);
    if (this._integerFormat) {
      options.mipmaps = false;
      options.minFilter = FILTER_NEAREST;
      options.magFilter = FILTER_NEAREST;
    }
    if (graphicsDevice.supportsVolumeTextures) {
      var _options$volume, _options$depth, _options$arrayLength;
      this._volume = (_options$volume = options.volume) != null ? _options$volume : false;
      this._depth = Math.floor((_options$depth = options.depth) != null ? _options$depth : 1);
      this._arrayLength = Math.floor((_options$arrayLength = options.arrayLength) != null ? _options$arrayLength : 0);
    } else {
      this._volume = false;
      this._depth = 1;
      this._arrayLength = 0;
    }
    this._storage = (_options$storage = options.storage) != null ? _options$storage : false;
    this._cubemap = (_options$cubemap = options.cubemap) != null ? _options$cubemap : false;
    this.fixCubemapSeams = (_options$fixCubemapSe = options.fixCubemapSeams) != null ? _options$fixCubemapSe : false;
    this._flipY = (_options$flipY = options.flipY) != null ? _options$flipY : false;
    this._premultiplyAlpha = (_options$premultiplyA = options.premultiplyAlpha) != null ? _options$premultiplyA : false;
    this._mipmaps = (_ref = (_options$mipmaps = options.mipmaps) != null ? _options$mipmaps : options.autoMipmap) != null ? _ref : true;
    this._minFilter = (_options$minFilter = options.minFilter) != null ? _options$minFilter : FILTER_LINEAR_MIPMAP_LINEAR;
    this._magFilter = (_options$magFilter = options.magFilter) != null ? _options$magFilter : FILTER_LINEAR;
    this._anisotropy = (_options$anisotropy = options.anisotropy) != null ? _options$anisotropy : 1;
    this._addressU = (_options$addressU = options.addressU) != null ? _options$addressU : ADDRESS_REPEAT;
    this._addressV = (_options$addressV = options.addressV) != null ? _options$addressV : ADDRESS_REPEAT;
    this._addressW = (_options$addressW = options.addressW) != null ? _options$addressW : ADDRESS_REPEAT;
    this._compareOnRead = (_options$compareOnRea = options.compareOnRead) != null ? _options$compareOnRea : false;
    this._compareFunc = (_options$compareFunc = options.compareFunc) != null ? _options$compareFunc : FUNC_LESS;
    this.type = TEXTURETYPE_DEFAULT;
    if (options.hasOwnProperty('type')) {
      this.type = options.type;
    } else if (options.hasOwnProperty('rgbm')) {
      this.type = options.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
    } else if (options.hasOwnProperty('swizzleGGGR')) {
      this.type = options.swizzleGGGR ? TEXTURETYPE_SWIZZLEGGGR : TEXTURETYPE_DEFAULT;
    }
    this.projection = TEXTUREPROJECTION_NONE;
    if (this._cubemap) {
      this.projection = TEXTUREPROJECTION_CUBE;
    } else if (options.projection && options.projection !== TEXTUREPROJECTION_CUBE) {
      this.projection = options.projection;
    }
    this.impl = graphicsDevice.createTextureImpl(this);
    this.profilerHint = (_options$profilerHint = options.profilerHint) != null ? _options$profilerHint : 0;
    this.dirtyAll();
    this._levels = options.levels;
    if (this._levels) {
      this.upload();
    } else {
      this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
    }
    graphicsDevice.textures.push(this);
  }
  destroy() {
    const device = this.device;
    if (device) {
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
  resize(width, height, depth = 1) {
    const device = this.device;
    this.adjustVramSizeTracking(device._vram, -this._gpuSize);
    this.impl.destroy(device);
    this._width = Math.floor(width);
    this._height = Math.floor(height);
    this._depth = Math.floor(depth);
    this.impl = device.createTextureImpl(this);
    this.dirtyAll();
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
  propertyChanged(flag) {
    this.impl.propertyChanged(flag);
    this.renderVersionDirty = this.device.renderVersion;
  }
  get requiredMipLevels() {
    return this.mipmaps ? TextureUtils.calcMipLevelsCount(this.width, this.height) : 1;
  }
  get lockedMode() {
    return this._lockedMode;
  }
  set minFilter(v) {
    if (this._minFilter !== v) {
      if (isIntegerPixelFormat(this._format)) ; else {
        this._minFilter = v;
        this.propertyChanged(1);
      }
    }
  }
  get minFilter() {
    return this._minFilter;
  }
  set magFilter(v) {
    if (this._magFilter !== v) {
      if (isIntegerPixelFormat(this._format)) ; else {
        this._magFilter = v;
        this.propertyChanged(2);
      }
    }
  }
  get magFilter() {
    return this._magFilter;
  }
  set addressU(v) {
    if (this._addressU !== v) {
      this._addressU = v;
      this.propertyChanged(4);
    }
  }
  get addressU() {
    return this._addressU;
  }
  set addressV(v) {
    if (this._addressV !== v) {
      this._addressV = v;
      this.propertyChanged(8);
    }
  }
  get addressV() {
    return this._addressV;
  }
  set addressW(addressW) {
    if (!this.device.supportsVolumeTextures) return;
    if (!this._volume) {
      return;
    }
    if (addressW !== this._addressW) {
      this._addressW = addressW;
      this.propertyChanged(16);
    }
  }
  get addressW() {
    return this._addressW;
  }
  set compareOnRead(v) {
    if (this._compareOnRead !== v) {
      this._compareOnRead = v;
      this.propertyChanged(32);
    }
  }
  get compareOnRead() {
    return this._compareOnRead;
  }
  set compareFunc(v) {
    if (this._compareFunc !== v) {
      this._compareFunc = v;
      this.propertyChanged(64);
    }
  }
  get compareFunc() {
    return this._compareFunc;
  }
  set anisotropy(v) {
    if (this._anisotropy !== v) {
      this._anisotropy = v;
      this.propertyChanged(128);
    }
  }
  get anisotropy() {
    return this._anisotropy;
  }
  set mipmaps(v) {
    if (this._mipmaps !== v) {
      if (this.device.isWebGPU) ; else if (isIntegerPixelFormat(this._format)) ; else {
        this._mipmaps = v;
      }
      if (v) this._needsMipmapsUpload = true;
    }
  }
  get mipmaps() {
    return this._mipmaps;
  }
  get storage() {
    return this._storage;
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
    return TextureUtils.calcGpuSize(this._width, this._height, this._depth, this._format, mips, this._cubemap);
  }
  get array() {
    return this._arrayLength > 0;
  }
  get arrayLength() {
    return this._arrayLength;
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
        return this.format === PIXELFORMAT_RGB16F || this.format === PIXELFORMAT_RGB32F || this.format === PIXELFORMAT_RGBA16F || this.format === PIXELFORMAT_RGBA32F || isIntegerPixelFormat(this.format) ? 'linear' : 'srgb';
    }
  }
  dirtyAll() {
    this._levelsUpdated = this._cubemap ? [[true, true, true, true, true, true]] : [true];
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
    this._mipmapsUploaded = false;
    this.propertyChanged(255);
  }
  lock(options = {}) {
    var _options$level, _options$face, _options$mode;
    (_options$level = options.level) != null ? _options$level : options.level = 0;
    (_options$face = options.face) != null ? _options$face : options.face = 0;
    (_options$mode = options.mode) != null ? _options$mode : options.mode = TEXTURELOCK_WRITE;
    this._lockedMode = options.mode;
    this._lockedLevel = options.level;
    const levels = this.cubemap ? this._levels[options.face] : this._levels;
    if (levels[options.level] === null) {
      const width = Math.max(1, this._width >> options.level);
      const height = Math.max(1, this._height >> options.level);
      const depth = Math.max(1, this._depth >> options.level);
      const data = new ArrayBuffer(TextureUtils.calcLevelGpuSize(width, height, depth, this._format));
      levels[options.level] = new (getPixelFormatArrayType(this._format))(data);
    }
    return levels[options.level];
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
    if (this._lockedMode === TEXTURELOCK_NONE) ;
    if (this._lockedMode === TEXTURELOCK_WRITE) {
      this.upload();
    }
    this._lockedLevel = -1;
    this._lockedMode = TEXTURELOCK_NONE;
  }
  upload() {
    var _this$impl$uploadImme, _this$impl;
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
    (_this$impl$uploadImme = (_this$impl = this.impl).uploadImmediate) == null || _this$impl$uploadImme.call(_this$impl, this.device, this);
  }
  async downloadAsync() {
    const promises = [];
    for (let i = 0; i < (this.cubemap ? 6 : 1); i++) {
      var _this$device$readPixe, _this$device;
      const renderTarget = new RenderTarget({
        colorBuffer: this,
        depth: false,
        face: i
      });
      this.device.setRenderTarget(renderTarget);
      this.device.initRenderTarget(renderTarget);
      const levels = this.cubemap ? this._levels[i] : this._levels;
      let level = levels[0];
      if (levels[0] && this.device._isBrowserInterface(levels[0])) {
        levels[0] = null;
      }
      level = this.lock({
        face: i
      });
      const promise = (_this$device$readPixe = (_this$device = this.device).readPixelsAsync) == null ? void 0 : _this$device$readPixe.call(_this$device, 0, 0, this.width, this.height, level).then(() => renderTarget.destroy());
      promises.push(promise);
    }
    await Promise.all(promises);
  }
}

export { Texture };
