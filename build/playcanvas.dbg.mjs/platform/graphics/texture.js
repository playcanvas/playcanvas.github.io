/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { TRACEID_TEXTURE_ALLOC, TRACEID_VRAM_TEXTURE } from '../../core/constants.js';
import { math } from '../../core/math/math.js';
import { PIXELFORMAT_RGBA8, TEXTURETYPE_DEFAULT, TEXTUREPROJECTION_NONE, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTUREPROJECTION_CUBE, isCompressedPixelFormat, TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_DXT1, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGBA, pixelFormatByteSizes, TEXTURELOCK_WRITE, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGB565, PIXELFORMAT_LA8, PIXELFORMAT_L8, PIXELFORMAT_A8 } from './constants.js';

let _blockSizeTable = null;
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
   * @param {string} [options.name] - The name of the texture.
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
   * - {@link PIXELFORMAT_ASTC_4x4}>/li>
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
   * Defaults to {@link TEXTUREPROJECTION_CUBE} if options.cubemap is specified, otherwise
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
   * @param {string} [options.type] - Specifies the image type, see {@link TEXTURETYPE_DEFAULT}.
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
   * var texture = new pc.Texture(graphicsDevice, {
   *     width: 8,
   *     height: 8,
   *     format: pc.PIXELFORMAT_RGB8
   * });
   *
   * // Fill the texture with a gradient
   * var pixels = texture.lock();
   * var count = 0;
   * for (var i = 0; i < 8; i++) {
   *     for (var j = 0; j < 8; j++) {
   *         pixels[count++] = i * 32;
   *         pixels[count++] = j * 32;
   *         pixels[count++] = 255;
   *     }
   * }
   * texture.unlock();
   */
  constructor(graphicsDevice, options) {
    this.id = id++;
    this.device = graphicsDevice;
    Debug.assert(this.device, "Texture contructor requires a graphicsDevice to be valid");

    /**
     * The name of the texture. Defaults to null.
     *
     * @type {string}
     */
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

    // Mip levels
    this._invalid = false;
    this._lockedLevel = -1;
    if (!this._levels) {
      this._levels = this._cubemap ? [[null, null, null, null, null, null]] : [null];
    }
    this.dirtyAll();
    this._gpuSize = 0;
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
   * Toggles automatic mipmap generation. Can't be used on non power of two textures.
   *
   * @type {boolean}
   * @ignore
   * @deprecated
   */
  set autoMipmap(v) {
    this._mipmaps = v;
  }
  get autoMipmap() {
    return this._mipmaps;
  }

  /**
   * Defines if texture should generate/upload mipmaps if possible.
   *
   * @type {boolean}
   */
  set mipmaps(v) {
    if (this._mipmaps !== v) {
      this._mipmaps = v;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVEVYVFVSRV9BTExPQywgVFJBQ0VJRF9WUkFNX1RFWFRVUkUgfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQge1xuICAgIGlzQ29tcHJlc3NlZFBpeGVsRm9ybWF0LFxuICAgIHBpeGVsRm9ybWF0Qnl0ZVNpemVzLFxuICAgIEFERFJFU1NfUkVQRUFULFxuICAgIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBGVU5DX0xFU1MsXG4gICAgUElYRUxGT1JNQVRfQTgsIFBJWEVMRk9STUFUX0w4LCBQSVhFTEZPUk1BVF9MQTgsIFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTU1NTEsIFBJWEVMRk9STUFUX1JHQkE0LFxuICAgIFBJWEVMRk9STUFUX1JHQjgsIFBJWEVMRk9STUFUX1JHQkE4LCBQSVhFTEZPUk1BVF9EWFQxLCBQSVhFTEZPUk1BVF9EWFQzLCBQSVhFTEZPUk1BVF9EWFQ1LFxuICAgIFBJWEVMRk9STUFUX1JHQjE2RiwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCMzJGLCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9FVEMxLFxuICAgIFBJWEVMRk9STUFUX0VUQzJfUkdCLCBQSVhFTEZPUk1BVF9FVEMyX1JHQkEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xLFxuICAgIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xLCBQSVhFTEZPUk1BVF9BU1RDXzR4NCwgUElYRUxGT1JNQVRfQVRDX1JHQixcbiAgICBQSVhFTEZPUk1BVF9BVENfUkdCQSxcbiAgICBURVhISU5UX1NIQURPV01BUCwgVEVYSElOVF9BU1NFVCwgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9OT05FLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFLFxuICAgIFRFWFRVUkVUWVBFX0RFRkFVTFQsIFRFWFRVUkVUWVBFX1JHQk0sIFRFWFRVUkVUWVBFX1JHQkUsIFRFWFRVUkVUWVBFX1JHQlAsIFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxubGV0IF9ibG9ja1NpemVUYWJsZSA9IG51bGw7XG5cbmxldCBpZCA9IDA7XG5cbi8qKlxuICogQSB0ZXh0dXJlIGlzIGEgY29udGFpbmVyIGZvciB0ZXhlbCBkYXRhIHRoYXQgY2FuIGJlIHV0aWxpemVkIGluIGEgZnJhZ21lbnQgc2hhZGVyLiBUeXBpY2FsbHksXG4gKiB0aGUgdGV4ZWwgZGF0YSByZXByZXNlbnRzIGFuIGltYWdlIHRoYXQgaXMgbWFwcGVkIG92ZXIgZ2VvbWV0cnkuXG4gKi9cbmNsYXNzIFRleHR1cmUge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBUZXh0dXJlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAqIHVzZWQgdG8gbWFuYWdlIHRoaXMgdGV4dHVyZS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IGZvciBwYXNzaW5nIG9wdGlvbmFsIGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgdGV4dHVyZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMud2lkdGhdIC0gVGhlIHdpZHRoIG9mIHRoZSB0ZXh0dXJlIGluIHBpeGVscy4gRGVmYXVsdHMgdG8gNC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLiBEZWZhdWx0cyB0byA0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5kZXB0aF0gLSBUaGUgbnVtYmVyIG9mIGRlcHRoIHNsaWNlcyBpbiBhIDNEIHRleHR1cmUgKFdlYkdMMiBvbmx5KS5cbiAgICAgKiBEZWZhdWx0cyB0byAxIChzaW5nbGUgMkQgaW1hZ2UpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mb3JtYXRdIC0gVGhlIHBpeGVsIGZvcm1hdCBvZiB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTDh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTEE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjU2NX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNTU1MX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0I4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUM31cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQ1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjE2Rn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjMyRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0VUQzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUXzExMTExMEZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVNUQ180eDR9Pi9saT5cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0JBfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE4fS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMucHJvamVjdGlvbl0gLSBUaGUgcHJvamVjdGlvbiB0eXBlIG9mIHRoZSB0ZXh0dXJlLCB1c2VkIHdoZW4gdGhlXG4gICAgICogdGV4dHVyZSByZXByZXNlbnRzIGFuIGVudmlyb25tZW50LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9OT05FfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX0NVQkV9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fRVFVSVJFQ1R9XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTH1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9DVUJFfSBpZiBvcHRpb25zLmN1YmVtYXAgaXMgc3BlY2lmaWVkLCBvdGhlcndpc2VcbiAgICAgKiB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fTk9ORX0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1pbkZpbHRlcl0gLSBUaGUgbWluaWZpY2F0aW9uIGZpbHRlciB0eXBlIHRvIHVzZS4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubWFnRmlsdGVyXSAtIFRoZSBtYWduaWZpY2F0aW9uIGZpbHRlciB0eXBlIHRvIHVzZS4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgRklMVEVSX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFuaXNvdHJvcHldIC0gVGhlIGxldmVsIG9mIGFuaXNvdHJvcGljIGZpbHRlcmluZyB0byB1c2UuIERlZmF1bHRzXG4gICAgICogdG8gMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYWRkcmVzc1VdIC0gVGhlIHJlcGVhdCBtb2RlIHRvIHVzZSBpbiB0aGUgVSBkaXJlY3Rpb24uIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEFERFJFU1NfUkVQRUFUfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYWRkcmVzc1ZdIC0gVGhlIHJlcGVhdCBtb2RlIHRvIHVzZSBpbiB0aGUgViBkaXJlY3Rpb24uIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEFERFJFU1NfUkVQRUFUfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuYWRkcmVzc1ddIC0gVGhlIHJlcGVhdCBtb2RlIHRvIHVzZSBpbiB0aGUgVyBkaXJlY3Rpb24uIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEFERFJFU1NfUkVQRUFUfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLm1pcG1hcHNdIC0gV2hlbiBlbmFibGVkIHRyeSB0byBnZW5lcmF0ZSBvciB1c2UgbWlwbWFwcyBmb3IgdGhpc1xuICAgICAqIHRleHR1cmUuIERlZmF1bHQgaXMgdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmN1YmVtYXBdIC0gU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgaXMgdG8gYmUgYSBjdWJlbWFwLlxuICAgICAqIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudm9sdW1lXSAtIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIGlzIHRvIGJlIGEgM0Qgdm9sdW1lXG4gICAgICogKFdlYkdMMiBvbmx5KS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnR5cGVdIC0gU3BlY2lmaWVzIHRoZSBpbWFnZSB0eXBlLCBzZWUge0BsaW5rIFRFWFRVUkVUWVBFX0RFRkFVTFR9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuZml4Q3ViZW1hcFNlYW1zXSAtIFNwZWNpZmllcyB3aGV0aGVyIHRoaXMgY3ViZW1hcCB0ZXh0dXJlIHJlcXVpcmVzXG4gICAgICogc3BlY2lhbCBzZWFtIGZpeGluZyBzaGFkZXIgY29kZSB0byBsb29rIHJpZ2h0LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZsaXBZXSAtIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIHNob3VsZCBiZSBmbGlwcGVkIGluIHRoZVxuICAgICAqIFktZGlyZWN0aW9uLiBPbmx5IGFmZmVjdHMgdGV4dHVyZXMgd2l0aCBhIHNvdXJjZSB0aGF0IGlzIGFuIGltYWdlLCBjYW52YXMgb3IgdmlkZW8gZWxlbWVudC5cbiAgICAgKiBEb2VzIG5vdCBhZmZlY3QgY3ViZW1hcHMsIGNvbXByZXNzZWQgdGV4dHVyZXMgb3IgdGV4dHVyZXMgc2V0IGZyb20gcmF3IHBpeGVsIGRhdGEuIERlZmF1bHRzXG4gICAgICogdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5wcmVtdWx0aXBseUFscGhhXSAtIElmIHRydWUsIHRoZSBhbHBoYSBjaGFubmVsIG9mIHRoZSB0ZXh0dXJlIChpZlxuICAgICAqIHByZXNlbnQpIGlzIG11bHRpcGxpZWQgaW50byB0aGUgY29sb3IgY2hhbm5lbHMuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY29tcGFyZU9uUmVhZF0gLSBXaGVuIGVuYWJsZWQsIGFuZCBpZiB0ZXh0dXJlIGZvcm1hdCBpc1xuICAgICAqIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSH0gb3Ige0BsaW5rIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTH0sIGhhcmR3YXJlIFBDRiBpcyBlbmFibGVkIGZvclxuICAgICAqIHRoaXMgdGV4dHVyZSwgYW5kIHlvdSBjYW4gZ2V0IGZpbHRlcmVkIHJlc3VsdHMgb2YgY29tcGFyaXNvbiB1c2luZyB0ZXh0dXJlKCkgaW4geW91ciBzaGFkZXJcbiAgICAgKiAoV2ViR0wyIG9ubHkpLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuY29tcGFyZUZ1bmNdIC0gQ29tcGFyaXNvbiBmdW5jdGlvbiB3aGVuIGNvbXBhcmVPblJlYWQgaXMgZW5hYmxlZFxuICAgICAqIChXZWJHTDIgb25seSkuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU31cbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEZVTkNfTEVTU30uXG4gICAgICogQHBhcmFtIHtVaW50OEFycmF5W119IFtvcHRpb25zLmxldmVsc10gLSBBcnJheSBvZiBVaW50OEFycmF5LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgOHg4eDI0LWJpdCB0ZXh0dXJlXG4gICAgICogdmFyIHRleHR1cmUgPSBuZXcgcGMuVGV4dHVyZShncmFwaGljc0RldmljZSwge1xuICAgICAqICAgICB3aWR0aDogOCxcbiAgICAgKiAgICAgaGVpZ2h0OiA4LFxuICAgICAqICAgICBmb3JtYXQ6IHBjLlBJWEVMRk9STUFUX1JHQjhcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIEZpbGwgdGhlIHRleHR1cmUgd2l0aCBhIGdyYWRpZW50XG4gICAgICogdmFyIHBpeGVscyA9IHRleHR1cmUubG9jaygpO1xuICAgICAqIHZhciBjb3VudCA9IDA7XG4gICAgICogZm9yICh2YXIgaSA9IDA7IGkgPCA4OyBpKyspIHtcbiAgICAgKiAgICAgZm9yICh2YXIgaiA9IDA7IGogPCA4OyBqKyspIHtcbiAgICAgKiAgICAgICAgIHBpeGVsc1tjb3VudCsrXSA9IGkgKiAzMjtcbiAgICAgKiAgICAgICAgIHBpeGVsc1tjb3VudCsrXSA9IGogKiAzMjtcbiAgICAgKiAgICAgICAgIHBpeGVsc1tjb3VudCsrXSA9IDI1NTtcbiAgICAgKiAgICAgfVxuICAgICAqIH1cbiAgICAgKiB0ZXh0dXJlLnVubG9jaygpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlLCBvcHRpb25zKSB7XG4gICAgICAgIHRoaXMuaWQgPSBpZCsrO1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5kZXZpY2UsIFwiVGV4dHVyZSBjb250cnVjdG9yIHJlcXVpcmVzIGEgZ3JhcGhpY3NEZXZpY2UgdG8gYmUgdmFsaWRcIik7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBuYW1lIG9mIHRoZSB0ZXh0dXJlLiBEZWZhdWx0cyB0byBudWxsLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uYW1lID0gbnVsbDtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IDQ7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IDQ7XG4gICAgICAgIHRoaXMuX2RlcHRoID0gMTtcblxuICAgICAgICB0aGlzLl9mb3JtYXQgPSBQSVhFTEZPUk1BVF9SR0JBODtcbiAgICAgICAgdGhpcy50eXBlID0gVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gVEVYVFVSRVBST0pFQ1RJT05fTk9ORTtcblxuICAgICAgICB0aGlzLl9jdWJlbWFwID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3ZvbHVtZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmZpeEN1YmVtYXBTZWFtcyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9mbGlwWSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9wcmVtdWx0aXBseUFscGhhID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5faXNSZW5kZXJUYXJnZXQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9taXBtYXBzID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl9taW5GaWx0ZXIgPSBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVI7XG4gICAgICAgIHRoaXMuX21hZ0ZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgIHRoaXMuX2FuaXNvdHJvcHkgPSAxO1xuICAgICAgICB0aGlzLl9hZGRyZXNzVSA9IEFERFJFU1NfUkVQRUFUO1xuICAgICAgICB0aGlzLl9hZGRyZXNzViA9IEFERFJFU1NfUkVQRUFUO1xuICAgICAgICB0aGlzLl9hZGRyZXNzVyA9IEFERFJFU1NfUkVQRUFUO1xuXG4gICAgICAgIHRoaXMuX2NvbXBhcmVPblJlYWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fY29tcGFyZUZ1bmMgPSBGVU5DX0xFU1M7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnByb2ZpbGVySGludCA9IDA7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmIChvcHRpb25zICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLm5hbWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMubmFtZSA9IG9wdGlvbnMubmFtZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3dpZHRoID0gKG9wdGlvbnMud2lkdGggIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLndpZHRoIDogdGhpcy5fd2lkdGg7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSAob3B0aW9ucy5oZWlnaHQgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmhlaWdodCA6IHRoaXMuX2hlaWdodDtcblxuICAgICAgICAgICAgdGhpcy5fZm9ybWF0ID0gKG9wdGlvbnMuZm9ybWF0ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5mb3JtYXQgOiB0aGlzLl9mb3JtYXQ7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCd0eXBlJykpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnR5cGU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3JnYm0nKSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoXCJvcHRpb25zLnJnYm0gaXMgZGVwcmVjYXRlZC4gVXNlIG9wdGlvbnMudHlwZSBpbnN0ZWFkLlwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLnR5cGUgPSBvcHRpb25zLnJnYm0gPyBURVhUVVJFVFlQRV9SR0JNIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgnc3dpenpsZUdHR1InKSkge1xuICAgICAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoXCJvcHRpb25zLnN3aXp6bGVHR0dSIGlzIGRlcHJlY2F0ZWQuIFVzZSBvcHRpb25zLnR5cGUgaW5zdGVhZC5cIik7XG4gICAgICAgICAgICAgICAgdGhpcy50eXBlID0gb3B0aW9ucy5zd2l6emxlR0dHUiA/IFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9wdGlvbnMubWlwbWFwcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWlwbWFwcyA9IG9wdGlvbnMubWlwbWFwcztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWlwbWFwcyA9IChvcHRpb25zLmF1dG9NaXBtYXAgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmF1dG9NaXBtYXAgOiB0aGlzLl9taXBtYXBzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9sZXZlbHMgPSBvcHRpb25zLmxldmVscztcblxuICAgICAgICAgICAgdGhpcy5fY3ViZW1hcCA9IChvcHRpb25zLmN1YmVtYXAgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmN1YmVtYXAgOiB0aGlzLl9jdWJlbWFwO1xuICAgICAgICAgICAgdGhpcy5maXhDdWJlbWFwU2VhbXMgPSAob3B0aW9ucy5maXhDdWJlbWFwU2VhbXMgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmZpeEN1YmVtYXBTZWFtcyA6IHRoaXMuZml4Q3ViZW1hcFNlYW1zO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvamVjdGlvbiA9IFRFWFRVUkVQUk9KRUNUSU9OX0NVQkU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMucHJvamVjdGlvbiAmJiBvcHRpb25zLnByb2plY3Rpb24gIT09IFRFWFRVUkVQUk9KRUNUSU9OX0NVQkUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBvcHRpb25zLnByb2plY3Rpb247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX21pbkZpbHRlciA9IChvcHRpb25zLm1pbkZpbHRlciAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMubWluRmlsdGVyIDogdGhpcy5fbWluRmlsdGVyO1xuICAgICAgICAgICAgdGhpcy5fbWFnRmlsdGVyID0gKG9wdGlvbnMubWFnRmlsdGVyICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5tYWdGaWx0ZXIgOiB0aGlzLl9tYWdGaWx0ZXI7XG4gICAgICAgICAgICB0aGlzLl9hbmlzb3Ryb3B5ID0gKG9wdGlvbnMuYW5pc290cm9weSAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuYW5pc290cm9weSA6IHRoaXMuX2FuaXNvdHJvcHk7XG4gICAgICAgICAgICB0aGlzLl9hZGRyZXNzVSA9IChvcHRpb25zLmFkZHJlc3NVICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5hZGRyZXNzVSA6IHRoaXMuX2FkZHJlc3NVO1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1YgPSAob3B0aW9ucy5hZGRyZXNzViAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuYWRkcmVzc1YgOiB0aGlzLl9hZGRyZXNzVjtcblxuICAgICAgICAgICAgdGhpcy5fY29tcGFyZU9uUmVhZCA9IChvcHRpb25zLmNvbXBhcmVPblJlYWQgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmNvbXBhcmVPblJlYWQgOiB0aGlzLl9jb21wYXJlT25SZWFkO1xuICAgICAgICAgICAgdGhpcy5fY29tcGFyZUZ1bmMgPSAob3B0aW9ucy5fY29tcGFyZUZ1bmMgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLl9jb21wYXJlRnVuYyA6IHRoaXMuX2NvbXBhcmVGdW5jO1xuXG4gICAgICAgICAgICB0aGlzLl9mbGlwWSA9IChvcHRpb25zLmZsaXBZICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5mbGlwWSA6IHRoaXMuX2ZsaXBZO1xuICAgICAgICAgICAgdGhpcy5fcHJlbXVsdGlwbHlBbHBoYSA9IChvcHRpb25zLnByZW11bHRpcGx5QWxwaGEgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLnByZW11bHRpcGx5QWxwaGEgOiB0aGlzLl9wcmVtdWx0aXBseUFscGhhO1xuXG4gICAgICAgICAgICBpZiAoZ3JhcGhpY3NEZXZpY2Uud2ViZ2wyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZGVwdGggPSAob3B0aW9ucy5kZXB0aCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuZGVwdGggOiB0aGlzLl9kZXB0aDtcbiAgICAgICAgICAgICAgICB0aGlzLl92b2x1bWUgPSAob3B0aW9ucy52b2x1bWUgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLnZvbHVtZSA6IHRoaXMuX3ZvbHVtZTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRyZXNzVyA9IChvcHRpb25zLmFkZHJlc3NXICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5hZGRyZXNzVyA6IHRoaXMuX2FkZHJlc3NXO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgICAgICB0aGlzLnByb2ZpbGVySGludCA9IChvcHRpb25zLnByb2ZpbGVySGludCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMucHJvZmlsZXJIaW50IDogdGhpcy5wcm9maWxlckhpbnQ7XG4gICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NvbXByZXNzZWQgPSBpc0NvbXByZXNzZWRQaXhlbEZvcm1hdCh0aGlzLl9mb3JtYXQpO1xuXG4gICAgICAgIC8vIE1pcCBsZXZlbHNcbiAgICAgICAgdGhpcy5faW52YWxpZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IC0xO1xuICAgICAgICBpZiAoIXRoaXMuX2xldmVscykge1xuICAgICAgICAgICAgdGhpcy5fbGV2ZWxzID0gdGhpcy5fY3ViZW1hcCA/IFtbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF1dIDogW251bGxdO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kaXJ0eUFsbCgpO1xuXG4gICAgICAgIHRoaXMuX2dwdVNpemUgPSAwO1xuXG4gICAgICAgIHRoaXMuaW1wbCA9IGdyYXBoaWNzRGV2aWNlLmNyZWF0ZVRleHR1cmVJbXBsKHRoaXMpO1xuXG4gICAgICAgIC8vIHRyYWNrIHRoZSB0ZXh0dXJlXG4gICAgICAgIGdyYXBoaWNzRGV2aWNlLnRleHR1cmVzLnB1c2godGhpcyk7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9URVhUVVJFX0FMTE9DLCBgQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9OiAke3RoaXMud2lkdGh9eCR7dGhpcy5oZWlnaHR9IGAgK1xuICAgICAgICAgICAgYCR7dGhpcy5jdWJlbWFwID8gJ1tDdWJlbWFwXScgOiAnJ31gICtcbiAgICAgICAgICAgIGAke3RoaXMudm9sdW1lID8gJ1tWb2x1bWVdJyA6ICcnfWAgK1xuICAgICAgICAgICAgYCR7dGhpcy5taXBtYXBzID8gJ1tNaXBtYXBzXScgOiAnJ31gLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgdGV4dHVyZS5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfVEVYVFVSRV9BTExPQywgYERlQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9YCk7XG5cbiAgICAgICAgaWYgKHRoaXMuZGV2aWNlKSB7XG4gICAgICAgICAgICAvLyBzdG9wIHRyYWNraW5nIHRoZSB0ZXh0dXJlXG4gICAgICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgICAgIGNvbnN0IGlkeCA9IGRldmljZS50ZXh0dXJlcy5pbmRleE9mKHRoaXMpO1xuICAgICAgICAgICAgaWYgKGlkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2UudGV4dHVyZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlbW92ZSB0ZXh0dXJlIGZyb20gYW55IHVuaWZvcm1zXG4gICAgICAgICAgICBkZXZpY2Uuc2NvcGUucmVtb3ZlVmFsdWUodGhpcyk7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgaW1wbGVtZW50YXRpb25cbiAgICAgICAgICAgIHRoaXMuaW1wbC5kZXN0cm95KGRldmljZSk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0ZXh0dXJlIHN0YXRzXG4gICAgICAgICAgICB0aGlzLmFkanVzdFZyYW1TaXplVHJhY2tpbmcoZGV2aWNlLl92cmFtLCAtdGhpcy5fZ3B1U2l6ZSk7XG5cbiAgICAgICAgICAgIHRoaXMuX2xldmVscyA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmRldmljZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgcmVuZGVyaW5nIGNvbnRleHQgd2FzIGxvc3QuIEl0IHJlbGVhc2VzIGFsbCBjb250ZXh0IHJlbGF0ZWQgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmltcGwubG9zZUNvbnRleHQoKTtcbiAgICAgICAgdGhpcy5kaXJ0eUFsbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdnJhbSBzaXplIHRyYWNraW5nIGZvciB0aGUgdGV4dHVyZSwgc2l6ZSBjYW4gYmUgcG9zaXRpdmUgdG8gYWRkIG9yIG5lZ2F0aXZlIHRvIHN1YnRyYWN0XG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYWRqdXN0VnJhbVNpemVUcmFja2luZyh2cmFtLCBzaXplKSB7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9WUkFNX1RFWFRVUkUsIGAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfSBzaXplOiAke3NpemV9IHZyYW0udGV4dHVyZTogJHt2cmFtLnRleH0gPT4gJHt2cmFtLnRleCArIHNpemV9YCk7XG5cbiAgICAgICAgdnJhbS50ZXggKz0gc2l6ZTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGlmICh0aGlzLnByb2ZpbGVySGludCA9PT0gVEVYSElOVF9TSEFET1dNQVApIHtcbiAgICAgICAgICAgIHZyYW0udGV4U2hhZG93ICs9IHNpemU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wcm9maWxlckhpbnQgPT09IFRFWEhJTlRfQVNTRVQpIHtcbiAgICAgICAgICAgIHZyYW0udGV4QXNzZXQgKz0gc2l6ZTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnByb2ZpbGVySGludCA9PT0gVEVYSElOVF9MSUdIVE1BUCkge1xuICAgICAgICAgICAgdnJhbS50ZXhMaWdodG1hcCArPSBzaXplO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtaW5pZmljYXRpb24gZmlsdGVyIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1R9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUn1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1pbkZpbHRlcih2KSB7XG4gICAgICAgIGlmICh0aGlzLl9taW5GaWx0ZXIgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX21pbkZpbHRlciA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1pbkZpbHRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pbkZpbHRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXIgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklMVEVSX05FQVJFU1R9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX0xJTkVBUn1cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IG1hZ0ZpbHRlcih2KSB7XG4gICAgICAgIGlmICh0aGlzLl9tYWdGaWx0ZXIgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX21hZ0ZpbHRlciA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hZ0ZpbHRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hZ0ZpbHRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWRkcmVzc2luZyBtb2RlIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUgaG9yaXpvbnRhbGx5LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBBRERSRVNTX1JFUEVBVH1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX0NMQU1QX1RPX0VER0V9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19NSVJST1JFRF9SRVBFQVR9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhZGRyZXNzVSh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9hZGRyZXNzVSAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1UgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gNDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhZGRyZXNzVSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZHJlc3NVO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhZGRyZXNzaW5nIG1vZGUgdG8gYmUgYXBwbGllZCB0byB0aGUgdGV4dHVyZSB2ZXJ0aWNhbGx5LiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBBRERSRVNTX1JFUEVBVH1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX0NMQU1QX1RPX0VER0V9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19NSVJST1JFRF9SRVBFQVR9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhZGRyZXNzVih2KSB7XG4gICAgICAgIGlmICh0aGlzLl9hZGRyZXNzViAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1YgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gODtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhZGRyZXNzVigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZHJlc3NWO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhZGRyZXNzaW5nIG1vZGUgdG8gYmUgYXBwbGllZCB0byB0aGUgM0QgdGV4dHVyZSBkZXB0aCAoV2ViR0wyIG9ubHkpLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBBRERSRVNTX1JFUEVBVH1cbiAgICAgKiAtIHtAbGluayBBRERSRVNTX0NMQU1QX1RPX0VER0V9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19NSVJST1JFRF9SRVBFQVR9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhZGRyZXNzVyhhZGRyZXNzVykge1xuICAgICAgICBpZiAoIXRoaXMuZGV2aWNlLndlYmdsMikgcmV0dXJuO1xuICAgICAgICBpZiAoIXRoaXMuX3ZvbHVtZSkge1xuICAgICAgICAgICAgRGVidWcud2FybihcInBjLlRleHR1cmUjYWRkcmVzc1c6IENhbid0IHNldCBXIGFkZHJlc3NpbmcgbW9kZSBmb3IgYSBub24tM0QgdGV4dHVyZS5cIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFkZHJlc3NXICE9PSB0aGlzLl9hZGRyZXNzVykge1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1cgPSBhZGRyZXNzVztcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDE2O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFkZHJlc3NXKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWRkcmVzc1c7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2hlbiBlbmFibGVkLCBhbmQgaWYgdGV4dHVyZSBmb3JtYXQgaXMge0BsaW5rIFBJWEVMRk9STUFUX0RFUFRIfSBvclxuICAgICAqIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUx9LCBoYXJkd2FyZSBQQ0YgaXMgZW5hYmxlZCBmb3IgdGhpcyB0ZXh0dXJlLCBhbmQgeW91IGNhbiBnZXRcbiAgICAgKiBmaWx0ZXJlZCByZXN1bHRzIG9mIGNvbXBhcmlzb24gdXNpbmcgdGV4dHVyZSgpIGluIHlvdXIgc2hhZGVyIChXZWJHTDIgb25seSkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY29tcGFyZU9uUmVhZCh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9jb21wYXJlT25SZWFkICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9jb21wYXJlT25SZWFkID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDMyO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbXBhcmVPblJlYWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb21wYXJlT25SZWFkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbXBhcmlzb24gZnVuY3Rpb24gd2hlbiBjb21wYXJlT25SZWFkIGlzIGVuYWJsZWQgKFdlYkdMMiBvbmx5KS4gUG9zc2libGUgdmFsdWVzOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUn1cbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJFUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX0VRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfTk9URVFVQUx9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBjb21wYXJlRnVuYyh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9jb21wYXJlRnVuYyAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fY29tcGFyZUZ1bmMgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gNjQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29tcGFyZUZ1bmMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb21wYXJlRnVuYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnRlZ2VyIHZhbHVlIHNwZWNpZnlpbmcgdGhlIGxldmVsIG9mIGFuaXNvdHJvcGljIHRvIGFwcGx5IHRvIHRoZSB0ZXh0dXJlIHJhbmdpbmcgZnJvbSAxIChub1xuICAgICAqIGFuaXNvdHJvcGljIGZpbHRlcmluZykgdG8gdGhlIHtAbGluayBHcmFwaGljc0RldmljZX0gcHJvcGVydHkgbWF4QW5pc290cm9weS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFuaXNvdHJvcHkodikge1xuICAgICAgICBpZiAodGhpcy5fYW5pc290cm9weSAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fYW5pc290cm9weSA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAxMjg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYW5pc290cm9weSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FuaXNvdHJvcHk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVG9nZ2xlcyBhdXRvbWF0aWMgbWlwbWFwIGdlbmVyYXRpb24uIENhbid0IGJlIHVzZWQgb24gbm9uIHBvd2VyIG9mIHR3byB0ZXh0dXJlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBpZ25vcmVcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqL1xuICAgIHNldCBhdXRvTWlwbWFwKHYpIHtcbiAgICAgICAgdGhpcy5fbWlwbWFwcyA9IHY7XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9NaXBtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9taXBtYXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgaWYgdGV4dHVyZSBzaG91bGQgZ2VuZXJhdGUvdXBsb2FkIG1pcG1hcHMgaWYgcG9zc2libGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbWlwbWFwcyh2KSB7XG4gICAgICAgIGlmICh0aGlzLl9taXBtYXBzICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9taXBtYXBzID0gdjtcbiAgICAgICAgICAgIGlmICh2KSB0aGlzLl9uZWVkc01pcG1hcHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1pcG1hcHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9taXBtYXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB3aWR0aCBvZiB0aGUgdGV4dHVyZSBpbiBwaXhlbHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dpZHRoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBoZWlnaHQgb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgaGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faGVpZ2h0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBudW1iZXIgb2YgZGVwdGggc2xpY2VzIGluIGEgM0QgdGV4dHVyZSAoV2ViR0wyIG9ubHkpLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZGVwdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kZXB0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcGl4ZWwgZm9ybWF0IG9mIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MOH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9MQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCNTY1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE1NTUxfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE0fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQzfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDV9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkExNkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUkdCMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkEzMkZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRVRDMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfMTExMTEwRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BU1RDXzR4NH0+L2xpPlxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0J9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVRDX1JHQkF9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGdldCBmb3JtYXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mb3JtYXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoaXMgdGV4dHVyZSBpcyBhIGN1YmUgbWFwIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgY3ViZW1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2N1YmVtYXA7XG4gICAgfVxuXG4gICAgZ2V0IGdwdVNpemUoKSB7XG4gICAgICAgIGNvbnN0IG1pcHMgPSB0aGlzLnBvdCAmJiB0aGlzLl9taXBtYXBzICYmICEodGhpcy5fY29tcHJlc3NlZCAmJiB0aGlzLl9sZXZlbHMubGVuZ3RoID09PSAxKTtcbiAgICAgICAgcmV0dXJuIFRleHR1cmUuY2FsY0dwdVNpemUodGhpcy5fd2lkdGgsIHRoaXMuX2hlaWdodCwgdGhpcy5fZGVwdGgsIHRoaXMuX2Zvcm1hdCwgbWlwcywgdGhpcy5fY3ViZW1hcCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoaXMgdGV4dHVyZSBpcyBhIDNEIHZvbHVtZSBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IHZvbHVtZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZvbHVtZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBzaG91bGQgYmUgZmxpcHBlZCBpbiB0aGUgWS1kaXJlY3Rpb24uIE9ubHkgYWZmZWN0cyB0ZXh0dXJlc1xuICAgICAqIHdpdGggYSBzb3VyY2UgdGhhdCBpcyBhbiBpbWFnZSwgY2FudmFzIG9yIHZpZGVvIGVsZW1lbnQuIERvZXMgbm90IGFmZmVjdCBjdWJlbWFwcyxcbiAgICAgKiBjb21wcmVzc2VkIHRleHR1cmVzIG9yIHRleHR1cmVzIHNldCBmcm9tIHJhdyBwaXhlbCBkYXRhLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGZsaXBZKGZsaXBZKSB7XG4gICAgICAgIGlmICh0aGlzLl9mbGlwWSAhPT0gZmxpcFkpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZsaXBZID0gZmxpcFk7XG4gICAgICAgICAgICB0aGlzLl9uZWVkc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZmxpcFkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mbGlwWTtcbiAgICB9XG5cbiAgICBzZXQgcHJlbXVsdGlwbHlBbHBoYShwcmVtdWx0aXBseUFscGhhKSB7XG4gICAgICAgIGlmICh0aGlzLl9wcmVtdWx0aXBseUFscGhhICE9PSBwcmVtdWx0aXBseUFscGhhKSB7XG4gICAgICAgICAgICB0aGlzLl9wcmVtdWx0aXBseUFscGhhID0gcHJlbXVsdGlwbHlBbHBoYTtcbiAgICAgICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBwcmVtdWx0aXBseUFscGhhKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJlbXVsdGlwbHlBbHBoYTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgYWxsIGRpbWVuc2lvbnMgb2YgdGhlIHRleHR1cmUgYXJlIHBvd2VyIG9mIHR3bywgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCBwb3QoKSB7XG4gICAgICAgIHJldHVybiBtYXRoLnBvd2VyT2ZUd28odGhpcy5fd2lkdGgpICYmIG1hdGgucG93ZXJPZlR3byh0aGlzLl9oZWlnaHQpO1xuICAgIH1cblxuICAgIC8vIGdldCB0aGUgdGV4dHVyZSdzIGVuY29kaW5nIHR5cGVcbiAgICBnZXQgZW5jb2RpbmcoKSB7XG4gICAgICAgIHN3aXRjaCAodGhpcy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlIFRFWFRVUkVUWVBFX1JHQk06XG4gICAgICAgICAgICAgICAgcmV0dXJuICdyZ2JtJztcbiAgICAgICAgICAgIGNhc2UgVEVYVFVSRVRZUEVfUkdCRTpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JnYmUnO1xuICAgICAgICAgICAgY2FzZSBURVhUVVJFVFlQRV9SR0JQOlxuICAgICAgICAgICAgICAgIHJldHVybiAncmdicCc7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHJldHVybiAodGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQjE2RiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQjMyRiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkExNkYgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMzJGKSA/ICdsaW5lYXInIDogJ3NyZ2InO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc3RhdGljIGZ1bmN0aW9uc1xuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZSB0aGUgR1BVIG1lbW9yeSByZXF1aXJlZCBmb3IgYSB0ZXh0dXJlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGV4dHVyZSdzIHdpZHRoLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUZXh0dXJlJ3MgaGVpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkZXB0aCAtIFRleHR1cmUncyBkZXB0aC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZm9ybWF0IC0gVGV4dHVyZSdzIHBpeGVsIGZvcm1hdCBQSVhFTEZPUk1BVF8qKiouXG4gICAgICogQHBhcmFtIHtib29sZWFufSBtaXBtYXBzIC0gVHJ1ZSBpZiB0aGUgdGV4dHVyZSBpbmNsdWRlcyBtaXBtYXBzLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBjdWJlbWFwIC0gVHJ1ZSBpcyB0aGUgdGV4dHVyZSBpcyBhIGN1YmVtYXAsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgbnVtYmVyIG9mIGJ5dGVzIG9mIEdQVSBtZW1vcnkgcmVxdWlyZWQgZm9yIHRoZSB0ZXh0dXJlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzdGF0aWMgY2FsY0dwdVNpemUod2lkdGgsIGhlaWdodCwgZGVwdGgsIGZvcm1hdCwgbWlwbWFwcywgY3ViZW1hcCkge1xuICAgICAgICBpZiAoIV9ibG9ja1NpemVUYWJsZSkge1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlID0gW107XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRVRDMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0VUQzJfUkdCXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRFhUMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0FUQ19SR0JdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9FVEMyX1JHQkFdID0gMTY7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRFhUM10gPSAxNjtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9EWFQ1XSA9IDE2O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0FTVENfNHg0XSA9IDE2O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0FUQ19SR0JBXSA9IDE2O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGl4ZWxTaXplID0gcGl4ZWxGb3JtYXRCeXRlU2l6ZXNbZm9ybWF0XSA/PyAwO1xuICAgICAgICBjb25zdCBibG9ja1NpemUgPSBfYmxvY2tTaXplVGFibGUuaGFzT3duUHJvcGVydHkoZm9ybWF0KSA/IF9ibG9ja1NpemVUYWJsZVtmb3JtYXRdIDogMDtcbiAgICAgICAgbGV0IHJlc3VsdCA9IDA7XG5cbiAgICAgICAgd2hpbGUgKDEpIHtcbiAgICAgICAgICAgIGlmIChwaXhlbFNpemUgPiAwKSB7XG4gICAgICAgICAgICAgICAgLy8gaGFuZGxlIHVuY29tcHJlc3NlZCBmb3JtYXRzXG4gICAgICAgICAgICAgICAgcmVzdWx0ICs9IHdpZHRoICogaGVpZ2h0ICogZGVwdGggKiBwaXhlbFNpemU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBibG9jayBmb3JtYXRzXG4gICAgICAgICAgICAgICAgbGV0IGJsb2NrV2lkdGggPSBNYXRoLmZsb29yKCh3aWR0aCArIDMpIC8gNCk7XG4gICAgICAgICAgICAgICAgY29uc3QgYmxvY2tIZWlnaHQgPSBNYXRoLmZsb29yKChoZWlnaHQgKyAzKSAvIDQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJsb2NrRGVwdGggPSBNYXRoLmZsb29yKChkZXB0aCArIDMpIC8gNCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIHx8XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEpIHtcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tXaWR0aCA9IE1hdGgubWF4KE1hdGguZmxvb3IoYmxvY2tXaWR0aCAvIDIpLCAxKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gYmxvY2tXaWR0aCAqIGJsb2NrSGVpZ2h0ICogYmxvY2tEZXB0aCAqIGJsb2NrU2l6ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHdlJ3JlIGRvbmUgaWYgbWlwbWFwcyBhcmVuJ3QgcmVxdWlyZWQgb3Igd2UndmUgY2FsY3VsYXRlZCB0aGUgc21hbGxlc3QgbWlwbWFwIGxldmVsXG4gICAgICAgICAgICBpZiAoIW1pcG1hcHMgfHwgKCh3aWR0aCA9PT0gMSkgJiYgKGhlaWdodCA9PT0gMSkgJiYgKGRlcHRoID09PSAxKSkpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdpZHRoID0gTWF0aC5tYXgoTWF0aC5mbG9vcih3aWR0aCAvIDIpLCAxKTtcbiAgICAgICAgICAgIGhlaWdodCA9IE1hdGgubWF4KE1hdGguZmxvb3IoaGVpZ2h0IC8gMiksIDEpO1xuICAgICAgICAgICAgZGVwdGggPSBNYXRoLm1heChNYXRoLmZsb29yKGRlcHRoIC8gMiksIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdCAqIChjdWJlbWFwID8gNiA6IDEpO1xuICAgIH1cblxuICAgIC8vIEZvcmNlIGEgZnVsbCByZXN1Ym1pc3Npb24gb2YgdGhlIHRleHR1cmUgdG8gV2ViR0wgKHVzZWQgb24gYSBjb250ZXh0IHJlc3RvcmUgZXZlbnQpXG4gICAgZGlydHlBbGwoKSB7XG4gICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWQgPSB0aGlzLl9jdWJlbWFwID8gW1t0cnVlLCB0cnVlLCB0cnVlLCB0cnVlLCB0cnVlLCB0cnVlXV0gOiBbdHJ1ZV07XG5cbiAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl9uZWVkc01pcG1hcHNVcGxvYWQgPSB0aGlzLl9taXBtYXBzO1xuICAgICAgICB0aGlzLl9taXBtYXBzVXBsb2FkZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyA9IDI1NTsgLy8gMSB8IDIgfCA0IHwgOCB8IDE2IHwgMzIgfCA2NCB8IDEyOFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvY2tzIGEgbWlwbGV2ZWwgb2YgdGhlIHRleHR1cmUsIHJldHVybmluZyBhIHR5cGVkIGFycmF5IHRvIGJlIGZpbGxlZCB3aXRoIHBpeGVsIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9uYWwgb3B0aW9ucyBvYmplY3QuIFZhbGlkIHByb3BlcnRpZXMgYXJlIGFzIGZvbGxvd3M6XG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmxldmVsXSAtIFRoZSBtaXAgbGV2ZWwgdG8gbG9jayB3aXRoIDAgYmVpbmcgdGhlIHRvcCBsZXZlbC4gRGVmYXVsdHNcbiAgICAgKiB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mYWNlXSAtIElmIHRoZSB0ZXh0dXJlIGlzIGEgY3ViZW1hcCwgdGhpcyBpcyB0aGUgaW5kZXggb2YgdGhlIGZhY2VcbiAgICAgKiB0byBsb2NrLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tb2RlXSAtIFRoZSBsb2NrIG1vZGUuIENhbiBiZTpcbiAgICAgKiAtIHtAbGluayBURVhUVVJFTE9DS19SRUFEfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVMT0NLX1dSSVRFfVxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBURVhUVVJFTE9DS19XUklURX0uXG4gICAgICogQHJldHVybnMge1VpbnQ4QXJyYXl8VWludDE2QXJyYXl8RmxvYXQzMkFycmF5fSBBIHR5cGVkIGFycmF5IGNvbnRhaW5pbmcgdGhlIHBpeGVsIGRhdGEgb2ZcbiAgICAgKiB0aGUgbG9ja2VkIG1pcCBsZXZlbC5cbiAgICAgKi9cbiAgICBsb2NrKG9wdGlvbnMgPSB7fSkge1xuICAgICAgICAvLyBJbml0aWFsaXplIG9wdGlvbnMgdG8gc29tZSBzZW5zaWJsZSBkZWZhdWx0c1xuICAgICAgICBpZiAob3B0aW9ucy5sZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLmxldmVsID0gMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5mYWNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuZmFjZSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMubW9kZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLm1vZGUgPSBURVhUVVJFTE9DS19XUklURTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xvY2tlZExldmVsID0gb3B0aW9ucy5sZXZlbDtcblxuICAgICAgICBpZiAodGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID09PSBudWxsKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKHRoaXMuX2Zvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfQTg6XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9MODpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfTEE4OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqICB0aGlzLl9kZXB0aCAqIDIpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjU2NTpcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE1NTUxOlxuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTQ6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50MTZBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0I4OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogMyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTg6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiA0KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQxOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheShNYXRoLmZsb29yKCh0aGlzLl93aWR0aCArIDMpIC8gNCkgKiBNYXRoLmZsb29yKCh0aGlzLl9oZWlnaHQgKyAzKSAvIDQpICogOCAqIHRoaXMuX2RlcHRoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9EWFQzOlxuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUNTpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkoTWF0aC5mbG9vcigodGhpcy5fd2lkdGggKyAzKSAvIDQpICogTWF0aC5mbG9vcigodGhpcy5faGVpZ2h0ICsgMykgLyA0KSAqIDE2ICogdGhpcy5fZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjE2RjpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQxNkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiAzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IzMkY6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkExNkY6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50MTZBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogNCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTMyRjpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IEZsb2F0MzJBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogNCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHBpeGVsIGRhdGEgb2YgdGhlIHRleHR1cmUgZnJvbSBhIGNhbnZhcywgaW1hZ2UsIHZpZGVvIERPTSBlbGVtZW50LiBJZiB0aGUgdGV4dHVyZSBpc1xuICAgICAqIGEgY3ViZW1hcCwgdGhlIHN1cHBsaWVkIHNvdXJjZSBtdXN0IGJlIGFuIGFycmF5IG9mIDYgY2FudmFzZXMsIGltYWdlcyBvciB2aWRlb3MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxDYW52YXNFbGVtZW50fEhUTUxJbWFnZUVsZW1lbnR8SFRNTFZpZGVvRWxlbWVudHxIVE1MQ2FudmFzRWxlbWVudFtdfEhUTUxJbWFnZUVsZW1lbnRbXXxIVE1MVmlkZW9FbGVtZW50W119IHNvdXJjZSAtIEFcbiAgICAgKiBjYW52YXMsIGltYWdlIG9yIHZpZGVvIGVsZW1lbnQsIG9yIGFuIGFycmF5IG9mIDYgY2FudmFzLCBpbWFnZSBvciB2aWRlbyBlbGVtZW50cy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21pcExldmVsXSAtIEEgbm9uLW5lZ2F0aXZlIGludGVnZXIgc3BlY2lmeWluZyB0aGUgaW1hZ2UgbGV2ZWwgb2YgZGV0YWlsLlxuICAgICAqIERlZmF1bHRzIHRvIDAsIHdoaWNoIHJlcHJlc2VudHMgdGhlIGJhc2UgaW1hZ2Ugc291cmNlLiBBIGxldmVsIHZhbHVlIG9mIE4sIHRoYXQgaXMgZ3JlYXRlclxuICAgICAqIHRoYW4gMCwgcmVwcmVzZW50cyB0aGUgaW1hZ2Ugc291cmNlIGZvciB0aGUgTnRoIG1pcG1hcCByZWR1Y3Rpb24gbGV2ZWwuXG4gICAgICovXG4gICAgc2V0U291cmNlKHNvdXJjZSwgbWlwTGV2ZWwgPSAwKSB7XG4gICAgICAgIGxldCBpbnZhbGlkID0gZmFsc2U7XG4gICAgICAgIGxldCB3aWR0aCwgaGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlWzBdKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVseSBvbiBmaXJzdCBmYWNlIHNpemVzXG4gICAgICAgICAgICAgICAgd2lkdGggPSBzb3VyY2VbMF0ud2lkdGggfHwgMDtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSBzb3VyY2VbMF0uaGVpZ2h0IHx8IDA7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWNlID0gc291cmNlW2ldO1xuICAgICAgICAgICAgICAgICAgICAvLyBjdWJlbWFwIGJlY29tZXMgaW52YWxpZCBpZiBhbnkgY29uZGl0aW9uIGlzIG5vdCBzYXRpc2ZpZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmYWNlIHx8ICAgICAgICAgICAgICAgICAgLy8gZmFjZSBpcyBtaXNzaW5nXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWNlLndpZHRoICE9PSB3aWR0aCB8fCAgIC8vIGZhY2UgaXMgZGlmZmVyZW50IHdpZHRoXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWNlLmhlaWdodCAhPT0gaGVpZ2h0IHx8IC8vIGZhY2UgaXMgZGlmZmVyZW50IGhlaWdodFxuICAgICAgICAgICAgICAgICAgICAgICAgIXRoaXMuZGV2aWNlLl9pc0Jyb3dzZXJJbnRlcmZhY2UoZmFjZSkpIHsgICAgICAgICAgICAvLyBuZXcgaW1hZ2UgYml0bWFwXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnZhbGlkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBmaXJzdCBmYWNlIGlzIG1pc3NpbmdcbiAgICAgICAgICAgICAgICBpbnZhbGlkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpbnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgLy8gbWFyayBsZXZlbHMgYXMgdXBkYXRlZFxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdW2ldICE9PSBzb3VyY2VbaV0pXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXVtpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgc291cmNlIGlzIHZhbGlkIHR5cGUgb2YgZWxlbWVudFxuICAgICAgICAgICAgaWYgKCF0aGlzLmRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKHNvdXJjZSkpXG4gICAgICAgICAgICAgICAgaW52YWxpZCA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmICghaW52YWxpZCkge1xuICAgICAgICAgICAgICAgIC8vIG1hcmsgbGV2ZWwgYXMgdXBkYXRlZFxuICAgICAgICAgICAgICAgIGlmIChzb3VyY2UgIT09IHRoaXMuX2xldmVsc1ttaXBMZXZlbF0pXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWRbbWlwTGV2ZWxdID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIHdpZHRoID0gc291cmNlLndpZHRoO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHNvdXJjZS5oZWlnaHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW52YWxpZCkge1xuICAgICAgICAgICAgLy8gaW52YWxpZCB0ZXh0dXJlXG5cbiAgICAgICAgICAgIC8vIGRlZmF1bHQgc2l6ZXNcbiAgICAgICAgICAgIHRoaXMuX3dpZHRoID0gNDtcbiAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IDQ7XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBsZXZlbHNcbiAgICAgICAgICAgIGlmICh0aGlzLl9jdWJlbWFwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW21pcExldmVsXVtpXSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWRbbWlwTGV2ZWxdW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1ttaXBMZXZlbF0gPSBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1VwZGF0ZWRbbWlwTGV2ZWxdID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHZhbGlkIHRleHR1cmVcbiAgICAgICAgICAgIGlmIChtaXBMZXZlbCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3dpZHRoID0gd2lkdGg7XG4gICAgICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gaGVpZ2h0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdID0gc291cmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdmFsaWQgb3IgY2hhbmdlZCBzdGF0ZSBvZiB2YWxpZGl0eVxuICAgICAgICBpZiAodGhpcy5faW52YWxpZCAhPT0gaW52YWxpZCB8fCAhaW52YWxpZCkge1xuICAgICAgICAgICAgdGhpcy5faW52YWxpZCA9IGludmFsaWQ7XG5cbiAgICAgICAgICAgIC8vIHJldXBsb2FkXG4gICAgICAgICAgICB0aGlzLnVwbG9hZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBwaXhlbCBkYXRhIG9mIHRoZSB0ZXh0dXJlLiBJZiB0aGlzIGlzIGEgY3ViZW1hcCB0aGVuIGFuIGFycmF5IG9mIDYgaW1hZ2VzIHdpbGwgYmVcbiAgICAgKiByZXR1cm5lZCBvdGhlcndpc2UgYSBzaW5nbGUgaW1hZ2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW21pcExldmVsXSAtIEEgbm9uLW5lZ2F0aXZlIGludGVnZXIgc3BlY2lmeWluZyB0aGUgaW1hZ2UgbGV2ZWwgb2YgZGV0YWlsLlxuICAgICAqIERlZmF1bHRzIHRvIDAsIHdoaWNoIHJlcHJlc2VudHMgdGhlIGJhc2UgaW1hZ2Ugc291cmNlLiBBIGxldmVsIHZhbHVlIG9mIE4sIHRoYXQgaXMgZ3JlYXRlclxuICAgICAqIHRoYW4gMCwgcmVwcmVzZW50cyB0aGUgaW1hZ2Ugc291cmNlIGZvciB0aGUgTnRoIG1pcG1hcCByZWR1Y3Rpb24gbGV2ZWwuXG4gICAgICogQHJldHVybnMge0hUTUxJbWFnZUVsZW1lbnR9IFRoZSBzb3VyY2UgaW1hZ2Ugb2YgdGhpcyB0ZXh0dXJlLiBDYW4gYmUgbnVsbCBpZiBzb3VyY2Ugbm90XG4gICAgICogYXNzaWduZWQgZm9yIHNwZWNpZmljIGltYWdlIGxldmVsLlxuICAgICAqL1xuICAgIGdldFNvdXJjZShtaXBMZXZlbCA9IDApIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xldmVsc1ttaXBMZXZlbF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVW5sb2NrcyB0aGUgY3VycmVudGx5IGxvY2tlZCBtaXAgbGV2ZWwgYW5kIHVwbG9hZHMgaXQgdG8gVlJBTS5cbiAgICAgKi9cbiAgICB1bmxvY2soKSB7XG4gICAgICAgIGlmICh0aGlzLl9sb2NrZWRMZXZlbCA9PT0gLTEpIHtcbiAgICAgICAgICAgIERlYnVnLmxvZyhcInBjLlRleHR1cmUjdW5sb2NrOiBBdHRlbXB0aW5nIHRvIHVubG9jayBhIHRleHR1cmUgdGhhdCBpcyBub3QgbG9ja2VkLlwiLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwbG9hZCB0aGUgbmV3IHBpeGVsIGRhdGFcbiAgICAgICAgdGhpcy51cGxvYWQoKTtcbiAgICAgICAgdGhpcy5fbG9ja2VkTGV2ZWwgPSAtMTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3JjZXMgYSByZXVwbG9hZCBvZiB0aGUgdGV4dHVyZXMgcGl4ZWwgZGF0YSB0byBncmFwaGljcyBtZW1vcnkuIE9yZGluYXJpbHksIHRoaXMgZnVuY3Rpb25cbiAgICAgKiBpcyBjYWxsZWQgYnkgaW50ZXJuYWxseSBieSB7QGxpbmsgVGV4dHVyZSNzZXRTb3VyY2V9IGFuZCB7QGxpbmsgVGV4dHVyZSN1bmxvY2t9LiBIb3dldmVyLCBpdFxuICAgICAqIHN0aWxsIG5lZWRzIHRvIGJlIGNhbGxlZCBleHBsaWNpdGx5IGluIHRoZSBjYXNlIHdoZXJlIGFuIEhUTUxWaWRlb0VsZW1lbnQgaXMgc2V0IGFzIHRoZVxuICAgICAqIHNvdXJjZSBvZiB0aGUgdGV4dHVyZS4gIE5vcm1hbGx5LCB0aGlzIGlzIGRvbmUgb25jZSBldmVyeSBmcmFtZSBiZWZvcmUgdmlkZW8gdGV4dHVyZWRcbiAgICAgKiBnZW9tZXRyeSBpcyByZW5kZXJlZC5cbiAgICAgKi9cbiAgICB1cGxvYWQoKSB7XG4gICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbmVlZHNNaXBtYXBzVXBsb2FkID0gdGhpcy5fbWlwbWFwcztcbiAgICAgICAgdGhpcy5pbXBsLnVwbG9hZEltbWVkaWF0ZT8uKHRoaXMuZGV2aWNlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZSBhbiBpbi1tZW1vcnkgRERTIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgdGV4dHVyZS4gT25seSB3b3JrcyBvbiBSR0JBOCB0ZXh0dXJlcy5cbiAgICAgKiBDdXJyZW50bHksIG9ubHkgdXNlZCBieSB0aGUgRWRpdG9yIHRvIHdyaXRlIHByZWZpbHRlcmVkIGN1YmVtYXBzIHRvIEREUyBmb3JtYXQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7QXJyYXlCdWZmZXJ9IEJ1ZmZlciBjb250YWluaW5nIHRoZSBERFMgZGF0YS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0RGRzKCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5mb3JtYXQgPT09IFBJWEVMRk9STUFUX1JHQkE4LCBcIlRoaXMgZm9ybWF0IGlzIG5vdCBpbXBsZW1lbnRlZCB5ZXRcIik7XG5cbiAgICAgICAgbGV0IGZzaXplID0gMTI4O1xuICAgICAgICBsZXQgaWR4ID0gMDtcbiAgICAgICAgd2hpbGUgKHRoaXMuX2xldmVsc1tpZHhdKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pcFNpemUgPSB0aGlzLl9sZXZlbHNbaWR4XS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgaWYgKCFtaXBTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBObyBieXRlIGFycmF5IGZvciBtaXAgJHtpZHh9YCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGZzaXplICs9IG1pcFNpemU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgZmFjZSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5fbGV2ZWxzW2lkeF1bZmFjZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnLmVycm9yKGBObyBsZXZlbCBkYXRhIGZvciBtaXAgJHtpZHh9LCBmYWNlICR7ZmFjZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWlwU2l6ZSA9IHRoaXMuX2xldmVsc1tpZHhdW2ZhY2VdLmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFtaXBTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgTm8gYnl0ZSBhcnJheSBmb3IgbWlwICR7aWR4fSwgZmFjZSAke2ZhY2V9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGZzaXplICs9IG1pcFNpemU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZnNpemUgKz0gdGhpcy5fbGV2ZWxzW2lkeF0ubGVuZ3RoO1xuICAgICAgICAgICAgaWR4Kys7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBidWZmID0gbmV3IEFycmF5QnVmZmVyKGZzaXplKTtcbiAgICAgICAgY29uc3QgaGVhZGVyID0gbmV3IFVpbnQzMkFycmF5KGJ1ZmYsIDAsIDEyOCAvIDQpO1xuXG4gICAgICAgIGNvbnN0IEREU19NQUdJQyA9IDU0MjMyNzg3NjsgLy8gXCJERFNcIlxuICAgICAgICBjb25zdCBERFNfSEVBREVSX1NJWkUgPSAxMjQ7XG4gICAgICAgIGNvbnN0IEREU19GTEFHU19SRVFVSVJFRCA9IDB4MDEgfCAweDAyIHwgMHgwNCB8IDB4MTAwMCB8IDB4ODAwMDA7IC8vIGNhcHMgfCBoZWlnaHQgfCB3aWR0aCB8IHBpeGVsZm9ybWF0IHwgbGluZWFyc2l6ZVxuICAgICAgICBjb25zdCBERFNfRkxBR1NfTUlQTUFQID0gMHgyMDAwMDtcbiAgICAgICAgY29uc3QgRERTX1BJWEVMRk9STUFUX1NJWkUgPSAzMjtcbiAgICAgICAgY29uc3QgRERTX1BJWEVMRkxBR1NfUkdCQTggPSAweDAxIHwgMHg0MDsgLy8gYWxwaGEgfCByZ2JcbiAgICAgICAgY29uc3QgRERTX0NBUFNfUkVRVUlSRUQgPSAweDEwMDA7XG4gICAgICAgIGNvbnN0IEREU19DQVBTX01JUE1BUCA9IDB4NDAwMDAwO1xuICAgICAgICBjb25zdCBERFNfQ0FQU19DT01QTEVYID0gMHg4O1xuICAgICAgICBjb25zdCBERFNfQ0FQUzJfQ1VCRU1BUCA9IDB4MjAwIHwgMHg0MDAgfCAweDgwMCB8IDB4MTAwMCB8IDB4MjAwMCB8IDB4NDAwMCB8IDB4ODAwMDsgLy8gY3ViZW1hcCB8IGFsbCBmYWNlc1xuXG4gICAgICAgIGxldCBmbGFncyA9IEREU19GTEFHU19SRVFVSVJFRDtcbiAgICAgICAgaWYgKHRoaXMuX2xldmVscy5sZW5ndGggPiAxKSBmbGFncyB8PSBERFNfRkxBR1NfTUlQTUFQO1xuXG4gICAgICAgIGxldCBjYXBzID0gRERTX0NBUFNfUkVRVUlSRUQ7XG4gICAgICAgIGlmICh0aGlzLl9sZXZlbHMubGVuZ3RoID4gMSkgY2FwcyB8PSBERFNfQ0FQU19NSVBNQVA7XG4gICAgICAgIGlmICh0aGlzLl9sZXZlbHMubGVuZ3RoID4gMSB8fCB0aGlzLmN1YmVtYXApIGNhcHMgfD0gRERTX0NBUFNfQ09NUExFWDtcblxuICAgICAgICBjb25zdCBjYXBzMiA9IHRoaXMuY3ViZW1hcCA/IEREU19DQVBTMl9DVUJFTUFQIDogMDtcblxuICAgICAgICBoZWFkZXJbMF0gPSBERFNfTUFHSUM7XG4gICAgICAgIGhlYWRlclsxXSA9IEREU19IRUFERVJfU0laRTtcbiAgICAgICAgaGVhZGVyWzJdID0gZmxhZ3M7XG4gICAgICAgIGhlYWRlclszXSA9IHRoaXMuaGVpZ2h0O1xuICAgICAgICBoZWFkZXJbNF0gPSB0aGlzLndpZHRoO1xuICAgICAgICBoZWFkZXJbNV0gPSB0aGlzLndpZHRoICogdGhpcy5oZWlnaHQgKiA0O1xuICAgICAgICBoZWFkZXJbNl0gPSAwOyAvLyBkZXB0aFxuICAgICAgICBoZWFkZXJbN10gPSB0aGlzLl9sZXZlbHMubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDExOyBpKyspIHtcbiAgICAgICAgICAgIGhlYWRlcls4ICsgaV0gPSAwO1xuICAgICAgICB9XG4gICAgICAgIGhlYWRlclsxOV0gPSBERFNfUElYRUxGT1JNQVRfU0laRTtcbiAgICAgICAgaGVhZGVyWzIwXSA9IEREU19QSVhFTEZMQUdTX1JHQkE4O1xuICAgICAgICBoZWFkZXJbMjFdID0gMDsgLy8gZm91cmNjXG4gICAgICAgIGhlYWRlclsyMl0gPSAzMjsgLy8gYnBwXG4gICAgICAgIGhlYWRlclsyM10gPSAweDAwRkYwMDAwOyAvLyBSIG1hc2tcbiAgICAgICAgaGVhZGVyWzI0XSA9IDB4MDAwMEZGMDA7IC8vIEcgbWFza1xuICAgICAgICBoZWFkZXJbMjVdID0gMHgwMDAwMDBGRjsgLy8gQiBtYXNrXG4gICAgICAgIGhlYWRlclsyNl0gPSAweEZGMDAwMDAwOyAvLyBBIG1hc2tcbiAgICAgICAgaGVhZGVyWzI3XSA9IGNhcHM7XG4gICAgICAgIGhlYWRlclsyOF0gPSBjYXBzMjtcbiAgICAgICAgaGVhZGVyWzI5XSA9IDA7XG4gICAgICAgIGhlYWRlclszMF0gPSAwO1xuICAgICAgICBoZWFkZXJbMzFdID0gMDtcblxuICAgICAgICBsZXQgb2Zmc2V0ID0gMTI4O1xuICAgICAgICBpZiAoIXRoaXMuY3ViZW1hcCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sZXZlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsZXZlbCA9IHRoaXMuX2xldmVsc1tpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBtaXAgPSBuZXcgVWludDhBcnJheShidWZmLCBvZmZzZXQsIGxldmVsLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZXZlbC5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBtaXBbal0gPSBsZXZlbFtqXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb2Zmc2V0ICs9IGxldmVsLmxlbmd0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgNjsgZmFjZSsrKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sZXZlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbaV1bZmFjZV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pcCA9IG5ldyBVaW50OEFycmF5KGJ1ZmYsIG9mZnNldCwgbGV2ZWwubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsZXZlbC5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWlwW2pdID0gbGV2ZWxbal07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgb2Zmc2V0ICs9IGxldmVsLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYnVmZjtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFRleHR1cmUgfTtcbiJdLCJuYW1lcyI6WyJfYmxvY2tTaXplVGFibGUiLCJpZCIsIlRleHR1cmUiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwib3B0aW9ucyIsImRldmljZSIsIkRlYnVnIiwiYXNzZXJ0IiwibmFtZSIsIl93aWR0aCIsIl9oZWlnaHQiLCJfZGVwdGgiLCJfZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJ0eXBlIiwiVEVYVFVSRVRZUEVfREVGQVVMVCIsInByb2plY3Rpb24iLCJURVhUVVJFUFJPSkVDVElPTl9OT05FIiwiX2N1YmVtYXAiLCJfdm9sdW1lIiwiZml4Q3ViZW1hcFNlYW1zIiwiX2ZsaXBZIiwiX3ByZW11bHRpcGx5QWxwaGEiLCJfaXNSZW5kZXJUYXJnZXQiLCJfbWlwbWFwcyIsIl9taW5GaWx0ZXIiLCJGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIiLCJfbWFnRmlsdGVyIiwiRklMVEVSX0xJTkVBUiIsIl9hbmlzb3Ryb3B5IiwiX2FkZHJlc3NVIiwiQUREUkVTU19SRVBFQVQiLCJfYWRkcmVzc1YiLCJfYWRkcmVzc1ciLCJfY29tcGFyZU9uUmVhZCIsIl9jb21wYXJlRnVuYyIsIkZVTkNfTEVTUyIsInByb2ZpbGVySGludCIsInVuZGVmaW5lZCIsIndpZHRoIiwiaGVpZ2h0IiwiZm9ybWF0IiwiaGFzT3duUHJvcGVydHkiLCJkZXByZWNhdGVkIiwicmdibSIsIlRFWFRVUkVUWVBFX1JHQk0iLCJzd2l6emxlR0dHUiIsIlRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSIiwibWlwbWFwcyIsImF1dG9NaXBtYXAiLCJfbGV2ZWxzIiwibGV2ZWxzIiwiY3ViZW1hcCIsIlRFWFRVUkVQUk9KRUNUSU9OX0NVQkUiLCJtaW5GaWx0ZXIiLCJtYWdGaWx0ZXIiLCJhbmlzb3Ryb3B5IiwiYWRkcmVzc1UiLCJhZGRyZXNzViIsImNvbXBhcmVPblJlYWQiLCJmbGlwWSIsInByZW11bHRpcGx5QWxwaGEiLCJ3ZWJnbDIiLCJkZXB0aCIsInZvbHVtZSIsImFkZHJlc3NXIiwiX2NvbXByZXNzZWQiLCJpc0NvbXByZXNzZWRQaXhlbEZvcm1hdCIsIl9pbnZhbGlkIiwiX2xvY2tlZExldmVsIiwiZGlydHlBbGwiLCJfZ3B1U2l6ZSIsImltcGwiLCJjcmVhdGVUZXh0dXJlSW1wbCIsInRleHR1cmVzIiwicHVzaCIsInRyYWNlIiwiVFJBQ0VJRF9URVhUVVJFX0FMTE9DIiwiZGVzdHJveSIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJzY29wZSIsInJlbW92ZVZhbHVlIiwiYWRqdXN0VnJhbVNpemVUcmFja2luZyIsIl92cmFtIiwibG9zZUNvbnRleHQiLCJ2cmFtIiwic2l6ZSIsIlRSQUNFSURfVlJBTV9URVhUVVJFIiwidGV4IiwiVEVYSElOVF9TSEFET1dNQVAiLCJ0ZXhTaGFkb3ciLCJURVhISU5UX0FTU0VUIiwidGV4QXNzZXQiLCJURVhISU5UX0xJR0hUTUFQIiwidGV4TGlnaHRtYXAiLCJ2IiwiX3BhcmFtZXRlckZsYWdzIiwid2FybiIsImNvbXBhcmVGdW5jIiwiX25lZWRzTWlwbWFwc1VwbG9hZCIsImdwdVNpemUiLCJtaXBzIiwicG90IiwibGVuZ3RoIiwiY2FsY0dwdVNpemUiLCJfbmVlZHNVcGxvYWQiLCJtYXRoIiwicG93ZXJPZlR3byIsImVuY29kaW5nIiwiVEVYVFVSRVRZUEVfUkdCRSIsIlRFWFRVUkVUWVBFX1JHQlAiLCJQSVhFTEZPUk1BVF9SR0IxNkYiLCJQSVhFTEZPUk1BVF9SR0IzMkYiLCJQSVhFTEZPUk1BVF9SR0JBMTZGIiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIlBJWEVMRk9STUFUX0VUQzEiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQiIsIlBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSIsIlBJWEVMRk9STUFUX0RYVDEiLCJQSVhFTEZPUk1BVF9BVENfUkdCIiwiUElYRUxGT1JNQVRfRVRDMl9SR0JBIiwiUElYRUxGT1JNQVRfRFhUMyIsIlBJWEVMRk9STUFUX0RYVDUiLCJQSVhFTEZPUk1BVF9BU1RDXzR4NCIsIlBJWEVMRk9STUFUX0FUQ19SR0JBIiwicGl4ZWxTaXplIiwicGl4ZWxGb3JtYXRCeXRlU2l6ZXMiLCJibG9ja1NpemUiLCJyZXN1bHQiLCJibG9ja1dpZHRoIiwiTWF0aCIsImZsb29yIiwiYmxvY2tIZWlnaHQiLCJibG9ja0RlcHRoIiwibWF4IiwiX2xldmVsc1VwZGF0ZWQiLCJfbWlwbWFwc1VwbG9hZGVkIiwibG9jayIsImxldmVsIiwiZmFjZSIsIm1vZGUiLCJURVhUVVJFTE9DS19XUklURSIsIlBJWEVMRk9STUFUX0E4IiwiUElYRUxGT1JNQVRfTDgiLCJVaW50OEFycmF5IiwiUElYRUxGT1JNQVRfTEE4IiwiUElYRUxGT1JNQVRfUkdCNTY1IiwiUElYRUxGT1JNQVRfUkdCQTU1NTEiLCJQSVhFTEZPUk1BVF9SR0JBNCIsIlVpbnQxNkFycmF5IiwiUElYRUxGT1JNQVRfUkdCOCIsIkZsb2F0MzJBcnJheSIsInNldFNvdXJjZSIsInNvdXJjZSIsIm1pcExldmVsIiwiaW52YWxpZCIsImkiLCJfaXNCcm93c2VySW50ZXJmYWNlIiwidXBsb2FkIiwiZ2V0U291cmNlIiwidW5sb2NrIiwibG9nIiwidXBsb2FkSW1tZWRpYXRlIiwiZ2V0RGRzIiwiZnNpemUiLCJtaXBTaXplIiwiZXJyb3IiLCJidWZmIiwiQXJyYXlCdWZmZXIiLCJoZWFkZXIiLCJVaW50MzJBcnJheSIsIkREU19NQUdJQyIsIkREU19IRUFERVJfU0laRSIsIkREU19GTEFHU19SRVFVSVJFRCIsIkREU19GTEFHU19NSVBNQVAiLCJERFNfUElYRUxGT1JNQVRfU0laRSIsIkREU19QSVhFTEZMQUdTX1JHQkE4IiwiRERTX0NBUFNfUkVRVUlSRUQiLCJERFNfQ0FQU19NSVBNQVAiLCJERFNfQ0FQU19DT01QTEVYIiwiRERTX0NBUFMyX0NVQkVNQVAiLCJmbGFncyIsImNhcHMiLCJjYXBzMiIsIm9mZnNldCIsIm1pcCIsImoiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFzQkEsSUFBSUEsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUUxQixJQUFJQyxFQUFFLEdBQUcsQ0FBQyxDQUFBOztBQUVWO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsT0FBTyxDQUFDO0FBQ1Y7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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
