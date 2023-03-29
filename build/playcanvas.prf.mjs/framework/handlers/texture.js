/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { path } from '../../core/path.js';
import { PIXELFORMAT_RGB8, TEXTURETYPE_RGBM, TEXTURETYPE_SWIZZLEGGGR, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBP, PIXELFORMAT_RGBA8, PIXELFORMAT_RGBA32F } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BasisParser } from '../parsers/texture/basis.js';
import { ImgParser } from '../parsers/texture/img.js';
import { KtxParser } from '../parsers/texture/ktx.js';
import { Ktx2Parser } from '../parsers/texture/ktx2.js';
import { DdsParser } from '../parsers/texture/dds.js';
import { HdrParser } from '../parsers/texture/hdr.js';

const JSON_ADDRESS_MODE = {
	'repeat': ADDRESS_REPEAT,
	'clamp': ADDRESS_CLAMP_TO_EDGE,
	'mirror': ADDRESS_MIRRORED_REPEAT
};
const JSON_FILTER_MODE = {
	'nearest': FILTER_NEAREST,
	'linear': FILTER_LINEAR,
	'nearest_mip_nearest': FILTER_NEAREST_MIPMAP_NEAREST,
	'linear_mip_nearest': FILTER_LINEAR_MIPMAP_NEAREST,
	'nearest_mip_linear': FILTER_NEAREST_MIPMAP_LINEAR,
	'linear_mip_linear': FILTER_LINEAR_MIPMAP_LINEAR
};
const JSON_TEXTURE_TYPE = {
	'default': TEXTURETYPE_DEFAULT,
	'rgbm': TEXTURETYPE_RGBM,
	'rgbe': TEXTURETYPE_RGBE,
	'rgbp': TEXTURETYPE_RGBP,
	'swizzleGGGR': TEXTURETYPE_SWIZZLEGGGR
};
class TextureParser {
	load(url, callback, asset) {
		throw new Error('not implemented');
	}
	open(url, data, device) {
		throw new Error('not implemented');
	}
}
const _completePartialMipmapChain = function _completePartialMipmapChain(texture) {
	const requiredMipLevels = Math.log2(Math.max(texture._width, texture._height)) + 1;
	const isHtmlElement = function isHtmlElement(object) {
		return object instanceof HTMLCanvasElement || object instanceof HTMLImageElement || object instanceof HTMLVideoElement;
	};
	if (!(texture._format === PIXELFORMAT_RGBA8 || texture._format === PIXELFORMAT_RGBA32F) || texture._volume || texture._compressed || texture._levels.length === 1 || texture._levels.length === requiredMipLevels || isHtmlElement(texture._cubemap ? texture._levels[0][0] : texture._levels[0])) {
		return;
	}
	const downsample = function downsample(width, height, data) {
		const sampledWidth = Math.max(1, width >> 1);
		const sampledHeight = Math.max(1, height >> 1);
		const sampledData = new data.constructor(sampledWidth * sampledHeight * 4);
		const xs = Math.floor(width / sampledWidth);
		const ys = Math.floor(height / sampledHeight);
		const xsys = xs * ys;
		for (let y = 0; y < sampledHeight; ++y) {
			for (let x = 0; x < sampledWidth; ++x) {
				for (let e = 0; e < 4; ++e) {
					let sum = 0;
					for (let sy = 0; sy < ys; ++sy) {
						for (let sx = 0; sx < xs; ++sx) {
							sum += data[(x * xs + sx + (y * ys + sy) * width) * 4 + e];
						}
					}
					sampledData[(x + y * sampledWidth) * 4 + e] = sum / xsys;
				}
			}
		}
		return sampledData;
	};
	for (let level = texture._levels.length; level < requiredMipLevels; ++level) {
		const width = Math.max(1, texture._width >> level - 1);
		const height = Math.max(1, texture._height >> level - 1);
		if (texture._cubemap) {
			const mips = [];
			for (let face = 0; face < 6; ++face) {
				mips.push(downsample(width, height, texture._levels[level - 1][face]));
			}
			texture._levels.push(mips);
		} else {
			texture._levels.push(downsample(width, height, texture._levels[level - 1]));
		}
	}
	texture._levelsUpdated = texture._cubemap ? [[true, true, true, true, true, true]] : [true];
};
class TextureHandler {
	constructor(app) {
		this.handlerType = "texture";
		const assets = app.assets;
		const device = app.graphicsDevice;
		this._device = device;
		this._assets = assets;
		this._loader = app.loader;
		this.imgParser = new ImgParser(assets, device);
		this.parsers = {
			dds: new DdsParser(assets),
			ktx: new KtxParser(assets),
			ktx2: new Ktx2Parser(assets, device),
			basis: new BasisParser(assets, device),
			hdr: new HdrParser(assets)
		};
	}
	set crossOrigin(value) {
		this.imgParser.crossOrigin = value;
	}
	get crossOrigin() {
		return this.imgParser.crossOrigin;
	}
	set maxRetries(value) {
		this.imgParser.maxRetries = value;
		for (const parser in this.parsers) {
			if (this.parsers.hasOwnProperty(parser)) {
				this.parsers[parser].maxRetries = value;
			}
		}
	}
	get maxRetries() {
		return this.imgParser.maxRetries;
	}
	_getUrlWithoutParams(url) {
		return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
	}
	_getParser(url) {
		const ext = path.getExtension(this._getUrlWithoutParams(url)).toLowerCase().replace('.', '');
		return this.parsers[ext] || this.imgParser;
	}
	load(url, callback, asset) {
		if (typeof url === 'string') {
			url = {
				load: url,
				original: url
			};
		}
		this._getParser(url.original).load(url, callback, asset);
	}
	open(url, data, asset) {
		if (!url) return undefined;
		let texture = this._getParser(url).open(url, data, this._device);
		if (texture === null) {
			texture = new Texture(this._device, {
				width: 4,
				height: 4,
				format: PIXELFORMAT_RGB8
			});
		} else {
			_completePartialMipmapChain(texture);
			if (data.unswizzledGGGR) {
				asset.file.variants.basis.opt &= ~8;
			}
		}
		return texture;
	}
	patch(asset, assets) {
		const texture = asset.resource;
		if (!texture) {
			return;
		}
		if (asset.name && asset.name.length > 0) {
			texture.name = asset.name;
		}
		const assetData = asset.data;
		if (assetData.hasOwnProperty('minfilter')) {
			texture.minFilter = JSON_FILTER_MODE[assetData.minfilter];
		}
		if (assetData.hasOwnProperty('magfilter')) {
			texture.magFilter = JSON_FILTER_MODE[assetData.magfilter];
		}
		if (!texture.cubemap) {
			if (assetData.hasOwnProperty('addressu')) {
				texture.addressU = JSON_ADDRESS_MODE[assetData.addressu];
			}
			if (assetData.hasOwnProperty('addressv')) {
				texture.addressV = JSON_ADDRESS_MODE[assetData.addressv];
			}
		}
		if (assetData.hasOwnProperty('mipmaps')) {
			texture.mipmaps = assetData.mipmaps;
		}
		if (assetData.hasOwnProperty('anisotropy')) {
			texture.anisotropy = assetData.anisotropy;
		}
		if (assetData.hasOwnProperty('flipY')) {
			texture.flipY = !!assetData.flipY;
		}
		if (assetData.hasOwnProperty('type')) {
			texture.type = JSON_TEXTURE_TYPE[assetData.type];
		} else if (assetData.hasOwnProperty('rgbm') && assetData.rgbm) {
			texture.type = TEXTURETYPE_RGBM;
		} else if (asset.file && (asset.file.opt & 8) !== 0) {
			texture.type = TEXTURETYPE_SWIZZLEGGGR;
		}
	}
}

export { TextureHandler, TextureParser };
