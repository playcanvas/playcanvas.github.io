import '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { RenderTarget } from './render-target.js';
import { TextureUtils } from './texture-utils.js';
import { PIXELFORMAT_RGBA8, isCompressedPixelFormat, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_REPEAT, FUNC_LESS, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_CUBE, TEXHINT_SHADOWMAP, TEXHINT_ASSET, TEXHINT_LIGHTMAP, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, TEXTURETYPE_RGBP, TEXTURETYPE_RGBE, TEXTURELOCK_WRITE, getPixelFormatArrayType } from './constants.js';

let id = 0;
class Texture {
	constructor(graphicsDevice, options = {}) {
		var _options$name, _options$width, _options$height, _options$format, _options$cubemap, _options$fixCubemapSe, _options$flipY, _options$premultiplyA, _ref, _options$mipmaps, _options$minFilter, _options$magFilter, _options$anisotropy, _options$addressU, _options$addressV, _options$addressW, _options$compareOnRea, _options$compareFunc, _options$profilerHint;
		this.name = void 0;
		this._isRenderTarget = false;
		this._gpuSize = 0;
		this.id = id++;
		this._invalid = false;
		this._lockedLevel = -1;
		this.renderVersionDirty = 0;
		this.device = graphicsDevice;
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
	propertyChanged(flag) {
		this.impl.propertyChanged(flag);
		this.renderVersionDirty = this.device.renderVersion;
	}
	get requiredMipLevels() {
		return this.mipmaps ? Math.floor(Math.log2(Math.max(this.width, this.height))) + 1 : 1;
	}
	set minFilter(v) {
		if (this._minFilter !== v) {
			this._minFilter = v;
			this.propertyChanged(1);
		}
	}
	get minFilter() {
		return this._minFilter;
	}
	set magFilter(v) {
		if (this._magFilter !== v) {
			this._magFilter = v;
			this.propertyChanged(2);
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
			this._mipmaps = v;
			if (this.device.isWebGPU) ;
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
		return TextureUtils.calcGpuSize(this._width, this._height, this._depth, this._format, mips, this._cubemap);
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
	dirtyAll() {
		this._levelsUpdated = this._cubemap ? [[true, true, true, true, true, true]] : [true];
		this._needsUpload = true;
		this._needsMipmapsUpload = this._mipmaps;
		this._mipmapsUploaded = false;
		this.propertyChanged(255);
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
		const levels = this.cubemap ? this._levels[options.face] : this._levels;
		if (levels[options.level] === null) {
			const width = Math.max(1, this._width >> options.level);
			const height = Math.max(1, this._height >> options.level);
			const data = new ArrayBuffer(TextureUtils.calcLevelGpuSize(width, height, this._format));
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
