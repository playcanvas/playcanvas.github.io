import { ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, TEXTURETYPE_RGBM, TEXTURETYPE_DEFAULT } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { Asset } from '../asset/asset.js';

class CubemapHandler {
	constructor(app) {
		this.handlerType = "cubemap";
		this._device = app.graphicsDevice;
		this._registry = app.assets;
		this._loader = app.loader;
	}
	load(url, callback, asset) {
		this.loadAssets(asset, callback);
	}
	open(url, data, asset) {
		return asset ? asset.resource : null;
	}
	patch(asset, registry) {
		this.loadAssets(asset, function (err, result) {
			if (err) {
				registry.fire('error', asset);
				registry.fire('error:' + asset.id, err, asset);
				asset.fire('error', asset);
			}
		});
	}
	getAssetIds(cubemapAsset) {
		const result = [];
		result[0] = cubemapAsset.file;
		if ((cubemapAsset.loadFaces || !cubemapAsset.file) && cubemapAsset.data && cubemapAsset.data.textures) {
			for (let i = 0; i < 6; ++i) {
				result[i + 1] = cubemapAsset.data.textures[i];
			}
		} else {
			result[1] = result[2] = result[3] = result[4] = result[5] = result[6] = null;
		}
		return result;
	}
	compareAssetIds(assetIdA, assetIdB) {
		if (assetIdA && assetIdB) {
			if (parseInt(assetIdA, 10) === assetIdA || typeof assetIdA === 'string') {
				return assetIdA === assetIdB;
			}
			return assetIdA.url === assetIdB.url;
		}
		return assetIdA !== null === (assetIdB !== null);
	}
	update(cubemapAsset, assetIds, assets) {
		const assetData = cubemapAsset.data || {};
		const oldAssets = cubemapAsset._handlerState.assets;
		const oldResources = cubemapAsset._resources;
		let tex, mip, i;
		const resources = [null, null, null, null, null, null, null];
		const getType = function getType() {
			if (assetData.hasOwnProperty('type')) {
				return assetData.type;
			}
			if (assetData.hasOwnProperty('rgbm')) {
				return assetData.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
			}
			return null;
		};
		if (!cubemapAsset.loaded || assets[0] !== oldAssets[0]) {
			if (assets[0]) {
				tex = assets[0].resource;
				for (i = 0; i < 6; ++i) {
					resources[i + 1] = new Texture(this._device, {
						name: cubemapAsset.name + '_prelitCubemap' + (tex.width >> i),
						cubemap: true,
						type: getType() || tex.type,
						width: tex.width >> i,
						height: tex.height >> i,
						format: tex.format,
						levels: [tex._levels[i]],
						fixCubemapSeams: true,
						addressU: ADDRESS_CLAMP_TO_EDGE,
						addressV: ADDRESS_CLAMP_TO_EDGE,
						mipmaps: i === 0
					});
				}
			}
		} else {
			resources[1] = oldResources[1] || null;
			resources[2] = oldResources[2] || null;
			resources[3] = oldResources[3] || null;
			resources[4] = oldResources[4] || null;
			resources[5] = oldResources[5] || null;
			resources[6] = oldResources[6] || null;
		}
		const faceAssets = assets.slice(1);
		if (!cubemapAsset.loaded || !this.cmpArrays(faceAssets, oldAssets.slice(1))) {
			if (faceAssets.indexOf(null) === -1) {
				var _assetData$mipmaps;
				const faceTextures = faceAssets.map(function (asset) {
					return asset.resource;
				});
				const faceLevels = [];
				for (mip = 0; mip < faceTextures[0]._levels.length; ++mip) {
					faceLevels.push(faceTextures.map(function (faceTexture) {
						return faceTexture._levels[mip];
					}));
				}
				const format = faceTextures[0].format;
				const faces = new Texture(this._device, {
					name: cubemapAsset.name + '_faces',
					cubemap: true,
					type: getType() || faceTextures[0].type,
					width: faceTextures[0].width,
					height: faceTextures[0].height,
					format: format === PIXELFORMAT_RGB8 ? PIXELFORMAT_RGBA8 : format,
					mipmaps: (_assetData$mipmaps = assetData.mipmaps) != null ? _assetData$mipmaps : true,
					levels: faceLevels,
					minFilter: assetData.hasOwnProperty('minFilter') ? assetData.minFilter : faceTextures[0].minFilter,
					magFilter: assetData.hasOwnProperty('magFilter') ? assetData.magFilter : faceTextures[0].magFilter,
					anisotropy: assetData.hasOwnProperty('anisotropy') ? assetData.anisotropy : 1,
					addressU: ADDRESS_CLAMP_TO_EDGE,
					addressV: ADDRESS_CLAMP_TO_EDGE,
					fixCubemapSeams: !!assets[0]
				});
				resources[0] = faces;
			}
		} else {
			resources[0] = oldResources[0] || null;
		}
		if (!this.cmpArrays(resources, oldResources)) {
			cubemapAsset.resources = resources;
			cubemapAsset._handlerState.assetIds = assetIds;
			cubemapAsset._handlerState.assets = assets;
			for (i = 0; i < oldResources.length; ++i) {
				if (oldResources[i] !== null && resources.indexOf(oldResources[i]) === -1) {
					oldResources[i].destroy();
				}
			}
		}
		for (i = 0; i < oldAssets.length; ++i) {
			if (oldAssets[i] !== null && assets.indexOf(oldAssets[i]) === -1) {
				oldAssets[i].unload();
			}
		}
	}
	cmpArrays(arr1, arr2) {
		if (arr1.length !== arr2.length) {
			return false;
		}
		for (let i = 0; i < arr1.length; ++i) {
			if (arr1[i] !== arr2[i]) {
				return false;
			}
		}
		return true;
	}
	resolveId(value) {
		const valueInt = parseInt(value, 10);
		return valueInt === value || valueInt.toString() === value ? valueInt : value;
	}
	loadAssets(cubemapAsset, callback) {
		if (!cubemapAsset.hasOwnProperty('_handlerState')) {
			cubemapAsset._handlerState = {
				assetIds: [null, null, null, null, null, null, null],
				assets: [null, null, null, null, null, null, null]
			};
		}
		const self = this;
		const assetIds = self.getAssetIds(cubemapAsset);
		const assets = [null, null, null, null, null, null, null];
		const loadedAssetIds = cubemapAsset._handlerState.assetIds;
		const loadedAssets = cubemapAsset._handlerState.assets;
		const registry = self._registry;
		let awaiting = 7;
		const onLoad = function onLoad(index, asset) {
			assets[index] = asset;
			awaiting--;
			if (awaiting === 0) {
				self.update(cubemapAsset, assetIds, assets);
				callback(null, cubemapAsset.resources);
			}
		};
		const onError = function onError(index, err, asset) {
			callback(err);
		};
		const processTexAsset = function processTexAsset(index, texAsset) {
			if (texAsset.loaded) {
				onLoad(index, texAsset);
			} else {
				registry.once('load:' + texAsset.id, onLoad.bind(self, index));
				registry.once('error:' + texAsset.id, onError.bind(self, index));
				if (!texAsset.loading) {
					registry.load(texAsset);
				}
			}
		};
		let texAsset;
		for (let i = 0; i < 7; ++i) {
			const assetId = this.resolveId(assetIds[i]);
			if (!assetId) {
				onLoad(i, null);
			} else if (self.compareAssetIds(assetId, loadedAssetIds[i])) {
				onLoad(i, loadedAssets[i]);
			} else if (parseInt(assetId, 10) === assetId) {
				texAsset = registry.get(assetId);
				if (texAsset) {
					processTexAsset(i, texAsset);
				} else {
					setTimeout(function (index, assetId_) {
						const texAsset = registry.get(assetId_);
						if (texAsset) {
							processTexAsset(index, texAsset);
						} else {
							onError(index, 'failed to find dependent cubemap asset=' + assetId_);
						}
					}.bind(null, i, assetId));
				}
			} else {
				const file = typeof assetId === 'string' ? {
					url: assetId,
					filename: assetId
				} : assetId;
				texAsset = new Asset(cubemapAsset.name + '_part_' + i, 'texture', file);
				registry.add(texAsset);
				registry.once('load:' + texAsset.id, onLoad.bind(self, i));
				registry.once('error:' + texAsset.id, onError.bind(self, i));
				registry.load(texAsset);
			}
		}
	}
}

export { CubemapHandler };
