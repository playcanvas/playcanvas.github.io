/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Quat } from '../../core/math/quat.js';
import { PIXELFORMAT_DXT5, TEXTURETYPE_SWIZZLEGGGR, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { SHADER_FORWARDHDR, GAMMA_SRGBHDR, TONEMAP_LINEAR, SHADERDEF_TANGENTS, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN, SHADERDEF_INSTANCING, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED, BLEND_NONE, SPECULAR_PHONG, GAMMA_NONE, SHADERDEF_NOSHADOW, SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT, MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR } from '../constants.js';
import { _matTex2D } from '../shader-lib/programs/standard.js';

const arraysEqual = (a, b) => {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; ++i) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
};
const notWhite = color => {
	return color.r !== 1 || color.g !== 1 || color.b !== 1;
};
const notBlack = color => {
	return color.r !== 0 || color.g !== 0 || color.b !== 0;
};
class StandardMaterialOptionsBuilder {
	constructor() {
		this._mapXForms = null;
	}
	updateMinRef(options, scene, stdMat, objDefs, staticLightList, pass, sortedLights) {
		this._updateSharedOptions(options, scene, stdMat, objDefs, pass);
		this._updateMinOptions(options, stdMat);
		this._updateUVOptions(options, stdMat, objDefs, true);
		options.litOptions.chunks = options.chunks;
	}
	updateRef(options, scene, stdMat, objDefs, staticLightList, pass, sortedLights) {
		this._updateSharedOptions(options, scene, stdMat, objDefs, pass);
		this._updateEnvOptions(options, stdMat, scene);
		this._updateMaterialOptions(options, stdMat);
		if (pass === SHADER_FORWARDHDR) {
			if (options.litOptions.gamma) options.litOptions.gamma = GAMMA_SRGBHDR;
			options.litOptions.toneMap = TONEMAP_LINEAR;
		}
		options.litOptions.hasTangents = objDefs && (objDefs & SHADERDEF_TANGENTS) !== 0;
		this._updateLightOptions(options, scene, stdMat, objDefs, sortedLights, staticLightList);
		this._updateUVOptions(options, stdMat, objDefs, false);
		options.litOptions.chunks = options.chunks;
	}
	_updateSharedOptions(options, scene, stdMat, objDefs, pass) {
		options.forceUv1 = stdMat.forceUv1;
		options.chunks = stdMat.chunks || '';
		options.pass = pass;
		options.litOptions.alphaTest = stdMat.alphaTest > 0;
		options.litOptions.forceFragmentPrecision = stdMat.forceFragmentPrecision || '';
		options.litOptions.blendType = stdMat.blendType;
		options.litOptions.separateAmbient = false;
		options.litOptions.screenSpace = objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0;
		options.litOptions.skin = objDefs && (objDefs & SHADERDEF_SKIN) !== 0;
		options.litOptions.useInstancing = objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0;
		options.litOptions.useMorphPosition = objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0;
		options.litOptions.useMorphNormal = objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0;
		options.litOptions.useMorphTextureBased = objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0;
		options.litOptions.nineSlicedMode = stdMat.nineSlicedMode || 0;
		if (scene.clusteredLightingEnabled && stdMat.useLighting) {
			options.litOptions.clusteredLightingEnabled = true;
			options.litOptions.clusteredLightingCookiesEnabled = scene.lighting.cookiesEnabled;
			options.litOptions.clusteredLightingShadowsEnabled = scene.lighting.shadowsEnabled;
			options.litOptions.clusteredLightingShadowType = scene.lighting.shadowType;
			options.litOptions.clusteredLightingAreaLightsEnabled = scene.lighting.areaLightsEnabled;
		} else {
			options.litOptions.clusteredLightingEnabled = false;
			options.litOptions.clusteredLightingCookiesEnabled = false;
			options.litOptions.clusteredLightingShadowsEnabled = false;
			options.litOptions.clusteredLightingAreaLightsEnabled = false;
		}
	}
	_updateUVOptions(options, stdMat, objDefs, minimalOptions) {
		let hasUv0 = false;
		let hasUv1 = false;
		let hasVcolor = false;
		if (objDefs) {
			hasUv0 = (objDefs & SHADERDEF_UV0) !== 0;
			hasUv1 = (objDefs & SHADERDEF_UV1) !== 0;
			hasVcolor = (objDefs & SHADERDEF_VCOLOR) !== 0;
		}
		options.litOptions.vertexColors = false;
		this._mapXForms = [];
		const uniqueTextureMap = {};
		for (const p in _matTex2D) {
			this._updateTexOptions(options, stdMat, p, hasUv0, hasUv1, hasVcolor, minimalOptions, uniqueTextureMap);
		}
		this._mapXForms = null;
		options.litOptions.lightMapEnabled = options.lightMap;
		options.litOptions.useLightMapVertexColors = options.lightVertexColor;
		options.litOptions.dirLightMapEnabled = options.dirLightMap;
		options.litOptions.heightMapEnabled = options.heightMap;
		options.litOptions.normalMapEnabled = options.normalMap;
		options.litOptions.clearCoatNormalMapEnabled = options.clearCoatNormalMap;
		options.litOptions.aoMapEnabled = options.aoMap;
		options.litOptions.useAoVertexColors = options.aoVertexColor;
		options.litOptions.diffuseMapEnabled = options.diffuseMap;
	}
	_updateTexOptions(options, stdMat, p, hasUv0, hasUv1, hasVcolor, minimalOptions, uniqueTextureMap) {
		const mname = p + 'Map';
		const vname = p + 'VertexColor';
		const vcname = p + 'VertexColorChannel';
		const cname = mname + 'Channel';
		const tname = mname + 'Transform';
		const uname = mname + 'Uv';
		const iname = mname + 'Identifier';
		if (p !== 'light') {
			options[mname] = false;
			options[iname] = undefined;
			options[cname] = '';
			options[tname] = 0;
			options[uname] = 0;
		}
		options[vname] = false;
		options[vcname] = '';
		const isOpacity = p === 'opacity';
		if (isOpacity && stdMat.blendType === BLEND_NONE && stdMat.alphaTest === 0.0 && !stdMat.alphaToCoverage) {
			return;
		}
		if (!minimalOptions || isOpacity) {
			if (p !== 'height' && stdMat[vname]) {
				if (hasVcolor) {
					options[vname] = stdMat[vname];
					options[vcname] = stdMat[vcname];
					options.litOptions.vertexColors = true;
				}
			}
			if (stdMat[mname]) {
				let allow = true;
				if (stdMat[uname] === 0 && !hasUv0) allow = false;
				if (stdMat[uname] === 1 && !hasUv1) allow = false;
				if (allow) {
					const mapId = stdMat[mname].id;
					let identifier = uniqueTextureMap[mapId];
					if (identifier === undefined) {
						uniqueTextureMap[mapId] = p;
						identifier = p;
					}
					options[mname] = !!stdMat[mname];
					options[iname] = identifier;
					options[tname] = this._getMapTransformID(stdMat.getUniform(tname), stdMat[uname]);
					options[cname] = stdMat[cname];
					options[uname] = stdMat[uname];
				}
			}
		}
	}
	_updateMinOptions(options, stdMat) {
		options.opacityTint = stdMat.opacity !== 1 && stdMat.blendType !== BLEND_NONE;
		options.litOptions.lights = [];
	}
	_updateMaterialOptions(options, stdMat) {
		var _stdMat$diffuseMap, _stdMat$diffuseDetail, _stdMat$emissiveMap, _stdMat$lightMap;
		const diffuseTint = (stdMat.diffuseTint || !stdMat.diffuseMap && !stdMat.diffuseVertexColor) && notWhite(stdMat.diffuse);
		const useSpecular = !!(stdMat.useMetalness || stdMat.specularMap || stdMat.sphereMap || stdMat.cubeMap || notBlack(stdMat.specular) || stdMat.specularityFactor > 0 && stdMat.useMetalness || stdMat.enableGGXSpecular || stdMat.clearCoat > 0);
		const useSpecularColor = !stdMat.useMetalness || stdMat.useMetalnessSpecularColor;
		const specularTint = useSpecular && (stdMat.specularTint || !stdMat.specularMap && !stdMat.specularVertexColor) && notWhite(stdMat.specular);
		const specularityFactorTint = useSpecular && stdMat.useMetalnessSpecularColor && (stdMat.specularityFactorTint || stdMat.specularityFactor < 1 && !stdMat.specularityFactorMap);
		const emissiveTintColor = !stdMat.emissiveMap || notWhite(stdMat.emissive) && stdMat.emissiveTint;
		const emissiveTintIntensity = stdMat.emissiveIntensity !== 1;
		const isPackedNormalMap = stdMat.normalMap ? stdMat.normalMap.format === PIXELFORMAT_DXT5 || stdMat.normalMap.type === TEXTURETYPE_SWIZZLEGGGR : false;
		options.opacityTint = stdMat.opacity !== 1 && stdMat.blendType !== BLEND_NONE ? 1 : 0;
		options.ambientTint = stdMat.ambientTint;
		options.diffuseTint = diffuseTint ? 2 : 0;
		options.specularTint = specularTint ? 2 : 0;
		options.specularityFactorTint = specularityFactorTint ? 1 : 0;
		options.metalnessTint = stdMat.useMetalness && stdMat.metalness < 1 ? 1 : 0;
		options.glossTint = 1;
		options.emissiveTint = (emissiveTintColor ? 2 : 0) + (emissiveTintIntensity ? 1 : 0);
		options.diffuseEncoding = (_stdMat$diffuseMap = stdMat.diffuseMap) == null ? void 0 : _stdMat$diffuseMap.encoding;
		options.diffuseDetailEncoding = (_stdMat$diffuseDetail = stdMat.diffuseDetailMap) == null ? void 0 : _stdMat$diffuseDetail.encoding;
		options.emissiveEncoding = (_stdMat$emissiveMap = stdMat.emissiveMap) == null ? void 0 : _stdMat$emissiveMap.encoding;
		options.lightMapEncoding = (_stdMat$lightMap = stdMat.lightMap) == null ? void 0 : _stdMat$lightMap.encoding;
		options.packedNormal = isPackedNormalMap;
		options.refractionTint = stdMat.refraction !== 1.0 ? 1 : 0;
		options.refractionIndexTint = stdMat.refractionIndex !== 1.0 / 1.5 ? 1 : 0;
		options.thicknessTint = stdMat.useDynamicRefraction && stdMat.thickness !== 1.0 ? 1 : 0;
		options.specularEncoding = stdMat.specularEncoding || 'linear';
		options.sheenEncoding = stdMat.sheenEncoding || 'linear';
		options.aoMapUv = stdMat.aoUvSet;
		options.diffuseDetail = !!stdMat.diffuseMap;
		options.normalDetail = !!stdMat.normalMap;
		options.diffuseDetailMode = stdMat.diffuseDetailMode;
		options.clearCoatTint = stdMat.clearCoat !== 1.0 ? 1 : 0;
		options.clearCoatGloss = !!stdMat.clearCoatGloss;
		options.clearCoatGlossTint = stdMat.clearCoatGloss !== 1.0 ? 1 : 0;
		options.iridescenceTint = stdMat.iridescence !== 1.0 ? 1 : 0;
		options.sheenTint = stdMat.useSheen && notWhite(stdMat.sheen) ? 2 : 0;
		options.sheenGlossTint = 1;
		options.glossInvert = stdMat.glossInvert;
		options.sheenGlossInvert = stdMat.sheenGlossInvert;
		options.clearCoatGlossInvert = stdMat.clearCoatGlossInvert;
		options.litOptions.useAmbientTint = options.ambientTint;
		options.litOptions.customFragmentShader = stdMat.customFragmentShader;
		options.litOptions.pixelSnap = stdMat.pixelSnap;
		options.litOptions.useClearCoatNormalMap = !!stdMat.clearCoatNormalMap;
		options.litOptions.useDiffuseMap = !!stdMat.diffuseMap;
		options.litOptions.useAoMap = !!stdMat.aoMap;
		options.litOptions.detailModes = !!options.diffuseDetail;
		options.litOptions.shadingModel = stdMat.shadingModel;
		options.litOptions.ambientSH = !!stdMat.ambientSH;
		options.litOptions.fastTbn = stdMat.fastTbn;
		options.litOptions.twoSidedLighting = stdMat.twoSidedLighting;
		options.litOptions.occludeSpecular = stdMat.occludeSpecular;
		options.litOptions.occludeSpecularFloat = stdMat.occludeSpecularIntensity !== 1.0;
		options.litOptions.useMsdf = !!stdMat.msdfMap;
		options.litOptions.msdfTextAttribute = !!stdMat.msdfTextAttribute;
		options.litOptions.alphaToCoverage = stdMat.alphaToCoverage;
		options.litOptions.opacityFadesSpecular = stdMat.opacityFadesSpecular;
		options.litOptions.cubeMapProjection = stdMat.cubeMapProjection;
		options.litOptions.occludeDirect = stdMat.occludeDirect;
		options.litOptions.conserveEnergy = stdMat.conserveEnergy && stdMat.shadingModel !== SPECULAR_PHONG;
		options.litOptions.useSpecular = useSpecular;
		options.litOptions.useSpecularityFactor = (specularityFactorTint || !!stdMat.specularityFactorMap) && stdMat.useMetalnessSpecularColor;
		options.litOptions.useSpecularColor = useSpecularColor;
		options.litOptions.enableGGXSpecular = stdMat.enableGGXSpecular;
		options.litOptions.fresnelModel = stdMat.fresnelModel;
		options.litOptions.useRefraction = (stdMat.refraction || !!stdMat.refractionMap) && (stdMat.useDynamicRefraction || !!options.litOptions.reflectionSource);
		options.litOptions.useClearCoat = !!stdMat.clearCoat;
		options.litOptions.useSheen = stdMat.useSheen;
		options.litOptions.useIridescence = stdMat.useIridescence && stdMat.iridescence !== 0.0;
		options.litOptions.useMetalness = stdMat.useMetalness;
		options.litOptions.useDynamicRefraction = stdMat.useDynamicRefraction;
	}
	_updateEnvOptions(options, stdMat, scene) {
		options.litOptions.fog = stdMat.useFog ? scene.fog : 'none';
		options.litOptions.gamma = stdMat.useGammaTonemap ? scene.gammaCorrection : GAMMA_NONE;
		options.litOptions.toneMap = stdMat.useGammaTonemap ? scene.toneMapping : -1;
		options.litOptions.fixSeams = stdMat.cubeMap ? stdMat.cubeMap.fixCubemapSeams : false;
		const isPhong = stdMat.shadingModel === SPECULAR_PHONG;
		let usingSceneEnv = false;
		if (stdMat.envAtlas && stdMat.cubeMap && !isPhong) {
			options.litOptions.reflectionSource = 'envAtlasHQ';
			options.litOptions.reflectionEncoding = stdMat.envAtlas.encoding;
		} else if (stdMat.envAtlas && !isPhong) {
			options.litOptions.reflectionSource = 'envAtlas';
			options.litOptions.reflectionEncoding = stdMat.envAtlas.encoding;
		} else if (stdMat.cubeMap) {
			options.litOptions.reflectionSource = 'cubeMap';
			options.litOptions.reflectionEncoding = stdMat.cubeMap.encoding;
		} else if (stdMat.sphereMap) {
			options.litOptions.reflectionSource = 'sphereMap';
			options.litOptions.reflectionEncoding = stdMat.sphereMap.encoding;
		} else if (stdMat.useSkybox && scene.envAtlas && scene.skybox && !isPhong) {
			options.litOptions.reflectionSource = 'envAtlasHQ';
			options.litOptions.reflectionEncoding = scene.envAtlas.encoding;
			usingSceneEnv = true;
		} else if (stdMat.useSkybox && scene.envAtlas && !isPhong) {
			options.litOptions.reflectionSource = 'envAtlas';
			options.litOptions.reflectionEncoding = scene.envAtlas.encoding;
			usingSceneEnv = true;
		} else if (stdMat.useSkybox && scene.skybox) {
			options.litOptions.reflectionSource = 'cubeMap';
			options.litOptions.reflectionEncoding = scene.skybox.encoding;
			usingSceneEnv = true;
		} else {
			options.litOptions.reflectionSource = null;
			options.litOptions.reflectionEncoding = null;
		}
		if (stdMat.ambientSH && !isPhong) {
			options.litOptions.ambientSource = 'ambientSH';
			options.litOptions.ambientEncoding = null;
		} else {
			const envAtlas = stdMat.envAtlas || (stdMat.useSkybox && scene.envAtlas ? scene.envAtlas : null);
			if (envAtlas && !isPhong) {
				options.litOptions.ambientSource = 'envAtlas';
				options.litOptions.ambientEncoding = envAtlas.encoding;
			} else {
				options.litOptions.ambientSource = 'constant';
				options.litOptions.ambientEncoding = null;
			}
		}
		options.litOptions.skyboxIntensity = usingSceneEnv && (scene.skyboxIntensity !== 1 || scene.physicalUnits);
		options.litOptions.useCubeMapRotation = usingSceneEnv && scene.skyboxRotation && !scene.skyboxRotation.equals(Quat.IDENTITY);
	}
	_updateLightOptions(options, scene, stdMat, objDefs, sortedLights, staticLightList) {
		options.lightMap = false;
		options.lightMapChannel = '';
		options.lightMapUv = 0;
		options.lightMapTransform = 0;
		options.litOptions.lightMapWithoutAmbient = false;
		options.dirLightMap = false;
		if (objDefs) {
			options.litOptions.noShadow = (objDefs & SHADERDEF_NOSHADOW) !== 0;
			if ((objDefs & SHADERDEF_LM) !== 0) {
				options.lightMapEncoding = scene.lightmapPixelFormat === PIXELFORMAT_RGBA8 ? 'rgbm' : 'linear';
				options.lightMap = true;
				options.lightMapChannel = 'rgb';
				options.lightMapUv = 1;
				options.lightMapTransform = 0;
				options.litOptions.lightMapWithoutAmbient = !stdMat.lightMap;
				if ((objDefs & SHADERDEF_DIRLM) !== 0) {
					options.dirLightMap = true;
				}
				if ((objDefs & SHADERDEF_LMAMBIENT) !== 0) {
					options.litOptions.lightMapWithoutAmbient = false;
				}
			}
		}
		if (stdMat.useLighting) {
			const lightsFiltered = [];
			const mask = objDefs ? objDefs >> 16 : MASK_AFFECT_DYNAMIC;
			options.litOptions.lightMaskDynamic = !!(mask & MASK_AFFECT_DYNAMIC);
			if (sortedLights) {
				this._collectLights(LIGHTTYPE_DIRECTIONAL, sortedLights[LIGHTTYPE_DIRECTIONAL], lightsFiltered, mask);
				this._collectLights(LIGHTTYPE_OMNI, sortedLights[LIGHTTYPE_OMNI], lightsFiltered, mask, staticLightList);
				this._collectLights(LIGHTTYPE_SPOT, sortedLights[LIGHTTYPE_SPOT], lightsFiltered, mask, staticLightList);
			}
			options.litOptions.lights = lightsFiltered;
		} else {
			options.litOptions.lights = [];
		}
		if (options.litOptions.lights.length === 0) {
			options.litOptions.noShadow = true;
		}
	}
	_collectLights(lType, lights, lightsFiltered, mask, staticLightList) {
		for (let i = 0; i < lights.length; i++) {
			const light = lights[i];
			if (light.enabled) {
				if (light.mask & mask) {
					if (lType !== LIGHTTYPE_DIRECTIONAL) {
						if (light.isStatic) {
							continue;
						}
					}
					lightsFiltered.push(light);
				}
			}
		}
		if (staticLightList) {
			for (let i = 0; i < staticLightList.length; i++) {
				const light = staticLightList[i];
				if (light._type === lType) {
					lightsFiltered.push(light);
				}
			}
		}
	}
	_getMapTransformID(xform, uv) {
		if (!xform) return 0;
		let xforms = this._mapXForms[uv];
		if (!xforms) {
			xforms = [];
			this._mapXForms[uv] = xforms;
		}
		for (let i = 0; i < xforms.length; i++) {
			if (arraysEqual(xforms[i][0].value, xform[0].value) && arraysEqual(xforms[i][1].value, xform[1].value)) {
				return i + 1;
			}
		}
		return xforms.push(xform);
	}
}

export { StandardMaterialOptionsBuilder };
