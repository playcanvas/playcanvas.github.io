import { Debug } from '../../core/debug.js';
import { TRACEID_TEXTURE_ALLOC, TRACEID_VRAM_TEXTURE } from '../../core/constants.js';
import { math } from '../../core/math/math.js';
import { RenderTarget } from './render-target.js';
import { TextureUtils } from './texture-utils.js';
import { PIXELFORMAT_RGBA8, isCompressedPixelFormat, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_CUBE, TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, TEXTURELOCK_WRITE, getPixelFormatArrayType } from './constants.js';

let id = 0;

/**
 * A texture is a container for texel data that can be utilized in a fragment shader. Typically,
 * the texel data represents an image that is mapped over geometry.
 */
class Texture {
  /**
   * Create a new Texture instance.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
   * used to manage this texture.
   * @param {object} [options] - Object for passing optional arguments.
   * @param {string} [options.name] - The name of the texture. Defaults to null.
   * @param {number} [options.width] - The width of the texture in pixels. Defaults to 4.
   * @param {number} [options.height] - The height of the texture in pixels. Defaults to 4.
   * @param {number} [options.depth] - The number of depth slices in a 3D texture (not supported by WebGl1).
   * Defaults to 1 (single 2D image).
   * @param {number} [options.format] - The pixel format of the texture. Can be:
   *
   * - {@link PIXELFORMAT_A8}
   * - {@link PIXELFORMAT_L8}
   * - {@link PIXELFORMAT_LA8}
   * - {@link PIXELFORMAT_RGB565}
   * - {@link PIXELFORMAT_RGBA5551}
   * - {@link PIXELFORMAT_RGBA4}
   * - {@link PIXELFORMAT_RGB8}
   * - {@link PIXELFORMAT_RGBA8}
   * - {@link PIXELFORMAT_DXT1}
   * - {@link PIXELFORMAT_DXT3}
   * - {@link PIXELFORMAT_DXT5}
   * - {@link PIXELFORMAT_RGB16F}
   * - {@link PIXELFORMAT_RGBA16F}
   * - {@link PIXELFORMAT_RGB32F}
   * - {@link PIXELFORMAT_RGBA32F}
   * - {@link PIXELFORMAT_ETC1}
   * - {@link PIXELFORMAT_PVRTC_2BPP_RGB_1}
   * - {@link PIXELFORMAT_PVRTC_2BPP_RGBA_1}
   * - {@link PIXELFORMAT_PVRTC_4BPP_RGB_1}
   * - {@link PIXELFORMAT_PVRTC_4BPP_RGBA_1}
   * - {@link PIXELFORMAT_111110F}
   * - {@link PIXELFORMAT_ASTC_4x4}
   * - {@link PIXELFORMAT_ATC_RGB}
   * - {@link PIXELFORMAT_ATC_RGBA}
   *
   * Defaults to {@link PIXELFORMAT_RGBA8}.
   * @param {string} [options.projection] - The projection type of the texture, used when the
   * texture represents an environment. Can be:
   *
   * - {@link TEXTUREPROJECTION_NONE}
   * - {@link TEXTUREPROJECTION_CUBE}
   * - {@link TEXTUREPROJECTION_EQUIRECT}
   * - {@link TEXTUREPROJECTION_OCTAHEDRAL}
   *
   * Defaults to {@link TEXTUREPROJECTION_CUBE} if options.cubemap is true, otherwise
   * {@link TEXTUREPROJECTION_NONE}.
   * @param {number} [options.minFilter] - The minification filter type to use. Defaults to
   * {@link FILTER_LINEAR_MIPMAP_LINEAR}.
   * @param {number} [options.magFilter] - The magnification filter type to use. Defaults to
   * {@link FILTER_LINEAR}.
   * @param {number} [options.anisotropy] - The level of anisotropic filtering to use. Defaults
   * to 1.
   * @param {number} [options.addressU] - The repeat mode to use in the U direction. Defaults to
   * {@link ADDRESS_REPEAT}.
   * @param {number} [options.addressV] - The repeat mode to use in the V direction. Defaults to
   * {@link ADDRESS_REPEAT}.
   * @param {number} [options.addressW] - The repeat mode to use in the W direction. Defaults to
   * {@link ADDRESS_REPEAT}.
   * @param {boolean} [options.mipmaps] - When enabled try to generate or use mipmaps for this
   * texture. Default is true.
   * @param {boolean} [options.cubemap] - Specifies whether the texture is to be a cubemap.
   * Defaults to false.
   * @param {boolean} [options.volume] - Specifies whether the texture is to be a 3D volume
   * (not supported by WebGL1). Defaults to false.
   * @param {string} [options.type] - Specifies the texture type.  Can be:
   *
   * - {@link TEXTURETYPE_DEFAULT}
   * - {@link TEXTURETYPE_RGBM}
   * - {@link TEXTURETYPE_RGBE}
   * - {@link TEXTURETYPE_RGBP}
   * - {@link TEXTURETYPE_SWIZZLEGGGR}
   *
   * Defaults to {@link TEXTURETYPE_DEFAULT}.
   * @param {boolean} [options.fixCubemapSeams] - Specifies whether this cubemap texture requires
   * special seam fixing shader code to look right. Defaults to false.
   * @param {boolean} [options.flipY] - Specifies whether the texture should be flipped in the
   * Y-direction. Only affects textures with a source that is an image, canvas or video element.
   * Does not affect cubemaps, compressed textures or textures set from raw pixel data. Defaults
   * to false.
   * @param {boolean} [options.premultiplyAlpha] - If true, the alpha channel of the texture (if
   * present) is multiplied into the color channels. Defaults to false.
   * @param {boolean} [options.compareOnRead] - When enabled, and if texture format is
   * {@link PIXELFORMAT_DEPTH} or {@link PIXELFORMAT_DEPTHSTENCIL}, hardware PCF is enabled for
   * this texture, and you can get filtered results of comparison using texture() in your shader
   * (not supported by WebGL1). Defaults to false.
   * @param {number} [options.compareFunc] - Comparison function when compareOnRead is enabled
   * (not supported by WebGL1). Can be:
   *
   * - {@link FUNC_LESS}
   * - {@link FUNC_LESSEQUAL}
   * - {@link FUNC_GREATER}
   * - {@link FUNC_GREATEREQUAL}
   * - {@link FUNC_EQUAL}
   * - {@link FUNC_NOTEQUAL}
   *
   * Defaults to {@link FUNC_LESS}.
   * @param {Uint8Array[]} [options.levels] - Array of Uint8Array.
   * @example
   * // Create a 8x8x24-bit texture
   * const texture = new pc.Texture(graphicsDevice, {
   *     width: 8,
   *     height: 8,
   *     format: pc.PIXELFORMAT_RGB8
   * });
   *
   * // Fill the texture with a gradient
   * const pixels = texture.lock();
   * const count = 0;
   * for (let i = 0; i < 8; i++) {
   *     for (let j = 0; j < 8; j++) {
   *         pixels[count++] = i * 32;
   *         pixels[count++] = j * 32;
   *         pixels[count++] = 255;
   *     }
   * }
   * texture.unlock();
   */
  constructor(graphicsDevice, options = {}) {
    var _options$name, _options$width, _options$height, _options$format, _options$cubemap, _options$fixCubemapSe, _options$flipY, _options$premultiplyA, _ref, _options$mipmaps, _options$minFilter, _options$magFilter, _options$anisotropy, _options$addressU, _options$addressV, _options$addressW, _options$compareOnRea, _options$compareFunc, _options$profilerHint;
    /**
     * The name of the texture.
     *
     * @type {string}
     */
    this.name = void 0;
    /** @protected */
    this._isRenderTarget = false;
    /** @protected */
    this._gpuSize = 0;
    /** @protected */
    this.id = id++;
    /** @protected */
    this._invalid = false;
    /** @protected */
    this._lockedLevel = -1;
    /**
     * A render version used to track the last time the texture properties requiring bind group
     * to be updated were changed.
     *
     * @type {number}
     * @ignore
     */
    this.renderVersionDirty = 0;
    this.device = graphicsDevice;
    Debug.assert(this.device, "Texture constructor requires a graphicsDevice to be valid");
    this.name = (_options$name = options.name) != null ? _options$name : null;
    this._width = (_options$width = options.width) != null ? _options$width : 4;
    this._height = (_options$height = options.height) != null ? _options$height : 4;
    this._format = (_options$format = options.format) != null ? _options$format : PIXELFORMAT_RGBA8;
    this._compressed = isCompressedPixelFormat(this._format);
    if (graphicsDevice.supportsVolumeTextures) {
      var _options$volume, _options$depth;
      this._volume = (_options$volume = options.volume) != null ? _options$volume : false;
      this._depth = (_options$depth = options.depth) != null ? _options$depth : 1;
    } else {
      this._volume = false;
      this._depth = 1;
    }
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
      Debug.deprecated("options.rgbm is deprecated. Use options.type instead.");
      this.type = options.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
    } else if (options.hasOwnProperty('swizzleGGGR')) {
      Debug.deprecated("options.swizzleGGGR is deprecated. Use options.type instead.");
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

    // track the texture
    graphicsDevice.textures.push(this);
    Debug.trace(TRACEID_TEXTURE_ALLOC, `Alloc: Id ${this.id} ${this.name}: ${this.width}x${this.height} ` + `${this.cubemap ? '[Cubemap]' : ''}` + `${this.volume ? '[Volume]' : ''}` + `${this.mipmaps ? '[Mipmaps]' : ''}`, this);
  }

  /**
   * Frees resources associated with this texture.
   */
  destroy() {
    Debug.trace(TRACEID_TEXTURE_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);
    if (this.device) {
      // stop tracking the texture
      const device = this.device;
      const idx = device.textures.indexOf(this);
      if (idx !== -1) {
        device.textures.splice(idx, 1);
      }

      // Remove texture from any uniforms
      device.scope.removeValue(this);

      // destroy implementation
      this.impl.destroy(device);

      // Update texture stats
      this.adjustVramSizeTracking(device._vram, -this._gpuSize);
      this._levels = null;
      this.device = null;
    }
  }

  /**
   * Called when the rendering context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    this.impl.loseContext();
    this.dirtyAll();
  }

  /**
   * Updates vram size tracking for the texture, size can be positive to add or negative to subtract
   *
   * @ignore
   */
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
  propertyChanged(flag) {
    this.impl.propertyChanged(flag);
    this.renderVersionDirty = this.device.renderVersion;
  }

  /**
   * Returns number of required mip levels for the texture based on its dimensions and parameters.
   *
   * @ignore
   * @type {number}
   */
  get requiredMipLevels() {
    return this.mipmaps ? Math.floor(Math.log2(Math.max(this.width, this.height))) + 1 : 1;
  }

  /**
   * The minification filter to be applied to the texture. Can be:
   *
   * - {@link FILTER_NEAREST}
   * - {@link FILTER_LINEAR}
   * - {@link FILTER_NEAREST_MIPMAP_NEAREST}
   * - {@link FILTER_NEAREST_MIPMAP_LINEAR}
   * - {@link FILTER_LINEAR_MIPMAP_NEAREST}
   * - {@link FILTER_LINEAR_MIPMAP_LINEAR}
   *
   * @type {number}
   */
  set minFilter(v) {
    if (this._minFilter !== v) {
      this._minFilter = v;
      this.propertyChanged(1);
    }
  }
  get minFilter() {
    return this._minFilter;
  }

  /**
   * The magnification filter to be applied to the texture. Can be:
   *
   * - {@link FILTER_NEAREST}
   * - {@link FILTER_LINEAR}
   *
   * @type {number}
   */
  set magFilter(v) {
    if (this._magFilter !== v) {
      this._magFilter = v;
      this.propertyChanged(2);
    }
  }
  get magFilter() {
    return this._magFilter;
  }

  /**
   * The addressing mode to be applied to the texture horizontally. Can be:
   *
   * - {@link ADDRESS_REPEAT}
   * - {@link ADDRESS_CLAMP_TO_EDGE}
   * - {@link ADDRESS_MIRRORED_REPEAT}
   *
   * @type {number}
   */
  set addressU(v) {
    if (this._addressU !== v) {
      this._addressU = v;
      this.propertyChanged(4);
    }
  }
  get addressU() {
    return this._addressU;
  }

  /**
   * The addressing mode to be applied to the texture vertically. Can be:
   *
   * - {@link ADDRESS_REPEAT}
   * - {@link ADDRESS_CLAMP_TO_EDGE}
   * - {@link ADDRESS_MIRRORED_REPEAT}
   *
   * @type {number}
   */
  set addressV(v) {
    if (this._addressV !== v) {
      this._addressV = v;
      this.propertyChanged(8);
    }
  }
  get addressV() {
    return this._addressV;
  }

  /**
   * The addressing mode to be applied to the 3D texture depth (not supported on WebGL1). Can be:
   *
   * - {@link ADDRESS_REPEAT}
   * - {@link ADDRESS_CLAMP_TO_EDGE}
   * - {@link ADDRESS_MIRRORED_REPEAT}
   *
   * @type {number}
   */
  set addressW(addressW) {
    if (!this.device.supportsVolumeTextures) return;
    if (!this._volume) {
      Debug.warn("pc.Texture#addressW: Can't set W addressing mode for a non-3D texture.");
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

  /**
   * When enabled, and if texture format is {@link PIXELFORMAT_DEPTH} or
   * {@link PIXELFORMAT_DEPTHSTENCIL}, hardware PCF is enabled for this texture, and you can get
   * filtered results of comparison using texture() in your shader (not supported on WebGL1).
   *
   * @type {boolean}
   */
  set compareOnRead(v) {
    if (this._compareOnRead !== v) {
      this._compareOnRead = v;
      this.propertyChanged(32);
    }
  }
  get compareOnRead() {
    return this._compareOnRead;
  }

  /**
   * Comparison function when compareOnRead is enabled (not supported on WebGL1). Possible values:
   *
   * - {@link FUNC_LESS}
   * - {@link FUNC_LESSEQUAL}
   * - {@link FUNC_GREATER}
   * - {@link FUNC_GREATEREQUAL}
   * - {@link FUNC_EQUAL}
   * - {@link FUNC_NOTEQUAL}
   *
   * @type {number}
   */
  set compareFunc(v) {
    if (this._compareFunc !== v) {
      this._compareFunc = v;
      this.propertyChanged(64);
    }
  }
  get compareFunc() {
    return this._compareFunc;
  }

  /**
   * Integer value specifying the level of anisotropic to apply to the texture ranging from 1 (no
   * anisotropic filtering) to the {@link GraphicsDevice} property maxAnisotropy.
   *
   * @type {number}
   */
  set anisotropy(v) {
    if (this._anisotropy !== v) {
      this._anisotropy = v;
      this.propertyChanged(128);
    }
  }
  get anisotropy() {
    return this._anisotropy;
  }

  /**
   * Defines if texture should generate/upload mipmaps if possible.
   *
   * @type {boolean}
   */
  set mipmaps(v) {
    if (this._mipmaps !== v) {
      this._mipmaps = v;
      if (this.device.isWebGPU) {
        Debug.warn("Texture#mipmaps: mipmap property is currently not allowed to be changed on WebGPU, create the texture appropriately.", this);
      }
      if (v) this._needsMipmapsUpload = true;
    }
  }
  get mipmaps() {
    return this._mipmaps;
  }

  /**
   * The width of the texture in pixels.
   *
   * @type {number}
   */
  get width() {
    return this._width;
  }

  /**
   * The height of the texture in pixels.
   *
   * @type {number}
   */
  get height() {
    return this._height;
  }

  /**
   * The number of depth slices in a 3D texture.
   *
   * @type {number}
   */
  get depth() {
    return this._depth;
  }

  /**
   * The pixel format of the texture. Can be:
   *
   * - {@link PIXELFORMAT_A8}
   * - {@link PIXELFORMAT_L8}
   * - {@link PIXELFORMAT_LA8}
   * - {@link PIXELFORMAT_RGB565}
   * - {@link PIXELFORMAT_RGBA5551}
   * - {@link PIXELFORMAT_RGBA4}
   * - {@link PIXELFORMAT_RGB8}
   * - {@link PIXELFORMAT_RGBA8}
   * - {@link PIXELFORMAT_DXT1}
   * - {@link PIXELFORMAT_DXT3}
   * - {@link PIXELFORMAT_DXT5}
   * - {@link PIXELFORMAT_RGB16F}
   * - {@link PIXELFORMAT_RGBA16F}
   * - {@link PIXELFORMAT_RGB32F}
   * - {@link PIXELFORMAT_RGBA32F}
   * - {@link PIXELFORMAT_ETC1}
   * - {@link PIXELFORMAT_PVRTC_2BPP_RGB_1}
   * - {@link PIXELFORMAT_PVRTC_2BPP_RGBA_1}
   * - {@link PIXELFORMAT_PVRTC_4BPP_RGB_1}
   * - {@link PIXELFORMAT_PVRTC_4BPP_RGBA_1}
   * - {@link PIXELFORMAT_111110F}
   * - {@link PIXELFORMAT_ASTC_4x4}>/li>
   * - {@link PIXELFORMAT_ATC_RGB}
   * - {@link PIXELFORMAT_ATC_RGBA}
   *
   * @type {number}
   */
  get format() {
    return this._format;
  }

  /**
   * Returns true if this texture is a cube map and false otherwise.
   *
   * @type {boolean}
   */
  get cubemap() {
    return this._cubemap;
  }
  get gpuSize() {
    const mips = this.pot && this._mipmaps && !(this._compressed && this._levels.length === 1);
    return TextureUtils.calcGpuSize(this._width, this._height, this._depth, this._format, mips, this._cubemap);
  }

  /**
   * Returns true if this texture is a 3D volume and false otherwise.
   *
   * @type {boolean}
   */
  get volume() {
    return this._volume;
  }

  /**
   * Specifies whether the texture should be flipped in the Y-direction. Only affects textures
   * with a source that is an image, canvas or video element. Does not affect cubemaps,
   * compressed textures or textures set from raw pixel data. Defaults to true.
   *
   * @type {boolean}
   */
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

  /**
   * Returns true if all dimensions of the texture are power of two, and false otherwise.
   *
   * @type {boolean}
   */
  get pot() {
    return math.powerOfTwo(this._width) && math.powerOfTwo(this._height);
  }

  // get the texture's encoding type
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

  // Force a full resubmission of the texture to the GPU (used on a context restore event)
  dirtyAll() {
    this._levelsUpdated = this._cubemap ? [[true, true, true, true, true, true]] : [true];
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
    this._mipmapsUploaded = false;
    this.propertyChanged(255); // 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128
  }

  /**
   * Locks a miplevel of the texture, returning a typed array to be filled with pixel data.
   *
   * @param {object} [options] - Optional options object. Valid properties are as follows:
   * @param {number} [options.level] - The mip level to lock with 0 being the top level. Defaults
   * to 0.
   * @param {number} [options.face] - If the texture is a cubemap, this is the index of the face
   * to lock.
   * @param {number} [options.mode] - The lock mode. Can be:
   * - {@link TEXTURELOCK_READ}
   * - {@link TEXTURELOCK_WRITE}
   * Defaults to {@link TEXTURELOCK_WRITE}.
   * @returns {Uint8Array|Uint16Array|Float32Array} A typed array containing the pixel data of
   * the locked mip level.
   */
  lock(options = {}) {
    // Initialize options to some sensible defaults
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
    const levels = this.cubemap ? this._levels[options.face] : this._levels;
    if (levels[options.level] === null) {
      // allocate storage for this mip level
      const width = Math.max(1, this._width >> options.level);
      const height = Math.max(1, this._height >> options.level);
      const data = new ArrayBuffer(TextureUtils.calcLevelGpuSize(width, height, this._format));
      levels[options.level] = new (getPixelFormatArrayType(this._format))(data);
    }
    return levels[options.level];
  }

  /**
   * Set the pixel data of the texture from a canvas, image, video DOM element. If the texture is
   * a cubemap, the supplied source must be an array of 6 canvases, images or videos.
   *
   * @param {HTMLCanvasElement|HTMLImageElement|HTMLVideoElement|HTMLCanvasElement[]|HTMLImageElement[]|HTMLVideoElement[]} source - A
   * canvas, image or video element, or an array of 6 canvas, image or video elements.
   * @param {number} [mipLevel] - A non-negative integer specifying the image level of detail.
   * Defaults to 0, which represents the base image source. A level value of N, that is greater
   * than 0, represents the image source for the Nth mipmap reduction level.
   */
  setSource(source, mipLevel = 0) {
    let invalid = false;
    let width, height;
    if (this._cubemap) {
      if (source[0]) {
        // rely on first face sizes
        width = source[0].width || 0;
        height = source[0].height || 0;
        for (let i = 0; i < 6; i++) {
          const face = source[i];
          // cubemap becomes invalid if any condition is not satisfied
          if (!face ||
          // face is missing
          face.width !== width ||
          // face is different width
          face.height !== height ||
          // face is different height
          !this.device._isBrowserInterface(face)) {
            // new image bitmap
            invalid = true;
            break;
          }
        }
      } else {
        // first face is missing
        invalid = true;
      }
      if (!invalid) {
        // mark levels as updated
        for (let i = 0; i < 6; i++) {
          if (this._levels[mipLevel][i] !== source[i]) this._levelsUpdated[mipLevel][i] = true;
        }
      }
    } else {
      // check if source is valid type of element
      if (!this.device._isBrowserInterface(source)) invalid = true;
      if (!invalid) {
        // mark level as updated
        if (source !== this._levels[mipLevel]) this._levelsUpdated[mipLevel] = true;
        width = source.width;
        height = source.height;
      }
    }
    if (invalid) {
      // invalid texture

      // default sizes
      this._width = 4;
      this._height = 4;

      // remove levels
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
      // valid texture
      if (mipLevel === 0) {
        this._width = width;
        this._height = height;
      }
      this._levels[mipLevel] = source;
    }

    // valid or changed state of validity
    if (this._invalid !== invalid || !invalid) {
      this._invalid = invalid;

      // reupload
      this.upload();
    }
  }

  /**
   * Get the pixel data of the texture. If this is a cubemap then an array of 6 images will be
   * returned otherwise a single image.
   *
   * @param {number} [mipLevel] - A non-negative integer specifying the image level of detail.
   * Defaults to 0, which represents the base image source. A level value of N, that is greater
   * than 0, represents the image source for the Nth mipmap reduction level.
   * @returns {HTMLImageElement} The source image of this texture. Can be null if source not
   * assigned for specific image level.
   */
  getSource(mipLevel = 0) {
    return this._levels[mipLevel];
  }

  /**
   * Unlocks the currently locked mip level and uploads it to VRAM.
   */
  unlock() {
    if (this._lockedLevel === -1) {
      Debug.log("pc.Texture#unlock: Attempting to unlock a texture that is not locked.", this);
    }

    // Upload the new pixel data
    this.upload();
    this._lockedLevel = -1;
  }

  /**
   * Forces a reupload of the textures pixel data to graphics memory. Ordinarily, this function
   * is called by internally by {@link Texture#setSource} and {@link Texture#unlock}. However, it
   * still needs to be called explicitly in the case where an HTMLVideoElement is set as the
   * source of the texture.  Normally, this is done once every frame before video textured
   * geometry is rendered.
   */
  upload() {
    var _this$impl$uploadImme, _this$impl;
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
    (_this$impl$uploadImme = (_this$impl = this.impl).uploadImmediate) == null ? void 0 : _this$impl$uploadImme.call(_this$impl, this.device, this);
  }

  /**
   * Download texture's top level data from graphics memory to local memory.
   *
   * @ignore
   */
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

  /**
   * Generate an in-memory DDS representation of this texture. Only works on RGBA8 textures.
   * Currently, only used by the Editor to write prefiltered cubemaps to DDS format.
   *
   * @returns {ArrayBuffer} Buffer containing the DDS data.
   * @ignore
   */
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
    const DDS_MAGIC = 542327876; // "DDS"
    const DDS_HEADER_SIZE = 124;
    const DDS_FLAGS_REQUIRED = 0x01 | 0x02 | 0x04 | 0x1000 | 0x80000; // caps | height | width | pixelformat | linearsize
    const DDS_FLAGS_MIPMAP = 0x20000;
    const DDS_PIXELFORMAT_SIZE = 32;
    const DDS_PIXELFLAGS_RGBA8 = 0x01 | 0x40; // alpha | rgb
    const DDS_CAPS_REQUIRED = 0x1000;
    const DDS_CAPS_MIPMAP = 0x400000;
    const DDS_CAPS_COMPLEX = 0x8;
    const DDS_CAPS2_CUBEMAP = 0x200 | 0x400 | 0x800 | 0x1000 | 0x2000 | 0x4000 | 0x8000; // cubemap | all faces

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
    header[6] = 0; // depth
    header[7] = this._levels.length;
    for (let i = 0; i < 11; i++) {
      header[8 + i] = 0;
    }
    header[19] = DDS_PIXELFORMAT_SIZE;
    header[20] = DDS_PIXELFLAGS_RGBA8;
    header[21] = 0; // fourcc
    header[22] = 32; // bpp
    header[23] = 0x00FF0000; // R mask
    header[24] = 0x0000FF00; // G mask
    header[25] = 0x000000FF; // B mask
    header[26] = 0xFF000000; // A mask
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVEVYVFVSRV9BTExPQywgVFJBQ0VJRF9WUkFNX1RFWFRVUkUgfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZVV0aWxzIH0gZnJvbSAnLi90ZXh0dXJlLXV0aWxzLmpzJztcbmltcG9ydCB7XG4gICAgaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQsXG4gICAgZ2V0UGl4ZWxGb3JtYXRBcnJheVR5cGUsXG4gICAgQUREUkVTU19SRVBFQVQsXG4gICAgRklMVEVSX0xJTkVBUiwgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSLFxuICAgIEZVTkNfTEVTUyxcbiAgICBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICBQSVhFTEZPUk1BVF9SR0IxNkYsIFBJWEVMRk9STUFUX1JHQkExNkYsIFBJWEVMRk9STUFUX1JHQjMyRiwgUElYRUxGT1JNQVRfUkdCQTMyRixcbiAgICBURVhISU5UX1NIQURPV01BUCwgVEVYSElOVF9BU1NFVCwgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9OT05FLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFLFxuICAgIFRFWFRVUkVUWVBFX0RFRkFVTFQsIFRFWFRVUkVUWVBFX1JHQk0sIFRFWFRVUkVUWVBFX1JHQkUsIFRFWFRVUkVUWVBFX1JHQlAsIFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIHRleHR1cmUgaXMgYSBjb250YWluZXIgZm9yIHRleGVsIGRhdGEgdGhhdCBjYW4gYmUgdXRpbGl6ZWQgaW4gYSBmcmFnbWVudCBzaGFkZXIuIFR5cGljYWxseSxcbiAqIHRoZSB0ZXhlbCBkYXRhIHJlcHJlc2VudHMgYW4gaW1hZ2UgdGhhdCBpcyBtYXBwZWQgb3ZlciBnZW9tZXRyeS5cbiAqL1xuY2xhc3MgVGV4dHVyZSB7XG4gICAgLyoqXG4gICAgICogVGhlIG5hbWUgb2YgdGhlIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIG5hbWU7XG5cbiAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgIF9pc1JlbmRlclRhcmdldCA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcm90ZWN0ZWQgKi9cbiAgICBfZ3B1U2l6ZSA9IDA7XG5cbiAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgIGlkID0gaWQrKztcblxuICAgIC8qKiBAcHJvdGVjdGVkICovXG4gICAgX2ludmFsaWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJvdGVjdGVkICovXG4gICAgX2xvY2tlZExldmVsID0gLTE7XG5cbiAgICAvKipcbiAgICAgKiBBIHJlbmRlciB2ZXJzaW9uIHVzZWQgdG8gdHJhY2sgdGhlIGxhc3QgdGltZSB0aGUgdGV4dHVyZSBwcm9wZXJ0aWVzIHJlcXVpcmluZyBiaW5kIGdyb3VwXG4gICAgICogdG8gYmUgdXBkYXRlZCB3ZXJlIGNoYW5nZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZW5kZXJWZXJzaW9uRGlydHkgPSAwO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFRleHR1cmUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlXG4gICAgICogdXNlZCB0byBtYW5hZ2UgdGhpcyB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPYmplY3QgZm9yIHBhc3Npbmcgb3B0aW9uYWwgYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5uYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSB0ZXh0dXJlLiBEZWZhdWx0cyB0byBudWxsLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy53aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLiBEZWZhdWx0cyB0byA0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5oZWlnaHRdIC0gVGhlIGhlaWdodCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuIERlZmF1bHRzIHRvIDQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmRlcHRoXSAtIFRoZSBudW1iZXIgb2YgZGVwdGggc2xpY2VzIGluIGEgM0QgdGV4dHVyZSAobm90IHN1cHBvcnRlZCBieSBXZWJHbDEpLlxuICAgICAqIERlZmF1bHRzIHRvIDEgKHNpbmdsZSAyRCBpbWFnZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZvcm1hdF0gLSBUaGUgcGl4ZWwgZm9ybWF0IG9mIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCNTY1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE1NTUxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE0fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQzfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDV9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkExNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkEzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRVRDMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfMTExMTEwRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BU1RDXzR4NH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0JBfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE4fS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMucHJvamVjdGlvbl0gLSBUaGUgcHJvamVjdGlvbiB0eXBlIG9mIHRoZSB0ZXh0dXJlLCB1c2VkIHdoZW4gdGhlXG4gICAgICogdGV4dHVyZSByZXByZXNlbnRzIGFuIGVudmlyb25tZW50LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9OT05FfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkV9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fRVFVSVJFQ1R9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTH1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9DVUJFfSBpZiBvcHRpb25zLmN1YmVtYXAgaXMgdHJ1ZSwgb3RoZXJ3aXNlXG4gICAgICoge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX05PTkV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5GaWx0ZXJdIC0gVGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1hZ0ZpbHRlcl0gLSBUaGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hbmlzb3Ryb3B5XSAtIFRoZSBsZXZlbCBvZiBhbmlzb3Ryb3BpYyBmaWx0ZXJpbmcgdG8gdXNlLiBEZWZhdWx0c1xuICAgICAqIHRvIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NVXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFUgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NWXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFYgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NXXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFcgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5taXBtYXBzXSAtIFdoZW4gZW5hYmxlZCB0cnkgdG8gZ2VuZXJhdGUgb3IgdXNlIG1pcG1hcHMgZm9yIHRoaXNcbiAgICAgKiB0ZXh0dXJlLiBEZWZhdWx0IGlzIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jdWJlbWFwXSAtIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIGlzIHRvIGJlIGEgY3ViZW1hcC5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnZvbHVtZV0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBpcyB0byBiZSBhIDNEIHZvbHVtZVxuICAgICAqIChub3Qgc3VwcG9ydGVkIGJ5IFdlYkdMMSkuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy50eXBlXSAtIFNwZWNpZmllcyB0aGUgdGV4dHVyZSB0eXBlLiAgQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVRZUEVfREVGQVVMVH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFVFlQRV9SR0JNfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVUWVBFX1JHQkV9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVRZUEVfUkdCUH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFVFlQRV9TV0laWkxFR0dHUn1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBURVhUVVJFVFlQRV9ERUZBVUxUfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZpeEN1YmVtYXBTZWFtc10gLSBTcGVjaWZpZXMgd2hldGhlciB0aGlzIGN1YmVtYXAgdGV4dHVyZSByZXF1aXJlc1xuICAgICAqIHNwZWNpYWwgc2VhbSBmaXhpbmcgc2hhZGVyIGNvZGUgdG8gbG9vayByaWdodC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mbGlwWV0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBzaG91bGQgYmUgZmxpcHBlZCBpbiB0aGVcbiAgICAgKiBZLWRpcmVjdGlvbi4gT25seSBhZmZlY3RzIHRleHR1cmVzIHdpdGggYSBzb3VyY2UgdGhhdCBpcyBhbiBpbWFnZSwgY2FudmFzIG9yIHZpZGVvIGVsZW1lbnQuXG4gICAgICogRG9lcyBub3QgYWZmZWN0IGN1YmVtYXBzLCBjb21wcmVzc2VkIHRleHR1cmVzIG9yIHRleHR1cmVzIHNldCBmcm9tIHJhdyBwaXhlbCBkYXRhLiBEZWZhdWx0c1xuICAgICAqIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlbXVsdGlwbHlBbHBoYV0gLSBJZiB0cnVlLCB0aGUgYWxwaGEgY2hhbm5lbCBvZiB0aGUgdGV4dHVyZSAoaWZcbiAgICAgKiBwcmVzZW50KSBpcyBtdWx0aXBsaWVkIGludG8gdGhlIGNvbG9yIGNoYW5uZWxzLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNvbXBhcmVPblJlYWRdIC0gV2hlbiBlbmFibGVkLCBhbmQgaWYgdGV4dHVyZSBmb3JtYXQgaXNcbiAgICAgKiB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEh9IG9yIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUx9LCBoYXJkd2FyZSBQQ0YgaXMgZW5hYmxlZCBmb3JcbiAgICAgKiB0aGlzIHRleHR1cmUsIGFuZCB5b3UgY2FuIGdldCBmaWx0ZXJlZCByZXN1bHRzIG9mIGNvbXBhcmlzb24gdXNpbmcgdGV4dHVyZSgpIGluIHlvdXIgc2hhZGVyXG4gICAgICogKG5vdCBzdXBwb3J0ZWQgYnkgV2ViR0wxKS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmNvbXBhcmVGdW5jXSAtIENvbXBhcmlzb24gZnVuY3Rpb24gd2hlbiBjb21wYXJlT25SZWFkIGlzIGVuYWJsZWRcbiAgICAgKiAobm90IHN1cHBvcnRlZCBieSBXZWJHTDEpLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBGVU5DX0xFU1N9LlxuICAgICAqIEBwYXJhbSB7VWludDhBcnJheVtdfSBbb3B0aW9ucy5sZXZlbHNdIC0gQXJyYXkgb2YgVWludDhBcnJheS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDh4OHgyNC1iaXQgdGV4dHVyZVxuICAgICAqIGNvbnN0IHRleHR1cmUgPSBuZXcgcGMuVGV4dHVyZShncmFwaGljc0RldmljZSwge1xuICAgICAqICAgICB3aWR0aDogOCxcbiAgICAgKiAgICAgaGVpZ2h0OiA4LFxuICAgICAqICAgICBmb3JtYXQ6IHBjLlBJWEVMRk9STUFUX1JHQjhcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIEZpbGwgdGhlIHRleHR1cmUgd2l0aCBhIGdyYWRpZW50XG4gICAgICogY29uc3QgcGl4ZWxzID0gdGV4dHVyZS5sb2NrKCk7XG4gICAgICogY29uc3QgY291bnQgPSAwO1xuICAgICAqIGZvciAobGV0IGkgPSAwOyBpIDwgODsgaSsrKSB7XG4gICAgICogICAgIGZvciAobGV0IGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICogICAgICAgICBwaXhlbHNbY291bnQrK10gPSBpICogMzI7XG4gICAgICogICAgICAgICBwaXhlbHNbY291bnQrK10gPSBqICogMzI7XG4gICAgICogICAgICAgICBwaXhlbHNbY291bnQrK10gPSAyNTU7XG4gICAgICogICAgIH1cbiAgICAgKiB9XG4gICAgICogdGV4dHVyZS51bmxvY2soKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmRldmljZSwgXCJUZXh0dXJlIGNvbnN0cnVjdG9yIHJlcXVpcmVzIGEgZ3JhcGhpY3NEZXZpY2UgdG8gYmUgdmFsaWRcIik7XG5cbiAgICAgICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lID8/IG51bGw7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSBvcHRpb25zLndpZHRoID8/IDQ7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IG9wdGlvbnMuaGVpZ2h0ID8/IDQ7XG5cbiAgICAgICAgdGhpcy5fZm9ybWF0ID0gb3B0aW9ucy5mb3JtYXQgPz8gUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgICAgIHRoaXMuX2NvbXByZXNzZWQgPSBpc0NvbXByZXNzZWRQaXhlbEZvcm1hdCh0aGlzLl9mb3JtYXQpO1xuXG4gICAgICAgIGlmIChncmFwaGljc0RldmljZS5zdXBwb3J0c1ZvbHVtZVRleHR1cmVzKSB7XG4gICAgICAgICAgICB0aGlzLl92b2x1bWUgPSBvcHRpb25zLnZvbHVtZSA/PyBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2RlcHRoID0gb3B0aW9ucy5kZXB0aCA/PyAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdm9sdW1lID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9kZXB0aCA9IDE7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jdWJlbWFwID0gb3B0aW9ucy5jdWJlbWFwID8/IGZhbHNlO1xuICAgICAgICB0aGlzLmZpeEN1YmVtYXBTZWFtcyA9IG9wdGlvbnMuZml4Q3ViZW1hcFNlYW1zID8/IGZhbHNlO1xuICAgICAgICB0aGlzLl9mbGlwWSA9IG9wdGlvbnMuZmxpcFkgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgPSBvcHRpb25zLnByZW11bHRpcGx5QWxwaGEgPz8gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbWlwbWFwcyA9IG9wdGlvbnMubWlwbWFwcyA/PyBvcHRpb25zLmF1dG9NaXBtYXAgPz8gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbWluRmlsdGVyID0gb3B0aW9ucy5taW5GaWx0ZXIgPz8gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSO1xuICAgICAgICB0aGlzLl9tYWdGaWx0ZXIgPSBvcHRpb25zLm1hZ0ZpbHRlciA/PyBGSUxURVJfTElORUFSO1xuICAgICAgICB0aGlzLl9hbmlzb3Ryb3B5ID0gb3B0aW9ucy5hbmlzb3Ryb3B5ID8/IDE7XG4gICAgICAgIHRoaXMuX2FkZHJlc3NVID0gb3B0aW9ucy5hZGRyZXNzVSA/PyBBRERSRVNTX1JFUEVBVDtcbiAgICAgICAgdGhpcy5fYWRkcmVzc1YgPSBvcHRpb25zLmFkZHJlc3NWID8/IEFERFJFU1NfUkVQRUFUO1xuICAgICAgICB0aGlzLl9hZGRyZXNzVyA9IG9wdGlvbnMuYWRkcmVzc1cgPz8gQUREUkVTU19SRVBFQVQ7XG5cbiAgICAgICAgdGhpcy5fY29tcGFyZU9uUmVhZCA9IG9wdGlvbnMuY29tcGFyZU9uUmVhZCA/PyBmYWxzZTtcbiAgICAgICAgdGhpcy5fY29tcGFyZUZ1bmMgPSBvcHRpb25zLmNvbXBhcmVGdW5jID8/IEZVTkNfTEVTUztcblxuICAgICAgICB0aGlzLnR5cGUgPSBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgndHlwZScpKSB7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnR5cGU7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgncmdibScpKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKFwib3B0aW9ucy5yZ2JtIGlzIGRlcHJlY2F0ZWQuIFVzZSBvcHRpb25zLnR5cGUgaW5zdGVhZC5cIik7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnJnYm0gPyBURVhUVVJFVFlQRV9SR0JNIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCdzd2l6emxlR0dHUicpKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKFwib3B0aW9ucy5zd2l6emxlR0dHUiBpcyBkZXByZWNhdGVkLiBVc2Ugb3B0aW9ucy50eXBlIGluc3RlYWQuXCIpO1xuICAgICAgICAgICAgdGhpcy50eXBlID0gb3B0aW9ucy5zd2l6emxlR0dHUiA/IFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucHJvamVjdGlvbiA9IFRFWFRVUkVQUk9KRUNUSU9OX05PTkU7XG4gICAgICAgIGlmICh0aGlzLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBURVhUVVJFUFJPSkVDVElPTl9DVUJFO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMucHJvamVjdGlvbiAmJiBvcHRpb25zLnByb2plY3Rpb24gIT09IFRFWFRVUkVQUk9KRUNUSU9OX0NVQkUpIHtcbiAgICAgICAgICAgIHRoaXMucHJvamVjdGlvbiA9IG9wdGlvbnMucHJvamVjdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaW1wbCA9IGdyYXBoaWNzRGV2aWNlLmNyZWF0ZVRleHR1cmVJbXBsKHRoaXMpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5wcm9maWxlckhpbnQgPSBvcHRpb25zLnByb2ZpbGVySGludCA/PyAwO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0aGlzLmRpcnR5QWxsKCk7XG5cbiAgICAgICAgdGhpcy5fbGV2ZWxzID0gb3B0aW9ucy5sZXZlbHM7XG4gICAgICAgIGlmICh0aGlzLl9sZXZlbHMpIHtcbiAgICAgICAgICAgIHRoaXMudXBsb2FkKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9sZXZlbHMgPSB0aGlzLl9jdWJlbWFwID8gW1tudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXV0gOiBbbnVsbF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0cmFjayB0aGUgdGV4dHVyZVxuICAgICAgICBncmFwaGljc0RldmljZS50ZXh0dXJlcy5wdXNoKHRoaXMpO1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfVEVYVFVSRV9BTExPQywgYEFsbG9jOiBJZCAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfTogJHt0aGlzLndpZHRofXgke3RoaXMuaGVpZ2h0fSBgICtcbiAgICAgICAgICAgIGAke3RoaXMuY3ViZW1hcCA/ICdbQ3ViZW1hcF0nIDogJyd9YCArXG4gICAgICAgICAgICBgJHt0aGlzLnZvbHVtZSA/ICdbVm9sdW1lXScgOiAnJ31gICtcbiAgICAgICAgICAgIGAke3RoaXMubWlwbWFwcyA/ICdbTWlwbWFwc10nIDogJyd9YCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHRleHR1cmUuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1RFWFRVUkVfQUxMT0MsIGBEZUFsbG9jOiBJZCAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfWApO1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZSkge1xuICAgICAgICAgICAgLy8gc3RvcCB0cmFja2luZyB0aGUgdGV4dHVyZVxuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgICAgICBjb25zdCBpZHggPSBkZXZpY2UudGV4dHVyZXMuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnRleHR1cmVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZW1vdmUgdGV4dHVyZSBmcm9tIGFueSB1bmlmb3Jtc1xuICAgICAgICAgICAgZGV2aWNlLnNjb3BlLnJlbW92ZVZhbHVlKHRoaXMpO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IGltcGxlbWVudGF0aW9uXG4gICAgICAgICAgICB0aGlzLmltcGwuZGVzdHJveShkZXZpY2UpO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgdGV4dHVyZSBzdGF0c1xuICAgICAgICAgICAgdGhpcy5hZGp1c3RWcmFtU2l6ZVRyYWNraW5nKGRldmljZS5fdnJhbSwgLXRoaXMuX2dwdVNpemUpO1xuXG4gICAgICAgICAgICB0aGlzLl9sZXZlbHMgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5kZXZpY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIHJlbmRlcmluZyBjb250ZXh0IHdhcyBsb3N0LiBJdCByZWxlYXNlcyBhbGwgY29udGV4dCByZWxhdGVkIHJlc291cmNlcy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbXBsLmxvc2VDb250ZXh0KCk7XG4gICAgICAgIHRoaXMuZGlydHlBbGwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHZyYW0gc2l6ZSB0cmFja2luZyBmb3IgdGhlIHRleHR1cmUsIHNpemUgY2FuIGJlIHBvc2l0aXZlIHRvIGFkZCBvciBuZWdhdGl2ZSB0byBzdWJ0cmFjdFxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFkanVzdFZyYW1TaXplVHJhY2tpbmcodnJhbSwgc2l6ZSkge1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfVlJBTV9URVhUVVJFLCBgJHt0aGlzLmlkfSAke3RoaXMubmFtZX0gc2l6ZTogJHtzaXplfSB2cmFtLnRleHR1cmU6ICR7dnJhbS50ZXh9ID0+ICR7dnJhbS50ZXggKyBzaXplfWApO1xuXG4gICAgICAgIHZyYW0udGV4ICs9IHNpemU7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBpZiAodGhpcy5wcm9maWxlckhpbnQgPT09IFRFWEhJTlRfU0hBRE9XTUFQKSB7XG4gICAgICAgICAgICB2cmFtLnRleFNoYWRvdyArPSBzaXplO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucHJvZmlsZXJIaW50ID09PSBURVhISU5UX0FTU0VUKSB7XG4gICAgICAgICAgICB2cmFtLnRleEFzc2V0ICs9IHNpemU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wcm9maWxlckhpbnQgPT09IFRFWEhJTlRfTElHSFRNQVApIHtcbiAgICAgICAgICAgIHZyYW0udGV4TGlnaHRtYXAgKz0gc2l6ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBwcm9wZXJ0eUNoYW5nZWQoZmxhZykge1xuICAgICAgICB0aGlzLmltcGwucHJvcGVydHlDaGFuZ2VkKGZsYWcpO1xuICAgICAgICB0aGlzLnJlbmRlclZlcnNpb25EaXJ0eSA9IHRoaXMuZGV2aWNlLnJlbmRlclZlcnNpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBudW1iZXIgb2YgcmVxdWlyZWQgbWlwIGxldmVscyBmb3IgdGhlIHRleHR1cmUgYmFzZWQgb24gaXRzIGRpbWVuc2lvbnMgYW5kIHBhcmFtZXRlcnMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgcmVxdWlyZWRNaXBMZXZlbHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1pcG1hcHMgPyBNYXRoLmZsb29yKE1hdGgubG9nMihNYXRoLm1heCh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCkpKSArIDEgOiAxO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtaW5pZmljYXRpb24gZmlsdGVyIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1R9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUn1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1pbkZpbHRlcih2KSB7XG4gICAgICAgIGlmICh0aGlzLl9taW5GaWx0ZXIgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX21pbkZpbHRlciA9IHY7XG4gICAgICAgICAgICB0aGlzLnByb3BlcnR5Q2hhbmdlZCgxKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaW5GaWx0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9taW5GaWx0ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hZ25pZmljYXRpb24gZmlsdGVyIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJ9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYWdGaWx0ZXIodikge1xuICAgICAgICBpZiAodGhpcy5fbWFnRmlsdGVyICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9tYWdGaWx0ZXIgPSB2O1xuICAgICAgICAgICAgdGhpcy5wcm9wZXJ0eUNoYW5nZWQoMik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFnRmlsdGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWFnRmlsdGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhZGRyZXNzaW5nIG1vZGUgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZSBob3Jpem9udGFsbHkuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfUkVQRUFUfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfQ0xBTVBfVE9fRURHRX1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX01JUlJPUkVEX1JFUEVBVH1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFkZHJlc3NVKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FkZHJlc3NVICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzVSA9IHY7XG4gICAgICAgICAgICB0aGlzLnByb3BlcnR5Q2hhbmdlZCg0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhZGRyZXNzVSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZHJlc3NVO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhZGRyZXNzaW5nIG1vZGUgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZSB2ZXJ0aWNhbGx5LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBBRERSRVNTX1JFUEVBVH1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX0NMQU1QX1RPX0VER0V9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19NSVJST1JFRF9SRVBFQVR9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhZGRyZXNzVih2KSB7XG4gICAgICAgIGlmICh0aGlzLl9hZGRyZXNzViAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1YgPSB2O1xuICAgICAgICAgICAgdGhpcy5wcm9wZXJ0eUNoYW5nZWQoOCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWRkcmVzc1YoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRyZXNzVjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWRkcmVzc2luZyBtb2RlIHRvIGJlIGFwcGxpZWQgdG8gdGhlIDNEIHRleHR1cmUgZGVwdGggKG5vdCBzdXBwb3J0ZWQgb24gV2ViR0wxKS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQUREUkVTU19SRVBFQVR9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19DTEFNUF9UT19FREdFfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYWRkcmVzc1coYWRkcmVzc1cpIHtcbiAgICAgICAgaWYgKCF0aGlzLmRldmljZS5zdXBwb3J0c1ZvbHVtZVRleHR1cmVzKSByZXR1cm47XG4gICAgICAgIGlmICghdGhpcy5fdm9sdW1lKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKFwicGMuVGV4dHVyZSNhZGRyZXNzVzogQ2FuJ3Qgc2V0IFcgYWRkcmVzc2luZyBtb2RlIGZvciBhIG5vbi0zRCB0ZXh0dXJlLlwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYWRkcmVzc1cgIT09IHRoaXMuX2FkZHJlc3NXKSB7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzVyA9IGFkZHJlc3NXO1xuICAgICAgICAgICAgdGhpcy5wcm9wZXJ0eUNoYW5nZWQoMTYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFkZHJlc3NXKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkcmVzc1c7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2hlbiBlbmFibGVkLCBhbmQgaWYgdGV4dHVyZSBmb3JtYXQgaXMge0BsaW5rIFBJWEVMRk9STUFUX0RFUFRIfSBvclxuICAgICAqIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUx9LCBoYXJkd2FyZSBQQ0YgaXMgZW5hYmxlZCBmb3IgdGhpcyB0ZXh0dXJlLCBhbmQgeW91IGNhbiBnZXRcbiAgICAgKiBmaWx0ZXJlZCByZXN1bHRzIG9mIGNvbXBhcmlzb24gdXNpbmcgdGV4dHVyZSgpIGluIHlvdXIgc2hhZGVyIChub3Qgc3VwcG9ydGVkIG9uIFdlYkdMMSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY29tcGFyZU9uUmVhZCh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9jb21wYXJlT25SZWFkICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlT25SZWFkID0gdjtcbiAgICAgICAgICAgIHRoaXMucHJvcGVydHlDaGFuZ2VkKDMyKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjb21wYXJlT25SZWFkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29tcGFyZU9uUmVhZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb21wYXJpc29uIGZ1bmN0aW9uIHdoZW4gY29tcGFyZU9uUmVhZCBpcyBlbmFibGVkIChub3Qgc3VwcG9ydGVkIG9uIFdlYkdMMSkuIFBvc3NpYmxlIHZhbHVlczpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU31cbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgY29tcGFyZUZ1bmModikge1xuICAgICAgICBpZiAodGhpcy5fY29tcGFyZUZ1bmMgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBhcmVGdW5jID0gdjtcbiAgICAgICAgICAgIHRoaXMucHJvcGVydHlDaGFuZ2VkKDY0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjb21wYXJlRnVuYygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhcmVGdW5jO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEludGVnZXIgdmFsdWUgc3BlY2lmeWluZyB0aGUgbGV2ZWwgb2YgYW5pc290cm9waWMgdG8gYXBwbHkgdG8gdGhlIHRleHR1cmUgcmFuZ2luZyBmcm9tIDEgKG5vXG4gICAgICogYW5pc290cm9waWMgZmlsdGVyaW5nKSB0byB0aGUge0BsaW5rIEdyYXBoaWNzRGV2aWNlfSBwcm9wZXJ0eSBtYXhBbmlzb3Ryb3B5LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYW5pc290cm9weSh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9hbmlzb3Ryb3B5ICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9hbmlzb3Ryb3B5ID0gdjtcbiAgICAgICAgICAgIHRoaXMucHJvcGVydHlDaGFuZ2VkKDEyOCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5pc290cm9weSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaXNvdHJvcHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyBpZiB0ZXh0dXJlIHNob3VsZCBnZW5lcmF0ZS91cGxvYWQgbWlwbWFwcyBpZiBwb3NzaWJsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBtaXBtYXBzKHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX21pcG1hcHMgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX21pcG1hcHMgPSB2O1xuXG4gICAgICAgICAgICBpZiAodGhpcy5kZXZpY2UuaXNXZWJHUFUpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuKFwiVGV4dHVyZSNtaXBtYXBzOiBtaXBtYXAgcHJvcGVydHkgaXMgY3VycmVudGx5IG5vdCBhbGxvd2VkIHRvIGJlIGNoYW5nZWQgb24gV2ViR1BVLCBjcmVhdGUgdGhlIHRleHR1cmUgYXBwcm9wcmlhdGVseS5cIiwgdGhpcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2KSB0aGlzLl9uZWVkc01pcG1hcHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1pcG1hcHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9taXBtYXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBudW1iZXIgb2YgZGVwdGggc2xpY2VzIGluIGEgM0QgdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGRlcHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVwdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHBpeGVsIGZvcm1hdCBvZiB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTDh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTEE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjU2NX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNTU1MX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0I4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUM31cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQ1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjE2Rn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjMyRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0VUQzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUXzExMTExMEZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVNUQ180eDR9Pi9saT5cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0JBfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZm9ybWF0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZm9ybWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGlzIHRleHR1cmUgaXMgYSBjdWJlIG1hcCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGN1YmVtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdWJlbWFwO1xuICAgIH1cblxuICAgIGdldCBncHVTaXplKCkge1xuICAgICAgICBjb25zdCBtaXBzID0gdGhpcy5wb3QgJiYgdGhpcy5fbWlwbWFwcyAmJiAhKHRoaXMuX2NvbXByZXNzZWQgJiYgdGhpcy5fbGV2ZWxzLmxlbmd0aCA9PT0gMSk7XG4gICAgICAgIHJldHVybiBUZXh0dXJlVXRpbHMuY2FsY0dwdVNpemUodGhpcy5fd2lkdGgsIHRoaXMuX2hlaWdodCwgdGhpcy5fZGVwdGgsIHRoaXMuX2Zvcm1hdCwgbWlwcywgdGhpcy5fY3ViZW1hcCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoaXMgdGV4dHVyZSBpcyBhIDNEIHZvbHVtZSBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHZvbHVtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZvbHVtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBzaG91bGQgYmUgZmxpcHBlZCBpbiB0aGUgWS1kaXJlY3Rpb24uIE9ubHkgYWZmZWN0cyB0ZXh0dXJlc1xuICAgICAqIHdpdGggYSBzb3VyY2UgdGhhdCBpcyBhbiBpbWFnZSwgY2FudmFzIG9yIHZpZGVvIGVsZW1lbnQuIERvZXMgbm90IGFmZmVjdCBjdWJlbWFwcyxcbiAgICAgKiBjb21wcmVzc2VkIHRleHR1cmVzIG9yIHRleHR1cmVzIHNldCBmcm9tIHJhdyBwaXhlbCBkYXRhLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZsaXBZKGZsaXBZKSB7XG4gICAgICAgIGlmICh0aGlzLl9mbGlwWSAhPT0gZmxpcFkpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZsaXBZID0gZmxpcFk7XG4gICAgICAgICAgICB0aGlzLl9uZWVkc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZmxpcFkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwWTtcbiAgICB9XG5cbiAgICBzZXQgcHJlbXVsdGlwbHlBbHBoYShwcmVtdWx0aXBseUFscGhhKSB7XG4gICAgICAgIGlmICh0aGlzLl9wcmVtdWx0aXBseUFscGhhICE9PSBwcmVtdWx0aXBseUFscGhhKSB7XG4gICAgICAgICAgICB0aGlzLl9wcmVtdWx0aXBseUFscGhhID0gcHJlbXVsdGlwbHlBbHBoYTtcbiAgICAgICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwcmVtdWx0aXBseUFscGhhKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJlbXVsdGlwbHlBbHBoYTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgYWxsIGRpbWVuc2lvbnMgb2YgdGhlIHRleHR1cmUgYXJlIHBvd2VyIG9mIHR3bywgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBwb3QoKSB7XG4gICAgICAgIHJldHVybiBtYXRoLnBvd2VyT2ZUd28odGhpcy5fd2lkdGgpICYmIG1hdGgucG93ZXJPZlR3byh0aGlzLl9oZWlnaHQpO1xuICAgIH1cblxuICAgIC8vIGdldCB0aGUgdGV4dHVyZSdzIGVuY29kaW5nIHR5cGVcbiAgICBnZXQgZW5jb2RpbmcoKSB7XG4gICAgICAgIHN3aXRjaCAodGhpcy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFRFWFRVUkVUWVBFX1JHQk06XG4gICAgICAgICAgICAgICAgcmV0dXJuICdyZ2JtJztcbiAgICAgICAgICAgIGNhc2UgVEVYVFVSRVRZUEVfUkdCRTpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JnYmUnO1xuICAgICAgICAgICAgY2FzZSBURVhUVVJFVFlQRV9SR0JQOlxuICAgICAgICAgICAgICAgIHJldHVybiAncmdicCc7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHJldHVybiAodGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQjE2RiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQjMyRiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkExNkYgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMzJGKSA/ICdsaW5lYXInIDogJ3NyZ2InO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gRm9yY2UgYSBmdWxsIHJlc3VibWlzc2lvbiBvZiB0aGUgdGV4dHVyZSB0byB0aGUgR1BVICh1c2VkIG9uIGEgY29udGV4dCByZXN0b3JlIGV2ZW50KVxuICAgIGRpcnR5QWxsKCkge1xuICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkID0gdGhpcy5fY3ViZW1hcCA/IFtbdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZV1dIDogW3RydWVdO1xuXG4gICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbmVlZHNNaXBtYXBzVXBsb2FkID0gdGhpcy5fbWlwbWFwcztcbiAgICAgICAgdGhpcy5fbWlwbWFwc1VwbG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5wcm9wZXJ0eUNoYW5nZWQoMjU1KTsgIC8vIDEgfCAyIHwgNCB8IDggfCAxNiB8IDMyIHwgNjQgfCAxMjhcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2NrcyBhIG1pcGxldmVsIG9mIHRoZSB0ZXh0dXJlLCByZXR1cm5pbmcgYSB0eXBlZCBhcnJheSB0byBiZSBmaWxsZWQgd2l0aCBwaXhlbCBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0LiBWYWxpZCBwcm9wZXJ0aWVzIGFyZSBhcyBmb2xsb3dzOlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5sZXZlbF0gLSBUaGUgbWlwIGxldmVsIHRvIGxvY2sgd2l0aCAwIGJlaW5nIHRoZSB0b3AgbGV2ZWwuIERlZmF1bHRzXG4gICAgICogdG8gMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmFjZV0gLSBJZiB0aGUgdGV4dHVyZSBpcyBhIGN1YmVtYXAsIHRoaXMgaXMgdGhlIGluZGV4IG9mIHRoZSBmYWNlXG4gICAgICogdG8gbG9jay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubW9kZV0gLSBUaGUgbG9jayBtb2RlLiBDYW4gYmU6XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRUxPQ0tfUkVBRH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFTE9DS19XUklURX1cbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgVEVYVFVSRUxPQ0tfV1JJVEV9LlxuICAgICAqIEByZXR1cm5zIHtVaW50OEFycmF5fFVpbnQxNkFycmF5fEZsb2F0MzJBcnJheX0gQSB0eXBlZCBhcnJheSBjb250YWluaW5nIHRoZSBwaXhlbCBkYXRhIG9mXG4gICAgICogdGhlIGxvY2tlZCBtaXAgbGV2ZWwuXG4gICAgICovXG4gICAgbG9jayhvcHRpb25zID0ge30pIHtcbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBvcHRpb25zIHRvIHNvbWUgc2Vuc2libGUgZGVmYXVsdHNcbiAgICAgICAgaWYgKG9wdGlvbnMubGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5sZXZlbCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFjZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLmZhY2UgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLm1vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5tb2RlID0gVEVYVFVSRUxPQ0tfV1JJVEU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IG9wdGlvbnMubGV2ZWw7XG5cbiAgICAgICAgY29uc3QgbGV2ZWxzID0gdGhpcy5jdWJlbWFwID8gdGhpcy5fbGV2ZWxzW29wdGlvbnMuZmFjZV0gOiB0aGlzLl9sZXZlbHM7XG4gICAgICAgIGlmIChsZXZlbHNbb3B0aW9ucy5sZXZlbF0gPT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIGFsbG9jYXRlIHN0b3JhZ2UgZm9yIHRoaXMgbWlwIGxldmVsXG4gICAgICAgICAgICBjb25zdCB3aWR0aCA9IE1hdGgubWF4KDEsIHRoaXMuX3dpZHRoID4+IG9wdGlvbnMubGV2ZWwpO1xuICAgICAgICAgICAgY29uc3QgaGVpZ2h0ID0gTWF0aC5tYXgoMSwgdGhpcy5faGVpZ2h0ID4+IG9wdGlvbnMubGV2ZWwpO1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IG5ldyBBcnJheUJ1ZmZlcihUZXh0dXJlVXRpbHMuY2FsY0xldmVsR3B1U2l6ZSh3aWR0aCwgaGVpZ2h0LCB0aGlzLl9mb3JtYXQpKTtcbiAgICAgICAgICAgIGxldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyAoZ2V0UGl4ZWxGb3JtYXRBcnJheVR5cGUodGhpcy5fZm9ybWF0KSkoZGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGV2ZWxzW29wdGlvbnMubGV2ZWxdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgcGl4ZWwgZGF0YSBvZiB0aGUgdGV4dHVyZSBmcm9tIGEgY2FudmFzLCBpbWFnZSwgdmlkZW8gRE9NIGVsZW1lbnQuIElmIHRoZSB0ZXh0dXJlIGlzXG4gICAgICogYSBjdWJlbWFwLCB0aGUgc3VwcGxpZWQgc291cmNlIG11c3QgYmUgYW4gYXJyYXkgb2YgNiBjYW52YXNlcywgaW1hZ2VzIG9yIHZpZGVvcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR8SFRNTEltYWdlRWxlbWVudHxIVE1MVmlkZW9FbGVtZW50fEhUTUxDYW52YXNFbGVtZW50W118SFRNTEltYWdlRWxlbWVudFtdfEhUTUxWaWRlb0VsZW1lbnRbXX0gc291cmNlIC0gQVxuICAgICAqIGNhbnZhcywgaW1hZ2Ugb3IgdmlkZW8gZWxlbWVudCwgb3IgYW4gYXJyYXkgb2YgNiBjYW52YXMsIGltYWdlIG9yIHZpZGVvIGVsZW1lbnRzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWlwTGV2ZWxdIC0gQSBub24tbmVnYXRpdmUgaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBpbWFnZSBsZXZlbCBvZiBkZXRhaWwuXG4gICAgICogRGVmYXVsdHMgdG8gMCwgd2hpY2ggcmVwcmVzZW50cyB0aGUgYmFzZSBpbWFnZSBzb3VyY2UuIEEgbGV2ZWwgdmFsdWUgb2YgTiwgdGhhdCBpcyBncmVhdGVyXG4gICAgICogdGhhbiAwLCByZXByZXNlbnRzIHRoZSBpbWFnZSBzb3VyY2UgZm9yIHRoZSBOdGggbWlwbWFwIHJlZHVjdGlvbiBsZXZlbC5cbiAgICAgKi9cbiAgICBzZXRTb3VyY2Uoc291cmNlLCBtaXBMZXZlbCA9IDApIHtcbiAgICAgICAgbGV0IGludmFsaWQgPSBmYWxzZTtcbiAgICAgICAgbGV0IHdpZHRoLCBoZWlnaHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX2N1YmVtYXApIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2VbMF0pIHtcbiAgICAgICAgICAgICAgICAvLyByZWx5IG9uIGZpcnN0IGZhY2Ugc2l6ZXNcbiAgICAgICAgICAgICAgICB3aWR0aCA9IHNvdXJjZVswXS53aWR0aCB8fCAwO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHNvdXJjZVswXS5oZWlnaHQgfHwgMDtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZhY2UgPSBzb3VyY2VbaV07XG4gICAgICAgICAgICAgICAgICAgIC8vIGN1YmVtYXAgYmVjb21lcyBpbnZhbGlkIGlmIGFueSBjb25kaXRpb24gaXMgbm90IHNhdGlzZmllZFxuICAgICAgICAgICAgICAgICAgICBpZiAoIWZhY2UgfHwgICAgICAgICAgICAgICAgICAvLyBmYWNlIGlzIG1pc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhY2Uud2lkdGggIT09IHdpZHRoIHx8ICAgLy8gZmFjZSBpcyBkaWZmZXJlbnQgd2lkdGhcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhY2UuaGVpZ2h0ICE9PSBoZWlnaHQgfHwgLy8gZmFjZSBpcyBkaWZmZXJlbnQgaGVpZ2h0XG4gICAgICAgICAgICAgICAgICAgICAgICAhdGhpcy5kZXZpY2UuX2lzQnJvd3NlckludGVyZmFjZShmYWNlKSkgeyAgICAgICAgICAgIC8vIG5ldyBpbWFnZSBiaXRtYXBcbiAgICAgICAgICAgICAgICAgICAgICAgIGludmFsaWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGZpcnN0IGZhY2UgaXMgbWlzc2luZ1xuICAgICAgICAgICAgICAgIGludmFsaWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWludmFsaWQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXJrIGxldmVscyBhcyB1cGRhdGVkXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2xldmVsc1ttaXBMZXZlbF1baV0gIT09IHNvdXJjZVtpXSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWRbbWlwTGV2ZWxdW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjaGVjayBpZiBzb3VyY2UgaXMgdmFsaWQgdHlwZSBvZiBlbGVtZW50XG4gICAgICAgICAgICBpZiAoIXRoaXMuZGV2aWNlLl9pc0Jyb3dzZXJJbnRlcmZhY2Uoc291cmNlKSlcbiAgICAgICAgICAgICAgICBpbnZhbGlkID0gdHJ1ZTtcblxuICAgICAgICAgICAgaWYgKCFpbnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgLy8gbWFyayBsZXZlbCBhcyB1cGRhdGVkXG4gICAgICAgICAgICAgICAgaWYgKHNvdXJjZSAhPT0gdGhpcy5fbGV2ZWxzW21pcExldmVsXSlcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF0gPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgd2lkdGggPSBzb3VyY2Uud2lkdGg7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gc291cmNlLmhlaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbnZhbGlkKSB7XG4gICAgICAgICAgICAvLyBpbnZhbGlkIHRleHR1cmVcblxuICAgICAgICAgICAgLy8gZGVmYXVsdCBzaXplc1xuICAgICAgICAgICAgdGhpcy5fd2lkdGggPSA0O1xuICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gNDtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGxldmVsc1xuICAgICAgICAgICAgaWYgKHRoaXMuX2N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdW2ldID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF1baV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW21pcExldmVsXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gdmFsaWQgdGV4dHVyZVxuICAgICAgICAgICAgaWYgKG1pcExldmVsID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fd2lkdGggPSB3aWR0aDtcbiAgICAgICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSBoZWlnaHQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2xldmVsc1ttaXBMZXZlbF0gPSBzb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBvciBjaGFuZ2VkIHN0YXRlIG9mIHZhbGlkaXR5XG4gICAgICAgIGlmICh0aGlzLl9pbnZhbGlkICE9PSBpbnZhbGlkIHx8ICFpbnZhbGlkKSB7XG4gICAgICAgICAgICB0aGlzLl9pbnZhbGlkID0gaW52YWxpZDtcblxuICAgICAgICAgICAgLy8gcmV1cGxvYWRcbiAgICAgICAgICAgIHRoaXMudXBsb2FkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHBpeGVsIGRhdGEgb2YgdGhlIHRleHR1cmUuIElmIHRoaXMgaXMgYSBjdWJlbWFwIHRoZW4gYW4gYXJyYXkgb2YgNiBpbWFnZXMgd2lsbCBiZVxuICAgICAqIHJldHVybmVkIG90aGVyd2lzZSBhIHNpbmdsZSBpbWFnZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWlwTGV2ZWxdIC0gQSBub24tbmVnYXRpdmUgaW50ZWdlciBzcGVjaWZ5aW5nIHRoZSBpbWFnZSBsZXZlbCBvZiBkZXRhaWwuXG4gICAgICogRGVmYXVsdHMgdG8gMCwgd2hpY2ggcmVwcmVzZW50cyB0aGUgYmFzZSBpbWFnZSBzb3VyY2UuIEEgbGV2ZWwgdmFsdWUgb2YgTiwgdGhhdCBpcyBncmVhdGVyXG4gICAgICogdGhhbiAwLCByZXByZXNlbnRzIHRoZSBpbWFnZSBzb3VyY2UgZm9yIHRoZSBOdGggbWlwbWFwIHJlZHVjdGlvbiBsZXZlbC5cbiAgICAgKiBAcmV0dXJucyB7SFRNTEltYWdlRWxlbWVudH0gVGhlIHNvdXJjZSBpbWFnZSBvZiB0aGlzIHRleHR1cmUuIENhbiBiZSBudWxsIGlmIHNvdXJjZSBub3RcbiAgICAgKiBhc3NpZ25lZCBmb3Igc3BlY2lmaWMgaW1hZ2UgbGV2ZWwuXG4gICAgICovXG4gICAgZ2V0U291cmNlKG1pcExldmVsID0gMCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGV2ZWxzW21pcExldmVsXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmxvY2tzIHRoZSBjdXJyZW50bHkgbG9ja2VkIG1pcCBsZXZlbCBhbmQgdXBsb2FkcyBpdCB0byBWUkFNLlxuICAgICAqL1xuICAgIHVubG9jaygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2xvY2tlZExldmVsID09PSAtMSkge1xuICAgICAgICAgICAgRGVidWcubG9nKFwicGMuVGV4dHVyZSN1bmxvY2s6IEF0dGVtcHRpbmcgdG8gdW5sb2NrIGEgdGV4dHVyZSB0aGF0IGlzIG5vdCBsb2NrZWQuXCIsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBsb2FkIHRoZSBuZXcgcGl4ZWwgZGF0YVxuICAgICAgICB0aGlzLnVwbG9hZCgpO1xuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IC0xO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZvcmNlcyBhIHJldXBsb2FkIG9mIHRoZSB0ZXh0dXJlcyBwaXhlbCBkYXRhIHRvIGdyYXBoaWNzIG1lbW9yeS4gT3JkaW5hcmlseSwgdGhpcyBmdW5jdGlvblxuICAgICAqIGlzIGNhbGxlZCBieSBpbnRlcm5hbGx5IGJ5IHtAbGluayBUZXh0dXJlI3NldFNvdXJjZX0gYW5kIHtAbGluayBUZXh0dXJlI3VubG9ja30uIEhvd2V2ZXIsIGl0XG4gICAgICogc3RpbGwgbmVlZHMgdG8gYmUgY2FsbGVkIGV4cGxpY2l0bHkgaW4gdGhlIGNhc2Ugd2hlcmUgYW4gSFRNTFZpZGVvRWxlbWVudCBpcyBzZXQgYXMgdGhlXG4gICAgICogc291cmNlIG9mIHRoZSB0ZXh0dXJlLiAgTm9ybWFsbHksIHRoaXMgaXMgZG9uZSBvbmNlIGV2ZXJ5IGZyYW1lIGJlZm9yZSB2aWRlbyB0ZXh0dXJlZFxuICAgICAqIGdlb21ldHJ5IGlzIHJlbmRlcmVkLlxuICAgICAqL1xuICAgIHVwbG9hZCgpIHtcbiAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9uZWVkc01pcG1hcHNVcGxvYWQgPSB0aGlzLl9taXBtYXBzO1xuICAgICAgICB0aGlzLmltcGwudXBsb2FkSW1tZWRpYXRlPy4odGhpcy5kZXZpY2UsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERvd25sb2FkIHRleHR1cmUncyB0b3AgbGV2ZWwgZGF0YSBmcm9tIGdyYXBoaWNzIG1lbW9yeSB0byBsb2NhbCBtZW1vcnkuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXN5bmMgZG93bmxvYWRBc3luYygpIHtcbiAgICAgICAgY29uc3QgcHJvbWlzZXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAodGhpcy5jdWJlbWFwID8gNiA6IDEpOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlclRhcmdldCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0aGlzLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBmYWNlOiBpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy5kZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHJlbmRlclRhcmdldCk7XG4gICAgICAgICAgICB0aGlzLmRldmljZS5pbml0UmVuZGVyVGFyZ2V0KHJlbmRlclRhcmdldCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGxldmVscyA9IHRoaXMuY3ViZW1hcCA/IHRoaXMuX2xldmVsc1tpXSA6IHRoaXMuX2xldmVscztcblxuICAgICAgICAgICAgbGV0IGxldmVsID0gbGV2ZWxzWzBdO1xuICAgICAgICAgICAgaWYgKGxldmVsc1swXSAmJiB0aGlzLmRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKGxldmVsc1swXSkpIHtcbiAgICAgICAgICAgICAgICBsZXZlbHNbMF0gPSBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXZlbCA9IHRoaXMubG9jayh7IGZhY2U6IGkgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLmRldmljZS5yZWFkUGl4ZWxzQXN5bmM/LigwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCwgbGV2ZWwpXG4gICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gcmVuZGVyVGFyZ2V0LmRlc3Ryb3koKSk7XG5cbiAgICAgICAgICAgIHByb21pc2VzLnB1c2gocHJvbWlzZSk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlIGFuIGluLW1lbW9yeSBERFMgcmVwcmVzZW50YXRpb24gb2YgdGhpcyB0ZXh0dXJlLiBPbmx5IHdvcmtzIG9uIFJHQkE4IHRleHR1cmVzLlxuICAgICAqIEN1cnJlbnRseSwgb25seSB1c2VkIGJ5IHRoZSBFZGl0b3IgdG8gd3JpdGUgcHJlZmlsdGVyZWQgY3ViZW1hcHMgdG8gRERTIGZvcm1hdC5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtBcnJheUJ1ZmZlcn0gQnVmZmVyIGNvbnRhaW5pbmcgdGhlIEREUyBkYXRhLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXREZHMoKSB7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTgsIFwiVGhpcyBmb3JtYXQgaXMgbm90IGltcGxlbWVudGVkIHlldFwiKTtcblxuICAgICAgICBsZXQgZnNpemUgPSAxMjg7XG4gICAgICAgIGxldCBpZHggPSAwO1xuICAgICAgICB3aGlsZSAodGhpcy5fbGV2ZWxzW2lkeF0pIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWlwU2l6ZSA9IHRoaXMuX2xldmVsc1tpZHhdLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBpZiAoIW1pcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYE5vIGJ5dGUgYXJyYXkgZm9yIG1pcCAke2lkeH1gKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZnNpemUgKz0gbWlwU2l6ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9sZXZlbHNbaWR4XVtmYWNlXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYE5vIGxldmVsIGRhdGEgZm9yIG1pcCAke2lkeH0sIGZhY2UgJHtmYWNlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBtaXBTaXplID0gdGhpcy5fbGV2ZWxzW2lkeF1bZmFjZV0ubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW1pcFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBObyBieXRlIGFycmF5IGZvciBtaXAgJHtpZHh9LCBmYWNlICR7ZmFjZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZnNpemUgKz0gbWlwU2l6ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmc2l6ZSArPSB0aGlzLl9sZXZlbHNbaWR4XS5sZW5ndGg7XG4gICAgICAgICAgICBpZHgrKztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGJ1ZmYgPSBuZXcgQXJyYXlCdWZmZXIoZnNpemUpO1xuICAgICAgICBjb25zdCBoZWFkZXIgPSBuZXcgVWludDMyQXJyYXkoYnVmZiwgMCwgMTI4IC8gNCk7XG5cbiAgICAgICAgY29uc3QgRERTX01BR0lDID0gNTQyMzI3ODc2OyAvLyBcIkREU1wiXG4gICAgICAgIGNvbnN0IEREU19IRUFERVJfU0laRSA9IDEyNDtcbiAgICAgICAgY29uc3QgRERTX0ZMQUdTX1JFUVVJUkVEID0gMHgwMSB8IDB4MDIgfCAweDA0IHwgMHgxMDAwIHwgMHg4MDAwMDsgLy8gY2FwcyB8IGhlaWdodCB8IHdpZHRoIHwgcGl4ZWxmb3JtYXQgfCBsaW5lYXJzaXplXG4gICAgICAgIGNvbnN0IEREU19GTEFHU19NSVBNQVAgPSAweDIwMDAwO1xuICAgICAgICBjb25zdCBERFNfUElYRUxGT1JNQVRfU0laRSA9IDMyO1xuICAgICAgICBjb25zdCBERFNfUElYRUxGTEFHU19SR0JBOCA9IDB4MDEgfCAweDQwOyAvLyBhbHBoYSB8IHJnYlxuICAgICAgICBjb25zdCBERFNfQ0FQU19SRVFVSVJFRCA9IDB4MTAwMDtcbiAgICAgICAgY29uc3QgRERTX0NBUFNfTUlQTUFQID0gMHg0MDAwMDA7XG4gICAgICAgIGNvbnN0IEREU19DQVBTX0NPTVBMRVggPSAweDg7XG4gICAgICAgIGNvbnN0IEREU19DQVBTMl9DVUJFTUFQID0gMHgyMDAgfCAweDQwMCB8IDB4ODAwIHwgMHgxMDAwIHwgMHgyMDAwIHwgMHg0MDAwIHwgMHg4MDAwOyAvLyBjdWJlbWFwIHwgYWxsIGZhY2VzXG5cbiAgICAgICAgbGV0IGZsYWdzID0gRERTX0ZMQUdTX1JFUVVJUkVEO1xuICAgICAgICBpZiAodGhpcy5fbGV2ZWxzLmxlbmd0aCA+IDEpIGZsYWdzIHw9IEREU19GTEFHU19NSVBNQVA7XG5cbiAgICAgICAgbGV0IGNhcHMgPSBERFNfQ0FQU19SRVFVSVJFRDtcbiAgICAgICAgaWYgKHRoaXMuX2xldmVscy5sZW5ndGggPiAxKSBjYXBzIHw9IEREU19DQVBTX01JUE1BUDtcbiAgICAgICAgaWYgKHRoaXMuX2xldmVscy5sZW5ndGggPiAxIHx8IHRoaXMuY3ViZW1hcCkgY2FwcyB8PSBERFNfQ0FQU19DT01QTEVYO1xuXG4gICAgICAgIGNvbnN0IGNhcHMyID0gdGhpcy5jdWJlbWFwID8gRERTX0NBUFMyX0NVQkVNQVAgOiAwO1xuXG4gICAgICAgIGhlYWRlclswXSA9IEREU19NQUdJQztcbiAgICAgICAgaGVhZGVyWzFdID0gRERTX0hFQURFUl9TSVpFO1xuICAgICAgICBoZWFkZXJbMl0gPSBmbGFncztcbiAgICAgICAgaGVhZGVyWzNdID0gdGhpcy5oZWlnaHQ7XG4gICAgICAgIGhlYWRlcls0XSA9IHRoaXMud2lkdGg7XG4gICAgICAgIGhlYWRlcls1XSA9IHRoaXMud2lkdGggKiB0aGlzLmhlaWdodCAqIDQ7XG4gICAgICAgIGhlYWRlcls2XSA9IDA7IC8vIGRlcHRoXG4gICAgICAgIGhlYWRlcls3XSA9IHRoaXMuX2xldmVscy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTE7IGkrKykge1xuICAgICAgICAgICAgaGVhZGVyWzggKyBpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaGVhZGVyWzE5XSA9IEREU19QSVhFTEZPUk1BVF9TSVpFO1xuICAgICAgICBoZWFkZXJbMjBdID0gRERTX1BJWEVMRkxBR1NfUkdCQTg7XG4gICAgICAgIGhlYWRlclsyMV0gPSAwOyAvLyBmb3VyY2NcbiAgICAgICAgaGVhZGVyWzIyXSA9IDMyOyAvLyBicHBcbiAgICAgICAgaGVhZGVyWzIzXSA9IDB4MDBGRjAwMDA7IC8vIFIgbWFza1xuICAgICAgICBoZWFkZXJbMjRdID0gMHgwMDAwRkYwMDsgLy8gRyBtYXNrXG4gICAgICAgIGhlYWRlclsyNV0gPSAweDAwMDAwMEZGOyAvLyBCIG1hc2tcbiAgICAgICAgaGVhZGVyWzI2XSA9IDB4RkYwMDAwMDA7IC8vIEEgbWFza1xuICAgICAgICBoZWFkZXJbMjddID0gY2FwcztcbiAgICAgICAgaGVhZGVyWzI4XSA9IGNhcHMyO1xuICAgICAgICBoZWFkZXJbMjldID0gMDtcbiAgICAgICAgaGVhZGVyWzMwXSA9IDA7XG4gICAgICAgIGhlYWRlclszMV0gPSAwO1xuXG4gICAgICAgIGxldCBvZmZzZXQgPSAxMjg7XG4gICAgICAgIGlmICghdGhpcy5jdWJlbWFwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xldmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxldmVsID0gdGhpcy5fbGV2ZWxzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pcCA9IG5ldyBVaW50OEFycmF5KGJ1ZmYsIG9mZnNldCwgbGV2ZWwubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxldmVsLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pcFtqXSA9IGxldmVsW2pdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvZmZzZXQgKz0gbGV2ZWwubGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xldmVscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZXZlbCA9IHRoaXMuX2xldmVsc1tpXVtmYWNlXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWlwID0gbmV3IFVpbnQ4QXJyYXkoYnVmZiwgb2Zmc2V0LCBsZXZlbC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxldmVsLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtaXBbal0gPSBsZXZlbFtqXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBvZmZzZXQgKz0gbGV2ZWwubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBidWZmO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgVGV4dHVyZSB9O1xuIl0sIm5hbWVzIjpbImlkIiwiVGV4dHVyZSIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJvcHRpb25zIiwiX29wdGlvbnMkbmFtZSIsIl9vcHRpb25zJHdpZHRoIiwiX29wdGlvbnMkaGVpZ2h0IiwiX29wdGlvbnMkZm9ybWF0IiwiX29wdGlvbnMkY3ViZW1hcCIsIl9vcHRpb25zJGZpeEN1YmVtYXBTZSIsIl9vcHRpb25zJGZsaXBZIiwiX29wdGlvbnMkcHJlbXVsdGlwbHlBIiwiX3JlZiIsIl9vcHRpb25zJG1pcG1hcHMiLCJfb3B0aW9ucyRtaW5GaWx0ZXIiLCJfb3B0aW9ucyRtYWdGaWx0ZXIiLCJfb3B0aW9ucyRhbmlzb3Ryb3B5IiwiX29wdGlvbnMkYWRkcmVzc1UiLCJfb3B0aW9ucyRhZGRyZXNzViIsIl9vcHRpb25zJGFkZHJlc3NXIiwiX29wdGlvbnMkY29tcGFyZU9uUmVhIiwiX29wdGlvbnMkY29tcGFyZUZ1bmMiLCJfb3B0aW9ucyRwcm9maWxlckhpbnQiLCJuYW1lIiwiX2lzUmVuZGVyVGFyZ2V0IiwiX2dwdVNpemUiLCJfaW52YWxpZCIsIl9sb2NrZWRMZXZlbCIsInJlbmRlclZlcnNpb25EaXJ0eSIsImRldmljZSIsIkRlYnVnIiwiYXNzZXJ0IiwiX3dpZHRoIiwid2lkdGgiLCJfaGVpZ2h0IiwiaGVpZ2h0IiwiX2Zvcm1hdCIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwiX2NvbXByZXNzZWQiLCJpc0NvbXByZXNzZWRQaXhlbEZvcm1hdCIsInN1cHBvcnRzVm9sdW1lVGV4dHVyZXMiLCJfb3B0aW9ucyR2b2x1bWUiLCJfb3B0aW9ucyRkZXB0aCIsIl92b2x1bWUiLCJ2b2x1bWUiLCJfZGVwdGgiLCJkZXB0aCIsIl9jdWJlbWFwIiwiY3ViZW1hcCIsImZpeEN1YmVtYXBTZWFtcyIsIl9mbGlwWSIsImZsaXBZIiwiX3ByZW11bHRpcGx5QWxwaGEiLCJwcmVtdWx0aXBseUFscGhhIiwiX21pcG1hcHMiLCJtaXBtYXBzIiwiYXV0b01pcG1hcCIsIl9taW5GaWx0ZXIiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJfbWFnRmlsdGVyIiwibWFnRmlsdGVyIiwiRklMVEVSX0xJTkVBUiIsIl9hbmlzb3Ryb3B5IiwiYW5pc290cm9weSIsIl9hZGRyZXNzVSIsImFkZHJlc3NVIiwiQUREUkVTU19SRVBFQVQiLCJfYWRkcmVzc1YiLCJhZGRyZXNzViIsIl9hZGRyZXNzVyIsImFkZHJlc3NXIiwiX2NvbXBhcmVPblJlYWQiLCJjb21wYXJlT25SZWFkIiwiX2NvbXBhcmVGdW5jIiwiY29tcGFyZUZ1bmMiLCJGVU5DX0xFU1MiLCJ0eXBlIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsImhhc093blByb3BlcnR5IiwiZGVwcmVjYXRlZCIsInJnYm0iLCJURVhUVVJFVFlQRV9SR0JNIiwic3dpenpsZUdHR1IiLCJURVhUVVJFVFlQRV9TV0laWkxFR0dHUiIsInByb2plY3Rpb24iLCJURVhUVVJFUFJPSkVDVElPTl9OT05FIiwiVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSIsImltcGwiLCJjcmVhdGVUZXh0dXJlSW1wbCIsInByb2ZpbGVySGludCIsImRpcnR5QWxsIiwiX2xldmVscyIsImxldmVscyIsInVwbG9hZCIsInRleHR1cmVzIiwicHVzaCIsInRyYWNlIiwiVFJBQ0VJRF9URVhUVVJFX0FMTE9DIiwiZGVzdHJveSIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJzY29wZSIsInJlbW92ZVZhbHVlIiwiYWRqdXN0VnJhbVNpemVUcmFja2luZyIsIl92cmFtIiwibG9zZUNvbnRleHQiLCJ2cmFtIiwic2l6ZSIsIlRSQUNFSURfVlJBTV9URVhUVVJFIiwidGV4IiwiVEVYSElOVF9TSEFET1dNQVAiLCJ0ZXhTaGFkb3ciLCJURVhISU5UX0FTU0VUIiwidGV4QXNzZXQiLCJURVhISU5UX0xJR0hUTUFQIiwidGV4TGlnaHRtYXAiLCJwcm9wZXJ0eUNoYW5nZWQiLCJmbGFnIiwicmVuZGVyVmVyc2lvbiIsInJlcXVpcmVkTWlwTGV2ZWxzIiwiTWF0aCIsImZsb29yIiwibG9nMiIsIm1heCIsInYiLCJ3YXJuIiwiaXNXZWJHUFUiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwiZ3B1U2l6ZSIsIm1pcHMiLCJwb3QiLCJsZW5ndGgiLCJUZXh0dXJlVXRpbHMiLCJjYWxjR3B1U2l6ZSIsIl9uZWVkc1VwbG9hZCIsIm1hdGgiLCJwb3dlck9mVHdvIiwiZW5jb2RpbmciLCJURVhUVVJFVFlQRV9SR0JFIiwiVEVYVFVSRVRZUEVfUkdCUCIsIlBJWEVMRk9STUFUX1JHQjE2RiIsIlBJWEVMRk9STUFUX1JHQjMyRiIsIlBJWEVMRk9STUFUX1JHQkExNkYiLCJQSVhFTEZPUk1BVF9SR0JBMzJGIiwiX2xldmVsc1VwZGF0ZWQiLCJfbWlwbWFwc1VwbG9hZGVkIiwibG9jayIsImxldmVsIiwidW5kZWZpbmVkIiwiZmFjZSIsIm1vZGUiLCJURVhUVVJFTE9DS19XUklURSIsImRhdGEiLCJBcnJheUJ1ZmZlciIsImNhbGNMZXZlbEdwdVNpemUiLCJnZXRQaXhlbEZvcm1hdEFycmF5VHlwZSIsInNldFNvdXJjZSIsInNvdXJjZSIsIm1pcExldmVsIiwiaW52YWxpZCIsImkiLCJfaXNCcm93c2VySW50ZXJmYWNlIiwiZ2V0U291cmNlIiwidW5sb2NrIiwibG9nIiwiX3RoaXMkaW1wbCR1cGxvYWRJbW1lIiwiX3RoaXMkaW1wbCIsInVwbG9hZEltbWVkaWF0ZSIsImNhbGwiLCJkb3dubG9hZEFzeW5jIiwicHJvbWlzZXMiLCJfdGhpcyRkZXZpY2UkcmVhZFBpeGUiLCJfdGhpcyRkZXZpY2UiLCJyZW5kZXJUYXJnZXQiLCJSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsInNldFJlbmRlclRhcmdldCIsImluaXRSZW5kZXJUYXJnZXQiLCJwcm9taXNlIiwicmVhZFBpeGVsc0FzeW5jIiwidGhlbiIsIlByb21pc2UiLCJhbGwiLCJnZXREZHMiLCJmc2l6ZSIsIm1pcFNpemUiLCJlcnJvciIsImJ1ZmYiLCJoZWFkZXIiLCJVaW50MzJBcnJheSIsIkREU19NQUdJQyIsIkREU19IRUFERVJfU0laRSIsIkREU19GTEFHU19SRVFVSVJFRCIsIkREU19GTEFHU19NSVBNQVAiLCJERFNfUElYRUxGT1JNQVRfU0laRSIsIkREU19QSVhFTEZMQUdTX1JHQkE4IiwiRERTX0NBUFNfUkVRVUlSRUQiLCJERFNfQ0FQU19NSVBNQVAiLCJERFNfQ0FQU19DT01QTEVYIiwiRERTX0NBUFMyX0NVQkVNQVAiLCJmbGFncyIsImNhcHMiLCJjYXBzMiIsIm9mZnNldCIsIm1pcCIsIlVpbnQ4QXJyYXkiLCJqIl0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBb0JBLElBQUlBLEVBQUUsR0FBRyxDQUFDLENBQUE7O0FBRVY7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxPQUFPLENBQUM7QUFnQ1Y7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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
