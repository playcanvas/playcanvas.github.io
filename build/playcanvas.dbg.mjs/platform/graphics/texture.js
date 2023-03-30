/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfVEVYVFVSRV9BTExPQywgVFJBQ0VJRF9WUkFNX1RFWFRVUkUgfSBmcm9tICcuLi8uLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuXG5pbXBvcnQge1xuICAgIGlzQ29tcHJlc3NlZFBpeGVsRm9ybWF0LFxuICAgIHBpeGVsRm9ybWF0Qnl0ZVNpemVzLFxuICAgIEFERFJFU1NfUkVQRUFULFxuICAgIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBGVU5DX0xFU1MsXG4gICAgUElYRUxGT1JNQVRfQTgsIFBJWEVMRk9STUFUX0w4LCBQSVhFTEZPUk1BVF9MQTgsIFBJWEVMRk9STUFUX1JHQjU2NSwgUElYRUxGT1JNQVRfUkdCQTU1NTEsIFBJWEVMRk9STUFUX1JHQkE0LFxuICAgIFBJWEVMRk9STUFUX1JHQjgsIFBJWEVMRk9STUFUX1JHQkE4LCBQSVhFTEZPUk1BVF9EWFQxLCBQSVhFTEZPUk1BVF9EWFQzLCBQSVhFTEZPUk1BVF9EWFQ1LFxuICAgIFBJWEVMRk9STUFUX1JHQjE2RiwgUElYRUxGT1JNQVRfUkdCQTE2RiwgUElYRUxGT1JNQVRfUkdCMzJGLCBQSVhFTEZPUk1BVF9SR0JBMzJGLCBQSVhFTEZPUk1BVF9FVEMxLFxuICAgIFBJWEVMRk9STUFUX0VUQzJfUkdCLCBQSVhFTEZPUk1BVF9FVEMyX1JHQkEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xLFxuICAgIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzEsIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xLCBQSVhFTEZPUk1BVF9BU1RDXzR4NCwgUElYRUxGT1JNQVRfQVRDX1JHQixcbiAgICBQSVhFTEZPUk1BVF9BVENfUkdCQSxcbiAgICBURVhISU5UX1NIQURPV01BUCwgVEVYSElOVF9BU1NFVCwgVEVYSElOVF9MSUdIVE1BUCxcbiAgICBURVhUVVJFTE9DS19XUklURSxcbiAgICBURVhUVVJFUFJPSkVDVElPTl9OT05FLCBURVhUVVJFUFJPSkVDVElPTl9DVUJFLFxuICAgIFRFWFRVUkVUWVBFX0RFRkFVTFQsIFRFWFRVUkVUWVBFX1JHQk0sIFRFWFRVUkVUWVBFX1JHQkUsIFRFWFRVUkVUWVBFX1JHQlAsIFRFWFRVUkVUWVBFX1NXSVpaTEVHR0dSXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxubGV0IF9ibG9ja1NpemVUYWJsZSA9IG51bGw7XG5cbmxldCBpZCA9IDA7XG5cbi8qKlxuICogQSB0ZXh0dXJlIGlzIGEgY29udGFpbmVyIGZvciB0ZXhlbCBkYXRhIHRoYXQgY2FuIGJlIHV0aWxpemVkIGluIGEgZnJhZ21lbnQgc2hhZGVyLiBUeXBpY2FsbHksXG4gKiB0aGUgdGV4ZWwgZGF0YSByZXByZXNlbnRzIGFuIGltYWdlIHRoYXQgaXMgbWFwcGVkIG92ZXIgZ2VvbWV0cnkuXG4gKi9cbmNsYXNzIFRleHR1cmUge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBUZXh0dXJlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAqIHVzZWQgdG8gbWFuYWdlIHRoaXMgdGV4dHVyZS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT2JqZWN0IGZvciBwYXNzaW5nIG9wdGlvbmFsIGFyZ3VtZW50cy5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW29wdGlvbnMubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgdGV4dHVyZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMud2lkdGhdIC0gVGhlIHdpZHRoIG9mIHRoZSB0ZXh0dXJlIGluIHBpeGVscy4gRGVmYXVsdHMgdG8gNC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLiBEZWZhdWx0cyB0byA0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5kZXB0aF0gLSBUaGUgbnVtYmVyIG9mIGRlcHRoIHNsaWNlcyBpbiBhIDNEIHRleHR1cmUgKFdlYkdMMiBvbmx5KS5cbiAgICAgKiBEZWZhdWx0cyB0byAxIChzaW5nbGUgMkQgaW1hZ2UpLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mb3JtYXRdIC0gVGhlIHBpeGVsIGZvcm1hdCBvZiB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTDh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTEE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjU2NX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNTU1MX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0I4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUM31cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQ1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjE2Rn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjMyRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0VUQzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUXzExMTExMEZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVNUQ180eDR9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVRDX1JHQn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCQX1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBOH0uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLnByb2plY3Rpb25dIC0gVGhlIHByb2plY3Rpb24gdHlwZSBvZiB0aGUgdGV4dHVyZSwgdXNlZCB3aGVuIHRoZVxuICAgICAqIHRleHR1cmUgcmVwcmVzZW50cyBhbiBlbnZpcm9ubWVudC4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fTk9ORX1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFUFJPSkVDVElPTl9DVUJFfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX0VRVUlSRUNUfVxuICAgICAqIC0ge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX09DVEFIRURSQUx9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgVEVYVFVSRVBST0pFQ1RJT05fQ1VCRX0gaWYgb3B0aW9ucy5jdWJlbWFwIGlzIHNwZWNpZmllZCwgb3RoZXJ3aXNlXG4gICAgICoge0BsaW5rIFRFWFRVUkVQUk9KRUNUSU9OX05PTkV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5taW5GaWx0ZXJdIC0gVGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLm1hZ0ZpbHRlcl0gLSBUaGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXIgdHlwZSB0byB1c2UuIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIEZJTFRFUl9MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5hbmlzb3Ryb3B5XSAtIFRoZSBsZXZlbCBvZiBhbmlzb3Ryb3BpYyBmaWx0ZXJpbmcgdG8gdXNlLiBEZWZhdWx0c1xuICAgICAqIHRvIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NVXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFUgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NWXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFYgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmFkZHJlc3NXXSAtIFRoZSByZXBlYXQgbW9kZSB0byB1c2UgaW4gdGhlIFcgZGlyZWN0aW9uLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBBRERSRVNTX1JFUEVBVH0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5taXBtYXBzXSAtIFdoZW4gZW5hYmxlZCB0cnkgdG8gZ2VuZXJhdGUgb3IgdXNlIG1pcG1hcHMgZm9yIHRoaXNcbiAgICAgKiB0ZXh0dXJlLiBEZWZhdWx0IGlzIHRydWUuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5jdWJlbWFwXSAtIFNwZWNpZmllcyB3aGV0aGVyIHRoZSB0ZXh0dXJlIGlzIHRvIGJlIGEgY3ViZW1hcC5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLnZvbHVtZV0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBpcyB0byBiZSBhIDNEIHZvbHVtZVxuICAgICAqIChXZWJHTDIgb25seSkuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0aW9ucy50eXBlXSAtIFNwZWNpZmllcyB0aGUgaW1hZ2UgdHlwZSwgc2VlIHtAbGluayBURVhUVVJFVFlQRV9ERUZBVUxUfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmZpeEN1YmVtYXBTZWFtc10gLSBTcGVjaWZpZXMgd2hldGhlciB0aGlzIGN1YmVtYXAgdGV4dHVyZSByZXF1aXJlc1xuICAgICAqIHNwZWNpYWwgc2VhbSBmaXhpbmcgc2hhZGVyIGNvZGUgdG8gbG9vayByaWdodC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy5mbGlwWV0gLSBTcGVjaWZpZXMgd2hldGhlciB0aGUgdGV4dHVyZSBzaG91bGQgYmUgZmxpcHBlZCBpbiB0aGVcbiAgICAgKiBZLWRpcmVjdGlvbi4gT25seSBhZmZlY3RzIHRleHR1cmVzIHdpdGggYSBzb3VyY2UgdGhhdCBpcyBhbiBpbWFnZSwgY2FudmFzIG9yIHZpZGVvIGVsZW1lbnQuXG4gICAgICogRG9lcyBub3QgYWZmZWN0IGN1YmVtYXBzLCBjb21wcmVzc2VkIHRleHR1cmVzIG9yIHRleHR1cmVzIHNldCBmcm9tIHJhdyBwaXhlbCBkYXRhLiBEZWZhdWx0c1xuICAgICAqIHRvIGZhbHNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMucHJlbXVsdGlwbHlBbHBoYV0gLSBJZiB0cnVlLCB0aGUgYWxwaGEgY2hhbm5lbCBvZiB0aGUgdGV4dHVyZSAoaWZcbiAgICAgKiBwcmVzZW50KSBpcyBtdWx0aXBsaWVkIGludG8gdGhlIGNvbG9yIGNoYW5uZWxzLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmNvbXBhcmVPblJlYWRdIC0gV2hlbiBlbmFibGVkLCBhbmQgaWYgdGV4dHVyZSBmb3JtYXQgaXNcbiAgICAgKiB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEh9IG9yIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUx9LCBoYXJkd2FyZSBQQ0YgaXMgZW5hYmxlZCBmb3JcbiAgICAgKiB0aGlzIHRleHR1cmUsIGFuZCB5b3UgY2FuIGdldCBmaWx0ZXJlZCByZXN1bHRzIG9mIGNvbXBhcmlzb24gdXNpbmcgdGV4dHVyZSgpIGluIHlvdXIgc2hhZGVyXG4gICAgICogKFdlYkdMMiBvbmx5KS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLmNvbXBhcmVGdW5jXSAtIENvbXBhcmlzb24gZnVuY3Rpb24gd2hlbiBjb21wYXJlT25SZWFkIGlzIGVuYWJsZWRcbiAgICAgKiAoV2ViR0wyIG9ubHkpLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1N9XG4gICAgICogLSB7QGxpbmsgRlVOQ19MRVNTRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfR1JFQVRFUkVRVUFMfVxuICAgICAqIC0ge0BsaW5rIEZVTkNfRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19OT1RFUVVBTH1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBGVU5DX0xFU1N9LlxuICAgICAqIEBwYXJhbSB7VWludDhBcnJheVtdfSBbb3B0aW9ucy5sZXZlbHNdIC0gQXJyYXkgb2YgVWludDhBcnJheS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIDh4OHgyNC1iaXQgdGV4dHVyZVxuICAgICAqIHZhciB0ZXh0dXJlID0gbmV3IHBjLlRleHR1cmUoZ3JhcGhpY3NEZXZpY2UsIHtcbiAgICAgKiAgICAgd2lkdGg6IDgsXG4gICAgICogICAgIGhlaWdodDogOCxcbiAgICAgKiAgICAgZm9ybWF0OiBwYy5QSVhFTEZPUk1BVF9SR0I4XG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBGaWxsIHRoZSB0ZXh0dXJlIHdpdGggYSBncmFkaWVudFxuICAgICAqIHZhciBwaXhlbHMgPSB0ZXh0dXJlLmxvY2soKTtcbiAgICAgKiB2YXIgY291bnQgPSAwO1xuICAgICAqIGZvciAodmFyIGkgPSAwOyBpIDwgODsgaSsrKSB7XG4gICAgICogICAgIGZvciAodmFyIGogPSAwOyBqIDwgODsgaisrKSB7XG4gICAgICogICAgICAgICBwaXhlbHNbY291bnQrK10gPSBpICogMzI7XG4gICAgICogICAgICAgICBwaXhlbHNbY291bnQrK10gPSBqICogMzI7XG4gICAgICogICAgICAgICBwaXhlbHNbY291bnQrK10gPSAyNTU7XG4gICAgICogICAgIH1cbiAgICAgKiB9XG4gICAgICogdGV4dHVyZS51bmxvY2soKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSwgb3B0aW9ucykge1xuICAgICAgICB0aGlzLmlkID0gaWQrKztcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuZGV2aWNlLCBcIlRleHR1cmUgY29udHJ1Y3RvciByZXF1aXJlcyBhIGdyYXBoaWNzRGV2aWNlIHRvIGJlIHZhbGlkXCIpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbmFtZSBvZiB0aGUgdGV4dHVyZS4gRGVmYXVsdHMgdG8gbnVsbC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubmFtZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSA0O1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSA0O1xuICAgICAgICB0aGlzLl9kZXB0aCA9IDE7XG5cbiAgICAgICAgdGhpcy5fZm9ybWF0ID0gUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgICAgIHRoaXMudHlwZSA9IFRFWFRVUkVUWVBFX0RFRkFVTFQ7XG4gICAgICAgIHRoaXMucHJvamVjdGlvbiA9IFRFWFRVUkVQUk9KRUNUSU9OX05PTkU7XG5cbiAgICAgICAgdGhpcy5fY3ViZW1hcCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl92b2x1bWUgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5maXhDdWJlbWFwU2VhbXMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZmxpcFkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fcHJlbXVsdGlwbHlBbHBoYSA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2lzUmVuZGVyVGFyZ2V0ID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fbWlwbWFwcyA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fbWluRmlsdGVyID0gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSO1xuICAgICAgICB0aGlzLl9tYWdGaWx0ZXIgPSBGSUxURVJfTElORUFSO1xuICAgICAgICB0aGlzLl9hbmlzb3Ryb3B5ID0gMTtcbiAgICAgICAgdGhpcy5fYWRkcmVzc1UgPSBBRERSRVNTX1JFUEVBVDtcbiAgICAgICAgdGhpcy5fYWRkcmVzc1YgPSBBRERSRVNTX1JFUEVBVDtcbiAgICAgICAgdGhpcy5fYWRkcmVzc1cgPSBBRERSRVNTX1JFUEVBVDtcblxuICAgICAgICB0aGlzLl9jb21wYXJlT25SZWFkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2NvbXBhcmVGdW5jID0gRlVOQ19MRVNTO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5wcm9maWxlckhpbnQgPSAwO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBpZiAob3B0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5uYW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm5hbWUgPSBvcHRpb25zLm5hbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl93aWR0aCA9IChvcHRpb25zLndpZHRoICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy53aWR0aCA6IHRoaXMuX3dpZHRoO1xuICAgICAgICAgICAgdGhpcy5faGVpZ2h0ID0gKG9wdGlvbnMuaGVpZ2h0ICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5oZWlnaHQgOiB0aGlzLl9oZWlnaHQ7XG5cbiAgICAgICAgICAgIHRoaXMuX2Zvcm1hdCA9IChvcHRpb25zLmZvcm1hdCAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuZm9ybWF0IDogdGhpcy5fZm9ybWF0O1xuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eSgndHlwZScpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50eXBlID0gb3B0aW9ucy50eXBlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmhhc093blByb3BlcnR5KCdyZ2JtJykpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKFwib3B0aW9ucy5yZ2JtIGlzIGRlcHJlY2F0ZWQuIFVzZSBvcHRpb25zLnR5cGUgaW5zdGVhZC5cIik7XG4gICAgICAgICAgICAgICAgdGhpcy50eXBlID0gb3B0aW9ucy5yZ2JtID8gVEVYVFVSRVRZUEVfUkdCTSA6IFRFWFRVUkVUWVBFX0RFRkFVTFQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaGFzT3duUHJvcGVydHkoJ3N3aXp6bGVHR0dSJykpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKFwib3B0aW9ucy5zd2l6emxlR0dHUiBpcyBkZXByZWNhdGVkLiBVc2Ugb3B0aW9ucy50eXBlIGluc3RlYWQuXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMudHlwZSA9IG9wdGlvbnMuc3dpenpsZUdHR1IgPyBURVhUVVJFVFlQRV9TV0laWkxFR0dHUiA6IFRFWFRVUkVUWVBFX0RFRkFVTFQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLm1pcG1hcHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX21pcG1hcHMgPSBvcHRpb25zLm1pcG1hcHM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX21pcG1hcHMgPSAob3B0aW9ucy5hdXRvTWlwbWFwICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5hdXRvTWlwbWFwIDogdGhpcy5fbWlwbWFwcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbGV2ZWxzID0gb3B0aW9ucy5sZXZlbHM7XG5cbiAgICAgICAgICAgIHRoaXMuX2N1YmVtYXAgPSAob3B0aW9ucy5jdWJlbWFwICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5jdWJlbWFwIDogdGhpcy5fY3ViZW1hcDtcbiAgICAgICAgICAgIHRoaXMuZml4Q3ViZW1hcFNlYW1zID0gKG9wdGlvbnMuZml4Q3ViZW1hcFNlYW1zICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5maXhDdWJlbWFwU2VhbXMgOiB0aGlzLmZpeEN1YmVtYXBTZWFtcztcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2N1YmVtYXApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2plY3Rpb24gPSBURVhUVVJFUFJPSkVDVElPTl9DVUJFO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLnByb2plY3Rpb24gJiYgb3B0aW9ucy5wcm9qZWN0aW9uICE9PSBURVhUVVJFUFJPSkVDVElPTl9DVUJFKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9qZWN0aW9uID0gb3B0aW9ucy5wcm9qZWN0aW9uO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9taW5GaWx0ZXIgPSAob3B0aW9ucy5taW5GaWx0ZXIgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLm1pbkZpbHRlciA6IHRoaXMuX21pbkZpbHRlcjtcbiAgICAgICAgICAgIHRoaXMuX21hZ0ZpbHRlciA9IChvcHRpb25zLm1hZ0ZpbHRlciAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMubWFnRmlsdGVyIDogdGhpcy5fbWFnRmlsdGVyO1xuICAgICAgICAgICAgdGhpcy5fYW5pc290cm9weSA9IChvcHRpb25zLmFuaXNvdHJvcHkgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmFuaXNvdHJvcHkgOiB0aGlzLl9hbmlzb3Ryb3B5O1xuICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1UgPSAob3B0aW9ucy5hZGRyZXNzVSAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuYWRkcmVzc1UgOiB0aGlzLl9hZGRyZXNzVTtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NWID0gKG9wdGlvbnMuYWRkcmVzc1YgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmFkZHJlc3NWIDogdGhpcy5fYWRkcmVzc1Y7XG5cbiAgICAgICAgICAgIHRoaXMuX2NvbXBhcmVPblJlYWQgPSAob3B0aW9ucy5jb21wYXJlT25SZWFkICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5jb21wYXJlT25SZWFkIDogdGhpcy5fY29tcGFyZU9uUmVhZDtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBhcmVGdW5jID0gKG9wdGlvbnMuX2NvbXBhcmVGdW5jICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5fY29tcGFyZUZ1bmMgOiB0aGlzLl9jb21wYXJlRnVuYztcblxuICAgICAgICAgICAgdGhpcy5fZmxpcFkgPSAob3B0aW9ucy5mbGlwWSAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuZmxpcFkgOiB0aGlzLl9mbGlwWTtcbiAgICAgICAgICAgIHRoaXMuX3ByZW11bHRpcGx5QWxwaGEgPSAob3B0aW9ucy5wcmVtdWx0aXBseUFscGhhICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy5wcmVtdWx0aXBseUFscGhhIDogdGhpcy5fcHJlbXVsdGlwbHlBbHBoYTtcblxuICAgICAgICAgICAgaWYgKGdyYXBoaWNzRGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2RlcHRoID0gKG9wdGlvbnMuZGVwdGggIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLmRlcHRoIDogdGhpcy5fZGVwdGg7XG4gICAgICAgICAgICAgICAgdGhpcy5fdm9sdW1lID0gKG9wdGlvbnMudm9sdW1lICE9PSB1bmRlZmluZWQpID8gb3B0aW9ucy52b2x1bWUgOiB0aGlzLl92b2x1bWU7XG4gICAgICAgICAgICAgICAgdGhpcy5fYWRkcmVzc1cgPSAob3B0aW9ucy5hZGRyZXNzVyAhPT0gdW5kZWZpbmVkKSA/IG9wdGlvbnMuYWRkcmVzc1cgOiB0aGlzLl9hZGRyZXNzVztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICAgICAgdGhpcy5wcm9maWxlckhpbnQgPSAob3B0aW9ucy5wcm9maWxlckhpbnQgIT09IHVuZGVmaW5lZCkgPyBvcHRpb25zLnByb2ZpbGVySGludCA6IHRoaXMucHJvZmlsZXJIaW50O1xuICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jb21wcmVzc2VkID0gaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQodGhpcy5fZm9ybWF0KTtcblxuICAgICAgICAvLyBNaXAgbGV2ZWxzXG4gICAgICAgIHRoaXMuX2ludmFsaWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fbG9ja2VkTGV2ZWwgPSAtMTtcbiAgICAgICAgaWYgKCF0aGlzLl9sZXZlbHMpIHtcbiAgICAgICAgICAgIHRoaXMuX2xldmVscyA9IHRoaXMuX2N1YmVtYXAgPyBbW251bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGwsIG51bGxdXSA6IFtudWxsXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGlydHlBbGwoKTtcblxuICAgICAgICB0aGlzLl9ncHVTaXplID0gMDtcblxuICAgICAgICB0aGlzLmltcGwgPSBncmFwaGljc0RldmljZS5jcmVhdGVUZXh0dXJlSW1wbCh0aGlzKTtcblxuICAgICAgICAvLyB0cmFjayB0aGUgdGV4dHVyZVxuICAgICAgICBncmFwaGljc0RldmljZS50ZXh0dXJlcy5wdXNoKHRoaXMpO1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfVEVYVFVSRV9BTExPQywgYEFsbG9jOiBJZCAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfTogJHt0aGlzLndpZHRofXgke3RoaXMuaGVpZ2h0fSBgICtcbiAgICAgICAgICAgIGAke3RoaXMuY3ViZW1hcCA/ICdbQ3ViZW1hcF0nIDogJyd9YCArXG4gICAgICAgICAgICBgJHt0aGlzLnZvbHVtZSA/ICdbVm9sdW1lXScgOiAnJ31gICtcbiAgICAgICAgICAgIGAke3RoaXMubWlwbWFwcyA/ICdbTWlwbWFwc10nIDogJyd9YCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHRleHR1cmUuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1RFWFRVUkVfQUxMT0MsIGBEZUFsbG9jOiBJZCAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfWApO1xuXG4gICAgICAgIGlmICh0aGlzLmRldmljZSkge1xuICAgICAgICAgICAgLy8gc3RvcCB0cmFja2luZyB0aGUgdGV4dHVyZVxuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgICAgICBjb25zdCBpZHggPSBkZXZpY2UudGV4dHVyZXMuaW5kZXhPZih0aGlzKTtcbiAgICAgICAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnRleHR1cmVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZW1vdmUgdGV4dHVyZSBmcm9tIGFueSB1bmlmb3Jtc1xuICAgICAgICAgICAgZGV2aWNlLnNjb3BlLnJlbW92ZVZhbHVlKHRoaXMpO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IGltcGxlbWVudGF0aW9uXG4gICAgICAgICAgICB0aGlzLmltcGwuZGVzdHJveShkZXZpY2UpO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgdGV4dHVyZSBzdGF0c1xuICAgICAgICAgICAgdGhpcy5hZGp1c3RWcmFtU2l6ZVRyYWNraW5nKGRldmljZS5fdnJhbSwgLXRoaXMuX2dwdVNpemUpO1xuXG4gICAgICAgICAgICB0aGlzLl9sZXZlbHMgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5kZXZpY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIHJlbmRlcmluZyBjb250ZXh0IHdhcyBsb3N0LiBJdCByZWxlYXNlcyBhbGwgY29udGV4dCByZWxhdGVkIHJlc291cmNlcy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbXBsLmxvc2VDb250ZXh0KCk7XG4gICAgICAgIHRoaXMuZGlydHlBbGwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHZyYW0gc2l6ZSB0cmFja2luZyBmb3IgdGhlIHRleHR1cmUsIHNpemUgY2FuIGJlIHBvc2l0aXZlIHRvIGFkZCBvciBuZWdhdGl2ZSB0byBzdWJ0cmFjdFxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFkanVzdFZyYW1TaXplVHJhY2tpbmcodnJhbSwgc2l6ZSkge1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfVlJBTV9URVhUVVJFLCBgJHt0aGlzLmlkfSAke3RoaXMubmFtZX0gc2l6ZTogJHtzaXplfSB2cmFtLnRleHR1cmU6ICR7dnJhbS50ZXh9ID0+ICR7dnJhbS50ZXggKyBzaXplfWApO1xuXG4gICAgICAgIHZyYW0udGV4ICs9IHNpemU7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBpZiAodGhpcy5wcm9maWxlckhpbnQgPT09IFRFWEhJTlRfU0hBRE9XTUFQKSB7XG4gICAgICAgICAgICB2cmFtLnRleFNoYWRvdyArPSBzaXplO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMucHJvZmlsZXJIaW50ID09PSBURVhISU5UX0FTU0VUKSB7XG4gICAgICAgICAgICB2cmFtLnRleEFzc2V0ICs9IHNpemU7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5wcm9maWxlckhpbnQgPT09IFRFWEhJTlRfTElHSFRNQVApIHtcbiAgICAgICAgICAgIHZyYW0udGV4TGlnaHRtYXAgKz0gc2l6ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWluaWZpY2F0aW9uIGZpbHRlciB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxURVJfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUX01JUE1BUF9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVH1cbiAgICAgKiAtIHtAbGluayBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVJ9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtaW5GaWx0ZXIodikge1xuICAgICAgICBpZiAodGhpcy5fbWluRmlsdGVyICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9taW5GaWx0ZXIgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaW5GaWx0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9taW5GaWx0ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hZ25pZmljYXRpb24gZmlsdGVyIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9ORUFSRVNUfVxuICAgICAqIC0ge0BsaW5rIEZJTFRFUl9MSU5FQVJ9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYWdGaWx0ZXIodikge1xuICAgICAgICBpZiAodGhpcy5fbWFnRmlsdGVyICE9PSB2KSB7XG4gICAgICAgICAgICB0aGlzLl9tYWdGaWx0ZXIgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYWdGaWx0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYWdGaWx0ZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFkZHJlc3NpbmcgbW9kZSB0byBiZSBhcHBsaWVkIHRvIHRoZSB0ZXh0dXJlIGhvcml6b250YWxseS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQUREUkVTU19SRVBFQVR9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19DTEFNUF9UT19FREdFfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYWRkcmVzc1Uodikge1xuICAgICAgICBpZiAodGhpcy5fYWRkcmVzc1UgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NVID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWRkcmVzc1UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRyZXNzVTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWRkcmVzc2luZyBtb2RlIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHRleHR1cmUgdmVydGljYWxseS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQUREUkVTU19SRVBFQVR9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19DTEFNUF9UT19FREdFfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYWRkcmVzc1Yodikge1xuICAgICAgICBpZiAodGhpcy5fYWRkcmVzc1YgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NWID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYWRkcmVzc1YoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hZGRyZXNzVjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYWRkcmVzc2luZyBtb2RlIHRvIGJlIGFwcGxpZWQgdG8gdGhlIDNEIHRleHR1cmUgZGVwdGggKFdlYkdMMiBvbmx5KS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQUREUkVTU19SRVBFQVR9XG4gICAgICogLSB7QGxpbmsgQUREUkVTU19DTEFNUF9UT19FREdFfVxuICAgICAqIC0ge0BsaW5rIEFERFJFU1NfTUlSUk9SRURfUkVQRUFUfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYWRkcmVzc1coYWRkcmVzc1cpIHtcbiAgICAgICAgaWYgKCF0aGlzLmRldmljZS53ZWJnbDIpIHJldHVybjtcbiAgICAgICAgaWYgKCF0aGlzLl92b2x1bWUpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oXCJwYy5UZXh0dXJlI2FkZHJlc3NXOiBDYW4ndCBzZXQgVyBhZGRyZXNzaW5nIG1vZGUgZm9yIGEgbm9uLTNEIHRleHR1cmUuXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhZGRyZXNzVyAhPT0gdGhpcy5fYWRkcmVzc1cpIHtcbiAgICAgICAgICAgIHRoaXMuX2FkZHJlc3NXID0gYWRkcmVzc1c7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAxNjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhZGRyZXNzVygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FkZHJlc3NXO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZW4gZW5hYmxlZCwgYW5kIGlmIHRleHR1cmUgZm9ybWF0IGlzIHtAbGluayBQSVhFTEZPUk1BVF9ERVBUSH0gb3JcbiAgICAgKiB7QGxpbmsgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMfSwgaGFyZHdhcmUgUENGIGlzIGVuYWJsZWQgZm9yIHRoaXMgdGV4dHVyZSwgYW5kIHlvdSBjYW4gZ2V0XG4gICAgICogZmlsdGVyZWQgcmVzdWx0cyBvZiBjb21wYXJpc29uIHVzaW5nIHRleHR1cmUoKSBpbiB5b3VyIHNoYWRlciAoV2ViR0wyIG9ubHkpLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNvbXBhcmVPblJlYWQodikge1xuICAgICAgICBpZiAodGhpcy5fY29tcGFyZU9uUmVhZCAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fY29tcGFyZU9uUmVhZCA9IHY7XG4gICAgICAgICAgICB0aGlzLl9wYXJhbWV0ZXJGbGFncyB8PSAzMjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjb21wYXJlT25SZWFkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29tcGFyZU9uUmVhZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb21wYXJpc29uIGZ1bmN0aW9uIHdoZW4gY29tcGFyZU9uUmVhZCBpcyBlbmFibGVkIChXZWJHTDIgb25seSkuIFBvc3NpYmxlIHZhbHVlczpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZVTkNfTEVTU31cbiAgICAgKiAtIHtAbGluayBGVU5DX0xFU1NFUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX0dSRUFURVJ9XG4gICAgICogLSB7QGxpbmsgRlVOQ19HUkVBVEVSRVFVQUx9XG4gICAgICogLSB7QGxpbmsgRlVOQ19FUVVBTH1cbiAgICAgKiAtIHtAbGluayBGVU5DX05PVEVRVUFMfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgY29tcGFyZUZ1bmModikge1xuICAgICAgICBpZiAodGhpcy5fY29tcGFyZUZ1bmMgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbXBhcmVGdW5jID0gdjtcbiAgICAgICAgICAgIHRoaXMuX3BhcmFtZXRlckZsYWdzIHw9IDY0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNvbXBhcmVGdW5jKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29tcGFyZUZ1bmM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW50ZWdlciB2YWx1ZSBzcGVjaWZ5aW5nIHRoZSBsZXZlbCBvZiBhbmlzb3Ryb3BpYyB0byBhcHBseSB0byB0aGUgdGV4dHVyZSByYW5naW5nIGZyb20gMSAobm9cbiAgICAgKiBhbmlzb3Ryb3BpYyBmaWx0ZXJpbmcpIHRvIHRoZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2V9IHByb3BlcnR5IG1heEFuaXNvdHJvcHkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhbmlzb3Ryb3B5KHYpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FuaXNvdHJvcHkgIT09IHYpIHtcbiAgICAgICAgICAgIHRoaXMuX2FuaXNvdHJvcHkgPSB2O1xuICAgICAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgfD0gMTI4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFuaXNvdHJvcHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbmlzb3Ryb3B5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRvZ2dsZXMgYXV0b21hdGljIG1pcG1hcCBnZW5lcmF0aW9uLiBDYW4ndCBiZSB1c2VkIG9uIG5vbiBwb3dlciBvZiB0d28gdGV4dHVyZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAaWdub3JlXG4gICAgICogQGRlcHJlY2F0ZWRcbiAgICAgKi9cbiAgICBzZXQgYXV0b01pcG1hcCh2KSB7XG4gICAgICAgIHRoaXMuX21pcG1hcHMgPSB2O1xuICAgIH1cblxuICAgIGdldCBhdXRvTWlwbWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWlwbWFwcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIGlmIHRleHR1cmUgc2hvdWxkIGdlbmVyYXRlL3VwbG9hZCBtaXBtYXBzIGlmIHBvc3NpYmxlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IG1pcG1hcHModikge1xuICAgICAgICBpZiAodGhpcy5fbWlwbWFwcyAhPT0gdikge1xuICAgICAgICAgICAgdGhpcy5fbWlwbWFwcyA9IHY7XG4gICAgICAgICAgICBpZiAodikgdGhpcy5fbmVlZHNNaXBtYXBzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaXBtYXBzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWlwbWFwcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgd2lkdGggb2YgdGhlIHRleHR1cmUgaW4gcGl4ZWxzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgd2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl93aWR0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgaGVpZ2h0IG9mIHRoZSB0ZXh0dXJlIGluIHBpeGVscy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGhlaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2hlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbnVtYmVyIG9mIGRlcHRoIHNsaWNlcyBpbiBhIDNEIHRleHR1cmUgKFdlYkdMMiBvbmx5KS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGRlcHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZGVwdGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHBpeGVsIGZvcm1hdCBvZiB0aGUgdGV4dHVyZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQTh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTDh9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfTEE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjU2NX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNTU1MX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBNH1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0I4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQkE4fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0RYVDF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfRFhUM31cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9EWFQ1fVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjE2Rn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMTZGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1JHQjMyRn1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9SR0JBMzJGfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0VUQzF9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMX1cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCQV8xfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUXzExMTExMEZ9XG4gICAgICogLSB7QGxpbmsgUElYRUxGT1JNQVRfQVNUQ180eDR9Pi9saT5cbiAgICAgKiAtIHtAbGluayBQSVhFTEZPUk1BVF9BVENfUkdCfVxuICAgICAqIC0ge0BsaW5rIFBJWEVMRk9STUFUX0FUQ19SR0JBfVxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgZm9ybWF0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZm9ybWF0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGlzIHRleHR1cmUgaXMgYSBjdWJlIG1hcCBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGN1YmVtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdWJlbWFwO1xuICAgIH1cblxuICAgIGdldCBncHVTaXplKCkge1xuICAgICAgICBjb25zdCBtaXBzID0gdGhpcy5wb3QgJiYgdGhpcy5fbWlwbWFwcyAmJiAhKHRoaXMuX2NvbXByZXNzZWQgJiYgdGhpcy5fbGV2ZWxzLmxlbmd0aCA9PT0gMSk7XG4gICAgICAgIHJldHVybiBUZXh0dXJlLmNhbGNHcHVTaXplKHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQsIHRoaXMuX2RlcHRoLCB0aGlzLl9mb3JtYXQsIG1pcHMsIHRoaXMuX2N1YmVtYXApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGlzIHRleHR1cmUgaXMgYSAzRCB2b2x1bWUgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGdldCB2b2x1bWUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl92b2x1bWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3BlY2lmaWVzIHdoZXRoZXIgdGhlIHRleHR1cmUgc2hvdWxkIGJlIGZsaXBwZWQgaW4gdGhlIFktZGlyZWN0aW9uLiBPbmx5IGFmZmVjdHMgdGV4dHVyZXNcbiAgICAgKiB3aXRoIGEgc291cmNlIHRoYXQgaXMgYW4gaW1hZ2UsIGNhbnZhcyBvciB2aWRlbyBlbGVtZW50LiBEb2VzIG5vdCBhZmZlY3QgY3ViZW1hcHMsXG4gICAgICogY29tcHJlc3NlZCB0ZXh0dXJlcyBvciB0ZXh0dXJlcyBzZXQgZnJvbSByYXcgcGl4ZWwgZGF0YS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBmbGlwWShmbGlwWSkge1xuICAgICAgICBpZiAodGhpcy5fZmxpcFkgIT09IGZsaXBZKSB7XG4gICAgICAgICAgICB0aGlzLl9mbGlwWSA9IGZsaXBZO1xuICAgICAgICAgICAgdGhpcy5fbmVlZHNVcGxvYWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZsaXBZKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmxpcFk7XG4gICAgfVxuXG4gICAgc2V0IHByZW11bHRpcGx5QWxwaGEocHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICBpZiAodGhpcy5fcHJlbXVsdGlwbHlBbHBoYSAhPT0gcHJlbXVsdGlwbHlBbHBoYSkge1xuICAgICAgICAgICAgdGhpcy5fcHJlbXVsdGlwbHlBbHBoYSA9IHByZW11bHRpcGx5QWxwaGE7XG4gICAgICAgICAgICB0aGlzLl9uZWVkc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcHJlbXVsdGlwbHlBbHBoYSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZW11bHRpcGx5QWxwaGE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIGFsbCBkaW1lbnNpb25zIG9mIHRoZSB0ZXh0dXJlIGFyZSBwb3dlciBvZiB0d28sIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnZXQgcG90KCkge1xuICAgICAgICByZXR1cm4gbWF0aC5wb3dlck9mVHdvKHRoaXMuX3dpZHRoKSAmJiBtYXRoLnBvd2VyT2ZUd28odGhpcy5faGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvLyBnZXQgdGhlIHRleHR1cmUncyBlbmNvZGluZyB0eXBlXG4gICAgZ2V0IGVuY29kaW5nKCkge1xuICAgICAgICBzd2l0Y2ggKHRoaXMudHlwZSkge1xuICAgICAgICAgICAgY2FzZSBURVhUVVJFVFlQRV9SR0JNOlxuICAgICAgICAgICAgICAgIHJldHVybiAncmdibSc7XG4gICAgICAgICAgICBjYXNlIFRFWFRVUkVUWVBFX1JHQkU6XG4gICAgICAgICAgICAgICAgcmV0dXJuICdyZ2JlJztcbiAgICAgICAgICAgIGNhc2UgVEVYVFVSRVRZUEVfUkdCUDpcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3JnYnAnO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm4gKHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0IxNkYgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0IzMkYgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBMTZGIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUkdCQTMyRikgPyAnbGluZWFyJyA6ICdzcmdiJztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHN0YXRpYyBmdW5jdGlvbnNcbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGUgdGhlIEdQVSBtZW1vcnkgcmVxdWlyZWQgZm9yIGEgdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRleHR1cmUncyB3aWR0aC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGV4dHVyZSdzIGhlaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVwdGggLSBUZXh0dXJlJ3MgZGVwdGguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGZvcm1hdCAtIFRleHR1cmUncyBwaXhlbCBmb3JtYXQgUElYRUxGT1JNQVRfKioqLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gbWlwbWFwcyAtIFRydWUgaWYgdGhlIHRleHR1cmUgaW5jbHVkZXMgbWlwbWFwcywgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gY3ViZW1hcCAtIFRydWUgaXMgdGhlIHRleHR1cmUgaXMgYSBjdWJlbWFwLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIG51bWJlciBvZiBieXRlcyBvZiBHUFUgbWVtb3J5IHJlcXVpcmVkIGZvciB0aGUgdGV4dHVyZS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RhdGljIGNhbGNHcHVTaXplKHdpZHRoLCBoZWlnaHQsIGRlcHRoLCBmb3JtYXQsIG1pcG1hcHMsIGN1YmVtYXApIHtcbiAgICAgICAgaWYgKCFfYmxvY2tTaXplVGFibGUpIHtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZSA9IFtdO1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0VUQzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9FVEMyX1JHQl0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCXzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQkFfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX1BWUlRDXzRCUFBfUkdCXzFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMV0gPSA4O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0RYVDFdID0gODtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9BVENfUkdCXSA9IDg7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRVRDMl9SR0JBXSA9IDE2O1xuICAgICAgICAgICAgX2Jsb2NrU2l6ZVRhYmxlW1BJWEVMRk9STUFUX0RYVDNdID0gMTY7XG4gICAgICAgICAgICBfYmxvY2tTaXplVGFibGVbUElYRUxGT1JNQVRfRFhUNV0gPSAxNjtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9BU1RDXzR4NF0gPSAxNjtcbiAgICAgICAgICAgIF9ibG9ja1NpemVUYWJsZVtQSVhFTEZPUk1BVF9BVENfUkdCQV0gPSAxNjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBpeGVsU2l6ZSA9IHBpeGVsRm9ybWF0Qnl0ZVNpemVzW2Zvcm1hdF0gPz8gMDtcbiAgICAgICAgY29uc3QgYmxvY2tTaXplID0gX2Jsb2NrU2l6ZVRhYmxlLmhhc093blByb3BlcnR5KGZvcm1hdCkgPyBfYmxvY2tTaXplVGFibGVbZm9ybWF0XSA6IDA7XG4gICAgICAgIGxldCByZXN1bHQgPSAwO1xuXG4gICAgICAgIHdoaWxlICgxKSB7XG4gICAgICAgICAgICBpZiAocGl4ZWxTaXplID4gMCkge1xuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSB1bmNvbXByZXNzZWQgZm9ybWF0c1xuICAgICAgICAgICAgICAgIHJlc3VsdCArPSB3aWR0aCAqIGhlaWdodCAqIGRlcHRoICogcGl4ZWxTaXplO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBoYW5kbGUgYmxvY2sgZm9ybWF0c1xuICAgICAgICAgICAgICAgIGxldCBibG9ja1dpZHRoID0gTWF0aC5mbG9vcigod2lkdGggKyAzKSAvIDQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJsb2NrSGVpZ2h0ID0gTWF0aC5mbG9vcigoaGVpZ2h0ICsgMykgLyA0KTtcbiAgICAgICAgICAgICAgICBjb25zdCBibG9ja0RlcHRoID0gTWF0aC5mbG9vcigoZGVwdGggKyAzKSAvIDQpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGZvcm1hdCA9PT0gUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSB8fFxuICAgICAgICAgICAgICAgICAgICBmb3JtYXQgPT09IFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2NrV2lkdGggPSBNYXRoLm1heChNYXRoLmZsb29yKGJsb2NrV2lkdGggLyAyKSwgMSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzdWx0ICs9IGJsb2NrV2lkdGggKiBibG9ja0hlaWdodCAqIGJsb2NrRGVwdGggKiBibG9ja1NpemU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB3ZSdyZSBkb25lIGlmIG1pcG1hcHMgYXJlbid0IHJlcXVpcmVkIG9yIHdlJ3ZlIGNhbGN1bGF0ZWQgdGhlIHNtYWxsZXN0IG1pcG1hcCBsZXZlbFxuICAgICAgICAgICAgaWYgKCFtaXBtYXBzIHx8ICgod2lkdGggPT09IDEpICYmIChoZWlnaHQgPT09IDEpICYmIChkZXB0aCA9PT0gMSkpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aWR0aCA9IE1hdGgubWF4KE1hdGguZmxvb3Iod2lkdGggLyAyKSwgMSk7XG4gICAgICAgICAgICBoZWlnaHQgPSBNYXRoLm1heChNYXRoLmZsb29yKGhlaWdodCAvIDIpLCAxKTtcbiAgICAgICAgICAgIGRlcHRoID0gTWF0aC5tYXgoTWF0aC5mbG9vcihkZXB0aCAvIDIpLCAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQgKiAoY3ViZW1hcCA/IDYgOiAxKTtcbiAgICB9XG5cbiAgICAvLyBGb3JjZSBhIGZ1bGwgcmVzdWJtaXNzaW9uIG9mIHRoZSB0ZXh0dXJlIHRvIFdlYkdMICh1c2VkIG9uIGEgY29udGV4dCByZXN0b3JlIGV2ZW50KVxuICAgIGRpcnR5QWxsKCkge1xuICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkID0gdGhpcy5fY3ViZW1hcCA/IFtbdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZSwgdHJ1ZV1dIDogW3RydWVdO1xuXG4gICAgICAgIHRoaXMuX25lZWRzVXBsb2FkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbmVlZHNNaXBtYXBzVXBsb2FkID0gdGhpcy5fbWlwbWFwcztcbiAgICAgICAgdGhpcy5fbWlwbWFwc1VwbG9hZGVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fcGFyYW1ldGVyRmxhZ3MgPSAyNTU7IC8vIDEgfCAyIHwgNCB8IDggfCAxNiB8IDMyIHwgNjQgfCAxMjhcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2NrcyBhIG1pcGxldmVsIG9mIHRoZSB0ZXh0dXJlLCByZXR1cm5pbmcgYSB0eXBlZCBhcnJheSB0byBiZSBmaWxsZWQgd2l0aCBwaXhlbCBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0LiBWYWxpZCBwcm9wZXJ0aWVzIGFyZSBhcyBmb2xsb3dzOlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5sZXZlbF0gLSBUaGUgbWlwIGxldmVsIHRvIGxvY2sgd2l0aCAwIGJlaW5nIHRoZSB0b3AgbGV2ZWwuIERlZmF1bHRzXG4gICAgICogdG8gMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuZmFjZV0gLSBJZiB0aGUgdGV4dHVyZSBpcyBhIGN1YmVtYXAsIHRoaXMgaXMgdGhlIGluZGV4IG9mIHRoZSBmYWNlXG4gICAgICogdG8gbG9jay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMubW9kZV0gLSBUaGUgbG9jayBtb2RlLiBDYW4gYmU6XG4gICAgICogLSB7QGxpbmsgVEVYVFVSRUxPQ0tfUkVBRH1cbiAgICAgKiAtIHtAbGluayBURVhUVVJFTE9DS19XUklURX1cbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgVEVYVFVSRUxPQ0tfV1JJVEV9LlxuICAgICAqIEByZXR1cm5zIHtVaW50OEFycmF5fFVpbnQxNkFycmF5fEZsb2F0MzJBcnJheX0gQSB0eXBlZCBhcnJheSBjb250YWluaW5nIHRoZSBwaXhlbCBkYXRhIG9mXG4gICAgICogdGhlIGxvY2tlZCBtaXAgbGV2ZWwuXG4gICAgICovXG4gICAgbG9jayhvcHRpb25zID0ge30pIHtcbiAgICAgICAgLy8gSW5pdGlhbGl6ZSBvcHRpb25zIHRvIHNvbWUgc2Vuc2libGUgZGVmYXVsdHNcbiAgICAgICAgaWYgKG9wdGlvbnMubGV2ZWwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5sZXZlbCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZmFjZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBvcHRpb25zLmZhY2UgPSAwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLm1vZGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5tb2RlID0gVEVYVFVSRUxPQ0tfV1JJVEU7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2NrZWRMZXZlbCA9IG9wdGlvbnMubGV2ZWw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgc3dpdGNoICh0aGlzLl9mb3JtYXQpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0E4OlxuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfTDg6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0xBODpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiAgdGhpcy5fZGVwdGggKiAyKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0I1NjU6XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBNTU1MTpcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE0OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDE2QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCODpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDMpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkE4OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDhBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogNCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUMTpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW29wdGlvbnMubGV2ZWxdID0gbmV3IFVpbnQ4QXJyYXkoTWF0aC5mbG9vcigodGhpcy5fd2lkdGggKyAzKSAvIDQpICogTWF0aC5mbG9vcigodGhpcy5faGVpZ2h0ICsgMykgLyA0KSAqIDggKiB0aGlzLl9kZXB0aCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfRFhUMzpcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX0RYVDU6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50OEFycmF5KE1hdGguZmxvb3IoKHRoaXMuX3dpZHRoICsgMykgLyA0KSAqIE1hdGguZmxvb3IoKHRoaXMuX2hlaWdodCArIDMpIC8gNCkgKiAxNiAqIHRoaXMuX2RlcHRoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0IxNkY6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBVaW50MTZBcnJheSh0aGlzLl93aWR0aCAqIHRoaXMuX2hlaWdodCAqIHRoaXMuX2RlcHRoICogMyk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMzJGOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgRmxvYXQzMkFycmF5KHRoaXMuX3dpZHRoICogdGhpcy5faGVpZ2h0ICogdGhpcy5fZGVwdGggKiAzKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMTZGOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF0gPSBuZXcgVWludDE2QXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkEzMkY6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1tvcHRpb25zLmxldmVsXSA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5fd2lkdGggKiB0aGlzLl9oZWlnaHQgKiB0aGlzLl9kZXB0aCAqIDQpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9sZXZlbHNbb3B0aW9ucy5sZXZlbF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBwaXhlbCBkYXRhIG9mIHRoZSB0ZXh0dXJlIGZyb20gYSBjYW52YXMsIGltYWdlLCB2aWRlbyBET00gZWxlbWVudC4gSWYgdGhlIHRleHR1cmUgaXNcbiAgICAgKiBhIGN1YmVtYXAsIHRoZSBzdXBwbGllZCBzb3VyY2UgbXVzdCBiZSBhbiBhcnJheSBvZiA2IGNhbnZhc2VzLCBpbWFnZXMgb3IgdmlkZW9zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudHxIVE1MSW1hZ2VFbGVtZW50fEhUTUxWaWRlb0VsZW1lbnR8SFRNTENhbnZhc0VsZW1lbnRbXXxIVE1MSW1hZ2VFbGVtZW50W118SFRNTFZpZGVvRWxlbWVudFtdfSBzb3VyY2UgLSBBXG4gICAgICogY2FudmFzLCBpbWFnZSBvciB2aWRlbyBlbGVtZW50LCBvciBhbiBhcnJheSBvZiA2IGNhbnZhcywgaW1hZ2Ugb3IgdmlkZW8gZWxlbWVudHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttaXBMZXZlbF0gLSBBIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIGltYWdlIGxldmVsIG9mIGRldGFpbC5cbiAgICAgKiBEZWZhdWx0cyB0byAwLCB3aGljaCByZXByZXNlbnRzIHRoZSBiYXNlIGltYWdlIHNvdXJjZS4gQSBsZXZlbCB2YWx1ZSBvZiBOLCB0aGF0IGlzIGdyZWF0ZXJcbiAgICAgKiB0aGFuIDAsIHJlcHJlc2VudHMgdGhlIGltYWdlIHNvdXJjZSBmb3IgdGhlIE50aCBtaXBtYXAgcmVkdWN0aW9uIGxldmVsLlxuICAgICAqL1xuICAgIHNldFNvdXJjZShzb3VyY2UsIG1pcExldmVsID0gMCkge1xuICAgICAgICBsZXQgaW52YWxpZCA9IGZhbHNlO1xuICAgICAgICBsZXQgd2lkdGgsIGhlaWdodDtcblxuICAgICAgICBpZiAodGhpcy5fY3ViZW1hcCkge1xuICAgICAgICAgICAgaWYgKHNvdXJjZVswXSkge1xuICAgICAgICAgICAgICAgIC8vIHJlbHkgb24gZmlyc3QgZmFjZSBzaXplc1xuICAgICAgICAgICAgICAgIHdpZHRoID0gc291cmNlWzBdLndpZHRoIHx8IDA7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gc291cmNlWzBdLmhlaWdodCB8fCAwO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2OyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmFjZSA9IHNvdXJjZVtpXTtcbiAgICAgICAgICAgICAgICAgICAgLy8gY3ViZW1hcCBiZWNvbWVzIGludmFsaWQgaWYgYW55IGNvbmRpdGlvbiBpcyBub3Qgc2F0aXNmaWVkXG4gICAgICAgICAgICAgICAgICAgIGlmICghZmFjZSB8fCAgICAgICAgICAgICAgICAgIC8vIGZhY2UgaXMgbWlzc2luZ1xuICAgICAgICAgICAgICAgICAgICAgICAgZmFjZS53aWR0aCAhPT0gd2lkdGggfHwgICAvLyBmYWNlIGlzIGRpZmZlcmVudCB3aWR0aFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFjZS5oZWlnaHQgIT09IGhlaWdodCB8fCAvLyBmYWNlIGlzIGRpZmZlcmVudCBoZWlnaHRcbiAgICAgICAgICAgICAgICAgICAgICAgICF0aGlzLmRldmljZS5faXNCcm93c2VySW50ZXJmYWNlKGZhY2UpKSB7ICAgICAgICAgICAgLy8gbmV3IGltYWdlIGJpdG1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgaW52YWxpZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gZmlyc3QgZmFjZSBpcyBtaXNzaW5nXG4gICAgICAgICAgICAgICAgaW52YWxpZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghaW52YWxpZCkge1xuICAgICAgICAgICAgICAgIC8vIG1hcmsgbGV2ZWxzIGFzIHVwZGF0ZWRcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fbGV2ZWxzW21pcExldmVsXVtpXSAhPT0gc291cmNlW2ldKVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGV2ZWxzVXBkYXRlZFttaXBMZXZlbF1baV0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGNoZWNrIGlmIHNvdXJjZSBpcyB2YWxpZCB0eXBlIG9mIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICghdGhpcy5kZXZpY2UuX2lzQnJvd3NlckludGVyZmFjZShzb3VyY2UpKVxuICAgICAgICAgICAgICAgIGludmFsaWQgPSB0cnVlO1xuXG4gICAgICAgICAgICBpZiAoIWludmFsaWQpIHtcbiAgICAgICAgICAgICAgICAvLyBtYXJrIGxldmVsIGFzIHVwZGF0ZWRcbiAgICAgICAgICAgICAgICBpZiAoc291cmNlICE9PSB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXSA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICB3aWR0aCA9IHNvdXJjZS53aWR0aDtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSBzb3VyY2UuaGVpZ2h0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGludmFsaWQpIHtcbiAgICAgICAgICAgIC8vIGludmFsaWQgdGV4dHVyZVxuXG4gICAgICAgICAgICAvLyBkZWZhdWx0IHNpemVzXG4gICAgICAgICAgICB0aGlzLl93aWR0aCA9IDQ7XG4gICAgICAgICAgICB0aGlzLl9oZWlnaHQgPSA0O1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgbGV2ZWxzXG4gICAgICAgICAgICBpZiAodGhpcy5fY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xldmVsc1ttaXBMZXZlbF1baV0gPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXVtpXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdID0gbnVsbDtcbiAgICAgICAgICAgICAgICB0aGlzLl9sZXZlbHNVcGRhdGVkW21pcExldmVsXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyB2YWxpZCB0ZXh0dXJlXG4gICAgICAgICAgICBpZiAobWlwTGV2ZWwgPT09IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl93aWR0aCA9IHdpZHRoO1xuICAgICAgICAgICAgICAgIHRoaXMuX2hlaWdodCA9IGhlaWdodDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fbGV2ZWxzW21pcExldmVsXSA9IHNvdXJjZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIG9yIGNoYW5nZWQgc3RhdGUgb2YgdmFsaWRpdHlcbiAgICAgICAgaWYgKHRoaXMuX2ludmFsaWQgIT09IGludmFsaWQgfHwgIWludmFsaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2ludmFsaWQgPSBpbnZhbGlkO1xuXG4gICAgICAgICAgICAvLyByZXVwbG9hZFxuICAgICAgICAgICAgdGhpcy51cGxvYWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgcGl4ZWwgZGF0YSBvZiB0aGUgdGV4dHVyZS4gSWYgdGhpcyBpcyBhIGN1YmVtYXAgdGhlbiBhbiBhcnJheSBvZiA2IGltYWdlcyB3aWxsIGJlXG4gICAgICogcmV0dXJuZWQgb3RoZXJ3aXNlIGEgc2luZ2xlIGltYWdlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttaXBMZXZlbF0gLSBBIG5vbi1uZWdhdGl2ZSBpbnRlZ2VyIHNwZWNpZnlpbmcgdGhlIGltYWdlIGxldmVsIG9mIGRldGFpbC5cbiAgICAgKiBEZWZhdWx0cyB0byAwLCB3aGljaCByZXByZXNlbnRzIHRoZSBiYXNlIGltYWdlIHNvdXJjZS4gQSBsZXZlbCB2YWx1ZSBvZiBOLCB0aGF0IGlzIGdyZWF0ZXJcbiAgICAgKiB0aGFuIDAsIHJlcHJlc2VudHMgdGhlIGltYWdlIHNvdXJjZSBmb3IgdGhlIE50aCBtaXBtYXAgcmVkdWN0aW9uIGxldmVsLlxuICAgICAqIEByZXR1cm5zIHtIVE1MSW1hZ2VFbGVtZW50fSBUaGUgc291cmNlIGltYWdlIG9mIHRoaXMgdGV4dHVyZS4gQ2FuIGJlIG51bGwgaWYgc291cmNlIG5vdFxuICAgICAqIGFzc2lnbmVkIGZvciBzcGVjaWZpYyBpbWFnZSBsZXZlbC5cbiAgICAgKi9cbiAgICBnZXRTb3VyY2UobWlwTGV2ZWwgPSAwKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sZXZlbHNbbWlwTGV2ZWxdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVubG9ja3MgdGhlIGN1cnJlbnRseSBsb2NrZWQgbWlwIGxldmVsIGFuZCB1cGxvYWRzIGl0IHRvIFZSQU0uXG4gICAgICovXG4gICAgdW5sb2NrKCkge1xuICAgICAgICBpZiAodGhpcy5fbG9ja2VkTGV2ZWwgPT09IC0xKSB7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coXCJwYy5UZXh0dXJlI3VubG9jazogQXR0ZW1wdGluZyB0byB1bmxvY2sgYSB0ZXh0dXJlIHRoYXQgaXMgbm90IGxvY2tlZC5cIiwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGxvYWQgdGhlIG5ldyBwaXhlbCBkYXRhXG4gICAgICAgIHRoaXMudXBsb2FkKCk7XG4gICAgICAgIHRoaXMuX2xvY2tlZExldmVsID0gLTE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9yY2VzIGEgcmV1cGxvYWQgb2YgdGhlIHRleHR1cmVzIHBpeGVsIGRhdGEgdG8gZ3JhcGhpY3MgbWVtb3J5LiBPcmRpbmFyaWx5LCB0aGlzIGZ1bmN0aW9uXG4gICAgICogaXMgY2FsbGVkIGJ5IGludGVybmFsbHkgYnkge0BsaW5rIFRleHR1cmUjc2V0U291cmNlfSBhbmQge0BsaW5rIFRleHR1cmUjdW5sb2NrfS4gSG93ZXZlciwgaXRcbiAgICAgKiBzdGlsbCBuZWVkcyB0byBiZSBjYWxsZWQgZXhwbGljaXRseSBpbiB0aGUgY2FzZSB3aGVyZSBhbiBIVE1MVmlkZW9FbGVtZW50IGlzIHNldCBhcyB0aGVcbiAgICAgKiBzb3VyY2Ugb2YgdGhlIHRleHR1cmUuICBOb3JtYWxseSwgdGhpcyBpcyBkb25lIG9uY2UgZXZlcnkgZnJhbWUgYmVmb3JlIHZpZGVvIHRleHR1cmVkXG4gICAgICogZ2VvbWV0cnkgaXMgcmVuZGVyZWQuXG4gICAgICovXG4gICAgdXBsb2FkKCkge1xuICAgICAgICB0aGlzLl9uZWVkc1VwbG9hZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX25lZWRzTWlwbWFwc1VwbG9hZCA9IHRoaXMuX21pcG1hcHM7XG4gICAgICAgIHRoaXMuaW1wbC51cGxvYWRJbW1lZGlhdGU/Lih0aGlzLmRldmljZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGUgYW4gaW4tbWVtb3J5IEREUyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIHRleHR1cmUuIE9ubHkgd29ya3Mgb24gUkdCQTggdGV4dHVyZXMuXG4gICAgICogQ3VycmVudGx5LCBvbmx5IHVzZWQgYnkgdGhlIEVkaXRvciB0byB3cml0ZSBwcmVmaWx0ZXJlZCBjdWJlbWFwcyB0byBERFMgZm9ybWF0LlxuICAgICAqXG4gICAgICogQHJldHVybnMge0FycmF5QnVmZmVyfSBCdWZmZXIgY29udGFpbmluZyB0aGUgRERTIGRhdGEuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldERkcygpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0JBOCwgXCJUaGlzIGZvcm1hdCBpcyBub3QgaW1wbGVtZW50ZWQgeWV0XCIpO1xuXG4gICAgICAgIGxldCBmc2l6ZSA9IDEyODtcbiAgICAgICAgbGV0IGlkeCA9IDA7XG4gICAgICAgIHdoaWxlICh0aGlzLl9sZXZlbHNbaWR4XSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1YmVtYXApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaXBTaXplID0gdGhpcy5fbGV2ZWxzW2lkeF0ubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGlmICghbWlwU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgTm8gYnl0ZSBhcnJheSBmb3IgbWlwICR7aWR4fWApO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmc2l6ZSArPSBtaXBTaXplO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBmYWNlID0gMDsgZmFjZSA8IDY7IGZhY2UrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2xldmVsc1tpZHhdW2ZhY2VdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Zy5lcnJvcihgTm8gbGV2ZWwgZGF0YSBmb3IgbWlwICR7aWR4fSwgZmFjZSAke2ZhY2V9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pcFNpemUgPSB0aGlzLl9sZXZlbHNbaWR4XVtmYWNlXS5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbWlwU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgRGVidWcuZXJyb3IoYE5vIGJ5dGUgYXJyYXkgZm9yIG1pcCAke2lkeH0sIGZhY2UgJHtmYWNlfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBmc2l6ZSArPSBtaXBTaXplO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZzaXplICs9IHRoaXMuX2xldmVsc1tpZHhdLmxlbmd0aDtcbiAgICAgICAgICAgIGlkeCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYnVmZiA9IG5ldyBBcnJheUJ1ZmZlcihmc2l6ZSk7XG4gICAgICAgIGNvbnN0IGhlYWRlciA9IG5ldyBVaW50MzJBcnJheShidWZmLCAwLCAxMjggLyA0KTtcblxuICAgICAgICBjb25zdCBERFNfTUFHSUMgPSA1NDIzMjc4NzY7IC8vIFwiRERTXCJcbiAgICAgICAgY29uc3QgRERTX0hFQURFUl9TSVpFID0gMTI0O1xuICAgICAgICBjb25zdCBERFNfRkxBR1NfUkVRVUlSRUQgPSAweDAxIHwgMHgwMiB8IDB4MDQgfCAweDEwMDAgfCAweDgwMDAwOyAvLyBjYXBzIHwgaGVpZ2h0IHwgd2lkdGggfCBwaXhlbGZvcm1hdCB8IGxpbmVhcnNpemVcbiAgICAgICAgY29uc3QgRERTX0ZMQUdTX01JUE1BUCA9IDB4MjAwMDA7XG4gICAgICAgIGNvbnN0IEREU19QSVhFTEZPUk1BVF9TSVpFID0gMzI7XG4gICAgICAgIGNvbnN0IEREU19QSVhFTEZMQUdTX1JHQkE4ID0gMHgwMSB8IDB4NDA7IC8vIGFscGhhIHwgcmdiXG4gICAgICAgIGNvbnN0IEREU19DQVBTX1JFUVVJUkVEID0gMHgxMDAwO1xuICAgICAgICBjb25zdCBERFNfQ0FQU19NSVBNQVAgPSAweDQwMDAwMDtcbiAgICAgICAgY29uc3QgRERTX0NBUFNfQ09NUExFWCA9IDB4ODtcbiAgICAgICAgY29uc3QgRERTX0NBUFMyX0NVQkVNQVAgPSAweDIwMCB8IDB4NDAwIHwgMHg4MDAgfCAweDEwMDAgfCAweDIwMDAgfCAweDQwMDAgfCAweDgwMDA7IC8vIGN1YmVtYXAgfCBhbGwgZmFjZXNcblxuICAgICAgICBsZXQgZmxhZ3MgPSBERFNfRkxBR1NfUkVRVUlSRUQ7XG4gICAgICAgIGlmICh0aGlzLl9sZXZlbHMubGVuZ3RoID4gMSkgZmxhZ3MgfD0gRERTX0ZMQUdTX01JUE1BUDtcblxuICAgICAgICBsZXQgY2FwcyA9IEREU19DQVBTX1JFUVVJUkVEO1xuICAgICAgICBpZiAodGhpcy5fbGV2ZWxzLmxlbmd0aCA+IDEpIGNhcHMgfD0gRERTX0NBUFNfTUlQTUFQO1xuICAgICAgICBpZiAodGhpcy5fbGV2ZWxzLmxlbmd0aCA+IDEgfHwgdGhpcy5jdWJlbWFwKSBjYXBzIHw9IEREU19DQVBTX0NPTVBMRVg7XG5cbiAgICAgICAgY29uc3QgY2FwczIgPSB0aGlzLmN1YmVtYXAgPyBERFNfQ0FQUzJfQ1VCRU1BUCA6IDA7XG5cbiAgICAgICAgaGVhZGVyWzBdID0gRERTX01BR0lDO1xuICAgICAgICBoZWFkZXJbMV0gPSBERFNfSEVBREVSX1NJWkU7XG4gICAgICAgIGhlYWRlclsyXSA9IGZsYWdzO1xuICAgICAgICBoZWFkZXJbM10gPSB0aGlzLmhlaWdodDtcbiAgICAgICAgaGVhZGVyWzRdID0gdGhpcy53aWR0aDtcbiAgICAgICAgaGVhZGVyWzVdID0gdGhpcy53aWR0aCAqIHRoaXMuaGVpZ2h0ICogNDtcbiAgICAgICAgaGVhZGVyWzZdID0gMDsgLy8gZGVwdGhcbiAgICAgICAgaGVhZGVyWzddID0gdGhpcy5fbGV2ZWxzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAxMTsgaSsrKSB7XG4gICAgICAgICAgICBoZWFkZXJbOCArIGldID0gMDtcbiAgICAgICAgfVxuICAgICAgICBoZWFkZXJbMTldID0gRERTX1BJWEVMRk9STUFUX1NJWkU7XG4gICAgICAgIGhlYWRlclsyMF0gPSBERFNfUElYRUxGTEFHU19SR0JBODtcbiAgICAgICAgaGVhZGVyWzIxXSA9IDA7IC8vIGZvdXJjY1xuICAgICAgICBoZWFkZXJbMjJdID0gMzI7IC8vIGJwcFxuICAgICAgICBoZWFkZXJbMjNdID0gMHgwMEZGMDAwMDsgLy8gUiBtYXNrXG4gICAgICAgIGhlYWRlclsyNF0gPSAweDAwMDBGRjAwOyAvLyBHIG1hc2tcbiAgICAgICAgaGVhZGVyWzI1XSA9IDB4MDAwMDAwRkY7IC8vIEIgbWFza1xuICAgICAgICBoZWFkZXJbMjZdID0gMHhGRjAwMDAwMDsgLy8gQSBtYXNrXG4gICAgICAgIGhlYWRlclsyN10gPSBjYXBzO1xuICAgICAgICBoZWFkZXJbMjhdID0gY2FwczI7XG4gICAgICAgIGhlYWRlclsyOV0gPSAwO1xuICAgICAgICBoZWFkZXJbMzBdID0gMDtcbiAgICAgICAgaGVhZGVyWzMxXSA9IDA7XG5cbiAgICAgICAgbGV0IG9mZnNldCA9IDEyODtcbiAgICAgICAgaWYgKCF0aGlzLmN1YmVtYXApIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbWlwID0gbmV3IFVpbnQ4QXJyYXkoYnVmZiwgb2Zmc2V0LCBsZXZlbC5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGV2ZWwubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlwW2pdID0gbGV2ZWxbal07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9mZnNldCArPSBsZXZlbC5sZW5ndGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKGxldCBmYWNlID0gMDsgZmFjZSA8IDY7IGZhY2UrKykge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxldmVsID0gdGhpcy5fbGV2ZWxzW2ldW2ZhY2VdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtaXAgPSBuZXcgVWludDhBcnJheShidWZmLCBvZmZzZXQsIGxldmVsLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGV2ZWwubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pcFtqXSA9IGxldmVsW2pdO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG9mZnNldCArPSBsZXZlbC5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGJ1ZmY7XG4gICAgfVxufVxuXG5leHBvcnQgeyBUZXh0dXJlIH07XG4iXSwibmFtZXMiOlsiX2Jsb2NrU2l6ZVRhYmxlIiwiaWQiLCJUZXh0dXJlIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsIm9wdGlvbnMiLCJkZXZpY2UiLCJEZWJ1ZyIsImFzc2VydCIsIm5hbWUiLCJfd2lkdGgiLCJfaGVpZ2h0IiwiX2RlcHRoIiwiX2Zvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwidHlwZSIsIlRFWFRVUkVUWVBFX0RFRkFVTFQiLCJwcm9qZWN0aW9uIiwiVEVYVFVSRVBST0pFQ1RJT05fTk9ORSIsIl9jdWJlbWFwIiwiX3ZvbHVtZSIsImZpeEN1YmVtYXBTZWFtcyIsIl9mbGlwWSIsIl9wcmVtdWx0aXBseUFscGhhIiwiX2lzUmVuZGVyVGFyZ2V0IiwiX21pcG1hcHMiLCJfbWluRmlsdGVyIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiX21hZ0ZpbHRlciIsIkZJTFRFUl9MSU5FQVIiLCJfYW5pc290cm9weSIsIl9hZGRyZXNzVSIsIkFERFJFU1NfUkVQRUFUIiwiX2FkZHJlc3NWIiwiX2FkZHJlc3NXIiwiX2NvbXBhcmVPblJlYWQiLCJfY29tcGFyZUZ1bmMiLCJGVU5DX0xFU1MiLCJwcm9maWxlckhpbnQiLCJ1bmRlZmluZWQiLCJ3aWR0aCIsImhlaWdodCIsImZvcm1hdCIsImhhc093blByb3BlcnR5IiwiZGVwcmVjYXRlZCIsInJnYm0iLCJURVhUVVJFVFlQRV9SR0JNIiwic3dpenpsZUdHR1IiLCJURVhUVVJFVFlQRV9TV0laWkxFR0dHUiIsIm1pcG1hcHMiLCJhdXRvTWlwbWFwIiwiX2xldmVscyIsImxldmVscyIsImN1YmVtYXAiLCJURVhUVVJFUFJPSkVDVElPTl9DVUJFIiwibWluRmlsdGVyIiwibWFnRmlsdGVyIiwiYW5pc290cm9weSIsImFkZHJlc3NVIiwiYWRkcmVzc1YiLCJjb21wYXJlT25SZWFkIiwiZmxpcFkiLCJwcmVtdWx0aXBseUFscGhhIiwid2ViZ2wyIiwiZGVwdGgiLCJ2b2x1bWUiLCJhZGRyZXNzVyIsIl9jb21wcmVzc2VkIiwiaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQiLCJfaW52YWxpZCIsIl9sb2NrZWRMZXZlbCIsImRpcnR5QWxsIiwiX2dwdVNpemUiLCJpbXBsIiwiY3JlYXRlVGV4dHVyZUltcGwiLCJ0ZXh0dXJlcyIsInB1c2giLCJ0cmFjZSIsIlRSQUNFSURfVEVYVFVSRV9BTExPQyIsImRlc3Ryb3kiLCJpZHgiLCJpbmRleE9mIiwic3BsaWNlIiwic2NvcGUiLCJyZW1vdmVWYWx1ZSIsImFkanVzdFZyYW1TaXplVHJhY2tpbmciLCJfdnJhbSIsImxvc2VDb250ZXh0IiwidnJhbSIsInNpemUiLCJUUkFDRUlEX1ZSQU1fVEVYVFVSRSIsInRleCIsIlRFWEhJTlRfU0hBRE9XTUFQIiwidGV4U2hhZG93IiwiVEVYSElOVF9BU1NFVCIsInRleEFzc2V0IiwiVEVYSElOVF9MSUdIVE1BUCIsInRleExpZ2h0bWFwIiwidiIsIl9wYXJhbWV0ZXJGbGFncyIsIndhcm4iLCJjb21wYXJlRnVuYyIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJncHVTaXplIiwibWlwcyIsInBvdCIsImxlbmd0aCIsImNhbGNHcHVTaXplIiwiX25lZWRzVXBsb2FkIiwibWF0aCIsInBvd2VyT2ZUd28iLCJlbmNvZGluZyIsIlRFWFRVUkVUWVBFX1JHQkUiLCJURVhUVVJFVFlQRV9SR0JQIiwiUElYRUxGT1JNQVRfUkdCMTZGIiwiUElYRUxGT1JNQVRfUkdCMzJGIiwiUElYRUxGT1JNQVRfUkdCQTE2RiIsIlBJWEVMRk9STUFUX1JHQkEzMkYiLCJfcGl4ZWxGb3JtYXRCeXRlU2l6ZXMiLCJQSVhFTEZPUk1BVF9FVEMxIiwiUElYRUxGT1JNQVRfRVRDMl9SR0IiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9EWFQxIiwiUElYRUxGT1JNQVRfQVRDX1JHQiIsIlBJWEVMRk9STUFUX0VUQzJfUkdCQSIsIlBJWEVMRk9STUFUX0RYVDMiLCJQSVhFTEZPUk1BVF9EWFQ1IiwiUElYRUxGT1JNQVRfQVNUQ180eDQiLCJQSVhFTEZPUk1BVF9BVENfUkdCQSIsInBpeGVsU2l6ZSIsInBpeGVsRm9ybWF0Qnl0ZVNpemVzIiwiYmxvY2tTaXplIiwicmVzdWx0IiwiYmxvY2tXaWR0aCIsIk1hdGgiLCJmbG9vciIsImJsb2NrSGVpZ2h0IiwiYmxvY2tEZXB0aCIsIm1heCIsIl9sZXZlbHNVcGRhdGVkIiwiX21pcG1hcHNVcGxvYWRlZCIsImxvY2siLCJsZXZlbCIsImZhY2UiLCJtb2RlIiwiVEVYVFVSRUxPQ0tfV1JJVEUiLCJQSVhFTEZPUk1BVF9BOCIsIlBJWEVMRk9STUFUX0w4IiwiVWludDhBcnJheSIsIlBJWEVMRk9STUFUX0xBOCIsIlBJWEVMRk9STUFUX1JHQjU2NSIsIlBJWEVMRk9STUFUX1JHQkE1NTUxIiwiUElYRUxGT1JNQVRfUkdCQTQiLCJVaW50MTZBcnJheSIsIlBJWEVMRk9STUFUX1JHQjgiLCJGbG9hdDMyQXJyYXkiLCJzZXRTb3VyY2UiLCJzb3VyY2UiLCJtaXBMZXZlbCIsImludmFsaWQiLCJpIiwiX2lzQnJvd3NlckludGVyZmFjZSIsInVwbG9hZCIsImdldFNvdXJjZSIsInVubG9jayIsImxvZyIsIl90aGlzJGltcGwkdXBsb2FkSW1tZSIsIl90aGlzJGltcGwiLCJ1cGxvYWRJbW1lZGlhdGUiLCJjYWxsIiwiZ2V0RGRzIiwiZnNpemUiLCJtaXBTaXplIiwiZXJyb3IiLCJidWZmIiwiQXJyYXlCdWZmZXIiLCJoZWFkZXIiLCJVaW50MzJBcnJheSIsIkREU19NQUdJQyIsIkREU19IRUFERVJfU0laRSIsIkREU19GTEFHU19SRVFVSVJFRCIsIkREU19GTEFHU19NSVBNQVAiLCJERFNfUElYRUxGT1JNQVRfU0laRSIsIkREU19QSVhFTEZMQUdTX1JHQkE4IiwiRERTX0NBUFNfUkVRVUlSRUQiLCJERFNfQ0FQU19NSVBNQVAiLCJERFNfQ0FQU19DT01QTEVYIiwiRERTX0NBUFMyX0NVQkVNQVAiLCJmbGFncyIsImNhcHMiLCJjYXBzMiIsIm9mZnNldCIsIm1pcCIsImoiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFzQkEsSUFBSUEsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUUxQixJQUFJQyxFQUFFLEdBQUcsQ0FBQyxDQUFBOztBQUVWO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsT0FBTyxDQUFDO0FBQ1Y7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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
