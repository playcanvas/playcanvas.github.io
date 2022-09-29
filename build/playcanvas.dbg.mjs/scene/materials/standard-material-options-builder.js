/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { _matTex2D } from '../../graphics/program-lib/programs/standard.js';
import { PIXELFORMAT_DXT5, TEXTURETYPE_SWIZZLEGGGR } from '../../graphics/constants.js';
import { SHADER_FORWARDHDR, GAMMA_SRGBHDR, TONEMAP_LINEAR, SHADERDEF_TANGENTS, SHADERDEF_SCREENSPACE, SHADERDEF_SKIN, SHADERDEF_INSTANCING, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED, BLEND_NONE, GAMMA_NONE, SPECULAR_PHONG, SHADERDEF_NOSHADOW, SHADERDEF_LM, SHADERDEF_DIRLM, SHADERDEF_LMAMBIENT, MASK_AFFECT_DYNAMIC, LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT, SHADERDEF_UV0, SHADERDEF_UV1, SHADERDEF_VCOLOR } from '../constants.js';
import { Quat } from '../../math/quat.js';

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
  }

  updateRef(options, scene, stdMat, objDefs, staticLightList, pass, sortedLights) {
    this._updateSharedOptions(options, scene, stdMat, objDefs, pass);

    this._updateEnvOptions(options, stdMat, scene);

    this._updateMaterialOptions(options, stdMat);

    if (pass === SHADER_FORWARDHDR) {
      if (options.gamma) options.gamma = GAMMA_SRGBHDR;
      options.toneMap = TONEMAP_LINEAR;
    }

    options.hasTangents = objDefs && (objDefs & SHADERDEF_TANGENTS) !== 0;

    this._updateLightOptions(options, stdMat, objDefs, sortedLights, staticLightList);

    this._updateUVOptions(options, stdMat, objDefs, false);
  }

  _updateSharedOptions(options, scene, stdMat, objDefs, pass) {
    options.pass = pass;
    options.alphaTest = stdMat.alphaTest > 0;
    options.forceFragmentPrecision = stdMat.forceFragmentPrecision || '';
    options.chunks = stdMat.chunks || '';
    options.blendType = stdMat.blendType;
    options.forceUv1 = stdMat.forceUv1;
    options.separateAmbient = false;
    options.screenSpace = objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0;
    options.skin = objDefs && (objDefs & SHADERDEF_SKIN) !== 0;
    options.useInstancing = objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0;
    options.useMorphPosition = objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0;
    options.useMorphNormal = objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0;
    options.useMorphTextureBased = objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0;
    options.nineSlicedMode = stdMat.nineSlicedMode || 0;

    if (scene.clusteredLightingEnabled && stdMat.useLighting) {
      options.clusteredLightingEnabled = true;
      options.clusteredLightingCookiesEnabled = scene.lighting.cookiesEnabled;
      options.clusteredLightingShadowsEnabled = scene.lighting.shadowsEnabled;
      options.clusteredLightingShadowType = scene.lighting.shadowType;
      options.clusteredLightingAreaLightsEnabled = scene.lighting.areaLightsEnabled;
    } else {
      options.clusteredLightingEnabled = false;
      options.clusteredLightingCookiesEnabled = false;
      options.clusteredLightingShadowsEnabled = false;
      options.clusteredLightingAreaLightsEnabled = false;
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

    options.vertexColors = false;
    this._mapXForms = [];
    const uniqueTextureMap = {};

    for (const p in _matTex2D) {
      this._updateTexOptions(options, stdMat, p, hasUv0, hasUv1, hasVcolor, minimalOptions, uniqueTextureMap);
    }

    this._mapXForms = null;
  }

  _updateMinOptions(options, stdMat) {
    options.opacityTint = stdMat.opacity !== 1 && stdMat.blendType !== BLEND_NONE;
    options.lights = [];
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
    options.blendMapsWithColors = true;
    options.ambientTint = stdMat.ambientTint;
    options.diffuseTint = diffuseTint ? 2 : 0;
    options.specularTint = specularTint ? 2 : 0;
    options.specularityFactorTint = specularityFactorTint ? 1 : 0;
    options.useSpecularityFactor = (specularityFactorTint || !!stdMat.specularityFactorMap) && stdMat.useMetalnessSpecularColor;
    options.useSpecularColor = useSpecularColor;
    options.metalnessTint = stdMat.useMetalness && stdMat.metalness < 1 ? 1 : 0;
    options.glossTint = 1;
    options.emissiveTint = (emissiveTintColor ? 2 : 0) + (emissiveTintIntensity ? 1 : 0);
    options.alphaToCoverage = stdMat.alphaToCoverage;
    options.normalizeNormalMap = stdMat.normalizeNormalMap;
    options.ambientSH = !!stdMat.ambientSH;
    options.useSpecular = useSpecular;
    options.diffuseEncoding = (_stdMat$diffuseMap = stdMat.diffuseMap) == null ? void 0 : _stdMat$diffuseMap.encoding;
    options.diffuseDetailEncoding = (_stdMat$diffuseDetail = stdMat.diffuseDetailMap) == null ? void 0 : _stdMat$diffuseDetail.encoding;
    options.emissiveEncoding = (_stdMat$emissiveMap = stdMat.emissiveMap) == null ? void 0 : _stdMat$emissiveMap.encoding;
    options.lightMapEncoding = (_stdMat$lightMap = stdMat.lightMap) == null ? void 0 : _stdMat$lightMap.encoding;
    options.conserveEnergy = stdMat.conserveEnergy;
    options.opacityFadesSpecular = stdMat.opacityFadesSpecular;
    options.alphaFade = stdMat.alphaFade;
    options.occludeSpecular = stdMat.occludeSpecular;
    options.occludeSpecularFloat = stdMat.occludeSpecularIntensity !== 1.0;
    options.occludeDirect = stdMat.occludeDirect;
    options.shadingModel = stdMat.shadingModel;
    options.fresnelModel = stdMat.fresnelModel;
    options.packedNormal = isPackedNormalMap;
    options.fastTbn = stdMat.fastTbn;
    options.cubeMapProjection = stdMat.cubeMapProjection;
    options.customFragmentShader = stdMat.customFragmentShader;
    options.refraction = (stdMat.refraction || !!stdMat.refractionMap) && (stdMat.useDynamicRefraction || !!options.reflectionSource);
    options.useDynamicRefraction = stdMat.useDynamicRefraction;
    options.refractionIndexTint = stdMat.refractionIndex !== 1.0 / 1.5 ? 1 : 0;
    options.thicknessTint = stdMat.useDynamicRefraction && stdMat.thickness !== 1.0 ? 1 : 0;
    options.useMetalness = stdMat.useMetalness;
    options.specularEncoding = stdMat.specularEncoding || 'linear';
    options.sheenEncoding = stdMat.sheenEncoding || 'linear';
    options.enableGGXSpecular = stdMat.enableGGXSpecular;
    options.msdf = !!stdMat.msdfMap;
    options.msdfTextAttribute = !!stdMat.msdfTextAttribute;
    options.twoSidedLighting = stdMat.twoSidedLighting;
    options.pixelSnap = stdMat.pixelSnap;
    options.aoMapUv = stdMat.aoUvSet;
    options.diffuseDetail = !!stdMat.diffuseMap;
    options.normalDetail = !!stdMat.normalMap;
    options.diffuseDetailMode = stdMat.diffuseDetailMode;
    options.detailModes = !!options.diffuseDetail;
    options.clearCoat = !!stdMat.clearCoat;
    options.clearCoatTint = stdMat.clearCoat !== 1.0 ? 1 : 0;
    options.clearCoatGlossiness = !!stdMat.clearCoatGlossiness;
    options.clearCoatGlossTint = stdMat.clearCoatGlossiness !== 1.0 ? 1 : 0;
    options.iridescence = stdMat.useIridescence && stdMat.iridescence !== 0.0;
    options.iridescenceTint = stdMat.iridescence !== 1.0 ? 1 : 0;
    options.sheen = stdMat.useSheen;
    options.sheenTint = stdMat.useSheen && notWhite(stdMat.sheen) ? 2 : 0;
    options.sheenGlossinessTint = 1;
  }

  _updateEnvOptions(options, stdMat, scene) {
    options.fog = stdMat.useFog ? scene.fog : 'none';
    options.gamma = stdMat.useGammaTonemap ? scene.gammaCorrection : GAMMA_NONE;
    options.toneMap = stdMat.useGammaTonemap ? scene.toneMapping : -1;
    options.fixSeams = stdMat.cubeMap ? stdMat.cubeMap.fixCubemapSeams : false;
    const isPhong = stdMat.shadingModel === SPECULAR_PHONG;
    let usingSceneEnv = false;

    if (stdMat.envAtlas && stdMat.cubeMap && !isPhong) {
      options.reflectionSource = 'envAtlasHQ';
      options.reflectionEncoding = stdMat.envAtlas.encoding;
    } else if (stdMat.envAtlas && !isPhong) {
      options.reflectionSource = 'envAtlas';
      options.reflectionEncoding = stdMat.envAtlas.encoding;
    } else if (stdMat.cubeMap) {
      options.reflectionSource = 'cubeMap';
      options.reflectionEncoding = stdMat.cubeMap.encoding;
    } else if (stdMat.sphereMap) {
      options.reflectionSource = 'sphereMap';
      options.reflectionEncoding = stdMat.sphereMap.encoding;
    } else if (stdMat.useSkybox && scene.envAtlas && scene.skybox && !isPhong) {
      options.reflectionSource = 'envAtlasHQ';
      options.reflectionEncoding = scene.envAtlas.encoding;
      usingSceneEnv = true;
    } else if (stdMat.useSkybox && scene.envAtlas && !isPhong) {
      options.reflectionSource = 'envAtlas';
      options.reflectionEncoding = scene.envAtlas.encoding;
      usingSceneEnv = true;
    } else if (stdMat.useSkybox && scene.skybox) {
      options.reflectionSource = 'cubeMap';
      options.reflectionEncoding = scene.skybox.encoding;
      usingSceneEnv = true;
    } else {
      options.reflectionSource = null;
      options.reflectionEncoding = null;
    }

    if (stdMat.ambientSH && !isPhong) {
      options.ambientSource = 'ambientSH';
      options.ambientEncoding = null;
    } else {
      const envAtlas = stdMat.envAtlas || (stdMat.useSkybox && scene.envAtlas ? scene.envAtlas : null);

      if (envAtlas && !isPhong) {
        options.ambientSource = 'envAtlas';
        options.ambientEncoding = envAtlas.encoding;
      } else {
        options.ambientSource = 'constant';
        options.ambientEncoding = null;
      }
    }

    options.skyboxIntensity = usingSceneEnv && (scene.skyboxIntensity !== 1 || scene.skyboxLuminance !== 0);
    options.useCubeMapRotation = usingSceneEnv && scene.skyboxRotation && !scene.skyboxRotation.equals(Quat.IDENTITY);
  }

  _updateLightOptions(options, stdMat, objDefs, sortedLights, staticLightList) {
    options.lightMap = false;
    options.lightMapChannel = '';
    options.lightMapUv = 0;
    options.lightMapTransform = 0;
    options.lightMapWithoutAmbient = false;
    options.dirLightMap = false;

    if (objDefs) {
      options.noShadow = (objDefs & SHADERDEF_NOSHADOW) !== 0;

      if ((objDefs & SHADERDEF_LM) !== 0) {
        options.lightMapEncoding = 'rgbm';
        options.lightMap = true;
        options.lightMapChannel = 'rgb';
        options.lightMapUv = 1;
        options.lightMapTransform = 0;
        options.lightMapWithoutAmbient = !stdMat.lightMap;

        if ((objDefs & SHADERDEF_DIRLM) !== 0) {
          options.dirLightMap = true;
        }

        if ((objDefs & SHADERDEF_LMAMBIENT) !== 0) {
          options.lightMapWithoutAmbient = false;
        }
      }
    }

    if (stdMat.useLighting) {
      const lightsFiltered = [];
      const mask = objDefs ? objDefs >> 16 : MASK_AFFECT_DYNAMIC;
      options.lightMaskDynamic = !!(mask & MASK_AFFECT_DYNAMIC);

      if (sortedLights) {
        this._collectLights(LIGHTTYPE_DIRECTIONAL, sortedLights[LIGHTTYPE_DIRECTIONAL], lightsFiltered, mask);

        this._collectLights(LIGHTTYPE_OMNI, sortedLights[LIGHTTYPE_OMNI], lightsFiltered, mask, staticLightList);

        this._collectLights(LIGHTTYPE_SPOT, sortedLights[LIGHTTYPE_SPOT], lightsFiltered, mask, staticLightList);
      }

      options.lights = lightsFiltered;
    } else {
      options.lights = [];
    }

    if (options.lights.length === 0) {
      options.noShadow = true;
    }
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
      options[cname] = '';
      options[tname] = 0;
      options[uname] = 0;
      options[iname] = undefined;
    }

    options[vname] = false;
    options[vcname] = '';
    const isOpacity = p === 'opacity';
    if (isOpacity && stdMat.blendType === BLEND_NONE && stdMat.alphaTest === 0.0 && !stdMat.alphaToCoverage) return;

    if (!minimalOptions || isOpacity) {
      if (p !== 'height' && stdMat[vname]) {
        if (hasVcolor) {
          options[vname] = stdMat[vname];
          options[vcname] = stdMat[vcname];
          options.vertexColors = true;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQtbWF0ZXJpYWwtb3B0aW9ucy1idWlsZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLW9wdGlvbnMtYnVpbGRlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBfbWF0VGV4MkQgfSBmcm9tICcuLi8uLi9ncmFwaGljcy9wcm9ncmFtLWxpYi9wcm9ncmFtcy9zdGFuZGFyZC5qcyc7XG5cbmltcG9ydCB7XG4gICAgUElYRUxGT1JNQVRfRFhUNSwgVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1Jcbn0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7XG4gICAgQkxFTkRfTk9ORSxcbiAgICBHQU1NQV9OT05FLCBHQU1NQV9TUkdCSERSLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIE1BU0tfQUZGRUNUX0RZTkFNSUMsXG4gICAgU0hBREVSX0ZPUldBUkRIRFIsXG4gICAgU0hBREVSREVGX0RJUkxNLCBTSEFERVJERUZfSU5TVEFOQ0lORywgU0hBREVSREVGX0xNLCBTSEFERVJERUZfTU9SUEhfUE9TSVRJT04sIFNIQURFUkRFRl9NT1JQSF9OT1JNQUwsIFNIQURFUkRFRl9OT1NIQURPVywgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQsXG4gICAgU0hBREVSREVGX1NDUkVFTlNQQUNFLCBTSEFERVJERUZfU0tJTiwgU0hBREVSREVGX1RBTkdFTlRTLCBTSEFERVJERUZfVVYwLCBTSEFERVJERUZfVVYxLCBTSEFERVJERUZfVkNPTE9SLCBTSEFERVJERUZfTE1BTUJJRU5ULFxuICAgIFRPTkVNQVBfTElORUFSLFxuICAgIFNQRUNVTEFSX1BIT05HXG59IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IFF1YXQgfSBmcm9tICcuLi8uLi9tYXRoL3F1YXQuanMnO1xuXG5jb25zdCBhcnJheXNFcXVhbCA9IChhLCBiKSA9PiB7XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7ICsraSkge1xuICAgICAgICBpZiAoYVtpXSAhPT0gYltpXSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufTtcblxuY29uc3Qgbm90V2hpdGUgPSAoY29sb3IpID0+IHtcbiAgICByZXR1cm4gY29sb3IuciAhPT0gMSB8fCBjb2xvci5nICE9PSAxIHx8IGNvbG9yLmIgIT09IDE7XG59O1xuXG5jb25zdCBub3RCbGFjayA9IChjb2xvcikgPT4ge1xuICAgIHJldHVybiBjb2xvci5yICE9PSAwIHx8IGNvbG9yLmcgIT09IDAgfHwgY29sb3IuYiAhPT0gMDtcbn07XG5cbmNsYXNzIFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zQnVpbGRlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuX21hcFhGb3JtcyA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gTWluaW1hbCBvcHRpb25zIGZvciBEZXB0aCBhbmQgU2hhZG93IHBhc3Nlc1xuICAgIHVwZGF0ZU1pblJlZihvcHRpb25zLCBzY2VuZSwgc3RkTWF0LCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cykge1xuICAgICAgICB0aGlzLl91cGRhdGVTaGFyZWRPcHRpb25zKG9wdGlvbnMsIHNjZW5lLCBzdGRNYXQsIG9iakRlZnMsIHBhc3MpO1xuICAgICAgICB0aGlzLl91cGRhdGVNaW5PcHRpb25zKG9wdGlvbnMsIHN0ZE1hdCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVVWT3B0aW9ucyhvcHRpb25zLCBzdGRNYXQsIG9iakRlZnMsIHRydWUpO1xuICAgIH1cblxuICAgIHVwZGF0ZVJlZihvcHRpb25zLCBzY2VuZSwgc3RkTWF0LCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cykge1xuICAgICAgICB0aGlzLl91cGRhdGVTaGFyZWRPcHRpb25zKG9wdGlvbnMsIHNjZW5lLCBzdGRNYXQsIG9iakRlZnMsIHBhc3MpO1xuICAgICAgICB0aGlzLl91cGRhdGVFbnZPcHRpb25zKG9wdGlvbnMsIHN0ZE1hdCwgc2NlbmUpO1xuICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbE9wdGlvbnMob3B0aW9ucywgc3RkTWF0KTtcbiAgICAgICAgaWYgKHBhc3MgPT09IFNIQURFUl9GT1JXQVJESERSKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5nYW1tYSkgb3B0aW9ucy5nYW1tYSA9IEdBTU1BX1NSR0JIRFI7XG4gICAgICAgICAgICBvcHRpb25zLnRvbmVNYXAgPSBUT05FTUFQX0xJTkVBUjtcbiAgICAgICAgfVxuICAgICAgICBvcHRpb25zLmhhc1RhbmdlbnRzID0gb2JqRGVmcyAmJiAoKG9iakRlZnMgJiBTSEFERVJERUZfVEFOR0VOVFMpICE9PSAwKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTGlnaHRPcHRpb25zKG9wdGlvbnMsIHN0ZE1hdCwgb2JqRGVmcywgc29ydGVkTGlnaHRzLCBzdGF0aWNMaWdodExpc3QpO1xuICAgICAgICB0aGlzLl91cGRhdGVVVk9wdGlvbnMob3B0aW9ucywgc3RkTWF0LCBvYmpEZWZzLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgX3VwZGF0ZVNoYXJlZE9wdGlvbnMob3B0aW9ucywgc2NlbmUsIHN0ZE1hdCwgb2JqRGVmcywgcGFzcykge1xuICAgICAgICBvcHRpb25zLnBhc3MgPSBwYXNzO1xuICAgICAgICBvcHRpb25zLmFscGhhVGVzdCA9IHN0ZE1hdC5hbHBoYVRlc3QgPiAwO1xuICAgICAgICBvcHRpb25zLmZvcmNlRnJhZ21lbnRQcmVjaXNpb24gPSBzdGRNYXQuZm9yY2VGcmFnbWVudFByZWNpc2lvbiB8fCAnJztcbiAgICAgICAgb3B0aW9ucy5jaHVua3MgPSBzdGRNYXQuY2h1bmtzIHx8ICcnO1xuICAgICAgICBvcHRpb25zLmJsZW5kVHlwZSA9IHN0ZE1hdC5ibGVuZFR5cGU7XG4gICAgICAgIG9wdGlvbnMuZm9yY2VVdjEgPSBzdGRNYXQuZm9yY2VVdjE7XG4gICAgICAgIG9wdGlvbnMuc2VwYXJhdGVBbWJpZW50ID0gZmFsc2U7ICAgIC8vIHN0b3JlIGFtYmllbnQgbGlnaHQgY29sb3IgaW4gc2VwYXJhdGUgdmFyaWFibGUsIGluc3RlYWQgb2YgYWRkaW5nIGl0IHRvIGRpZmZ1c2UgZGlyZWN0bHlcbiAgICAgICAgb3B0aW9ucy5zY3JlZW5TcGFjZSA9IG9iakRlZnMgJiYgKG9iakRlZnMgJiBTSEFERVJERUZfU0NSRUVOU1BBQ0UpICE9PSAwO1xuICAgICAgICBvcHRpb25zLnNraW4gPSBvYmpEZWZzICYmIChvYmpEZWZzICYgU0hBREVSREVGX1NLSU4pICE9PSAwO1xuICAgICAgICBvcHRpb25zLnVzZUluc3RhbmNpbmcgPSBvYmpEZWZzICYmIChvYmpEZWZzICYgU0hBREVSREVGX0lOU1RBTkNJTkcpICE9PSAwO1xuICAgICAgICBvcHRpb25zLnVzZU1vcnBoUG9zaXRpb24gPSBvYmpEZWZzICYmIChvYmpEZWZzICYgU0hBREVSREVGX01PUlBIX1BPU0lUSU9OKSAhPT0gMDtcbiAgICAgICAgb3B0aW9ucy51c2VNb3JwaE5vcm1hbCA9IG9iakRlZnMgJiYgKG9iakRlZnMgJiBTSEFERVJERUZfTU9SUEhfTk9STUFMKSAhPT0gMDtcbiAgICAgICAgb3B0aW9ucy51c2VNb3JwaFRleHR1cmVCYXNlZCA9IG9iakRlZnMgJiYgKG9iakRlZnMgJiBTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCkgIT09IDA7XG5cbiAgICAgICAgb3B0aW9ucy5uaW5lU2xpY2VkTW9kZSA9IHN0ZE1hdC5uaW5lU2xpY2VkTW9kZSB8fCAwO1xuXG4gICAgICAgIC8vIGNsdXN0ZXJlZCBsaWdodGluZyBmZWF0dXJlcyAoaW4gc2hhcmVkIG9wdGlvbnMgYXMgc2hhZG93IHBhc3MgbmVlZHMgdGhpcyB0b28pXG4gICAgICAgIGlmIChzY2VuZS5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgJiYgc3RkTWF0LnVzZUxpZ2h0aW5nKSB7XG4gICAgICAgICAgICBvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRydWU7XG4gICAgICAgICAgICBvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nQ29va2llc0VuYWJsZWQgPSBzY2VuZS5saWdodGluZy5jb29raWVzRW5hYmxlZDtcbiAgICAgICAgICAgIG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdTaGFkb3dzRW5hYmxlZCA9IHNjZW5lLmxpZ2h0aW5nLnNoYWRvd3NFbmFibGVkO1xuICAgICAgICAgICAgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ1NoYWRvd1R5cGUgPSBzY2VuZS5saWdodGluZy5zaGFkb3dUeXBlO1xuICAgICAgICAgICAgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0FyZWFMaWdodHNFbmFibGVkID0gc2NlbmUubGlnaHRpbmcuYXJlYUxpZ2h0c0VuYWJsZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgb3B0aW9ucy5jbHVzdGVyZWRMaWdodGluZ0Nvb2tpZXNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgICAgICBvcHRpb25zLmNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIG9wdGlvbnMuY2x1c3RlcmVkTGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZVVWT3B0aW9ucyhvcHRpb25zLCBzdGRNYXQsIG9iakRlZnMsIG1pbmltYWxPcHRpb25zKSB7XG4gICAgICAgIGxldCBoYXNVdjAgPSBmYWxzZTtcbiAgICAgICAgbGV0IGhhc1V2MSA9IGZhbHNlO1xuICAgICAgICBsZXQgaGFzVmNvbG9yID0gZmFsc2U7XG4gICAgICAgIGlmIChvYmpEZWZzKSB7XG4gICAgICAgICAgICBoYXNVdjAgPSAob2JqRGVmcyAmIFNIQURFUkRFRl9VVjApICE9PSAwO1xuICAgICAgICAgICAgaGFzVXYxID0gKG9iakRlZnMgJiBTSEFERVJERUZfVVYxKSAhPT0gMDtcbiAgICAgICAgICAgIGhhc1Zjb2xvciA9IChvYmpEZWZzICYgU0hBREVSREVGX1ZDT0xPUikgIT09IDA7XG4gICAgICAgIH1cblxuICAgICAgICBvcHRpb25zLnZlcnRleENvbG9ycyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9tYXBYRm9ybXMgPSBbXTtcblxuICAgICAgICBjb25zdCB1bmlxdWVUZXh0dXJlTWFwID0ge307XG4gICAgICAgIGZvciAoY29uc3QgcCBpbiBfbWF0VGV4MkQpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleE9wdGlvbnMob3B0aW9ucywgc3RkTWF0LCBwLCBoYXNVdjAsIGhhc1V2MSwgaGFzVmNvbG9yLCBtaW5pbWFsT3B0aW9ucywgdW5pcXVlVGV4dHVyZU1hcCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbWFwWEZvcm1zID0gbnVsbDtcbiAgICB9XG5cbiAgICBfdXBkYXRlTWluT3B0aW9ucyhvcHRpb25zLCBzdGRNYXQpIHtcbiAgICAgICAgb3B0aW9ucy5vcGFjaXR5VGludCA9IHN0ZE1hdC5vcGFjaXR5ICE9PSAxICYmIHN0ZE1hdC5ibGVuZFR5cGUgIT09IEJMRU5EX05PTkU7XG4gICAgICAgIG9wdGlvbnMubGlnaHRzID0gW107XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1hdGVyaWFsT3B0aW9ucyhvcHRpb25zLCBzdGRNYXQpIHtcbiAgICAgICAgY29uc3QgZGlmZnVzZVRpbnQgPSAoc3RkTWF0LmRpZmZ1c2VUaW50IHx8ICghc3RkTWF0LmRpZmZ1c2VNYXAgJiYgIXN0ZE1hdC5kaWZmdXNlVmVydGV4Q29sb3IpKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdFdoaXRlKHN0ZE1hdC5kaWZmdXNlKTtcblxuICAgICAgICBjb25zdCB1c2VTcGVjdWxhciA9ICEhKHN0ZE1hdC51c2VNZXRhbG5lc3MgfHwgc3RkTWF0LnNwZWN1bGFyTWFwIHx8IHN0ZE1hdC5zcGhlcmVNYXAgfHwgc3RkTWF0LmN1YmVNYXAgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3RCbGFjayhzdGRNYXQuc3BlY3VsYXIpIHx8IChzdGRNYXQuc3BlY3VsYXJpdHlGYWN0b3IgPiAwICYmIHN0ZE1hdC51c2VNZXRhbG5lc3MpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RkTWF0LmVuYWJsZUdHWFNwZWN1bGFyIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKHN0ZE1hdC5jbGVhckNvYXQgPiAwKSk7XG5cbiAgICAgICAgY29uc3QgdXNlU3BlY3VsYXJDb2xvciA9ICghc3RkTWF0LnVzZU1ldGFsbmVzcyB8fCBzdGRNYXQudXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvcik7XG4gICAgICAgIGNvbnN0IHNwZWN1bGFyVGludCA9IHVzZVNwZWN1bGFyICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzdGRNYXQuc3BlY3VsYXJUaW50IHx8ICghc3RkTWF0LnNwZWN1bGFyTWFwICYmICFzdGRNYXQuc3BlY3VsYXJWZXJ0ZXhDb2xvcikpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdFdoaXRlKHN0ZE1hdC5zcGVjdWxhcik7XG5cbiAgICAgICAgY29uc3Qgc3BlY3VsYXJpdHlGYWN0b3JUaW50ID0gdXNlU3BlY3VsYXIgJiYgc3RkTWF0LnVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHN0ZE1hdC5zcGVjdWxhcml0eUZhY3RvclRpbnQgfHwgKHN0ZE1hdC5zcGVjdWxhcml0eUZhY3RvciA8IDEgJiYgIXN0ZE1hdC5zcGVjdWxhcml0eUZhY3Rvck1hcCkpO1xuXG4gICAgICAgIGNvbnN0IGVtaXNzaXZlVGludENvbG9yID0gIXN0ZE1hdC5lbWlzc2l2ZU1hcCB8fCAobm90V2hpdGUoc3RkTWF0LmVtaXNzaXZlKSAmJiBzdGRNYXQuZW1pc3NpdmVUaW50KTtcbiAgICAgICAgY29uc3QgZW1pc3NpdmVUaW50SW50ZW5zaXR5ID0gKHN0ZE1hdC5lbWlzc2l2ZUludGVuc2l0eSAhPT0gMSk7XG5cbiAgICAgICAgY29uc3QgaXNQYWNrZWROb3JtYWxNYXAgPSBzdGRNYXQubm9ybWFsTWFwID8gKHN0ZE1hdC5ub3JtYWxNYXAuZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9EWFQ1IHx8IHN0ZE1hdC5ub3JtYWxNYXAudHlwZSA9PT0gVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IpIDogZmFsc2U7XG5cbiAgICAgICAgb3B0aW9ucy5vcGFjaXR5VGludCA9IChzdGRNYXQub3BhY2l0eSAhPT0gMSAmJiBzdGRNYXQuYmxlbmRUeXBlICE9PSBCTEVORF9OT05FKSA/IDEgOiAwO1xuICAgICAgICBvcHRpb25zLmJsZW5kTWFwc1dpdGhDb2xvcnMgPSB0cnVlO1xuICAgICAgICBvcHRpb25zLmFtYmllbnRUaW50ID0gc3RkTWF0LmFtYmllbnRUaW50O1xuICAgICAgICBvcHRpb25zLmRpZmZ1c2VUaW50ID0gZGlmZnVzZVRpbnQgPyAyIDogMDtcbiAgICAgICAgb3B0aW9ucy5zcGVjdWxhclRpbnQgPSBzcGVjdWxhclRpbnQgPyAyIDogMDtcbiAgICAgICAgb3B0aW9ucy5zcGVjdWxhcml0eUZhY3RvclRpbnQgPSBzcGVjdWxhcml0eUZhY3RvclRpbnQgPyAxIDogMDtcbiAgICAgICAgb3B0aW9ucy51c2VTcGVjdWxhcml0eUZhY3RvciA9IChzcGVjdWxhcml0eUZhY3RvclRpbnQgfHwgISFzdGRNYXQuc3BlY3VsYXJpdHlGYWN0b3JNYXApICYmIHN0ZE1hdC51c2VNZXRhbG5lc3NTcGVjdWxhckNvbG9yO1xuICAgICAgICBvcHRpb25zLnVzZVNwZWN1bGFyQ29sb3IgPSB1c2VTcGVjdWxhckNvbG9yO1xuICAgICAgICBvcHRpb25zLm1ldGFsbmVzc1RpbnQgPSAoc3RkTWF0LnVzZU1ldGFsbmVzcyAmJiBzdGRNYXQubWV0YWxuZXNzIDwgMSkgPyAxIDogMDtcbiAgICAgICAgb3B0aW9ucy5nbG9zc1RpbnQgPSAxO1xuICAgICAgICBvcHRpb25zLmVtaXNzaXZlVGludCA9IChlbWlzc2l2ZVRpbnRDb2xvciA/IDIgOiAwKSArIChlbWlzc2l2ZVRpbnRJbnRlbnNpdHkgPyAxIDogMCk7XG4gICAgICAgIG9wdGlvbnMuYWxwaGFUb0NvdmVyYWdlID0gc3RkTWF0LmFscGhhVG9Db3ZlcmFnZTtcbiAgICAgICAgb3B0aW9ucy5ub3JtYWxpemVOb3JtYWxNYXAgPSBzdGRNYXQubm9ybWFsaXplTm9ybWFsTWFwO1xuICAgICAgICBvcHRpb25zLmFtYmllbnRTSCA9ICEhc3RkTWF0LmFtYmllbnRTSDtcbiAgICAgICAgb3B0aW9ucy51c2VTcGVjdWxhciA9IHVzZVNwZWN1bGFyO1xuICAgICAgICBvcHRpb25zLmRpZmZ1c2VFbmNvZGluZyA9IHN0ZE1hdC5kaWZmdXNlTWFwPy5lbmNvZGluZztcbiAgICAgICAgb3B0aW9ucy5kaWZmdXNlRGV0YWlsRW5jb2RpbmcgPSBzdGRNYXQuZGlmZnVzZURldGFpbE1hcD8uZW5jb2Rpbmc7XG4gICAgICAgIG9wdGlvbnMuZW1pc3NpdmVFbmNvZGluZyA9IHN0ZE1hdC5lbWlzc2l2ZU1hcD8uZW5jb2Rpbmc7XG4gICAgICAgIG9wdGlvbnMubGlnaHRNYXBFbmNvZGluZyA9IHN0ZE1hdC5saWdodE1hcD8uZW5jb2Rpbmc7XG4gICAgICAgIG9wdGlvbnMuY29uc2VydmVFbmVyZ3kgPSBzdGRNYXQuY29uc2VydmVFbmVyZ3k7XG4gICAgICAgIG9wdGlvbnMub3BhY2l0eUZhZGVzU3BlY3VsYXIgPSBzdGRNYXQub3BhY2l0eUZhZGVzU3BlY3VsYXI7XG4gICAgICAgIG9wdGlvbnMuYWxwaGFGYWRlID0gc3RkTWF0LmFscGhhRmFkZTtcbiAgICAgICAgb3B0aW9ucy5vY2NsdWRlU3BlY3VsYXIgPSBzdGRNYXQub2NjbHVkZVNwZWN1bGFyO1xuICAgICAgICBvcHRpb25zLm9jY2x1ZGVTcGVjdWxhckZsb2F0ID0gKHN0ZE1hdC5vY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkgIT09IDEuMCk7XG4gICAgICAgIG9wdGlvbnMub2NjbHVkZURpcmVjdCA9IHN0ZE1hdC5vY2NsdWRlRGlyZWN0O1xuICAgICAgICBvcHRpb25zLnNoYWRpbmdNb2RlbCA9IHN0ZE1hdC5zaGFkaW5nTW9kZWw7XG4gICAgICAgIG9wdGlvbnMuZnJlc25lbE1vZGVsID0gc3RkTWF0LmZyZXNuZWxNb2RlbDtcbiAgICAgICAgb3B0aW9ucy5wYWNrZWROb3JtYWwgPSBpc1BhY2tlZE5vcm1hbE1hcDtcbiAgICAgICAgb3B0aW9ucy5mYXN0VGJuID0gc3RkTWF0LmZhc3RUYm47XG4gICAgICAgIG9wdGlvbnMuY3ViZU1hcFByb2plY3Rpb24gPSBzdGRNYXQuY3ViZU1hcFByb2plY3Rpb247XG4gICAgICAgIG9wdGlvbnMuY3VzdG9tRnJhZ21lbnRTaGFkZXIgPSBzdGRNYXQuY3VzdG9tRnJhZ21lbnRTaGFkZXI7XG4gICAgICAgIG9wdGlvbnMucmVmcmFjdGlvbiA9IChzdGRNYXQucmVmcmFjdGlvbiB8fCAhIXN0ZE1hdC5yZWZyYWN0aW9uTWFwKSAmJiAoc3RkTWF0LnVzZUR5bmFtaWNSZWZyYWN0aW9uIHx8ICEhb3B0aW9ucy5yZWZsZWN0aW9uU291cmNlKTtcbiAgICAgICAgb3B0aW9ucy51c2VEeW5hbWljUmVmcmFjdGlvbiA9IHN0ZE1hdC51c2VEeW5hbWljUmVmcmFjdGlvbjtcbiAgICAgICAgb3B0aW9ucy5yZWZyYWN0aW9uSW5kZXhUaW50ID0gKHN0ZE1hdC5yZWZyYWN0aW9uSW5kZXggIT09IDEuMCAvIDEuNSkgPyAxIDogMDtcbiAgICAgICAgb3B0aW9ucy50aGlja25lc3NUaW50ID0gKHN0ZE1hdC51c2VEeW5hbWljUmVmcmFjdGlvbiAmJiBzdGRNYXQudGhpY2tuZXNzICE9PSAxLjApID8gMSA6IDA7XG4gICAgICAgIG9wdGlvbnMudXNlTWV0YWxuZXNzID0gc3RkTWF0LnVzZU1ldGFsbmVzcztcbiAgICAgICAgb3B0aW9ucy5zcGVjdWxhckVuY29kaW5nID0gc3RkTWF0LnNwZWN1bGFyRW5jb2RpbmcgfHwgJ2xpbmVhcic7XG4gICAgICAgIG9wdGlvbnMuc2hlZW5FbmNvZGluZyA9IHN0ZE1hdC5zaGVlbkVuY29kaW5nIHx8ICdsaW5lYXInO1xuICAgICAgICBvcHRpb25zLmVuYWJsZUdHWFNwZWN1bGFyID0gc3RkTWF0LmVuYWJsZUdHWFNwZWN1bGFyO1xuICAgICAgICBvcHRpb25zLm1zZGYgPSAhIXN0ZE1hdC5tc2RmTWFwO1xuICAgICAgICBvcHRpb25zLm1zZGZUZXh0QXR0cmlidXRlID0gISFzdGRNYXQubXNkZlRleHRBdHRyaWJ1dGU7XG4gICAgICAgIG9wdGlvbnMudHdvU2lkZWRMaWdodGluZyA9IHN0ZE1hdC50d29TaWRlZExpZ2h0aW5nO1xuICAgICAgICBvcHRpb25zLnBpeGVsU25hcCA9IHN0ZE1hdC5waXhlbFNuYXA7XG4gICAgICAgIG9wdGlvbnMuYW9NYXBVdiA9IHN0ZE1hdC5hb1V2U2V0OyAvLyBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICAgICAgICBvcHRpb25zLmRpZmZ1c2VEZXRhaWwgPSAhIXN0ZE1hdC5kaWZmdXNlTWFwO1xuICAgICAgICBvcHRpb25zLm5vcm1hbERldGFpbCA9ICEhc3RkTWF0Lm5vcm1hbE1hcDtcbiAgICAgICAgb3B0aW9ucy5kaWZmdXNlRGV0YWlsTW9kZSA9IHN0ZE1hdC5kaWZmdXNlRGV0YWlsTW9kZTtcbiAgICAgICAgb3B0aW9ucy5kZXRhaWxNb2RlcyA9ICEhb3B0aW9ucy5kaWZmdXNlRGV0YWlsO1xuICAgICAgICBvcHRpb25zLmNsZWFyQ29hdCA9ICEhc3RkTWF0LmNsZWFyQ29hdDtcbiAgICAgICAgb3B0aW9ucy5jbGVhckNvYXRUaW50ID0gKHN0ZE1hdC5jbGVhckNvYXQgIT09IDEuMCkgPyAxIDogMDtcbiAgICAgICAgb3B0aW9ucy5jbGVhckNvYXRHbG9zc2luZXNzID0gISFzdGRNYXQuY2xlYXJDb2F0R2xvc3NpbmVzcztcbiAgICAgICAgb3B0aW9ucy5jbGVhckNvYXRHbG9zc1RpbnQgPSAoc3RkTWF0LmNsZWFyQ29hdEdsb3NzaW5lc3MgIT09IDEuMCkgPyAxIDogMDtcblxuICAgICAgICBvcHRpb25zLmlyaWRlc2NlbmNlID0gc3RkTWF0LnVzZUlyaWRlc2NlbmNlICYmIHN0ZE1hdC5pcmlkZXNjZW5jZSAhPT0gMC4wO1xuICAgICAgICBvcHRpb25zLmlyaWRlc2NlbmNlVGludCA9IHN0ZE1hdC5pcmlkZXNjZW5jZSAhPT0gMS4wID8gMSA6IDA7XG5cbiAgICAgICAgb3B0aW9ucy5zaGVlbiA9IHN0ZE1hdC51c2VTaGVlbjtcbiAgICAgICAgb3B0aW9ucy5zaGVlblRpbnQgPSAoc3RkTWF0LnVzZVNoZWVuICYmIG5vdFdoaXRlKHN0ZE1hdC5zaGVlbikpID8gMiA6IDA7XG4gICAgICAgIG9wdGlvbnMuc2hlZW5HbG9zc2luZXNzVGludCA9IDE7XG4gICAgfVxuXG4gICAgX3VwZGF0ZUVudk9wdGlvbnMob3B0aW9ucywgc3RkTWF0LCBzY2VuZSkge1xuICAgICAgICBvcHRpb25zLmZvZyA9IHN0ZE1hdC51c2VGb2cgPyBzY2VuZS5mb2cgOiAnbm9uZSc7XG4gICAgICAgIG9wdGlvbnMuZ2FtbWEgPSBzdGRNYXQudXNlR2FtbWFUb25lbWFwID8gc2NlbmUuZ2FtbWFDb3JyZWN0aW9uIDogR0FNTUFfTk9ORTtcbiAgICAgICAgb3B0aW9ucy50b25lTWFwID0gc3RkTWF0LnVzZUdhbW1hVG9uZW1hcCA/IHNjZW5lLnRvbmVNYXBwaW5nIDogLTE7XG4gICAgICAgIG9wdGlvbnMuZml4U2VhbXMgPSAoc3RkTWF0LmN1YmVNYXAgPyBzdGRNYXQuY3ViZU1hcC5maXhDdWJlbWFwU2VhbXMgOiBmYWxzZSk7XG5cbiAgICAgICAgY29uc3QgaXNQaG9uZyA9IHN0ZE1hdC5zaGFkaW5nTW9kZWwgPT09IFNQRUNVTEFSX1BIT05HO1xuXG4gICAgICAgIGxldCB1c2luZ1NjZW5lRW52ID0gZmFsc2U7XG5cbiAgICAgICAgLy8gc291cmNlIG9mIGVudmlyb25tZW50IHJlZmxlY3Rpb25zIGlzIGFzIGZvbGxvd3M6XG4gICAgICAgIGlmIChzdGRNYXQuZW52QXRsYXMgJiYgc3RkTWF0LmN1YmVNYXAgJiYgIWlzUGhvbmcpIHtcbiAgICAgICAgICAgIG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9ICdlbnZBdGxhc0hRJztcbiAgICAgICAgICAgIG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nID0gc3RkTWF0LmVudkF0bGFzLmVuY29kaW5nO1xuICAgICAgICB9IGVsc2UgaWYgKHN0ZE1hdC5lbnZBdGxhcyAmJiAhaXNQaG9uZykge1xuICAgICAgICAgICAgb3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID0gJ2VudkF0bGFzJztcbiAgICAgICAgICAgIG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nID0gc3RkTWF0LmVudkF0bGFzLmVuY29kaW5nO1xuICAgICAgICB9IGVsc2UgaWYgKHN0ZE1hdC5jdWJlTWFwKSB7XG4gICAgICAgICAgICBvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPSAnY3ViZU1hcCc7XG4gICAgICAgICAgICBvcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZyA9IHN0ZE1hdC5jdWJlTWFwLmVuY29kaW5nO1xuICAgICAgICB9IGVsc2UgaWYgKHN0ZE1hdC5zcGhlcmVNYXApIHtcbiAgICAgICAgICAgIG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9ICdzcGhlcmVNYXAnO1xuICAgICAgICAgICAgb3B0aW9ucy5yZWZsZWN0aW9uRW5jb2RpbmcgPSBzdGRNYXQuc3BoZXJlTWFwLmVuY29kaW5nO1xuICAgICAgICB9IGVsc2UgaWYgKHN0ZE1hdC51c2VTa3lib3ggJiYgc2NlbmUuZW52QXRsYXMgJiYgc2NlbmUuc2t5Ym94ICYmICFpc1Bob25nKSB7XG4gICAgICAgICAgICBvcHRpb25zLnJlZmxlY3Rpb25Tb3VyY2UgPSAnZW52QXRsYXNIUSc7XG4gICAgICAgICAgICBvcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZyA9IHNjZW5lLmVudkF0bGFzLmVuY29kaW5nO1xuICAgICAgICAgICAgdXNpbmdTY2VuZUVudiA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoc3RkTWF0LnVzZVNreWJveCAmJiBzY2VuZS5lbnZBdGxhcyAmJiAhaXNQaG9uZykge1xuICAgICAgICAgICAgb3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID0gJ2VudkF0bGFzJztcbiAgICAgICAgICAgIG9wdGlvbnMucmVmbGVjdGlvbkVuY29kaW5nID0gc2NlbmUuZW52QXRsYXMuZW5jb2Rpbmc7XG4gICAgICAgICAgICB1c2luZ1NjZW5lRW52ID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzdGRNYXQudXNlU2t5Ym94ICYmIHNjZW5lLnNreWJveCkge1xuICAgICAgICAgICAgb3B0aW9ucy5yZWZsZWN0aW9uU291cmNlID0gJ2N1YmVNYXAnO1xuICAgICAgICAgICAgb3B0aW9ucy5yZWZsZWN0aW9uRW5jb2RpbmcgPSBzY2VuZS5za3lib3guZW5jb2Rpbmc7XG4gICAgICAgICAgICB1c2luZ1NjZW5lRW52ID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wdGlvbnMucmVmbGVjdGlvblNvdXJjZSA9IG51bGw7XG4gICAgICAgICAgICBvcHRpb25zLnJlZmxlY3Rpb25FbmNvZGluZyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzb3VyY2Ugb2YgZW52aXJvbm1lbnQgYW1iaWVudCBpcyBhcyBmb2xsb3dzOlxuICAgICAgICBpZiAoc3RkTWF0LmFtYmllbnRTSCAmJiAhaXNQaG9uZykge1xuICAgICAgICAgICAgb3B0aW9ucy5hbWJpZW50U291cmNlID0gJ2FtYmllbnRTSCc7XG4gICAgICAgICAgICBvcHRpb25zLmFtYmllbnRFbmNvZGluZyA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBlbnZBdGxhcyA9IHN0ZE1hdC5lbnZBdGxhcyB8fCAoc3RkTWF0LnVzZVNreWJveCAmJiBzY2VuZS5lbnZBdGxhcyA/IHNjZW5lLmVudkF0bGFzIDogbnVsbCk7XG4gICAgICAgICAgICBpZiAoZW52QXRsYXMgJiYgIWlzUGhvbmcpIHtcbiAgICAgICAgICAgICAgICBvcHRpb25zLmFtYmllbnRTb3VyY2UgPSAnZW52QXRsYXMnO1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuYW1iaWVudEVuY29kaW5nID0gZW52QXRsYXMuZW5jb2Rpbmc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMuYW1iaWVudFNvdXJjZSA9ICdjb25zdGFudCc7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5hbWJpZW50RW5jb2RpbmcgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETzogYWRkIGEgdGVzdCBmb3IgaWYgbm9uIHNreWJveCBjdWJlbWFwcyBoYXZlIHJvdGF0aW9uICh3aGVuIHRoaXMgaXMgc3VwcG9ydGVkKSAtIGZvciBub3cgYXNzdW1lIG5vIG5vbi1za3lib3ggY3ViZW1hcCByb3RhdGlvblxuICAgICAgICBvcHRpb25zLnNreWJveEludGVuc2l0eSA9IHVzaW5nU2NlbmVFbnYgJiYgKHNjZW5lLnNreWJveEludGVuc2l0eSAhPT0gMSB8fCBzY2VuZS5za3lib3hMdW1pbmFuY2UgIT09IDApO1xuICAgICAgICBvcHRpb25zLnVzZUN1YmVNYXBSb3RhdGlvbiA9IHVzaW5nU2NlbmVFbnYgJiYgc2NlbmUuc2t5Ym94Um90YXRpb24gJiYgIXNjZW5lLnNreWJveFJvdGF0aW9uLmVxdWFscyhRdWF0LklERU5USVRZKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlTGlnaHRPcHRpb25zKG9wdGlvbnMsIHN0ZE1hdCwgb2JqRGVmcywgc29ydGVkTGlnaHRzLCBzdGF0aWNMaWdodExpc3QpIHtcbiAgICAgICAgb3B0aW9ucy5saWdodE1hcCA9IGZhbHNlO1xuICAgICAgICBvcHRpb25zLmxpZ2h0TWFwQ2hhbm5lbCA9ICcnO1xuICAgICAgICBvcHRpb25zLmxpZ2h0TWFwVXYgPSAwO1xuICAgICAgICBvcHRpb25zLmxpZ2h0TWFwVHJhbnNmb3JtID0gMDtcbiAgICAgICAgb3B0aW9ucy5saWdodE1hcFdpdGhvdXRBbWJpZW50ID0gZmFsc2U7XG4gICAgICAgIG9wdGlvbnMuZGlyTGlnaHRNYXAgPSBmYWxzZTtcblxuICAgICAgICBpZiAob2JqRGVmcykge1xuICAgICAgICAgICAgb3B0aW9ucy5ub1NoYWRvdyA9IChvYmpEZWZzICYgU0hBREVSREVGX05PU0hBRE9XKSAhPT0gMDtcblxuICAgICAgICAgICAgaWYgKChvYmpEZWZzICYgU0hBREVSREVGX0xNKSAhPT0gMCkge1xuICAgICAgICAgICAgICAgIG9wdGlvbnMubGlnaHRNYXBFbmNvZGluZyA9ICdyZ2JtJztcbiAgICAgICAgICAgICAgICBvcHRpb25zLmxpZ2h0TWFwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBvcHRpb25zLmxpZ2h0TWFwQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICAgICAgICAgIG9wdGlvbnMubGlnaHRNYXBVdiA9IDE7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5saWdodE1hcFRyYW5zZm9ybSA9IDA7XG4gICAgICAgICAgICAgICAgb3B0aW9ucy5saWdodE1hcFdpdGhvdXRBbWJpZW50ID0gIXN0ZE1hdC5saWdodE1hcDtcbiAgICAgICAgICAgICAgICBpZiAoKG9iakRlZnMgJiBTSEFERVJERUZfRElSTE0pICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZGlyTGlnaHRNYXAgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGlmIGxpZ2h0bWFwcyBjb250YWluIGJha2VkIGFtYmllbnQgbGlnaHQsIGRpc2FibGUgcmVhbC10aW1lIGFtYmllbnQgbGlnaHRcbiAgICAgICAgICAgICAgICBpZiAoKG9iakRlZnMgJiBTSEFERVJERUZfTE1BTUJJRU5UKSAhPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLmxpZ2h0TWFwV2l0aG91dEFtYmllbnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3RkTWF0LnVzZUxpZ2h0aW5nKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodHNGaWx0ZXJlZCA9IFtdO1xuICAgICAgICAgICAgY29uc3QgbWFzayA9IG9iakRlZnMgPyAob2JqRGVmcyA+PiAxNikgOiBNQVNLX0FGRkVDVF9EWU5BTUlDO1xuXG4gICAgICAgICAgICAvLyBtYXNrIHRvIHNlbGVjdCBsaWdodHMgKGR5bmFtaWMgdnMgbGlnaHRtYXBwZWQpIHdoZW4gdXNpbmcgY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgICAgICBvcHRpb25zLmxpZ2h0TWFza0R5bmFtaWMgPSAhIShtYXNrICYgTUFTS19BRkZFQ1RfRFlOQU1JQyk7XG5cbiAgICAgICAgICAgIGlmIChzb3J0ZWRMaWdodHMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb2xsZWN0TGlnaHRzKExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgc29ydGVkTGlnaHRzW0xJR0hUVFlQRV9ESVJFQ1RJT05BTF0sIGxpZ2h0c0ZpbHRlcmVkLCBtYXNrKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb2xsZWN0TGlnaHRzKExJR0hUVFlQRV9PTU5JLCBzb3J0ZWRMaWdodHNbTElHSFRUWVBFX09NTkldLCBsaWdodHNGaWx0ZXJlZCwgbWFzaywgc3RhdGljTGlnaHRMaXN0KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9jb2xsZWN0TGlnaHRzKExJR0hUVFlQRV9TUE9ULCBzb3J0ZWRMaWdodHNbTElHSFRUWVBFX1NQT1RdLCBsaWdodHNGaWx0ZXJlZCwgbWFzaywgc3RhdGljTGlnaHRMaXN0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIG9wdGlvbnMubGlnaHRzID0gbGlnaHRzRmlsdGVyZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvcHRpb25zLmxpZ2h0cyA9IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubGlnaHRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgb3B0aW9ucy5ub1NoYWRvdyA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlVGV4T3B0aW9ucyhvcHRpb25zLCBzdGRNYXQsIHAsIGhhc1V2MCwgaGFzVXYxLCBoYXNWY29sb3IsIG1pbmltYWxPcHRpb25zLCB1bmlxdWVUZXh0dXJlTWFwKSB7XG4gICAgICAgIGNvbnN0IG1uYW1lID0gcCArICdNYXAnO1xuICAgICAgICBjb25zdCB2bmFtZSA9IHAgKyAnVmVydGV4Q29sb3InO1xuICAgICAgICBjb25zdCB2Y25hbWUgPSBwICsgJ1ZlcnRleENvbG9yQ2hhbm5lbCc7XG4gICAgICAgIGNvbnN0IGNuYW1lID0gbW5hbWUgKyAnQ2hhbm5lbCc7XG4gICAgICAgIGNvbnN0IHRuYW1lID0gbW5hbWUgKyAnVHJhbnNmb3JtJztcbiAgICAgICAgY29uc3QgdW5hbWUgPSBtbmFtZSArICdVdic7XG4gICAgICAgIGNvbnN0IGluYW1lID0gbW5hbWUgKyAnSWRlbnRpZmllcic7XG5cbiAgICAgICAgLy8gQXZvaWQgb3ZlcnJpZGluZyBwcmV2aW91cyBsaWdodE1hcCBwcm9wZXJ0aWVzXG4gICAgICAgIGlmIChwICE9PSAnbGlnaHQnKSB7XG4gICAgICAgICAgICBvcHRpb25zW21uYW1lXSA9IGZhbHNlO1xuICAgICAgICAgICAgb3B0aW9uc1tjbmFtZV0gPSAnJztcbiAgICAgICAgICAgIG9wdGlvbnNbdG5hbWVdID0gMDtcbiAgICAgICAgICAgIG9wdGlvbnNbdW5hbWVdID0gMDtcbiAgICAgICAgICAgIG9wdGlvbnNbaW5hbWVdID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIG9wdGlvbnNbdm5hbWVdID0gZmFsc2U7XG4gICAgICAgIG9wdGlvbnNbdmNuYW1lXSA9ICcnO1xuXG4gICAgICAgIGNvbnN0IGlzT3BhY2l0eSA9IHAgPT09ICdvcGFjaXR5JztcbiAgICAgICAgaWYgKGlzT3BhY2l0eSAmJiBzdGRNYXQuYmxlbmRUeXBlID09PSBCTEVORF9OT05FICYmIHN0ZE1hdC5hbHBoYVRlc3QgPT09IDAuMCAmJiAhc3RkTWF0LmFscGhhVG9Db3ZlcmFnZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAoIW1pbmltYWxPcHRpb25zIHx8IGlzT3BhY2l0eSkge1xuICAgICAgICAgICAgaWYgKHAgIT09ICdoZWlnaHQnICYmIHN0ZE1hdFt2bmFtZV0pIHtcbiAgICAgICAgICAgICAgICBpZiAoaGFzVmNvbG9yKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnNbdm5hbWVdID0gc3RkTWF0W3ZuYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uc1t2Y25hbWVdID0gc3RkTWF0W3ZjbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMudmVydGV4Q29sb3JzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RkTWF0W21uYW1lXSkge1xuICAgICAgICAgICAgICAgIGxldCBhbGxvdyA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKHN0ZE1hdFt1bmFtZV0gPT09IDAgJiYgIWhhc1V2MCkgYWxsb3cgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBpZiAoc3RkTWF0W3VuYW1lXSA9PT0gMSAmJiAhaGFzVXYxKSBhbGxvdyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChhbGxvdykge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBhbiBpbnRlcm1lZGlhdGUgbWFwIGJldHdlZW4gdGhlIHRleHR1cmVzIGFuZCB0aGVpciBzbG90c1xuICAgICAgICAgICAgICAgICAgICAvLyB0byBlbnN1cmUgdGhlIHVuaXF1ZSB0ZXh0dXJlIG1hcHBpbmcgaXNuJ3QgZGVwZW5kZW50IG9uIHRoZSB0ZXh0dXJlIGlkXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzIHRoYXQgd2lsbCBjaGFuZ2Ugd2hlbiB0ZXh0dXJlcyBhcmUgY2hhbmdlZCwgZXZlbiBpZiB0aGUgc2hhcmluZyBpcyB0aGUgc2FtZVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBtYXBJZCA9IHN0ZE1hdFttbmFtZV0uaWQ7XG4gICAgICAgICAgICAgICAgICAgIGxldCBpZGVudGlmaWVyID0gdW5pcXVlVGV4dHVyZU1hcFttYXBJZF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpZGVudGlmaWVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaXF1ZVRleHR1cmVNYXBbbWFwSWRdID0gcDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkZW50aWZpZXIgPSBwO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uc1ttbmFtZV0gPSAhIXN0ZE1hdFttbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnNbaW5hbWVdID0gaWRlbnRpZmllcjtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uc1t0bmFtZV0gPSB0aGlzLl9nZXRNYXBUcmFuc2Zvcm1JRChzdGRNYXQuZ2V0VW5pZm9ybSh0bmFtZSksIHN0ZE1hdFt1bmFtZV0pO1xuICAgICAgICAgICAgICAgICAgICBvcHRpb25zW2NuYW1lXSA9IHN0ZE1hdFtjbmFtZV07XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnNbdW5hbWVdID0gc3RkTWF0W3VuYW1lXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY29sbGVjdExpZ2h0cyhsVHlwZSwgbGlnaHRzLCBsaWdodHNGaWx0ZXJlZCwgbWFzaywgc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlnaHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcbiAgICAgICAgICAgIGlmIChsaWdodC5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0Lm1hc2sgJiBtYXNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsVHlwZSAhPT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGlnaHQuaXNTdGF0aWMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBsaWdodHNGaWx0ZXJlZC5wdXNoKGxpZ2h0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3RhdGljTGlnaHRMaXN0KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXRpY0xpZ2h0TGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gc3RhdGljTGlnaHRMaXN0W2ldO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gbFR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHRzRmlsdGVyZWQucHVzaChsaWdodCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2dldE1hcFRyYW5zZm9ybUlEKHhmb3JtLCB1dikge1xuICAgICAgICBpZiAoIXhmb3JtKSByZXR1cm4gMDtcblxuICAgICAgICBsZXQgeGZvcm1zID0gdGhpcy5fbWFwWEZvcm1zW3V2XTtcbiAgICAgICAgaWYgKCF4Zm9ybXMpIHtcbiAgICAgICAgICAgIHhmb3JtcyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fbWFwWEZvcm1zW3V2XSA9IHhmb3JtcztcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgeGZvcm1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoYXJyYXlzRXF1YWwoeGZvcm1zW2ldWzBdLnZhbHVlLCB4Zm9ybVswXS52YWx1ZSkgJiZcbiAgICAgICAgICAgICAgICBhcnJheXNFcXVhbCh4Zm9ybXNbaV1bMV0udmFsdWUsIHhmb3JtWzFdLnZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB4Zm9ybXMucHVzaCh4Zm9ybSk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9uc0J1aWxkZXIgfTtcbiJdLCJuYW1lcyI6WyJhcnJheXNFcXVhbCIsImEiLCJiIiwibGVuZ3RoIiwiaSIsIm5vdFdoaXRlIiwiY29sb3IiLCJyIiwiZyIsIm5vdEJsYWNrIiwiU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyIiwiY29uc3RydWN0b3IiLCJfbWFwWEZvcm1zIiwidXBkYXRlTWluUmVmIiwib3B0aW9ucyIsInNjZW5lIiwic3RkTWF0Iiwib2JqRGVmcyIsInN0YXRpY0xpZ2h0TGlzdCIsInBhc3MiLCJzb3J0ZWRMaWdodHMiLCJfdXBkYXRlU2hhcmVkT3B0aW9ucyIsIl91cGRhdGVNaW5PcHRpb25zIiwiX3VwZGF0ZVVWT3B0aW9ucyIsInVwZGF0ZVJlZiIsIl91cGRhdGVFbnZPcHRpb25zIiwiX3VwZGF0ZU1hdGVyaWFsT3B0aW9ucyIsIlNIQURFUl9GT1JXQVJESERSIiwiZ2FtbWEiLCJHQU1NQV9TUkdCSERSIiwidG9uZU1hcCIsIlRPTkVNQVBfTElORUFSIiwiaGFzVGFuZ2VudHMiLCJTSEFERVJERUZfVEFOR0VOVFMiLCJfdXBkYXRlTGlnaHRPcHRpb25zIiwiYWxwaGFUZXN0IiwiZm9yY2VGcmFnbWVudFByZWNpc2lvbiIsImNodW5rcyIsImJsZW5kVHlwZSIsImZvcmNlVXYxIiwic2VwYXJhdGVBbWJpZW50Iiwic2NyZWVuU3BhY2UiLCJTSEFERVJERUZfU0NSRUVOU1BBQ0UiLCJza2luIiwiU0hBREVSREVGX1NLSU4iLCJ1c2VJbnN0YW5jaW5nIiwiU0hBREVSREVGX0lOU1RBTkNJTkciLCJ1c2VNb3JwaFBvc2l0aW9uIiwiU0hBREVSREVGX01PUlBIX1BPU0lUSU9OIiwidXNlTW9ycGhOb3JtYWwiLCJTSEFERVJERUZfTU9SUEhfTk9STUFMIiwidXNlTW9ycGhUZXh0dXJlQmFzZWQiLCJTSEFERVJERUZfTU9SUEhfVEVYVFVSRV9CQVNFRCIsIm5pbmVTbGljZWRNb2RlIiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwidXNlTGlnaHRpbmciLCJjbHVzdGVyZWRMaWdodGluZ0Nvb2tpZXNFbmFibGVkIiwibGlnaHRpbmciLCJjb29raWVzRW5hYmxlZCIsImNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93c0VuYWJsZWQiLCJzaGFkb3dzRW5hYmxlZCIsImNsdXN0ZXJlZExpZ2h0aW5nU2hhZG93VHlwZSIsInNoYWRvd1R5cGUiLCJjbHVzdGVyZWRMaWdodGluZ0FyZWFMaWdodHNFbmFibGVkIiwiYXJlYUxpZ2h0c0VuYWJsZWQiLCJtaW5pbWFsT3B0aW9ucyIsImhhc1V2MCIsImhhc1V2MSIsImhhc1Zjb2xvciIsIlNIQURFUkRFRl9VVjAiLCJTSEFERVJERUZfVVYxIiwiU0hBREVSREVGX1ZDT0xPUiIsInZlcnRleENvbG9ycyIsInVuaXF1ZVRleHR1cmVNYXAiLCJwIiwiX21hdFRleDJEIiwiX3VwZGF0ZVRleE9wdGlvbnMiLCJvcGFjaXR5VGludCIsIm9wYWNpdHkiLCJCTEVORF9OT05FIiwibGlnaHRzIiwiZGlmZnVzZVRpbnQiLCJkaWZmdXNlTWFwIiwiZGlmZnVzZVZlcnRleENvbG9yIiwiZGlmZnVzZSIsInVzZVNwZWN1bGFyIiwidXNlTWV0YWxuZXNzIiwic3BlY3VsYXJNYXAiLCJzcGhlcmVNYXAiLCJjdWJlTWFwIiwic3BlY3VsYXIiLCJzcGVjdWxhcml0eUZhY3RvciIsImVuYWJsZUdHWFNwZWN1bGFyIiwiY2xlYXJDb2F0IiwidXNlU3BlY3VsYXJDb2xvciIsInVzZU1ldGFsbmVzc1NwZWN1bGFyQ29sb3IiLCJzcGVjdWxhclRpbnQiLCJzcGVjdWxhclZlcnRleENvbG9yIiwic3BlY3VsYXJpdHlGYWN0b3JUaW50Iiwic3BlY3VsYXJpdHlGYWN0b3JNYXAiLCJlbWlzc2l2ZVRpbnRDb2xvciIsImVtaXNzaXZlTWFwIiwiZW1pc3NpdmUiLCJlbWlzc2l2ZVRpbnQiLCJlbWlzc2l2ZVRpbnRJbnRlbnNpdHkiLCJlbWlzc2l2ZUludGVuc2l0eSIsImlzUGFja2VkTm9ybWFsTWFwIiwibm9ybWFsTWFwIiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfRFhUNSIsInR5cGUiLCJURVhUVVJFVFlQRV9TV0laWkxFR0dHUiIsImJsZW5kTWFwc1dpdGhDb2xvcnMiLCJhbWJpZW50VGludCIsInVzZVNwZWN1bGFyaXR5RmFjdG9yIiwibWV0YWxuZXNzVGludCIsIm1ldGFsbmVzcyIsImdsb3NzVGludCIsImFscGhhVG9Db3ZlcmFnZSIsIm5vcm1hbGl6ZU5vcm1hbE1hcCIsImFtYmllbnRTSCIsImRpZmZ1c2VFbmNvZGluZyIsImVuY29kaW5nIiwiZGlmZnVzZURldGFpbEVuY29kaW5nIiwiZGlmZnVzZURldGFpbE1hcCIsImVtaXNzaXZlRW5jb2RpbmciLCJsaWdodE1hcEVuY29kaW5nIiwibGlnaHRNYXAiLCJjb25zZXJ2ZUVuZXJneSIsIm9wYWNpdHlGYWRlc1NwZWN1bGFyIiwiYWxwaGFGYWRlIiwib2NjbHVkZVNwZWN1bGFyIiwib2NjbHVkZVNwZWN1bGFyRmxvYXQiLCJvY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkiLCJvY2NsdWRlRGlyZWN0Iiwic2hhZGluZ01vZGVsIiwiZnJlc25lbE1vZGVsIiwicGFja2VkTm9ybWFsIiwiZmFzdFRibiIsImN1YmVNYXBQcm9qZWN0aW9uIiwiY3VzdG9tRnJhZ21lbnRTaGFkZXIiLCJyZWZyYWN0aW9uIiwicmVmcmFjdGlvbk1hcCIsInVzZUR5bmFtaWNSZWZyYWN0aW9uIiwicmVmbGVjdGlvblNvdXJjZSIsInJlZnJhY3Rpb25JbmRleFRpbnQiLCJyZWZyYWN0aW9uSW5kZXgiLCJ0aGlja25lc3NUaW50IiwidGhpY2tuZXNzIiwic3BlY3VsYXJFbmNvZGluZyIsInNoZWVuRW5jb2RpbmciLCJtc2RmIiwibXNkZk1hcCIsIm1zZGZUZXh0QXR0cmlidXRlIiwidHdvU2lkZWRMaWdodGluZyIsInBpeGVsU25hcCIsImFvTWFwVXYiLCJhb1V2U2V0IiwiZGlmZnVzZURldGFpbCIsIm5vcm1hbERldGFpbCIsImRpZmZ1c2VEZXRhaWxNb2RlIiwiZGV0YWlsTW9kZXMiLCJjbGVhckNvYXRUaW50IiwiY2xlYXJDb2F0R2xvc3NpbmVzcyIsImNsZWFyQ29hdEdsb3NzVGludCIsImlyaWRlc2NlbmNlIiwidXNlSXJpZGVzY2VuY2UiLCJpcmlkZXNjZW5jZVRpbnQiLCJzaGVlbiIsInVzZVNoZWVuIiwic2hlZW5UaW50Iiwic2hlZW5HbG9zc2luZXNzVGludCIsImZvZyIsInVzZUZvZyIsInVzZUdhbW1hVG9uZW1hcCIsImdhbW1hQ29ycmVjdGlvbiIsIkdBTU1BX05PTkUiLCJ0b25lTWFwcGluZyIsImZpeFNlYW1zIiwiZml4Q3ViZW1hcFNlYW1zIiwiaXNQaG9uZyIsIlNQRUNVTEFSX1BIT05HIiwidXNpbmdTY2VuZUVudiIsImVudkF0bGFzIiwicmVmbGVjdGlvbkVuY29kaW5nIiwidXNlU2t5Ym94Iiwic2t5Ym94IiwiYW1iaWVudFNvdXJjZSIsImFtYmllbnRFbmNvZGluZyIsInNreWJveEludGVuc2l0eSIsInNreWJveEx1bWluYW5jZSIsInVzZUN1YmVNYXBSb3RhdGlvbiIsInNreWJveFJvdGF0aW9uIiwiZXF1YWxzIiwiUXVhdCIsIklERU5USVRZIiwibGlnaHRNYXBDaGFubmVsIiwibGlnaHRNYXBVdiIsImxpZ2h0TWFwVHJhbnNmb3JtIiwibGlnaHRNYXBXaXRob3V0QW1iaWVudCIsImRpckxpZ2h0TWFwIiwibm9TaGFkb3ciLCJTSEFERVJERUZfTk9TSEFET1ciLCJTSEFERVJERUZfTE0iLCJTSEFERVJERUZfRElSTE0iLCJTSEFERVJERUZfTE1BTUJJRU5UIiwibGlnaHRzRmlsdGVyZWQiLCJtYXNrIiwiTUFTS19BRkZFQ1RfRFlOQU1JQyIsImxpZ2h0TWFza0R5bmFtaWMiLCJfY29sbGVjdExpZ2h0cyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIkxJR0hUVFlQRV9PTU5JIiwiTElHSFRUWVBFX1NQT1QiLCJtbmFtZSIsInZuYW1lIiwidmNuYW1lIiwiY25hbWUiLCJ0bmFtZSIsInVuYW1lIiwiaW5hbWUiLCJ1bmRlZmluZWQiLCJpc09wYWNpdHkiLCJhbGxvdyIsIm1hcElkIiwiaWQiLCJpZGVudGlmaWVyIiwiX2dldE1hcFRyYW5zZm9ybUlEIiwiZ2V0VW5pZm9ybSIsImxUeXBlIiwibGlnaHQiLCJlbmFibGVkIiwiaXNTdGF0aWMiLCJwdXNoIiwiX3R5cGUiLCJ4Zm9ybSIsInV2IiwieGZvcm1zIiwidmFsdWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFtQkEsTUFBTUEsV0FBVyxHQUFHLENBQUNDLENBQUQsRUFBSUMsQ0FBSixLQUFVO0FBQzFCLEVBQUEsSUFBSUQsQ0FBQyxDQUFDRSxNQUFGLEtBQWFELENBQUMsQ0FBQ0MsTUFBbkIsRUFBMkI7QUFDdkIsSUFBQSxPQUFPLEtBQVAsQ0FBQTtBQUNILEdBQUE7O0FBQ0QsRUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdILENBQUMsQ0FBQ0UsTUFBdEIsRUFBOEIsRUFBRUMsQ0FBaEMsRUFBbUM7SUFDL0IsSUFBSUgsQ0FBQyxDQUFDRyxDQUFELENBQUQsS0FBU0YsQ0FBQyxDQUFDRSxDQUFELENBQWQsRUFBbUI7QUFDZixNQUFBLE9B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
