import { Debug } from '../../core/debug.js';
import { TRACEID_TEXTURE_ALLOC, TRACEID_VRAM_TEXTURE } from '../../core/constants.js';
import { math } from '../../core/math/math.js';
import { PIXELFORMAT_RGBA8, isCompressedPixelFormat, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_CUBE, TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_DXT1, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGBA, pixelFormatByteSizes, TEXTURELOCK_WRITE, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGB565, PIXELFORMAT_LA8, PIXELFORMAT_L8, PIXELFORMAT_A8 } from './constants.js';

let _blockSizeTable = null;
let id = 0;

/**
 * A texture is a container for texel data that can be utilized in a fragment shader. Typically,
 * the texel data represents an image that is mapped over geometry.
 */
class Texture {
  /**
   * The name of the texture.
   *
   * @type {string}
   */

  /** @protected */

  /** @protected */

  /** @protected */

  /** @protected */

  /** @protected */

  /**
   * Create a new Texture instance.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
   * used to manage this texture.
   * @param {object} [options] - Object for passing optional arguments.
   * @param {string} [options.name] - The name of the texture. Defaults to null.
   * @param {number} [options.width] - The width of the texture in pixels. Defaults to 4.
   * @param {number} [options.height] - The height of the texture in pixels. Defaults to 4.
   * @param {number} [options.depth] - The number of depth slices in a 3D texture (WebGL2 only).
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
   * (WebGL2 only). Defaults to false.
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
   * (WebGL2 only). Defaults to false.
   * @param {number} [options.compareFunc] - Comparison function when compareOnRead is enabled
   * (WebGL2 only). Can be:
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
    this.name = void 0;
    this._isRenderTarget = false;
    this._gpuSize = 0;
    this.id = id++;
    this._invalid = false;
    this._lockedLevel = -1;
    this.device = graphicsDevice;
    Debug.assert(this.device, "Texture constructor requires a graphicsDevice to be valid");
    this.name = (_options$name = options.name) != null ? _options$name : null;
    this._width = (_options$width = options.width) != null ? _options$width : 4;
    this._height = (_options$height = options.height) != null ? _options$height : 4;
    this._format = (_options$format = options.format) != null ? _options$format : PIXELFORMAT_RGBA8;
    this._compressed = isCompressedPixelFormat(this._format);
    if (graphicsDevice.webgl2) {
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
    this.profilerHint = (_options$profilerHint = options.profilerHint) != null ? _options$profilerHint : 0;
    this._levels = options.levels;
    if (!this._levels) {
      this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
    }
    this.dirtyAll();
    this.impl = graphicsDevice.createTextureImpl(this);

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
      this._parameterFlags |= 1;
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
      this._parameterFlags |= 2;
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
      this._parameterFlags |= 4;
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
      this._parameterFlags |= 8;
    }
  }
  get addressV() {
    return this._addressV;
  }

  /**
   * The addressing mode to be applied to the 3D texture depth (WebGL2 only). Can be:
   *
   * - {@link ADDRESS_REPEAT}
   * - {@link ADDRESS_CLAMP_TO_EDGE}
   * - {@link ADDRESS_MIRRORED_REPEAT}
   *
   * @type {number}
   */
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

  /**
   * When enabled, and if texture format is {@link PIXELFORMAT_DEPTH} or
   * {@link PIXELFORMAT_DEPTHSTENCIL}, hardware PCF is enabled for this texture, and you can get
   * filtered results of comparison using texture() in your shader (WebGL2 only).
   *
   * @type {boolean}
   */
  set compareOnRead(v) {
    if (this._compareOnRead !== v) {
      this._compareOnRead = v;
      this._parameterFlags |= 32;
    }
  }
  get compareOnRead() {
    return this._compareOnRead;
  }

  /**
   * Comparison function when compareOnRead is enabled (WebGL2 only). Possible values:
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
      this._parameterFlags |= 64;
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
      this._parameterFlags |= 128;
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
   * The number of depth slices in a 3D texture (WebGL2 only).
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
    return Texture.calcGpuSize(this._width, this._height, this._depth, this._format, mips, this._cubemap);
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

  // static functions
  /**
   * Calculate the GPU memory required for a texture.
   *
   * @param {number} width - Texture's width.
   * @param {number} height - Texture's height.
   * @param {number} depth - Texture's depth.
   * @param {number} format - Texture's pixel format PIXELFORMAT_***.
   * @param {boolean} mipmaps - True if the texture includes mipmaps, false otherwise.
   * @param {boolean} cubemap - True is the texture is a cubemap, false otherwise.
   * @returns {number} The number of bytes of GPU memory required for the texture.
   * @ignore
   */
  static calcGpuSize(width, height, depth, format, mipmaps, cubemap) {
    var _pixelFormatByteSizes;
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
    const pixelSize = (_pixelFormatByteSizes = pixelFormatByteSizes[format]) != null ? _pixelFormatByteSizes : 0;
    const blockSize = _blockSizeTable.hasOwnProperty(format) ? _blockSizeTable[format] : 0;
    let result = 0;
    while (1) {
      if (pixelSize > 0) {
        // handle uncompressed formats
        result += width * height * depth * pixelSize;
      } else {
        // handle block formats
        let blockWidth = Math.floor((width + 3) / 4);
        const blockHeight = Math.floor((height + 3) / 4);
        const blockDepth = Math.floor((depth + 3) / 4);
        if (format === PIXELFORMAT_PVRTC_2BPP_RGB_1 || format === PIXELFORMAT_PVRTC_2BPP_RGBA_1) {
          blockWidth = Math.max(Math.floor(blockWidth / 2), 1);
        }
        result += blockWidth * blockHeight * blockDepth * blockSize;
      }
      // we're done if mipmaps aren't required or we've calculated the smallest mipmap level
      if (!mipmaps || width === 1 && height === 1 && depth === 1) {
        break;
      }
      width = Math.max(Math.floor(width / 2), 1);
      height = Math.max(Math.floor(height / 2), 1);
      depth = Math.max(Math.floor(depth / 2), 1);
    }
    return result * (cubemap ? 6 : 1);
  }

  // Force a full resubmission of the texture to WebGL (used on a context restore event)
  dirtyAll() {
    this._levelsUpdated = this._cubemap ? [[true, true, true, true, true, true]] : [true];
    this._needsUpload = true;
    this._needsMipmapsUpload = this._mipmaps;
    this._mipmapsUploaded = false;
    this._parameterFlags = 255; // 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVEVYVFVSRV9BTExPQywgVFJBQ0VJRF9WUkFNX1RFWFRVUkUgfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQge1xuICAgIGlzQ29tcHJlc3NlZFBpeGVsRm9ybWF0LFxuICAgIHBpeGVsRm9ybWF0Qnl0ZVNpemVzLFxuICAgIEFERFJFU1NfUkVQRUFULFxuICAgIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBGVU5DX0xFU1MsXG4gICAgUElYRUxGT1JNQVRfQTgsIFBJWEVMRk9STUFUX0w4LCBQSVhFTEZPUk1BVF9MQTgsIFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTU1NTEsIFBJWEVMRk9STUFUX1JHQkE0LFxuICAgIFBJWEVMRk9STUFUX1JHQjgsIFBJWEVMRk9STUFUX1JHQkE4LCBQSVhFTEZPUk1BVF9EWFQxLCBQSVhFTEZPUk1BVF9EWFQzLCBQSVhFTEZPUk1BVF9EWFQ1LFxuICAgIFBJWEVMRk9STUFUX1JHQjE2RiwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCMzJGLCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9FVEMxLFxuICAgIFBJWEVMRk9STUFUX0VUQzJfUkdCLCBQSVhFTEZPUk1BVF9FVEMyX1JHQkEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xLFxuICAgIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xLCBQSVhFTEZPUk1BVF9BU1RDXzR4NCwgUElYRUxGT1JNQVRfQVRDX1JHQixcbiAgICBQSVhFTEZPUk1BVF9BVENfUkdCQSxcbiAgICBURVhISU5UX1NIQURPV01BUCwgVEVYSElOVF9BU1NFVCwgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9OT05FLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFLFxuICAgIFRFWFRVUkVUWVBFX0RFRkFVTFQsIFRFWFRVUkVUWVBFX1JHQk0sIFRFWFRVUkVUWVBFX1JHQkUsIFRFWFRVUkVUWVBFX1JHQlAsIFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxubGV0IF9ibG9ja1NpemVUYWJsZSA9IG51bGw7XG5cbmxldCBpZCA9IDA7XG5cbi8qKlxuICogQSB0ZXh0dXJlIGlzIGEgY29udGFpbmVyIGZvciB0ZXhlbCBkYXRhIHRoYXQgY2FuIGJlIHV0aWxpemVkIGluIGEgZnJhZ21lbnQgc2hhZGVyLiBUeXBpY2FsbHksXG4gKiB0aGUgdGV4ZWwgZGF0YSByZXByZXNlbnRzIGFuIGltYWdlIHRoYXQgaXMgbWFwcGVkIG92ZXIgZ2VvbWV0cnkuXG4gKi9cbmNsYXNzIFRleHR1cmUge1xuICAgIC8qKlxuICAgICAqIFRoZSBuYW1lIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBuYW1lO1xuXG4gICAgLyoqIEBwcm90ZWN0ZWQgKi9cbiAgICBfaXNSZW5kZXJUYXJnZXQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJvdGVjdGVkICovXG4gICAgX2dwdVNpemUgPSAwO1xuXG4gICAgLyoqIEBwcm90ZWN0ZWQgKi9cbiAgICBpZCA9IGlkKys7XG5cbiAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgIF9pbnZhbGlkID0gZmFsc2U7XG5cbiAgICAvKiogQHByb3RlY3RlZCAqL1xuICAgIF9sb2NrZWRMZXZlbCA9IC0xO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFRleHR1cmUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZ3JhcGhpY3NEZXZpY2UgLSBUaGUgZ3JhcGhpY3MgZGV2aWNlXG4gICAgICogdXNlZCB0byBtYW5hZ2UgdGhpcyB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPYmplY3QgZm9yIHBhc3Npbmcgb3B0aW9uYWwgYXJndW1lbnRzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy5uYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSB0ZXh0dXJlLiBEZWZhdWx0cyB0byBudWxsLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy53aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLiBEZWZhdWx0cyB0byA0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5oZWlnaHRdIC0gVGhlIGhlaWdodCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuIERlZmF1bHRzIHRvIDQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmRlcHRoXSAtIFRoZSBudW1iZXIgb2YgZGVwdGggc2xpY2VzIGluIGEgM0QgdGV4dHVyZSAoV2ViR0wyIG9ubHkpLlxuICAgICAqIERlZmF1bHRzIHRvIDEgKHNpbmdsZSAyRCBpbWFnZSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmZvcm1hdF0gLSBUaGUgcGl4ZWwgZm9ybWF0IG9mIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCNTY1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE1NTUxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE0fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQzfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDV9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkExNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkEzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRVRDMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfMTExMTEwRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BU1RDXzR4NH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0JBfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE4fS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMucHJvamVjdGlvbl0gLSBUaGUgcHJvamVjdGlvbiB0eXBlIG9mIHRoZSB0ZXh0dXJlLCB1c2VkIHdoZW4gdGhlXG4gICAgICogdGV4dHVyZSByZXByZXNlbnRzIGFuIGVudmlyb25tZW50LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9OT05FfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkV9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fRVFVSVJFQ1R9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTH1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9DVUJFfSBpZiBvcHRpb25zLmN1YmVtYXAgaXMgdHJ1ZSwgb3RoZXJ3aXNlXG4gICAgICoge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX05PTkV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5GaWx0ZXJdIC0gVGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1hZ0ZpbHRlcl0gLSBUaGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hbmlzb3Ryb3B5XSAtIFRoZSBsZXZlbCBvZiBhbmlzb3Ryb3BpYyBmaWx0ZXJpbmcgdG8gdXNlLiBEZWZhdWx0c1xuICAgICAqIHRvIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NVXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFUgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NWXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFYgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NXXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFcgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5taXBtYXBzXSAtIFdoZW4gZW5hYmxlZCB0cnkgdG8gZ2VuZXJhdGUgb3IgdXNlIG1pcG1hcHMgZm9yIHRoaXNcbiAgICAgKiB0ZXh0dXJlLiBEZWZhdWx0IGlzIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jdWJlbWFwXSAtIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIGlzIHRvIGJlIGEgY3ViZW1hcC5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnZvbHVtZV0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBpcyB0byBiZSBhIDNEIHZvbHVtZVxuICAgICAqIChXZWJHTDIgb25seSkuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy50eXBlXSAtIFNwZWNpZmllcyB0aGUgdGV4dHVyZSB0eXBlLiAgQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVRZUEVfREVGQVVMVH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFVFlQRV9SR0JNfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVUWVBFX1JHQkV9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVRZUEVfUkdCUH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFVFlQRV9TV0laWkxFR0dHUn1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBURVhUVVJFVFlQRV9ERUZBVUxUfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZpeEN1YmVtYXBTZWFtc10gLSBTcGVjaWZpZXMgd2hldGhlciB0aGlzIGN1YmVtYXAgdGV4dHVyZSByZXF1aXJlc1xuICAgICAqIHNwZWNpYWwgc2VhbSBmaXhpbmcgc2hhZGVyIGNvZGUgdG8gbG9vayByaWdodC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mbGlwWV0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBzaG91bGQgYmUgZmxpcHBlZCBpbiB0aGVcbiAgICAgKiBZLWRpcmVjdGlvbi4gT25seSBhZmZlY3RzIHRleHR1cmVzIHdpdGggYSBzb3VyY2UgdGhhdCBpcyBhbiBpbWFnZSwgY2FudmFzIG9yIHZpZGVvIGVsZW1lbnQuXG4gICAgICogRG9lcyBub3QgYWZmZWN0IGN1YmVtYXBzLCBjb21wcmVzc2VkIHRleHR1cmVzIG9yIHRleHR1cmVzIHNldCBmcm9tIHJhdyBwaXhlbCBkYXRhLiBEZWZhdWx0c1xuICAgICAqIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlbXVsdGlwbHlBbHBoYV0gLSBJZiB0cnVlLCB0aGUgYWxwaGEgY2hhbm5lbCBvZiB0aGUgdGV4dHVyZSAoaWZcbiAgICAgKiBwcmVzZW50KSBpcyBtdWx0aXBsaWVkIGludG8gdGhlIGNvbG9yIGNoYW5uZWxzLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNvbXBhcmVPblJlYWRdIC0gV2hlbiBlbmFibGVkLCBhbmQgaWYgdGV4dHVyZSBmb3JtYXQgaXNcbiAgICAgKiB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEh9IG9yIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUx9LCBoYXJkd2FyZSBQQ0YgaXMgZW5hYmxlZCBmb3JcbiAgICAgKiB0aGlzIHRleHR1cmUsIGFuZCB5b3UgY2FuIGdldCBmaWx0ZXJlZCByZXN1bHRzIG9mIGNvbXBhcmlzb24gdXNpbmcgdGV4dHVyZSgpIGluIHlvdXIgc2hhZGVyXG4gICAgICogKFdlYkdMMiBvbmx5KS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmNvbXBhcmVGdW5jXSAtIENvbXBhcmlzb24gZnVuY3Rpb24gd2hlbiBjb21wYXJlT25SZWFkIGlzIGVuYWJsZWRcbiAgICAgKiAoV2ViR0wyIG9ubHkpLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBGVU5DX0xFU1N9LlxuICAgICAqIEBwYXJhbSB7VWludDhBcnJheVtdfSBbb3B0aW9ucy5sZXZlbHNdIC0gQXJyYXkgb2YgVWludDhBcnJheS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDh4OHgyNC1iaXQgdGV4dHVyZVxuICAgICAqIGNvbnN0IHRleHR1cmUgPSBuZXcgcGMuVGV4dHVyZShncmFwaGljc0RldmljZSwge1xuICAgICAqICAgICB3aWR0aDogOCxcbiAgICAgKiAgICAgaGVpZ2h0OiA4LFxuICAgICAqICAgICBmb3JtYXQ6IHBjLlBJWEVMRk9STUFUX1JHQjhcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIEZpbGwgdGhlIHRleHR1cmUgd2l0aCBhIGdyYWRpZW50XG4gICAgICogY29uc3QgcGl4ZWxzID0gdGV4dHVyZS5sb2NrKCk7XG4gICAgICogY29uc3QgY291bnQgPSAwO1xuICAgICAqIGZvciAobGV0IGkgPSAwOyBpIDwgODsgaSsrKSB7XG4gICAgICogICAgIGZvciAobGV0IGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICogICAgICAgICBwaXhlbHNbY291bnQrK10gPSBpICogMzI7XG4gICAgICogICAgICAgICBwaXhlbHNbY291bnQrK10gPSBqICogMzI7XG4gICAgICogICAgICAgICBwaXhlbHNbY291bnQrK10gPSAyNTU7XG4gICAgICogICAgIH1cbiAgICAgKiB9XG4gICAgICogdGV4dHVyZS51bmxvY2soKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLmRldmljZSwgXCJUZXh0dXJlIGNvbnN0cnVjdG9yIHJlcXVpcmVzIGEgZ3JhcGhpY3NEZXZpY2UgdG8gYmUgdmFsaWRcIik7XG5cbiAgICAgICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lID8/IG51bGw7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSBvcHRpb25zLndpZHRoID8/IDQ7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IG9wdGlvbnMuaGVpZ2h0ID8/IDQ7XG5cbiAgICAgICAgdGhpcy5fZm9ybWF0ID0gb3B0aW9ucy5mb3JtYXQgPz8gUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgICAgIHRoaXMuX2NvbXByZXNzZWQgPSBpc0NvbXByZXNzZWRQaXhlbEZvcm1hdCh0aGlzLl9mb3JtYXQpO1xuXG4gICAgICAgIGlmIChncmFwaGljc0RldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgIHRoaXMuX3ZvbHVtZSA9IG9wdGlvbnMudm9sdW1lID8/IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fZGVwdGggPSBvcHRpb25zLmRlcHRoID8/IDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl92b2x1bWUgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX2RlcHRoID0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2N1YmVtYXAgPSBvcHRpb25zLmN1YmVtYXAgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuZml4Q3ViZW1hcFNlYW1zID0gb3B0aW9ucy5maXhDdWJlbWFwU2VhbXMgPz8gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZsaXBZID0gb3B0aW9ucy5mbGlwWSA/PyBmYWxzZTtcbiAgICAgICAgdGhpcy5fcHJlbXVsdGlwbHlBbHBoYSA9IG9wdGlvbnMucHJlbXVsdGlwbHlBbHBoYSA/PyBmYWxzZTtcblxuICAgICAgICB0aGlzLl9taXBtYXBzID0gb3B0aW9ucy5taXBtYXBzID8/IG9wdGlvbnMuYXV0b01pcG1hcCA/PyB0cnVlO1xuICAgICAgICB0aGlzLl9taW5GaWx0ZXIgPSBvcHRpb25zLm1pbkZpbHRlciA/PyBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVI7XG4gICAgICAgIHRoaXMuX21hZ0ZpbHRlciA9IG9wdGlvbnMubWFnRmlsdGVyID8/IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgIHRoaXMuX2FuaXNvdHJvcHkgPSBvcHRpb25zLmFuaXNvdHJvcHkgPz8gMTtcbiAgICAgICAgdGhpcy5fYWRkcmVzc1UgPSBvcHRpb25zLmFkZHJlc3NVID8/IEFERFJFU1NfUkVQRUFUO1xuICAgICAgICB0aGlzLl9hZGRyZXNzViA9IG9wdGlvbnMuYWRkcmVzc1YgPz8gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgIHRoaXMuX2FkZHJlc3NXID0gb3B0aW9ucy5hZGRyZXNzVyA/PyBBRERSRVNTX1JFUEVBVDtcblxuICAgICAgICB0aGlzLl9jb21wYXJlT25SZWFkID0gb3B0aW9ucy5jb21wYXJlT25SZWFkID8/IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb21wYXJlRnVuYyA9IG9wdGlvbnMuY29tcGFyZUZ1bmMgPz8gRlVOQ19MRVNTO1xuXG4gICAgICAgIHRoaXMudHlwZSA9IFRFWFRVUkVUWVBFX0RFRkFVTFQ7XG4gICAgICAgIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCd0eXBlJykpIHtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IG9wdGlvbnMudHlwZTtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCdyZ2JtJykpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoXCJvcHRpb25zLnJnYm0gaXMgZGVwcmVjYXRlZC4gVXNlIG9wdGlvbnMudHlwZSBpbnN0ZWFkLlwiKTtcbiAgICAgICAgICAgIHRoaXMudHlwZSA9IG9wdGlvbnMucmdibSA/IFRFWFRVUkVUWVBFX1JHQk0gOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3N3aXp6bGVHR0dSJykpIHtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoXCJvcHRpb25zLnN3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBvcHRpb25zLnR5cGUgaW5zdGVhZC5cIik7XG4gICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnN3aXp6bGVHR0dSID8gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IgOiBURVhUVVJFVFlQRV9ERUZBVUxUO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gVEVYVFVSRVBST0pFQ1RJT05fTk9ORTtcbiAgICAgICAgaWYgKHRoaXMuX2N1YmVtYXApIHtcbiAgICAgICAgICAgIHRoaXMucHJvamVjdGlvbiA9IFRFWFRVUkVQUk9KRUNUSU9OX0NVQkU7XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5wcm9qZWN0aW9uICYmIG9wdGlvbnMucHJvamVjdGlvbiAhPT0gVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSkge1xuICAgICAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gb3B0aW9ucy5wcm9qZWN0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnByb2ZpbGVySGludCA9IG9wdGlvbnMucHJvZmlsZXJIaW50ID8/IDA7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuX2xldmVscyA9IG9wdGlvbnMubGV2ZWxzO1xuICAgICAgICBpZiAoIXRoaXMuX2xldmVscykge1xuICAgICAgICAgICAgdGhpcy5fbGV2ZWxzID0gdGhpcy5fY3ViZW1hcCA/IFtbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF1dIDogW251bGxdO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kaXJ0eUFsbCgpO1xuXG4gICAgICAgIHRoaXMuaW1wbCA9IGdyYXBoaWNzRGV2aWNlLmNyZWF0ZVRleHR1cmVJbXBsKHRoaXMpO1xuXG4gICAgICAgIC8vIHRyYWNrIHRoZSB0ZXh0dXJlXG4gICAgICAgIGdyYXBoaWNzRGV2aWNlLnRleHR1cmVzLnB1c2godGhpcyk7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9URVhUVVJFX0FMTE9DLCBgQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9OiAke3RoaXMud2lkdGh9eCR7dGhpcy5oZWlnaHR9IGAgK1xuICAgICAgICAgICAgYCR7dGhpcy5jdWJlbWFwID8gJ1tDdWJlbWFwXScgOiAnJ31gICtcbiAgICAgICAgICAgIGAke3RoaXMudm9sdW1lID8gJ1tWb2x1bWVdJyA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy5taXBtYXBzID8gJ1tNaXBtYXBzXScgOiAnJ31gLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgdGV4dHVyZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfVEVYVFVSRV9BTExPQywgYERlQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9YCk7XG5cbiAgICAgICAgaWYgKHRoaXMuZGV2aWNlKSB7XG4gICAgICAgICAgICAvLyBzdG9wIHRyYWNraW5nIHRoZSB0ZXh0dXJlXG4gICAgICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IGRldmljZS50ZXh0dXJlcy5pbmRleE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2UudGV4dHVyZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlbW92ZSB0ZXh0dXJlIGZyb20gYW55IHVuaWZvcm1zXG4gICAgICAgICAgICBkZXZpY2Uuc2NvcGUucmVtb3ZlVmFsdWUodGhpcyk7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgaW1wbGVtZW50YXRpb25cbiAgICAgICAgICAgIHRoaXMuaW1wbC5kZXN0cm95KGRldmljZSk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0ZXh0dXJlIHN0YXRzXG4gICAgICAgICAgICB0aGlzLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGhpcy5fZ3B1U2l6ZSk7XG5cbiAgICAgICAgICAgIHRoaXMuX2xldmVscyA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmRldmljZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgcmVuZGVyaW5nIGNvbnRleHQgd2FzIGxvc3QuIEl0IHJlbGVhc2VzIGFsbCBjb250ZXh0IHJlbGF0ZWQgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmltcGwubG9zZUNvbnRleHQoKTtcbiAgICAgICAgdGhpcy5kaXJ0eUFsbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdnJhbSBzaXplIHRyYWNraW5nIGZvciB0aGUgdGV4dHVyZSwgc2l6ZSBjYW4gYmUgcG9zaXRpdmUgdG8gYWRkIG9yIG5lZ2F0aXZlIHRvIHN1YnRyYWN0XG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYWRqdXN0VnJhbVNpemVUcmFja2luZyh2cmFtLCBzaXplKSB7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9WUkFNX1RFWFRVUkUsIGAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfSBzaXplOiAke3NpemV9IHZyYW0udGV4dHVyZTogJHt2cmFtLnRleH0gPT4gJHt2cmFtLnRleCArIHNpemV9YCk7XG5cbiAgICAgICAgdnJhbS50ZXggKz0gc2l6ZTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGlmICh0aGlzLnByb2ZpbGVySGludCA9PT0gVEVYSElOVF9TSEFET1dNQVApIHtcbiAgICAgICAgICAgIHZyYW0udGV4U2hhZG93ICs9IHNpemU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wcm9maWxlckhpbnQgPT09IFRFWEhJTlRfQVNTRVQpIHtcbiAgICAgICAgICAgIHZyYW0udGV4QXNzZXQgKz0gc2l6ZTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnByb2ZpbGVySGludCA9PT0gVEVYSElOVF9MSUdIVE1BUCkge1xuICAgICAgICAgICAgdnJhbS50ZXhMaWdodG1hcCArPSBzaXplO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgbnVtYmVyIG9mIHJlcXVpcmVkIG1pcCBsZXZlbHMgZm9yIHRoZSB0ZXh0dXJlIGJhc2VkIG9uIGl0cyBkaW1lbnNpb25zIGFuZCBwYXJhbWV0ZXJzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IHJlcXVpcmVkTWlwTGV2ZWxzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5taXBtYXBzID8gTWF0aC5mbG9vcihNYXRoLmxvZzIoTWF0aC5tYXgodGhpcy53aWR0aCwgdGhpcy5oZWlnaHQpKSkgKyAxIDogMTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWluaWZpY2F0aW9uIGZpbHRlciB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVJ9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtaW5GaWx0ZXIodikge1xuICAgICAgICBpZiAodGhpcy5fbWluRmlsdGVyICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9taW5GaWx0ZXIgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaW5GaWx0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9taW5GaWx0ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hZ25pZmljYXRpb24gZmlsdGVyIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJ9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYWdGaWx0ZXIodikge1xuICAgICAgICBpZiAodGhpcy5fbWFnRmlsdGVyICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9tYWdGaWx0ZXIgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYWdGaWx0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYWdGaWx0ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFkZHJlc3NpbmcgbW9kZSB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlIGhvcml6b250YWxseS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQUREUkVTU19SRVBFQVR9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19DTEFNUF9UT19FREdFfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYWRkcmVzc1Uodikge1xuICAgICAgICBpZiAodGhpcy5fYWRkcmVzc1UgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NVID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWRkcmVzc1UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRyZXNzVTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWRkcmVzc2luZyBtb2RlIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUgdmVydGljYWxseS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQUREUkVTU19SRVBFQVR9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19DTEFNUF9UT19FREdFfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYWRkcmVzc1Yodikge1xuICAgICAgICBpZiAodGhpcy5fYWRkcmVzc1YgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NWID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWRkcmVzc1YoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRyZXNzVjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWRkcmVzc2luZyBtb2RlIHRvIGJlIGFwcGxpZWQgdG8gdGhlIDNEIHRleHR1cmUgZGVwdGggKFdlYkdMMiBvbmx5KS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQUREUkVTU19SRVBFQVR9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19DTEFNUF9UT19FREdFfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYWRkcmVzc1coYWRkcmVzc1cpIHtcbiAgICAgICAgaWYgKCF0aGlzLmRldmljZS53ZWJnbDIpIHJldHVybjtcbiAgICAgICAgaWYgKCF0aGlzLl92b2x1bWUpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oXCJwYy5UZXh0dXJlI2FkZHJlc3NXOiBDYW4ndCBzZXQgVyBhZGRyZXNzaW5nIG1vZGUgZm9yIGEgbm9uLTNEIHRleHR1cmUuXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhZGRyZXNzVyAhPT0gdGhpcy5fYWRkcmVzc1cpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NXID0gYWRkcmVzc1c7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAxNjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhZGRyZXNzVygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZHJlc3NXO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZW4gZW5hYmxlZCwgYW5kIGlmIHRleHR1cmUgZm9ybWF0IGlzIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSH0gb3JcbiAgICAgKiB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMfSwgaGFyZHdhcmUgUENGIGlzIGVuYWJsZWQgZm9yIHRoaXMgdGV4dHVyZSwgYW5kIHlvdSBjYW4gZ2V0XG4gICAgICogZmlsdGVyZWQgcmVzdWx0cyBvZiBjb21wYXJpc29uIHVzaW5nIHRleHR1cmUoKSBpbiB5b3VyIHNoYWRlciAoV2ViR0wyIG9ubHkpLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNvbXBhcmVPblJlYWQodikge1xuICAgICAgICBpZiAodGhpcy5fY29tcGFyZU9uUmVhZCAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fY29tcGFyZU9uUmVhZCA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAzMjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjb21wYXJlT25SZWFkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29tcGFyZU9uUmVhZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb21wYXJpc29uIGZ1bmN0aW9uIHdoZW4gY29tcGFyZU9uUmVhZCBpcyBlbmFibGVkIChXZWJHTDIgb25seSkuIFBvc3NpYmxlIHZhbHVlczpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU31cbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgY29tcGFyZUZ1bmModikge1xuICAgICAgICBpZiAodGhpcy5fY29tcGFyZUZ1bmMgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBhcmVGdW5jID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDY0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbXBhcmVGdW5jKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29tcGFyZUZ1bmM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW50ZWdlciB2YWx1ZSBzcGVjaWZ5aW5nIHRoZSBsZXZlbCBvZiBhbmlzb3Ryb3BpYyB0byBhcHBseSB0byB0aGUgdGV4dHVyZSByYW5naW5nIGZyb20gMSAobm9cbiAgICAgKiBhbmlzb3Ryb3BpYyBmaWx0ZXJpbmcpIHRvIHRoZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2V9IHByb3BlcnR5IG1heEFuaXNvdHJvcHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhbmlzb3Ryb3B5KHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuaXNvdHJvcHkgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuaXNvdHJvcHkgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMTI4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuaXNvdHJvcHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmlzb3Ryb3B5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgaWYgdGV4dHVyZSBzaG91bGQgZ2VuZXJhdGUvdXBsb2FkIG1pcG1hcHMgaWYgcG9zc2libGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbWlwbWFwcyh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9taXBtYXBzICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9taXBtYXBzID0gdjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICAgICAgRGVidWcud2FybihcIlRleHR1cmUjbWlwbWFwczogbWlwbWFwIHByb3BlcnR5IGlzIGN1cnJlbnRseSBub3QgYWxsb3dlZCB0byBiZSBjaGFuZ2VkIG9uIFdlYkdQVSwgY3JlYXRlIHRoZSB0ZXh0dXJlIGFwcHJvcHJpYXRlbHkuXCIsIHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodikgdGhpcy5fbmVlZHNNaXBtYXBzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaXBtYXBzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWlwbWFwcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSB0ZXh0dXJlIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGhlaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGRlcHRoIHNsaWNlcyBpbiBhIDNEIHRleHR1cmUgKFdlYkdMMiBvbmx5KS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGRlcHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVwdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHBpeGVsIGZvcm1hdCBvZiB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTDh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTEE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjU2NX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNTU1MX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0I4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUM31cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQ1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjE2Rn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjMyRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0VUQzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUXzExMTExMEZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVNUQ180eDR9Pi9saT5cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0JBfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZm9ybWF0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZm9ybWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGlzIHRleHR1cmUgaXMgYSBjdWJlIG1hcCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGN1YmVtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdWJlbWFwO1xuICAgIH1cblxuICAgIGdldCBncHVTaXplKCkge1xuICAgICAgICBjb25zdCBtaXBzID0gdGhpcy5wb3QgJiYgdGhpcy5fbWlwbWFwcyAmJiAhKHRoaXMuX2NvbXByZXNzZWQgJiYgdGhpcy5fbGV2ZWxzLmxlbmd0aCA9PT0gMSk7XG4gICAgICAgIHJldHVybiBUZXh0dXJlLmNhbGNHcHVTaXplKHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQsIHRoaXMuX2RlcHRoLCB0aGlzLl9mb3JtYXQsIG1pcHMsIHRoaXMuX2N1YmVtYXApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGlzIHRleHR1cmUgaXMgYSAzRCB2b2x1bWUgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB2b2x1bWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92b2x1bWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgc2hvdWxkIGJlIGZsaXBwZWQgaW4gdGhlIFktZGlyZWN0aW9uLiBPbmx5IGFmZmVjdHMgdGV4dHVyZXNcbiAgICAgKiB3aXRoIGEgc291cmNlIHRoYXQgaXMgYW4gaW1hZ2UsIGNhbnZhcyBvciB2aWRlbyBlbGVtZW50LiBEb2VzIG5vdCBhZmZlY3QgY3ViZW1hcHMsXG4gICAgICogY29tcHJlc3NlZCB0ZXh0dXJlcyBvciB0ZXh0dXJlcyBzZXQgZnJvbSByYXcgcGl4ZWwgZGF0YS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmbGlwWShmbGlwWSkge1xuICAgICAgICBpZiAodGhpcy5fZmxpcFkgIT09IGZsaXBZKSB7XG4gICAgICAgICAgICB0aGlzLl9mbGlwWSA9IGZsaXBZO1xuICAgICAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZsaXBZKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmxpcFk7XG4gICAgfVxuXG4gICAgc2V0IHByZW11bHRpcGx5QWxwaGEocHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICBpZiAodGhpcy5fcHJlbXVsdGlwbHlBbHBoYSAhPT0gcHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICAgICAgdGhpcy5fcHJlbXVsdGlwbHlBbHBoYSA9IHByZW11bHRpcGx5QWxwaGE7XG4gICAgICAgICAgICB0aGlzLl9uZWVkc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcHJlbXVsdGlwbHlBbHBoYSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZW11bHRpcGx5QWxwaGE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIGFsbCBkaW1lbnNpb25zIG9mIHRoZSB0ZXh0dXJlIGFyZSBwb3dlciBvZiB0d28sIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgcG90KCkge1xuICAgICAgICByZXR1cm4gbWF0aC5wb3dlck9mVHdvKHRoaXMuX3dpZHRoKSAmJiBtYXRoLnBvd2VyT2ZUd28odGhpcy5faGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvLyBnZXQgdGhlIHRleHR1cmUncyBlbmNvZGluZyB0eXBlXG4gICAgZ2V0IGVuY29kaW5nKCkge1xuICAgICAgICBzd2l0Y2ggKHRoaXMudHlwZSkge1xuICAgICAgICAgICAgY2FzZSBURVhUVVJFVFlQRV9SR0JNOlxuICAgICAgICAgICAgICAgIHJldHVybiAncmdibSc7XG4gICAgICAgICAgICBjYXNlIFRFWFRVUkVUWVBFX1JHQkU6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdyZ2JlJztcbiAgICAgICAgICAgIGNhc2UgVEVYVFVSRVRZUEVfUkdCUDpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JnYnAnO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gKHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0IxNkYgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0IzMkYgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMTZGIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTMyRikgPyAnbGluZWFyJyA6ICdzcmdiJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHN0YXRpYyBmdW5jdGlvbnNcbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGUgdGhlIEdQVSBtZW1vcnkgcmVxdWlyZWQgZm9yIGEgdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRleHR1cmUncyB3aWR0aC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGV4dHVyZSdzIGhlaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVwdGggLSBUZXh0dXJlJ3MgZGVwdGguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZvcm1hdCAtIFRleHR1cmUncyBwaXhlbCBmb3JtYXQgUElYRUxGT1JNQVRfKioqLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbWlwbWFwcyAtIFRydWUgaWYgdGhlIHRleHR1cmUgaW5jbHVkZXMgbWlwbWFwcywgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gY3ViZW1hcCAtIFRydWUgaXMgdGhlIHRleHR1cmUgaXMgYSBjdWJlbWFwLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG51bWJlciBvZiBieXRlcyBvZiBHUFUgbWVtb3J5IHJlcXVpcmVkIGZvciB0aGUgdGV4dHVyZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RhdGljIGNhbGNHcHVTaXplKHdpZHRoLCBoZWlnaHQsIGRlcHRoLCBmb3JtYXQsIG1pcG1hcHMsIGN1YmVtYXApIHtcbiAgICAgICAgaWYgKCFfYmxvY2tTaXplVGFibGUpIHtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZSA9IFtdO1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0VUQzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9FVEMyX1JHQl0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0RYVDFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9BVENfUkdCXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRVRDMl9SR0JBXSA9IDE2O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0RYVDNdID0gMTY7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRFhUNV0gPSAxNjtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9BU1RDXzR4NF0gPSAxNjtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9BVENfUkdCQV0gPSAxNjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBpeGVsU2l6ZSA9IHBpeGVsRm9ybWF0Qnl0ZVNpemVzW2Zvcm1hdF0gPz8gMDtcbiAgICAgICAgY29uc3QgYmxvY2tTaXplID0gX2Jsb2NrU2l6ZVRhYmxlLmhhc093blByb3BlcnR5KGZvcm1hdCkgPyBfYmxvY2tTaXplVGFibGVbZm9ybWF0XSA6IDA7XG4gICAgICAgIGxldCByZXN1bHQgPSAwO1xuXG4gICAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgICAgICBpZiAocGl4ZWxTaXplID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSB1bmNvbXByZXNzZWQgZm9ybWF0c1xuICAgICAgICAgICAgICAgIHJlc3VsdCArPSB3aWR0aCAqIGhlaWdodCAqIGRlcHRoICogcGl4ZWxTaXplO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBoYW5kbGUgYmxvY2sgZm9ybWF0c1xuICAgICAgICAgICAgICAgIGxldCBibG9ja1dpZHRoID0gTWF0aC5mbG9vcigod2lkdGggKyAzKSAvIDQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJsb2NrSGVpZ2h0ID0gTWF0aC5mbG9vcigoaGVpZ2h0ICsgMykgLyA0KTtcbiAgICAgICAgICAgICAgICBjb25zdCBibG9ja0RlcHRoID0gTWF0aC5mbG9vcigoZGVwdGggKyAzKSAvIDQpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSB8fFxuICAgICAgICAgICAgICAgICAgICBmb3JtYXQgPT09IFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2NrV2lkdGggPSBNYXRoLm1heChNYXRoLmZsb29yKGJsb2NrV2lkdGggLyAyKSwgMSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzdWx0ICs9IGJsb2NrV2lkdGggKiBibG9ja0hlaWdodCAqIGJsb2NrRGVwdGggKiBibG9ja1NpemU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB3ZSdyZSBkb25lIGlmIG1pcG1hcHMgYXJlbid0IHJlcXVpcmVkIG9yIHdlJ3ZlIGNhbGN1bGF0ZWQgdGhlIHNtYWxsZXN0IG1pcG1hcCBsZXZlbFxuICAgICAgICAgICAgaWYgKCFtaXBtYXBzIHx8ICgod2lkdGggPT09IDEpICYmIChoZWlnaHQgPT09IDEpICYmIChkZXB0aCA9PT0gMSkpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aWR0aCA9IE1hdGgubWF4KE1hdGguZmxvb3Iod2lkdGggLyAyKSwgMSk7XG4gICAgICAgICAgICBoZWlnaHQgPSBNYXRoLm1heChNYXRoLmZsb29yKGhlaWdodCAvIDIpLCAxKTtcbiAgICAgICAgICAgIGRlcHRoID0gTWF0aC5tYXgoTWF0aC5mbG9vcihkZXB0aCAvIDIpLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQgKiAoY3ViZW1hcCA/IDYgOiAxKTtcbiAgICB9XG5cbiAgICAvLyBGb3JjZSBhIGZ1bGwgcmVzdWJtaXNzaW9uIG9mIHRoZSB0ZXh0dXJlIHRvIFdlYkdMICh1c2VkIG9uIGEgY29udGV4dCByZXN0b3JlIGV2ZW50KVxuICAgIGRpcnR5QWxsKCkge1xuICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkID0gdGhpcy5fY3ViZW1hcCA/IFtbdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZV1dIDogW3RydWVdO1xuXG4gICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbmVlZHNNaXBtYXBzVXBsb2FkID0gdGhpcy5fbWlwbWFwcztcbiAgICAgICAgdGhpcy5fbWlwbWFwc1VwbG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgPSAyNTU7IC8vIDEgfCAyIHwgNCB8IDggfCAxNiB8IDMyIHwgNjQgfCAxMjhcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2NrcyBhIG1pcGxldmVsIG9mIHRoZSB0ZXh0dXJlLCByZXR1cm5pbmcgYSB0eXBlZCBhcnJheSB0byBiZSBmaWxsZWQgd2l0aCBwaXhlbCBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0LiBWYWxpZCBwcm9wZXJ0aWVzIGFyZSBhcyBmb2xsb3dzOlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5sZXZlbF0gLSBUaGUgbWlwIGxldmVsIHRvIGxvY2sgd2l0aCAwIGJlaW5nIHRoZSB0b3AgbGV2ZWwuIERlZmF1bHRzXG4gICAgICogdG8gMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmFjZV0gLSBJZiB0aGUgdGV4dHVyZSBpcyBhIGN1YmVtYXAsIHRoaXMgaXMgdGhlIGluZGV4IG9mIHRoZSBmYWNlXG4gICAgICogdG8gbG9jay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubW9kZV0gLSBUaGUgbG9jayBtb2RlLiBDYW4gYmU6XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRUxPQ0tfUkVBRH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFTE9DS19XUklURX1cbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgVEVYVFVSRUxPQ0tfV1JJVEV9LlxuICAgICAqIEByZXR1cm5zIHtVaW50OEFycmF5fFVpbnQxNkFycmF5fEZsb2F0MzJBcnJheX0gQSB0eXBlZCBhcnJheSBjb250YWluaW5nIHRoZSBwaXhlbCBkYXRhIG9mXG4gICAgICogdGhlIGxvY2tlZCBtaXAgbGV2ZWwuXG4gICAgICovXG4gICAgbG9jayhvcHRpb25zID0ge30pIHtcbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBvcHRpb25zIHRvIHNvbWUgc2Vuc2libGUgZGVmYXVsdHNcbiAgICAgICAgaWYgKG9wdGlvbnMubGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5sZXZlbCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFjZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLmZhY2UgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLm1vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5tb2RlID0gVEVYVFVSRUxPQ0tfV1JJVEU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IG9wdGlvbnMubGV2ZWw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgc3dpdGNoICh0aGlzLl9mb3JtYXQpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0E4OlxuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfTDg6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0xBODpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiAgdGhpcy5fZGVwdGggKiAyKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0I1NjU6XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBNTU1MTpcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE0OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDE2QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCODpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE4OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogNCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUMTpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkoTWF0aC5mbG9vcigodGhpcy5fd2lkdGggKyAzKSAvIDQpICogTWF0aC5mbG9vcigodGhpcy5faGVpZ2h0ICsgMykgLyA0KSAqIDggKiB0aGlzLl9kZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUMzpcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RYVDU6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KE1hdGguZmxvb3IoKHRoaXMuX3dpZHRoICsgMykgLyA0KSAqIE1hdGguZmxvb3IoKHRoaXMuX2hlaWdodCArIDMpIC8gNCkgKiAxNiAqIHRoaXMuX2RlcHRoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IxNkY6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50MTZBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogMyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMzJGOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiAzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMTZGOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDE2QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkEzMkY6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBwaXhlbCBkYXRhIG9mIHRoZSB0ZXh0dXJlIGZyb20gYSBjYW52YXMsIGltYWdlLCB2aWRlbyBET00gZWxlbWVudC4gSWYgdGhlIHRleHR1cmUgaXNcbiAgICAgKiBhIGN1YmVtYXAsIHRoZSBzdXBwbGllZCBzb3VyY2UgbXVzdCBiZSBhbiBhcnJheSBvZiA2IGNhbnZhc2VzLCBpbWFnZXMgb3IgdmlkZW9zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudHxIVE1MSW1hZ2VFbGVtZW50fEhUTUxWaWRlb0VsZW1lbnR8SFRNTENhbnZhc0VsZW1lbnRbXXxIVE1MSW1hZ2VFbGVtZW50W118SFRNTFZpZGVvRWxlbWVudFtdfSBzb3VyY2UgLSBBXG4gICAgICogY2FudmFzLCBpbWFnZSBvciB2aWRlbyBlbGVtZW50LCBvciBhbiBhcnJheSBvZiA2IGNhbnZhcywgaW1hZ2Ugb3IgdmlkZW8gZWxlbWVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttaXBMZXZlbF0gLSBBIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIGltYWdlIGxldmVsIG9mIGRldGFpbC5cbiAgICAgKiBEZWZhdWx0cyB0byAwLCB3aGljaCByZXByZXNlbnRzIHRoZSBiYXNlIGltYWdlIHNvdXJjZS4gQSBsZXZlbCB2YWx1ZSBvZiBOLCB0aGF0IGlzIGdyZWF0ZXJcbiAgICAgKiB0aGFuIDAsIHJlcHJlc2VudHMgdGhlIGltYWdlIHNvdXJjZSBmb3IgdGhlIE50aCBtaXBtYXAgcmVkdWN0aW9uIGxldmVsLlxuICAgICAqL1xuICAgIHNldFNvdXJjZShzb3VyY2UsIG1pcExldmVsID0gMCkge1xuICAgICAgICBsZXQgaW52YWxpZCA9IGZhbHNlO1xuICAgICAgICBsZXQgd2lkdGgsIGhlaWdodDtcblxuICAgICAgICBpZiAodGhpcy5fY3ViZW1hcCkge1xuICAgICAgICAgICAgaWYgKHNvdXJjZVswXSkge1xuICAgICAgICAgICAgICAgIC8vIHJlbHkgb24gZmlyc3QgZmFjZSBzaXplc1xuICAgICAgICAgICAgICAgIHdpZHRoID0gc291cmNlWzBdLndpZHRoIHx8IDA7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gc291cmNlWzBdLmhlaWdodCB8fCAwO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmFjZSA9IHNvdXJjZVtpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY3ViZW1hcCBiZWNvbWVzIGludmFsaWQgaWYgYW55IGNvbmRpdGlvbiBpcyBub3Qgc2F0aXNmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmICghZmFjZSB8fCAgICAgICAgICAgICAgICAgIC8vIGZhY2UgaXMgbWlzc2luZ1xuICAgICAgICAgICAgICAgICAgICAgICAgZmFjZS53aWR0aCAhPT0gd2lkdGggfHwgICAvLyBmYWNlIGlzIGRpZmZlcmVudCB3aWR0aFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFjZS5oZWlnaHQgIT09IGhlaWdodCB8fCAvLyBmYWNlIGlzIGRpZmZlcmVudCBoZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgICF0aGlzLmRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKGZhY2UpKSB7ICAgICAgICAgICAgLy8gbmV3IGltYWdlIGJpdG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gZmlyc3QgZmFjZSBpcyBtaXNzaW5nXG4gICAgICAgICAgICAgICAgaW52YWxpZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghaW52YWxpZCkge1xuICAgICAgICAgICAgICAgIC8vIG1hcmsgbGV2ZWxzIGFzIHVwZGF0ZWRcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fbGV2ZWxzW21pcExldmVsXVtpXSAhPT0gc291cmNlW2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF1baV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHNvdXJjZSBpcyB2YWxpZCB0eXBlIG9mIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICghdGhpcy5kZXZpY2UuX2lzQnJvd3NlckludGVyZmFjZShzb3VyY2UpKVxuICAgICAgICAgICAgICAgIGludmFsaWQgPSB0cnVlO1xuXG4gICAgICAgICAgICBpZiAoIWludmFsaWQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXJrIGxldmVsIGFzIHVwZGF0ZWRcbiAgICAgICAgICAgICAgICBpZiAoc291cmNlICE9PSB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB3aWR0aCA9IHNvdXJjZS53aWR0aDtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSBzb3VyY2UuaGVpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGludmFsaWQpIHtcbiAgICAgICAgICAgIC8vIGludmFsaWQgdGV4dHVyZVxuXG4gICAgICAgICAgICAvLyBkZWZhdWx0IHNpemVzXG4gICAgICAgICAgICB0aGlzLl93aWR0aCA9IDQ7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSA0O1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgbGV2ZWxzXG4gICAgICAgICAgICBpZiAodGhpcy5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1ttaXBMZXZlbF1baV0gPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXVtpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB2YWxpZCB0ZXh0dXJlXG4gICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgICAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW21pcExldmVsXSA9IHNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIG9yIGNoYW5nZWQgc3RhdGUgb2YgdmFsaWRpdHlcbiAgICAgICAgaWYgKHRoaXMuX2ludmFsaWQgIT09IGludmFsaWQgfHwgIWludmFsaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2ludmFsaWQgPSBpbnZhbGlkO1xuXG4gICAgICAgICAgICAvLyByZXVwbG9hZFxuICAgICAgICAgICAgdGhpcy51cGxvYWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGl4ZWwgZGF0YSBvZiB0aGUgdGV4dHVyZS4gSWYgdGhpcyBpcyBhIGN1YmVtYXAgdGhlbiBhbiBhcnJheSBvZiA2IGltYWdlcyB3aWxsIGJlXG4gICAgICogcmV0dXJuZWQgb3RoZXJ3aXNlIGEgc2luZ2xlIGltYWdlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttaXBMZXZlbF0gLSBBIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIGltYWdlIGxldmVsIG9mIGRldGFpbC5cbiAgICAgKiBEZWZhdWx0cyB0byAwLCB3aGljaCByZXByZXNlbnRzIHRoZSBiYXNlIGltYWdlIHNvdXJjZS4gQSBsZXZlbCB2YWx1ZSBvZiBOLCB0aGF0IGlzIGdyZWF0ZXJcbiAgICAgKiB0aGFuIDAsIHJlcHJlc2VudHMgdGhlIGltYWdlIHNvdXJjZSBmb3IgdGhlIE50aCBtaXBtYXAgcmVkdWN0aW9uIGxldmVsLlxuICAgICAqIEByZXR1cm5zIHtIVE1MSW1hZ2VFbGVtZW50fSBUaGUgc291cmNlIGltYWdlIG9mIHRoaXMgdGV4dHVyZS4gQ2FuIGJlIG51bGwgaWYgc291cmNlIG5vdFxuICAgICAqIGFzc2lnbmVkIGZvciBzcGVjaWZpYyBpbWFnZSBsZXZlbC5cbiAgICAgKi9cbiAgICBnZXRTb3VyY2UobWlwTGV2ZWwgPSAwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVubG9ja3MgdGhlIGN1cnJlbnRseSBsb2NrZWQgbWlwIGxldmVsIGFuZCB1cGxvYWRzIGl0IHRvIFZSQU0uXG4gICAgICovXG4gICAgdW5sb2NrKCkge1xuICAgICAgICBpZiAodGhpcy5fbG9ja2VkTGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coXCJwYy5UZXh0dXJlI3VubG9jazogQXR0ZW1wdGluZyB0byB1bmxvY2sgYSB0ZXh0dXJlIHRoYXQgaXMgbm90IGxvY2tlZC5cIiwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGxvYWQgdGhlIG5ldyBwaXhlbCBkYXRhXG4gICAgICAgIHRoaXMudXBsb2FkKCk7XG4gICAgICAgIHRoaXMuX2xvY2tlZExldmVsID0gLTE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9yY2VzIGEgcmV1cGxvYWQgb2YgdGhlIHRleHR1cmVzIHBpeGVsIGRhdGEgdG8gZ3JhcGhpY3MgbWVtb3J5LiBPcmRpbmFyaWx5LCB0aGlzIGZ1bmN0aW9uXG4gICAgICogaXMgY2FsbGVkIGJ5IGludGVybmFsbHkgYnkge0BsaW5rIFRleHR1cmUjc2V0U291cmNlfSBhbmQge0BsaW5rIFRleHR1cmUjdW5sb2NrfS4gSG93ZXZlciwgaXRcbiAgICAgKiBzdGlsbCBuZWVkcyB0byBiZSBjYWxsZWQgZXhwbGljaXRseSBpbiB0aGUgY2FzZSB3aGVyZSBhbiBIVE1MVmlkZW9FbGVtZW50IGlzIHNldCBhcyB0aGVcbiAgICAgKiBzb3VyY2Ugb2YgdGhlIHRleHR1cmUuICBOb3JtYWxseSwgdGhpcyBpcyBkb25lIG9uY2UgZXZlcnkgZnJhbWUgYmVmb3JlIHZpZGVvIHRleHR1cmVkXG4gICAgICogZ2VvbWV0cnkgaXMgcmVuZGVyZWQuXG4gICAgICovXG4gICAgdXBsb2FkKCkge1xuICAgICAgICB0aGlzLl9uZWVkc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX25lZWRzTWlwbWFwc1VwbG9hZCA9IHRoaXMuX21pcG1hcHM7XG4gICAgICAgIHRoaXMuaW1wbC51cGxvYWRJbW1lZGlhdGU/Lih0aGlzLmRldmljZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGUgYW4gaW4tbWVtb3J5IEREUyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIHRleHR1cmUuIE9ubHkgd29ya3Mgb24gUkdCQTggdGV4dHVyZXMuXG4gICAgICogQ3VycmVudGx5LCBvbmx5IHVzZWQgYnkgdGhlIEVkaXRvciB0byB3cml0ZSBwcmVmaWx0ZXJlZCBjdWJlbWFwcyB0byBERFMgZm9ybWF0LlxuICAgICAqXG4gICAgICogQHJldHVybnMge0FycmF5QnVmZmVyfSBCdWZmZXIgY29udGFpbmluZyB0aGUgRERTIGRhdGEuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldERkcygpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOCwgXCJUaGlzIGZvcm1hdCBpcyBub3QgaW1wbGVtZW50ZWQgeWV0XCIpO1xuXG4gICAgICAgIGxldCBmc2l6ZSA9IDEyODtcbiAgICAgICAgbGV0IGlkeCA9IDA7XG4gICAgICAgIHdoaWxlICh0aGlzLl9sZXZlbHNbaWR4XSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1YmVtYXApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaXBTaXplID0gdGhpcy5fbGV2ZWxzW2lkeF0ubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGlmICghbWlwU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgTm8gYnl0ZSBhcnJheSBmb3IgbWlwICR7aWR4fWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmc2l6ZSArPSBtaXBTaXplO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBmYWNlID0gMDsgZmFjZSA8IDY7IGZhY2UrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2xldmVsc1tpZHhdW2ZhY2VdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgTm8gbGV2ZWwgZGF0YSBmb3IgbWlwICR7aWR4fSwgZmFjZSAke2ZhY2V9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pcFNpemUgPSB0aGlzLl9sZXZlbHNbaWR4XVtmYWNlXS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbWlwU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYE5vIGJ5dGUgYXJyYXkgZm9yIG1pcCAke2lkeH0sIGZhY2UgJHtmYWNlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmc2l6ZSArPSBtaXBTaXplO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZzaXplICs9IHRoaXMuX2xldmVsc1tpZHhdLmxlbmd0aDtcbiAgICAgICAgICAgIGlkeCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYnVmZiA9IG5ldyBBcnJheUJ1ZmZlcihmc2l6ZSk7XG4gICAgICAgIGNvbnN0IGhlYWRlciA9IG5ldyBVaW50MzJBcnJheShidWZmLCAwLCAxMjggLyA0KTtcblxuICAgICAgICBjb25zdCBERFNfTUFHSUMgPSA1NDIzMjc4NzY7IC8vIFwiRERTXCJcbiAgICAgICAgY29uc3QgRERTX0hFQURFUl9TSVpFID0gMTI0O1xuICAgICAgICBjb25zdCBERFNfRkxBR1NfUkVRVUlSRUQgPSAweDAxIHwgMHgwMiB8IDB4MDQgfCAweDEwMDAgfCAweDgwMDAwOyAvLyBjYXBzIHwgaGVpZ2h0IHwgd2lkdGggfCBwaXhlbGZvcm1hdCB8IGxpbmVhcnNpemVcbiAgICAgICAgY29uc3QgRERTX0ZMQUdTX01JUE1BUCA9IDB4MjAwMDA7XG4gICAgICAgIGNvbnN0IEREU19QSVhFTEZPUk1BVF9TSVpFID0gMzI7XG4gICAgICAgIGNvbnN0IEREU19QSVhFTEZMQUdTX1JHQkE4ID0gMHgwMSB8IDB4NDA7IC8vIGFscGhhIHwgcmdiXG4gICAgICAgIGNvbnN0IEREU19DQVBTX1JFUVVJUkVEID0gMHgxMDAwO1xuICAgICAgICBjb25zdCBERFNfQ0FQU19NSVBNQVAgPSAweDQwMDAwMDtcbiAgICAgICAgY29uc3QgRERTX0NBUFNfQ09NUExFWCA9IDB4ODtcbiAgICAgICAgY29uc3QgRERTX0NBUFMyX0NVQkVNQVAgPSAweDIwMCB8IDB4NDAwIHwgMHg4MDAgfCAweDEwMDAgfCAweDIwMDAgfCAweDQwMDAgfCAweDgwMDA7IC8vIGN1YmVtYXAgfCBhbGwgZmFjZXNcblxuICAgICAgICBsZXQgZmxhZ3MgPSBERFNfRkxBR1NfUkVRVUlSRUQ7XG4gICAgICAgIGlmICh0aGlzLl9sZXZlbHMubGVuZ3RoID4gMSkgZmxhZ3MgfD0gRERTX0ZMQUdTX01JUE1BUDtcblxuICAgICAgICBsZXQgY2FwcyA9IEREU19DQVBTX1JFUVVJUkVEO1xuICAgICAgICBpZiAodGhpcy5fbGV2ZWxzLmxlbmd0aCA+IDEpIGNhcHMgfD0gRERTX0NBUFNfTUlQTUFQO1xuICAgICAgICBpZiAodGhpcy5fbGV2ZWxzLmxlbmd0aCA+IDEgfHwgdGhpcy5jdWJlbWFwKSBjYXBzIHw9IEREU19DQVBTX0NPTVBMRVg7XG5cbiAgICAgICAgY29uc3QgY2FwczIgPSB0aGlzLmN1YmVtYXAgPyBERFNfQ0FQUzJfQ1VCRU1BUCA6IDA7XG5cbiAgICAgICAgaGVhZGVyWzBdID0gRERTX01BR0lDO1xuICAgICAgICBoZWFkZXJbMV0gPSBERFNfSEVBREVSX1NJWkU7XG4gICAgICAgIGhlYWRlclsyXSA9IGZsYWdzO1xuICAgICAgICBoZWFkZXJbM10gPSB0aGlzLmhlaWdodDtcbiAgICAgICAgaGVhZGVyWzRdID0gdGhpcy53aWR0aDtcbiAgICAgICAgaGVhZGVyWzVdID0gdGhpcy53aWR0aCAqIHRoaXMuaGVpZ2h0ICogNDtcbiAgICAgICAgaGVhZGVyWzZdID0gMDsgLy8gZGVwdGhcbiAgICAgICAgaGVhZGVyWzddID0gdGhpcy5fbGV2ZWxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAxMTsgaSsrKSB7XG4gICAgICAgICAgICBoZWFkZXJbOCArIGldID0gMDtcbiAgICAgICAgfVxuICAgICAgICBoZWFkZXJbMTldID0gRERTX1BJWEVMRk9STUFUX1NJWkU7XG4gICAgICAgIGhlYWRlclsyMF0gPSBERFNfUElYRUxGTEFHU19SR0JBODtcbiAgICAgICAgaGVhZGVyWzIxXSA9IDA7IC8vIGZvdXJjY1xuICAgICAgICBoZWFkZXJbMjJdID0gMzI7IC8vIGJwcFxuICAgICAgICBoZWFkZXJbMjNdID0gMHgwMEZGMDAwMDsgLy8gUiBtYXNrXG4gICAgICAgIGhlYWRlclsyNF0gPSAweDAwMDBGRjAwOyAvLyBHIG1hc2tcbiAgICAgICAgaGVhZGVyWzI1XSA9IDB4MDAwMDAwRkY7IC8vIEIgbWFza1xuICAgICAgICBoZWFkZXJbMjZdID0gMHhGRjAwMDAwMDsgLy8gQSBtYXNrXG4gICAgICAgIGhlYWRlclsyN10gPSBjYXBzO1xuICAgICAgICBoZWFkZXJbMjhdID0gY2FwczI7XG4gICAgICAgIGhlYWRlclsyOV0gPSAwO1xuICAgICAgICBoZWFkZXJbMzBdID0gMDtcbiAgICAgICAgaGVhZGVyWzMxXSA9IDA7XG5cbiAgICAgICAgbGV0IG9mZnNldCA9IDEyODtcbiAgICAgICAgaWYgKCF0aGlzLmN1YmVtYXApIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbWlwID0gbmV3IFVpbnQ4QXJyYXkoYnVmZiwgb2Zmc2V0LCBsZXZlbC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGV2ZWwubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlwW2pdID0gbGV2ZWxbal07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9mZnNldCArPSBsZXZlbC5sZW5ndGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGxldCBmYWNlID0gMDsgZmFjZSA8IDY7IGZhY2UrKykge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxldmVsID0gdGhpcy5fbGV2ZWxzW2ldW2ZhY2VdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtaXAgPSBuZXcgVWludDhBcnJheShidWZmLCBvZmZzZXQsIGxldmVsLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGV2ZWwubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pcFtqXSA9IGxldmVsW2pdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG9mZnNldCArPSBsZXZlbC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJ1ZmY7XG4gICAgfVxufVxuXG5leHBvcnQgeyBUZXh0dXJlIH07XG4iXSwibmFtZXMiOlsiX2Jsb2NrU2l6ZVRhYmxlIiwiaWQiLCJUZXh0dXJlIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsIm9wdGlvbnMiLCJfb3B0aW9ucyRuYW1lIiwiX29wdGlvbnMkd2lkdGgiLCJfb3B0aW9ucyRoZWlnaHQiLCJfb3B0aW9ucyRmb3JtYXQiLCJfb3B0aW9ucyRjdWJlbWFwIiwiX29wdGlvbnMkZml4Q3ViZW1hcFNlIiwiX29wdGlvbnMkZmxpcFkiLCJfb3B0aW9ucyRwcmVtdWx0aXBseUEiLCJfcmVmIiwiX29wdGlvbnMkbWlwbWFwcyIsIl9vcHRpb25zJG1pbkZpbHRlciIsIl9vcHRpb25zJG1hZ0ZpbHRlciIsIl9vcHRpb25zJGFuaXNvdHJvcHkiLCJfb3B0aW9ucyRhZGRyZXNzVSIsIl9vcHRpb25zJGFkZHJlc3NWIiwiX29wdGlvbnMkYWRkcmVzc1ciLCJfb3B0aW9ucyRjb21wYXJlT25SZWEiLCJfb3B0aW9ucyRjb21wYXJlRnVuYyIsIl9vcHRpb25zJHByb2ZpbGVySGludCIsIm5hbWUiLCJfaXNSZW5kZXJUYXJnZXQiLCJfZ3B1U2l6ZSIsIl9pbnZhbGlkIiwiX2xvY2tlZExldmVsIiwiZGV2aWNlIiwiRGVidWciLCJhc3NlcnQiLCJfd2lkdGgiLCJ3aWR0aCIsIl9oZWlnaHQiLCJoZWlnaHQiLCJfZm9ybWF0IiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJfY29tcHJlc3NlZCIsImlzQ29tcHJlc3NlZFBpeGVsRm9ybWF0Iiwid2ViZ2wyIiwiX29wdGlvbnMkdm9sdW1lIiwiX29wdGlvbnMkZGVwdGgiLCJfdm9sdW1lIiwidm9sdW1lIiwiX2RlcHRoIiwiZGVwdGgiLCJfY3ViZW1hcCIsImN1YmVtYXAiLCJmaXhDdWJlbWFwU2VhbXMiLCJfZmxpcFkiLCJmbGlwWSIsIl9wcmVtdWx0aXBseUFscGhhIiwicHJlbXVsdGlwbHlBbHBoYSIsIl9taXBtYXBzIiwibWlwbWFwcyIsImF1dG9NaXBtYXAiLCJfbWluRmlsdGVyIiwibWluRmlsdGVyIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiX21hZ0ZpbHRlciIsIm1hZ0ZpbHRlciIsIkZJTFRFUl9MSU5FQVIiLCJfYW5pc290cm9weSIsImFuaXNvdHJvcHkiLCJfYWRkcmVzc1UiLCJhZGRyZXNzVSIsIkFERFJFU1NfUkVQRUFUIiwiX2FkZHJlc3NWIiwiYWRkcmVzc1YiLCJfYWRkcmVzc1ciLCJhZGRyZXNzVyIsIl9jb21wYXJlT25SZWFkIiwiY29tcGFyZU9uUmVhZCIsIl9jb21wYXJlRnVuYyIsImNvbXBhcmVGdW5jIiwiRlVOQ19MRVNTIiwidHlwZSIsIlRFWFRVUkVUWVBFX0RFRkFVTFQiLCJoYXNPd25Qcm9wZXJ0eSIsImRlcHJlY2F0ZWQiLCJyZ2JtIiwiVEVYVFVSRVRZUEVfUkdCTSIsInN3aXp6bGVHR0dSIiwiVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IiLCJwcm9qZWN0aW9uIiwiVEVYVFVSRVBST0pFQ1RJT05fTk9ORSIsIlRFWFRVUkVQUk9KRUNUSU9OX0NVQkUiLCJwcm9maWxlckhpbnQiLCJfbGV2ZWxzIiwibGV2ZWxzIiwiZGlydHlBbGwiLCJpbXBsIiwiY3JlYXRlVGV4dHVyZUltcGwiLCJ0ZXh0dXJlcyIsInB1c2giLCJ0cmFjZSIsIlRSQUNFSURfVEVYVFVSRV9BTExPQyIsImRlc3Ryb3kiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwic2NvcGUiLCJyZW1vdmVWYWx1ZSIsImFkanVzdFZyYW1TaXplVHJhY2tpbmciLCJfdnJhbSIsImxvc2VDb250ZXh0IiwidnJhbSIsInNpemUiLCJUUkFDRUlEX1ZSQU1fVEVYVFVSRSIsInRleCIsIlRFWEhJTlRfU0hBRE9XTUFQIiwidGV4U2hhZG93IiwiVEVYSElOVF9BU1NFVCIsInRleEFzc2V0IiwiVEVYSElOVF9MSUdIVE1BUCIsInRleExpZ2h0bWFwIiwicmVxdWlyZWRNaXBMZXZlbHMiLCJNYXRoIiwiZmxvb3IiLCJsb2cyIiwibWF4IiwidiIsIl9wYXJhbWV0ZXJGbGFncyIsIndhcm4iLCJpc1dlYkdQVSIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJncHVTaXplIiwibWlwcyIsInBvdCIsImxlbmd0aCIsImNhbGNHcHVTaXplIiwiX25lZWRzVXBsb2FkIiwibWF0aCIsInBvd2VyT2ZUd28iLCJlbmNvZGluZyIsIlRFWFRVUkVUWVBFX1JHQkUiLCJURVhUVVJFVFlQRV9SR0JQIiwiUElYRUxGT1JNQVRfUkdCMTZGIiwiUElYRUxGT1JNQVRfUkdCMzJGIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJfcGl4ZWxGb3JtYXRCeXRlU2l6ZXMiLCJQSVhFTEZPUk1BVF9FVEMxIiwiUElYRUxGT1JNQVRfRVRDMl9SR0IiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9EWFQxIiwiUElYRUxGT1JNQVRfQVRDX1JHQiIsIlBJWEVMRk9STUFUX0VUQzJfUkdCQSIsIlBJWEVMRk9STUFUX0RYVDMiLCJQSVhFTEZPUk1BVF9EWFQ1IiwiUElYRUxGT1JNQVRfQVNUQ180eDQiLCJQSVhFTEZPUk1BVF9BVENfUkdCQSIsInBpeGVsU2l6ZSIsInBpeGVsRm9ybWF0Qnl0ZVNpemVzIiwiYmxvY2tTaXplIiwicmVzdWx0IiwiYmxvY2tXaWR0aCIsImJsb2NrSGVpZ2h0IiwiYmxvY2tEZXB0aCIsIl9sZXZlbHNVcGRhdGVkIiwiX21pcG1hcHNVcGxvYWRlZCIsImxvY2siLCJsZXZlbCIsInVuZGVmaW5lZCIsImZhY2UiLCJtb2RlIiwiVEVYVFVSRUxPQ0tfV1JJVEUiLCJQSVhFTEZPUk1BVF9BOCIsIlBJWEVMRk9STUFUX0w4IiwiVWludDhBcnJheSIsIlBJWEVMRk9STUFUX0xBOCIsIlBJWEVMRk9STUFUX1JHQjU2NSIsIlBJWEVMRk9STUFUX1JHQkE1NTUxIiwiUElYRUxGT1JNQVRfUkdCQTQiLCJVaW50MTZBcnJheSIsIlBJWEVMRk9STUFUX1JHQjgiLCJGbG9hdDMyQXJyYXkiLCJzZXRTb3VyY2UiLCJzb3VyY2UiLCJtaXBMZXZlbCIsImludmFsaWQiLCJpIiwiX2lzQnJvd3NlckludGVyZmFjZSIsInVwbG9hZCIsImdldFNvdXJjZSIsInVubG9jayIsImxvZyIsIl90aGlzJGltcGwkdXBsb2FkSW1tZSIsIl90aGlzJGltcGwiLCJ1cGxvYWRJbW1lZGlhdGUiLCJjYWxsIiwiZ2V0RGRzIiwiZnNpemUiLCJtaXBTaXplIiwiZXJyb3IiLCJidWZmIiwiQXJyYXlCdWZmZXIiLCJoZWFkZXIiLCJVaW50MzJBcnJheSIsIkREU19NQUdJQyIsIkREU19IRUFERVJfU0laRSIsIkREU19GTEFHU19SRVFVSVJFRCIsIkREU19GTEFHU19NSVBNQVAiLCJERFNfUElYRUxGT1JNQVRfU0laRSIsIkREU19QSVhFTEZMQUdTX1JHQkE4IiwiRERTX0NBUFNfUkVRVUlSRUQiLCJERFNfQ0FQU19NSVBNQVAiLCJERFNfQ0FQU19DT01QTEVYIiwiRERTX0NBUFMyX0NVQkVNQVAiLCJmbGFncyIsImNhcHMiLCJjYXBzMiIsIm9mZnNldCIsIm1pcCIsImoiXSwibWFwcGluZ3MiOiI7Ozs7O0FBc0JBLElBQUlBLGVBQWUsR0FBRyxJQUFJLENBQUE7QUFFMUIsSUFBSUMsRUFBRSxHQUFHLENBQUMsQ0FBQTs7QUFFVjtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLE9BQU8sQ0FBQztBQUNWO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7O0FBR0E7O0FBR0E7O0FBR0E7O0FBR0E7O0FBR0E7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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
