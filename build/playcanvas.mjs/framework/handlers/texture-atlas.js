import { path } from '../../core/path.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec4 } from '../../core/math/vec4.js';
import { TEXTURETYPE_RGBM, TEXTURETYPE_DEFAULT, ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR } from '../../platform/graphics/constants.js';
import { http } from '../../platform/net/http.js';
import { TextureAtlas } from '../../scene/texture-atlas.js';

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
const regexFrame = /^data\.frames\.(\d+)$/;
class TextureAtlasHandler {
	constructor(app) {
		this.handlerType = "textureatlas";
		this._loader = app.loader;
		this.maxRetries = 0;
	}
	load(url, callback) {
		if (typeof url === 'string') {
			url = {
				load: url,
				original: url
			};
		}
		const self = this;
		const handler = this._loader.getHandler('texture');
		if (path.getExtension(url.original) === '.json') {
			http.get(url.load, {
				retry: this.maxRetries > 0,
				maxRetries: this.maxRetries
			}, function (err, response) {
				if (!err) {
					const textureUrl = url.original.replace('.json', '.png');
					self._loader.load(textureUrl, 'texture', function (err, texture) {
						if (err) {
							callback(err);
						} else {
							callback(null, {
								data: response,
								texture: texture
							});
						}
					});
				} else {
					callback(err);
				}
			});
		} else {
			return handler.load(url, callback);
		}
	}
	open(url, data) {
		const resource = new TextureAtlas();
		if (data.texture && data.data) {
			resource.texture = data.texture;
			resource.__data = data.data;
		} else {
			const handler = this._loader.getHandler('texture');
			const texture = handler.open(url, data);
			if (!texture) return null;
			resource.texture = texture;
		}
		return resource;
	}
	patch(asset, assets) {
		if (!asset.resource) {
			return;
		}
		if (asset.resource.__data) {
			if (asset.resource.__data.minfilter !== undefined) asset.data.minfilter = asset.resource.__data.minfilter;
			if (asset.resource.__data.magfilter !== undefined) asset.data.magfilter = asset.resource.__data.magfilter;
			if (asset.resource.__data.addressu !== undefined) asset.data.addressu = asset.resource.__data.addressu;
			if (asset.resource.__data.addressv !== undefined) asset.data.addressv = asset.resource.__data.addressv;
			if (asset.resource.__data.mipmaps !== undefined) asset.data.mipmaps = asset.resource.__data.mipmaps;
			if (asset.resource.__data.anisotropy !== undefined) asset.data.anisotropy = asset.resource.__data.anisotropy;
			if (asset.resource.__data.rgbm !== undefined) asset.data.rgbm = !!asset.resource.__data.rgbm;
			asset.data.frames = asset.resource.__data.frames;
			delete asset.resource.__data;
		}
		const texture = asset.resource.texture;
		if (texture) {
			texture.name = asset.name;
			if (asset.data.hasOwnProperty('minfilter') && texture.minFilter !== JSON_FILTER_MODE[asset.data.minfilter]) texture.minFilter = JSON_FILTER_MODE[asset.data.minfilter];
			if (asset.data.hasOwnProperty('magfilter') && texture.magFilter !== JSON_FILTER_MODE[asset.data.magfilter]) texture.magFilter = JSON_FILTER_MODE[asset.data.magfilter];
			if (asset.data.hasOwnProperty('addressu') && texture.addressU !== JSON_ADDRESS_MODE[asset.data.addressu]) texture.addressU = JSON_ADDRESS_MODE[asset.data.addressu];
			if (asset.data.hasOwnProperty('addressv') && texture.addressV !== JSON_ADDRESS_MODE[asset.data.addressv]) texture.addressV = JSON_ADDRESS_MODE[asset.data.addressv];
			if (asset.data.hasOwnProperty('mipmaps') && texture.mipmaps !== asset.data.mipmaps) texture.mipmaps = asset.data.mipmaps;
			if (asset.data.hasOwnProperty('anisotropy') && texture.anisotropy !== asset.data.anisotropy) texture.anisotropy = asset.data.anisotropy;
			if (asset.data.hasOwnProperty('rgbm')) {
				const type = asset.data.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
				if (texture.type !== type) {
					texture.type = type;
				}
			}
		}
		asset.resource.texture = texture;
		const frames = {};
		for (const key in asset.data.frames) {
			const frame = asset.data.frames[key];
			frames[key] = {
				rect: new Vec4(frame.rect),
				pivot: new Vec2(frame.pivot),
				border: new Vec4(frame.border)
			};
		}
		asset.resource.frames = frames;
		asset.off('change', this._onAssetChange, this);
		asset.on('change', this._onAssetChange, this);
	}
	_onAssetChange(asset, attribute, value) {
		let frame;
		if (attribute === 'data' || attribute === 'data.frames') {
			const frames = {};
			for (const key in value.frames) {
				frame = value.frames[key];
				frames[key] = {
					rect: new Vec4(frame.rect),
					pivot: new Vec2(frame.pivot),
					border: new Vec4(frame.border)
				};
			}
			asset.resource.frames = frames;
		} else {
			const match = attribute.match(regexFrame);
			if (match) {
				const frameKey = match[1];
				if (value) {
					if (!asset.resource.frames[frameKey]) {
						asset.resource.frames[frameKey] = {
							rect: new Vec4(value.rect),
							pivot: new Vec2(value.pivot),
							border: new Vec4(value.border)
						};
					} else {
						frame = asset.resource.frames[frameKey];
						frame.rect.set(value.rect[0], value.rect[1], value.rect[2], value.rect[3]);
						frame.pivot.set(value.pivot[0], value.pivot[1]);
						frame.border.set(value.border[0], value.border[1], value.border[2], value.border[3]);
					}
					asset.resource.fire('set:frame', frameKey, asset.resource.frames[frameKey]);
				} else {
					if (asset.resource.frames[frameKey]) {
						delete asset.resource.frames[frameKey];
						asset.resource.fire('remove:frame', frameKey);
					}
				}
			}
		}
	}
}

export { TextureAtlasHandler };
