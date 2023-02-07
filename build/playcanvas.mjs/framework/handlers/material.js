import { http } from '../../platform/net/http.js';
import { PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { SPECULAR_PHONG } from '../../scene/constants.js';
import { standardMaterialTextureParameters, standardMaterialCubemapParameters } from '../../scene/materials/standard-material-parameters.js';
import { AssetReference } from '../asset/asset-reference.js';
import { JsonStandardMaterialParser } from '../parsers/material/json-standard-material.js';

const PLACEHOLDER_MAP = {
	aoMap: 'white',
	diffuseMap: 'gray',
	specularMap: 'gray',
	specularityFactorMap: 'white',
	metalnessMap: 'black',
	glossMap: 'gray',
	sheenMap: 'black',
	sheenGlossinessMap: 'gray',
	clearCoatMap: 'black',
	clearCoatGlossMap: 'gray',
	clearCoatNormalMap: 'normal',
	refractionMap: 'white',
	emissiveMap: 'gray',
	normalMap: 'normal',
	heightMap: 'gray',
	opacityMap: 'gray',
	sphereMap: 'gray',
	lightMap: 'white'
};
class MaterialHandler {
	constructor(app) {
		this.handlerType = "material";
		this._assets = app.assets;
		this._device = app.graphicsDevice;
		this._placeholderTextures = null;
		this._parser = new JsonStandardMaterialParser();
		this.maxRetries = 0;
	}
	load(url, callback) {
		if (typeof url === 'string') {
			url = {
				load: url,
				original: url
			};
		}
		http.get(url.load, {
			retry: this.maxRetries > 0,
			maxRetries: this.maxRetries
		}, function (err, response) {
			if (!err) {
				if (callback) {
					response._engine = true;
					callback(null, response);
				}
			} else {
				if (callback) {
					callback(`Error loading material: ${url.original} [${err}]`);
				}
			}
		});
	}
	open(url, data) {
		const material = this._parser.parse(data);
		if (data._engine) {
			material._data = data;
			delete data._engine;
		}
		return material;
	}
	_createPlaceholders() {
		this._placeholderTextures = {};
		const textures = {
			white: [255, 255, 255, 255],
			gray: [128, 128, 128, 255],
			black: [0, 0, 0, 255],
			normal: [128, 128, 255, 255]
		};
		for (const key in textures) {
			if (!textures.hasOwnProperty(key)) continue;
			this._placeholderTextures[key] = new Texture(this._device, {
				width: 2,
				height: 2,
				format: PIXELFORMAT_RGBA8,
				name: 'material_placeholder'
			});
			const pixels = this._placeholderTextures[key].lock();
			for (let i = 0; i < 4; i++) {
				for (let c = 0; c < 4; c++) {
					pixels[i * 4 + c] = textures[key][c];
				}
			}
			this._placeholderTextures[key].unlock();
		}
	}
	patch(asset, assets) {
		if (asset.resource._data) {
			asset._data = asset.resource._data;
			delete asset.resource._data;
		}
		asset.data.name = asset.name;
		asset.resource.name = asset.name;
		this._bindAndAssignAssets(asset, assets);
		asset.off('unload', this._onAssetUnload, this);
		asset.on('unload', this._onAssetUnload, this);
	}
	_onAssetUnload(asset) {
		delete asset.data.parameters;
		delete asset.data.chunks;
		delete asset.data.name;
	}
	_assignTexture(parameterName, materialAsset, texture) {
		materialAsset.resource[parameterName] = texture;
	}
	_getPlaceholderTexture(parameterName) {
		if (!this._placeholderTextures) {
			this._createPlaceholders();
		}
		const placeholder = PLACEHOLDER_MAP[parameterName];
		const texture = this._placeholderTextures[placeholder];
		return texture;
	}
	_assignPlaceholderTexture(parameterName, materialAsset) {
		materialAsset.resource[parameterName] = this._getPlaceholderTexture(parameterName);
	}
	_onTextureLoad(parameterName, materialAsset, textureAsset) {
		this._assignTexture(parameterName, materialAsset, textureAsset.resource);
		materialAsset.resource.update();
	}
	_onTextureAdd(parameterName, materialAsset, textureAsset) {
		this._assets.load(textureAsset);
	}
	_onTextureRemoveOrUnload(parameterName, materialAsset, textureAsset) {
		const material = materialAsset.resource;
		if (material) {
			if (materialAsset.resource[parameterName] === textureAsset.resource) {
				this._assignPlaceholderTexture(parameterName, materialAsset);
				material.update();
			}
		}
	}
	_assignCubemap(parameterName, materialAsset, textures) {
		materialAsset.resource[parameterName] = textures[0];
		if (parameterName === 'cubeMap') {
			materialAsset.resource.prefilteredCubemaps = textures.slice(1);
		}
	}
	_onCubemapLoad(parameterName, materialAsset, cubemapAsset) {
		this._assignCubemap(parameterName, materialAsset, cubemapAsset.resources);
		this._parser.initialize(materialAsset.resource, materialAsset.data);
	}
	_onCubemapAdd(parameterName, materialAsset, cubemapAsset) {
		if (materialAsset.data.shadingModel === SPECULAR_PHONG) {
			materialAsset.loadFaces = true;
		}
		this._assets.load(cubemapAsset);
	}
	_onCubemapRemoveOrUnload(parameterName, materialAsset, cubemapAsset) {
		const material = materialAsset.resource;
		if (materialAsset.data.prefilteredCubeMap128 === cubemapAsset.resources[1]) {
			this._assignCubemap(parameterName, materialAsset, [null, null, null, null, null, null, null]);
			material.update();
		}
	}
	_bindAndAssignAssets(materialAsset, assets) {
		const data = this._parser.migrate(materialAsset.data);
		const material = materialAsset.resource;
		const pathMapping = data.mappingFormat === 'path';
		const TEXTURES = standardMaterialTextureParameters;
		let i, name, assetReference;
		for (i = 0; i < TEXTURES.length; i++) {
			name = TEXTURES[i];
			assetReference = material._assetReferences[name];
			const dataAssetId = data[name];
			const materialTexture = material[name];
			const isPlaceHolderTexture = materialTexture === this._getPlaceholderTexture(name);
			const dataValidated = data.validated;
			if (dataAssetId && (!materialTexture || !dataValidated || isPlaceHolderTexture)) {
				if (!assetReference) {
					assetReference = new AssetReference(name, materialAsset, assets, {
						load: this._onTextureLoad,
						add: this._onTextureAdd,
						remove: this._onTextureRemoveOrUnload,
						unload: this._onTextureRemoveOrUnload
					}, this);
					material._assetReferences[name] = assetReference;
				}
				if (pathMapping) {
					assetReference.url = materialAsset.getAbsoluteUrl(dataAssetId);
				} else {
					assetReference.id = dataAssetId;
				}
				if (assetReference.asset) {
					if (assetReference.asset.resource) {
						this._assignTexture(name, materialAsset, assetReference.asset.resource);
					} else {
						this._assignPlaceholderTexture(name, materialAsset);
					}
					assets.load(assetReference.asset);
				}
			} else {
				if (assetReference) {
					if (pathMapping) {
						assetReference.url = null;
					} else {
						assetReference.id = null;
					}
				}
			}
		}
		const CUBEMAPS = standardMaterialCubemapParameters;
		for (i = 0; i < CUBEMAPS.length; i++) {
			name = CUBEMAPS[i];
			assetReference = material._assetReferences[name];
			if (data[name] && !materialAsset.data.prefilteredCubeMap128) {
				if (!assetReference) {
					assetReference = new AssetReference(name, materialAsset, assets, {
						load: this._onCubemapLoad,
						add: this._onCubemapAdd,
						remove: this._onCubemapRemoveOrUnload,
						unload: this._onCubemapRemoveOrUnload
					}, this);
					material._assetReferences[name] = assetReference;
				}
				if (pathMapping) {
					assetReference.url = data[name];
				} else {
					assetReference.id = data[name];
				}
				if (assetReference.asset) {
					if (assetReference.asset.loaded) {
						this._assignCubemap(name, materialAsset, assetReference.asset.resources);
					}
					assets.load(assetReference.asset);
				}
			}
		}
		this._parser.initialize(material, data);
	}
}

export { MaterialHandler };
